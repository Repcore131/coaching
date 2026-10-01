// ══════════ DÉFICIT ÉNERGÉTIQUE : DES FAITS, JAMAIS UN DIAGNOSTIC ══════════
// Le produit sait déjà tout ce qu'il faut, en pièces détachées : une sèche qui
// dure, des apports collés au plancher, une perte trop rapide, un volume
// au-dessus du repère haut, des nuits courtes, des douleurs. Personne ne les
// regardait ENSEMBLE. Et chez une athlète dont la perte s'arrête,
// ajustementPropose proposait de baisser encore.
//
// Ce score n'est pas un diagnostic et n'est JAMAIS montré chiffré à
// l'athlète : c'est un compteur de faits qui décide quand l'app doit se
// taire, puis quand elle doit renvoyer vers un médecin.
//
// Il n'est PAS conditionné au genre : le déficit énergétique n'est pas
// exclusivement féminin. Seul le critère d'absence de règles l'est de fait.
const DEF_SEM_RESTRICTION=12;
const DEF_PART_PLANCHER=1.15;
// Alias, et non copies : MICRO_SOMMEIL_SEUIL vaut déjà 6 et
// MICRO_SOMMEIL_JOURS déjà 14. Deux constantes de même valeur finissent
// toujours par diverger.
const DEF_SOMMEIL_SEUIL=MICRO_SOMMEIL_SEUIL;
const DEF_SOMMEIL_JOURS=MICRO_SOMMEIL_JOURS;
const DEF_MUSCLES_MRV=2;
const DEF_POINTS_ABSENCE=3;
const DEF_SEUIL_VIGILANCE=3;
const DEF_SEUIL_BLOCAGE=5;
const DEF_ABSENCES_BLOCAGE=2;

function _moisSuivant(m){
  const [a,b]=String(m).split('-').map(Number);
  return b===12?((a+1)+'-01'):(a+'-'+String(b+1).padStart(2,'0'));
}
// Date de la levée explicite, ou null. Rien d'automatique, aucune expiration.
function _leveDeficitDate(user){
  const l=((user&&user.cycle)||{}).leveDeficit;
  return (l&&l.date)?String(l.date):null;
}
// Plus longue suite de MOIS ADJACENTS portant une absence déclarée. Les
// absences antérieures à une levée ne comptent plus : c'est ce qui permet au
// blocage de revenir sur une NOUVELLE déclaration, et seulement sur elle.
function absencesConsecutives(user,depuisISO){
  // Sous contraception EN CONTINU, l'absence de règles est attendue : ce n'est
  // pas un signal exploitable, et bloquer là-dessus enverrait chez le médecin
  // pour quelque chose de normal. « Je préfère ne pas répondre » continue en
  // revanche de compter : on ne sait pas, donc on garde le garde-fou.
  if(contraceptionDe(user)==='continue') return 0;
  // Enceinte ou allaitante : l'absence de règles est attendue. Bloquer
  // là-dessus enverrait chez le médecin pour quelque chose de normal.
  if(grossesseSuspend(user)) return 0;
  const c=(user&&user.cycle)||{};
  let l=(Array.isArray(c.absences)?c.absences:[])
    .filter(x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x));
  if(depuisISO) l=l.filter(x=>x>depuisISO);
  const mois=Array.from(new Set(l.map(x=>x.slice(0,7)))).sort();
  if(!mois.length) return 0;
  let max=1,cour=1;
  for(let i=1;i<mois.length;i++){
    cour=(mois[i]===_moisSuivant(mois[i-1]))?cour+1:1;
    if(cour>max) max=cour;
  }
  return max;
}
// PURE. Un point par critère rempli, chacun isolé dans son try : un calcul
// qui casse compte ZÉRO et n'emporte pas les cinq autres avec lui.
// Convention, pas mesure : voir le commentaire du critere « pas » ci-dessous.
const DEF_PAS_ELEVES=12000;
function risqueDeficitEnergetique(user,jourISO){
  const j=jourISO||localISODate(new Date());
  const criteres=[];
  const essai=(cle,lib,fn)=>{
    try{ const v=fn(); if(v) criteres.push({cle,lib,valeur:v}); }catch(e){}
  };
  essai('restriction','Sèche qui dure',()=>{
    const ph=phaseCourante(user);
    if(!ph||ph.type!=='seche') return null;
    const sem=semainesEcoulees(user);
    return (sem!=null&&sem>=DEF_SEM_RESTRICTION)?(sem+' semaines de sèche'):null;
  });
  essai('plancher','Apports collés au plancher',()=>{
    const m=((user&&user.nutrition)||{}).macros;
    if(!m) return null;
    const pl=plancherEffectif(user,true);
    if(!(pl.kcal>0)) return null;
    const k=[m.on,m.off].filter(x=>x&&Number(x.kcal)>0).map(x=>Number(x.kcal));
    if(!k.length) return null;
    const min=Math.min.apply(null,k);
    return min<pl.kcal*DEF_PART_PLANCHER
      ?(min+' kcal pour un plancher de '+pl.kcal):null;
  });
  essai('vitesse','Perte rapide',()=>{
    // seuilAlerteSeche et NON cibleVitesse(user).alerte : ce critère vaut
    // quelle que soit la phase, et l'alerte d'une prise de masse est POSITIVE.
    // Le comparer à pctSem le déclencherait en permanence.
    const seuil=seuilAlerteSeche(user);
    if(seuil==null) return null;
    const v=_vitesseAuJour(user,j);
    if(!v||v.pctSem==null) return null;
    return v.pctSem<seuil
      ?(String(Math.round(v.pctSem*100)/100).replace('.',',')+' % par semaine'):null;
  });
  // ⚠ LES PAS ENTRENT DANS LE FAISCEAU EXISTANT, PAS A COTE. Consigne
  // explicite : ne pas creer une seconde detection. Le critere rejoint donc les
  // autres ici, passe par REDS_CODES comme eux, et tombe sous la meme regle des
  // DEUX signaux minimum — il ne declenche jamais rien seul.
  //
  // ET ON NE CONCLUT RIEN SUR LA SANTE DE QUI QUE CE SOIT A PARTIR D'UN
  // PODOMETRE. Ce critere ne dit pas « depense excessive » ni quoi que ce soit
  // d'osseux : il dit un nombre de pas, constate. Ce qui le rend utile, c'est
  // sa coincidence avec un apport bas et un sommeil court — jamais lui seul.
  //
  // LE SEUIL EST UNE CONVENTION, PAS UNE MESURE. 12 000 pas par jour en moyenne
  // sur quatorze jours situe une depense hors entrainement dans le haut de
  // NAF_ECHELLE ; ce n'est pas un diagnostic, et ce commentaire est la pour que
  // personne ne le lise comme tel.
  essai('pas','Dépense hors entraînement élevée',()=>{
    let m=null; try{ m=moyennePas14j(user); }catch(e){ return null; }
    if(m==null||!(m>=DEF_PAS_ELEVES)) return null;
    return sanNb(m)+' pas par jour sur 14 jours';
  });
  essai('volume','Volume au-dessus du repère haut',()=>{
    // La dernière semaine RÉVOLUE, comme partout ailleurs : la semaine en
    // cours est incomplète et sous-compterait toujours.
    const cle=_semainesRevolues(1)[0];
    if(!cle) return null;
    const v=volumeSemaine(user,cle)||{};
    const hauts=[];
    for(const m in v){
      const rep=reperesEffectifs(user,m);
      if(rep&&v[m]>rep.mrv) hauts.push(((MUSCLES[m]||{}).lib||m).toLowerCase());
    }
    return hauts.length>=DEF_MUSCLES_MRV?hauts.join(', '):null;
  });
  essai('sommeil','Nuits courtes',()=>{
    const som=_microSommeil(user,new Date(j+'T00:00:00'));
    if(!som) return null;   // moins de sept nuits : jamais présumé
    return som.moyenne<DEF_SOMMEIL_SEUIL
      ?(String(som.moyenne).replace('.',',')+' h sur '+som.nuits+' nuits'):null;
  });
  essai('douleur','Douleurs à l\'entraînement',()=>{
    const sg=signauxEntrainement(user);
    return (sg&&(sg.douleur||sg.douleurDiffuse))
      ?'signalées sur les dernières séances':null;
  });
  let points=criteres.length;
  let cons=0,nMois=0;
  try{
    const depuis=_leveDeficitDate(user);
    cons=absencesConsecutives(user,depuis);
    let l=(((user&&user.cycle)||{}).absences)||[];
    if(depuis) l=l.filter(x=>x>depuis);
    nMois=Array.from(new Set(l.map(x=>String(x).slice(0,7)))).length;
  }catch(e){}
  // Sous contraception EN CONTINU, aucune des deux branches ne doit compter :
  // absencesConsecutives rend déjà zéro, mais le repli des absences ESPACÉES
  // lisait la liste directement et ajoutait son point malgré tout.
  if(contraceptionDe(user)==='continue'||grossesseSuspend(user)){ nMois=0; }
  if(cons>=DEF_ABSENCES_BLOCAGE){
    points+=DEF_POINTS_ABSENCE;
    criteres.push({cle:'absences',lib:'Absence de règles',
      valeur:cons+' mois de suite'});
  } else if(nMois>=DEF_ABSENCES_BLOCAGE){
    // Espacées et non consécutives : DÉCISION EXPLICITE — un point, pas trois.
    // Deux mois sans règles dans l'année ne disent pas la même chose que deux
    // mois de suite, mais ils ne sont pas rien non plus.
    points+=1;
    criteres.push({cle:'absences_espacees',lib:'Absences de règles espacées',
      valeur:nMois+' mois signalés'});
  }
  return {points,criteres,absencesConsecutives:cons};
}
// PURE. Trois paliers. La levée explicite éteint le BLOCAGE tant qu'aucune
// absence n'est déclarée après elle — sans quoi les points qui l'avaient
// déclenché la rendraient caduque dans la seconde.
function paliersDeficit(user,jourISO){
  let r;
  try{ r=risqueDeficitEnergetique(user,jourISO); }
  catch(e){ return 'aucun'; }
  const leve=!!_leveDeficitDate(user);
  // absencesConsecutives ne compte QUE les absences postérieures à la levée :
  // ce qui en sort est donc du NEUF, et rebloque sans être amorti. C'est ce
  // qui fait revenir le blocage sur une nouvelle déclaration, et seulement
  // sur elle.
  if(r.absencesConsecutives>=DEF_ABSENCES_BLOCAGE) return 'blocage';
  const bloquePoints=(r.points>=DEF_SEUIL_BLOCAGE);
  if(bloquePoints&&!leve) return 'blocage';
  // Après une levée, on ne bloque plus mais on ne pousse pas non plus : le
  // palier retombe au cran du dessous, jamais à zéro.
  if(bloquePoints&&leve) return 'vigilance';
  if(r.points>=DEF_SEUIL_VIGILANCE) return 'vigilance';
  return 'aucun';
}
// Le seuil de « perte rapide », indépendant de la phase courante : c'est une
// vitesse de sèche qui sert de référence, y compris chez quelqu'un en masse
// qui perdrait vite. Sous SOPK, la référence se décale avec la fourchette.
function seuilAlerteSeche(user){
  return sopkApplicable(user)?SOPK_CIBLE_SECHE.alerte:((PHASES.seche||{}).alerte);
}

// ══════════════ VIGILANCE ÉNERGÉTIQUE — COUCHE QUESTIONNAIRE ══════════════
// CE MODULE NE DÉPISTE PAS UNE SECONDE FOIS. risqueDeficitEnergetique croise
// déjà sept critères et paliersDeficit en tire trois paliers ; poser un second
// dépistage à côté du premier aurait garanti qu'ils se contredisent à l'écran
// un jour. On PROLONGE : les signaux viennent de là, le questionnaire s'ajoute
// par-dessus, et les effets passent par la suspension qui existe.
//
// LE VOCABULAIRE EST CONTRAINT PAR QUATRE ASSERTIONS qui balaient la
// production, commentaires compris. On écrit « absence de règles », jamais le
// terme clinique ; « vigilance énergétique », jamais l'acronyme. Aucun score
// n'est montré, aucune jauge, aucun pourcentage.
const REDS_MIN_SIGNAUX=2;
const REDS_JOURS_SANS_ENTREE=90;
const REDS_PROMPT_JOURS=30;
const REDS_SEUIL_GLOBAL=8;
const REDS_SOUS_SEUILS=Object.freeze({blessures:2,gastro:2,menstruel:4});
const REDS_RENVOI='Ces éléments méritent un avis médical avant de fixer un '
  +'objectif de poids. RepCore ne remplace pas une consultation.';
// La table de correspondance : chaque critère DÉJÀ calculé devient un signal
// nommé. Aucun n'est recalculé ici.
const REDS_CODES=Object.freeze({
  restriction:'restriction_prolongee',
  plancher:'apport_bas',
  vitesse:'perte_rapide',
  absences:'regles_absentes',
  absences_espacees:'regles_espacees',
  sommeil:'sommeil_court',
  douleur:'douleurs_repetees',
  volume:'volume_haut',
  // Les pas rejoignent la table comme les autres : nommes, jamais recalcules
  // ici, et soumis au minimum de deux signaux.
  pas:'depense_neat_haute'
});
// PURE. L'état du nœud. Absent = défauts, et la LECTURE n'écrit rien.
function redsEtat(user){
  const r=(user&&user.redsScreening)||null;
  return {
    level:(r&&r.level)||'green',
    signals:Array.isArray(r&&r.signals)?r.signals:[],
    leafq:(r&&r.leafq)||null,
    optedOut:!!(r&&r.optedOut),
    lastPromptDate:Number(r&&r.lastPromptDate)||0
  };
}
// PURE. Le module est-il inhibé ? Grossesse et allaitement suspendent tout —
// même règle, même fonction, on ne crée pas une seconde doctrine.
function redsInhibe(user){
  try{ return !!grossesseSuspend(user); }catch(e){ return false; }
}
// PURE. Les signaux, datés. Ils sont LUS de risqueDeficitEnergetique, plus
// deux que ce module ajoute : l'irrégularité SURVENANT EN SÈCHE, et le
// signalement osseux.
//
// RÈGLE 3 et 5 : sous contraception continue, sous « ne se prononce pas », en
// grossesse ou en allaitement, le signal d'absence de règles est NEUTRALISÉ —
// une absence provoquée par un traitement n'est pas un signe. Et un journal
// vide ne le déclenche jamais : l'absence de donnée n'est pas l'absence de
// règles. Les deux gardes existent déjà dans risqueDeficitEnergetique ; on les
// double ici parce que ce module ajoute ses propres critères.
function computeRedsSignals(user,jourISO){
  if(!user||redsInhibe(user)) return [];
  const j=jourISO||localISODate(new Date());
  const out=[];
  const pousser=(code,date)=>{ if(code&&!out.some(x=>x.code===code)) out.push({code,date:date||j}); };
  let base=null;
  try{ base=risqueDeficitEnergetique(user,j); }catch(e){ base=null; }
  // cycleSansCycle porte DEJA la regle : contraception en continu ou
  // « ne se prononce pas ». J avais invente une cle qui n existe pas — la
  // vraie est 'ne_dit_pas', et le predicat existant les couvre toutes deux.
  const sansCycle=(()=>{
    try{ return !!cycleSansCycle(user); }catch(e){ return false; }
  })();
  const neutralise=sansCycle;
  for(const cr of ((base&&base.criteres)||[])){
    const code=REDS_CODES[cr.cle];
    if(!code) continue;
    // Les deux signaux de règles tombent sous contraception continue, sous
    // « ne se prononce pas », et quand le journal est vide.
    if((code==='regles_absentes'||code==='regles_espacees')
       &&(neutralise||sansCycle)) continue;
    pousser(code);
  }
  // (a) Plus aucune entrée au journal depuis quatre-vingt-dix jours, ALORS
  // QU'IL EN EXISTE. RÈGLE 5 : un journal vide ne le déclenche jamais —
  // l'absence de donnée n'est pas l'absence de règles, et c'est exactement la
  // confusion qu'on refuse de faire.
  try{
    if(!sansCycle){
      const l=(typeof _cycleRegles==='function')?_cycleRegles(user):[];
      if(Array.isArray(l)&&l.length){
        const der=l[l.length-1];
        const jours=Math.floor((new Date(j+'T00:00:00')-new Date(der+'T00:00:00'))/864e5);
        if(jours>=REDS_JOURS_SANS_ENTREE) pousser('journal_silencieux',der);
      }
    }
  }catch(e){}
  // (b) L'IRRÉGULARITÉ, mais SEULEMENT si une sèche est active. Hors sèche,
  // elle a mille causes et n'appartient pas à ce filet.
  try{
    const ph=phaseCourante(user);
    if(ph&&ph.type==='seche'&&!neutralise&&!sansCycle&&cycleIrregulier(user))
      pousser('cycle_irregulier');
  }catch(e){}
  // (f) Signalement osseux. Il n'existe AUCUN drapeau rouge « osseux » dans le
  // produit : les cinq signes de DRAPEAUX_ROUGES sont articulaires, et les
  // sept de DRAPEAUX_GENERAUX ne le sont pas davantage. On lit donc ce qui
  // existe — une zone déclarée après un choc — plutôt que d'inventer un champ.
  try{
    const d=drapeauRougeActif(user);
    if(d&&Array.isArray(d.cases)&&d.cases.indexOf('choc')>=0)
      pousser('signalement_osseux',d.date);
  }catch(e){}
  return out;
}
// PURE. RÈGLE 2 : jamais sur un seul signal.
// RÈGLE 7 : les signaux valent pour tout le monde, le questionnaire non — sa
// sous-échelle menstruelle n'aurait pas de sens.
function shouldPromptLeafq(user,now){
  if(!user||redsInhibe(user)) return false;
  try{ if(!isFemale(user.gender)) return false; }catch(e){ return false; }
  const e=redsEtat(user);
  if(e.optedOut) return false;                       // RÈGLE 8 : définitif
  const t=(typeof now==='number')?now:Date.now();
  if(e.lastPromptDate&&(t-e.lastPromptDate)<REDS_PROMPT_JOURS*864e5) return false;
  return computeRedsSignals(user).length>=REDS_MIN_SIGNAUX;
}
// PURE. Le score, et ses trois sous-scores. Il n'est JAMAIS affiché : il
// décide, il ne se montre pas. Une réponse manquante compte zéro — à la
// différence du bilan de sécurité, ce questionnaire n'est pas un filtre de
// sûreté mais une description, et présumer le pire ferait basculer tout le
// monde.
function scoreLeafq(answers){
  const a=(answers&&typeof answers==='object')?answers:{};
  const somme=(l)=>l.reduce((n,k)=>n+(Number(a[k])>0?Number(a[k]):0),0);
  const cles=Object.keys(a);
  const sub={
    blessures:somme(cles.filter(k=>/^b/.test(k))),
    gastro:somme(cles.filter(k=>/^g/.test(k))),
    menstruel:somme(cles.filter(k=>/^m/.test(k)))
  };
  const score=sub.blessures+sub.gastro+sub.menstruel;
  const depasse=score>=REDS_SEUIL_GLOBAL
    ||sub.blessures>=REDS_SOUS_SEUILS.blessures
    ||sub.gastro>=REDS_SOUS_SEUILS.gastro
    ||sub.menstruel>=REDS_SOUS_SEUILS.menstruel;
  return {score,sub,depasse};
}
// PURE. Le niveau. Trois crans, et le questionnaire ne peut que DURCIR : il ne
// rattrape jamais des signaux concordants.
function resolveRedsLevel(signals,leafq){
  const n=Array.isArray(signals)?signals.length:0;
  const q=leafq&&leafq.depasse===true;
  const osseux=Array.isArray(signals)&&signals.some(s=>s&&s.code==='signalement_osseux');
  if(osseux&&n>=REDS_MIN_SIGNAUX) return 'red';
  if(q&&n>=REDS_MIN_SIGNAUX) return 'red';
  if(q||n>=REDS_MIN_SIGNAUX) return 'orange';
  return 'green';
}
// ÉCRIT. Les effets. Le seul point d'écriture du module.
//
// LA SUSPENSION N'EST PAS DUPLIQUÉE : refusObjectifPerte porte déjà la
// priorité grossesse, et changerPhase porte déjà la garde. On pose le niveau,
// et ce sont ces deux-là qui refusent.
function applyRedsEffects(user,level){
  if(!user) return false;
  const l=(['green','orange','red'].indexOf(level)>=0)?level:'green';
  if(!user.redsScreening||typeof user.redsScreening!=='object') user.redsScreening={};
  user.redsScreening.level=l;
  // RÈGLE : grossesse et allaitement priment. On ne pose rien de plus, et le
  // message qui sortira est celui qui existe.
  if(redsInhibe(user)) return false;
  if(l==='red'){
    // Le niveau haut réutilise le drapeau EXISTANT, sur la zone conventionnelle
    // générale. Aucun second mécanisme.
    try{
      if(typeof poserDrapeauGeneral==='function'&&!drapeauGeneralActif(user))
        poserDrapeauGeneral(user,['thoracique']);
    }catch(e){}
  }
  return l!=='green';
}
// PURE. L'objectif de perte est-il en pause pour cette raison ? Lu par la
// carte coach et par le refus.
function redsSuspend(user){
  const l=redsEtat(user).level;
  return l==='orange'||l==='red';
}

// ── Le questionnaire, 25 items ────────────────────────────────────────────
// Version française littérale. L'introduction ne dramatise rien : elle dit à
// quoi ça sert et ce qui se passe ensuite. Les deux boutons de sortie sont
// respectés — « Plus tard » repousse de trente jours, « Ne plus me proposer »
// ferme définitivement.
//
// Les clés portent leur sous-échelle en préfixe : b = blessures, g = digestif,
// m = règles. scoreLeafq s'en sert, et rien d'autre.
const LEAFQ_ITEMS=Object.freeze([
  {k:'b1',q:'As-tu été blessée au cours des douze derniers mois ?'},
  {k:'b2',q:'Combien de blessures as-tu eues sur cette période ?'},
  {k:'b3',q:'As-tu manqué des entraînements à cause d\'une blessure ?'},
  {k:'b4',q:'As-tu manqué plus de sept jours d\'affilée ?'},
  {k:'b5',q:'Une même blessure est-elle revenue plusieurs fois ?'},
  {k:'b6',q:'As-tu déjà eu une fracture liée à l\'entraînement ?'},
  {k:'b7',q:'Ressens-tu des douleurs osseuses à l\'effort ?'},
  {k:'g1',q:'As-tu souvent des ballonnements ?'},
  {k:'g2',q:'Te sens-tu rassasiée très vite en mangeant ?'},
  {k:'g3',q:'As-tu des douleurs au ventre sans cause connue ?'},
  {k:'g4',q:'As-tu des remontées acides après les repas ?'},
  {k:'g5',q:'Es-tu souvent constipée ?'},
  {k:'g6',q:'As-tu souvent des selles molles ou fréquentes ?'},
  {k:'g7',q:'Ces troubles gênent-ils tes entraînements ?'},
  {k:'g8',q:'Ces troubles ont-ils commencé ou empiré récemment ?'},
  {k:'m1',q:'As-tu déjà eu tes premières règles ?'},
  {k:'m2',q:'À quel âge les as-tu eues ?'},
  {k:'m3',q:'Tes cycles sont-ils réguliers depuis un an ?'},
  {k:'m4',q:'Combien de cycles as-tu eus ces douze derniers mois ?'},
  {k:'m5',q:'As-tu passé plus de trois mois sans règles cette année ?'},
  {k:'m6',q:'Cela s\'est-il déjà produit d\'autres années ?'},
  {k:'m7',q:'Tes règles changent-elles quand ton volume d\'entraînement augmente ?'},
  {k:'m8',q:'Tes règles changent-elles quand tu manges moins ?'},
  {k:'m9',q:'Prends-tu une contraception hormonale ?'},
  {k:'m10',q:'Y a-t-il autre chose que tu veux signaler à ce sujet ?'}
]);
const LEAFQ_INTRO='Quelques questions sur ton corps et ton entraînement. '
  +'Elles servent à savoir si un objectif de poids est bien placé en ce moment. '
  +'Tu peux les passer, et y revenir plus tard : rien ne se bloque parce que tu '
  +'ne réponds pas. Tes réponses restent dans ton dossier et ton coach ne voit '
  +'que le résultat, jamais le détail.';
const REDS_TITRE='Vigilance énergétique';
const REDS_LIB_SIGNAUX=Object.freeze({
  journal_silencieux:'Aucune entrée au journal depuis plus de trois mois',
  regles_absentes:'Absence de règles signalée',
  regles_espacees:'Absences de règles espacées',
  cycle_irregulier:'Cycles irréguliers pendant une sèche',
  restriction_prolongee:'Sèche qui dure',
  apport_bas:'Apports collés au plancher',
  perte_rapide:'Perte de poids rapide',
  sommeil_court:'Nuits courtes',
  douleurs_repetees:'Douleurs répétées à l\'entraînement',
  volume_haut:'Volume au-dessus du repère haut',
  signalement_osseux:'Signalement après un choc'
});
// ── L'écran athlète ───────────────────────────────────────────────────────
let _leafqRep={};
function htmlLeafq(){
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:16px 16px;margin-bottom:16px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:10px">${escapeHtml(REDS_TITRE)}</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.75;margin-bottom:12px">${escapeHtml(LEAFQ_INTRO)}</div>
    ${LEAFQ_ITEMS.map(it=>`<div style="padding:8px 0;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
      <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-bottom:6px">${escapeHtml(it.q)}</div>
      <div style="display:flex;gap:6px">
        ${[['0','Non'],['1','Un peu'],['2','Oui']].map(([v,l])=>
          `<button type="button" onclick="leafqRepondre('${it.k}',${v},this)"
            style="flex:1;min-height:36px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;
              background:var(--surface-1);border:1px solid var(--border);color:var(--sub)">${l}</button>`).join('')}
      </div>
    </div>`).join('')}
    <button class="btn btn-red" style="width:100%;margin-top:14px" onclick="leafqValider()">Envoyer mes réponses</button>
    <button class="btn btn-outline" style="width:100%;margin-top:8px" onclick="leafqPlusTard()">Plus tard</button>
    <button class="btn btn-outline" style="width:100%;margin-top:8px;font-size:var(--fs-2xs)" onclick="leafqNePlusProposer()">Ne plus me proposer</button>
  </div>`;
}
function leafqRepondre(k,v,el){
  _leafqRep[k]=Number(v)||0;
  try{
    const p=el.parentNode;
    for(const b of p.children){ b.style.background='#111'; b.style.borderColor='var(--border)'; b.style.color='var(--sub)'; }
    el.style.background='rgba(224,32,32,.14)'; el.style.borderColor='var(--red)'; el.style.color='var(--text)';
  }catch(e){}
  return true;
}
function leafqValider(){
  const r=scoreLeafq(_leafqRep);
  if(!currentUser.redsScreening||typeof currentUser.redsScreening!=='object')
    currentUser.redsScreening={};
  // Le SCORE est conserve — le coach ne le voit pas, mais une nouvelle
  // passation doit pouvoir se comparer a la precedente.
  currentUser.redsScreening.leafq={date:Date.now(),score:r.score,sub:r.sub};
  const sig=computeRedsSignals(currentUser);
  currentUser.redsScreening.signals=sig;
  applyRedsEffects(currentUser,resolveRedsLevel(sig,r));
  currentUser.redsScreening.lastPromptDate=Date.now();
  _leafqRep={};
  saveUser();
  const z=document.getElementById('prog-reds');
  if(z) z.innerHTML=redsSuspend(currentUser)
    ?`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px;margin-bottom:16px;font-size:var(--fs-sm);color:var(--text);line-height:1.75">${escapeHtml(REDS_RENVOI)}${blocDisclaimerSante()}</div>`
    :'';
  return true;
}
function leafqPlusTard(){
  if(!currentUser.redsScreening||typeof currentUser.redsScreening!=='object')
    currentUser.redsScreening={};
  currentUser.redsScreening.lastPromptDate=Date.now();
  _leafqRep={};
  saveUser();
  const z=document.getElementById('prog-reds');
  if(z) z.innerHTML='';
  return true;
}
// RÈGLE 8 : définitif. Aucun chemin ne le rouvre.
async function leafqNePlusProposer(){
  if(!await rcConfirm('Ne plus proposer ces questions ? Ce choix est définitif.',null,'Ne plus proposer')) return false;
  if(!currentUser.redsScreening||typeof currentUser.redsScreening!=='object')
    currentUser.redsScreening={};
  currentUser.redsScreening.optedOut=true;
  currentUser.redsScreening.lastPromptDate=Date.now();
  _leafqRep={};
  saveUser();
  const z=document.getElementById('prog-reds');
  if(z) z.innerHTML='';
  return true;
}
function renderReds(){
  const z=document.getElementById('prog-reds');
  if(!z) return;
  let h='';
  try{
    if(shouldPromptLeafq(currentUser)) h=htmlLeafq();
    else if(redsSuspend(currentUser))
      h=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px;margin-bottom:16px;font-size:var(--fs-sm);color:var(--text);line-height:1.75">${escapeHtml(REDS_RENVOI)}${blocDisclaimerSante()}</div>`;
  }catch(e){ h=''; }
  z.innerHTML=h;
}
// ── La carte coach ────────────────────────────────────────────────────────
// Niveau, signaux DATÉS, effets. Aucun score, aucune jauge, aucun pourcentage.
function htmlRedsCoach(c){
  const e=redsEtat(c);
  let sig=[];
  try{ sig=computeRedsSignals(c); }catch(err){ sig=[]; }
  if(e.level==='green'&&sig.length<REDS_MIN_SIGNAUX) return '';
  const lib={green:'Rien à signaler',orange:'À surveiller',red:'À traiter en priorité'}[e.level]||'';
  const dat=t=>{ try{ return new Date(t).toLocaleDateString('fr-FR'); }catch(x){ return ''; } };
  return `<div style="background:var(--surface-1);border:1px solid ${e.level==='red'?'var(--red)':'var(--border)'};border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">${escapeHtml(REDS_TITRE)}</span>
      <span style="font-size:var(--fs-xs);font-weight:800;color:${e.level==='red'?'var(--red)':(e.level==='orange'?'var(--orange)':'var(--sub)')}">${escapeHtml(lib)}</span>
    </div>
    ${sig.length?sig.map(x=>`<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--text) 5%,transparent)">
      <span style="font-size:var(--fs-xs);color:var(--text-strong);min-width:0">${escapeHtml(REDS_LIB_SIGNAUX[x.code]||x.code)}</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint);white-space:nowrap;flex-shrink:0">${escapeHtml(dat(new Date(x.date).getTime?new Date(x.date).getTime():Date.now()))}</span>
    </div>`).join('')
    :'<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucun signal actif.</div>'}
    ${e.level!=='green'?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">Objectif de perte de poids en pause. ${escapeHtml(REDS_RENVOI)}</div>`:''}
    ${e.leafq?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:6px">Questionnaire rempli le ${escapeHtml(dat(e.leafq.date))}. Le détail des réponses ne t'est pas transmis.</div>`:''}
    ${blocDisclaimerSante()}
  </div>`;
}
function renderRedsCoach(c){
  const z=document.getElementById('ccd-reds');
  if(!z) return;
  let h=''; try{ h=c?htmlRedsCoach(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
}
// ══════════════ DÉPISTAGE STRUCTURÉ — SCOFF ═══════════════════════════════
// CE QUI EXISTAIT ÉTAIT FAUX. Le statut venait d'une REGEX sur un champ de
// texte libre : /^(non|aucun|aucune|rien|ras|n\/a)\.?$/i, qui exigeait que la
// réponse soit EXACTEMENT l'un de ces six mots. Mesuré sur des formulations
// réelles : « Jamais », « Aucune, jamais », « non, jamais eu » et même
// « aucun trouble alimentaire » déclenchaient tous le risque. Un athlète qui
// répondait honnêtement voyait son plancher relevé de 15 % sans jamais savoir
// pourquoi. La regex est SUPPRIMÉE, pas conservée en filet.
//
// Le champ de texte libre RESTE — le coach le lit — mais plus rien ne
// l'analyse. C'est la différence entre une information et un déclencheur.
//
// LES RÉPONSES INDIVIDUELLES NE SONT PAS CONSERVÉES. La finalité — relever un
// plancher et désactiver un objectif — est atteinte par le seul booléen.
// Garder cinq réponses sur les conduites alimentaires, c'est constituer un
// dossier de santé au sens de l'article 9 sans nécessité.
const SCOFF_SEUIL=2;              // ni paramétrable, ni réglable par le coach
const SCOFF_REPASSAGE_MOIS=6;
// Les cinq questions, dans leur formulation française validée. AUCUNE ne
// nomme un trouble : ni « TCA », ni « anorexie », ni « boulimie ». L'écran non
// plus, et aucun score n'est affiché.
const SCOFF_QUESTIONS=Object.freeze([
  {cle:'s',q:'T\'arrive-t-il de te faire vomir parce que tu te sens mal d\'avoir trop mangé ?'},
  {cle:'c',q:'T\'inquiètes-tu d\'avoir perdu le contrôle de ce que tu manges ?'},
  {cle:'o',q:'As-tu perdu plus de 6 kilos au cours des trois derniers mois ?'},
  {cle:'f',q:'Penses-tu que tu es trop gros(se) alors que d\'autres te trouvent trop mince ?'},
  {cle:'d',q:'Dirais-tu que la nourriture occupe une place dominante dans ta vie ?'}
]);
const SCOFF_MSG_POSITIF='Merci pour tes réponses. Certaines d\'entre elles '
  +'justifient d\'en parler à un professionnel de santé avant de fixer un '
  +'objectif de poids. RepCore ne pose aucun diagnostic. En attendant, ton '
  +'plancher calorique a été relevé et les objectifs de perte de poids sont '
  +'désactivés. Ressource : Anorexie Boulimie Info Écoute, 09 69 325 900.';
const SCOFF_ALERTE_COACH='Bilan de sécurité : vigilance recommandée avant de '
  +'fixer un objectif de poids.';
// Le refus opposé à un objectif de perte. Calqué sur GROSSESSE_REFUS_SECHE —
// même doctrine, même forme — et il ne nomme aucun trouble.
const TCA_REFUS_SECHE='Pas d\'objectif de perte de poids pour le moment. '
  +'Tes réponses au bilan de sécurité invitent à en parler d\'abord à un '
  +'professionnel de santé.';
// Pas de constante de refus pour la pause : l ecran porte deja
// PAUSE_MENTION_TCA, ecrit avant ce lot et couvert par ses propres
// assertions. En ajouter une seconde aurait cree deux textes pour un seul
// refus, et garanti qu ils divergent un jour.

// PURE. RÈGLE 1 : seuil de DEUX sur cinq, en dur.
// RÈGLE 3 : une question sans réponse compte POSITIF. Refuser de répondre à
// « t'arrive-t-il de te faire vomir » n'est pas une absence d'information.
function evaluerScoff(reponses){
  const l=Array.isArray(reponses)?reponses:[];
  let n=0;
  for(let i=0;i<SCOFF_QUESTIONS.length;i++){
    const r=l[i];
    if(r===true) { n++; continue; }
    if(r===false) continue;
    n++;                                    // null, undefined, absent : positif
  }
  return n>=SCOFF_SEUIL;
}
// PURE. Le nombre de positifs, pour les tests SEULEMENT. Il n'est jamais
// affiché : montrer « 3/5 » à quelqu'un, c'est lui donner un score à battre.
function _scoffCompte(reponses){
  const l=Array.isArray(reponses)?reponses:[];
  let n=0;
  for(let i=0;i<SCOFF_QUESTIONS.length;i++) if(l[i]!==false) n++;
  return n;
}
// ÉCRIT. Le SEUL point d'écriture du statut. Les réponses ne sont pas
// transmises plus loin : elles meurent ici.
function appliquerRisqueTca(user,reponses){
  if(!user) return false;
  const risque=evaluerScoff(reponses);
  user.tcaRisque=!!risque;
  user.tcaRisqueDate=Date.now();
  return !!risque;
}
// PURE. LE booléen. Les trois décisions — plancher, objectif de perte, diet
// break — le lisent, et lui seul.
//
// MIGRATION. Un dossier qui n'a jamais passé le questionnaire rend FAUX : on
// ne peut pas déduire un risque d'un texte libre, c'est exactement l'erreur
// qu'on corrige. Conséquence assumée et signalée : un athlète marqué à raison
// par l'ancienne regex perd sa majoration jusqu'à ce qu'il réponde. C'est
// pourquoi scoffAPasser le lui propose, plutôt que de trancher à sa place.
function aTCA(user){
  return !!(user&&user.tcaRisque===true);
}
// PURE. Faut-il proposer le questionnaire ? Jamais passé, ou passé il y a plus
// de six mois — RÈGLE 4 : c'est la seule voie de révocation, et elle ne peut
// pas être déclenchée par une donnée de poids.
function scoffAPasser(user,now){
  if(!user) return false;
  const t=(typeof now==='number')?now:Date.now();
  const d=Number(user.tcaRisqueDate)||0;
  if(!d) return true;
  return (t-d)>=SCOFF_REPASSAGE_MOIS*30.44*864e5;
}
// PURE. RÈGLE 6 : grossesse ou allaitement priment. Un seul message, celui qui
// existe déjà — on ne crée pas une seconde doctrine de suspension.
function refusObjectifPerte(user){
  try{ if(grossesseSuspend(user)) return GROSSESSE_REFUS_SECHE; }catch(e){}
  if(aTCA(user)) return TCA_REFUS_SECHE;
  // Vigilance energetique : troisieme motif, meme point d entree. L ordre
  // est celui de la doctrine — la grossesse d abord, puis le bilan de
  // securite, puis les signaux croises.
  try{ if(redsSuspend(user)) return REDS_RENVOI; }catch(e){}
  return '';
}

// ── Pesée du jour, sur l'accueil athlète ────────────────────────────────────
// La carte n'apparaît PAS en mode neutre : inciter à se peser tous les jours
// est précisément ce qu'on ne veut pas faire à quelqu'un qui a déclaré un
// antécédent de trouble alimentaire.
function dernierePesee(user){
  const s=serieWeight(user);
  return s.length?s[s.length-1]:null;
}
function poidsAffiche(user){
  const d=dernierePesee(user);
  return d?d.kg:null;
}
function renderCartePesee(){
  const z=document.getElementById('clh-pesee');
  if(!z) return;
  // Même prudence que pour l'antécédent alimentaire : on n'incite pas à se
  // peser tous les jours quelqu'un dont plusieurs signaux de déficit se
  // cumulent déjà.
  let _defBloque=false;
  try{ _defBloque=(paliersDeficit(currentUser)==='blocage'); }catch(e){}
  if(!currentUser||aTCA(currentUser)||currentUser.masquerPoids||_defBloque){ z.innerHTML=''; return; }
  // ⚠ ET ELLE SE TAIT QUAND LE POINT DU JOUR POSE DEJA LA QUESTION DU POIDS.
  // Le lundi, sans cette ligne, l'accueil affichait DEUX champs de pesee a
  // quinze centimetres l'un de l'autre. Le point du jour disparait des que la
  // pesee est faite — c'est sa regle — et cette carte revient aussitot, avec
  // sa moyenne sur sept jours et sa coche. On ne perd donc rien : on retarde
  // l'affichage de la moyenne du temps que la question soit repondue.
  try{ const p=pdjEtat(currentUser,Date.now());
       if(p&&p.question==='poids'){ z.innerHTML=''; return; } }catch(e){}
  const auj=localISODate(new Date());
  const serie=serieWeight(currentUser);
  const dujour=serie.find(e=>e.date===auj);
  const moy=mm7(serie,auj);
  const der=serie.length?serie[serie.length-1]:null;
  // Ce qui manque est dit franchement plutôt que laissé vide.
  let sous;
  if(moy!=null) sous='Moyenne 7 jours : <b style="color:var(--text)">'+moy.toFixed(1)+' kg</b>';
  else{
    const fen=serie.filter(e=>e.date>=_jourPlus(auj,-(PESEE_FENETRE_MM-1))).length;
    // « … cette semaine avant une moyenne fiable » faisait 53 caracteres et
    // passait a la ligne sur tout telephone. Kevin voulait un seul rang
    // (15/09/2026) ; le corps ne peut pas descendre — une assertion interdit
    // tout texte sous 11 px sur cet ecran — donc c'est la PHRASE qui se
    // raccourcit. « Cette semaine » ne se perd pas : le compte est deja
    // celui de la fenetre de sept jours, il ne disait rien de plus.
    sous='Encore '+(PESEE_MM_MIN-fen)+' pesée'+((PESEE_MM_MIN-fen)>1?'s':'')
      +' avant une moyenne fiable';
  }
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;margin-bottom:16px;box-shadow:var(--e2)">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--red-text);text-transform:uppercase">Pesée du jour</span>
      ${dujour?`<span style="font-size:var(--fs-2xs);color:var(--green);font-weight:700">${icon('coche',14)} ${dujour.kg} kg</span>`:''}
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <!-- La boîte, et non le champ, porte la bordure : c'est elle qui doit
           contenir le couple « nombre + unité ». Un clic n'importe où dedans
           donne le focus au champ, sinon la moitié de la surface serait morte. -->
      <label class="pes-boite" for="pesee-input">
        <span class="pes-duo">
          <input type="number" id="pesee-input" inputmode="decimal" step="0.1"
            min="${PESEE_MIN}" max="${PESEE_MAX}" placeholder="${der?der.kg:'-'}"
            value="${dujour?dujour.kg:''}" class="pes-champ">
          <span class="pes-unite">kg</span>
        </span>
      </label>
      <button class="btn btn-red btn-sm" onclick="savePesee()" style="height:44px;padding:0 20px;letter-spacing:1px;white-space:nowrap">${dujour?'Corriger':'Valider'}</button>
    </div>
    <div class="pes-sous">${sous}</div>
  </div>`;
}
// ══ UNE PESEE S'ENREGISTRE EN UN SEUL ENDROIT ═══════════════════════════
//
// Extraite de savePesee le 15/09/2026, quand « Ton point du jour » a eu besoin
// d'enregistrer la meme pesee depuis un autre champ. Deux copies de ces six
// lignes auraient diverge, et c'est la GARDE D'ECART qui aurait diverge la
// premiere : un ecart de plusieurs kilos en un jour est presque toujours une
// virgule ou un chiffre de trop, et une seconde porte d'entree sans cette
// confirmation aurait laisse entrer 784 kg pour 78,4.
//
// Rend true quand la pesee est ecrite, false quand elle est refusee ou que la
// confirmation est declinee. L'APPELANT decide de ce qu'il repeint : savePesee
// refait sa carte, le point du jour se referme.
async function _enregistrerPesee(v,jour){
  // LA PORTE DE L'ARTICLE 9. Ici et non dans _recordWeight : la primitive est
  // aussi appelee par l'import et par la fusion de synchronisation, ou il n'y
  // a personne pour repondre a une question. C'est le GESTE qui la pose.
  if(!demanderConsentementSante('poids',()=>_enregistrerPesee(v,jour))) return false;
  if(isNaN(v)||v<PESEE_MIN||v>PESEE_MAX){
    toast('Saisis un poids entre '+PESEE_MIN+' et '+PESEE_MAX+' kg','var(--red)'); return false; }
  const auj=jour||localISODate(new Date());
  // Comparaison à la dernière pesée ANTÉRIEURE : un écart de plusieurs kilos
  // en un jour est presque toujours une virgule ou un chiffre de trop.
  const ant=serieWeight(currentUser).filter(e=>e.date<auj).slice(-1)[0];
  if(ant&&Math.abs(v-ant.kg)>PESEE_ECART_CONFIRM
     &&!await rcConfirm('Écart de '+Math.abs(v-ant.kg).toFixed(1)+' kg avec ta dernière pesée ('+ant.kg+' kg).\n\nC\'est bien '+v+' kg ?',null,'Confirmer')) return false;
  if(!_recordWeight(auj,v)){ toast('Pesée refusée','var(--red)'); return false; }
  toastEcriture(saveUser(),'Pesée enregistrée '+ICO.coche,'ta pesée est');
  return true;
}
async function savePesee(){
  const inp=document.getElementById('pesee-input');
  if(!inp) return;
  const v=parseFloat(String(inp.value).replace(',','.'));
  if(await _enregistrerPesee(v,localISODate(new Date()))) renderCartePesee();
}
// ── Onglet Poids : la courbe (refonte du 26/09/2026, maquette de Kevin) ────
// UN SEUL DESSIN pour l'athlete (Evolution > Poids) et pour le coach (fiche,
// « Poids ») : _carteCourbePoids pose la carte — titre, periodes, courbe,
// legende — et _courbePesee trace le corps. Ce qui est dessine :
//   - LE RELEVE : les pesees, reliees par un trait plein, en anneaux ;
//   - LA TENDANCE : la moyenne sur sept jours (mm7), en pointille, une par
//     segment — elle s'interrompt a chaque longue coupure ;
//   - LA PLAGE DE VARIATION : du plus bas au plus haut des pesees des sept
//     derniers jours, la ou la tendance existe ;
//   - la derniere pesee, soulignee, avec sa bulle : le poids, et l'ecart
//     depuis le debut de la periode affichee.
// SANS TENDANCE (moins de quatre pesees dans une semaine), les pesees sont
// reliees EN POINTILLE, et l'encadre du bas le dit : c'est le cas de
// l'athlete qui ne se pese qu'aux bilans.
//
// ⚠ LES POINTS ET LES LIBELLES SONT DU HTML POSE PAR-DESSUS LE SVG. Le SVG est
//   etire (preserveAspectRatio="none") pour remplir la largeur : un cercle y
//   devenait un ovale, et un texte y serait deforme. Les traits, eux, gardent
//   leur epaisseur (vector-effect="non-scaling-stroke").
const PESEE_COURBE_JOURS=84;                    // la periode par defaut : 12 semaines
const PESEE_PERIODES=Object.freeze([
  Object.freeze({k:'7J',j:7,lib:'7 jours'}),Object.freeze({k:'4S',j:28,lib:'4 semaines'}),
  Object.freeze({k:'12S',j:84,lib:'12 semaines'}),Object.freeze({k:'6M',j:182,lib:'6 mois'}),
  Object.freeze({k:'1A',j:365,lib:'1 an'})]);
let _pesPeriode='12S';
// Les cartes a l'ecran : id → {serie, opts}. Un clic sur une periode refait la sienne.
const _pesCartes=new Map();
/** PURE. Des graduations rondes (1, 2 ou 5 kg) qui encadrent [mn, mx]. */
function _pesGraduations(mn,mx){
  const et=Math.max(0.5,mx-mn);
  const pas=[0.5,1,2,5,10,20].find(p=>et/p<=5)||20;
  const bas=Math.floor(mn/pas)*pas, haut=Math.ceil(mx/pas)*pas;
  const out=[]; for(let v=bas;v<=haut+1e-9;v+=pas) out.push(Math.round(v*10)/10);
  if(out.length<2) out.push(Math.round((bas+pas)*10)/10);
  return out;
}
/**
 * Le corps de la courbe. `opts` (FACULTATIF) :
 *   jours     — la fenetre, comptee depuis la derniere pesee (84 par defaut) ;
 *   couleur   — (ecartKg)=>couleur CSS de l'ecart dans la bulle ;
 * Declare le trait dessine dans _courbePesee.dernierTrait : 'moyenne' ou 'pesees'.
 */
function _courbePesee(serie,opts){
  const o=opts||{};
  _courbePesee.dernierTrait='';
  if(!serie||serie.length<2) return '';
  const fin=serie[serie.length-1].date;
  const debut=_jourPlus(fin,-((o.jours||PESEE_COURBE_JOURS)-1));
  const pts=serie.filter(e=>e.date>=debut);
  if(pts.length<2) return '';
  const segs=segmentsWeight(pts);
  const jours=_joursEntre(pts[0].date,fin)||1;
  // LA TENDANCE ET LA PLAGE, segment par segment.
  const plage=(seg,d)=>{ const f=seg.filter(e=>e.date<=d&&e.date>=_jourPlus(d,-(PESEE_FENETRE_MM-1))).map(e=>e.kg);
    return f.length?[Math.min(...f),Math.max(...f)]:null; };
  const courbes=segs.map(seg=>{
    const t=[];
    for(const e of seg){ const v=mm7(seg,e.date); if(v!=null) t.push({d:e.date,v,p:plage(seg,e.date)}); }
    return t.length>=2?t:null;
  }).filter(Boolean);
  const brut=!courbes.length;
  // L'ECHELLE couvre les pesees ET la plage : rien ne sort du cadre.
  const vals=pts.map(e=>e.kg);
  courbes.forEach(t=>t.forEach(x=>{ if(x.p) vals.push(x.p[0],x.p[1]); }));
  let mn=Math.min(...vals), mx=Math.max(...vals);
  if(mx-mn<1){ const c=(mx+mn)/2; mn=c-0.5; mx=c+0.5; }   // série plate : bande d'1 kg
  const grad=_pesGraduations(mn-(mx-mn)*0.08,mx+(mx-mn)*0.08);
  const g0=grad[0], g1=grad[grad.length-1];
  const X=d=>(_joursEntre(pts[0].date,d)/jours)*100;
  const Y=v=>100-((v-g0)/(g1-g0))*100;
  const f2=n=>n.toFixed(2);
  // L'IDENTIFIANT EST UNIQUE PAR TRACE : plusieurs courbes restent dans le
  // document une fois rendues, et url(#...) prend la premiere venue.
  const gid='pesAire'+(_courbePesee._n=(_courbePesee._n||0)+1);
  const aires=[], tendances=[];
  courbes.forEach(t=>{
    const avecP=t.filter(x=>x.p);
    if(avecP.length>=2){
      const haut=avecP.map((x,i)=>(i?'L':'M')+f2(X(x.d))+' '+f2(Y(x.p[1]))).join(' ');
      const bas=avecP.slice().reverse().map(x=>'L'+f2(X(x.d))+' '+f2(Y(x.p[0]))).join(' ');
      aires.push(`<path d="${haut} ${bas} Z" fill="url(#${gid})" stroke="none"/>`);
    }
    tendances.push(`<path data-trait="moyenne" d="${t.map((x,i)=>(i?'L':'M')+f2(X(x.d))+' '+f2(Y(x.v))).join(' ')}" fill="none"
      stroke="#ff5a5a" stroke-width="1.8" stroke-dasharray="7 5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85"/>`);
  });
  // LE RELEVE : trait plein avec une tendance, pointille sans (et l'encadre le dit).
  // Il s'interrompt lui aussi a chaque longue coupure.
  const segsR=(brut?[pts]:segs).filter(seg=>seg.length>=2);
  const dR=seg=>seg.map((e,i)=>(i?'L':'M')+f2(X(e.date))+' '+f2(Y(e.kg))).join(' ');
  const releves=segsR.map(seg=>`<path class="pc-rel" data-trait="releve" d="${dR(seg)}" fill="none"
      stroke="#ff2a2a" stroke-width="${brut?2.2:2.8}"${brut?' stroke-dasharray="7 5"':''}
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`).join('');
  // L'AIRE SOUS LE RELEVE, du trait jusqu'au bas du cadre : le rouge de la maquette.
  const gidS='pesSous'+_courbePesee._n;
  const sous=segsR.map(seg=>`<path d="${dR(seg)} L${f2(X(seg[seg.length-1].date))} 100 L${f2(X(seg[0].date))} 100 Z" fill="url(#${gidS})" stroke="none"/>`).join('');
  const defs=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:#ff2a2a;stop-opacity:.30"/>
      <stop offset="1" style="stop-color:#ff2a2a;stop-opacity:.12"/>
    </linearGradient><linearGradient id="${gidS}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--red);stop-opacity:.42"/>
      <stop offset=".55" style="stop-color:#b01010;stop-opacity:.16"/>
      <stop offset="1" style="stop-color:#b01010;stop-opacity:0"/>
    </linearGradient></defs>`;
  // Les points : chaque pesee, et la derniere, soulignee une seule fois.
  const der=pts[pts.length-1];
  const pasA=Math.max(1,Math.ceil(pts.length/6));
  const points=pts.map((e,i)=>`<span class="pc-pt${i===pts.length-1?' pc-der':((i%pasA===0)?' pc-pt-a':'')}" style="left:${f2(X(e.date))}%;top:${f2(Y(e.kg))}%"></span>`).join('');
  // La bulle : le poids, et l'ecart depuis le debut de la periode affichee.
  const ecart=Math.round((der.kg-pts[0].kg)*10)/10;
  const coulE=(typeof o.couleur==='function')?o.couleur(ecart):'var(--sub)';
  const yD=Y(der.kg);
  const bulle=`<div class="pc-bulle${yD<30?' pc-bulle-bas':''}" style="top:${f2(yD)}%">
      <b>${_synNombre(der.kg)} kg</b><span style="color:${coulE}">${ecart>0?'+':(ecart<0?'−':'')}${_synNombre(Math.abs(ecart))} kg</span></div>`;
  // Les graduations et les dates : du HTML, jamais du texte etire.
  const lignes=grad.map(v=>`<div class="pc-g" style="top:${f2(Y(v))}%"><span>${String(v).replace('.',',')}</span></div>`).join('');
  const nX=Math.min(5,Math.max(2,jours>=6?5:2));
  const dates=[];
  for(let i=0;i<nX;i++){ const d=_jourPlus(pts[0].date,Math.round(jours*i/(nX-1)));
    if(!dates.some(x=>x===d)) dates.push(d); }
  const xs=dates.map((d,i)=>`<span style="left:${f2(X(d))}%" class="${i===0?'pc-x0':(i===dates.length-1?'pc-x1':'')}">${_fmtJourCourt(d)}</span>`).join('');
  _courbePesee.dernierTrait=brut?'pesees':'moyenne';
  const legende=`<div class="pc-leg">
      <span><i class="pc-l-pt"></i>Poids relevé</span>
      ${brut?'<span><i class="pc-l-poin"></i>Pesées reliées</span>'
        :'<span><i class="pc-l-tend"></i>Tendance (moy. 7 jours)</span>'+(aires.length?'<span><i class="pc-l-plage"></i>Plage de variation</span>':'')}
    </div>`;
  return `<div class="pc">
      <div class="pc-cadre">${lignes}
        <div class="pc-zone">
          <svg class="arc-courbe" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${defs}${sous}${aires.join('')}${releves}${tendances.join('')}
          </svg>
          ${points}${bulle}
        </div>
      </div>
      <div class="pc-x">${xs}</div>
      ${legende}
      ${brut?`<div class="pc-note"><span class="pc-note-i" aria-hidden="true">${_pesIcone('barres')}</span><div>
Trait en pointillé : les pesées reliées entre elles. La moyenne sur sept jours demande quatre pesées dans la même semaine, elle prendra le relais dès que tu te pèseras plus souvent.</div></div>`:''}
    </div>`;
}
function _fmtJourCourt(iso){
  const [a,m,j]=String(iso).split('-');
  return j+'/'+m;
}
/** Les deux pictogrammes de la maquette : l'eclair de la vitesse, les barres du graphique. */
function _pesIcone(k){
  if(k==='eclair') return '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><path d="M13.2 2 4.5 13.4h6.2L9.6 22l9.9-12.6h-6.4L13.2 2z"/></svg>';
  return '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><rect x="3" y="13" width="4.2" height="8" rx="1"/><rect x="9.9" y="8" width="4.2" height="13" rx="1"/><rect x="16.8" y="3" width="4.2" height="18" rx="1"/></svg>';
}
/**
 * La carte complete : titre, periodes, courbe. `opts` :
 *   id       — l'identifiant de la carte (un par ecran) ;
 *   couleur  — (ecartKg)=>couleur de l'ecart ;
 *   periodes — false pour masquer le choix (la fiche coach suit alors SA periode) ;
 *   jours    — impose la fenetre (sinon, la periode choisie).
 */
function _carteCourbePoids(serie,opts){
  const o=Object.assign({id:'pc-carte'},opts||{});
  _pesCartes.set(o.id,{serie,opts:o});
  const per=PESEE_PERIODES.find(p=>p.k===_pesPeriode)||PESEE_PERIODES[2];
  const jours=o.jours||per.j;
  const corps=_courbePesee(serie,Object.assign({},o,{jours}));
  const choix=o.periodes===false?'':`<div class="pc-per" role="group" aria-label="Période du graphique">${PESEE_PERIODES.map(p=>
      `<button type="button" class="${p.k===per.k?'actif':''}" aria-pressed="${p.k===per.k}" title="${p.lib}" onclick="pesPeriode('${o.id}','${p.k}')">${p.k}</button>`).join('')}</div>`;
  const vide=(serie&&serie.length>=2)
    ?'<div class="graphe-vide">Moins de deux pesées sur '+escapeHtml(o.jours?'cette période':per.lib)+' : choisis une période plus longue.</div>'
    :'<div class="graphe-vide">Au moins deux pesées sont nécessaires pour tracer une courbe.</div>';
  return `<div class="evo-carte pc-carte" id="${o.id}">
      <div class="pc-tete">
        <span class="pc-ico" aria-hidden="true">${_pesIcone('barres')}</span>
        <span class="pc-titre">Évolution du poids</span>
        ${choix}
      </div>
      ${corps||vide}
    </div>`;
}
/**
 * LES COURBES DES MENSURATIONS, AU DESSIN DE LA COURBE DU POIDS (26/09/2026,
 * demande de Kevin : « applique le même design »). Memes graduations, meme
 * trait epais a halo, meme aire degradee, memes points et meme bulle — mais
 * PLUSIEURS courbes possibles (droite / gauche), chacune dans SA couleur :
 * c'est elle qui les distingue, et la legende la reprend.
 * Les points sont places a la DATE de leur bilan : deux bilans a trois
 * semaines d'ecart ne sont pas a la meme distance que deux bilans a deux mois.
 * @param {{label:string,color:string,pts:{d:string,v:number}[]}[]} series  d = date ISO
 * @param {{unite?:string,couleur?:(ecart:number)=>string}} [opts]
 */
function _courbeMesures(series,opts){
  const o=opts||{}, u=o.unite||'cm';
  const S=(series||[]).map(s=>Object.assign({},s,{pts:(s.pts||[]).filter(p=>p&&p.d&&isFinite(p.v)).sort((a,b)=>a.d<b.d?-1:(a.d>b.d?1:0))}))
    .filter(s=>s.pts.length>=2);
  if(!S.length) return '';
  const tous=[].concat(...S.map(s=>s.pts));
  const d0=tous.reduce((m,p)=>p.d<m?p.d:m,tous[0].d), d1=tous.reduce((m,p)=>p.d>m?p.d:m,tous[0].d);
  const jours=_joursEntre(d0,d1)||1;
  const vals=tous.map(p=>p.v);
  let mn=Math.min(...vals), mx=Math.max(...vals);
  if(mx-mn<1){ const c=(mx+mn)/2; mn=c-0.5; mx=c+0.5; }
  const grad=_pesGraduations(mn-(mx-mn)*0.1,mx+(mx-mn)*0.1);
  const g0=grad[0], g1=grad[grad.length-1];
  const X=d=>(_joursEntre(d0,d)/jours)*100;
  const Y=v=>100-((v-g0)/(g1-g0))*100;
  const f2=n=>n.toFixed(2);
  const n=(_courbeMesures._n=(_courbeMesures._n||0)+1);
  let defs='', sous='', traits='', points='';
  S.forEach((s,k)=>{
    const id='mesSous'+n+'_'+k, d=s.pts.map((p,i)=>(i?'L':'M')+f2(X(p.d))+' '+f2(Y(p.v))).join(' ');
    defs+=`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:${s.color};stop-opacity:${S.length>1?.22:.40}"/>
      <stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient>`;
    sous+=`<path d="${d} L${f2(X(s.pts[s.pts.length-1].d))} 100 L${f2(X(s.pts[0].d))} 100 Z" fill="url(#${id})" stroke="none"/>`;
    traits+=`<path class="pc-rel" data-serie="${k}" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.6"
      stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"
      style="filter:drop-shadow(0 0 3px ${s.color}) drop-shadow(0 0 7px ${s.color}88)"/>`;
    const pas=Math.max(1,Math.ceil(s.pts.length/6));
    points+=s.pts.map((p,i)=>{
      const der=i===s.pts.length-1;
      const cls='pc-pt'+(der?' pc-der':((i%pas===0)?' pc-pt-a':''));
      const st=der?`border-color:${s.color};box-shadow:0 0 0 4px ${s.color}44,0 0 14px ${s.color}`
        :((i%pas===0)?`border-color:${s.color};box-shadow:0 0 8px ${s.color}`:`background:${s.color};box-shadow:0 0 5px ${s.color}`);
      return `<span class="${cls}" style="left:${f2(X(p.d))}%;top:${f2(Y(p.v))}%;${st}"></span>`;
    }).join('');
  });
  // LA BULLE : la derniere valeur de chaque courbe, et son ecart depuis la premiere.
  const lignesB=S.map(s=>{
    const a=s.pts[0].v, z=s.pts[s.pts.length-1].v, e=Math.round((z-a)*10)/10;
    const c=(typeof o.couleur==='function')?o.couleur(e):'var(--sub)';
    return `<div class="pc-b-l">${S.length>1?`<i style="background:${s.color}"></i>`:''}<b>${_synNombre(z)} ${u}</b>`
      +`<span style="color:${c}">${e>0?'+':(e<0?'−':'')}${_synNombre(Math.abs(e))} ${u}</span></div>`;
  }).join('');
  const yB=Math.min(...S.map(s=>Y(s.pts[s.pts.length-1].v)));
  const bulle=`<div class="pc-bulle pc-bulle-m${yB<34?' pc-bulle-bas':''}" style="top:${f2(yB)}%">${lignesB}</div>`;
  const lignes=grad.map(v=>`<div class="pc-g" style="top:${f2(Y(v))}%"><span>${String(v).replace('.',',')}</span></div>`).join('');
  // Les dates : celles des bilans, jusqu'a cinq, sans chevauchement.
  const ds=[...new Set(tous.map(p=>p.d))].sort();
  const pasD=Math.max(1,Math.ceil(ds.length/5));
  const choix0=ds.filter((d,i)=>i%pasD===0||i===ds.length-1);
  // ⚠ DEUX BILANS A DEUX SEMAINES D'ECART SE CHEVAUCHAIENT sur un telephone
  //   (« 21/0605/07 »). Une etiquette trop pres de la precedente saute ; la
  //   derniere date reste toujours, c'est elle qu'on lit.
  const ECART_MIN_X=16;
  const choix=[];
  choix0.forEach((d,i)=>{
    const dern=i===choix0.length-1;
    if(!choix.length||X(d)-X(choix[choix.length-1])>=ECART_MIN_X){ choix.push(d); return; }
    if(dern&&choix.length>1) choix[choix.length-1]=d;
    else if(dern) choix.push(d);
  });
  const xs=choix.map((d,i)=>`<span style="left:${f2(X(d))}%" class="${X(d)<8?'pc-x0':(X(d)>92?'pc-x1':'')}">${_fmtJourCourt(d)}</span>`).join('');
  const legende=`<div class="pc-leg">${S.map(s=>`<span><i class="pc-l-pt" style="border-color:${s.color};box-shadow:0 0 6px ${s.color}"></i>${escapeHtml(s.label||'Mesure relevée')}</span>`).join('')}</div>`;
  return `<div class="pc pc-m">
      <div class="pc-cadre">${lignes}
        <div class="pc-zone">
          <svg class="arc-courbe" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>${defs}</defs>${sous}${traits}
          </svg>
          ${points}${bulle}
        </div>
      </div>
      <div class="pc-x">${xs}</div>
      ${legende}
    </div>`;
}
/** Un clic sur une periode : la carte se refait, les autres ne bougent pas. */
function pesPeriode(id,k){
  if(!PESEE_PERIODES.some(p=>p.k===k)) return false;
  _pesPeriode=k;
  const c=_pesCartes.get(id), z=document.getElementById(id);
  if(!c||!z){ _pesCartes.delete(id); return false; }
  const t=document.createElement('div'); t.innerHTML=_carteCourbePoids(c.serie,c.opts);
  const neuf=t.firstElementChild; if(!neuf) return false;
  z.replaceWith(neuf);
  try{ if(typeof arcTracerCourbes==='function') arcTracerCourbes(neuf); }catch(e){}
  return true;
}
// Encadré vitesse. En mode neutre il n'est jamais construit — pas caché : pas
// construit du tout, pour qu'aucun chemin d'affichage ne puisse le ressortir.
function _blocVitesse(user){
  // Bornée à la phase : voir serieVitesse.
  const v=vitesseHebdo(serieVitesse(user));
  if(!v){
    return `<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
      Pas encore de tendance : il faut environ trois semaines de pesées, à raison
      d'au moins quatre par semaine. Les pesées isolées ne suffisent pas à
      distinguer une variation d'eau d'une variation réelle.</div>`;
  }
  const cible=cibleVitesse(user);
  const alerte=vitesseAlerte(v.pctSem,cible);
  const c=alerte?'var(--orange)':'var(--text)';
  const signe=v.kgSem>0?'+':'';
  let phrase;
  if(alerte) phrase=cible.phase
    ? 'Au-delà de ce qui est visé en '+cible.lib+'. À revoir avec ton coach.'
    : 'Variation rapide. Si ce n\'est pas voulu, parles-en à ton coach.';
  else if(Math.abs(v.pctSem)<0.15) phrase='Poids stable sur les deux dernières semaines.';
  else phrase='Variation régulière, sans à-coup.';
  return `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
      <span style="font-size:var(--fs-xl);font-weight:400;color:${c};font-family:var(--pile-titre);letter-spacing:1px">${signe}${v.kgSem.toFixed(2)} kg</span>
      <span style="font-size:var(--fs-sm);color:var(--sub)">par semaine</span>
      <span style="font-size:var(--fs-sm);color:${c};font-weight:700">${signe}${v.pctSem.toFixed(2)} %</span>
    </div>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:6px">${escapeHtml(phrase)}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">Pente sur ${v.points} moyennes glissantes, quatorze derniers jours.</div>`;
}
// Bloc complet de l'onglet. Le garde-fou est la PREMIÈRE chose lue : tout ce
// qui suit est inatteignable en mode neutre.
function blocPoids(user){
  if(user&&user.masquerPoids){
    return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;text-align:center">
      <div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6;margin-bottom:12px">Le suivi du poids est masqué.</div>
      <button class="btn btn-outline btn-sm" onclick="togglePoidsMasque()" style="letter-spacing:1px">Réafficher</button>
    </div>`;
  }
  const serie=serieWeight(user);
  const neutre=aTCA(user);
  const dep=serie.length?serie[0].kg:null, act=serie.length?serie[serie.length-1].kg:null;
  const diff=(dep!=null&&act!=null)?Math.round((act-dep)*10)/10:null;
  // Mode neutre : ni couleur de verdict, ni vitesse, ni cible, ni alerte.
  const colEvol=neutre?'var(--sub)':couleurEvolution(user,diff);
  // UN CRAN PLUS PETIT, a la demande de Kevin : « 103.8KG » remplissait la
  // boite d un bord a l autre. La classe existe deja — .metric-row-compacte,
  // posee pour la rangee des paiements — et elle dit exactement cela : le cran
  // en dessous. On la reutilise plutot que d ecrire une seconde fois la meme
  // taille. L ACCUEIL NE BOUGE PAS : blocPoids n est rendu qu ici, dans
  // l onglet Poids de l ecran Evolution, et la classe ne descend que sur cette
  // rangee-ci.
  const entete=`<div class="metric-row-compacte" style="display:flex;gap:8px;margin-bottom:14px">
      <div class="metric-box"><div class="metric-val">${dep??'-'}kg</div><div class="metric-label">Départ</div></div>
      <div class="metric-box"><div class="metric-val">${act??'-'}kg</div><div class="metric-label">Actuel</div></div>
      <div class="metric-box"><div class="metric-val" style="color:${colEvol}">${diff!=null?(diff>0?'+':'')+diff+'kg':'-'}</div><div class="metric-label">Évolution</div></div>
    </div>`;
  // LA COURBE, ET SA LEGENDE AVEC ELLE (refonte du 26/09/2026) : c'est
  // _courbePesee qui sait si le trait est une moyenne ou les pesees reliees,
  // et c'est donc elle qui l'ecrit, sous le trace.
  // Mode neutre : l'ecart de la bulle reste neutre, sans couleur de verdict.
  const courbe=_carteCourbePoids(serie,{id:'pc-athlete',
    couleur:e=>neutre?'var(--sub)':couleurEvolution(user,e)});
  const vitesse=neutre?'':`<div class="evo-carte pv-carte">
      <span class="pv-ico" aria-hidden="true">${_pesIcone('eclair')}</span>
      <div class="pv-c">
        <div class="evo-titre pv-t">Vitesse</div>
        ${_blocVitesse(user)}
      </div>
    </div>`;
  const neutreNote=neutre?`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
      Tu as signalé un antécédent de trouble du comportement alimentaire dans ton
      questionnaire de départ. RepCore affiche donc tes pesées telles quelles,
      sans vitesse, sans objectif et sans alerte. Tu peux masquer complètement
      cette page, ou en parler avec ton coach.</div>`:'';
  const noteCycle=isFemale(user&&(user.gender||user._evol_gender))
    ? `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:10px">
        La rétention d'eau de la seconde moitié du cycle déplace couramment le poids
        de 1 à 2 kg. La moyenne sur sept jours en absorbe une partie, pas la totalité :
        comparer une semaine à la même semaine du cycle précédent reste plus juste.</div>`:'';
  return entete+neutreNote+vitesse+courbe+noteCycle
    +`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:10px">
       RepCore n'est pas un dispositif médical et ne remplace pas un avis professionnel.</div>
     <button class="btn btn-outline btn-sm" onclick="togglePoidsMasque()" style="letter-spacing:1px;font-size:var(--fs-2xs);margin-bottom:14px">Masquer le suivi du poids</button>`;
}
function togglePoidsMasque(){
  if(!currentUser) return;
  currentUser.masquerPoids=!currentUser.masquerPoids;
  saveUser();
  // R32 — la synthese suit : masque, le poids en sort aussitot.
  try{ _renderSyntheseProgression(); }catch(e){}
  showProgressTab('poids',document.querySelector('#prog-tabs button'));
  renderCartePesee();
}
// ── Poids, vue coach ────────────────────────────────────────────────────────
// Le coach voit la vitesse de son athlète, et surtout : il est PRÉVENU quand
// l'athlète est en mode neutre. Sans cet encart, le coach verrait un écran de
// poids amputé sans comprendre pourquoi, et redemanderait à l'athlète les
// chiffres que l'app a délibérément cessé d'afficher.
function blocPoidsCoach(user,depuis){
  if(!user) return '';
  // ⚠ LA PERIODE NE CADRE QUE LE TRACE. La vitesse hebdomadaire vient d'un
  //   protocole de mesure (moyenne mobile a sept jours, fenetre de quatorze ou
  //   vingt-huit jours) : la recadrer sur ce que le coach a choisi de REGARDER
  //   changerait un chiffre qui sert a proposer un ajustement calorique.
  const _pDep=Number(depuis)||0;
  const neutre=aTCA(user);
  const serie=serieWeight(user);
  if(neutre){
    return `<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--warning);text-transform:uppercase;margin-bottom:8px">Suivi du poids en mode neutre</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
        Un antécédent de trouble du comportement alimentaire est déclaré dans le
        questionnaire de départ. Ni vitesse, ni objectif, ni alerte de poids ne
        sont affichés à cet athlète, et l'app ne lui propose pas de pesée
        quotidienne. Mesure de prudence produit, pas dispositif clinique : elle
        ne détecte rien, elle se contente de ne pas aggraver.
      </div>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:8px;line-height:1.5">
        ${serie.length?serie.length+' pesée'+(serie.length>1?'s':'')+' au dossier, dernière à '+serie[serie.length-1].kg+' kg.':'Aucune pesée au dossier.'}
      </div>
    </div>`;
  }
  if(!serie.length) return '';
  const v=vitesseHebdo(serieVitesse(user));
  const cible=cibleVitesse(user);
  const alerte=v&&vitesseAlerte(v.pctSem,cible);
  const c=alerte?'var(--orange)':'var(--text)';
  const der=serie[serie.length-1];
  const moy=mm7(serie,der.date);
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Poids</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint)">dernière pesée le ${_fmtJourCourt(der.date)} · à ${_synNombre(SYN_BRUIT_POIDS)} kg près</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
      <span style="font-size:var(--fs-xl);font-weight:400;color:var(--text);font-family:var(--pile-titre);letter-spacing:1px">${_synNombre(der.kg)} kg</span>
      ${moy!=null?`<span style="font-size:var(--fs-xs);color:var(--sub)">moyenne 7 j ${_synNombre(moy)} kg</span>`:''}
    </div>
    ${v?`<div style="font-size:var(--fs-sm);font-weight:700;color:${c};margin-top:6px">
        ${v.kgSem>0?'+':''}${v.kgSem.toFixed(2)} kg/sem · ${v.kgSem>0?'+':''}${v.pctSem.toFixed(2)} %/sem
      </div>
      ${alerte?`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;margin-top:4px">Au-delà du seuil${cible.phase?' de la phase '+cible.lib:''} : à vérifier avec l'athlète.</div>`:''}`
     :`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:6px">Pas assez de pesées pour une vitesse (il en faut au moins quatre par semaine sur trois semaines).</div>`}
    ${_carteCourbePoids(_pDep?serie.filter(e=>{
      try{ return new Date(e.date+'T12:00:00').getTime()>=_pDep; }catch(x){ return true; }
    }):serie,{id:'pc-coach',couleur:e=>couleurEvolution(user,e),
      // LA PERIODE DU COACH PRIME : posee en haut de « Ses courbes », elle cadre
      // deja la serie — pas de second choix de periode dans la carte.
      periodes:!_pDep,jours:_pDep?100000:0})}
    ${_pDep?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">La courbe suit la période choisie dans « Ses courbes ». La vitesse, elle, garde sa fenêtre de mesure.</div>':''}
  </div>`;
}
function renderPoidsCoach(c){
  const z=document.getElementById('ccd-poids');
  if(!z) return;
  let html='';
  try{ html=c?blocPoidsCoach(c,(typeof ccdDepuis==='function')?ccdDepuis():0):''; }catch(e){ html=''; }
  z.innerHTML=html;
}
// ── Choix de phase, côté athlète ────────────────────────────────────────────
// La carte est REFUSABLE et ne revient pas : un refus écrit une date dans
// user.phaseRefusee et la carte disparaît définitivement de l'accueil. Sans ce
// champ, « ne doit pas réapparaître de façon insistante » n'est pas
// implémentable — on ne peut pas distinguer « pas encore décidé » de « non ».
let _phChoix=null;
// Objectif déjà saisi, dans l'ordre du plus récent au plus ancien : le texte
// libre d'un bilan de suivi l'emporte sur les cases cochées à l'inscription.
function _objectifTexte(user){
  const bs=(user&&user.bilans)||[];
  for(let i=bs.length-1;i>=0;i--){
    if(!bs[i]) continue;
    const t=_texteReponse(bs[i]['bil-new-goals']), d=_texteReponse(bs[i]['bil-new-goals-detail']);
    if(t||d) return (t+' '+d).trim();
  }
  const dep=bs.filter(b=>b&&b.type==='depart').slice(-1)[0];
  return dep?_texteReponse(dep['deb-goals']):'';
}
function _htmlChoixPhase(){
  const sugg=suggererPhaseDepuisTexte(_objectifTexte(currentUser));
  if(_phChoix===null) _phChoix=sugg;
  // ⚠ PEAK WEEK N'EST PAS DANS CETTE LISTE, ET C'EST DELIBERE. C'est une
  // decision de PREPARATION, prise par le coach avec une date de scene en
  // tete ; un athlete qui la choisirait seul ferait taire ses propres alertes
  // de poids sans que personne l'ait decide. PHASES_ATHLETE est la liste des
  // phases qu'on s'autorise a proposer a quelqu'un qui n'a pas de coach.
  const opts=PHASES_ATHLETE.map(t=>{
    const p=PHASES[t], sel=_phChoix===t;
    return `<button onclick="_phSet('${t}')" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;border-radius:var(--r-3);cursor:pointer;
      background:${sel?'#1a0505':'var(--surface-1)'};border:1px solid ${sel?'var(--red)':'var(--border)'}">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
        <span style="font-size:var(--fs-md);font-weight:800;color:${sel?'var(--text)':'var(--text-strong)'}">${p.lib}</span>
        ${sugg===t?'<span style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:1px;text-transform:uppercase">suggéré</span>':''}
      </div>
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:6px">${escapeHtml(p.texte)}</div>
    </button>`;
  }).join('');
  return `<div id="ph-choix-zone">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Ta phase</div>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">
      Ce que tu cherches en ce moment. Ça ne change ni tes séances ni tes macros :
      ça change la façon dont l'app lit tes chiffres.
      ${sugg?'<br>Une suggestion est faite d\'après l\'objectif que tu as déjà indiqué : à toi de confirmer.':''}
    </div>
    ${opts}
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn-red btn-sm" onclick="confirmerPhase()" ${_phChoix?'':'disabled'}
        style="flex:1;letter-spacing:1px${_phChoix?'':';opacity:.45'}">Confirmer</button>
      <button class="btn btn-outline btn-sm" onclick="refuserPhase()" style="flex:0 0 auto;padding:0 14px;letter-spacing:1px;font-size:var(--fs-2xs)">Plus tard</button>
    </div>
  </div>`;
}
function _phSet(t){
  if(!PHASES[t]) return;
  _phChoix=t;
  const z=document.getElementById('ph-choix-zone');
  if(z) z.outerHTML=_htmlChoixPhase();
}
function confirmerPhase(){
  if(!currentUser||!_phChoix) return;
  const t=_phChoix;
  if(!changerPhase(currentUser,t,null,'athlete')) return;
  currentUser.phaseRefusee=null;
  _phChoix=null;
  const ok=saveUser();
  closeModal();
  toastEcriture(ok,PHASES[t].lib+' enregistrée '+ICO.coche,'ta phase est');
  if(document.getElementById('clh-phase')) loadClientHome();
  const bp=document.getElementById('prog-bandeau-phase');
  if(bp) renderBandeauPhase();
}
function refuserPhase(){
  if(!currentUser) return;
  currentUser.phaseRefusee=Date.now();
  _phChoix=null;
  saveUser();
  closeModal();
  renderCartePhase();
}
// La carte de CHOIX de phase ne s'affiche plus sur l'accueil : l'objectif
// pose la même question, en plus précis, et deux réponses pouvaient se
// contredire. La phase reste modifiable depuis la carte d'objectif et depuis
// la fiche coach ; ouvrirChoixPhase reste le point d'entrée.
function renderCartePhase(){
  const z=document.getElementById('clh-phase');
  if(!z) return;
  z.innerHTML=''; return;
  if(!currentUser||phaseCourante(currentUser)||currentUser.phaseRefusee){ z.innerHTML=''; return; }
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
    ${_htmlChoixPhase()}</div>`;
}
function ouvrirChoixPhase(){
  if(!currentUser) return;
  _phChoix=typePhase(currentUser);
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    `<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
      <div onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow:auto">
        ${_htmlChoixPhase()}
      </div></div>`);
}
// Bandeau discret. Volontairement sans couleur de verdict : la phase n'est ni
// un bon ni un mauvais état.
// LE RANG DE SEMAINE N'Y EST PLUS. « Prise de masse · 1re semaine » se lisait
// comme une seule chaîne — Kevin, 15/09/2026 — et le rang n'est pas ce qu'on
// vient chercher ici. Il reste sur la fiche coach, où ordinalSemaine est
// appelée deux fois, et dans la carte d'objectif.
function _htmlBandeauPhase(user){
  const p=phaseCourante(user);
  if(!p) return '';
  return `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:8px 12px;margin-bottom:14px">
    <span style="font-size:var(--fs-xs);color:var(--sub)">Objectif actuel : <b style="color:var(--text-strong)">${PHASES[p.type].lib}</b></span>
    <button onclick="ouvrirChoixPhase()" style="background:none;border:none;padding:0;cursor:pointer;font-size:var(--fs-2xs);letter-spacing:1px;color:var(--red-text);font-weight:700">Changer</button>
  </div>`;
}
function renderBandeauPhase(){
  const h=_htmlBandeauPhase(currentUser);
  for(const id of ['clh-bandeau-phase','prog-bandeau-phase']){
    const z=document.getElementById(id);
    if(!z) continue;
    z.innerHTML=h;
  }
}
function renderRelancePhase(){
  const z=document.getElementById('clh-relance-phase');
  if(!z) return;
  const msg=currentUser?relancePhase(currentUser):null;
  z.innerHTML=msg?`<div style="background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">${escapeHtml(msg)}</div>
    <button class="btn btn-outline btn-sm" onclick="ouvrirChoixPhase()" style="margin-top:10px;letter-spacing:1px;font-size:var(--fs-2xs)">Mettre à jour ma phase</button>
  </div>`:'';
}
// Étiquette compacte, posée à côté des macros. AUCUN calcul n'en découle : la
// phase ne touche pas à nutrition.macros, elle dit seulement dans quel cadre
// ces macros ont été fixées.
function badgePhase(user){
  const p=phaseCourante(user);
  if(!p) return '';
  return `<span style="display:inline-flex;align-items:center;font-size:var(--fs-xs);font-weight:800;color:var(--sub);background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:4px 10px;letter-spacing:1px;text-transform:uppercase">${PHASES[p.type].lib}</span>`;
}
// ── Sélecteur de phase, côté coach ──────────────────────────────────────────
// Le coach décide POUR son athlète : definiPar vaut 'coach'. La phase est
// écrite dans le dossier de l'athlète et poussée, comme la case de décharge.
function renderPhaseCoach(c){
  const z=document.getElementById('ccd-phase');
  if(!z) return;
  let html='';
  try{ html=c?_htmlPhaseCoach(c):''; }catch(e){ html=''; }
  z.innerHTML=html;
}
// PURE. Les jours qui restent avant la date de scene, ou null.
// MIDI, comme partout ailleurs dans ce fichier : 'YYYY-MM-DD' seul s'interprete
// en UTC et decalerait d'un jour a l'ouest de Greenwich.
function joursAvantScene(c){
  const d=((c||{}).phase||{}).scene;
  if(!d) return null;
  const x=new Date(String(d)+'T12:00:00');
  if(isNaN(x.getTime())) return null;
  const auj=new Date(); auj.setHours(12,0,0,0);
  return Math.round((x.getTime()-auj.getTime())/864e5);
}
// La date de scene. Elle n'est demandee QUE pendant une peak week, et elle ne
// commande RIEN : aucun calcul, aucune cible, aucun protocole. Elle sert a
// afficher « J−4 » — le coach, lui, sait ce qu'il fait de ce J−4.
function coachSetPeakDate(v){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.email){ toast('Cet élève n\'a pas encore de dossier synchronisé','var(--orange)'); return false; }
  if(!c.phase) c.phase={};
  c.phase.scene=String(v||'')||null;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Date de scène enregistrée','la date est');
  try{ renderPhaseCoach(getOwnedClient(currentClientId)); }catch(e){}
  return ok;
}
function _htmlPhaseCoach(c){
  const p=phaseCourante(c);
  // LE COACH LES VOIT TOUTES, PEAK WEEK COMPRISE — c'est lui qui prepare une
  // scene. L'athlete, lui, n'a que PHASES_ATHLETE : voir _htmlChoixPhase.
  const boutons=Object.keys(PHASES).map(t=>{
    const sel=p&&p.type===t;
    return `<button onclick="coachSetPhase('${t}')" style="flex:1 1 auto;min-width:88px;padding:10px 6px;border-radius:var(--r-2);cursor:pointer;font-size:var(--fs-xs);font-weight:800;
      background:${sel?'#1a0505':'var(--surface-1)'};border:1px solid ${sel?'var(--red)':'var(--border)'};color:${sel?'var(--text)':'#bbb'}">${PHASES[t].lib}</button>`;
  }).join('');
  // ══ CE QUE LA PEAK WEEK AJOUTE A L'ECRAN, ET RIEN DE PLUS ══════════════
  // UNE DATE, UN DECOMPTE, ET L'AVERTISSEMENT QUI COMPTE : la balance ne dit
  // plus rien cette semaine-la. Aucune consigne de charge, d'eau ni de sodium
  // n'est ecrite ici, et il ne faut pas en ajouter : voir le commentaire de
  // PHASES.peak.
  const _peak=!(p&&p.type==='peak')?'':(function(){
    const j=joursAvantScene(c);
    const d=((c||{}).phase||{}).scene||'';
    const quand=(j===null)?'' : (j>0?('J−'+j):(j===0?'C’est aujourd’hui.':('Passée depuis '+(-j)+' jour'+((-j)>1?'s':'')+'.')));
    return `<div style="margin-top:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label for="ccd-peak-date" style="margin:0;font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase">Date de scène</label>
        <input id="ccd-peak-date" type="date" value="${escapeHtml(d)}" onchange="coachSetPeakDate(this.value)"
          style="flex:1;min-width:140px;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700">
        ${quand?`<span style="font-size:var(--fs-md);font-weight:800;color:var(--red-text);white-space:nowrap">${escapeHtml(quand)}</span>`:''}
      </div>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:8px">Le suivi du poids est neutralisé : cette semaine, la balance suit l’eau et le glycogène, pas le gras. Aucun ajustement automatique n’est proposé. RepCore ne calcule pas de protocole de peak week : la charge, l’eau et le sel restent ta décision, hors de l’application.</div>
    </div>`;
  })();
  // La combinaison sèche + antécédent déclaré est nommée explicitement : c'est
  // exactement le cas où le coach doit savoir que l'écran de son athlète est
  // amputé volontairement, et pourquoi.
  //
  // Et quand cette sèche DURE, la durée est dite au coach. L'athlète, lui,
  // reçoit déjà la relance « c'est long, où en es-tu ? » ; le coach ne recevait
  // rien : il pouvait avoir un athlète à antécédent en déficit depuis six mois
  // sans que rien ne le lui signale, puisque le mode neutre lui retire par
  // ailleurs la courbe de vitesse qui l'aurait alerté. C'est le seul endroit de
  // l'app où le garde-fou RETIRE de l'information au coach, il faut donc la lui
  // rendre autrement. Rien de plus n'est montré à l'athlète.
  const combiTCA=!!(p&&p.type==='seche'&&aTCA(c));
  const semSeche=combiTCA?semainesEcoulees(c):0;
  const combiLongue=combiTCA&&semSeche>=PHASE_SEMAINES_RELANCE;
  const combi=!combiTCA?''
    : `<div style="margin-top:10px;background:${combiLongue?'#1a0505':'var(--warning-bg)'};border:1px solid ${combiLongue?'var(--red)':'var(--warning-border)'};border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
        ${combiLongue?`<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--red-text);margin-bottom:6px">Sèche longue et antécédent déclaré</div>
        Sèche depuis <b style="color:var(--text)">${semSeche} semaines</b>, et un antécédent de trouble du
        comportement alimentaire est déclaré au questionnaire de départ.`
        :`Sèche <b>et</b> antécédent de trouble du comportement alimentaire déclaré.`}
        La sèche reste sélectionnable, mais le mode neutre du suivi du poids
        s'applique intégralement : ni vitesse, ni cible, ni alerte du côté de
        l'athlète. À suivre de près hors de l'application.
      </div>`;
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <!-- LE TITRE EST REVENU le 08/09/2026. Il avait ete retire parce que le
         bandeau de la section « Phase » le disait juste au-dessus : or ce bloc
         a quitte sa section pour remonter en tete de l'onglet, sous le type de
         diete, et plus rien ne le nomme. -->
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:2px;font-weight:800;text-transform:uppercase">Phase</span>
      ${p?`<span style="font-size:var(--fs-2xs);color:var(--text-faint)">${ordinalSemaine(semainesPhase(c))} · ${p.definiPar==='coach'?'définie par toi':'choisie par l\'athlète'}</span>`:''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${boutons}</div>
    ${p?'':`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:8px">Aucune phase définie. Les écrans de cet athlète restent neutres : aucune direction n'est présentée comme un progrès.</div>`}
    ${_peak}
    ${combi}
  </div>`;
}
function coachSetPhase(t){
  if(!PHASES[t]) return;
  // _coachEditClient est une COPIE PROFONDE réservée à l'éditeur de séances :
  // y écrire ne toucherait pas le dossier réel. On repasse par la carte des
  // utilisateurs, comme toute autre écriture sur un athlète.
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.email){ toast('Cet élève n\'a pas encore de dossier synchronisé','var(--orange)'); return; }
  // Reclic sur la phase déjà active : on la retire plutôt que de ne rien
  // faire. C'est le seul moyen de revenir à l'état neutre.
  if(phaseCourante(c)&&phaseCourante(c).type===t){
    const hist=((c.phase&&c.phase.historique)||[]).slice();
    hist.push({type:c.phase.type,debut:c.phase.debut,fin:Date.now()});
    c.phase={type:null,debut:null,finPrevue:null,definiPar:'coach',historique:hist.slice(-PHASE_HIST_MAX)};
  } else if(!changerPhase(c,t,null,'coach')) return;
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  renderPhaseCoach(c);
  try{ renderPoidsCoach(c); }catch(e){}
  // ET LA NUTRITION. Signale par Kevin le 25/08/2026 : « je viens de cliquer
  // sur prise de masse, les chiffres n'ont pas bouge ». La phase commande le
  // delta calorique et la fourchette de vitesse ; en calcul automatique, les
  // cibles en dependent directement. Ce bloc redessinait la phase et le poids
  // et s'arretait la : la grille gardait les chiffres de la phase precedente,
  // et le premier enregistrement les aurait envoyes tels quels.
  //
  // Les autres reglages — proteines, lipides, correction, vitesse — appelaient
  // deja ce rendu depuis leur propre gestionnaire.
  try{ renderCoachNutriSection(c); }catch(e){}
  toastSync(ok,envoi,phaseCourante(c)?PHASES[t].lib+' enregistrée':'Phase retirée','la phase est');
}

// ── Import des pas et du sommeil par capture d'écran ────────────────────────
// Le moteur de lecture est LOURD. Il n'est chargé QUE lorsqu'un athlète envoie
// une capture : le charger au démarrage ferait payer ce poids à tous ceux qui
// ne s'en serviront jamais. Une fois chargé, le Service Worker le garde.
// Tous les chemins sont locaux : sans ces options, la bibliothèque irait
// chercher son cœur et ses données de langue sur un CDN — ce que le projet a
// banni, et ce qui ferait sortir la capture de santé du téléphone.
let _lecteurTexte=null, _lecteurTextePromesse=null;
const _TESS='./vendor/tesseract/';
// Valide un module WebAssembly minimal qui utilise une instruction vectorielle
// (v128). S'il est refusé, l'appareil ne sait pas exécuter le cœur SIMD, et le
// lui envoyer ferait échouer la lecture au lieu de la ralentir.
let _simdCache=null;
function _simdDisponible(){
  if(_simdCache!==null) return _simdCache;
  try{
    _simdCache=WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,
      96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
  }catch(e){ _simdCache=false; }
  return _simdCache;
}
function _chargerScript(src){
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src=src; s.onload=resolve;
    s.onerror=()=>reject(new Error('Chargement impossible : '+src));
    document.head.appendChild(s);
  });
}
// ── DIRE OU ON EN EST PENDANT LA LECTURE ───────────────────────────────────
// Tesseract n'annonce son avancement qu'au `logger` passe a la CREATION du
// worker — et ce worker est memoise pour toute la session. Un logger fige sur
// le bouton du premier appelant ne dirait donc rien de la deuxieme lecture, et
// ecrirait dans un bouton disparu du DOM. Le logger est pose une fois pour
// toutes et relaie vers ce crochet, que chaque appelant installe puis retire
// dans son finally. Un seul emplacement suffit : deux lectures simultanees
// n'existent pas dans l'interface (le bouton se desactive pendant l'operation),
// et si cela changeait, la derniere posee gagnerait — un libelle en retard,
// jamais une erreur.
let _lecteurSurPhase=null;
// Les etats que Tesseract emet, traduits. Ce qui n'est pas dans la table ne
// s'affiche pas : mieux vaut garder le libelle precedent qu'ecrire
// « loading language traineddata » a un athlete.
const _LECT_PHASES={
  'loading tesseract core':'Téléchargement du moteur…',
  'loading language traineddata':'Téléchargement du français…',
  'initializing tesseract':'Préparation…',
  'initializing api':'Préparation…',
  'initialized api':'Préparation…',
  'recognizing text':'Lecture de l\'image…'
};
function _lecteurPhase(m){
  if(!_lecteurSurPhase||!m) return;
  const lib=_LECT_PHASES[String(m.status||'').toLowerCase()];
  if(!lib) return;
  try{ _lecteurSurPhase(lib, typeof m.progress==='number'?m.progress:null); }catch(e){}
}
async function _chargerLecteurTexte(){
  if(_lecteurTexte) return _lecteurTexte;
  if(_lecteurTextePromesse) return _lecteurTextePromesse;
  _lecteurTextePromesse=(async()=>{
    if(!window.Tesseract) await _chargerScript(_TESS+'tesseract.min.js');
    _lecteurTexte=await window.Tesseract.createWorker('fra',1,{
      workerPath:_TESS+'worker.min.js',
      logger:_lecteurPhase,
      // Le cœur est DÉSIGNÉ, pas laissé au choix de la bibliothèque. Livrée un
      // dossier, elle réclame d'elle-même la variante correspondant au jeu
      // d'instructions du navigateur — relaxedsimd, simd ou aucune — et un 404
      // n'entraîne AUCUN repli : le chargement échoue sèchement. Les couvrir
      // toutes coûterait 11,4 Mo pour un gain nul, relaxedsimd n'étant pas
      // plus rapide que simd (mesuré : 1658 ms contre 1705 ms).
      // On tranche donc nous-mêmes entre deux variantes seulement. Mesure sur
      // la capture de Kevin : 1705 ms avec SIMD, 3328 ms sans. Les appareils
      // récents y gagnent le double, les anciens continuent de fonctionner au
      // lieu d'échouer sec.
      corePath:_TESS+(_simdDisponible()?'tesseract-core-simd-lstm.wasm.js'
                                        :'tesseract-core-lstm.wasm.js'),
      langPath:_TESS,
    });
    return _lecteurTexte;
  })();
  return _lecteurTextePromesse;
}
// COMPTEUR D USAGE, et pas un simple drapeau : l import de captures lit
// plusieurs images de suite, et terminer le worker sous les pieds d une
// lecture en cours la ferait echouer. On ne libere qu au dernier sortant.
let _lecteursEnCours=0;
// Le worker n etait JAMAIS termine : coeur WebAssembly et donnees de langue
// francaise restaient en memoire pour toute la session, plus son fil
// d execution. Tant qu il etait seul, ca passait. Depuis qu on peut
// enchainer le scan et la photo d etiquette, ca ne passe plus.
// Le rechargement suivant vient du cache du Service Worker : c est du temps,
// pas du reseau.
async function _libererLecteurTexte(){
  if(_lecteursEnCours>0) return false;
  const w=_lecteurTexte;
  _lecteurTexte=null; _lecteurTextePromesse=null;
  if(!w) return false;
  try{ await w.terminate(); }catch(e){}
  return true;
}
// `psm` : le mode de segmentation de page. Absent, on ne touche a rien et le
// moteur garde son mode automatique — c'est le cas de tous les appels
// historiques. Le passer permet la deuxieme lecture d'etiquette, qui decoupe la
// page autrement.
//
// IL EST TOUJOURS REMIS A '3' ENSUITE, y compris en cas d'echec : le reglage
// vit sur le worker, qui est partage avec l'import des captures de pas et de
// sommeil. Le laisser en place ferait lire la capture suivante avec le decoupage
// d'un tableau nutritionnel, sans que rien ne le dise.
async function _lireCaptureStats(dataUrl,opts){
  _lecteursEnCours++;
  try{
    const w=await _chargerLecteurTexte();
    if(opts&&opts.psm) try{ await w.setParameters({tessedit_pageseg_mode:String(opts.psm)}); }catch(e){}
    try{
      const {data}=await w.recognize(dataUrl);
      return (data&&data.text)||'';
    } finally {
      if(opts&&opts.psm) try{ await w.setParameters({tessedit_pageseg_mode:'3'}); }catch(e){}
    }
  } finally { _lecteursEnCours--; }
}
// L'analyse est VOLONTAIREMENT indépendante de la mise en page. Le texte rendu
// par la lecture des captures réelles n'est pas régulier : la valeur tombe
// tantôt sur la ligne de la date (« 5 août - 25% 3 003 »), tantôt sur celle du
// dessus (« 4 844 » puis « 6 août » 60% »). Les noms de jours sont peu fiables
// — « jeudi » ressort en « Ja) » — et les anneaux de progression laissent du
// bruit (J, N, D, >). Seule la DATE se lit de façon sûre : c'est donc elle qui
// sert d'ancre, jamais le jour de la semaine ni la position dans l'écran.
const _CAP_MOIS=['janvier','février','mars','avril','mai','juin','juillet',
  'août','septembre','octobre','novembre','décembre'];
// Comparaison sans accent ni casse : « août » et « aout » doivent tomber juste,
// et un mois abrégé (« juil. ») se résout par préfixe d'au moins trois lettres.
function _capSansAccent(s){
  return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
}
function _capMoisVersNumero(mot){
  const m=_capSansAccent(mot).replace(/\.$/,'');
  if(m.length<3) return 0;
  for(let i=0;i<12;i++){
    if(_capSansAccent(_CAP_MOIS[i]).startsWith(m)) return i+1;
  }
  return 0;
}
function _capEntiers(ligne){
  // Les pourcentages partent AVANT la recherche : sinon « 5 août - 25% 3 003 »
  // rendrait 25, qui est un pourcentage d'objectif, pas un nombre de pas.
  const propre=String(ligne).replace(/\d+\s*%/g,' ');
  // \s couvre déjà l'espace fine insécable et l'insécable, les deux séparateurs
  // de milliers rencontrés sur les captures.
  return [...propre.matchAll(/\d[\d\s]*\d|\d/g)]
    .map(m=>parseInt(m[0].replace(/\s/g,''),10))
    .filter(n=>Number.isFinite(n));
}
function _capDuree(ligne){
  const m=/(\d{1,2})\s*h\s*(\d{1,2})\s*m/i.exec(String(ligne));
  if(!m) return null;
  const mins=(+m[1])*60+(+m[2]);
  // Même plafond que calcSleepDuration : au-delà de 18 h ce n'est pas une nuit.
  if(mins<=0||mins>18*60) return null;
  // Même conversion que l'app, au dixième d'heure près.
  return Math.round(mins/6)/10;
}
function _analyserCaptureStats(texte,aujourdhui){
  const ref=aujourdhui instanceof Date?aujourdhui:new Date();
  const lignes=String(texte||'').split('\n').map(l=>l.trim());
  const type=lignes.some(l=>_capDuree(l)!=null)?'sommeil':'pas';
  const reDate=/(\d{1,2})\s*([A-Za-zÀ-ÿ]{3,})\.?/g;
  const vus={};
  let ignorees=0;
  for(let i=0;i<lignes.length;i++){
    reDate.lastIndex=0;
    let m;
    while((m=reDate.exec(lignes[i]))){
      const jour=+m[1], mois=_capMoisVersNumero(m[2]);
      if(!mois||jour<1||jour>31) continue;
      // Année absente des captures. On prend l'année en cours, et si la date
      // obtenue tombe dans le futur on recule d'un an : sans quoi tout import
      // fait début janvier serait daté d'un an en avance.
      let annee=ref.getFullYear();
      let d=new Date(annee,mois-1,jour,12,0,0);
      if(d.getTime()>ref.getTime()+864e5){ annee--; d=new Date(annee,mois-1,jour,12,0,0); }
      if(d.getMonth()!==mois-1) continue; // 31 février et consorts
      const cle=annee+'-'+String(mois).padStart(2,'0')+'-'+String(jour).padStart(2,'0');
      if(vus[cle]!=null) continue;
      // LA RÈGLE : la valeur est sur la ligne de la date, sinon sur celle du
      // dessus. Sans valeur, la date est abandonnée — c'est ce qui écarte tout
      // seul la ligne d'en-tête « 31 juil. — 6 août », qui n'en porte aucune.
      let valeur=null;
      for(const l of [lignes[i], i>0?lignes[i-1]:'']){
        if(type==='sommeil'){
          const d2=_capDuree(l);
          if(d2!=null){ valeur=d2; break; }
        }else{
          const cands=_capEntiers(l).filter(n=>n>=100&&n<=99999);
          if(cands.length){ valeur=Math.max(...cands); break; }
        }
      }
      if(valeur==null){ ignorees++; continue; }
      vus[cle]=valeur;
    }
  }
  const jours=Object.keys(vus).sort().map(k=>({date:k,valeur:vus[k]}));
  return {type:jours.length?type:null, jours, ignorees};
}
// Écrit sans écran de validation — décision de Kevin, actée dans la spec. La
// sûreté ne vient donc pas d'une relecture par l'athlète mais du REJET : les
// valeurs impossibles sont refusées par _recordSteps / _recordSleep eux-mêmes,
// et le nombre de journées remplacées ressort dans le toast pour qu'un
// écrasement ne soit jamais muet.
function _appliquerCaptureStats(analyse){
  const res={ecrits:0,remplaces:0,du:null,au:null};
  if(!analyse||!analyse.jours||!analyse.jours.length) return res;
  const aujourd=localISODate(new Date());
  for(const j of analyse.jours){
    if(j.date>aujourd) continue; // une capture ne renseigne jamais le futur
    const avant=analyse.type==='sommeil'
      ? (currentUser.sleepLog||[]).some(e=>e.date===j.date)
      : (currentUser.stepsLog||[]).some(e=>e.date===j.date);
    const pose=analyse.type==='sommeil'
      ? _recordSleep(j.date,{duration:j.valeur},{dataStatus:'capture'})
      : _recordSteps(j.date,j.valeur,{dataStatus:'capture'});
    if(!pose) continue;
    res.ecrits++;
    if(avant) res.remplaces++;
    if(!res.du||j.date<res.du) res.du=j.date;
    if(!res.au||j.date>res.au) res.au=j.date;
  }
  return res;
}
// Cadre commun aux deux pages. Le MÊME bloc accepte les deux types de capture :
// la nature est déduite du contenu, pas de la page d'où il est ouvert. Un élève
// qui envoie sa capture de sommeil depuis la page Pas obtient quand même ses
// nuits, plutôt qu'un refus qu'il ne comprendrait pas.
// AUCUN identifiant ici, volontairement : l'écran Lifestyle rend les pages Pas
// et Sommeil en même temps, donc ce cadre existe en DEUX exemplaires dans le
// document. Des id les auraient dupliqués, et getElementById aurait toujours
// rendu le premier — le bouton « Lecture en cours… » se serait affiché sur
// l'autre page. On navigue donc de proche en proche : le bouton déclenche le
// champ qui le précède, le gestionnaire retrouve le bouton qui le suit.
// ⚠ LA DEMOTION DE CE BLOC EST REVOQUEE, ET C'EST UNE DECISION DE KEVIN.
// Il portait ceci : « Ce n'est pas une fonction du produit, c'est un
// depannage : quelques mots et un bouton. » Les faits ont tranche autrement.
// La saisie manuelle jour apres jour est ce qui PRODUIT les trous dont le
// coach se plaint — « l'athlete oublie, le coach pilote sur des trous ». Une
// capture vaut sept journees : ce n'est pas un depannage, c'est le chemin
// principal de remplissage. Il reprend donc le gabarit de la page.
//
// ⚠ TOUJOURS AUCUN `id`. Sur l'ecran Lifestyle, loadSteps et loadSleep
// rendent chacun dans leur conteneur : tout identifiant en dur y existerait
// en double, et document.getElementById en trouverait un au hasard. Le
// bouton atteint son champ par previousElementSibling, comme avant.
function _htmlCadreImportCapture(quoi,opts){
  // `quoi` colore la carte selon la section qui l'accueille — rouge pour les
  // pas, bleu pour le sommeil, neutre sur Lifestyle ou elle vaut pour les
  // deux. La lecture, elle, ne depend pas de la page : _analyserCaptureStats
  // deduit la nature du contenu, pas de l'endroit d'ou on l'appelle.
  //
  // R22 — `opts.alternative` : la forme SOUS le bouton de saisie des cartes
  // Pas et Sommeil de Lifestyle (Kevin, 17/09/2026 : « la saisie manuelle
  // reste le chemin principal », l'import en est l'alternative explicite).
  // Meme champ, meme gestionnaire, meme phrase de confidentialite : seul
  // l'habillage change. Le bouton n'a que du texte — importerCaptureStats le
  // reecrit en « Lecture en cours… » puis le restaure par textContent.
  if(opts&&opts.alternative){
    return `
    <div class="san-import" style="margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--text) 7%,transparent)">
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-bottom:10px;text-align:center">ou importe une capture d'écran de ton application de santé</div>
      <input type="file" accept="image/*,.heic,.heif,.hif" style="display:none" onchange="importerCaptureStats(this)">
      <button type="button" class="btn btn-outline btn-sm" onclick="this.previousElementSibling.click()"
        style="width:100%;min-height:44px;margin:0;letter-spacing:1.2px">Envoyer une capture</button>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:8px;text-align:center">
        La capture est lue sur ton téléphone. Elle n'est ni envoyée ni conservée.
      </div>
    </div>`;
  }
  const teinte = quoi==='sommeil' ? {c:'#60a5fa',h:'rgba(96,165,250,.55)',
                   g:'linear-gradient(160deg,#2563eb,#0b2f6b)',b:'rgba(120,180,255,.42)'}
               : quoi==='pas'     ? {c:'var(--red-text)',h:'rgba(224,32,32,.55)',
                   g:'linear-gradient(160deg,#e21414,#8d0000)',b:'rgba(255,90,90,.42)'}
               :                    {c:'var(--red-text)',h:'rgba(224,32,32,.5)',
                   g:'linear-gradient(160deg,#e21414,#8d0000)',b:'rgba(255,90,90,.42)'};
  const ce = quoi==='sommeil' ? 'tes nuits'
           : quoi==='pas'     ? 'tes journees'
           :                    'tes pas ou tes nuits';
  return `
    <div class="card-nut" style="margin:14px 0;animation:fadeInUp var(--t-4) var(--c-out)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="display:inline-flex;color:${teinte.c};filter:drop-shadow(0 0 6px ${teinte.h})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" width="18" height="18"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></span>
        <span style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:${teinte.c};text-transform:uppercase">Remplir depuis une capture</span>
      </div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-bottom:12px">
        Pas noté ${escapeHtml(ce)} ? Envoie la capture d'écran de ton application de montre, vue 7 jours de préférence : les chiffres sont lus et remplis tout seuls.
      </div>
      <!-- HEIC, HEIF, HIF EXPLICITEMENT. Le motif image/* seul suffit sur
           Safari,
           qui l'elargit au format natif de l'iPhone ; ni Chrome Android ni
           les navigateurs de bureau ne le font, et la photo la plus courante
           du telephone le plus courant se trouvait refusee par le selecteur
           lui-meme, avant meme d'etre lue. -->
      <input type="file" accept="image/*,.heic,.heif,.hif" style="display:none" onchange="importerCaptureStats(this)">
      <button class="btn" onclick="this.previousElementSibling.click()"
        style="width:100%;min-height:46px;margin:0;background:${teinte.g};border:1px solid ${teinte.b};color:#fff;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:900;letter-spacing:1.8px;cursor:pointer;box-shadow:0 0 18px ${teinte.h},inset 0 1px 0 rgba(255,255,255,.18)">Envoyer une capture</button>
      <!-- LA PHRASE DE CONFIDENTIALITE EST UN ENGAGEMENT, PAS UNE MENTION
           LEGALE A ENTERRER : elle passe de --fs-2xs / --text-faint, ou elle
           etait illisible, a --fs-xs sur --text-dim. C'est elle qui autorise
           a demander une image ; si elle ne se lit pas, elle n'autorise rien. -->
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px;text-align:center">
        La capture est lue sur ton téléphone. Elle n'est ni envoyée ni conservée.
      </div>
    </div>`;
}
async function importerCaptureStats(input){
  const f=input&&input.files&&input.files[0];
  input.value='';
  if(!f) return;
  const btn=input.nextElementSibling;
  const libelle=btn?btn.textContent:'';
  // La première lecture télécharge le moteur (4,1 Mo), et la reconnaissance
  // elle-même prend quelques secondes sur un téléphone. arcAttendre pose déjà
  // les deux garde-fous : le bouton passe à disabled — c'est ce qui empêche le
  // double envoi — et la barre indéterminée .arc-attente-bar défile sous lui.
  // Ce qui manquait, c'est de DIRE laquelle des deux attentes on subit : un
  // libellé figé à « Lecture en cours… » pendant onze secondes de
  // téléchargement se lit comme un blocage. Le crochet ci-dessous nomme
  // l'étape et chiffre son avancement.
  if(btn) arcAttendre(btn,'Préparation…');
  _lecteurSurPhase=(lib,p)=>{
    if(!btn) return;
    // Le pourcentage n'apparaît qu'entre les bornes : 0 % et 100 % affichés
    // font croire, l'un que rien n'a commencé, l'autre que c'est fini alors
    // que l'étape suivante n'a pas démarré.
    btn.textContent=(p!=null&&p>0&&p<1)?lib+' '+Math.round(p*100)+' %':lib;
  };
  try{
    const dataUrl=await new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=()=>res(r.result);
      r.onerror=()=>rej(new Error('Image illisible'));
      r.readAsDataURL(f);
    });
    const texte=await _lireCaptureStats(dataUrl);
    const analyse=_analyserCaptureStats(texte,new Date());
    if(!analyse.jours.length){
      return toast('Je n\'ai rien pu lire sur cette image. Essaie la vue 7 jours de ton application de montre.','var(--orange)');
    }
    const r=_appliquerCaptureStats(analyse);
    if(!r.ecrits) return toast('Rien à enregistrer sur cette capture.','var(--orange)');
    const quoi=analyse.type==='sommeil'?'nuit':'journée';
    const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    const plage=r.du===r.au?fmt(r.du):fmt(r.du)+' → '+fmt(r.au);
    // L'écrasement n'est jamais muet : sans écran de validation, ce compte est
    // la seule chose qui dit à l'athlète qu'une saisie a été remplacée.
    const remplacees=r.remplaces?', dont '+r.remplaces+' remplacée'+(r.remplaces>1?'s':''):'';
    toastEcriture(saveUser(),
      r.ecrits+' '+quoi+(r.ecrits>1?'s':'')+' ('+plage+')'+remplacees,'tes stats sont');
    _rerenderLifestyle();
  }catch(err){
    toast(err&&err.message?err.message:'Lecture impossible','var(--orange)');
  }finally{
    // AVANT arcRendre : le crochet écrit dans le bouton, et un message de phase
    // arrivé en retard réécrirait par-dessus le libellé restauré.
    _lecteurSurPhase=null;
    if(btn) arcRendre(btn,libelle);
  }
}
// `marque` (facultatif) : {dataStatus:'capture'|'sync', source}. Sans elle,
// la saisie est MANUELLE et horodatée : c'est ce qui la protège d'une
// synchronisation reçue plus tôt (sanFusionSync).
function _recordSteps(dateStr,count,marque){
  const n=parseInt(count,10);
  // 0 est une valeur légitime saisie à la main (« je n'ai pas marché »), d'où
  // le seuil bas à 0 et non à 1 — le champ de fin de séance, lui, resserre à
  // >0 côté appelant pour qu'un champ laissé vide n'écrase rien.
  if(!dateStr||isNaN(n)||n<0||n>99999) return false;
  if(!currentUser.stepsLog) currentUser.stepsLog=[];
  const idx=currentUser.stepsLog.findIndex(e=>e.date===dateStr);
  // Écrasement, jamais ajout : un jour n'a qu'un total. C'est précisément ce
  // qui permet de corriger dans Lifestyle un chiffre entré en fin de séance.
  if(idx>=0) currentUser.stepsLog[idx].count=n;
  else currentUser.stepsLog.push({date:dateStr,count:n});
  _sanMarquer(currentUser.stepsLog.find(e=>e.date===dateStr),marque);
  const cutoff=localISODate(new Date(Date.now()-STEPS_RETENTION_JOURS*24*3600*1000));
  currentUser.stepsLog=currentUser.stepsLog.filter(e=>e.date>=cutoff);
  return true;
}
function saveSteps(){
  if(!demanderConsentementSante('pas',saveSteps)) return;
  const input=document.getElementById('steps-today-input');
  const count=parseInt(input.value,10);
  const jour=_jourSteps();
  if(!_recordSteps(jour,count)){toast('️ Saisis un nombre de pas valide');return;}
  saveUser();
  // Le jour est rappelé quand ce n'est pas aujourd'hui : sans lui, l'athlète
  // qui rattrape trois jours d'affilée n'a aucune confirmation de la ligne
  // qu'il vient réellement d'écrire.
  const suffixe=jour===localISODate(new Date())
    ? ''
    : ' le '+new Date(jour+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  toast(' '+count.toLocaleString('fr-FR')+' pas enregistrés'+suffixe+' !');
  _rerenderLifestyle();
}
function saveStepsGoals(){
  const onVal=parseInt(document.getElementById('steps-goal-on').value,10);
  const offVal=parseInt(document.getElementById('steps-goal-off').value,10);
  if(isNaN(onVal)||onVal<500||isNaN(offVal)||offVal<500){toast('Objectifs invalides');return;}
  currentUser.stepsGoals={on:onVal,off:offVal};
  toastEcriture(saveUser(),'Objectifs enregistrés '+ICO.coche,'les objectifs sont');
  // Et NON loadLifestyle() : ce panneau est aussi rendu dans l'écran « Mes
  // pas » autonome, d'où un go('s-lifestyle') éjectait l'athlète au moment
  // même où son enregistrement réussissait.
  _rerenderLifestyle();
}
function stepsToggleType(type){
  // Le type de journée appartient au jour affiché, pas au jour courant : sinon
  // rattraper un lundi écraserait le type d'aujourd'hui sans prévenir.
  const jour=_jourSteps();
  if(!currentUser.stepsDayType) currentUser.stepsDayType={};
  if(currentUser.stepsDayType[jour]===type) delete currentUser.stepsDayType[jour];
  else currentUser.stepsDayType[jour]=type;
  saveUser();
  _rerenderLifestyle();
}

// ======= SLEEP =======
// ── CE QUE LE COACH VOIT ───────────────────────────────────────────────
// Deux lignes par athlete, et l'etat des donnees. Un coach qui lit « sommeil
// 7h18 » sans savoir que trois nuits manquent prend une decision sur une
// moyenne de quatre jours en croyant en lire sept.
//
// AUCUN DIAGNOSTIC. RepCore est une application de coaching sportif : on dit
// « en dessous de l'objectif », jamais « mauvais sommeil » ni « insomnie ».
// ══ LA BASE DES TRACKERS ═══════════════════════════════════════════════
// Une entree par ecosysteme. Ajouter une marque ne demande QUE d'ajouter un
// objet ici : ni le graphique, ni la recherche, ni les ecrans ne bougent.
//
// ⚠ LES CHEMINS NE SONT PAS INVENTES, ET C'EST UNE REGLE ABSOLUE. Seuls
// figurent ici les chemins qui ont ete DICTES ou verifies. Partout ailleurs,
// `chemin` vaut null et l'ecran affiche la recherche generique — « tape
// sommeil dans ton application » — qui, elle, est vraie partout.
// `verifie` porte le mois de la derniere verification, ou null. Ce champ ne
// s'affiche pas : il sert a savoir quelles notices reprendre quand les
// applications changent.
const TRACK_VERSION=1;
const TRACKERS=Object.freeze([
  {id:'apple',marque:'Apple',app:'Apple Santé',
   modeles:['Apple Watch','Watch Ultra','Watch SE','iPhone'],
   sommeil:{chemin:['Santé','Parcourir','Sommeil'],
     note:'Choisis la vue Semaine pour voir tes 7 derniers jours.'},
   pas:{chemin:['Santé','Parcourir','Activité','Pas'],
     note:'Choisis la vue Semaine pour consulter tes 7 derniers jours.'},
   verifie:'2026-09'},
  {id:'garmin',marque:'Garmin',app:'Garmin Connect',
   modeles:['Fenix','Forerunner','Venu','Epix','Instinct','vívoactive','Enduro','Lily'],
   sommeil:{chemin:['Garmin Connect','Plus','Statistiques de santé','Sommeil'],
     alternatif:['Statistiques de santé','Sommeil']},
   pas:{chemin:null},
   verifie:'2026-09'},
  {id:'samsung',marque:'Samsung',app:'Samsung Health',
   modeles:['Galaxy Watch','Galaxy Fit','Galaxy Ring'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'google',marque:'Google / Pixel',app:'Google Health Connect',
   modeles:['Pixel Watch','Pixel','Fitbit via Google'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'huawei',marque:'Huawei',app:'Huawei Santé',
   modeles:['Watch GT','Watch Fit','Band','Watch Ultimate'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'fitbit',marque:'Fitbit',app:'Fitbit',
   modeles:['Charge','Sense','Versa','Inspire','Luxe'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'xiaomi',marque:'Xiaomi / Redmi',app:'Mi Fitness',
   modeles:['Mi Band','Smart Band','Watch S','Redmi Watch'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'amazfit',marque:'Amazfit',app:'Zepp',
   modeles:['GTR','GTS','T-Rex','Balance','Bip','Cheetah'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'polar',marque:'Polar',app:'Polar Flow',
   modeles:['Vantage','Grit','Pacer','Ignite','Unite'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'coros',marque:'COROS',app:'COROS',
   modeles:['Pace','Apex','Vertix','Nomad'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'suunto',marque:'Suunto',app:'Suunto',
   modeles:['Race','Vertical','9 Peak','Ocean'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'whoop',marque:'WHOOP',app:'WHOOP',modeles:['WHOOP 4.0','WHOOP MG'],
   sommeil:{chemin:null},pas:{chemin:null,indisponible:true}},
  {id:'oura',marque:'Oura',app:'Oura',modeles:['Oura Ring','Ring 4'],
   sommeil:{chemin:null},pas:{chemin:null}},
  {id:'withings',marque:'Withings',app:'Withings Health Mate',
   modeles:['ScanWatch','Steel HR','Sleep Analyzer'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'oneplus',marque:'OnePlus',app:'OHealth',modeles:['OnePlus Watch'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'oppo',marque:'OPPO',app:'OHealth',modeles:['OPPO Watch'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'mobvoi',marque:'Mobvoi / TicWatch',app:'Mobvoi Health',modeles:['TicWatch'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'honor',marque:'HONOR',app:'HONOR Health',modeles:['HONOR Watch','HONOR Band'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'realme',marque:'realme',app:'realme Link',modeles:['realme Watch','realme Band'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'nothing',marque:'CMF / Nothing',app:'Nothing X',modeles:['CMF Watch'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'fossil',marque:'Fossil',app:'Fossil Smartwatches',modeles:['Gen 6'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'tagheuer',marque:'TAG Heuer',app:'TAG Heuer Connected',modeles:['Connected Calibre'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'montblanc',marque:'Montblanc',app:'Montblanc Summit',modeles:['Summit'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'ringconn',marque:'RingConn',app:'RingConn',modeles:['RingConn Gen 2'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'ultrahuman',marque:'Ultrahuman',app:'Ultrahuman',modeles:['Ring AIR'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'circular',marque:'Circular',app:'Circular',modeles:['Circular Ring'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'casio',marque:'Casio',app:'Casio Watches',modeles:['G-Shock Move'],sommeil:{chemin:null},pas:{chemin:null}},
  {id:'autre',marque:'Autre',app:null,modeles:[],sommeil:{chemin:null},pas:{chemin:null}}
]);
// PURE. Recherche tolerante : accents, casse et espaces ignores, et une
// correspondance partielle suffit. « fenix 8 » trouve Garmin, « gt 5 » Huawei.
function trackNorm(t){
  return String(t==null?'':t).toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,'');
}
function trackChercher(q){
  const n=trackNorm(q);
  if(!n) return [];
  const out=[];
  for(const t of TRACKERS){
    if(t.id==='autre') continue;
    const champs=[t.marque,t.app||''].concat(t.modeles||[]);
    let score=0;
    for(const c of champs){
      const cn=trackNorm(c);
      if(!cn) continue;
      if(cn===n){ score=Math.max(score,100); }
      else if(cn.startsWith(n)||n.startsWith(cn)){ score=Math.max(score,80); }
      // La sous-chaine ne joue qu'a partir de DEUX caracteres : « s » se
      // trouve dans Samsung, Suunto, Casio, Fossil et dix autres — la moitie
      // de la base pour une lettre, ce n'est plus une recherche.
      else if(n.length>=2&&(cn.includes(n)||n.includes(cn))){ score=Math.max(score,60); }
      // ET MOT A MOT. Les familles portent un prefixe que personne ne tape :
      // on dit « GT 5 », jamais « Watch GT 5 ». Comparer les libellés entiers
      // ne trouvait donc pas Huawei, alors que « Fenix 8 » trouvait Garmin par
      // accident — le prefixe manquait de ce cote-la.
      // Deux caracteres au minimum : « S » attraperait la moitie de la base.
      else {
        for(const mot of String(c).split(/[\s/]+/)){
          const mn=trackNorm(mot);
          if(mn.length<2) continue;
          if(n===mn||n.startsWith(mn)||n.endsWith(mn)){ score=Math.max(score,50); break; }
        }
      }
    }
    if(score) out.push({t,score});
  }
  return out.sort((a,b)=>b.score-a.score||a.t.marque.localeCompare(b.t.marque)).map(x=>x.t);
}
function trackParId(id){ return TRACKERS.find(t=>t.id===id)||null; }
// ══ MES APPAREILS — D'APRES LA MAQUETTE DE KEVIN (24/09/2026) ════════════
// « Trouver mes données » posait deux questions (quoi, puis quelle montre)
// devant une grille d'initiales. La maquette montre d'emblee les seize
// ecosystemes, chacun avec son logo (decoupe dans la maquette,
// img/appareils/), un badge, le chemin dans son application et une phrase.
// Le domaine vient de la carte qui ouvre la page : les chemins disent
// « > Sommeil » ou « > Pas ». Toucher une carte ouvre sa fiche (_trkFiche) ;
// « Autre appareil » ouvre l'import par capture. Les marques qui ne sont pas
// parmi les seize restent atteignables par « Ma montre n'est pas dans la
// liste », qui garde la recherche.
let _trkQuoi='sommeil',_trkTri='pop';
const TRK_APPAREILS=Object.freeze([
  // id, nom, badge, pictogramme du chemin, application, onglet(s)
  {id:'apple',nom:'Apple Santé',badge:'Populaire',ico:'reglage',app:'Santé',
   d:q=>'Ouvre l’app Santé et va dans '+q+' pour voir tes données.'},
  {id:'garmin',nom:'Garmin Connect',badge:'Populaire',ico:'barres',app:'Garmin Connect',
   d:q=>'Ouvre Garmin Connect, onglet '+q+' ou Statistiques.'},
  {id:'samsung',nom:'Samsung Health',badge:'Populaire',ico:'coeur',app:'Samsung Health',
   d:q=>'Ouvre l’app, onglet '+q+' pour voir tes données.'},
  {id:'google',nom:'Google Health Connect',badge:'Application',ico:'barres',app:'Health Connect',
   d:q=>'Ouvre Health Connect pour accéder à tes données.'},
  {id:'huawei',nom:'Huawei Santé',badge:'Montre',ico:'reglage',app:'Santé Huawei',
   d:q=>'Ouvre l’app Huawei Santé et va dans '+q+'.'},
  {id:'fitbit',nom:'Fitbit',badge:'Montre',ico:'barres',app:'Fitbit',
   d:q=>'Ouvre l’app Fitbit, onglet '+q+' ou Tableau de bord.'},
  {id:'xiaomi',nom:'Xiaomi / Redmi',badge:'Montre',ico:'reglage',app:'Zepp Life',
   d:q=>'Ouvre l’app Zepp Life (Mi Fitness) et va dans '+q+'.'},
  {id:'amazfit',nom:'Amazfit (Zepp)',badge:'Montre',ico:'barres',app:'Zepp',
   d:q=>'Ouvre l’app Zepp, onglet '+q+'.'},
  {id:'polar',nom:'Polar Flow',badge:'Montre',ico:'barres',app:'Polar Flow',
   d:q=>'Ouvre l’app Polar Flow, section '+q+'.'},
  {id:'coros',nom:'COROS',badge:'Montre',ico:'barres',app:'COROS',
   d:q=>'Ouvre l’app COROS, onglet '+q+'.'},
  {id:'suunto',nom:'Suunto',badge:'Montre',ico:'barres',app:'Suunto App',
   d:q=>'Ouvre l’app Suunto, section '+q+'.'},
  // WHOOP et Oura nomment leurs onglets en anglais ; WHOOP ne compte pas les pas.
  {id:'whoop',nom:'WHOOP',badge:'Bracelet',ico:'barres',app:'WHOOP',onglet:{sommeil:'Sleep',pas:null},
   d:q=>q?'Ouvre l’app WHOOP, onglet '+q+' pour voir tes données.':'WHOOP ne compte pas les pas.'},
  {id:'oura',nom:'Oura',badge:'Bague',ico:'barres',app:'Oura',onglet:{sommeil:'Sleep',pas:'Activité'},
   d:q=>'Ouvre l’app Oura, onglet '+q+'.'},
  {id:'withings',nom:'Withings',badge:'Montre',ico:'barres',app:'Withings',
   d:q=>'Ouvre l’app Withings, onglet '+q+'.'},
  {id:'casio',nom:'Casio',badge:'Montre',ico:'reglage',app:'Casio Watches',
   d:q=>'Ouvre l’app Casio Watches et va dans '+q+'.'}
]);
const _TRK_SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">';
const _TRK_ICO={
  reglage:_TRK_SVG+'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  barres:'<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="12" width="3.5" height="8" rx="1"/><rect x="10.2" y="7" width="3.5" height="13" rx="1"/><rect x="16.5" y="3.5" width="3.5" height="16.5" rx="1"/></svg>',
  coeur:_TRK_SVG+'<path d="M20.8 5.6a5.4 5.4 0 0 0-7.7 0L12 6.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 22l8.8-8.7a5.4 5.4 0 0 0 0-7.7z"/></svg>',
  envoi:_TRK_SVG+'<path d="M12 15.5V4M7.5 8.5L12 4l4.5 4.5M4.5 14.5v4a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"/></svg>'
};
function _trkCarte(a){
  const nuit=(_trkQuoi!=='pas');
  const q=a.onglet?(nuit?a.onglet.sommeil:a.onglet.pas):(nuit?'Sommeil':'Pas');
  return '<button type="button" class="trk-a" onclick="_trkFiche(\''+a.id+'\')">'
    +'<img class="trk-a-logo" src="img/appareils/'+a.id+'.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">'
    +'<span class="trk-a-c"><span class="trk-a-h"><span class="trk-a-nom">'+escapeHtml(a.nom)+'</span>'
      +'<span class="trk-a-b" data-b="'+escapeHtml(a.badge)+'">'+escapeHtml(a.badge)+'</span></span>'
      +'<span class="trk-a-ch">'+_TRK_ICO[a.ico]+'<span>'+escapeHtml(q?(a.app+' > '+q):a.app)+'</span></span>'
      +'<span class="trk-a-d">'+escapeHtml(a.d(q))+'</span></span>'
    +'<span class="sv-chev">'+SAN_ICO.droite+'</span></button>';
}
// « Autre appareil » ouvre l'import par capture. ⚠ Le champ, PUIS son bouton :
// importerCaptureStats retrouve le bouton par nextElementSibling et y ecrit
// par textContent — il ne porte donc que du texte, pose sur la carte.
function _trkCarteAutre(){
  return '<div class="trk-a trk-a-autre">'
    +'<img class="trk-a-logo" src="img/appareils/autre.webp" alt="" aria-hidden="true" loading="lazy" decoding="async">'
    +'<span class="trk-a-c"><span class="trk-a-h"><span class="trk-a-nom">Autre appareil</span>'
      +'<span class="trk-a-b" data-b="Autre">Autre</span></span>'
      +'<span class="trk-a-ch">'+_TRK_ICO.envoi+'<span>Importer une capture d’écran</span></span>'
      +'<span class="trk-a-d">Envoie une capture de ton application de santé.</span></span>'
    +'<input type="file" accept="image/*,.heic,.heif,.hif" style="display:none" onchange="sanFermer();importerCaptureStats(this)">'
    +'<button type="button" class="sv-tuile-go" onclick="this.previousElementSibling.click()">Importer une capture d’écran</button>'
    +'</div>';
}
function sanAide(quoi){
  _trkQuoi=(quoi==='pas')?'pas':'sommeil';
  try{ rcm(_trkQuoi==='pas'?'steps_help_opened':'sleep_help_opened'); }catch(e){}
  try{ rcm('tracker_help_opened'); }catch(e){}
  _trkEtape1();
}
function _trkEtape1(){
  const liste=TRK_APPAREILS.slice();
  if(_trkTri==='az') liste.sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  _sanFeuille('Mes appareils',
    '<div class="trk-tete"><div><h3 class="trk-t">Mes appareils</h3>'
      +'<span class="trk-s">Choisis ton écosystème pour voir où trouver les données.</span></div>'
      +'<label class="san-per-sel trk-tri"><span class="san-per-lib">'+(_trkTri==='az'?'De A à Z':'Popularité')+'</span>'+SAN_ICO.bas
        +'<select onchange="_trkTri=this.value;_trkEtape1()" aria-label="Trier les appareils">'
          +'<option value="pop"'+(_trkTri==='pop'?' selected':'')+'>Popularité</option>'
          +'<option value="az"'+(_trkTri==='az'?' selected':'')+'>De A à Z</option></select></label></div>'
    +'<div class="trk-liste">'+liste.map(_trkCarte).join('')+_trkCarteAutre()+'</div>'
    +'<button type="button" class="trk-lien trk-perdu" onclick="_trkPerdu()">Ma montre n’est pas dans la liste</button>');
}
// La tuile a initiale, pour les resultats de la recherche de « Ma montre
// n'est pas dans la liste ».
function _trkTuile(t){
  // AUCUN LOGO DE MARQUE : le projet n'en detient pas les droits et un logo
  // approximatif vaut moins qu'une initiale nette. Fallback generique partout.
  const ini=String(t.marque||'?').trim().charAt(0).toUpperCase();
  return '<button type="button" class="trk-tuile" onclick="_trkFiche(\''+t.id+'\')">'
    +'<span class="trk-ini" aria-hidden="true">'+escapeHtml(ini)+'</span>'
    +'<span class="trk-nom">'+escapeHtml(t.marque)+'</span></button>';
}
// ── LA FICHE ───────────────────────────────────────────────────────────
function _trkFiche(id){
  const t=trackParId(id);
  if(!t) return;
  try{ rcm('tracker_selected'); }catch(e){}
  // LOT G1 : Garmin se relie, ses instructions cèdent la place au bouton.
  if(t.id==='garmin'){
    const g=htmlGarminFiche(_garminEtat,Date.now());
    if(g){
      _sanFeuille(t.marque,g+'<div class="san-f-actions">'
        +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="sanFermer();sanSaisir(\''+_trkQuoi+'\')">Saisir à la main</button>'
        +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="_trkEtape1()">Retour</button></div>');
      return;
    }
    // L'état n'est pas encore connu : la fiche se repeint s'il ouvre la connexion.
    if(_garminEtat==null) garminEtatLire().then(e=>{ const z=document.getElementById('san-feuille');
      if(e&&e.dispo&&z&&z.style.display!=='none'&&/aria-label="Garmin"/.test(z.innerHTML)) _trkFiche('garmin'); }).catch(()=>{});
  }
  const bloc=_trkQuoi==='pas'?t.pas:t.sommeil;
  const quoiLib=_trkQuoi==='pas'?'tes pas':'ton sommeil';
  let corps='';
  if(bloc&&bloc.indisponible){
    // NE JAMAIS FAIRE CROIRE QU'UNE DONNEE EXISTE. Quand l'appareil ne la
    // mesure pas, on le dit, et on propose la seule chose qui marche.
    corps='<div class="trk-indispo">Cette donnée n\'est pas disponible avec cet appareil.</div>';
  } else if(bloc&&bloc.chemin&&bloc.chemin.length){
    corps='<div class="trk-app">Application<strong>'+escapeHtml(t.app||'-')+'</strong></div>'
      +'<div class="san-lab">Chemin</div>'
      +'<ol class="trk-chemin">'+bloc.chemin.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ol>'
      +(bloc.alternatif?'<div class="san-aide">Si ce menu n\'existe pas : '
        +escapeHtml(bloc.alternatif.join(' → '))+'</div>':'')
      +(bloc.note?'<div class="san-aide">'+escapeHtml(bloc.note)+'</div>':'');
  } else {
    // LE REPLI GENERIQUE, ET IL EST VRAI PARTOUT. Mieux vaut une consigne
    // exacte et large qu'un chemin precis et faux.
    corps='<div class="trk-app">Application<strong>'+escapeHtml(t.app||'celle de ta montre')+'</strong></div>'
      +'<div class="trk-gen">Ouvre '+escapeHtml(t.app||'l\'application de ta montre')
      +' et cherche « '+(_trkQuoi==='pas'?'pas':'sommeil')+' ».</div>'
      +'<div class="san-aide">Le chemin exact de cette application n\'est pas encore référencé '
      +'dans RepCore. La recherche de l\'application, elle, y mène toujours.</div>';
  }
  _sanFeuille(t.marque,
    corps
    +'<div class="san-aide" style="margin-top:12px">Le nom ou l\'emplacement des menus peut varier '
    +'selon la version de ton application. Si tu ne trouves pas cette rubrique, utilise la recherche '
    +'de l\'application et tape « '+(_trkQuoi==='pas'?'pas':'sommeil')+' ».</div>'
    +'<div class="san-f-actions">'
      +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" '
        +'onclick="sanFermer();sanSaisir(\''+_trkQuoi+'\')">J\'ai trouvé</button>'
      +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" '
        +'onclick="_trkEtape1()">Retour</button>'
    +'</div>');
}
// ── JE NE TROUVE PAS MA MONTRE ─────────────────────────────────────────
function _trkPerdu(){
  try{ rcm('tracker_not_found'); }catch(e){}
  _sanFeuille('On va la retrouver',
    '<div class="san-aide" style="margin-bottom:12px">Qu\'est-ce que tu connais ?</div>'
    +'<div class="san-src-l">'
      +'<button type="button" class="san-src-o" onclick="_trkParTexte(\'marque\')">Ma marque</button>'
      +'<button type="button" class="san-src-o" onclick="_trkParTexte(\'app\')">Le nom de l\'application</button>'
      +'<button type="button" class="san-src-o" onclick="_trkParTexte(\'modele\')">Le modèle</button>'
      +'<button type="button" class="san-src-o" onclick="_trkRien()">Rien de tout ça</button>'
    +'</div>');
}
function _trkParTexte(quoi){
  const lib=quoi==='app'?'Nom de l\'application':(quoi==='modele'?'Nom du modèle':'Nom de la marque');
  _sanFeuille(lib,
    '<input id="trk-libre" inputmode="search" placeholder="'+escapeHtml(lib)+'" '
    +'oninput="_trkLibreRes(this.value)">'
    +'<div id="trk-libre-res"></div>'
    +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:14px 0 0" '
    +'onclick="_trkPerdu()">Retour</button>');
  const i=document.getElementById('trk-libre'); if(i) i.focus();
}
function _trkLibreRes(q){
  const z=document.getElementById('trk-libre-res');
  if(!z) return;
  const r=trackChercher(q);
  z.innerHTML=r.length
    ?'<div class="trk-grille" style="margin-top:10px">'+r.map(_trkTuile).join('')+'</div>'
    :(String(q||'').trim()
      ?'<div class="san-vide">Rien trouvé. '
        +'<button type="button" class="trk-lien" onclick="_trkSignaler()">Signaler ma montre</button></div>':'');
}
function _trkRien(){
  _sanFeuille('On va la retrouver',
    '<div class="trk-gen">Regarde l\'application utilisée pour synchroniser ta montre : '
    +'son nom est le meilleur indice.</div>'
    +'<div class="san-aide" style="margin-bottom:10px">Tu peux aussi simplement nous donner '
    +'le nom écrit sur ta montre.</div>'
    +'<label class="san-lab">Nom de ma montre</label>'
    +'<input id="trk-libre" inputmode="search" oninput="_trkLibreRes(this.value)">'
    +'<div id="trk-libre-res"></div>'
    +'<div class="san-f-actions">'
      +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" '
        +'onclick="sanFermer();sanSaisir(\''+_trkQuoi+'\')">Saisir mes données</button>'
      +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" '
        +'onclick="_trkSignaler()">Signaler ma montre</button>'
    +'</div>');
}
function _trkSignaler(){
  _sanFeuille('Signaler ma montre',
    '<div class="trk-gen">Ta montre n\'est pas encore référencée. Ce n\'est pas bloquant : '
    +'tu peux saisir tes données à la main dès maintenant.</div>'
    +'<label class="san-lab">Marque</label><input id="sig-marque">'
    +'<label class="san-lab">Modèle</label><input id="sig-modele">'
    +'<label class="san-lab">Application</label><input id="sig-app">'
    +'<button type="button" class="btn btn-red" style="width:100%;margin:14px 0 0" '
    +'onclick="_trkEnvoyerSignal()">Envoyer</button>');
}
function _trkEnvoyerSignal(){
  const v=id=>String((document.getElementById(id)||{}).value||'').trim().slice(0,60);
  const m=v('sig-marque'),mo=v('sig-modele'),ap=v('sig-app');
  if(!m&&!mo&&!ap) return toast('Renseigne au moins une information','var(--orange)');
  const u=currentUser;
  if(!u.santeSignal) u.santeSignal=[];
  // CONSERVE DANS LE DOSSIER, pas envoye ailleurs : aucune collecte de plus
  // que ce que l'application stocke deja.
  u.santeSignal.push({marque:m,modele:mo,app:ap,at:Date.now()});
  u.santeSignal=u.santeSignal.slice(-10);
  saveUser();
  CLOUD.pushOne(u.email,u);
  try{ rcm('tracker_feedback_submitted'); }catch(e){}
  sanFermer();
  toast('Merci. Nous pourrons ajouter cette montre à RepCore.','var(--green)');
}
// ══ SUIVI SANTE : SOMMEIL ET PAS ═══════════════════════════════════════
// Deux cartes, sept jours glissants, et rien d'autre a comprendre. L'ecran
// existant montrait la semaine CALENDAIRE : un dimanche, il affichait six
// jours passes et masquait la semaine en cours. Demande de Kevin, 14/09/2026 :
// toujours les sept jours les plus recents.
//
// CE QUI N'EST PAS FAIT, ET NE DOIT PAS ETRE SIMULE : aucune synchronisation
// automatique. Rien dans ce module ne parle a Garmin, Apple ou Samsung.
// ⚠ UNE EXCEPTION VOULUE : « Modifier ma source » dit « Synchronisation
// automatique », a la demande expresse de Kevin (24/09/2026) — voir
// _sanSrcDesc. La saisie est manuelle ; l'architecture,
// elle, porte deja source et sourceDevice pour le jour ou une API existera.
const SAN_OBJ_SOMMEIL=480;              // 8 h, en minutes
const SAN_SOURCES=Object.freeze({
  manuel:'Saisie manuelle', apple:'Apple Santé', garmin:'Garmin Connect',
  samsung:'Samsung Health', google:'Google Health Connect', huawei:'Huawei Santé',
  fitbit:'Fitbit', xiaomi:'Mi Fitness', amazfit:'Zepp', polar:'Polar Flow',
  coros:'COROS', suunto:'Suunto', whoop:'WHOOP', oura:'Oura', withings:'Withings',
  autre:'Autre application'
});
let _sanOffset=0;   // 0 = les sept derniers jours ; -1 = les sept precedents
// PURE. Les sept jours de la periode, du plus ancien au plus recent.
function sanJours(offset){
  const d=new Date(); d.setHours(12,0,0,0);
  d.setDate(d.getDate()+(Number(offset)||0)*7);
  const out=[];
  for(let i=6;i>=0;i--){
    const j=new Date(d); j.setDate(d.getDate()-i);
    out.push({iso:localISODate(j),d:j});
  }
  return out;
}
function sanObjSommeil(u){ const n=Number(u&&u.sleepGoal); return isFinite(n)&&n>0?n:SAN_OBJ_SOMMEIL; }
function sanObjPas(u){
  const g=(u&&u.stepsGoals)||STEPS_GOALS_DEFAUT;
  const n=Number(g&&g.on); return isFinite(n)&&n>0?n:10000;
}
// Le coach peut verrouiller : l'athlete lit alors ses objectifs sans les changer.
function sanVerrouille(u){ return !!(u&&u.objectifsVerrouilles); }
function sanSource(u,quoi){
  const s=(u&&u.santeSource)||{};
  const k=s[quoi];
  return SAN_SOURCES[k]?{cle:k,lib:SAN_SOURCES[k]}:{cle:'manuel',lib:SAN_SOURCES.manuel};
}
// PURE. Minutes de sommeil d'un jour, ou null. duration est en HEURES dans le
// dossier depuis toujours : on convertit ici plutot que de migrer un historique.
function sanSommeilMin(u,iso){
  const e=((u&&u.sleepLog)||[]).find(x=>x&&x.date===iso);
  if(!e) return null;
  const h=Number(e.duration);
  return isFinite(h)&&h>0?Math.round(h*60):null;
}
function sanSommeilEntree(u,iso){ return ((u&&u.sleepLog)||[]).find(x=>x&&x.date===iso)||null; }
function sanPas(u,iso){
  const e=((u&&u.stepsLog)||[]).find(x=>x&&x.date===iso);
  const n=e?Number(e.count):NaN;
  return isFinite(n)&&n>=0?Math.round(n):null;
}
// PURE. Le resume de la periode : moyennes sur les jours RENSEIGNES, et le
// compte de ceux qui atteignent l'objectif. Une moyenne calculee sur sept
// jours dont trois sont vides dirait n'importe quoi.
function sanResume(u,offset){
  const js=sanJours(offset);
  const som=js.map(j=>sanSommeilMin(u,j.iso)).filter(v=>v!=null);
  const pas=js.map(j=>sanPas(u,j.iso)).filter(v=>v!=null);
  const oS=sanObjSommeil(u),oP=sanObjPas(u);
  const moy=a=>a.length?Math.round(a.reduce((s,v)=>s+v,0)/a.length):null;
  return {
    jours:js,
    sommeil:{moy:moy(som),renseignes:som.length,objectif:oS,
      atteints:som.filter(v=>v>=oS).length,
      ecart:som.length?moy(som)-oS:null},
    pas:{moy:moy(pas),renseignes:pas.length,objectif:oP,
      atteints:pas.filter(v=>v>=oP).length,
      ecart:pas.length?moy(pas)-oP:null}
  };
}
// ══ REGULARITE DU COUCHER ═══════════════════════════════════════════════
//
// La donnee dort dans le dossier depuis toujours : sleepLog[].bed. Elle n'etait
// pas exploitee, alors que la regularite du coucher est aussi predictive que la
// duree — deux athletes qui dorment 7 h se portent differemment selon qu'ils se
// couchent a 23 h tous les soirs ou entre 21 h et 2 h.
//
// ⚠ LE CALCUL EST CIRCULAIRE, ET C'EST TOUT LE PIEGE. Les heures de coucher
// vivent sur un CADRAN, pas sur une droite. Un coucher a 23h50 et un autre a
// 00h10 sont a 20 minutes l'un de l'autre ; lus lineairement — 1430 et 10 — ils
// sont a 23h40, et leur moyenne tombe a MIDI. Une implementation lineaire passe
// tous les cas de la vie courante et se trompe exactement sur ceux qui comptent :
// les couchers tardifs, ceux qu'on cherche justement a voir.
//
// La methode est celle des statistiques directionnelles : chaque heure devient
// un vecteur unitaire sur le cercle, on moyenne les vecteurs, et la LONGUEUR de
// la resultante dit la concentration. R proche de 1 = tous les couchers au meme
// endroit du cadran ; R proche de 0 = disperses.
const REG_COUCHER_NUITS=14;         // la fenetre, en nuits renseignees
function regulariteCoucher(u,nuits){
  const log=(u&&u.sleepLog)||[];
  if(!log.length) return null;
  const fen=(nuits>0?nuits:REG_COUCHER_NUITS);
  // Les plus recentes d'abord, et SEULEMENT celles qui portent un coucher :
  // les nuits importees par capture n'ont que leur duree, et les compter pour
  // zero mettrait quatorze minuits fictifs dans le calcul.
  const mins=log.slice()
    .sort((a,b)=>String((b&&b.date)||'').localeCompare(String((a&&a.date)||'')))
    .map(e=>_hhmmEnMin(e&&e.bed))
    .filter(v=>v!=null)
    .slice(0,fen);
  // UNE SEULE NUIT NE REND PAS ZERO. Zero se lirait « parfaitement regulier »,
  // ce qui est le contraire de ce qu'on sait d'une nuit unique.
  if(mins.length<2) return null;
  const TAU=Math.PI*2, PARMIN=TAU/1440;
  let C=0,S=0;
  for(const m of mins){ C+=Math.cos(m*PARMIN); S+=Math.sin(m*PARMIN); }
  C/=mins.length; S/=mins.length;
  const R=Math.sqrt(C*C+S*S);
  // L'ecart-type circulaire. R vaut 1 quand tout coincide : le logarithme
  // s'annule, et l'ecart avec lui. On borne a 1 pour que l'arrondi flottant ne
  // fasse pas un logarithme de 1,0000000002 — donc une racine de nombre negatif.
  const ecartRad=Math.sqrt(Math.max(0,-2*Math.log(Math.min(1,R))));
  const moyRad=Math.atan2(S,C);
  return {
    n:mins.length,
    moyenne:Math.round(((moyRad/PARMIN)%1440+1440)%1440),
    ecart:Math.round(ecartRad/PARMIN)
  };
}
// Les seuils sont ceux annonces a l'athlete : vert sous 30 min, orange
// jusqu'a une heure, rouge au-dela. LE VERT NE DIT JAMAIS AUTRE CHOSE QUE
// « tenu » — c'est la regle de couleur de tout l'ecran.
function _teinteRegularite(min){
  const m=Number(min)||0;
  return m<30?'#22c55e':(m<=60?'#f59e0b':ROUGE_MARQUE_MIN);
}
// ⚠ LA DETTE A SES PROPRES SEUILS, et elle a d'abord emprunte ceux de la
// regularite : toute dette au-dela d'une heure passait au rouge. Une heure de
// manque cumulee sur une semaine entiere n'est rien, et un rouge qui se declenche
// pour rien cesse d'etre lu — c'est l'inverse de ce qu'on cherche.
// L'echelle est celle du sommeil lui-meme : zero, c'est tenu ; en dessous d'UNE
// NUIT d'objectif, c'est un retard ordinaire ; au-dela, on a perdu une nuit
// pleine sur la semaine, et ca se dit.
function _teinteDette(min,objectif){
  const m=Number(min)||0;
  const o=Number(objectif)||SAN_OBJ_SOMMEIL;
  return m<=0?'#22c55e':(m<o?'#f59e0b':ROUGE_MARQUE_MIN);
}
// ══ DETTE DE SOMMEIL DE LA SEMAINE ══════════════════════════════════════
//
// La somme des manques sur les sept derniers jours, contre l'objectif.
//
// ⚠ LES NUITS ABSENTES NE COMPTENT PAS POUR ZERO. Une nuit oubliee valant zero
// ferait huit heures de dette par oubli : le chiffre dirait la saisie, pas le
// sommeil — exactement l'erreur que sanResume evite deja sur ses moyennes.
// Le nombre de nuits REELLEMENT lues repart avec le resultat, pour que l'ecran
// puisse le dire : une dette sur deux nuits n'est pas une dette hebdomadaire.
//
// ET LA DETTE NE DEVIENT PAS NEGATIVE. On affiche une dette, pas un solde :
// « −2h de dette » ne veut rien dire. Le surplus d'une nuit efface bien le
// manque d'une autre — c'est une somme, pas un cumul de manques — mais le
// total affiche s'arrete a zero.
function detteSommeil(u,jours){
  const n=(jours>0?jours:7);
  const obj=sanObjSommeil(u);
  const d=new Date(); d.setHours(12,0,0,0);
  let somme=0,lues=0;
  for(let i=0;i<n;i++){
    const j=new Date(d); j.setDate(d.getDate()-i);
    const m=sanSommeilMin(u,localISODate(j));
    if(m==null) continue;
    lues++; somme+=(obj-m);
  }
  if(!lues) return null;
  return {dette:Math.max(0,Math.round(somme)),nuits:lues,objectif:obj,fenetre:n};
}
// ══ SERIE EN COURS SUR LES PAS ══════════════════════════════════════════
//
// Le nombre de jours consecutifs ou l'objectif DU JOUR a ete atteint. L'objectif
// du jour, et non un chiffre unique : _stepsObjectifJour sait deja deduire le
// ON/OFF du type declare puis du programme, et un jour de repos a 7 000 pas
// n'est pas un echec a 10 000.
//
// ⚠ ON DIT POURQUOI LA SERIE S'ARRETE. Un jour oublie et un jour manque ne se
// corrigent pas de la meme facon : l'un se rattrape en saisissant, l'autre en
// marchant. Une serie qui s'arrete sans raison affichee laisse l'athlete
// conclure qu'il n'a pas marche alors qu'il a juste oublie de noter.
//
// LE JOUR EN COURS NE CASSE PAS LA SERIE tant qu'il n'a pas atteint son
// objectif : il n'est pas fini. Il la PROLONGE des qu'il l'atteint.
const SERIE_PAS_MAX=400;            // garde-fou de boucle, ~13 mois
function serieePas(u){
  const buts=(u&&u.stepsGoals)||STEPS_GOALS_DEFAUT;
  const types=(u&&u.stepsDayType)||{};
  const d=new Date(); d.setHours(12,0,0,0);
  const atteint=iso=>{
    const v=sanPas(u,iso);
    if(v==null) return 'vide';
    const but=_stepsObjectifJour(buts,types[iso]??null,iso);
    if(!(but>0)) return 'vide';     // sans objectif lisible, on n'invente pas de seuil
    return v>=but?'ok':'sous';
  };
  const isoDe=k=>{ const j=new Date(d); j.setDate(d.getDate()-k); return localISODate(j); };
  // Le jour en cours n'entre qu'en prolongation, jamais en rupture.
  let k=(atteint(isoDe(0))==='ok')?0:1;
  let n=0,raison=null;
  for(;k<SERIE_PAS_MAX;k++){
    const e=atteint(isoDe(k));
    if(e==='ok'){ n++; continue; }
    raison=e; break;
  }
  return {n,raison,objectifJour:_stepsObjectifJour(buts,types[isoDe(0)]??null,isoDe(0))};
}
// PURE. « 7h34 » a partir de minutes. Jamais « 7.57 h » : personne ne dort en
// centiemes d'heure.
function sanHM(min){
  const m=Math.max(0,Math.round(Number(min)||0));
  return Math.floor(m/60)+'h'+String(m%60).padStart(2,'0');
}
function sanHMSigne(min){
  const m=Math.round(Number(min)||0);
  return (m>0?'+':m<0?'−':'')+sanHM(Math.abs(m));
}
function sanNb(n){ return Number(Math.round(Number(n)||0)).toLocaleString('fr-FR'); }
// PURE. « 7h42 », « 7:42 », « 7.7 », « 462 » -> minutes. null si illisible.
// Accepter les quatre formes coute dix lignes ; les refuser coute une saisie
// abandonnee a chaque fois qu'on tape comme on parle.
function sanLireDuree(txt){
  const t=String(txt==null?'':txt).trim().toLowerCase().replace(',','.');
  if(!t) return null;
  let m=/^(\d{1,2})\s*[h:]\s*(\d{1,2})?$/.exec(t);
  if(m) return Number(m[1])*60+(m[2]?Number(m[2]):0);
  m=/^(\d{1,2})\s*h$/.exec(t);
  if(m) return Number(m[1])*60;
  const n=Number(t);
  if(!isFinite(n)||n<=0) return null;
  // Au-dela de 24, c'est forcement des minutes ; en dessous, des heures.
  return n>24?Math.round(n):Math.round(n*60);
}
// PURE. « 10 542 », « 10.5k », « 10542 » -> entier. null si illisible.
function sanLirePas(txt){
  const t=String(txt==null?'':txt).trim().toLowerCase()
    .replace(/[\s  ]/g,'').replace(',','.');
  if(!t) return null;
  const m=/^(\d+(?:\.\d+)?)k$/.exec(t);
  if(m) return Math.round(Number(m[1])*1000);
  const n=Number(t);
  return isFinite(n)&&n>=0?Math.round(n):null;
}
