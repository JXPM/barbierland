import { qrDuBillet } from './_lib/billetterie.js';
import { handler, params, send, HttpError } from './_lib/http.js';

// Image du QR d'un billet attribué : /api/qr?code=… (PNG extrait du PDF des tickets de l'équipe).
export default handler(['GET'], async (req, res) => {
  const b = await qrDuBillet(params(req).get('code'));
  if (!b || !b.qr_png) throw new HttpError(404, 'introuvable', 'Billet introuvable.');
  send(res, 200, b.qr_png, {
    'Content-Type': 'image/png',
    'Content-Disposition': `inline; filename="babierland-city-${b.numero}.png"`,
  });
});
