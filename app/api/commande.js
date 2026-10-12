import { statutCommande } from './_lib/paiement.js';
import { handler, params, send, HttpError } from './_lib/http.js';

// Public : statut d'une réservation (page de retour après paiement, interrogée en boucle).
// La réf. BC-… n'est connue que de l'acheteur ; on ne renvoie le lien du billet qu'une fois payé.
export default handler(['GET'], async (req, res) => {
  const ref = params(req).get('ref');
  if (!ref) throw new HttpError(422, 'ref', 'Référence manquante.');
  send(res, 200, await statutCommande(ref));
});
