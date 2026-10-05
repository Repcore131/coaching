# Sources de données santé

Ce document sert au développement, pas à l'athlète. Il dit **quelles notices
sont vérifiées** et lesquelles attendent d'être remplies.

## La règle qui a présidé à cette table

Aucun chemin constructeur n'est inventé. Une notice ne porte un chemin que si
ce chemin a été **dicté ou vérifié**. Partout ailleurs, l'écran affiche la
recherche générique — « ouvre l'application et cherche *sommeil* » — qui est
vraie sur toutes les applications, y compris après une refonte de leurs menus.

Un chemin faux coûte plus cher que pas de chemin du tout : il envoie chercher
un menu qui n'existe pas, et la personne conclut que l'application se trompe.

## État actuel

| Marque | Application | Sommeil | Pas | Vérifié |
|---|---|---|---|---|
| Apple | Apple Santé | Santé → Parcourir → Sommeil | Santé → Parcourir → Activité → Pas | 2026-09 |
| Garmin | Garmin Connect | Plus → Statistiques de santé → Sommeil | générique | 2026-09 |
| Samsung | Samsung Health | générique | générique | — |
| Google / Pixel | Google Health Connect | générique | générique | — |
| Huawei | Huawei Santé | générique | générique | — |
| Fitbit | Fitbit | générique | générique | — |
| Xiaomi / Redmi | Mi Fitness | générique | générique | — |
| Amazfit | Zepp | générique | générique | — |
| Polar | Polar Flow | générique | générique | — |
| COROS | COROS | générique | générique | — |
| Suunto | Suunto | générique | générique | — |
| WHOOP | WHOOP | générique | **indisponible** | — |
| Oura | Oura | générique | générique | — |
| Withings | Withings Health Mate | générique | générique | — |
| OnePlus / OPPO | OHealth | générique | générique | — |
| Mobvoi / TicWatch | Mobvoi Health | générique | générique | — |
| HONOR | HONOR Health | générique | générique | — |
| realme | realme Link | générique | générique | — |
| CMF / Nothing | Nothing X | générique | générique | — |
| Fossil | Fossil Smartwatches | générique | générique | — |
| TAG Heuer | TAG Heuer Connected | générique | générique | — |
| Montblanc | Montblanc Summit | générique | générique | — |
| RingConn | RingConn | générique | générique | — |
| Ultrahuman | Ultrahuman | générique | générique | — |
| Circular | Circular | générique | générique | — |
| Casio | Casio Watches | générique | générique | — |

## Ajouter une marque

Un seul objet dans `TRACKERS`, dans `app/index.html`. Ni le graphique, ni la
recherche, ni les écrans ne bougent.

```
{id:'…', marque:'…', app:'…', modeles:['…'],
 sommeil:{chemin:['…','…'], alternatif:['…'], note:'…'},
 pas:{chemin:null},          // null = repli générique
 verifie:'2026-09'}
```

`chemin:null` est un choix, pas un oubli : c'est ce qui déclenche le repli
générique. `indisponible:true` sur un bloc dit que l'appareil ne mesure pas
cette donnée — l'écran l'annonce et propose la saisie manuelle.

## La synchronisation automatique, et ce qui reste manuel

Depuis `cloudflare/src/sante.js` (format « rc-sante-1 »), les données santé
peuvent arriver **toutes seules**. Deux chemins, un par téléphone : le
téléphone lit les données là où le système les range, et les POSTE au Worker
(`POST /sante/i/<jeton>`) avec un **jeton de synchronisation** créé dans l'app
(« Connecter mes données santé »), montré une seule fois, dont seule
l'empreinte est gardée.

**Android : Health Connect, par l'APK (version ≥ 4).** L'application Android
(TWA `com.repcore.app`) lit Health Connect, où écrivent la plupart des montres
(Samsung Health, Fitbit, Garmin Connect, Zepp…). Le navigateur n'y a pas
accès : il faut l'APK, version `SAN_SYNC_APK_MIN` (4) ou plus — l'APK 3
(PWABuilder) ne sait pas lire Health Connect. L'app la propose depuis
`aide-apk.html`, dont le lien est `RC_APK_URL`. Dans l'APK, « Autoriser »
ouvre `ConnecterSanteActivity` (jeton rangé, compte confirmé, accès Health
Connect demandé, première lecture lancée).

**iPhone : le Raccourci « RepCore Santé ».** Une page web ne lit pas Apple
Santé. Le Raccourci, lui, le peut : il lit pas, sommeil, fréquence cardiaque
au repos, variabilité et poids, et les envoie avec l'adresse personnelle que
l'athlète colle à l'ajout. Une automatisation iOS le lance chaque jour à 9 h ;
au-delà de 48 h sans réception, la tuile passe à « À relancer ». **Tant que le
lien iCloud n'est pas publié**, l'assistant affiche « Bientôt disponible sur
iPhone » au lieu d'étapes sans bouton, et la ligne « Connecte ta montre »
n'apparaît pas sur iPhone.

**Garmin** pousse lui-même vers le Worker (`garmin.js`, fermé tant que ses
secrets ne sont pas posés) : pas de jeton de téléphone.

**Ce qui reste manuel.** La saisie à la main existe toujours et **prime** sur
une valeur synchronisée. Restent manuels : tout appareil dont l'application
n'écrit ni dans Health Connect ni dans Apple Santé ; un ordinateur (rien à
lire) ; un iPhone tant que le Raccourci n'est pas publié ; un Android sans
l'APK 4. Les entrées saisies gardent `dataStatus:'manual'` ; une valeur
synchronisée porte sa source (Health Connect, Apple Santé, Garmin Connect),
et aucun texte ne présente une saisie comme synchronisée. Les notices de la
table ci-dessus servent à ce chemin manuel.

`estimated` n'est jamais posé : aucune estimation n'est calculée. Une VFC
Health Connect (RMSSD) et une VFC Apple (SDNN) ne se comparent jamais.

**Les deux constantes à remplir** (une ligne chacune, `src/core/`, puis
`node scripts/assembler_core.mjs`) :

| Constante | Fichier | Valeur |
|---|---|---|
| `RC_APK_URL` | `001-debut.js` | l'adresse du fichier APK publié en release GitHub (aujourd'hui `…/releases/download/apk-4/RepCore-4.apk`). **La même** que `#telecharger` dans `aide-apk.html` : un test tombe si elles divergent. |
| `RACCOURCI_SANTE_URL` | `052-…maquettes.js` | le lien iCloud du Raccourci (Raccourcis › RepCore Santé › Partager › Copier le lien iCloud), à la forme `RACCOURCI_SANTE_FORME` : `https://www.icloud.com/shortcuts/` + 32 caractères hexadécimaux. Vide : « Bientôt disponible » sur iPhone, et un TODO dans la carte « Réglages à poser » de l'espace créateur. |
