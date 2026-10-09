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

## Ce qui existe : la synchronisation automatique (état au 05/10/2026)

Les données santé arrivent **toutes seules** depuis le téléphone, au format
**« rc-sante-1 »** (`cloudflare/src/sante.js`). Le téléphone lit ce que le
système a rangé et le POSTE au Worker (`POST /sante/i/<jeton>`, ou l'en-tête
`X-RepCore-Jeton`).

**Le jeton.** « Connecter mes données santé » appelle `santeJeton` :
32 octets aléatoires (43 caractères base64url), montrés **une seule fois** ;
le Worker ne garde que leur empreinte SHA-256 (`sante_jetons/<empreinte>`).
Un jeton actif par compte : en créer un révoque le précédent, et « révoquer »
efface aussi tout `sante_sync/<cle>`. Contrôles à la réception, dans cet
ordre : corps > 128 Ko → 413, jeton inconnu → 401, plus de 20 envois dans
l'heure → 429, JSON illisible ou `v ≠ 1` → 400. Au plus 14 jours par envoi,
jamais plus d'un jour dans le futur ni plus de 30 en arrière ; une valeur
hors bornes est écartée et comptée (`ignores`). Le corps n'est jamais
journalisé.

**Android — Health Connect, par l'APK (version ≥ 4).** `SyncSante.kt` lit :
pas, **sommeil avec ses phases** (profond, léger, paradoxal, éveil),
fréquence cardiaque au repos, **VFC en RMSSD**, poids, masse grasse. La
plupart des montres y écrivent (Samsung Health, Fitbit, Garmin Connect,
Zepp…). Le navigateur n'y a pas accès : il faut l'APK `SAN_SYNC_APK_MIN` (4)
ou plus — l'APK 3 (PWABuilder) ne lit pas Health Connect. Lien : `RC_APK_URL`,
proposé depuis `aide-apk.html` ; « Autoriser » ouvre
`ConnecterSanteActivity`.

**iPhone — le Raccourci « RepCore Santé ».** Une page web ne lit pas Apple
Santé ; le Raccourci, si. Il envoie des lignes (`cloudflare/src/lignes.js`) :
pas, sommeil et ses phases, FC au repos, **VFC en SDNN**, poids, masse
grasse, avec l'adresse personnelle collée à l'ajout. Une automatisation iOS
le lance chaque jour ; au-delà de 48 h sans réception, la tuile passe à
« À relancer ». Tant que `RACCOURCI_SANTE_URL` est vide, l'assistant affiche
« Bientôt disponible sur iPhone ».

**Garmin** pousse lui-même vers le Worker (`garmin.js`, fermé tant que ses
secrets ne sont pas posés) : pas de jeton de téléphone.

**Une VFC n'en vaut pas une autre.** `vfcMethode` suit chaque valeur (RMSSD
pour Health Connect et Garmin, SDNN pour Apple) ; l'app ne compare jamais
les deux.

**La rétention.** Le Worker garde **30 jours** (`sante_sync/<cle>/jours`,
chaque envoi efface les jours de 31 à 45). L'app en garde **180** dans le
dossier de l'athlète (`SAN_SYNC_RETENTION_JOURS`, `STEPS_RETENTION_JOURS`).
Elle tire la synchro au plus toutes les 10 minutes (`SAN_SYNC_INTERVALLE_MS`),
à l'ouverture de l'accueil et de Lifestyle.

**La priorité entre les trois sources** (`dataStatus` sur chaque entrée) :

| Ordre | Source | `dataStatus` | Règle |
|---|---|---|---|
| 1 | Synchronisation | `sync` | Écrit le jour, sauf si une saisie manuelle est **postérieure** à la réception de ce jour (`_sanManuelGagne`). Pour le poids, toute pesée non synchronisée est gardée. |
| 2 | Saisie à la main | `manual` | Horodatée (`updatedAt`). Gagne sur une réception plus ancienne qu'elle. |
| 3 | Capture d'écran | `capture` | Ne remplace **jamais** une entrée `sync`, ni une entrée `manual` de moins de 24 h (`_appliquerCaptureStats`, révision 09/2026). Les jours conservés sont dits dans le toast ; une relecture précède toute écriture. |

`estimated` n'est jamais posé : aucune estimation n'est calculée, et aucun
texte ne présente une saisie comme synchronisée.

**Ce qui reste manuel.** Tout appareil dont l'application n'écrit ni dans
Health Connect ni dans Apple Santé ; un ordinateur ; un iPhone tant que le
Raccourci n'est pas publié ; un Android sans l'APK 4. Pour ceux-là : la
saisie à la main, ou la capture d'écran relue. Les notices de la table
ci-dessus servent à ce chemin.

**Les deux constantes à remplir** (une ligne chacune, `src/core/`, puis
`node scripts/assembler_core.mjs`) :

| Constante | Fichier | Valeur |
|---|---|---|
| `RC_APK_URL` | `001-debut.js` | l'adresse du fichier APK publié en release GitHub (aujourd'hui `…/releases/download/apk-4/RepCore-4.apk`). **La même** que `#telecharger` dans `aide-apk.html` : un test tombe si elles divergent. |
| `RACCOURCI_SANTE_URL` | `052-…maquettes.js` | le lien iCloud du Raccourci (Raccourcis › RepCore Santé › Partager › Copier le lien iCloud), à la forme `RACCOURCI_SANTE_FORME` : `https://www.icloud.com/shortcuts/` + 32 caractères hexadécimaux. Vide : « Bientôt disponible » sur iPhone, et un TODO dans la carte « Réglages à poser » de l'espace créateur. |
