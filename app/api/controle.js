import { controlerBillet, journaliser, statistiques } from './_lib/billetterie.js';
import { exigerCle, handler, readJson, send, HttpError } from './_lib/http.js';

// Accepte le code brut ou l'URL lue dans le QR : tickets du registre (…#v=<code>) ou liens /t/<code>.
export function extraireCode(lu) {
  const s = String(lu ?? '').trim();
  const m = s.match(/[#?&]v=([^&#\s]+)/) || s.match(/\/t\/([^/?#\s]+)/);
  let code = m ? m[1] : s;
  try { code = decodeURIComponent(code); } catch { /* code brut */ }
  return code.trim().toUpperCase();
}

// Équipe d'accueil (code CONTROLE_KEY).
// GET : vérifie le code et renvoie le compteur d'entrées. POST { code, poste } : valide une entrée.
export default handler(['GET', 'POST'], async (req, res) => {
  exigerCle(req, 'CONTROLE_KEY');
  if (req.method === 'GET') {
    const s = await statistiques();
    return send(res, 200, { personnes_entrees: s.personnes_entrees, entrees_physiques: s.entrees_physiques });
  }
  const body = await readJson(req);
  const code = extraireCode(body.code);
  if (!code) throw new HttpError(422, 'code_vide', 'Aucun code lu.');
  const r = await controlerBillet(code, body.poste);
  const b = r.billet;
  await journaliser(body.poste || 'Entrée', 'scan', b ? b.numero : null, { resultat: r.resultat });
  send(res, 200, {
    resultat: r.resultat,
    billet: b && {
      numero: b.numero,
      canal: b.canal,
      pass: b.pass,
      personnes: b.pass === 'duo' ? 2 : 1,
      titulaire: b.commande_id ? `${b.prenom} ${b.nom}`.trim() : null,
      nom_duo: b.nom_duo,
      entre_le: b.entre_le,
      entre_par: b.entre_par,
    },
  });
});
