# src/core — la source de rc-core, en morceaux

`app/rc-core.<build>.js` (130 000 lignes) n'est plus écrit à la main : il est **assemblé** à partir des
fichiers de ce dossier. Pendant la transition, **les deux sont committés**, et la CI exige qu'ils
concordent.

## La règle de travail

1. **On modifie `src/core/NNN-*.js`, jamais `app/rc-core.<build>.js`.**
2. On assemble : `node scripts/assembler_core.mjs`. `python3 scripts/versionner_actifs.py` le fait
   aussi, en premier geste, avant de renommer les actifs au nouveau build.
3. On committe **les deux** : le morceau modifié et rc-core.

**Les garde-fous :**
- `node scripts/assembler_core.mjs --verifier` sort en 1 si rc-core diffère de l'assemblage. C'est la
  première étape de `.github/workflows/firebase.yml` (déploiement) et de `.github/workflows/suite.yml`
  (chaque push et chaque PR).
- **rc-core modifié à la main** : `assembler_core.mjs`, et donc `versionner_actifs.py`, **refuse de
  l'écraser** s'il est plus récent que tous les morceaux. Deux sorties possibles :
  - reporter la modification dans `src/core/` ;
  - ou tout recouper depuis rc-core : `node scripts/decouper_core.mjs --forcer`. **Attention** : ce
    recoupage peut renuméroter les fichiers.

## Le format

- **L'assemblage** : chaque morceau perd son saut de ligne final, les morceaux sont joints par un saut
  de ligne, et un saut de ligne termine le tout. Garantie :
  `assembler(decouper(rc-core)) === rc-core`, octet pour octet, vérifiée par `decouper_core.mjs` à
  chaque découpe.
- **Les coupes** tombent sur un bandeau de section en colonne 0 (`// ══ TITRE ══…`), et seulement
  entre deux instructions de niveau racine : l'AST (acorn) le vérifie. Chaque morceau est donc un
  programme JavaScript complet, qui se parse seul.
- **Une seule coupe de secours**, `027-l-ecran.js`, tombe sur un sous-bandeau `// ── TITRE ──`.
  L'analyse morpho-anatomique fait 4 883 lignes sans un seul bandeau `═`.
- **Les fichiers** sont en LF, comme rc-core (voir `scripts/versionner_actifs.py`, « LES FICHIERS
  EXTRAITS, EUX, SONT EN LF »).

## L'ordre de chargement

Les morceaux sont chargés **dans l'ordre de leur numéro**, en **une seule portée globale** (un script
classique, pas un module). Les `onclick="nom()"` d'`app/index.html` et les chaînes `innerHTML`
appellent les fonctions par leur nom : elles doivent rester globales.

### La règle d'ordre

> **Un fichier ne peut utiliser, à son niveau racine (hors des corps de fonction), que des
> déclarations de fichiers de numéro inférieur** (ou du sien, plus haut).

Dans un corps de fonction, tout est permis : la fonction s'exécute après le chargement complet.

Aujourd'hui, une `function` déclarée plus loin est **hissée**, parce que tout est recollé en un seul
script : l'appeler plus haut marche. Mais deux choses cassent :
- dès qu'un morceau part dans **son propre `<script>`** (étape (c)), cet appel ne marche plus ;
- une `const`, une `let` ou une `class` lue avant sa ligne **casse déjà** : elle est en « zone morte
  temporelle » et lève une ReferenceError.

`node scripts/verif/ordre-core.mjs` (`--strict` pour sortir en 1) relève ces lectures. Il parcourt les
instructions racine sans entrer dans les corps de fonction, sauf une fonction appelée sur place.

**État au découpage (build 1764) : 1 écart, et c'est un bug.**
- `004-…js:518` : `importFromURL`, qui s'exécute au chargement, appelle `_armerMarqueurOuverture`
  (déclarée dans `054-…js`) sur un lien `?inv=`.
- Cette fonction lit `let _invMarqueurArme`, encore en zone morte : une ReferenceError est levée, puis
  avalée par le `catch(e){}` d'`importFromURL`.
- **Conséquences**, sur tout lien d'invitation :
  - le marqueur « ouvert » ne s'arme jamais ;
  - le reste du lien n'est pas lu : `s`, `wo`, `bilan`, `ref`, `amb`, `src`, `coach`, etc.
- **Vérifié dans Chromium** : `?inv=ABCDEF12&wo=1` laisse `_pendingWoOpen` à `undefined`, alors que
  `?wo=1` seul le met à `true`.
- **Pas corrigé à l'étape (a)**, qui ne change pas le code produit.

### Les morceaux

| fichier | lignes | premier bandeau |
|---|---|---|
| `001-debut.js` | 1659 | (le début du fichier : politique de confidentialité, boutique, serveur léger, tarifs…) |
| `002-l-essai-athlete-symetrique-de-la-promesse-coach.js` | 2207 | L'ESSAI ATHLETE, SYMETRIQUE DE LA PROMESSE COACH |
| `003-les-textes-libres-bornes-comme-la-regle-les.js` | 2648 | LES TEXTES LIBRES, BORNES COMME LA REGLE LES BORNE (01/10/2026) |
| `004-n3-4-un-tableau-a-trou-revient-de-firebase-en.js` | 2253 | N3.4 — UN TABLEAU A TROU REVIENT DE FIREBASE EN OBJET |
| `005-les-droits-viennent-du-serveur-build-1425-lot-0.js` | 2155 | LES DROITS VIENNENT DU SERVEUR (build 1425, lot 0) |
| `006-la-foudre-rcfoudre-cible-options.js` | 2150 | LA FOUDRE — rcFoudre(cible, options) |
| `007-le-code-coach-en-attente-sans-bloquer-si-le.js` | 2429 | LE CODE COACH EN ATTENTE, SANS BLOQUER SI LE STOCKAGE EST PLEIN |
| `008-morpho-lot-m1-six-mesures-quatre-tests.js` | 2565 | MORPHO — LOT M1 : SIX MESURES, QUATRE TESTS |
| `009-les-traitements-cote-coach.js` | 2478 | LES TRAITEMENTS, COTE COACH |
| `010-le-lien-perso-et-les-pages-publiques.js` | 2331 | LE LIEN PERSO ET LES PAGES PUBLIQUES |
| `011-deposer-un-evenement-pour-le-serveur-leger.js` | 2552 | DÉPOSER UN ÉVÉNEMENT POUR LE SERVEUR LÉGER |
| `012-le-carnet-d-adresses.js` | 2371 | LE CARNET D'ADRESSES |
| `013-la-messagerie-coach-athlete-lot-m2-30-09-2026.js` | 2232 | LA MESSAGERIE COACH ↔ ATHLÈTE (lot M2, 30/09/2026) |
| `014-les-acces-qui-arrivent-a-terme-par-mois.js` | 2305 | LES ACCES QUI ARRIVENT A TERME, PAR MOIS |
| `015-un-souci-trois-canaux-et-l-athlete-choisit.js` | 2463 | « UN SOUCI ? » : TROIS CANAUX, ET L'ATHLETE CHOISIT |
| `016-classification-musculaire-des-exercices.js` | 2410 | CLASSIFICATION MUSCULAIRE DES EXERCICES |
| `017-la-fiche-de-vente-d-un-modele-du-coach.js` | 2402 | LA FICHE DE VENTE D'UN MODELE DU COACH |
| `018-import-pdf-ocr-deprecie.js` | 2331 | IMPORT PDF / OCR — DÉPRÉCIÉ |
| `019-r30-le-son-propose-au-premier-repos-de-la-seance.js` | 2012 | R30 — LE SON, PROPOSE AU PREMIER REPOS DE LA SEANCE |
| `020-phrase-du-jour.js` | 2439 | PHRASE DU JOUR |
| `021-alterner-deux-creneaux.js` | 2372 | ALTERNER DEUX CRENEAUX |
| `022-le-qr-du-pied-de-carte.js` | 2484 | LE QR DU PIED DE CARTE |
| `023-supersets.js` | 2402 | SUPERSETS |
| `024-la-fin-par-suivant-30-09-2026.js` | 2226 | LA FIN PAR « SUIVANT » (30/09/2026) |
| `025-les-trois-graphiques-du-cadre-corps.js` | 2655 | LES TROIS GRAPHIQUES DU CADRE CORPS |
| `026-analyse-morpho-anatomique-la-maquette-de-kevin.js` | 2493 | ANALYSE MORPHO-ANATOMIQUE — LA MAQUETTE DE KEVIN (24/09/2026) |
| `027-l-ecran.js` | 2390 | L'ÉCRAN |
| `028-ce-qui-bloque-range-par-groupe-musculaire.js` | 2380 | CE QUI BLOQUE, RANGE PAR GROUPE MUSCULAIRE |
| `029-indice-de-forme-declaree.js` | 2315 | INDICE DE FORME DÉCLARÉE |
| `030-la-fiche-alimentaire-imprimable.js` | 2384 | LA FICHE ALIMENTAIRE IMPRIMABLE |
| `031-l-entree-athlete-lot-3.js` | 2341 | L'ENTREE ATHLETE (lot 3) |
| `032-le-bloc-de-priorite.js` | 2439 | LE BLOC DE PRIORITE |
| `033-e1-des-photos-de-bilan-exploitables-des-l-envoi.js` | 2391 | E1 — DES PHOTOS DE BILAN EXPLOITABLES DÈS L'ENVOI |
| `034-reponse-du-coach-au-bilan.js` | 2298 | RÉPONSE DU COACH AU BILAN |
| `035-le-push-serveur-web-push-vapid.js` | 2450 | LE PUSH SERVEUR (Web Push, VAPID) |
| `036-le-carrousel-pour-le-fil-les-cinq-slides-en-4-5.js` | 2422 | LE CARROUSEL POUR LE FIL : les cinq slides en 4:5, en une fois |
| `037-la-carte-d-athlete-28-09-2026.js` | 2497 | LA CARTE D'ATHLÈTE (28/09/2026) |
| `038-b2-6-les-raccourcis-se-voient.js` | 2517 | B2.6 — LES RACCOURCIS SE VOIENT |
| `039-plancher-proteique-par-prise.js` | 2383 | PLANCHER PROTÉIQUE PAR PRISE |
| `040-n2-6-un-seul-poids-de-reference-nutritionnel.js` | 2356 | N2.6 — UN SEUL POIDS DE REFERENCE NUTRITIONNEL |
| `041-diete-stricte-composition-cote-coach.js` | 2607 | DIÈTE STRICTE : COMPOSITION, CÔTÉ COACH |
| `042-meal-prep-et-recette.js` | 2244 | MEAL PREP ET RECETTE |
| `043-aliments-perso.js` | 2160 | ALIMENTS PERSO |
| `044-le-moteur-du-tableur.js` | 2146 | LE MOTEUR DU TABLEUR |
| `045-les-cartes-des-calculs-alimentaires-build-1403.js` | 2300 | LES CARTES DES CALCULS ALIMENTAIRES (build 1403) |
| `046-les-evictions-alimentaires.js` | 2172 | LES EVICTIONS ALIMENTAIRES |
| `047-lot-t6-les-amplitudes-ressortent-29-09-2026.js` | 2404 | LOT T6 : LES AMPLITUDES RESSORTENT (29/09/2026) |
| `048-l-envoi-qui-se-voit.js` | 2503 | L'ENVOI QUI SE VOIT |
| `049-les-reperes-de-la-correction-30-09-2026.js` | 2364 | LES REPERES DE LA CORRECTION (30/09/2026) |
| `050-ajustement-propose-la-vitesse-contre-la.js` | 2318 | AJUSTEMENT PROPOSÉ : LA VITESSE CONTRE LA FOURCHETTE |
| `051-deficit-energetique-des-faits-jamais-un.js` | 2496 | DÉFICIT ÉNERGÉTIQUE : DES FAITS, JAMAIS UN DIAGNOSTIC |
| `052-les-cartes-pas-et-sommeil-d-apres-les-maquettes.js` | 2490 | LES CARTES PAS ET SOMMEIL, D'APRES LES MAQUETTES DE KEVIN |
| `053-l-estimation-du-maximum-ne-depend-plus-d-aucune.js` | 2598 | L'ESTIMATION DU MAXIMUM NE DÉPEND PLUS D'AUCUNE PHASE |
| `054-decoder-l-image-avant-de-la-redimensionner.js` | 2317 | DECODER L'IMAGE AVANT DE LA REDIMENSIONNER |
| `055-etat-d-une-invitation.js` | 2339 | ÉTAT D'UNE INVITATION |

La liste fait foi dans `ls src/core/`. Ce tableau est celui de la découpe du build 1764.

## Les étapes suivantes (TODO)

1. **(a) Découper sans changer le code produit** — *fait (build 1764)* :
   - `scripts/decouper_core.mjs` et `scripts/assembler_core.mjs` ;
   - l'assemblage branché dans `versionner_actifs.py`, `firebase.yml` et `suite.yml` ;
   - ce fichier.
2. **(b) Sortir les grosses données vers `app/data/*.json`**, chargées à la demande avec le même motif
   que `_loadCiqual` (`041-…js`) :
   - `WO_ZONES` (`023-supersets.js`) ;
   - `BPOSE` et `BPOSE_F` (`032-le-bloc-de-priorite.js`) ;
   - `MORPHO_PROFILS` (`008-morpho-lot-m1-six-mesures-quatre-tests.js`) ;
   - `EX_VIDEOS` (`016-classification-musculaire-des-exercices.js`).

   Chaque lecteur doit alors attendre la donnée, ou se rabattre proprement tant qu'elle n'est pas là.
   Les fichiers JSON vont dans `ASSETS` (`sw.js`) et dans `scripts/fabriquer_site.mjs` (copiés avec `app/`).
3. **(c) Produire `app/rc-coach.<build>.js`** : `openClientDetail`, `renderClientList`,
   `_htmlTableauxTableur`, `canal*`, `relance*`, `ccd*`…
   - Il est chargé par un `chargerCoach()` au premier `go('s-coach-*')`, sur le modèle de
     `chargerMotionLab()`.
   - Des stubs globaux attendent le chargement, puis rappellent la vraie fonction.
   - **Préalable** : `ordre-core.mjs --strict` à 0 écart sur les morceaux concernés.
   - `versionner_actifs.py`, `sw.js` (`ASSETS`), `actifs.mjs`, `minifier.mjs` et `chargerTests`
     (source lue par `tests.js`) doivent connaître le nouveau fichier.
4. **(d) Supprimer les 53 fonctions sans référence.** La liste est à **régénérer par script**, pas à
   recopier : un nom de fonction présent **une seule fois** dans l'ensemble formé par rc-core,
   `app/index.html`, `app/motion-lab.js`, `app/sw.js` et `app/vendor/rc-video.js`.
   - Vérifier aussi `app/tests.js` : une fonction testée n'est pas morte pour autant, mais le test
     tombera avec elle.
   - Puis vérifier `lint.mjs`, `syntaxe.mjs` et la suite.
