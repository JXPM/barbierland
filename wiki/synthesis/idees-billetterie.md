---
title: Idées billetterie (à ne pas implémenter pour l'instant)
type: synthesis
tags: [idees, billetterie, whatsapp, telephone, paiement]
status: draft
sources: ["[[2026-10-07-registre-tickets-et-qr-codes]]"]
updated: 2026-10-11
---
# Idées : billetterie & envoi des tickets

> 💡 **Statut : idées seulement.** Rien n'est implémenté. On tranche une fois que l'équipe aura envoyé
> les éléments manquants ([[questions-ouvertes]]).

## 1. Réutiliser le registre et les QR existants
L'équipe a déjà 500 tickets numérotés avec code secret + QR ([[2026-10-07-registre-tickets-et-qr-codes]]).
- Le site **ne génère pas** de nouveaux numéros : à chaque vente, il **attribue le prochain ticket « En stock »** du bon type (S… ou D…).
- Il remplit ensuite les colonnes du registre : Statut = Vendu, Acheteur, Contact, Vendeur (= « Site »), Date, Paiement.
- Le **Tableau de bord** Excel continue de calculer stock, ventes et recettes tout seul.
- Le registre pourrait passer sur **Google Sheets**, comme le prévoit le brief ([[billetterie]]), avec les mêmes colonnes.
- La vérification à l'entrée reste celle déjà prévue (site Netlify + mode contrôle).
- À vérifier d'abord : quel domaine encode le QR ? (Claude vs Netlify, voir [[questions-ouvertes]] #10)

## 2. Ticket envoyé par WhatsApp + e-mail, pas affiché sur le site
**Préférence de l'équipe** : le ticket est **envoyé directement** à l'acheteur, pas montré sur la page de confirmation.
- Le site affiche seulement « Paiement reçu, ton ticket arrive sur WhatsApp et par e-mail » (sans QR ni code).
- L'envoi contient : visuel du ticket (Solo jaune / Duo citron) avec n°, code secret et QR (`S004.png`), plus le message de confirmation festif de la [[charte-graphique]].
- Pistes d'envoi WhatsApp : manuel au début (la finance/com envoie depuis le numéro officiel), ou WhatsApp Business API / Cloud API ensuite. E-mail depuis babierlandcity@gmail.com (ou via un service transactionnel).
- Avantage : le code secret ne transite pas à l'écran, ce qui limite les captures partagées.
- Impact sur la [[maquette-site]] : l'étape 4 (e-ticket + QR à l'écran) deviendrait un simple écran de confirmation.

## 3. Numéro de téléphone avec indicatif pays
- Champ téléphone avec un **sélecteur de pays / indicatif**, **+225 Côte d'Ivoire par défaut** (drapeau + indicatif), pour accepter les numéros étrangers (diaspora, pays voisins).
- Validation adaptée au pays choisi et stockage au format international **E.164** (`+2250707123456`), nécessaire pour les liens WhatsApp `wa.me/`.
- Lib possible : `intl-tel-input` (UI + validation via libphonenumber).
- Pour la CI : 10 chiffres commençant par 01 / 05 / 07 (actuellement codé en dur dans la maquette).

## 4. Paiement intégré via Kadev Pay (piste à étudier)
Passerelle ivoirienne repérée le 2026-10-11 : [pay.kadev.ci](https://pay.kadev.ci/) · [doc API](https://pay.kadev.ci/developer-documentation/).

| Point | Ce que dit la doc |
|---|---|
| Cible | Églises, associations, entrepreneurs, petites entreprises (CI) |
| Frais | Mobile Money **2,3 %** · carte **4,5 %** |
| Intégration | SDK JS `KadevPay.checkout()` côté client (clé publique `kdvp_…`) + plugin WooCommerce |
| Confirmation | Webhook `payment.success` signé HMAC SHA-512 (`X-KadevPay-Signature`) + `GET /api/v1/transactions/verify/{reference}` (clé secrète `kdvs_…`) |
| Test | Clés `kdvp_test_` / `kdvs_test_`, gratuit ; passage en live après vérification du compte par Kadev |

- **Coût pour nous** : ≈ 138 F par Pass Solo, 230 F par Pass Duo (à 2,3 %).
- **Branchement prévu** : le webhook appellerait la même fonction que le bouton « Confirmer le paiement » de l'admin (`confirmerCommande`), ce qui émet le billet et son QR automatiquement.
- **À demander à Kadev** avant de décider : opérateurs couverts (Wave, Orange Money, MTN MoMo, Moov ?), délai de reversement, pièces demandées (RCCM ? association ?), plafonds, contact.
- Alternative documentée : CinetPay (Orange, MTN, Moov, Wave en CI). Décision : [[questions-ouvertes]] #2, [[paiement-mobile-money]].

### Statut 2026-10-11 : **GeniusPay retenu** et branché (en attente des clés)
Johan a un compte GeniusPay. Intégration **codée et testée** (mock) → [[application-billetterie]] § Paiement. GeniusPay a une doc marchande claire (API `pay.genius.ci/api/v1/merchant/payments`, webhook signé HMAC-SHA256 `timestamp+corps`, sandbox), d'où le choix par rapport à Kadev (doc plus floue). Kadev reste codé en secours, basculable par une variable. Reste : clés sandbox + un vrai paiement de test.

### Alternatives à comparer (si besoin)
GeniusPay, CinetPay, PayDunya, Hub2, Fedapay, Semoa. Critères : opérateurs réellement couverts (Wave ?), frais, délai de reversement, pièces exigées (RCCM/association), qualité du webhook (signé ?), compte de test. ⚠️ Un compte marchand exige l'identité légale de l'organisateur → [[conformite-legale]] #2.
