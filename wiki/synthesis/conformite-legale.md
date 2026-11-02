---
title: Conformité légale (Côte d'Ivoire) : site, billetterie, soirée
type: synthesis
tags: [legal, donnees-personnelles, artci, cgv, burida, checklist]
status: draft
sources: ["[[2026-10-11-textes-loi-ci]]"]
updated: 2026-10-11
---
# Conformité légale

Base : [[2026-10-11-textes-loi-ci]]. Appli : [[application-billetterie]].

## ⚠️ Points bloquants (à lancer cette semaine)
| # | Quoi | Pourquoi | Qui |
|---|---|---|---|
| 1 | **Dossier ARTCI : demande d'autorisation préalable**, avec le transfert hors CEDEAO | Loi 2013-450 **art. 7** : un traitement qui porte sur des **numéros de téléphone** et un **transfert vers un pays tiers** (serveurs Vercel/Neon à Francfort) demandent une *autorisation*, pas une simple déclaration. **Art. 11** : réponse sous 1 mois (+1), et **le silence vaut rejet**. Formulaires : [autoritedeprotection.ci/documents](https://www.autoritedeprotection.ci/documents/) | Organisateur (responsable du traitement), dossier préparé par Johan |
| 2 | **Identité légale de l'organisateur** : forme juridique, adresse du siège, n° de déclaration d'association ou RCCM, représentant | Loi 2013-546 **art. 5** (sanction art. 13 : 1 à 5 ans + 1 à 10 M F) ; loi 2016-412 **art. 12**. Indispensable aussi pour le dossier ARTCI (art. 9) et pour un compte marchand (Kadev Pay, [[idees-billetterie]]) | Bureau Babierland |
| 3 | **Autorisation BURIDA** pour la musique (DJ) | Loi 2016-555 : diffusion publique d'œuvres = autorisation préalable + redevance, sinon délit de contrefaçon | Projets / logistique |

> ⚠️ Calendrier : le site doit être en ligne le **31/10/2026** et l'ARTCI peut prendre jusqu'à 2 mois. Si le dossier part maintenant, la réponse peut arriver **après** l'ouverture des ventes. Il faut trancher : ouvrir quand même en ayant déposé le dossier, ou n'afficher que l'info (sans formulaire) jusqu'à l'autorisation. → [[questions-ouvertes]] #15

## À vérifier (non bloquant pour le site)
- **Autorisation de la manifestation** (mairie d'Adzopé / préfecture) : en général exigée pour un rassemblement public de 300 personnes. À confirmer localement.
- **Assurance responsabilité civile organisateur** et **dispositif de sécurité** (agents, secours) pour 300 personnes.
- **Alcool** : vente sur place ? Mineurs présents (15-17 ans) : prévoir le contrôle (bracelet, etc.). Point marqué « À VALIDER » dans les conditions.
- **Fiscalité de la recette** (association ou entreprise) : à voir avec la trésorerie.
- **Droit à l'image** des participants et artistes : clause dans les CGV ; prévoir aussi un accord écrit des artistes et talents qui montent sur scène.

## Ce que l'appli fait déjà (2026-10-11)
| Obligation | Texte | Mise en œuvre |
|---|---|---|
| Mentions légales accessibles | 2013-546 art. 5 ; 2016-412 art. 12 | Page `/mentions-legales` (champs à compléter, voir plus bas) |
| Prix clair, taxes | 2013-546 art. 6 | « Prix TTC, sans frais de réservation » sur la page Pass et dans les CGV |
| CGV conservables, étapes, correction des erreurs, langue, archivage | 2013-546 art. 21 | Page `/conditions` ; étape 3 = récapitulatif modifiable ; français ; archivage décrit |
| Validation après vérification + accusé de réception | 2013-546 art. 22 | Case CGV obligatoire ; écran « Accusé de réception » imprimable avec réf., date et version des CGV |
| Consentement exprès + preuve | 2013-450 art. 14 | `cgv_version` + `cgv_acceptees_le` enregistrés pour chaque commande (site et guichet) |
| Information à la collecte | 2013-450 art. 18, 28 | Mention sous le formulaire + page `/confidentialite` complète |
| Minimisation | 2013-450 art. 16 | Seulement nom, téléphone, e-mail, nom du Duo. Ni pièce d'identité ni date de naissance (une simple déclaration « 18 ans ou plus ») |
| Mineurs (< 18 ans) | 2013-450 art. 1, 33 | Question d'âge ; accord parental obligatoire si mineur ; drapeau « −18 ans » dans l'admin |
| Prospection = opt-in | 2013-450 art. 22 ; 2013-546 art. 14-15 | Case facultative, non cochée par défaut ; table `abonnes` ; désinscription dans l'admin (Vie privée) |
| Accès / copie / portabilité | 2013-450 art. 29, 38 | Admin → Vie privée → recherche par numéro → copie JSON |
| Rectification / effacement | 2013-450 art. 31, 33-36 | Admin → « Effacer les données » (identité effacée, montants conservés) |
| Durées de conservation | 2013-450 art. 16, 43 | Purge **automatique chaque jour** (cron Vercel) : non payées à 30 j, participants au 01/07/2027, journal à 12 mois, abonnés à 24 mois |
| Sécurité + traçabilité des accès | 2013-450 art. 19, 41 | HTTPS + en-têtes de sécurité (CSP, HSTS) ; table `journal` (qui confirme, annule, vend, exporte, scanne, efface) ; codes d'accès séparés admin et accueil |
| Transferts : limiter | 2013-450 art. 26 | Serveurs **UE (Francfort)** : Vercel `fra1` et Neon `aws-eu-central-1`. Polices et scripts **hébergés sur le site** (plus de Google Fonts ni de CDN) ; **Google Maps chargé seulement au clic** |
| Rétractation | 2016-412 art. 11 | 10 jours ouvrables tant que le billet n'a pas servi (CGV § 6) |
| Droit applicable | 2013-546 art. 8-9 | Droit ivoirien, règlement amiable d'abord (CGV § 12) |

## Champs à compléter avant la mise en ligne
`cd app && npm run verifier-legal` liste les 22 trous signalés en orange sur les pages. Il y en a deux sortes :
- **Identité** : forme juridique, siège, n° de déclaration ou RCCM, représentant, directeur de publication, référence ARTCI, autorisations (mairie, BURIDA).
- **Décisions à valider** (Brou Yann + bureau) : date limite de changement de nom, revente, délais de remboursement (7 j / 15 j), âge minimum (15 ans ?), sortie définitive, boissons extérieures, politique alcool.

## Rapport annuel (art. 42)
Le responsable du traitement doit remettre chaque année à l'ARTCI un rapport sur les mesures de sécurité. Le journal et cette page en fournissent la matière.
