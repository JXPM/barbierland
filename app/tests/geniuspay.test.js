// Paiement GeniusPay (flux redirection). L'API GeniusPay est simulée (globalThis.fetch).
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { viderBase, acheteur, query, closePool } from './helpers.js';

process.env.PAIEMENT_FOURNISSEUR = 'geniuspay';
process.env.GENIUSPAY_API_KEY = 'pk_sandbox_abc';
process.env.GENIUSPAY_API_SECRET = 'sk_sandbox_xyz';
process.env.GENIUSPAY_WEBHOOK_SECRET = 'whsec_sandbox_1234567890';
process.env.GENIUSPAY_BASE_URL = 'https://genius.test';

const B = await import('../api/_lib/billetterie.js');
const { creerServeur } = await import('../scripts/dev-server.js');

// --- API GeniusPay simulée ---
const vraiFetch = globalThis.fetch;
let creeReponse = null; // { checkout_url, reference }
let verifTxn = null;    // { status, amount, reference }
let dernierCreate = null;
before(() => {
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u === 'https://genius.test/api/v1/merchant/payments' && opts.method === 'POST') {
      assert.equal(opts.headers['X-API-Key'], 'pk_sandbox_abc');
      assert.equal(opts.headers['X-API-Secret'], 'sk_sandbox_xyz');
      dernierCreate = JSON.parse(opts.body);
      return new Response(JSON.stringify({ data: creeReponse }), { status: 201, headers: { 'content-type': 'application/json' } });
    }
    if (u.startsWith('https://genius.test/api/v1/merchant/payments/')) {
      assert.equal(opts.headers['X-API-Key'], 'pk_sandbox_abc');
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
beforeEach(() => { creeReponse = verifTxn = dernierCreate = null; return viderBase(); });

const signer = (ts, body) => createHmac('sha256', process.env.GENIUSPAY_WEBHOOK_SECRET).update(`${ts}.${body}`).digest('hex');
function webhook(body, { ts = Math.floor(Date.now() / 1000), sig, event = 'payment.success' } = {}) {
  return fetch(`${base}/api/paiement/geniuspay`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Timestamp': String(ts),
      'X-Webhook-Event': event,
      'X-Webhook-Signature': sig ?? signer(ts, body),
    },
    body,
  });
}
const evt = (ref, extra = {}) => JSON.stringify({
  event: 'payment.success',
  data: { reference: 'MTX-1', status: 'completed', amount: 6000, metadata: { ref }, ...extra },
});

test('config publique : mode redirection, aucune clé secrète', async () => {
  const d = await (await fetch(`${base}/api/paiement/config`)).json();
  assert.deepEqual(d, { actif: true, fournisseur: 'GeniusPay', mode: 'redirect', test: true });
  assert.ok(!JSON.stringify(d).includes('sk_'));
});

test('initier : crée la transaction et renvoie l’URL de checkout', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' }));
  creeReponse = { checkout_url: 'https://genius.test/c/MTX-1', reference: 'MTX-1' };
  const r = await fetch(`${base}/api/paiement/initier`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: commande.ref }),
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.redirect_url, 'https://genius.test/c/MTX-1');
  assert.equal(dernierCreate.amount, 10000);
  assert.equal(dernierCreate.currency, 'XOF');
  assert.equal(dernierCreate.metadata.ref, commande.ref);
  assert.equal(dernierCreate.customer.country, 'CI');
  assert.ok(dernierCreate.success_url.includes(commande.ref));
});

test('webhook valide → billet émis, statut consultable', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'completed', amount: 6000, reference: 'MTX-1' };
  const r = await webhook(evt(commande.ref));
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.billet, 'S001');
  const s = await (await fetch(`${base}/api/commande?ref=${commande.ref}`)).json();
  assert.equal(s.statut, 'payee');
  assert.ok(s.billet_code);
  const { rows: [c] } = await query('SELECT paiement_ref FROM commandes WHERE ref = $1', [commande.ref]);
  assert.equal(c.paiement_ref, 'MTX-1');
});

test('signature invalide → 401, aucun billet', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'completed', amount: 6000 };
  const r = await webhook(evt(commande.ref), { sig: 'deadbeef' });
  assert.equal(r.status, 401);
  assert.equal((await query('SELECT statut FROM commandes WHERE ref=$1', [commande.ref])).rows[0].statut, 'en_attente');
});

test('horodatage hors fenêtre (rejeu) → 401', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'completed', amount: 6000 };
  const vieux = Math.floor(Date.now() / 1000) - 3600;
  const body = evt(commande.ref);
  const r = await webhook(body, { ts: vieux, sig: signer(vieux, body) });
  assert.equal(r.status, 401);
});

test('transaction non confirmée côté GeniusPay → 409', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'pending', amount: 6000 };
  const r = await webhook(evt(commande.ref));
  assert.equal(r.status, 409);
  assert.equal((await query('SELECT statut FROM commandes WHERE ref=$1', [commande.ref])).rows[0].statut, 'en_attente');
});

test('montant insuffisant → 409 + trace', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' })); // 10 000
  verifTxn = { status: 'completed', amount: 6000, reference: 'MTX-1' };
  const r = await webhook(evt(commande.ref, { amount: 6000 }));
  assert.equal(r.status, 409);
  assert.equal((await query("SELECT count(*)::int n FROM journal WHERE action='paiement_montant_insuffisant'")).rows[0].n, 1);
});

test('rejeu du webhook → idempotent (un seul billet)', async () => {
  const { commande } = await B.creerCommande(acheteur());
  verifTxn = { status: 'completed', amount: 6000, reference: 'MTX-1' };
  const body = evt(commande.ref);
  const ts = Math.floor(Date.now() / 1000); const sig = signer(ts, body);
  await webhook(body, { ts, sig });
  const r2 = await webhook(body, { ts, sig });
  assert.equal((await r2.json()).deja, true);
  assert.equal((await query('SELECT count(*)::int n FROM billets')).rows[0].n, 1);
});

test('paiement d’un autre projet (réf. hors BC-) → 200 ignoré, aucun billet', async () => {
  verifTxn = { reference: 'MTX-7', status: 'completed', amount: 6000 };
  for (const meta of [{ ref: 'KAW-123' }, {}]) {
    const body = JSON.stringify({ event: 'payment.success', data: { reference: 'MTX-7', status: 'completed', amount: 6000, metadata: meta } });
    const r = await webhook(body);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).ignore, 'hors_babierland');
  }
  assert.equal((await query('SELECT count(*)::int n FROM billets')).rows[0].n, 0);
});

test('événement non-succès → 200 ignoré', async () => {
  const { commande } = await B.creerCommande(acheteur());
  const body = JSON.stringify({ event: 'payment.failed', data: { reference: 'MTX-9', status: 'failed', metadata: { ref: commande.ref } } });
  const r = await webhook(body, { event: 'payment.failed' });
  assert.equal(r.status, 200);
  assert.ok((await r.json()).ignore);
  assert.equal((await query('SELECT count(*)::int n FROM billets')).rows[0].n, 0);
});
