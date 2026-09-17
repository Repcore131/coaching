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
 *   raf:number, seekEnAttente:number|null
 * }} EtatMl
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
    zoom:1,dureeMs:0,boucle:false,jeton:0,raf:0,seekEnAttente:null};
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
  if(_mlModifie()){
    const quitter=await rcConfirm('Quitter sans enregistrer ?',
      'Les répétitions modifiées depuis le dernier enregistrement seront perdues.','Quitter','Rester');
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
  if(_ml){ _ml.jeton++; if(_ml.raf) cancelAnimationFrame(_ml.raf); _ml.raf=0; }
  const cache=_mlEl('ml-vign-src');
  if(cache) cache.remove();
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
    (_ml.sousTitre?'<div class="ml-sous">'+escapeHtml(_ml.sousTitre)+'</div>':'')
    +'<div class="ml-scene">'
      +'<video id="ml-video" src="'+safeUrl(_ml.url)+'" preload="metadata" playsinline webkit-playsinline '
      +'onerror="_videoIndisponible(this)" onclick="mlLecture()"></video>'
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
    +'<div class="ml-lab" style="margin-top:18px">Répétitions</div>'
    +'<div id="ml-liste"></div>'
    +'<button type="button" class="btn btn-outline btn-sm" id="ml-ajouter" style="width:100%;margin:10px 0 0" '
      +'onclick="mlAjouter()" disabled>+ Ajouter une répétition ici</button>'
    +'<p class="ml-aide">Place la tête de lecture au début du mouvement, ajoute une répétition, puis ajuste '
      +'son début et sa fin à l’image près. Dix secondes au plus par répétition. La vidéo d’origine n’est '
      +'jamais modifiée.</p>';
  _mlBrancher();
  _mlMajListe();
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
  });
  v.addEventListener('pause',()=>{ const p=_mlEl('ml-play'); if(p) p.textContent='▶ Lecture'; _mlMajTete(); });
  v.addEventListener('seeked',()=>_mlMajTete());
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
        +'<span class="ml-rep-t">'+mlTempsTexte(s.debutMs)+' → '+mlTempsTexte(s.finMs)+' · '+mlDureeTexte(s.finMs-s.debutMs)+'</span>'
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
  if(!_ml||!a||!_ml.dureeMs) return false;
  const n=mlBorner(a,quel,ms,_ml.dureeMs);
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
  if(!s) return false;
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
  _ml.segments=_ml.segments.filter(x=>x.id!==s.id);
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
    '.ml-aide{font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55;margin:10px 0 0}'
  ].join('\n');
  document.head.appendChild(s);
}
