#!/usr/bin/env bash
# Fit Pulse : crée le dépôt git privé « fit-pulse » (version livrable, datée).
#   fitpulse.html   l'application en un seul fichier
#   assets/         logo, icônes, images
#   scripts/        audit des libellés, paquet e-Soleau
#   docs/           concepts propres, sources et licences, captures, documentation
#   vendor/, fonts/ bibliothèques et polices tierces (licences : docs/sources-et-licences.md)
# Premier commit avec la version actuelle, étiquette v0.1-2026-10.
#   bash club/scripts/creer-depot-fit-pulse.sh ../fit-pulse [url-du-dépôt-distant-privé]
# Avec une URL, le dépôt est poussé (branche main et étiquette) ; le dépôt distant
# doit exister et être PRIVÉ.
set -euo pipefail
CLUB="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:?dossier du nouveau dépôt}"; DISTANT="${2:-}"
[ -e "$DEST/.git" ] && { echo "$DEST est déjà un dépôt git : rien n'est fait." >&2; exit 1; }
mkdir -p "$DEST"; DEST="$(cd "$DEST" && pwd)"
node "$CLUB/outils/build-single.mjs" "$DEST/fitpulse.html" >/dev/null
mkdir -p "$DEST/assets" "$DEST/scripts"
cp -R "$CLUB/assets/." "$DEST/assets/"
rm -f "$DEST/assets/logo-fitness-park.svg"   # marque de l'enseigne : hors du produit
for f in favicon.png apple-touch-icon.png icon-192.png icon-512.png icon-maskable-512.png manifest.webmanifest sw.js; do [ -f "$CLUB/$f" ] && cp "$CLUB/$f" "$DEST/"; done
cp "$CLUB/scripts/audit-libelles.js" "$CLUB/scripts/paquet-esoleau.sh" "$CLUB/scripts/creer-depot-fit-pulse.sh" "$DEST/scripts/"
cp -R "$CLUB/docs" "$DEST/docs"
cp -R "$CLUB/vendor" "$DEST/vendor"; cp -R "$CLUB/fonts" "$DEST/fonts"
cp "$CLUB/LICENSE" "$DEST/LICENSE"
printf '_esoleau/\nscripts/libelles-a-renommer.csv\n' > "$DEST/.gitignore"
cat > "$DEST/README.md" <<'TXT'
# Fit Pulse

Logiciel propriétaire, tous droits réservés (voir LICENSE).

- `fitpulse.html` : l'application en un seul fichier (ouvrir avec `?demo=1` pour les données fictives).
- `docs/concepts-propres.md` : les concepts originaux, datés.
- `docs/sources-et-licences.md` : bibliothèques, polices et images tierces.
- `node scripts/audit-libelles.js fitpulse.html` : contrôle des libellés.
- `bash scripts/paquet-esoleau.sh` : archive datée pour un dépôt e-Soleau (moins de 10 Mo, empreintes SHA-256).
TXT
node "$DEST/scripts/audit-libelles.js" "$DEST/fitpulse.html" "$(mktemp)" | head -1
SOURCE="$(git -C "$CLUB" rev-parse HEAD 2>/dev/null || echo inconnu)"
cd "$DEST"
git init -q -b main
git add -A
git commit -q -m "Fit Pulse v0.1 : version de référence du $(date +%Y-%m-%d)

Construit depuis le dépôt de développement, commit $SOURCE."
git tag -a v0.1-2026-10 -m "Fit Pulse v0.1, octobre 2026"
git log --format='%H %ad %s' --date=iso -1
if [ -n "$DISTANT" ]; then git remote add origin "$DISTANT"; git push -u origin main; git push origin v0.1-2026-10; fi
