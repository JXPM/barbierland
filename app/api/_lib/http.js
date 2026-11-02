import { createHash, timingSafeEqual } from 'node:crypto';

// Erreur métier : renvoyée telle quelle au client.
export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string' || Buffer.isBuffer(body);
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  if (!isText) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(isText ? body : JSON.stringify(body));
}

export async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString() || '{}');
    return req.body ?? {};
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) throw new HttpError(413, 'trop_gros', 'Requête trop volumineuse.');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'json_invalide', 'Corps JSON invalide.');
  }
}

export const params = req => new URL(req.url, 'http://localhost').searchParams;

// Corps brut (octets exacts), nécessaire pour vérifier une signature de webhook.
// Ordre : chaîne/Buffer déjà présents → flux de la requête → en dernier recours, ré-sérialisation
// d'un corps déjà parsé en objet (certains hôtes parsent avant nous ; peut ne pas correspondre
// octet pour octet — à confirmer sur un vrai webhook).
export async function readRaw(req, maxLen = 100_000) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (!req.readableEnded && typeof req[Symbol.asyncIterator] === 'function') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > maxLen) throw new HttpError(413, 'trop_gros', 'Requête trop volumineuse.');
    }
    if (raw) return raw;
  }
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return '';
}

// Enveloppe un handler : méthodes autorisées + erreurs → JSON.
export function handler(methods, fn) {
  return async (req, res) => {
    if (!methods.includes(req.method)) {
      return send(res, 405, { erreur: 'methode', message: 'Méthode non autorisée.' }, { Allow: methods.join(', ') });
    }
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof HttpError) {
        return send(res, err.status, { erreur: err.code, message: err.message, ...err.extra });
      }
      console.error(err);
      send(res, 500, { erreur: 'serveur', message: 'Erreur serveur, réessaie dans un instant.' });
    }
  };
}

const digest = s => createHash('sha256').update(String(s)).digest();

// Vérifie l'en-tête x-cle contre une variable d'environnement (comparaison à temps constant).
export function exigerCle(req, envName) {
  const attendue = process.env[envName];
  if (!attendue || attendue.length < 8) {
    throw new HttpError(503, 'non_configure', `${envName} n'est pas configurée sur le serveur.`);
  }
  const fournie = req.headers['x-cle'] || '';
  if (!timingSafeEqual(digest(fournie), digest(attendue))) {
    throw new HttpError(401, 'cle_invalide', 'Code d’accès incorrect.');
  }
}

// Prénom de la personne connectée (en-tête x-acteur, encodé côté navigateur), pour le journal.
export function acteurDe(req, defaut = 'admin') {
  let v = String(req.headers['x-acteur'] ?? '');
  try { v = decodeURIComponent(v); } catch { /* valeur brute */ }
  return v.trim().slice(0, 60) || defaut;
}

// URL publique du site, utilisée dans les QR et les liens envoyés.
export function urlPublique(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}
