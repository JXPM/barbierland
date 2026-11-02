// Applique db/schema.sql (idempotent) sur DATABASE_URL.
import { readFile } from 'node:fs/promises';
import { closePool, query } from '../api/_lib/db.js';

const sql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
await query(sql);
await closePool();
console.log('Schéma appliqué.');
