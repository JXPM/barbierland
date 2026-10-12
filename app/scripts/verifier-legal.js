// Liste les mentions légales encore « À COMPLÉTER / À VALIDER » dans les pages publiques.
// À lancer avant la mise en ligne : npm run verifier-legal (code de sortie 1 s'il en reste).
import { readdir, readFile } from 'node:fs/promises';

const dossier = new URL('../public/', import.meta.url);
let total = 0;
for (const nom of (await readdir(dossier)).filter(f => f.endsWith('.html')).sort()) {
  const html = await readFile(new URL(nom, dossier), 'utf8');
  const trous = [...html.matchAll(/<mark class="todo">(.*?)<\/mark>/gs)].map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' '));
  if (!trous.length) continue;
  total += trous.length;
  console.log(`\n${nom} (${trous.length})`);
  for (const t of trous) console.log(`  - ${t}`);
}
console.log(total ? `\n${total} point(s) à compléter avant la mise en ligne.` : 'Aucun point en attente.');
process.exitCode = total ? 1 : 0;
