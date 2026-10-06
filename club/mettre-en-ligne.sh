#!/bin/bash
# ══ MISE EN LIGNE DE FIT PULSE ═════════════════════════════════════════════
#
#   bash club/mettre-en-ligne.sh                  -> https://fitpulse-niort.web.app
#   bash club/mettre-en-ligne.sh fitpulse-fpniort -> https://fitpulse-fpniort.web.app
#
# A lancer depuis Google Cloud Shell (shell.cloud.google.com), comme RepCore.
# Le nom du site = l'identifiant du projet Firebase : 6 a 30 caracteres,
# minuscules, chiffres et tirets, UNIQUE dans le monde. S'il est deja pris,
# relancer avec un autre nom (fitpulse-niort-79, fitpulse-fpn…).
#
# Premiere fois seulement (commande interactive, a lancer seule) :
#   firebase login --no-localhost
set -u
SITE="${1:-fitpulse-niort}"
cd "$(dirname "$0")" || exit 1

command -v firebase >/dev/null || { echo "== installation de firebase-tools"; npm install -g firebase-tools || exit 1; }
firebase projects:list >/dev/null 2>&1 || { echo "!! Pas connecte. Lancer d'abord, seule : firebase login --no-localhost"; exit 1; }

if ! firebase projects:list 2>/dev/null | grep -q " $SITE "; then
  echo "== creation du projet $SITE"
  firebase projects:create "$SITE" --display-name "Fit Pulse" || { echo "!! Nom indisponible : relancer avec un autre nom."; exit 1; }
fi

echo "== assemblage"
rm -rf _en_ligne && mkdir -p _en_ligne || exit 1
cp -a index.html pulse.css manifest.webmanifest favicon.png icon-192.png icon-512.png apple-touch-icon.png assets ./*.js _en_ligne/ || exit 1

echo "== envoi"
firebase deploy --only hosting --project "$SITE" || exit 1
echo
echo "   Fit Pulse est en ligne : https://$SITE.web.app"
echo "   Sur telephone : ouvrir ce lien, puis « Ajouter a l'ecran d'accueil »."
