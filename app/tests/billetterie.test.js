import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { viderBase, acheteur, codeTest, query, closePool } from './helpers.js';

const B = await import('../api/_lib/billetterie.js');

beforeEach(viderBase);
after(closePool);

test('normalise les numéros ivoiriens en E.164', () => {
  assert.equal(B.normaliserTelephone('07 07 12 34 56'), '+2250707123456');
  assert.equal(B.normaliserTelephone('+225 01.72.02.40.10'), '+2250172024010');
  assert.equal(B.normaliserTelephone('002250501020304'), '+2250501020304');
  assert.equal(B.normaliserTelephone('0807123456'), null);
  assert.equal(B.normaliserTelephone('0707'), null);
});

test('valide les champs et exige le nom de la 2e personne pour un Duo', () => {
  assert.throws(() => B.validerCommande(acheteur({ pass: 'duo' })), e => e.status === 422 && !!e.extra.champs.nom_duo);
  assert.throws(() => B.validerCommande(acheteur({ email: 'pas-un-mail' })), e => !!e.extra.champs.email);
  assert.throws(() => B.validerCommande(acheteur({ pass: 'vip' })), e => !!e.extra.champs.pass);
  assert.equal(B.validerCommande(acheteur({ pass: 'duo', nom_duo: '  Yao  Marc ' })).nom_duo, 'Yao Marc');
});

test('une réservation du site reste en attente, sans billet', async () => {
  const { commande, billet } = await B.creerCommande(acheteur());
  assert.equal(commande.statut, 'en_attente');
  assert.equal(commande.montant, 6000);
  assert.match(commande.ref, /^BC-[A-Z2-9]{6}$/);
  assert.equal(billet, null);
});

test('confirmer attribue le prochain ticket en ligne du registre, et reste idempotent', async () => {
  const solo = (await B.creerCommande(acheteur())).commande;
  const duo = (await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' }))).commande;
  const r1 = await B.confirmerCommande(solo.ref, { vendeur: 'Estelle', operateur: 'Wave' });
  const r2 = await B.confirmerCommande(duo.ref);
  assert.equal(r1.billet.numero, 'S001');
  assert.equal(r2.billet.numero, 'D001');
  assert.equal(r1.billet.code, codeTest('S001')); // le code imprimé du registre, pas un code généré
  assert.equal(r2.billet.code, codeTest('D001'));

  const encore = await B.confirmerCommande(solo.ref);
  assert.equal(encore.deja, true);
  assert.equal(encore.billet.code, r1.billet.code);
  const { rows } = await query('SELECT count(*)::int AS n FROM billets WHERE commande_id IS NOT NULL');
  assert.equal(rows[0].n, 2);
});

test('la vente au guichet est payée et émet le billet tout de suite', async () => {
  const { commande, billet } = await B.creerCommande(
    acheteur({ email: '', operateur: 'Espèces' }), { canal: 'guichet', vendeur: 'Djait' });
  assert.equal(commande.statut, 'payee');
  assert.equal(billet.numero, 'S001');
});

test('la jauge compte un Duo pour 2 et refuse au-delà', async () => {
  // JAUGE = 5 dans les tests
  await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'A' }));
  await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'B' }));
  assert.deepEqual((await B.etatJauge()).restantes, 1);
  await assert.rejects(B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'C' })), e => e.code === 'complet' && /Duo/.test(e.message));
  await B.creerCommande(acheteur());
  await assert.rejects(B.creerCommande(acheteur()), e => e.code === 'complet');
});

test('les réservations expirées libèrent leurs places', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'A' }));
  await query("UPDATE commandes SET cree_le = now() - interval '3 days' WHERE id = $1", [commande.id]);
  assert.equal((await B.etatJauge()).occupees, 0);
  // …mais peut encore être confirmée si la jauge le permet (paiement arrivé en retard)
  const r = await B.confirmerCommande(commande.ref);
  assert.equal(r.billet.numero, 'D001');
});

test('les créations simultanées ne dépassent jamais la jauge', async () => {
  const essais = await Promise.allSettled(Array.from({ length: 12 }, (_, i) => B.creerCommande(acheteur({ nom: `N${i}` }))));
  assert.equal(essais.filter(e => e.status === 'fulfilled').length, 5);
  assert.equal((await B.etatJauge()).occupees, 5);
});

test('annuler invalide le billet', async () => {
  const { commande } = await B.creerCommande(acheteur());
  const { billet } = await B.confirmerCommande(commande.ref);
  await B.annulerCommande(commande.ref, { note: 'remboursé' });
  assert.equal((await B.controlerBillet(billet.code)).resultat, 'annule');
  await assert.rejects(B.confirmerCommande(commande.ref), e => e.code === 'annulee');
  await assert.rejects(B.annulerCommande(commande.ref), e => e.code === 'deja_annulee');
});

test('un billet n’entre qu’une fois, même scanné en même temps à deux portes', async () => {
  const { commande } = await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'Yao' }));
  const { billet } = await B.confirmerCommande(commande.ref);
  const [a, b] = await Promise.all([
    B.controlerBillet(billet.code.toLowerCase(), 'Porte A'),
    B.controlerBillet(billet.code, 'Porte B'),
  ]);
  assert.deepEqual([a.resultat, b.resultat].sort(), ['deja_entre', 'ok']);
  assert.equal((await B.controlerBillet('S999-AAAA-BBBB-CCCC')).resultat, 'inconnu');
  const s = await B.statistiques();
  assert.equal(s.personnes_entrees, 2);
  assert.equal(s.duo, 1);
  assert.equal(s.recette, 10000);
});

test('la recherche admin trouve par nom, téléphone ou numéro de billet', async () => {
  const { commande } = await B.creerCommande(acheteur({ nom: 'Zouedet', telephone: '0505050505' }));
  await B.creerCommande(acheteur({ nom: 'Autre' }));
  await B.confirmerCommande(commande.ref);
  assert.equal((await B.listerCommandes({ q: 'zoue' })).length, 1);
  assert.equal((await B.listerCommandes({ q: '505050505' })).length, 1);
  assert.equal((await B.listerCommandes({ q: 'S001' })).length, 1);
  assert.equal((await B.listerCommandes({ statut: 'en_attente' })).length, 1);
});

test('le stock en ligne est limité aux tickets du registre, par pass', async () => {
  await query("DELETE FROM billets WHERE canal = 'en_ligne' AND pass = 'duo' AND numero <> 'D001'");
  assert.equal((await B.stockEnLigne()).duo.restants, 1);
  await B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'A' }));
  assert.equal((await B.stockEnLigne()).duo.restants, 0);
  await assert.rejects(B.creerCommande(acheteur({ pass: 'duo', nom_duo: 'B' })), e => e.code === 'complet' && /Pass Duo/.test(e.message));
  await B.creerCommande(acheteur()); // le Solo reste ouvert
});

test('un ticket physique entre sans commande ; un ticket en ligne non attribué est refusé', async () => {
  const phys = await B.controlerBillet(codeTest('S101'), 'Porte A');
  assert.equal(phys.resultat, 'ok');
  assert.equal(phys.billet.canal, 'physique');
  assert.equal((await B.controlerBillet(codeTest('S101'))).resultat, 'deja_entre');
  assert.equal((await B.controlerBillet(codeTest('S002'))).resultat, 'non_vendu');
  // réservé mais pas encore payé : toujours refusé
  await B.creerCommande(acheteur());
  assert.equal((await B.controlerBillet(codeTest('S001'))).resultat, 'non_vendu');
  const s = await B.statistiques();
  assert.equal(s.personnes_entrees, 1);
  assert.equal(s.entrees_physiques, 1);
});

test('annuler un ticket physique le fait refuser à l’entrée', async () => {
  await B.annulerBillet('d101');
  assert.equal((await B.controlerBillet(codeTest('D101'))).resultat, 'annule');
  await assert.rejects(B.annulerBillet('D101'), e => e.code === 'deja_annule');
  await assert.rejects(B.annulerBillet('X999'), e => e.code === 'introuvable');
});

test('un ticket en ligne annulé n’est jamais attribué', async () => {
  await B.annulerBillet('S001');
  const { commande } = await B.creerCommande(acheteur());
  assert.equal((await B.confirmerCommande(commande.ref)).billet.numero, 'S002');
});

test('le suivi exige le jeton et ne montre le billet qu’une fois payé', async () => {
  const { commande } = await B.creerCommande(acheteur());
  assert.match(commande.jeton, /^[A-Z2-9]{16}$/);
  await assert.rejects(B.statutCommande(commande.ref, 'MAUVAISJETON1234'), e => e.status === 404);
  await assert.rejects(B.statutCommande(commande.ref, ''), e => e.status === 404);
  const avant = await B.statutCommande(commande.ref, commande.jeton.toLowerCase());
  assert.equal(avant.statut, 'en_attente');
  assert.equal(avant.billet_code, null);
  await B.confirmerCommande(commande.ref);
  const apres = await B.statutCommande(commande.ref, commande.jeton);
  assert.equal(apres.billet_code, codeTest('S001'));
  assert.equal(apres.billet_numero, 'S001');
});
