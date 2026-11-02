import { journaliser, listerAbonnes, listerCommandes } from '../_lib/billetterie.js';
import { acteurDe, exigerCle, handler, params, send } from '../_lib/http.js';

const STATUT = { en_attente: 'En attente', payee: 'Vendu', annulee: 'Annulé' };
const date = d => (d ? new Date(d).toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' }) : '');
const cellule = v => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Séparateur « ; » + BOM : s'ouvre directement dans Excel en français.
const csv = lignes => '\uFEFF' + lignes.map(l => l.map(cellule).join(';')).join('\r\n');

// Export CSV des commandes (colonnes alignées sur le registre de l'équipe).
// Contient les codes secrets et des données personnelles : fichier confidentiel, chaque export est journalisé.
// ?type=abonnes : contacts ayant accepté de recevoir les infos des prochains événements.
export default handler(['GET'], async (req, res) => {
  exigerCle(req, 'ADMIN_KEY');
  const acteur = acteurDe(req);
  const jour = new Date().toISOString().slice(0, 10);

  if (params(req).get('type') === 'abonnes') {
    const abonnes = await listerAbonnes();
    await journaliser(acteur, 'export_abonnes', null, { lignes: abonnes.length });
    return send(res, 200, csv([
      ['Prénom', 'Nom', 'Téléphone', 'E-mail', 'Consentement le'],
      ...abonnes.map(a => [a.prenom, a.nom, a.telephone, a.email, date(a.consenti_le)]),
    ]), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="babierland-city-abonnes-${jour}.csv"`,
    });
  }

  const lignes = (await listerCommandes()).reverse();
  const entete = ['N°', 'Type', 'Code secret', 'Statut', 'Acheteur', '2e personne', 'Contact', 'E-mail',
    'Vendeur', 'Canal', 'Réservé le', 'Date de vente', 'Paiement', 'Réf. paiement', 'Montant', 'Réf. commande', 'Entré le'];
  const corps = lignes.map(c => [
    c.numero, c.pass === 'duo' ? 'Duo' : 'Solo', c.code, STATUT[c.statut], `${c.prenom} ${c.nom}`.trim(), c.nom_duo,
    c.telephone, c.email, c.vendeur, c.canal, date(c.cree_le), date(c.payee_le), c.operateur, c.paiement_ref,
    c.montant, c.ref, date(c.entre_le),
  ]);
  await journaliser(acteur, 'export', null, { lignes: corps.length });
  send(res, 200, csv([entete, ...corps]), {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="babierland-city-billetterie-${jour}.csv"`,
  });
});
