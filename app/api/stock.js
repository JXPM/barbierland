import { etatJauge } from './_lib/billetterie.js';
import { handler, send } from './_lib/http.js';

// Public : compteur de places de la page d'accueil.
export default handler(['GET'], async (req, res) => {
  const j = await etatJauge();
  send(res, 200, {
    jauge: j.jauge,
    occupees: j.occupees,
    restantes: j.restantes,
    solo_disponible: j.restantes >= 1,
    duo_disponible: j.restantes >= 2,
  });
});
