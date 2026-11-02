import {
  annulerBillet, annulerCommande, anonymiserCommande, confirmerCommande, creerCommande, desabonner, donneesPersonne, journaliser,
  listerCommandes, statistiques,
} from '../_lib/billetterie.js';
import { acteurDe, exigerCle, handler, params, readJson, send, urlPublique, HttpError } from '../_lib/http.js';

// Équipe (code ADMIN_KEY).
// GET ?q=&statut=  → statistiques + commandes
// POST { action: 'confirmer' | 'annuler' | 'annuler_billet' | 'vendre' | 'anonymiser' | 'donnees' | 'desabonner', … }
// En-tête x-acteur : prénom de la personne connectée (journal des opérations).
export default handler(['GET', 'POST'], async (req, res) => {
  exigerCle(req, 'ADMIN_KEY');

  if (req.method === 'GET') {
    const q = params(req);
    const [stats, commandes] = await Promise.all([
      statistiques(),
      listerCommandes({ q: q.get('q') || '', statut: q.get('statut') || '' }),
    ]);
    return send(res, 200, { base: urlPublique(req), stats, commandes });
  }

  const body = await readJson(req);
  const vendeur = String(body.vendeur ?? '').trim().slice(0, 60) || null;
  const acteur = vendeur || acteurDe(req);
  const ref = body.ref ? String(body.ref) : null;
  switch (body.action) {
    case 'confirmer': {
      const r = await confirmerCommande(ref, {
        vendeur, operateur: body.operateur || null, paiementRef: String(body.paiement_ref ?? '').trim().slice(0, 80) || null,
      });
      if (!r.deja) await journaliser(acteur, 'confirmer', ref, { billet: r.billet.numero });
      return send(res, 200, r);
    }
    case 'annuler': {
      const r = await annulerCommande(ref, { note: String(body.note ?? '').trim().slice(0, 200) || null });
      await journaliser(acteur, 'annuler', ref);
      return send(res, 200, r);
    }
    case 'annuler_billet': {
      const r = await annulerBillet(body.numero);
      await journaliser(acteur, 'annuler_billet', r.numero, { canal: r.canal });
      return send(res, 200, r);
    }
    case 'vendre': {
      if (!vendeur) throw new HttpError(422, 'validation', 'Indique qui encaisse.', { champs: { vendeur: 'Indique qui encaisse.' } });
      const r = await creerCommande(body, { canal: 'guichet', vendeur });
      await journaliser(acteur, 'vendre', r.commande.ref, { billet: r.billet.numero });
      return send(res, 201, r);
    }
    case 'anonymiser': {
      const r = await anonymiserCommande(ref);
      await journaliser(acteur, 'anonymiser', ref);
      return send(res, 200, r);
    }
    case 'donnees': {
      const r = await donneesPersonne(body.telephone);
      await journaliser(acteur, 'donnees', null, { telephone: r.telephone, commandes: r.commandes.length });
      return send(res, 200, r);
    }
    case 'desabonner': {
      const r = await desabonner(body.telephone);
      await journaliser(acteur, 'desabonner');
      return send(res, 200, r);
    }
    default:
      throw new HttpError(400, 'action', 'Action inconnue.');
  }
});
