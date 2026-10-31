---
title: Billetterie & jauge
type: concept
tags: [billetterie, tickets]
status: draft
sources: ["[[2026-10-07-brief-babierland-city-v7]]", "[[2026-10-07-registre-tickets-et-qr-codes]]"]
updated: 2026-10-11
---
# Billetterie

| Pass | Prix | Personnes | Couleur ticket |
|---|---|---|---|
| Solo | 6 000 F | 1 | jaune `#F1C40E` |
| Duo | 10 000 F | 2 | citron `#ADD906` |

- **Jauge** : 300 personnes tous pass confondus ; un Duo compte pour 2. Fermer les inscriptions à 300.
- **Répartition (à valider)** : option A = 100 Duo + 100 Solo = 300 pers., 200 tickets, recette max 1 600 000 F.

| Option | Duo | Solo | Tickets | Recette max |
|---|---|---|---|---|
| A (proposée) | 100 | 100 | 200 | 1 600 000 F |
| B | 120 | 60 | 180 | 1 560 000 F |
| C | 75 | 150 | 225 | 1 650 000 F |
| D | 150 | 0 | 150 | 1 500 000 F |

- **Série (existante)** : `S001`–`S250` et `D001`–`D250`, chacun avec un code secret `S001-XXXX-XXXX-XXXX` et un QR déjà générés par l'équipe. → [[2026-10-07-registre-tickets-et-qr-codes]] (remplace le format `SOLO-001` de la maquette).
- ~~Billets émis par l'appli avec QR généré (2026-10-11)~~ → **depuis le 2026-10-31 : les tickets du registre/PDF sont utilisés** : S001-S100 + D001-D100 vendus sur le site (QR du PDF), le reste vendu en papier ; le scanner accepte les 500. → [[application-billetterie]]
- **Objectif de ventes (registre)** : 150 Solo + 150 Duo, à rapprocher de la jauge de 300 personnes ([[questions-ouvertes]] #11).
- **Données collectées** : nom, prénom, téléphone, e-mail, pass, nom de la 2e personne si Duo.
- **Stockage** : Google Sheets / Excel (pas d'e-mail).
- **Confirmation** : WhatsApp et/ou e-mail, ton festif (voir [[charte-graphique]] § Ton). 💡 Idée : le ticket est **envoyé** par WhatsApp + e-mail, pas affiché sur le site → [[idees-billetterie]].

Lié : [[paiement-mobile-money]], [[spec-site]].
