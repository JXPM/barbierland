---
title: Registre des tickets + QR codes (existants)
type: source
tags: [source, billetterie, qr-code, confidentiel]
status: stable
sources: []
updated: 2026-10-07
---
# Registre des tickets & QR codes (déjà produits par l'équipe)

> 🔒 **CONFIDENTIEL** : contient les codes secrets de tous les tickets. Fichiers dans `raw/billetterie/`
> (exclu de git via `.gitignore`). Ne jamais publier, ni recopier les codes dans le wiki.

**Fichiers**
- `raw/billetterie/BABIERLAND_Registre_tickets_CONFIDENTIEL.xlsx`
- `raw/billetterie/BABIERLAND_QR_codes_tickets_original.zip` → décompressé dans `raw/billetterie/qr-codes/` (500 PNG, générés le 2026-09-19)

## Registre Excel : 3 onglets
| Onglet | Contenu |
|---|---|
| **Lisez-moi** | Mode d'emploi : 1 ligne = 1 ticket, colonnes jaunes à remplir, passer le statut à « Vendu » puis noter acheteur, contact, vendeur, date et paiement |
| **Tickets** | 500 lignes : `N° · Type · Code secret · Lien de vérification · Statut · Acheteur · Contact · Vendeur · Date de vente · Paiement` |
| **Tableau de bord** | Prix (Solo 6 000 / Duo 10 000), personnes par pass, compteurs `COUNTIFS` En stock / Vendus / Annulés, objectifs 150 / 150 |

- **Numérotation** : `S001`–`S250` (Solo) et `D001`–`D250` (Duo), donc **500 tickets en réserve** pour 150 + 150 prévus.
- **Code secret** : format `S001-XXXX-XXXX-XXXX` (n° + 3 blocs aléatoires de 4 caractères).
- **Statut** : liste déroulante `En stock / Vendu / Annulé`. Au 2026-10-07 : tout est « En stock », rien n'est vendu.
- **Lien de vérification (Excel)** : `https://babierlandcity.netlify.app/#v=<code secret>`
- **Vérification à l'entrée** (décrite dans « Lisez-moi ») : site `https://babierlandcity.netlify.app/` avec un **mode contrôle** protégé par un code équipe (🔒 dans l'Excel, réservé à l'accueil). Il enregistre les entrées **sur l'appareil utilisé**, donc 1 seul appareil par porte.
- Chaque ticket imprimé doit porter : son n° (`S004`), son code secret et son QR (`S004.png`).

## QR codes
- 1 PNG par ticket, nommé `S001.png` … `D250.png`.
- Contrôle (2026-10-07) : 452 QR décodés automatiquement, **tous identiques au code secret de l'Excel**. Les 48 autres sont un échec du décodeur à cette échelle (3 relus à une autre échelle : OK).
- ⚠️ **Le QR encode `https://claude.ai/artifact/AxnbrJoVqp6JdH7CW1v4ho#v=<code secret>`**, et **pas** le lien Netlify de l'Excel.
  Le code secret est le bon ; seul le domaine diffère. → [[questions-ouvertes]] #10

## Impact
- Remplace la numérotation imaginée dans la maquette (`SOLO-001`) : on garde **`S001` / `D001`** + code secret. → [[billetterie]]
- La jauge de 300 personnes (brief) ne correspond pas à l'objectif 150 Solo + 150 Duo (= 450 personnes). → [[questions-ouvertes]] #11
