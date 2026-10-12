import { trouverBillet } from './_lib/billetterie.js';
import { handler, params, send, urlPublique, HttpError } from './_lib/http.js';
import { lienBillet, qrPng, qrSvg } from './_lib/qr.js';

// Image du QR d'un billet existant : /api/qr?code=…&format=png|svg (png par défaut).
export default handler(['GET'], async (req, res) => {
  const q = params(req);
  const billet = await trouverBillet(q.get('code'));
  if (!billet) throw new HttpError(404, 'introuvable', 'Billet introuvable.');
  const lien = lienBillet(urlPublique(req), billet.code);
  const nom = `babierland-city-${billet.numero}`;
  if (q.get('format') === 'svg') {
    return send(res, 200, await qrSvg(lien), { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `inline; filename="${nom}.svg"` });
  }
  send(res, 200, await qrPng(lien), { 'Content-Type': 'image/png', 'Content-Disposition': `inline; filename="${nom}.png"` });
});
