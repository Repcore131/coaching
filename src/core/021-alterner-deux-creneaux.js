// ══════════════ ALTERNER DEUX CRENEAUX ═════════════════════════════════
//
// Demande de Kevin, 08/09/2026 : « interchanger avec une autre seance celle
// choisie ». Il arrive qu'une seance tombe le mauvais jour — un empechement,
// une salle pleine — et la seule facon de la deplacer etait de retaper les
// deux seances, exercice par exercice.
//
// ⚠ C'EST LE CONTENU QUI VOYAGE, PAS LE JOUR. Un creneau porte un JOUR
// (`day`, « Lundi ») et une SEANCE (nom, exercices, photo, fiche). Echanger
// les objets entiers echangerait aussi les jours, et les deux lignes
// resteraient exactement ou elles etaient : lundi deviendrait mercredi et
// reciproquement, ce qui ne deplace rien. On echange donc tout SAUF le jour.
//
// ⚠ ET SAUF `active`. Un creneau eteint ne s'affiche pas ; si l'etat suivait
// le contenu, alterner avec un jour inactif ferait DISPARAITRE la seance
// qu'on vient de deplacer. Le jour reste allume ou eteint comme il l'etait.
const SEANCE_CHAMPS_MOBILES=Object.freeze(['name','exercises','photo','fiche',
  'ficheUrl','notes','couleur','duree','_essai']);

// PURE. Rend deux creneaux echanges, sans toucher aux originaux. Separee du
// DOM pour qu'une assertion puisse l'eprouver sans ouvrir d'ecran.
function _echangerCreneaux(a,b){
  const A=Object.assign({},a||{}), B=Object.assign({},b||{});
  for(const k of SEANCE_CHAMPS_MOBILES){
    const t=A[k];
    if(B[k]===undefined) delete A[k]; else A[k]=B[k];
    if(t===undefined) delete B[k]; else B[k]=t;
  }
  return [A,B];
}

// PURE. Les creneaux vers lesquels on peut alterner : tous sauf soi-meme.
// ⚠ UN CRENEAU VIDE Y FIGURE. Deplacer une seance sur un jour libre est le cas
// le PLUS courant ; l'exclure aurait rendu le bouton inutile la moitie du
// temps. Le libelle dit qu'il est vide plutot que de le cacher.
function _creneauxAlternables(user,i){
  const l=((user||currentUser||{}).sessions_config)||[];
  const out=[];
  for(let k=0;k<l.length;k++){
    if(k===i||!l[k]) continue;
    const n=String(l[k].name||'').trim();
    out.push({i:k,jour:String(l[k].day||('Jour '+(k+1))),
      nom:n||'(aucune séance)',vide:!n,actif:l[k].active!==false});
  }
  return out;
}

// ⚠ PAS DE MODALE, ET C'EST DELIBERE. Il n'existe pas de feuille de CHOIX dans
// ce fichier — rcSaisie ne porte qu'un champ de texte, rcConfirm que deux
// boutons — et en inventer une pour ce seul geste aurait ajoute un composant
// a maintenir. La liste se deplie SOUS le bouton, dans la carte : on voit d'ou
// part la seance et ou elle va, sans quitter des yeux la carte qu'on deplace.
function alternerSeance(i){
  const z=document.getElementById('alt-'+i);
  if(!z) return false;
  if(z.innerHTML){ z.innerHTML=''; return true; }   // second clic : on referme
  const cibles=_creneauxAlternables(currentUser,i);
  if(!cibles.length){
    try{ toast('Il faut au moins deux créneaux pour en alterner.','var(--orange)'); }catch(e){}
    return false;
  }
  const src=((currentUser&&currentUser.sessions_config)||[])[i]||{};
  z.innerHTML='<div style="margin-top:8px;background:var(--surface-1);'
    +'border:1px solid var(--border);border-radius:var(--r-3);padding:12px 12px">'
    +'<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.55;'
    +'margin-bottom:8px">'
    +escapeHtml('Échanger « '+(String(src.name||'').trim()||'cette séance')
      +' » avec :')+'</div>'
    +cibles.map(c=>'<button type="button" class="btn btn-outline btn-sm" '
      +'style="width:100%;margin:0 0 6px;text-transform:none;letter-spacing:.4px;'
      +'text-align:left;padding:10px 12px" onclick="_alternerVers('+i+','+c.i+')">'
      +'<span style="font-weight:800">'+escapeHtml(c.jour)+'</span>'
      +'<span style="color:var(--text-faint)"> : '+escapeHtml(c.nom)+'</span>'
      +(c.actif?'':'<span style="color:var(--text-faint)"> · jour éteint</span>')
      +'</button>').join('')
    +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;'
    +'margin:2px 0 0;opacity:.75" onclick="alternerSeance('+i+')">Annuler</button>'
    +'</div>';
  return true;
}

function _alternerVers(i,j){
  const l=(currentUser&&currentUser.sessions_config)||[];
  if(!l[i]||!l[j]||i===j) return false;
  const [A,B]=_echangerCreneaux(l[i],l[j]);
  l[i]=A; l[j]=B;
  // Les deux creneaux sont desormais PERSONNALISES : ils ne sont plus le repli
  // generique du coach, et le marqueur d'essai doit tomber des deux cotes.
  try{ _personnaliserSeance(i); _personnaliserSeance(j); }catch(e){}
  saveUser();
  try{ loadSessionManager(); }catch(e){}
  try{ toast('Séances alternées'); }catch(e){}
  return true;
}
function renameSession(i,val){
  if(!currentUser.sessions_config) return;
  currentUser.sessions_config[i].name=val;
  _personnaliserSeance(i);
  saveUser();
}

function removeSessionPhoto(i){
  if(!currentUser.sessions_config) return;
  currentUser.sessions_config[i].photo=null;
  _personnaliserSeance(i);
  saveUser();loadSessionManager();
}

// ══════════ LA PREMIERE MARCHE ════════════════════════════════════════
//
// LE DEFAUT QU'ELLE CORRIGE : un athlete qui vient de creer son compte et dont
// le coach n'a pas encore publie de programme arrive sur l'accueil sans rien a
// faire. Il etait motive ; il n'a pas de premiere marche.
//
// ⚠ CE LOT NE CREE AUCUNE NOTION NOUVELLE DE « SEANCE PROVISOIRE ». Elle
// existe deja, complete, juste en dessous : initSessionsConfig fabrique un
// repli, seanceEstExemple le reconnait, programmeEstEssai allume _bandeauEssai
// — « Ton coach n'a pas encore publie ton programme… ne sont pas
// personnalisees pour toi » —, _personnaliserSeance retire la marque des qu'on
// y touche, et _configReelle garantit que la publication du coach ecrase le
// repli. Ce qui manquait n'etait pas le mecanisme : c'etait de DEMANDER a
// l'athlete ce qu'il veut faire, et de lui poser une seance devant lui.
//
// La seance produite ici porte donc `_essai` comme les autres, et tout ce qui
// precede continue de s'appliquer sans une ligne de plus.

// LES TROIS QUESTIONS. Trois, pas quatre : chacune doit se repondre sans
// reflechir, et la quatrieme est toujours celle qui fait fermer l'app.
const PS_OBJECTIFS=[
  {cle:'force', lib:'Force',            sous:'Soulever plus lourd',      series:5,reps:'5',    repos:'3 min'},
  {cle:'masse', lib:'Prise de masse',   sous:'Construire du muscle',     series:4,reps:'8-12', repos:'2 min'},
  {cle:'forme', lib:'Remise en forme',  sous:'Reprendre en douceur',     series:3,reps:'12-15',repos:'1 min 30'}
];
const PS_FREQUENCES=[2,3,4];
const PS_LIEUX=[
  {cle:'salle',  lib:'En salle', sous:'Machines et charges libres'},
  {cle:'maison', lib:'À la maison', sous:'Poids du corps, haltères, élastique'}
];

// LES SEANCES, ECRITES A LA MAIN ET VERIFIEES CONTRE LE CATALOGUE.
//
// ⚠ POURQUOI PAS UN FILTRE AUTOMATIQUE SUR LE NOM. Retirer d'EX_GUIDE_BRUT
// tout ce qui contient « machine », « poulie », « presse »… donne des resultats
// faux dans les deux sens : « LEG CURL ASSIS » est une machine sans porter le
// mot, et « NORDIC CURL AVEC ELASTIQUE » n'en est pas une tout en portant
// « curl ». Un debutant a qui on propose un exercice impossible chez lui ne
// recommence pas. Le filtrage sur le materiel est donc fait UNE FOIS, a la
// main, et deux assertions le tiennent : chaque nom existe dans le catalogue,
// et aucun nom de la colonne « maison » ne porte de mot d'agres de salle.
//
// L'ORDRE EST CELUI DE LA SEANCE : les gros mouvements d'abord, le gainage en
// dernier. Ce n'est pas une preference, c'est la seule facon de ne pas finir
// ses squats avec des abdominaux deja fatigues.
//
// DEUX DECOUPES SEULEMENT. A deux ou trois seances par semaine, un debutant
// progresse mieux en full body : chaque muscle est touche deux ou trois fois.
// A quatre, la repartition haut / bas devient tenable, et cette premiere
// seance est celle du HAUT. Au-dela, c'est le travail du coach, pas le notre.
const PS_SEANCES={
  salle:{
    full:['SQUAT','DEVELOPPE COUCHE BARRE','TIRAGE POITRINE PRISE NEUTRE',
          'SOULEVE DE TERRE ROUMAIN HALTERES','DEVELOPPE MILITAIRE HALTERES','GAINAGE PLANCHE'],
    haut:['DEVELOPPE COUCHE BARRE','TIRAGE POITRINE PRISE NEUTRE','DEVELOPPE MILITAIRE HALTERES',
          'TIRAGE HORIZONTAL SERRE','CURL BARRE']
  },
  maison:{
    full:['SQUAT AVEC HALTERES','POMPES','ROWING HALTERE BUSTE PENCHE',
          'SOULEVE DE TERRE ROUMAIN HALTERES','DEVELOPPE MILITAIRE HALTERES','GAINAGE PLANCHE'],
    haut:['POMPES','ROWING HALTERE BUSTE PENCHE','DEVELOPPE EPAULES HALTERES',
          'OISEAUX BUSTE PENCHE','CURL MARTEAU']
  }
};
// Les mots qui nomment un agres qu'on n'a pas chez soi. Ils ne servent PAS a
// filtrer — voir ci-dessus — mais a verifier que la liste ecrite a la main
// n'en contient aucun. Un garde sur des donnees figees, pas une heuristique.
const PS_MOTS_SALLE=['machine','poulie','smith','presse','hacksquat','guidee','pupitre',
  'landmine','belt','rameur','velo','tapis','skierg','pendulum','convergente','tirage',
  'butterfly','crossover','pulldown','graviton','station'];

// Ce qui se tient au lieu de se compter. La duree est ecrite dans `reps`, comme
// partout ailleurs dans ce produit — le champ est un TEXTE libre, et « 30 sec »
// y est aussi valide que « 8-12 ».
const PS_ISOMETRIQUES={
  'GAINAGE PLANCHE':{series:3,reps:'30 sec',repos:'1 min'},
  'GAINAGE LATERAL':{series:3,reps:'30 sec par côté',repos:'1 min'},
  'GAINAGE HOLLOW HOLD':{series:3,reps:'30 sec',repos:'1 min'},
  'GAINAGE CHAISE':{series:3,reps:'45 sec',repos:'1 min'}
};
// PURE. La seance de depart, au FORMAT EXISTANT de sessions_config.
//
// ⚠ AUCUN CHAMP INVENTE : day, name, active, photo, photo2, warmup, notes,
// exercises[{name,series,reps,repos,description,note,image,videoUrl}], plus
// `_essai`. C'est exactement ce que produit initSessionsConfig, et le moteur de
// seance la traite comme n'importe quelle autre.
function genererSeanceDepart(rep,jourIdx){
  const o=PS_OBJECTIFS.find(x=>x.cle===rep.objectif)||PS_OBJECTIFS[1];
  const lieu=(rep.lieu==='maison')?'maison':'salle';
  const freq=PS_FREQUENCES.includes(Number(rep.freq))?Number(rep.freq):3;
  const decoupe=(freq>=4)?'haut':'full';
  const noms=PS_SEANCES[lieu][decoupe];
  const j=(typeof jourIdx==='number'&&jourIdx>=0&&jourIdx<7)?jourIdx:0;
  return {
    day:DAYS[j],
    name:decoupe==='haut'?'Première séance · haut du corps':'Première séance · full body',
    active:true, photo:null, photo2:null,
    warmup:lieu==='maison'
      ? '5 min : montées de genoux, rotations d’épaules, 10 squats à vide.'
      : '8 min : vélo ou rameur 5 min, rotations d’épaules, 10 squats à vide.',
    // LA MENTION EST DANS LA SEANCE ELLE-MEME, et pas seulement sur l'ecran qui
    // la presente : elle suit la seance dans le selecteur, dans l'apercu et
    // dans le gestionnaire de seances, partout ou le coach ne l'a pas encore
    // remplacee.
    notes:'Séance de départ générée par RepCore, à partir de tes réponses. '
      +'Elle est PROVISOIRE : un programme publié par ton coach ou acheté la remplacera.',
    _essai:true,
    exercises:noms.map(n=>{
      const v=videosPour(n);
      // ⚠ UN GAINAGE NE SE COMPTE PAS EN REPETITIONS. « GAINAGE PLANCHE,
      // 5 series de 5, repos 3 min » est une consigne absurde : on tient une
      // planche en SECONDES, et trois minutes de repos entre deux planches
      // n'ont aucun sens. Les isometriques gardent donc leur propre
      // prescription, quelle que soit la reponse a la question « objectif ».
      const iso=PS_ISOMETRIQUES[n];
      return {name:n,
        series:iso?iso.series:o.series,
        reps:iso?iso.reps:o.reps,
        repos:iso?iso.repos:o.repos,
        description:'',note:'',image:null,
        videoUrl:v.length?v[0].url:'',videoUrl2:''};
    })
  };
}
// PURE. La seance posee devant l'athlete, et UN bouton.
//
// ⚠ LA MENTION EST EN TETE, PAS EN BAS DE PAGE. Elle doit etre lue avant la
// liste, pas apres : quelqu'un qui a deja parcouru six exercices a deja cru
// que c'etait son programme. Orange et encadree, comme le bandeau d'essai que
// cet athlete reverra dans son selecteur de seances — meme couleur pour la
// meme chose.
function _htmlSeanceDepart(s){
  if(!s||!s.exercises||!s.exercises.length)
    return '<div class="sub" style="font-size:var(--fs-sm);line-height:1.6">La séance n’a pas pu être préparée.</div>';
  const o=PS_OBJECTIFS.find(x=>x.cle===_psRep.objectif);
  return '<div style="background:linear-gradient(135deg,#2a1a00,#160e00);border:1.5px solid var(--orange);'
    +'border-radius:var(--r-3);padding:14px;margin-bottom:16px">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
    +'<span style="font-size:var(--fs-lg)">'+icon('clock',16)+'</span>'
    +'<div style="font-weight:900;font-size:var(--fs-sm);color:var(--orange);text-transform:uppercase;'
    +'letter-spacing:1px">Séance provisoire</div></div>'
    +'<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6">'
    +'Elle est générée à partir de tes trois réponses, pas écrite pour toi. '
    +'<strong style="color:var(--text-strong)">'
    +((typeof currentUser==='object'&&currentUser&&(currentUser.coachId||currentUser.coachEmailKey))
      ?'Ton coach la remplacera par ton programme.'
      :'Un programme complet, de la boutique ou d’un coach, la remplacera par ton programme.')
    +'</strong> En attendant, elle te permet de commencer aujourd’hui.</div></div>'
    +'<h1 style="font-size:var(--fs-xl);line-height:1.25;font-weight:400;letter-spacing:.5px;'
    +'margin-bottom:4px">'+escapeHtml(s.name)+'</h1>'
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:16px">'
    +s.exercises.length+' exercices'+(o?' · '+escapeHtml(o.lib.toLowerCase()):'')
    +' · '+(_psRep.lieu==='maison'?'à la maison':'en salle')+'</p>'
    +renderDataList(s.exercises,e=>{
      const img=illustrationExo(e);
      return (img
        ? '<img src="'+escapeHtml(img)+'" alt="" loading="lazy" width="52" height="40" '
          +'onerror="_illusAbsente(this)" style="width:52px;height:40px;object-fit:cover;'
          +'border-radius:var(--r-2);background:#f4f4f4;flex-shrink:0">'
        : '<div style="width:52px;height:40px;border-radius:var(--r-2);background:var(--surface-2);'
          +'border:1px solid var(--border);flex-shrink:0"></div>')
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:var(--fs-sm);font-weight:800;line-height:1.3">'+escapeHtml(e.name)+'</div>'
      +'<div class="sub" style="font-size:var(--fs-2xs);margin-top:2px">'
      +e.series+' × '+escapeHtml(String(e.reps))+' · repos '+escapeHtml(String(e.repos))+'</div>'
      +'</div>';
    },{pad:'9px 0',gap:11})
    +'<div style="margin-top:24px">'
    +'<button class="btn btn-red" onclick="psLancer()" style="margin:0;min-height:52px;letter-spacing:1.5px">'
    +'Démarrer ma première séance</button>'
    // LE LIEN SECONDAIRE (05/10/2026) : un lien, pas un second bouton — le
    // geste attendu reste « Démarrer ».
    +'<a href="#" onclick="ouvrirBoutique();return false" style="display:block;text-align:center;margin-top:14px;'
    +'font-size:var(--fs-sm);color:var(--sub);text-decoration:underline">Voir le programme complet Fondations</a></div>'
    +'<div style="height:20px"></div>';
}
// Les deux accueils de nouvel inscrit, dans l'ordre ou ils se posent. Rend
// true quand l'un des deux a pris la main — l'appelant s'arrete alors la.
//
// L'ORDRE N'EST PAS ARBITRAIRE : la question des jours se repond en UNE touche
// et prepare les rappels ; la premiere marche en demande trois et se termine
// par une seance. Les enchainer dans l'autre sens ferait commencer par le plus
// long quelqu'un qui vient a peine d'ouvrir l'application.
//
// Chacun se garde lui-meme, et les deux temoins sont independants : passer le
// premier ne saute pas le second.
function _aiguillerNouvelInscrit(){
  // ⚠ L'IDENTITE EN PREMIER, et seulement pour quelqu'un DE RATTACHE. Prenom
  // et nom ne servent a personne tant qu'on est seul dans l'application ; ils
  // servent des qu'un coach doit reconnaitre un visage sur son tableau de
  // bord. C'est ce moment-la, et pas l'inscription.
  //
  // ICI, ET NON DANS _appliquerPayloadCode : il existe plusieurs chemins de
  // rattachement — code d'acces, lien d'invitation, paquet d'athlete, reprise
  // d'un dossier distant — et un garde pose sur l'un d'eux seulement en
  // laisserait passer trois. routeUser est le seul endroit qui decide OU un
  // athlete atterrit, et c'est la lecon d'un lot precedent.
  try{
    const u=currentUser;
    if(u&&u.role!=='coach'&&(u.coachId||u.coachEmailKey)&&!identiteComplete(u)){
      demanderIdentite('coach'); return true;
    }
  }catch(e){}
  try{
    if(_doitProposerJours(currentUser,Date.now(),_jenVu(currentUser))){
      _ouvrirJoursEntrainement(); return true;
    }
  }catch(e){}
  try{
    if(_doitProposerPremiereSeance(currentUser,_psVu(currentUser))){
      ouvrirPremiereSeance(); return true;
    }
  }catch(e){}
  return false;
}
// ══════════ LE SEUL MOMENT OU L'ON PEUT ENCORE PARLER ══════════════════
//
// RepCore tourne sur le plan Spark : aucune fonction serveur, donc aucune
// relance automatique. Le seul instant ou l'application peut encore s'adresser
// a un inscrit qui n'a jamais commence est celui ou il la ROUVRE — et cet
// instant tombait sur un tableau de bord vide : trois chiffres a zero et deux
// boutons dont un qui ouvre un gestionnaire.
//
// ⚠ LE TON EST LA MOITIE DU LOT, ET IL N'EST PAS NEGOCIABLE.
//   • AUCUN DECOMPTE DE JOURS. « Ca fait 6 jours que… » n'informe de rien —
//     il le sait — et transforme l'ouverture de l'app en convocation. Le
//     delai de 48 h sert a DECIDER d'afficher le bloc ; il n'est jamais dit.
//   • AUCUN REPROCHE, AUCUN POINT D'EXCLAMATION. Ni « Allez ! », ni « Il est
//     temps de s'y mettre » : ce qui se lit comme un rappel a l'ordre se
//     repond par une desinstallation.
//   • UNE PROPOSITION, AU PRESENT. Le bloc ne parle pas de ce qui n'a pas eu
//     lieu ; il parle de la seule chose qui puisse avoir lieu maintenant.
//
// ⚠ ET IL NE PASSE JAMAIS DEVANT LA SANTE. L'echeance d'acces, les signes a
// faire examiner et la douleur declaree vivent AU-DESSUS de lui dans le
// gabarit, et il ne touche ni a leur affichage ni a leur ordre. Il ne remplace
// que ce qui est vide de sens pour quelqu'un qui n'a jamais commence : les
// trois chiffres a zero et la carte d'entrainement a deux boutons.
const REPRISE_DELAI=48*3600e3;
// PURE. Faut-il poser le bloc ?
//   • un athlete ;
//   • un compte de plus de 48 h — en dessous, l'inscription est du jour meme
//     et l'accueil ordinaire suffit ;
//   • AUCUNE SEANCE. C'est la seule condition de sortie : le bloc disparait de
//     lui-meme a la premiere seance enregistree, sans temoin ni drapeau.
function _doitProposerReprise(u,maintenant){
  if(!u||u.role==='coach') return false;
  if((u.sessions||[]).length) return false;
  const c=Number(u&&u.createdAt)||0;
  const t=Number(maintenant)||0;
  if(!c||!t) return false;
  return (t-c)>REPRISE_DELAI;
}
// PURE. Le bloc. Une phrase, une duree, un bouton — rien d'autre.
//
// `avecProgramme` decide le libelle de ce qui suit, pas le texte d'accueil :
// que le coach ait publie ou non, la proposition est la meme, et l'athlete n'a
// pas a apprendre ici l'etat du travail de son coach.
function _htmlReprise(avecProgramme){
  return '<div class="clh-in clh-in-2" style="background:linear-gradient(160deg,#1a0303,var(--red-bg) 55%,var(--red-bg));'
    +'border:1px solid #3a0000;border-left:1px solid var(--border);border-radius:var(--r-3);'
    +'padding:24px 20px;margin-bottom:16px;box-shadow:0 14px 34px rgba(0,0,0,.6),'
    +'0 0 30px rgba(224,32,32,.22),inset 0 1px 0 rgba(255,255,255,.05)">'
    +'<div class="eyebrow eyebrow-act" style="margin-bottom:12px">Ta première séance</div>'
    +'<div style="font-size:var(--fs-lg);font-family:var(--pile-titre);letter-spacing:.5px;'
    +'line-height:1.25;margin-bottom:8px">On commence maintenant.</div>'
    +'<div class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:20px">'
    +'Quinze minutes suffisent pour commencer'+' '+': tu t’arrêtes quand tu veux.</div>'
    +'<button class="btn btn-red" onclick="reprendreMaintenant()" style="margin:0;min-height:52px;'
    +'letter-spacing:1.5px;font-size:var(--fs-md);box-shadow:var(--e-inset),var(--glow-red)">'
    +'Démarrer maintenant</button>'
    +(avecProgramme
      // 11 px au moins : le plancher de l'accueil (--fs-2xs vaut 10 px).
      ? '<div class="sub" style="font-size:var(--fs-xs);line-height:1.5;margin-top:12px;text-align:center">'
        +'Ton programme t’attend.</div>'
      : '')
    +'</div>';
}
// UN SEUL BOUTON, DEUX DESTINATIONS. Le coach a publie : on ouvre le selecteur
// de seances, comme partout ailleurs. Il n'a rien publie : on ouvre le parcours
// de premiere seance, qui pose trois questions et rend une seance a lancer.
// Dans les deux cas, on emprunte un chemin qui existe deja.
// SANS PROGRAMME, ON OUVRE « GÉRER MES SÉANCES » (28/09/2026) : la semaine est
// vierge et c'est a l'athlete de la remplir, plus aucune seance generee.
function reprendreMaintenant(){
  try{
    if(_configReelle(currentUser&&currentUser.sessions_config)){ openSessionPicker(); return; }
  }catch(e){}
  try{ loadSessionManager(); }
  catch(e){ try{ openSessionPicker(); }catch(_e){} }
}
// Le tour impur : poser le bloc, et faire taire ce qu'il remplace.
//
// ⚠ IL REND L'AFFICHAGE DES DEUX BLOCS A CHAQUE PASSAGE, dans les deux sens.
// Les eteindre sans jamais les rallumer laisserait un accueil ampute apres la
// premiere seance — loadClientHome est rappelee a chaque retour, et c'est elle
// qui doit rendre l'ecran a son etat normal.
function _rendreReprise(){
  const z=document.getElementById('clh-reprise');
  if(!z) return;
  let actif=false;
  try{ actif=_doitProposerReprise(currentUser,Date.now()); }catch(e){}
  if(actif){
    let prog=false;
    try{ prog=_configReelle(currentUser&&currentUser.sessions_config); }catch(e){}
    z.innerHTML=_htmlReprise(prog);
  } else z.innerHTML='';
  // ⚠ `style.display=''` NE REMET PAS PAR DEFAUT : elle SUPPRIME la
  // declaration en ligne. Ces deux blocs n'en portent donc AUCUNE — leur mise
  // en page vit dans la feuille — et vider la propriete les rend exactement
  // comme le CSS le prevoit.
  //
  // #clh-stats a porte `display:flex` en ligne, et ce masquage l'effacait :
  // les trois cases tombaient en colonne pour tout le monde. Signale par
  // Kevin le 15/09/2026. Le remede n'est pas de retenir la valeur ici — elle
  // dependrait de l'etat au premier appel — mais de ne pas mettre de mise en
  // page en ligne sur un element qu'on masque.
  for(const id of ['clh-stats','clh-hero']){
    const e=document.getElementById(id);
    if(e) e.style.display=actif?'none':'';
  }
}
// ══ R36 — POUR DÉMARRER ════════════════════════════════════════════════
//
// Trois actes, et AUCUN DRAPEAU : chacun se lit dans les donnees qu'il laisse.
//   • le questionnaire : un bilan de type 'depart' ;
//   • la seance : une seance enregistree dans u.sessions ;
//   • le repas : un aliment note au journal (nutrition.log), ou une reponse
//     du jour en diete stricte (nutrition.days). Les deux sources sont lues
//     quel que soit le type de diete actuel : un repas note avant de passer en
//     stricte a bien ete note.
//
// ⚠ QUAND LE BLOC PARAIT. Il est pour qui commence : un athlete a qui il
// manque au moins un des trois actes, dans les PD_JOURS qui suivent la
// creation de son compte (createdAt, pose a l'inscription). Sans cette borne,
// un athlete inscrit depuis des mois qui ne note jamais ses repas garderait
// « Pour démarrer » en tete d'accueil pour toujours, et avec lui une carte et
// des bannieres du coach masquees. Aucun champ n'est cree : createdAt existe.
// Il disparait des que les trois sont faits.
const PD_JOURS=30;
function _pdRepasNote(u){
  const nut=(u&&u.nutrition)||{};
  const log=nut.log||{}, jours=nut.days||{};
  for(const k of Object.keys(log)){
    const v=log[k];
    if(v&&Array.isArray(v.entries)&&v.entries.length) return true;
  }
  for(const k of Object.keys(jours)){
    const v=jours[k];
    if(v&&(v.respected===true||v.respected===false)) return true;
  }
  return false;
}
// PURE. L'etat des trois lignes.
function etapesDemarrage(u){
  const bilans=((u&&u.bilans)||[]).filter(Boolean);
  return {
    questionnaire:bilans.some(b=>b.type==='depart'),
    seance:((u&&u.sessions)||[]).length>0,
    repas:_pdRepasNote(u)
  };
}
// PURE. Faut-il afficher le bloc ?
function _doitAfficherDemarrage(u,maintenant){
  if(!u||!u.email||u.role==='coach') return false;
  const e=etapesDemarrage(u);
  if(e.questionnaire&&e.seance&&e.repas) return false;
  const c=Number(u.createdAt)||0, t=Number(maintenant)||0;
  if(!c||!t) return false;
  return (t-c)<=PD_JOURS*864e5;
}
// PURE. Ce qu'ouvre « Lance ta première séance », et ce qu'on en dit.
// ⚠ PAS openSessionPicker SEUL : un compte neuf n'a que sept creneaux eteints
// (initSessionsConfig ne pose plus de programme), et le selecteur n'y affiche
// qu'un message d'erreur. Sans seance a lancer, la ligne mene au parcours de
// premiere seance, qui pose trois questions et rend une seance — le meme
// aiguillage que la carte de reprise (reprendreMaintenant).
function _pdSeance(u){
  const sc=(u&&u.sessions_config)||[];
  let reel=false; try{ reel=_configReelle(sc); }catch(e){ reel=false; }
  if(reel) return {voie:'selecteur',sous:'Ton programme t’attend'};
  if(sc.some(s=>s&&s.active&&s.exercises&&s.exercises.length))
    return {voie:'selecteur',sous:'Ton programme d’essai t’attend'};
  // SANS COACH ET JAMAIS ENTRAÎNÉ (05/10/2026) : trois questions, et la séance
  // est prête — le parcours de première séance (PS_PARCOURS_ACTIF).
  if(PS_PARCOURS_ACTIF&&u&&!u.coachId&&!u.coachEmailKey&&!((u.sessions||[]).length))
    return {voie:'parcours',sous:'3 questions, ta séance est prête'};
  // SEMAINE VIERGE : l'athlete cree sa seance lui-meme (28/09/2026).
  return {voie:'gerer',sous:'Crée ta séance, exercice par exercice'};
}
function pdLancerSeance(){
  let v='gerer';
  try{ v=_pdSeance(currentUser).voie; }catch(e){}
  if(v==='selecteur') openSessionPicker();
  else if(v==='parcours') ouvrirPremiereSeance();
  else loadSessionManager();
}
// PURE. La troisieme ligne suit la diete. En stricte ouverte, il n'y a pas de
// journal : l'acte est de dire si le plan du jour a ete suivi. Une stricte
// verrouillee montre son verrou et le passage en flexible : la ligne parle
// alors de repas, comme en flexible.
function _pdRepas(u){
  let stricte=false;
  try{ stricte=typeDiete((u&&u.nutrition)||{})==='strict'&&accesDieteStricte(u).ok; }catch(e){ stricte=false; }
  return stricte
    ?{titre:'Note ta première journée',sous:'Dis chaque jour si tu as suivi ton plan'}
    :{titre:'Note ton premier repas',sous:'Pour voir tes macros se remplir'};
}
// PURE. « Julie sera prévenue… » : seulement pour un filleul qui n'a pas encore
// fait de séance. La promesse est tenue par le serveur léger (événement
// filleul_seance, déposé à la fin de la première séance).
function phraseParrainPremiereSeance(u){
  const p=u&&u.parrainage;
  const nom=p&&p.parrainCode&&String(p.parrainPrenom||'').trim();
  if(!nom||(u.sessions||[]).length) return '';
  return nom+' sera prévenu quand tu feras ta première séance.';
}
// LA LIGNE FACULTATIVE « Connecte ta montre » (05/10/2026). Hors du compte
// « x sur 3 » (etapesDemarrage reste à trois actes) : on démarre sans montre.
// Visible seulement si rien n'est encore synchronisé ET que cette plateforme
// a un chemin (cheminMontre) — jamais une ligne qui mène à une impasse.
// `plateforme` est injectable pour la suite ; par défaut, celle de l'appareil.
function _htmlLigneMontre(plateforme){
  let actif=false; try{ actif=sanSyncActif(); }catch(e){ actif=false; }
  if(actif) return '';
  let p=plateforme; if(p===undefined){ try{ p=_ssPlateforme(); }catch(e){ p='autre'; } }
  const c=cheminMontre(p);
  if(!c) return '';
  const action=c==='android'?'window.open(AIDE_APK_URL,\'_blank\',\'noopener\')':'sanSyncOuvrir()';
  return '<button type="button" class="pd-ligne pd-option" onclick="'+action+'">'
    +'<span class="pd-case" aria-hidden="true"></span>'
    +'<span class="pd-txt"><span class="pd-titre">Connecte ta montre (1 min)</span>'
    +'<span class="pd-sous">Facultatif · '+(c==='android'?'installe l’application Android, ':'')
    +'tes pas et ton sommeil arrivent tout seuls</span></span>'
    +'<span class="pd-go" aria-hidden="true">›</span></button>';
}
// PURE. Le bloc.
function _htmlDemarrage(u){
  const e=etapesDemarrage(u);
  const s=_pdSeance(u), r=_pdRepas(u);
  const lignes=[
    {fait:e.questionnaire,titre:'Complète ton questionnaire',action:'openBilan(\'depart\')',
     sous:'~12 min · c’est ce qui permet '+((u&&u.coachId)?'à ton coach d’adapter tes charges':'de calculer tes besoins')},
    {fait:e.seance,titre:'Lance ta première séance',action:'pdLancerSeance()',sous:s.sous},
    {fait:e.repas,titre:r.titre,action:'loadNutrition()',sous:r.sous}];
  const faites=lignes.filter(l=>l.fait).length;
  return '<div class="pd-carte clh-in clh-in-2">'
    +'<div class="pd-tete"><span class="eyebrow eyebrow-act">Pour démarrer</span>'
    +'<span class="pd-compte">'+faites+' sur 3</span></div>'
    +lignes.map((l,i)=>{
      const corps='<span class="pd-case" aria-hidden="true">'+(l.fait?icon('coche',14):'')+'</span>'
        +'<span class="pd-txt"><span class="pd-titre">'+(i+1)+' · '+escapeHtml(l.titre)+'</span>'
        +'<span class="pd-sous">'+escapeHtml(l.sous)+'</span></span>';
      return l.fait
        ?'<div class="pd-ligne pd-fait">'+corps+'<span class="pd-etat">Fait</span></div>'
        :'<button type="button" class="pd-ligne" onclick="'+l.action+'">'+corps
          +'<span class="pd-go" aria-hidden="true">›</span></button>';
    }).join('')
    +_htmlLigneMontre()
    +(phraseParrainPremiereSeance(u)?'<div class="pd-parrain" style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-top:10px">'
      +escapeHtml(phraseParrainPremiereSeance(u))+'</div>':'')
    +'</div>';
}
// Le tour impur : poser le bloc, et marquer l'ecran pour que la feuille taise
// ce qui peut attendre. Rendu a chaque passage, dans les deux sens.
function _rendreDemarrage(){
  let actif=false;
  try{ actif=_doitAfficherDemarrage(currentUser,Date.now()); }catch(e){ actif=false; }
  const z=document.getElementById('clh-demarrer');
  if(z) z.innerHTML=actif?_htmlDemarrage(currentUser):'';
  const ecran=document.getElementById('s-client-home');
  if(ecran) ecran.toggleAttribute('data-demarrage',actif);
  try{ _placerHeroDemarrage(actif&&!etapesDemarrage(currentUser).seance); }catch(e){}
  return actif;
}
// LA CARTE ENTRAINEMENT RESTE, JUSTE SOUS « POUR DEMARRER » (Kevin, 28/09/2026).
// Pour un compte sans seance, _rendreReprise la masquait (deux boutons vides de
// sens pour qui n'a jamais commence), et pendant « Pour démarrer » la carte de
// reprise est elle-meme masquee : l'athlete n'avait plus AUCUN chemin vers
// « Gérer mes séances ». Une athlete n'a pas pu noter ses seances et a
// abandonne. Ici, et seulement ici (bloc affiche ET aucune seance), la carte
// reste visible et remonte sous le bloc ; la ligne « Ton suivi se termine »
// (#clh-essai) vient ensuite. Hors de ce cas, elle reprend sa place normale,
// sous les trois chiffres, et son affichage reste celui de _rendreReprise.
function _placerHeroDemarrage(monter){
  const hero=document.getElementById('clh-hero');
  const bloc=document.getElementById('clh-demarrer');
  // Sa place normale : sous les trois cases ET sous « Défie un pote » (1654).
  const stats=document.getElementById('clh-duels')||document.getElementById('clh-stats');
  if(!hero||!bloc||!stats) return false;
  if(monter){
    if(bloc.nextElementSibling!==hero) bloc.parentNode.insertBefore(hero,bloc.nextSibling);
    hero.style.display='';
    return true;
  }
  if(stats.nextElementSibling!==hero) stats.parentNode.insertBefore(hero,stats.nextSibling);
  return false;
}
// PURE. Faut-il proposer la premiere marche a ce dossier ?
//
// LES TROIS GARDES, ET AUCUNE DE PLUS :
//   • un athlete ;
//   • AUCUN PROGRAMME REEL — _configReelle est le predicat deja en place, et
//     c'est lui qui distingue un programme publie par le coach d'un repli
//     generique. Le reecrire aurait fait diverger deux definitions du meme
//     mot ;
//   • AUCUN HISTORIQUE. Quelqu'un qui s'est deja entraine a trouve sa
//     premiere marche tout seul : la lui proposer serait insultant.
// Et le parcours ne se represente pas une fois traverse ou passe.
// ⚠ RETIRE LE 28/09/2026 (Kevin) : « on laisse les pages de séance vierges ».
//   Le parcours generait une seance toute faite ; les programmes se trouvent
//   desormais en boutique ou au coaching, et l'athlete construit les siennes
//   au fur et a mesure dans « Gérer mes séances ». La fonction reste (routeUser
//   l'interroge toujours) mais ne propose plus rien.
// ⚠ RÉACTIVÉ LE 05/10/2026, POUR L'ATHLÈTE SANS COACH SEULEMENT : un autonome
//   en essai qui touchait « Lance ta première séance » tombait sur sept
//   créneaux éteints et devait tout construire avant sa première série. Le
//   coaché, lui, attend le programme de son coach : il ne voit pas le parcours.
const PS_PARCOURS_ACTIF=true;
function _doitProposerPremiereSeance(u,dejaVu){
  if(!PS_PARCOURS_ACTIF) return false;
  if(!u||!u.email||u.role==='coach') return false;
  if(u.coachId||u.coachEmailKey) return false;
  if(dejaVu) return false;
  if((u.sessions||[]).length) return false;
  return !_configReelle(u.sessions_config);
}
// ⚠ LE TEMOIN EST LOCAL, comme celui de l'ecran des jours et pour la meme
// raison : « Passer » ne doit rien ecrire dans le dossier, et un ecran qui ne
// retient pas qu'il a ete montre revient a chaque ouverture.
const PS_CLE='rc_premiere_seance_';
function _psVu(u){
  try{ return !!localStorage.getItem(PS_CLE+((u&&u.email)||'')); }catch(e){ return true; }
}
function _psMarquer(u){
  try{ localStorage.setItem(PS_CLE+((u&&u.email)||''),String(Date.now())); }catch(e){}
}
// ── Le parcours ─────────────────────────────────────────────────────────
// `_psRep` porte les trois reponses ; `_psEtape` va de 0 a 3 — les trois
// questions, puis la seance.
let _psRep={objectif:'',freq:0,lieu:''}, _psEtape=0, _psSeance=null, _psIdx=0;
function ouvrirPremiereSeance(){
  _psRep={objectif:'',freq:0,lieu:''}; _psEtape=0; _psSeance=null;
  _psRendre();
  go('s-premiere-seance');
}
// UN SEUL ECRAN, quatre contenus. Ne pas traverser go() entre les questions :
// chaque passage relance une animation d'ecran, et trois animations pour trois
// touches donnent l'impression d'un formulaire long.
function _psRendre(){
  const z=document.getElementById('ps-corps');
  const p=document.getElementById('ps-pas');
  if(!z) return;
  if(p) p.textContent=_psEtape<3?('Question '+(_psEtape+1)+' sur 3'):'Ta séance';
  const titre=x=>'<h1 style="font-size:var(--fs-2xl);line-height:1.2;font-weight:400;'
    +'letter-spacing:.5px;margin-bottom:6px">'+x+'</h1>';
  const sousT=x=>'<p class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:20px">'+x+'</p>';
  // Une pastille pleine largeur par reponse : un libelle, une explication, et
  // la touche suivante fait avancer. Aucun bouton « suivant » : il ajouterait
  // une touche par question, soit trois de plus sur un parcours qui en promet
  // trois en tout.
  const choix=(lib,sous,onclick)=>
    '<button type="button" onclick="'+onclick+'" class="ps-choix">'
    +'<span style="font-size:var(--fs-md);font-weight:800;color:var(--text);display:block">'+lib+'</span>'
    +(sous?'<span class="sub" style="font-size:var(--fs-xs);display:block;margin-top:4px">'+sous+'</span>':'')
    +'</button>';
  if(_psEtape===0){
    z.innerHTML=titre('Ton objectif ?')+sousT('Il decide des séries et des répétitions.')
      +PS_OBJECTIFS.map(o=>choix(escapeHtml(o.lib),escapeHtml(o.sous),
          'psRepondre(\'objectif\',\''+o.cle+'\')')).join('');
    return;
  }
  if(_psEtape===1){
    z.innerHTML=titre('Combien de séances par semaine ?')
      +sousT('Deux ou trois : on travaille tout le corps à chaque fois. Quatre : on sépare le haut et le bas.')
      +PS_FREQUENCES.map(f=>choix(f+' séances',
          f>=4?'Haut / bas':'Full body','psRepondre(\'freq\','+f+')')).join('');
    return;
  }
  if(_psEtape===2){
    z.innerHTML=titre('Où t’entraînes-tu ?')
      +sousT('On ne te proposera que du matériel que tu as.')
      +PS_LIEUX.map(l=>choix(escapeHtml(l.lib),escapeHtml(l.sous),
          'psRepondre(\'lieu\',\''+l.cle+'\')')).join('');
    return;
  }
  z.innerHTML=_htmlSeanceDepart(_psSeance);
}
// Chaque reponse avance d'une etape. A la troisieme, la seance est generee et
// ECRITE dans sessions_config : c'est ce qui permet au moteur de seance de la
// lancer sans rien savoir de ce parcours.
function psRepondre(champ,valeur){
  _psRep[champ]=valeur;
  _psEtape++;
  if(_psEtape===3){
    try{ _psPoserSeance(); }
    catch(e){ toast('La séance n’a pas pu être préparée.','var(--orange)'); psPasser(); return; }
  }
  _psRendre();
}
// ⚠ ON N'INVENTE PAS DE STRUCTURE : on ecrit dans sessions_config, au format
// existant, sur le creneau du jour. Le reste de l'app la traite ensuite comme
// n'importe quelle autre seance — selecteur, apercu, moteur, historique.
function _psPoserSeance(){
  const cfg=currentUser.sessions_config||initSessionsConfig();
  // LE CRENEAU D'AUJOURD'HUI : la seance se lance maintenant, elle porte donc
  // le jour ou on la fait. DAYS commence au lundi, getDay au dimanche.
  _psIdx=(new Date().getDay()+6)%7;
  _psSeance=genererSeanceDepart(_psRep,_psIdx);
  cfg[_psIdx]=_psSeance;
  currentUser.sessions_config=cfg;
  // ECRIT, et c'est necessaire : startWorkoutSession relit sessions_config
  // depuis currentUser, et la reprise apres fermeture de l'app aussi.
  // La seance porte `_essai` : _configReelle rend donc toujours false, et la
  // publication du coach l'ecrasera sans ceremonie.
  saveUser();
  _psMarquer(currentUser);
}
// LE BOUTON UNIQUE. Il entre dans le flux existant par startWorkoutSession,
// exactement comme le selecteur de seances : aucune branche nouvelle dans le
// moteur, aucun format particulier a reconnaitre.
function psLancer(){
  try{ _psMarquer(currentUser); }catch(e){}
  // L'écran final du parcours EST l'aperçu de la séance : on ne le remontre pas.
  startWorkoutSession(_psIdx,{sansApercu:true});
}
// ⚠ « PASSER » N'ECRIT RIEN DANS LE DOSSIER. Ni seance, ni reponse : seul le
// temoin local retient que le parcours a ete montre.
function psPasser(){
  _psMarquer(currentUser);
  go('s-client-home');
  loadClientHome();
}
// Repli générique servi tant que le coach n'a rien publié.
// Chaque séance produite ici porte _essai : sans ce marqueur, le repli était
// indiscernable d'un programme réellement publié, et l'écran « Programme en
// cours de création » ne pouvait plus jamais réapparaître une fois la config
// écrite en base.
// N'ÉCRIT PLUS RIEN : le simple fait d'ouvrir le sélecteur de séances
// persistait la config, la poussait au cloud, et faisait disparaître l'athlète
// de la liste « Sans programme » du coach. La persistance appartient désormais
// aux seuls chemins de personnalisation, qui appellent saveUser() eux-mêmes.
function initSessionsConfig(){
  // MÊME LECTURE QUE openCoachSessions. _evol_gender n'existe qu'à partir du
  // premier bilan : lu seul, il valait undefined pour une athlète qui n'en a
  // pas encore rempli, et elle recevait les exemples génériques plutôt que la
  // Fondation Femme. isFemale absorbe les conventions historiques du champ.
  // ⚠ PLUS DE FONDATION POSEE D'OFFICE, ET PLUS DE defEx NON PLUS. Le genre
  // ne decide plus du contenu : il ne decidait de toute facon que d'un
  // programme que l'athlete n'avait pas choisi. Sept creneaux eteints disent
  // la verite — il n'y a pas encore de programme — et c'est a partir de la
  // qu'on construit le sien.
  // La Fondation n'est pas perdue : elle reste un programme a part entiere,
  // et c'est la boutique qui la proposera.
  const cfg=_seancesViergesSemaine();
  cfg.forEach(s=>{s._essai=true;});
  currentUser.sessions_config=cfg;
  return cfg;
}
// Une séance est un EXEMPLE tant que personne ne l'a voulue.
// _essai marque celles que fabrique initSessionsConfig ; _foundation couvre en
// plus les configurations écrites avant l'existence de _essai, déjà présentes
// en base chez les utilisateurs actuels.
function seanceEstExemple(s){ return !!(s&&(s._essai||s._foundation)); }
// Au moins une des séances proposées à l'athlète est un exemple générique.
// Le prédicat suit EXACTEMENT les badges affichés séance par séance : le faire
// dépendre de la configuration entière donnerait un bandeau qui disparaît
// pendant que des séances portent encore la mention « exemple ».
function programmeEstEssai(u){
  const usr=u||currentUser;
  if(!usr) return false;
  if(usr.program?.length) return false;
  // PAS DE SORTIE SUR LA SEULE PRÉSENCE D'UN PDF. Elle éteignait le bandeau
  // « Séances d'essai » pendant que chaque séance du sélecteur portait son
  // badge « Exemple » : deux écrans, deux vérités, pour le même programme.
  // Le prédicat suit maintenant les badges dans TOUS les cas — c'est ce que
  // le commentaire au-dessus annonçait déjà.
  const sc=usr.sessions_config;
  if(!sc||!sc.length) return true;
  return sc.some(s=>s.active&&s.exercises?.length&&seanceEstExemple(s));
}
// L'athlète vient de toucher cette séance : ce n'est plus un exemple.
// Les DEUX marqueurs tombent, sinon une config Fondation personnalisée
// continuerait d'être annoncée comme un simple essai.
function _personnaliserSeance(i){
  const s=currentUser.sessions_config?.[i];
  if(!s) return;
  delete s._essai;delete s._foundation;
}
// Un programme RÉEL : au moins une séance active, garnie, et voulue par
// quelqu'un — ni repli générique, ni Fondation posée d'office.
// Le test porte sur la présence d'EXERCICES et non sur celle d'un nom : un
// coach peut parfaitement assigner un programme sans nommer ses séances, et
// son travail était alors considéré comme absent, donc écrasable.
function _configReelle(sc){
  return !!(sc&&sc.some(s=>s.active&&s.exercises?.length&&!seanceEstExemple(s)));
}
// Le programme du coach peut n'exister que dans le nœud stocké : depuis que
// initSessionsConfig ne persiste plus, currentUser porte parfois une config de
// repli fabriquée pour l'affichage pendant que le programme, arrivé par la
// synchro, n'est que dans rc_users. L'adopter est indispensable — sans ça le
// saveUser() qui suit écraserait le programme du coach par le repli.
function _adopterProgrammeStocke(){
  if(!currentUser?.email) return false;
  const stocke=(DB.get('users')||{})[currentUser.email]?.sessions_config;
  if(_configReelle(stocke)&&!_configReelle(currentUser.sessions_config)){
    currentUser.sessions_config=stocke;
    return true;
  }
  return false;
}
// Une publication par le coach n'est jamais un essai, même quand il assigne la
// Fondation telle quelle : c'est un choix, pas un repli.
function _marquerCommePublie(cfg){
  (cfg||[]).forEach(s=>{delete s._essai;delete s._foundation;});
  return cfg;
}
// Un seul texte pour les écrans qui montrent le repli — le sélecteur de
// séances, la vue programme de l'accueil et, depuis R36, « Mes séances ». Les
// faire diverger reviendrait à raconter deux histoires différentes sur le
// même état.
// R36 — LE TEXTE DÉPEND DU COACH. « Ton coach n'a pas encore publié ton
// programme » s'affichait aussi à qui n'a pas de coach : faux, et sans issue.
// Avec un coach, sa publication remplace l'essai (_marquerCommePublie) ; sans
// coach, toucher une séance la fait sienne (_personnaliserSeance).
function _bandeauEssai(u){
  const usr=u||currentUser;
  const suite=(usr&&usr.coachId)
    ?'Ton coach le remplacera par le tien.'
    :'Tu peux le modifier librement.';
  return `<div class="bandeau-essai" style="background:linear-gradient(135deg,#2a1a00,#160e00);border:1.5px solid var(--orange);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:var(--fs-lg)" aria-hidden="true">'+icon('clock',16)+'</span>
        <div style="font-weight:900;font-size:var(--fs-sm);color:var(--orange);text-transform:uppercase;letter-spacing:1px">Séances d'essai</div>
      </div>
      <div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6">Ce programme d'essai te permet de commencer tout de suite. ${suite}</div>
    </div>`;
}

function uploadSessionPhoto(idx,input){
  const f=input.files[0];if(!f) return;
  compressImage(f,1200,0.75,data=>{
    if(!currentUser.sessions_config) initSessionsConfig();
    currentUser.sessions_config[idx].photo=data;
    _personnaliserSeance(idx);
    const ok=saveUser();loadSessionManager();
    toastEcriture(ok,' Photo enregistrée !','la photo est');
  });
}
function uploadSessionPhoto2(idx,input){
  const f=input.files[0];if(!f) return;
  compressImage(f,1200,0.75,data=>{
    if(!currentUser.sessions_config) initSessionsConfig();
    currentUser.sessions_config[idx].photo2=data;
    _personnaliserSeance(idx);
    // rc_p2_ est la seule copie durable de photo2 : elle est retirée du nœud
    // avant chaque push RTDB. Son échec silencieux faisait disparaître la photo
    // au rechargement suivant, derrière un « ✓ » vert.
    const ancrageOk=_setPhotoLS('rc_p2_'+currentUser.email+'_'+idx,data);
    const ok=saveUser();loadSessionManager();
    toastEcriture(ok&&ancrageOk,' Photo vidéos enregistrée !','la photo est');
  });
}
function removeSessionPhoto2(i){
  if(!currentUser.sessions_config) return;
  currentUser.sessions_config[i].photo2=null;
  _personnaliserSeance(i);
  try{localStorage.removeItem('rc_p2_'+currentUser.email+'_'+i);}catch(e){}
  saveUser();loadSessionManager();
}
function parseVideoLinks(text){
  let t=text
    .replace(/•|·|‐|‑|–|—|−/g,'-')
    .replace(/\\/g,'/')
    .replace(/https?\s*:\s*\/\s*\//gi,'https://')
    .replace(/youtu\s*[.,]\s*be/gi,'youtu.be')
    .replace(/youtube\s*[.,]\s*com/gi,'youtube.com')
    .replace(/watch\s*\?\s*v\s*=/gi,'watch?v=')
    .replace(/(youtu\.be\/|watch\?v=)\s+/gi,(m,p)=>p);
  const urls=[];
  const p1=t.match(/https?:\/\/(?:www\.)?(?:youtu\.be\/[a-zA-Z0-9_\-]{5,}|youtube\.com\/(?:watch\?v=|shorts\/)[a-zA-Z0-9_\-]{5,})/gi)||[];
  urls.push(...p1);
  const p2=t.match(/(?<![a-zA-Z0-9\/])youtu\.be\/([a-zA-Z0-9_\-]{5,})/gi)||[];
  for(const m of p2){
    const id=m.split('/').pop();
    if(id&&!urls.some(u=>u.includes(id))) urls.push('https://youtu.be/'+id);
  }
  return[...new Set(urls)];
}

function openSessionExercises(idx){
  const cfg=currentUser.sessions_config||initSessionsConfig();
  if(!cfg[idx]) return;
  // TOUT LE MONTAGE EST SOUS FILET, comme dans les deux éditeurs du coach :
  // l'exception d'un seul maillon rendait le bouton muet.
  try{
  _assainirExercices(cfg[idx]);
  progEx=JSON.parse(JSON.stringify(cfg[idx].exercises));_photographierProgEx();
  // photo2 stripée de Firebase : restaurer depuis localStorage avant _prepProgEditor
  // (spécifique à la vue athlète — les autres appelants n'ont pas de photo2 en localStorage)
  const _lsP2=localStorage.getItem('rc_p2_'+(currentUser?.email||'')+'_'+idx);
  if(!cfg[idx].photo2&&_lsP2) cfg[idx].photo2=_lsP2;
  _prepProgEditor({
    name:cfg[idx].name,
    notes:cfg[idx].notes,
    warmup:cfg[idx].warmup??currentUser._defaultWarmup,
    cooldown:cfg[idx].cooldown??currentUser._defaultCooldown
    // `photo` et `photo2` ne sont plus passees : _prepProgEditor ne les monte
    // plus, et rien ne peut plus en charger. Elles restent DANS le dossier —
    // c est la vignette du selecteur de seance, et on ne l efface pas.
  });
  // Indicateur photo2 (spécifique à la vue athlète)
  const p2ph=document.getElementById('prog-photo2-ph');
  const p2ok=document.getElementById('prog-photo2-ready');
  if(p2ph&&p2ok){if(progPhoto2Data){p2ph.style.display='none';p2ok.style.display='block';}else{p2ph.style.display='flex';p2ok.style.display='none';}}
  _updateAnalyzeBtn();
  _progEditorCtx={mode:'athlete',sessionIdx:idx};
  const backBtn=document.querySelector('#s-coach-program .back-btn');
  if(backBtn) backBtn.onclick=async ()=>{if(_progExDirty&&!await rcConfirm('Modifications non enregistrées : quitter quand même ?',null,'Quitter'))return;_progEditorCtx={mode:'clientProgram'};go('s-session-manager');};
  const title=document.querySelector('#s-coach-program .topbar-title');
  if(title) title.textContent=(cfg[idx].name||'Séance')+' : Exercices';
  renderProgEx();
  go('s-coach-program');
  _progExDirty=false;
  }catch(e){ return _echecOuvertureEditeur(e); }
  // B1.6 — CE DEFILEMENT NE SE PRODUISAIT PAS.
  //
  // Il calculait la position du premier exercice puis la posait sur
  // '#s-coach-program .scroll-area'. Or ce conteneur ne deborde JAMAIS — le
  // fichier le documente lui-meme dans go() : « c'est le DOCUMENT qui
  // defile », .scroll-area est en min-height sans overflow et son scrollTop
  // vaut toujours 0. Le calcul etait juste, la cible ne l'etait pas, et le
  // coach qui ouvrait une seance n'arrivait pas sur son premier exercice.
  //
  // _defiler EST LE GESTE QUI MARCHE, et il est deja utilise a deux pas d'ici
  // par _viserExercice. Il respecte prefers-reduced-motion — meme resultat,
  // sans animation — la ou un scrollTop pose a la main l'ignorait.
  setTimeout(()=>{
    try{
      const puce=document.querySelector('#s-coach-program .exo-chip');
      const cible=puce&&puce.closest('div');
      if(cible) _defiler(cible);
    }catch(e){}
  },80);
}

// Le rang de la rangee dans la cascade d'entree. Une variable de module et non
// l'indice du jour : les jours de repos ne produisent pas de ligne, et compter
// les jours laisserait des trous dans la cadence.
let _spRang=0;
function openSessionPicker(){
  // LOT C1 : ouvrir son programme, c'est l'étape « lis-le » de l'accueil.
  try{ accueilProgrammeLu(); }catch(e){}
  const cfg=currentUser.sessions_config||initSessionsConfig();
  const active=cfg.filter(s=>s.active);
  if(!active.length){toast('Aucune séance configurée. Va dans "Gérer mes séances".','var(--orange)');return;}
  const picker=document.getElementById('session-picker');
  picker.style.display='flex';
  const today=DAYS[new Date().getDay()===0?6:new Date().getDay()-1];
  // Le repli générique doit se présenter comme tel. Sans ce bandeau, l'athlète
  // n'avait aucun moyen de distinguer un programme écrit pour lui d'un contenu
  // d'exemple servi par défaut.
  const bandeau=programmeEstEssai()?_bandeauEssai():'';
  // Remis a zero A CHAQUE OUVERTURE : sans cela la cascade repartirait du rang
  // atteint la fois precedente et les premieres lignes entreraient en retard.
  _spRang=0;
  document.getElementById('session-picker-list').innerHTML=bandeau+cfg.map((s,i)=>{
    if(!s.active) return '';
    const isToday=s.day===today;
    const badgeExemple=seanceEstExemple(s)?`<span style="background:#2a1a00;color:var(--orange);border:1px solid var(--orange);padding:1px 6px;border-radius:var(--r-1);font-size:var(--fs-xs);font-weight:800;letter-spacing:.5px;text-transform:uppercase;margin-left:6px;vertical-align:middle">Exemple</span>`:'';
    // --i porte le RANG de la rangée : c'est lui que la cascade d'entrée lit
    // pour décaler chaque ligne d'un cran. Il compte les rangées AFFICHÉES et
    // non l'indice du jour, sinon un mardi de repos laisserait un trou dans la
    // cadence.
    const rang=_spRang++;
    return `<div class="sp-ligne${isToday?' sp-auj':''}" style="--i:${rang}"
      onclick="startWorkoutSession(${i});document.getElementById('session-picker').style.display='none'"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      ${s.photo?`<img class="sp-photo" src="${srcImageAttr(s.photo)}" alt="">`:`<div class="sp-jour">${DAY_ICONS[i]}</div>`}
      <div class="sp-txt">
        <div class="sp-jourlib">${s.day||DAYS[i]}${isToday?' · Aujourd\'hui':''}</div>
        <div class="sp-nom">${escapeHtml(_nomSeance(s,i))}${badgeExemple}</div>
        <div class="sp-nb">${s.exercises?.length||0} exercices ${seanceEstExemple(s)?'proposés':'configurés'}</div>
      </div>
      <span class="sp-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z" fill="currentColor"/></svg></span>
    </div>`;
  }).join('');
}

// Le modal de phase s'ouvrait sur le seul critère du GENRE DÉCLARÉ. Une
// utilisatrice ménopausée, sous contraception continue ou aménorrhéique
// n'avait que « Ignorer », à recliquer AVANT CHAQUE SÉANCE, sans que sa
// réponse soit jamais retenue. La question passe du niveau « chaque séance »
// au niveau « une fois », et le genre ne décide plus que d'une chose : à qui
// on propose l'écran de choix la première fois.
// ── Le dernier geste des DEUX chemins de lancement ─────────────────────────
//
// startWorkoutSession quand aucune question de cycle n’est due, _cycleLancer
// quand elles viennent d’être répondues. La seconde appelait demarrerSeance
// directement : l’aperçu était donc INATTEIGNABLE pour toute athlète dont le
// suivi de cycle est actif, puisque les cinq sorties des modales repassent
// toutes par elle.
//
// L’APERÇU PEUT REFUSER. ouvrirApercuSeance rend false sur une séance sans
// exercice, après l’avoir dit à l’écran. On enchaîne alors sur
// demarrerSeance — c’était déjà le repli de startWorkoutSession, on le garde
// mot pour mot.
//
// `sess` est passée quand l’appelant la tient déjà : c’est le cas de
// startWorkoutSession, qui l’a lue en tête de fonction.
// L'APERÇU DÉJÀ VU (05/10/2026) : le parcours de première séance montre la
// séance sur son propre écran final ; le rouvrir demandait une touche de plus
// avant la première série. Posé par startWorkoutSession(idx,{sansApercu:true}),
// consommé ici — y compris après les questions de cycle (_cycleLancer).
let _apercuSaute=false;
function _apercuOuSeance(idx,sess){
  const saute=_apercuSaute; _apercuSaute=false;
  if(!saute&&ouvrirApercuSeance(idx)) return true;
  const cfg=currentUser.sessions_config||initSessionsConfig();
  demarrerSeance(sess||cfg[idx],idx);
  return false;
}
function startWorkoutSession(idx,o){
  _apercuSaute=!!(o&&o.sansApercu);
  const cfg=currentUser.sessions_config||initSessionsConfig();
  const sess=cfg[idx];
  window._pendingWorkoutIdx=idx;
  if(cycleDoitDemanderPhase(currentUser)){
    _cyclePreselectionner();
    document.getElementById('cycle-modal').style.display='flex';
    return;
  }
  if(cycleDoitChoisir(currentUser)){
    document.getElementById('cycle-choix-modal').style.display='flex';
    return;
  }
  currentUser.currentCycle='ignore';
  // L'aperçu s'intercale ICI, après les questions de cycle et non avant :
  // les poser par-dessus un écran de séance qu'on vient d'ouvrir enchaînerait
  // deux interruptions. Il ne remonte donc PAS au-dessus des deux `return`
  // ci-dessus — c’est _cycleLancer qui le reprend de l’autre côté.
  _apercuOuSeance(idx,sess);
}

// ======= CYCLE LOGIC =======
let _pendingWorkoutIdx=null;

// La préférence, déclarée UNE fois. Absente = jamais répondu.
const CYCLE_SUIVI_VALEURS=Object.freeze(['actif','sans_objet','jamais_demander']);
// Trois reports de l'écran de choix suffisent : reposer indéfiniment la même
// question est exactement ce que ce lot corrige.
const CYCLE_CHOIX_MAX=3;
// Cinq « je ne sais pas » d'affilée. Compté sur les SÉANCES, jamais sur des
// dates : quelqu'un qui s'entraîne une fois par mois n'a pas à être relancé
// plus vite que quelqu'un qui vient tous les jours.
const CYCLE_IGNORE_SUITE=5;
function cycleSuiviDe(user){
  const v=user&&user.cycleSuivi;
  return CYCLE_SUIVI_VALEURS.indexOf(v)>=0?v:null;
}
// LE GENRE N'ENTRE PAS ICI. Qui a demandé le suivi le reçoit, point.
function cycleDoitDemanderPhase(user){
  // Traité comme « sans objet », SANS écraser la valeur stockée : la
  // préférence de l'athlète est intacte et revient telle quelle à la
  // révocation.
  if(grossesseSuspend(user)) return false;
  return cycleSuiviDe(user)==='actif';
}
// Le genre ne sert plus qu'à ça : décider à qui la question est POSÉE une
// première fois. Une réponse déjà donnée, dans un sens ou dans l'autre,
// ferme le sujet.
function cycleDoitChoisir(user){
  if(grossesseSuspend(user)) return false;
  if(cycleSuiviDe(user)) return false;
  if(!isFemale(user&&user.gender)) return false;
  return ((user&&user.cycleChoixVus)||0)<CYCLE_CHOIX_MAX;
}
// Proposé UNE seule fois, et seulement à qui suit vraiment son cycle.
function cycleArretAProposer(user){
  if(cycleSuiviDe(user)!=='actif') return false;
  if(user&&user.cycleArretPropose) return false;
  return ((user&&user.cycleIgnoresSuite)||0)>=CYCLE_IGNORE_SUITE;
}
// LE RETOUR DES CINQ MODALES DE CYCLE. Elle sautait l’aperçu, et c’est tout
// le défaut : la question de cycle vient d’être posée et répondue, l’aperçu
// n’en repose aucune — startWorkoutSession n’est pas rappelée, et la sortie
// de l’aperçu passe par commencerDepuisApercu, qui va droit à demarrerSeance.
function _cycleLancer(){
  const idx=window._pendingWorkoutIdx||0;
  _apercuOuSeance(idx);
}
function setCyclePhase(phase,el){
  // Le cycle menstruel est nomme a l'article 9 et au §2 de la politique.
  if(!demanderConsentementSante('cycle',()=>setCyclePhase(phase,el))) return;
  if(el) document.querySelectorAll('#cycle-options .obj-opt').forEach(e=>e.classList.remove('sel'));
  if(el) el.classList.add('sel');
  currentUser.currentCycle=phase;
  currentUser.cycleIgnoresSuite=(phase==='ignore')
    ?(((currentUser.cycleIgnoresSuite)||0)+1):0;
  saveUser();
  document.getElementById('cycle-modal').style.display='none';
  if(cycleArretAProposer(currentUser)){
    currentUser.cycleArretPropose=true;
    saveUser();
    const m=document.getElementById('cycle-arret-modal');
    if(m){ m.style.display='flex'; return; }
  }
  _cycleLancer();
}
// L'écran de choix. Aucune de ces réponses ne demande de précision : on ne
// fait pas raconter une ménopause ou une aménorrhée pour désactiver un modal.
function repondreCycleChoix(v){
  const modal=document.getElementById('cycle-choix-modal');
  if(modal) modal.style.display='none';
  currentUser.cycleSuivi=(CYCLE_SUIVI_VALEURS.indexOf(v)>=0)?v:'jamais_demander';
  saveUser();
  if(currentUser.cycleSuivi==='actif'){
    // ⚠ PREMIER USAGE DU SUIVI DE CYCLE : c'est l'un des deux moments ou la
    // date de naissance et le genre sont demandes. La porte enchaine le
    // consentement sante puis l'ecran, et rejoue cette fonction ensuite —
    // `cycleSuivi` est deja ecrit, la branche reprendra donc au meme endroit.
    //
    // ⚠ ET saveUser() CI-DESSUS A DEJA COUPE `cycleSuivi` si le consentement
    // manquait : c'est le verrou qui fait son travail. La reponse est
    // reecrite au retour de la porte, une fois l'accord donne.
    if(!naissanceComplete(currentUser)){
      demanderNaissanceGenre('cycle',()=>{
        currentUser.cycleSuivi='actif'; saveUser(); repondreCycleChoix('actif');
      });
      return;
    }
    // « Je l'indiquerai avant mes séances » — celle-ci comprise, sinon la
    // séance qui suit le oui serait la seule à ne pas en tenir compte.
    const m=document.getElementById('cycle-modal');
    if(m){ _cyclePreselectionner(); m.style.display='flex'; return; }
  }
  currentUser.currentCycle='ignore';
  _cycleLancer();
}
// « Plus tard » n'écrit PAS de préférence — mais il compte, sinon le plafond
// de trois serait incomptable et la question reviendrait sans fin.
function reporterCycleChoix(){
  const modal=document.getElementById('cycle-choix-modal');
  if(modal) modal.style.display='none';
  const vus=(((currentUser.cycleChoixVus)||0)+1);
  currentUser.cycleChoixVus=vus;
  if(vus>=CYCLE_CHOIX_MAX) currentUser.cycleSuivi='jamais_demander';
  saveUser();
  currentUser.currentCycle='ignore';
  _cycleLancer();
}
function accepterArretCycle(){
  const m=document.getElementById('cycle-arret-modal');
  if(m) m.style.display='none';
  currentUser.cycleSuivi='jamais_demander';
  currentUser.currentCycle='ignore';
  saveUser();
  _cycleLancer();
}
function refuserArretCycle(){
  const m=document.getElementById('cycle-arret-modal');
  if(m) m.style.display='none';
  // La suite repart de zéro : sinon la proposition, déjà faite une fois,
  // laisserait un compteur bloqué au-dessus du seuil pour toujours.
  currentUser.cycleIgnoresSuite=0;
  saveUser();
  _cycleLancer();
}

// Détecte si un exercice est cardio (durée) plutôt que force (répétitions + poids)
function isCardio(ex){
  if(!ex) return false;
  const r=(ex.reps||'').toLowerCase();
  return /\d+\s*(min|sec|h\b|km|m\b)/.test(r)||r.includes('min')||r.includes('cardio');
}

// LE RESSENTI DÉCLARÉ PRIME TOUJOURS. Une athlète qui dit « je me sens bien »
// en pleine phase lutéale n'a pas à se faire retirer une série par un calcul.
// La dérivation ne parle QUE quand elle n'a rien dit — « je ne sais pas », ou
// pas de réponse du tout.
//
// Les deux paramètres ont un défaut : les appelants existants font
// getCycleFactor() nu, et les tests aussi.
function getCycleFactor(user,dateISO){
  const u=user||currentUser||{};
  const p=u.currentCycle||'ignore';
  if(p==='j1_difficile') return{factor:0.80,seriesReduce:0};
  if(p==='j1_supportable') return{factor:0.95,seriesReduce:0};
  if(p==='j6_14') return{factor:1.00,seriesReduce:0};
  if(p==='j15_21') return{factor:1.00,seriesReduce:0};
  // j22_28 est l'option DÉCLARÉE à la main. Elle retirait une série elle
  // aussi : ce n'était donc pas seulement une dérivation calendaire qui
  // amputait le volume, mais aussi une déclaration de ressenti. Les deux
  // tombent. L'option reste, purement informative.
  if(p==='j22_28') return{factor:1.00,seriesReduce:0};
  // Rien de déclaré : la phase calculée NE TOUCHE PLUS LA CHARGE (30/09/2026),
  // sauf si l'athlète l'a demandé (confCycle(u).ajusterAuto === true, dans le
  // paramétrage du cycle). Un calendrier décrit, il ne décide pas : c'est ce
  // qu'elle déclare du jour (j1_difficile, j1_supportable) qui pèse sur la
  // barre. Le libellé de phase, lui, reste affiché. Sans cycle configuré,
  // phaseCycle rend null et on retombe au neutre.
  const phase=phaseCycle(u,dateISO||localISODate(new Date()));
  // Périmé, irrégulier, ou rien du tout : on ne dérive RIEN. Un calendrier
  // qu'on sait faux ne doit pas peser sur une barre.
  if(!phaseAgissante(phase)) return{factor:1.00,seriesReduce:0};
  const conf=confCycle(u);
  if(conf.ajusterAuto!==true) return{factor:1.00,seriesReduce:0};
  if(phase==='menstrual')
    return conf.intensiteRegles==='difficile'
      ?{factor:0.80,seriesReduce:0}:{factor:0.95,seriesReduce:0};
  // La lutéale tardive ne retire plus rien. Le libellé de phase et la
  // minoration d'e1RM restent — ils décrivent, ils n'amputent pas.
  if(phase==='luteal_late'&&conf.sensibilitePms) return{factor:1.00,seriesReduce:0};
  return{factor:1.00,seriesReduce:0};
}
// ══════ AUCUNE RÈGLE DE CYCLE NE MODIFIE UN NOMBRE DE SÉRIES ═════════════
// Le produit retirait une série en phase lutéale tardive, et sur l'option
// « J22-28 » déclarée à la main. Rien ne justifiait d'amputer le volume
// prescrit par le coach : le cycle peut moduler une CHARGE — ce qu'il fait
// toujours, à 0,80 et 0,95 — et il peut décrire une phase, mais il ne
// décide pas du programme.
//
// Le champ `seriesReduce` est CONSERVÉ dans la structure de retour pour ne
// casser aucun appelant, et il ne vaut plus jamais autre chose que 0. La
// garde ci-dessous le vérifie sur les six options déclarables, dans le texte
// même de getCycleFactor — les phases dérivées ne sont pas atteignables sans
// dossier, la lecture lexicale les couvre — et dans le montage de séance.
//
// CE QUI RESTE HORS DE PORTÉE DE CETTE GARDE, et volontairement : le
// multiplicateur de charge, la minoration d'e1RM, l'ajout de glucides en
// lutéale et la suggestion d'oméga-3. Aucun ne touche au volume.
const CYCLE_OPTIONS_RESSENTI=Object.freeze(
  ['j1_difficile','j1_supportable','j6_14','j15_21','j22_28','ignore']);
function assertNoCycleRuleAltersSeries(){
  const fautes=[];
  for(const p of CYCLE_OPTIONS_RESSENTI){
    let f=null;
    try{ f=getCycleFactor({currentCycle:p}); }catch(e){ fautes.push(p+' : '+e.message); continue; }
    if(!f||f.seriesReduce!==0) fautes.push('option '+p+' → '+(f&&f.seriesReduce));
  }
  const nonNuls=(String(getCycleFactor).match(/seriesReduce\s*:\s*[0-9]+/g)||[])
    .filter(m=>!/:\s*0$/.test(m));
  if(nonNuls.length) fautes.push('valeur non nulle : '+nonNuls.join(', '));
  if(/seriesReduce|_cycleAdjusted/.test(String(launchWorkout)))
    fautes.push('le montage de séance lit encore le champ');
  return {ok:!fautes.length,fautes};
}
// Option du modal correspondant à la phase calculée, pour la PRÉ-SÉLECTIONNER.
// Rien de plus : l'athlète coche ce qu'elle veut, et c'est son choix qui
// s'applique.
function _cycleOptionSuggeree(user,dateISO){
  const phase=phaseCycle(user||currentUser,dateISO||localISODate(new Date()));
  // Périmé ou irrégulier : on ne pré-coche RIEN. Suggérer « rien de
  // particulier » sur un cycle dont on vient de dire qu'on ne sait rien
  // serait une affirmation de plus.
  if(!phaseAgissante(phase)) return null;
  if(phase==='menstrual')
    return confCycle(user||currentUser).intensiteRegles==='difficile'
      ?'j1_difficile':'j1_supportable';
  if(phase==='luteal_late') return 'j22_28';
  return 'j15_21';
}
// Marque l'option suggérée dans le modal déjà présent dans la page.
function _cyclePreselectionner(){
  const z=document.getElementById('cycle-options');
  if(!z) return null;
  z.querySelectorAll('.obj-opt').forEach(e=>e.classList.remove('sel'));
  const v=_cycleOptionSuggeree(currentUser);
  if(!v) return null;
  const cible=Array.from(z.querySelectorAll('.obj-opt'))
    .find(e=>(e.getAttribute('onclick')||'').indexOf("'"+v+"'")>=0);
  if(cible) cible.classList.add('sel');
  return v;
}

function getCycleLabel(){
  const p=currentUser.currentCycle||'ignore';
  // Du ressenti, pas une position calendaire : une femme sous contraception
  // continue n'a pas de « J15 », et lire « Phase lutéale J22-28 » quand on a
  // simplement coché « fatiguée » ne veut rien dire. Les VALEURS et les
  // couleurs sont inchangées — getCycleFactor ne bouge pas d'un pouce.
  if(p==='j1_difficile') return{text:'Règles, c\'est dur',color:'var(--cycle-accent)'};
  if(p==='j1_supportable') return{text:'Règles, ça va',color:'var(--orange)'};
  if(p==='j6_14') return{text:'Je me sens bien',color:'var(--green)'};
  if(p==='j15_21') return{text:'Rien de particulier',color:'var(--green)'};
  if(p==='j22_28') return{text:'Fatigue, ballonnements',color:'var(--orange)'};
  return null;
}

// ======= WORKOUT PERSISTENCE =======

// ══════════════ FILMER : INTENTION DE L'ATHLÈTE, DEMANDE DU COACH ══════════
// Deux objets distincts, volontairement :
//   woState.aFilmer      — la liste des exercices que l'athlète a cochés
//                          PENDANT sa séance. Même cycle de vie que
//                          woState.substitutions : persisté par woPersist,
//                          recopié dans la séance par finishWorkout.
//   user.demandesVideo   — les demandes du COACH, dans le dossier de l'athlète.
//                          Écrites par le même chemin que la décharge, poussées
//                          par le même CLOUD.pushOne. Aucun canal neuf, et
//                          surtout AUCUNE notification : le plafond de trois
//                          par jour ne bouge pas.
function _nomsAFilmer(indices){
  // Un cardio ne se filme pas pour la technique : la case n'apparaît d'ailleurs
  // que si le groupe contient au moins un exercice de musculation.
  return (indices||[]).filter(i=>!isCardio(woState.exercises[i]))
    .map(i=>woState.exercises[i]&&woState.exercises[i].name).filter(Boolean);
}
function estAFilmer(nom){
  return !!nom&&(woState&&woState.aFilmer||[]).indexOf(nom)>=0;
}
// La case est UNE pour tout l'écran. Sur un superset, deux exercices sont
// affichés ensemble : « Filmer cet exercice » les prend alors tous les deux,
// faute de pouvoir désigner l'un plutôt que l'autre avec une seule case.
function basculerAFilmer(coche,indices){
  if(!woState) return;
  if(!Array.isArray(woState.aFilmer)) woState.aFilmer=[];
  const noms=_nomsAFilmer(indices);
  for(const n of noms){
    const i=woState.aFilmer.indexOf(n);
    if(coche&&i<0) woState.aFilmer.push(n);
    if(!coche&&i>=0) woState.aFilmer.splice(i,1);
  }
  woPersist();
}
// ── Demandes du coach ──────────────────────────────────────────────────────
// Une demande est EN ATTENTE tant qu'elle est dans le tableau. La consommer,
// c'est la retirer : le coach l'efface de la même façon. Pas de drapeau
// « faite » à maintenir, donc pas d'état intermédiaire à faire vivre.
function demandeVideoPour(nom,user){
  const u=user||currentUser;
  if(!nom||!u||!Array.isArray(u.demandesVideo)) return null;
  const k=exKey(nom);
  return u.demandesVideo.find(d=>d&&exKey(d.exercice)===k)||null;
}
// Le dépôt d'une vidéo portant le nom de l'exercice éteint la demande. Rend
// true si quelque chose a été retiré, pour que l'appelant sache s'il doit
// écrire. Comparaison par exKey : « Développé couché » et « DEVELOPPE COUCHE »
// désignent le même exercice partout ailleurs dans l'app.
function consommerDemandeVideo(nom,user){
  const u=user||currentUser;
  if(!nom||!u||!Array.isArray(u.demandesVideo)||!u.demandesVideo.length) return false;
  const k=exKey(nom);
  const reste=u.demandesVideo.filter(d=>!d||exKey(d.exercice)!==k);
  if(reste.length===u.demandesVideo.length) return false;
  u.demandesVideo=reste;
  return true;
}
// Exercices du programme, créneaux ACTIFS uniquement, dédoublonnés par exKey.
// C'est la liste dans laquelle le coach choisit, et c'est elle qui sert de
// contrôle : une demande hors programme n'a pas de sens et est refusée.
function exercicesDuProgramme(c){
  const vus=new Set(), out=[];
  for(const s of ((c&&c.sessions_config)||[])){
    if(!s||!s.active||!Array.isArray(s.exercises)) continue;
    for(const ex of s.exercises){
      const n=ex&&ex.name; if(!n) continue;
      const k=exKey(n); if(!k||vus.has(k)) continue;
      vus.add(k); out.push(n);
    }
  }
  return out;
}
function estDansLeProgramme(nom,c){
  const k=exKey(nom);
  return !!k&&exercicesDuProgramme(c).some(n=>exKey(n)===k);
}

function woPersist(){
  if(!woState?.exercises?.length||!woState.startTime) return;
  // Séance TERMINÉE : on n'écrit plus rien. finishWorkout supprime le
  // snapshot mais ne vide pas woState — l'objet garde ses exercices et son
  // startTime. N'importe quel woPersist ultérieur ressuscitait donc la
  // séance en « à finir » sur l'accueil. Le cas le plus courant : le
  // visibilitychange qui persiste quand l'app passe en arrière-plan, c'est-
  // à-dire au moment précis où l'athlète verrouille son téléphone après
  // avoir terminé. D'où le « parfois » : il fallait ce geste-là.
  if(woState.termine) return;
  try{
    localStorage.setItem('rc_wo_state',JSON.stringify({
      // L ADRESSE DE CELUI QUI S ENTRAÎNE. La clé est commune à l’appareil,
      // le contenu ne l’est pas : charges, séries validées, réponses de
      // douleur et photo de séance sont ceux d’une seule personne.
      email:(currentUser&&currentUser.email)||'',
      exercises:woState.exercises,
      currentEx:woState.currentEx,
      startTime:woState.startTime,
      sessionData:woState.sessionData,
      progName:woState.progName,
      // Échéance du minuteur de repos : sans elle, une séance reprise
      // redémarrerait sans savoir qu'un repos était en cours.
      substitutions:(woState.substitutions||[]).slice(),
      // Sans lui, une séance reprise après une interruption repartirait avec
      // les cases « Filmer » décochées et l'intention serait perdue.
      aFilmer:(woState.aFilmer||[]).slice(),
      // Sans lui, une séance reprise reproposerait la carte de douleur sur un
      // exercice où l'athlète a déjà répondu.
      douleurChoix:Object.assign({},woState.douleurChoix||{}),
      reposFin:woState.reposFin||null,
      reposTotal:woState.reposTotal||null,
      reposLib:woState.reposLib||'',
      // Sans lui, une séance mise en pause puis reprise perdrait son créneau :
      // la suggestion repartirait sur le repli par nom, et l'enregistrement
      // final ne porterait plus de slot.
      slot:woState.slot??null,
      // sessionPhoto NE PART PLUS DANS L'INSTANTANE. C'est l'illustration que
      // le COACH pose sur son creneau — sessions_config[slot].photo — et non
      // une photo prise par l'athlete : elle n'entre dans aucun bilan, elle
      // n'est qu'affichee en tete de l'ecran de seance.
      //
      // ET C'ETAIT LE PLUS GROS ELEMENT DE L'INSTANTANE : une image en base64,
      // recopiee a chaque serie validee, a chaque minuteur, a chaque passage en
      // arriere-plan, sur un stockage deja sature a 81 % par du base64. C'est
      // elle qui faisait echouer l'ecriture, donc perdre la SEANCE — series,
      // charges, reponses de douleur — pour sauver une illustration.
      //
      // RIEN N'EST PERDU POUR AUTANT : le creneau est dans l'instantane, et
      // woResumeAndGo va rechercher la photo a la source. On stocke la
      // reference, pas la copie.
      // Sans eux, une séance reprise après pause perdrait sa fin de séance,
      // qui est justement ce qui reste à faire au moment de la reprise.
      deload:!!woState.deload,
      // Le record à portée et la reprise en douceur survivent à une pause.
      objectif:woState.objectif||null,
      repriseDouce:!!woState.repriseDouce,
      warmup:woState.warmup||'',
      cooldown:woState.cooldown||'',
      // Les étapes déjà cochées de l'échauffement : sans elles, une séance
      // reprise après une interruption repartait avec une checklist vierge.
      ckEtat:_ckEtat
    }));
  }catch(e){
    // LE PATRON DE _bilEcrireDraft, pour la meme raison exactement : woPersist
    // se declenche a chaque serie validee, a chaque minuteur, a chaque passage
    // en arriere-plan. Un toast par appel serait pire que le probleme signale.
    //
    // ET IL FAUT LE DIRE, une fois : sans instantane, une seance interrompue
    // par un appel telephonique est PERDUE — series validees, charges saisies,
    // reponses de douleur. L'athlete qui l'apprend peut finir sa seance sans
    // quitter l'app ; celui qui ne l'apprend pas la refait.
    if(!_woSnapAvertiPlein){
      _woSnapAvertiPlein=true;
      console.warn('[RepCore] instantané de séance non enregistré :',e);
      try{ toast('Stockage plein : ta séance ne sera pas récupérable si tu quittes l\'app. Termine-la sans fermer.','var(--orange)'); }catch(_){}
    }
  }
}
// Une seule alerte par session, comme pour le brouillon de bilan.
let _woSnapAvertiPlein=false;
// PURE. L’instantané de séance est-il celui du compte courant ?
//
// Copie exacte de _bilDraftAMoi, y compris son refus quand l’adresse MANQUE :
// un instantané écrit avant ce correctif n’en porte pas, et deviner à qui il
// est reviendrait à proposer la séance de quelqu’un d’autre. On refuse, ce
// qui est le sens sûr — la seule perte est une reprise, jamais une donnée.
function _woSnapAMoi(snap){
  const moi=(currentUser&&currentUser.email)||null;
  if(!moi||!snap||!snap.email) return false;
  return String(snap.email)===String(moi);
}
function _woLoadSnap(){
  try{
    const raw=localStorage.getItem('rc_wo_state');
    if(!raw) return null;
    const snap=JSON.parse(raw);
    if(!snap?.exercises?.length||!snap.startTime) return null;
    if(Date.now()-snap.startTime>24*3600*1000){localStorage.removeItem('rc_wo_state');return null;}
    // ON NE SUPPRIME PAS l’instantané d’un autre, contrairement au cas de la
    // péremption juste au-dessus, qui vaut pour tout le monde. Même doctrine
    // que _bilLoadDraft : la lecture ne détruit rien, et son propriétaire
    // retrouve sa séance s’il se reconnecte sur cet appareil.
    if(!_woSnapAMoi(snap)) return null;
    return snap;
  }catch{return null;}
}
// PURE. Combien de séries portent done===true dans un instantané ? C'est ce
// nombre qui distingue une séance qu'on a vraiment commencée d'un écran
// ouvert puis quitté — et donc ce qui mérite une question avant écrasement.
function _woSeriesValidees(snap){
  let n=0;
  try{
    const d=snap&&snap.sessionData;
    if(!d) return 0;
    for(const k of Object.keys(d))
      for(const st of ((d[k]&&d[k].sets)||[]))
        if(st&&st.done===true) n++;
  }catch(e){ return 0; }
  return n;
}
// LE PRÉAMBULE DE LANCEMENT. launchWorkout remplace woState en bloc : sans
// cette question, une séance mise en pause disparaissait au premier
// « Démarrer », avec toutes ses séries saisies.
//
// SYNCHRONE QUAND IL N'Y A RIEN À DEMANDER : pas d'instantané, ou aucune
// série validée, et on appelle launchWorkout directement — même pile
// d'appels qu'avant, aucune promesse insérée.
function demarrerSeance(sessConfig,slotIdx){
  const snap=_woLoadSnap();
  const n=_woSeriesValidees(snap);
  if(!n) return launchWorkout(sessConfig,slotIdx);
  const nom=(snap&&snap.progName)||'Séance';
  return rcConfirm(
    'Une séance est déjà en cours',
    nom+' : '+n+' série'+(n>1?'s':'')+' déjà validée'+(n>1?'s':'')
      +'. Démarrer une nouvelle séance effacera ce qui a été saisi.',
    'Démarrer quand même',
    'Reprendre la séance en cours'
  ).then(ok=>{
    // FALSE couvre le bouton de refus ET le toucher du voile : les deux mènent
    // à la reprise, jamais à l'écrasement.
    if(!ok) return woResumeAndGo();
    return launchWorkout(sessConfig,slotIdx);
  });
}
function woResumeAndGo(){
  const snap=_woLoadSnap();
  if(!snap){document.getElementById('clh-resume-workout').style.display='none';return;}
  try{ _woVerrouEcran(); }catch(e){}
  // Vidé AVANT l'affectation : ce qui restait dans le Set appartient à une
  // autre séance, et son indexation par « exercice : série » le ferait
  // ressortir sur des séries qui ne sont pas des records.
  _resetRecordsVus();
  woState={...snap};
  // L'ILLUSTRATION DU CRENEAU, RETROUVEE A LA SOURCE plutot que recopiee dans
  // l'instantane — voir woPersist. Le creneau y est, la photo est dans
  // sessions_config : la reprise la remet sans avoir eu a la porter.
  //
  // SI ELLE A CHANGE ENTRE-TEMPS, c'est la nouvelle qui s'affiche. C'est le
  // comportement juste : la seance reprise est celle du creneau tel qu'il est
  // aujourd'hui, et ce n'est qu'une image.
  //
  // AUCUN CRENEAU — une seance libre — et il n'y a simplement pas d'image,
  // exactement comme au lancement.
  try{
    const _sc=currentUser&&currentUser.sessions_config;
    const _cr=(snap.slot!=null&&_sc)?_sc[snap.slot]:null;
    woState.sessionPhoto=(_cr&&_cr.photo)||null;
  }catch(e){ woState.sessionPhoto=null; }
  // Puis reconstruit sur ce qui vient d'être repris : les badges de CETTE
  // séance-là sont justes, et un rechargement les avait jusqu'ici perdus.
  _rebatirRecordsVus();
  // Checklist restaurée avant le rendu, sinon les coches s'afficheraient vides.
  // Le chrono, lui, ne redémarre pas : le temps a passé pendant la pause.
  _ckEtat=snap.ckEtat||{};
  _ckStopChrono();
  clearInterval(woState.timerInterval);
  woState.timerInterval=setInterval(()=>{
    const el=document.getElementById('wo-timer');
    if(el){const s=Math.floor((Date.now()-woState.startTime)/1000);el.textContent=fmtDureeSeance(s);}
  },1000);
  go('s-workout');
  document.getElementById('wo-title').textContent=woState.progName||'Séance';
  renderWoEx();
  // Le minuteur repart de son ÉCHÉANCE : si elle est passée, _peindreRepos
  // masque le bandeau et rien n'est réaffiché.
  _reprendreRepos();
}
function pauseWorkout(){
  _feuilleOuvrir('wo-pause-modal');
}
// QUITTER L’ÉCRAN DE SÉANCE, par où que ce soit.
//
// Le drapeau lu par sw.js n’était baissé qu’à UN endroit — finishWorkout —
// alors que trois autres chemins quittent cet écran. seanceActive() restait
// donc vrai et `install` ne faisait plus skipWaiting() pendant les QUATRE
// HEURES de SEANCE_PEREMPTION_MS : une pause de deux minutes gelait les mises
// à jour pour la demi-journée.
//
// `garder` distingue la PAUSE de l’ANNULATION : la première conserve la séance
// en cours, la seconde vient de l’effacer et la réécrire la ferait revenir.
//
// NE LÈVE JAMAIS : une sortie d’écran ne doit pas pouvoir échouer.
function _quitterEcranSeance(garder){
  try{ _swSeance('SEANCE_TERMINEE'); }catch(e){}
  try{ _rirBandeFermer(); }catch(e){}
  try{ _woLibererEcran(); }catch(e){}
  if(garder!==false){ try{ woPersist(); }catch(e){} }
  try{ clearInterval(woState&&woState.timerInterval); }catch(e){}
}
function confirmPauseWorkout(){
  _feuilleFermer('wo-pause-modal',true);
  _quitterEcranSeance(true);
  go('s-client-home');
  loadClientHome();
}
async function cancelWorkout(){
  _feuilleFermer('wo-pause-modal');
  if(!await rcConfirm('Annuler la séance ? Aucune donnée ne sera enregistrée.',null,'Annuler la séance')) return;
  localStorage.removeItem('rc_wo_state');
  try{ _woLibererEcran(); }catch(e){}
  // `false` : la séance vient d’être effacée, la réécrire la ferait revenir.
  _quitterEcranSeance(false);
  woState={};
  go('s-client-home');
  loadClientHome();
}
// Remplacante de confirm(), aux couleurs de l app. Rend une PROMESSE pour
// que l appelant garde la forme d avant : if(!await rcConfirm(...)) return.
// Repli sur confirm() natif si l ecran manque — mieux vaut une boite laide
// qu un geste irreversible declenche sans question.
// `libelleNon` est optionnel et vaut « Annuler » : les appels existants ne
// changent pas. Il est REPOSE a chaque ouverture, comme celui du bouton
// d'action — sans quoi le premier appel qui le personnalise le laisserait tel
// quel pour tous les suivants.
function rcConfirm(titre,texte,libelleOk,libelleNon){
  const z=document.getElementById('rc-confirm');
  const t=document.getElementById('rc-confirm-titre');
  const x=document.getElementById('rc-confirm-texte');
  const ok=document.getElementById('rc-confirm-ok');
  const non=document.getElementById('rc-confirm-non');
  if(!z||!t||!x||!ok||!non) return Promise.resolve(confirm(titre));
  // UN SEUL ARGUMENT SUFFIT. Les messages venus de confirm() portent déjà
  // leur séparation : un titre, une ligne vide, le détail. On coupe ICI
  // plutôt que de réécrire quarante-neuf messages à la main — et de se
  // tromper sur l’un d’eux, alors qu’ils portent des conséquences de santé
  // et des mentions juridiques.
  if(texte==null&&typeof titre==='string'){
    const _i=titre.indexOf('\n\n');
    if(_i>0){ texte=titre.slice(_i+2); titre=titre.slice(0,_i); }
  }
  t.textContent=titre; x.textContent=texte||'';
  ok.textContent=libelleOk||'Confirmer';
  non.textContent=libelleNon||'Annuler';
  // Le panneau est PARTAGE : sans cette ligne, un rcConfirm3 precedent
  // laisserait sa troisieme issue visible sur la boite suivante.
  const _mid=document.getElementById('rc-confirm-mid');
  if(_mid){ _mid.style.display='none'; _mid.onclick=null; }
  _feuilleOuvrir('rc-confirm');
  return new Promise(res=>{
    // REGLE 7 : on resout D'ABORD, on anime ensuite. Quarante-neuf messages
    // portent des consequences de sante ou juridiques — aucune decision ne
    // doit attendre 140 ms de plus.
    const fermer=v=>{
      ok.onclick=null; non.onclick=null; z.onclick=null; res(v);
      _feuilleFermer('rc-confirm'); };
    ok.onclick=()=>fermer(true);
    non.onclick=()=>fermer(false);
    // Toucher le voile ANNULE : sur un geste irreversible, le toucher flou
    // doit aller vers le refus.
    z.onclick=e=>{ if(e.target===z) fermer(false); };
  });
}
// TROIS ISSUES, ET NON DEUX. Le meme panneau que rcConfirm, avec un bouton de
// plus au milieu — meme calque, meme forme, meme fermeture : deux boites
// differentes pour deux decisions du meme ecran donneraient l impression que
// l une vient d ailleurs.
//
// Elle rend 'ok', 'milieu' ou null, et non un booleen : a trois issues, `true`
// et `false` ne suffisent plus, et un appelant qui oublierait le troisieme cas
// tomberait dans le `else` du refus — le plus sur des deux, mais pas ce qu il
// voulait dire.
//
// LE VOILE ET L ANNULATION RENDENT null. Sur un geste irreversible, le toucher
// flou va vers le refus : c est la regle deja posee par rcConfirm.
function rcConfirm3(titre,texte,libelleOk,libelleMilieu,libelleNon){
  const z=document.getElementById('rc-confirm');
  const t=document.getElementById('rc-confirm-titre');
  const x=document.getElementById('rc-confirm-texte');
  const ok=document.getElementById('rc-confirm-ok');
  const mid=document.getElementById('rc-confirm-mid');
  const non=document.getElementById('rc-confirm-non');
  if(!z||!t||!x||!ok||!mid||!non)
    return Promise.resolve(confirm(titre)?'ok':null);
  t.textContent=titre; x.textContent=texte||'';
  ok.textContent=libelleOk||'Confirmer';
  mid.textContent=libelleMilieu||'';
  mid.style.display='';
  non.textContent=libelleNon||'Annuler';
  _feuilleOuvrir('rc-confirm');
  return new Promise(res=>{
    const fermer=v=>{
      ok.onclick=null; mid.onclick=null; non.onclick=null; z.onclick=null;
      mid.style.display='none';
      res(v);
      _feuilleFermer('rc-confirm'); };
    ok.onclick=()=>fermer('ok');
    mid.onclick=()=>fermer('milieu');
    non.onclick=()=>fermer(null);
    z.onclick=e=>{ if(e.target===z) fermer(null); };
  });
}
// UN SEUL BOUTON, pour ce qui n’appelle pas de décision — le remplaçant
// d’alert(). Même calque : deux boîtes différentes pour deux messages du
// même écran donneraient l’impression que l’une vient d’ailleurs.
//
// Elle rend une promesse, comme rcConfirm : un rapport de fin de traitement
// doit pouvoir être LU avant que l’écran ne se redessine dessous.
function rcAlerte(titre,libelleOk){
  const non=document.getElementById('rc-confirm-non');
  if(non) non.style.display='none';
  return rcConfirm(titre,null,libelleOk||'J’ai compris')
    .then(v=>{ if(non) non.style.display=''; return v; },
          e=>{ if(non) non.style.display=''; throw e; });
}
// SAISIE, en remplacement de prompt(). Rend la valeur, ou null si on annule
// — exactement le contrat de prompt(), pour que les appelants gardent leur
// forme : `if(saisi===null) return;`.
//
// `opts` porte le clavier à ouvrir. Un numéro de téléphone saisi sur un
// clavier alphabétique est une brimade sur mobile.
// LA FERMETURE DE LA SAISIE EN COURS, atteignable de l’extérieur.
//
// go() l’appelle : changer d’écran alors qu’une saisie est ouverte laissait le
// calque par-dessus le nouvel écran, et la promesse en attente. `null` est la
// réponse d’une annulation, celle que les trois appelants savent déjà lire.
//
// Vidée dès qu’elle a servi : une seconde fermeture ne doit pas résoudre une
// promesse qui n’existe plus.
let _rcSaisieFermer=null;
function rcSaisieFermer(instantane){
  const f=_rcSaisieFermer;
  _rcSaisieFermer=null;
  if(typeof f==='function') try{ f(); }catch(e){}
  // go() ferme SANS ANIMATION : une feuille qui sortirait en fondu par-dessus
  // le nouvel ecran serait pire que le clignotement d'avant.
  if(instantane) try{ _feuilleFermer('rc-saisie',true); }catch(e){}
}
function rcSaisie(titre,valeur,opts){
  const z=document.getElementById('rc-saisie');
  const t=document.getElementById('rc-saisie-titre');
  const x=document.getElementById('rc-saisie-texte');
  const c=document.getElementById('rc-saisie-champ');
  const ok=document.getElementById('rc-saisie-ok');
  const non=document.getElementById('rc-saisie-non');
  // Repli sur prompt() si l’écran manque : mieux vaut une boîte laide qu’une
  // saisie impossible. Même règle que rcConfirm.
  if(!z||!t||!x||!c||!ok||!non) return Promise.resolve(prompt(titre,valeur));
  let ttre=titre, det='';
  if(typeof titre==='string'){
    const _i=titre.indexOf('\n\n');
    if(_i>0){ det=titre.slice(_i+2); ttre=titre.slice(0,_i); }
  }
  t.textContent=ttre; x.textContent=det;
  const o=opts||{};
  c.type=o.type||'text';
  if(o.inputmode) c.setAttribute('inputmode',o.inputmode); else c.removeAttribute('inputmode');
  c.placeholder=o.placeholder||'';
  c.value=valeur==null?'':String(valeur);
  ok.textContent=o.libelleOk||'Valider';
  non.textContent=o.libelleNon||'Annuler';
  _feuilleOuvrir('rc-saisie');
  setTimeout(()=>{ try{ c.focus(); c.select(); }catch(e){} },50);
  return new Promise(res=>{
    // Meme regle qu'au-dessus : la promesse part avant l'animation.
    const fermer=v=>{
      _rcSaisieFermer=null;
      ok.onclick=null; non.onclick=null; z.onclick=null; c.onkeydown=null; res(v);
      _feuilleFermer('rc-saisie'); };
    // La poignée que go() et rcSaisieFermer utilisent : une annulation.
    _rcSaisieFermer=()=>fermer(null);
    ok.onclick=()=>fermer(c.value);
    non.onclick=()=>fermer(null);
    c.onkeydown=e=>{ if(e.key==='Enter'){ e.preventDefault(); fermer(c.value); } };
    // Toucher le voile ANNULE, comme sur rcConfirm.
    z.onclick=e=>{ if(e.target===z) fermer(null); };
  });
}
async function finishWorkoutEarly(){
  // LE SEUL GESTE IRREVERSIBLE de l ecran de seance, et il jouxte « Exercice
  // suivant », qui est le geste normal. On demande confirmation, et on NOMME
  // ce qui se perd : un « Etes-vous sur ? » se valide sans lire.
  const fait=(()=>{ try{
    return Object.values((woState&&woState.sessionData)||{})
      .reduce((n,d)=>n+((d&&d.sets)||[]).filter(x=>x&&x.done).length,0);
  }catch(e){ return 0; } })();
  const msg=''
    +(fait
      ?('Tes '+fait+' série'+(fait>1?'s':'')+' validée'+(fait>1?'s':'')
        +' sont enregistrées, mais la séance sera terminée : pour la refaire, tu repartiras de zéro.')
      :'La séance sera terminée : pour la refaire, tu repartiras de zéro.');
  // TROIS ISSUES, DEPUIS LE 24/08/2026. Demande de Kevin : « les gens se
  // trompant de seance ». Ouvrir la mauvaise seance, s en apercevoir, et
  // n avoir que « Abandonner » sous la main, c est inscrire dans l historique
  // — et sur la fiche du coach — une seance commencee puis abandonnee qui n a
  // jamais eu lieu. La troisieme issue ferme la seance sans rien ecrire.
  //
  // LE MESSAGE NOMME CE QUE CHAQUE ISSUE FAIT, et il change selon qu il y a
  // des series validees ou non : quitter sans enregistrer EFFACE ces series,
  // et cela ne doit pas se decouvrir apres coup.
  const _quoi=fait
    ?('« Abandonner » termine la séance et garde tes '+fait+' série'
      +(fait>1?'s':'')+' dans ton historique.'+String.fromCharCode(10)
      +'« Quitter sans enregistrer » les efface : rien ne sera inscrit, ni sur '
      +'ton accueil, ni chez ton coach.')
    :('« Abandonner » termine quand même la séance : elle apparaîtra comme '
      +'commencée puis abandonnée.'+String.fromCharCode(10)
      +'« Quitter sans enregistrer » ne laisse aucune trace, ni sur ton accueil, '
      +'ni chez ton coach.');
  const choix=await rcConfirm3('Quitter la séance ?',msg+String.fromCharCode(10)
    +String.fromCharCode(10)+_quoi,
    'Abandonner','Quitter sans enregistrer','Annuler');
  if(choix===null) return;
  if(choix==='milieu') return quitterSeanceSansEnregistrer();
  localStorage.removeItem('rc_wo_state');
  finishWorkout(true);
}
// QUITTER SANS RIEN ECRIRE. C est le seul chemin de sortie qui ne passe PAS
// par finishWorkout, et c est tout l objet : finishWorkout pousse la seance
// dans currentUser.sessions puis appelle saveUser — c est de la que viennent
// la ligne sur l accueil et la seance visible par le coach.
//
// CE QU IL FAUT DEFAIRE MALGRE TOUT :
//   le minuteur de seance et celui de repos, qui repeignent un ecran quitte ;
//   le drapeau du service worker, pose a SEANCE_EN_COURS au lancement — sans
//     quoi il garde la seance pour en cours jusqu au prochain demarrage ;
//   l instantane rc_wo_state, sinon la seance est proposee a la reprise.
//
// woState.termine EST POSE, et c est un verrou, pas une decoration :
// finishWorkout sort en premiere ligne quand il le voit. Un appel tardif —
// une minuterie en vol, un retour d ecran — ne peut donc plus enregistrer ce
// qu on vient de decider de ne pas enregistrer.
//
// RIEN N A ETE ECRIT AU LANCEMENT qu il faille reprendre : launchWorkout ne
// touche ni currentUser.sessions ni saveUser. Il incremente un compteur
// anonyme, rcm('first_workout_started'), qui ne porte aucun identifiant et ne
// remonte a personne.
function quitterSeanceSansEnregistrer(){
  try{ _swSeance('SEANCE_TERMINEE'); }catch(e){}
  try{ _woLibererEcran(); }catch(e){}
  try{ localStorage.removeItem('rc_wo_state'); }catch(e){}
  if(woState){
    woState.termine=true;
    try{ clearInterval(woState.timerInterval); }catch(e){}
  }
  try{ annulerRepos(); }catch(e){}
  toast('Séance quittée. Rien n\'a été enregistré.');
  go('s-client-home');
  try{ loadClientHome(); }catch(e){}
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&woState?.exercises?.length) woPersist();
  if(document.hidden&&typeof _audioMediaRecorder!=='undefined'&&_audioMediaRecorder&&_audioMediaRecorder.state==='recording') cancelAudioAnnotation();
  // La réponse vocale au bilan : arrêtée et GARDÉE (le coach l'écoute au retour).
  if(document.hidden&&typeof _rv!=='undefined'&&_rv&&_rv.ctrl&&_rv.etat==='rec') _rv.ctrl.arreter();
  // CLOUD.push() attend 2 s avant d'envoyer (débounce). Masquer l'onglet dans
  // cette fenêtre — le réflexe normal après « Enregistrer » — gelait le timer :
  // l'envoi ne partait qu'au retour au premier plan, ou jamais si l'onglet
  // était fermé entre-temps. On vide donc la file d'attente immédiatement.
  if(document.hidden&&CLOUD._pushTimer){
    clearTimeout(CLOUD._pushTimer);
    CLOUD._pushTimer=null;
    const u=DB.get('users');
    if(u) CLOUD._doPush(u);
  }
});
window.addEventListener('beforeunload',()=>{
  if(typeof _audioMediaRecorder!=='undefined'&&_audioMediaRecorder&&_audioMediaRecorder.state==='recording'){
    try{_audioMediaRecorder.stop();}catch(e){}
  }
});

// slotIdx = l'index du créneau dans sessions_config, 0..6 pour lundi..dimanche.
// Il suit la séance jusqu'à l'historique : c'est lui qui permettra plus tard de
// ne suggérer une charge qu'à partir du MÊME jour (voir _memeCreneau).
// Nom affichable d'une séance. Le sélecteur appliquait déjà ce repli, mais lui
// seul : une séance laissée sans nom dans la configuration par défaut partait
// donc avec progName='' — titre vide en haut de l'écran de séance, et surtout
// une séance enregistrée sans nom dans l'historique.
// Le repli suit l'ordre de fiabilité : le nom saisi, sinon le jour porté par la
// configuration, sinon le jour déduit du créneau — ce dernier cas couvre les
// configurations anciennes où `day` manque.
function _nomSeance(sessConfig,slotIdx){
  const nom=(sessConfig&&sessConfig.name||'').trim();
  if(nom) return nom;
  const jour=(sessConfig&&sessConfig.day)
    ||((typeof slotIdx==='number'&&DAYS[slotIdx])||'');
  return jour?('Séance '+jour):'Séance';
}
// ══════ ILLUSTRATION D'EXERCICE ══════
// La vignette de l'encart CONSIGNE. Rend une chaîne VIDE quand il n'y a pas
// d'illustration : le texte reprend alors toute la largeur, et rien ne
// ressemble à une image qui n'a pas chargé.
//
// Une seule taille de fichier, et c'est délibéré : les illustrations font
// 267×150 px pour ~7,5 Ko. Servir une vignette séparée aurait ajouté 1,5 Mo
// au dépôt pour économiser trois kilo-octets par affichage. Mesuré au lot 1.
function _htmlVignetteExo(ex){
  const img=illustrationExo(ex);
  if(!img) return '';
  const nom=String((ex||{}).name||'');
  // Le slug d'abord : c'est lui qui a servi a trouver l'image.
  const ref=String((ex||{}).exSlug||'').trim()||nom;
  return `<button type="button" onclick="ouvrirIllustration('${escapeHtml(ref).replace(/'/g,"&#39;")}')"
    aria-label="Agrandir l'illustration de ${escapeHtml(nom)}"
    style="flex-shrink:0;padding:0;border:1px solid var(--border);border-radius:var(--r-2);
    background:#fff;cursor:zoom-in;line-height:0;width:96px;height:70px">
    <img src="${escapeHtml(img)}" alt="" loading="lazy" width="96" height="70"
      style="width:96px;height:70px;object-fit:cover;border-radius:var(--r-2);display:block"></button>`;
}
// La visionneuse plein écran. TROIS façons de fermer, comme demandé :
// toucher hors de l'image, la croix, et un glissement vers le bas. Trois
// parce qu'aucune n'est évidente pour tout le monde — et qu'une visionneuse
// dont on ne sait pas sortir est pire que pas de visionneuse.
const ILLUS_SEUIL_GLISSEMENT=60;   // px avant de considérer que c'est un geste
// `ref` est un NOM, ou un slug de fiche. La vignette passe le slug quand
// l'exercice en porte un : sans ca, un exercice mis a jour depuis la
// bibliotheque affichait sa photo et n'ouvrait rien au clic — la vignette
// resout par le slug, la visionneuse resolvait par le nom.
function ouvrirIllustration(ref){
  const r=String(ref||'').trim();
  const img=_illustrationParSlug(r)||illustrationDe(r);
  if(!img) return false;
  // LE TITRE SOUS L'IMAGE. Quand la reference est un slug, on le rend
  // lisible plutot que d'afficher « developpe-couche-barre » a l'ecran.
  const nom=/-/.test(r)&&!/\s/.test(r)?r.replace(/-/g,' ').toUpperCase():r;
  const ov=document.createElement('div');
  ov.id='illus-plein';
  ov.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);'
    +'display:flex;flex-direction:column;align-items:center;justify-content:center;'
    +'padding:20px;touch-action:none';
  ov.innerHTML='<button type="button" aria-label="Fermer" data-fermer="1"'
    +' style="position:absolute;top:calc(12px + env(safe-area-inset-top,0px));right:14px;'
    +'width:44px;height:44px;border-radius:var(--r-full);background:color-mix(in srgb,var(--text) 12.2%,transparent);border:none;color:var(--text);'
    +'font-size:var(--fs-xl);line-height:1;cursor:pointer">×</button>'
    +'<img src="'+escapeHtml(img)+'" alt="'+escapeHtml(String(nom||''))+'"'
    +' style="max-width:96vw;max-height:76vh;object-fit:contain;border-radius:var(--r-3);background:#fff">'
    +'<div style="font-size:var(--fs-sm);color:var(--text);font-weight:800;letter-spacing:.5px;'
    +'margin-top:14px;text-align:center">'+escapeHtml(String(nom||''))+'</div>'
    +'<div style="font-size:var(--fs-xs);color:#ffffff8a;margin-top:6px">Touche à côté, la croix, ou glisse vers le bas</div>';
  const fermer=()=>{ try{ ov.remove(); }catch(e){} };
  ov.addEventListener('click',e=>{
    // L'image elle-même ne ferme pas : on peut vouloir la regarder de près
    // sans que le moindre contact la fasse disparaître.
    if(e.target.tagName==='IMG') return;
    fermer();
  });
  let y0=null;
  ov.addEventListener('pointerdown',e=>{ y0=e.clientY; });
  ov.addEventListener('pointerup',e=>{
    if(y0!=null&&(e.clientY-y0)>ILLUS_SEUIL_GLISSEMENT) fermer();
    y0=null;
  });
  document.body.appendChild(ov);
  return true;
}

// ══════ APERÇU DE SÉANCE ══════
// Estimation de durée. Les hypothèses sont ÉCRITES, parce qu'un chiffre sans
// hypothèse se lit comme une promesse :
//   • 40 s par série effectuée — une série de musculation dépasse rarement
//     ce temps, échauffement et mise en place exclus ;
//   • le repos prescrit entre les séries, lu par parseRepos qui existe déjà ;
//   • le dernier repos de la séance n'est pas compté : on ne se repose pas
//     après avoir fini.
// C'est une estimation, l'écran le dit avec un « ~ ».
const APERCU_SEC_PAR_SERIE=40;
const APERCU_REPOS_DEFAUT=90;
// PURE. Rend {exercices, series, minutes} ou null si la séance est vide.
function resumeSeance(sess){
  const exos=((sess||{}).exercises)||[];
  if(!exos.length) return null;
  let series=0, sec=0;
  for(const ex of exos){
    const n=Math.max(1,parseInt(ex.series,10)||0);
    series+=n;
    let repos=parseRepos(ex.repos);
    if(!(repos>0)) repos=APERCU_REPOS_DEFAUT;
    sec+=n*APERCU_SEC_PAR_SERIE+(n-1)*repos;
    sec+=repos;                       // repos entre cet exercice et le suivant
  }
  let repos=parseRepos(exos[exos.length-1].repos);
  if(!(repos>0)) repos=APERCU_REPOS_DEFAUT;
  sec-=repos;                         // ...sauf après le dernier
  return {exercices:exos.length,series,minutes:Math.max(1,Math.round(sec/60))};
}
// PURE. « 3 × 10 » ou « 3 × 8-12 ». Le format des reps du coach est conservé
// tel quel : le normaliser ferait dire à l'écran autre chose que la fiche.
function _apSeriesReps(ex){
  const n=parseInt(ex.series,10);
  const r=String(ex.reps||'').trim();
  if(!n&&!r) return '';
  return (n?n:'?')+(r?(' × '+r):'');
}
let _apIdx=null;
// _renderApercu est appelee DEUX FOIS — une fois par ouvrirApercuSeance, une
// seconde apres la resolution de chargerIndexIllustrations. Une animation CSS
// rejouerait donc quelques centaines de ms plus tard, sous les yeux de
// l'athlete. D'ou le drapeau.
let _apAnime=false;
// L'aperçu remplace le lancement direct : startWorkoutSession y passe.
function ouvrirApercuSeance(idx){
  const cfg=currentUser.sessions_config||initSessionsConfig();
  const sess=cfg[idx];
  if(!sess||!(sess.exercises||[]).length){
    toast('Aucun exercice dans cette séance.','var(--red)'); return false;
  }
  _apIdx=idx;
  _apAnime=false;
  go('s-seance-apercu');
  _renderApercu();
  // Les illustrations arrivent après le premier rendu : l'écran s'affiche
  // tout de suite, les vignettes se posent ensuite.
  chargerIndexIllustrations().then(()=>{ if(_apIdx===idx) _renderApercu(); });
  return true;
}
function fermerApercu(){ _apIdx=null; _apAnime=false; go('s-client-home'); }
function commencerDepuisApercu(){
  const idx=_apIdx;
  if(idx==null) return false;
  const cfg=currentUser.sessions_config||initSessionsConfig();
  const sess=cfg[idx];
  if(!sess) return false;
  _apIdx=null;
  _apAnime=false;
  // LE SEUIL. arcDecharge peint sur #arc-calque (position:fixed,
  // pointer-events:none) : le halo survit au changement d'ecran et n'ajoute pas
  // une milliseconde au lancement — demarrerSeance part immediatement apres.
  // C'est la regle 7 : l'animation cede, jamais l'action.
  try{
    const b=document.querySelector('#s-seance-apercu .btn-red');
    if(b) arcDecharge(b,{haptique:'moyenne',couleur:'var(--arc-current)'});
  }catch(e){}
  demarrerSeance(sess,idx);
  return true;
}
// Une ligne dépliable. <details> natif : il gère le clavier, le lecteur
// d'écran et l'état ouvert/fermé sans une ligne de JavaScript.
function _apLigne(ex,i){
  const img=illustrationExo(ex);
  const sr=_apSeriesReps(ex);
  // Lignes zébrées et valeur en gras : déplié, ce panneau se lit debout entre
  // deux séries, pas assis au calme.
  const l=(t,v)=>v?`<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;
      font-size:var(--fs-sm);padding:6px 2px;border-top:1px solid color-mix(in srgb,var(--text) 5%,transparent)">`
    +`<span style="color:var(--sub);letter-spacing:.4px">${escapeHtml(t)}</span>`
    +`<span style="color:var(--text);font-weight:800;text-align:right">${escapeHtml(String(v))}</span></div>`:'';
  // `ex.note` a disparu d'ici : TROIS lectures, et aucun champ ne l'écrivait.
  // Le seul écrivain était la chaîne d'import legacy, qui posait une chaîne
  // VIDE dans un chemin fermé par LEGACY_PDF_IMPORT. `ex.description` fait le
  // même travail, et lui est saisissable.
  const note=(ex.description||'').trim();
  // LA VIGNETTE S'AGRANDIT AU DOIGT. Demande de Kevin, 25/08/2026 : « quand
  // les gens arrivent sur la liste des exos de la séance, la possibilité
  // d'agrandir l'image en cliquant dessus ». La visionneuse plein écran
  // existait déjà — elle servait l'encart CONSIGNE pendant la séance ; il n'y
  // avait qu'à lui donner cette entrée-là.
  //
  // LE CLIC NE DOIT PAS DÉPLIER LA LIGNE. Le bouton vit dans le <summary> d'un
  // <details> : sans preventDefault, chaque agrandissement ouvrirait ou
  // refermerait la fiche derrière la visionneuse, et on la retrouverait dans
  // l'autre état en fermant. stopPropagation seul n'y suffit pas — c'est le
  // comportement natif du <summary> qu'il faut couper, pas la remontée.
  //
  // LA VIGNETTE NE RECADRE PLUS. `cover` coupait les bords de chaque
  // illustration : sur un pendulum squat, la machine sortait du cadre et il ne
  // restait qu'un morceau de cuisse. `contain` montre l'image ENTIÈRE, quitte
  // à laisser du blanc autour, et le carré passe de 52×38 à 76×76 — c'est la
  // vignette qu'on reconnaît d'un coup d'œil en salle, pas une décoration.
  const _nomEx=String(ex.name||'');
  const vign=img
    ? `<button type="button" onclick="event.preventDefault();event.stopPropagation();ouvrirIllustration('${escapeHtml(String(ex.exSlug||'').trim()||_nomEx).replace(/'/g,"&#39;")}')"
         aria-label="Agrandir l'illustration de ${escapeHtml(_nomEx)}"
         style="position:relative;flex-shrink:0;width:76px;height:76px;padding:0;
         border-radius:var(--r-3);background:transparent;cursor:zoom-in;
         border:1px solid color-mix(in srgb,var(--text) 10%,transparent);overflow:hidden;line-height:0">
        <img src="${escapeHtml(img)}" alt="" loading="lazy" width="76" height="76"
          style="width:100%;height:100%;object-fit:contain;display:block">
        <span aria-hidden="true" style="position:absolute;right:3px;bottom:3px;
          width:17px;height:17px;border-radius:var(--r-1);background:rgba(0,0,0,.62);
          color:var(--text);font-size:11px;line-height:17px;text-align:center">⤢</span></button>`
    : `<div style="flex-shrink:0;width:76px;height:76px;border-radius:var(--r-3);
         background:linear-gradient(145deg,var(--surface-2),var(--surface-0));border:1px solid var(--border);
         display:flex;align-items:center;justify-content:center;color:var(--border);
         box-shadow:inset 0 1px 0 rgba(255,255,255,.04)">${icon('dumbbell',26)}</div>`;
  return `<details style="position:relative;background:linear-gradient(180deg,var(--surface-2),var(--surface-1));
    border:1px solid var(--border);border-left:1px solid var(--border);border-radius:var(--r-3);
    margin-bottom:10px;overflow:hidden;
    box-shadow:var(--e2)">
    <div style="position:absolute;inset:0;pointer-events:none;
      background:none"></div>
    <summary style="position:relative;display:flex;align-items:center;gap:12px;padding:12px 12px;
      cursor:pointer;list-style:none;min-height:56px">
      <span style="flex-shrink:0;width:22px;font-family:var(--pile-titre);
        font-size:var(--fs-xl);line-height:1;color:var(--red-text);--halo-c:color-mix(in srgb,var(--red) 75%,transparent);text-shadow:var(--halo-1);
        text-align:center">${i+1}</span>
      ${vign}
      <div style="flex:1;min-width:0">
        <div style="font-weight:900;font-size:var(--fs-md);line-height:1.25;letter-spacing:.2px;
          text-transform:uppercase;color:var(--text)">${escapeHtml(ex.name||'Exercice '+(i+1))}</div>
        ${sr?`<div style="display:inline-block;margin-top:6px;padding:4px 10px;border-radius:var(--r-2);
          background:color-mix(in srgb,var(--red) 12%,transparent);border:1px solid color-mix(in srgb,var(--red) 32%,transparent);
          font-size:var(--fs-sm);font-weight:800;color:var(--red-text);letter-spacing:.5px">${escapeHtml(sr)}</div>`:''}
      </div>
      <span style="color:var(--sub);font-size:var(--fs-lg);flex-shrink:0;width:22px;text-align:center">▾</span>
    </summary>
    <div style="position:relative;padding:2px 14px 14px 14px;border-top:1px solid color-mix(in srgb,var(--text) 7%,transparent);
      background:rgba(0,0,0,.28)">
      ${l('Séries',ex.series)}
      ${l('Répétitions',ex.reps)}
      ${l('Repos',ex.repos)}
      ${l('Tempo',ex.tempo?((tempoPhrase(ex.tempo)?ex.tempo+' : '+tempoPhrase(ex.tempo):ex.tempo)):'')}
      ${l('Technique',_libTechniqueSeries(ex))}
      ${l('Matériel',ex.materiel)}
      ${l('Charge cible',_chargePrescrite(ex))}
      ${l('RIR',_rirPrescrit(ex))}
      ${note?`<div style="margin-top:8px;font-size:var(--fs-sm);color:#bbb;line-height:1.6;
        border-left:2px solid var(--border);padding-left:10px">${escapeHtml(note)}</div>`:''}
      <!-- LA VIDEO DU GUIDE ARRIVE JUSQU'ICI. Cet ecran n'en montrait aucune :
           un athlete qui prepare sa seance la veille n'avait nulle part ou
           verifier l'execution d'un mouvement qu'il ne connait pas. -->
      ${htmlVideosExo(ex)}
    </div>
  </details>`;
}
function _renderApercu(){
  const z=document.getElementById('ap-contenu');
  if(!z||_apIdx==null) return false;
  const cfg=currentUser.sessions_config||[];
  const sess=cfg[_apIdx];
  if(!sess) return false;
  const t=document.getElementById('ap-titre');
  if(t) t.textContent=_nomSeance(sess,_apIdx);
  const r=resumeSeance(sess);
  // Les trois chiffres passent en Bebas avec halo, comme les compteurs de la
  // diète et les scores : c'est la typographie que l'app donne déjà à ses
  // nombres, et elle se lit d'un mètre. La durée est la tuile ROUGE — c'est la
  // seule des trois qui décide si on a le temps de faire la séance maintenant.
  // La trame, le relief et le halo vivent desormais dans .stat-tile : le
  // gabarit ne porte plus que la donnee, et le div de trame interpose n'a plus
  // de raison d'etre.
  const chiffre=(v,lib,fort)=>`<div class="stat-tile${fort?' stat-tile--fort':''}">
    <div class="st-val">${escapeHtml(String(v))}</div>
    <div class="st-lbl">${escapeHtml(lib)}</div></div>`;
  const notes=(sess.notes||'').trim();
  z.innerHTML=
    // LA SEULE SURFACE D'AFFICHAGE DE LA DISPONIBILITE, et elle rend '' tant
    // que le drapeau est vert — c'est-a-dire presque toujours. Le silence est
    // l'etat normal : « le seul logiciel de coaching qui sait se taire ».
    (()=>{ try{ return _htmlDispo(_apIdx); }catch(e){ return ''; } })()
    +`<div style="display:flex;gap:8px;margin:12px 0 14px">
      ${chiffre(r?r.exercices:0,'exercices')}
      ${chiffre(r?r.series:0,'séries')}
      ${chiffre(r?('~'+r.minutes+' min'):'-','durée',true)}
    </div>`
    +(notes?`<div style="background:var(--surface-1);border:1px solid var(--border);
      border-left:1px solid var(--border);border-radius:0 var(--r-3) var(--r-3) 0;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:1.5px;font-weight:800;
      text-transform:uppercase;margin-bottom:4px">Mot de ton coach</div>
      <div style="font-size:var(--fs-sm);color:#bbb;line-height:1.65">${escapeHtml(notes)}</div></div>`:'')
    +(sess.exercises||[]).map(_apLigne).join('');
  // LES LIGNES ENTRENT EN CASCADE, une seule fois par ouverture. Plafonnee a
  // six : une seance de quatorze exercices ne doit pas mettre 760 ms a devenir
  // lisible. fill:'backwards' et non 'both' — les lignes sont invisibles
  // pendant leur delai mais reprennent leur style de feuille a la fin, sans
  // quoi un <details> qui s'ouvre garderait un transform fige.
  if(!_apAnime){
    _apAnime=true;
    if(typeof arcReduit==='function'&&!arcReduit()){
      Array.prototype.slice.call(z.querySelectorAll(':scope > details')).forEach((el,i)=>{
        _animer(el,[{transform:'translateY(10px)',opacity:0},{transform:'translateY(0)',opacity:1}],
          {duration:200,delay:Math.min(i,5)*40,easing:ARC.discharge,fill:'backwards'});
      });
    }
  }
  return true;
}
function launchWorkout(sessConfig,slotIdx){
  if(!sessConfig?.exercises?.length){toast('Aucun exercice dans cette séance.','var(--red)');return;}
  // APRÈS le garde : une séance avortée ne doit pas bloquer une mise à jour.
  _swSeance('SEANCE_EN_COURS');
  // L'écran reste allumé pendant la séance (réglage ecranAllume).
  try{ _woVerrouEcran(); }catch(e){}
  // « Première » déduit de l'historique réel, jamais d'un drapeau local : un
  // drapeau se perdrait au changement d'appareil et recompterait la même
  // première séance. Après le garde ci-dessus, pour ne pas compter un
  // lancement qui n'a pas eu lieu.
  if(!(currentUser.sessions||[]).length) rcm('first_workout_started');
  // Après le garde, et non en toute première ligne : un lancement avorté doit
  // laisser intacte la séance déjà en cours. Placé avant, il tuerait l'horloge
  // d'un entraînement que woState continue par ailleurs de décrire, et le
  // chrono se figerait à l'écran.
  // Ici, en revanche, c'est le dernier instant où l'ancien intervalle est
  // encore joignable : la ligne suivante remplace woState en bloc et sa
  // référence est perdue à jamais — l'intervalle, lui, continue de battre.
  if(woState?.timerInterval) clearInterval(woState.timerInterval);
  // Nouvelle séance : checklist vierge, sinon les étapes cochées la fois
  // précédente réapparaissent déjà faites.
  _ckEtat={};_ckStopChrono();
  // Et badges de record vierges, pour exactement la même raison : le Set est
  // indexé par « exercice : série », donc un record posé sur 0:1 la fois
  // d'avant se rallumait sur la première série du premier exercice de
  // celle-ci. APRÈS le garde, comme le clearInterval ci-dessus : un
  // lancement avorté ne doit rien effacer d'une séance encore en cours.
  _resetRecordsVus();
  // AUCUNE RÈGLE DE CYCLE NE TOUCHE UN NOMBRE DE SÉRIES. Le programme du
  // coach arrive intact. Le défaut à 3 séries est conservé : il vaut pour un
  // exercice mal saisi, pas pour une phase.
  const exercises=sessConfig.exercises.map(ex=>({
    ...ex,
    series:Math.max(1,ex.series||3)
  }));
  // L'ALLEGEMENT DU JOUR SE CONSOMME ICI, sur la COPIE de travail. Toucher
  // sessConfig alleg erait tous les mardis suivants : le programme du coach
  // n'est pas la memoire d'une mauvaise nuit.
  const _slotAl=(typeof slotIdx==='number'&&slotIdx>=0&&slotIdx<=6)?slotIdx:null;
  try{ _dispoConsommerAllegement(exercises,_slotAl); }catch(e){}
  const _slot=(typeof slotIdx==='number'&&slotIdx>=0&&slotIdx<=6)?slotIdx:null;
  woState={exercises,currentEx:0,startTime:Date.now(),timerInterval:null,sessionData:{},
    progName:_nomSeance(sessConfig,_slot),sessionPhoto:sessConfig.photo||null,
    // Cochée à la main par le coach, OU planifiée dans le bloc : les deux
    // valent décharge. Sans cette seconde branche, une semaine prévue en
    // décharge n'allumait pas le bandeau et ses séances restaient comptées
    // dans la détection de plateau.
    // RETOUR DE SUSPENSION : proposition, decochable. Elle ne touche pas
    // sessions_config, qui appartient au coach.
    deload:!!sessConfig.deload||semaineEstDecharge(currentUser)||repriseDeloadPropose(currentUser)||repriseDouceActive(currentUser),
    // LA REPRISE EN DOUCEUR acceptée : charges suggérées -10 % (voir _decote).
    repriseDouce:repriseDouceActive(currentUser),
    // Une demande du coach vaut case cochée d'avance. Amorcée ICI et non à
    // chaque rendu : sans quoi un décochage serait réécrit à la seconde
    // suivante et l'athlète n'aurait pas la main.
    aFilmer:exercises.filter(ex=>!isCardio(ex)&&demandeVideoPour(ex.name,currentUser))
      .map(ex=>ex.name),
    slot:_slot,
    // L'échauffement et la fin de séance étaient écrits par le coach depuis
    // toujours, et n'étaient affichés NULLE PART à l'athlète : ils vivaient
    // uniquement dans la zone de texte de l'éditeur. On les embarque pour
    // pouvoir enfin les montrer, au début et à la fin de la séance.
    // ?? et non || : sessConfig a déjà appliqué le protocole par défaut avec
    // la même règle. Un champ vidé volontairement par le coach doit rester
    // vide, pas se faire remplir par le défaut au lancement.
    warmup:String(sessConfig.warmup??currentUser._defaultWarmup??'').trim(),
    cooldown:String(sessConfig.cooldown??currentUser._defaultCooldown??'').trim()};
  // LE RECORD À PORTÉE : calculé une fois, au lancement, sur l'historique
  // d'avant la séance. Rien en décharge (recordAPortee le vérifie aussi).
  try{ woState.objectif=woState.deload?null:recordAPortee(currentUser,sessConfig); }catch(e){ woState.objectif=null; }
  woState.timerInterval=setInterval(()=>{
    const el=Math.floor((Date.now()-woState.startTime)/1000);
    document.getElementById('wo-timer').textContent=fmtDureeSeance(el);
  },1000);
  go('s-workout');
  document.getElementById('wo-title').textContent=woState.progName;
  renderWoEx();
}

// ======= PROGRAM VIEW =======
let _selDay=null;
function _setWeekDay(i){_selDay=i;if(window._weekProgEl)_renderProgExercisesInto(window._weekProgEl);}
// ══ LE NETTOYAGE DES FONDATIONS POSEES D'OFFICE ══════════════════════════
//
// ⚠ CETTE FONCTION S'APPELAIT _migrateFoundationIfNeeded, ET ELLE FAISAIT
// L'INVERSE : elle POSAIT la Fondation des que le genre devenait connu. C'est
// le TROISIEME chemin de pose automatique, et il avait survecu au lot du
// 16/09/2026 qui a ferme les deux autres — parce qu'il ne cite pas FONDATION,
// il appelle initSessionsConfig.
//
// Demande de Kevin, 16/09/2026 : « tous les gens connectes actuellement avec
// le programme debutant, clean le programme et laisse le modele vide. »
//
// ⚠ ON NE NETTOIE QUE CE QUE PERSONNE N'A TOUCHE, et c'est la seule chose qui
// compte ici. Effacer par erreur des semaines de travail est exactement le
// defaut que ce fichier documente a cinq endroits. Trois conditions, toutes
// necessaires :
//   1. la grille porte encore un marqueur — _foundation ou _essai. Les deux
//      tombent des que quelqu'un personnalise une seance, et _marquerCommePublie
//      retire _foundation a la publication : un programme de coach est donc
//      protege par construction ;
//   2. il y a quelque chose a nettoyer — au moins une seance active et garnie ;
//   3. le CONTENU est encore celui d'une Fondation, seance par seance et
//      exercice par exercice. Un marqueur oublie quelque part ne suffit pas.
//
// ET LE GESTE EST REVERSIBLE : _pushSessionsHistory pose la grille d'avant
// dans l'historique, d'ou elle se restaure.
//
// PURE. La grille est-elle une Fondation que personne n'a touchee ?
function _estFondationPosee(sc){
  if(!Array.isArray(sc)||!sc.length) return false;
  const garnies=sc.filter(s=>s&&s.active&&(s.exercises||[]).length);
  if(!garnies.length) return false;
  if(!sc.some(s=>s&&(s._foundation===true||s._essai===true))) return false;
  // La signature : les seances actives et garnies, dans l'ordre, avec les noms
  // de leurs exercices. Comparer les objets ne marcherait pas — un dossier
  // revenu du reseau a perdu ses trous et gagne des champs.
  const sig=l=>(l||[]).filter(x=>x&&x.active&&(x.exercises||[]).length)
    .map(x=>String(x.name||'')+'|'+(x.exercises||[]).map(e=>String(e.name||'')).join('~'))
    .join('#');
  const a=sig(sc);
  return a===sig(FONDATION_H)||a===sig(FONDATION_F);
}
// IDEMPOTENTE PAR CONSTRUCTION : une fois la grille vidée, la condition 2 ne
// tient plus et la fonction ne fait plus rien. Aucun drapeau a stocker.
function _nettoyerFondationPosee(){
  if(!currentUser) return false;
  _adopterProgrammeStocke();
  if(!_estFondationPosee(currentUser.sessions_config)) return false;
  _pushSessionsHistory(currentUser);   // rollback depuis l'historique
  currentUser.sessions_config=_seancesViergesSemaine();
  currentUser.sessions_config.forEach(x=>{ x._essai=true; });
  saveUser();
  return true;
}
// ══════ LES VIDÉOS D'UN EXERCICE, TELLES QU'ON DOIT LES MONTRER ══════
// Demande de Kevin, 25/08/2026 : « les élèves affiliés à un coach qui utilise
// déjà l'application, mets à jour leurs programmes avec les bonnes images et
// liens vidéo ».
//
// RIEN N'EST RÉÉCRIT DANS LES DOSSIERS, ET C'EST TOUT L'INTÉRÊT. La vidéo se
// résout PAR LE NOM au moment de l'affichage, exactement comme l'illustration
// le fait déjà (voir illustrationDe). Publier un guide à jour met donc à jour
// tous les programmes déjà en circulation d'un coup, sans migration, sans
// écriture, et sans qu'un athlète hors ligne se retrouve avec un dossier à
// moitié converti. Un guide corrigé demain les corrigera tous de la même façon.
//
// LE LIEN POSÉ PAR LE COACH GAGNE TOUJOURS. Il vise une exécution précise,
// parfois filmée pour cet athlète-là ; une correspondance de nom ne doit
// jamais passer devant. C'est la même règle que celle de l'ancien import.
//
// ══ LE SECOND LIEN N'EST PAS UNE DEUXIEME DEMO ══════════════════════════
//
// Regle du coach, posee le 07/09/2026 : sur un exercice, le PREMIER lien est
// toujours l'exercice ; le SECOND est la video de la METHODE D'INTENSIFICATION
// prescrite sur cet exercice-la. Ce n'est pas la meme chose, ca ne se regarde
// pas au meme moment, et l'afficher comme « VIDEO 2 » faisait croire a une
// seconde prise de vue du meme mouvement.
//
// `videoUrl2` CHANGE DONC DE SENS, PAS DE VALEUR. Aucun dossier n'est reecrit,
// et c'est tout l'interet : le champ garde ce qu'il contient, c'est son
// INTERPRETATION a l'affichage qui change — exactement comme la resolution par
// nom l'a fait pour les images et les videos du guide. Un dossier ecrit hier
// et un dossier ecrit demain se lisent de la meme facon, sans migration, sans
// ecriture, et sans qu'un athlete hors ligne se retrouve a moitie converti.
//
// LA VIDEO DE METHODE S'AJOUTE, ELLE NE REMPLACE JAMAIS. Un exercice sans
// methode rend exactement ce qu'il rendait avant ce lot.
//
// QUATORZE METHODES SUR QUARANTE-TROIS N'ONT PAS DE VIDEO dans le guide, et
// c'est un etat normal : aucune pastille n'est alors rendue. Une pastille qui
// n'ouvre rien est pire que pas de pastille.
function videoMethodeExo(ex){
  const m=(ex&&ex.methode&&TECHNIQUES[ex.methode])||null;
  // Le lien pose A LA MAIN par le coach gagne, ici aussi : il vise une
  // execution precise, parfois filmee pour cet athlete-la.
  let u=''; try{ u=normaliserUrlVideo((ex||{}).videoUrl2); }catch(e){ u=''; }
  if(u) return {url:u,lbl:m?m.nom:'Méthode',guide:false,methode:true};
  if(!m) return null;
  const v=videoTechnique(m);
  return v?{url:v,lbl:m.nom,guide:true,methode:true}:null;
}
function videosExo(ex){
  const sortie=(()=>{
    // videoUrl SEUL est la video d'exercice posee a la main. videoUrl2 ne
    // l'est plus : il est traite plus bas, comme video de methode.
    let u=''; try{ u=normaliserUrlVideo((ex||{}).videoUrl); }catch(e){ u=''; }
    if(u) return [{url:u,lbl:'',guide:false,methode:false}];
    // LE SLUG D'ABORD quand l'exercice en porte un : « Mettre a jour » garde le
    // nom du coach, et c'est le slug qui dit de quelle fiche du guide il s'agit.
    try{
      const parSlug=videosPourSlug((ex||{}).exSlug);
      if(parSlug.length) return parSlug.map(v=>({url:v.url,lbl:v.lbl||'',guide:true,methode:false}));
    }catch(e){}
    try{
      return videosPour((ex||{}).name).map(v=>({url:v.url,lbl:v.lbl||'',guide:true,methode:false}));
    }catch(e){ return []; }
  })();
  let m=null; try{ m=videoMethodeExo(ex); }catch(e){ m=null; }
  return m?sortie.concat([m]):sortie;
}
// Les pastilles. Rendent une chaîne VIDE sans vidéo : un rang de boutons morts
// dirait qu'il y a quelque chose à regarder.
function htmlVideosExo(ex){
  const v=videosExo(ex);
  if(!v.length) return '';
  // ⚠ LE COMPTE QUI DECIDE D'AFFICHER LES LIBELLES EST CELUI DES VIDEOS
  // D'EXERCICE, PAS LE TOTAL. Sinon l'arrivee d'une pastille de methode ferait
  // apparaitre « PRISE SERREE » sur un exercice qui n'a qu'une seule prise de
  // vue — un libelle qui n'a de sens que s'il distingue deux versions.
  const nbExo=v.filter(x=>!x.methode).length;
  // Le libellé du guide ne s'affiche que s'il y a DEUX versions à distinguer.
  // Seul, « prise serrée » sur l'unique vidéo d'un exercice n'apprend rien.
  const nommer=(x,i)=>x.methode?('MÉTHODE · '+x.lbl.toUpperCase())
    :((nbExo>1&&x.lbl)?x.lbl.toUpperCase():('VIDÉO '+(i+1)));
  // LA PASTILLE DE METHODE PORTE L'ORANGE, celui qui marque deja les techniques
  // partout ailleurs — la case de superset, le bandeau d'avertissement. Les
  // deux teintes viennent des variables du fichier : --warning-bg et
  // --warning-border sont les exactes contreparties orange du #1a0000/#3a0a0a
  // des pastilles d'exercice. Aucune couleur neuve n'est posee en dur.
  const fond=x=>x.methode?'var(--warning-bg)':'#1a0000';
  const trait=x=>x.methode?'var(--warning-border)':'#3a0a0a';
  const encre=x=>x.methode?'var(--orange)':'var(--red-light)';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">`
    +v.map((x,i)=>`<a href="${safeUrl(x.url)}" target="_blank" rel="noopener"
        style="display:inline-flex;align-items:center;gap:6px;background:${fond(x)};
        border:1px solid ${trait(x)};border-radius:var(--r-2);padding:6px 10px;
        color:${encre(x)};font-size:var(--fs-xs);font-weight:800;
        text-decoration:none;letter-spacing:1px">${escapeHtml(nommer(x,i))}</a>`).join('')
    +`</div>`;
}

function _renderExCard(ex,idx){
  const pr=parseReps(ex.reps);
  const badge=pr.type==='degressive'?`<span style="background:#3a0a00;color:#fca5a5;padding:2px 8px;border-radius:var(--r-1);font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;text-transform:uppercase">DÉGRESSIVE</span>`:
    pr.type==='unilateral'?`<span style="background:#0a1a30;color:#93c5fd;padding:2px 8px;border-radius:var(--r-1);font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;text-transform:uppercase">UNILATÉRAL</span>`:'';
  return `<div class="exercise-card"><div style="padding:12px 14px;display:flex;align-items:flex-start;gap:10px;border-bottom:1px solid #181818">
    <div style="width:28px;height:28px;background:var(--red);border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;flex-shrink:0;color:var(--text)">${idx+1}</div>
    <div style="flex:1">
      <div class="ex-name">${escapeHtml(ex.name)}</div>
      <!-- N6.3 : LA CONSIGNE D'INTENSITE ARRIVE JUSQU'A L'ATHLETE. Sans cela,
           le coach l'ecrirait pour lui-meme : le decrochage ne mesurait qu'un
           nombre de series, jamais un effort. Rien ne s'affiche quand il n'y a
           pas de consigne. -->
      <div class="ex-detail" style="margin-top:4px">${ex.series} séries · ${escapeHtml(ex.reps)} reps${ex.repos?' · '+escapeHtml(ex.repos):''}${_rirPrescrit(ex)?' · RIR '+escapeHtml(_rirPrescrit(ex)):''}</div>
      ${badge?`<div style="margin-top:6px">${badge}</div>`:''}
      ${ex.description?`<div style="font-size:var(--fs-xs);color:var(--text-faint);margin-top:6px;line-height:1.5;border-left:2px solid var(--border);padding-left:8px">${escapeHtml(ex.description)}</div>`:''}
      ${ex.reglageCoach?`<div class="ex-reglage" style="font-size:var(--fs-xs);color:var(--text);margin-top:6px;line-height:1.5;border-left:1px solid var(--border);padding-left:8px"><b>Réglage du coach :</b> ${escapeHtml(ex.reglageCoach)}</div>`:''}
      ${htmlVideosExo(ex)}
    </div>
  </div></div>`;
}
// ══════════════ SEANCE DU JOUR : L IMAGE A PARTAGER ══════════════════════
const STORY_L=1080, STORY_H=1920;   // 9:16, le format des stories
