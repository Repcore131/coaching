# Canal du coach — conception

**Date :** 2026-08-06
**Fichier applicatif :** `app/index.html`
**Règles :** `database.rules.json`

## Le besoin

Le coach veut un endroit où poser des messages destinés à tous ses athlètes à la
fois : liens vers ses publications sur les réseaux, informations pratiques,
formations vidéo, documents annexes, annonces générales. Le modèle mental
donné est celui des **canaux Instagram** : le coach parle, les abonnés lisent
et réagissent, ils n'écrivent pas.

## Ce qui existe déjà, et pourquoi ça ne suffit pas

**« Mot du coach »** (`app/index.html`, section `ANNONCE_*`) pose une bannière
sur l'accueil de l'athlète. Quatre limites le disqualifient comme base :

1. **280 caractères, texte seul.** Ni lien, ni titre, ni vignette.
2. **Aucun historique.** Un mot chasse le précédent, volontairement.
3. **Diffusion par recopie.** Le message est écrit dans le dossier de chaque
   athlète, un par un. Les athlètes connus par leur seul code, qui n'ont pas de
   dossier sur l'appareil du coach, ne le reçoivent jamais — le code le signale
   d'ailleurs à l'écran.
4. **Coût de bande passante.** Chaque sauvegarde d'un dossier athlète le relit
   et le réécrit **en entier**. Y loger un fil de messages, c'est le faire
   voyager à chaque séance enregistrée.

Le point 4 est décisif : le plafond du plan Spark n'est pas un nombre
d'utilisateurs, c'est un **volume de 10 Go par mois**.

## Décisions

| Question | Décision |
|---|---|
| Sens du fil | **Diffusion seule + réactions emoji.** L'athlète n'a pas de champ de saisie. |
| Emplacement | **7e onglet « Canal »** (icône `bell`), qui **absorbe** le « Mot du coach ». |
| Contenu d'un message | Titre, texte, **un** lien optionnel avec vignette. **Aucun fichier hébergé.** |
| Compteurs de réactions | **Publics**, comme sur Instagram. |
| Sans coach référent | Onglet **visible mais grisé**, verrouillé. |
| Portée | Un canal **par coach**. Pas de canal RepCore global. |

## Expérience — athlète

Fil vertical, du plus récent au plus ancien, 20 messages chargés. Chaque carte
porte une date relative, un titre optionnel, le texte (retours à la ligne
conservés), et si un lien est présent une carte cliquable qui ouvre le
navigateur hors de l'app.

**Vignette — la limite est réelle.** Sans serveur, le navigateur ne peut pas
lire les balises Open Graph d'une page distante : RepCore ne peut donc afficher
ni le titre ni l'image d'un lien Instagram, Drive ou d'un site quelconque. Seul
YouTube fait exception, son image se déduisant de l'identifiant. La carte montre
donc **le domaine**, et une vignette pour les seuls liens YouTube. Pour tout le
reste, inventer une vignette serait mentir.

**Conséquence de confidentialité, à connaître.** Cette vignette est chargée
depuis `img.youtube.com` : ouvrir l'onglet Canal transmet alors l'adresse IP de
l'athlète à Google, **sans qu'il ait rien touché**. C'est le seul appel
automatique à un tiers ajouté par ce lot, dans un projet qui a par ailleurs
banni tous ses CDN. `privacy.html` a été corrigé en conséquence — il affirmait
jusqu'ici que YouTube n'était contacté que « si vous ouvrez une de ces vidéos »,
ce qui n'est plus vrai. Retirer la vignette supprimerait cet appel : c'est une
ligne à enlever, si le choix se révèle indésirable.

Sous chaque message, quatre emojis — 👍 ❤️ 💪 🔥 — chacun avec son compteur
public. Un tap pose la réaction, un second la retire, un tap sur un autre emoji
la déplace.

Le message **épinglé** reste en tête du fil, et c'est lui — et lui seul — qui
s'affiche en bannière sur l'accueil.

**Pastille de non-lu.** Elle s'allume quand un message est plus récent que la
dernière visite. La dernière visite est mémorisée **sur l'appareil**
(`localStorage`), jamais dans le dossier. C'est le raisonnement déjà retenu pour
`rc_annonce_lue` : le coach ne peut pas voir qui a lu, et ne peut pas
ressusciter une pastille en réécrivant un dossier périmé par-dessus. Contrepartie
assumée, identique à l'existant : sur un appareil neuf, le fil apparaît une fois
comme non lu.

### Athlète sans coach référent

L'onglet reste **visible et grisé**, cadenas à la place de la pastille. Un tap
n'ouvre pas le fil : il ouvre une carte courte — « Le canal est réservé aux
athlètes suivis. Entre ton code coach pour y accéder. » — et un bouton vers
`s-client-code`, la même porte que l'accueil propose déjà via
`_renderCoachBanner` quand aucun coach n'est rattaché.

Le rendre visible plutôt que le masquer est un choix délibéré : l'athlète
autonome voit ce qu'il n'a pas.

**Le gris n'est pas la protection.** La serrure est la règle Firebase : sans
`coachEmailKey`, la lecture du canal renvoie 401. Modifier le HTML ne donne
rien. Le bouton reste atteignable au clavier avec `aria-disabled="true"`, et non
l'attribut `disabled` qui le sortirait du parcours sans annoncer de raison.

**Effet de bord assumé :** un athlète détaché de son coach voit l'onglet
regriser et le fil disparaître à la prochaine ouverture. Aucune copie locale
n'est conservée.

## Expérience — coach

Une carte « Canal » dans les réglages coach, à l'emplacement du « Mot à
l'accueil » actuel. Elle ouvre le fil vu du coach :

- **Nouveau message** : titre, texte, lien optionnel, case « épingler à
  l'accueil » ;
- sous chaque message, le décompte par emoji **et la liste des prénoms** ;
  le coach seul voit les prénoms ;
- **modifier** et **supprimer** un message ;
- **un seul message épinglé à la fois.** Épingler le nouveau dépingle l'ancien.
  C'est la règle que le code défend déjà : deux bannières empilées sur
  l'accueil, personne ne les lit.

**Ce qui n'est pas promis :** le téléphone ne sonnera pas. Sur le plan Spark,
aucune Cloud Function ne tourne et rien ne s'abonne au push. Un message se
découvre à l'ouverture de l'app. L'écran coach le dit, comme le fait déjà celui
du « Mot à l'accueil ».

## Architecture

```
/canaux/{coachEmailKey}/
  messages/{msgId}                  { at, titre, texte, lien, epingle }
  compteurs/{msgId}/{emoji}         → un entier, LISIBLE PAR TOUS
  reactions/{msgId}/{athleteKey}    → l'emoji, LISIBLE PAR SON AUTEUR ET LE COACH
```

### Pourquoi un nœud dédié, et pas `coach_public`

`coach_public` porte déjà la photo, la team, la phrase et les bannières, et il
est **retéléchargé en entier à chaque ouverture de l'accueil**
(`CLOUD.pullProfilCoach`). Y loger le fil ferait descendre tous les messages à
chaque lancement de l'app, y compris quand personne n'ouvre le canal.

`/canaux` n'est lu que quand l'onglet s'ouvre. Sur un plafond qui est un volume
mensuel, c'est la différence entre tenir et ne pas tenir.

### Pourquoi `compteurs` et `reactions` sont séparés

C'est ce qui donne les compteurs publics d'Instagram **sans exposer qui est
qui**. Si le détail nominatif était lisible par tous, chaque athlète
apprendrait l'existence et l'identifiant des autres — ce que RepCore n'a jamais
fait. Le compteur public est un nombre nu ; le détail vit à côté, fermé.

### Règles

- **`messages`** — lecture : le coach, ou un athlète dont le `coachEmailKey`
  vaut `{coachEmailKey}` (même test que `coach_public`). Écriture : le coach
  seul. Champs en liste blanche, longueurs bornées, `"$autre": false`.
- **`compteurs`** — lecture : les mêmes. Écriture par un athlète rattaché
  **bornée à ±1**, via l'incrément serveur `{".sv":{"increment":1}}` et un
  `.validate` qui exige `newData.val() === data.val() + 1 ||
  newData.val() === data.val() - 1`. Le coach peut écrire n'importe quelle
  valeur : c'est ce qui lui permet de resynchroniser un compteur dérivé.
- **`reactions/{msgId}/{athleteKey}`** — lecture et écriture réservées à cet
  athlète ; lecture ouverte aussi au coach. Un athlète ne peut ni lire ni
  écrire la réaction d'un autre.

### Ce que ça n'empêche pas

Un athlète rattaché qui sait appeler l'URL peut gonfler un compteur en le
poussant +1 en boucle. C'est le compromis déjà assumé et documenté pour
`/metrics` et `/coachs_libres`. Le gain de l'attaque est nul et son auteur est
authentifié.

**Dérive.** Si un téléphone lâche entre l'écriture de la réaction et celle du
compteur, les deux divergent. L'écran coach affiche le décompte **vrai**,
calculé depuis `reactions`, et propose « resynchroniser » quand il diffère du
compteur public.

## Sort du « Mot du coach »

Absorbé, pas conservé en double :

- les fonctions `ANNONCE_*`, `openAnnonce`, `envoyerAnnonce`, `retirerAnnonce`
  et leur bannière sont supprimées ;
- `#clh-annonce` reste, mais affiche désormais **le message épinglé du canal** ;
- le champ `annonce` déjà présent dans les dossiers devient inerte, sans
  migration — même traitement que `welcomeAudio` lors du retrait du message
  vocal.

Trois défauts disparaissent au passage : les athlètes connus par leur seul code
reçoivent enfin les annonces, l'historique cesse d'être perdu, et le message ne
voyage plus dans chaque dossier.

## Livraison

1. Règles Firebase et déploiement (`npx firebase-tools deploy --only database`),
   vérifiables avant toute interface.
2. Écran coach : écrire, épingler, supprimer.
3. Onglet athlète : fil, état verrouillé, pastille de non-lu.
4. Réactions et compteurs.
5. Bascule de la bannière d'accueil sur le message épinglé, puis retrait du
   code `annonce`.

**Barre d'onglets — mesuré, pas estimé.** Sept onglets à 11 px réclament
**406 px** : la barre débordait donc sur 375 px *et* 390 px, c'est-à-dire sur la
majorité des iPhone, et pas seulement sur les très petits écrans comme le
laissait croire le seuil de 340 px. Trois réglages ont été mesurés sur un clone
non contraint, police chargée :

| Réglage | Largeur nécessaire | Tient à partir de |
|---|---|---|
| 11 px / 3 px (l'existant) | 406 px | 412 px |
| 10,5 px / 2 px | 375 px | 375 px, sans marge |
| **10 px / 2 px (retenu)** | **359 px** | **360 px** |

Retenu : 10 px / 2 px sous 420 px, et défilement sous 360 px (le seuil passe de
340 à 359 px). **Les sept libellés restent entiers.** L'alternative — garder
11 px en abrégeant « Évolution » en « Évol » (355 px) — a été écartée : une
police rapetissée se corrige, un onglet renommé désoriente un athlète qui
l'utilise depuis des mois. La contrepartie est réelle et assumée : 1 px de
police en moins sur tous les onglets, pour tous les écrans sous 420 px.

**Tests.** En bac à sable : copie du dépôt dans le scratchpad, `fetch` vers
Firebase et Cloudinary neutralisé, comptes semés directement en `localStorage`.
L'app écrit dans la base des clients payants même lancée en local.

## Hors périmètre

- Toute écriture d'un athlète dans le fil.
- L'hébergement de fichiers (PDF, vidéo) — les documents restent sur Drive et
  arrivent par lien.
- Les notifications système. Elles demandent une Cloud Function, donc le plan
  Blaze.
- Un canal RepCore global, commun à tous les coachs.
- Les accusés de lecture. Seule la réaction, qui est un geste délibéré, remonte
  au coach.
