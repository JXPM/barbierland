---
title: Application de billetterie (app/)
type: feature
tags: [site, billetterie, qr-code, admin, controle]
status: draft
sources: ["[[2026-10-07-brief-babierland-city-v7]]", "[[2026-10-07-registre-tickets-et-qr-codes]]"]
updated: 2026-10-12
---
# Application de billetterie

Construite le 2026-10-11 dans `app/` (Node + Postgres, déployable sur Vercel + Neon). Le **paiement en ligne
n'est pas branché** : il viendra quand la passerelle sera choisie ([[idees-billetterie]] § 4 Kadev Pay, [[questions-ouvertes]] #2).

## Pages
| URL | Pour qui | Rôle |
|---|---|---|
| `/` | public | Site (repris de la [[maquette-site]]) + jauge en direct + réservation en 3 étapes |
| `/t/<code>` | acheteur | Son billet : Pass Solo (jaune) / Duo (citron), nom(s), **QR code**, n°, téléchargement PNG, impression |
| `/admin` | équipe finance / com | Chiffres clés, commandes, « Paiement reçu », vente au guichet, envoi du billet sur WhatsApp, annulation, export CSV |
| `/controle` | équipe accueil | Scan des QR à la caméra (ou saisie du code), vert / orange / rouge, compteur d'entrées |
| `/mentions-legales`, `/confidentialite`, `/conditions` | public | Pages légales (CI) → [[conformite-legale]] |
| `/paiement-retour` | acheteur | Après un paiement en ligne : attend la confirmation (webhook) puis affiche le billet |

**Teaser** : le bouton « Voir le teaser » du hero ouvre la vidéo verticale 9:16 (`site/assets/visuels/teaser-9x16.mp4`, source immuable dans `raw/`), lecture en lightbox, muette, avec un CTA « Réserver ».

## Parcours
1. **Réservation (site)** : pass → infos → moyen de paiement prévu → commande `en attente` (réf. `BC-XXXXXX`), place bloquée **48 h**.
2. L'acheteur clique **« Confirmer sur WhatsApp »** : message pré-rempli vers le numéro officiel 01 72 02 40 10.
3. L'équipe reçoit le paiement puis clique **« Paiement reçu »** dans `/admin` : le billet est **émis** (n° `S001`/`D001`, code secret, QR unique).
4. Bouton **« Envoyer le billet »** : ouvre WhatsApp vers l'acheteur avec le lien `/t/<code>` (envoi manuel, cf. [[idees-billetterie]] § 2).
5. **Entrée** : `/controle` scanne le QR → entrée validée **une seule fois** (même si 2 portes scannent en même temps). Un Duo fait entrer 2 personnes.

Vente sur place : **« Vente guichet »** dans `/admin` (espèces ou mobile money) émet le billet tout de suite.

## Billets & QR
- **Un QR différent par billet**, généré par le serveur. Il encode `https://<domaine>/t/<code secret>`.
- Code secret au même format que le registre : `S001-XXXX-XXXX-XXXX` (alphabet sans 0/O/1/I, ~60 bits).
- Numérotation séparée Solo (`S001…`) / Duo (`D001…`), attribuée **à la confirmation du paiement** (pas de trou pour les réservations abandonnées).
- ⚠️ Les **500 QR existants** du registre (`raw/billetterie/`) **ne sont pas utilisés** : ils pointent vers un lien `claude.ai` ([[questions-ouvertes]] #10). L'appli génère les siens.
- ⚠️ Le **domaine doit être fixé avant le premier billet émis** : il est imprimé dans chaque QR (`PUBLIC_URL`).

## Règles métier
| Règle | Valeur |
|---|---|
| Jauge | 300 personnes, Duo = 2 (`JAUGE`) |
| Réservation non payée | bloque sa place 48 h (`RESERVATION_HEURES`), puis la libère ; reste confirmable si la jauge le permet |
| Confirmation | refusée si elle ferait dépasser 300 personnes **payées** |
| Annulation | invalide le billet (refusé à l'entrée) |
| Téléphone | ivoirien 10 chiffres (01/05/07), stocké en `+225…` |
| Accès équipe | 2 codes : `ADMIN_KEY` (admin) et `CONTROLE_KEY` (accueil) |

## Technique
- `app/api/_lib/billetterie.js` : toute la logique (jauge sous verrou, émission, contrôle). `confirmerCommande()` est **le point d'entrée du futur webhook de paiement** (idempotent).
- Tables `commandes` et `billets` (`app/db/schema.sql`). Export CSV aux colonnes du registre de l'équipe.
- Design : `site/assets/` copié par `npm run sync-assets` ([[charte-graphique]]).
- Tests : 16 tests (`npm test`, Postgres local) + parcours vérifié au navigateur le 2026-10-11 (réservation → paiement reçu → billet → QR décodé → entrée → « déjà entré »).

## Paiement en ligne — **GeniusPay** (défaut), Kadev en secours
Adaptateur `app/api/_lib/paiement.js` — générique : deux fournisseurs implémentés, bascule par `PAIEMENT_FOURNISSEUR`.
- **GeniusPay** (mode *redirection*, choisi le 2026-10-11) : réservation → bouton « Payer en ligne » → `POST /api/paiement/initier` crée la transaction (API marchand) et renvoie l'URL de checkout → l'acheteur paie sur GeniusPay → **webhook** `/api/paiement/geniuspay` → émission du billet → retour `/paiement-retour` qui l'affiche. Avantage : **aucun script tiers** (CSP stricte conservée).
- **Kadev Pay** (mode *SDK client*) : conservé en secours (`/api/paiement/kadev`).
- **Sécurité (fail-closed)**, identique pour les deux : billet émis seulement si **signature du webhook valide** (GeniusPay : HMAC-SHA256 de `timestamp + "." + corps`, fenêtre 5 min ; Kadev : HMAC-SHA512 du corps) ET **transaction re-vérifiée via l'API du fournisseur** ET **montant ≥ attendu**. Idempotent, journalisé.
- **Inactif par défaut** : s'active quand les clés du fournisseur choisi sont définies ; sinon seul le parcours WhatsApp reste.
- Endpoints : `/api/paiement/config` (état), `/api/paiement/initier` (POST, mode redirection), `/api/paiement/geniuspay` & `/api/paiement/kadev` (webhooks), `/api/commande?ref=` (statut pour la page de retour).
- Réf. hors `BC-` (autres projets du compte marchand partagé) : acquittées 200 et ignorées (`{ignore:'hors_babierland'}`).
- Tests : 10 GeniusPay + 8 Kadev (API fournisseur simulée). **45 tests au total.**

## Reste à faire
- [x] Clés **SANDBOX GeniusPay** + webhook déclaré + paiement test réel validé (2026-10-12) → [[deploiement]]
- [ ] Compte marchand dédié puis clés `pk_live_`/`sk_live_` + webhook live
- [x] Base Neon + projet Vercel, `PUBLIC_URL`, `ADMIN_KEY`, `CONTROLE_KEY` (2026-10-11) → [[deploiement]]
- [ ] Nom de domaine définitif ([[questions-ouvertes]] #3)
- [ ] Retirer `noindex` de la page d'accueil au lancement (après validation de Brou Yann)
- [ ] Envoi automatique WhatsApp / e-mail (aujourd'hui : bouton manuel)
- [ ] **Conformité** : dossier ARTCI, identité légale, 22 champs `npm run verifier-legal` → [[conformite-legale]]
- [x] Variable `CRON_SECRET` sur Vercel (purge quotidienne des données)
