import { creerCommande } from './_lib/billetterie.js';
import { PASS, WHATSAPP_OFFICIEL, formatFcfa } from './_lib/config.js';
import { handler, readJson, send, HttpError } from './_lib/http.js';

// Public : réservation depuis le site. Le billet est émis quand le paiement est confirmé
// (aujourd'hui par l'équipe dans /admin, plus tard par le webhook de la passerelle).
export default handler(['POST'], async (req, res) => {
  const body = await readJson(req);
  if (body.site_web) throw new HttpError(400, 'refuse', 'Requête refusée.'); // pot de miel anti-robots

  const { commande } = await creerCommande({
    pass: body.pass,
    nom: body.nom,
    prenom: body.prenom,
    telephone: body.telephone,
    email: body.email,
    nom_duo: body.nom_duo,
    operateur: body.operateur,
    cgv: body.cgv,
    mineur: body.mineur,
    autorisation_parentale: body.autorisation_parentale,
    optin_infos: body.optin_infos,
  });

  const p = PASS[commande.pass];
  const message = [
    `Bonjour Babierland City ! Je confirme ma réservation ${commande.ref}.`,
    `${p.label} (${p.personnes} pers.) · ${formatFcfa(commande.montant)}`,
    `Nom : ${commande.prenom} ${commande.nom}${commande.nom_duo ? ` + ${commande.nom_duo}` : ''}`,
    commande.operateur ? `Paiement : ${commande.operateur}` : null,
  ].filter(Boolean).join('\n');

  send(res, 201, {
    ref: commande.ref,
    pass: commande.pass,
    montant: commande.montant,
    cgv_version: commande.cgv_version,
    whatsapp: `https://wa.me/${WHATSAPP_OFFICIEL}?text=${encodeURIComponent(message)}`,
  });
});
