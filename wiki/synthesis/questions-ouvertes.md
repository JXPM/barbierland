---
title: Questions ouvertes & décisions
type: synthesis
tags: [decisions]
status: draft
sources: ["[[2026-10-07-brief-babierland-city-v7]]"]
updated: 2026-10-12
---
# Questions ouvertes

| # | Sujet | Statut | Qui |
|---|---|---|---|
| 1 | Répartition tickets (option A ?) | à valider | Équipe / finance |
| 2 | ~~Paiement intégré vs manuel WhatsApp~~ : GeniusPay en ligne + WhatsApp en parallèle (décidé 2026-10-11) | ✅ réglé | Johan |
| 3 | Nom de domaine (babierlandcity.com ?) à brancher sur Vercel ; hébergement = **Vercel + Neon Europe, déployé** → [[deploiement]] | domaine à choisir | Johan |
| 4 | Logos HD transparents, vidéo teaser, photos originales + 2 manquantes | à recevoir | Com |
| 5 | ~~TikTok, lien WhatsApp direct~~ ✅ reçus (wa.me/2250172024010) | réglé | Com |
| 6 | Programme horaire / artistes | facultatif | Projets |
| 7 | Pin Google Maps exact | à recevoir | Logistique |
| 8 | Orthographe des noms et fonctions | à vérifier | Brou Yann |
| 9 | Sites d'inspiration | à compléter | Com |
| 10 | **Les QR encodent un lien `claude.ai/artifact/…`** alors que l'Excel indique `babierlandcity.netlify.app`. Lequel est utilisé à l'entrée ? À aligner avant impression (et éviter un lien Claude) | **à clarifier** | Johan + équipe |
| 11 | Objectif registre 150 Solo + 150 Duo (= 450 pers.) vs jauge brief 300 pers. | à clarifier | Finance |
| 12 | Idées ticket envoyé par WhatsApp/e-mail + indicatif pays → [[idees-billetterie]] | idée, pas implémentée | Johan |
| 13 | Passerelle de paiement : Kadev Pay (2,3 %) à étudier → [[idees-billetterie]] § 4. Questions à leur poser : opérateurs, reversement, pièces | **à décider** | Johan |
| 14 | **Domaine définitif à fixer avant le 1er billet** : il est encodé dans chaque QR ([[application-billetterie]]) | **bloquant mise en ligne** | Johan |
| 3b | ~~Webhook GeniusPay~~ créé, paiement sandbox testé de bout en bout (2026-10-12) → [[deploiement]] | ✅ fait | Johan |
| 15 | **Autorisation ARTCI** (téléphones + serveurs hors CEDEAO, art. 7 et 26, loi 2013-450) : déposer le dossier maintenant. Ouvrir les ventes avant la réponse (jusqu'à 2 mois) ? → [[conformite-legale]] | **bloquant / à décider** | Organisateur + Johan |
| 16 | **Identité légale de Babierland** (forme, siège, n° déclaration/RCCM, représentant) pour les mentions légales (art. 5, loi 2013-546) | **bloquant mise en ligne** | Bureau |
| 17 | Choix des CGV marqués « À VALIDER » : remboursement, revente, âge minimum, alcool, sortie définitive | à valider | Brou Yann + bureau |
| 19 | **Compte GeniusPay partagé avec Kawari** : chaque paiement Babierland est aussi envoyé au webhook Kawari (données acheteurs). Ouvrir un **compte marchand dédié** avant les clés live → [[deploiement]] | **bloquant paiement live** | Johan |
| 18 | BURIDA (musique), autorisation mairie/préfecture, assurance RC, sécurité | à vérifier | Projets / logistique |

## Décisions prises
- 2026-10-07 : charte v1 posée (couleurs relevées sur l'affiche, Anton + Rubik, Lucide). → [[charte-graphique]]
- 2026-10-11 : Johan valide la construction de l'appli complète sans paiement, avec **un QR généré par billet** (règle de fait #10 : les QR `claude.ai` du registre ne sont pas utilisés). → [[application-billetterie]]
