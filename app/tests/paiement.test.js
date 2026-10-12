// Paiement en ligne (adaptateur Kadev Pay). L'API Kadev est simulée (globalThis.fetch).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { viderBase, acheteur, query, closePool } from './helpers.js';

process.env.PAIEMENT_FOURNISSEUR = 'kadev';
process.env.KADEV_PUBLIC_KEY = 'kdvp_test_abc';
process.env.KADEV_SECRET_KEY = 'kdvs_test_xyz';
process.env.KADEV_WEBHOOK_SECRET = 'whsec_test_1234567890';
process.env.KADEV_BASE_URL = 'https://kadev.test';

const B = await import('../api/_lib/billetterie.js');
const { creerServeur } = await import('../scripts/dev-server.js');

const signer = body => createHmac('sha512', process.env.KADEV_WEBHOOK_SECRET).update(body).digest('hex');

// Simule l'API Kadev de vérification ; les autres appels (serveur de test local) passent.
const vraiFetch = globalThis.fetch;
let verifTxn = null; // { status, amount, reference }
before(() => {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith('https://kadev.test/api/v1/transactions/verify/')) {
      assert.match(opts.headers.Authorization, /^Bearer kdvs_test_/);
      if (!verifTxn) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify({ data: verifTxn }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return vraiFetch(url, opts);
  };
});
after(() => { globalThis.fetch = vraiFetch; });

let serveur, base;
before(async () => {
  serveur = creerServeur();
  await new Promise(r => serveur.listen(0, r));
  base = `http://localhost:${serveur.address().port}`;
});
after(async () => { serveur.close(); await closePool(); });
beforeEach(() => { verifTxn = null; return viderBase(); });

const webhook = (body, sig) => fetch(`${base}/api/paiement/kadev`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-KadevPay-Signature': sig ?? signer(body) },
  body,
});
const evt = (ref, extra = {}) => JSON.stringify({
  event: 'payment.success',
  data: { reference: 'KDV-TX-001', status: 'success', amount: 6000, metadata: { ref }, ...extra },
});

test('config publique : actif, clé publique, pas de secret', async () => {
  const d = await (await fetch(`${base}/api/paiement/config`)).json();
  assert.equal(d.actif, true);
  assert.equal(d.public_key, 'kdvp_test_abc');
  assert.equal(d.test, true);
  assert.ok(!JSON.stringify(d).includes('kdvs_'));
});

test('webhook valide → billet émis', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'success', amount: 6000, reference: 'KDV-TX-001' };
  const r = await webhook(evt(commande.ref));
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.ok, true);
  assert.equal(d.billet, 'S001');
  const { rows: [c] } = await query('SELECT statut, paiement_ref FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.statut, 'payee');
  assert.equal(c.paiement_ref, 'KDV-TX-001');
  const s = await (await fetch(`${base}/api/commande?ref=${commande.ref}`)).json();
  assert.equal(s.statut, 'payee');
  assert.ok(s.billet_code);
});

test('signature invalide → 401, aucun billet', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'success', amount: 6000 };
  const r = await webhook(evt(commande.ref), 'mauvaise-signature');
  assert.equal(r.status, 401);
  const { rows: [c] } = await query('SELECT statut FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.statut, 'en_attente');
});

test('signature OK mais transaction non confirmée côté Kadev → 409, aucun billet', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'pending', amount: 6000 };
  const r = await webhook(evt(commande.ref));
  assert.equal(r.status, 409);
  const { rows: [c] } = await query('SELECT statut FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.statut, 'en_attente');
});

test('montant payé insuffisant → 409 + trace, aucun billet', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' })); // 10 000 F
  verifTxn = { status: 'success', amount: 6000, reference: 'KDV-TX-001' };
  const r = await webhook(evt(commande.ref, { amount: 6000 }));
  assert.equal(r.status, 409);
  const { rows: [c] } = await query('SELECT statut FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.statut, 'en_attente');
  const { rows } = await query("SELECT 1 FROM journal WHERE action = 'paiement_montant_insuffisant'");
  assert.equal(rows.length, 1);
});

test('rejeu du même webhook → idempotent (un seul billet)', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'success', amount: 6000, reference: 'KDV-TX-001' };
  const body = evt(commande.ref);
  await webhook(body);
  const r2 = await webhook(body);
  assert.equal(r2.status, 200);
  assert.equal((await r2.json()).deja, true);
  const { rows } = await query('SELECT count(*)::int AS n FROM billets');
  assert.equal(rows[0].n, 1);
});

test('événement non-succès → 200 ignoré, aucun billet', async () => {
  const { commande } = await B.creerCommande(acheteur());
  const body = JSON.stringify({ event: 'payment.failed', data: { reference: 'KDV-TX-009', status: 'failed', metadata: { ref: commande.ref } } });
  const r = await webhook(body);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).ignore);
  const { rows } = await query('SELECT count(*)::int AS n FROM billets');
  assert.equal(rows[0].n, 0);
});

test('page de retour et endpoint statut servis', async () => {
  assert.equal((await fetch(`${base}/paiement-retour?ref=BC-XXXXXX`)).status, 200);
  assert.equal((await fetch(`${base}/api/commande?ref=BC-INCONNU`)).status, 404);
});
