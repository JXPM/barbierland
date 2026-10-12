import { configClient, initierPaiement, traiterWebhook } from '../_lib/paiement.js';
import { readJson, readRaw, send, urlPublique, HttpError } from '../_lib/http.js';

// Route unique pour tout le paiement (une seule fonction serverless) :
//   GET  /api/paiement/config      → état du paiement pour le navigateur
//   POST /api/paiement/initier     → crée la transaction, renvoie { redirect_url }
//   POST /api/paiement/geniuspay   → webhook GeniusPay (corps brut, signature HMAC-SHA256)
//   POST /api/paiement/kadev       → webhook Kadev (secours, HMAC-SHA512)
export const config = { api: { bodyParser: false } };

const refusMethode = (res, allow) => send(res, 405, { erreur: 'methode', message: 'Méthode non autorisée.' }, { Allow: allow });
// L'opération vient du segment dynamique (Vercel : req.query.op ; dev-server : idem).
const operation = req => (req.query && req.query.op) || new URL(req.url, 'http://localhost').pathname.split('/').pop();

export default async function (req, res) {
  const op = operation(req);
  try {
    if (op === 'config') {
      if (req.method !== 'GET') return refusMethode(res, 'GET');
      return send(res, 200, configClient());
    }
    if (op === 'initier') {
      if (req.method !== 'POST') return refusMethode(res, 'POST');
      const { ref } = await readJson(req);
      if (!ref) throw new HttpError(422, 'ref', 'Référence manquante.');
      const retour = `${urlPublique(req)}/paiement-retour?ref=${encodeURIComponent(String(ref).toUpperCase())}`;
      return send(res, 200, await initierPaiement(ref, { successUrl: retour, errorUrl: retour }));
    }
    if (op === 'geniuspay' || op === 'kadev') {
      if (req.method !== 'POST') return refusMethode(res, 'POST');
      return send(res, 200, await traiterWebhook(op, await readRaw(req), req.headers));
    }
    return send(res, 404, { erreur: 'inconnu', message: 'Ressource introuvable.' });
  } catch (err) {
    if (err instanceof HttpError) return send(res, err.status, { erreur: err.code, message: err.message, ...err.extra });
    console.error(err);
    return send(res, 500, { erreur: 'serveur', message: 'Erreur serveur.' });
  }
}
