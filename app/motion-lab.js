// @ts-check
// ══ MOTION LAB — LOT 1 : LA DÉCOUPE ══════════════════════════════════════════
//
// Le coach isole le mouvement utile d'une vidéo déposée — sans la mise en
// place ni la marche vers la barre — en une ou plusieurs répétitions.
//
// CE FICHIER EST CHARGÉ À LA DEMANDE (décision D3). index.html le demande à la
// première ouverture du laboratoire (chargerMotionLab) : un athlète qui ne
// l'ouvre jamais ne le télécharge pas. Il n'est pas dans les ASSETS du service
// worker, et il est écarté du report d'un cache à l'autre.
//
// ── CONVENTIONS DU MODULE (décision D9 : pas de CLAUDE.md, publié il serait
//    lu par tous — elles vivent ici) ──────────────────────────────────────────
//   • DES BORNES, JAMAIS UNE COPIE. La vidéo source n'est ni réencodée ni
//     modifiée : tout ce que le coach pose est une donnée légère.
//   • LE MODÈLE DE DONNÉES VIT DANS index.html — segmentsVideo,
//     enregistrerSegmentsVideo, SEG_* — parce que le lecteur de correction lit
//     les répétitions sans charger ce fichier. Ce module est l'ÉDITEUR.
//   • TYPES EN JSDoc (décision D4), écrits pour `tsc --checkJs --strict` :
//     aucun `any` hors des frontières avec index.html, déclarées ci-dessous.
//   • AUCUNE VALEUR INVENTÉE. Un fps non mesuré est dit « non mesuré », et le
//     pas d'une image retombe alors sur 30 i/s EN LE DISANT.
//   • PALETTE : le rouge pour ce qui se touche, le blanc pour la tête de
//     lecture. Le magenta reste aux records. Aucune animation décorative.
//   • PRÉFIXES : `ml…` pour ce qu'index.html ou un onclick appelle, `_ml…`
//     pour l'interne. Les fonctions marquées PURE sont testées dans tests.js.
//
// ── FRONTIÈRES AVEC index.html ────────────────────────────────────────────────
// Globales lues ici, toutes définies dans index.html : DB, CLOUD, currentUser,
// go, toast, toastSync, rcConfirm, rcSaisie, escapeHtml, safeUrl, safeUrlRaw, _tok,
// segmentsVideo, segMaxMs, SEG_MIN_MS, SEG_LIBELLE_MAX, enregistrerSegmentsVideo,
// _vcRouvrirApresMotionLab, videoSetRate, videoDetectFps, _videoMesurerFps,
// videoSetLoop, videoClearLoop, VID_RATES, VID_FPS_DEFAUT, _videoIndisponible.

/**
 * Une répétition : un intervalle sur la vidéo source, en millisecondes.
 * @typedef {{id:string, label:string, debutMs:number, finMs:number, barre?:any, pose?:any}} Segment
 */
/** @typedef {'debut'|'fin'} Borne */
/**
 * L'état de l'écran. `initiaux` est ce qui est enregistré : l'écart avec
 * `segments` dit s'il reste quelque chose à enregistrer.
 * @typedef {{
 *   email:string, videoId:string, url:string, nom:string, sousTitre:string,
 *   initiaux:Segment[], segments:Segment[], actifId:string|null,
 *   zoom:number, dureeMs:number, boucle:boolean, jeton:number,
 *   raf:number, seekEnAttente:number|null,
 *   mode:ModeMl, graine:Graine|null, disqueM:number, sens:string, fantome:boolean,
 *   analyseJeton:number, progres:string, suivis:Object<string,Suivi3>,
 *   angCote:string, angCalques:string[], epingles:Epingle[],
 *   theta:number, thetaAuto:{theta:number, n:number, ecartType:number}|null, thetaMain:boolean,
 *   etalon:{type:string, cm:number, ax:number|null, ay:number|null, bx:number|null, by:number|null},
 *   prise:{etat:'encours'|'fait', res:any, ms:number}|null,
 *   cachePose:{cle:string, d:any}|null,
 *   cacheBarre:{cle:string, d:{t:number[], x:number[], y:number[], vy:number[], conf:number[]}}|null,
 *   cacheRep:{cle:string, d:any}|null, repere:{nom:string, couleur:number}|null,
 *   rec:any, correction:{motion:any, blob:Blob|null, blobUrl:string, statut:'brouillon'|'envoi'|'envoye'|'erreur', erreur:string}|null,
 *   cartes:{id:string, aMs:number, dureeMs:number, texte:string}[], lecteur:any,
 *   annot:DocAnnot, annotInit:string, outil:OutilMl, couleur:string, epaisseur:number, sel:string|null,
 *   trace:TraceEnCours|null, curseur:number[]|null, annule:string[], refait:string[],
 *   original:boolean, comparaison:boolean, guide:{m:ModeleAnnot, i:number}|null, repereAnat:number,
 *   relier:boolean, phrase:string, tailleTexte:string, onglet:string, jetonVseq:number,
 *   enLecture:boolean, style:string, deplEtiq:DeplEtiq|null,
 *   trajAuto:boolean, trajStop:boolean, trajZone:{c:number[], r:number}|null,
 *   echUi:{m:string, g:string, c:string, mm:string}, echPose:{avant:string, a:number[]}|null,
 *   echAuto:boolean, echCherche:boolean, echEllipse:EllipseTrouvee|null
 * }} EtatMl
 */
/** @typedef {'lecture'|'graine'|'analyse'|'replacer'|'pose'|'etalon'|'action'|'repere'|'repsuivi'|'annotsuivi'|'trajsuivi'} ModeMl */
/**
 * Un point suivi nomme, pendant le parcours de la video. `sx`/`sy` est la
 * graine, en pixels de l'image ; elle est gardee pour pouvoir tout relancer
 * quand un point s'ajoute.
 * @typedef {{nom:string, couleur:number, r:number, sx:number, sy:number,
 *   points:PointBarre[]}} PisteRep
 */
/**
 * La graine : le disque posé par le coach, en pixels de la VIDÉO.
 * @typedef {{segId:string, tMs:number, x:number|null, y:number|null, r:number}} Graine
 */
/**
 * Le suivi image par image d'une répétition, gardé sur l'appareil pour relancer
 * depuis une image douteuse. Points en pixels de la vidéo.
 * @typedef {{points:PointBarre[], rayonPx:number, disqueM:number, vw:number, vh:number,
 *   fps:number, perf:{images:number, doublons:number, ms:number}}} Suivi3
 */

// ══ LES CONSTANTES ════════════════════════════════════════════════════════════
// Le zoom de la frise. Au-delà de 8×, une répétition de deux secondes occupe
// déjà plus d'un écran de large sur une vidéo de trente secondes.
const ML_ZOOMS=Object.freeze([1,2,4,8]);
// La longueur d'une répétition neuve : un arraché dure moins de deux secondes
// de la décollée à la réception. Le coach ajuste ensuite les deux bornes.
const ML_DUREE_DEFAUT_MS=2000;
// Les miniatures : assez pour reconnaître les phases, pas au point de faire
// quarante recherches dans la vidéo sur un téléphone.
const ML_VIGNETTES_MAX=40;
const ML_VIGNETTE_H=40;

// ══ LES FONCTIONS PURES ═══════════════════════════════════════════════════════

/**
 * PURE. « 0:02.35 » : minutes, secondes, centièmes. La précision d'une image
 * à 60 i/s est de 17 ms : le centième la montre, la seconde la cacherait.
 * @param {number} ms
 * @returns {string}
 */
function mlTempsTexte(ms){
  const t=Math.max(0,Math.round(Number(ms)||0));
  const cs=Math.floor(t/10)%100, s=Math.floor(t/1000)%60, m=Math.floor(t/60000);
  return m+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0');
}
/**
 * PURE. « 1,75 s ».
 * @param {number} ms
 * @returns {string}
 */
function mlDureeTexte(ms){
  return (Math.max(0,Math.round(Number(ms)||0))/1000).toFixed(2).replace('.',',')+' s';
}
/**
 * PURE. Le nom de la prochaine répétition : un de plus que le plus grand
 * « Rép n » déjà posé, et jamais moins que leur nombre plus un. Supprimer
 * « Rép 2 » puis en ajouter une ne redonne donc pas un nom déjà vu.
 * @param {Segment[]} segments
 * @returns {string}
 */
function mlProchainLibelle(segments){
  const l=Array.isArray(segments)?segments:[];
  let n=0;
  for(const s of l){
    const m=/^Rép (\d+)$/.exec(String((s&&s.label)||''));
    if(m) n=Math.max(n,Number(m[1]));
  }
  return 'Rép '+Math.max(n+1,l.length+1);
}
/**
 * PURE (au hasard de l'identifiant près). Une répétition neuve qui commence à
 * `tMs`, longue de deux secondes, ramenée dans la vidéo. Rend null quand la
 * vidéo est trop courte pour en contenir une.
 * @param {Segment[]} segments
 * @param {number} tMs
 * @param {number} dureeMs
 * @returns {Segment|null}
 */
function mlNouveauSegment(segments,tMs,dureeMs){
  const duree=Math.round(Number(dureeMs));
  if(!(duree>=SEG_MIN_MS)) return null;
  const debut=Math.max(0,Math.min(Math.round(Number(tMs)||0),duree-SEG_MIN_MS));
  const fin=Math.min(duree,debut+Math.min(ML_DUREE_DEFAUT_MS,segMaxMs()));
  return {id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
    label:mlProchainLibelle(segments),debutMs:debut,finMs:fin};
}
/**
 * PURE. Déplace une borne en gardant la répétition lisible : le début reste
 * avant la fin d'au moins SEG_MIN_MS, la fin reste dans la vidéo, et la
 * répétition ne dépasse jamais dix secondes. C'EST LA BORNE QU'ON DÉPLACE QUI
 * S'ARRÊTE, jamais l'autre qui la suit : le coach a posé l'autre exprès.
 * @param {Segment} seg
 * @param {Borne} quel
 * @param {number} tMs
 * @param {number} dureeMs
 * @returns {Segment}
 */
function mlBorner(seg,quel,tMs,dureeMs){
  const duree=Math.round(Number(dureeMs));
  const t=Math.round(Number(tMs));
  if(!seg||!isFinite(t)||!(duree>0)) return seg;
  const max=segMaxMs();
  if(quel==='debut'){
    const d=Math.max(0,seg.finMs-max,Math.min(t,seg.finMs-SEG_MIN_MS));
    return {id:seg.id,label:seg.label,debutMs:d,finMs:seg.finMs};
  }
  const f=Math.min(duree,seg.debutMs+max,Math.max(t,seg.debutMs+SEG_MIN_MS));
  return {id:seg.id,label:seg.label,debutMs:seg.debutMs,finMs:f};
}
/**
 * PURE. Une position sur la frise → un instant, borné à la vidéo.
 * @param {number} x
 * @param {number} largeur
 * @param {number} dureeMs
 * @returns {number}
 */
function mlXVersTemps(x,largeur,dureeMs){
  const l=Number(largeur), d=Number(dureeMs);
  if(!(l>0)||!(d>0)) return 0;
  return Math.round(Math.max(0,Math.min(1,Number(x)/l))*d);
}
/**
 * PURE. Un instant → une position sur la frise.
 * @param {number} tMs
 * @param {number} largeur
 * @param {number} dureeMs
 * @returns {number}
 */
function mlTempsVersX(tMs,largeur,dureeMs){
  const l=Number(largeur), d=Number(dureeMs);
  if(!(l>0)||!(d>0)) return 0;
  return Math.max(0,Math.min(1,Number(tMs)/d))*l;
}
/**
 * PURE. Le pas d'une image, en millisecondes, pour un fps donné — 30 i/s quand
 * il n'est pas mesuré, et l'écran le dit.
 * @param {number} fps
 * @returns {number}
 */
function mlPasImageMs(fps){
  const f=Number(fps);
  return 1000/((isFinite(f)&&f>0)?f:VID_FPS_DEFAUT);
}
/**
 * PURE. Deux listes de répétitions disent-elles la même chose, une fois
 * normalisées ? C'est ce qui décide s'il reste quelque chose à enregistrer.
 * @param {Segment[]} a
 * @param {Segment[]} b
 * @returns {boolean}
 */
function mlMemesSegments(a,b){
  return JSON.stringify(segmentsVideo({segments:a}))===JSON.stringify(segmentsVideo({segments:b}));
}
/**
 * PURE. L'espacement des repères de la règle : le plus petit pas qui laisse
 * environ 64 px entre deux libellés, pour qu'ils ne se chevauchent jamais.
 * @param {number} largeurPx
 * @param {number} dureeMs
 * @returns {number}
 */
function mlPasRegleMs(largeurPx,dureeMs){
  const PAS=[100,250,500,1000,2000,5000,10000,15000,30000,60000,120000];
  const cible=(Number(dureeMs)||0)*64/Math.max(1,Number(largeurPx)||1);
  return PAS.find(p=>p>=cible)||300000;
}
/**
 * PURE. L'index du zoom voisin, borné à la liste.
 * @param {number} zoom
 * @param {number} sens
 * @returns {number}
 */
function mlZoomVoisin(zoom,sens){
  const i=Math.max(0,ML_ZOOMS.indexOf(zoom));
  return ML_ZOOMS[Math.max(0,Math.min(ML_ZOOMS.length-1,i+(sens<0?-1:1)))];
}

// ══ LOT 3 — LA TRAJECTOIRE DE LA BARRE : LE CALCUL ════════════════════════════
//
// TOUT SE CALCULE SUR L'APPAREIL DU COACH (décision D1, option A). Pas de
// serveur, pas de bibliothèque : une corrélation normalisée sur le disque,
// image par image, dans une image réduite où le disque fait ~14 px de rayon.
//
// ⚠ AUCUNE VALEUR INVENTÉE. Chaque point porte un score de confiance ; un point
// douteux est dit douteux, un point perdu n'est ni interpolé au-delà de trois
// images ni compté dans les métriques, et une phase qu'on ne trouve pas n'est
// pas affichée.

/** @typedef {'graine'|'ok'|'doute'|'perdu'|'bord'} EtatPoint */
/** @typedef {{tMs:number, x:number, y:number, conf:number, etat:EtatPoint}} PointBarre */
/**
 * Le gabarit : les pixels du disque, centrés sur leur moyenne.
 * @typedef {{dx:Int16Array, dy:Int16Array, v:Float32Array, n:number, norme:number}} Gabarit
 */
/**
 * L'état d'un suivi en cours, en pixels de l'image de TRAVAIL.
 * @typedef {{gabs:Gabarit[], r:number, x:number, y:number, vx:number, vy:number, pertes:number, perdu:boolean}} Suivi
 */
/**
 * Les métriques d'une trajectoire. `devPlus` est l'écart maximal vers la
 * DROITE de l'image, `devMoins` vers la GAUCHE ; `sens` dit lequel est l'avant.
 * @typedef {{vMax:number, tVMax:number, hMax:number, depVert:number, devPlus:number, devMoins:number,
 *   vert?:number, vTanMax?:number}} Metriques
 */
/**
 * Une série ré-échantillonnée à pas constant, en mètres (Y vers le haut).
 * @typedef {{t:number[], px:number[], py:number[], X:number[], Y:number[], vy:number[], conf:number[]}} Serie
 */

// Le rayon du disque dans l'image de travail. Assez pour que la corrélation
// soit franche, assez peu pour qu'une image se traite en quelques millisecondes.
const ML_R_TRAVAIL=14;
// Diamètre d'un disque bumper standard.
const ML_DISQUE_M=0.45;
// Sous ML_CONF_DOUTE, le point est douteux ; sous ML_CONF_PERTE trois fois de
// suite, le suivi est perdu et s'arrête — continuer suivrait n'importe quoi.
const ML_CONF_DOUTE=0.5;
const ML_CONF_PERTE=0.3;
const ML_PERTES_MAX=3;
// Le gabarit s'adapte lentement quand le suivi est sûr : la lumière et le flou
// changent pendant le mouvement. Le gabarit d'origine reste toujours comparé,
// pour qu'une dérive ne puisse pas s'installer.
const ML_ADAPTATION=0.2;
const ML_CONF_ADAPTE=0.8;
// Les seuils des phases, en m/s et en mètres.
const ML_V_DEPART=0.15;
const ML_CHUTE_MIN=0.02;

/**
 * PURE. La luminance (Rec. 601) d'une image RGBA.
 * @param {Uint8ClampedArray|Uint8Array|number[]} rgba
 * @param {number} w
 * @param {number} h
 * @returns {Float32Array}
 */
function mlGris(rgba,w,h){
  const g=new Float32Array(w*h);
  for(let i=0,j=0;i<g.length;i++,j+=4) g[i]=0.299*rgba[j]+0.587*rgba[j+1]+0.114*rgba[j+2];
  return g;
}
/**
 * PURE. Le gabarit du disque de rayon `r` centré en (cx, cy). Seuls les pixels
 * DU CERCLE comptent : le fond derrière le disque change pendant le mouvement,
 * et un carré le ferait entrer dans la ressemblance. Rend null si le cercle ne
 * contient pas assez de pixels, ou s'ils sont tous identiques.
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @returns {Gabarit|null}
 */
function mlGabarit(gris,w,h,cx,cy,r){
  const ri=Math.ceil(r), x0=Math.round(cx), y0=Math.round(cy);
  /** @type {number[]} */ const dx=[], dy=[], val=[];
  for(let j=-ri;j<=ri;j++) for(let i=-ri;i<=ri;i++){
    if(i*i+j*j>r*r) continue;
    const x=x0+i, y=y0+j;
    if(x<0||y<0||x>=w||y>=h) continue;
    dx.push(i); dy.push(j); val.push(gris[y*w+x]);
  }
  if(val.length<12) return null;
  let m=0; for(const p of val) m+=p; m/=val.length;
  const v=new Float32Array(val.length);
  let q=0;
  for(let k=0;k<val.length;k++){ v[k]=val[k]-m; q+=v[k]*v[k]; }
  const norme=Math.sqrt(q);
  if(!(norme>1e-3)) return null;
  return {dx:Int16Array.from(dx),dy:Int16Array.from(dy),v,n:val.length,norme};
}
/**
 * PURE. La corrélation normalisée du gabarit centré en (cx, cy), entre -1 et 1.
 * Rend -1 dès qu'un pixel sort de l'image : un disque à moitié dehors ne se
 * compare pas à un disque entier.
 * @param {Gabarit} gab
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @param {number} cx
 * @param {number} cy
 * @returns {number}
 */
function mlScoreDisque(gab,gris,w,h,cx,cy){
  let s=0, s2=0, st=0;
  for(let k=0;k<gab.n;k++){
    const x=cx+gab.dx[k], y=cy+gab.dy[k];
    if(x<0||y<0||x>=w||y>=h) return -1;
    const p=gris[y*w+x];
    s+=p; s2+=p*p; st+=p*gab.v[k];
  }
  const varp=s2-s*s/gab.n;
  if(!(varp>1e-6)) return 0;
  return st/(Math.sqrt(varp)*gab.norme);
}
/**
 * PURE. Cherche le disque dans un carré de demi-côté `rayon` autour de
 * (px, py), avec le meilleur des gabarits, puis affine au sous-pixel par une
 * parabole sur les voisins du maximum.
 * @param {Gabarit[]} gabs
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @param {number} px
 * @param {number} py
 * @param {number} rayon
 * @returns {{x:number, y:number, conf:number}}
 */
function mlChercherDisque(gabs,gris,w,h,px,py,rayon){
  const S=Math.max(1,Math.round(rayon)), x0=Math.round(px), y0=Math.round(py), c=2*S+1;
  const scores=new Float32Array(c*c).fill(-2);
  let meilleur=-2, bi=S, bj=S;
  for(let j=0;j<c;j++) for(let i=0;i<c;i++){
    let s=-2;
    for(const g of gabs){ const v=mlScoreDisque(g,gris,w,h,x0+i-S,y0+j-S); if(v>s) s=v; }
    scores[j*c+i]=s;
    if(s>meilleur){ meilleur=s; bi=i; bj=j; }
  }
  /** @param {number} a @param {number} b @param {number} d */
  const parab=(a,b,d)=>{
    if(a<-1.5||d<-1.5) return 0;
    const den=a-2*b+d;
    return (den<0)?Math.max(-0.5,Math.min(0.5,(a-d)/(2*den))):0;
  };
  const sx=(bi>0&&bi<c-1)?parab(scores[bj*c+bi-1],meilleur,scores[bj*c+bi+1]):0;
  const sy=(bj>0&&bj<c-1)?parab(scores[(bj-1)*c+bi],meilleur,scores[(bj+1)*c+bi]):0;
  return {x:x0+bi-S+sx,y:y0+bj-S+sy,conf:Math.max(0,Math.min(1,meilleur))};
}
/**
 * PURE. Démarre un suivi sur l'image de la graine. Rend null si le disque posé
 * ne donne pas de gabarit — une zone uniforme, ou hors de l'image.
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} y
 * @param {number} r
 * @returns {Suivi|null}
 */
function mlSuiviDemarrer(gris,w,h,x,y,r){
  const g=mlGabarit(gris,w,h,x,y,r);
  if(!g) return null;
  const copie={dx:g.dx,dy:g.dy,v:new Float32Array(g.v),n:g.n,norme:g.norme};
  return {gabs:[g,copie],r,x,y,vx:0,vy:0,pertes:0,perdu:false};
}
/**
 * PURE (sur l'état du suivi). Un pas : prédit la position à vitesse constante,
 * cherche autour, et qualifie le point. Le rayon de recherche suit la vitesse :
 * un disque qui monte vite se déplace de plus d'un rayon entre deux images.
 * @param {Suivi} s
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @returns {{x:number, y:number, conf:number, etat:EtatPoint}}
 */
function mlSuiviPas(s,gris,w,h){
  if(s.perdu) return {x:s.x,y:s.y,conf:0,etat:'perdu'};
  const px=s.x+s.vx, py=s.y+s.vy;
  const vitesse=Math.hypot(s.vx,s.vy);
  const rayon=Math.min(3*s.r,Math.max(0.6*s.r,1.5*vitesse+0.4*s.r));
  const t=mlChercherDisque(s.gabs,gris,w,h,px,py,rayon);
  /** @type {EtatPoint} */
  let etat='ok';
  if(t.x<s.r||t.y<s.r||t.x>w-1-s.r||t.y>h-1-s.r) etat='bord';
  if(t.conf<ML_CONF_PERTE){
    s.pertes++;
    if(s.pertes>=ML_PERTES_MAX){ s.perdu=true; return {x:t.x,y:t.y,conf:t.conf,etat:'perdu'}; }
    // On ne suit pas un point qu'on ne voit pas : la position prédite reste la
    // meilleure hypothèse, et la vitesse s'amortit.
    s.x=px; s.y=py; s.vx*=0.5; s.vy*=0.5;
    return {x:t.x,y:t.y,conf:t.conf,etat:'doute'};
  }
  s.pertes=0;
  if(etat==='ok'&&t.conf<ML_CONF_DOUTE) etat='doute';
  s.vx=t.x-s.x; s.vy=t.y-s.y; s.x=t.x; s.y=t.y;
  if(t.conf>=ML_CONF_ADAPTE&&etat==='ok'){
    const a=s.gabs[1], neuf=mlGabarit(gris,w,h,t.x,t.y,s.r);
    if(neuf&&neuf.n===a.n){
      let q=0;
      for(let k=0;k<a.n;k++){ a.v[k]=(1-ML_ADAPTATION)*a.v[k]+ML_ADAPTATION*neuf.v[k]; q+=a.v[k]*a.v[k]; }
      a.norme=Math.sqrt(q)||a.norme;
    }
  }
  return {x:t.x,y:t.y,conf:t.conf,etat};
}

/**
 * PURE. Lissage de Savitzky-Golay (fenêtre 7, degré 2). Un point dont les six
 * voisins ne sont pas tous connus garde sa valeur brute.
 * @param {number[]} v
 * @returns {number[]}
 */
function mlLisser(v){
  const C=[-2,3,6,7,6,3,-2];
  return v.map((x,i)=>{
    if(i<3||i>v.length-4||!isFinite(x)) return x;
    let s=0;
    for(let k=-3;k<=3;k++){ const y=v[i+k]; if(!isFinite(y)) return x; s+=C[k+3]*y; }
    return s/21;
  });
}
/**
 * PURE. Dérivée de Savitzky-Golay de degré 2 sur 2m+1 points, repliée sur une
 * fenêtre plus courte près des bords ou d'un trou, puis sur une différence
 * centrée, NaN si même elle manque.
 * @param {number[]} v
 * @param {number} dt  secondes
 * @param {number} [m]  demi-fenêtre, 3 par défaut
 * @returns {number[]}
 */
function mlDeriver(v,dt,m){
  const M=Math.max(1,Math.round(Number(m)||3));
  return v.map((x,i)=>{
    for(let q=M;q>=1;q--){
      if(i<q||i>v.length-1-q) continue;
      let s=0, den=0, ok=true;
      for(let k=-q;k<=q;k++){ if(!isFinite(v[i+k])){ ok=false; break; } s+=k*v[i+k]; den+=k*k; }
      if(ok) return s/(den*dt);
    }
    return NaN;
  });
}
/**
 * PURE. La demi-fenêtre de dérivée pour un pas donné : environ 110 ms, entre 2
 * et 8 points de chaque côté. Mesuré sur des trajectoires de synthèse bruitées
 * à deux pixels : à 150 ms, un pic bref (mi-hauteur 0,3 s) était sous-estimé de
 * 9 % à 60 i/s et de 19 % à 30 i/s — là, le plancher de trois points portait la
 * fenêtre à 200 ms. À 110 ms ces erreurs tombent à 5 % et 12 %, contre un point
 * de surestimation de plus sur un mouvement lent. Un pic écrasé trompe plus
 * qu'un pic un peu trop haut : le coach y lit une barre plus lente qu'elle ne
 * l'était.
 * @param {number} pasMs
 * @returns {number}
 */
function mlDemiFenetre(pasMs){
  const p=Number(pasMs);
  if(!(p>0)) return 3;
  // 55 et non 50 ou 60 : aucune cadence courante, de 24 à 240 i/s, ne tombe
  // ainsi sur un demi-point, où l'arrondi basculerait selon le dernier chiffre
  // flottant.
  return Math.max(2,Math.min(8,Math.round(55/p)));
}
/**
 * PURE. Le sommet d'un pic échantillonné : une parabole de degré 2 ajustée sur
 * 2m+1 points autour du maximum, dont on renvoie la pointe. L'échantillonnage
 * tombe rarement pile dessus, et le maximum brut d'une série bruitée est tiré
 * vers le haut par le bruit ; l'ajustement corrige les deux. Jamais plus de
 * 10 % au-dessus du maximum mesuré : au-delà, c'est la parabole qui déraille,
 * pas la barre qui va vite.
 * @param {number[]} v
 * @param {number} i  l'indice du maximum
 * @param {number} [m]  demi-fenêtre, 2 par défaut
 * @returns {number}
 */
function mlSommetParabole(v,i,m){
  const q=Math.max(1,Math.round(Number(m)||2)), pic=v[i];
  if(!isFinite(pic)||pic<=0||i<q||i>v.length-1-q) return pic;
  let n=0, sx2=0, sx4=0, sy=0, sxy=0, sx2y=0;
  for(let k=-q;k<=q;k++){
    const y=v[i+k];
    if(!isFinite(y)) return pic;
    n++; sx2+=k*k; sx4+=k*k*k*k; sy+=y; sxy+=k*y; sx2y+=k*k*y;
  }
  // LA FENÊTRE EST SYMÉTRIQUE : les sommes impaires sont nulles, les équations
  // se séparent et la pente sort seule.
  const den=n*sx4-sx2*sx2;
  if(!den) return pic;
  const a=(n*sx2y-sx2*sy)/den;
  if(!(a<0)) return pic;
  const b=sxy/sx2, c=(sx4*sy-sx2*sx2y)/den, s=c-b*b/(4*a);
  return isFinite(s)?Math.max(0,Math.min(s,pic*1.1)):pic;
}
/**
 * PURE. Les points retenus, ré-échantillonnés à pas constant. Un trou de plus
 * de trois pas reste un trou : on n'invente pas le mouvement qu'on n'a pas vu.
 * @param {PointBarre[]} points
 * @returns {{t:number[], x:number[], y:number[], conf:number[], pas:number}|null}
 */
function mlReechantillonner(points){
  const p=(points||[]).filter(q=>q&&q.etat!=='perdu'&&q.conf>=ML_CONF_PERTE&&isFinite(q.tMs)&&isFinite(q.x)&&isFinite(q.y))
    .slice().sort((a,b)=>a.tMs-b.tMs);
  if(p.length<2) return null;
  const ecarts=[];
  for(let i=1;i<p.length;i++){ const d=p[i].tMs-p[i-1].tMs; if(d>0) ecarts.push(d); }
  if(!ecarts.length) return null;
  ecarts.sort((a,b)=>a-b);
  const pas=ecarts[Math.floor(ecarts.length/2)];
  const t=[], x=[], y=[], conf=[];
  let j=0;
  for(let tt=p[0].tMs;tt<=p[p.length-1].tMs+1e-6;tt+=pas){
    while(j<p.length-2&&p[j+1].tMs<tt) j++;
    const a=p[j], b=p[Math.min(j+1,p.length-1)];
    t.push(tt);
    if(Math.abs(tt-a.tMs)<1e-6){ x.push(a.x); y.push(a.y); conf.push(a.conf); continue; }
    if(b.tMs-a.tMs>3*pas+1e-6||b===a){ x.push(NaN); y.push(NaN); conf.push(0); continue; }
    const f=(tt-a.tMs)/(b.tMs-a.tMs);
    x.push(a.x+f*(b.x-a.x)); y.push(a.y+f*(b.y-a.y)); conf.push(Math.min(a.conf,b.conf));
  }
  return {t,x,y,conf,pas};
}
/**
 * PURE. Les métriques d'une trajectoire, en mètres et en secondes.
 * `mpp` : mètres par pixel de la vidéo. L'origine est le premier point retenu ;
 * Y monte, X va vers la droite de l'image.
 * @param {PointBarre[]} points
 * @param {number} mpp
 * @param {number} [theta]  l'aplomb du téléphone, en degrés
 * @returns {{serie:Serie, m:Metriques, ph:[string,number,number][], pas:number}|null}
 */
function mlMetriquesBarre(points,mpp,theta){
  const r0=mlReechantillonner(points);
  if(!r0||!(mpp>0)) return null;
  // ⚠ REDRESSÉ AVANT TOUT LE RESTE. Un téléphone penché de cinq degrés fait
  // lire une hauteur de 62 cm là où il y en a 62,2, mais surtout il verse une
  // partie de la montée dans l'écart horizontal — celui-là même qu'on regarde
  // pour juger si la barre reste près du corps.
  const th=Number(theta)||0;
  const rr=th?mlRedresser(r0.x,r0.y,th):{X:r0.x,Y:r0.y};
  const r={t:r0.t,x:rr.X,y:rr.Y,conf:r0.conf,pas:r0.pas};
  const x0=r.x.find(isFinite), y0=r.y.find(isFinite);
  if(x0===undefined||y0===undefined) return null;
  const X=r.x.map(v=>(v-x0)*mpp), Yb=r.y.map(v=>(y0-v)*mpp);
  const Y=mlLisser(Yb), Xl=mlLisser(X);
  const dt=r.pas/1000;
  const vy=mlDeriver(Yb,dt,mlDemiFenetre(r.pas));
  const n=r.t.length;
  let vMax=-Infinity, iV=-1, hMax=-Infinity, iH=-1, depVert=0, devPlus=0, devMoins=0;
  for(let i=0;i<n;i++){
    if(isFinite(vy[i])&&vy[i]>vMax){ vMax=vy[i]; iV=i; }
    if(isFinite(Y[i])&&Y[i]>hMax){ hMax=Y[i]; iH=i; }
    if(i&&isFinite(Y[i])&&isFinite(Y[i-1])) depVert+=Math.abs(Y[i]-Y[i-1]);
    if(isFinite(Xl[i])){ devPlus=Math.max(devPlus,Xl[i]); devMoins=Math.max(devMoins,-Xl[i]); }
  }
  /** @param {number} i @returns {number} */
  const confAutour=i=>{
    let s=0, k=0;
    for(let j=Math.max(0,i-2);j<=Math.min(n-1,i+2);j++){ s+=r.conf[j]; k++; }
    return Math.round(100*(k?s/k:0));
  };
  /** @type {[string,number,number][]} */
  const ph=[];
  let iD=-1;
  for(let i=0;i+2<n;i++) if(vy[i]>ML_V_DEPART&&vy[i+1]>ML_V_DEPART&&vy[i+2]>ML_V_DEPART){ iD=i; break; }
  if(iD>=0) ph.push(['depart',Math.round(r.t[iD]),confAutour(iD)]);
  if(iV>=0&&vMax>2*ML_V_DEPART) ph.push(['pic_vitesse',Math.round(r.t[iV]),confAutour(iV)]);
  // LE POINT HAUT n'a de sens qu'après un départ : sans montée, le maximum
  // d'une série immobile n'est que du bruit.
  let iHaut=-1;
  if(iD>=0){
    let h=-Infinity;
    for(let i=iD;i<n;i++) if(isFinite(Y[i])&&Y[i]>h){ h=Y[i]; iHaut=i; }
    if(iHaut>=0) ph.push(['point_haut',Math.round(r.t[iHaut]),confAutour(iHaut)]);
  }
  if(iHaut>=0){
    // LA RÉCEPTION : la barre retombe d'au moins deux centimètres, puis cesse
    // de descendre.
    let iBas=-1, bas=Infinity;
    for(let i=iHaut;i<n;i++) if(isFinite(Y[i])&&Y[i]<bas){ bas=Y[i]; iBas=i; }
    if(iBas>iHaut&&Y[iHaut]-bas>=ML_CHUTE_MIN){
      let iR=-1;
      for(let i=iHaut+1;i<n;i++){
        if(isFinite(vy[i-1])&&isFinite(vy[i])&&vy[i-1]<-0.05&&vy[i]>=-0.02){ iR=i; break; }
      }
      if(iR>=0) ph.push(['reception',Math.round(r.t[iR]),confAutour(iR)]);
      ph.push(['point_bas',Math.round(r.t[iBas]),confAutour(iBas)]);
    }
  }
  // LE SOMMET DE VITESSE est ajusté entre deux images : la pointe tombe
  // rarement sur l'une d'elles. Les phases, elles, gardent l'instant d'une
  // vraie image — c'est là que la vidéo ira se placer.
  const vPic=iV>=0?mlSommetParabole(vy,iV,2):0;
  const arrondi=(/** @type {number} */ v)=>Math.round(v*1000)/1000;
  // LOT 9 — LES TROIS VITESSES. La verticale reste celle d'avant, au
  // millième près : mlVitesses appelle mlDeriver avec les mêmes arguments.
  const VV=mlVitesses(X,Yb,dt,mlDemiFenetre(r.pas));
  const TEMPO=mlTempo({t:r.t,v:VV.verticalite>=ML_VERTICALITE?VV.vv:VV.vp});
  return {
    serie:{t:r.t,px:r.x,py:r.y,X:Xl,Y,vy,conf:r.conf},
    m:{vMax:iV>=0?arrondi(vPic):0,tVMax:iV>=0?Math.round(r.t[iV]):0,hMax:iH>=0?arrondi(hMax):0,
      depVert:arrondi(depVert),devPlus:arrondi(devPlus),devMoins:arrondi(devMoins),
      vert:Math.round(VV.verticalite*1000)/1000,
      vTanMax:arrondi(VV.vt.reduce((/** @type {number} */ q,/** @type {number} */ x)=>isFinite(x)&&x>q?x:q,0)),
      ...(TEMPO.complet?{tExc:TEMPO.excMs,tPau:TEMPO.pauseMs,tCon:TEMPO.conMs}:{})},
    ph,pas:r.pas};
}

/**
 * PURE. Octets → base64, par tranches : String.fromCharCode sur un tableau
 * entier dépasse la pile au-delà de quelques dizaines de milliers d'octets.
 * @param {Uint8Array} u8
 * @returns {string}
 */
function mlB64(u8){
  let s='';
  for(let i=0;i<u8.length;i+=0x8000) s+=String.fromCharCode.apply(null,Array.from(u8.subarray(i,i+0x8000)));
  return btoa(s);
}
/**
 * PURE. base64 → octets.
 * @param {string} b64
 * @returns {Uint8Array}
 */
function mlOctets(b64){
  const s=atob(String(b64||''));
  const u=new Uint8Array(s.length);
  for(let i=0;i<s.length;i++) u[i]=s.charCodeAt(i);
  return u;
}
// La valeur « inconnu » d'un Int16 stocké : un trou dans la trajectoire.
const ML_I16_TROU=-32768;
/**
 * PURE. La trajectoire, compactée pour le dossier de l'athlète (voir
 * segBarreValide dans index.html). Au plus SEG_BARRE_POINTS_MAX points, pris à
 * intervalles réguliers dans la série lissée ; x et y normés par la taille de
 * la vidéo, la vitesse en cm/s, la confiance sur 255.
 * @param {{debutMs:number, finMs:number}} seg
 * @param {{serie:Serie, m:Metriques, ph:[string,number,number][], pas:number}} res
 * @param {{disqueM:number, sens:string, vw:number, vh:number, rayonPx:number, fps:number, alertes:string[],
 *   mpp?:number, theta?:number, etalon?:{cm:number, px:number, type:string}|null}} p
 * @returns {Object}
 */
function mlCompacterBarre(seg,res,p){
  const S=res.serie, total=S.t.length;
  const n=Math.max(2,Math.min(SEG_BARRE_POINTS_MAX,total));
  const xy=new DataView(new ArrayBuffer(n*4)), vy=new DataView(new ArrayBuffer(n*2)), c=new Uint8Array(n);
  /** @param {number} v @param {number} echelle */
  const i16=(v,echelle)=>isFinite(v)?Math.max(-32767,Math.min(32767,Math.round(v*echelle))):ML_I16_TROU;
  // Les positions LISSÉES, remises en pixels : c'est ce qui se dessine.
  const x0=S.px.find(isFinite)||0, y0=S.py.find(isFinite)||0;
  const mpp=(Number(p.mpp)>0)?Number(p.mpp):p.disqueM/(2*p.rayonPx);
  const theta=Number(p.theta)||0;
  const pasMs=total>1?(S.t[total-1]-S.t[0])/(n-1):res.pas;
  // INTERPOLÉES AUX INSTANTS EXACTS, et non prises à l'indice arrondi : un
  // point pris à un demi-pas de l'instant qu'on lui attribue décale le tracé
  // d'autant — 4 px à la vitesse maximale d'un arraché filmé à 60 i/s, mesuré.
  // Un trou d'un côté ou de l'autre reste un trou.
  /** @param {number[]} serie @param {number} f */
  const lire=(serie,f)=>{
    const i=Math.floor(f), j=Math.min(total-1,i+1), u=f-i;
    const a=serie[i], b=serie[j];
    if(u<1e-9) return a;
    return (isFinite(a)&&isFinite(b))?a+u*(b-a):NaN;
  };
  for(let k=0;k<n;k++){
    const f=Math.max(0,Math.min(total-1,(S.t[0]+k*pasMs-S.t[0])/res.pas));
    const X=lire(S.X,f), Y=lire(S.Y,f);
    const px=isFinite(X)?x0+X/mpp:NaN, py=isFinite(Y)?y0-Y/mpp:NaN;
    // ⚠ ON REVIENT DANS LE REPÈRE DE L'IMAGE POUR STOCKER : ces points se
    // dessinent sur la vidéo telle qu'elle a été filmée, pas sur une vidéo
    // redressée. Les MESURES, elles, restent celles du monde.
    const brut=theta?mlRedresser([px],[py],-theta):{X:[px],Y:[py]};
    xy.setInt16(4*k,i16(brut.X[0]/p.vw,32767),true);
    xy.setInt16(4*k+2,i16(brut.Y[0]/p.vh,32767),true);
    vy.setInt16(2*k,i16(lire(S.vy,f),100),true);
    const i=Math.floor(f), j=Math.min(total-1,i+1);
    c[k]=Math.round(255*Math.max(0,Math.min(1,Math.min(S.conf[i]||0,S.conf[j]||0))));
  }
  return {v:1,debutMs:seg.debutMs,finMs:seg.finMs,disqueM:p.disqueM,sens:p.sens,vw:p.vw,vh:p.vh,
    theta:Math.round(theta*10)/10,...(p.etalon?{etalon:p.etalon}:{}),
    rayonPx:Math.round(p.rayonPx*10)/10,fps:Math.round(p.fps*100)/100,n,
    t0Ms:Math.round(S.t[0]),pasMs:Math.round(pasMs*1000)/1000,
    xy:mlB64(new Uint8Array(xy.buffer)),c:mlB64(c),vy:mlB64(new Uint8Array(vy.buffer)),
    m:res.m,ph:res.ph.map(q=>[q[0],q[1],q[2]]),av:p.alertes.slice()};
}
/**
 * PURE. La trajectoire compactée, relue : temps, x et y normés (NaN pour un
 * trou), vitesse en m/s, confiance entre 0 et 1.
 * @param {any} b  une trajectoire passée par segBarreValide
 * @returns {{t:number[], x:number[], y:number[], vy:number[], conf:number[]}}
 */
function mlDecompacterBarre(b){
  const xy=new DataView(mlOctets(b.xy).buffer), vy=new DataView(mlOctets(b.vy).buffer), c=mlOctets(b.c);
  const t=[], x=[], y=[], v=[], conf=[];
  for(let k=0;k<b.n;k++){
    const xi=xy.getInt16(4*k,true), yi=xy.getInt16(4*k+2,true), vi=vy.getInt16(2*k,true);
    t.push(b.t0Ms+k*b.pasMs);
    x.push(xi===ML_I16_TROU?NaN:xi/32767);
    y.push(yi===ML_I16_TROU?NaN:yi/32767);
    v.push(vi===ML_I16_TROU?NaN:vi/100);
    conf.push(c[k]/255);
  }
  return {t,x,y,vy:v,conf};
}

// ══ LES POINTS SUIVIS NOMMÉS ════════════════════════════════════════════════
//
// Le coach touche un endroit de l'image, lui donne un nom, et son déplacement
// se dessine sous ce nom. Le suivi est CELUI DU DISQUE — mlSuiviDemarrer et
// mlSuiviPas ne savent rien de ce qu'ils suivent — mais SANS ÉCHELLE : un
// repère ne rend aucune mesure en mètres, seulement un chemin. Ni disque à
// mesurer, ni étalon à poser, ni aplomb à corriger : rien de tout cela n'entre
// dans un tracé.
//
// ⚠ TOUS LES POINTS SONT SUIVIS DANS LE MÊME PARCOURS DE LA VIDÉO. Décoder une
//   image coûte cent fois la corrélation qui suit un point dessus : six
//   parcours pour six points seraient six fois le prix, pour le même résultat.
//   C'est aussi ce qui leur donne la base de temps commune dont le format de
//   stockage dépend (voir segReperesValide dans index.html).

/**
 * PURE. Les points suivis, compactés pour le dossier de l'athlète. Toutes les
 * pistes ont la MÊME longueur — un point perdu continue d'être échantillonné,
 * à confiance nulle — et partagent donc `t0Ms` et `pasMs`.
 * @param {{debutMs:number, finMs:number}} seg
 * @param {PisteRep[]} pistes
 * @param {{vw:number, vh:number}} p
 * @returns {Object|null}
 */
function mlCompacterReperes(seg,pistes,p){
  const total=pistes.length?pistes[0].points.length:0;
  if(!pistes.length||total<2) return null;
  const T=pistes[0].points.map(q=>q.tMs);
  const n=Math.max(2,Math.min(SEG_REP_PTS_MAX,total));
  const t0=T[0], pasMs=(T[total-1]-t0)/(n-1);
  if(!(pasMs>0)) return null;
  const vues=pistes.map(()=>({xy:new DataView(new ArrayBuffer(n*4)),cf:new Uint8Array(n)}));
  // UN CURSEUR QUI NE RECULE JAMAIS : les instants demandés croissent comme
  // ceux de la source, et une recherche depuis le début à chaque échantillon
  // coûterait le carré du nombre d'images.
  let i=0;
  for(let k=0;k<n;k++){
    const t=t0+k*pasMs;
    while(i<total-2&&T[i+1]<=t) i++;
    const j=Math.min(total-1,i+1), dt=T[j]-T[i];
    const u=dt>0?Math.max(0,Math.min(1,(t-T[i])/dt)):0;
    for(let q=0;q<pistes.length;q++){
      const A=pistes[q].points[i], B=pistes[q].points[j], V=vues[q];
      const x=A.x+u*(B.x-A.x), y=A.y+u*(B.y-A.y);
      // LA CONFIANCE LA PLUS BASSE DES DEUX BORNES : un échantillon posé entre
      // une image sûre et une image perdue n'est pas à moitié sûr.
      const c=Math.max(0,Math.min(1,Math.min(A.conf,B.conf)));
      V.xy.setInt16(4*k,Math.max(-32767,Math.min(32767,Math.round(x/p.vw*32767))),true);
      V.xy.setInt16(4*k+2,Math.max(-32767,Math.min(32767,Math.round(y/p.vh*32767))),true);
      V.cf[k]=Math.round(255*c);
    }
  }
  return {v:1,debutMs:seg.debutMs,finMs:seg.finMs,vw:Math.round(p.vw),vh:Math.round(p.vh),n,
    // BORNÉ AUX BORNES DE LA RÉPÉTITION : le décodeur peut rendre une image
    // quelques millièmes avant celle qu'on lui a demandée, et le validateur
    // rejetterait tout le lot pour cela.
    t0Ms:Math.max(seg.debutMs,Math.min(seg.finMs,Math.round(t0))),
    pasMs:Math.round(pasMs*1000)/1000,
    pts:pistes.map((q,z)=>({nom:q.nom,c:q.couleur,r:Math.round(q.r*10)/10,
      sx:Math.round(q.sx*10)/10,sy:Math.round(q.sy*10)/10,
      xy:mlB64(new Uint8Array(vues[z].xy.buffer)),cf:mlB64(vues[z].cf)}))};
}
/**
 * PURE. Les points suivis, relus : les instants communs, puis pour chacun son
 * nom, sa couleur, ses positions normées et ses confiances entre 0 et 1.
 * @param {any} r  un lot passé par segReperesValide
 * @returns {{t:number[], pts:{nom:string, c:number, x:number[], y:number[], conf:number[]}[]}}
 */
function mlDecompacterReperes(r){
  const t=[];
  for(let k=0;k<r.n;k++) t.push(r.t0Ms+k*r.pasMs);
  return {t,pts:r.pts.map((/** @type {any} */ p)=>{
    const xy=new DataView(mlOctets(p.xy).buffer), cf=mlOctets(p.cf);
    const x=[], y=[], conf=[];
    for(let k=0;k<r.n;k++){
      const xi=xy.getInt16(4*k,true), yi=xy.getInt16(4*k+2,true);
      x.push(xi===ML_I16_TROU?NaN:xi/32767);
      y.push(yi===ML_I16_TROU?NaN:yi/32767);
      conf.push(cf[k]/255);
    }
    return {nom:p.nom,c:p.c,x,y,conf};
  })};
}

// ══ LES ARTICULATIONS ═══════════════════════════════════════════════════════
//
// MediaPipe Pose rend trente-trois points ; on en garde quatorze — ceux qui
// portent les sept angles demandés, des deux côtés. Le visage et les mains ne
// disent rien d'un squat, et chaque point pèse dans ce que le téléphone renvoie
// à chaque enregistrement.
//
// ⚠ LES DEUX CÔTÉS SONT GARDÉS, pas seulement celui qu'on regarde. Filmé de
// profil, l'athlète en cache un, et MediaPipe le devine plus qu'il ne le voit ;
// mais relancer une minute d'analyse parce que le coach change d'avis sur le
// côté serait absurde. Le côté se choisit à la lecture, pas à l'analyse.

/** Les indices MediaPipe conservés, dans l'ordre où ils sont stockés. */
const ML_POSE_IDX=Object.freeze([11,12,13,14,15,16,23,24,25,26,27,28,31,32]);
/** Le rang du point GAUCHE de chaque membre ; le droit est le rang suivant. */
const ML_POSE_RANG=Object.freeze({epaule:0,coude:2,poignet:4,hanche:6,genou:8,cheville:10,pointe:12});
/** Les os dessinés, d'un point à l'autre. */
const ML_POSE_OS=Object.freeze([['epaule','coude'],['coude','poignet'],['epaule','hanche'],
  ['hanche','genou'],['genou','cheville'],['cheville','pointe']]);
/**
 * Les sept angles demandés. `c` vide : l'angle se mesure par rapport à la
 * verticale de l'image, et non entre trois points.
 */
const ML_ANGLES=Object.freeze([
  {cle:'coude',nom:'Coude',a:'epaule',b:'coude',c:'poignet'},
  {cle:'epaule',nom:'Épaule',a:'hanche',b:'epaule',c:'coude'},
  {cle:'hanche',nom:'Hanche',a:'epaule',b:'hanche',c:'genou'},
  {cle:'genou',nom:'Genou',a:'hanche',b:'genou',c:'cheville'},
  {cle:'cheville',nom:'Cheville',a:'genou',b:'cheville',c:'pointe'},
  {cle:'tronc',nom:'Tronc',a:'hanche',b:'epaule',c:''},
  {cle:'avantBras',nom:'Avant-bras',a:'coude',b:'poignet',c:''}
]);
// LE SEUIL DU CAHIER DES CHARGES : sous cette visibilité, l'angle n'est pas
// affiché. Il n'est pas « estimé », il n'est pas « approché » — il est absent.
const ML_POSE_VIS_MIN=0.5;

/**
 * PURE. Le rang d'un point dans les tableaux stockés, -1 s'il n'existe pas.
 * @param {string} nom
 * @param {string} cote  'G' ou 'D'
 * @returns {number}
 */
function mlRangPose(nom,cote){
  const r=/** @type {Object<string,number>} */(ML_POSE_RANG)[nom];
  return r===undefined?-1:r+(cote==='D'?1:0);
}
/**
 * PURE. L'angle en B, entre 0 et 180 degrés, null si deux points se confondent.
 * ⚠ LES COORDONNÉES SONT EN PIXELS. Les normalisées de MediaPipe divisent x par
 * la largeur et y par la hauteur : sur une image 16/9 elles font lire 45° là où
 * il y en a 28.
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @param {number} cx @param {number} cy
 * @returns {number|null}
 */
function mlAngleEn(ax,ay,bx,by,cx,cy){
  const ux=ax-bx, uy=ay-by, vx=cx-bx, vy=cy-by;
  const nu=Math.hypot(ux,uy), nv=Math.hypot(vx,vy);
  if(!(nu>1e-6)||!(nv>1e-6)) return null;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(nu*nv))))*180/Math.PI;
}
/**
 * PURE. L'inclinaison du segment A→B sur la verticale de l'image : 0 quand il
 * monte tout droit, 90 à l'horizontale, 180 quand il descend. Y grandit vers le
 * bas, donc « le haut » est (0,-1).
 * @param {number} ax @param {number} ay
 * @param {number} bx @param {number} by
 * @returns {number|null}
 */
function mlInclinaison(ax,ay,bx,by){
  const ux=bx-ax, uy=by-ay, n=Math.hypot(ux,uy);
  if(!(n>1e-6)) return null;
  return Math.acos(Math.max(-1,Math.min(1,-uy/n)))*180/Math.PI;
}
/**
 * PURE. Les sept angles d'une pose, en degrés — null dès qu'un des points qui
 * le portent est trop peu visible.
 * ⚠ JAMAIS DE VALEUR INVENTÉE : un angle qu'on ne voit pas ne vaut pas mieux
 * qu'un angle absent, et affiché il ferait corriger un geste sur du bruit.
 * @param {number[]} X  quatorze abscisses, EN PIXELS
 * @param {number[]} Y  quatorze ordonnées, EN PIXELS
 * @param {number[]} V  quatorze visibilités, entre 0 et 1
 * @param {string} cote  'G' ou 'D'
 * @returns {Object<string,number|null>}
 */
function mlAnglesPose(X,Y,V,cote){
  /** @type {Object<string,number|null>} */
  const out={};
  for(const d of ML_ANGLES){
    const ra=mlRangPose(d.a,cote), rb=mlRangPose(d.b,cote), rc=d.c?mlRangPose(d.c,cote):-1;
    const rangs=d.c?[ra,rb,rc]:[ra,rb];
    out[d.cle]=rangs.some(r=>r<0||!isFinite(X[r])||!isFinite(Y[r])||!(V[r]>=ML_POSE_VIS_MIN))
      ?null
      :(d.c?mlAngleEn(X[ra],Y[ra],X[rb],Y[rb],X[rc],Y[rc])
           :mlInclinaison(X[ra],Y[ra],X[rb],Y[rb]));
  }
  return out;
}
/**
 * PURE. Un angle lissé : moyenne pondérée [1,2,1] sur trois échantillons, les
 * trous restant des trous et les bords inchangés.
 * ⚠ PAS PLUS LARGE. À douze échantillons par seconde, une fenêtre de sept
 * points couvre six dixièmes de seconde : elle raboterait le fond du squat, qui
 * est précisément ce qu'on vient regarder.
 * @param {(number|null)[]} v
 * @returns {(number|null)[]}
 */
function mlLisserAngles(v){
  return v.map((x,i)=>{
    if(x==null) return null;
    const a=v[i-1], b=v[i+1];
    return (a==null||b==null)?x:(a+2*x+b)/4;
  });
}
/**
 * PURE. Le côté filmé : celui dont les points sont les mieux vus. Un athlète de
 * profil cache la moitié de son corps, et MediaPipe devine la moitié cachée —
 * on préfère mesurer celle qu'on voit.
 * @param {{V:number[]}[]} ech
 * @returns {string}
 */
function mlCotePose(ech){
  let g=0, d=0;
  for(const e of ech||[]) for(let r=0;r<ML_POSE_IDX.length;r+=2){
    g+=Number(e.V[r])||0; d+=Number(e.V[r+1])||0;
  }
  return d>g?'D':'G';
}
/**
 * PURE. Les échantillons de pose compactés : deux entiers seize bits par point
 * pour la position normée, un octet pour la visibilité. Soixante-douze
 * échantillons au plus, soit sept kilo-octets en base64 — l'ordre de grandeur
 * de la trajectoire de barre, pour une donnée du même genre.
 * ⚠ LE PAS EST NOMINAL : chaque échantillon est pris sur l'image la plus proche
 * de l'instant visé, à une demi-image près — huit millisecondes à 60 i/s, sous
 * le bruit des points eux-mêmes.
 * @param {Segment} seg
 * @param {{tMs:number, X:number[], Y:number[], V:number[]}[]} ech  positions EN PIXELS
 * @param {{vw:number, vh:number, cote:string, theta?:number, hp?:number|null}} p
 * @returns {any}
 */
function mlCompacterPose(seg,ech,p){
  const l=(ech||[]).slice(0,SEG_POSE_MAX), n=l.length, N=ML_POSE_IDX.length;
  const xy=new DataView(new ArrayBuffer(n*N*4)), vis=new Uint8Array(n*N);
  const pasMs=n>1?(l[n-1].tMs-l[0].tMs)/(n-1):0;
  /** @param {number} v */
  const i16=v=>isFinite(v)?Math.max(-32767,Math.min(32767,Math.round(v*32767))):ML_I16_TROU;
  for(let k=0;k<n;k++) for(let r=0;r<N;r++){
    const o=(k*N+r)*4;
    xy.setInt16(o,i16(l[k].X[r]/p.vw),true);
    xy.setInt16(o+2,i16(l[k].Y[r]/p.vh),true);
    const v=Number(l[k].V[r]);
    vis[k*N+r]=isFinite(v)?Math.round(255*Math.max(0,Math.min(1,v))):0;
  }
  return {v:1,debutMs:seg.debutMs,finMs:seg.finMs,vw:p.vw,vh:p.vh,cote:p.cote,n,
    theta:Math.round((Number(p.theta)||0)*10)/10,
    ...(p.hp==null?{}:{hp:Math.round(Number(p.hp))}),
    t0Ms:Math.round(n?l[0].tMs:seg.debutMs),pasMs:Math.round(pasMs*1000)/1000,
    xy:mlB64(new Uint8Array(xy.buffer)),vis:mlB64(vis)};
}
/**
 * PURE. La pose compactée, relue : temps, positions NORMÉES (NaN pour un point
 * absent) et visibilités entre 0 et 1.
 * @param {any} p  une pose passée par segPoseValide
 * @returns {{t:number[], X:number[][], Y:number[][], V:number[][]}}
 */
function mlDecompacterPose(p){
  const xy=new DataView(mlOctets(p.xy).buffer), vis=mlOctets(p.vis), N=ML_POSE_IDX.length;
  const t=[], X=[], Y=[], V=[];
  for(let k=0;k<p.n;k++){
    const x=[], y=[], v=[];
    for(let r=0;r<N;r++){
      const o=(k*N+r)*4;
      const xi=xy.getInt16(o,true), yi=xy.getInt16(o+2,true);
      x.push(xi===ML_I16_TROU?NaN:xi/32767);
      y.push(yi===ML_I16_TROU?NaN:yi/32767);
      v.push(vis[k*N+r]/255);
    }
    t.push(p.t0Ms+k*p.pasMs); X.push(x); Y.push(y); V.push(v);
  }
  return {t,X,Y,V};
}
/**
 * PURE. Les sept angles dans le temps, lissés, pour un côté donné.
 * @param {any} p  une pose passée par segPoseValide
 * @param {string} [cote]  'G' ou 'D' ; celui de l'enregistrement par défaut
 * @returns {{t:number[], X:number[][], Y:number[][], V:number[][], ang:Object<string,(number|null)[]>, cote:string, theta:number, hp:number|null}}
 */
function mlAnglesSerie(p,cote){
  const d=mlDecompacterPose(p), c=(cote==='G'||cote==='D')?cote:p.cote;
  const theta=Number(p.theta)||0;
  /** @type {Object<string,(number|null)[]>} */
  const ang={};
  for(const q of ML_ANGLES) ang[q.cle]=[];
  for(let k=0;k<d.t.length;k++){
    // ⚠ LES ANGLES SE CALCULENT REDRESSÉS, LE DESSIN RESTE BRUT : la vidéo
    // s'affiche telle qu'elle a été filmée, et le squelette doit tomber sur le
    // corps qu'on y voit. Seules les MESURES passent dans le repère du monde.
    const r=theta?mlRedresser(d.X[k].map(v=>v*p.vw),d.Y[k].map(v=>v*p.vh),theta,p.vw/2,p.vh/2)
                 :{X:d.X[k].map(v=>v*p.vw),Y:d.Y[k].map(v=>v*p.vh)};
    const a=mlAnglesPose(r.X,r.Y,d.V[k],c);
    for(const q of ML_ANGLES) ang[q.cle].push(a[q.cle]);
  }
  for(const q of ML_ANGLES) ang[q.cle]=mlLisserAngles(ang[q.cle]);
  return {t:d.t,X:d.X,Y:d.Y,V:d.V,ang,cote:c,theta,hp:p.hp==null?null:Number(p.hp)};
}
/**
 * PURE. Par angle : son minimum, son maximum, l'instant du minimum et le
 * nombre d'échantillons où il était lisible. Un angle jamais lisible n'entre
 * pas — il n'y a rien à en dire.
 * @param {{t:number[], ang:Object<string,(number|null)[]>}} serie
 * @returns {Object<string,{min:number, max:number, tMin:number, n:number}>}
 */
function mlMetriquesAngles(serie){
  /** @type {Object<string,{min:number, max:number, tMin:number, n:number}>} */
  const out={};
  for(const q of ML_ANGLES){
    const v=serie.ang[q.cle]||[];
    let min=Infinity, max=-Infinity, tMin=0, n=0;
    for(let k=0;k<v.length;k++){
      const x=v[k];
      if(x==null) continue;
      n++;
      if(x<min){ min=x; tMin=serie.t[k]; }
      if(x>max) max=x;
    }
    if(n) out[q.cle]={min:Math.round(min*10)/10,max:Math.round(max*10)/10,tMin:Math.round(tMin),n};
  }
  return out;
}
/**
 * PURE. Les passages où l'angle manque, regroupés : le coach doit savoir QUAND
 * on n'a pas vu, sans quoi une courbe trouée passe pour une courbe plate.
 * @param {number[]} t
 * @param {(number|null)[]} v
 * @returns {{debutMs:number, finMs:number}[]}
 */
function mlTrousAngles(t,v){
  const out=[];
  let d=-1;
  for(let k=0;k<v.length;k++){
    if(v[k]==null){ if(d<0) d=k; continue; }
    if(d>=0){ out.push({debutMs:Math.round(t[d]),finMs:Math.round(t[k-1])}); d=-1; }
  }
  if(d>=0) out.push({debutMs:Math.round(t[d]),finMs:Math.round(t[v.length-1])});
  return out;
}

// ══ LOT 8 — LE REPÈRE : APLOMB, HORS-PLAN, ÉTALON, BIAIS ════════════════════
//
// Tout ce qui précède mesure des positions dans le repère de l'IMAGE. Or une
// image n'est pas le monde : le téléphone penche, l'athlète n'est pas de profil
// exact, et le modèle de pose sous-estime les flexions vues de côté. Trois
// biais qui ne se voient pas, qui vont tous dans le même sens sur toute une
// vidéo, et que tout ce qui suit hériterait.
//
// ⚠ AUCUN DE CES TROIS CORRECTIFS N'INVENTE UNE VALEUR. Quand l'aplomb ne
// s'estime pas, il vaut zéro ET L'ÉCRAN LE DIT. Quand la prise de vue sort du
// domaine où le biais de projection a été mesuré, l'angle reste BRUT et porte
// sa tolérance large. On corrige ce qu'on sait corriger, pas davantage.

// L'APLOMB SE CORRIGE À LA MAIN ENTRE CES BORNES. Au-delà de quinze degrés, ce
// n'est plus un téléphone posé de travers : c'est un cadrage que le redressement
// ne sauvera pas, et qu'il vaut mieux refilmer.
const ML_APLOMB_MAX=15;
// LE SEGMENT INTER-HANCHES doit porter du signal. Filmé de profil, il se réduit
// à quelques pixels — une hanche cache l'autre — et son inclinaison n'est plus
// que du bruit. On exige qu'il fasse au moins ce quart de la longueur du tronc
// visible dans la même image : en dessous, un pixel d'erreur sur un point
// déplacerait l'estimation de plus de dix degrés.
const ML_HANCHES_MIN_TRONC=0.25;
// DIX IMAGES : en dessous, l'écart-type de l'estimation ne veut rien dire.
const ML_HORIZON_N_MIN=10;
// LA VISIBILITÉ EXIGÉE des deux hanches. Plus haut que le seuil ordinaire
// (0,5) : ici on ne mesure pas un angle du corps, on mesure le MONDE, et une
// erreur se reporte ensuite sur toute la vidéo.
const ML_HORIZON_VIS=0.7;

/**
 * PURE. L'angle du repère image sur la verticale réelle, en degrés, estimé sur
 * le segment inter-hanches : il est horizontal dans le monde, donc ce qu'on lit
 * de son inclinaison est celle de l'appareil. Positif quand la droite de
 * l'image est plus basse que sa gauche.
 *
 * ⚠ RETOURNE null LE PLUS SOUVENT SUR UNE VIDÉO DE PROFIL, et c'est normal :
 * de profil, une hanche cache l'autre et le segment n'a plus de longueur. C'est
 * précisément pourquoi l'écran offre un curseur : l'estimation est un confort,
 * pas la source de vérité.
 *
 * @param {{X:number[], Y:number[], V:number[]}[]} ech  positions EN PIXELS
 * @returns {{theta:number, n:number, ecartType:number}|null}
 */
function mlHorizon(ech){
  const hg=mlRangPose('hanche','G'), hd=mlRangPose('hanche','D');
  const eg=mlRangPose('epaule','G'), ed=mlRangPose('epaule','D');
  /** @type {number[]} */
  const angles=[];
  for(const e of ech||[]){
    if(!e||!e.X||!e.Y||!e.V) continue;
    if(!(e.V[hg]>=ML_HORIZON_VIS)||!(e.V[hd]>=ML_HORIZON_VIS)) continue;
    const xg=e.X[hg], yg=e.Y[hg], xd=e.X[hd], yd=e.Y[hd];
    if(![xg,yg,xd,yd].every(isFinite)) continue;
    // LE TRONC DE LA MÊME IMAGE donne l'échelle : pas besoin de mètres pour
    // savoir si le segment inter-hanches est assez long pour dire quelque chose.
    const mx=(xg+xd)/2, my=(yg+yd)/2;
    const sx=(e.X[eg]+e.X[ed])/2, sy=(e.Y[eg]+e.Y[ed])/2;
    if(!isFinite(sx)||!isFinite(sy)) continue;
    const tronc=Math.hypot(sx-mx,sy-my);
    let dx=xd-xg, dy=yd-yg;
    // L'ATHLÈTE PEUT ÊTRE TOURNÉ : on oriente le segment vers la droite de
    // l'image, sinon la même inclinaison se lirait tantôt +5°, tantôt −175°.
    if(dx<0){ dx=-dx; dy=-dy; }
    const l=Math.hypot(dx,dy);
    if(!(tronc>1e-6)||!(l>=ML_HANCHES_MIN_TRONC*tronc)) continue;
    const a=Math.atan2(dy,dx)*180/Math.PI;
    // DEBOUT, PAS COUCHÉ : au-delà, l'athlète n'est pas dans la position où le
    // bassin est horizontal, et ce qu'on lirait serait sa posture.
    if(Math.abs(a)>30) continue;
    angles.push(a);
  }
  if(angles.length<ML_HORIZON_N_MIN) return null;
  // LA MÉDIANE, PAS LA MOYENNE : une image où le modèle a confondu les deux
  // hanches donne un angle absurde, et une seule suffirait à déplacer une
  // moyenne. L'écart-type, lui, reste calculé sur tout pour DIRE la dispersion.
  const tries=angles.slice().sort((a,b)=>a-b);
  const n=tries.length;
  const theta=n%2?tries[(n-1)/2]:(tries[n/2-1]+tries[n/2])/2;
  let s=0;
  for(const a of angles) s+=(a-theta)*(a-theta);
  return {theta:Math.round(theta*10)/10,n,ecartType:Math.round(Math.sqrt(s/n)*10)/10};
}
/**
 * PURE. Les points redressés de `theta` degrés : on tourne l'image de −theta
 * pour remettre la verticale du monde sur la verticale de l'écran.
 * Le centre ne change RIEN aux angles — une rotation les conserve tous — et ne
 * décale les positions que d'un bloc ; il vaut l'origine par défaut.
 * @param {number[]} X
 * @param {number[]} Y
 * @param {number} theta  degrés
 * @param {number} [cx]
 * @param {number} [cy]
 * @returns {{X:number[], Y:number[]}}
 */
function mlRedresser(X,Y,theta,cx,cy){
  const t=-(Number(theta)||0)*Math.PI/180;
  const co=Math.cos(t), si=Math.sin(t);
  const ox=Number(cx)||0, oy=Number(cy)||0;
  const nx=[], ny=[];
  for(let i=0;i<X.length;i++){
    const x=X[i]-ox, y=Y[i]-oy;
    if(!isFinite(x)||!isFinite(y)){ nx.push(NaN); ny.push(NaN); continue; }
    nx.push(ox+x*co-y*si);
    ny.push(oy+x*si+y*co);
  }
  return {X:nx,Y:ny};
}

// LA LARGEUR INTER-HANCHES rapportée à la longueur du tronc, chez l'adulte :
// l'écart entre les deux têtes fémorales vaut environ 0,105 fois la stature, et
// la distance hanche-épaule environ 0,288 fois. Le rapport tombe à 0,36. Il
// varie d'un individu à l'autre d'environ ±20 %, ce qui déplace la frontière
// des quinze degrés de ±4° : assez pour un verdict en trois niveaux sur la
// PRISE DE VUE, bien trop peu pour en tirer une mesure.
const ML_BASSIN_TRONC=0.36;
// LES TROIS NIVEAUX DE PRISE DE VUE. Ce sont les SEULS verdicts en trois
// niveaux du module, et ils portent sur la VIDÉO, jamais sur le mouvement.
// À trente degrés hors du plan au lieu de quatre-vingt-dix, l'erreur sur une
// vitesse horizontale est multipliée par 2,5 : d'où une réserve dès quinze.
const ML_HORSPLAN_OK=15;
const ML_HORSPLAN_REFAIRE=25;

/**
 * PURE. L'écart de la prise de vue au profil, en degrés : 0 de profil parfait,
 * 90 de face. La largeur inter-hanches projetée vaut la vraie largeur multipliée
 * par le sinus de cet écart ; on la rapporte au tronc de la même image, donc
 * sans avoir besoin d'aucune échelle.
 *
 * ⚠ C'EST UNE ESTIMATION MORPHOLOGIQUE, pas une mesure : elle repose sur un
 * rapport anthropométrique moyen. Elle sert à dire « de profil » ou « de
 * trois-quarts », pas à corriger quoi que ce soit.
 *
 * @param {{X:number[], Y:number[], V:number[]}[]} ech  positions EN PIXELS
 * @returns {{deg:number, n:number}|null}
 */
function mlHorsPlan(ech){
  const hg=mlRangPose('hanche','G'), hd=mlRangPose('hanche','D');
  const eg=mlRangPose('epaule','G'), ed=mlRangPose('epaule','D');
  /** @type {number[]} */
  const vals=[];
  for(const e of ech||[]){
    if(!e||!e.X||!e.Y||!e.V) continue;
    if(!(e.V[hg]>=ML_HORIZON_VIS)||!(e.V[hd]>=ML_HORIZON_VIS)) continue;
    const xg=e.X[hg], yg=e.Y[hg], xd=e.X[hd], yd=e.Y[hd];
    if(![xg,yg,xd,yd].every(isFinite)) continue;
    const mx=(xg+xd)/2, my=(yg+yd)/2;
    const sx=(e.X[eg]+e.X[ed])/2, sy=(e.Y[eg]+e.Y[ed])/2;
    if(!isFinite(sx)||!isFinite(sy)) continue;
    const tronc=Math.hypot(sx-mx,sy-my);
    if(!(tronc>1e-6)) continue;
    const large=Math.hypot(xd-xg,yd-yg)/tronc/ML_BASSIN_TRONC;
    vals.push(Math.asin(Math.max(0,Math.min(1,large)))*180/Math.PI);
  }
  if(!vals.length) return null;
  vals.sort((a,b)=>a-b);
  const n=vals.length;
  const med=n%2?vals[(n-1)/2]:(vals[n/2-1]+vals[n/2])/2;
  return {deg:Math.round(med),n};
}
/**
 * PURE. Le contrôle de prise de vue, AVANT l'analyse : ce qui se verrait de
 * toute façon dans le résultat, dit en dix images plutôt qu'en une minute.
 * Rend un niveau d'ensemble et le détail, point par point.
 *
 * ⚠ CE VERDICT PORTE SUR LA VIDÉO, JAMAIS SUR LE MOUVEMENT. Il ne dit pas si le
 * geste est bon : il dit si l'image permet de le mesurer.
 *
 * @param {{X:number[], Y:number[], V:number[]}[]} ech  positions EN PIXELS
 * @param {{vw:number, vh:number, fps:number, fpsMesure:boolean}} meta
 * @returns {{niveau:'ok'|'reserve'|'refilmer', points:{cle:string, etat:'ok'|'reserve'|'refilmer'|'inconnu', phrase:string}[]}}
 */
function mlControlePriseDeVue(ech,meta){
  /** @type {{cle:string, etat:'ok'|'reserve'|'refilmer'|'inconnu', phrase:string}[]} */
  const points=[];
  const l=(ech||[]).filter(e=>e&&e.X&&e.Y&&e.V);
  const vu=l.filter(e=>e.V.some(v=>v>=ML_POSE_VIS_MIN));
  if(!vu.length){
    points.push({cle:'sujet',etat:'refilmer',phrase:'Personne n’est reconnu sur ces images : cadre l’athlète en entier.'});
    return {niveau:'refilmer',points};
  }
  // ── DE PROFIL ? ────────────────────────────────────────────────────────────
  const hp=mlHorsPlan(l);
  if(!hp) points.push({cle:'profil',etat:'inconnu',
    phrase:'Impossible de juger l’angle de prise de vue : les deux hanches ne se voient pas assez.'});
  else if(hp.deg<=ML_HORSPLAN_OK) points.push({cle:'profil',etat:'ok',
    phrase:'Prise de vue de profil (≈ '+hp.deg+'° d’écart).'});
  else if(hp.deg<=ML_HORSPLAN_REFAIRE) points.push({cle:'profil',etat:'reserve',
    phrase:'Prise de vue de trois-quarts (≈ '+hp.deg+'° d’écart) : les distances horizontales sont sous-estimées.'});
  else points.push({cle:'profil',etat:'refilmer',
    phrase:'Prise de vue trop de face (≈ '+hp.deg+'° d’écart) : une mesure en deux dimensions n’y veut plus dire grand-chose.'});
  // ── L'ATHLÈTE ENTIER DANS LE CADRE ────────────────────────────────────────
  const bords=vu.filter(e=>{
    for(let r=0;r<e.X.length;r++){
      if(!(e.V[r]>=ML_POSE_VIS_MIN)) continue;
      if(e.X[r]<0||e.Y[r]<0||e.X[r]>meta.vw||e.Y[r]>meta.vh) return true;
    }
    return false;
  }).length;
  if(bords>vu.length/3) points.push({cle:'cadre',etat:'refilmer',
    phrase:'L’athlète sort du cadre : recule ou tourne le téléphone.'});
  else if(bords) points.push({cle:'cadre',etat:'reserve',
    phrase:'L’athlète touche le bord sur quelques images.'});
  else points.push({cle:'cadre',etat:'ok',phrase:'L’athlète tient dans le cadre.'});
  // ── SA TAILLE DANS L'IMAGE ────────────────────────────────────────────────
  // MOINS DE LA MOITIÉ DE LA HAUTEUR : chaque point du corps porte alors plus
  // d'un centimètre d'incertitude, et les angles qui s'en déduisent aussi.
  let hautMax=0;
  for(const e of vu){
    let y0=Infinity, y1=-Infinity;
    for(let r=0;r<e.X.length;r++){
      if(!(e.V[r]>=ML_POSE_VIS_MIN)||!isFinite(e.Y[r])) continue;
      y0=Math.min(y0,e.Y[r]); y1=Math.max(y1,e.Y[r]);
    }
    if(y1>y0) hautMax=Math.max(hautMax,(y1-y0)/Math.max(1,meta.vh));
  }
  const pc=Math.round(hautMax*100);
  if(hautMax>=0.5) points.push({cle:'taille',etat:'ok',phrase:'L’athlète occupe '+pc+' % de la hauteur de l’image.'});
  else if(hautMax>=0.3) points.push({cle:'taille',etat:'reserve',
    phrase:'L’athlète n’occupe que '+pc+' % de la hauteur : approche-toi.'});
  else points.push({cle:'taille',etat:'refilmer',
    phrase:'L’athlète est trop loin ('+pc+' % de la hauteur) : les points du corps se confondent.'});
  // ── L'APLOMB ──────────────────────────────────────────────────────────────
  const hz=mlHorizon(l);
  if(!hz) points.push({cle:'aplomb',etat:'inconnu',
    phrase:'Aplomb non mesurable ici : il est considéré comme nul, et se corrige à la main.'});
  else if(Math.abs(hz.theta)<=2) points.push({cle:'aplomb',etat:'ok',
    phrase:'Téléphone d’aplomb (≈ '+Math.round(hz.theta)+'°).'});
  else if(Math.abs(hz.theta)<=ML_APLOMB_MAX) points.push({cle:'aplomb',etat:'reserve',
    phrase:'Téléphone penché d’environ '+Math.round(hz.theta)+'° : le redressement s’en charge.'});
  else points.push({cle:'aplomb',etat:'refilmer',
    phrase:'Téléphone penché de plus de '+ML_APLOMB_MAX+'° : redresse-le plutôt que de corriger après coup.'});
  // ── LA CADENCE ────────────────────────────────────────────────────────────
  if(!meta.fpsMesure) points.push({cle:'cadence',etat:'reserve',
    phrase:'Cadence non mesurée : les vitesses seront approchées.'});
  else if(meta.fps>=55) points.push({cle:'cadence',etat:'ok',phrase:Math.round(meta.fps)+' images par seconde.'});
  else points.push({cle:'cadence',etat:'reserve',
    phrase:Math.round(meta.fps)+' images par seconde : un geste rapide passe entre deux images.'});
  // ── LE CADRAGE BOUGE-T-IL ? ───────────────────────────────────────────────
  // ⚠ CE QU'ON MESURE ICI, c'est le déplacement du sujet DANS l'image pendant
  // une seconde de mise en place. Un téléphone tenu à la main s'y voit ; un
  // téléphone posé pendant que l'athlète marche vers la barre aussi, et c'est
  // le défaut de la sonde — on le dit « à vérifier », jamais « à refilmer ».
  let cx0=0, cy0=0, k=0, dMax=0, ech0=0;
  for(const e of vu){
    let sx=0, sy=0, m=0, y0=Infinity, y1=-Infinity;
    for(let r=0;r<e.X.length;r++){
      if(!(e.V[r]>=ML_POSE_VIS_MIN)||!isFinite(e.X[r])||!isFinite(e.Y[r])) continue;
      sx+=e.X[r]; sy+=e.Y[r]; m++;
      y0=Math.min(y0,e.Y[r]); y1=Math.max(y1,e.Y[r]);
    }
    if(!m||!(y1>y0)) continue;
    sx/=m; sy/=m;
    if(!k){ cx0=sx; cy0=sy; ech0=y1-y0; }
    else dMax=Math.max(dMax,Math.hypot(sx-cx0,sy-cy0)/Math.max(1,ech0));
    k++;
  }
  if(k<2) points.push({cle:'stabilite',etat:'inconnu',phrase:'Stabilité du cadrage non jugée : trop peu d’images.'});
  else if(dMax<=0.15) points.push({cle:'stabilite',etat:'ok',phrase:'Cadrage stable.'});
  else points.push({cle:'stabilite',etat:'reserve',
    phrase:'Le sujet se déplace dans l’image : pose le téléphone si tu le tiens.'});
  const niveau=points.some(p=>p.etat==='refilmer')?'refilmer'
    :points.some(p=>p.etat==='reserve')?'reserve':'ok';
  return {niveau,points};
}

// ── LE BIAIS DE PROJECTION ──────────────────────────────────────────────────
//
// ⚠ CES COEFFICIENTS VIENNENT DU CAHIER DES CHARGES, PAS D'UNE MESURE FAITE
// ICI. Ils y sont donnés pour un SQUAT FILMÉ DE PROFIL : les angles bruts de
// MediaPipe sous-estiment la flexion de 11,2° à la hanche et de 10,6° au genou,
// et une correction linéaire ramène l'erreur quadratique de 11,6° à 4,0° et de
// 10,9° à 3,9°. Le cahier des charges annonce DEUX coefficients par
// articulation ; il n'en donne qu'un — le décalage. La pente vaut donc 1 ici,
// faute de mieux, et la table est prête à la recevoir.
//
// ⚠ ET CE QUI N'EST PAS DIT NE SE CORRIGE PAS. Hors du domaine — une autre
// articulation, une prise de vue à plus de quinze degrés du profil — l'angle
// reste BRUT et porte sa tolérance large. Mieux vaut un angle franchement
// approximatif qu'un angle faussement précis.
const ML_BIAIS=Object.freeze({
  hanche:Object.freeze({pente:1,decalage:11.2,source:'squat de profil'}),
  genou:Object.freeze({pente:1,decalage:10.6,source:'squat de profil'})
});
// LES DEUX TOLÉRANCES, en degrés, affichées avec chaque angle.
const ML_TOL_CORRIGE=5;
const ML_TOL_BRUT=11;

/**
 * PURE. La flexion anatomique d'une articulation, à partir de l'angle intérieur
 * mesuré : un genou tendu vaut 0° de flexion, plié à angle droit 90°. Les deux
 * INCLINAISONS — tronc et avant-bras — ne sont pas des flexions et ne se
 * convertissent pas : elles restent telles quelles.
 * @param {string} cle
 * @param {number|null} interieur
 * @returns {number|null}
 */
function mlFlexion(cle,interieur){
  if(interieur==null||!isFinite(interieur)) return null;
  const d=ML_ANGLES.find(q=>q.cle===cle);
  return (d&&d.c)?180-interieur:interieur;
}
/**
 * PURE. La flexion corrigée du biais de projection, avec sa tolérance et son
 * origine. `horsPlan` : l'écart au profil en degrés, quand on le connaît.
 * @param {string} cle
 * @param {number|null} flexion  DEGRÉS DE FLEXION, pas l'angle intérieur
 * @param {number} [horsPlan]
 * @returns {{deg:number, corrige:boolean, tol:number}|null}
 */
function mlCorrigerAngle(cle,flexion,horsPlan){
  if(flexion==null||!isFinite(flexion)) return null;
  const b=/** @type {Object<string,{pente:number, decalage:number, source:string}>} */(ML_BIAIS)[cle];
  const dansLeDomaine=!!b&&(horsPlan==null||!isFinite(Number(horsPlan))||Number(horsPlan)<=ML_HORSPLAN_OK);
  if(!dansLeDomaine) return {deg:Math.round(flexion),corrige:false,tol:ML_TOL_BRUT};
  const d=b.pente*flexion+b.decalage;
  // UNE FLEXION NE SORT PAS DE [0, 180] : la corriger ne doit pas la faire
  // sortir du possible.
  return {deg:Math.round(Math.max(0,Math.min(180,d))),corrige:true,tol:ML_TOL_CORRIGE};
}
/**
 * PURE. « 131° ±5 » : un angle tel qu'il doit s'écrire — au degré entier,
 * jamais au dixième, et toujours avec sa tolérance.
 * @param {{deg:number, corrige:boolean, tol:number}|null} a
 * @returns {string}
 */
function mlAngleTexte(a){
  return a?a.deg+'° ±'+a.tol:'—';
}


// ══ LOT 9 — LE TEMPS : TROIS VITESSES, TEMPO, POINT DUR, JOINTURE ═══════════
//
// Tout ce qui précède ne dérive que Y. Sur une poulie haute, un écarté, une
// presse inclinée ou une machine convergente, la charge se déplace surtout à
// l'horizontale : la vitesse affichée ne veut rien dire et les phases ne se
// déclenchent jamais. Trois vitesses règlent ça, et chacune répond à une
// question différente.
//
// ⚠ LES RÉSULTATS DÉJÀ ENREGISTRÉS NE BOUGENT PAS. Les seuils de phase
// continuent de travailler sur la vitesse VERTICALE pour toute charge
// verticale — c'est-à-dire l'immense majorité des analyses existantes. Le
// basculement sur la vitesse le long du chemin est réservé aux mouvements qui
// ne sont PAS verticaux, et il est décidé par une mesure, pas par un réglage.

/**
 * LE SEUIL DE VERTICALITÉ. C'est le rapport du déplacement vertical cumulé au
 * chemin parcouru : il vaut 1 sur une droite verticale, 0,707 sur une droite à
 * 45°, et environ 0,64 sur un quart de cercle — la forme d'un écarté. À 0,75,
 * la frontière tombe sur une direction moyenne à 41° de la verticale : un
 * développé incliné reste vertical, un écarté et une convergente basculent.
 * En dessous, la composante verticale seule perd plus du quart du mouvement,
 * et le seuil de départ de 0,15 m/s se déclenche tard ou pas du tout.
 */
const ML_VERTICALITE=0.75;
/**
 * L'ARRÊT, en m/s : sous cette vitesse, on ne bouge plus. Trois fois le bruit
 * résiduel de la dérivée lissée mesuré sur un disque immobile filmé à 60 i/s
 * (de l'ordre de 0,015 m/s pour deux pixels de bruit de suivi) : au-dessous,
 * une pause passerait pour un mouvement lent ; au-dessus, un vrai mouvement
 * lent passerait pour une pause.
 */
const ML_TEMPO_ARRET=0.05;
/**
 * LE CREUX MINIMAL d'un point dur, en fraction du pic de vitesse. Sous 15 %,
 * ce n'est pas un point dur : c'est l'ondulation ordinaire d'une courbe de
 * vitesse lissée. Le cahier des charges le fixe, et il est cohérent avec le
 * bruit résiduel mesuré plus haut.
 */
const ML_CREUX_MIN=0.15;
/** La durée minimale d'une pause pour être comptée. Sous 80 ms, c'est le
 *  passage par zéro d'un changement de sens, pas une pause tenue. */
const ML_PAUSE_MIN_MS=80;

/**
 * PURE. L'axe principal d'un déplacement, par analyse en composantes
 * principales, orienté vers le point le plus éloigné du départ.
 *
 * ⚠ IL FAUT UN SIGNE. Le cahier des charges demande `v_tan = ‖dP/dt‖`, qui est
 * toujours positif : utilisable pour dire « ça va vite », inutilisable pour
 * dire « ça part » puis « ça revient ». Les phases ont besoin d'une direction.
 * On la prend sur l'axe principal du mouvement, orienté dans le sens où il
 * s'éloigne le plus — c'est le sens concentrique d'un écarté comme d'un tirage.
 *
 * @param {number[]} X  mètres
 * @param {number[]} Y  mètres
 * @returns {{ux:number, uy:number}|null}
 */
function mlAxePrincipal(X,Y){
  let n=0,sx=0,sy=0;
  for(let i=0;i<X.length;i++){ if(!isFinite(X[i])||!isFinite(Y[i])) continue; n++; sx+=X[i]; sy+=Y[i]; }
  if(n<3) return null;
  const mx=sx/n, my=sy/n;
  let cxx=0,cyy=0,cxy=0;
  for(let i=0;i<X.length;i++){
    if(!isFinite(X[i])||!isFinite(Y[i])) continue;
    const a=X[i]-mx, b=Y[i]-my;
    cxx+=a*a; cyy+=b*b; cxy+=a*b;
  }
  // Le vecteur propre de la plus grande valeur propre d'une matrice 2×2
  // symétrique, écrit en clair : pas de bibliothèque pour deux lignes.
  const tr=cxx+cyy, det=cxx*cyy-cxy*cxy;
  const disc=tr*tr/4-det;
  if(!(disc>=0)) return null;
  const l=tr/2+Math.sqrt(disc);
  let ux=cxy, uy=l-cxx;
  if(Math.abs(ux)<1e-12&&Math.abs(uy)<1e-12){ ux=l-cyy; uy=cxy; }
  const nn=Math.hypot(ux,uy);
  if(!(nn>0)) return null;
  ux/=nn; uy/=nn;
  // L'ORIENTATION : vers le point le plus loin du départ. Sans elle, le signe
  // de l'axe propre est arbitraire et le tempo s'inverserait d'une analyse à
  // l'autre.
  const x0=X.find(isFinite), y0=Y.find(isFinite);
  let loin=0, s=1;
  for(let i=0;i<X.length;i++){
    if(!isFinite(X[i])||!isFinite(Y[i])) continue;
    const p=(X[i]-(x0||0))*ux+(Y[i]-(y0||0))*uy;
    if(Math.abs(p)>loin){ loin=Math.abs(p); s=p>=0?1:-1; }
  }
  return {ux:ux*s,uy:uy*s};
}

/**
 * PURE. Les trois vitesses d'une trajectoire, en m/s.
 *  · `vv` : la VERTICALE, celle d'avant, conservée telle quelle ;
 *  · `vt` : le long du CHEMIN, `‖dP/dt‖`, toujours positive ;
 *  · `vp` : la PROJETÉE sur l'axe principal, signée — c'est elle qui porte les
 *    phases et le tempo quand le mouvement n'est pas vertical ;
 *  · `verticalite` : la part verticale du chemin, qui décide du basculement.
 *
 * @param {number[]} X  mètres
 * @param {number[]} Y  mètres
 * @param {number} dt  secondes
 * @param {number} [m]  demi-fenêtre de dérivée
 * @returns {{vx:number[], vv:number[], vt:number[], vp:number[], axe:{ux:number, uy:number}|null, verticalite:number}}
 */
function mlVitesses(X,Y,dt,m){
  const vx=mlDeriver(X,dt,m), vv=mlDeriver(Y,dt,m);
  const n=X.length;
  const vt=new Array(n).fill(NaN), vp=new Array(n).fill(NaN);
  const axe=mlAxePrincipal(X,Y);
  let chemin=0, vert=0;
  for(let i=0;i<n;i++){
    if(isFinite(vx[i])&&isFinite(vv[i])){
      vt[i]=Math.hypot(vx[i],vv[i]);
      if(axe) vp[i]=vx[i]*axe.ux+vv[i]*axe.uy;
    }
    if(i&&isFinite(X[i])&&isFinite(X[i-1])&&isFinite(Y[i])&&isFinite(Y[i-1])){
      chemin+=Math.hypot(X[i]-X[i-1],Y[i]-Y[i-1]);
      vert+=Math.abs(Y[i]-Y[i-1]);
    }
  }
  return {vx,vv,vt,vp,axe,verticalite:chemin>0?vert/chemin:1};
}

/**
 * PURE. LE TEMPO MESURÉ : excentrique, pause, concentrique, et le temps sous
 * tension. C'est la consigne la plus prescrite et la moins vérifiée du métier.
 *
 * Le découpage se fait aux CHANGEMENTS DE SIGNE de la vitesse signée, avec une
 * bande morte autour de zéro : ce qui est dedans est une pause, ce qui est
 * dessous est l'excentrique, ce qui est dessus le concentrique.
 *
 * ⚠ `complet:false` QUAND LA RÉPÉTITION EST TRONQUÉE par les bornes du
 * segment — c'est-à-dire quand ça bouge déjà à la première image ou encore à
 * la dernière. Dans ce cas L'ÉCRAN N'AFFICHE PAS DE TEMPO : un excentrique
 * commencé avant le début du segment donnerait un chiffre faux, et un chiffre
 * faux est plus difficile à défaire qu'une case vide.
 *
 * @param {{t:number[], v:number[]}} serie  vitesse SIGNÉE, positive en concentrique
 * @param {number} [seuil]  m/s, ML_TEMPO_ARRET par défaut
 * @returns {{excMs:number, pauseMs:number, conMs:number, tutMs:number, complet:boolean}}
 */
function mlTempo(serie,seuil){
  const t=(serie&&serie.t)||[], v=(serie&&serie.v)||[];
  const s=Number(seuil)>0?Number(seuil):ML_TEMPO_ARRET;
  const vide={excMs:0,pauseMs:0,conMs:0,tutMs:0,complet:false};
  if(t.length<3||v.length!==t.length) return vide;
  /** @param {number} x @returns {number} -1, 0 ou 1 */
  const sgn=(x)=>!isFinite(x)?0:(x>s?1:(x<-s?-1:0));
  let exc=0,pau=0,con=0;
  let pauseCourante=0;
  // ⚠ L’IMMOBILITÉ D’AVANT LE MOUVEMENT N’EST PAS UNE PAUSE. Un segment
  // découpé large commence par une seconde où l’athlète est en place et ne
  // bouge pas encore : la compter gonflerait le tempo d’autant, et le coach
  // lirait une pause qu’il n’a pas demandée.
  let commence=false;
  for(let i=1;i<t.length;i++){
    const d=t[i]-t[i-1];
    if(!(d>0)) continue;
    // Le signe du PAS, pris au milieu : un pas attribué à son extrémité
    // décalerait chaque frontière d'une demi-image.
    const a=sgn(v[i-1]), b=sgn(v[i]);
    const k=(a===b)?a:(Math.abs(v[i])>Math.abs(v[i-1])?b:a);
    if(k>0){ con+=d; if(commence&&pauseCourante) pau+=pauseCourante; pauseCourante=0; commence=true; }
    else if(k<0){ exc+=d; if(commence&&pauseCourante) pau+=pauseCourante; pauseCourante=0; commence=true; }
    else pauseCourante+=d;
  }
  // LA DERNIÈRE PAUSE N'EST PAS COMPTÉE : elle n'est pas tenue entre deux
  // phases, elle est simplement la fin du segment. Et une pause plus courte
  // que ML_PAUSE_MIN_MS est le passage par zéro d'un changement de sens.
  if(pau<ML_PAUSE_MIN_MS) pau=0;
  // TRONQUÉE ? Ça bougeait déjà à la première image, ou ça bougeait encore à
  // la dernière.
  /** @param {number} x @returns {boolean} */
  const calme=(x)=>isFinite(x)&&Math.abs(x)<=s;
  const premier=v.find(isFinite), dernier=v.slice().reverse().find(isFinite);
  const complet=calme(/** @type {number} */(premier))&&calme(/** @type {number} */(dernier))
    &&exc>0&&con>0;
  return {excMs:Math.round(exc),pauseMs:Math.round(pau),conMs:Math.round(con),
    tutMs:Math.round(exc+pau+con),complet};
}
/**
 * PURE. « 1,2 – 0,0 – 0,9 » : un tempo tel qu'il s'écrit et se compare.
 * @param {any} x @returns {string}
 */
function mlTempoTexte(x){
  if(!x||!x.complet) return '';
  const s=(/** @type {number} */ ms)=>(Math.round(ms/100)/10).toFixed(1).replace('.',',');
  return s(x.excMs)+' – '+s(x.pauseMs)+' – '+s(x.conMs);
}

/**
 * PURE. LE POINT DUR : le premier creux franc de la vitesse après le pic, dans
 * la phase concentrique. La courbe le contient déjà ; l'outil se contentait de
 * la dessiner.
 *
 * ⚠ IL N'EST PAS RENDU EN MILLISECONDES. Un coach ne règle rien avec « à
 * 340 ms » : il règle avec « à 78° de flexion, soit 22 % de l'amplitude ».
 * La conversion se fait dans mlSynthese, qui a les angles.
 *
 * @param {number[]} v  vitesse signée, positive en concentrique
 * @param {number} iPic  l'indice du pic
 * @returns {{i:number, creux:number, part:number}|null}
 */
function mlZoneFaiblesse(v,iPic){
  const p=Number(iPic);
  if(!Array.isArray(v)||!(p>=0)||p>=v.length) return null;
  const pic=v[p];
  if(!isFinite(pic)||!(pic>0)) return null;
  for(let i=p+1;i<v.length-1;i++){
    const a=v[i-1], b=v[i], c=v[i+1];
    if(!isFinite(a)||!isFinite(b)||!isFinite(c)) continue;
    // On s'arrête au retour à zéro : après, ce n'est plus le concentrique.
    if(b<=0) return null;
    if(!(b<=a&&b<=c)) continue;
    if(b===a&&b===c) continue;
    const creux=(pic-b)/pic;
    if(creux>=ML_CREUX_MIN) return {i,creux:Math.round(creux*1000)/1000,part:0};
  }
  return null;
}

/**
 * PURE. LA JOINTURE. La trajectoire vit à la cadence vidéo, la pose à douze
 * images par seconde, dans deux objets disjoints — aucune fonction ne répondait
 * à « quel angle de hanche au pic de vitesse ? ».
 *
 * Une seule base de temps : L'INSTANT VIDÉO, en millisecondes. Chaque phase de
 * la trajectoire y est rapprochée de l'échantillon de pose le plus proche, ET
 * ON DIT DE COMBIEN : un angle pris à 60 ms de la phase n'est pas l'angle de la
 * phase, et le coach doit pouvoir en juger.
 *
 * ⚠ ELLE NE LÈVE JAMAIS. Pose absente, barre absente, plages qui ne se
 * recouvrent qu'à moitié : chaque cas rend une ligne qui dit ce qui manque.
 *
 * @param {{t:number[], v:number[], ph:[string,number,number][], m?:any}|null} barre
 * @param {{t:number[], ang:Object<string,(number|null)[]>, hp:number|null}|null} pose
 * @param {{ecartMaxMs?:number, articulations?:string[]}} [options]
 * @returns {{phase:string, tMs:number, conf:number, vitesse:number|null,
 *   angles:Object<string,{deg:number, corrige:boolean, tol:number}|null>,
 *   ecartPoseMs:number|null, manque:string|null}[]}
 */
function mlSynthese(barre,pose,options){
  const o=options||{};
  // CENT MILLISECONDES : à douze images par seconde, deux échantillons de pose
  // sont à 83 ms l'un de l'autre. Au-delà d'un pas complet, l'angle rapproché
  // n'est plus celui de la phase.
  const ecartMax=Number(o.ecartMaxMs)>0?Number(o.ecartMaxMs):100;
  const arts=Array.isArray(o.articulations)&&o.articulations.length
    ?o.articulations:ML_ANGLES.map(q=>q.cle);
  /** @type {any[]} */
  const out=[];
  if(!barre||!Array.isArray(barre.ph)||!barre.ph.length) return out;
  const hp=pose&&pose.hp!=null&&isFinite(Number(pose.hp))?Number(pose.hp):undefined;
  for(const [cle,tMs,conf] of barre.ph){
    /** @type {any} */
    const ligne={phase:cle,tMs:Math.round(tMs),conf:Math.round(conf)||0,vitesse:null,
      angles:{},ecartPoseMs:null,manque:null};
    // La vitesse à cet instant, prise sur la base de temps de la trajectoire.
    if(Array.isArray(barre.t)&&Array.isArray(barre.v)&&barre.t.length===barre.v.length){
      let best=-1, d=Infinity;
      for(let i=0;i<barre.t.length;i++){
        const e=Math.abs(barre.t[i]-tMs);
        if(e<d&&isFinite(barre.v[i])){ d=e; best=i; }
      }
      if(best>=0) ligne.vitesse=Math.round(barre.v[best]*1000)/1000;
    }
    if(!pose||!Array.isArray(pose.t)||!pose.t.length){
      ligne.manque='pose';
      for(const a of arts) ligne.angles[a]=null;
      out.push(ligne);
      continue;
    }
    let k=-1, d=Infinity;
    for(let i=0;i<pose.t.length;i++){
      const e=Math.abs(pose.t[i]-tMs);
      if(e<d){ d=e; k=i; }
    }
    ligne.ecartPoseMs=k>=0?Math.round(d):null;
    if(k<0||d>ecartMax){
      // LES DEUX PLAGES NE SE RECOUVRENT PAS ICI. On ne rapproche pas un angle
      // d'une phase qu'il ne décrit pas.
      ligne.manque='hors-plage';
      for(const a of arts) ligne.angles[a]=null;
      out.push(ligne);
      continue;
    }
    let vus=0;
    for(const a of arts){
      const brut=(pose.ang[a]||[])[k];
      const c=mlCorrigerAngle(a,mlFlexion(a,brut==null?null:brut),hp);
      ligne.angles[a]=c;
      if(c) vus++;
    }
    if(!vus) ligne.manque='angles';
    out.push(ligne);
  }
  return out;
}

/**
 * PURE. LA TRAJECTOIRE ENREGISTRÉE, RELUE EN MÈTRES, avec ses trois vitesses.
 * C'est le point d'entrée unique des lots 9 à 14 : tout ce qui suit consomme
 * cette série-là, et rien d'autre.
 *
 * ⚠ ON RECALCULE LES VITESSES PLUTÔT QUE D'EN STOCKER DEUX DE PLUS. La
 * trajectoire garde ses positions ; deux tableaux d'entiers supplémentaires
 * pèseraient trois cents octets par répétition pour une information qui se
 * redérive exactement. Le budget de données ne bouge pas d'un octet.
 *
 * @param {any} b  une trajectoire passée par segBarreValide
 * @returns {{t:number[], X:number[], Y:number[], px:number[], py:number[], conf:number[],
 *   mpp:number, pasMs:number, vx:number[], vv:number[], vt:number[], vp:number[],
 *   axe:{ux:number, uy:number}|null, verticalite:number, mode:string, v:number[]}|null}
 */
function mlSerieRelue(b){
  if(!b||!(b.n>=2)) return null;
  const d=mlDecompacterBarre(b);
  // L'ÉCHELLE : l'étalon s'il a été posé, le disque sinon. C'est la même règle
  // qu'à l'analyse, et elle vaut mieux qu'un second chemin qui divergerait.
  const mpp=(b.etalon&&Number(b.etalon.px)>0)
    ?(Number(b.etalon.cm)/100)/Number(b.etalon.px)
    :Number(b.disqueM)/(2*Number(b.rayonPx));
  if(!(mpp>0)) return null;
  const px=d.x.map(v=>v*b.vw), py=d.y.map(v=>v*b.vh);
  // REDRESSÉ, comme à l'analyse : les points sont stockés dans le repère de
  // l'image, parce que c'est là qu'ils se dessinent.
  const th=Number(b.theta)||0;
  const r=th?mlRedresser(px,py,th):{X:px,Y:py};
  const x0=r.X.find(isFinite), y0=r.Y.find(isFinite);
  if(x0===undefined||y0===undefined) return null;
  const X=r.X.map(v=>(v-x0)*mpp), Y=r.Y.map(v=>(y0-v)*mpp);
  const V=mlVitesses(X,Y,b.pasMs/1000,mlDemiFenetre(b.pasMs));
  const mode=V.verticalite>=ML_VERTICALITE?'vertical':'chemin';
  return {t:d.t,X,Y,px:r.X,py:r.Y,conf:d.conf,mpp,pasMs:b.pasMs,
    vx:V.vx,vv:V.vv,vt:V.vt,vp:V.vp,axe:V.axe,verticalite:V.verticalite,mode,
    // LA VITESSE QUI PORTE LES PHASES ET LE TEMPO : la verticale pour une
    // charge verticale — donc pour toutes les analyses déjà enregistrées — et
    // la projection sur l'axe du mouvement pour le reste.
    v:mode==='vertical'?V.vv:V.vp};
}

// ══ LOT 10 — LE LEVIER ET LE COUPLE ═════════════════════════════════════════
//
// L'outil connaît la position de la charge et celle des articulations, à la
// même image. Il ne les soustrayait jamais : il mesurait des positions, jamais
// des sollicitations. C'est le manque central, et c'est le sujet.
//
// ⚠ « CHARGE EXTERNE SEULE », ÉCRIT PARTOUT OÙ UN N·m EST AFFICHÉ. Ni masse
// segmentaire, ni inertie, ni forces internes : ce couple-là est celui que la
// barre impose à l'articulation, pas celui que le muscle produit. Les deux ne
// se confondent pas, et l'écart n'est pas petit.

/** Sous cette couverture d'amplitude, aucun profil n'est affiché : un profil
 *  établi sur un tiers du mouvement n'est pas un profil. */
const ML_COUVERTURE_MIN=0.60;
/** Les deux frontières du profil, en part d'amplitude où tombe le pic. */
const ML_PROFIL_LONGUE=0.35;
const ML_PROFIL_COURTE=0.65;
/** g, pour passer d'une masse à un couple. */
const ML_G=9.81;

/**
 * PURE. La ligne d'action de la charge, normalisée.
 *  · charge libre : la gravité, `(0, −1)` dans le repère redressé ;
 *  · câble ou bras de machine : la direction des deux points posés par le
 *    coach, orientée du second vers le premier — c'est le sens dans lequel la
 *    charge tire.
 * @param {string} mode  'libre' ou 'cable'
 * @param {{x:number, y:number}} [p1]  pixels
 * @param {{x:number, y:number}} [p2]
 * @returns {{ux:number, uy:number, mode:string}}
 */
function mlLigneAction(mode,p1,p2){
  // PAR DÉFAUT LA CHARGE EST LIBRE. Le passage en câble est un geste explicite
  // du coach : deviner le mode fausserait tous les bras de levier d'un coup,
  // et dans le même sens.
  if(mode!=='cable'||!p1||!p2) return {ux:0,uy:-1,mode:'libre'};
  const dx=Number(p1.x)-Number(p2.x), dy=Number(p1.y)-Number(p2.y);
  const n=Math.hypot(dx,dy);
  if(!(n>0)) return {ux:0,uy:-1,mode:'libre'};
  return {ux:dx/n,uy:dy/n,mode:'cable'};
}
/**
 * PURE. LE BRAS DE LEVIER, en mètres : la distance de l'articulation à la
 * ligne d'action passant par la charge. C'est le déterminant 2D, qui se réduit
 * à la distance HORIZONTALE quand la charge est libre.
 * @param {{x:number, y:number}} Pcharge  pixels, repère redressé
 * @param {{x:number, y:number}} Particulation
 * @param {{ux:number, uy:number}} u
 * @param {number} mpp
 * @returns {number|null}
 */
function mlBrasLevier(Pcharge,Particulation,u,mpp){
  if(!Pcharge||!Particulation||!u||!(Number(mpp)>0)) return null;
  const dx=Number(Pcharge.x)-Number(Particulation.x), dy=Number(Pcharge.y)-Number(Particulation.y);
  if(!isFinite(dx)||!isFinite(dy)) return null;
  return Math.abs(dx*Number(u.uy)-dy*Number(u.ux))*Number(mpp);
}
/**
 * PURE. Le couple de la CHARGE EXTERNE SEULE, en N·m. Rend null sans masse :
 * un couple sans sa charge serait un chiffre sans unité déguisé en newton.
 * @param {number|null} brasM
 * @param {number|null|undefined} kg
 * @returns {number|null}
 */
function mlCouple(brasM,kg){
  const d=Number(brasM), m=Number(kg);
  if(!isFinite(d)||d<0||!isFinite(m)||!(m>0)) return null;
  return Math.round(m*ML_G*d*10)/10;
}
/**
 * PURE. LE PROFIL DE RÉSISTANCE : où, dans l'amplitude, la charge pèse le plus.
 * C'est la sortie principale du lot — elle reste valide même quand la charge
 * absolue est inconnue, parce qu'elle est normalisée.
 *
 * ⚠ LA COURBE EST UNE FONCTION DE L'ANGLE, PAS DU TEMPS. C'est ce qui la rend
 * superposable d'une machine à l'autre : deux athlètes ne mettent pas le même
 * temps, ils passent par les mêmes angles.
 *
 * @param {{amp:number[], tau:number[]}} serie  amp en % d'amplitude (0 à 100)
 * @returns {{pic:number, tauMax:number, classe:string, couverture:number, profil:{amp:number, tau:number}[]}|null}
 */
function mlProfilResistance(serie){
  const amp=(serie&&serie.amp)||[], tau=(serie&&serie.tau)||[];
  if(amp.length<3||amp.length!==tau.length) return null;
  /** @type {{amp:number, tau:number}[]} */
  const pts=[];
  for(let i=0;i<amp.length;i++){
    const a=Number(amp[i]), v=Number(tau[i]);
    if(!isFinite(a)||!isFinite(v)||a<0||a>100) continue;
    pts.push({amp:a,tau:v});
  }
  if(pts.length<3) return null;
  pts.sort((a,b)=>a.amp-b.amp);
  let tauMax=-Infinity, pic=0;
  for(const p of pts) if(p.tau>tauMax){ tauMax=p.tau; pic=p.amp; }
  if(!(tauMax>0)) return null;
  // LA COUVERTURE : en vingtièmes d'amplitude, la part réellement visitée. Des
  // points serrés au même endroit ne couvrent pas un mouvement.
  const cases=new Array(20).fill(false);
  for(const p of pts) cases[Math.min(19,Math.max(0,Math.floor(p.amp/5)))]=true;
  const couverture=cases.filter(Boolean).length/20;
  const part=pic/100;
  return {pic:Math.round(pic),tauMax:Math.round(tauMax*1000)/1000,
    classe:part<ML_PROFIL_LONGUE?'longue':(part>ML_PROFIL_COURTE?'courte':'cloche'),
    couverture:Math.round(couverture*100)/100,
    profil:pts.map(p=>({amp:Math.round(p.amp),tau:Math.round(p.tau/tauMax*1000)/1000}))};
}
/** Les trois classes, dites en français de coach. */
const ML_PROFIL_LIB=Object.freeze({
  longue:'la charge pèse le plus en position longue — profil descendant',
  cloche:'la charge pèse le plus au milieu de l’amplitude — profil en cloche',
  courte:'la charge pèse le plus en position courte — profil ascendant'});

// ══ LOT 11 — LE REPÈRE CORPOREL ═════════════════════════════════════════════
//
// La trajectoire est tracée dans le repère de l'IMAGE. Sur machine, ce qui se
// corrige n'est pas le trajet de la poignée dans la pièce : c'est son ARC
// AUTOUR DE L'ÉPAULE. Dans le repère de l'image, cette question n'a aucune
// représentation — et c'est pourtant la seule qui décide d'un réglage de siège.
//
// ⚠ ON NE DIT JAMAIS SI L'ARC EST BON. On le décrit. Le coach juge.

/**
 * PURE. Les positions d'une articulation dans le repère REDRESSÉ, en pixels.
 * @param {{t:number[], X:number[][], Y:number[][], V:number[][], cote:string}} serie  sortie de mlAnglesSerie
 * @param {string} nom  'epaule', 'hanche', 'genou'…
 * @param {number} vw @param {number} vh @param {number} theta
 * @returns {{t:number[], x:number[], y:number[], vis:number[]}|null}
 */
function mlPosePixels(serie,nom,vw,vh,theta){
  if(!serie||!Array.isArray(serie.t)) return null;
  const r=mlRangPose(nom,serie.cote);
  if(r==null) return null;
  const t=[], x=[], y=[], vis=[];
  for(let k=0;k<serie.t.length;k++){
    const bx=serie.X[k][r]*vw, by=serie.Y[k][r]*vh;
    const p=theta?mlRedresser([bx],[by],theta):{X:[bx],Y:[by]};
    t.push(serie.t[k]); x.push(p.X[0]); y.push(p.Y[0]); vis.push(serie.V[k][r]);
  }
  return {t,x,y,vis};
}
/**
 * PURE. LE TRACÉ POLAIRE AUTOUR D'UNE ARTICULATION : le levier du membre et
 * l'angle balayé. Superposable d'une répétition à l'autre et d'une machine à
 * l'autre — ce que la fiche du fabricant ne donne pas, parce qu'elle ne connaît
 * ni l'athlète ni son réglage de siège.
 *
 * @param {{t:number[], px:number[], py:number[], mpp:number}} barre  sortie de mlSerieRelue
 * @param {{t:number[], x:number[], y:number[], vis:number[]}|null} art  sortie de mlPosePixels
 * @param {number} [visMin]
 * @returns {{t:number[], rho:number[], phi:number[], rhoMin:number, rhoMax:number,
 *   conv:number, arc:number, n:number}|null}
 */
function mlRepereCorporel(barre,art,visMin){
  if(!barre||!art||!art.t.length||!barre.t.length) return null;
  const vm=Number(visMin)>0?Number(visMin):ML_POSE_VIS_MIN;
  const t=[], rho=[], phi=[];
  for(let i=0;i<barre.t.length;i++){
    if(!isFinite(barre.px[i])||!isFinite(barre.py[i])) continue;
    // L'ÉCHANTILLON DE POSE LE PLUS PROCHE : la pose vit à douze images par
    // seconde, la barre à la cadence vidéo. Au-delà d'un pas de pose, on ne
    // rapproche pas.
    let k=-1, d=Infinity;
    for(let j=0;j<art.t.length;j++){ const e=Math.abs(art.t[j]-barre.t[i]); if(e<d){ d=e; k=j; } }
    if(k<0||d>100||!(art.vis[k]>=vm)||!isFinite(art.x[k])||!isFinite(art.y[k])) continue;
    const dx=barre.px[i]-art.x[k], dy=barre.py[i]-art.y[k];
    t.push(barre.t[i]);
    rho.push(Math.hypot(dx,dy)*barre.mpp);
    // L'ANGLE EST PRIS SUR LA VERTICALE DESCENDANTE, dans le sens horaire de
    // l'image : c'est la convention de l'écran, et y a l'axe vers le bas.
    phi.push(Math.atan2(dx,dy)*180/Math.PI);
  }
  if(t.length<3) return null;
  let mn=Infinity, mx=-Infinity;
  for(const r of rho){ if(r<mn) mn=r; if(r>mx) mx=r; }
  // LA CONVERGENCE : de combien, et dans quel sens, l'arc tourne du début à la
  // fin. Mesurée sur l'athlète réel avec SON réglage de siège.
  let conv=phi[phi.length-1]-phi[0];
  while(conv>180) conv-=360;
  while(conv<-180) conv+=360;
  // L'ARC BALAYÉ : d'un extrême à l'autre. C'est lui que le coach lit —
  // la convergence d'un aller-retour complet vaut zéro, et ne dit rien.
  let pMin=Infinity, pMax=-Infinity;
  for(const q of phi){ if(q<pMin) pMin=q; if(q>pMax) pMax=q; }
  return {t,rho:rho.map(r=>Math.round(r*1000)/1000),phi:phi.map(p=>Math.round(p*10)/10),
    rhoMin:Math.round(mn*1000)/1000,rhoMax:Math.round(mx*1000)/1000,
    conv:Math.round(conv),arc:Math.round(pMax-pMin),n:t.length};
}

// ══ LOT 12 — LA SÉRIE : CE QUE LES RÉPÉTITIONS SE DISENT ENTRE ELLES ════════
//
// Jusqu'à vingt segments coexistent sur une vidéo, et aucun n'était jamais
// confronté aux autres. C'est la donnée la moins chère du lot et la plus
// parlante : sous fatigue, la durée d'une répétition plus que double, la
// vitesse chute, le pic arrive plus tôt, l'amplitude se réduit.
//
// ⚠ ON N'EN TIRE NI RIR, NI « PROXIMITÉ DE L'ÉCHEC », NI SCORE. On affiche la
// perte ; le coach conclut. Convertir une perte de vitesse en réserve de
// répétitions demande une relation charge-vitesse propre à l'athlète ET à
// l'exercice, que rien ici n'établit.

/**
 * PURE. Une ligne par répétition. Les répétitions NON ANALYSÉES apparaissent
 * en ligne vide, pas absentes : le coach doit voir qu'il en manque, sinon la
 * série qu'il lit n'est pas celle qu'il a filmée.
 *
 * @param {Segment[]} segments
 * @param {{cote?:string, articulation?:string}} [options]
 * @returns {{id:string, label:string, debutMs:number, analysee:boolean,
 *   vMax:number|null, amplitude:number|null, tempo:any, brasMax:number|null,
 *   angleFond:{deg:number, corrige:boolean, tol:number}|null, conf:number|null,
 *   tPicMs:number|null}[]}
 */
function mlTableauSerie(segments,options){
  const o=options||{};
  const art=o.articulation||'genou';
  /** @type {any[]} */
  const out=[];
  for(const s of (segments||[])){
    if(!s) continue;
    /** @type {any} */
    const l={id:s.id,label:s.label||'',debutMs:s.debutMs,analysee:false,
      vMax:null,amplitude:null,tempo:null,brasMax:null,angleFond:null,conf:null,tPicMs:null};
    const b=s.barre;
    if(b){
      const r=mlSerieRelue(b);
      if(r){
        l.analysee=true;
        let mx=-Infinity, iMx=-1, yMin=Infinity, yMax=-Infinity;
        for(let i=0;i<r.t.length;i++){
          if(isFinite(r.v[i])&&r.v[i]>mx){ mx=r.v[i]; iMx=i; }
          if(isFinite(r.Y[i])){ if(r.Y[i]<yMin) yMin=r.Y[i]; if(r.Y[i]>yMax) yMax=r.Y[i]; }
        }
        if(iMx>=0){ l.vMax=Math.round(mx*1000)/1000; l.tPicMs=Math.round(r.t[iMx]); }
        // L'AMPLITUDE EST CELLE DU CHEMIN, pas de la hauteur : sur un écarté,
        // la hauteur ne dit rien et le chemin dit tout.
        if(r.mode==='vertical'&&isFinite(yMin)&&isFinite(yMax)) l.amplitude=Math.round((yMax-yMin)*1000)/1000;
        else {
          let a=-Infinity,z=Infinity;
          for(let i=0;i<r.t.length;i++){
            if(!isFinite(r.X[i])||!isFinite(r.Y[i])||!r.axe) continue;
            const p=r.X[i]*r.axe.ux+r.Y[i]*r.axe.uy;
            if(p>a) a=p; if(p<z) z=p;
          }
          if(isFinite(a)&&isFinite(z)) l.amplitude=Math.round((a-z)*1000)/1000;
        }
        const mt=b.m||{};
        l.tempo=(mt.tExc!=null&&mt.tCon!=null)
          ?{excMs:mt.tExc,pauseMs:mt.tPau||0,conMs:mt.tCon,
            tutMs:mt.tExc+(mt.tPau||0)+mt.tCon,complet:true}
          :mlTempo({t:r.t,v:r.v});
        let c=0,n=0;
        for(const q of r.conf){ if(isFinite(q)){ c+=q; n++; } }
        l.conf=n?Math.round(100*c/n):null;
      }
    }
    if(s.pose){
      try{
        const sp=mlAnglesSerie(s.pose,o.cote);
        const met=mlMetriquesAngles(sp);
        const m=met[art];
        if(m) l.angleFond=mlCorrigerAngle(art,mlFlexion(art,m.min),sp.hp==null?undefined:sp.hp);
      }catch(e){}
    }
    out.push(l);
  }
  return out;
}
/**
 * PURE. LES DEUX PERTES : de la MEILLEURE répétition à la DERNIÈRE, jamais de
 * la première à la dernière. La première est souvent la moins bonne — reprise
 * de marques, mise en place — et la comparer fait apparaître des gains là où
 * il n'y a qu'un échauffement.
 * @param {{analysee:boolean, vMax:number|null, amplitude:number|null}[]} lignes
 * @returns {{vitesse:number|null, amplitude:number|null, iMeilleure:number, iDerniere:number}|null}
 */
function mlPertesSerie(lignes){
  const l=(lignes||[]).map((x,i)=>({x,i})).filter(q=>q.x&&q.x.analysee&&q.x.vMax!=null);
  if(l.length<2) return null;
  let best=l[0];
  for(const q of l) if((q.x.vMax||0)>(best.x.vMax||0)) best=q;
  const last=l[l.length-1];
  if(best.i===last.i) return null;
  const vB=Number(best.x.vMax), vD=Number(last.x.vMax);
  const aB=best.x.amplitude, aD=last.x.amplitude;
  return {
    vitesse:(vB>0)?Math.round((vD-vB)/vB*1000)/10:null,
    amplitude:(aB!=null&&aD!=null)?Math.round((aD-aB)*1000)/10:null,
    iMeilleure:best.i,iDerniere:last.i};
}

// ══ LOT 13 — LES PROPORTIONS MESURÉES SUR LA VIDÉO ══════════════════════════
//
// ⚠ EN RAPPORTS, JAMAIS EN CENTIMÈTRES. L'incertitude d'une longueur absolue
// lue sur une image est trop grande ; celle d'un rapport se compense en partie,
// parce que les deux segments sont vus sous la même projection, à la même
// échelle, avec la même erreur d'échelle — qui disparaît dans la division.
//
// ⚠ ENVERGURE/TAILLE N'EST PAS RENDU, ET C'EST DÉLIBÉRÉ. L'envergure se mesure
// (poignet à poignet), la taille non : MediaPipe ne donne pas le sommet du
// crâne, seulement le nez, les yeux et les oreilles. Combler l'écart
// demanderait un coefficient crâne/stature que ce dépôt ne peut pas sourcer.
// C'est la même raison qui interdit les centimètres sur une photo, côté morpho.
//
// ⚠ UN RAPPORT N'EST PAS UN DÉFAUT. La phrase qui l'accompagne est MÉCANIQUE —
// « à profondeur égale, ton buste s'incline davantage » — jamais une
// recommandation d'exercice, jamais un morphotype, jamais un jugement.

/** Debout : genou et hanche quasi tendus. En dessous, les segments sont vus
 *  raccourcis par la projection et le rapport se met à dériver. */
const ML_DEBOUT_MIN=160;
/** Sous vingt images utilisables, l'écart-type ne veut rien dire. */
const ML_PROP_N_MIN=20;
/** Les rapports rendus, et ce qu'ils changent — en mécanique, pas en conseil. */
const ML_PROPORTIONS=Object.freeze([
  {cle:'femur_tibia',lib:'Cuisse sur jambe',a:['hanche','genou'],b:['genou','cheville'],
   haut:'Cuisse longue par rapport à la jambe : à profondeur égale, le genou avance moins et le buste s’incline davantage.',
   bas:'Jambe longue par rapport à la cuisse : le genou peut avancer davantage, et le buste reste plus droit à profondeur égale.'},
  {cle:'femur_tronc',lib:'Cuisse sur tronc',a:['hanche','genou'],b:['epaule','hanche'],
   haut:'Cuisse longue par rapport au tronc : le bassin recule davantage à la descente, et le bras de levier de hanche augmente.',
   bas:'Tronc long par rapport à la cuisse : le buste reste plus droit à profondeur égale, et le bras de levier s’allonge dès que la hanche se ferme.'},
  {cle:'humerus_avantbras',lib:'Bras sur avant-bras',a:['epaule','coude'],b:['coude','poignet'],
   haut:'Bras long par rapport à l’avant-bras : la course de la barre s’allonge en poussée, et l’ouverture de coude nécessaire augmente.',
   bas:'Avant-bras long par rapport au bras : le levier change au curl, et la position de coude en tirage avec lui.'}
]);

/**
 * PURE. Les proportions mesurées sur les images DEBOUT et bien vues.
 * Rendues avec leur écart-type et leur nombre d'images : un rapport sans sa
 * dispersion ne se lit pas.
 *
 * @param {{t:number[], X:number[][], Y:number[][], V:number[][], ang:Object<string,(number|null)[]>, cote:string, theta:number}} serie
 * @param {number} vw @param {number} vh
 * @param {number} [visMin]
 * @returns {{cle:string, lib:string, valeur:number, ecartType:number, n:number, phrase:string}[]}
 */
function mlProportions(serie,vw,vh,visMin){
  /** @type {any[]} */
  const out=[];
  if(!serie||!Array.isArray(serie.t)||!serie.t.length) return out;
  const vm=Number(visMin)>0?Number(visMin):ML_HORIZON_VIS;
  const th=Number(serie.theta)||0;
  /** @param {string} nom @param {number} k */
  const pt=(nom,k)=>{
    const r=mlRangPose(nom,serie.cote);
    if(r==null) return null;
    if(!(serie.V[k][r]>=vm)) return null;
    const x=serie.X[k][r]*vw, y=serie.Y[k][r]*vh;
    if(!isFinite(x)||!isFinite(y)) return null;
    const p=th?mlRedresser([x],[y],th):{X:[x],Y:[y]};
    return {x:p.X[0],y:p.Y[0]};
  };
  /** @param {string[]} seg @param {number} k */
  const lg=(seg,k)=>{
    const a=pt(seg[0],k), b=pt(seg[1],k);
    if(!a||!b) return null;
    const d=Math.hypot(a.x-b.x,a.y-b.y);
    return d>1?d:null;
  };
  // LES IMAGES DEBOUT : genou tendu. Un membre plié est vu raccourci, et le
  // raccourcissement n'est pas le même sur les deux segments du rapport.
  const debout=[];
  for(let k=0;k<serie.t.length;k++){
    const g=(serie.ang['genou']||[])[k];
    if(g!=null&&isFinite(g)&&g>=ML_DEBOUT_MIN) debout.push(k);
  }
  for(const d of ML_PROPORTIONS){
    const vals=[];
    for(const k of debout){
      const a=lg(d.a,k), b=lg(d.b,k);
      if(a==null||b==null) continue;
      vals.push(a/b);
    }
    if(vals.length<ML_PROP_N_MIN) continue;
    const moy=vals.reduce((s,x)=>s+x,0)/vals.length;
    const va=vals.reduce((s,x)=>s+(x-moy)*(x-moy),0)/vals.length;
    const et=Math.sqrt(va);
    // ⚠ PAS DE PHRASE SANS REPÈRE. On ne dit « longue » ou « courte » que
    // quand un repère calibré existe côté morpho ; ici on rend la valeur et sa
    // dispersion, et c'est morphoAxes qui la situe. Voir le lot M2.
    out.push({cle:d.cle,lib:d.lib,valeur:Math.round(moy*1000)/1000,
      ecartType:Math.round(et*1000)/1000,n:vals.length,phrase:''});
  }
  return out;
}
/**
 * PURE. La phrase MÉCANIQUE d'un rapport, une fois qu'un repère l'a situé.
 * `position` vient de morphoAxes ; sans lui, on ne dit rien.
 * @param {string} cle @param {string|null} position
 * @returns {string}
 */
function mlProportionPhrase(cle,position){
  const d=ML_PROPORTIONS.find(q=>q.cle===cle);
  if(!d||(position!=='haut'&&position!=='bas')) return '';
  return position==='haut'?d.haut:d.bas;
}

/**
 * PURE. LE PONT. Une répétition entre, tout ce que les lots 9 à 13 savent en
 * sort — et chaque manque est nommé plutôt que tu.
 *
 * C'est ici, et nulle part ailleurs, que la position de la charge et celle de
 * l'articulation sont enfin SOUSTRAITES. Tout le reste du module mesurait des
 * positions ; celui-ci mesure une sollicitation.
 *
 * @param {Segment} seg
 * @param {{cote?:string, articulation?:string, chargeKg?:number|null, prescrit?:string}} [options]
 * @returns {{r:any, sp:any, u:any, profil:any, angleZone:any, couple:any,
 *   synthese:any[], tempo:any, zone:any, repere:any, manque:string[]}}
 */
function mlLireRepetition(seg,options){
  const o=options||{};
  const art=o.articulation||'hanche';
  /** @type {any} */
  const out={r:null,sp:null,u:null,profil:null,angleZone:null,couple:null,
    synthese:[],tempo:null,zone:null,repere:null,manque:[]};
  if(!seg) return out;
  const b=seg.barre;
  if(!b){ out.manque.push('trajectoire'); return out; }
  const r=mlSerieRelue(b);
  if(!r){ out.manque.push('trajectoire'); return out; }
  out.r=r;
  // LE TEMPO MESURÉ À L'ANALYSE s'il a été rangé — il vaut mieux que celui
  // qu'on redériverait de cent cinquante points. Le second reste le repli
  // pour les analyses d'avant le lot 9.
  const mt=b.m||{};
  out.tempo=(mt.tExc!=null&&mt.tCon!=null)
    ?{excMs:mt.tExc,pauseMs:mt.tPau||0,conMs:mt.tCon,tutMs:mt.tExc+(mt.tPau||0)+mt.tCon,complet:true}
    :mlTempo({t:r.t,v:r.v});
  // LE POINT DUR, cherché après le pic de la vitesse signée.
  let iPic=-1, mx=-Infinity;
  for(let i=0;i<r.v.length;i++) if(isFinite(r.v[i])&&r.v[i]>mx){ mx=r.v[i]; iPic=i; }
  if(iPic>=0) out.zone=mlZoneFaiblesse(r.v,iPic);
  // LA LIGNE D'ACTION : celle que le coach a posée, la gravité sinon.
  const act=b.act&&typeof b.act==='object'?b.act:null;
  out.u=(act&&act.mode==='cable')
    ?mlLigneAction('cable',{x:act.x1,y:act.y1},{x:act.x2,y:act.y2})
    :mlLigneAction('libre');
  if(!seg.pose){ out.manque.push('articulations'); return out; }
  /** @type {any} */
  let sp=null;
  try{ sp=mlAnglesSerie(seg.pose,o.cote); }catch(e){ sp=null; }
  if(!sp){ out.manque.push('articulations'); return out; }
  out.sp=sp;
  out.synthese=mlSynthese({t:r.t,v:r.v,ph:/** @type {any} */(b.ph)||[]},sp,{articulations:[art]});
  const pp=mlPosePixels(sp,art==='tronc'?'epaule':art,b.vw,b.vh,Number(b.theta)||0);
  if(!pp){ out.manque.push('articulation-absente'); return out; }
  out.repere=mlRepereCorporel(r,pp);
  // ── LE BRAS DE LEVIER, IMAGE PAR IMAGE, ET LE PROFIL QUI EN SORT.
  //    L'AMPLITUDE EST CELLE DE L'ANGLE, pas du temps : c'est ce qui rend deux
  //    machines superposables.
  const ang=sp.ang[art]||[];
  let aMin=Infinity, aMax=-Infinity;
  for(const x of ang) if(x!=null&&isFinite(x)){ if(x<aMin) aMin=x; if(x>aMax) aMax=x; }
  const parAngle=isFinite(aMin)&&isFinite(aMax)&&aMax-aMin>5;
  const amp=[], tau=[], tms=[];
  let axeMin=Infinity, axeMax=-Infinity;
  if(!parAngle){
    for(let i=0;i<r.t.length;i++){
      if(!isFinite(r.X[i])||!isFinite(r.Y[i])||!r.axe) continue;
      const p=r.X[i]*r.axe.ux+r.Y[i]*r.axe.uy;
      if(p<axeMin) axeMin=p; if(p>axeMax) axeMax=p;
    }
  }
  for(let i=0;i<r.t.length;i++){
    if(!isFinite(r.px[i])||!isFinite(r.py[i])) continue;
    let k=-1, d=Infinity;
    for(let j=0;j<pp.t.length;j++){ const e=Math.abs(pp.t[j]-r.t[i]); if(e<d){ d=e; k=j; } }
    if(k<0||d>100||!(pp.vis[k]>=ML_POSE_VIS_MIN)) continue;
    const bras=mlBrasLevier({x:r.px[i],y:r.py[i]},{x:pp.x[k],y:pp.y[k]},out.u,r.mpp);
    if(bras==null) continue;
    let a=null;
    if(parAngle){
      const x=ang[k];
      if(x==null||!isFinite(x)) continue;
      a=(x-aMin)/(aMax-aMin)*100;
    } else {
      if(!r.axe||!isFinite(axeMin)||!(axeMax-axeMin>0)) continue;
      a=((r.X[i]*r.axe.ux+r.Y[i]*r.axe.uy)-axeMin)/(axeMax-axeMin)*100;
    }
    amp.push(a); tau.push(bras); tms.push(r.t[i]);
  }
  out.profil=mlProfilResistance({amp,tau});
  if(out.profil){
    // L'INSTANT ET L'ANGLE DU PIC : la phrase de tête les porte, et la vidéo
    // doit pouvoir y aller d'une touche.
    let best=-1, m2=-Infinity;
    for(let i=0;i<amp.length;i++) if(tau[i]>m2){ m2=tau[i]; best=i; }
    if(best>=0){
      out.profil.tMs=tms[best];
      out.profil.brasMax=Math.round(tau[best]*1000)/1000;
      let k=-1, d=Infinity;
      for(let j=0;j<sp.t.length;j++){ const e=Math.abs(sp.t[j]-tms[best]); if(e<d){ d=e; k=j; } }
      if(k>=0) out.angleZone=mlCorrigerAngle(art,mlFlexion(art,(ang[k]==null?null:ang[k])),
        sp.hp==null?undefined:sp.hp);
      const kg=Number(o.chargeKg);
      out.couple={kg:isFinite(kg)&&kg>0?kg:null,nm:mlCouple(tau[best],kg)};
    }
  } else out.manque.push('profil');
  return out;
}

// ══ LOT 14 — LA LECTURE ═════════════════════════════════════════════════════
//
// C'est ce qui décide seul de l'adoption. Un bandeau de compteurs se regarde
// une fois ; trois phrases se lisent, se cliquent, et entrent dans la
// correction. Le reste ne disparaît pas — il descend d'un cran.
//
// ⚠ FORME IMPOSÉE, ET ELLE N'EST PAS DÉCORATIVE : un fait, sa valeur, sa
// tolérance, son ancrage temporel. Jamais un impératif, jamais un score.
//
// ⚠ CHAQUE PHRASE A SA VERSION « PAS MESURABLE », qui dit POURQUOI et CE QU'IL
// FAUDRAIT FAIRE. C'est la moitié de la valeur de l'outil : un coach qui ne
// comprend pas pourquoi l'écran se tait cesse de l'ouvrir.

/**
 * LES LIBELLÉS DE PHASE, SELON LE CONTEXTE. Les CLÉS ne changent pas — les
 * analyses déjà enregistrées doivent rester lisibles — seuls les libellés
 * suivent le vocabulaire du geste.
 *
 * Le contexte se MESURE, il ne se règle pas : une réception n'existe qu'en
 * haltérophilie, où la barre est rattrapée. Sans elle, on est en musculation,
 * et « point le plus haut » s'y dit « position courte ».
 */
const ML_PHASES_LIB_MUSCU=Object.freeze({depart:'Début du concentrique',
  pic_vitesse:'Pic de vitesse',point_haut:'Position courte',
  reception:'Début de l’excentrique',point_bas:'Position longue'});
/**
 * PURE. Le jeu de libellés qui convient à ces phases-là.
 * @param {[string,number,number][]} ph
 * @returns {Object<string,string>}
 */
function mlPhasesLib(ph){
  const halt=(ph||[]).some(p=>Array.isArray(p)&&p[0]==='reception');
  return halt?ML_PHASES_LIB:ML_PHASES_LIB_MUSCU;
}
/**
 * PURE. La convention d'angle, écrite pour l'écran. Elle y est parce qu'un
 * coach qui lit « hanche 78° » sans savoir si c'est l'angle intérieur ou la
 * flexion lit un chiffre au hasard.
 */
/** Le déterminant de chaque articulation. Sans lui, l'écran dit « sur la
 *  coude » — et une phrase mal écrite fait douter du chiffre qu'elle porte. */
const ML_ART_DET=Object.freeze({coude:'le ',epaule:'l’',hanche:'la ',genou:'le ',
  cheville:'la ',tronc:'le ',avantBras:'l’'});
/** PURE. Un nombre écrit en français. @param {any} x @returns {string} */
function _mlVirgule(x){ return String(x).replace('.',','); }
/** PURE. Un écart signé, avec le VRAI signe moins et la virgule. @param {any} x @returns {string} */
function mlSigne(x){
  const v=Number(x);
  if(!isFinite(v)) return '—';
  return (v>0?'+':(v<0?'\u2212':''))+_mlVirgule(Math.abs(v));
}
const ML_CONVENTION='Les angles sont des FLEXIONS : genou tendu 0°, plié à angle droit 90°. '
  +'Le tronc et l’avant-bras portent une INCLINAISON sur la verticale, pas une flexion.';

/**
 * PURE. LES TROIS PHRASES DE TÊTE. Chacune rend soit un fait complet, soit la
 * raison précise pour laquelle il manque et le geste qui le débloquerait.
 *
 * @param {{profil?:any, synthese?:any[], articulation?:string, tempo?:any,
 *   prescrit?:string, pertes?:any, couple?:{kg:number|null, nm:number|null},
 *   serie?:any, zone?:any, angleZone?:any}} ctx
 * @returns {{cle:string, texte:string, tMs:number|null, mesurable:boolean}[]}
 */
function mlPhrases(ctx){
  const c=ctx||{};
  /** @type {any[]} */
  const out=[];
  const art=c.articulation||'hanche';
  const nomArt=(ML_ANGLES.find(q=>q.cle===art)||{nom:art}).nom.toLowerCase();

  // ── 1. OÙ LA CHARGE PÈSE LE PLUS.
  if(c.profil&&c.profil.couverture>=ML_COUVERTURE_MIN){
    const a=c.angleZone;
    const nm=c.couple&&c.couple.nm!=null
      ?', '+_mlVirgule(c.couple.nm)+' N·m à ce point (charge externe seule)':'';
    const det=/** @type {Object<string,string>} */(ML_ART_DET)[art]||'la ';
    out.push({cle:'profil',mesurable:true,tMs:c.profil.tMs==null?null:Math.round(c.profil.tMs),
      texte:'Le couple sur '+det+nomArt+' culmine'
        +(a?' à '+a.deg+'° de '+(art==='tronc'||art==='avantBras'?'inclinaison':'flexion')
          +' (±'+a.tol+'°)':'')
        +', soit à '+c.profil.pic+' % de l’amplitude'+nm+' : '
        +(/** @type {Object<string,string>} */(ML_PROFIL_LIB)[c.profil.classe]||'')+'.'});
  } else {
    out.push({cle:'profil',mesurable:false,tMs:null,
      texte:c.profil
        ?'Pas de profil de résistance : le mouvement n’est vu que sur '
          +Math.round(c.profil.couverture*100)+' % de son amplitude, et il en faut au moins '
          +Math.round(ML_COUVERTURE_MIN*100)+' %. Reprends le découpage de la répétition, '
          +'du tout début à la toute fin.'
        :'Pas de profil de résistance : il faut la trajectoire ET les articulations sur la '
          +'même répétition. Lance l’analyse des articulations après celle de la barre.'});
  }

  // ── 2. LE TEMPO.
  if(c.tempo&&c.tempo.complet){
    out.push({cle:'tempo',mesurable:true,tMs:null,
      texte:'Tempo mesuré '+mlTempoTexte(c.tempo)
        +(c.prescrit?' pour un '+c.prescrit+' prescrit':'')
        +' · '+(Math.round(c.tempo.tutMs/100)/10).toFixed(1).replace('.',',')
        +' s sous tension.'});
  } else {
    out.push({cle:'tempo',mesurable:false,tMs:null,
      texte:c.tempo
        ?'Pas de tempo : la répétition est tronquée par les bornes du segment — ça bougeait '
          +'déjà à la première image, ou encore à la dernière. Élargis les bornes de quelques '
          +'dixièmes de seconde de chaque côté.'
        :'Pas de tempo : la trajectoire n’a pas été analysée sur cette répétition.'});
  }

  // ── 3. CE QUE LA SÉRIE A PERDU.
  if(c.pertes&&c.pertes.vitesse!=null){
    const a=c.pertes.amplitude;
    out.push({cle:'serie',mesurable:true,tMs:null,
      texte:'De la meilleure à la dernière répétition : '
        +mlSigne(c.pertes.vitesse)+' % de vitesse'
        +(a!=null?', '+mlSigne(a)+' cm d’amplitude':'')+'.'});
  } else {
    out.push({cle:'serie',mesurable:false,tMs:null,
      texte:'Pas de comparaison de série : il faut au moins deux répétitions analysées sur '
        +'cette vidéo. Découpe-en une seconde et lance son analyse.'});
  }
  return out;
}

// ══ LA REFONTE — LES ANNOTATIONS ═════════════════════════════════════════════
//
// Kevin, 21/09/2026 : « Motion Lab doit devenir le véritable laboratoire
// d'analyse technique de RepCore ». Le coach montre à l'athlète « ce que tu
// fais », « ce que je veux que tu fasses », « ce que tu dois corriger » : des
// tracés posés sur l'image, chacun avec son nom, sa couleur, son épaisseur et
// sa durée d'apparition, une légende, et une timeline où ils se déplacent.
//
// LE MODÈLE VIT DANS index.html (annotValide, enregistrerAnnotationsVideo) : le
// lecteur de l'athlète les valide à l'ouverture de l'application. Ce module
// les ÉDITE et les DESSINE — le même dessin chez le coach et chez l'athlète,
// parce que c'est le même code.
//
// ⚠ NON DESTRUCTIF : rien ne touche la vidéo. « Version originale » éteint le
// calque, et c'est tout.

/** @typedef {'ligne'|'fleche'|'libre'|'courbe'|'cercle'|'rect'|'angle'|'point'|'texte'|'zone'} TypeAnnot */
/** @typedef {'selection'|'gomme'|'echelle'|TypeAnnot} OutilMl */
/**
 * Un tracé. Les points sont normés sur l'image (0 à 1000 en largeur ET en
 * hauteur), en texte « x,y x,y » — le format des traits de la correction.
 * `mo` : le décalage de sa MESURE déplacée au double-clic, comme `eo` pour
 * son étiquette.
 * @typedef {{id:string, n:string, t:TypeAnnot, c:string, e:number, d:number, f:number, p:string,
 *   k?:[number,string][], x?:string, ts?:string, tf?:number, tc?:number, cb?:number,
 *   lb?:string[], rel?:number, et?:number, lg?:number, h?:number, seg?:string, st?:string, eo?:number[],
 *   tp?:string, mo?:number[]}} Annot
 */
/**
 * L'ÉCHELLE DE LA VIDÉO (build 1391) : le haut et le bas d'un disque (`p`,
 * deux points normés), son diamètre réel en millimètres (`mm`), d'où il vient
 * (`src` : « id de gamme|charge », ou « mesure|marque|charge »), et `ok`
 * quand le coach l'a enregistrée — le tracé quitte alors l'image, la donnée
 * reste pour les calculs.
 * @typedef {{p:string, mm?:number, src?:string, ok?:number}} Echelle
 */
/**
 * Le bord d'un disque trouvé seul (build 1393), en pixels de la vidéo (w × h),
 * pour l'échelle `p` qu'il a posée : dessiné tant que l'échelle n'a pas bougé.
 * @typedef {{p:string, cx:number, cy:number, a:number, b:number, ux:number, uy:number, w:number, h:number,
 *   couverture:number, residu:number}} EllipseTrouvee
 */
/**
 * Une étiquette, une mesure ou la légende qu'on déplace : ce qui bouge
 * (`kind` 'etiq', 'mes' ou 'leg'), le tracé s'il s'agit d'une étiquette ou
 * d'une mesure, le document d'avant (pour Échap et l'historique), et l'écart
 * entre le doigt et le coin saisi.
 * @typedef {{kind:string, id:string, avant:string, grab:number[]}} DeplEtiq
 */
/**
 * Le tracé en cours de pose. `clic` : commencé d'un clic sans glisser, il
 * attend le clic d'arrivée. `d0` : l'instant du premier toucher — c'est lui
 * qui ouvre la durée du tracé, surtout quand la vidéo tourne pendant le geste.
 * @typedef {{t:TypeAnnot, pts:number[][], lb?:string[], clic?:boolean, d0?:number}} TraceEnCours
 */
/** @typedef {{on:number, titre:string, pos:string, taille:string, fond:string, op:number, x?:number, y?:number}} Legende */
/** @typedef {{v:1, majLe:number, leg:Legende, a:Annot[], ech?:Echelle}} DocAnnot */
/** @typedef {{t:TypeAnnot, c:string, n:string}} EtapeModele */
/** @typedef {{nom:string, ico:string, titre:string, etapes:EtapeModele[], comparer?:boolean}} ModeleAnnot */
/**
 * Le rectangle de l'image dans l'élément qui la montre, et l'échelle.
 * @typedef {{s:number, ox:number, oy:number, vw:number, vh:number}} RectImage
 */

// LES SEPT COULEURS RAPIDES, et ce qu'elles veulent dire par défaut. Le coach
// réécrit le sens dans « Réglages » : il sert de nom au tracé qu'on pose.
const ML_PALETTE=Object.freeze([
  {c:'#ff3b3b',nom:'Rouge',sens:'Erreur'},
  {c:'#22c55e',nom:'Vert',sens:'Correction'},
  {c:'#3b82f6',nom:'Bleu',sens:'Repère anatomique'},
  {c:'#facc15',nom:'Jaune',sens:'Point d’attention'},
  {c:'#fb923c',nom:'Orange',sens:''},
  {c:'#a855f7',nom:'Violet',sens:''},
  {c:'#ffffff',nom:'Blanc',sens:'Repère neutre'}]);
// LES OUTILS, dans l'ordre de la boîte. `r` est le raccourci clavier.
// ⚠ L'ÉCHELLE A PRIS LA PLACE DU RECTANGLE (build 1391, Kevin : « on remplace
//   le rectangle par une fonction échelle »). Le TYPE 'rect' reste lisible et
//   dessiné : des corrections déjà envoyées en portent, et l'athlète doit les
//   revoir telles quelles. Seul l'outil qui en pose de nouveaux disparaît.
/** @type {ReadonlyArray<{o:OutilMl, lib:string, r:string}>} */
const ML_OUTILS=Object.freeze([
  {o:'selection',lib:'Sélection',r:'v'},{o:'ligne',lib:'Ligne',r:'l'},{o:'fleche',lib:'Flèche',r:'f'},
  {o:'libre',lib:'Trajectoire',r:'t'},{o:'courbe',lib:'Courbe',r:'u'},{o:'cercle',lib:'Cercle',r:'c'},
  {o:'echelle',lib:'Échelle',r:'r'},{o:'angle',lib:'Angle',r:'a'},{o:'point',lib:'Point',r:'p'},
  {o:'texte',lib:'Texte',r:'x'},{o:'zone',lib:'Zone',r:'z'},{o:'gomme',lib:'Gomme',r:'e'}]);
/** @type {Object<string,string>} */
const ML_TYPE_LIB=Object.freeze({ligne:'Ligne',fleche:'Flèche',libre:'Trajectoire',courbe:'Courbe',
  cercle:'Cercle',rect:'Rectangle',angle:'Angle',point:'Repère',texte:'Texte',zone:'Zone'});
// ══ LES DISQUES DE L'ÉCHELLE (build 1391) ══════════════════════════════════
//
// Kevin, 22/09/2026 : « on part sur les disques, il me faudrait les
// différentes marques et la taille selon la charge ». Le coach pose le haut et
// le bas d'un disque sur l'image, choisit ce disque ici, et son diamètre donne
// les centimètres de tout le reste.
//
// ⚠ CHAQUE COTE VIENT D'UNE FICHE LUE, relevée le 22/09/2026. Rien n'est
//   déduit d'une autre marque ni d'une autre charge : « 450 mm » n'est garanti
//   que par la norme IWF des bumpers à partir de 10 kg (± 1 mm), et par la
//   norme IPF pour les 20 et 25 kg en acier. Ailleurs la même charge change de
//   taille — le 10 kg va de 316 à 450 mm selon la marque, et le 45 lb Hammer
//   Strength fait 432 mm, pas 450. Le 5 kg Eleiko XF fait 320 mm : un résumé
//   de recherche le donnait à 450, la fiche Eleiko dit 320.
// ⚠ PANATTA (hors Powerlifting Pro), TECHNOGYM, MATRIX ET HAMMER STRENGTH EN
//   KG NE PUBLIENT PAS LEURS DIAMÈTRES. Aucun chiffre n'est posé pour eux : le
//   coach mesure une fois au mètre ruban, et RepCore s'en souvient. Un
//   diamètre inventé fausserait en silence chaque centimètre de la vidéo.
// ⚠ SAUF TECHNOGYM, RELEVÉ PAR KEVIN (build 1394, 22/09/2026) : « poids
//   techno 20 kg 46 cm, 10 kg 32 cm, 5 kg 24 cm, 2,5 kg 20 cm et 1,25 kg
//   16,5 cm ». C'est UNE MESURE, PAS UNE FICHE : la gamme le dit dans son nom
//   et sa source, sa tolérance est celle du mètre ruban (ML_DISQUE_MESURE_TOL,
//   5 mm — écrite en chiffre ici, la constante n'étant déclarée qu'après ce
//   tableau), et « Autre gamme — je la mesure » reste proposé : une autre
//   série Technogym peut ne pas avoir les mêmes cotes.
//
// `tol` : la tolérance de fabrication PUBLIÉE, en mm — absente quand la fiche
// n'en dit rien. On ne l'invente pas non plus.
/** @typedef {{id:string, m:string, g:string, src:string, tol?:number, c:ReadonlyArray<[string,number]>}} GammeDisque */
/** @type {ReadonlyArray<GammeDisque>} */
const ML_DISQUES=Object.freeze([
  {id:'iwf',m:'Bumper standard',g:'Norme IWF, toute marque',tol:1,
    src:'Règles techniques IWF : 450 mm ± 1 mm dès 10 kg',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',450]]},
  {id:'eleiko-iwf',m:'Eleiko',g:'IWF compétition',tol:1,src:'Eleiko, disque de compétition IWF',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',450]]},
  {id:'eleiko-sport',m:'Eleiko',g:'Sport Training',src:'Eleiko, fiches 3062910',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',450]]},
  {id:'eleiko-xf',m:'Eleiko',g:'XF Bumper',src:'Eleiko, fiches 3085125',
    c:[['20 kg',450],['15 kg',450],['10 kg',450],['5 kg',320]]},
  {id:'eleiko-ipf',m:'Eleiko',g:'IPF force athlétique (acier)',src:'Eleiko, disque de compétition IPF',
    c:[['25 kg',450],['20 kg',450],['15 kg',400],['10 kg',325],['5 kg',228],['2,5 kg',190],['1,25 kg',160]]},
  {id:'rogue-hg',m:'Rogue',g:'HG 2.0 Bumper',src:'Rogue : « chaque bumper fait 450 mm, norme IWF »',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',450],['5 kg',450]]},
  {id:'rogue-cal',m:'Rogue',g:'Acier calibré (kg)',src:'Garage Gym Reviews — Rogue indique « variable »',
    c:[['25 kg',450],['20 kg',450],['15 kg',400],['10 kg',325]]},
  {id:'rogue-dd',m:'Rogue',g:'Deep Dish, fonte (lb)',src:'Rogue, fiche Deep Dish',
    c:[['100 lb',450],['45 lb',450],['35 lb',360],['25 lb',276],['10 lb',229],['5 lb',190]]},
  {id:'hammer-lb',m:'Hammer Strength',g:'Rond uréthane ou caoutchouc (lb)',src:'Life Fitness, fiche Hammer Strength',
    c:[['45 lb',432],['35 lb',379],['25 lb',320],['10 lb',255],['5 lb',184],['2,5 lb',161]]},
  {id:'gymleco-sans',m:'Gymleco',g:'Caoutchouc sans poignées',src:'Gymleco, fiche produit',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',450],['5 kg',450]]},
  {id:'gymleco-poignees',m:'Gymleco',g:'Caoutchouc à poignées',src:'Gymleco, fiche produit',
    c:[['25 kg',450],['20 kg',450],['15 kg',450],['10 kg',325],['5 kg',265],['2,5 kg',200],['1,25 kg',157]]},
  {id:'gymleco-pu',m:'Gymleco',g:'Uréthane à poignées',src:'Gymleco, fiche produit',
    c:[['20 kg',450],['15 kg',450],['10 kg',325],['5 kg',265],['2,5 kg',200],['1,25 kg',157]]},
  {id:'gymleco-acier',m:'Gymleco',g:'Acier calibré à poignées',src:'Gymleco, fiche produit',
    c:[['25 kg',450],['20 kg',450],['15 kg',378],['10 kg',316],['5 kg',240],['2,5 kg',208],['1,25 kg',159]]},
  {id:'jordan-pu',m:'Jordan',g:'Uréthane',src:'Jordan Fitness, fiche produit',
    c:[['25 kg',450],['20 kg',450],['15 kg',400],['10 kg',360],['5 kg',280],['2,5 kg',235],['1,25 kg',190]]},
  {id:'panatta-pl',m:'Panatta',g:'Powerlifting Pro',src:'Panatta : 20 et 25 kg à 450 mm, norme IPF',
    c:[['25 kg',450],['20 kg',450]]},
  {id:'technogym-releve',m:'Technogym',g:'Relevé au mètre ruban',tol:5,
    src:'Relevé au mètre ruban par Kevin, 22/09/2026 — Technogym ne publie pas ses diamètres',
    c:[['20 kg',460],['10 kg',320],['5 kg',240],['2,5 kg',200],['1,25 kg',165]]}
]);
// LES MARQUES SANS COTE PUBLIÉE : le diamètre se mesure, et se retient.
const ML_DISQUES_A_MESURER=Object.freeze(['Panatta','Technogym','Matrix','Hammer Strength','Life Fitness','Autre marque']);
// Les charges qu'on propose pour un disque mesuré.
const ML_DISQUES_CHARGES=Object.freeze(['25 kg','20 kg','15 kg','10 kg','5 kg','2,5 kg','1,25 kg','45 lb','35 lb','25 lb','10 lb']);
// L'erreur d'un diamètre pris au mètre ruban, en mm — celle que la morpho
// retient déjà pour un tour de membre (MORPHO_ERREUR_CM, 0,5 cm).
const ML_DISQUE_MESURE_TOL=5;
// Pointer un bord à la souris ou au doigt : un pixel d'erreur à chaque bout.
const ML_ECHELLE_ERR_PX=2;
// En dessous, deux points trop proches ne donnent pas d'échelle : un pixel
// d'erreur y pèserait plus de 5 %.
const ML_ECHELLE_MIN_PX=40;
// LES REPÈRES ANATOMIQUES de l'outil Point : chaque toucher pose le suivant.
const ML_REPERES_ANAT=Object.freeze(['Tête','Épaule','Coude','Poignet','Hanche','Genou','Cheville']);
// LES PHRASES DE L'OUTIL TEXTE, en capitales comme sur l'image.
const ML_PHRASES=Object.freeze(['DESCENDS PLUS BAS','GARDE LE GENOU DANS L’AXE','BARRE PLUS PROCHE DU CORPS',
  'TRÈS BONNE POSITION','GAINE AVANT DE DESCENDRE','COUDES SOUS LA BARRE']);
const ML_ANNOT_DUREE_MS=4000;     // la durée d'un tracé posé hors séquence
// LES STYLES DE TRAIT (build 1382, Kevin : « pouvoir faire des tracés en
// pointillé, pas que ligne pleine »). Plein est le défaut, donc ABSENT de la
// donnée : `st` ne s'écrit que pour les tirets ('t') et le pointillé ('p').
/** @type {ReadonlyArray<[string,string]>} */
const ML_TRAITS=Object.freeze([['','Plein'],['t','Tirets'],['p','Pointillé']]);
// La case « Tracer pendant la lecture », retenue d'une ouverture à l'autre sur
// CET appareil : c'est une manière de travailler, pas une donnée du dossier.
const ML_PREF_LECTURE='rc-ml-tracer-en-lecture';
const ML_EPAISSEUR_DEFAUT=4;
// LES SEPT MODÈLES D'ANNOTATION. Un modèle arme les outils l'un après l'autre,
// avec leur couleur et leur nom : le coach dessine, et le suivant s'arme.
/** @type {ReadonlyArray<ModeleAnnot>} */
const ML_MODELES_ANNOT=Object.freeze([
  {nom:'Trajectoire',ico:'traj',titre:'Trajectoire',etapes:[{t:'libre',c:'#ff3b3b',n:'Trajectoire actuelle'},
    {t:'libre',c:'#22c55e',n:'Trajectoire idéale'}]},
  {nom:'Angles articulaires',ico:'angle',titre:'Angles articulaires',etapes:[{t:'angle',c:'#3b82f6',n:'Angle actuel'},
    {t:'angle',c:'#22c55e',n:'Angle cible'}]},
  {nom:'Placement corporel',ico:'corps',titre:'Placement corporel',etapes:[{t:'point',c:'#3b82f6',n:'Alignement'},
    {t:'ligne',c:'#ffffff',n:'Axe du corps'}]},
  {nom:'Amplitude',ico:'ampl',titre:'Amplitude',etapes:[{t:'ligne',c:'#facc15',n:'Point haut'},
    {t:'ligne',c:'#facc15',n:'Point bas'},{t:'fleche',c:'#22c55e',n:'Amplitude cible'}]},
  {nom:'Stabilité',ico:'stab',titre:'Stabilité',etapes:[{t:'zone',c:'#facc15',n:'Zone d’instabilité'},
    {t:'ligne',c:'#ffffff',n:'Axe de référence'}]},
  {nom:'Tempo',ico:'tempo',titre:'Tempo',etapes:[{t:'texte',c:'#ffffff',n:'DESCENTE 3 S'},
    {t:'texte',c:'#ffffff',n:'PAUSE 1 S'},{t:'texte',c:'#ffffff',n:'MONTÉE 1 S'}]},
  {nom:'Comparaison',ico:'comp',titre:'Comparaison',comparer:true,etapes:[{t:'libre',c:'#ff3b3b',n:'Mouvement actuel'},
    {t:'libre',c:'#22c55e',n:'Mouvement cible'}]}]);
const ML_MODELES_ANNOT_MAX=12;

/**
 * PURE. Un document vide : une légende éteinte, aucun tracé.
 * @returns {DocAnnot}
 */
function mlDocVide(){
  return {v:1,majLe:0,leg:{on:0,titre:'Analyse technique',pos:'hg',taille:'m',fond:'sombre',op:0.85},a:[]};
}
/**
 * PURE. Les points d'un tracé à l'instant `sMs` de la vidéo. Sans image clé,
 * ceux du tracé ; avec, l'interpolation LINÉAIRE entre les deux clés qui
 * encadrent l'instant — tenus avant la première et après la dernière. C'est la
 * règle du suivi : le coach ajuste le point sur quelques images, et le
 * mouvement se remplit entre elles.
 * @param {Annot} a
 * @param {number} sMs
 * @returns {number[][]}
 */
function mlAnnotPointsA(a,sMs){
  const base=mlDecoderTrait(a.p);
  const k=Array.isArray(a.k)?a.k:[];
  if(!k.length) return base;
  if(sMs<=k[0][0]) return mlDecoderTrait(k[0][1]);
  const der=k[k.length-1];
  if(sMs>=der[0]) return mlDecoderTrait(der[1]);
  for(let i=0;i<k.length-1;i++){
    const [t0,s0]=k[i], [t1,s1]=k[i+1];
    if(sMs>=t0&&sMs<=t1){
      const A=mlDecoderTrait(s0), B=mlDecoderTrait(s1), f=(sMs-t0)/Math.max(1,t1-t0);
      if(A.length!==B.length) return A;
      return A.map((p,j)=>[p[0]+(B[j][0]-p[0])*f,p[1]+(B[j][1]-p[1])*f]);
    }
  }
  return base;
}
/**
 * PURE. Le tracé porte-t-il une image clé à `sMs` (à 20 ms près) ? Rend son
 * rang, ou -1.
 * @param {Annot} a
 * @param {number} sMs
 * @returns {number}
 */
function mlCleA(a,sMs){
  const k=Array.isArray(a.k)?a.k:[];
  return k.findIndex(q=>Math.abs(q[0]-sMs)<=20);
}
/**
 * PURE. Le tracé avec une image clé posée — ou remplacée — à `sMs`. La
 * première clé fige aussi le tracé de base : c'est lui qu'on voit sans suivi.
 * @param {Annot} a
 * @param {number} sMs
 * @param {number[][]} pts
 * @returns {Annot}
 */
function mlClesMaj(a,sMs,pts){
  const s=mlEncoderTrait(pts), t=Math.max(0,Math.round(sMs));
  /** @type {[number,string][]} */
  let k=(Array.isArray(a.k)?a.k:[]).filter(q=>Math.abs(q[0]-t)>20);
  k.push([t,s]);
  k.sort((x,y)=>x[0]-y[0]);
  // AU-DELÀ DU PLAFOND, la clé la plus proche de la nouvelle tombe : c'est
  // celle qu'on vient de préciser qui compte.
  while(k.length>ANNOT_CLES_MAX){
    let iMin=-1, dMin=Infinity;
    k.forEach((q,i)=>{ const dd=Math.abs(q[0]-t); if(q[0]!==t&&dd<dMin){ dMin=dd; iMin=i; } });
    if(iMin<0) break;
    k.splice(iMin,1);
  }
  return {...a,k,p:k[0][1]};
}
/**
 * PURE. L'angle au sommet B du trio A-B-C, en degrés entiers de 0 à 180,
 * mesuré dans l'IMAGE : les points sont normés séparément en largeur et en
 * hauteur, on les ramène donc aux pixels avant de mesurer — sans quoi une
 * vidéo en portrait donnerait des angles faux.
 * @param {number[]} A
 * @param {number[]} B
 * @param {number[]} C
 * @param {number} vw
 * @param {number} vh
 * @returns {number|null}
 */
function mlAngleTrois(A,B,C,vw,vh){
  const ax=(A[0]-B[0])*vw, ay=(A[1]-B[1])*vh, cx=(C[0]-B[0])*vw, cy=(C[1]-B[1])*vh;
  const na=Math.hypot(ax,ay), nc=Math.hypot(cx,cy);
  if(!(na>0&&nc>0)) return null;
  const cos=Math.max(-1,Math.min(1,(ax*cx+ay*cy)/(na*nc)));
  return Math.round(Math.acos(cos)*180/Math.PI);
}
/**
 * PURE. Le tracé est-il à l'écran à `sMs` ? En comparaison, les tracés de
 * forme — trajectoires, lignes, angles, repères — restent tous visibles : c'est
 * ce qui permet de superposer l'actuel et le cible, posés à deux instants.
 * @param {Annot} a
 * @param {number} sMs
 * @param {boolean} [comparaison]
 * @returns {boolean}
 */
function mlAnnotVisible(a,sMs,comparaison){
  if(a.h) return false;
  if(comparaison&&['libre','courbe','ligne','fleche','angle','point'].includes(a.t)) return true;
  // LA FIN EST COMPRISE. Un tracé réglé sur « toute la vidéo » finit à sa
  // durée exacte, et la vidéo s'arrête sur cet instant précis : exclue, la fin
  // effaçait le tracé sur la dernière image — celle qu'on regarde, à l'arrêt,
  // une fois le mouvement fini (vu au banc sur une trajectoire suivie, 1385).
  return sMs>=a.d&&sMs<=a.f;
}
/**
 * PURE. Le nom d'un tracé qu'on vient de poser : le sens de sa couleur pour un
 * tracé de forme, le nom de l'outil sinon.
 * @param {TypeAnnot} t
 * @param {string} c
 * @param {Object<string,string>} [sens]
 * @returns {string}
 */
function mlNomDefaut(t,c,sens){
  const s=String((sens&&sens[c])||'').trim().slice(0,ANNOT_NOM_MAX);
  const p=ML_PALETTE.find(x=>x.c===c);
  if(t==='libre'||t==='courbe'){
    // LE SENS RÉÉCRIT PAR LE COACH passe devant : c'est son vocabulaire.
    if(s&&(!p||s!==p.sens)) return s;
    if(c==='#ff3b3b') return 'Trajectoire actuelle';
    if(c==='#22c55e') return 'Trajectoire idéale';
    return s?('Trajectoire — '+s).slice(0,ANNOT_NOM_MAX):'Trajectoire';
  }
  if(t==='angle'||t==='texte') return ML_TYPE_LIB[t];
  return s||ML_TYPE_LIB[t]||'Annotation';
}
/**
 * PURE. Un trait simplifié jusqu'à tenir en `max` points (Ramer-Douglas-
 * Peucker, tolérance relâchée tant qu'il déborde). La même règle que les traits
 * de la correction, avec le plafond des annotations.
 * @param {number[][]} pts
 * @param {number} max
 * @returns {number[][]}
 */
function mlSimplifierMax(pts,max){
  /** @param {number[][]} l @param {number} eps @returns {number[][]} */
  const rdp=(l,eps)=>{
    if(l.length<3) return l.slice();
    const [a,b]=[l[0],l[l.length-1]];
    let dMax=-1, iMax=0;
    const dx=b[0]-a[0], dy=b[1]-a[1], n=Math.hypot(dx,dy)||1;
    for(let i=1;i<l.length-1;i++){
      const d=Math.abs(dy*l[i][0]-dx*l[i][1]+b[0]*a[1]-b[1]*a[0])/n;
      if(d>dMax){ dMax=d; iMax=i; }
    }
    if(dMax<=eps) return [a,b];
    return rdp(l.slice(0,iMax+1),eps).slice(0,-1).concat(rdp(l.slice(iMax),eps));
  };
  let eps=1.5, r=rdp(pts,eps);
  while(r.length>max&&eps<200){ eps*=1.5; r=rdp(pts,eps); }
  return r.length>max?r.filter((_,i)=>i%Math.ceil(r.length/max)===0).slice(0,max):r;
}
/**
 * PURE. Une courbe de Catmull-Rom qui PASSE par les points posés : le coach
 * touche la barre à quelques instants, la courbe épouse le chemin entre eux.
 * @param {number[][]} pts  en pixels d'écran
 * @param {number} [pas]
 * @returns {number[][]}
 */
function mlCatmull(pts,pas){
  if(pts.length<3) return pts.slice();
  const n=Math.max(2,pas||10), out=[];
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    for(let j=0;j<n;j++){
      const t=j/n, t2=t*t, t3=t2*t;
      out.push([0,1].map(q=>0.5*((2*p1[q])+(-p0[q]+p2[q])*t+(2*p0[q]-5*p1[q]+4*p2[q]-p3[q])*t2
        +(-p0[q]+3*p1[q]-3*p2[q]+p3[q])*t3)));
    }
  }
  out.push(pts[pts.length-1].slice());
  return out;
}
/**
 * PURE. La valeur d'un angle à `sMs`, et l'écart à la cible s'il y en a une.
 * @param {Annot} a
 * @param {number} sMs
 * @param {number} vw
 * @param {number} vh
 * @returns {{val:number, cible:number|null, ecart:number|null}|null}
 */
function mlAngleAnnot(a,sMs,vw,vh){
  if(a.t!=='angle') return null;
  const q=mlAnnotPointsA(a,sMs);
  if(q.length<3) return null;
  const val=mlAngleTrois(q[0],q[1],q[2],vw,vh);
  if(val===null) return null;
  const cible=typeof a.cb==='number'?a.cb:null;
  return {val,cible,ecart:cible===null?null:val-cible};
}
/**
 * PURE. Ce qu'on lit d'un tracé dans la légende ou sur son étiquette : son nom,
 * et pour un angle sa valeur — « Angle coude : 92° (cible 100°) ».
 * @param {Annot} a
 * @param {number} sMs
 * @param {number} vw
 * @param {number} vh
 * @returns {string}
 */
function mlAnnotLibelle(a,sMs,vw,vh){
  if(a.t==='texte') return a.n;
  const an=mlAngleAnnot(a,sMs,vw,vh);
  if(!an) return a.n;
  return a.n+' : '+an.val+'°'+(an.cible===null?'':' (cible '+an.cible+'°)');
}

// ── L'ÉCHELLE ET LES MESURES (build 1391) ──────────────────────────────────
/**
 * PURE. Le disque que désigne une source d'échelle : son diamètre, son nom
 * lisible, sa tolérance publiée, et d'où vient la cote. Rend null pour une
 * source inconnue — jamais un diamètre par défaut.
 * « id|charge » vient du catalogue ; « mesure|marque|charge » d'un disque
 * mesuré par le coach, dont le diamètre est celui de l'échelle elle-même.
 * @param {string|undefined} src
 * @param {number} [mmMesure]
 * @returns {{mm:number, lib:string, tol:number|null, source:string, mesure:boolean}|null}
 */
function mlDisqueDe(src,mmMesure){
  const s=String(src||'').split('|');
  if(s[0]==='mesure'){
    const mm=Number(mmMesure);
    if(!(mm>0)||!s[1]) return null;
    return {mm:Math.round(mm),lib:s[1]+(s[2]?' '+s[2]:''),tol:ML_DISQUE_MESURE_TOL,
      source:'mesuré au mètre ruban',mesure:true};
  }
  const g=ML_DISQUES.find(x=>x.id===s[0]);
  const c=g&&g.c.find(x=>x[0]===s[1]);
  if(!g||!c) return null;
  const nom=g.m==='Bumper standard'?'Bumper IWF':g.m+' '+g.g;
  return {mm:c[1],lib:nom+' '+c[0],tol:typeof g.tol==='number'?g.tol:null,source:g.src,mesure:false};
}
/**
 * PURE. La longueur de l'échelle en pixels de la VIDÉO — pas de l'écran : un
 * même disque vaut autant de pixels sur un téléphone que sur un poste. Les
 * points sont normés séparément en largeur et en hauteur, d'où vw et vh.
 * @param {Echelle|undefined} ech
 * @param {number} vw @param {number} vh
 * @returns {number}
 */
function mlEchellePx(ech,vw,vh){
  if(!ech||typeof ech.p!=='string') return 0;
  const q=mlDecoderTrait(ech.p);
  if(q.length!==2||!(vw>0)||!(vh>0)) return 0;
  return Math.hypot((q[1][0]-q[0][0])/1000*vw,(q[1][1]-q[0][1])/1000*vh);
}
/**
 * PURE. Les millimètres que vaut un pixel de la vidéo — null tant que
 * l'échelle n'a pas son disque, ou qu'elle est trop courte à l'image pour
 * qu'un pixel d'erreur y reste négligeable.
 * @param {Echelle|undefined} ech
 * @param {number} vw @param {number} vh
 * @returns {number|null}
 */
function mlEchelleMmPx(ech,vw,vh){
  if(!ech||!(Number(ech.mm)>0)) return null;
  const px=mlEchellePx(ech,vw,vh);
  return px>=ML_ECHELLE_MIN_PX?Number(ech.mm)/px:null;
}
/**
 * PURE. La précision relative d'une échelle : le pointage (un pixel à chaque
 * bout) plus la tolérance du disque quand elle est connue.
 * @param {number} px  longueur de l'échelle, en pixels de la vidéo
 * @param {number} mm
 * @param {number|null} tol
 * @returns {number}  en fraction (0,012 = 1,2 %)
 */
function mlEchellePrecision(px,mm,tol){
  if(!(px>0)||!(mm>0)) return 1;
  return ML_ECHELLE_ERR_PX/px+(tol?tol/mm:0);
}
/**
 * PURE. « 12,4 cm », ou « 1,24 m » à partir d'un mètre.
 * @param {number} mm
 * @returns {string}
 */
function mlLongueurTexte(mm){
  if(!isFinite(mm)||mm<0) return '';
  return mm>=1000?mlNombre(mm/1000,2)+' m':mlNombre(mm/10,1)+' cm';
}
/**
 * PURE. La longueur d'une ligne brisée.
 * @param {number[][]} pts
 * @returns {number}
 */
function _mlxLongueur(pts){
  let l=0;
  for(let i=1;i<pts.length;i++) l+=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]);
  return l;
}
/**
 * PURE. L'amplitude d'un ensemble de points : les deux points les plus
 * éloignés, et leur distance — la plus grande longueur que le mouvement
 * couvre, quel que soit le nombre d'allers-retours. En pixels d'écran comme
 * les points reçus.
 * @param {number[][]} l
 * @returns {{a:number[], b:number[], d:number}|null}
 */
function mlAmplitude(l){
  if(!Array.isArray(l)||l.length<2) return null;
  let best={a:l[0],b:l[1],d:-1};
  for(let i=0;i<l.length;i++) for(let j=i+1;j<l.length;j++){
    const d=Math.hypot(l[j][0]-l[i][0],l[j][1]-l[i][1]);
    if(d>best.d) best={a:l[i],b:l[j],d};
  }
  return best;
}
/**
 * PURE. Ce que mesure un tracé, et où l'écrire. Les points sont ceux de
 * l'écran ; `s` ramène l'écran à la vidéo (R.s), `mmpx` la vidéo au monde.
 * Rend null pour un tracé qui ne se mesure pas : un angle dit déjà ses
 * degrés, un texte et un repère n'ont pas de longueur.
 *   ligne, flèche → sa longueur ; trajectoire, courbe → son AMPLITUDE, la
 *   plus grande distance entre deux de ses points (1401 : plus le chemin
 *   parcouru) ; cercle → son diamètre ; zone, rectangle → largeur × hauteur.
 * Le point rendu est le CENTRE du texte, avant le décalage `mo`.
 * @param {Annot} a
 * @param {number[][]} pts
 * @param {number} s
 * @param {number} mmpx
 * @param {number} k
 * @returns {{x:number, y:number, txt:string}|null}
 */
function mlMesureTrace(a,pts,s,mmpx,k){
  if(!(mmpx>0)||!(s>0)||pts.length<2) return null;
  const mm=(/** @type {number} */ l)=>l/s*mmpx;
  const ecart=16*k;
  /** Le milieu d'un segment, poussé du côté du haut de l'image.
   * @param {number[]} A @param {number[]} B @returns {number[]} */
  const aCote=(A,B)=>{
    const dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy)||1;
    let nx=-dy/L, ny=dx/L;
    if(ny>0||(ny===0&&nx>0)){ nx=-nx; ny=-ny; }
    return [(A[0]+B[0])/2+nx*ecart,(A[1]+B[1])/2+ny*ecart];
  };
  switch(a.t){
    case 'ligne': case 'fleche':{
      const [x,y]=aCote(pts[0],pts[1]);
      return {x,y,txt:mlLongueurTexte(mm(Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1])))};
    }
    case 'libre': case 'courbe':{
      // UNE LONGUEUR, PAS LE CHEMIN PARCOURU (build 1401, Kevin : « ton calcul
      // de taille doit ne prendre qu'une longueur, pas l'ensemble des
      // allers-retours »). Une trajectoire suivie sur huit répétitions
      // additionnait chaque montée et chaque descente — 4,75 m pour une barre
      // qui parcourt un demi-mètre. La mesure est désormais l'AMPLITUDE : la
      // plus grande distance entre deux points de la trajectoire. Un seul
      // aller donne la même valeur qu'avant ; des allers-retours sur le même
      // chemin ne s'additionnent plus.
      const l=a.t==='courbe'?mlCatmull(pts,12):pts;
      const d=mlAmplitude(l);
      if(!d||!(d.d>0)) return null;
      const [x,y]=aCote(d.a,d.b);
      return {x,y,txt:mlLongueurTexte(mm(d.d))};
    }
    case 'cercle':{
      const r=Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]);
      return {x:pts[0][0],y:pts[0][1],txt:'Ø '+mlLongueurTexte(mm(2*r))};
    }
    case 'rect': case 'zone':{
      const w=mm(Math.abs(pts[1][0]-pts[0][0])), h=mm(Math.abs(pts[1][1]-pts[0][1]));
      const txt=w<1000&&h<1000?mlNombre(w/10,1)+' × '+mlNombre(h/10,1)+' cm'
        :mlLongueurTexte(w)+' × '+mlLongueurTexte(h);
      return {x:(pts[0][0]+pts[1][0])/2,y:Math.min(pts[0][1],pts[1][1])-ecart,txt};
    }
  }
  return null;
}

// ══ LE BORD DU DISQUE, TROUVÉ SEUL (build 1393) ════════════════════════════
//
// Kevin, 22/09/2026 : un toucher au centre du disque, et RepCore trouve son
// bord. Pointer le haut et le bas à la main coûte un à trois pixels d'erreur à
// chaque bout ; le bord ajusté sur tout le tour en coûte une fraction.
//
// TROIS TEMPS, parce qu'aucun ne suffit seul :
//   1. SUR UNE IMAGE RÉDUITE, deux votes. Le CENTRE : une ellipse est
//      symétrique par rapport à son centre, donc le milieu de deux points de
//      son bord qui se font face — même orientation — est le centre, pour un
//      cercle comme pour un disque vu de biais ; on garde le plus fort près du
//      toucher. Les DEMI-AXES : pour une ellipse droite centrée là, un point du
//      bord et la direction de son gradient donnent a et b d'un coup ; parmi
//      les ellipses vues sur une bonne part du tour, la plus grande — moyeu,
//      lettrage et lèvre en sont de plus petites.
//   2. À PLEINE RÉSOLUTION, le long de 144 rayons tirés du centre, les sauts
//      de luminosité au dixième de pixel. On retient l'anneau que le plus de
//      rayons confirment — un tibia ou la barre derrière le disque ne se
//      trouvent que sur quelques-uns —, et une ELLIPSE y est ajustée, trois
//      fois, en écartant les points qui s'en éloignent.
//   3. AUX DEUX BOUTS DU GRAND AXE, qui font l'échelle, un éventail de rayons
//      moyennés cherche un bord plus extérieur : le liseré d'un bumper ou la
//      lèvre d'un disque en fonte sont des anneaux plus nets que le bord
//      lui-même. Il n'est retenu que s'il se voit AUX DEUX BOUTS, au même
//      rapport — un bord du décor ne se trouve qu'à un seul.
//
// Vérifié sur trois disques incrustés dans une vraie vidéo de salle, puis
// compressés : bumper de profil, bumper de trois quarts sur un t-shirt noir,
// disque en fonte à poignées devant la barre — diamètre à 0,3 px près sur
// 200 à 240 px, pour un toucher jusqu'à 20 % du rayon à côté du centre.
//
// ⚠ LE DIAMÈTRE EST LE GRAND AXE DE L'ELLIPSE. Un disque vu de biais n'est
//   plus un cercle : un axe rétrécit, l'autre reste son diamètre, quel que
//   soit l'angle de vue. Les deux bouts de l'échelle sont ceux du grand axe
//   — le haut et le bas pour un disque vu de profil, ou vu de trois quarts.
//
// ⚠ RIEN N'EST DEVINÉ. Un bord vu sur moins de 45 % du tour, un ajustement
//   qui s'écarte de plus de 1,5 % du rayon, une ellipse aplatie à moins d'un
//   quart, un toucher hors du disque : aucune échelle ne sort, et le coach la
//   pose à la main.
/** Le plus grand rayon de l'image réduite où l'on vote. */
const ML_DISQUE_HOUGH_R=110;
/** Les rayons tirés du centre pour trouver le bord à pleine résolution. */
const ML_DISQUE_RAYONS=144;
/** La part du tour où le bord doit être vu. */
const ML_DISQUE_COUV=0.45;
/** L'écart médian toléré entre les points du bord et l'ellipse, en part du rayon. */
const ML_DISQUE_RESIDU=0.015;
/** Le plus petit saut de luminosité qu'on tient pour un bord, par pixel. */
const ML_DISQUE_SAUT=3;
/**
 * PURE. Une image ramenée à W × H par moyenne de blocs.
 * @param {Float32Array} g @param {number} w @param {number} h @param {number} W @param {number} H
 * @returns {Float32Array}
 */
function _mlxReduire(g,w,h,W,H){
  const out=new Float32Array(W*H), n=new Float32Array(W*H);
  const fx=W/w, fy=H/h;
  for(let y=0;y<h;y++){
    const o=Math.min(H-1,Math.floor(y*fy))*W;
    for(let x=0;x<w;x++){ const i=o+Math.min(W-1,Math.floor(x*fx)); out[i]+=g[y*w+x]; n[i]++; }
  }
  for(let i=0;i<out.length;i++) out[i]=n[i]?out[i]/n[i]:0;
  return out;
}
/**
 * PURE. Un lissage [1 2 1] dans les deux sens : il ôte le grain de la
 * compression sans déplacer un bord.
 * @param {Float32Array} g @param {number} w @param {number} h
 * @returns {Float32Array}
 */
function _mlxLisser(g,w,h){
  const t=new Float32Array(w*h), o=new Float32Array(w*h);
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=y*w+x; t[i]=(g[x>0?i-1:i]+2*g[i]+g[x<w-1?i+1:i])/4;
  }
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const i=y*w+x; o[i]=(t[y>0?i-w:i]+2*t[i]+t[y<h-1?i+w:i])/4;
  }
  return o;
}
/**
 * PURE. L'ellipse qui passe au plus près des points — l'ajustement d'une
 * conique A·x² + B·xy + C·y² + D·x + E·y = 1 aux moindres carrés, sur des
 * points recentrés et remis à l'échelle pour la stabilité du calcul. Rend son
 * centre, ses demi-axes (a ≥ b) et la direction du grand axe — ou null si les
 * points ne dessinent pas une ellipse.
 * @param {number[][]} pts
 * @returns {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}|null}
 */
function mlEllipseAjuster(pts){
  if(!pts||pts.length<6) return null;
  let mx=0, my=0;
  for(const p of pts){ mx+=p[0]; my+=p[1]; }
  mx/=pts.length; my/=pts.length;
  let s=0;
  for(const p of pts) s+=Math.hypot(p[0]-mx,p[1]-my);
  s=s/pts.length||1;
  /** @type {number[][]} */
  const M=[[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
  for(const p of pts){
    const x=(p[0]-mx)/s, y=(p[1]-my)/s, f=[x*x,x*y,y*y,x,y];
    for(let i=0;i<5;i++){ for(let j=0;j<5;j++) M[i][j]+=f[i]*f[j]; M[i][5]+=f[i]; }
  }
  // Gauss, pivot partiel.
  for(let c=0;c<5;c++){
    let piv=c;
    for(let r=c+1;r<5;r++) if(Math.abs(M[r][c])>Math.abs(M[piv][c])) piv=r;
    if(Math.abs(M[piv][c])<1e-12) return null;
    [M[c],M[piv]]=[M[piv],M[c]];
    for(let r=0;r<5;r++){
      if(r===c) continue;
      const k=M[r][c]/M[c][c];
      for(let j=c;j<6;j++) M[r][j]-=k*M[c][j];
    }
  }
  const [A,B,C,D,E]=M.map((l,i)=>l[5]/l[i]);
  const det=4*A*C-B*B;
  if(!(det>0)) return null;
  const x0=(B*E-2*C*D)/det, y0=(B*D-2*A*E)/det;
  const F0=A*x0*x0+B*x0*y0+C*y0*y0+D*x0+E*y0-1;
  const tr=A+C, dif=Math.hypot(A-C,B);
  const l1=(tr-dif)/2, l2=(tr+dif)/2;
  if(!(l1>0)||!(-F0>0)) return null;
  // LE GRAND AXE va avec la plus petite valeur propre.
  let ux=B/2, uy=l1-A;
  if(Math.hypot(ux,uy)<1e-12){ ux=l1-C; uy=B/2; }
  if(Math.hypot(ux,uy)<1e-12){ ux=A<=C?1:0; uy=A<=C?0:1; }
  const n=Math.hypot(ux,uy);
  return {cx:mx+x0*s,cy:my+y0*s,a:Math.sqrt(-F0/l1)*s,b:Math.sqrt(-F0/l2)*s,ux:ux/n,uy:uy/n};
}
/**
 * PURE. La distance, le long du rayon issu du centre, entre un point et
 * l'ellipse ; et le rayon de l'ellipse dans une direction.
 * @param {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}} e
 * @param {number} dx @param {number} dy  une direction (unitaire), ou un point relatif au centre
 * @returns {number}  le rayon de l'ellipse dans cette direction, rapporté à la longueur de (dx,dy)
 */
function _mlxEllipseRho(e,dx,dy){
  const u=dx*e.ux+dy*e.uy, v=-dx*e.uy+dy*e.ux;
  return Math.sqrt((u/e.a)*(u/e.a)+(v/e.b)*(v/e.b));
}
/**
 * PURE. Le disque autour du toucher (tx, ty) : son bord extérieur ajusté en
 * ellipse, et les deux bouts de son grand axe — son diamètre. Les coordonnées
 * sont celles de l'image `gris` (w × h, niveaux de gris).
 * @param {Float32Array} gris
 * @param {number} w @param {number} h
 * @param {number} tx @param {number} ty
 * @param {number} rMin @param {number} rMax  les rayons possibles, en pixels
 * @returns {{cx:number, cy:number, a:number, b:number, ux:number, uy:number, A:number[], B:number[],
 *   couverture:number, residu:number}|{erreur:string}}
 */
function mlDisqueDetecter(gris,w,h,tx,ty,rMin,rMax){
  if(!gris||!(w>16&&h>16)||!(rMax>rMin&&rMin>0)||!isFinite(tx)||!isFinite(ty)) return {erreur:'image'};
  // ── 1. LE VOTE, sur une image réduite ──
  const f=Math.min(1,ML_DISQUE_HOUGH_R/rMax);
  const W=Math.max(16,Math.round(w*f)), H=Math.max(16,Math.round(h*f));
  const fx=W/w, fy=H/h;
  const p=_mlxLisser(W===w&&H===h?gris:_mlxReduire(gris,w,h,W,H),W,H);
  const gx=new Float32Array(W*H), gy=new Float32Array(W*H), mg=new Float32Array(W*H);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
    const i=y*W+x;
    const a=p[i-W-1], b=p[i-W], c=p[i-W+1], d=p[i-1], e=p[i+1], f2=p[i+W-1], g=p[i+W], hh=p[i+W+1];
    gx[i]=(c+2*e+hh)-(a+2*d+f2); gy[i]=(f2+2*g+hh)-(a+2*b+c);
    mg[i]=Math.hypot(gx[i],gy[i]);
  }
  // DES BORDS D'UN PIXEL, MÊME FAIBLES. Un disque noir sur un décor sombre
  // n'a qu'un bord pâle — vingt-cinq niveaux de gris —, quand les néons et
  // les montants d'une salle en ont de bien plus nets : un seuil pris sur les
  // plus forts l'effaçait. On amincit chaque contour à son pixel le plus net
  // (comme Canny), puis on garde tout ce qui dépasse un saut de cinq niveaux.
  const tri=Float32Array.from(mg).sort();
  const seuil=Math.max(20,0.08*tri[Math.floor(tri.length*0.99)]);
  const fin=new Uint8Array(W*H);
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
    const i=y*W+x, m=mg[i];
    if(!(m>=seuil)) continue;
    const o=Math.atan2(gy[i],gx[i]), q=((Math.round(o/(Math.PI/4))%4)+4)%4;
    const pas=q===0?1:q===1?W+1:q===2?W:W-1;
    if(m>=mg[i-pas]&&m>mg[i+pas]) fin[i]=1;
  }
  const r0=Math.max(2,Math.floor(rMin*Math.min(fx,fy))), r1=Math.max(r0+3,Math.ceil(rMax*Math.max(fx,fy)));
  /** @type {number[]} */
  const bords=[];
  for(let i=0;i<W*H;i++) if(fin[i]) bords.push(i);
  if(bords.length<20) return {erreur:'bord'};
  // LE CENTRE : UNE ELLIPSE EST SYMÉTRIQUE PAR RAPPORT À SON CENTRE. Deux
  // points de son bord qui se font face ont la même orientation, et leur
  // milieu est le centre — pour un cercle comme pour un disque vu de biais.
  // Le vote le long du gradient, lui, ne converge qu'au centre d'un cercle.
  // On apparie donc les bords de même orientation (à 5° près), assez loin
  // l'un de l'autre pour être deux côtés du disque, et leur milieu vote. Seuls
  // comptent les bords proches du toucher, et les milieux proches de lui.
  const Tx=tx*fx, Ty=ty*fy, Dw=Math.max(5,0.4*r1);
  const NB=36;
  /** @type {number[][]} */
  const seaux=Array.from({length:NB},()=>[]);
  for(const i of bords){
    const x=i%W, y=(i-x)/W;
    if(Math.hypot(x-Tx,y-Ty)>r1+Dw) continue;
    let o=Math.atan2(gy[i],gx[i]); if(o<0) o+=Math.PI; if(o>=Math.PI) o-=Math.PI;
    seaux[Math.min(NB-1,Math.floor(o/Math.PI*NB))].push(i);
  }
  // ⚠ CHAQUE ORIENTATION PÈSE AUTANT. Les montants verticaux d'une cage
  //   remplissent à eux seuls une orientation — des milliers de bords contre
  //   quelques dizaines pour le disque — et leurs millions de paires votaient
  //   pour les milieux entre deux montants. Une paire vaut donc l'inverse de
  //   la taille de son orientation : le disque, vu sous toutes, l'emporte. Et
  //   une orientation trop pleine est éclaircie à 300 bords, un sur n.
  for(let s=0;s<NB;s++) if(seaux[s].length>300){ const l=seaux[s], pas=l.length/300; seaux[s]=Array.from({length:300},(_,q)=>l[Math.floor(q*pas)]); }
  const acc=new Float32Array(W*H);
  const dMin=2*r0, dMax=2*r1;
  for(let s=0;s<NB;s++){
    const A2=seaux[s], B2=seaux[(s+1)%NB];
    for(const L2 of [A2,B2]){
      const poids=1/Math.max(1,Math.max(A2.length,L2.length));
      for(let u=0;u<A2.length;u++){
        const i=A2[u], xi=i%W, yi=(i-xi)/W;
        for(let v=(L2===A2?u+1:0);v<L2.length;v++){
          const j=L2[v], xj=j%W, yj=(j-xj)/W;
          const d=Math.hypot(xj-xi,yj-yi);
          if(d<dMin||d>dMax) continue;
          const mx=(xi+xj)/2, my=(yi+yj)/2;
          if(Math.hypot(mx-Tx,my-Ty)>Dw) continue;
          acc[Math.round(my)*W+Math.round(mx)]+=poids;
        }
      }
    }
  }
  // Le plus fort près du toucher — un peu moins fort s'il est loin.
  let best=0, bx=-1, by=-1;
  for(let Y=Math.max(1,Math.floor(Ty-Dw));Y<=Math.min(H-2,Math.ceil(Ty+Dw));Y++)
    for(let X=Math.max(1,Math.floor(Tx-Dw));X<=Math.min(W-2,Math.ceil(Tx+Dw));X++){
      const d=Math.hypot(X-Tx,Y-Ty);
      if(d>Dw) continue;
      let sc=0;
      for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++) sc+=acc[(Y+j)*W+X+k];
      sc*=1-0.5*(d/Dw)*(d/Dw);
      if(sc>best){ best=sc; bx=X; by=Y; }
    }
  if(bx<0) return {erreur:'centre'};
  let sx=0, sy=0, sw=0;
  for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++){ const v=acc[(by+j)*W+bx+k]; sx+=(bx+k)*v; sy+=(by+j)*v; sw+=v; }
  const cxs=sw?sx/sw:bx, cys=sw?sy/sw:by;
  // LES DEUX DEMI-AXES : un disque vu de biais est une ellipse, et un seul
  // rayon ne la décrit pas. Pour une ellipse droite centrée ici, un point du
  // bord et la direction de son gradient donnent a et b d'un coup :
  //   s = dx·nx + dy·ny ;  a² = dx·s / nx ;  b² = dy·s / ny.
  // Chaque bord vote pour son couple (a, b), et note le secteur du tour où
  // il est vu (32 secteurs). Les points presque sur un axe ne votent pas :
  // ils ne disent rien de l'autre demi-axe.
  const nA=r1+3;
  const vote=new Float32Array(nA*nA), secteurs=new Uint32Array(nA*nA);
  for(const i of bords){
    const x=i%W, y=(i-x)/W, dx=x-cxs, dy=y-cys;
    const nx=gx[i]/mg[i], ny=gy[i]/mg[i];
    if(Math.abs(nx)<0.2||Math.abs(ny)<0.2) continue;
    const s=dx*nx+dy*ny, a2=dx*s/nx, b2=dy*s/ny;
    if(!(a2>0&&b2>0)) continue;
    const ka=Math.round(Math.sqrt(a2)), kb=Math.round(Math.sqrt(b2));
    if(ka<r0||kb<r0||ka>r1||kb>r1) continue;
    vote[kb*nA+ka]++;
    secteurs[kb*nA+ka]|=1<<(Math.floor((Math.atan2(dy,dx)+Math.PI)/(2*Math.PI)*32)&31);
  }
  /** @param {number} m @returns {number} */
  const compte=m=>{ let n=0; while(m){ n+=m&1; m>>>=1; } return n; };
  /** @param {number} ka @param {number} kb @returns {{n:number, sec:number}} */
  const voisinage=(ka,kb)=>{
    let n=0, sec=0;
    for(let j=-1;j<=1;j++) for(let k=-1;k<=1;k++){
      const A2=ka+k, B2=kb+j;
      if(A2<0||B2<0||A2>=nA||B2>=nA) continue;
      n+=vote[B2*nA+A2]; sec|=secteurs[B2*nA+A2];
    }
    return {n,sec};
  };
  // LE BORD EXTÉRIEUR : parmi les ellipses vues sur une bonne part du tour,
  // la plus grande. Moyeu, lettrage et lèvre en sont de plus petites.
  let Ra=0, Rb=0, aire=0;
  for(let kb=r0;kb<=r1;kb++) for(let ka=r0;ka<=r1;ka++){
    if(!vote[kb*nA+ka]||ka*kb<=aire) continue;
    // Assez de votes pour son pourtour, et vu sur une bonne part du tour.
    const v=voisinage(ka,kb), tour=Math.PI*(3*(ka+kb)-Math.sqrt((3*ka+kb)*(ka+3*kb)));
    if(v.n>=0.12*tour&&compte(v.sec)>=Math.ceil(ML_DISQUE_COUV*24)){ Ra=ka; Rb=kb; aire=ka*kb; }
  }
  if(!aire) return {erreur:'bord'};
  // ── 2. LE BORD À PLEINE RÉSOLUTION, le long de rayons ──
  let cx=cxs/fx, cy=cys/fy;
  const Rp=Math.max(Ra/fx,Rb/fy);
  const x0=Math.max(0,Math.floor(cx-1.35*Rp)), x1=Math.min(w-1,Math.ceil(cx+1.35*Rp));
  const y0=Math.max(0,Math.floor(cy-1.35*Rp)), y1=Math.min(h-1,Math.ceil(cy+1.35*Rp));
  const cw=x1-x0+1, ch=y1-y0+1;
  const brut=new Float32Array(cw*ch);
  for(let y=0;y<ch;y++) for(let x=0;x<cw;x++) brut[y*cw+x]=gris[(y+y0)*w+x+x0];
  const L=_mlxLisser(brut,cw,ch);
  /** @param {number} x @param {number} y @returns {number} */
  const lire=(x,y)=>{
    const X=x-x0, Y=y-y0;
    if(!(X>=0&&Y>=0&&X<cw-1&&Y<ch-1)) return NaN;
    const i=Math.floor(X), j=Math.floor(Y), u=X-i, v=Y-j, o=j*cw+i;
    return (L[o]*(1-u)+L[o+1]*u)*(1-v)+(L[o+cw]*(1-u)+L[o+cw+1]*u)*v;
  };
  /** @type {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}} */
  let ell=Ra/fx>=Rb/fy?{cx,cy,a:Ra/fx,b:Rb/fy,ux:1,uy:0}:{cx,cy,a:Rb/fy,b:Ra/fx,ux:0,uy:1};
  /** @type {number[][]} */
  let gardes=[];
  let residu=Infinity;
  /**
   * Les sauts de luminosité d'un rayon, entre lo·rc et hi·rc : leur distance
   * au centre, au dixième de pixel, et leur force.
   * @param {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}} E
   * @param {number} ux @param {number} uy
   * @param {number} lo @param {number} hi
   * @returns {{rc:number, pics:{r:number, s:number}[]}|null}
   */
  const profil=(E,ux,uy,lo,hi)=>{
    const rc=1/_mlxEllipseRho(E,ux,uy);
    /** @type {number[]} */ const I=[];
    for(let r=rc*lo;r<=rc*hi;r+=0.5) I.push(lire(E.cx+ux*r,E.cy+uy*r));
    if(I.length<5||I.some(v=>!isFinite(v))) return null;
    /** @type {number[]} */ const D=[0];
    for(let j=1;j<I.length-1;j++) D.push(Math.abs(I[j+1]-I[j-1]));
    D.push(0);
    let dmax=0; for(const v of D) dmax=Math.max(dmax,v);
    /** @type {{r:number, s:number}[]} */ const pics=[];
    for(let j=1;j<D.length-1;j++){
      if(!(D[j]>=0.3*dmax&&D[j]>=ML_DISQUE_SAUT&&D[j]>=D[j-1]&&D[j]>D[j+1])) continue;
      const den=D[j-1]-2*D[j]+D[j+1];
      const dj=den<0?Math.max(-0.5,Math.min(0.5,0.5*(D[j-1]-D[j+1])/den)):0;
      pics.push({r:rc*lo+(j+dj)*0.5,s:D[j]});
    }
    return {rc,pics};
  };
  /**
   * L'échelle ρ de l'ellipse que le plus de rayons confirment, dans [r0, r1] :
   * pour chaque ρ, les rayons qui ont un saut à ρ·rc près de la tolérance.
   * Rend le plus extérieur des plateaux qui atteignent `part` du meilleur — et
   * au moins `min` rayons —, pris en son sommet.
   * @param {{ux:number, uy:number, rc:number, pics:{r:number, s:number}[]}[]} rayons
   * @param {number} a @param {number} b @param {number} pas @param {number} tol
   * @param {number} part @param {number} min
   * @returns {{rho:number, n:number}|null}
   */
  const consensus=(rayons,a,b,pas,tol,part,min)=>{
    /** @type {{rho:number, n:number}[]} */
    const c=[];
    let nMax=0;
    for(let rho=a;rho<=b+1e-9;rho+=pas){
      let n=0;
      for(const R2 of rayons){
        const cible=rho*R2.rc, t=Math.max(0.7,tol*R2.rc);
        if(R2.pics.some(q=>Math.abs(q.r-cible)<=t)) n++;
      }
      c.push({rho,n}); nMax=Math.max(nMax,n);
    }
    const seuil2=Math.max(min,part*nMax);
    let fin=-1;
    for(let i=0;i<c.length;i++) if(c[i].n>=seuil2) fin=i;
    if(fin<0) return null;
    let deb=fin;
    while(deb>0&&c[deb-1].n>=seuil2) deb--;
    let best=c[deb];
    for(let i=deb;i<=fin;i++) if(c[i].n>best.n) best=c[i];
    return best;
  };
  /** @param {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}} E @param {number[]} q @returns {number} */
  const ecart=(E,q)=>{ const dx=q[0]-E.cx, dy=q[1]-E.cy, d=Math.hypot(dx,dy); return d?Math.abs(d-d/_mlxEllipseRho(E,dx,dy)):Infinity; };
  // ── LA PREMIÈRE PASSE, PAR TIRAGES (RANSAC) ──
  // Le vote ne donne qu'une ellipse grossière : quelques pixels de centre,
  // quelques pour cent de rayon — assez pour qu'un anneau à échelle unique ne
  // s'aligne plus, et qu'un décor à barreaux (les montants d'une cage) passe
  // devant le bord. On tire donc six rayons répartis sur le tour, un saut sur
  // chacun — les plus nets plus souvent —, l'ellipse qui passe au plus près
  // de ces six points, et on compte les rayons qui la confirment. La meilleure
  // l'emporte. Le tirage est FIXE (même graine à chaque fois) : un même
  // toucher sur une même image rend toujours la même échelle.
  {
    const N=ML_DISQUE_RAYONS;
    /** @type {({x:number, y:number, s:number}[]|null)[]} */
    const parRayon=[];
    let nVus=0;
    for(let k=0;k<N;k++){
      const th=2*Math.PI*k/N, ux=Math.cos(th), uy=Math.sin(th);
      const pr=profil(ell,ux,uy,0.7,1.3);
      if(pr&&pr.pics.length){ parRayon.push(pr.pics.map(q=>({x:ell.cx+ux*q.r,y:ell.cy+uy*q.r,s:q.s}))); nVus++; }
      else parRayon.push(null);
    }
    if(nVus<ML_DISQUE_COUV*N) return {erreur:'bord'};
    let graine=0x2545f491;
    const alea=()=>{ graine^=graine<<13; graine^=graine>>>17; graine^=graine<<5; return (graine>>>0)/4294967296; };
    /** @param {{x:number, y:number, s:number}[]} l */
    const tirer=l=>{ let t=0; for(const q of l) t+=q.s; let u=alea()*t; for(const q of l){ u-=q.s; if(u<=0) return q; } return l[l.length-1]; };
    const dMax=Math.max(5,0.4*rMax);
    /** @type {{cx:number, cy:number, a:number, b:number, ux:number, uy:number}|null} */
    let best=null;
    let scoreMax=0;
    for(let it=0;it<2500;it++){
      const dep=Math.floor(alea()*N);
      /** @type {number[][]} */
      const six=[];
      for(let j=0;j<6;j++){
        const idx=((dep+Math.round(j*N/6)+Math.floor((alea()-0.5)*N/12))%N+N)%N;
        const l=parRayon[idx];
        if(!l) break;
        const q=tirer(l); six.push([q.x,q.y]);
      }
      if(six.length<6) continue;
      const e=mlEllipseAjuster(six);
      if(!e||e.b<0.25*e.a||e.b<rMin||e.a>1.1*rMax) continue;
      if(Math.hypot(e.cx-tx,e.cy-ty)>dMax||_mlxEllipseRho(e,tx-e.cx,ty-e.cy)>1) continue;
      const t=Math.max(1,0.008*e.a);
      let sc=0;
      for(const l of parRayon) if(l&&l.some(q=>ecart(e,[q.x,q.y])<=t)) sc++;
      // À score égal, la plus grande : le bord plutôt que le liseré.
      if(sc>scoreMax||(sc===scoreMax&&best&&e.a*e.b>best.a*best.b)){ scoreMax=sc; best=e; }
    }
    if(!best||scoreMax<ML_DISQUE_COUV*N) return {erreur:'bord'};
    const b0=best, t0=Math.max(1,0.008*b0.a);
    /** @type {number[][]} */
    const pts=[];
    for(const l of parRayon){
      if(!l) continue;
      let m=null, dm=Infinity;
      for(const q of l){ const d=ecart(b0,[q.x,q.y]); if(d<=t0&&d<dm){ dm=d; m=q; } }
      if(m) pts.push([m.x,m.y]);
    }
    const e=mlEllipseAjuster(pts);
    if(!e) return {erreur:'forme'};
    ell=e;
  }
  for(let passe=1;passe<3;passe++){
    // DEUX PASSES SERRÉES autour de l'ellipse ajustée.
    const fen=0.06, tol=0.008;
    /** @type {{ux:number, uy:number, rc:number, pics:{r:number, s:number}[]}[]} */
    const rayons=[];
    for(let k=0;k<ML_DISQUE_RAYONS;k++){
      const th=2*Math.PI*k/ML_DISQUE_RAYONS, ux=Math.cos(th), uy=Math.sin(th);
      const pr=profil(ell,ux,uy,1-fen,1+fen);
      if(pr&&pr.pics.length) rayons.push({ux,uy,rc:pr.rc,pics:pr.pics});
    }
    if(rayons.length<ML_DISQUE_COUV*ML_DISQUE_RAYONS) return {erreur:'bord'};
    // LE CONTOUR QUE LES RAYONS ONT EN COMMUN. Un bord du décor derrière le
    // disque — un tibia, la barre, un sac — ne se trouve que sur quelques
    // rayons ; un anneau du disque, sur presque tous. Parmi les anneaux
    // presque aussi confirmés que le meilleur, le plus extérieur.
    const cs=consensus(rayons,1-fen,1+fen,0.001,tol,0.7,0);
    if(!cs) return {erreur:'bord'};
    // UN POINT PAR RAYON : le saut le plus proche de ce contour.
    /** @type {number[][]} */
    const pts=[];
    for(const R2 of rayons){
      const cible=cs.rho*R2.rc, t=Math.max(0.7,tol*R2.rc);
      let meilleur=null, dm=Infinity;
      for(const q of R2.pics){ const d=Math.abs(q.r-cible); if(d<=t&&d<dm){ dm=d; meilleur=q; } }
      if(meilleur) pts.push([ell.cx+R2.ux*meilleur.r,ell.cy+R2.uy*meilleur.r]);
    }
    if(pts.length<ML_DISQUE_COUV*ML_DISQUE_RAYONS) return {erreur:'bord'};
    let e=mlEllipseAjuster(pts);
    if(!e) return {erreur:'forme'};
    // LES POINTS QUI S'ÉCARTENT DE L'ELLIPSE SONT ÉCARTÉS, puis on la refait.
    const e0=e;
    const ec0=pts.map(q=>ecart(e0,q)).sort((u,v)=>u-v);
    const lim=Math.max(1,3*ec0[Math.floor(ec0.length/2)]);
    gardes=pts.filter(q=>ecart(e0,q)<=lim);
    if(gardes.length<ML_DISQUE_COUV*ML_DISQUE_RAYONS) return {erreur:'bord'};
    e=mlEllipseAjuster(gardes);
    if(!e) return {erreur:'forme'};
    const e1=e;
    const ec=gardes.map(q=>ecart(e1,q)).sort((u,v)=>u-v);
    residu=ec[Math.floor(ec.length/2)];
    ell=e1;
  }
  let couverture=gardes.length/ML_DISQUE_RAYONS;
  // ── 3. LES DEUX BOUTS DU DIAMÈTRE, là où il se mesure ──
  // UN BORD ARRONDI OU UNE LÈVRE : le contour le plus confirmé peut être un
  // anneau intérieur — le liseré d'un bumper se voit tout autour, son bord
  // extérieur seulement là où le décor contraste. Or l'échelle ne dépend que
  // des DEUX BOUTS DU GRAND AXE. On y regarde de près : un éventail de 31
  // rayons autour de chaque bout, les profils alignés sur l'ellipse, et la
  // force des sauts MOYENNÉE. Le bord du disque est au même endroit sur tous
  // les rayons et s'additionne ; le décor, jamais au même endroit, se dilue.
  // ⚠ UN BORD EXTÉRIEUR SE VOIT AUX DEUX BOUTS, AU MÊME RAPPORT. Le bord et
  //   son liseré sont concentriques : au-delà de l'anneau trouvé, le vrai bord
  //   est à la même distance relative en haut et en bas. Une ligne du décor —
  //   le bord d'un banc sous le disque — ne l'est qu'à un bout : elle est
  //   refusée, et l'anneau trouvé reste le bord.
  {
    const E0=ell;
    const P0=0.9, P1=1.1, PAS=0.0025, n=Math.round((P1-P0)/PAS)+1;
    /**
     * La force moyenne des sauts le long de l'éventail d'un bout.
     * @param {number} sens  +1 : le bout (cx,cy)+a·u ; -1 : l'autre
     * @returns {number[]}
     */
    const eventail=sens=>{
      const th0=Math.atan2(sens*E0.uy,sens*E0.ux);
      const somme=new Float32Array(n), nb=new Float32Array(n);
      for(let dg=-15;dg<=15;dg++){
        const th=th0+dg*Math.PI/180, ux=Math.cos(th), uy=Math.sin(th);
        const rc=1/_mlxEllipseRho(E0,ux,uy);
        /** @type {number[]} */ const I=[];
        for(let j=0;j<n;j++) I.push(lire(E0.cx+ux*rc*(P0+j*PAS),E0.cy+uy*rc*(P0+j*PAS)));
        // La dérivée sur un pixel, quel que soit le pas en part du rayon.
        const dj=Math.max(1,Math.round(0.5/(rc*PAS)));
        for(let j=dj;j<n-dj;j++){
          const d=Math.abs(I[j+dj]-I[j-dj]);
          if(isFinite(d)){ somme[j]+=d; nb[j]++; }
        }
      }
      return Array.from(somme,(s,j)=>nb[j]>=10?s/nb[j]:0);
    };
    /** @param {number[]} D @param {number} j @returns {number} la position au dixième de pas */
    const sommet=(D,j)=>{
      const den=D[j-1]-2*D[j]+D[j+1];
      return j+(den<0?Math.max(-0.5,Math.min(0.5,0.5*(D[j-1]-D[j+1])/den)):0);
    };
    const j1=Math.round((1-P0)/PAS), jMax=Math.round((1.08-P0)/PAS);
    /** @param {number[]} D */
    const lire2=D=>{
      // L'anneau trouvé, autour de ρ = 1, et les sauts francs au-delà.
      let s1=0, js=j1;
      for(let j=j1-6;j<=j1+6;j++) if(D[j]>s1){ s1=D[j]; js=j; }
      /** @type {number[]} */ const dehors=[];
      for(let j=js+4;j<=jMax;j++) if(D[j]>=0.35*s1&&D[j]>=D[j-1]&&D[j]>D[j+1]) dehors.push(j);
      return {s1,js,dehors};
    };
    const Dh=eventail(1), Db=eventail(-1), H=lire2(Dh), B2=lire2(Db);
    if(H.s1>0&&B2.s1>0){
      let jh=H.js, jb=B2.js;
      // Le plus extérieur des bords vus aux deux bouts au même rapport à leur
      // anneau, à 0,6 % près — sinon l'anneau trouvé. LE RAPPORT, et non la
      // position : un centre décalé d'un pixel décale les deux bouts d'autant.
      /** @param {number} j @param {number} js @returns {number} */
      const rap=(j,js)=>(P0+j*PAS)/(P0+js*PAS);
      for(let i=H.dehors.length-1;i>=0;i--){
        const rh=rap(H.dehors[i],H.js);
        const k=B2.dehors.find(j=>Math.abs(rap(j,B2.js)-rh)<=0.006);
        if(k!==undefined){ jh=H.dehors[i]; jb=k; break; }
      }
      const k1=P0+sommet(Dh,jh)*PAS, k2=P0+sommet(Db,jb)*PAS;
      // LE DIAMÈTRE : de bout à bout ; le centre au milieu, la forme gardée.
      const km=(k1+k2)/2;
      ell={...E0,cx:E0.cx+E0.ux*E0.a*(k1-k2)/2,cy:E0.cy+E0.uy*E0.a*(k1-k2)/2,a:E0.a*km,b:E0.b*km};
    }
  }
  if(residu>Math.max(0.8,ML_DISQUE_RESIDU*ell.a)) return {erreur:'forme'};
  if(ell.b<0.25*ell.a||2*ell.a<ML_ECHELLE_MIN_PX||ell.a>Math.max(w,h)) return {erreur:'forme'};
  if(_mlxEllipseRho(ell,tx-ell.cx,ty-ell.cy)>1) return {erreur:'dehors'};
  // Les deux bouts du grand axe, le plus haut d'abord. UN DISQUE PRESQUE
  // ROND — vu de face, à 3 % près — n'a pas de grand axe qui vaille : son
  // orientation n'est que le bruit de l'ajustement, et le petit axe n'est
  // qu'un côté où le liseré a pris la place du bord. On garde la longueur du
  // GRAND axe, mais VERTICALE : l'échelle se lit du haut au bas du disque,
  // comme le coach la poserait.
  const rond=ell.b>=0.97*ell.a;
  let A=rond?[ell.cx,ell.cy-ell.a]:[ell.cx+ell.ux*ell.a,ell.cy+ell.uy*ell.a];
  let B=rond?[ell.cx,ell.cy+ell.a]:[ell.cx-ell.ux*ell.a,ell.cy-ell.uy*ell.a];
  if(A[1]>B[1]){ const t=A; A=B; B=t; }
  return {...ell,A,B,couverture,residu};
}

// ── LE DESSIN ──────────────────────────────────────────────────────────────
/**
 * Tous les tracés visibles à `sMs`, puis la légende. PARTAGÉ par l'éditeur, le
 * lecteur annoté de l'athlète et la correction commentée : le coach et
 * l'athlète voient le même dessin, parce que c'est le même code.
 *
 * L'ÉCHELLE SUIT L'IMAGE : une épaisseur de 4 px est pensée pour une image de
 * 720 px de haut, et s'affine d'autant sur l'écran d'un téléphone.
 * @param {CanvasRenderingContext2D} g
 * @param {RectImage} R
 * @param {DocAnnot} doc
 * @param {number} sMs
 * @param {{sel?:string|null, poignees?:boolean, comparaison?:boolean, apercu?:Annot|null, echelle?:boolean}} [o]
 *   `echelle` : montrer le tracé de l'échelle — l'éditeur seul le demande.
 */
function mlDessinerAnnotations(g,R,doc,sMs,o){
  const opt=o||{};
  const k=Math.max(0.45,R.vh*R.s/720);
  /** @param {number[]} p @returns {number[]} */
  const P=p=>[R.ox+p[0]/1000*R.vw*R.s,R.oy+p[1]/1000*R.vh*R.s];
  const liste=(doc&&Array.isArray(doc.a)?doc.a:[]).slice();
  if(opt.apercu) liste.push(opt.apercu);
  // LES MESURES S'ÉCRIVENT APRÈS TOUS LES TRACÉS : un trait posé ensuite ne
  // doit pas barrer le chiffre d'un autre.
  const mmpx=mlEchelleMmPx(doc&&doc.ech,R.vw,R.vh);
  /** @type {{x:number, y:number, txt:string}[]} */
  const mesures=[];
  g.save();
  for(const a of liste){
    const estApercu=!!opt.apercu&&a===opt.apercu;
    if(!estApercu&&!mlAnnotVisible(a,sMs,opt.comparaison)) continue;
    const pts=mlAnnotPointsA(a,sMs).map(P);
    if(!pts.length) continue;
    // UNE TRAJECTOIRE SUIVIE SE TRACE AVEC LE MOUVEMENT : on n'en dessine que
    // la part déjà parcourue, et un point en tête. Les poignées, elles, restent
    // sur le tracé entier — on édite toute la trajectoire, pas son début.
    const vue=_mlxVue(a,pts,sMs,estApercu);
    _mlxDessinerUne(g,a,vue.pts,k,R,sMs,!!opt.comparaison,vue.enCours);
    if(opt.sel===a.id&&opt.poignees) _mlxPoignees(g,pts,a.c,k);
    if(mmpx){ const m=_mlxMesPlace(a,vue.pts,k,R,mmpx); if(m) mesures.push(m); }
  }
  for(const m of mesures) _mlxMesure(g,m.x,m.y,m.txt,k);
  if(opt.echelle&&doc&&doc.ech) _mlxDessinerEchelle(g,R,doc.ech,k);
  if(doc&&doc.leg&&doc.leg.on) _mlxLegende(g,R,doc,sMs,k);
  g.restore();
}
/**
 * Les points d'un tracé TELS QU'ILS SONT DESSINÉS à `sMs` : une trajectoire
 * suivie n'en montre que la part parcourue. Le dessin, le toucher et le
 * déplacement de son étiquette lisent tous cette fonction.
 * ⚠ AVANT LE BUILD 1391, LE TOUCHER LISAIT LA TRAJECTOIRE ENTIÈRE : pendant
 *   qu'elle se traçait, son étiquette se dessinait près de la tête du tracé
 *   et se cherchait à son bout, cent pixels plus loin — le double-clic sur
 *   l'étiquette qu'on voyait ne la prenait pas.
 * @param {Annot} a
 * @param {number[][]} pts  les points entiers, en pixels d'écran
 * @param {number} sMs
 * @param {boolean} [apercu]
 * @returns {{pts:number[][], enCours:boolean}}
 */
function _mlxVue(a,pts,sMs,apercu){
  const tp=apercu?null:_mlxTempsTraj(a);
  return tp?mlTrajVue(pts,tp,sMs):{pts,enCours:false};
}
/**
 * La mesure d'un tracé, à sa place : celle de mlMesureTrace, décalée de `mo`
 * quand le coach l'a déplacée, et gardée dans l'image.
 * @param {Annot} a
 * @param {number[][]} pts  les points dessinés, en pixels d'écran
 * @param {number} k
 * @param {RectImage} R
 * @param {number} mmpx
 * @returns {{x:number, y:number, txt:string}|null}
 */
function _mlxMesPlace(a,pts,k,R,mmpx){
  const m=mlMesureTrace(a,pts,R.s,mmpx,k);
  if(!m||!m.txt) return null;
  const mo=Array.isArray(a.mo)&&a.mo.length===2?a.mo:[0,0];
  const x=m.x+mo[0]/1000*R.vw*R.s, y=m.y+mo[1]/1000*R.vh*R.s;
  const marge=10*k;
  return {x:Math.max(R.ox+marge,Math.min(R.ox+R.vw*R.s-marge,x)),
    y:Math.max(R.oy+marge,Math.min(R.oy+R.vh*R.s-marge,y)),txt:m.txt};
}
/** La taille du texte d'une mesure. @param {number} k @returns {number} */
function _mlxMesTaille(k){ return Math.round(Math.max(10,13*k)); }
/**
 * La boîte d'une mesure — pour le doigt, qui la saisit au double-clic.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y  le centre du texte
 * @param {string} txt
 * @param {number} k
 * @returns {{bx:number, by:number, w:number, h:number}}
 */
function _mlxMesBoite(g,x,y,txt,k){
  const fs=_mlxMesTaille(k);
  g.save(); g.font='800 '+fs+'px Montserrat, sans-serif';
  const w=g.measureText(txt).width; g.restore();
  return {bx:x-w/2-4*k,by:y-fs*0.7,w:w+8*k,h:fs*1.4};
}
/**
 * Une mesure : un nombre BLANC, sans cadre (Kevin, 22/09/2026 : « mesure en
 * blanc, pas de carré »). Un contour noir le garde lisible sur un mur blanc.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y  le centre du texte
 * @param {string} txt
 * @param {number} k
 */
function _mlxMesure(g,x,y,txt,k){
  const fs=_mlxMesTaille(k);
  g.save();
  g.font='800 '+fs+'px Montserrat, sans-serif';
  g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round'; g.setLineDash([]);
  g.lineWidth=Math.max(3,3.6*k); g.strokeStyle='rgba(0,0,0,.85)';
  g.strokeText(txt,x,y);
  g.fillStyle='#ffffff'; g.fillText(txt,x,y);
  g.restore();
}
/**
 * Le tracé de l'échelle : un trait blanc en tirets entre deux butées, comme
 * un pied à coulisse, et ce qu'il vaut. L'éditeur seul le montre — et plus du
 * tout une fois l'échelle enregistrée, sauf quand l'outil Échelle est armé.
 * @param {CanvasRenderingContext2D} g
 * @param {RectImage} R
 * @param {Echelle} ech
 * @param {number} k
 */
function _mlxDessinerEchelle(g,R,ech,k){
  const q=mlDecoderTrait(ech.p);
  if(q.length!==2) return;
  const A=[R.ox+q[0][0]/1000*R.vw*R.s,R.oy+q[0][1]/1000*R.vh*R.s];
  const B=[R.ox+q[1][0]/1000*R.vw*R.s,R.oy+q[1][1]/1000*R.vh*R.s];
  const dx=B[0]-A[0], dy=B[1]-A[1], L=Math.hypot(dx,dy);
  const nx=L?-dy/L:1, ny=L?dx/L:0, b=9*k;
  g.save();
  g.lineCap='round';
  /** @param {()=>void} tracer @param {number[]} tir */
  const trait=(tracer,tir)=>{
    g.setLineDash(tir); g.strokeStyle='rgba(0,0,0,.6)'; g.lineWidth=Math.max(3,4*k); g.beginPath(); tracer(); g.stroke();
    g.strokeStyle='#ffffff'; g.lineWidth=Math.max(1.5,2*k); g.beginPath(); tracer(); g.stroke();
  };
  if(L>1) trait(()=>{ g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); },[7*k,5*k]);
  for(const E of L>1?[A,B]:[A]) trait(()=>{ g.moveTo(E[0]-nx*b,E[1]-ny*b); g.lineTo(E[0]+nx*b,E[1]+ny*b); },[]);
  if(L>1){
    const txt=Number(ech.mm)>0?'Ø '+mlLongueurTexte(Number(ech.mm)):'Choisis le disque';
    // À CÔTÉ DU TRAIT, du côté de la main gauche du trait : sur le trait, le
    // texte cacherait le bord qu'on vise.
    // Et DANS L'IMAGE : près du bord droit, il passe de l'autre côté du trait.
    let sx=nx<0||(nx===0&&ny<0)?-1:1;
    const fs=_mlxMesTaille(k);
    g.font='800 '+fs+'px Montserrat, sans-serif';
    const w=g.measureText(txt).width, marge=6*k;
    /** @param {number} s @returns {number[]} */
    const place=s=>[(A[0]+B[0])/2+s*nx*(w/2+14*k),(A[1]+B[1])/2+s*ny*(fs+6*k)];
    /** @param {number[]} c @returns {boolean} */
    const dedans=c=>c[0]-w/2>=R.ox+marge&&c[0]+w/2<=R.ox+R.vw*R.s-marge&&c[1]-fs/2>=R.oy+marge&&c[1]+fs/2<=R.oy+R.vh*R.s-marge;
    if(!dedans(place(sx))&&dedans(place(-sx))) sx=-sx;
    const [cx,cy]=place(sx);
    _mlxMesure(g,Math.max(R.ox+w/2+marge,Math.min(R.ox+R.vw*R.s-w/2-marge,cx)),
      Math.max(R.oy+fs/2+marge,Math.min(R.oy+R.vh*R.s-fs/2-marge,cy)),txt,k);
  }
  g.restore();
}
/**
 * @param {CanvasRenderingContext2D} g
 * @param {Annot} a
 * @param {number[][]} pts  en pixels d'écran
 * @param {number} k
 * @param {RectImage} R
 * @param {number} sMs
 * @param {boolean} comparaison
 * @param {boolean} [enCours]  une trajectoire suivie encore en train de se tracer
 */
function _mlxDessinerUne(g,a,pts,k,R,sMs,comparaison,enCours){
  const lw=Math.max(1,a.e*k);
  g.lineCap='round'; g.lineJoin='round'; g.setLineDash([]);
  g.strokeStyle=a.c; g.fillStyle=a.c; g.lineWidth=lw;
  // UN LISERÉ SOMBRE sous chaque trait : un blanc sur un mur clair, un jaune
  // sur un sol doré se perdraient sinon dans l'image.
  // LE STYLE DU TRAIT, proportionné à l'épaisseur : des tirets deux fois et
  // demie plus longs que le trait n'est large, ou des points ronds de son
  // diamètre. Le liseré sombre suit le même rythme, tiret sous tiret.
  const tirets=a.st==='t'?[lw*2.4+5*k,lw*1.6+4*k]:a.st==='p'?[0.01,lw*1.9+2.5*k]:[];
  /** @param {()=>void} tracer */
  const avecLisere=tracer=>{
    g.save(); g.strokeStyle='rgba(0,0,0,.45)'; g.lineWidth=lw+2.5*k; g.setLineDash(tirets); tracer(); g.stroke(); g.restore();
    g.save(); g.setLineDash(tirets); tracer(); g.stroke(); g.restore();
  };
  const [x0,y0]=pts[0];
  switch(a.t){
    case 'ligne':
    case 'fleche':{
      if(pts.length<2) break;
      const [x1,y1]=pts[1];
      avecLisere(()=>{ g.beginPath(); g.moveTo(x0,y0); g.lineTo(x1,y1); });
      if(a.t==='fleche') _mlxPointe(g,x0,y0,x1,y1,lw,a.c);
      break;
    }
    case 'libre':
    case 'courbe':{
      if(pts.length<2){ if(enCours&&pts.length) _mlxPastille(g,x0,y0,Math.max(4,6*k),a.c); break; }
      const l=a.t==='courbe'?mlCatmull(pts,12):pts;
      avecLisere(()=>{
        g.beginPath(); g.moveTo(l[0][0],l[0][1]);
        if(a.t==='libre'&&l.length>2){
          // Lissé par les milieux : un tracé à main levée garde son geste
          // sans les angles de la simplification.
          for(let i=1;i<l.length-1;i++){
            const mx=(l[i][0]+l[i+1][0])/2, my=(l[i][1]+l[i+1][1])/2;
            g.quadraticCurveTo(l[i][0],l[i][1],mx,my);
          }
          g.lineTo(l[l.length-1][0],l[l.length-1][1]);
        } else for(let i=1;i<l.length;i++) g.lineTo(l[i][0],l[i][1]);
      });
      // LE SENS DU MOUVEMENT : une pointe au bout d'une trajectoire — ou, tant
      // qu'elle se trace, le point qui suit le détail.
      const n=l.length;
      if(enCours) _mlxPastille(g,l[n-1][0],l[n-1][1],Math.max(4,6*k),a.c);
      else if(n>=2) _mlxPointe(g,l[Math.max(0,n-4)][0],l[Math.max(0,n-4)][1],l[n-1][0],l[n-1][1],lw,a.c);
      break;
    }
    case 'cercle':{
      if(pts.length<2) break;
      const r=Math.hypot(pts[1][0]-x0,pts[1][1]-y0);
      avecLisere(()=>{ g.beginPath(); g.arc(x0,y0,r,0,Math.PI*2); });
      break;
    }
    case 'rect':
    case 'zone':{
      if(pts.length<2) break;
      const x=Math.min(x0,pts[1][0]), y=Math.min(y0,pts[1][1]);
      const w=Math.abs(pts[1][0]-x0), h=Math.abs(pts[1][1]-y0);
      if(a.t==='zone'){
        // LA ZONE DE SURBRILLANCE : un voile de la couleur, un bord fin en
        // tirets. Elle désigne, elle ne cache pas.
        g.save(); g.globalAlpha=0.22; g.fillRect(x,y,w,h); g.restore();
        g.save(); g.lineWidth=Math.max(1,1.5*k);
        // Son bord est en tirets de naissance ; en pointillé, des points ronds.
        if(a.st==='p'){ g.lineWidth=Math.max(1.5,2.2*k); g.setLineDash([0.01,4.5*k]); } else g.setLineDash([6*k,4*k]);
        g.strokeRect(x,y,w,h); g.restore();
      } else avecLisere(()=>{ g.beginPath(); g.rect(x,y,w,h); });
      break;
    }
    case 'angle':{
      if(pts.length<3) break;
      const [A,B,C]=pts;
      avecLisere(()=>{ g.beginPath(); g.moveTo(A[0],A[1]); g.lineTo(B[0],B[1]); g.lineTo(C[0],C[1]); });
      const a1=Math.atan2(A[1]-B[1],A[0]-B[0]), a2=Math.atan2(C[1]-B[1],C[0]-B[0]);
      let d=a2-a1; while(d>Math.PI) d-=2*Math.PI; while(d<-Math.PI) d+=2*Math.PI;
      const rA=Math.max(14,26*k);
      g.save(); g.lineWidth=Math.max(1,2*k); g.globalAlpha=0.9;
      g.beginPath(); g.arc(B[0],B[1],rA,a1,a1+d,d<0); g.stroke(); g.restore();
      // L'ANGLE CIBLE, en comparaison : la branche où la cible voudrait le
      // bras, en tirets verts, depuis le même sommet.
      const an=mlAngleAnnot(a,sMs,R.vw,R.vh);
      if(comparaison&&an&&an.cible!==null){
        const sens=d<0?-1:1, lc=Math.hypot(C[0]-B[0],C[1]-B[1]);
        const ac=a1+sens*an.cible*Math.PI/180;
        g.save(); g.strokeStyle='#22c55e'; g.lineWidth=Math.max(1,lw*0.8); g.setLineDash([7*k,5*k]);
        g.beginPath(); g.moveTo(B[0],B[1]); g.lineTo(B[0]+Math.cos(ac)*lc,B[1]+Math.sin(ac)*lc); g.stroke(); g.restore();
      }
      for(const q of pts) _mlxPastille(g,q[0],q[1],Math.max(3,4*k),a.c);
      break;
    }
    case 'point':{
      if(a.rel&&pts.length>1) avecLisere(()=>{ g.beginPath(); pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1])); });
      /** @type {string[]} */
      const lb=Array.isArray(a.lb)?a.lb:[];
      pts.forEach((q,i)=>{
        _mlxPastille(g,q[0],q[1],Math.max(4,6*k),a.c);
        if(lb[i]) _mlxEtiquette(g,q[0]+9*k,q[1]-9*k,lb[i],a.c,k,R,true);
      });
      break;
    }
    case 'texte':{
      _mlxTexte(g,a,x0,y0,k,R);
      return;
    }
  }
  // LE NOM SUR L'IMAGE, écrit dans la couleur de son tracé — éteint à la
  // demande, et jamais pour un texte, qui se dit lui-même.
  //
  // ⚠ PLUS DE FIL ENTRE L'ÉTIQUETTE DÉPLACÉE ET SON TRACÉ. Kevin, 22/09/2026 :
  //   « la légende ne doit pas avoir de trait qui relie au tracé, sinon on se
  //   perd — juste un rectangle avec le titre qu'on peut bouger, de la même
  //   couleur de police que le trait ». Le fil du build 1384 ajoutait un trait
  //   de plus sur une image déjà faite de traits : on ne savait plus lequel
  //   était une mesure. C'est désormais la COULEUR DU TEXTE qui rattache
  //   l'étiquette à son tracé, où qu'on la pose.
  const pl=_mlxEtiqPlace(a,pts,k,R,sMs);
  if(pl) _mlxEtiquette(g,pl.x,pl.y,pl.lib,a.c,k,R,false);
}
/**
 * Les instants d'une trajectoire suivie, un par point — ou null.
 * @param {Annot} a
 * @returns {number[]|null}
 */
function _mlxTempsTraj(a){
  if(a.t!=='libre'||typeof a.tp!=='string'||!a.tp) return null;
  const l=a.tp.split(' ').map(Number);
  return l.length>=2&&l.every(x=>isFinite(x))?l:null;
}
/**
 * PURE. La part d'une trajectoire suivie déjà parcourue à `sMs` : les points
 * passés, puis la tête, interpolée entre le dernier point passé et le suivant.
 * Avant le premier instant, le seul point de départ ; après le dernier, tout.
 * @param {number[][]} pts
 * @param {number[]} tp  un instant par point, croissants
 * @param {number} sMs
 * @returns {{pts:number[][], enCours:boolean}}
 */
function mlTrajVue(pts,tp,sMs){
  if(!tp||tp.length!==pts.length||pts.length<2) return {pts,enCours:false};
  if(sMs>=tp[tp.length-1]) return {pts,enCours:false};
  if(sMs<=tp[0]) return {pts:[pts[0]],enCours:true};
  let i=0;
  while(i<tp.length-2&&tp[i+1]<=sMs) i++;
  const f=(sMs-tp[i])/Math.max(1,tp[i+1]-tp[i]);
  const tete=[pts[i][0]+(pts[i+1][0]-pts[i][0])*f,pts[i][1]+(pts[i+1][1]-pts[i][1])*f];
  return {pts:pts.slice(0,i+1).concat([tete]),enCours:true};
}
/**
 * Où se pose le nom d'un tracé : le point du tracé auquel il se rattache, et
 * le coin de son étiquette — décalé de `eo` quand le coach l'a déplacée.
 * `eo` est en millièmes de l'image, comme les points : l'étiquette garde sa
 * place sur un téléphone comme sur un poste, et dans l'export.
 * @param {Annot} a
 * @param {number[][]} pts  en pixels d'écran
 * @param {number} k
 * @param {RectImage} R
 * @param {number} sMs
 * @returns {{ref:number[], x:number, y:number, lib:string}|null}
 */
function _mlxEtiqPlace(a,pts,k,R,sMs){
  if(a.et===0||a.t==='texte'||!pts.length) return null;
  const an=a.t==='angle'?mlAngleAnnot(a,sMs,R.vw,R.vh):null;
  const lib=an?a.n+' '+an.val+'°':a.n;
  const x0=pts[0][0], y0=pts[0][1];
  const rc=a.t==='cercle'&&pts.length>1?Math.hypot(pts[1][0]-x0,pts[1][1]-y0)*0.72:0;
  const ref=a.t==='angle'&&pts.length>1?pts[1]:a.t==='cercle'?[x0+rc,y0-rc]:pts[pts.length-1];
  const eo=Array.isArray(a.eo)&&a.eo.length===2?a.eo:[0,0];
  return {ref,x:ref[0]+12*k+eo[0]/1000*R.vw*R.s,y:ref[1]-12*k+eo[1]/1000*R.vh*R.s,lib};
}
/**
 * La pointe d'une flèche, au bout (x1,y1), dans la direction de (x0,y0)→(x1,y1).
 * @param {CanvasRenderingContext2D} g
 * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1
 * @param {number} lw
 * @param {string} c
 */
function _mlxPointe(g,x0,y0,x1,y1,lw,c){
  const ang=Math.atan2(y1-y0,x1-x0), L=Math.max(10,lw*3.4);
  if(!isFinite(ang)||Math.hypot(x1-x0,y1-y0)<2) return;
  g.save(); g.fillStyle=c; g.beginPath();
  g.moveTo(x1+Math.cos(ang)*lw*0.6,y1+Math.sin(ang)*lw*0.6);
  g.lineTo(x1-Math.cos(ang-0.42)*L,y1-Math.sin(ang-0.42)*L);
  g.lineTo(x1-Math.cos(ang+0.42)*L,y1-Math.sin(ang+0.42)*L);
  g.closePath(); g.fill(); g.restore();
}
/**
 * Un point : la couleur, cerclée de blanc puis d'un liseré sombre.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y @param {number} r
 * @param {string} c
 */
function _mlxPastille(g,x,y,r,c){
  g.save();
  g.beginPath(); g.arc(x,y,r+2.5,0,Math.PI*2); g.fillStyle='rgba(0,0,0,.5)'; g.fill();
  g.beginPath(); g.arc(x,y,r+1.2,0,Math.PI*2); g.fillStyle='#ffffff'; g.fill();
  g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fillStyle=c; g.fill();
  g.restore();
}
/**
 * Les poignées du tracé choisi : un carré blanc bordé de sa couleur par point.
 * @param {CanvasRenderingContext2D} g
 * @param {number[][]} pts
 * @param {string} c
 * @param {number} k
 */
function _mlxPoignees(g,pts,c,k){
  const r=Math.max(5,6*k);
  g.save();
  for(const [x,y] of pts){
    g.fillStyle='#ffffff'; g.strokeStyle=c; g.lineWidth=2;
    g.beginPath(); g.rect(x-r,y-r,2*r,2*r); g.fill(); g.stroke();
  }
  g.restore();
}
/** Le fond d'une étiquette : presque opaque, pour que la couleur du texte se
 *  lise de la même façon sur un mur blanc et sur un fond noir. */
const MLX_ETIQ_FOND='rgba(8,8,8,.94)';
/** Le pire fond réel d'une étiquette — MLX_ETIQ_FOND posé sur une image
 *  blanche : 0,94 × 8 + 0,06 × 255 ≈ 23. C'est contre lui qu'on mesure. */
const MLX_ETIQ_FOND_PIRE=Object.freeze([23,23,23]);
/**
 * PURE. L'encre d'une étiquette : la couleur de son tracé, telle quelle tant
 * qu'elle se lit — contraste d'au moins 4,5:1 sur le pire fond. Sinon
 * éclaircie vers le blanc par dixièmes, juste assez : la teinte reste celle du
 * tracé, c'est elle qui dit à qui appartient l'étiquette.
 *
 * ⚠ LES SEPT COULEURS DE LA PALETTE PASSENT TELLES QUELLES — c'est pour elles
 *   que le fond a été monté de 0,84 à 0,94 d'opacité. Seule une couleur
 *   personnalisée trop sombre est éclaircie : un nom en gris anthracite sur
 *   fond noir serait une étiquette muette.
 * @param {string} c  « #rrggbb »
 * @returns {string} « #rrggbb »
 */
function mlEncreEtiquette(c){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(c||''));
  if(!m) return '#ffffff';
  const v=parseInt(m[1],16), rvb=[(v>>16)&255,(v>>8)&255,v&255];
  /** @param {number[]} q */
  const lum=q=>{
    const l=q.map(x=>{ const s=x/255; return s<=0.04045?s/12.92:Math.pow((s+0.055)/1.055,2.4); });
    return 0.2126*l[0]+0.7152*l[1]+0.0722*l[2];
  };
  const fond=lum([...MLX_ETIQ_FOND_PIRE]);
  for(let t=0;t<=10;t++){
    const q=rvb.map(x=>Math.round(x+(255-x)*t/10));
    if((lum(q)+0.05)/(fond+0.05)>=4.5)
      return '#'+q.map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  return '#ffffff';
}
/**
 * Une étiquette : un rectangle sombre, et le nom écrit dans la couleur de son
 * tracé. Elle reste dans l'image : poussée à gauche ou en bas si elle en
 * sortirait.
 *
 * ⚠ PLUS DE BORD COLORÉ NI DE TEXTE BLANC (Kevin, 22/09/2026) : « juste un
 *   rectangle avec le titre, de la même couleur de police que le trait ». La
 *   couleur passe du cadre au texte — c'est elle qui rattache l'étiquette à
 *   son tracé depuis que le fil a disparu. Un liseré neutre, celui de la
 *   légende d'ensemble, garde le rectangle lisible sur une image sombre.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y
 * @param {string} texte
 * @param {string} c
 * @param {number} k
 * @param {RectImage} R
 * @param {boolean} petite
 */
function _mlxEtiquette(g,x,y,texte,c,k,R,petite){
  if(!texte) return;
  const {bx,by,w,h,fs}=_mlxEtiqBoite(g,x,y,texte,k,R,petite);
  g.save();
  g.font='700 '+fs+'px Montserrat, sans-serif';
  g.textBaseline='middle'; g.textAlign='left';
  g.fillStyle=MLX_ETIQ_FOND;
  _mlxRectArrondi(g,bx,by,w,h,Math.min(6,h/3)); g.fill();
  g.strokeStyle='rgba(255,255,255,.16)'; g.lineWidth=1;
  _mlxRectArrondi(g,bx+0.5,by+0.5,w-1,h-1,Math.min(6,h/3)); g.stroke();
  g.fillStyle=mlEncreEtiquette(c);
  g.fillText(texte,bx+fs*0.55,by+h/2+0.5);
  g.restore();
}
/**
 * La boîte d'une étiquette, mesurée comme elle sera dessinée — le dessin et
 * le doigt qui la saisit lisent la MÊME, sans quoi on attraperait à côté.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y
 * @param {string} texte
 * @param {number} k
 * @param {RectImage} R
 * @param {boolean} petite
 * @returns {{bx:number, by:number, w:number, h:number, fs:number}}
 */
function _mlxEtiqBoite(g,x,y,texte,k,R,petite){
  // UN POIL PLUS PETIT (Kevin, 22/09/2026) : 12 et 10 au lieu de 13 et 11, et
  // un plancher à 9 — sans lui, sur téléphone, où k descend vers 0,5, les
  // deux tailles restaient collées à l'ancien plancher de 10 et rien n'aurait
  // changé à l'écran.
  const fs=Math.round(Math.max(9,(petite?10:12)*k));
  g.save(); g.font='700 '+fs+'px Montserrat, sans-serif';
  const w=Math.ceil(g.measureText(texte).width)+fs*1.1, h=Math.round(fs*1.9);
  g.restore();
  const xmax=R.ox+R.vw*R.s-4, ymax=R.oy+R.vh*R.s-4;
  let bx=Math.min(x,xmax-w);
  const by=Math.max(R.oy+4,Math.min(y-h/2,ymax-h));
  bx=Math.max(R.ox+4,bx);
  return {bx,by,w,h,fs};
}
/**
 * @param {CanvasRenderingContext2D} g
 * @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r
 */
function _mlxRectArrondi(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
}
/**
 * La géométrie d'un texte posé : sa boîte, centrée sur son point. Partagée par
 * le dessin et la sélection au doigt.
 * @param {CanvasRenderingContext2D} g
 * @param {Annot} a
 * @param {number} x @param {number} y
 * @param {number} k
 * @returns {{bx:number, by:number, w:number, h:number, fs:number}}
 */
function _mlxBoiteTexte(g,a,x,y,k){
  const fs=Math.round(Math.max(11,({s:15,m:21,l:30}[a.ts||'m']||21)*k));
  g.save(); g.font='900 '+fs+'px Montserrat, sans-serif';
  const w=Math.ceil(g.measureText(a.x||a.n).width)+fs*1.2;
  g.restore();
  const h=Math.round(fs*1.7);
  return {bx:x-w/2,by:y-h/2,w,h,fs};
}
/**
 * @param {CanvasRenderingContext2D} g
 * @param {Annot} a
 * @param {number} x @param {number} y
 * @param {number} k
 * @param {RectImage} R
 */
function _mlxTexte(g,a,x,y,k,R){
  const b=_mlxBoiteTexte(g,a,x,y,k);
  const xmin=R.ox+2, xmax=R.ox+R.vw*R.s-2;
  const bx=Math.max(xmin,Math.min(b.bx,xmax-b.w));
  g.save();
  if(a.tf===1||a.tf===2){
    g.globalAlpha=a.tf===1?0.8:0.92;
    g.fillStyle=a.tf===1?'#080808':a.c;
    _mlxRectArrondi(g,bx,b.by,b.w,b.h,Math.min(8,b.h/3)); g.fill();
    g.globalAlpha=1;
  }
  g.font='900 '+b.fs+'px Montserrat, sans-serif';
  g.textAlign='center'; g.textBaseline='middle';
  const coul=a.tf===2?(_mlxClair(a.c)?'#0b0b0b':'#ffffff'):a.c;
  if(a.tc){ g.lineWidth=Math.max(2,b.fs/7); g.strokeStyle='rgba(0,0,0,.85)'; g.lineJoin='round'; g.strokeText(a.x||a.n,bx+b.w/2,b.by+b.h/2+1); }
  g.fillStyle=coul;
  g.fillText(a.x||a.n,bx+b.w/2,b.by+b.h/2+1);
  g.restore();
}
/**
 * PURE. Une couleur claire, sur laquelle un texte doit être sombre.
 * @param {string} c
 * @returns {boolean}
 */
function _mlxClair(c){
  const m=/^#([0-9a-f]{6})$/i.exec(String(c));
  if(!m) return false;
  const n=parseInt(m[1],16), r=n>>16&255, v=n>>8&255, b=n&255;
  return (0.299*r+0.587*v+0.114*b)>160;
}
/**
 * LA LÉGENDE SUR LA VIDÉO : un titre, et une ligne par tracé — pastille, nom,
 * valeur d'un angle. Tous les tracés gardés dans la légende y sont, même hors
 * de leur durée, pour qu'elle ne saute pas pendant la lecture ; ceux qui ne
 * sont pas à l'écran à cet instant sont atténués.
 * @param {CanvasRenderingContext2D} g
 * @param {RectImage} R
 * @param {DocAnnot} doc
 * @param {number} sMs
 * @param {number} k
 */
/**
 * La légende mesurée : ses lignes, ses tailles, et sa boîte. Séparée du
 * dessin pour que le double-clic qui la saisit lise la même boîte.
 * @param {CanvasRenderingContext2D} g
 * @param {RectImage} R
 * @param {DocAnnot} doc
 * @param {number} sMs
 * @param {number} k
 */
function _mlxLegendeMesure(g,R,doc,sMs,k){
  const l=doc.a.filter(a=>!a.h&&a.lg!==0&&a.t!=='texte');
  const L=doc.leg;
  const e={s:0.8,m:1,l:1.25}[L.taille]||1;
  const fs=Math.round(Math.max(9,11*k*e)), ft=Math.round(Math.max(10,13*k*e));
  const pad=Math.round(10*k*e), lh=Math.round(fs*1.75);
  const lignes=l.slice(0,9);
  g.save();
  g.font='800 '+ft+'px Montserrat, sans-serif';
  let w=g.measureText(L.titre.toUpperCase()).width;
  g.font='600 '+fs+'px Montserrat, sans-serif';
  const libs=lignes.map(a=>mlAnnotLibelle(a,sMs,R.vw,R.vh));
  for(const t of libs) w=Math.max(w,g.measureText(t).width+fs*1.6);
  if(l.length>lignes.length) w=Math.max(w,g.measureText('+'+(l.length-lignes.length)+' autres').width);
  // L'ÉCHELLE DIT D'OÙ VIENNENT LES CENTIMÈTRES : le disque, et sa cote. Un
  // chiffre sans sa source ne se discute pas — celui-ci, l'athlète peut le
  // vérifier sur le disque qu'il a chargé.
  const ech=mlEchelleMmPx(doc.ech,R.vw,R.vh)&&doc.ech?doc.ech:null;
  const d=ech?mlDisqueDe(ech.src,ech.mm):null;
  const echTxt=!ech?'':'Échelle : '+(d?d.lib+' · ':'')+'Ø '+Math.round(Number(ech.mm))+' mm';
  if(echTxt) w=Math.max(w,g.measureText(echTxt).width);
  g.restore();
  w=Math.ceil(w)+pad*2;
  const h=pad*2+ft*1.5+lignes.length*lh+(l.length>lignes.length?lh:0)+(echTxt?lh:0);
  const marge=Math.round(10*k);
  let x=L.pos==='hd'||L.pos==='bd'?R.ox+R.vw*R.s-w-marge:R.ox+marge;
  let y=L.pos==='bg'||L.pos==='bd'?R.oy+R.vh*R.s-h-marge:R.oy+marge;
  // LA PLACE LIBRE (build 1384) : posée au double-clic, elle l'emporte sur le
  // coin choisi, et reste dans l'image quelle que soit sa taille d'affichage.
  if(typeof L.x==='number'&&typeof L.y==='number'){
    x=Math.max(R.ox+marge,Math.min(R.ox+L.x/1000*R.vw*R.s,R.ox+R.vw*R.s-w-marge));
    y=Math.max(R.oy+marge,Math.min(R.oy+L.y/1000*R.vh*R.s,R.oy+R.vh*R.s-h-marge));
  }
  return {l,L,fs,ft,pad,lh,lignes,libs,w,h,x,y,echTxt};
}
/**
 * @param {CanvasRenderingContext2D} g
 * @param {RectImage} R
 * @param {DocAnnot} doc
 * @param {number} sMs
 * @param {number} k
 */
function _mlxLegende(g,R,doc,sMs,k){
  const {l,L,fs,ft,pad,lh,lignes,libs,w,h,x,y,echTxt}=_mlxLegendeMesure(g,R,doc,sMs,k);
  g.save();
  const clair=L.fond==='clair';
  if(L.fond!=='aucun'){
    g.globalAlpha=L.op;
    g.fillStyle=clair?'#f4f4f4':'#080808';
    _mlxRectArrondi(g,x,y,w,h,Math.round(8*k)); g.fill();
    g.globalAlpha=Math.min(1,L.op+0.1);
    g.strokeStyle=clair?'rgba(0,0,0,.15)':'rgba(255,255,255,.18)'; g.lineWidth=1;
    _mlxRectArrondi(g,x+0.5,y+0.5,w-1,h-1,Math.round(8*k)); g.stroke();
    g.globalAlpha=1;
  }
  const encre=clair?'#111111':'#ffffff';
  if(L.fond==='aucun'){ g.shadowColor='rgba(0,0,0,.9)'; g.shadowBlur=4; }
  g.textBaseline='middle'; g.textAlign='left';
  g.font='800 '+ft+'px Montserrat, sans-serif'; g.fillStyle=encre;
  g.fillText(L.titre.toUpperCase(),x+pad,y+pad+ft*0.65);
  g.font='600 '+fs+'px Montserrat, sans-serif';
  lignes.forEach((a,i)=>{
    const yy=y+pad+ft*1.5+lh*i+lh/2;
    g.globalAlpha=mlAnnotVisible(a,sMs)?1:0.5;
    g.beginPath(); g.arc(x+pad+fs*0.45,yy,fs*0.42,0,Math.PI*2); g.fillStyle=a.c; g.fill();
    g.fillStyle=encre; g.fillText(libs[i],x+pad+fs*1.35,yy+0.5);
  });
  g.globalAlpha=1;
  if(l.length>lignes.length){
    g.fillStyle=clair?'#555555':'#bbbbbb';
    g.fillText('+'+(l.length-lignes.length)+' autres',x+pad,y+pad+ft*1.5+lh*lignes.length+lh/2);
  }
  if(echTxt){
    g.fillStyle=clair?'#555555':'#bbbbbb';
    g.fillText(echTxt,x+pad,y+pad+ft*1.5+lh*(lignes.length+(l.length>lignes.length?1:0))+lh/2);
  }
  g.restore();
}
/**
 * PURE. Le tracé touché au point (x,y) de l'écran, le plus haut d'abord : son
 * identifiant, et le rang du point saisi (-1 : le tracé entier). Seuls les
 * tracés à l'écran à `sMs` se touchent.
 * @param {DocAnnot} doc
 * @param {RectImage} R
 * @param {number} sMs
 * @param {number} x
 * @param {number} y
 * @param {{sel?:string|null, comparaison?:boolean, g?:CanvasRenderingContext2D|null}} [o]
 * @returns {{id:string, i:number}|null}
 */
function mlAnnotToucher(doc,R,sMs,x,y,o){
  const opt=o||{};
  const k=Math.max(0.45,R.vh*R.s/720);
  /** @param {number[]} p @returns {number[]} */
  const P=p=>[R.ox+p[0]/1000*R.vw*R.s,R.oy+p[1]/1000*R.vh*R.s];
  const tol=Math.max(10,9*k);
  /** @param {number[]} a @param {number[]} b @returns {number} */
  const dSeg=(a,b)=>{
    const dx=b[0]-a[0], dy=b[1]-a[1], L=dx*dx+dy*dy;
    const t=L?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/L)):0;
    return Math.hypot(x-(a[0]+t*dx),y-(a[1]+t*dy));
  };
  const l=(doc&&doc.a)||[];
  // LE TRACÉ CHOISI D'ABORD, pour ses poignées : on doit pouvoir saisir un de
  // ses points même quand un autre tracé passe par-dessus.
  const ordre=l.slice().reverse().sort((a,b)=>(b.id===opt.sel?1:0)-(a.id===opt.sel?1:0));
  for(const a of ordre){
    if(!mlAnnotVisible(a,sMs,opt.comparaison)) continue;
    const pts=mlAnnotPointsA(a,sMs).map(P);
    if(a.id===opt.sel){
      const i=pts.findIndex(q=>Math.hypot(q[0]-x,q[1]-y)<=tol+2);
      if(i>=0&&a.t!=='texte') return {id:a.id,i};
    }
    let touche=false;
    switch(a.t){
      case 'ligne': case 'fleche': touche=pts.length>1&&dSeg(pts[0],pts[1])<=tol; break;
      case 'libre': case 'point':
        touche=pts.some((q,i)=>i?dSeg(pts[i-1],q)<=tol:Math.hypot(q[0]-x,q[1]-y)<=tol); break;
      case 'courbe':{ const c=mlCatmull(pts,8); touche=c.some((q,i)=>i>0&&dSeg(c[i-1],q)<=tol); break; }
      case 'angle': touche=pts.length>2&&(dSeg(pts[0],pts[1])<=tol||dSeg(pts[1],pts[2])<=tol); break;
      case 'cercle':{
        if(pts.length<2) break;
        const r=Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]), d=Math.hypot(x-pts[0][0],y-pts[0][1]);
        touche=Math.abs(d-r)<=tol||d<=Math.min(r,tol*2); break;
      }
      case 'rect': case 'zone':{
        if(pts.length<2) break;
        const x1=Math.min(pts[0][0],pts[1][0]), x2=Math.max(pts[0][0],pts[1][0]);
        const y1=Math.min(pts[0][1],pts[1][1]), y2=Math.max(pts[0][1],pts[1][1]);
        touche=a.t==='zone'?(x>=x1-tol&&x<=x2+tol&&y>=y1-tol&&y<=y2+tol)
          :(x>=x1-tol&&x<=x2+tol&&y>=y1-tol&&y<=y2+tol&&!(x>x1+tol&&x<x2-tol&&y>y1+tol&&y<y2-tol));
        break;
      }
      case 'texte':{
        const g=opt.g;
        const b=g?_mlxBoiteTexte(g,a,pts[0][0],pts[0][1],k):{bx:pts[0][0]-60,by:pts[0][1]-16,w:120,h:32,fs:16};
        touche=x>=b.bx-4&&x<=b.bx+b.w+4&&y>=b.by-4&&y<=b.by+b.h+4; break;
      }
    }
    if(touche) return {id:a.id,i:-1};
  }
  return null;
}

/**
 * L'étiquette touchée au point (x,y) de l'écran — la légende d'abord, qui se
 * dessine par-dessus tout, puis le tracé le plus haut.
 * @param {DocAnnot} doc
 * @param {RectImage} R
 * @param {number} sMs
 * @param {number} x
 * @param {number} y
 * @param {CanvasRenderingContext2D} g
 * @param {boolean} [comparaison]
 * @returns {{kind:string, id:string}|null}
 */
function mlEtiquetteToucher(doc,R,sMs,x,y,g,comparaison){
  if(!doc||!g) return null;
  const k=Math.max(0.45,R.vh*R.s/720);
  /** @param {number[]} p @returns {number[]} */
  const P=p=>[R.ox+p[0]/1000*R.vw*R.s,R.oy+p[1]/1000*R.vh*R.s];
  if(doc.leg&&doc.leg.on){
    const b=_mlxLegendeMesure(g,R,doc,sMs,k);
    if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) return {kind:'leg',id:''};
  }
  const l=(doc.a||[]).slice().reverse();
  // LES MESURES D'ABORD : elles se dessinent par-dessus les étiquettes.
  const mmpx=mlEchelleMmPx(doc.ech,R.vw,R.vh);
  if(mmpx) for(const a of l){
    if(!mlAnnotVisible(a,sMs,comparaison)) continue;
    const m=_mlxMesPlace(a,_mlxVue(a,mlAnnotPointsA(a,sMs).map(P),sMs).pts,k,R,mmpx);
    if(!m) continue;
    const b=_mlxMesBoite(g,m.x,m.y,m.txt,k);
    if(x>=b.bx-3&&x<=b.bx+b.w+3&&y>=b.by-3&&y<=b.by+b.h+3) return {kind:'mes',id:a.id};
  }
  for(const a of l){
    if(!mlAnnotVisible(a,sMs,comparaison)) continue;
    const pl=_mlxEtiqPlace(a,_mlxVue(a,mlAnnotPointsA(a,sMs).map(P),sMs).pts,k,R,sMs);
    if(!pl) continue;
    const b=_mlxEtiqBoite(g,pl.x,pl.y,pl.lib,k,R,false);
    if(x>=b.bx-3&&x<=b.bx+b.w+3&&y>=b.by-3&&y<=b.by+b.h+3) return {kind:'etiq',id:a.id};
  }
  return null;
}

// ── DÉPLACER UNE ÉTIQUETTE OU LA LÉGENDE (build 1384) ──────────────────────
//
// Kevin : « donne la possibilité, en double-cliquant sur la légende, de
// déplacer l'écriture, pour pas qu'elle se place sur la personne ». Le nom
// d'un tracé se pose à côté du tracé, et un angle au coude le met souvent en
// plein sur l'athlète. Double-clic sur l'étiquette — ou sur la légende — : elle
// suit la souris, et un clic la pose ; au doigt, on la fait glisser. Échap la
// rend à sa place d'avant.
/**
 * Le toucher précédent sur l'image, pour reconnaître un DOUBLE toucher : le
 * navigateur d'un téléphone n'envoie pas toujours de dblclick (Safari).
 * @type {{t:number, x:number, y:number}|null}
 */
let _mlxDernierToucher=null;
/**
 * Un double toucher — ou un double-clic — sur une étiquette ou la légende la
 * met en main. Les deux touchers ont pu commencer un tracé AU MÊME ENDROIT —
 * un point, un angle, une ligne au clic-clic — : il ne comptait pas, on le
 * retire. Un tracé commencé ailleurs, lui, reste : c'est le double-clic qui le
 * termine, comme avant.
 * @param {number} px  position sur le calque
 * @param {number} py
 * @returns {boolean}
 */
function _mlxEtiqDoubleToucher(px,py){
  const G=_mlxCalqueGeo();
  if(!_ml||!G||_ml.deplEtiq) return false;
  const R3=G.R;
  const hit=mlEtiquetteToucher(_ml.annot,R3,_mlxTempsMs(),px,py,G.g,_ml.comparaison);
  if(!hit) return false;
  const tr=_ml.trace;
  if(tr&&!tr.pts.every(p=>Math.hypot(R3.ox+p[0]/1000*R3.vw*R3.s-px,R3.oy+p[1]/1000*R3.vh*R3.s-py)<12)) return false;
  _ml.trace=null;
  return _mlxEtiqPrendre(hit,px,py);
}
/** @returns {{R:RectImage, g:CanvasRenderingContext2D, k:number, c:HTMLCanvasElement}|null} */
function _mlxCalqueGeo(){
  const c=_mlEl('ml-calque'), v=_mlVideo(), R=v?_mlVideoRect(v):null;
  if(!(c instanceof HTMLCanvasElement)||!R) return null;
  const g=c.getContext('2d');
  if(!g) return null;
  return {R,g,k:Math.max(0.45,R.vh*R.s/720),c};
}
/**
 * @param {{kind:string, id:string}} hit
 * @param {number} px  position sur le calque
 * @param {number} py
 */
function _mlxEtiqPrendre(hit,px,py){
  const G=_mlxCalqueGeo();
  if(!_ml||!G) return false;
  const {R,g,k}=G, sMs=_mlxTempsMs();
  /** @param {number[]} p @returns {number[]} */
  const P=p=>[R.ox+p[0]/1000*R.vw*R.s,R.oy+p[1]/1000*R.vh*R.s];
  let ox=0, oy=0;
  if(hit.kind==='leg'){ const b=_mlxLegendeMesure(g,R,_ml.annot,sMs,k); ox=b.x; oy=b.y; }
  else {
    const a=_mlxAnnot(hit.id);
    const vue=a?_mlxVue(a,mlAnnotPointsA(a,sMs).map(P),sMs).pts:[];
    const mmpx=mlEchelleMmPx(_ml.annot.ech,R.vw,R.vh);
    const pl=!a?null:hit.kind==='mes'?(mmpx?_mlxMesPlace(a,vue,k,R,mmpx):null):_mlxEtiqPlace(a,vue,k,R,sMs);
    if(!pl) return false;
    ox=pl.x; oy=pl.y;
    _ml.sel=hit.id;
    // ⚠ L'ÉDITEUR NE VIENT PAS EN VUE (build 1391). Choisir le tracé le fait
    //   défiler jusqu'à lui ; sur une seule colonne — téléphone, tablette,
    //   fenêtre étroite — la page partait vers le bas pendant qu'on tenait
    //   l'étiquette, et le clic qui devait la poser tombait dans le panneau.
    _mlxEdVu=hit.id;
  }
  _ml.deplEtiq={kind:hit.kind,id:hit.id,avant:JSON.stringify(_ml.annot),grab:[px-ox,py-oy]};
  _mlxApresSelection(); _mlxMajOutils();
  return true;
}
/** @param {number} px @param {number} py  position sur le calque */
function _mlxEtiqBouger(px,py){
  const d=_ml&&_ml.deplEtiq, G=_mlxCalqueGeo();
  if(!_ml||!d||!G) return false;
  const {R,k}=G, sMs=_mlxTempsMs();
  const tx=px-d.grab[0], ty=py-d.grab[1];
  /** @param {number} v @param {number} a @param {number} b @returns {number} */
  const borne=(v,a,b)=>Math.max(a,Math.min(b,Math.round(v)));
  if(d.kind==='leg'){
    _ml.annot={..._ml.annot,leg:{..._ml.annot.leg,x:borne((tx-R.ox)/(R.vw*R.s)*1000,0,1000),y:borne((ty-R.oy)/(R.vh*R.s)*1000,0,1000)}};
  } else {
    const a=_mlxAnnot(d.id);
    if(!a) return false;
    /** @param {number[]} p @returns {number[]} */
    const P=p=>[R.ox+p[0]/1000*R.vw*R.s,R.oy+p[1]/1000*R.vh*R.s];
    const vue=_mlxVue(a,mlAnnotPointsA(a,sMs).map(P),sMs).pts;
    if(d.kind==='mes'){
      // LA MESURE SE DÉPLACE COMME L'ÉTIQUETTE, mais garde son propre
      // décalage : on éloigne le chiffre sans emporter le nom, et l'inverse.
      const mmpx=mlEchelleMmPx(_ml.annot.ech,R.vw,R.vh);
      const m=mmpx?mlMesureTrace(a,vue,R.s,mmpx,k):null;
      if(!m) return false;
      const mo=[borne((tx-m.x)/(R.vw*R.s)*1000,-1000,1000),borne((ty-m.y)/(R.vh*R.s)*1000,-1000,1000)];
      _mlxChanger(d.id,x=>({...x,mo}));
    } else {
      const base=_mlxEtiqPlace({...a,eo:[0,0]},vue,k,R,sMs);
      if(!base) return false;
      const eo=[borne((tx-base.x)/(R.vw*R.s)*1000,-1000,1000),borne((ty-base.y)/(R.vh*R.s)*1000,-1000,1000)];
      _mlxChanger(d.id,x=>({...x,eo}));
    }
  }
  _mlDessinerCalque();
  return true;
}
/** Pose l'étiquette là où elle est : un pas d'historique, et c'est tout. */
function _mlxEtiqPoser(){
  const d=_ml&&_ml.deplEtiq;
  if(!_ml||!d) return false;
  _ml.deplEtiq=null;
  // Ramenée exactement à sa place : on ne garde pas un décalage nul.
  if(d.kind==='etiq') _mlxChanger(d.id,x=>{
    if(!Array.isArray(x.eo)||x.eo[0]||x.eo[1]) return x;
    const o={...x}; delete o.eo; return o;
  });
  if(d.kind==='mes') _mlxChanger(d.id,x=>{
    if(!Array.isArray(x.mo)||x.mo[0]||x.mo[1]) return x;
    const o={...x}; delete o.mo; return o;
  });
  if(JSON.stringify(_ml.annot)!==d.avant){
    _ml.annule.push(d.avant); if(_ml.annule.length>60) _ml.annule.shift(); _ml.refait=[];
  }
  _mlxApresChangement();
  return true;
}
function mlEtiqAnnuler(){
  const d=_ml&&_ml.deplEtiq;
  if(!_ml||!d) return false;
  _ml.annot=JSON.parse(d.avant);
  _ml.deplEtiq=null;
  _mlxApresChangement();
  return true;
}
/** L'étiquette du tracé choisi, rendue à sa place à côté du tracé. */
function mlEtiqReplacer(){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!Array.isArray(a.eo)) return false;
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{ const o={...x}; delete o.eo; return o; });
  _mlxApresChangement();
  return true;
}
/** La mesure du tracé choisi, rendue à sa place le long du tracé. */
function mlMesReplacer(){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!Array.isArray(a.mo)) return false;
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{ const o={...x}; delete o.mo; return o; });
  _mlxApresChangement();
  return true;
}
/** La légende, rendue au coin choisi dans son panneau. */
function mlLegendeReplacer(){
  if(!_ml||typeof _ml.annot.leg.x!=='number') return false;
  _mlxMemoriser();
  const L={..._ml.annot.leg}; delete L.x; delete L.y;
  _ml.annot={..._ml.annot,leg:L};
  _mlxApresChangement();
  return true;
}

// ── L'ÉCHELLE : LA POSER, CHOISIR SON DISQUE, L'ENREGISTRER (build 1391) ──
//
// Kevin, 22/09/2026 : « une fonction échelle qui demande de mettre le haut et
// le bas du poids ; on sélectionne la marque, ce qui met automatiquement les
// mesures sur les autres tracés ; puis un bouton “enregistrer la mesure” afin
// de faire disparaître le tracé de la vidéo mais garder la donnée pour les
// calculs ».
//
// LE HAUT ET LE BAS, PAS LE BORD GAUCHE ET LE BORD DROIT. Un disque vu un peu
// de biais devient une ellipse : sa largeur rétrécit, sa HAUTEUR reste son
// diamètre. C'est ce que l'aide demande de pointer.
/**
 * Ce que le coach a retenu de ses disques, d'une vidéo à l'autre : le dernier
 * choisi — la salle change rarement —, et ceux qu'il a mesurés lui-même.
 * @returns {{dernier:string, mesures:Object<string,number>}}
 */
function _mlxDisquesCoach(){
  const d=currentUser&&currentUser.mlDisques&&typeof currentUser.mlDisques==='object'?currentUser.mlDisques:{};
  /** @type {Object<string,number>} */
  const mesures={};
  if(d.mesures&&typeof d.mesures==='object')
    for(const c of Object.keys(d.mesures).slice(0,40)){ const v=Number(d.mesures[c]); if(v>=100&&v<=600) mesures[c]=Math.round(v); }
  return {dernier:typeof d.dernier==='string'?d.dernier.slice(0,80):'',mesures};
}
/**
 * L'état du panneau pour une échelle : sa marque, sa gamme, sa charge — ou,
 * sans échelle, le dernier disque que le coach a choisi.
 * @param {Echelle|undefined} ech
 * @returns {{m:string, g:string, c:string, mm:string}}
 */
function _mlxEchUiDepuis(ech){
  let src=ech&&ech.src?String(ech.src):'';
  let mm=ech&&ech.mm?String(ech.mm):'';
  if(!src){
    const d=_mlxDisquesCoach();
    src=d.dernier;
    mm=src.indexOf('mesure|')===0&&d.mesures[src.slice(7)]?String(d.mesures[src.slice(7)]):'';
  }
  const s=src.split('|');
  if(s[0]==='mesure'&&s[1]) return {m:s[1],g:'mesure',c:s[2]||'',mm};
  const g=ML_DISQUES.find(x=>x.id===s[0]);
  if(!g) return {m:'',g:'',c:'',mm:''};
  return {m:g.m,g:g.id,c:g.c.some(x=>x[0]===s[1])?s[1]:'',mm:''};
}
/**
 * PURE. Le disque que désigne le panneau — {mm, src} —, ou null tant qu'il
 * manque un choix. Un disque mesuré doit l'être entre 10 et 60 cm : en dehors,
 * c'est une faute de frappe, pas un disque.
 * @param {{m:string, g:string, c:string, mm:string}} ui
 * @returns {{mm:number, src:string}|null}
 */
function mlEchChoix(ui){
  if(!ui||!ui.m||!ui.c) return null;
  if(ui.g==='mesure'){
    const mm=Number(String(ui.mm||'').replace(',','.'));
    return mm>=100&&mm<=600?{mm:Math.round(mm),src:'mesure|'+ui.m+'|'+ui.c}:null;
  }
  const g=ML_DISQUES.find(x=>x.id===ui.g&&x.m===ui.m);
  const c=g&&g.c.find(x=>x[0]===ui.c);
  return g&&c?{mm:c[1],src:g.id+'|'+c[0]}:null;
}
/** PURE. Les marques du panneau : celles du catalogue, puis celles à mesurer. @returns {string[]} */
function mlEchMarques(){
  /** @type {string[]} */
  const l=[];
  for(const g of ML_DISQUES) if(!l.includes(g.m)) l.push(g.m);
  for(const m of ML_DISQUES_A_MESURER) if(!l.includes(m)) l.push(m);
  return l;
}
/**
 * PURE. Les gammes d'une marque, et « je la mesure » quand la marque ne
 * publie pas toutes ses cotes.
 * @param {string} m
 * @returns {{id:string, lib:string}[]}
 */
function mlEchGammes(m){
  const l=ML_DISQUES.filter(x=>x.m===m).map(x=>({id:x.id,lib:x.g}));
  if(ML_DISQUES_A_MESURER.includes(m)) l.push({id:'mesure',lib:l.length?'Autre gamme — je la mesure':'Je mesure mon disque'});
  return l;
}
/** @param {string} m */
function mlEchMarque(m){
  if(!_ml) return false;
  const gs=mlEchGammes(m);
  _ml.echUi={m:String(m||''),g:gs.length===1?gs[0].id:'',c:'',mm:''};
  _mlxEchAppliquer();
  return true;
}
/** @param {string} g */
function mlEchGamme(g){
  if(!_ml) return false;
  _ml.echUi={..._ml.echUi,g:String(g||''),c:'',mm:''};
  _mlxEchAppliquer();
  return true;
}
/** @param {string} c */
function mlEchCharge(c){
  if(!_ml) return false;
  const ui=_ml.echUi;
  // LE DISQUE DÉJÀ MESURÉ SE RETROUVE : la même salle, le même 20 kg.
  const deja=ui.g==='mesure'?_mlxDisquesCoach().mesures[ui.m+'|'+c]:0;
  _ml.echUi={...ui,c:String(c||''),mm:ui.g==='mesure'?(deja?String(deja):ui.mm):''};
  _mlxEchAppliquer();
  return true;
}
/** @param {string} v  le diamètre mesuré, en mm */
function mlEchMm(v){
  if(!_ml) return false;
  _ml.echUi={..._ml.echUi,mm:String(v==null?'':v).trim().slice(0,8)};
  _mlxEchAppliquer();
  return true;
}
/**
 * Le disque choisi passe dans l'échelle posée. Un choix incomplet l'en
 * retire : garder le diamètre d'un disque qu'on n'a plus sous les yeux dans
 * le panneau mentirait sur toutes les mesures.
 */
function _mlxEchAppliquer(){
  if(!_ml) return;
  const e=_ml.annot.ech;
  if(e){
    const ch=mlEchChoix(_ml.echUi);
    if(ch&&(e.mm!==ch.mm||e.src!==ch.src)){
      _mlxMemoriser();
      _ml.annot={..._ml.annot,ech:{...e,mm:ch.mm,src:ch.src}};
    } else if(!ch&&(e.mm||e.src)){
      _mlxMemoriser();
      const n={...e}; delete n.mm; delete n.src; delete n.ok;
      _ml.annot={..._ml.annot,ech:n};
    }
  }
  _mlxApresChangement();
}
/**
 * Les deux points de l'échelle, posés à neuf : le disque choisi y entre, et
 * l'échelle redevient à enregistrer.
 * @param {number[]} a @param {number[]} b  normés
 */
function _mlxEchPoints(a,b){
  if(!_ml) return;
  const ch=mlEchChoix(_ml.echUi);
  /** @type {Echelle} */
  const ech={p:mlEchEncoder([a,b])};
  if(ch){ ech.mm=ch.mm; ech.src=ch.src; }
  _ml.annot={..._ml.annot,ech};
}
/**
 * PURE. Les deux points de l'échelle en texte, AU DIXIÈME : le bord trouvé
 * seul l'est au dixième de pixel, et des millièmes entiers de l'image en
 * perdraient la moitié. Un point entier s'écrit sans décimale.
 * @param {number[][]} pts  normés
 * @returns {string}
 */
function mlEchEncoder(pts){
  /** @param {number} v @returns {string} */
  const f=v=>String(Math.round(Math.max(0,Math.min(1000,v))*10)/10);
  return pts.map(p=>f(p[0])+','+f(p[1])).join(' ');
}
/**
 * L'image affichée, en niveaux de gris, à la taille de la vidéo. Une vidéo
 * d'une autre origine ne se lit pas depuis le lecteur — la toile est
 * « teintée » : on la relit alors à part, en crossOrigin, comme le suivi
 * (_mlExtraire), à l'instant affiché.
 * @returns {Promise<{gris:Float32Array, w:number, h:number}|{erreur:string}>}
 */
async function _mlxImageGris(){
  const v=_mlVideo();
  if(!_ml||!v||!(v.videoWidth>0&&v.videoHeight>0)) return {erreur:'video'};
  const w=v.videoWidth, h=v.videoHeight;
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true});
  if(g){ try{ g.drawImage(v,0,0,w,h); return {gris:mlGris(g.getImageData(0,0,w,h).data,w,h),w,h}; }catch(e){} }
  const t=_mlxTempsMs();
  /** @type {{tMs:number, gris:Float32Array}|null} */
  let im=null;
  const r=await _mlExtraire(_ml.url,Math.max(0,t-40),t+40,w,h,1000/30,x=>{
    // L'image qui couvre l'instant affiché : la plus proche de lui.
    if(!im||Math.abs(x.tMs-t)<Math.abs(im.tMs-t)) im=x;
    return x.tMs<t;
  },()=>!_ml);
  if(im) return {gris:/** @type {{tMs:number, gris:Float32Array}} */(im).gris,w,h};
  return {erreur:(r&&r.ok===false&&r.code)||'image'};
}
/**
 * Le toucher au centre d'un disque, en automatique : l'image affichée est
 * lue, le bord trouvé (mlDisqueDetecter), et les deux bouts du diamètre
 * deviennent l'échelle. L'ellipse trouvée reste dessinée tant que l'outil est
 * armé : le coach voit ce qui a été mesuré, et tire un bout s'il le faut.
 * @param {number[]} p  le toucher, normé
 */
async function _mlxEchDetecter(p){
  if(!_ml||_ml.echCherche) return false;
  _ml.echCherche=true; _ml.echEllipse=null;
  _mlxMajOutils(); _mlDessinerCalque();
  /** @type {{gris:Float32Array, w:number, h:number}|{erreur:string}} */
  let img;
  try{ img=await _mlxImageGris(); }catch(e){ img={erreur:'image'}; }
  if(!_ml) return false;
  _ml.echCherche=false;
  if('erreur' in img){
    toast(img.erreur==='cors'
      ?'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : pose le haut et le bas du disque à la main.'
      :'L’image n’a pas pu être lue : pose le haut et le bas du disque à la main.','var(--orange)');
    _ml.echAuto=false;
    _mlxMajOutils(); _mlDessinerCalque();
    return false;
  }
  const {gris,w,h}=img;
  const r=mlDisqueDetecter(gris,w,h,p[0]/1000*w,p[1]/1000*h,ML_ECHELLE_MIN_PX/2,0.5*Math.min(w,h));
  if('erreur' in r){
    toast(r.erreur==='dehors'
      ?'Le toucher tombe hors du disque trouvé : touche le centre du disque, sur son moyeu.'
      :'Aucun bord de disque net autour du toucher. Touche le centre sur une image nette — ou glisse du haut au bas pour le poser à la main.',
      'var(--orange)');
    _mlxMajOutils(); _mlDessinerCalque();
    return false;
  }
  _mlxMemoriser();
  _mlxEchPoints([r.A[0]/w*1000,r.A[1]/h*1000],[r.B[0]/w*1000,r.B[1]/h*1000]);
  const ech=_ml.annot.ech;
  _ml.echEllipse=ech?{p:ech.p,cx:r.cx,cy:r.cy,a:r.a,b:r.b,ux:r.ux,uy:r.uy,w,h,
    couverture:r.couverture,residu:r.residu}:null;
  _mlxApresChangement();
  return true;
}
/** @param {boolean} auto  automatique, ou à la main */
function mlEchMode(auto){
  if(!_ml) return false;
  _mlxEchAnnulerPose();
  _ml.echAuto=!!auto;
  _mlxMajOutils();
  return true;
}
/**
 * La loupe, pendant qu'on pose un bout de l'échelle : un pixel d'erreur sur
 * un disque de 200 pixels, c'est déjà 0,5 % sur tout ce qu'on mesure.
 * @param {number[]|null} p  normé, ou null pour la cacher
 */
function _mlxLoupeEchelle(p){
  const l=_mlEl('ml-loupe'), v=_mlVideo();
  if(!(l instanceof HTMLCanvasElement)) return;
  if(!p||!v||!v.videoWidth||!v.videoHeight){ l.hidden=true; return; }
  const c=l.getContext('2d'); if(!c) return;
  l.hidden=false;
  const x=p[0]/1000*v.videoWidth, y=p[1]/1000*v.videoHeight;
  const cote=Math.max(12,v.videoHeight*0.03), L=l.width, m=L/2;
  c.clearRect(0,0,L,L);
  try{ c.drawImage(v,x-cote,y-cote,2*cote,2*cote,0,0,L,L); }catch(e){}
  c.lineWidth=3; c.strokeStyle='rgba(0,0,0,.6)';
  c.beginPath(); c.moveTo(m-26,m); c.lineTo(m-6,m); c.moveTo(m+6,m); c.lineTo(m+26,m);
  c.moveTo(m,m-26); c.lineTo(m,m-6); c.moveTo(m,m+6); c.lineTo(m,m+26); c.stroke();
  c.lineWidth=1.5; c.strokeStyle='#ffffff'; c.stroke();
}
/**
 * Un toucher sur l'image quand l'outil Échelle est armé : un bout existant se
 * reprend, sinon le haut du disque se pose — glisser jusqu'au bas, ou toucher
 * le bas ensuite.
 * @param {PointerEvent} e
 * @param {HTMLElement} calque
 * @param {RectImage} R
 * @param {DOMRect} b
 * @param {(cx:number, cy:number)=>number[]} N
 */
function _mlxEchPointer(e,calque,R,b,N){
  if(!_ml) return;
  const v=_mlVideo(); try{ if(v) v.pause(); }catch(x){}
  const px=e.clientX-b.left, py=e.clientY-b.top;
  // LE CLIC D'ARRIVÉE d'une échelle commencée d'un clic : le bas du disque.
  const pose=_ml.echPose;
  if(pose){
    _ml.echPose=null;
    _mlxEchPoints(pose.a,N(e.clientX,e.clientY));
    _mlxLoupeEchelle(null);
    if(JSON.stringify(_ml.annot)!==pose.avant){ _ml.annule.push(pose.avant); if(_ml.annule.length>60) _ml.annule.shift(); _ml.refait=[]; }
    _mlxApresChangement();
    return;
  }
  const G=_mlxCalqueGeo();
  const tol=Math.max(12,11*(G?G.k:1));
  const ech=_ml.annot.ech;
  const q=ech?mlDecoderTrait(ech.p):[];
  const i=q.findIndex(p=>Math.hypot(R.ox+p[0]/1000*R.vw*R.s-px,R.oy+p[1]/1000*R.vh*R.s-py)<=tol);
  // UN PREMIER TOUCHER SUR UNE ÉTIQUETTE ne pose rien : c'est peut-être le
  // début d'un double-clic pour la déplacer.
  if(i<0&&G&&mlEtiquetteToucher(_ml.annot,R,_mlxTempsMs(),px,py,G.g,_ml.comparaison)) return;
  if(_ml.echCherche) return;
  const avant=JSON.stringify(_ml.annot);
  const depart=N(e.clientX,e.clientY);
  // EN AUTOMATIQUE, RIEN N'EST POSÉ AU PREMIER TOUCHER : s'il ne glisse pas,
  // c'est le centre du disque, et RepCore cherche son bord ; s'il glisse, le
  // coach pose l'échelle à la main, du haut au bas.
  const auto=_ml.echAuto;
  if(i<0&&!auto) _mlxEchPoints(depart,depart);
  _mlxLoupeEchelle(i>=0?q[i]:depart);
  _mlDessinerCalque();
  const x0=e.clientX, y0=e.clientY;
  let bouge=false;
  try{ calque.setPointerCapture(e.pointerId); }catch(x){}
  /** @param {PointerEvent} ev */
  const bouger=ev=>{
    if(!_ml) return;
    if(!bouge&&Math.hypot(ev.clientX-x0,ev.clientY-y0)<(i>=0?2:6)) return;
    if(i<0&&auto&&!bouge) _mlxEchPoints(depart,depart);
    bouge=true;
    const p=N(ev.clientX,ev.clientY);
    const e2=_ml.annot.ech;
    if(i>=0&&e2){
      const r=mlDecoderTrait(e2.p); r[i]=[_mlxBorne(p[0]),_mlxBorne(p[1])];
      _ml.annot={..._ml.annot,ech:{...e2,p:mlEchEncoder(r)}};
    } else if(i<0) _mlxEchPoints(depart,p);
    _mlxLoupeEchelle(p);
    _mlDessinerCalque();
  };
  const fin=()=>{
    calque.removeEventListener('pointermove',bouger);
    calque.removeEventListener('pointerup',fin);
    calque.removeEventListener('pointercancel',fin);
    _mlxLoupeEchelle(null);
    if(!_ml) return;
    // UN TOUCHER SANS GLISSER : en automatique, le centre du disque — RepCore
    // cherche son bord ; à la main, le haut — le bas viendra du clic suivant,
    // et la souris le montre d'ici là.
    if(i<0&&!bouge&&auto){ _mlxEchDetecter(depart); return; }
    if(i<0&&!bouge){ _ml.echPose={avant,a:depart}; _mlxMajOutils(); _mlDessinerCalque(); return; }
    if(JSON.stringify(_ml.annot)!==avant){ _ml.annule.push(avant); if(_ml.annule.length>60) _ml.annule.shift(); _ml.refait=[]; }
    _mlxApresChangement();
  };
  calque.addEventListener('pointermove',bouger);
  calque.addEventListener('pointerup',fin);
  calque.addEventListener('pointercancel',fin);
}
/**
 * Renonce à une échelle commencée d'un clic : le document revient à ce qu'il
 * était avant le premier toucher.
 * @returns {boolean}
 */
function _mlxEchAnnulerPose(){
  if(!_ml||!_ml.echPose) return false;
  _ml.annot=JSON.parse(_ml.echPose.avant);
  _ml.echPose=null;
  _mlxLoupeEchelle(null);
  _mlxApresChangement();
  return true;
}
/**
 * « Enregistrer la mesure » : le tracé de l'échelle quitte l'image — il ne
 * revient qu'avec l'outil Échelle —, la donnée reste et fait les centimètres.
 * Le disque est retenu pour la prochaine vidéo, et un disque mesuré à la
 * main l'est pour de bon.
 */
function mlEchEnregistrer(){
  if(!_ml) return false;
  const e=_ml.annot.ech, T=_mlxTailleVideo();
  if(!e){ toast('Pose d’abord le haut et le bas du disque sur la vidéo.','var(--orange)'); return false; }
  if(!(Number(e.mm)>0)||!e.src){ toast('Choisis le disque : marque, gamme et charge.','var(--orange)'); return false; }
  if(!mlEchelleMmPx(e,T.vw,T.vh)){
    toast('Le disque est trop petit à l’image pour mesurer juste : rapproche-toi ou zoome, puis repose l’échelle.','var(--orange)');
    return false;
  }
  _mlxMemoriser();
  _ml.annot={..._ml.annot,ech:{...e,ok:1}};
  _ml.echPose=null;
  if(currentUser){
    const d=_mlxDisquesCoach(), mesures={...d.mesures};
    if(e.src.indexOf('mesure|')===0) mesures[e.src.slice(7)]=Math.round(Number(e.mm));
    currentUser.mlDisques={dernier:e.src,mesures};
    try{ saveUser(); }catch(x){}
  }
  _ml.outil='selection';
  _mlxApresChangement();
  toast('Échelle enregistrée : les mesures restent sur les tracés.');
  return true;
}
/** L'échelle retirée : plus aucune mesure sur les tracés. */
function mlEchEffacer(){
  if(!_ml||!_ml.annot.ech) return false;
  _mlxMemoriser();
  const d={..._ml.annot}; delete d.ech;
  _ml.annot=d;
  _ml.echPose=null;
  _mlxApresChangement();
  return true;
}

// ── L'ÉDITION ──────────────────────────────────────────────────────────────

/** @returns {Object<string,string>} le sens de chaque couleur, réécrit par le coach */
function _mlxSens(){
  const u=currentUser&&currentUser.mlCouleurs&&typeof currentUser.mlCouleurs==='object'?currentUser.mlCouleurs:{};
  /** @type {Object<string,string>} */
  const o={};
  for(const p of ML_PALETTE) o[p.c]=typeof u[p.c]==='string'?String(u[p.c]).slice(0,ANNOT_NOM_MAX):p.sens;
  return o;
}
/**
 * Le sens d'une couleur, gardé dans le profil du coach : il le retrouve sur
 * tous ses appareils, et il sert de nom aux tracés qu'il pose.
 * @param {string} c
 * @param {string} texte
 */
function mlCouleurSens(c,texte){
  if(!currentUser||!ML_PALETTE.some(p=>p.c===c)) return false;
  const o={..._mlxSens()};
  o[c]=String(texte||'').trim().slice(0,ANNOT_NOM_MAX);
  currentUser.mlCouleurs=o;
  try{ saveUser(); }catch(e){}
  return true;
}
/** @returns {number} l'instant affiché, en ms */
function _mlxTempsMs(){
  const v=_mlVideo();
  return Math.round((Number(v&&v.currentTime)||0)*1000);
}
/** @param {string|null} id @returns {Annot|null} */
function _mlxAnnot(id){
  if(!_ml||!id) return null;
  return _ml.annot.a.find(a=>a.id===id)||null;
}
/** @returns {boolean} des annotations restent à enregistrer */
function _mlxModifie(){ return !!_ml&&JSON.stringify(_ml.annot)!==_ml.annotInit; }
// L'HISTORIQUE : une photographie du document AVANT chaque changement.
// Soixante pas, et un nouveau geste efface ce qu'on pouvait rétablir.
function _mlxMemoriser(){
  if(!_ml) return;
  _ml.annule.push(JSON.stringify(_ml.annot));
  if(_ml.annule.length>60) _ml.annule.shift();
  _ml.refait=[];
}
function mlAnnuler(){
  if(!_ml||!_ml.annule.length) return false;
  _ml.refait.push(JSON.stringify(_ml.annot));
  _ml.annot=JSON.parse(String(_ml.annule.pop()));
  if(_ml.sel&&!_mlxAnnot(_ml.sel)) _ml.sel=null;
  _mlxApresChangement();
  return true;
}
function mlRetablir(){
  if(!_ml||!_ml.refait.length) return false;
  _ml.annule.push(JSON.stringify(_ml.annot));
  _ml.annot=JSON.parse(String(_ml.refait.pop()));
  if(_ml.sel&&!_mlxAnnot(_ml.sel)) _ml.sel=null;
  _mlxApresChangement();
  return true;
}
// Ce qui suit un changement du document : les listes, la timeline, le calque,
// et l'état du bouton d'enregistrement.
function _mlxApresChangement(){
  _mlxMajListe(); _mlxMajEditeur(); _mlxMajPistes(); _mlxMajLegende(); _mlxMajOutils();
  _mlDessinerCalque(); _mlMajEnregistrer();
}
function _mlxApresSelection(){
  _mlxMajListe(); _mlxMajEditeur(); _mlxMajPistes(); _mlDessinerCalque();
}
/**
 * Un document modifié tracé par tracé, sans jamais muter l'ancien : c'est ce
 * qui rend l'historique fiable.
 * @param {string} id
 * @param {(a:Annot)=>Annot} f
 */
function _mlxChanger(id,f){
  if(!_ml) return;
  _ml.annot={..._ml.annot,a:_ml.annot.a.map(a=>a.id===id?f(a):a)};
}
/** @param {number} x @returns {number} */
function _mlxBorne(x){ return Math.max(0,Math.min(1000,Math.round(x))); }

/**
 * Un tracé qu'on vient de poser : il prend l'outil, la couleur et l'épaisseur
 * en cours — ou celles de l'étape du modèle —, et une durée : la séquence
 * choisie si la tête de lecture y est, quatre secondes sinon.
 * @param {TypeAnnot} t
 * @param {number[][]} pts
 * @param {{x?:string, lb?:string[], rel?:number, ts?:string, tf?:number, d0?:number, f0?:number, tp?:number[]}} [extra]
 * @returns {Annot|null}
 */
function _mlxCreer(t,pts,extra){
  if(!_ml) return null;
  if(_ml.annot.a.length>=ANNOT_MAX){ toast(ANNOT_MAX+' tracés au plus par vidéo.','var(--orange)'); return null; }
  const bornes=ANNOT_TYPES[t];
  if(!bornes) return null;
  const propres=pts.slice(0,bornes[1]).map(p=>[_mlxBorne(p[0]),_mlxBorne(p[1])]);
  if(propres.length<bornes[0]) return null;
  // LE TRACÉ COMMENCE AU PREMIER TOUCHER, pas au dernier : la vidéo a pu
  // tourner pendant le geste, et le coach dessinait ce qu'il voyait alors.
  const s=(extra&&typeof extra.d0==='number'&&isFinite(extra.d0))?Math.max(0,Math.round(extra.d0)):_mlxTempsMs();
  const seq=_mlActif(), duree=_ml.dureeMs||s+ML_ANNOT_DUREE_MS;
  let d=s, f=Math.min(duree,s+ML_ANNOT_DUREE_MS);
  if(seq&&s>=seq.debutMs&&s<=seq.finMs){ d=seq.debutMs; f=seq.finMs; }
  if(f<=d){ d=Math.max(0,duree-ML_ANNOT_DUREE_MS); f=duree; }
  if(f<=d) f=d+ML_ANNOT_DUREE_MS;
  // UNE TRAJECTOIRE SUIVIE a sa propre durée : du premier point à un peu après
  // le dernier. Ni la séquence ni les quatre secondes par défaut ne la disent.
  if(extra&&typeof extra.f0==='number'&&isFinite(extra.f0)&&extra.f0>s){ d=s; f=Math.round(extra.f0); }
  const etape=_ml.guide?_ml.guide.m.etapes[_ml.guide.i]:null;
  const guide=!!etape&&etape.t===t;
  const c=guide&&etape?etape.c:_ml.couleur;
  const x=extra&&extra.x?String(extra.x).slice(0,ANNOT_TEXTE_MAX):'';
  const chaine=t==='point'&&extra&&Array.isArray(extra.lb)?extra.lb.filter(Boolean).join(' → ').slice(0,ANNOT_NOM_MAX):'';
  const n=guide&&etape?etape.n:(t==='texte'&&x?x.slice(0,ANNOT_NOM_MAX):(chaine||mlNomDefaut(t,c,_mlxSens())));
  /** @type {Annot} */
  const a={id:'a'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),n,t,c,e:_ml.epaisseur,d,f,
    p:mlEncoderTrait(propres)};
  if(t==='texte'){ a.x=x||n; a.ts=extra&&extra.ts||'m'; a.tf=extra&&typeof extra.tf==='number'?extra.tf:1; }
  else if(_ml.style==='t'||_ml.style==='p') a.st=_ml.style;
  if(t==='libre'&&extra&&Array.isArray(extra.tp)&&extra.tp.length===propres.length) a.tp=extra.tp.map(x=>Math.round(x)).join(' ');
  if(t==='point'){
    if(extra&&Array.isArray(extra.lb)&&extra.lb.some(Boolean)) a.lb=extra.lb.slice(0,propres.length).map(l=>String(l||'').slice(0,ANNOT_ETIQ_MAX));
    if(propres.length>1&&(!extra||extra.rel!==0)) a.rel=1;
  }
  if(seq&&d===seq.debutMs&&f===seq.finMs) a.seg=seq.id;
  _mlxMemoriser();
  _ml.annot={..._ml.annot,a:_ml.annot.a.concat([a])};
  _ml.sel=a.id;
  if(guide) _mlxGuideSuivant();
  _mlxApresChangement();
  // LE NOM D'ABORD : « Nom de l'annotation » est la première chose qu'on règle
  // d'un tracé neuf. Le champ est déjà rempli ; Entrée le valide.
  // ⚠ SAUF QUAND LA VIDÉO TOURNE, ou va tourner — la trajectoire suivie se
  // rejoue d'elle-même. Le champ prenait alors la barre d'espace : elle tapait
  // un espace dans le nom au lieu d'arrêter la vidéo, et le coach croyait le
  // bouton cassé (Kevin, 22/09/2026 : « elle ne veut plus s'arrêter »).
  const vid=_mlVideo();
  if(t!=='texte'&&!(extra&&extra.tp)&&!!vid&&vid.paused) requestAnimationFrame(()=>{
    const i=_mlEl('mlx-nom');
    if(i instanceof HTMLInputElement){ try{ i.focus({preventScroll:true}); i.select(); }catch(e){} }
  });
  return a;
}
/**
 * Les points d'un tracé déplacés : dans le tracé lui-même, ou — s'il suit le
 * mouvement — dans l'image clé de l'instant affiché.
 * @param {string} id
 * @param {number[][]} pts
 * @param {number} sMs
 */
function _mlxPoserPoints(id,pts,sMs){
  _mlxChanger(id,a=>{
    const q=pts.map(p=>[_mlxBorne(p[0]),_mlxBorne(p[1])]);
    return Array.isArray(a.k)&&a.k.length?mlClesMaj(a,sMs,q):{...a,p:mlEncoderTrait(q)};
  });
}

// ── LES OUTILS ─────────────────────────────────────────────────────────────
/** @param {string} o */
function mlOutil(o){
  if(!_ml) return false;
  const def=ML_OUTILS.find(x=>x.o===o);
  if(!def) return false;
  _ml.trace=null;
  _mlxEchAnnulerPose();
  // LE PANNEAU DE L'ÉCHELLE montre le disque de l'échelle posée — une
  // annulation a pu le changer depuis.
  if(def.o==='echelle'&&_ml.annot.ech&&_ml.annot.ech.src) _ml.echUi=_mlxEchUiDepuis(_ml.annot.ech);
  _ml.outil=def.o;
  _mlxMajOutils();
  _mlDessinerCalque();
  return true;
}
/**
 * La couleur des tracés à venir — et, en sélection, celle du tracé choisi.
 * @param {string} c
 */
function mlCouleur(c){
  if(!_ml||!/^#[0-9a-f]{6}$/i.test(String(c))) return false;
  _ml.couleur=String(c).toLowerCase();
  const a=_ml.outil==='selection'?_mlxAnnot(_ml.sel):null;
  if(a&&a.c!==_ml.couleur){ _mlxMemoriser(); _mlxChanger(a.id,x=>({...x,c:String(c).toLowerCase()})); _mlxApresChangement(); }
  else { _mlxMajOutils(); _mlDessinerCalque(); }
  return true;
}
/** @param {number|string} v */
function mlEpaisseur(v){
  if(!_ml) return false;
  const e=Math.max(1,Math.min(12,Math.round(Number(v)||ML_EPAISSEUR_DEFAUT)));
  _ml.epaisseur=e;
  const lab=_mlEl('mlx-ep-val'); if(lab) lab.textContent=e+' px';
  const a=_ml.outil==='selection'?_mlxAnnot(_ml.sel):null;
  if(a&&a.e!==e){ _mlxChanger(a.id,x=>({...x,e})); _mlxMajEditeur(); _mlDessinerCalque(); _mlMajEnregistrer(); }
  return true;
}
/**
 * Le style du trait des tracés à venir — et, en sélection, celui du tracé
 * choisi, comme la couleur.
 * @param {string} s  '' (plein), 't' (tirets) ou 'p' (pointillé)
 */
function mlStyleTrait(s){
  if(!_ml||!ML_TRAITS.some(x=>x[0]===s)) return false;
  _ml.style=s;
  const a=_ml.outil==='selection'?_mlxAnnot(_ml.sel):null;
  if(a&&a.t!=='texte'&&(a.st||'')!==s) mlAnnotOption('st',s);
  else { _mlxMajOutils(); _mlDessinerCalque(); }
  return true;
}
/** @returns {boolean} la case « Tracer pendant la lecture », telle que cet appareil l'a laissée */
function _mlxPrefLecture(){
  try{ return localStorage.getItem(ML_PREF_LECTURE)==='1'; }catch(e){ return false; }
}
/**
 * « TRACER PENDANT LA LECTURE ». Éteinte — le défaut —, dessiner fige l'image :
 * un tracé se pose sur une image, pas sur un mouvement qui défile sous le
 * doigt. Allumée, la vidéo continue : le coach suit la barre du doigt pendant
 * qu'elle monte, et le tracé commence à l'instant du premier toucher.
 * @param {boolean} oui
 */
function mlTracerEnLecture(oui){
  if(!_ml) return false;
  _ml.enLecture=!!oui;
  try{ if(_ml.enLecture) localStorage.setItem(ML_PREF_LECTURE,'1'); else localStorage.removeItem(ML_PREF_LECTURE); }catch(e){}
  _mlxMajOutils();
  return true;
}
/** Le repère anatomique que le prochain toucher de l'outil Point posera. @param {number} i */
function mlRepereAnat(i){
  if(!_ml) return false;
  _ml.repereAnat=Math.max(-1,Math.min(ML_REPERES_ANAT.length-1,Math.round(Number(i))));
  _mlxMajOutils();
  return true;
}
/** La phrase que l'outil Texte proposera. @param {number} i */
function mlPhrase(i){
  if(!_ml) return false;
  _ml.phrase=ML_PHRASES[i]||'';
  _mlxMajOutils();
  return true;
}
/** Termine une courbe ou une chaîne de repères. */
function mlTerminerTrace(){
  const tr=_ml&&_ml.trace;
  if(!_ml||!tr) return false;
  // UN TRACÉ COMMENCÉ D'UN CLIC se termine là où il en est : Entrée vaut le
  // clic d'arrivée — utile pour une trajectoire suivie à la souris.
  if(tr.clic){
    const v=_mlVideo(), R=v?_mlVideoRect(v):null;
    if(R) _mlxFinirTire(tr,R); else _mlxAnnulerTrace();
    return true;
  }
  // UN DOUBLE-CLIC POSE DEUX FOIS LE MÊME POINT : on le retire.
  /** @type {number[][]} */
  const pts=[];
  /** @type {string[]} */
  const lb=[];
  tr.pts.forEach((p,i)=>{
    const q=pts[pts.length-1];
    if(q&&Math.hypot(p[0]-q[0],p[1]-q[1])<5) return;
    pts.push(p); lb.push((tr.lb||[])[i]||'');
  });
  _ml.trace=null;
  if(tr.t==='courbe'&&pts.length>=2) _mlxCreer('courbe',pts,{d0:tr.d0});
  else if(tr.t==='point'&&pts.length>=1) _mlxCreer('point',pts,{lb,rel:_ml.relier?1:0,d0:tr.d0});
  else { _mlxMajOutils(); _mlDessinerCalque(); }
  return true;
}
function _mlxAnnulerTrace(){
  if(!_ml||!_ml.trace) return false;
  _ml.trace=null;
  _mlxMajOutils(); _mlDessinerCalque();
  return true;
}
/** @param {number[]} p */
async function _mlxTexteNouveau(p){
  if(!_ml) return false;
  const brut=await rcSaisie('Texte sur la vidéo',_ml.phrase||'',{libelleOk:'Poser',placeholder:'Ex. : DESCENDS PLUS BAS'});
  const x=String(brut==null?'':brut).trim().slice(0,ANNOT_TEXTE_MAX);
  if(!x||!_ml) return false;
  return !!_mlxCreer('texte',[p],{x,ts:_ml.tailleTexte,tf:1});
}
/**
 * Un toucher sur l'image quand un outil d'annotation est armé.
 * @param {PointerEvent} e
 * @param {HTMLElement} calque
 */
function _mlxPointer(e,calque){
  const v=_mlVideo(), R=v?_mlVideoRect(v):null;
  if(!_ml||!v||!R) return;
  const b=calque.getBoundingClientRect();
  /** @param {number} cx @param {number} cy @returns {number[]} */
  const N=(cx,cy)=>[_mlxBorne((cx-b.left-R.ox)/R.s/R.vw*1000),_mlxBorne((cy-b.top-R.oy)/R.s/R.vh*1000)];
  const outil=_ml.outil, sMs=_mlxTempsMs();
  e.preventDefault();
  // UNE ÉTIQUETTE EN MAIN : ce toucher la pose — ou, si le doigt glisse,
  // l'emmène d'abord.
  if(_ml.deplEtiq){
    try{ calque.setPointerCapture(e.pointerId); }catch(x){}
    _mlxEtiqBouger(e.clientX-b.left,e.clientY-b.top);
    /** @param {PointerEvent} ev */
    const suivre=ev=>{ _mlxEtiqBouger(ev.clientX-b.left,ev.clientY-b.top); };
    const poser=()=>{
      calque.removeEventListener('pointermove',suivre);
      calque.removeEventListener('pointerup',poser);
      calque.removeEventListener('pointercancel',poser);
      _mlxEtiqPoser();
    };
    calque.addEventListener('pointermove',suivre);
    calque.addEventListener('pointerup',poser);
    calque.addEventListener('pointercancel',poser);
    return;
  }
  // LE DOUBLE TOUCHER, reconnu ici plutôt qu'attendu du navigateur : au
  // doigt, le second toucher d'un double sur une étiquette la prend.
  {
    const maintenant=performance.now(), px=e.clientX-b.left, py=e.clientY-b.top, prec=_mlxDernierToucher;
    _mlxDernierToucher={t:maintenant,x:px,y:py};
    if(prec&&maintenant-prec.t<400&&Math.hypot(px-prec.x,py-prec.y)<20&&_mlxEtiqDoubleToucher(px,py)){ _mlxDernierToucher=null; return; }
  }
  if(outil==='echelle'){ _mlxEchPointer(e,calque,R,b,N); return; }
  // ⚠ LE PREMIER TOUCHER D'UN DOUBLE-CLIC SUR UNE ÉTIQUETTE N'AGIT PAS quand
  //   l'outil agirait tout de suite (build 1391, Kevin : « redonner la
  //   possibilité de bouger les légendes en double-cliquant »). Avec l'outil
  //   Trajectoire en suivi automatique, ce premier toucher LANÇAIT UN SUIVI :
  //   le laboratoire passait en suivi, et le second toucher tombait dans le
  //   vide. Le texte ouvrait sa saisie, la gomme effaçait le tracé dessous.
  //   Les outils qui tirent un trait gardent leur règle : le double-clic retire
  //   le début de tracé qu'il a posé (_mlxEtiqDoubleToucher).
  if(outil==='texte'||outil==='gomme'||(outil==='libre'&&_ml.trajAuto)){
    const G=_mlxCalqueGeo();
    if(G&&mlEtiquetteToucher(_ml.annot,G.R,sMs,e.clientX-b.left,e.clientY-b.top,G.g,_ml.comparaison)) return;
  }
  // UN TOUCHER SUR UNE ÉTIQUETTE OU UNE MESURE, avec la sélection : il choisit
  // son tracé, SANS faire venir l'éditeur en vue et sans saisir le tracé. Le
  // tracé passe juste sous son étiquette : ce premier toucher d'un double-clic
  // le choisissait, l'éditeur faisait défiler la page, et le second toucher
  // n'était plus sur la vidéo.
  if(outil==='selection'){
    const G=_mlxCalqueGeo();
    const et=G?mlEtiquetteToucher(_ml.annot,G.R,sMs,e.clientX-b.left,e.clientY-b.top,G.g,_ml.comparaison):null;
    if(et){
      if(et.kind!=='leg'&&_ml.sel!==et.id){ _ml.sel=et.id; _mlxEdVu=et.id; _mlxApresSelection(); }
      return;
    }
  }
  if(outil==='selection'||outil==='gomme'){
    const g=calque instanceof HTMLCanvasElement?calque.getContext('2d'):null;
    const hit=mlAnnotToucher(_ml.annot,R,sMs,e.clientX-b.left,e.clientY-b.top,{sel:_ml.sel,comparaison:_ml.comparaison,g});
    if(outil==='gomme'){ if(hit) mlAnnotSupprimer(hit.id); return; }
    if(!hit){ if(_ml.sel){ _ml.sel=null; _mlxApresSelection(); } return; }
    if(_ml.sel!==hit.id){ _ml.sel=hit.id; _mlxApresSelection(); }
    const a0=_mlxAnnot(hit.id);
    if(!a0) return;
    try{ v.pause(); }catch(x){}
    const depart=N(e.clientX,e.clientY), pts0=mlAnnotPointsA(a0,sMs), avant=JSON.stringify(_ml.annot);
    let bouge=false;
    try{ calque.setPointerCapture(e.pointerId); }catch(x){}
    /** @param {PointerEvent} ev */
    const bouger=ev=>{
      if(!_ml) return;
      const q=N(ev.clientX,ev.clientY), dx=q[0]-depart[0], dy=q[1]-depart[1];
      if(!bouge&&Math.hypot(dx,dy)<3) return;
      bouge=true;
      const pts=hit.i>=0?pts0.map((p,j)=>j===hit.i?[p[0]+dx,p[1]+dy]:p.slice()):pts0.map(p=>[p[0]+dx,p[1]+dy]);
      _mlxPoserPoints(hit.id,pts,sMs);
      _mlDessinerCalque();
    };
    const fin=()=>{
      calque.removeEventListener('pointermove',bouger);
      calque.removeEventListener('pointerup',fin);
      calque.removeEventListener('pointercancel',fin);
      if(bouge&&_ml){ _ml.annule.push(avant); if(_ml.annule.length>60) _ml.annule.shift(); _ml.refait=[]; _mlxApresChangement(); }
    };
    calque.addEventListener('pointermove',bouger);
    calque.addEventListener('pointerup',fin);
    calque.addEventListener('pointercancel',fin);
    return;
  }
  // LE CHAMP DU NOM RELÂCHE LE CLAVIER. Un tracé neuf y met le curseur, et
  // toucher la vidéo ne le lui reprend pas (pointerdown est empêché) : Échap
  // et Entrée, pendant un tracé commencé d'un clic, iraient au champ.
  const af=document.activeElement;
  if(af instanceof HTMLInputElement||af instanceof HTMLTextAreaElement) af.blur();
  const jouait=!v.paused&&!v.ended;
  // DESSINER FIGE L'IMAGE : un tracé se pose sur une image, pas sur un
  // mouvement qui défile sous le doigt — SAUF si le coach a allumé « Tracer
  // pendant la lecture ». Le texte fige toujours : il ouvre une saisie.
  if(!_ml.enLecture||outil==='texte'){ try{ v.pause(); }catch(x){} }
  const p=N(e.clientX,e.clientY);
  if(outil==='texte'){ _mlxTexteNouveau(p); return; }
  // LA TRAJECTOIRE EN SUIVI AUTOMATIQUE : le toucher désigne le détail, le
  // glisser l'entoure ; au lâcher, le suivi part de l'image affichée.
  if(outil==='libre'&&_ml.trajAuto){
    try{ v.pause(); }catch(x){}
    // LA VIDÉO TOURNAIT : ce toucher l'ARRÊTE, et c'est tout. Il lançait un
    // nouveau suivi, qui se rejouait à son tour — chaque toucher pour arrêter
    // la vidéo la relançait avec une trajectoire de plus. Le détail se désigne
    // sur une image arrêtée.
    if(jouait){ toast('Vidéo arrêtée : touche maintenant le détail à suivre.'); return; }
    _ml.trace={t:'cercle',pts:[p,p.slice()],d0:sMs};
    const x0=e.clientX, y0=e.clientY;
    let loin=0;
    try{ calque.setPointerCapture(e.pointerId); }catch(x){}
    /** @param {PointerEvent} ev */
    const entourer=ev=>{
      const tr=_ml&&_ml.trace;
      if(!tr) return;
      loin=Math.max(loin,Math.hypot(ev.clientX-x0,ev.clientY-y0));
      tr.pts[1]=N(ev.clientX,ev.clientY);
      _mlDessinerCalque();
    };
    const lacher=()=>{
      calque.removeEventListener('pointermove',entourer);
      calque.removeEventListener('pointerup',lacher);
      calque.removeEventListener('pointercancel',lacher);
      const tr=_ml&&_ml.trace;
      if(!_ml||!tr) return;
      _ml.trace=null;
      const q=tr.pts[1];
      const rVid=loin<6?0:Math.hypot((q[0]-p[0])/1000*R.vw,(q[1]-p[1])/1000*R.vh);
      mlTrajectoireAuto(p,rVid);
    };
    calque.addEventListener('pointermove',entourer);
    calque.addEventListener('pointerup',lacher);
    calque.addEventListener('pointercancel',lacher);
    return;
  }
  if(outil==='angle'||outil==='courbe'||outil==='point'){
    if(!_ml.trace||_ml.trace.t!==outil) _ml.trace={t:outil,pts:[],lb:[],d0:sMs};
    const tr=_ml.trace;
    tr.pts.push(p);
    if(outil==='point'){
      const i=_ml.repereAnat;
      (tr.lb=tr.lb||[]).push(i>=0?ML_REPERES_ANAT[i]:'');
      // LE REPÈRE SUIVANT S'ARME : épaule, puis coude, puis poignet.
      if(i>=0&&i<ML_REPERES_ANAT.length-1) _ml.repereAnat=i+1;
    }
    if(outil==='angle'&&tr.pts.length>=3){ const pts=tr.pts.slice(0,3), d0=tr.d0; _ml.trace=null; _mlxCreer('angle',pts,{d0}); return; }
    if((outil==='courbe'&&tr.pts.length>=24)||(outil==='point'&&tr.pts.length>=12)){ mlTerminerTrace(); return; }
    _mlxMajOutils(); _mlDessinerCalque();
    return;
  }
  // LES TRACÉS QU'ON TIRE : ligne, flèche, cercle, rectangle, zone, trajectoire.
  // DEUX FAÇONS DE LES POSER (build 1382, Kevin : « cliquer une fois et une
  // deuxième pour placer le point au lieu de devoir maintenir ») : glisser,
  // comme avant — ou toucher sans glisser, puis toucher l'arrivée. Aucun
  // réglage : c'est le premier geste qui le dit.
  const t=/** @type {TypeAnnot} */(outil);
  const enCours=_ml.trace;
  if(enCours&&enCours.clic&&enCours.t===t){
    // LE CLIC D'ARRIVÉE.
    if(t==='libre') enCours.pts.push(p); else enCours.pts[1]=p;
    _mlxFinirTire(enCours,R);
    return;
  }
  _ml.trace={t,pts:outil==='libre'?[p]:[p,p],d0:sMs};
  const x0=e.clientX, y0=e.clientY;
  let loin=0;
  try{ calque.setPointerCapture(e.pointerId); }catch(x){}
  /** @param {PointerEvent} ev */
  const bouger=ev=>{
    const tr=_ml&&_ml.trace;
    if(!tr) return;
    loin=Math.max(loin,Math.hypot(ev.clientX-x0,ev.clientY-y0));
    const q=N(ev.clientX,ev.clientY);
    if(tr.t==='libre'){
      const der=tr.pts[tr.pts.length-1];
      if(Math.hypot((q[0]-der[0])*R.vw*R.s/1000,(q[1]-der[1])*R.vh*R.s/1000)>=3) tr.pts.push(q);
    } else tr.pts[1]=q;
    _mlDessinerCalque();
  };
  const fin=()=>{
    calque.removeEventListener('pointermove',bouger);
    calque.removeEventListener('pointerup',fin);
    calque.removeEventListener('pointercancel',fin);
    const tr=_ml&&_ml.trace;
    if(!_ml||!tr) return;
    // UN TOUCHER SANS GLISSER COMMENCE LE TRACÉ au lieu de ne rien poser :
    // l'arrivée viendra du clic suivant, et la souris la montre d'ici là.
    if(loin<6){
      tr.clic=true;
      tr.pts=tr.t==='libre'?[tr.pts[0]]:[tr.pts[0],tr.pts[0].slice()];
      _mlxMajOutils(); _mlDessinerCalque();
      return;
    }
    _mlxFinirTire(tr,R);
  };
  calque.addEventListener('pointermove',bouger);
  calque.addEventListener('pointerup',fin);
  calque.addEventListener('pointercancel',fin);
}
/**
 * Un tracé tiré, terminé — au lâcher d'un glisser ou au clic d'arrivée.
 * UN TRACÉ DE MOINS DE 6 PX NE SE POSE PAS : invisible, il serait pourtant
 * compté, listé et envoyé.
 * @param {TraceEnCours} tr
 * @param {RectImage} R
 */
function _mlxFinirTire(tr,R){
  if(!_ml) return;
  _ml.trace=null;
  const a0=tr.pts[0], a1=tr.pts[tr.pts.length-1];
  const long=Math.hypot((a1[0]-a0[0])*R.vw*R.s/1000,(a1[1]-a0[1])*R.vh*R.s/1000);
  const o={d0:tr.d0};
  if(tr.t==='libre'&&tr.pts.length>=2&&long+tr.pts.length>6) _mlxCreer('libre',mlSimplifierMax(tr.pts,ANNOT_PTS_MAX),o);
  else if(tr.t!=='libre'&&long>=6) _mlxCreer(tr.t,tr.pts,o);
  else { _mlxMajOutils(); _mlDessinerCalque(); }
}

// ── LE TRACÉ CHOISI ────────────────────────────────────────────────────────
/**
 * Choisir un tracé — ou le relâcher d'un second toucher sur son nom. Le
 * crayon, la timeline et le toucher sur l'image, eux, CHOISISSENT toujours :
 * « Modifier » ne doit jamais fermer ce qu'on voulait modifier.
 * @param {string} id
 * @param {boolean} [garder]
 */
function mlAnnotChoisir(id,garder){
  if(!_ml||!_mlxAnnot(id)) return false;
  _ml.sel=(_ml.sel===id&&!garder)?null:id;
  if(_ml.sel){
    // LE TRACÉ CHOISI HORS DE SA DURÉE ne se verrait pas : on y amène la vidéo.
    const a=_mlxAnnot(id), s=_mlxTempsMs();
    if(a&&!(s>=a.d&&s<a.f)) _mlAller(a.d);
    if(_ml.outil!=='selection'){ _ml.outil='selection'; _mlxMajOutils(); }
  }
  _mlxApresSelection();
  return true;
}
/** @param {string} id */
function mlAnnotSupprimer(id){
  if(!_ml||!_mlxAnnot(id)) return false;
  _mlxMemoriser();
  _ml.annot={..._ml.annot,a:_ml.annot.a.filter(a=>a.id!==id)};
  if(_ml.sel===id) _ml.sel=null;
  _mlxApresChangement();
  return true;
}
/** @param {string} id */
function mlAnnotVisibilite(id){
  if(!_ml||!_mlxAnnot(id)) return false;
  _mlxMemoriser();
  _mlxChanger(id,a=>{ const o={...a}; if(o.h) delete o.h; else o.h=1; return o; });
  _mlxApresChangement();
  return true;
}
/** La photo prise quand un champ de l'éditeur prend le focus : la frappe, lettre à lettre, n'empile pas l'historique. */
function mlAnnotFocus(){ _mlxMemoriser(); return true; }
/** @param {string} v */
function mlAnnotNom(v){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a) return false;
  const n=String(v||'').replace(/[\u0000-\u001f]/g,' ').slice(0,ANNOT_NOM_MAX);
  _mlxChanger(a.id,x=>({...x,n:n||x.n}));
  _mlxMajListe(); _mlxMajPistes(); _mlDessinerCalque(); _mlMajEnregistrer();
  return true;
}
/** @param {string} v */
function mlAnnotTexte(v){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||a.t!=='texte') return false;
  const x=String(v||'').replace(/[\u0000-\u001f]/g,' ').slice(0,ANNOT_TEXTE_MAX);
  if(!x.trim()) return false;
  _mlxChanger(a.id,y=>({...y,x,n:x.slice(0,ANNOT_NOM_MAX)}));
  _mlxMajListe(); _mlxMajPistes(); _mlDessinerCalque(); _mlMajEnregistrer();
  return true;
}
/** @param {string} c */
function mlAnnotCouleur(c){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!/^#[0-9a-f]{6}$/i.test(String(c))) return false;
  _mlxMemoriser();
  _mlxChanger(a.id,x=>({...x,c:String(c).toLowerCase()}));
  _mlxApresChangement();
  return true;
}
/** @param {number|string} v */
function mlAnnotEpaisseur(v){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a) return false;
  const e=Math.max(1,Math.min(12,Math.round(Number(v)||ML_EPAISSEUR_DEFAUT)));
  _mlxChanger(a.id,x=>({...x,e}));
  const lab=_mlEl('mlx-aep-val'); if(lab) lab.textContent=e+' px';
  _mlDessinerCalque(); _mlMajEnregistrer();
  return true;
}
/**
 * Le début ou la fin de la durée d'apparition : à la tête de lecture, ou à la
 * valeur écrite (« 0:03.25 », « 3.25 », « 3 »).
 * @param {'d'|'f'} quel
 * @param {string|number} [val]  absent : l'instant affiché
 */
function mlAnnotBorne(quel,val){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a) return false;
  let ms=val==null?_mlxTempsMs():_mlxLireTemps(String(val));
  if(ms==null){ toast('Temps illisible : écris par exemple 0:03.25.','var(--orange)'); _mlxMajEditeur(); return false; }
  const D=_ml.dureeMs||86400000;
  ms=Math.max(0,Math.min(D,ms));
  let {d,f}=a;
  if(quel==='d') d=Math.min(ms,f-SEG_MIN_MS); else f=Math.max(ms,d+SEG_MIN_MS);
  d=Math.max(0,d); f=Math.min(Math.max(D,d+SEG_MIN_MS),f);
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{ const o={...x,d:Math.round(d),f:Math.round(f)}; delete o.seg; return o; });
  _mlxApresChangement();
  return true;
}
/**
 * PURE. Un temps écrit par le coach, en ms : « 1:03.5 », « 63.5 », « 63 ».
 * @param {string} s
 * @returns {number|null}
 */
function _mlxLireTemps(s){
  const m=/^\s*(?:(\d{1,3}):)?(\d{1,5})(?:[.,](\d{1,3}))?\s*$/.exec(String(s));
  if(!m) return null;
  const min=Number(m[1]||0), sec=Number(m[2]), frac=m[3]?Number((m[3]+'00').slice(0,3)):0;
  if(m[1]&&sec>=60) return null;
  return (min*60+sec)*1000+frac;
}
/** Toute la vidéo, ou la séquence choisie. @param {'video'|'sequence'} quoi */
function mlAnnotDuree(quoi){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!_ml.dureeMs) return false;
  const s=_mlActif();
  if(quoi==='sequence'&&!s){ toast('Choisis d’abord une séquence.','var(--orange)'); return false; }
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{
    const o=quoi==='sequence'&&s?{...x,d:s.debutMs,f:s.finMs,seg:s.id}:{...x,d:0,f:_ml?_ml.dureeMs:x.f};
    if(quoi==='video') delete o.seg;
    return o;
  });
  _mlxApresChangement();
  return true;
}
/**
 * Une bascule ou un réglage du tracé choisi : nom affiché (et), légende (lg),
 * points reliés (rel), contour (tc), fond (tf), taille du texte (ts), angle
 * cible (cb).
 * @param {string} cle
 * @param {any} val
 */
function mlAnnotOption(cle,val){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a) return false;
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{
    const o=/** @type {any} */({...x});
    if(cle==='et'||cle==='lg'){ if(val) delete o[cle]; else o[cle]=0; }
    else if(cle==='rel'||cle==='tc'){ if(val) o[cle]=1; else delete o[cle]; }
    else if(cle==='tf'&&[0,1,2].includes(Number(val))) o.tf=Number(val);
    else if(cle==='ts'&&['s','m','l'].includes(String(val))) o.ts=String(val);
    else if(cle==='st'&&o.t!=='texte'){ if(val==='t'||val==='p') o.st=val; else delete o.st; }
    else if(cle==='cb'){
      const n=Number(String(val).replace(',','.'));
      if(String(val).trim()===''||!isFinite(n)) delete o.cb; else o.cb=Math.max(0,Math.min(180,Math.round(n)));
    }
    return /** @type {Annot} */(o);
  });
  _mlxApresChangement();
  return true;
}
/**
 * « SUIVRE LE MOUVEMENT ». Allumé, le tracé reçoit sa première image clé à
 * l'instant affiché ; chaque point qu'on déplace ensuite, image par image,
 * pose une clé, et le mouvement s'interpole entre elles. Éteint, il reprend
 * les points de l'instant affiché et redevient immobile.
 */
function mlAnnotSuivre(){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a) return false;
  const s=_mlxTempsMs();
  _mlxMemoriser();
  if(Array.isArray(a.k)&&a.k.length){
    const pts=mlAnnotPointsA(a,s);
    _mlxChanger(a.id,x=>{ const o={...x,p:mlEncoderTrait(pts.map(p=>[_mlxBorne(p[0]),_mlxBorne(p[1])]))}; delete o.k; return o; });
  } else _mlxChanger(a.id,x=>mlClesMaj(x,s,mlDecoderTrait(x.p)));
  _mlxApresChangement();
  return true;
}
/** L'image clé précédente ou suivante. @param {number} sens */
function mlCleAller(sens){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!Array.isArray(a.k)||!a.k.length) return false;
  const s=_mlxTempsMs();
  const l=a.k.map(q=>q[0]);
  const t=sens<0?l.filter(x=>x<s-20).pop():l.find(x=>x>s+20);
  if(t==null) return false;
  _mlAller(t);
  return true;
}
/** Retire l'image clé de l'instant affiché. */
function mlCleSupprimer(){
  const a=_ml&&_mlxAnnot(_ml.sel);
  if(!_ml||!a||!Array.isArray(a.k)) return false;
  const i=mlCleA(a,_mlxTempsMs());
  if(i<0) return false;
  _mlxMemoriser();
  _mlxChanger(a.id,x=>{
    const k=(x.k||[]).filter((_,j)=>j!==i);
    const o={...x};
    if(k.length){ o.k=k; o.p=k[0][1]; } else delete o.k;
    return o;
  });
  _mlxApresChangement();
  return true;
}
/**
 * L'ordre des tracés : le dernier se dessine par-dessus les autres.
 * @param {string} id
 * @param {number} rang
 */
function mlAnnotDeplacer(id,rang){
  if(!_ml) return false;
  const l=_ml.annot.a.slice(), i=l.findIndex(a=>a.id===id);
  if(i<0) return false;
  const [a]=l.splice(i,1);
  l.splice(Math.max(0,Math.min(l.length,Math.round(rang))),0,a);
  _mlxMemoriser();
  _ml.annot={..._ml.annot,a:l};
  _mlxApresChangement();
  return true;
}
/** Le bouton « + Ajouter » : l'outil du dernier tracé, ou la trajectoire. */
function mlAnnotAjouter(){
  if(!_ml) return false;
  const der=_ml.annot.a[_ml.annot.a.length-1];
  mlOutil(der?der.t:'libre');
  toast('Dessine sur la vidéo : '+(ML_OUTILS.find(x=>x.o===_ml?.outil)||{lib:''}).lib.toLowerCase()+'.');
  return true;
}
/** Efface tous les tracés, après confirmation. */
async function mlAnnotToutEffacer(){
  if(!_ml||!_ml.annot.a.length) return false;
  if(!await rcConfirm('Effacer tous les tracés ?','La légende reste. Tu pourras annuler tant que le laboratoire est ouvert.','Effacer','Garder')) return false;
  if(!_ml) return false;
  _mlxMemoriser();
  _ml.annot={..._ml.annot,a:[]};
  _ml.sel=null;
  _mlxApresChangement();
  return true;
}

// ── LA LÉGENDE ─────────────────────────────────────────────────────────────
/**
 * @param {string} cle  on, titre, pos, taille, fond, op
 * @param {any} val
 */
function mlLegende(cle,val){
  if(!_ml) return false;
  /** @type {any} */
  const L={..._ml.annot.leg};
  if(cle==='on') L.on=val?1:0;
  else if(cle==='titre') L.titre=String(val||'').replace(/[\u0000-\u001f]/g,' ').slice(0,40)||'Analyse technique';
  // Choisir un coin rend la légende à ce coin, même déplacée à la main.
  else if(cle==='pos'&&['hg','hd','bg','bd'].includes(val)){ L.pos=val; delete L.x; delete L.y; }
  else if(cle==='taille'&&['s','m','l'].includes(val)) L.taille=val;
  else if(cle==='fond'&&['sombre','clair','aucun'].includes(val)) L.fond=val;
  else if(cle==='op'){ const n=Number(val); if(isFinite(n)) L.op=Math.round(Math.max(0.3,Math.min(1,n))*100)/100; }
  else return false;
  if(cle!=='titre'&&cle!=='op') _mlxMemoriser();
  _ml.annot={..._ml.annot,leg:/** @type {Legende} */(L)};
  if(cle==='on'||cle==='pos') _mlxMajLegende();
  _mlDessinerCalque(); _mlMajEnregistrer();
  return true;
}

// ── LES MODÈLES ────────────────────────────────────────────────────────────
/** @returns {ModeleAnnot[]} les sept d'origine, puis ceux du coach */
function _mlxModeles(){
  /** @type {any[]} */
  const perso=currentUser&&Array.isArray(currentUser.mlModelesAnnot)?currentUser.mlModelesAnnot:[];
  /** @type {ModeleAnnot[]} */
  const propres=[];
  for(const m of perso.slice(0,ML_MODELES_ANNOT_MAX)){
    if(!m||typeof m!=='object') continue;
    /** @type {EtapeModele[]} */
    const etapes=(Array.isArray(m.etapes)?m.etapes:[]).filter((/** @type {any} */ e)=>e&&ANNOT_TYPES[e.t]
      &&/^#[0-9a-f]{6}$/i.test(String(e.c))).slice(0,8)
      .map((/** @type {any} */ e)=>({t:/** @type {TypeAnnot} */(e.t),c:String(e.c).toLowerCase(),n:String(e.n||'').slice(0,ANNOT_NOM_MAX)||ML_TYPE_LIB[e.t]}));
    if(!etapes.length) continue;
    propres.push({nom:String(m.nom||'Mon modèle').slice(0,30),ico:'perso',titre:String(m.titre||m.nom||'Analyse').slice(0,40),etapes,
      comparer:!!m.comparer});
  }
  return ML_MODELES_ANNOT.slice().concat(propres);
}
/** Arme un modèle : ses étapes s'enchaînent, sa légende s'allume. @param {number} i */
function mlModeleAnnot(i){
  if(!_ml) return false;
  const m=_mlxModeles()[i];
  if(!m) return false;
  _mlxMemoriser();
  _ml.annot={..._ml.annot,leg:{..._ml.annot.leg,on:1,titre:m.titre.slice(0,40)}};
  _ml.guide={m,i:0};
  if(m.comparer&&!_ml.comparaison) mlComparaison();
  _mlxArmerEtape();
  _mlxApresChangement();
  _mlxMajModeles();
  return true;
}
function _mlxArmerEtape(){
  const G=_ml&&_ml.guide;
  if(!_ml||!G) return;
  const e=G.m.etapes[G.i];
  if(!e) return;
  _ml.outil=e.t; _ml.couleur=e.c; _ml.trace=null;
  if(e.t==='texte') _ml.phrase=e.n;
  _mlxMajOutils();
}
function _mlxGuideSuivant(){
  const G=_ml&&_ml.guide;
  if(!_ml||!G) return;
  G.i++;
  if(G.i>=G.m.etapes.length){
    _ml.guide=null;
    toast('Modèle « '+G.m.nom+' » terminé ✓');
    _mlxMajModeles();
    return;
  }
  _mlxArmerEtape();
  _mlxMajModeles();
}
function mlGuidePasser(){ if(!_ml||!_ml.guide) return false; _mlxGuideSuivant(); _mlxMajOutils(); return true; }
function mlGuideArreter(){ if(!_ml||!_ml.guide) return false; _ml.guide=null; _mlxMajOutils(); _mlxMajModeles(); return true; }
/** Garde les tracés affichés comme un modèle du coach. */
async function mlModeleCreer(){
  if(!_ml||!currentUser) return false;
  const l=_ml.annot.a.filter(a=>!a.h);
  if(!l.length){ toast('Pose d’abord les tracés du modèle : il reprendra leurs outils, couleurs et noms.','var(--orange)'); return false; }
  const nom=await rcSaisie('Nom du modèle','',{libelleOk:'Créer',placeholder:'Ex. : Squat — genoux'});
  const n=String(nom==null?'':nom).trim().slice(0,30);
  if(!n||!_ml||!currentUser) return false;
  const perso=Array.isArray(currentUser.mlModelesAnnot)?currentUser.mlModelesAnnot.slice():[];
  if(perso.length>=ML_MODELES_ANNOT_MAX){ toast(ML_MODELES_ANNOT_MAX+' modèles au plus : retires-en un.','var(--orange)'); return false; }
  perso.push({nom:n,titre:_ml.annot.leg.titre,comparer:_ml.comparaison?1:0,
    etapes:l.slice(0,8).map(a=>({t:a.t,c:a.c,n:a.t==='texte'?(a.x||a.n):a.n}))});
  currentUser.mlModelesAnnot=perso;
  toastEcriture(saveUser(),'Modèle « '+n+' » créé ✓','le modèle est');
  _mlxMajModeles();
  return true;
}
/** @param {number} i  le rang dans la liste complète */
async function mlModeleAnnotRetirer(i){
  if(!currentUser) return false;
  const j=i-ML_MODELES_ANNOT.length;
  const perso=Array.isArray(currentUser.mlModelesAnnot)?currentUser.mlModelesAnnot.slice():[];
  if(j<0||!perso[j]) return false;
  if(!await rcConfirm('Retirer ce modèle ?',String(perso[j].nom||''),'Retirer','Garder')) return false;
  perso.splice(j,1);
  currentUser.mlModelesAnnot=perso;
  try{ saveUser(); }catch(e){}
  _mlxMajModeles();
  return true;
}

// ── LA VUE ─────────────────────────────────────────────────────────────────
/** « VERSION ORIGINALE » : le calque s'éteint, la vidéo reste telle quelle. */
function mlVersionOriginale(){
  if(!_ml) return false;
  _ml.original=!_ml.original;
  const b=_mlEl('mlx-orig'); if(b) b.setAttribute('aria-pressed',String(_ml.original));
  const s=document.querySelector('#ml-contenu .ml-scene'); if(s) s.classList.toggle('mlx-original',_ml.original);
  _mlDessinerCalque();
  return true;
}
/** « COMPARAISON » : les tracés de forme restent tous à l'écran, et les meilleures répétitions en fantôme. */
function mlComparaison(){
  if(!_ml) return false;
  _ml.comparaison=!_ml.comparaison;
  /** @type {any} */(_ml).compare=_ml.comparaison;
  const b=_mlEl('mlx-comp'); if(b) b.setAttribute('aria-pressed',String(_ml.comparaison));
  _mlDessinerCalque();
  return true;
}
function mlSon(){
  const v=_mlVideo();
  if(!v) return false;
  v.muted=!v.muted;
  const b=_mlEl('mlx-son');
  if(b){ b.setAttribute('aria-pressed',String(v.muted)); b.innerHTML=_mlxIco(v.muted?'muet':'son',20);
    b.setAttribute('aria-label',v.muted?'Remettre le son':'Couper le son'); }
  return true;
}
/** Le plein écran de la SCÈNE, et non de la vidéo : le calque doit suivre. */
function mlPleinEcran(){
  const s=/** @type {any} */(document.querySelector('#ml-contenu .ml-scene')), v=/** @type {any} */(_mlVideo());
  try{
    if(document.fullscreenElement){ document.exitFullscreen(); return true; }
    if(s&&s.requestFullscreen){ const p=s.requestFullscreen(); if(p&&p.catch) p.catch(()=>{}); return true; }
    if(s&&s.webkitRequestFullscreen){ s.webkitRequestFullscreen(); return true; }
    if(v&&v.webkitEnterFullscreen){ v.webkitEnterFullscreen(); return true; }
  }catch(e){}
  return false;
}
/** @param {string} o  trace, analyse, voix, reglages */
function mlOnglet(o){
  if(!_ml||!['trace','analyse','voix','reglages'].includes(o)) return false;
  _ml.onglet=o;
  document.querySelectorAll('#ml-contenu [data-onglet]').forEach(x=>{
    const el=/** @type {HTMLElement} */(x), on=el.dataset.onglet===o;
    if(el.getAttribute('role')==='tab') el.setAttribute('aria-selected',String(on));
    else el.hidden=!on;
  });
  return true;
}
function mlMenu(){
  const m=_mlEl('mlx-menu'), b=_mlEl('mlx-menu-b');
  if(!m) return false;
  m.hidden=!m.hidden;
  if(b) b.setAttribute('aria-expanded',String(!m.hidden));
  return true;
}
/** @returns {Annot|null} le tracé en cours de pose, pour l'aperçu sur le calque */
function _mlxApercu(){
  const tr=_ml&&_ml.trace;
  if(!_ml||!tr||!tr.pts.length) return null;
  let pts=tr.pts.slice();
  if(_ml.curseur&&(tr.t==='angle'||tr.t==='courbe'||tr.t==='point')) pts=pts.concat([_ml.curseur]);
  /** @type {TypeAnnot} */
  let t=tr.t;
  if((t==='angle'&&pts.length<3)||(t==='courbe'&&pts.length<2)) t='point';
  // COMMENCÉ D'UN CLIC, rien encore de tiré : le départ se montre d'un point.
  if(tr.clic&&(pts.length<2||Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1])<1)){ t='point'; pts=[pts[0]]; }
  const etape=_ml.guide?_ml.guide.m.etapes[_ml.guide.i]:null;
  const c=etape&&etape.t===tr.t?etape.c:_ml.couleur;
  /** @type {Annot} */
  const a={id:'_apercu',n:'',t,c,e:_ml.epaisseur,d:0,f:1e12,
    p:mlEncoderTrait((pts.length>64?mlSimplifierMax(pts,64):pts).map(p=>[_mlxBorne(p[0]),_mlxBorne(p[1])])),et:0};
  if(_ml.style==='t'||_ml.style==='p') a.st=_ml.style;
  if(t==='point'){
    if(pts.length>1&&(tr.t!=='point'||_ml.relier)) a.rel=1;
    if(tr.t==='point'&&tr.lb) a.lb=tr.lb.slice();
  }
  return a;
}
/** L'état de l'image clé à l'instant affiché, sans redessiner l'éditeur. */
function _mlxMajCleEtat(){
  const a=_ml&&_mlxAnnot(_ml.sel);
  const z=_mlEl('mlx-cle-etat'), b=_mlEl('mlx-cle-suppr');
  if(!a||!Array.isArray(a.k)) return;
  const i=mlCleA(a,_mlxTempsMs());
  if(z) z.textContent=i>=0?' · clé à cet instant':'';
  if(b instanceof HTMLButtonElement) b.disabled=i<0;
}
/**
 * Les raccourcis du laboratoire. Ignorés dans un champ de saisie — c'est
 * l'appelant qui l'a vérifié — et sur un bouton pour Espace et Entrée, qui
 * l'activent déjà.
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
function _mlxClavier(e){
  if(!_ml) return false;
  const k=e.key, mod=e.ctrlKey||e.metaKey;
  const t=e.target instanceof Element?e.target:null;
  if(mod&&(k==='z'||k==='Z')){ e.preventDefault(); if(e.shiftKey) mlRetablir(); else mlAnnuler(); return true; }
  if(mod&&(k==='y'||k==='Y')){ e.preventDefault(); mlRetablir(); return true; }
  if(mod||e.altKey) return false;
  const surBouton=!!(t&&t.closest('button,[role="button"],[role="slider"],[role="tab"]'));
  if(k===' '){ if(surBouton) return false; e.preventDefault(); mlLecture(); return true; }
  if(k==='Escape'){
    if(mlTrajArreter()) return true;
    if(mlEtiqAnnuler()) return true;
    if(_mlxEchAnnulerPose()) return true;
    if(_mlxAnnulerTrace()) return true;
    const m=_mlEl('mlx-menu'); if(m&&!m.hidden){ mlMenu(); return true; }
    if(_ml.sel){ _ml.sel=null; _mlxApresSelection(); return true; }
    return false;
  }
  if(k==='Enter'){ if(_ml.trace&&!surBouton){ e.preventDefault(); mlTerminerTrace(); return true; } return false; }
  if((k==='Delete'||k==='Backspace')&&_ml.sel){ e.preventDefault(); mlAnnotSupprimer(_ml.sel); return true; }
  if(k==='o'||k==='O'){ mlVersionOriginale(); return true; }
  const o=ML_OUTILS.find(x=>x.r===k.toLowerCase());
  if(o&&k.length===1){ mlOutil(o.o); return true; }
  return false;
}

// ── LE SUIVI AUTOMATIQUE D'UN TRACÉ ─────────────────────────────────────────
//
// Kevin, 21/09/2026 : « le suivi d'un tracé se fait à la main — fais-le
// automatique ». Le coach pose ses points sur l'image de départ ; le suiveur
// des points nommés (même gabarit, même corrélation, même adaptation) les
// accompagne image par image jusqu'à la fin du tracé, et le mouvement est
// rangé en IMAGES CLÉS — les mêmes que le suivi à la main, qu'il peut donc
// reprendre ensuite, une clé à la fois.
//
// DEUX FAÇONS DE SUIVRE, selon ce que le tracé désigne :
//   • un repère, un angle, une ligne, une flèche : chaque point est UN détail
//     du corps ou de la barre, et chacun est suivi pour lui-même ;
//   • un cercle, une zone, un rectangle, un texte, une trajectoire : la forme
//     entoure ou montre quelque chose, et elle le suit EN BLOC — son centre
//     est suivi, tous ses points se déplacent d'autant. Un cercle dont le bord
//     suivrait un autre détail que le centre se déformerait.
//
// ══ L'ANGLE QUI S'ARRÊTAIT DE BOUGER (build 1390) ════════════════════════
// Kevin, 22/09/2026, sur une vidéo de 25 s : « l'angle arrête de bouger à un
// certain temps, le suivi s'annule ». Quatre causes, qui se cumulaient :
//   1. LE SUIVI D'UN TRACÉ S'ARRÊTAIT À 20 s, la borne des trajectoires. Au
//      delà, la dernière clé était tenue : l'angle se figeait alors que sa
//      barre couvrait toute la vidéo. Il a désormais SA borne, ML_SUIVI_ANNOT_
//      MAX_MS — la trajectoire garde la sienne, voulue.
//   2. UN POINT PERDU L'ÉTAIT POUR TOUJOURS : trois images floues sur un genou
//      qui plie vite, et il restait cloué là jusqu'à la fin. Il est maintenant
//      CHERCHÉ À NOUVEAU à chaque image (mlSuiviRetrouver), et le trou entre la
//      perte et les retrouvailles est comblé entre deux positions VUES.
//   3. VINGT-QUATRE IMAGES CLÉS POUR TOUT LE MOUVEMENT. Huit répétitions en
//      demandent davantage : la tolérance montait jusqu'à ce que des
//      répétitions entières deviennent une ligne droite. Le plafond est à
//      ANNOT_CLES_MAX, relevé (index.html).
//   4. LE DOCUMENT TROP LOURD PERDAIT TOUTES SES CLÉS D'UN COUP, sur tous les
//      tracés. Il allège désormais celui qui en porte le plus (annotValide).
const ML_SUIVI_MAX_MS=20000;      // la trajectoire automatique : c'est une séquence, pas un film
const ML_SUIVI_ANNOT_MAX_MS=60000; // le suivi d'un tracé : jusqu'à la fin du tracé, une minute au plus
const ML_SUIVI_TOL=2.5;           // l'écart toléré à l'interpolation, en millièmes de l'image
const ML_SUIVI_TYPES_POINTS=Object.freeze(['point','angle','ligne','fleche']);
// LES RETROUVAILLES D'UN POINT PERDU : on le cherche dans un disque de
// ML_REACQ_RAYON fois son rayon autour de là où il devrait être, une image sur
// ML_REACQ_PAS — la recherche large coûte cher —, et on ne le reprend que sur
// une ressemblance FRANCHE : se raccrocher au premier détail venu ferait
// suivre le mauvais point avec aplomb, pire qu'un point perdu.
const ML_REACQ_RAYON=6;
const ML_REACQ_PAS=2;
const ML_REACQ_CONF=0.55;
// Tous les points perdus depuis ce temps-là : le parcours s'arrête. En deçà,
// on continue de chercher — une répétition cachée derrière la machine.
const ML_REACQ_ABANDON_MS=4000;
// ══ LA LONGUEUR DES SEGMENTS, PLAFONNÉE (build 1400) ══════════════════════
//
// Kevin, 22/09/2026 : « tes points se perdent trop vite niveau angle, ce
// n'est pas normal : le point finit par être placé quatre fois plus haut.
// Trouve une solution, type longueur max sur les trois premières secondes, qui
// ne peut être dépassée ». Un genou flou ou caché un instant, et le suiveur se
// raccrochait au premier détail qui lui ressemblait — un pli du short, une
// poignée de la machine —, puis le suivait avec aplomb, loin de la jambe.
//
// UN SEGMENT DE MEMBRE NE S'ALLONGE PAS. Vu de côté, la cuisse et le tibia
// peuvent paraître plus courts quand ils tournent vers la caméra, jamais plus
// longs que leur vraie longueur. D'où deux règles, pour un angle (hanche-genou,
// genou-cheville) et pour une chaîne de repères reliés :
//   · LE PLAFOND : la plus grande longueur vue pendant les ML_SEG_FENETRE_MS
//     premières millisecondes du suivi — un cycle entier, en général —, plus
//     ML_SEG_MARGE. Au-delà, le point fautif est déclaré PERDU, au lieu de
//     suivre le mauvais détail : il est ensuite cherché à nouveau, et le trou
//     se comble entre deux positions vues. Pendant la fenêtre elle-même, le
//     plafond est la longueur posée par le coach fois ML_SEG_DEPART_MAX ;
//   · LES RETROUVAILLES : un point retrouvé doit garder, à ML_SEG_REACQ_ECART
//     près, la longueur de ses segments au moment de la perte — un membre ne
//     change pas de longueur pendant qu'il est caché.
const ML_SEG_FENETRE_MS=3000;
const ML_SEG_MARGE=0.15;
const ML_SEG_DEPART_MAX=1.6;
const ML_SEG_REACQ_ECART=0.2;
// UN POINT RETROUVÉ DOIT RESSEMBLER PRESQUE AUTANT QU'AVANT : au moins
// ML_REACQ_REL de sa ressemblance habituelle (moyenne glissante de ses images
// suivies), en plus du seuil absolu ML_REACQ_CONF. Vu au banc (1400) : un
// genou suivi à 1,00 de ressemblance, caché une seconde, a été « retrouvé » sur
// un détail du fond à 0,56 — juste au-dessus du seuil absolu de 0,55 — et y
// est resté jusqu'à la fin, le vrai genou revenant à portée une seconde plus
// tard.
const ML_REACQ_REL=0.8;
/**
 * PURE. Les segments d'un tracé dont la longueur ne change pas : les deux
 * branches d'un angle, les maillons d'une chaîne de repères RELIÉS. Une ligne
 * ou une flèche peut relier deux choses qui s'éloignent : aucun segment.
 * @param {{t:string, rel?:number}} a
 * @param {number} n  le nombre de points suivis
 * @returns {[number,number][]}
 */
function mlSegmentsRigides(a,n){
  if(a&&a.t==='angle'&&n===3) return [[0,1],[1,2]];
  if(a&&a.t==='point'&&a.rel&&n>=2) return Array.from({length:n-1},(_,i)=>/** @type {[number,number]} */([i,i+1]));
  return [];
}
/**
 * PURE. Les points qui rendent un segment plus long que son plafond. Un point
 * pris dans deux segments trop longs est le fautif — le sommet d'un angle qui
 * s'envole ; sinon, des deux bouts, celui qui a le plus bougé depuis l'image
 * précédente.
 * @param {(number[]|null)[]} pts  les points de l'image, null si perdu
 * @param {(number[]|null)[]} avant  les points de l'image précédente
 * @param {[number,number][]} segs
 * @param {number[]} plafonds  un par segment, dans l'unité de `longueur`
 * @param {(a:number[],b:number[])=>number} longueur
 * @returns {number[]}
 */
function mlSegmentsFautifs(pts,avant,segs,plafonds,longueur){
  /** @type {number[]} */
  const trop=[];
  segs.forEach(([i,j],k)=>{ const A=pts[i], B=pts[j]; if(A&&B&&longueur(A,B)>plafonds[k]) trop.push(k); });
  if(!trop.length) return [];
  /** @type {Map<number,number>} */
  const n=new Map();
  for(const k of trop) for(const q of segs[k]) n.set(q,(n.get(q)||0)+1);
  /** @type {Set<number>} */
  const fautifs=new Set();
  for(const k of trop){
    const [i,j]=segs[k];
    if(fautifs.has(i)||fautifs.has(j)) continue;
    const ni=n.get(i)||0, nj=n.get(j)||0;
    let q=i;
    if(ni!==nj) q=ni>nj?i:j;
    else {
      const Pi=pts[i], Pj=pts[j], Ai=avant[i], Aj=avant[j];
      const di=Pi&&Ai?longueur(Pi,Ai):0, dj=Pj&&Aj?longueur(Pj,Aj):0;
      q=di>=dj?i:j;
    }
    fautifs.add(q);
  }
  return [...fautifs];
}
/**
 * Cherche à nouveau un point perdu, autour de (cx,cy), avec le gabarit
 * d'origine et le gabarit adapté. Rend sa position s'il ressemble franchement,
 * et remet alors le suivi en marche — vitesse nulle, pertes remises à zéro.
 * Rend null sinon, et le suivi reste perdu. IMPURE sur `s`, comme mlSuiviPas.
 * @param {Suivi} s
 * @param {Float32Array} gris
 * @param {number} w
 * @param {number} h
 * @param {number} cx  où le chercher, en pixels de l'image de travail
 * @param {number} cy
 * @returns {{x:number, y:number, conf:number}|null}
 */
function mlSuiviRetrouver(s,gris,w,h,cx,cy){
  const t=mlChercherDisque(s.gabs,gris,w,h,cx,cy,ML_REACQ_RAYON*s.r);
  if(!(t.conf>=ML_REACQ_CONF)) return null;
  if(t.x<s.r||t.y<s.r||t.x>w-1-s.r||t.y>h-1-s.r) return null;
  s.x=t.x; s.y=t.y; s.vx=0; s.vy=0; s.pertes=0; s.perdu=false;
  return {x:t.x,y:t.y,conf:t.conf};
}
/**
 * PURE. Comble les trous d'un suivi : pour chaque point, les instants où il
 * était perdu (null) sont remplis en ligne droite entre la dernière position
 * vue et la suivante. Un point jamais retrouvé reste à sa dernière position
 * vue — un tracé qui s'arrête ment moins qu'un tracé qui invente.
 * @param {number[]} T
 * @param {(number[]|null)[][]} P  pour chaque instant, les points, null si perdu
 * @returns {number[][][]}
 */
function mlSuiviCombler(T,P){
  const n=P.length, m=n?P[0].length:0;
  /** @type {number[][][]} */
  const out=P.map(l=>l.map(p=>p?p.slice():[0,0]));
  for(let q=0;q<m;q++){
    let i=0;
    while(i<n){
      if(P[i][q]){ i++; continue; }
      const a=i-1; let b=i;
      while(b<n&&!P[b][q]) b++;
      const A=a>=0?P[a][q]:null, B=b<n?P[b][q]:null;
      for(let j=i;j<b;j++){
        if(A&&B){
          const f=(T[j]-T[a])/Math.max(1e-6,T[b]-T[a]);
          out[j][q]=[_mlxBorne(A[0]+(B[0]-A[0])*f),_mlxBorne(A[1]+(B[1]-A[1])*f)];
        } else {
          const R=A||B;
          out[j][q]=R?R.slice():[0,0];
        }
      }
      i=b;
    }
  }
  return out;
}
/**
 * PURE. Les images clés qui suffisent à redire un suivi dense : la première,
 * la dernière, et entre elles celles que l'interpolation linéaire ne saurait
 * pas rendre à `tol` près — un Ramer-Douglas-Peucker sur le TEMPS, dont l'écart
 * est le plus grand de tous les points. La tolérance se relâche tant que le
 * résultat dépasse `max` clés.
 * @param {number[]} T  instants, croissants, en ms
 * @param {number[][][]} P  pour chaque instant, les points (normés 0-1000)
 * @param {number} max
 * @param {number} [tol]
 * @returns {[number,number[][]][]}
 */
function mlClesDepuisSuivi(T,P,max,tol){
  const n=Math.min(T.length,P.length);
  if(!n) return [];
  if(n===1) return [[T[0],P[0]]];
  /** @param {number} i @param {number} j @returns {{d:number, k:number}} */
  const pire=(i,j)=>{
    let d=-1, k=-1;
    for(let m=i+1;m<j;m++){
      const f=(T[m]-T[i])/Math.max(1e-6,T[j]-T[i]);
      for(let q=0;q<P[m].length;q++){
        const ex=P[i][q][0]+(P[j][q][0]-P[i][q][0])*f, ey=P[i][q][1]+(P[j][q][1]-P[i][q][1])*f;
        const e=Math.hypot(P[m][q][0]-ex,P[m][q][1]-ey);
        if(e>d){ d=e; k=m; }
      }
    }
    return {d,k};
  };
  let eps=Math.max(0.1,tol||ML_SUIVI_TOL);
  for(;;){
    /** @type {Set<number>} */
    const garde=new Set([0,n-1]);
    /** @type {[number,number][]} */
    const pile=[[0,n-1]];
    while(pile.length){
      const [i,j]=/** @type {[number,number]} */(pile.pop());
      if(j-i<2) continue;
      const r=pire(i,j);
      if(r.d>eps&&r.k>0){ garde.add(r.k); pile.push([i,r.k],[r.k,j]); }
    }
    if(garde.size<=Math.max(2,max)||eps>400){
      const l=[...garde].sort((a,b)=>a-b);
      return l.slice(0,Math.max(2,max)).map(i=>[Math.round(T[i]),P[i].map(p=>[Math.round(p[0]),Math.round(p[1])])]);
    }
    eps*=1.5;
  }
}
/**
 * « SUIVI AUTOMATIQUE » du tracé choisi, depuis l'image affichée jusqu'à la fin
 * de sa durée — une minute au plus (ML_SUIVI_ANNOT_MAX_MS).
 *
 * `opts` (build 1392), pour la PROLONGATION d'un suivi coupé : `id` le tracé à
 * suivre plutôt que le tracé choisi, `debutMs` l'instant de départ plutôt que
 * la tête de lecture — la dernière clé, dont les points sont le départ —, et
 * `reparation` pour ne rien déplacer sous les yeux du coach : ni la tête de
 * lecture, ni un message de réussite, que l'appelant formule lui-même. Un
 * point perdu, lui, se dit toujours.
 * @param {{id?:string, debutMs?:number, reparation?:boolean}} [opts]
 * @returns {Promise<boolean>}
 */
async function mlAnnotSuiviAuto(opts){
  const o=(opts&&typeof opts==='object')?opts:{};
  const a0=_ml&&_mlxAnnot(o.id||_ml.sel), v=_mlVideo();
  if(!_ml||!a0||!v||_mlOccupe()) return false;
  const vw=v.videoWidth, vh=v.videoHeight;
  if(!(vw>0&&vh>0)){ toast('Lance d’abord la vidéo une fois : ses dimensions ne sont pas encore connues.','var(--orange)'); return false; }
  try{ v.pause(); }catch(e){}
  const debut=(typeof o.debutMs==='number'&&isFinite(o.debutMs))?Math.max(0,Math.round(o.debutMs)):_mlxTempsMs();
  const fin=Math.min(a0.f,_ml.dureeMs||a0.f,debut+ML_SUIVI_ANNOT_MAX_MS);
  if(fin-debut<200){ toast('Place la tête de lecture au début du mouvement, avant la fin du tracé.','var(--orange)'); return false; }
  const id=a0.id;
  // LES POINTS DE DÉPART : ceux de l'image affichée — le coach vient de les
  // poser là, ou de les y ajuster.
  const depart=mlAnnotPointsA(a0,debut);
  const parPoint=ML_SUIVI_TYPES_POINTS.includes(a0.t);
  /** @type {number[][]} */
  const cibles=parPoint?depart.map(p=>p.slice())
    :[[depart.reduce((s,p)=>s+p[0],0)/depart.length,depart.reduce((s,p)=>s+p[1],0)/depart.length]];
  if(a0.t==='cercle'&&depart.length) cibles[0]=depart[0].slice();
  // LE GABARIT : un disque de 2,5 % de l'image, et une image de travail
  // réduite à la taille de travail du suiveur — la règle des points nommés.
  const r=Math.max(8,Math.min(vw,vh)*0.025);
  const ech=Math.min(1,ML_R_TRAVAIL/r);
  const w=Math.max(16,Math.round(vw*ech)), h=Math.max(16,Math.round(vh*ech));
  const ex=w/vw, ey=h/vh;
  const fpsMes=Number(/** @type {any} */(v)._rcFps);
  const pasMs=1000/Math.min(30,(isFinite(fpsMes)&&fpsMes>0)?fpsMes:30);
  _ml.mode='annotsuivi'; _ml.progres='Chargement de la vidéo…';
  const jeton=++_ml.analyseJeton;
  _mlxMajEditeur();
  /** @type {(Suivi|null)[]} */
  const suivis=cibles.map(()=>null);
  /** @type {number[]} */ const T=[];
  // Un point perdu vaut null à cet instant : mlSuiviCombler remplit après coup.
  /** @type {(number[]|null)[][]} */ const P=[];
  // La dernière position VUE de chaque point, en millièmes de l'image.
  /** @type {number[][]} */ const vus=cibles.map(c=>c.slice());
  // L'instant de la perte en cours (-1 : le point est suivi), la toute première
  // perte, et combien de fois il a été retrouvé — pour le dire au coach.
  /** @type {number[]} */ const perdusA=cibles.map(()=>-1);
  /** @type {number[]} */ const retrouves=cibles.map(()=>0);
  // À LA PERTE, on photographie où étaient les AUTRES points : c'est leur
  // déplacement depuis qui dit où chercher celui-ci. Un genou qui disparaît
  // pendant que la hanche et la cheville descendent est descendu avec elles.
  /** @type {({L:number[], refs:(number[]|null)[], longueurs?:(number|null)[]}|null)[]} */
  const ancres=cibles.map(()=>null);
  // LES SEGMENTS RIGIDES ET LEURS LONGUEURS, en pixels de la vidéo : celle
  // posée par le coach (L0), et la plus grande vue pendant la fenêtre (Lmax).
  const segs=parPoint?mlSegmentsRigides(a0,cibles.length):[];
  /** @param {number[]} A @param {number[]} B @returns {number} */
  const Lpx=(A,B)=>Math.hypot((A[0]-B[0])/1000*vw,(A[1]-B[1])/1000*vh);
  const L0=segs.map(([i,j])=>Lpx(cibles[i],cibles[j]));
  const Lmax=L0.slice();
  /** @param {number} k @param {number} tMs @returns {number} */
  const plafond=(k,tMs)=>tMs-debut<=ML_SEG_FENETRE_MS?L0[k]*ML_SEG_DEPART_MAX:Lmax[k]*(1+ML_SEG_MARGE);
  /** Les points écartés par la longueur de leurs segments, pour le dire au coach. */
  const ecartes=cibles.map(()=>0);
  // LA RESSEMBLANCE HABITUELLE DE CHAQUE POINT, en moyenne glissante sur ses
  // images suivies : c'est elle qui juge un point retrouvé.
  /** @type {(number|null)[]} */
  const confRef=cibles.map(()=>null);
  /** @param {number} q @returns {(number|null)[]} la longueur de chaque segment de q, à cet instant */
  const longueursDe=q=>segs.map(([i,j])=>(i===q||j===q)?Lpx(vus[i],vus[j]):null);
  /** @param {number} q @returns {number[]} en millièmes */
  const ouChercher=q=>{
    const an=ancres[q];
    if(!an) return vus[q];
    let dx=0, dy=0, n=0;
    for(let j=0;j<cibles.length;j++){
      const r0=an.refs[j];
      if(j===q||!r0||perdusA[j]>=0) continue;
      dx+=vus[j][0]-r0[0]; dy+=vus[j][1]-r0[1]; n++;
    }
    return n?[an.L[0]+dx/n,an.L[1]+dy/n]:an.L;
  };
  const total=Math.max(1,Math.ceil((fin-debut)/pasMs));
  let nb=0;
  const res=await _mlExtraire(_ml.url,debut,fin,w,h,pasMs,img=>{
    if(!_ml||jeton!==_ml.analyseJeton) return 'arret';
    /** @type {(number[]|null)[]} */
    const ici=[];
    const avantVus=vus.map(p=>p.slice());
    for(let q=0;q<cibles.length;q++){
      const c=cibles[q];
      if(!nb){
        const s=mlSuiviDemarrer(img.gris,w,h,c[0]/1000*vw*ex,c[1]/1000*vh*ey,r*ex);
        if(!s) return 'gabarit';
        suivis[q]=s;
        ici.push(c.slice());
        continue;
      }
      const s=suivis[q];
      if(!s) return 'gabarit';
      // UN POINT PERDU SE CHERCHE À NOUVEAU — une image sur ML_REACQ_PAS, là
      // où ses voisins l'emmènent. Tant qu'il n'est pas retrouvé, il ne vaut
      // rien à cet instant (null) : le trou sera comblé entre deux positions
      // vues, jamais par une position inventée.
      if(perdusA[q]>=0){
        if(nb%ML_REACQ_PAS===0){
          const C=ouChercher(q);
          let t=mlSuiviRetrouver(s,img.gris,w,h,C[0]/1000*vw*ex,C[1]/1000*vh*ey);
          // TROP PEU RESSEMBLANT pour ce point-là : un autre détail.
          const cr=confRef[q];
          if(t&&typeof cr==='number'&&t.conf<ML_REACQ_REL*cr){ s.perdu=true; t=null; }
          if(t){
            const pt=[_mlxBorne(t.x/ex/vw*1000),_mlxBorne(t.y/ey/vh*1000)];
            // UN POINT RETROUVÉ GARDE SES SEGMENTS : sous le plafond, et à
            // ML_SEG_REACQ_ECART près de leur longueur au moment de la perte.
            // Sinon, c'est un autre détail qui lui ressemble : il reste perdu.
            const an=ancres[q];
            const faux=segs.some(([i,j],k)=>{
              if(i!==q&&j!==q) return false;
              const o=i===q?j:i;
              if(perdusA[o]>=0) return false;
              const d=Lpx(pt,vus[o]);
              if(d>plafond(k,img.tMs)) return true;
              const l0=an&&an.longueurs?an.longueurs[k]:null;
              return typeof l0==='number'&&l0>0&&Math.abs(d/l0-1)>ML_SEG_REACQ_ECART;
            });
            if(faux){ s.perdu=true; ici.push(null); continue; }
            perdusA[q]=-1; ancres[q]=null; retrouves[q]++;
            vus[q]=pt; ici.push(pt); continue;
          }
        }
        ici.push(null); continue;
      }
      const p=mlSuiviPas(s,img.gris,w,h);
      if(p.etat==='perdu'){
        perdusA[q]=img.tMs;
        ancres[q]={L:vus[q].slice(),refs:vus.map((x,j)=>(j!==q&&perdusA[j]<0)?x.slice():null),longueurs:longueursDe(q)};
        ici.push(null); continue;
      }
      // UNE IMAGE OÙ LE POINT NE RESSEMBLE À RIEN (sous ML_CONF_PERTE) ne
      // donne pas de position : le suiveur y tient sa prédiction, et la
      // meilleure correspondance trouvée n'est qu'un endroit au hasard. Le trou
      // se comblera entre deux positions vues.
      if(p.etat==='doute'&&p.conf<ML_CONF_PERTE){ ici.push(null); continue; }
      if(p.etat==='ok') confRef[q]=confRef[q]===null?p.conf:0.9*/** @type {number} */(confRef[q])+0.1*p.conf;
      const pt=[_mlxBorne(p.x/ex/vw*1000),_mlxBorne(p.y/ey/vh*1000)];
      vus[q]=pt; ici.push(pt);
    }
    // LE PLAFOND DES SEGMENTS : un point qui rend un segment trop long suit
    // un autre détail que le sien. Il est déclaré perdu à cet instant — sa
    // dernière position vue reste celle de l'image précédente —, puis cherché
    // à nouveau comme n'importe quel point perdu.
    if(segs.length&&nb>0){
      const plaf=segs.map((_,k)=>plafond(k,img.tMs));
      for(const q of mlSegmentsFautifs(ici,avantVus,segs,plaf,Lpx)){
        const s=suivis[q]; if(s) s.perdu=true;
        vus[q]=avantVus[q].slice(); ici[q]=null;
        perdusA[q]=img.tMs; ecartes[q]++;
        ancres[q]={L:vus[q].slice(),refs:vus.map((x,j)=>(j!==q&&perdusA[j]<0)?x.slice():null),longueurs:longueursDe(q)};
      }
      // LA FENÊTRE APPREND LA VRAIE LONGUEUR — sans les positions écartées.
      if(img.tMs-debut<=ML_SEG_FENETRE_MS)
        segs.forEach(([i,j],k)=>{ const A=ici[i], B=ici[j]; if(A&&B) Lmax[k]=Math.max(Lmax[k],Lpx(A,B)); });
    }
    T.push(img.tMs); P.push(ici);
    nb++;
    if(nb%4===1){
      _ml.progres='Image '+nb+' sur ~'+total+' · '+mlTempsTexte(img.tMs);
      const t=_mlEl('mlx-suivi-txt'); if(t) t.textContent=_ml.progres;
      const b=_mlEl('mlx-suivi-barre'); if(b) b.style.transform='scaleX('+Math.min(1,nb/total).toFixed(3)+')';
    }
    // TOUS PERDUS DEPUIS TROP LONGTEMPS : inutile de parcourir le reste. Pas
    // dès la première perte, comme avant — un point caché derrière la machine
    // le temps d'une répétition revient, et c'est justement ce qu'on attend.
    return !(perdusA.every(x=>x>=0)&&img.tMs-Math.max(...perdusA)>ML_REACQ_ABANDON_MS);
  },()=>!_ml||jeton!==_ml.analyseJeton);
  if(!_ml) return false;
  _ml.mode='lecture'; _ml.progres='';
  if(res.ok===false){
    const msg={cors:'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : le suivi automatique est impossible sur ce fichier.',
      chargement:'La vidéo n’a pas pu être chargée. Vérifie la connexion, puis réessaie.',
      recherche:'La vidéo ne se laisse pas parcourir image par image sur cet appareil.',
      gabarit:'Un point est posé sur un aplat : rien ne s’y distingue d’une image à l’autre. Pose-le sur un détail contrasté.',
      arret:'Suivi arrêté.'}[res.code]||'Le suivi a échoué.';
    toast(msg,res.code==='arret'?undefined:'var(--orange)');
    _mlxMajEditeur();
    return false;
  }
  const a=_mlxAnnot(id);
  if(!a||T.length<2){ toast('Le suivi n’a rien donné de lisible : réessaie.','var(--orange)'); _mlxMajEditeur(); return false; }
  // LES TROUS SE COMBLENT entre deux positions vues ; un point jamais retrouvé
  // reste à sa dernière position vue.
  const PC=mlSuiviCombler(T,P);
  // DU SUIVI AUX POINTS DU TRACÉ : par point, ou le centre et la forme en bloc.
  const ref=cibles[0];
  const PP=parPoint?PC:PC.map(q=>depart.map(p=>[_mlxBorne(p[0]+q[0][0]-ref[0]),_mlxBorne(p[1]+q[0][1]-ref[1])]));
  // LES CLÉS D'AVANT LE DÉPART RESTENT ; celles du parcours sont remplacées.
  const avant=(Array.isArray(a.k)?a.k:[]).filter(q=>q[0]<debut-20);
  const cles=mlClesDepuisSuivi(T,PP,Math.max(2,ANNOT_CLES_MAX-avant.length));
  _mlxMemoriser();
  _mlxChanger(id,x=>{
    /** @type {[number,string][]} */
    const k=avant.concat(cles.map(q=>/** @type {[number,string]} */([q[0],mlEncoderTrait(q[1])])));
    return {...x,k,p:k[0][1]};
  });
  _mlxApresChangement();
  if(!o.reparation) _mlAller(debut);
  // CE QUI N'A PAS ÉTÉ RETROUVÉ se dit, avec l'instant — c'est là qu'il faut
  // replacer le point. Ce qui a été retrouvé se dit aussi, plus doucement :
  // le passage comblé mérite un coup d'oeil.
  const perdu=perdusA.filter(x=>x>=0);
  const nRetr=retrouves.filter(x=>x>0).length;
  const nEcart=ecartes.reduce((s,x)=>s+x,0);
  if(perdu.length) toast((parPoint&&cibles.length>1?perdu.length+' point'+(perdu.length>1?'s se perdent':' se perd'):'Le suivi se perd')
    +' à '+mlTempsTexte(Math.min(...perdu))+' sans se retrouver : replace-le à cet instant, puis relance le suivi depuis là.','var(--orange)');
  else if(!o.reparation) toast('Suivi posé : '+cles.length+' images clés sur '+mlTempsTexte(T[T.length-1]-T[0]).slice(0,-3)
    +(nRetr?(' · '+(nRetr>1?nRetr+' points perdus un instant, retrouvés':'un point perdu un instant, retrouvé')):'')
    +(nEcart?(' · '+nEcart+' décrochage'+(nEcart>1?'s':'')+' bloqué'+(nEcart>1?'s':'')+' par la longueur des segments'):'')+' ✓');
  return true;
}
// ══ LES SUIVIS COUPÉS PAR L'ANCIENNE BORNE, PROLONGÉS À L'OUVERTURE ═══════
// Kevin, 22/09/2026, après le 1390 : « met en place ». Le 1390 suit jusqu'au
// bout de la vidéo ; les angles suivis AVANT lui restaient coupés à 20 s, et
// il fallait relancer chaque suivi à la main pour les rattraper. Le
// laboratoire le fait désormais seul, à l'ouverture de la vidéo.
//
// ⚠ ON PROLONGE, ON NE REFAIT PAS. Le suivi repart de sa DERNIÈRE CLÉ — ses
//   points et son instant —, et les clés d'avant restent telles quelles :
//   seule la partie manquante se calcule, quelques secondes sur une vidéo de
//   gym, au lieu de tout le mouvement.
// ⚠ ON NE TOUCHE QU'À CE QUE L'ANCIENNE BORNE A COUPÉ, reconnu à sa
//   signature : une dernière clé à 20 s pile d'une clé antérieure, et le tracé
//   qui continue nettement au-delà. Un suivi posé à la main, ou arrêté parce
//   que ses points se sont perdus, ne porte pas cette signature.
// ⚠ C'EST UNE RÉPARATION, PAS UNE CORRECTION : elle s'enregistre sans nouvelle
//   pastille chez l'athlète, et seulement si rien d'autre n'était en cours
//   d'édition — sinon elle attend l'enregistrement du coach, comme le reste.
// ⚠ UNE SEULE TENTATIVE PAR TRACÉ ET PAR SESSION : une vidéo dont l'hébergeur
//   interdit la lecture des images ne redirait pas son refus à chaque
//   ouverture. Et le bouton « Arrêter » du suivi l'interrompt, comme d'habitude.
const ML_ANCIENNE_BORNE_MS=20000;
/** @type {Set<string>} */
const _mlxProlongeTentes=new Set();
/**
 * PURE. Le suivi d'un tracé a-t-il été coupé par l'ancienne borne des 20 s ?
 * Rend {debut, fin} — l'instant de sa dernière clé et la fin du tracé — ou null.
 * @param {Annot} a
 * @param {number} dureeMs  durée de la vidéo, 0 si inconnue
 * @returns {{debut:number, fin:number}|null}
 */
function mlSuiviTronque(a,dureeMs){
  const k=(a&&Array.isArray(a.k))?a.k:[];
  if(k.length<2) return null;
  const der=k[k.length-1][0];
  const fin=Math.min(a.f,dureeMs>0?dureeMs:a.f);
  if(!(fin-der>=1000)) return null;
  // La borne se lisait de la première image suivie à la dernière : l'écart
  // tombe à 20 s, à une ou deux images près — la cible visait le milieu de
  // chaque image, pas son début.
  const coupe=k.slice(0,-1).some(q=>Math.abs(der-q[0]-ML_ANCIENNE_BORNE_MS)<=120);
  return coupe?{debut:der,fin}:null;
}
/**
 * Enregistre une réparation : le document part, sans nouvelle pastille.
 * @returns {boolean}
 */
function _mlxEnregistrerReparation(){
  if(!_ml) return false;
  const r=enregistrerAnnotationsVideo(_ml.email,_ml.videoId,_ml.annot,{silencieux:true});
  if(!r.ok&&r.raison) return false;
  /** @type {DocAnnot} */
  const garde=r.annot||_ml.annot;
  _ml.annot=garde;
  _ml.annotInit=JSON.stringify(garde);
  if(_ml.sel&&!_mlxAnnot(_ml.sel)) _ml.sel=null;
  _mlMajListe();
  _mlxMajTout();
  return !!r.ok;
}
/**
 * Prolonge, un par un, les suivis de la vidéo ouverte que l'ancienne borne a
 * coupés. Rend combien l'ont été.
 * @returns {Promise<number>}
 */
async function _mlxProlongerTronques(){
  if(!_ml||_mlOccupe()) return 0;
  const jeton=_ml.jeton, video=_ml.videoId, duree=_ml.dureeMs;
  /** @type {{a:Annot, t:{debut:number, fin:number}, cle:string}[]} */
  const liste=[];
  for(const a of _ml.annot.a){
    const t=mlSuiviTronque(a,duree), cle=video+'|'+a.id;
    if(t&&!_mlxProlongeTentes.has(cle)) liste.push({a,t,cle});
  }
  if(!liste.length) return 0;
  // RIEN D'AUTRE EN COURS D'ÉDITION : à l'ouverture, c'est le cas ordinaire.
  const propre=!_mlModifie();
  const selAvant=_ml.sel;
  /** @type {string[]} */ const noms=[];
  for(const x of liste){
    if(!_ml||_ml.jeton!==jeton) return noms.length;
    _mlxProlongeTentes.add(x.cle);
    // LE TRACÉ EST CHOISI le temps du suivi : c'est dans son éditeur que
    // s'affichent la progression et le bouton « Arrêter ».
    _ml.sel=x.a.id; _mlxApresSelection();
    const ok=await mlAnnotSuiviAuto({id:x.a.id,debutMs:x.t.debut,reparation:true});
    if(!_ml||_ml.jeton!==jeton) return noms.length;
    const b=_mlxAnnot(x.a.id), k=(b&&b.k)||[];
    if(!ok||!k.length||k[k.length-1][0]<=x.t.debut+500) break;   // arrêté, ou échec déjà dit
    noms.push(x.a.n);
  }
  if(!_ml||_ml.jeton!==jeton) return noms.length;
  _ml.sel=(selAvant&&_mlxAnnot(selAvant))?selAvant:null;
  _mlxApresSelection();
  if(!noms.length) return 0;
  const enreg=propre&&_mlxEnregistrerReparation();
  toast((noms.length>1?noms.length+' suivis prolongés':'Suivi « '+noms[0]+' » prolongé')
    +' jusqu’à la fin de la vidéo — '+(noms.length>1?'ils s’arrêtaient':'il s’arrêtait')+' à 20 s'
    +(enreg?'. Enregistré ✓':'. Pense à enregistrer.'));
  return noms.length;
}
// ── LA TRAJECTOIRE SUIVIE AUTOMATIQUEMENT (build 1385) ──────────────────────
//
// Kevin : « le bouton Trajectoire doit permettre de mettre un point qui suit
// automatiquement la partie sélectionnée lors du mouvement, afin de tracer la
// trajectoire pendant le lancement de la vidéo : il doit identifier la zone
// sélectionnée et la suivre, et tracer les traits seul ».
//
// Un toucher sur le détail — le bout de la barre, un genou, un poignet — le
// désigne ; un glisser, du centre vers le bord, entoure une zone plus large.
// Le suiveur des points nommés (le même que le suivi d'un tracé) la suit
// image par image, depuis l'image affichée jusqu'à la fin de la séquence
// choisie, ou vingt secondes au plus ; la vidéo avance à l'écran et le trait
// s'y dessine au fur et à mesure.
//
// LA TRAJECTOIRE GARDE SON HORAIRE : un instant par point (`tp`). Rejouée, elle
// se trace avec le mouvement, un point en tête — chez le coach, chez l'athlète,
// et dans la vidéo exportée. Les points sont choisis dans l'espace ET dans le
// temps (mlClesDepuisSuivi) : un arrêt en bas du mouvement reste un arrêt, là
// où une simplification du seul dessin l'aurait effacé.
const ML_TRAJ_TENUE_MS=2000;      // la trajectoire entière reste à l'écran après le mouvement
/**
 * @param {number[]} p  le détail, en millièmes de l'image
 * @param {number} rVid  le rayon de la zone en pixels de la vidéo — 0 : la taille par défaut
 * @returns {Promise<boolean>}
 */
async function mlTrajectoireAuto(p,rVid){
  const v=_mlVideo();
  if(!_ml||!v||_mlOccupe()) return false;
  const vw=v.videoWidth, vh=v.videoHeight;
  if(!(vw>0&&vh>0)){ toast('Lance d’abord la vidéo une fois : ses dimensions ne sont pas encore connues.','var(--orange)'); return false; }
  if(_ml.annot.a.length>=ANNOT_MAX){ toast(ANNOT_MAX+' tracés au plus par vidéo.','var(--orange)'); return false; }
  try{ v.pause(); }catch(e){}
  const debut=_mlxTempsMs(), seq=_mlActif();
  const finVideo=_ml.dureeMs||debut+ML_SUIVI_MAX_MS;
  const finSeq=(seq&&debut>=seq.debutMs&&debut<seq.finMs-100)?seq.finMs:finVideo;
  const fin=Math.min(finVideo,finSeq,debut+ML_SUIVI_MAX_MS);
  if(fin-debut<200){ toast('Place la tête de lecture avant la fin de la vidéo : il ne reste rien à suivre.','var(--orange)'); return false; }
  // LA ZONE : celle que le coach a entourée, bornée ; sinon 2,5 % de l'image,
  // la règle des points nommés. L'image de travail est réduite à la taille
  // de travail du suiveur.
  const r=rVid>0?Math.max(6,Math.min(rVid,Math.min(vw,vh)*0.12)):Math.max(8,Math.min(vw,vh)*0.025);
  const ech=Math.min(1,ML_R_TRAVAIL/r);
  const w=Math.max(16,Math.round(vw*ech)), h=Math.max(16,Math.round(vh*ech));
  const ex=w/vw, ey=h/vh;
  const fpsMes=Number(/** @type {any} */(v)._rcFps);
  const pasMs=1000/Math.min(30,(isFinite(fpsMes)&&fpsMes>0)?fpsMes:30);
  const total=Math.max(1,Math.ceil((fin-debut)/pasMs));
  _ml.mode='trajsuivi'; _ml.progres='Chargement de la vidéo…'; _ml.trajStop=false;
  _ml.trace={t:'libre',pts:[p.slice()]}; _ml.trajZone={c:p.slice(),r};
  const jeton=++_ml.analyseJeton;
  _mlxMajOutils(); _mlDessinerCalque();
  /** @type {Suivi|null} */
  let s=null;
  /** @type {number[]} */ const T=[];
  /** @type {number[][][]} */ const P=[];
  let perdu=-1, nb=0;
  const res=await _mlExtraire(_ml.url,debut,fin,w,h,pasMs,img=>{
    if(!_ml||jeton!==_ml.analyseJeton) return 'arret';
    // « ARRÊTER » GARDE CE QUI EST SUIVI : c'est une trajectoire plus courte,
    // pas une erreur.
    if(_ml.trajStop) return false;
    /** @type {number[]} */
    let q;
    if(!nb){
      s=mlSuiviDemarrer(img.gris,w,h,p[0]/1000*vw*ex,p[1]/1000*vh*ey,r*ex);
      if(!s) return 'gabarit';
      q=p.slice();
    } else {
      if(!s) return 'gabarit';
      const st=mlSuiviPas(s,img.gris,w,h);
      // PERDU : la trajectoire s'arrête là où le détail a été vu en dernier.
      // Un trait qui saute au hasard mentirait plus qu'un trait qui s'arrête.
      if(st.etat==='perdu'){ perdu=img.tMs; return false; }
      q=[_mlxBorne(st.x/ex/vw*1000),_mlxBorne(st.y/ey/vh*1000)];
    }
    T.push(img.tMs); P.push([q]); nb++;
    // LE TRAIT SE DESSINE PENDANT QU'IL SE CALCULE, et la vidéo suit.
    if(_ml.trace&&_ml.trace.t==='libre') _ml.trace.pts.push(q);
    if(_ml.trajZone) _ml.trajZone.c=q;
    if(nb%3===1){
      _ml.progres='Suivi : '+mlTempsTexte(img.tMs-debut).slice(0,-3)+' / '+mlTempsTexte(fin-debut).slice(0,-3)
        +' · image '+nb+' sur ~'+total;
      const z=_mlEl('mlx-traj-txt'); if(z) z.textContent=_ml.progres;
      if(!v.seeking){ try{ v.currentTime=img.tMs/1000; }catch(e){} }
      _mlDessinerCalque();
    }
    return true;
  },()=>!_ml||jeton!==_ml.analyseJeton);
  if(!_ml) return false;
  _ml.mode='lecture'; _ml.progres=''; _ml.trace=null; _ml.trajZone=null;
  if(res.ok===false){
    const msg={cors:'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : le suivi est impossible sur ce fichier. Trace la trajectoire à la main.',
      chargement:'La vidéo n’a pas pu être chargée. Vérifie la connexion, puis réessaie.',
      recherche:'La vidéo ne se laisse pas parcourir image par image sur cet appareil. Trace la trajectoire à la main.',
      gabarit:'Rien ne se distingue à cet endroit d’une image à l’autre. Touche un détail contrasté — le bout de la barre, un disque, une articulation.',
      arret:'Suivi arrêté.'}[res.code]||'Le suivi a échoué.';
    toast(msg,res.code==='arret'?undefined:'var(--orange)');
    _mlxMajOutils(); _mlDessinerCalque();
    return false;
  }
  if(T.length<2){
    toast('Le détail s’est perdu dès le départ. Touche un détail plus contrasté, ou entoure-le en glissant.','var(--orange)');
    _mlxMajOutils(); _mlDessinerCalque();
    return false;
  }
  const cles=mlClesDepuisSuivi(T,P,ANNOT_PTS_MAX);
  const tp=cles.map(q=>Math.round(q[0]));
  const a=_mlxCreer('libre',cles.map(q=>q[1][0]),{d0:tp[0],f0:Math.min(finVideo,tp[tp.length-1]+ML_TRAJ_TENUE_MS),tp});
  if(!a){ _mlxMajOutils(); _mlDessinerCalque(); return false; }
  toast(perdu>=0
    ?'Le détail se perd à '+mlTempsTexte(perdu).slice(0,-3)+' : la trajectoire s’arrête là.'
    :'Trajectoire suivie sur '+mlTempsTexte(tp[tp.length-1]-tp[0]).slice(0,-3)+' ✓',perdu>=0?'var(--orange)':undefined);
  // L'OUTIL SE REPOSE sur Sélection : la trajectoire est posée, et un toucher
  // sur l'image pendant sa relecture ne doit pas en lancer une autre. Un
  // modèle en cours garde la main — il arme lui-même son étape suivante.
  if(!_ml.guide) mlOutil('selection');
  // ELLE SE REJOUE AUSSITÔT : la vidéo repart du premier point, et le trait se
  // trace avec le mouvement.
  _mlAller(tp[0]);
  setTimeout(()=>{ const v2=_mlVideo(); if(_ml&&v2&&_ml.mode==='lecture'){ try{ const pr=v2.play(); if(pr&&pr.catch) pr.catch(()=>{}); }catch(e){} } },300);
  return true;
}
/** Arrête la trajectoire en cours de suivi, et garde ce qui est déjà suivi. */
function mlTrajArreter(){
  if(!_ml||_ml.mode!=='trajsuivi') return false;
  _ml.trajStop=true;
  return true;
}
/** @param {boolean} auto  suivi automatique, ou tracé à la main */
function mlTrajMode(auto){
  if(!_ml) return false;
  _ml.trajAuto=!!auto;
  if(_ml.trace&&_ml.trace.t==='libre') _ml.trace=null;
  _mlxMajOutils(); _mlDessinerCalque();
  return true;
}
/** Arrête un suivi automatique en cours. */
function mlAnnotSuiviArreter(){
  if(!_ml||_ml.mode!=='annotsuivi') return false;
  _ml.analyseJeton++;
  return true;
}

// ── L'EXPORT : LA VIDÉO AVEC SES TRACÉS GRAVÉS ─────────────────────────────
//
// Kevin, 21/09/2026 : « on ne peut pas encore télécharger une vidéo où les
// tracés sont gravés — fais-le ». La vidéo est REJOUÉE dans un canevas caché :
// chaque image y est peinte, les tracés et la légende par-dessus — le même
// dessin que l'écran, parce que c'est le même code —, et le canevas est
// enregistré par le navigateur (MediaRecorder). Rien ne part sur un serveur :
// le fichier naît sur l'appareil, et la vidéo d'origine n'est pas touchée.
//
// ⚠ EN TEMPS RÉEL. Le navigateur enregistre ce qu'il joue : exporter vingt
//   secondes prend vingt secondes, et quatre-vingts au quart de vitesse. C'est
//   le prix d'un export sans serveur ni bibliothèque de plusieurs mégaoctets ;
//   l'écran le dit avant de commencer.
// ⚠ L'ONGLET DOIT RESTER VISIBLE : un onglet caché ne peint plus. L'export se
//   met alors en pause, vidéo et enregistreur ensemble, et reprend au retour.
// ⚠ L'HÉBERGEUR DOIT PERMETTRE LA LECTURE DES IMAGES (CORS), comme pour les
//   analyses : sans cela le canevas est « contaminé » et le navigateur refuse
//   de l'enregistrer. On le vérifie sur la première image, et on le dit.

/** @typedef {{blob:Blob, type:string, ext:string, dureeMs:number, largeur:number, hauteur:number, reel:number}} ResultatExport */
const ML_EXPORT_COTE_MAX=1920;       // le plus grand côté du fichier, en pixels
const ML_EXPORT_DEBIT=8000000;       // bits par seconde : la netteté d'un 1080p
/** @returns {{mime:string, ext:string}|null} le meilleur format que ce navigateur sait enregistrer */
function mlFormatExport(){
  const MR=/** @type {any} */(window).MediaRecorder;
  if(!MR||typeof MR.isTypeSupported!=='function') return null;
  // LE MP4 D'ABORD : c'est lui que les téléphones, les messageries et les
  // réseaux lisent partout. Le WebM ensuite, que Chrome et Firefox savent faire.
  for(const [mime,ext] of [['video/mp4;codecs=avc1.42E01E,mp4a.40.2','mp4'],['video/mp4;codecs=avc1','mp4'],['video/mp4','mp4'],
    ['video/webm;codecs=vp9,opus','webm'],['video/webm;codecs=vp8,opus','webm'],['video/webm','webm']])
    if(MR.isTypeSupported(mime)) return {mime,ext};
  return null;
}
/**
 * PURE. La taille du fichier : celle de la vidéo, ramenée à ML_EXPORT_COTE_MAX
 * sur son plus grand côté, en nombres pairs — les encodeurs l'exigent.
 * @param {number} vw
 * @param {number} vh
 * @returns {{w:number, h:number}}
 */
function mlTailleExport(vw,vh){
  const k=Math.min(1,ML_EXPORT_COTE_MAX/Math.max(1,vw,vh));
  const pair=(/** @type {number} */ x)=>Math.max(2,Math.round(x*k/2)*2);
  return {w:pair(vw),h:pair(vh)};
}
/**
 * Enregistre [debutMs, finMs] de la vidéo, tracés gravés.
 * @param {{url:string, annot:DocAnnot|null, debutMs:number, finMs:number, vitesse:number, son:boolean,
 *   logo:string, ac:AudioContext|null, surProgres:(f:number, msg:string)=>void, arreter:()=>boolean}} o
 * @returns {Promise<{ok:true, r:ResultatExport}|{ok:false, code:string}>}
 */
async function mlExporterVideo(o){
  const fmt=mlFormatExport();
  if(!fmt) return {ok:false,code:'format'};
  const adresse=safeUrlRaw(o.url);
  if(adresse==='#') return {ok:false,code:'chargement'};
  const v=document.createElement('video');
  v.crossOrigin='anonymous'; v.playsInline=true; v.preload='auto';
  v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true');
  v.style.cssText='position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  document.body.appendChild(v);
  v.src=adresse;
  /** @type {MediaRecorder|null} */ let rec=null;
  /** @type {MediaStream|null} */ let flux=null;
  let raf=0;
  const surVisibilite=()=>{
    if(!rec) return;
    if(document.hidden){ try{ v.pause(); if(rec.state==='recording') rec.pause(); }catch(e){} }
    else { try{ if(rec.state==='paused') rec.resume(); const p=v.play(); if(p&&p.catch) p.catch(()=>{}); }catch(e){} }
  };
  try{
    const pret=await new Promise(res=>{
      const garde=setTimeout(()=>res(false),20000);
      v.addEventListener('loadeddata',()=>{ clearTimeout(garde); res(true); },{once:true});
      v.addEventListener('error',()=>{ clearTimeout(garde); res(false); },{once:true});
    });
    if(!pret) return {ok:false,code:'chargement'};
    const vw=v.videoWidth, vh=v.videoHeight;
    if(!(vw>0&&vh>0)) return {ok:false,code:'chargement'};
    const D=Number(v.duration)*1000;
    const debut=Math.max(0,Math.min(o.debutMs,isFinite(D)?D:o.debutMs));
    const fin=Math.min(isFinite(D)&&D>0?D:o.finMs,o.finMs);
    if(!(fin-debut>=200)) return {ok:false,code:'duree'};
    const {w,h}=mlTailleExport(vw,vh);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d');
    if(!g) return {ok:false,code:'chargement'};
    /** @type {RectImage} */
    const R={s:w/vw,ox:0,oy:0,vw,vh};
    // LE LOGO DU COACH, en bas à droite. Une image d'une autre origine
    // contaminerait le canevas : sans autorisation, on s'en passe.
    /** @type {HTMLImageElement|null} */
    let logo=null;
    if(o.logo){
      logo=await new Promise(res=>{
        const im=new Image();
        if(!/^data:/.test(o.logo)) im.crossOrigin='anonymous';
        const garde=setTimeout(()=>res(null),4000);
        im.onload=()=>{ clearTimeout(garde); res(im); };
        im.onerror=()=>{ clearTimeout(garde); res(null); };
        im.src=o.logo;
      });
    }
    const peindre=(/** @type {number} */ sMs)=>{
      g.drawImage(v,0,0,w,h);
      if(o.annot) mlDessinerAnnotations(g,R,o.annot,sMs,{});
      if(logo&&logo.naturalWidth){
        const lh=Math.round(h*0.07), lw=Math.round(lh*logo.naturalWidth/logo.naturalHeight), m=Math.round(h*0.025);
        g.save(); g.globalAlpha=0.92; g.drawImage(logo,w-lw-m,h-lh-m,lw,lh); g.restore();
      }
    };
    // LA PREMIÈRE IMAGE, ET LA VÉRIFICATION CORS avant tout le reste.
    await new Promise(res=>{ v.addEventListener('seeked',()=>res(true),{once:true}); try{ v.currentTime=debut/1000; }catch(e){ res(false); } });
    peindre(debut);
    try{ g.getImageData(0,0,1,1); }catch(e){ return {ok:false,code:'cors'}; }
    if(logo) try{ g.getImageData(w-2,h-2,1,1); }catch(e){ logo=null; peindre(debut); }
    // LE FLUX : le canevas, image par image, et le son d'origine à vitesse normale.
    const cc=/** @type {any} */(c);
    const avecRequete=typeof cc.captureStream==='function';
    if(!avecRequete) return {ok:false,code:'format'};
    flux=/** @type {MediaStream} */(cc.captureStream(30));
    const pisteV=/** @type {any} */(flux.getVideoTracks()[0]);
    let sonOk=false;
    if(o.son&&o.vitesse===1&&o.ac){
      try{
        // ⚠ resume() ATTEND UN GESTE et ne rend jamais la main sans lui : on
        //   borne l'attente, et l'export se fait muet plutôt que de rester figé.
        if(o.ac.state==='suspended') await Promise.race([o.ac.resume().catch(()=>{}),new Promise(r=>setTimeout(r,800))]);
        if(o.ac.state!=='running') throw new Error('muet');
        const src=o.ac.createMediaElementSource(v), dest=o.ac.createMediaStreamDestination();
        src.connect(dest);
        const pa=dest.stream.getAudioTracks()[0];
        if(pa){ flux.addTrack(pa); sonOk=true; }
      }catch(e){ sonOk=false; }
    }
    v.muted=!sonOk;
    const morceaux=/** @type {Blob[]} */([]);
    rec=new MediaRecorder(flux,{mimeType:fmt.mime,videoBitsPerSecond:ML_EXPORT_DEBIT});
    rec.ondataavailable=e=>{ if(e.data&&e.data.size) morceaux.push(e.data); };
    const arrete=new Promise(res=>{ if(rec) rec.onstop=()=>res(true); });
    videoSetRate(v,o.vitesse);
    document.addEventListener('visibilitychange',surVisibilite);
    rec.start(500);
    try{ await v.play(); }
    catch(e){
      // LA LECTURE AVEC SON peut être refusée sans geste récent : on repart
      // muet plutôt que d'échouer.
      v.muted=true;
      try{ await v.play(); }catch(e2){ try{ rec.stop(); }catch(x){} return {ok:false,code:'lecture'}; }
    }
    const t0=performance.now();
    /** @type {string} */
    let code='';
    // ⚠ LA BOUCLE SUIT L'AFFICHAGE DE LA PAGE, et non les images de la vidéo :
    //   requestVideoFrameCallback ne se déclenche plus pour une vidéo que
    //   personne ne voit — et celle-ci est cachée. Mesuré : soixante-dix-neuf
    //   images en 2,6 s, puis plus rien, sur une vidéo de six secondes qui, elle,
    //   jouait jusqu'au bout. On peint donc à chaque tour d'affichage, dès que
    //   l'instant de la vidéo a avancé.
    await new Promise(res=>{
      let fini=false, dernier=-1;
      const finir=()=>{ if(fini) return; fini=true; cancelAnimationFrame(raf); res(true); };
      const pas=()=>{
        if(fini) return;
        if(o.arreter()){ code='arret'; finir(); return; }
        const sMs=Number(v.currentTime)*1000;
        if(sMs!==dernier){
          dernier=sMs;
          peindre(sMs);
          if(pisteV&&typeof pisteV.requestFrame==='function') try{ pisteV.requestFrame(); }catch(e){}
          const f=Math.max(0,Math.min(1,(sMs-debut)/(fin-debut)));
          o.surProgres(f,mlTempsTexte(Math.max(0,sMs-debut)).slice(0,-3)+' / '+mlTempsTexte(fin-debut).slice(0,-3));
        }
        if(sMs>=fin-1||v.ended){ finir(); return; }
        raf=requestAnimationFrame(pas);
      };
      v.addEventListener('ended',()=>finir(),{once:true});
      raf=requestAnimationFrame(pas);
    });
    try{ v.pause(); }catch(e){}
    if(rec.state!=='inactive') rec.stop();
    await arrete;
    if(code) return {ok:false,code};
    const blob=new Blob(morceaux,{type:fmt.mime.split(';')[0]});
    if(!blob.size) return {ok:false,code:'vide'};
    return {ok:true,r:{blob,type:blob.type,ext:fmt.ext,dureeMs:Math.round((fin-debut)/o.vitesse),largeur:w,hauteur:h,
      reel:performance.now()-t0}};
  } catch(e){
    return {ok:false,code:'echec'};
  } finally {
    document.removeEventListener('visibilitychange',surVisibilite);
    cancelAnimationFrame(raf);
    try{ if(rec&&rec.state!=='inactive') rec.stop(); }catch(e){}
    if(flux) flux.getTracks().forEach(t=>{ try{ t.stop(); }catch(e){} });
    try{ v.pause(); v.removeAttribute('src'); v.load(); }catch(e){}
    v.remove();
  }
}
const ML_EXPORT_MSG=Object.freeze({
  format:'Ce navigateur ne sait pas enregistrer de vidéo. Essaie Chrome, Edge, Firefox ou Safari récent.',
  chargement:'La vidéo n’a pas pu être chargée. Vérifie la connexion, puis réessaie.',
  cors:'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : l’export est impossible sur ce fichier.',
  duree:'Le passage choisi est trop court pour une vidéo.',
  lecture:'La vidéo refuse de se lancer sur cet appareil.',
  vide:'L’enregistrement n’a rien donné : réessaie, en gardant l’onglet ouvert.',
  echec:'L’export a échoué.',arret:'Export arrêté.'});

// ── LA FENÊTRE D'EXPORT, commune au coach et à l'athlète ────────────────────
/** @type {{arret:boolean, url:string, ac:AudioContext|null, o:any}|null} */
let _mle=null;
/**
 * @param {{url:string, annot:DocAnnot|null, nom:string, sequence:Segment|null, dureeMs:number, logo:string, libLogo?:string}} o
 * @returns {boolean}
 */
function mlOuvrirExport(o){
  _mlInjecterStyle();
  mlFermerExport();
  const fmt=mlFormatExport();
  const d=document.createElement('div');
  d.id='mle'; d.className='mle-voile';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Exporter la vidéo annotée');
  const seq=o.sequence;
  const S=_mlxIco;
  d.innerHTML='<div class="mle">'
    +'<div class="mle-tete"><span class="mle-ico">'+S('export',22)+'</span><div><b>Exporter la vidéo</b>'
      +'<span>Les tracés et la légende gravés dans l’image, sans toucher à l’original.</span></div>'
      +'<button type="button" class="mlx-ico-b mlx-ico-p" onclick="mlFermerExport()" aria-label="Fermer">×</button></div>'
    +(fmt?'':'<p class="mle-alerte">'+ML_EXPORT_MSG.format+'</p>')
    +'<div class="mle-choix"><span class="mlx-lab-s">Passage</span><div class="mlx-chips mlx-chips-l" data-choix="portion">'
      +'<button type="button" class="mlx-chip" aria-pressed="true" data-v="tout">Toute la vidéo · '+_mlDureeCourte(o.dureeMs)+'</button>'
      +(seq?'<button type="button" class="mlx-chip" aria-pressed="false" data-v="seq">'+escapeHtml(seq.label)+' · '+_mlDureeCourte(seq.finMs-seq.debutMs)+'</button>':'')
    +'</div></div>'
    +'<div class="mle-choix"><span class="mlx-lab-s">Vitesse</span><div class="mlx-chips mlx-chips-l" data-choix="vitesse">'
      +[[1,'Normale'],[0.5,'Ralenti ½'],[0.25,'Ralenti ¼']].map(([k,l],i)=>'<button type="button" class="mlx-chip" aria-pressed="'+(i===0)+'" data-v="'+k+'">'+l+'</button>').join('')
    +'</div></div>'
    +'<label class="mlx-coche"><input type="checkbox" id="mle-son" checked> Garder le son d’origine (à vitesse normale)</label>'
    +(o.logo?'<label class="mlx-coche"><input type="checkbox" id="mle-logo" checked> '+escapeHtml(o.libLogo||'Mon logo en bas à droite')+'</label>':'')
    +'<p class="mlx-note" id="mle-note"></p>'
    +'<div class="mle-prog" hidden><div class="mle-barre"><i id="mle-barre"></i></div><span id="mle-txt">Préparation…</span></div>'
    +'<div class="mle-fin" id="mle-fin" hidden></div>'
    +'<div class="mle-pied"><button type="button" class="mlx-b" onclick="mlFermerExport()">Fermer</button>'
      +'<button type="button" class="mlx-enreg mle-go" id="mle-go"'+(fmt?'':' disabled')+'>'+S('export',18)+'<span>Créer la vidéo</span></button></div>'
  +'</div>';
  document.body.appendChild(d);
  _mle={arret:false,url:'',ac:null,o};
  const majNote=()=>{
    const ch=_mlexChoix(d);
    const duree=ch.portion==='seq'&&seq?seq.finMs-seq.debutMs:o.dureeMs;
    const son=/** @type {HTMLInputElement|null} */(d.querySelector('#mle-son'));
    if(son){ son.disabled=ch.vitesse!==1; if(ch.vitesse!==1) son.checked=false; }
    const n=d.querySelector('#mle-note');
    if(n) n.textContent='Environ '+_mlDureeCourte(duree/ch.vitesse)+' d’enregistrement, en '+(fmt?fmt.ext.toUpperCase():'—')
      +'. Garde cet onglet ouvert et visible pendant l’export : il se met en pause sinon.';
  };
  d.addEventListener('click',e=>{
    const b=/** @type {HTMLElement|null} */(e.target instanceof Element?e.target.closest('[data-v]'):null);
    if(e.target===d){ mlFermerExport(); return; }
    if(!b) return;
    const grp=b.closest('[data-choix]');
    if(!grp) return;
    grp.querySelectorAll('[data-v]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    majNote();
  });
  const go=d.querySelector('#mle-go');
  if(go) go.addEventListener('click',()=>{ mlLancerExport(); });
  majNote();
  return true;
}
/** @param {HTMLElement} d @returns {{portion:string, vitesse:number}} */
function _mlexChoix(d){
  const p=d.querySelector('[data-choix="portion"] [aria-pressed="true"]');
  const v=d.querySelector('[data-choix="vitesse"] [aria-pressed="true"]');
  return {portion:p instanceof HTMLElement?String(p.dataset.v):'tout',vitesse:v instanceof HTMLElement?Number(v.dataset.v)||1:1};
}
/** Lance l'export avec les choix de la fenêtre. Le contexte audio naît ICI, dans le geste. */
async function mlLancerExport(){
  const d=_mlEl('mle');
  if(!d||!_mle) return false;
  const E=_mle, o=E.o, ch=_mlexChoix(d);
  const son=/** @type {HTMLInputElement|null} */(d.querySelector('#mle-son'));
  const lg=/** @type {HTMLInputElement|null} */(d.querySelector('#mle-logo'));
  const avecSon=!!(son&&son.checked&&ch.vitesse===1);
  try{ const AC=/** @type {any} */(window).AudioContext||/** @type {any} */(window).webkitAudioContext; if(avecSon&&AC) E.ac=new AC(); }catch(e){ E.ac=null; }
  const seq=ch.portion==='seq'?o.sequence:null;
  const go=/** @type {HTMLButtonElement|null} */(d.querySelector('#mle-go'));
  const prog=/** @type {HTMLElement|null} */(d.querySelector('.mle-prog'));
  const fin=/** @type {HTMLElement|null} */(d.querySelector('#mle-fin'));
  if(go){ go.disabled=true; go.innerHTML='<span>Export en cours…</span>'; }
  if(prog) prog.hidden=false;
  if(fin){ fin.hidden=true; fin.innerHTML=''; }
  d.querySelectorAll('.mle-choix button, .mlx-coche input').forEach(x=>{ /** @type {HTMLButtonElement} */(x).disabled=true; });
  const pied=d.querySelector('.mle-pied .mlx-b');
  if(pied){ pied.textContent='Arrêter'; pied.setAttribute('onclick','mlArreterExport()'); }
  E.arret=false;
  const res=await mlExporterVideo({url:o.url,annot:o.annot,debutMs:seq?seq.debutMs:0,finMs:seq?seq.finMs:o.dureeMs||86400000,
    vitesse:ch.vitesse,son:avecSon,logo:lg&&lg.checked?o.logo:'',ac:E.ac,
    surProgres:(f,msg)=>{ const b=_mlEl('mle-barre'); if(b) b.style.transform='scaleX('+f.toFixed(3)+')'; const t=_mlEl('mle-txt'); if(t) t.textContent=msg; },
    arreter:()=>!_mle||_mle.arret});
  if(E.ac) try{ E.ac.close(); }catch(e){}
  E.ac=null;
  if(!_mle||_mle!==E||!_mlEl('mle')) return false;
  if(prog) prog.hidden=true;
  if(pied){ pied.textContent='Fermer'; pied.setAttribute('onclick','mlFermerExport()'); }
  d.querySelectorAll('.mle-choix button, .mlx-coche input').forEach(x=>{ /** @type {HTMLButtonElement} */(x).disabled=false; });
  if(go){ go.disabled=false; go.innerHTML=_mlxIco('export',18)+'<span>'+(res.ok?'Recréer':'Réessayer')+'</span>'; }
  if(!res.ok){
    toast(ML_EXPORT_MSG[/** @type {keyof typeof ML_EXPORT_MSG} */(res.code)]||ML_EXPORT_MSG.echec,res.code==='arret'?undefined:'var(--orange)');
    return false;
  }
  if(E.url) try{ URL.revokeObjectURL(E.url); }catch(e){}
  E.url=URL.createObjectURL(res.r.blob);
  const nom=('repcore-'+String(o.nom||'video').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'video')+'-annotee.'+res.r.ext;
  const mo=(res.r.blob.size/1048576).toFixed(1).replace('.',',');
  let partage=false;
  try{
    const f=new File([res.r.blob],nom,{type:res.r.type});
    const n=/** @type {any} */(navigator);
    partage=!!(n.canShare&&n.canShare({files:[f]})&&n.share);
    E.o.fichier=f;
  }catch(e){ partage=false; }
  if(fin){
    fin.hidden=false;
    fin.innerHTML='<video class="mle-apercu" src="'+E.url+'" controls playsinline></video>'
      +'<p class="mlx-note">'+escapeHtml(nom)+' · '+res.r.largeur+' × '+res.r.hauteur+' · '+mo+' Mo</p>'
      +'<div class="mle-pied"><a class="mlx-enreg mle-dl" href="'+E.url+'" download="'+escapeHtml(nom)+'">'+_mlxIco('export',18)+'<span>Télécharger</span></a>'
      +(partage?'<button type="button" class="mlx-b" onclick="mlPartagerExport()">Partager…</button>':'')+'</div>';
  }
  toast('Vidéo prête ✓');
  return true;
}
function mlArreterExport(){ if(!_mle) return false; _mle.arret=true; return true; }
function mlPartagerExport(){
  const f=_mle&&_mle.o&&_mle.o.fichier;
  const n=/** @type {any} */(navigator);
  if(!f||!n.share) return false;
  try{ const p=n.share({files:[f],title:'Vidéo annotée'}); if(p&&p.catch) p.catch(()=>{}); }catch(e){ return false; }
  return true;
}
function mlFermerExport(){
  const d=_mlEl('mle');
  if(_mle){ _mle.arret=true; if(_mle.url) try{ URL.revokeObjectURL(_mle.url); }catch(e){} }
  _mle=null;
  if(d) d.remove();
  return true;
}
/** Le bouton du laboratoire : la vidéo ouverte, ses tracés en cours, la séquence choisie. */
function mlExporterLab(){
  if(!_ml) return false;
  return mlOuvrirExport({url:_ml.url,annot:_ml.annot,nom:_ml.nom,sequence:_mlActif(),dureeMs:_ml.dureeMs,
    logo:String((currentUser||{}).logo||'').trim()});
}

// ══ L'ÉTAT ET L'OUVERTURE ═════════════════════════════════════════════════════

/** @type {EtatMl|null} */
let _ml=null;

/** @returns {HTMLVideoElement|null} */
function _mlVideo(){
  const v=document.getElementById('ml-video');
  return (v instanceof HTMLVideoElement)?v:null;
}
/** @param {string} id @returns {HTMLElement|null} */
function _mlEl(id){ return document.getElementById(id); }

/**
 * L'ouverture. Appelée par ouvrirMotionLab (index.html), qui a déjà vérifié
 * que la vidéo est déposée et que le coach est bien celui de l'athlète — on
 * revérifie quand même : la fonction est globale, et une garde qui ne vit que
 * dans l'appelant n'en est pas une.
 * @param {string} email
 * @param {string} videoId
 * @returns {boolean}
 */
function mlOuvrir(email,videoId){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!currentUser||c.coachId!==currentUser.id){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false;
  }
  /** @type {any[]} */
  const vids=Array.isArray(c.videos)?c.videos:[];
  const v=vids.find(x=>x&&x.id===videoId);
  if(!v){ toast('Vidéo introuvable','var(--orange)'); return false; }
  _mlInjecterStyle();
  const segs=segmentsVideo(v);
  const date=Number(v.date)?new Date(Number(v.date)).toLocaleDateString('fr-FR'):'';
  // LES ANNOTATIONS DÉJÀ ENVOYÉES se rouvrent telles que l'athlète les voit.
  /** @type {DocAnnot} */
  const annotDoc=/** @type {DocAnnot|null} */(annotValide(v.annot))||mlDocVide();
  _ml={email,videoId,url:String(v.url||''),nom:String(v.name||'Vidéo'),
    sousTitre:[String(c.fname||''),date].filter(Boolean).join(' · '),
    initiaux:segs,segments:segs.map(s=>({...s})),actifId:segs.length?segs[0].id:null,
    zoom:1,dureeMs:0,boucle:false,jeton:0,raf:0,seekEnAttente:null,
    mode:'lecture',graine:null,disqueM:ML_DISQUE_M,sens:'',fantome:false,
    analyseJeton:0,progres:'',suivis:{},cacheBarre:null,cacheRep:null,repere:null,
    angCote:'',angCalques:[],epingles:[],cachePose:null,
    theta:0,thetaAuto:null,thetaMain:false,
    etalon:{type:'disque45',cm:Math.round(ML_DISQUE_M*100),ax:null,ay:null,bx:null,by:null},prise:null,
    rec:null,correction:null,cartes:[],lecteur:null,
    annot:annotDoc,annotInit:JSON.stringify(annotDoc),outil:'selection',couleur:ML_PALETTE[0].c,
    epaisseur:ML_EPAISSEUR_DEFAUT,sel:null,trace:null,curseur:null,annule:[],refait:[],original:false,
    comparaison:false,guide:null,repereAnat:1,relier:true,phrase:'',tailleTexte:'m',onglet:'trace',jetonVseq:0,
    enLecture:_mlxPrefLecture(),style:'',deplEtiq:null,trajAuto:true,trajStop:false,trajZone:null,
    echUi:_mlxEchUiDepuis(annotDoc.ech),echPose:null,echAuto:true,echCherche:false,echEllipse:null};
  go('s-coach-motion-lab');
  _mlRendre();
  return true;
}
/**
 * La flèche. Demande avant de perdre des répétitions non enregistrées, puis
 * rend la main à index.html, qui rouvre la correction de la même vidéo.
 * @returns {Promise<boolean>}
 */
async function mlFermer(){
  if(!_ml){ _vcRouvrirApresMotionLab('',''); return true; }
  // UNE CORRECTION ENREGISTRÉE MAIS PAS ENVOYÉE se perd en quittant : la voix
  // n'existe qu'en mémoire. On le demande avant, comme pour les répétitions.
  const corr=!!(_ml.rec||(_ml.correction&&_ml.correction.statut!=='envoye'));
  if(_mlModifie()||corr){
    const quitter=await rcConfirm(corr?'Quitter sans envoyer la correction ?':'Quitter sans enregistrer ?',
      corr?'La voix et les gestes enregistrés seront perdus.'
        :'Les séquences et les tracés modifiés depuis le dernier enregistrement seront perdus.','Quitter','Rester');
    if(!quitter||!_ml) return false;
  }
  const {email,videoId}=_ml;
  _mlArreter();
  _ml=null;
  _vcRouvrirApresMotionLab(email,videoId);
  return true;
}
// Tout ce qui tourne s'arrête : lecture, boucle, suivi, miniatures en cours.
function _mlArreter(){
  const v=_mlVideo();
  if(v){ try{ v.pause(); }catch(e){} videoClearLoop(v); }
  if(_ml){ _ml.jeton++; _ml.analyseJeton++; if(_ml.raf) cancelAnimationFrame(_ml.raf); _ml.raf=0; }
  const cache=_mlEl('ml-vign-src');
  if(cache) cache.remove();
  const analyse=_mlEl('ml-analyse-src');
  if(analyse) analyse.remove();
  const vseq=_mlEl('ml-vseq-src');
  if(vseq) vseq.remove();
  if(_ml&&_ml.rec){
    const r=_ml.rec;
    _mlRecEcouteArreter();
    window.clearInterval(r.minuteur);
    try{ if(r.media&&r.media.state!=='inactive') r.media.stop(); }catch(e){}
    if(r.flux) r.flux.getTracks().forEach((/** @type {MediaStreamTrack} */ t)=>t.stop());
    _ml.rec=null;
  }
  if(_ml) _mlCorrOublier();
  try{ mlFermerExport(); }catch(e){}
}
/**
 * Appelée par go() quand on quitte le laboratoire par une autre porte que sa
 * flèche : un enregistrement se met en pause, un aperçu se tait. Rien n'est
 * perdu, le coach retrouvera tout en revenant.
 */
function mlSortieEcran(){
  if(!_ml) return false;
  if(_ml.rec&&!_ml.rec.pause) mlRecPause();
  if(_ml.lecteur) _ml.lecteur.pause();
  return true;
}

/** @returns {boolean} */
function _mlModifie(){ return !!_ml&&(!mlMemesSegments(_ml.initiaux,_ml.segments)||_mlxModifie()); }
/** @returns {Segment|null} */
function _mlActif(){
  if(!_ml) return null;
  const id=_ml.actifId;
  return _ml.segments.find(s=>s.id===id)||null;
}

// ══ LE RENDU ══════════════════════════════════════════════════════════════════
//
// LA REFONTE (21/09/2026) : un logiciel d'analyse en paysage, et non plus une
// colonne de formulaires. À gauche les séquences et les modèles ; au centre la
// vidéo — l'élément dominant —, son calque et ses commandes ; à droite les
// outils de tracé, la liste des annotations et la légende ; en bas la timeline
// des annotations et « Enregistrer la correction ».
//
// RIEN DE L'ANCIEN N'EST PERDU. Les panneaux d'analyse automatique —
// trajectoire de la barre, points suivis, articulations, lecture —, la
// correction vocale et la prise de vue (aplomb, échelle) gardent leur code et
// leurs identifiants : ils vivent dans les onglets « Analyse », « Voix » et
// « Réglages » de la colonne de droite. La calibration n'est plus sur le
// chemin du coach : elle est dans « Paramètres avancés ».

/**
 * Les icônes, en traits : currentColor, pour suivre l'état du bouton.
 * @param {string} nom
 * @param {number} t
 * @returns {string}
 */
function _mlxIco(nom,t){
  /** @type {Object<string,string>} */
  const P={
    selection:'<path d="M5 3.5 18.5 11l-6.2 1.6L9 19z" fill="currentColor" stroke="none"/>',
    ligne:'<path d="M5 19 19 5"/>',
    fleche:'<path d="M5 19 18 6M10 6h8v8"/>',
    libre:'<path d="M3 16.5c2.5-7 5.5 3 8.5-3.5S17 5 21 8"/>',
    courbe:'<path d="M4.5 18.5C7 8 16.5 16.5 19.5 5.5"/><circle cx="4.5" cy="18.5" r="1.7" fill="currentColor"/><circle cx="19.5" cy="5.5" r="1.7" fill="currentColor"/>',
    cercle:'<circle cx="12" cy="12" r="8"/>',
    rect:'<rect x="4" y="6" width="16" height="12" rx="1.2"/>',
    // UN DISQUE ET SA HAUTEUR : c'est le geste de l'outil.
    echelle:'<circle cx="9.5" cy="12" r="7"/><circle cx="9.5" cy="12" r="1.6"/><path d="M19.5 5v14M17.5 5h4M17.5 19h4"/>',
    angle:'<path d="M4 19.5h16M4 19.5 14.5 5"/><path d="M9.2 19.5a6 6 0 0 0-2-4.6"/>',
    point:'<circle cx="12" cy="12" r="4.2" fill="currentColor"/>',
    texte:'<path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6"/>',
    zone:'<rect x="4" y="5" width="16" height="14" rx="1.5" stroke-dasharray="3 2.4"/>',
    gomme:'<path d="M8.5 20H20M5.2 14.8l7.9-7.9a2 2 0 0 1 2.8 0l2.3 2.3a2 2 0 0 1 0 2.8L11.3 19H8.5z"/>',
    oeil:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    oeilnon:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><path d="M4 4l16 16"/>',
    crayon:'<path d="M4 20h4L19.2 8.8l-4-4L4 16z"/>',
    corbeille:'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    poignee:'<circle cx="9" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="17" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="1.3" fill="currentColor" stroke="none"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    retour:'<path d="m15 18-6-6 6-6"/>',
    menu:'<circle cx="12" cy="5.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="18.5" r="1.6" fill="currentColor" stroke="none"/>',
    haltere:'<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    lire:'<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause:'<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
    prec:'<path d="M6 5v14"/><path d="M18 5 9 12l9 7z" fill="currentColor"/>',
    suiv:'<path d="M18 5v14"/><path d="m6 5 9 7-9 7z" fill="currentColor"/>',
    son:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    muet:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
    plein:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    comp:'<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
    orig:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m3.5 15 5-4 4 3 3-2.5 5 4"/><path d="M4 4l16 16"/>',
    reglages:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    fleched:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    annuler:'<path d="M9 7 4.5 11.5 9 16"/><path d="M4.5 11.5H15a4.5 4.5 0 0 1 0 9h-3"/>',
    retablir:'<path d="m15 7 4.5 4.5L15 16"/><path d="M19.5 11.5H9a4.5 4.5 0 0 0 0 9h3"/>',
    ajuster:'<path d="M4 12h16M7 8l-3 4 3 4M17 8l3 4-3 4"/>',
    traj:'<path d="M4 18c3-9 8-11 16-12"/><path d="M15 4.5 20 6l-2 4.5"/>',
    corps:'<circle cx="12" cy="4.8" r="2.2"/><path d="M12 7.5v7M7 10.5l5-1.5 5 1.5M9 21l3-6.5 3 6.5"/>',
    ampl:'<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>',
    stab:'<path d="M12 3v14M5 21h14M7 9h10"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/>',
    tempo:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M10 2.5h4"/>',
    perso:'<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>',
    cle:'<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
    export:'<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 16.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-2.5"/>',
    cible:'<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>'};
  return '<svg viewBox="0 0 24 24" width="'+t+'" height="'+t+'" aria-hidden="true" fill="none" stroke="currentColor" '
    +'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(P[nom]||'')+'</svg>';
}
/** @param {number} ms @returns {string} « 0:03.25 » */
function _mlxT(ms){ return mlTempsTexte(Math.max(0,Math.round(ms))); }

function _mlRendre(){
  const z=_mlEl('ml-contenu');
  if(!z||!_ml) return false;
  const S=_mlxIco;
  /** @param {string} lib @param {string} act @param {string} titre @param {string} [extra] */
  const b=(lib,act,titre,extra)=>'<button type="button" class="ml-b" onclick="'+act+'" '
    +'title="'+escapeHtml(titre)+'" aria-label="'+escapeHtml(titre)+'" disabled '+(extra||'')+'>'+lib+'</button>';
  const logo=String((currentUser||{}).logo||'').trim();
  z.innerHTML='<div class="mlx">'
    // ── L'EN-TÊTE ─────────────────────────────────────────────────────────
    +'<header class="mlx-tete">'
      +'<button type="button" class="mlx-retour" onclick="fermerMotionLab()" aria-label="Retour à la correction">'
        +S('retour',20)+'<span>Retour</span></button>'
      +'<div class="mlx-marque"><h1 class="mlx-titre">Motion <em>Lab</em></h1>'
        +'<p class="mlx-sous-t">Analyse et correction technique</p></div>'
      +'<div class="mlx-pilule">'+S('haltere',24)+'<div><b id="ml-titre"></b><span class="ml-sous"></span></div></div>'
      +'<div class="mlx-menu-z"><button type="button" id="mlx-menu-b" class="mlx-ico-b" onclick="mlMenu()" '
        +'aria-haspopup="true" aria-expanded="false" aria-label="Plus d’actions">'+S('menu',20)+'</button>'
        +'<div id="mlx-menu" class="mlx-menu" role="menu" hidden>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlExporterLab()">Exporter la vidéo annotée</button>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlOnglet(\'reglages\')">Paramètres avancés</button>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlOnglet(\'analyse\')">Analyse automatique</button>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlOnglet(\'voix\')">Correction vocale</button>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlRaccourcis()">Raccourcis clavier</button>'
          +'<button type="button" role="menuitem" onclick="mlMenu();mlAnnotToutEffacer()">Effacer tous les tracés</button>'
        +'</div></div>'
      +'<div class="mlx-esp"></div>'
      +'<div class="mlx-devise" aria-hidden="true"><i></i><span>Discipline, travail et résultats</span></div>'
      +(logo?'<img class="mlx-logo" src="'+escapeHtml(logo)+'" alt="" onerror="this.remove()">':'')
    +'</header>'
    // LA BARRE D'ENREGISTREMENT de la correction vocale reste en haut.
    +'<div id="ml-rec" class="ml-rec" hidden></div>'
    +'<div class="mlx-grille">'
      // ── GAUCHE : SÉQUENCES ET MODÈLES ─────────────────────────────────────
      +'<aside class="mlx-g">'
        +'<section class="mlx-carte"><div class="mlx-ct"><span>Séquences</span>'
          +'<button type="button" class="mlx-ico-b mlx-ico-p" id="ml-ajouter" onclick="mlAjouter()" disabled '
            +'title="Ajouter une séquence à la tête de lecture" aria-label="Ajouter une séquence à la tête de lecture">'+S('plus',18)+'</button></div>'
          +'<div id="ml-liste"></div><div id="ml-bornes"></div>'
          +'<p class="ml-aide">Place la tête de lecture au début du mouvement, ajoute une séquence, puis ajuste son '
            +'début et sa fin à l’image près. Dix secondes au plus. La vidéo d’origine n’est jamais modifiée.</p></section>'
        +'<section class="mlx-carte"><div class="mlx-ct"><span>Modèles d’annotation</span></div><div id="mlx-modeles"></div></section>'
      +'</aside>'
      // ── CENTRE : LA VIDÉO ─────────────────────────────────────────────────
      +'<main class="mlx-c">'
        +'<div class="ml-scene">'
          +'<video id="ml-video" src="'+safeUrl(_ml.url)+'" preload="metadata" playsinline webkit-playsinline '
            +'onerror="_videoIndisponible(this)"></video>'
          +'<canvas id="ml-calque" class="ml-calque" aria-hidden="true"></canvas>'
          +'<canvas id="ml-loupe" class="ml-loupe" width="220" height="220" aria-hidden="true" hidden></canvas>'
          +'<span class="mlx-badge-orig" aria-hidden="true">Version originale</span>'
        +'</div>'
        +'<div class="mlx-transport">'
          +'<div class="mlx-tr-l1">'
            +b(S('prec',18),'mlImage(-1)','Image précédente (flèche gauche)')
            +'<button type="button" id="ml-play" class="ml-b mlx-play" onclick="mlLecture()" disabled aria-label="Lecture (espace)">'+S('lire',20)+'</button>'
            +b(S('suiv',18),'mlImage(1)','Image suivante (flèche droite)')
            +'<span class="mlx-temps"><span id="ml-t" aria-live="off">0:00.00</span><span id="mlx-duree"></span></span>'
            +'<span class="mlx-esp"></span>'
            +'<span class="mlx-vit">'+VID_RATES.map(r=>b(String(r).replace('.',',')+'×','mlVitesse('+r+')',
              'Lire à '+String(r).replace('.',',')+' fois la vitesse normale','data-rate="'+r+'" aria-pressed="'+(r===1)+'"')).join('')+'</span>'
            +b(S('son',20),'mlSon()','Couper le son','id="mlx-son" aria-pressed="false"')
            +b(S('comp',20),'mlComparaison()','Comparaison : superposer les tracés actuels et cibles','id="mlx-comp" aria-pressed="false"')
            +b(S('plein',20),'mlPleinEcran()','Plein écran')
          +'</div>'
          +'<div class="mlx-tr-l2"><input type="range" id="mlx-pos" min="0" max="1000" step="1" value="0" disabled '
            +'aria-label="Position dans la vidéo" oninput="mlPosition(this.value)">'
            +'<span id="ml-fps" class="ml-fps">Chargement…</span></div>'
        +'</div>'
      +'</main>'
      // ── DROITE : OUTILS, ANNOTATIONS, LÉGENDE — ET LES ONGLETS DE L'ANCIEN ──
      +'<aside class="mlx-d">'
        +'<div class="mlx-onglets" role="tablist" aria-label="Panneaux du laboratoire">'
          +[['trace','Tracé'],['analyse','Analyse'],['voix','Voix'],['reglages','Réglages']].map(([k,l])=>
            '<button type="button" role="tab" data-onglet="'+k+'" aria-selected="'+(k===_ml?.onglet)+'" onclick="mlOnglet(\''+k+'\')">'+l+'</button>').join('')
        +'</div>'
        +'<div role="tabpanel" data-onglet="trace"'+(_ml.onglet==='trace'?'':' hidden')+'>'
          +'<section class="mlx-carte"><div class="mlx-ct"><span>Outils de tracé</span><span id="mlx-histo" class="mlx-histo"></span></div>'
            +'<div id="mlx-outils"></div></section>'
          +'<section class="mlx-carte"><div class="mlx-ct"><span id="mlx-n-annot">Annotations</span>'
            +'<button type="button" class="mlx-b mlx-b-r" onclick="mlAnnotAjouter()">'+S('plus',14)+' Ajouter</button></div>'
            +'<div id="mlx-liste"></div><div id="mlx-editeur"></div></section>'
          +'<section class="mlx-carte"><div class="mlx-ct"><span>Légende sur la vidéo</span>'
            +'<label class="mlx-bascule" title="Afficher la légende sur la vidéo"><input type="checkbox" id="mlx-leg-on" '
              +'aria-label="Afficher la légende sur la vidéo" onchange="mlLegende(\'on\',this.checked)"><i></i></label></div>'
            +'<div id="mlx-legende"></div></section>'
        +'</div>'
        +'<div role="tabpanel" data-onglet="analyse"'+(_ml.onglet==='analyse'?'':' hidden')+'>'
          +'<p class="mlx-intro">Les mesures automatiques : la trajectoire de la barre suivie image par image, les points '
            +'suivis, les articulations, et ce qu’ils disent du mouvement.</p>'
          +'<div id="ml-traj"></div><div id="ml-pts"></div><div id="ml-artic"></div><div id="ml-lecture"></div>'
        +'</div>'
        +'<div role="tabpanel" data-onglet="voix"'+(_ml.onglet==='voix'?'':' hidden')+'><div id="ml-corr"></div></div>'
        +'<div role="tabpanel" data-onglet="reglages"'+(_ml.onglet==='reglages'?'':' hidden')+'>'
          +'<p class="mlx-intro">Paramètres avancés. La prise de vue, l’aplomb et l’échelle ne servent qu’aux mesures '
            +'automatiques : les tracés n’en ont pas besoin.</p>'
          +'<div id="ml-prise"></div>'
          +'<section class="mlx-carte"><div class="mlx-ct"><span>Sens des couleurs</span></div><div id="mlx-sens"></div></section>'
        +'</div>'
      +'</aside>'
    +'</div>'
    // ── LA TIMELINE DES ANNOTATIONS ─────────────────────────────────────────
    +'<section class="mlx-tl">'
      +'<div class="mlx-tl-tete"><span class="mlx-lab">Timeline des annotations</span><span class="mlx-esp"></span>'
        +'<span class="ml-zoom">'+b('−','mlZoom(-1)','Dézoomer la timeline','data-zoom="-1"')
          +'<span id="ml-zoom-val">1×</span>'+b('+','mlZoom(1)','Zoomer la timeline','data-zoom="1"')+'</span>'
        +b(S('ajuster',16)+'<span>Ajuster</span>','mlZoomAjuster()','Toute la vidéo dans la timeline','class="ml-b mlx-ajuster"')
        +'<span id="mlx-tl-t" class="mlx-tl-t">0:00 / 0:00</span></div>'
      +'<div class="mlx-tl-corps">'
        +'<div class="mlx-tl-g"><button type="button" class="mlx-tl-lire" onclick="mlLecture()" aria-label="Lecture">'+S('lire',18)+'</button>'
          +'<div id="mlx-tl-noms" class="mlx-tl-noms"></div></div>'
        +'<div class="ml-frise" id="ml-frise"><div class="ml-frise-in" id="ml-frise-in">'
          +'<canvas id="ml-regle" class="ml-regle" aria-hidden="true"></canvas>'
          +'<canvas id="ml-vign" class="ml-vign" aria-hidden="true"></canvas>'
          +'<div id="ml-autres"></div>'
          +'<div class="ml-sel" id="ml-sel" hidden></div>'
          +'<div class="ml-poignee" id="ml-p-debut" data-borne="debut" role="slider" tabindex="0" '
            +'aria-label="Début de la séquence" hidden><i></i></div>'
          +'<div class="ml-poignee" id="ml-p-fin" data-borne="fin" role="slider" tabindex="0" '
            +'aria-label="Fin de la séquence" hidden><i></i></div>'
          +'<div id="ml-pistes" class="mlx-pistes"></div>'
          +'<div class="ml-tete" id="ml-tete" aria-hidden="true"></div>'
        +'</div></div>'
      +'</div>'
    +'</section>'
    // ── LE PIED ─────────────────────────────────────────────────────────────
    +'<footer class="mlx-pied">'
      +'<button type="button" id="mlx-orig" class="mlx-pied-b" aria-pressed="false" onclick="mlVersionOriginale()" '
        +'title="Revoir la vidéo sans aucune annotation (O)">'+S('orig',18)+'<span>Version originale</span></button>'
      +'<span class="mlx-esp"></span>'
      +'<button type="button" id="mlx-export" class="mlx-pied-b" onclick="mlExporterLab()" title="Une vidéo où les tracés et la légende sont gravés">'+S('export',18)+'<span>Exporter la vidéo</span></button>'
      +'<button type="button" class="mlx-pied-b" onclick="mlOnglet(\'reglages\')">'+S('reglages',18)+'<span>Paramètres avancés</span></button>'
      +'<button type="button" id="ml-enreg" class="mlx-enreg" onclick="enregistrerMotionLab()" disabled>'
        +'<span>Enregistrer la correction</span><i class="mlx-enreg-pt" aria-hidden="true"></i>'+S('fleched',20)+'</button>'
    +'</footer>'
  +'</div>';
  const t=_mlEl('ml-titre'); if(t) t.textContent=_ml.nom;
  const ss=document.querySelector('#ml-contenu .ml-sous'); if(ss) ss.textContent=_ml.sousTitre;
  _mlBrancher();
  _mlMajListe();
  _mlMajCorrection();
  _mlxMajTout();
  return true;
}
function _mlxMajTout(){
  _mlxMajOutils(); _mlxMajListe(); _mlxMajEditeur(); _mlxMajLegende(); _mlxMajModeles(); _mlxMajPistes();
  _mlxMajSens(); _mlMajEnregistrer();
}
/** La position de la glissière, sur 1000. @param {string|number} val */
function mlPosition(val){
  const v=_mlVideo();
  if(!_ml||!v||!_ml.dureeMs) return false;
  _mlAller(Math.round(_ml.dureeMs*Math.max(0,Math.min(1000,Number(val)||0))/1000),true);
  return true;
}
function mlZoomAjuster(){
  if(!_ml||!_ml.dureeMs) return false;
  const frise=_mlEl('ml-frise');
  _ml.zoom=ML_ZOOMS[0];
  _mlMajFrise();
  if(frise) frise.scrollLeft=0;
  _mlVignettes();
  _mlxMajPistes();
  return true;
}
async function mlRaccourcis(){
  await rcConfirm('Raccourcis clavier',
    'Espace : lecture / pause · ← → : image par image (Maj : dix images) · V sélection · L ligne · F flèche · '
    +'T trajectoire · U courbe · C cercle · R échelle · A angle · P point · X texte · Z zone · E gomme · '
    +'Entrée : terminer une courbe ou des repères · Échap : annuler le tracé en cours · Suppr : effacer le tracé choisi · '
    +'Ctrl+Z : annuler · Ctrl+Maj+Z : rétablir · O : version originale.','Compris','Fermer');
  return true;
}

// ── LES OUTILS ─────────────────────────────────────────────────────────────
function _mlxMajOutils(){
  const z=_mlEl('mlx-outils');
  if(!z||!_ml) return;
  const S=_mlxIco, o=_ml.outil, sens=_mlxSens();
  const cours=_ml.trace&&(_ml.trace.t==='courbe'||_ml.trace.t==='point'||_ml.trace.t==='angle')?_ml.trace:null;
  /** @type {Object<string,string>} */
  const aides={selection:'Touche un tracé pour le choisir ; glisse-le, ou tire un de ses points. Double-clique une étiquette ou la légende pour la déplacer.',
    ligne:'Glisse sur la vidéo — ou touche le départ, puis l’arrivée.',
    fleche:'Glisse sur la vidéo — ou touche le départ, puis la pointe.',
    libre:_ml.trajAuto
      ?'Touche le détail à suivre — le bout de la barre, un genou — ou entoure-le en glissant : la vidéo avance et la trajectoire se trace seule.'
      :'Dessine d’un seul geste — ou touche pour commencer, suis le mouvement à la souris, touche pour finir.',
    courbe:'Touche la vidéo point par point : la courbe passe par chacun. Entrée pour terminer.',
    cercle:'Glisse du centre vers le bord — ou touche le centre, puis le bord.',
    echelle:_ml.echAuto
      ?'Touche le centre d’un disque : RepCore trouve son bord et en tire le diamètre — le grand axe, même vu de biais. Ou glisse du haut au bas pour le poser à la main. Tire un bout pour l’ajuster.'
      :'Touche le HAUT d’un disque, puis son BAS — ou glisse de l’un à l’autre. La hauteur d’un disque reste son diamètre même vu de biais. Tire un bout pour l’ajuster.',
    angle:'Touche trois points — par exemple épaule, coude, poignet : l’angle au deuxième s’affiche.',
    point:'Touche les repères anatomiques un par un ; ils se relient. Entrée pour terminer.',
    texte:'Touche la vidéo là où le texte doit apparaître.',zone:'Glisse pour surligner une zone — ou touche un coin, puis l’autre.',
    gomme:'Touche un tracé pour l’effacer.'};
  let h='<div class="mlx-outils">'+ML_OUTILS.map(x=>'<button type="button" class="mlx-outil" data-outil="'+x.o+'" '
    +'aria-pressed="'+(x.o===o)+'" onclick="mlOutil(\''+x.o+'\')" title="'+escapeHtml(x.lib+' ('+x.r.toUpperCase()+')')+'">'
    +S(x.o,22)+'<span>'+x.lib+'</span></button>').join('')+'</div>';
  // L'ÉCHELLE N'A NI COULEUR, NI ÉPAISSEUR, NI STYLE : c'est une donnée de
  // calcul. Son panneau prend leur place.
  if(o==='echelle') h+=_mlxHtmlEchelle();
  else h+='<div class="mlx-ligne"><span class="mlx-lab-s">Couleur</span><div class="mlx-couleurs">'
    +ML_PALETTE.map(p=>'<button type="button" class="mlx-pastille" style="--c:'+p.c+'" aria-pressed="'+(p.c===_ml?.couleur)+'" '
      +'title="'+escapeHtml(p.nom+(sens[p.c]?' — '+sens[p.c]:''))+'" aria-label="'+escapeHtml(p.nom)+'" onclick="mlCouleur(\''+p.c+'\')"></button>').join('')
    +'<label class="mlx-perso" title="Couleur personnalisée"><input type="color" value="'+escapeHtml(_ml.couleur)+'" '
      +'aria-label="Couleur personnalisée" onchange="mlCouleur(this.value)"></label></div></div>'
    +'<div class="mlx-ligne"><span class="mlx-lab-s">Épaisseur</span><input type="range" min="1" max="12" step="1" value="'+_ml.epaisseur+'" '
      +'aria-label="Épaisseur du trait" oninput="mlEpaisseur(this.value)"><span id="mlx-ep-val">'+_ml.epaisseur+' px</span></div>'
    +'<div class="mlx-ligne"><span class="mlx-lab-s">Trait</span><div class="mlx-chips mlx-chips-l" role="group" aria-label="Style du trait">'
      +ML_TRAITS.map(([k,l])=>'<button type="button" class="mlx-chip mlx-trait" aria-pressed="'+(k===(_ml?.style||''))+'" onclick="mlStyleTrait(\''+k+'\')">'
        +_mlxTraitIco(k)+l+'</button>').join('')+'</div></div>';
  // LA LECTURE CONTINUE PENDANT LE GESTE, si le coach le veut. Proposé pour
  // les outils qui dessinent ; le texte ouvre une saisie, il fige toujours.
  // LA TRAJECTOIRE : suivie automatiquement, ou tracée à la main.
  if(o==='libre') h+='<div class="mlx-chips" role="group" aria-label="Façon de tracer la trajectoire">'
    +'<button type="button" class="mlx-chip" aria-pressed="'+(!!_ml.trajAuto)+'" onclick="mlTrajMode(true)">Suivi automatique</button>'
    +'<button type="button" class="mlx-chip" aria-pressed="'+(!_ml.trajAuto)+'" onclick="mlTrajMode(false)">À la main</button></div>';
  if(o!=='selection'&&o!=='gomme'&&o!=='texte'&&o!=='echelle'&&!(o==='libre'&&_ml.trajAuto)) h+='<label class="mlx-coche"><input type="checkbox" id="mlx-en-lecture"'
    +(_ml.enLecture?' checked':'')+' onchange="mlTracerEnLecture(this.checked)"> Tracer pendant la lecture</label>';
  // LE MODÈLE EN COURS : l'étape, et de quoi la passer ou s'arrêter.
  const G=_ml.guide;
  if(G){
    const e=G.m.etapes[G.i];
    if(e) h+='<div class="mlx-guide"><i class="mlx-an-pt" style="--c:'+e.c+'"></i><span>Modèle <b>'+escapeHtml(G.m.nom)+'</b> · étape '
      +(G.i+1)+'/'+G.m.etapes.length+' : <b>'+escapeHtml(e.n)+'</b> ('+escapeHtml((ML_OUTILS.find(x=>x.o===e.t)||{lib:''}).lib.toLowerCase())+')</span>'
      +'<span class="mlx-esp"></span><button type="button" class="mlx-b" onclick="mlGuidePasser()">Passer</button>'
      +'<button type="button" class="mlx-b" onclick="mlGuideArreter()">Arrêter</button></div>';
  }
  if(o==='point') h+='<div class="mlx-chips" role="group" aria-label="Repère anatomique posé au prochain toucher">'
    +ML_REPERES_ANAT.map((r,i)=>'<button type="button" class="mlx-chip" aria-pressed="'+(i===_ml?.repereAnat)+'" onclick="mlRepereAnat('+i+')">'+r+'</button>').join('')
    +'<button type="button" class="mlx-chip" aria-pressed="'+(_ml.repereAnat<0)+'" onclick="mlRepereAnat(-1)">Sans nom</button></div>'
    +'<label class="mlx-coche"><input type="checkbox"'+(_ml.relier?' checked':'')+' onchange="mlRelier(this.checked)"> Relier les points</label>';
  if(o==='texte') h+='<div class="mlx-chips" role="group" aria-label="Phrase proposée">'
    +ML_PHRASES.map((p,i)=>'<button type="button" class="mlx-chip" aria-pressed="'+(p===_ml?.phrase)+'" onclick="mlPhrase('+i+')">'+escapeHtml(p)+'</button>').join('')
    +'</div><div class="mlx-ligne"><span class="mlx-lab-s">Taille</span><div class="mlx-chips mlx-chips-l">'
    +[['s','Petite'],['m','Moyenne'],['l','Grande']].map(([k,l])=>'<button type="button" class="mlx-chip" aria-pressed="'+(k===_ml?.tailleTexte)+'" onclick="mlTailleTexte(\''+k+'\')">'+l+'</button>').join('')
    +'</div></div>';
  // LE SUIVI D'UNE TRAJECTOIRE EN COURS : où il en est, et de quoi l'arrêter
  // en gardant ce qui est déjà tracé.
  if(_ml.mode==='trajsuivi') h+='<div class="mlx-cours"><span id="mlx-traj-txt">'+escapeHtml(_ml.progres||'Suivi en cours…')+'</span>'
    +'<span class="mlx-esp"></span><button type="button" class="mlx-b mlx-b-r" onclick="mlTrajArreter()">Arrêter</button></div>';
  // UNE ÉTIQUETTE EN MAIN : où la poser, et de quoi renoncer.
  if(_ml.deplEtiq) h+='<div class="mlx-cours"><span>'+(_ml.deplEtiq.kind==='leg'?'Déplace la légende'
      :_ml.deplEtiq.kind==='mes'?'Déplace la mesure':'Déplace l’étiquette')
      +', puis touche pour la poser</span><span class="mlx-esp"></span>'
    +'<button type="button" class="mlx-b" onclick="mlEtiqAnnuler()">Annuler</button></div>';
  // L'ÉCHELLE COMMENCÉE D'UN CLIC : le haut est posé, le bas est attendu.
  if(_ml.echPose) h+='<div class="mlx-cours"><span>Haut posé : touche maintenant le BAS du disque</span><span class="mlx-esp"></span>'
    +'<button type="button" class="mlx-b" onclick="_mlxEchAnnulerPose()">Annuler</button></div>';
  // COMMENCÉ D'UN CLIC : ce qu'attend le clic suivant, et de quoi renoncer.
  if(_ml.trace&&_ml.trace.clic) h+='<div class="mlx-cours"><span>'+(_ml.trace.t==='libre'
      ?'Suis le mouvement à la souris, puis touche pour finir (ou Entrée)':'Touche le point d’arrivée')+'</span><span class="mlx-esp"></span>'
    +'<button type="button" class="mlx-b" onclick="mlAnnulerTrace()">Annuler</button></div>';
  if(cours) h+='<div class="mlx-cours"><span>'+(cours.t==='angle'?'Angle : point '+(cours.pts.length+1)+' sur 3'
      :cours.pts.length+' point'+(cours.pts.length>1?'s':'')+' posé'+(cours.pts.length>1?'s':''))+'</span><span class="mlx-esp"></span>'
    +(cours.t!=='angle'?'<button type="button" class="mlx-b mlx-b-r" onclick="mlTerminerTrace()">Terminer ↵</button>':'')
    +'<button type="button" class="mlx-b" onclick="mlAnnulerTrace()">Annuler</button></div>';
  h+='<p class="mlx-aide-o">'+escapeHtml(aides[o]||'')+'</p>';
  z.innerHTML=h;
  const hi=_mlEl('mlx-histo');
  if(hi) hi.innerHTML='<button type="button" class="mlx-ico-b mlx-ico-p" onclick="mlAnnuler()" title="Annuler (Ctrl+Z)" aria-label="Annuler"'
    +(_ml.annule.length?'':' disabled')+'>'+S('annuler',16)+'</button>'
    +'<button type="button" class="mlx-ico-b mlx-ico-p" onclick="mlRetablir()" title="Rétablir (Ctrl+Maj+Z)" aria-label="Rétablir"'
    +(_ml.refait.length?'':' disabled')+'>'+S('retablir',16)+'</button>';
  const c=_mlEl('ml-calque');
  if(c){ c.dataset.outil=o; c.dataset.depl=_ml.deplEtiq?'1':''; }
}
/**
 * Le panneau de l'outil Échelle : où on en est, le disque, ce qu'il vaut à
 * l'image, et « Enregistrer la mesure ».
 * @returns {string}
 */
function _mlxHtmlEchelle(){
  if(!_ml) return '';
  const ui=_ml.echUi, e=_ml.annot.ech;
  const {vw,vh}=_mlxTailleVideo();
  const px=e?mlEchellePx(e,vw,vh):0;
  const ch=mlEchChoix(ui);
  const d=ch?mlDisqueDe(ch.src,ch.mm):null;
  /** @param {string} fn @param {string} lib @param {[string,string][]} opts @param {string} val */
  const sel=(fn,lib,opts,val)=>'<label class="mlx-champ"><span>'+lib+'</span><select class="mlx-in" onchange="'+fn+'(this.value)">'
    +'<option value=""'+(val?'':' selected')+'>Choisir…</option>'
    +opts.map(([k,l])=>'<option value="'+escapeHtml(k)+'"'+(k===val?' selected':'')+'>'+escapeHtml(l)+'</option>').join('')+'</select></label>';
  // OÙ ON EN EST : une seule phrase, la prochaine chose à faire.
  const auto=_ml.echAuto;
  const trouve=_ml.echEllipse&&e&&_ml.echEllipse.p===e.p?_ml.echEllipse:null;
  let etat;
  if(_ml.echCherche) etat='Recherche du bord du disque…';
  else if(!e) etat=auto?'<b>1.</b> Touche le CENTRE d’un disque, sur une image nette : RepCore trouve son bord.'
    :'<b>1.</b> Touche le haut du disque sur la vidéo, puis son bas.';
  else if(px<ML_ECHELLE_MIN_PX) etat='Le disque ne fait que '+Math.round(px)+' pixels à l’image : un pixel d’erreur y pèserait trop. Rapproche-toi ou zoome, puis repose-le.';
  else if(!(Number(e.mm)>0)) etat='<b>2.</b> Choisis ce disque : les mesures apparaîtront sur tes tracés.';
  else if(!e.ok) etat='<b>3.</b> Vérifie les mesures sur tes tracés, puis enregistre.';
  else etat='Échelle enregistrée : elle n’apparaît plus sur la vidéo, les mesures restent. Tire un bout pour l’ajuster.';
  // AUTOMATIQUE OU À LA MAIN. En automatique, glisser du haut au bas pose
  // quand même l'échelle à la main : le premier geste le dit.
  let h='<div class="mlx-ech"><div class="mlx-chips" role="group" aria-label="Façon de poser l’échelle">'
    +'<button type="button" class="mlx-chip" aria-pressed="'+auto+'" onclick="mlEchMode(true)">Automatique</button>'
    +'<button type="button" class="mlx-chip" aria-pressed="'+(!auto)+'" onclick="mlEchMode(false)">À la main</button></div>'
    +'<p class="mlx-note mlx-ech-etat">'+etat+'</p>';
  // CE QUI A ÉTÉ TROUVÉ, pour que le coach le vérifie d'un coup d'œil : le
  // liseré bleu sur la vidéo, et la part du tour où le bord a été vu.
  if(trouve) h+='<p class="mlx-note">Bord trouvé sur '+Math.round(trouve.couverture*100)+' % du tour, à '
    +mlNombre(trouve.residu,1)+' px près. Vérifie le liseré bleu sur le disque ; s’il en suit un autre — un disque plus petit '
    +'devant —, touche le centre de celui que tu veux, ou tire un bout de l’échelle.</p>';
  const gammes=ui.m?mlEchGammes(ui.m):[];
  h+=sel('mlEchMarque','Marque',mlEchMarques().map(m=>[m,m]),ui.m);
  if(gammes.length>1) h+=sel('mlEchGamme','Gamme',gammes.map(g=>[g.id,g.lib]),ui.g);
  const g=ML_DISQUES.find(x=>x.id===ui.g&&x.m===ui.m);
  const charges=ui.g==='mesure'?ML_DISQUES_CHARGES.slice():g?g.c.map(x=>x[0]):[];
  if(charges.length) h+=sel('mlEchCharge','Charge',charges.map(c=>[c,c]),ui.c);
  if(ui.g==='mesure'){
    h+='<p class="mlx-note">'+escapeHtml(ui.m==='Autre marque'?'Ce disque':ui.m)+' ne publie pas ce diamètre : mesure-le au mètre ruban, '
      +'du haut au bas du disque. RepCore s’en souviendra pour tes prochaines vidéos.</p>';
    if(ui.c) h+='<label class="mlx-champ"><span>Diamètre mesuré</span><span class="mlx-ech-mm">'
      +'<input class="mlx-in" type="number" inputmode="numeric" min="100" max="600" step="1" value="'+escapeHtml(ui.mm)+'" '
      +'aria-label="Diamètre mesuré, en millimètres" onchange="mlEchMm(this.value)"><i>mm</i></span></label>';
  }
  // LE DISQUE, SA COTE, SA SOURCE — et la précision qu'en tire l'image.
  if(d){
    h+='<p class="mlx-ech-disque"><b>Ø '+d.mm+' mm</b> · '+escapeHtml(d.source)
      +(d.tol!==null?' · ± '+d.tol+' mm':' · tolérance non publiée')+'</p>';
    if(px>=ML_ECHELLE_MIN_PX){
      const pr=mlEchellePrecision(px,d.mm,d.tol);
      h+='<p class="mlx-note">À l’image, le disque fait '+Math.round(px)+' pixels : chaque mesure est juste à ± '
        +mlNombre(pr*100,1)+' % environ, si les tracés sont dans le même plan que le disque.</p>';
    }
  }
  h+='<div class="mlx-ech-b"><button type="button" class="btn btn-red btn-sm" onclick="mlEchEnregistrer()"'
    +(e&&Number(e.mm)>0&&px>=ML_ECHELLE_MIN_PX&&!e.ok?'':' disabled')+'>Enregistrer la mesure</button>'
    +(e?'<button type="button" class="mlx-b" onclick="mlEchEffacer()">Effacer l’échelle</button>':'')+'</div></div>';
  return h;
}
/**
 * Le petit trait qui montre chaque style sur son bouton.
 * @param {string} k
 * @returns {string}
 */
function _mlxTraitIco(k){
  const d=k==='t'?' stroke-dasharray="5 3.5"':k==='p'?' stroke-dasharray="0.01 4.2"':'';
  return '<svg class="mlx-trait-ico" viewBox="0 0 26 8" width="26" height="8" aria-hidden="true"><line x1="2" y1="4" x2="24" y2="4" '
    +'stroke="currentColor" stroke-width="2.6" stroke-linecap="round"'+d+'/></svg>';
}
/** @param {boolean} oui */
function mlRelier(oui){ if(!_ml) return false; _ml.relier=!!oui; _mlDessinerCalque(); return true; }
/** @param {string} t */
function mlTailleTexte(t){ if(!_ml||!['s','m','l'].includes(t)) return false; _ml.tailleTexte=t; _mlxMajOutils(); return true; }
function mlAnnulerTrace(){ return _mlxAnnulerTrace(); }

// ── LA LISTE DES ANNOTATIONS ───────────────────────────────────────────────
function _mlxMajListe(){
  const z=_mlEl('mlx-liste');
  if(!z||!_ml) return;
  const S=_mlxIco, l=_ml.annot.a, sMs=_mlxTempsMs();
  const v=_mlVideo(), vw=(v&&v.videoWidth)||1000, vh=(v&&v.videoHeight)||1000;
  const n=_mlEl('mlx-n-annot'); if(n) n.textContent='Annotations ('+l.length+')';
  z.innerHTML=l.length?l.map(a=>'<div class="mlx-an'+(a.id===_ml?.sel?' on':'')+(a.h?' masque':'')+'" draggable="true" data-id="'+escapeHtml(a.id)+'">'
      +'<span class="mlx-an-poignee" title="Glisse pour changer l’ordre : le dernier se dessine au-dessus">'+S('poignee',16)+'</span>'
      +'<button type="button" class="mlx-an-oeil" aria-pressed="'+(!a.h)+'" onclick="mlAnnotVisibilite(\''+escapeHtml(a.id)+'\')" '
        +'aria-label="'+(a.h?'Afficher ':'Masquer ')+escapeHtml(a.n)+'">'+S(a.h?'oeilnon':'oeil',17)+'</button>'
      +'<i class="mlx-an-pt" style="--c:'+a.c+'"></i>'
      +'<button type="button" class="mlx-an-nom" onclick="mlAnnotChoisir(\''+escapeHtml(a.id)+'\')" title="'+escapeHtml(ML_TYPE_LIB[a.t]||'')+'">'
        +escapeHtml(mlAnnotLibelle(a,Math.max(a.d,Math.min(a.f-1,sMs)),vw,vh))
        +(Array.isArray(a.k)&&a.k.length?' <span class="mlx-an-suivi" title="Suit le mouvement">'+S('cle',11)+a.k.length+'</span>':'')+'</button>'
      +'<span class="mlx-an-t">'+_mlxT(a.d).slice(0,-3)+' – '+_mlxT(a.f).slice(0,-3)+'</span>'
      +'<button type="button" class="mlx-an-act" onclick="mlAnnotChoisir(\''+escapeHtml(a.id)+'\',true)" aria-label="Modifier '+escapeHtml(a.n)+'">'+S('crayon',16)+'</button>'
      +'<button type="button" class="mlx-an-act" onclick="mlAnnotSupprimer(\''+escapeHtml(a.id)+'\')" aria-label="Supprimer '+escapeHtml(a.n)+'">'+S('corbeille',16)+'</button>'
    +'</div>').join('')
    :'<p class="mlx-vide">Aucun tracé. Choisis un outil et dessine sur la vidéo — ou arme un modèle à gauche.</p>';
  // L'ORDRE AU GLISSER : le tracé lâché prend la place de celui qu'il survole.
  z.querySelectorAll('.mlx-an').forEach(x=>{
    const el=/** @type {HTMLElement} */(x);
    el.addEventListener('dragstart',e=>{ if(e.dataTransfer){ e.dataTransfer.setData('text/plain',el.dataset.id||''); e.dataTransfer.effectAllowed='move'; } el.classList.add('mlx-an-glisse'); });
    el.addEventListener('dragend',()=>el.classList.remove('mlx-an-glisse'));
    el.addEventListener('dragover',e=>{ e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect='move'; });
    el.addEventListener('drop',e=>{
      e.preventDefault();
      const id=e.dataTransfer?e.dataTransfer.getData('text/plain'):'';
      if(!_ml||!id||id===el.dataset.id) return;
      mlAnnotDeplacer(id,_ml.annot.a.findIndex(a=>a.id===el.dataset.id));
    });
  });
}
// ── LE TRACÉ CHOISI ────────────────────────────────────────────────────────
let _mlxEdVu='';
function _mlxMajEditeur(){
  const z=_mlEl('mlx-editeur');
  if(!z||!_ml) return;
  const a=_mlxAnnot(_ml.sel);
  if(!a){ z.innerHTML=''; _mlxEdVu=''; return; }
  const S=_mlxIco, id=escapeHtml(a.id), sMs=_mlxTempsMs();
  const v=_mlVideo(), vw=(v&&v.videoWidth)||1000, vh=(v&&v.videoHeight)||1000;
  const suit=Array.isArray(a.k)&&a.k.length>0, cle=suit?mlCleA(a,sMs):-1;
  const an=mlAngleAnnot(a,Math.max(a.d,Math.min(a.f-1,sMs)),vw,vh);
  let h='<div class="mlx-ed" role="group" aria-label="Annotation choisie">'
    +'<div class="mlx-ed-tete"><i class="mlx-an-pt" style="--c:'+a.c+'"></i><b>'+escapeHtml(ML_TYPE_LIB[a.t]||'Annotation')+'</b>'
      +'<span class="mlx-esp"></span><button type="button" class="mlx-b mlx-b-r" onclick="mlAnnotChoisir(\''+id+'\')">Valider</button></div>'
    +'<label class="mlx-champ"><span>Nom de l’annotation</span><input id="mlx-nom" class="mlx-in" type="text" maxlength="'+ANNOT_NOM_MAX+'" '
      +'value="'+escapeHtml(a.n)+'" onfocus="mlAnnotFocus()" oninput="mlAnnotNom(this.value)" '
      +'onkeydown="if(event.key===\'Enter\'||event.key===\'Escape\'){event.preventDefault();this.blur()}"></label>';
  if(a.t==='texte') h+='<label class="mlx-champ"><span>Texte sur la vidéo</span><input class="mlx-in" type="text" maxlength="'+ANNOT_TEXTE_MAX+'" '
      +'value="'+escapeHtml(a.x||a.n)+'" onfocus="mlAnnotFocus()" oninput="mlAnnotTexte(this.value)" '
      +'onkeydown="if(event.key===\'Enter\'||event.key===\'Escape\'){event.preventDefault();this.blur()}"></label>'
    +'<div class="mlx-champ"><span>Taille · fond</span><div class="mlx-chips mlx-chips-l">'
      +[['s','Petite'],['m','Moyenne'],['l','Grande']].map(([k,l])=>'<button type="button" class="mlx-chip" aria-pressed="'+((a.ts||'m')===k)+'" onclick="mlAnnotOption(\'ts\',\''+k+'\')">'+l+'</button>').join('')
      +[[0,'Sans fond'],[1,'Fond sombre'],[2,'Fond couleur']].map(([k,l])=>'<button type="button" class="mlx-chip" aria-pressed="'+((typeof a.tf==='number'?a.tf:1)===k)+'" onclick="mlAnnotOption(\'tf\','+k+')">'+l+'</button>').join('')
    +'</div></div>'
    +'<label class="mlx-coche"><input type="checkbox"'+(a.tc?' checked':'')+' onchange="mlAnnotOption(\'tc\',this.checked)"> Contour</label>';
  h+='<div class="mlx-champ"><span>Couleur</span><div class="mlx-couleurs">'
      +ML_PALETTE.map(p=>'<button type="button" class="mlx-pastille" style="--c:'+p.c+'" aria-pressed="'+(p.c===a.c)+'" aria-label="'+escapeHtml(p.nom)+'" onclick="mlAnnotCouleur(\''+p.c+'\')"></button>').join('')
      +'<label class="mlx-perso" title="Couleur personnalisée"><input type="color" value="'+escapeHtml(a.c)+'" aria-label="Couleur personnalisée" onchange="mlAnnotCouleur(this.value)"></label></div></div>'
    +(a.t==='texte'?'':'<div class="mlx-champ"><span>Épaisseur</span><div class="mlx-ligne mlx-ligne-0"><input type="range" min="1" max="12" step="1" value="'+a.e+'" '
      +'aria-label="Épaisseur" onfocus="mlAnnotFocus()" oninput="mlAnnotEpaisseur(this.value)"><span id="mlx-aep-val">'+a.e+' px</span></div></div>'
      +'<div class="mlx-champ"><span>Trait</span><div class="mlx-chips mlx-chips-l" role="group" aria-label="Style du trait">'
      +ML_TRAITS.map(([k,l])=>'<button type="button" class="mlx-chip mlx-trait" aria-pressed="'+((a.st||'')===k)+'" onclick="mlAnnotOption(\'st\',\''+k+'\')">'
        +_mlxTraitIco(k)+l+'</button>').join('')+'</div></div>')
    +'<div class="mlx-champ"><span>Durée d’apparition</span><div class="mlx-duree">'
      +'<input class="mlx-in mlx-tps" type="text" inputmode="decimal" value="'+_mlxT(a.d)+'" aria-label="Début" onchange="mlAnnotBorne(\'d\',this.value)">'
      +'<button type="button" class="mlx-b" onclick="mlAnnotBorne(\'d\')" title="Début à la tête de lecture">Ici</button>'
      +'<span class="mlx-fl">→</span>'
      +'<input class="mlx-in mlx-tps" type="text" inputmode="decimal" value="'+_mlxT(a.f)+'" aria-label="Fin" onchange="mlAnnotBorne(\'f\',this.value)">'
      +'<button type="button" class="mlx-b" onclick="mlAnnotBorne(\'f\')" title="Fin à la tête de lecture">Ici</button></div>'
      +'<div class="mlx-chips"><button type="button" class="mlx-chip" onclick="mlAnnotDuree(\'video\')">Toute la vidéo</button>'
      +'<button type="button" class="mlx-chip" onclick="mlAnnotDuree(\'sequence\')"'+(_mlActif()?'':' disabled')+'>Séquence choisie</button></div></div>';
  if(a.t==='angle') h+='<div class="mlx-champ"><span>Angle cible</span><div class="mlx-ligne mlx-ligne-0">'
      +'<input class="mlx-in mlx-tps" type="number" min="0" max="180" step="1" value="'+(typeof a.cb==='number'?a.cb:'')+'" placeholder="—" '
      +'aria-label="Angle cible en degrés" onchange="mlAnnotOption(\'cb\',this.value)"><span class="mlx-deg">°</span>'
      +'<span class="mlx-angle-l">'+(an?'Actuel <b>'+an.val+'°</b>'+(an.ecart!==null?' · écart <b>'+(an.ecart>0?'+':'')+an.ecart+'°</b>':''):'')+'</span></div>'
      +'<span class="mlx-note">En comparaison, la branche cible se dessine en tirets verts.</span></div>';
  if(a.t==='point'&&mlDecoderTrait(a.p).length>1) h+='<label class="mlx-coche"><input type="checkbox"'+(a.rel?' checked':'')+' onchange="mlAnnotOption(\'rel\',this.checked)"> Relier les points</label>';
  if(a.t!=='texte') h+='<label class="mlx-coche"><input type="checkbox"'+(a.et!==0?' checked':'')+' onchange="mlAnnotOption(\'et\',this.checked)"> Afficher le nom sur la vidéo</label>'
    +(a.et!==0?'<p class="mlx-note">Double-clique le nom sur la vidéo pour le déplacer.'
      +(Array.isArray(a.eo)?' <button type="button" class="mlx-b" onclick="mlEtiqReplacer()">Le remettre près du tracé</button>':'')+'</p>':'')
    +'<label class="mlx-coche"><input type="checkbox"'+(a.lg!==0?' checked':'')+' onchange="mlAnnotOption(\'lg\',this.checked)"> Dans la légende</label>';
  // SA MESURE, quand l'échelle est posée : elle se déplace elle aussi.
  {
    const G=_mlxCalqueGeo();
    const mmpx=G?mlEchelleMmPx(_ml.annot.ech,G.R.vw,G.R.vh):null;
    if(mmpx&&['ligne','fleche','libre','courbe','cercle','rect','zone'].includes(a.t))
      h+='<p class="mlx-note">Double-clique sa mesure sur la vidéo pour la déplacer.'
        +(Array.isArray(a.mo)?' <button type="button" class="mlx-b" onclick="mlMesReplacer()">Remettre la mesure</button>':'')+'</p>';
  }
  // LE SUIVI DU MOUVEMENT : images clés, et l'interpolation entre elles.
  h+='<div class="mlx-suivi"><label class="mlx-coche"><input type="checkbox"'+(suit?' checked':'')+' onchange="mlAnnotSuivre()"> Suivre le mouvement</label>'
    // LE SUIVI AUTOMATIQUE : depuis l'image affichée jusqu'à la fin du tracé.
    +(_ml.mode==='annotsuivi'
      ?'<div class="mle-prog mlx-suivi-prog"><div class="mle-barre"><i id="mlx-suivi-barre"></i></div>'
        +'<span id="mlx-suivi-txt">'+escapeHtml(_ml.progres||'Suivi en cours…')+'</span>'
        +'<button type="button" class="mlx-b" onclick="mlAnnotSuiviArreter()">Arrêter</button></div>'
      :'<div class="mlx-auto-l"><button type="button" class="mlx-b mlx-b-r" onclick="mlAnnotSuiviAuto()"'+(_mlOccupe()?' disabled':'')+'>'
        +S('cible',14)+' Suivi automatique</button><span class="mlx-note">Pose '+(ML_SUIVI_TYPES_POINTS.includes(a.t)?'les points':'le tracé')
        +' sur l’image de départ : le suivi '+(ML_SUIVI_TYPES_POINTS.includes(a.t)?'les ':'l’')+'accompagne jusqu’à '+_mlxT(Math.min(a.f,sMs+ML_SUIVI_ANNOT_MAX_MS))
        +'.'+(mlSegmentsRigides(a,mlDecoderTrait(a.p).length).length
          ?' Les segments gardent la longueur vue pendant les trois premières secondes : un point qui s’en écarte est repris.':'')
        +'</span></div>')
    +(suit?'<div class="mlx-cles"><span>'+S('cle',12)+' '+(a.k||[]).length+' image'+((a.k||[]).length>1?'s':'')+' clé'+((a.k||[]).length>1?'s':'')
        +'<b id="mlx-cle-etat">'+(cle>=0?' · clé à cet instant':'')+'</b></span><span class="mlx-esp"></span>'
      +'<button type="button" class="mlx-b" onclick="mlCleAller(-1)" aria-label="Image clé précédente">◀</button>'
      +'<button type="button" class="mlx-b" onclick="mlCleAller(1)" aria-label="Image clé suivante">▶</button>'
      +'<button type="button" id="mlx-cle-suppr" class="mlx-b" onclick="mlCleSupprimer()"'+(cle>=0?'':' disabled')+'>Retirer la clé</button></div>'
      +'<p class="mlx-note">Avance image par image (→) et replace les points : chaque déplacement pose une image clé, et le mouvement '
        +'se remplit entre elles.</p>'
      :'<p class="mlx-note">Allume-le pour que le tracé suive un repère — genou, barre, coude — image par image.</p>')+'</div>'
    +'<div class="mlx-ed-pied"><button type="button" class="mlx-b mlx-suppr" onclick="mlAnnotSupprimer(\''+id+'\')">'+S('corbeille',14)+' Supprimer</button></div>'
  +'</div>';
  z.innerHTML=h;
  // L'ÉDITEUR VIENT EN VUE quand on choisit un autre tracé — et seulement
  // alors : à chaque retouche, la colonne sauterait sous la souris.
  if(_mlxEdVu!==a.id){ _mlxEdVu=a.id; try{ z.scrollIntoView({block:'nearest',behavior:'smooth'}); }catch(e){} }
}
// ── LA LÉGENDE ─────────────────────────────────────────────────────────────
function _mlxMajLegende(){
  const z=_mlEl('mlx-legende'), on=_mlEl('mlx-leg-on');
  if(!z||!_ml) return;
  const L=_ml.annot.leg;
  if(on instanceof HTMLInputElement) on.checked=!!L.on;
  /** @param {string} cle @param {[string,string][]} opts @param {string} val */
  const sel=(cle,opts,val)=>'<select class="mlx-in" onchange="mlLegende(\''+cle+'\',this.value)">'
    +opts.map(([k,l])=>'<option value="'+k+'"'+(k===val?' selected':'')+'>'+l+'</option>').join('')+'</select>';
  z.innerHTML='<div class="mlx-leg'+(L.on?'':' mlx-leg-off')+'">'
    +'<label class="mlx-champ"><span>Titre</span><input class="mlx-in" type="text" maxlength="40" value="'+escapeHtml(L.titre)+'" '
      +'onfocus="mlAnnotFocus()" oninput="mlLegende(\'titre\',this.value)"></label>'
    +'<div class="mlx-champs2"><label class="mlx-champ"><span>Position</span>'+sel('pos',[['hg','Haut gauche'],['hd','Haut droite'],['bg','Bas gauche'],['bd','Bas droite']],L.pos)+'</label>'
    +'<label class="mlx-champ"><span>Style</span>'+sel('fond',[['sombre','Fond sombre'],['clair','Fond clair'],['aucun','Sans fond']],L.fond)+'</label></div>'
    +'<div class="mlx-champs2"><label class="mlx-champ"><span>Taille</span>'+sel('taille',[['s','Petite'],['m','Moyenne'],['l','Grande']],L.taille)+'</label>'
    +'<label class="mlx-champ"><span>Opacité du fond</span><input type="range" min="30" max="100" step="5" value="'+Math.round(L.op*100)+'" '
      +'aria-label="Opacité du fond de la légende" onfocus="mlAnnotFocus()" oninput="mlLegende(\'op\',Number(this.value)/100)"></label></div>'
    +'<p class="mlx-note">Elle liste les tracés gardés « dans la légende », avec la valeur de leurs angles, et part avec la correction. '
      +'Double-clique-la sur la vidéo pour la déplacer.'
      +(typeof L.x==='number'?' <button type="button" class="mlx-b" onclick="mlLegendeReplacer()">La remettre dans son coin</button>':'')+'</p>'
  +'</div>';
}
// ── LES MODÈLES ────────────────────────────────────────────────────────────
function _mlxMajModeles(){
  const z=_mlEl('mlx-modeles');
  if(!z||!_ml) return;
  const S=_mlxIco, l=_mlxModeles(), G=_ml.guide;
  z.innerHTML=l.map((m,i)=>'<div class="mlx-mod-l"><button type="button" class="mlx-mod'+(G&&G.m.nom===m.nom?' on':'')+'" onclick="mlModeleAnnot('+i+')" '
      +'title="'+escapeHtml(m.etapes.map(e=>e.n).join(' · '))+'">'+S(m.ico,18)+'<span>'+escapeHtml(m.nom)+'</span>'
      +(G&&G.m.nom===m.nom?'<small>'+(G.i+1)+'/'+m.etapes.length+'</small>':'')+'</button>'
      +(i>=ML_MODELES_ANNOT.length?'<button type="button" class="mlx-an-act" onclick="mlModeleAnnotRetirer('+i+')" aria-label="Retirer le modèle '+escapeHtml(m.nom)+'">×</button>':'')
    +'</div>').join('')
    +'<button type="button" class="mlx-mod mlx-mod-creer" onclick="mlModeleCreer()">'+S('plus',16)+'<span>Créer un modèle</span></button>';
}
// ── LE SENS DES COULEURS (Réglages) ────────────────────────────────────────
function _mlxMajSens(){
  const z=_mlEl('mlx-sens');
  if(!z||!_ml) return;
  const sens=_mlxSens();
  z.innerHTML='<p class="mlx-note">Le sens d’une couleur devient le nom des tracés que tu poses avec elle. Une trajectoire '
      +'rouge s’appelle « Trajectoire actuelle », une verte « Trajectoire idéale » — sauf si tu réécris leur sens. Ce réglage suit ton compte.</p>'
    +ML_PALETTE.map(p=>'<label class="mlx-sens-l"><i class="mlx-an-pt" style="--c:'+p.c+'"></i><span>'+p.nom+'</span>'
      +'<input class="mlx-in" type="text" maxlength="'+ANNOT_NOM_MAX+'" value="'+escapeHtml(sens[p.c]||'')+'" placeholder="Sans nom par défaut" '
      +'onchange="mlCouleurSens(\''+p.c+'\',this.value)"></label>').join('');
}

// ── LA TIMELINE : LES PISTES ───────────────────────────────────────────────
// Une piste par tracé, sous la piste des séquences. Chaque barre se déplace
// au doigt, et ses deux bords règlent le début et la fin.
const MLX_TL_REGLE=24, MLX_TL_SEQ=48, MLX_TL_PISTE=26;
function _mlxMajPistes(){
  const zp=_mlEl('ml-pistes'), zn=_mlEl('mlx-tl-noms'), inner=_mlEl('ml-frise-in');
  if(!_ml||!zp||!zn||!inner) return;
  const l=_ml.annot.a, D=_ml.dureeMs, w=inner.clientWidth;
  const haut=MLX_TL_REGLE+MLX_TL_SEQ+Math.max(1,l.length)*MLX_TL_PISTE+6;
  inner.style.height=haut+'px';
  zn.style.height=haut+'px';
  zn.innerHTML='<div class="mlx-tl-nom mlx-tl-nom-seq" style="top:'+MLX_TL_REGLE+'px;height:'+MLX_TL_SEQ+'px">Séquences</div>'
    +l.map((a,i)=>'<button type="button" class="mlx-tl-nom'+(a.id===_ml?.sel?' on':'')+(a.h?' masque':'')+'" style="top:'+(MLX_TL_REGLE+MLX_TL_SEQ+i*MLX_TL_PISTE)+'px" '
      +'onclick="mlAnnotChoisir(\''+escapeHtml(a.id)+'\',true)"><i class="mlx-an-pt" style="--c:'+a.c+'"></i><span>'+escapeHtml(a.n)+'</span></button>').join('')
    +(l.length?'':'<div class="mlx-tl-nom mlx-tl-vide" style="top:'+(MLX_TL_REGLE+MLX_TL_SEQ)+'px">Aucun tracé</div>');
  zp.style.top=(MLX_TL_REGLE+MLX_TL_SEQ)+'px';
  zp.innerHTML=D?l.map((a,i)=>{
    const x=mlTempsVersX(a.d,w,D), x2=mlTempsVersX(Math.min(a.f,D),w,D);
    return '<div class="mlx-barre'+(a.id===_ml?.sel?' on':'')+(a.h?' masque':'')+'" data-id="'+escapeHtml(a.id)+'" '
      +'style="left:'+x.toFixed(1)+'px;width:'+Math.max(6,x2-x).toFixed(1)+'px;top:'+(i*MLX_TL_PISTE+3)+'px;--c:'+a.c+';color:'+(_mlxClair(a.c)?'#0b0b0b':'#ffffff')+'" '
      +'title="'+escapeHtml(a.n+' · '+_mlxT(a.d)+' → '+_mlxT(a.f))+'">'
      +'<i class="mlx-bg" data-bord="d"></i><span>'+escapeHtml(a.n)+'</span><i class="mlx-bd" data-bord="f"></i></div>';
  }).join(''):'';
}
/**
 * Le glisser d'une barre : tout entière, ou un de ses bords. Branché une fois
 * sur la piste — les barres, elles, sont redessinées à chaque changement.
 * @param {HTMLElement} zp
 */
function _mlxBrancherPistes(zp){
  zp.addEventListener('pointerdown',e=>{
    const cible=e.target instanceof Element?e.target:null;
    const barre=/** @type {HTMLElement|null} */(cible?cible.closest('.mlx-barre'):null);
    const inner=_mlEl('ml-frise-in');
    if(!_ml||!barre||!inner||!_ml.dureeMs) return;
    const id=barre.dataset.id||'', a0=_mlxAnnot(id);
    if(!a0) return;
    e.preventDefault(); e.stopPropagation();
    const bord=cible instanceof HTMLElement&&cible.dataset.bord?cible.dataset.bord:'';
    const r=inner.getBoundingClientRect(), D=_ml.dureeMs, x0=e.clientX, avant=JSON.stringify(_ml.annot);
    let bouge=false;
    try{ barre.setPointerCapture(e.pointerId); }catch(x){}
    /** @param {PointerEvent} ev */
    const bouger=ev=>{
      if(!_ml) return;
      const dms=(ev.clientX-x0)/Math.max(1,r.width)*D;
      if(!bouge&&Math.abs(ev.clientX-x0)<3) return;
      bouge=true;
      let d=a0.d, f=a0.f;
      if(bord==='d') d=Math.max(0,Math.min(a0.f-SEG_MIN_MS,a0.d+dms));
      else if(bord==='f') f=Math.min(D,Math.max(a0.d+SEG_MIN_MS,a0.f+dms));
      else { const L=a0.f-a0.d; d=Math.max(0,Math.min(D-L,a0.d+dms)); f=d+L; }
      _mlxChanger(id,x=>{ const o={...x,d:Math.round(d),f:Math.round(f)}; delete o.seg; return o; });
      const w=inner.clientWidth, xa=mlTempsVersX(d,w,D), xb=mlTempsVersX(f,w,D);
      barre.style.left=xa.toFixed(1)+'px'; barre.style.width=Math.max(6,xb-xa).toFixed(1)+'px';
      _mlAller(bord==='f'?f:d,true);
    };
    const fin=()=>{
      barre.removeEventListener('pointermove',bouger);
      barre.removeEventListener('pointerup',fin);
      barre.removeEventListener('pointercancel',fin);
      if(!_ml) return;
      if(bouge){ _ml.annule.push(avant); if(_ml.annule.length>60) _ml.annule.shift(); _ml.refait=[];
        _ml.sel=id; _mlxApresChangement(); }
      else if(_ml.sel!==id) mlAnnotChoisir(id,true);
      else _mlAller(a0.d);
    };
    barre.addEventListener('pointermove',bouger);
    barre.addEventListener('pointerup',fin);
    barre.addEventListener('pointercancel',fin);
  });
}

// ── LES SÉQUENCES : LA LISTE ───────────────────────────────────────────────
// Chaque séquence avec son numéro, la vignette de sa première image, son nom
// et ses bornes ; celle qu'on a choisie se règle à l'image près en dessous.
function _mlMajListe(){
  const z=_mlEl('ml-liste'), zb=_mlEl('ml-bornes');
  if(!_ml||!z||!zb) return;
  const a=_mlActif(), S=_mlxIco;
  z.innerHTML=_ml.segments.length
    ?_ml.segments.map((s,i)=>'<div class="ml-rep mlx-seq'+(a&&s.id===a.id?' ml-rep-on':'')+'" role="button" tabindex="0" '
        +'aria-pressed="'+(!!a&&s.id===a.id)+'" onclick="mlChoisir(\''+escapeHtml(s.id)+'\')" '
        +'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}">'
        +'<span class="mlx-seq-n">'+(i+1)+'</span>'
        +'<canvas class="mlx-sv" data-seg="'+escapeHtml(s.id)+'" width="112" height="72" aria-hidden="true"></canvas>'
        +'<span class="mlx-seq-t"><b class="ml-rep-n">'+escapeHtml(s.label)+'</b>'
          +'<span class="ml-rep-t">'+_mlxT(s.debutMs).slice(0,-3)+' – '+_mlxT(s.finMs).slice(0,-3)
          +(s.barre?' · <b class="ml-rep-traj">trajectoire</b>':'')+'</span></span>'
        +'<button type="button" class="ml-mini" onclick="event.stopPropagation();mlRenommer('+i+')" '
          +'aria-label="Renommer '+escapeHtml(s.label)+'">'+S('crayon',15)+'</button>'
        +'<button type="button" class="ml-mini" onclick="event.stopPropagation();mlSupprimer('+i+')" '
          +'aria-label="Supprimer '+escapeHtml(s.label)+'">×</button></div>').join('')
    :'<div class="ml-vide">Aucune séquence pour l’instant.</div>';
  zb.innerHTML=a?'<div class="ml-bornes">'
      +['debut','fin'].map(q=>'<div class="ml-borne"><span class="ml-lab">'+(q==='debut'?'Début':'Fin')+'</span>'
        +'<span class="ml-val" id="ml-v-'+q+'">'+mlTempsTexte(q==='debut'?a.debutMs:a.finMs)+'</span>'
        +'<button type="button" class="ml-b" onclick="mlPas(\''+q+'\',-1)" aria-label="'+(q==='debut'?'Début':'Fin')+' : une image plus tôt">◀ 1</button>'
        +'<button type="button" class="ml-b" onclick="mlIci(\''+q+'\')" aria-label="'+(q==='debut'?'Début':'Fin')+' à la tête de lecture">Ici</button>'
        +'<button type="button" class="ml-b" onclick="mlPas(\''+q+'\',1)" aria-label="'+(q==='debut'?'Début':'Fin')+' : une image plus tard">1 ▶</button>'
        +'</div>').join('')
      +'<div class="ml-borne-pied">'
        +'<button type="button" class="ml-b" id="ml-boucle" aria-pressed="'+_ml.boucle+'" onclick="mlBoucle()">⟲ Lire en boucle</button>'
        +'<span id="ml-duree">'+escapeHtml(a.label)+' · '+mlDureeTexte(a.finMs-a.debutMs)+'</span>'
      +'</div></div>':'';
  if(!_ml.dureeMs) zb.querySelectorAll('button').forEach(x=>{ x.setAttribute('disabled',''); });
  _mlMajSegmentsFrise();
  _mlMajTrajectoire();
  _mlxVignettesSeq();
}
// LES VIGNETTES DES SÉQUENCES. Une vidéo cachée va chercher la première image
// de chacune ; le dessin est gardé dans un canevas hors écran, et recopié à
// chaque rendu de la liste. On y DESSINE sans jamais y LIRE un pixel : une
// vidéo d'une autre origine « contamine » le canevas, et le dessin reste permis.
/** @type {Map<string,HTMLCanvasElement>} */
const _mlxVignCache=new Map();
function _mlxVignettesSeq(){
  if(!_ml||!_ml.dureeMs) return;
  const url=_ml.url;
  /** @param {HTMLCanvasElement} c @param {HTMLCanvasElement} src */
  const peindre=(c,src)=>{ const g=c.getContext('2d'); if(!g) return; g.clearRect(0,0,c.width,c.height); try{ g.drawImage(src,0,0,c.width,c.height); }catch(e){} };
  /** @type {{cle:string, id:string, t:number}[]} */
  const aFaire=[];
  document.querySelectorAll('#ml-liste canvas.mlx-sv').forEach(x=>{
    const c=/** @type {HTMLCanvasElement} */(x), s=_ml?_ml.segments.find(q=>q.id===c.dataset.seg):null;
    if(!s) return;
    const cle=url+'|'+s.debutMs, en=_mlxVignCache.get(cle);
    if(en) peindre(c,en); else if(!aFaire.some(q=>q.cle===cle)) aFaire.push({cle,id:s.id,t:s.debutMs});
  });
  if(!aFaire.length) return;
  const jeton=++_ml.jetonVseq;
  const adresse=safeUrlRaw(url);
  if(adresse==='#') return;
  const ancien=_mlEl('ml-vseq-src'); if(ancien) ancien.remove();
  const scene=_mlEl('ml-contenu'); if(!scene) return;
  const src=document.createElement('video');
  src.id='ml-vseq-src'; src.muted=true; src.playsInline=true; src.preload='auto';
  src.setAttribute('playsinline',''); src.setAttribute('aria-hidden','true');
  src.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
  src.src=adresse;
  scene.appendChild(src);
  const encore=()=>!!_ml&&_ml.jetonVseq===jeton;
  /** @param {number} t @returns {Promise<boolean>} */
  const chercher=t=>new Promise(res=>{
    const fini=(/** @type {boolean} */ ok)=>{ clearTimeout(m); src.removeEventListener('seeked',ok1); res(ok); };
    const ok1=()=>fini(true);
    const m=setTimeout(()=>fini(false),4000);
    src.addEventListener('seeked',ok1);
    try{ src.currentTime=Math.max(0.001,t/1000); }catch(e){ fini(false); }
  });
  const lancer=async()=>{
    for(const q of aFaire){
      if(!encore()||!await chercher(q.t)||!encore()) break;
      const off=document.createElement('canvas'); off.width=112; off.height=72;
      const g=off.getContext('2d'); if(!g) break;
      const vw=src.videoWidth||16, vh=src.videoHeight||9, rC=off.width/off.height, rS=vw/vh;
      let sx=0, sy=0, sw=vw, sh=vh;
      if(rS>rC){ sw=vh*rC; sx=(vw-sw)/2; } else { sh=vw/rC; sy=(vh-sh)/2; }
      try{ g.drawImage(src,sx,sy,sw,sh,0,0,off.width,off.height); }catch(e){ break; }
      _mlxVignCache.set(q.cle,off);
      document.querySelectorAll('#ml-liste canvas.mlx-sv[data-seg="'+q.id+'"]').forEach(x=>peindre(/** @type {HTMLCanvasElement} */(x),off));
    }
    if(encore()) src.remove();
  };
  if(src.readyState>=1) lancer();
  else { src.addEventListener('loadedmetadata',()=>{ lancer(); },{once:true}); src.addEventListener('error',()=>{ src.remove(); },{once:true}); }
}

// Les écoutes : la vidéo, la frise, les poignées, le clavier.
let _mlxEcoutesGlobales=false, _mlxClavierBranche=false;
function _mlBrancher(){
  const v=_mlVideo(), frise=_mlEl('ml-frise-in');
  if(!v||!frise||!_ml) return;
  const jeton=_ml.jeton;
  const pret=()=>{
    if(!_ml||_ml.jeton!==jeton) return;
    const d=Number(v.duration);
    if(!(isFinite(d)&&d>0)){ _mlFps('Durée illisible : cette vidéo ne se découpe pas.'); return; }
    _ml.dureeMs=Math.round(d*1000);
    document.querySelectorAll('#ml-contenu button[disabled]').forEach(x=>{ x.removeAttribute('disabled'); });
    _mlFps('i/s non mesuré : lance la lecture pour le mesurer');
    const pos=_mlEl('mlx-pos'); if(pos instanceof HTMLInputElement) pos.disabled=false;
    const a=_mlActif();
    if(a) _mlAller(a.debutMs);
    _mlMajFrise();
    _mlVignettes();
    // LES PANNEAUX NEUFS SE REDESSINENT avec la durée : leurs boutons en
    // dépendent, et la boucle ci-dessus vient de tous les réactiver.
    _mlMajListe();
    _mlxMajTout();
    // LES SUIVIS COUPÉS PAR L'ANCIENNE BORNE DES 20 s se prolongent seuls
    // (build 1392) — maintenant, parce que la fin du tracé se borne à la
    // durée de la vidéo, qu'on vient seulement d'apprendre.
    window.setTimeout(()=>{
      if(_ml&&_ml.jeton===jeton) _mlxProlongerTronques().catch(()=>0);
    },300);
  };
  if(v.readyState>=1) pret(); else v.addEventListener('loadedmetadata',pret,{once:true});
  let fpsDemande=false;
  v.addEventListener('play',()=>{
    const p=_mlEl('ml-play'); if(p){ p.innerHTML=_mlxIco('pause',20); p.setAttribute('aria-label','Pause (espace)'); }
    // iOS remet playbackRate à 1 après un play() : on le repose, comme le
    // lecteur de correction.
    const r=Number(v.dataset.rate||1); if(r!==1) videoSetRate(v,r);
    if(!fpsDemande){
      fpsDemande=true;
      _videoMesurerFps(v,(fps,variable)=>{
        if(!_ml) return;
        const mesure=typeof v._rcFps==='number'&&v._rcFps>0;
        _mlFps(!mesure?'i/s non mesurable ici : pas d’une image estimé à '+VID_FPS_DEFAUT+' i/s'
          :variable?'Cadence variable (~'+Math.round(fps)+' i/s) : le pas est approché'
          :Math.round(fps)+' i/s');
      });
    }
    _mlSuivre();
    _mlJournal([_mlRecT(),'lecture']);
  });
  v.addEventListener('pause',()=>{
    const p=_mlEl('ml-play'); if(p){ p.innerHTML=_mlxIco('lire',20); p.setAttribute('aria-label','Lecture (espace)'); }
    _mlMajTete();
    _mlJournal([_mlRecT(),'pause']);
  });
  // LE JOURNAL ÉCOUTE LA VIDÉO, et non les boutons : une boucle qui repart, une
  // poignée qu'on tire, une fin de fichier qui arrête la lecture — tout ce qui
  // change l'image y entre, quel qu'en soit le déclencheur.
  v.addEventListener('seeked',()=>{
    _mlMajTete();
    _mlJournal([_mlRecT(),'aller',Math.round((Number(v.currentTime)||0)*1000)]);
  });
  v.addEventListener('ratechange',()=>{
    if(VID_RATES.includes(v.playbackRate)) _mlJournal([_mlRecT(),'vitesse',v.playbackRate]);
  });
  v.addEventListener('timeupdate',()=>{ if(v.paused) _mlMajTete(); });
  // UN TOUCHER SUR LA FRISE DÉPLACE LA TÊTE DE LECTURE ; un toucher sur une
  // autre répétition la choisit. `click` et non pointerdown : un glissement
  // qui fait défiler la frise zoomée ne doit rien déplacer.
  frise.addEventListener('click',e=>{
    if(!_ml||!_ml.dureeMs) return;
    const cible=/** @type {HTMLElement|null} */(e.target instanceof Element?e.target.closest('[data-seg]'):null);
    if(cible&&cible.dataset.seg){ mlChoisir(cible.dataset.seg); return; }
    if(e.target instanceof Element&&(e.target.closest('.ml-poignee')||e.target.closest('.mlx-barre'))) return;
    const r=frise.getBoundingClientRect();
    _mlAller(mlXVersTemps(e.clientX-r.left,r.width,_ml.dureeMs));
  });
  ['debut','fin'].forEach(q=>{
    const p=_mlEl('ml-p-'+q);
    if(p) _mlGlisser(p,/** @type {Borne} */(q));
  });
  const calque=_mlEl('ml-calque');
  if(calque) _mlBrancherCalque(calque);
  // L'APERÇU SUIT LE CURSEUR : le segment qui va de l'angle ou de la courbe
  // en cours jusqu'à la souris dit où tombera le prochain point.
  if(calque){
    calque.addEventListener('pointermove',e=>{
      // L'ÉTIQUETTE EN MAIN SUIT LA SOURIS, bouton lâché.
      if(_ml&&_ml.deplEtiq&&!e.buttons){
        const b3=calque.getBoundingClientRect();
        _mlxEtiqBouger(e.clientX-b3.left,e.clientY-b3.top);
        return;
      }
      // L'ÉCHELLE COMMENCÉE D'UN CLIC : le bas suit la souris, loupe comprise.
      if(_ml&&_ml.echPose&&!e.buttons){
        const v4=_mlVideo(), R4=v4?_mlVideoRect(v4):null; if(!R4) return;
        const b4=calque.getBoundingClientRect();
        const q4=[_mlxBorne((e.clientX-b4.left-R4.ox)/R4.s/R4.vw*1000),_mlxBorne((e.clientY-b4.top-R4.oy)/R4.s/R4.vh*1000)];
        _mlxEchPoints(_ml.echPose.a,q4);
        _mlxLoupeEchelle(q4);
        _mlDessinerCalque();
        return;
      }
      const tr=_ml&&_ml.trace;
      if(!_ml||!tr) return;
      const v2=_mlVideo(), R2=v2?_mlVideoRect(v2):null; if(!R2) return;
      const b2=calque.getBoundingClientRect();
      const q=[_mlxBorne((e.clientX-b2.left-R2.ox)/R2.s/R2.vw*1000),_mlxBorne((e.clientY-b2.top-R2.oy)/R2.s/R2.vh*1000)];
      // LE TRACÉ COMMENCÉ D'UN CLIC : l'arrivée suit la souris, et une
      // trajectoire s'écrit sous elle, sans bouton tenu.
      if(tr.clic){
        if(tr.t==='libre'){
          const der=tr.pts[tr.pts.length-1];
          if(tr.pts.length<2000&&Math.hypot((q[0]-der[0])*R2.vw*R2.s/1000,(q[1]-der[1])*R2.vh*R2.s/1000)>=3) tr.pts.push(q);
        } else tr.pts[1]=q;
        _mlDessinerCalque();
        return;
      }
      if(!['angle','courbe','point'].includes(tr.t)) return;
      _ml.curseur=q;
      _mlDessinerCalque();
    });
    calque.addEventListener('pointerleave',()=>{ if(_ml&&_ml.curseur){ _ml.curseur=null; _mlDessinerCalque(); } });
    calque.addEventListener('dblclick',e=>{
      if(!_ml||_ml.mode!=='lecture') return;
      // LE DOUBLE-CLIC SUR UNE ÉTIQUETTE OU LA LÉGENDE LA MET EN MAIN — s'il
      // ne l'a pas déjà fait au second toucher.
      if(_ml.deplEtiq){ e.preventDefault(); return; }
      const b3=calque.getBoundingClientRect();
      if(_mlxEtiqDoubleToucher(e.clientX-b3.left,e.clientY-b3.top)){ e.preventDefault(); return; }
      if(_ml.trace&&(_ml.trace.t==='courbe'||_ml.trace.t==='point')){ e.preventDefault(); mlTerminerTrace(); }
    });
  }
  const zp=_mlEl('ml-pistes');
  if(zp) _mlxBrancherPistes(zp);
  // Le calque suit la taille affichée de la vidéo : une rotation du téléphone
  // la change, et un tracé décalé mentirait sur la position du disque.
  v.addEventListener('loadeddata',()=>_mlDessinerCalque());
  if(!window._mlRedim){
    window._mlRedim=true;
    window.addEventListener('resize',()=>{ try{ if(_ml){ _mlDessinerCalque(); _mlDessinerCourbe(); } }catch(e){} });
  }
  // LES FLÈCHES = IMAGE PAR IMAGE, sauf dans un champ de saisie et sauf sur
  // une poignée, qui a les siennes.
  // ⚠ LE CLAVIER ÉCOUTE LE DOCUMENT, et non l'écran : un clic sur la vidéo —
  // un canevas, qui ne prend pas le focus — laissait le focus au corps de la
  // page, et les touches n'arrivaient jamais à une écoute posée sur l'écran.
  // On ne répond que si le laboratoire est l'écran actif, et que le focus est
  // chez lui ou nulle part : une boîte de dialogue ouverte garde ses touches.
  if(!_mlxClavierBranche){
    _mlxClavierBranche=true;
    document.addEventListener('keydown',e=>{
      const ecran=_mlEl('s-coach-motion-lab');
      if(!_ml||!ecran||!ecran.classList.contains('active')) return;
      const t=e.target instanceof Element?e.target:null;
      if(t&&t!==document.body&&t!==document.documentElement&&!ecran.contains(t)) return;
      if(t&&(t.closest('input,textarea,select')||t.closest('.ml-poignee'))) return;
      if(e.key==='ArrowLeft'){ e.preventDefault(); for(let i=0;i<(e.shiftKey?10:1);i++) mlImage(-1); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); for(let i=0;i<(e.shiftKey?10:1);i++) mlImage(1); }
      else _mlxClavier(e);
    });
  }
  // LE PLEIN ÉCRAN ET LA FENÊTRE changent la taille de l'image : le calque et
  // la timeline se recalent.
  if(!_mlxEcoutesGlobales){
    _mlxEcoutesGlobales=true;
    const recaler=()=>{ try{ if(_ml){ _mlMajFrise(); _mlxMajPistes(); _mlDessinerCalque(); } }catch(x){} };
    document.addEventListener('fullscreenchange',()=>setTimeout(recaler,60));
    window.addEventListener('resize',recaler);
    document.addEventListener('click',e=>{
      const m=_mlEl('mlx-menu');
      if(m&&!m.hidden&&!(e.target instanceof Element&&e.target.closest('.mlx-menu-z'))) mlMenu();
    });
  }
}
/** @param {string} txt */
function _mlFps(txt){ const f=_mlEl('ml-fps'); if(f) f.textContent=txt; }

// La tête de lecture suit la lecture image par image, et s'arrête avec elle.
function _mlSuivre(){
  if(!_ml) return;
  if(_ml.raf) cancelAnimationFrame(_ml.raf);
  const pas=()=>{
    if(!_ml) return;
    _mlMajTete(true);
    const v=_mlVideo();
    _ml.raf=(v&&!v.paused&&!v.ended)?requestAnimationFrame(pas):0;
  };
  _ml.raf=requestAnimationFrame(pas);
}
/**
 * La tête de lecture, le temps affiché — et, en lecture sur une frise zoomée,
 * le défilement qui la garde à l'écran.
 * @param {boolean} [suivre]
 */
function _mlMajTete(suivre){
  const v=_mlVideo(), frise=_mlEl('ml-frise'), tete=_mlEl('ml-tete'), inner=_mlEl('ml-frise-in');
  if(!_ml||!v||!tete||!inner) return;
  const ms=Math.round((Number(v.currentTime)||0)*1000);
  const x=mlTempsVersX(ms,inner.clientWidth,_ml.dureeMs);
  tete.style.transform='translateX('+x.toFixed(1)+'px)';
  const t=_mlEl('ml-t');
  if(t){
    const fps=Number(/** @type {any} */(v)._rcFps);
    t.textContent=mlTempsTexte(ms)+((isFinite(fps)&&fps>0)?' · img '+Math.round(ms*fps/1000):'');
  }
  if(suivre&&frise&&_ml.zoom>1){
    if(x<frise.scrollLeft||x>frise.scrollLeft+frise.clientWidth-24)
      frise.scrollLeft=Math.max(0,x-24);
  }
  const pos=_mlEl('mlx-pos');
  if(pos instanceof HTMLInputElement&&_ml.dureeMs){
    const p=Math.round(ms/_ml.dureeMs*1000);
    if(document.activeElement!==pos) pos.value=String(p);
    pos.style.setProperty('--p',(p/10)+'%');
  }
  const du=_mlEl('mlx-duree'); if(du) du.textContent=' / '+_mlDureeCourte(_ml.dureeMs);
  const tl=_mlEl('mlx-tl-t'); if(tl) tl.textContent=_mlDureeCourte(ms)+' / '+_mlDureeCourte(_ml.dureeMs);
  if(v.paused) _mlxMajCleEtat();
  _mlDessinerCalque();
  _mlDessinerCourbe();
}

// La frise : largeur selon le zoom, règle, répétitions, poignées, tête.
function _mlMajFrise(){
  const inner=_mlEl('ml-frise-in');
  if(!_ml||!inner) return;
  inner.style.width=(_ml.zoom*100)+'%';
  const zv=_mlEl('ml-zoom-val'); if(zv) zv.textContent=_ml.zoom+'×';
  document.querySelectorAll('#ml-contenu button[data-zoom]').forEach(x=>{
    const b=/** @type {HTMLButtonElement} */(x);
    b.disabled=!_ml||!_ml.dureeMs||(b.dataset.zoom==='-1'?_ml.zoom===ML_ZOOMS[0]:_ml.zoom===ML_ZOOMS[ML_ZOOMS.length-1]);
  });
  _mlRegle();
  _mlMajSegmentsFrise();
  // Les barres des tracés sont posées au pixel : le zoom les recale.
  _mlxMajPistes();
  _mlMajTete();
}
function _mlRegle(){
  const c=_mlEl('ml-regle'), inner=_mlEl('ml-frise-in');
  if(!_ml||!(c instanceof HTMLCanvasElement)||!inner||!_ml.dureeMs) return;
  const w=inner.clientWidth, h=22, dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
  const g=c.getContext('2d');
  if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,w,h);
  const pas=mlPasRegleMs(w,_ml.dureeMs);
  const faint=_tok('--text-faint','#828282');
  g.fillStyle=faint; g.strokeStyle=faint;
  g.font='600 10px Montserrat, sans-serif';
  g.textBaseline='top';
  for(let t=0;t<=_ml.dureeMs;t+=pas){
    const x=Math.round(mlTempsVersX(t,w,_ml.dureeMs))+0.5;
    g.globalAlpha=0.7; g.beginPath(); g.moveTo(x,0); g.lineTo(x,5); g.stroke();
    g.globalAlpha=1;
    const lib=pas<1000?(t/1000).toFixed(pas<500?2:1).replace('.',','):String(Math.round(t/1000));
    const lw=g.measureText(lib+' s').width;
    if(x+lw+2<w) g.fillText(lib+' s',x+2,7);
  }
}
function _mlMajSegmentsFrise(){
  const inner=_mlEl('ml-frise-in'), autres=_mlEl('ml-autres'), sel=_mlEl('ml-sel');
  const pd=_mlEl('ml-p-debut'), pf=_mlEl('ml-p-fin');
  if(!_ml||!inner||!autres||!sel||!pd||!pf) return;
  const w=inner.clientWidth, d=_ml.dureeMs, a=_mlActif();
  autres.innerHTML=d?_ml.segments.filter(s=>!a||s.id!==a.id).map(s=>{
    const x=mlTempsVersX(s.debutMs,w,d), x2=mlTempsVersX(s.finMs,w,d);
    return '<div class="ml-autre" data-seg="'+escapeHtml(s.id)+'" style="left:'+x.toFixed(1)+'px;width:'
      +Math.max(2,x2-x).toFixed(1)+'px" title="'+escapeHtml(s.label)+'"><span>'+escapeHtml(s.label)+'</span></div>';
  }).join(''):'';
  const visible=!!(a&&d);
  sel.hidden=!visible; pd.hidden=!visible; pf.hidden=!visible;
  if(!a||!d) return;
  const x=mlTempsVersX(a.debutMs,w,d), x2=mlTempsVersX(a.finMs,w,d);
  sel.style.left=x.toFixed(1)+'px'; sel.style.width=Math.max(2,x2-x).toFixed(1)+'px';
  pd.style.left=x.toFixed(1)+'px'; pf.style.left=x2.toFixed(1)+'px';
  for(const [p,q] of /** @type {[HTMLElement,Borne][]} */([[pd,'debut'],[pf,'fin']])){
    const ms=q==='debut'?a.debutMs:a.finMs;
    p.setAttribute('aria-valuemin','0');
    p.setAttribute('aria-valuemax',String(d));
    p.setAttribute('aria-valuenow',String(ms));
    p.setAttribute('aria-valuetext',(q==='debut'?'Début ':'Fin ')+mlTempsTexte(ms));
  }
}

function _mlMajEnregistrer(){
  const b=_mlEl('ml-enreg');
  if(!(b instanceof HTMLButtonElement)) return;
  const m=_mlModifie();
  b.disabled=!m;
  const pt=b.querySelector('.mlx-enreg-pt'); if(pt) pt.textContent=m?'•':'';
  b.setAttribute('aria-label',m?'Enregistrer la correction — des modifications attendent':'Enregistrer la correction : tout est enregistré');
}

// ══ LES MINIATURES ════════════════════════════════════════════════════════════
// UNE SECONDE VIDÉO, CACHÉE, sur la même adresse : chercher les images dans la
// vidéo que le coach regarde la ferait sauter sous ses yeux. Le canvas peut
// être « contaminé » par une vidéo d'une autre origine : on y DESSINE, on n'y
// LIT jamais un pixel, et le dessin reste permis. MEILLEUR EFFORT : si une
// recherche n'aboutit pas, la frise garde sa règle et ses répétitions.
function _mlVignettes(){
  if(!_ml||!_ml.dureeMs) return;
  const jeton=++_ml.jeton;
  const c=_mlEl('ml-vign'), inner=_mlEl('ml-frise-in'), scene=_mlEl('ml-contenu');
  if(!(c instanceof HTMLCanvasElement)||!inner||!scene) return;
  const ancien=_mlEl('ml-vign-src'); if(ancien) ancien.remove();
  // safeUrlRaw ET NON safeUrl : on affecte une PROPRIÉTÉ, pas un attribut
  // écrit en HTML — l'échappement y changerait un « & » d'adresse en « &amp; ».
  const adresse=safeUrlRaw(_ml.url);
  if(adresse==='#') return;
  const src=document.createElement('video');
  src.id='ml-vign-src'; src.muted=true; src.playsInline=true; src.preload='auto';
  src.setAttribute('playsinline',''); src.setAttribute('aria-hidden','true');
  src.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px';
  src.src=adresse;
  scene.appendChild(src);
  const w=inner.clientWidth, h=ML_VIGNETTE_H, dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
  const g=c.getContext('2d');
  if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.fillStyle='#0a0a0a'; g.fillRect(0,0,w,h);
  /** @param {number} t @returns {Promise<boolean>} */
  const chercher=t=>new Promise(res=>{
    const fini=(/** @type {boolean} */ ok)=>{ clearTimeout(minuteur); src.removeEventListener('seeked',ok1); res(ok); };
    const ok1=()=>fini(true);
    const minuteur=setTimeout(()=>fini(false),4000);
    src.addEventListener('seeked',ok1);
    try{ src.currentTime=t; }catch(e){ fini(false); }
  });
  const encore=()=>!!_ml&&_ml.jeton===jeton;
  const lancer=async()=>{
    if(!encore()) return;
    const vw=src.videoWidth||16, vh=src.videoHeight||9;
    const largeur=Math.max(24,h*vw/vh);
    const n=Math.max(1,Math.min(ML_VIGNETTES_MAX,Math.ceil(w/largeur)));
    const pas=w/n;
    for(let i=0;i<n;i++){
      if(!encore()) return;
      const t=((i+0.5)/n)*(_ml?_ml.dureeMs:0)/1000;
      if(!await chercher(t)||!encore()) break;
      // COUVRIR la case, comme object-fit:cover : on rogne la source.
      const rCase=pas/h, rSrc=vw/vh;
      let sx=0, sy=0, sw=vw, sh=vh;
      if(rSrc>rCase){ sw=vh*rCase; sx=(vw-sw)/2; } else { sh=vw/rCase; sy=(vh-sh)/2; }
      try{ g.drawImage(src,sx,sy,sw,sh,i*pas,0,pas+0.5,h); }catch(e){ break; }
    }
    if(encore()) src.remove();
  };
  if(src.readyState>=1) lancer();
  else{
    src.addEventListener('loadedmetadata',()=>{ lancer(); },{once:true});
    src.addEventListener('error',()=>{ src.remove(); },{once:true});
  }
}

// ══ LES GESTES ════════════════════════════════════════════════════════════════

/**
 * Amène la vidéo à un instant. PENDANT UN GLISSEMENT, une seule recherche par
 * image affichée : en poser une à chaque mouvement du doigt les empilerait, et
 * la vidéo montrerait l'image d'il y a une demi-seconde.
 * @param {number} ms
 * @param {boolean} [rapide]
 */
function _mlAller(ms,rapide){
  const v=_mlVideo();
  if(!_ml||!v) return;
  const t=Math.max(0,Math.min(_ml.dureeMs||Infinity,ms))/1000;
  if(!rapide){
    try{ v.currentTime=t; }catch(e){}
    _mlMajTete();
    return;
  }
  const deja=_ml.seekEnAttente!=null;
  _ml.seekEnAttente=t;
  if(deja) return;
  requestAnimationFrame(()=>{
    if(!_ml||_ml.seekEnAttente==null) return;
    const cible=_ml.seekEnAttente;
    _ml.seekEnAttente=null;
    try{
      const fv=/** @type {any} */(v);
      if(typeof fv.fastSeek==='function') fv.fastSeek(cible); else v.currentTime=cible;
    }catch(e){}
    _mlMajTete();
  });
}
/**
 * Pose une borne de la répétition choisie, et tout ce qui en dépend : la
 * frise, la liste, la boucle, l'état d'enregistrement.
 * @param {Borne} quel
 * @param {number} ms
 * @param {boolean} [glisse]
 * @returns {boolean}
 */
function _mlPoserBorne(quel,ms,glisse){
  const a=_mlActif();
  if(!_ml||!a||!_ml.dureeMs||_mlOccupe()) return false;
  const n=mlBorner(a,quel,ms,_ml.dureeMs);
  // UNE TRAJECTOIRE NE SURVIT PAS À SES BORNES. mlBorner rend la répétition
  // sans elle ; on oublie aussi le suivi gardé sur l'appareil, et on le dit
  // une fois — au premier déplacement, pas à chaque mouvement du doigt.
  if((a.barre||_ml.suivis[a.id])&&(n.debutMs!==a.debutMs||n.finMs!==a.finMs)){
    delete _ml.suivis[a.id];
    toast('La trajectoire de '+a.label+' est à refaire : ses bornes ont changé.');
  }
  if(_ml.mode!=='lecture'&&(n.debutMs!==a.debutMs||n.finMs!==a.finMs)){ _ml.mode='lecture'; _ml.graine=null; }
  _ml.segments=_ml.segments.map(s=>s.id===n.id?n:s).sort((x,y)=>x.debutMs-y.debutMs||x.finMs-y.finMs);
  _mlAller(quel==='debut'?n.debutMs:n.finMs,glisse);
  if(glisse){
    // Pendant le geste, seulement la frise et les deux valeurs : reconstruire
    // la liste à chaque mouvement ferait perdre le focus clavier.
    _mlMajSegmentsFrise();
    const vd=_mlEl('ml-v-debut'), vf=_mlEl('ml-v-fin'), du=_mlEl('ml-duree');
    if(vd) vd.textContent=mlTempsTexte(n.debutMs);
    if(vf) vf.textContent=mlTempsTexte(n.finMs);
    if(du) du.textContent=n.label+' · '+mlDureeTexte(n.finMs-n.debutMs);
  } else _mlMajListe();
  _mlMajBoucle();
  _mlMajEnregistrer();
  return true;
}
/**
 * Une poignée : glisser au doigt, et au clavier ±1 image (±10 avec Maj).
 * @param {HTMLElement} p
 * @param {Borne} quel
 */
function _mlGlisser(p,quel){
  p.addEventListener('pointerdown',e=>{
    if(!_ml||!_ml.dureeMs) return;
    e.preventDefault();
    try{ p.setPointerCapture(e.pointerId); }catch(x){}
    const v=_mlVideo(); if(v) v.pause();
    /** @param {PointerEvent} ev */
    const bouger=ev=>{
      const inner=_mlEl('ml-frise-in');
      if(!_ml||!inner) return;
      const r=inner.getBoundingClientRect();
      _mlPoserBorne(quel,mlXVersTemps(ev.clientX-r.left,r.width,_ml.dureeMs),true);
    };
    const fin=()=>{
      p.removeEventListener('pointermove',bouger);
      p.removeEventListener('pointerup',fin);
      p.removeEventListener('pointercancel',fin);
      const a=_mlActif();
      // LA RECHERCHE FINALE EST EXACTE : fastSeek s'arrête sur l'image clé la
      // plus proche, et le coach doit voir l'image où il a lâché.
      if(a) _mlPoserBorne(quel,quel==='debut'?a.debutMs:a.finMs,false);
    };
    p.addEventListener('pointermove',bouger);
    p.addEventListener('pointerup',fin);
    p.addEventListener('pointercancel',fin);
  });
  p.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight') return;
    e.preventDefault();
    const n=(e.shiftKey?10:1)*(e.key==='ArrowLeft'?-1:1);
    for(let i=0;i<Math.abs(n);i++) mlPas(quel,n<0?-1:1);
  });
}
function _mlMajBoucle(){
  const v=_mlVideo(), a=_mlActif();
  if(!_ml||!v) return;
  if(_ml.boucle&&a) videoSetLoop(v,a.debutMs/1000,a.finMs/1000);
  else videoClearLoop(v);
  const b=_mlEl('ml-boucle');
  if(b) b.setAttribute('aria-pressed',String(!!_ml.boucle));
}

/** Lecture / pause. */
function mlLecture(){
  const v=_mlVideo();
  if(!v||!_ml||!_ml.dureeMs) return false;
  if(v.paused){
    // EN BOUCLE, ON REPART DU DÉBUT de la répétition si la tête est dehors.
    const a=_mlActif();
    if(_ml.boucle&&a){
      const ms=(Number(v.currentTime)||0)*1000;
      if(ms<a.debutMs||ms>=a.finMs) v.currentTime=a.debutMs/1000;
    }
    const p=v.play(); if(p&&typeof p.catch==='function') p.catch(()=>{});
  } else v.pause();
  return true;
}
/** @param {number} sens */
function mlImage(sens){
  const v=_mlVideo();
  if(!v||!_ml||!_ml.dureeMs) return false;
  try{ v.pause(); }catch(e){}
  const ms=Math.round((Number(v.currentTime)||0)*1000+(sens<0?-1:1)*mlPasImageMs(videoDetectFps(v)));
  _mlAller(Math.max(0,Math.min(_ml.dureeMs,ms)));
  return true;
}
/** @param {number} r */
function mlVitesse(r){
  const v=_mlVideo();
  if(!v) return false;
  const applique=videoSetRate(v,r);
  if(applique==null) return false;
  v.dataset.rate=String(applique);
  document.querySelectorAll('#ml-contenu button[data-rate]').forEach(x=>{
    const b=/** @type {HTMLElement} */(x);
    b.setAttribute('aria-pressed',String(Math.abs(Number(b.dataset.rate)-applique)<1e-6));
  });
  return true;
}
/** @param {number} sens */
function mlZoom(sens){
  const frise=_mlEl('ml-frise'), inner=_mlEl('ml-frise-in'), v=_mlVideo();
  if(!_ml||!frise||!inner||!_ml.dureeMs) return false;
  const z=mlZoomVoisin(_ml.zoom,sens);
  if(z===_ml.zoom) return false;
  // ON GARDE À L'ÉCRAN CE QU'ON REGARDAIT : la répétition choisie, sinon la
  // tête de lecture.
  const a=_mlActif();
  const centre=a?(a.debutMs+a.finMs)/2:Math.round((Number(v&&v.currentTime)||0)*1000);
  _ml.zoom=z;
  _mlMajFrise();
  frise.scrollLeft=Math.max(0,mlTempsVersX(centre,inner.clientWidth,_ml.dureeMs)-frise.clientWidth/2);
  _mlVignettes();
  return true;
}
/** @param {string} id */
function mlChoisir(id){
  if(!_ml) return false;
  const s=_ml.segments.find(x=>x.id===id);
  if(!s||_mlOccupe()) return false;
  if(_ml.actifId!==s.id&&_ml.mode!=='lecture'){ _ml.mode='lecture'; _ml.graine=null; }
  // EN PLEINE CORRECTION, la trajectoire affichée change avec la répétition :
  // le journal le dit, pour que l'athlète voie la même.
  const avant=_mlActif();
  if(_ml.rec&&_ml.rec.trace&&avant&&avant.id!==s.id){
    if(avant.barre) _mlJournal([_mlRecT(),'calque','trajectoire',avant.id,0]);
    if(s.barre) _mlJournal([_mlRecT(),'calque','trajectoire',s.id,1]);
  }
  _ml.actifId=s.id;
  _mlMajListe();
  _mlAller(s.debutMs);
  _mlMajBoucle();
  return true;
}
function mlAjouter(){
  const v=_mlVideo();
  if(!_ml||!v||!_ml.dureeMs) return false;
  if(_ml.segments.length>=SEG_MAX){
    toast('Vingt répétitions au plus par vidéo.','var(--orange)'); return false;
  }
  const s=mlNouveauSegment(_ml.segments,Math.round((Number(v.currentTime)||0)*1000),_ml.dureeMs);
  if(!s){ toast('Cette vidéo est trop courte pour une répétition.','var(--orange)'); return false; }
  try{ v.pause(); }catch(e){}
  _ml.segments=_ml.segments.concat([s]).sort((x,y)=>x.debutMs-y.debutMs||x.finMs-y.finMs);
  _ml.actifId=s.id;
  _mlMajListe();
  _mlMajBoucle();
  _mlMajEnregistrer();
  return true;
}
/** @param {Borne} quel @param {number} sens */
function mlPas(quel,sens){
  const a=_mlActif(), v=_mlVideo();
  if(!_ml||!a||!v) return false;
  const ms=(quel==='debut'?a.debutMs:a.finMs)+(sens<0?-1:1)*mlPasImageMs(videoDetectFps(v));
  try{ v.pause(); }catch(e){}
  return _mlPoserBorne(quel,ms,false);
}
/** @param {Borne} quel */
function mlIci(quel){
  const v=_mlVideo();
  if(!v) return false;
  try{ v.pause(); }catch(e){}
  return _mlPoserBorne(quel,Math.round((Number(v.currentTime)||0)*1000),false);
}
function mlBoucle(){
  const v=_mlVideo(), a=_mlActif();
  if(!_ml||!v||!a) return false;
  _ml.boucle=!_ml.boucle;
  _mlMajBoucle();
  if(_ml.boucle){
    try{ v.currentTime=a.debutMs/1000; }catch(e){}
    const p=v.play(); if(p&&typeof p.catch==='function') p.catch(()=>{});
  }
  return true;
}
/** @param {number} i */
async function mlRenommer(i){
  if(!_ml) return false;
  const s=_ml.segments[i];
  if(!s) return false;
  const id=s.id;
  const brut=await rcSaisie('Nom de la répétition',s.label,{libelleOk:'Renommer'});
  const nom=String(brut==null?'':brut).trim().slice(0,SEG_LIBELLE_MAX);
  if(!nom||!_ml) return false;
  _ml.segments=_ml.segments.map(x=>x.id===id?{...x,label:nom}:x);
  _mlMajListe();
  _mlMajEnregistrer();
  return true;
}
/** @param {number} i */
function mlSupprimer(i){
  if(!_ml) return false;
  const s=_ml.segments[i];
  if(!s) return false;
  if(_mlOccupe()) return false;
  _ml.segments=_ml.segments.filter(x=>x.id!==s.id);
  delete _ml.suivis[s.id];
  if(_ml.graine&&_ml.graine.segId===s.id){ _ml.graine=null; _ml.mode='lecture'; }
  if(_ml.actifId===s.id){
    const suivant=_ml.segments[Math.min(i,_ml.segments.length-1)];
    _ml.actifId=suivant?suivant.id:null;
    if(!suivant) _ml.boucle=false;
  }
  _mlMajListe();
  _mlMajBoucle();
  _mlMajEnregistrer();
  return true;
}
/**
 * « ENREGISTRER LA CORRECTION » : les séquences et les tracés, par les chemins
 * d'index.html — le dossier de l'athlète, la garde du coach désigné. L'athlète
 * est prévenu comme pour une correction écrite.
 * @returns {boolean}
 */
function mlEnregistrer(){
  if(!_ml) return false;
  const segs=!mlMemesSegments(_ml.initiaux,_ml.segments), annots=_mlxModifie();
  /** @type {any} */ let envoi=null, ok=true;
  if(segs){
    const r=enregistrerSegmentsVideo(_ml.email,_ml.videoId,_ml.segments);
    if(!r.ok&&r.raison){ toast(r.raison,'var(--orange)'); return false; }
    /** @type {Segment[]} */
    const propres=Array.isArray(r.segments)?r.segments:[];
    _ml.initiaux=propres.map(s=>({...s}));
    _ml.segments=propres.map(s=>({...s}));
    if(_ml.actifId&&!_ml.segments.some(s=>s.id===_ml?.actifId))
      _ml.actifId=_ml.segments.length?_ml.segments[0].id:null;
    ok=ok&&r.ok; envoi=r.envoi;
  }
  if(annots){
    const avant=_ml.annot.a.length, cles=_ml.annot.a.some(a=>Array.isArray(a.k)&&a.k.length);
    const r=enregistrerAnnotationsVideo(_ml.email,_ml.videoId,_ml.annot);
    if(!r.ok&&r.raison){ toast(r.raison,'var(--orange)'); return false; }
    // CE QUE LE PLAFOND A FAIT TOMBER SE DIT : le coach doit l'apprendre
    // autrement qu'en ne le voyant plus.
    /** @type {DocAnnot} */
    const garde=r.annot||_ml.annot;
    if(garde.a.length<avant) toast('Correction trop lourde : '+(avant-garde.a.length)+' tracé(s) n’ont pas tenu.','var(--orange)');
    else if(cles&&!garde.a.some(a=>Array.isArray(a.k)&&a.k.length)) toast('Correction trop lourde : le suivi du mouvement n’a pas tenu.','var(--orange)');
    _ml.annot=garde;
    _ml.annotInit=JSON.stringify(garde);
    if(_ml.sel&&!_mlxAnnot(_ml.sel)) _ml.sel=null;
    ok=ok&&r.ok; envoi=r.envoi;
  }
  if(!segs&&!annots) return false;
  _mlMajListe();
  _mlxMajTout();
  toastSync(ok,envoi,'Correction enregistrée ✓','la correction est');
  return true;
}

// ══ LOT 3 — LA TRAJECTOIRE : L'ANALYSE ET SON AFFICHAGE ═══════════════════════

const ML_PHASES_LIB=Object.freeze({depart:'Départ',pic_vitesse:'Pic de vitesse',
  point_haut:'Point le plus haut',reception:'Réception',point_bas:'Position la plus basse'});
const ML_ALERTES_LIB=Object.freeze({
  fps_bas:'Moins de 60 images par seconde : les vitesses sont moins précises.',
  disque_petit:'Le disque est petit dans l’image : filme plus près, de profil.',
  perte_suivi:'Le suivi a perdu le disque : replace-le sur l’image signalée, puis relance.',
  disque_bord:'Le disque touche le bord de l’image : une partie du mouvement peut manquer.',
  doutes:'Plusieurs images douteuses : la trajectoire est moins fiable.'});
// Au-delà de ce nombre d'images douteuses signalées, la liste ne renseigne plus :
// on montre les premières, c'est là qu'on relance.
const ML_DOUTES_MONTRES=6;

/**
 * Le rectangle où l'image est réellement peinte dans l'élément vidéo
 * (object-fit:contain laisse des bandes), et l'échelle vidéo → écran.
 * @param {HTMLVideoElement} v
 * @returns {{W:number, H:number, s:number, ox:number, oy:number, vw:number, vh:number}|null}
 */
function _mlVideoRect(v){
  const W=v.clientWidth, H=v.clientHeight, vw=v.videoWidth, vh=v.videoHeight;
  if(!(W>0&&H>0&&vw>0&&vh>0)) return null;
  const s=Math.min(W/vw,H/vh);
  return {W,H,s,ox:(W-vw*s)/2,oy:(H-vh*s)/2,vw,vh};
}
/**
 * Poser ou replacer le disque : le doigt se pose au centre et le déplace ; la
 * loupe grossit ce qu'il cache.
 * @param {HTMLElement} calque
 */
function _mlBrancherCalque(calque){
  /** @param {PointerEvent} e */
  const poser=e=>{
    const v=_mlVideo();
    if(!_ml||!v||!_ml.graine||(_ml.mode!=='graine'&&_ml.mode!=='replacer'&&_ml.mode!=='repere')) return;
    const R=_mlVideoRect(v); if(!R) return;
    const b=calque.getBoundingClientRect();
    _ml.graine.x=Math.max(0,Math.min(R.vw,(e.clientX-b.left-R.ox)/R.s));
    _ml.graine.y=Math.max(0,Math.min(R.vh,(e.clientY-b.top-R.oy)/R.s));
    _mlDessinerCalque();
    _mlLoupe(true);
  };
  calque.addEventListener('pointerdown',e=>{
    // PENDANT UNE CORRECTION, LE DOIGT DESSINE : le trait part au journal
    // quand on le lève, entier et simplifié.
    if(_ml&&_ml.rec&&_ml.rec.outil==='dessin'&&!_ml.rec.pause){
      const rec=_ml.rec;
      e.preventDefault();
      try{ calque.setPointerCapture(e.pointerId); }catch(x){}
      /** @param {PointerEvent} ev @returns {number[]|null} */
      const norme=ev=>{
        const v=_mlVideo(); const R=v&&_mlVideoRect(v); if(!R) return null;
        const b=calque.getBoundingClientRect();
        return [Math.max(0,Math.min(1000,Math.round((ev.clientX-b.left-R.ox)/R.s/R.vw*1000))),
                Math.max(0,Math.min(1000,Math.round((ev.clientY-b.top-R.oy)/R.s/R.vh*1000)))];
      };
      const p0=norme(e); if(!p0) return;
      rec.enCours=[p0];
      const bouger=(/** @type {PointerEvent} */ ev)=>{
        const p=norme(ev), l=rec.enCours;
        if(!p||!l) return;
        const q=l[l.length-1];
        if(Math.hypot(p[0]-q[0],p[1]-q[1])>=3){ l.push(p); _mlDessinerCalque(); }
      };
      const fin=()=>{
        calque.removeEventListener('pointermove',bouger);
        calque.removeEventListener('pointerup',fin);
        calque.removeEventListener('pointercancel',fin);
        const l=rec.enCours; rec.enCours=null;
        if(l&&l.length>1) _mlRecTrait(l);
        _mlDessinerCalque();
      };
      calque.addEventListener('pointermove',bouger);
      calque.addEventListener('pointerup',fin);
      calque.addEventListener('pointercancel',fin);
      return;
    }
    // LA LIGNE D'ACTION : deux points sur le câble, et c'est fini. Même
    // geste que l'étalon, même loupe, parce que c'est la même précision
    // qu'on demande au doigt.
    if(_ml&&_ml.mode==='action'){
      const v=_mlVideo(), R=v?_mlVideoRect(v):null;
      if(!R) return;
      e.preventDefault();
      const b=calque.getBoundingClientRect();
      _mlActionPoser(Math.max(0,Math.min(R.vw,(e.clientX-b.left-R.ox)/R.s)),
        Math.max(0,Math.min(R.vh,(e.clientY-b.top-R.oy)/R.s)));
      return;
    }
    // L'ÉTALON : premier toucher, un bout ; second, l'autre. Puis c'est fini.
    if(_ml&&_ml.mode==='etalon'){
      const v=_mlVideo(), R=v?_mlVideoRect(v):null;
      if(!R) return;
      e.preventDefault();
      const b=calque.getBoundingClientRect();
      const x=Math.max(0,Math.min(R.vw,(e.clientX-b.left-R.ox)/R.s));
      const y=Math.max(0,Math.min(R.vh,(e.clientY-b.top-R.oy)/R.s));
      const et=_ml.etalon;
      if(et.ax==null||et.bx!=null) _ml.etalon={...et,ax:x,ay:y,bx:null,by:null};
      else { _ml.etalon={...et,bx:x,by:y}; _ml.mode='lecture'; }
      _mlMajPrise(); _mlDessinerCalque();
      return;
    }
    // LES OUTILS D'ANNOTATION : c'est le mode ordinaire du laboratoire.
    if(_ml&&_ml.mode==='lecture'){ _mlxPointer(e,calque); return; }
    if(!_ml||(_ml.mode!=='graine'&&_ml.mode!=='replacer'&&_ml.mode!=='repere')) return;
    e.preventDefault();
    try{ calque.setPointerCapture(e.pointerId); }catch(x){}
    poser(e);
    const bouger=(/** @type {PointerEvent} */ ev)=>poser(ev);
    const fin=()=>{
      calque.removeEventListener('pointermove',bouger);
      calque.removeEventListener('pointerup',fin);
      calque.removeEventListener('pointercancel',fin);
      _mlLoupe(false);
      _mlMajTrajectoire();
    };
    calque.addEventListener('pointermove',bouger);
    calque.addEventListener('pointerup',fin);
    calque.addEventListener('pointercancel',fin);
  });
}
/**
 * La loupe, en haut à gauche de l'image : trois fois le disque, avec son
 * cercle et sa croix. On y DESSINE depuis la vidéo — permis même pour une
 * vidéo d'une autre origine, puisqu'on n'y lit aucun pixel.
 * @param {boolean} visible
 */
function _mlLoupe(visible){
  const l=_mlEl('ml-loupe'), v=_mlVideo();
  if(!(l instanceof HTMLCanvasElement)) return;
  const g=_ml&&_ml.graine;
  if(!visible||!v||!g||g.x==null||g.y==null){ l.hidden=true; return; }
  l.hidden=false;
  const c=l.getContext('2d'); if(!c) return;
  const cote=g.r*3, L=l.width;
  c.clearRect(0,0,L,L);
  try{ c.drawImage(v,g.x-cote,g.y-cote,2*cote,2*cote,0,0,L,L); }catch(e){}
  const k=L/(2*cote);
  c.strokeStyle=_tok('--arc-current','#4DE8FF'); c.lineWidth=2;
  c.beginPath(); c.arc(L/2,L/2,g.r*k,0,2*Math.PI); c.stroke();
  c.beginPath(); c.moveTo(L/2-8,L/2); c.lineTo(L/2+8,L/2); c.moveTo(L/2,L/2-8); c.lineTo(L/2,L/2+8); c.stroke();
}
/**
 * La trajectoire compactée d'une répétition, relue une seule fois par valeur.
 * @param {Segment} s
 * @returns {{t:number[], x:number[], y:number[], vy:number[], conf:number[]}|null}
 */
function _mlBarreLue(s){
  const b=/** @type {any} */(s).barre;
  if(!_ml||!b) return null;
  const cle=s.id+'|'+b.xy+'|'+b.vy;
  if(_ml.cacheBarre&&_ml.cacheBarre.cle===cle) return _ml.cacheBarre.d;
  try{ const d=mlDecompacterBarre(b); _ml.cacheBarre={cle,d}; return d; }catch(e){ return null; }
}
/**
 * PURE. « 1,83 » : un nombre à la française, avec `dec` décimales.
 * @param {number} v
 * @param {number} dec
 * @returns {string}
 */
function mlNombre(v,dec){
  const x=Number(v);
  return (isFinite(x)?x:0).toFixed(dec).replace('.',',');
}
/**
 * PURE. Une couleur entre deux couleurs hexadécimales.
 * @param {string} a
 * @param {string} b
 * @param {number} f
 * @returns {string}
 */
function mlMelange(a,b,f){
  /** @param {string} h */
  const rgb=h=>{ const m=/^#?([0-9a-f]{6})$/i.exec(String(h).trim()); const n=m?parseInt(m[1],16):0x888888; return [n>>16&255,n>>8&255,n&255]; };
  const x=rgb(a), y=rgb(b), k=Math.max(0,Math.min(1,Number(f)||0));
  return 'rgb('+x.map((c,i)=>Math.round(c+(y[i]-c)*k)).join(',')+')';
}
// Le calque : le disque en cours de pose, ou la trajectoire de la répétition.
function _mlDessinerCalque(){
  const c=_mlEl('ml-calque'), v=_mlVideo();
  if(!_ml||!(c instanceof HTMLCanvasElement)||!v) return;
  const R=_mlVideoRect(v);
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const W=v.clientWidth, H=v.clientHeight;
  if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); }
  c.classList.toggle('ml-calque-actif',_ml.mode==='lecture'||_ml.mode==='graine'||_ml.mode==='replacer'||_ml.mode==='repere'||_ml.mode==='etalon'||_ml.mode==='action'
    ||!!(_ml.rec&&_ml.rec.outil==='dessin'&&!_ml.rec.pause));
  const g=c.getContext('2d'); if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);
  if(!R) return;
  // « VERSION ORIGINALE » : rien par-dessus l'image — sauf un geste en cours
  // de pose, qu'on ne peut pas faire à l'aveugle.
  if(_ml.original&&_ml.mode==='lecture'&&!_ml.rec) return;
  /** @param {number} x @param {number} y @returns {[number,number]} */
  const P=(x,y)=>[R.ox+x*R.s,R.oy+y*R.s];
  const cyan=_tok('--arc-current','#4DE8FF'), calme=_tok('--arc-calm','#6E7A99');
  // L'ÉTALON EN VIOLET : c'est une longueur de référence, pas du mouvement.
  const et=_ml.etalon;
  if(et&&et.ax!=null&&et.ay!=null){
    const [x1,y1]=P(et.ax,et.ay);
    g.strokeStyle=_tok('--arc-charge','#7B3BFF'); g.lineWidth=2;
    g.beginPath(); g.moveTo(x1-7,y1); g.lineTo(x1+7,y1); g.moveTo(x1,y1-7); g.lineTo(x1,y1+7); g.stroke();
    if(et.bx!=null&&et.by!=null){
      const [x2,y2]=P(et.bx,et.by);
      g.beginPath(); g.moveTo(x2-7,y2); g.lineTo(x2+7,y2); g.moveTo(x2,y2-7); g.lineTo(x2,y2+7); g.stroke();
      g.setLineDash([6,4]); g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); g.setLineDash([]);
      g.font='800 12px Montserrat, sans-serif'; g.textAlign='center'; g.textBaseline='bottom';
      const txt=mlNombre(_ml.etalon.cm,1).replace(',0','')+' cm';
      g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.75)'; g.strokeText(txt,(x1+x2)/2,(y1+y2)/2-4);
      g.fillStyle=_tok('--arc-charge','#7B3BFF'); g.fillText(txt,(x1+x2)/2,(y1+y2)/2-4);
      g.textAlign='start'; g.textBaseline='alphabetic';
    }
  }
  // LES POINTS SUIVIS, AVANT LES BRANCHES DE POSE : le coach pose le septième
  // en voyant les six autres, et pose le disque de la barre en les voyant tous.
  const aR=_mlActif();
  if(aR&&!(_ml.rec&&!_ml.rec.trace)){
    const lu=_mlReperesLus(aR);
    if(lu) _mlDessinerReperes(g,R,lu,(Number(v.currentTime)||0)*1000);
  }
  // LE REPÈRE EN COURS DE POSE porte déjà son nom : c'est la légende qu'on
  // verra bouger, et la voir avant de valider évite de nommer à l'aveugle.
  if(_ml.mode==='repere'&&_ml.graine&&_ml.graine.x!=null&&_ml.graine.y!=null){
    const [x,y]=P(_ml.graine.x,_ml.graine.y), r=_ml.graine.r*R.s;
    const col=_mlCouleurTrait(_ml.repere?_ml.repere.couleur:0);
    g.strokeStyle=col; g.lineWidth=2; g.setLineDash([6,4]);
    g.beginPath(); g.arc(x,y,r,0,2*Math.PI); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.moveTo(x-6,y); g.lineTo(x+6,y); g.moveTo(x,y-6); g.lineTo(x,y+6); g.stroke();
    if(_ml.repere) _mlEtiquette(g,x+r+6,y,_ml.repere.nom,col,R.ox+R.vw*R.s-4);
    return;
  }
  if((_ml.mode==='graine'||_ml.mode==='replacer')&&_ml.graine&&_ml.graine.x!=null&&_ml.graine.y!=null){
    const [x,y]=P(_ml.graine.x,_ml.graine.y), r=_ml.graine.r*R.s;
    g.strokeStyle=cyan; g.lineWidth=2; g.setLineDash([6,4]);
    g.beginPath(); g.arc(x,y,r,0,2*Math.PI); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.moveTo(x-6,y); g.lineTo(x+6,y); g.moveTo(x,y-6); g.lineTo(x,y+6); g.stroke();
    return;
  }
  const a=_mlActif();
  const d=a?_mlBarreLue(a):null;
  const tNow=(Number(v.currentTime)||0)*1000;
  // Pendant une correction, le coach peut masquer la trajectoire : le geste
  // est au journal, et l'athlète la verra disparaître au même moment.
  // LOT 12 — LA MEILLEURE ET LA DERNIÈRE, EN FANTÔME. Le mécanisme existe
  // déjà pour la trajectoire complète : on le réutilise plutôt que d'en
  // écrire un second.
  if(/** @type {any} */(_ml).compare){
    /** @type {any[]} */
    let lignes=[];
    try{ lignes=mlTableauSerie(_ml.segments||[],{articulation:_mlArtLue}); }catch(x){}
    const pe=mlPertesSerie(lignes);
    if(pe) for(const i of [pe.iMeilleure,pe.iDerniere]){
      const s2=(_ml.segments||[])[i];
      if(!s2||s2===a) continue;
      const d2=_mlBarreLue(s2);
      if(d2) _mlDessinerTrajectoire(g,R,d2,/** @type {any} */(s2).barre,Infinity,true);
    }
  }
  if(a&&d&&!(_ml.rec&&!_ml.rec.trace)) _mlDessinerTrajectoire(g,R,d,/** @type {any} */(a).barre,tNow,_ml.fantome);
  if(a&&_ml.angCalques.length){
    const S=_mlPoseLue(a);
    if(S) _mlDessinerPose(g,R,S,tNow,_ml.angCalques);
  }
  if(_ml.epingles.length) _mlDessinerEpingles(g,R,_ml.epingles,tNow);
  // LES ANNOTATIONS, par-dessus les mesures : c'est ce que le coach montre.
  // L'ÉCHELLE SE MONTRE tant qu'elle n'est pas enregistrée, puis seulement
  // quand l'outil Échelle est armé : c'est une donnée de calcul, pas un tracé.
  mlDessinerAnnotations(g,R,_ml.annot,tNow,{sel:_ml.sel,poignees:_ml.outil==='selection',
    comparaison:_ml.comparaison,apercu:_mlxApercu(),
    echelle:_ml.outil==='echelle'||!!(_ml.annot.ech&&!_ml.annot.ech.ok)});
  // LE BORD TROUVÉ SEUL, en liseré bleu, tant que l'outil Échelle est armé et
  // que l'échelle n'a pas bougé depuis : le coach voit ce qui a été mesuré.
  const trouve=_ml.echEllipse, ech2=_ml.annot.ech;
  if(_ml.outil==='echelle'&&trouve&&ech2&&trouve.p===ech2.p){
    const sx=R.vw/trouve.w, sy=R.vh/trouve.h;
    g.save(); g.setLineDash([]);
    g.beginPath();
    g.ellipse(R.ox+trouve.cx*sx*R.s,R.oy+trouve.cy*sy*R.s,trouve.a*sx*R.s,trouve.b*sy*R.s,Math.atan2(trouve.uy,trouve.ux),0,2*Math.PI);
    g.lineWidth=3.5; g.strokeStyle='rgba(0,0,0,.55)'; g.stroke();
    g.lineWidth=1.6; g.strokeStyle=cyan; g.stroke();
    g.restore();
  }
  // LA ZONE SUIVIE, pendant le suivi d'une trajectoire : on voit ce que le
  // suiveur regarde.
  if(_ml.mode==='trajsuivi'&&_ml.trajZone){
    const z=_ml.trajZone, zx=R.ox+z.c[0]/1000*R.vw*R.s, zy=R.oy+z.c[1]/1000*R.vh*R.s;
    g.save(); g.setLineDash([4,3]); g.lineWidth=2; g.strokeStyle='rgba(0,0,0,.6)';
    g.beginPath(); g.arc(zx,zy,Math.max(6,z.r*R.s),0,Math.PI*2); g.stroke();
    g.setLineDash([4,3]); g.lineWidth=1.2; g.strokeStyle='#ffffff'; g.stroke(); g.restore();
  }
  if(_ml.rec){
    _mlDessinerTraits(g,R,_ml.rec.traits);
    if(_ml.rec.enCours&&_ml.rec.enCours.length>1) _mlDessinerTraits(g,R,[[_ml.rec.couleur,_ml.rec.enCours]]);
  }
}
/**
 * Une trajectoire compactée sur un calque : progressive jusqu'à `tNow`, en
 * fantôme complète si on le demande, et le disque à l'instant affiché.
 * PARTAGÉE par le laboratoire et le lecteur de correction : le coach et
 * l'athlète voient le même dessin, parce que c'est le même code.
 * @param {CanvasRenderingContext2D} g
 * @param {{s:number, ox:number, oy:number, vw:number, vh:number}} R
 * @param {{t:number[], x:number[], y:number[], vy:number[], conf:number[]}} d
 * @param {any} b  la trajectoire compactée
 * @param {number} tNow  instant de la vidéo source, en ms
 * @param {boolean} fantome
 */
function _mlDessinerTrajectoire(g,R,d,b,tNow,fantome){
  /** @param {number} x @param {number} y @returns {[number,number]} */
  const P=(x,y)=>[R.ox+x*R.s,R.oy+y*R.s];
  const cyan=_tok('--arc-current','#4DE8FF'), calme=_tok('--arc-calm','#6E7A99');
  const vMax=Math.max(0.5,Number(b.m&&b.m.vMax)||0);
  /** @param {boolean} complet */
  const tracer=complet=>{
    for(let i=1;i<d.t.length;i++){
      if(!complet&&d.t[i]>tNow) break;
      if(!isFinite(d.x[i])||!isFinite(d.y[i])||!isFinite(d.x[i-1])||!isFinite(d.y[i-1])) continue;
      const [x1,y1]=P(d.x[i-1]*R.vw,d.y[i-1]*R.vh), [x2,y2]=P(d.x[i]*R.vw,d.y[i]*R.vh);
      const f=isFinite(d.vy[i])?Math.abs(d.vy[i])/vMax:0;
      g.strokeStyle=complet?calme:mlMelange(calme,cyan,f);
      g.globalAlpha=complet?0.35:1;
      g.lineWidth=complet?2:3;
      // UN TRONÇON DOUTEUX SE DESSINE EN POINTILLÉ : on le montre, on ne
      // le fait pas passer pour sûr.
      g.setLineDash(d.conf[i]<ML_CONF_DOUTE?[5,4]:[]);
      g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
    }
    g.globalAlpha=1; g.setLineDash([]);
  };
  if(fantome) tracer(true);
  tracer(false);
  // LE DISQUE À L'INSTANT AFFICHÉ, s'il est dans la trajectoire.
  if(tNow>=d.t[0]&&tNow<=d.t[d.t.length-1]){
    const k=Math.min(d.t.length-1,Math.max(0,Math.round((tNow-d.t[0])/b.pasMs)));
    if(isFinite(d.x[k])&&isFinite(d.y[k])){
      const [x,y]=P(d.x[k]*R.vw,d.y[k]*R.vh);
      g.strokeStyle='#ffffff'; g.lineWidth=2; g.globalAlpha=0.85;
      g.beginPath(); g.arc(x,y,Math.max(6,b.rayonPx*R.s),0,2*Math.PI); g.stroke();
      g.globalAlpha=1;
    }
  }
}
/**
 * Les points suivis : le chemin entier en sourdine, la part déjà lue en pleine
 * couleur, le point à l'instant affiché, et SON NOM à côté de lui.
 * @param {CanvasRenderingContext2D} g
 * @param {{s:number, ox:number, oy:number, vw:number, vh:number}} R
 * @param {{t:number[], pts:{nom:string, c:number, x:number[], y:number[], conf:number[]}[]}} lu
 * @param {number} tNow
 */
function _mlDessinerReperes(g,R,lu,tNow){
  /** @param {number} x @param {number} y @returns {[number,number]} */
  const P=(x,y)=>[R.ox+x*R.s,R.oy+y*R.s];
  const borne=R.ox+R.vw*R.s-4;
  for(const p of lu.pts){
    const col=_mlCouleurTrait(p.c);
    // ⚠ LE CHEMIN S'ARRÊTE OÙ LE SUIVI S'EST PERDU. Une confiance nulle n'est
    //   pas une position : mlSuiviPas rend la dernière connue, indéfiniment.
    //   Prolonger le trait dessinerait un déplacement qui n'a pas eu lieu.
    let fin=p.conf.length;
    for(let i=1;i<p.conf.length;i++){ if(!(p.conf[i]>0)){ fin=i; break; } }
    /** @param {boolean} complet */
    const tracer=complet=>{
      g.strokeStyle=col;
      g.globalAlpha=complet?0.3:1;
      g.lineWidth=complet?2:3;
      for(let i=1;i<fin;i++){
        if(!complet&&lu.t[i]>tNow) break;
        if(!isFinite(p.x[i])||!isFinite(p.y[i])||!isFinite(p.x[i-1])||!isFinite(p.y[i-1])) continue;
        const [x1,y1]=P(p.x[i-1]*R.vw,p.y[i-1]*R.vh), [x2,y2]=P(p.x[i]*R.vw,p.y[i]*R.vh);
        // UN TRONÇON DOUTEUX EN POINTILLÉ, comme la trajectoire de la barre :
        // on le montre, on ne le fait pas passer pour sûr.
        g.setLineDash(p.conf[i]<ML_CONF_DOUTE?[5,4]:[]);
        g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
      }
      g.globalAlpha=1; g.setLineDash([]);
    };
    tracer(true);
    tracer(false);
    // LE POINT ET SON NOM à l'instant affiché — sur la dernière position
    // connue quand la tête de lecture est sortie de la répétition : une
    // légende qui disparaît à l'arrêt ne légende plus rien.
    const pas=lu.t.length>1?(lu.t[1]-lu.t[0]):1;
    const k=Math.max(0,Math.min(fin-1,Math.round((tNow-lu.t[0])/(pas||1))));
    if(isFinite(p.x[k])&&isFinite(p.y[k])){
      const [x,y]=P(p.x[k]*R.vw,p.y[k]*R.vh);
      g.fillStyle=col; g.globalAlpha=0.9;
      g.beginPath(); g.arc(x,y,4,0,2*Math.PI); g.fill();
      g.globalAlpha=1;
      _mlEtiquette(g,x+8,y,p.nom,col,borne);
    }
  }
}
/**
 * Un nom sur l'image, cerné de noir : une vidéo de salle est claire par
 * endroits et sombre par d'autres, et un texte d'une seule couleur s'y perd.
 * @param {CanvasRenderingContext2D} g
 * @param {number} x
 * @param {number} y
 * @param {string} texte
 * @param {string} couleur
 * @param {number} [borneDroite]
 */
function _mlEtiquette(g,x,y,texte,couleur,borneDroite){
  g.font='800 12px Montserrat, sans-serif';
  g.textAlign='start'; g.textBaseline='middle';
  // LE NOM RESTE DANS L'IMAGE : à droite du point d'ordinaire, à sa gauche
  // quand il déborderait — une légende coupée ne légende rien.
  const l=g.measureText(texte).width;
  if(borneDroite!=null&&x+l>borneDroite) x=Math.max(2,x-l-16);
  g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.8)';
  g.strokeText(texte,x,y);
  g.fillStyle=couleur; g.fillText(texte,x,y);
  g.textBaseline='alphabetic';
}
/**
 * Les points suivis d'une répétition, relus une seule fois par valeur.
 * @param {Segment} s
 * @returns {{t:number[], pts:{nom:string, c:number, x:number[], y:number[], conf:number[]}[]}|null}
 */
function _mlReperesLus(s){
  const r=/** @type {any} */(s).reperes;
  if(!_ml||!r||!Array.isArray(r.pts)||!r.pts.length) return null;
  const cle=s.id+'|'+r.n+'|'+r.pts.map((/** @type {any} */ p)=>p.xy).join('|');
  if(_ml.cacheRep&&_ml.cacheRep.cle===cle) return _ml.cacheRep.d;
  try{ const d=mlDecompacterReperes(r); _ml.cacheRep={cle,d}; return d; }catch(e){ return null; }
}
/**
 * La couleur d'un trait : blanc, cyan ou rouge. Jamais le magenta des records.
 * @param {number} i
 * @returns {string}
 */
function _mlCouleurTrait(i){
  return i===1?_tok('--arc-current','#4DE8FF'):i===2?_tok('--red','#E02020'):'#ffffff';
}
/**
 * Des traits à main levée, en coordonnées normées de l'image (0 à 1000).
 * @param {CanvasRenderingContext2D} g
 * @param {{s:number, ox:number, oy:number, vw:number, vh:number}} R
 * @param {[number, string|number[][]][]} traits
 */
function _mlDessinerTraits(g,R,traits){
  g.lineCap='round'; g.lineJoin='round'; g.lineWidth=4; g.setLineDash([]);
  for(const [c,brut] of traits){
    const pts=typeof brut==='string'?mlDecoderTrait(brut):brut;
    if(pts.length<2) continue;
    g.strokeStyle=_mlCouleurTrait(c);
    g.beginPath();
    pts.forEach((p,i)=>{ const x=R.ox+p[0]/1000*R.vw*R.s, y=R.oy+p[1]/1000*R.vh*R.s; if(i) g.lineTo(x,y); else g.moveTo(x,y); });
    g.stroke();
  }
}
// La courbe de vitesse verticale de la répétition, et la tête de lecture.
function _mlDessinerCourbe(){
  const c=_mlEl('ml-courbe'), v=_mlVideo(), a=_mlActif();
  if(!_ml||!(c instanceof HTMLCanvasElement)||!a) return;
  const d=_mlBarreLue(a);
  if(!d) return;
  const W=c.clientWidth||300, H=92, dpr=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){ c.width=Math.round(W*dpr); c.height=Math.round(H*dpr); }
  const g=c.getContext('2d'); if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);
  const vs=d.vy.filter(isFinite);
  const b=/** @type {any} */(a).barre;
  // LE HAUT DE LA COURBE tient compte du sommet ajusté, qui dépasse d'un rien
  // le plus haut point échantillonné : sinon son repère sortirait du cadre.
  const hi=Math.max(0.5,...vs,(b&&b.m&&Number(b.m.vMax))||0), lo=Math.min(-0.5,...vs);
  const X=(/** @type {number} */ t)=>((t-a.debutMs)/Math.max(1,a.finMs-a.debutMs))*W;
  const Y=(/** @type {number} */ val)=>6+(hi-val)/(hi-lo)*(H-18);
  const faint=_tok('--text-faint','#828282');
  g.strokeStyle=faint; g.globalAlpha=0.5; g.lineWidth=1;
  g.beginPath(); g.moveTo(0,Y(0)); g.lineTo(W,Y(0)); g.stroke();
  g.globalAlpha=1;
  g.fillStyle=faint; g.font='600 10px Montserrat, sans-serif'; g.textBaseline='top';
  g.fillText(String(Math.round(hi*10)/10).replace('.',',')+' m/s',4,2);
  g.strokeStyle=_tok('--arc-current','#4DE8FF'); g.lineWidth=2;
  g.beginPath();
  let ouvert=false;
  for(let i=0;i<d.t.length;i++){
    if(!isFinite(d.vy[i])){ ouvert=false; continue; }
    const x=X(d.t[i]), y=Y(d.vy[i]);
    if(ouvert) g.lineTo(x,y); else { g.moveTo(x,y); ouvert=true; }
  }
  g.stroke();
  if(b&&b.m&&isFinite(b.m.tVMax)&&b.m.vMax>0){
    g.fillStyle=_tok('--arc-current','#4DE8FF');
    g.beginPath(); g.arc(X(b.m.tVMax),Y(b.m.vMax),3.5,0,2*Math.PI); g.fill();
  }
  if(v){
    const x=X((Number(v.currentTime)||0)*1000);
    if(x>=0&&x<=W){ g.strokeStyle='#ffffff'; g.lineWidth=1.5; g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); }
  }
}
/**
 * PURE. Les passages douteux d'une trajectoire : les instants où la confiance
 * tombe, regroupés quand ils se suivent. On relance depuis le premier.
 * @param {{t:number, conf:number, etat?:string}[]} points
 * @returns {{tMs:number, conf:number, perdu:boolean}[]}
 */
function mlPassagesDouteux(points){
  /** @type {{tMs:number, conf:number, perdu:boolean}[]} */
  const out=[];
  let dans=false;
  for(const p of points||[]){
    const doute=p.etat==='perdu'||p.etat==='bord'||p.etat==='doute'||p.conf<ML_CONF_DOUTE;
    if(doute&&!dans) out.push({tMs:Math.round(p.t),conf:Math.round(100*p.conf),perdu:p.etat==='perdu'});
    else if(doute&&out.length){
      const q=out[out.length-1];
      q.conf=Math.min(q.conf,Math.round(100*p.conf)); if(p.etat==='perdu') q.perdu=true;
    }
    dans=doute;
  }
  return out;
}
// ══ LE PANNEAU DES POINTS SUIVIS ════════════════════════════════════════════

/**
 * Ce que le lot dit d'un point : perdu quelque part, ou suivi sans conviction.
 * RIEN N'EST CACHÉ — un tracé qu'on croit complet alors qu'il s'arrête au
 * tiers de la répétition fait conclure de travers.
 * @param {Segment} s
 * @param {number} i
 * @returns {string}
 */
function _mlRepEtat(s,i){
  const lu=_mlReperesLus(s);
  const p=lu&&lu.pts[i];
  if(!lu||!p) return '';
  for(let k=1;k<p.conf.length;k++){
    if(!(p.conf[k]>0)) return '<span class="ml-suiv-etat">perdu à '+mlTempsTexte(lu.t[k])+'</span>';
  }
  const doutes=p.conf.filter(c=>c<ML_CONF_DOUTE).length;
  return doutes>0.1*p.conf.length?'<span class="ml-suiv-etat">suivi incertain</span>':'';
}
function _mlMajReperes(){
  const z=_mlEl('ml-pts');
  if(!z||!_ml) return;
  const a=_mlActif();
  if(!a){ z.innerHTML=''; return; }
  const r=/** @type {any} */(a).reperes;
  const n=(r&&r.pts.length)||0;
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Points suivis</span></div>';
  if(_ml.mode==='repere'){
    const g=_ml.repere, pose=!!(_ml.graine&&_ml.graine.x!=null);
    h+='<p class="ml-traj-aide">Touche « '+escapeHtml(g?g.nom:'')+' » sur l’image, au début de la '
        +'répétition. Le point sera suivi jusqu’à la fin, et son déplacement dessiné sous ce nom. '
        +'Ajuste la taille du cercle pour qu’il cerne ce que tu suis, sans plus.</p>'
      +'<label class="ml-champ"><span>Taille du repère</span><input type="range" id="ml-suiv-rayon" min="5" max="'
        +Math.round((_mlVideo()?.videoHeight||720)/6)+'" step="0.5" value="'+(_ml.graine?_ml.graine.r:16)
        +'" oninput="mlRepTaille(this.value)"></label>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-red btn-sm" onclick="mlRepSuivre()"'
        +(pose?'':' disabled')+'>Suivre</button>'
      +'<button type="button" class="btn btn-outline btn-sm" onclick="mlRepAnnuler()">Annuler</button></div>';
  } else if(_ml.mode==='repsuivi'){
    h+='<div class="ml-progres" role="progressbar" aria-label="Suivi en cours"><i id="ml-suiv-barre"></i></div>'
      +'<p class="ml-traj-aide" id="ml-suiv-txt" aria-live="polite">'+escapeHtml(_ml.progres||'Chargement de la vidéo…')+'</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlArreterAnalyse()">Arrêter</button></div>';
  } else {
    const bloque=(_ml.dureeMs&&!_ml.rec)?'':' disabled';
    h+=(n
      ?'<ul class="ml-suiv">'+r.pts.map((/** @type {any} */ p,/** @type {number} */ i)=>
          '<li><i class="ml-suiv-pastille" style="--c:'+_mlCouleurTrait(p.c)+'"></i>'
          +'<b>'+escapeHtml(p.nom)+'</b>'+_mlRepEtat(a,i)
          +'<button type="button" class="ml-mini" onclick="mlRepSupprimer('+i+')" aria-label="Retirer '
          +escapeHtml(p.nom)+'">✕</button></li>').join('')+'</ul>'
      :'<p class="ml-traj-aide">Aucun point suivi. Donne un nom à un endroit de l’image — « trajectoire », '
        +'« genou », « coude » — et son déplacement se dessinera sous ce nom.</p>')
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlRepAjouter()"'
        +(n>=SEG_REP_MAX?' disabled':bloque)+'>Ajouter un point</button></div>'
      // ON DIT CE QUI TIENT ET CE QUI NE TIENT PAS. Le suivi reconnaît un motif
      // d'image : il tient sur ce qui contraste, il décroche sur un aplat. Le
      // coach qui l'apprend après coup accuse l'outil d'être capricieux.
      +'<p class="ml-traj-aide">'+(n>=SEG_REP_MAX?'Six points au plus par répétition. ':'')
        +'Un repère tient sur ce qui CONTRASTE : un disque, un autocollant, une chaussure claire sur un '
        +'sol sombre. Sur un aplat — une peau nue, un vêtement uni — il décroche, et le tracé s’arrête '
        +'là où il a décroché plutôt que d’inventer la suite.</p>';
  }
  z.innerHTML=h+'</div>';
}
/**
 * Nommer un point, puis aller le poser. LE NOM D'ABORD : c'est lui qui fait la
 * légende, et il s'affiche à côté du repère pendant qu'on le place.
 * @returns {Promise<boolean>}
 */
async function mlRepAjouter(){
  if(!_ml||_mlOccupe()||_ml.rec) return false;
  const a=_mlActif();
  if(!a||!_ml.dureeMs) return false;
  const r=/** @type {any} */(a).reperes;
  const pris=r?r.pts.map((/** @type {any} */ p)=>String(p.nom).toLowerCase()):[];
  if(pris.length>=SEG_REP_MAX){ toast('Six points suivis au plus par répétition.','var(--orange)'); return false; }
  const saisi=await rcSaisie('Nom du point','',{placeholder:'trajectoire',libelleOk:'Placer'});
  const nom=String(saisi==null?'':saisi).trim().slice(0,SEG_REP_NOM_MAX);
  if(!nom) return false;
  if(pris.includes(nom.toLowerCase())){
    toast('Un point porte déjà ce nom sur cette répétition.','var(--orange)');
    return false;
  }
  if(!_ml) return false;
  // ON REVIENT AU DÉBUT DE LA RÉPÉTITION, toujours : le suivi va vers la fin,
  // et une graine posée au milieu ne dessinerait que la seconde moitié.
  _mlAller(a.debutMs);
  const v=_mlVideo();
  const cote=Math.min(v&&v.videoWidth?v.videoWidth:720,v&&v.videoHeight?v.videoHeight:720);
  _ml.repere={nom,couleur:pris.length%3};
  _ml.graine={segId:a.id,tMs:a.debutMs,x:null,y:null,r:Math.max(6,Math.round(cote*0.03))};
  _ml.mode='repere';
  _mlMajTrajectoire();
  toast('Touche « '+nom+' » sur l’image.');
  return true;
}
/** @param {any} val */
function mlRepTaille(val){
  const r=Number(val);
  if(!_ml||!_ml.graine||_ml.mode!=='repere'||!(r>=1)) return false;
  _ml.graine={..._ml.graine,r};
  _mlDessinerCalque();
  _mlLoupe(true);
  return true;
}
function mlRepAnnuler(){
  if(!_ml) return false;
  _ml.mode='lecture'; _ml.graine=null; _ml.repere=null;
  _mlLoupe(false);
  _mlMajTrajectoire();
  return true;
}
/**
 * Retirer un point. LE DERNIER RETIRÉ RETIRE LE LOT : on n'écrit pas une liste
 * vide dans un dossier poussé en entier à chaque synchronisation.
 * @param {number} i
 * @returns {Promise<boolean>}
 */
async function mlRepSupprimer(i){
  if(!_ml||_mlOccupe()) return false;
  const a=_mlActif();
  const r=a?/** @type {any} */(a).reperes:null;
  if(!a||!r||!r.pts[i]) return false;
  if(!await rcConfirm('Retirer « '+r.pts[i].nom+' » ?','Son tracé disparaît de cette répétition.','Retirer')) return false;
  if(!_ml) return false;
  const pts=r.pts.filter((/** @type {any} */ _p,/** @type {number} */ k)=>k!==i);
  _ml.segments=_ml.segments.map(s=>{
    if(s.id!==a.id) return s;
    const c=/** @type {any} */({...s});
    if(pts.length) c.reperes={...r,pts}; else delete c.reperes;
    return c;
  });
  _ml.cacheRep=null;
  _mlMajListe();
  _mlMajEnregistrer();
  _mlMajTrajectoire();
  return true;
}
/**
 * Suivre les points de la répétition : ceux qui y sont déjà, plus celui qu'on
 * vient de poser, EN UN SEUL PARCOURS de la vidéo.
 * @returns {Promise<boolean>}
 */
async function mlRepSuivre(){
  if(!_ml||_mlOccupe()) return false;
  const a=_mlActif(), v=_mlVideo();
  if(!a||!v) return false;
  const vw=v.videoWidth, vh=v.videoHeight;
  if(!(vw>0&&vh>0)) return false;
  const deja=/** @type {any} */(a).reperes;
  /** @type {{nom:string, couleur:number, x:number, y:number, r:number}[]} */
  const liste=[];
  if(deja) for(const p of deja.pts) liste.push({nom:p.nom,couleur:p.c,x:p.sx,y:p.sy,r:p.r});
  const g=_ml.graine, nouveau=_ml.repere;
  if(g&&nouveau&&g.x!=null&&g.y!=null) liste.push({nom:nouveau.nom,couleur:nouveau.couleur,x:g.x,y:g.y,r:g.r});
  if(!liste.length) return false;
  // L'IMAGE DE TRAVAIL EST RÉDUITE jusqu'à ce que le PLUS PETIT repère fasse
  // la taille de travail : c'est lui qui décide, réduire plus l'effacerait.
  const ech=Math.min(1,ML_R_TRAVAIL/Math.max(4,Math.min(...liste.map(q=>q.r))));
  const w=Math.max(16,Math.round(vw*ech)), h=Math.max(16,Math.round(vh*ech));
  const ex=w/vw, ey=h/vh;
  const fpsMes=Number(/** @type {any} */(v)._rcFps);
  const pasMs=1000/((isFinite(fpsMes)&&fpsMes>0)?fpsMes:60);
  try{ v.pause(); }catch(e){}
  _ml.mode='repsuivi'; _ml.progres='Chargement de la vidéo…';
  const jeton=++_ml.analyseJeton;
  _mlMajReperes();
  /** @type {PisteRep[]} */
  const pistes=liste.map(q=>({nom:q.nom,couleur:q.couleur,r:q.r,sx:q.x,sy:q.y,points:[]}));
  /** @type {(Suivi|null)[]} */
  const suivis=liste.map(()=>null);
  const total=Math.max(1,Math.ceil((a.finMs-a.debutMs)/pasMs));
  let nb=0;
  const res=await _mlExtraire(_ml.url,a.debutMs,a.finMs,w,h,pasMs,img=>{
    if(!_ml||jeton!==_ml.analyseJeton) return 'arret';
    if(!nb){
      for(let q=0;q<liste.length;q++){
        const s=mlSuiviDemarrer(img.gris,w,h,liste[q].x*ex,liste[q].y*ey,liste[q].r*ex);
        // UN SEUL GABARIT ILLISIBLE ARRÊTE TOUT : on ne rend pas un lot où un
        // point manque sans que son nom apparaisse nulle part.
        if(!s) return 'gabarit';
        suivis[q]=s;
        pistes[q].points.push({tMs:img.tMs,x:liste[q].x,y:liste[q].y,conf:1,etat:'graine'});
      }
    } else {
      for(let q=0;q<liste.length;q++){
        const s=suivis[q];
        if(!s) return 'gabarit';
        const p=mlSuiviPas(s,img.gris,w,h);
        // ⚠ ON NE S'ARRÊTE PAS AU PREMIER POINT PERDU, contrairement à la
        //   trajectoire de la barre : les autres continuent, et toutes les
        //   pistes doivent garder la même longueur pour partager leur base
        //   de temps. Un point perdu est échantillonné à confiance nulle,
        //   et c'est là que son tracé s'arrêtera.
        pistes[q].points.push({tMs:img.tMs,x:p.x/ex,y:p.y/ey,
          conf:p.etat==='perdu'?0:p.conf,etat:p.etat});
      }
    }
    nb++;
    if(nb%3===1){
      _ml.progres='Image '+nb+' sur ~'+total+' · '+mlTempsTexte(img.tMs);
      const t=_mlEl('ml-suiv-txt'); if(t) t.textContent=_ml.progres;
      const bar=_mlEl('ml-suiv-barre'); if(bar) bar.style.transform='scaleX('+Math.min(1,nb/total).toFixed(3)+')';
    }
    return true;
  },()=>!_ml||jeton!==_ml.analyseJeton);
  if(!_ml) return false;
  if(res.ok===false){
    _ml.mode=(res.code==='gabarit'||res.code==='arret')?'repere':'lecture';
    if(_ml.mode==='lecture'){ _ml.graine=null; _ml.repere=null; }
    const msg={cors:'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : le suivi est impossible sur ce fichier.',
      chargement:'La vidéo n’a pas pu être chargée. Vérifie la connexion, puis réessaie.',
      recherche:'La vidéo ne se laisse pas parcourir image par image sur ce téléphone.',
      gabarit:'Le repère est posé sur un aplat : rien ne s’y distingue d’une image à l’autre. Pose-le sur un détail contrasté.',
      arret:'Suivi arrêté.'}[res.code]||'Le suivi a échoué.';
    toast(msg,res.code==='arret'?undefined:'var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  const seg=_ml.segments.find(s=>s.id===a.id);
  if(!seg) return false;
  const compacte=mlCompacterReperes(seg,pistes,{vw,vh});
  const valide=compacte?segReperesValide(compacte,seg.debutMs,seg.finMs):null;
  if(!valide){
    _ml.mode='lecture'; _ml.graine=null; _ml.repere=null;
    toast('Le suivi n’a rien donné de lisible : réessaie.','var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  _ml.segments=_ml.segments.map(s=>s.id===seg.id?/** @type {any} */({...s,reperes:valide}):s);
  _ml.mode='lecture'; _ml.graine=null; _ml.repere=null; _ml.cacheRep=null;
  _mlMajListe();
  _mlMajEnregistrer();
  _mlAller(seg.debutMs);
  // ON NOMME CE QUI S'EST PERDU, ET OÙ : « le suivi a échoué » laisse le coach
  // chercher lequel, sur un tracé qui semble simplement court.
  const perdus=pistes.filter(q=>q.points.some(p=>p.etat==='perdu'));
  if(perdus.length){
    const p0=perdus[0].points.find(p=>p.etat==='perdu');
    toast(perdus.map(q=>'« '+q.nom+' »').join(', ')+(perdus.length>1?' se perdent':' se perd')
      +(p0?' à '+mlTempsTexte(p0.tMs):'')+' : repose'+(perdus.length>1?'-les':'-le')
      +' sur un détail plus contrasté.','var(--orange)');
  }
  return true;
}

// Le panneau de la répétition choisie : poser, analyser, lire le résultat.
function _mlMajTrajectoire(){
  _mlMajPrise();
  _mlMajArticulations();
  _mlMajReperes();
  try{ _mlMajLecture(); }catch(e){}
  const z=_mlEl('ml-traj');
  if(!z||!_ml) return;
  const a=_mlActif();
  if(!a){ z.innerHTML=''; _mlDessinerCalque(); return; }
  const b=/** @type {any} */(a).barre;
  // PENDANT UNE CORRECTION, on ne lance pas d'analyse : elle prend la vidéo,
  // la parcourt image par image, et la séquence enregistrée n'aurait plus de sens.
  const off=(_ml.dureeMs&&!_ml.rec)?'':' disabled';
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Trajectoire de la barre</span>';
  if(_ml.mode==='graine'||_ml.mode==='replacer'){
    const g=_ml.graine, pose=!!(g&&g.x!=null);
    const replacer=_ml.mode==='replacer';
    h+='</div><p class="ml-traj-aide">'+(replacer
        ?'Touche la vraie position du disque sur cette image ('+mlTempsTexte(g?g.tMs:0)+'), puis relance.'
        :'Touche le centre du disque'+(g&&Math.abs(g.tMs-a.debutMs)>20?' — l’analyse part de cette image':'')
          +'. Ajuste sa taille pour que le cercle suive son bord.')+'</p>'
      +(replacer?'':'<label class="ml-champ"><span>Taille du disque</span><input type="range" id="ml-rayon" min="4" max="'
          +Math.round((_mlVideo()?.videoHeight||720)/4)+'" step="0.5" value="'+(g?g.r:20)+'" oninput="mlGraineTaille(this.value)"></label>'
        +'<label class="ml-champ"><span>Diamètre réel</span><span class="ml-cm"><input type="number" id="ml-diam" inputmode="decimal" min="10" max="100" step="0.5" value="'
          +Math.round(_ml.disqueM*1000)/10+'" onchange="mlDisque(this.value)"><i>cm</i></span></label>'
        +'<div class="ml-champ"><span>L’athlète regarde vers</span><span class="ml-choix">'
          +[['gauche','← Gauche'],['droite','Droite →'],['','Je ne sais pas']].map(o=>'<button type="button" class="ml-b" aria-pressed="'
            +(_ml&&_ml.sens===o[0])+'" onclick="mlSens(\''+o[0]+'\')">'+o[1]+'</button>').join('')+'</span></div>')
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-red btn-sm" onclick="'+(replacer?'mlRelancer()':'mlAnalyser()')+'"'
        +(pose?'':' disabled')+'>'+(replacer?'Relancer depuis ici':'Analyser')+'</button>'
      +'<button type="button" class="btn btn-outline btn-sm" onclick="mlAnnulerTrace()">Annuler</button></div>';
  } else if(_ml.mode==='analyse'){
    h+='</div><div class="ml-progres" role="progressbar" aria-label="Analyse en cours"><i id="ml-progres-barre"></i></div>'
      +'<p class="ml-traj-aide" id="ml-progres-txt" aria-live="polite">'+escapeHtml(_ml.progres||'Chargement de la vidéo…')+'</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlArreterAnalyse()">Arrêter</button></div>';
  } else if(!b){
    h+='</div><p class="ml-traj-aide">Pose le disque sur la première image de la répétition : l’analyse le suit '
        +'image par image, sur ce téléphone. Filme de profil, à 60 images par seconde de préférence.</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlTracer()"'+off+'>Tracer la trajectoire</button></div>';
  } else {
    const m=b.m||{}, cm=(/** @type {number} */ x)=>Math.round((x||0)*100)+'\u00a0cm';
    const avant=b.sens==='droite'?m.devPlus:b.sens==='gauche'?m.devMoins:null;
    const arriere=b.sens==='droite'?m.devMoins:b.sens==='gauche'?m.devPlus:null;
    const suivi=_ml.suivis[a.id];
    const doutes=mlPassagesDouteux(suivi
      ?suivi.points.map(p=>({t:p.tMs,conf:p.conf,etat:p.etat}))
      :(()=>{ const d=_mlBarreLue(a); return d?d.t.map((t,i)=>({t,conf:d.conf[i]})):[]; })());
    h+='<button type="button" class="ml-mini ml-refaire" onclick="mlRefaire()" aria-label="Refaire la trajectoire">↺</button></div>'
      // DEUX DÉCIMALES, PAS TROIS : le millième est sous le bruit de l'analyse
      // (quelques pour cent sur la vitesse maximale, mesurés sur des
      // trajectoires de synthèse), et l'afficher promettrait une précision
      // qu'elle n'a pas. Deux décimales suffisent pour comparer deux
      // répétitions filmées pareil : le biais y penche du même côté.
      +'<details class="ml-repli"><summary>Compteurs détaillés</summary>'
      +'<div class="ml-metr">'
        +'<div><b>'+mlNombre(m.vMax,2)+'\u00a0m/s</b><span>Vitesse verticale max'+(m.tVMax?' · '+mlTempsTexte(m.tVMax):'')+'</span></div>'
        +'<div><b>'+mlNombre(m.hMax,2)+'\u00a0m</b><span>Hauteur maximale</span></div>'
        +'<div><b>'+mlNombre(m.depVert,2)+'\u00a0m</b><span>Déplacement vertical total</span></div>'
        +(avant!=null
          ?'<div><b>'+cm(avant)+' · '+cm(arriere||0)+'</b><span>Écart max vers l’avant · l’arrière</span></div>'
          :'<div><b>'+cm(m.devMoins)+' · '+cm(m.devPlus)+'</b><span>Écart max vers la gauche · la droite</span></div>')
        +(m.vert!=null?'<div><b>'+Math.round(m.vert*100)+' %</b><span>Part verticale du chemin'
          +(m.vert<ML_VERTICALITE?' · phases lues le long du chemin':'')+'</span></div>':'')
      +'</div></details>'
      +'<canvas id="ml-courbe" class="ml-courbe" aria-label="Vitesse verticale dans le temps"></canvas>'
      +(b.ph&&b.ph.length?(function(){ const LIB=mlPhasesLib(b.ph); return '<div class="ml-phases">'+b.ph.map((/** @type {[string,number,number]} */ p)=>
          '<button type="button" class="ml-phase" onclick="mlAllerA('+p[1]+')">'
          +escapeHtml(LIB[p[0]]||p[0])+' <i>'+mlTempsTexte(p[1])
          +(p[2]<ML_CONF_DOUTE*100?' · incertain':'')+'</i></button>').join('')+'</div>'; })()
        :'<p class="ml-traj-aide">Aucune phase n’a pu être reconnue sur cette répétition.</p>')
      +'<label class="ml-coche"><input type="checkbox" '+(_ml.fantome?'checked ':'')+'onchange="mlFantome(this.checked)"> Trajectoire complète</label>'
      // LES AVERTISSEMENTS NE BLOQUENT RIEN : ils disent ce qui rend le
      // résultat moins sûr. Le dernier vaut pour toute analyse en deux dimensions.
      +'<ul class="ml-alertes">'
        +(b.av||[]).map((/** @type {string} */ k)=>'<li>'+escapeHtml(ML_ALERTES_LIB[/** @type {keyof typeof ML_ALERTES_LIB} */(k)]||k)+'</li>').join('')
        +'<li>Analyse en 2D : fiable de profil, moins de face ou de trois-quarts.</li></ul>'
      +(doutes.length?'<div class="ml-lab" style="margin-top:12px">Images douteuses</div><div class="ml-phases">'
          +doutes.slice(0,ML_DOUTES_MONTRES).map(p=>'<button type="button" class="ml-phase ml-doute" onclick="mlDouteuse('+p.tMs+')">'
            +mlTempsTexte(p.tMs)+' <i>'+(p.perdu?'perdu':p.conf+'\u00a0%')+'</i></button>').join('')+'</div>':'')
      +(suivi?'<p class="ml-perf">Analysé sur ce téléphone : '+suivi.perf.images+' images en '
          +(Math.round(suivi.perf.ms/100)/10).toString().replace('.',',')+'\u00a0s ('
          +Math.round(suivi.perf.ms/Math.max(1,suivi.perf.images))+'\u00a0ms par image).</p>':'');
  }
  z.innerHTML=h+'</div>';
  _mlDessinerCalque();
  _mlDessinerCourbe();
}


// ══ L'ÉCRAN DES LOTS 9 À 14 ═════════════════════════════════════════════════
//
// Trois phrases en tête, le tableau de la série dessous, et les compteurs
// détaillés dans un repli. On ne retire rien : on hiérarchise.

/** L'articulation lue, et la charge, pour la session. Ni l'une ni l'autre ne
 *  sont enregistrées : ce sont des réglages de LECTURE, pas des mesures. */
let _mlArtLue='hanche';
/** @type {number|null} */
let _mlChargeKg=null;
/** Le cache de lecture, par répétition : mlLecture parcourt toute la série et
 *  le panneau se redessine à chaque geste. @type {Object<string,any>} */
let _mlLectures={};

/** @param {string} cle */
function mlArticulationLue(cle){
  if(!ML_ANGLES.some(q=>q.cle===cle)) return false;
  _mlArtLue=cle; _mlLectures={};
  _mlMajLecture(); _mlMajTrajectoire();
  return true;
}
/** @param {any} v */
function mlChargeKg(v){
  const x=parseFloat(String(v==null?'':v).replace(',','.'));
  _mlChargeKg=(isFinite(x)&&x>0&&x<1000)?x:null;
  _mlLectures={}; _mlMajLecture();
  return true;
}
/** La lecture d'une répétition, calculée une fois puis gardée. */
/** @param {any} seg @returns {any} */
function _mlLecture(seg){
  if(!seg) return null;
  const k=seg.id+'|'+_mlArtLue+'|'+(_mlChargeKg||0)+'|'+((_ml&&_ml.angCote)||'');
  if(_mlLectures[k]) return _mlLectures[k];
  let r=null;
  try{ r=mlLireRepetition(seg,{articulation:_mlArtLue,chargeKg:_mlChargeKg,
    cote:(_ml&&_ml.angCote)||undefined}); }catch(e){ r=null; }
  if(r) _mlLectures[k]=r;
  return r;
}

/**
 * LES TROIS PHRASES, LE TABLEAU DE SÉRIE, ET CE QUI SE TRACE.
 * ⚠ CHAQUE PHRASE EST CLIQUABLE quand elle porte un instant, et chacune entre
 *   dans la correction en une touche — c'est là qu'elle sert.
 */
function _mlMajLecture(){
  const z=_mlEl('ml-lecture');
  if(!z||!_ml) return;
  const a=_mlActif();
  if(!a||!(/** @type {any} */(a).barre)){ z.innerHTML=''; return; }
  const L=_mlLecture(a);
  const segs=_ml.segments||[];
  const lignes=(function(){ try{ return mlTableauSerie(segs,
    {articulation:_mlArtLue,cote:(_ml&&_ml.angCote)||undefined}); }
    catch(e){ return /** @type {any[]} */([]); } })();
  const pertes=(function(){ try{ return mlPertesSerie(lignes); }catch(e){ return null; } })();
  const phrases=mlPhrases({profil:L&&L.profil,angleZone:L&&L.angleZone,couple:L&&L.couple,
    tempo:L&&L.tempo,pertes,articulation:_mlArtLue});
  const enCorrection=!!(_ml.dureeMs&&!_ml.rec);
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Ce que dit cette répétition</span></div>';
  h+='<div class="ml-phrases">'+phrases.map((/** @type {any} */ p,/** @type {number} */ i)=>
    '<div class="ml-phrase'+(p.mesurable?'':' ml-phrase-vide')+'">'
    +(p.tMs!=null
      ?'<button type="button" class="ml-phrase-t" onclick="mlAllerA('+p.tMs+')" aria-label="Aller à cet instant">'
        +mlTempsTexte(p.tMs)+'</button>'
      :'')
    +'<span>'+escapeHtml(p.texte)+'</span>'
    +(p.mesurable&&enCorrection
      ?'<button type="button" class="ml-mini" onclick="mlPhraseCarte('+i+')" aria-label="Ajouter cette phrase à la correction">+</button>'
      :'')
    +'</div>').join('')+'</div>';
  // LA CONVENTION, ÉCRITE DANS L'ÉCRAN. Un coach qui lit « hanche 78° » sans
  // savoir si c'est l'angle intérieur ou la flexion lit un chiffre au hasard.
  h+='<p class="ml-traj-aide">'+escapeHtml(ML_CONVENTION)+'</p>';
  // L'ARTICULATION LUE, ET LA CHARGE. Deux réglages de lecture, pas deux mesures.
  h+='<div class="ml-champ"><span>Articulation lue</span><span class="ml-choix">'
    +ML_ANGLES.filter(q=>q.c).map(q=>'<button type="button" class="ml-b" aria-pressed="'
      +(_mlArtLue===q.cle)+'" onclick="mlArticulationLue(\''+q.cle+'\')">'+escapeHtml(q.nom)+'</button>').join('')
    +'</span></div>'
    +'<label class="ml-champ"><span>Charge externe</span><span class="ml-cm">'
    +'<input type="number" inputmode="decimal" min="1" max="999" step="0.5" value="'
    +(_mlChargeKg==null?'':_mlChargeKg)+'" onchange="mlChargeKg(this.value)"><i>kg</i></span></label>';
  // LA LIGNE D'ACTION. Par défaut la gravité ; le passage en câble est un
  // geste explicite, parce que le deviner fausserait tous les bras de levier
  // d'un coup et dans le même sens.
  const act=/** @type {any} */(a).barre.act;
  const cable=!!(act&&act.mode==='cable');
  h+='<div class="ml-champ"><span>Ligne d’action</span><span class="ml-choix">'
    +'<button type="button" class="ml-b" aria-pressed="'+(!cable)+'" onclick="mlActionLibre()">Charge libre</button>'
    +'<button type="button" class="ml-b" aria-pressed="'+cable+'" onclick="mlActionCable()">Câble ou machine</button>'
    +'</span></div>'
    +(_ml.mode==='action'
      ?'<p class="ml-traj-aide">Touche DEUX points sur le câble, du côté de la charge vers la poulie. '
        +(/** @type {any} */(_ml).action&&/** @type {any} */(_ml).action.p1?'Un point posé, encore un.':'Aucun point posé.')+'</p>'
      :'');
  if(L&&L.profil&&L.profil.couverture>=ML_COUVERTURE_MIN){
    h+='<canvas id="ml-profil" class="ml-courbe" aria-label="Profil de résistance en fonction de l’amplitude"></canvas>'
      +'<p class="ml-traj-aide">Bras de levier rapporté à son maximum, en fonction de l’amplitude '
      +'d’articulation — et non du temps : c’est ce qui rend deux machines superposables. '
      +'Couverture '+Math.round(L.profil.couverture*100)+' %.</p>';
  }
  if(L&&L.repere&&L.repere.n>=3){
    h+='<div class="ml-lab" style="margin-top:12px">Arc autour de l’articulation</div>'
      +'<canvas id="ml-polaire" class="ml-courbe" aria-label="Tracé polaire de la charge autour de l’articulation"></canvas>'
      +'<p class="ml-traj-aide">L’arc imposé fait '+L.repere.arc+'°, et la charge reste entre '
      +Math.round(L.repere.rhoMin*100)+' et '+Math.round(L.repere.rhoMax*100)+' cm de l’articulation. '
      +'C’est une description, pas un verdict : le réglage du siège se juge en salle.</p>';
  }
  if(L&&L.zone&&L.synthese&&L.synthese.length){
    h+='<p class="ml-traj-aide">Point dur : la vitesse creuse de '+Math.round(L.zone.creux*100)
      +' % après le pic, dans le concentrique.</p>';
  } else if(L&&L.r&&!L.zone){
    h+='<p class="ml-traj-aide">Pas de point dur marqué sur cette répétition — c’est une information, '
      +'pas un échec.</p>';
  }
  // LE TABLEAU DE LA SÉRIE. Les répétitions non analysées y sont en ligne
  // VIDE : sans elles, la série lue n'est pas celle qui a été filmée.
  if(lignes.length>1){
    h+='<div class="ml-lab" style="margin-top:14px">La série, répétition par répétition</div>'
      +'<div class="ml-tab" role="table"><div class="ml-tr ml-th" role="row">'
      +['Rép.','V. max','Ampl.','Tempo','Levier max','Au fond'].map(t=>'<span role="columnheader">'+t+'</span>').join('')
      +'</div>'
      +lignes.map((l,i)=>{
        const lu=_mlLecture(segs[i]);
        const marque=(pertes&&i===pertes.iMeilleure)?' ml-tr-best':((pertes&&i===pertes.iDerniere)?' ml-tr-last':'');
        return '<div class="ml-tr'+(l.analysee?'':' ml-tr-vide')+marque+'" role="row">'
          +'<span role="cell">'+escapeHtml(l.label||('#'+(i+1)))+'</span>'
          +'<span role="cell">'+(l.vMax!=null?mlNombre(l.vMax,2)+' m/s':'—')+'</span>'
          +'<span role="cell">'+(l.amplitude!=null?Math.round(l.amplitude*100)+' cm':'—')+'</span>'
          +'<span role="cell">'+(l.tempo&&l.tempo.complet?escapeHtml(mlTempoTexte(l.tempo)):'—')+'</span>'
          +'<span role="cell">'+(lu&&lu.profil&&lu.profil.brasMax!=null?Math.round(lu.profil.brasMax*100)+' cm':'—')+'</span>'
          +'<span role="cell">'+(l.angleFond?escapeHtml(mlAngleTexte(l.angleFond)):'—')+'</span>'
          +'</div>';
      }).join('')+'</div>'
      +(pertes?'<label class="ml-coche"><input type="checkbox" '+(/** @type {any} */(_ml).compare?'checked ':'')
        +'onchange="mlComparerSerie(this.checked)"> Superposer la meilleure et la dernière</label>':'');
  }
  z.innerHTML=h+'</div>';
  _mlDessinerProfil(L);
  _mlDessinerPolaire(L);
}
/** Une phrase de tête, glissée dans la correction en cours. */
/** @param {number} i */
function mlPhraseCarte(i){
  if(!_ml||!_ml.dureeMs) return false;
  const a=_mlActif();
  const L=a?_mlLecture(a):null;
  const lignes=(function(){ try{ return mlTableauSerie(_ml.segments||[],
    {articulation:_mlArtLue}); }catch(e){ return /** @type {any[]} */([]); } })();
  const p=mlPhrases({profil:L&&L.profil,angleZone:L&&L.angleZone,couple:L&&L.couple,
    tempo:L&&L.tempo,pertes:mlPertesSerie(lignes),articulation:_mlArtLue})[i];
  if(!p||!p.mesurable) return false;
  return mlCarteTexte(p.texte);
}
/** @param {boolean} oui */
function mlComparerSerie(oui){
  if(!_ml) return false;
  /** @type {any} */(_ml).compare=!!oui;
  _mlDessinerCalque();
  return true;
}
/** La charge est libre : c'est la gravité qui tire. */
function mlActionLibre(){
  const a=_mlActif();
  if(!a||!(/** @type {any} */(a).barre)) return false;
  delete /** @type {any} */(a).barre.act;
  _ml && (_ml.mode='lecture');
  /** @type {any} */(_ml||{}).action=null;
  _mlLectures={};
  _mlMajLecture(); _mlMajEnregistrer();
  return true;
}
/** Deux points à poser sur le câble. */
function mlActionCable(){
  if(!_ml) return false;
  const a=_mlActif();
  if(!a||!(/** @type {any} */(a).barre)) return false;
  _ml.mode='action';
  /** @type {any} */(_ml).action={p1:null,p2:null};
  _mlMajLecture(); _mlDessinerCalque();
  return true;
}
/**
 * Un point de la ligne d'action, posé à l'écran. Le second referme le geste.
 * @param {number} x @param {number} y  pixels vidéo
 */
function _mlActionPoser(x,y){
  if(!_ml||_ml.mode!=='action') return false;
  const A=/** @type {any} */(_ml).action||{p1:null,p2:null};
  if(!A.p1){ A.p1={x,y}; /** @type {any} */(_ml).action=A; _mlMajLecture(); _mlDessinerCalque(); return true; }
  A.p2={x,y};
  const a=_mlActif();
  if(a&&/** @type {any} */(a).barre){
    // LES DEUX POINTS SONT RANGÉS DANS LE REPÈRE DE L'IMAGE, comme la
    // trajectoire : c'est là qu'ils se dessinent, et mlLecture les redresse
    // au même titre qu'elle.
    /** @type {any} */(a).barre.act={mode:'cable',
      x1:Math.round(A.p1.x*10)/10,y1:Math.round(A.p1.y*10)/10,
      x2:Math.round(x*10)/10,y2:Math.round(y*10)/10};
  }
  _ml.mode='lecture';
  /** @type {any} */(_ml).action=null;
  _mlLectures={};
  _mlMajLecture(); _mlMajEnregistrer(); _mlDessinerCalque();
  return true;
}
/** Le profil de résistance, en fonction de l'amplitude. */
/** @param {any} L */
function _mlDessinerProfil(L){
  const c=_mlEl('ml-profil');
  if(!(c instanceof HTMLCanvasElement)||!L||!L.profil) return;
  const p=L.profil.profil||[];
  if(p.length<3) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const W=c.clientWidth||300, H=c.clientHeight||120;
  c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  const g=c.getContext('2d');
  if(!g) return;
  g.scale(dpr,dpr); g.clearRect(0,0,W,H);
  const pad=10, w=W-2*pad, h=H-2*pad;
  g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1;
  g.beginPath(); g.moveTo(pad,H-pad); g.lineTo(W-pad,H-pad); g.stroke();
  g.beginPath();
  p.forEach((/** @type {{amp:number, tau:number}} */ q,/** @type {number} */ i)=>{
    const x=pad+q.amp/100*w, y=H-pad-q.tau*h;
    i?g.lineTo(x,y):g.moveTo(x,y);
  });
  g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--arc-current').trim()||'#4DE8FF';
  g.lineWidth=2; g.stroke();
  // LE PIC, marqué : c'est le seul point que la phrase de tête nomme.
  const x=pad+L.profil.pic/100*w;
  g.strokeStyle='rgba(255,255,255,.3)'; g.setLineDash([3,3]);
  g.beginPath(); g.moveTo(x,pad); g.lineTo(x,H-pad); g.stroke(); g.setLineDash([]);
}
/** L'arc de la charge autour de l'articulation. */
/** @param {any} L */
function _mlDessinerPolaire(L){
  const c=_mlEl('ml-polaire');
  if(!(c instanceof HTMLCanvasElement)||!L||!L.repere) return;
  const R=L.repere;
  if(R.n<3) return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  const W=c.clientWidth||300, H=c.clientHeight||120;
  c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  const g=c.getContext('2d');
  if(!g) return;
  g.scale(dpr,dpr); g.clearRect(0,0,W,H);
  const cx=W/2, cy=8, rMax=Math.max(R.rhoMax,1e-6), ech=(H-20)/rMax;
  g.strokeStyle='rgba(255,255,255,.12)'; g.lineWidth=1;
  g.beginPath(); g.arc(cx,cy,R.rhoMin*ech,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(cx,cy,R.rhoMax*ech,0,Math.PI*2); g.stroke();
  g.beginPath();
  for(let i=0;i<R.t.length;i++){
    const a=R.phi[i]*Math.PI/180;
    const x=cx+Math.sin(a)*R.rho[i]*ech, y=cy+Math.cos(a)*R.rho[i]*ech;
    i?g.lineTo(x,y):g.moveTo(x,y);
  }
  g.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--arc-charge').trim()||'#7B3BFF';
  g.lineWidth=2; g.stroke();
  g.fillStyle='rgba(255,255,255,.5)';
  g.beginPath(); g.arc(cx,cy,3,0,Math.PI*2); g.fill();
}

// ── Les gestes du panneau ────────────────────────────────────────────────────
/** @param {number} tMs */
function mlAllerA(tMs){
  const v=_mlVideo(); if(!v) return false;
  try{ v.pause(); }catch(e){}
  _mlAller(Number(tMs)||0);
  return true;
}
function mlTracer(){
  const a=_mlActif(), v=_mlVideo();
  if(!_ml||!a||!v||!_ml.dureeMs) return false;
  try{ v.pause(); }catch(e){}
  if(_ml.boucle){ _ml.boucle=false; _mlMajBoucle(); }
  const ms=Math.round((Number(v.currentTime)||0)*1000);
  // LA GRAINE SE POSE SUR LA PREMIÈRE IMAGE de la répétition, sauf si le coach
  // est déjà dedans : il a pu choisir une image où le disque se voit mieux.
  const t=(ms>=a.debutMs&&ms<a.finMs-SEG_MIN_MS)?ms:a.debutMs;
  if(t!==ms) _mlAller(t);
  _ml.mode='graine';
  _ml.graine={segId:a.id,tMs:t,x:null,y:null,r:Math.max(8,Math.round((v.videoHeight||720)*0.05))};
  _mlMajTrajectoire();
  return true;
}
/** @param {string|number} val */
function mlGraineTaille(val){
  if(!_ml||!_ml.graine) return false;
  const r=Number(val);
  if(!(r>0)) return false;
  _ml.graine.r=r;
  _mlDessinerCalque();
  return true;
}
/** @param {string|number} cm */
function mlDisque(cm){
  if(!_ml) return false;
  const v=Number(String(cm).replace(',','.'));
  if(!(v>=10&&v<=100)){ toast('Diamètre entre 10 et 100 cm.','var(--orange)'); _mlMajTrajectoire(); return false; }
  _ml.disqueM=Math.round(v*10)/1000;
  return true;
}
/** @param {string} s */
function mlSens(s){
  if(!_ml) return false;
  _ml.sens=(s==='gauche'||s==='droite')?s:'';
  _mlMajTrajectoire();
  return true;
}
function mlAnnulerTrace(){
  if(!_ml) return false;
  _ml.mode='lecture'; _ml.graine=null;
  _mlLoupe(false);
  _mlMajTrajectoire();
  return true;
}
/** @param {boolean} oui */
function mlFantome(oui){
  if(!_ml) return false;
  _ml.fantome=!!oui;
  _mlDessinerCalque();
  return true;
}
function mlRefaire(){
  const a=_mlActif();
  if(!_ml||!a) return false;
  _ml.segments=_ml.segments.map(s=>s.id===a.id?{id:s.id,label:s.label,debutMs:s.debutMs,finMs:s.finMs}:s);
  delete _ml.suivis[a.id];
  _mlMajEnregistrer();
  return mlTracer();
}
/**
 * Une image douteuse : on s'y rend, et on propose d'y replacer le disque. La
 * position de départ est celle que le suivi croyait — le coach la corrige.
 * @param {number} tMs
 */
function mlDouteuse(tMs){
  const a=_mlActif(), v=_mlVideo();
  if(!_ml||!a||!v) return false;
  const b=/** @type {any} */(a).barre, d=_mlBarreLue(a);
  if(!b||!d) return false;
  try{ v.pause(); }catch(e){}
  _mlAller(tMs);
  const k=Math.max(0,Math.min(d.t.length-1,Math.round((tMs-d.t[0])/b.pasMs)));
  let x=null, y=null;
  for(let j=k;j>=0;j--) if(isFinite(d.x[j])&&isFinite(d.y[j])){ x=d.x[j]*b.vw; y=d.y[j]*b.vh; break; }
  _ml.mode='replacer';
  _ml.graine={segId:a.id,tMs:Math.round(tMs),x,y,r:b.rayonPx};
  _ml.disqueM=b.disqueM; _ml.sens=b.sens;
  _mlMajTrajectoire();
  return true;
}
function mlArreterAnalyse(){
  if(!_ml) return false;
  _ml.analyseJeton++;
  return true;
}
function mlRelancer(){ return mlAnalyser(true); }

/**
 * L'ANALYSE. Extrait les images de la répétition depuis la graine, suit le
 * disque, calcule, compacte. Relancée depuis une image douteuse, elle garde
 * ce qui précède et ne refait que la suite.
 * @param {boolean} [relance]
 * @returns {Promise<boolean>}
 */
async function mlAnalyser(relance){
  const a=_mlActif(), v=_mlVideo();
  if(!_ml||!a||!v||!_ml.graine||_ml.graine.x==null||_ml.graine.y==null) return false;
  const g={..._ml.graine,x:/** @type {number} */(_ml.graine.x),y:/** @type {number} */(_ml.graine.y)};
  const vw=v.videoWidth, vh=v.videoHeight;
  if(!(vw>0&&vh>0)) return false;
  // LA GRAINE EST L'IMAGE AFFICHÉE : la tête a pu bouger depuis qu'elle a été posée.
  g.tMs=Math.max(a.debutMs,Math.min(a.finMs-SEG_MIN_MS,Math.round((Number(v.currentTime)||g.tMs/1000)*1000)));
  // Ce qui précède la graine, quand on relance : le suivi gardé, ou la
  // trajectoire compactée relue.
  /** @type {PointBarre[]} */
  let avant=[];
  const prec=_ml.suivis[a.id], bPrec=/** @type {any} */(a).barre;
  if(relance){
    if(prec) avant=prec.points.filter(p=>p.tMs<g.tMs-1);
    else if(bPrec){
      const d=_mlBarreLue(a);
      if(d) avant=d.t.map((t,i)=>({tMs:t,x:d.x[i]*bPrec.vw,y:d.y[i]*bPrec.vh,conf:d.conf[i],
        etat:/** @type {EtatPoint} */(isFinite(d.x[i])?(d.conf[i]<ML_CONF_DOUTE?'doute':'ok'):'perdu')}))
        .filter(p=>p.tMs<g.tMs-1);
    }
  }
  const rayonPx=relance&&(prec||bPrec)?(prec?prec.rayonPx:bPrec.rayonPx):g.r;
  const disqueM=_ml.disqueM, sens=_ml.sens;
  const ech=Math.min(1,ML_R_TRAVAIL/rayonPx);
  const w=Math.max(16,Math.round(vw*ech)), h=Math.max(16,Math.round(vh*ech));
  const ex=w/vw, ey=h/vh;
  const fpsMes=Number(/** @type {any} */(v)._rcFps);
  const pasMs=1000/((isFinite(fpsMes)&&fpsMes>0)?fpsMes:60);
  try{ v.pause(); }catch(e){}
  _ml.mode='analyse'; _ml.progres='Chargement de la vidéo…';
  const jeton=++_ml.analyseJeton;
  _mlMajTrajectoire();
  /** @type {PointBarre[]} */
  const neufs=[];
  /** @type {Suivi|null} */
  let suivi=null;
  const total=Math.max(1,Math.ceil((a.finMs-g.tMs)/pasMs));
  const res=await _mlExtraire(_ml.url,g.tMs,a.finMs,w,h,pasMs,img=>{
    // ARRÊTÉE PENDANT L'IMAGE : un code, et non false — false est une fin
    // normale, et la moitié de répétition déjà suivie passerait pour entière.
    if(!_ml||jeton!==_ml.analyseJeton) return 'arret';
    if(!suivi){
      suivi=mlSuiviDemarrer(img.gris,w,h,g.x*ex,g.y*ey,rayonPx*ex);
      if(!suivi) return 'gabarit';
      neufs.push({tMs:img.tMs,x:g.x,y:g.y,conf:1,etat:'graine'});
    } else {
      const p=mlSuiviPas(suivi,img.gris,w,h);
      neufs.push({tMs:img.tMs,x:p.x/ex,y:p.y/ey,conf:p.conf,etat:p.etat});
      if(p.etat==='perdu') return false;
    }
    if(neufs.length%3===1){
      _ml.progres='Image '+neufs.length+' sur ~'+total+' · '+mlTempsTexte(img.tMs);
      const t=_mlEl('ml-progres-txt'); if(t) t.textContent=_ml.progres;
      const bar=_mlEl('ml-progres-barre'); if(bar) bar.style.transform='scaleX('+Math.min(1,neufs.length/total).toFixed(3)+')';
    }
    return true;
  },()=>!_ml||jeton!==_ml.analyseJeton);
  // L'écran a été quitté pendant l'analyse : plus rien à mettre à jour.
  if(!_ml) return false;
  const seg=_ml.segments.find(s=>s.id===a.id);
  // ⚠ `res.ok===false` ET NON `!res.ok` : sur une union déclarée en JSDoc,
  // la négation ne restreint pas le type et tout ce qui lit res.code passe
  // pour faux. Vérifié sur un cas minimal, TypeScript 5.9.
  if(res.ok===false){
    _ml.mode='lecture';
    const msg={cors:'L’hébergeur de cette vidéo n’autorise pas la lecture de ses images : l’analyse est impossible sur ce fichier.',
      chargement:'La vidéo n’a pas pu être chargée pour l’analyse. Vérifie la connexion, puis réessaie.',
      recherche:'La vidéo ne se laisse pas parcourir image par image sur ce téléphone.',
      gabarit:'Le disque posé est illisible : pose-le au centre d’un disque bien visible.',
      arret:'Analyse arrêtée.'}[res.code]||'L’analyse a échoué.';
    if(res.code==='gabarit'||res.code==='arret'){ _ml.mode=relance?'replacer':'graine'; }
    else _ml.graine=null;
    toast(msg,res.code==='arret'?undefined:'var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  if(!seg) return false;
  const points=avant.concat(neufs);
  const mpp=_mlMpp(rayonPx);
  if(!(mpp>0)){
    _ml.mode='graine';
    toast('Pose une échelle : un disque, ou deux points sur une longueur connue.','var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  const calc=mlMetriquesBarre(points,mpp,_ml.theta);
  if(!calc){
    _ml.mode='graine';
    toast('Trop peu d’images suivies pour une trajectoire : pose le disque plus précisément.','var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  // LA CADENCE MESURÉE par le sondage ; à défaut, celle du lecteur ; à défaut,
  // aucune alerte sur les images par seconde — on ne l'invente pas.
  const fpsConnu=res.cadenceMesuree?res.fps:((isFinite(fpsMes)&&fpsMes>0)?fpsMes:0);
  const fpsEstime=fpsConnu||res.fps;
  const n=points.length;
  const alertes=[];
  if(fpsConnu&&fpsConnu<55) alertes.push('fps_bas');
  if(rayonPx<10) alertes.push('disque_petit');
  if(points.some(p=>p.etat==='perdu')) alertes.push('perte_suivi');
  if(points.some(p=>p.etat==='bord')) alertes.push('disque_bord');
  if(points.filter(p=>p.etat==='doute'||p.conf<ML_CONF_DOUTE).length>0.1*n) alertes.push('doutes');
  const px=_mlEtalonPx();
  const compacte=mlCompacterBarre(seg,calc,{disqueM,sens,vw,vh,rayonPx,fps:fpsEstime,alertes,
    mpp,theta:_ml.theta,etalon:px>0?{cm:_ml.etalon.cm,px,type:_ml.etalon.type}:_mlEchelleEtalon()});
  const valide=segBarreValide(compacte,seg.debutMs,seg.finMs);
  if(!valide){ _ml.mode='lecture'; toast('La trajectoire calculée est illisible : réessaie.','var(--orange)'); _mlMajTrajectoire(); return false; }
  _ml.segments=_ml.segments.map(s=>s.id===seg.id?{...s,barre:valide}:s);
  _ml.suivis[seg.id]={points,rayonPx,disqueM,vw,vh,fps:fpsEstime,
    perf:{images:res.images,doublons:res.doublons,ms:Math.round(res.ms)}};
  _ml.mode='lecture'; _ml.graine=null; _ml.cacheBarre=null;
  _mlMajListe();
  _mlMajEnregistrer();
  const perdu=neufs.find(p=>p.etat==='perdu');
  if(perdu) toast('Suivi perdu à '+mlTempsTexte(perdu.tMs)+' : replace le disque sur cette image, puis relance.','var(--orange)');
  _mlAller(seg.debutMs);
  return true;
}

// ── L'extraction des images ─────────────────────────────────────────────────
/**
 * PURE. La cadence d'une vidéo, lue sur un sondage fin : `sonde` porte, pour
 * des instants rapprochés, l'empreinte de l'image affichée. Une image commence
 * entre le dernier échantillon de la précédente et le premier des siens ; la
 * période est la médiane des écarts entre débuts. Sans assez de changements
 * (moins de trois débuts), on retombe sur `repliMs` et on le DIT.
 * @param {{t:number, e:number}[]} sonde
 * @param {number} repliMs
 * @returns {{periode:number, origine:number, mesuree:boolean}}
 */
function mlCadence(sonde,repliMs){
  /** @type {number[]} */
  const debuts=[];
  for(let i=1;i<(sonde||[]).length;i++)
    if(sonde[i].e!==sonde[i-1].e) debuts.push((sonde[i].t+sonde[i-1].t)/2);
  // LA PENTE, ET NON UN ÉCART : chaque début n'est connu qu'au pas du sondage
  // (4 ms), mais l'écart entre le premier et le dernier, divisé par le nombre
  // d'images, l'est à 4 ms près sur toute la fenêtre.
  const n=debuts.length;
  const periode=n>=3?(debuts[n-1]-debuts[0])/(n-1):NaN;
  // Une période hors de 1/240 s à 1/15 s n'est pas une cadence vidéo ; un écart
  // qui s'en éloigne de moitié dit qu'une image a été manquée.
  const regulier=n>=3&&debuts.every((d,i)=>!i||Math.abs(d-debuts[i-1]-periode)<periode/2);
  if(!(periode>=1000/240&&periode<=1000/15)||!regulier){
    const p=Number(repliMs)>0?Number(repliMs):1000/60;
    return {periode:p,origine:sonde&&sonde.length?sonde[0].t:0,mesuree:false};
  }
  // L'origine moyenne : la phase de toutes les images, pas celle de la première.
  let o=0;
  for(let i=0;i<n;i++) o+=debuts[i]-i*periode;
  return {periode,origine:o/n,mesuree:true};
}
/**
 * PURE. Une empreinte rapide d'une image, pour reconnaître une image répétée —
 * une vidéo à 30 i/s parcourue au pas de 60 rend chaque image deux fois.
 * @param {Uint8ClampedArray} data
 * @returns {number}
 */
function mlEmpreinte(data){
  let s=0x811c9dc5;
  for(let i=0;i<data.length;i+=4*97){ s^=data[i]+(data[i+1]<<8)+(data[i+2]<<16); s=Math.imul(s,16777619); }
  return s>>>0;
}
/**
 * Amène une vidéo à un instant et attend l'image. Rend l'instant RÉEL de
 * l'image affichée quand le navigateur le donne (requestVideoFrameCallback),
 * l'instant demandé sinon. Une fois qu'il n'a pas répondu, on ne le lui
 * redemande plus : sur une vidéo cachée il ne répond jamais, et l'attendre
 * ralentirait chaque image.
 * @param {HTMLVideoElement} v
 * @param {number} t  secondes
 * @param {{rvfc:boolean}} etat
 * @returns {Promise<number|null>}
 */
function _mlChercherImage(v,t,etat){
  return new Promise(res=>{
    let fini=false;
    /** @param {number|null} m */
    const finir=m=>{ if(fini) return; fini=true; clearTimeout(garde); res(m); };
    const garde=setTimeout(()=>finir(null),5000);
    const apres=()=>{
      const rv=/** @type {any} */(v);
      if(etat.rvfc&&typeof rv.requestVideoFrameCallback==='function'){
        const t2=setTimeout(()=>{ etat.rvfc=false; finir(Number(v.currentTime)); },120);
        rv.requestVideoFrameCallback((/** @type {number} */ _n,/** @type {any} */ meta)=>{ clearTimeout(t2); finir(Number(meta.mediaTime)); });
      } else finir(Number(v.currentTime));
    };
    if(Math.abs((Number(v.currentTime)||0)-t)<1e-4&&v.readyState>=2){ apres(); return; }
    v.addEventListener('seeked',apres,{once:true});
    try{ v.currentTime=t; }catch(e){ finir(null); }
  });
}
/**
 * Parcourt [debutMs, finMs] au pas `pasMs`, en niveaux de gris à w × h. La
 * vidéo est chargée À PART, en crossOrigin anonyme : lire des pixels d'une
 * autre origine exige que l'hébergeur l'autorise, et le dire vaut mieux que
 * rendre un tracé vide.
 * `surImage` rend true pour continuer, false pour s'arrêter, une chaîne pour
 * échouer avec ce code.
 * @param {string} url
 * @param {number} debutMs
 * @param {number} finMs
 * @param {number} w
 * @param {number} h
 * @param {number} pasMs
 * @param {(img:{tMs:number, gris:Float32Array})=>boolean|string} surImage
 * @param {()=>boolean} arreter
 * @returns {Promise<{ok:true, images:number, doublons:number, ms:number, fps:number, cadenceMesuree:boolean}|{ok:false, code:string}>}
 */
async function _mlExtraire(url,debutMs,finMs,w,h,pasMs,surImage,arreter){
  const adresse=safeUrlRaw(url);
  if(adresse==='#') return {ok:false,code:'chargement'};
  const ancien=_mlEl('ml-analyse-src'); if(ancien) ancien.remove();
  const v=document.createElement('video');
  v.id='ml-analyse-src'; v.crossOrigin='anonymous'; v.muted=true; v.playsInline=true; v.preload='auto';
  v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true');
  v.style.cssText='position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  document.body.appendChild(v);
  v.src=adresse;
  const t0=performance.now();
  try{
    const pret=await new Promise(res=>{
      const garde=setTimeout(()=>res(false),20000);
      v.addEventListener('loadeddata',()=>{ clearTimeout(garde); res(true); },{once:true});
      v.addEventListener('error',()=>{ clearTimeout(garde); res(false); },{once:true});
    });
    if(!pret) return {ok:false,code:'chargement'};
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true});
    if(!g) return {ok:false,code:'chargement'};
    const etat={rvfc:false};
    /** @returns {Uint8ClampedArray|null} */
    const lire=()=>{ g.drawImage(v,0,0,w,h); try{ return g.getImageData(0,0,w,h).data; }catch(e){ return null; } };
    // LA CADENCE RÉELLE, AVANT DE PARCOURIR. Viser t = k / fps tombe sur la
    // frontière entre deux images, et le navigateur rend tantôt l'une tantôt
    // l'autre : mesuré sur une vidéo à 60 i/s, 38 doublons, autant d'images
    // sautées, et 6 % d'erreur sur la vitesse. On repère donc les frontières
    // réelles au 1/240 s, puis on vise le MILIEU de chaque image.
    const sonde=[];
    const finSonde=Math.min(finMs,debutMs+125);
    for(let t=debutMs;t<=finSonde;t+=1000/240){
      if(arreter()) return {ok:false,code:'arret'};
      if(await _mlChercherImage(v,t/1000,etat)==null) break;
      const d=lire();
      if(!d) return {ok:false,code:'cors'};
      sonde.push({t,e:mlEmpreinte(d)});
    }
    const cad=mlCadence(sonde,pasMs);
    let precedente=-1, images=0, doublons=0, echecs=0;
    for(let k=Math.ceil((debutMs-cad.origine)/cad.periode-0.5);;k++){
      const t=cad.origine+(k+0.5)*cad.periode;
      if(t>finMs+0.5) break;
      if(t<debutMs-0.5) continue;
      if(arreter()) return {ok:false,code:'arret'};
      const m=await _mlChercherImage(v,t/1000,etat);
      if(m==null){ if(++echecs>5) return {ok:false,code:'recherche'}; continue; }
      echecs=0;
      const data=lire();
      if(!data) return {ok:false,code:'cors'};
      const e=mlEmpreinte(data);
      if(e===precedente){ doublons++; continue; }
      precedente=e;
      // Au dixième de milliseconde : arrondi à la milliseconde, le pas médian
      // d'une vidéo à 60 i/s devenait 17 ms au lieu de 16,67.
      const suite=surImage({tMs:Math.round(t*10)/10,gris:mlGris(data,w,h)});
      images++;
      if(typeof suite==='string') return {ok:false,code:suite};
      if(suite===false) break;
    }
    return {ok:true,images,doublons,ms:performance.now()-t0,fps:1000/cad.periode,cadenceMesuree:cad.mesuree};
  } finally {
    try{ v.removeAttribute('src'); v.load(); }catch(e){}
    v.remove();
  }
}

// ══ LOT 4 — LES ARTICULATIONS : L'ANALYSE ET SON AFFICHAGE ════════════════════

const ML_POSE_DIR='./vendor/mediapipe/';
// DOUZE ÉCHANTILLONS PAR SECONDE. Une articulation ne bouge pas de dix degrés
// en quatre-vingts millisecondes ; à soixante images par seconde on regarderait
// cinq fois la même chose, pour cinq fois l'attente et cinq fois la place. Le
// plafond de SEG_POSE_MAX ramène une répétition de dix secondes à sept par
// seconde — toujours au-dessus de ce qu'un œil distingue sur une courbe.
const ML_POSE_HZ=12;
// TROIS CALQUES À LA FOIS, pas sept : au-delà, les arcs se chevauchent sur
// l'articulation et plus rien ne se lit. Trois couleurs, celles du dessin.
const ML_ANG_MAX=3;

/** Le moteur, chargé une fois par session. @type {any} */
let _mlPose=null;
/** Le chargement en cours, pour que deux demandes n'en fassent pas deux. @type {Promise<any>|null} */
let _mlPosePret=null;

/** @returns {boolean} Une analyse tourne : les répétitions ne bougent pas. */
function _mlOccupe(){ return !!_ml&&(_ml.mode==='analyse'||_ml.mode==='pose'||_ml.mode==='repsuivi'||_ml.mode==='annotsuivi'||_ml.mode==='trajsuivi'); }

/**
 * Le moteur de pose, chargé à la demande. Douze mégaoctets qui ne partent que
 * si le coach demande vraiment ses articulations, et qui restent ensuite dans
 * le cache du service worker — hors ligne compris, en salle.
 * @returns {Promise<any>}
 */
function _mlChargerPose(){
  if(_mlPose) return Promise.resolve(_mlPose);
  if(_mlPosePret) return _mlPosePret;
  _mlPosePret=new Promise((ok,ko)=>{
    if(/** @type {any} */(window).Pose) return ok(null);
    const s=document.createElement('script');
    s.src=ML_POSE_DIR+'pose.js';
    s.onload=()=>ok(null);
    s.onerror=()=>ko(new Error('moteur'));
    document.head.appendChild(s);
  }).then(()=>{
    const P=/** @type {any} */(window).Pose;
    if(typeof P!=='function') throw new Error('moteur');
    const p=new P({locateFile:(/** @type {string} */ f)=>ML_POSE_DIR+f});
    // ⚠ smoothLandmarks À FAUX. Le lissage de MediaPipe suppose un flux continu
    // à cadence vidéo ; ici les images arrivent d'une recherche, à quatre-vingts
    // millisecondes d'écart, et son filtre traînerait derrière le mouvement.
    // On lisse nous-mêmes, sur trois échantillons, et on sait ce que ça coûte.
    p.setOptions({modelComplexity:0,smoothLandmarks:false,enableSegmentation:false,
      minDetectionConfidence:0.5,minTrackingConfidence:0.5});
    _mlPose=p;
    return p;
  }).catch(e=>{ _mlPosePret=null; throw e; });
  return _mlPosePret;
}
/**
 * Parcourt une répétition en visant un instant tous les `pasMs`, et rend chaque
 * image à `surImage`, qui peut être asynchrone.
 * ⚠ CE N'EST PAS _mlExtraire, ET C'EST VOULU : lui parcourt TOUTES les images
 * avec un sondage de cadence, parce qu'un disque qui monte vite se perd dès
 * qu'on lit deux fois la même image. Ici on saute cinq images sur six : deux
 * échantillons voisins ne peuvent pas être la même image, et le sondage ne
 * ferait qu'ajouter une seconde d'attente.
 * @param {string} url
 * @param {number} debutMs
 * @param {number} finMs
 * @param {number} pasMs
 * @param {(im:{tMs:number, toile:HTMLCanvasElement, vw:number, vh:number})=>Promise<boolean|string>|boolean|string} surImage
 * @param {()=>boolean} arreter
 * @returns {Promise<{ok:true, images:number, vw:number, vh:number}|{ok:false, code:string}>}
 */
async function _mlExtrairePose(url,debutMs,finMs,pasMs,surImage,arreter){
  const adresse=safeUrlRaw(url);
  if(adresse==='#') return {ok:false,code:'chargement'};
  const ancien=_mlEl('ml-pose-src'); if(ancien) ancien.remove();
  const v=document.createElement('video');
  v.id='ml-pose-src'; v.crossOrigin='anonymous'; v.muted=true; v.playsInline=true; v.preload='auto';
  v.setAttribute('playsinline',''); v.setAttribute('aria-hidden','true');
  v.style.cssText='position:fixed;width:2px;height:2px;opacity:0;pointer-events:none;left:0;top:0';
  document.body.appendChild(v);
  v.src=adresse;
  try{
    const pret=await new Promise(res=>{
      const garde=setTimeout(()=>res(false),20000);
      v.addEventListener('loadeddata',()=>{ clearTimeout(garde); res(true); },{once:true});
      v.addEventListener('error',()=>{ clearTimeout(garde); res(false); },{once:true});
    });
    if(!pret) return {ok:false,code:'chargement'};
    const vw=v.videoWidth||1280, vh=v.videoHeight||720;
    // SIX CENT QUARANTE PIXELS DE LARGE SUFFISENT : mesuré, le moteur rend les
    // mêmes points à la même vitesse qu'en 720p — il redimensionne lui-même.
    const W=Math.min(640,vw), H=Math.max(1,Math.round(vh*W/vw));
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d');
    if(!g) return {ok:false,code:'chargement'};
    const etat={rvfc:false};
    let images=0, echecs=0;
    for(let t=debutMs;t<=finMs+0.5;t+=pasMs){
      if(arreter()) return {ok:false,code:'arret'};
      if(await _mlChercherImage(v,t/1000,etat)==null){
        if(++echecs>5) return {ok:false,code:'recherche'};
        continue;
      }
      echecs=0;
      g.drawImage(v,0,0,W,H);
      const suite=await surImage({tMs:Math.round(t*10)/10,toile:c,vw:W,vh:H});
      images++;
      if(typeof suite==='string') return {ok:false,code:suite};
      if(suite===false) break;
    }
    return {ok:true,images,vw:W,vh:H};
  } finally {
    try{ v.removeAttribute('src'); v.load(); }catch(e){}
    v.remove();
  }
}
/**
 * Les angles d'une répétition, décompactés une fois et gardés : le dessin les
 * redemande à chaque image de la vidéo.
 * @param {Segment} s
 * @returns {ReturnType<typeof mlAnglesSerie>|null}
 */
function _mlPoseLue(s){
  const p=/** @type {any} */(s).pose;
  if(!_ml||!p) return null;
  const cle=s.id+'|'+p.xy+'|'+(_ml.angCote||p.cote);
  if(_ml.cachePose&&_ml.cachePose.cle===cle) return _ml.cachePose.d;
  try{
    const d=mlAnglesSerie(p,_ml.angCote||p.cote);
    _ml.cachePose={cle,d};
    return d;
  }catch(e){ return null; }
}
/** Lance la lecture des articulations sur la répétition active. */
async function mlAnalyserArticulations(){
  const a=_mlActif();
  if(!_ml||!a||!_ml.dureeMs||_ml.rec||_mlOccupe()) return false;
  const jeton=++_ml.analyseJeton, segId=a.id, debut=a.debutMs, fin=a.finMs;
  const arreter=()=>!_ml||_ml.analyseJeton!==jeton;
  _ml.mode='pose'; _ml.progres='Chargement du moteur…';
  _mlMajTrajectoire();
  let moteur=null;
  try{ moteur=await _mlChargerPose(); }
  catch(e){
    if(!arreter()){
      _ml.mode='lecture';
      toast('Le moteur d’analyse ne s’est pas chargé. La première fois, il lui faut du réseau.','var(--orange)');
      _mlMajTrajectoire();
    }
    return false;
  }
  if(arreter()) return false;
  /** @type {any} */
  let dernier=null;
  moteur.onResults((/** @type {any} */ r)=>{ dernier=r; });
  const pas=Math.max(1000/ML_POSE_HZ,(fin-debut)/(SEG_POSE_MAX-1));
  const total=Math.max(1,Math.floor((fin-debut)/pas)+1);
  /** @type {{tMs:number, X:number[], Y:number[], V:number[]}[]} */
  const ech=[];
  let premiere=true;
  const r=await _mlExtrairePose(_ml.url,debut,fin,pas,async im=>{
    if(arreter()) return 'arret';
    if(premiere){
      premiere=false;
      // LA VIDÉO VIENT D'AILLEURS : si elle teinte la toile, le moteur ne
      // pourra pas la lire non plus. Autant le dire à la première image.
      try{ /** @type {any} */(im.toile.getContext('2d')).getImageData(0,0,1,1); }
      catch(e){ return 'cors'; }
    }
    dernier=null;
    try{ await moteur.send({image:im.toile}); }catch(e){ return 'moteur'; }
    const L=dernier&&dernier.poseLandmarks;
    const X=[], Y=[], V=[];
    for(const idx of ML_POSE_IDX){
      const q=L&&L[idx];
      X.push(q?q.x*im.vw:NaN);
      Y.push(q?q.y*im.vh:NaN);
      V.push(q?Math.max(0,Math.min(1,Number(q.visibility)||0)):0);
    }
    ech.push({tMs:im.tMs,X,Y,V});
    if(_ml&&!arreter()){
      _ml.progres='Articulations : image '+ech.length+' sur '+total+'…';
      const t=_mlEl('ml-progres-txt'); if(t) t.textContent=_ml.progres;
      const bar=_mlEl('ml-progres-barre');
      if(bar) bar.style.transform='scaleX('+Math.min(1,ech.length/total).toFixed(3)+')';
    }
    return ech.length<SEG_POSE_MAX;
  },arreter);
  if(arreter()) return false;
  _ml.mode='lecture';
  // ⚠ `r.ok===false` : voir plus haut, la négation ne restreint pas.
  if(r.ok===false){
    const msg={chargement:'La vidéo ne s’ouvre pas.',
      cors:'Cette vidéo ne se laisse pas lire image par image.',
      recherche:'La vidéo ne se déplace pas image par image ici.',
      moteur:'Le moteur d’analyse s’est arrêté.',arret:''}[r.code];
    if(msg) toast(msg,'var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  if(ech.length<2||!ech.some(e=>e.V.some(x=>x>=ML_POSE_VIS_MIN))){
    toast('Personne n’a été reconnu sur ces images : cadre l’athlète en entier, de profil.','var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  const cote=mlCotePose(ech);
  // L'APLOMB, ESTIMÉ SUR LES MÊMES IMAGES que les articulations : c'est
  // gratuit, et une correction à la main garde la main.
  const hz=mlHorizon(ech), horsPlan=mlHorsPlan(ech);
  if(hz) _ml.thetaAuto=hz;
  if(!_ml.thetaMain&&hz) _ml.theta=hz.theta;
  const pose=segPoseValide(mlCompacterPose({id:segId,label:'',debutMs:debut,finMs:fin},ech,
    {vw:r.vw,vh:r.vh,cote,theta:_ml.theta,hp:horsPlan?horsPlan.deg:null}),debut,fin);
  if(!pose){
    toast('Les articulations calculées sont illisibles : réessaie.','var(--orange)');
    _mlMajTrajectoire();
    return false;
  }
  _ml.segments=_ml.segments.map(s=>s.id===segId?{...s,pose}:s);
  _ml.cachePose=null;
  _ml.angCote='';
  // LE CALQUE OUVERT D'OFFICE est celui qui a le plus bougé : c'est celui qu'on
  // est venu regarder. Aucun calque après une minute d'analyse donnerait un
  // écran qui a l'air vide, et il faudrait deviner lequel ouvrir.
  const met=mlMetriquesAngles(mlAnglesSerie(pose));
  let large='', amp=-1;
  for(const q of ML_ANGLES){
    const x=met[q.cle];
    if(x&&x.max-x.min>amp){ amp=x.max-x.min; large=q.cle; }
  }
  _ml.angCalques=large?[large]:[];
  _mlMajEnregistrer();
  _mlMajTrajectoire();
  _mlDessinerCalque();
  toast('Articulations lues sur '+ech.length+' images.');
  return true;
}
/** Arrête la lecture des articulations en cours. */
function mlArreterPose(){
  if(!_ml||_ml.mode!=='pose') return false;
  _ml.analyseJeton++;
  _ml.mode='lecture';
  _mlMajTrajectoire();
  return true;
}
/** Efface les articulations de la répétition active pour les refaire. */
function mlRefaireArticulations(){
  const a=_mlActif();
  if(!_ml||!a||!(/** @type {any} */(a).pose)||_ml.rec||_mlOccupe()) return false;
  _ml.segments=_ml.segments.map(s=>s.id===a.id?{id:s.id,label:s.label,debutMs:s.debutMs,finMs:s.finMs,
    ...(/** @type {any} */(s).barre?{barre:/** @type {any} */(s).barre}:{})}:s);
  _ml.cachePose=null; _ml.angCalques=[];
  _mlMajEnregistrer(); _mlMajTrajectoire(); _mlDessinerCalque();
  return true;
}
/**
 * Change le côté regardé. Les deux sont enregistrés : on ne relance rien.
 * @param {string} c  'G' ou 'D'
 */
function mlCoteAngles(c){
  if(!_ml||(c!=='G'&&c!=='D')) return false;
  _ml.angCote=c;
  _ml.cachePose=null;
  _mlMajTrajectoire();
  _mlDessinerCalque();
  return true;
}
/**
 * Allume ou éteint un calque d'angle. Pendant un enregistrement, le geste entre
 * au journal : l'athlète verra le calque s'allumer au même instant.
 * @param {string} cle
 */
function mlCalqueAngle(cle){
  const a=_mlActif();
  if(!_ml||!a||!(/** @type {any} */(a).pose)||!ML_ANGLES.some(q=>q.cle===cle)) return false;
  const on=!_ml.angCalques.includes(cle);
  if(on&&_ml.angCalques.length>=ML_ANG_MAX){
    toast('Trois angles à la fois, pas plus : au-delà, les arcs se recouvrent.','var(--orange)');
    return false;
  }
  _ml.angCalques=on?_ml.angCalques.concat([cle]):_ml.angCalques.filter(x=>x!==cle);
  if(_ml.rec&&!_ml.rec.pause) _mlJournal([_mlRecT(),'calque',cle,a.id,on?1:0]);
  _mlMajArticulations();
  _mlDessinerCalque();
  return true;
}
/** Le panneau des articulations, sous celui de la trajectoire. */
function _mlMajArticulations(){
  const z=_mlEl('ml-artic');
  if(!z||!_ml) return;
  // LA GARDE CAPTURÉE : les fonctions fléchées qui suivent ne la voient pas,
  // et `_ml` peut être vidé entre deux par une sortie d'écran.
  const E=_ml;
  const a=_mlActif();
  if(!a){ z.innerHTML=''; return; }
  const p=/** @type {any} */(a).pose;
  const off=(_ml.dureeMs&&!_ml.rec&&!_mlOccupe())?'':' disabled';
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Articulations</span>';
  if(_ml.mode==='pose'){
    h+='</div><div class="ml-progres" role="progressbar" aria-label="Lecture des articulations"><i id="ml-progres-barre"></i></div>'
      +'<p class="ml-traj-aide" id="ml-progres-txt" aria-live="polite">'+escapeHtml(_ml.progres||'Chargement du moteur…')+'</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlArreterPose()">Arrêter</button></div>';
  } else if(!p){
    h+='</div><p class="ml-traj-aide">Le corps est reconnu sur douze images par seconde, sur ce téléphone. '
      +'Filme l’athlète en entier, de profil : un genou qu’on ne voit pas ne donne pas d’angle.</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlAnalyserArticulations()"'+off+'>Lire les articulations</button></div>';
  } else {
    const S=_mlPoseLue(a);
    /** @type {ReturnType<typeof mlMetriquesAngles>} */
    const met=S?mlMetriquesAngles(S):{};
    h+='<button type="button" class="ml-mini ml-refaire" onclick="mlRefaireArticulations()" aria-label="Refaire les articulations"'+off+'>↺</button></div>'
      +'<div class="ml-champ"><span>Côté mesuré</span><span class="ml-choix">'
      +[['G','Gauche'],['D','Droite']].map(o=>'<button type="button" class="ml-b" aria-pressed="'
        +((S?S.cote:p.cote)===o[0])+'" onclick="mlCoteAngles(\''+o[0]+'\')">'+o[1]+'</button>').join('')
      +'</span></div>'
      +'<p class="ml-traj-aide">Touche un angle pour le poser sur la vidéo. '+ML_ANG_MAX+' à la fois.</p>'
      +'<div class="ml-choix ml-ang">'
      +ML_ANGLES.map(q=>{
        const m=met[q.cle], on=E.angCalques.includes(q.cle);
        const i=E.angCalques.indexOf(q.cle);
        return '<button type="button" class="ml-b ml-ang-b" aria-pressed="'+on+'"'+(m?'':' disabled')
          +(on?' style="--c:'+_mlCouleurTrait(i%3)+'"':'')
          +' onclick="mlCalqueAngle(\''+q.cle+'\')">'+q.nom+(m?'':' —')+'</button>';
      }).join('')
      +'</div>';
    const actifs=_ml.angCalques.filter(c=>met[c]);
    const enCorrection=!!(_ml.rec||(_ml.correction&&_ml.correction.statut!=='envoi'&&_ml.correction.statut!=='envoye'));
    if(actifs.length&&enCorrection){
      h+='<div class="ml-choix ml-ang">'+actifs.map(c=>{
        const q=ML_ANGLES.find(x=>x.cle===c);
        return '<button type="button" class="ml-b" onclick="mlEpingler(\''+c+'\')">📌 '+escapeHtml(q?q.nom:c)+'</button>';
      }).join('')+'</div>';
    }
    if(actifs.length){
      h+='<div class="ml-metr">'+actifs.map(c=>{
        const m=met[c], q=ML_ANGLES.find(x=>x.cle===c);
        // ⚠ CONVENTION ANATOMIQUE : un genou tendu vaut 0° de flexion, plié à
        // angle droit 90°. L'angle intérieur, lui, dit l'inverse — et c'est lui
        // qui est stocké, pour que les analyses d'hier restent lisibles.
        const hp=S?S.hp:null;
        const f1=mlFlexion(c,m.min), f2=mlFlexion(c,m.max);
        const lo=mlCorrigerAngle(c,Math.min(Number(f1),Number(f2)),hp==null?undefined:hp);
        const hi=mlCorrigerAngle(c,Math.max(Number(f1),Number(f2)),hp==null?undefined:hp);
        return '<div><b>'+(lo?lo.deg:0)+'°&nbsp;·&nbsp;'+escapeHtml(mlAngleTexte(hi))+'</b><span>'
          +escapeHtml(q?q.nom:c)+' · '+(q&&q.c?'flexion, du moins au plus fléchi':'inclinaison sur la verticale')
          +(hi&&hi.corrige?' · corrigée':' · brute')+'</span></div>';
      }).join('')+'</div>';
    }
    // CE QU'ON N'A PAS VU SE DIT. Une courbe trouée passe sinon pour une
    // courbe plate, et le coach corrigerait un geste sur du vide.
    if(S){
      const manque=ML_ANGLES.filter(q=>E.angCalques.includes(q.cle))
        .map(q=>({q,trous:mlTrousAngles(S.t,S.ang[q.cle])}))
        .filter(x=>x.trous.length);
      if(manque.length){
        h+='<ul class="ml-alertes">'+manque.map(x=>'<li>'+escapeHtml(x.q.nom)+' : non vu '
          +x.trous.map(t=>mlTempsTexte(t.debutMs)+(t.finMs>t.debutMs?'–'+mlTempsTexte(t.finMs):'')).join(', ')+'</li>').join('')+'</ul>';
      }
      h+='<p class="ml-perf">'+p.n+' images lues, '+Math.round(1000/Math.max(1,p.pasMs))+' par seconde.</p>';
    }
  }
  z.innerHTML=h+'</div>';
}
/**
 * Le squelette et les angles demandés, sur l'image courante.
 * PARTAGÉ par le laboratoire et le lecteur de correction.
 * @param {CanvasRenderingContext2D} g
 * @param {{s:number, ox:number, oy:number, vw:number, vh:number}} R
 * @param {ReturnType<typeof mlAnglesSerie>} S
 * @param {number} tNow  instant de la vidéo source, en ms
 * @param {string[]} cles
 */
function _mlDessinerPose(g,R,S,tNow,cles){
  // L'ÉCHANTILLON LE PLUS PROCHE, et rien entre deux : on ne dessine pas une
  // position qu'on n'a pas mesurée. Au-delà d'un pas, on ne montre rien.
  let k=-1, e=Infinity;
  for(let i=0;i<S.t.length;i++){ const d=Math.abs(S.t[i]-tNow); if(d<e){ e=d; k=i; } }
  const pas=S.t.length>1?Math.abs(S.t[1]-S.t[0]):100;
  if(k<0||e>pas) return;
  const X=S.X[k], Y=S.Y[k], V=S.V[k];
  /** @param {number} r @returns {[number,number]} */
  const P=r=>[R.ox+X[r]*R.vw*R.s,R.oy+Y[r]*R.vh*R.s];
  /** @param {number} r */
  const vu=r=>r>=0&&isFinite(X[r])&&isFinite(Y[r])&&V[r]>=ML_POSE_VIS_MIN;
  // LE SQUELETTE EN BASSE TENSION : c'est le repère, pas le propos.
  g.strokeStyle=_tok('--arc-calm','#6E7A99'); g.lineWidth=2; g.globalAlpha=0.85;
  for(const [d1,d2] of ML_POSE_OS){
    const ra=mlRangPose(d1,S.cote), rb=mlRangPose(d2,S.cote);
    if(!vu(ra)||!vu(rb)) continue;
    const [x1,y1]=P(ra), [x2,y2]=P(rb);
    g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke();
  }
  g.globalAlpha=1;
  cles.forEach((cle,i)=>{
    const def=ML_ANGLES.find(q=>q.cle===cle);
    const val=def&&S.ang[cle]?S.ang[cle][k]:null;
    if(!def||val==null) return;
    const ra=mlRangPose(def.a,S.cote), rb=mlRangPose(def.b,S.cote);
    const rc=def.c?mlRangPose(def.c,S.cote):-1;
    if(!vu(ra)||!vu(rb)||(rc>=0&&!vu(rc))) return;
    const c=_mlCouleurTrait(i%3);
    const [bx,by]=P(rb), [ax,ay]=P(ra);
    const [cx,cy]=rc>=0?P(rc):[bx,by-60*R.s];
    g.strokeStyle=c; g.lineWidth=3; g.lineCap='round';
    g.beginPath(); g.moveTo(ax,ay); g.lineTo(bx,by); g.lineTo(cx,cy); g.stroke();
    // LA VERTICALE EST UN REPÈRE, PAS UN MEMBRE : en pointillé, on ne la
    // confond pas avec un os.
    if(rc<0){
      g.setLineDash([5,4]); g.lineWidth=2;
      g.beginPath(); g.moveTo(bx,by); g.lineTo(cx,cy); g.stroke();
      g.setLineDash([]);
    }
    const r=Math.max(14,Math.min(30,26*R.s));
    const a1=Math.atan2(ay-by,ax-bx), a2=Math.atan2(cy-by,cx-bx);
    let d=a2-a1;
    while(d>Math.PI) d-=2*Math.PI;
    while(d<-Math.PI) d+=2*Math.PI;
    g.lineWidth=2;
    g.beginPath(); g.arc(bx,by,r,a1,a1+d,d<0); g.stroke();
    const txt=mlAngleTexte(mlCorrigerAngle(cle,Number(mlFlexion(cle,val)),S.hp==null?undefined:S.hp));
    g.font='800 13px Montserrat, sans-serif'; g.textAlign='center'; g.textBaseline='middle';
    const tx=bx+Math.cos(a1+d/2)*(r+14), ty=by+Math.sin(a1+d/2)*(r+14);
    g.lineWidth=3; g.strokeStyle='rgba(0,0,0,.75)';
    g.strokeText(txt,tx,ty);
    g.fillStyle=c; g.fillText(txt,tx,ty);
  });
  g.lineCap='butt'; g.textAlign='start'; g.textBaseline='alphabetic';
}

// ── LE PANNEAU « PRISE DE VUE » (lot 8) ─────────────────────────────────────
//
// Ce panneau ne parle pas du mouvement : il parle de la VIDÉO. Il vient avant
// les analyses parce que tout ce qu'elles diront en dépend — un téléphone
// penché, une prise de vue de trois-quarts ou une échelle fausse se propagent
// partout, dans le même sens, sans jamais se voir.

// LES ÉTALONS PROPOSÉS. Le disque n'est plus qu'un cas : l'essentiel du
// bodybuilding se fait sur machine, où il n'y en a pas. Les longueurs sont des
// ordres de grandeur courants, et restent modifiables — c'est le coach qui sait
// ce qu'il a sous les yeux.
const ML_ETALONS=Object.freeze([
  {cle:'disque45',nom:'Disque olympique',cm:45},
  {cle:'disque40',nom:'Disque 40 cm',cm:40},
  {cle:'banc',nom:'Hauteur de banc',cm:45},
  {cle:'barre',nom:'Barre (bague à bague)',cm:131},
  {cle:'taille',nom:'Taille de l’athlète',cm:0},
  {cle:'repere',nom:'Repère collé',cm:20}
]);

/**
 * L'échelle en mètres par pixel de la vidéo : l'étalon posé s'il existe,
 * puis l'échelle de l'outil Échelle, le disque suivi sinon. Rend 0 quand rien
 * ne permet de mesurer.
 * ⚠ L'ÉCHELLE DE L'OUTIL PASSE AVANT LE DISQUE SUIVI (build 1391) : son
 *   diamètre est celui d'une fiche, et ses deux bouts sont pointés à la
 *   loupe ; le rayon du disque suivi, lui, se règle au curseur.
 * @param {number} [rayonPx]  le rayon du disque suivi, quand on l'a
 * @returns {number}
 */
function _mlMpp(rayonPx){
  if(!_ml) return 0;
  const px=_mlEtalonPx();
  if(px>0&&_ml.etalon.cm>0) return _ml.etalon.cm/100/px;
  const ech=_mlEchelleEtalon();
  if(ech) return ech.cm/100/ech.px;
  const r=Number(rayonPx);
  return (r>0&&_ml.disqueM>0)?_ml.disqueM/(2*r):0;
}
/**
 * La taille de la vidéo en pixels — celle que lit le dessin (_mlVideoRect),
 * pour que le panneau, l'enregistrement et le calque comptent les mêmes
 * pixels.
 * @returns {{vw:number, vh:number}}
 */
function _mlxTailleVideo(){
  const v=_mlVideo(), R=v?_mlVideoRect(v):null;
  if(R) return {vw:R.vw,vh:R.vh};
  return {vw:(v&&v.videoWidth)||0,vh:(v&&v.videoHeight)||0};
}
/**
 * L'échelle de l'outil Échelle, sous la forme d'un étalon {cm, px, type} :
 * c'est ainsi qu'une trajectoire de barre la garde, et la relit.
 * @returns {{cm:number, px:number, type:string}|null}
 */
function _mlEchelleEtalon(){
  const e=_ml&&_ml.annot&&_ml.annot.ech;
  const {vw,vh}=_mlxTailleVideo();
  if(!e||!mlEchelleMmPx(e,vw,vh)) return null;
  return {cm:Math.round(Number(e.mm))/10,px:Math.round(mlEchellePx(e,vw,vh)*10)/10,type:'echelle'};
}
/** La longueur, en pixels, entre les deux points de l'étalon. */
function _mlEtalonPx(){
  const e=_ml&&_ml.etalon;
  if(!e||e.ax==null||e.ay==null||e.bx==null||e.by==null) return 0;
  return Math.hypot(e.bx-e.ax,e.by-e.ay);
}
/**
 * Choisit un préréglage d'étalon. « Taille de l'athlète » prend la taille du
 * dossier — et la présente comme une ESTIMATION : une taille déclarée, mesurée
 * chaussures aux pieds ou non, ne vaut pas un mètre ruban sur un banc.
 * @param {string} cle
 */
function mlEtalonType(cle){
  if(!_ml) return false;
  const p=ML_ETALONS.find(x=>x.cle===cle);
  if(!p) return false;
  let cm=p.cm;
  if(cle==='taille'){
    const u=(DB.get('users')||{})[_ml.email];
    const t=u?_tailleCm(u):null;
    if(!t){ toast('La taille de cet athlète n’est pas renseignée.','var(--orange)'); return false; }
    cm=t;
  }
  _ml.etalon={..._ml.etalon,type:cle,cm};
  if(cle==='disque45'||cle==='disque40') _ml.disqueM=cm/100;
  _mlMajPrise();
  return true;
}
/** @param {string|number} v */
function mlEtalonCm(v){
  if(!_ml) return false;
  const cm=Number(String(v).replace(',','.'));
  if(!(cm>=1&&cm<=1000)){ toast('Longueur entre 1 et 1000 cm.','var(--orange)'); _mlMajPrise(); return false; }
  _ml.etalon={..._ml.etalon,cm:Math.round(cm*10)/10};
  _mlMajPrise();
  return true;
}
/** Passe en pose d'étalon : deux touchers sur une longueur connue. */
function mlEtalonPoser(){
  if(!_ml||_mlOccupe()) return false;
  _ml.mode='etalon';
  _ml.etalon={..._ml.etalon,ax:null,ay:null,bx:null,by:null};
  _mlMajPrise();
  _mlDessinerCalque();
  return true;
}
function mlEtalonEffacer(){
  if(!_ml) return false;
  _ml.etalon={..._ml.etalon,ax:null,ay:null,bx:null,by:null};
  if(_ml.mode==='etalon') _ml.mode='lecture';
  _mlMajPrise();
  _mlDessinerCalque();
  return true;
}
/**
 * L'aplomb retenu, corrigé à la main. ⚠ UNE CORRECTION MANUELLE PRIME SUR
 * L'ESTIMATION et ne se fait pas écraser par une analyse suivante : le coach
 * voit l'image, le modèle ne voit que des points.
 * @param {string|number} deg
 */
function mlAplomb(deg){
  if(!_ml) return false;
  const d=Math.max(-ML_APLOMB_MAX,Math.min(ML_APLOMB_MAX,Number(deg)||0));
  _ml.theta=Math.round(d*10)/10;
  _ml.thetaMain=true;
  _mlAplombPoser();
  return true;
}
/** Reprend l'aplomb estimé, quand il existe. */
function mlAplombAuto(){
  if(!_ml) return false;
  _ml.theta=_ml.thetaAuto?_ml.thetaAuto.theta:0;
  _ml.thetaMain=false;
  _mlAplombPoser();
  return true;
}
/**
 * Pose l'aplomb courant sur les analyses DÉJÀ faites de cette vidéo : elles ont
 * été calculées dans le repère de l'image, et c'est à la lecture qu'on redresse.
 * Rien n'est recalculé — seul l'angle change, et tout ce qui en dépend.
 */
function _mlAplombPoser(){
  if(!_ml) return;
  const th=_ml.theta;
  _ml.segments=_ml.segments.map(s=>{
    const o={...s};
    const b=/** @type {any} */(o).barre, p=/** @type {any} */(o).pose;
    if(b) /** @type {any} */(o).barre={...b,theta:th};
    if(p) /** @type {any} */(o).pose={...p,theta:th};
    return o;
  });
  _ml.cachePose=null; _ml.cacheBarre=null;
  _mlMajPrise();
  _mlMajEnregistrer();
  _mlMajTrajectoire();
  _mlDessinerCalque();
}
/**
 * LE CONTRÔLE DE PRISE DE VUE, sur dix images. Il tourne AVANT l'analyse et ne
 * coûte qu'une seconde ; l'analyse, elle, en coûte soixante. Il ne bloque
 * jamais : il dit ce qu'il voit, et le coach décide.
 * @returns {Promise<boolean>}
 */
async function mlVerifierPriseDeVue(){
  const a=_mlActif(), v=_mlVideo();
  if(!_ml||!a||!v||!_ml.dureeMs||_ml.rec||_mlOccupe()) return false;
  const jeton=++_ml.analyseJeton;
  const arreter=()=>!_ml||_ml.analyseJeton!==jeton;
  _ml.mode='pose'; _ml.progres='Contrôle de la prise de vue…';
  _ml.prise={etat:'encours',res:null,ms:0};
  _mlMajPrise();
  let moteur=null;
  try{ moteur=await _mlChargerPose(); }
  catch(e){
    if(!arreter()){ _ml.mode='lecture'; _ml.prise=null;
      toast('Le moteur d’analyse ne s’est pas chargé. La première fois, il lui faut du réseau.','var(--orange)');
      _mlMajPrise(); }
    return false;
  }
  if(arreter()) return false;
  const t0=performance.now();
  /** @type {any} */
  let dernier=null;
  moteur.onResults((/** @type {any} */ r)=>{ dernier=r; });
  /** @type {{X:number[], Y:number[], V:number[]}[]} */
  const ech=[];
  // DIX IMAGES SUR LA RÉPÉTITION : assez pour juger un cadrage, et c'est le
  // minimum qu'exige l'estimation d'aplomb.
  const pas=Math.max(1,(a.finMs-a.debutMs)/9);
  const r=await _mlExtrairePose(_ml.url,a.debutMs,a.finMs,pas,async im=>{
    if(arreter()) return 'arret';
    dernier=null;
    try{ await moteur.send({image:im.toile}); }catch(e){ return 'moteur'; }
    const L=dernier&&dernier.poseLandmarks;
    const X=[], Y=[], V=[];
    for(const idx of ML_POSE_IDX){
      const q=L&&L[idx];
      X.push(q?q.x*im.vw:NaN); Y.push(q?q.y*im.vh:NaN);
      V.push(q?Math.max(0,Math.min(1,Number(q.visibility)||0)):0);
    }
    ech.push({X,Y,V});
    return ech.length<10;
  },arreter);
  if(arreter()) return false;
  _ml.mode='lecture';
  if(r.ok===false){
    _ml.prise=null;
    const msg={chargement:'La vidéo ne s’ouvre pas.',cors:'Cette vidéo ne se laisse pas lire image par image.',
      recherche:'La vidéo ne se déplace pas image par image ici.',
      moteur:'Le moteur d’analyse s’est arrêté.',arret:''}[r.code];
    if(msg) toast(msg,'var(--orange)');
    _mlMajPrise();
    return false;
  }
  const fpsMes=Number(/** @type {any} */(v)._rcFps);
  const res=mlControlePriseDeVue(ech,{vw:r.vw,vh:r.vh,fps:(isFinite(fpsMes)&&fpsMes>0)?fpsMes:0,
    fpsMesure:isFinite(fpsMes)&&fpsMes>0});
  _ml.prise={etat:'fait',res,ms:Math.round(performance.now()-t0)};
  // L'APLOMB ESTIMÉ SUR LES MÊMES IMAGES — et gardé seulement si le coach n'a
  // pas déjà tranché à la main.
  _ml.thetaAuto=mlHorizon(ech);
  if(!_ml.thetaMain){
    _ml.theta=_ml.thetaAuto?_ml.thetaAuto.theta:0;
    _mlAplombPoser();
  }
  _mlMajPrise();
  return true;
}
/** Le panneau : contrôle, aplomb, étalon. */
function _mlMajPrise(){
  const z=_mlEl('ml-prise');
  if(!z||!_ml) return;
  const E=_ml;
  const off=(E.dureeMs&&!E.rec&&!_mlOccupe())?'':' disabled';
  const p=E.prise;
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Prise de vue</span>'
    +(p&&p.etat==='fait'?'<span class="ml-niv ml-niv-'+p.res.niveau+'">'
      +(/** @type {Object<string,string>} */({ok:'Exploitable',reserve:'Avec réserve',refilmer:'À refilmer'})[p.res.niveau])+'</span>':'')
    +'</div>';
  if(p&&p.etat==='encours'){
    h+='<p class="ml-traj-aide" aria-live="polite">Contrôle en cours sur dix images…</p>';
  } else if(p&&p.etat==='fait'){
    h+='<ul class="ml-alertes ml-prise-l">'+p.res.points.map((/** @type {any} */ q)=>
      '<li class="ml-pt-'+q.etat+'">'+escapeHtml(q.phrase)+'</li>').join('')+'</ul>'
      +'<p class="ml-perf">Dix images, '+p.ms+' ms. Ce verdict porte sur la vidéo, jamais sur le mouvement.</p>';
    if(p.res.niveau==='refilmer')
      h+='<p class="ml-traj-aide">Une analyse reste possible : elle sera simplement moins sûre.</p>';
  } else {
    h+='<p class="ml-traj-aide">Dix images suffisent à dire si la vidéo se laisse mesurer : profil, cadrage, '
      +'aplomb, cadence. Une seconde, contre une minute pour l’analyse complète.</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlVerifierPriseDeVue()"'+off+'>Vérifier la prise de vue</button></div>';
  }
  // ── L'APLOMB ──
  const auto=E.thetaAuto;
  h+='<div class="ml-lab" style="margin-top:14px">Aplomb</div>'
    +'<p class="ml-traj-aide">'+(E.thetaMain
      ?'Corrigé à la main : c’est cette valeur qui sert.'
      :auto
        ?'Estimé sur le bassin de '+auto.n+' images (±'+Math.round(auto.ecartType)+'°).'
        :'Non estimé — il vaut zéro. De profil, une hanche cache l’autre et le bassin ne dit plus rien : '
          +'corrige au doigt si le téléphone était penché.')+'</p>'
    +'<label class="ml-champ"><span>Redressement</span>'
      +'<input type="range" id="ml-aplomb" min="'+(-ML_APLOMB_MAX)+'" max="'+ML_APLOMB_MAX+'" step="1" '
      +'value="'+E.theta+'" aria-label="Aplomb, en degrés" oninput="mlAplomb(this.value)"></label>'
    +'<div class="ml-champ"><span>'+Math.round(E.theta)+'°</span>'
      +'<span class="ml-choix">'
      +(auto?'<button type="button" class="ml-b" onclick="mlAplombAuto()">Reprendre l’estimation</button>':'')
      +'<button type="button" class="ml-b" onclick="mlAplomb(0)">Remettre à zéro</button></span></div>';
  // ── L'ÉTALON ──
  const e=E.etalon, px=_mlEtalonPx();
  const pose=E.mode==='etalon';
  h+='<div class="ml-lab" style="margin-top:14px">Échelle</div>'
    +'<p class="ml-traj-aide">'+(pose
      ?'Touche les deux bouts de la longueur connue sur l’image.'
      :px?'Mesurée sur '+Math.round(px)+' pixels : '+mlNombre(e.cm,1).replace(',0','')+' cm, soit '
        +mlNombre(100*_mlMpp(),2)+' cm par pixel.'
      :_mlEchelleEtalon()?'Sans étalon ici, l’échelle vient de l’outil Échelle (onglet Tracé) : '
        +mlNombre(100*_mlMpp(),2)+' cm par pixel.'
      :'Sans étalon, l’échelle vient du disque suivi et de son diamètre. Sur machine, pose deux points '
        +'sur une longueur que tu connais — ou l’outil Échelle, dans l’onglet Tracé.')+'</p>'
    +'<div class="ml-champ"><span>Étalon</span><span class="ml-choix">'
      +ML_ETALONS.map(x=>'<button type="button" class="ml-b" aria-pressed="'+(e.type===x.cle)+'" '
        +'onclick="mlEtalonType(\''+x.cle+'\')">'+escapeHtml(x.nom)+'</button>').join('')+'</span></div>'
    +'<label class="ml-champ"><span>Longueur réelle</span><span class="ml-cm">'
      +'<input type="number" id="ml-etalon-cm" inputmode="decimal" min="1" max="1000" step="0.5" value="'
      +(e.cm||'')+'" onchange="mlEtalonCm(this.value)"><i>cm</i></span></label>'
    +(e.type==='taille'?'<p class="ml-traj-aide">⚠ Une taille déclarée est une ESTIMATION, pas une mesure : '
      +'l’échelle qui en découle l’est aussi.</p>':'')
    +'<div class="ml-traj-cmd">'
      +'<button type="button" class="btn btn-outline btn-sm" onclick="mlEtalonPoser()"'+off+'>'
      +(px?'Reposer les deux points':'Poser deux points')+'</button>'
      +(px?'<button type="button" class="btn btn-outline btn-sm" onclick="mlEtalonEffacer()">Revenir au disque</button>':'')
    +'</div>';
  z.innerHTML=h+'</div>';
}

// ══ LOTS 5 ET 6 — LA CORRECTION VIDÉO : ENREGISTRER, COMPOSER, REJOUER ════════
//
// Voir le modèle dans index.html (motionCorrectionValide) : une séquence
// REJOUÉE, pas un MP4. Le coach parle pendant qu'il manipule la vidéo ; chaque
// geste part au journal sur l'horloge de la session, qui s'arrête quand il met
// l'enregistrement en pause. L'athlète revoit sa vidéo pilotée par ce journal,
// sous la voix du coach.

/**
 * Un geste du journal — union discriminée par son deuxième élément.
 * @typedef {[number,'lecture']|[number,'pause']|[number,'effacer']|[number,'aller',number]
 *   |[number,'vitesse',number]|[number,'trait',number,string]|[number,'calque',string,string,number]} Geste
 */
/** @typedef {{id:string, aMs:number, dureeMs:number, texte:string}} Carte */
/** @typedef {{id:string, aMs:number, art:string, val:number, tol:number}} Epingle */
/**
 * @typedef {{v:1, id:string, creeLe:number, envoyeLe:number, dureeMs:number,
 *   voix:{url:string}|null, debut:{s:number, r:number}, ev:Geste[], cartes:Carte[],
 *   epingles?:Epingle[], st?:{t:number, x:string}[]}} Correction
 */
/**
 * L'état d'un enregistrement en cours.
 * @typedef {{t0:number, pause:boolean, pauseDebut:number, pauseTotal:number, ev:Geste[],
 *   debut:{s:number, r:number}, media:MediaRecorder|null, flux:MediaStream|null, morceaux:Blob[],
 *   outil:'dessin'|null, couleur:number, traits:[number,string][], enCours:number[][]|null,
 *   st:{t:number, x:string}[], reco:any,
 *   trace:boolean, minuteur:number, plein:boolean}} Enregistrement
 */

// Les modèles de cartes proposés tant que le coach n'a pas les siens.
const ML_MODELES_DEFAUT=Object.freeze(['Garde les coudes hauts','Pousse avec les jambes plus longtemps',
  'Barre plus près du corps','Reste sur les talons plus longtemps','Verrouille en haut avant de redescendre']);
const ML_MODELES_MAX=12;
const ML_DUREES_CARTE=Object.freeze([2000,3000,5000]);

/**
 * PURE. L'état de la séquence à l'instant T de la session : lecture ou pause,
 * vitesse, position dans la vidéo source, traits visibles, trajectoires
 * affichées. C'est LA règle du rejeu — le lecteur n'en a pas d'autre.
 * @param {{s:number, r:number}} debut
 * @param {Geste[]} ev  triés par instant
 * @param {number} T
 * @returns {{jouer:boolean, r:number, s:number, traits:[number,string][], calques:Object<string,boolean>}}
 */
function mlEtatRejeu(debut,ev,T){
  let jouer=false, r=Number(debut&&debut.r)||1, s=Number(debut&&debut.s)||0, tRef=0;
  /** @type {[number,string][]} */ let traits=[];
  /** @type {Object<string,boolean>} */ const calques={};
  for(const e of ev||[]){
    if(e[0]>T) break;
    if(jouer) s+=(e[0]-tRef)*r;
    tRef=e[0];
    switch(e[1]){
      case 'lecture': jouer=true; break;
      case 'pause': jouer=false; break;
      case 'aller': s=e[2]; break;
      case 'vitesse': r=e[2]; break;
      case 'trait': traits.push([e[2],e[3]]); break;
      case 'effacer': traits=[]; break;
      case 'calque': calques[e[2]+'|'+e[3]]=e[4]===1; break;
    }
  }
  if(jouer) s+=(T-tRef)*r;
  return {jouer,r,s:Math.max(0,s),traits,calques};
}
/**
 * PURE. Ajoute un geste au journal en le gardant court : une recherche qui
 * suit la précédente de moins de 150 ms la remplace (un glissement de poignée
 * en émet des dizaines), et un geste qui ne change rien n'est pas écrit.
 * Rend false quand le journal est plein.
 * @param {Geste[]} ev
 * @param {Geste} g
 * @returns {boolean}
 */
function mlJournaliser(ev,g){
  const der=ev[ev.length-1];
  if(g[1]==='aller'&&der&&der[1]==='aller'&&g[0]-der[0]<150){ ev[ev.length-1]=g; return true; }
  if(g[1]==='lecture'||g[1]==='pause'){
    for(let i=ev.length-1;i>=0;i--){ const k=ev[i][1]; if(k==='lecture'||k==='pause'){ if(k===g[1]) return true; break; } }
    if(g[1]==='pause'&&!ev.some(e=>e[1]==='lecture')) return true;
  }
  if(g[1]==='vitesse'){
    for(let i=ev.length-1;i>=0;i--){ const e=ev[i]; if(e[1]==='vitesse'){ if(e[2]===g[2]) return true; break; } }
  }
  if(ev.length>=CORR_EV_MAX) return false;
  ev.push(g);
  return true;
}
/**
 * PURE. Un trait simplifié (Ramer-Douglas-Peucker) jusqu'à tenir en
 * CORR_POINTS_MAX points : on relâche la tolérance tant qu'il en déborde.
 * @param {number[][]} pts
 * @returns {number[][]}
 */
function mlSimplifierTrait(pts){
  /** @param {number[][]} l @param {number} eps @returns {number[][]} */
  const rdp=(l,eps)=>{
    if(l.length<3) return l.slice();
    const [a,b]=[l[0],l[l.length-1]];
    let dMax=-1, iMax=0;
    const dx=b[0]-a[0], dy=b[1]-a[1], n=Math.hypot(dx,dy)||1;
    for(let i=1;i<l.length-1;i++){
      const d=Math.abs(dy*l[i][0]-dx*l[i][1]+b[0]*a[1]-b[1]*a[0])/n;
      if(d>dMax){ dMax=d; iMax=i; }
    }
    if(dMax<=eps) return [a,b];
    return rdp(l.slice(0,iMax+1),eps).slice(0,-1).concat(rdp(l.slice(iMax),eps));
  };
  let eps=2, r=rdp(pts,eps);
  while(r.length>CORR_POINTS_MAX&&eps<200){ eps*=1.6; r=rdp(pts,eps); }
  return r.length>CORR_POINTS_MAX?r.filter((_,i)=>i%Math.ceil(r.length/CORR_POINTS_MAX)===0).slice(0,CORR_POINTS_MAX):r;
}
/**
 * PURE. Un trait en texte : « x,y x,y », entiers de 0 à 1000.
 * @param {number[][]} pts
 * @returns {string}
 */
function mlEncoderTrait(pts){
  return pts.map(p=>Math.max(0,Math.min(1000,Math.round(p[0])))+','+Math.max(0,Math.min(1000,Math.round(p[1])))).join(' ');
}
/**
 * PURE. Le texte d'un trait, relu.
 * @param {string} s
 * @returns {number[][]}
 */
function mlDecoderTrait(s){
  return String(s||'').split(' ').map(q=>q.split(',').map(Number)).filter(p=>p.length===2&&p.every(isFinite));
}
/**
 * PURE. Les cartes affichées quand la vidéo source est à `sMs`.
 * @param {Carte[]} cartes
 * @param {number} sMs
 * @returns {Carte[]}
 */
function mlCartesVisibles(cartes,sMs){
  return (cartes||[]).filter(c=>sMs>=c.aMs&&sMs<c.aMs+c.dureeMs);
}
/**
 * PURE. Le premier instant de la session où la vidéo montre une carte : c'est
 * là qu'on saute quand l'athlète touche la carte dans la liste. -1 si la
 * séquence ne passe jamais par ce moment.
 * @param {Correction} m
 * @param {Carte} c
 * @returns {number}
 */
function mlInstantDeCarte(m,c){
  for(let T=0;T<=m.dureeMs;T+=40){
    const s=mlEtatRejeu(m.debut,m.ev,T).s;
    if(s>=c.aMs-20&&s<c.aMs+c.dureeMs) return T;
  }
  return -1;
}

// ── L'enregistrement ────────────────────────────────────────────────────────
/** @returns {number} l'instant de la session, en ms, pauses exclues */
function _mlRecT(){
  const r=_ml&&_ml.rec;
  if(!r) return 0;
  return Math.max(0,Math.round((r.pause?r.pauseDebut:performance.now())-r.t0-r.pauseTotal));
}
/** @param {Geste} g */
function _mlJournal(g){
  const r=_ml&&_ml.rec;
  if(!r||r.pause) return;
  if(!mlJournaliser(r.ev,g)&&!r.plein){
    r.plein=true;
    toast('Journal plein : termine la correction pour l’envoyer.','var(--orange)');
  }
}
/** Le choix du type audio : ce que le navigateur sait enregistrer. */
function _mlMimeVoix(){
  const MR=/** @type {any} */(window).MediaRecorder;
  if(!MR||typeof MR.isTypeSupported!=='function') return '';
  return ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(t=>MR.isTypeSupported(t))||'';
}
async function mlCorrDemarrer(){
  const v=_mlVideo();
  if(!_ml||!v||!_ml.dureeMs||_ml.mode!=='lecture'||_ml.rec) return false;
  if(_ml.correction&&_ml.correction.statut!=='envoye'){
    if(!await rcConfirm('Recommencer la correction ?','La correction enregistrée et pas encore envoyée sera perdue.','Recommencer','Garder'))
      return false;
    _mlCorrOublier();
  }
  if(!_ml) return false;
  try{ v.pause(); }catch(e){}
  /** @type {MediaStream|null} */ let flux=null;
  /** @type {MediaRecorder|null} */ let media=null;
  const morceaux=/** @type {Blob[]} */([]);
  try{
    flux=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    const mime=_mlMimeVoix();
    media=new MediaRecorder(flux,mime?{mimeType:mime}:{});
    media.ondataavailable=e=>{ if(e.data&&e.data.size>0) morceaux.push(e.data); };
  }catch(e){
    if(flux) flux.getTracks().forEach(t=>t.stop());
    flux=null; media=null;
    if(!await rcConfirm('Micro indisponible','La correction sera muette : les gestes, les dessins et les cartes seront gardés, sans ta voix.','Continuer sans voix','Annuler'))
      return false;
  }
  if(!_ml){ if(flux) flux.getTracks().forEach(t=>t.stop()); return false; }
  const a=_mlActif();
  _ml.rec={t0:performance.now(),pause:false,pauseDebut:0,pauseTotal:0,ev:[],
    debut:{s:Math.round((Number(v.currentTime)||0)*1000),r:VID_RATES.includes(v.playbackRate)?v.playbackRate:1},
    media,flux,morceaux,outil:null,couleur:1,traits:[],enCours:null,trace:true,minuteur:0,plein:false,
    st:[],reco:null};
  if(a&&a.barre) _ml.rec.ev.push([0,'calque','trajectoire',a.id,1]);
  if(media) media.start(250);
  _ml.rec.minuteur=window.setInterval(()=>{
    if(!_ml||!_ml.rec){ return; }
    _mlMajBarreRec();
    if(_mlRecT()>=CORR_DUREE_MAX_MS){ toast('Trois minutes : la correction s’arrête là.'); mlRecTerminer(); }
  },250);
  _mlMajCorrection();
  _mlDessinerCalque();
  return true;
}
function mlRecPause(){
  const r=_ml&&_ml.rec, v=_mlVideo();
  if(!r) return false;
  if(!r.pause){
    if(v&&!v.paused){ try{ v.pause(); }catch(e){} }
    _mlJournal([_mlRecT(),'pause']);
    r.pause=true; r.pauseDebut=performance.now(); r.outil=null;
    try{ if(r.media&&r.media.state==='recording') r.media.pause(); }catch(e){}
  } else {
    r.pauseTotal+=performance.now()-r.pauseDebut; r.pause=false;
    try{ if(r.media&&r.media.state==='paused') r.media.resume(); }catch(e){}
    // CE QUI A BOUGÉ PENDANT LA PAUSE est remis au journal à la reprise : sans
    // cela, l'athlète reverrait la vidéo là où le coach l'avait laissée avant.
    if(v){
      _mlJournal([_mlRecT(),'aller',Math.round((Number(v.currentTime)||0)*1000)]);
      if(VID_RATES.includes(v.playbackRate)) _mlJournal([_mlRecT(),'vitesse',v.playbackRate]);
    }
  }
  _mlMajBarreRec();
  _mlDessinerCalque();
  return true;
}
function mlRecDessin(){
  const r=_ml&&_ml.rec;
  if(!r||r.pause) return false;
  r.outil=r.outil==='dessin'?null:'dessin';
  _mlMajBarreRec(); _mlDessinerCalque();
  return true;
}
/** @param {number} i */
function mlRecCouleur(i){
  const r=_ml&&_ml.rec;
  if(!r) return false;
  r.couleur=Math.max(0,Math.min(CORR_COULEURS-1,Math.round(Number(i)||0)));
  r.outil='dessin';
  _mlMajBarreRec(); _mlDessinerCalque();
  return true;
}
/** @param {number[][]} brut */
function _mlRecTrait(brut){
  const r=_ml&&_ml.rec;
  if(!r||r.pause) return false;
  if(r.traits.length>=CORR_TRAITS_MAX){ toast('Soixante traits au plus : efface avant de redessiner.','var(--orange)'); return false; }
  const txt=mlEncoderTrait(mlSimplifierTrait(brut));
  r.traits.push([r.couleur,txt]);
  _mlJournal([_mlRecT(),'trait',r.couleur,txt]);
  return true;
}
function mlRecEffacer(){
  const r=_ml&&_ml.rec;
  if(!r||r.pause||!r.traits.length) return false;
  r.traits=[];
  _mlJournal([_mlRecT(),'effacer']);
  _mlDessinerCalque();
  return true;
}
function mlRecTrace(){
  const r=_ml&&_ml.rec, a=_mlActif();
  if(!r||r.pause||!a||!a.barre) return false;
  r.trace=!r.trace;
  _mlJournal([_mlRecT(),'calque','trajectoire',a.id,r.trace?1:0]);
  _mlMajBarreRec(); _mlDessinerCalque();
  return true;
}
/** @returns {Promise<boolean>} */
async function mlRecTerminer(){
  const r=_ml&&_ml.rec;
  if(!_ml||!r) return false;
  const v=_mlVideo();
  if(r.pause){ r.pauseTotal+=performance.now()-r.pauseDebut; r.pause=false; }
  const dureeMs=_mlRecT();
  _mlRecEcouteArreter();
  if(v&&!v.paused){ try{ v.pause(); }catch(e){} }
  window.clearInterval(r.minuteur);
  /** @type {Blob|null} */
  const blob=await new Promise(res=>{
    if(!r.media||r.media.state==='inactive') return res(null);
    r.media.onstop=()=>res(r.morceaux.length?new Blob(r.morceaux,{type:(r.media&&r.media.mimeType)||'audio/webm'}):null);
    try{ r.media.stop(); }catch(e){ res(null); }
  });
  if(r.flux) r.flux.getTracks().forEach((/** @type {MediaStreamTrack} */ t)=>t.stop());
  if(!_ml) return false;
  _ml.rec=null;
  if(dureeMs<300){ toast('Correction trop courte : rien n’a été gardé.','var(--orange)'); _mlMajCorrection(); _mlDessinerCalque(); return false; }
  /** @type {Correction} */
  const motion={v:1,id:'c'+Date.now().toString(36),creeLe:Date.now(),envoyeLe:0,dureeMs,voix:null,
    debut:r.debut,ev:r.ev.slice().sort((/** @type {Geste} */ x,/** @type {Geste} */ y)=>x[0]-y[0]),cartes:[],epingles:[],
    st:r.st.slice().sort((/** @type {{t:number}} */ x,/** @type {{t:number}} */ y)=>x.t-y.t)};
  _ml.correction={motion,blob,blobUrl:blob?URL.createObjectURL(blob):'',statut:'brouillon',erreur:''};
  _mlMajCorrection();
  _mlDessinerCalque();
  return true;
}
// Oublie le brouillon : l'aperçu, la voix gardée en mémoire.
function _mlCorrOublier(){
  if(!_ml) return;
  if(_ml.lecteur){ _ml.lecteur.detruire(); _ml.lecteur=null; }
  if(_ml.correction&&_ml.correction.blobUrl) URL.revokeObjectURL(_ml.correction.blobUrl);
  _ml.correction=null;
}
async function mlCorrAbandonner(){
  if(!_ml||!_ml.correction) return false;
  if(_ml.correction.statut!=='envoye'
    &&!await rcConfirm('Abandonner cette correction ?','La voix et les gestes enregistrés seront perdus.','Abandonner','Garder')) return false;
  _mlCorrOublier();
  _mlMajCorrection();
  return true;
}

// ── Les cartes écrites et les modèles ───────────────────────────────────────
/** @returns {string[]} */
function _mlModeles(){
  const l=currentUser&&Array.isArray(currentUser.motionModeles)?currentUser.motionModeles:null;
  return (l||ML_MODELES_DEFAUT).map((/** @type {any} */ x)=>String(x).slice(0,CORR_CARTE_MAX)).filter(Boolean).slice(0,ML_MODELES_MAX);
}
function mlCarteAjouter(){
  const v=_mlVideo(), champ=/** @type {HTMLInputElement|null} */(_mlEl('ml-carte-txt'));
  const duree=/** @type {HTMLSelectElement|null} */(_mlEl('ml-carte-duree'));
  if(!_ml||!v||!champ) return false;
  const texte=champ.value.trim().slice(0,CORR_CARTE_MAX);
  if(!texte){ toast('Écris la correction avant de l’ajouter.','var(--orange)'); return false; }
  if(_ml.cartes.length>=CORR_CARTES_MAX){ toast('Vingt cartes au plus.','var(--orange)'); return false; }
  const d=Number(duree&&duree.value);
  _ml.cartes=_ml.cartes.concat([{id:'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    aMs:Math.round((Number(v.currentTime)||0)*1000),dureeMs:ML_DUREES_CARTE.includes(d)?d:3000,texte}])
    .sort((a,b)=>a.aMs-b.aMs);
  champ.value='';
  _mlMajCorrection();
  return true;
}
/**
 * Un texte tout fait, glissé dans le champ des cartes puis ajouté. On passe
 * par mlCarteAjouter et non à côté : c'est elle qui porte les bornes, le
 * compte maximal et le tri.
 * @param {string} t
 */
function mlCarteTexte(t){
  const champ=/** @type {HTMLInputElement|null} */(_mlEl('ml-carte-txt'));
  if(!champ) return false;
  champ.value=String(t||'').slice(0,CORR_CARTE_MAX);
  return mlCarteAjouter();
}
/** @param {string} id */
function mlCarteSupprimer(id){
  if(!_ml) return false;
  _ml.cartes=_ml.cartes.filter(c=>c.id!==id);
  _mlMajCorrection();
  return true;
}
/** @param {number} i */
function mlModeleUtiliser(i){
  const champ=/** @type {HTMLInputElement|null} */(_mlEl('ml-carte-txt'));
  const m=_mlModeles()[i];
  if(!champ||!m) return false;
  champ.value=m; champ.focus();
  return true;
}
function mlModeleGarder(){
  const champ=/** @type {HTMLInputElement|null} */(_mlEl('ml-carte-txt'));
  const t=champ?champ.value.trim().slice(0,CORR_CARTE_MAX):'';
  if(!currentUser||!t) return false;
  const l=_mlModeles().filter(x=>x!==t);
  if(l.length>=ML_MODELES_MAX){ toast('Douze modèles au plus : retires-en un.','var(--orange)'); return false; }
  currentUser.motionModeles=[t].concat(l);
  toastEcriture(saveUser(),'Modèle gardé ✓','le modèle est');
  _mlMajCorrection();
  return true;
}
/** @param {number} i */
function mlModeleRetirer(i){
  if(!currentUser) return false;
  const l=_mlModeles();
  if(!l[i]) return false;
  l.splice(i,1);
  currentUser.motionModeles=l;
  try{ saveUser(); }catch(e){}
  _mlMajCorrection();
  return true;
}

// ── L'envoi ─────────────────────────────────────────────────────────────────
async function mlCorrEnvoyer(){
  const c=_ml&&_ml.correction;
  if(!_ml||!c||c.statut==='envoi'||c.statut==='envoye') return false;
  const {email,videoId}=_ml;
  c.statut='envoi'; c.erreur='';
  _mlMajCorrection();
  try{
    let voix=c.motion.voix;
    if(c.blob&&!voix){
      const type=c.blob.type||'audio/webm';
      const ext=/mp4/.test(type)?'.m4a':/ogg/.test(type)?'.ogg':'.webm';
      // ⚠ COÛT : ce fichier de voix reste sur Cloudinary même si la correction
      // est remplacée plus tard. L'effacer demande une signature, donc un
      // secret, donc un serveur : il n'y en a pas, et en mettre un dans l'app
      // le donnerait à tout le monde. Trois minutes d'Opus pèsent ~350 ko ;
      // une correction refaite dix fois par semaine coûte ~180 Mo par an, très
      // loin des 25 Go du palier gratuit. Le jour où un serveur existera, la
      // purge se fera sur les voix qu'aucune vidéo ne cite plus.
      const url=await _cloudinaryUpload(new File([c.blob],'correction_'+Date.now()+ext,{type}));
      voix={url:String(url)};
      c.motion.voix=voix;          // gardée : un nouvel essai ne renvoie pas la voix
    }
    if(!_ml||_ml.correction!==c) return false;
    const motion={...c.motion,voix,cartes:_ml.cartes.slice(),epingles:_ml.epingles.slice(),envoyeLe:Date.now()};
    const r=enregistrerCorrectionMotion(email,videoId,motion);
    if(!r.ok&&r.raison) throw new Error(r.raison);
    c.statut='envoye';
    // CE QUI N'A PAS TENU SE DIT. La validation fait tomber les sous-titres,
    // puis les épingles, quand la correction dépasse son plafond ; le coach
    // doit l'apprendre autrement qu'en ne les voyant plus.
    const garde=r.motion||motion;
    const perdu=[];
    if((motion.st||[]).length&&!(garde.st||[]).length) perdu.push('les sous-titres');
    if((motion.epingles||[]).length&&!(garde.epingles||[]).length) perdu.push('les épingles');
    c.motion=garde;
    if(perdu.length) toast('Correction trop lourde : '+perdu.join(' et ')+' n’ont pas tenu.','var(--orange)');
    toastSync(r.ok,r.envoi,'Correction envoyée ✓','la correction est');
  }catch(e){
    if(!_ml||_ml.correction!==c) return false;
    c.statut='erreur';
    c.erreur=(e&&/** @type {any} */(e).message&&/illisible|introuvable|autorisé/.test(/** @type {any} */(e).message))
      ?String(/** @type {any} */(e).message):_cloudinaryUserMsg(e,'audio');
  }
  _mlMajCorrection();
  return c.statut==='envoye';
}

// ── Le panneau et la barre d'enregistrement ─────────────────────────────────
function _mlMajBarreRec(){
  const z=_mlEl('ml-rec');
  if(!z||!_ml) return;
  const r=_ml.rec;
  if(!r){ z.innerHTML=''; z.hidden=true; return; }
  z.hidden=false;
  const a=_mlActif();
  const t=_mlRecT();
  z.innerHTML='<div class="ml-rec-l1"><span class="ml-rec-point fx-loop'+(r.pause?' ml-rec-pause':'')+'" aria-hidden="true"></span>'
    +'<b class="ml-rec-t">'+mlTempsTexte(t).slice(0,-3)+'</b>'
    +'<span class="ml-rec-etat">'+(r.pause?'En pause':r.media?'Enregistrement':'Enregistrement sans voix')+'</span>'
    +'<button type="button" class="ml-b" onclick="mlRecPause()">'+(r.pause?'Reprendre':'❚❚ Pause')+'</button>'
    +'<button type="button" class="ml-b ml-b-plein" onclick="mlRecTerminer()">■ Terminer</button></div>'
    +'<div class="ml-rec-l2">'
      +'<button type="button" class="ml-b" aria-pressed="'+(r.outil==='dessin')+'" onclick="mlRecDessin()"'+(r.pause?' disabled':'')+'>✎ Dessiner</button>'
      +[0,1,2].map(i=>'<button type="button" class="ml-pastille" style="--c:'+_mlCouleurTrait(i)+'" aria-pressed="'+(r.couleur===i)
        +'" aria-label="Couleur '+['blanche','cyan','rouge'][i]+'" onclick="mlRecCouleur('+i+')"'+(r.pause?' disabled':'')+'></button>').join('')
      +'<button type="button" class="ml-b" onclick="mlRecEffacer()"'+(r.pause||!r.traits.length?' disabled':'')+'>Effacer</button>'
      // ⚠ LA VOIX PART CHEZ UN TIERS quand c'est allumé : le navigateur
      // fait la reconnaissance, pas nous. Éteint par défaut, et le
      // panneau en dessous le dit en toutes lettres.
      +'<button type="button" class="ml-b" aria-pressed="'+(!!r.reco)+'" onclick="mlRecSousTitres()"'
        +(mlReconnaissanceDispo()?'':' disabled')+'>CC'+(r.st.length?' '+r.st.length:'')+'</button>'
      +(a&&a.barre?'<button type="button" class="ml-b" aria-pressed="'+r.trace+'" onclick="mlRecTrace()"'+(r.pause?' disabled':'')+'>Trajectoire</button>':'')
    +'</div>';
}
function _mlMajCorrection(){
  const z=_mlEl('ml-corr');
  if(!z||!_ml) return;
  _mlMajBarreRec();
  const c=_ml.correction;
  const off=_ml.dureeMs?'':' disabled';
  let h='<div class="ml-traj"><div class="ml-traj-tete"><span class="ml-lab">Correction vidéo</span></div>';
  if(_ml.rec){
    h+='<p class="ml-traj-aide">Enregistrement en cours : lis, fige, ralentis, avance image par image, dessine. '
      +'Chaque geste est noté, et l’athlète reverra exactement cette séquence sous ta voix.</p>';
  } else if(!c){
    const v=_mlVideoSource();
    h+='<p class="ml-traj-aide">Parle pendant que tu manipules la vidéo : l’athlète reverra ta voix, tes arrêts, tes ralentis '
      +'et tes dessins, dans l’ordre. Trois minutes au plus.'
      // ⚠ DIT AVANT, PAS APRÈS : la bascule CC envoie la voix au service de
      // reconnaissance du navigateur, qui n'est pas nous.
      +(mlReconnaissanceDispo()?' Le bouton CC ajoute des sous-titres : la reconnaissance est celle du navigateur, et ta voix part alors chez son éditeur.':'')
      +(v&&motionCorrectionValide(v.motion)?' Une correction a déjà été envoyée'+(v.motion.envoyeLe?' le '+new Date(v.motion.envoyeLe).toLocaleDateString('fr-FR'):'')
        +' : la nouvelle la remplacera.':'')+'</p>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-red btn-sm" onclick="mlCorrDemarrer()"'+off+'>🎙 Enregistrer une correction</button></div>';
  } else {
    const st={brouillon:'Prête à envoyer',envoi:'Envoi en cours…',envoye:'Envoyée ✓',erreur:'Échec de l’envoi'}[c.statut];
    h+='<p class="ml-traj-aide"><b class="ml-statut ml-statut-'+c.statut+'">'+st+'</b> · '+_mlDureeCourte(c.motion.dureeMs)
      +(c.blob?'':' · sans voix')+(c.erreur?' — '+escapeHtml(c.erreur):'')+'</p>'
      +'<div id="ml-corr-lecteur" class="ml-corr-lecteur"></div>'
      +'<div class="ml-traj-cmd">'
      +(c.statut==='envoye'
        ?'<button type="button" class="btn btn-outline btn-sm" onclick="mlCorrAbandonner()">Nouvelle correction</button>'
        :'<button type="button" class="btn btn-red btn-sm" onclick="mlCorrEnvoyer()"'+(c.statut==='envoi'?' disabled':'')+'>'
          +(c.statut==='erreur'?'Réessayer l’envoi':'Envoyer à l’athlète')+'</button>'
          +'<button type="button" class="btn btn-outline btn-sm" onclick="mlCorrAbandonner()"'+(c.statut==='envoi'?' disabled':'')+'>Abandonner</button>')
      +'</div>';
  }
  // LES CARTES : elles se préparent avant, pendant ou après l'enregistrement,
  // et s'attachent à un instant de la VIDÉO — elles apparaissent quand la
  // séquence y passe.
  const verrou=c&&(c.statut==='envoi'||c.statut==='envoye');
  h+='<div class="ml-lab" style="margin-top:14px">Corrections écrites</div>'
    +(_ml.cartes.length?'<div class="ml-cartes">'+_ml.cartes.map(k=>'<div class="ml-carte-l"><span class="ml-carte-t">'
        +mlTempsTexte(k.aMs)+'</span><span class="ml-carte-x">'+escapeHtml(k.texte)+'</span>'
        +(verrou?'':'<button type="button" class="ml-mini" onclick="mlCarteSupprimer(\''+escapeHtml(k.id)+'\')" aria-label="Retirer cette carte">×</button>')
        +'</div>').join('')+'</div>':'<p class="ml-traj-aide">Aucune pour l’instant.</p>')
    +(verrou?'':'<div class="ml-carte-saisie"><input id="ml-carte-txt" class="vn-in" maxlength="'+CORR_CARTE_MAX+'" placeholder="Ex. : garde les coudes hauts" '
        +'onkeydown="if(event.key===\'Enter\'){event.preventDefault();mlCarteAjouter()}">'
      +'<select id="ml-carte-duree" class="vn-in" aria-label="Durée d’affichage">'
        +ML_DUREES_CARTE.map(d=>'<option value="'+d+'"'+(d===3000?' selected':'')+'>'+(d/1000)+' s</option>').join('')+'</select></div>'
      +'<div class="ml-traj-cmd"><button type="button" class="btn btn-outline btn-sm" onclick="mlCarteAjouter()"'+off+'>+ À l’image affichée</button>'
        +'<button type="button" class="btn btn-outline btn-sm" onclick="mlModeleGarder()">★ Garder comme modèle</button></div>'
      +'<div class="ml-phases">'+_mlModeles().map((m,i)=>'<span class="ml-modele"><button type="button" class="ml-phase" onclick="mlModeleUtiliser('+i+')">'
        +escapeHtml(m)+'</button><button type="button" class="ml-modele-x" onclick="mlModeleRetirer('+i+')" aria-label="Retirer ce modèle">×</button></span>').join('')+'</div>');
  // LES ÉPINGLES : la valeur d'un angle, attachée à une image. Elle est
  // gardée telle qu'elle a été vue, et non recalculée à la lecture : si les
  // articulations sont refaites, ce que le coach a montré ne bouge pas.
  h+='<div class="ml-lab" style="margin-top:14px">Angles épinglés</div>'
    +(_ml.epingles.length
      ?'<div class="ml-cartes">'+_ml.epingles.map(p=>{
        const q=ML_ANGLES.find(x=>x.cle===p.art);
        return '<div class="ml-carte-l"><span class="ml-carte-t">'+mlTempsTexte(p.aMs)+'</span>'
          +'<span class="ml-carte-x">'+escapeHtml(q?q.nom:String(p.art))+' · '+p.val+'°\u00a0±'+(p.tol||ML_TOL_BRUT)+'</span>'
          +(verrou?'':'<button type="button" class="ml-mini" onclick="mlEpingleSupprimer(\''+escapeHtml(p.id)+'\')" aria-label="Retirer cette épingle">×</button>')
          +'</div>';
      }).join('')+'</div>'
      :'<p class="ml-traj-aide">Aucun. Affiche un angle, place-toi sur l’image, et épingle-le depuis le panneau des articulations.</p>');
  // LES SOUS-TITRES ne se retouchent pas mot à mot : ils se gardent ou se
  // jettent. Une reconnaissance qui a compris de travers vaut mieux jetée.
  const st=(c&&c.motion.st)||[];
  if(st.length) h+='<p class="ml-traj-aide">'+st.length+' ligne'+(st.length>1?'s':'')+' de sous-titres, reconnues pendant l’enregistrement.'
    +(verrou?'':' <button type="button" class="ml-modele-x" onclick="mlSousTitresRetirer()">Les retirer</button>')+'</p>';
  z.innerHTML=h+'</div>';
  // L'APERÇU : le lecteur de l'athlète, sur la voix gardée en mémoire.
  const hote=_mlEl('ml-corr-lecteur');
  if(_ml.lecteur){ _ml.lecteur.detruire(); _ml.lecteur=null; }
  if(hote&&c){
    _ml.lecteur=mlLecteurCorrection(hote,{url:_ml.url,annot:_ml.annot.a.length?_ml.annot:null,correction:{...c.motion,cartes:_ml.cartes.slice(),epingles:_ml.epingles.slice()},
      segments:_ml.segments,voixUrl:c.blobUrl||(c.motion.voix?c.motion.voix.url:'')});
  }
}
/** @param {number} ms */
function _mlDureeCourte(ms){ return mlTempsTexte(ms).slice(0,-3); }
/** @returns {any} l'entrée de la vidéo dans le dossier de l'athlète */
function _mlVideoSource(){
  if(!_ml) return null;
  const c=(DB.get('users')||{})[_ml.email];
  return c&&Array.isArray(c.videos)?c.videos.find((/** @type {any} */ x)=>x&&x.id===_ml?.videoId):null;
}

// ── LES ANGLES ÉPINGLÉS ─────────────────────────────────────────────────────
//
// Une épingle attache la valeur d'un angle à une IMAGE de la vidéo : le coach
// s'arrête au fond du squat, épingle le genou, et l'athlète retrouvera la même
// valeur sur la même image. La valeur est gardée telle qu'elle a été vue — pas
// recalculée à la lecture : si les articulations sont refaites plus tard, ce
// que le coach a montré ne doit pas changer dans son dos.
const ML_EPINGLE_MS=150;

/**
 * PURE. L'échantillon le plus proche d'un instant de la vidéo, -1 si le plus
 * proche est à plus d'un pas. On ne fabrique pas une mesure entre deux.
 * @param {{t:number[]}} S
 * @param {number} sMs
 * @returns {number}
 */
function mlIndexA(S,sMs){
  const t=S&&S.t;
  if(!t||!t.length) return -1;
  let k=-1, e=Infinity;
  for(let i=0;i<t.length;i++){ const d=Math.abs(t[i]-sMs); if(d<e){ e=d; k=i; } }
  const pas=t.length>1?Math.abs(t[1]-t[0]):100;
  return (k<0||e>pas)?-1:k;
}
/**
 * PURE. La valeur d'un angle à un instant de la vidéo, null si on ne l'a pas
 * mesurée là.
 * @param {{t:number[], ang:Object<string,(number|null)[]>}} S
 * @param {string} cle
 * @param {number} sMs
 * @returns {number|null}
 */
function mlAngleA(S,cle,sMs){
  const v=S&&S.ang&&S.ang[cle];
  const k=v?mlIndexA(S,sMs):-1;
  return k<0?null:v[k];
}
/**
 * PURE. Les épingles visibles à cet instant de la vidéo. Une épingle tient à
 * son image : elle paraît quand la séquence y passe, et disparaît après.
 * @param {{aMs:number}[]} l
 * @param {number} sMs
 * @returns {any[]}
 */
function mlEpinglesVisibles(l,sMs){
  return (l||[]).filter(p=>p&&Math.abs(sMs-p.aMs)<=ML_EPINGLE_MS);
}
/**
 * Épingle un angle sur l'image affichée.
 * @param {string} cle
 */
function mlEpingler(cle){
  const v=_mlVideo(), a=_mlActif();
  if(!_ml||!v||!a) return false;
  const c=_ml.correction;
  if(!_ml.rec&&!(c&&c.statut!=='envoi'&&c.statut!=='envoye')){
    toast('Commence une correction : une épingle s’y attache.','var(--orange)');
    return false;
  }
  if(_ml.epingles.length>=CORR_EPINGLES_MAX){
    toast('Vingt épingles au plus.','var(--orange)');
    return false;
  }
  const sMs=Math.round((Number(v.currentTime)||0)*1000);
  const S=_mlPoseLue(a);
  const brut=S?mlAngleA(S,cle,sMs):null;
  // ON ÉPINGLE CE QUI EST AFFICHÉ : la flexion corrigée, au degré entier, avec
  // sa tolérance. Recalculer plus tard sur des articulations refaites ferait
  // changer, dans le dos du coach, la valeur qu'il a montrée.
  const val=brut==null?null:mlCorrigerAngle(cle,Number(mlFlexion(cle,brut)),S&&S.hp!=null?S.hp:undefined);
  if(val==null){
    toast('Cet angle n’est pas lisible sur cette image.','var(--orange)');
    return false;
  }
  _ml.epingles=_ml.epingles.concat([{id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    aMs:sMs,art:cle,val:val.deg,tol:val.tol}]).sort((x,y)=>x.aMs-y.aMs);
  _mlMajCorrection(); _mlMajArticulations(); _mlDessinerCalque();
  return true;
}
/** Jette les sous-titres reconnus : mal compris, ils valent mieux absents. */
function mlSousTitresRetirer(){
  const c=_ml&&_ml.correction;
  if(!c||c.statut==='envoi'||c.statut==='envoye') return false;
  c.motion={...c.motion,st:[]};
  _mlMajCorrection();
  return true;
}
/** @param {string} id */
function mlEpingleSupprimer(id){
  if(!_ml) return false;
  _ml.epingles=_ml.epingles.filter(p=>p.id!==id);
  _mlMajCorrection(); _mlDessinerCalque();
  return true;
}
/**
 * Les épingles, en haut à droite de l'image. PARTAGÉ par le laboratoire et le
 * lecteur de l'athlète.
 * @param {CanvasRenderingContext2D} g
 * @param {{s:number, ox:number, oy:number, vw:number, vh:number}} R
 * @param {any[]} l
 * @param {number} sMs
 */
function _mlDessinerEpingles(g,R,l,sMs){
  const vis=mlEpinglesVisibles(l,sMs);
  if(!vis.length) return;
  g.font='800 12px Montserrat, sans-serif';
  g.textAlign='right'; g.textBaseline='middle';
  const bord=R.ox+R.vw*R.s-8;
  let y=8;
  for(const p of vis.slice(0,4)){
    const def=ML_ANGLES.find(q=>q.cle===p.art);
    const txt=(def?def.nom:String(p.art))+' '+p.val+'°\u00a0±'+(p.tol||ML_TOL_BRUT);
    const w=Math.round(g.measureText(txt).width)+16;
    g.fillStyle='rgba(8,8,8,.82)';
    g.fillRect(bord-w,y,w,24);
    g.strokeStyle=_tok('--arc-current','#4DE8FF'); g.lineWidth=1.5;
    g.strokeRect(bord-w+0.5,y+0.5,w-1,23);
    g.fillStyle='#ffffff';
    g.fillText(txt,bord-8,y+12);
    y+=30;
  }
  g.textAlign='start'; g.textBaseline='alphabetic';
}

// ── LES SOUS-TITRES ─────────────────────────────────────────────────────────
//
// ⚠ CE N'EST PAS UNE TRANSCRIPTION MAISON, et le coach doit le savoir : c'est
// le moteur de reconnaissance du NAVIGATEUR. Chez Chrome, il envoie la voix à
// un service de Google — donc à un tiers, pendant que le coach parle. La
// bascule est donc éteinte par défaut, et l'écran le dit en toutes lettres.
// Un service payant aurait demandé une clé, donc un serveur, qu'on n'a pas ;
// un modèle local aurait pesé quarante mégaoctets de plus.
const ML_ST_MAX_MS=6000;
// ⚠ TROIS CENT VINGT MILLISECONDES PAR MOT : c'est une ESTIMATION, et elle sert
// à une seule chose — placer la phrase là où elle a été DITE. Le moteur ne rend
// son texte qu'une fois la phrase finie, avec un retard qui, sans correction,
// afficherait chaque sous-titre après le geste qu'il commente.
const ML_ST_MS_PAR_MOT=320;

/** @returns {boolean} Le navigateur sait-il reconnaître la parole. */
function mlReconnaissanceDispo(){
  const A=/** @type {any} */(window);
  return typeof (A.SpeechRecognition||A.webkitSpeechRecognition)==='function';
}
/**
 * PURE. Le sous-titre à afficher à cet instant de la SESSION : la phrase
 * commencée, tant qu'une autre n'a pas pris sa place et six secondes au plus.
 * @param {{t:number, x:string}[]} st
 * @param {number} T
 * @returns {string}
 */
function mlSousTitreA(st,T){
  const l=st||[];
  for(let i=0;i<l.length;i++){
    if(l[i].t>T) break;
    const suivant=(i+1<l.length)?l[i+1].t:Infinity;
    if(T<Math.min(l[i].t+ML_ST_MAX_MS,suivant)) return l[i].x;
  }
  return '';
}
/**
 * PURE. Où poser une phrase reconnue : à l'instant où elle a commencé, estimé
 * d'après sa longueur, jamais avant la fin de la précédente, jamais négatif.
 * @param {number} arriveeMs  quand le moteur a rendu la phrase
 * @param {string} texte
 * @param {number} precedentMs  l'instant de la phrase d'avant, -1 s'il n'y en a pas
 * @returns {number}
 */
function mlInstantPhrase(arriveeMs,texte,precedentMs){
  const mots=String(texte||'').trim().split(/\s+/).filter(Boolean).length;
  const duree=Math.min(ML_ST_MAX_MS,mots*ML_ST_MS_PAR_MOT);
  return Math.max(0,precedentMs>=0?Math.max(precedentMs+200,arriveeMs-duree):arriveeMs-duree);
}
/** Démarre ou arrête la reconnaissance pendant l'enregistrement. */
function mlRecSousTitres(){
  const r=_ml&&_ml.rec;
  if(!_ml||!r) return false;
  if(r.reco){ _mlRecEcouteArreter(); _mlMajBarreRec(); return true; }
  if(!mlReconnaissanceDispo()){
    toast('Ce navigateur ne sait pas reconnaître la parole.','var(--orange)');
    return false;
  }
  const A=/** @type {any} */(window);
  const R=A.SpeechRecognition||A.webkitSpeechRecognition;
  let reco=null;
  try{ reco=new R(); }catch(e){ toast('La reconnaissance n’a pas démarré.','var(--orange)'); return false; }
  reco.lang='fr-FR'; reco.continuous=true; reco.interimResults=false; reco.maxAlternatives=1;
  reco.onresult=(/** @type {any} */ e)=>{
    const rr=_ml&&_ml.rec;
    if(!rr||rr.st.length>=CORR_ST_MAX) return;
    for(let i=e.resultIndex;i<e.results.length;i++){
      if(!e.results[i].isFinal) continue;
      const texte=String(e.results[i][0].transcript||'').trim().slice(0,CORR_ST_CHARS);
      if(!texte) continue;
      const der=rr.st.length?rr.st[rr.st.length-1].t:-1;
      rr.st.push({t:Math.round(mlInstantPhrase(_mlRecT(),texte,der)),x:texte});
      if(rr.st.length>=CORR_ST_MAX) break;
    }
    _mlMajBarreRec();
  };
  // ⚠ LE MOTEUR S'ARRÊTE TOUT SEUL après un silence : sans ce redémarrage, les
  // sous-titres s'arrêteraient à la première respiration du coach.
  reco.onend=()=>{
    const rr=_ml&&_ml.rec;
    if(!rr||rr.reco!==reco||rr.st.length>=CORR_ST_MAX) return;
    try{ reco.start(); }catch(e){}
  };
  reco.onerror=(/** @type {any} */ e)=>{
    const rr=_ml&&_ml.rec;
    if(!rr||rr.reco!==reco) return;
    // « no-speech » et « aborted » ne sont pas des pannes : le redémarrage suit.
    if(e&&(e.error==='no-speech'||e.error==='aborted')) return;
    rr.reco=null;
    try{ reco.stop(); }catch(x){}
    toast('Sous-titres interrompus : la voix, elle, continue d’être enregistrée.','var(--orange)');
    _mlMajBarreRec();
  };
  try{ reco.start(); }catch(e){ toast('La reconnaissance n’a pas démarré.','var(--orange)'); return false; }
  r.reco=reco;
  _mlMajBarreRec();
  return true;
}
/** Coupe la reconnaissance, sans toucher à l'enregistrement de la voix. */
function _mlRecEcouteArreter(){
  const r=_ml&&_ml.rec;
  if(!r||!r.reco) return;
  const reco=r.reco;
  r.reco=null;
  try{ reco.onend=null; reco.onresult=null; reco.onerror=null; reco.stop(); }catch(e){}
}

// ── Le lecteur de correction ────────────────────────────────────────────────
/**
 * Rejoue une correction dans `hote`. La voix mène quand elle joue : c'est elle
 * qu'on entend, et une voix qui saute s'entend plus qu'une image qui se
 * recale. La vidéo suit l'état que mlEtatRejeu calcule, et se recale dès
 * qu'elle s'en écarte de plus de 220 ms en lecture, 45 ms à l'arrêt.
 * @param {HTMLElement} hote
 * @param {{url:string, correction:Correction, segments:Segment[], voixUrl:string, annot?:DocAnnot|null}} o
 * @returns {{jouer:()=>void, pause:()=>void, aller:(T:number)=>void, detruire:()=>void, instant:()=>number}}
 */
function mlLecteurCorrection(hote,o){
  const m=o.correction, D=m.dureeMs;
  hote.innerHTML='<div class="mlc">'
    +'<div class="mlc-scene"><video class="mlc-video" src="'+safeUrl(o.url)+'" playsinline webkit-playsinline preload="auto"'
      // LA VOIX DU COACH COUVRE LE SON D'ORIGINE : la vidéo est muette sous elle.
      +(o.voixUrl?' muted':'')+'></video>'
    +'<canvas class="mlc-calque" aria-hidden="true"></canvas><div class="mlc-carte" aria-live="polite" hidden></div>'
    +'<button type="button" class="mlc-grand" aria-label="Lire la correction">▶</button></div>'
    +'<div class="mlc-cmd"><button type="button" class="ml-b mlc-jouer" aria-label="Lire la correction">▶</button>'
    +'<div class="mlc-barre" role="slider" tabindex="0" aria-label="Position dans la correction" aria-valuemin="0" aria-valuemax="'+D+'"><i></i></div>'
    +'<span class="mlc-temps">0:00 / '+_mlDureeCourte(D)+'</span></div>'
    +'<p class="mlc-st" aria-live="polite"></p></div>';
  const video=/** @type {HTMLVideoElement} */(hote.querySelector('.mlc-video'));
  const calque=/** @type {HTMLCanvasElement} */(hote.querySelector('.mlc-calque'));
  const carte=/** @type {HTMLElement} */(hote.querySelector('.mlc-carte'));
  const barre=/** @type {HTMLElement} */(hote.querySelector('.mlc-barre'));
  const bJouer=/** @type {HTMLElement} */(hote.querySelector('.mlc-jouer'));
  const grand=/** @type {HTMLElement} */(hote.querySelector('.mlc-grand'));
  const temps=/** @type {HTMLElement} */(hote.querySelector('.mlc-temps'));
  const sousTitre=/** @type {HTMLElement} */(hote.querySelector('.mlc-st'));
  const voix=o.voixUrl?new Audio(o.voixUrl):null;
  if(voix) voix.preload='auto';
  // ⚠ L'ÉTAT VIDE LE PLUS PROBABLE de cet écran : la vidéo a été supprimée, ou
  // le réseau manque. Un rectangle noir et des commandes qui ne répondent pas
  // laisseraient l'athlète croire à une panne de son téléphone.
  if(video) video.onerror=()=>{
    if(detruit) return;
    pause();
    const sc=hote.querySelector('.mlc-scene');
    if(sc) sc.innerHTML='<p class="mlc-absente">Vidéo indisponible.<br>Elle a peut-être été supprimée, '
      +'ou la connexion manque. La correction, elle, est gardée.</p>';
    bJouer.setAttribute('disabled','');
    barre.removeAttribute('tabindex');
    barre.setAttribute('aria-disabled','true');
  };
  /** @type {Object<string,{d:any, b:any}>} */
  const traj={};
  /** @type {Object<string,any>} */
  const poses={};
  /** @type {Object<string,any>} */
  const reperes={};
  for(const s of o.segments||[]){
    const b=/** @type {any} */(s).barre;
    if(b) try{ traj[s.id]={d:mlDecompacterBarre(b),b}; }catch(e){}
    const p=/** @type {any} */(s).pose;
    if(p) try{ poses[s.id]=mlAnglesSerie(p); }catch(e){}
    const rp=/** @type {any} */(s).reperes;
    if(rp) try{ reperes[s.id]=mlDecompacterReperes(rp); }catch(e){}
  }
  let T=0, joue=false, dernier=0, raf=0, detruit=false;
  // LA CARTE AFFICHÉE, pour ne toucher au DOM qu'au changement : écrire le même
  // texte soixante fois par seconde rejouerait son entrée sans fin.
  let carteAff='';
  const dessiner=(/** @type {ReturnType<typeof mlEtatRejeu>} */ e)=>{
    const R=_mlVideoRect(video);
    const dpr=Math.min(2,window.devicePixelRatio||1), W=video.clientWidth, H=video.clientHeight;
    if(calque.width!==Math.round(W*dpr)||calque.height!==Math.round(H*dpr)){ calque.width=Math.round(W*dpr); calque.height=Math.round(H*dpr); }
    const g=calque.getContext('2d');
    if(!g) return;
    g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const sNow=(Number(video.currentTime)||0)*1000;
    if(R){
      for(const k of Object.keys(e.calques)){
        if(!e.calques[k]) continue;
        const nom=k.slice(0,k.indexOf('|')), id=k.slice(k.indexOf('|')+1);
        if(nom==='trajectoire'&&traj[id]) _mlDessinerTrajectoire(g,R,traj[id].d,traj[id].b,sNow,false);
        else if(poses[id]&&poses[id].ang[nom]) _mlDessinerPose(g,R,poses[id],sNow,[nom]);
      }
      // ⚠ LES POINTS SUIVIS NE SONT PAS UN CALQUE QU'ON ALLUME. Ils
      //   appartiennent à la répétition : le coach les a nommés pour qu'ils
      //   soient vus, et l'athlète n'a aucun bouton pour les faire venir. Ils
      //   se dessinent donc quand la lecture PASSE DANS leurs bornes — hors
      //   d'elles, rien, car six répétitions superposeraient six tracés dont
      //   aucun ne se lirait.
      for(const s of o.segments||[]){
        if(sNow<s.debutMs-1||sNow>s.finMs+1) continue;
        const lu=reperes[s.id];
        if(lu) _mlDessinerReperes(g,R,lu,sNow);
      }
      // LES TRACÉS DU COACH, à l'instant de la vidéo que la séquence montre.
      if(o.annot) mlDessinerAnnotations(g,R,o.annot,sNow,{});
      _mlDessinerTraits(g,R,e.traits);
      _mlDessinerEpingles(g,R,m.epingles||[],sNow);
    }
    const k=mlCartesVisibles(m.cartes,sNow)[0];
    const cle=k?k.aMs+'|'+k.texte:'';
    if(cle!==carteAff){
      carteAff=cle;
      if(k){ carte.textContent=k.texte; carte.hidden=false; } else carte.hidden=true;
      // LA CLASSE EST RETIRÉE PUIS REPOSÉE, avec une lecture de mise en page
      // entre les deux : sans elle, le navigateur ne voit aucun changement et
      // la deuxième carte apparaîtrait sans un mot, l'entrée déjà consommée.
      carte.classList.remove('mlc-carte-in');
      void carte.offsetWidth;
      if(k) carte.classList.add('mlc-carte-in');
    }
  };
  const appliquer=(/** @type {boolean} */ saut)=>{
    const e=mlEtatRejeu(m.debut,m.ev,T);
    if(video.readyState>=1){
      if(Math.abs(video.playbackRate-e.r)>1e-6){ try{ video.playbackRate=e.r; }catch(x){} }
      const d=Number(video.duration);
      const cible=Math.min(e.s/1000,isFinite(d)&&d>0?d:Infinity);
      const ecart=Math.abs((Number(video.currentTime)||0)-cible)*1000;
      if(saut||ecart>((e.jouer&&joue)?220:45)){ try{ video.currentTime=cible; }catch(x){} }
      if(e.jouer&&joue){ if(video.paused){ const p=video.play(); if(p&&p.catch) p.catch(()=>{}); } }
      else if(!video.paused) video.pause();
    }
    dessiner(e);
    const f=Math.min(1,T/D);
    const i=/** @type {HTMLElement} */(barre.firstElementChild); if(i) i.style.transform='scaleX('+f.toFixed(4)+')';
    barre.setAttribute('aria-valuenow',String(Math.round(T)));
    // LE SOUS-TITRE SUIT L'HORLOGE DE LA SESSION, comme la voix : c'est
    // elle qu'il accompagne, pas l'image.
    if(sousTitre){
      const x=mlSousTitreA(m.st||[],T);
      if(sousTitre.textContent!==x) sousTitre.textContent=x;
    }
    temps.textContent=_mlDureeCourte(T)+' / '+_mlDureeCourte(D);
  };
  // UN PAS : l'horloge avance, l'état s'applique. La voix mène quand elle joue.
  const pas=()=>{
    if(detruit||!joue) return false;
    const now=performance.now();
    if(voix&&!voix.paused&&!voix.ended&&voix.currentTime*1000<D) T=voix.currentTime*1000;
    else T+=now-dernier;
    dernier=now;
    if(T>=D){ T=D; appliquer(false); pause(); return false; }
    appliquer(false);
    return true;
  };
  const boucle=()=>{ if(pas()) raf=requestAnimationFrame(boucle); };
  // ⚠ ET UN FILET, parce que requestAnimationFrame S'ARRÊTE quand l'onglet
  // passe en arrière-plan : sans lui, la voix continuerait sur une image figée,
  // et l'athlète qui revient retrouverait une séquence décalée.
  const filet=window.setInterval(()=>{
    if(!joue||detruit) return;
    if(performance.now()-dernier>250) pas();
  },250);
  const jouer=()=>{
    if(detruit) return;
    if(T>=D) T=0;
    joue=true; dernier=performance.now();
    bJouer.textContent='❚❚'; bJouer.setAttribute('aria-label','Mettre en pause'); grand.hidden=true;
    if(voix){ try{ voix.currentTime=T/1000; }catch(x){} const p=voix.play(); if(p&&p.catch) p.catch(()=>{}); }
    appliquer(true);
    cancelAnimationFrame(raf); raf=requestAnimationFrame(boucle);
  };
  const pause=()=>{
    joue=false; cancelAnimationFrame(raf);
    if(voix) voix.pause();
    if(!video.paused) video.pause();
    bJouer.textContent='▶'; bJouer.setAttribute('aria-label','Lire la correction');
    grand.hidden=false; grand.textContent=T>=D?'↺':'▶';
  };
  const aller=(/** @type {number} */ t)=>{
    T=Math.max(0,Math.min(D,Number(t)||0));
    if(voix){ try{ voix.currentTime=T/1000; }catch(x){} }
    appliquer(true);
  };
  bJouer.onclick=()=>{ joue?pause():jouer(); };
  grand.onclick=()=>jouer();
  video.onclick=()=>{ joue?pause():jouer(); };
  barre.onclick=e=>{ const r=barre.getBoundingClientRect(); aller((e.clientX-r.left)/Math.max(1,r.width)*D); };
  barre.onkeydown=e=>{
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); aller(T+(e.key==='ArrowLeft'?-2000:2000)); }
  };
  video.addEventListener('loadedmetadata',()=>{ if(!detruit) appliquer(true); });
  return {jouer,pause,aller,instant:()=>T,
    detruire:()=>{ detruit=true; pause(); window.clearInterval(filet);
      if(voix){ voix.removeAttribute('src'); try{ voix.load(); }catch(x){} } hote.innerHTML=''; }};
}

// ── LE LECTEUR ANNOTÉ ───────────────────────────────────────────────────────
//
// Ce que l'athlète revoit : SA vidéo, telle quelle, avec les tracés de son
// coach posés par-dessus à leurs instants, la légende, les ralentis et l'image
// par image — et « Version originale » pour la revoir sans rien. Le coach y
// relit aussi ce qu'il a envoyé : c'est le même lecteur.
/**
 * @param {HTMLElement} hote
 * @param {{url:string, annot:DocAnnot, nom?:string, logo?:string}} o
 * @returns {{pause:()=>void, aller:(ms:number)=>void, detruire:()=>void}}
 */
function mlLecteurAnnote(hote,o){
  const doc=o.annot;
  const ico=_mlxIco;
  hote.innerHTML='<div class="mla">'
    +'<div class="mla-scene"><video class="mla-video" src="'+safeUrl(o.url)+'" playsinline webkit-playsinline preload="metadata"></video>'
    +'<canvas class="mla-calque" aria-hidden="true"></canvas>'
    +'<span class="mlx-badge-orig" aria-hidden="true">Version originale</span>'
    +'<button type="button" class="mlc-grand mla-grand" aria-label="Lire la vidéo annotée">▶</button></div>'
    +'<div class="mla-cmd">'
      +'<button type="button" class="ml-b mla-b" data-a="prec" aria-label="Image précédente">'+ico('prec',16)+'</button>'
      +'<button type="button" class="ml-b mla-b mla-jouer" data-a="jouer" aria-label="Lire">'+ico('lire',18)+'</button>'
      +'<button type="button" class="ml-b mla-b" data-a="suiv" aria-label="Image suivante">'+ico('suiv',16)+'</button>'
      +'<input type="range" class="mla-pos" min="0" max="1000" step="1" value="0" aria-label="Position dans la vidéo">'
      +'<span class="mla-temps">0:00</span>'
    +'</div>'
    +'<div class="mla-cmd mla-cmd2">'
      +VID_RATES.map(r=>'<button type="button" class="ml-b mla-v" data-rate="'+r+'" aria-pressed="'+(r===1)+'">'+String(r).replace('.',',')+'×</button>').join('')
      +'<span class="mlx-esp"></span>'
      +'<button type="button" class="ml-b mla-b mla-orig" data-a="orig" aria-pressed="false">'+ico('orig',16)+'<span>Version originale</span></button>'
      +'<button type="button" class="ml-b mla-b" data-a="plein" aria-label="Plein écran">'+ico('plein',16)+'</button>'
      +'<button type="button" class="ml-b mla-b mla-export" data-a="export" title="Une vidéo où les tracés sont gravés">'+ico('export',16)+'<span>Télécharger</span></button>'
    +'</div>'
    +'<div class="mla-liste"></div>'
  +'</div>';
  const video=/** @type {HTMLVideoElement} */(hote.querySelector('.mla-video'));
  const calque=/** @type {HTMLCanvasElement} */(hote.querySelector('.mla-calque'));
  const scene=/** @type {HTMLElement} */(hote.querySelector('.mla-scene'));
  const pos=/** @type {HTMLInputElement} */(hote.querySelector('.mla-pos'));
  const temps=/** @type {HTMLElement} */(hote.querySelector('.mla-temps'));
  const bJouer=/** @type {HTMLElement} */(hote.querySelector('.mla-jouer'));
  const grand=/** @type {HTMLElement} */(hote.querySelector('.mla-grand'));
  const liste=/** @type {HTMLElement} */(hote.querySelector('.mla-liste'));
  let original=false, raf=0, detruit=false;
  const visibles=doc.a.filter(a=>!a.h);
  // LA LISTE DES TRACÉS : un toucher amène la vidéo à l'instant où il paraît.
  liste.innerHTML=visibles.length?'<div class="ml-lab" style="margin-top:14px">Ce que ton coach a tracé</div>'
    +visibles.map((a,i)=>'<button type="button" class="ml-carte-l ml-carte-b mla-an" data-i="'+i+'">'
      +'<i class="mlx-an-pt" style="--c:'+a.c+'"></i><span class="ml-carte-x">'+escapeHtml(a.t==='texte'?(a.x||a.n):a.n)+'</span>'
      +'<span class="ml-carte-t">'+_mlDureeCourte(a.d)+'</span></button>').join(''):'';
  const dessiner=()=>{
    if(detruit) return;
    const dpr=Math.min(2,window.devicePixelRatio||1), W=video.clientWidth, H=video.clientHeight;
    if(calque.width!==Math.round(W*dpr)||calque.height!==Math.round(H*dpr)){ calque.width=Math.round(W*dpr); calque.height=Math.round(H*dpr); }
    const g=calque.getContext('2d');
    if(!g) return;
    g.setTransform(dpr,0,0,dpr,0,0); g.clearRect(0,0,W,H);
    const R=_mlVideoRect(video);
    const sMs=(Number(video.currentTime)||0)*1000;
    if(R&&!original) mlDessinerAnnotations(g,R,doc,sMs,{});
    const d=Number(video.duration);
    if(isFinite(d)&&d>0){
      if(document.activeElement!==pos) pos.value=String(Math.round(sMs/(d*1000)*1000));
      pos.style.setProperty('--p',(sMs/(d*10)).toFixed(2)+'%');
      temps.textContent=_mlDureeCourte(sMs)+' / '+_mlDureeCourte(d*1000);
    }
  };
  const boucle=()=>{ dessiner(); if(!video.paused&&!video.ended&&!detruit) raf=requestAnimationFrame(boucle); };
  const majJouer=()=>{
    const joue=!video.paused&&!video.ended;
    bJouer.innerHTML=ico(joue?'pause':'lire',18);
    bJouer.setAttribute('aria-label',joue?'Mettre en pause':'Lire');
    grand.hidden=joue;
  };
  const jouer=()=>{ const p=video.play(); if(p&&p.catch) p.catch(()=>{}); };
  const pause=()=>{ if(!video.paused) video.pause(); };
  const aller=(/** @type {number} */ ms)=>{ try{ video.currentTime=Math.max(0,ms/1000); }catch(e){} dessiner(); };
  video.addEventListener('play',()=>{ majJouer(); const r=Number(video.dataset.rate||1); if(r!==1) videoSetRate(video,r); cancelAnimationFrame(raf); raf=requestAnimationFrame(boucle); });
  video.addEventListener('pause',()=>{ majJouer(); dessiner(); });
  video.addEventListener('ended',()=>{ majJouer(); });
  ['loadedmetadata','loadeddata','seeked','timeupdate'].forEach(ev=>video.addEventListener(ev,()=>{ if(video.paused) dessiner(); }));
  video.onerror=()=>{
    if(detruit) return;
    scene.innerHTML='<p class="mlc-absente">Vidéo indisponible.<br>Elle a peut-être été supprimée, ou la connexion manque.</p>';
  };
  grand.onclick=jouer;
  video.onclick=()=>{ video.paused?jouer():pause(); };
  pos.oninput=()=>{ const d=Number(video.duration); if(isFinite(d)&&d>0) aller(Number(pos.value)/1000*d*1000); };
  hote.addEventListener('click',e=>{
    const b=/** @type {HTMLElement|null} */(e.target instanceof Element?e.target.closest('button'):null);
    if(!b||!hote.contains(b)) return;
    const act=b.dataset.a;
    if(act==='jouer'){ video.paused?jouer():pause(); return; }
    if(act==='prec'||act==='suiv'){
      pause();
      aller((Number(video.currentTime)||0)*1000+(act==='prec'?-1:1)*mlPasImageMs(videoDetectFps(video)));
      return;
    }
    if(act==='export'){
      pause();
      mlOuvrirExport({url:o.url,annot:doc,nom:o.nom||'video',sequence:null,dureeMs:(Number(video.duration)||0)*1000,logo:o.logo||'',
        libLogo:'Le logo de mon coach en bas à droite'});
      return;
    }
    if(act==='orig'){ original=!original; b.setAttribute('aria-pressed',String(original)); scene.classList.toggle('mlx-original',original); dessiner(); return; }
    if(act==='plein'){
      const s=/** @type {any} */(scene), v=/** @type {any} */(video);
      try{
        if(document.fullscreenElement) document.exitFullscreen();
        else if(s.requestFullscreen){ const p=s.requestFullscreen(); if(p&&p.catch) p.catch(()=>{}); }
        else if(v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      }catch(x){}
      return;
    }
    if(b.dataset.rate){
      const r=videoSetRate(video,Number(b.dataset.rate));
      if(r==null) return;
      video.dataset.rate=String(r);
      hote.querySelectorAll('.mla-v').forEach(x=>x.setAttribute('aria-pressed',String(Math.abs(Number(/** @type {HTMLElement} */(x).dataset.rate)-r)<1e-6)));
      return;
    }
    if(b.classList.contains('mla-an')){
      const a=visibles[Number(b.dataset.i)];
      if(a){ pause(); aller(a.d); }
    }
  });
  const redim=()=>{ if(!detruit) dessiner(); };
  window.addEventListener('resize',redim);
  document.addEventListener('fullscreenchange',redim);
  return {pause,aller,detruire:()=>{
    detruit=true; cancelAnimationFrame(raf); pause();
    window.removeEventListener('resize',redim); document.removeEventListener('fullscreenchange',redim);
    hote.innerHTML='';
  }};
}

// ── L'écran de l'athlète ────────────────────────────────────────────────────
/** @type {{lecteur:ReturnType<typeof mlLecteurCorrection>|null, annote:ReturnType<typeof mlLecteurAnnote>|null, m:Correction|null, url:string}} */
const _mlc={lecteur:null,annote:null,m:null,url:''};
/**
 * L'écran de la correction : la vidéo ANNOTÉE — les tracés du coach à leurs
 * instants — et, s'il en a enregistré une, la correction COMMENTÉE sous sa
 * voix. L'une ou l'autre peut manquer, pas les deux.
 * @param {any} u  le dossier de l'athlète
 * @param {any} v  l'entrée de la vidéo
 * @returns {boolean}
 */
function mlAfficherCorrection(u,v){
  _mlInjecterStyle();
  mlQuitterCorrection();
  const z=_mlEl('mlc-contenu');
  const m=/** @type {Correction|null} */(motionCorrectionValide(v&&v.motion));
  const an=/** @type {DocAnnot|null} */(annotValide(v&&v.annot));
  const aAnnot=!!(an&&an.a.some(x=>!x.h));
  if(!z||(!m&&!aAnnot)) return false;
  const t=_mlEl('mlc-titre'); if(t) t.textContent=String(v.name||'Correction');
  const segs=segmentsVideo(v);
  const mesures=segs.filter(s=>/** @type {any} */(s).barre);
  const coach=currentUser&&currentUser.role==='coach';
  const date=m&&m.envoyeLe?m.envoyeLe:(an&&an.majLe?an.majLe:0);
  z.innerHTML='<div class="ml-sous">Correction de ton coach'
      +(date?' · '+new Date(date).toLocaleDateString('fr-FR'):'')+(m?' · '+_mlDureeCourte(m.dureeMs)+' commentées':'')+'</div>'
    +(aAnnot?'<div class="ml-lab" style="margin-top:6px">Ta vidéo annotée</div><div id="mlc-annot"></div>':'')
    +(m?(aAnnot?'<div class="ml-lab" style="margin-top:18px">La correction commentée · '+_mlDureeCourte(m.dureeMs)+'</div>':'')
      +'<div id="mlc-lecteur"></div>'
      +(m.cartes.length?'<div class="ml-lab" style="margin-top:16px">Corrections écrites</div><div class="ml-cartes">'
        +m.cartes.map((k,i)=>'<button type="button" class="ml-carte-l ml-carte-b" onclick="mlCorrectionCarte('+i+')">'
          +'<span class="ml-carte-t">'+mlTempsTexte(k.aMs)+'</span><span class="ml-carte-x">'+escapeHtml(k.texte)+'</span></button>').join('')+'</div>':''):'')
    +(mesures.length?'<div class="ml-lab" style="margin-top:16px">Tes mesures</div>'
      +mesures.map(s=>{ const b=/** @type {any} */(s).barre, mm=b.m||{};
        return '<div class="ml-metr ml-metr-l"><div><b>'+mlNombre(mm.vMax,2)+' m/s</b><span>'+escapeHtml(s.label)+' · vitesse max</span></div>'
          +'<div><b>'+mlNombre(mm.hMax,2)+' m</b><span>'+escapeHtml(s.label)+' · hauteur max</span></div></div>'; }).join(''):'')
    +'<div class="ml-traj-cmd" style="margin-top:16px"><button type="button" class="btn btn-outline btn-sm" onclick="mlVoirOrigine()">Voir ma vidéo d’origine</button>'
      +(coach?'':'<button type="button" class="btn btn-outline btn-sm" onclick="repondreCorrectionMotion()">Répondre à mon coach</button>')+'</div>'
    +'<div id="mlc-origine"></div>';
  _mlc.m=m; _mlc.url=String(v.url||'');
  const ha=_mlEl('mlc-annot');
  // LE LOGO DU COACH signe la vidéo que l'athlète télécharge — et partage.
  const logoCoach=(()=>{ try{ const c=/** @type {any} */(window).coachAffichable(u); return String((c&&c.logo)||'').trim(); }catch(e){ return ''; } })();
  if(ha&&an&&aAnnot) _mlc.annote=mlLecteurAnnote(ha,{url:_mlc.url,annot:an,nom:String(v.name||'video'),logo:logoCoach});
  const hote=_mlEl('mlc-lecteur');
  if(hote&&m) _mlc.lecteur=mlLecteurCorrection(hote,{url:_mlc.url,correction:m,segments:segs,voixUrl:m.voix?m.voix.url:'',
    annot:aAnnot?an:null});
  return true;
}
function mlQuitterCorrection(){
  try{ mlFermerExport(); }catch(e){}
  if(_mlc.lecteur){ _mlc.lecteur.detruire(); _mlc.lecteur=null; }
  if(_mlc.annote){ _mlc.annote.detruire(); _mlc.annote=null; }
  const o=_mlEl('mlc-origine'); if(o) o.innerHTML='';
  return true;
}
/** @param {number} i */
function mlCorrectionCarte(i){
  const m=_mlc.m, k=m&&m.cartes[i];
  if(!m||!k||!_mlc.lecteur) return false;
  const T=mlInstantDeCarte(m,k);
  if(T<0){ toast('La séquence ne passe pas par ce moment : ouvre ta vidéo d’origine pour le voir.'); return false; }
  _mlc.lecteur.pause();
  _mlc.lecteur.aller(T);
  return true;
}
function mlVoirOrigine(){
  const o=_mlEl('mlc-origine');
  if(!o) return false;
  if(o.innerHTML){ o.innerHTML=''; return true; }
  if(_mlc.lecteur) _mlc.lecteur.pause();
  if(_mlc.annote) _mlc.annote.pause();
  o.innerHTML='<video class="mlc-origine" src="'+safeUrl(_mlc.url)+'" controls playsinline webkit-playsinline preload="metadata"></video>';
  return true;
}

// ══ LE STYLE ══════════════════════════════════════════════════════════════════
// INJECTÉ UNE FOIS, avec le module : un athlète qui n'ouvre jamais le
// laboratoire ne paie ni le script ni ses règles. Les jetons viennent de
// :root, déclarés dans index.html.
function _mlInjecterStyle(){
  if(document.getElementById('ml-style')) return;
  const s=document.createElement('style');
  s.id='ml-style';
  s.textContent=[
    '.ml-sous{font-size:var(--fs-xs);color:var(--text-faint);margin:10px 0 8px}',
    // « ENREGISTRER » GRISE TANT QU'IL N'Y A RIEN À ENREGISTRER : désactivé mais
    // aussi rouge qu'actif, il laissait croire que le geste était attendu.
    '#ml-enreg:disabled{opacity:.4;box-shadow:none;cursor:default}',
    '.ml-scene{position:relative;background:#000;border:1px solid var(--border);border-radius:var(--r-3);overflow:hidden}',
    '.ml-scene video{display:block;width:100%;max-height:42vh;max-height:42dvh;object-fit:contain;background:#000}',
    // LA GRILLE. `minmax(0,…)` sur les deux colonnes : sans le 0, une frise
    // large impose sa largeur minimale à sa piste et déborde la fenêtre.
    '@media (min-width:1000px){',
    '  .ml-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(380px,1fr);gap:20px;align-items:start}',
    // LA VIDÉO SUIT LE DÉFILEMENT : la liste des répétitions et les panneaux
    // d'analyse sont longs, et régler sans voir l'image n'a pas de sens.
    '  .ml-col-video{position:sticky;top:8px}',
    '  .ml-col-video .ml-scene video{max-height:70vh;max-height:70dvh}',
    // Le premier bloc de la colonne de droite monte au ras du haut : sa marge
    // servait à le séparer de la vidéo, qui n'est plus au-dessus de lui.
    '  .ml-col-panneau>.ml-frise-tete:first-child{margin-top:0}',
    '}',
    '.ml-temps{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:8px 2px 0}',
    '#ml-t{font-family:var(--pile-titre);font-size:var(--fs-xl);letter-spacing:1px;color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ml-fps{font-size:var(--fs-2xs);color:var(--text-faint);text-align:right;line-height:1.4}',
    '.ml-cmd,.ml-vit{display:flex;gap:6px;margin-top:8px}',
    '.ml-vit{margin-top:6px}.ml-vit .ml-b{flex:1;min-height:38px}',
    '.ml-b{min-height:44px;min-width:44px;padding:0 10px;border-radius:var(--r-2);background:var(--surface-1);border:1px solid var(--border);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:.3px;cursor:pointer}',
    '.ml-b:disabled{opacity:.4;cursor:default}',
    '.ml-b[aria-pressed="true"]{border-color:var(--red);background:rgba(224,32,32,.12)}',
    '.ml-b-plein{flex:1;background:linear-gradient(160deg,#e21414,#8d0000);border-color:rgba(255,90,90,.4)}',
    '.ml-lab{font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.8px;text-transform:uppercase;color:var(--sub)}',
    '.ml-frise-tete{display:flex;align-items:center;justify-content:space-between;margin:16px 0 6px}',
    '.ml-zoom{display:flex;align-items:center;gap:6px}',
    '.ml-zoom .ml-b{min-width:40px;min-height:40px;padding:0;font-size:var(--fs-lg)}',
    '#ml-zoom-val{min-width:26px;text-align:center;font-size:var(--fs-xs);font-weight:800;color:var(--sub)}',
    '.ml-frise{position:relative;overflow-x:auto;overflow-y:hidden;background:#0a0a0a;border:1px solid var(--border);border-radius:var(--r-2);-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:thin}',
    '.ml-frise-in{position:relative;height:100px;min-width:100%;cursor:pointer}',
    '.ml-vign{position:absolute;left:0;top:12px;width:100%;height:56px;display:block}',
    '.ml-regle{position:absolute;left:0;bottom:0;width:100%;height:22px;display:block}',
    '.ml-autre{position:absolute;top:12px;height:56px;background:rgba(255,255,255,.12);border-left:1px solid rgba(255,255,255,.4);border-right:1px solid rgba(255,255,255,.4)}',
    '.ml-autre span{position:absolute;left:4px;top:3px;font-size:10px;font-weight:800;color:#fff;text-shadow:0 1px 3px #000;white-space:nowrap;pointer-events:none}',
    '.ml-sel{position:absolute;top:10px;height:60px;border:2px solid var(--red);border-radius:4px;background:rgba(224,32,32,.16);pointer-events:none}',
    '.ml-poignee{position:absolute;top:0;width:44px;height:80px;margin-left:-22px;touch-action:none;cursor:ew-resize;z-index:2}',
    '.ml-poignee[hidden]{display:none}',
    '.ml-poignee i{position:absolute;left:50%;top:8px;width:14px;height:64px;margin-left:-7px;border-radius:4px;background:var(--red);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 2px 8px rgba(0,0,0,.5)}',
    '.ml-poignee i::after{content:"";position:absolute;left:4px;top:24px;width:4px;height:16px;border-left:1px solid rgba(255,255,255,.85);border-right:1px solid rgba(255,255,255,.85)}',
    '.ml-poignee:focus-visible{outline:none}.ml-poignee:focus-visible i{outline:2px solid #fff;outline-offset:2px}',
    '.ml-tete{position:absolute;left:0;top:6px;width:2px;height:68px;margin-left:-1px;background:#fff;box-shadow:0 0 6px rgba(255,255,255,.55);pointer-events:none;z-index:1}',
    '.ml-bornes{margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 12px}',
    '.ml-borne{display:flex;align-items:center;gap:6px}.ml-borne+.ml-borne{margin-top:8px}',
    '.ml-borne .ml-lab{width:54px;flex:0 0 auto}',
    '.ml-val{flex:1;min-width:0;font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:.8px;color:var(--text);font-variant-numeric:tabular-nums}',
    '.ml-borne-pied{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}',
    '#ml-duree{font-size:var(--fs-xs);color:var(--sub);font-weight:700;text-align:right}',
    '.ml-rep{display:flex;align-items:center;gap:8px;min-height:48px;margin-top:8px;padding:4px 4px 4px 12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);cursor:pointer}',
    '.ml-rep-on{border-color:var(--red);background:rgba(224,32,32,.08)}',
    '.ml-rep-n{flex:0 0 auto;font-size:var(--fs-sm);font-weight:800;color:var(--text)}',
    '.ml-rep-t{flex:1;min-width:0;font-size:var(--fs-xs);color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}',
    '.ml-mini{flex:0 0 auto;width:40px;height:40px;background:none;border:1px solid transparent;border-radius:var(--r-2);color:var(--text-faint);font-size:16px;cursor:pointer}',
    '.ml-mini:hover{color:var(--text);border-color:var(--border)}',
    '.ml-vide{font-size:var(--fs-sm);color:var(--sub);padding:8px 0 2px}',
    // ── Lot 3 : la trajectoire ──
    '.ml-calque{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '.ml-calque-actif{pointer-events:auto;cursor:crosshair;touch-action:none}',
    '.ml-loupe{position:absolute;left:8px;top:8px;width:110px;height:110px;border:2px solid var(--arc-current,#4DE8FF);border-radius:var(--r-2);background:#000;pointer-events:none}',
    '.ml-loupe[hidden]{display:none}',
    '.ml-rep-traj{font-weight:800;color:var(--arc-current,#4DE8FF)}',
    '.ml-suiv{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}',
    '.ml-suiv li{display:flex;align-items:center;gap:8px;background:var(--surface-2);border-radius:var(--r-2);padding:2px 2px 2px 10px}',
    '.ml-suiv b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--fs-sm)}',
    '.ml-suiv-pastille{flex:none;width:12px;height:12px;border-radius:50%;background:var(--c)}',
    '.ml-suiv-etat{flex:none;font-size:var(--fs-xs);color:var(--orange)}',
    '.ml-traj{margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 12px}',
    '.ml-traj-tete{display:flex;align-items:center;justify-content:space-between;min-height:32px}',
    '.ml-traj-aide{font-size:var(--fs-xs);color:var(--sub);line-height:1.55;margin:6px 0 0}',
    '.ml-traj-cmd{display:flex;gap:8px;margin-top:10px}.ml-traj-cmd .btn{flex:1;margin:0;min-height:44px}',
    '.ml-champ{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:var(--fs-xs);color:var(--sub);font-weight:700}',
    '.ml-champ input[type=range]{flex:1;max-width:60%;accent-color:var(--red)}',
    '.ml-cm{display:flex;align-items:center;gap:6px}.ml-cm input{width:72px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);padding:8px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm);text-align:right}.ml-cm i{font-style:normal}',
    '.ml-choix{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.ml-choix .ml-b{min-height:38px;padding:0 8px}',
    '.ml-progres{height:6px;margin-top:10px;background:var(--surface-2);border-radius:3px;overflow:hidden}',
    '.ml-progres i{display:block;height:100%;background:var(--arc-current,#4DE8FF);transform:scaleX(0);transform-origin:left}',
    '.ml-metr{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}',
    '.ml-metr div{background:var(--surface-2);border-radius:var(--r-2);padding:8px 10px;min-width:0}',
    '.ml-metr b{display:block;font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:.6px;color:var(--text);font-weight:400;white-space:nowrap}',
    '.ml-metr span{display:block;font-size:var(--fs-2xs);color:var(--sub);line-height:1.35;margin-top:2px}',
    '.ml-courbe{display:block;width:100%;height:92px;margin-top:10px;background:#0a0a0a;border-radius:var(--r-2)}',
    // LES TROIS PHRASES. Elles occupent la tête du panneau parce que ce sont
    // elles qu'on lit ; les compteurs sont descendus dans un repli.
    '.ml-phrases{display:flex;flex-direction:column;gap:8px;margin-top:8px}',
    '.ml-phrase{display:flex;align-items:flex-start;gap:8px;background:var(--surface-2);border-radius:var(--r-2);border-left:2px solid var(--arc-current);padding:9px 11px;font-size:var(--fs-sm);line-height:1.55;color:var(--text)}',
    // UNE PHRASE QUI NE SE MESURE PAS RESTE LISIBLE, en gris : elle dit
    // pourquoi et quoi faire, et c'est la moitié de la valeur de l'outil.
    '.ml-phrase-vide{border-left-color:var(--arc-calm);color:var(--sub)}',
    '.ml-phrase-t{flex:none;min-height:24px;padding:0 7px;border-radius:var(--r-full,99px);background:#0a0a0a;border:1px solid var(--border);color:var(--text-dim);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;cursor:pointer}',
    '.ml-phrase .ml-mini{flex:none;margin-left:auto}',
    '.ml-repli{margin-top:10px}',
    '.ml-repli>summary{cursor:pointer;font-size:var(--fs-2xs);letter-spacing:1.2px;font-weight:800;text-transform:uppercase;color:var(--sub);min-height:32px;display:flex;align-items:center}',
    // LE TABLEAU DE LA SÉRIE. Six colonnes tiennent en 375 px parce que
    // chacune est un chiffre court ; au-delà, il défilerait, et un tableau
    // qui défile ne se compare plus d'une ligne à l'autre.
    '.ml-tab{margin-top:8px;border:1px solid var(--border);border-radius:var(--r-2);overflow:hidden}',
    '.ml-tr{display:grid;grid-template-columns:1.1fr 1fr 1fr 1.2fr 1fr 1fr;gap:2px;padding:7px 8px;font-size:var(--fs-2xs);color:var(--text);border-top:1px solid var(--border);align-items:center}',
    '.ml-tr:first-child{border-top:none}',
    '.ml-tr span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ml-th{background:#0a0a0a;color:var(--sub);font-weight:800;letter-spacing:.4px;text-transform:uppercase}',
    '.ml-tr-vide{color:var(--text-faint)}',
    '.ml-tr-best{box-shadow:inset 2px 0 0 var(--arc-current)}',
    '.ml-tr-last{box-shadow:inset 2px 0 0 var(--arc-charge)}',
    '.ml-phases{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.ml-phase{min-height:36px;padding:0 10px;border-radius:var(--r-full,99px);background:var(--surface-2);border:1px solid var(--border);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;cursor:pointer}',
    '.ml-phase i{font-style:normal;color:var(--sub);font-weight:700}',
    '.ml-doute{border-color:rgba(255,68,56,.45)}',
    // Les <label> de l'application sont en capitales espacées : ici c'est une
    // phrase, on la rend à son style.
    '.ml-coche,.ml-champ{text-transform:none;letter-spacing:normal}',
    '.ml-coche{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:var(--fs-xs);font-weight:600;color:var(--sub);cursor:pointer}.ml-coche input{accent-color:var(--red);width:18px;height:18px;margin:0}',
    '.ml-alertes{margin:10px 0 0;padding-left:18px;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55}',
    '.ml-perf{font-size:var(--fs-2xs);color:var(--text-faint);margin:8px 0 0}',
    '.ml-refaire{width:36px;height:36px}',
    // ── Lots 5 et 6 : la correction ──
    '.ml-rec{position:sticky;top:0;z-index:5;margin:0 -14px 10px;padding:8px 14px;background:rgba(12,6,6,.96);border-bottom:1px solid rgba(224,32,32,.45)}',
    '.ml-rec[hidden]{display:none}',
    '.ml-rec-l1,.ml-rec-l2{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.ml-rec-l2{margin-top:6px}',
    '.ml-rec-l1 .ml-b,.ml-rec-l2 .ml-b{min-height:38px;padding:0 9px}',
    '.ml-rec-point{width:12px;height:12px;border-radius:50%;background:var(--red);flex:0 0 auto;box-shadow:0 0 8px rgba(224,32,32,.8)}',
    '.ml-rec-pause{background:var(--sub);box-shadow:none}',
    '.ml-rec-t{font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:1px;color:var(--text);font-variant-numeric:tabular-nums}',
    '.ml-rec-etat{flex:1;min-width:0;font-size:var(--fs-2xs);color:var(--sub);font-weight:700}',
    '.ml-pastille{width:34px;height:34px;border-radius:50%;border:2px solid var(--border);background:var(--c);cursor:pointer;flex:0 0 auto}',
    '.ml-pastille[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.25)}',
    '.ml-statut{font-weight:800}',
    '.ml-statut-envoye{color:var(--green,#22c55e)}.ml-statut-erreur{color:var(--red-text)}.ml-statut-envoi{color:var(--orange)}',
    '.ml-corr-lecteur{margin-top:10px}',
    '.ml-cartes{display:flex;flex-direction:column;gap:6px;margin-top:8px}',
    '.ml-carte-l{display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);padding:8px 10px;width:100%;text-align:left}',
    '.ml-carte-b{cursor:pointer;color:var(--text);font-family:Montserrat,sans-serif;min-height:44px}',
    '.ml-carte-t{flex:0 0 auto;font-family:var(--pile-titre);font-size:var(--fs-md);color:var(--red-text);letter-spacing:.5px}',
    '.ml-carte-x{flex:1;min-width:0;font-size:var(--fs-sm);color:var(--text);line-height:1.4}',
    '.ml-carte-saisie{display:flex;gap:6px;margin-top:8px}.ml-carte-saisie .vn-in{margin:0}',
    '.ml-carte-saisie select{flex:0 0 76px}',
    '.ml-modele{display:inline-flex;align-items:center;gap:2px}',
    '.ml-modele-x{background:none;border:none;color:var(--text-faint);font-size:15px;cursor:pointer;padding:0 4px;min-height:36px}',
    // Le lecteur de correction, chez le coach comme chez l'athlète.
    '.mlc{margin-top:8px}',
    '.mlc-scene{position:relative;background:#000;border:1px solid var(--border);border-radius:var(--r-3);overflow:hidden}',
    '.mlc-video{display:block;width:100%;max-height:46vh;max-height:46dvh;object-fit:contain;background:#000}',
    '.mlc-calque{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '.mlc-carte{position:absolute;left:10px;right:10px;bottom:10px;padding:9px 12px;border-radius:var(--r-2);background:rgba(8,8,8,.86);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:var(--fs-sm);font-weight:700;line-height:1.4;text-align:center}',
    '.mlc-carte[hidden]{display:none}',
    '.mlc-grand{position:absolute;left:50%;top:50%;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.45);color:#fff;font-size:24px;cursor:pointer}',
    '.mlc-grand[hidden]{display:none}',
    '.mlc-cmd{display:flex;align-items:center;gap:10px;margin-top:8px}',
    '.mlc-barre{flex:1;height:26px;display:flex;align-items:center;cursor:pointer}',
    '.mlc-barre::before{content:"";position:absolute;width:0}',
    '.mlc-barre i{display:block;width:100%;height:6px;border-radius:3px;background:var(--arc-current,#4DE8FF);transform:scaleX(0);transform-origin:left;box-shadow:0 0 0 100vmax transparent}',
    '.mlc-barre{position:relative;background:linear-gradient(var(--surface-2),var(--surface-2)) center/100% 6px no-repeat;border-radius:3px}',
    '.mlc-temps{font-size:var(--fs-2xs);color:var(--sub);font-variant-numeric:tabular-nums;flex:0 0 auto}',
    '.mlc-origine{display:block;width:100%;max-height:46vh;margin-top:10px;border-radius:var(--r-2);background:#000}',
    '.ml-metr-l{grid-template-columns:1fr 1fr;margin-top:8px}',
    '.ml-aide{font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin:10px 0 0}',
    '.ml-ang{margin-top:8px;justify-content:flex-start}',
    // LE VERDICT DE PRISE DE VUE : trois niveaux, sur la VIDÉO. Pas de vert ni
    // de rouge de feu tricolore — le calme, le cyan et l'orange de l'app.
    '.ml-niv{font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;padding:3px 9px;border-radius:var(--r-full,99px);border:1px solid}',
    '.ml-niv-ok{color:var(--arc-current,#4DE8FF);border-color:rgba(77,232,255,.5)}',
    '.ml-niv-reserve{color:var(--orange);border-color:rgba(255,160,0,.5)}',
    '.ml-niv-refilmer{color:var(--red-text);border-color:rgba(224,32,32,.5)}',
    '.ml-prise-l{list-style:none;padding-left:0}',
    '.ml-prise-l li{padding-left:16px;position:relative;margin-bottom:2px}',
    '.ml-prise-l li::before{position:absolute;left:0;top:0}',
    '.ml-pt-ok::before{content:"·";color:var(--arc-current,#4DE8FF)}',
    '.ml-pt-reserve::before{content:"!";color:var(--orange)}',
    '.ml-pt-refilmer::before{content:"×";color:var(--red-text)}',
    '.ml-pt-inconnu::before{content:"?";color:var(--text-faint)}',
    // LE SOUS-TITRE GARDE SA PLACE, vide ou plein : sans hauteur minimale,
    // les commandes sauteraient à chaque phrase.
    '.mlc-st{min-height:19px;margin:8px 0 0;font-size:var(--fs-xs);color:var(--sub);line-height:1.45;text-align:center}',
    // LE CALQUE ALLUMÉ PORTE SA COULEUR, celle de son arc sur la vidéo :
    // sans elle, trois angles allumés ensemble ne se rattachent à rien.
    '.ml-ang-b[aria-pressed="true"]{border-color:var(--c,var(--red));color:var(--c,var(--text));background:rgba(255,255,255,.06)}',
    '.ml-ang-b:disabled{opacity:.35}',
    '.mlc-absente{padding:26px 18px;margin:0;text-align:center;font-size:var(--fs-sm);color:var(--sub);line-height:1.6}',
    // ── Lot 7 : le mouvement, et rien qu'aux changements d'état ─────────────
    // ⚠ AUCUNE RÈGLE « prefers-reduced-motion » ICI, et ce n'est pas un oubli :
    // la feuille de l'application ramène déjà tous les crans à 1 ms et coupe
    // les boucles qui portent .fx-loop. Tout passe ici par les jetons, donc
    // tout suit — une règle de plus se contenterait de mentir sur son utilité.
    // ⚠ NI LA SÉLECTION, NI LA TÊTE DE LECTURE, NI LES POIGNÉES : elles sont
    // posées au pixel pendant le glissé, une transition les ferait traîner
    // derrière le doigt.
    '.ml-b{transition:background var(--t-1),border-color var(--t-1),color var(--t-1),transform var(--arc-strike) var(--arc-c-discharge)}',
    '.ml-b:active:not(:disabled){transform:scale(var(--arc-scale-charge));transition:transform var(--arc-attack) var(--arc-c-charge)}',
    '.ml-rep{transition:background var(--t-1),border-color var(--t-1),transform var(--arc-strike) var(--arc-c-discharge)}',
    '.ml-rep:active{transform:scale(var(--arc-scale-charge));transition:transform var(--arc-attack) var(--arc-c-charge)}',
    '.ml-phase,.ml-pastille{transition:transform var(--arc-strike) var(--arc-c-discharge)}',
    '.ml-phase:active,.ml-pastille:active{transform:scale(var(--arc-scale-charge));transition:transform var(--arc-attack) var(--arc-c-charge)}',
    // LA JAUGE D'ANALYSE avance d'une image à l'autre : sans ce lissage, elle
    // sautille à chaque pas au lieu de courir.
    '.ml-progres i{transition:transform var(--arc-strike) linear}',
    // LE POINT D'ENREGISTREMENT respire tant que ça tourne, et se fige en pause :
    // c'est le seul endroit de l'écran qui dit que la voix est prise.
    '@keyframes mlPouls{from{opacity:1}to{opacity:.3}}',
    '.ml-rec-point:not(.ml-rec-pause){animation:mlPouls calc(var(--arc-ambient)/2) var(--arc-c-discharge) infinite alternate}',
    // « ENVOYÉE ✓ » : une lueur, une seule, à l'instant où l'état bascule.
    '@keyframes mlLueur{from{opacity:.2}to{opacity:1}}',
    '.ml-statut-envoye{animation:mlLueur var(--arc-afterglow) var(--arc-c-discharge) both}',
    // LA CARTE DU COACH monte sous la vidéo à chaque nouvelle carte, pour qu'on
    // voie qu'il en est arrivé une autre même quand les mots se ressemblent.
    '@keyframes mlcCarte{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.mlc-carte-in{animation:mlcCarte var(--arc-release) var(--arc-c-discharge) both}',
    // ── LA REFONTE (21/09/2026) : un logiciel d'analyse en paysage ──────────
    // TOUTE LA LARGEUR : le laboratoire a sa propre flèche de retour, et la
    // barre latérale du coach lui prenait deux cent soixante pixels.
    '@media (min-width:1025px){body:has(#s-coach-motion-lab.active){max-width:none}body:has(#s-coach-motion-lab.active) #ch-sidebar{display:none!important}body:has(#s-coach-motion-lab.active) #s-coach-motion-lab{padding-left:0}}',
    '#s-coach-motion-lab .scroll-area{padding:0 16px 16px}',
    '.mlx{display:flex;flex-direction:column;gap:12px;padding-top:12px;color:var(--text)}',
    '.mlx-esp{flex:1 1 auto}',
    '.mlx-tete{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
    '.mlx-retour{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 16px 0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:600;cursor:pointer}',
    '.mlx-retour:hover,.mlx-ico-b:hover:not(:disabled),.mlx-pied-b:hover{border-color:rgba(255,255,255,.3)}',
    '.mlx-marque{padding-left:14px;border-left:1px solid rgba(255,255,255,.12)}',
    '.mlx .mlx-titre{margin:0;font-size:34px;font-weight:400;line-height:1;letter-spacing:1px;text-transform:uppercase;color:var(--text)}',
    '.mlx-titre em{font-style:normal;color:var(--red)}',
    '.mlx-sous-t{margin:4px 0 0;font-size:var(--fs-xs);color:var(--sub)}',
    '.mlx-pilule{display:flex;align-items:center;gap:12px;min-height:52px;min-width:0;padding:6px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03)}',
    '.mlx-pilule svg{flex:0 0 auto;color:var(--text)}',
    '.mlx-pilule div{display:flex;flex-direction:column;min-width:0}',
    '.mlx-pilule b{max-width:280px;font-size:var(--fs-sm);font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.mlx .mlx-pilule .ml-sous{margin:2px 0 0;font-size:var(--fs-2xs);color:var(--sub)}',
    '.mlx-ico-b{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;flex:0 0 auto;padding:0;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);cursor:pointer}',
    '.mlx-ico-b:disabled{opacity:.35;cursor:default}',
    '.mlx-ico-p{width:34px;height:34px;border-radius:8px}',
    '.mlx-histo{display:inline-flex;gap:6px}',
    '.mlx-menu-z{position:relative}',
    '.mlx-menu{position:absolute;top:52px;left:0;z-index:30;min-width:240px;padding:6px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#111;box-shadow:0 18px 40px rgba(0,0,0,.6)}',
    '.mlx-menu[hidden]{display:none}',
    '.mlx-menu button{display:block;width:100%;padding:11px 12px;border:none;border-radius:8px;background:none;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);text-align:left;cursor:pointer}',
    '.mlx-menu button:hover{background:rgba(255,255,255,.06)}',
    '.mlx-devise{display:flex;align-items:center;gap:12px;pointer-events:none}',
    '.mlx-devise i{display:block;width:44px;height:1.5px;background:linear-gradient(90deg,rgba(224,32,32,0),var(--red))}',
    '.mlx-devise span{font-size:9px;letter-spacing:2px;color:var(--sub);text-transform:uppercase;white-space:nowrap}',
    '.mlx-logo{display:block;height:46px;width:auto;max-width:150px;object-fit:contain;padding-left:14px;border-left:1px solid rgba(255,255,255,.14)}',
    // LA GRILLE : la vidéo au milieu prend tout ce qui reste.
    '.mlx-grille{display:grid;grid-template-columns:minmax(230px,17%) minmax(0,1fr) minmax(340px,27%);gap:12px;align-items:start}',
    '.mlx-g,.mlx-d{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.mlx-carte{padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))}',
    '.mlx-ct{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px;margin:-2px 0 10px;padding-left:10px;border-left:3px solid var(--red);font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--text)}',
    '.mlx-intro{margin:0;font-size:var(--fs-xs);color:var(--sub);line-height:1.55}',
    '.mlx-note{display:block;margin:6px 0 0;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;text-transform:none;letter-spacing:0;font-weight:500}',
    '.mlx-vide{margin:4px 0;font-size:var(--fs-xs);color:var(--sub);line-height:1.5}',
    '.mlx-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:34px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:700;letter-spacing:.3px;cursor:pointer}',
    '.mlx-b:disabled{opacity:.35;cursor:default}',
    '.mlx-b-r{border-color:rgba(224,32,32,.7);background:rgba(224,32,32,.12)}',
    // LE CENTRE : la vidéo, haute, et ses commandes juste dessous.
    '.mlx-c{display:flex;flex-direction:column;gap:8px;min-width:0;position:sticky;top:8px}',
    '.mlx .ml-scene{border-radius:12px;border-color:rgba(255,255,255,.1)}',
    '.mlx .ml-scene video{height:min(62vh,660px);height:min(62dvh,660px);max-height:none}',
    '.mlx .ml-scene:fullscreen video{height:100vh}',
    '.mlx-badge-orig{display:none;position:absolute;left:12px;bottom:12px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.72);font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#fff;pointer-events:none}',
    '.mlx-original .mlx-badge-orig{display:block}',
    '.ml-calque[data-outil="selection"]{cursor:default}',
    '.ml-calque[data-outil="gomme"]{cursor:cell}',
    '.ml-calque[data-depl="1"]{cursor:move}',
    '.mlx-transport{padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02)}',
    '.mlx-tr-l1{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.mlx-tr-l1 .ml-b{display:inline-flex;align-items:center;justify-content:center;min-width:42px;min-height:42px;padding:0 9px}',
    '.mlx .mlx-play{min-width:56px;background:linear-gradient(160deg,#e21414,#8d0000);border-color:rgba(255,90,90,.4)}',
    '.mlx-temps{display:flex;align-items:baseline;gap:4px;margin-left:6px}',
    '#mlx-duree{font-size:var(--fs-xs);color:var(--sub);font-variant-numeric:tabular-nums}',
    '.mlx-vit{display:flex;gap:4px}',
    '.mlx-tr-l2{display:flex;align-items:center;gap:12px;margin-top:4px}',
    '#mlx-pos,.mla-pos{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:22px;margin:0;padding:0;border:none;cursor:pointer;background:linear-gradient(90deg,var(--red) 0 var(--p,0%),rgba(255,255,255,.22) var(--p,0%) 100%) center/100% 5px no-repeat}',
    '#mlx-pos::-webkit-slider-thumb,.mla-pos::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:#fff;border:none;box-shadow:0 0 0 3px rgba(224,32,32,.35)}',
    '#mlx-pos::-moz-range-thumb,.mla-pos::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:none}',
    '.mlx .ml-fps{flex:0 1 auto;max-width:45%}',
    // LA DROITE : les onglets, puis les outils.
    '.mlx-onglets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:4px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.02)}',
    '.mlx-onglets button{min-height:38px;border:none;border-radius:8px;background:none;color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;cursor:pointer}',
    '.mlx-onglets button[aria-selected="true"]{background:rgba(224,32,32,.14);color:var(--text);box-shadow:inset 0 0 0 1px rgba(224,32,32,.55)}',
    '.mlx-d [role="tabpanel"]{display:flex;flex-direction:column;gap:12px}',
    '.mlx-d [role="tabpanel"][hidden]{display:none}',
    '.mlx-d .ml-traj{margin-top:0}',
    '.mlx-outils{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}',
    '.mlx-outil{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:60px;padding:6px 2px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03);color:var(--text);font-family:Montserrat,sans-serif;font-size:10px;font-weight:600;cursor:pointer;min-width:0}',
    '.mlx-outil span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mlx-outil:hover{border-color:rgba(255,255,255,.26)}',
    '.mlx-outil[aria-pressed="true"]{border-color:var(--red);background:rgba(224,32,32,.14);box-shadow:0 0 14px rgba(224,32,32,.28)}',
    '.mlx-outil[aria-pressed="true"] svg{color:var(--red)}',
    '.mlx-ligne{display:flex;align-items:center;gap:10px;margin-top:10px}',
    '.mlx-ligne-0{margin-top:0}',
    '.mlx-lab-s{flex:0 0 72px;font-size:var(--fs-2xs);font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--sub)}',
    '.mlx-ligne input[type=range]{flex:1;min-width:0;accent-color:var(--red);padding:0;border:none;background:none}',
    '#mlx-ep-val,#mlx-aep-val{flex:0 0 42px;text-align:right;font-size:var(--fs-xs);color:var(--text)}',
    '.mlx-couleurs{display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.mlx-pastille{width:28px;height:28px;flex:0 0 auto;padding:0;border-radius:50%;border:2px solid rgba(255,255,255,.18);background:var(--c);cursor:pointer}',
    '.mlx-pastille[aria-pressed="true"]{border-color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.25)}',
    '.mlx-perso{position:relative;width:28px;height:28px;flex:0 0 auto;border-radius:50%;border:2px solid rgba(255,255,255,.3);overflow:hidden;cursor:pointer;background:conic-gradient(#ff3b3b,#facc15,#22c55e,#3b82f6,#a855f7,#ff3b3b)}',
    '.mlx-perso input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;border:none;opacity:0;cursor:pointer}',
    '.mlx-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.mlx-chips-l{margin-top:0}',
    '.mlx-chip{min-height:32px;padding:0 10px;border-radius:99px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:700;cursor:pointer;text-transform:none;letter-spacing:0}',
    '.mlx-trait{display:inline-flex;align-items:center;gap:6px}',
    '.mlx-trait-ico{flex-shrink:0;opacity:.85}',
    '.mlx-chip[aria-pressed="true"]{border-color:var(--red);background:rgba(224,32,32,.16)}',
    '.mlx-chip:disabled{opacity:.35;cursor:default}',
    '.mlx-guide{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:10px;padding:9px 10px;border-radius:9px;border:1px solid rgba(224,32,32,.55);background:rgba(224,32,32,.08);font-size:var(--fs-xs);line-height:1.45;color:var(--text)}',
    '.mlx-cours{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:var(--fs-xs);color:var(--text-strong)}',
    '.mlx-aide-o{margin:10px 0 0;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5}',
    '.mlx-coche{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:var(--fs-xs);font-weight:600;color:var(--text-strong);text-transform:none;letter-spacing:0;cursor:pointer}',
    '.mlx-coche input{width:18px;height:18px;margin:0;padding:0;accent-color:var(--red)}',
    // LA LISTE DES ANNOTATIONS.
    '.mlx-an{display:flex;align-items:center;gap:4px;min-height:40px;padding:2px 4px;border-radius:8px;border:1px solid transparent}',
    '.mlx-an+.mlx-an{margin-top:2px}',
    '.mlx-an.on{border-color:rgba(224,32,32,.6);background:rgba(224,32,32,.07)}',
    '.mlx-an-glisse{opacity:.45}',
    '.mlx-an-poignee{display:flex;color:var(--text-faint);cursor:grab}',
    '.mlx-an-oeil,.mlx-an-act{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;flex:0 0 auto;padding:0;border:none;border-radius:7px;background:none;color:var(--sub);font-size:16px;cursor:pointer}',
    '.mlx-an-oeil:hover,.mlx-an-act:hover{background:rgba(255,255,255,.06);color:var(--text)}',
    '.mlx-an-oeil[aria-pressed="false"]{color:var(--text-faint)}',
    '.mlx-an-pt{display:inline-block;flex:0 0 12px;width:12px;height:12px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2px rgba(255,255,255,.12)}',
    '.mlx-an-nom{flex:1;min-width:0;padding:0 0 0 4px;border:none;background:none;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:600;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}',
    '.mlx-an.masque .mlx-an-nom{color:var(--text-faint);text-decoration:line-through}',
    '.mlx-an-suivi{display:inline-flex;align-items:center;gap:2px;margin-left:4px;font-size:10px;color:var(--sub)}',
    '.mlx-an-t{flex:0 0 auto;font-size:var(--fs-2xs);color:var(--sub);font-variant-numeric:tabular-nums}',
    // L'ÉDITEUR DU TRACÉ CHOISI.
    '.mlx-ed{margin-top:10px;padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35)}',
    '.mlx-ed-tete{display:flex;align-items:center;gap:8px;font-size:var(--fs-xs)}',
    '.mlx-champ{display:flex;flex-direction:column;gap:6px;margin-top:12px;font-size:var(--fs-2xs);font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--sub)}',
    '.mlx input.mlx-in,.mlx select.mlx-in{height:40px;margin:0;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.4);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);text-transform:none;letter-spacing:0}',
    '.mlx input.mlx-in:focus,.mlx select.mlx-in:focus{border-color:var(--red)}',
    // L'OUTIL ÉCHELLE : le disque, sa cote, et « Enregistrer la mesure ».
    '.mlx-ech{margin-top:10px}',
    '.mlx-ech .mlx-ech-etat{margin-top:2px;font-size:var(--fs-xs);color:var(--text-strong)}',
    '.mlx-ech-disque{margin:12px 0 0;font-size:var(--fs-xs);color:var(--text);line-height:1.5}',
    '.mlx-ech-disque b{font-weight:800}',
    '.mlx-ech-mm{display:flex;align-items:center;gap:8px}.mlx-ech-mm input.mlx-in{width:110px;flex:0 0 110px;text-align:right}.mlx-ech-mm i{font-style:normal;text-transform:none;letter-spacing:0}',
    '.mlx-ech-b{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:14px}',
    '.mlx-ech-b .btn{flex:1 1 180px;min-height:44px}',
    '.mlx-ech-b .btn[disabled]{opacity:.45;cursor:default}',
    '.mlx-duree{display:flex;align-items:center;gap:6px}',
    '.mlx input.mlx-tps{width:92px;flex:0 0 92px;padding:0 6px;text-align:center;font-variant-numeric:tabular-nums}',
    '.mlx-fl{color:var(--sub)}',
    '.mlx-deg{font-size:var(--fs-sm);color:var(--sub)}',
    '.mlx-angle-l{font-size:var(--fs-xs);color:var(--text-strong);text-transform:none;letter-spacing:0;font-weight:500}',
    '.mlx-suivi{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.08)}',
    '.mlx-cles{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:var(--fs-2xs);color:var(--text-strong)}',
    '.mlx-ed-pied{display:flex;justify-content:flex-end;margin-top:12px}',
    '.mlx-suppr{color:var(--red-text)}',
    // LA LÉGENDE.
    '.mlx-bascule{position:relative;display:inline-block;width:46px;height:26px;flex:0 0 auto;cursor:pointer}',
    '.mlx-bascule input{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;cursor:pointer}',
    '.mlx-bascule i{position:absolute;inset:0;border-radius:99px;background:rgba(255,255,255,.14);transition:background var(--t-1)}',
    '.mlx-bascule i::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform var(--t-1)}',
    '.mlx-bascule input:checked+i{background:var(--red)}',
    '.mlx-bascule input:checked+i::after{transform:translateX(20px)}',
    '.mlx-bascule input:focus-visible+i{outline:2px solid #fff;outline-offset:2px}',
    '.mlx-leg-off{opacity:.55}',
    '.mlx-leg .mlx-champ:first-child{margin-top:0}',
    '.mlx-champs2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}',
    '.mlx-champs2 input[type=range]{height:40px;accent-color:var(--red);margin:0;padding:0;border:none;background:none}',
    '.mlx-sens-l{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:var(--fs-xs);font-weight:600;color:var(--text-strong);text-transform:none;letter-spacing:0}',
    '.mlx-sens-l span{flex:0 0 52px}',
    '.mlx-sens-l .mlx-in{flex:1;min-width:0}',
    // LES MODÈLES.
    '.mlx-mod-l{display:flex;align-items:center;gap:4px}',
    '.mlx-mod-l+.mlx-mod-l{margin-top:6px}',
    '.mlx-mod{display:flex;align-items:center;gap:12px;flex:1;min-width:0;min-height:42px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.02);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:600;text-align:left;cursor:pointer}',
    '.mlx-mod:hover{border-color:rgba(255,255,255,.24)}',
    '.mlx-mod span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mlx-mod small{font-size:var(--fs-2xs);color:var(--red-text);font-weight:800}',
    '.mlx-mod.on{border-color:var(--red);background:rgba(224,32,32,.1)}',
    '.mlx-mod-creer{justify-content:center;width:100%;margin-top:8px;border-style:dashed}',
    '.mlx-mod-creer span{flex:0 1 auto}',
    // LES SÉQUENCES.
    '.mlx .mlx-seq{gap:8px;margin-top:6px;padding:4px 2px 4px 6px}',
    '.mlx-seq-n{flex:0 0 18px;text-align:center;font-size:var(--fs-sm);font-weight:800;color:var(--text)}',
    '.mlx-sv{display:block;flex:0 0 56px;width:56px;height:36px;border-radius:5px;background:#0a0a0a}',
    '.mlx-seq-t{display:flex;flex-direction:column;flex:1;min-width:0}',
    '.mlx-seq-t .ml-rep-n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.mlx .ml-mini{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center}',
    '.mlx .ml-bornes{margin-top:10px}',
    '.mlx .ml-borne .ml-b{min-height:38px;min-width:38px;padding:0 8px}',
    // LA TIMELINE.
    '.mlx-tl{padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))}',
    '.mlx-tl-tete{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}',
    '.mlx-lab{padding-left:10px;border-left:3px solid var(--red);font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--text)}',
    '.mlx-ajuster{display:inline-flex;align-items:center;gap:6px}',
    '.mlx-tl-t{min-width:92px;text-align:right;font-size:var(--fs-xs);color:var(--text-strong);font-variant-numeric:tabular-nums}',
    '.mlx-tl-corps{display:grid;grid-template-columns:160px minmax(0,1fr);max-height:250px;overflow-y:auto;overflow-x:hidden}',
    '.mlx-tl-g{position:relative}',
    '.mlx-tl-lire{position:absolute;left:0;top:0;width:44px;height:22px;display:flex;align-items:center;justify-content:center;padding:0;border-radius:6px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:var(--text);cursor:pointer}',
    '.mlx-tl-noms{position:relative}',
    '.mlx-tl-nom{position:absolute;left:0;right:8px;display:flex;align-items:center;gap:8px;height:26px;padding:0;border:none;background:none;color:var(--text-strong);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:700;text-align:left;white-space:nowrap;overflow:hidden;cursor:pointer}',
    '.mlx-tl-nom span{overflow:hidden;text-overflow:ellipsis}',
    '.mlx-tl-nom.on{color:#fff}',
    '.mlx-tl-nom.masque{opacity:.45}',
    '.mlx-tl-nom-seq{align-items:center;color:var(--sub);letter-spacing:1px;text-transform:uppercase;cursor:default}',
    '.mlx-tl-vide{color:var(--text-faint);font-weight:500;cursor:default}',
    '.mlx .ml-frise{border-radius:8px;overflow-y:hidden}',
    '.mlx .ml-frise-in{min-height:100px}',
    '.mlx .ml-regle{top:0;bottom:auto;height:22px}',
    '.mlx .ml-vign{top:26px;height:40px}',
    '.mlx .ml-autre{top:26px;height:40px}',
    '.mlx .ml-sel{top:24px;height:44px}',
    '.mlx .ml-poignee{top:20px;height:52px}',
    '.mlx .ml-poignee i{top:4px;height:44px}',
    '.mlx .ml-poignee i::after{top:14px}',
    '.mlx .ml-tete{top:0;bottom:0;height:auto;background:var(--red);box-shadow:0 0 6px rgba(224,32,32,.7);z-index:3}',
    '.mlx .ml-tete::before{content:"";position:absolute;top:0;left:-5px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--red)}',
    '.mlx-pistes{position:absolute;left:0;right:0}',
    '.mlx-barre{position:absolute;height:20px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:var(--c);font-family:Montserrat,sans-serif;font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;cursor:grab;touch-action:none;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18);z-index:2}',
    '.mlx-barre span{padding:0 10px;overflow:hidden;text-overflow:ellipsis;pointer-events:none}',
    '.mlx-barre.on{box-shadow:0 0 0 2px #fff,0 0 12px rgba(255,255,255,.35)}',
    '.mlx-barre.masque{opacity:.35}',
    '.mlx-barre i{position:absolute;top:0;bottom:0;width:9px;cursor:ew-resize}',
    '.mlx-bg{left:0}.mlx-bd{right:0}',
    // LE PIED.
    '.mlx-pied{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:4px}',
    '.mlx-pied-b{display:inline-flex;align-items:center;gap:10px;min-height:52px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:600;cursor:pointer}',
    '.mlx-pied-b[aria-pressed="true"]{border-color:var(--red);background:rgba(224,32,32,.14)}',
    '.mlx-enreg{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:56px;min-width:min(340px,100%);padding:0 26px;border-radius:10px;border:1px solid rgba(255,90,90,.5);background:linear-gradient(160deg,#e21414,#8d0000);color:#fff;font-family:Montserrat,sans-serif;font-size:var(--fs-md);font-weight:800;cursor:pointer;box-shadow:0 0 22px rgba(224,32,32,.35);transition:box-shadow var(--t-1),opacity var(--t-1)}',
    '.mlx-enreg:hover:not(:disabled){box-shadow:0 0 30px rgba(224,32,32,.5)}',
    '.mlx-enreg:disabled{opacity:.45;box-shadow:none;cursor:default}',
    '.mlx-enreg-pt{font-style:normal}',
    // LE LECTEUR ANNOTÉ, chez l'athlète.
    '.mla{margin-top:8px}',
    '.mla-scene{position:relative;background:#000;border:1px solid var(--border);border-radius:var(--r-3);overflow:hidden}',
    '.mla-video{display:block;width:100%;max-height:58vh;max-height:58dvh;object-fit:contain;background:#000}',
    '.mla-scene:fullscreen .mla-video{max-height:none;height:100vh}',
    '.mla-calque{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}',
    '.mla-cmd{display:flex;align-items:center;gap:8px;margin-top:8px}',
    '.mla-cmd .ml-b{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;min-width:40px;padding:0 9px}',
    '.mla-cmd2{flex-wrap:wrap}',
    '.mla-temps{flex:0 0 auto;font-size:var(--fs-2xs);color:var(--sub);font-variant-numeric:tabular-nums}',
    '.mla-an{gap:10px}',
    // UNE APPLICATION, PAS UNE PAGE, dès que l'écran le permet : l'en-tête, la
    // timeline et « Enregistrer » restent en vue ; les deux colonnes défilent
    // chacune de leur côté, et la vidéo prend toute la hauteur qui reste.
    '@media (min-width:1181px) and (min-height:700px){#s-coach-motion-lab{height:100vh;height:100dvh;overflow:hidden}#s-coach-motion-lab .scroll-area{min-height:0;overflow:hidden;display:flex;flex-direction:column}#ml-contenu{flex:1;min-height:0;display:flex;flex-direction:column}.mlx{flex:1;min-height:0;padding-bottom:10px}.mlx-grille{flex:1;min-height:0;grid-template-rows:minmax(0,1fr);align-items:stretch}.mlx-g,.mlx-d{min-height:0;overflow-y:auto;scrollbar-width:thin;padding-right:2px}.mlx-c{position:static;min-height:0}.mlx .ml-scene{flex:1;min-height:0}.mlx .ml-scene video{width:100%;height:100%}.mlx-tl-corps{height:164px;max-height:none}}',
    // LA FENÊTRE D'EXPORT, au-dessus de tout.
    '.mle-voile{position:fixed;inset:0;z-index:var(--z-modal,1000);display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.72)}',
    '.mle{width:min(520px,100%);max-height:92vh;max-height:92dvh;overflow-y:auto;padding:16px 18px;border-radius:14px;border:1px solid rgba(224,32,32,.5);background:#0e0e0e;box-shadow:0 20px 60px rgba(0,0,0,.7),0 0 24px rgba(224,32,32,.15);color:var(--text)}',
    '.mle-tete{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}',
    '.mle-tete div{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}',
    '.mle-tete b{font-size:var(--fs-md);font-weight:800}',
    '.mle-tete span:not(.mle-ico){font-size:var(--fs-xs);color:var(--sub);line-height:1.45}',
    '.mle-ico{display:flex;color:var(--red);padding-top:2px}',
    '.mle-choix{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}',
    '.mle-alerte{margin:10px 0 0;padding:10px 12px;border-radius:9px;border:1px solid rgba(255,160,0,.5);background:rgba(255,160,0,.08);font-size:var(--fs-xs);color:var(--text-strong)}',
    '.mle-prog{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;font-size:var(--fs-xs);color:var(--text-strong)}',
    '.mle-prog[hidden]{display:none}',
    '.mle-barre{flex:1 1 100%;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}',
    '.mle-barre i{display:block;height:100%;background:var(--red);transform:scaleX(0);transform-origin:left;transition:transform var(--arc-strike) linear}',
    '.mle-fin{margin-top:12px}',
    '.mle-fin[hidden]{display:none}',
    '.mle-apercu{display:block;width:100%;max-height:40vh;border-radius:10px;background:#000}',
    '.mle-pied{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:14px;flex-wrap:wrap}',
    '.mle .mlx-enreg{min-width:0;min-height:48px;padding:0 20px;font-size:var(--fs-sm);text-decoration:none}',
    '.mlx-auto-l{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin-top:10px}',
    '.mlx-suivi-prog{margin-top:10px}',
    '.mla-export span{margin-left:2px}',
    // LES LARGEURS MOYENNES : la vidéo et la droite, puis la gauche sous elles.
    '@media (max-width:1180px){.mlx-grille{grid-template-columns:minmax(0,1fr) minmax(320px,40%)}.mlx-g{grid-column:1/-1;order:3;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.mlx-c{position:static}}',
    // LE TÉLÉPHONE DU COACH EN SALLE : une colonne, la vidéo d'abord.
    '@media (max-width:820px){.mlx-grille{grid-template-columns:minmax(0,1fr)}.mlx-g{grid-template-columns:minmax(0,1fr)}.mlx-devise,.mlx-sous-t{display:none}.mlx .mlx-titre{font-size:26px}.mlx .ml-scene video{height:auto;max-height:56vh;max-height:56dvh}.mlx-tl-corps{grid-template-columns:100px minmax(0,1fr)}.mlx-outils{grid-template-columns:repeat(4,minmax(0,1fr))}.mlx-enreg{flex:1 1 100%}.mlx-pied-b{flex:1 1 0;justify-content:center;padding:0 10px}.mlx-logo{height:34px;max-width:90px}}',
  ].join('\n');
  document.head.appendChild(s);
}

// ══ MORPHO — LOT M6 : CE QU'UNE PHOTO PEUT DIRE, ET CE QU'ELLE NE PEUT PAS ══
//
// Le moteur de pose est déjà là, chargé à la demande pour Motion Lab. Morpho
// le REUTILISE : pas de second moteur, pas un octet de plus.
//
// ⚠ AUCUN CENTIMÈTRE NE SORT D'UNE PHOTO, ET C'EST UN CHOIX.
//   Convertir des pixels en centimètres demande de connaître l'échelle, donc
//   de repérer le SOMMET DU CRÂNE pour le rapporter à la taille. MediaPipe ne
//   donne pas ce point : il donne le nez, les yeux, les oreilles. Combler
//   l'écart demanderait un coefficient crâne/taille que ce dépôt ne peut pas
//   sourcer — et un repère inventé est pire qu'une mesure absente.
//
//   Ce qu'une photo donne SANS ÉCHELLE, en revanche, elle le donne bien : des
//   RAPPORTS entre deux segments de la même image. Cuisse sur jambe, humérus
//   sur avant-bras. Ce sont exactement les deux axes que le mètre atteint le
//   plus mal — A2 et A4 — et ils sortent ici d'un repère osseux à un repère
//   osseux, sans ruban et sans erreur de repérage.
//
// ⚠ LES POINTS DE MEDIAPIPE NE SONT PAS LES REPÈRES DU MÈTRE. L'épaule rendue
//   est le centre de l'articulation, pas l'acromion ; la hanche est le centre
//   de la tête fémorale, pas la crête iliaque. C'est pourquoi ni la largeur
//   d'épaules, ni la largeur de bassin, ni aucune longueur mesurée depuis ces
//   points ne sortent d'ici. Genou et coude, eux, tombent sur l'interligne et
//   sur l'olécrane à moins d'un centimètre : ce sont les deux seuls qu'on garde.

/** Visibilité minimale d'un point pour qu'il compte. */
const ML_MORPHO_VIS=0.7;
/** En dessous, l'image n'a pas assez de pixels pour qu'un rapport tienne. */
const ML_MORPHO_SPAN_MIN=300;
/** Hanches trop rapprochées : la photo est prise de trois quarts ou de profil. */
const ML_MORPHO_FACE_MIN=0.06;
/** Un membre plié se raccourcit en projection : on veut des segments tendus. */
const ML_MORPHO_TENDU=160;
/** Les deux côtés qui divergent de plus de ça : le corps est tourné. */
const ML_MORPHO_COTES=0.10;
/** Les points dont on a besoin : épaules, coudes, poignets, hanches, genoux, chevilles. */
const ML_MORPHO_PTS=Object.freeze([11,12,13,14,15,16,23,24,25,26,27,28]);

/**
 * Distance entre deux points, en pixels de l'image.
 * @param {{x:number,y:number}} a @param {{x:number,y:number}} b
 * @param {number} w @param {number} h @returns {number}
 */
function _mlmDist(a,b,w,h){
  const dx=(a.x-b.x)*w, dy=(a.y-b.y)*h;
  return Math.sqrt(dx*dx+dy*dy);
}
/**
 * Angle en B, en degrés, dans le plan de l'image.
 * @param {{x:number,y:number}} a @param {{x:number,y:number}} b @param {{x:number,y:number}} c
 * @param {number} w @param {number} h @returns {number}
 */
function _mlmAngle(a,b,c,w,h){
  const ux=(a.x-b.x)*w, uy=(a.y-b.y)*h, vx=(c.x-b.x)*w, vy=(c.y-b.y)*h;
  const nu=Math.hypot(ux,uy), nv=Math.hypot(vx,vy);
  if(!(nu>0)||!(nv>0)) return 0;
  return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(nu*nv))))*180/Math.PI;
}

/**
 * LE CONTRÔLE DE PRISE DE VUE, AVANT TOUT LE RESTE.
 * Trois niveaux — et c'est le SEUL verdict à trois niveaux de tout le module :
 * il porte sur la QUALITÉ DE LA PHOTO, jamais sur le corps qu'elle montre.
 * @param {any[]} p  les 33 points de MediaPipe
 * @param {number} w @param {number} h
 * @returns {{verdict:string, raisons:string[], span:number}}
 */
function mlMorphoPrise(p,w,h){
  const raisons=[];
  const manquants=ML_MORPHO_PTS.filter(i=>!p[i]||(p[i].visibility||0)<ML_MORPHO_VIS);
  if(manquants.length)
    raisons.push('l’athlète n’est pas entier dans le cadre, ou une partie est masquée');
  const span=(p[23]&&p[27])?Math.max(_mlmDist(p[23],p[27],w,h),
    (p[24]&&p[28])?_mlmDist(p[24],p[28],w,h):0):0;
  if(span<ML_MORPHO_SPAN_MIN)
    raisons.push('la photo est trop petite pour mesurer ('+Math.round(span)+' pixels de la hanche '
      +'au pied, il en faut '+ML_MORPHO_SPAN_MIN+') — c’est la version haute définition qu’il faut, '
      +'sur l’appareil qui a pris la photo');
  if(p[23]&&p[24]&&span>0){
    const large=Math.abs(p[23].x-p[24].x)*w/span;
    if(large<ML_MORPHO_FACE_MIN) raisons.push('la photo n’est pas prise de face : les deux hanches '
      +'se superposent, et les segments se raccourcissent en projection');
  }
  const plies=[];
  if(p[23]&&p[25]&&p[27]&&_mlmAngle(p[23],p[25],p[27],w,h)<ML_MORPHO_TENDU) plies.push('la jambe gauche');
  if(p[24]&&p[26]&&p[28]&&_mlmAngle(p[24],p[26],p[28],w,h)<ML_MORPHO_TENDU) plies.push('la jambe droite');
  if(p[11]&&p[13]&&p[15]&&_mlmAngle(p[11],p[13],p[15],w,h)<ML_MORPHO_TENDU) plies.push('le bras gauche');
  if(p[12]&&p[14]&&p[16]&&_mlmAngle(p[12],p[14],p[16],w,h)<ML_MORPHO_TENDU) plies.push('le bras droit');
  if(plies.length) raisons.push(plies.join(' et ')+' n’'+(plies.length>1?'ont':'a')
    +' pas été tendu'+(plies.length>1?'s':'')+' : un membre plié paraît plus court qu’il n’est');
  return {verdict:raisons.length?(raisons.length>1?'a_refaire':'a_ameliorer'):'bon',raisons,span};
}

/**
 * Les deux rapports qu'une photo de face donne honnêtement, sans échelle.
 * @param {any[]} p @param {number} w @param {number} h
 * @returns {{cle:string, valeur:number, ecartCotes:number}[]}
 */
function mlMorphoRapports(p,w,h){
  /** @type {{cle:string, valeur:number, ecartCotes:number}[]} */
  const out=[];
  /**
   * @param {string} cle
   * @param {number} hautG @param {number} milG @param {number} basG
   * @param {number} hautD @param {number} milD @param {number} basD
   */
  const paire=(cle,hautG,milG,basG,hautD,milD,basD)=>{
    /** @param {number} a @param {number} b @param {number} c @returns {number|null} */
    const cote=(a,b,c)=>{
      if(!p[a]||!p[b]||!p[c]) return null;
      if((p[a].visibility||0)<ML_MORPHO_VIS||(p[b].visibility||0)<ML_MORPHO_VIS
        ||(p[c].visibility||0)<ML_MORPHO_VIS) return null;
      const d1=_mlmDist(p[a],p[b],w,h), d2=_mlmDist(p[b],p[c],w,h);
      return (d1>0&&d2>0)?d1/d2:null;
    };
    const g=cote(hautG,milG,basG), d=cote(hautD,milD,basD);
    if(g==null&&d==null) return;
    if(g!=null&&d!=null){
      const ec=Math.abs(g-d)/((g+d)/2);
      // LES DEUX CÔTÉS DOIVENT DIRE LA MÊME CHOSE. S'ils divergent, ce n'est
      // pas une asymétrie : c'est un corps tourné, et la projection ment des
      // deux côtés à la fois. On ne rend rien.
      if(ec>ML_MORPHO_COTES) return;
      out.push({cle,valeur:Math.round((g+d)/2*1000)/1000,ecartCotes:Math.round(ec*1000)/1000});
      return;
    }
    const seul=(g==null)?d:g;
    if(seul==null) return;
    out.push({cle,valeur:Math.round(seul*1000)/1000,ecartCotes:-1});
  };
  // Cuisse sur jambe : hanche → genou → cheville.
  paire('A2photo',23,25,27,24,26,28);
  // Humérus sur avant-bras : épaule → coude → poignet.
  paire('A4photo',11,13,15,12,14,16);
  return out;
}

/**
 * PURE. Les distances dont l'echelle a besoin, EN PIXELS, jamais en
 * centimetres : talon-genou, talon-oeil, et les quatre segments des membres.
 *
 * ⚠ CETTE FONCTION NE SAIT RIEN DU PROTOCOLE. Elle mesure des points sur une
 *   image. C'est rc-core qui sait que le talon-genou vaut la mesure prise au
 *   mur, que la hauteur d'oeil est un garde-fou et non une mesure, et qu'un
 *   ecart de plus de 4 % interdit de publier le moindre centimetre.
 *
 * ⚠ LE TALON, PAS LA CHEVILLE, POUR LE SOL. Le point 29/30 est le talon : il
 *   touche le sol, la cheville non. Deux centimetres d'ecart sur une jambe de
 *   quarante, c'est 5 % sur l'echelle entiere.
 *
 * ⚠ LES DEUX COTES DOIVENT DIRE LA MEME CHOSE, comme pour les rapports : au
 *   dela de ML_MORPHO_COTES d'ecart, le corps est tourne et la projection ment
 *   des deux cotes a la fois. On ne rend rien plutot qu'une moyenne fausse.
 * @param {any[]} p @param {number} w @param {number} h
 * @returns {{genou:number,yeux:number,cuisse:number,jambe:number,
 *            bras:number,avantbras:number,cotes:number}|null}
 */
function mlMorphoPixels(p,w,h){
  const vu=i=>!!p[i]&&(p[i].visibility||0)>=ML_MORPHO_VIS;
  /** Moyenne des deux cotes, ou null si l'un manque ou s'ils divergent. */
  const paire=(aG,bG,aD,bD)=>{
    if(!vu(aG)||!vu(bG)||!vu(aD)||!vu(bD)) return null;
    const g=_mlmDist(p[aG],p[bG],w,h), d=_mlmDist(p[aD],p[bD],w,h);
    if(!(g>0)||!(d>0)) return null;
    const ec=Math.abs(g-d)/((g+d)/2);
    if(ec>ML_MORPHO_COTES) return null;
    return {v:(g+d)/2,ec:ec};
  };
  // Talon → genou : la distance que la mesure du mur met a l'echelle.
  const genou=paire(29,25,30,26);
  if(!genou) return null;
  // Talon → oeil : le garde-fou. 2 et 5 sont les yeux (gauche, droit).
  const yeux=paire(29,2,30,5);
  const cuisse=paire(23,25,24,26);
  const jambe=paire(25,27,26,28);
  const bras=paire(11,13,12,14);
  const avantbras=paire(13,15,14,16);
  const r=x=>x?Math.round(x.v*10)/10:0;
  return {genou:r(genou),yeux:r(yeux),cuisse:r(cuisse),jambe:r(jambe),
    bras:r(bras),avantbras:r(avantbras),
    cotes:Math.round(genou.ec*1000)/1000};
}
/**
 * Lit une photo et rend ce qu'elle dit — après le contrôle de prise de vue,
 * jamais avant.
 * @param {string} src  l'image, telle que le bilan la porte
 * @returns {Promise<{ok:boolean, code?:string, prise?:any, rapports?:any[], px?:{w:number,h:number}}>}
 */
async function mlMorphoPhoto(src){
  if(!src||typeof src!=='string') return {ok:false,code:'image'};
  let moteur=null;
  try{ moteur=await _mlChargerPose(); }catch(e){ return {ok:false,code:'moteur'}; }
  if(!moteur) return {ok:false,code:'moteur'};
  /** @type {HTMLImageElement|null} */
  const im=await new Promise(res=>{
    const i=new Image();
    i.crossOrigin='anonymous';
    i.onload=()=>res(i); i.onerror=()=>res(null);
    i.src=src;
  });
  if(!im||!im.naturalWidth) return {ok:false,code:'image'};
  const w=im.naturalWidth, h=im.naturalHeight;
  const t=document.createElement('canvas');
  t.width=w; t.height=h;
  const cx=t.getContext('2d');
  if(!cx) return {ok:false,code:'image'};
  cx.drawImage(im,0,0,w,h);
  /** @type {any} */
  const res=await new Promise((ok)=>{
    const garde=setTimeout(()=>ok(null),15000);
    moteur.onResults((/** @type {any} */ r)=>{ clearTimeout(garde); ok(r); });
    moteur.send({image:t}).catch(()=>{ clearTimeout(garde); ok(null); });
  });
  const pts=res&&res.poseLandmarks;
  if(!pts||pts.length<33) return {ok:false,code:'personne'};
  const prise=mlMorphoPrise(pts,w,h);
  // ⚠ LE CONTRÔLE PASSE AVANT LA MESURE. Une photo « à refaire » ne rend
  //   aucun rapport : mesurer dessus donnerait un chiffre, et un chiffre faux
  //   est plus difficile à défaire qu'une case vide.
  if(prise.verdict==='a_refaire') return {ok:true,prise,rapports:[],px:{w,h}};
  // LES PIXELS VOYAGENT AVEC LES RAPPORTS (lot 7) : sans eux, rc-core ne peut
  // pas mettre la photo a l'echelle, et il est le seul a savoir avec quoi.
  return {ok:true,prise,rapports:mlMorphoRapports(pts,w,h),
    pixels:mlMorphoPixels(pts,w,h),px:{w,h}};
}

