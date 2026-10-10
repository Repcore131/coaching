# RepCore pour Android (TWA + Health Connect)

Projet généré par Bubblewrap (`@bubblewrap/core` 1.25, voir `twa-manifest.json`),
puis complété par la lecture de Health Connect (lot C, 28/09/2026).

- `LauncherActivity` : ouvre `https://repcore-sync.web.app/app/index.html?apk=<versionCode>` ;
  lance une synchronisation en tâche de fond et cherche une mise à jour (`app/apk-version.json`).
- `ConnecterSanteActivity` : ouverte par la page (`intent://sante/connecter?jeton=…`) ;
  fait **confirmer le compte** (`/sante/qui`), demande les permissions, lance 30 jours.
- `sante/SyncSante.kt` : Health Connect → `POST /sante/i` (en-tête `X-RepCore-Jeton`), par 14 jours.
- `sante/Jours.kt` : conversion pure en jours, testée par `JoursTest` (JUnit).

## Publication automatique (GitHub)

`.github/workflows/apk.yml` compile, signe, vérifie le certificat contre
`well-known/assetlinks.json` et publie la release `apk-<versionCode>` à chaque
changement d'`android/` sur main. Il lui faut, une fois, quatre secrets du dépôt :
`RC_KEYSTORE_B64` (le .keystore en base64), `RC_KEYSTORE_PASS`, `RC_KEY_ALIAS`,
`RC_KEY_PASS`. Pour publier une nouvelle version : augmenter `versionCode`.

## Deux canaux : l'APK GitHub et le bundle Google Play (10/10/2026)

Même code, propriété Gradle `canal` :
- `./gradlew assembleRelease` (canal `apk`, par défaut) : l'APK des releases
  GitHub. Il cherche ses mises à jour (`MiseAJour`) et ouvre l'app avec
  `?apk=<versionCode>`.
- `./gradlew bundleRelease -Pcanal=play` : le bundle **AAB** pour Google Play.
  Il ouvre l'app avec `?apk=<versionCode>&src=play`. Dans cette session,
  l'app n'affiche **aucun paiement** de contenu numérique, comme le veut la
  règle de facturation de Google Play (`canalApp()` dans rc-core). Il ne
  cherche **jamais** de mise à jour hors du Play Store, ce que Play interdit.

Le workflow produit les deux, signés avec la même clé. Celle-ci sert de clé
d'importation pour Play : voir `docs/play/SIGNATURE.md` et
`docs/play/CHECKLIST.md`.

## Compiler et publier à la main (secours, Git Bash)

Aucune clé, aucun mot de passe dans le dépôt (`.gitignore` : `*.keystore`, `*.jks`,
`signing-key-info.txt`, `local.properties`). Les variables se posent dans le terminal :
voir l'en-tête de `publier.sh`, puis `bash publier.sh`. Le script s'arrête si le
certificat n'est pas celui de `well-known/assetlinks.json`.

## Tester sur un téléphone Android

1. Installer `RepCore-5.apk` **par-dessus** l'ancien (sans désinstaller).
2. Garmin Connect (ou Samsung Health…) > Health Connect : partage activé.
3. RepCore > Lifestyle > Synchronisation automatique > Autoriser ; confirmer le compte.
4. Retour dans RepCore : les pas et les nuits des 30 derniers jours sont là.
5. Le lendemain, sans ouvrir RepCore : la nuit est arrivée (arrière-plan, toutes les 6 h).
