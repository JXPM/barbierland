# Log

## [2026-10-07] init | Création du vault Babierland City
## [2026-10-07] ingest | Brief Babierland City v7 + 5 visuels (affiche, tickets, logo City ×2, logo Art of the New Wave)
- 10 pages créées ; logos détourés ; palette échantillonnée.
## [2026-10-07] build | Charte graphique v1 + maquette du site (site/), tests Playwright OK
## [2026-10-07] publish | Charte + maquette en ligne sur https://babierland-city-charte.vercel.app (Vercel, compte jxpm, noindex)
## [2026-10-07] ingest | Registre tickets CONFIDENTIEL (.xlsx) + 500 QR codes (.zip)
- 452 QR décodés, tous concordants avec le registre ; anomalie de domaine (claude.ai vs netlify) notée en Q#10.
- `raw/billetterie/` ajouté au .gitignore.
## [2026-10-07] idea | Ticket envoyé par WhatsApp + e-mail (pas sur le site), indicatif pays sur le téléphone, réutilisation du registre → idees-billetterie (non implémenté)
## [2026-10-07] update | Contacts reçus : +225 01 72 02 40 10, babierlandcity@gmail.com, TikTok @babierlandcity
## [2026-10-07] update | WhatsApp confirmé : +225 01 72 02 40 10 (wa.me/2250172024010)
## [2026-10-11] idea | Passerelle Kadev Pay (pay.kadev.ci) : frais 2,3 % MoMo, SDK JS + webhook signé → idees-billetterie § 4, Q#13
## [2026-10-11] build | Application de billetterie `app/` : réservation, billets avec QR unique, admin, contrôle entrée (paiement à brancher)
- 16 tests OK + parcours navigateur vérifié ; nouvelle page application-billetterie ; Q#14 (domaine avant 1er billet).
## [2026-10-11] ingest | Textes de loi CI : 2013-450 (données), 2013-546 (e-commerce), 2016-412 (consommation), BURIDA → 2026-10-11-textes-loi-ci
## [2026-10-11] build | Conformité légale de l'appli : pages mentions / confidentialité / conditions, consentement + preuve, mineurs, opt-in, droits (accès, effacement), purge automatique, journal, serveurs UE, ressources auto-hébergées
- 27 tests OK ; nouvelle page conformite-legale ; Q#15-18 (ARTCI, identité légale, CGV à valider, BURIDA).
## [2026-10-11] build | Teaser vidéo 9:16 (annonce) intégré au site (lightbox) ; source dans raw/
## [2026-10-11] build | Paiement en ligne Kadev Pay branché (adaptateur, webhook signé HMAC + re-vérif API + contrôle montant, fail-closed, idempotent) ; inactif tant que les clés ne sont pas fournies ; 35 tests OK
## [2026-10-11] decision | Paiement : GeniusPay retenu (doc marchande claire, webhook signé, sandbox) ; Kadev gardé en secours
## [2026-10-11] build | Adaptateur paiement 2 fournisseurs (GeniusPay redirection + Kadev SDK), webhooks signés re-vérifiés, fail-closed, idempotent ; 44 tests OK ; CSP sans script tiers
## [2026-10-11] deploy | App en ligne : https://babierland-city.vercel.app (Vercel) + base Neon Europe (Francfort). Parcours complet vérifié en prod ; clés GeniusPay sandbox validées contre l'API réelle. Paiement en ligne en attente du webhook secret. → deploiement
## [2026-10-12] deploy | Webhook GeniusPay sandbox créé via API REST (MCP geniuspay KO : SSE servi en application/json), secret en env Vercel ; paiement test BC-WUYG7J réussi de bout en bout (webhook signé → billet S001 émis). Le compte GeniusPay envoie TOUS ses événements à TOUS ses webhooks (partagé avec Kawari). Billet test à annuler.
## [2026-10-12] build | Webhook paiement : réf. hors BC- (autres projets du compte GeniusPay partagé) acquittées 200 et ignorées ; 45 tests OK ; vérifié en prod
## [2026-10-12] maintenance | Billet test annulé puis commande supprimée en prod, séquences S/D remises à zéro (prochain billet S001/D001) ; ADMIN_KEY prod régénérée ; vault mis à jour (deploiement, questions-ouvertes #3b ✅ #19, application-billetterie, index)
