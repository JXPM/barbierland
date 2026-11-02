// Conformité : loi n° 2013-450 (données personnelles) et loi n° 2013-546 (transactions électroniques).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { viderBase, acheteur, query, closePool } from './helpers.js';

process.env.CRON_SECRET = 'cron-test-secret-1234567890';
const B = await import('../api/_lib/billetterie.js');
const { CONSERVATION, CGV_VERSION } = await import('../api/_lib/config.js');
const { creerServeur } = await import('../scripts/dev-server.js');

let serveur, base;
before(async () => {
  serveur = creerServeur();
  await new Promise(r => serveur.listen(0, r));
  base = `http://localhost:${serveur.address().port}`;
});
after(async () => {
  serveur.close();
  await closePool();
});
beforeEach(viderBase);

test('refuse une réservation sans acceptation des conditions', () => {
  assert.throws(() => B.validerCommande(acheteur({ cgv: undefined })), e => e.status === 422 && !!e.extra.champs.cgv);
  assert.throws(() => B.validerCommande(acheteur({ cgv: 'true' })), e => !!e.extra.champs.cgv); // case réellement cochée (booléen)
});

test('un mineur doit avoir l’accord d’un parent', () => {
  assert.throws(() => B.validerCommande(acheteur({ mineur: true })), e => !!e.extra.champs.autorisation_parentale);
  assert.equal(B.validerCommande(acheteur({ mineur: true, autorisation_parentale: true })).mineur, true);
});

test('la preuve d’acceptation (version + date) est enregistrée', async () => {
  const { commande } = await B.creerCommande(acheteur({ mineur: true, autorisation_parentale: true }));
  assert.equal(commande.cgv_version, CGV_VERSION);
  assert.ok(commande.cgv_acceptees_le instanceof Date);
  assert.equal(commande.mineur, true);
  assert.equal(commande.optin_infos, false);
});

test('opt-in prospection : seulement si coché, et révocable', async () => {
  await B.creerCommande(acheteur());
  assert.equal((await B.listerAbonnes()).length, 0);
  await B.creerCommande(acheteur({ optin_infos: true, telephone: '0505050505' }));
  assert.equal((await B.listerAbonnes()).length, 1);
  assert.deepEqual(await B.desabonner('05 05 05 05 05'), { supprime: true });
  assert.equal((await B.listerAbonnes()).length, 0);
});

test('droit d’accès : toutes les données d’un numéro', async () => {
  const { commande } = await B.creerCommande(acheteur({ optin_infos: true }));
  await B.confirmerCommande(commande.ref);
  await B.creerCommande(acheteur({ telephone: '0101010101' }));
  const d = await B.donneesPersonne('07 00 00 00 01');
  assert.equal(d.commandes.length, 1);
  assert.equal(d.commandes[0].numero, 'S001');
  assert.ok(d.abonnement_infos);
  assert.ok(!('code' in d.commandes[0]), 'le code secret du billet n’est pas exporté');
});

test('droit à l’effacement : identité effacée, comptabilité et billet conservés', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' }));
  const { billet } = await B.confirmerCommande(commande.ref);
  await B.anonymiserCommande(commande.ref);
  const { rows: [c] } = await query('SELECT * FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.nom, 'Anonyme');
  assert.equal(c.telephone, '');
  assert.equal(c.email, null);
  assert.equal(c.nom_duo, 'Anonyme');
  assert.equal(c.montant, 10000);
  assert.equal((await B.controlerBillet(billet.code)).resultat, 'ok');
  await assert.rejects(B.anonymiserCommande(commande.ref), e => e.code === 'deja_anonymisee');
});

test('purge : non payées après 30 jours, tout après la date de fin, journal après 12 mois', async () => {
  const vieille = (await B.creerCommande(acheteur({ nom: 'Vieille' }))).commande;
  await B.creerCommande(acheteur({ nom: 'Recente' }));
  const payee = (await B.creerCommande(acheteur({ nom: 'Payee' }))).commande;
  await B.confirmerCommande(payee.ref);
  await query("UPDATE commandes SET cree_le = now() - interval '31 days' WHERE ref = ANY($1)", [[vieille.ref, payee.ref]]);
  await B.journaliser('test', 'ancien');
  await query("UPDATE journal SET quand = now() - interval '13 months'");

  const r1 = await B.purger(new Date());
  assert.equal(r1.commandes_non_payees, 1);
  assert.equal(r1.commandes_apres_evenement, 0);
  assert.equal(r1.journal, 1);
  const noms = async () => (await query('SELECT nom FROM commandes ORDER BY id')).rows.map(r => r.nom);
  assert.deepEqual(await noms(), ['Anonyme', 'Recente', 'Payee']);

  const r2 = await B.purger(new Date(CONSERVATION.finParticipants));
  // en 2027 : la réservation non payée part à l'étape « 30 jours », la payée à l'étape « fin de conservation »
  assert.equal(r2.commandes_non_payees, 1);
  assert.equal(r2.commandes_apres_evenement, 1);
  assert.deepEqual(await noms(), ['Anonyme', 'Anonyme', 'Anonyme']);
});

test('journal : opérations admin et scans tracés', async () => {
  const cle = { 'Content-Type': 'application/json', 'x-cle': process.env.ADMIN_KEY, 'x-acteur': encodeURIComponent('Estelle T.') };
  const vente = await fetch(`${base}/api/admin/commandes`, { method: 'POST', headers: cle, body: JSON.stringify({ action: 'vendre', ...acheteur(), vendeur: 'Djaït' }) });
  const { billet, commande } = await vente.json();
  await fetch(`${base}/api/admin/export`, { headers: cle });
  await fetch(`${base}/api/controle`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cle': process.env.CONTROLE_KEY },
    body: JSON.stringify({ code: billet.code, poste: 'Porte 1' }),
  });
  await fetch(`${base}/api/admin/commandes`, { method: 'POST', headers: cle, body: JSON.stringify({ action: 'anonymiser', ref: commande.ref }) });
  const { rows } = await query('SELECT acteur, action FROM journal ORDER BY id');
  assert.deepEqual(rows.map(r => [r.acteur, r.action]), [['Djaït', 'vendre'], ['Estelle T.', 'export'], ['Porte 1', 'scan'], ['Estelle T.', 'anonymiser']]);
});

test('cron de purge protégé par CRON_SECRET', async () => {
  assert.equal((await fetch(`${base}/api/cron/purger`)).status, 401);
  const ok = await fetch(`${base}/api/cron/purger`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  assert.equal(ok.status, 200);
  assert.ok('journal' in await ok.json());
});

test('pages légales servies, en-têtes de sécurité, aucune ressource tierce chargée d’office', async () => {
  for (const page of ['/mentions-legales', '/confidentialite', '/conditions']) {
    const r = await fetch(base + page);
    assert.equal(r.status, 200, page);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  }
  const accueil = await (await fetch(`${base}/`)).text();
  assert.doesNotMatch(accueil, /<(script|link|iframe)[^>]+(googleapis|gstatic|unpkg|jsdelivr|maps\.google)/);
  for (const lien of ['/mentions-legales', '/confidentialite', '/conditions']) assert.ok(accueil.includes(`href="${lien}"`), lien);
  assert.equal((await fetch(`${base}/vendor/fonts.css`)).status, 200);
});

test('verifier-legal liste les champs à compléter', async () => {
  const run = promisify(execFile);
  const r = await run(process.execPath, ['scripts/verifier-legal.js']).catch(e => e);
  assert.equal(r.code, 1); // tant que l'identité de l'organisateur n'est pas renseignée
  assert.match(r.stdout, /mentions-legales\.html/);
});
