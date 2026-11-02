---
title: Déploiement (Vercel + Neon)
type: synthesis
tags: [deploiement, vercel, neon, infra, paiement]
status: draft
sources: ["[[application-billetterie]]"]
updated: 2026-10-12
---
# Déploiement

Mise en ligne de l'app de billetterie le 2026-10-11. Code : [[application-billetterie]].

## Infrastructure (comptes de Johan)
| Élément | Détail |
|---|---|
| **Site** | https://babierland-city.vercel.app (Vercel, scope `jxpms-projects`, projet `babierland-city`, racine = `app/`) |
| **Base** | Neon, projet `babierland-city` (`shiny-cake-79629489`), région **Europe (Francfort, aws-eu-central-1)**, Postgres 17, branche `neondb` |
| **Cron** | Vercel cron quotidien `0 3 * * *` → `/api/cron/purger` (purge RGPD), authentifié par `CRON_SECRET` |
| **Plan** | Vercel Hobby : **max 12 fonctions** → les 4 endpoints paiement sont regroupés dans `api/paiement/[op].js` (10 fonctions au total) |

> ⚠️ `site/assets/` est ignoré par git (généré). Sur Vercel il est quand même uploadé grâce à `app/.vercelignore` (ne pas y exclure `public/assets`). Lancer `npm run sync-assets` avant tout déploiement.

## Variables d'environnement Vercel (production)
Définies ✓ : `DATABASE_URL`, `PUBLIC_URL`, `PAIEMENT_FOURNISSEUR=geniuspay`, `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET` (sandbox, 2026-10-12), `ADMIN_KEY` (**régénérée le 2026-10-12**, détenue par Johan), `CONTROLE_KEY`, `CRON_SECRET`.
Valeurs non commitées : dans `app/.deploy.env` (gitignored) ; secrets admin/accueil/cron générés aléatoirement.

## État vérifié en production (2026-10-11)
- ✅ Accueil, assets (CSS, logos, **teaser**), polices, pages légales, `/admin`, `/controle`, `/paiement-retour`, en-tête CSP.
- ✅ Base Neon connectée (`/api/stock`).
- ✅ Parcours complet : réservation → « Paiement reçu » (admin) → billet `S001` émis → page `/t/<code>` + QR (après correction de la réécriture `/t/:code → /billet`). Base de test nettoyée ensuite.
- ✅ Clés GeniusPay **sandbox validées contre l'API réelle** : auth OK, création (`checkout_url`, `reference`, `metadata.ref`) et vérification (`status`) conformes au code.
- ✅ **Paiement en ligne actif en sandbox** (2026-10-12) : `/api/paiement/config` → `actif:true, test:true`.

## Webhook GeniusPay (2026-10-12)
| Élément | Détail |
|---|---|
| Webhook | id **5768** « Babierland City billetterie », env. sandbox → `https://babierland-city.vercel.app/api/paiement/geniuspay` |
| Événements | `payment.success`, `payment.failed`, `payment.cancelled`, `payment.expired` |
| Création | via l'**API REST** `POST /api/v1/merchant/webhooks` (le secret `whsec_` n'est renvoyé **qu'à la création**) |
| Test bout en bout | commande `BC-WUYG7J` → checkout sandbox simulé « success » → webhook signé accepté → billet émis ✅. Commande test ensuite supprimée, **séquences remises à zéro** (prochain billet : S001 / D001), base vide |
| MCP GeniusPay | ❌ inutilisable : `https://geniuspay.ci/api/mcp` sert le flux SSE avec `Content-Type: application/json` → rejeté par Claude Code. Bug côté GeniusPay ; passer par l'API REST |

> ⚠️ **Compte marchand partagé avec un autre projet (Kawari)** : GeniusPay envoie **chaque événement du compte à tous ses webhooks**. Conséquences : (1) Kawari reçoit les paiements Babierland (nom, e-mail des acheteurs) ; (2) nous recevons les leurs. Le point 2 est neutralisé : le webhook acquitte (200) et ignore toute réf. hors `BC-`. Le point 1 impose un **compte marchand dédié avant le passage en live** → [[questions-ouvertes]] #19.

## Étapes restantes (côté Johan)
1. ~~Webhook sandbox + secret + redéploiement + paiement test~~ ✅ 2026-10-12 (signature HMAC-SHA256 confirmée).
2. **Compte marchand GeniusPay dédié** à Babierland (voir ⚠️ ci-dessus).
3. En production réelle : clés `pk_live_` / `sk_live_` + **webhook live** créé via l'API (`whsec_live_` → `GENIUSPAY_WEBHOOK_SECRET`), redéployer, un paiement réel de 100 F à rembourser pour valider.
4. **Domaine définitif** ([[questions-ouvertes]] #14) : le brancher sur Vercel et mettre `PUBLIC_URL` à jour **avant d'émettre les premiers vrais billets** (le domaine est encodé dans chaque QR).
5. Remplir les **mentions légales** (`npm run verifier-legal`, 22 champs) et déposer le dossier **ARTCI** → [[conformite-legale]].

## Commandes utiles
- Déployer : `cd app && npm run sync-assets && vercel deploy --prod --yes`
- Logs : `vercel logs babierland-city.vercel.app`
- Migrer la base (idempotent) : `DATABASE_URL=… npm run migrate`
- Purge RGPD manuelle : `DATABASE_URL=… npm run purger`
