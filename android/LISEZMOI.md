# RepCore pour Android (TWA + Health Connect)

## Google Play en 5 lignes (série 6, lot 15)
1. Play Console : créer l'app « RepCore » (fiche : `android/fiche-store/`, procédure : `android/play/LISEZMOI.md`).
2. Lancer « APK Android » (Actions) : il produit aussi l'**AAB** signé (artefact `RepCore-<v>.aab`) — l'envoyer en test interne.
3. Copier l'empreinte **Play App Signing** (Intégrité de l'application) dans `android/play/empreinte-play.txt`, puis l'ajouter en 2ᵉ position de `well-known/assetlinks.json` ; `node scripts/verif/assetlinks.mjs` doit dire « 2 empreintes ».
4. Test fermé (12 testeurs, 14 jours), puis production.
5. Rien à vendre dans l'app Play : `canalPlay()` (`?src=play`) masque tout achat ; l'abonnement se prend sur le site.

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

## Compiler et publier à la main (secours, Git Bash)

Aucune clé, aucun mot de passe dans le dépôt (`.gitignore` : `*.keystore`, `*.jks`,
`signing-key-info.txt`, `local.properties`). Les variables se posent dans le terminal :
voir l'en-tête de `publier.sh`, puis `bash publier.sh`. Le script s'arrête si le
certificat n'est pas celui de `well-known/assetlinks.json`.

## Tester sur un téléphone Android

1. Installer `RepCore-4.apk` **par-dessus** l'ancien (sans désinstaller).
2. Garmin Connect (ou Samsung Health…) > Health Connect : partage activé.
3. RepCore > Lifestyle > Synchronisation automatique > Autoriser ; confirmer le compte.
4. Retour dans RepCore : les pas et les nuits des 30 derniers jours sont là.
5. Le lendemain, sans ouvrir RepCore : la nuit est arrivée (arrière-plan, toutes les 6 h).

## Publier sur Google Play (02/10/2026)

La fiche est prête dans `android/fiche-store/` (voir son `LISEZMOI.md`). Ce qui suit reste à faire à la
main, **dans la Play Console, par Kevin** : aucune clé ni aucun mot de passe ne passe par le dépôt.

**L'attribution.** `launchUrl` (`app/build.gradle`) et `startUrl` (`twa-manifest.json`) portent `?src=play`
depuis la version 5. `LauncherActivity` le retire si l'APK n'a pas été installé par le Play Store
(release GitHub, `aide-apk.html`) : seules les vraies installations Play sont rangées dans « play ».

### 1. Le compte développeur
- Créer le compte sur https://play.google.com/console : 25 $ une fois, pièce d'identité. Le type
  (personnel ou organisation) se choisit à la création. Un compte **organisation** demande un numéro
  D-U-N-S, mais échappe au test fermé obligatoire de l'étape 3.
- Renseigner le profil de paiement **seulement** si l'app doit vendre par Google Play (voir ⚠ Paiements).

### 2. Créer l'application et sa fiche
1. *Créer une application* : nom « RepCore », langue par défaut français (France), application, gratuite.
2. *Présence sur le Store › Fiche principale* : coller `fr-FR/title.txt`, `short_description.txt`,
   `full_description.txt`, et envoyer l'icône, la bannière et les 6 captures.
3. *Contenu de l'application* :
   - règles de confidentialité : `https://repcore-sync.web.app/privacy.html` ;
   - **accès à l'application** : un compte de démonstration pour les testeurs de Google (adresse et mot
     de passe saisis dans la console, jamais dans le dépôt). Sans lui, la revue est refusée : tout est
     derrière une connexion ;
   - **déclaration Health Connect** : l'app lit pas, sommeil, fréquence cardiaque au repos, variabilité et
     poids. Justifier chaque type de donnée et renvoyer vers les règles de confidentialité ;
   - sécurité des données, classification du contenu, public cible (adultes) ;
   - catégorie : Santé et remise en forme.

### 3. Le premier envoi : l'AAB et la signature
- Google Play n'accepte que des **App Bundles** : `./gradlew bundleRelease` produit
  `app/build/outputs/bundle/release/app-release.aab`, signé avec la clé d'envoi (celle du `.keystore`
  actuel, saisie dans le terminal comme pour `publier.sh`).
- **Play App Signing** re-signe l'app avec une clé de Google. ⚠ **Ajouter son empreinte SHA-256**
  (*Configuration › Intégrité de l'application*) à `well-known/assetlinks.json`, **à côté** de
  l'empreinte actuelle, puis publier le site. Sans cela, la TWA du Play Store s'ouvre avec la barre
  d'adresse. L'APK distribué hors store garde la sienne.

### 4. Test interne, puis test fermé, puis production
1. **Test interne** (immédiat, 100 testeurs au plus) : envoyer l'AAB et vérifier que l'app s'ouvre sans
   barre d'adresse et que l'attribution reçoit `src=play` (écran Viralité, ligne « play »).
2. **Test fermé obligatoire pour un nouveau compte personnel** : **12 testeurs au moins, inscrits
   pendant 14 jours d'affilée**. Une liste d'adresses Gmail (athlètes volontaires) ou un groupe Google ;
   les testeurs acceptent l'invitation, installent et gardent l'app. Compter 14 jours pleins **après**
   le 12ᵉ inscrit.
3. **Demander l'accès à la production** (*Tableau de bord*). Google pose des questions sur le test
   fermé ; la réponse prend quelques jours.
4. **Production** : publier, d'abord en déploiement progressif (20 %), puis 100 %.
5. Une fois l'app en ligne : renseigner `RC_PLAY_URL` (en haut des scripts d'`index.html` et de
   `coachs.html`) avec `https://play.google.com/store/apps/details?id=com.repcore.app`. Le badge
   « Disponible sur Google Play » apparaît alors, sur Android seulement.

### ⚠ Paiements
Une app distribuée par Google Play qui **vend un contenu numérique** (abonnement Essentielle ou Ultime,
formules coach) doit en principe passer par **Google Play Billing**. Dans l'Espace économique européen,
le programme de facturation alternative permet de garder son propre système, avec une commission
réduite et des écrans imposés par Google. Les achats PayPal de l'app, tels quels, risquent un **refus à
la revue** ou un **retrait** de la fiche.

**Tranché (série 6, lot 15) : l'achat est masqué dans la version Play** (`canalPlay()`, `?src=play`,
gardé pour la session dans `rc_canal`) : ni PayPal, ni lien de paiement, ni bouton qui y mène ; l'écran
d'abonnement dit seulement que les achats ne se font pas dans l'application Android.

Pour mémoire, les trois voies étudiées : intégrer Play Billing dans la version Play, adhérer au
programme de facturation alternative, ou masquer l'achat dans la version Play (l'app saurait qu'elle
tourne dans le Play Store grâce à `src=play` ou à l'installateur). Lire les règles de paiement Google Play
en vigueur au moment de l'envoi.
