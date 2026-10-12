#!/bin/sh
# site/assets/ reste la source de vérité du design (brand.css, logos, visuels).
# On en copie une version dans app/public/assets/ avant chaque déploiement.
set -e
cd "$(dirname "$0")/.."
rm -rf public/assets
mkdir -p public/assets
cp -R ../site/assets/. public/assets/
echo "Assets synchronisés depuis site/assets/"
