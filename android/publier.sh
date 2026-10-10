#!/usr/bin/env bash
# ══ PUBLIER L'APK REPCORE (à lancer par Kevin, dans Git Bash) ════════════════
#
#   cd android && bash publier.sh
#
# Avant, dans le MÊME terminal (rien de tout ça ne s'écrit dans le dépôt) :
#   export RC_KEYSTORE="/c/Users/kevin/.../la-cle.keystore"
#   read -s -p "Mot de passe du keystore : " RC_KEYSTORE_PASS; export RC_KEYSTORE_PASS; echo
#   export RC_KEY_ALIAS="…"
#   read -s -p "Mot de passe de la clé : " RC_KEY_PASS; export RC_KEY_PASS; echo
#
# Ce que fait ce script, et où il s'arrête :
#   1. compile la version release signée (gradlew assembleRelease) ;
#   2. VÉRIFIE que le certificat est celui publié dans well-known/assetlinks.json.
#      Sinon il s'ARRÊTE : une autre clé obligerait chaque athlète Android à
#      désinstaller puis réinstaller, et la TWA perdrait son plein écran ;
#   3. copie RepCore-<versionCode>.apk à la racine et calcule son SHA-256 ;
#   4. crée la release GitHub apk-<versionCode> (gh, déjà connecté) ;
#   5. rappelle de publier app/apk-version.json avec le site.
set -euo pipefail
cd "$(dirname "$0")"

for v in RC_KEYSTORE RC_KEYSTORE_PASS RC_KEY_ALIAS RC_KEY_PASS; do
  [ -n "${!v:-}" ] || { echo "!! $v n'est pas posée (voir l'en-tête de ce script)"; exit 1; }
done
[ -f "$RC_KEYSTORE" ] || { echo "!! $RC_KEYSTORE introuvable"; exit 1; }

V=$(grep -o 'versionCode [0-9]*' app/build.gradle | grep -o '[0-9]*' | head -1)
echo "== versionCode $V =="

./gradlew --no-daemon testReleaseUnitTest assembleRelease

APK=app/build/outputs/apk/release/app-release.apk
[ -f "$APK" ] || { echo "!! $APK absent : la signature n'a pas eu lieu"; exit 1; }

# apksigner : dans build-tools du SDK (ANDROID_HOME, ou celui de local.properties).
SDK="${ANDROID_HOME:-$(grep -o 'sdk.dir=.*' local.properties 2>/dev/null | cut -d= -f2- | sed 's/\\\\/\//g; s/\\:/:/')}"
APKSIGNER=$(ls -d "$SDK"/build-tools/*/ 2>/dev/null | sort -V | tail -1)apksigner
[ -x "$APKSIGNER" ] || [ -f "$APKSIGNER.bat" ] || { echo "!! apksigner introuvable dans $SDK/build-tools"; exit 1; }
[ -f "$APKSIGNER.bat" ] && APKSIGNER="$APKSIGNER.bat"

CERT=$("$APKSIGNER" verify --print-certs "$APK" | grep -i 'SHA-256 digest' | head -1 | sed 's/.*: *//' | tr 'a-f' 'A-F' | sed 's/../&:/g; s/:$//')
PUBLIE=$(grep -o '"[0-9A-F:]\{95\}"' ../well-known/assetlinks.json | tr -d '"' | tr '\n' ' ')
echo "certificat de l'APK : $CERT"
echo "assetlinks.json     : $PUBLIE"
if ! echo " $PUBLIE " | grep -q " $CERT "; then
  echo "!! LA CLÉ N'EST PAS LA BONNE. On s'arrête ici."
  echo "   Une nouvelle clé = chaque athlète Android désinstalle puis réinstalle,"
  echo "   et assetlinks.json doit être republié. Cherche la clé de l'APK 3."
  exit 1
fi

cp "$APK" "../RepCore-$V.apk"
SHA=$(sha256sum "../RepCore-$V.apk" | cut -d' ' -f1)
echo "== RepCore-$V.apk  SHA-256 $SHA =="

NOTES="RepCore pour Android, version $V.

- Synchronisation automatique de Health Connect : pas, sommeil, fréquence cardiaque au repos, variabilité cardiaque, poids, masse grasse (lecture seule).
- Installer par-dessus la version précédente, sans désinstaller.
- Aide : https://repcore-sync.web.app/aide-apk.html

SHA-256 du fichier RepCore-$V.apk :
$SHA

Empreinte du certificat de signature (identique à /.well-known/assetlinks.json) :
$CERT"

gh release create "apk-$V" "../RepCore-$V.apk" --repo Repcore131/coaching --title "RepCore Android $V" --notes "$NOTES"

echo
echo "== Fait. Reste à publier le site pour que app/apk-version.json annonce la version $V."
echo "   (versionCode dans app/apk-version.json : $(grep -o '"versionCode": *[0-9]*' ../app/apk-version.json))"
