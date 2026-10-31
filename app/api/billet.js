import { trouverBilletAttribue } from './_lib/billetterie.js';
import { handler, params, send, urlPublique, HttpError } from './_lib/http.js';

// Public (avec le code secret) : affiche le billet sur /t/<code>.
// Le QR est l'image imprimée du registre de l'équipe (servie par /api/qr), pas un QR généré.
export default handler(['GET'], async (req, res) => {
  const billet = await trouverBilletAttribue(params(req).get('code'));
  if (!billet) throw new HttpError(404, 'introuvable', 'Ce billet n’existe pas. Vérifie le lien reçu.');
  send(res, 200, {
    numero: billet.numero,
    code: billet.code,
    pass: billet.pass,
    titulaire: `${billet.prenom} ${billet.nom}`.trim(),
    nom_duo: billet.nom_duo,
    statut: billet.commande_statut === 'annulee' ? 'annule' : billet.statut,
    entre_le: billet.entre_le,
    lien: `${urlPublique(req)}/t/${encodeURIComponent(billet.code)}`,
    qr_url: `/api/qr?code=${encodeURIComponent(billet.code)}`,
  });
});
