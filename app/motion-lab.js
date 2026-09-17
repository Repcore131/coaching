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
 * @typedef {{id:string, label:string, debutMs:number, finMs:number}} Segment
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
 *   cacheBarre:{cle:string, d:{t:number[], x:number[], y:number[], vy:number[], conf:number[]}}|null,
 *   rec:any, correction:{motion:any, blob:Blob|null, blobUrl:string, statut:'brouillon'|'envoi'|'envoye'|'erreur', erreur:string}|null,
 *   cartes:{id:string, aMs:number, dureeMs:number, texte:string}[], lecteur:any
 * }} EtatMl
 */
/** @typedef {'lecture'|'graine'|'analyse'|'replacer'} ModeMl */
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
 * @typedef {{vMax:number, tVMax:number, hMax:number, depVert:number, devPlus:number, devMoins:number}} Metriques
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
 * @returns {{serie:Serie, m:Metriques, ph:[string,number,number][], pas:number}|null}
 */
function mlMetriquesBarre(points,mpp){
  const r=mlReechantillonner(points);
  if(!r||!(mpp>0)) return null;
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
  return {
    serie:{t:r.t,px:r.x,py:r.y,X:Xl,Y,vy,conf:r.conf},
    m:{vMax:iV>=0?arrondi(vPic):0,tVMax:iV>=0?Math.round(r.t[iV]):0,hMax:iH>=0?arrondi(hMax):0,
      depVert:arrondi(depVert),devPlus:arrondi(devPlus),devMoins:arrondi(devMoins)},
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
 * @param {{disqueM:number, sens:string, vw:number, vh:number, rayonPx:number, fps:number, alertes:string[]}} p
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
  const mpp=p.disqueM/(2*p.rayonPx);
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
    xy.setInt16(4*k,i16(px/p.vw,32767),true);
    xy.setInt16(4*k+2,i16(py/p.vh,32767),true);
    vy.setInt16(2*k,i16(lire(S.vy,f),100),true);
    const i=Math.floor(f), j=Math.min(total-1,i+1);
    c[k]=Math.round(255*Math.max(0,Math.min(1,Math.min(S.conf[i]||0,S.conf[j]||0))));
  }
  return {v:1,debutMs:seg.debutMs,finMs:seg.finMs,disqueM:p.disqueM,sens:p.sens,vw:p.vw,vh:p.vh,
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
    analyseJeton:0,progres:'',suivis:{},cacheBarre:null,rec:null,correction:null,cartes:[],lecteur:null};
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
    +'<div id="ml-traj"></div>'
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
  if(!_ml||!a||!_ml.dureeMs||_ml.mode==='analyse') return false;
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
  const applique=videoSetRate(v,r);
  if(applique==null||!v) return false;
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
  if(!s||_ml.mode==='analyse') return false;
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
  if(_ml.mode==='analyse') return false;
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
  c.classList.toggle('ml-calque-actif',_ml.mode==='graine'||_ml.mode==='replacer'
    ||!!(_ml.rec&&_ml.rec.outil==='dessin'&&!_ml.rec.pause));
  const g=c.getContext('2d'); if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);
  if(!R) return;
  /** @param {number} x @param {number} y @returns {[number,number]} */
  const P=(x,y)=>[R.ox+x*R.s,R.oy+y*R.s];
  const cyan=_tok('--arc-current','#4DE8FF'), calme=_tok('--arc-calm','#6E7A99');
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
  if(a&&d&&!(_ml.rec&&!_ml.rec.trace)) _mlDessinerTrajectoire(g,R,d,/** @type {any} */(a).barre,tNow,_ml.fantome);
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
      +'<div class="ml-metr">'
        +'<div><b>'+mlNombre(m.vMax,2)+'\u00a0m/s</b><span>Vitesse verticale max'+(m.tVMax?' · '+mlTempsTexte(m.tVMax):'')+'</span></div>'
        +'<div><b>'+mlNombre(m.hMax,2)+'\u00a0m</b><span>Hauteur maximale</span></div>'
        +'<div><b>'+mlNombre(m.depVert,2)+'\u00a0m</b><span>Déplacement vertical total</span></div>'
        +(avant!=null
          ?'<div><b>'+cm(avant)+' · '+cm(arriere||0)+'</b><span>Écart max vers l’avant · l’arrière</span></div>'
          :'<div><b>'+cm(m.devMoins)+' · '+cm(m.devPlus)+'</b><span>Écart max vers la gauche · la droite</span></div>')
      +'</div>'
      +'<canvas id="ml-courbe" class="ml-courbe" aria-label="Vitesse verticale dans le temps"></canvas>'
      +(b.ph&&b.ph.length?'<div class="ml-phases">'+b.ph.map((/** @type {[string,number,number]} */ p)=>
          '<button type="button" class="ml-phase" onclick="mlAllerA('+p[1]+')">'
          +escapeHtml(ML_PHASES_LIB[/** @type {keyof typeof ML_PHASES_LIB} */(p[0])]||p[0])+' <i>'+mlTempsTexte(p[1])
          +(p[2]<ML_CONF_DOUTE*100?' · incertain':'')+'</i></button>').join('')+'</div>'
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
  if(!res.ok){
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
  const calc=mlMetriquesBarre(points,disqueM/(2*rayonPx));
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
  const compacte=mlCompacterBarre(seg,calc,{disqueM,sens,vw,vh,rayonPx,fps:fpsEstime,alertes});
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
 *   |[number,'vitesse',number]|[number,'trait',number,string]|[number,'calque','trajectoire',string,number]} Geste
 */
/** @typedef {{id:string, aMs:number, dureeMs:number, texte:string}} Carte */
/**
 * @typedef {{v:1, id:string, creeLe:number, envoyeLe:number, dureeMs:number,
 *   voix:{url:string}|null, debut:{s:number, r:number}, ev:Geste[], cartes:Carte[]}} Correction
 */
/**
 * L'état d'un enregistrement en cours.
 * @typedef {{t0:number, pause:boolean, pauseDebut:number, pauseTotal:number, ev:Geste[],
 *   debut:{s:number, r:number}, media:MediaRecorder|null, flux:MediaStream|null, morceaux:Blob[],
 *   outil:'dessin'|null, couleur:number, traits:[number,string][], enCours:number[][]|null,
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
      case 'calque': calques[e[3]]=e[4]===1; break;
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
    media,flux,morceaux,outil:null,couleur:1,traits:[],enCours:null,trace:true,minuteur:0,plein:false};
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
  if(v&&!v.paused){ try{ v.pause(); }catch(e){} }
  window.clearInterval(r.minuteur);
  /** @type {Blob|null} */
  const blob=await new Promise(res=>{
    if(!r.media||r.media.state==='inactive') return res(null);
    r.media.onstop=()=>res(r.morceaux.length?new Blob(r.morceaux,{type:(r.media&&r.media.mimeType)||'audio/webm'}):null);
    try{ r.media.stop(); }catch(e){ res(null); }
  });
  if(r.flux) r.flux.getTracks().forEach(t=>t.stop());
  if(!_ml) return false;
  _ml.rec=null;
  if(dureeMs<300){ toast('Correction trop courte : rien n’a été gardé.','var(--orange)'); _mlMajCorrection(); _mlDessinerCalque(); return false; }
  /** @type {Correction} */
  const motion={v:1,id:'c'+Date.now().toString(36),creeLe:Date.now(),envoyeLe:0,dureeMs,voix:null,
    debut:r.debut,ev:r.ev.slice().sort((x,y)=>x[0]-y[0]),cartes:[]};
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
  return (l||ML_MODELES_DEFAUT).map(x=>String(x).slice(0,CORR_CARTE_MAX)).filter(Boolean).slice(0,ML_MODELES_MAX);
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
    const motion={...c.motion,voix,cartes:_ml.cartes.slice(),envoyeLe:Date.now()};
    const r=enregistrerCorrectionMotion(email,videoId,motion);
    if(!r.ok&&r.raison) throw new Error(r.raison);
    c.statut='envoye'; c.motion=r.motion||motion;
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
  z.innerHTML=h+'</div>';
  // L'APERÇU : le lecteur de l'athlète, sur la voix gardée en mémoire.
  const hote=_mlEl('ml-corr-lecteur');
  if(_ml.lecteur){ _ml.lecteur.detruire(); _ml.lecteur=null; }
  if(hote&&c){
    _ml.lecteur=mlLecteurCorrection(hote,{url:_ml.url,correction:{...c.motion,cartes:_ml.cartes.slice()},
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
    +'<span class="mlc-temps">0:00 / '+_mlDureeCourte(D)+'</span></div></div>';
  const video=/** @type {HTMLVideoElement} */(hote.querySelector('.mlc-video'));
  const calque=/** @type {HTMLCanvasElement} */(hote.querySelector('.mlc-calque'));
  const carte=/** @type {HTMLElement} */(hote.querySelector('.mlc-carte'));
  const barre=/** @type {HTMLElement} */(hote.querySelector('.mlc-barre'));
  const bJouer=/** @type {HTMLElement} */(hote.querySelector('.mlc-jouer'));
  const grand=/** @type {HTMLElement} */(hote.querySelector('.mlc-grand'));
  const temps=/** @type {HTMLElement} */(hote.querySelector('.mlc-temps'));
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
  for(const s of o.segments||[]){
    const b=/** @type {any} */(s).barre;
    if(b) try{ traj[s.id]={d:mlDecompacterBarre(b),b}; }catch(e){}
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
      for(const id of Object.keys(e.calques)) if(e.calques[id]&&traj[id]) _mlDessinerTrajectoire(g,R,traj[id].d,traj[id].b,sNow,false);
      _mlDessinerTraits(g,R,e.traits);
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
