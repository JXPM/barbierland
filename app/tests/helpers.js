// Base de test : JAUGE réduite pour tester le « complet ». Chargé avant les modules métier.
process.env.JAUGE = '5';
process.env.ADMIN_KEY ||= 'admin-test-cle-123';
process.env.CONTROLE_KEY ||= 'accueil-test-cle-123';

const { query, closePool } = await import('../api/_lib/db.js');

// Petit registre de tickets fictifs (jamais les vrais codes) : 6 Solo + 4 Duo en ligne, 1 Solo + 1 Duo physiques.
const { PNG } = await import('pngjs');
export const QR_TEST = PNG.sync.write(new PNG({ width: 4, height: 4 }));
export const codeTest = numero => `${numero}-TEST-CODE-${numero.slice(1)}X`;
export const TICKETS_TEST = [
  ...['S001', 'S002', 'S003', 'S004', 'S005', 'S006'].map(n => [n, 'solo', 'en_ligne']),
  ...['D001', 'D002', 'D003', 'D004'].map(n => [n, 'duo', 'en_ligne']),
  ['S101', 'solo', 'physique'], ['D101', 'duo', 'physique'],
];

export async function viderBase() {
  await query('TRUNCATE billets, commandes, abonnes, journal RESTART IDENTITY CASCADE');
  for (const [numero, pass, canal] of TICKETS_TEST) {
    await query('INSERT INTO billets (numero, code, pass, canal, qr_png) VALUES ($1,$2,$3,$4,$5)',
      [numero, codeTest(numero), pass, canal, canal === 'en_ligne' ? QR_TEST : null]);
  }
}

export const acheteur = (extra = {}) => ({
  pass: 'solo', nom: 'Kouassi', prenom: 'Awa', telephone: '07 00 00 00 01', email: 'awa@example.com', cgv: true, ...extra,
});

export { query, closePool };
