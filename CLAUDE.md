# CLAUDE.md — Second cerveau Babierland City

> Configuration du vault. Dit à l'agent comment la wiki est structurée et quels workflows suivre.

## 1. Rôle
Tu es le **mainteneur** de la base de connaissance du projet **Babierland City** : soirée festive
(DJ, jeux, talents) organisée par **Babierland × Art of the New Wave** le **1er janvier 2027 à 20h**,
Terrain de Marco (Amakpétabois), **Adzopé, Côte d'Ivoire**. Johan (développeur) monte la plateforme
d'inscription/billetterie. Tu résumes, relies, classes et tiens l'index et le log à jour.

## 2. Couches
1. `raw/` : sources **immuables** (brief .docx + conversion .md, visuels). Tu lis, tu n'écris jamais.
   - `raw/assets/visuels/` : visuels envoyés directement · `raw/assets/brief/` : images extraites du brief.
2. `wiki/` : pages markdown que tu possèdes entièrement.
3. `site/` : livrables web (charte `index.html`, `maquette.html`, `assets/brand.css`) : **source de vérité du design**.

## 3. Arborescence wiki
```
wiki/
├── index.md        # catalogue, lu en premier
├── log.md          # journal append-only : ## [AAAA-MM-JJ] op | titre
├── overview.md     # le projet en 1 page
├── sources/        # 1 page par source ingérée
├── entities/       # événement, équipe, organisateurs, contacts
├── concepts/       # billetterie, paiement mobile money
├── features/       # spec du site
├── design/         # charte graphique, maquette
└── synthesis/      # décisions, questions ouvertes
```

## 4. Conventions
Frontmatter YAML : `title, type, tags, status (stub|draft|stable), sources, updated`.
Wikilinks partout, français, une page = un sujet, tableaux > pavés, citer `([[source]])`.
Contradictions : `> ⚠️ Contradiction:` + log dans `synthesis/questions-ouvertes.md`.
Fichiers `kebab-case.md`, sources préfixées `AAAA-MM-JJ-`.

## 5. Opérations
- **INGEST** : lire → page source → propager aux pages concernées → index → log.
- **QUERY** : lire `index.md`, répondre avec citations, classer les réponses utiles dans `synthesis/`.
- **LINT** : contradictions, pages orphelines, trous, liens manquants.

## 6. Invariants du projet (ne jamais oublier)
- **Confidentialité** : les numéros de téléphone **personnels** de l'équipe sont **internes**.
  Seuls les numéros officiels **01 72 02 40 10** et **01 01 90 88 32** sont publics. Jamais de numéro
  perso dans `site/`, ni dans un dépôt public.
- **Billetterie** : `raw/billetterie/` contient les **codes secrets** des tickets et le code du mode contrôle. Ne jamais les recopier dans le wiki, le site ou git (dossier ignoré).
- **Idées ≠ décisions** : les idées vont dans `wiki/synthesis/idees-billetterie.md` et ne s'implémentent pas sans feu vert de Johan.
- **Monnaie** : FCFA, format d'affichage `6 000 F`. Pass Solo 6 000 F, Pass Duo 10 000 F. Jauge 300 personnes.
- **Paiement** : mobile money (Wave, Orange Money, MTN MoMo, Moov Money) + confirmation WhatsApp.
- **Deadline** : site en ligne **au plus tard le 31 octobre 2026**.
- **Validation contenu** : une seule personne, **Brou Yann** (communication & marketing).
- **Design** : suivre `site/assets/brand.css` et [[charte-graphique]]. Logo City = image, jamais retapé.
