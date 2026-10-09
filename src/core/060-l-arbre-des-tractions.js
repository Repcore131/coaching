// ══ L'ARBRE DES TRACTIONS : TEST GUIDÉ ET COMPÉTENCES (09/10/2026, build 1955) ══
//
// Deux choses, reliées :
//   1. LE TEST DE TRACTIONS GUIDÉ (s-test-tractions). Paliers de 1, 2, 3…
//      répétitions, 30 s de repos entre deux paliers, jusqu'à l'échec ; le
//      total donne un niveau (niveauTractions), le niveau ouvre un programme
//      modèle de trois séances A/B/C. Un rappel revient 4 semaines plus tard.
//   2. L'ARBRE (s-arbre-tractions). Dix nœuds, de la suspension au muscle-up,
//      chacun avec un critère et ses prérequis. Un nœud se valide par saisie
//      (la règle « propre » rappelée et cochée) ou par vidéo, lue sur
//      l'appareil par motion-lab (mlMesuresCompat 'traction' : amplitude,
//      épaules, menton, kipping) ; validé en vidéo, il est « certifié ».
//
// LES VOLTS NE S'ÉCRIVENT PAS ICI. xpCalcul les compte (catégorie `arbre`,
// XP_ACTIONS.noeud par nœud, hors plafond du jour) depuis le dossier, et le
// Worker les BORNE (cloudflare/src/xp.js, XP.noeud × nœuds connus). Les deux
// badges (arbre_5, arbre_10) sont dans BADGES_ACQUIS et dans le motif des
// règles, comme les autres.
//
// LE DOSSIER : u.arbreTractions = {noeuds:{<cle>:{at, mode, valeur, certifie}},
// tests:[{at, total, paliers, niveau}]}. Liste blanche fermée côté règles
// (database.rules.json) : arbreEntreeNoeud et arbreEntreeTest bornent AVANT
// d'écrire, sinon c'est le dossier entier qui serait refusé.
//
// ⚠ RÉTROGRADATION IMPOSSIBLE. Un nœud validé le reste ; un nœud certifié ne
//   redevient pas « par saisie » ; le programme débloqué est celui du MEILLEUR
//   niveau atteint, un test moins bon ne le reprend pas.

// ── LE TEST ──────────────────────────────────────────────────────────────────
const TEST_TRACTIONS_REPOS_S=30;
const TEST_TRACTIONS_RAPPEL_J=28;
const TEST_TRACTIONS_PALIERS_MAX=30;
const TEST_TRACTIONS_HISTO=12;
const NIVEAUX_TRACTIONS=Object.freeze(['debutant','intermediaire','avance','expert']);
const NIVEAU_TRACTIONS_LIB=Object.freeze({debutant:'Débutant',intermediaire:'Intermédiaire',avance:'Avancé',expert:'Expert'});
/**
 * PURE. Le total d'un test par paliers : chaque palier réussi compte ses
 * répétitions (1 + 2 + … + n), et le palier manqué celles faites avant l'échec.
 * @param {number} paliersReussis
 * @param {number} repsEchec
 * @returns {number}
 */
function totalTestTractions(paliersReussis,repsEchec){
  const n=Math.max(0,Math.min(TEST_TRACTIONS_PALIERS_MAX,Math.floor(Number(paliersReussis)||0)));
  // On ne peut pas faire, au palier manqué, autant que ce palier demandait.
  const e=Math.max(0,Math.min(n,Math.floor(Number(repsEchec)||0)));
  return n*(n+1)/2+e;
}
/**
 * PURE. Le niveau d'après le total du test : ≤ 3 débutant, ≤ 10
 * intermédiaire, ≤ 20 avancé, au-delà expert.
 * @param {number} total
 * @returns {'debutant'|'intermediaire'|'avance'|'expert'}
 */
function niveauTractions(total){
  const t=Math.max(0,Number(total)||0);
  if(t<=3) return 'debutant';
  if(t<=10) return 'intermediaire';
  if(t<=20) return 'avance';
  return 'expert';
}
/**
 * PURE. Le meilleur niveau atteint (jamais rétrogradé), ou null.
 * @param {any} u
 * @returns {string|null}
 */
function niveauTractionsAtteint(u){
  const l=_arbreTests(u);
  let best=-1;
  for(const t of l){ const i=NIVEAUX_TRACTIONS.indexOf(t.niveau); if(i>best) best=i; }
  return best>=0?NIVEAUX_TRACTIONS[best]:null;
}
/**
 * PURE. Le prochain test : 28 jours après le dernier. {at, du} ; null sans test.
 * @param {any} u
 * @param {number} [maintenant]
 */
function prochainTestTractions(u,maintenant){
  const l=_arbreTests(u);
  if(!l.length) return null;
  const der=Math.max(...l.map(t=>Number(t.at)||0));
  const at=der+TEST_TRACTIONS_RAPPEL_J*864e5;
  const t=Number(maintenant)||Date.now();
  return {at,du:t>=at,jours:Math.max(0,Math.ceil((at-t)/864e5))};
}
/** @param {any} u */
function _arbreTests(u){
  const a=u&&u.arbreTractions&&typeof u.arbreTractions==='object'?u.arbreTractions:null;
  const l=a&&a.tests?(Array.isArray(a.tests)?a.tests:Object.values(a.tests)):[];
  return l.filter(t=>t&&Number(t.at)>0);
}
/**
 * PURE. L'entrée de test, bornée comme les règles l'exigent.
 * @param {number} paliers @param {number} repsEchec @param {number} at
 */
function arbreEntreeTest(paliers,repsEchec,at){
  const p=Math.max(0,Math.min(TEST_TRACTIONS_PALIERS_MAX,Math.floor(Number(paliers)||0)));
  const total=totalTestTractions(p,repsEchec);
  return {at:Math.round(Number(at)||Date.now()),total,paliers:p,niveau:niveauTractions(total)};
}

// LES PROGRAMMES MODÈLES, un par niveau (l'expert reprend l'avancé).
// ⚠ CONTENU DE TRAVAIL, À REMPLACER PAR CELUI DU LIVRE : le livre n'est pas
//   dans le dépôt. Les séances A/B/C ci-dessous suivent la progression de
//   l'arbre (mêmes exercices de la banque) pour que l'écran fonctionne ; leur
//   texte est à reprendre mot pour mot quand Kevin le fournit.
const PROGRAMMES_TRACTIONS=Object.freeze({
  debutant:Object.freeze({nom:'Tractions · débutant',seances:Object.freeze([
    Object.freeze({cle:'A',nom:'Séance A · bases',exercises:Object.freeze([
      {name:'TRACTIONS',series:3,reps:'20',repos:'90 s',note:'Suspension bras tendus, 20 à 30 s'},
      {name:'ROWING INVERSE',series:3,reps:'8-12',repos:'90 s'},
      {name:'TRACTIONS',series:3,reps:'10',repos:'90 s',note:'Tirages scapulaires, bras tendus'}])}),
    Object.freeze({cle:'B',nom:'Séance B · assistance',exercises:Object.freeze([
      {name:'TRACTIONS ELASTIQUE',series:4,reps:'5-6',repos:'2 min'},
      {name:'ROWING INVERSE',series:3,reps:'10-12',repos:'90 s'}])}),
    Object.freeze({cle:'C',nom:'Séance C · tension',exercises:Object.freeze([
      {name:'TRACTIONS',series:3,reps:'3',repos:'2 min',note:'Isométries : haut, milieu, bas, 10 s chacune'},
      {name:'TRACTIONS MACHINE ASSISTE',series:3,reps:'8',repos:'90 s'}])})])}),
  intermediaire:Object.freeze({nom:'Tractions · intermédiaire',seances:Object.freeze([
    Object.freeze({cle:'A',nom:'Séance A · excentriques',exercises:Object.freeze([
      {name:'TRACTIONS',series:5,reps:'3',repos:'2 min',note:'Descente en 5 s'},
      {name:'ROWING INVERSE',series:3,reps:'12',repos:'90 s'}])}),
    Object.freeze({cle:'B',nom:'Séance B · volume',exercises:Object.freeze([
      {name:'TRACTIONS',series:5,reps:'2-4',repos:'2 min'},
      {name:'TRACTIONS ELASTIQUE',series:3,reps:'6-8',repos:'90 s'}])}),
    Object.freeze({cle:'C',nom:'Séance C · prises',exercises:Object.freeze([
      {name:'TRACTIONS PRISE NEUTRE',series:4,reps:'3-5',repos:'2 min'},
      {name:'TRACTIONS',series:3,reps:'3',repos:'2 min',note:'Isométries en haut, 10 s'}])})])}),
  avance:Object.freeze({nom:'Tractions · avancé',seances:Object.freeze([
    Object.freeze({cle:'A',nom:'Séance A · force',exercises:Object.freeze([
      {name:'TRACTIONS LESTE',series:5,reps:'3-5',repos:'3 min'},
      {name:'TRACTIONS',series:3,reps:'6-8',repos:'2 min'}])}),
    Object.freeze({cle:'B',nom:'Séance B · hauteur',exercises:Object.freeze([
      {name:'TRACTIONS',series:5,reps:'3',repos:'2 min',note:'Poitrine à la barre'},
      {name:'RELEVE DE GENOUX A LA BARRE DE TRACTIONS',series:3,reps:'10',repos:'90 s'}])}),
    Object.freeze({cle:'C',nom:'Séance C · explosivité',exercises:Object.freeze([
      {name:'TRACTIONS',series:6,reps:'3',repos:'2 min',note:'Montée explosive, descente contrôlée'},
      {name:'MUSCLE UP',series:3,reps:'1-2',repos:'3 min'}])})])})
});
/** PURE. Le programme ouvert par un niveau (null sans niveau). @param {string|null} niveau */
function programmeTractionsPour(niveau){
  if(!niveau) return null;
  return PROGRAMMES_TRACTIONS[niveau==='expert'?'avance':niveau]||null;
}

// ── L'ARBRE ──────────────────────────────────────────────────────────────────
// critere : {type:'temps'|'reps'|'lest', valeur, proprete} ; `series` (combien
// de fois le critère) et `reps` (pour un lest) le précisent. `video` : ce que
// la vidéo doit montrer (amplitudeMax : écart épaule-poignet au sommet, en
// part du membre, 0 = épaules à hauteur des mains) ; null quand la vidéo ne
// sait pas juger le critère (un temps, une isométrie, le muscle-up).
// ⚠ SEUILS DE TRAVAIL pour l'amplitude : menton au-dessus de la barre ≈ 0,35,
//   poitrine à la barre ≈ 0,1. À recaler sur des vidéos réelles.
const ARBRE_AMPLITUDE_PROPRE=0.35, ARBRE_AMPLITUDE_HAUTE=0.1;
const ARBRE_TRACTIONS=Object.freeze([
  {cle:'suspension',court:'Suspension',lib:'Suspension 30 s',critere:{type:'temps',valeur:30,proprete:false},prerequis:[],
   consigne:'Suspendu à la barre, bras tendus, épaules engagées (pas pendu aux ligaments). 30 secondes d’un seul tenant.',
   exercice:'TRACTIONS',x:160,y:470,video:null},
  {cle:'scapulaires',court:'Scapulaires',lib:'Scapulaires 3×10',critere:{type:'reps',valeur:10,series:3,proprete:true},prerequis:['suspension'],
   consigne:'Bras tendus, tire les omoplates vers le bas et l’arrière sans plier les coudes, puis relâche. 3 séries de 10.',
   exercice:'TRACTIONS',x:90,y:400,video:null},
  {cle:'australiennes',court:'Australiennes',lib:'Australiennes 3×12',critere:{type:'reps',valeur:12,series:3,proprete:true},prerequis:['suspension'],
   consigne:'Corps gainé et droit sous une barre basse, poitrine à la barre à chaque répétition. 3 séries de 12.',
   exercice:'ROWING INVERSE',x:230,y:400,video:null},
  {cle:'isometries',court:'Isométries',lib:'Isométries 3 × 10 s',critere:{type:'temps',valeur:10,series:3,proprete:true},prerequis:['scapulaires'],
   consigne:'Tiens 10 s en haut (menton au-dessus de la barre), 10 s à mi-hauteur (coudes à 90°), 10 s juste sous le départ.',
   exercice:'TRACTIONS',x:60,y:320,video:null},
  {cle:'excentriques',court:'Excentriques',lib:'Excentriques 5 s ×5',critere:{type:'reps',valeur:5,proprete:true},prerequis:['scapulaires','australiennes'],
   consigne:'Pars menton au-dessus de la barre et descends en 5 secondes jusqu’aux bras tendus. 5 répétitions.',
   exercice:'TRACTIONS',x:160,y:320,video:null},
  {cle:'assistees',court:'Assistées',lib:'Assistées 4×6',critere:{type:'reps',valeur:6,series:4,proprete:true},prerequis:['australiennes'],
   consigne:'Avec élastique ou machine, amplitude complète : bras tendus en bas, menton au-dessus de la barre. 4 séries de 6.',
   exercice:'TRACTIONS ELASTIQUE',x:260,y:320,video:null},
  {cle:'propre5',court:'Propre ×5',lib:'Traction propre ×5',critere:{type:'reps',valeur:5,proprete:true},prerequis:['isometries','excentriques','assistees'],
   consigne:'5 tractions d’affilée : départ bras tendus, menton au-dessus de la barre, sans élan des jambes.',
   exercice:'TRACTIONS',x:160,y:230,video:{amplitudeMax:ARBRE_AMPLITUDE_PROPRE}},
  {cle:'lestee10',court:'Lestée +10',lib:'Lestée +10 kg ×5',critere:{type:'lest',valeur:10,reps:5,proprete:true},prerequis:['propre5'],
   consigne:'5 tractions propres avec 10 kg de lest (ceinture ou gilet).',
   exercice:'TRACTIONS LESTE',x:90,y:140,video:{amplitudeMax:ARBRE_AMPLITUDE_PROPRE}},
  {cle:'haute3',court:'Haute ×3',lib:'Traction haute ×3',critere:{type:'reps',valeur:3,proprete:true},prerequis:['propre5'],
   consigne:'3 tractions où la poitrine vient toucher la barre, sans élan.',
   exercice:'TRACTIONS',x:230,y:140,video:{amplitudeMax:ARBRE_AMPLITUDE_HAUTE}},
  {cle:'muscleup',court:'Muscle-up',lib:'Muscle-up ×1',critere:{type:'reps',valeur:1,proprete:true},prerequis:['lestee10','haute3'],
   consigne:'Une traction qui passe au-dessus de la barre et finit bras tendus en appui, sans kipping.',
   exercice:'MUSCLE UP',x:160,y:55,video:null}
].map(n=>Object.freeze(Object.assign({},n,{critere:Object.freeze(n.critere),prerequis:Object.freeze(n.prerequis),
  video:n.video?Object.freeze(n.video):null}))));
const ARBRE_CLES=Object.freeze(ARBRE_TRACTIONS.map(n=>n.cle));
/** @param {string} cle */
function arbreNoeud(cle){ return ARBRE_TRACTIONS.find(n=>n.cle===cle)||null; }
/** @param {any} u */
function _arbreNoeuds(u){
  const a=u&&u.arbreTractions&&typeof u.arbreTractions==='object'?u.arbreTractions:null;
  return a&&a.noeuds&&typeof a.noeuds==='object'?a.noeuds:{};
}
/**
 * PURE. L'état de chaque nœud : valide, certifie, accessible (prérequis
 * tous validés), at. Un nœud enregistré dont un prérequis manque (dossier
 * bricolé) ne compte pas comme validé.
 * @param {any} u
 */
function arbreEtat(u){
  const brut=_arbreNoeuds(u);
  /** @type {Object<string,{valide:boolean,certifie:boolean,accessible:boolean,at:number}>} */
  const e={};
  for(const n of ARBRE_TRACTIONS){             // l'ordre de la liste suit les prérequis
    const r=brut[n.cle];
    const accessible=n.prerequis.every(p=>e[p]&&e[p].valide);
    const valide=!!(r&&Number(r.at)>0&&accessible);
    e[n.cle]={valide,certifie:valide&&r.certifie===true,accessible,at:valide?Number(r.at):0};
  }
  return e;
}
/** PURE. Les dates de validation, triées (badges arbre_5 / arbre_10, Volts). @param {any} u */
function arbreDatesValidation(u){
  const e=arbreEtat(u);
  return ARBRE_CLES.map(k=>e[k].at).filter(t=>t>0).sort((a,b)=>a-b);
}
/**
 * PURE. Une preuve suffit-elle au critère du nœud ?
 * preuve = {mode:'saisie', valeur, propre} | {mode:'video', mesures}
 * @param {any} n  le nœud
 * @param {any} preuve
 * @returns {{ok:boolean, raison:string, valeur:number}}
 */
function arbrePreuveSuffit(n,preuve){
  const p=preuve&&typeof preuve==='object'?preuve:{};
  const c=n.critere;
  if(p.mode==='video'){
    if(!n.video) return {ok:false,raison:'Ce nœud ne se valide pas en vidéo : la mesure ne sait pas juger ce critère.',valeur:0};
    const v=arbreRepsPropresVideo(p.mesures,n.video.amplitudeMax);
    const besoin=c.type==='lest'?(c.reps||1):c.valeur;
    if(v.vis<COMPAT_VIS_MIN) return {ok:false,raison:'Corps mal vu sur la vidéo : filme de profil, tout le corps et la barre dans l’image.',valeur:v.n};
    if(v.n<besoin) return {ok:false,raison:v.n+' répétition'+(v.n>1?'s':'')+' propre'+(v.n>1?'s':'')+' sur '+besoin
      +(v.raisons.length?' ('+v.raisons.join(', ')+')':'')+'.',valeur:v.n};
    return {ok:true,raison:'',valeur:v.n};
  }
  if(p.mode!=='saisie') return {ok:false,raison:'Preuve inconnue.',valeur:0};
  if(c.proprete&&p.propre!==true) return {ok:false,raison:'Coche la règle « propre » : sans elle, le nœud ne se valide pas.',valeur:0};
  const v=Number(p.valeur);
  if(!isFinite(v)||v<=0) return {ok:false,raison:'Saisis ce que tu as fait.',valeur:0};
  if(c.type==='lest'){
    const r=Number(p.reps);
    if(v<c.valeur) return {ok:false,raison:'Il faut '+c.valeur+' kg de lest au moins.',valeur:v};
    if(!(r>=(c.reps||1))) return {ok:false,raison:'Il faut '+(c.reps||1)+' répétitions avec ce lest.',valeur:v};
    return {ok:true,raison:'',valeur:v};
  }
  if(v<c.valeur) return {ok:false,raison:'Le critère est de '+c.valeur+(c.type==='temps'?' s':' répétitions')+'.',valeur:v};
  return {ok:true,raison:'',valeur:v};
}
/**
 * PURE. Les répétitions PROPRES d'une vidéo de traction (mlMesuresCompat) :
 * vues, amplitude atteinte, et sans compensation (épaules aux oreilles,
 * menton qui avance, kipping).
 * @param {any} mesures
 * @param {number} amplitudeMax
 */
function arbreRepsPropresVideo(mesures,amplitudeMax){
  const m=mesures&&typeof mesures==='object'?mesures:{};
  const reps=Array.isArray(m.reps)?m.reps:[];
  let n=0, courtes=0, comp=0;
  for(const r of reps){
    if(!r||!(Number(r.vis)>=COMPAT_VIS_MIN)||r.valeur==null||!isFinite(Number(r.valeur))) continue;
    if(Array.isArray(r.comp)&&r.comp.length){ comp++; continue; }
    if(Number(r.valeur)>amplitudeMax){ courtes++; continue; }
    n++;
  }
  const raisons=[];
  if(courtes) raisons.push(courtes+' trop courte'+(courtes>1?'s':''));
  if(comp) raisons.push(comp+' avec élan ou compensation');
  return {n,raisons,vis:Number(m.visibilite)||0};
}
/**
 * PURE. Peut-on valider ce nœud avec cette preuve ? Prérequis, double
 * validation, rétrogradation.
 * @returns {{ok:boolean, raison:string, entree:any}}
 */
function arbrePeutValider(u,cle,preuve,maintenant){
  const n=arbreNoeud(cle);
  if(!n) return {ok:false,raison:'Nœud inconnu.',entree:null};
  const e=arbreEtat(u)[cle];
  if(!e.accessible){
    const manque=n.prerequis.filter(p=>!arbreEtat(u)[p].valide).map(p=>arbreNoeud(p).lib);
    return {ok:false,raison:'Valide d’abord : '+manque.join(', ')+'.',entree:null};
  }
  const video=preuve&&preuve.mode==='video';
  // DOUBLE VALIDATION : un nœud validé ne se revalide que pour être certifié.
  if(e.valide&&(e.certifie||!video)) return {ok:false,raison:e.certifie?'Déjà validé et certifié.':'Déjà validé. Une vidéo peut le certifier.',entree:null};
  const s=arbrePreuveSuffit(n,preuve);
  if(!s.ok) return {ok:false,raison:s.raison,entree:null};
  // RÉTROGRADATION IMPOSSIBLE : une certification garde la date d'origine.
  const brut=_arbreNoeuds(u)[cle];
  const at=e.valide?Number(brut.at):Math.round(Number(maintenant)||Date.now());
  return {ok:true,raison:'',entree:arbreEntreeNoeud({at,mode:video?'video':'saisie',valeur:s.valeur,certifie:video})};
}
/** PURE. L'entrée de nœud, bornée comme les règles l'exigent. */
function arbreEntreeNoeud(x){
  return {at:Math.round(Number(x.at)||0),mode:x.mode==='video'?'video':'saisie',
    valeur:Math.max(0,Math.min(1000,Math.round((Number(x.valeur)||0)*10)/10)),certifie:x.certifie===true};
}
/**
 * Valide un nœud dans le dossier : écrit l'entrée, enregistre, fête.
 * @returns {{ok:boolean, raison:string, nouveau:boolean, certifie:boolean}}
 */
function arbreValider(u,cle,preuve,maintenant){
  const r=arbrePeutValider(u,cle,preuve,maintenant);
  if(!r.ok) return {ok:false,raison:r.raison,nouveau:false,certifie:false};
  const avant=arbreEtat(u)[cle].valide;
  if(!u.arbreTractions||typeof u.arbreTractions!=='object') u.arbreTractions={};
  if(!u.arbreTractions.noeuds||typeof u.arbreTractions.noeuds!=='object') u.arbreTractions.noeuds={};
  u.arbreTractions.noeuds[cle]=r.entree;
  return {ok:true,raison:'',nouveau:!avant,certifie:r.entree.certifie};
}
/** PURE. Volts de l'arbre par jour : [[jour, volts]]. Hors plafond (jalon). */
function arbreVoltsParJour(u,maintenant){
  const t=Number(maintenant)||Date.now();
  return arbreDatesValidation(u).filter(d=>d<=t).map(d=>[_xpJour(d),XP_ACTIONS.noeud]);
}

// ── L'ÉCRAN DU TEST ─────────────────────────────────────────────────────────
let _ttEtat=null;   // {palier, phase:'effort'|'repos'|'fin', fin, minuteur, echec}
function ouvrirTestTractions(){
  _ttArreter();
  _ttEtat={palier:1,phase:'pret',fin:0,minuteur:null};
  rendreTestTractions();
  go('s-test-tractions');
  return true;
}
function _ttArreter(){ if(_ttEtat&&_ttEtat.minuteur){ clearInterval(_ttEtat.minuteur); _ttEtat.minuteur=null; } }
function ttPalierFait(){
  if(!_ttEtat) return false;
  if(_ttEtat.palier>=TEST_TRACTIONS_PALIERS_MAX) return ttTerminer(TEST_TRACTIONS_PALIERS_MAX,0);
  _ttEtat.phase='repos'; _ttEtat.fin=Date.now()+TEST_TRACTIONS_REPOS_S*1000;
  _ttArreter();
  _ttEtat.minuteur=setInterval(_ttTic,250);
  rendreTestTractions();
  return true;
}
function _ttTic(){
  if(!_ttEtat||_ttEtat.phase!=='repos') return _ttArreter();
  const z=document.getElementById('tt-chrono');
  const reste=Math.max(0,Math.ceil((_ttEtat.fin-Date.now())/1000));
  if(z) z.textContent=_fmtRepos(reste);
  if(reste<=0){
    _ttArreter();
    _ttEtat.palier++; _ttEtat.phase='effort';
    try{ arcHaptique('finRepos'); }catch(e){}
    rendreTestTractions();
  }
}
function ttCommencer(){ if(!_ttEtat) return false; _ttEtat.phase='effort'; rendreTestTractions(); return true; }
function ttEchec(){ if(!_ttEtat) return false; _ttEtat.phase='echec'; rendreTestTractions(); return true; }
/** Le test fini : paliers réussis et répétitions faites au palier manqué. */
function ttTerminer(paliers,repsEchec){
  _ttArreter();
  const u=currentUser; if(!u) return false;
  const e=arbreEntreeTest(paliers,repsEchec,Date.now());
  if(!u.arbreTractions||typeof u.arbreTractions!=='object') u.arbreTractions={};
  const l=_arbreTests(u).concat([e]).slice(-TEST_TRACTIONS_HISTO);
  u.arbreTractions.tests=l;
  const ok=saveUserOuDire('Ton test de tractions');
  _ttEtat={palier:e.paliers,phase:'fin',fin:0,minuteur:null,resultat:e,ok};
  rendreTestTractions();
  return true;
}
function ttValiderEchec(){
  const i=document.getElementById('tt-echec');
  const n=Math.max(0,Math.floor(Number(i&&i.value)||0));
  return ttTerminer(_ttEtat?_ttEtat.palier-1:0,n);
}
function rendreTestTractions(){
  const z=document.getElementById('tt-contenu'); if(!z) return false;
  const s=_ttEtat||{palier:1,phase:'pret'};
  const E=escapeHtml;
  let h='';
  if(s.phase==='pret'){
    h='<div class="tt-carte"><div class="tt-t">Le protocole</div>'
      +'<p>Un palier de 1 traction, puis 30 s de repos, puis 2, puis 3… jusqu’à l’échec. Chaque palier se fait d’un seul tenant, '
      +'en tractions <b>propres</b> : départ bras tendus, menton au-dessus de la barre, sans élan.</p>'
      +'<button type="button" class="btn btn-red" style="width:100%" onclick="ttCommencer()">Commencer</button></div>';
  } else if(s.phase==='effort'){
    h='<div class="tt-carte tt-effort"><div class="tt-t">Palier '+s.palier+'</div>'
      +'<div class="tt-gros">'+s.palier+' traction'+(s.palier>1?'s':'')+'</div>'
      +'<button type="button" class="btn btn-red" style="width:100%" onclick="ttPalierFait()">Fait</button>'
      +'<button type="button" class="rb-lien tt-echec-b" onclick="ttEchec()">Échec à ce palier</button></div>';
  } else if(s.phase==='repos'){
    h='<div class="tt-carte"><div class="tt-t">Repos avant le palier '+(s.palier+1)+'</div>'
      +'<div class="tt-gros" id="tt-chrono">'+_fmtRepos(Math.max(0,Math.ceil((s.fin-Date.now())/1000)))+'</div>'
      +'<p class="sub">Le palier suivant démarre seul à la fin du repos.</p></div>';
  } else if(s.phase==='echec'){
    h='<div class="tt-carte"><div class="tt-t">Échec au palier '+s.palier+'</div>'
      +'<label for="tt-echec">Combien de tractions propres à ce palier ?</label>'
      +'<input id="tt-echec" type="number" inputmode="numeric" min="0" max="'+Math.max(0,s.palier-1)+'" value="0" style="width:100%;margin:6px 0 12px">'
      +'<button type="button" class="btn btn-red" style="width:100%" onclick="ttValiderEchec()">Voir mon niveau</button></div>';
  } else if(s.phase==='fin'&&s.resultat){
    const r=s.resultat, best=niveauTractionsAtteint(currentUser)||r.niveau, pg=programmeTractionsPour(best);
    h='<div class="tt-carte"><div class="tt-t">Résultat</div>'
      +'<div class="tt-gros">'+r.total+' traction'+(r.total>1?'s':'')+'</div>'
      +'<div class="tt-niv">Niveau : <b>'+E(NIVEAU_TRACTIONS_LIB[r.niveau])+'</b>'
      +(best!==r.niveau?' · programme ouvert : '+E(NIVEAU_TRACTIONS_LIB[best]):'')+'</div>'
      +'<p class="sub">Prochain test dans '+TEST_TRACTIONS_RAPPEL_J/7+' semaines : un rappel s’affichera sur l’accueil.</p></div>'
      +htmlProgrammeTractions(pg)
      +'<button type="button" class="btn btn-outline" style="width:100%;margin-top:10px" onclick="ouvrirArbreTractions()">Voir l’arbre des tractions</button>';
  }
  z.innerHTML=h;
  return true;
}
/** @param {any} pg */
function htmlProgrammeTractions(pg){
  if(!pg) return '';
  const E=escapeHtml;
  return '<div class="tt-prog"><div class="tt-t">'+E(pg.nom)+'</div>'
    +pg.seances.map(s=>'<div class="tt-seance"><div class="tt-seance-t"><b>'+E(s.nom)+'</b>'
      +'<button type="button" class="btn btn-outline btn-sm" onclick="lancerSeanceTractions('+jsArg(s.cle)+')">Lancer</button></div>'
      +s.exercises.map(x=>'<div class="tt-ex">'+E(String(x.name).toLowerCase())+' · '+x.series+' × '+E(x.reps)
        +(x.note?' <span class="sub">('+E(x.note)+')</span>':'')+'</div>').join('')+'</div>').join('')
    +'</div>';
}
/** Lance une séance du programme sans toucher au programme du coach. */
function lancerSeanceTractions(cle){
  const pg=programmeTractionsPour(niveauTractionsAtteint(currentUser));
  const s=pg&&pg.seances.find(x=>x.cle===cle);
  if(!s) return false;
  launchWorkout({name:pg.nom+' · '+s.cle,exercises:s.exercises.map(x=>Object.assign({},x))},null);
  return true;
}
/** La carte de rappel, sur l'accueil : rien tant que le test n'est pas dû. */
function rendreRappelTractions(u){
  const z=document.getElementById('clh-tractions'); if(!z) return false;
  const p=(u&&u.role!=='coach')?prochainTestTractions(u):null;
  if(!p||!p.du){ z.hidden=true; z.innerHTML=''; return false; }
  z.innerHTML='<div class="rt-carte"><div><b>Test de tractions</b><span>Quatre semaines depuis le dernier : mesure tes progrès.</span></div>'
    +'<div class="rt-b"><button type="button" class="btn btn-red btn-sm" onclick="ouvrirTestTractions()">Faire le test</button></div></div>';
  z.hidden=false;
  return true;
}

// ── L'ÉCRAN DE L'ARBRE ──────────────────────────────────────────────────────
function ouvrirArbreTractions(){
  _ttArreter();
  rendreArbreTractions();
  go('s-arbre-tractions');
  return true;
}
/** PURE. L'arbre en SVG : liens, puis nœuds (rouge validé, gris à venir). */
function svgArbreTractions(u){
  const e=arbreEtat(u);
  let liens='', noeuds='';
  for(const n of ARBRE_TRACTIONS){
    for(const p of n.prerequis){
      const a=arbreNoeud(p);
      liens+='<line x1="'+a.x+'" y1="'+a.y+'" x2="'+n.x+'" y2="'+n.y+'" class="arb-lien'+(e[p].valide?' on':'')+'"/>';
    }
  }
  for(const n of ARBRE_TRACTIONS){
    const s=e[n.cle];
    const cls='arb-n'+(s.valide?' valide':(s.accessible?' ouvert':' ferme'));
    noeuds+='<g class="'+cls+'" data-cle="'+n.cle+'" role="button" tabindex="0" aria-label="'+escapeHtml(n.lib+(s.valide?' : validé':s.accessible?' : à valider':' : verrouillé'))+'"'
      +' onclick="ouvrirNoeudTractions('+jsArg(n.cle)+')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();ouvrirNoeudTractions('+jsArg(n.cle)+')}">'
      +'<circle cx="'+n.x+'" cy="'+n.y+'" r="22"/>'
      +(s.certifie?'<circle cx="'+(n.x+16)+'" cy="'+(n.y-16)+'" r="7" class="arb-certif"/>':'')
      +'<text x="'+n.x+'" y="'+(n.y+36)+'" text-anchor="middle">'+escapeHtml(n.court)+'</text></g>';
  }
  return '<svg class="arb-svg" viewBox="0 0 320 520" role="img" aria-label="Arbre des tractions">'+liens+noeuds+'</svg>';
}
function rendreArbreTractions(){
  const z=document.getElementById('arb-contenu'); if(!z) return false;
  const u=currentUser, n=arbreDatesValidation(u).length;
  const niv=niveauTractionsAtteint(u);
  z.innerHTML='<div class="arb-tete"><b>'+n+'</b> nœud'+(n>1?'s':'')+' sur '+ARBRE_TRACTIONS.length
    +(niv?' · niveau '+escapeHtml(NIVEAU_TRACTIONS_LIB[niv]):'')+'</div>'
    +svgArbreTractions(u)
    +'<div class="arb-legende"><span class="arb-pt valide"></span>validé <span class="arb-pt ouvert"></span>à valider <span class="arb-pt ferme"></span>verrouillé <span class="arb-pt certif"></span>certifié en vidéo</div>'
    +'<button type="button" class="btn btn-outline" style="width:100%;margin-top:12px" onclick="ouvrirTestTractions()">'+(niv?'Refaire le test de tractions':'Faire le test de tractions')+'</button>';
  return true;
}
/** La fiche d'un nœud : consigne, critère, exercice, validation. */
function ouvrirNoeudTractions(cle){
  const n=arbreNoeud(cle); if(!n) return false;
  const e=arbreEtat(currentUser)[cle];
  const E=escapeHtml, c=n.critere;
  const crit=c.type==='temps'?(c.series?c.series+' × ':'')+c.valeur+' s'
    :c.type==='lest'?'+'+c.valeur+' kg × '+(c.reps||1):(c.series?c.series+' × ':'')+c.valeur+' répétition'+(c.valeur>1?'s':'');
  const champ=c.type==='lest'
    ?'<div style="display:flex;gap:10px"><div style="flex:1"><label for="arb-val">Lest (kg)</label><input id="arb-val" type="text" inputmode="decimal" autocomplete="off" pattern="[0-9]*[.,]?[0-9]*" style="width:100%"></div>'
      +'<div style="flex:1"><label for="arb-reps">Répétitions</label><input id="arb-reps" type="number" inputmode="numeric" min="0" style="width:100%"></div></div>'
    :'<label for="arb-val">'+(c.type==='temps'?'Temps tenu (s)':'Répétitions')+(c.series?' (chaque série)':'')+'</label><input id="arb-val" type="number" inputmode="numeric" min="0" style="width:100%">';
  let corps;
  if(e.valide&&(e.certifie||!n.video)){
    corps='<div class="arb-fait">Validé'+(e.certifie?' et certifié en vidéo':'')+' le '+E(new Date(e.at).toLocaleDateString('fr-FR'))+'.</div>';
  } else if(!e.accessible){
    corps='<div class="arb-ferme">Verrouillé : valide d’abord '+E(n.prerequis.filter(p=>!arbreEtat(currentUser)[p].valide).map(p=>arbreNoeud(p).lib).join(', '))+'.</div>';
  } else {
    corps=(e.valide?'<div class="arb-fait">Validé par saisie. Une vidéo peut le certifier.</div>'
      :champ+(c.proprete?'<label class="arb-propre"><input type="checkbox" id="arb-propre"> Propre : amplitude complète, sans élan ni balancement.</label>':'')
        +'<div id="arb-err" class="arb-err" hidden></div>'
        +'<button type="button" class="btn btn-red" style="width:100%;margin-top:8px" onclick="arbreValiderSaisie('+jsArg(cle)+')">Je l’ai fait</button>')
      +(n.video?'<label class="btn btn-outline" style="width:100%;margin-top:8px;display:block;text-align:center">Certifier en vidéo'
        +'<input type="file" accept="video/*" capture="environment" hidden data-cle="'+n.cle+'" onchange="arbreValiderVideo(this)"></label>'
        +'<p class="sub" style="font-size:var(--fs-xs)">Filme de profil, à 3 m, la barre et tout le corps dans l’image. La vidéo est lue sur ton téléphone et n’est pas envoyée.</p>':'');
  }
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" class="arb-fiche" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow:auto">'
    +'<div class="arb-fiche-t">'+E(n.lib)+'</div>'
    +'<div class="arb-crit">Critère : '+E(crit)+(c.proprete?' · propre':'')+'</div>'
    +'<p>'+E(n.consigne)+'</p>'
    +'<div class="arb-ex">Exercice d’entraînement : <b>'+E(String(n.exercice).toLowerCase())+'</b></div>'
    +corps+'</div></div>');
  return true;
}
function _arbreApres(cle,r){
  if(!r.ok) return false;
  saveUserOuDire('Ton nœud de l’arbre');
  try{ majBadges(); majXp(); }catch(e){}
  closeModal();
  rendreArbreTractions();
  const n=arbreNoeud(cle);
  toast(r.nouveau?'Nœud débloqué : '+n.lib:'Nœud certifié : '+n.lib,'var(--green)',5000,
    {lib:'Partager',fn:()=>partagerNoeudTractions(cle)});
  return true;
}
function arbreValiderSaisie(cle){
  const v=Number(String((document.getElementById('arb-val')||{}).value||'').replace(',','.'));
  const reps=Number((document.getElementById('arb-reps')||{}).value);
  const propre=!!(document.getElementById('arb-propre')||{}).checked;
  const r=arbreValider(currentUser,cle,{mode:'saisie',valeur:v,reps,propre},Date.now());
  if(!r.ok){ const z=document.getElementById('arb-err'); if(z){ z.textContent=r.raison; z.hidden=false; } return false; }
  return _arbreApres(cle,r);
}
async function arbreValiderVideo(input){
  const cle=String((input&&input.dataset&&input.dataset.cle)||'');
  const f=input&&input.files&&input.files[0];
  try{ if(input) input.value=''; }catch(e){}
  if(!f||!arbreNoeud(cle)) return false;
  toast('Analyse de la vidéo…','var(--sub)',2500);
  let r=null;
  try{
    await chargerMotionLab();
    const lire=window.mlTestCompatVideo;
    if(typeof lire!=='function') throw new Error('indisponible');
    r=await lire(f,'traction',{});
  }catch(e){ r={ok:false,code:'moteur'}; }
  if(!r||!r.ok){ toast('La vidéo n’a pas pu être lue.','var(--orange)'); return false; }
  const v=arbreValider(currentUser,cle,{mode:'video',mesures:r.mesures},Date.now());
  if(!v.ok){ toast(v.raison,'var(--orange)',5000); return false; }
  return _arbreApres(cle,v);
}
// LA CARTE PARTAGEABLE « NŒUD DÉBLOQUÉ ».
function _dessinerCarteNoeud(cle,fond,format){
  const n=arbreNoeud(cle), e=arbreEtat(currentUser)[cle];
  const F=visuelFormat(format), W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  _visuelPeindreFond(g,W,H,fond||'transparent');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif"), MONT="Montserrat,'Segoe UI',sans-serif";
  const o=_visuelOutils(g), cx=W/2, LARG=W-144;
  const rouge=fond==='rouge';
  g.textAlign='center'; g.textBaseline='alphabetic';
  let y=Math.round(H*0.32);
  o.ombre(true);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 34px '+MONT;
  o.ecrireEspace('NŒUD DÉBLOQUÉ',cx,y,10,true);
  const t=String(n.lib).toUpperCase(), cs=o.ajuste(t,'700',200,BEBAS,LARG,90);
  g.fillStyle='#fff'; g.font='700 '+cs+'px '+BEBAS; o.ecrire(t,cx,y+40+cs*0.82);
  y+=40+cs*0.82+90;
  g.font='800 44px '+MONT;
  o.ecrireEspace(arbreDatesValidation(currentUser).length+' / '+ARBRE_TRACTIONS.length+' · ARBRE DES TRACTIONS',cx,y,6,true);
  if(e&&e.certifie){ g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 36px '+MONT; o.ecrireEspace('CERTIFIÉ EN VIDÉO',cx,y+70,8,true); }
  o.ombre(false);
  return cv;
}
function partagerNoeudTractions(cle){
  if(!arbreNoeud(cle)||!arbreEtat(currentUser)[cle].valide||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond), nom=visuelNomFichier('repcore-noeud',fond);
  _storyEnCours=true;
  let ok=false;
  try{ ok=_storySortirPartage(_dessinerCarteNoeud(cle,fond),nom,undefined,fmt)||_storySortirTelechargement(_dessinerCarteNoeud(cle,fond),nom,fmt); }
  catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  return ok;
}
