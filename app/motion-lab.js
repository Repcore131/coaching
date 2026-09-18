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
 *   rec:any, correction:{motion:any, blob:Blob|null, blobUrl:string, statut:'brouillon'|'envoi'|'envoye'|'erreur', erreur:string}|null,
 *   cartes:{id:string, aMs:number, dureeMs:number, texte:string}[], lecteur:any
 * }} EtatMl
 */
/** @typedef {'lecture'|'graine'|'analyse'|'replacer'|'pose'|'etalon'|'action'} ModeMl */
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
const ML_VIGNETTE_H=56;

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
  _ml={email,videoId,url:String(v.url||''),nom:String(v.name||'Vidéo'),
    sousTitre:['Motion Lab',String(c.fname||''),date].filter(Boolean).join(' · '),
    initiaux:segs,segments:segs.map(s=>({...s})),actifId:segs.length?segs[0].id:null,
    zoom:1,dureeMs:0,boucle:false,jeton:0,raf:0,seekEnAttente:null,
    mode:'lecture',graine:null,disqueM:ML_DISQUE_M,sens:'',fantome:false,
    analyseJeton:0,progres:'',suivis:{},cacheBarre:null,
    angCote:'',angCalques:[],epingles:[],cachePose:null,
    theta:0,thetaAuto:null,thetaMain:false,
    etalon:{type:'disque45',cm:Math.round(ML_DISQUE_M*100),ax:null,ay:null,bx:null,by:null},prise:null,
    rec:null,correction:null,cartes:[],lecteur:null};
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
        :'Les répétitions modifiées depuis le dernier enregistrement seront perdues.','Quitter','Rester');
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
  if(_ml&&_ml.rec){
    const r=_ml.rec;
    _mlRecEcouteArreter();
    window.clearInterval(r.minuteur);
    try{ if(r.media&&r.media.state!=='inactive') r.media.stop(); }catch(e){}
    if(r.flux) r.flux.getTracks().forEach((/** @type {MediaStreamTrack} */ t)=>t.stop());
    _ml.rec=null;
  }
  if(_ml) _mlCorrOublier();
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
function _mlModifie(){ return !!_ml&&!mlMemesSegments(_ml.initiaux,_ml.segments); }
/** @returns {Segment|null} */
function _mlActif(){
  if(!_ml) return null;
  const id=_ml.actifId;
  return _ml.segments.find(s=>s.id===id)||null;
}

// ══ LE RENDU ══════════════════════════════════════════════════════════════════

function _mlRendre(){
  const z=_mlEl('ml-contenu');
  if(!z||!_ml) return false;
  const t=_mlEl('ml-titre');
  if(t) t.textContent=_ml.nom;
  /** @param {string} lib @param {string} act @param {string} titre @param {string} [extra] */
  const b=(lib,act,titre,extra)=>'<button type="button" class="ml-b" onclick="'+act+'" '
    +'title="'+escapeHtml(titre)+'" aria-label="'+escapeHtml(titre)+'" disabled '+(extra||'')+'>'+lib+'</button>';
  z.innerHTML=
    // LA BARRE D'ENREGISTREMENT reste en haut pendant qu'on fait défiler :
    // arrêter, mettre en pause et dessiner doivent être à portée à tout moment.
    '<div id="ml-rec" class="ml-rec" hidden></div>'
    +(_ml.sousTitre?'<div class="ml-sous">'+escapeHtml(_ml.sousTitre)+'</div>':'')
    +'<div class="ml-scene">'
      +'<video id="ml-video" src="'+safeUrl(_ml.url)+'" preload="metadata" playsinline webkit-playsinline '
      +'onerror="_videoIndisponible(this)" onclick="mlLecture()"></video>'
      // LE CALQUE : la trajectoire, et le disque qu'on pose. Il ne capte le
      // doigt que le temps de poser ou de replacer le disque.
      +'<canvas id="ml-calque" class="ml-calque" aria-hidden="true"></canvas>'
      +'<canvas id="ml-loupe" class="ml-loupe" width="220" height="220" aria-hidden="true" hidden></canvas>'
    +'</div>'
    +'<div class="ml-temps"><span id="ml-t" aria-live="off">0:00.00</span>'
      +'<span id="ml-fps" class="ml-fps">Chargement…</span></div>'
    +'<div class="ml-cmd">'
      +b('◀ 1 img','mlImage(-1)','Image précédente (flèche gauche)')
      +'<button type="button" id="ml-play" class="ml-b ml-b-plein" onclick="mlLecture()" disabled>▶ Lecture</button>'
      +b('1 img ▶','mlImage(1)','Image suivante (flèche droite)')
    +'</div>'
    +'<div class="ml-vit">'+VID_RATES.map(r=>b(String(r).replace('.',',')+'×','mlVitesse('+r+')',
        'Lire à '+String(r).replace('.',',')+' fois la vitesse normale','data-rate="'+r+'" aria-pressed="'+(r===1)+'"')).join('')
    +'</div>'
    +'<div class="ml-frise-tete"><span class="ml-lab">Frise</span>'
      +'<span class="ml-zoom">'+b('−','mlZoom(-1)','Dézoomer la frise','data-zoom="-1"')
      +'<span id="ml-zoom-val">1×</span>'+b('+','mlZoom(1)','Zoomer la frise','data-zoom="1"')+'</span></div>'
    +'<div class="ml-frise" id="ml-frise"><div class="ml-frise-in" id="ml-frise-in">'
      +'<canvas id="ml-vign" class="ml-vign" aria-hidden="true"></canvas>'
      +'<canvas id="ml-regle" class="ml-regle" aria-hidden="true"></canvas>'
      +'<div id="ml-autres"></div>'
      +'<div class="ml-sel" id="ml-sel" hidden></div>'
      +'<div class="ml-poignee" id="ml-p-debut" data-borne="debut" role="slider" tabindex="0" '
        +'aria-label="Début de la répétition" hidden><i></i></div>'
      +'<div class="ml-poignee" id="ml-p-fin" data-borne="fin" role="slider" tabindex="0" '
        +'aria-label="Fin de la répétition" hidden><i></i></div>'
      +'<div class="ml-tete" id="ml-tete" aria-hidden="true"></div>'
    +'</div></div>'
    +'<div id="ml-bornes"></div>'
    +'<div id="ml-prise"></div>'
    +'<div id="ml-lecture"></div>'
    +'<div id="ml-traj"></div>'
    +'<div id="ml-artic"></div>'
    +'<div id="ml-corr"></div>'
    +'<div class="ml-lab" style="margin-top:18px">Répétitions</div>'
    +'<div id="ml-liste"></div>'
    +'<button type="button" class="btn btn-outline btn-sm" id="ml-ajouter" style="width:100%;margin:10px 0 0" '
      +'onclick="mlAjouter()" disabled>+ Ajouter une répétition ici</button>'
    +'<p class="ml-aide">Place la tête de lecture au début du mouvement, ajoute une répétition, puis ajuste '
      +'son début et sa fin à l’image près. Dix secondes au plus par répétition. La vidéo d’origine n’est '
      +'jamais modifiée.</p>';
  _mlBrancher();
  _mlMajListe();
  _mlMajCorrection();
  _mlMajEnregistrer();
  return true;
}

// Les écoutes : la vidéo, la frise, les poignées, le clavier.
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
    const a=_mlActif();
    if(a) _mlAller(a.debutMs);
    _mlMajFrise();
    _mlVignettes();
  };
  if(v.readyState>=1) pret(); else v.addEventListener('loadedmetadata',pret,{once:true});
  let fpsDemande=false;
  v.addEventListener('play',()=>{
    const p=_mlEl('ml-play'); if(p) p.textContent='❚❚ Pause';
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
    const p=_mlEl('ml-play'); if(p) p.textContent='▶ Lecture';
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
    if(e.target instanceof Element&&e.target.closest('.ml-poignee')) return;
    const r=frise.getBoundingClientRect();
    _mlAller(mlXVersTemps(e.clientX-r.left,r.width,_ml.dureeMs));
  });
  ['debut','fin'].forEach(q=>{
    const p=_mlEl('ml-p-'+q);
    if(p) _mlGlisser(p,/** @type {Borne} */(q));
  });
  const calque=_mlEl('ml-calque');
  if(calque) _mlBrancherCalque(calque);
  // Le calque suit la taille affichée de la vidéo : une rotation du téléphone
  // la change, et un tracé décalé mentirait sur la position du disque.
  v.addEventListener('loadeddata',()=>_mlDessinerCalque());
  if(!window._mlRedim){
    window._mlRedim=true;
    window.addEventListener('resize',()=>{ try{ if(_ml){ _mlDessinerCalque(); _mlDessinerCourbe(); } }catch(e){} });
  }
  // LES FLÈCHES = IMAGE PAR IMAGE, sauf dans un champ de saisie et sauf sur
  // une poignée, qui a les siennes.
  const ecran=_mlEl('s-coach-motion-lab');
  if(ecran&&!ecran.dataset.mlClavier){
    ecran.dataset.mlClavier='1';
    ecran.addEventListener('keydown',e=>{
      const t=e.target instanceof Element?e.target:null;
      if(t&&(t.closest('input,textarea,select')||t.closest('.ml-poignee'))) return;
      if(e.key==='ArrowLeft'){ e.preventDefault(); mlImage(-1); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); mlImage(1); }
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

// La liste des répétitions, et le réglage fin de celle qu'on a choisie.
function _mlMajListe(){
  const z=_mlEl('ml-liste'), zb=_mlEl('ml-bornes');
  if(!_ml||!z||!zb) return;
  const a=_mlActif();
  z.innerHTML=_ml.segments.length
    ?_ml.segments.map((s,i)=>'<div class="ml-rep'+(a&&s.id===a.id?' ml-rep-on':'')+'" role="button" tabindex="0" '
        +'aria-pressed="'+(!!a&&s.id===a.id)+'" onclick="mlChoisir(\''+escapeHtml(s.id)+'\')" '
        +'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}">'
        +'<span class="ml-rep-n">'+escapeHtml(s.label)+'</span>'
        +'<span class="ml-rep-t">'+mlTempsTexte(s.debutMs)+' → '+mlTempsTexte(s.finMs)+' · '+mlDureeTexte(s.finMs-s.debutMs)
          +(s.barre?' · <b class="ml-rep-traj">trajectoire</b>':'')+'</span>'
        +'<button type="button" class="ml-mini" onclick="event.stopPropagation();mlRenommer('+i+')" '
          +'aria-label="Renommer '+escapeHtml(s.label)+'">✎</button>'
        +'<button type="button" class="ml-mini" onclick="event.stopPropagation();mlSupprimer('+i+')" '
          +'aria-label="Supprimer '+escapeHtml(s.label)+'">×</button></div>').join('')
    :'<div class="ml-vide">Aucune répétition pour l’instant.</div>';
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
}
function _mlMajEnregistrer(){
  const b=_mlEl('ml-enreg');
  if(!(b instanceof HTMLButtonElement)) return;
  const m=_mlModifie();
  b.disabled=!m;
  b.textContent=m?'ENREGISTRER •':'ENREGISTRER';
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
/** L'enregistrement, par le chemin d'index.html. */
function mlEnregistrer(){
  if(!_ml) return false;
  const r=enregistrerSegmentsVideo(_ml.email,_ml.videoId,_ml.segments);
  if(!r.ok&&r.raison){ toast(r.raison,'var(--orange)'); return false; }
  /** @type {Segment[]} */
  const propres=Array.isArray(r.segments)?r.segments:[];
  _ml.initiaux=propres.map(s=>({...s}));
  _ml.segments=propres.map(s=>({...s}));
  if(_ml.actifId&&!_ml.segments.some(s=>s.id===_ml?.actifId))
    _ml.actifId=_ml.segments.length?_ml.segments[0].id:null;
  _mlMajListe();
  _mlMajEnregistrer();
  toastSync(r.ok,r.envoi,'Répétitions enregistrées','les répétitions sont');
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
    if(!_ml||!v||!_ml.graine||(_ml.mode!=='graine'&&_ml.mode!=='replacer')) return;
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
    if(!_ml||(_ml.mode!=='graine'&&_ml.mode!=='replacer')) return;
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
  c.classList.toggle('ml-calque-actif',_ml.mode==='graine'||_ml.mode==='replacer'||_ml.mode==='etalon'||_ml.mode==='action'
    ||!!(_ml.rec&&_ml.rec.outil==='dessin'&&!_ml.rec.pause));
  const g=c.getContext('2d'); if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);
  if(!R) return;
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
// Le panneau de la répétition choisie : poser, analyser, lire le résultat.
function _mlMajTrajectoire(){
  _mlMajPrise();
  _mlMajArticulations();
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
    mpp,theta:_ml.theta,etalon:px>0?{cm:_ml.etalon.cm,px,type:_ml.etalon.type}:null});
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
function _mlOccupe(){ return !!_ml&&(_ml.mode==='analyse'||_ml.mode==='pose'); }

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
 * L'échelle en mètres par pixel de la vidéo : l'étalon posé s'il existe, le
 * disque suivi sinon. Rend 0 quand rien ne permet de mesurer.
 * @param {number} [rayonPx]  le rayon du disque suivi, quand on l'a
 * @returns {number}
 */
function _mlMpp(rayonPx){
  if(!_ml) return 0;
  const px=_mlEtalonPx();
  if(px>0&&_ml.etalon.cm>0) return _ml.etalon.cm/100/px;
  const r=Number(rayonPx);
  return (r>0&&_ml.disqueM>0)?_ml.disqueM/(2*r):0;
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
      :'Sans étalon, l’échelle vient du disque suivi et de son diamètre. Sur machine, pose deux points '
        +'sur une longueur que tu connais.')+'</p>'
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
    _ml.lecteur=mlLecteurCorrection(hote,{url:_ml.url,correction:{...c.motion,cartes:_ml.cartes.slice(),epingles:_ml.epingles.slice()},
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
 * @param {{url:string, correction:Correction, segments:Segment[], voixUrl:string}} o
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
  for(const s of o.segments||[]){
    const b=/** @type {any} */(s).barre;
    if(b) try{ traj[s.id]={d:mlDecompacterBarre(b),b}; }catch(e){}
    const p=/** @type {any} */(s).pose;
    if(p) try{ poses[s.id]=mlAnglesSerie(p); }catch(e){}
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

// ── L'écran de l'athlète ────────────────────────────────────────────────────
/** @type {{lecteur:ReturnType<typeof mlLecteurCorrection>|null, m:Correction|null, url:string}} */
const _mlc={lecteur:null,m:null,url:''};
/**
 * @param {any} u  le dossier de l'athlète
 * @param {any} v  l'entrée de la vidéo
 * @returns {boolean}
 */
function mlAfficherCorrection(u,v){
  _mlInjecterStyle();
  mlQuitterCorrection();
  const z=_mlEl('mlc-contenu');
  const m=/** @type {Correction|null} */(motionCorrectionValide(v&&v.motion));
  if(!z||!m) return false;
  const t=_mlEl('mlc-titre'); if(t) t.textContent=String(v.name||'Correction');
  const segs=segmentsVideo(v);
  const mesures=segs.filter(s=>/** @type {any} */(s).barre);
  const coach=currentUser&&currentUser.role==='coach';
  z.innerHTML='<div class="ml-sous">Correction de ton coach'
      +(m.envoyeLe?' · '+new Date(m.envoyeLe).toLocaleDateString('fr-FR'):'')+' · '+_mlDureeCourte(m.dureeMs)+'</div>'
    +'<div id="mlc-lecteur"></div>'
    +(m.cartes.length?'<div class="ml-lab" style="margin-top:16px">Corrections écrites</div><div class="ml-cartes">'
      +m.cartes.map((k,i)=>'<button type="button" class="ml-carte-l ml-carte-b" onclick="mlCorrectionCarte('+i+')">'
        +'<span class="ml-carte-t">'+mlTempsTexte(k.aMs)+'</span><span class="ml-carte-x">'+escapeHtml(k.texte)+'</span></button>').join('')+'</div>':'')
    +(mesures.length?'<div class="ml-lab" style="margin-top:16px">Tes mesures</div>'
      +mesures.map(s=>{ const b=/** @type {any} */(s).barre, mm=b.m||{};
        return '<div class="ml-metr ml-metr-l"><div><b>'+mlNombre(mm.vMax,2)+' m/s</b><span>'+escapeHtml(s.label)+' · vitesse max</span></div>'
          +'<div><b>'+mlNombre(mm.hMax,2)+' m</b><span>'+escapeHtml(s.label)+' · hauteur max</span></div></div>'; }).join(''):'')
    +'<div class="ml-traj-cmd" style="margin-top:16px"><button type="button" class="btn btn-outline btn-sm" onclick="mlVoirOrigine()">Voir ma vidéo d’origine</button>'
      +(coach?'':'<button type="button" class="btn btn-outline btn-sm" onclick="repondreCorrectionMotion()">Répondre à mon coach</button>')+'</div>'
    +'<div id="mlc-origine"></div>';
  _mlc.m=m; _mlc.url=String(v.url||'');
  const hote=_mlEl('mlc-lecteur');
  if(hote) _mlc.lecteur=mlLecteurCorrection(hote,{url:_mlc.url,correction:m,segments:segs,voixUrl:m.voix?m.voix.url:''});
  return true;
}
function mlQuitterCorrection(){
  if(_mlc.lecteur){ _mlc.lecteur.detruire(); _mlc.lecteur=null; }
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
    '.mlc-carte-in{animation:mlcCarte var(--arc-release) var(--arc-c-discharge) both}'
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
  return {ok:true,prise,rapports:mlMorphoRapports(pts,w,h),px:{w,h}};
}

