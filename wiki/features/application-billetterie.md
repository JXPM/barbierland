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

## Parcours (depuis le 2026-10-31 : plus de paiement en ligne)
1. **Réservation (site)** : pass → infos → moyen de paiement prévu → commande `en attente` (réf. `BC-XXXXXX` + **jeton de suivi**), place bloquée **48 h**.
2. L'acheteur clique **« Envoyer sur WhatsApp »** : message pré-rempli vers le numéro officiel 01 72 02 40 10. Il garde le lien **« Suivre ma réservation »** (`/reservation?ref=…&j=…`, aussi mémorisé sur son téléphone).
3. L'équipe reçoit le mobile money puis clique **« Paiement reçu »** dans `/admin` : le **prochain ticket en ligne du registre** est attribué (S001→S100 / D001→D100, dans l'ordre) **et WhatsApp s'ouvre tout seul** vers l'acheteur avec le lien du billet : il reste à appuyer sur Envoyer.
4. Côté acheteur, la page de suivi (rafraîchie toutes les 10 s) affiche **« Paiement reçu ! Voir mon billet »** → `/t/<code>` montre le **QR imprimé du PDF**.
5. **Entrée** : `/controle` scanne **tous** les tickets (en ligne et papier) → entrée validée **une seule fois**. Un Duo fait entrer 2 personnes.

Vente sur place via `/admin` (« Vente guichet ») : attribue aussi un ticket en ligne. Les tickets papier (S101-S250, D101-D250) se vendent hors appli et n'ont rien à saisir ; un ticket papier perdu/volé s'invalide avec **« Annuler un ticket »** (n°).

## Billets & QR (registre de l'équipe)
- Source : `raw/billetterie/BABIERLAND_QR_codes_tickets.pdf` (500 pages = 1 QR + son n°), chargé par `node scripts/importer-tickets.js <PDF>` (`--essai` = vérification sans écriture). 500/500 QR décodés = registre Excel (vérifié le 2026-10-31).
- **Aucun QR n'est généré** : l'image du QR est découpée dans le PDF et stockée en base (`billets.qr_png`) pour les 200 tickets en ligne ; servie par `/api/qr?code=` (uniquement si le ticket est attribué).
- Les QR encodent `https://claude.ai/artifact/…#v=<code secret>` ([[questions-ouvertes]] #10) : le scanner extrait le code après `#v=` (accepte aussi `/t/<code>` et le code brut). Le domaine n'est donc **plus** dans les QR : changer de domaine ne casse rien.
- Au contrôle : ticket **papier** = valable (sauf annulé) ; ticket **en ligne non attribué ou non payé** = refusé « Ticket non vendu ».

## Règles métier
| Règle | Valeur |
|---|---|
| Jauge | 300 personnes, Duo = 2 (`JAUGE`) — en pratique = stock en ligne (100 Solo + 100 Duo) |
| Stock en ligne | par pass : tickets en ligne libres − réservations en attente (< 48 h) |
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

## Paiement
Mobile money envoyé directement à l'équipe, **validé à la main** dans `/admin`. GeniusPay/Kadev **retirés le 2026-10-31** (code, tests, page `/paiement-retour` → redirigée vers l'accueil). Tests : **33** (`npm test`).

## Reste à faire
- [x] Clés **SANDBOX GeniusPay** + webhook déclaré + paiement test réel validé (2026-10-12) → [[deploiement]]
- [ ] Supprimer le webhook GeniusPay 5768 et les variables `GENIUSPAY_*`/`KADEV_*` sur Vercel (inutiles)
- [x] Base Neon + projet Vercel, `PUBLIC_URL`, `ADMIN_KEY`, `CONTROLE_KEY` (2026-10-11) → [[deploiement]]
- [ ] Nom de domaine définitif ([[questions-ouvertes]] #3)
- [ ] Retirer `noindex` de la page d'accueil au lancement (après validation de Brou Yann)
- [ ] Envoi 100 % automatique WhatsApp (sans clic) : nécessite l'API WhatsApp Business (Meta) → [[idees-billetterie]]
- [ ] **Conformité** : dossier ARTCI, identité légale, 22 champs `npm run verifier-legal` → [[conformite-legale]]
- [x] Variable `CRON_SECRET` sur Vercel (purge quotidienne des données)
