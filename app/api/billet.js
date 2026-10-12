import { trouverBillet } from './_lib/billetterie.js';
import { handler, params, send, urlPublique, HttpError } from './_lib/http.js';
import { lienBillet, qrSvg } from './_lib/qr.js';

// Public (avec le code secret) : affiche le billet et son QR sur /t/<code>.
export default handler(['GET'], async (req, res) => {
  const billet = await trouverBillet(params(req).get('code'));
  if (!billet) throw new HttpError(404, 'introuvable', 'Ce billet n’existe pas. Vérifie le lien reçu.');
  const lien = lienBillet(urlPublique(req), billet.code);
  send(res, 200, {
    numero: billet.numero,
    code: billet.code,
    pass: billet.pass,
    titulaire: `${billet.prenom} ${billet.nom}`,
    nom_duo: billet.nom_duo,
    statut: billet.statut,
    entre_le: billet.entre_le,
    lien,
    qr_svg: await qrSvg(lien),
  });
});
