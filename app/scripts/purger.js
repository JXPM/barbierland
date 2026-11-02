// Applique les durées de conservation à la main : npm run purger
import { journaliser, purger } from '../api/_lib/billetterie.js';
import { closePool } from '../api/_lib/db.js';

const r = await purger();
await journaliser('script', 'purge', null, r);
await closePool();
console.log('Purge effectuée :', r);
