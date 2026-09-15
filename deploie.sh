#!/bin/bash
# ══ DEPLOIEMENT REPCORE ════════════════════════════════════════════════════
#
#   bash deploie.sh                 la branche de travail courante
#   bash deploie.sh main            une autre branche
#
# CE SCRIPT VIT DANS LE DEPOT, et c'est le but : deployer ne demande plus de
# coller trente lignes dans un terminal. Sur Cloud Shell, une fois le depot
# clone et les deux logins faits (voir plus bas), il n'y a plus que :
#
#   cd ~/coaching && git pull && bash deploie.sh
#
# ── PREMIERE FOIS, SUR CLOUD SHELL ────────────────────────────────────────
# Les deux commandes suivantes sont INTERACTIVES : elles posent des questions
# et doivent etre lancees SEULES, l'une apres l'autre. Les coller a la suite
# d'autre chose fait avaler le reste par le premier prompt.
#
#   gh auth login                 GitHub.com, HTTPS, Y, "Login with a web browser"
#   firebase login --no-localhost Cloud Shell n'a pas de navigateur sur localhost :
#                                 sans --no-localhost, le login reste bloque sur
#                                 un callback qui n'arrive jamais.
#   gh repo clone Repcore131/coaching
#
# ── CE QUI EST ENVOYE, ET CE QUI NE L'EST PAS ─────────────────────────────
# hosting ET database. database.rules.json fige les cinq identifiants de
# badges cote serveur : sans lui, un badge est gagne sur le telephone puis
# efface a la premiere synchro, sans le moindre message.
# PAS functions : firebase.json en declare un codebase, mais le plan Spark ne
# les execute pas, et un deploiement nu echouerait dessus.
set -u
PROJET=repcore-sync

# Le dossier du script, pas celui d'ou on l'appelle : le depot peut etre
# clone n'importe ou.
cd "$(dirname "$0")" || exit 1
# ⚠ ON VERIFIE QU'ON EST BIEN DANS LE DEPOT AVANT DE LIRE QUOI QUE CE SOIT.
# Sans ce controle, un script lance depuis ailleurs voyait git echouer, posait
# une BRANCHE VIDE, et continuait — « == branche == » suivi d'un fetch sur
# rien. Un script de deploiement doit s'arreter fort, pas deviner.
git rev-parse --git-dir >/dev/null 2>&1 || {
  echo "!! $(pwd) n'est pas un depot git — lance ce script depuis le depot clone"; exit 1; }
BRANCHE="${1:-$(git rev-parse --abbrev-ref HEAD)}"
[ -n "$BRANCHE" ] && [ "$BRANCHE" != "HEAD" ] || {
  echo "!! branche indeterminee (HEAD detache ?) — precise-la : bash deploie.sh main"; exit 1; }

echo "== branche $BRANCHE =="
git fetch origin "$BRANCHE" || { echo "!! fetch echoue, on n'envoie rien"; exit 1; }
git checkout "$BRANCHE"     || { echo "!! checkout echoue, on n'envoie rien"; exit 1; }
git pull origin "$BRANCHE"  || { echo "!! pull echoue, on n'envoie rien"; exit 1; }
echo "commit : $(git rev-parse --short HEAD)"

# LE BUILD DE L'APP ET CELUI DU SERVICE WORKER DOIVENT CONCORDER. S'ils
# divergent, le SW ne reprend pas la main : les gens gardent l'ancienne
# version et rien ne le dit. C'est la panne la plus couteuse du produit,
# parce qu'elle est invisible depuis le poste de celui qui deploie.
B=$(grep -o "RC_BUILD='[0-9]*'" app/index.html | grep -o '[0-9]*' | head -1)
S=$(grep -o "repcore-v[0-9]*" app/sw.js | grep -o '[0-9]*' | head -1)
echo "== build app=$B  sw=$S =="
[ -n "$B" ] && [ "$B" = "$S" ] || { echo "!! build et sw divergent, on n'envoie rien"; exit 1; }

# L'ASSEMBLAGE EST EXPLICITE, fichier par fichier. `public` pointe sur _site
# et non sur la racine : le depot porte des choses qui n'ont rien a faire en
# ligne — la planche de badges d'origine, les notes, les scripts de verif.
echo "== assemblage =="
rm -rf _site && mkdir -p _site                                      || exit 1
cp -a app blog i _site/                                             || exit 1
cp -a index.html legal.html privacy.html terms.html 404.html _site/ || exit 1
cp -a logo.png og-image.png robots.txt sitemap.xml _site/           || exit 1

# LE GARDE-FOU. Un cp qui echoue a moitie donne un site amputé, et Firebase
# l'enverrait sans broncher. 531 fichiers aujourd'hui ; 400 laisse de la
# marge sans laisser passer un assemblage casse.
n=$(find _site -type f | wc -l)
echo "$n fichiers"
[ "$n" -ge 400 ] || { echo "!! assemblage suspect ($n fichiers), on n'envoie rien"; exit 1; }

echo "== envoi =="
firebase deploy --project "$PROJET" --only hosting,database
