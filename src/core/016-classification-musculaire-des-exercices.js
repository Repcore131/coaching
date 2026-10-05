// ══════════════ CLASSIFICATION MUSCULAIRE DES EXERCICES ══════════════
// Couche d'identité posée PAR-DESSUS les noms d'exercices, sans rien migrer :
// aucune donnée existante n'est réécrite, aucun exercice n'est renommé.
// La clé de jointure physique de l'historique reste le nom en clair dans
// sessions[n].data ; on ajoute seulement une résolution par-dessus.
//
// 17 groupes. Le brief en prévoyait 14 ; LOMBAIRES, ABDUCTEURS et ADDUCTEURS
// ont été ajoutés parce que le guide d'exercices les distingue réellement
// (11 exercices lombaires, 6 abducteurs/adducteurs) et qu'aucun des 14 ne
// pouvait les recevoir sans mentir sur le muscle travaillé.
const MUSCLES={
  PECTORAUX :{lib:'Pectoraux',    c:'#e05050'},
  DORSAUX   :{lib:'Dorsaux',      c:'#3b82f6'},
  // ⚠ DEUX TRAPEZES, ET NON UN. Demande de Kevin, 08/09/2026 : « c'est assez
  // different ». Il a raison, et le guide le montre — les deux portions ne
  // font pas le meme geste et ne se travaillent pas aux memes exercices :
  //   · SUPERIEUR : il ELEVE l'omoplate. Shrugs, portes lourds, arraches.
  //   · MOYEN     : il RETRACTE l'omoplate. Rowings, face pulls, oiseaux.
  // Confondus, ils donnaient un volume unique ou un athlete qui ne fait que
  // des rowings paraissait avoir « assez de trapezes » sans avoir jamais
  // eleve une omoplate — et l'inverse pour qui n'empile que des shrugs.
  // LES NOMS EN ENTIER (Kevin, 27/09/2026 : « je ne veux plus de juste
  // trapèze ») : « médian », le mot de sa planche, et non « moy. ».
  TRAP_SUP  :{lib:'Trapèze supérieur', c:'#60a5fa'},
  TRAP_MED  :{lib:'Trapèze médian', c:'#93c5fd'},
  LOMBAIRES :{lib:'Lombaires',    c:'#1d4ed8'},
  DELT_ANT  :{lib:'Deltoïde ant.',c:'#f59e0b'},
  DELT_LAT  :{lib:'Deltoïde lat.',c:'#fbbf24'},
  DELT_POST :{lib:'Deltoïde post.',c:'#d97706'},
  BICEPS    :{lib:'Biceps',       c:'#a855f7'},
  TRICEPS   :{lib:'Triceps',      c:'#8b5cf6'},
  AVANT_BRAS:{lib:'Avant-bras',   c:'#c084fc'},
  QUADRICEPS:{lib:'Quadriceps',   c:'#22c55e'},
  ISCHIOS   :{lib:'Ischios',      c:'#16a34a'},
  FESSIERS  :{lib:'Fessiers',     c:'#4ade80'},
  ABDUCTEURS:{lib:'Abducteurs',   c:'#65a30d'},
  ADDUCTEURS:{lib:'Adducteurs',   c:'#84cc16'},
  MOLLETS   :{lib:'Mollets',      c:'#14b8a6'},
  ABDOS     :{lib:'Abdominaux',   c:'#f97316'}
};
// ══════════════ VOLUME D'ENTRAÎNEMENT : SÉRIES DURES ══════════════
// Une « série dure » n'est pas une série : c'est une unité de stimulus. Deux
// pondérations la ramènent à une valeur comparable d'un exercice à l'autre.

// Intensité. Au-delà de RIR 4 la série n'apporte plus grand-chose au stimulus
// hypertrophique ; à RIR 5 on ne la compte plus du tout. Ce sont des paliers de
// terrain, pas une fonction continue mesurée.
const POIDS_RIR=Object.freeze({echec:1, '0':1, '1':1, '2':1, '3':1, '4':0.5, '5':0});
// Rôle du muscle dans l'exercice. Un secondaire reçoit un stimulus réel mais
// moindre : on le compte une demi-série.
const POIDS_ROLE=Object.freeze({PRIMAIRE:1, SECONDAIRE:0.5, AUCUN:0});
// « COMPTER LE TRAVAIL INDIRECT » (réglage du coach, sur le dossier de
// l'athlète : user.reperesComptage). 'fractionne' par défaut : un muscle
// secondaire compte une demi-série. 'direct' : il ne compte pas, pour se
// comparer honnêtement aux repères RP, écrits en séries directes.
const REPERES_COMPTAGES=Object.freeze(['fractionne','direct']);
function reperesComptageDe(user){ return (user&&user.reperesComptage==='direct')?'direct':'fractionne'; }
function poidsSecondaire(user){ return reperesComptageDe(user)==='direct'?0:POIDS_ROLE.SECONDAIRE; }
// RIR non renseigné : la série est comptée pleine, et la semaine est signalée
// comme « intensité partielle ». Ne pas la compter du tout ferait disparaître
// du volume réellement produit ; la compter en silence laisserait croire à une
// précision qui n'existe pas.
const POIDS_RIR_ABSENT=1;
// Au-delà, un total sur un seul muscle en une séance est signalé comme
// inhabituel. Le calcul n'est jamais plafonné pour autant : c'est peut-être
// vrai, et un chiffre tronqué serait un mensonge.
const VOL_SEUIL_ABERRANT=40;
// Part de séries sans RIR au-delà de laquelle le comptage est annoncé comme
// une estimation haute.
const VOL_PART_SANS_RIR=0.30;

// Concentration : au-delà de ce nombre de séries sur UN SEUL entraînement,
// un muscle a probablement plus à gagner à voir son volume réparti sur deux
// jours qu'à tout encaisser d'un coup.
//
// Comme REPERES_VOLUME, c'est un repère de PRATIQUE DE TERRAIN et non une
// mesure. Il n'a pas de validation expérimentale directe, la variance
// interindividuelle est majeure, et un pratiquant avancé peut très bien tenir
// davantage. D'où une simple phrase en gris : on donne à lire, on ne juge pas,
// et rien de tout ceci n'entre dans un signal ni dans une alerte.
const VOL_CONCENTRATION_SEANCE=10;
// Et seulement si cette séance porte l'essentiel de la semaine : 12 séries sur
// 30 ne sont pas une concentration, c'est une grosse séance dans un gros
// volume.
const VOL_CONCENTRATION_PART=0.70;

// Repères de volume hebdomadaire, en séries dures par muscle et par semaine.
//
// Ces valeurs sont des repères de PRATIQUE DE TERRAIN (cadre MEV/MAV/MRV
// popularisé par Israetel / Renaissance Performance). Elles n'ont pas de
// validation expérimentale directe et la variance interindividuelle est
// majeure — l'ÂGE en fait partie, au même titre que l'expérience, le
// sommeil et la récupération. Elles servent de point de départ ajustable,
// jamais de verdict.
//
// Et surtout : AUCUN barème par âge n'en découle. Nommer l'âge parmi les
// facteurs de variation, c'est reconnaître qu'un chiffre unique ne convient
// à personne en particulier. En tirer une table « MRV à 45 ans » serait
// remplacer un repère trop général par un repère faussement précis.
//
// LOMBAIRES, ABDUCTEURS ET ADDUCTEURS ONT REJOINT LA TABLE LE 23/09/2026, et
// il faut dire pourquoi, parce qu'ils en étaient exclus VOLONTAIREMENT.
//
// La règle d'alors : aucun repère de terrain ne fait consensus pour ces
// trois-là, donc on les compte et on les affiche sans zone ni couleur, plutôt
// que de les juger contre un chiffre inventé. Elle était défendable. Elle
// avait un coût, et c'est Kevin qui l'a vu, sa silhouette sous les yeux :
// « les lombaires, j'ai aucune couleur, alors que pourtant j'ai quand même un
// exo lombaire dans mes séances » ; « les adducteurs, j'ai un exo, je comprends
// pas pourquoi ils sont pas mis ». Un muscle qu'on entraîne, qu'on compte, et
// qui reste gris sans un mot ne se lit pas comme « on ne sait pas juger » — il
// se lit comme un oubli, ou comme un zéro.
//
// ⚠ CE SONT DONC DES ARBITRAGES, ET ILS LE DISENT — exactement au même titre
//   que le partage du trapèze plus bas, et comme TOUTE cette table, que le
//   bandeau « repères indicatifs » annonce partout où elle s'affiche. Ils
//   tiennent sur un seul constat, le même pour les trois : CES MUSCLES SONT
//   MASSIVEMENT CHARGÉS EN INDIRECT. Les érecteurs travaillent à chaque squat,
//   soulevé, rowing et port lourd ; les adducteurs et les abducteurs à chaque
//   squat, fente et hip thrust. D'où un MEV à 0 — le travail direct n'est
//   jamais ce qui les maintient — et un MRV bas, parce que ce qui les use vient
//   d'ailleurs et s'additionne sans qu'on le compte ici. Le lombaire a le MRV
//   le plus bas des trois : c'est le site de surmenage classique, et sa fatigue
//   se paie sur tout le reste.
// ══════════════ LE TRAPEZE S'EST DEDOUBLE ══════════════════════════════
//
// Le 08/09/2026, TRAPEZES est devenu TRAP_SUP et TRAP_MED. Des dossiers
// portent encore l'ancienne clef : un repere de volume regle par le coach
// (`user.reperesVolume.TRAPEZES`), un repere deplace par la boucle de retour
// (`user.reperesAuto.TRAPEZES`).
//
// ⚠ ILS NE SONT NI EFFACES NI IGNORES. Un reglage de coach efface sans
// prevenir, c'est un travail perdu et une confiance avec ; ignore, il resterait
// dans le dossier a ne servir a rien, et reapparaitrait le jour ou quelqu'un
// relirait la clef. On le REPORTE, une fois, sur les deux portions — c'est ce
// que le coach avait regle pour l'ensemble, et c'est le report le plus fidele
// qu'on puisse faire sans lui redemander.
//
// PURE. Rend true si elle a change quelque chose, pour que l'appelant sache
// s'il doit sauver.
// ══ LE FUSEAU DE L'ATHLÈTE (01/10/2026) ══════════════════════════════════
// users/<clé>/tz : le nom IANA du fuseau de l'appareil (« America/Montreal »).
// Le serveur léger s'en sert pour les heures calmes (21 h – 8 h LOCALES) et le
// jour du plafond d'un push. Un nom absent ou mal formé vaut Europe/Paris.
// ⚠ LE MÊME MOTIF que TZ_RE (cloudflare/src/metier.js) et que la règle de
//   users/$emailKey/tz (database.rules.json) : une valeur que la règle
//   refuserait ferait rejeter le dossier ENTIER à l'envoi.
const TZ_DEFAUT='Europe/Paris';
const TZ_RE=/^(?:UTC|[A-Z][A-Za-z_+-]*(?:\/[A-Za-z0-9_+-]+){1,2})$/;
// PURE. `brut` : ce que l'appareil annonce (Intl), ou une valeur donnée (tests).
function fuseauDeLAppareil(brut){
  let tz=brut;
  if(tz===undefined){ try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ tz=null; } }
  return (typeof tz==='string'&&tz.length<=64&&TZ_RE.test(tz))?tz:TZ_DEFAUT;
}
// Pose u.tz s'il a changé. Rend vrai s'il faut enregistrer.
function fuseauAssurer(u,brut){
  if(!u||typeof u!=='object') return false;
  const tz=fuseauDeLAppareil(brut);
  if(u.tz===tz) return false;
  u.tz=tz;
  return true;
}
function migrerTrapezes(user){
  const u=_dossier(user);
  if(!u) return false;
  let bouge=false;
  for(const champ of ['reperesVolume','reperesAuto']){
    const o=u[champ];
    if(!o||typeof o!=='object'||o.TRAPEZES===undefined) continue;
    const v=o.TRAPEZES;
    // On n'ECRASE JAMAIS un reglage deja pose sur la nouvelle clef : si le
    // coach a deja regle TRAP_SUP depuis la separation, c'est lui qui gagne.
    if(o.TRAP_SUP===undefined) o.TRAP_SUP=(v&&typeof v==='object')?Object.assign({},v):v;
    if(o.TRAP_MED===undefined) o.TRAP_MED=(v&&typeof v==='object')?Object.assign({},v):v;
    delete o.TRAPEZES;
    bouge=true;
  }
  return bouge;
}
// mv, LE VOLUME DE MAINTIEN (30/09/2026) : max(0, arrondi(MEV / 2)) par
// défaut, ajouté à chaque ligne ci-dessous (_avecMaintien) et recalculé par
// reperesEffectifs sur le MEV effectif. C'est la cible d'un muscle mis « en
// bas » par l'arbitrage d'un bloc : on garde, on ne développe pas.
const _REPERES_VOLUME_BRUT=Object.freeze({
  PECTORAUX :{mev:8,  mavMin:12, mavMax:20, mrv:22},
  DORSAUX   :{mev:10, mavMin:14, mavMax:22, mrv:25},
  // ⚠ AUCUNE SOURCE NE PUBLIE CES DEUX-LA SEPAREMENT, et il faut le dire :
  // les reperes de terrain donnent « traps » d'un bloc. Le partage ci-dessous
  // est un ARBITRAGE, pas une mesure — comme tout ce tableau, dont l'en-tete
  // le dit deja. Il tient sur deux constats de pratique :
  //   · le SUPERIEUR recoit deja beaucoup de travail indirect — tout ce qui se
  //     porte, se souleve ou se tient lourd le sollicite — d'ou un besoin
  //     direct plus bas ;
  //   · le MOYEN est le plus souvent sous-travaille, et c'est lui qui tient la
  //     posture des epaules.
  // La somme des fourchettes (13 a 22) reste proche de l'ancien bloc unique
  // (12 a 20) : personne ne se reveille avec un volume a rattraper.
  TRAP_SUP  :{mev:0,  mavMin:5,  mavMax:8,  mrv:12},
  TRAP_MED  :{mev:0,  mavMin:8,  mavMax:14, mrv:18},
  DELT_ANT  :{mev:0,  mavMin:6,  mavMax:8,  mrv:12},
  DELT_LAT  :{mev:8,  mavMin:16, mavMax:22, mrv:26},
  DELT_POST :{mev:6,  mavMin:10, mavMax:18, mrv:24},
  BICEPS    :{mev:8,  mavMin:14, mavMax:20, mrv:26},
  TRICEPS   :{mev:6,  mavMin:10, mavMax:14, mrv:18},
  AVANT_BRAS:{mev:0,  mavMin:8,  mavMax:16, mrv:20},
  QUADRICEPS:{mev:8,  mavMin:12, mavMax:18, mrv:20},
  ISCHIOS   :{mev:4,  mavMin:10, mavMax:16, mrv:20},
  FESSIERS  :{mev:0,  mavMin:8,  mavMax:16, mrv:16},
  MOLLETS   :{mev:6,  mavMin:12, mavMax:16, mrv:20},
  ABDOS     :{mev:0,  mavMin:8,  mavMax:16, mrv:25},
  // Les trois arbitrages du 23/09/2026 — voir l'en-tête.
  LOMBAIRES :{mev:0,  mavMin:4,  mavMax:10, mrv:14},
  ABDUCTEURS:{mev:0,  mavMin:6,  mavMax:12, mrv:16},
  ADDUCTEURS:{mev:0,  mavMin:6,  mavMax:12, mrv:16}
});
function _avecMaintien(t){
  const out={};
  for(const k of Object.keys(t)) out[k]=Object.freeze(Object.assign({},t[k],{mv:Math.max(0,Math.round(t[k].mev/2))}));
  return Object.freeze(out);
}
const REPERES_VOLUME=_avecMaintien(_REPERES_VOLUME_BRUT);
// Zones d'un repère, dans l'ordre croissant. Le libellé est celui montré à
// l'athlète : il décrit une position, il ne prescrit rien.
const VOL_ZONES=Object.freeze([
  {cle:'SOUS',   lib:'sous le minimum',      c:'#6f6f6f'},
  {cle:'MAINTIEN',lib:'maintien',            c:'#3b82f6'},
  {cle:'PROGRES',lib:'zone de progrès',      c:'#22c55e'},
  {cle:'ELEVE',  lib:'volume élevé',         c:'#f97316'},
  {cle:'AU_DESSUS',lib:'au-dessus du repère',c:'#e05050'}
]);

// ── LA MÉMOIRE DES RENOMMAGES DÉCIDÉS DANS LE GUIDE ────────────────────────
//
// Quand le coach rebaptise un exercice dans son « Guide des méthodes et des
// exercices de musculation », les dossiers déjà écrits gardent, eux, l'ANCIEN
// nom : c'est la clef de l'historique de charge, des volumes et des programmes
// déjà publiés. Réécrire ces dossiers serait lourd et irréversible. On écrit
// donc le renommage ICI, une fois, et toute la résolution le traverse.
//
// ⚠ NE PAS CONFONDRE AVEC currentUser.exAlias :
//   • EX_RENOMMAGES : les renommages décidés DANS LE GUIDE DU COACH. Ils
//     valent pour TOUT LE MONDE, y compris pour un dossier sans exAlias, et
//     y compris avant qu'aucun utilisateur ne soit chargé.
//   • currentUser.exAlias : les renommages qu'UN coach a décidés pour SES
//     propres exercices — fusion manuelle, détection de renommage. Ils ne
//     concernent que son dossier et sont persistés avec lui.
//
// Clefs ET valeurs au format exKey : MAJUSCULES, sans accent, sans
// ponctuation, espaces simples. Une entrée mal normalisée ne serait JAMAIS
// consultée — la résolution ne reçoit que des clefs déjà passées par exKey —
// et son échec serait muet. Une assertion de testExercices() le vérifie.
//
// Vide dans ce lot : on pose la tuyauterie avant de toucher aux données.
// LA TABLE ETAIT VIDE, ET LE MECANISME ATTENDAIT DEPUIS LE DEBUT.
//
// Signale par Kevin le 15/09/2026 : « le curl barre a la poulie, on voit juste
// du curl barre ». Dix exercices ECRITS DANS LES PROGRAMMES n'avaient aucune
// illustration a leur nom — non parce que le dessin manque, mais parce que le
// guide les nomme autrement que les fichiers : pluriel contre singulier, accent
// contre sans accent, « OU A LA SMITH » en plus. La regle de prefixe rattrapait
// les plus courts au hasard des mots retires, et c'est ainsi que « curl a la
// poulie » finissait sur une barre libre.
//
// LES CLES SONT DE-ACCENTUEES ET EN MAJUSCULES : _slugIllustre traverse cette
// table avec le slug remis en mots, et un slug ne porte jamais d'accent.
//
// DEUX EXERCICES N'Y SONT PAS, ET C'EST VOLONTAIRE : « SQUAT BULGARE HALTERE »
// et « SQUAT GOBLET » n'ont AUCUNE photo dans le depot. Le plus proche pour le
// premier serait « fente bulgare machine » — un autre agres, donc exactement
// l'erreur qu'on vient de fermer. Ils gardent leur cadre vide jusqu'a ce qu'une
// photo existe : c'est une donnee qui manque, pas une resolution a bricoler.
const EX_RENOMMAGES=Object.freeze({
  // Pluriel du guide, singulier du fichier.
  'ABDUCTEURS A LA MACHINE':'ABDUCTEUR A LA MACHINE',
  // Le guide nomme les deux agres possibles ; le fichier n'en illustre qu'un.
  'CURL LARRY SCOTT MACHINE GUIDEE OU PUPITRE':'CURL LARRY SCOTT MACHINE GUIDEE',
  'DEVELOPPE MACHINE HAUT DE PECS OU A LA SMITH':'DEVELOPPE ASSIS A LA MACHINE HAUT DE PECS',
  'HIP THRUST MACHINE OU A LA BARRE':'HIP THRUST MACHINE',
  'HIP THRUST MACHINE CONVERGENTE':'HIP THRUST MACHINE',
  // LE CAS SIGNALE. Debout, barre accrochee au cable : c'est ce que le fichier
  // « curl barre poulie elastique » montre, et c'est ce que la consigne decrit.
  'CURL A LA POULIE':'CURL BARRE POULIE',
  // Feminin du guide, masculin du fichier. La variante « pieds en haut » n'a
  // pas de photo propre : elle prend celle de la presse, ou seul le placement
  // des pieds differe — une precision d'execution, pas un autre exercice.
  'PRESSE A CUISSE INCLINEE':'PRESSE A CUISSE INCLINE',
  'PRESSE A CUISSE INCLINEE PIEDS EN HAUT':'PRESSE A CUISSE INCLINE',
  // « NEUTRE » seul dans le guide, « PRISE NEUTRE » sur le fichier.
  'TIRAGE POITRINE NEUTRE':'TIRAGE POITRINE PRISE NEUTRE',
  // ⚠ UNE LETTRE. Le fichier s'appelle « squat-bulgar-haltere », sans le « e »
  // de « bulgare » — une faute de frappe au nommage, et les deux
  // « squat bulgar… » du dossier la portent. L'image est la bonne : pied
  // arriere sur le banc, haltere en main, verifie a l'oeil. C'est le nom qui
  // se corrige, pas la photo qu'on remplace.
  'SQUAT BULGARE HALTERE':'SQUAT BULGAR HALTERE',
  // 01/10/2026 (Kevin) : DEUX FAUTES DU GUIDE CORRIGÉES. « EXTENTION » s'écrit
  // « EXTENSION », et « CURL BARRE POULIE/ÉLASTIQUE » devient « CURL BARRE
  // POULIE » (sa variante à l'élastique est retirée). Les anciens noms vivent
  // dans des programmes, des historiques de charge et des slugs déjà
  // enregistrés : ils mènent ici au nouveau, sans rien réécrire chez personne.
  // Les clefs sont écrites en deux morceaux pour qu'aucune recherche de la
  // faute dans ce fichier ne retombe dessus.
  ['EXTEN'+'TION TRICEPS POULIE BASSE']:'EXTENSION TRICEPS POULIE BASSE',
  ['EXTEN'+'TION TRICEPS SUR BANC']:'EXTENSION TRICEPS SUR BANC',
  ['EXTEN'+'TION TRICEPS SUR BANC ALTERNE']:'EXTENSION TRICEPS SUR BANC ALTERNE',
  ['EXTEN'+'TION TRICEPS SUR BANC UNILATERALE']:'EXTENSION TRICEPS SUR BANC UNILATERALE',
  ['LEG EXTEN'+'TION']:'LEG EXTENSION',
  ['LEG EXTEN'+'TION ALLONGE ELASTIQUE']:'LEG EXTENSION ALLONGE ELASTIQUE',
  ['LEG EXTEN'+'TION ALLONGE HALTERE']:'LEG EXTENSION ALLONGE HALTERE',
  ['LEG EXTEN'+'TION HALTERE']:'LEG EXTENSION HALTERE',
  ['CURL BARRE POULIE '+'ELASTIQUE']:'CURL BARRE POULIE',
  ['CURL BARRE POULIE '+'ELASTIQUE ELASTIQUE']:'CURL BARRE POULIE'
});
// PURE. La clef telle que le GUIDE la nomme aujourd'hui, sans rien savoir de
// l'utilisateur : seule EX_RENOMMAGES est traversée, bornée aux mêmes 3 sauts
// que resoudreAlias. C'est ce qui permet à une fiche encore nommée à
// l'ancienne de retrouver son illustration et sa vidéo sans qu'on réécrive
// quoi que ce soit dans les dossiers.
// `glob` n'existe que pour les tests : la production ne le passe jamais.
function _cleRenommee(k,glob){
  const g=glob||EX_RENOMMAGES;
  let cur=k;
  for(let i=0;i<3;i++){ const s=g[cur]; if(!s||s===cur) return cur; cur=s; }
  return cur;
}

// Table issue du « Guide des méthodes et des exercices de musculation » du
// coach : 408 exercices, classés par sa propre nomenclature (section du guide
// + partie spécifique qu'il a écrite pour chacun, « Longue portion »,
// « Ischio, fessiers »…). C'est la source PRINCIPALE de classification ; les
// expressions régulières plus bas ne servent que de repli.
// Stockée par signature — une signature, tous les exercices qui la partagent,
// séparés par ~ — pour ne pas répéter 408 fois les mêmes tableaux.
// LES SIGNATURES REVUES (30/09/2026) :
//   • les écartés, le butterfly et le crossover ne sollicitent pas le triceps
//     (coude fixe) : 'PECTORAUX,DELT_ANT' ;
//   • les élévations frontales non plus : 'DELT_ANT' ;
//   • squats et presses ne comptent plus les ischios (la hanche étend, le
//     genou aussi : l'ischio y est stabilisateur) : 'QUADRICEPS,FESSIERS'. Le
//     soulevé de terre et le good morning gardent les leurs ;
//   • jumping jack, montée de genoux, power run, quad stomp : du cardio ;
//     le gainage chaise : les quadriceps, en isométrie (EX_ISOMETRIQUES) ;
//   • les dips au poids du corps (barre, anneaux, lestés, assistés,
//     élastique) : 'TRICEPS,PECTORAUX,DELT_ANT'. Les dips à la machine et
//     les dips au banc (TRICEPS DIPS) restent aux triceps seuls ;
//   • SIDE TRICEPS est une pose : EX_GUIDE_POSING.
// LES EXERCICES NON RÉFÉRENCÉS (Kevin, 05/10/2026 : « l'élévation latérale
// hauteur de hanche, ou même le RDL à la belt squat »). Vingt-trois exercices
// filmés dans le guide n'avaient pas de ligne ici : sans ligne, pas de
// muscles, pas de schéma, et le remplissage de la banque les écartait. Ils
// sont classés sur leur plus proche voisin (même agrès, même geste). Les deux
// que Kevin a nommés EXISTAIENT sous un autre nom (vérifié sur ses captures du
// guide) : « ELEVATION LATERALE POULIE ELASTIQUE UNILATERAL » est l'élévation à
// hauteur de hanche, « RDL MACHINE GUIDEE » le RDL à la belt squat. Ils se
// retrouvent par ces mots-là (BQ_LIBELLES). La banque en ligne, copie figée,
// est complétée par l'app (bqFichesApp) : rien à republier.
const EX_GUIDE_BRUT={
  'PECTORAUX,DELT_ANT,TRICEPS':'CHEST PRESS DEBOUT~DEVELOPPE A LA MACHINE ASSIS~DEVELOPPE A LA MACHINE CONVERGENTE~DEVELOPPE A LA MACHINE CONVERGENTE HAUT DE PECS~DEVELOPPE A LA MACHINE CONVERGENTE UNILATERAL~DEVELOPPE ASSIS A LA MACHINE~DEVELOPPE ASSIS A LA MACHINE HAUT DE PECS~DEVELOPPE ASSIS A LA MACHINE UNILATERAL~DEVELOPPE COUCHE BARRE~DEVELOPPE COUCHE BARRE AVEC CALLE~DEVELOPPE COUCHE BARRE VERSION INTERMEDIAIRE~DEVELOPPE COUCHE HALTERE~DEVELOPPE COUCHE LARSEN~DEVELOPPE COUCHE MACHINE~DEVELOPPE COUCHE POWER SMITH MACHINE~DEVELOPPE COUCHE SMITH MACHINE~DEVELOPPE DECLINE BARRE~DEVELOPPE DECLINE BARRE SMITH MACHINE~DEVELOPPE DECLINE HALTERE~DEVELOPPE INCLINE BARRE~DEVELOPPE INCLINE HALTERE~DEVELOPPE INCLINE MACHINE~DEVELOPPE INCLINE SMITH MACHINE~DIPS BAS DE PECS~DIPS MACHINE BAS DE PECS~FLOOR PRESS~POMPE AUX ANNEAUX~POMPES~POMPES AVEC ELASTIQUE~POMPES DECLINE~POMPES INCLINE~POMPES LESTEE~POMPES SAUTEES ALTERNEES SUR BALLON~POMPES SAUTES',
  // LES PULL-OVERS, BRAS TENDUS (Kevin, 27/09/2026, vérifié sur les photos) :
  // le coude ne plie pas, le biceps ne travaille pas. À la poulie et aux
  // machines, dorsaux seuls. Sur banc plat, haltère en travers, la cage
  // s'ouvre et le pectoral tire avec le dorsal.
  'PECTORAUX,DELT_ANT':'BUTTERFLY~BUTTERFLY UNILATERAL~CHEST CROSSOVER DUAL~ECARTE HALTERE SUR BANC~ECARTE HALTERE SUR BANC DECLINE~ECARTE HALTERE SUR BANC INCLINE~ECARTE MACHINE~ECARTE MACHINE HAUT DE PEC~ECARTE POULIE BASSE~ECARTE POULIE BASSE EN UNILATERAL~ECARTE POULIE BASSE SUR BANC~ECARTE POULIE HAUT EN UNILATERAL~ECARTE POULIE HAUTE~ECARTE POULIE HAUTE BUSTE PENCHE~ECARTE POULIE HAUTE CONTRE BANC~ECARTE POULIE SUR BANC~ECARTE POULIE SUR BANC INCLINE',
  'DORSAUX':'PULL OVER~PULL OVER CORDE~PULL OVER MACHINE~PULL OVER SUR BANC INCLINE~PULL OVER UNILATERAL~PURE PULLOVER',
  'DORSAUX,PECTORAUX':'PULL OVER SUR BANC',
  // LES TIRAGES VERTICAUX : pas de rétraction de l'omoplate.
  'DORSAUX,BICEPS':'ISO LATERAL FRONT LAT PULLDOWN~TIRAGE DOS FACE A LA POULIE~TIRAGE DOS POULIE VIS A VIS~TIRAGE NUQUE~TIRAGE POITRINE LARGE~TIRAGE POITRINE LARGEUR EPAULE~TIRAGE POITRINE MACHINE CONVERGENTE~TIRAGE POITRINE MACHINE CONVERGENTE AVEC POIGNEES~TIRAGE POITRINE PRISE NEUTRE~TIRAGE POITRINE SERRE~TIRAGE POITRINE SUPINATION~TIRAGE POITRINE SUPINATION MACHINE CONVERGENTE~TIRAGE POITRINE UNILATERAL POULIE~TIRAGE UNILATERAL SUR BANC~TRACTIONS~TRACTIONS ELASTIQUE~TRACTIONS LESTE~TRACTIONS MACHINE ASSISTE~TRACTIONS PRISE NEUTRE~VERTICAL TRACTION',
  'QUADRICEPS,FESSIERS,ISCHIOS,LOMBAIRES':'SOULEVE DE TERRE TRAP BARRE',
  'TRICEPS':'BARRE AU FRONT~BARRE AU FRONT BANC INCLINE~BODYWEIGHT SKULL CRUSHER~CHEST PRESS DEBOUT TRICEPS~DEVELOPPE COUCHE PRISE SERREE~DIPS MACHINE~DIPS MACHINE GUIDEE~EXTENSION TRICEPS AU DESSU DE LA TETE~EXTENSION TRICEPS POULIE BASSE~EXTENSION TRICEPS SUR BANC~EXTENSION TRICEPS SUR BANC ALTERNE~EXTENSION TRICEPS SUR BANC UNILATERALE~EXTENSIONS POULIE BASSE TRICEPS~EXTENSIONS POULIE BASSE TRICEPS UNILATERALE~EXTENSIONS TRICEPS POULIE EN X~EXTENSIONS TRICEPS SUR LE COTE POULIE~EXTENSIONS VERTICALES TRICEPS~EXTENSIONS VERTICALES TRICEPS BARRE~EXTENSIONS VERTICALES TRICEPS HALTERE~EXTENSIONS VERTICALES TRICEPS UNILATERALE~FRENCH PRESS MACHINR~KICKBACK HALTERE~KICKBACK POULIE~POMPES SERREES~TRICEPS A LA POULIE HAUTE BARRE~TRICEPS A LA POULIE HAUTE CORDE~TRICEPS A LA POULIE HAUTE POIGNEE~TRICEPS A LA POULIE HAUTE UNILATERALE~TRICEPS DIPS~TRICEPS EXTENSION MACHINE',
  'TRICEPS,PECTORAUX,DELT_ANT':'DIPS~DIPS ASSISTE~DIPS AUX ANNEAUX~DIPS ELASTIQUE~DIPS LESTE~DIPS SUR BARRE~DIPS SUR BARRE ELASTIQUE~DIPS SUR BARRE LESTE',
  'ABDOS':'AB CRUNCH BENCH~ABS ROLLER~CRUNCH A DOUBLE CONTRACTION SUR BANC~CRUNCH A LA MACHINE~CRUNCH A LA POULIE~CRUNCH AU SOL~CRUNCH AU SOL AVEC POIDS~CRUNCH BENCH~CRUNCH CROISE~CRUNCH JAMBES EN APPUI SUR BANC~CRUNCH JAMBES EN APPUI SUR BANC AVEC POIDS~CRUNCH SUR BALL~CRUNCH SUR BANC INCLINE~FLEXION LATERAL DE BUSTE AU BANC~FLEXION LATERAL DE BUSTE AVEC POIDS~FLEXION LATERAL DE BUSTE POULIE ELASTIQUE~FLEXIONS DE BUSTE EN GAINAGE LATERAL~FLEXIONS LATERALS AU SOL~GAINAGE HOLLOW HOLD~GAINAGE LATERAL~GAINAGE PLANCHE~LE VACUUM~LES CISEAUX~MOUNTAIN CLIMBER~OBLIQUE ABDOMINAL CRUNCH~PALLOF PRESS~RELEVE DE GENOUX A LA BARRE DE TRACTIONS~RELEVE DE GENOUX A LA CHAISE ABDOMINALE~RELEVE DE GENOUX SUR BANC~RELEVE DE JAMBE A LA PLANCHE INCLINE~RELEVE DE JAMBE AU SOL~ROTATION AU SOL~ROTATION DE BUSTE POULIE ELASTIQUE HAUTE~V SIT UP',
  // Les SHRUGS elevent l'omoplate : trapeze SUPERIEUR, et lui seul.
  // LA REVUE DU 27/09/2026 (Kevin : « revois la répartition des muscles »).
  // Le shrug n'avait aucune raison de créditer les dorsaux : l'omoplate
  // monte et redescend, le bras ne tire pas. Trapèze supérieur, seul.
  'TRAP_SUP':'SHRUG~SHRUG ASSIS A LA MACHINE~SHRUG DEBOUT A LA MACHINE~SHRUG DELAVIER~SHRUG HALTERE~SHRUG HALTERES SUR BANC~SHRUG POULIE',
  // Les deux « rowings trapezes » RETRACTENT : moyen, malgre leur nom.
  // Tirés hauts, coudes ouverts : l'arrière d'épaule travaille avec eux.
  'TRAP_MED,DELT_POST,DORSAUX':'ROWING POWER SMITH TRAP~ROWING TRAPEZES POULIE HAUTE',
  // LES ROWINGS ET LES TIRAGES : le dorsal est le moteur, le trapeze et le
  // biceps l'accompagnent. Ils etaient classes trapezes en majeur, ce qui
  // comptait leur volume dorsal de moitie et leur volume trapeze double.
  // TOUS LES ROWINGS, uni- ou bilatéraux (revue du 27/09/2026) : quinze
  // d'entre eux, dont le rowing haltère, ne créditaient pas le trapèze médian,
  // alors que la règle de repli, plus bas, le fait pour tout rowing.
  'DORSAUX,TRAP_MED,BICEPS':'HIGH ROW HAMMER STRENGTH~RENEGATE ROW~ROW~ROWING BARRE ALLONGE SUR BANC INCLINE~ROWING BARRE LARGE~ROWING BARRE POULIE BASSE~ROWING BARRE SERRE~ROWING BARRE T~ROWING BARRE T A LA MACHINE~ROWING BARRE T PRISE LARGE~ROWING HALTERE ALLONGE SUR BANC INCLINE~ROWING HALTERE BUSTE PENCHE~ROWING HALTERE UNILATERAL~ROWING HALTERE UNILATERAL SUR BANC~ROWING INVERSE~ROWING PENDLAY SMITH MACHINE~ROWING PLANCHE BARRE~ROWING POULIE BASSE ALLONGE SUR BANC INCLINE~ROWING POULIE BASSE UNILATERAL~ROWING POWER SMITH~ROWING POWER SMITH DORS~ROWING SAC UNILATERAL SUR BANC~ROWING UNILATERAL A LA LANDMINE~SEAL ROW AVEC HALTERE~TIRAGE HORIZONTAL LARGE~TIRAGE HORIZONTAL LARGE NEUTRE~TIRAGE HORIZONTAL MACHINE~TIRAGE HORIZONTAL MACHINE CONVERGENTE~TIRAGE HORIZONTAL MACHINE CONVERGENTE NEUTRE~TIRAGE HORIZONTAL MACHINE CONVERGENTE PRONATION~TIRAGE HORIZONTAL MACHINE CONVERGENTE UNILATERAL~TIRAGE HORIZONTAL MACHINE SUPINATION~TIRAGE HORIZONTAL MACHINE UNILATERAL~TIRAGE HORIZONTAL MACHINE UNILATERAL NEUTRE~TIRAGE HORIZONTAL MACHINE UNILATERAL SUPINATION~TIRAGE HORIZONTAL SERRE~TIRAGE HORIZONTAL SUPINATION~TIRAGE HORIZONTAL UNILATERAL~TIRAGE HORIZONTAL UNILATERAL SUR BANC',
  'BICEPS,AVANT_BRAS':'BICEPS BRAS EN CROIX~CURL A LA POULIE BASSE EN UNILATERAL~CURL ACCROUPI~CURL ALLONGE POULIE~CURL ALLONGE POULIE HAUTE~CURL BARRE~CURL BARRE BALLET SAC~CURL BARRE POULIE~CURL BARRE PRISE LARGE~CURL BARRE PRISE SERREE~CURL CONCENTRE~CURL HALTERES SUR BANC~CURL LARRY SCOTT~CURL LARRY SCOTT HALTERES~CURL LARRY SCOTT HALTERES UNILATERALE~CURL LARRY SCOTT MACHINE GUIDEE~CURL LARRY SCOTT MACHINE GUIDEE UNILATERALE~CURL LARRY SCOTT POULIE BASSE~CURL LARRY SCOTT POULIE BASSE UNILATERALE~CURL MACHINE GUIDEE~CURL MARTEAU~CURL MARTEAU A L INTERIEUR~CURL MARTEAU POULIE~CURL MARTEAU SUR BANC~CURL POULIE HAUTE~CURL ROTATION~CURL ROTATION ALTERNE~CURL ROTATION ASSIS~CURL ROTATION ASSIS ALTERNE~CURL SUR BANC INCLINE~CURL SUR BANC INCLINE ALTERNE~CURL SUR BANC POULIE~CURL UNILATERAL POULIE BASSE AVEC COUDE EN ARRIERE~SPIDER CURL~SPIDER CURL HALTERE~SPIDER CURL HALTERE UNILATERALE~TRACTION PRISE SERREE',
  // LES « TIRAGES VERTICAUX » DU GUIDE SONT DES TIRAGES MENTON : debout, la
  // barre monte le long du buste, coudes hauts (vérifié sur les trois photos).
  // Ils étaient rangés avec les rowings, en dorsaux. Deltoïde latéral, et le
  // trapèze supérieur qui finit l'élévation ; même chose pour les tirages menton.
  'DELT_LAT,TRAP_SUP':'TIRAGE MENTON BALET SAC~TIRAGE MENTON BARRE~TIRAGE MENTON POULIE ELASTIQUE ET MANCHE A BALLET~TIRAGE VERTICAL A LA BARRE~TIRAGE VERTICAL A LA BARRE SMITH MACHINE~TIRAGE VERTICAL A LA POULIE',
  'DELT_ANT,TRICEPS':'DEVELOPPE EPAULE AU LANDMINE~DEVELOPPE EPAULES BARRE~DEVELOPPE EPAULES ELASTIQUE~DEVELOPPE EPAULES HALTERES~DEVELOPPE MILITAIRE BARRE~DEVELOPPE MILITAIRE ELASTIQUE~DEVELOPPE MILITAIRE HALTERES~DEVELOPPE MILITAIRE MACHINE~DEVELOPPE MILITAIRE SMITH MACHINE~HANDSTAND PUSH UP~PIKE PUSH UP~POWER SMITH EPAULES~SHOULDER PRESS~SHOULDER PRESS PURE METEOR~VIKING PRESS PRISE NEUTRE',
  'DELT_ANT':'ELEVATION FRONTALE BOUTEILLES~ELEVATION FRONTALE DISQUE DE POIDS~ELEVATION FRONTALE HALTERES~ELEVATION FRONTALE MACHINE~ELEVATION FRONTALE POULIE ELASTIQUE~ELEVATION FRONTALE SUR BANC INCLINE',
  'FESSIERS':'BOOTYMIZER~DONKEY KICK SMITH MACHINE~EXTENSION DE HANCHE AU SOL~EXTENSION DE HANCHE MACHINE~EXTENSION DE HANCHE POULIE BASSE~EXTENSION DE HANCHE POULIE CROISE~EXTENSION DE HANCHE POULIE PIEDS HAUT~EXTENSION DE HANCHE POULIE SUR BANC~FESSIER A LA MACHINE DE TRACTION~GLUTE BRIDGE~GLUTE MACHINE~GLUTEUS MACHINE~HIP THRUST~HIP THRUST UNILATERAL HALTERE~HYPTRUST A LA SMITH MACHINE~MONTER SUR BANC HALTERE~MONTER SUR BANC POULIE~MONTER SUR BANC SMITH MACHINE',
  'DELT_LAT':'ELEVATION LATERALE ASSIS SUR BANC~ELEVATION LATERALE AVEC BOUTEILLES D EAU~ELEVATION LATERALE HALTERE~ELEVATION LATERALE HALTERE UNILATERAL~ELEVATION LATERALE MACHINE~ELEVATION LATERALE MACHINE DEBOUT~ELEVATION LATERALE POULIE~ELEVATION LATERALE POULIE BASSE UNILATERAL~ELEVATION LATERALE POULIE ELASTIQUE UNILATERAL~ELEVATION LATERALE SUR BANC A 60~LATERAL RAISE',
  'MOLLETS':'CALF EXTENSION MACHINE~DONKEY CALF RAISE MACHINE~MOLLETS A LA HACKSQUAT EN UNILATERAL~MOLLETS A LA MACHINE~MOLLETS A LA PRESSE ASSISE~MOLLETS A LA SMITH MACHINE~MOLLETS ASSIS A LA MACHINE~MOLLETS ASSIS AVEC BARRE~MOLLETS CHAMEAU~MOLLETS DEBOUT UNILATERAL~PURE SEATED CALF~TIBIA DORSI FLEXION',
  // L'ÉLÉVATION Y : bras en Y, pouces en haut, le milieu et le bas du trapèze
  // font le geste ; l'arrière d'épaule accompagne.
  'TRAP_MED,DELT_POST':'ELEVATION Y',
  'DELT_POST,TRAP_MED':'ARRIERE EPAULE A LA MACHINE~ELEVATION ARRIERE EPAULE POULIE~ELEVATION ARRIERE POULIE COUCHEE~FACE PULL~FACE PULL ASSIS~OISEAUX BUSTE PENCHE~OISEAUX BUSTE PENCHE MACHINE~OISEAUX BUSTE PENCHE POULIE ELASTIQUE~OISEAUX BUSTE PENCHE SUR BANC~OISEAUX SUR BANC INCLINE',
  // REVERSE HYPER MACHINE et SOULEVE DE TERRE ont rejoint ce groupe le
  // 21/08/2026. Ils etaient ranges sous 'FESSIERS,ISCHIOS,LOMBAIRES', donc
  // fessiers en muscle PRINCIPAL — ce qui contredisait deux decisions prises
  // par le coach et consignees dans la suite integree :
  //   « REVERSE HYPER MACHINE credite les lombaires » : c est une extension
  //   de tronc contre la gravite, jambes mobiles et buste fixe, l inverse
  //   mecanique de l extension de buste.
  //   « le conventionnel reste lombaires en tete, le roumain ischios en tete »
  // Les deux tests le demandaient depuis longtemps et echouaient en silence,
  // la suite mourant avant de les atteindre. Aucun muscle n est perdu au
  // passage : le fessier reste credite, il n est simplement plus le premier.
  'LOMBAIRES,FESSIERS,ISCHIOS':'EXTENSION DE BUSTE A LA MACHINE~EXTENSION DE BUSTE ASSIS SUR BANC~EXTENSION DE BUSTE SUR BANC~EXTENSION DE BUSTE SUR BANC AVEC ROWING~JEFFERSON CURL SUR STEP~REVERSE HYPER MACHINE~SOULEVE DE TERRE~SUPERMAN',
  // LE RACK PULL : un soulevé partiel, lourd, que les trapèzes supérieurs
  // tiennent verrouillé en haut.
  'LOMBAIRES,FESSIERS,ISCHIOS,TRAP_SUP':'RACK POOL',
  'ISCHIOS,LOMBAIRES':'SOULEVE DE TERRE ROUMAIN HALTERES~SOULEVE DE TERRE ROUMAIN LANDMINE',
  'ISCHIOS':'ISO LATERAL CURL~LEG CURL ALLONGE~LEG CURL ALLONGE EN UNILATERAL~LEG CURL ALLONGE HALTERE~LEG CURL ASSIS~LEG CURL DEBOUT~LEG EXTENSION ALLONGE ELASTIQUE~LEG EXTENSION ALLONGE HALTERE~NORDIC CURL AVEC ELASTIQUE~NORDIC HAMSTRING ASSISTE',
  'QUADRICEPS,FESSIERS':'CHUTE DE BOX SAUT~DEEP SQUAT~FENTE BULGARE A LA BELT SQUAT~FENTE BULGARE MACHINE~FENTES A LA V SQUAT~FENTES ARRIERE BARRE SMITH MACHINE~FENTES ARRIERE HALTERE~FENTES ARRIERES BARRE~FENTES BARRE~FENTES BARRE SMITH MACHINE~FENTES HALTERE~GOBELET SQUAT A LA BELT SQUAT~PRESSE A CUISSE ASSISE~PRESSE A CUISSE ASSISE PIEDS EN BAS~PRESSE A CUISSE HIGH STANCE~PRESSE A CUISSE INCLINE~PRESSE A CUISSE INCLINE PIEDS EN BAS~SAFETY SQUAT BARRE~SQUAT~SQUAT ASSIS~SQUAT AU BELT SQUAT~SQUAT AU BELT SQUAT A LA BARRE T~SQUAT AU BELT SQUAT A LA SMITH MACHINE~SQUAT AU BELT SQUAT VERSION QUADS~SQUAT AVEC HALTERES~SQUAT AVEC SAC~SQUAT BULGAR HALTERE~SQUAT BULGAR SMITH MACHINE~SQUAT PISTOL~SQUAT SAUTE~SQUAT SAUTE SUR BOX~SQUAT SERRE~SQUAT SMITH MACHINE~SQUAT SUMO~SUPER SQUAT MACHINE~V SQUAT FACE AU SIEGE',
  'ISCHIOS,FESSIERS,LOMBAIRES':'GOOD MORNING~RDL MACHINE GUIDEE~SOULEVE DE TERRE ROUMAIN~SOULEVE DE TERRE ROUMAIN SMITH MACHINE~SOULEVE DE TERRE ROUMAIN UNILATERAL',
  'ISCHIOS,FESSIERS':'HIP THRUST AU SOL~HIP THRUST MACHINE~HIP THRUST MACHINE 1~HIP THRUST MACHINE 2~HIP THRUST SAC~MONTER SUR BANC~RELEVE FESSIER BANC A LOMBAIRE~SQUAT AVEC HALTERES TENDU ENTRE LES JAMBES',
  'QUADRICEPS':'GAINAGE CHAISE~HACKSQUAT~LEG EXTENSION~LEG EXTENSION HALTERE~PENDULUM SQUAT~PRESSE A CUISSE ISO LATERALE~SISSY SQUAT~SQUAT AVEC SAC AVANT~SQUAT BARRE DEVANT~V SQUAT',
  'AVANT_BRAS':'BOBINE DANDRIEU~FLEXION AVANT BRAS A LA BARRE DEBOUT~FLEXION AVANT BRAS A LA BARRE SUR BANC PRONATION~FLEXION AVANT BRAS A LA BARRE SUR BANC SUPINATION~FLEXION AVANT BRAS UNILATERAL PRISE NEUTRE~GRIPPER',
  'ABDUCTEURS':'3D ABDUCTOR~ABDUCTEUR A LA MACHINE~ABDUCTEUR ASSIS AVEC ELASTIQUE~COPENHAGEN PLANK',
  'AVANT_BRAS,BICEPS':'REVERSE CURL BARRE~REVERSE CURL HALTERE~REVERSE CURL HALTERE ALTERNE',
  'DELT_ANT,DELT_LAT,TRICEPS':'DEVELOPPE NUQUE BARRE~DEVELOPPE NUQUE SMITH MACHINE',
  'ADDUCTEURS':'ADDUCTEUR A LA MACHINE~ADDUCTION DEBOUT POULIE ELASTIQUE',
  'QUADRICEPS,ISCHIOS,FESSIERS,LOMBAIRES':'SOULEVE DE TERRE SUMO',
  'QUADRICEPS,PECTORAUX,ABDOS':'BURPEES',
  'QUADRICEPS,TRAP_SUP,DELT_LAT':'SNATCH',
  'DORSAUX,BICEPS,AVANT_BRAS':'MONTEE DE CORDE~MONTEE DE CORDE SANS LES JAMBES',
  'DELT_ANT,TRICEPS,QUADRICEPS':'PUSH PRESS',
  'QUADRICEPS,TRAP_SUP,DORSAUX':'POWER CLEAN',
  'DORSAUX,BICEPS,TRICEPS':'MUSCLE UP',
  // REVERSE HYPER MACHINE et SOULEVE DE TERRE ont quitte ce groupe : voir
  // 'LOMBAIRES,FESSIERS,ISCHIOS' plus haut. Les trois qui restent n etaient
  // vises par aucune decision du coach, et ne bougent donc pas.
  'FESSIERS,ISCHIOS,LOMBAIRES':'KETTLEBELL SWING~SOULEVE DE TERRE HALTERE~SOULEVE DE TERRE PIEDS SURELEVE',
  'QUADRICEPS,TRAP_SUP,DELT_ANT':'CLEAN AND JERK',
  'QUADRICEPS,DELT_ANT,TRICEPS':'BARBELL THUSTERS',
  'QUADRICEPS,DELT_ANT,FESSIERS':'WALL BALL',
  'QUADRICEPS,DORSAUX,TRAP_SUP':'RENVERSEMENT DE PNEU',
  'QUADRICEPS,DELT_ANT,ABDOS':'SLEDGE',
  'TRAP_SUP,AVANT_BRAS,ABDOS':'MARCHE DU FERMIER',
  'QUADRICEPS,MOLLETS':'SAUTS SUR PLACE AVEC ELASTIQUE',
  'QUADRICEPS,ABDUCTEURS':'SAUT SUR LES COTES',
  'FESSIERS,ABDUCTEURS':'FIRE HYDRANT',
  'ABDUCTEURS,FESSIERS':'ABDUCTION A LA MACHINE BUSTE PENCHE~ABDUCTION DE HANCHE AU SOL~ABDUCTION DEBOUT POULIE ELASTIQUE~STANDING ADUCTOR',
  'FESSIERS,ISCHIOS,QUADRICEPS':'PRESSE A CUISSE ASSISE PIEDS EN HAUT~PRESSE A CUISSE INCLINE PIEDS EN HAUT',
  'QUADRICEPS,ADDUCTEURS,FESSIERS':'PRESSE A CUISSE INCLINE PIEDS ECARTES',
  // LA VERSION FESSIER DU BELT SQUAT (05/10/2026) : buste penché, hanches
  // reculées, le fessier mène et le quadriceps suit.
  'FESSIERS,QUADRICEPS':'SQUAT AU BELT SQUAT VERSION FESSIER'
};
const EX_GUIDE_CARDIO='BATTLE ROPE~CORDE A SAUTER~ESCALIERS~JUMPING JACK~LE SKIERG~MONTE DE GENOUX~POWER RUN~QUAD STOMP~RAMEUR~TAPIS DE COURSE~TAPIS DE COURSE COURIR~TAPIS DE COURSE MARCHE AVEC PENTE~VELO D INTERIEUR~VELO ELLIPTIQUE';
// Les exercices tenus sans mouvement : leur technique est l'isométrie par défaut
// (POIDS_TECHNIQUE.isometrie = 0,5), sans que le coach ait à la poser.
const EX_ISOMETRIQUES=Object.freeze(['GAINAGE CHAISE']);
// Le posing n'est pas du travail contre résistance : ces poses ne comptent
// pour aucun muscle, et leur absence n'est pas signalée comme un oubli — même
// traitement que le cardio. Elles étaient rangées sous QUADRICEPS : quinze
// poses à trois séries ajoutaient quarante-cinq séries dures de quadriceps.
// « LE VACUUM » n'y figure pas : c'est un gainage abdominal réel, il reste
// rattaché aux ABDOS.
const EX_GUIDE_POSING='ABDOMINALS AND THIGHS~BACK DOUBLE BICEPS~FRONT DOUBLE BICEPS~FRONT LAT SPREAD~ICARUS POSE~MOON POSE~MOST MUSCULAR POSE~PRIEST MANTIS POSE~QUARTER TURN~REAR LAT SPREAD~SIDE CHEST~SIDE TRICEPS~THE CHRISTMAS THREE~THE KNEEL~VACUUM POSE~ZYZZ POSE';

// Videos YouTube tirees du guide du coach, RELEVE INTEGRAL du 07/09/2026
// sur le guide date du 06/09/2026 : 385 exercices, 430 videos.
// Regeneres par le lecteur de tableaux de scripts/seed_exercices.py, pas
// releves a la main : l'ordre est celui du guide, jamais reordonne.
//
// Seul l'identifiant est stocke, les parametres ?si= des liens de partage
// n'etant que du suivi. Le libelle est celui ecrit entre parentheses dans
// la ligne « Lien video exercice (xxx) : … », conserve tel quel, minuscules
// comprises : c'est ce qui permet de proposer la bonne variante.
//
// LES LIGNES « Lien video … : H » NE SONT PAS DES ENTREES. Quatre-vingts
// lignes du guide portent un H : ce sont les videos que le coach n'a pas
// encore tournees, pas des liens casses.
//
// ── LES VARIANTES D'EXECUTION, ET CE QU'ELLES CHANGENT ─────────────────────
//
// Le guide ecrit une seule ligne pour « PRESSE A CUISSE INCLINEE » et y
// accroche quatre videos etiquetees : pieds en haut, en bas, au milieu,
// ecartes. Ce ne sont pas quatre prises de vue du meme exercice, ce sont
// QUATRE EXERCICES : la sollicitation change, la consigne change, et le
// coach doit pouvoir en prescrire un sans prescrire les autres.
//
// LA VARIANTE PAR DEFAUT N'EST PAS ICI. Elle garde le nom de base et la clef
// d'origine — c'est ce qui preserve l'historique de charge des athletes.
// N'entrent dans cette table que les exercices NEUFS.
//
// `base` SERT A L'IMAGE. Le guide ne fournit qu'une illustration par ligne :
// les variantes pointent sur celle de leur base tant que le coach n'en
// fournit pas d'autre. Le fichier .webp n'est PAS duplique — vingt-neuf
// copies du meme octet dans un depot public, c'est du poids pour rien.
//
// `intro` est la phrase qui ouvre la description : ce que CETTE variante
// change, et rien d'autre. Le seeding la colle devant la description du
// guide. Aucune consigne de securite n'y est inventee.
// ── QUATORZE ETIQUETTES QUI DECRIVENT, AU LIEU DE DISTINGUER ──────────────
//
// Ces exercices n'ont qu'UNE video, et elle est pourtant etiquetee : « prise
// neutre », « grand pas », « 1 corde ». L'etiquette ne distingue rien — il n'y
// a pas d'alternative — elle DECRIT l'execution unique. Sur une pastille
// seule, elle n'apprend rien : « ▶ CLASSIQUE » ne dit pas ce qui est
// classique. Elle est donc versee dans la description au seeding, et retiree
// du libelle de la pastille.
const EX_PRECISIONS=Object.freeze({
  'BATTLE ROPE':'Cordes alternées,​ une main après l\'autre.',
  'CURL LARRY SCOTT':'À la barre⁠ EZ.',
  'DEVELOPPE COUCHE MACHINE':'Prise en pronation, pouces à l\'intérieur.',
  'ELEVATION FRONTALE POULIE':'À la poulie.',
  'ELEVATION LATERALE HALTERE':'Aux haltères.',
  'ESCALIERS':'Une marche à la fois, sans sauter de palier.',
  'EXTENSION TRICEPS POULIE BASSE':'Sur banc incliné.',
  'FENTES ARRIERES BARRE':'Grand pas vers l\'arrière.',
  'MARCHE DU FERMIER':'Aux haltères.',
  'ROWING HALTERE UNILATERAL SUR BANC':'Prise neutre, paume tournée vers le buste.',
  'SQUAT BULGAR HALTERE':'Grand pas, pied arrière surélevé loin du banc.',
  'TIRAGE HORIZONTAL SERRE':'Version classique du guide.',
  'TIRAGE POITRINE LARGEUR EPAULE':'Version classique du guide.',
  'TRICEPS A LA POULIE HAUTE CORDE':'Avec une seule corde.'
});

const EX_VARIANTES=Object.freeze({
  'CURL BARRE PRISE SERREE':{base:'CURL BARRE',nom:'CURL BARRE : PRISE SERRÉE',intro:'Mains à l\'intérieur de la largeur d\'épaules. Le chef long du biceps est mis en avant.'},
  'CURL BARRE PRISE LARGE':{base:'CURL BARRE',nom:'CURL BARRE : PRISE LARGE',intro:'Mains au-delà de la largeur d\'épaules. Le chef court du biceps prend le relais.'},
  'CURL LARRY SCOTT HALTERES UNILATERALE':{base:'CURL LARRY SCOTT HALTERES',nom:'CURL LARRY SCOTT HALTERES : UNILATÉRALE',intro:'Un bras à la fois. Le second bras se repose pendant que le premier travaille.'},
  'CURL LARRY SCOTT MACHINE GUIDEE UNILATERALE':{base:'CURL LARRY SCOTT MACHINE GUIDEE',nom:'CURL LARRY SCOTT MACHINE GUIDEE : UNILATÉRALE',intro:'Une poignée à la fois. Le second bras se repose pendant que le premier travaille.'},
  'CURL LARRY SCOTT POULIE BASSE UNILATERALE':{base:'CURL LARRY SCOTT POULIE BASSE',nom:'CURL LARRY SCOTT POULIE BASSE : UNILATÉRALE',intro:'Une poignée à la fois. Le second bras se repose pendant que le premier travaille.'},
  'CURL MARTEAU A L INTERIEUR':{base:'CURL MARTEAU',nom:'CURL MARTEAU : À L\'INTÉRIEUR',intro:'L\'haltère monte vers l\'épaule opposée, en travers du buste, au lieu de monter devant soi.'},
  'CURL ROTATION ALTERNE':{base:'CURL ROTATION',nom:'CURL ROTATION : ALTERNÉ',intro:'Un bras après l\'autre. Chaque bras récupère pendant que l\'autre monte.'},
  'CURL ROTATION ASSIS ALTERNE':{base:'CURL ROTATION ASSIS',nom:'CURL ROTATION ASSIS : ALTERNÉ',intro:'Un bras après l\'autre. Chaque bras récupère pendant que l\'autre monte.'},
  'CURL SUR BANC INCLINE ALTERNE':{base:'CURL SUR BANC INCLINE',nom:'CURL SUR BANC INCLINE : ALTERNÉ',intro:'Un bras après l\'autre. Chaque bras récupère pendant que l\'autre monte.'},
  'REVERSE CURL HALTERE ALTERNE':{base:'REVERSE CURL HALTERE',nom:'REVERSE CURL HALTÈRE : ALTERNÉ',intro:'Un bras après l\'autre. Chaque bras récupère pendant que l\'autre monte.'},
  'EXTENSION TRICEPS SUR BANC ALTERNE':{base:'EXTENSION TRICEPS SUR BANC',nom:'EXTENSION TRICEPS SUR BANC : ALTERNÉ',intro:'Un bras après l\'autre. Chaque bras récupère pendant que l\'autre travaille.'},
  'DIPS LESTE':{base:'DIPS',nom:'DIPS : LESTÉ',intro:'Avec une charge accrochée à la ceinture. La résistance est constante sur toute l\'amplitude.'},
  'DIPS ELASTIQUE':{base:'DIPS',nom:'DIPS : ÉLASTIQUE',intro:'Avec un élastique en assistance. L\'aide est maximale en bas et disparaît en haut, là où le mouvement est le plus facile.'},
  'DIPS SUR BARRE LESTE':{base:'DIPS SUR BARRE',nom:'DIPS SUR BARRE : LESTÉ',intro:'Avec une charge accrochée à la ceinture. La résistance est constante sur toute l\'amplitude.'},
  'DIPS SUR BARRE ELASTIQUE':{base:'DIPS SUR BARRE',nom:'DIPS SUR BARRE : ÉLASTIQUE',intro:'Avec un élastique en assistance. L\'aide est maximale en bas et disparaît en haut, là où le mouvement est le plus facile.'},
  'DEVELOPPE COUCHE BARRE VERSION INTERMEDIAIRE':{base:'DEVELOPPE COUCHE BARRE',nom:'DEVELOPPE COUCHE BARRE : VERSION INTERMÉDIAIRE',intro:'Version intermédiaire du guide, sans le décompte en trois temps.'},
  'TIRAGE POITRINE MACHINE CONVERGENTE AVEC POIGNEES':{base:'TIRAGE POITRINE MACHINE CONVERGENTE',nom:'TIRAGE POITRINE MACHINE CONVERGENTE, AVEC POIGNÉES',intro:'Avec les poignées indépendantes plutôt que la barre : chaque bras tire sa propre trajectoire.'},
  'PULL OVER CORDE':{base:'PULL OVER',nom:'PULL OVER : CORDE',intro:'À la corde plutôt qu\'à la barre. Les mains peuvent s\'écarter en fin de mouvement et la contraction se prolonge.'},
  'MONTEE DE CORDE SANS LES JAMBES':{base:'MONTEE DE CORDE',nom:'MONTEE DE CORDE, SANS LES JAMBES',intro:'Sans se servir des jambes : tout le corps est monté à la force des bras et du dos.'},
  'PRESSE A CUISSE ASSISE PIEDS EN HAUT':{base:'PRESSE A CUISSE ASSISE',nom:'PRESSE A CUISSE ASSISE : PIEDS EN HAUT',intro:'Pieds hauts et écartés sur la plateforme, orteils vers l\'extérieur. La hanche travaille davantage, le genou moins : les fessiers et les ischios prennent une part réelle de l\'effort.'},
  'PRESSE A CUISSE ASSISE PIEDS EN BAS':{base:'PRESSE A CUISSE ASSISE',nom:'PRESSE A CUISSE ASSISE : PIEDS EN BAS',intro:'Pieds bas sur la plateforme, sous le niveau des hanches. L\'amplitude de genou augmente, le quadriceps encaisse presque tout. Surveille le décollement du bassin en fin de descente.'},
  'PRESSE A CUISSE INCLINE PIEDS EN HAUT':{base:'PRESSE A CUISSE INCLINE',nom:'PRESSE A CUISSE INCLINE : PIEDS EN HAUT',intro:'Pieds hauts et écartés sur la plateforme, orteils vers l\'extérieur. La hanche travaille davantage, le genou moins : les fessiers et les ischios prennent une part réelle de l\'effort.'},
  'PRESSE A CUISSE INCLINE PIEDS EN BAS':{base:'PRESSE A CUISSE INCLINE',nom:'PRESSE A CUISSE INCLINE : PIEDS EN BAS',intro:'Pieds bas sur la plateforme, sous le niveau des hanches. L\'amplitude de genou augmente, le quadriceps encaisse presque tout. Surveille le décollement du bassin en fin de descente.'},
  'PRESSE A CUISSE INCLINE PIEDS ECARTES':{base:'PRESSE A CUISSE INCLINE',nom:'PRESSE A CUISSE INCLINE : PIEDS ÉCARTÉS',intro:'Pieds larges sur la plateforme, orteils vers l\'extérieur. L\'intérieur de cuisse entre dans le mouvement à côté du quadriceps.'},
  'CRUNCH AU SOL AVEC POIDS':{base:'CRUNCH AU SOL',nom:'CRUNCH AU SOL, AVEC POIDS',intro:'Une charge tenue contre la poitrine ou derrière la tête. Le mouvement ne change pas, la résistance oui.'},
  'CRUNCH JAMBES EN APPUI SUR BANC AVEC POIDS':{base:'CRUNCH JAMBES EN APPUI SUR BANC',nom:'CRUNCH JAMBES EN APPUI SUR BANC, AVEC POIDS',intro:'Une charge tenue contre la poitrine ou derrière la tête. Le mouvement ne change pas, la résistance oui.'},
  'TAPIS DE COURSE COURIR':{base:'TAPIS DE COURSE',nom:'TAPIS DE COURSE : COURIR',intro:'En course, sans se tenir à la structure. Balancer les bras comme lors d\'un vrai footing.'},
  'TAPIS DE COURSE MARCHE AVEC PENTE':{base:'TAPIS DE COURSE',nom:'TAPIS DE COURSE : MARCHE AVEC PENTE',intro:'En marche, pente montée. L\'allure baisse, la pente fait le travail.'}
});

// ── LES VARIANTES D'EXECUTION SONT DES EXERCICES A PART ENTIERE ────────
// Depuis le 07/09/2026, une ligne du guide qui portait plusieurs videos
// ETIQUETEES est eclatee : chaque etiquette devient un exercice, avec son nom,
// sa description, ses muscles et SA video — une seule. Voir EX_VARIANTES.
// La variante par defaut GARDE LA CLEF D'ORIGINE, sans quoi tout l'historique
// de charge des athletes serait perdu ; elle garde aussi sa video, desormais
// sans etiquette puisqu'elle n'a plus rien a distinguer.
//
// LES NOMS EN DOUBLON DU GUIDE SONT FUSIONNES, contrairement a la banque.
// La banque garde la premiere ligne d'un nom repete parce qu'il lui faut UNE
// description et UNE image ; une video, elle, ne s'exclut pas. Trente et un
// noms sont en doublon et les lignes suivantes portent 18 tournages de plus
// — trois VELO ELLIPTIQUE, un SHOULDER PRESS, un SLEDGE PUSH… Appliquer ici
// « la premiere gagne » aurait EFFACE des videos deja publiees.
const EX_VIDEOS={
  'AB CRUNCH BENCH':'FVz9WUg51WA',
  'ABDUCTEUR A LA MACHINE':'R_1BY8RDQu8',
  'ABDUCTEUR ASSIS AVEC ELASTIQUE':'H3UmtXfsqfU',
  'ABDUCTION A LA MACHINE BUSTE PENCHE':'nfni4gEGZOQ',
  'ABDUCTION DE HANCHE AU SOL':'bn2G9nEgQlA',
  'ABDUCTION DEBOUT POULIE':'Ug9-lSDkyf0|poulie~vDtm9-Y0nUU',
  'ABS ROLLER':'KNvpfZwCIGY',
  'ADDUCTEUR A LA MACHINE':'OF2L7WgIgT0',
  'ADDUCTION DEBOUT POULIE':'j-SsfiBFryE',
  'ARRIERE EPAULE A LA MACHINE':'aLF9qNYRMKU',
  'BACK DOUBLE BICEPS':'kuHtzeXfN_Y',
  'BARBELL THUSTERS':'OL-fp3Jh9Ec',
  'BARRE AU FRONT':'NKfXisq8jjk',
  'BARRE AU FRONT BANC INCLINE':'hdnCvMzF620',
  'BATTLE ROPE':'re5BD58vVzA',
  'BICEPS BRAS EN CROIX':'wjAiS5WcidU',
  'BOBINE DANDRIEU':'atdyliYSDXI',
  'BODYWEIGHT SKULL CRUSHER':'vnJDy1-yzj0',
  'BURPEES':'xWWz7LMuUo8',
  'BUTTERFLY':'Zl14TcAURC8',
  'BUTTERFLY UNILATERAL':'iUiplaO_dJQ',
  'CHEST PRESS DEBOUT':'9d4TlKZxD70',
  'CHEST PRESS DEBOUT TRICEPS':'Ds15qWADF9Q',
  'CHUTE DE BOX SAUT':'A1nnzQwqgfA',
  'CLEAN AND JERK':'j0UIugrSKzw',
  'COPENHAGEN PLANK':'EGKFksZh7X8',
  'CORDE A SAUTER':'9m_rS_ICI08',
  'CRUNCH A DOUBLE CONTRACTION SUR BANC':'cCycDNdO0CI',
  'CRUNCH A LA MACHINE':'L7r2MXRTM1M',
  'CRUNCH A LA POULIE':'mmGtxvXQpPg',
  'CRUNCH AU SOL':'BwCq23sWW9E',
  'CRUNCH AU SOL AVEC POIDS':'97UU5UjWGhw',
  'CRUNCH BENCH':'TkLf2wxpVMk',
  'CRUNCH CROISE':'RFSE_bZxoKY',
  'CRUNCH JAMBES EN APPUI SUR BANC':'sYUEQjB36p0',
  'CRUNCH JAMBES EN APPUI SUR BANC AVEC POIDS':'Xpcw2ChpZIM',
  'CRUNCH SUR BANC INCLINE':'3rEP5VCtTHw',
  'CURL A LA POULIE BASSE EN UNILATERAL':'0bXQcxy_FEw',
  'CURL ACCROUPI':'c77vxrRe7mg',
  'CURL ALLONGE POULIE':'lUvCqi4BPE4',
  'CURL ALLONGE POULIE HAUTE':'ggiXGXfOwhk',
  'CURL BARRE':'iz4IwoFnKHA',
  'CURL BARRE BALLET SAC':'KOqhQSNSPLU',
  'CURL BARRE POULIE':'vii41RdW4PM',
  'CURL BARRE PRISE LARGE':'oVJdzW5NR7c',
  'CURL BARRE PRISE SERREE':'lK0sjFDTKFE',
  'CURL CONCENTRE':'LVl3f_xARBE',
  'CURL HALTERES SUR BANC':'bhfIW9J1UsI',
  'CURL LARRY SCOTT':'CEPo7pK2hWc',
  'CURL LARRY SCOTT HALTERES':'UBIlOzpp2NY',
  'CURL LARRY SCOTT HALTERES UNILATERALE':'Ccp6KkDf0hw',
  'CURL LARRY SCOTT MACHINE GUIDEE':'wC0-TYPfhKw',
  'CURL LARRY SCOTT MACHINE GUIDEE UNILATERALE':'CqYKhuThjqs',
  'CURL LARRY SCOTT POULIE BASSE':'9UO3nhbw4Us',
  'CURL LARRY SCOTT POULIE BASSE UNILATERALE':'sBfP7jVwqbw',
  'CURL MARTEAU':'k0o-UsnVnHE',
  'CURL MARTEAU A L INTERIEUR':'poX9Ps1Purg',
  'CURL MARTEAU POULIE':'PIgRGPdPtRc|unilatérale~D3VZ8CY9AJY',
  'CURL MARTEAU SUR BANC':'Rh9u6u2gMGs',
  'CURL POULIE HAUTE':'ZQXaDtakh5E',
  'CURL ROTATION':'AZEyqRwpXpo',
  'CURL ROTATION ALTERNE':'9ft7IBuCYHI',
  'CURL ROTATION ASSIS':'PZ3POAJfD2U',
  'CURL ROTATION ASSIS ALTERNE':'ttrlcilhW-8',
  'CURL SUR BANC INCLINE':'WVyGDP9E3cc',
  'CURL SUR BANC INCLINE ALTERNE':'ZGVxFWenBmU',
  'CURL SUR BANC POULIE':'Uj-Gg0kEdZA',
  'CURL UNILATERAL POULIE BASSE AVEC COUDE EN ARRIERE':'PKjnEjzG-b8',
  'DEEP SQUAT':'G-ZYRHzPfdA',
  'DEVELOPPE A LA MACHINE ASSIS':'sCD47T_vLTE',
  'DEVELOPPE A LA MACHINE CONVERGENTE':'MFbowUNpiVY',
  'DEVELOPPE A LA MACHINE CONVERGENTE HAUT DE PECS':'DVQ6nW2o7K4',
  'DEVELOPPE A LA MACHINE CONVERGENTE UNILATERAL':'XJRsOUxFF3c',
  'DEVELOPPE COUCHE BARRE':'XkngJgHvL1Q',
  'DEVELOPPE COUCHE BARRE AVEC CALLE':'mm8LTUmbiWE',
  'DEVELOPPE COUCHE BARRE VERSION INTERMEDIAIRE':'wQd3fKk9IFU',
  'DEVELOPPE COUCHE HALTERE':'eRglSFbnRro',
  'DEVELOPPE COUCHE LARSEN':'friPk1G0KYQ',
  'DEVELOPPE COUCHE MACHINE':'rukZ4RKk3XM',
  'DEVELOPPE COUCHE PRISE SEREE':'m2W1WX_B-d8',
  'DEVELOPPE COUCHE SMITH MACHINE':'ZNzkQdorY_s',
  'DEVELOPPE DECLINE BARRE':'4QXM_sYrTYs',
  'DEVELOPPE DECLINE BARRE SMITH MACHINE':'8HKUDubEzzo',
  'DEVELOPPE DECLINE HALTERE':'3642quR1wUQ',
  'DEVELOPPE EPAULE AU LANDMINE':'zAKujF8uT5A',
  'DEVELOPPE EPAULES BARRE':'uexfWeHcOzI',
  'DEVELOPPE EPAULES HALTERES':'qNBafnsRHSk',
  'DEVELOPPE INCLINE BARRE':'ppMl-G-czaI',
  'DEVELOPPE INCLINE HALTERE':'22lgyhmVdwE',
  'DEVELOPPE INCLINE SMITH MACHINE':'Wku24QRTfIk',
  'DEVELOPPE MILITAIRE BARRE':'d1lml54ghD4',
  'DEVELOPPE MILITAIRE ELASTIQUE':'qRUPx5rP4lY',
  'DEVELOPPE MILITAIRE HALTERES':'NE30b5jUlQk',
  'DEVELOPPE MILITAIRE MACHINE':'SSJHA6FsMrA',
  'DEVELOPPE MILITAIRE SMITH MACHINE':'u7pE85qgADo',
  'DEVELOPPE NUQUE BARRE':'yVzQwgnFIY0',
  'DEVELOPPE NUQUE SMITH MACHINE':'O584VfZH_Tc',
  'DIPS':'FzKJXdDd3sg',
  'DIPS ASSISTE':'0cVzj1QY22A',
  'DIPS AUX ANNEAUX':'gi681RswruA',
  'DIPS BAS DE PECS':'fDcC5_avKhE',
  'DIPS ELASTIQUE':'zSb4rtKsJcw',
  'DIPS LESTE':'XhukGFy1GIM',
  'DIPS MACHINE':'OGIk68Ns8OE',
  'DIPS MACHINE BAS DE PECS':'q9bFMjaMaNs',
  'DIPS MACHINE GUIDEE':'0cVzj1QY22A',
  'DIPS SUR BARRE':'x-w4hOidKiI',
  'DIPS SUR BARRE ELASTIQUE':'dfwkWHaQeIA',
  'DIPS SUR BARRE LESTE':'8PyYBvQsMIU',
  'DONKEY KICK SMITH MACHINE':'6iqTIzgOC-s',
  'ECARTE HALTERE SUR BANC':'HEUcQxVrLPk',
  'ECARTE HALTERE SUR BANC DECLINE':'KeyWa4IVjV8',
  'ECARTE HALTERE SUR BANC INCLINE':'6sOhlYH3_vE',
  'ECARTE MACHINE':'zaea9fS7ruI',
  'ECARTE POULIE BASSE':'JHl-Z7oCKAk',
  'ECARTE POULIE BASSE EN UNILATERAL':'FmaXbWtn7rI',
  'ECARTE POULIE BASSE SUR BANC':'14kXuvQPteg',
  'ECARTE POULIE HAUT EN UNILATERAL':'yTuLxE8uaaM',
  'ECARTE POULIE HAUTE':'oFuT5qWukeo',
  'ECARTE POULIE HAUTE BUSTE PENCHE':'mG01pbicLUY',
  'ECARTE POULIE HAUTE CONTRE BANC':'zuqF-W6g688',
  'ECARTE POULIE SUR BANC':'KPWQZ7ozFxY',
  'ECARTE POULIE SUR BANC INCLINE':'nhvitIIWnkQ',
  'ELEVATION ARRIERE EPAULE POULIE':'NrhkoAHnDXk',
  'ELEVATION ARRIERE POULIE COUCHEE':'6AjckaPPW0Y',
  'ELEVATION FRONTALE BOUTEILLES':'t2PDnkhsHRU',
  'ELEVATION FRONTALE DISQUE DE POIDS':'DG-3UC75-qo',
  'ELEVATION FRONTALE HALTERES':'03Q3Uo6gWB8',
  'ELEVATION FRONTALE MACHINE':'dFvS3-tNfsU',
  'ELEVATION FRONTALE POULIE':'hyjPzqipGYU',
  'ELEVATION FRONTALE SUR BANC INCLINE':'9MhPsjrAOzg',
  'ELEVATION LATERALE ASSIS SUR BANC':'o-Jj6dJMdUo',
  'ELEVATION LATERALE HALTERE':'D0cB-ZHzv18',
  'ELEVATION LATERALE HALTERE UNILATERAL':'wWpuwLUFNNU~aT6wLu1nJEE',
  'ELEVATION LATERALE MACHINE DEBOUT':'S6ya3suTFZg',
  'ELEVATION LATERALE POULIE':'xbGG35-XBsE',
  'ELEVATION LATERALE POULIE BASSE UNILATERAL':'FSO2KR7Wf_k',
  'ELEVATION LATERALE POULIE UNILATERAL':'fbO59EgciIc',
  'ELEVATION LATERALE SUR BANC A 60':'_3ieqodrwQE',
  'ELEVATION Y':'UoAyRRuls_0',
  'ESCALIERS':'9hMV5iT03fU',
  'EXTENSION DE BUSTE ASSIS SUR BANC':'z86zIOIwhkg',
  'EXTENSION DE BUSTE SUR BANC 1':'1j8sd9Qdht0',
  'EXTENSION DE HANCHE AU SOL':'D7JT4C1U6EY',
  'EXTENSION DE HANCHE MACHINE':'tgEmxkjo_XE',
  'EXTENSION DE HANCHE POULIE BASSE':'74GuQRTF9Dg',
  'EXTENSION DE HANCHE POULIE CROISE':'EdOglCaMffI',
  'EXTENSION DE HANCHE POULIE PIEDS HAUT':'AUp36G5pRY8',
  'EXTENSION DE HANCHE POULIE SUR BANC':'chBbBOGBqHo',
  'EXTENSION TRICEPS AU DESSU DE LA TETE':'NoqCbDfjhwo',
  'EXTENSIONS POULIE BASSE TRICEPS':'MM4B1gnFr48',
  'EXTENSIONS TRICEPS POULIE EN X':'23Py4_e49fQ',
  'EXTENSIONS TRICEPS SUR LE COTE POULIE':'eag3x-Nai-I',
  'EXTENSIONS VERTICALES TRICEPS':'8iptJB_eZGI',
  'EXTENSIONS VERTICALES TRICEPS BARRE':'4hPD84bSQQc',
  'EXTENSIONS VERTICALES TRICEPS UNILATERALE':'Xb2mXvnWkYc',
  'EXTENSION TRICEPS POULIE BASSE':'NowCcJtxKYQ',
  'EXTENSION TRICEPS SUR BANC':'EZc87x3kUGE',
  'EXTENSION TRICEPS SUR BANC ALTERNE':'MrjCpXXfYso',
  'EXTENSION TRICEPS SUR BANC UNILATERALE':'MrjCpXXfYso',
  'FACE PULL':'xDce-6LlSdQ',
  'FACE PULL ASSIS':'ABbvATHFdCw',
  'FENTE BULGARE A LA BELT SQUAT':'VedI7vEfVEQ',
  'FENTES A LA V SQUAT':'A5UqC3QceBQ',
  'FENTES ARRIERE BARRE SMITH MACHINE':'AyWxRNvGvXY',
  'FENTES ARRIERE HALTERE':'f1IP86WUdGg',
  'FENTES ARRIERES BARRE':'bAjmBGzpa3M',
  'FENTES BARRE':'kRxIrZVixHQ',
  'FENTES BARRE SMITH MACHINE':'peXtq1w8SrM',
  'FENTES HALTERE':'hvfdPZgQIL8',
  'FESSIER A LA MACHINE DE TRACTION':'1trlTFH50qo',
  'FIRE HYDRANT':'zuAw2Iac7Qo',
  'FLEXION AVANT BRAS A LA BARRE DEBOUT':'tfnq_ivEhk0',
  'FLEXION AVANT BRAS A LA BARRE SUR BANC PRONATION':'d0xDarAqFtw',
  'FLEXION AVANT BRAS A LA BARRE SUR BANC SUPINATION':'gnYulhY7BBs',
  'FLEXION AVANT BRAS UNILATERAL PRISE NEUTRE':'d8_b34NFj1Y',
  'FLEXION LATERAL DE BUSTE AU BANC':'J1WxgfWHDKk',
  'FLEXION LATERAL DE BUSTE AVEC POIDS':'LrHYTuIqQn0',
  'FLEXION LATERAL DE BUSTE POULIE':'fWJUKEo-HpE',
  'FLEXIONS DE BUSTE EN GAINAGE LATERAL':'lm-BA2-ndFs',
  'FLEXIONS LATERALS AU SOL':'30k428nlsr8',
  'FLOOR PRESS':'8YOwfsXdO-k',
  'FRONT DOUBLE BICEPS':'ibtM-lYpuWY',
  'FRONT LAT SPREAD':'RLT7zJGXiho',
  'GAINAGE CHAISE':'XtdMBpZbuw4',
  'GAINAGE HOLLOW HOLD':'JQBarsSJJjA',
  'GAINAGE LATERAL':'P08e6sq4TJI',
  'GAINAGE PLANCHE':'C93H-bUXYdw',
  'GOBELET SQUAT A LA BELT SQUAT':'Trhq1sflhbk',
  'GOOD MORNING':'zFFaRDZr39k',
  'HACKSQUAT':'cndf5RF9NvE',
  'HIGH ROW HAMMER STRENGTH':'cyWz74I3QjU',
  'HIP THRUST':'33V0XER5Msw',
  'HIP THRUST AU SOL':'7Q2z-DQSrcg',
  'HIP THRUST MACHINE':'npL42UPPf-w',
  'HIP THRUST MACHINE 1':'npL42UPPf-w',
  'HIP THRUST SAC':'I8hE8fD0MnY',
  'HIP THRUST UNILATERAL HALTERE':'08mm5x4E1E0',
  'HYPTRUST A LA SMITH MACHINE':'fhU8DR5VzL0',
  'ISO LATERAL FRONT LAT PULLDOWN':'KIudKxRZxjg',
  'JEFFERSON CURL SUR STEP':'KiFbRr80PIw',
  'JUMPING JACK':'KOguDyOwDDQ',
  'KETTLEBELL SWING':'mkB6XT_Q8xI',
  'KICKBACK HALTERE':'r6VgOCmmtHk',
  'KICKBACK POULIE':'pMDoP3lJ3Wc',
  'LATERAL RAISE':'3GMXX4YncEg',
  'LE SKIERG':'c5j5yQ2h4IE',
  'LE VACUUM':'l6xTQXbtrT0',
  'LEG CURL ALLONGE':'E6BljjBe75o~qbxoWHEewWg|unilatérale',
  'LEG CURL ALLONGE EN UNILATERAL':'qbxoWHEewWg',
  'LEG CURL ALLONGE HALTERE':'XM9zewPOlFY',
  'LEG CURL ASSIS':'RhyYQ8t8wnQ',
  'LEG CURL DEBOUT':'vWucf34VZ24',
  'LEG EXTENSION':'6iwU5rNMPyY~MWvxCwKLy_8|unilatérale',
  'LEG EXTENSION ALLONGE ELASTIQUE':'TxGOiwhZuNs',
  'LEG EXTENSION HALTERE':'gRANJgo3_IE',
  'LES CISEAUX':'3aJonhU3taU',
  'MARCHE DU FERMIER':'lpGhRqO0SdM',
  'MOLLETS A LA HACKSQUAT EN UNILATERAL':'a8C5yK2HiFo',
  'MOLLETS A LA PRESSE ASSISE':'vAz16yUmUdk',
  'MOLLETS A LA SMITH MACHINE':'lD4CUFENxUw',
  'MOLLETS ASSIS A LA MACHINE':'DmpBsJePiF0',
  'MOLLETS ASSIS AVEC BARRE':'ziOAxb2fFHI',
  'MOLLETS DEBOUT UNILATERAL':'pCed2K5FahA',
  'MONTE DE GENOUX':'cVODnBtqwQQ',
  'MONTEE DE CORDE':'Pa4QUC9AvuA',
  'MONTEE DE CORDE SANS LES JAMBES':'784mHikopwc',
  'MONTER SUR BANC':'EZSoj-O81Qc',
  'MONTER SUR BANC HALTERE':'RZrSoGxiHy0',
  'MONTER SUR BANC POULIE':'wIuo0sNQjWk',
  'MONTER SUR BANC SMITH MACHINE':'SZ6-UacEFlg',
  'MOST MUSCULAR POSE':'wGfhU25o5dU',
  'MOUNTAIN CLIMBER':'G7OXhpaWdyk',
  'MUSCLE UP':'yiEeE7zl4Nk',
  'NORDIC CURL AVEC ELASTIQUE':'TymvS3ySuLI',
  'OBLIQUE ABDOMINAL CRUNCH':'wOB92ugS4rg',
  'OISEAUX BUSTE PENCHE':'LVB0b1hqS18',
  'OISEAUX BUSTE PENCHE MACHINE':'I_4JAVPasCg',
  'OISEAUX BUSTE PENCHE POULIE':'s8PvcZ6uoJQ',
  'OISEAUX BUSTE PENCHE SUR BANC':'yyQTOUang8U',
  'OISEAUX SUR BANC INCLINE':'BCmcPvPy8UU',
  'PALLOF PRESS':'9jLgQWEAweA',
  'PENDULUM SQUAT':'G62rKjS1uZg',
  'PIKE PUSH UP':'yck9CKTGRKg',
  'POMPE AUX ANNEAUX':'boADV98rVBM',
  'POMPES':'QaAKR9-Xg8s',
  'POMPES AVEC ELASTIQUE':'juxUa9yBcms',
  'POMPES DECLINE':'M9unTLqY5UU',
  'POMPES INCLINE':'ll6dPz4PMBs',
  'POMPES LESTEE':'050P74LXEuc',
  'POMPES SAUTEES ALTERNEES SUR BALLON':'AInbAD5dEmw',
  'POMPES SAUTES':'MVyuo9UUsyU',
  'POMPES SERREES':'8aHryrZXbl8',
  'POWER CLEAN':'uNgVzDJxpV0',
  'PRESSE A CUISSE ASSISE':'wt16KVvh1t0',
  'PRESSE A CUISSE ASSISE PIEDS EN BAS':'JNs02Qx-94A',
  'PRESSE A CUISSE ASSISE PIEDS EN HAUT':'4L6MnDYPWrM',
  'PRESSE A CUISSE INCLINE':'1GMcszqB5nU',
  'PRESSE A CUISSE INCLINE PIEDS ECARTES':'r_tQQhyOqP0',
  'PRESSE A CUISSE INCLINE PIEDS EN BAS':'tL01XB5mt-o',
  'PRESSE A CUISSE INCLINE PIEDS EN HAUT':'MYC-woyTDjY',
  'PULL OVER':'QvPwzfj53Yo',
  'PULL OVER CORDE':'7ZO3UQ9Nfns',
  'PULL OVER SUR BANC':'yQOOUpQ1XLo',
  'PULL OVER SUR BANC INCLINE':'WL64uMYteHk',
  'PULL OVER UNILATERAL':'6Cl7Ap-ZVKA',
  'PUSH PRESS':'Dc9_4c3QHAY',
  'QUARTER TURN':'IeoES8f2pzI',
  'RACK POOL':'RKrStwjpOJU',
  'RAMEUR':'5dszXoVUBpE',
  'RDL MACHINE GUIDEE':'iICtkCEm580',
  'REAR LAT SPREAD':'aP6zi0nLoRQ',
  'RELEVE DE GENOUX A LA BARRE DE TRACTIONS':'2qTuftNVea0',
  'RELEVE DE GENOUX SUR BANC':'o7yH21RfHuk',
  'RELEVE DE JAMBE A LA PLANCHE INCLINE':'X5Eo6Ed4A1Y',
  'RELEVE DE JAMBE AU SOL':'8MSNoZ3cn3k',
  'RELEVE FESSIER BANC A LOMBAIRE':'qScNTWJvePw',
  'RENEGATE ROW':'jVFQsPvQvDI',
  'RENVERSEMENT DE PNEU':'oLRpfZ9tBAg',
  'REVERSE CURL BARRE':'gOpm8cGMcro',
  'REVERSE CURL HALTERE':'jD50Edvd3Fk',
  'REVERSE CURL HALTERE ALTERNE':'NkDpQA4Z65Q',
  'ROTATION AU SOL':'9uhJNmDoQ5g',
  'ROTATION DE BUSTE POULIE HAUTE':'KpHnRobga7w',
  'ROWING BARRE ALLONGE SUR BANC INCLINE':'bTxbZo_OwFs',
  'ROWING BARRE LARGE':'ZO39lHz1JcA',
  'ROWING BARRE POULIE BASSE':'653caLE6o0E',
  'ROWING BARRE SERRE':'4ohNfbtOgRo',
  'ROWING BARRE T':'JHMuhO2Ucxc',
  'ROWING BARRE T PRISE LARGE':'b-MlvA0pp_M',
  'ROWING HALTERE ALLONGE SUR BANC INCLINE':'f9sZGtsvkSw~2Z6H2Gw6F9Y',
  'ROWING HALTERE BUSTE PENCHE':'9BkM3Qcsm1E',
  'ROWING HALTERE UNILATERAL':'U_p444dVcyc',
  'ROWING HALTERE UNILATERAL SUR BANC':'3XL0po4GBf8',
  'ROWING INVERSE':'MDBlT6JQSmo',
  'ROWING PENDLAY SMITH MACHINE':'JTPbny6h9ZY',
  'ROWING PLANCHE BARRE':'5tPpoZnfDpo',
  'ROWING POULIE BASSE ALLONGE SUR BANC INCLINE':'GPqND7rIyyY',
  'ROWING POULIE BASSE UNILATERAL':'O_SKtNXB3f8',
  'ROWING POWER SMITH DORS':'aQRo16_sOic',
  'ROWING POWER SMITH TRAP':'LNwMKf14RA8',
  'ROWING SAC UNILATERAL SUR BANC':'l8-y2clN9bw',
  'ROWING TRAPEZES POULIE HAUTE':'aUmInYG11Og',
  'ROWING UNILATERAL A LA LANDMINE':'bDUP2szgrVI',
  'SAUT SUR LES COTES':'oxbIJkTtd1I',
  'SAUTS SUR PLACE AVEC ELASTIQUE':'MqBV79Kh2DM',
  'SEAL ROW AVEC HALTERE':'klTKlMvQzKc',
  'SHOULDER PRESS':'iKyWSbytzwc~SSJHA6FsMrA',
  'SHOULDER PRESS PURE METEOR':'F33kVe_jihM',
  'SHRUG':'uUmkFDmlcDk',
  'SHRUG DEBOUT A LA MACHINE':'dZMC8Jq2zKg',
  'SHRUG DELAVIER':'jSoYD4GdDBk',
  'SHRUG HALTERE':'B5hmuSx1mC8',
  'SHRUG HALTERES SUR BANC':'gopei-Ydgcw',
  'SHRUG POULIE':'7U1QIfG5HS4',
  'SIDE CHEST':'Z-DvXUks_HA',
  'SIDE TRICEPS':'lZhMqbyAF-c',
  'SISSY SQUAT':'9xMVK3XoF9c',
  'SLEDGE PUSH':'v3gLFHixRZw~erTO5v_jUTw',
  'SNATCH':'YYldg47XsvE',
  'SOULEVE DE TERRE':'kLljKu7GHik',
  'SOULEVE DE TERRE HALTERE':'j4xZMqbK_sQ',
  'SOULEVE DE TERRE PIEDS SURELEVE':'k0C5l3NKNYQ',
  'SOULEVE DE TERRE ROUMAIN':'_4e2rmvj-jw',
  'SOULEVE DE TERRE ROUMAIN HALTERES':'KZXyPNBJZ1c',
  'SOULEVE DE TERRE ROUMAIN LANDMINE':'bxjAJDxEICU',
  'SOULEVE DE TERRE ROUMAIN SMITH MACHINE':'dz9M8TzImjI',
  'SOULEVE DE TERRE ROUMAIN UNILATERAL':'dVnBmmX1hyI',
  'SOULEVE DE TERRE SUMO':'7ULZmS8AN_U',
  'SOULEVE DE TERRE TRAP BARRE':'2OKqcY7b3Y0',
  'SPIDER CURL':'NhQbhiiMeKk',
  'SPIDER CURL HALTERE':'SaG0U9Zigrs',
  'SPIDER CURL HALTERE UNILATERALE':'rSnAnAmJ-6I',
  'SQUAT':'E-oKK43BDbg',
  'SQUAT ASSIS':'XMgNNzh5qSw',
  'SQUAT AU BELT SQUAT VERSION FESSIER':'LEgFf4uYVDU',
  'SQUAT AU BELT SQUAT VERSION QUADS':'gtfYTelyoao',
  'SQUAT AVEC HALTERES':'SF6W_Q61fKQ',
  'SQUAT AVEC HALTERES TENDU ENTRE LES JAMBES':'lUuPEpfdgrs~muD3KTpELWQ',
  'SQUAT AVEC SAC':'7MkkfO0mxss',
  'SQUAT AVEC SAC AVANT':'g-QUqhO8Y80',
  'SQUAT BARRE DEVANT':'N9YkSnXwQUs~z8Bnpqp0jf4',
  'SQUAT BULGAR HALTERE':'QqhYbQ8JV9s',
  'SQUAT BULGAR SMITH MACHINE':'QROyhLDz384',
  'SQUAT SAUTE':'QxBVkxN9SbA',
  'SQUAT SAUTE SUR BOX':'Kj0nfV0pofM',
  'SQUAT SERRE':'LuNA_72Xx0A',
  'SQUAT SMITH MACHINE':'r9S7bn3AQB8',
  'SQUAT SUMO':'JjIixIqBhT8',
  'STANDING ADUCTOR':'3davfj5H0-I',
  'SUPERMAN':'ufE3kTZNPmY',
  'TAPIS DE COURSE':'M3lUil8OpVs',
  'TAPIS DE COURSE COURIR':'_ynGR8PzXMo',
  'TAPIS DE COURSE MARCHE AVEC PENTE':'1Vd_9cmUGek',
  'TIRAGE DOS FACE A LA POULIE':'jGsrmcp-_fU',
  'TIRAGE DOS POULIE VIS A VIS':'xOC3H27CWDE',
  'TIRAGE HORIZONTAL LARGE':'3g4_g5U2Nrc',
  'TIRAGE HORIZONTAL LARGE NEUTRE':'6bIEsfXbNZg',
  'TIRAGE HORIZONTAL MACHINE CONVERGENTE NEUTRE':'Imrua58mXfQ',
  'TIRAGE HORIZONTAL MACHINE CONVERGENTE PRONATION':'vNAc-6JGmq8',
  'TIRAGE HORIZONTAL MACHINE CONVERGENTE UNILATERAL':'rGQlnFvX21k',
  'TIRAGE HORIZONTAL MACHINE SUPINATION':'GOe3JcJRbTU',
  'TIRAGE HORIZONTAL MACHINE UNILATERAL NEUTRE':'tfhyMKxjWbk',
  'TIRAGE HORIZONTAL MACHINE UNILATERAL SUPINATION':'8m7uRhUairE',
  'TIRAGE HORIZONTAL SERRE':'br_sJJabsoY',
  'TIRAGE HORIZONTAL SUPINATION':'-hVEVW6_GvU',
  'TIRAGE HORIZONTAL UNILATERAL':'uW72hK0BZNs',
  'TIRAGE HORIZONTAL UNILATERAL SUR BANC':'SExy5A52f78',
  'TIRAGE MENTON BALET SAC':'9_WVB00Iw34',
  'TIRAGE MENTON BARRE':'nFIOrSLImAY',
  'TIRAGE MENTON POULIE':'G_WDCDUx7NI',
  'TIRAGE NUQUE':'b70Qvo6z-14',
  'TIRAGE POITRINE LARGE':'Xj79RNchjHY',
  'TIRAGE POITRINE LARGEUR EPAULE':'T--lg679EZM',
  'TIRAGE POITRINE MACHINE CONVERGENTE':'h-hI1vkjtOw',
  'TIRAGE POITRINE MACHINE CONVERGENTE AVEC POIGNEES':'oXrb7pi0mV4',
  'TIRAGE POITRINE PRISE NEUTRE':'ipHOUCzFDdY',
  'TIRAGE POITRINE SERRE':'WJ1hRIYkQfc',
  'TIRAGE POITRINE SUPINATION':'ywyizyYwIDM',
  'TIRAGE POITRINE UNILATERAL POULIE':'oIytTB8DitI',
  'TIRAGE UNILATERAL SUR BANC':'A8Yz6smLOxY',
  'TIRAGE VERTICAL A LA BARRE':'0YBGX_Nv_D4',
  'TIRAGE VERTICAL A LA BARRE SMITH MACHINE':'fMe32CiswEM',
  'TIRAGE VERTICAL A LA POULIE':'hHv7FjRXYWM',
  'TRACTION PRISE SERREE':'PEdscaySscs~9jKSAZs1O2E|lesté',
  'TRACTIONS':'2E_CeP0c9tk',
  'TRACTIONS ELASTIQUE':'b4F6uet65BY',
  'TRACTIONS LESTE':'njg3c4HgmBk',
  'TRACTIONS MACHINE ASSISTE':'Eyn2oGrEpo4',
  'TRACTIONS PRISE NEUTRE':'_ozJDq-7680',
  'TRICEPS A LA POULIE HAUTE BARRE':'TgLkrK3UE2A',
  'TRICEPS A LA POULIE HAUTE CORDE':'vzfUXQdMKdg',
  'TRICEPS A LA POULIE HAUTE POIGNEE':'fs0vfBZJn4k',
  'TRICEPS A LA POULIE HAUTE UNILATERALE':'qmD9EgEX4UQ',
  'TRICEPS DIPS':'k1w4e_5yakI',
  'V SIT UP':'LfkPKKmdRUw',
  'V SQUAT FACE AU SIEGE':'herE44ij8E8~9TozG5srGpQ',
  'VELO D INTERIEUR':'T8rfSakJhF0',
  'VELO ELLIPTIQUE':'K2bR5HqYdDo~VrSUAg_CAaE~MCLtFq7UZbc',
  'VERTICAL TRACTION':'p8tDcxQlFfI',
  'VIKING PRESS PRISE NEUTRE':'-gTayX931dM~aMjqmQepfMI',
  'WALL BALL':'kXKncyavm5s',
  'ZYZZ POSE':'CmsLRVuHKNg',

  // ══ ENTREES CONSERVEES, ABSENTES DU GUIDE DU 06/09/2026 ═══════════════
  //
  // Ces 9 clefs n'ont plus de ligne dans le guide. ON NE LES SUPPRIME PAS :
  // le coach a pu retirer une ligne du document sans vouloir retirer la
  // video de l'application. Huit sont des poses de posing dont le guide
  // porte desormais « Lien video pose : H » — la video existe, c'est la
  // LIGNE du document qui a change, et la retirer d'ici ferait disparaitre
  // une pastille qui fonctionne. En attente d'arbitrage.
  //
  // ⚠ UNE DIXIEME CLEF A ETE RETIREE, ET AUCUNE VIDEO AVEC ELLE.
  // « VELO DINTERIEUR » — sans l'espace apres le D — etait un doublon EXACT de
  // « VELO D INTERIEUR », meme identifiant T8rfSakJhF0, ecrit par un lecteur qui
  // effacait l'apostrophe sans mettre d'espace a la place. exKey() rend
  // toujours la forme avec l'espace : aucun appel n'a jamais pu l'atteindre.
  // Ce n'etait donc pas une entree a arbitrer, c'etait une faute de frappe, et
  // sa video est plus haut sous la bonne clef.
  'ABDOMINALS AND THIGHS':'wdbFj-jhKl4',
  'ICARUS POSE':'jWoFo0-Jd8c',
  'MOON POSE':'20tiRyvSfs8',
  'PRIEST MANTIS POSE':'JXNO7K3xai4',
  'QUAD STOMP':'f_BLLy-sWRc',
  'SLEDGE':'gdtO9qeaiCE|Pull~QwscR2BhdEg|Push',
  'THE CHRISTMAS THREE':'N667RCOkLbI',
  'THE KNEEL':'EYMaT5QRp70',
  'VACUUM POSE':'-BCjyR3GqeM'
};

// Repli pour tout ce qui n'est PAS dans le guide : variantes saisies par un
// athlète, noms sortis de l'OCR d'une fiche papier, exercices ajoutés depuis.
// Tableau ORDONNÉ — la PREMIÈRE règle qui matche gagne, et cet ordre est le
// cœur du mécanisme :
//   1. Les motifs SPÉCIFIQUES d'abord. « LEG EXTENSION » doit sortir
//      quadriceps SEUL ; placé après « SQUAT », il hériterait des fessiers et
//      des ischios qu'il ne travaille pas.
//   2. Les épaules AVANT les pectoraux. « DEVELOPPE » suivi de n'importe quoi
//      puis « MACHINE » doit pouvoir désigner un développé machine pour pecs,
//      mais « DEVELOPPE MILITAIRE À LA MACHINE » est un mouvement d'épaules :
//      la règle épaules doit donc trancher la première.
//   3. Les motifs GÉNÉRIQUES en dernier.
// Toute règle ajoutée doit l'être en connaissance de sa position.
const EX_REGLES=[
  // — spécifiques —
  {motif:/\bLEG EXTENSION\b/,                                        p:['QUADRICEPS'], s:[]},
  // R15 — LE NORDIC CURL EST UN EXERCICE D'ISCHIOS (Kevin, 17/09/2026). Seul
  // « NORDIC CURL AVEC ELASTIQUE » etait dans le guide : « NORDIC CURL » ou
  // « NORDIC HAMSTRING CURL » tombaient sur la regle du curl, plus bas, et
  // sortaient BICEPS. Place ICI, avant elle, il ne peut plus y arriver.
  {motif:/\bLEG CURL|\bNORDIC\b|SOULEVE DE TERRE ROUMAIN|ROMANIAN|GOOD MORNING/,p:['ISCHIOS'],    s:['FESSIERS']},
  {motif:/\bFACE PULL|OISEAU|REAR DELT|ELEVATION POSTERIEURE/,       p:['DELT_POST'],  s:['TRAP_MED']},
  {motif:/\bELEVATION LATERALE|LATERAL RAISE/,                       p:['DELT_LAT'],   s:[]},
  {motif:/\bTIRAGE MENTON|UPRIGHT ROW/,                               p:['DELT_LAT'],   s:['TRAP_SUP']},
  {motif:/\bELEVATION FRONTALE|FRONT RAISE/,                        p:['DELT_ANT'],   s:[]},
  // épaules avant pectoraux — voir note 2 ci-dessus
  {motif:/\bSHOULDER PRESS|OVERHEAD PRESS|DEVELOPPE.*(MILITAIRE|EPAULE|NUQUE)/,
                                                                     p:['DELT_ANT'],   s:['TRICEPS','DELT_LAT']},
  // Les écartés et le butterfly, coude fixe : pas de triceps (30/09/2026).
  // Avant la règle des développés, qui les prendrait sinon.
  {motif:/\bECARTE|PEC (DECK|FLY)|BUTTERFLY|CHEST (FLY|CROSSOVER)|\bCROSSOVER/,
                                                                     p:['PECTORAUX'],  s:['DELT_ANT']},
  {motif:/\bDEVELOPPE.*(COUCHE|MACHINE|INCLINE|DECLINE)|BENCH|PEC (DECK|FLY)|ECARTE/,
                                                                     p:['PECTORAUX'],  s:['DELT_ANT','TRICEPS']},
  // CHEST PRESS et la famille des poussées horizontales : le guide en contient
  // plusieurs déclinaisons, aucune règle ne les couvrait.
  {motif:/\bCHEST (PRESS|FLY|CROSSOVER)|BUTTERFLY|\bPOMPE|PUSH ?UP|CROSSOVER/,
                                                                     p:['PECTORAUX'],  s:['DELT_ANT','TRICEPS']},
  // Le pull-over, bras tendus : le biceps n'y est pour rien. Avant la règle
  // des tirages, qui le prendrait sinon.
  {motif:/\bPULL ?OVER/,                                             p:['DORSAUX'],    s:[]},
  {motif:/\bTIRAGE (VERTICAL|POITRINE|NUQUE)|TRACTION|LAT PULL|PULL ?DOWN|PULL ?UP|CHIN ?UP/,
                                                                     p:['DORSAUX'],    s:['BICEPS']},
  {motif:/\bROWING|\bROW\b|TIRAGE (HORIZONTAL|ASSIS)/,               p:['DORSAUX'],    s:['BICEPS','TRAP_MED']},
  {motif:/\bHIP THRUST|EXTENSION DE HANCHE|KICK BACK/,               p:['FESSIERS'],   s:['ISCHIOS']},
  // LE SOULEVÉ CONVENTIONNEL N'AVAIT AUCUNE RÈGLE : seul le roumain était nommé,
  // plus haut. Il vient APRÈS lui, sans quoi il l'avalerait.
  {motif:/\bSOULEVE DE TERRE|DEADLIFT|KETTLEBELL SWING|\bSWING\b/,
                                                                     p:['FESSIERS'],   s:['ISCHIOS','LOMBAIRES']},
  {motif:/\bFERMIER|FARMER|\bYOKE\b/,                               p:['TRAP_SUP'],   s:['AVANT_BRAS','ABDOS']},
  {motif:/\bABDUCTEUR/,                                              p:['ABDUCTEURS'], s:['FESSIERS']},
  {motif:/\bADDUCTEUR/,                                              p:['ADDUCTEURS'], s:[]},
  {motif:/\bMOLLET|\bCALF\b/,                                        p:['MOLLETS'],    s:[]},
  {motif:/\bSHRUG|HAUSSEMENT/,                                       p:['TRAP_SUP'],   s:[]},
  {motif:/\bLOMBAIRE|HYPEREXTENSION|BANC A LOMBAIRE|EXTENSION DE BUSTE|SUPERMAN|JEFFERSON/,
                                                                     p:['LOMBAIRES'],  s:['FESSIERS','ISCHIOS']},
  {motif:/\bTRICEPS|EXTENSION (POULIE|NUQUE)|BARRE AU FRONT|\bDIPS\b/,
                                                                     p:['TRICEPS'],    s:['PECTORAUX','DELT_ANT']},
  {motif:/\bCURL(?! LARRY)|BICEPS|LARRY SCOTT/,                      p:['BICEPS'],     s:['AVANT_BRAS']},
  {motif:/\bCRUNCH|\bABDO|GAINAGE|RELEVE DE JAMBE|OBLIQUE/,          p:['ABDOS'],      s:[]},
  // — génériques, en dernier —
  // Squats et presses : plus d'ischios (30/09/2026), comme dans le guide.
  {motif:/\bSQUAT|PRESSE A CUISSE|LEG PRESS|\bHACK\b|\bFENTE|BULGARE|STEP ?UP|MONTE[ER] SUR/,
                                                                     p:['QUADRICEPS'], s:['FESSIERS']},
];

// Expansion PARESSEUSE de la table du guide : 408 entrées ne sont dépliées
// qu'au premier exercice à classer, jamais au démarrage de l'application.
let _exGuideMap=null, _exGuideCardio=null, _exGuidePosing=null;
function _exGuide(){
  if(_exGuideMap) return _exGuideMap;
  _exGuideMap=new Map();
  for(const sig of Object.keys(EX_GUIDE_BRUT)){
    const g=sig.split(',');
    for(const k of EX_GUIDE_BRUT[sig].split('~')) _exGuideMap.set(k,{p:[g[0]],s:g.slice(1)});
  }
  _exGuideCardio=new Set(EX_GUIDE_CARDIO.split('~'));
  _exGuidePosing=new Set(EX_GUIDE_POSING.split('~'));
  return _exGuideMap;
}
function _exGuideEstCardio(k){ _exGuide(); return _exGuideCardio.has(k); }
function _exGuideEstPosing(k){ _exGuide(); return _exGuidePosing.has(k); }

// Vidéos connues pour un exercice, dans l'ordre du guide.
// Rend [] si l'exercice n'y figure pas : la moitié des exercices du guide
// n'ont pas encore de vidéo tournée, et c'est un état normal, pas une erreur.
function videosPour(nom){
  return _videosDeCle(resoudreAlias(exKey(nom)));
}
// PURE. Les videos du guide pour une clef DEJA resolue.
// LA VIDÉO RANGÉE SOUS UN AUTRE NOM (05/10/2026). Le guide écrit parfois le
// lien sous un nom raccourci : « ABDUCTION DEBOUT POULIE » pour l'exercice
// « ABDUCTION DEBOUT POULIE ELASTIQUE ». La vidéo existait, la fiche ne la
// trouvait jamais. Exercice → clef de la vidéo, quand l'exercice n'en a pas.
const EX_VIDEOS_SOUS={
  'ABDUCTION DEBOUT POULIE ELASTIQUE':'ABDUCTION DEBOUT POULIE',
  'ADDUCTION DEBOUT POULIE ELASTIQUE':'ADDUCTION DEBOUT POULIE',
  'DEVELOPPE COUCHE PRISE SERREE':'DEVELOPPE COUCHE PRISE SEREE',
  'ELEVATION FRONTALE POULIE ELASTIQUE':'ELEVATION FRONTALE POULIE',
  'ELEVATION LATERALE POULIE ELASTIQUE UNILATERAL':'ELEVATION LATERALE POULIE UNILATERAL',
  'EXTENSION DE BUSTE SUR BANC':'EXTENSION DE BUSTE SUR BANC 1',
  'FLEXION LATERAL DE BUSTE POULIE ELASTIQUE':'FLEXION LATERAL DE BUSTE POULIE',
  'OISEAUX BUSTE PENCHE POULIE ELASTIQUE':'OISEAUX BUSTE PENCHE POULIE',
  'ROTATION DE BUSTE POULIE ELASTIQUE HAUTE':'ROTATION DE BUSTE POULIE HAUTE',
  'TIRAGE MENTON POULIE ELASTIQUE ET MANCHE A BALLET':'TIRAGE MENTON POULIE'
};
function _videosDeCle(k){
  if(!k) return [];
  const brut=EX_VIDEOS[k]||EX_VIDEOS[EX_VIDEOS_SOUS[k]];
  if(!brut) return [];
  return brut.split('~').map(v=>{
    const [id,lbl]=v.split('|');
    return {id,lbl:lbl||'',url:'https://youtu.be/'+id};
  });
}
// PURE. Les videos du guide pour un SLUG de fiche. exSlug est la seule
// fonction qui produit ces slugs — clef en majuscules, espaces en tirets — et
// le chemin inverse est donc exact.
function videosPourSlug(slug){
  const s=String(slug||'').trim();
  if(!s) return [];
  const k=s.replace(/-/g,' ').toUpperCase();
  const v=_videosDeCle(resoudreAlias(k));
  if(v.length) return v;
  // Même repli que pour l'illustration. Il reste utile alors que
  // resoudreAlias traverse déjà EX_RENOMMAGES : un alias PERSONNEL a pu
  // détourner la clef vers un exercice du coach qui, lui, n'a pas de vidéo.
  // On redemande alors au guide, qui en a une sous le nouveau nom.
  const r=_cleRenommee(k);
  return r===k?[]:_videosDeCle(r);
}

// ══════════════ PROTOCOLES D'ÉCHAUFFEMENT ET DE FIN DE SÉANCE ══════════════
// Vingt protocoles écrits par le coach. Constante en dur, comme FONDATION_H/F
// et EX_GUIDE : il n'y a ni base de données ni mécanisme de seed dans ce
// projet, et un protocole système ne doit de toute façon pas être modifiable.
//
// Le champ `warmup` / `cooldown` de la séance existait déjà, en texte libre.
// Choisir un protocole y écrit son déroulé : le texte reste donc la source
// affichée, et un coach qui le retouche crée de fait sa propre version sans
// altérer le protocole d'origine. `warmupProto` ne garde que la provenance.
const PROTO_OBJECTIFS={
  PERFORMANCE :{lib:'Performance',  c:'#e05050'},
  RECUPERATION:{lib:'Récupération', c:'#3b82f6'},
  DEPENSE     :{lib:'Dépense',      c:'#f97316'},
  MOBILITE    :{lib:'Mobilité',     c:'#22c55e'},
  PREVENTION  :{lib:'Prévention',   c:'#a855f7'}
};
// UNE SEULE TABLE DE MATERIEL, ETENDUE — JAMAIS UNE SECONDE A COTE. Celle-ci
// servait aux protocoles d'echauffement et de recuperation ; elle sert
// desormais aussi a decrire les salles et a filtrer les substituts. Deux
// tables finiraient par diverger, et un « HALTERES » d'un cote ne
// reconnaitrait pas un « HALTERE » de l'autre.
//
// LES TREIZE PREMIERES CLEFS N'ONT PAS BOUGE : les protocoles existants les
// lisent, et un renommage aurait vide leur filtre en silence.
const PROTO_MATERIEL={
  AUCUN:'Sans matériel', TAPIS:'Tapis', VELO:'Vélo', RAMEUR:'Rameur',
  ESCALIER:'Escalier', ELASTIQUE:'Élastique', FOAM_ROLLER:'Foam roller',
  PISTOLET_MASSAGE:'Pistolet', SAUNA:'Sauna', HYDROMASSAGE:'Hydromassage',
  AIRBIKE:'Airbike', CORDE:'Corde', BARRE:'Barre',
  // ── L'EXTENSION MUSCULATION ────────────────────────────────────────
  HALTERES:'Haltères', POULIE:'Poulie', MACHINE:'Machine guidée',
  SMITH:'Smith machine', BANC_DECLINE:'Banc décliné', HACK:'Hack squat',
  PRESSE:'Presse à cuisses', POULIE_HAUTE:'Poulie haute',
  POULIE_BASSE:'Poulie basse', BARRE_EZ:'Barre EZ',
  KETTLEBELL:'Kettlebell', TRACTION:'Barre de traction', DIPS:'Barres à dips'
};
// Le materiel qui decrit une SALLE : on retire ce qui releve du soin et non de
// l'entrainement. Proposer « sauna » dans l'inventaire d'une salle de sport ne
// changerait aucun substitut.
const SALLE_MATERIEL=Object.freeze(['BARRE','BARRE_EZ','HALTERES','KETTLEBELL',
  'POULIE','POULIE_HAUTE','POULIE_BASSE','MACHINE','SMITH','HACK','PRESSE',
  'BANC_DECLINE','TRACTION','DIPS','ELASTIQUE','RAMEUR','VELO','TAPIS','AUCUN']);
// ══════════ LE MATERIEL D'UN EXERCICE, DEDUIT DE SON NOM ═══════════════
//
// QUATRE CENT DEUX EXERCICES, ET AUCUN N'EST ETIQUETE A LA MAIN. Le nom porte
// deja l'information — « developpe couche haltere », « tirage poulie haute »,
// « presse a cuisse inclinee » — et une table de mots-clefs la lit. Etiqueter
// 402 exercices un par un aurait produit 402 occasions de se tromper, et une
// table que personne ne maintiendrait.
//
// L'ORDRE COMPTE : les motifs les plus specifiques d'abord. « poulie haute »
// doit gagner sur « poulie », et « barre ez » sur « barre ».
const EX_MATERIEL_MOTS=Object.freeze([
  [/\bpoulie haute\b|\blat pulldown\b|\bpulldown\b/,'POULIE_HAUTE'],
  [/\bpoulie basse\b|\bcable row\b/,'POULIE_BASSE'],
  [/\bpoulie|\bcable\b|\bcrossover\b|\bvis a vis\b/,'POULIE'],
  [/\bbarre ez\b|\bez bar\b/,'BARRE_EZ'],
  [/\bsmith\b|\bbarre guidee\b/,'SMITH'],
  [/\bhack ?squat\b|\bhacksquat\b/,'HACK'],
  [/\bpresse a cuisse|\bleg press\b|\bpresse inclinee\b/,'PRESSE'],
  [/\bkettlebell\b|\bkb\b/,'KETTLEBELL'],
  [/\btraction|\bpull ?up\b|\bchin ?up\b|\bmuscle up\b/,'TRACTION'],
  [/\bdips\b/,'DIPS'],
  [/\bbanc decline\b|\bdecline\b/,'BANC_DECLINE'],
  [/\bhaltere|\bdumbbell\b|\bdb\b/,'HALTERES'],
  [/\belastique\b|\bband\b/,'ELASTIQUE'],
  [/\brameur\b/,'RAMEUR'], [/\bvelo\b|\bbike\b/,'VELO'],
  [/\btapis\b|\btreadmill\b/,'TAPIS'],
  [/\bmachine\b|\bbutterfly\b|\bpec deck\b|\bchest press\b|\bleg curl\b|\bleg extension\b|\babducteur a la machine\b|\bconvergente\b/,'MACHINE'],
  [/\bbarre\b|\bbarbell\b|\blandmine\b/,'BARRE'],
  // LE POIDS DU CORPS, RECONNU EXPLICITEMENT. Ces exercices-la se font
  // partout : les laisser « inconnus » revenait a ne jamais pouvoir affirmer
  // qu'une salle depannee peut les recevoir, alors que c'est le seul groupe
  // dont on en soit certain. Motifs volontairement etroits — « crunch sur
  // banc incline » demande un banc, il reste donc inconnu plutot que declare
  // faisable partout.
  [/\bau sol\b|\bpompes?\b|\bplanche\b|\bplank\b|\bgainage\b|\bburpees?\b|\bjumping jack\b|\bmontee de genoux\b|\bfire hydrant\b|\bsuperman\b|\bchaise\b/,'AUCUN']
]);
// LES CLEFS GENERIQUES S'EFFACENT DEVANT LES SPECIFIQUES.
//
// ⚠ SANS CETTE TABLE, « curl barre EZ » exigeait BARRE_EZ **ET** BARRE : une
// salle equipee d'une barre EZ mais sans barre droite se voyait refuser
// l'exercice. Meme defaut pour « fentes arriere barre smith machine », qui
// reclamait SMITH, BARRE et MACHINE a la fois. Une machine Smith n'est pas une
// barre libre, et une presse n'est pas une machine quelconque.
const EX_MATERIEL_EFFACE=Object.freeze({
  BARRE_EZ:['BARRE'], SMITH:['BARRE','MACHINE'],
  HACK:['MACHINE'], PRESSE:['MACHINE'],
  POULIE_HAUTE:['POULIE'], POULIE_BASSE:['POULIE'],
  AUCUN:['BARRE','HALTERES','MACHINE','POULIE']
});
// PURE. Le materiel exige par un exercice, deduit de son nom. Rend [] quand
// le nom ne dit rien.
//
// ⚠ UNE LISTE VIDE N'EST PAS « AUCUN MATERIEL » : c'est « on ne sait pas ».
// Les deux se traitent differemment — un exercice au poids du corps se fait
// partout, un exercice inconnu ne se refuse pas pour autant. Voir
// exFaisableDans : l'inconnu passe, il ne se classe simplement pas devant.
function materielExercice(nom){
  const n=String(nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(!n) return [];
  let out=[];
  for(const [re,cle] of EX_MATERIEL_MOTS)
    if(re.test(n)&&out.indexOf(cle)<0) out.push(cle);
  // ON GARDE LE PLUS SPECIFIQUE, ET LUI SEUL — voir EX_MATERIEL_EFFACE.
  const efface={};
  for(const c of out) for(const e of (EX_MATERIEL_EFFACE[c]||[])) efface[e]=true;
  out=out.filter(c=>!efface[c]);
  return out;
}
// PURE. Un exercice unilateral se fait un cote a la fois : c'est une
// caracteristique du mouvement, et elle se lit dans le nom.
function exUnilateral(nom){
  const n=String(nom||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /\bunilateral|\bun bras\b|\bune jambe\b|\balterne/.test(n);
}
// PURE. Cet exercice est-il faisable dans cette salle ?
//
// L'INCONNU PASSE. Un exercice dont le nom ne nomme aucun materiel est le plus
// souvent au poids du corps ou generique : le refuser viderait la liste de
// substituts. On ne peut pas AFFIRMER qu'il est faisable — il ne se classera
// donc pas devant celui dont on le sait — mais on ne l'interdit pas.
// PURE. L'INVENTAIRE D'UNE SALLE, ETENDU. Une salle qui declare « poulie »
// sans preciser a, dans les faits, une poulie haute et une poulie basse :
// demander a l'athlete de cocher les trois serait lui faire remplir un
// formulaire pour une distinction qu'il ne fait pas en salle.
function _salleEtendue(materiel){
  const l=(Array.isArray(materiel)?materiel:[]).slice();
  if(l.indexOf('POULIE')>=0)
    for(const k of ['POULIE_HAUTE','POULIE_BASSE']) if(l.indexOf(k)<0) l.push(k);
  return l;
}
function exFaisableDans(nom,materielSalle){
  const dispo=Array.isArray(materielSalle)?_salleEtendue(materielSalle):null;
  if(!dispo) return true;                    // aucune salle declaree : on ne filtre pas
  const need=materielExercice(nom);
  if(!need.length) return true;              // inconnu : on ne refuse pas
  return need.every(m=>m==='AUCUN'||dispo.indexOf(m)>=0);
}
// PURE. Materiel CONFIRME disponible — plus strict que exFaisableDans, et
// c'est lui qui decide du message « rien d'equivalent ici ». Un exercice dont
// on ignore le materiel ne prouve pas qu'il y ait une solution dans la salle.
function exMaterielConfirme(nom,materielSalle){
  const dispo=Array.isArray(materielSalle)?_salleEtendue(materielSalle):null;
  const need=materielExercice(nom);
  if(!need.length) return false;
  if(!dispo) return true;
  return need.every(m=>m==='AUCUN'||dispo.indexOf(m)>=0);
}
// Types de séance reconnus. TOUS signifie « compatible avec n'importe laquelle ».
const PROTO_TYPES=['PUSH','PULL','JAMBES_QUADRI','JAMBES_HANCHE','FULL_BODY',
  'FORCE_MAX','METABOLIQUE','CARDIO','REPOS_ACTIF'];

const PROTOCOLES=[
// ── ÉCHAUFFEMENTS ──────────────────────────────────────────────────────────
{slug:'echauffement_push',nom:'Push haut du corps',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:10,dureeMax:12,intensite:'MODEREE',priorite:10,compatible:['PUSH'],
 materiel:['RAMEUR','ELASTIQUE'],contreInd:[],
 desc:'Épaules chauffées et coiffe des rotateurs activée avant de pousser.',
 etapes:['Rameur ou élastique, 3 min','Rotations externes d\'épaule, 2×15',
   'Dislocations au bâton, 2×10','Pompes inclinées, 2×10','Montées en charge 40 / 60 / 80 %']},

{slug:'echauffement_pull',nom:'Pull haut du corps',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:10,dureeMax:12,intensite:'MODEREE',priorite:10,compatible:['PULL'],
 materiel:['RAMEUR','FOAM_ROLLER','ELASTIQUE'],contreInd:[],
 desc:'Ouverture thoracique et réveil scapulaire avant de tirer.',
 etapes:['Rameur, 3 min','Extension thoracique au foam roller, 2×8',
   'Scapular pull-ups, 2×10','Face pull élastique, 2×20','Montées en charge']},

{slug:'echauffement_squat',nom:'Dominante quadriceps',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:12,dureeMax:15,intensite:'MODEREE',priorite:10,compatible:['JAMBES_QUADRI'],
 materiel:['VELO','BARRE'],contreInd:[],
 desc:'Chevilles et hanches mobilisées avant les squats et les presses.',
 etapes:['Vélo, 4 min','Mobilité de cheville en fente, 2×10 par côté','90/90 hanches, 2×8',
   'Goblet squat avec pause, 2×8','Barre à vide, 2×10','Montées 40 / 60 / 80 %']},

{slug:'echauffement_hinge',nom:'Charnière de hanche',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:12,dureeMax:15,intensite:'MODEREE',priorite:10,compatible:['JAMBES_HANCHE'],
 materiel:['VELO','BARRE'],contreInd:[],
 desc:'Gainage et chaîne postérieure réveillés avant soulevé et hip thrust.',
 etapes:['Vélo, 4 min','Cat-cow, 10','Bird-dog, 2×8 par côté','Dead bug, 2×10',
   'Hip thrust léger, 2×12','Soulevé de terre roumain barre à vide, 2×10','Montées progressives']},

{slug:'echauffement_dos_sensible',nom:'Protocole dos sensible',phase:'WARMUP',objectif:'PREVENTION',
 // Priorité basse volontairement : c'est un protocole CONDITIONNEL. À 8 il
 // sortait en tête de toute séance sans échauffement dédié (full body
 // notamment), et le bonus « antécédent lombaire » ne déplaçait plus rien
 // puisqu'il était déjà devant. À 3, il reste derrière les généralistes et ne
 // remonte que quand l'antécédent est réellement présent.
 dureeMin:15,dureeMax:15,intensite:'FAIBLE',priorite:3,compatible:PROTO_TYPES,
 materiel:['TAPIS'],contreInd:[],
 desc:'Montée en charge allongée et gainage anti-extension pour un dos fragile.',
 etapes:['Marche inclinée, 5 min','McGill Big 3 (curl-up, side plank, bird-dog), 2 tours',
   'Mobilité de hanche en décubitus','Gainage anti-extension, 2×20 s',
   'Montées en 5 paliers minimum']},

{slug:'echauffement_express',nom:'Express',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:6,dureeMax:8,intensite:'MODEREE',priorite:0,compatible:PROTO_TYPES,
 materiel:['AUCUN'],contreInd:[],
 desc:'Le strict nécessaire quand le temps manque.',
 etapes:['Cardio, 3 min','Une mobilité ciblée sur l\'articulation clé',
   '2 séries de montée en charge']},

{slug:'echauffement_force_max',nom:'Jour lourd, force',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:20,dureeMax:20,intensite:'ELEVEE',priorite:15,compatible:['FORCE_MAX'],
 materiel:['BARRE'],contreInd:[],
 desc:'Paliers rapprochés et repos longs avant une série lourde.',
 etapes:['Cardio, 5 min','Mobilité complète du mouvement travaillé','Activation des antagonistes',
   'Montées 30 / 50 / 65 / 80 / 90 / 95 %','Repos 2 à 3 min sur les derniers paliers']},

{slug:'echauffement_corps_froid',nom:'Corps froid, séance du matin',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:15,dureeMax:15,intensite:'MODEREE',priorite:5,compatible:PROTO_TYPES,
 materiel:['VELO','TAPIS'],contreInd:[],
 desc:'Un palier de plus quand le corps sort du lit.',
 etapes:['Cardio progressif, 6 à 7 min','Mobilité globale colonne, hanches, épaules',
   'Activation','Montées avec un palier supplémentaire']},

{slug:'echauffement_post_assis',nom:'Après une journée assise',phase:'WARMUP',objectif:'MOBILITE',
 dureeMin:12,dureeMax:12,intensite:'FAIBLE',priorite:5,compatible:PROTO_TYPES,
 materiel:['ELASTIQUE'],contreInd:[],
 desc:'Ouvre les fléchisseurs de hanche et le haut du dos après le bureau.',
 etapes:['Marche, 3 min','Ouverture des fléchisseurs de hanche, 2×30 s par côté',
   'Extension thoracique','Monster walk élastique, 2×15','Échauffement spécifique']},

{slug:'echauffement_metabolique',nom:'Métabolique, circuit',phase:'WARMUP',objectif:'PERFORMANCE',
 dureeMin:8,dureeMax:10,intensite:'ELEVEE',priorite:10,compatible:['METABOLIQUE'],
 materiel:['AUCUN'],contreInd:[],
 desc:'Un tour à blanc pour installer le rythme avant le circuit.',
 etapes:['Montée cardio, 4 min','Mobilité dynamique globale',
   'Un tour du circuit à 40 % d\'intensité']},

// ── FINS DE SÉANCE ─────────────────────────────────────────────────────────
{slug:'escaliers_20',nom:'Escaliers',phase:'COOLDOWN',objectif:'DEPENSE',
 dureeMin:20,dureeMax:20,intensite:'MODEREE',priorite:5,compatible:PROTO_TYPES,
 materiel:['ESCALIER'],contreInd:['GENOU','CARDIO'],
 desc:'Vingt minutes d\'escalier à allure régulière.',
 etapes:['Escalier, 20 min à allure régulière']},

{slug:'tapis_incline_40',nom:'Tapis incliné',phase:'COOLDOWN',objectif:'DEPENSE',
 dureeMin:40,dureeMax:40,intensite:'MODEREE',priorite:10,compatible:PROTO_TYPES,
 materiel:['TAPIS'],contreInd:['CARDIO'],
 desc:'Marche inclinée longue, cardiaque entre 120 et 135.',
 etapes:['Tapis, pente 12 %','Vitesse 5 à 5,5 km/h','40 min','Fréquence cardiaque 120 à 135']},

{slug:'velo_recup_active',nom:'Vélo, récupération active',phase:'COOLDOWN',objectif:'RECUPERATION',
 dureeMin:12,dureeMax:15,intensite:'TRES_FAIBLE',priorite:10,compatible:PROTO_TYPES,
 materiel:['VELO'],contreInd:[],
 desc:'Pédalage souple pour évacuer sans ajouter de fatigue.',
 etapes:['Vélo, résistance très faible','80 à 90 tours par minute','12 à 15 min']},

{slug:'marche_neat',nom:'Marche extérieure',phase:'COOLDOWN',objectif:'DEPENSE',
 dureeMin:20,dureeMax:30,intensite:'FAIBLE',priorite:5,compatible:PROTO_TYPES,
 materiel:['AUCUN'],contreInd:[],
 desc:'De la dépense sans matériel et sans fatigue nerveuse.',
 etapes:['Marche extérieure, 20 à 30 min']},

{slug:'retour_calme_respiratoire',nom:'Retour au calme respiratoire',phase:'COOLDOWN',objectif:'RECUPERATION',
 dureeMin:5,dureeMax:8,intensite:'TRES_FAIBLE',priorite:0,compatible:PROTO_TYPES,
 materiel:['AUCUN'],contreInd:[],
 desc:'Fait redescendre le rythme cardiaque en quelques minutes.',
 etapes:['Allongé, jambes surélevées','Inspiration 4 s, expiration 6 s','5 à 8 min']},

{slug:'mobilite_longue',nom:'Mobilité, étirements longs',phase:'COOLDOWN',objectif:'MOBILITE',
 dureeMin:15,dureeMax:15,intensite:'TRES_FAIBLE',priorite:5,compatible:PROTO_TYPES,
 materiel:['TAPIS'],contreInd:[],
 desc:'Trois à quatre positions tenues longtemps.',
 etapes:['3 à 4 positions','Maintien 60 à 90 s par position','15 min au total']},

{slug:'hydromassage',nom:'Hydromassage',phase:'COOLDOWN',objectif:'RECUPERATION',
 dureeMin:15,dureeMax:20,intensite:'TRES_FAIBLE',priorite:0,compatible:PROTO_TYPES,
 materiel:['HYDROMASSAGE'],contreInd:[],
 desc:'Récupération passive quand la salle en dispose.',
 etapes:['Hydromassage, 15 à 20 min']},

{slug:'sauna',nom:'Sauna',phase:'COOLDOWN',objectif:'RECUPERATION',
 dureeMin:15,dureeMax:20,intensite:'TRES_FAIBLE',priorite:0,compatible:PROTO_TYPES,
 materiel:['SAUNA'],contreInd:['CARDIO'],
 desc:'Deux passages courts plutôt qu\'un long.',
 etapes:['Sauna, 2 × 10 min','Pause entre les deux passages']},

{slug:'auto_massage',nom:'Foam roller et pistolet',phase:'COOLDOWN',objectif:'RECUPERATION',
 dureeMin:8,dureeMax:10,intensite:'TRES_FAIBLE',priorite:5,compatible:PROTO_TYPES,
 materiel:['FOAM_ROLLER'],contreInd:[],
 desc:'Zone par zone, en évitant les lombaires.',
 etapes:['60 à 90 s par zone','Éviter les lombaires','8 à 10 min au total']},

{slug:'finisher_metabolique',nom:'Finisher métabolique',phase:'COOLDOWN',objectif:'DEPENSE',
 dureeMin:8,dureeMax:12,intensite:'ELEVEE',priorite:5,compatible:['METABOLIQUE','FULL_BODY'],
 materiel:['AIRBIKE'],contreInd:['CARDIO','GENOU'],
 desc:'Court et intense, pour finir dans le rouge.',
 etapes:['Airbike ou corde à sauter','8 à 12 min en intensité élevée']}
];

// ── Protocoles sur mesure ───────────────────────────────────────────────────
// Rangés sur l'utilisateur, donc synchronisés et sauvegardés comme le reste.
// Les 20 protocoles livrés restent en dur : ils servent de repli et ne peuvent
// pas être cassés par une modification.
function protocolesPerso(){
  const l=currentUser&&currentUser.protocolesPerso;
  return Array.isArray(l)?l:[];
}
function tousProtocoles(){
  const p=protocolesPerso();
  return p.length?PROTOCOLES.concat(p):PROTOCOLES;
}
function estProtoPerso(slug){ return /^perso_/.test(String(slug||'')); }
const _protoParSlug=(()=>{const m={};for(const p of PROTOCOLES) m[p.slug]=p;return m;})();
function protocole(slug){
  // Table figée pour les 20 livrés, recherche linéaire pour les perso : ils
  // sont peu nombreux et changent, une table mémoïsée deviendrait fausse.
  return _protoParSlug[slug]||protocolesPerso().find(p=>p.slug===slug)||null;
}

// Déroulé d'un protocole en texte, tel qu'il sera écrit dans le champ de la
// séance : c'est ce texte que l'athlète verra, pas une référence au protocole.
function protoTexte(p){
  if(!p) return '';
  return p.nom+' ('+(p.dureeMin===p.dureeMax?p.dureeMin:p.dureeMin+' à '+p.dureeMax)+' min)\n'
    +p.etapes.map((e,i)=>(i+1)+'. '+e).join('\n');
}

// ── Type d'une séance, déduit de ses exercices ──────────────────────────────
// La séance ne porte AUCUN champ « type » : il n'y en a jamais eu dans
// l'application. Sans lui, toutes les suggestions tombaient dans le cas
// « type inconnu » et se classaient à l'aveugle. On le déduit donc de la
// classification musculaire : on compte les muscles primaires des exercices,
// et la famille qui domine donne le type.
// Rend null si rien ne domine, ce qui vaut mieux qu'un type inventé.
const _PROTO_FAMILLES={
  PUSH          :['PECTORAUX','DELT_ANT','DELT_LAT','TRICEPS'],
  PULL          :['DORSAUX','TRAP_MED','BICEPS','DELT_POST','AVANT_BRAS'],
  JAMBES_QUADRI :['QUADRICEPS'],
  JAMBES_HANCHE :['FESSIERS','ISCHIOS','ABDUCTEURS','ADDUCTEURS','LOMBAIRES']
};
function typeDeSeance(exercises){
  const ex=(exercises||[]).filter(e=>e&&e.name&&!isCardio(e));
  if(!ex.length) return null;
  const score={PUSH:0,PULL:0,JAMBES_QUADRI:0,JAMBES_HANCHE:0};
  let classes=0;
  for(const e of ex){
    const r=resoudreMuscles(e.name,e);
    if(!r||!r.p||!r.p.length) continue;
    classes++;
    for(const fam of Object.keys(_PROTO_FAMILLES))
      if(r.p.some(g=>_PROTO_FAMILLES[fam].includes(g))) score[fam]++;
  }
  if(!classes) return null;
  const haut=score.PUSH+score.PULL, bas=score.JAMBES_QUADRI+score.JAMBES_HANCHE;
  // Séance mêlant haut et bas de façon équilibrée : full body.
  if(haut&&bas&&Math.min(haut,bas)/Math.max(haut,bas)>=0.6) return 'FULL_BODY';
  const gagnant=Object.keys(score).sort((a,b)=>score[b]-score[a])[0];
  // Il faut une vraie domination : la moitié des exercices classés au moins.
  return score[gagnant]>=Math.max(2,classes*0.5)?gagnant:null;
}

// ── Moteur de suggestion ────────────────────────────────────────────────────
// Rend au plus 3 protocoles par phase, du meilleur score au moins bon.
//
// La spécification prévoyait un filtre DUR sur les contre-indications, croisées
// avec les blessures du profil. Ce filtre n'est PAS appliqué, et c'est
// délibéré : les blessures ne sont saisies qu'en texte libre dans le bilan de
// départ (« Hernie discale, entorse… »). Les lire par mots-clés reviendrait à
// deviner, et un protocole écarté à tort est invisible — le coach ne saurait
// jamais qu'il a existé. Les contre-indications sont donc AFFICHÉES, et c'est
// le coach qui tranche. Le jour où le bilan portera des cases à cocher, le
// filtre pourra devenir dur sans rien changer d'autre.
// PURE. La liste de depart : restreinte aux protocoles doux en fenetre
// post-partum basse, complete sinon.
//
// TROIS PHRASES du produit en dependent — « je te propose seulement de la
// mobilité et des échauffements », « du renforcement progressif, sans
// impact », « Impacts non proposés par RepCore ». Elles etaient affichees
// alors que RIEN ne filtrait : ppProtocolesDoux n avait aucun appelant.
//
// `=== false` ET NON `!ppImpactAutorise(...)` : la fonction rend NULL quand
// aucune date n est declaree, c est-a-dire « la question ne se pose pas ».
// Le nul se lirait comme un refus et restreindrait tout le monde.
//
// AUCUNE TAXONOMIE D IMPACT N EST INVENTEE ICI : on reprend la liste que
// ppProtocolesDoux tire de la bibliotheque existante, sur objectif et
// intensite. Classer des mouvements par risque perineal est precisement ce
// que la doctrine du produit interdit.
function _protocolesDeDepart(user){
  if(!user) return tousProtocoles();
  let f=null, imp=null;
  try{ f=ppFenetre(user); imp=ppImpactAutorise(user); }catch(e){ return tousProtocoles(); }
  const restreint=(f==='0_6'||f==='6_12')||imp===false;
  return restreint?ppProtocolesDoux():tousProtocoles();
}
// `user` EST LE DOSSIER DE CELUI QUI S ENTRAÎNE, pas celui qui regarde
// l’écran. Le seul appelant est l’éditeur de programme, qui sert le coach
// sur la fiche d’une cliente autant que l’athlète sur la sienne.
function suggestProtocols(seance,profil,user){
  const type=(seance&&seance.type)||null;
  const objSeance=(seance&&seance.objectif)||null;
  const dispo=(seance&&seance.dureeCible)||null;
  const materielDispo=(profil&&profil.materielDispo)||null;   // null = on ne filtre pas
  const _depart=_protocolesDeDepart(user);
  const res={warmup:[],cooldown:[]};
  for(const phase of ['WARMUP','COOLDOWN']){
    const notes=_depart.filter(p=>p.phase===phase).map(p=>{
      let s=p.priorite||0;
      // Un protocole VISANT ce type de séance l'emporte sur un protocole
      // compatible avec tout. Sans cette distinction, « Protocole dos
      // sensible », déclaré compatible partout, passait devant « Dominante
      // quadriceps » sur une séance de jambes : la suggestion la plus
      // pertinente se retrouvait reléguée derrière une passe-partout.
      const universel=p.compatible.length>=PROTO_TYPES.length;
      if(type&&p.compatible.includes(type)) s+=universel?12:50;
      if(dispo&&p.dureeMax<=dispo) s+=20;
      if(objSeance&&p.objectif===objSeance) s+=15;
      if(profil&&profil.antecedentLombaire&&p.objectif==='PREVENTION') s+=10;
      return {p,s};
    }).filter(({p})=>{
      // Seul filtre dur conservé : le matériel, quand la donnée existe.
      if(!materielDispo) return true;
      return p.materiel.every(m=>m==='AUCUN'||materielDispo.includes(m));
    });
    notes.sort((a,b)=>b.s-a.s||a.p.nom.localeCompare(b.p.nom));
    res[phase==='WARMUP'?'warmup':'cooldown']=notes.slice(0,3).map(x=>x.p);
  }
  // Repli : si le matériel disponible ne laisse rien passer, on rend les deux
  // protocoles qui ne demandent rien plutôt qu'une liste vide.
  if(!res.warmup.length) res.warmup=[protocole('echauffement_express')].filter(Boolean);
  if(!res.cooldown.length) res.cooldown=[protocole('retour_calme_respiratoire')].filter(Boolean);
  return res;
}

// ⚠ defEx N'EST PLUS APPLIQUE NULLE PART depuis le 16/09/2026. Cette liste
// etait le programme de repli — « SEANCE 1 : DOS & ABDOS » — pose d'office a
// qui n'avait pas encore de programme. Elle survit comme CONTRE-EXEMPLE
// NOMME : deux assertions verifient qu'aucun de ces six exercices ne reparait
// dans une grille neuve, et elles ont besoin de la liste pour le faire.
// Ne pas la reintroduire dans un chemin de creation.
const defEx=[
  {name:'Pull Over sur Banc Incliné',series:3,reps:'20',repos:'90 sec',description:'Amplitude maximale, expiration à la montée. Bras tendus, descendre jusqu\'à l\'étirement complet des dorsaux.',note:'',image:null},
  {name:'Tirage Poitrine Largeur Épaule',series:4,reps:'5+',repos:'2 min',description:'Prise légèrement plus large que les épaules. Coudes vers le bas, omoplates en rétraction en fin de mouvement.',note:'',image:null},
  {name:'Row en Unilatéral',series:4,reps:'8 Par Bras',repos:'75 sec',description:'Un genou et une main sur le banc. Rotation du tronc légère, coude haut en fin de mouvement.',note:'',image:null},
  {name:'Rowing Planche Barre',series:4,reps:'8',repos:'2 min',description:'Corps parallèle au sol, prise neutre. Dos plat, amener la barre vers le nombril.',note:'',image:null},
  {name:'Tirage Unilatéral sur Banc',series:4,reps:'10 Par Bras',repos:'75 sec',description:'Assis de côté sur le banc. Étirement complet en bas, contraction maximale en haut.',note:'',image:null},
  {name:'Oblique Abdominal Crunch',series:5,reps:'15',repos:'60 sec',description:'En décubitus dorsal, mains derrière la nuque. Rotation et contraction maximale des obliques.',note:'',image:null}
];
// LE REPOS PAR DEFAUT D UN EXERCICE NEUF. Une minute etait trop court pour du
// travail en charge, et personne ne le laissait tel quel. Deux minutes, pour le
// coach comme pour l athlete — demande de Kevin, 15/09/2026 — et chacun le
// change a la main s il veut autre chose.
// LE FORMAT EST CELUI DU CATALOGUE : « 2 min », comme les 200 exercices du
// guide, et non « 02 min ». parseRepos lit les deux, mais deux ecritures pour
// une meme duree finissent toujours par se contredire quelque part.
const REPOS_DEFAUT='2 min';
// ══ UNE SEANCE NEUVE NAIT VIERGE ═════════════════════════════════════════
//
// ⚠ RIEN N'EST PRE-REMPLI DE CONTENU, ET C'EST LE LOT. L'application posait
// d'office un programme que personne n'avait choisi : la Fondation selon le
// genre, ou a defaut la liste generique defEx — « SEANCE 1 : DOS & ABDOS ».
// Le coach comme l'athlete commencaient donc par DEFAIRE le travail de
// quelqu'un d'autre avant de faire le leur. Demande de Kevin, 16/09/2026 :
// « il faut que toutes les seances soient vierges, que ce soit pour l'athlete
// ou pour le coach. Comme si je voulais installer une nouvelle seance. »
//
// CE QUI RESTE PRE-REMPLI EST DE LA FORME, PAS DU CONTENU : cinq
// emplacements, trois series, deux minutes de repos. Aucun nom d'exercice,
// aucune consigne. Ce sont des reglages qu'on ajuste, pas un programme qu'on
// desapprouve — et chacun se change d'un clic.
const SEANCE_EXOS_DEFAUT=5;
// PURE. Un emplacement d'exercice, exactement la forme que pousse
// addExercise : une seule definition, sinon l'editeur et la creation
// divergeraient au premier champ ajoute.
function _exoVierge(){
  return {name:'',series:3,reps:'10',repos:REPOS_DEFAUT,description:'',image:null,
    videoUrl:'',ss:false,methodeSeries:'',rir:''};
}
// PURE. Sept creneaux eteints et vides — la forme que tous les rendus
// attendent. Un tableau vide ne suffit pas : ils lisent sept jours.
function _seancesViergesSemaine(){
  return DAYS.map(day=>({day,name:'',photo:null,photo2:null,exercises:[],
    active:false,notes:'',warmup:''}));
}
// ⚠ ON NE GARNIT QUE CE QUI EST VIDE. Rouvrir un jour deja travaille lui
// ajouterait cinq emplacements par-dessus le travail existant — et un
// creneau qu'on eteint puis rallume par erreur ne doit rien coûter.
function _garnirSeanceVierge(s){
  if(!s||typeof s!=='object') return s;
  if(Array.isArray(s.exercises)&&s.exercises.length) return s;
  s.exercises=Array.from({length:SEANCE_EXOS_DEFAUT},_exoVierge);
  return s;
}
let progEx=[];
let _progExDirty=false;
// ======= COACH PROGRAMME TEMPLATES =======
let _editProgTemplateIdx=null, _editProgTemplateGender='H', _assigningProgIdx=null;

// ══ METTRE UN PROGRAMME EN VENTE ═══════════════════════════════════════════
//
// CINQ CHAMPS, TOUS FACULTATIFS, TOUS ABSENTS PAR DEFAUT, ET AUCUNE MIGRATION.
// Un programme cree avant ce lot — ou cree apres, et jamais mis en vente — ne
// porte AUCUNE de ces cles, et se lit « pas en vente ». C'est la raison pour
// laquelle createCoachProgTemplate ne les pose pas : une cle a vide sur les
// milliers de programmes existants n'apporterait rien, gonflerait chaque
// sauvegarde, et obligerait a distinguer « faux » de « jamais renseigne ».
//
//   enVente    booleen — true, ou absent. Jamais false ecrit.
//   pitch      chaine, 280 caracteres au plus
//   prix       chaine LIBRE, et c'est voulu : « 49 € », « 3 × 20 € », « sur
//              devis ». Un nombre aurait force une monnaie et un format.
//   lienAchat  chaine https, passee par safeUrl a l'affichage
//   visuel     image en base64, sous le meme budget que la photo de vitrine
//
// LE VISUEL EST LE CINQUIEME, et il n'etait pas dans la liste des quatre :
// il l'est ici parce que la fiche publiee le nomme, et un champ publie qui
// n'existe nulle part dans le modele serait un champ fantome.
const CPT_PITCH_MAX=280;
const CPT_CHAMPS_VENTE=Object.freeze(['enVente','pitch','prix','lienAchat','visuel']);
// PURE. Un programme est en vente, ou il ne l'est pas. `=== true` et non une
// coercition : une chaine « false » venue d'une vieille sauvegarde ne doit pas
// mettre un programme en vente dans le dos de son auteur.
function progEnVente(p){ return !!(p&&p.enVente===true); }
// PURE. Le lien de paiement s'il est utilisable, '' sinon.
//
// ⚠ https SEUL, ET NON safeUrlRaw, QUI ACCEPTE AUSSI http. C'est un lien de
// PAIEMENT : envoyer quelqu'un saisir sa carte sur une page en clair n'est pas
// une preference de style. La regle est donc plus stricte ici qu'ailleurs dans
// le fichier, et volontairement.
function _lienAchatValide(v){
  const s=String(v==null?'':v).trim();
  return /^https:\/\//i.test(s)?s:'';
}
// PURE. Ce qui part dans coach_public : le STRICT necessaire pour dessiner une
// carte, et rien de ce qui fait le programme.
//
// ⚠ AUCUNE SEANCE, AUCUN EXERCICE, AUCUNE CHARGE. Ce noeud est lisible par tous
// les athletes rattaches au coach : y publier le contenu des programmes le
// donnerait a ceux qui ne l'ont pas achete. On vend une promesse ici, on livre
// ailleurs.
// ⚠ CHAQUE LONGUEUR EST BORNEE ICI, PAS SEULEMENT DANS LES REGLES, et c'est la
// lecon la plus chere de ce noeud : coach_public est publie par un PUT du profil
// ENTIER, et un seul champ refuse fait rejeter LA BRANCHE COMPLETE. Un pitch
// trop long n'aurait donc pas coupe un pitch — il aurait fait disparaitre la
// photo, la phrase, les diplomes et la signature du coach, definitivement et
// sans un mot, exactement comme 'logo' et 'dispo' l'ont deja fait ici. Les
// bornes du code sont LES MEMES que celles des regles, un cran en dessous.
const VPR_BORNES=Object.freeze({name:120,pitch:CPT_PITCH_MAX,prix:40,lienAchat:500});
function vitrineProgrammesDe(u){
  return (((u||{}).coachPrograms)||[])
    .filter(progEnVente)
    .map(p=>{
      const o={id:String(p.id||'').slice(0,60),
               name:String(p.name||'').trim().slice(0,VPR_BORNES.name)};
      // MEME DISCIPLINE QU'EN LOCAL : une cle vide ne s'ecrit pas. Les regles
      // de la base valident chaque champ present ; un '' passerait, mais il
      // ferait dessiner un prix vide et une image cassee.
      ['pitch','prix','lienAchat','visuel'].forEach(k=>{
        let s=String(p[k]==null?'':p[k]).trim();
        if(VPR_BORNES[k]) s=s.slice(0,VPR_BORNES[k]);
        if(s) o[k]=s;
      });
      // ⚠ UN LIEN TRONQUE N'EST PLUS UN LIEN. Si la coupe a mordu, on
      // n'envoie RIEN plutot qu'une adresse a moitie : la carte s'affichera
      // sans bouton, ce qui est visible, au lieu d'ouvrir une page morte.
      if(o.lienAchat&&!_lienAchatValide(o.lienAchat)) delete o.lienAchat;
      if(o.lienAchat&&String(p.lienAchat||'').trim().length>VPR_BORNES.lienAchat)
        delete o.lienAchat;
      return o;
    })
    .filter(o=>o.id&&o.name);
}
// Pose les cinq champs sur un programme, et EFFACE ceux qui sont vides. C'est
// la seule ecriture : elle garantit qu'on ne cree jamais de cle a vide, y
// compris quand le coach efface un champ qu'il avait rempli.
function _venteProgAppliquer(p,v){
  if(!p||!v) return false;
  if(v.enVente) p.enVente=true; else delete p.enVente;
  ['pitch','prix','lienAchat','visuel'].forEach(k=>{
    const s=String(v[k]==null?'':v[k]).trim();
    if(s) p[k]=s; else delete p[k];
  });
  if(p.pitch) p.pitch=p.pitch.slice(0,CPT_PITCH_MAX);
  return true;
}
// PURE. La carte d'un programme, telle que l'athlete la voit sur la vitrine —
// et telle que l'apercu de la feuille la montre au coach. UNE SEULE fonction
// pour les deux : un apercu qui ne montrerait pas ce que l'athlete verra ne
// vaudrait pas la place qu'il prend.
//
// Rend '' quand il n'y a pas de nom : une carte sans titre n'annonce rien.
function _htmlCarteProgVitrine(p){
  const o=p||{};
  const nom=String(o.name||'').trim();
  if(!nom) return '';
  const pitch=String(o.pitch||'').trim();
  const prix=String(o.prix||'').trim();
  const lien=_lienAchatValide(o.lienAchat);
  const vis=String(o.visuel||'').trim();
  return '<div class="vpr-c">'
    +(vis?('<img class="vpr-img" src="'+escapeHtml(vis)+'" alt="" loading="lazy" '
           +'onerror="this.style.display=\'none\'">'):'')
    +'<div class="vpr-b">'
    +'<div class="vpr-n">'+escapeHtml(nom)+'</div>'
    +(pitch?('<div class="vpr-p">'+escapeHtml(pitch)+'</div>'):'')
    +(prix?('<div class="vpr-x">'+escapeHtml(prix)+'</div>'):'')
    // LE BOUTON N'APPARAIT QUE S'IL MENE QUELQUE PART. Un « Voir le programme »
    // qui n'ouvre rien est pire que pas de bouton : il fait croire a une panne.
    +(lien?('<a class="vpr-btn" href="'+safeUrl(lien)+'" target="_blank" '
            +'rel="noopener noreferrer" onclick="rcmAchatProgramme()">Voir le programme</a>'):'')
    +'</div></div>';
}
// L'EVENEMENT DU DEPART. Il ne bloque rien et ne rend rien : le lien s'ouvre
// que la mesure parte ou non — un compteur ne doit jamais retenir un clic.
function rcmAchatProgramme(){ try{ rcm('programme_clic_achat'); }catch(e){} return true; }

function openCoachPrograms(){
  go('s-coach-programs');loadCoachProgramsList();
  // LE CREATEUR VOIT L'ETAT REEL DE LA BOUTIQUE. La liste s'affiche sur le
  // cache — donc tout de suite, et hors ligne — puis se corrige quand le
  // noeud public repond, comme la boutique elle-meme.
  if(estVendeur()) rafraichirBoutique().then(()=>{ try{ loadCoachProgramsList(); }catch(e){} });
}

// ══ MES PROGRAMMES : DES RAYONS, ET RIEN DE MELANGE ═══════════════════════
//
// Demande de Kevin, 17/09/2026 : « il faut que ce ne soit pas tout mélangé ».
//   • LES PROGRAMMES CREES ICI, puis, juste en dessous, CEUX ENREGISTRES
//     DEPUIS LE PROGRAMME D'UN ATHLETE — chacun sous son titre ;
//   • dans chaque carte, LA VERSION HOMME PUIS LA VERSION FEMME, l'une sous
//     l'autre, avec leurs seances nommees ; c'est en touchant une version
//     qu'on l'ouvre ;
//   • pour le createur, « DANS LA BOUTIQUE » : ce qui est vendu sans venir
//     d'un modele, comme la Fondation livree avec l'application.
//
// ⚠ LES INDEX RESTENT CEUX DU TABLEAU. Les rayons filtrent l'affichage, pas
// coachPrograms : chaque bouton passe l'index reel, comme avant.
const CPL_RAYONS=Object.freeze([
  // « Créés par moi » et non « Mes programmes » : c'est deja le titre de
  // l'ecran, et le repeter au-dessus du premier rayon ne dit rien.
  Object.freeze({cle:'moi',titre:'Créés par moi',aide:''}),
  Object.freeze({cle:'athlete',titre:'Enregistrés depuis un athlète',
    aide:'Adapte l’autre version avant de les vendre.'})
]);
// PURE. Le rayon d'un modele. Un modele cree avant ce lot ne porte pas
// `origine` : il reste dans « Mes programmes », ou il a toujours ete.
//
// ⚠ IL NE SEQUENCE PLUS LA LISTE, il reste lu par la carte. Demande de Kevin,
//   20/09/2026 : « mets les titres pour séquencer homme, femme, mixte ». Le
//   classement par ORIGINE — pose le 17/09 — laissait un programme Homme et un
//   programme Femme cote a cote sous le meme titre, alors que c'est la question
//   qu'on se pose en parcourant la liste. L'origine n'est pas perdue : elle
//   reste sur chaque carte, en toutes lettres, et sa consigne avec elle.
function _cplRayon(p){ return (p&&p.origine==='athlete')?'athlete':'moi'; }
// ⚠ UN SEUL GROUPEMENT, LU PAR L'AFFICHAGE ET PAR LES FLECHES. `cplDeplacer`
//   cherche le voisin « du meme rayon » : si les deux fonctions ne repondaient
//   pas la meme chose, la fleche aurait echange un programme avec un voisin
//   invisible — rien ne bougeait a l'ecran, ou un programme sautait d'une
//   section a l'autre sans qu'on l'ait touche.
function _cplGroupe(p){ return progPublic(p); }
// ══ LE FILTRE DE LA VITRINE ════════════════════════════════════════════════
//
// ⚠ TROIS BOUTONS, ET AUCUN QUATRIEME « TOUS ». Ils BASCULENT : toucher celui
//   qui est deja actif le relache, et la liste redevient entiere. Un quatrieme
//   bouton aurait dit la meme chose en prenant une place que la rangee n'a pas
//   sur un telephone — et surtout, avec trois boutons seuls et aucun relachement
//   possible, on ne pouvait plus JAMAIS revoir tout le catalogue.
//
// EN MEMOIRE, PAS DANS LE DOSSIER. C'est un regard porte sur la liste, pas une
// preference : la rouvrir doit la montrer entiere, comme n'importe quel ecran.
let _cplFiltre=null;
function cplFiltrer(v){
  _cplFiltre=(_cplFiltre===v)?null:(PROG_PUBLICS.some(x=>x.cle===v)?v:null);
  try{ loadCoachProgramsList(); }catch(e){}
  return true;
}

// ══ A QUI S'ADRESSE UN PROGRAMME ═══════════════════════════════════════════
//
// Demande de Kevin, 19/09/2026 : « il doit y avoir 3 possibilités, soit femme,
// soit homme, soit femme et homme ».
//
// ⚠ LE CHAMP S'APPELLE `publicVise` ET NON `public`. `public` est un mot
//   reserve en mode strict : legal en nom de propriete, il ne l'est pas en
//   identifiant, et le premier qui aurait ecrit `const public=...` dans une
//   fonction voisine aurait casse le fichier entier a l'analyse — une erreur
//   de syntaxe, pas une exception qu'on rattrape.
// ⚠ `lib` EST PASSE DE « Les deux » A « Mixte », demande de Kevin le
//   20/09/2026 : c'est le mot de son maquette, et c'est aussi celui du titre
//   de section — deux mots pour le meme etat auraient fait douter qu'il
//   s'agisse du meme.
// `sym` : le signe astronomique, pas un emoji. Il se peint a la couleur du
// texte, il suit la graisse de la police, et il n'apporte aucune image a
// charger. Les emojis genres sont peints par le systeme, dans une autre
// couleur et une autre taille — ils auraient casse la rangee.
const PROG_PUBLICS=Object.freeze([
  Object.freeze({cle:'H', lib:'Homme', sym:'\u2642', dit:'Pour les hommes'}),
  Object.freeze({cle:'F', lib:'Femme', sym:'\u2640', dit:'Pour les femmes'}),
  Object.freeze({cle:'HF',lib:'Mixte', sym:'\u26A5', dit:'Hommes et femmes'})
]);
/**
 * PURE. Le public d'un programme : 'H', 'F' ou 'HF'.
 *
 * ⚠ AUCUNE MIGRATION, ET LE REPLI SE DEDUIT DU CONTENU. Les programmes
 *   existants ne portent pas ce champ ; plutot que de les reecrire tous pour y
 *   poser 'HF', on lit ce qu'ils CONTIENNENT : un modele dont seule la version
 *   Homme est garnie s'adresse aux hommes, et il le disait deja — la version
 *   Femme affichait « Aucune séance · À remplir », ce qui se lisait comme un
 *   travail inacheve alors que c'etait un choix.
 *
 * ⚠ UN PROGRAMME VIDE S'ADRESSE AUX DEUX. C'est l'etat d'un modele qu'on vient
 *   de creer : lui deduire un public a partir de rien aurait fait disparaitre
 *   une des deux versions de l'ecran avant meme qu'on ait pu la remplir.
 * @param {any} p
 * @returns {'H'|'F'|'HF'}
 */
function progPublic(p){
  const v=p&&p.publicVise;
  if(v==='H'||v==='F'||v==='HF') return v;
  const h=_cplSeancesPleines(p,'H').length>0;
  const f=_cplSeancesPleines(p,'F').length>0;
  if(h&&!f) return 'H';
  if(f&&!h) return 'F';
  return 'HF';
}
/** PURE. Le genre reellement servi quand on assigne ce programme. */
function progGenreServi(p,genreVoulu){
  const pu=progPublic(p);
  // ⚠ UN PROGRAMME RESERVE A UN PUBLIC NE LIVRE QUE SA VERSION. Sans cette
  //   regle, assigner un modele « Pour les hommes » a une athlete lui ecrasait
  //   ses seances avec `sessions_F` — c'est-a-dire avec RIEN, puisque cette
  //   version est vide par definition. Elle se retrouvait sans programme, et
  //   la fiche du coach affichait pourtant « Programme : … » comme si tout
  //   allait bien.
  if(pu==='H'||pu==='F') return pu;
  return genreVoulu==='F'?'F':'H';
}
/**
 * PURE. Le resume d'un programme : a qui il s'adresse, et ce qu'il demande.
 *
 * Demande de Kevin : « un court résumé du programme, à qui il s'adresse ».
 *
 * ⚠ LE PUBLIC OUVRE TOUJOURS LA PHRASE, MEME QUAND LE COACH A ECRIT LA SUITE.
 *   Rendre le pitch SEUL etait tentant — c'est sa description — mais la demande
 *   est « à qui il s'adresse », et un pitch parle du contenu, pas du public :
 *   « Trois séances par semaine pour reprendre sans se blesser » ne dit pas si
 *   c'est pour elles ou pour eux. Le public devant, sa phrase apres : les deux
 *   tiennent sur une ligne et aucune des deux n'est perdue.
 * @param {any} p
 * @returns {string}
 */
function progResume(p){
  const pu=progPublic(p);
  const dit=(PROG_PUBLICS.find(x=>x.cle===pu)||{}).dit||'Hommes et femmes';
  const pitch=String((p&&p.pitch)||'').trim();
  if(pitch) return dit+' · '+pitch;
  // LE RYTHME EST CELUI DE LA VERSION LA PLUS GARNIE : les deux versions d'un
  // programme mixte n'ont pas toujours le meme nombre de seances, et annoncer
  // le plus petit ferait passer le programme pour plus leger qu'il n'est.
  const n=Math.max(pu==='F'?0:_cplSeancesPleines(p,'H').length,
                   pu==='H'?0:_cplSeancesPleines(p,'F').length);
  if(!n) return dit+' · aucune séance pour l’instant';
  return dit+' · '+n+' séance'+(n>1?'s':'')+' par semaine';
}
/** Le coach choisit le public. Rien n'est efface : voir progPublicPoser. */
function progPublicPoser(i,v){
  const l=(currentUser&&currentUser.coachPrograms)||[];
  const p=l[i];
  if(!p||!PROG_PUBLICS.some(x=>x.cle===v)) return false;
  if(progPublic(p)===v&&p.publicVise===v) return true;
  // ⚠ ON N'EFFACE JAMAIS LA VERSION QU'ON CESSE DE PROPOSER. Le reflexe serait
  //   de vider `sessions_F` en passant un programme en « Homme » : ce serait
  //   detruire un travail de plusieurs heures sur un choix qui se revient en
  //   deux clics. Elle est MASQUEE, elle reste ecrite, et la carte le dit.
  p.publicVise=v;
  try{ saveUser(); }catch(e){ rcErreurMuette('progPublicPoser',e); }
  try{ loadCoachProgramsList(); }catch(e){}
  return true;
}
// PURE, ET SANS REPARATION. _cptSeances aplatit un objet Firebase et peut
// alerter : c'est le travail de l'editeur, pas d'une liste qu'on parcourt.
// On lit donc un tableau, ou les valeurs d'un objet, sans rien ecrire.
// Une seance compte si elle est active ET porte un exercice — la regle de
// _cptCount, que l'ancienne carte affichait.
function _cplSeancesPleines(p,genre){
  const brut=p&&p[genre==='F'?'sessions_F':'sessions_H'];
  const l=Array.isArray(brut)?brut:((brut&&typeof brut==='object')?Object.values(brut):[]);
  return l.filter(s=>s&&s.active&&Array.isArray(s.exercises)&&s.exercises.length);
}
// PURE (au cache de la boutique pres). Le createur vend par la BOUTIQUE : c'est
// la fiche liee qui dit si le modele est en vente. Les autres coachs vendent
// par leur VITRINE, avec leur propre lien de paiement : c'est progEnVente.
function _cplEnVente(p){
  if(!estVendeur()) return progEnVente(p);
  if(!p||!p.boutiqueId||!_programmePublie(p.boutiqueId)) return false;
  const e=programmeDuCatalogue(p.boutiqueId);
  return !!(e&&!e.masque);
}
// Une version : son genre, le nombre de seances, leurs noms. Vide, elle le dit.
function _htmlCplVersion(i,genre,p){
  const l=_cplSeancesPleines(p,genre);
  const n=l.length;
  const noms=l.map(s=>String(s.name||'').trim()||String(s.day||'Séance')).join(' · ');
  const sym=(PROG_PUBLICS.find(x=>x.cle===genre)||{}).sym||'';
  return '<button type="button" class="cpl-v'+(n?'':' cpl-v-vide')+'" '
    +'data-pub="'+genre+'" '
    +'onclick="editCoachProgTemplate('+i+',\''+genre+'\')">'
    // ⚠ LE SIGNE EST DANS SON PROPRE SPAN, hors de `.cpl-v-g`. Le test de la
    //   rangee lit le libelle de cette classe et le compare au mot exact :
    //   l'y coller aurait rendu « ♂Homme » et casse une assertion qui parle du
    //   genre, pas du dessin.
    +'<span class="cpl-v-sym" aria-hidden="true">'+sym+'</span>'
    +'<span class="cpl-v-g">'+(genre==='F'?'Femme':'Homme')+'</span>'
    +'<span class="cpl-v-c"><span class="cpl-v-n">'
      +(n?(n+' séance'+(n>1?'s':'')):'Aucune séance')+'</span>'
    +'<span class="cpl-v-s">'+(n?escapeHtml(noms):'À remplir')+'</span></span>'
    +'<span class="cpl-v-ch" aria-hidden="true">›</span></button>';
}
function _htmlCplCarte(p,i,premier,dernier){
  const on=_cplEnVente(p);
  const meta=[];
  if(p.origine==='athlete'&&String(p.depuis||'').trim())
    meta.push('Depuis le programme de '+escapeHtml(String(p.depuis).trim()));
  meta.push('Créé le '+new Date(p.createdAt||Date.now())
    .toLocaleDateString('fr-FR',{day:'numeric',month:'short'}));
  if(on&&estVendeur()){
    const e=programmeDuCatalogue(p.boutiqueId), px=e?prixProgramme(e):'';
    if(px) meta.push(px+' dans la boutique');
  }
  // LE CREATEUR VEND PAR LA BOUTIQUE, les autres par leur vitrine : un seul
  // bouton, et la fiche qui correspond a qui le touche.
  const vendre=estVendeur()?'ouvrirFicheVente(null,'+i+')':'ouvrirVenteProgramme('+i+')';
  const pu=progPublic(p);
  // LE SELECTEUR DE PUBLIC, CONTRE LE NOM. Demande de Kevin, 20/09/2026 : « les
  // carrés à côté du titre du programme pour sélectionner le genre attribué ».
  // En barre pleine largeur sous le resume, il se lisait comme un filtre de la
  // page ; collé au nom, il se lit comme une propriete de CE programme.
  //
  // Trois segments, un seul actif : c'est un CHOIX entre trois etats, pas trois
  // interrupteurs — d'ou le groupe radio.
  const seg='<div class="cpl-pub" role="radiogroup" aria-label="À qui s’adresse ce programme">'
    +PROG_PUBLICS.map(x=>'<button type="button" role="radio" aria-checked="'+(x.cle===pu)+'"'
      +' class="cpl-pub-b'+(x.cle===pu?' on':'')+'" data-pub="'+x.cle+'"'
      +' title="'+escapeHtml(x.dit)+'"'
      +' onclick="progPublicPoser('+i+',\''+x.cle+'\')">'
      +'<span class="cpl-pub-s" aria-hidden="true">'+x.sym+'</span>'
      +'<span class="cpl-pub-l">'+escapeHtml(x.lib)+'</span></button>').join('')
    +'</div>';
  // ⚠ LA LIGNE QUI ANNONCAIT LA VERSION MASQUEE A ETE RETIREE, demande de
  //   Kevin le 20/09/2026. Elle disait « la version Femme garde ses 6 séances :
  //   elle n'est plus proposée, rien n'est effacé ».
  //
  //   CE QU'ELLE PROTEGEAIT EXISTE TOUJOURS, et c'est le point : passer un
  //   programme en « Homme » n'efface RIEN de sa version Femme — le test
  //   « Choisir un public N'EFFACE PAS la version qu'on cesse de proposer » le
  //   tient, sur les donnees et non sur le message. Ce qui disparait, c'est
  //   seulement l'annonce : un coach qui restreint un programme ne verra plus
  //   a l'ecran que l'autre version dort encore dans le dossier.
  // ⚠ LA CONSIGNE « Adapte l'autre version avant de le vendre » A ETE RETIREE,
  //   demande de Kevin le 20/09/2026. Elle suivait les modeles enregistres
  //   depuis un athlete depuis que les titres ont change d'axe. L'origine, elle,
  //   reste sur la carte : « Depuis le programme de … » dit d'ou vient le
  //   modele, ce qui est le fait ; le conseil de relecture, lui, n'avait a etre
  //   donne qu'une fois.
  // LA VIGNETTE DE VENTE, quand le coach en a posé une. C'est le champ
  // `visuel` de sa fiche de vente — la meme image que voit l'acheteur. Sans
  // elle, pas de cadre vide : la carte reprend toute sa largeur.
  const vis=String(p.visuel||'').trim();
  const vign=vis
    ? '<div class="cpl-vig" aria-hidden="true">'
      +'<img src="'+escapeHtml(vis)+'" alt="" loading="lazy" onerror="this.closest(\'.cpl-vig\').remove()">'
      +'</div>'
    : '';
  return '<div class="cpl-c'+(vis?' cpl-c-vig':'')+'">'
    +vign
    +'<div class="cpl-tete"><div>'
      +'<div class="cpl-nom">'+escapeHtml(p.name||'Sans nom')+'</div>'
      +'<div class="cpl-meta">'+meta.join(' · ')+'</div>'
      +seg+'</div>'
    // LA PASTILLE DIT L'ETAT, ELLE NE LE CHANGE PAS : ce n'est pas un bouton,
    // et elle n'en a pas l'air. VERT POUR « EN VENTE », GRIS POUR « PRIVE »,
    // et jamais de rouge : un programme garde pour soi n'est pas une faute.
    +'<span class="cpl-pill '+(on?'cpl-pill-on':'cpl-pill-off')+'">'+(on?'En vente':'Privé')+'</span></div>'
    +'<p class="cpl-resume">'+escapeHtml(progResume(p))+'</p>'
    +'<div class="cpl-versions">'
      +(pu==='F'?'':_htmlCplVersion(i,'H',p))
      +(pu==='H'?'':_htmlCplVersion(i,'F',p))+'</div>'
    +'<div class="cpl-actions">'
      +'<button class="btn btn-red btn-sm" onclick="openAssignProgram('+i+')">Assigner</button>'
      // L'ICONE DIT LEQUEL DES DEUX GESTES C'EST : le panier quand il s'agit
      // d'ouvrir la vente, le crayon quand elle est deja ouverte.
      +'<button class="btn btn-outline btn-sm" onclick="'+vendre+'">'
        +'<span class="cpl-ic" aria-hidden="true">'+icon(on?'pencil':'cart',15)+'</span>'
        +(on?'Modifier la vente':'Mettre en vente')+'</button>'
    +'</div>'
    // N4.18 — L'ORDRE SE REGLE, dans le rayon : les MEMES fleches que
    // l'editeur d'exercices, pour une liste qu'on reordonne trois fois par an.
    +'<div class="cpl-pied">'
      +'<button type="button" class="cpl-mini" onclick="cplDeplacer('+i+',-1)"'+(premier?' disabled':'')+' aria-label="Monter ce programme">▲</button>'
      +'<button type="button" class="cpl-mini" onclick="cplDeplacer('+i+',1)"'+(dernier?' disabled':'')+' aria-label="Descendre ce programme">▼</button>'
      +'<button type="button" class="cpl-mini" onclick="duplicateCoachProgTemplate('+i+')">⧉ Dupliquer</button>'
      +'<button type="button" class="cpl-mini cpl-sup" onclick="deleteCoachProgTemplate('+i+')">Supprimer</button>'
    +'</div></div>';
}
// « DANS LA BOUTIQUE », pour le createur seul : les programmes vendus qu'aucun
// modele ne porte. Rend '' quand il n'y en a pas — un rayon vide n'annonce rien.
function _htmlCplBoutique(){
  if(!estVendeur()) return '';
  const lies=new Set(((currentUser&&currentUser.coachPrograms)||[])
    .map(p=>p&&p.boutiqueId).filter(Boolean));
  const ids=RC_PROGRAMMES.map(p=>p.id);
  Object.keys(_boutiqueLocale()||{}).forEach(id=>{ if(ids.indexOf(id)<0) ids.push(id); });
  const rangs=ids.filter(id=>!lies.has(id)).map(id=>{
    const e=programmeDuCatalogue(id);
    if(!e||!e.nom) return '';
    return '<div class="cpl-bq">'
      +'<div class="cpl-bq-img" aria-hidden="true">'
        +(e.image?'<img src="'+escapeHtml(e.image)+'" alt="" loading="lazy" onerror="this.remove()">':'')+'</div>'
      +'<div class="cpl-bq-c"><div class="cpl-bq-n">'+escapeHtml(e.nom)+'</div>'
        // ⚠ UN EMPLACEMENT A COMPLETER SE VOIT ICI, ET NULLE PART AILLEURS
        //   (lot 8). C'est l'ecran ou Kevin le remplira : le cacher ici
        //   reviendrait a poser quatre emplacements que personne ne trouve.
        //   La boutique, elle, ne les montre pas — voir programmesBoutique.
        +'<div class="cpl-bq-p">'+(e.aCompleter
          ?'À compléter, pas encore en vente'
          :(prixProgramme(e)+' · '+(e.masque?'Retiré de la vente':'En vente')))+'</div></div>'
      +'<button class="btn btn-outline btn-sm" onclick="ouvrirFicheVente(\''+escapeHtml(id)+'\')">'
      +(e.aCompleter?'Compléter':'Modifier')+'</button>'
      +'</div>';
  }).join('');
  if(!rangs) return '';
  // « MA BOUTIQUE » ET NON « DANS LA BOUTIQUE », en rouge et plus gros —
  // demande de Kevin, 20/09/2026. Ce n'est pas qu'une couleur : « dans la
  // boutique » designait un ENDROIT ou des programmes se trouvent, « ma
  // boutique » designe ce qui est A LUI. C'est le meme rayon, ce n'est pas la
  // meme phrase.
  return '<section class="cpl-sec cpl-sec-bq">'
    +_htmlCplBandeau('Ma boutique',
      'Vendus sans venir d’un de tes programmes, comme la Fondation livrée avec l’application.')
    +rangs+'</section>';
}
/**
 * L'EN-TETE DE LA VITRINE : la marque du coach, le titre, et les trois filtres.
 *
 * Demande de Kevin, 20/09/2026, maquette a l'appui.
 *
 * ⚠ AUCUNE PHOTO D'AGENCE. La maquette pose un dos travaille en fond ; on ne
 *   le reproduit pas — ce n'est pas notre image, et la livrer dans
 *   l'application engagerait Kevin. Le relief vient donc de ce qu'on maitrise :
 *   ses diagonales rouges, son logo, et sa phrase.
 *
 * ⚠ LA PHRASE EST LA SIENNE, `catchphrase`, deja saisie dans son profil et
 *   deja publiee sur sa vitrine. En inventer une aurait mis dans sa bouche un
 *   slogan qu'il n'a pas choisi, sur l'ecran ou il vend.
 */
function _htmlCplHero(){
  const u=currentUser||{};
  const img=String(u.logo||u.coachPhoto||'').trim();
  const nom=String(u.teamName||((u.fname||'')+' '+(u.lname||''))).trim();
  const ini=(nom.match(/\S/)||['R'])[0].toUpperCase();
  const phrase=String(u.catchphrase||'').trim();
  const f=_cplFiltre;
  return '<header class="cpl-hero">'
    +'<div class="cpl-hero-marque">'
      +'<div class="cpl-hero-l" aria-hidden="true">'
        +(img?'<img src="'+escapeHtml(img)+'" alt="" loading="lazy" onerror="this.remove()">'
             :'<span>'+escapeHtml(ini)+'</span>')
      +'</div>'
      +(nom?'<div class="cpl-hero-n">'+escapeHtml(nom)+'</div>':'')
    +'</div>'
    +'<div class="cpl-hero-c">'
      +'<h2 class="cpl-hero-t">Ma boutique</h2>'
      +'<div class="cpl-hero-s">Programmes d’entraînement</div>'
      +(phrase?'<p class="cpl-hero-p">'+escapeHtml(phrase)+'</p>':'')
    +'</div>'
    // LES TROIS FILTRES. `aria-pressed` et non un groupe radio : ce sont des
    // bascules — aucune n'est « le choix par defaut », et les trois relachees
    // est un etat valide.
    +'<div class="cpl-hero-f">'
      +PROG_PUBLICS.map(x=>'<button type="button" class="cpl-f'+(f===x.cle?' on':'')+'"'
        +' data-pub="'+x.cle+'"'
        +' aria-pressed="'+(f===x.cle)+'" onclick="cplFiltrer(\''+x.cle+'\')">'
        +'<span class="cpl-f-s" aria-hidden="true">'+x.sym+'</span>'
        +escapeHtml(x.lib)+'</button>').join('')
    +'</div></header>';
}
/**
 * Le bandeau d'un rayon : le logo du coach, le titre en rouge, la consigne.
 *
 * ⚠ LE LOGO DU COACH, ET AUCUNE IMAGE INVENTEE. La maquette montre une photo
 *   de dos travaillé en fond ; on ne la reproduit pas — ce n'est pas notre
 *   image, et une photo d'agence livrée dans l'application engagerait Kevin.
 *   Ce qu'on a de vrai, c'est SON logo : il est déjà dans son dossier, déjà
 *   publié avec sa vitrine, et c'est sa marque à lui. Sans logo, l'initiale de
 *   son équipe prend la place — la règle posée pour l'avatar, et pour la même
 *   raison : une initiale nette vaut mieux qu'une image approximative.
 * @param {string} titre
 * @param {string} aide
 */
function _htmlCplBandeau(titre,aide){
  const u=currentUser||{};
  const img=String(u.logo||u.coachPhoto||'').trim();
  const nom=String(u.teamName||((u.fname||'')+' '+(u.lname||''))).trim();
  const ini=(nom.match(/\S/)||['R'])[0].toUpperCase();
  return '<div class="cpl-band">'
    +'<div class="cpl-band-l" aria-hidden="true">'
      +(img?'<img src="'+escapeHtml(img)+'" alt="" loading="lazy" onerror="this.remove()">'
           :'<span>'+escapeHtml(ini)+'</span>')
    +'</div>'

    +'<div class="cpl-band-c">'
      +'<div class="cpl-band-t" role="heading" aria-level="2">'+escapeHtml(titre)+'</div>'
      +(aide?'<p class="cpl-band-d">'+escapeHtml(aide)+'</p>':'')
    +'</div></div>';
}
/**
 * PURE. Les chiffres du cadran. `enVente` est INJECTE et non lu ici : la
 * reponse depend du cache de la boutique, et une fonction qui l'interroge ne se
 * teste plus sans monter une boutique entiere.
 *
 * ⚠ CE QU'ON NE COMPTE PAS : L'ARGENT ENCAISSE. RepCore ne le connait pas —
 *   le paiement d'un programme se fait sur la page du coach, par `lienAchat`,
 *   hors de l'application, et `prix` est un texte LIBRE (« 49 € », « 3 × 20 € »,
 *   « sur devis »). Un « chiffre d'affaires » ici serait une invention, et la
 *   metrique du produit le dit deja pour elle-meme : « un depart, pas une
 *   vente ». On compte donc ce qui est vrai — ce qui est construit, ce qui est
 *   propose, et ce qui tourne reellement chez les athletes.
 * @param {any[]} progs      coachPrograms
 * @param {any[]} athletes   les athletes du coach
 * @param {(p:any)=>boolean} enVente
 */
function cplChiffres(progs,athletes,enVente){
  const l=(progs||[]).filter(Boolean);
  const dit=typeof enVente==='function'?enVente:(()=>false);
  let seances=0, vendus=0;
  const noms=new Set();
  l.forEach(p=>{
    // LES SEANCES COMPTEES SONT CELLES QU'ON PROPOSE. Une version Femme
    // conservee mais plus offerte n'est plus du travail en service : la
    // compter gonflerait le chiffre d'un programme qu'on vient de restreindre.
    const pu=progPublic(p);
    if(pu!=='F') seances+=_cplSeancesPleines(p,'H').length;
    if(pu!=='H') seances+=_cplSeancesPleines(p,'F').length;
    if(dit(p)) vendus++;
    const n=String(p.name||'').trim().toLowerCase();
    if(n) noms.add(n);
  });
  // ⚠ LE LIEN ATHLETE→PROGRAMME PASSE PAR LE NOM, et c'est sa limite. C'est le
  //   seul lien qui existe : _assignerModele ecrit `assignedProgramName`, pas
  //   un identifiant. Deux programmes homonymes se confondent donc, et
  //   renommer un modele detache ceux qui le suivaient. On l'emploie parce que
  //   la fiche de l'athlete affiche deja ce nom-la — un second lien, pose pour
  //   ce seul compteur, aurait diverge du premier.
  const equipes=(athletes||[]).filter(a=>{
    const n=String((a&&a.assignedProgramName)||'').trim().toLowerCase();
    return !!n&&noms.has(n);
  }).length;
  return {total:l.length,vendus,seances,equipes,athletes:(athletes||[]).length};
}
/** Les prix affichables des programmes en vente, dedoublonnes et dans l'ordre. */
function cplPrix(progs,enVente,prixDe){
  const dit=typeof enVente==='function'?enVente:(()=>false);
  const lire=typeof prixDe==='function'?prixDe:(p=>String((p&&p.prix)||'').trim());
  const vus=[];
  (progs||[]).filter(Boolean).forEach(p=>{
    if(!dit(p)) return;
    const x=String(lire(p)||'').trim();
    if(x&&vus.indexOf(x)<0) vus.push(x);
  });
  return vus;
}
/**
 * Le cadran. Rendu MEME A ZERO PROGRAMME ? Non : voir loadCoachProgramsList —
 * un tableau de bord qui n'affiche que des zeros au-dessus d'un ecran vide
 * n'oriente rien, et c'est l'etat d'accueil qui doit parler a ce moment-la.
 */
function _htmlCplCadran(){
  const progs=(currentUser&&currentUser.coachPrograms)||[];
  let athletes=[];
  try{ athletes=Object.values(DB.get('users')||{}).filter(u=>_estMonAthlete(u,currentUser)); }
  catch(e){ athletes=[]; }
  const c=cplChiffres(progs,athletes,_cplEnVente);
  const prix=cplPrix(progs,_cplEnVente,p=>{
    // Le createur vend par la boutique : le prix y vit, pas sur le modele.
    if(estVendeur()&&p&&p.boutiqueId){
      try{ const e=programmeDuCatalogue(p.boutiqueId); if(e) return prixProgramme(e); }catch(x){}
    }
    return String((p&&p.prix)||'').trim();
  });
  // LA BARRE ROUGE SOUS CHAQUE CHIFFRE DIT UNE PROPORTION, ou rien. `--pct`
  // existe deja sur .metric-box : une jauge inventee pour ce cadran aurait
  // donne deux langages pour la meme idee.
  const pct=(a,b)=>b>0?Math.max(0,Math.min(100,Math.round(a/b*100))):0;
  const boite=(val,lib,p,rouge)=>'<div class="metric-box'+(rouge?' cpl-box-r':'')+'" style="--pct:'+p+'%">'
    +'<div class="metric-val">'+val+'</div>'
    +'<div class="metric-label">'+lib+'</div></div>';
  return '<section class="cpl-cadran">'
    +'<div class="cpl-cadran-t">Ton catalogue</div>'
    +'<div class="metric-row-4 metric-row-compacte cpl-cadran-r">'
      +boite(c.total,'Programmes',c.total?100:0,true)
      +boite(c.vendus,'En vente',pct(c.vendus,c.total))
      +boite(c.seances,'Séances',c.seances?100:0)
      +boite(c.equipes,'Athlètes équipés',pct(c.equipes,c.athletes))
    +'</div>'
    // ⚠ ON NE PROMET PAS UN CHIFFRE D'AFFAIRES. On dit les prix pratiques —
    //   ce qui est vrai et verifiable — et on dit POURQUOI le reste manque.
    //   Afficher « 0 € encaissé » aurait ete faux, et « 240 € » aurait ete
    //   invente.
    +'<p class="cpl-cadran-p">'
      +(c.vendus
        ? escapeHtml(c.vendus+' programme'+(c.vendus>1?'s':'')+' en vente'
            +(prix.length?(' · '+prix.slice(0,3).join(' · ')
              +(prix.length>3?(' · +'+(prix.length-3)):'')):''))
          +'<br><span class="cpl-cadran-n">Les paiements se font sur ta page, hors de RepCore : '
          +'l’application ne peut pas compter ce que tu encaisses.</span>'
        : 'Aucun programme en vente pour l’instant. '
          +'<span class="cpl-cadran-n">« Mettre en vente » ouvre la fiche : un titre, une phrase, un prix, ton lien de paiement.</span>')
    +'</p>'
    +'</section>';
}
function loadCoachProgramsList(){
  const progs=(currentUser&&currentUser.coachPrograms)||[];
  const container=document.getElementById('cpl-list');if(!container)return;
  let bq=''; try{ bq=_htmlCplBoutique(); }catch(e){ bq=''; }
  if(!progs.length){
    // R13 — le geste est offert ici, plus renvoye au « + CRÉER » de la barre.
    container.innerHTML=emptyState('folder','<strong style="font-size:var(--fs-md)">Aucun programme pour l\'instant</strong><br><span style="font-size:var(--fs-sm);display:inline-block;margin-top:6px">Un modèle créé une fois sert à tous tes athlètes : pour eux, pour elles, ou pour les deux.</span>','Créer un programme','createCoachProgTemplate()')+bq;return;
  }
  let cadran=''; try{ cadran=_htmlCplCadran(); }catch(e){ cadran=''; }
  let hero=''; try{ hero=_htmlCplHero(); }catch(e){ hero=''; }
  // TROIS TITRES POUR SEQUENCER : Homme, Femme, Mixte. Une section vide ne
  // s'affiche pas — annoncer « Femme 0 » n'oriente personne.
  //
  // ⚠ LE FILTRE MASQUE LES AUTRES SECTIONS, IL NE TOUCHE PAS AUX INDEX. Chaque
  //   bouton porte l'index REEL dans coachPrograms : filtrer en reconstruisant
  //   un tableau aurait renumerote « Assigner » et « Supprimer » sur la liste
  //   visible, et le coach aurait supprime un programme qu'il ne voyait pas.
  container.innerHTML=hero+cadran+PROG_PUBLICS.map(r=>{
    if(_cplFiltre&&_cplFiltre!==r.cle) return '';
    const idx=[];
    progs.forEach((p,i)=>{ if(p&&_cplGroupe(p)===r.cle) idx.push(i); });
    if(!idx.length) return '';
    return '<section class="cpl-sec">'
      +'<div class="cpl-sec-t cpl-sec-g" data-pub="'+r.cle+'" role="heading" aria-level="2">'
        +'<span class="cpl-sec-s" aria-hidden="true">'+r.sym+'</span>'
        +escapeHtml(r.lib)
        +' <span class="cpl-sec-n">'+idx.length+'</span></div>'
      +idx.map((i,k)=>_htmlCplCarte(progs[i],i,k===0,k===idx.length-1)).join('')
      +'</section>';
  }).join('')+bq;
  // ⚠ UN FILTRE QUI NE REND RIEN DOIT LE DIRE. Sans ce mot, toucher « Femme »
  //   sur un catalogue qui n'en compte aucun vidait l'ecran : le coach voyait
  //   un bug la ou il n'y avait qu'une reponse vide, et rien ne lui disait
  //   comment revenir.
  if(_cplFiltre&&!container.querySelector('.cpl-c')){
    const lib=(PROG_PUBLICS.find(x=>x.cle===_cplFiltre)||{}).lib||'';
    container.insertAdjacentHTML('beforeend',
      emptyState('folder','Aucun programme « '+escapeHtml(lib)+' » pour l’instant.',
        'Revoir tout le catalogue','cplFiltrer(\''+_cplFiltre+'\')','padding:24px 8px'));
  }
}

function _cptCount(sessions){return sessions?sessions.filter(s=>s.active&&s.exercises?.length).length:0;}

// N4.18 — DEPLACER UN MODELE DANS LA LISTE.
// ATTENTION AUX INDEX : Assigner, Vendre, Dupliquer et Supprimer passent
// tous l'index du TABLEAU. Reordonner le tableau lui-meme, puis re-rendre,
// garde donc les boutons justes — c'est la seule facon de le faire sans avoir
// a les toucher.
// DANS SON RAYON : le voisin est le plus proche modele DU MEME RAYON. Echanger
// avec l'element d'a cote du tableau ferait passer un programme d'un rayon a
// l'autre a l'affichage — ou ne rien montrer bouger du tout.
// L'ORDRE EST PERSISTE : saveUser, comme tout ce qui vit dans coachPrograms.
function cplDeplacer(i,sens){
  const l=(currentUser&&currentUser.coachPrograms)||[];
  if(!l[i]||(sens!==1&&sens!==-1)) return false;
  const r=_cplGroupe(l[i]);
  let j=i+sens;
  while(j>=0&&j<l.length&&_cplGroupe(l[j])!==r) j+=sens;
  if(j<0||j>=l.length) return false;
  const t=l[i]; l[i]=l[j]; l[j]=t;
  try{ saveUser(); }catch(e){ rcErreurMuette('cplDeplacer',e); }
  loadCoachProgramsList();
  return true;
}

// N4.16 — LE PRE-REMPLISSAGE EST UTILE, MAIS IL DOIT ETRE CHOISI.
// Creer un modele copiait la Fondation dans les DEUX genres : trois jours
// actifs de six exercices chacun, soit trente-six exercices a effacer un par
// un — un clic par exercice, sans confirmation ni annulation — pour un coach
// qui ne programme pas la Fondation.
// On ne la retire pas : elle rend service a qui debute. On la PROPOSE, et
// elle reste le defaut pour ne surprendre personne.
// RIEN N'EST ECRIT AVANT SAUVEGARDER, comme sur tout cet ecran : le modele
// naît dans currentUser.coachPrograms et c'est le bouton de l'ecran qui le
// persiste — saveUser ici ne fait que ce que la fonction faisait deja.
const CPT_VIDE=Object.freeze([]);
function _cptSeancesVides(){
  // Sept creneaux eteints, la meme forme que la Fondation : les fonctions de
  // rendu attendent un tableau de sept, pas un tableau vide.
  return DAYS.map((day)=>({day,name:'',active:false,exercises:[],notes:'',warmup:'',cooldown:''}));
}
async function createCoachProgTemplate(){
  if(!currentUser.coachPrograms) currentUser.coachPrograms=[];
  const nl=String.fromCharCode(10);
  const avecFondation=await rcConfirm(
    'Partir du Programme Fondation ?'+nl+nl
    +'La Fondation garnit trois jours de six exercices, dans les deux genres : '
    +'un point de depart si tu debutes.'+nl
    +'Sinon, tu obtiens sept jours vides a remplir toi-meme.',
    null,'Fondation','Modèle vide');
  // ⚠ AUCUN DES CINQ CHAMPS DE VENTE N'EST POSE ICI, ET C'EST LE CONTRAT.
  // enVente, pitch, prix, lienAchat et visuel (voir CPT_CHAMPS_VENTE) sont
  // FACULTATIFS et ABSENTS par defaut : un programme qui n'en porte aucun se
  // lit « pas en vente », exactement comme les programmes crees avant ce lot.
  // Les poser a vide obligerait a distinguer « faux » de « jamais renseigne »,
  // alourdirait chaque sauvegarde, et demanderait une migration — trois couts
  // pour zero gain. C'est ouvrirVenteProgramme qui les cree, un par un, quand
  // le coach les remplit.
  const p={id:Date.now().toString(36),name:'Nouveau programme',createdAt:Date.now(),
    sessions_H:avecFondation
      ?FONDATION_H.map(s=>({...s,exercises:s.exercises.map(e=>({...e}))}))
      :_cptSeancesVides(),
    sessions_F:avecFondation
      ?FONDATION_F.map(s=>({...s,exercises:s.exercises.map(e=>({...e}))}))
      :_cptSeancesVides()};
  currentUser.coachPrograms.push(p);
  saveUser();
  editCoachProgTemplate(currentUser.coachPrograms.length-1);
}

// ══ COLLER UN PROGRAMME EXISTANT (05/10/2026) ═════════════════════════════
// Le coach qui arrive a ses programmes dans un tableur. L'import par PDF ou
// photo est fermé (LEGACY_PDF_IMPORT) ; ce chemin-ci ne lit que du texte
// collé, ce que Sheets et Excel donnent tels quels (tabulations).
//
// UNE LIGNE PAR EXERCICE : nom ; séries ; reps ; puis, facultatifs, la charge
// et/ou le RIR (« RIR 2 »). « 4x10 » dans la colonne des séries vaut séries et
// reps. Une LIGNE VIDE ouvre la séance suivante ; une ligne seule qui se
// termine par « : » ou commence par « Séance »/« Jour » la nomme. Les lignes
// d'en-tête (« Exercice », « Séries »…) sont ignorées.
//
// ⚠ LE NOM EST RAPPROCHÉ DE LA BANQUE PAR exKey, la clé qui fait l'identité
//   stable d'un exercice (vidéos, historique, alias). Un nom reconnu prend
//   l'écriture de la banque ; un nom inconnu est GARDÉ tel quel et marqué
//   `_inconnu` : l'aperçu le montre, et le coach choisit une suggestion ou le
//   laisse — un exercice maison reste un exercice.
const COLLAGE_LIGNES_MAX=200;
const COLLAGE_SEANCES_MAX=7;
const _COLLAGE_ENTETES=new Set(['EXERCICE','EXERCICES','EXERCISE','EXERCISES','NOM','MOUVEMENT','MOUVEMENTS',
  'SERIES','SERIE','SETS','REPS','REPETITIONS','CHARGE','POIDS','RIR']);
let _collageIndex=null;
// La banque indexée par clé (alias du coach compris), construite une fois.
function _collageBanque(){
  if(_collageIndex) return _collageIndex;
  const m=new Map();
  try{ for(const n of _nomsRemplacement()){ const k=exKey(n); if(k&&!m.has(k)) m.set(k,n); } }catch(e){}
  _collageIndex=m;
  return m;
}
function _collageReconnaitre(nom){
  const m=_collageBanque();
  let k=''; try{ k=exKey(nom); }catch(e){ k=''; }
  if(!k) return '';
  if(m.has(k)) return m.get(k);
  let a=''; try{ a=resoudreAlias(k); }catch(e){ a=''; }
  return (a&&m.has(a))?m.get(a):'';
}
// PURE. « 8-10 », « 8 à 10 », « 8–10 » → « 8-10 » ; « 12 » → « 12 » ; le reste
// (« MAX », « 30 s ») tel quel.
function _collageReps(v){
  const s=String(v==null?'':v).trim();
  const p=/^(\d+)\s*(?:-|–|—|à|a)\s*(\d+)$/i.exec(s);
  if(p) return p[1]+'-'+p[2];
  return s;
}
function _collageCellules(l){
  const sep=l.indexOf('\t')>=0?'\t':(l.indexOf(';')>=0?';':',');
  return l.split(sep).map(c=>c.trim());
}
function _collageEntete(cells){
  return cells.filter(Boolean).length>0&&cells.filter(Boolean).every(c=>{
    let k=''; try{ k=exKey(c); }catch(e){} return _COLLAGE_ENTETES.has(k)||/^(EXERCICE|SERIE|REPETITION|CHARGE)/.test(k);
  });
}
/**
 * PURE (la banque est une constante). Le texte collé → les séances.
 * @param {string} texte
 * @returns {{seances:{nom:string,exercices:{name:string,sets:number|null,reps:string,charge?:string,rir?:string,_inconnu:boolean}[]}[],
 *   ignorees:number,tronque:boolean,reconnus:number,inconnus:number}}
 */
function parserCollageProgramme(texte){
  const toutes=String(texte||'').split(/\r?\n/);
  const tronque=toutes.length>COLLAGE_LIGNES_MAX;
  const seances=[]; let cur=null, ignorees=0, reconnus=0, inconnus=0;
  const fermer=()=>{ if(cur&&cur.exercices.length) seances.push(cur); cur=null; };
  for(const brut of toutes.slice(0,COLLAGE_LIGNES_MAX)){
    if(!brut.trim()){ fermer(); continue; }
    const cells=_collageCellules(brut);
    if(_collageEntete(cells)){ ignorees++; continue; }
    const nom=cells[0]||'';
    const reste=cells.slice(1).filter(Boolean);
    // Une ligne seule qui NOMME la séance.
    if(!reste.length&&(/:\s*$/.test(nom)||/^(s[ée]ance|jour|day|session)\b/i.test(nom))){
      fermer(); cur={nom:nom.replace(/:\s*$/,'').trim(),exercices:[]}; continue;
    }
    if(!nom){ ignorees++; continue; }
    let sets=null, reps='';
    const sx=/^(\d+)\s*[x×*]\s*(.+)$/i.exec(cells[1]||'');
    if(sx){ sets=+sx[1]; reps=_collageReps(sx[2]); }
    else {
      const n=parseInt(cells[1],10);
      sets=Number.isFinite(n)&&n>0?n:null;
      reps=_collageReps(cells[2]);
    }
    const ex={name:nom,sets,reps,_inconnu:false};
    for(const c of cells.slice(sx?2:3)){
      if(!c) continue;
      const r=/^rir\s*:?\s*(\d+(?:\s*-\s*\d+)?)$/i.exec(c);
      if(r){ ex.rir=r[1].replace(/\s+/g,''); continue; }
      if(!ex.charge) ex.charge=c;
    }
    const banque=_collageReconnaitre(nom);
    if(banque){ ex.name=banque; reconnus++; } else { ex._inconnu=true; inconnus++; }
    if(!cur) cur={nom:'',exercices:[]};
    cur.exercices.push(ex);
  }
  fermer();
  seances.forEach((s,i)=>{ if(!s.nom) s.nom='Séance '+String.fromCharCode(65+i); });
  return {seances,ignorees,tronque,reconnus,inconnus};
}
// PURE. Les noms de la banque les plus proches d'un nom inconnu : les mots en
// commun (quatre lettres au moins), puis l'ordre alphabétique.
function suggestionsBanque(nom,n){
  let mots=[]; try{ mots=exKey(nom).split(' ').filter(w=>w.length>=4); }catch(e){}
  if(!mots.length) return [];
  const l=[];
  for(const [k,v] of _collageBanque()){
    const kk=' '+k+' ';
    let sc=0; for(const w of mots) if(kk.indexOf(' '+w)>=0) sc++;
    if(sc) l.push({v,sc});
  }
  return l.sort((a,b)=>b.sc-a.sc||(a.v<b.v?-1:1)).slice(0,n||4).map(x=>x.v);
}
// PURE. Les jours des séances : à partir du jour choisi, un jour sur deux
// jusqu'à trois séances, puis jour après jour. « Nouveau modèle » part du lundi.
function joursCollage(nb,depart){
  const d=Math.max(0,DAYS.indexOf(depart));
  const pas=nb<=3?2:1;
  const vus=new Set(), l=[];
  for(let i=0;i<nb;i++){
    let j=(d+i*pas)%7;
    while(vus.has(j)) j=(j+1)%7;
    vus.add(j); l.push(DAYS[j]);
  }
  return l;
}
// PURE. Le modèle : même forme que createCoachProgTemplate — sept créneaux,
// les deux versions (Homme et Femme) garnies à l'identique.
function modeleDepuisCollage(r,nom,depart){
  const jours=joursCollage(r.seances.length,depart);
  const version=()=>{
    const v=_cptSeancesVides();
    r.seances.forEach((s,i)=>{
      const slot=v.find(x=>x.day===jours[i]);
      slot.name=s.nom; slot.active=true;
      slot.exercises=s.exercices.map(e=>{
        const o={name:e.name,series:e.sets||3,reps:e.reps||'10',repos:'',description:'',videoUrl:'',videoUrl2:''};
        if(e.charge) o.charge=e.charge;
        if(e.rir) o.rir=e.rir;
        return o;
      });
    });
    return v;
  };
  return {id:Date.now().toString(36),name:String(nom||'').trim().slice(0,80)||'Programme importé',createdAt:Date.now(),
    origine:'collage',sessions_H:version(),sessions_F:version()};
}
let _collageEtat=null;
const _collageChamp='width:100%;box-sizing:border-box;font-family:Montserrat,sans-serif;font-size:var(--fs-md);'
  +'background:var(--surface-1);color:var(--text);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px';
function ouvrirImportCollage(){
  if(!currentUser||currentUser.role!=='coach') return false;
  try{ closeModal(); }catch(e){}
  _collageEtat=null;
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div id="col-feuille" role="dialog" aria-modal="true" aria-labelledby="col-titre" onclick="event.stopPropagation()" '
    +'style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px 20px 24px;width:100%;'
    +'max-width:560px;max-height:88vh;overflow-y:auto;box-sizing:border-box;animation:fadeIn var(--t-3) var(--c-out)">'
    +'<h2 id="col-titre" style="margin:0 0 4px;font-size:var(--fs-lg)">Coller un programme existant</h2>'
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.5;margin:0 0 12px">Copie les lignes depuis Excel ou '
    +'Google Sheets : <b>exercice, séries, reps</b>, puis la charge ou le RIR si tu les as. Une ligne vide sépare deux séances. '
    +COLLAGE_LIGNES_MAX+' lignes au plus.</p>'
    +'<textarea id="col-texte" rows="9" placeholder="Développé couché\t4\t8-10\nRowing barre\t4\t10\n\nSquat\t5\t5\tRIR 2" '
    +'style="'+_collageChamp+';resize:vertical;min-height:160px;font-size:var(--fs-sm)"></textarea>'
    +'<div style="display:flex;gap:8px;margin:12px 0">'
    +'<input id="col-nom" placeholder="Nom du modèle" style="'+_collageChamp+';flex:1;min-width:0" maxlength="80">'
    +'<select id="col-jour" aria-label="Premier jour" style="'+_collageChamp+';flex:1;min-width:0">'
    +'<option value="">Nouveau modèle (dès lundi)</option>'
    +DAYS.map(d=>'<option value="'+d+'">À partir du '+d.toLowerCase()+'</option>').join('')+'</select></div>'
    +'<div id="col-err" style="display:none;font-size:var(--fs-sm);color:var(--red-light);line-height:1.5;margin-bottom:8px"></div>'
    +'<div id="col-apercu"></div>'
    +'<button type="button" id="col-voir" class="btn btn-red" style="width:100%;min-height:46px;margin-bottom:10px" onclick="collageApercu()">Voir l’aperçu</button>'
    +'<button type="button" class="btn btn-outline" style="width:100%;min-height:44px" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
function _collageDire(m){
  const e=document.getElementById('col-err');
  if(e){ e.textContent=m||''; e.style.display=m?'block':'none'; }
}
// L'aperçu AVANT d'écrire quoi que ce soit : chaque séance, chaque exercice,
// les inconnus surlignés avec les suggestions de la banque.
function collageApercu(){
  const r=parserCollageProgramme((document.getElementById('col-texte')||{}).value||'');
  _collageEtat=r;
  return _collageRendre();
}
function _collageRendre(){
  const r=_collageEtat, z=document.getElementById('col-apercu'), voir=document.getElementById('col-voir');
  if(!r||!z) return false;
  const nbEx=r.seances.reduce((a,s)=>a+s.exercices.length,0);
  if(!nbEx){ z.innerHTML=''; _collageDire('Aucun exercice trouvé : colle une ligne par exercice — le nom, puis les séries et les reps.'); return false; }
  if(!r.reconnus){ _collageDire('Aucun exercice reconnu dans la banque. Vérifie que la première colonne est bien le nom de l’exercice '
    +'(« Développé couché », « Squat »…), ou choisis une suggestion ci-dessous.'); }
  else if(r.seances.length>COLLAGE_SEANCES_MAX) _collageDire(r.seances.length+' séances : '+COLLAGE_SEANCES_MAX+' au plus, une par jour. Regroupe-les avant de coller.');
  else _collageDire('');
  z.innerHTML='<div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:8px">'
    +r.seances.length+' séance'+(r.seances.length>1?'s':'')+' · '+nbEx+' exercice'+(nbEx>1?'s':'')
    +' · '+r.reconnus+' reconnu'+(r.reconnus>1?'s':'')
    +(r.inconnus?' · <b style="color:var(--orange)">'+r.inconnus+' à vérifier</b>':'')
    +(r.tronque?' · au-delà de '+COLLAGE_LIGNES_MAX+' lignes, la suite est ignorée':'')+'</div>'
    +r.seances.map((s,i)=>'<div class="col-seance" style="background:var(--surface-1);border:1px solid var(--border);'
      +'border-radius:var(--r-3);padding:10px 12px;margin-bottom:8px">'
      +'<div style="font-weight:800;font-size:var(--fs-sm);margin-bottom:6px">'+escapeHtml(s.nom)+'</div>'
      +s.exercices.map((e,j)=>'<div class="col-ex'+(e._inconnu?' col-inconnu':'')+'" style="padding:6px 8px;margin-bottom:4px;'
        +'border-radius:var(--r-2);'+(e._inconnu?'border:1px solid var(--orange);background:color-mix(in srgb,var(--orange) 10%,transparent)':'border:1px solid transparent')+'">'
        +'<div style="font-size:var(--fs-sm)">'+escapeHtml(e.name)
        +' <span style="color:var(--sub)">· '+(e.sets||'?')+' × '+escapeHtml(e.reps||'?')
        +(e.charge?' · '+escapeHtml(e.charge):'')+(e.rir?' · RIR '+escapeHtml(e.rir):'')+'</span></div>'
        +(e._inconnu?'<div style="font-size:var(--fs-xs);color:var(--orange);margin-top:4px">Pas dans la banque'
          +(suggestionsBanque(e.name).length?' : ':', gardé tel quel.')
          +suggestionsBanque(e.name).map(n=>'<button type="button" class="btn btn-outline btn-sm col-sugg" style="margin:4px 4px 0 0" '
            +'onclick="collageChoisir('+i+','+j+',this.dataset.n)" data-n="'+escapeHtml(n)+'">'+escapeHtml(n)+'</button>').join('')
          +'</div>':'')
        +'</div>').join('')
      +'</div>').join('')
    +(r.reconnus&&r.seances.length<=COLLAGE_SEANCES_MAX
      ?'<button type="button" id="col-creer" class="btn btn-red" style="width:100%;min-height:46px;margin:4px 0 10px" onclick="collageCreer()">'
        +'Créer le modèle</button>':'');
  if(voir){ voir.textContent='Relire le collage'; voir.className='btn btn-outline'; }
  return true;
}
// Une suggestion choisie : le nom de la banque remplace le nom collé.
function collageChoisir(i,j,nom){
  const e=_collageEtat&&_collageEtat.seances[i]&&_collageEtat.seances[i].exercices[j];
  if(!e||!nom) return false;
  e.name=nom; e._inconnu=false;
  _collageEtat.inconnus=Math.max(0,_collageEtat.inconnus-1); _collageEtat.reconnus++;
  return _collageRendre();
}
function collageCreer(){
  const r=_collageEtat;
  if(!r||!r.reconnus||!r.seances.length||r.seances.length>COLLAGE_SEANCES_MAX) return false;
  const p=modeleDepuisCollage(r,(document.getElementById('col-nom')||{}).value,(document.getElementById('col-jour')||{}).value||'Lundi');
  if(!currentUser.coachPrograms) currentUser.coachPrograms=[];
  currentUser.coachPrograms.push(p);
  try{ saveUser(); }catch(e){ rcErreurMuette('collageCreer',e); }
  try{ closeModal(); }catch(e){}
  toast(ICO.coche+' Modèle créé : '+p.name,'var(--green)');
  try{ editCoachProgTemplate(currentUser.coachPrograms.length-1); }catch(e){ rcErreurMuette('collageCreer',e); }
  return p;
}

// `genre` : la version qu'on a touchee dans la liste. Sans lui, la version
// Homme, comme avant.
function editCoachProgTemplate(idx,genre){
  const g=(genre==='F')?'F':'H';
  _editProgTemplateIdx=idx;
  _editProgTemplateGender=g;
  const p=currentUser.coachPrograms[idx];
  _c4Avant=_c4Snapshot(p);
  const inp=document.getElementById('cpt-name');
  if(inp) inp.value=p.name||'';
  go('s-coach-prog-template');
  loadProgTemplateSlots(g);
}

function saveCoachProgTemplateName(){
  if(_editProgTemplateIdx===null) return;
  const v=document.getElementById('cpt-name')?.value||'';
  currentUser.coachPrograms[_editProgTemplateIdx].name=v;
}

function saveCoachProgTemplate(){
  saveCoachProgTemplateName();
  const p=(currentUser.coachPrograms||[])[_editProgTemplateIdx];
  try{ if(modeleVersionner(p,_c4Avant)) _c4Avant=_c4Snapshot(p); }catch(e){}
  const local=saveUser();
  try{ renderPropagationEntree(); }catch(e){}
  // LA BOUTIQUE SUIT LE MODELE. Un programme en vente se livrait tel qu'il
  // etait le jour de sa publication : le coach corrigeait une seance, et
  // l'acheteur suivant recevait l'ancienne. On pousse les SEANCES, et elles
  // seules — titre, prix et visuel restent ceux de la fiche de vente.
  if(p&&p.boutiqueId&&estVendeur()&&_programmePublie(p.boutiqueId))
    return toastSync(local,_majSeancesBoutique(p),
      ' Programme sauvegardé, et à jour dans la boutique','ton programme est');
  toastEcriture(local,' Programme sauvegardé !','ton programme est');
}
// Rejette avec un message ACTIONNABLE : toastSync l'affiche tel quel, et le
// coach sait que la boutique livre encore l'ancienne version.
async function _majSeancesBoutique(p){
  const s=_venteSeancesJson(p);
  let ok=false;
  if(s&&s.length<240000&&CLOUD.ok()){
    try{ ok=await CLOUD.majSeancesProgrammeBoutique(p.boutiqueId,s); }catch(e){ ok=false; }
  }
  if(ok){
    // Le cache suit, sans attendre la prochaine relecture du noeud.
    _poserContenuLocal(p.boutiqueId,{seances:s,maj:Date.now()});
    return true;
  }
  const e=new Error(!s
    ?'Programme sauvegardé. La boutique garde l’ancienne version : ce programme n’a plus aucune séance.'
    :'Programme sauvegardé, mais la boutique livre encore l’ancienne version : sauvegarde de nouveau une fois en ligne.');
  e._actionnable=true;
  throw e;
}

// Repartir d'un programme existant plutôt que de tout ressaisir. JSON plutôt
// que structuredClone : c'est l'idiome déjà employé partout ailleurs dans ce
// fichier, et les données sont du JSON pur — le résultat est identique.
function duplicateCoachProgTemplate(idx){
  const src=(currentUser.coachPrograms||[])[idx];
  if(!src) return;
  const p=JSON.parse(JSON.stringify(src));
  p.id=Date.now().toString(36);
  // LA COPIE N'EST PAS EN VENTE. Garder le lien vers la fiche de la boutique
  // ferait de deux modeles les auteurs d'une meme fiche : le dernier
  // sauvegarde ecraserait les seances vendues de l'autre.
  delete p.boutiqueId;
  p.name=(src.name||'Sans nom')+' (copie)';
  p.createdAt=Date.now();
  currentUser.coachPrograms.push(p);
  toastEcriture(saveUser(),'« '+p.name+' » créé','le programme est');
  loadCoachProgramsList();
}

async function deleteCoachProgTemplate(idx){
  // EN VENTE DANS LA BOUTIQUE, IL Y RESTE : la fiche ne depend pas du modele,
  // et ceux qui l'ont achete doivent le garder. On le dit avant, et la fiche
  // reapparait sous « Ma boutique », ou elle se retire de la vente.
  const _enBoutique=_cplEnVente(currentUser.coachPrograms[idx])&&estVendeur();
  if(!await rcConfirm('Supprimer ce programme ?',
    _enBoutique?'Il reste en vente dans la boutique : retire-le de la vente si tu ne veux plus le vendre.':null,
    'Supprimer')) return;
  // ⚠ UN PROGRAMME EN VENTE QU'ON SUPPRIME DOIT QUITTER LA VITRINE. Sans cette
  // ligne, la carte restait publiee dans coach_public : les athletes voyaient
  // toujours un bouton d'achat pour un programme qui n'existe plus, et rien du
  // cote du coach ne le disait. On relit l'etat AVANT de decider de republier.
  const _vendait=progEnVente(currentUser.coachPrograms[idx]);
  currentUser.coachPrograms.splice(idx,1);
  saveUser();
  if(_vendait) CLOUD.pushProfilCoach(currentUser).catch(()=>{});
  toast('Programme supprimé.');loadCoachProgramsList();
}

