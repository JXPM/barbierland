import { statutCommande } from './_lib/billetterie.js';
import { handler, params, send, HttpError } from './_lib/http.js';

// Public : suivi d'une réservation (/reservation, interrogée en boucle).
// Il faut la réf. ET le jeton du lien de suivi ; le lien du billet n'est renvoyé qu'une fois payé.
export default handler(['GET'], async (req, res) => {
  const q = params(req);
  if (!q.get('ref')) throw new HttpError(422, 'ref', 'Référence manquante.');
  send(res, 200, await statutCommande(q.get('ref'), q.get('j')));
});
