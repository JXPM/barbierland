import { createHash, timingSafeEqual } from 'node:crypto';
import { journaliser, purger } from '../_lib/billetterie.js';
import { handler, send, HttpError } from '../_lib/http.js';

const digest = s => createHash('sha256').update(String(s)).digest();

// Appelé chaque jour par le cron Vercel (vercel.json) avec « Authorization: Bearer <CRON_SECRET> ».
// Applique les durées de conservation annoncées dans la politique de confidentialité.
export default handler(['GET'], async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) throw new HttpError(503, 'non_configure', 'CRON_SECRET n’est pas configurée.');
  if (!timingSafeEqual(digest(req.headers.authorization || ''), digest(`Bearer ${secret}`))) {
    throw new HttpError(401, 'cle_invalide', 'Accès refusé.');
  }
  const r = await purger();
  await journaliser('cron', 'purge', null, r);
  send(res, 200, r);
});
