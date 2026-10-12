---
title: Maquette du site
type: design
tags: [design, maquette, site]
status: draft
sources: ["[[2026-10-07-brief-babierland-city-v7]]"]
updated: 2026-10-07
---
# Maquette

Fichier : `site/maquette.html` (HTML/CSS/JS statique, one-page, responsive). Applique [[charte-graphique]] et couvre [[spec-site]].

- Hero lave : co-signature, logo, badge date, panneaux Abidjan/Adzopé, **compte à rebours** (UTC+0), **jauge 300 places**.
- Sections : La soirée (DJ/Jeux/Talents) · Infos + carte Google · Pass (tickets CSS) · **Inscription 3 étapes** (pass → infos → opérateur mobile money → e-ticket avec n° de série + QR) · Équipe par pôle · FAQ · Contact.
- Mobile : barre CTA collante « Pass dès 6 000 F ».
- Accessibilité : skip-link, labels visibles, erreurs sous les champs (aria-invalid, role=alert), focus visible, cibles ≥ 44 px, prefers-reduced-motion.
- Testé avec Playwright (375/390 px et 1440 px) : 0 erreur console, pas de scroll horizontal, parcours de réservation complet OK.
- Paiement et compteur **simulés** (aucune donnée envoyée).

Pour la prod : brancher formulaire → Google Sheets (Apps Script) + agrégateur mobile money ([[paiement-mobile-money]]).

> 💡 Idées en attente ([[idees-billetterie]]) : ne plus afficher l'e-ticket à l'écran (envoi WhatsApp + e-mail), réutiliser les n° `S001`/`D001` du registre, sélecteur d'indicatif pays sur le téléphone. **Non implémenté.**
