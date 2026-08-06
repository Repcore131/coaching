# Import des pas et du sommeil par capture d'écran — conception

**Date :** 2026-08-06
**Fichier applicatif :** `app/index.html`
**Décidé avec :** Kevin Guellec

## Le problème

Les pas et les heures de sommeil sont saisis à la main, jour après jour. L'athlète
oublie, le coach pilote sur des trous. La demande initiale était de brancher Garmin
pour que ça se remplisse tout seul.

Cette voie est fermée. Garmin a **suspendu son Connect Developer Program** : le
formulaire de demande d'accès a été retiré, sans date de réouverture. Même rouvert,
l'accès exige une candidature en tant qu'entité légale, une revue manuelle de
plusieurs semaines, et un serveur pour recevoir les données en cloud-à-cloud —
RepCore n'en a pas, et le plan Firebase reste volontairement gratuit.

Restait le coffre santé du téléphone (Health Connect côté Android, Apple Santé côté
iPhone). Écarté : deux mécanismes différents à construire et à maintenir pour une
flotte d'athlètes moitié Android moitié iPhone, une app native à distribuer, et une
clé personnelle à installer chez chaque élève.

## La solution retenue

L'athlète envoie une **capture d'écran** de son application de montre. L'app lit les
chiffres et remplit les journées.

Ce que ça résout, et qu'aucune des voies précédentes ne résolvait :

- **Une seule mécanique pour toute la flotte.** Un champ photo dans une page web se
  comporte à l'identique sur iPhone et sur Android. Rien à installer, rien à
  autoriser, aucun serveur.
- **Indépendant de la marque.** L'analyse cherche « une date associée à une valeur »,
  pas la mise en page de Garmin. Une capture Apple Santé ou Samsung Health passe donc
  sans une ligne de code supplémentaire.
- **Une capture vaut une semaine.** Les écrans de référence sont en vue 7 jours : un
  envoi remplit sept journées, pas une.

## Ce qu'on ne fait pas

- Pas d'intégration Garmin, pas de serveur, pas d'agrégateur payant.
- **La capture n'est jamais conservée** : ni dans la fiche de l'athlète, ni sur
  Cloudinary, ni en base. Elle est lue, puis oubliée.
- Pas d'écran de validation intermédiaire (voir « Décisions tranchées »).
- Pas d'import de la fréquence cardiaque, du stress, du Body Battery ou du score de
  sommeil. Seuls les pas et la durée de sommeil entrent dans le modèle existant.

## Décisions tranchées par Kevin

1. **Lecture embarquée, aucun appel tiers.** Premier choix retenu : réutiliser
   `_ocrImage` / OCR.space. Abandonné après lecture du code — `LEGACY_PDF_IMPORT=false`
   (l. 13315) coupe volontairement ce sous-traitant, `_ocrImage` lève une exception
   quel que soit le chemin, et le commentaire de la garde unique interdit explicitement
   d'en poser une seconde à côté. Réutiliser OCR.space aurait donc voulu dire rouvrir
   une porte fermée en connaissance de cause, pour y envoyer des captures de santé.
   Retenu à la place : **Tesseract auto-hébergé dans le dépôt**, exécuté sur l'appareil.
   Rien ne sort du téléphone, la garde unique reste fermée, et `LEGACY_PDF_IMPORT` n'est
   pas touché.
2. **Écriture directe, sans écran de confirmation.** Le risque a été posé (une valeur
   mal lue s'installe sans que personne ne la voie) et accepté au nom de la fluidité.
   Les garde-fous ci-dessous compensent sans ajouter d'étape.

## Le parcours

Un cadre en bas de la page **Pas** et en bas de la page **Sommeil** :

> Pas noté tes stats ? Envoie la capture de ta montre — les chiffres sont lus et
> remplis automatiquement. L'image n'est pas conservée.

1. L'athlète choisit une photo (appareil ou galerie).
2. Le moteur embarqué se charge (à la demande, jamais au démarrage de l'app) et rend
   du texte brut. L'image ne quitte pas l'appareil.
3. L'analyseur extrait les couples (date, valeur).
4. Les journées valides sont écrites immédiatement.
5. Un toast récapitule ce qui est entré : « 7 jours enregistrés, 31 juil. → 6 août ».

L'image est relâchée dès l'étape 3. Aucun chemin ne la stocke.

**Poids et chargement.** Le moteur pèse ≈ 4,1 Mo (`tesseract-core-simd-lstm.wasm`
2,79 Mo, `fra.traineddata` 1,19 Mo, ≈ 170 Ko de scripts), servis depuis le dépôt et
jamais depuis un CDN — le projet les a tous bannis. Chargement **paresseux** : un
athlète qui n'utilise jamais l'import ne télécharge rien. Le Service Worker les met en
cache au premier usage. Prévoir la variante non-SIMD en repli pour les appareils
anciens ; Tesseract choisit seul, mais le fichier doit être présent sinon la requête
tombe en 404.

## L'analyse de la capture

**Principe :** générique, ligne à ligne, jamais dépendante d'une mise en page.

- **Date** — un jour et un mois en français (`6 août`, `31 juillet`), avec ou sans
  abréviation. L'année n'apparaît jamais sur ces écrans : on prend l'année courante,
  et si la date obtenue tombe dans le futur on bascule sur l'année précédente. Sans
  cette bascule, tout import de fin décembre serait daté d'un an en avant.
- **Pas** — un entier, espaces et séparateurs de milliers admis (`4 844`, `4844`).
  Le pourcentage d'objectif affiché à côté (`60 %`) doit être ignoré : il est plus
  petit que le total et suit la date de plus près, c'est le principal piège de lecture.
- **Sommeil** — une durée `6h 35m`, convertie en heures décimales par la même formule
  que l'app : `Math.round(mins/6)/10`. Le score Garmin (`79`) est ignoré ; comme le
  pourcentage côté pas, il est adjacent à la date et ne doit pas être pris pour la
  valeur cherchée.

**Règle d'association — établie sur le texte réellement rendu, pas supposée.** La
lecture des deux captures de référence a montré que la mise en page ne se lit pas de
façon régulière : la valeur tombe tantôt sur la ligne de la date (`5 août - 25% 3 003`),
tantôt sur la ligne juste au-dessus (`4 844` puis `6 août » 60%`). Les noms de jours
sont peu fiables — `jeudi` est ressorti en `Ja)`. Les anneaux de progression produisent
du bruit (`J`, `N`, `D`, `>`).

D'où la règle, unique pour les deux types de capture :

> Pour chaque date reconnue, chercher une valeur **sur sa propre ligne**, sinon **sur la
> ligne précédente**. Si aucune valeur n'est trouvée, la date est abandonnée.

Elle a trois vertus vérifiées sur les captures réelles : elle s'appuie sur la date, seul
élément lu de façon fiable ; elle absorbe les deux mises en page observées ; et elle
**élimine d'elle-même la ligne d'en-tête** (`31 juil. — 6 août`), qui ne porte aucune
valeur et serait sinon comptée comme un huitième jour.

Les pourcentages (`60%`) sont retirés de la ligne **avant** d'y chercher un entier, puis
on retient le plus grand entier restant — sans quoi `5 août - 25% 3 003` rendrait 25.

**Nature de la capture** — déduite du contenu, pas demandée à l'athlète : la présence
de durées `XhYm` désigne une capture de sommeil, sinon des pas. Le même cadre accepte
donc les deux, quelle que soit la page depuis laquelle il est ouvert.

## Le modèle de données

Aucun champ nouveau. L'import se branche sur l'existant.

**Pas** — appel direct à `_recordSteps(dateStr, count)`, qui valide déjà `0 ≤ n ≤ 99999`,
écrase la journée au lieu d'empiler, et applique `STEPS_RETENTION_JOURS`.

**Sommeil** — `saveSleep()` lit le DOM et ne travaille que sur la nuit courante. On en
**extrait une primitive** `_recordSleep(dateStr, {bed, wake, duration})`, calquée sur
`_recordSteps` : écrasement par date, rétention 180 jours, valeur de retour booléenne.
`saveSleep()` l'appelle ensuite au lieu de dupliquer cette logique. C'est le seul
remaniement de code existant prévu, et il est nécessaire : sans lui l'import devrait
recopier des règles de conservation déjà écrites ailleurs.

**Nuits importées : durée seule, sans heure de coucher.** Les captures ne donnent
jamais l'heure du coucher ni celle du lever. `bed` et `wake` restent donc vides.
Vérifié dans le code, cette dégradation est sans casse :

- l'analyse de micro-sommeil filtre sur `Number(e.duration)>0` — les nuits importées
  y comptent normalement, moyenne comprise ;
- `_htmlCafeineNuits` écarte proprement les nuits sans `bed` (`_hhmmEnMin(nuit.bed)==null`)
  — la seule perte est l'alerte caféine-avant-le-coucher sur ces nuits-là.

L'athlète qui veut cette alerte peut toujours renseigner ses heures à la main : la
saisie manuelle n'est ni retirée ni modifiée.

## Journées déjà renseignées

**L'import écrase.** C'est déjà la règle de `_recordSteps`, et elle est cohérente avec
le reste de l'app : une journée n'a qu'un total. Une valeur venue de la montre est par
ailleurs plus fiable qu'un chiffre tapé de mémoire.

Le toast final signale combien de journées ont été remplacées, pour que l'écrasement
ne soit jamais muet.

## Garde-fous

Sans écran de validation, la sécurité se joue sur le rejet plutôt que sur la relecture :

- pas hors de `[0, 99999]` — rejet, déjà assuré par `_recordSteps` ;
- nuit au-delà de 18 h — rejet, seuil déjà appliqué par `calcSleepDuration` ;
- date illisible ou postérieure à aujourd'hui — journée ignorée ;
- aucune journée reconnue — message explicite (« je n'ai rien pu lire sur cette
  image »), jamais un échec silencieux ;
- toast récapitulatif après écriture, indiquant la plage de dates et le nombre de
  journées remplacées.

Chaque journée reste corrigible à la main par le sélecteur de date déjà en place sur
les deux pages.

## Vie privée

Le choix de la lecture embarquée règle la question à la racine : **l'image ne quitte
jamais l'appareil**, il n'y a aucun sous-traitant à déclarer et aucun appel réseau à
l'usage. C'est la seule option cohérente avec ce que le projet a réellement fait — le
verrou `LEGACY_PDF_IMPORT` sur OCR.space, et le retrait de la vignette YouTube du canal.

Reste à écrire, parce que l'absence de transmission ne se devine pas :

- une phrase dans le cadre lui-même : la capture est lue **sur le téléphone**, elle
  n'est ni envoyée ni conservée ;
- une entrée dans `privacy.html` disant la même chose — un lecteur qui voit « import de
  capture » doit pouvoir vérifier que rien ne part, plutôt que de le supposer.

## Tests

Bac à sable habituel (copie dans le scratchpad, `fetch` vers Firebase / Cloudinary /
PayPal bloqué, Service Worker désactivé) — l'app écrit dans la base de production même
en local.

**Cas de référence :** les deux captures réelles fournies par Kevin, vue 7 jours de
Garmin Connect en français, l'une pour les pas, l'autre pour le sommeil. Attendu :

| Jour | Pas attendus | Nuit attendue |
|---|---|---|
| jeudi 6 août | 4844 | 6 h 35 → 6.6 |
| mercredi 5 août | 3003 | 7 h 10 → 7.2 |
| mardi 4 août | 6242 | 8 h 20 → 8.3 |
| lundi 3 août | 3096 | 6 h 04 → 6.1 |
| dimanche 2 août | 2814 | 7 h 05 → 7.1 |
| samedi 1 août | 4150 | 6 h 19 → 6.3 |
| vendredi 31 juillet | 3546 | 6 h 44 → 6.7 |

Le test doit vérifier explicitement qu'aucun pourcentage (`60 %`) ni score (`79`) n'a
été pris pour une valeur, et que les sept journées portent la bonne date.

**Faisabilité déjà démontrée, avant écriture du plan.** Le moteur embarqué a été passé
sur les deux captures réelles : **14 valeurs sur 14**, dates comprises, aucune erreur,
≈ 1,2 s par image. L'inversion du blanc sur noir s'est révélée inutile — les deux modes
rendent le même texte. C'est ce résultat qui a permis de retenir la lecture embarquée
sans pari.

## Risques connus

- **Poids embarqué.** ≈ 4,1 Mo ajoutés au dépôt, plus la variante non-SIMD de repli.
  Sans chargement paresseux, tous les athlètes le paieraient sans jamais s'en servir :
  c'est le point à ne pas rater à la mise en œuvre.
- **Captures d'autres marques non testées.** L'analyse générique est conçue pour, mais
  seul Garmin Connect est vérifié à ce stade.
- **Langue.** Les mois sont reconnus en français. Une capture en anglais ne sera pas lue.
- **Lecture éprouvée sur ordinateur, pas encore sur téléphone.** Le résultat 14/14 vient
  d'une exécution locale. Le moteur est le même en navigateur, mais la durée sur un
  téléphone d'entrée de gamme reste à mesurer — c'est ce qui décide s'il faut un
  indicateur de progression pendant la lecture.
