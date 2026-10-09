#!/usr/bin/env bash
# Fit Pulse : paquet daté pour un dépôt e-Soleau (INPI).
# Contenu : le HTML unique de l'application, docs/ (dont les captures), le code
# des scripts et des outils serveur, LICENSE, l'historique git, et SHA256SUMS.txt
# (empreinte SHA-256 de chaque fichier). L'archive doit faire moins de 10 Mo.
#   bash scripts/paquet-esoleau.sh [dossier de sortie]
# Fonctionne dans le dépôt fit-pulse (fitpulse.html à la racine) comme dans
# le dossier club/ du dépôt de développement (le HTML unique est alors construit).
set -euo pipefail
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SORTIE="${1:-$ICI/_esoleau}"
JOUR="$(date +%Y-%m-%d)"
NOM="fit-pulse-esoleau-$JOUR"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
P="$TMP/$NOM"; mkdir -p "$P" "$SORTIE"

if [ -f "$ICI/fitpulse.html" ]; then
  cp "$ICI/fitpulse.html" "$P/fitpulse.html"
else
  node "$ICI/outils/build-single.mjs" "$P/fitpulse.html" >/dev/null
fi
cp -R "$ICI/docs" "$P/docs"
mkdir -p "$P/scripts"; cp "$ICI"/scripts/*.js "$ICI"/scripts/*.sh "$P/scripts/" 2>/dev/null || true
[ -d "$ICI/outils" ] && { mkdir -p "$P/outils"; cp "$ICI"/outils/*.mjs "$P/outils/"; }
[ -f "$ICI/cloud/index.mjs" ] && { mkdir -p "$P/cloud"; cp "$ICI/cloud/index.mjs" "$P/cloud/"; }
[ -d "$ICI/assets/logo" ] && { mkdir -p "$P/assets"; cp -R "$ICI/assets/logo" "$P/assets/logo"; }
for f in LICENSE LICENCE.md; do [ -f "$ICI/$f" ] && cp "$ICI/$f" "$P/"; done

# Historique daté (commit courant et journal complet des commits)
if git -C "$ICI" rev-parse HEAD >/dev/null 2>&1; then
  {
    echo "Fit Pulse : historique git au $JOUR"
    echo "Commit courant : $(git -C "$ICI" rev-parse HEAD) ($(git -C "$ICI" log -1 --format=%ad --date=iso))"
    echo "Étiquettes : $(git -C "$ICI" tag --points-at HEAD | tr '\n' ' ')"
    echo
    git -C "$ICI" log --format='%H %ad %s' --date=iso -- .
  } > "$P/HISTORIQUE.txt"
fi

# Contrôle : aucun libellé interdit dans le HTML
node "$ICI/scripts/audit-libelles.js" "$P/fitpulse.html" "$TMP/audit.csv" | sed "s#$TMP/##" > "$P/AUDIT-LIBELLES.txt"

# Empreintes SHA-256 de chaque fichier
( cd "$P" && find . -type f ! -name SHA256SUMS.txt -print0 | sort -z | xargs -0 sha256sum ) > "$P/SHA256SUMS.txt"

ARCH="$SORTIE/$NOM.zip"; rm -f "$ARCH"
if command -v zip >/dev/null; then ( cd "$TMP" && zip -qr -X "$ARCH" "$NOM" )
else python3 -c "import shutil,sys; shutil.make_archive(sys.argv[1][:-4], 'zip', sys.argv[2], sys.argv[3])" "$ARCH" "$TMP" "$NOM"; fi
TAILLE=$(wc -c < "$ARCH")
echo "Archive : $ARCH ($((TAILLE / 1024)) Ko, $(grep -c . "$P/SHA256SUMS.txt") fichiers)"
echo "SHA-256 de l'archive : $(sha256sum "$ARCH" | cut -d' ' -f1)"
if [ "$TAILLE" -ge 10485760 ]; then echo "ÉCHEC : l'archive dépasse 10 Mo" >&2; exit 1; fi
