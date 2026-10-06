// ══ ANALYSE MORPHO-ANATOMIQUE — LA MAQUETTE DE KEVIN (24/09/2026) ═══════════
//
// Sous les silhouettes de l'onglet Données. La photo de face et la photo de
// dos du PREMIER bilan, entières, à leurs proportions — et sur elles, les
// repères anatomiques que le moteur de pose place tout seul et que le coach
// peut déplacer du doigt avant de relancer l'analyse.
//
// ⚠ DEUXIÈME VERSION, et pourquoi. La première détourait la photo et la
//   recadrait dans une scène aux mauvaises proportions : Kevin, le même jour,
//   « tu as décapité la personne, déformé l'image, ce ne sont plus les mêmes
//   longueurs ». On ne touche plus à la photo : elle est montrée telle que
//   l'athlète l'a envoyée, et tout ce qui est dessiné dessus l'est dans SON
//   repère de pixels. Le masque de segmentation sert encore, mais seulement à
//   placer des points (sommet du crâne, bords de la taille, deltoïdes).
// ⚠ LES MESURES SONT EN CENTIMÈTRES quand la taille est connue : sommet du
//   crâne → talons = la taille déclarée. C'est une échelle par photo, pas un
//   mètre : ±3 % (perspective, posture), et c'est écrit à côté de chaque chiffre.
// ⚠ LES REPÈRES SONT PUBLIÉS, ET COMPARABLES À CE QU'ON MESURE ICI :
//   - longueurs de segments : de Leva (1996), J Biomech 29:1223-1230, table 4
//     — en fraction de la taille, PAR SEXE, et mesurées D'UN CENTRE ARTICULAIRE
//     À L'AUTRE, exactement ce que rendent les points de la photo (voir
//     ANAT_REF, et pourquoi ce n'est plus Drillis & Contini) ;
//   - largeurs d'os (acromions, crêtes iliaques) : moyennes adultes de
//     l'enquête ANSUR II (2012), par sexe. Ici les points ne sont PAS des
//     centres articulaires : ils sont posés sur la pointe de l'os. Tant qu'ils
//     sont estimés et pas vérifiés par le coach, la fiche le dit.
//   Un repère de population décrit une moyenne, pas une norme : l'écart est
//   un levier à connaître, jamais un défaut.
// ⚠ LA DOCTRINE MORPHO TIENT : aucun diagnostic, aucun exercice « à éviter »
//   (on dit « à aménager », avec le réglage), toute valeur avec sa marge.

// v3 : modèle de pose « full » et suivi remis à zéro (les points de la v2,
// lus au modèle « lite », tombaient à côté). Les points posés à la main en v2
// sont repris tels quels.
// v4 : sommet du crâne cherché en remontant le cou (la v3 prenait la lampe
// du plafond pour une tête). Les points posés à la main sont repris.
// v5 (chantier A7) : chaque point du moteur garde sa VISIBILITÉ en quatrième
// valeur ; c'est elle qui départage une confiance B d'une C. Les points posés à
// la main sont repris.
// v6 (chantier A11) : la photo de dos pose le milieu du mollet et le tendon
// d'Achille ; les analyses se relisent, les points posés à la main restent.
// v7 (chantier A14) : le bord interne des omoplates, posé sur la photo de dos.
const ANAT_VERSION=7;
/**
 * LES LONGUEURS DE RÉFÉRENCE, en fraction de la taille, PAR SEXE.
 *
 * ⚠ POURQUOI CE N'EST PLUS DRILLIS & CONTINI (audit morpho du 25/09/2026,
 *   chantier A1). Leur humérus vaut 0,186 × taille, mais il n'est pas mesuré
 *   du CENTRE de l'épaule : il part plus haut, près de l'acromion. Or les points
 *   de la photo sont des centres articulaires. On comparait donc un humérus
 *   mesuré centre à centre (~0,162) à une référence plus longue par
 *   construction : un rapport humérus / avant-bras de référence de 1,27 au lieu
 *   de 1,05, et des verdicts « bras » faussés d'autant. Une mesure ne se compare
 *   qu'à une référence mesurée DE LA MÊME FAÇON.
 *
 *   De Leva (1996) donne les longueurs ENTRE CENTRES ARTICULAIRES, par sexe :
 *   Journal of Biomechanics 29(9):1223-1230, table 4 (hommes : stature
 *   1741 mm ; femmes : 1735 mm). En millimètres, puis en fraction :
 *     bras SJC→EJC           H 281,7 (0,1618)  F 275,1 (0,1586)
 *     avant-bras EJC→WJC     H 268,9 (0,1545)  F 264,3 (0,1523)
 *     cuisse HJC→KJC         H 422,2 (0,2425)  F 368,5 (0,2124)
 *     jambe KJC→malléole lat H 434,0 (0,2493)  F 432,3 (0,2492)
 *     tronc MIDS→MIDH        H 515,5 (0,2961)  F 497,9 (0,2870)
 *     pied                   H 258,1 (0,1482)  F 228,3 (0,1316)
 *   - `hanche` n'est PAS de de Leva : c'est la hauteur de trochanter d'ANSUR II
 *     (2012), recalculée pour l'audit (H 0,513, F 0,519), comme les largeurs
 *     (ANAT_LARGEURS, chantier A2).
 *   - `DEF` dit, pour chaque ligne du tableau, d'où à où l'on mesure : c'est ce
 *     qui rend la comparaison lisible par le coach.
 */
const ANAT_REF=Object.freeze({
  H:Object.freeze({bras:0.1618,avantbras:0.1545,cuisse:0.2425,jambe:0.2493,tronc:0.2961,pied:0.1482,hanche:0.513}),
  F:Object.freeze({bras:0.1586,avantbras:0.1523,cuisse:0.2124,jambe:0.2492,tronc:0.2870,pied:0.1316,hanche:0.519}),
  SOURCE:'de Leva (1996)',
  DEF:Object.freeze({bras:'centre épaule → centre coude',avantbras:'centre coude → centre poignet',
    cuisse:'centre hanche → centre genou',jambe:'centre genou → cheville (malléole)',
    tronc:'mi-épaules → mi-hanches',hanche:'centre hanche → sol ; repère : trochanter (ANSUR II)'})
});
/**
 * L'ANGLE DE PORT DU COUDE (A10), bras tendu, paume vers l'avant : de combien
 * l'avant-bras s'écarte en dehors de l'axe du bras. ⚠ ORDRE DE GRANDEUR des
 * séries publiées chez l'adulte, cité comme tel — pas une table de référence.
 */
const ANAT_COUDE=Object.freeze({H:Object.freeze({moy:11,et:4}),F:Object.freeze({moy:15,et:5}),
  SOURCE:'ordre de grandeur des séries publiées chez l’adulte (angle de port du coude), cité comme tel',
  // Un bras est « tendu » à 155° au moins dans le plan de l'image (le même
  // seuil que les longueurs) ET quand l'avant-bras garde au moins 85 % de sa
  // longueur attendue par rapport au bras : un coude fléchi vers l'objectif
  // raccourcit l'avant-bras en projection sans fermer l'angle de l'image.
  TENDU:155,RACCOURCI:0.85,
  CONSIGNE:'Photo de face bras tendus le long du corps, légèrement écartés, paumes tournées vers l’avant.'});
const ANAT_ARRIERE_PIED_CONSIGNE='Photo de dos pieds nus, pieds à largeur de hanches, poids réparti sur les deux jambes, mollets et talons visibles ; replacer au besoin le milieu du mollet, le tendon d’Achille au niveau des malléoles et le bas du talon (« Ajuster les points », vue Dos).';
/**
 * Les repères des trois mesures du chantier A12 : ANSUR II (Gordon et al.,
 * 2014), CALCUL REPCORE sur les fichiers publics — moyenne ± écart-type.
 * Envergure et pied en fraction de la taille ; thorax en cm.
 */
const ANAT_MESURES_REF=Object.freeze({
  H:Object.freeze({envergure:1.033,envergure_et:0.027,pied:0.154,pied_et:0.005,thorax:25.4,thorax_et:2.6}),
  F:Object.freeze({envergure:1.019,envergure_et:0.029,pied:0.151,pied_et:0.005,thorax:24.7,thorax_et:2.7}),
  SOURCE:'ANSUR II (Gordon et al., 2014), calcul RepCore'});
/**
 * LE V DANS LE TEMPS (chantier A13). Repère de population : largeur
 * bideltoïde / largeur de taille, ANSUR II (Gordon et al., 2014), calcul
 * RepCore. ⚠ La taille d'ANSUR est prise AU NOMBRIL, pas au plus étroit comme
 * sur la photo : le percentile est indicatif. Jamais « idéal » : un repère.
 */
const ANAT_V_REF=Object.freeze({
  H:Object.freeze({moy:1.573,et:0.110,p5:1.40,p95:1.76}),
  F:Object.freeze({moy:1.512,et:0.110,p5:1.33,p95:1.70}),
  SOURCE:'ANSUR II (Gordon et al., 2014), largeur bideltoïde / largeur de taille, calcul RepCore',
  AVERT:'taille ANSUR prise au nombril, pas au plus étroit : percentile indicatif',
  BRUIT:0.03});   // bruit de placement des quatre points, en unité de V
/** Les six points qu'on garde d'une photo de bilan pour le V et le X — rien d'autre. */
const ANAT_SIL_CLES=Object.freeze(['deltoide_l','deltoide_r','taille_l','taille_r','hanches_l','hanches_r']);
/**
 * PURE. V (deltoïdes / taille) et X (hanches / taille) d'une photo de face
 * lue par le moteur : les bords de la silhouette, sur le masque. Les hanches
 * sont la plus large plage du masque entre le centre des hanches et 12 % du
 * tronc plus bas. `conf` : la marque la plus faible (1 lu, 0,5 estimé).
 */
function anatSilhouetteDe(raw){
  const a=_anatSafe(()=>anatPointsAuto(raw,'face'));
  if(!a||!a.pts) return null;
  const P=a.pts, W=raw.w, H=raw.h;
  const pts={};
  for(const k of ['deltoide_l','deltoide_r','taille_l','taille_r']) if(P[k]) pts[k]=P[k].slice(0,3);
  const bits=anatMasqueBits(raw.masque), m=raw.masque;
  if(bits&&P.hanche_l&&P.hanche_r&&P.epaule_l&&P.epaule_r){
    const kx=m.w/W, ky=m.h/H;
    const yH=(P.hanche_l[1]+P.hanche_r[1])/2*H, cx=(P.hanche_l[0]+P.hanche_r[0])/2*W;
    const T=Math.abs(yH-(P.epaule_l[1]+P.epaule_r[1])/2*H);
    let best=null;
    for(let f=0;f<=0.12;f+=0.02){
      const y=yH+f*T, pl=_anatPlages(bits,m,y*ky);
      const q=pl.find(r=>r[0]<=cx*kx&&r[1]>=cx*kx);
      if(q&&(!best||q[1]-q[0]>best.w)) best={w:q[1]-q[0],l:q[0]/kx,r:q[1]/kx,y};
    }
    if(best){ pts.hanches_l=[best.l/W,best.y/H,1]; pts.hanches_r=[best.r/W,best.y/H,1]; }
  }
  for(const k in pts) pts[k]=[Math.round(pts[k][0]*10000)/10000,Math.round(pts[k][1]*10000)/10000,pts[k][2]];
  const r=anatVDePoints(pts,W,H);
  return r?Object.assign({pts,w:W,h:H},r):null;
}
/** PURE. V et X à partir des points (normalisés) d'une photo de W × H. */
function anatVDePoints(pts,W,H){
  const d=(a,b)=>(pts[a]&&pts[b])?Math.hypot((pts[a][0]-pts[b][0])*W,(pts[a][1]-pts[b][1])*H):null;
  const dl=d('deltoide_l','deltoide_r'), tl=d('taille_l','taille_r'), hl=d('hanches_l','hanches_r');
  if(!dl||!tl) return null;
  const marques=['deltoide_l','deltoide_r','taille_l','taille_r'].map(k=>pts[k][2]);
  return {V:Math.round(dl/tl*1000)/1000,X:hl?Math.round(hl/tl*1000)/1000:null,conf:Math.min(...marques)};
}
/**
 * PURE. La série du V, bilan par bilan : les silhouettes lues en arrière-plan,
 * et, pour le bilan analysé, le V de l'analyse (points du coach compris).
 * ⚠ SEULS LES BILANS QUI PORTENT UNE PHOTO DE FACE : une ligne restée pour un
 *   bilan dont la photo a disparu n'est plus tracée.
 * @returns {{bilan:number,V:number,X:number|null,conf:number,lu:'analyse'|'auto'}[]}
 */
function anatSerieV(u,courant){
  const a=u&&u.morphoAnat;
  let bl=[]; try{ bl=(Array.isArray(u&&u.bilans)?u.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  const avecFace=new Set(bl.filter(b=>{ try{ return !!photoBilanSrc(b,'face'); }catch(e){ return false; } }).map(b=>Number(b.date)));
  const par={};
  for(const x of (a&&Array.isArray(a.silhouettes)?a.silhouettes:[]))
    // ⚠ UNE SILHOUETTE ESTIMÉE N'EST PAS TRACÉE : sans bords lus sur le masque,
    //   deltoïdes et taille sont posés aux proportions moyennes — un V inventé.
    if(x&&x.V>0&&x.conf>=0.9&&avecFace.has(Number(x.bilan))) par[Number(x.bilan)]={bilan:Number(x.bilan),V:x.V,X:x.X!=null?x.X:null,conf:x.conf,lu:'auto'};
  if(courant&&courant.V>0&&avecFace.has(Number(courant.bilan))){
    const ancien=par[Number(courant.bilan)];
    par[Number(courant.bilan)]={bilan:Number(courant.bilan),V:courant.V,X:courant.X!=null?courant.X:(ancien?ancien.X:null),conf:courant.conf,lu:'analyse'};
  }
  return Object.values(par).sort((x,y)=>x.bilan-y.bilan);
}
/**
 * LES PIEDS LUS HONNÊTEMENT (A15). De face, à hauteur de hanche et à 3 m, le
 * pied se couche dans l'image : son axe avant-arrière est vu en raccourci
 * (≈ sin 18°), si bien que l'ouverture APPARENTE exagère la vraie d'un
 * facteur 2 à 3. Sans photo prise vers le sol, on n'en tire qu'un mot, sur
 * l'angle apparent × 0,4 — une ESTIMATION RepCore, pas une mesure. L'écart
 * G/D, lui, se lit sur les deux angles apparents : la perspective est la même
 * des deux côtés.
 */
const ANAT_PIEDS=Object.freeze({CORR:0.4,SEUILS:[0,7,18],MOTS:['fermé','droit','ouvert','très ouvert'],
  CONSIGNE:'Photo de face pieds nus, posés comme d’habitude, sans les tourner exprès, ni vers l’avant ni vers l’extérieur.'});
function anatMotPied(corr){
  const S=ANAT_PIEDS.SEUILS;
  return ANAT_PIEDS.MOTS[corr<S[0]?0:(corr<=S[1]?1:(corr<=S[2]?2:3))];
}
/**
 * L'HISTORIQUE POSTURAL (chantier A23). Pour chaque bilan à photos de face et
 * de dos : inclinaison des épaules et du bassin, décalage du tronc, V — lus en
 * arrière-plan, sans rien garder d'autre que ces quatre nombres.
 * ⚠ MÊME RÈGLE QUE P14 (MORPHO_PROFILS, « asymétrie latérale soutenue ») : un
 *   écart ne compte que s'il revient, DU MÊME CÔTÉ, au-delà de la marge, trois
 *   bilans de suite. Jusque-là, la fiche reste au plus « léger ».
 */
const ANAT_SUIVI=Object.freeze({N:3,
  CLES:Object.freeze([
    Object.freeze({cle:'epaules',m:'epaules',lib:'Inclinaison des épaules',unite:'°'}),
    Object.freeze({cle:'bassin',m:'bassin',lib:'Inclinaison du bassin',unite:'°'}),
    Object.freeze({cle:'buste',m:'tronc',lib:'Décalage du tronc',unite:' %'})])});
/** PURE. Les quatre nombres d'une analyse. */
function anatMesuresPosture(res){
  const F=k=>((res&&res.fiches)||[]).find(f=>f.cle===k);
  const ep=F('epaules'), ba=F('bassin'), bu=F('buste');
  const r1=v=>(v==null||!isFinite(v))?null:Math.round(v*100)/100;
  const confs=[ep,ba,bu].map(f=>f&&f.conf).filter(Boolean), rang={A:2,B:1,C:0};
  // Une fiche illisible ou neutralisée (corps tourné, A8) n'entre pas dans l'historique.
  const lu=f=>f&&f.etat==='ok'&&!f.tourne;
  return {mesures:{epaules:r1(lu(ep)?ep.mesure.a:null),bassin:r1(lu(ba)?ba.mesure.a:null),tronc:r1(lu(bu)?bu.mesure.s:null),V:r1(bu&&bu.mesure.V)},
    conf:confs.length?confs.reduce((a,b)=>rang[b]<rang[a]?b:a):null};
}
/**
 * PURE. La série d'une mesure, bilan par bilan : l'historique lu en arrière-
 * plan, et pour le bilan analysé la valeur de l'analyse. Seuls les bilans qui
 * portent encore des photos de face ET de dos.
 */
function anatSeriePosture(u,m,courant,anatLu){
  const a=anatLu||(u&&u.morphoAnat);
  let bl=[]; try{ bl=(Array.isArray(u&&u.bilans)?u.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  const ok=new Set(bl.filter(b=>{ try{ return !!photoBilanSrc(b,'face')&&!!photoBilanSrc(b,'back'); }catch(e){ return false; } }).map(b=>Number(b.date)));
  const par={};
  for(const x of (a&&Array.isArray(a.suivi)?a.suivi:[]))
    if(x&&x.mesures&&x.mesures[m]!=null&&ok.has(Number(x.bilan))) par[Number(x.bilan)]={bilan:Number(x.bilan),v:x.mesures[m]};
  if(courant&&courant.v!=null&&ok.has(Number(courant.bilan))) par[Number(courant.bilan)]={bilan:Number(courant.bilan),v:courant.v};
  return Object.values(par).sort((x,y)=>x.bilan-y.bilan);
}
/**
 * PURE. Persistant si les trois derniers bilans dépassent la marge DU MÊME
 * CÔTÉ. Rend {persistant, n (bilans consécutifs du même côté au-delà de la
 * marge, en remontant du dernier), cote (+1 / −1)}.
 */
function anatPersistance(serie,marge){
  const l=(serie||[]).slice();
  let n=0, cote=0;
  for(let i=l.length-1;i>=0;i--){
    const v=l[i].v; if(v==null||!(Math.abs(v)>marge)) break;
    const sg=Math.sign(v); if(cote&&sg!==cote) break;
    cote=sg; n++;
  }
  return {persistant:n>=ANAT_SUIVI.N,n,cote};
}
/** Le repère d'un sexe (homme par défaut, comme les largeurs). */
function anatRef(femme){ return ANAT_REF[femme?'F':'H']; }
/**
 * La demi-main du modèle de soulevé : de Leva ne la donne pas centre à centre,
 * elle reste à Drillis & Contini (0,108 × taille), la seule valeur qui en vient
 * encore — et elle n'entre que dans le modèle, jamais dans un verdict.
 */
const ANAT_MAIN=0.108;
/**
 * LES LARGEURS OSSEUSES ADULTES, en fraction de la taille, AVEC LEUR DISPERSION.
 *
 * Source : ANSUR II (Gordon et al., 2014, NATICK/TR-15/007), fichiers publics —
 * calcul RepCore du 25/09/2026, n = 4 082 hommes / 1 986 femmes. `_et` est
 * l'écart-type ; `rapport` est la moyenne du rapport biacromial / bicrêtal
 * calculée personne par personne — PAS le rapport des deux moyennes.
 *
 * ⚠ POURQUOI CE N'EST PLUS 0,231 / 0,162 (audit morpho, chantier A2). Le rapport
 *   des anciennes moyennes donnait 1,43 pour les hommes ; les données en donnent
 *   1,51 ± 0,09. Chaque homme ressortait donc « carrure étroite » d'environ un
 *   cran : une erreur de référence, pas une observation.
 * ⚠ POPULATION MILITAIRE, plus athlétique que la moyenne des adultes : la
 *   référence décrit des adultes actifs, pas une norme. Un écart dit où se
 *   situe l'athlète par rapport à eux, jamais ce qu'il « devrait » être.
 */
const ANAT_LARGEURS=Object.freeze({
  H:Object.freeze({biacromial:0.2368,biacromial_et:0.0098,bicretal:0.1569,bicretal_et:0.0086,rapport:1.513,rapport_et:0.090}),
  F:Object.freeze({biacromial:0.2244,biacromial_et:0.0096,bicretal:0.1679,bicretal_et:0.0127,rapport:1.344,rapport_et:0.110}),
  SOURCE:'ANSUR II (Gordon et al., 2014), calcul RepCore du 25/09/2026, n = 4 082 H / 1 986 F'
});
/**
 * UN CLASSEMENT STATISTIQUEMENT HONNÊTE (audit morpho, chantier A3).
 *
 * ⚠ POURQUOI PLUS DE SEUILS EN POUR CENT. Les anciens seuils (5 / 9 / 14 %)
 *   traitaient tous les segments pareil. Or le seuil « léger » de 5 % vaut à peu
 *   près UN écart-type de population : un adulte sur trois en sortait, par le
 *   seul jeu de la variation normale — environ 32 % de faux signaux.
 *
 * On compare donc l'écart à ce qui est NORMAL POUR CE SEGMENT, erreur de la
 * photo comprise :   z = (mesure / attendu − 1) / √(disp² + err²)
 *   - disp : dispersion résiduelle À TAILLE ÉGALE, en % du segment (ANAT_DISP) ;
 *   - err  : l'erreur de la mesure photo (anatErrMesure) ;
 *   - |z| < 1 dans la marge, 1–1,5 léger, 1,5–2 net, > 2 marqué ;
 *   - percentile = Φ(z). On affiche un percentile, JAMAIS un z brut.
 */
const ANAT_DISP=Object.freeze({
  H:Object.freeze({bras:3.2,avantbras:4.0,cuisse:4.7,jambe:3.5,tronc:5.0,biacromial:3.9,bicretal:5.5,rapportBras:4.2,rapportJambes:5.3}),
  F:Object.freeze({bras:3.4,avantbras:4.6,cuisse:4.1,jambe:3.7,tronc:4.7,biacromial:4.1,bicretal:7.5,rapportBras:4.7,rapportJambes:5.1}),
  SOURCE:'ANSUR II, dispersion résiduelle à taille égale, calcul RepCore du 25/09/2026'
});
/**
 * L'erreur de la mesure photo, en %. L'échelle (taille déclarée, perspective,
 * posture) : 3 %. Le placement de chaque point : 1 % posé à la main, 2 % lu par
 * le moteur, 4 % estimé (acromion, crête, point peu visible, gabarit).
 * ⚠ LE 3 % RESTE DANS LES RAPPORTS. Le facteur d'échelle s'y annule, mais pas
 *   la perspective ni la posture, qui touchent deux segments différemment.
 * ⚠ ON NE DIVISE PAS PAR LE NOMBRE DE CÔTÉS mesurés : deux bras d'une même
 *   photo, lus par le même moteur, se trompent dans le même sens.
 */
const ANAT_ERR=Object.freeze({echelle:3,main:1,auto:2,estime:4});
/**
 * UNE ÉCHELLE VÉRIFIÉE (audit morpho, chantier A4). Tous les centimètres de
 * l'analyse viennent d'UNE échelle : la taille du dossier posée du sommet du
 * crâne aux talons. Un sommet mal placé, un talon hors cadre, et tout est faux
 * du même facteur sans que rien ne le dise. On la contrôle donc par un second
 * repère, indépendant : la hauteur du genou.
 *   - au mètre, si le bilan porte la hauteur de rotule (deb-rotule) : c'est
 *     morphoEchellePhoto, l'échelle du lot 7, qu'on réutilise telle quelle ;
 *   - sinon estimée : 0,278 × taille (ANSUR II, hommes et femmes), ±3,2 %.
 * ⚠ MÊME SEUIL QUE LE LOT 7 : au-delà de MORPHO_ECHELLE_ECART_MAX (4 %), les
 *   deux repères ne décrivent pas la même photo. Entre 2 et 4 %, on garde, mais
 *   la marge d'échelle passe de ±3 à ±5 %.
 */
const ANAT_ROTULE=Object.freeze({part:0.278,disp:3.2,source:'0,278 × taille, ANSUR II, ±3,2 %'});
const ANAT_ECHELLE_CONFIRMEE=0.02;
// UNE HAUTEUR DE ROTULE INVRAISEMBLABLE EST ÉCARTÉE (Kevin, 05/10/2026). Une
// fiche affichait « 42,9 % d'écart » avec des points bien placés : c'était la
// mesure du bilan qui était fausse (prise à la hanche, ou au mauvais repère),
// et le bandeau envoyait le coach déplacer des points justes. La rotule est à
// 0,278 × la taille, ±3,2 % (ANSUR II) : à plus de 15 % de cette part, soit
// près de cinq écarts-types, ce n'est plus une morphologie, c'est une saisie.
// On ne s'en sert alors pas : l'échelle est vérifiée par l'estimation, et le
// bandeau nomme le chiffre fautif et la fourchette attendue.
const ANAT_ROTULE_TOLERANCE=0.15;
/** PURE. null si la mesure est plausible pour cette taille, sinon ce qu'il faut en dire. */
function anatRotuleInvraisemblable(genouCm,tailleCm){
  const g=Number(genouCm), t=Number(tailleCm);
  if(!(g>0)||!(t>0)) return null;
  const att=ANAT_ROTULE.part*t;
  if(Math.abs(g/att-1)<=ANAT_ROTULE_TOLERANCE) return null;
  return {cm:g,taille:t,min:Math.round(att*(1-ANAT_ROTULE_TOLERANCE)),
    max:Math.round(att*(1+ANAT_ROTULE_TOLERANCE))};
}
const ANAT_ECHELLE_A_VERIFIER_PCT=5;
/**
 * PURE. Les deux échelles d'une vue de face, et leur accord.
 * @returns {null|{e1:number|null,e2:number|null,ratio:number,ecart:number,
 *   statut:'confirmee'|'verifier'|'divergence',source:'metre'|'estimation',
 *   mesureCm:number|null,hGenouPx:number,genouCm1:number|null,genouCm2:number|null}}
 */
function anatVerifEchelle(u,F,kGenou){
  if(!F||F.sol==null||!(F.stature>0)) return null;
  const g=F.P2('genou','g'),d=F.P2('genou','d');
  if(!g||!d) return null;
  // Le genou du moteur, corrigé de son biais quand il est calibré (A6).
  const hG=(F.sol-(g.y+d.y)/2)/((kGenou>0)?kGenou:1);
  if(!(hG>0)) return null;
  const e1=F.cmPx||null;
  // Le mètre d'abord : l'échelle du lot 7, sur la même hauteur de genou.
  const m=_anatSafe(()=>morphoEchellePhoto(u,{genou:hG}));
  let ecartee=null;
  if(m&&m.cmPx&&e1){
    const ratio=m.cmPx/e1;
    const v=_anatStatutEchelle({e1,e2:m.cmPx,ratio,source:'metre',mesureCm:m.genouCm,hGenouPx:hG});
    // La mesure ne colle pas avec la photo ET ne colle pas avec la taille :
    // c'est elle qui est fausse, pas les points. On passe à l'estimation.
    if(v.statut==='divergence') ecartee=anatRotuleInvraisemblable(m.genouCm,_anatSafe(()=>_tailleCm(u)));
    if(!ecartee) return v;
  }
  // Sinon l'estimation : l'écart ne dépend alors pas de la taille (0,278 × la
  // hauteur du corps sur la photo, comparé à la hauteur du genou).
  const ratio=ANAT_ROTULE.part*F.stature/hG;
  const r=_anatStatutEchelle({e1,e2:e1?e1*ratio:null,ratio,source:'estimation',mesureCm:null,hGenouPx:hG});
  if(ecartee) r.mesureEcartee=ecartee;
  // LA CAUSE, QUAND ÇA DIVERGE : une photo en plongée écrase les jambes, et le
  // genou tombe trop bas. Les points n'y sont pour rien.
  if(r.statut==='divergence'){
    const pv=_anatSafe(()=>anatPriseDeVue(F));
    if(pv&&pv.sens) r.prise=pv;
  }
  return r;
}
/** PURE. La prise de vue d'une vue de face (épaules, hanches, chevilles posées). */
function anatPriseDeVue(F){
  if(!F||!F.P2) return null;
  const m=k=>{ const g=F.P2(k,'g'),d=F.P2(k,'d'); return (g&&d)?(g.y+d.y)/2:null; };
  const e=m('epaule'),h=m('hanche'),c=m('cheville');
  if(e==null||h==null||c==null) return null;
  return priseDeVue(e,h,c);
}
function _anatStatutEchelle(o){
  const ecart=Math.abs(o.ratio-1);
  o.ecart=ecart;
  o.statut=ecart<=ANAT_ECHELLE_CONFIRMEE?'confirmee':(ecart<=MORPHO_ECHELLE_ECART_MAX?'verifier':'divergence');
  o.genouCm1=o.e1?o.hGenouPx*o.e1:null;
  o.genouCm2=o.e2?o.hGenouPx*o.e2:null;
  return o;
}
/**
 * UN BIAIS MOTEUR APPRIS, JAMAIS SUPPOSÉ (audit morpho, chantier A6).
 *
 * Les points du moteur ne sont exactement ni des repères osseux ni des centres
 * articulaires : un poignet posé un peu trop haut, un genou un peu trop bas, et
 * chaque segment sort plus long ou plus court qu'au mètre, toujours du même
 * côté. On ne suppose pas ce biais : on l'APPREND sur les athlètes du coach qui
 * ont les deux — une analyse photo ET la mesure au mètre de même définition.
 *   - bras      : deb-bras, pointe de l'épaule → poignet  ↔ acromion → poignet ;
 *   - avantbras : deb-avantbras, olécrane → styloïde        ↔ coude → poignet ;
 *   - rotule    : deb-rotule, sol → milieu de la rotule     ↔ sol → genou.
 * Rapport photo / mètre par athlète, puis médiane (une faute de frappe ne la
 * déplace pas) et écart interquartile ramené à un écart-type robuste.
 * ⚠ MÊME RÈGLE QUE morphoCalibrage : rien sous MORPHO_CALIB_MIN (8) athlètes.
 *   Une médiane sur trois personnes n'est pas une calibration.
 * ⚠ SANS CALIBRATION, la marge des longueurs intègre ±3 % de biais possible.
 * ⚠ LE MÈTRE PRIME TOUJOURS : si l'athlète a sa propre mesure, elle remplace la
 *   photo pour ce segment ; la photo devient un contrôle.
 */
const ANAT_BIAIS_SEGMENTS=Object.freeze([
  Object.freeze({cle:'bras',metre:'deb-bras',lib:'membre supérieur (pointe de l’épaule → poignet)'}),
  Object.freeze({cle:'avantbras',metre:'deb-avantbras',lib:'avant-bras (coude → poignet)'}),
  Object.freeze({cle:'rotule',metre:'deb-rotule',lib:'hauteur de genou (sol → rotule)'})
]);
const ANAT_BIAIS_DEFAUT_PCT=3;
/**
 * PURE. Le biais du moteur, appris sur une population d'athlètes : pour chaque
 * segment calibré, {k (médiane photo / mètre), iqr, sd (en fraction), n}.
 * `null` si aucun segment n'atteint MORPHO_CALIB_MIN athlètes.
 */
function anatBiaisMoteur(athletes){
  const out={};
  for(const sg of ANAT_BIAIS_SEGMENTS){
    const r=[];
    for(const u of (Array.isArray(athletes)?athletes:[])){
      const a=u&&u.morphoAnat;
      if(!a||!a.face) continue;
      let ph=null;
      try{ ph=anatMesures(a,u,{brut:true}).photoCm; }catch(e){ ph=null; }
      const m=_anatSafe(()=>mesureMorpho(u,sg.metre));
      if(ph&&ph[sg.cle]>0&&m&&m.cm>0) r.push(ph[sg.cle]/m.cm);
    }
    if(r.length<MORPHO_CALIB_MIN) continue;
    const t=r.slice().sort((x,y)=>x-y);
    const q=f=>t[Math.min(t.length-1,Math.max(0,Math.round(f*(t.length-1))))];
    const iqr=q(0.75)-q(0.25);
    out[sg.cle]={k:_morphoMediane(r),iqr,sd:iqr/1.349,n:r.length};
  }
  return Object.keys(out).length?out:null;
}
// Le biais des athlètes DU COACH, recalculé seulement quand un dossier change.
let _anatBiaisCache={cle:'',val:null};
function anatBiaisCoach(){
  let l=[];
  try{ l=_morphoAthletesDuCoach()||[]; }catch(e){ l=[]; }
  const cle=l.map(u=>(u&&u.email)+':'+((u&&u.updatedAt)||0)).join('|');
  if(cle!==_anatBiaisCache.cle) _anatBiaisCache={cle,val:_anatSafe(()=>anatBiaisMoteur(l))};
  return _anatBiaisCache.val;
}
/**
 * MONTRER LA CONFIANCE, PAS SEULEMENT LA VALEUR (audit morpho, chantier A7).
 * Chaque point porte une note : A posé à la main, B lu par le moteur et bien
 * visible (≥ 0,8), C sinon — estimé, gabarit, peu visible. Une fiche vaut son
 * point le plus faible. Elle perd un cran quand l'échelle n'est pas confirmée
 * (A4) — pour les LONGUEURS seulement : une inclinaison ou un angle ne dépend
 * pas de l'échelle — ou quand le corps est tourné (anatRotation, chantier A8,
 * si elle existe et annonce plus de 8°).
 */
const ANAT_CONF_VIS_MIN=0.8;
const ANAT_CONF_MOTS=Object.freeze({A:'points posés à la main',B:'points lus par le moteur, bien visibles',C:'au moins un point estimé ou peu visible'});
function anatConfPoint(q){
  if(!q) return 'C';
  if(q[2]>=2) return 'A';
  if(q[2]>=0.9&&q[3]!=null&&q[3]>=ANAT_CONF_VIS_MIN) return 'B';
  return 'C';
}
/** PURE. La confiance d'une liste de points (clés), et ceux qui la tirent vers C. */
function anatConfiance(pts,cles,degrade){
  const rang={A:2,B:1,C:0}, lettre=['C','B','A'];
  let r=2; const faibles=[];
  for(const k of cles||[]){ const c=anatConfPoint(pts&&pts[k]); if(rang[c]<r) r=rang[c]; if(c==='C') faibles.push(k); }
  if(!(cles&&cles.length)) r=0;
  const brut=lettre[r];
  const n=Math.max(0,r-(degrade||[]).length);
  return {conf:lettre[n],brut,faibles,degrade:degrade||[]};
}
/**
 * PAS D'ASYMÉTRIE SUR UN CORPS TOURNÉ (audit morpho, chantier A8).
 * Un corps tourné d'un angle θ face à l'objectif rétrécit ses largeurs en
 * projection, les épaules plus que le bassin : le rapport épaules / hanches
 * de la photo de face, divisé par le même rapport de dos, le montre. On en
 * tire θ ≈ acos(rapport) — rapport pris sous 1 (la vue la plus étroite est
 * celle qui a tourné). L'écart de longueur des deux bras (épaule → poignet)
 * est rendu à côté, en second indice.
 * ⚠ acos est très raide près de 1 : 1 % de rapport vaut déjà 8°. Le placement
 *   de huit points fait bouger ce rapport de quelques % sur un corps bien de
 *   face : sous ANAT_ROTATION_BRUIT, la rotation n'est pas « fiable » et ne
 *   neutralise rien.
 */
const ANAT_ROTATION_SEUIL=8;
const ANAT_ROTATION_BRUIT=0.03;
const ANAT_ROTATION_CONSIGNE='Reprendre la photo corps bien de face à l’objectif : pieds, bassin et épaules parallèles au téléphone, bras relâchés, regard droit.';
function anatRotation(anat){
  const lire=vue=>{
    const v=anat&&anat[vue]; if(!v) return null;
    if(v.auto&&v.auto.gabarit&&!v.man) return null;
    const p=anatPoints(anat,vue); if(!p) return null;
    const W=v.w||1,H=v.h||1;
    const lx=(a,b)=>(p[a]&&p[b])?Math.abs(p[a][0]-p[b][0])*W:null;
    const ep=lx('epaule_l','epaule_r'), ha=lx('hanche_l','hanche_r');
    const bras=s=>{ const a=p['epaule_'+s],b=p['poignet_'+s]; return a&&b?Math.hypot((a[0]-b[0])*W,(a[1]-b[1])*H):null; };
    return {r:(ep&&ha)?ep/ha:null,bg:bras('l'),bd:bras('r')};
  };
  const F=lire('face'), D=lire('dos');
  if(!F||F.r==null) return null;
  const asyBras=(F.bg&&F.bd)?Math.abs(F.bg-F.bd)/((F.bg+F.bd)/2):null;
  if(!D||D.r==null) return {deg:null,fiable:false,rapport:null,vue:null,asyBras};
  const brut=F.r/D.r, rr=Math.min(brut,1/brut);
  const deg=Math.round(Math.acos(Math.min(1,rr))*180/Math.PI*10)/10;
  return {deg,fiable:(1-rr)>ANAT_ROTATION_BRUIT,rapport:Math.round(brut*1000)/1000,vue:brut<1?'face':'dos',asyBras};
}
/** PURE. Les compteurs des résultats : « à surveiller » ne compte que A et B. */
function anatCompteurs(fiches){
  const l=fiches||[];
  const fort=f=>f.niveau!=null&&Math.abs(f.niveau)>=2;
  return {surveiller:l.filter(f=>fort(f)&&f.conf!=='C').length,
    confirmer:l.filter(f=>fort(f)&&f.conf==='C').length,
    marge:l.filter(f=>f.niveau===0).length,
    illisibles:l.filter(f=>f.niveau==null).length};
}
/** Le mot de l'échelle, le même partout. */
const ANAT_ECHELLE_MOTS=Object.freeze({confirmee:'échelle confirmée',verifier:'échelle à vérifier',divergence:'échelles divergentes'});
const ANAT_SEUILS_Z=[1,1.5,2];
/** L'erreur de placement d'un point, d'après sa marque (2 main, 1 moteur, sinon estimé). */
function anatErrPoint(e){ return e>=2?ANAT_ERR.main:(e>=0.9?ANAT_ERR.auto:ANAT_ERR.estime); }
/**
 * PURE. L'erreur de placement d'une longueur, en %, entre deux extrémités qui
 * sont chacune la moyenne d'un ou plusieurs points : une moyenne de n points
 * se trompe de √(Σe²)/n.
 */
function anatErrSeg(A,B){
  const bout=l=>{ const v=(l||[]).filter(Boolean); if(!v.length) return ANAT_ERR.estime;
    return Math.sqrt(v.reduce((s,p)=>s+Math.pow(anatErrPoint(p.e),2),0))/v.length; };
  return Math.hypot(bout(A),bout(B));
}
/** PURE. La fonction de répartition de la loi normale (Abramowitz & Stegun 26.2.17). */
function anatPhi(z){
  const t=1/(1+0.2316419*Math.abs(z));
  const q=0.3989422804014327*Math.exp(-z*z/2)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  return z>=0?1-q:q;
}
/** PURE. « 72ᵉ percentile », ou « parmi les 5 % … » aux deux bouts. */
function anatPercentileTxt(pct,haut,bas){
  if(pct>=95) return 'parmi les 5 % '+haut;
  if(pct<=5) return 'parmi les 5 % '+bas;
  const n=Math.round(pct);
  return n+(n===1?'ᵉʳ':'ᵉ')+' percentile';
}
/**
 * PURE. Le classement d'un écart (en %) : z, percentile, niveau, et de quoi
 * écrire la marge. `null` sans écart.
 */
function anatClasser(ec,disp,err,haut,bas){
  if(ec==null||!isFinite(ec)) return null;
  const sd=Math.hypot(disp,err), z=ec/sd, pct=anatPhi(z)*100;
  // `court` : pour la colonne des résultats, dont les rangées sont calées sur la
  // hauteur de la photo ; le sens est déjà dans le verdict juste au-dessus.
  const court=pct>=95?'≥ 95ᵉ percentile':(pct<=5?'≤ 5ᵉ percentile':anatPercentileTxt(pct,haut,bas));
  return {z,pct,sd,disp,err,niveau:_anatNiveau(z,ANAT_SEUILS_Z),txt:anatPercentileTxt(pct,haut,bas),court};
}
/** PURE. La marge d'un angle entre points : la tolérance de pose, et le placement. */
function anatMargeAngle(tol,pts,poidsMilieu){
  const v=(pts||[]).filter(Boolean);
  if(!v.length) return tol;
  const e=Math.sqrt(v.reduce((s,p,i)=>s+Math.pow(anatErrPoint(p.e)*((poidsMilieu&&i===1)?2:1),2),0));
  return Math.hypot(tol,_anatDeg(Math.atan(e/100)));
}
const ANAT_TOL={epaules:1.5,bassin:2,genoux:3,pieds:8,tronc:3,omoplates:1.2,rachis:2,triangles:25,echelle:3,cva:3,profil:2,coudes:2,arrierePied:3,omoInt:1};
const ANAT_SEUILS={epaules:[1.5,3,5],bassin:[2,3.5,5],genoux:[3,5,8],pieds:[8,14,20],
  tronc:[3,6,9],omoplates:[1.2,2.5,4],rachis:[2,4,6],triangles:[25,45,65],
  // Le profil (A9) : degrés sous le repère cranio-vertébral, degrés de tronc,
  // cm du grand trochanter au fil à plomb, degrés au-delà de 180° au genou.
  cva:[4,8,12],inclTronc:[3,6,9],plombCm:[3,6,9],recurvatum:[5,8,12],
  // L'arrière-pied (A11) : 0–4° dans la marge, 4–8° léger, 8–12° net, au-delà marqué.
  arrierePied:[4,8,12],
  // Le bord interne des omoplates (A14) : cm d'écart G/D à l'axe C7-sacrum.
  omoInt:[1,2,3]};
/** L'erreur de placement d'un point de profil, en cm (main, moteur, estimé). */
const ANAT_ERR_CM=Object.freeze({main:1,auto:2,estime:3});
/**
 * Les repères du profil (A9). ⚠ Le 50° de l'angle cranio-vertébral est un
 * REPÈRE DE TRAVAIL (l'ordre de grandeur d'un adulte debout) : à calibrer sur
 * les athlètes du coach, comme les axes de « morpho-reperes-a-calibrer ».
 */
const ANAT_PROFIL=Object.freeze({cva:50,recurvatum:5,
  SOURCE_REF:'ligne de référence de Kendall (Muscles: Testing and Function)',
  SOURCE_METH:'protocole SAPO (Ferreira et al., Clinics 2010)',
  CVA_SOURCE:'repère de travail 50°, à calibrer',
  CONSIGNE:'Photo de profil en pied : debout relâché, bras le long du corps, regard à l’horizontale, pieds joints dans l’axe de l’objectif, téléphone à hauteur de hanche et à 3 m environ.'});

/**
 * Les repères de chaque vue. `_l` et `_r` sont les côtés DE L'IMAGE (gauche et
 * droite de l'écran) — jamais ceux de l'athlète, qui dépendent de la vue et du
 * miroir (voir anatCotes). `est` : repère que le moteur ne voit pas et que
 * l'on ESTIME à partir des autres — à vérifier par le coach en priorité.
 */
const ANAT_REPERES=Object.freeze({
  face:[
    {k:'vertex',lib:'Sommet du crâne'},
    {k:'acromion',lib:'Acromion (pointe osseuse de l’épaule)',paire:1,est:1},
    {k:'epaule',lib:'Centre de l’épaule',paire:1},
    {k:'deltoide',lib:'Bord du deltoïde',paire:1},
    {k:'coude',lib:'Coude',paire:1},
    {k:'poignet',lib:'Poignet',paire:1},
    {k:'taille',lib:'Bord de la taille',paire:1},
    {k:'crete',lib:'Crête iliaque',paire:1,est:1},
    {k:'hanche',lib:'Centre de la hanche',paire:1},
    {k:'genou',lib:'Genou',paire:1},
    {k:'cheville',lib:'Cheville',paire:1},
    {k:'talon',lib:'Talon (sol)',paire:1},
    {k:'pointe',lib:'Pointe du pied',paire:1}],
  dos:[
    {k:'vertex',lib:'Sommet du crâne'},
    {k:'c7',lib:'Vertèbre C7 (base du cou)',est:1},
    {k:'acromion',lib:'Acromion',paire:1,est:1},
    {k:'epaule',lib:'Centre de l’épaule',paire:1},
    {k:'omoplate',lib:'Pointe basse de l’omoplate',paire:1,est:1},
    {k:'omoplate_int',lib:'Bord interne de l’omoplate (mi-hauteur)',paire:1,est:1},
    {k:'coude',lib:'Coude',paire:1},
    {k:'poignet',lib:'Poignet',paire:1},
    {k:'taille',lib:'Bord de la taille',paire:1},
    {k:'crete',lib:'Crête iliaque',paire:1,est:1},
    {k:'sacrum',lib:'Sacrum (fossettes)',est:1},
    {k:'hanche',lib:'Centre de la hanche',paire:1},
    {k:'genou',lib:'Creux du genou',paire:1},
    {k:'mollet',lib:'Milieu du mollet',paire:1},
    {k:'cheville',lib:'Cheville',paire:1},
    {k:'achille',lib:'Tendon d’Achille (niveau des malléoles)',paire:1},
    {k:'talon',lib:'Talon (sol)',paire:1}],
  // LE PROFIL (A9) : les repères du protocole SAPO (Ferreira et al., Clinics
  // 2010) sur la ligne de référence de Kendall, plus le crâne et le talon
  // pour l'échelle. Un seul côté se voit : pas de paires.
  profil:[
    {k:'vertex',lib:'Sommet du crâne'},
    {k:'tragus',lib:'Tragus (devant l’oreille)'},
    {k:'c7',lib:'Vertèbre C7 (base du cou)',est:1},
    {k:'acromion',lib:'Acromion (pointe de l’épaule)',est:1},
    {k:'trochanter',lib:'Grand trochanter (hanche)'},
    {k:'genou',lib:'Genou (condyle latéral)'},
    {k:'malleole',lib:'Malléole latérale (cheville)'},
    {k:'talon',lib:'Talon (sol)'}]
});
/** Toutes les clés d'une vue, paires dédoublées. */
function anatCles(vue){
  const out=[];
  for(const r of ANAT_REPERES[vue]||[]){
    if(r.paire){ out.push(r.k+'_l',r.k+'_r'); } else out.push(r.k);
  }
  return out;
}
function anatRepere(vue,cle){
  const k=String(cle).replace(/_[lr]$/,'');
  return (ANAT_REPERES[vue]||[]).find(r=>r.k===k)||null;
}
/**
 * Le côté de l'image qui porte la GAUCHE de l'athlète.
 * De face, photo prise par quelqu'un d'autre : sa gauche est à droite de
 * l'écran. Dans un miroir, l'image est inversée : sa gauche est à gauche. De
 * dos : à gauche, toujours.
 */
/** La vue affichée : celle demandée si le dossier la porte, sinon la face. */
function _anatVueDe(a,v){
  return (v==='dos'&&a&&a.dos)?'dos':((v==='profil'&&a&&a.profil)?'profil':'face');
}
/** La photo d'une vue, dans le bilan lu. */
function _anatSrcVue(pb,vue){
  return vue==='dos'?pb.dos:(vue==='profil'?pb.profil:pb.face);
}
function anatCotes(vue,miroir){
  const g=(vue==='dos'||miroir)?'l':'r';
  return {g,d:g==='l'?'r':'l'};
}

/**
 * PURE. Le bilan dont on lit les photos, et ce qui manque.
 * ⚠ PAR DÉFAUT LE PREMIER, PAS LE PLUS RÉCENT : c'est le corps de départ qu'on
 *   lit. Un bilan « départ » passe avant tous les autres ; sinon le plus ancien.
 * ⚠ SAUF CHOIX DU COACH (25/09/2026, Kevin : « le départ en automatique et
 *   après possibilité de le changer »). Le choix vit dans `morphoAnat.choix`
 *   (la date du bilan) ; un choix qui ne désigne plus un bilan à photo de face
 *   — bilan supprimé, photo retirée — est ignoré, et l'on retombe sur le
 *   départ plutôt que sur un écran vide.
 * @returns {{bilan:any|null,date:number,face:string|null,dos:string|null,manque:string[],auto:boolean,defaut:number}}
 */
function anatPremierBilan(u){
  let bl=[];
  try{ bl=(Array.isArray(u&&u.bilans)?u.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  if(!bl.length) return {bilan:null,date:0,face:null,dos:null,manque:['le premier bilan'],locales:[],auto:true,defaut:0};
  const dep=bl.filter(b=>b.type==='depart').sort((a,b)=>a.date-b.date);
  const reste=bl.filter(b=>b.type!=='depart').sort((a,b)=>a.date-b.date);
  const ordre=dep.concat(reste);
  const src=(b,v)=>{ try{ return photoBilanSrc(b,v)||null; }catch(e){ return null; } };
  // ⚠ UNE RÉFÉRENCE SANS URL (E2, 25/09/2026) : la photo existe, mais son blob
  //   n'est que sur le téléphone de l'athlète — l'envoi a échoué. Ce n'est pas
  //   « il manque la photo » : l'athlète l'a prise, et lui redemander de la
  //   prendre serait faux. On le dit tel quel, au coach et dans le message.
  const locale=(b,v)=>{ try{ const r=photoBilanRef(b,v); return !!(r&&r.cle&&!r.url)&&!src(b,v); }catch(e){ return false; } };
  // Par défaut, le premier bilan qui porte face ET dos ; à défaut, le premier
  // à photo de face ; à défaut, le premier dont les photos attendent l'envoi.
  const parDefaut=ordre.find(x=>src(x,'face')&&src(x,'back'))||ordre.find(x=>src(x,'face'))
    ||ordre.find(x=>locale(x,'face')||locale(x,'back'))||ordre[0];
  const choix=Number(u&&u.morphoAnat&&u.morphoAnat.choix)||0;
  const choisi=choix?bl.find(x=>Number(x.date)===choix&&src(x,'face')):null;
  const b=choisi||parDefaut;
  const face=src(b,'face'), dos=src(b,'back'), profil=src(b,'side');
  const manque=[], locales=[];
  if(!face){ if(locale(b,'face')){ locales.push('face'); manque.push(ANAT_MANQUE_LOCALE.face); } else manque.push('la photo de face'); }
  if(!dos){ if(locale(b,'back')){ locales.push('dos'); manque.push(ANAT_MANQUE_LOCALE.dos); } else manque.push('la photo de dos'); }
  // La photo de profil (A9) n'est pas exigée : sans elle, pas de fiches
  // Posture ni Tête et cou, et rien d'autre ne change.
  return {bilan:b,date:Number(b.date)||0,face,dos,profil,manque,locales,
    auto:!choisi||Number(choisi.date)===Number(parDefaut.date),defaut:Number(parDefaut.date)||0};
}
const ANAT_MANQUE_LOCALE=Object.freeze({
  face:'la photo de face (restée sur le téléphone, pas encore synchronisée)',
  dos:'la photo de dos (restée sur le téléphone, pas encore synchronisée)'});
/**
 * PURE. Les bilans qu'on peut analyser — ceux qui portent une photo de face —,
 * du plus ancien au plus récent, et lequel est le choix par défaut.
 * @returns {{date:number,depart:boolean,dos:boolean,defaut:boolean}[]}
 */
function anatBilansPhotos(u){
  let bl=[];
  try{ bl=(Array.isArray(u&&u.bilans)?u.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  const src=(b,v)=>{ try{ return photoBilanSrc(b,v)||null; }catch(e){ return null; } };
  const def=anatPremierBilan(Object.assign({},u,{morphoAnat:null})).date;
  return bl.filter(b=>src(b,'face')).sort((a,b)=>a.date-b.date)
    .map(b=>({date:Number(b.date),depart:b.type==='depart',dos:!!src(b,'back'),profil:!!src(b,'side'),defaut:Number(b.date)===def}));
}

// ── LE MASQUE : il ne sert qu'à PLACER des points ─────────────────────────
function anatMasqueBits(m){
  if(!m||!m.rle||!(m.w>0)||!(m.h>0)) return null;
  const bits=new Uint8Array(m.w*m.h);
  let i=0,v=0;
  for(const s of String(m.rle).split('.')){
    const n=parseInt(s,36)||0;
    if(v) bits.fill(1,i,Math.min(bits.length,i+n));
    i+=n; v=1-v;
  }
  return bits;
}
function _anatPlages(bits,m,y){
  const out=[];
  const yy=Math.max(0,Math.min(m.h-1,Math.round(y)));
  let deb=-1;
  for(let x=0;x<m.w;x++){
    const b=bits[yy*m.w+x];
    if(b&&deb<0) deb=x;
    if(!b&&deb>=0){ out.push([deb,x]); deb=-1; }
  }
  if(deb>=0) out.push([deb,m.w]);
  return out.filter(p=>p[1]-p[0]>1);
}
const _anatMil=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const _anatDist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const _anatDeg=r=>r*180/Math.PI;
function _anatN(x,d){
  const n=(d==null?1:d);
  const k=Math.pow(10,n);
  const v=Math.round(Math.abs(Number(x))*k)/k;
  // Les rapports gardent leurs deux décimales (« 1,00 », pas « 1 ») ; les
  // centimètres et les degrés perdent le « ,0 » inutile.
  return (n>=2?v.toFixed(n):String(v)).replace('.',',');
}
function _anatSN(x,d){
  const k=Math.pow(10,d==null?1:d);
  const z=Math.round(Math.abs(Number(x))*k)===0;
  return (z?'':(x>0?'+':x<0?'−':''))+_anatN(x,d);
}
function _anatNiveau(v,seuils){
  const a=Math.abs(v);
  let n=0;
  if(a>seuils[0]) n=1;
  if(a>seuils[1]) n=2;
  if(a>seuils[2]) n=3;
  return n===0?0:n*(v<0?-1:1);
}

/**
 * PURE. Les repères automatiques d'une vue, à partir de ce que le moteur a lu
 * (33 points normalisés + masque). Rend des points normalisés [x, y, e] où e
 * vaut 1 (vu par le moteur), 0,5 (estimé à partir des autres) ou 0,2 (vu, mais
 * sans certitude).
 * @param {{w:number,h:number,pts:number[][],masque:any}} raw
 * @param {'face'|'dos'} vue
 */
function anatPointsAuto(raw,vue){
  if(!raw||!Array.isArray(raw.pts)||raw.pts.length<33) return null;
  if(vue==='profil') return _anatPointsAutoProfil(raw);
  const W=raw.w,H=raw.h;
  const P=i=>{ const q=raw.pts[i]; return q?{x:q[0]*W,y:q[1]*H,v:q[2]||0}:null; };
  const e=v=>v>=0.6?1:0.2;
  const out={};
  const pose=(k,p,conf)=>{ if(p&&isFinite(p.x)&&isFinite(p.y)){
    out[k]=[Math.round(p.x/W*10000)/10000,Math.round(p.y/H*10000)/10000,conf];
    // La visibilité du moteur, quand le point vient de lui (A7).
    if(p.v!=null&&isFinite(p.v)) out[k].push(Math.round(p.v*100)/100); } };
  // Les paires, rangées par côté de l'IMAGE : l'étiquette gauche/droite du
  // moteur n'est pas fiable de dos, ni dans un miroir.
  const paire=(a,b)=>{ const A=P(a),B=P(b); if(!A||!B) return null; return A.x<=B.x?{l:A,r:B}:{l:B,r:A}; };
  const ep=paire(11,12), ha=paire(23,24);
  if(!ep||!ha) return null;
  const mEp=_anatMil(ep.l,ep.r), mHa=_anatMil(ha.l,ha.r);
  const T=_anatDist(mEp,mHa);
  if(!(T>10)) return null;
  const bits=anatMasqueBits(raw.masque), m=raw.masque;
  const kx=m?m.w/W:1, ky=m?m.h/H:1;
  for(const s of ['l','r']){
    pose('epaule_'+s,ep[s],e(ep[s].v));
    pose('hanche_'+s,ha[s],e(ha[s].v));
  }
  for(const [nom,a,b] of [['coude',13,14],['poignet',15,16],['genou',25,26],['cheville',27,28],['talon',29,30],['pointe',31,32]]){
    if(vue==='dos'&&nom==='pointe') continue;
    const p=paire(a,b);
    if(!p) continue;
    pose(nom+'_l',p.l,e(p.l.v)); pose(nom+'_r',p.r,e(p.r.v));
  }
  const dehors=(p,s,d)=>({x:p.x+(s==='l'?-d:d),y:p.y});
  // ACROMION : au-dessus et en dehors du centre de l'épaule. Le moteur ne le
  // voit pas ; on le pose à 12 % du tronc en dehors, 7 % au-dessus — l'ordre
  // de grandeur anatomique — et on le marque estimé.
  // ⚠ RECALÉ SUR LA SILHOUETTE. La pointe de l'acromion est à ~2,5 cm en
  //   dehors du centre de la tête humérale et ~3 cm au-dessus (≈ 5 % et 6 %
  //   du tronc) ; le deltoïde déborde encore de 2 à 4 cm. Quand le masque se
  //   lit, on ne dépasse jamais le bord de l'épaule moins cette épaisseur.
  for(const s of ['l','r']){
    const y=ep[s].y-0.06*T;
    let x=dehors(ep[s],s,0.05*T).x;
    if(bits){
      const pl=_anatPlages(bits,m,y*ky);
      const c=pl.find(q=>q[0]<=mEp.x*kx&&q[1]>=mEp.x*kx);
      if(c){
        const lim=(s==='l'?c[0]/kx+0.05*T:c[1]/kx-0.05*T);
        x=(s==='l')?Math.max(x,lim):Math.min(x,lim);
      }
    }
    pose('acromion_'+s,{x,y},0.5);
  }
  // CRÊTE ILIAQUE : environ 7 % de la taille au-dessus du centre de la
  // hanche (Drillis & Contini : 0,53 H à la hanche, ~0,60 H à la crête).
  // Latéralement, sur le bord du tronc s'il se lit, en retrait des tissus.
  const yCrete=mHa.y-0.24*T;
  for(const s of ['l','r']){
    let x=dehors(ha[s],s,0.08*T).x;
    if(bits){
      const pl=_anatPlages(bits,m,yCrete*ky);
      const c=pl.find(q=>q[0]<=mHa.x*kx&&q[1]>=mHa.x*kx);
      if(c&&pl.length>=3){ const bord=(s==='l'?c[0]:c[1])/kx; x=bord+(s==='l'?0.06*T:-0.06*T); }
    }
    pose('crete_'+s,{x,y:yCrete},0.5);
  }
  // LE SOMMET DU CRÂNE : le haut du masque au-dessus des épaules, s'il tombe
  // à une hauteur plausible ; sinon l'estimation par les proportions (Drillis
  // & Contini : sommet → épaule = 0,18 H, tronc = 0,29 H, soit 0,63 tronc).
  // ⚠ UN TÉLÉPHONE DEVANT LE VISAGE EST DANS LE MASQUE : le haut de la
  //   personne reste le haut de la personne, le téléphone étant plus bas.
  // ⚠ EN REMONTANT DEPUIS LES ÉPAULES, SANS SAUTER DE TROU. Chercher « le
  //   pixel le plus haut au-dessus des épaules » prenait la lampe du plafond
  //   pour une tête (Kevin, 24/09/2026) : un objet clair derrière la personne
  //   entre dans le masque. On suit la colonne du cou vers le haut et on
  //   s'arrête au premier vide de plus de deux lignes.
  let vertex=null;
  if(bits){
    const x0=Math.max(0,Math.round((mEp.x-0.12*T)*kx)), x1=Math.min(m.w-1,Math.round((mEp.x+0.12*T)*kx));
    let y=Math.min(m.h-1,Math.round((mEp.y-0.05*T)*ky)), haut=null, vide=0;
    for(;y>=0;y--){
      let plein=false;
      for(let x=x0;x<=x1;x++) if(bits[y*m.w+x]){ plein=true; break; }
      if(plein){ haut=y; vide=0; } else if(++vide>2) break;
    }
    if(haut!=null) vertex={x:mEp.x,y:haut/ky};
    if(vertex&&!(vertex.y>mEp.y-0.95*T&&vertex.y<mEp.y-0.4*T)) vertex=null;
  }
  pose('vertex',vertex||{x:mEp.x,y:mEp.y-0.63*T},vertex?1:0.5);
  // LES TALONS, L'AUTRE BOUT DE L'ÉCHELLE (audit morpho, chantier A5). Le
  // moteur rend un point AU-DESSUS du bas du talon : la cheville se voit, le
  // contact avec le sol non. Mesuré de ce point, un corps paraît plus court
  // qu'il n'est, et toutes les longueurs mises à l'échelle s'allongent d'autant.
  //   - avec le masque : la dernière ligne pleine sous le talon (colonnes à
  //     ±4 % de la largeur de l'image), en descendant sans sauter de trou — un
  //     tapis, une ombre ou le reflet d'un miroir entrent aussi dans le masque ;
  //     retenue si elle est à moins de 3 % de la taille sous le point du moteur ;
  //   - sinon : le talon descend de 0,6 % de la taille (épaisseur talon-sol
  //     typique), et il est marqué ESTIMÉ.
  {
    const vy=out.vertex?out.vertex[1]*H:null;
    for(const s of ['l','r']){
      const t=out['talon_'+s];
      if(!t) continue;
      const tx=t[0]*W, ty=t[1]*H;
      const Hpx=(vy!=null&&ty>vy)?ty-vy:(3.4*T);
      let sol=null;
      if(bits){
        const x0=Math.max(0,Math.round((tx-0.04*W)*kx)), x1=Math.min(m.w-1,Math.round((tx+0.04*W)*kx));
        let y=Math.max(0,Math.round(ty*ky)), bas=null, vide=0;
        for(;y<m.h;y++){
          let plein=false;
          for(let x=x0;x<=x1;x++) if(bits[y*m.w+x]){ plein=true; break; }
          if(plein){ bas=y; vide=0; } else if(++vide>2) break;
        }
        if(bas!=null){ const yb=(bas+1)/ky; if(yb>=ty&&yb-ty<=0.03*Hpx) sol=yb; }
      }
      if(sol!=null) pose('talon_'+s,{x:tx,y:sol,v:t[3]},t[2]);
      else pose('talon_'+s,{x:tx,y:ty+0.006*Hpx},0.5);
    }
  }
  // Les bords de la silhouette : deltoïdes et taille.
  let taille=null,delt=null;
  if(bits){
    let best=0;
    for(let f=0.06;f<=0.20;f+=0.02){
      const y=(mEp.y+T*f);
      const pl=_anatPlages(bits,m,y*ky);
      const c=pl.find(q=>q[0]<=mEp.x*kx&&q[1]>=mEp.x*kx);
      if(c&&c[1]-c[0]>best){ best=c[1]-c[0]; delt={l:{x:c[0]/kx,y},r:{x:c[1]/kx,y}}; }
    }
    let min=Infinity;
    for(let f=0.50;f<=0.90;f+=0.02){
      const y=mEp.y+(mHa.y-mEp.y)*f, cx=mEp.x+(mHa.x-mEp.x)*f;
      const pl=_anatPlages(bits,m,y*ky);
      if(pl.length<3) continue;
      const c=pl.find(q=>q[0]<=cx*kx&&q[1]>=cx*kx);
      if(c&&c[1]-c[0]<min){ min=c[1]-c[0]; taille={l:{x:c[0]/kx,y},r:{x:c[1]/kx,y}}; }
    }
  }
  for(const s of ['l','r']){
    pose('deltoide_'+s,delt?delt[s]:{x:dehors(ep[s],s,0.22*T).x,y:ep[s].y+0.12*T},delt?1:0.5);
    const yT=mEp.y+(mHa.y-mEp.y)*0.72;
    pose('taille_'+s,taille?taille[s]:{x:dehors(ha[s],s,0.05*T).x,y:yT},taille?1:0.5);
  }
  if(vue==='dos'){
    pose('c7',{x:mEp.x,y:mEp.y-0.16*T},0.5);
    pose('sacrum',{x:mHa.x,y:mHa.y-0.10*T},0.5);
    for(const s of ['l','r'])
      pose('omoplate_'+s,{x:mEp.x+(ep[s].x-mEp.x)*0.55,y:ep[s].y+0.36*T},0.5);
    // A14 : le bord interne, à mi-hauteur de l'omoplate, au tiers de l'axe à l'épaule.
    for(const s of ['l','r'])
      pose('omoplate_int_'+s,{x:mEp.x+(ep[s].x-mEp.x)*0.3,y:ep[s].y+0.18*T},0.5);
    // L'ARRIÈRE-PIED (A11) : le milieu de la jambe à mi-mollet et à la hauteur
    // des malléoles, lu sur le masque (le centre de la plage qui contient la
    // jambe) ; sans masque, entre genou et cheville, et marqué estimé.
    for(const s of ['l','r']){
      const g=out['genou_'+s], c=out['cheville_'+s];
      if(!g||!c) continue;
      const G={x:g[0]*W,y:g[1]*H}, C={x:c[0]*W,y:c[1]*H};
      const milieu=(y,x0)=>{
        if(!bits) return null;
        const pl=_anatPlages(bits,m,y*ky);
        const q=pl.find(r=>r[0]<=x0*kx&&r[1]>=x0*kx);
        return q&&(q[1]-q[0])/kx<0.2*T?{x:(q[0]+q[1])/2/kx,y}:null;
      };
      const yM=G.y+(C.y-G.y)*0.45, xM=G.x+(C.x-G.x)*0.45;
      const mo=milieu(yM,xM);
      pose('mollet_'+s,mo||{x:xM,y:yM},mo?1:0.5);
      const ac=milieu(C.y,C.x);
      pose('achille_'+s,ac||{x:C.x,y:C.y},ac?1:0.5);
    }
  }
  // LE BRAS QUI TIENT LE TÉLÉPHONE. Kevin : « si la personne tient son
  // appareil photo devant lui, prends-le en considération ». Un poignet plus
  // haut que le coude, ou près du visage, n'est pas un bras relâché : il ne
  // donne aucune longueur, et c'est très probablement un selfie au miroir.
  // ⚠ UN SEUL BRAS. Les deux bras levés, c'est une pose (double biceps,
  //   vacuum), pas un téléphone : aucun des deux ne donne de longueur, mais
  //   on ne présume pas un miroir pour autant.
  const leves=[];
  const nez=P(0);
  for(const s of ['l','r']){
    const po=out['poignet_'+s], co=out['coude_'+s];
    if(!po||!co) continue;
    const pw={x:po[0]*W,y:po[1]*H}, cw={x:co[0]*W,y:co[1]*H};
    const pres=nez?_anatDist(pw,nez)<0.55*T:false;
    if(pw.y<cw.y-0.05*T||pres) leves.push(s);
  }
  const telephone=leves.length===1?leves[0]:null;
  // Les triangles bras-tronc, sur le masque : on les garde en nombre.
  let triangles=null;
  if(bits&&vue==='dos'){
    const gs=[],ds=[];
    for(let f=0.45;f<=0.80;f+=0.05){
      const y=(mEp.y+(mHa.y-mEp.y)*f)*ky, cx=(mEp.x+(mHa.x-mEp.x)*f)*kx;
      const pl=_anatPlages(bits,m,y);
      const t=pl.findIndex(p=>p[0]<=cx&&p[1]>=cx);
      if(pl.length<3||t<=0||t>=pl.length-1) continue;
      gs.push((pl[t][0]-pl[t-1][1])/kx); ds.push((pl[t+1][0]-pl[t][1])/kx);
    }
    if(gs.length>=3){
      const moy=a=>a.reduce((x,y)=>x+y,0)/a.length;
      triangles={l:Math.round(moy(gs)),r:Math.round(moy(ds))};
    }
  }
  return {pts:out,telephone,miroir:vue==='face'&&!!telephone,triangles};
}

/**
 * PURE. Les repères de la photo de PROFIL (A9). Le moteur voit les deux côtés
 * superposés : on garde celui qu'il voit le mieux (épaule, hanche, genou,
 * cheville, oreille). `sens` vaut +1 quand l'athlète regarde vers la droite de
 * l'image (le nez devant l'oreille). Le tragus est l'oreille du moteur ; le
 * grand trochanter, sa hanche ; l'acromion et C7 sont ESTIMÉS à partir de
 * l'épaule : le moteur ne les voit pas.
 */
function _anatPointsAutoProfil(raw){
  const W=raw.w,H=raw.h;
  const P=i=>{ const q=raw.pts[i]; return q?{x:q[0]*W,y:q[1]*H,v:q[2]||0}:null; };
  const e=v=>v>=0.6?1:0.2;
  const out={};
  const pose=(k,p,conf)=>{ if(p&&isFinite(p.x)&&isFinite(p.y)){
    out[k]=[Math.round(p.x/W*10000)/10000,Math.round(p.y/H*10000)/10000,conf];
    if(p.v!=null&&isFinite(p.v)) out[k].push(Math.round(p.v*100)/100); } };
  const vis=o=>[7,11,23,25,27].reduce((t,i)=>{ const q=P(i+o); return t+(q?q.v:0); },0);
  const o=vis(1)>vis(0)?1:0;   // 0 : côté gauche du moteur, 1 : côté droit
  const oreille=P(7+o), ep=P(11+o), ha=P(23+o), ge=P(25+o), ch=P(27+o), ta=P(29+o), nez=P(0), pied=P(31+o);
  if(!ep||!ha) return null;
  const T=_anatDist(ep,ha);
  if(!(T>10)) return null;
  const sens=(nez&&oreille&&Math.abs(nez.x-oreille.x)>2)?Math.sign(nez.x-oreille.x)
    :((pied&&ta)?Math.sign(pied.x-ta.x)||1:1);
  pose('tragus',oreille,oreille?e(oreille.v):0.5);
  pose('acromion',{x:ep.x,y:ep.y-0.04*T},0.5);
  // C7 : en arrière et au-dessus de l'épaule (≈ 6 cm derrière, 5 cm au-dessus
  // chez l'adulte, pour un tronc de 50 cm).
  pose('c7',{x:ep.x-sens*0.12*T,y:ep.y-0.10*T},0.5);
  pose('trochanter',ha,e(ha.v));
  if(ge) pose('genou',ge,e(ge.v));
  if(ch) pose('malleole',ch,e(ch.v));
  const bits=anatMasqueBits(raw.masque), m=raw.masque;
  const kx=m?m.w/W:1, ky=m?m.h/H:1;
  // Le sommet du crâne : le haut du masque au-dessus de l'oreille, sans sauter de trou.
  let vertex=null;
  const tete=oreille||{x:ep.x,y:ep.y-0.35*T};
  if(bits){
    const x0=Math.max(0,Math.round((tete.x-0.12*T)*kx)), x1=Math.min(m.w-1,Math.round((tete.x+0.12*T)*kx));
    let y=Math.min(m.h-1,Math.round(tete.y*ky)), haut=null, vide=0;
    for(;y>=0;y--){
      let plein=false;
      for(let x=x0;x<=x1;x++) if(bits[y*m.w+x]){ plein=true; break; }
      if(plein){ haut=y; vide=0; } else if(++vide>2) break;
    }
    if(haut!=null) vertex={x:tete.x,y:haut/ky};
    if(vertex&&!(vertex.y>tete.y-0.55*T&&vertex.y<tete.y-0.12*T)) vertex=null;
  }
  pose('vertex',vertex||{x:tete.x,y:tete.y-0.26*T},vertex?1:0.5);
  // Le talon au sol, comme de face : la dernière ligne pleine du masque.
  if(ta){
    let sol=null;
    if(bits){
      const x0=Math.max(0,Math.round((ta.x-0.04*W)*kx)), x1=Math.min(m.w-1,Math.round((ta.x+0.04*W)*kx));
      let y=Math.max(0,Math.round(ta.y*ky)), bas=null, vide=0;
      for(;y<m.h;y++){
        let plein=false;
        for(let x=x0;x<=x1;x++) if(bits[y*m.w+x]){ plein=true; break; }
        if(plein){ bas=y; vide=0; } else if(++vide>2) break;
      }
      if(bas!=null){ const yb=(bas+1)/ky; if(yb>=ta.y&&yb-ta.y<=0.1*T) sol=yb; }
    }
    if(sol!=null) pose('talon',{x:ta.x,y:sol,v:ta.v},e(ta.v));
    else pose('talon',{x:ta.x,y:ta.y+0.02*T},0.5);
  }
  return {pts:out,sens,telephone:null,miroir:false,triangles:null};
}
/** Les points effectifs d'une vue : ceux du coach s'il en a posé, sinon l'automatique. */
function anatPoints(anat,vue){
  const v=anat&&anat[vue];
  if(!v) return null;
  const auto=(v.auto&&v.auto.pts)||{};
  const man=v.man||null;
  const out={};
  for(const k of anatCles(vue)){
    if(man&&man[k]) out[k]=[man[k][0],man[k][1],2];
    else if(auto[k]) out[k]=auto[k].slice(0,4);
  }
  return out;
}
/** Les options (miroir, téléphone) : celles du coach d'abord. */
function anatOptions(anat){
  const o=(anat&&anat.opts)||{};
  const a=(anat&&anat.face&&anat.face.auto)||{};
  return {miroir:(o.miroir!=null)?!!o.miroir:!!a.miroir,
    telephone:(o.telephone!==undefined)?o.telephone:(a.telephone||null),
    // Chantier A5 : des cheveux volumineux cachent le haut du crâne. Le point se
    // pose sur l'os, sous les cheveux, et la marge d'échelle passe à ±4 %.
    cheveux:!!o.cheveux,
    // Chantier A10 : paumes vers l'avant, sans quoi l'angle de port ne se lit
    // pas. null : le coach n'a rien dit, le bilan décide (anatMesures).
    paumes:(o.paumes!=null)?!!o.paumes:null,
    // Chantier A15 : photo prise vers le sol, pieds vus du dessus — leur
    // ouverture se lit alors telle quelle, sans perspective.
    sol:!!o.sol};
}
/** Le bilan lu a-t-il été pris sur demande « paumes vers l'avant » ? */
function anatPaumesBilan(u){
  const b=_anatSafe(()=>anatPremierBilan(u).bilan);
  return !!(b&&(b['bil-photo-paumes']||b['deb-photo-paumes']));
}
/** La marge d'échelle quand des cheveux volumineux cachent le sommet du crâne. */
const ANAT_ECHELLE_CHEVEUX_PCT=4;

// ── LES MESURES ────────────────────────────────────────────────────────────
/**
 * PURE. Tout ce que les deux photos disent, région par région, avec les
 * chiffres, leurs repères et leurs marges.
 */
/**
 * PURE. Les vues dont aucune mesure ne sort : photo gardée malgré le contrôle
 * (morphoAnat.forcees), tant que le coach n'a pas vérifié ses points.
 */
function anatVuesForcees(anat){
  const l=(anat&&Array.isArray(anat.forcees))?anat.forcees:[];
  return l.filter(v=>!(anat[v]&&(anat[v].verifie||anat[v].man)));
}
// ⚠ AUCUN CENTIMÈTRE D'UNE PHOTO FORCÉE (06/10/2026) : les fiches de ses vues
//   sont retirées, et une face forcée retire l'échelle et les leviers. La photo
//   reste affichée pour le suivi visuel. Appelée par anatMesures, à son retour.
function _anatSansForcees(anat,r){
  const bloq=anatVuesForcees(anat);
  if(!bloq.length) return r;
  r.fiches=r.fiches.filter(f=>bloq.indexOf(f.vue)<0);
  if(bloq.indexOf('face')>=0){ r.echelle=null; r.leviers=[]; r.photoCm={bras:null,avantbras:null,rotule:null}; }
  try{ r.posture=anatMesuresPosture({fiches:r.fiches}); }catch(e){}
  r.forcees=bloq;
  return r;
}
function anatMesures(anat,u,o){
  // o.brut : la photo seule, sans correction ni mètre (c'est ce que la
  // calibration apprend) ; o.biais : le biais appris (anatBiaisCoach).
  const brut=!!(o&&o.brut);
  const B=(!brut&&o&&o.biais)?o.biais:null;
  const opts=anatOptions(anat);
  if(opts.paumes==null) opts.paumes=anatPaumesBilan(u);
  const taille=_anatSafe(()=>_tailleCm(u));
  const femme=_anatSafe(()=>isFemale((u&&(u._evol_gender||u.gender))||''));
  const larg=ANAT_LARGEURS[femme?'F':'H'];
  const REF=anatRef(femme), DEF=ANAT_REF.DEF, DISP=ANAT_DISP[femme?'F':'H'];
  const sexeTxt=femme?'femmes':'hommes';
  // La ligne « Position dans la population » : un percentile, jamais un z.
  const posLigne=(st,quoi)=>({lib:'Position dans la population',
    def:quoi+', à taille égale, '+sexeTxt+' (ANSUR II) ; dispersion ±'+_anatN(st.disp,1)+' %, mesure ±'+_anatN(st.err,1)+' %',
    val:st.txt,ref:'50ᵉ percentile',ecart:''});
  // La marge d'échelle : ±3 %, portée à ±5 % quand les deux repères
  // s'accordent mal (voir anatVerifEchelle). Posée plus bas, lue à l'appel.
  let ECH=ANAT_ERR.echelle;
  // `bi` : la part du biais moteur (±3 % tant qu'il n'est pas calibré).
  const tolTxt=(err,pl,bi)=>'±'+_anatN(err,1)+' % de mesure (échelle ±'+ECH+' %, placement ±'+_anatN(pl,1)+' %'
    +(bi!=null?', biais moteur ±'+_anatN(bi,1)+' %':'')+')';
  const biaisTxt=(cle)=>(B&&B[cle])?'corrigé du biais moteur, calibré sur '+B[cle].n+' athlètes':'biais moteur non calibré (±'+ANAT_BIAIS_DEFAUT_PCT+' %)';
  const BI=ANAT_BIAIS_DEFAUT_PCT;
  const vues={};
  for(const vue of ['face','dos','profil']){
    const v=anat&&anat[vue];
    const pts=anatPoints(anat,vue);
    if(!v||!pts) continue;
    // ⚠ UN GABARIT N'EST PAS UNE MESURE. Quand le moteur n'a vu personne, les
    //   points de départ sont des proportions moyennes : les mesurer rendrait
    //   la moyenne, et la présenterait comme l'athlète. Rien tant que le coach
    //   ne les a pas posés.
    if(v.auto&&v.auto.gabarit&&!v.man) continue;
    const W=v.w,H=v.h;
    const cotes=anatCotes(vue,vue==='face'&&opts.miroir);
    const P=k=>{ const q=pts[k]; return q?{x:q[0]*W,y:q[1]*H,e:q[2],v:q[3]}:null; };
    // Côté ATHLÈTE → point : P2('coude','g') lit le coude gauche de l'athlète.
    const P2=(k,s)=>P(k+'_'+cotes[s]);
    const tl=P('talon_l')||P('talon'),tr=P('talon_r'),vx=P('vertex');
    const sol=(tl&&tr)?Math.max(tl.y,tr.y):(tl||tr?(tl||tr).y:null);
    const stature=(vx&&sol!=null)?sol-vx.y:null;
    const cmPx=(taille&&stature&&stature>H*0.3)?taille/stature:null;
    vues[vue]={W,H,P,P2,cotes,sol,stature,cmPx,pts};
  }
  const F=vues.face, D=vues.dos;
  const verif=_anatSafe(()=>anatVerifEchelle(u,F,B&&B.rotule?B.rotule.k:null));
  if(verif&&verif.statut==='verifier') ECH=ANAT_ECHELLE_A_VERIFIER_PCT;
  if(opts.cheveux) ECH=Math.max(ECH,ANAT_ECHELLE_CHEVEUX_PCT);
  // LES PIEDS COUPÉS (A5) : l'orteil absent, collé au bord bas de l'image, ou
  // que le moteur voit mal. Le talon est alors deviné, et l'échelle avec lui.
  const piedsCoupes=!!(F&&['g','d'].some(sd=>{ const q=F.P2('pointe',sd);
    return !q||q.y>=F.H*0.985||(q.e>0&&q.e<0.5); }));
  const fiches=[];
  const fiche=(o)=>{ fiches.push(Object.assign({niveau:null,valeur:'',tolerance:'',etat:'ok',chiffres:[],estime:false},o)); };
  // Un segment en cm (ou en fraction de la taille, sans taille), et son écart
  // au repère de de Leva, du même sexe.
  const seg=(V,a,b,s)=>{
    if(!V) return null;
    const A=V.P2(a,s),B=V.P2(b,s);
    if(!A||!B) return null;
    const px=_anatDist(A,B);
    return {px,cm:V.cmPx?px*V.cmPx:null,fr:V.stature?px/V.stature:null,e:Math.min(A.e,B.e)};
  };
  const ecartPct=(fr,ref)=>(fr!=null)?(fr/ref-1)*100:null;
  const moySeg=(l)=>{ const ok=l.filter(Boolean); if(!ok.length) return null;
    const m=k=>ok.every(x=>x[k]!=null)?ok.reduce((s,x)=>s+x[k],0)/ok.length:null;
    return {px:m('px'),cm:m('cm'),fr:m('fr'),e:Math.min(...ok.map(x=>x.e)),n:ok.length}; };
  const cm=(x)=>x==null?'-':_anatN(x,1)+' cm';
  const pct=(x)=>x==null?'-':_anatSN(x,0)+' %';
  // `def` : d'où à où la ligne mesure, écrit sous le libellé du tableau.
  // `et` : l'écart-type du repère, quand la source le donne — écrit « ± ».
  const ligne=(lib,seg,ref,def,et)=>({lib,def:def||'',val:seg?(seg.cm!=null?cm(seg.cm):_anatN(seg.fr*100,1)+' % de la taille'):'-',
    ref:ref!=null&&taille?cm(ref*taille)+(et?' ± '+_anatN(et*taille,1):''):(ref!=null?_anatN(ref*100,1)+' %'+(et?' ± '+_anatN(et*100,1):''):''),
    ecart:seg&&ref!=null?pct(ecartPct(seg.fr,ref)):''});
  // Un membre plié se raccourcit en projection : il ne donne pas de longueur.
  const tendu=(V,a,b,c,s)=>{
    if(!V) return false;
    const A=V.P2(a,s),B=V.P2(b,s),C=V.P2(c,s);
    if(!A||!B||!C) return false;
    const ux=A.x-B.x,uy=A.y-B.y,vx=C.x-B.x,vy=C.y-B.y;
    const ang=_anatDeg(Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy)||1)))));
    return ang>=155;
  };
  // Le bras qui tient le téléphone, côté athlète.
  const telAth=(F&&opts.telephone)?(F.cotes.g===opts.telephone?'g':'d'):null;
  const brasOk=s=>F&&s!==telAth&&tendu(F,'epaule','coude','poignet',s);
  const jambeOk=s=>F&&tendu(F,'hanche','genou','cheville',s);
  const echelleTxt=F&&F.cmPx?'échelle par la taille ('+_anatN(taille,0)+' cm), ±'+ECH+' %'+(verif?', '+ANAT_ECHELLE_MOTS[verif.statut]+' par le genou':'')
    :'sans taille connue : en fraction de la hauteur sur la photo';

  // ── CLAVICULES : la carrure osseuse ──────────────────────────────────────
  {
    const A=F&&F.P2('acromion','g'),B=F&&F.P2('acromion','d');
    const C1=F&&F.P2('crete','g'),C2=F&&F.P2('crete','d');
    const bi=(A&&B)?{px:_anatDist(A,B),e:Math.min(A.e,B.e)}:null;
    const bc=(C1&&C2)?{px:_anatDist(C1,C2),e:Math.min(C1.e,C2.e)}:null;
    if(bi){ bi.cm=F.cmPx?bi.px*F.cmPx:null; bi.fr=F.stature?bi.px/F.stature:null; }
    if(bc){ bc.cm=F.cmPx?bc.px*F.cmPx:null; bc.fr=F.stature?bc.px/F.stature:null; }
    const ec=bi?ecartPct(bi.fr,larg.biacromial):null;
    const r=(bi&&bc)?bi.px/bc.px:null, rRef=larg.rapport, rEt=larg.rapport_et;
    const estime=!!((bi&&bi.e<1)||(bc&&bc.e<1));
    const pl=anatErrSeg([A],[B]), err=Math.hypot(ECH,pl,BI);
    const st=anatClasser(ec,DISP.biacromial,err,'aux épaules les plus larges','aux épaules les plus étroites');
    fiche({cle:'clavicules',lib:'Clavicules',vue:'face',ancre:A&&B?_anatMil(A,B):null,
      zone:(A&&B&&F)?_anatZoneAutour([A,B,F.P2('epaule','g'),F.P2('epaule','d')],0.35):null,
      etat:ec!=null?'ok':'illisible',estime,stat:st,
      niveau:st?st.niveau:null,
      bornes:['carrure étroite','carrure large'],
      valeur:bi?(bi.cm!=null?cm(bi.cm):'')+(r?' · ép./bassin '+_anatN(r,2):''):'',
      tolerance:tolTxt(err,pl,BI)+(estime?' : points estimés, à vérifier':''),
      chiffres:[ligne('Largeur biacromiale',bi,larg.biacromial,'acromion → acromion',larg.biacromial_et),ligne('Largeur bicrêtale (bassin)',bc,larg.bicretal,'crête iliaque → crête iliaque',larg.bicretal_et),
        {lib:'Épaules / bassin',def:'biacromiale ÷ bicrêtale',val:r?_anatN(r,2):'-',ref:_anatN(rRef,2)+' ± '+_anatN(rEt,2),ecart:r?pct((r/rRef-1)*100):''}]
        .concat(st?[posLigne(st,'largeur biacromiale')]:[]),
      mesure:{bi,bc,r,rRef,rEt,ec,femme,stat:st},source:'acromions et crêtes iliaques, photo de face ; repère '+ANAT_LARGEURS.SOURCE+', '+(femme?'femmes':'hommes')});
  }
  // ── ÉPAULES : inclinaison ────────────────────────────────────────────────
  const incl=(V,k)=>{
    if(!V) return null;
    const g=V.P2(k,'g'),d=V.P2(k,'d');
    if(!g||!d) return null;
    return _anatDeg(Math.atan2(g.y-d.y,Math.abs(g.x-d.x)||1));
  };
  {
    const af=incl(F,'acromion')!=null?incl(F,'acromion'):incl(F,'epaule');
    const ad=incl(D,'acromion')!=null?incl(D,'acromion'):incl(D,'epaule');
    const a=(af!=null&&ad!=null)?(af+ad)/2:(af!=null?af:ad);
    const hcm=(V,k)=>{ if(!V||!V.cmPx) return null; const g=V.P2(k,'g'),d=V.P2(k,'d'); return g&&d?(g.y-d.y)*V.cmPx:null; };
    const dh=hcm(F,'acromion');
    const marge=anatMargeAngle(ANAT_TOL.epaules,F?[F.P2('acromion','g'),F.P2('acromion','d')]:[]);
    fiche({cle:'epaules',lib:'Épaules',vue:'face',ancre:F&&F.P2('acromion','d'),
      zone:F?_anatZoneAutour([F.P2('acromion','g'),F.P2('acromion','d'),F.P2('coude','g'),F.P2('coude','d')],0.15):null,
      etat:a==null?'illisible':'ok',niveau:a==null?null:_anatNiveau(a,ANAT_SEUILS.epaules),
      bornes:['droite plus basse','gauche plus basse'],
      valeur:a==null?'':_anatN(a)+'°'+(dh!=null?' · '+_anatN(dh,1)+' cm':''),tolerance:'±'+_anatN(marge)+'° (pose ±'+_anatN(ANAT_TOL.epaules)+'°, placement des acromions compris)',
      chiffres:[{lib:'Inclinaison de face',def:'ligne des acromions / horizontale',val:af!=null?_anatSigneTexte(af):'-',ref:'0°',ecart:''},
        {lib:'Inclinaison de dos',def:'ligne des acromions / horizontale',val:ad!=null?_anatSigneTexte(ad):'-',ref:'0°',ecart:''},
        {lib:'Différence de hauteur',def:'acromion gauche − acromion droit',val:dh!=null?_anatN(dh,1)+' cm':'-',ref:'0 cm',ecart:''}],
      mesure:{a,af,ad,dh,marge},source:'acromions, photos de face et de dos'});
  }
  // ── BUSTE : tronc, V, axe ────────────────────────────────────────────────
  {
    const tr=F?(()=>{ const a=F.P2('epaule','g'),b=F.P2('epaule','d'),c=F.P2('hanche','g'),d=F.P2('hanche','d');
      if(!a||!b||!c||!d) return null; const px=_anatDist(_anatMil(a,b),_anatMil(c,d));
      return {px,cm:F.cmPx?px*F.cmPx:null,fr:F.stature?px/F.stature:null,e:Math.min(a.e,b.e,c.e,d.e)}; })():null;
    const dg=F&&F.P2('deltoide','g'),dd=F&&F.P2('deltoide','d'),tg=F&&F.P2('taille','g'),td=F&&F.P2('taille','d');
    const V=(dg&&dd&&tg&&td)?_anatDist(dg,dd)/_anatDist(tg,td):null;
    // LE V DANS LE TEMPS (A13) : sa place dans la population, et sa courbe.
    const RV=ANAT_V_REF[femme?'F':'H'];
    const errV=V?Math.hypot(anatErrSeg([dg],[dd]),anatErrSeg([tg],[td])):null;
    const stV=V?anatClasser((V/RV.moy-1)*100,RV.et/RV.moy*100,errV,'aux V les plus marqués','aux V les moins marqués'):null;
    const serieV=_anatSafe(()=>anatSerieV(u,V?{bilan:Number(anat&&anat.bilan),V:Math.round(V*1000)/1000,conf:Math.min(dg.e,dd.e,tg.e,td.e)}:null))||[];
    const vPrem=serieV.length>1?serieV[0]:null, vDer=serieV.length>1?serieV[serieV.length-1]:null;
    const courant=serieV.find(x=>x.lu==='analyse');
    const nEst=((anat&&Array.isArray(anat.silhouettes))?anat.silhouettes:[]).filter(x=>x&&x.V>0&&x.conf<0.9&&Number(x.bilan)!==Number(anat.bilan)&&!serieV.some(y=>y.bilan===Number(x.bilan))).length;
    const Xc=courant&&courant.X!=null?courant.X:null;
    const shift=(X)=>{ if(!X) return null; const a=X.P2('epaule','g'),b=X.P2('epaule','d'),c=X.P2('hanche','g'),d=X.P2('hanche','d');
      if(!a||!b||!c||!d) return null; const me=_anatMil(a,b),mh=_anatMil(c,d); const t=_anatDist(me,mh);
      // Positif : les épaules partent vers la GAUCHE de l'athlète.
      const versG=(X.cotes.g==='l')?-1:1; return (me.x-mh.x)*versG/t*100; };
    const sf=shift(F),sd=shift(D);
    const s=(sf!=null&&sd!=null)?(sf+sd)/2:(sf!=null?sf:sd);
    const ec=tr?ecartPct(tr.fr,REF.tronc):null;
    const plT=F?anatErrSeg([F.P2('epaule','g'),F.P2('epaule','d')],[F.P2('hanche','g'),F.P2('hanche','d')]):ANAT_ERR.estime;
    const errT=Math.hypot(ECH,plT,BI);
    const stT=anatClasser(ec,DISP.tronc,errT,'au tronc le plus long','au tronc le plus court');
    fiche({cle:'buste',stat:stT,lib:'Buste',vue:'face',
      ancre:(F&&F.P2('epaule','g')&&F.P2('hanche','g'))?_anatMil(_anatMil(F.P2('epaule','g'),F.P2('epaule','d')),_anatMil(F.P2('hanche','g'),F.P2('hanche','d'))):null,
      zone:F?_anatZoneAutour([F.P2('deltoide','g'),F.P2('deltoide','d'),F.P2('hanche','g'),F.P2('hanche','d')],0.08):null,
      etat:(ec!=null||V!=null||s!=null)?'ok':'illisible',
      niveau:stT?stT.niveau:(s!=null?_anatNiveau(s,ANAT_SEUILS.tronc):null),
      bornes:['tronc court','tronc long'],
      valeur:(tr&&tr.cm!=null?'tronc '+cm(tr.cm):'')+(V?(tr&&tr.cm!=null?' · ':'')+'V '+_anatN(V,2):''),
      tolerance:tolTxt(errT,plT,BI),
      chiffres:[ligne('Tronc (épaules → hanches)',tr,REF.tronc,DEF.tronc),
        {lib:'Rapport deltoïdes / taille (V)',def:'deltoïde → deltoïde ÷ largeur de taille au plus étroit ; repère de population ANSUR II',val:V?_anatN(V,2):'-',ref:_anatN(RV.moy,2)+' ± '+_anatN(RV.et,2),ecart:''},
        {lib:'Axe du tronc (décalage)',def:'mi-épaules / mi-hanches, en % du tronc',val:s!=null?_anatSN(s,1)+' %':'-',ref:'0 %',ecart:''}]
        .concat(stT?[posLigne(stT,'longueur du tronc')]:[])
        .concat(stV?[{lib:'Position du V dans la population',def:(femme?'femmes':'hommes')+' (P5 '+_anatN(RV.p5,2)+', P95 '+_anatN(RV.p95,2)+') ; '+ANAT_V_REF.AVERT,val:stV.txt,ref:'50ᵉ percentile',ecart:''}]:[])
        .concat(Xc!=null?[{lib:'Rapport hanches / taille (X)',def:'bord à bord des hanches ÷ largeur de taille, sur la silhouette ; sans repère de population',val:_anatN(Xc,2),ref:'à suivre',ecart:''}]:[])
        .concat(vPrem?[{lib:'V, du premier au dernier bilan',def:_anatDateFr(vPrem.bilan)+' → '+_anatDateFr(vDer.bilan)+', '+serieV.length+' bilans lus sur la silhouette'+(nEst?' ('+nEst+' à bords estimés, écarté'+(nEst>1?'s':'')+')':'')+' ; bruit de placement ±'+_anatN(ANAT_V_REF.BRUIT,2),val:_anatN(vPrem.V,2)+' → '+_anatN(vDer.V,2),ref:'',ecart:_anatSN(vDer.V-vPrem.V,2)}]:[]),
      courbeV:serieV.length>1?serieV:null,
      mesure:{tr,ec,V,s,ref:REF.tronc,femme,stat:stT,nTr:stT?stT.niveau:0,statV:stV,refV:RV,serieV,X:Xc,
        varV:vPrem?Math.round((vDer.V-vPrem.V)*1000)/1000:null},
      source:'centres des épaules et des hanches, bords de la silhouette ; '+echelleTxt+' ; repère '+ANAT_REF.SOURCE+' ('+(femme?'femmes':'hommes')+')'
        +(V?' ; V : repère de population '+ANAT_V_REF.SOURCE+', '+ANAT_V_REF.AVERT:'')});
  }
  // ── BRAS : humérus, avant-bras, et le bras qui tient le téléphone ────────
  {
    const cotesOk=['g','d'].filter(brasOk);
    const hu=moySeg(cotesOk.map(s=>seg(F,'epaule','coude',s)));
    const abPhoto=moySeg(cotesOk.map(s=>seg(F,'coude','poignet',s)));
    const mb=moySeg(cotesOk.map(s=>seg(F,'acromion','poignet',s)));   // pointe de l'épaule → poignet
    // L'AVANT-BRAS RETENU : le mètre s'il existe, sinon la photo corrigée du
    // biais appris, sinon la photo. Les autres restent en contrôle.
    const mAb=brut?null:_anatSafe(()=>mesureMorpho(u,'deb-avantbras'));
    const mMb=brut?null:_anatSafe(()=>mesureMorpho(u,'deb-bras'));
    const kAb=(B&&B.avantbras)?B.avantbras.k:1, kMb=(B&&B.bras)?B.bras.k:1;
    const abSrc=(mAb&&mAb.cm&&abPhoto&&abPhoto.cm)?'metre':((kAb!==1&&abPhoto)?'corrige':'photo');
    const facAb=abSrc==='metre'?mAb.cm/abPhoto.cm:(abSrc==='corrige'?1/kAb:1);
    const ab=abPhoto?Object.assign({},abPhoto,{cm:abPhoto.cm!=null?abPhoto.cm*facAb:null,fr:abPhoto.fr!=null?abPhoto.fr*facAb:null}):null;
    const r=(hu&&ab)?hu.px/(abPhoto.px*facAb):null, rRef=REF.bras/REF.avantbras;
    const ecR=r?(r/rRef-1)*100:null;
    const asy=(cotesOk.length===2)?(()=>{ const g=seg(F,'epaule','poignet','g'),d=seg(F,'epaule','poignet','d');
      return (g&&d)?(g.px-d.px)/((g.px+d.px)/2)*100:null; })():null;
    const coude=F&&F.P2('coude',cotesOk[0]||'g');
    const s0=cotesOk[0]||'g';
    const plB=F?Math.hypot(anatErrSeg([F.P2('epaule',s0)],[F.P2('coude',s0)]),anatErrSeg([F.P2('coude',s0)],[F.P2('poignet',s0)])):ANAT_ERR.estime;
    // La part du biais : l'écart-type appris sur l'avant-bras s'il est calibré,
    // aucune s'il vient du mètre, ±3 % sinon.
    const biB=abSrc==='metre'?0:(abSrc==='corrige'?B.avantbras.sd*100:BI);
    const errB=Math.hypot(ECH,plB,biB);
    const stB=r?anatClasser(ecR,DISP.rapportBras,errB,'à l’humérus le plus long (rapporté à l’avant-bras)','à l’avant-bras le plus long (rapporté à l’humérus)'):null;
    fiche({cle:'bras',lib:'Bras',vue:'face',ancre:coude,stat:stB,
      zone:F?_anatZoneAutour(['epaule','coude','poignet'].map(k=>F.P2(k,cotesOk[0]||'g')),0.25):null,
      etat:r?'ok':'illisible',niveau:stB?stB.niveau:null,
      bornes:['avant-bras long','humérus long'],
      valeur:r?'hum./av.-bras '+_anatN(r,2):'',
      tolerance:tolTxt(errB,plB,biB),
      chiffres:[ligne('Humérus (épaule → coude)',hu,REF.bras,DEF.bras),
        Object.assign(ligne('Avant-bras (coude → poignet)',ab,REF.avantbras,DEF.avantbras),
          abSrc==='metre'?{def:'olécrane → styloïde, au mètre (bilan) ; photo en contrôle : '+(abPhoto.cm!=null?cm(abPhoto.cm):'-')}
          :abSrc==='corrige'?{def:DEF.avantbras+' ; corrigé du biais moteur ('+_anatSN((kAb-1)*100,1)+' %, '+B.avantbras.n+' athlètes)'}:{}),
        {lib:'Membre supérieur',def:'pointe de l’épaule → poignet'+((mMb&&mMb.cm)?' ; au mètre (bilan), photo en contrôle':(kMb!==1?' ; corrigé du biais moteur ('+B.bras.n+' athlètes)':' ; photo, biais moteur non calibré')),
          val:(mMb&&mMb.cm)?cm(mMb.cm):(mb&&mb.cm!=null?cm(mb.cm/kMb):'-'),
          ref:(mMb&&mMb.cm&&mb&&mb.cm!=null)?'photo '+cm(mb.cm/kMb):'',
          ecart:(mMb&&mMb.cm&&mb&&mb.cm!=null)?pct((mb.cm/kMb/mMb.cm-1)*100):''},
        {lib:'Humérus / avant-bras',def:'les deux longueurs ci-dessus',val:r?_anatN(r,2):'-',ref:_anatN(rRef,2),ecart:ecR!=null?pct(ecR):''},
        {lib:'Écart gauche / droite',def:'centre épaule → centre poignet, un bras sur l’autre',val:asy!=null?_anatSN(asy,1)+' %':'-',ref:'0 %',ecart:''}]
        .concat(stB?[posLigne(stB,'rapport humérus / avant-bras')]:[]),
      mesure:{hu,ab,abPhoto,abSrc,mb,r,rRef,ecR,asy,cotesOk,telAth,refBras:REF.bras,refAvantbras:REF.avantbras,femme,stat:stB},
      source:'photo de face'+(telAth?', sans le bras '+(telAth==='g'?'gauche':'droit')+' qui tient le téléphone':'')+' ; '+echelleTxt+' ; repère '+ANAT_REF.SOURCE+' ('+(femme?'femmes':'hommes')+')'
        +' ; '+(abSrc==='metre'?'avant-bras au mètre, la photo en contrôle':biaisTxt('avantbras'))});
  }
  // ── COUDES : l'angle de port (A10) ───────────────────────────────────────
  // 180° − angle(épaule, coude, poignet), dans le plan de l'image, compté
  // positif quand l'avant-bras part EN DEHORS de l'axe du bras.
  {
    const RC=ANAT_COUDE[femme?'F':'H'];
    const rRef=REF.avantbras/REF.bras;
    const port=s=>{
      if(!F) return null;
      const e=F.P2('epaule',s),c=F.P2('coude',s),w=F.P2('poignet',s);
      if(!e||!c||!w) return null;
      const u={x:c.x-e.x,y:c.y-e.y}, v={x:w.x-c.x,y:w.y-c.y};
      const nu=Math.hypot(u.x,u.y), nv=Math.hypot(v.x,v.y);
      if(!(nu>1&&nv>1)) return null;
      const dev=_anatDeg(Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(nu*nv)))));
      // En dehors : du côté du bord de l'image où se trouve ce bras.
      const lat=F.cotes[s]==='l'?-1:1;
      const dehors=((v.x/nv)-(u.x/nu))*lat;       // l'avant-bras s'écarte-t-il vers le bord ?
      return {ang:(dehors>=0?1:-1)*dev,interieur:180-dev,ratio:nv/nu/rRef,pts:[e,c,w]};
    };
    const cotes=['g','d'].map(s=>({s,m:port(s)}));
    const lisible=x=>x.m&&x.s!==telAth&&x.m.interieur>=ANAT_COUDE.TENDU&&x.m.ratio>=ANAT_COUDE.RACCOURCI;
    const ok=opts.paumes?cotes.filter(lisible):[];
    const raison=!F?'vue':(!opts.paumes?'paumes':(ok.length?null:'plie'));
    const moy=ok.length?ok.reduce((t,x)=>t+x.m.ang,0)/ok.length:null;
    const marge=ok.length?anatMargeAngle(ANAT_TOL.coudes,ok[0].m.pts,true):ANAT_TOL.coudes;
    const stC=moy!=null?anatClasser(moy-RC.moy,RC.et,marge,'aux coudes les plus ouverts','aux coudes les plus fermés'):null;
    const g=cotes[0].m, dd=cotes[1].m;
    const nl=raison==='paumes'?'non lisible : paumes tournées vers les cuisses':'non lisible';
    const val=x=>opts.paumes&&lisible(x)?_anatSN(x.m.ang,1)+'°':nl;
    fiche({cle:'coudes',lib:'Coudes',vue:'face',ancre:F&&F.P2('coude','d'),stat:stC,
      zone:F?_anatZoneAutour([F.P2('epaule','g'),F.P2('coude','g'),F.P2('poignet','g'),F.P2('epaule','d'),F.P2('coude','d'),F.P2('poignet','d')],0.08):null,
      etat:moy==null?'illisible':'ok',niveau:stC?stC.niveau:null,
      bornes:['plus fermés','plus ouverts'],
      valeur:moy==null?'':_anatSN(moy,0)+'°',
      tolerance:'±'+_anatN(marge,1)+'° (pose ±'+ANAT_TOL.coudes+'°, placement épaule-coude-poignet compris)',
      chiffres:[{lib:'Angle de port, gauche',def:'180° − angle épaule → coude → poignet, dans le plan de la photo ; + en dehors',val:val(cotes[0]),ref:RC.moy+'° ± '+RC.et+'°',ecart:''},
        {lib:'Angle de port, droit',def:'même mesure, bras droit de l’athlète',val:val(cotes[1]),ref:RC.moy+'° ± '+RC.et+'°',ecart:''}]
        .concat(stC?[{lib:'Position dans la population',def:'angle de port, '+sexeTxt+' ; dispersion ±'+RC.et+'°, mesure ±'+_anatN(marge,1)+'°',val:stC.txt,ref:'50ᵉ percentile',ecart:''}]:[]),
      mesure:{moy,g:g&&g.ang,d:dd&&dd.ang,raison,paumes:!!opts.paumes,ref:RC,marge,femme,stat:stC},
      source:'photo de face, bras tendus paumes vers l’avant ; repère '+ANAT_COUDE.SOURCE+' ('+(femme?'femmes':'hommes')+' '+RC.moy+'° ± '+RC.et+'°)'});
  }
  // ── BASSIN : inclinaison et largeur ──────────────────────────────────────
  {
    const af=incl(F,'crete')!=null?incl(F,'crete'):incl(F,'hanche');
    const ad=incl(D,'crete')!=null?incl(D,'crete'):incl(D,'hanche');
    const a=(af!=null&&ad!=null)?(af+ad)/2:(af!=null?af:ad);
    const marge=anatMargeAngle(ANAT_TOL.bassin,F?[F.P2('crete','g'),F.P2('crete','d')]:[]);
    fiche({cle:'bassin',lib:'Bassin',vue:'face',ancre:F&&F.P2('crete','d'),
      zone:F?_anatZoneAutour([F.P2('crete','g'),F.P2('crete','d'),F.P2('hanche','g'),F.P2('hanche','d')],0.35):null,
      etat:a==null?'illisible':'ok',niveau:a==null?null:_anatNiveau(a,ANAT_SEUILS.bassin),
      bornes:['droite plus basse','gauche plus basse'],
      valeur:a==null?'':_anatN(a)+'°',tolerance:'±'+_anatN(marge)+'° (pose ±'+_anatN(ANAT_TOL.bassin)+'°, placement des crêtes compris)',
      chiffres:[{lib:'Inclinaison de face',def:'ligne des crêtes iliaques / horizontale',val:af!=null?_anatSigneTexte(af):'-',ref:'0°',ecart:''},
        {lib:'Inclinaison de dos',def:'ligne des crêtes iliaques / horizontale',val:ad!=null?_anatSigneTexte(ad):'-',ref:'0°',ecart:''}],
      mesure:{a,af,ad,marge,ecartVues:(af!=null&&ad!=null)?Math.abs(af-ad):null},source:'crêtes iliaques, photos de face et de dos'});
  }
  // ── JAMBES : fémur, tibia, et ce que ça fait au squat ────────────────────
  const tronc=fiches.find(f=>f.cle==='buste').mesure.tr;
  {
    const ok=['g','d'].filter(jambeOk);
    const cu=moySeg(ok.map(s=>seg(F,'hanche','genou',s)));
    const ja=moySeg(ok.map(s=>seg(F,'genou','cheville',s)));
    const hh=F&&F.stature&&F.sol!=null?(()=>{ const a=F.P2('hanche','g'),b=F.P2('hanche','d'); if(!a||!b) return null;
      const px=F.sol-(a.y+b.y)/2; return {px,cm:F.cmPx?px*F.cmPx:null,fr:px/F.stature,e:Math.min(a.e,b.e)}; })():null;
    const r=(cu&&ja)?cu.px/ja.px:null, rRef=REF.cuisse/REF.jambe;
    const ecR=r?(r/rRef-1)*100:null;
    const asy=(ok.length===2)?(()=>{ const g=seg(F,'hanche','cheville','g'),d=seg(F,'hanche','cheville','d');
      return (g&&d)?(g.px-d.px)/((g.px+d.px)/2)*100:null; })():null;
    const tj=(tronc&&hh)?tronc.px/hh.px:null, tjRef=REF.tronc/REF.hanche;
    const s1=ok[0]||'g';
    const plJ=F?Math.hypot(anatErrSeg([F.P2('hanche',s1)],[F.P2('genou',s1)]),anatErrSeg([F.P2('genou',s1)],[F.P2('cheville',s1)])):ANAT_ERR.estime;
    const errJ=Math.hypot(ECH,plJ,BI);
    const stJ=r?anatClasser(ecR,DISP.rapportJambes,errJ,'au fémur le plus long (rapporté au tibia)','au tibia le plus long (rapporté au fémur)'):null;
    fiche({cle:'jambes',lib:'Jambes',vue:'face',ancre:F&&F.P2('genou','d')&&F.P2('hanche','d')?_anatMil(F.P2('hanche','d'),F.P2('genou','d')):null,
      zone:F?_anatZoneAutour([F.P2('hanche','g'),F.P2('hanche','d'),F.P2('cheville','g'),F.P2('cheville','d')],0.12):null,
      etat:r?'ok':'illisible',niveau:stJ?stJ.niveau:null,stat:stJ,
      bornes:['tibia long','fémur long'],
      valeur:r?'cuisse/jambe '+_anatN(r,2):'',tolerance:tolTxt(errJ,plJ,BI),
      chiffres:[ligne('Cuisse (hanche → genou)',cu,REF.cuisse,DEF.cuisse),ligne('Jambe (genou → cheville)',ja,REF.jambe,DEF.jambe),
        {lib:'Cuisse / jambe',def:'les deux longueurs ci-dessus',val:r?_anatN(r,2):'-',ref:_anatN(rRef,2),ecart:ecR!=null?pct(ecR):''},
        ligne('Hauteur de hanche',hh,REF.hanche,DEF.hanche),
        {lib:'Tronc / hauteur de hanche',def:'mi-épaules → mi-hanches ÷ hauteur de hanche',val:tj?_anatN(tj,2):'-',ref:_anatN(tjRef,2),ecart:tj?pct((tj/tjRef-1)*100):''},
        {lib:'Écart gauche / droite',def:'centre hanche → cheville, une jambe sur l’autre',val:asy!=null?_anatSN(asy,1)+' %':'-',ref:'0 %',ecart:''}]
        .concat(stJ?[posLigne(stJ,'rapport cuisse / jambe')]:[]),
      mesure:{cu,ja,hh,r,rRef,ecR,tj,tjRef,asy,femme,stat:stJ},source:'photo de face ; '+echelleTxt+' ; repère '+ANAT_REF.SOURCE+' ('+(femme?'femmes':'hommes')+'), hauteur de hanche ANSUR II'});
  }
  // ── GENOUX : alignement frontal ──────────────────────────────────────────
  {
    const gen=(s)=>{
      if(!F) return null;
      const h=F.P2('hanche',s),g=F.P2('genou',s),c=F.P2('cheville',s);
      const hg=F.P2('hanche','g'),hd=F.P2('hanche','d');
      if(!h||!g||!c||!hg||!hd||!(c.y-h.y>10)) return null;
      const mid=(hg.x+hd.x)/2;
      const ux=h.x-g.x,uy=h.y-g.y,vx=c.x-g.x,vy=c.y-g.y;
      const ang=_anatDeg(Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(Math.hypot(ux,uy)*Math.hypot(vx,vy))))));
      const xl=h.x+(c.x-h.x)*((g.y-h.y)/(c.y-h.y));
      return (Math.abs(g.x-mid)<Math.abs(xl-mid))?(180-ang):-(180-ang);
    };
    const g=gen('g'),d=gen('d');
    const pire=(g==null&&d==null)?null:((d==null||(g!=null&&Math.abs(g)>=Math.abs(d)))?{c:'gauche',v:g}:{c:'droit',v:d});
    const sP=pire&&pire.c==='droit'?'d':'g';
    const marge=anatMargeAngle(ANAT_TOL.genoux,F?[F.P2('hanche',sP),F.P2('genou',sP),F.P2('cheville',sP)]:[],true);
    fiche({cle:'genoux',lib:'Genoux',vue:'face',ancre:F&&F.P2('genou','d'),
      zone:F?_anatZoneAutour([F.P2('genou','g'),F.P2('genou','d')],0.9):null,
      etat:pire?'ok':'illisible',niveau:pire?_anatNiveau(pire.v,ANAT_SEUILS.genoux):null,
      bornes:['vers l’extérieur','vers l’intérieur'],
      valeur:pire?'G '+_anatSigne(g)+' · D '+_anatSigne(d):'',tolerance:'±'+_anatN(marge)+'° (pose ±'+ANAT_TOL.genoux+'°, placement hanche-genou-cheville compris)',
      chiffres:[{lib:'Genou gauche / ligne hanche-cheville',def:'angle hanche → genou → cheville, de face',val:_anatSigneTexte(g,true),ref:'0°',ecart:''},
        {lib:'Genou droit / ligne hanche-cheville',def:'angle hanche → genou → cheville, de face',val:_anatSigneTexte(d,true),ref:'0°',ecart:''}],
      mesure:{g,d,pire,marge},source:'photo de face, hanche-genou-cheville'});
  }
  // ── PIEDS ────────────────────────────────────────────────────────────────
  {
    const pied=(s)=>{
      if(!F) return null;
      const t=F.P2('talon',s),p=F.P2('pointe',s),hg=F.P2('hanche','g'),hd=F.P2('hanche','d');
      if(!t||!p||!hg||!hd) return null;
      const mid=(hg.x+hd.x)/2;
      const dx=(p.x-t.x)*((t.x>=mid)?1:-1);
      return _anatDeg(Math.atan2(dx,Math.max(1,p.y-t.y)));
    };
    const g=pied('g'),d=pied('d');
    const asy=(g!=null&&d!=null)?g-d:null;
    fiche({cle:'pieds',lib:'Pieds',vue:'face',ancre:F&&F.P2('pointe','d'),
      zone:F?_anatZoneAutour([F.P2('cheville','g'),F.P2('cheville','d'),F.P2('pointe','g'),F.P2('pointe','d'),F.P2('talon','g'),F.P2('talon','d')],0.5):null,
      etat:asy==null?'illisible':'ok',niveau:asy==null?null:_anatNiveau(asy,ANAT_SEUILS.pieds),
      bornes:['droit plus ouvert','gauche plus ouvert'],
      // A15 : le titre ne porte que l'écart ; les ouvertures passent au tableau.
      valeur:asy==null?'':'écart G/D : '+_anatSN(asy,0)+'°',tolerance:'±'+ANAT_TOL.pieds+'° (perspective)',
      chiffres:[['Pied gauche',g],['Pied droit',d]].map(([lib,v])=>opts.sol
          ?{lib,def:'ouverture talon → pointe, photo prise vers le sol : lue sans correction',val:v!=null?_anatSN(v,0)+'°':'-',ref:'',ecart:''}
          :{lib,def:v!=null?'ouverture apparente (perspective) '+_anatSN(v,0)+'° ; estimée ≈ '+_anatSN(v*ANAT_PIEDS.CORR,0)+'° (× '+_anatN(ANAT_PIEDS.CORR,1)+', estimation RepCore)':'ouverture apparente (perspective)',
            val:v!=null?anatMotPied(v*ANAT_PIEDS.CORR):'-',ref:'',ecart:''})
        .concat([{lib:'Écart G/D',def:opts.sol?'gauche − droite':'gauche − droite, sur les angles apparents : même perspective des deux côtés',val:asy!=null?_anatSN(asy,0)+'°':'-',ref:'0°',ecart:''}]),
      mesure:{g,d,asy,sol:!!opts.sol,motG:g!=null?anatMotPied(g*ANAT_PIEDS.CORR):null,motD:d!=null?anatMotPied(d*ANAT_PIEDS.CORR):null},
      source:'photo de face, talon et pointe'+(opts.sol?' ; photo prise vers le sol, ouverture lue telle quelle':' ; ouverture qualitative estimée (angle apparent × '+_anatN(ANAT_PIEDS.CORR,1)+', estimation RepCore)')});
  }
  // ── DOS : omoplates, rachis, triangles ───────────────────────────────────
  {
    const og=D&&D.P2('omoplate','g'),od=D&&D.P2('omoplate','d');
    const om=(og&&od)?_anatDeg(Math.atan2(og.y-od.y,Math.abs(og.x-od.x)||1)):null;
    const omCm=(og&&od&&D.cmPx)?(og.y-od.y)*D.cmPx:null;
    const c7=D&&D.P('c7'),sa=D&&D.P('sacrum');
    // Positif : le haut du dos part vers la GAUCHE de l'athlète.
    const rach=(c7&&sa)?_anatDeg(Math.atan2((c7.x-sa.x)*(D.cotes.g==='l'?-1:1),Math.max(1,sa.y-c7.y))):null;
    // LES TRIANGLES BRAS-TRONC (A14) : l'aire du polygone épaule → coude →
    // poignet → taille, côté athlète, sur les POINTS EFFECTIFS — ceux que le
    // coach a replacés compris. L'ancienne lecture du masque (largeurs moyennes
    // de l'espace bras-tronc) ne sert plus que de repli, quand un point manque.
    const aire=sd=>{
      if(!D) return null;
      const q=['epaule','coude','poignet','taille'].map(k=>D.P2(k,sd));
      if(q.some(x=>!x)) return null;
      let a2=0; for(let i=0;i<q.length;i++){ const A=q[i],B=q[(i+1)%q.length]; a2+=A.x*B.y-B.x*A.y; }
      return Math.abs(a2)/2;
    };
    const aG=aire('g'), aD=aire('d');
    const parPts=aG!=null&&aD!=null;
    const tri=!parPts&&D&&anat.dos&&anat.dos.auto&&anat.dos.auto.triangles;
    const trG=parPts?aG:(tri?tri[D.cotes.g]:null),trD=parPts?aD:(tri?tri[D.cotes.d]:null);
    const triSrc=parPts?'points':(tri?'masque':null);
    const asy=(trG!=null&&trD!=null&&Math.max(trG,trD)>0)?(trG-trD)/Math.max(trG,trD)*100:null;
    // LE BORD INTERNE DES OMOPLATES (A14) : sa distance horizontale à la ligne
    // C7 → sacrum, à la même hauteur, en cm ; gauche contre droite.
    const dAxe=q=>{ if(!q||!c7||!sa||!D.cmPx) return null; const t=(q.y-c7.y)/((sa.y-c7.y)||1); return Math.abs(q.x-(c7.x+(sa.x-c7.x)*t))*D.cmPx; };
    const oiG=D&&D.P2('omoplate_int','g'), oiD=D&&D.P2('omoplate_int','d');
    const dOiG=dAxe(oiG), dOiD=dAxe(oiD);
    const oiDiff=(dOiG!=null&&dOiD!=null)?dOiG-dOiD:null;
    const nOm=om!=null?_anatNiveau(om,ANAT_SEUILS.omoplates):0, nRa=rach!=null?_anatNiveau(rach,ANAT_SEUILS.rachis):0,
      nTr=asy!=null?_anatNiveau(asy,ANAT_SEUILS.triangles):0, nOi=oiDiff!=null?_anatNiveau(oiDiff,ANAT_SEUILS.omoInt):0;
    const pire=[nOm,nRa,nTr,nOi].reduce((a,b)=>Math.abs(b)>Math.abs(a)?b:a,0);
    fiche({cle:'dos',lib:'Dos',vue:'dos',ancre:c7&&sa?_anatMil(c7,sa):null,
      zone:D?_anatZoneAutour([D.P2('acromion','g'),D.P2('acromion','d'),D.P('sacrum'),D.P2('omoplate','g')],0.12):null,
      etat:D?((om!=null||rach!=null)?'ok':'illisible'):'illisible',
      niveau:(om!=null||rach!=null||asy!=null||oiDiff!=null)?pire:null,
      bornes:['côté droit','côté gauche'],
      valeur:[om!=null?'omoplates '+_anatN(om)+'°':'',rach!=null?'axe '+_anatN(rach)+'°':''].filter(Boolean).join(' · '),
      tolerance:'omoplates ±'+_anatN(ANAT_TOL.omoplates,1)+'°, axe ±'+_anatN(ANAT_TOL.rachis,0)+'°, bord interne ±'+_anatN(ANAT_TOL.omoInt,0)+' cm',estime:!!((og&&og.e<1)||(oiG&&oiG.e<1)),
      chiffres:[{lib:'Omoplates (différence de hauteur)',def:'pointes des omoplates / horizontale',val:om!=null?_anatSigneTexte(om)+(omCm!=null?' · '+_anatN(omCm,1)+' cm':''):'-',ref:'0°',ecart:''},
        {lib:'Axe C7 → sacrum',def:'base du cou → fossettes du sacrum / verticale',val:rach!=null?_anatN(rach)+'° vers la '+(rach>0?'gauche':'droite'):'-',ref:'0°',ecart:''},
        {lib:'Triangles bras-tronc (G / D)',def:parPts?'aire épaule → coude → poignet → taille, de dos, sur les points placés':'espace entre le bras et la taille, de dos, lu sur la silhouette',
          val:(trG!=null&&trD!=null&&D.cmPx)?(parPts?_anatN(trG*D.cmPx*D.cmPx,0)+' / '+_anatN(trD*D.cmPx*D.cmPx,0)+' cm²':cm(trG*D.cmPx)+' / '+cm(trD*D.cmPx)):(asy!=null?_anatSN(asy,0)+' %':'-'),ref:'égaux',ecart:asy!=null?pct(asy):''},
        {lib:'Bord interne des omoplates (G / D)',def:'distance horizontale à la ligne C7 → sacrum, à mi-hauteur de l’omoplate ; marge ±'+ANAT_TOL.omoInt+' cm',
          val:(dOiG!=null&&dOiD!=null)?_anatN(dOiG,1)+' / '+_anatN(dOiD,1)+' cm':'-',ref:'égales',ecart:oiDiff!=null?_anatSN(oiDiff,1)+' cm':''}],
      mesure:{om,omCm,rach,asy,triSrc,aires:parPts?{g:aG,d:aD}:null,oiG:dOiG,oiD:dOiD,oiDiff,lu:!!D,pire:{nOm,nRa,nTr,nOi}},source:'photo de dos'+(parPts?' ; triangles sur les points placés':'')});
  }
  // ── ARRIÈRE-PIED (A11) ──────────────────────────────────────────────────
  // L'angle entre (mollet → Achille) et (Achille → talon), de dos. Positif :
  // le talon « rentre en dedans » — l'arrière-pied s'affaisse vers l'intérieur
  // (pronation), et le bas du talon part EN DEHORS de l'axe du mollet.
  // Lecture visuelle inspirée du FPI-6 (Redmond et al., 2006) : pas un score.
  {
    const angAp=s=>{
      if(!D) return null;
      const a=D.P2('mollet',s),b=D.P2('achille',s),t=D.P2('talon',s);
      if(!a||!b||!t) return null;
      const u={x:b.x-a.x,y:b.y-a.y}, v={x:t.x-b.x,y:t.y-b.y};
      const nu=Math.hypot(u.x,u.y), nv=Math.hypot(v.x,v.y);
      if(!(nu>1&&nv>1)) return null;
      const dev=_anatDeg(Math.acos(Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y)/(nu*nv)))));
      const lat=D.cotes[s]==='l'?-1:1;     // de dos, la gauche de l'athlète est à gauche de l'écran
      const dehors=((v.x/nv)-(u.x/nu))*lat;
      return {ang:(dehors>=0?1:-1)*dev,pts:[a,b,t]};
    };
    const g=angAp('g'), dd=angAp('d');
    const lus=[g,dd].filter(Boolean);
    const pire=lus.length?lus.reduce((x,y)=>Math.abs(y.ang)>Math.abs(x.ang)?y:x):null;
    const marge=pire?anatMargeAngle(ANAT_TOL.arrierePied,pire.pts,true):ANAT_TOL.arrierePied;
    const sv=x=>x?_anatSN(x.ang,0)+'°':'-';
    fiche({cle:'arriere_pied',lib:'Arrière-pied',court:'Talons',vue:'dos',ancre:D&&D.P2('achille','d'),
      zone:D?_anatZoneAutour([D.P2('mollet','g'),D.P2('talon','g'),D.P2('mollet','d'),D.P2('talon','d')],0.15):null,
      etat:pire?'ok':'illisible',niveau:pire?_anatNiveau(pire.ang,ANAT_SEUILS.arrierePied):null,
      bornes:['talon en dehors','talon en dedans'],
      valeur:lus.length?'G '+sv(g)+' · D '+sv(dd):'',
      tolerance:'±'+_anatN(marge)+'° (pose ±'+ANAT_TOL.arrierePied+'°, placement mollet-tendon-talon compris)',
      estime:!!(pire&&pire.pts.some(p=>p.e<1)),
      chiffres:[{lib:'Arrière-pied gauche',def:'mollet → tendon d’Achille / tendon → talon, de dos ; + talon en dedans',val:sv(g),ref:'0° ± 4°',ecart:''},
        {lib:'Arrière-pied droit',def:'même lecture, pied droit de l’athlète',val:sv(dd),ref:'0° ± 4°',ecart:''}],
      mesure:{g:g&&g.ang,d:dd&&dd.ang,pire:pire&&pire.ang,cote:pire?(pire===g?'gauche':'droit'):null,marge},
      source:'photo de dos ; lecture visuelle inspirée du FPI-6 (Redmond et al., 2006), seuils 4, 8 et 12°'});
  }
  // ── PROFIL : posture et tête (A9) ────────────────────────────────────────
  // Un fil à plomb passe par la malléole latérale : chaque repère en est à une
  // distance horizontale, en cm (positive = en avant). La ligne de référence
  // est celle de Kendall (tragus, acromion, grand trochanter, genou, malléole
  // alignés) ; la méthode, celle du SAPO (Ferreira et al., Clinics 2010).
  // ⚠ UNE PHOTO DEBOUT SAISIT UNE POSTURE DU MOMENT, jamais une structure :
  //   fatigue, regard, respiration la déplacent. Rien ici n'est un diagnostic.
  if(anat&&anat.profil){
    const Pr=vues.profil||null;
    const K=k=>Pr?Pr.P(k):null;
    const tg=K('tragus'),c7=K('c7'),ac=K('acromion'),tc=K('trochanter'),ge=K('genou'),ml=K('malleole');
    const sens=(tg&&c7&&Math.abs(tg.x-c7.x)>1)?Math.sign(tg.x-c7.x):((anat.profil.auto&&anat.profil.auto.sens)||1);
    const cmPr=Pr&&Pr.cmPx;
    const errCm=q=>!q?ANAT_ERR_CM.estime:(q.e>=2?ANAT_ERR_CM.main:(q.e>=0.9?ANAT_ERR_CM.auto:ANAT_ERR_CM.estime));
    const horiz=(q,r0)=>(q&&r0&&cmPr)?(q.x-r0.x)*sens*cmPr:null;
    const plomb=q=>{ const cm=horiz(q,ml); return cm==null?null:{cm,marge:Math.hypot(errCm(q),errCm(ml))+Math.abs(cm)*ECH/100}; };
    // « +2,3 ± 2,8 cm » : court, pour tenir dans la colonne à 390 px.
    const cmTx=(cm,mg)=>(Math.abs(cm)<0.05?'0':_anatSN(cm,1))+' ± '+_anatN(mg,1)+' cm';
    const dTx=d0=>d0==null?'-':cmTx(d0.cm,d0.marge);
    const dist={tragus:plomb(tg),acromion:plomb(ac),trochanter:plomb(tc),genou:plomb(ge)};
    const lignePlomb=(k,lib)=>({lib:lib+' / fil à plomb',def:'distance horizontale à la verticale de la malléole, + en avant ; 0 sur la ligne de Kendall',val:dTx(dist[k]),ref:'0 cm',ecart:''});
    // Le tronc : acromion → grand trochanter / verticale, + penché en avant.
    const tronc=(ac&&tc)?_anatDeg(Math.atan2((ac.x-tc.x)*sens,Math.max(1,tc.y-ac.y))):null;
    // Le genou : l'angle hanche-genou-cheville, 180° tendu ; au-delà, le genou
    // passe EN ARRIÈRE de la ligne hanche → malléole.
    let genouAng=null;
    if(tc&&ge&&ml){
      const a1={x:tc.x-ge.x,y:tc.y-ge.y}, a2={x:ml.x-ge.x,y:ml.y-ge.y};
      const n1=Math.hypot(a1.x,a1.y), n2=Math.hypot(a2.x,a2.y);
      if(n1>1&&n2>1){
        let ang=_anatDeg(Math.acos(Math.max(-1,Math.min(1,(a1.x*a2.x+a1.y*a2.y)/(n1*n2)))));
        const xl=tc.x+(ml.x-tc.x)*(ge.y-tc.y)/((ml.y-tc.y)||1);
        if((ge.x-xl)*sens<0) ang=360-ang;
        genouAng=ang;
      }
    }
    const genouExt=genouAng!=null?genouAng-180:null;
    const nTronc=tronc!=null?_anatNiveau(tronc,ANAT_SEUILS.inclTronc):null;
    const nGenou=genouExt!=null?(genouExt>ANAT_PROFIL.recurvatum?-Math.abs(_anatNiveau(genouExt,ANAT_SEUILS.recurvatum)):0):null;
    const nBassin=dist.trochanter?_anatNiveau(dist.trochanter.cm,ANAT_SEUILS.plombCm):null;
    const ns=[nTronc,nGenou,nBassin].filter(x=>x!=null);
    const pireP=ns.length?ns.reduce((a,b)=>Math.abs(b)>Math.abs(a)?b:a,0):null;
    const margeTr=anatMargeAngle(ANAT_TOL.profil,[ac,tc]);
    const srcProfil='photo de profil ; '+ANAT_PROFIL.SOURCE_REF+' ; '+ANAT_PROFIL.SOURCE_METH;
    fiche({cle:'posture',lib:'Posture',vue:'profil',ancre:tc,
      zone:Pr?_anatZoneAutour([ac,tc,ge,ml],0.12):null,
      etat:pireP==null?'illisible':'ok',niveau:pireP,
      bornes:['en arrière','en avant'],
      valeur:[tronc!=null?'tronc '+_anatSigne(tronc):'',genouAng!=null?'genou '+_anatN(genouAng,0)+'°':''].filter(Boolean).join(' · '),
      tolerance:'distances ±'+_anatN(Math.hypot(ANAT_ERR_CM.auto,ANAT_ERR_CM.auto),1)+' cm environ (placement de deux points, échelle ±'+ECH+' %) ; tronc ±'+_anatN(margeTr)+'°',
      chiffres:[lignePlomb('tragus','Tragus'),lignePlomb('acromion','Acromion'),lignePlomb('trochanter','Grand trochanter'),lignePlomb('genou','Genou'),
        {lib:'Inclinaison du tronc',def:'acromion → grand trochanter / verticale ; + penché en avant',val:tronc!=null?_anatSigneTexte(tronc):'-',ref:'0°',ecart:''},
        {lib:'Angle hanche-genou-cheville',def:'grand trochanter → genou → malléole ; 180° = jambe tendue dans l’axe, lu au-delà de '+(180+ANAT_PROFIL.recurvatum)+'°',val:genouAng!=null?_anatN(genouAng,0)+'°':'-',ref:'180°',ecart:genouExt!=null?_anatSN(genouExt,0)+'°':''}],
      mesure:{sens,dist,tronc,genouAng,genouExt,nTronc,nGenou,nBassin,cmPx:cmPr,marge:margeTr},source:srcProfil});
    // La tête : l'angle cranio-vertébral (C7 → tragus / horizontale). Plus il
    // est petit, plus la tête est portée en avant.
    const cva=(tg&&c7)?_anatDeg(Math.atan2(c7.y-tg.y,Math.max(1e-6,(tg.x-c7.x)*sens))):null;
    const ecCva=cva!=null?ANAT_PROFIL.cva-cva:null;
    const margeCva=anatMargeAngle(ANAT_TOL.cva,[tg,c7]);
    const dTA=horiz(tg,ac);
    fiche({cle:'tete',lib:'Tête et cou',court:'Tête',vue:'profil',ancre:tg,
      zone:Pr?_anatZoneAutour([tg,c7,ac],0.45):null,
      etat:cva==null?'illisible':'ok',niveau:cva==null?null:_anatNiveau(ecCva,ANAT_SEUILS.cva),
      bornes:['tête en arrière','tête en avant'],
      valeur:cva==null?'':'angle '+_anatN(cva,0)+'°',
      tolerance:'±'+_anatN(margeCva)+'° (pose ±'+ANAT_TOL.cva+'°, placement du tragus et de C7 compris)',
      chiffres:[{lib:'Angle cranio-vertébral',def:'droite C7 → tragus / horizontale ; repère de travail '+ANAT_PROFIL.cva+'°, à calibrer',val:cva!=null?_anatN(cva,1)+'°':'-',ref:'≈ '+ANAT_PROFIL.cva+'°',ecart:ecCva!=null?_anatSN(-ecCva,1)+'°':''},
        lignePlomb('tragus','Tragus'),
        {lib:'Tragus / acromion',def:'distance horizontale de l’oreille à la pointe de l’épaule, + en avant ; 0 sur la ligne de Kendall',val:dTA!=null?cmTx(dTA,Math.hypot(errCm(tg),errCm(ac))+Math.abs(dTA)*ECH/100):'-',ref:'0 cm',ecart:''}],
      mesure:{cva,ecart:ecCva,dTA,dT:dist.tragus,marge:margeCva},source:'photo de profil ; angle cranio-vertébral, '+ANAT_PROFIL.CVA_SOURCE+' ; '+ANAT_PROFIL.SOURCE_METH});
  }
  // ⚠ DEUX REPÈRES QUI SE CONTREDISENT : les longueurs passent en gris. Leur
  //   niveau n'est plus publié, ni leur percentile ; les chiffres restent
  //   lisibles, pour que le coach voie ce qui cloche. L'axe du buste, les
  //   inclinaisons, les genoux, les pieds et le dos ne dépendent pas de
  //   l'échelle : ils restent.
  if(verif&&verif.statut==='divergence'){
    for(const f of fiches){
      if(['clavicules','bras','jambes','buste'].indexOf(f.cle)<0) continue;
      f.grise=true; f.stat=null;
      f.chiffres=f.chiffres.filter(c=>c.lib!=='Position dans la population');
      if(f.cle==='buste'){ const sx=f.mesure.s; f.niveau=(sx!=null)?_anatNiveau(sx,ANAT_SEUILS.tronc):null; f.mesure.nTr=0; }
      else f.niveau=null;
    }
  }
  // UN CORPS TOURNÉ (A8) : ses écarts gauche / droite sont ceux de la
  //   projection, pas du corps. Les inclinaisons d'épaules et de bassin, les
  //   pieds, les écarts de longueur des bras et des jambes et les triangles
  //   du dos passent en « non lisible », avec la consigne de reprise.
  const rotation=_anatSafe(()=>anatRotation(anat));
  if(rotation&&rotation.fiable&&rotation.deg>ANAT_ROTATION_SEUIL){
    const nl='non lisible : corps tourné d’environ '+_anatN(rotation.deg,0)+'°';
    const par={}; fiches.forEach(f=>{ par[f.cle]=f; });
    for(const cle of ['epaules','bassin','pieds','arriere_pied']){
      const f=par[cle]; if(!f) continue;
      f.etat='illisible'; f.niveau=null; f.valeur=''; f.tourne=rotation.deg;
      f.chiffres=f.chiffres.map(c=>Object.assign({},c,{val:nl,ecart:''}));
    }
    for(const cle of ['bras','jambes']){
      const f=par[cle]; if(!f) continue;
      f.tourne=rotation.deg; f.mesure.asy=null;
      f.chiffres=f.chiffres.map(c=>c.lib==='Écart gauche / droite'?Object.assign({},c,{val:nl,ecart:''}):c);
    }
    const fd=par.dos;
    if(fd&&(fd.mesure.asy!=null||fd.mesure.oiDiff!=null)){
      fd.tourne=rotation.deg; fd.mesure.asy=null; fd.mesure.oiDiff=null; fd.mesure.pire.nTr=0; fd.mesure.pire.nOi=0;
      const {nOm,nRa}=fd.mesure.pire;
      fd.niveau=(fd.mesure.om!=null||fd.mesure.rach!=null)?(Math.abs(nRa)>Math.abs(nOm)?nRa:nOm):null;
      fd.chiffres=fd.chiffres.map(c=>/^(Triangles|Bord interne)/.test(c.lib)?Object.assign({},c,{val:nl,ecart:''}):c);
    }
  }
  // L'HISTORIQUE POSTURAL (A23) : sans persistance sur trois bilans, un
  // écart d'inclinaison ou d'axe reste au plus « léger ».
  if(!brut&&anat&&anat.bilan){
    const cour=anatMesuresPosture({fiches});
    for(const d of ANAT_SUIVI.CLES){
      const f=fiches.find(x=>x.cle===d.cle);
      if(!f||f.etat!=='ok'||f.tourne) continue;
      const v=cour.mesures[d.m];
      if(v==null) continue;
      const serie=_anatSafe(()=>anatSeriePosture(u,d.m,{bilan:Number(anat.bilan),v},anat))||[];
      const marge=d.cle==='buste'?ANAT_SEUILS.tronc[0]:(f.mesure.marge||ANAT_TOL[d.cle]||2);
      // La persistance se lit JUSQU'AU bilan analysé : c'est son niveau qu'elle autorise.
      const pe=anatPersistance(serie.filter(x=>x.bilan<=Number(anat.bilan)),marge);
      f.suivi={cle:d.m,lib:d.lib,unite:d.unite,serie,marge,persistance:pe};
      // Le buste : seul son AXE est postural ; une longueur classée ne se plafonne pas.
      const axe=d.cle!=='buste'||!f.stat;
      if(axe&&!pe.persistant&&f.niveau!=null&&Math.abs(f.niveau)>1){ f.niveau=Math.sign(f.niveau); f.plafonne=true; }
      if(serie.length>1) f.chiffres=f.chiffres.concat([{lib:'Suivi sur '+serie.length+' bilans',
        def:d.lib.toLowerCase()+', même lecture à chaque bilan ; marge ±'+_anatN(marge,1)+d.unite.trim(),
        val:pe.persistant?'persistant depuis '+pe.n+' bilans':(pe.n?pe.n+' bilan'+(pe.n>1?'s':'')+' de suite du même côté':'non persistant'),
        ref:ANAT_SUIVI.N+' de suite',ecart:''}]);
    }
  }
  // LA CONFIANCE, fiche par fiche, sur les points qu'elle utilise.
  {
    const K=(V,k,sd)=>V?k+'_'+V.cotes[sd]:null;
    const deux=(V,k)=>V?[K(V,k,'g'),K(V,k,'d')]:[];
    const par={}; fiches.forEach(f=>{ par[f.cle]=f; });
    const sB=(par.bras&&par.bras.mesure.cotesOk&&par.bras.mesure.cotesOk[0])||'g';
    const sJ=['g','d'].filter(jambeOk)[0]||'g';
    const sG=(par.genoux&&par.genoux.mesure.pire&&par.genoux.mesure.pire.c==='droit')?'d':'g';
    const cles={
      clavicules:[...deux(F,'acromion'),...deux(F,'crete')],
      epaules:deux(F,'acromion'),
      buste:[...deux(F,'epaule'),...deux(F,'hanche')],
      bras:F?['epaule','coude','poignet'].map(k=>K(F,k,sB)):[],
      bassin:deux(F,'crete'),
      jambes:F?['hanche','genou','cheville'].map(k=>K(F,k,sJ)):[],
      genoux:F?['hanche','genou','cheville'].map(k=>K(F,k,sG)):[],
      pieds:[...deux(F,'talon'),...deux(F,'pointe')],
      dos:D?[...deux(D,'omoplate'),...deux(D,'omoplate_int'),'c7','sacrum']:[],
      posture:vues.profil?['acromion','trochanter','genou','malleole']:[],
      coudes:[...deux(F,'epaule'),...deux(F,'coude'),...deux(F,'poignet')],
      arriere_pied:D?[...deux(D,'mollet'),...deux(D,'achille'),...deux(D,'talon')]:[],
      tete:vues.profil?['tragus','c7']:[]
    };
    const rot=rotation;
    const tourne=!!(rot&&rot.fiable&&rot.deg>ANAT_ROTATION_SEUIL);
    for(const f of fiches){
      const V=vues[f.vue]||null;
      const deg=[];
      if(['clavicules','buste','bras','jambes','posture'].indexOf(f.cle)>=0&&!(verif&&verif.statut==='confirmee'))
        deg.push(verif?ANAT_ECHELLE_MOTS[verif.statut]:'échelle non vérifiée');
      if(tourne) deg.push('corps tourné d’environ '+_anatN(rot.deg,0)+'°');
      const c=anatConfiance(V?V.pts:null,cles[f.cle]||[],deg);
      f.conf=c.conf; f.confCles=c.faibles; f.confVue=f.vue;
      f.confPourquoi='Confiance '+c.conf+' : '+ANAT_CONF_MOTS[c.brut]
        +(c.faibles.length?' ('+c.faibles.map(k=>anatNomPoint(f.confVue,k)).join(', ')+')':'')
        +(deg.length?' ; un cran de moins : '+deg.join(', '):'')+'.';
    }
  }
  // L'APE INDEX (A12) : envergure mesurée − taille, avec son percentile
  // (ANSUR II, calcul RepCore). Une mesure au mètre : elle ne dépend pas de la photo.
  {
    const fbA=fiches.find(f=>f.cle==='bras');
    const env=(taille&&!brut)?_anatSafe(()=>mesureMorpho(u,'deb-envergure')):null;
    if(fbA&&env&&env.cm!=null){
      const MR=ANAT_MESURES_REF[femme?'F':'H'];
      const ape=env.cm-taille, refApe=(MR.envergure-1)*taille, etCm=MR.envergure_et*taille;
      const errPct=Math.hypot(1,1)/taille*100;   // mètre : ±1 cm sur l'envergure et sur la taille
      const st=anatClasser((env.cm/taille-MR.envergure)*100,MR.envergure_et*100,errPct,'aux envergures les plus longues','aux envergures les plus courtes');
      fbA.chiffres=fbA.chiffres.concat([
        {lib:'Envergure − taille (ape index)',def:'envergure au mètre, bras en croix, moins la taille du dossier',val:_anatSN(ape,1)+' cm',ref:_anatSN(refApe,1)+' ± '+_anatN(etCm,1)+' cm',ecart:''},
        {lib:'Position de l’envergure',def:'envergure / taille, '+sexeTxt+' ('+ANAT_MESURES_REF.SOURCE+') ; dispersion ±'+_anatN(MR.envergure_et*100,1)+' %, mesure ±'+_anatN(errPct,1)+' %',val:st.txt,ref:'50ᵉ percentile',ecart:''}]);
      fbA.mesure.ape={cm:ape,ref:refApe,et:etCm,envergure:env.cm,stat:st};
      fbA.source=(fbA.source||'')+' ; envergure au mètre (bilan), repère '+ANAT_MESURES_REF.SOURCE;
    }
  }
  const fb=fiches.find(f=>f.cle==='bras');
  const photoCm={bras:fb&&fb.mesure.mb?fb.mesure.mb.cm:null,avantbras:fb&&fb.mesure.abPhoto?fb.mesure.abPhoto.cm:null,
    rotule:(verif&&verif.genouCm1!=null&&!(B&&B.rotule))?verif.genouCm1:null};
  // ⚠ Les vues gardées malgré le contrôle n'en sortent pas (_anatSansForcees).
  return _anatSansForcees(anat,{photoCm,biais:B,fiches,leviers:anatLeviers(fiches,F,taille,femme,u),echelle:F?{cmPx:F.cmPx,taille,stature:F.stature,verif,pct:ECH,piedsCoupes,cheveux:!!opts.cheveux}:null,rotation,opts,
    posture:anatMesuresPosture({fiches})});
}

/**
 * LE SQUAT RÉGLABLE (chantier A16). Un modèle plan, cuisse parallèle au sol :
 *   - cheville à l'origine, genou en avant de T·sin α (α : inclinaison du tibia) ;
 *   - hanche en arrière du genou de F·cos β (β : abduction de hanche — l'écart
 *     et l'ouverture des pieds projettent le fémur hors du plan sagittal) ;
 *   - barre à l'aplomb du milieu du pied, 0,3 × pied devant la cheville ;
 *   - tronc hanche → barre : Tr − 4 % de la taille barre haute, − 8 % barre basse ;
 *   - cale sous les talons : + 7° de tibia.
 * Sorties : l'inclinaison du buste (depuis la verticale), les bras de levier
 * horizontaux hanche → barre et genou → barre, et leur rapport. Tout est en
 * fraction de la taille. Sources : Fry, Smith & Schilling, JSCR 2003 (le
 * genou qui avance redresse le buste et reporte le travail vers le genou) ;
 * Schoenfeld, JSCR 2010 (barre haute et basse, largeur de pieds).
 */
const ANAT_SQUAT=Object.freeze({ALPHA:30,ALPHA_MIN:20,ALPHA_MAX:45,CALE:7,BARRE:Object.freeze({haute:0.04,basse:0.08}),
  MILIEU_PIED:0.3,DOMINANTE:1.2,
  SOURCE:'Fry, Smith & Schilling, JSCR 2003 ; Schoenfeld, JSCR 2010'});
/** PURE. Le modèle : {F, T, Tr, alpha, beta, pied} → angle et bras de levier. */
function anatSquatModele(p){
  const rad=Math.PI/180;
  const genou=p.T*Math.sin((p.alpha||0)*rad);
  const fp=p.F*Math.cos((p.beta||0)*rad);
  const barre=ANAT_SQUAT.MILIEU_PIED*(p.pied||0);
  const hanche=genou-fp;              // position de la hanche (négative : derrière la cheville)
  const bh=barre-hanche, bg=genou-barre;
  const angle=_anatDeg(Math.asin(Math.max(-1,Math.min(1,bh/p.Tr))));
  const rapport=Math.abs(bg)>1e-6?bh/Math.abs(bg):Infinity;
  return {angle,brasHanche:bh,brasGenou:bg,rapport,
    dominante:rapport>ANAT_SQUAT.DOMINANTE?'hanche':(rapport<1/ANAT_SQUAT.DOMINANTE?'genou':'équilibre')};
}
/** PURE. Le tibia tiré du test du genou au mur : ≈ 30° + 1,2° par cm au-delà de 10 cm, borné 20–45°. APPROXIMATION. */
function anatAlphaCheville(u){
  const t=u&&u.morphoTests&&u.morphoTests.cheville;
  const cm=t?parseFloat(String(t.cm).replace(',','.')):NaN;
  if(!isFinite(cm)) return null;
  const a=Math.max(ANAT_SQUAT.ALPHA_MIN,Math.min(ANAT_SQUAT.ALPHA_MAX,ANAT_SQUAT.ALPHA+1.2*(cm-10)));
  return {alpha:Math.round(a*10)/10,cm};
}
/**
 * PURE. La dernière mesure vidéo d'un mouvement (A20), exportée par le Motion
 * Lab : {date, videoId, exercice, angleTroncBas, angleTibiaBas, profondeur}.
 */
function anatDerniereMesureVideo(u,ex){
  const l=(u&&Array.isArray(u.mesuresVideo))?u.mesuresVideo:[];
  return l.filter(x=>x&&x.exercice===ex&&isFinite(Number(x.angleTroncBas))).sort((a,b)=>(b.date||0)-(a.date||0))[0]||null;
}
/** Au-delà, l'écart prévu / mesuré ne vient pas des segments. */
const ANAT_VIDEO_ECART=8;
const ANAT_VIDEO_PHRASE='L’écart ne vient pas des segments : regarder la cheville et le placement.';
/** PURE. Un réglage appliqué à des proportions : {F,T,Tr (hanche → épaules),pied} × {alpha,beta,barre,cale}. */
function anatSquatCalc(prop,cfg){
  return anatSquatModele({F:prop.F,T:prop.T,Tr:prop.Tr-(ANAT_SQUAT.BARRE[cfg.barre]||ANAT_SQUAT.BARRE.haute),
    alpha:cfg.alpha+(cfg.cale?ANAT_SQUAT.CALE:0),beta:cfg.beta||0,pied:prop.pied});
}
/**
 * LE SOULEVÉ DE TERRE, DEUX STYLES (chantier A17). Une chaîne plane
 * cheville → genou → hanche → épaule, au décollage :
 *   - la barre (22,5 cm du sol, rayon d'un disque de 45 cm) à l'aplomb du
 *     milieu du pied, 0,3 × pied devant la cheville ; la main la tient : le
 *     bras A va de l'épaule au poignet, plus une demi-main ;
 *   - l'épaule 0 à 3 cm devant la barre (1,5 cm retenus) ;
 *   - conventionnel : pieds largeur de hanches, le tibia touche la barre —
 *     genou devant la barre d'un rayon de tibia (≈ 4,5 cm) ;
 *   - sumo : fémur projeté F·cos 40° (hanches ouvertes), tibia plus vertical
 *     (≤ 10°), prise à l'intérieur des genoux, A inchangé.
 * Épaule et genou connus, la hanche est à l'intersection des deux cercles
 * (fémur autour du genou, tronc autour de l'épaule), côté arrière. La hauteur
 * de cheville (0,039 × taille) est celle de Drillis & Contini.
 * Sources : Escamilla et al., MSSE 2000 ; Swinton et al., JSCR 2011.
 */
const ANAT_SOULEVE=Object.freeze({BARRE_CM:22.5,EPAULE_CM:1.5,RAYON_TIBIA_CM:4.5,CHEVILLE:0.039,
  SUMO_FEMUR:40,SUMO_TIBIA:10,TAILLE_DEFAUT:175,
  SOURCE:'Escamilla et al., MSSE 2000 ; Swinton et al., JSCR 2011'});
/** PURE. {F, T, Tr, A, pied, taille, style} → tronc (° / horizontale), hauteur de hanche, bras de levier. */
function anatSouleveModele(p){
  const H=p.taille||ANAT_SOULEVE.TAILLE_DEFAUT, cm=x=>x/H, rad=Math.PI/180;
  const sumo=p.style==='sumo';
  const xa=-ANAT_SQUAT.MILIEU_PIED*(p.pied||0), ya=ANAT_SOULEVE.CHEVILLE;
  const yb=cm(ANAT_SOULEVE.BARRE_CM), r=cm(ANAT_SOULEVE.RAYON_TIBIA_CM), dS=cm(ANAT_SOULEVE.EPAULE_CM);
  // Le genou : devant la barre d'un rayon de tibia ; en sumo, tibia à 10° au plus.
  let kx=r;
  if(sumo){ const aConv=Math.asin(Math.max(-1,Math.min(1,(r-xa)/p.T))); kx=xa+p.T*Math.sin(Math.min(aConv,ANAT_SOULEVE.SUMO_TIBIA*rad)); }
  if(Math.abs(kx-xa)>=p.T) return null;
  const ky=ya+Math.sqrt(p.T*p.T-(kx-xa)*(kx-xa));
  const Fp=sumo?p.F*Math.cos(ANAT_SOULEVE.SUMO_FEMUR*rad):p.F;
  if(!(p.A>dS)) return null;
  const sx=dS, sy=yb+Math.sqrt(p.A*p.A-dS*dS);
  // La hanche : intersection du cercle du fémur (genou) et du cercle du tronc (épaule).
  const dx=sx-kx, dy=sy-ky, dd=Math.hypot(dx,dy);
  if(!(dd<=Fp+p.Tr&&dd>=Math.abs(Fp-p.Tr))) return null;
  const a=(Fp*Fp-p.Tr*p.Tr+dd*dd)/(2*dd), h=Math.sqrt(Math.max(0,Fp*Fp-a*a));
  const mx=kx+a*dx/dd, my=ky+a*dy/dd;
  const c1={x:mx-h*dy/dd,y:my+h*dx/dd}, c2={x:mx+h*dy/dd,y:my-h*dx/dd};
  const hip=c1.x<c2.x?c1:c2;
  return {tronc:_anatDeg(Math.atan2(sy-hip.y,sx-hip.x)),hanche:hip.y,brasHanche:-hip.x,
    tibia:_anatDeg(Math.asin((kx-xa)/p.T)),genou:{x:kx,y:ky},epaule:{x:sx,y:sy},hip};
}
/**
 * LE DÉVELOPPÉ COUCHÉ : PRISE ET TRAJETS (chantier A18). Vu de face, allongé :
 *   - S, entre les centres des épaules = biacromiale − 2 × 3,5 cm ;
 *   - en bas, l'humérus s'écarte du tronc d'un angle θ (45–75°, 60° par
 *     défaut) et l'avant-bras est VERTICAL par construction : la main est à
 *     l'aplomb du coude, et la prise (centre de paume à centre de paume) vaut
 *     S + 2 · H · sin θ ;
 *   - le trajet de barre = hauteur de verrouillage − hauteur de poitrine :
 *     épaule à mi-profondeur du thorax au-dessus du banc (modèle RepCore),
 *     bras tendus de l'épaule au milieu de la paume, poitrine à la profondeur
 *     du thorax (mesurée, sinon 0,145 × taille chez l'homme, 0,152 chez la
 *     femme) ; l'arche remonte la poitrine de 3 cm.
 *   - « entre index » : 3 cm de chaque côté en dedans du milieu de la paume ;
 *     les bagues de la barre sont à 81 cm.
 * Source : Gomo & van den Tillaar, J Sports Sci 2016.
 */
const ANAT_DEV=Object.freeze({EPAULE_CM:3.5,THETA:60,THETA_MIN:45,THETA_MAX:75,INDEX_CM:3,BAGUES_CM:81,ARCHE_CM:3,
  THORAX:Object.freeze({H:0.145,F:0.152}),PRISES:Object.freeze([1.2,1.5,1.8]),
  SOURCE:'Gomo & van den Tillaar, J Sports Sci 2016'});
/**
 * PURE. Tout en cm : {bi, H, A, main, thorax, theta, arche} → prise conseillée,
 * trajet à cette prise, et le tableau des trois prises (1,2 ×, 1,5 ×, 1,8 × la carrure).
 */
function anatDeveloppeModele(p){
  const rad=Math.PI/180, S=p.bi-2*ANAT_DEV.EPAULE_CM, L=p.H+p.A+(p.main||0)/2;
  const theta=Math.max(ANAT_DEV.THETA_MIN,Math.min(ANAT_DEV.THETA_MAX,p.theta||ANAT_DEV.THETA));
  const poitrine=p.thorax+(p.arche?ANAT_DEV.ARCHE_CM:0), epaule=p.thorax/2;
  const trajet=G=>{ const off=Math.max(0,(G-S)/2); if(off>=L) return null; return epaule+Math.sqrt(L*L-off*off)-poitrine; };
  const prise=S+2*p.H*Math.sin(theta*rad);
  const index=prise-2*ANAT_DEV.INDEX_CM;
  return {S,theta,prise,index,bague:(ANAT_DEV.BAGUES_CM-index)/2,trajet:trajet(prise),
    prises:ANAT_DEV.PRISES.map(k=>({k,G:k*p.bi,index:k*p.bi-2*ANAT_DEV.INDEX_CM,trajet:trajet(k*p.bi)}))};
}
/**
 * À CHARGE ÉGALE (chantier A19). Le couple qu'une même charge impose à chaque
 * articulation, rapporté à celui de proportions moyennes (de Leva, 1996, même
 * sexe), À TAILLE ÉGALE. Squat et soulevé : les bras de levier horizontaux des
 * modèles A16 et A17. Développé, tractions, curl : à posture égale, le couple
 * est proportionnel au segment qui porte la charge — humérus (épaule, prise
 * écartée à θ), avant-bras (coude), bras entier jusqu'au milieu de la paume
 * (épaule aux tractions), avant-bras et demi-main (coude au curl).
 */
const ANAT_COUPLES=Object.freeze({BORNE:20,PROCHE:3,ECART_FORCE:0.85,
  EXOS:Object.freeze([
    Object.freeze({cle:'squat',lib:'Squat',motif:/squat/i,exclu:/goblet|bulgare|split|saut|jump|hack|presse|sissy/i,force:1.0}),
    Object.freeze({cle:'souleve',lib:'Soulevé de terre',motif:/soulev|deadlift/i,exclu:/roumain|jambes tendues|rdl|sumo/i,force:1.2}),
    Object.freeze({cle:'developpe',lib:'Développé couché',motif:/d[ée]velopp[ée].*couch|bench/i,exclu:/halt|inclin|d[ée]clin/i,force:0.75}),
    Object.freeze({cle:'tractions',lib:'Tractions',motif:/traction|pull.?up|chin.?up/i,exclu:/australien|assist/i,force:null}),
    Object.freeze({cle:'curl',lib:'Curl',motif:/curl/i,exclu:/leg|ischio|jambe|poignet|nordic|halt|marteau|hammer|concentr|poulie|c[aâ]ble|unilat/i,force:0.35})]),
  // ⚠ Des charges comparables : barre seulement (une charge d'haltère est par main).
  FORCE_SOURCE:'rapports de force habituels entre mouvements à la barre (squat 1, soulevé 1,2, développé 0,75, curl 0,35 : repère RepCore, indicatif)'});
/**
 * PURE. Les couples relatifs, exercice par exercice.
 * @param fiches les fiches d'anatMesures (jambes, buste, bras)
 * @param reg {femme, pied (fraction de taille), kEnv (bras tirés de l'envergure), squat (réglage A16), theta}
 * @returns {{cle,lib,arts:{art,pct,def}[]}[]}
 */
function anatCouples(fiches,reg){
  const o=reg||{}, par={}; (fiches||[]).forEach(f=>{ par[f.cle]=f; });
  const R=anatRef(o.femme), MR=ANAT_MESURES_REF[o.femme?'F':'H'];
  const m=k=>par[k]&&par[k].mesure||{};
  const fr=v=>v&&v.fr>0?v.fr:null;
  const F=fr(m('jambes').cu), T=fr(m('jambes').ja), Tr=fr(m('buste').tr);
  const H=o.kEnv?R.bras*o.kEnv:fr(m('bras').hu), A=o.kEnv?R.avantbras*o.kEnv:fr(m('bras').ab);
  const pied=o.pied||MR.pied, pct=(a,b)=>(a!=null&&b>0)?(a/b-1)*100:null;
  const out=[];
  const ligne=(cle,arts)=>{ const x=ANAT_COUPLES.EXOS.find(e=>e.cle===cle); const a=arts.filter(z=>z.pct!=null&&isFinite(z.pct)); if(a.length) out.push({cle,lib:x.lib,arts:a}); };
  if(F&&T&&Tr){
    const cfg=Object.assign({alpha:ANAT_SQUAT.ALPHA,beta:0,barre:'haute',cale:false},o.squat||{});
    const moi=anatSquatCalc({F,T,Tr,pied},cfg), ref=anatSquatCalc({F:R.cuisse,T:R.jambe,Tr:R.tronc,pied:MR.pied},cfg);
    ligne('squat',[{art:'hanche',pct:pct(moi.brasHanche,ref.brasHanche),def:'bras de levier hanche → barre (modèle du squat)'},
      {art:'genou',pct:pct(moi.brasGenou,ref.brasGenou),def:'bras de levier genou → barre (modèle du squat)'}]);
  }
  if(F&&T&&Tr&&H&&A){
    const tl=o.taille||ANAT_SOULEVE.TAILLE_DEFAUT;
    const sm=anatSouleveModele({F,T,Tr,A:H+A+ANAT_MAIN/2,pied,taille:tl,style:'conventionnel'});
    const sr=anatSouleveModele({F:R.cuisse,T:R.jambe,Tr:R.tronc,A:R.bras+R.avantbras+ANAT_MAIN/2,pied:MR.pied,taille:tl,style:'conventionnel'});
    if(sm&&sr) ligne('souleve',[{art:'hanche',pct:pct(sm.brasHanche,sr.brasHanche),def:'bras de levier hanche → barre au décollage (modèle du soulevé)'}]);
  }
  if(H&&A){
    ligne('developpe',[{art:'épaule',pct:pct(H,R.bras),def:'humérus, écarté à θ en bas : bras de levier de l’épaule'},
      {art:'coude',pct:pct(A,R.avantbras),def:'avant-bras : bras de levier du coude'}]);
    ligne('tractions',[{art:'épaule',pct:pct(H+A+ANAT_MAIN/2,R.bras+R.avantbras+ANAT_MAIN/2),def:'bras entier, du centre de l’épaule au milieu de la paume'}]);
    ligne('curl',[{art:'coude',pct:pct(A+ANAT_MAIN/2,R.avantbras+ANAT_MAIN/2),def:'avant-bras et demi-main : bras de levier du coude'}]);
  }
  return out;
}
/**
 * Le carnet (A19) : le meilleur 1RM estimé de chaque mouvement, ramené à un
 * rapport de force habituel. Un mouvement NETTEMENT plus faible que la moyenne
 * des autres (moins de 85 %) reçoit sa lecture levier.
 */
function anatForceCarnet(u){
  const l=(u&&Array.isArray(u.sessions))?u.sessions:[];
  const noms=new Set(); for(const s of l) if(s&&s.data) Object.keys(s.data).forEach(k=>noms.add(k));
  const idx={};
  for(const x of ANAT_COUPLES.EXOS){
    if(!x.force) continue;
    let best=null;
    for(const n of noms){ if(!x.motif.test(n)||(x.exclu&&x.exclu.test(n))) continue;
      const v=_anatSafe(()=>maxE1rmObserve(u,n)); if(v&&(!best||v>best.e1)) best={nom:n,e1:v}; }
    if(best) idx[x.cle]=Object.assign(best,{i:best.e1/x.force});
  }
  const cles=Object.keys(idx);
  for(const k of cles){
    const autres=cles.filter(j=>j!==k).map(j=>idx[j].i);
    if(!autres.length) continue;
    const moy=autres.reduce((a,b)=>a+b,0)/autres.length;
    idx[k].rel=idx[k].i/moy; idx[k].faible=idx[k].rel<ANAT_COUPLES.ECART_FORCE;
  }
  return idx;
}
/** Le texte d'une configuration, avec ses bras de levier en cm quand la taille est connue. */
function anatSquatTexte(moi,ref,cfg,taille){
  const cm=v=>taille?_anatN(Math.abs(v)*taille,0)+' cm':_anatN(Math.abs(v)*100,1)+' % de la taille';
  const dom={hanche:'dominante hanche',genou:'dominante genou',équilibre:'hanche et genou équilibrés'}[moi.dominante];
  return 'Barre '+cfg.barre+', tibia à '+_anatN(cfg.alpha+(cfg.cale?ANAT_SQUAT.CALE:0),0)+'°'+(cfg.cale?' (cale comprise)':'')+(cfg.beta?', abduction de hanche '+_anatN(cfg.beta,0)+'°':'')
    +' : buste à '+Math.round(moi.angle)+'° de la verticale (proportions moyennes, même réglage : '+Math.round(ref.angle)+'°). '
    +'Bras de levier : hanche → barre '+cm(moi.brasHanche)+', genou → barre '+cm(moi.brasGenou)+(moi.brasGenou<0?' (genou derrière la barre)':'')
    +' ; rapport '+(isFinite(moi.rapport)?_anatN(moi.rapport,2):'-')+', '+dom+'.';
}
/**
 * PURE. CE QUE LES LONGUEURS FONT AUX TROIS GRANDS MOUVEMENTS.
 * Des modèles plans simples, écrits en clair pour qu'on puisse les discuter :
 * - squat, cuisse parallèle au sol, barre au-dessus du milieu du pied, tibia
 *   incliné de 30° (cheville standard) : l'inclinaison du buste sort de la
 *   géométrie cuisse / jambe / tronc ;
 * - soulevé de terre : bras (épaule → poignet + demi-main) sur tronc ;
 * - développé couché : trajet de barre, prise à 1,5 fois la carrure.
 * Chaque sortie est comparée au même modèle appliqué aux proportions moyennes
 * de de Leva (1996), DU MÊME SEXE — les fractions d'ANAT_REF, celles des fiches :
 * c'est l'ÉCART qui renseigne, pas la valeur absolue.
 */
function anatLeviers(fiches,F,taille,femme,u){
  const par={}; fiches.forEach(f=>{ par[f.cle]=f; });
  const R=anatRef(femme), carrure=ANAT_LARGEURS[femme?'F':'H'].biacromial;
  const MR=ANAT_MESURES_REF[femme?'F':'H'];
  const cu=par.jambes.mesure.cu, ja=par.jambes.mesure.ja, tr=par.buste.mesure.tr;
  const out=[];
  // LES MESURES AU MÈTRE (A12), quand le bilan les porte et qu'elles tiennent
  // debout. Absentes, chaque levier reste celui de la photo, au chiffre près.
  const metre=cle=>{ const m=(u&&taille)?_anatSafe(()=>mesureMorpho(u,cle)):null; return m&&m.cm!=null?m.cm:null; };
  const env=metre('deb-envergure'), pied=metre('deb-pied'), thx=metre('deb-thorax'), epM=metre('deb-epaules');
  const photo='longueurs lues sur la photo';
  // Le milieu du pied devant la cheville, en fraction de la taille : 0,03 pour
  // un pied moyen ; un pied mesuré le déplace à proportion (repère ANSUR II).
  const mPied=pied?0.03*(pied/taille)/MR.pied:0.03;
  // LE SQUAT (A16) : le modèle réglable. Réglage par défaut : barre haute,
  // tibia tiré du test du genou au mur s'il existe (sinon 30°), pieds sous
  // les hanches, sans cale. La moyenne reçoit exactement le même réglage.
  if(cu&&ja&&tr&&cu.fr&&ja.fr&&tr.fr){
    const aC=_anatSafe(()=>anatAlphaCheville(u));
    // A20 : le tibia MESURÉ en vidéo prime sur celui du test et sur les 30°.
    const vS=_anatSafe(()=>anatDerniereMesureVideo(u,'squat'));
    const aV=(vS&&isFinite(Number(vS.angleTibiaBas)))?Math.max(ANAT_SQUAT.ALPHA_MIN,Math.min(ANAT_SQUAT.ALPHA_MAX,Number(vS.angleTibiaBas))):null;
    const base={alpha:aV!=null?aV:(aC?aC.alpha:ANAT_SQUAT.ALPHA),beta:0,barre:'haute',cale:false};
    const A={F:cu.fr,T:ja.fr,Tr:tr.fr,pied:pied?pied/taille:MR.pied}, Rp={F:R.cuisse,T:R.jambe,Tr:R.tronc,pied:MR.pied};
    const moi=anatSquatCalc(A,base), ref=anatSquatCalc(Rp,base), cale=anatSquatCalc(A,Object.assign({},base,{cale:true}));
    out.push({cle:'squat',lib:'Squat',val:Math.round(moi.angle),ref:Math.round(ref.angle),cale:Math.round(cale.angle),
      modele:{A,Rp,base,taille:taille||null,alphaSrc:aV!=null?'video':(aC?'test':'defaut'),alphaCm:aC?aC.cm:null},
      video:vS?{date:vS.date,videoId:vS.videoId,mesure:Number(vS.angleTroncBas),tibia:aV,prevu:moi.angle,ecart:Number(vS.angleTroncBas)-moi.angle}:null,
      bras:{hanche:moi.brasHanche,genou:moi.brasGenou,rapport:moi.rapport,dominante:moi.dominante},
      source:photo+(pied?' ; milieu du pied d’après la longueur de pied mesurée au bilan ('+_anatN(pied,1)+' cm ; repère '+ANAT_MESURES_REF.SOURCE+')':' ; milieu du pied pour un pied moyen (ANSUR II)')
        +(aV!=null?' ; tibia mesuré en vidéo ('+_anatN(aV,0)+'°, Motion Lab, '+_anatDateFr(vS.date)+')'
          :(aC?' ; tibia tiré du test du genou au mur ('+_anatN(aC.cm,0)+' cm → '+_anatN(aC.alpha,0)+'°, approximation 30° + 1,2° par cm au-delà de 10 cm)':' ; tibia à 30°'))
        +' ; modèle '+ANAT_SQUAT.SOURCE,
      txt:anatSquatTexte(moi,ref,base,taille)+' Avec une cale sous les talons\u00a0: '+Math.round(cale.angle)+'°.'
        +(pied?' Barre au-dessus du milieu d’un pied de '+_anatN(pied,1)+' cm, mesuré au bilan.':'')});
  }
  // LE BRAS PAR L'ENVERGURE : (envergure − carrure) / 2, rapporté à la même
  // quantité pour des proportions moyennes (ANSUR II), puis appliqué au bras
  // moyen de de Leva. Une envergure moyenne rend le bras moyen, exactement.
  const biFr=epM?epM/taille:carrure;
  const kEnv=env?((env/taille-biFr)/(MR.envergure-carrure)):null;
  const srcEnv=env?'bras tirés de l’envergure mesurée au bilan ('+_anatN(env,0)+' cm'+(epM?', largeur d’épaules au mètre':'')+' ; repère '+ANAT_MESURES_REF.SOURCE+')':null;
  const hu=par.bras.mesure.hu, ab=par.bras.mesure.ab;
  const brasMoi=kEnv?(R.bras+R.avantbras)*kEnv:((hu&&ab&&hu.fr&&ab.fr)?hu.fr+ab.fr:null);
  // LE SOULEVÉ (A17) : le modèle géométrique, en conventionnel et en sumo,
  // comparé au même modèle sur les proportions moyennes de de Leva.
  if(brasMoi&&tr&&tr.fr&&cu&&cu.fr&&ja&&ja.fr){
    const H=taille||ANAT_SOULEVE.TAILLE_DEFAUT;
    const A={F:cu.fr,T:ja.fr,Tr:tr.fr,A:brasMoi+ANAT_MAIN/2,pied:pied?pied/taille:MR.pied,taille:H};
    const Rp={F:R.cuisse,T:R.jambe,Tr:R.tronc,A:R.bras+R.avantbras+ANAT_MAIN/2,pied:MR.pied,taille:H};
    const st={};
    for(const style of ['conventionnel','sumo'])
      st[style]={moi:anatSouleveModele(Object.assign({style},A)),ref:anatSouleveModele(Object.assign({style},Rp))};
    const c=st.conventionnel, su=st.sumo;
    if(c.moi&&c.ref&&su.moi&&su.ref){
      const cmv=v=>_anatN(v*H,0)+' cm';
      const gain=su.moi.tronc-c.moi.tronc, dLev=(c.moi.brasHanche-su.moi.brasHanche)*H;
      const net=gain>=8||dLev>=5;
      const vD=_anatSafe(()=>anatDerniereMesureVideo(u,'souleve'));
      const mesD=vD?90-Number(vD.angleTroncBas):null;
      out.push({cle:'souleve',lib:'Soulevé de terre',val:Math.round(c.moi.tronc*10)/10,ref:Math.round(c.ref.tronc*10)/10,styles:st,taille:H,
        video:vD?{date:vD.date,videoId:vD.videoId,mesure:mesD,prevu:c.moi.tronc,ecart:mesD-c.moi.tronc}:null,
        source:(srcEnv?srcEnv+' ; tronc et jambes lus sur la photo':photo)+' ; modèle '+ANAT_SOULEVE.SOURCE+' ; hauteur de cheville Drillis & Contini'+(taille?'':' ; taille supposée '+H+' cm'),
        decision:'En sumo, le tronc se redresse de '+_anatN(gain,0)+'° ('+_anatN(su.moi.tronc,0)+'° contre '+_anatN(c.moi.tronc,0)+'° en conventionnel) et la hanche se rapproche de la barre de '+_anatN(Math.max(0,dLev),0)+' cm. '
          +(net?'Le sumo raccourcit nettement le levier du dos : une variante à proposer, surtout si le bas du dos limite la charge.'
            :'Les deux styles se valent mécaniquement ici : choisir selon la mobilité de hanche et le ressenti.'),
        txt:'Conventionnel : tronc à '+_anatN(c.moi.tronc,0)+'° de l’horizontale (proportions moyennes : '+_anatN(c.ref.tronc,0)+'°), hanche à '+cmv(c.moi.hanche)+' du sol, bras de levier hanche → barre '+cmv(c.moi.brasHanche)+'. '
          +(c.moi.tronc>c.ref.tronc+3?'Tronc plus droit que la moyenne : un levier favorable au décollage.':c.moi.tronc<c.ref.tronc-3?'Tronc plus couché que la moyenne : le dos porte davantage au décollage.':'Levier dans la moyenne.')
          +(env?' Bras tirés de l’envergure mesurée ('+_anatN(env,0)+' cm).':'')});
    }
  }
  const _cplReg={femme,taille,pied:pied?pied/taille:MR.pied,kEnv};
  const bi=par.clavicules.mesure.bi;
  // LE DÉVELOPPÉ (A18) : la prise conseillée et les trajets, en cm. La carrure
  // vient du mètre s'il y est, sinon de la photo ; le bras et l'avant-bras de
  // l'envergure si elle est mesurée, sinon de la photo.
  // ⚠ UNE CARRURE IMPOSSIBLE NE FAIT PAS UNE PRISE. Hors des bornes du mètre
  //   (25–65 cm), la photo s'est trompée : on prend la carrure moyenne, et on le dit.
  const biPhoto=(bi&&bi.fr)?bi.fr*(taille||ANAT_SOULEVE.TAILLE_DEFAUT):null;
  const biOk=biPhoto!=null&&biPhoto>=25&&biPhoto<=65;
  const biCm=epM||(biOk?biPhoto:carrure*(taille||ANAT_SOULEVE.TAILLE_DEFAUT));
  const Hfr=kEnv?R.bras*kEnv:(hu&&hu.fr?hu.fr:null), Afr=kEnv?R.avantbras*kEnv:(ab&&ab.fr?ab.fr:null);
  if(biCm&&Hfr&&Afr){
    const Ht=taille||ANAT_SOULEVE.TAILLE_DEFAUT;
    const thxDef=ANAT_DEV.THORAX[femme?'F':'H']*Ht;
    const entree=(o)=>Object.assign({theta:ANAT_DEV.THETA,arche:false},o);
    const A=entree({bi:biCm,H:Hfr*Ht,A:Afr*Ht,main:ANAT_MAIN*Ht,thorax:thx||thxDef});
    const Rm=entree({bi:carrure*Ht,H:R.bras*Ht,A:R.avantbras*Ht,main:ANAT_MAIN*Ht,thorax:thxDef});
    const moi=anatDeveloppeModele(A), ref=anatDeveloppeModele(Rm);
    if(moi.trajet!=null&&ref.trajet!=null){
      const c0=v=>_anatN(v,0)+'\u00a0cm';
      out.push({cle:'developpe',lib:'Développé couché',val:Math.round(moi.trajet),ref:Math.round(ref.trajet),
        ecart:(moi.trajet/ref.trajet-1)*100,modele:{A,Rm,taille:Ht},prise:moi,
        source:(srcEnv||photo)+(epM?' ; largeur d’épaules au mètre':(biOk?'':' ; carrure moyenne (ANSUR II) : la photo ne donne pas une largeur d’épaules plausible'))
          +(thx?' ; point bas au sternum, profondeur du thorax mesurée au bilan ('+_anatN(thx,1)+' cm ; repère '+_anatN(MR.thorax,1)+' ± '+_anatN(MR.thorax_et,1)+' cm, '+ANAT_MESURES_REF.SOURCE+')'
            :' ; profondeur du thorax estimée à '+_anatN(ANAT_DEV.THORAX[femme?'F':'H'],3).replace('.',',')+' × la taille')
          +' ; modèle '+ANAT_DEV.SOURCE+(taille?'':' ; taille supposée '+Ht+' cm'),
        txt:'Prise conseillée (humérus à '+ANAT_DEV.THETA+'° du tronc en bas, avant-bras vertical) : '+c0(moi.prise)+' de milieu de paume à milieu de paume, '+c0(moi.index)+' entre index. '
          +'Trajet de barre à cette prise : '+c0(moi.trajet)+' (proportions moyennes, même taille : '+c0(ref.trajet)+').'
          +(thx?' La barre touche le sternum : '+_anatN(thx,1)+' cm de thorax mesurés.':'')});
    }
  }
  // À CHARGE ÉGALE (A19) : le dernier onglet des leviers.
  const cpl=_anatSafe(()=>anatCouples(fiches,_cplReg));
  if(cpl&&cpl.length){
    const tous=[].concat(...cpl.map(x=>x.arts));
    const pire=tous.reduce((a,b)=>Math.abs(b.pct)>Math.abs(a.pct)?b:a,tous[0]);
    out.push({cle:'couples',lib:'À charge égale',rows:cpl,pire:pire.pct,
      source:photo+(kEnv?' ; bras tirés de l’envergure':'')+' ; proportions moyennes de Leva (1996) ; modèles du squat, du soulevé et du développé',
      txt:'À taille égale, chaque barre compare le couple qu’une même charge impose à l’articulation avec celui de proportions moyennes. Au-delà de ±'+ANAT_COUPLES.BORNE+' %, la barre est bornée.'});
  }
  return out;
}
function _anatSafe(f){ try{ const v=f(); return v==null?null:v; }catch(e){ return null; } }
function _anatSigne(v){ return v==null?'-':(_anatSN(v,1)+'°'); }
function _anatSigneTexte(v,genou){
  if(v==null) return 'non lu';
  if(Math.abs(v)<0.05) return '0°';
  if(genou) return _anatN(v)+'° '+(v>0?'en dedans':'en dehors');
  return _anatN(v)+'° '+(v>0?'gauche plus bas':'droite plus bas');
}
/** Un cadre autour de points (en pixels), élargi de `marge` × sa taille. */
function _anatZoneAutour(ps,marge){
  const l=(ps||[]).filter(Boolean);
  if(l.length<2) return null;
  const xs=l.map(p=>p.x),ys=l.map(p=>p.y);
  let x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const w=Math.max(x1-x0,(y1-y0)*0.5,20),h=Math.max(y1-y0,(x1-x0)*0.4,20);
  const m=Math.max(w,h)*(marge||0.2);
  return {x0:x0-m,y0:y0-m,x1:x1+m,y1:y1+m};
}
// ── CE QU'ON EN FAIT ───────────────────────────────────────────────────────
// Chaque fiche : une phrase courte (deux lignes), puis le texte long, bâti sur
// LES CHIFFRES de l'athlète — ce que la photo montre, ce que ça change
// mécaniquement, quoi privilégier, quoi aménager et avec quel réglage, et
// comment le vérifier. Jamais un exercice « à éviter ».
/**
 * DU TEXTE À L'ACTION (chantier A21). Les noms cités dans les recommandations,
 * reliés aux fiches du catalogue d'exercices — les slugs de app/exercices,
 * ceux que l'éditeur de programme utilise. L'ordre compte : le motif le plus
 * précis d'abord (« soulevé roumain » avant « soulevé »).
 */
const ANAT_EXOS_LIENS=Object.freeze([
  [/élévations? latérales?/i,['elevation-laterale-haltere','elevation-laterale-poulie']],
  [/face pull/i,['face-pull']],[/y-raise/i,['elevation-y']],
  [/tirage vertical/i,['tirage-vertical-a-la-poulie']],[/(^|[\s(,;:])tractions?\b/i,['tractions']],
  [/pull-over/i,['pull-over']],[/oiseau/i,['oiseaux-buste-penche']],
  [/pallof/i,['pallof-press']],[/planche latérale/i,['gainage-lateral']],[/planche|gainage/i,['gainage-planche']],
  [/vacuum/i,['le-vacuum']],[/soulevé roumain|roumain/i,['souleve-de-terre-roumain']],
  [/good morning/i,['good-morning']],[/hip thrust/i,['hip-thrust']],[/pont fessier/i,['glute-bridge']],
  [/rowing un bras|rowing.*unilat/i,['rowing-haltere-unilateral']],[/tirage poulie un bras/i,['tirage-horizontal-unilateral']],
  [/rowing|tirages? horizonta/i,['tirage-horizontal-large']],
  [/carry|valise|farmer|fermier/i,['marche-du-fermier']],
  [/split squat|bulgare/i,['squat-bulgar-haltere']],[/fente/i,['fentes-haltere']],[/step-up/i,['monter-sur-banc-haltere']],
  [/montées? sur pointes/i,['mollets-debout-unilateral']],[/front squat/i,['squat-barre-devant']],
  [/squat gobelet|gobelet/i,['squat-avec-halteres']],[/abduction de hanche/i,['abducteur-a-la-machine']],
  [/leg curl/i,['leg-curl-allonge']],[/curl incliné/i,['curl-sur-banc-incline']],[/curl pupitre/i,['curl-larry-scott']],
  [/curl marteau/i,['curl-marteau']],[/barre ez/i,['curl-barre']],[/supination libre/i,['curl-rotation']],
  [/pushdown à la corde|à la corde/i,['triceps-a-la-poulie-haute-corde']],[/pushdown/i,['triceps-a-la-poulie-haute-barre']],
  [/extension au-dessus de la tête/i,['extension-triceps-au-dessu-de-la-tete']],[/barre au front/i,['barre-au-front-banc-incline']],
  [/développé militaire/i,['developpe-militaire-barre']],[/landmine/i,['developpe-epaule-au-landmine']],
  [/développé couché|développé haltère|au développé/i,['developpe-couche-barre']],[/dips/i,['dips']],
  [/barre hexagonale/i,['souleve-de-terre-trap-barre']],[/sumo/i,['souleve-de-terre-sumo']],
  [/soulevé de terre/i,['souleve-de-terre']],[/extensions? lombaires?|banc à 45/i,['extension-de-buste-sur-banc']],
  [/pompes scapulaires/i,['pompes']],[/shrug/i,['shrug-haltere']],[/tibia|flexion dorsale/i,['tibia-dorsi-flexion']],
  [/squat/i,['squat']]
]);
/** Les mots qui disent le POURQUOI morphologique : ils ne descendent jamais chez l'athlète (G7). */
const ANAT_LEXIQUE_MORPHO=/morpho|levier|fémur|femur|tibia|humérus|humerus|clavicule|carrure|charpente|proportion|segment|asymétr|silhouette|percentile|population|recurvatum|anatom|ossature|\bos\b|squelett|longueur de|court|long\b|longs|étroit|axe du|posture|projection/i;
/** PURE. Les exercices du catalogue cités dans un texte (quatre au plus). */
function anatLierExos(texte){
  const t=String(texte||''), out=[];
  for(const [re,sl] of ANAT_EXOS_LIENS){ if(re.test(t)) for(const x of sl) if(out.indexOf(x)<0) out.push(x); if(out.length>=4) break; }
  return out.slice(0,4);
}
/**
 * PURE. La consigne d'exécution qu'on peut envoyer à l'athlète : le réglage,
 * clause par clause, sans aucune qui porte un mot du lexique morphologique.
 * Vide si rien ne reste.
 */
function anatConsigneAthlete(reglage){
  const cl=String(reglage||'').split(/\s*[;:]\s*|\s+—\s+/).map(x=>x.trim()).filter(Boolean);
  const garde=[];
  for(const c of cl){ if(ANAT_LEXIQUE_MORPHO.test(c)) continue; if((garde.join(' ; ')+c).length>150) break; garde.push(c); }
  const t=garde.join(' ; ');
  return t?t.charAt(0).toUpperCase()+t.slice(1):'';
}
/** Une recommandation : son texte, ses exercices ; lue comme une chaîne là où l'on n'attend qu'un texte. */
function _anatReco(texte){
  return {texte,exercices:anatLierExos(texte),toString(){ return this.texte; }};
}
/**
 * Le texte d'une fiche, et ce qu'on peut en FAIRE (A21) : à privilégier →
 * {texte, exercices} ; à aménager → {quoi, reglage, exercices, consigne}.
 */
function anatTexte(f,res){
  const T=_anatTexteBrut(f,res);
  T.privilegier=(T.privilegier||[]).map(x=>typeof x==='string'?_anatReco(x):x);
  T.amenager=(T.amenager||[]).map(x=>Object.assign({},x,{exercices:anatLierExos(x.quoi+' '+x.reglage),consigne:anatConsigneAthlete(x.reglage)}));
  // A23 : la persistance, dite avec la prudence de P14.
  const su=f&&f.suivi;
  if(su&&su.persistance.persistant)
    T.lecture=(T.lecture?T.lecture+' ':'')+'Persistant depuis '+su.persistance.n+' bilans, du même côté et au-delà de la marge : ce n’est plus une photo isolée. Réévaluer au prochain bilan après un bloc de travail unilatéral ; si l’écart ne bouge pas, en parler avec l’athlète, et l’orienter vers un professionnel de santé si une gêne existe.';
  else if(f&&f.plafonne)
    T.lecture=(T.lecture?T.lecture+' ':'')+'Écart au-delà de « léger » sur cette photo, mais pas encore trois bilans de suite du même côté : il reste « léger » tant qu’il ne revient pas (même règle que pour une asymétrie latérale soutenue).';
  return T;
}
function _anatTexteBrut(f,res){
  const m=f.mesure||{};
  const T={court:'',lecture:'',privilegier:[],amenager:[],verifier:''};
  const lev=(res&&res.leviers)||[];
  const L=k=>lev.find(x=>x.cle===k)||null;
  const intens=n=>['dans la marge','léger','net','marqué'][Math.abs(n||0)];
  if(f.etat==='illisible'&&f.tourne){
    T.court='Non lisible : corps tourné d’environ '+_anatN(f.tourne,0)+'° sur la photo : un écart gauche / droite y serait celui de la projection.';
    T.lecture='Quand le corps n’est pas de face, un côté s’éloigne de l’objectif : il paraît plus court, plus bas ou plus fermé que l’autre, sans l’être. La rotation se lit sur le rapport épaules / hanches, de face et de dos.';
    T.verifier=ANAT_ROTATION_CONSIGNE;
    return T;
  }
  if(f.etat==='illisible'&&f.cle==='arriere_pied'&&!f.tourne){
    T.court='Arrière-pied non lisible : mollets, tendons d’Achille et talons doivent se voir sur la photo de dos.';
    T.lecture='L’angle se lit entre la ligne du mollet et celle du talon ; il lui faut trois points par pied, visibles ou posés à la main (« Ajuster les points », vue Dos).';
    T.verifier=ANAT_ARRIERE_PIED_CONSIGNE;
    return T;
  }
  if(f.etat==='illisible'&&f.cle==='coudes'){
    if(m.raison==='paumes'){
      T.court='Non lisible : paumes tournées vers les cuisses (l’angle de port du coude ne se lit que paumes vers l’avant).';
      T.lecture='Paumes vers les cuisses, l’avant-bras tourne sur lui-même et son axe se replace sous le bras : l’angle de port disparaît de la photo. On ne le devine pas.';
      T.verifier='Si la photo montre les paumes vers l’avant : cocher « paumes vers l’avant » dans « Ajuster les points ». Sinon, demander les prochaines photos paumes vers l’avant (« Échelle et prise de vue »). '+ANAT_COUDE.CONSIGNE;
    }else{
      T.court='Non lisible : bras fléchis sur la photo (ou le seul bras tendu tient le téléphone), l’angle de port ne se lit que bras tendus.';
      T.lecture='Un coude fléchi, même un peu, ferme l’angle dans le plan de la photo et raccourcit l’avant-bras : la mesure serait celle de la flexion.';
      T.verifier=ANAT_COUDE.CONSIGNE+' Vérifier aussi le centre du coude et du poignet (« Ajuster les points »).';
    }
    return T;
  }
  if(f.etat==='illisible'){
    if(f.cle==='dos'&&!m.lu){
      T.court='Photo de dos non lue : aucune silhouette reconnue avec assez de certitude.';
      T.lecture='Le moteur de pose ne trouve pas la personne sur la photo de dos (trop sombre, fond chargé ou personne coupée). Les repères peuvent être posés à la main : « Ajuster les points », vue Dos.';
      T.verifier='Au prochain bilan : photo de dos en pied, fond clair et uni, bras relâchés un peu écartés du corps.';
      return T;
    }
    if(f.cle==='bras'&&m.telAth&&!(m.cotesOk||[]).length){
      T.court='Le seul bras tendu tient le téléphone : aucune longueur de bras ne se lit sur cette photo.';
      T.lecture='Un bras plié se raccourcit en projection : le mesurer donnerait un humérus faux. On ne remplace pas la mesure par une estimation.';
      T.verifier='Demander une photo de face prise par quelqu’un d’autre ou avec un minuteur, bras relâchés le long du corps.';
      return T;
    }
    if(f.vue==='profil'){
      T.court='Repères de profil insuffisants : à placer à la main sur la photo de profil.';
      T.lecture='Le tragus, C7, l’acromion, le grand trochanter, le genou et la malléole doivent être visibles, ou posés à la main (« Ajuster les points », vue Profil). Sans eux, ni le fil à plomb ni l’angle de la tête ne se lisent.';
      T.verifier=ANAT_PROFIL.CONSIGNE;
      return T;
    }
    T.court='Repères insuffisants pour lire cette zone avec une marge honnête : à placer à la main.';
    T.lecture='Les points nécessaires ne sont pas visibles, ou le membre est plié (un membre plié paraît plus court qu’il n’est). « Ajuster les points » permet de les poser à la main, puis de relancer l’analyse.';
    T.verifier='Photo de face en pied, pieds à largeur de hanches, bras relâchés légèrement écartés du corps.';
    return T;
  }
  if(f.grise&&res&&res.echelle&&res.echelle.verif&&res.echelle.verif.prise){
    const pl=res.echelle.verif.prise.sens==='plongee';
    T.court='Longueurs en gris : photo prise '+(pl?'en plongée (téléphone trop haut ou trop près)':'en contre-plongée (téléphone trop bas)')+', à refaire.';
    T.lecture='Sur cette photo, les jambes paraissent environ '+res.echelle.verif.prise.pct+' % plus '+(pl?'courtes':'longues')+' qu’elles ne sont par rapport au buste : c’est la perspective, pas la morphologie, et aucun déplacement de point ne la corrige. Aucune longueur n’est classée.'
      +(f.cle==='buste'&&f.mesure&&f.mesure.s!=null?' L’axe du buste, lui, ne dépend pas de l’échelle : décalage de '+_anatN(f.mesure.s,1)+' % du tronc.':'');
    T.verifier='Refaire la photo : téléphone posé à hauteur de hanche, bien droit, à 2 ou 3 m, le corps en entier dans le cadre.';
    return T;
  }
  if(f.grise){
    T.court='Longueurs en gris : les deux repères d’échelle ne donnent pas la même mesure (sommet du crâne, talons et genoux à vérifier).';
    T.lecture='L’échelle par la taille (sommet du crâne → talons) et celle par le genou diffèrent de plus de '+_anatN(MORPHO_ECHELLE_ECART_MAX*100,0)+' % : un point mal placé fausse toutes les longueurs du même facteur, sans que rien ne le montre. Tant que les deux ne s’accordent pas, aucune longueur n’est classée.'
      +(f.cle==='buste'&&f.mesure&&f.mesure.s!=null?' L’axe du buste, lui, ne dépend pas de l’échelle : décalage de '+_anatN(f.mesure.s,1)+' % du tronc.':'');
    T.verifier='Replacer le sommet du crâne, les talons et les genoux (« Ajuster les points »), puis relancer l’analyse ; ou saisir au prochain bilan la hauteur du sol au milieu de la rotule, qui donne une échelle au mètre.';
    return T;
  }
  const n=f.niveau||0, an=Math.abs(n);
  switch(f.cle){
  case 'arriere_pied':{
    const cote=m.cote?' ('+m.cote+')':'';
    T.court=!an?'Arrière-pied dans l’axe : G '+_anatSN(m.g,0)+'° · D '+_anatSN(m.d,0)+'° (0 à 4° : dans la marge).'
      :(n>0?'Talon qui rentre en dedans'+cote+' : '+_anatSN(m.pire,0)+'°, '+intens(n)+'. Posture d’appui du moment, à confirmer au bilan suivant.'
        :'Talon qui part en dehors'+cote+' : '+_anatSN(m.pire,0)+'°, '+intens(n)+'. Posture d’appui du moment, à confirmer au bilan suivant.');
    T.lecture='Vu de dos, quand l’arrière-pied s’affaisse vers l’intérieur, la ligne du mollet et celle du talon se cassent au niveau du tendon d’Achille : le bas du talon part en dehors de l’axe de la jambe. C’est une lecture visuelle inspirée du FPI-6 (Redmond et al., 2006), pas le score lui-même : debout, pieds nus, elle dépend de l’appui du moment et des chaussures portées juste avant.';
    if(an){
      T.privilegier=['Pied « trépied » : talon, base du gros orteil et base du petit orteil posés, l’arche se soulève sans crisper les orteils (à tenir debout, puis au squat)',
        'Short foot : raccourcir le pied en rapprochant la base du gros orteil du talon, 5 à 10 s, 8 à 10 répétitions',
        'Montées sur pointes lentes : 3 s en montée, 3 s en descente, genou tendu puis genou fléchi',
        'Pour le squat, une chaussure à semelle ferme et stable'];
      T.amenager=[{quoi:'Squat',reglage:'pieds un peu plus ouverts (15 à 30°), genoux dans l’axe des pieds ; une cale sous les talons si la cheville bloque la descente'}];
    }
    T.verifier=ANAT_ARRIERE_PIED_CONSIGNE;
    return T;
  }
  case 'coudes':{
    const R=m.ref||ANAT_COUDE.H, sx=m.femme?'des femmes':'des hommes';
    const quoi=_anatSN(m.moy,0)+'° (repère '+sx+' : '+R.moy+'° ± '+R.et+'°)';
    T.court=!an?'Port du coude dans la moyenne : '+quoi+'.'
      :(n>0?'Coudes plus ouverts que la moyenne : '+quoi+'.':'Coudes plus fermés que la moyenne : '+quoi+'.');
    T.lecture='L’angle de port se lit bras tendus, paumes vers l’avant : l’avant-bras s’écarte un peu en dehors de l’axe du bras, d’ordinaire un peu plus chez les femmes. Il décide de la trajectoire où l’avant-bras est à l’aise dans les curls, les extensions et les développés. Mesuré dans le plan de la photo : une légère rotation du bras le déplace de quelques degrés, d’où la marge.';
    if(an){
      T.privilegier=['Curls à la barre EZ ou aux haltères en supination libre : le poignet trouve lui-même son angle',
        'Extensions à la poulie : pushdown à la corde, les mains s’écartent en bas',
        'Au développé, la prise où l’avant-bras reste vertical en bas du mouvement, vu de face'];
      if(n>0) T.amenager=[{quoi:'Curl à la barre droite',reglage:'barre EZ ou haltères, ou prise un peu plus large, pour que l’avant-bras suive son angle'}];
    }
    T.verifier=ANAT_COUDE.CONSIGNE+' Replacer au besoin le centre du coude et du poignet (« Ajuster les points »).';
    return T;
  }
  case 'tete':{
    const ta=m.dTA;
    const moment=' Posture du moment, à confirmer au bilan suivant.';
    if(!an) T.court='Tête dans l’axe : angle cranio-vertébral de '+_anatN(m.cva,0)+'° (repère de travail '+ANAT_PROFIL.cva+'°).'+moment;
    else if(n>0) T.court='Tête portée en avant sur cette photo : angle cranio-vertébral de '+_anatN(m.cva,0)+'° pour un repère de '+ANAT_PROFIL.cva+'°'
      +(ta!=null&&ta>0.5?', tragus '+_anatN(ta,1)+' cm devant l’acromion':'')+'.'+moment;
    else T.court='Tête portée en arrière sur cette photo : angle cranio-vertébral de '+_anatN(m.cva,0)+'° pour un repère de '+ANAT_PROFIL.cva+'°.'+moment;
    T.lecture='L’angle cranio-vertébral se lit entre la droite C7 → tragus et l’horizontale : plus il est petit, plus la tête est portée devant les épaules. Sur une photo debout, il dépend du regard, de la fatigue et de l’habitude du moment ; il décrit une posture, il ne dit rien de la santé du cou. Le repère de '+ANAT_PROFIL.cva+'° est un ordre de grandeur de l’adulte debout, à affiner sur les athlètes suivis.';
    if(n>0){
      T.privilegier=['Mobilité thoracique : extensions sur rouleau, rotations en quadrupédie (« open book »), 2 à 3 séries en échauffement',
        'Rétraction scapulaire : face pull à la poulie, Y-raise sur banc incliné, 12 à 20 répétitions contrôlées',
        'Placement de la tête dans les tirages et les rowings : menton légèrement rentré, nuque longue, regard au sol devant soi'];
      T.amenager=[{quoi:'Développé militaire',reglage:'la tête recule pour laisser passer la barre puis revient « dans la fenêtre » au-dessus ; en haltères ou à la landmine si la trajectoire contourne le visage'},
        {quoi:'Squat',reglage:'regard à l’horizontale ou légèrement vers le bas, pas vers le plafond : la nuque reste dans l’axe du dos'}];
    }
    T.verifier='Au bilan suivant, même prise de vue. '+ANAT_PROFIL.CONSIGNE+' Replacer au besoin le tragus (le petit cartilage devant le conduit de l’oreille) et C7 (« Ajuster les points », vue Profil).';
    return T;
  }
  case 'posture':{
    const d=m.dist||{}, moment=' Posture du moment, à confirmer au bilan suivant.';
    const parts=[];
    if(m.nTronc) parts.push('tronc penché '+(m.tronc>0?'en avant':'en arrière')+' de '+_anatN(Math.abs(m.tronc),0)+'°');
    if(m.nBassin) parts.push('bassin (grand trochanter) '+_anatN(Math.abs(d.trochanter.cm),1)+' cm '+(d.trochanter.cm>0?'en avant':'en arrière')+' du fil');
    if(m.nGenou) parts.push('genou tendu au-delà de l’axe ('+_anatN(m.genouAng,0)+'°)');
    T.court=(parts.length?'Sur cette photo de profil : '+parts.join(', ')+'.':'Alignement de profil dans la marge : les repères tombent près du fil à plomb.')+moment;
    T.lecture='Le fil à plomb passe par la malléole latérale. Kendall décrit une ligne de référence qui passe près du tragus, de l’acromion, du grand trochanter et de l’axe du genou : chaque repère en est ici à une distance horizontale, avec sa marge. Un genou à plus de 180° + '+ANAT_PROFIL.recurvatum+'° se tend au-delà de l’axe de la jambe (ce qu’on appelle un recurvatum de posture). Une photo debout saisit une posture du moment (respiration, fatigue, chaussures), jamais une structure : elle dit où regarder, pas pourquoi.';
    if(an){
      T.privilegier=['Gainage : planche, dead bug, Pallof press (côtes basses, bassin sous les côtes)'];
      if(m.nTronc>0||(d.acromion&&d.acromion.cm>3)) T.privilegier.push('Mobilité thoracique : extensions sur rouleau, rotations en quadrupédie','Rétraction scapulaire : face pull, Y-raise sur banc incliné');
      T.privilegier.push('Chaîne postérieure : soulevé de terre roumain, hip thrust, extensions de hanche au banc à 45°, amplitude contrôlée');
      T.amenager=[{quoi:'Squat',reglage:'buste gainé avant la descente, côtes basses ; talons surélevés d’une cale de 1 à 2,5 cm si le buste part loin devant'+(m.nGenou?' ; en haut de chaque répétition, genoux « déverrouillés », légèrement fléchis':'')},
        {quoi:'Développé militaire',reglage:'fessiers serrés et côtes basses pour ne pas cambrer en poussant ; assis dos soutenu si le buste part en arrière'}];
    }
    T.verifier='Au bilan suivant, même prise de vue. '+ANAT_PROFIL.CONSIGNE+' Replacer au besoin le grand trochanter (la bosse osseuse sur le côté de la hanche) et la malléole (« Ajuster les points », vue Profil).';
    return T;
  }
  case 'clavicules':{
    const bi=m.bi, bc=m.bc, r=m.r;
    const c=v=>v&&v.cm!=null?_anatN(v.cm,1)+' cm':(v&&v.fr?_anatN(v.fr*100,1)+' % de la taille':'-');
    const ref=m.femme?'des femmes adultes':'des hommes adultes';
    if(!an){
      T.court='Carrure dans la moyenne ('+c(bi)+' d’acromion à acromion) : le V se construira par le deltoïde et le dos.';
    }else if(n>0){
      T.court='Clavicules longues : carrure osseuse '+_anatSN(m.ec,0)+' % au-dessus de la moyenne '+ref+'. Le V est de construction.';
    }else{
      T.court='Clavicules courtes : carrure osseuse '+_anatSN(m.ec,0)+' % sous la moyenne '+ref+'. La largeur viendra du deltoïde latéral et du dos.';
    }
    T.lecture='Largeur biacromiale '+c(bi)+', bassin (crêtes iliaques) '+c(bc)+(r?', soit un rapport épaules / bassin de '+_anatN(r,2)+' pour '+_anatN(m.rRef,2)+(m.rEt?' ± '+_anatN(m.rEt,2):'')+' en moyenne chez des adultes actifs ('+(m.femme?'femmes':'hommes')+', ANSUR II)':'')+'. '
      +'La clavicule fixe l’écartement des épaules : c’est elle qui donne le bras de levier au développé prise large et la base de la silhouette en V. Elle ne change pas avec l’entraînement ; ce qui change, c’est ce qui s’y attache (deltoïdes, trapèzes, grands dorsaux). '
      +(n>0?'Une charpente large offre le V : le piège est de s’appuyer dessus et de laisser le bas du corps en retrait.'
        :n<0?'Une charpente étroite ne limite pas le physique : elle déplace la priorité vers les faisceaux qui élargissent à l’œil (deltoïde latéral et dorsaux) et vers une taille fine.'
        :'Rien à rattraper : la silhouette dépendra de ce qui sera développé.');
    if(n<0){
      T.privilegier=['Deltoïde latéral en priorité : élévations latérales (haltères, poulie basse derrière le corps, machine), 12 à 20 séries par semaine en phase de priorité, dont une partie en position allongée (poulie)','Largeur de dos : tractions et tirage vertical prise large, pull-over à la poulie','Deltoïde postérieur (oiseau, face pull) : il élargit aussi la silhouette vue de dos','Taille : gainage anti-rotation (Pallof press), vacuum, masse grasse maîtrisée (le rapport deltoïdes / taille fait le V autant que l’os)'];
      T.amenager=[{quoi:'Développé couché',reglage:'prise moyenne (avant-bras verticaux en bas) : une prise très large n’apporte rien à une charpente étroite et charge l’épaule en bout d’amplitude'},{quoi:'Travail lourd du moyen fessier et des abducteurs',reglage:'à doser selon l’objectif esthétique : il élargit la hanche visuelle'}];
    }else if(n>0){
      T.privilegier=['Quadriceps, ischios et fessiers au même niveau d’exigence que le haut : l’équilibre haut / bas se remarque le plus sur une charpente large','Rowing et tirages horizontaux pour l’épaisseur du dos, qui accompagne la largeur','Deltoïde postérieur et coiffe des rotateurs : une longue clavicule allonge le levier sur l’épaule'];
      T.amenager=[{quoi:'Développé couché prise large',reglage:'prise calée sur la carrure : avant-bras verticaux en bas du mouvement ; au-delà, le levier sur l’épaule grandit plus vite que le travail du pectoral'},{quoi:'Dips',reglage:'buste un peu penché, amplitude arrêtée quand l’épaule passe sous le coude'}];
    }else{
      T.privilegier=['Deltoïde latéral et dorsaux pour la largeur, fessiers et quadriceps pour l’équilibre'];
    }
    T.verifier=(f.estime?'Les acromions et les crêtes iliaques sont ESTIMÉS par le moteur : les palper sur l’athlète ou les replacer sur la photo (« Ajuster les points ») avant de retenir ces chiffres. ':'')
      +'Confirmer au mètre ruban : pointe d’épaule à pointe d’épaule, de dos, en ligne droite ; puis d’une crête iliaque à l’autre. Chez l’adulte, ces largeurs ne bougent plus.';
    return T;
  }
  case 'epaules':{
    const a=m.a, bas=a>0?'gauche':'droite';
    if(!an){
      T.court='Épaules de niveau ('+_anatN(a)+'°, sous la marge de ±'+_anatN(m.marge||ANAT_TOL.epaules)+'°) : rien à compenser.';
      T.lecture='La ligne des deux acromions est horizontale à la précision de la photo, de face'+(m.ad!=null?' comme de dos':'')+'. La ceinture scapulaire se présente équilibrée.';
      T.privilegier=['Garder l’équilibre tirage / poussée : au moins autant de séries de tirage que de développé','Stabilité des omoplates : Y-raise sur banc incliné, pompes scapulaires, face pull'];
    }else{
      T.court='Épaule '+bas+' plus basse de '+_anatN(a)+'°'+(m.dh!=null?' ('+_anatN(m.dh,1)+' cm)':'')+' : décalage '+intens(n)+', à surveiller au développé et aux tirages.';
      T.lecture='Sur une photo debout, une épaule plus basse vient le plus souvent d’une habitude (côté dominant, sac porté d’un côté), d’un trapèze supérieur plus tonique d’un côté ou d’un tronc qui s’incline : la photo ne dit pas lequel. Ce n’est pas une anomalie : c’est un point de départ pour regarder l’exécution.'
        +((m.af!=null&&m.ad!=null)?' Face : '+_anatSigneTexte(m.af)+' ; dos : '+_anatSigneTexte(m.ad)+'. '+(Math.sign(m.af)===Math.sign(m.ad)&&Math.abs(m.af-m.ad)<2?'Les deux photos disent la même chose : c’est la posture habituelle, pas la pose du moment.':'Les deux photos ne disent pas tout à fait la même chose : une part vient de la pose du moment.'):'');
      T.privilegier=['Unilatéral en priorité : développé haltère un bras, rowing un bras, tirage poulie un bras, commencer par le côté '+bas+' et aligner l’autre sur ses répétitions','Porter lourd d’un seul côté (suitcase carry) en gardant les épaules de niveau','Planche latérale des deux côtés, 3 × 30 à 45 s','Trapèze inférieur et dentelé : Y-raise sur banc incliné, pompes scapulaires'];
      T.amenager=[{quoi:'Développé et rowing à la barre',reglage:'vérifier en vidéo de face que la barre reste horizontale ; si elle penche, passer une partie du volume aux haltères'},{quoi:'Shrugs',reglage:'aux haltères plutôt qu’à la barre, en contrôlant que les deux épaules montent à la même hauteur'}];
    }
    T.verifier='Marge ±'+_anatN(m.marge||ANAT_TOL.epaules)+'°, placement des acromions compris. Si la personne tient son téléphone, l’épaule de ce bras monte : relire la photo de dos, prise bras relâchés.';
    return T;
  }
  case 'buste':{
    const tr=m.tr, V=m.V, s=m.s;
    const ns=s!=null?_anatNiveau(s,ANAT_SEUILS.tronc):0;
    const sq=L('squat');
    T.court=(m.ec!=null&&m.nTr
        ?'Tronc '+(m.ec>0?'long':'court')+' ('+_anatSN(m.ec,0)+' % sur la moyenne) : '+(m.ec>0?'squat plus droit, soulevé plus exigeant pour le dos.':'buste qui penche plus au squat, soulevé favorable.')
        :'Tronc de longueur moyenne'+(tr&&tr.cm!=null?' ('+_anatN(tr.cm,1)+' cm)':'')+'.')
      +(V?' V (deltoïdes / taille) : '+_anatN(V,2)+'.':'')
      +(ns?' Buste décalé vers la '+(s>0?'gauche':'droite')+'.':'');
    const rTr=m.ref||anatRef(m.femme).tronc;
    T.lecture='Le tronc se mesure du milieu des épaules au milieu des hanches, centre à centre : '+(tr&&tr.cm!=null?_anatN(tr.cm,1)+' cm':'-')+' pour '+(tr&&tr.cm!=null?_anatN(rTr*tr.cm/tr.fr,1)+' cm':_anatN(rTr*100,1)+' % de la taille')+' en moyenne à même taille ('+ANAT_REF.SOURCE+', '+(m.femme?'femmes':'hommes')+'). '
      +'Un tronc long est un bras de levier long au squat et au soulevé : la barre est plus loin des hanches, les érecteurs du rachis travaillent plus. '
      +(sq?'Au squat, le modèle donne '+sq.val+'° d’inclinaison du buste à la parallèle, pour '+sq.ref+'° avec des proportions moyennes. ':'')
      +(V?'Le rapport deltoïdes / taille de '+_anatN(V,2)+' mesure la silhouette, pas l’os : il monte quand la carrure prend ou que la taille descend (c’est le chiffre à suivre de bilan en bilan). ':'')
      +(m.statV?'Repère de population : '+m.statV.txt+' ('+ANAT_V_REF.AVERT+'). ':'')
      +(m.varV!=null?'Depuis le premier bilan : '+_anatSN(m.varV,2)+' sur '+m.serieV.length+' bilans'+(Math.abs(m.varV)<=ANAT_V_REF.BRUIT?', dans le bruit de placement des points.':'.')+' ':'')
      +(s!=null?(ns?'Le milieu des épaules est décalé de '+_anatN(s,1)+' % du tronc par rapport au milieu du bassin : le buste se porte d’un côté (posture du moment ou habitude).':'Le buste est à l’aplomb du bassin (écart '+_anatN(s,1)+' %).'):'');
    T.privilegier=['Deltoïde latéral : élévations latérales aux haltères, à la poulie basse derrière le corps, à la machine','Largeur de dos : tractions et tirage vertical prise large, pull-over à la poulie','Taille : gainage anti-rotation (Pallof press), vacuum ; la taille visuelle se joue surtout sur la masse grasse'];
    if((m.nTr||0)>0) T.privilegier.push('Tronc long : renforcer les érecteurs et le gainage (soulevé roumain, good morning léger, planches), c’est le maillon qui cède le premier sous charge');
    if(ns) T.privilegier.push('Pour l’axe : carry unilatéral et planche latérale, côté opposé au décalage en premier');
    T.amenager=[{quoi:'Obliques lestés en rotation',reglage:'pas nécessaires pour la silhouette : garder le gainage, sans surcharger les rotations lestées si la taille est une priorité'}];
    if((m.nTr||0)>0) T.amenager.push({quoi:'Soulevé de terre conventionnel',reglage:'le sumo ou la barre hexagonale rapprochent la barre des hanches et raccourcissent le levier du dos'});
    T.verifier='Échelle ±'+((res&&res.echelle&&res.echelle.pct)||ANAT_TOL.echelle)+' %. Le V se relit sur la même pose au bilan suivant, bras légèrement écartés du corps.';
    return T;
  }
  case 'bras':{
    const r=m.r, hu=m.hu, ab=m.ab;
    const c=v=>v&&v.cm!=null?_anatN(v.cm,1)+' cm':'-';
    const R=anatRef(m.femme);
    const ecH=hu?(hu.fr/(m.refBras||R.bras)-1)*100:null, ecA=ab?(ab.fr/(m.refAvantbras||R.avantbras)-1)*100:null;
    const dv=L('developpe');
    if(!an) T.court='Humérus / avant-bras = '+_anatN(r,2)+' (moyenne '+_anatN(m.rRef,2)+') : leviers de bras équilibrés.';
    else if(n>0) T.court='Humérus long par rapport à l’avant-bras ('+_anatN(r,2)+' pour '+_anatN(m.rRef,2)+') : trajet plus long aux développés, les triceps finissent le travail.';
    else T.court='Avant-bras long par rapport à l’humérus ('+_anatN(r,2)+' pour '+_anatN(m.rRef,2)+') : levier favorable en tirage, les curls paraissent plus durs.';
    T.lecture='Humérus '+c(hu)+(ecH!=null?' ('+_anatSN(ecH,0)+' % sur la moyenne)':'')+', avant-bras '+c(ab)+(ecA!=null?' ('+_anatSN(ecA,0)+' %)':'')+'. '
      +'L’humérus est le bras de levier de l’épaule et du pectoral : plus il est long, plus la barre descend loin au développé et plus le couple demandé à l’épaule est grand pour une même charge. L’avant-bras est celui du biceps au curl et de la prise au tirage. '
      +(dv?dv.txt+' ':'')
      +(m.asy!=null&&Math.abs(m.asy)>4?'Les deux bras diffèrent de '+_anatN(m.asy,1)+' % : au-delà de la marge de placement, à vérifier au mètre avant d’en tirer quoi que ce soit.':'');
    if(n>0){
      T.privilegier=['Triceps en position étirée : extension au-dessus de la tête (poulie, haltère), barre au front sur banc incliné','Développé couché prise moyenne à large et omoplates serrées, pour raccourcir le trajet','Biceps en position étirée : curl incliné, curl à la poulie dos à la poulie'];
      T.amenager=[{quoi:'Développé couché',reglage:'arrêter à 1 à 2 cm de la poitrine si l’épaule proteste ; l’arche et la rétraction des omoplates retirent plusieurs centimètres de trajet'},{quoi:'Dips',reglage:'amplitude arrêtée quand l’épaule passe sous le coude'}];
    }else if(n<0){
      T.privilegier=['Tirages (rowing, tractions) : le levier est favorable, c’est un point fort à exploiter','Curl marteau et curl pupitre pour charger le brachial et le brachio-radial','Avant-bras et prise : curl poignet, farmer walk'];
      T.amenager=[{quoi:'Curls lourds à la barre droite',reglage:'barre EZ ou haltères si les poignets tirent'},{quoi:'Développé couché',reglage:'prise moyenne, poignets empilés au-dessus des coudes'}];
    }else{
      T.privilegier=['Programmer les bras sur les deux positions : étirée (curl incliné, extension au-dessus de la tête) et raccourcie (curl pupitre, pushdown)'];
    }
    T.verifier='Points au centre de l’épaule, du coude et du poignet, bras tendu. '+(m.telAth?'Le bras '+(m.telAth==='g'?'gauche':'droit')+' tient le téléphone : il est écarté du calcul. ':'')+'Le mètre prime : avant-bras au ruban (coude plié à 90°, pointe du coude → os du poignet) pour confirmer.';
    return T;
  }
  case 'bassin':{
    const a=m.a, haut=a>0?'droite':'gauche';
    if(!an){
      T.court='Bassin de niveau ('+_anatN(a)+'°, sous la marge de ±'+_anatN(m.marge||ANAT_TOL.bassin)+'°) : appui réparti sur les deux jambes.';
      T.lecture='La ligne des crêtes iliaques est horizontale à la précision de la photo.';
      T.privilegier=['Garder de l’unilatéral dans chaque bloc (fente, split squat, soulevé roumain une jambe) : c’est ce qui entretient la symétrie'];
    }else{
      T.court='Hanche '+haut+' plus haute de '+_anatN(a)+'° : appui probablement plus chargé d’un côté sur la photo.';
      T.lecture='Une hanche plus haute sur une photo debout vient d’abord de l’appui : le poids porté sur une jambe, un genou un peu fléchi de l’autre côté. La photo ne permet pas de dire s’il y a autre chose ; refaire la photo pieds à largeur de hanches, poids réparti, est le premier geste.'
        +(m.ecartVues!=null?(m.ecartVues<2?' Face et dos disent la même chose.':' Face et dos ne disent pas la même chose ('+_anatN(m.ecartVues)+'° d’écart) : c’est probablement la pose.'):'');
      T.privilegier=['Unilatéral des membres inférieurs : split squat bulgare, fente arrière, soulevé roumain à une jambe (commencer par le côté faible)','Moyen fessier : abduction de hanche (machine ou poulie), marche latérale avec élastique','Carry unilatéral et planche latérale contre l’inclinaison du tronc'];
      T.amenager=[{quoi:'Squat et soulevé de terre',reglage:'pieds symétriques (repères au sol), contrôler en vidéo de dos que le bassin ne glisse pas d’un côté en remontant'},{quoi:'Presse à cuisses',reglage:'pieds à la même hauteur sur la plateforme, amplitude arrêtée avant que le bassin ne décolle'}];
    }
    T.verifier='Marge ±'+_anatN(m.marge||ANAT_TOL.bassin)+'°, placement des crêtes compris. Les crêtes iliaques sont estimées : les palper, ou les replacer sur la photo. Si l’écart revient au même endroit d’un bilan à l’autre sur une photo bien prise, en parler avec l’athlète, et, s’il a une gêne, l’orienter vers un professionnel de santé.';
    return T;
  }
  case 'jambes':{
    const r=m.r, cu=m.cu, ja=m.ja;
    const c=v=>v&&v.cm!=null?_anatN(v.cm,1)+' cm':'-';
    const sq=L('squat');
    if(!an) T.court='Cuisse / jambe = '+_anatN(r,2)+' (moyenne '+_anatN(m.rRef,2)+') : leviers de squat équilibrés'+(sq?', buste à ~'+sq.val+'° à la parallèle.':'.');
    else if(n>0) T.court='Fémur long par rapport au tibia ('+_anatN(r,2)+' pour '+_anatN(m.rRef,2)+') : au squat, le buste penche davantage'+(sq?' (~'+sq.val+'° contre '+sq.ref+'°)':'')+'.';
    else T.court='Tibia long par rapport au fémur ('+_anatN(r,2)+' pour '+_anatN(m.rRef,2)+') : squat naturellement droit'+(sq?' (~'+sq.val+'° contre '+sq.ref+'°)':'')+', genoux qui avancent loin.';
    T.lecture='Cuisse '+c(cu)+', jambe '+c(ja)+(m.hh&&m.hh.cm!=null?', hauteur de hanche '+c(m.hh):'')+'. '
      +'Au squat, la barre doit rester au-dessus du milieu du pied : plus le fémur est long par rapport au tibia et au tronc, plus la hanche recule et plus le buste s’incline pour compenser (fessiers et érecteurs prennent une plus grande part du mouvement). '
      +(sq?'Modèle : cuisse parallèle, tibia incliné de 30°, barre au-dessus du milieu du pied. Buste estimé à '+sq.val+'° de la verticale, '+sq.ref+'° pour des proportions moyennes ; avec une cale de 2,5 cm sous les talons (tibia à ~37°), '+sq.cale+'°. ':'')
      +(m.tj?'Tronc / hauteur de hanche : '+_anatN(m.tj,2)+' (moyenne '+_anatN(m.tjRef,2)+'). ':'')
      +(m.asy!=null&&Math.abs(m.asy)>3?'Les deux jambes diffèrent de '+_anatN(m.asy,1)+' % sur la photo : c’est au-delà de la marge, mais une photo ne mesure pas une longueur de jambe au millimètre (à regarder avec la hauteur du bassin, sans conclure).':'');
    if(n>0){
      T.privilegier=['Squat talons surélevés (cale de 2 à 3 cm) ou hack squat pour recentrer le travail sur les quadriceps','Presse à cuisses et fente longue : les quadriceps y travaillent sans contrainte de buste','Soulevé roumain et hip thrust : le levier long y devient un avantage'];
      T.amenager=[{quoi:'Squat barre haute pieds serrés',reglage:'élargir l’appui et ouvrir les pointes (20 à 30°), l’ouverture raccourcit le fémur « vu de face », ou ajouter une cale sous les talons'},{quoi:'Soulevé de terre conventionnel',reglage:'essayer le sumo ou la barre hexagonale si le dos s’arrondit au départ'}];
    }else if(n<0){
      T.privilegier=['Squat barre haute et front squat : le levier est favorable','Leg curl et soulevé roumain pour équilibrer : ischios et fessiers travaillent moins au squat','Mobilité de cheville (genou au mur) : le genou a besoin d’avancer'];
      T.amenager=[{quoi:'Squat profond',reglage:'chaussures à talon ou cale si la cheville bloque avant la profondeur voulue'}];
    }else{
      T.privilegier=['Squat, presse et fente dans leur réglage standard ; équilibre quadriceps / ischios à surveiller dans le carnet'];
    }
    T.verifier='Filmer un squat de profil dans Motion Lab : l’inclinaison réelle du buste confirme ou corrige le modèle. Points au centre de la hanche, du genou et de la cheville, jambes tendues.';
    return T;
  }
  case 'genoux':{
    const p=m.pire;
    if(!an){
      T.court='Genoux dans l’axe hanche-cheville (écart sous ±'+_anatN(m.marge||ANAT_TOL.genoux)+'°) : rien à compenser à l’arrêt.';
      T.lecture='Debout, chaque genou tombe sur la ligne qui relie la hanche à la cheville. Gauche : '+_anatSigneTexte(m.g,true)+', droit : '+_anatSigneTexte(m.d,true)+'.';
      T.privilegier=['Garder de l’unilatéral (fente, split squat) : le contrôle du genou s’entretient en l’entraînant','Équilibre quadriceps / ischios / fessiers'];
    }else if(p.v>0){
      T.court='Genou '+p.c+' qui rentre vers l’intérieur ('+_anatN(p.v)+'°) : contrôle de hanche à renforcer avant de charger le squat.';
      T.lecture='Debout, le genou se place en dedans de la ligne hanche-cheville (gauche '+_anatSigneTexte(m.g,true)+', droit '+_anatSigneTexte(m.d,true)+'). Sur une photo statique c’est une tendance, pas un défaut : la vraie question est ce qu’il fait en squat, en fente et en réception. Causes fréquentes : moyen fessier et rotateurs externes de hanche peu sollicités, pied qui s’affaisse, ou cheville raide qui pousse le genou vers l’intérieur pour trouver de l’amplitude.';
      T.privilegier=['Moyen et grand fessier : abduction de hanche (machine, poulie, élastique), hip thrust, pont fessier une jambe','Fente et split squat lents (3 s à la descente), genou dans l’axe du deuxième orteil','Squat gobelet avec élastique au-dessus des genoux, consigne « écarte le sol »','Pied en trépied (talon, base du gros orteil, base du petit orteil) et mobilité de cheville genou au mur'];
      T.amenager=[{quoi:'Squat lourd',reglage:'pieds largeur de hanches ou un peu plus, pointes ouvertes de 15 à 30°, et charge qui ne monte pas tant que le genou rentre en fin de série'},{quoi:'Presse à cuisses',reglage:'pieds un peu plus hauts et plus écartés sur la plateforme, genoux alignés sur les pointes'},{quoi:'Sauts et réceptions',reglage:'volume progressif, réception contrôlée genoux au-dessus des pieds'}];
    }else{
      T.court='Genou '+p.c+' qui s’écarte vers l’extérieur ('+_anatN(p.v)+'°) : jambes en parenthèses à l’arrêt.';
      T.lecture='Debout, le genou passe en dehors de la ligne hanche-cheville (gauche '+_anatSigneTexte(m.g,true)+', droit '+_anatSigneTexte(m.d,true)+'). Forme fréquente, souvent de construction, que l’entraînement ne redresse pas ; ce qui compte, c’est de placer les appuis pour que le genou suive le pied sous charge. Des cuisses très développées accentuent l’effet à la photo.';
      T.privilegier=['Adducteurs : machine à adducteurs, Copenhagen plank, squat sumo contrôlé','Vaste interne : extension de jambes jusqu’au verrouillage, squat talons surélevés','Hip thrust pieds parallèles pour des fessiers travaillés en rotation neutre'];
      T.amenager=[{quoi:'Squat',reglage:'appui un peu plus serré, pointes ouvertes de 10 à 20°, genoux dans l’axe des pieds sans chercher à les pousser dehors'},{quoi:'Fente',reglage:'pas un peu plus écarté latéralement, pour la stabilité'}];
    }
    T.verifier='Filmer une série de squat de face dans Motion Lab : si le genou bouge sous charge, c’est là qu’on travaille ; s’il reste aligné, la photo montrait une position de repos. Marge ±'+_anatN(m.marge||ANAT_TOL.genoux)+'°, placement compris.';
    return T;
  }
  case 'pieds':{
    if(!an){
      T.court='Appuis symétriques : les deux pieds s’ouvrent de la même façon ('+_anatN(m.asy,0)+'° d’écart).';
      T.lecture=(m.sol?'Photo prise vers le sol : gauche '+_anatSN(m.g,0)+'°, droit '+_anatSN(m.d,0)+'° d’ouverture.'
        :'Pied gauche '+m.motG+', pied droit '+m.motD+' (estimation). La perspective d’une photo de face exagère l’ouverture : on lit la différence entre les deux, pas les degrés eux-mêmes.');
      T.privilegier=['Travail du pied : short foot, montées sur pointes lentes, et du pied nu à l’échauffement'];
    }else{
      const ouvert=m.asy>0?'gauche':'droit';
      T.court='Pied '+ouvert+' plus ouvert que l’autre ('+_anatN(m.asy,0)+'° d’écart) : l’appui n’est pas symétrique.';
      T.lecture=(m.sol?'Gauche '+_anatSN(m.g,0)+'°, droit '+_anatSN(m.d,0)+'° d’ouverture, photo prise vers le sol.':'Pied gauche '+m.motG+', pied droit '+m.motD+' (estimation sur l’angle apparent) : on lit la différence.')+' Un pied nettement plus ouvert traduit souvent une rotation de hanche de ce côté (rotation interne limitée, rotateurs externes raides), ou simplement la façon dont la photo a été prise.';
      T.privilegier=['Mobilité de hanche en rotation interne (90/90, rotation assise) du côté '+ouvert,'Travail du pied : short foot, montées sur pointes lentes','Unilatéral jambes (split squat, step-up) en plaçant les deux pieds de façon identique'];
      T.amenager=[{quoi:'Squat et soulevé de terre',reglage:'marquer au sol la position des pieds pour qu’elle soit la même à gauche et à droite ; ne pas forcer une ouverture que la hanche refuse : on la travaille à côté'}];
    }
    T.verifier=ANAT_PIEDS.CONSIGNE+' La voûte plantaire ne se lit pas sur une photo de face : regarder la vignette, et le talon sur la photo de dos. Marge ±'+ANAT_TOL.pieds+'°.';
    return T;
  }
  case 'dos':{
    const p=m.pire||{};
    const parts=[];
    if(m.om!=null) parts.push(Math.abs(p.nOm)?'omoplate '+(m.om>0?'gauche':'droite')+' plus basse ('+_anatN(m.om)+'°'+(m.omCm!=null?', '+_anatN(m.omCm,1)+' cm':'')+')':'omoplates à la même hauteur');
    if(m.rach!=null) parts.push(Math.abs(p.nRa)?'axe du dos incliné de '+_anatN(m.rach)+'° vers la '+(m.rach>0?'gauche':'droite'):'axe C7-sacrum vertical');
    if(m.asy!=null&&Math.abs(p.nTr)) parts.push('espace bras-tronc plus grand à '+(m.asy>0?'gauche':'droite'));
    if(m.oiDiff!=null&&Math.abs(p.nOi||0)) parts.push('omoplate '+(m.oiDiff>0?'gauche':'droite')+' plus écartée de la colonne ('+_anatN(Math.abs(m.oiDiff),1)+' cm)');
    T.court=(parts[0]?parts[0].charAt(0).toUpperCase()+parts[0].slice(1):'Dos lu')+(parts.length>1?' ; '+parts.slice(1).join(' ; '):'')+'.'
      +(an?' Position du moment, à confirmer au bilan suivant.':'');
    T.lecture='Vu de dos, on regarde trois choses : la hauteur des deux pointes d’omoplate (repère de la position de la ceinture scapulaire), la ligne de la base du cou (C7) aux fossettes du sacrum (l’axe du dos) et les deux « triangles » entre les bras et la taille. Un écart sur une photo debout traduit une posture (du moment ou habituelle), jamais une structure : la photo dit où regarder, pas pourquoi.'
      +(Math.abs(p.nOm)?' Une omoplate plus basse va souvent avec un trapèze inférieur et un dentelé moins actifs de ce côté, ou une épaule plus basse sur la photo de face.':'');
    T.lecture+=' Le bord interne des omoplates se mesure à sa distance à la ligne C7 → sacrum : une omoplate plus écartée de la colonne que l’autre, sur une photo debout, est une position du moment (une épaule qui s’enroule, un bras un peu tendu vers l’avant), à relire au bilan suivant.';
    T.privilegier=['Rétraction et abaissement des omoplates : face pull, Y-raise sur banc incliné, rowing un bras en finissant omoplate serrée et basse',
      'Unilatéral dos : rowing un bras, tirage poulie un bras (commencer par le côté faible)',
      'Contrôle des omoplates : pompes scapulaires, shrug en rétraction',
      'Carry unilatéral (valise), planche latérale, bird dog, Pallof press'];
    T.amenager=[{quoi:'Soulevé de terre et squat',reglage:'contrôler en vidéo de dos que la barre reste horizontale et que le bassin ne glisse pas'},{quoi:'Tractions',reglage:'amplitude complète des deux côtés, sans tirer « de travers » en fin de série'}];
    T.verifier=(f.estime?'Les pointes d’omoplate, C7 et le sacrum sont ESTIMÉS : les replacer sur la photo avant de retenir les chiffres. ':'')+'Si un écart revient d’un bilan à l’autre sur une photo bien prise, en parler avec l’athlète ; en cas de gêne, l’orienter vers un professionnel de santé.';
    return T;
  }
  }
  return T;
}
/** Le mot court de la colonne « Résultats ». */
function anatVerdict(f){
  if(f.etat==='illisible') return 'Non lisible';
  const n=f.niveau;
  if(n==null) return '-';
  if(n===0) return {clavicules:'Carrure moyenne',epaules:'Alignées',buste:'Tronc moyen',bras:'Équilibrés',
    bassin:'Aligné',jambes:'Équilibrées',genoux:'Dans l’axe',pieds:'Symétriques',dos:'Symétrique',posture:'Alignée',tete:'Dans l’axe',coudes:'Port moyen',arriere_pied:'Dans l’axe'}[f.cle]||'Dans la marge';
  const i=n>0?1:0;
  const intens=['','léger','net','marqué'][Math.abs(n)];
  const court={clavicules:['Étroite','Large'],epaules:['Droite basse','Gauche basse'],bassin:['Droite basse','Gauche basse'],
    buste:['Tronc court','Tronc long'],bras:['Avant-bras long','Humérus long'],jambes:['Tibia long','Fémur long'],
    genoux:['S’écartent','Rentrent'],pieds:['Droit + ouvert','Gauche + ouvert'],dos:['Côté droit','Côté gauche'],
    posture:['En arrière','En avant'],tete:['Tête en arrière','Tête en avant'],coudes:['Coudes fermés','Coudes ouverts'],arriere_pied:['Talon en dehors','Talon en dedans']}[f.cle];
  return (court?court[i]:f.bornes[i])+' · '+intens;
}
