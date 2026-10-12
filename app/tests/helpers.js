// Base de test : JAUGE réduite pour tester le « complet ». Chargé avant les modules métier.
process.env.JAUGE = '5';
process.env.ADMIN_KEY ||= 'admin-test-cle-123';
process.env.CONTROLE_KEY ||= 'accueil-test-cle-123';

const { query, closePool } = await import('../api/_lib/db.js');

export async function viderBase() {
  await query('TRUNCATE billets, commandes, abonnes, journal RESTART IDENTITY CASCADE');
  await query('ALTER SEQUENCE seq_billet_solo RESTART; ALTER SEQUENCE seq_billet_duo RESTART');
}

export const acheteur = (extra = {}) => ({
  pass: 'solo', nom: 'Kouassi', prenom: 'Awa', telephone: '07 00 00 00 01', email: 'awa@example.com', cgv: true, ...extra,
});

export { query, closePool };
