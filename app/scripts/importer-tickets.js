// Charge les 500 tickets du PDF de l'équipe (BABIERLAND_QR_codes_tickets.pdf : 1 page = 1 QR + son n°)
// dans la table billets. Idempotent : peut être relancé.
//   S001-S100 et D001-D100 → canal 'en_ligne' (attribués aux réservations du site), image du QR stockée ;
//   le reste             → canal 'physique' (vendus en main propre, acceptés au contrôle).
//
// Usage : DATABASE_URL=… node scripts/importer-tickets.js <chemin du PDF> [--essai]
//   --essai : vérifie tout (décodage, concordance n°/code, conflits en base) sans rien écrire.
// Prérequis : poppler-utils (pdftoppm, pdftotext). Ne jamais afficher ni committer les codes.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { closePool, tx } from '../api/_lib/db.js';

const EN_LIGNE_MAX = 100; // n° ≤ 100 : vendus sur le site
const [pdf, ...options] = process.argv.slice(2);
const essai = options.includes('--essai');
if (!pdf) {
  console.error('Usage : node scripts/importer-tickets.js <PDF> [--essai]');
  process.exit(1);
}

// Code secret encodé dans le QR : https://…#v=<code> (ou le code brut).
const codeDuQr = data => {
  const m = String(data).match(/[#?&]v=([^&#\s]+)/);
  return decodeURIComponent(m ? m[1] : data).trim().toUpperCase();
};

// Découpe le QR (avec sa marge blanche) dans la page rendue.
function decouperQr(png, loc) {
  const pts = [loc.topLeftCorner, loc.topRightCorner, loc.bottomLeftCorner, loc.bottomRightCorner];
  const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x));
  const y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  const marge = Math.round((x1 - x0) * 0.08);
  const left = Math.max(0, Math.floor(x0 - marge)), top = Math.max(0, Math.floor(y0 - marge));
  const w = Math.min(png.width - left, Math.ceil(x1 - x0 + 2 * marge));
  const h = Math.min(png.height - top, Math.ceil(y1 - y0 + 2 * marge));
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, left, top, w, h, 0, 0);
  return PNG.sync.write(out, { colorType: 0 });
}

// Compteur sur une seule ligne (stderr), pour voir que le script avance.
const progression = (etape, n, total) => {
  process.stderr.write(`\r${etape} : ${n}/${total}`);
  if (n === total) process.stderr.write('\n');
};

const dossier = mkdtempSync(join(tmpdir(), 'tickets-'));
try {
  console.error('Conversion du PDF en images…');
  execFileSync('pdftoppm', ['-r', '150', '-gray', '-png', pdf, join(dossier, 'p')]);
  const pages = readdirSync(dossier).filter(f => f.endsWith('.png')).sort();
  const tickets = [];
  const erreurs = [];
  pages.forEach((f, i) => {
    progression('Lecture des QR', i + 1, pages.length);
    const numero = execFileSync('pdftotext', ['-f', String(i + 1), '-l', String(i + 1), pdf, '-']).toString().trim();
    if (!/^[SD]\d{3}$/.test(numero)) return erreurs.push(`page ${i + 1} : n° illisible`);
    const png = PNG.sync.read(readFileSync(join(dossier, f)));
    const qr = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (!qr) return erreurs.push(`${numero} : QR illisible`);
    const code = codeDuQr(qr.data);
    if (!code.startsWith(`${numero}-`)) return erreurs.push(`${numero} : le QR ne correspond pas au n° de la page`);
    const enLigne = Number(numero.slice(1)) <= EN_LIGNE_MAX;
    tickets.push({
      numero, code,
      pass: numero.startsWith('S') ? 'solo' : 'duo',
      canal: enLigne ? 'en_ligne' : 'physique',
      qr_png: enLigne ? decouperQr(png, qr.location) : null,
    });
  });
  if (new Set(tickets.map(t => t.numero)).size !== tickets.length) erreurs.push('n° en double dans le PDF');
  if (erreurs.length) throw new Error(`PDF refusé :\n- ${erreurs.join('\n- ')}`);

  const bilan = await tx(async client => {
    // Garde-fou : un n° déjà en base avec un AUTRE code (ancien billet généré) bloque tout.
    const { rows: existants } = await client.query(
      'SELECT numero, code, commande_id FROM billets WHERE numero = ANY($1)', [tickets.map(t => t.numero)]);
    const parNumero = new Map(existants.map(b => [b.numero, b]));
    const conflits = tickets.filter(t => parNumero.has(t.numero) && parNumero.get(t.numero).code !== t.code);
    if (conflits.length) {
      throw new Error(`Conflit : ${conflits.length} n° existent déjà en base avec un autre code `
        + `(${conflits.slice(0, 10).map(t => t.numero).join(', ')}…). Rien n'a été importé.`);
    }
    let ajoutes = 0, maj = 0;
    for (const [i, t] of tickets.entries()) {
      progression('Écriture en base', i + 1, tickets.length);
      if (parNumero.has(t.numero)) {
        await client.query('UPDATE billets SET pass = $2, canal = $3, qr_png = $4 WHERE numero = $1',
          [t.numero, t.pass, t.canal, t.qr_png]);
        maj++;
      } else {
        await client.query('INSERT INTO billets (numero, code, pass, canal, qr_png) VALUES ($1,$2,$3,$4,$5)',
          [t.numero, t.code, t.pass, t.canal, t.qr_png]);
        ajoutes++;
      }
    }
    if (essai) throw Object.assign(new Error('essai'), { bilan: { ajoutes, maj } });
    return { ajoutes, maj };
  }).catch(err => {
    if (err.message === 'essai') return { ...err.bilan, essai: true };
    throw err;
  });

  const compte = (canal, pass) => tickets.filter(t => t.canal === canal && t.pass === pass).length;
  console.log(`${tickets.length} tickets lus et vérifiés (QR décodé = n° de la page).`);
  console.log(`En ligne : ${compte('en_ligne', 'solo')} Solo + ${compte('en_ligne', 'duo')} Duo (image du QR stockée)`);
  console.log(`Physiques : ${compte('physique', 'solo')} Solo + ${compte('physique', 'duo')} Duo`);
  console.log(bilan.essai
    ? `ESSAI : ${bilan.ajoutes} seraient ajoutés, ${bilan.maj} mis à jour. Rien n'a été écrit.`
    : `Base : ${bilan.ajoutes} ajoutés, ${bilan.maj} mis à jour.`);
} finally {
  rmSync(dossier, { recursive: true, force: true });
  await closePool();
}
