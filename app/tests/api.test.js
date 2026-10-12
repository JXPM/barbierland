import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { viderBase, acheteur, closePool } from './helpers.js';

const { creerServeur } = await import('../scripts/dev-server.js');
const { extraireCode } = await import('../api/controle.js');

let serveur, base;
before(async () => {
  delete process.env.PUBLIC_URL; // les liens doivent pointer sur ce serveur de test
  serveur = creerServeur();
  await new Promise(r => serveur.listen(0, r));
  base = `http://localhost:${serveur.address().port}`;
});
after(async () => {
  serveur.close();
  await closePool();
});
beforeEach(viderBase);

const ADMIN = { 'x-cle': process.env.ADMIN_KEY };
const ACCUEIL = { 'x-cle': process.env.CONTROLE_KEY };
const appel = async (chemin, { body, headers = {} } = {}) => {
  const r = await fetch(base + chemin, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body && JSON.stringify(body),
  });
  const type = r.headers.get('content-type') || '';
  return { status: r.status, type, data: type.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
};

test('extraireCode accepte l’URL du QR ou le code brut', () => {
  assert.equal(extraireCode('https://babierlandcity.com/t/S001-ABCD-EFGH-JKLM'), 'S001-ABCD-EFGH-JKLM');
  assert.equal(extraireCode(' s001-abcd-efgh-jklm '), 'S001-ABCD-EFGH-JKLM');
});

test('parcours complet : réservation → confirmation admin → billet + QR → entrée', async () => {
  assert.equal((await appel('/api/stock')).data.restantes, 5);

  const resa = await appel('/api/commandes', { body: { ...acheteur({ pass: 'duo', nom_duo: 'Yao Marc' }), operateur: 'Wave' } });
  assert.equal(resa.status, 201);
  assert.match(resa.data.whatsapp, /^https:\/\/wa\.me\/2250172024010\?text=/);
  assert.ok(decodeURIComponent(resa.data.whatsapp).includes(resa.data.ref));
  assert.equal((await appel('/api/stock')).data.restantes, 3);

  assert.equal((await appel('/api/admin/commandes')).status, 401);
  const conf = await appel('/api/admin/commandes', { headers: ADMIN, body: { action: 'confirmer', ref: resa.data.ref, vendeur: 'Estelle' } });
  assert.equal(conf.status, 200);
  const code = conf.data.billet.code;

  const billet = await appel(`/api/billet?code=${code}`);
  assert.equal(billet.data.numero, 'D001');
  assert.equal(billet.data.titulaire, 'Awa Kouassi');
  assert.equal(billet.data.lien, `${base}/t/${code}`);
  assert.match(billet.data.qr_svg, /^<svg/);

  const png = await appel(`/api/qr?code=${code}`);
  assert.equal(png.type, 'image/png');
  assert.equal(png.data.subarray(1, 4).toString(), 'PNG');

  const page = await fetch(`${base}/t/${code}`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>/);

  assert.equal((await appel('/api/controle', { body: { code } })).status, 401);
  const e1 = await appel('/api/controle', { headers: ACCUEIL, body: { code: billet.data.lien, poste: 'Porte 1' } });
  assert.equal(e1.data.resultat, 'ok');
  assert.equal(e1.data.billet.personnes, 2);
  const e2 = await appel('/api/controle', { headers: ACCUEIL, body: { code } });
  assert.equal(e2.data.resultat, 'deja_entre');
  assert.equal(e2.data.billet.entre_par, 'Porte 1');

  const liste = await appel('/api/admin/commandes', { headers: ADMIN });
  assert.equal(liste.data.stats.personnes_entrees, 2);
  assert.equal(liste.data.commandes[0].numero, 'D001');

  const csv = (await appel('/api/admin/export', { headers: ADMIN })).data.toString('utf8');
  assert.ok(csv.startsWith('﻿N°;Type;Code secret'));
  assert.match(csv, /D001;Duo;/);
});

test('erreurs de validation renvoyées champ par champ', async () => {
  const r = await appel('/api/commandes', { body: { pass: 'solo', nom: '', telephone: '12' } });
  assert.equal(r.status, 422);
  assert.ok(r.data.champs.nom && r.data.champs.telephone && r.data.champs.email && r.data.champs.cgv);
});

test('vente au guichet depuis l’admin', async () => {
  const sans = await appel('/api/admin/commandes', { headers: ADMIN, body: { action: 'vendre', ...acheteur() } });
  assert.equal(sans.status, 422);
  const r = await appel('/api/admin/commandes', {
    headers: ADMIN, body: { action: 'vendre', ...acheteur({ email: '' }), operateur: 'Espèces', vendeur: 'Djait' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.billet.numero, 'S001');
});

test('les modules internes et les fichiers hors public/ ne sont pas servis', async () => {
  assert.equal((await fetch(`${base}/api/_lib/db`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/.env`)).status, 404);
  assert.equal((await fetch(`${base}/api/inexistant`)).status, 404);
});
