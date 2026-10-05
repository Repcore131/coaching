// ══════════════ MORPHO — LOT M1 : SIX MESURES, QUATRE TESTS ══════════════
//
// Même discipline que les deux longueurs d'origine : facultatives, bornées, et
// quand une mesure ne tient pas debout on le DIT au lieu de calculer dessus.
// Elles ne bougent plus une fois adulte — on ne les redemande pas à chaque
// bilan de suivi.
//
// ⚠ LA CONSIGNE FAIT LA MESURE, et c'est pourquoi chaque champ porte la sienne
// à l'écran, au moment de la saisie. Une auto-mesure prise avec un protocole
// affiché s'accorde bien avec celle d'un technicien ; prise sans, on ne sait
// même pas ce qui a été mesuré, et deux bilans cessent d'être comparables.
//
// LES BORNES SONT LARGES À DESSEIN. Elles écartent la faute de frappe et
// l'unité fausse — 7 cm de tour de poignet, 190 cm de hauteur de genou — pas la
// morphologie inhabituelle. Chacune porte son ordre de grandeur en commentaire.

/**
 * Les mesures morphologiques, avec leur consigne et leurs bornes.
 * `type` : une LONGUEUR ne peut pas dépasser la taille de la personne, un TOUR
 * de membre n'a pas de raison d'être comparé à elle — la garde ne s'applique
 * donc qu'aux longueurs.
 * `origine` : les deux premières existaient avant ce lot ; leur calcul reste
 * celui de longueurSegment, qu'on ne réécrit pas.
 */
const MORPHO_MESURES=Object.freeze([
  {cle:'deb-entrejambe',lib:'Entrejambe',court:'Entrejambe',type:'longueur',origine:'M0',
   consigne:'Du sol au pubis, pieds nus, dos au mur.'},
  {cle:'deb-bras',lib:'Longueur de bras',court:'Bras',type:'longueur',origine:'M0',
   consigne:'Bras tendu le long du corps, de la pointe de l’épaule au poignet.'},
  // Du sol à l'interligne du genou : environ 27 % de la taille, soit 39 cm à
  // 145 cm et 55 cm à 200 cm. Les bornes couvrent largement au-delà.
  {cle:'deb-genou',lib:'Hauteur de genou',court:'Genou',type:'longueur',min:25,max:75,
   consigne:'Debout, pieds nus : du sol au creux du genou, là où la jambe plie.'},
  // Du sol au milieu de la rotule : le meme ordre de grandeur que la hauteur
  // de genou ci-dessus, deux a trois centimetres plus haut. Memes bornes.
  //
  // ⚠ ELLE NE REMPLACE PAS `deb-genou`, ELLE S'AJOUTE. Voir le bloc du lot 7 :
  //   deux protocoles differents ne peuvent pas partager une colonne.
  {cle:'deb-rotule',lib:'Hauteur de rotule',court:'Rotule',type:'longueur',min:25,max:75,
   consigne:'Du sol au milieu de la rotule, pieds nus, dos au mur, jambes tendues.',
   schema:true},
  // Olécrane → styloïde : environ 14,5 % de la taille, soit 21 à 29 cm chez
  // l'adulte.
  {cle:'deb-avantbras',lib:'Avant-bras',court:'Av.-bras',type:'longueur',min:15,max:45,
   consigne:'Coude plié à angle droit : de la pointe du coude à l’os du poignet.'},
  // Largeur biacromiale : environ 23 % de la taille, soit 33 à 46 cm.
  {cle:'deb-epaules',lib:'Largeur d’épaules',court:'Épaules',type:'longueur',min:25,max:65,
   consigne:'De dos, bras relâchés : d’une pointe d’épaule à l’autre, en ligne droite.'},
  // Largeur biiliaque : environ 16 à 18 % de la taille, soit 23 à 36 cm.
  {cle:'deb-bassin',lib:'Largeur de bassin',court:'Bassin',type:'longueur',min:18,max:55,
   consigne:'Mains à plat sur les crêtes des hanches : d’un os à l’autre, en ligne droite.'},
  // Tour de poignet : 14 à 19 cm chez l'adulte, os fin ou large compris.
  {cle:'deb-poignet',lib:'Tour de poignet',court:'Poignet',type:'tour',min:10,max:26,
   consigne:'Juste sous l’os saillant, mètre ruban à plat, sans serrer.'},
  // Tour de cheville au plus fin : 19 à 27 cm chez l'adulte.
  {cle:'deb-cheville',lib:'Tour de cheville',court:'Cheville',type:'tour',min:14,max:38,
   consigne:'Au plus fin, juste au-dessus de l’os de la cheville, sans serrer.'},
  // ── Chantier A12 (25/09/2026) : trois mesures que les leviers utilisent.
  // Envergure : environ 1,02 à 1,03 fois la taille (ANSUR II), soit 150 à
  // 210 cm. ⚠ PAS UNE « LONGUEUR » AU SENS DE LA GARDE : elle dépasse la
  // taille chez la moitié des gens, on ne la compare donc pas à elle.
  {cle:'deb-envergure',lib:'Envergure',court:'Envergure',type:'envergure',min:120,max:230,
   consigne:'Bras en croix à l’horizontale, dos et bras contre le mur : du bout d’un majeur à l’autre.',schema:'envergure'},
  // Pied : environ 15 % de la taille, soit 22 à 30 cm.
  {cle:'deb-pied',lib:'Longueur de pied',court:'Pied',type:'longueur',min:18,max:34,
   consigne:'Debout, pieds nus, talon contre le mur : du mur au bout de l’orteil le plus long.',schema:'pied'},
  // Profondeur thoracique : 20 à 32 cm chez l'adulte.
  {cle:'deb-thorax',lib:'Profondeur du thorax',court:'Thorax',type:'longueur',min:15,max:40,
   consigne:'Debout, souffle relâché : du sternum (à hauteur des mamelons) au dos, entre deux livres tenus bien parallèles ou au pied à coulisse.',schema:'thorax'}
]);

/**
 * PURE. Une mesure morphologique, si elle tient debout. Même contrat que
 * longueurSegment — {cm} ou {motif} — et c'est LUI qui répond pour les deux
 * mesures d'origine : elles ont leurs bornes historiques, et deux sources de
 * vérité sur la même mesure finiraient par diverger.
 * @returns {{cm:number|null, motif:string|null}}
 */
function mesureMorpho(user,cle){
  const d=MORPHO_MESURES.find(m=>m.cle===cle);
  if(!d) return {cm:null,motif:'inconnue'};
  if(d.origine==='M0') return longueurSegment(user,cle);
  const brut=_dernierChamp(user,cle);
  if(brut==null||String(brut).trim()==='') return {cm:null,motif:'absente'};
  const v=parseFloat(String(brut).replace(',','.'));
  if(!isFinite(v)||v<=0) return {cm:null,motif:'aberrante'};
  if(v<d.min||v>d.max) return {cm:null,motif:'aberrante'};
  // UNE LONGUEUR PLUS GRANDE QUE LA PERSONNE est une saisie fausse, ou des
  // millimètres pris pour des centimètres. On ne calcule pas, on le dit.
  const t=_tailleCm(user);
  if(d.type==='longueur'&&t!=null&&v>t) return {cm:null,motif:'aberrante'};
  // L'envergure, elle, reste proche de la taille : au-delà de ±20 %, c'est une saisie fausse.
  if(d.type==='envergure'&&t!=null&&Math.abs(v/t-1)>0.2) return {cm:null,motif:'aberrante'};
  return {cm:v,motif:null};
}

/**
 * Les incohérences entre deux mesures. Ce ne sont pas des morphologies rares :
 * un genou plus haut que le pubis, un avant-bras plus long que le bras entier,
 * un bassin plus large que les épaules d'un tiers — ce sont des saisies
 * fausses, et tout rapport bâti dessus le serait aussi.
 * `k` : le facteur appliqué à la seconde mesure avant comparaison.
 */
const MORPHO_COHERENCES=Object.freeze([
  {cle:'coherence_genou',a:'deb-genou',b:'deb-entrejambe',k:1,lib:'Genou et entrejambe',
   motif:'La hauteur de genou dépasse l’entrejambe, alors que le genou est forcément plus bas que le pubis.',
   question:'Peux-tu reprendre les deux, pieds nus et dos au mur ?'},
  {cle:'coherence_avantbras',a:'deb-avantbras',b:'deb-bras',k:1,lib:'Avant-bras et bras',
   motif:'L’avant-bras est donné plus long que le bras entier, dont il fait partie.',
   question:'Peux-tu reprendre l’avant-bras, coude plié à angle droit ?'},
  // Un bassin plus large que les épaules existe ; plus large d'un tiers, non.
  {cle:'coherence_bassin',a:'deb-bassin',b:'deb-epaules',k:1.3,lib:'Bassin et épaules',
   motif:'Le bassin est donné nettement plus large que les épaules : plus d’un tiers d’écart.',
   question:'Peux-tu reprendre les deux largeurs en ligne droite, de dos ?'}
]);
/**
 * PURE. Les incohérences trouvées, au format de questionsMorpho. Rien n'est
 * signalé tant que les DEUX mesures ne sont pas là et lisibles : une case vide
 * n'est pas une faute.
 * @returns {{cle:string, lib:string, motif:string, question:string}[]}
 */
function coherencesMorpho(user){
  const out=[];
  if(!user||typeof user!=='object') return out;
  for(const c of MORPHO_COHERENCES){
    const a=mesureMorpho(user,c.a), b=mesureMorpho(user,c.b);
    if(a.cm==null||b.cm==null) continue;
    if(a.cm>b.cm*c.k+1e-9) out.push({cle:c.cle,lib:'Mesures à revérifier : '+c.lib,
      motif:c.motif,question:c.question});
  }
  return out;
}

// ── LES QUATRE TESTS D'AMPLITUDE ────────────────────────────────────────────
//
// ⚠ AUCUN NE NOMME UNE CAUSE. « Butée nette » est un constat : le mouvement
// s'arrête franchement. Ce que cette butée est — os, capsule, muscle — ne se
// décide pas au mur d'un salon, et l'app ne le dira pas.
//
// QUATRE-VINGT-DIX JOURS. Une amplitude se travaille et se perd : passé un
// trimestre, un test ne décrit plus l'athlète d'aujourd'hui. Il n'est pas
// effacé — il est marqué périmé, et reproposé.
const MORPHO_PEREMPTION_J=90;
const MORPHO_TESTS=Object.freeze([
  {cle:'cheville',lib:'Cheville, genou au mur',champ:'cm',unite:'cm',min:0,max:25,
   protocole:'Pied nu, orteils face à un mur. Avance le genou jusqu’à toucher le mur sans '
     +'décoller le talon, puis recule le pied jusqu’à la distance la plus grande où le genou '
     +'touche encore. Mesure de l’orteil au mur.'},
  {cle:'hanche',lib:'Hanche : flexion et rotations',champ:'deg',unite:'°',min:30,max:160,
   protocole:'Allongé sur le dos, l’autre jambe tendue au sol : monte le genou vers la '
     +'poitrine jusqu’à ce que le bassin commence à basculer. Note l’angle atteint, et si '
     +'l’arrêt est net ou élastique.'},
  {cle:'epaule',lib:'Épaule : au mur et main dans le dos',champ:'paire',unite:'cm',min:0,max:60,
   mur:true,
   protocole:'Dos au mur, lombaires plaquées : monte les bras tendus, note la distance des '
     +'poignets au mur. Puis main dans le dos, note la distance entre les deux mains. '
     +'Un côté après l’autre. Note aussi si les bras touchent le mur sans que les lombaires '
     +'décollent.'},
  {cle:'posterieur',lib:'Chaîne postérieure : flexion avant',champ:'niveau',unite:'',
   protocole:'Debout, jambes tendues, descends les mains vers le sol sans forcer. Note où le '
     +'dos commence à s’enrouler : haut du dos, milieu, ou bas du dos.',
   niveaux:['haut','milieu','bas']}
]);
/**
 * PURE. Les tests d'amplitude d'un athlète, normalisés et datés, avec leur
 * péremption. Un test absent n'est pas une erreur : c'est un test à faire, et
 * le moteur doit fonctionner sans.
 * @param {any} user
 * @param {number} [maintenant]  ms, pour que le test de la péremption soit reproductible
 * @returns {{cle:string, lib:string, texte:string, date:number|null, jours:number|null, perime:boolean}[]}
 */
function testsMorpho(user,maintenant){
  const now=Number(maintenant)||Date.now();
  const src=(user&&user.morphoTests&&typeof user.morphoTests==='object')?user.morphoTests:{};
  return MORPHO_TESTS.map(d=>{
    const v=src[d.cle];
    const date=(v&&isFinite(Number(v.date))&&Number(v.date)>0)?Math.round(Number(v.date)):null;
    const jours=date==null?null:Math.floor((now-date)/864e5);
    return {cle:d.cle,lib:d.lib,texte:_morphoTexteTest(d,v),date,jours,
      perime:jours!=null&&jours>MORPHO_PEREMPTION_J};
  });
}
/** PURE. Ce qu'un test dit, en une ligne — ou '' s'il n'a pas été fait. */
function _morphoTexteTest(d,v){
  if(!v||typeof v!=='object') return '';
  const n=(x)=>{ const q=parseFloat(String(x).replace(',','.')); return isFinite(q)?q:null; };
  if(d.champ==='cm'){ const q=n(v.cm); return q==null?'':Math.round(q)+' cm au mur'; }
  if(d.champ==='deg'){
    const q=n(v.deg);
    if(q==null) return '';
    const b=v.butee==='nette'?', butée nette':v.butee==='elastique'?', butée élastique':'';
    return Math.round(q)+'°'+b;
  }
  if(d.champ==='paire'){
    const g=n(v.g), dr=n(v.d);
    const mur=v.mur==='oui'?'les bras touchent le mur'
      :v.mur==='non'?'les bras ne touchent pas le mur sans décoller les lombaires':'';
    if(g==null&&dr==null) return mur;
    const cm='gauche '+(g==null?'-':Math.round(g)+' cm')+' · droite '+(dr==null?'-':Math.round(dr)+' cm');
    return mur?mur+' · '+cm:cm;
  }
  if(d.champ==='niveau'){
    const k=String(v.niveau||'');
    return (d.niveaux||[]).includes(k)?'le dos s’enroule par le '+k+' du dos':'';
  }
  return '';
}

// ══════════════ MORPHO — LOT M2 : LES NEUF AXES ══════════════
//
// Un athlète n'est pas rangé dans une case : il occupe une POSITION sur
// chacun des neuf axes, avec la confiance que mérite la source. Neuf axes
// renvoyés, toujours, même vides — un axe absent porte ce qu'il faudrait
// mesurer pour qu'il existe, et c'est une sortie de première classe.
//
// ⚠ L'ORDRE DE LECTURE EST DANS LA STRUCTURE, PAS DANS LA DOCTRINE.
// morphoAxes rend les axes ACQUIS d'abord, FONCTIONNELS ensuite, OSSEUX en
// dernier. Un mollet plat après deux ans sans mollets n'est pas une affaire
// d'insertions : inverser cet ordre, c'est justifier par la génétique ce qui
// relève de la programmation.
//
// ⚠ DEUX REPÈRES SEULEMENT SONT IMPORTÉS, ET CE SONT CEUX DU CODE.
// A1 (0,46 ± 0,03) et A3 (0,45 ± 0,03) existaient avant ce lot. A6 porte le
// seul repère chiffré de l'étude qui soit assorti de sa condition — homme de
// plus de 1,65 m. LES TROIS AUTRES (A2, A4, A5) N'ONT PAS DE REPÈRE :
// l'étude en cite un pour A2 (« autour de 1,15–1,25 »), mais il porte sur les
// longueurs OSSEUSES fémur et tibia, pas sur ce qu'un mètre mesure debout.
// Entrejambe moins hauteur de genou n'est pas le fémur, et la hauteur de genou
// n'est pas le tibia : elle inclut le pied. Le rapport calculable tourne autour
// de 0,85, pas de 1,20. Reprendre le 1,15–1,25 ici serait un repère inventé —
// pire qu'un axe absent. Ces trois axes attendent donc un repère CALIBRÉ sur
// les athlètes réels du coach, et le disent tant qu'il n'existe pas.

// Ce que pèse chaque source (§7.1 de l'étude).
// Le mètre du coach vaut plus que celui de l'athlète, mais RepCore ne sait pas
// aujourd'hui lequel des deux a tenu le ruban : les mensurations arrivent par
// le bilan, que l'athlète remplit. On retient donc la valeur ATHLÈTE, la plus
// basse des deux — on ne s'attribue pas une précision qu'on ne peut pas
// prouver.
const MORPHO_CONF=Object.freeze({metre:0.75, photo:0.6, test:0.85, carnet:0.95});
// Sous ce seuil, l'axe ne sort pas et l'app dit ce qui le débloquerait.
const MORPHO_CONF_MIN=0.6;
// Mètre et photo qui divergent de plus de 10 % : on ne tranche pas.
const MORPHO_DESACCORD=0.10;
// En dessous, aucun axe OSSEUX n'est présenté : les proportions changent
// pendant la croissance.
const MORPHO_AGE_OSSEUX=18;
// Protocole, annexe A : « deux mesures ; si elles diffèrent de plus de 0,5 cm,
// une troisième ». C'est l'erreur de mesure que l'app s'autorise à propager.
const MORPHO_ERREUR_CM=0.5;
// En dessous de huit athlètes mesurés, aucun repère local : une médiane sur
// trois personnes n'est pas une population.
const MORPHO_CALIB_MIN=8;
// Une asymétrie demande un écart FRANC (au-delà du centimètre d'erreur
// technique sur un tour de membre) et RÉPÉTÉ sur trois bilans consécutifs,
// toujours du même côté.
const MORPHO_ASYM_CM=1;
const MORPHO_ASYM_BILANS=3;
// Le rapport à partir duquel un couple antagoniste cesse d'être une préférence
// d'exercices. C'est le seuil déjà retenu pour quadriceps / ischios, généralisé
// aux quatre autres couples comme l'étude le demande.
const MORPHO_DOM_SIGNAL=DOMINANCE_QI_SIGNAL;

/**
 * Les cinq couples antagonistes. Le premier existait déjà sous la forme de
 * dominanceQuadIschio, qui reste le point d'entrée d'origine et n'est pas
 * réécrit ; les quatre autres sont la généralisation demandée.
 */
const MORPHO_COUPLES=Object.freeze([
  {cle:'quad_ischio',a:'QUADRICEPS',b:'ISCHIOS',lib:'Quadriceps et ischios'},
  {cle:'pec_dos',a:'PECTORAUX',b:'DORSAUX',lib:'Pectoraux et dorsaux'},
  {cle:'delt',a:'DELT_ANT',b:'DELT_POST',lib:'Deltoïde antérieur et postérieur'},
  {cle:'bras',a:'BICEPS',b:'TRICEPS',lib:'Biceps et triceps'},
  {cle:'tronc',a:'ABDOS',b:'LOMBAIRES',lib:'Abdominaux et lombaires'}
]);
/** Les trois mensurations relevées des deux côtés à chaque bilan. */
const MORPHO_PAIRES=Object.freeze([
  {cle:'bicep',g:'bicep-l',d:'bicep-r',lib:'Biceps'},
  {cle:'thigh',g:'thigh-l',d:'thigh-r',lib:'Cuisse'},
  {cle:'calf',g:'calf-l',d:'calf-r',lib:'Mollet'}
]);

/**
 * Les neuf axes, dans l'ordre de lecture imposé. `segment` sert au garde-fou
 * G5 : un axe osseux n'est présenté qu'après les axes acquis et fonctionnels
 * DU MÊME SEGMENT.
 * `calibrable` : l'axe n'a pas de repère de population utilisable et attend
 * celui du coach.
 */
const MORPHO_AXES=Object.freeze([
  {cle:'A9',lib:'Histoire d’entraînement',court:'Entraînement',nature:'acquis',segment:'global'},
  {cle:'A7',lib:'Amplitude de cheville',court:'Cheville',nature:'fonctionnel',segment:'bas'},
  {cle:'A8',lib:'Amplitudes articulaires',court:'Articulations',nature:'fonctionnel',segment:'global'},
  {cle:'A1',lib:'Levier fémoral',court:'Fémur / tronc',nature:'osseux',segment:'bas'},
  {cle:'A2',lib:'Répartition de jambe',court:'Fémur / tibia',nature:'osseux',segment:'bas',calibrable:true},
  {cle:'A3',lib:'Levier brachial',court:'Bras / taille',nature:'osseux',segment:'haut'},
  {cle:'A4',lib:'Répartition de bras',court:'Humérus / avant-bras',nature:'osseux',segment:'haut',calibrable:true},
  {cle:'A5',lib:'Charpente scapulaire',court:'Épaules / bassin',nature:'osseux',segment:'haut',calibrable:true},
  {cle:'A6',lib:'Ossature',court:'Poignet',nature:'osseux',segment:'global',calibrable:true}
]);

/** PURE. La dernière valeur d'un champ de bilan, AVEC la date du bilan d'où
 *  elle vient : une valeur sans sa date ne peut pas porter sa source (G6). */
function _morphoChampDate(user,champ){
  const bl=((user&&user.bilans)||[]).filter(x=>x&&x.date).slice().sort((x,y)=>y.date-x.date);
  for(const x of bl){
    const v=x[champ];
    if(v!=null&&String(v).trim()!=='') return {brut:v,date:x.date};
  }
  return {brut:null,date:null};
}

/**
 * PURE. Arbitrage des sources pour une mesure : LE MÈTRE PRIME SUR LA PHOTO.
 * Les deux d'accord font monter la confiance ; les deux en désaccord de plus
 * de 10 % la font disparaître — on ne tranche pas, on demande une reprise.
 * @returns {{cm:number|null, source:string|null, date:number|null, conf:number, motif:string|null}}
 */
function _morphoSource(user,cle){
  const m=mesureMorpho(user,cle);
  const dm=m.cm!=null?_morphoChampDate(user,cle).date:null;
  const pm=(user&&user.morphoPhoto&&user.morphoPhoto.mesures
    &&typeof user.morphoPhoto.mesures==='object')?user.morphoPhoto.mesures:null;
  const ph=pm?pm[cle]:null;
  const pc=(ph&&isFinite(Number(ph.cm))&&Number(ph.cm)>0)?Number(ph.cm):null;
  const pd=(ph&&isFinite(Number(ph.date))&&Number(ph.date)>0)?Math.round(Number(ph.date)):null;
  if(m.cm!=null&&pc!=null){
    const ecart=Math.abs(m.cm-pc)/m.cm;
    if(ecart>MORPHO_DESACCORD)
      return {cm:null,source:null,date:null,conf:0,motif:'desaccord'};
    // D'accord : la photo confirme le mètre. La confiance monte, sans jamais
    // dépasser celle de la meilleure des deux sources.
    return {cm:m.cm,source:'metre',date:dm,conf:Math.min(0.9,MORPHO_CONF.metre+0.1),motif:null};
  }
  if(m.cm!=null) return {cm:m.cm,source:'metre',date:dm,conf:MORPHO_CONF.metre,motif:null};
  if(pc!=null) return {cm:pc,source:'photo',date:pd,conf:MORPHO_CONF.photo,motif:null};
  return {cm:null,source:null,date:null,conf:0,motif:m.motif||'absente'};
}

/** PURE. bas / neutre / haut. La marge est ATTEINTE, pas dépassée — même
 *  convention que _horsMarge, dont A1 et A3 continuent de dépendre. */
function _morphoPosition(v,ref,marge){
  if(v==null||ref==null||marge==null||!isFinite(v)) return null;
  if(v<=ref-marge+1e-9) return 'bas';
  if(v>=ref+marge-1e-9) return 'haut';
  return 'neutre';
}
/** PURE. Médiane d'une liste de nombres. */
function _morphoMediane(l){
  if(!l.length) return null;
  const t=l.slice().sort((a,b)=>a-b), m=t.length>>1;
  return t.length%2?t[m]:(t[m-1]+t[m])/2;
}

/**
 * PURE. LE REPÈRE LOCAL, calculé sur les athlètes réels du coach — la seule
 * réponse honnête pour les axes dont aucun repère de population publié ne
 * décrit ce que le mètre mesure ici.
 *
 * Médiane pour le centre (une faute de frappe ne la déplace pas), écart
 * interquartile ramené à un écart-type robuste pour la dispersion. La marge ne
 * descend jamais sous DEUX fois l'erreur de mesure propagée : sous ce plancher,
 * on classerait du bruit de ruban en morphologie.
 *
 * @param {any[]} athletes
 * @returns {Object<string,{ref:number,marge:number,n:number,date:number}>}
 */
function morphoCalibrage(athletes){
  const out={};
  const l=Array.isArray(athletes)?athletes:[];
  for(const a of MORPHO_AXES){
    if(!a.calibrable) continue;
    const vals=[],errs=[];
    for(const u of l){
      let r=null;
      try{ r=_morphoBrut(u,a.cle); }catch(e){ r=null; }
      if(r&&r.valeur!=null&&isFinite(r.valeur)){ vals.push(r.valeur); errs.push(r.erreur||0); }
    }
    if(vals.length<MORPHO_CALIB_MIN) continue;
    const t=vals.slice().sort((x,y)=>x-y);
    const q=(p)=>t[Math.min(t.length-1,Math.max(0,Math.round(p*(t.length-1))))];
    const sigma=(q(0.75)-q(0.25))/1.349;
    const plancher=2*(_morphoMediane(errs)||0);
    const ref=_morphoMediane(vals);
    out[a.cle]={ref:Math.round(ref*1000)/1000,
      marge:Math.round(Math.max(sigma,plancher)*1000)/1000,
      n:vals.length,date:Date.now()};
  }
  // LES RAPPORTS LUS SUR PHOTO, sur la même population et avec la même
  // discipline. Leur plancher de marge vient de la tolérance de lecture :
  // si les deux côtés du MÊME corps peuvent différer de 10 % avant qu'on
  // refuse la photo, la moitié de ça est le moins qu'on puisse exiger
  // avant de déclarer DEUX corps différents.
  for(const d of MORPHO_PHOTO_RAPPORTS){
    const vals=[];
    for(const u of l){
      let r=null;
      try{ r=_morphoRapportPhoto(u,d.axe); }catch(e){ r=null; }
      if(r) vals.push(r.valeur);
    }
    if(vals.length<MORPHO_CALIB_MIN) continue;
    const t=vals.slice().sort((x,y)=>x-y);
    const q=(p)=>t[Math.min(t.length-1,Math.max(0,Math.round(p*(t.length-1))))];
    const ref=_morphoMediane(vals);
    out[d.cle]={ref:Math.round(ref*1000)/1000,
      marge:Math.round(Math.max((q(0.75)-q(0.25))/1.349,ref*0.05)*1000)/1000,
      n:vals.length,date:Date.now()};
  }
  return out;
}

/**
 * PURE. La valeur BRUTE d'un axe et l'erreur de mesure qu'elle porte, avant
 * tout repère. C'est ce que le calibrage agrège et ce que morphoAxes habille.
 * @returns {{valeur:number|null, erreur:number, unite:string, source:string|null,
 *            date:number|null, conf:number, motif:string|null, aMesurer:string|null}|null}
 */
function _morphoBrut(user,cle){
  const E=MORPHO_ERREUR_CM;
  const t=_tailleCm(user);
  const manque=(txt)=>({valeur:null,erreur:0,unite:'',source:null,date:null,conf:0,
    motif:'absente',aMesurer:txt});
  // Combine deux sources : la plus ancienne des deux dates, la plus basse des
  // deux confiances. Une chaîne ne vaut pas mieux que son maillon faible.
  const duo=(a,b)=>({date:(a.date&&b.date)?Math.min(a.date,b.date):(a.date||b.date),
    source:(a.source==='photo'||b.source==='photo')?'photo':'metre',
    conf:Math.min(a.conf,b.conf)});
  if(cle==='A1'){
    const e=_morphoSource(user,'deb-entrejambe');
    if(e.motif==='desaccord') return {valeur:null,erreur:0,unite:'× taille',source:null,date:null,
      conf:0,motif:'desaccord',aMesurer:null};
    if(e.cm==null||!t) return manque('l’entrejambe, du sol au pubis, pieds nus et dos au mur');
    return {valeur:e.cm/t,erreur:E/t,unite:'× taille',source:e.source,date:e.date,conf:e.conf,
      motif:null,aMesurer:null};
  }
  if(cle==='A2'){
    const e=_morphoSource(user,'deb-entrejambe'), g=_morphoSource(user,'deb-genou');
    if(e.motif==='desaccord'||g.motif==='desaccord') return {valeur:null,erreur:0,unite:'',
      source:null,date:null,conf:0,motif:'desaccord',aMesurer:null};
    if(g.cm==null) return manque('la hauteur de genou, du sol au creux du genou : une minute au mur');
    if(e.cm==null) return manque('l’entrejambe, du sol au pubis, pieds nus et dos au mur');
    if(e.cm<=g.cm) return {valeur:null,erreur:0,unite:'',source:null,date:null,conf:0,
      motif:'incoherente',aMesurer:null};
    const v=(e.cm-g.cm)/g.cm;
    // Propagation : ∂v/∂E = 1/G, ∂v/∂G = −E/G². Un rapport bâti sur une
    // DIFFÉRENCE amplifie l'erreur — c'est pourquoi la marge a un plancher.
    const err=Math.sqrt(Math.pow(E/g.cm,2)+Math.pow(E*e.cm/(g.cm*g.cm),2));
    const d=duo(e,g);
    return {valeur:v,erreur:err,unite:'',source:d.source,date:d.date,conf:d.conf,
      motif:null,aMesurer:null};
  }
  if(cle==='A3'){
    const b=_morphoSource(user,'deb-bras');
    if(b.motif==='desaccord') return {valeur:null,erreur:0,unite:'× taille',source:null,date:null,
      conf:0,motif:'desaccord',aMesurer:null};
    if(b.cm==null||!t) return manque('la longueur de bras, de la pointe de l’épaule au poignet');
    return {valeur:b.cm/t,erreur:E/t,unite:'× taille',source:b.source,date:b.date,conf:b.conf,
      motif:null,aMesurer:null};
  }
  if(cle==='A4'){
    const b=_morphoSource(user,'deb-bras'), a=_morphoSource(user,'deb-avantbras');
    if(b.motif==='desaccord'||a.motif==='desaccord') return {valeur:null,erreur:0,unite:'',
      source:null,date:null,conf:0,motif:'desaccord',aMesurer:null};
    if(a.cm==null) return manque('l’avant-bras, coude plié à angle droit, de l’olécrane à la styloïde');
    if(b.cm==null) return manque('la longueur de bras, de la pointe de l’épaule au poignet');
    if(b.cm<=a.cm) return {valeur:null,erreur:0,unite:'',source:null,date:null,conf:0,
      motif:'incoherente',aMesurer:null};
    const v=(b.cm-a.cm)/a.cm;
    const err=Math.sqrt(Math.pow(E/a.cm,2)+Math.pow(E*b.cm/(a.cm*a.cm),2));
    const d=duo(b,a);
    return {valeur:v,erreur:err,unite:'',source:d.source,date:d.date,conf:d.conf,
      motif:null,aMesurer:null};
  }
  if(cle==='A5'){
    const e=_morphoSource(user,'deb-epaules'), b=_morphoSource(user,'deb-bassin');
    if(e.motif==='desaccord'||b.motif==='desaccord') return {valeur:null,erreur:0,unite:'',
      source:null,date:null,conf:0,motif:'desaccord',aMesurer:null};
    if(e.cm==null) return manque('la largeur d’épaules, d’un acromion à l’autre');
    if(b.cm==null) return manque('la largeur de bassin, d’une crête iliaque à l’autre');
    const v=e.cm/b.cm;
    const err=Math.sqrt(Math.pow(E/b.cm,2)+Math.pow(E*e.cm/(b.cm*b.cm),2));
    const d=duo(e,b);
    return {valeur:v,erreur:err,unite:'',source:d.source,date:d.date,conf:d.conf,
      motif:null,aMesurer:null,epaulesCm:e.cm,bassinCm:b.cm};
  }
  if(cle==='A6'){
    const p=_morphoSource(user,'deb-poignet');
    if(p.motif==='desaccord') return {valeur:null,erreur:0,unite:'cm',source:null,date:null,
      conf:0,motif:'desaccord',aMesurer:null};
    if(p.cm==null) return manque('le tour de poignet, juste sous l’os saillant, sans serrer');
    // Le calibrage travaille sur le rapport à la taille — un poignet de 17 cm
    // ne dit pas la même chose à 1,60 m et à 1,95 m. L'axe, lui, s'affiche en
    // centimètres, et le repère local se reconvertit à la taille de l'athlète.
    if(!t) return {valeur:p.cm,erreur:E,unite:'cm',source:p.source,date:p.date,conf:p.conf,
      motif:null,aMesurer:null};
    return {valeur:p.cm/t,erreur:E/t,unite:'× taille',source:p.source,date:p.date,conf:p.conf,
      motif:null,aMesurer:null,cm:p.cm,taille:t};
  }
  return null;
}

/**
 * PURE. Les volumes par muscle sur les dernières semaines ENTRAÎNÉES, lus UNE
 * fois pour les cinq couples. Mêmes bornes que dominanceQuadIschio, qui reste
 * le point d'entrée d'origine du couple quadriceps / ischios.
 */
function _morphoVolumes(user){
  const tot={}; let n=0,vides=0;
  for(let k=0;k<=26&&n<VOL_DELTA_N;k++){
    const c=_calculSemaine(user,_volCleDecalee(k));
    if(!c.eligibles){ if(++vides>=VOL_COUPURE) break; continue; }
    vides=0; n++;
    for(const m in c.muscles) tot[m]=(tot[m]||0)+(c.muscles[m]||0);
  }
  return n<VOL_DELTA_MIN?null:tot;
}
/**
 * PURE. Les couples antagonistes déséquilibrés. Un rapport à dénominateur nul
 * ne veut rien dire : le couple sort du calcul plutôt que de partir à l'infini.
 * @returns {{cle:string, lib:string, rapport:number, fort:string, faible:string}[]}
 */
function _morphoDominances(user){
  const out=[];
  let v=null;
  try{ v=_morphoVolumes(user); }catch(e){ v=null; }
  // NULL, PAS []. Un carnet trop court ne dit pas « rien à signaler » : il
  // ne dit rien du tout, et l'axe ne doit pas passer pour renseigné.
  if(!v) return null;
  for(const c of MORPHO_COUPLES){
    const a=v[c.a]||0, b=v[c.b]||0;
    if(!(a>0)||!(b>0)) continue;
    const r=a>=b?a/b:b/a;
    if(r<=MORPHO_DOM_SIGNAL) continue;
    out.push({cle:c.cle,lib:c.lib,rapport:Math.round(r*100)/100,
      fort:(a>=b?c.a:c.b),faible:(a>=b?c.b:c.a)});
  }
  return out.sort((x,y)=>y.rapport-x.rapport);
}
/**
 * PURE. Les asymétries gauche / droite SOUTENUES. Trois bilans consécutifs,
 * toujours du même côté, et un écart au-delà du centimètre d'erreur technique
 * d'un tour de membre auto-mesuré. En dessous, c'est du bruit de ruban — et
 * lancer une chasse à l'asymétrie sur du bruit est le plus sûr moyen de rendre
 * un athlète anxieux sur son corps.
 * @returns {{cle:string, lib:string, ecart:number, cote:string, bilans:number, date:number}[]}
 */
function _morphoAsymetries(user){
  const out=[];
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>b.date-a.date);
  for(const p of MORPHO_PAIRES){
    const ecarts=[],dates=[];
    for(const b of bl){
      const g=getBM(b,p.g), d=getBM(b,p.d);
      if(g==null||d==null||!(g>0)||!(d>0)) continue;
      ecarts.push(d-g); dates.push(b.date);
      if(ecarts.length>=MORPHO_ASYM_BILANS) break;
    }
    if(ecarts.length<MORPHO_ASYM_BILANS) continue;
    const franc=ecarts.every(e=>Math.abs(e)>MORPHO_ASYM_CM+1e-9);
    const memeCote=ecarts.every(e=>e>0)||ecarts.every(e=>e<0);
    if(!franc||!memeCote) continue;
    const moyen=ecarts.reduce((s,e)=>s+e,0)/ecarts.length;
    out.push({cle:p.cle,lib:p.lib,ecart:Math.round(Math.abs(moyen)*10)/10,
      cote:moyen>0?'droite':'gauche',bilans:ecarts.length,date:dates[0]});
  }
  return out.sort((a,b)=>b.ecart-a.ecart);
}

/** PURE. Un nombre écrit en français : la virgule, et pas le point. */
function _morphoVirgule(x){ return String(x).replace('.',','); }
/** PURE. « (mètre, 12/09/2026, ± 1 cm) » — G6 : source, date, tolérance. */
function _morphoAttribut(source,date,tol){
  const s=source==='metre'?'mètre':source==='photo'?'photo':source==='test'?'test'
    :source==='carnet'?'carnet':'';
  const l=[];
  if(s) l.push(s);
  if(date) l.push(new Date(date).toLocaleDateString('fr-FR'));
  if(tol) l.push('± '+_morphoVirgule(tol));
  return l.length?'('+l.join(', ')+')':'';
}
/** PURE. Un ratio, rendu lisible sans fausse précision. */
function _morphoNb(v,unite){
  if(v==null||!isFinite(v)) return '-';
  if(unite==='× taille') return Math.round(v*100)+' % de la taille';
  if(unite==='cm') return Math.round(v*10)/10+' cm';
  return String(Math.round(v*100)/100).replace('.',',');
}

/**
 * PURE. LES NEUF AXES D'UN ATHLÈTE. Toujours neuf, toujours dans l'ordre de
 * lecture — acquis, fonctionnel, osseux.
 *
 * Chaque axe porte sa valeur, sa source, sa date, sa tolérance et sa
 * confiance ; quand il ne peut pas conclure, il porte CE QU'IL FAUDRAIT
 * MESURER. « Je ne sais pas encore » est une sortie de première classe, et
 * elle est actionnable.
 *
 * @param {any} user
 * @param {{calibrage?:any, maintenant?:number}} [opts]
 * @returns {{cle:string, lib:string, court:string, nature:string, segment:string,
 *   valeur:number|null, unite:string, repere:number|null, marge:number|null,
 *   repereTexte:string|null, position:string|null, confiance:number,
 *   source:string|null, dateISO:string|null, tolerance:string|null,
 *   perime:boolean, manque:string|null, aMesurer:string|null, texte:string,
 *   facettes?:any, dominances?:any[], asymetries?:any[]}[]}
 */
function morphoAxes(user,opts){
  const o=opts||{};
  const now=Number(o.maintenant)||Date.now();
  const cal=(o.calibrage&&typeof o.calibrage==='object')?o.calibrage:{};
  let age=null;
  try{ age=ageActuel(user); }catch(e){ age=null; }
  const mineur=(age!=null&&age<MORPHO_AGE_OSSEUX);
  const tests=(function(){ try{ return testsMorpho(user,now); }catch(e){ return []; } })();
  const parCle={}; tests.forEach(t=>{ parCle[t.cle]=t; });
  const brut=(user&&user.morphoTests&&typeof user.morphoTests==='object')?user.morphoTests:{};

  return MORPHO_AXES.map(d=>{
    /** @type {any} */
    const a={cle:d.cle,lib:d.lib,court:d.court,nature:d.nature,segment:d.segment,
      valeur:null,unite:'',repere:null,marge:null,repereTexte:null,position:null,
      confiance:0,source:null,dateISO:null,tolerance:null,perime:false,
      manque:null,aMesurer:null,texte:''};

    // ── A9 · ACQUIS. Le premier axe à lire, et le seul entièrement sous
    //    contrôle : il vient du carnet, pas d'une mesure humaine.
    if(d.cle==='A9'){
      const brutDom=(function(){ try{ return _morphoDominances(user); }catch(e){ return null; } })();
      const dom=brutDom||[];
      const asy=(function(){ try{ return _morphoAsymetries(user); }catch(e){ return []; } })();
      const lu=(brutDom!==null)||asy.length>0;
      a.dominances=dom; a.asymetries=asy;
      a.source=lu?'carnet':null; a.confiance=lu?MORPHO_CONF.carnet:0;
      a.position=(dom.length||asy.length)?'haut':(lu?'neutre':null);
      a.dateISO=asy.length?localISODate(new Date(asy[0].date)):null;
      if(!dom.length&&!asy.length){
        a.manque=lu?'rien-a-signaler':'absente';
        if(!lu) a.aMesurer='assez de séances enregistrées pour que le compteur de volume parle';
        a.texte=lu?'Aucun déséquilibre de volume ni écart gauche / droite soutenu sur ce qui est enregistré.'
          :'Le carnet n’a pas encore assez de semaines entraînées pour dire ce que la programmation explique déjà.';
      } else {
        const p=[];
        dom.forEach(x=>p.push(x.lib.toLowerCase()+' à '+String(x.rapport).replace('.',',')+' pour 1'));
        asy.forEach(x=>p.push(x.lib.toLowerCase()+' : '+String(x.ecart).replace('.',',')
          +' cm de plus à '+x.cote+' sur '+x.bilans+' bilans'));
        a.texte=p.join(' · ')+' '+_morphoAttribut('carnet',asy.length?asy[0].date:null,null);
      }
      return a;
    }

    // ── A7 · FONCTIONNEL. Le test du genou au mur : trente secondes, et il
    //    doit être fait AVANT toute conclusion sur les leviers.
    if(d.cle==='A7'){
      const t=parCle['cheville'];
      const v=brut['cheville']&&isFinite(Number(brut['cheville'].cm))?Number(brut['cheville'].cm):null;
      a.unite='cm'; a.repere=10; a.marge=0;
      a.repereTexte='Un squat complet demande de l’ordre de 35 à 40° de flexion dorsale ; '
        +'sous 10 cm au mur, la contrainte devient visible en séance.';
      if(v==null||!t||!t.date){
        a.manque='absente';
        a.aMesurer='le test du genou au mur : trente secondes, pied nu, talon au sol';
        a.texte='Amplitude de cheville non relevée.';
        return a;
      }
      a.valeur=v; a.source='test'; a.confiance=MORPHO_CONF.test;
      a.dateISO=localISODate(new Date(t.date));
      a.tolerance='1 cm'; a.perime=!!t.perime;
      a.position=v<10?'bas':'neutre';
      a.texte=Math.round(v)+' cm au mur '+_morphoAttribut('test',t.date,'1 cm')
        +(t.perime?' : périmé, à refaire':'');
      return a;
    }

    // ── A8 · FONCTIONNEL. Trois facettes : hanche, épaule, chaîne
    //    postérieure. L'étude nomme cet axe par la hanche et y rattache aussi
    //    l'épaule (P11) et les postérieurs (P12) — ce sont les trois mêmes
    //    tests, la même nature, et la même péremption.
    if(d.cle==='A8'){
      const f={};
      const th=parCle['hanche'], bh=brut['hanche']||{};
      f.hanche={position:null,texte:th?th.texte:'',dateISO:th&&th.date?localISODate(new Date(th.date)):null,
        perime:!!(th&&th.perime),butee:bh.butee||null};
      // ⚠ « BUTÉE NETTE » EST UN CONSTAT, pas une cause. Ce que cette butée
      //   est — os, capsule, muscle — demande une imagerie que personne n'ira
      //   faire. On décrit, on ne tranche pas.
      if(th&&th.date&&(bh.butee==='nette'||bh.butee==='elastique'))
        f.hanche.position=bh.butee==='nette'?'haut':'neutre';
      const te=parCle['epaule'], be=brut['epaule']||{};
      f.epaule={position:null,texte:te?te.texte:'',dateISO:te&&te.date?localISODate(new Date(te.date)):null,
        perime:!!(te&&te.perime),mur:be.mur||null};
      if(te&&te.date&&(be.mur==='oui'||be.mur==='non'))
        f.epaule.position=be.mur==='non'?'bas':'neutre';
      const tp=parCle['posterieur'], bp=brut['posterieur']||{};
      f.posterieur={position:null,texte:tp?tp.texte:'',dateISO:tp&&tp.date?localISODate(new Date(tp.date)):null,
        perime:!!(tp&&tp.perime),niveau:bp.niveau||null};
      if(tp&&tp.date&&bp.niveau) f.posterieur.position=bp.niveau==='bas'?'bas':'neutre';
      a.facettes=f;
      const faites=['hanche','epaule','posterieur'].filter(k=>f[k].dateISO);
      if(!faites.length){
        a.manque='absente';
        a.aMesurer='les tests de hanche, d’épaule et de flexion avant';
        a.texte='Aucun test d’amplitude articulaire relevé.';
        return a;
      }
      a.source='test'; a.confiance=MORPHO_CONF.test;
      a.dateISO=f[faites[0]].dateISO;
      a.perime=faites.some(k=>f[k].perime);
      a.position=f.hanche.position;
      a.texte=faites.map(k=>({hanche:'Hanche',epaule:'Épaule',posterieur:'Chaîne postérieure'})[k]
        +' : '+(f[k].texte||'-')+(f[k].perime?' (périmé)':'')).join(' · ');
      return a;
    }

    // ── A1 à A6 · OSSEUX. Rien de tout ceci n'est présenté à un mineur : les
    //    proportions changent pendant la croissance, et une phrase sur le
    //    squelette d'un adolescent ne décrit que son mois de mesure.
    const r=_morphoBrut(user,d.cle);
    if(mineur){
      a.manque='croissance';
      a.texte='Moins de '+MORPHO_AGE_OSSEUX+' ans : les proportions changent encore. '
        +'Aucun axe osseux n’est présenté avant la fin de la croissance.';
      return a;
    }
    if(!r) return a;
    a.unite=r.unite; a.aMesurer=r.aMesurer;
    if(r.valeur==null){
      a.manque=r.motif||'absente';
      a.texte=r.motif==='desaccord'
        ? 'Le mètre et la photo divergent de plus de '+Math.round(MORPHO_DESACCORD*100)
          +' % : aucun des deux n’est retenu tant que la mesure n’a pas été reprise.'
        : r.motif==='incoherente'
        ? 'Les deux mesures ne tiennent pas ensemble : aucun rapport n’est calculé dessus.'
        : (r.aMesurer?'Il manque '+r.aMesurer+'.':'Mesure absente.');
      return a;
    }
    a.valeur=r.valeur; a.source=r.source; a.confiance=r.conf;
    // LA LECTURE PHOTO EST ATTACHÉE AVANT LE REPÈRE, et non après : sans
    // repère calibré l'axe rend la main tout de suite, et la photo serait
    // perdue sur le chemin le plus fréquent.
    const rp=(function(){ try{ return _morphoRapportPhoto(user,d.cle); }catch(e){ return null; } })();
    if(rp){
      const cp=cal[rp.cle];
      a.photo={cle:rp.cle,lib:rp.lib,valeur:rp.valeur,
        position:cp?_morphoPosition(rp.valeur,cp.ref,cp.marge):null,
        dateISO:rp.date?localISODate(new Date(rp.date)):null};
    }
    if(r.epaulesCm!=null) a.epaulesCm=r.epaulesCm;
    if(r.bassinCm!=null) a.bassinCm=r.bassinCm;
    if(r.date) a.dateISO=localISODate(new Date(r.date));

    // Le repère : celui du code pour A1 et A3, celui de l'étude pour A6 quand
    // sa condition est remplie, celui du coach partout ailleurs.
    let tol=null;
    if(d.cle==='A1'||d.cle==='A3'){
      a.repere=d.cle==='A1'?RATIO_JAMBES_REF:RATIO_BRAS_REF; a.marge=RATIO_MARGE;
      a.repereTexte='Repère de population autour de '+Math.round(a.repere*100)+' % de la taille, '
        +'à ± '+Math.round(RATIO_MARGE*100)+' points.';
      a.position=_morphoPosition(a.valeur,a.repere,a.marge);
      tol=Math.max(1,Math.ceil(r.erreur*100))+' point'+(Math.ceil(r.erreur*100)>1?'s':'')+' de %';
    } else if(d.cle==='A6'){
      const sexe=(user&&(user._evol_gender||user.gender))||'';
      const t=r.taille||_tailleCm(user);
      const c=cal[d.cle];
      if(!isFemale(sexe)&&t&&t>165){
        // Le seul repère chiffré de l'étude qui porte sa condition : fine sous
        // 16,5 cm de poignet, épaisse au-delà de 19, chez l'homme de plus de
        // 1,65 m. On l'applique là où il vaut, et nulle part ailleurs.
        a.unite='cm'; a.valeur=r.cm; tol=_morphoVirgule(MORPHO_ERREUR_CM)+' cm';
        a.repere=17.75; a.marge=1.25;
        a.repereTexte='Chez l’homme de plus de 1,65 m : ossature fine sous 16,5 cm de poignet, '
          +'épaisse au-delà de 19 cm.';
        a.position=_morphoPosition(r.cm,17.75,1.25);
      } else if(c){
        a.repere=c.ref; a.marge=c.marge;
        a.repereTexte='Repère calibré sur '+c.n+' athlètes suivis, le '
          +dateLocaleDeCle(c.date).toLocaleDateString('fr-FR')+'.';
        a.position=_morphoPosition(a.valeur,a.repere,a.marge);
        tol=Math.max(1,Math.ceil(r.erreur*100))+' point'+(Math.ceil(r.erreur*100)>1?'s':'')+' de %';
      } else {
        a.manque='repere-conditionne';
        a.texte='Tour de poignet à '+_morphoNb(r.cm,'cm')+' '+_morphoAttribut(r.source,r.date,_morphoVirgule(MORPHO_ERREUR_CM)+' cm')
          +'. Le seul repère publié vaut pour l’homme de plus de 1,65 m ; ici il ne s’applique pas, '
          +'et il en faudrait un calibré sur les athlètes suivis.';
        return a;
      }
    } else {
      const c=cal[d.cle];
      if(!c){
        // ⚠ PAS DE REPÈRE, DONC PAS DE POSITION. La valeur est montrée — elle
        //   est juste, elle est datée — mais l'app ne dit pas si elle est
        //   haute ou basse, parce qu'elle ne le sait pas.
        a.manque='repere-a-calibrer';
        a.texte=_morphoNb(a.valeur,a.unite)+' '+_morphoAttribut(r.source,r.date,
          Math.round(r.erreur*100)/100+'')
          +'. Aucun repère de population ne décrit ce que le mètre mesure ici : il se calibrera '
          +'sur les athlètes suivis, à partir de '+MORPHO_CALIB_MIN+' mesurés.'
          +(a.photo?' '+a.photo.lib+' à '+_morphoVirgule(Math.round(a.photo.valeur*100)/100)
            +' '+_morphoAttribut('photo',rp?rp.date:null,null)+'.':'');
        return a;
      }
      a.repere=c.ref; a.marge=c.marge;
      a.repereTexte='Repère calibré sur '+c.n+' athlètes suivis, le '
        +dateLocaleDeCle(c.date).toLocaleDateString('fr-FR')+'.';
      a.position=_morphoPosition(a.valeur,a.repere,a.marge);
      tol=_morphoVirgule(Math.round(r.erreur*100)/100);
    }
    a.tolerance=tol;
    a.texte=_morphoNb(a.valeur,a.unite)+' '+_morphoAttribut(r.source,r.date,tol)
      +(a.repereTexte?' : '+a.repereTexte:'');
    // LA PHOTO CONCLUT. Elle ne remplace rien : elle confirme ou elle
    // contredit. Et quand elle contredit franchement — l'un dit haut,
    // l'autre dit bas — on ne tranche pas, on suspend et on demande la
    // reprise. C'est la règle des sources en désaccord.
    if(rp&&a.photo){
      const pp=a.photo.position;
      const oppose=pp&&a.position&&pp!=='neutre'&&a.position!=='neutre'&&pp!==a.position;
      if(oppose){
        a.position=null; a.confiance=0; a.manque='desaccord';
        a.texte='Le mètre et la photo se contredisent sur cet axe : '
          +_morphoNb(a.valeur,a.unite)+' au ruban, '+rp.lib.toLowerCase()+' à '
          +_morphoVirgule(Math.round(rp.valeur*100)/100)+' sur la photo. Aucun des deux n’est '
          +'retenu tant que la mesure n’a pas été reprise.';
      } else if(pp){
        a.texte+=' · '+rp.lib+' à '+_morphoVirgule(Math.round(rp.valeur*100)/100)
          +' '+_morphoAttribut('photo',rp.date,null)
          +(pp===a.position?' : la photo confirme.':' : la photo ne contredit pas.');
      }
    }
    return a;
  });
}

// ══════════════ MORPHO — LOT M4 : LES QUATORZE FICHES ══════════════
//
// Des combinaisons FRÉQUENTES, pas un catalogue fermé. Neuf axes à trois
// positions font 19 683 combinaisons : ces quatorze-là sont celles qu'on
// rencontre, et « aucun profil marqué » reste le résultat le plus courant.
//
// ⚠ G1 — AUCUN EXERCICE N'EST INTERDIT. Le champ s'appelle `amenager`, jamais
//   « proscrit », et chaque aménagement porte SON RÉGLAGE et une variante du
//   même schéma moteur. Un exercice écarté sans réglage est un interdit
//   déguisé, et un interdit né d'un test de trente secondes devient permanent.
//
// ⚠ `piege` EST AFFICHÉ, pas commenté. C'est l'erreur que fait le coach qui
//   rencontre ce profil — la partie la plus utile de la fiche, et celle qu'on
//   serait tenté de garder pour soi.
//
// `schema` renvoie aux clés de SCHEMA_LIB : c'est par elles que _variantesSchema
// propose des exercices réellement présents dans le catalogue, plutôt que des
// noms écrits à la main qui finiraient par ne plus exister.
const MORPHO_PROFILS=Object.freeze([
  {cle:'P13',lib:'Dominance quadriceps / ischios installée',nature:'acquis',segment:'bas',
   axes:['A9'],signature:[{axe:'A9',positions:['haut'],dominance:'quad_ischio'}],
   signatureTexte:'Rapport de volume quadriceps / ischios au-delà de 2,0 sur les dernières semaines entraînées. Sur la photo de profil : cuisse développée devant, plate derrière.',
   mecanique:'Aucune. C’est une histoire de programmation, pas de morphologie, et c’est précisément pour ça qu’il faut la lire en premier.',
   privilegier:'Leg curl sous deux profils de résistance (allongé pour la position longue, assis pour la position courte), soulevé roumain, hip thrust, fentes longues.',
   amenager:[{quoi:'Rien à retirer',reglage:'on déplace des séries : les mêmes séances, une répartition différente. C’est la correction la moins coûteuse du document.',schema:'isolation-genou'}],
   accent:'Ramener le rapport sous 1,5 sur huit à douze semaines, et le vérifier avec le compteur de volume qui existe déjà.',
   specificite:'Le même raisonnement se généralise à tous les couples : pectoraux/dos, deltoïde antérieur/postérieur, biceps/triceps, abdominaux/lombaires.',
   piege:'Expliquer des ischios plats par « la génétique » alors que le carnet montre deux séries par semaine contre douze au quadriceps. L’ordre de lecture (acquis, fonctionnel, osseux) existe pour ça.'},

  {cle:'P14',lib:'Asymétrie latérale soutenue',nature:'acquis',segment:'global',
   axes:['A9'],signature:[{axe:'A9',positions:['haut'],asymetrie:true}],
   signatureTexte:'Écart droite/gauche sur biceps, cuisse ou mollet, soutenu sur au moins trois bilans consécutifs et supérieur à l’erreur de mesure. En vidéo : déviation latérale de la barre, appui inégal.',
   mecanique:'Sans objet : c’est un constat, pas une structure. Et il y a une asymétrie normale chez tout le monde.',
   privilegier:'Travail unilatéral, en commençant systématiquement par le côté faible et en alignant le côté fort sur son nombre de répétitions, pas l’inverse.',
   amenager:[{quoi:'Les mouvements bilatéraux lourds',reglage:'ils ne sont pas à retirer : on ajoute de l’unilatéral à côté, et Motion Lab sert à vérifier que la barre ne dérive plus.',schema:'fente'}],
   accent:'Réévaluation à trois bilans. Si l’écart ne bouge pas malgré le travail unilatéral, on arrête d’insister et on oriente vers un professionnel de santé si une gêne existe.',
   specificite:'Le seuil compte plus que le signal. Avec une erreur technique de l’ordre du centimètre sur un tour de bras auto-mesuré, un écart de 1 cm ne veut rien dire. Il faut un écart franc, répété, et jamais isolé.',
   piege:'Lancer une chasse à l’asymétrie sur du bruit de mesure. C’est le plus sûr moyen de rendre un athlète anxieux sur son corps, et c’est exactement ce qu’une app ne doit jamais faire.'},

  {cle:'P9',lib:'Cheville verrouillée',nature:'fonctionnel',segment:'bas',
   axes:['A7'],signature:[{axe:'A7',positions:['bas']}],
   signatureTexte:'Moins de ~10 cm au test du genou au mur. En vidéo : talons qui décollent au fond, buste qui plonge d’un coup, ou genoux qui rentrent : les trois compensations classiques d’une amplitude qu’on n’a pas.',
   mecanique:'Un squat complet demande de l’ordre de 35–40° de flexion dorsale. Sans elle, le corps emprunte l’amplitude ailleurs. La cause n’est pas toujours la souplesse : elle peut être articulaire. Le test dit qu’il manque de l’amplitude, pas pourquoi.',
   privilegier:'Presse à cuisses, hack squat, extension de jambes : le quadriceps se charge sans exiger la cheville. Squat talons surélevés : la méta-analyse montre un gain d’amplitude de cheville et de genou à partir d’environ 2,5 cm d’élévation, avec un effet dose.',
   amenager:[{quoi:'Squat pieds serrés profond',reglage:'cale de 2,5 cm, ou stance élargi avec pointes ouvertes',schema:'squat'},
     {quoi:'Fentes avant',reglage:'fentes arrière ou bulgares, qui demandent moins de flexion dorsale à l’avant',schema:'fente'}],
   accent:'Deux voies en parallèle : la cale pour s’entraîner aujourd’hui, le travail d’amplitude pour ne plus en avoir besoin. L’app doit dire lequel des deux elle propose : une cale est un contournement, pas un traitement.',
   specificite:'La cale n’est pas gratuite : la même méta-analyse montre qu’une élévation importante réduit l’amplitude de hanche et de tronc. On déplace le travail vers le quadriceps, on ne l’ajoute pas. À assumer explicitement.',
   piege:'Attribuer à la morphologie ce qui vient de la cheville. Le test du genou au mur prend trente secondes et doit être fait avant toute conclusion sur les leviers.'},

  {cle:'P10',lib:'Hanche à butée précoce',nature:'fonctionnel',segment:'bas',
   axes:['A8'],signature:[{axe:'A8',facette:'hanche',positions:['haut']}],
   signatureTexte:'Flexion de hanche qui bute franchement, avec bascule du bassin, et un arrêt net plutôt qu’élastique. Souvent une nette asymétrie entre rotation interne et externe. En squat : profondeur limitée quel que soit le stance, ou pincement à l’aine.',
   mecanique:'La structure de hanche varie énormément d’une personne à l’autre : l’orientation du col du fémur s’étale sur une trentaine de degrés, celle du cotyle autant. Concrètement, l’un squatte pointes presque droites et descend loin, l’autre bute tôt et a besoin d’ouvrir. Ce n’est pas de la souplesse à gagner.',
   privilegier:'La recherche du stance, méthodiquement : écartement et rotation des pointes testés par paliers, à charge légère, en notant la profondeur confortable. Puis les machines qui contournent l’amplitude : presse avec pieds hauts, hack, leg curl, extension.',
   amenager:[{quoi:'Squat profond imposé',reglage:'profondeur choisie, celle où il n’y a pas de pincement',schema:'squat'},
     {quoi:'Squat pieds serrés',reglage:'ouvrir les pointes et élargir le stance',schema:'squat'},
     {quoi:'Soulevé sumo',reglage:'prudence : il demande de la rotation externe que ce profil n’a pas forcément (à tester à charge légère avant de le programmer)',schema:'charniere-hanche'}],
   accent:'Amplitude utile plutôt qu’amplitude maximale. Le travail en position longue se cherche sur des exercices où la hanche n’est pas la butée : leg curl allongé, fentes, presse.',
   specificite:'Distinguer butée osseuse et raideur demande une imagerie que personne n’ira faire. RepCore décrit le test et se tait sur la cause : « l’arrêt est net et s’accompagne d’une bascule du bassin » est un constat.',
   piege:'Prescrire des mois d’étirements de hanche contre une butée qui ne cédera pas. On n’allonge pas un os ; on irrite une articulation.'},

  {cle:'P11',lib:'Épaule à amplitude limitée',nature:'fonctionnel',segment:'haut',
   axes:['A8'],signature:[{axe:'A8',facette:'epaule',positions:['bas']}],
   signatureTexte:'Bras qui ne montent pas au mur sans décoller les lombaires ; main dans le dos limitée d’un côté. En vidéo : compensation lombaire au développé militaire, épaules qui montent aux oreilles en élévation.',
   mecanique:'L’amplitude manquante est empruntée à la colonne ou à la scapula. Ce n’est pas un défaut de force : c’est une contrainte de course.',
   privilegier:'Développés assis à dossier (le dossier empêche l’emprunt lombaire et le rend visible), haltères plutôt que barre (la trajectoire s’adapte), prise neutre, poulies pour les élévations.',
   amenager:[{quoi:'Développé nuque',reglage:'devant, ou à la machine : la trajectoire reste guidée et les lombaires n’ont plus à combler l’amplitude qui manque',schema:'poussee-verticale'},
     {quoi:'Tirage nuque',reglage:'devant : le dos travaille autant, et l’épaule n’a plus à aller chercher une rotation qu’elle n’a pas',schema:'tirage-vertical'},
     {quoi:'Prise très large au développé couché',reglage:'revenir vers 180 % de la largeur d’épaules',schema:'poussee-horizontale'},
     {quoi:'Dips profonds',reglage:'limiter la descente au point où l’épaule reste devant, sans chercher le fond',schema:'poussee-horizontale'}],
   accent:'Amplitude d’épaule travaillée à part, hors des séries lourdes, et réévaluée tous les deux mois. Tant qu’elle manque, la charge reste sur des trajectoires guidées.',
   specificite:'C’est le profil le plus évolutif du document : un athlète reconnu en janvier peut ne plus l’être en mai. Le profil porte donc une date de péremption.',
   piege:'Figer l’aménagement. Un exercice écarté pour cause d’amplitude et jamais rouvert devient un interdit permanent né d’un test de trente secondes.'},

  {cle:'P12',lib:'Chaîne postérieure raide : le faux mauvais tireur',nature:'fonctionnel',segment:'bas',
   axes:['A8'],signature:[{axe:'A8',facette:'posterieur',positions:['bas']}],
   signatureTexte:'Dos qui s’enroule tôt en flexion avant jambes tendues. Au soulevé : lombaires arrondies dès le départ, pas seulement sous fatigue.',
   mecanique:'Ce n’est pas un problème de levier : c’est une amplitude manquante. La différence est décisive parce que les deux réponses sont opposées : un levier défavorable se contourne par la variante, une raideur se travaille.',
   privilegier:'Départ surélevé (soulevé aux blocs, trap bar) pour charger dans l’amplitude disponible ; soulevé roumain à amplitude partielle, augmentée progressivement ; leg curl pour les ischios sans contrainte lombaire.',
   amenager:[{quoi:'Soulevé au sol lourd',reglage:'surélever la barre jusqu’à ce que le dos tienne',schema:'charniere-hanche'},
     {quoi:'Good morning',reglage:'plus tard, quand l’amplitude est revenue',schema:'charniere-hanche'},
     {quoi:'Jambes tendues au sol',reglage:'sur banc, amplitude choisie',schema:'charniere-hanche'}],
   accent:'Amplitude d’abord, charge ensuite. Et une réévaluation datée : ce profil doit disparaître en quelques mois si le travail est fait.',
   specificite:'À ne pas confondre avec un tronc long, qui produit la même image (un dos qui souffre au soulevé) pour une raison opposée. Le test de flexion avant les départage en dix secondes.',
   piege:'L’envoyer en sumo « parce que son dos s’arrondit ». Le sumo demande plus de rotation de hanche et ne règle pas une raideur postérieure ; il la cache.'},

  {cle:'P1',lib:'Fémur long, tronc court : le squatteur penché',nature:'osseux',segment:'bas',
   axes:['A1','A2'],signature:[{axe:'A1',positions:['haut']},{axe:'A2',positions:['haut']}],
   signatureTexte:'Entrejambe au-delà de ~49 % de la taille, et rapport fémur/tibia élevé. Sur la photo de profil : assis, les genoux montent au-dessus des hanches. En vidéo : le buste plonge dès le premier tiers de la descente.',
   mecanique:'Pour garder la charge au-dessus du milieu du pied, un fémur long oblige le bassin à reculer davantage, donc le buste à s’incliner. L’inclinaison raccourcit le bras de levier du genou et allonge celui de la hanche : à charge égale, ce squat sollicite les extenseurs de hanche plus qu’un squat droit. Ce n’est pas une faute technique, c’est la solution que la géométrie impose.',
   privilegier:'Tout ce qui découple genou et hanche (presse à cuisses, hack squat, squat bulgare, extension de jambes) parce qu’ils permettent de charger le quadriceps sans passer par l’inclinaison de buste. Et tout ce qui rentabilise le levier de hanche : soulevé de terre, charnière, fessiers.',
   amenager:[{quoi:'Squat barre haute profond',reglage:'barre basse ou squat guidé, stance élargi, pointes ouvertes, cale de 1,5 à 2,5 cm',schema:'squat'},
     {quoi:'Front squat',reglage:'souvent le plus pénalisant : la charge devant impose un buste droit qu’il n’a pas ; le remplacer par un hack ou une presse pieds bas',schema:'squat'},
     {quoi:'Fentes longues',reglage:'raccourcir le pas ou passer en bulgare',schema:'fente'}],
   accent:'Quadriceps par les machines et le travail unilatéral, pas par le squat libre. La charnière devient l’exercice fort : la programmer comme telle plutôt que de s’acharner sur un squat qui ne sera jamais son terrain.',
   specificite:'Ces athlètes sont systématiquement corrigés à tort sur « le buste trop penché ». Motion Lab tranche la question : si le bras de levier de hanche reste stable pendant la descente, l’inclinaison est structurelle ; si elle s’aggrave sous fatigue, c’est technique.',
   piege:'Lui vendre de la mobilité de cheville pendant six mois pour « redresser » son squat. Une cale règle en une séance ce qu’un fémur long ne lâchera jamais. Vérifier la cheville avant d’attribuer au fémur.'},

  {cle:'P2',lib:'Tronc long, jambes courtes : le levier de dos',nature:'osseux',segment:'bas',
   axes:['A1'],signature:[{axe:'A1',positions:['bas']}],
   signatureTexte:'Entrejambe sous ~43 % de la taille. Assis, la tête dépasse celle des autres ; debout, non. Photo de profil : tronc visuellement long par rapport aux jambes.',
   mecanique:'Le squat devient confortable : buste plus droit, profondeur peu chère. En revanche, en charnière de hanche, un tronc long est un long bras de levier horizontal : le soulevé de terre conventionnel coûte davantage aux lombaires à charge égale.',
   privilegier:'Squat sous toutes ses formes, y compris front squat et gobelet : c’est son terrain. Fentes, bulgares, travail de profondeur.',
   amenager:[{quoi:'Soulevé de terre conventionnel lourd',reglage:'sumo, ou départ surélevé, ou trap bar, la littérature va dans ce sens : un rapport tronc/taille plus élevé s’accompagne de meilleures performances en sumo',schema:'charniere-hanche'},
     {quoi:'Good morning lourd',reglage:'hip thrust ou charnière guidée',schema:'charniere-hanche'}],
   accent:'Quadriceps au squat libre, sans complexe. Chaîne postérieure par des exercices à bras de levier court (hip thrust, leg curl, extension lombaire réglée) plutôt que par le soulevé lourd.',
   specificite:'Le rapport tronc/membres compte plus que la taille absolue. Un grand athlète à tronc long et jambes courtes est un profil conventionnel ; c’est la proportion qui décide, pas le mètre.',
   piege:'Le pousser au soulevé conventionnel lourd parce qu’il squatte bien et qu’on suppose qu’il « devrait » tout bien faire. C’est exactement le mouvement où son levier joue contre lui.'},

  {cle:'P3',lib:'Tibia long : le squat qui ne coûte rien',nature:'osseux',segment:'bas',
   axes:['A2'],signature:[{axe:'A2',positions:['bas']}],
   signatureTexte:'Hauteur de genou élevée pour l’entrejambe. En vidéo : genoux très avancés au fond, buste presque droit, sans effort apparent.',
   mecanique:'Un tibia long autorise le genou à s’avancer davantage à profondeur égale, ce qui maintient le buste droit et garde le bras de levier sur le genou. La charge reste sur le quadriceps.',
   privilegier:'Squat profond, front squat, squat gobelet, hack. C’est le profil qui peut vraiment charger le quadriceps au squat libre.',
   amenager:[{quoi:'Peu de choses au squat',reglage:'en revanche, attention à la cheville : un genou très avancé demande beaucoup de flexion dorsale, et un tibia long amplifie la demande',schema:'squat'}],
   accent:'Ne pas gâcher l’avantage : le squat est ici un vrai exercice de quadriceps, pas un exercice global bricolé. Les ischios, eux, demanderont un travail dédié : ils ne suivront pas.',
   specificite:'Ce profil est souvent pris pour « doué ». Il est simplement bien proportionné pour ce mouvement-là. Le dire évite deux choses : qu’il se croie supérieur, et que les autres se croient limités.',
   piege:'Faire de son squat le modèle montré aux autres. Une vidéo envoyée à un athlète aux fémurs longs comme « voilà la bonne technique » produit six mois de frustration pour une géométrie inatteignable.'},

  {cle:'P4',lib:'Bras longs, grande envergure : le tireur',nature:'osseux',segment:'haut',
   axes:['A3'],signature:[{axe:'A3',positions:['haut']}],
   signatureTexte:'Longueur de bras au-delà de ~48 % de la taille. Envergure nettement supérieure à la taille. Photo de face : mains au-dessous de la mi-cuisse, bras le long du corps.',
   mecanique:'En poussée, un bras long allonge l’amplitude et le bras de levier à franchir : plus de travail mécanique pour la même charge, et une contrainte d’épaule plus longue. En tirage, la même longueur devient un avantage : plus d’amplitude utile, plus de temps sous tension pour le dos.',
   privilegier:'Tous les tirages : rowing, tirage horizontal, tirage vertical, pull-over. Et les poussées à amplitude bornée par la machine : développé convergent, presse à pectoraux, où la course n’est pas dictée par son bras.',
   amenager:[{quoi:'Développé couché barre',reglage:'prise autour de 180–200 % de sa largeur d’épaules, ce qui réduit l’amplitude et raccourcit le bras de levier ; haltères s’il a une gêne d’épaule en fin d’amplitude',schema:'poussee-horizontale'},
     {quoi:'Tractions lestées',reglage:'coûteuses (long bras de levier) : privilégier le tirage vertical guidé pour le volume',schema:'tirage-vertical'},
     {quoi:'Dips profonds',reglage:'limiter la descente : l’amplitude coûte déjà plus cher qu’aux autres, la chercher en plus n’ajoute rien',schema:'poussee-horizontale'}],
   accent:'Construire le haut du corps par le dos, qui est son terrain, et traiter les pectoraux par des machines et des écartés où l’amplitude est réglée plutôt que subie.',
   specificite:'C’est le profil pour lequel Motion Lab apporte le plus : la largeur de prise se règle en mesurant le bras de levier réel sur trois largeurs, plutôt qu’en appliquant un pourcentage.',
   piege:'Lire sa faiblesse au développé comme un manque de pectoraux et ajouter du volume de poussée. Il fait déjà plus de travail que les autres à charge égale : le problème est l’amplitude, pas le volume.'},

  {cle:'P5',lib:'Bras courts, humérus court : le pousseur',nature:'osseux',segment:'haut',
   axes:['A3','A4'],signature:[{axe:'A3',positions:['bas']},{axe:'A4',positions:['bas']}],
   signatureTexte:'Bras sous ~42 % de la taille, humérus court pour l’avant-bras. Au développé, la barre touche vite et la course paraît courte. Chiffres de charge élevés par rapport au reste du corps.',
   mecanique:'Amplitude courte, bras de levier court : la charge grimpe vite. L’inconvénient est symétrique : moins d’amplitude utile par répétition, donc moins de temps passé en position longue (la position qui compte le plus pour l’hypertrophie).',
   privilegier:'Poussées lourdes : développé couché, incliné, militaire. Et les tractions, où un bras court est un levier favorable.',
   amenager:[{quoi:'Rien n’est à retirer',reglage:'c’est un profil avantagé ; le réglage porte sur l’amplitude (planche sur la poitrine, écartés à grande amplitude, presse à pectoraux avec départ étiré) pour compenser la course courte',schema:'poussee-horizontale'},
     {quoi:'Tirages',reglage:'allonger la course plutôt que charger',schema:'tirage-horizontal'}],
   accent:'Amplitude avant charge. C’est le seul profil où le compteur de charge trompe : les kilos montent vite, le stimulus ne suit pas forcément. La position longue doit être recherchée exercice par exercice.',
   specificite:'Attention au dos : un bras court raccourcit aussi l’amplitude des tirages. C’est souvent le profil qui « ne sent pas son dos », pas par manque de connexion, par manque de course.',
   piege:'Le féliciter sur ses charges et ne jamais regarder son amplitude. Deux ans plus tard, un développé énorme et des pectoraux moyens.'},

  {cle:'P6',lib:'Charpente étroite : le V à construire',nature:'osseux',segment:'haut',
   axes:['A5'],signature:[{axe:'A5',positions:['bas']}],
   signatureTexte:'Rapport épaules/bassin bas. À distinguer absolument d’un tour de taille élevé : le rapport osseux ne bouge pas avec le gras.',
   mecanique:'Moins de largeur osseuse au départ. Le V ne viendra pas de la charpente, donc il viendra du deltoïde latéral et de la largeur du grand dorsal : deux muscles qui répondent bien au volume et aux profils de résistance adaptés.',
   privilegier:'Élévations latérales à haute fréquence, sous plusieurs profils de résistance (poulie pour la position longue, haltère pour la position courte). Tirages prise large et pull-over pour la largeur de dos.',
   amenager:[{quoi:'Rien à écarter',reglage:'mais on hiérarchise : le développé militaire lourd construit moins de largeur visuelle que trois fois par semaine d’élévations bien placées',schema:'isolation-epaule'},
     {quoi:'Obliques chargés',reglage:'lever le pied : ils élargissent la taille et travaillent contre l’effet recherché',schema:'gainage-tronc'}],
   accent:'Deltoïde latéral en priorité absolue, puis largeur de dos, puis gestion du tour de taille. Dans cet ordre.',
   specificite:'C’est le profil où l’écart entre « mesure » et « photo » est le plus grand : le tour de bras peut stagner pendant que la silhouette change complètement. Suivre la photo, pas seulement le mètre.',
   piege:'Confondre charpente étroite et taille épaisse, et mettre l’athlète en déficit pour « faire ressortir le V » alors que le rapport osseux ne bougera pas d’un millimètre.'},

  {cle:'P7',lib:'Charpente large, bassin large : la densité d’abord',nature:'osseux',segment:'global',
   axes:['A5','A6'],signature:[{axe:'A5',positions:['neutre','haut']},{axe:'A6',positions:['haut']}],
   signatureTexte:'Largeur biacromiale et biiliaque élevées, poignet et cheville épais. Photo de face : carrure marquée même sans muscle.',
   mecanique:'Avantage visuel d’emblée sur la carrure, désavantage sur la finesse de taille, qui est osseuse elle aussi, en partie. Les circonférences seront élevées à masse musculaire égale : le mètre flatte, la définition trompe.',
   privilegier:'Tout le travail lourd polyarticulaire : la charpente le supporte bien. Densité et épaisseur : rowing lourd, développés, squat.',
   amenager:[{quoi:'Peu de contraintes mécaniques',reglage:'la vigilance porte sur le tour de taille : obliques chargés et respiration en poussée à surveiller si l’objectif est esthétique',schema:'gainage-tronc'}],
   accent:'Gestion de l’enveloppe. Sur ce profil, la composition corporelle pèse plus lourd que le choix d’exercice : un point de masse grasse se voit davantage.',
   specificite:'Objectifs de circonférence à recalibrer à la hausse : ils partent de plus haut et progressent moins vite en pourcentage. Un même gain de muscle donne un écart de mètre plus faible.',
   piege:'Comparer ses tours de bras à ceux d’une ossature fine et conclure qu’il « prend mieux ». À muscle égal, il mesure plus. Ce n’est pas la même chose.'},

  {cle:'P8',lib:'Ossature fine : le trompe-l’œil du mètre',nature:'osseux',segment:'global',
   axes:['A6'],signature:[{axe:'A6',positions:['bas']}],
   signatureTexte:'Poignet sous ~16,5 cm chez l’homme de plus de 1,65 m, cheville fine. Tours de bras et de mollet modestes malgré un entraînement sérieux et une masse grasse basse.',
   mecanique:'La circonférence mesure os + muscle + gras. Avec moins d’os, il faut plus de muscle pour le même chiffre. En contrepartie, la définition apparaît plus tôt et la silhouette paraît plus sèche à masse grasse égale.',
   privilegier:'Rien de particulier mécaniquement. C’est un profil de programmation et d’attentes, pas de réglage.',
   amenager:[{quoi:'Les objectifs, pas les exercices',reglage:'et le suivi : si le mètre est le seul indicateur, l’athlète conclura qu’il ne progresse pas. Croiser avec la photo et la charge soulevée.',schema:'isolation-epaule'}],
   accent:'Volume sur les groupes qui portent la silhouette (deltoïdes, dos, mollets) parce que chez lui, ce sont les proportions qui font l’effet visuel, pas les circonférences absolues.',
   specificite:'C’est le profil qui abandonne. Il faut lui donner le bon instrument de mesure dès le départ : rapport taille/bras, photo à éclairage constant, charge de travail, et lui expliquer pourquoi le centimètre lui ment.',
   piege:'Lui parler de « potentiel génétique » ou de « FFMI ». Un tour de poignet ne prédit aucun plafond : il change l’unité de mesure, pas le résultat atteignable. RepCore ne dira jamais le contraire.'}
]);

// ══════════════ MORPHO — LOT M3 : LA COMPOSITION, ET LE SILENCE ══════════════
//
// Un profil n'est pas CHOISI dans une liste : il est COMPOSÉ par les axes
// saillants. Et la partie qui décide de la crédibilité n'est pas celle qui
// nomme un profil — c'est celle qui sait se taire.
//
// ⚠ L'ORDRE DE LECTURE (G5) EST APPLIQUÉ MÉCANIQUEMENT, pas recommandé.
//   Acquis d'abord, fonctionnel ensuite, osseux en dernier. Et un profil
//   OSSEUX dont le segment porte un axe FONCTIONNEL saillant part avec la
//   phrase qui le dit : « regarde la cheville avant de conclure sur le
//   fémur ». Sans elle, on justifie par la génétique ce qui relève d'une
//   amplitude de trente secondes à mesurer — l'erreur la plus commune du
//   métier, et la seule vraiment grave.
//
// ⚠ « JE NE SAIS PAS ENCORE » EST UNE SORTIE DE PREMIÈRE CLASSE, et elle est
//   actionnable : « il manque la hauteur de genou pour te dire si c'est le
//   fémur ou le tibia — une minute au mur » vaut mieux qu'un profil inventé
//   sur l'entrejambe seul.

// Deux axes ne font pas un profil : ils font une impression.
const MORPHO_AXES_MIN=3;
// Les deux ou trois saillants les plus marqués. Au-delà, ce n'est plus une
// lecture, c'est un inventaire — et le coach décroche.
const MORPHO_PROFILS_MAX=3;
const MORPHO_ORDRE=Object.freeze({acquis:0,fonctionnel:1,osseux:2});
// Le sujet de chaque fiche osseuse, pour la phrase de renvoi.
const MORPHO_SUJET=Object.freeze({P1:'le fémur',P2:'le tronc',P3:'le tibia',
  P4:'les bras',P5:'les bras',P6:'la charpente',P7:'la charpente',P8:'l’ossature'});
// Ce qu'on nomme quand on renvoie vers un axe fonctionnel ou acquis, et ce
// qu'on dit quand il n'a jamais été mesuré.
const MORPHO_RENVOI=Object.freeze({A7:'la cheville',
  A8:'les amplitudes articulaires',A9:'le carnet'});
const MORPHO_RENVOI_ABSENT=Object.freeze({
  A7:'la cheville n’a pas été mesurée, et le test du genou au mur prend trente secondes',
  A8:'ni la hanche, ni l’épaule, ni la flexion avant n’ont été testées',
  A9:'le carnet n’a pas encore assez de semaines entraînées pour dire ce que la programmation explique déjà'});
// Ce qu'il faut avoir regardé avant de lire chaque fiche osseuse. L'ordre
// compte : on nomme le premier qui a quelque chose à dire.
const MORPHO_AVANT=Object.freeze({P1:['A7','A8','A9'],P2:['A7','A8','A9'],P3:['A7','A8','A9'],
  P4:['A8','A9'],P5:['A8','A9'],P6:['A9'],P7:['A9'],P8:['A9']});

/** PURE. De combien un axe sort de sa marge, en nombre de marges. Sert à
 *  classer les saillants « par écart au repère, décroissant ». Les axes
 *  qualitatifs — carnet, tests — n'ont pas de marge : ils comptent pour une. */
function _morphoEcart(a){
  if(!a||a.position==null||a.position==='neutre') return 0;
  if(a.valeur==null||a.repere==null||!a.marge) return 1;
  return Math.abs(a.valeur-a.repere)/a.marge;
}
/** PURE. La position d'un axe ou d'une de ses facettes. */
function _morphoPos(a,facette){
  if(!a) return null;
  if(!facette) return a.position;
  return (a.facettes&&a.facettes[facette])?a.facettes[facette].position:null;
}
function _morphoPerime(a,facette){
  if(!a) return false;
  if(!facette) return !!a.perime;
  return !!(a.facettes&&a.facettes[facette]&&a.facettes[facette].perime);
}

/**
 * PURE. Les profils composés à partir des neuf axes, et — tout aussi
 * important — ce qui manque pour en composer d'autres.
 *
 * @param {any[]} axes  la sortie de morphoAxes
 * @returns {{profils:any[], silence:string|null, saillants:any[],
 *            aRegarder:string[], aMesurer:string[], perime:string[]}}
 */
function morphoProfils(axes){
  const l=Array.isArray(axes)?axes:[];
  const parCle={}; l.forEach(a=>{ if(a&&a.cle) parCle[a.cle]=a; });
  const out={profils:[],silence:null,saillants:[],aRegarder:[],aMesurer:[],perime:[]};

  // Ce qu'il faudrait mesurer, quel que soit le reste : c'est la sortie la
  // plus utile quand il n'y a rien d'autre à dire.
  const vus={};
  l.forEach(a=>{
    if(a&&a.aMesurer&&!vus[a.aMesurer]){ vus[a.aMesurer]=1; out.aMesurer.push(a.aMesurer); }
    if(a&&a.manque==='repere-a-calibrer'){
      const t='un repère calibré pour « '+a.court+' » : il faut '+MORPHO_CALIB_MIN
        +' athlètes mesurés pour le poser';
      if(!vus[t]){ vus[t]=1; out.aMesurer.push(t); }
    }
    if(a&&a.manque==='desaccord'){
      const t='reprendre « '+a.court+' » : le mètre et la photo ne disent pas la même chose';
      if(!vus[t]){ vus[t]=1; out.aMesurer.push(t); }
    }
    if(a&&a.perime) out.perime.push(a.court);
  });

  // « Renseigné » veut dire CRU : une position posée sans confiance n'est pas
  // une donnée, et trois impressions ne valent pas mieux que deux.
  const renseignes=l.filter(a=>a&&a.position!=null&&a.confiance>=MORPHO_CONF_MIN-1e-9);
  out.saillants=l.filter(a=>a&&a.position!=null&&a.position!=='neutre'
    &&a.confiance>=MORPHO_CONF_MIN-1e-9)
    .slice().sort((x,y)=>_morphoEcart(y)-_morphoEcart(x));
  // SILENCE N° 1. Deux axes renseignés ne font pas un profil.
  if(renseignes.length<MORPHO_AXES_MIN){
    out.silence='moins-de-trois-axes';
    return out;
  }

  /** @type {any[]} */
  const trouves=[];
  for(const f of MORPHO_PROFILS){
    let ok=true, suspendu=false, confMin=1;
    for(const c of f.signature){
      const a=parCle[c.axe];
      if(!a){ ok=false; break; }
      if(c.dominance){
        if(!(a.dominances||[]).some(d=>d.cle===c.dominance)){ ok=false; break; }
      } else if(c.asymetrie){
        if(!(a.asymetries||[]).length){ ok=false; break; }
      } else {
        const p=_morphoPos(a,c.facette);
        if(p==null||c.positions.indexOf(p)<0){ ok=false; break; }
      }
      // SILENCE N° 2. Confiance sous 0,6 sur un axe de SIGNATURE — un axe
      // qu'on exige neutre ne signe rien, il conditionne : on ne lui demande
      // pas la même certitude.
      const exige=c.positions&&c.positions.indexOf('neutre')<0;
      if(exige&&a.confiance<MORPHO_CONF_MIN-1e-9){ ok=false; break; }
      if(exige) confMin=Math.min(confMin,a.confiance);
      // SILENCE N° 4. Un test périmé ne SUPPRIME pas le profil : il le
      // suspend, et l'app propose de refaire le test.
      if(_morphoPerime(a,c.facette)) suspendu=true;
    }
    if(!ok) continue;
    const ecart=f.signature.reduce((m,c)=>Math.max(m,_morphoEcart(parCle[c.axe])),0);
    trouves.push({fiche:f,suspendu,confiance:Math.round(confMin*100)/100,ecart});
  }
  // L'ORDRE DE LECTURE, puis l'écart au repère.
  trouves.sort((x,y)=>(MORPHO_ORDRE[x.fiche.nature]-MORPHO_ORDRE[y.fiche.nature])
    ||(y.ecart-x.ecart));

  // LA PHRASE DE RENVOI. Un profil osseux dont le segment porte un axe
  // fonctionnel saillant ne se lit pas seul, et le dit lui-même.
  const aSaillant=(a)=>out.saillants.indexOf(a)>=0;
  for(const t of trouves){
    const f=t.fiche;
    let avant=null;
    if(f.nature==='osseux'){
      const sujet=MORPHO_SUJET[f.cle]||'ce point';
      const ordre=MORPHO_AVANT[f.cle]||['A9'];
      // D'abord ce qui SORT : un axe saillant se nomme, avec sa valeur.
      const vu=ordre.map(k=>parCle[k]).find(a=>a&&aSaillant(a));
      if(vu) avant='Regarde '+(MORPHO_RENVOI[vu.cle]||vu.court.toLowerCase())
        +' avant de conclure sur '+sujet+' : '+vu.texte;
      else {
        // Sinon ce qui MANQUE : un levier ne s'invoque pas quand l'amplitude
        // du même segment n'a jamais été mesurée.
        const trou=ordre.find(k=>{ const a=parCle[k];
          return !a||a.position==null||a.confiance<MORPHO_CONF_MIN-1e-9; });
        if(trou&&MORPHO_RENVOI_ABSENT[trou])
          avant='Avant de conclure sur '+sujet+' : '+MORPHO_RENVOI_ABSENT[trou]+'.';
      }
    }
    out.profils.push({cle:f.cle,lib:f.lib,nature:f.nature,segment:f.segment,axes:f.axes,
      signatureTexte:f.signatureTexte,mecanique:f.mecanique,privilegier:f.privilegier,
      amenager:f.amenager,accent:f.accent,specificite:f.specificite,piege:f.piege,
      confiance:t.confiance,suspendu:t.suspendu,avant});
  }
  if(out.profils.length>MORPHO_PROFILS_MAX) out.profils.length=MORPHO_PROFILS_MAX;

  // CE QU'IL FAUT REGARDER, dans l'ordre. Les axes saillants d'abord par
  // nature, et rien d'inventé : chaque ligne est le texte d'un axe, avec sa
  // source et sa date.
  out.aRegarder=out.saillants.slice()
    .sort((x,y)=>(MORPHO_ORDRE[x.nature]-MORPHO_ORDRE[y.nature])||(_morphoEcart(y)-_morphoEcart(x)))
    .map(a=>a.court+' : '+a.texte);
  // SILENCE N° 5 ET 6 sont déjà rendus par morphoAxes — un mineur n'a aucun
  // axe osseux, une asymétrie dans le bruit n'existe pas. Il reste le cas le
  // plus fréquent, et c'est un résultat valide : aucune fiche ne correspond,
  // on présente LES AXES NUS, sans nom de profil.
  if(!out.profils.length) out.silence='aucun-profil-marque';
  return out;
}

/**
 * Les athlètes suivis par le coach courant, pour le calibrage. Non pure : elle
 * lit le cache. Le calibrage, lui, l'est — et c'est lui qui est testé.
 */
function _morphoAthletesDuCoach(){
  if(!currentUser||currentUser.role!=='coach') return [];
  const users=DB.get('users')||{};
  return Object.values(users).filter(u=>u&&u.coachId===currentUser.id&&u.role!=='coach');
}
/** Le calibrage du coach courant, calculé une fois par écran. */
function morphoCalibrageCoach(){
  try{ return morphoCalibrage(_morphoAthletesDuCoach()); }catch(e){ return {}; }
}
// ══ LOT T4 : LA REVUE MORPHO DU PROGRAMME (29/09/2026) ═══════════════════
// Le programme de l'athlète, passé au crible des aménagements de SES profils
// (morphoProfils) : quels exercices ont un réglage à envisager, lequel, et
// d'où il vient.
//
// ⚠ L'APPARIEMENT SE FAIT SUR LE MOUVEMENT, PAS SUR LE NOM : l'exercice passe
//   par schemaDe (la table des schémas moteurs du catalogue, alias compris),
//   et se compare au « schema » de chaque aménagement. « Squat », « squat à la
//   smith » et « hack squat » relèvent du même schéma.
// ⚠ AUCUN EXERCICE N'EST À RETIRER, AUCUN N'EST EN ROUGE : chaque ligne porte
//   un réglage, et le texte vient du champ « amenager » des fiches (G1).
// ⚠ L'ORDRE DE LECTURE EST IMPOSÉ : acquis, puis fonctionnel, puis osseux.
//   Et avant le premier levier, ce qui manque aux amplitudes est DIT : sans
//   ça, on attribuerait à la morphologie ce qui relève de la mobilité.
const REVUE_MORPHO_MAX=5;
// PURE. De combien les mots de l'aménagement (« Squat barre haute profond »)
// se retrouvent dans le nom de l'exercice. Sert à garder, quand deux profils
// visent le même schéma, l'aménagement le plus SPÉCIFIQUE.
function _revueSpecificite(quoi,nom){
  let q=[], n='';
  try{ q=exKey(quoi).split(' ').filter(w=>w.length>=4); n=' '+exKey(nom)+' '; }catch(e){ return 0; }
  return q.filter(w=>n.indexOf(' '+w+' ')>=0).length;
}
/**
 * PURE. La revue : une ligne par exercice concerné, dans l'ordre de lecture.
 * @param programme  sessions_config (les séances et leurs exercices)
 * @param profils    morphoProfils(...).profils, éventuellement portant « source »
 * @param amplitudes testsMorpho(...) : les tests manquants ou périmés sont
 *                   notés sur les lignes OSSEUSES (amplitudesManquantes)
 * @param opts       {schemaDe: ex → schéma} pour les tests ; schemaDe sinon
 * @returns {{exercice,seance,profil,quoi,reglage,schema,source,nature,suspendu,amplitudesManquantes}[]}
 */
function revueMorpho(programme,profils,amplitudes,opts){
  const o=opts||{};
  const sch=(typeof o.schemaDe==='function')?o.schemaDe:(ex=>schemaDe(ex,o.user));
  const P=Array.isArray(profils)?profils.filter(p=>p&&Array.isArray(p.amenager)):[];
  const manquent=(Array.isArray(amplitudes)?amplitudes:[]).filter(t=>t&&(!t.date||t.perime)).map(t=>t.lib);
  if(!P.length) return [];
  const out=[];
  (Array.isArray(programme)?programme:[]).forEach((s,is)=>{
    if(!s||s.active===false) return;
    for(const ex of (Array.isArray(s.exercises)?s.exercises:[])){
      const nom=String((ex&&ex.name)||'').trim();
      if(!nom) continue;
      let k=null; try{ k=sch(ex); }catch(e){ k=null; }
      if(!k) continue;
      let m=null;
      P.forEach((p,ip)=>{ for(const am of p.amenager){
        if(!am||am.schema!==k) continue;
        const sc=_revueSpecificite(am.quoi,nom);
        if(!m||sc>m.sc||(sc===m.sc&&ip<m.ip)) m={sc,ip,p,am};
      }});
      if(!m) continue;
      out.push({exercice:nom,seance:String(s.name||s.day||('Séance '+(is+1))),profil:m.p.cle,
        quoi:m.am.quoi,reglage:m.am.reglage,schema:k,
        source:{lib:m.p.lib,attribut:m.p.source||''},nature:m.p.nature||'osseux',suspendu:!!m.p.suspendu,
        amplitudesManquantes:(m.p.nature==='osseux')?manquent.slice():[],_o:MORPHO_ORDRE[m.p.nature]||0,_sc:m.sc,_ip:m.ip});
    }
  });
  out.sort((a,b)=>(a._o-b._o)||(b._sc-a._sc)||(a._ip-b._ip));
  return out.map(x=>{ const y=Object.assign({},x); delete y._o; delete y._sc; delete y._ip; return y; });
}
// PURE. Les lignes regroupées : un même aménagement d'un même profil ne se
// répète pas exercice par exercice, il nomme les exercices qu'il concerne.
function _revueGrouper(lignes){
  const g=[], vu={};
  for(const l of (lignes||[])){
    const k=l.profil+'|'+l.quoi;
    if(vu[k]){
      if(vu[k].exercices.indexOf(l.exercice)<0) vu[k].exercices.push(l.exercice);
      if(vu[k].seances.indexOf(l.seance)<0) vu[k].seances.push(l.seance);
      continue;
    }
    vu[k]=Object.assign({},l,{exercices:[l.exercice],seances:[l.seance]});
    g.push(vu[k]);
  }
  return g;
}
/**
 * PURE. La section de la fiche. « etat » : {lignes, bloques:[{court,n}], profilsSortis}.
 * Rend '' seulement quand il n'y a RIEN de morpho à dire (aucun profil, rien
 * en attente de calibrage) : sinon elle dit ce qu'elle voit, ou ce qui manque.
 */
function htmlRevueMorpho(etat){
  const e=etat||{}, E=escapeHtml;
  const g=_revueGrouper(e.lignes||[]).slice(0,REVUE_MORPHO_MAX);
  const bloques=Array.isArray(e.bloques)?e.bloques:[];
  if(!g.length&&!bloques.length&&!e.profilsSortis) return '';
  let h='<div class="rvm"><div class="rvm-t">À aménager dans son programme</div>'
    +'<div class="rvm-s">Des réglages à envisager sur ses exercices, jamais un exercice à retirer. Dans l’ordre de lecture : le carnet, les amplitudes, puis les leviers.</div>';
  let noteFaite=false;
  for(const l of g){
    if(l.nature==='osseux'&&!noteFaite&&l.amplitudesManquantes&&l.amplitudesManquantes.length){
      noteFaite=true;
      h+='<div class="rvm-avant">Avant de lire les leviers : '+E(l.amplitudesManquantes.join(', ').toLowerCase())
        +(l.amplitudesManquantes.length>1?' ne sont pas testés':' n’est pas testé')
        +' (ou le test a plus de trois mois). Un manque de mobilité se prend vite pour une affaire de proportions.</div>';
    }
    h+='<div class="rvm-l"><div class="rvm-ex">'+E(l.exercices.join(', '))
      +' <span>· '+E(l.seances.join(', '))+'</span></div>'
      +'<div class="rvm-r"><b>'+E(l.quoi)+' :</b> '+E(l.reglage)+'</div>'
      +'<div class="rvm-src">'+E(l.source&&l.source.lib||'')+(l.source&&l.source.attribut?' '+E(l.source.attribut):'')
      +(l.suspendu?' · test à refaire':'')+'</div></div>';
  }
  if(!g.length&&e.profilsSortis)
    h+=emptyState('','Aucun exercice de son programme ne relève des aménagements de ses profils.',null,null,'padding:12px 0');
  if(bloques.length)
    h+='<div class="rvm-manque">Une partie de la lecture des leviers attend un repère calibré sur tes athlètes : '
      +bloques.map(b=>E(b.court)+', '+b.n+' athlète'+(b.n>1?'s':'')+' mesuré'+(b.n>1?'s':'')+' sur '+MORPHO_CALIB_MIN
        +' (il en reste '+Math.max(0,MORPHO_CALIB_MIN-b.n)+')').join(' ; ')+'.</div>';
  return h+'</div>';
}
// La fiche du coach : les profils de l'athlète, la source de chacun (le dernier
// axe de sa signature, avec sa date et sa tolérance), et ce qui attend un
// repère. « athletes » : ceux du coach, pour compter les mesurés.
// `programme` (C4) : les séances d'un modèle, lues avec SES profils à lui.
function _etatRevueMorpho(c,cal,athletes,programme){
  let axes=[], res={profils:[]};
  try{ axes=morphoAxes(c,{calibrage:cal||null}); res=morphoProfils(axes); }catch(e){ return {lignes:[],bloques:[],profilsSortis:false}; }
  const par={}; axes.forEach(a=>{ if(a&&a.cle) par[a.cle]=a; });
  const profils=(res.profils||[]).map(p=>{
    const ax=(p.axes||[]).map(k=>par[k]).filter(a=>a&&a.position!=null).sort((x,y)=>String(y.dateISO||'').localeCompare(String(x.dateISO||'')));
    const a0=ax[0];
    return Object.assign({},p,{source:a0?_morphoAttribut(a0.source,a0.dateISO,a0.tolerance):''});
  });
  let tests=[]; try{ tests=testsMorpho(c); }catch(e){ tests=[]; }
  const lignes=revueMorpho((Array.isArray(programme)?programme:(c&&c.sessions_config))||[],profils,tests,{user:c});
  const l=Array.isArray(athletes)?athletes:[];
  const bloques=axes.filter(a=>a&&a.manque==='repere-a-calibrer').map(a=>({court:a.court,
    n:l.filter(u=>{ try{ const r=_morphoBrut(u,a.cle); return !!(r&&r.valeur!=null&&isFinite(r.valeur)); }catch(e){ return false; } }).length}));
  return {lignes,bloques,profilsSortis:profils.length>0};
}
function renderRevueMorphoCoach(c){
  const z=document.getElementById('ccd-revue-morpho');
  if(!z) return false;
  if(!currentUser||currentUser.role!=='coach'){ z.innerHTML=''; return false; }
  let h='';
  try{ h=htmlRevueMorpho(_etatRevueMorpho(c,_morphoCalCache(),_morphoAthletesDuCoach())); }catch(e){ h=''; }
  z.innerHTML=h;
  return !!h;
}


// ══════════════ MORPHO — LOT M5 : QUATRE ENTRÉES ══════════════
//
// Un profil qui ne change rien au programme du lundi ne sert à rien. Quatre
// endroits, et quatre seulement : la fiche coach, le choix d'exercice, le
// réglage, et le suivi du bilan.
//
// ⚠ G7 — RIEN NE DESCEND CÔTÉ ATHLÈTE, SAUF LA CONSIGNE D'EXÉCUTION.
//   « Cale de 2,5 cm sous les talons » est une consigne : utile, neutre,
//   exécutable. « Parce que tu as les fémurs longs » ne l'est pas. Un athlète
//   seul face à une phrase sur son squelette ne peut rien en faire d'autre que
//   s'en inquiéter — et le coach perd la conversation que cette phrase devait
//   ouvrir. Les fonctions de rendu de ce lot sont donc TOUTES gardées par le
//   rôle, et le réglage est la seule chose qui traverse.
//
// L'étude propose d'entrer aussi dans le bilan, côté athlète, pour lui
// rappeler « l'instrument de suivi pertinent pour son profil ». On ne le fait
// pas là : nommer un profil dans l'écran de saisie de l'athlète, c'est
// exactement ce que G7 interdit. L'instrument de suivi est rendu AU COACH,
// dans la fiche, à côté des mensurations qu'il lit.

// La largeur de prise au développé : 180 à 200 % de la largeur biacromiale.
// C'est le seul repère chiffré de programmation du document — et il ne devient
// actionnable que parce que A5 mesure la charpente. Affiché en INTERVALLE :
// « 1,9 × » donnerait une fausse précision à un repère qui est une plage.
const MORPHO_PRISE_MIN=1.8;
const MORPHO_PRISE_MAX=2.0;
// La cale sous les talons : effet à partir d'environ 2,5 cm, et effet dose
// au-delà. Elle n'est pas gratuite — elle réduit l'amplitude de hanche et de
// tronc. C'est écrit là où elle est proposée.
const MORPHO_CALE_CM=2.5;

/**
 * PURE. Les réglages que les axes rendent actionnables. Chacun porte SA
 * VALEUR, SA SOURCE et les schémas moteurs qu'il concerne — un réglage sans
 * schéma s'afficherait sur le curl comme sur le squat.
 * @param {any[]} axes  sortie de morphoAxes
 * @param {any[]} profils  sortie de morphoProfils().profils
 * @returns {{cle:string, lib:string, consigne:string, pourquoi:string, schemas:string[]}[]}
 */
function morphoReglages(axes,profils){
  const out=[];
  const l=Array.isArray(axes)?axes:[];
  const p=Array.isArray(profils)?profils:[];
  const par={}; l.forEach(a=>{ if(a&&a.cle) par[a.cle]=a; });
  const aP=(cle)=>p.some(x=>x.cle===cle);

  // LA PRISE AU DÉVELOPPÉ. Elle ne sort que si la largeur d'épaules a été
  // mesurée : un pourcentage sans la mesure qu'il multiplie est une phrase de
  // magazine.
  const a5=par['A5'];
  const largeur=(a5&&a5.epaulesCm)?a5.epaulesCm:null;
  if(largeur&&(aP('P4')||aP('P11')||aP('P5'))){
    const bas=Math.round(largeur*MORPHO_PRISE_MIN), haut=Math.round(largeur*MORPHO_PRISE_MAX);
    out.push({cle:'prise',lib:'Largeur de prise au développé',
      consigne:'Prise entre '+bas+' et '+haut+' cm, index à index.',
      pourquoi:'Le repère de performance se situe entre '+Math.round(MORPHO_PRISE_MIN*100)+' et '
        +Math.round(MORPHO_PRISE_MAX*100)+' % de la largeur d’épaules, soit '+largeur
        +' cm ici '+(a5.dateISO?'(mètre, '+_morphoJJMM(a5.dateISO)+')':'(mètre)')
        +'. À vérifier en séance : c’est une plage, pas un chiffre.',
      schemas:['poussee-horizontale']});
  }
  // LA CALE. Deux voies, et l'app dit laquelle elle propose.
  const a7=par['A7'];
  if(a7&&a7.position==='bas'){
    out.push({cle:'cale',lib:'Cale sous les talons',
      consigne:'Cale d’au moins '+String(MORPHO_CALE_CM).replace('.',',')+' cm sous les talons.',
      pourquoi:a7.texte+'. C’est un contournement, pas un traitement : la cale permet de '
        +'s’entraîner aujourd’hui, le travail d’amplitude de ne plus en avoir besoin, et les '
        +'deux se mènent en parallèle. Ce n’est pas gratuit : une élévation importante réduit '
        +'l’amplitude de hanche et de tronc : on déplace le travail vers le quadriceps, on ne l’ajoute pas.',
      schemas:['squat','fente']});
  }
  // LE STANCE. Il se trouve en salle, par paliers — pas au mètre.
  if(aP('P1')||aP('P10')){
    out.push({cle:'stance',lib:'Écartement et pointes',
      consigne:'Stance élargi, pointes ouvertes, à chercher par paliers à charge légère.',
      pourquoi:'La profondeur confortable se note à chaque palier ; on garde celle où il n’y a '
        +'pas de pincement. Le stance ne se déduit d’aucune mesure.',
      schemas:['squat']});
  }
  // LE DÉPART SURÉLEVÉ. Charger dans l'amplitude disponible, et la faire
  // remonter — pas l'inverse.
  if(aP('P12')){
    out.push({cle:'depart',lib:'Hauteur de départ au soulevé',
      consigne:'Barre surélevée jusqu’à la hauteur où le dos tient sans s’enrouler.',
      pourquoi:'L’amplitude manquante se travaille, elle ne se contourne pas par la variante : '
        +'on charge dans ce qui est disponible et on redescend la barre à mesure.',
      schemas:['charniere-hanche']});
  }
  return out;
}
/** PURE. « 12/09 » à partir d'un ISO court. */
function _morphoJJMM(iso){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  return m?m[3]+'/'+m[2]:String(iso||'');
}

/**
 * PURE. L'INSTRUMENT DE SUIVI. Sur certains profils, le centimètre ment — et
 * le dire au coach vaut mieux que de le laisser conclure à une stagnation.
 * @returns {string}
 */
function morphoInstrument(profils){
  const p=Array.isArray(profils)?profils:[];
  const a=(cle)=>p.some(x=>x.cle===cle);
  if(a('P8')&&a('P6'))
    return 'Ossature fine et charpente étroite : suivre le rapport taille/bras et la photo à '
      +'éclairage constant plutôt que les circonférences seules. Sur ce profil, le tour de bras '
      +'peut stagner pendant que la silhouette change complètement.';
  if(a('P8'))
    return 'Avec moins d’os, il faut plus de muscle pour le même chiffre au mètre : croiser avec '
      +'la photo et la charge soulevée, sinon le centimètre donnera l’impression d’une stagnation '
      +'qui n’existe pas.';
  if(a('P6'))
    return 'La charpente ne bouge pas avec le gras : suivre la photo à éclairage constant, et ne '
      +'pas lire un tour de taille comme une largeur d’épaules.';
  if(a('P7'))
    return 'À masse musculaire égale, les circonférences partent de plus haut et progressent moins '
      +'vite en pourcentage : les objectifs de tour de bras se recalibrent à la hausse.';
  if(a('P14'))
    return 'Réévaluation à trois bilans : un écart gauche / droite qui ne bouge pas malgré le '
      +'travail unilatéral n’a pas besoin d’un quatrième cycle d’insistance.';
  return '';
}

/**
 * La lecture morpho d'UN exercice, pour le coach qui le pose dans une séance.
 * Rend ce qu'il faut dire et rien d'autre : le profil concerné, son
 * aménagement AVEC son réglage, les variantes du même schéma, et le réglage
 * chiffré s'il en existe un.
 *
 * @param {any} user  l'athlète
 * @param {any} ex    l'exercice, ou son nom
 * @param {{calibrage?:any}} [opts]
 */
function morphoPourExercice(user,ex,opts){
  const vide={schema:null,lignes:[],variantes:[],reglages:[]};
  let schema=null;
  try{ schema=schemaDe(ex,user); }catch(e){ schema=null; }
  if(!schema) return vide;
  let axes=[],res={profils:[]};
  try{ axes=morphoAxes(user,opts); res=morphoProfils(axes); }catch(e){ return vide; }
  const lignes=[];
  for(const p of res.profils){
    for(const am of (p.amenager||[])){
      if(am.schema!==schema) continue;
      lignes.push({profil:p.cle,lib:p.lib,quoi:am.quoi,reglage:am.reglage,
        suspendu:!!p.suspendu,avant:p.avant||null});
    }
  }
  const reglages=morphoReglages(axes,res.profils).filter(r=>r.schemas.indexOf(schema)>=0);
  if(!lignes.length&&!reglages.length) return {schema,lignes:[],variantes:[],reglages:[]};
  let variantes=[];
  try{ variantes=_variantesSchema(schema,4).filter(n=>exKey(n)!==exKey((ex&&ex.name)||ex||'')); }catch(e){}
  return {schema,lignes,variantes:variantes.slice(0,3),reglages};
}

/**
 * Le bandeau morpho d'une carte d'exercice, dans l'éditeur de séance.
 * ⚠ CÔTÉ COACH SEULEMENT, et la garde est ICI : l'éditeur est PARTAGÉ avec
 *   l'athlète, qui y ouvre ses propres séances. Une garde qui ne vivrait que
 *   dans l'appelant n'en serait pas une.
 */
function _htmlMorphoExercice(ex){
  if(!currentUser||currentUser.role!=='coach'||!currentClientId) return '';
  let c=null;
  try{ c=getOwnedClient(currentClientId); }catch(e){ c=null; }
  if(!c) return '';
  let r=null;
  try{ r=morphoPourExercice(c,ex,{calibrage:_morphoCalCache()}); }catch(e){ return ''; }
  if(!r||(!r.lignes.length&&!r.reglages.length)) return '';
  const bloc=(titre,corps)=>'<div style="margin-bottom:8px">'
    +'<span style="color:var(--sub);font-weight:800">'+escapeHtml(titre)+' :</span> '
    +'<span style="color:var(--text-dim)">'+corps+'</span></div>';
  let h='';
  r.lignes.forEach(x=>{
    h+=bloc(x.quoi,escapeHtml(x.reglage)
      +(x.suspendu?' <span style="color:var(--orange)">(test à refaire)</span>':''));
    if(x.avant) h+='<div style="color:var(--text-faint);margin-bottom:8px">'+escapeHtml(x.avant)+'</div>';
  });
  r.reglages.forEach(x=>{
    h+=bloc(x.lib,'<span style="color:var(--text-strong);font-weight:700">'+escapeHtml(x.consigne)
      +'</span> '+escapeHtml(x.pourquoi));
  });
  if(r.variantes.length)
    h+=bloc('Variantes du même schéma',escapeHtml(r.variantes.join(', '))
      +' : à envisager à côté, jamais à la place.');
  return '<div style="background:var(--surface-0);border:1px solid var(--border);border-left:1px solid var(--border);'
    +'border-radius:var(--r-2);padding:10px 12px;margin:0 0 12px;font-size:var(--fs-xs);line-height:1.6">'
    +'<div style="color:var(--sub);letter-spacing:1.2px;font-weight:800;text-transform:uppercase;'
    +'margin-bottom:6px;font-size:var(--fs-2xs)">Proportions : pour toi, pas pour lui</div>'+h+'</div>';
}
/** Le calibrage, calculé une fois par rendu d'écran et non par carte. */
let _morphoCal=null, _morphoCalT=0;
function _morphoCalCache(){
  const now=Date.now();
  if(_morphoCal&&now-_morphoCalT<30000) return _morphoCal;
  _morphoCal=morphoCalibrageCoach(); _morphoCalT=now;
  return _morphoCal;
}

/**
 * LA FICHE COACH — premier point d'entrée. Les axes, les profils composés, et
 * ce qu'il resterait à mesurer.
 *
 * ⚠ ZONE DE LECTURE. Aucun bouton, aucun onclick, et RIEN DU TOUT quand il n'y
 *   a rien à dire : le relevé des amplitudes se fait dans l'onglet Données.
 * ⚠ Rien de ceci n'est rendu côté athlète — un test le vérifie sur le HTML
 *   produit par l'accueil et l'écran de progression.
 */
function _htmlMorphoLecture(user,cal){
  let axes=[],res=null;
  try{ axes=morphoAxes(user,{calibrage:cal||null}); res=morphoProfils(axes); }catch(e){ return ''; }
  if(!res) return '';
  // ⚠ RIEN À MONTRER, RIEN DE MONTRÉ. « Il manque la hauteur de genou »
  // est vrai de presque tous les dossiers : afficher ça seul ferait un
  // cadre permanent, et deux assertions l'interdisent depuis longtemps.
  if(!res.profils.length&&!res.aRegarder.length) return '';
  const E=escapeHtml;
  const titre=(t)=>'<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.2px;'
    +'font-weight:800;text-transform:uppercase;margin:14px 0 6px">'+E(t)+'</div>';
  let h='';
  // LOT T6 : UN TEST JAMAIS FAIT, DIT UNE FOIS, ici, en tête de la lecture :
  // c'est là qu'il bloque quelque chose.
  const _rel=(function(){ try{ return relanceAmplitudes(user&&user.morphoTests); }catch(e){ return ''; } })();
  if(_rel) h+='<div class="amp-relance">'+E(_rel)+'</div>';

  // LES PROFILS, dans l'ordre de lecture. Chacun porte sa phrase de renvoi
  // avant sa propre matière : « regarde la cheville avant de conclure ».
  if(res.profils.length){
    h+=titre('Profils composés');
    h+=res.profils.map(p=>{
      const am=(p.amenager||[]).map(a=>'<div style="margin-top:4px"><span style="color:var(--text-strong);'
        +'font-weight:700">'+E(a.quoi)+' :</span> <span style="color:var(--text-dim)">'
        +E(a.reglage)+'</span></div>').join('');
      return '<div style="border-left:1px solid var(--border);padding-left:12px;margin-bottom:14px">'
        +'<div style="font-size:var(--fs-sm);font-weight:800;color:var(--text-strong);line-height:1.5">'
        +E(p.lib)+(p.suspendu?' <span style="color:var(--orange);font-weight:700">· test à refaire</span>':'')
        +'</div>'
        +(p.avant?'<div style="font-size:var(--fs-sm);color:var(--orange);line-height:1.6;margin-top:4px;'
          +'font-weight:600">'+E(p.avant)+'</div>':'')
        +'<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin-top:4px">'
        +E(p.signatureTexte)+'</div>'
        +'<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-top:6px">'
        +E(p.mecanique)+'</div>'
        +'<div style="font-size:var(--fs-sm);line-height:1.6;margin-top:6px"><span style="color:var(--sub);'
        +'font-weight:800">Privilégier :</span> <span style="color:var(--text-dim)">'+E(p.privilegier)+'</span></div>'
        +(am?'<div style="font-size:var(--fs-sm);line-height:1.6;margin-top:6px"><span style="color:var(--sub);'
          +'font-weight:800">Aménager, jamais retirer :</span>'+am+'</div>':'')
        +'<div style="font-size:var(--fs-sm);line-height:1.6;margin-top:6px"><span style="color:var(--sub);'
        +'font-weight:800">Accent :</span> <span style="color:var(--text-dim)">'+E(p.accent)+'</span></div>'
        // LE PIÈGE EST AFFICHÉ. C'est la partie la plus utile de la fiche, et
        // celle qu'on serait tenté de garder pour soi.
        +'<div style="font-size:var(--fs-sm);line-height:1.6;margin-top:6px;background:var(--surface-0);'
        +'border-radius:var(--r-2);padding:8px 10px"><span style="color:var(--red);font-weight:800">'
        +'Le piège :</span> <span style="color:var(--text-dim)">'+E(p.piege)+'</span></div>'
        +'</div>';
    }).join('');
  } else if(res.silence==='moins-de-trois-axes'){
    h+=titre('Profils composés');
    h+='<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">Moins de trois axes '
      +'renseignés : deux axes ne font pas un profil, ils font une impression.</div>';
  } else if(res.silence==='aucun-profil-marque'){
    h+=titre('Profils composés');
    h+='<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">Aucun profil marqué : '
      +'c’est le résultat le plus fréquent, et c’en est un.</div>';
  }

  // CE QU'IL FAUT REGARDER, dans l'ordre imposé : acquis, fonctionnel, osseux.
  if(res.aRegarder.length){
    h+=titre('À regarder, dans cet ordre');
    h+=res.aRegarder.map((t,i)=>'<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;'
      +'margin-bottom:4px">'+(i+1)+'. '+E(t)+'</div>').join('');
  }
  // CE QU'IL RESTERAIT À MESURER. « Je ne sais pas encore » est une sortie de
  // première classe, et celle-ci est actionnable.
  // ⚠ UNE SEULE LIGNE, ET NON LA LISTE (lot 6, 23/09/2026 : « c'est
  //   decourageant, et c'est faux : il en manque rarement huit »). La premiere
  //   de la liste est deja celle qui debloque le plus — morphoAMesurer les rend
  //   dans cet ordre. Les suivantes reviendront d'elles-memes, une a une.
  if(res.aMesurer.length){
    h+=titre('Il manque, pour aller plus loin');
    h+='<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;'
      +'margin-bottom:4px">'+E(res.aMesurer[0])+'</div>';
    if(res.aMesurer.length>1)
      h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;'
        +'margin-top:4px">Celle-ci d’abord : '+(res.aMesurer.length-1)+' autre'
        +(res.aMesurer.length>2?'s':'')+' suivr'+(res.aMesurer.length>2?'ont':'a')
        +', une à la fois.</div>';
  }
  const inst=morphoInstrument(res.profils);
  if(inst){
    h+=titre('L’instrument de suivi');
    h+='<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">'+E(inst)+'</div>';
  }
  return h;
}


// ══════════════ MORPHO — LOT M6 : LA PHOTO, ET SES LIMITES ══════════════
//
// La photo n'apporte PAS de centimètres — voir le commentaire de mlMorphoPhoto
// dans motion-lab.js : sans le sommet du crâne, il n'y a pas d'échelle, et
// aucun coefficient crâne/taille n'est sourçable ici. Elle apporte deux
// RAPPORTS sans échelle, cuisse/jambe et humérus/avant-bras, pris d'un repère
// osseux à un repère osseux, sans ruban.
//
// ⚠ LE MÈTRE GAGNE TOUJOURS. Le rapport photo ne remplace jamais la mesure :
//   il la CONFIRME ou la CONTREDIT. Et quand il la contredit franchement —
//   l'un dit fémur dominant, l'autre tibia dominant — on ne tranche pas :
//   l'axe est suspendu et la reprise est demandée. C'est la règle §7.3 des
//   sources en désaccord, appliquée à la lettre.

/** Les deux rapports que la photo sait rendre, et l'axe qu'ils éclairent. */
const MORPHO_PHOTO_RAPPORTS=Object.freeze([
  {cle:'A2photo',axe:'A2',lib:'Cuisse sur jambe'},
  {cle:'A4photo',axe:'A4',lib:'Humérus sur avant-bras'}
]);
/** Une lecture de photo vaut ce que vaut une photo : la confiance de l'étude. */
const MORPHO_PHOTO_CONF=0.6;

/** PURE. Le rapport photo enregistré pour un axe, s'il existe. */
function _morphoRapportPhoto(user,axe){
  const src=(user&&user.morphoPhoto&&typeof user.morphoPhoto==='object')?user.morphoPhoto:null;
  const r=(src&&src.rapports&&typeof src.rapports==='object')?src.rapports:null;
  const d=MORPHO_PHOTO_RAPPORTS.find(x=>x.axe===axe);
  const v=(r&&d)?r[d.cle]:null;
  if(!v||!isFinite(Number(v.v))||!(Number(v.v)>0)) return null;
  return {cle:d.cle,lib:d.lib,valeur:Number(v.v),
    date:(isFinite(Number(v.date))&&Number(v.date)>0)?Math.round(Number(v.date)):null};
}

/**
 * Lit la photo de face du dernier bilan d'un athlète et enregistre ce qu'elle
 * dit. CÔTÉ COACH uniquement, et rien n'est écrit tant que le contrôle de
 * prise de vue n'est pas passé.
 */
async function lireMorphoPhoto(email){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!currentUser||c.coachId!==currentUser.id){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false;
  }
  const bl=(Array.isArray(c.bilans)?c.bilans:[]).filter(b=>b&&b.date).slice().sort((a,b)=>b.date-a.date);
  let src=null,dateBilan=null;
  for(const b of bl){
    // UNE SEULE PORTE DE LECTURE : photoBilanSrc connait les quatre
    // rangements qui ont existe, dont la reference neuve {cle,w,h,url}.
    const p=photoBilanSrc(b,'face');
    if(p){ src=p; dateBilan=b.date; break; }
  }
  if(!src){ toast('Aucune photo de face dans les bilans.','var(--orange)'); return false; }
  toast('Lecture de la photo…');
  try{ await chargerMotionLab(); }catch(e){ toast(e.message||'Motion Lab indisponible','var(--orange)'); return false; }
  const lire=/** @type {any} */(window).mlMorphoPhoto;
  if(typeof lire!=='function'){ toast('Lecture de photo indisponible','var(--orange)'); return false; }
  let r=null;
  try{ r=await lire(src); }catch(e){ r=null; }
  if(!r||!r.ok){
    toast(r&&r.code==='moteur'?'Le moteur de pose n’a pas pu se charger.'
      :r&&r.code==='personne'?'Aucune silhouette reconnue sur cette photo.'
      :'La photo n’a pas pu être lue.','var(--orange)');
    return false;
  }
  _morphoPhotoVue={email,date:dateBilan,prise:r.prise,rapports:r.rapports||[],
    pixels:r.pixels||null};
  if(!r.rapports||!r.rapports.length){
    _ampRendre();
    toast('Photo lue, mais rien n’en sort : '+(r.prise.raisons[0]||'prise de vue'),'var(--orange)');
    return false;
  }
  const out={};
  r.rapports.forEach(x=>{ out[x.cle]={v:x.valeur,date:dateBilan||Date.now()}; });
  const avant=(c.morphoPhoto&&typeof c.morphoPhoto==='object')?c.morphoPhoto:{};
  // LES PIXELS DE L'ECHELLE SONT GARDES AVEC LES RAPPORTS (lot 7) : ils ne
  // valent que pour CETTE photo, et sans eux il faudrait la relire a chaque
  // ouverture de l'ecran pour reafficher un centimetre.
  c.morphoPhoto=Object.assign({},avant,{rapports:out},
    r.pixels?{pixels:r.pixels,pixelsDate:dateBilan||Date.now()}:{});
  c.updatedAt=Date.now();
  users[email]=c;
  const ok=DB.set('users',users);
  _ampRendre();
  toastSync(ok,CLOUD.pushOne(email,c),'Photo lue '+ICO.coche,'la lecture de photo est');
  return true;
}
/** La dernière lecture, pour l'afficher sans la relire. @type {any} */
let _morphoPhotoVue=null;

// ══ LOT 7 : LA MESURE DU GENOU, ET L'ECHELLE DE LA PHOTO ═══════════════════
//
// Kevin, 23/09/2026 : « Une seule mesure nouvelle, au PREMIER bilan uniquement.
// Intitule exact : "Du sol au milieu de la rotule, pieds nus, dos au mur,
// jambes tendues." »
//
// POURQUOI CELLE-LA : c'est le seul repere que le ruban et la photo trouvent au
// MEME endroit. Le modele de pose rend le centre du genou, qui se projette au
// milieu de la rotule vu de face ; le sol est donne par le talon.
//
// ⚠ ET C'EST UNE MESURE NEUVE, PAS L'ANCIENNE REECRITE. `deb-genou` existe
//   depuis le lot M1 avec un tout autre protocole : « du sol au creux du
//   genou ». Le creux est DERRIERE la jambe, invisible de face, et deux a trois
//   centimetres plus bas que le centre articulaire. Changer la consigne sous la
//   meme cle aurait melange, dans la meme colonne, des mesures prises a deux
//   endroits differents — et personne n'aurait pu savoir laquelle est laquelle.
//   L'ancienne garde sa cle, ses valeurs et sa consigne ; la nouvelle porte la
//   sienne, et c'est elle qui met la photo a l'echelle.
const MORPHO_ROTULE='deb-rotule';
// LE SCHEMA DE LA MESURE, en SVG : le mur, le sol, la jambe tendue, et la
// fleche qui monte du sol au milieu de la rotule. Kevin : « avec un schema si
// tu peux ». Un protocole ecrit se lit de six facons ; un dessin en montre une.
const MORPHO_ROTULE_SCHEMA=
  '<svg viewBox="0 0 120 96" width="120" height="96" aria-hidden="true"'
  +' style="display:block;margin:2px 0 6px">'
  // le mur, a gauche, et le sol
  +'<path d="M14 4 V92" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none"/>'
  +'<path d="M6 92 H114" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>'
  // la jambe : cuisse, genou, tibia, pied nu au sol
  +'<path d="M46 10 V44" stroke="#8a8a8a" stroke-width="7" stroke-linecap="round" fill="none"/>'
  +'<path d="M46 52 V86" stroke="#8a8a8a" stroke-width="6" stroke-linecap="round" fill="none"/>'
  +'<path d="M43 88 H62" stroke="#8a8a8a" stroke-width="5" stroke-linecap="round" fill="none"/>'
  // la rotule, au milieu du genou
  +'<circle cx="46" cy="48" r="7" fill="#0c0c0c" stroke="var(--red)" stroke-width="2"/>'
  +'<circle cx="46" cy="48" r="1.8" fill="var(--red)"/>'
  // la fleche du sol au milieu de la rotule
  +'<path d="M86 48 V90 M82 86 l4 5 4-5 M82 52 l4-5 4 5" stroke="var(--red)"'
  +' stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  +'<path d="M50 48 H86" stroke="rgba(224,32,32,.45)" stroke-width="1"'
  +' stroke-dasharray="3 3" fill="none"/>'
  +'</svg>';
// LES SCHEMAS DES TROIS MESURES DU CHANTIER A12, dans le meme style : le mur,
// le sol, et la fleche de la mesure.
const _MORPHO_SVG=(corps)=>'<svg viewBox="0 0 120 96" width="120" height="96" aria-hidden="true" style="display:block;margin:2px 0 6px">'+corps+'</svg>';
const _MORPHO_FLECHE='stroke="var(--red)" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"';
const MORPHO_SCHEMAS=Object.freeze({
  rotule:MORPHO_ROTULE_SCHEMA,
  // Bras en croix contre le mur : du bout d'un majeur à l'autre.
  envergure:_MORPHO_SVG(
    '<path d="M6 92 H114" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>'
    +'<circle cx="60" cy="22" r="7" fill="none" stroke="#8a8a8a" stroke-width="3"/>'
    +'<path d="M60 30 V64 M60 64 L52 90 M60 64 L68 90" stroke="#8a8a8a" stroke-width="5" stroke-linecap="round" fill="none"/>'
    +'<path d="M14 38 H106" stroke="#8a8a8a" stroke-width="4" stroke-linecap="round" fill="none"/>'
    +'<path d="M12 50 H108 M16 46 l-4 4 4 4 M104 46 l4 4 -4 4" '+_MORPHO_FLECHE+'/>'
    +'<path d="M12 38 V52 M108 38 V52" stroke="rgba(224,32,32,.45)" stroke-width="1" stroke-dasharray="3 3" fill="none"/>'),
  // Le pied de profil, talon au mur : du mur au bout de l'orteil.
  pied:_MORPHO_SVG(
    '<path d="M18 10 V86" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none"/>'
    +'<path d="M6 86 H114" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>'
    +'<path d="M30 14 V58 C30 70 22 76 20 82 C20 85 22 86 26 86 H96 C102 86 104 82 98 78 C86 72 62 66 42 58" stroke="#8a8a8a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
    +'<path d="M20 70 H102 M24 66 l-4 4 4 4 M98 66 l4 4 -4 4" '+_MORPHO_FLECHE+'/>'),
  // Le buste de profil entre deux livres : du sternum au dos.
  thorax:_MORPHO_SVG(
    '<path d="M6 92 H114" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none"/>'
    +'<circle cx="60" cy="14" r="7" fill="none" stroke="#8a8a8a" stroke-width="3"/>'
    +'<path d="M46 26 C40 40 40 58 46 74 H72 C78 58 80 42 74 26 Z" stroke="#8a8a8a" stroke-width="3" fill="none" stroke-linejoin="round"/>'
    +'<rect x="30" y="30" width="7" height="30" rx="1" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/>'
    +'<rect x="83" y="30" width="7" height="30" rx="1" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2"/>'
    +'<path d="M38 45 H82 M42 41 l-4 4 4 4 M78 41 l4 4 -4 4" '+_MORPHO_FLECHE+'/>')
});
// ── L'ECHELLE, ET SON GARDE-FOU ────────────────────────────────────────────
//
// ⚠ LES 93 % NE DOIVENT JAMAIS ENTRER DANS UNE VALEUR AFFICHEE. C'est un
//   GARDE-FOU, pas une mesure : la hauteur des yeux vaut « environ » 93 % de la
//   taille debout, et cet « environ » couvre plusieurs centimetres d'un
//   individu a l'autre. Multiplier une taille par 0,93 pour en tirer un
//   centimetre serait inventer une mesure que personne n'a prise. Il ne sert
//   qu'a une chose : comparer DEUX echelles et refuser la photo quand elles se
//   contredisent. Toute autre utilisation est une faute, et ce commentaire est
//   la pour qu'elle ne se fasse pas par distraction.
const MORPHO_YEUX_PART=0.93;
// Au-dela, les deux echelles ne decrivent pas la meme photo : corps de profil,
// genou flechi, talon hors cadre, objectif trop pres. On ne publie rien.
const MORPHO_ECHELLE_ECART_MAX=0.04;
// La marge d'un centimetre issu de la photo ne descend jamais sous celle du
// ruban qui a servi a l'echelle : elle en herite.
const MORPHO_PHOTO_MARGE_MIN=0.5;
/**
 * PURE. L'echelle de la photo, ou la raison de n'en pas avoir.
 *
 * cm par pixel = mesure du genou (cm) / distance talon-genou (px).
 *
 * @param {any} u le dossier de l'athlete
 * @param {any} px la sortie de mlMorphoPixels
 * @returns {{cmPx:number,genouCm:number,genouPx:number,ecart:number|null,
 *            taille:number|null}|{motif:string}}
 */
function morphoEchellePhoto(u,px){
  if(!px||!(Number(px.genou)>0)) return {motif:'pixels'};
  const m=mesureMorpho(u,MORPHO_ROTULE);
  if(m.cm==null) return {motif:'mesure'};
  const cmPx=m.cm/px.genou;
  const taille=_tailleCm(u);
  // LE CONTROLE : la seconde echelle, tiree de la taille debout deja saisie.
  let ecart=null;
  if(taille&&Number(px.yeux)>0){
    const cmPx2=(taille*MORPHO_YEUX_PART)/px.yeux;
    ecart=Math.abs(cmPx2-cmPx)/((cmPx2+cmPx)/2);
    if(ecart>MORPHO_ECHELLE_ECART_MAX)
      return {motif:'divergence',ecart:Math.round(ecart*1000)/1000,
        taille:taille,genouCm:m.cm,genouPx:px.genou};
  }
  return {cmPx:cmPx,genouCm:m.cm,genouPx:px.genou,
    ecart:(ecart==null)?null:Math.round(ecart*1000)/1000,taille:taille};
}
// Les quatre segments que la photo sait mesurer une fois a l'echelle.
const MORPHO_PHOTO_SEGMENTS=Object.freeze([
  {cle:'cuisse',lib:'Cuisse (hanche au genou)'},
  {cle:'jambe',lib:'Jambe (genou à la cheville)'},
  {cle:'bras',lib:'Bras (épaule au coude)'},
  {cle:'avantbras',lib:'Avant-bras (coude au poignet)'}
]);
/**
 * PURE. Les longueurs en centimetres, ou rien.
 *
 * ⚠ LA MARGE N'EST PAS DECORATIVE : c'est l'ecart entre les deux echelles,
 *   porte sur la longueur, et jamais moins que le demi-centimetre du ruban qui
 *   a donne l'echelle. Sans second controle (pas de taille debout), la marge
 *   prend l'ecart maximal tolere : on ne fait pas passer une echelle non
 *   verifiee pour une echelle verifiee.
 * @returns {{cm:number,marge:number,lib:string,cle:string}[]}
 */
function morphoLongueursPhoto(u,px){
  const e=morphoEchellePhoto(u,px);
  if(e.motif) return [];
  const part=(e.ecart==null)?MORPHO_ECHELLE_ECART_MAX:Math.max(e.ecart,0.005);
  const out=[];
  for(const s of MORPHO_PHOTO_SEGMENTS){
    const n=Number(px[s.cle])||0;
    if(!(n>0)) continue;
    const cm=n*e.cmPx;
    out.push({cle:s.cle,lib:s.lib,cm:Math.round(cm*10)/10,
      marge:Math.round(Math.max(cm*part,MORPHO_PHOTO_MARGE_MIN)*10)/10});
  }
  return out;
}
// CE QUE L'ECRAN DIT DE L'ECHELLE : la valeur et sa source, ou le refus et sa
// raison. Jamais un centimetre quand les deux echelles se contredisent.
function _htmlMorphoEchelle(u,px){
  const E=escapeHtml;
  const e=morphoEchellePhoto(u,px);
  const cadre=(txt,couleur)=>'<p style="font-size:var(--fs-sm);line-height:1.6;'
    +'margin-bottom:10px;color:'+couleur+'">'+txt+'</p>';
  if(e.motif==='pixels')
    return cadre('Pas d’échelle : la photo ne montre pas le talon et le genou '
      +'des deux côtés, ou le corps est tourné.','var(--text-dim)');
  if(e.motif==='mesure')
    return cadre('Pas d’échelle : il manque la hauteur du sol au milieu de la '
      +'rotule, à prendre une fois au premier bilan.','var(--text-dim)');
  if(e.motif==='divergence')
    return cadre('Photo non exploitable : les deux repères ne donnent pas la '
      +'même échelle ('+E(_synNombre(e.ecart*100))+' % d’écart, au-delà des '
      +_synNombre(MORPHO_ECHELLE_ECART_MAX*100)+' % admis). Aucun centimètre '
      +'n’est publié. À refaire de face, bien en pied, talons visibles.','var(--orange)');
  const l=morphoLongueursPhoto(u,px);
  return cadre('Échelle : '+E(_synNombre(e.genouCm))+' cm du sol au milieu de la '
      +'rotule, sur '+E(_synNombre(e.genouPx))+' pixels'
      +((e.ecart!=null)?(', vérifiée à '+E(_synNombre(e.ecart*100))+' % près par la taille debout'):'')
      +'.','var(--text-dim)')
    +(l.length?('<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7;'
      +'margin-bottom:10px">'+l.map(x=>'<div>'+E(x.lib)+' : '+E(_synNombre(x.cm))
      +' cm, à ± '+E(_synNombre(x.marge))+' cm près</div>').join('')+'</div>'):'');
}
// ══ LOT 8 : L'ANALYSE MORPHO, AUTOMATIQUE ET FIGEE ═════════════════════════
//
// Kevin, 23/09/2026 : « Declenchement automatique a l'enregistrement du PREMIER
// bilan, quand les trois photos et la mesure du genou sont la. Aucun clic de
// l'athlete. Aux bilans suivants : rien. La morphologie d'un adulte ne bouge
// pas. »
//
// ⚠ CE QUI SORT : femur, tibia, humerus, avant-bras, tronc, en centimetres avec
//   leur marge, et les rapports.
// ⚠ CE QUI NE SORT PAS, ET CE N'EST PAS UN OUBLI : largeur d'epaules, largeur
//   de bassin, longueur de clavicule. Le modele de pose rend le CENTRE
//   ARTICULAIRE de l'epaule et de la hanche, pas l'acromion ni la crete
//   iliaque : une largeur prise entre deux centres articulaires est plus
//   courte de plusieurs centimetres, et la difference n'est pas constante d'un
//   corps a l'autre. La clavicule, elle, n'est detectee par rien. UNE ECHELLE
//   NE CORRIGE PAS UN POINT MAL PLACE : mise a l'echelle, une largeur fausse
//   devient une largeur fausse en centimetres. Si quelqu'un est tente d'en
//   ajouter une ici, la reponse est non, et elle est ecrite.
const MORPHO_INIT_SEGMENTS=Object.freeze([
  {cle:'femur',px:'cuisse',lib:'Fémur (hanche au genou)'},
  {cle:'tibia',px:'jambe',lib:'Tibia (genou à la cheville)'},
  {cle:'humerus',px:'bras',lib:'Humérus (épaule au coude)'},
  {cle:'avantbras',px:'avantbras',lib:'Avant-bras (coude au poignet)'},
  {cle:'tronc',px:'tronc',lib:'Tronc (épaules aux hanches)'}
]);
// Les largeurs interdites, nommees pour que la regle soit verifiable par un
// test et pas seulement lisible dans un commentaire.
const MORPHO_INIT_INTERDITS=Object.freeze(['epaules','bassin','clavicule']);
// Moins de vingt ans : il grandit encore. On PROPOSE de refaire, une fois par
// an, et seulement dans ce cas.
const MORPHO_INIT_AGE_CROISSANCE=20;
const MORPHO_INIT_AN=365*864e5;
/**
 * PURE. L'etat de l'analyse initiale d'un dossier.
 * 'gelee'   : elle a reussi, elle ne se refait plus jamais toute seule.
 * 'attente' : aucune photo n'est encore passee. On retentera au bilan suivant.
 * 'absente' : rien n'a encore ete tente.
 */
function morphoInitialeEtat(u){
  const m=u&&u.morphoInitiale;
  if(!m||typeof m!=='object') return 'absente';
  return (m.etat==='gelee')?'gelee':'attente';
}
// PURE. Vrai quand il faut (re)tenter : jamais si c'est gele.
function morphoInitialeARefaire(u){ return morphoInitialeEtat(u)!=='gelee'; }
/**
 * PURE. La photo de face sur laquelle lire, et le bilan d'ou elle vient.
 *
 * ⚠ LE PREMIER BILAN D'ABORD, MEME AU DIXIEME. C'est la morphologie INITIALE
 *   qu'on gele, et le premier bilan est celui ou la mesure du genou a ete
 *   prise. Si sa photo ne passe pas le controle, on prend la plus recente qui
 *   existe : un os ne change pas de longueur entre deux bilans, et « seulement
 *   le premier bilan » ne doit pas vouloir dire « une seule chance ».
 *
 * ⚠ ET IL FAUT LES TROIS PHOTOS, PAS SEULEMENT CELLE DE FACE. Kevin, le
 *   24/09/2026 : « garde le vert et le rouge et les 3 photos ». J'avais
 *   declenche sur la seule photo que l'analyse LIT ; la regle est qu'un bilan
 *   n'est complet qu'avec face, profil et dos, et une morphologie ne se gele
 *   pas sur un bilan a moitie rempli. Un bilan qui n'en porte que deux est
 *   saute ; l'etat reste « attente » et le suivant est essaye.
 * @returns {{src:string,date:number,depart:boolean}|null}
 */
function morphoPhotoInitiale(u,rang){
  let bl=[]; try{ bl=(Array.isArray(u&&u.bilans)?u.bilans:[]).filter(b=>b&&b.date); }catch(e){ return null; }
  bl=bl.filter(b=>{
    try{ return BILP_VUES.every(v=>photoBilanExiste(b,v)); }catch(e){ return false; }
  });
  if(!bl.length) return null;
  const dep=bl.filter(b=>b.type==='depart').sort((a,b)=>a.date-b.date);
  const reste=bl.filter(b=>b.type!=='depart').sort((a,b)=>b.date-a.date);
  const ordre=dep.concat(reste);
  const n=Math.max(0,Number(rang)||0);
  let vus=0;
  for(const b of ordre){
    let src=null;
    try{ src=photoBilanSrc(b,'face'); }catch(e){ src=null; }
    if(!src) continue;
    if(vus++<n) continue;
    return {src:src,date:Number(b.date)||0,depart:b.type==='depart'};
  }
  return null;
}
/**
 * PURE. Ce que l'analyse gele, a partir de ce que la photo a rendu.
 * Aucun octet d'image : la photo n'est designee que par la date de son bilan.
 * @returns {{etat:string,date:number,cmParPx:number,controleEcart:number|null,
 *            longueurs:Object,rapports:Object,photoRef:Object}
 *           |{etat:'attente',date:number,raison:string,essais:number}}
 */
function morphoInitialeDe(u,r,photo,essais){
  const n=Math.max(1,Number(essais)||1);
  const attente=(raison)=>({etat:'attente',date:Date.now(),raison:String(raison||''),essais:n});
  if(!r||!r.ok) return attente((r&&r.code==='personne')?'aucune silhouette reconnue'
    :(r&&r.code==='moteur')?'le moteur de pose ne s’est pas chargé':'la photo n’a pas pu être lue');
  const pr=r.prise||{};
  if(pr.verdict==='a_refaire')
    return attente('prise de vue à refaire'+((pr.raisons&&pr.raisons.length)?' : '+pr.raisons[0]:''));
  const px=r.pixels;
  if(!px) return attente('le talon et le genou ne sont pas visibles des deux côtés');
  const e=morphoEchellePhoto(u,px);
  if(e.motif==='mesure') return attente('il manque la hauteur du sol au milieu de la rotule');
  if(e.motif==='pixels') return attente('le talon et le genou ne sont pas visibles des deux côtés');
  if(e.motif==='divergence')
    return attente('les deux repères ne donnent pas la même échelle ('
      +_synNombre(e.ecart*100)+' % d’écart)');
  const longueurs={};
  const part=(e.ecart==null)?MORPHO_ECHELLE_ECART_MAX:Math.max(e.ecart,0.005);
  for(const s of MORPHO_INIT_SEGMENTS){
    const v=Number(px[s.px])||0;
    if(!(v>0)) continue;
    const cm=v*e.cmPx;
    longueurs[s.cle]={cm:Math.round(cm*10)/10,
      marge:Math.round(Math.max(cm*part,MORPHO_PHOTO_MARGE_MIN)*10)/10};
  }
  if(!Object.keys(longueurs).length) return attente('aucun segment lisible sur la photo');
  const rapports={};
  for(const x of (r.rapports||[])) if(x&&x.cle) rapports[x.cle]=x.valeur;
  return {etat:'gelee',date:Date.now(),
    cmParPx:Math.round(e.cmPx*10000)/10000,
    controleEcart:(e.ecart==null)?null:e.ecart,
    longueurs:longueurs,rapports:rapports,
    photoRef:{bilan:(photo&&photo.date)||0,vue:'face',depart:!!(photo&&photo.depart)},
    essais:n};
}
/**
 * L'analyse elle-meme : elle lit une photo, et n'ecrit rien.
 * @returns {Promise<any>} l'objet morphoInitiale a poser, ou null si rien a faire
 */
async function morphoAnalyserInitiale(u,rang){
  if(!u) return null;
  const photo=morphoPhotoInitiale(u,rang);
  if(!photo) return {etat:'attente',date:Date.now(),
    raison:'aucun bilan ne porte les trois photos',essais:(((u.morphoInitiale||{}).essais)||0)+1};
  try{ await chargerMotionLab(); }catch(e){
    return {etat:'attente',date:Date.now(),raison:'le moteur de pose ne s’est pas chargé',
      essais:(((u.morphoInitiale||{}).essais)||0)+1};
  }
  const lire=(typeof window!=='undefined')?window.mlMorphoPhoto:null;
  if(typeof lire!=='function') return {etat:'attente',date:Date.now(),
    raison:'lecture de photo indisponible',essais:(((u.morphoInitiale||{}).essais)||0)+1};
  let r=null;
  try{ r=await lire(photo.src); }catch(e){ r=null; }
  return morphoInitialeDe(u,r,photo,(((u.morphoInitiale||{}).essais)||0)+1);
}
/**
 * LE DECLENCHEMENT AUTOMATIQUE, a l'enregistrement d'un bilan.
 *
 * ⚠ IL NE BLOQUE RIEN. Le bilan est deja ecrit quand cette fonction part ; le
 *   chargement du moteur de pose prend plusieurs secondes et peut echouer.
 *   Si la page se ferme avant la fin, rien n'est ecrit et l'etat reste
 *   « attente » : on retentera au bilan suivant, ce qui est exactement la
 *   regle demandee.
 * ⚠ ET JAMAIS SUR UNE ANALYSE GELEE. « Aux bilans suivants : rien. »
 */
function morphoInitialePeutEtre(u){
  if(!u||!morphoInitialeARefaire(u)) return false;
  // La mesure du genou d'abord : sans elle il n'y a pas d'echelle, et charger
  // le moteur de pose pour s'en apercevoir serait plusieurs megaoctets pour
  // rien. Le lot 6 la reclame par ailleurs.
  if(mesureMorpho(u,MORPHO_ROTULE).cm==null) return false;
  if(!morphoPhotoInitiale(u,0)) return false;
  setTimeout(async()=>{
    try{
      const m=await morphoAnalyserInitiale(u,0);
      if(!m) return;
      const users=DB.get('users')||{};
      const cle=u.email;
      const dossier=(cle&&users[cle])||u;
      dossier.morphoInitiale=m;
      dossier.updatedAt=Date.now();
      if(cle){ users[cle]=dossier; DB.set('users',users); CLOUD.pushOne(cle,dossier); }
      if(currentUser&&currentUser.email===cle) currentUser.morphoInitiale=m;
    }catch(e){}
  },0);
  return true;
}
/**
 * LE GESTE DU COACH, et lui seul : « pour le cas ou la photo etait valide mais
 * mauvaise ». Jamais automatique, meme sur une analyse gelee.
 */
async function refaireMorphoInitiale(email){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!currentUser||c.coachId!==currentUser.id){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false;
  }
  if(mesureMorpho(c,MORPHO_ROTULE).cm==null){
    toast('Il manque la hauteur du sol au milieu de la rotule.','var(--orange)'); return false;
  }
  toast('Analyse de la photo…');
  // ⚠ ON PREND LA PHOTO SUIVANTE, pas la meme : « la photo etait valide mais
  //   mauvaise » veut dire qu'elle a passe le controle et qu'elle ne vaut rien.
  //   La relire donnerait le meme resultat.
  const rang=(c.morphoInitiale&&c.morphoInitiale.photoRef)?1:0;
  let m=null;
  try{ m=await morphoAnalyserInitiale(c,rang); }catch(e){ m=null; }
  if(!m||m.etat!=='gelee'){
    toast('Rien de lu : '+((m&&m.raison)||'la photo n’a pas pu être lue'),'var(--orange)');
    return false;
  }
  c.morphoInitiale=m;
  c.updatedAt=Date.now();
  users[email]=c;
  const ok=DB.set('users',users);
  try{ _ampRendre(); }catch(e){}
  toastSync(ok,CLOUD.pushOne(email,c),'Analyse refaite '+ICO.coche,'l’analyse est');
  return true;
}
// ── CE QUE L'ECRAN EN DIT ──────────────────────────────────────────────────
//
// ⚠ UN REPERE MANQUANT SE DIT AVEC SON COMPTE. « Un trou muet passe pour un
//   bug, un trou qui s'explique passe pour du serieux. » Et on n'importe
//   JAMAIS un repere trouve ailleurs pour debloquer un axe : on agrandit la
//   base, on ne pose pas un chiffre.
function morphoCalibrageCompte(athletes,cle){
  const l=Array.isArray(athletes)?athletes:[];
  let n=0;
  for(const u of l){
    let r=null;
    try{ r=_morphoRapportPhoto(u,cle); }catch(e){ r=null; }
    if(r) n++;
  }
  return n;
}
function _htmlMorphoInitiale(u,athletes){
  const E=escapeHtml;
  const etat=morphoInitialeEtat(u);
  const m=u&&u.morphoInitiale;
  const bouton='<button type="button" class="btn btn-outline" style="width:100%;margin:8px 0 0" '
    +'onclick="refaireMorphoInitiale(\''+escapeHtml((u&&u.email)||'')+'\')">Refaire l’analyse</button>';
  if(etat==='absente')
    return '<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin:0">'
      +'Analyse pas encore faite : elle part toute seule au premier bilan qui porte '
      +'une photo de face et la hauteur du sol au milieu de la rotule.</p>';
  if(etat==='attente')
    return '<p style="font-size:var(--fs-sm);color:var(--orange);line-height:1.6;margin:0">'
      +'Analyse en attente : '+E(m.raison||'la photo n’est pas exploitable')+'. '
      +'Elle sera retentée au prochain bilan, et à chaque bilan tant qu’aucune photo '
      +'ne passe.</p>'+bouton;
  const l=MORPHO_INIT_SEGMENTS.filter(s=>m.longueurs&&m.longueurs[s.cle]);
  const jour=(t)=>{ try{ return new Date(Number(t)||0).toLocaleDateString('fr-FR'); }catch(e){ return ''; } };
  let age=null; try{ age=ageActuel(u); }catch(e){ age=null; }
  const croissance=(age!=null&&age<MORPHO_INIT_AGE_CROISSANCE
    &&(Date.now()-(Number(m.date)||0))>MORPHO_INIT_AN);
  return '<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">'
    +l.map(s=>'<div>'+E(s.lib)+' : '+E(_synNombre(m.longueurs[s.cle].cm))+' cm, à ± '
      +E(_synNombre(m.longueurs[s.cle].marge))+' cm près</div>').join('')
    +'</div>'
    +'<p style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin:6px 0 0">'
    +'Lu une fois sur la photo de face du '+E(jour((m.photoRef&&m.photoRef.bilan)||m.date))
    +', mis à l’échelle par la hauteur du sol au milieu de la rotule'
    +((m.controleEcart!=null)?(', contrôlé à '+E(_synNombre(m.controleEcart*100))+' % près par la taille debout'):'')
    +'. Figé le '+E(jour(m.date))+' : la morphologie d’un adulte ne bouge plus.</p>'
    // LES RAPPORTS, ET CE QUI LEUR MANQUE POUR ETRE SITUES.
    +MORPHO_PHOTO_RAPPORTS.map(d=>{
      const v=m.rapports&&m.rapports[d.cle];
      if(v==null) return '';
      const n=morphoCalibrageCompte(athletes,d.axe);
      return '<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin:6px 0 0">'
        +E(d.lib)+' : '+E(String(Math.round(v*100)/100).replace('.',','))
        +((n<MORPHO_CALIB_MIN)
          ?(' · repère en cours de calibrage, '+n+' athlète'+(n>1?'s':'')+' sur '+MORPHO_CALIB_MIN)
          :'')+'</p>';
    }).join('')
    +(croissance
      ?('<p style="font-size:var(--fs-sm);color:var(--orange);line-height:1.6;margin:8px 0 0">'
        +'Moins de '+MORPHO_INIT_AGE_CROISSANCE+' ans et l’analyse a plus d’un an : '
        +'il grandit encore, tu peux la refaire.</p>')
      :'')
    +bouton;
}
/** Le bloc « photo » de l'écran des amplitudes. Côté coach, comme le reste. */
function _htmlMorphoPhoto(){
  if(!_amp) return '';
  const E=escapeHtml;
  const c=(DB.get('users')||{})[_amp.email]||{};
  const enr=[];
  MORPHO_PHOTO_RAPPORTS.forEach(d=>{
    const r=_morphoRapportPhoto(c,d.axe);
    if(r) enr.push(d.lib+' : '+String(Math.round(r.valeur*100)/100).replace('.',',')
      +(r.date?' (photo, '+dateLocaleDeCle(r.date).toLocaleDateString('fr-FR')+')':' (photo)'));
  });
  const vue=(_morphoPhotoVue&&_morphoPhotoVue.email===_amp.email)?_morphoPhotoVue:null;
  const pr=vue&&vue.prise;
  return '<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#bbb;margin-bottom:6px">'
    +'La photo de face</div>'
    +'<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-bottom:10px">'
    +'Elle rend deux rapports d’un repère osseux à l’autre, cuisse sur jambe et '
    +'humérus sur avant-bras. Elle rend aussi des centimètres, mais seulement '
    +'quand une mesure au ruban lui donne son échelle : du sol au milieu de la '
    +'rotule, prise une fois au premier bilan. Le mètre reste prioritaire : la '
    +'photo le confirme, ou le contredit.</p>'
    +_htmlMorphoEchelle(c,(c.morphoPhoto&&c.morphoPhoto.pixels)||(vue&&vue.pixels)||null)
    +(pr?'<p style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:10px;color:'
      +(pr.verdict==='bon'?'var(--green)':pr.verdict==='a_ameliorer'?'var(--orange)':'var(--red)')+'">'
      +'Prise de vue : '+(pr.verdict==='bon'?'bonne'
        :pr.verdict==='a_ameliorer'?'à améliorer':'à refaire')
      +(pr.raisons.length?', '+E(pr.raisons.join(' ; ')):'')+'</p>':'')
    +(enr.length?'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6;margin-bottom:10px">'
      +enr.map(t=>'<div>'+E(t)+'</div>').join('')+'</div>'
      :'<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-bottom:10px">'
      +'Rien de lu pour l’instant.</p>')
    +'<button type="button" class="btn btn-outline" style="width:100%;margin:0" '
    +'onclick="lireMorphoPhoto(\''+escapeHtml(_amp.email)+'\')">Lire la photo de face du dernier bilan</button>'
    +'</div>'
    // L'ANALYSE INITIALE, FIGEE (lot 8) : ce que la photo a donne une fois, et
    // qu'on ne recalcule plus. Le bouton « Refaire l'analyse » est cote coach,
    // et nulle part ailleurs.
    +'<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#bbb;margin-bottom:6px">'
    +'Ses longueurs, figées</div>'
    +_htmlMorphoInitiale(c,(function(){ try{ return getClients(); }catch(e){ return []; } })())
    +'</div>';
}

// ── LES TESTS D'AMPLITUDE (lot M1.2) ────────────────────────────────────────
//
// Quatre tests, côté COACH, avec leur protocole sous les yeux au moment de la
// saisie. Ce sont des nombres : ils tiennent sans peine dans le dossier de
// l'athlète, à côté de ses bilans.
//
// ⚠ AUCUN NE NOMME UNE CAUSE. On note ce qu'on voit — une distance, un angle,
// un arrêt net ou élastique — et rien de ce qui pourrait l'expliquer.

/** @type {{email:string, nom:string, v:any}|null} */
let _amp=null;

/**
 * Ouvre l'écran des tests pour un athlète. Même garde que partout ailleurs :
 * la fonction est globale, et une garde qui ne vit que dans l'appelant n'en
 * est pas une.
 */
function ouvrirAmplitudes(email){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!currentUser||c.coachId!==currentUser.id){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false;
  }
  const src=(c.morphoTests&&typeof c.morphoTests==='object')?c.morphoTests:{};
  // Une COPIE : tant que le coach n'a pas enregistré, le dossier ne bouge pas.
  _amp={email,nom:String(c.fname||c.email||''),v:JSON.parse(JSON.stringify(src))};
  go('s-coach-amplitudes');
  _ampRendre();
  return true;
}
/** @param {string} cle @param {string} champ @param {any} val */
function ampSaisie(cle,champ,val){
  if(!_amp) return false;
  const d=MORPHO_TESTS.find(x=>x.cle===cle);
  if(!d) return false;
  const o=Object.assign({},_amp.v[cle]||{});
  o[champ]=val;
  _amp.v[cle]=o;
  // Les boutons (butée, niveau) se redessinent ; les champs chiffrés, non —
  // redessiner sous les doigts ferait perdre le curseur.
  if(champ==='butee'||champ==='niveau'||champ==='mur') _ampRendre();
  else _ampMajEtat();
  return true;
}
/** PURE au sens du rendu : ce que l'écran doit dire d'un test saisi. */
function _ampEtatTest(d,v){
  const n=(x)=>{ const q=parseFloat(String(x==null?'':x).replace(',','.')); return isFinite(q)?q:null; };
  const bornes=[];
  const champs=d.champ==='paire'?['g','d']:d.champ==='cm'?['cm']:d.champ==='deg'?['deg']:[];
  let rempli=false;
  for(const k of champs){
    const q=n(v&&v[k]);
    if(q==null){ if(v&&String(v[k]||'').trim()!=='') bornes.push(k); continue; }
    rempli=true;
    if(q<d.min||q>d.max) bornes.push(k);
  }
  if(d.champ==='niveau') rempli=!!(v&&(d.niveaux||[]).includes(String(v.niveau||'')));
  if(d.mur&&v&&(v.mur==='oui'||v.mur==='non')) rempli=true;
  return {rempli,horsBornes:bornes.length>0};
}
function _ampMajEtat(){
  const b=document.getElementById('amp-enreg');
  if(!(b instanceof HTMLButtonElement)||!_amp) return;
  const mauvais=MORPHO_TESTS.some(d=>_ampEtatTest(d,_amp.v[d.cle]).horsBornes);
  b.disabled=mauvais;
  b.style.opacity=mauvais?'.4':'1';
}
function _ampRendre(){
  const z=document.getElementById('amp-contenu');
  if(!z||!_amp) return;
  const E=_amp;
  const num=(cle,champ,val,ph)=>'<input type="number" inputmode="decimal" step="any" value="'
    +escapeHtml(String(val==null?'':val))+'" placeholder="'+escapeHtml(ph||'-')+'" '
    +'oninput="ampSaisie(\''+cle+'\',\''+champ+'\',this.value)" '
    +'style="width:88px;min-height:44px;background:var(--surface-0);border:1px solid var(--border);'
    +'border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-weight:800;'
    +'font-size:var(--fs-md);text-align:center;padding:6px">';
  const bouton=(cle,champ,val,cour,lib)=>'<button type="button" onclick="ampSaisie(\''+cle+'\',\''+champ
    +'\',\''+cour+'\')" aria-pressed="'+(val===cour)+'" style="min-height:44px;padding:0 12px;'
    +'border-radius:var(--r-2);border:1px solid '+(val===cour?'var(--red)':'var(--border)')+';'
    +'background:'+(val===cour?'rgba(224,32,32,.12)':'none')+';color:var(--text);'
    +'font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer">'
    +escapeHtml(lib)+'</button>';
  const faits=testsMorpho((DB.get('users')||{})[E.email]);
  const htmlPhoto=(function(){ try{ return _htmlMorphoPhoto(); }catch(e){ return ''; } })();
  z.innerHTML='<div style="width:24px;height:2px;background:var(--red);margin-bottom:10px"></div>'
    +'<h1 style="font-size:20px;line-height:1.3;font-weight:900;margin-bottom:4px">Amplitudes</h1>'
    +'<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-bottom:6px">'
    +escapeHtml(E.nom)+' · quatre tests, chacun avec son protocole. Tout est facultatif : '
    +'une case vide vaut mieux qu’une mesure prise autrement que ce qui est écrit.</p>'
    +'<p style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin-bottom:16px">'
    +'On note ce qu’on voit : une distance, un angle, un arrêt net ou élastique. '
    +'Rien ici ne dit d’où vient une limite, et rien ne descend côté athlète.</p>'
    +MORPHO_TESTS.map(d=>{
      const v=E.v[d.cle]||{};
      const f=faits.find(x=>x.cle===d.cle);
      const etat=_ampEtatTest(d,v);
      let saisie='';
      if(d.champ==='cm') saisie=num(d.cle,'cm',v.cm,'cm')+'<span style="font-size:var(--fs-xs);color:var(--text-dim);font-weight:700">cm</span>';
      else if(d.champ==='deg') saisie=num(d.cle,'deg',v.deg,'°')
        +'<span style="font-size:var(--fs-xs);color:var(--text-dim);font-weight:700">°</span>'
        +bouton(d.cle,'butee',v.butee,'nette','Butée nette')
        +bouton(d.cle,'butee',v.butee,'elastique','Butée élastique');
      else if(d.champ==='paire') saisie='<span style="font-size:var(--fs-xs);color:var(--sub);font-weight:800">G</span>'
        +num(d.cle,'g',v.g,'cm')+'<span style="font-size:var(--fs-xs);color:var(--sub);font-weight:800">D</span>'
        +num(d.cle,'d',v.d,'cm')
        +(d.mur?'<span style="flex-basis:100%;height:0"></span>'
          +'<span style="font-size:var(--fs-xs);color:var(--text-dim);font-weight:700">Bras au mur :</span>'
          +bouton(d.cle,'mur',v.mur,'oui','Ils touchent')
          +bouton(d.cle,'mur',v.mur,'non','Lombaires qui décollent'):'');
      else if(d.champ==='niveau') saisie=(d.niveaux||[]).map(k=>bouton(d.cle,'niveau',v.niveau,k,
        k==='haut'?'Haut du dos':k==='milieu'?'Milieu':'Bas du dos')).join('');
      return '<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">'
        +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#bbb;margin-bottom:6px">'
        +escapeHtml(d.lib)+'</div>'
        +'<p style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-bottom:10px">'+escapeHtml(d.protocole)+'</p>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+saisie+'</div>'
        +(etat.horsBornes?'<p style="font-size:var(--fs-xs);color:var(--orange);line-height:1.5;margin-top:8px">'
          +'Valeur hors des bornes attendues ('+d.min+' à '+d.max+' '+(d.unite||'')+') : à revérifier avant d’enregistrer.</p>':'')
        +(f&&f.date?'<p style="font-size:var(--fs-xs);color:'+(f.perime?'var(--orange)':'var(--text-faint)')
          +';line-height:1.5;margin-top:8px">Dernier relevé : '+escapeHtml(f.texte||'-')+' · '
          +dateLocaleDeCle(f.date).toLocaleDateString('fr-FR')+(f.perime?' · périmé, à refaire':'')+'</p>':'')
        +'</div>';
    }).join('')
    +htmlPhoto
    +'<p style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin-top:4px">'
    +'Un test vaut '+MORPHO_PEREMPTION_J+' jours : une amplitude se travaille et se perd, '
    +'et passé un trimestre elle ne décrit plus l’athlète d’aujourd’hui.</p>';
  _ampMajEtat();
}
/**
 * Enregistre les tests dans le dossier de l'athlète. Chaque test rempli reçoit
 * la date du jour ; un test vidé est retiré, pas gardé avec une vieille date.
 */
function enregistrerAmplitudes(){
  if(!_amp) return false;
  const users=DB.get('users')||{};
  const c=users[_amp.email];
  if(!c||!currentUser||c.coachId!==currentUser.id){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false;
  }
  const avant=(c.morphoTests&&typeof c.morphoTests==='object')?c.morphoTests:{};
  const out={};
  const n=(x)=>{ const q=parseFloat(String(x==null?'':x).replace(',','.')); return isFinite(q)?q:null; };
  for(const d of MORPHO_TESTS){
    const v=_amp.v[d.cle]||{};
    const etat=_ampEtatTest(d,v);
    if(etat.horsBornes){ toast('Une valeur sort des bornes : reprends-la avant d’enregistrer.','var(--orange)'); return false; }
    if(!etat.rempli) continue;
    const o={};
    if(d.champ==='cm') o.cm=n(v.cm);
    else if(d.champ==='deg'){ o.deg=n(v.deg); if(v.butee==='nette'||v.butee==='elastique') o.butee=v.butee; }
    else if(d.champ==='paire'){ const g=n(v.g), dr=n(v.d); if(g!=null) o.g=g; if(dr!=null) o.d=dr;
      if(v.mur==='oui'||v.mur==='non') o.mur=v.mur; }
    else if(d.champ==='niveau') o.niveau=String(v.niveau||'');
    // LA DATE NE BOUGE QUE SI LA MESURE BOUGE : rouvrir l'écran et le
    // réenregistrer ne doit pas rajeunir un test qui n'a pas été refait.
    const vieux=avant[d.cle]||{};
    const sansDate=Object.assign({},vieux); delete sansDate.date; delete sansDate.histo;
    o.date=(JSON.stringify(sansDate)===JSON.stringify(o)&&vieux.date)?vieux.date:Date.now();
    // LOT T6 : LES RELEVÉS D'AVANT restent, pour la courbe. Un relevé qui ne
    // bouge pas ne s'ajoute pas ; un nouveau relevé pousse l'ancien, date
    // comprise, dans « histo » (AMP_HISTO_MAX au plus).
    const _h=Array.isArray(vieux.histo)?vieux.histo.slice():[];
    if(vieux.date&&o.date!==vieux.date){ const prec=Object.assign({},vieux); delete prec.histo; _h.push(prec); }
    if(_h.length) o.histo=_h.slice(-AMP_HISTO_MAX);
    out[d.cle]=o;
  }
  if(Object.keys(out).length) c.morphoTests=out; else delete c.morphoTests;
  c.updatedAt=Date.now();
  users[_amp.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(_amp.email,c),'Amplitudes enregistrées','les amplitudes sont');
  _ampRendre();
  return true;
}

// PURE. Même format que risquesMicro : {cle, lib, motif, question}.
function questionsMorpho(user){
  const out=[];
  if(!user||typeof user!=='object') return out;
  // Mesures à revérifier : on le dit AVANT tout ratio, puisqu'aucun ratio ne
  // sera calculé dessus.
  [['deb-entrejambe','entrejambe'],['deb-bras','longueur de bras']].forEach(([champ,lib])=>{
    const l=longueurSegment(user,champ);
    if(l.motif==='aberrante')
      out.push({cle:'mesure_'+champ,lib:'Mesure à revérifier',
        motif:'La mesure d\'' + (lib==='entrejambe'?'entrejambe':'un bras')
          +' saisie au bilan ne tient pas debout : plus longue que la taille, ou trop courte.',
        question:'Peux-tu la reprendre avec '+
          (lib==='entrejambe'?'l\'athlète pieds nus, du sol au pubis':'le bras tendu, de l\'acromion à la styloïde')+' ?'});
  });

  // LES SIX MESURES DU LOT M1, au même endroit et pour la même raison : on le
  // dit AVANT tout rapport, puisqu'aucun rapport ne sera calculé dessus.
  for(const d of MORPHO_MESURES){
    if(d.origine==='M0') continue;
    if(mesureMorpho(user,d.cle).motif!=='aberrante') continue;
    out.push({cle:'mesure_'+d.cle,lib:'Mesure à revérifier',
      motif:'La mesure « '+d.lib.toLowerCase()+' » saisie au bilan sort des bornes attendues : '
        +'entre '+d.min+' et '+d.max+' cm.',
      question:'Peux-tu la reprendre ? '+d.consigne});
  }
  for(const c of coherencesMorpho(user)) out.push(c);
  const t=_tailleCm(user);
  const rj=ratioJambes(user);
  if(_horsMarge(rj,RATIO_JAMBES_REF)){
    const longues=rj>RATIO_JAMBES_REF;
    const v=_variantesSchema(longues?'squat':'charniere-hanche',3);
    out.push({cle:'jambes',lib:longues?'Jambes longues pour la taille':'Jambes courtes pour la taille',
      motif:'Entrejambe à '+Math.round(rj*100)+' % de la taille, pour un repère de population autour de '
        +Math.round(RATIO_JAMBES_REF*100)+' %.'
        +(v.length?' Variantes du même schéma à essayer : '+v.join(', ')+'.':''),
      question:'Est-ce que '+(longues?'la profondeur au squat':'l\'amplitude en charnière de hanche')
        +' te paraît confortable chez '+(t?'lui':'cet athlète')+' ?'});
  }
  const rb=ratioBras(user);
  if(_horsMarge(rb,RATIO_BRAS_REF)){
    const longs=rb>RATIO_BRAS_REF;
    const v=_variantesSchema(longs?'poussee-horizontale':'tirage-vertical',3);
    out.push({cle:'bras',lib:longs?'Bras longs pour la taille':'Bras courts pour la taille',
      motif:'Longueur de bras à '+Math.round(rb*100)+' % de la taille, pour un repère de population autour de '
        +Math.round(RATIO_BRAS_REF*100)+' %.'
        +(v.length?' Variantes du même schéma à essayer : '+v.join(', ')+'.':''),
      question:'Est-ce que l\'amplitude '+(longs?'au développé couché':'au tirage')
        +' pose question en séance ?'});
  }
  const d=(function(){ try{ return dominanceQuadIschio(user); }catch(e){ return null; } })();
  if(d!=null&&d>DOMINANCE_QI_SIGNAL){
    out.push({cle:'quad_ischio',lib:'Quadriceps et ischios déséquilibrés',
      motif:'Sur les dernières semaines entraînées, le volume quadriceps vaut '
        +String(d).replace('.',',')+' fois celui des ischios.',
      question:'Est-ce un choix de programmation en ce moment, ou une habitude à rééquilibrer ?'});
  }
  return out;
}

// Fiche COACH uniquement. Aucune fonction d'affichage athlète n'appelle ceci —
// un test le vérifie sur le HTML produit par l'accueil et l'écran progression.
function _htmlQuestionsMorpho(user){
  const l=(function(){ try{ return questionsMorpho(user); }catch(e){ return []; } })();
  const tests=(function(){ try{ return testsMorpho(user); }catch(e){ return []; } })();
  const faits=tests.filter(t=>t.date&&t.texte);
  const lecture=(function(){ try{ return _htmlMorphoLecture(user,_morphoCalCache()); }
    catch(e){ return ''; } })();
  // ⚠ ZONE DE LECTURE, ET RIEN D’AUTRE. Aucun bouton ici — ni fermeture, ni
  // report, ni saisie — et AUCUN bloc du tout quand il n’y a rien à dire :
  // un cadre qui s’affiche toujours finit par ne plus être lu. Le relevé des
  // amplitudes se fait dans l’onglet Données, section Amplitudes.
  if(!l.length&&!faits.length&&!lecture) return '';
  // LES TESTS, AVEC LEUR DATE ET LEUR PÉREMPTION. Une amplitude relevée il y a
  // six mois ne décrit plus l'athlète : on la montre quand même, marquée
  // « périmé », plutôt que de la faire disparaître sans un mot.
  const htmlTests=!faits.length?'':`<div style="border-top:1px solid var(--border);margin-top:4px;padding-top:12px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.2px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Amplitudes</div>
    ${faits.map(t=>`<div style="font-size:var(--fs-sm);color:${t.perime?'var(--orange)':'var(--text-strong)'};line-height:1.6">${escapeHtml(t.lib)} : ${escapeHtml(t.texte)} <span style="color:var(--text-faint)">(test, ${dateLocaleDeCle(t.date).toLocaleDateString('fr-FR')}${t.perime?', périmé':''})</span></div>`).join('')}
  </div>`;
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px">Proportions</div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:12px">Des variantes à envisager, jamais un exercice à retirer.</div>
    ${l.length?'':`<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;margin-bottom:12px">Aucune proportion à signaler avec ce qui est mesuré aujourd’hui.</div>`}
    ${l.map(r=>`<div style="border-left:2px solid var(--border);padding-left:12px;margin-bottom:12px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;color:#bbb;text-transform:uppercase;margin-bottom:4px">${escapeHtml(r.lib)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(r.motif)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-top:6px;font-weight:600">${escapeHtml(r.question)}</div>
    </div>`).join('')}
    ${lecture}
    ${htmlTests}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;border-top:1px solid var(--border);padding-top:10px;margin-top:12px">${escapeHtml(MORPHO_DISCLAIMER)}</div>
  </div>`;
}

// Fiche coach UNIQUEMENT. Rien de tout ceci n'est rendu côté athlète : aucune
// fonction de l'accueil ou de l'écran nutrition n'appelle risquesMicro.
// Côté coach, le score EST montré : c'est un professionnel qui le lit, et il a
// besoin de savoir sur quoi l'app s'est fondée pour se taire. Côté athlète,
// aucun chiffre ne descend jamais.
// PURE. Le format est celui de risquesMicro — {cle, lib, motif, question} —
// mais la fonction est séparée : risquesMicro parle de micronutriments, et
// trois de ses tests épinglent la liste exacte de ses clés.
// UN OU DEUX faits seulement : une question au coach, et RIEN côté athlète.
function risqueDeficitQuestion(user,jourISO){
  let rd,pal;
  try{ rd=risqueDeficitEnergetique(user,jourISO); pal=paliersDeficit(user,jourISO); }
  catch(e){ return null; }
  if(!rd||pal!=='aucun'||rd.points<1) return null;
  return {cle:'deficit',lib:'Éléments qui se cumulent',
    motif:rd.criteres.map(x=>x.lib.toLowerCase()+' : '+x.valeur).join(' · ')+'.',
    question:'Comment se passe la récupération en ce moment : fatigue, sommeil, appétit ?'};
}
function _htmlDeficitCoach(c){
  let pal='aucun', r=null;
  try{ pal=paliersDeficit(c); r=risqueDeficitEnergetique(c); }catch(e){ return ''; }
  if(pal==='aucun'){
    // Un ou deux faits : une question, au même endroit et dans le même
    // registre que les autres. Aucun chiffre, aucun palier annoncé.
    const q=risqueDeficitQuestion(c);
    if(!q) return '';
    return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;margin-bottom:20px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.2px;color:#bbb;text-transform:uppercase;margin-bottom:4px">${escapeHtml(q.lib)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(q.motif)}</div>
      <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-top:6px;font-weight:600">${escapeHtml(q.question)}</div>
    </div>`;
  }
  if(!r) return '';
  const bloc=(pal==='blocage');
  const col=bloc?'var(--red)':'var(--orange)';
  const leve=((c&&c.cycle)||{}).leveDeficit;
  const lignes=r.criteres.map(x=>
    `<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.65">· ${escapeHtml(x.lib)} : ${escapeHtml(String(x.valeur))}</div>`).join('');
  // La levée est un GESTE du coach, jamais une expiration automatique. Deux
  // motifs, pas de champ libre : on ne fait pas raconter un dossier médical.
  const boutons=bloc
    ?`<div style="display:flex;gap:8px;margin-top:12px">
        <button onclick="leverDeficit('consulte')" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px">Elle a consulté</button>
        <button onclick="leverDeficit('regles_revenues')" class="btn btn-outline btn-sm" style="flex:1;margin:0;font-size:var(--fs-2xs);letter-spacing:1px">Les règles sont revenues</button>
      </div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:8px">Après une levée, propose une pause diététique plutôt qu'un retour direct en déficit.</div>`
    :'';
  const rappelLeve=leve
    ?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:8px">Levée enregistrée le ${escapeHtml(String(leve.date))} · motif : ${escapeHtml(String(leve.motif||''))}. Une nouvelle absence déclarée la remettra en cause.</div>`
    :'';
  return `<div style="background:var(--dark);border:1px solid ${col}55;border-radius:var(--r-3);padding:16px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:${col};letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px">${bloc?'Apports bloqués sous le plancher':'Faits qui se cumulent'}</div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:10px">${r.points} élément${r.points>1?'s':''} relevé${r.points>1?'s':''}. Rien n'est diagnostiqué ici : ce sont des constats mesurés dans l'app.</div>
    ${lignes}
    ${bloc?`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7;margin-top:10px;border-top:1px solid var(--border);padding-top:10px">${escapeHtml(DEF_TEXTE_BLOCAGE)}</div>`:''}
    ${boutons}${rappelLeve}
  </div>`;
}
// Écrit la levée sur le dossier de l'athlète. Aucune expiration, aucun
// décompte : elle tient jusqu'à ce qu'une nouvelle absence soit déclarée.
function leverDeficit(motif){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(['consulte','regles_revenues'].indexOf(motif)<0) return false;
  if(!c.cycle) c.cycle={};
  c.cycle.leveDeficit={date:localISODate(new Date()),motif};
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Levée enregistrée','la levée est');
  try{ renderCoachMicroSection(c); renderCoachNutriSection(c); }catch(e){}
  return true;
}
