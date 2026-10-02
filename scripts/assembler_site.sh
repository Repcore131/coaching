#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════
#  L'ASSEMBLAGE DU SITE PUBLIC — UNE SEULE LISTE, POUR TOUS LES ENVOIS
# ══════════════════════════════════════════════════════════════════════════
#
#  Usage : bash scripts/assembler_site.sh <dossier> [--avec-vault]
#
#  Le dépôt porte des choses qui n'ont RIEN à faire en ligne : scripts de
#  vérification et de migration, règles de la base, code du Worker, notes et
#  plans (docs/), Android, sauvegardes. On n'envoie donc jamais la racine :
#  on assemble, fichier par fichier, ce qui est public.
#
#  QUI L'APPELLE :
#    · .github/workflows/firebase.yml  → _site, Firebase Hosting (repcore-sync.web.app) ;
#    · deploie.sh                      → _site, le même envoi depuis le poste de Kevin ;
#    · .github/workflows/pages.yml     → _pages --avec-vault, GitHub Pages
#      (repcore131.github.io/coaching/ : le sitemap, robots.txt et les
#      balises canonical désignent encore cette adresse ; vault/, l'appli
#      d'épargne, n'est servie que là).
#  Avant le 01/10/2026, deux listes recopiées divergeaient (deploie.sh
#  n'envoyait pas tarifs.json) et Pages publiait LE DÉPÔT ENTIER.
set -euo pipefail
DEST="${1:?usage : bash scripts/assembler_site.sh <dossier> [--avec-vault]}"
cd "$(dirname "$0")/.."
rm -rf "$DEST" && mkdir -p "$DEST"
# maj/ : la page de déblocage, DEHORS de /app/ et donc hors de portée du
# service worker de l'app. p/, c/, a/ : les pages publiques /@pseudo,
# /coach/slug et la page secrète d'un ambassadeur.
cp -a app blog i maj p c a "$DEST"/
# LA SUITE DE TESTS NE PART PAS (01/10/2026) : 5,5 Mo publics qui ne servent
# qu'en local (scripts/verif/suite.mjs sert le dépôt, pas la production).
# En ligne, chargerTests() dit alors « tests.js introuvable ».
rm -f "$DEST/app/tests.js"
cp -a index.html coachs.html legal.html privacy.html terms.html 404.html aide-apk.html "$DEST"/
cp -a logo.png og-image.png robots.txt sitemap.xml "$DEST"/
# LE PLAN DU SITE, régénéré sur la copie publiée : <lastmod> = dernier commit
# de chaque page (scripts/sitemap.mjs). Sans node, la copie du dépôt reste.
if command -v node >/dev/null 2>&1; then node scripts/sitemap.mjs "$DEST/sitemap.xml"; fi
# LA CHARTE DES PAGES PUBLIQUES (01/10/2026) : i/, p/, c/ et 404.html la lient
# en /charte.css. Ses polices sont lues dans app/fonts/, deja copie.
cp -a charte.css "$DEST"/
# LOT C6 : le tableau des offres, que la vitrine d'un coach lit pour ses formules.
cp -a tarifs.json "$DEST"/
# well-known/ (sans point dans le dépôt) → .well-known/. Absent, Firebase sert
# un assetlinks.json VIDE et la TWA Android s'ouvre avec la barre d'adresse.
mkdir -p "$DEST/.well-known" && cp -a well-known/. "$DEST/.well-known/"
if [ -f .nojekyll ]; then cp -a .nojekyll "$DEST"/; fi
if [ "${2:-}" = "--avec-vault" ]; then
  cp -a vault "$DEST"/
  # GitHub Pages passe sinon les fichiers par Jekyll (qui ignore les dossiers « _ »).
  touch "$DEST/.nojekyll"
fi
echo "Fichiers assemblés dans $DEST : $(find "$DEST" -type f | wc -l)"
