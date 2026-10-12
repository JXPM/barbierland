// Cœur métier : réservations, jauge, émission des billets, contrôle à l'entrée.
// Toutes les écritures passent par ici (site, admin, et plus tard le webhook de paiement).
import { randomInt } from 'node:crypto';
import { PASS, JAUGE, RESERVATION_HEURES, OPERATEURS_GUICHET, CGV_VERSION, CONSERVATION } from './config.js';
import { query, tx } from './db.js';
import { HttpError } from './http.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans 0/O ni 1/I
const aleatoire = n => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const nouvelleRef = () => `BC-${aleatoire(6)}`;
// Même format que le registre de l'équipe : n° + 3 blocs aléatoires (~60 bits).
export const nouveauCode = numero => `${numero}-${aleatoire(4)}-${aleatoire(4)}-${aleatoire(4)}`;

// Verrou applicatif : sérialise tout ce qui touche à la jauge.
const VERROU_JAUGE = 2027_01_01;

// ---------- Validation ----------

// Numéro ivoirien (10 chiffres, 01/05/07) → E.164.
export function normaliserTelephone(brut) {
  let d = String(brut ?? '').replace(/[\s.\-()]/g, '');
  if (d.startsWith('+225')) d = d.slice(4);
  else if (d.startsWith('00225')) d = d.slice(5);
  else if (d.length === 13 && d.startsWith('225')) d = d.slice(3);
  return /^0[157]\d{8}$/.test(d) ? `+225${d}` : null;
}

const texte = (v, max = 80) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function validerCommande(entree) {
  const erreurs = {};
  const pass = entree.pass;
  if (!PASS[pass]) erreurs.pass = 'Choisis un pass.';
  const nom = texte(entree.nom);
  const prenom = texte(entree.prenom);
  if (!nom) erreurs.nom = 'Indique ton nom.';
  if (!prenom) erreurs.prenom = 'Indique ton prénom.';
  const telephone = normaliserTelephone(entree.telephone);
  if (!telephone) erreurs.telephone = 'Numéro ivoirien à 10 chiffres (01, 05 ou 07…).';
  const email = texte(entree.email, 120).toLowerCase() || null;
  if (entree.emailObligatoire !== false && !email) erreurs.email = 'Indique ton e-mail.';
  else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erreurs.email = 'Adresse e-mail invalide (ex. nom@gmail.com).';
  const nomDuo = pass === 'duo' ? texte(entree.nom_duo) : null;
  if (pass === 'duo' && !nomDuo) erreurs.nom_duo = 'Indique le nom de la personne qui t’accompagne.';
  const operateur = entree.operateur ? texte(entree.operateur, 30) : null;
  if (operateur && !OPERATEURS_GUICHET.includes(operateur)) erreurs.operateur = 'Moyen de paiement inconnu.';
  // Loi 2013-546 art. 21-22 : conditions acceptées avant la commande. Loi 2013-450 : consentement exprès.
  if (entree.cgv !== true) erreurs.cgv = 'Accepte les conditions de vente et la politique de confidentialité pour réserver.';
  const mineur = entree.mineur === true;
  if (mineur && entree.autorisation_parentale !== true) {
    erreurs.autorisation_parentale = 'Si tu as moins de 18 ans, il faut l’accord d’un parent ou tuteur.';
  }

  if (Object.keys(erreurs).length) {
    throw new HttpError(422, 'validation', 'Certaines informations sont à corriger.', { champs: erreurs });
  }
  return { pass, nom, prenom, telephone, email, nom_duo: nomDuo, operateur, mineur, optin_infos: entree.optin_infos === true };
}

// ---------- Jauge ----------

const SQL_PERSONNES = `
  SELECT
    COALESCE(SUM(CASE WHEN pass = 'duo' THEN 2 ELSE 1 END) FILTER (WHERE statut = 'payee'), 0)::int AS payees,
    COALESCE(SUM(CASE WHEN pass = 'duo' THEN 2 ELSE 1 END) FILTER (
      WHERE statut = 'en_attente' AND cree_le > now() - make_interval(hours => $1)), 0)::int AS reservees
  FROM commandes`;

export async function etatJauge(client = { query }) {
  const { rows: [r] } = await client.query(SQL_PERSONNES, [RESERVATION_HEURES]);
  const occupees = r.payees + r.reservees;
  return { jauge: JAUGE, payees: r.payees, reservees: r.reservees, occupees, restantes: Math.max(0, JAUGE - occupees) };
}

function exigerPlace(etat, personnes, { compterReservees }) {
  const prises = compterReservees ? etat.occupees : etat.payees;
  if (prises + personnes > JAUGE) {
    throw new HttpError(409, 'complet', personnes === 2 && JAUGE - prises === 1
      ? 'Il ne reste qu’une place : le Pass Duo n’est plus disponible.'
      : 'C’est complet : la jauge de la soirée est atteinte.');
  }
}

// ---------- Commandes ----------

// Réservation depuis le site : statut « en_attente » jusqu'au paiement.
// Au guichet (admin) : payée tout de suite, le billet est émis dans la foulée.
export async function creerCommande(entree, { canal = 'site', vendeur = null, paiementRef = null } = {}) {
  const c = validerCommande({ ...entree, emailObligatoire: canal === 'site' });
  const p = PASS[c.pass];
  return tx(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [VERROU_JAUGE]);
    exigerPlace(await etatJauge(client), p.personnes, { compterReservees: true });
    const { rows: [commande] } = await client.query(
      `INSERT INTO commandes (ref, pass, nom, prenom, telephone, email, nom_duo, montant, operateur, canal, vendeur,
                              cgv_version, cgv_acceptees_le, mineur, optin_infos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now(), $13, $14) RETURNING *`,
      [nouvelleRef(), c.pass, c.nom, c.prenom, c.telephone, c.email, c.nom_duo, p.prix, c.operateur, canal, vendeur,
        CGV_VERSION, c.mineur, c.optin_infos]);
    if (c.optin_infos) {
      await client.query(
        `INSERT INTO abonnes (telephone, prenom, nom, email, source) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (telephone) DO UPDATE SET prenom = $2, nom = $3, email = COALESCE($4, abonnes.email), consenti_le = now(), source = $5`,
        [c.telephone, c.prenom, c.nom, c.email, commande.ref]);
    }
    if (canal !== 'guichet') return { commande, billet: null };
    const billet = await emettre(client, commande, { vendeur, operateur: c.operateur, paiementRef });
    return { commande: { ...commande, statut: 'payee' }, billet };
  });
}

async function emettre(client, commande, { vendeur, operateur, paiementRef }) {
  const p = PASS[commande.pass];
  const { rows: [{ n }] } = await client.query(`SELECT nextval('${p.sequence}')::int AS n`);
  const numero = `${p.prefixe}${String(n).padStart(3, '0')}`;
  await client.query(
    `UPDATE commandes SET statut = 'payee', payee_le = now(),
       vendeur = COALESCE($2, vendeur), operateur = COALESCE($3, operateur), paiement_ref = COALESCE($4, paiement_ref)
     WHERE id = $1`, [commande.id, vendeur, operateur, paiementRef]);
  const { rows: [billet] } = await client.query(
    'INSERT INTO billets (numero, code, commande_id) VALUES ($1,$2,$3) RETURNING *',
    [numero, nouveauCode(numero), commande.id]);
  return billet;
}

// Paiement reçu → émet le billet (et son QR). Idempotent : rappeler renvoie le même billet.
// Point d'entrée unique pour l'admin aujourd'hui et le webhook de paiement demain.
export async function confirmerCommande(ref, { vendeur = null, operateur = null, paiementRef = null } = {}) {
  return tx(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [VERROU_JAUGE]);
    const { rows: [commande] } = await client.query('SELECT * FROM commandes WHERE ref = $1 FOR UPDATE', [ref]);
    if (!commande) throw new HttpError(404, 'introuvable', 'Commande introuvable.');
    if (commande.statut === 'annulee') throw new HttpError(409, 'annulee', 'Cette commande a été annulée.');
    if (commande.statut === 'payee') {
      const { rows: [billet] } = await client.query('SELECT * FROM billets WHERE commande_id = $1', [commande.id]);
      return { commande, billet, deja: true };
    }
    exigerPlace(await etatJauge(client), PASS[commande.pass].personnes, { compterReservees: false });
    const billet = await emettre(client, commande, { vendeur, operateur, paiementRef });
    return { commande: { ...commande, statut: 'payee' }, billet, deja: false };
  });
}

// Annule la commande et invalide son billet (le QR sera refusé à l'entrée).
export async function annulerCommande(ref, { note = null } = {}) {
  return tx(async client => {
    const { rows: [commande] } = await client.query(
      `UPDATE commandes SET statut = 'annulee', annulee_le = now(), note = COALESCE($2, note)
       WHERE ref = $1 AND statut <> 'annulee' RETURNING *`, [ref, note]);
    if (!commande) {
      const { rowCount } = await client.query('SELECT 1 FROM commandes WHERE ref = $1', [ref]);
      throw rowCount
        ? new HttpError(409, 'deja_annulee', 'Commande déjà annulée.')
        : new HttpError(404, 'introuvable', 'Commande introuvable.');
    }
    await client.query("UPDATE billets SET statut = 'annule' WHERE commande_id = $1", [commande.id]);
    return { commande };
  });
}

// ---------- Billets ----------

const SQL_BILLET = `
  SELECT b.numero, b.code, b.statut, b.entre_le, b.entre_par,
         c.pass, c.nom, c.prenom, c.nom_duo, c.ref
  FROM billets b JOIN commandes c ON c.id = b.commande_id`;

const normaliserCode = code => String(code ?? '').trim().toUpperCase();

export async function trouverBillet(code) {
  const { rows: [b] } = await query(`${SQL_BILLET} WHERE b.code = $1`, [normaliserCode(code)]);
  return b ?? null;
}

// Scan à l'entrée : la mise à jour conditionnelle garantit qu'un billet n'entre qu'une fois,
// même si deux portes scannent le même QR en même temps.
export async function controlerBillet(code, poste = 'Entrée') {
  const c = normaliserCode(code);
  const { rows: [entre] } = await query(
    `UPDATE billets SET entre_le = now(), entre_par = $2
     WHERE code = $1 AND statut = 'valide' AND entre_le IS NULL RETURNING id`, [c, texte(poste, 40) || 'Entrée']);
  const billet = await trouverBillet(c);
  if (!billet) return { resultat: 'inconnu' };
  if (entre) return { resultat: 'ok', billet };
  if (billet.statut === 'annule') return { resultat: 'annule', billet };
  return { resultat: 'deja_entre', billet };
}

// ---------- Admin ----------

export async function statistiques() {
  const jauge = await etatJauge();
  const { rows: [s] } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE statut = 'payee' AND pass = 'solo')::int AS solo,
      COUNT(*) FILTER (WHERE statut = 'payee' AND pass = 'duo')::int AS duo,
      COUNT(*) FILTER (WHERE statut = 'en_attente')::int AS en_attente,
      COALESCE(SUM(montant) FILTER (WHERE statut = 'payee'), 0)::int AS recette
    FROM commandes`);
  const { rows: [e] } = await query(`
    SELECT COUNT(*)::int AS billets,
           COALESCE(SUM(CASE WHEN c.pass = 'duo' THEN 2 ELSE 1 END) FILTER (WHERE b.entre_le IS NOT NULL), 0)::int AS personnes_entrees
    FROM billets b JOIN commandes c ON c.id = b.commande_id WHERE b.statut = 'valide'`);
  return { ...jauge, ...s, ...e };
}

export async function listerCommandes({ q = '', statut = '' } = {}) {
  const conditions = [];
  const vals = [];
  if (['en_attente', 'payee', 'annulee'].includes(statut)) {
    vals.push(statut);
    conditions.push(`c.statut = $${vals.length}`);
  }
  const recherche = texte(q, 60);
  if (recherche) {
    vals.push(`%${recherche}%`);
    const i = vals.length;
    conditions.push(`(c.ref ILIKE $${i} OR c.nom ILIKE $${i} OR c.prenom ILIKE $${i} OR c.telephone ILIKE $${i}
                      OR c.email ILIKE $${i} OR c.nom_duo ILIKE $${i} OR b.numero ILIKE $${i})`);
  }
  const { rows } = await query(`
    SELECT c.*, b.numero, b.code, b.statut AS billet_statut, b.entre_le
    FROM commandes c LEFT JOIN billets b ON b.commande_id = c.id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY c.cree_le DESC LIMIT 1000`, vals);
  return rows;
}

// ---------- Données personnelles (loi n° 2013-450) ----------

// Trace qui a fait quoi (art. 41). Jamais bloquant pour l'opération elle-même.
export async function journaliser(acteur, action, ref = null, details = null) {
  try {
    await query('INSERT INTO journal (acteur, action, ref, details) VALUES ($1,$2,$3,$4)',
      [texte(acteur, 60) || 'inconnu', action, ref, details && JSON.stringify(details)]);
  } catch (err) {
    console.error('journal', err);
  }
}

const SQL_ANONYMISER = `
  UPDATE commandes SET nom = 'Anonyme', prenom = '', telephone = '', email = NULL,
         nom_duo = CASE WHEN pass = 'duo' THEN 'Anonyme' END, note = NULL, anonymisee_le = now()
  WHERE anonymisee_le IS NULL`;

// Droit à l'effacement (art. 33-35) : on garde montant, pass, dates et réf. (comptabilité), on efface l'identité.
// Le billet reste valable s'il était payé : seule l'identité disparaît.
export async function anonymiserCommande(ref) {
  const { rows: [c] } = await query(`${SQL_ANONYMISER} AND ref = $1 RETURNING ref, telephone`, [ref]);
  if (!c) {
    const { rowCount } = await query('SELECT 1 FROM commandes WHERE ref = $1', [ref]);
    throw rowCount
      ? new HttpError(409, 'deja_anonymisee', 'Données déjà effacées.')
      : new HttpError(404, 'introuvable', 'Commande introuvable.');
  }
  return { ref: c.ref };
}

// Droit d'accès et de portabilité (art. 29, 38) : tout ce qu'on détient sur un numéro.
export async function donneesPersonne(telephoneBrut) {
  const telephone = normaliserTelephone(telephoneBrut);
  if (!telephone) throw new HttpError(422, 'validation', 'Numéro invalide.');
  const { rows: commandes } = await query(`
    SELECT c.ref, c.pass, c.nom, c.prenom, c.telephone, c.email, c.nom_duo, c.montant, c.operateur, c.statut, c.canal,
           c.cree_le, c.payee_le, c.annulee_le, c.cgv_version, c.cgv_acceptees_le, c.mineur, c.optin_infos,
           b.numero, b.statut AS billet_statut, b.entre_le
    FROM commandes c LEFT JOIN billets b ON b.commande_id = c.id
    WHERE c.telephone = $1 ORDER BY c.cree_le`, [telephone]);
  const { rows: [abonne] } = await query('SELECT * FROM abonnes WHERE telephone = $1', [telephone]);
  return { telephone, genere_le: new Date().toISOString(), commandes, abonnement_infos: abonne ?? null };
}

// Retrait du consentement à la prospection (art. 30).
export async function desabonner(telephoneBrut) {
  const telephone = normaliserTelephone(telephoneBrut);
  if (!telephone) throw new HttpError(422, 'validation', 'Numéro invalide.');
  const { rowCount } = await query('DELETE FROM abonnes WHERE telephone = $1', [telephone]);
  await query('UPDATE commandes SET optin_infos = false WHERE telephone = $1', [telephone]);
  return { supprime: rowCount > 0 };
}

// Durées de conservation (art. 16, 43) : à lancer chaque jour (cron) ou à la main (npm run purger).
export async function purger(maintenant = new Date()) {
  const anciennes = await query(`${SQL_ANONYMISER}
    AND statut IN ('en_attente', 'annulee') AND cree_le < $1::timestamptz - make_interval(days => $2)`,
  [maintenant, CONSERVATION.nonPayeeJours]);
  let participants = { rowCount: 0 };
  if (maintenant >= new Date(CONSERVATION.finParticipants)) participants = await query(SQL_ANONYMISER);
  const journal = await query('DELETE FROM journal WHERE quand < $1::timestamptz - make_interval(months => $2)',
    [maintenant, CONSERVATION.journalMois]);
  const abonnes = await query('DELETE FROM abonnes WHERE consenti_le < $1::timestamptz - make_interval(months => $2)',
    [maintenant, CONSERVATION.abonnesMois]);
  return {
    commandes_non_payees: anciennes.rowCount,
    commandes_apres_evenement: participants.rowCount,
    journal: journal.rowCount,
    abonnes: abonnes.rowCount,
  };
}

export async function listerAbonnes() {
  const { rows } = await query('SELECT prenom, nom, telephone, email, consenti_le FROM abonnes ORDER BY consenti_le');
  return rows;
}
