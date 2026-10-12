// Paiement en ligne — adaptateurs interchangeables.
// Par défaut : GeniusPay (flux par redirection, webhook signé). Kadev Pay reste disponible (flux SDK client).
// Règle d'or (fail-closed) : un billet n'est émis que si le paiement est PROUVÉ — signature du webhook
// valide + transaction re-vérifiée via l'API du fournisseur + montant ≥ attendu. Idempotent.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { confirmerCommande, journaliser } from './billetterie.js';
import { query } from './db.js';
import { HttpError } from './http.js';

const env = k => (process.env[k] || '').trim();
const SUCCES = new Set(['success', 'successful', 'completed', 'succeeded', 'paid']);

// Comparaison de chaînes à temps constant.
function egal(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- GeniusPay ----------
// Doc : https://pay.genius.ci/docs/api
const geniuspay = {
  nom: 'GeniusPay',
  mode: 'redirect',
  get actif() { return env('GENIUSPAY_API_KEY').startsWith('pk_') && !!env('GENIUSPAY_API_SECRET') && !!env('GENIUSPAY_WEBHOOK_SECRET'); },
  get test() { return env('GENIUSPAY_API_KEY').startsWith('pk_sandbox'); },
  base: () => env('GENIUSPAY_BASE_URL') || 'https://pay.genius.ci',
  entetes: () => ({ 'X-API-Key': env('GENIUSPAY_API_KEY'), 'X-API-Secret': env('GENIUSPAY_API_SECRET'), Accept: 'application/json' }),

  configClient() { return { actif: true, fournisseur: this.nom, mode: 'redirect', test: this.test }; },

  // Crée la transaction côté serveur et renvoie l'URL de checkout vers laquelle rediriger l'acheteur.
  async creerPaiement(c, { successUrl, errorUrl }) {
    const r = await fetch(`${this.base()}/api/v1/merchant/payments`, {
      method: 'POST',
      headers: { ...this.entetes(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: c.montant,
        currency: 'XOF',
        description: `Babierland City — ${c.ref}`,
        customer: { name: `${c.prenom} ${c.nom}`.trim(), email: c.email || undefined, phone: c.telephone, country: 'CI' },
        success_url: successUrl,
        error_url: errorUrl,
        metadata: { ref: c.ref },   // relie la transaction GeniusPay à NOTRE commande
      }),
    });
    if (!r.ok) throw new HttpError(502, 'init_echec', `Création du paiement impossible (HTTP ${r.status}).`);
    const d = (await r.json().catch(() => ({}))).data ?? {};
    const url = d.checkout_url || d.payment_url;
    if (!url) throw new HttpError(502, 'init_url', 'Réponse de paiement inattendue.');
    return { redirect_url: url, reference: d.reference };
  },

  // Signature : HMAC-SHA256(timestamp + "." + corps brut, secret), fenêtre de 5 min (anti-rejeu).
  verifierSignature(rawBody, headers) {
    const secret = env('GENIUSPAY_WEBHOOK_SECRET');
    if (!secret) return false;
    const ts = String(headers['x-webhook-timestamp'] || '');
    if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
    const sig = String(headers['x-webhook-signature'] || '').replace(/^sha256=/i, '');
    const base = `${ts}.${rawBody}`;
    const hex = createHmac('sha256', secret).update(base).digest('hex');
    const b64 = createHmac('sha256', secret).update(base).digest('base64');
    return egal(sig, hex) || egal(sig, b64);
  },

  lire(event) {
    const d = event?.data ?? event ?? {};
    const meta = d.metadata ?? event?.metadata ?? {};
    return {
      type: event?.event ?? event?.type ?? '',
      reference: d.reference ?? d.id ?? '',           // réf. GeniusPay MTX-…
      ref: meta.ref ?? meta.commande ?? '',           // NOTRE réf. BC-…
      montant: Number(d.amount ?? 0),
      statut: String(d.status ?? '').toLowerCase(),
      operateur: d.payment_method ?? d.payment_provider ?? null,
    };
  },

  // Re-vérification serveur→serveur (ne jamais faire confiance au seul webhook).
  async verifier(reference) {
    const r = await fetch(`${this.base()}/api/v1/merchant/payments/${encodeURIComponent(reference)}`, { headers: this.entetes() });
    if (!r.ok) throw new HttpError(502, 'verif_echec', `Vérification GeniusPay impossible (HTTP ${r.status}).`);
    const j = await r.json().catch(() => ({}));
    return this.lire({ data: j.data ?? j });
  },
};

// ---------- Kadev Pay (secours — flux SDK client) ----------
// Doc : https://pay.kadev.ci/developer-documentation/  (champs à confirmer sur un paiement de test)
const kadev = {
  nom: 'Kadev Pay',
  mode: 'client',
  get actif() { return env('KADEV_PUBLIC_KEY').startsWith('kdvp') && !!env('KADEV_SECRET_KEY') && !!env('KADEV_WEBHOOK_SECRET'); },
  get test() { return env('KADEV_PUBLIC_KEY').startsWith('kdvp_test'); },
  base: () => env('KADEV_BASE_URL') || 'https://pay.kadev.ci',
  configClient() { return { actif: true, fournisseur: this.nom, mode: 'client', test: this.test, public_key: env('KADEV_PUBLIC_KEY'), sdk_url: `${this.base()}/js/v1/kadev-pay.js` }; },

  verifierSignature(rawBody, headers) {
    const secret = env('KADEV_WEBHOOK_SECRET');
    if (!secret) return false;
    const attendue = createHmac('sha512', secret).update(rawBody).digest('hex');
    return egal(headers['x-kadevpay-signature'] || headers['x-kadev-signature'], attendue);
  },
  lire(event) {
    const d = event?.data ?? event ?? {};
    const meta = d.metadata ?? event?.metadata ?? {};
    return {
      type: event?.event ?? event?.type ?? d.event ?? '',
      reference: d.reference ?? d.transaction_reference ?? d.id ?? '',
      ref: meta.ref ?? meta.commande ?? d.ref ?? '',
      montant: Number(d.amount ?? d.montant ?? 0),
      statut: String(d.status ?? d.statut ?? '').toLowerCase(),
      operateur: d.channel ?? d.method ?? d.operator ?? null,
    };
  },
  async verifier(reference) {
    const r = await fetch(`${this.base()}/api/v1/transactions/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${env('KADEV_SECRET_KEY')}`, Accept: 'application/json' },
    });
    if (!r.ok) throw new HttpError(502, 'verif_echec', `Vérification Kadev impossible (HTTP ${r.status}).`);
    const j = await r.json().catch(() => ({}));
    return this.lire({ data: j.data ?? j });
  },
};

export const FOURNISSEURS = { geniuspay, kadev };
export const fournisseur = () => FOURNISSEURS[env('PAIEMENT_FOURNISSEUR') || 'geniuspay'] || geniuspay;

// Config exposée au navigateur (jamais de clé secrète).
export function configClient() {
  const f = fournisseur();
  return f.actif ? f.configClient() : { actif: false };
}

// Statut d'une commande (page de retour après paiement). Réf. BC-… connue du seul acheteur.
export async function statutCommande(ref) {
  const { rows: [c] } = await query(
    'SELECT c.statut, b.code FROM commandes c LEFT JOIN billets b ON b.commande_id = c.id WHERE c.ref = $1',
    [String(ref || '').trim().toUpperCase()]);
  if (!c) throw new HttpError(404, 'introuvable', 'Réservation introuvable.');
  return { statut: c.statut, billet_code: c.statut === 'payee' ? c.code : null };
}

// Démarre un paiement (fournisseurs en mode redirection) : renvoie l'URL de checkout.
export async function initierPaiement(ref, urls) {
  const f = fournisseur();
  if (!f.actif || f.mode !== 'redirect' || !f.creerPaiement) throw new HttpError(503, 'indispo', 'Paiement en ligne indisponible.');
  const { rows: [c] } = await query('SELECT * FROM commandes WHERE ref = $1', [String(ref || '').trim().toUpperCase()]);
  if (!c) throw new HttpError(404, 'introuvable', 'Réservation introuvable.');
  if (c.statut === 'payee') return { deja_payee: true };
  if (c.statut === 'annulee') throw new HttpError(409, 'annulee', 'Cette réservation a été annulée.');
  const r = await f.creerPaiement(c, urls);
  await journaliser(f.nom, 'paiement_initie', c.ref, { tx: r.reference });
  return r;
}

// Webhook : prouve le paiement puis émet le billet (idempotent via confirmerCommande).
export async function traiterWebhook(nomFournisseur, rawBody, headers) {
  const f = FOURNISSEURS[nomFournisseur];
  if (!f || !f.actif) throw new HttpError(503, 'paiement_inactif', 'Paiement non configuré.');
  if (!f.verifierSignature(rawBody, headers)) throw new HttpError(401, 'signature', 'Signature du webhook invalide.');

  let event;
  try { event = JSON.parse(rawBody); } catch { throw new HttpError(400, 'json', 'Corps invalide.'); }
  const e = f.lire(event);

  // Compte marchand partagé avec d'autres projets : leurs événements arrivent aussi ici.
  // On les acquitte (200) pour que le fournisseur ne les renvoie pas, sans rien toucher.
  if (!/^BC-/.test(e.ref)) return { ignore: 'hors_babierland' };

  // On ne traite que les succès ; les autres événements sont acquittés (200) sans rien faire.
  if (!/success|succeeded|completed|paid/.test(e.type) && !SUCCES.has(e.statut)) return { ignore: e.type || e.statut || 'inconnu' };

  const v = await f.verifier(e.reference || e.ref);
  if (!SUCCES.has(v.statut)) throw new HttpError(409, 'non_paye', `Transaction non confirmée (${v.statut || 'statut inconnu'}).`);

  const { rows: [c] } = await query('SELECT montant FROM commandes WHERE ref = $1', [e.ref]);
  if (!c) throw new HttpError(404, 'introuvable', 'Commande introuvable.');
  if (v.montant && v.montant < c.montant) {
    await journaliser(f.nom, 'paiement_montant_insuffisant', e.ref, { attendu: c.montant, recu: v.montant, tx: e.reference });
    throw new HttpError(409, 'montant', `Montant payé insuffisant (${v.montant} < ${c.montant}).`);
  }

  const r = await confirmerCommande(e.ref, { vendeur: f.nom, operateur: e.operateur || v.operateur, paiementRef: e.reference });
  await journaliser(f.nom, r.deja ? 'paiement_rejeu' : 'paiement_confirme', e.ref, { tx: e.reference, billet: r.billet?.numero });
  return { ok: true, ref: e.ref, billet: r.billet?.numero, deja: r.deja };
}
