// Constantes de l'événement. Source : wiki/concepts/billetterie.md
export const PASS = {
  solo: { label: 'Pass Solo', prix: 6000, personnes: 1 },
  duo: { label: 'Pass Duo', prix: 10000, personnes: 2 },
};

export const JAUGE = Number(process.env.JAUGE || 300);

// Une réservation non payée bloque sa place pendant ce délai, puis la libère.
export const RESERVATION_HEURES = Number(process.env.RESERVATION_HEURES || 48);

export const OPERATEURS = ['Wave', 'Orange Money', 'MTN MoMo', 'Moov Money'];
export const OPERATEURS_GUICHET = [...OPERATEURS, 'Espèces'];

// Numéro officiel (public) qui reçoit les confirmations WhatsApp.
export const WHATSAPP_OFFICIEL = '2250172024010';

// ---------- Conformité ----------
// Version des conditions de vente + politique de confidentialité affichées sur le site.
// À incrémenter à chaque modification de public/conditions.html ou public/confidentialite.html.
export const CGV_VERSION = '2026-10-31';

// Durées de conservation (annoncées dans public/confidentialite.html : les garder alignées).
export const CONSERVATION = {
  nonPayeeJours: 30,                       // réservation non payée ou annulée
  finParticipants: '2027-07-01T00:00:00Z', // 6 mois après la soirée : données des acheteurs anonymisées
  journalMois: 12,                         // traces d'accès et d'opérations
  abonnesMois: 24,                         // contacts « infos des prochains événements »
};

export const formatFcfa = n => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
