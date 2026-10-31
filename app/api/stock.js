import { etatJauge, stockEnLigne } from './_lib/billetterie.js';
import { handler, send } from './_lib/http.js';

// Public : compteur de places de la page d'accueil.
export default handler(['GET'], async (req, res) => {
  const [j, s] = await Promise.all([etatJauge(), stockEnLigne()]);
  send(res, 200, {
    jauge: j.jauge,
    occupees: j.occupees,
    restantes: j.restantes,
    solo_restants: s.solo.restants,
    duo_restants: s.duo.restants,
    solo_disponible: j.restantes >= 1 && s.solo.restants >= 1,
    duo_disponible: j.restantes >= 2 && s.duo.restants >= 1,
  });
});
