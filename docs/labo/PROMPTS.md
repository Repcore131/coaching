# RepCore — Le Labo : les prompts

Colle le **bloc contexte** puis le prompt de la fiche dans une session Claude Code (une idée = une branche).

## Bloc contexte (à coller avant chaque prompt)

```text
Tu travailles dans le dépôt RepCore (github Repcore131/coaching). RÈGLES DU PROJET, à respecter sans exception :
- PWA en JavaScript pur, sans framework ni build applicatif. Balisage : app/index.html (écrans <div id="s-xxx" class="screen">). Logique : app/rc-core.<build>.js (fichier unique très long, le numéro de build change : repère toujours par grep, jamais par numéro de ligne). Correction vidéo : app/motion-lab.js (MediaPipe Pose local). Styles : app/rc-style.<build>.css.
- Données : Firebase Realtime Database en REST via l'objet CLOUD, sous /users/{uid}/… ; règles dans database.rules.json (à mettre à jour pour tout nouveau nœud). Banque d'exercices : nœud /exercices, schéma dans scripts/seed_exercices.py.
- Style : identifiants en français, constantes en MAJUSCULES gelées par Object.freeze, fonctions internes préfixées « _ », rendus renderXxx() qui renvoient du HTML échappé par escapeHtml, navigation par go('s-…'). Commentaires longs en français, sections « // ══ LOT Xn — TITRE ══ », règles signalées par « ⚠ ».
- Toute logique de calcul est une fonction PURE (marquée « PURE » en JSDoc), typée JSDoc (tsc --checkJs doit passer : npx -y -p typescript@5.9 tsc -p tsconfig.json) et testée dans app/tests.js.
- « Aucune valeur inventée » : si une mesure manque ou n'est pas fiable, on le DIT à l'écran, on ne calcule pas dessus. Aucune promesse médicale ou de résultat : on parle de confort, d'amplitude, de variante, jamais de guérison.
- L'athlète voit une consigne simple ; le coach voit le raisonnement et peut toujours outrepasser la suggestion.
- Avant d'écrire du code : lis les modules existants cités, résume ce qu'ils font déjà, et réutilise-les au lieu de dupliquer. Termine par : tests ajoutés, tsc OK, captures des écrans modifiés, et la liste de ce que tu n'as pas fait.
```

## M1 · Les 4 tests de compatibilité filmés

*Morpho · Vague 1 · sources : Lesueur · 5 erreurs morpho-anatomiques · Créer son programme selon son anatomie*

Les livres donnent 4 tests express qui disent en 10 secondes si un exercice de base « va » à la personne : squat (buste > 45° au point bas = pas pour toi), développé couché (avant-bras verticaux et profondeur des coudes), tractions (amplitude naturelle, pas « menton obligatoire »), soulevé de terre (étirement réel des ischios). RepCore mesure déjà tous ces angles dans motion-lab. Il manque le test guidé : une consigne, une vidéo de 3 répétitions, un verdict vert/orange/rouge et la variante proposée, enregistrés comme source « test » de la morpho.

```text
OBJECTIF : créer un parcours « Tests de compatibilité » (4 tests filmés) qui transforme les angles déjà mesurés par motion-lab en verdict d'exercice et en variante proposée.

1. Lis motion-lab.js (ML_ANGLES, mlAnglesPose, mlAnalyserArticulations, mlProportions) et dans rc-core les blocs MORPHO (MORPHO_CONF, morphoAxes, morphoProfils, morphoPourExercice). Résume-les avant d'écrire.
2. Crée une constante gelée TESTS_COMPAT = 4 entrées {cle, lib, schemaVise, vue:'profil'|'face', consigneFilmage, mesure, seuils, variantes}. Valeurs :
   - squat : angle du tronc sur la verticale au point bas (min de hauteur de hanche) ; ≤ 45° vert, 45–55° orange, > 55° rouge → variantes : front squat, hack squat, belt squat, presse, talons surélevés.
   - developpe : au point bas, inclinaison de l'avant-bras sur la verticale ET profondeur du coude sous la ligne des épaules (rapport à la longueur du bras) ; coude très bas → amplitude « humérus parallèle au sol » ou décliné/convergente ; coude haut → incliné.
   - traction : amplitude atteinte sans compensation (épaules qui montent, menton qui avance) → « amplitude naturelle » enregistrée, jamais un échec.
   - souleve : angle de hanche au départ ; si l'étirement des ischios est faible (hanche peu fléchie) → variantes RDL, jambes tendues, hip thrust.
3. Fonction PURE verdictCompat(cle, mesures) → {couleur, valeur, phrase, variantes[], confiance}. Si la visibilité des points est < 0,5 ou s'il y a moins de 2 répétitions valides : couleur 'inconnu' + raison, jamais de verdict inventé.
4. Écran athlète s-tests-compat : 4 cartes (consigne de filmage illustrée, bouton filmer, résultat). Le résultat est enregistré dans /users/{uid}/morpho/tests/{cle} = {date, valeur, couleur, n} avec la source 'test' de MORPHO_CONF, et nourrit morphoAxes.
5. Côté coach : les verdicts apparaissent dans la revue morpho (renderRevueMorphoCoach) avec la valeur brute et un bouton « accepter la variante » qui remplace l'exercice dans le programme.
6. Tests (app/tests.js) : seuils exacts (45,0 → vert, 45,1 → orange), visibilité insuffisante, une seule répétition, valeurs aberrantes. Mets à jour database.rules.json.
Hors périmètre : aucune analyse médicale, aucune modification automatique du programme sans validation du coach.
```

## M4 · Le feu vert / orange / rouge sur chaque exercice

*Morpho · Vague 1 · sources : Lesueur (tableaux développé couché, squat, soulevé de terre) · Delavier · SAEX*

Les livres donnent de vraies matrices de décision : développé couché selon bras courts/longs × cage épaisse/plate, squat selon jambes × buste, soulevé de terre selon bras × jambes × buste. RepCore a 14 profils et leurs aménagements, mais pas ce verdict lisible dans la banque. On affiche un badge vert/orange/rouge sur chaque exercice pour cet athlète, avec la phrase « pourquoi » et la meilleure alternative du même schéma moteur.

```text
OBJECTIF : un verdict de compatibilité par exercice et par athlète, visible dans la banque et dans l'éditeur de programme du coach.

1. Lis schemaDe, SCHEMAS_BRUT, chargeSchema, morphoAxes, morphoProfils, morphoPourExercice. Résume comment un exercice est relié à un schéma moteur.
2. Constante gelée MATRICES_COMPAT, une par exercice de référence :
   - developpe_couche : bras (envergure/taille ≥ 1 = longs) × thorax (profondeur thoracique rapportée à la taille, tertiles) : courts+épaisse = vert ; courts+plate = orange (amplitude réduite) ; longs+épaisse = orange (stop humérus parallèle) ; longs+plate = rouge → décliné, convergente, écarté poulie.
   - squat : jambes (entrejambe/taille) × tronc : courtes+long = vert ; longues+long = orange (cale sous les talons, profondeur limitée) ; longues+court = rouge → hack squat, belt squat.
   - souleve_terre : bras longs + jambes courtes + buste long = vert ; jambes longues + buste court + bras longs = orange ; jambes longues + buste court + bras courts = rouge → départ surélevé, rack pull, variantes jambes tendues.
3. Fonction PURE verdictExercice(ex, axes) → {couleur:'vert'|'orange'|'rouge'|'inconnu', raisons[], reglages[], alternatives[]}. Les alternatives sont cherchées dans la banque (même schéma moteur, ou schéma voisin déclaré), triées par compatibilité. Si un axe nécessaire manque → 'inconnu' + « mesure manquante : … ».
4. Prise en compte des tests filmés (lot M1) : un test filmé l'emporte sur l'inférence par mesures (confiance plus haute).
5. UI : pastille colorée dans s-coach-banque et dans le sélecteur d'exercice ; au survol ou au clic, raisons et alternatives ; dans l'éditeur de programme, un bouton « remplacer par l'alternative ».
6. L'athlète ne voit que le réglage (« descends jusqu'à humérus parallèle au sol »), jamais un « rouge » anxiogène.
7. Tests : chaque case de chaque matrice, axes manquants, priorité test filmé > mesure.
```

## V1 · Cinq nouvelles alertes pour le correcteur vidéo

*Vidéo · Vague 1 · sources : Delavier (cou en extension et plexus brachial, triche au curl, élévations au-dessus de l’horizontale, coudes au développé) · Tractions (kipping) · NPNG (genou qui rentre)*

Le correcteur mesure déjà angles et trajectoires. Les livres listent les erreurs les plus fréquentes et dangereuses, et cinq sont détectables avec MediaPipe : cou en extension (dips, squat, soulevé de terre), balancement du buste au curl, kipping aux tractions, élévations latérales au-dessus de l'horizontale (les trapèzes prennent le relais), genou qui rentre au hip thrust, à la fente et au squat (vue de face). Il faut ajouter la tête (nez, oreilles) aux points suivis.

```text
OBJECTIF : 5 règles de détection d'erreur dans motion-lab, avec messages courts et preuve visuelle sur la vidéo.

1. Lis ML_POSE_IDX, ML_POSE_RANG, ML_ANGLES, mlAnglesPose, mlLisserAngles, mlAnalyser, et le rendu des cartes de correction (lots 5-6).
2. Ajoute les points tête : nez (0) et oreilles (7, 8) à la liste suivie, sans casser les index existants (ajout en fin de tableau + ML_POSE_RANG étendu). Vérifie toutes les boucles qui supposent 14 points.
3. Constante gelée ML_REGLES_ERREURS, chaque règle = {cle, schemas[], vue:'profil'|'face', mesure, seuil, message, gravite} :
   - cou_extension : angle oreille–épaule par rapport à l'axe du tronc ; extension > 20° au-delà du neutre, au point bas des dips, du squat ou du soulevé → « Regard devant, menton neutre ».
   - balancement_curl : variation de l'inclinaison du tronc > 10° pendant la phase concentrique → « Buste immobile ».
   - kipping_traction : oscillation horizontale des hanches > 15 % de la longueur de jambe ou flexion de hanche rythmée → « Jambes gainées, sans élan ».
   - elevation_trop_haute : angle d'épaule (abduction) > 100° aux élévations latérales → « Arrête à l'horizontale ».
   - genou_rentre (vue de face) : distance genou–genou / distance cheville–cheville < 0,8 en phase concentrique → « Pousse les genoux vers l'extérieur ».
4. Fonction PURE detecterErreurs(serie, schema, vue) → [{cle, repetitions[], valeurMax, confiance}] ; confiance nulle si visibilité < 0,5 ou vue incompatible (on ne juge pas le genou de profil).
5. UI : sur la carte de correction, une alerte par règle déclenchée, l'image de la pire répétition avec le segment fautif en rouge, et la consigne. Le coach peut désactiver une règle pour un athlète (exemple : morphologie particulière).
6. Tests : séries synthétiques pour chaque règle (déclenchée, juste sous le seuil, points invisibles, vue incompatible).
```

## N1 · Le mode Ramadan

*Nutrition · Vague 1 · sources : Ramadan by Achzod · Bioénergétique et timing de la nutrition*

Un mois par an, une partie de tes élèves change complètement de rythme, et aucune app ne s'adapte. Le livre donne tout : séance idéale 1 h 30 à 3 h après l'iftar (avant l'iftar déconseillé, 75 min maximum), intensité ≤ 60 % du 1RM, 2 jours d'entraînement puis 1 off ; répartition des macros par repas (iftar, post-séance, collation, sahur), glucides rapides autour de la séance et lipides au sahur, 200 mL d'eau toutes les 30 min, siestes de 30 à 40 min. Un mode activable avec deux horaires.

```text
OBJECTIF : un « mode Ramadan » activable par l'athlète ou le coach, qui adapte nutrition, horaires de séance, hydratation et rappels, puis se désactive seul à la fin.

1. Lis typeDiete, renderNutriAnneaux, planModeleSuggere, protSuggeree, les rappels push (cloudflare/src/push.js, relances.js) et le suivi du sommeil.
2. Données : /users/{uid}/ramadan = {actif, debut, fin, ville ou horaires saisis {iftar, sahur} par jour, heureSeance}. Pas d'appel externe obligatoire : les horaires sont saisis ou importés une fois ; s'ils manquent, on le dit. Mets à jour database.rules.json.
3. Constante gelée RAMADAN_REPARTITION (part des macros du jour par repas) : iftar P25/G30 rapides/L0, post-séance P25/G30 rapides/L15, collation P25/G10 lents/L40, sahur P25/G30/L45 ; protéines ≥ 40 g par repas (avertissement en dessous). Fonction PURE repasRamadan(macrosJour, horaires, heureSeance) → 4 repas horodatés avec cibles.
4. Fonction PURE conseilSeanceRamadan(horaires, heureSeance) → 'ideale' (1 h 30 à 3 h après l'iftar) | 'acceptable' (après le sahur : intensité faible seulement) | 'deconseillee' (avant l'iftar : 75 min max, finir juste avant la rupture). Plafond suggéré d'intensité 60 % de l'e1RM et 8-12 répétitions pendant la période, signalé à chargeSuivante sans écraser la décision du coach.
5. Hydratation : rappels toutes les 30 min entre iftar et sahur (200 mL), objectif affiché ; rappel de sieste 30-40 min (jamais après 60 min, ni proche du coucher).
6. Diète stricte : le plan de repas est recalé sur les 4 repas. Diète flexible : anneaux par repas.
7. Tests : répartition (la somme fait 100 %), séance avant iftar, horaires manquants, fin automatique.
```

## K1 · Le cap suivant : ne jamais perdre un élève à l’objectif atteint

*Coaching · Vague 1 · sources : eBook Coaching VLCoaching (1 client perdu sur 60 en 1 an) · Les secrets du coaching en ligne · BEMOR*

Le moment où l'on perd un élève, c'est souvent… quand il a réussi. Les guides de coaching insistent : proposer un nouveau défi au moment où l'objectif est atteint (fin de sèche → prise de muscle propre → performance), garder un cadre professionnel visible (engagements, délais de réponse 24-48 h) et une reconnaissance personnelle (« jamais un numéro »). RepCore détecte déjà les signaux de départ : il peut aussi détecter la réussite et préparer le cap suivant.

```text
OBJECTIF : détecter « objectif atteint ou presque » et proposer au coach un cap suivant prêt à envoyer, plus un indicateur de réactivité du coach.

1. Lis renderSignauxCoach, renderVerdictCoach, cloudflare/src/retention.js et relances.js, le rite de fin de cycle et la structure des objectifs de l'athlète.
2. Fonction PURE objectifAtteint(objectif, donnees) → {etat:'loin'|'proche'|'atteint', preuves[]} : poids ou tour de taille cible (tendance 7 jours), record visé, nombre de semaines tenues ; preuves chiffrées obligatoires.
3. Constante gelée CAPS_SUIVANTS : seche→recomposition ou prise propre ; prise→mini-sèche ou cycle de force ; force→compétition ou bloc hypertrophie ; remise en forme→défi 28 jours ou premier test de tractions. Chaque cap = {titre, duree, pourquoi, premiereEtape}.
4. Message pré-rédigé pour le coach, personnalisé avec les preuves (« −6,2 kg en 14 semaines, tour de taille −7 cm ») et le cap proposé ; le coach modifie et envoie. Rien n'est envoyé automatiquement.
5. Indicateur de réactivité : délai médian de réponse du coach aux bilans et messages sur 30 jours, objectif < 24-48 h, visible du coach seulement.
6. Bilan hebdomadaire : ajout facultatif « ta fierté de la semaine » et « ton objectif de la semaine prochaine », repris dans la réponse du coach.
7. Tests : détection sur données synthétiques, absence de preuves (état 'loin'), calcul du délai médian.
```

## M2 · « Ton corps en schéma » : le dessin à tes proportions

*Morpho · Vague 2 · sources : Lesueur (figures fémur, squat favorable / défavorable) · Delavier (morphologies A/B au développé)*

Les ebooks expliquent tout par des dessins : deux bonshommes, l'un fémur long buste penché, l'autre fémur court buste droit. RepCore connaît déjà les vraies longueurs de l'athlète. On génère donc son bonhomme, à ses proportions, en bas de squat, au point bas du développé et en haut de traction, avec l'angle calculé géométriquement (comme les schémas de ce document). L'athlète comprend enfin pourquoi on lui donne un hack squat : il le voit sur son propre corps.

```text
OBJECTIF : générer en SVG un schéma personnalisé « ton corps en position » à partir des longueurs morpho de l'athlète.

1. Lis MORPHO_MESURES, longueurSegment, morphoAxes et mlMorphoPhoto. Liste les longueurs réellement disponibles et leur fiabilité.
2. Module PURE schemaCorps(longueurs, pose) → {svg, angles, manquants}. Poses : 'squat' (cuisse parallèle au sol, cheville 30° de flexion, épaules à l'aplomb du milieu du pied : l'inclinaison du buste se déduit de tibia, fémur et tronc), 'developpe' (vue depuis les pieds : barre sur le sternum, avant-bras verticaux, la profondeur du coude sous la ligne d'épaule vient du bras et de l'épaisseur du thorax), 'traction' (position haute selon bras/avant-bras), 'souleve' (bras verticaux, barre au milieu du pied, hanche à l'intersection des cercles tronc/fémur, en gardant la solution derrière l'épaule).
3. Rendu : segments épais à bouts ronds, encre #141416, segment déterminant en rouge #E02020, angle du buste en arc rouge avec sa valeur, ligne pointillée d'aplomb. Fond clair, 700×380, aucune police externe.
4. Comparaison : à côté du schéma de l'athlète, un schéma « proportions moyennes » (rapports ANSUR déjà cités dans le code) pour montrer l'écart.
5. S'il manque une longueur : on ne l'invente pas. On dessine avec la valeur moyenne en gris hachuré et on écrit « mesure manquante : fémur ».
6. Intégration : carte dans le profil morpho athlète et dans la fiche exercice (bouton « pourquoi cet exercice pour moi ? »), et dans l'écran coach de revue morpho.
7. Tests : invariants géométriques (épaule à l'aplomb du milieu du pied ±1 px, longueurs des segments conservées ±0,5 %, angle croissant quand le fémur s'allonge), cas des mesures manquantes.
```

## P1 · Le point faible qui réorganise la semaine

*Programmation · Vague 2 · sources : Lesueur ch. 9-10 (points faibles, splits selon le muscle faible et le muscle dominant)*

Règles claires dans les livres : le muscle faible passe en début de semaine et en début de séance, revient 2 fois par semaine, jamais le lendemain du muscle dominant ; +1 à 2 séries, 1 à 3 exercices ; stress métabolique quelques mois (séries ≥ 20 reps, repos ≤ 1 min 30) ; unilatéral, straps. Le livre donne même les splits 4 et 5 jours pour pecs, épaules, dos, quadriceps faibles. RepCore détecte les plateaux par muscle : il peut proposer la réorganisation.

```text
OBJECTIF : un assistant « point faible » côté coach qui propose une réorganisation de la semaine conforme aux règles, sans rien appliquer sans validation.

1. Lis musclesEnPlateau, plateauxParGroupe, renderPlateauxCoach, le comptage de volume hebdomadaire par muscle et la structure sessions_config des programmes.
2. Entrée : le muscle faible (choisi par le coach, ou suggéré par musclesEnPlateau / asymétrie des mensurations) et le muscle dominant (le plus gros volume ou la plus grosse progression).
3. Fonction PURE propositionPointFaible(programme, faible, dominant, niveau) → {operations[], avertissements[]} où operations = déplacer une séance, réordonner les exercices, ajouter des séries (+1/+2 max), ajouter 1 à 3 exercices compatibles (verdict M4 si disponible), basculer en mode métabolique (fourchette 20+, repos ≤ 90 s) pour une durée en semaines. Règles : faible en début de semaine et en tête de séance, 2 fois par semaine, jamais le lendemain du dominant, dominant associé au groupe faible le moins sollicité.
4. Bibliothèque gelée SPLITS_POINT_FAIBLE : pecs (dominant triceps ou épaules), épaules (dominant triceps, pecs ou dorsaux), dos (dominant biceps ou épaules), quadriceps et ischios (dominant fessiers ou ischios), en 4 et 5 jours, comme modèles de départ.
5. UI coach : depuis la carte plateaux, bouton « plan point faible » → aperçu avant/après de la semaine (diff lisible), cases à cocher par opération, appliquer.
6. Suivi : rappel dans le rite de fin de cycle (28 jours) pour mesurer l'effet (volume, e1RM, mensuration du muscle).
7. Tests : contraintes respectées sur 5 programmes types, aucun ajout au-delà de +2 séries, idempotence.
```

## P4 · Modèles de cycles prêts à prescrire

*Programmation · Vague 2 · sources : Lesueur (cycle linéaire débutant, cycle à repos évolutif, pré/post-fatigue) · SAEX · Chapitre 1 école*

Les livres donnent des cycles complets et chiffrés : linéaire débutant (3×8 → 2×9+1×8 → … → 3×12 puis +2 kg et on recommence), repos évolutif pour l'avancé (5×10 à repos 1 min, la charge monte et le repos s'allonge jusqu'à 3×6 lourd), pré-fatigue pour les petits muscles et post-fatigue pour les gros, avec les paires d'exercices. RepCore suggère la charge série par série ; on ajoute ces modèles de progression comme options du coach.

```text
OBJECTIF : une bibliothèque de modèles de progression que le coach applique à un exercice ; la suggestion de charge suit alors le modèle au lieu de la seule règle RIR.

1. Lis chargeSuivante, SUG_MULTIPLICATEURS, fourchetteReps, la structure sessions_config[].exercises[] et le rite de fin de cycle.
2. Constante gelée MODELES_PROGRESSION :
   - lineaire_debutant : semaines [3×8, 2×9+1×8, 1×10+2×9, 1×11+2×10, 1×12+2×11, 3×12], puis +2 kg (+1 kg isolation) et retour à 3×8 ; repos fixe 90 s ; jamais plus de répétitions que prévu.
   - repos_evolutif : 10 semaines, volume 5×10 → 3×6, charge +2,5 kg/semaine, repos 60 s → 180 s, option deload en S9.
   - double_progression : fourchette (ex. 8-12), on monte la charge quand toutes les séries atteignent le haut de fourchette au RIR cible.
   - pre_fatigue / post_fatigue : paires gelées (oiseau→rowing large, élévations latérales→développé militaire haltères, curl concentré→curl EZ, extension corde→développé prise serrée ; développé→écarté poulie, traction→pull-over, front squat→leg extension, jambes tendues→leg curl).
3. Fonction PURE prescriptionModele(modele, semaine, historique) → {series:[{reps, charge, repos}], phrase}. La charge vient de l'historique réel (e1rm, chargePourReps) ; si aucun historique : « charge à trouver à la première séance ».
4. Intégration : champ exercise.modele dans sessions_config ; dans la séance, la cible du jour s'affiche (« Semaine 3 : 1×10 + 2×9 ») et chargeSuivante respecte le modèle.
5. UI coach : sélecteur de modèle dans l'éditeur, aperçu des 6 ou 10 semaines.
6. Tests : déroulé complet de chaque modèle, semaine ratée, retour à la semaine précédente.
```

## C1 · Test des tractions et arbre de compétences

*Calisthénie · Vague 2 · sources : E-book Performer en tractions en partant de 0 · Kit du street*

Test d'entrée simple : échelle 1, 2, 3… tractions avec 30 s de repos jusqu'à l'échec → débutant ≤ 3, intermédiaire ≤ 10, avancé ≤ 20, à refaire toutes les 4 semaines. Puis un arbre de compétences en 10 étapes, de la suspension au muscle-up, chaque nœud débloqué par un critère mesurable (temps, répétitions propres, lest). C'est un moteur de motivation énorme pour les débutants et un pont naturel avec les rangs et badges de RepCore.

```text
OBJECTIF : test de tractions guidé + arbre de compétences calisthénie relié à l'XP et aux badges.

1. Lis BADGES, RANGS, rangDe, le calcul des Volts (cloudflare/src/xp.js) et le stockage des défis.
2. Test : écran s-test-tractions avec chrono de 30 s entre paliers (1, 2, 3…), saisie de l'échec ; fonction PURE niveauTractions(total) → 'debutant'(≤3) | 'intermediaire'(≤10) | 'avance'(≤20) | 'expert'. Rappel automatique 4 semaines plus tard ; le niveau débloque un programme modèle (3 niveaux, séances A/B/C décrites dans le livre).
3. Arbre : constante gelée ARBRE_TRACTIONS = 10 nœuds {cle, lib, critere:{type:'temps'|'reps'|'lest', valeur, proprete:boolean}, prerequis} : suspension 30 s, scapulaires 3×10, australiennes 3×12, isométries 3 positions 10 s, excentriques 5 s ×5, assistées 4×6, traction propre ×5, lestée +10 kg ×5, traction haute ×3, muscle-up ×1.
4. Validation : par saisie (avec la règle « propre » rappelée) ou par vidéo motion-lab (amplitude et absence de kipping, voir lot V1) ; un nœud validé en vidéo porte un badge « certifié ».
5. Récompenses : Volts par nœud, badge à 5 et à 10 nœuds, carte partageable « Nœud débloqué ».
6. UI : arbre en SVG (nœuds rouges validés, gris à venir), fiche de chaque nœud avec consigne et exercice d'entraînement associé.
7. Tests : niveaux limites, prérequis non remplis, double validation, rétrogradation impossible.
```

## N2 · Le pilote de sèche

*Nutrition · Vague 2 · sources : E-book Pro Sèche · Guides BEMOR · SAEX · NPNG*

Les livres sont d'accord sur les règles : perte de 0,5 à 1 % du poids par semaine (au-delà, le muscle part), ajustement toutes les 2 semaines sur la tendance (pas sur une pesée), déficit qui se creuse surtout par les glucides, en 3 phases de 3 semaines ; en cas de blocage, d'abord le cardio (+1 séance ou +5 min), ensuite −100 kcal ; à l'entraînement, garder les charges et baisser le volume. Le pilote fait ces calculs et propose l'ajustement au coach.

```text
OBJECTIF : un « pilote de sèche » qui surveille la vitesse de perte et propose au coach l'ajustement suivant, avec son raisonnement.

1. Lis le point de départ nutrition, les planchers nutritionnels, protSuggeree, lipSuggere, le stockage des pesées et des bilans, et chargeAigue/chargeChronique.
2. Fonction PURE tendancePoids(pesees) → moyenne mobile 7 jours et pente hebdomadaire en % du poids (régression sur 14 jours) ; si moins de 8 pesées sur 14 jours : « tendance non fiable », aucune proposition.
3. Constante gelée PILOTE_SECHE : perteCible:[0.5,1.0] (%/semaine), periodeAjustementJours:14, phases:3, semainesParPhase:3, pasKcal:100, ordre:['cardio','glucides','lipides'], plancherLipides:0.66 (g/kg), proteines:[1.8,2.2] (g/kg, haut de fourchette si déficit important).
4. Fonction PURE propositionSeche(etat) → {action:'rien'|'cardio_plus'|'baisser_glucides'|'remonter', valeur, phrase, alertes[]} : trop rapide (> 1 %) → remonter de 100-200 kcal par les glucides ; trop lent 2 périodes de suite → cardio d'abord, puis −100 kcal de glucides ; jamais sous les planchers ; alerte « perte musculaire possible » si la force chute en même temps (e1RM en baisse sur 3 séances).
5. Entraînement : pendant la sèche, suggestion de volume −20 à −30 % sur les muscles déjà au-dessus de leur cible, charges conservées (avertissement dans l'éditeur, rien d'automatique).
6. UI coach : carte « pilote » dans la fiche client (graphique tendance, zone cible 0,5-1 %, proposition à valider en un clic, historique des ajustements). Côté athlète : seulement la nouvelle cible et une phrase.
7. Tests : séries de pesées synthétiques (perte trop rapide, plateau, pesées manquantes, bruit d'eau), respect des planchers.
```

## I1 · L’atlas d’illustrations RepCore, généré par le code

*Illustrations · Vague 2 · sources : Figures décrites dans Lesueur (27 schémas) et Delavier (14 planches)*

Les livres sont lisibles grâce à leurs dessins. Plutôt que de les copier (droits d'auteur), on génère nos propres schémas, dans la charte RepCore, avec un moteur géométrique (comme les dessins de ce document) : fémur long ou court au squat, morphologies au développé, envergure, valgus, genoux X/O, bassin, longueurs musculaires, tractions. Chaque schéma est paramétrable : le même code dessine la figure générique de la fiche ET le corps réel de l'athlète (idée M2).

```text
OBJECTIF : un moteur d'illustrations SVG original, en JavaScript pur partagé par l'app et un script de génération, et un premier atlas de 20 schémas.

1. Lis scripts/corps_zones.py, scripts/corps_short.py, le dossier scripts/avatar et la façon dont app/img/corps et app/img/muscles sont utilisés.
2. Crée app/rc-schemas.js (chargé à la demande comme motion-lab) : primitives PURE segment(a,b,epaisseur,couleur), arcAngle, cote (ligne de mesure avec ses deux points), silhouette paramétrique {taille, tronc, femur, tibia, bras, avantBras, epaules, bassin, thorax} et poses calculées (debout face/profil, squat, développé vu des pieds, traction, soulevé, envergure). Charte : encre #141416, accent #E02020, fond #F2F2F4, bouts ronds, aucune police externe.
3. Atlas (constante gelée ATLAS_SCHEMAS, 20 entrées {cle, titre, legende, params, pose}) : fémur court/long au squat, squat favorable/défavorable, développé cage fine-bras longs / cage épaisse-bras courts, humérus parallèle au sol, tractions humérus long/court, soulevé bras longs/courts, envergure vs taille, buste court/long, valgus du coude, genoux valgum/varum, bassin antéversion/rétroversion, cou neutre/en extension, élévations jusqu'à l'horizontale, biceps court/long (espace au pli du coude), mollets courts/longs, triceps longue portion, dorsaux insertion haute/basse.
4. Script scripts/generer_atlas.mjs : exporte l'atlas en SVG et WebP dans app/img/schemas/ pour les fiches exercices et les documents (même code que l'app).
5. Les schémas doivent être géométriquement justes : tests d'invariants (longueurs conservées, aplomb de la barre au-dessus du milieu du pied, angle du buste croissant avec le fémur).
6. Brancher : fiche exercice (« le bon réglage pour toi »), parcours morpho (M1, M3), schéma personnel (M2).
⚠ Aucune reproduction d'un dessin existant : uniquement des constructions géométriques originales.
```

## M3 · Les tests articulaires qui manquent

*Morpho · Vague 3 · sources : Lesueur ch. 4 (valgus du coude, supination, valgum/varum, bassin) · Delavier (valgus, barre EZ)*

Quatre tests posturaux simples changent le choix du matériel et des pieds : valgus du coude (acromion–coude–majeur non alignés → bannir la barre droite), hyper-supination / pronation (barre droite ou EZ en supination), valgum / varum (pas de pieds parallèles si genoux en X), antéversion / rétroversion du bassin (quoi étirer, quoi renforcer en priorité). Aucun n'existe dans RepCore aujourd'hui.

```text
OBJECTIF : ajouter 4 tests articulaires au module morpho et les relier aux consignes d'exercice.

1. Lis MORPHO_MESURES, MORPHO_PROFILS (champs amenager et piege), morphoReglages et morphoPourExercice.
2. Constante gelée MORPHO_TESTS_ARTIC :
   - valgus_coude : photo de face bras le long du corps, paume vers l'avant ; mesure de l'angle acromion–coude–poignet (MediaPipe 11/13/15 et 12/14/16) ; > 15° = marqué. Conséquence : barre droite déconseillée en curl et en tirage supination, proposer EZ ou haltères.
   - rotation_avantbras : test auto-déclaré guidé (pouce tourné vers l'extérieur, ≥ 180° ou non) → hyper-supinateur / neutre / hyper-pronateur. Conséquence : barre droite en supination OK seulement pour l'hyper-supinateur.
   - genoux : photo de face pieds joints ; distance entre genoux et entre malléoles normalisée par la longueur de jambe → valgum / neutre / varum. Conséquence : en valgum, pas d'exercice de cuisses pieds parallèles (pointes légèrement ouvertes).
   - bassin : photo de profil ; inclinaison du segment épine iliaque estimée ou questionnaire guidé → antéversion / neutre / rétroversion. Conséquence : priorités d'étirement et de renforcement affichées (fléchisseurs de hanche ↔ ischios).
3. Fonctions PURE par test → {resultat, valeur, confiance, consequences[]}. Les conséquences sont des objets {exerciceSchema, type:'materiel'|'pieds'|'priorite', texte}. Elles passent par morphoPourExercice pour apparaître dans la consigne d'exécution de l'athlète.
4. Écran : 4 cartes dans le parcours morpho, illustration SVG simple (bras aligné / valgus, genoux X / O), saisie photo ou réponse guidée.
5. Coach : les résultats et leurs conséquences dans la revue morpho, avec possibilité de désactiver une conséquence.
6. Tests : seuils, photo de mauvaise qualité (visibilité < 0,5 → « à refaire »), absence de test (aucune conséquence). Mets à jour database.rules.json.
⚠ Formulation : « confort et choix de matériel », jamais de diagnostic.
```

## M5 · Longueurs musculaires et conflits entre muscles

*Morpho · Vague 3 · sources : Lesueur ch. 3 et 6 (insertions, « compétition » entre muscles, straps)*

Deuxième moitié de la morpho que RepCore n'exploite pas : la longueur des muscles (biceps : test des deux doigts au pli du coude ; mollets : où s'arrêtent les jumeaux ; fessiers, dorsaux, triceps…) et les conflits qui en découlent : triceps long qui vole le développé, biceps long qui vole le tirage (→ straps), épaules qui dominent les pecs. On en tire un « potentiel par muscle » réaliste et des consignes : straps, isolation, amplitude.

```text
OBJECTIF : ajouter les longueurs musculaires observées et un moteur de « conflits » qui ajuste les consignes et les suggestions d'exercices.

1. Lis morphoAxes, MORPHO_PROFILS et le lot photo de bilan (photos de bilan, scripts/mesure_photos_bilan.py).
2. Constante gelée MORPHO_MUSCLES : biceps (test des deux doigts entre avant-bras et biceps contracté, en photo double biceps de face), mollets (hauteur de fin des jumeaux rapportée à la longueur du tibia, photo de dos), fessiers, dorsaux, triceps longue portion, deltoïdes postérieurs, quadriceps (vaste externe). Pour chacun : protocole photo, question guidée de secours, échelle court / moyen / long, et la corrélation connue (biceps long ⇔ avant-bras court ; fessier long ⇔ fémur court ; muscle court ⇔ segment long).
3. Constante gelée CONFLITS : pecs↔épaules, pecs↔triceps, dos↔biceps, dos↔épaules, ischios↔fessiers, quadriceps↔ischios/fessiers. Chaque conflit = condition sur les longueurs + conséquences {straps, isolation_prioritaire, amplitude, ordre_dans_seance}.
4. Fonction PURE conflitsActifs(muscles, axes) → liste ordonnée par impact. Les conséquences enrichissent morphoPourExercice (exemple : « tirages avec straps » quand le biceps est long et le dos est le point faible).
5. Saisie : le coach classe chaque muscle sur photo (3 boutons), l'athlète peut répondre aux questions guidées ; source et confiance enregistrées comme pour les autres axes.
6. Affichage coach : carte « conflits musculaires » dans la fiche client ; affichage athlète : uniquement les consignes concrètes.
7. Tests : chaque conflit déclenché et non déclenché, données partielles.
⚠ Le « potentiel » n'est jamais présenté comme une limite définitive à l'athlète.
```

## M6 · L’amplitude personnelle, affichée et vérifiée

*Morpho · Vague 3 · sources : Lesueur (« la vraie règle » des tractions, stop humérus parallèle) · Delavier (développé nuque, curl pupitre)*

« Amplitude complète » n'est pas une règle universelle : développé couché stoppé humérus parallèle au sol pour un longiligne, développé militaire stoppé mains aux oreilles, tractions dans l'amplitude naturelle, curl pupitre sans tendre complètement. On enregistre une amplitude cible par exercice et par athlète, on l'affiche pendant la séance, et motion-lab vérifie qu'elle est respectée (ni trop court, ni sur-étirement).

```text
OBJECTIF : une amplitude cible personnelle par exercice, saisie par le coach ou proposée par la morpho, affichée en séance et contrôlée en vidéo.

1. Lis l'écran s-coach-amplitudes, les tests d'amplitude M1, et dans motion-lab le lot 12 (perte d'amplitude) et mlAnalyserArticulations.
2. Modèle : /users/{uid}/amplitudes/{slugExercice} = {articulation, angleMin, angleMax, repere:'humerus_parallele'|'mains_oreilles'|'naturelle'|'libre', source:'coach'|'morpho'|'test', date}. Mets à jour database.rules.json.
3. Fonction PURE amplitudeProposee(ex, axes, tests) : développé couché bras longs ou thorax fin → repère humerus_parallele (angle d'épaule) ; développé militaire avant-bras longs ou clavicules courtes → mains_oreilles ; tractions → 'naturelle' issue du test M1 ; curl pupitre → angleMax du coude < 170°. Sinon 'libre'. Toujours une raison en texte.
4. Séance : sous le nom de l'exercice, une ligne courte « Descends jusqu'à : humérus parallèle au sol ». Petit pictogramme SVG du repère.
5. Vidéo : fonction PURE controleAmplitude(serieAngles, cible) → par répétition {ok, ecartDeg, type:'trop_court'|'sur_etirement'}. Résultat affiché sur la carte de correction (lots 5-6) et résumé dans le carnet.
6. Coach : écran d'édition dans s-coach-amplitudes, avec la proposition morpho préremplie et modifiable.
7. Tests : chaque règle de proposition, contrôle avec bruit d'angle (±3°), répétitions partiellement invisibles.
```

## P2 · L’ordonnance de plateau

*Programmation · Vague 3 · sources : Lesueur (fausse / vraie stagnation, repos évolutif, deload) · SAEX (causes de stagnation)*

Les livres distinguent la fausse stagnation (un seul exercice bloque depuis 2-3 semaines : patience) de la vraie (tout bloque) : passer l'exercice principal en fin de séance pendant 3 semaines, puis reprendre 2 à 5 kg en dessous ; ou jouer sur le repos par paliers de 30 s ; deload seulement pour les avancés. RepCore voit déjà les plateaux : il manque la prescription qui va avec, et son suivi.

```text
OBJECTIF : transformer la détection de plateau en « ordonnance » proposée au coach, avec suivi de son effet.

1. Lis musclesEnPlateau, plateauxParGroupe, chargeAigue/chargeChronique, chargeSuivante (décote), le rite de fin de cycle.
2. Fonction PURE typePlateau(historique) → 'aucun' | 'faux' (un seul exercice sans progression d'e1RM ni de répétitions depuis ≥ 2 semaines, les autres progressent) | 'vrai' (≥ 70 % des exercices sans progression depuis ≥ 3 semaines) | 'fatigue' (charge aiguë/chronique élevée + RIR réel plus bas que prescrit). Seuils en constantes gelées et commentées.
3. Constante gelée ORDONNANCES : faux → « patience, rien à changer » ; vrai → exercice principal déplacé en fin de séance pendant 3 semaines puis reprise à −2 à −5 kg (selon l'e1RM) ; option repos +30 s par palier (seulement si ancienneté ≥ 3 ans) ; fatigue → deload (séries −40 % OU charge −15 %, une semaine), réservé à l'intermédiaire/avancé.
4. Fonction PURE appliquerOrdonnance(programme, ordonnance) → nouveau programme + journal des changements (rien n'est modifié en place).
5. UI coach : sur la carte plateaux, l'ordonnance proposée, son explication en une phrase, bouton appliquer / ignorer ; date de réévaluation automatique.
6. Réévaluation : à la date prévue, comparer e1RM et répétitions avant/après et afficher « ordonnance efficace / sans effet ».
7. Tests : historiques synthétiques pour chaque type, ancienneté insuffisante, ordonnance déjà active.
```

## P3 · Les garde-fous d’intensité

*Programmation · Vague 3 · sources : SAEX (2-3 séries à l’échec max) · Lesueur (séries de 100 : 8 règles, répétitions forcées à proscrire) · NPNG (échec à la cible + 1)*

Les sources convergent : 2 à 3 séries à l'échec maximum par séance, techniques avancées (dégressive, superset, rest-pause, partielles) réservées après 2-3 ans, répétitions forcées proscrites, séries de 100 encadrées par 8 règles (un seul muscle, isolation, machine, fin de séance, 4 par semaine maximum, 3 à 6 mois). RepCore sait déjà le RIR saisi : il peut prévenir avant que le coach ou l'athlète n'en fasse trop.

```text
OBJECTIF : des garde-fous d'intensité, informatifs, côté programme (coach) et côté séance (athlète).

1. Lis suggestProtocols, l'écran s-protocoles / s-proto-edit, le stockage du RIR par série et calculerCalibrageRir.
2. Constante gelée GARDE_FOUS : echecMaxParSeance:3, anciennetéMinTechniques:{degressive:2, superset:0, restPause:2, partielles:2, series100:3} (en années), series100:{maxParSemaine:4, dureeMaxSemaines:26, isolationSeulement:true, finDeSeance:true, unMuscleSeulement:true}, repetitionsForcees:'deconseille'.
3. Fonctions PURE : controleProgramme(programme, profil) → avertissements[] (technique avancée avant l'ancienneté requise, plus de 3 séries prescrites à RIR 0, séries de 100 sur un polyarticulaire ou sur deux muscles, etc.) ; controleSeance(seriesFaites) → alerte quand la 3e série à RIR 0 est validée (« garde la suivante à RIR 1-2 »).
4. UI : dans l'éditeur de protocole et de programme, pastille d'avertissement non bloquante avec la règle et la source ; en séance, bandeau discret une seule fois par séance.
5. Méthode « séries de 100 » comme protocole guidé : chrono, rest-pause de 1 à 5 s, compteur jusqu'à 100, enregistrée comme une seule série spéciale (pas d'e1RM calculé dessus : documente pourquoi).
6. Tests : chaque règle, ancienneté inconnue (avertissement neutre), séance sans RIR saisi (aucune alerte inventée).
```

## P5 · Test de 1RM guidé et assistant compétition

*Programmation · Vague 3 · sources : Chapitre 1 école (protocole 1RM) · Kit du street (tentatives, timing d’échauffement)*

Protocole d'école pour tester une charge maximale : 10 à vide, 8 à 50 %, 5 à 70 %, 2 à 80 %, 1 à 90 %, 1 à 95 %, puis tentative, avec repos de 1-2 min puis 3 min. Pour le jour J d'une compétition (street ou force) : ouverture à 85-90 %, 2e essai à 95-100 %, 3e pour le record, dernière barre d'échauffement 7 à 10 min avant le passage. RepCore a la montée en charge pour l'entraînement ; il manque le mode test et le mode compétition.

```text
OBJECTIF : deux modes guidés : « Test de 1RM » et « Jour de compétition ».

1. Lis seriesApproche, MONTEE_POURCENTS, e1rm, e1rmFiable, maxE1rmObserve et les écrans de séance.
2. Test 1RM : constante gelée PROTOCOLE_1RM = [{pct:0,reps:10},{0.5,8},{0.7,5},{0.8,2},{0.9,1},{0.95,1}] + tentatives ; repos 60-120 s jusqu'à 90 %, puis 180 s. La référence est maxE1rmObserve (jamais une valeur inventée ; si aucun historique fiable, demander une estimation à l'athlète et l'écrire comme telle). Tentatives suivantes proposées selon la réussite et la vitesse ressentie (+2,5 / +5 kg). Résultat enregistré comme record « testé » distinct d'un e1RM calculé.
3. Jour de compétition : saisie de l'heure de passage et des disciplines ; fonction PURE planCompetition(meilleur, heurePassage) → {ouverture:85-90 %, deuxieme:95-100 %, troisieme:record, echauffements:[{heure, charge, reps}]} avec la dernière barre 7 à 10 minutes avant le passage. Arrondis aux disques réels (1,25 kg).
4. Minuteur plein écran avec notifications aux bons horaires, check-list du sac (ceinture de lest, magnésie, mousquetons, etc.) modifiable, routine de préparation mentale optionnelle (respiration énergisante, visualisation en 4 temps).
5. Tests : calculs de pourcentages et arrondis, horaires d'échauffement, absence de référence.
```

## C2 · Défis street chronométrés et défi 28 jours

*Calisthénie · Vague 3 · sources : E-book tractions (Demi-BBR, The 100, Pharaon, On the bar) · Kit du street (Special 6, Super10, Death Pyramid) · NPNG #28DaysSummerChallenge*

Des formats de défis tout faits : The 100 (100 dips, 100 tractions, 100 pompes), Pharaon, Demi-BBR, Special 6, Super10, Death Pyramid, en solo, équipe ou battle, au chrono, avec preuve vidéo. Et le défi 28 jours : photo jour 1 et jour 28 avec tampon daté, phases, live hebdo, tirage au sort. RepCore a déjà le moteur de défis et de duels : il manque ces formats prêts à lancer.

```text
OBJECTIF : 7 formats de défis street + un format « défi 28 jours », branchés sur le moteur de défis/duels existant.

1. Lis cloudflare/src/duels.js, saisons.js, xp.js et le code défis de functions/ ; résume le modèle de données d'un défi et d'un score.
2. Constante gelée FORMATS_DEFIS : the100, pharaon, demiBBR, onTheBar, special6, super10, deathPyramid — chacun {etapes[], scoring:'temps'|'reps', regles[], videoRequise:boolean}. Exemple : the100 = 100 dips + 100 tractions + 100 pompes, score = temps, découpage libre.
3. Fonction PURE scoreDefi(format, saisies) → {score, valide, raisons[]} ; validation vidéo optionnelle (règles du lot V1 : amplitude, pas de kipping) qui donne le statut « certifié ».
4. Modes : solo (record personnel), équipe (le chrono s'arrête quand le dernier finit), battle (duel existant).
5. Défi 28 jours : création par le coach (dates, phases, règles), photo J1 et J28 avec tampon daté généré dans l'app (canvas, jamais modifiable ensuite), check-in quotidien, tableau de participation, tirage au sort équitable et vérifiable (graine publiée avant le tirage). Consentement explicite pour toute photo partagée.
6. UI : galerie des formats, chrono plein écran, résultats partageables (carte story), classement.
7. Tests : scoring de chaque format, équipe incomplète, tirage reproductible avec la même graine.
```

## N3 · Le timing autour de la séance

*Nutrition · Vague 3 · sources : Bioénergétique et timing de la nutrition · Pro Sèche · SAEX · BTS DIET*

Trois phases autour de l'entraînement : avant (dernier repas 1 h 30 à 2 h avant, glucides rapides 20-30 min avant si besoin), pendant (eau, électrolytes, glucides si séance longue), après (protéines + glucides dans les 2 h, lipides éloignés de la séance). RepCore connaît l'heure de la séance : il peut placer automatiquement le bon repas au bon moment dans la journée, en diète stricte comme en flexible.

```text
OBJECTIF : une frise « autour de ta séance » générée à partir de l'heure d'entraînement du jour, qui place les repas et les rappels au bon moment.

1. Lis planModeleSuggere, la structure des repas en diète stricte et flexible, calculateSodiumTarget, l'écran s-caffeine et la planification des séances.
2. Constante gelée TIMING_SEANCE : repasAvantMin:90, repasAvantMax:120, collationRapideMin:20, collationRapideMax:30, fenetreApresH:2, lipidesAutourSeance:'faibles', hydratationPendantMl:{parHeure:750}, glucidesIntraSiSeanceMin:75 (20-50 g/h au-delà).
3. Fonction PURE frisePeriSeance(heureSeance, dureeMin, repasDuJour, typeDiete) → [{heure, type:'repas'|'collation'|'eau'|'cafeine', cible, phrase}] ; en diète stricte elle propose de déplacer un repas existant du plan (jamais d'en inventer un) ; en flexible elle indique la part des macros à placer avant et après.
4. Caféine : rappel de la dose et de l'heure limite (lien avec s-caffeine), jamais au-delà de 400 mg/jour.
5. UI : frise horizontale sur l'écran nutrition du jour de séance, notifications optionnelles (1 h 45 avant, 20 min avant, juste après).
6. Tests : séance tôt le matin (pas de repas possible 2 h avant : proposer une collation légère), séance longue, jour sans séance (aucune frise).
```

## F1 · Les grands programmes de force, prêts à charger

*Force · Vague 3 · sources : Méthodologie FA (DEJEPS) · Powerbuild et guides BEMOR · Kit du street*

Ta bibliothèque contient les programmes de force les plus utilisés, chiffrés : 5/3/1 (base 90 % du 1RM, 4 semaines), Sheiko (6×6 à 70 % → 10×3 à 85 %), Smolov (13 semaines), cycle 9 semaines S/B/D, top set + back-off à −10 %, table « % du 1RM par répétitions et RPE ». RepCore calcule déjà l'e1RM et parle en RIR (RPE = 10 − RIR) : on peut générer ces programmes avec les vraies charges de l'athlète.

```text
OBJECTIF : des gabarits de programmes de force générés avec les charges réelles de l'athlète.

1. Lis e1rm, e1rmFiable, chargePourReps, arrondiCharge125, maxE1rmObserve et la structure sessions_config.
2. Constante gelée TABLE_PCT_REPS (RPE 8 et 9) : 1 rep 92,2/95,5 %, 2 → 89,2 %, 3 → 86,3 %, 5 → 81,1 %, 6 → 78,6 %, 7 → 76,2 %, 8 → 73,9 % (compléter en interpolant et le documenter). RPE = 10 − RIR, demi-points autorisés.
3. Constante gelée GABARITS_FORCE :
   - cinq_trois_un : base 0,9 × 1RM ; S1 65/75/85 % ×5+, S2 70/80/90 % ×3+, S3 75/85/95 % ×5/3/1+, S4 40/50/60 % ×5 ; après le cycle +1-2 % (développé couché, militaire), +2-3 % (squat, soulevé de terre).
   - sheiko_bloc : 6×6@70, 7×5@75, 8×4@80, 10×3@85, puis +5-10 kg ; 2 cycles maximum avant une vraie coupure.
   - smolov : 13 semaines (préparation 2, base 4, récupération 2, intensification 4, affûtage 1) ; avertissement fort : avancés uniquement, squat seulement.
   - neuf_semaines_sbd : volume à 80 % puis 5×5@85, 4×4@90, 3×3@95, 2×2@100, 1×1@105 (semaine 9).
   - top_set_backoff : 1 top set au RPE cible, puis N séries à −10 %.
4. Fonction PURE genererGabarit(gabarit, records, semaineDebut) → sessions avec charges arrondies aux disques ; si aucun 1RM fiable : proposer d'abord le test de 1RM guidé (lot P5), ne rien inventer.
5. Les séries « + » (AMRAP) mettent à jour l'e1RM et la base du cycle suivant.
6. UI coach : choisir un gabarit et des exercices, aperçu semaine par semaine, ajustement manuel possible.
7. Tests : calculs de chaque semaine, arrondis, fin de cycle, absence de 1RM.
```

## S1 · Sensation par exercice et routines de mobilité

*Santé · Vague 3 · sources : Training Thérapie (programme Mobilité, Une épaule sans douleur) · Lesueur (« si ça fait mal, ce n’est pas pour toi ») · Delavier*

Règle simple et puissante des programmes de rééducation : une note de sensation sur 10 par exercice ; en dessous de 8/10, on modifie (amplitude, tempo, charge, volume) ; si ça reste sous 8, on remplace pour l'instant. Douleur tolérée ≤ 3/10 si elle disparaît vite et n'est pas pire le lendemain matin. On y ajoute les 8 routines de mobilité ciblées (chevilles, hanches, thoracique, épaules) proposées selon les tests qui coincent.

```text
OBJECTIF : une note de sensation par exercice en fin de série/séance, des règles d'adaptation, et des routines de mobilité proposées selon les profils morpho fonctionnels.

1. Lis renderDouleurCoach et le stockage de la douleur, les profils morpho fonctionnels (cheville verrouillée, hanche à butée précoce, épaule à amplitude limitée, chaîne postérieure raide) et l'écran de fin de séance.
2. Saisie : en fin d'exercice, une échelle 0-10 « sensation » (10 = parfait) et, si douleur, son intensité 0-10 et la zone (réutiliser le modèle douleur existant). Une seule question, facultative, 2 secondes.
3. Fonction PURE regleSensation(historiqueExercice) → 'ok' | 'adapter' (< 8 une fois : proposer amplitude, tempo, charge ou volume) | 'remplacer' (< 8 deux séances de suite : alternative du même schéma, verdict M4 si disponible) | 'alerte' (douleur > 3/10, ou plus forte le lendemain matin selon la question du bilan).
4. Constante gelée ROUTINES_MOBILITE : 8 séances (chevilles/genoux, hanches/lombaires, thoracique/épaules, chevilles/hanches, épaules/genoux, rachis complet, épaules/hanches, chevilles/thoracique), format auto-massage 1-2 min, rotations contrôlées 3-6 répétitions, mise en tension 1 cycle, étirement 2-3 min. La routine proposée dépend du profil fonctionnel actif.
5. UI athlète : la question de sensation, la routine du jour en « séance courte » avec minuteur. UI coach : carte des exercices sous 8/10, propositions à valider.
6. Tests : chaque transition de règle, absence de note (aucune décision), douleur du lendemain.
⚠ Ce n'est pas un outil médical : au-delà de l'alerte, le message oriente vers un professionnel de santé.
```
