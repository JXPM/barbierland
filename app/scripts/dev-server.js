// Serveur local qui imite Vercel : fichiers de public/, fonctions api/*.js, réécriture /t/:code.
// Usage : npm run dev  (lit .env)
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = fileURLToPath(new URL('..', import.meta.url));
// Mêmes en-têtes de sécurité qu'en production (règle « /(.*) » de vercel.json).
const vercel = JSON.parse(await readFile(join(racine, 'vercel.json'), 'utf8'));
const ENTETES = (vercel.headers.find(h => h.source === '/(.*)') || { headers: [] }).headers;
const publicDir = join(racine, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
};

async function fichier(chemin) {
  try {
    return (await stat(chemin)).isFile() ? chemin : null;
  } catch {
    return null;
  }
}

export function creerServeur() {
  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    for (const { key, value } of ENTETES) if (key !== 'Strict-Transport-Security') res.setHeader(key, value);
    try {
      if (pathname.startsWith('/api/')) {
        const nom = normalize(pathname.slice(5)).replace(/^(\.\.[/\\])+/, '');
        if (nom.split('/').some(p => p.startsWith('_'))) throw Object.assign(new Error(), { code: 'ENOENT' });
        req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
        let file = join(racine, 'api', `${nom}.js`);
        if (!(await fichier(file))) {
          // route dynamique : api/<dir>/[param].js  (comme Vercel)
          const dir = join(racine, 'api', dirname(nom));
          const dyn = (await readdir(dir).catch(() => [])).find(f => /^\[.+\]\.js$/.test(f));
          if (dyn) { file = join(dir, dyn); req.query[dyn.slice(1, -4).replace(/^\.\.\./, '')] = basename(nom); }
        }
        if (!(await fichier(file))) throw Object.assign(new Error(), { code: 'ENOENT' });
        const mod = await import(pathToFileURL(file).href);
        return await mod.default(req, res);
      }
      let chemin = pathname.startsWith('/t/') ? '/billet.html' : decodeURIComponent(pathname);
      if (chemin.endsWith('/')) chemin += 'index.html';
      const base = join(publicDir, normalize(chemin));
      if (!base.startsWith(publicDir)) throw Object.assign(new Error(), { code: 'ENOENT' });
      const trouve = (await fichier(base)) || (await fichier(`${base}.html`)); // cleanUrls
      if (!trouve) throw Object.assign(new Error(), { code: 'ENOENT' });
      res.setHeader('Content-Type', TYPES[extname(trouve)] || 'application/octet-stream');
      res.end(await readFile(trouve));
    } catch (err) {
      if (err.code !== 'ENOENT' && err.code !== 'ERR_MODULE_NOT_FOUND') console.error(err);
      res.statusCode = 404;
      res.end('Introuvable');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  creerServeur().listen(port, () => console.log(`Babierland City → http://localhost:${port}`));
}
