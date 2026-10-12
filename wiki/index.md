# Index

## Vue d'ensemble
- [[overview]] : le projet en une page

## Sources
- [[2026-10-07-brief-babierland-city-v7]] : brief développeur v7 + affiche, tickets, logos, photos
- [[2026-10-07-registre-tickets-et-qr-codes]] : 🔒 registre Excel des 500 tickets + 500 QR codes existants
- [[2026-10-11-textes-loi-ci]] : lois ivoiriennes (données 2013-450, e-commerce 2013-546, consommation 2016-412, droit d'auteur)

## Entités
- [[evenement]] : date, lieu, public, pitch
- [[organisateurs]] : Babierland × Art of the New Wave, contacts publics
- [[equipe]] : 4 pôles, 9 membres, photos (téléphones = interne)

## Concepts
- [[billetterie]] : pass, jauge 300, options de répartition, séries
- [[paiement-mobile-money]] : opérateurs, comptes, tension paiement intégré

## Features
- [[spec-site]] : pages et objectifs V1
- [[application-billetterie]] : appli construite (`app/`) : réservation, billets + QR uniques, admin, contrôle entrée ; paiement GeniusPay actif en sandbox

## Design
- [[charte-graphique]] : couleurs, typo, logos, éléments, ton
- [[maquette-site]] : maquette one-page testée

## Synthèse
- [[questions-ouvertes]] : décisions à prendre / éléments manquants
- [[conformite-legale]] : ⚖️ obligations CI (ARTCI, mentions, CGV, BURIDA), ce qui est fait, ce qui bloque
- [[deploiement]] : 🚀 en ligne sur Vercel + Neon (Europe) ; webhook GeniusPay sandbox ✅ ; restent compte marchand dédié, clés live, domaine
- [[idees-billetterie]] : 💡 idées (registre, ticket par WhatsApp/e-mail, indicatif pays, passerelle Kadev Pay)
