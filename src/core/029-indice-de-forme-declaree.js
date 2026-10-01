// ══════════════ INDICE DE FORME DÉCLARÉE ══════════════
// Les six curseurs de fin de séance étaient écrits dans sessions[n].metrics et
// n'étaient relus NULLE PART. On en tire un indice, normalisé sur la base
// personnelle de l'athlète : une note de 5 ne veut rien dire dans l'absolu,
// elle ne vaut que comparée à ce que CET athlète met d'habitude.
//
// On décrit, on ne prescrit pas : aucun conseil de sommeil, d'alimentation ni
// de santé mentale n'est généré à partir d'un auto-report de trois curseurs.
const FORME_MAX=10;               // les curseurs vont de 0 à 10
const FORME_MIN_SEANCES=6;        // en dessous, aucune normalisation
const FORME_FENETRE=10;           // séances servant de base
const FORME_ECART_PLANCHER=0.8;   // sinon un athlète régulier déclencherait tout
const FORME_Z_CREUX=-1.5;
const FORME_Z_BAS=-0.8;
const FORME_Z_HAUT=1.0;
const FORME_JOURS_VIEILLE=60;     // au-delà, la base est signalée comme datée
const FORME_ITEMS=Object.freeze([
  {cle:'fatigue',   lib:'fatigue',    inverse:true},
  {cle:'motivation',lib:'motivation', inverse:false},
  {cle:'sensation', lib:'sensations', inverse:false}
]);
// F-61 EST LIVRÉE : plus aucun curseur n'est collecté sans être rendu.
//
// L'hydratation et la satisfaction sont RESTITUÉES ailleurs —
// hydratationMoyenne, satisfactionMoyenne, écran progression et fiche coach —
// mais aucune des deux n'entre dans l'indice. La restituer et la faire peser
// sur un score sont deux choses différentes : la première rend à l'athlète ce
// qu'il a saisi, la seconde ferait dépendre un verdict d'un curseur qu'on
// déplace sans y penser en fin de séance.
//
// L'INTENSITÉ, elle, a été retirée de l'écran : elle doublait le RIR saisi
// série par série. Les dossiers qui la portent restent lisibles.

// Curseur valide : un entier de 0 à 10. Les bornes sont celles du widget, pas
// celles de la spécification d'origine qui annonçait 1 à 10.
// ══════════════ HYDRATATION : RESTITUER CE QUI EST DÉJÀ COLLECTÉ ══════════════
// L'hydratation était collectée DEUX fois et exploitée ZÉRO fois : au bilan de
// départ, et après chaque séance. On la RESTITUE — on ne la juge pas, et on ne
// la fait entrer dans aucun indice.
const HYDRA_FENETRE_JOURS=28;
const HYDRA_MIN_SEANCES=4;        // en dessous, « moyenne » ne veut rien dire
// PURE. Rend {moyenne, nSeances} ou null.
// Une séance sans la valeur est EXCLUE, jamais comptée 0 : compter zéro
// transformerait un curseur non touché en déclaration de déshydratation.
function hydratationMoyenne(user,jours){
  const fen=(jours>0?jours:HYDRA_FENETRE_JOURS)*864e5;
  const limite=Date.now()-fen;
  const vals=[];
  for(const s of ((user&&user.sessions)||[])){
    if(!s||!s.date||s.date<limite) continue;
    const v=_valForme(s.metrics&&s.metrics.hydratation);
    if(v==null) continue;
    vals.push(v);
  }
  if(vals.length<HYDRA_MIN_SEANCES) return null;
  return {moyenne:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10,
    nSeances:vals.length};
}
// ── Repère de besoin ────────────────────────────────────────────────────────
// Comme REPERES_VOLUME, ces deux nombres sont des repères de
// PRATIQUE DE TERRAIN et non une mesure. Le besoin réel dépend de la chaleur,
// de l'altitude, de ce que l'athlète transpire, de ce qu'il mange et de ce qu'il
// boit par ailleurs. Aucun calcul ne remplace le fait de regarder la couleur de
// ses urines, et le texte le dit.
const EAU_ML_PAR_KG=35;
const EAU_ML_PAR_SEANCE=500;
// ⚠ LE POIDS DE RÉFÉRENCE, ET DES BORNES (30/09/2026). 35 ml × le poids total
//   donnait 4,2 L à 120 kg un jour de repos, 4,7 L un jour d'entraînement :
//   la masse grasse ne boit pas comme le muscle. Le poids est désormais celui
//   des macros (poidsMacros : masse maigre × 1,15 si très gras, sinon poids
//   ajusté si IMC ≥ 30, sinon poids total), le même pour tout le dossier.
//   Le repère de base est borné de 1,5 à 4,0 L ; le jour ON ajoute 0,5 L
//   par-dessus (4,5 L au plus).
const EAU_MIN_L=1.5, EAU_MAX_L=4.0;
// PURE. En litres, au dixième ; null sans poids.
function besoinEau(user,jourEstOn){
  let poids=null;
  try{ poids=poidsMacros(user).kg; }catch(e){ poids=null; }
  if(!(poids>0)) return null;
  const base=Math.min(EAU_MAX_L*1000,Math.max(EAU_MIN_L*1000,EAU_ML_PAR_KG*poids));
  const ml=base+(jourEstOn?EAU_ML_PAR_SEANCE:0);
  return Math.round(ml/100)/10;
}

// ── CE QUE L'ATHLÈTE BOIT : nutrition.eau[dateISO] = millilitres ─────────
// Un nombre par jour, de 0 à 10 000 (la règle de la base refuse au-delà : une
// valeur fausse ferait rejeter tout le dossier, donc l'app borne AVANT).
// 120 jours gardés, comme joursSeance. Un jour sans saisie n'est PAS zéro :
// il est absent, et la moyenne du coach ne le compte pas.
const EAU_SAISIE_MAX_ML=10000, EAU_JOURS_GARDES=120, EAU_MOY_JOURS=7;
function eauDuJour(u,d){
  const e=u&&u.nutrition&&u.nutrition.eau;
  const v=(e&&typeof e==='object')?Number(e[d]):0;
  return (v>0&&isFinite(v))?v:0;
}
// Les ajouts de la session, pour « Annuler » : chacun retire ce qu'il a ajouté.
let _eauAjouts=[];
function _eauEcrire(u,d,ml){
  if(!u.nutrition) u.nutrition={};
  const m=(u.nutrition.eau&&typeof u.nutrition.eau==='object')?u.nutrition.eau:{};
  const v=Math.max(0,Math.min(EAU_SAISIE_MAX_ML,Math.round(ml)));
  if(v>0) m[d]=v; else delete m[d];
  const lim=_jourPlus(d,-EAU_JOURS_GARDES);
  for(const k of Object.keys(m)) if(k<lim) delete m[k];
  u.nutrition.eau=m;
}
function ajouterEau(ml){
  const u=currentUser;
  if(!u||!(ml>0)) return false;
  const d=localISODate(new Date());
  const avant=eauDuJour(u,d);
  const apres=Math.min(EAU_SAISIE_MAX_ML,avant+ml);
  if(apres===avant){ try{ toast('10 L notés aujourd’hui : c’est le maximum.','var(--orange)'); }catch(e){} return false; }
  _eauEcrire(u,d,apres);
  _eauAjouts.push({d,ml:apres-avant});
  if(!saveUser()) try{ toastEcriture(false,'','ce verre est'); }catch(e){}
  _repeindreEau();
  return true;
}
function annulerEau(){
  const u=currentUser, x=_eauAjouts.pop();
  if(!u||!x) return false;
  _eauEcrire(u,x.d,eauDuJour(u,x.d)-x.ml);
  if(!saveUser()) try{ toastEcriture(false,'','l’annulation est'); }catch(e){}
  _repeindreEau();
  return true;
}
// PURE. Moyenne des jours NOTÉS parmi les 7 derniers (aujourd'hui compris).
function eauMoyenne7j(u,dRef){
  const fin=dRef||localISODate(new Date());
  const vals=[];
  for(let i=0;i<EAU_MOY_JOURS;i++){ const v=eauDuJour(u,_jourPlus(fin,-i)); if(v>0) vals.push(v); }
  if(!vals.length) return null;
  return {ml:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),nJours:vals.length};
}
const _eauL=ml=>String(Math.round(ml/100)/10).replace('.',',');
// Le suivi du jour, sous le repère : barre, +250, +500, annuler.
function _htmlEauSuivi(u,jourEstOn){
  const ml=eauDuJour(u,localISODate(new Date()));
  const bes=besoinEau(u,!!jourEstOn);
  const pct=bes?Math.min(100,Math.round(ml/(bes*1000)*100)):0;
  const btn='flex:1;min-width:0;padding:10px 0;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer';
  return `<div id="eau-suivi" style="margin-top:12px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">
      <span style="font-size:var(--fs-sm);color:var(--text-strong);font-weight:700">${_eauL(ml)} L bus aujourd’hui</span>
      <span style="font-size:var(--fs-xs);color:var(--text-dim)">${bes?'repère '+String(bes).replace('.',',')+' L':'sans repère'}</span>
    </div>
    ${bes?`<div role="progressbar" aria-label="Eau bue" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" style="height:8px;background:var(--surface-2);border-radius:var(--r-2);overflow:hidden;margin-bottom:10px">
      <div style="height:100%;width:${pct}%;background:var(--success);border-radius:var(--r-2)"></div></div>`:''}
    <div style="display:flex;gap:8px">
      <button type="button" class="hit44" style="${btn}" onclick="ajouterEau(250)">+250 ml</button>
      <button type="button" class="hit44" style="${btn}" onclick="ajouterEau(500)">+500 ml</button>
      <button type="button" class="hit44" style="${btn};color:var(--sub)${_eauAjouts.length?'':';opacity:.45'}" onclick="annulerEau()"${_eauAjouts.length?'':' disabled'}>Annuler</button>
    </div>
  </div>`;
}
function _repeindreEau(){
  const z=document.getElementById('eau-suivi');
  if(!z||!currentUser) return;
  let on=false; try{ on=nutIsOnDay(localISODate(new Date()),currentUser); }catch(e){ on=false; }
  z.outerHTML=_htmlEauSuivi(currentUser,on);
}
// DEUX PHRASES, ET NON UNE COUPEE PAR UN TIRET. « pas une mesure — la couleur
// des urines » se lisait comme si la couleur des urines etait ce qui n est pas
// une mesure, alors que c est le repere en litres qui ne l est pas. Corrige
// sur demande de Kevin, 24/08/2026.
const EAU_REGISTRE='Repère de terrain, pas une mesure. La couleur des urines en '
  +'dit plus qu\'un calcul.';
function phraseBesoinEau(user,jourEstOn){
  const l=besoinEau(user,jourEstOn);
  if(l==null) return '';
  return 'Repère : environ '+String(l).replace('.',',')+' L aujourd\'hui'
    +(jourEstOn?' (jour d\'entraînement)':'')+'. '+EAU_REGISTRE;
}
function phraseHydratation(h){
  if(!h) return '';
  return 'Hydratation déclarée : '+String(h.moyenne).replace('.',',')+' / '+FORME_MAX
    +' en moyenne sur '+h.nSeances+' séance'+(h.nSeances>1?'s':'')+'.';
}
// Aucune couleur, aucun jugement : deux phrases et le registre qui les encadre.
function _htmlHydratation(user,jourEstOn){
  const h=hydratationMoyenne(user);
  const b=phraseBesoinEau(user,!!jourEstOn);
  if(!h&&!b) return '';
  return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Hydratation</div>
    ${h?`<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(phraseHydratation(h))}</div>`:''}
    ${b?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:${h?'6px':'0'}">${escapeHtml(b)}</div>`:''}
  </div>`;
}

// ══════════════ F-61 : SATISFACTION — RESTITUER CE QUI EST COLLECTÉ ═══════
// Le curseur de satisfaction était écrit après chaque séance et lu par RIEN.
// Trois ans de valeurs, jamais rendues. On le RESTITUE, exactement comme
// l'hydratation avant lui : une moyenne, une fenêtre, et le rappel que c'est
// déclaratif.
//
// IL N'ENTRE PAS DANS L'INDICE DE FORME, et c'est délibéré : restituer une
// donnée et la faire peser sur un verdict sont deux choses différentes. Une
// séance ratée mais satisfaisante n'est pas une bonne séance, et l'inverse non
// plus. L'assertion qui épingle formeSeance reste vraie, mot pour mot.
//
// Le curseur d'INTENSITÉ, lui, est retiré : il recoupait le RIR déjà saisi
// série par série. Restituer un doublon n'aurait fait qu'ajouter un chiffre de
// plus à lire. Les valeurs déjà écrites restent dans les dossiers — on cesse
// d'en demander, on n'efface rien.
const SATIS_FENETRE_JOURS=28;
const SATIS_MIN_SEANCES=4;        // en dessous, « moyenne » ne veut rien dire
// PURE. Rend {moyenne, nSeances} ou null. Une séance sans la valeur est
// EXCLUE, jamais comptée 0 : un curseur non touché n'est pas une déclaration
// d'insatisfaction. Même règle que hydratationMoyenne.
function satisfactionMoyenne(user,jours){
  const fen=(jours>0?jours:SATIS_FENETRE_JOURS)*864e5;
  const limite=Date.now()-fen;
  const vals=[];
  for(const s of ((user&&user.sessions)||[])){
    if(!s||!s.date||s.date<limite) continue;
    const v=_valForme(s.metrics&&s.metrics.satisfaction);
    if(v==null) continue;
    vals.push(v);
  }
  if(vals.length<SATIS_MIN_SEANCES) return null;
  return {moyenne:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length*10)/10,
    nSeances:vals.length};
}
function phraseSatisfaction(s){
  if(!s) return '';
  return 'Satisfaction déclarée : '+String(s.moyenne).replace('.',',')+' / '+FORME_MAX
    +' en moyenne sur '+s.nSeances+' séance'+(s.nSeances>1?'s':'')+'.';
}
// Aucune couleur, aucun palier, aucun jugement : une phrase et son registre.
// On ne dit pas si 6/10 est bien ou mal — on ne le sait pas.
function _htmlSatisfaction(user){
  const s=satisfactionMoyenne(user);
  if(!s) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Satisfaction des séances</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(phraseSatisfaction(s))}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px;line-height:1.5">Déclaratif. N'entre pas dans l'indice de forme : une séance dure peut satisfaire, une séance facile peut décevoir.</div>
  </div>`;
}
// ── Sel sur sept jours ──────────────────────────────────────────────────────
// ON TOTALISE, ON NE COMPARE À RIEN — et ce bloc-ci ne change pas. Il disait
// qu'« il n'existe pas de seuil de sodium qui vaille pour un athlète sans
// savoir ce qu'il transpire » : c'est toujours vrai, et c'est précisément ce
// que le moteur sodique ci-dessous estime, jour par jour. Une MOYENNE SUR SEPT
// JOURS, elle, ne se compare toujours à rien : la cible bouge d'un jour à
// l'autre avec les séances, la chaleur et les glucides, et la comparer à une
// moyenne mélangerait sept contextes différents.
const SEL_FENETRE_JOURS=7;
const SEL_REGISTRE='La référence dépend de ton contexte et de ce que tu transpires.';
function selSemaine(user,ref){
  const log=((user&&user.nutrition)||{}).log||{};
  const base=(ref instanceof Date)?ref:new Date();
  let total=0, nJours=0, manquants=0;
  for(let i=0;i<SEL_FENETRE_JOURS;i++){
    const j=localISODate(new Date(base.getTime()-i*864e5));
    const e=(log[j]&&log[j].entries)||[];
    if(!e.length) continue;
    nJours++;
    for(const x of e){
      if(!x) continue;
      if(x.sel==null){ manquants++; continue; }
      total+=Number(x.sel)||0;
    }
  }
  if(!nJours) return null;
  return {total:Math.round(total*10)/10,
    parJour:Math.round(total/nJours*10)/10,nJours,manquants};
}
function _htmlSelSemaine(user){
  const s=selSemaine(user);
  if(!s) return '';
  return `<div style="margin-top:10px;font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">
    Sel : ${String(s.parJour).replace('.',',')} g par jour en moyenne sur ${s.nJours} jour${s.nJours>1?'s':''} journalisé${s.nJours>1?'s':''}.
    ${s.manquants?`${s.manquants} aliment${s.manquants>1?'s':''} sans donnée de sel.`:''}
    ${escapeHtml(SEL_REGISTRE)}
  </div>`;
}

// ══════════════ SODIUM : LE BESOIN DU JOUR, EN MILLIGRAMMES ═══════════════
// Portage du moteur @repcore/sodium, spécifié par Kevin. Domaine PUR : aucune
// entrée/sortie, aucune horloge interne — la date et le dossier arrivent en
// argument, et les mêmes entrées rendent toujours la même sortie.
//
// L'UNITÉ CANONIQUE EST LE MILLIGRAMME DE SODIUM. Le sel n'existe que comme
// vue d'affichage, et rien n'écrit de gramme de sel en base. Le journal, lui,
// stocke bien des grammes de sel — c'est ce que déclare l'étiquetage européen
// (Règl. UE 1169/2011) et ce que porte Ciqual : ils entrent par saltGToSodiumMg
// et ne ressortent en sel qu'à l'affichage.
//
// CE MODULE RÉPOND À UNE OBJECTION ÉCRITE JUSTE AU-DESSUS. selSemaine totalise
// sans comparer à rien, parce qu'« il n'existe pas de seuil de sodium qui
// vaille pour un athlète sans savoir ce qu'il transpire ». C'est exactement ce
// que ce moteur estime. Mais tant qu'aucune pesée avant/après n'a été faite, il
// l'estime avec une MÉDIANE de 1 L/h dont la plage réelle va de 0,3 à 2,5 L/h :
// la cible est alors un ordre de grandeur, et `estimation` le porte jusqu'à
// l'écran. L'objection n'est pas balayée, elle est datée — elle vaut tant que
// la mesure manque.
//
// CE MODULE EST UN OUTIL DE COACHING, PAS UN DISPOSITIF MÉDICAL.
const SODIUM_CONFIG=Object.freeze({
  // ── Socle ──────────────────────────────────────────────────────────────
  // HEURISTIQUE ASSUMÉE : la littérature ne donne pas de besoin de base indexé
  // sur la composition corporelle. L'indexation sur la masse maigre capture le
  // fait qu'un volume plasmatique et un turnover supérieurs vont avec un besoin
  // supérieur. Le plancher, lui, est l'Adequate Intake adulte (NAM 2019), et il
  // n'est pas une heuristique.
  socleMgParKgMasseMaigre:20,
  soclePlancherMg:1500,
  // Masse maigre estimée quand la masse grasse est inconnue. Approximation
  // GROSSIÈRE, signalée à l'écran par `masseMaigreEstimee`.
  partMaigreH:0.80, partMaigreF:0.72,
  // ── Sueur ──────────────────────────────────────────────────────────────
  sudationDefautLParH:1.0,
  // Bornes de PLAUSIBILITÉ, pas de normalité : au-delà, une pesée a été mal
  // saisie. On ramène aux bornes et on le DIT (IMPLAUSIBLE_MEASUREMENT).
  sudationMinLParH:0.2, sudationMaxLParH:3.0,
  // CES DEUX TABLES NE SONT PAS DANS LA SPÉCIFICATION. Elle nomme les
  // multiplicateurs sans publier leurs valeurs, et ses résultats de référence
  // ne permettent pas de les retrouver — deux lignes de son tableau donnent
  // deux multiplicateurs incompatibles entre eux. Les valeurs ci-dessous sont
  // donc CHOISIES, écrites une seule fois, et ce sont elles que les tests
  // épinglent.
  environnement:Object.freeze({fraiche:0.85,temperee:1,chaude:1.35,tres_chaude:1.6}),
  intensite:Object.freeze({legere:0.8,moderee:1,intense:1.25}),
  // Concentration sodique de la sueur par phénotype, en mg/L.
  concentrationMgParL:Object.freeze({LOW:460,MODERATE:805,HIGH:1150,VERY_HIGH:1610}),
  phenotypeDefaut:'MODERATE',
  // Un patch régional surestime la valeur corps entier de 20 à 25 %.
  correctionPatchRegional:0.8,
  testPerimeMois:12,
  // ── Modificateurs contextuels ──────────────────────────────────────────
  // La restriction glucidique pèse le plus lourd ET c'est la mieux établie : la
  // chute de l'insuline réduit la réabsorption tubulaire du sodium. C'est le
  // mécanisme derrière la « keto flu » et derrière les jambes coupées en sèche
  // low-carb.
  cetogeneSeuilG:50,  cetogeneMg:1500,
  lowCarbSeuilG:130,  lowCarbMg:750,
  hydratationMlParKg:40, hydratationMgParL:200,
  chaleurPassiveMg:500,
  // Volontairement PETIT et tagué LOW : la compétition
  // progestérone/aldostérone sur le récepteur minéralocorticoïde est réelle,
  // mais les données sportives sont hétérogènes. Neutralisé sous contraception
  // hormonale.
  lutealFacteur:1.05,
  // DÉSACTIVÉ PAR DÉFAUT : l'effet natriurétique aigu est réel chez le
  // non-habitué, mais largement aboli par la tolérance, et la population
  // RepCore est majoritairement consommatrice chronique. L'activer est une
  // décision de produit, pas un défaut.
  cafeineSeuilMgParKg:6, cafeineMgPar100mg:40,
  activerModificateurCafeine:false,
  // ── Plafonds ───────────────────────────────────────────────────────────
  plafondAthleteMg:6000,
  plafondMedicalMg:2300,          // CDRR, NAM 2019
  // La cible s'arrondit : un besoin estimé ne se lit pas au milligramme.
  arrondiMg:50,
  // ── Alertes ────────────────────────────────────────────────────────────
  hypoLitres:4, hypoConcentrationMgParL:400,
  seuilBienEnDessous:0.60, seuilEnDessous:0.85, seuilSueurNonCompensee:0.50,
  ratioMax:3
});
// LE FACTEUR EST STŒCHIOMÉTRIQUE : NaCl pèse 58,44 g/mol pour 22,99 g/mol de
// sodium, soit 2,542. L'import d'étiquettes du journal, lui, utilise 2,5 —
// écart de 1,7 %. On ne l'aligne PAS ici : changer le convertisseur d'import
// déplacerait la valeur de sel de chaque aliment déjà enregistré.
const SODIUM_SEL_FACTEUR=2.542;
function sodiumMgToSaltG(mg){ return (Number(mg)||0)*SODIUM_SEL_FACTEUR/1000; }
function saltGToSodiumMg(g){ return (Number(g)||0)*1000/SODIUM_SEL_FACTEUR; }
// 1 mmol de sodium pèse 22,99 mg.
function mmolPerLToMgPerL(mmol){ return (Number(mmol)||0)*22.99; }
function mgPerLToMmolPerL(mg){ return (Number(mg)||0)/22.99; }
function _sodArrondi(mg,cfg){
  const p=((cfg||SODIUM_CONFIG).arrondiMg)||1;
  return Math.round((Number(mg)||0)/p)*p;
}
function _sodNombre(v){ const n=Number(v); return isFinite(n)?n:null; }

// PURE. La masse maigre, et d'où elle vient. Rend toujours un objet : sans
// poids, `kg` est null et tout le reste du moteur s'arrête proprement.
//
// UNE MASSE MAIGRE DÉJÀ CONNUE PASSE AVANT TOUT. RepCore en calcule une depuis
// le dernier bilan, par la formule US Navy, et cette lecture-là est déjà
// éprouvée : la refaire ici en repartant du pourcentage de masse grasse serait
// une seconde lecture de la même chose, et deux lectures finissent par
// diverger.
function fatFreeMassKg(athlete,config){
  const cfg=config||SODIUM_CONFIG;
  const connue=_sodNombre(athlete&&athlete.fatFreeMassKg);
  if(connue!=null&&connue>0) return {kg:connue,estimee:false};
  const p=_sodNombre(athlete&&athlete.weightKg);
  if(!(p>0)) return {kg:null,estimee:true};
  const mg=_sodNombre(athlete&&athlete.bodyFatPct);
  if(mg!=null&&mg>0&&mg<70) return {kg:p*(1-mg/100),estimee:false};
  const part=isFemale(athlete&&athlete.gender)?cfg.partMaigreF:cfg.partMaigreH;
  return {kg:p*part,estimee:true};
}
// PURE. 20 mg par kg de masse maigre, plancher à l'Adequate Intake.
function baselineSodiumMg(athlete,config){
  const cfg=config||SODIUM_CONFIG;
  const mm=fatFreeMassKg(athlete,cfg);
  if(mm.kg==null) return null;
  return Math.max(cfg.soclePlancherMg,mm.kg*cfg.socleMgParKgMasseMaigre);
}
// PURE. Le taux de sudation d'une pesée avant/après :
//   sudation (L/h) = (masse_avant − masse_après + liquides − urine) / durée
// LA PERTE DE MASSE PAR OXYDATION ET RESPIRATION (10 à 20 g/h) EST NÉGLIGÉE :
// moins de 2 % du total sur une séance de musculation.
function sweatRateFromMeasurement(m,config){
  const cfg=config||SODIUM_CONFIG;
  if(!m) return null;
  const av=_sodNombre(m.massBeforeKg), ap=_sodNombre(m.massAfterKg);
  const min=_sodNombre(m.durationMin);
  if(av==null||ap==null||!(min>0)) return null;
  const liq=(_sodNombre(m.fluidsL)||0), uri=(_sodNombre(m.urineL)||0);
  const brut=(av-ap+liq-uri)/(min/60);
  const borne=Math.min(cfg.sudationMaxLParH,Math.max(cfg.sudationMinLParH,brut));
  return {lParH:borne,brut,ramene:borne!==brut};
}
// PURE. L'ordre de priorité de la spécification, dans cet ordre exact :
//   1. pesée fournie pour CETTE séance             — mesure
//   2. taux déjà calculé pour CETTE séance         — mesure
//   3. taux de référence × environnement × intensité — estimation
//   4. défaut du moteur × environnement × intensité  — estimation
//
// LES MULTIPLICATEURS NE S'APPLIQUENT JAMAIS À UNE MESURE. Une pesée intègre
// déjà la chaleur de la salle et l'intensité du travail : les rappliquer
// compterait deux fois les mêmes conditions.
function resolveSweatRate(athlete,session,config){
  const cfg=config||SODIUM_CONFIG;
  const s=session||{};
  const mes=sweatRateFromMeasurement(s.measurement,cfg);
  if(mes) return {lParH:mes.lParH,mesure:true,ramene:!!mes.ramene,source:'PESEE'};
  const deja=_sodNombre(s.sweatRateLPerH);
  if(deja!=null&&deja>0)
    return {lParH:deja,mesure:true,ramene:false,source:'TAUX_SEANCE'};
  const e=cfg.environnement[String(s.environment||'temperee')];
  const i=cfg.intensite[String(s.intensity||'moderee')];
  const env=(e==null?1:e), inten=(i==null?1:i);
  const ref=_sodNombre(athlete&&athlete.referenceSweatRateLPerH);
  const utile=(ref!=null&&ref>0);
  const base=utile?ref:cfg.sudationDefautLParH;
  return {lParH:base*env*inten,mesure:false,ramene:false,
    source:utile?'REFERENCE':'DEFAUT'};
}
// PURE. Un test de sueur réel écrase le phénotype ; un patch RÉGIONAL est
// corrigé, parce qu'il surestime la valeur corps entier ; un test de plus de
// douze mois est marqué périmé, l'acclimatation modifiant la concentration.
function resolveSweatSodiumConcentration(athlete,config,maintenantMs){
  const cfg=config||SODIUM_CONFIG;
  const t=athlete&&athlete.sweatTest;
  const v=t?_sodNombre(t.sodiumMgPerL):null;
  if(v!=null&&v>0){
    const mg=t.regionalPatch?v*cfg.correctionPatchRegional:v;
    let perime=false;
    const d=t.date?new Date(t.date).getTime():NaN;
    if(isFinite(d)){
      const ms=(maintenantMs!=null?maintenantMs:Date.now())-d;
      perime=ms>cfg.testPerimeMois*30.44*864e5;
    }
    return {mgParL:mg,source:'TEST',perime,patchCorrige:!!t.regionalPatch};
  }
  const ph=String((athlete&&athlete.sweatPhenotype)||cfg.phenotypeDefaut);
  const c=cfg.concentrationMgParL[ph];
  return {mgParL:(c==null?cfg.concentrationMgParL[cfg.phenotypeDefaut]:c),
    source:'PHENOTYPE',perime:false,patchCorrige:false,
    phenotype:(c==null?cfg.phenotypeDefaut:ph)};
}
// PURE. La perte d'UNE séance : sudation × durée × concentration.
function sessionSodiumLoss(athlete,session,config,maintenantMs){
  const cfg=config||SODIUM_CONFIG;
  const s=session||{};
  const min=_sodNombre(s.durationMin);
  if(!(min>0)) return null;
  const taux=resolveSweatRate(athlete,s,cfg);
  const conc=resolveSweatSodiumConcentration(athlete,cfg,maintenantMs);
  const litres=taux.lParH*(min/60);
  return {sodiumMg:litres*conc.mgParL,litres,dureeMin:min,
    tauxLParH:taux.lParH,rateWasMeasured:taux.mesure,tauxSource:taux.source,
    tauxRamene:taux.ramene,concentrationMgParL:conc.mgParL,
    concentrationSource:conc.source,testPerime:conc.perime};
}
// PURE. Le plafond applicable. RÈGLE NON NÉGOCIABLE : dès qu'un drapeau
// médical est présent, la cible est plafonnée à la recommandation population
// générale. Le module ne recommande JAMAIS un apport sportif au-dessus d'une
// contrainte médicale.
function resolveCeiling(athlete,config){
  const cfg=config||SODIUM_CONFIG;
  const presc=_sodNombre(athlete&&athlete.prescribedCeilingMg);
  if(presc!=null&&presc>0) return {mg:presc,motif:'PRESCRIPTION'};
  const dr=(athlete&&athlete.medicalFlags)||[];
  if(dr.length) return {mg:cfg.plafondMedicalMg,motif:'MEDICAL'};
  return {mg:cfg.plafondAthleteMg,motif:'ATHLETE'};
}
// PURE. LA CIBLE. Rend null quand le poids manque : sans lui le socle n'existe
// pas, et servir le plancher de 1500 mg comme une cible personnelle serait un
// chiffre inventé.
function calculateSodiumTarget(athlete,context,config,maintenantMs){
  const cfg=config||SODIUM_CONFIG;
  const ctx=context||{};
  const socle=baselineSodiumMg(athlete,cfg);
  if(socle==null) return null;
  const mm=fatFreeMassKg(athlete,cfg);
  const comps=[{cle:'socle',lib:'Socle',mg:socle,preuve:'HEURISTIQUE'}];
  // ── Pertes sudorales, séance par séance ───────────────────────────────
  const seances=[];
  let sueur=0;
  for(const s of (Array.isArray(ctx.sessions)?ctx.sessions:[])){
    const p=sessionSodiumLoss(athlete,s,cfg,maintenantMs);
    if(!p) continue;
    seances.push(p); sueur+=p.sodiumMg;
  }
  // Le multiplicateur de phase porte SUR LA SEULE PART SUDORALE, jamais sur le
  // socle : c'est la rétention sodée qui est en jeu, pas le besoin de base.
  const luteal=!!ctx.cyclePhase&&String(ctx.cyclePhase).indexOf('luteal')===0
    &&!ctx.hormonalContraception;
  if(luteal) sueur*=cfg.lutealFacteur;
  if(sueur>0) comps.push({cle:'sueur',lib:'Pertes sudorales',mg:sueur,
    preuve:'MODERATE',lutealApplique:luteal});
  // ── Modificateurs contextuels ─────────────────────────────────────────
  const gluc=_sodNombre(ctx.carbsG);
  if(gluc!=null){
    if(gluc<cfg.cetogeneSeuilG)
      comps.push({cle:'cetogene',lib:'Cétogène',mg:cfg.cetogeneMg,preuve:'HIGH'});
    else if(gluc<=cfg.lowCarbSeuilG)
      comps.push({cle:'low_carb',lib:'Low-carb',mg:cfg.lowCarbMg,preuve:'HIGH'});
  }
  const litres=_sodNombre(ctx.fluidsL);
  const poids=_sodNombre(athlete&&athlete.weightKg);
  if(litres!=null&&poids>0){
    const seuilL=poids*cfg.hydratationMlParKg/1000;
    if(litres>seuilL)
      comps.push({cle:'hydratation',lib:'Apport hydrique élevé',
        mg:(litres-seuilL)*cfg.hydratationMgParL,preuve:'MODERATE'});
  }
  if(ctx.passiveHeat)
    comps.push({cle:'chaleur',lib:'Chaleur passive',mg:cfg.chaleurPassiveMg,
      preuve:'MODERATE'});
  const caf=_sodNombre(ctx.caffeineMg);
  if(cfg.activerModificateurCafeine&&caf!=null&&poids>0){
    const seuil=poids*cfg.cafeineSeuilMgParKg;
    if(caf>seuil)
      comps.push({cle:'cafeine',lib:'Caféine',
        mg:(caf-seuil)/100*cfg.cafeineMgPar100mg,preuve:'LOW'});
  }
  const brut=comps.reduce((a,c)=>a+c.mg,0);
  const plafond=resolveCeiling(athlete,cfg);
  // L'ORDRE DES DEUX BORNES N'EST PAS INDIFFÉRENT. Le socle d'un athlète très
  // lourd peut dépasser le plafond médical ; c'est le plafond qui gagne, sinon
  // la règle non négociable ne le serait plus.
  const borne=Math.min(plafond.mg,Math.max(socle,brut));
  const cible=_sodArrondi(borne,cfg);
  return {targetSodiumMg:cible,
    targetSaltG:Math.round(sodiumMgToSaltG(cible)*10)/10,
    uncappedSodiumMg:Math.round(brut),
    baselineSodiumMg:Math.round(socle),
    components:comps.map(c=>Object.assign({},c,{mg:Math.round(c.mg)})),
    sessionBreakdown:seances,
    ceiling:plafond,
    fatFreeMassKg:(mm.kg==null?null:Math.round(mm.kg*10)/10),
    masseMaigreEstimee:mm.estimee,
    // VRAI dès qu'une séance au moins n'a pas été mesurée, et vrai aussi sans
    // séance du tout : le socle lui-même est une heuristique.
    estimation:!seances.length||seances.some(s=>!s.rateWasMeasured),
    plafonne:brut>plafond.mg};
}
// PURE. Le total apporté, et d'où il vient. LE SODIUM PRIME SUR LE SEL quand
// les deux champs sont là : c'est la donnée primaire, le sel en est la vue.
// Une entrée sans donnée est COMPTÉE COMME TELLE, jamais comme un zéro.
function summarizeIntake(entries){
  const out={totalSodiumMg:0,bySource:{},nEntrees:0,sansDonnee:0};
  for(const e of (Array.isArray(entries)?entries:[])){
    if(!e) continue;
    const mg=_sodNombre(e.sodiumMg);
    const g=_sodNombre(e.saltG);
    let v=null;
    if(mg!=null) v=mg; else if(g!=null) v=saltGToSodiumMg(g);
    if(v==null){ out.sansDonnee++; continue; }
    out.nEntrees++;
    out.totalSodiumMg+=v;
    const src=String(e.source||'FOOD');
    out.bySource[src]=(out.bySource[src]||0)+v;
  }
  out.totalSodiumMg=Math.round(out.totalSodiumMg);
  out.totalSaltG=Math.round(sodiumMgToSaltG(out.totalSodiumMg)*10)/10;
  return out;
}
const SODIUM_SEVERITES=Object.freeze({CRITICAL:0,WARNING:1,INFO:2});
// PURE. Les alertes, TRIÉES, les CRITICAL en tête.
function buildAlerts(target,intake,context,athlete,config){
  const cfg=config||SODIUM_CONFIG;
  const ctx=context||{}, a=[];
  const sousContrainte=!!(target&&target.ceiling&&target.ceiling.motif!=='ATHLETE');
  const flags=((athlete&&athlete.medicalFlags)||[]);
  if(flags.length)
    a.push({code:'MEDICAL_REVIEW_REQUIRED',severite:'CRITICAL',motifs:flags.slice()});
  // LE VRAI GARDE-FOU DE SÉCURITÉ DU MODULE. Le risque, en musculation, ne
  // vient pas de l'excès de sel : il vient du gros volume hydrique associé à un
  // sodium bas, typique d'une sèche mal conduite.
  const litres=_sodNombre(ctx.fluidsL);
  if(litres!=null&&litres>cfg.hypoLitres&&intake){
    const parL=intake.totalSodiumMg/litres;
    if(parL<cfg.hypoConcentrationMgParL)
      a.push({code:'HYPONATREMIA_RISK',severite:'CRITICAL',
        mgParL:Math.round(parL),litres});
  }
  if(target&&intake&&intake.totalSodiumMg>target.ceiling.mg)
    a.push({code:'ABOVE_CEILING',severite:(sousContrainte?'CRITICAL':'WARNING'),
      plafondMg:target.ceiling.mg});
  const ratio=(target&&target.targetSodiumMg>0&&intake)
    ?intake.totalSodiumMg/target.targetSodiumMg:null;
  if(ratio!=null&&ratio<cfg.seuilBienEnDessous)
    a.push({code:'WELL_BELOW_TARGET',severite:'WARNING',ratio});
  const seances=(target&&target.sessionBreakdown)||[];
  const perte=seances.reduce((s,x)=>s+x.sodiumMg,0);
  if(perte>0&&intake&&target){
    const couvert=intake.totalSodiumMg-target.baselineSodiumMg;
    if(couvert<perte*cfg.seuilSueurNonCompensee)
      a.push({code:'UNREPLACED_SWEAT_LOSS',severite:'WARNING',
        perteMg:Math.round(perte)});
  }
  if(ratio!=null&&ratio>=cfg.seuilBienEnDessous&&ratio<cfg.seuilEnDessous)
    a.push({code:'BELOW_TARGET',severite:'INFO',ratio});
  if(seances.some(s=>s.testPerime)) a.push({code:'STALE_SWEAT_TEST',severite:'INFO'});
  if(seances.some(s=>s.tauxRamene))
    a.push({code:'IMPLAUSIBLE_MEASUREMENT',severite:'INFO'});
  if(!a.length) a.push({code:'ON_TARGET',severite:'INFO'});
  return a.sort((x,y)=>SODIUM_SEVERITES[x.severite]-SODIUM_SEVERITES[y.severite]);
}
// PURE. LE POINT D'ENTRÉE : cible, apport, écart et alertes en un objet.
function calculateDailySodiumBalance(athlete,context,entries,config,maintenantMs){
  const cfg=config||SODIUM_CONFIG;
  const target=calculateSodiumTarget(athlete,context,cfg,maintenantMs);
  const intake=summarizeIntake(entries);
  if(!target) return {target:null,intake,deltaSodiumMg:null,attainmentRatio:null,
    alerts:buildAlerts(null,intake,context,athlete,cfg)};
  const ratio=target.targetSodiumMg>0
    ?Math.min(cfg.ratioMax,intake.totalSodiumMg/target.targetSodiumMg):0;
  return {target,intake,
    deltaSodiumMg:intake.totalSodiumMg-target.targetSodiumMg,
    attainmentRatio:Math.round(ratio*100)/100,
    alerts:buildAlerts(target,intake,context,athlete,cfg)};
}

// ── ADAPTATEURS REPCORE ────────────────────────────────────────────────────
// Le moteur ci-dessus ne connaît pas le dossier RepCore, et c'est délibéré : il
// se teste sur des objets nus. Ces fonctions-ci font la traduction, et elles
// sont le SEUL endroit où le dossier est lu.

// PURE. Les drapeaux MÉDICAUX au sens de ce module. Aucun n'est un diagnostic
// posé par RepCore : ce sont des déclarations de l'athlète, ou un relevé qu'il a
// lui-même saisi et que l'application se contente de compter.
function _sodiumDrapeauxMedicaux(user){
  const d=[];
  try{ if(alerteTension(user).alerte) d.push('TENSION_RELEVEE'); }catch(e){}
  try{ if(drapeauQuelconqueActif(user)) d.push('DRAPEAU_ACTIF'); }catch(e){}
  try{
    const f=famillesTraitement(user);
    // Les deux familles de la liste dont l'effet sodique est établi : les
    // corticoïdes retiennent le sodium, les bêtabloquants accompagnent le plus
    // souvent une contrainte tensionnelle. Les deux autres — thyroïdien,
    // antidiabétique — ne sont PAS des drapeaux sodiques et n'entrent pas.
    if(f.indexOf('corticoide')>=0) d.push('TRAITEMENT_CORTICOIDE');
    if(f.indexOf('betabloquant')>=0) d.push('TRAITEMENT_BETABLOQUANT');
  }catch(e){}
  return d;
}
function _sodiumAthleteDe(user){
  let poids=null;
  try{ poids=_poidsPourPlancher(user); }catch(e){}
  let mm=null;
  try{ mm=masseMaigreDuBilan(user); }catch(e){}
  const s=(user&&user.sodium)||{};
  return {weightKg:poids,
    // Elle vient du dernier bilan et repose sur ses mensurations ; le poids,
    // lui, vient de la dernière pesée. Les deux peuvent donc dater de jours
    // différents, et c'est voulu : chacun est la donnée la plus fraîche de son
    // espèce.
    fatFreeMassKg:mm,
    gender:(user&&user._evol_gender)||(user&&user.gender)||'H',
    sweatPhenotype:s.phenotype||null,
    referenceSweatRateLPerH:_sodNombre(s.referenceSweatRateLPerH),
    sweatTest:s.sweatTest||null,
    prescribedCeilingMg:_sodNombre(s.prescribedCeilingMg),
    medicalFlags:_sodiumDrapeauxMedicaux(user)};
}
// Les litres bus, tels que l'athlète les a déclarés au bilan de départ. C'est
// une FOURCHETTE, pas une mesure : on prend son milieu, et « plus de 4 L » prend
// sa borne basse plutôt que d'inventer un plafond.
const SODIUM_EAU_DECLAREE=Object.freeze([
  Object.freeze({re:/moins\s*de\s*1/,litres:0.8}),
  Object.freeze({re:/1\s*a\s*2/,     litres:1.5}),
  Object.freeze({re:/2\s*a\s*3/,     litres:2.5}),
  Object.freeze({re:/3\s*a\s*4/,     litres:3.5}),
  Object.freeze({re:/plus\s*de\s*4/, litres:4.5})
]);
// _microNorm retire les accents : « Entre 3 à 4L » devient « entre 3 a 4l », et
// c'est cette forme-là que les motifs ci-dessus décrivent.
function _sodiumLitresDeclares(user){
  let brut=null;
  try{ brut=_dernierChamp(user,'deb-water'); }catch(e){}
  const l=Array.isArray(brut)?brut:(brut==null?[]:[brut]);
  for(const v of l){
    const n=_microNorm(v);
    if(!n) continue;
    const t=SODIUM_EAU_DECLAREE.find(x=>x.re.test(n));
    if(t) return t.litres;
  }
  return null;
}
// LES SÉANCES RÉELLEMENT ENREGISTRÉES CE JOUR-LÀ, avec LEUR durée. C'est la
// donnée la plus juste que RepCore possède, et il en possède une : chaque
// séance terminée porte ses minutes. Deux séances dans la journée en font deux.
function _sodiumSeancesDuJour(user,dateISO){
  const out=[];
  for(const x of ((user&&user.sessions)||[])){
    if(!x||!x.date) continue;
    let j=null;
    try{ j=localISODate(new Date(x.date)); }catch(e){ j=null; }
    if(j!==dateISO) continue;
    const min=Number(x.duration);
    if(min>0) out.push({durationMin:min,reelle:true});
  }
  return out;
}
// À DÉFAUT SEULEMENT : la médiane des séances récentes. Elle ne sert qu'au jour
// d'entraînement dont la séance n'est pas encore faite — sur un jour passé sans
// séance enregistrée, elle inventerait une sudation qui n'a pas eu lieu.
const SODIUM_SEANCES_FENETRE=28;
const SODIUM_SEANCES_MIN=3;
function _sodiumDureeSeance(user,maintenantMs){
  const t=(maintenantMs!=null?maintenantMs:Date.now())-SODIUM_SEANCES_FENETRE*864e5;
  const d=((user&&user.sessions)||[])
    .filter(s=>s&&s.date>=t&&Number(s.duration)>0)
    .map(s=>Number(s.duration)).sort((a,b)=>a-b);
  if(d.length<SODIUM_SEANCES_MIN) return null;
  const i=Math.floor(d.length/2);
  return d.length%2?d[i]:Math.round((d[i-1]+d[i])/2);
}
// La caféine du jour, telle que l'athlète l'a saisie prise par prise. Le
// modificateur reste DÉSACTIVÉ par défaut — activerModificateurCafeine — mais
// l'entrée, elle, est branchée sur la vraie donnée : le jour où la décision de
// produit change, il n'y a rien d'autre à câbler.
function _sodiumCafeineJour(user,dateISO){
  const j=((((user&&user.nutrition)||{}).caffeine||{}).days||{})[dateISO];
  if(!Array.isArray(j)) return null;
  let t=0,n=0;
  for(const e of j){
    const mg=Number(e&&e.mg);
    if(isFinite(mg)&&mg>0){ t+=mg; n++; }
  }
  return n?t:null;
}
function _sodiumContexteDe(user,dateISO,macrosJour,maintenantMs){
  // AUCUN environnement, AUCUNE intensité ne sont passés : RepCore ne les
  // collecte pas, et les inventer produirait une sudation inventée. Le moteur
  // retombe donc sur « tempérée » et « modérée », qui valent 1 — c'est-à-dire
  // sur le taux de référence, ou sur le défaut, sans correction.
  let sessions=_sodiumSeancesDuJour(user,dateISO);
  if(!sessions.length){
    let jourOn=false;
    try{ jourOn=nutIsOnDay(dateISO,user); }catch(e){}
    if(jourOn){
      const min=_sodiumDureeSeance(user,maintenantMs);
      if(min) sessions=[{durationMin:min}];
    }
  }
  let phase=null;
  try{ phase=phaseCycle(user,dateISO); }catch(e){}
  // LE MÊME VERROU QUE LES MACROS, ET PAS UN AUTRE. _applyNutCycleModifier
  // écarte déjà la contraception CALENDAIRE — « le calendrier existe, mais il
  // ne décrit aucune physiologie » — en plus de la continue. N'écarter que la
  // continue aurait appliqué ici un ajustement métabolique que l'écran des
  // macros refuse au même dossier, le même jour.
  let neutre=false;
  try{ neutre=cycleSansCycle(user)||cycleCalendaireSeul(user); }catch(e){}
  return {sessions,
    carbsG:_sodNombre(macrosJour&&macrosJour.g),
    fluidsL:_sodiumLitresDeclares(user),
    cyclePhase:phase,
    hormonalContraception:neutre,
    passiveHeat:false,
    caffeineMg:_sodiumCafeineJour(user,dateISO)};
}
// LE POINT D'ENTRÉE DU PRODUIT. Rend null — et non zéro, et non un plancher —
// quand le poids manque, ou quand une grossesse ou un allaitement suspend les
// prescriptions. C'est la règle de repartitionPrises, pour la même raison : une
// cible est une forme de prescription, et RepCore n'en pose pas là.
function cibleSodiumJour(user,dateISO,macrosJour,maintenantMs){
  if(!user) return null;
  try{ if(grossesseSuspend(user)) return null; }catch(e){}
  const a=_sodiumAthleteDe(user);
  if(!(a.weightKg>0)) return null;
  const ctx=_sodiumContexteDe(user,dateISO,macrosJour,maintenantMs);
  return calculateSodiumTarget(a,ctx,SODIUM_CONFIG,maintenantMs);
}
// Le bilan du jour : la cible, l'apport lu dans le journal, l'écart, les
// alertes. Le journal stocke des GRAMMES DE SEL — ils entrent par `saltG`, que
// summarizeIntake convertit en milligrammes de sodium.
function bilanSodiumJour(user,dateISO,macrosJour,maintenantMs){
  if(!user) return null;
  try{ if(grossesseSuspend(user)) return null; }catch(e){}
  const a=_sodiumAthleteDe(user);
  const ctx=_sodiumContexteDe(user,dateISO,macrosJour,maintenantMs);
  const jour=((((user.nutrition||{}).log)||{})[dateISO]||{}).entries||[];
  const entrees=jour.map(e=>({saltG:(e&&e.sel!=null)?e.sel:null,
    source:(e&&e.source)||'FOOD'}));
  return calculateDailySodiumBalance(a,ctx,entrees,SODIUM_CONFIG,maintenantMs);
}
// La phrase qui accompagne la cible. Elle dit sur quoi la cible repose, parce
// qu'une estimation présentée comme une mesure est pire qu'un silence — et le
// silence, c'est ce que ce module vient de remplacer.
const SODIUM_PHRASE_ESTIME='Estimation : sans pesée avant/après séance, ta '
  +'sudation est prise à 1 L/h, et la plage réelle va de 0,3 à 2,5 L/h.';
const SODIUM_PHRASE_MESURE='Calculé sur ta sudation mesurée.';
const SODIUM_PHRASE_MEDICAL='Plafonné à la recommandation population générale : '
  +'une déclaration de santé est active. C\'est un sujet de médecin.';
const SODIUM_PHRASE_MM_ESTIMEE='Masse maigre estimée, faute de mensurations : '
  +'renseigne cou, taille et hanches pour affiner.';
function phraseCibleSodium(t){
  if(!t) return '';
  if(t.ceiling&&t.ceiling.motif==='MEDICAL') return SODIUM_PHRASE_MEDICAL;
  if(t.masseMaigreEstimee) return SODIUM_PHRASE_MM_ESTIMEE;
  return t.estimation?SODIUM_PHRASE_ESTIME:SODIUM_PHRASE_MESURE;
}

function _valForme(v){
  const n=parseInt(v,10);
  return (isFinite(n)&&n>=0&&n<=FORME_MAX)?n:null;
}
// Contribution d'un item, tous ramenés dans le même sens : 10 = au mieux.
// La fatigue est inversée par 10 − f et non 11 − f : à 11 − f, une fatigue nulle
// vaudrait 11, hors de l'échelle des deux autres items.
function _contribForme(m,item){
  const v=_valForme(m&&m[item.cle]);
  if(v==null) return null;
  return item.inverse?FORME_MAX-v:v;
}
function formeSeance(sess){
  const m=sess&&sess.metrics;
  if(!m) return null;
  const vals=FORME_ITEMS.map(it=>_contribForme(m,it)).filter(v=>v!=null);
  // Moins de deux items : la moyenne ne veut plus rien dire.
  if(vals.length<2) return null;
  return vals.reduce((a,b)=>a+b,0)/vals.length;
}

// Série chronologique des séances qui ont un indice. Les séances sans metrics
// en sont ABSENTES, jamais comptées comme des zéros.
function _serieForme(user){
  const out=[];
  for(const s of ((user&&user.sessions)||[])){
    const v=formeSeance(s);
    if(v!=null) out.push({date:s.date,v,metrics:s.metrics,id:s.id});
  }
  return out;
}
function _fenetreForme(user,exclureId){
  let t=_serieForme(user);
  if(exclureId!=null) t=t.filter(x=>x.id!==exclureId);
  return t.slice(-FORME_FENETRE);
}
function _moyenne(t){ return t.length?t.reduce((a,b)=>a+b,0)/t.length:null; }

function baseForme(user,exclureId){
  const t=_fenetreForme(user,exclureId);
  if(t.length<FORME_MIN_SEANCES) return null;
  return _moyenne(t.map(x=>x.v));
}
function ecartForme(user,exclureId){
  const t=_fenetreForme(user,exclureId);
  if(t.length<FORME_MIN_SEANCES) return null;
  const d=t.map(x=>x.v), mu=_moyenne(d);
  const va=d.reduce((a,b)=>a+(b-mu)*(b-mu),0)/d.length;
  return Math.max(FORME_ECART_PLANCHER,Math.sqrt(va));
}
// Curseurs jamais bougés : ils partent à 5 et y sont remis après chaque séance,
// donc un athlète qui valide sans y toucher produit toujours la même note.
// L'indice n'a alors rien à mesurer.
function formeFigee(user){
  const t=_fenetreForme(user);
  if(t.length<FORME_MIN_SEANCES) return false;
  return t.every(x=>Math.abs(x.v-t[0].v)<1e-9);
}
// La base est-elle vieille ? On la garde, mais on le dit.
function baseFormeDatee(user){
  const t=_fenetreForme(user);
  if(t.length<FORME_MIN_SEANCES) return false;
  return (Date.now()-t[t.length-1].date)>FORME_JOURS_VIEILLE*86400000;
}

// z d'une séance contre la base personnelle. La séance jugée est EXCLUE de sa
// propre base : « ta normale » est ce que tu fais d'habitude, pas ce que tu
// viens de faire.
function zForme(sess,user){
  if(formeFigee(user)) return null;
  const v=formeSeance(sess);
  if(v==null) return null;
  const b=baseForme(user,sess&&sess.id), e=ecartForme(user,sess&&sess.id);
  if(b==null||!e) return null;
  return (v-b)/e;
}
function etatForme(z){
  if(z==null) return null;
  if(z<=FORME_Z_CREUX) return 'creux';
  if(z<=FORME_Z_BAS)   return 'bas';
  if(z>=FORME_Z_HAUT)  return 'haut';
  return 'normal';
}
// ══════════ ÉNERGIE HORS SÉANCES : À CÔTÉ DE L'INDICE, JAMAIS DEDANS ══════════
// Le sujet — l'énergie générale d'un athlète, sa fatigue chronique — est un
// terrain de dérive commerciale majeur. RepCore le COLLECTE et le RESTITUE ;
// il ne l'INTERPRÈTE pas. Aucune phrase du type « ton énergie basse suggère »,
// aucun renvoi vers un bilan hormonal, aucune corrélation affichée.
//
// L'item n'est PAS ajouté à FORME_ITEMS, et c'est un choix, pas un oubli :
// l'indice est un z-score contre une base personnelle construite sur les dix
// dernières séances. Ajouter un quatrième item déplacerait cette base pour
// tout le monde, et rendrait l'historique de chacun non comparable à
// lui-même — un « creux » d'avant le lot et un « creux » d'après ne
// voudraient plus dire la même chose. Même raison que pour l'hydratation :
// restituer une donnée et la faire peser sur un score sont deux choses
// différentes. Le jour où une décision produit voudra l'y faire entrer, ce
// sera une décision assumée, avec sa rupture d'historique.
//
// Le modèle statistique, lui, est le MÊME que zForme : base personnelle,
// séance jugée exclue de sa propre base, même plancher d'écart-type, même
// minimum de séances. Deux indicateurs côte à côte se lisent d'autant mieux
// qu'ils se calculent pareil.
//
// Une séance sans energie est EXCLUE, jamais comptée 0 : compter zéro
// transformerait un curseur non renseigné en déclaration d'épuisement.
function _serieEnergie(user){
  const out=[];
  for(const s of ((user&&user.sessions)||[])){
    const v=_valForme(s&&s.metrics&&s.metrics.energie);
    if(v!=null) out.push({date:s.date,v,id:s.id});
  }
  return out;
}
function _fenetreEnergie(user,nSeances,exclureId){
  let t=_serieEnergie(user);
  if(exclureId!=null) t=t.filter(x=>x.id!==exclureId);
  const n=(nSeances>0)?nSeances:FORME_FENETRE;
  return t.slice(-n);
}
// PURE. Rend {moyenne, nSeances} ou null. Même seuil que l'indice : en
// dessous, « ta normale » n'existe pas encore.
function energieMoyenne(user,nSeances){
  const t=_fenetreEnergie(user,nSeances);
  if(t.length<FORME_MIN_SEANCES) return null;
  const m=_moyenne(t.map(x=>x.v));
  return {moyenne:Math.round(m*10)/10,nSeances:t.length};
}
// PURE. z de la séance contre sa base personnelle, elle-même exclue.
function energieZ(sess,user){
  const v=_valForme(sess&&sess.metrics&&sess.metrics.energie);
  if(v==null) return null;
  const t=_fenetreEnergie(user,FORME_FENETRE,sess&&sess.id);
  if(t.length<FORME_MIN_SEANCES) return null;
  const d=t.map(x=>x.v), mu=_moyenne(d);
  const va=d.reduce((a,b)=>a+(b-mu)*(b-mu),0)/d.length;
  const ec=Math.max(FORME_ECART_PLANCHER,Math.sqrt(va));
  return (v-mu)/ec;
}
// Libellé court, pour une étiquette ou une liste.
const FORME_ETAT_LIB={creux:'creux marqué',bas:'en dessous de ta normale',
                      normal:'dans ta normale',haut:'très bonne forme'};
// Phrase complète, qui se met derrière « Tu es ». Séparée du libellé court :
// « Tu es creux marqué » et « Tu es très bonne forme » ne se disent pas.
const FORME_ETAT_PHRASE={creux:'dans un creux marqué',bas:'en dessous de ta normale',
                         normal:'dans ta normale',haut:'en très bonne forme'};

function formeMoy3(user){
  const t=_serieForme(user);
  if(!t.length) return null;
  return _moyenne(t.slice(-3).map(x=>x.v));
}
// Nombre de séances consécutives, en partant de la fin, sous le seuil bas.
function serieBasseForme(user){
  const t=_serieForme(user);
  if(formeFigee(user)) return 0;
  let n=0;
  for(let i=t.length-1;i>=0;i--){
    const b=baseForme(user,t[i].id), e=ecartForme(user,t[i].id);
    if(b==null||!e) break;
    if((t[i].v-b)/e<=FORME_Z_BAS) n++; else break;
  }
  return n;
}
// Quelle composante décroche le plus : la fatigue et la motivation n'appellent
// pas la même réponse, et c'est au coach d'en décider.
function composanteFaible(user){
  const t=_serieForme(user);
  if(t.length<FORME_MIN_SEANCES) return null;
  const fen=t.slice(-FORME_FENETRE), rec=t.slice(-3);
  let pire=null;
  for(const it of FORME_ITEMS){
    const base=_moyenne(fen.map(x=>_contribForme(x.metrics,it)).filter(v=>v!=null));
    const cur =_moyenne(rec.map(x=>_contribForme(x.metrics,it)).filter(v=>v!=null));
    if(base==null||cur==null) continue;
    const d=cur-base;
    if(!pire||d<pire.delta) pire={cle:it.cle,lib:it.lib,delta:d};
  }
  return pire;
}

// ── Retour immédiat sur l'écran de fin de séance ────────────────────────────
// Rendu à chaque mouvement de curseur, AVANT la validation : l'athlète voit
// tout de suite ce que sa saisie donne, sinon il ne saurait pas à quoi elle sert.
// Une phrase, pas un graphique.
function _seanceEnCoursForme(){
  // On lit les curseurs à l'écran plutôt que la séance enregistrée : elle n'a
  // pas encore ses metrics au moment où l'athlète bouge les curseurs.
  const lu=(id)=>{const e=document.getElementById('ps-'+id);return e?e.value:null;};
  return {id:'__encours__',date:Date.now(),
          metrics:{fatigue:lu('fatigue'),motivation:lu('motivation'),sensation:lu('sensation')}};
}
function renderFormeSeance(){
  const z=document.getElementById('wd-forme');
  if(!z||!currentUser) return;
  const sess=_seanceEnCoursForme();
  const v=formeSeance(sess);
  if(v==null){ z.innerHTML=''; return; }

  const cadre=(couleur,titre,detail)=>`<div style="background:var(--surface-1);border:1px solid var(--border);border-left:3px solid ${couleur};border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">
      <div style="font-size:var(--fs-sm);font-weight:800;color:${couleur};margin-bottom:${detail?'3px':'0'}">${titre}</div>
      ${detail?`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">${detail}</div>`:''}
    </div>`;

  // Curseurs jamais bougés : l'indice ne mesure rien, on le dit franchement.
  if(formeFigee(currentUser)){
    z.innerHTML=cadre('var(--orange)','Tu mets toujours la même note',
      'Ces curseurs ne servent à rien tant que tu ne les bouges pas.');
    return;
  }
  const base=baseForme(currentUser);
  // Sous le seuil d'échantillon : la tendance brute, aucun jugement.
  if(base==null){
    const n=_serieForme(currentUser).length;
    z.innerHTML=cadre('var(--sub)','Forme déclarée : '+_fmtForme(v)+'/10',
      'Encore '+(FORME_MIN_SEANCES-n)+' séance'+((FORME_MIN_SEANCES-n)>1?'s':'')
      +' avant de pouvoir te comparer à ta normale.');
    return;
  }
  const e=ecartForme(currentUser);
  const etat=etatForme((v-base)/e);
  const coul={creux:'var(--red)',bas:'var(--orange)',normal:'var(--sub)',haut:'var(--success)'}[etat];
  const suite=serieBasseForme(currentUser);
  let detail='';
  // Une série basse mérite d'être nommée. On décrit et on renvoie au coach :
  // aucun conseil de sommeil, d'alimentation ni de moral n'est généré à partir
  // de trois curseurs.
  if((etat==='bas'||etat==='creux')&&suite>=2){
    const c=composanteFaible(currentUser);
    detail=(suite+1)+'ᵉ séance de suite en dessous de ta normale'
      +(c&&c.delta<-0.5?', la '+c.lib+' surtout':'')+'. Parles-en à ton coach.';
  } else if(etat==='haut'){
    detail='Ta meilleure forme déclarée depuis un moment.';
  } else if(etat==='creux'||etat==='bas'){
    detail='Ça arrive. Si ça se répète, parles-en à ton coach.';
  }
  if(baseFormeDatee(currentUser))
    detail+=(detail?' ':'')+'Ta base date de plus de deux mois.';
  z.innerHTML=cadre(coul,'Tu es '+FORME_ETAT_PHRASE[etat]+'.',detail);
}
function _fmtForme(v){
  const x=Math.round(v*10)/10;
  return Number.isInteger(x)?String(x):String(x).replace('.',',');
}
// Repli des trois curseurs secondaires. Ils ne sont écrits que si l'athlète a
// ouvert le détail : un 5 laissé par défaut ressemblerait à une réponse.
let _psDetailOuvert=false;
function togglePsDetail(){
  _psDetailOuvert=!_psDetailOuvert;
  // Les trois curseurs secondaires sont marqués par une classe : les replier
  // sans toucher à la grille evite de reordonner tout le bloc.
  document.querySelectorAll('.ps-detail-item').forEach(e=>{
    e.style.display=_psDetailOuvert?'block':'none';});
  const b=document.getElementById('ps-detail-btn');
  // « Plus de détails » est le libelle demande. Replie, il dit l'inverse : un
  // bouton qui garde le meme texte dans les deux sens ne dit pas ce qu'il fait.
  if(b) b.textContent=_psDetailOuvert?'Moins de détails':'Plus de détails';
}

// ── Courbe de forme déclarée ────────────────────────────────────────────────
// ⚠ LA MISE EN PAGE EST CELLE DE LA MAQUETTE DE KEVIN (21/09/2026), capture a
//   l'appui : « remplace les infos, mise en page exactement comme le 2 ». Une
//   courbe « Forme globale » sur les dix dernieres seances, la moyenne en
//   tirets, la zone normale en bande, l'etat actuel a droite avec son ecart a
//   la seance precedente, puis trois cartes — fatigue, motivation, sensations —
//   chacune avec son icone, sa note sur 10 et une barre en huit segments.
//
// ⚠ ECHELLE FIXE DE 0 A 10, et non plus cadree sur ce qui est trace : la
//   maquette gradue l'axe 0-2-4-6-8-10, et a cette hauteur (170 px) une bande
//   de deux points reste lisible — l'ancienne courbe ne faisait que 44 px, et
//   c'est ce qui l'obligeait a zoomer.
//
// ⚠ « ZONE NORMALE », PAS « ZONE OPTIMALE ». La bande est la moyenne de
//   l'athlete plus ou moins son ecart-type : ce qui est habituel CHEZ LUI, pas
//   un optimum. L'appeler optimale lui preterait une valeur que rien ne mesure
//   — le reste de l'application dit deja « normale », et c'est le seul mot vrai.
const FORME_DERNIERES=10;
// Les icones pleines des trois cartes. Pleines et non au trait, comme la
// maquette : elles sont le premier repere de la carte.
const FORME_ICONES={
  fatigue:'<path d="M13.2 2 4.5 13.4h6.2l-1 8.6 8.8-11.6h-6.3z" fill="currentColor"/>',
  motivation:'<path d="M9.3 3.4a3 3 0 0 0-3 2.5 3.2 3.2 0 0 0-2.5 3.2c0 .8.3 1.5.7 2.1a3.3 3.3 0 0 0-.7 2.1 3.3 3.3 0 0 0 2.4 3.2 3 3 0 0 0 3.1 3.9c.9 0 1.7-.4 2.2-1V4.5a3 3 0 0 0-2.2-1.1zm5.4 0a3 3 0 0 1 3 2.5 3.2 3.2 0 0 1 2.5 3.2c0 .8-.3 1.5-.7 2.1.4.6.7 1.3.7 2.1a3.3 3.3 0 0 1-2.4 3.2 3 3 0 0 1-3.1 3.9c-.9 0-1.7-.4-2.2-1V4.5a3 3 0 0 1 2.2-1.1z" fill="currentColor"/>'
    +'<path d="M8.2 8.6c.9 0 1.6.6 1.9 1.4M6.7 13.4c.8-.5 1.9-.5 2.7.1M15.8 8.6c-.9 0-1.6.6-1.9 1.4M17.3 13.4c-.8-.5-1.9-.5-2.7.1M9 17c.5-.6 1.2-.9 2-.9M15 17c-.5-.6-1.2-.9-2-.9" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.1" stroke-linecap="round"/>',
  sensation:'<path d="M12 20.6s-7.4-4.5-9.4-9C1.2 8.4 3 5 6.4 5c2 0 3.5 1.1 4.3 2.4.6.9 1.9.9 2.6 0C14.1 6.1 15.6 5 17.6 5 21 5 22.8 8.4 21.4 11.6c-2 4.5-9.4 9-9.4 9z" fill="currentColor"/>'
};
// Ce que chaque carte explique en une ligne. L'athlete lit a la deuxieme
// personne, le coach a la troisieme : « Ton envie » sur la fiche d'un autre ne
// parlerait a personne.
const FORME_CARTES=Object.freeze({
  fatigue:   {titre:'Fatigue',   athlete:'Plus la valeur est basse, mieux c’est.', coach:'Plus la valeur est basse, mieux c’est.'},
  motivation:{titre:'Motivation',athlete:'Ton envie et ton engagement.',            coach:'Son envie et son engagement.'},
  sensation: {titre:'Sensations',athlete:'Comment tu te sens globalement.',         coach:'Comment l’athlète se sent globalement.'}
});
// Huit segments, comme la maquette : 3/10 en allume deux, 9/10 sept.
const FORME_SEGMENTS=8;
function _formeSegmentsAllumes(v){
  const x=Number(v);
  if(!isFinite(x)) return 0;
  return Math.max(0,Math.min(FORME_SEGMENTS,Math.round(x*FORME_SEGMENTS/FORME_MAX)));
}
// PURE. La couleur d'une note, jugee contre la PROPRE moyenne de l'athlete et
// dans le bon sens : une fatigue qui BAISSE est une bonne nouvelle. C'est la
// regle de l'indice de forme — declaratif, compare a soi — et non un seuil
// absolu : un 6 de motivation est bas chez l'un, haut chez l'autre.
//
// ⚠ L'ANCIENNE LIGNE AFFICHAIT LA FATIGUE INVERSEE. « Fatigue 3 » y voulait
//   dire une fatigue declaree de 7 — la contribution a l'indice, pas la note
//   saisie — et s'ecrivait en orange. Sous « plus la valeur est basse, mieux
//   c'est », il fallait la VRAIE note : 7, en orange.
function _formeTeinte(ecartQualite){
  if(!(isFinite(ecartQualite))) return 'var(--text)';
  if(ecartQualite>=1) return 'var(--success)';
  if(ecartQualite<=-1) return 'var(--orange)';
  return 'var(--text)';
}
/**
 * La courbe « Forme globale » : axe 0-10, zone normale, moyenne en tirets,
 * une pastille par seance, la derniere cerclee de blanc.
 *
 * ⚠ LES PASTILLES SONT DES DIV, PAS DES <circle>. La courbe est tracee en
 *   preserveAspectRatio="none" pour occuper toute la largeur : un cercle SVG y
 *   deviendrait une ellipse. Meme choix que le schema corporel.
 * ⚠ PAS DE <rect> SANS MOYENNE : sous six seances, aucune zone n'est dessinee
 *   — une bande sans base serait un jugement sans reference.
 */
function _formeCourbe(pts,base,ecart,pourCoach){
  if(!pts||pts.length<2) return '';
  const n=pts.length;
  const X=i=>n===1?50:(i/(n-1))*100;
  const Y=v=>100-(Math.max(0,Math.min(FORME_MAX,v))/FORME_MAX)*100;
  const d=pts.map((p,i)=>(i?'L':'M')+X(i).toFixed(2)+' '+Y(p).toFixed(2)).join(' ');
  let fond='';
  for(let i=0;i<n;i++)
    fond+='<line x1="'+X(i).toFixed(2)+'" y1="0" x2="'+X(i).toFixed(2)+'" y2="100" class="fm-grille" vector-effect="non-scaling-stroke"/>';
  for(let g=0;g<=FORME_MAX;g+=2)
    fond+='<line x1="0" y1="'+Y(g).toFixed(2)+'" x2="100" y2="'+Y(g).toFixed(2)+'" class="fm-grille fm-grille-h" vector-effect="non-scaling-stroke"/>';
  let zone='';
  if(base!=null&&ecart){
    const h=Y(Math.min(FORME_MAX,base+ecart)), b=Y(Math.max(0,base-ecart));
    zone='<rect x="0" y="'+h.toFixed(2)+'" width="100" height="'+(b-h).toFixed(2)+'" class="fm-zone"/>'
      +'<line x1="0" y1="'+Y(base).toFixed(2)+'" x2="100" y2="'+Y(base).toFixed(2)+'" class="fm-moy" vector-effect="non-scaling-stroke"/>';
  }
  const pastilles=pts.map((p,i)=>'<span class="fm-pt'+(i===n-1?' fm-pt-der':'')+'" style="left:'
    +X(i).toFixed(2)+'%;top:'+Y(p).toFixed(2)+'%" title="S'+(i+1)+' : '+_fmtForme(p)+' / 10"></span>').join('');
  const axeY=[10,8,6,4,2,0].map(g=>'<span style="top:'+Y(g).toFixed(2)+'%">'+g+'</span>').join('');
  const axeX=pts.map((p,i)=>'<span style="left:'+X(i).toFixed(2)+'%">S'+(i+1)+'</span>').join('');
  const dit='Forme globale sur '+n+' séances : '+_fmtForme(pts[0])+' puis '+_fmtForme(pts[n-1])+' sur 10'
    +(base!=null?', moyenne '+_fmtForme(base)+' sur 10':'')+'.';
  return '<div class="fm-graphe" role="img" aria-label="'+escapeHtml(dit)+'">'
    +'<div class="fm-axe-y" aria-hidden="true">'+axeY+'</div>'
    +'<div class="fm-trace">'
      +'<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'
      +fond+zone
      +'<path d="'+d+'" class="fm-ligne" vector-effect="non-scaling-stroke"/></svg>'
      +pastilles
      +'<div class="fm-axe-x" aria-hidden="true">'+axeX+'</div>'
    +'</div></div>';
}
// Les trois cartes : la note de la derniere seance, sur 10, dans la couleur
// de son ecart a la moyenne de l'athlete, et sa barre en huit segments.
function _formeComposantes(user,pourCoach){
  const t=_serieForme(user).slice(-FORME_DERNIERES);
  if(t.length<2) return '';
  return '<div class="fm-cartes">'
    +FORME_ITEMS.map(it=>{
      const brut=t.map(x=>_valForme(x.metrics&&x.metrics[it.cle])).filter(z=>z!=null);
      const qual=t.map(x=>_contribForme(x.metrics,it)).filter(z=>z!=null);
      if(brut.length<2||qual.length<2) return '';
      const der=brut[brut.length-1];
      const ecartQ=qual[qual.length-1]-_moyenne(qual);
      const coul=_formeTeinte(ecartQ);
      const on=_formeSegmentsAllumes(der);
      const c=FORME_CARTES[it.cle]||{titre:it.lib,athlete:'',coach:''};
      const moy=_moyenne(brut);
      const barre=Array.from({length:FORME_SEGMENTS},(_,i)=>'<i'+(i<on?' class="on"':'')+'></i>').join('');
      // Dans sa normale, la note reste blanche et sa barre d'un blanc voile.
      return '<div class="fm-carte" style="--fm-c:'+coul
        +(coul==='var(--text)'?';--fm-b:rgba(255,255,255,.55)':'')+'"'
        +' title="'+escapeHtml(c.titre+' : '+_fmtForme(der)+' / 10 : moyenne '+_fmtForme(moy)+' / 10')+'">'
        +'<span class="fm-ico fm-ico-'+it.cle+'" aria-hidden="true"><svg viewBox="0 0 24 24">'+(FORME_ICONES[it.cle]||'')+'</svg></span>'
        +'<div class="fm-carte-txt"><div class="fm-carte-t">'+escapeHtml(c.titre)+'</div>'
        +'<div class="fm-carte-s">'+escapeHtml(pourCoach?c.coach:c.athlete)+'</div></div>'
        +'<div class="fm-carte-v"><b>'+_fmtForme(der)+'</b><span> / 10</span></div>'
        +'<div class="fm-barre" aria-hidden="true">'+barre+'</div>'
        +'</div>';}).join('')
    +'</div>';
}
// Bloc complet, partagé par l'onglet Perfs et la fiche coach.
// À CÔTÉ de blocForme, jamais dedans : deux encadrés distincts, deux titres
// distincts. Fondre les deux laisserait croire que l'énergie pèse sur
// l'indice — c'est précisément ce que le lot refuse.
//
// On DÉCRIT : une moyenne, un état, et le rappel que c'est déclaratif.
// Aucune interprétation, aucune cause suggérée, aucun renvoi.
function phraseEnergie(e){
  if(!e) return '';
  return 'Énergie hors séances : '+String(e.moyenne).replace('.',',')+' / '+FORME_MAX
    +' en moyenne sur '+e.nSeances+' séance'+(e.nSeances>1?'s':'')+'.';
}
function blocEnergie(user,pourCoach){
  const e=energieMoyenne(user);
  if(!e) return '';
  // LA MEME GRAMMAIRE QUE LE CADRE DE FORME — titre condense, valeur a
  // droite —, mais un cadre A PART : l'energie n'entre pas dans l'indice.
  //
  // ⚠ NI PHRASE D'ETAT, NI RAPPEL EN PIED — Kevin, 21/09/2026 : « supprime
  //   aussi pour l'energie », apres l'avoir fait pour la forme. Le rappel
  //   « declaratif, n'entre pas dans l'indice » passe dans l'infobulle du
  //   sous-titre : il doit rester dit quelque part, c'est lui qui empeche de
  //   lire l'energie comme une composante de la forme.
  return `<div class="fm fm-energie"><div class="fm-cadre">
    <div class="fm-tete">
      <div class="fm-titres"><div class="fm-titre">Énergie hors séances</div>
        <div class="fm-sous" title="Déclaratif, comparé à ${pourCoach?'sa':'ta'} propre moyenne. N'entre pas dans l'indice de forme.">${escapeHtml(phraseEnergie(e))}</div></div>
      <div class="fm-etat"><div class="fm-etat-l">Normale</div>
        <div class="fm-etat-v"><b>${_fmtForme(e.moyenne)}</b><span> / 10</span></div></div>
    </div>
  </div></div>`;
}
function blocForme(user,pourCoach){
  const t=_serieForme(user);
  if(t.length<2) return '';
  const pts=t.slice(-FORME_DERNIERES).map(x=>x.v);
  const base=baseForme(user), ecart=ecartForme(user);
  const fige=formeFigee(user);
  let phrase='';
  if(fige){
    phrase='Notes identiques d\'une séance à l\'autre : ces curseurs ne disent rien tant qu\'ils ne bougent pas.';
  } else if(base==null){
    phrase='Encore '+(FORME_MIN_SEANCES-t.length)+' séance'+((FORME_MIN_SEANCES-t.length)>1?'s':'')
      +' avant de pouvoir comparer à une normale.';
  } else {
    const suite=serieBasseForme(user);
    const c=composanteFaible(user);
    if(suite>=3) phrase='Forme déclarée en baisse depuis '+suite+' séances'
      +(c&&c.delta<-0.5?' ('+c.lib+' surtout)':'')+'.';
    // ⚠ L'ETAT ORDINAIRE NE S'ECRIT PLUS — Kevin, 21/09/2026, capture a
    //   l'appui : « supprime ca, pas besoin ». « Derniere seance tres bonne
    //   forme » redisait ce que l'etat actuel, sa fleche et la courbe montrent
    //   deja. Restent les cas que rien d'autre a l'ecran ne dit : des notes
    //   figees, pas encore de normale, une serie en baisse, une base datee.
    if(baseFormeDatee(user)) phrase+=(phrase?' ':'')+'Base de plus de deux mois.';
  }
  // L'ATHLETE LIT « ta forme », LE COACH « sa forme » : la maquette parle a
  // l'athlete, et la fiche coach ne tutoie pas.
  const qui=pourCoach?'sa':'ta';
  const n=pts.length;
  // L'ETAT ACTUEL : la derniere seance, et son ecart a la precedente. Une
  // fleche et un signe, dans la couleur du sens — l'indice monte quand la
  // forme declaree s'ameliore, fatigue comprise.
  const der=pts[n-1], prec=n>1?pts[n-2]:null;
  const dv=prec==null?null:Math.round((der-prec)*10)/10;
  const etat='<div class="fm-etat"><div class="fm-etat-l">État actuel</div>'
    +'<div class="fm-etat-v"><b>'+_fmtForme(der)+'</b><span> / 10</span></div>'
    +(dv==null?'':'<div class="fm-etat-d" style="color:'
      +(dv>0?'var(--success)':dv<0?'var(--orange)':'var(--sub)')+'">'
      +(dv>0?'↗ +':dv<0?'↘ −':'→ ')+_fmtForme(Math.abs(dv))+'</div>'
      +'<div class="fm-etat-l">vs. la séance précédente</div>')
    +'</div>';
  const legende=fige?'':'<div class="fm-leg">'
    +'<span><i class="fm-leg-pt"></i>Forme globale</span>'
    +(base!=null
      ?'<span title="Moyenne '+_fmtForme(base)+' / 10"><i class="fm-leg-moy"></i>Moyenne</span>'
        +'<span title="Moyenne ± un écart-type : ce qui est habituel chez '+(pourCoach?'l’athlète':'toi')+'">'
        +'<i class="fm-leg-zone"></i>Zone normale</span>'
      :'')
    +'</div>';
  const tete='<div class="fm-tete"><div class="fm-titres">'
    +'<div class="fm-titre">Évolution de '+qui+' forme</div>'
    // Le rappel « declaratif » quitte le pied du cadre (meme demande) et passe
    // dans l'infobulle du sous-titre : il reste lisible pour qui le cherche.
    +'<div class="fm-sous" title="Déclaratif, comparé à '+qui+' propre moyenne. Ce n\'est pas une mesure.">'
    +'Une vision globale de '+qui+' forme sur les '+n+' dernières séances.</div>'
    +'</div>'+legende+etat+'</div>';
  // NOTES FIGEES : ni courbe ni cartes — une courbe plate et trois barres
  // identiques auraient l'air de dire quelque chose. La phrase le dit.
  return '<div class="fm">'
    +'<div class="fm-cadre">'+tete+(fige?'':_formeCourbe(pts,base,ecart,pourCoach))+'</div>'
    +(fige?'':_formeComposantes(user,pourCoach))
    +(phrase?'<div class="fm-pied">'+escapeHtml(phrase)+'</div>':'')
    +'</div>';
}
function renderFormeCoach(c){
  const z=document.getElementById('ccd-forme');
  if(!z) return;
  let html='';
  try{ html=c?blocForme(c,true):''; }catch(e){ html=''; }
  // Second indicateur, jamais fondu dans le premier.
  try{ html+=c?blocEnergie(c,true):''; }catch(e){}
  try{ html+=c?_htmlSatisfaction(c):''; }catch(e){}
  z.innerHTML=html;
}

function savePostSession(versBilan){
  const _lu=(id)=>{const e=document.getElementById('ps-'+id);return e?e.value:undefined;};
  const metrics={
    fatigue:_lu('fatigue'),
    sensation:_lu('sensation'),
    motivation:_lu('motivation'),
    // Premier rang, comme les trois items de l'indice : il est TOUJOURS
    // écrit. Ce qui le distingue d'eux n'est pas la collecte, c'est qu'il
    // n'entre dans aucun score.
    energie:_lu('energie'),
    steps:_lu('steps')
  };
  // Les trois curseurs secondaires ne sont écrits que si l'athlète a ouvert le
  // détail. Enregistrer le 5 posé par défaut ressemblerait à une réponse alors
  // que personne n'a rien répondu. Quand ils sont renseignés, ils partent au
  // même format qu'avant : rien à migrer, rien à relire autrement.
  if(_psDetailOuvert){
    metrics.satisfaction=_lu('satisfaction');
    metrics.hydratation=_lu('hydratation');
  }
  // Le mot pour le coach : borné ici ET dans les règles (PUT du dossier entier).
  const _note=String(_lu('note')||'').trim().slice(0,NOTE_SEANCE_MAX);
  // Attacher les métriques à la dernière séance
  if(currentUser.sessions?.length){
    const _der=currentUser.sessions[currentUser.sessions.length-1];
    if(_note) _der.noteAthlete=_note; else delete _der.noteAthlete;
    currentUser.sessions[currentUser.sessions.length-1].metrics=metrics;
    if(metrics.steps) currentUser.sessions[currentUser.sessions.length-1].steps=parseInt(metrics.steps);
  }
  // …et reverser les pas dans le MÊME journal que l'écran Lifestyle. Sans ça,
  // le chiffre restait accroché à la séance : l'athlète le saisissait, et ni la
  // barre du jour ni la moyenne de la semaine n'en tenaient compte.
  // Le garde >0 est volontairement plus strict que celui de _recordSteps : un
  // champ laissé vide, ou à 0, ne doit pas écraser une saisie Lifestyle déjà
  // faite le même jour. Placé AVANT saveUser(), pour que les deux écritures
  // partent dans la même persistance.
  const _pas=parseInt(metrics.steps,10);
  if(!isNaN(_pas)&&_pas>0&&_pas<=99999) _recordSteps(localISODate(new Date()),_pas);
  toastEcriture(saveUser(),' Super séance enregistrée !','la séance est');
  if(versBilan){openBilan('depart');return;}
  go('s-client-home');loadClientHome();
}
// ── Assiduité : le streak compte des SEMAINES, pas des jours consécutifs ────
// L'ancienne version n'incrémentait que si l'écart valait exactement 1 jour.
// Un programme Lundi/Mercredi/Vendredi laisse toujours 2 jours d'écart : un
// athlète parfaitement assidu voyait donc son compteur retomber à 1 à chaque
// séance. Une semaine est acquise quand le nombre de séances prévues au
// programme a été réalisé ; elle n'est perdue qu'après une absence dépassant
// d'une semaine pleine le rythme normal de l'athlète (voir _streakPerime).
// _lundiDe(d) : la MEME fonction est definie plus haut (« Le lundi de la semaine
// contenant t »). Cette seconde copie, identique, l'ecrasait : retiree le
// 01/10/2026 (lint, no-redeclare).
// Nombre de séances actives au programme — le quota hebdomadaire à atteindre.
// PURE. Le nombre de creneaux actifs du programme, TEL QUEL — zero compris.
// ⚠ ZERO EST UNE INFORMATION ICI, et c'est pourquoi cette fonction existe a
// cote de seancesPrevuesParSemaine plutot que dedans : celle-ci porte un
// Math.max(1,…) parce que ecartNormalJours DIVISE par elle, si bien qu'elle
// ne peut jamais rendre 0. Un sous-titre qui lirait ce plancher afficherait
// « / 1 prevue » a quelqu'un qui n'a aucun creneau — un chiffre invente.
function _creneauxPrevus(u){
  return ((u&&u.sessions_config)||[]).filter(s=>s&&s.active).length;
}
function seancesPrevuesParSemaine(u){
  return Math.max(1,_creneauxPrevus(u));
}
// Écart normal entre deux séances, en jours, plus un jour de marge. Avec 3
// séances par semaine l'intervalle vaut 3 jours, donc 4 avec la marge. Même
// notion que la relance « X jours sans séance » de loadClientHome, qui la
// recalculait de son côté : une seule définition désormais.
function ecartNormalJours(u){
  return Math.ceil(7/seancesPrevuesParSemaine(u))+1;
}
// Un streak est périmé quand l'absence dépasse d'une SEMAINE PLEINE le rythme
// normal de l'athlète. Le seuil dépend donc de la durée réelle d'absence et du
// rythme, et de rien d'autre.
//
// L'ancienne règle comparait le lundi de la semaine de la dernière séance à
// celui de la semaine courante, et périmait à partir de deux semaines d'écart.
// Mesuré : pour un même athlète à 3 séances/semaine, le compteur tombait à
// partir de 8 jours d'absence si la dernière séance était un lundi, mais
// seulement à partir de 14 si c'était un dimanche — un escalier de 8 à 14 jours
// selon le jour de la semaine. Pire, la règle s'inversait : 8 jours d'absence
// remettaient à zéro, 13 jours conservaient le compteur intact.
//
// La calibration sur le rythme est nécessaire : un athlète qui s'entraîne une
// fois par semaine ne doit pas être jugé comme celui qui s'entraîne cinq fois.
function _streakPerime(u,now){
  if(!u||!u.lastSession) return false;
  // UNE SUSPENSION N'EST PAS UNE ABSENCE. Sans cette ligne, un athlète sous
  // drapeau rouge pendant trois semaines verrait son compteur tomber à zéro
  // avant même la levée, et le gel n'aurait servi à rien. Le décompte reprend
  // à la LEVÉE, pas à la dernière séance.
  let depart=u.lastSession;
  try{ depart=Math.max(depart,_suspFinDerniere(u)); }catch(e){}
  // UN JOKER NON PLUS : la série sauvée repart de la date du joker.
  depart=Math.max(depart,Number(u.streakJokerLe)||0);
  const jours=Math.floor((now-depart)/864e5);
  return jours>ecartNormalJours(u)+7;
}
// Valeur à AFFICHER. Le compteur stocké ne bouge qu'à la fin d'une séance ;
// sans ce calcul, un athlète à l'arrêt depuis un mois verrait encore son
// ancien score en ouvrant l'app.
// PURE. CE QUE LE CADRE AFFICHE, et rien de plus.
//
// ⚠ ELLE NE CALCULE AUCUNE SERIE. streakSemaines, _streakPerime et
// ecartNormalJours decident, comme avant et sans une ligne de changement ;
// celle-ci recoit leur verdict et choisit des mots. Un compteur de serie a zero
// ne motive pas — il n'y a rien a perdre, donc aucune tension — et c'est le
// RENDU de ce cas-la, et lui seul, qui change.
//
// LE COMPTEUR N'ANNONCE JAMAIS UNE SEMAINE QU'IL N'A PAS ACQUISE : dans l'etat
// nul, `valeur` est null et le grand chiffre disparait de la mise en page.
// « SEMAINE 1 » nomme la semaine EN COURS, celle qui se joue, et la ligne du
// dessous dit ce qu'il faut pour l'acquerir — les deux se lisent ensemble et
// aucune des deux ne se lit comme un acquis.
//
// `reste` vaut au moins 1 tant que la semaine n'est pas validee : quelqu'un qui
// a deja fait ses trois seances mais dont la semaine n'est pas close ne lit pas
// « 0 seance pour la valider », qui serait faux et incomprehensible.
function affichageStreak(streak,prevues,faites){
  const s=Math.max(0,Math.round(Number(streak)||0));
  // « SEMAINES » EN ENTIER. « SEM. » economisait six caracteres et coutait
  // une abreviation a lire ; le cadre a la place de les ecrire.
  if(s>0) return {valeur:s,libelle:'SEMAINES',reste:'',nul:false};
  const p=Math.max(1,Math.round(Number(prevues)||1));
  const f=Math.max(0,Math.round(Number(faites)||0));
  const r=Math.max(1,p-f);
  // « Encore 3 seances » ET NON « 3 seances pour la valider » : la seconde
  // demande trois lignes au plancher de 11 px et porte le cadre a 146x66, la
  // premiere en demande deux et le laisse a 136x52. Le sens est le meme — ce
  // qu'il RESTE a faire — et « SEMAINE 1 » juste au-dessus dit deja ce qui se
  // joue. Voir la regle .sk-reste pour la mesure.
  return {valeur:null,libelle:'SEMAINE 1',
    reste:'Encore '+r+' séance'+(r>1?'s':''),nul:true};
}
// Le tour impur : poser les trois textes et basculer l'etat du cadre.
//
// ⚠ L'ANIMATION DU CHIFFRE RESTE CE QU'ELLE ETAIT quand il y a un chiffre —
// meme mecanisme que le score, meme piege evite : le jour ou ce compteur
// porterait une unite dans le meme noeud, il casserait a l'identique.
// DANS L'ETAT NUL, data-valeur est EFFACE. Sans cela, la semaine suivante
// animerait « 1 » depuis une valeur perimee — un compteur qui compte a rebours
// depuis un nombre que personne n'a jamais vu.
function _rendreStreak(u,s){
  const el=document.getElementById('clh-streak-val');
  const lbl=document.querySelector('#clh-streak .sk-lbl');
  const res=document.getElementById('clh-streak-reste');
  const zone=document.querySelector('#clh-streak .sk-chiffres');
  let a;
  try{ a=affichageStreak(s,seancesPrevuesParSemaine(u),_seancesCetteSemaine(u)); }
  catch(e){ a={valeur:null,libelle:'SEMAINE 1',reste:'',nul:true}; }
  if(lbl) lbl.textContent=a.libelle;
  if(res) res.textContent=a.reste;
  // LA DATE DU JOUR, sous le compte — elle a quitte la ligne sous « Bonjour
  // Kevin », ou elle occupait une rangee entiere pour trois mots.
  // ⚠ LE MOIS EST ABREGE, et c'est ce qui la fait tenir : « mercredi 16
  // septembre » demandait deux lignes et grandissait le cadre.
  const dt=document.getElementById('clh-streak-date');
  if(dt) dt.textContent=dateDuJourCourte();
  // R34 — le badge ouvre la fiche « assiduite » : son nom dit le compte, et
  // ce que le toucher ouvre.
  const badge=document.getElementById('clh-streak');
  if(badge) badge.setAttribute('aria-label',(a.valeur!==null
    ?a.valeur+' semaine'+(a.valeur>1?'s':'')+' d’assiduité'
    :'Semaine 1'+(a.reste?', '+a.reste.toLowerCase():''))+'. Voir ce qui est compté');
  if(zone) zone.toggleAttribute('data-nul',a.nul);
  // LES JOKERS, À CÔTÉ DU COMPTEUR : un bouclier par joker en réserve (deux
  // au plus). Rien quand il n'y en a pas — un bouclier vide ne protège rien.
  try{
    const jk=Math.max(0,Math.min(STREAK_JOKERS_MAX,Number(u&&u.streakJokers)||0));
    let zj=document.getElementById('clh-streak-jokers');
    const cadre=document.querySelector('#clh-streak .sk-cadre');
    if(!zj&&cadre){ zj=document.createElement('span'); zj.id='clh-streak-jokers'; zj.className='sk-jokers'; cadre.appendChild(zj); }
    if(zj){
      zj.innerHTML=Array.from({length:jk},()=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l7.5 3v5.6c0 4.8-3.2 8.6-7.5 10.4-4.3-1.8-7.5-5.6-7.5-10.4V5.5z"/></svg>').join('');
      zj.hidden=!jk;
      zj.title=jk?(jk+' joker'+(jk>1?'s':'')+' : '+(jk>1?'ils sauvent':'il sauve')+' ta série si une semaine t’échappe'):'';
    }
    if(badge&&jk) badge.setAttribute('aria-label',badge.getAttribute('aria-label').replace(/\. Voir/,', '+jk+' joker'+(jk>1?'s':'')+'. Voir'));
  }catch(e){}
  // Le rappel « série en danger » suit l'état affiché.
  try{ _seriePlanifierNotif(u); }catch(e){}
  if(!el) return;
  if(a.valeur===null){
    el.textContent='';
    try{ delete el.dataset.valeur; }catch(e){}
  } else arcCompteur(el,a.valeur,{duree:ARC.release});
}
// PURE. « mercredi 16 sept. » — le jour, en une ligne.
function dateDuJourCourte(maintenant){
  const d=(maintenant instanceof Date)?maintenant:new Date(
    (typeof maintenant==='number')?maintenant:Date.now());
  try{ return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short'}); }
  catch(e){ return ''; }
}
function streakSemaines(u){
  // SOUS SUSPENSION, LA VALEUR EST GELÉE — c'est le cœur de la règle 2. Elle
  // ne monte pas (updateStreak s'en charge) et elle ne tombe pas. Au-delà de
  // quatre-vingt-dix jours elle repart de zéro, et suspensionMessageReprise
  // le dit : jamais silencieusement.
  try{
    const sp=suspensionEtat(u);
    if(sp.actif) return sp.jours>SUSP_ZERO_JOURS?0:sp.streakGele;
  }catch(e){}
  const s=(u&&u.streak)||0;
  if(!s||!u.lastSession) return s;
  if(!_streakPerime(u,Date.now())) return s;
  // PÉRIMÉE, SAUF SI LES JOKERS LA SAUVENT : l'affichage dit ce que la
  // prochaine écriture fera — y compris sur la fiche du coach, avant que
  // l'athlète ait rouvert l'application.
  let b=null; try{ b=streakJokersBilan(u,Date.now()); }catch(e){ b=null; }
  return (b&&b.consommes>0)?s:0;
}





// ══════════════ RAPPORT DE PÉRIODE ════════════════════════════════════════
// GÉNÉRÉ ET IMPRIMABLE, jamais ENVOYÉ. La messagerie coach ↔ athlète n'existe
// pas dans ce produit, et ce lot n'en crée pas l'ombre d'un canal : la seule
// sortie est window.print(), c'est-à-dire l'imprimante ou le PDF du système.
//
// AUCUN CALCUL NOUVEAU. Chaque chiffre vient d'une fonction déjà écrite et
// déjà testée : serieWeight, mm7, vitesseHebdo, volumeSemaine, REPERES_VOLUME,
// e1rm, perfExercice, tauxCompletion, streakSemaines, signauxEntrainement.
// Si un chiffre manquait, il manquerait aussi dans l'application.
const RAP_MIN_SEANCES=4;          // en dessous, on le DIT — jamais un zéro
const RAP_TOP_EXOS=5;
const RAP_INSUFFISANT='Données insuffisantes sur la période.';
const RAP_BLOCS=Object.freeze([
  {cle:'entete',     lib:'En-tête'},
  {cle:'assiduite',  lib:'Assiduité'},
  {cle:'volume',     lib:'Volume par muscle'},
  {cle:'progression',lib:'Progression'},
  {cle:'tendances',  lib:'Tendances'},
  {cle:'poids',      lib:'Poids'},
  {cle:'signaux',    lib:'Signaux détectés'},
  // N6.7 — Trois blocs OPTIONNELS, coches comme les huit autres. Places avant
  // le mot du coach : il ferme le document, il reste dernier.
  {cle:'diete',      lib:'Diète'},
  {cle:'mensurations',lib:'Mensurations'},
  {cle:'photos',     lib:'Photos'},
  // Le coach imprimait un bilan de periode ou ni le sommeil ni les pas
  // n'apparaissaient. Coche comme les autres, et place avant le mot du coach :
  // celui-la ferme le document, il reste dernier.
  {cle:'lifestyle',  lib:'Sommeil et pas'},
  {cle:'mot',        lib:'Mot du coach'}
]);
// PURE. Sommeil et pas SUR LA PERIODE DU RAPPORT, et non sur une fenetre
// glissante : c'est un document date, il doit dire ce qui s'est passe entre ses
// deux bornes. Les moyennes ne comptent que les jours RENSEIGNES, et le rapport
// dit combien il y en avait — sans quoi une moyenne sur quatre jours se lirait
// comme une moyenne sur trente.
function rapLifestyle(u,debut,fin){
  const d0=new Date(debut); d0.setHours(12,0,0,0);
  const d1=new Date(fin);   d1.setHours(12,0,0,0);
  const jours=[];
  for(let d=new Date(d0); d.getTime()<=d1.getTime(); d.setDate(d.getDate()+1))
    jours.push(localISODate(new Date(d)));
  const pas=jours.map(x=>sanPas(u,x)).filter(v=>v!=null);
  const som=jours.map(x=>sanSommeilMin(u,x)).filter(v=>v!=null);
  const moy=a=>a.length?Math.round(a.reduce((t,v)=>t+v,0)/a.length):null;
  // La regularite se lit sur les nuits de la PERIODE, pas sur les quatorze
  // dernieres : le rapport ne doit rien contenir qui deborde de ses bornes.
  const nuits=((u&&u.sleepLog)||[]).filter(e=>e&&e.date>=jours[0]&&e.date<=jours[jours.length-1]);
  const reg=regulariteCoucher({sleepLog:nuits},nuits.length||1);
  const cardio=_coachCardio(u,jours[0],jours[jours.length-1]);
  return {
    jours:jours.length,
    pas:{moyenne:moy(pas),renseignes:pas.length,objectif:sanObjPas(u)},
    sommeil:{moyenne:moy(som),renseignes:som.length,objectif:sanObjSommeil(u)},
    regularite:reg,
    // Synchronisation santé : null sans mesure sur la période.
    fcRepos:cardio.fcRepos,vfc:cardio.vfc
  };
}
// PURE. Le mois calendaire PRÉCÉDENT, borne à borne.
function rapMoisPrecedent(now){
  const t=(typeof now==='number')?now:Date.now();
  const d=new Date(t);
  const fin=new Date(d.getFullYear(),d.getMonth(),1,0,0,0,0)-1;
  const deb=new Date(new Date(fin).getFullYear(),new Date(fin).getMonth(),1,0,0,0,0).getTime();
  return {debut:deb,fin:fin};
}
function rapLibellePeriode(debut,fin){
  const o={day:'2-digit',month:'2-digit',year:'numeric'};
  return new Date(debut).toLocaleDateString('fr-FR',o)+' → '+new Date(fin).toLocaleDateString('fr-FR',o);
}
// PURE. Les séances de la période. Elles sont TOUTES là : la décharge compte
// en assiduité, c'est aux tendances de l'écarter (règle 3).
function _rapSeances(u,debut,fin){
  return ((u&&u.sessions)||[]).filter(s=>s&&s.date>=debut&&s.date<=fin)
    .sort((a,b)=>a.date-b.date);
}
// PURE. Les séances qui alimentent une TENDANCE : décharges exclues, avec
// EXACTEMENT la garde de _serieExercice et _serieRecords — `if(sess.deload)
// continue;` en tête, avant tout autre filtre.
function _rapSeancesTendance(u,debut,fin){
  const out=[];
  for(const sess of _rapSeances(u,debut,fin)){
    if(sess.deload) continue;
    out.push(sess);
  }
  return out;
}
// ── Bloc 2 : assiduité ────────────────────────────────────────────────────
// Le dénominateur « prévues » est une PROJECTION du programme ACTUEL :
// sessions_config décrit aujourd'hui, pas le mois écoulé, et rien dans le
// dossier ne conserve ce qui était programmé alors. Le rapport l'écrit noir
// sur blanc plutôt que de laisser croire à une mesure.
function rapAssiduite(u,debut,fin){
  const ss=_rapSeances(u,debut,fin);
  let faites=0,prescrites=0,minutes=0,decharges=0;
  for(const s of ss){
    if(s.deload) decharges++;
    faites+=Number(s.sets)||0;
    prescrites+=Number(s.setsPlanned)||0;
    minutes+=Number(s.duration)||0;
  }
  // seancesPrevuesParSemaine plancher à 1 même sans aucun créneau actif : ce
  // repli sert au compteur de semaines, pas à un dénominateur. Sans créneau
  // configuré, on n'affiche AUCUNE prévision — « 12 / 4 prévues » serait faux
  // et ridicule.
  const actifs=((u&&u.sessions_config)||[]).filter(s=>s&&s.active).length;
  let parSemaine=0;
  if(actifs) try{ parSemaine=seancesPrevuesParSemaine(u); }catch(e){ parSemaine=0; }
  const semaines=Math.max(1,Math.round((fin-debut)/(7*864e5)));
  return {
    seances:ss.length, decharges,
    prevues:parSemaine?parSemaine*semaines:null,
    prevuesEstimee:true,
    series:faites, seriesPrescrites:prescrites,
    minutes:Math.round(minutes),
    dureeMoyenne:ss.length?Math.round(minutes/ss.length):0,
    serie:(()=>{ try{ return streakSemaines(u); }catch(e){ return 0; } })(),
    taux:(()=>{ try{ return tauxCompletion(u,fin); }catch(e){ return null; } })()
  };
}
// ── Bloc 3 : volume par muscle ────────────────────────────────────────────
// volumeSemaine est LU semaine par semaine sur la période, puis moyenné pour
// être comparable aux repères — qui sont hebdomadaires. Additionner quatre
// semaines et comparer à un MEV hebdomadaire donnerait un dépassement partout.
function rapVolume(u,debut,fin){
  const ss=_rapSeancesTendance(u,debut,fin);
  if(ss.length<RAP_MIN_SEANCES) return {suffisant:false,muscles:[]};
  const cles=new Set();
  for(let t=debut;t<=fin;t+=7*864e5){
    try{ cles.add(semaineISO(new Date(t))); }catch(e){}
  }
  try{ cles.add(semaineISO(new Date(fin))); }catch(e){}
  const somme={},n=cles.size||1;
  for(const c of cles){
    let v=null;
    try{ v=volumeSemaine(u,c); }catch(e){ v=null; }
    if(!v) continue;
    for(const m in v) somme[m]=(somme[m]||0)+v[m];
  }
  const out=[];
  // MEME CORRECTION QUE POUR LE RITE : lecture directe de la table, et `mav`
  // qui n'y existe pas. Le rapport affichait un MAV vide.
  for(const m in somme){
    let rep=null; try{ rep=reperesEffectifs(u,m); }catch(e){ rep=null; }
    if(!rep) continue;
    out.push({muscle:m,series:Math.round(somme[m]/n*10)/10,
      mev:rep.mev,mav:rep.mavMin,mrv:rep.mrv,source:rep.source});
  }
  out.sort((a,b)=>b.series-a.series);
  // Assez de séances mais AUCUN muscle reconnu (exercices non classés, semaines
  // hors du calcul) : c'est encore une donnée insuffisante. Sans cette ligne,
  // le rapport affichait un cadre « Volume » titré et vide — exactement le
  // graphique vide que la règle 2 interdit. Trouvé au rendu, pas au banc.
  if(!out.length) return {suffisant:false,muscles:[]};
  return {suffisant:true,semaines:n,muscles:out};
}
// ── Bloc 4 : progression ──────────────────────────────────────────────────
// e1RM des cinq exercices les plus FRÉQUENTS sur la période, début contre fin.
// Décharges exclues (règle 3). e1rm est la fonction du fichier, pas une
// formule recopiée : la recopier, c'est signer une divergence future.
function rapProgression(u,debut,fin){
  const ss=_rapSeancesTendance(u,debut,fin);
  if(ss.length<RAP_MIN_SEANCES) return {suffisant:false,exercices:[]};
  const parEx={};
  for(const sess of ss){
    const d=(sess&&sess.data)||{};
    for(const nom of Object.keys(d)){
      let best=0;
      for(const st of ((d[nom]&&d[nom].sets)||[])){
        if(!st||st.done===false) continue;
        const w=parseFloat(st.weight)||0;
        const r=parseFloat(st.repsDone!=null?st.repsDone:st.reps)||0;
        if(!(w>0&&r>0)) continue;
        // LOT T1 : la même borne que partout ailleurs (répétitions + RIR ≤ 12).
        const _i=(st.rir==='echec')?0:(parseInt(st.rir)||0);
        if(!e1rmFiable(r,_i)) continue;
        let v=0;
        try{ v=e1rm(w,r,_i); }catch(e){ v=w; }
        if(v>best) best=v;
      }
      if(!(best>0)) continue;
      const e=parEx[nom]=parEx[nom]||{nom,n:0,points:[]};
      e.n++; e.points.push({date:sess.date,v:best});
    }
  }
  const l=Object.values(parEx)
    .filter(e=>e.points.length>=2)
    .sort((a,b)=>b.n-a.n||b.points.length-a.points.length)
    .slice(0,RAP_TOP_EXOS)
    .map(e=>{
      e.points.sort((a,b)=>a.date-b.date);
      const d0=Math.round(e.points[0].v), d1=Math.round(e.points[e.points.length-1].v);
      return {nom:e.nom,seances:e.n,debut:d0,fin:d1,delta:d1-d0,
        pct:d0?Math.round((d1-d0)/d0*1000)/10:null};
    });
  return {suffisant:l.length>0,exercices:l,
    raison:l.length?'':'Aucun exercice avec deux mesures comparables.'};
}
// ── Bloc 5 : poids ────────────────────────────────────────────────────────
// RÈGLE 5 : grossesse ou allaitement déclarés, ce bloc est MASQUÉ et remplacé
// par le renvoi médical DÉJÀ écrit dans le produit (GROSSESSE_REFUS_SECHE).
// Aucun objectif, aucune vitesse, aucune fourchette.
//
// Aucune pesée : le bloc est ABSENT, jamais à zéro. Une absence de pesée est
// une absence d'information — mm7 le dit déjà en refusant d'interpoler.
function rapPoids(u,debut,fin){
  const g=u&&u.grossesse&&u.grossesse.etat;
  if(g==='enceinte'||g==='allaitement')
    return {masque:true,renvoi:(typeof GROSSESSE_REFUS_SECHE!=='undefined')
      ?GROSSESSE_REFUS_SECHE:'',present:false};
  let serie=[];
  try{ serie=serieWeight(u)||[]; }catch(e){ serie=[]; }
  const dans=serie.filter(e=>{
    const t=new Date(e.date+'T12:00:00').getTime();
    return t>=debut&&t<=fin;
  });
  if(!dans.length) return {present:false,masque:false};
  const points=dans.map(e=>({date:e.date,kg:e.kg,
    mm7:(()=>{ try{ return mm7(serie,e.date,false); }catch(err){ return null; } })()}));
  let v=null;
  try{ v=vitesseHebdo(serie); }catch(e){ v=null; }
  // La FOURCHETTE de la phase, lue dans PHASES — jamais réécrite.
  let phase=null,bornes=null;
  try{
    const p=phaseCourante(u);
    if(p&&PHASES[p.type]){ phase=PHASES[p.type].lib; bornes={min:PHASES[p.type].min,max:PHASES[p.type].max}; }
  }catch(e){}
  return {present:true,masque:false,points,
    debut:dans[0].kg,fin:dans[dans.length-1].kg,
    delta:Math.round((dans[dans.length-1].kg-dans[0].kg)*10)/10,
    vitesse:v,phase,bornes};
}
// ── Bloc 6 : signaux ──────────────────────────────────────────────────────
// LES SIGNAUX NE PORTENT PAS DE DATE. signauxEntrainement rend des booléens et
// un `details` qui contient une FENÊTRE (jours, seances, fenetre) mais aucun
// horodatage — sauf `douleur`, qui porte un tableau `dates`. On date donc le
// CONSTAT et on nomme la fenêtre : inventer une date de survenue reviendrait à
// calculer quelque chose, ce que la règle 1 interdit.
const RAP_SIGNAUX=Object.freeze([
  {cle:'douleur',        lib:'Douleur répétée sur un mouvement'},
  {cle:'douleurDiffuse', lib:'Douleur diffuse'},
  {cle:'decrochage',     lib:'Séries réalisées en retrait du prescrit'},
  {cle:'chuteAssiduite', lib:'Assiduité en baisse'},
  {cle:'plateauMuscle',  lib:'Plateau sur un muscle'},
  {cle:'sousMEV',        lib:'Volume sous le minimum efficace'},
  {cle:'volumeHaut',     lib:'Volume au-dessus du repère haut'},
  {cle:'formeBasse',     lib:'Forme déclarée basse'},
  {cle:'restrictionLongue',lib:'Restriction calorique prolongée'},
  {cle:'habitudesBasses',lib:'Habitudes peu cochées'}
]);
function rapSignaux(u,now){
  const t=(typeof now==='number')?now:Date.now();
  let sg=null;
  try{ sg=signauxEntrainement(u,{complet:true}); }catch(e){ sg=null; }
  if(!sg) return {constateLe:t,liste:[]};
  const liste=[];
  for(const s of RAP_SIGNAUX){
    if(!sg[s.cle]) continue;
    const d=(sg.details||{})[s.cle]||{};
    // La fenêtre telle que le signal la porte LUI-MÊME, sans rien ajouter.
    let fenetre='';
    if(d.fenetre) fenetre=String(d.fenetre);
    else if(d.jours) fenetre=d.jours+' derniers jours';
    else if(d.seances) fenetre=d.seances+' dernières séances';
    else if(Array.isArray(d.dates)&&d.dates.length)
      fenetre='dernier relevé le '+new Date(d.dates[d.dates.length-1]).toLocaleDateString('fr-FR');
    liste.push({cle:s.cle,lib:s.lib,fenetre});
  }
  return {constateLe:t,liste};
}
// ── Le rapport ────────────────────────────────────────────────────────────
// RÈGLE 4 : AUCUNE donnée de l'article 9 sans opt-in EXPLICITE, même côté
// coach. Le rapport est plus strict que le produit : santeVisibleCoach doit
// rendre true, sans se replier sur le défaut. Le rapport ne porte de toute
// façon aucun de ces blocs — cette liste sert à le PROUVER dans les tests et à
// verrouiller toute addition future.
const RAP_BLOCS_SANTE=Object.freeze(['cycle','statutHormonal','traitement','grossesse','pes','constantes','analyses']);
function rapSanteAutorisee(u){
  const out={};
  for(const b of RAP_BLOCS_SANTE){
    let v=false;
    try{ v=santeVisibleCoach(u,b)===true; }catch(e){ v=false; }
    out[b]=v;
  }
  return out;
}
// PURE. Aucune écriture, aucun champ ajouté au document `user` : les cases
// retirées vivent dans une variable d'écran, pas dans le dossier.
// N6.7 — LA DIETE SUR LA PERIODE. _tauxDieteRespectee travaille sur une
// fenetre glissante qui se termine aujourd'hui : on ne peut pas la rejouer sur
// un mois ecoule, et le bloc le DIT — exactement comme les tendances, qui sont
// dans le meme cas et l'annoncent deja.
function rapDiete(u){
  let r=null; try{ r=_tauxDieteRespectee(u); }catch(e){ r=null; }
  if(!r||r.pct==null) return {present:false};
  return {present:true,pct:r.pct,tenus:r.tenus,juges:r.juges,flexible:r.flexible};
}
// N6.7 — LES MENSURATIONS, DEBUT CONTRE FIN DE PERIODE. On compare le premier
// et le dernier bilan de la periode qui portent la mesure : deux bilans hors
// periode diraient l'evolution d'autre chose.
// ⚠ DEUX CLEFS AJOUTEES LE 20/09/2026, ET PAS UNE DE PLUS. Le schema corporel
//   de la fiche coach relie chaque muscle a la mensuration qui le suit ; il
//   lui fallait `glutes` pour les fessiers et `calf-r` pour les mollets, que
//   l'athlete mesure depuis toujours et que personne ne lisait. Les quatre
//   autres clefs de MEAS — bicep-l, thigh-l, calf-l, bust — restent dehors :
//   les cotes gauches servent a l'ecart gauche/droite, qui a sa propre
//   fonction, et le buste n'a aucun muscle en face.
//
// ⚠ `court` EST POUR L'ETIQUETTE, `lib` POUR LES PHRASES. Une etiquette de
//   quatre-vingts pixels ne tient pas « Tour de poitrine » ; l'infobulle et le
//   rapport de periode, eux, le disent en entier. Les deux vivent sur la meme
//   ligne pour ne pas pouvoir diverger.
const RAP_MESURES=Object.freeze([
  {cle:'waist',  lib:'Tour de taille',  court:'taille'},
  {cle:'hips',   lib:'Tour de hanches', court:'hanches'},
  {cle:'neck',   lib:'Tour de cou',     court:'cou'},
  {cle:'chest',  lib:'Tour de poitrine',court:'poitrine'},
  {cle:'bicep-r',lib:'Biceps droit',    court:'biceps D'},
  {cle:'thigh-r',lib:'Cuisse droite',   court:'cuisse D'},
  {cle:'glutes', lib:'Tour de fessiers',court:'fessiers'},
  {cle:'calf-r', lib:'Mollet droit',    court:'mollet D'}
]);
function rapMensurations(u,debut,fin){
  const bl=bilansOrdonnes(u).filter(b=>b.date>=debut&&b.date<=fin);
  if(bl.length<2) return {present:false};
  const lignes=[];
  for(const m of RAP_MESURES){
    let a=null,b=null;
    for(const x of bl){
      let v=null; try{ v=getBM(x,m.cle); }catch(e){ v=null; }
      if(!(v>0)) continue;
      if(a===null) a=v;
      b=v;
    }
    // UNE SEULE MESURE NE DIT AUCUNE EVOLUTION : il en faut deux, et
    // differentes de rang — a et b viennent du premier et du dernier bilan qui
    // la portent.
    if(a===null||b===null||a===b&&bl.length<2) continue;
    if(a===null||b===null) continue;
    lignes.push({lib:m.lib,debut:a,fin:b,delta:Math.round((b-a)*10)/10});
  }
  return lignes.length?{present:true,lignes}:{present:false};
}
// N6.7 — DEUX PHOTOS, LA PREMIERE ET LA DERNIERE DE LA PERIODE, de la meme
// vue. Comparer une photo de face a une photo de dos ne compare rien.
function rapPhotos(u,debut,fin){
  const bl=bilansOrdonnes(u).filter(b=>b.date>=debut&&b.date<=fin);
  const lire=(b,t)=>photoBilanSrc(b,t);
  for(const vue of ['face','back','side']){
    const avec=bl.filter(b=>lire(b,vue));
    if(avec.length<2) continue;
    return {present:true,vue,
      avant:{date:avec[0].date,src:lire(avec[0],vue)},
      apres:{date:avec[avec.length-1].date,src:lire(avec[avec.length-1],vue)}};
  }
  return {present:false};
}
function rapportPeriode(u,debut,fin,opts){
  const o=opts||{};
  const now=(typeof o.now==='number')?o.now:Date.now();
  const ss=_rapSeances(u,debut,fin);
  return {
    genereLe:now,
    periode:{debut,fin,libelle:rapLibellePeriode(debut,fin)},
    athlete:{prenom:(u&&u.fname)||''},
    coach:(()=>{ try{ return _nomCoachAffiche()||''; }catch(e){ return ''; } })(),
    nSeances:ss.length,
    suffisant:ss.length>=RAP_MIN_SEANCES,
    assiduite:rapAssiduite(u,debut,fin),
    volume:rapVolume(u,debut,fin),
    progression:rapProgression(u,debut,fin),
    poids:rapPoids(u,debut,fin),
    signaux:rapSignaux(u,now),
    // CONSTATEES A L'EDITION, pas sur la periode — exactement comme les
    // signaux juste au-dessus. Les deux fonctions qui les calculent lisent des
    // fenêtres glissantes qui se terminent aujourd’hui, et rien dans le dossier
    // ne permettrait de les rejouer sur un mois écoulé. Le bloc le DIT.
    tendances:{
      charge:phraseChargeHebdo(u),
      progres:phraseExercicesEnProgres(u)
    },
    sante:rapSanteAutorisee(u),
    lifestyle:rapLifestyle(u,debut,fin),
    // N6.7 — les trois blocs manquants.
    diete:rapDiete(u),
    mensurations:rapMensurations(u,debut,fin),
    photos:rapPhotos(u,debut,fin),
    // RÈGLE 6 : le mot du coach est VIDE. Il n'est pas pré-rempli, il n'est pas
    // suggéré, et aucune phrase par défaut ne l'habite.
    mot:''
  };
}

// ── Graphiques : SVG INLINE, jamais <canvas> ──────────────────────────────
// Un canvas est un bitmap : il s'imprime flou, il ne se met pas à l'échelle du
// papier, et il ignore la feuille d'impression. Le SVG fait les trois.
function _rapCourbePoids(points){
  const pts=(points||[]).filter(p=>p&&isFinite(p.kg));
  if(pts.length<2) return '';
  const W=520,H=150,P=26;
  const ks=pts.map(p=>p.kg);
  const mn=Math.min(...ks), mx=Math.max(...ks);
  const amp=(mx-mn)||1;
  const x=i=>P+(W-2*P)*(pts.length===1?0.5:i/(pts.length-1));
  const y=v=>H-P-(H-2*P)*((v-mn)/amp);
  const d=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.kg).toFixed(1)).join(' ');
  const mmPts=pts.map((p,i)=>({i,v:p.mm7})).filter(p=>p.v!=null&&isFinite(p.v));
  const dm=mmPts.length>1
    ?mmPts.map((p,k)=>(k?'L':'M')+x(p.i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' '):'';
  return `<svg class="arc-courbe" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img"
    aria-label="Courbe de poids sur la période" style="display:block">
    <line x1="${P}" y1="${H-P}" x2="${W-P}" y2="${H-P}" stroke="currentColor" stroke-opacity=".25" stroke-width="1"/>
    <line x1="${P}" y1="${P}" x2="${P}" y2="${H-P}" stroke="currentColor" stroke-opacity=".25" stroke-width="1"/>
    <text x="2" y="${P+4}" class="rap-lgd" fill="currentColor" fill-opacity=".55">${mx.toFixed(1)}</text>
    <text x="2" y="${H-P+3}" class="rap-lgd" fill="currentColor" fill-opacity=".55">${mn.toFixed(1)}</text>
    ${dm?`<path d="${dm}" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="2.5"/>`:''}
    <path d="${d}" fill="none" stroke="${ROUGE_MARQUE_MIN}" stroke-width="2.4" vector-effect="non-scaling-stroke"/>
    ${pts.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2" fill="${ROUGE_MARQUE_MIN}"/>`).join('')}
  </svg>`;
}
// Barre de volume : la position des trois repères est MONTRÉE, le verdict n'est
// pas écrit. On situe, on ne note pas.
function _rapBarreVolume(m){
  const W=520,H=26;
  const ech=Math.max(m.mrv*1.25,m.series*1.1,1);
  const px=v=>Math.max(0,Math.min(W,(v/ech)*W));
  const rep=(v,lib)=>`<line x1="${px(v).toFixed(1)}" y1="2" x2="${px(v).toFixed(1)}" y2="${H-2}"
      stroke="currentColor" stroke-opacity=".45" stroke-width="1" stroke-dasharray="2 2"/>
    <text x="${Math.min(W-16,px(v)+2).toFixed(1)}" y="9" class="rap-lgd-s" fill="currentColor" fill-opacity=".55">${lib}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img"
    aria-label="Volume ${escapeHtml(m.muscle)} : ${m.series} séries, MEV ${m.mev}, MAV ${m.mav}, MRV ${m.mrv}${m.source==='perso'?', repères ajustés sur ses retours':(m.source==='coach'?', repères fixés par le coach':'')}" style="display:block">
    <rect class="rap-piste" x="0" y="9" width="${W}" height="8" fill="currentColor" fill-opacity=".08" rx="4"/>
    <rect x="0" y="9" width="${px(m.series).toFixed(1)}" height="8" fill="${ROUGE_MARQUE_MIN}" rx="4"/>
    ${rep(m.mev,'MEV')}${rep(m.mav,'MAV')}${rep(m.mrv,'MRV')}
  </svg>`;
}
// ── Le document ───────────────────────────────────────────────────────────
let _rapBlocs={entete:true,assiduite:true,volume:true,progression:true,tendances:true,poids:true,signaux:true,
  diete:true,mensurations:true,photos:true,lifestyle:true,mot:true};
let _rapDebut=null,_rapFin=null,_rapCible=null;
// Les trois fenêtres qu’on demande réellement. Remplir deux champs date à la
// main, sur téléphone, pour chaque athlète, était le prix de la moindre
// question — « et sur les deux dernières semaines ? ».
const RAP_PRESETS=Object.freeze([
  {cle:'14j', lib:'14 derniers jours', jours:14},
  {cle:'28j', lib:'28 derniers jours', jours:28},
  {cle:'mois',lib:'Mois précédent'}
]);
// Le préréglage actuellement en vigueur, ou null dès que les dates ont été
// modifiées à la main : un bouton qui resterait allumé pendant que les champs
// disent autre chose ferait deux vérités à l’écran — exactement ce que le
// commentaire de rapRendre redoute déjà pour les dates elles-mêmes.
let _rapPresetActif=null;
// PURE. Les bornes d’un préréglage, JOUR PLEIN À JOUR PLEIN — comme
// rapMoisPrecedent, qui est borne à borne. Des bornes à l’heure près
// s’afficheraient mal dans deux champs `type="date"` et s’imprimeraient de
// travers.
//
// n-1 : « 14 derniers jours » compte aujourd’hui. Quatorze jours pleins, pas
// quinze.
function _rapPresetBornes(cle){
  if(cle==='mois'){ const m=rapMoisPrecedent(); return {debut:m.debut,fin:m.fin,cle:'mois'}; }
  const p=RAP_PRESETS.find(x=>x.cle===cle)||RAP_PRESETS[0];
  const n=Number(p.jours)||14;
  const d=new Date();
  return {
    debut:new Date(d.getFullYear(),d.getMonth(),d.getDate()-(n-1),0,0,0,0).getTime(),
    fin:new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999).getTime(),
    cle:p.cle
  };
}
// PURE. La cible du rapport, est-ce le dossier de celui qui regarde ?
//
// L’ADRESSE EN PLUS DE L’IDENTITÉ : la fiche coach passe par getOwnedClient,
// qui peut rendre une COPIE du dossier, et une comparaison par référence
// seule prendrait alors le coach pour un de ses clients.
//
// Extraite d’ouvrirRapport, qui la calculait en local : rapPreset en aurait
// fait une seconde copie, et deux copies d’une même règle divergent.
function _rapCibleEstSoi(cible){
  return !cible||cible===currentUser
    ||!!(currentUser&&cible&&cible.email&&cible.email===currentUser.email);
}
// LE DERNIER PRÉRÉGLAGE CHOISI, sur le dossier du COACH. Il tient d’un athlète
// à l’autre : régler la même fenêtre douze fois de suite dans une soirée n’est
// pas un choix, c’est une corvée.
//
// Écrit seulement quand il CHANGE : saveUser pousse vers le nuage, et un envoi
// par clic sur le même bouton serait du trafic pour rien.
function _rapMemoriserPreset(cle){
  try{
    if(!currentUser||currentUser.rapPreset===cle) return false;
    currentUser.rapPreset=cle;
    saveUser();
    return true;
  }catch(e){ return false; }
}
// PURE-ish. Le préréglage mémorisé, s'il est encore connu : une clef inventée
// ou disparue d’une version à l’autre ne doit pas ouvrir une fenêtre absurde.
function _rapPresetMemorise(){
  try{
    const v=currentUser&&currentUser.rapPreset;
    return RAP_PRESETS.some(x=>x.cle===v)?v:null;
  }catch(e){ return null; }
}
function rapPreset(cle){
  const b=_rapPresetBornes(cle);
  // Le MÊME garde que rapRendre, et pour la même raison : une borne non finie
  // poserait un 1er janvier 1970 dans un document qu’on imprime.
  if(!Number.isFinite(b.debut)||!Number.isFinite(b.fin)) return false;
  _rapDebut=b.debut; _rapFin=b.fin; _rapPresetActif=b.cle;
  // MÉMORISÉ SEULEMENT POUR LE RAPPORT D’UN AUTRE. Sur son propre rapport,
  // le champ était écrit — et poussé vers le nuage par saveUser — sans que
  // personne ne le relise jamais : ouvrirRapport ne le consulte que dans la
  // branche « pas soi ». Trois boutons essayés, trois envois pour rien.
  //
  // Le choix reste évidemment actif pour la séance en cours : il vit dans
  // _rapDebut, _rapFin et _rapPresetActif, juste au-dessus.
  //
  // `_rapCible` nul — rapPreset appelée hors de tout rapport — se lit comme
  // « soi », donc n’écrit rien : le défaut sûr est de ne pas écrire.
  if(!_rapCibleEstSoi(_rapCible)) _rapMemoriserPreset(b.cle);
  rapRendre();
  return true;
}
function _rapInsuffisant(){
  return `<div class="rap-vide">${escapeHtml(RAP_INSUFFISANT)}</div>`;
}
function htmlRapport(r){
  const B=_rapBlocs;
  const nb=(v,u2)=>`<span class="rap-nb">${v}</span>${u2?' <span class="rap-u">'+escapeHtml(u2)+'</span>':''}`;
  let h='';
  // (1) En-tête — la date de génération et la période y sont TOUJOURS.
  if(B.entete) h+=`<header class="rap-bloc rap-entete">
    <div class="rap-titre">Rapport de progression</div>
    <div class="rap-sous">${escapeHtml(r.athlete.prenom||'Athlète')} · ${escapeHtml(r.periode.libelle)}</div>
    <div class="rap-meta">Généré le ${new Date(r.genereLe).toLocaleDateString('fr-FR')} à ${new Date(r.genereLe).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${r.coach?' · '+escapeHtml(r.coach):''}</div>
  </header>`;
  // (2) Assiduité — la décharge est COMPTÉE ici, et dite.
  if(B.assiduite){
    const a=r.assiduite;
    h+=`<section class="rap-bloc"><h2>Assiduité</h2>`;
    if(!r.nSeances) h+=_rapInsuffisant();
    else{
      h+=`<div class="rap-grille">
        <div><div class="rap-lbl">Séances réalisées</div>${nb(a.seances,a.prevues?'/ '+a.prevues+' prévues':'')}</div>
        <div><div class="rap-lbl">Séries réalisées</div>${nb(a.series,a.seriesPrescrites?'/ '+a.seriesPrescrites+' prescrites':'')}</div>
        <div><div class="rap-lbl">Durée moyenne</div>${nb(a.dureeMoyenne,'min')}</div>
        <div><div class="rap-lbl">Semaines d'affilée</div>${nb(a.serie,'')}</div>
      </div>`;
      if(a.decharges) h+=`<p class="rap-note">${a.decharges} séance${a.decharges>1?'s':''} de décharge, comptée${a.decharges>1?'s':''} ici et écartée${a.decharges>1?'s':''} des tendances.</p>`;
      if(a.prevues) h+=`<p class="rap-note">Le nombre de séances prévues est projeté depuis le programme ACTUEL : le dossier ne conserve pas ce qui était programmé à l'époque.</p>`;
    }
    h+=`</section>`;
  }
  // (3) Volume
  if(B.volume){
    h+=`<section class="rap-bloc"><h2>Volume hebdomadaire par muscle</h2>`;
    if(!r.volume.suffisant) h+=_rapInsuffisant();
    else h+=r.volume.muscles.map(m=>`<div class="rap-vol">
      <div class="rap-vol-t"><span>${escapeHtml((typeof MUSCLES!=='undefined'&&MUSCLES[m.muscle]&&MUSCLES[m.muscle].lib)||m.muscle)}</span><span>${m.series} séries</span></div>
      ${_rapBarreVolume(m)}</div>`).join('');
    h+=`</section>`;
  }
  // (4) Progression
  if(B.progression){
    h+=`<section class="rap-bloc"><h2>Progression estimée (e1RM)</h2>`;
    if(!r.progression.suffisant) h+=_rapInsuffisant();
    else{
      h+=`<table class="rap-tbl"><thead><tr><th>Exercice</th><th>Début</th><th>Fin</th><th>Écart</th></tr></thead><tbody>
      ${r.progression.exercices.map(e=>`<tr><td>${escapeHtml(e.nom)}</td><td>${e.debut}</td><td>${e.fin}</td>
        <td>${e.delta>0?'+':''}${e.delta}${e.pct!=null?' ('+(e.pct>0?'+':'')+String(e.pct).replace('.',',')+' %)':''}</td></tr>`).join('')}
      </tbody></table>
      <p class="rap-note">Charge maximale estimée à partir des séries réalisées. Séances de décharge exclues.</p>`;
    }
    h+=`</section>`;
  }
  // (5) Tendances — CONSTATÉES À L’ÉDITION, et le bloc le dit.
  if(B.tendances){
    const _t=r.tendances||{};
    const _l=[_t.charge,_t.progres].filter(Boolean);
    // Rien à établir : le bloc est ABSENT. Pas de cadre vide, pas de zéro —
    // même règle que le poids sans pesée juste en dessous.
    if(_l.length){
      h+=`<section class="rap-bloc"><h2>Tendances</h2>
        <ul class="rap-liste">${_l.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')}</ul>
        <p class="rap-note">Constaté le ${new Date(r.genereLe).toLocaleDateString('fr-FR')} : ces deux chiffres portent sur les semaines qui précèdent l’édition, pas sur la période du rapport.</p>
      </section>`;
    }
  }
  // (6) Poids — masqué sous grossesse, absent sans pesée.
  if(B.poids){
    const p=r.poids;
    if(p.masque) h+=`<section class="rap-bloc"><h2>Poids</h2><p class="rap-note">${escapeHtml(p.renvoi)}</p></section>`;
    else if(p.present){
      h+=`<section class="rap-bloc"><h2>Poids</h2>
        <div class="rap-grille">
          <div><div class="rap-lbl">Début</div>${nb(p.debut,'kg')}</div>
          <div><div class="rap-lbl">Fin</div>${nb(p.fin,'kg')}</div>
          <div><div class="rap-lbl">Écart</div>${nb((p.delta>0?'+':'')+String(p.delta).replace('.',','),'kg')}</div>
        </div>
        ${_rapCourbePoids(p.points)}
        <p class="rap-note">Trait rouge : pesées. Trait pâle : moyenne sur sept jours. Les jours sans pesée ne sont pas inventés.</p>`;
      if(p.vitesse&&p.vitesse.pctSem!=null){
        const v=p.vitesse;
        h+=`<p class="rap-note">Vitesse : ${(v.kgSem>0?'+':'')+v.kgSem.toFixed(2)} kg/sem (${(v.pctSem>0?'+':'')+v.pctSem.toFixed(2)} %/sem)`
          +(p.bornes?`, fourchette habituelle en ${escapeHtml(String(p.phase).toLowerCase())} : ${String(p.bornes.min).replace('.',',')} à ${String(p.bornes.max).replace('.',',')} %/sem.`:'.')
          +`</p>`;
      }
      h+=`</section>`;
    }
    // Aucune pesée : le bloc est ABSENT. Pas de cadre vide, pas de zéro.
  }
  // (6) Signaux
  if(B.signaux){
    h+=`<section class="rap-bloc"><h2>Signaux détectés</h2>`;
    if(!r.signaux.liste.length) h+=`<p class="rap-note">Aucun signal sur la période.</p>`;
    else h+=`<ul class="rap-liste">${r.signaux.liste.map(s=>
      `<li>${escapeHtml(s.lib)}${s.fenetre?' <span class="rap-u"> : '+escapeHtml(s.fenetre)+'</span>':''}</li>`).join('')}</ul>
      <p class="rap-note">Constaté le ${new Date(r.signaux.constateLe).toLocaleDateString('fr-FR')}. Chaque signal porte la fenêtre sur laquelle il a été établi : l'application ne conserve pas de date de survenue, et le rapport n'en invente pas.</p>`;
    h+=`</section>`;
  }
  // N6.7 — (8) LA DIETE. Sous RAP_MIN_SEANCES ou sans donnee, on ecrit
  // RAP_INSUFFISANT, jamais un zero — la regle du module.
  if(B.diete){
    h+=`<section class="rap-bloc"><h2>Diète</h2>`;
    if(!r.diete||!r.diete.present) h+=`<p class="rap-note">${RAP_INSUFFISANT}</p>`;
    else h+=`<p class="rap-chiffre">${r.diete.pct} %</p>
      <p class="rap-note">${r.diete.tenus} jour${r.diete.tenus>1?'s':''} tenu${r.diete.tenus>1?'s':''} sur ${r.diete.juges} jugé${r.diete.juges>1?'s':''}. Constaté à l'édition, sur la fenêtre glissante : l'application ne sait pas rejouer ce calcul sur un mois écoulé.</p>`;
    h+=`</section>`;
  }
  // N6.7 — (9) LES MENSURATIONS, debut contre fin.
  if(B.mensurations){
    h+=`<section class="rap-bloc"><h2>Mensurations</h2>`;
    if(!r.mensurations||!r.mensurations.present) h+=`<p class="rap-note">${RAP_INSUFFISANT}</p>`;
    else h+=`<table class="rap-tbl"><thead><tr><th>Mesure</th><th>Début</th><th>Fin</th><th>Écart</th></tr></thead><tbody>`
      +r.mensurations.lignes.map(l=>`<tr><td>${escapeHtml(l.lib)}</td><td>${String(l.debut).replace('.',',')} cm</td><td>${String(l.fin).replace('.',',')} cm</td><td>${l.delta>0?'+':''}${String(l.delta).replace('.',',')} cm</td></tr>`).join('')
      +`</tbody></table>`;
    h+=`</section>`;
  }
  // N6.7 — (10) DEUX PHOTOS DE LA MEME VUE. En <img>, jamais en canvas : le
  // canvas s'imprime flou, la raison est ecrite plus haut dans ce module.
  if(B.photos){
    h+=`<section class="rap-bloc rap-photos"><h2>Photos</h2>`;
    if(!r.photos||!r.photos.present) h+=`<p class="rap-note">${RAP_INSUFFISANT}</p>`;
    else{
      const d=t=>new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'});
      h+=`<div style="display:flex;gap:12px;align-items:flex-start">
        <figure style="flex:1;min-width:0;margin:0"><img src="${srcImageSure(r.photos.avant.src)}" alt="" style="width:100%;border-radius:6px;display:block"><figcaption class="rap-note">${d(r.photos.avant.date)}</figcaption></figure>
        <figure style="flex:1;min-width:0;margin:0"><img src="${srcImageSure(r.photos.apres.src)}" alt="" style="width:100%;border-radius:6px;display:block"><figcaption class="rap-note">${d(r.photos.apres.date)}</figcaption></figure>
      </div>`;
    }
    h+=`</section>`;
  }
  // (7) Mot du coach — VIDE, et il le reste.
  // (12) Sommeil et pas. AUCUN DEGRADE, AUCUN HALO : ce bloc est fait pour
  // sortir d'une imprimante noir et blanc. Il n'emploie que du texte et les
  // classes rap-* existantes, qui sont deja eprouvees a l'impression.
  if(B.lifestyle){
    const L=r.lifestyle;
    h+=`<section class="rap-bloc"><h2>Sommeil et pas</h2>`;
    if(!L||(!L.pas.renseignes&&!L.sommeil.renseignes)){
      // LE VIDE EST DIT. Un bloc coche qui ne rend rien laisserait croire a une
      // panne d'impression plutot qu'a une absence de saisie.
      h+=`<p class="rap-note">Aucune donnée de sommeil ni de pas sur la période.</p>`;
    } else {
      h+=`<div class="rap-grille">
        <div><div class="rap-lbl">Pas / jour</div>${L.pas.moyenne!=null?nb(sanNb(L.pas.moyenne),'en moyenne'):nb('-','')}</div>
        <div><div class="rap-lbl">Jours renseignés</div>${nb(L.pas.renseignes,'/ '+L.jours)}</div>
        <div><div class="rap-lbl">Sommeil / nuit</div>${L.sommeil.moyenne!=null?nb(sanHM(L.sommeil.moyenne),'en moyenne'):nb('-','')}</div>
        <div><div class="rap-lbl">Nuits renseignées</div>${nb(L.sommeil.renseignes,'/ '+L.jours)}</div>
      </div>`;
      if(L.fcRepos) h+=`<p class="rap-note">FC de repos : ${L.fcRepos.moyenne} bpm en moyenne, sur ${L.fcRepos.n} mesure${L.fcRepos.n>1?'s':''} synchronisée${L.fcRepos.n>1?'s':''}.</p>`;
      if(L.vfc) h+=`<p class="rap-note">Variabilité cardiaque (${_libVfc(L.vfc.methode)}) : ${L.vfc.moyenne} ms en moyenne, sur ${L.vfc.n} mesure${L.vfc.n>1?'s':''} synchronisée${L.vfc.n>1?'s':''}.</p>`;
      if(L.regularite) h+=`<p class="rap-note">Couchers : ± ${L.regularite.ecart} min autour de ${_libHeure(L.regularite.moyenne)}, sur ${L.regularite.n} nuit${L.regularite.n>1?'s':''} horodatée${L.regularite.n>1?'s':''}.</p>`;
      h+=`<p class="rap-note">Objectifs en vigueur : ${sanNb(L.pas.objectif)} pas, ${sanHM(L.sommeil.objectif)} de sommeil. Les jours non renseignés ne sont pas comptés dans les moyennes.</p>`;
    }
    h+=`</section>`;
  }
  if(B.mot) h+=`<section class="rap-bloc"><h2>Mot du coach</h2>
    <div class="rap-mot" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Mot du coach"></div>
    <p class="rap-note rap-noprint">Écris ici avant d'imprimer. Rien n'est enregistré : ce texte vit le temps de l'impression.</p></section>`;
  return h;
}
// ── L'écran ───────────────────────────────────────────────────────────────
function ouvrirRapport(cible){
  _rapCible=cible||currentUser;
  // SOI OU UN CLIENT : le défaut n’est pas le même. Un coach qui ouvre la
  // fiche d’un athlète regarde ce qui vient de se passer ; un athlète qui
  // ouvre son propre rapport depuis l’onglet Perfs veut un document de bilan.
  //
  // Le prédicat est écrit UNE fois, au-dessus : rapPreset s’en sert aussi
  // pour décider s’il y a lieu de mémoriser quoi que ce soit.
  const _soi=_rapCibleEstSoi(cible);
  const _cle=_soi?'mois':(_rapPresetMemorise()||'14j');
  const b=_rapPresetBornes(_cle);
  _rapDebut=b.debut; _rapFin=b.fin; _rapPresetActif=b.cle;
  // L'écran est atteignable depuis l'onglet Perfs de l'athlète ET depuis la
  // fiche coach : goAvecRetour mémorise d'où l'on vient, plutôt que de coder
  // une destination en dur — ou d'appeler history.back(), que le produit
  // proscrit et qu'une assertion surveille.
  goAvecRetour('s-rapport');
  rapRendre();
}
function rapRendre(){
  const z=document.getElementById('rap-corps');
  if(!z) return;
  const _vrr=rcVerrou('rapport');
  if(_vrr){ z.innerHTML=_vrr; return; }
  let r=null;
  try{ r=rapportPeriode(_rapCible,_rapDebut,_rapFin); }catch(e){ r=null; }
  z.innerHTML=r?htmlRapport(r):'<div class="rap-vide">Rapport indisponible.</div>';
  const d=document.getElementById('rap-d'), f=document.getElementById('rap-f');
  // TOUJOURS, et non « seulement si le champ est vide ». ouvrirRapport remet
  // _rapDebut et _rapFin au mois précédent à CHAQUE ouverture : les champs
  // gardaient donc la période choisie la fois d'avant pendant que le rapport,
  // lui, couvrait le mois précédent. Deux vérités à l'écran, et la seule
  // lisible était la fausse — sur un document qu'on imprime et qu'on donne.
  //
  // Une date non finie n'écrit rien : mieux vaut un champ inchangé qu'un
  // « 1970-01-01 » posé par un new Date(null).
  //
  // Number.isFinite et NON isFinite : le second convertit son argument, et
  // isFinite(null) vaut TRUE — null devient 0, donc le 1er janvier 1970. C'est
  // exactement le cas que ce garde devait empêcher.
  if(d&&Number.isFinite(_rapDebut)) d.value=localISODate(new Date(_rapDebut));
  if(f&&Number.isFinite(_rapFin)) f.value=localISODate(new Date(_rapFin));
  // REDESSINÉS À CHAQUE RENDU, contrairement aux cases de blocs : le bouton
  // allumé doit suivre la période en vigueur, et s’éteindre dès qu’elle est
  // reprise à la main.
  const pz=document.getElementById('rap-presets');
  if(pz) pz.innerHTML=RAP_PRESETS.map(x=>{
    const actif=_rapPresetActif===x.cle;
    return `<button type="button" onclick="rapPreset('${x.cle}')" aria-pressed="${actif?'true':'false'}" style="flex:1;min-height:38px;padding:0 6px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;background:${actif?'#1a0000':'var(--surface-1)'};border:1px solid ${actif?'var(--red)':'var(--border)'};color:${actif?'var(--red-light)':'var(--sub)'}">${escapeHtml(x.lib)}</button>`;
  }).join('');
  const c=document.getElementById('rap-cases');
  if(c&&!c.dataset.pose){
    c.dataset.pose='1';
    c.innerHTML=RAP_BLOCS.map(b=>`<label class="rap-case"><input type="checkbox" ${_rapBlocs[b.cle]?'checked':''}
      onchange="rapBasculer('${b.cle}',this.checked)"> ${escapeHtml(b.lib)}</label>`).join('');
  }
}
function rapBasculer(cle,val){ _rapBlocs[cle]=!!val; rapRendre(); }
function rapPeriodeChange(){
  const d=document.getElementById('rap-d'), f=document.getElementById('rap-f');
  const a=d&&d.value?new Date(d.value+'T00:00:00').getTime():null;
  const b=f&&f.value?new Date(f.value+'T23:59:59').getTime():null;
  // Le préréglage s’éteint : les dates ne viennent plus de lui, et un bouton
  // resté allumé annoncerait une période que le rapport ne couvre pas.
  if(a&&b&&b>a){ _rapDebut=a; _rapFin=b; _rapPresetActif=null; rapRendre(); }
  else toast('La fin doit suivre le début','var(--orange)');
}
// La SEULE sortie. Aucun canal d'envoi n'est construit : window.print() rend
// la main au système, qui imprime ou enregistre en PDF.
function rapImprimer(){
  try{ window.print(); }catch(e){ toast('Impression indisponible sur ce navigateur','var(--orange)'); }
  return true;
}
// ══════════════ FICHE PROGRAMME IMPRIMABLE ════════════════════════════════
//
// Le programme se lisait sur un téléphone, et nulle part ailleurs. Cette
// fiche est la même chose sur papier : une section par créneau actif, avec
// l’échauffement, les exercices, le retour au calme et les notes.
//
// AUCUNE IMPRESSION PROPRE. window.print() imprime le DOCUMENT, pas un
// écran : c’est la feuille @media print qui décide seule de ce qui sort.
// Deux fonctions identiques auraient fini par diverger — celle du rapport
// suffit, l’alias ne sert qu’à ce que le point d’appel dise ce qu’il fait.
//
// ⚠ ET L'AFFECTATION PASSE PAR window, PAS PAR const. Un `const` de premier
// niveau est visible depuis un attribut inline — la portée du script remonte
// jusqu'à lui — mais il est ABSENT de window : invisible à toute sonde, et
// cassé au premier appel programmatique. Sur les quelque 590 handlers
// d'attribut du fichier, celui-ci était le seul dans ce cas. L'alias reste un
// alias ; il est seulement atteignable.
window.ppImprimer=rapImprimer;

