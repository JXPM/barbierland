---
title: Charte graphique
type: design
tags: [design, charte, couleurs, typo]
status: stable
sources: ["[[2026-10-07-brief-babierland-city-v7]]"]
updated: 2026-10-07
---
# Charte graphique

**En ligne** : https://babierland-city-charte.vercel.app (maquette : /maquette.html)
**Livrable** : `site/index.html` (page web) · PDF `site/charte-graphique-babierland-city.pdf` · tokens `site/assets/brand.css`.
Méthode : couleurs relevées par échantillonnage des visuels officiels ; recommandations ui-ux-pro-max (style « Vibrant & Block-based », pattern « Event landing » avec compte à rebours) ; contrastes WCAG calculés.

## Couleurs
| Token | Hex | Rôle |
|---|---|---|
| Brasier | `#D51D02` | Principale : fonds, en-têtes, bouton Payer |
| Braise | `#7A0A02` | Rouge profond : footer, contours |
| Flamme | `#F26A0F` | Orange : badge date, dégradés |
| Soleil | `#F7C21C` | Jaune titre : CTA, chiffres |
| Or Solo | `#F1C40E` | Ticket Solo |
| Citron | `#ADD906` | Ticket Duo, succès |
| Panneau | `#2E6B45` | Vert panneaux : infos pratiques |
| Crème | `#FFF6E5` | Fond contenu |
| Encre | `#1B1210` | Texte, contours, ombres |

Proportions ≈ 55 % rouge · 20 % crème · 12 % jaune · 8 % vert · 5 % citron.
Contrastes : texte encre sur jaune 11,1:1 ✅ · blanc sur brasier 5,2:1 ✅ · jaune sur brasier 3,2:1 ⚠️ gros titres seulement · blanc sur orange 3,1:1 ❌.

## Typo
- **Anton** (titres, dates, prix, MAJUSCULES) : écho des tickets.
- **Rubik** 400→900 (texte, UI, panneaux) : arrondis = écho du logo bulle.

## Éléments signature
Texture lave · panneau de rue vert (texte jaune Rubik 900, incliné) · badge date orange irrégulier · pin de lieu jaune · ticket à talon pointillé.

## Logos
3 logos détourés en PNG transparent (`site/assets/logos/`), **provisoires** (détourés depuis des aperçus) : demander les originaux HD.
Zone de protection = hauteur du « C » de CITY. Tailles min : 120 px / 30 mm (City), 80 px / 20 mm (partenaires).
Interdits : déformer, recolorer, poser sur jaune, tourner/poser sur photo chargée.

## Ton
Tutoiement, joyeux, direct, toujours date + lieu + prix. Emoji OK dans WhatsApp, jamais comme icônes UI (Lucide).

Lien public : voir [[maquette-site]].
