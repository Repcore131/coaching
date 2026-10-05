// ══ LA FOUDRE — rcFoudre(cible, options) ═══════════════════════════════════
//
// L'événement rare. Un record en séance aujourd'hui ; demain un badge (idée
// 05), un rang (idée 13), un palier de série. RÉUTILISABLE À DESSEIN : un seul
// dessin de la foudre, sinon chaque écran finirait par avoir la sienne.
//
// LA CHRONOLOGIE, en millisecondes depuis l'appel :
//     0 ─ flash blanc à 85 % (70 ms)         160 ─ second flash, plus faible
//     0 ─ premier éclair  ·  45 / 95 ─ les suivants (2 ou 3 au total)
//    30 ─ impact : étincelles (600 ms max), tremblement (280 ms), grondement
//  ~550 ─ le dernier éclair s'est éteint     ~650 ─ la dernière étincelle aussi
// PLAFOND DUR : FOUDRE_MAX = 1 100 ms. Au-delà, le calque est retiré quoi qu'il
// arrive — l'athlète reprend sa série, la foudre ne le retient jamais.
//
// UNE TOILE PLEIN ÉCRAN, CRÉÉE À L'APPEL ET RETIRÉE À LA FIN. pointer-events
// :none : elle recouvre tout mais n'intercepte rien, l'athlète peut taper sa
// série suivante pendant qu'elle brûle encore. Posée dans <body> et PAS dans
// #arc-calque : la feuille masque ce calque sous « réduire les animations », or
// la variante douce a encore besoin de son flash.
//
// SANS BIBLIOTHÈQUE. Les éclairs sont tirés par DÉPLACEMENT DU POINT MILIEU :
// on coupe le segment en deux, on écarte le milieu perpendiculairement d'une
// quantité qui diminue de moitié à chaque niveau. 6 à 8 niveaux = 64 à 256
// segments, assez pour lire une foudre, trop peu pour peser sur une frame.
//
// options :
//   son        false pour couper le son même si l'app l'autorise
//   haptique   false pour ne pas vibrer
//   eclairs    2 ou 3 (tiré au hasard sinon)
//   conteneur  l'élément qui tremble (défaut : l'écran actif)
//   couleur    la teinte du halo et du trait (défaut ROUGE_MARQUE)
// Rend une Promise résolue à la fin (jamais rejetée), avec le point d'impact —
// l'appelant peut enchaîner, mais n'a JAMAIS à attendre pour laisser la main.
//
// NE LÈVE JAMAIS : comme toute l'animation, la foudre cède en silence.
const FOUDRE_MAX=1100;
const FOUDRE_ROUGE=ROUGE_MARQUE;
function rcFoudre(cible,o){
  o=o||{};
  try{
    const el=(typeof cible==='string')?document.getElementById(cible):cible;
    const W=window.innerWidth||document.documentElement.clientWidth||360;
    const H=window.innerHeight||document.documentElement.clientHeight||640;
    // Le point d'impact : le centre de la cible, ou un point {x,y}, ou le
    // centre de l'écran quand la cible est masquée — mieux vaut frapper au
    // milieu que ne pas frapper du tout.
    let ix=W/2, iy=H/2;
    if(el&&el.getBoundingClientRect){
      const r=el.getBoundingClientRect();
      if(r.width||r.height){ ix=r.left+r.width/2; iy=r.top+r.height/2; }
    }else if(cible&&typeof cible.x==='number'&&typeof cible.y==='number'){
      ix=cible.x; iy=cible.y;
    }
    const impact={x:ix,y:iy};
    // LES SENS D'ABORD, qui ne dépendent d'aucune frame. Vibration et son
    // survivent à « réduire les animations » : même règle que arcHaptique.
    if(o.haptique!==false) arcHaptique('foudre');
    if(o.son!==false&&_foudreSonPermis()) _foudreSon();
    if(arcReduit()) return _foudreDouce(impact);
    return _foudrePleine(impact,W,H,o);
  }catch(e){ return Promise.resolve(null); }
}
// LE SON SUIT LE RÉGLAGE DE L'APP. Aucun son par défaut (salle bruyante,
// écouteurs) : c'est l'interrupteur du son de repos qui fait foi, le seul
// réglage de son que connaisse l'athlète. Éteint = mode silencieux = rien.
function _foudreSonPermis(){
  try{ return !!(typeof currentUser!=='undefined'&&currentUser&&currentUser.sonRepos); }
  catch(e){ return false; }
}
// Le calque de la foudre : une toile fixe, plein écran, qui n'intercepte rien.
function _foudreToile(W,H){
  const c=document.createElement('canvas');
  c.className='rc-foudre';
  c.setAttribute('aria-hidden','true');
  // Densité plafonnée à 2 : à 3, la toile d'un grand téléphone passe les
  // 10 millions de pixels, et le shadowBlur se paie au pixel.
  const dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(W*dpr); c.height=Math.round(H*dpr);
  c.style.cssText='position:fixed;left:0;top:0;width:'+W+'px;height:'+H+'px;'
    +'pointer-events:none;z-index:1900';
  document.body.appendChild(c);
  const ctx=c.getContext('2d');
  if(ctx) ctx.setTransform(dpr,0,0,dpr,0,0);
  return {c,ctx};
}
// VARIANTE « RÉDUIRE LES ANIMATIONS » : un seul flash doux, sans éclair, sans
// étincelle, sans tremblement. Une opacité qui monte et redescend, rien qui
// bouge. Le compteur, lui, est posé par l'appelant (arcChiffre pose la valeur
// finale sous arcReduit()).
function _foudreDouce(impact){
  return new Promise(res=>{
    let n=null;
    try{
      n=document.createElement('div');
      n.className='rc-foudre';
      n.setAttribute('aria-hidden','true');
      n.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1900;'
        +'background:#fff;opacity:0;transition:opacity 90ms linear';
      document.body.appendChild(n);
      requestAnimationFrame(()=>{ if(n) n.style.opacity='0.22'; });
      setTimeout(()=>{ if(n){ n.style.transition='opacity 260ms linear'; n.style.opacity='0'; } },110);
    }catch(e){}
    setTimeout(()=>{ try{ n&&n.remove(); }catch(e){} res(impact); },420);
  });
}
function _foudrePleine(impact,W,H,o){
  return new Promise(res=>{
    const {c,ctx}=_foudreToile(W,H);
    let fini=false;
    const finir=()=>{ if(fini) return; fini=true; try{ c.remove(); }catch(e){} res(impact); };
    // LE FILET DE SÉCURITÉ. requestAnimationFrame ne tourne pas sur une page
    // cachée : sans ce minuteur, une foudre lancée juste avant de ranger le
    // téléphone laisserait sa toile collée à l'écran au retour.
    setTimeout(finir,FOUDRE_MAX);
    if(!ctx){ finir(); return; }
    const sc=_foudreScene(impact,W,o);
    setTimeout(()=>{ _foudreTrembler(o.conteneur); },FOUDRE_IMPACT);
    const t0=performance.now();
    const image=(now)=>{
      if(fini) return;
      const t=now-t0;
      ctx.clearRect(0,0,W,H);
      const vivant=_foudrePeindre(ctx,sc,t,W,H);
      if(vivant||t<240) requestAnimationFrame(image);
      else finir();
    };
    requestAnimationFrame(image);
  });
}
// L'impact tombe avec le premier éclair : le tremblement et les étincelles
// sont la CONSÉQUENCE de la frappe, jamais posés à côté.
const FOUDRE_IMPACT=30;
// LA FOUDRE EN DEUX TEMPS : la scène, tirée une fois (les éclairs, les
// étincelles), puis l'image à l'instant t. L'écran avance t avec son horloge ;
// la vidéo (exporterVideoVisuel) avec le temps de la vidéo — même dessin.
// `o.echelle` : les traits et les étincelles grossis pour une toile en pixels
// d'image (1080 de large) plutôt qu'en pixels CSS (360).
function _foudreScene(impact,W,o){
  o=o||{};
  const k=Number(o.echelle)>0?Number(o.echelle):1;
  // 1 éclair : la « petite foudre » (sous-niveau).
  const nb=(o.eclairs===1||o.eclairs===2||o.eclairs===3)?o.eclairs:(Math.random()<0.5?2:3);
  const eclairs=[];
  for(let i=0;i<nb;i++){ const e=_foudreEclair(impact,W,[0,45,95][i]); e.epais*=k; e.echelle=k; eclairs.push(e); }
  const etincelles=_foudreEtincelles(impact,FOUDRE_IMPACT);
  if(k!==1) etincelles.forEach(p=>{ p.vx*=k; p.vy*=k; p.taille*=k; });
  return {eclairs,etincelles,coul:o.couleur||FOUDRE_ROUGE,echelle:k};
}
/** Peint la foudre à l'instant t (ms). Rend true tant qu'il reste quelque chose à peindre. */
function _foudrePeindre(ctx,sc,t,W,H){
  // 1. LE FLASH, sous tout le reste : blanc sur blanc, un éclair ne se
  //    verrait pas. Double, comme une vraie foudre : le coup, puis le
  //    réamorçage du canal, plus faible.
  let f=0;
  if(t>=0&&t<70) f=0.85*(t<50?1:1-(t-50)/20);
  else if(t>=160&&t<230) f=0.38*(1-(t-160)/70);
  if(f>0){ ctx.save(); ctx.fillStyle='rgba(255,255,255,'+f.toFixed(3)+')'; ctx.fillRect(0,0,W,H); ctx.restore(); }
  // 2. LES ÉCLAIRS
  let vivant=false;
  for(const e of sc.eclairs){
    const a=_foudreAlpha(e,t);
    if(a<0) continue;
    vivant=true;
    if(a>0) _foudreDessiner(ctx,e,a,sc.coul);
  }
  // 3. LES ÉTINCELLES, par-dessus : elles jaillissent du point d'impact.
  if(_foudreEtincellesPeindre(ctx,sc.etincelles,t,1500*(sc.echelle||1))) vivant=true;
  return vivant;
}
// UN ÉCLAIR : un tronc du haut de l'écran jusqu'à l'impact, et ses branches.
// Le départ est tiré dans une bande autour de l'aplomb de la cible — un
// éclair parti du coin opposé traverserait tout l'écran en diagonale et se
// lirait comme un trait, pas comme une chute.
function _foudreEclair(impact,W,delai){
  const x0=Math.max(-20,Math.min(W+20,impact.x+(Math.random()*2-1)*W*0.35));
  const y0=-12;
  const niveaux=6+Math.floor(Math.random()*3);            // 6, 7 ou 8
  const long=Math.hypot(impact.x-x0,impact.y-y0);
  const tronc=_foudreMilieu(x0,y0,impact.x,impact.y,long*0.18,niveaux);
  const branches=[];
  // LES BRANCHES partent du tronc, jamais de son dernier quart : une branche
  // qui naîtrait sous l'impact frapperait « à côté » de la cible.
  const nbB=2+Math.floor(Math.random()*3);
  for(let b=0;b<nbB;b++){
    const i=Math.floor(tronc.length*(0.12+Math.random()*0.6));
    const p=tronc[i], q=tronc[Math.min(tronc.length-1,i+1)];
    const ang=Math.atan2(q.y-p.y,q.x-p.x)+(Math.random()<0.5?-1:1)*(0.35+Math.random()*0.6);
    const l=long*(0.12+Math.random()*0.22);
    const pts=_foudreMilieu(p.x,p.y,p.x+Math.cos(ang)*l,p.y+Math.sin(ang)*l,l*0.22,Math.max(3,niveaux-3));
    branches.push(pts);
  }
  // 2 ou 3 RÉAPPARITIONS dans les 250 premières ms — le scintillement du
  // canal qui se recharge —, puis un fondu de 200 ms. Les plages « allumé »
  // sont tirées une fois : c'est le même éclair qui revient, pas un autre.
  const n=2+(Math.random()<0.5?1:0);
  const plages=[[0,55]];
  for(let k=1;k<=n;k++){
    const deb=Math.round(55+k*(195/(n+1))+(Math.random()*16-8));
    plages.push([deb,Math.min(250,deb+30+Math.random()*18)]);
  }
  return {delai,tronc,branches,plages,epais:0.85+Math.random()*0.4};
}
// DÉPLACEMENT DU POINT MILIEU. Itératif et non récursif : la liste des
// points double à chaque niveau, sans pile d'appels.
function _foudreMilieu(x1,y1,x2,y2,dep,niveaux){
  let pts=[{x:x1,y:y1},{x:x2,y:y2}];
  let d=dep;
  for(let n=0;n<niveaux;n++){
    const nv=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy)||1;
      // Écart PERPENDICULAIRE au segment : un écart pris en x seul aplatirait
      // les éclairs obliques.
      const e=(Math.random()*2-1)*d;
      nv.push({x:(a.x+b.x)/2-dy/L*e,y:(a.y+b.y)/2+dx/L*e},b);
    }
    pts=nv; d/=2;
  }
  return pts;
}
// L'opacité d'un éclair à l'instant t. -1 : pas encore né ou déjà mort.
// Entre deux réapparitions il ne s'éteint pas tout à fait : le canal ionisé
// reste une trace, c'est ce qui fait lire UN éclair qui scintille et non trois.
function _foudreAlpha(e,t){
  const r=t-e.delai;
  if(r<0) return 0;
  if(r<250){
    for(const p of e.plages) if(r>=p[0]&&r<p[1]) return 1;
    return 0.14;
  }
  if(r<450) return 1-(r-250)/200;
  return -1;
}
function _foudreChemin(ctx,pts){
  ctx.beginPath();
  ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
}
// TROIS PASSES, du plus large au plus fin : le halo rouge flou, le trait
// rouge, le cœur blanc. C'est l'empilement qui fait l'incandescence — un trait
// seul, même épais, reste un dessin.
function _foudreDessiner(ctx,e,a,coul){
  const w=e.epais;
  const passe=(pts,k)=>{
    ctx.save();
    ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.shadowColor=coul; ctx.shadowBlur=30*(e.echelle||1);
    ctx.strokeStyle=coul; ctx.lineWidth=9*w*k;
    ctx.globalAlpha=a*k*0.45; _foudreChemin(ctx,pts); ctx.stroke();
    ctx.shadowBlur=0;
    ctx.globalAlpha=a*k;
    ctx.lineWidth=3.6*w*k; _foudreChemin(ctx,pts); ctx.stroke();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.3*w*k; _foudreChemin(ctx,pts); ctx.stroke();
    ctx.restore();
  };
  passe(e.tronc,1);
  for(const b of e.branches) passe(b,0.55);
}
// 30 À 40 ÉTINCELLES, blanches et rouges, projetées vers le haut et les côtés
// puis rattrapées par la gravité. Chacune vit entre 350 et 600 ms.
function _foudreEtincelles(impact,tImpact){
  const n=30+Math.floor(Math.random()*11);
  const out=[];
  for(let i=0;i<n;i++){
    // Un éventail vers le haut (−π … 0), un peu élargi : quelques-unes
    // partent presque à l'horizontale, aucune ne part droit vers le sol.
    const ang=-Math.PI*(0.05+Math.random()*0.9);
    const v=180+Math.random()*420;
    out.push({x:impact.x,y:impact.y,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,
      t0:tImpact+Math.random()*40,vie:350+Math.random()*250,
      coul:Math.random()<0.55?'#FFFFFF':'#FF3B3B',taille:1+Math.random()*1.6});
  }
  return out;
}
// Position calculée analytiquement à partir de t, pas intégrée frame à frame :
// une frame sautée ne ralentit pas les étincelles, elles sont où elles doivent.
function _foudreEtincellesPeindre(ctx,ps,t,gravite){
  const G=gravite||1500;                          // px/s²
  let vivant=false;
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  ctx.lineCap='round';
  for(const p of ps){
    const r=(t-p.t0)/1000;
    if(r<0){ vivant=true; continue; }
    if(r*1000>p.vie) continue;
    vivant=true;
    const x=p.x+p.vx*r, y=p.y+p.vy*r+0.5*G*r*r;
    const vx=p.vx, vy=p.vy+G*r;
    const vit=Math.hypot(vx,vy)||1;
    // UNE TRAÎNÉE ET NON UN POINT : 18 ms de trajectoire, dans l'axe de la
    // vitesse. Un point rond de 2 px ne se lit pas comme une étincelle.
    const l=Math.min(14*(G/1500),vit*0.018);
    ctx.globalAlpha=1-(r*1000)/p.vie;
    ctx.strokeStyle=p.coul; ctx.lineWidth=p.taille;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x-vx/vit*l,y-vy/vit*l); ctx.stroke();
  }
  ctx.restore();
  return vivant;
}
// LE TREMBLEMENT : ±6 px au hasard, amorti, 280 ms, sur le conteneur
// principal. translate SEUL — composé au transform existant par composite:'add'
// quand le navigateur le sait, pour ne pas décaler un écran déjà transformé.
function _foudreTrembler(cont){
  try{
    const z=(typeof cont==='string'?document.querySelector(cont):cont)
      ||document.querySelector('.screen.active')||document.body;
    if(!z||!z.animate) return null;
    const kf=[], N=9;
    for(let k=0;k<=N;k++){
      const amort=1-k/N;
      const dx=k===N?0:(Math.random()*2-1)*6*amort;
      const dy=k===N?0:(Math.random()*2-1)*6*amort;
      kf.push({transform:'translate('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px)'});
    }
    return _animer(z,kf,{duration:280,easing:'linear',composite:'add'});
  }catch(e){ return null; }
}
// LE SON, SANS FICHIER. Un crépitement — bruit blanc passe-haut, enveloppe de
// quelques dizaines de ms, haché pour craquer au lieu de souffler — puis un
// grondement : un oscillateur à 50 Hz qui roule 400 ms.
// Il reprend le contexte audio du repos (_ctxSon), amorcé au geste : sur iOS
// un contexte créé hors geste naîtrait suspendu. Il n'en ouvre un que s'il
// n'y en a aucun, comme _bipRepos.
function _foudreSon(){
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return;
    if(_ctxSon&&_ctxSon.state==='closed') _ctxSon=null;
    if(!_ctxSon) _ctxSon=new C();
    const ctx=_ctxSon;
    try{ ctx.resume(); }catch(e){}
    const t=ctx.currentTime;
    // Crépitement
    const dur=0.16, sr=ctx.sampleRate;
    const buf=ctx.createBuffer(1,Math.floor(sr*dur),sr);
    const d=buf.getChannelData(0);
    let porte=1;
    for(let i=0;i<d.length;i++){
      // Hachage : la « porte » se ferme et se rouvre au hasard, toutes les
      // ~2 ms. Sans elle, c'est un souffle ; avec, ça craque.
      if(i%Math.floor(sr*0.002)===0) porte=Math.random()<0.65?1:0.15;
      d[i]=(Math.random()*2-1)*porte;
    }
    const src=ctx.createBufferSource(); src.buffer=buf;
    const hp=ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=2500;
    const g1=ctx.createGain();
    g1.gain.setValueAtTime(0.0001,t);
    g1.gain.exponentialRampToValueAtTime(0.5,t+0.004);
    g1.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.connect(hp); hp.connect(g1); g1.connect(ctx.destination);
    src.start(t); src.stop(t+dur);
    // Grondement
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=50;
    const g2=ctx.createGain();
    const t2=t+0.06;
    g2.gain.setValueAtTime(0.0001,t2);
    g2.gain.exponentialRampToValueAtTime(0.45,t2+0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001,t2+0.4);
    o.connect(g2); g2.connect(ctx.destination);
    o.start(t2); o.stop(t2+0.41);
  }catch(e){}
}
// EXPOSÉE sur window, explicitement : les badges (idée 05), les rangs (idée
// 13) et les paliers de série l'appelleront depuis d'autres modules, et un nom
// global implicite est la première chose qu'un découpage du fichier casserait.
try{ window.rcFoudre=rcFoudre; }catch(e){}

// ── LA FOUDRE DU RECORD, EN SÉANCE ─────────────────────────────────────────
// La charge est frappée, puis elle COMPTE de l'ancien record à la nouvelle
// valeur en grésillant, et un halo rouge pulse deux fois. Le tout tient en
// moins de 1,2 s et ne bloque rien : le champ est déjà désactivé (série
// validée), et la ligne suivante reste utilisable pendant tout ce temps.
//
// `ancienne` : la meilleure charge d'AVANT, ou null. Sans elle — premier
// record de l'exercice, ou record d'e1RM à charge égale —, le chiffre grésille
// sur place au lieu de partir de zéro, ce qui se lirait comme une donnée perdue.
function rcFoudreRecord(champ,ancienne,nouvelle){
  try{
    if(!champ) return;
    const vers=parseFloat(nouvelle);
    if(!(vers>0)) return;
    const brut=String(champ.value!=null&&champ.value!==''?champ.value:nouvelle);
    // La valeur finale est rendue TELLE QUE SAISIE : « 102.5 » reste « 102.5 »,
    // jamais « 102.50 » ni « 103 ». Les valeurs de passage tombent au
    // demi-kilo : des charges plausibles, pas des 101.37 qui se liraient
    // comme une erreur. Comparaison à epsilon : de+(vers-de)*1 n'est pas
    // toujours égal à vers en virgule flottante.
    const fmt=v=>Math.abs(v-vers)<1e-9?brut:String(Math.max(0,Math.round(v*2)/2));
    const de=(ancienne>0&&ancienne<vers)?ancienne:vers;
    // Le compteur part AVEC l'impact, pas après : la foudre frappe la charge et
    // c'est la charge qui réagit. L'ancienne valeur s'affiche dès t=0, puis
    // 600 ms de montée et de grésillement.
    rcFoudre(champ);
    champ.dataset.valeur=String(de);
    arcCompteur(champ,vers,{duree:600,gresille:true,format:fmt});
    // Le dataset n'est pas une donnée ici : on le retire, pour qu'aucun
    // compteur ne le relise plus tard comme une valeur précédente.
    try{ delete champ.dataset.valeur; }catch(e){}
    // Le halo rouge qui pulse DEUX FOIS : 280 ms chacun, le second part quand
    // le premier s'éteint. Fin à 380 + 280 = 660 ms.
    const halo={couleur:'rgba(224,32,32,.75)',duree:280};
    setTimeout(()=>{ try{ if(champ.isConnected) arcGlow(champ,halo); }catch(e){} },80);
    setTimeout(()=>{ try{ if(champ.isConnected) arcGlow(champ,halo); }catch(e){} },380);
  }catch(e){}
}

// ── ANIMATION 7 : L'ARC QUI CHANGE D'ONGLET ────────────────────────────────
// Le courant ne s'éteint pas ici pour se rallumer là : il SE DÉPLACE. Un trait
// de 2 px part du liseré de l'onglet quitté et rejoint celui de l'onglet visé
// en 140 ms, puis l'icône d'arrivée encaisse un impact léger.
//
// L'impact est LÉGER (1,10 et non 1,14) et sans flash ni halo, à la différence
// de la validation de série. La barre d'onglets est traversée des dizaines de
// fois par séance pour de simples consultations : la traiter comme un événement
// aurait usé le seul geste qui mérite de l'être.
function _arcOnglet(de,vers){
  try{
    if(arcReduit()||!de||!vers) return null;
    const a=de.getBoundingClientRect(), b=vers.getBoundingClientRect();
    if(!a.width||!b.width) return null;
    const n=document.createElement('div');
    n.className='arc-onglet';
    n.style.left=a.left+'px'; n.style.top=a.top+'px';
    n.style.width=a.width+'px'; n.style.height='2px';
    _arcCalque().appendChild(n);
    const an=_animer(n,
      [{transform:'translateX(0)'},{transform:'translateX('+(b.left-a.left)+'px)'}],
      {duration:ARC.strike,easing:ARC.discharge,fill:'none'});
    _arcJeter(n,an);
    const icone=vers.querySelector('svg');
    if(icone) arcDecharge(icone,{flash:false,halo:false,impact:1.10});
    return an;
  }catch(e){ return null; }
}

// ── ANIMATION 9 : LA COURBE SE TRACE COMME UN COURANT DANS UN FIL ──────────
// UNE SEULE FOIS PAR ÉLÉMENT, jamais rejouée au défilement : c'est à quoi sert
// ce WeakSet. Un observateur d'intersection aurait rallumé le tracé à chaque
// passage de la courbe dans l'écran — joli une fois, insupportable à la
// dixième.
//
// DEUX TECHNIQUES, PARCE QU'IL Y A DEUX SORTES DE GRAPHIQUES, et c'est la seule
// entorse revendiquée à la règle « transform et opacity seuls » :
//
//   • Les courbes SVG (_courbePesee, _rapCourbePoids) reçoivent le VRAI tracé
//     par stroke-dashoffset, celui que le cahier des charges nomme. Il n'existe
//     aucun équivalent en transform, et la spécification l'autorise ici
//     explicitement. Une courbe, une propriété animée, 620 ms : c'est tenable.
//
//   • Les quatorze <canvas> (lineChart, barChart, multiLineChart, drawLineChart)
//     N'ONT PAS de stroke-dashoffset — un canvas n'a ni chemin ni trait, juste
//     des pixels. Les tracer vraiment supposerait de réécrire les quatre
//     fonctions de dessin en SVG : c'est un chantier, pas une animation. Ils
//     reçoivent donc la TRAVERSÉE — un courant balaie le graphique une fois.
//     L'intention est tenue, le moyen est honnête, et rien du code de dessin
//     n'est touché.
const _arcTraces=new WeakSet();
function arcTracerCourbes(racine){
  let n=0;
  try{
    const r=racine||document;
    if(!r||!r.querySelectorAll) return 0;
    // La racine peut ÊTRE le graphique : querySelectorAll ne rend que des
    // descendants, et un <canvas> n'en a aucun.
    const toiles=Array.prototype.slice.call(r.querySelectorAll('canvas'));
    if(r.matches&&r.matches('canvas')) toiles.push(r);
    r.querySelectorAll('svg.arc-courbe path').forEach(p=>{
      if(_arcTraces.has(p)) return;
      if(arcReduit()||!p.getTotalLength||!p.animate){ _arcTraces.add(p); return; }
      // LE TRACÉ ATTEND L'ENTRÉE DANS LE CHAMP. Auparavant il partait à
      // l'affichage de l'écran : les courbes sous la ligne de flottaison jouaient
      // leurs 620 ms hors de l'écran, puis étaient marquées « faites ». L'athlète
      // ne les voyait jamais. _auChamp se retire dès la première intersection ;
      // _arcTraces protège d'un second appel sur le même écran. Deux garanties
      // différentes, et les deux sont nécessaires.
      _arcTraces.add(p);
      _auChamp(p,()=>{
        let L=0;
        try{ L=p.getTotalLength(); }catch(e){ return; }
        if(!(L>0)) return;                 // pas encore mesurable
        p.style.strokeDasharray=L;
        const a=_animer(p,[{strokeDashoffset:L},{strokeDashoffset:0}],
          {duration:ARC.afterglow,easing:ARC.discharge,fill:'none'});
        if(!a){ try{ p.style.strokeDasharray=''; }catch(e){} return; }
        // Le pointillé est RETIRÉ à la fin : le laisser en place ne se voit pas
        // aujourd'hui (un tiret long comme le chemin est un trait plein), mais il
        // deviendrait visible à la première courbe rendue en plusieurs segments.
        const net=()=>{ try{ p.style.strokeDasharray=''; }catch(e){} };
        a.addEventListener('finish',net); a.addEventListener('cancel',net);
      });
      n++;
    });
    toiles.forEach(c=>{
      if(_arcTraces.has(c)) return;
      if(arcReduit()){ _arcTraces.add(c); return; }
      // UNE TOILE NON ENCORE PEINTE EST IGNORÉE, pas marquée. Les dimensions
      // sont posées avant le dessin : les lire ne dit rien. Le drapeau arcPret
      // est posé par _setupCanvas, drawLineChart et _drawCaffeineHistory, APRÈS
      // leur dernier tracé. Sans lui, le balayage déclenché par go() tombait sur
      // une toile blanche et le WeakSet la condamnait pour de bon.
      if(c.dataset.arcPret!=='1') return;
      _arcTraces.add(c);
      _auChamp(c,()=>{ arcTraversee(c,{duree:ARC.afterglow}); });
      n++;
    });
  }catch(e){}
  return n;
}

// ── LE RETRAIT D'UNE LIGNE ─────────────────────────────────────────────────
// Les fonctions de suppression font splice() puis un re-rendu innerHTML
// complet : la ligne n'etait pas retiree, elle CESSAIT D'EXISTER entre deux
// images, et tout ce qui est en dessous sautait vers le haut d'un coup. Le
// desequilibre etait frappant — l'AJOUT a droit a fjNeuf sur 1 200 ms, le
// RETRAIT a rien, alors que c'est le geste qu'on a besoin de pouvoir relire
// pour savoir si on s'est trompe de ligne.
//
// ENTORSE A LA REGLE 5, assumee et bornee : height/padding/margin declenchent
// bien une mise en page, mais sur UN SEUL noeud, pendant 120 ms, et UNE FOIS
// par geste de suppression. Il n'existe aucun equivalent en transform pour
// refermer l'espace laisse par la ligne, et un scaleY deformerait le texte.
// Les 160 premieres millisecondes — opacite et translation — sont, elles,
// purement composees.
//
// REGLE 7 : le rappel porte l'ecriture, et il est execute MEME quand
// l'animation ne part pas. Rien n'est conditionne a sa reussite.
function arcRetrait(el,apres){
  const fini=()=>{ try{ if(typeof apres==='function') apres(); }catch(e){} };
  if(!el||!el.animate||arcReduit()){ fini(); return null; }
  let h=0;
  try{ h=el.getBoundingClientRect().height; }catch(e){}
  if(!(h>0)){ fini(); return null; }
  let mb='0px',pt='0px',pb='0px';
  try{ const cs=getComputedStyle(el); mb=cs.marginBottom; pt=cs.paddingTop; pb=cs.paddingBottom; }catch(e){}
  el.style.overflow='hidden';
  el.style.pointerEvents='none';
  const a=el.animate([
    {opacity:1,transform:'translateX(0)',   height:h+'px',marginBottom:mb,   paddingTop:pt,   paddingBottom:pb,   offset:0},
    {opacity:0,transform:'translateX(-18px)',height:h+'px',marginBottom:mb,  paddingTop:pt,   paddingBottom:pb,   offset:0.57},
    {opacity:0,transform:'translateX(-18px)',height:'0px', marginBottom:'0px',paddingTop:'0px',paddingBottom:'0px',offset:1}
  ],{duration:280,easing:ARC.charge,fill:'none'});
  if(!a){ fini(); return null; }
  let fait=false;
  const une=()=>{ if(fait) return; fait=true; fini(); };
  a.addEventListener('finish',une);
  a.addEventListener('cancel',une);
  // LE FILET, et il n'est pas decoratif : ce rappel porte le splice, le
  // saveUser et le re-rendu. Un onglet masque ne doit pas pouvoir avaler une
  // suppression que l'utilisateur a demandee.
  setTimeout(une,360);
  return a;
}

// ── LA SAISIE REFUSEE ──────────────────────────────────────────────────────
// Deux oscillations de 5 px, 190 ms. Elle s'applique au CHAMP, jamais a son
// conteneur : une secousse sur une carte entiere se lit comme un plantage. Et
// jamais pendant que l'utilisateur tape — uniquement a la soumission.
function arcRefus(el){
  if(!el||!el.animate||arcReduit()) return null;
  return el.animate([
    {transform:'translateX(0)',   offset:0},
    {transform:'translateX(5px)', offset:0.28},
    {transform:'translateX(-5px)',offset:0.52},
    {transform:'translateX(3px)', offset:0.76},
    {transform:'translateX(0)',   offset:1}
  ],{duration:190,easing:ARC.discharge,fill:'none'});
}

// ── LE BOUTON QUI ATTEND LE DIT ────────────────────────────────────────────
// Onze sites verrouillaient un bouton pour un appel reseau en changeant son
// seul libelle. Sur l'OCR l'attente depasse cinq secondes le temps de
// telecharger le moteur, et rien ne bougeait. Le trait qui balaie le bas du
// bouton et le opacity:.72 sont poses ici, une fois, pour les onze.
function arcAttendre(btn,libelle){
  if(!btn) return null;
  const av=btn.textContent;
  btn.dataset.arcLibelle=av;
  btn.disabled=true;
  btn.classList.add('arc-attente-bar');
  if(libelle) btn.textContent=libelle;
  return av;
}
function arcRendre(btn,libelle){
  if(!btn) return;
  btn.disabled=false;
  btn.classList.remove('arc-attente-bar');
  const av=(libelle!=null)?libelle:btn.dataset.arcLibelle;
  if(av!=null) btn.textContent=av;
  delete btn.dataset.arcLibelle;
}

// ── L'ENTREE AU DEFILEMENT DES LISTES LONGUES ──────────────────────────────
// Les six premieres lignes de la liste coach cascadent ; tout ce qui est sous
// le pli — l'essentiel chez un coach de quarante athletes — apparaissait deja
// pose. Trois points non negociables : unobserve des le premier passage (joli
// une fois, insupportable a la dixieme), disconnect() en tete de fonction
// parce que le conteneur est reconstruit a chaque frappe, et le test de
// disponibilite AVANT la pose de arc-attente — sans quoi un navigateur sans
// IntersectionObserver afficherait une liste vide.
const ARC_VUE_MAX=24;
var ARC_VUE_AU_DEFILEMENT=false;   // var : lu avant sa ligne sans erreur
function arcEntreeAuDefilement(conteneur,selecteur,depuis){
  if(!conteneur) return null;
  try{ if(conteneur._arcObs){ conteneur._arcObs.disconnect(); conteneur._arcObs=null; } }catch(e){}
  // PLUS D'APPARITION AU DEFILEMENT (charte du 26/09/2026) : une liste est la
  // des qu'elle est rendue. Un contenu qui attend d'etre vu pour s'afficher
  // fait « site de demonstration », et cache ce qu'on vient chercher.
  if(ARC_VUE_AU_DEFILEMENT!==true) return null;
  if(arcReduit()||typeof IntersectionObserver!=='function') return null;
  const d=depuis||0;
  const els=Array.prototype.slice.call(conteneur.querySelectorAll(selecteur)).slice(d,d+ARC_VUE_MAX);
  if(!els.length) return null;
  els.forEach(e=>e.classList.add('arc-attente'));
  const obs=new IntersectionObserver(entrees=>{
    entrees.forEach(x=>{
      if(!x.isIntersecting) return;
      x.target.classList.remove('arc-attente');
      x.target.classList.add('arc-vu');
      obs.unobserve(x.target);
    });
  },{threshold:.15,rootMargin:'0px 0px -8% 0px'});
  els.forEach(e=>obs.observe(e));
  conteneur._arcObs=obs;
  return obs;
}

// ── ANIMATION 2 : LES ÉTATS DE PRESSION ────────────────────────────────────
// La brique de base, celle qu'on ressent partout sans la remarquer.
//
// LA CHARGE EST LAISSÉE À LA FEUILLE DE STYLE (:active), et c'est un choix, pas
// une facilité : elle est gratuite, elle démarre à l'instant exact du contact —
// avant même qu'un gestionnaire JS soit appelé — et surtout le navigateur la
// retire tout seul dès que le geste devient un défilement. Un pointerdown en JS
// aurait allumé une charge à chaque début de scroll sur une carte.
//
// LA DÉCHARGE ET LA RÉMANENCE SONT ICI, sur pointerup — donc sur un vrai
// relâchement, jamais sur un scroll avorté (qui émet pointercancel, que l'on
// n'écoute pas). L'haptique tombe SUR la décharge et pas à l'appui : même règle
// que la validation de série, et c'est ce qui la fait ressentir comme une
// libération plutôt que comme un accusé de réception.
//
// PASSIF ET EN CAPTURE. Passif : cette écoute ne doit jamais retarder d'un seul
// millimètre le défilement, et elle n'appelle aucun preventDefault. Capture :
// elle reçoit l'événement même quand un gestionnaire en aval l'arrête, ce qui
// arrive dans les feuilles modales. Aucune ACTION n'est déclenchée ici — cette
// fonction ne fait que peindre, et son échec ne coûte jamais qu'un halo.
const ARC_PRESSION='button,.btn,.content-card,.client-row,.choice-opt,'
  +'.emo-opt,.gsl-opt,.obj-opt,[role="button"]';
function _arcPression(e){
  try{
    if(!e.target||!e.target.closest) return;
    const el=e.target.closest(ARC_PRESSION);
    if(!el) return;
    // Un élément désactivé ne rend rien : lui répondre serait mentir.
    if(el.disabled||el.getAttribute('aria-disabled')==='true') return;
    // data-arc="off" : la sortie de secours des gestes qui portent DÉJÀ leur
    // propre décharge. Sans elle, le bouton de validation de série recevrait
    // deux réponses pour un seul appui — une vibration légère par-dessus la
    // lourde, et un halo générique par-dessus l'arc signature. Le geste le plus
    // répété de la séance serait justement le plus brouillon.
    if(el.getAttribute('data-arc')==='off') return;
    arcHaptique('legere');
    arcGlow(el);
  }catch(err){}
}
// LES REPLIS S'OUVRENT SUR LEUR CONTENU, pas sur leur boite. Un seul repli
// avait du mouvement, et c'etait son chevron : le contenu, lui, apparaissait
// sans transition dans les seize cas, ce qui fait sauter la page d'un bloc. Le
// navigateur n'anime pas nativement <details>, et animer sa hauteur ferait
// remonter tout ce qui suit — a proscrire sur des listes longues. On anime donc
// opacity + transform sur un seul noeud, 160 ms, une fois par ouverture :
// aucune hauteur n'est animee, rien ne saute, rien ne se recalcule.
// capture:true est OBLIGATOIRE : l'evenement `toggle` ne remonte pas. L'ecoute
// n'appelle ni preventDefault ni stopPropagation — elle s'ajoute, elle ne
// remplace aucun ontoggle existant.
try{
  document.addEventListener('toggle',e=>{
    try{
      const d=e.target;
      if(!d||d.tagName!=='DETAILS'||!d.open||arcReduit()) return;
      const c=d.querySelector(':scope>*:not(summary)');
      if(!c||!c.animate) return;
      c.animate([{opacity:0,transform:'translateY(-8px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:160,easing:ARC.discharge,fill:'none'});
    }catch(err){}
  },{capture:true,passive:true});
}catch(err){}
try{
  document.addEventListener('pointerdown',_arcNoter,{passive:true,capture:true});
  document.addEventListener('pointerup',_arcPression,{passive:true,capture:true});
}catch(err){
  // Repli pour les moteurs qui refusent l'objet d'options. Le troisième
  // argument booléen vaut « capture » — on perd « passive », pas la capture.
  try{
    document.addEventListener('pointerdown',_arcNoter,true);
    document.addEventListener('pointerup',_arcPression,true);
  }catch(e2){}
}

// ── ANIMATION 11 : LE COURT-CIRCUIT ────────────────────────────────────────
// Réservé aux ERREURS. Entrée sèche PAR LE HAUT — le bandeau tombe de 24 px sur
// la courbe `snap` au lieu de monter mollement depuis le bas — puis deux
// oscillations horizontales de 4 px au plus. Deux, pas cinq : au-delà ce n'est
// plus un court-circuit, c'est un tremblement, et un tremblement se lit comme
// un défaut d'affichage.
//
// « PAR LE HAUT » VEUT DIRE DEPUIS AU-DESSUS DE SA PLACE, pas depuis le haut de
// l'écran. Déplacer #toast en tête de page serait un déménagement, pas une
// animation : il passerait sous les barres de titre et sous l'encoche, et cent
// sites d'appel en dépendent. Le geste décrit — sec, tombant — est rendu par le
// mouvement ; la position ne bouge pas.
//
// LA LISTE DE TRANSFORMS EST IDENTIQUE d'une image à l'autre, y compris quand
// une valeur vaut zéro. Deux listes de fonctions différentes forcent le moteur
// à interpoler des matrices, et l'oscillation devient molle là où on la veut
// nette.
function _arcCourtCircuit(t){
  if(!t||!t.animate||arcReduit()) return null;
  const f=(y,x)=>'translateX(-50%) translateY('+y+'px) translateX('+x+'px)';
  return _animer(t,[
    {transform:f(-ARC.translate,0),easing:ARC.snap,     offset:0},
    {transform:f(0,4),             easing:ARC.discharge,offset:0.34},
    {transform:f(0,-4),                                 offset:0.53},
    {transform:f(0,3),                                  offset:0.70},
    {transform:f(0,-2),                                 offset:0.85},
    {transform:f(0,0),                                  offset:1}
  ],{duration:ARC.strike+ARC.release,fill:'none'});
}

// ── ANIMATION 12 : TIRER POUR RAFRAÎCHIR ───────────────────────────────────
// La charge d'un condensateur : le trait se remplit à mesure que le doigt tire,
// et se décharge au relâchement.
//
// TOUTES LES ÉCOUTES SONT PASSIVES, sans une seule exception, et c'est un choix
// qui coûte quelque chose : sans preventDefault, le rebond natif de la page
// continue de se produire pendant le tirage. On l'accepte. Une écoute non
// passive sur touchmove impose au navigateur d'attendre notre code avant de
// faire défiler quoi que ce soit — sur toute la zone, à chaque geste, y compris
// les milliers qui ne sont pas un tirage. La règle 7 dit que l'animation ne
// bloque jamais l'action ; ici l'action, c'est le défilement lui-même.
//
// L'AMORTISSEMENT est ce qui rend le geste crédible : le doigt parcourt 131 px
// pour que le trait en gagne 72. Sans lui le trait se remplit avant que le
// geste soit devenu une intention, et l'athlète déclenche des rafraîchissements
// en voulant simplement remonter sa page.
const ARC_TIRAGE_SEUIL=72;
const ARC_TIRAGE_AMORTI=0.55;
function arcTirerPourRafraichir(zone,action){
  if(!zone||typeof action!=='function') return false;
  if(zone._arcTirage) return false;          // déjà armée : loadX() repasse ici
  zone._arcTirage=true;
  let y0=null, trait=null, jauge=null, charge=0, arme=false;
  const finir=()=>{
    if(trait){ try{ trait.remove(); }catch(e){} }
    trait=null; jauge=null; charge=0; arme=false;
  };
  const poser=()=>{
    const r=zone.getBoundingClientRect();
    if(!r.width) return false;
    trait=document.createElement('div');
    trait.className='arc-condensateur';
    trait.style.left=r.left+'px'; trait.style.top=r.top+'px';
    trait.style.width=r.width+'px'; trait.style.height='3px';
    jauge=document.createElement('span');
    trait.appendChild(jauge);
    _arcCalque().appendChild(trait);
    return true;
  };
  zone.addEventListener('touchstart',e=>{
    // scrollTop>0 : on est au milieu de la page, ce geste est un défilement.
    if(arcReduit()||zone.scrollTop>0){ y0=null; return; }
    y0=(e.touches&&e.touches[0])?e.touches[0].clientY:null;
    charge=0; arme=false;
  },{passive:true});
  zone.addEventListener('touchmove',e=>{
    if(y0==null||!e.touches||!e.touches[0]) return;
    const dy=e.touches[0].clientY-y0;
    // Vers le haut, ou la page a bougé : ce n'est plus un tirage.
    if(dy<=0||zone.scrollTop>0){ finir(); y0=null; return; }
    charge=Math.min(ARC_TIRAGE_SEUIL,dy*ARC_TIRAGE_AMORTI);
    if(!trait&&!poser()){ y0=null; return; }
    jauge.style.transform='scaleX('+(charge/ARC_TIRAGE_SEUIL).toFixed(3)+')';
    // LE FRANCHISSEMENT. Rien ne changeait a l'instant ou le seuil etait
    // atteint : l'athlete continuait de tirer sans savoir s'il en avait assez
    // fait, et decouvrait le resultat au relachement. Une seule fois par sens.
    const plein=charge>=ARC_TIRAGE_SEUIL;
    if(plein&&!arme){
      arme=true;
      try{ arcHaptique('legere'); }catch(e){}
      jauge.style.background='var(--arc-peak)';
    } else if(!plein&&arme){
      arme=false;
      jauge.style.background='';
    }
  },{passive:true});
  zone.addEventListener('touchend',()=>{
    if(y0==null) return;
    const plein=charge>=ARC_TIRAGE_SEUIL;
    const t=trait;
    y0=null;
    if(!plein){ finir(); return; }
    // La DÉCHARGE d'abord, l'action ensuite : l'athlète doit voir que son geste
    // a porté avant que l'écran ne se reconstruise sous ses yeux.
    arcHaptique('moyenne');
    if(t) arcTraversee(t,{duree:ARC.strike});
    finir();
    // L'action est fournie par l'appelant et ne peut jamais faire tomber le
    // geste : ce module peint, il ne décide de rien.
    try{ action(); }catch(e){}
  },{passive:true});
  zone.addEventListener('touchcancel',()=>{ y0=null; finir(); },{passive:true});
  return true;
}

// LA MINUTERIE EST CONSERVEE. setTimeout etait pose sans que son identifiant
// le soit : le second toast remplacait le texte du premier, mais la minuterie
// du premier l'effacait apres le temps qu'il lui restait — un message pouvait
// donc disparaitre au bout de 300 ms. Courant sur toastSync, qui annonce le
// local puis le cloud.
let _toastMinuteur=null;
// Ou se pose le toast en bas de l'ecran (voir toast()).
const TOAST_BAS='calc(max(var(--tabbar-eff,0px),env(safe-area-inset-bottom,0px)) + var(--rc-ban-h,0px) + 12px)';
// B2.12 — PURE. Sommes-nous sur un ecran coach, en affichage large ?
//
// LES DEUX CONDITIONS, ET PAS UNE SEULE. Le seuil de 1025 px est celui de tout
// le reste du travail PC ; la classe `ecran-coach` est la meme source unique
// que la mise en page (B1.4). Sous 1025 px, et pour l'athlete a n'importe
// quelle largeur, rien ne change — c'est la regle du dossier.
function _toastCoachLarge(){
  try{
    if(!window.matchMedia||!matchMedia('(min-width:1025px)').matches) return false;
    const a=document.querySelector('.screen.active');
    if(a&&a.classList.contains('ecran-coach')) return true;
    // L'editeur d'exercices est un ecran coach SEULEMENT quand c'est le coach
    // qui l'ouvre : meme critere que sa mise en page.
    return !!(a&&a.id==='s-coach-program'&&a.getAttribute('data-ctx')==='coach');
  }catch(e){ return false; }
}
function toast(msg,c='var(--green)',duree){
  const t=document.getElementById('toast');
  _rcToastLe=Date.now();
  // L'erreur se reconnaît à sa COULEUR, seule chose que les cent sites d'appel
  // fournissent déjà. Aucun d'eux n'a été touché : les vingt-six qui passent
  // « var(--red) » héritent du court-circuit sans le savoir.
  const erreur=/--red\b|--danger|--arc-danger/i.test(String(c));
  if(_toastMinuteur){ clearTimeout(_toastMinuteur); _toastMinuteur=null; }
  const poser=()=>{
    // Les marqueurs ICO.coche… deviennent des icones (01/10/2026).
    _texteIco(t,msg);
    // PAS DE FILET DE COULEUR SUR LE COTE (charte du 26/09/2026) : l'erreur se
    // lit a son fond et a son cadre, le reste du temps le message est neutre.
    t.style.borderLeft='';
    t.style.border='1px solid '+(erreur?'var(--danger-border)':'var(--border)');
    t.style.background=erreur?'var(--danger-bg)':'var(--surface-2)';
    // B2.12 — EN HAUT, SOUS LA BARRE DE TITRE, SUR UN GRAND ECRAN COACH.
    // C'est la que se trouvent les boutons qui declenchent l'essentiel des
    // messages — Sauvegarder, Publier — et c'est la que l'oeil revient.
    // AUCUN SITE D'APPEL N'EST TOUCHE : la centaine d'appelants ne fournit
    // qu'un message et une couleur, et n'a pas a savoir ou il s'affiche.
    if(_toastCoachLarge()){
      t.style.top='72px'; t.style.bottom='auto';
    } else {
      // ⚠ EN BAS, CE N'EST PAS « SANS BOTTOM ». Le 20px d'origine etait un
      // style INLINE : removeProperty('bottom') l'effacait pour de bon, et le
      // toast retombait a sa place statique, sous toute la page (y = 2017 sur
      // un ecran de 844 : « Accès activé ✓ » ne s'est jamais vu sur un
      // telephone). On le pose donc explicitement, AU-DESSUS de ce qui occupe
      // le bas — barre d'onglets et banniere d'installation, chacune a zero
      // quand elle est absente — et de l'encoche du bas sans barre.
      t.style.removeProperty('top');
      t.style.bottom=TOAST_BAS;
    }
    t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
    if(erreur){ _arcCourtCircuit(t); arcHaptique('moyenne'); }
    // B2.12 — PLUS LONGTEMPS SUR UN GRAND ECRAN COACH. 2 800 ms suffisent
    // quand le message apparait a deux centimetres du doigt ; ils ne
    // suffisent pas quand il faut d'abord le CHERCHER, et encore moins apres
    // une action declenchee au clavier, ou l'oeil n'a pas suivi la main.
    const _large=_toastCoachLarge();
    _toastMinuteur=setTimeout(()=>{
      t.style.opacity='0';
      t.style.transform=_large?'translateX(-50%) translateY(-40px)'
                              :'translateX(-50%) translateY(80px)';
      _toastMinuteur=null;
    },(duree>0)?duree:(_large?4500:2800));
  };
  // LE RELAIS. Un toast deja affiche sort en 90 ms avant que le suivant entre :
  // sans lui, le texte etait remplace sur place et rien ne disait qu'un nouveau
  // message venait d'arriver. toast() reste SYNCHRONE et rend toujours
  // undefined immediatement — seul l'affichage est differe.
  if(t.style.opacity==='1'&&!arcReduit()&&t.animate){
    let fait=false;
    const une=()=>{ if(fait) return; fait=true; poser(); };
    const a=t.animate([{opacity:1},{opacity:0}],{duration:90,easing:ARC.charge,fill:'none'});
    if(a){
      a.addEventListener('finish',une); a.addEventListener('cancel',une);
      // LE FILET : onglet en arriere-plan, aucune frame, aucun `finish` — et le
      // message suivant ne s'afficherait jamais.
      setTimeout(une,120);
    } else une();
  } else poser();
}

// ══ LE RETOUR D'ACTION : CHARGEMENT, ÉCHEC, CONFIRMATION ════════════════════
//
// LA RÈGLE : quiconque touche un bouton doit savoir, sans deviner, que quelque
// chose part, puis si c'est arrivé. Six cents sites d'appel annoncent déjà leur
// résultat par toast() — ils ne sont PAS touchés. Ce module rattrape les
// autres, en un seul point : l'appel réseau.
//
//   • UNE BARRE D'ACTIVITÉ (#rc-activite), fine, en haut de l'écran, dès qu'un
//     appel à nos serveurs dure plus de 250 ms.
//   • LE BOUTON TOUCHÉ tourne (classe .rc-occupe, aria-busy) tant que les
//     appels qu'il a lancés dans les 700 ms ne sont pas revenus ; il ne prend
//     plus de second toucher pendant ce temps (pas de double envoi).
//   • SI CE BOUTON A ÉCRIT (PUT, POST, PATCH, DELETE) et que RIEN n'a été
//     annoncé depuis le toucher : un message d'échec, ou de confirmation.
//     « Rien n'a été annoncé » se lit sur _rcToastLe, posé par toast() :
//     l'écran qui dit déjà « Programme enregistré » n'est pas doublé.
//
// Ce qui n'est PAS suivi : les compteurs anonymes (keepalive : rcm,
// l'attribution), et tout ce qui ne va pas vers nos serveurs.
let _rcToastLe=0;
const ACT_HOTES=/firebaseio\.com|cloudfunctions\.net|googleapis\.com|cloudinary\.com|paypal\.com/;
const ACT_FENETRE_MS=700;
const ACT_TEXTES=Object.freeze({
  echec:'L’envoi n’est pas passé. Vérifie ta connexion, puis réessaie.',
  horsLigne:'Pas de connexion : l’envoi n’est pas parti.',
  ok:'C’est enregistré.'
});
const _act={enCours:0,clic:null,minuteur:null};
// PURE. Le message de fin d'un geste : null quand il n'y a rien à dire (le
// geste n'a rien écrit, ou quelqu'un l'a déjà annoncé).
function actMessage(g,dernierToast,enLigne){
  if(!g||!g.ecritures) return null;
  if(Number(dernierToast)>=Number(g.le)) return null;
  if(g.echecs) return {texte:enLigne===false?ACT_TEXTES.horsLigne:ACT_TEXTES.echec,erreur:true};
  return {texte:ACT_TEXTES.ok,erreur:false};
}
function _actBarre(on){
  let b=document.getElementById('rc-activite');
  if(!b){
    if(!on||!document.body) return;
    b=document.createElement('div'); b.id='rc-activite'; b.setAttribute('aria-hidden','true');
    document.body.appendChild(b);
  }
  b.classList.toggle('on',!!on);
}
function _actBouton(el,on){
  if(!el) return;
  if(on){ el.classList.add('rc-occupe'); el.setAttribute('aria-busy','true'); }
  else { el.classList.remove('rc-occupe'); el.removeAttribute('aria-busy'); }
}
function _actDebut(g){
  _act.enCours++;
  if(!_act.minuteur) _act.minuteur=setTimeout(()=>{ _act.minuteur=null; if(_act.enCours>0) _actBarre(true); },250);
  if(g){
    g.enCours++;
    if(g.enCours===1&&g.el&&g.el.isConnected){
      _actBouton(g.el,true);
      // LE FILET : un appel qui ne revient jamais ne bloque pas le bouton.
      clearTimeout(g.filet); g.filet=setTimeout(()=>_actBouton(g.el,false),30000);
    }
  }
}
function _actFin(g,ecrit,ok){
  _act.enCours=Math.max(0,_act.enCours-1);
  if(!_act.enCours){ clearTimeout(_act.minuteur); _act.minuteur=null; _actBarre(false); }
  if(!g) return;
  g.enCours=Math.max(0,g.enCours-1);
  if(ecrit){ g.ecritures++; if(!ok) g.echecs++; }
  if(g.enCours) return;
  const depuis=Date.now()-g.le;
  setTimeout(()=>{ clearTimeout(g.filet); _actBouton(g.el,false); },Math.max(0,300-depuis));
  if(g.annonce) return;
  // Laisser à l'écran le temps d'annoncer lui-même son résultat.
  setTimeout(()=>{
    if(g.enCours||g.annonce) return;
    let enLigne=true; try{ enLigne=navigator.onLine!==false; }catch(e){}
    const m=actMessage(g,_rcToastLe,enLigne);
    if(!m) return;
    g.annonce=true;
    toast(m.texte,m.erreur?'var(--red)':'var(--green)');
  },900);
}
try{
  document.addEventListener('click',e=>{
    const b=e.target&&e.target.closest&&e.target.closest('button,.btn,[role="button"],input[type="submit"]');
    if(b) _act.clic={el:b,le:Date.now(),enCours:0,ecritures:0,echecs:0,annonce:false,filet:null};
  },true);
  if(window.fetch&&!window.fetch._rcAct){
    const f0=window.fetch.bind(window);
    const f=function(entree,init){
      const o=init||{};
      let url='';
      try{ url=String((entree&&entree.url)||entree||''); }catch(e){}
      if(o.keepalive||!ACT_HOTES.test(url)) return f0(entree,init);
      const meth=String(o.method||(entree&&entree.method)||'GET').toUpperCase();
      const ecrit=meth!=='GET'&&meth!=='HEAD';
      const g=(_act.clic&&Date.now()-_act.clic.le<ACT_FENETRE_MS)?_act.clic:null;
      _actDebut(g);
      const p=f0(entree,init);
      p.then(r=>_actFin(g,ecrit,!!r&&(r.ok||r.type==='opaque')),()=>_actFin(g,ecrit,false));
      return p;
    };
    f._rcAct=true;
    window.fetch=f;
  }
}catch(e){}

// ══ LA BARRE DE LECTURE ══════════════════════════════════════════════════════
//
// UNE BARRE DE PROGRESSION DU DÉFILEMENT, SEULEMENT LÀ OÙ ELLE SERT : sur une
// zone qui défile d'au moins deux écrans et demi de plus que sa hauteur (un
// guide, un bilan, une longue liste). Sur un écran court elle ne dirait rien,
// et elle n'apparaît pas. Un seul élément (#rc-lecture), posé sur le bord
// haut de la zone qui défile, et effacé au changement d'écran.
const LECTURE_SEUIL=2.5;
// PURE. La progression (0 à 1) d'une zone, ou null si elle n'est pas assez
// longue pour en mériter une.
function lectureProgression(scrollTop,scrollHeight,clientHeight){
  const h=Number(clientHeight)||0, t=Number(scrollHeight)||0;
  if(h<200||t<h*LECTURE_SEUIL) return null;
  return Math.max(0,Math.min(1,(Number(scrollTop)||0)/Math.max(1,t-h)));
}
let _lectureRaf=0, _lectureZone=null;
function lectureCacher(){
  _lectureZone=null;
  const b=document.getElementById('rc-lecture');
  if(b) b.classList.remove('on');
}
function _lectureMaj(){
  _lectureRaf=0;
  const z=_lectureZone;
  if(!z||!z.isConnected) return lectureCacher();
  const p=lectureProgression(z.scrollTop,z.scrollHeight,z.clientHeight);
  let b=document.getElementById('rc-lecture');
  if(p===null||z.scrollTop<=0){ if(b) b.classList.remove('on'); return; }
  if(!b){ b=document.createElement('div'); b.id='rc-lecture'; b.setAttribute('aria-hidden','true'); document.body.appendChild(b); }
  const r=(z===document.scrollingElement)?{top:0,left:0,width:innerWidth}:z.getBoundingClientRect();
  b.style.top=Math.max(0,r.top)+'px'; b.style.left=r.left+'px'; b.style.width=r.width+'px';
  b.style.setProperty('--lecture',String(p));
  b.classList.add('on');
}
try{
  document.addEventListener('scroll',e=>{
    const z=(e.target===document)?document.scrollingElement:e.target;
    if(!z||z.nodeType!==1) return;
    _lectureZone=z;
    if(!_lectureRaf) _lectureRaf=requestAnimationFrame(_lectureMaj);
  },{capture:true,passive:true});
}catch(e){}

// ======= AUTH =======
let selRole='';
// `implicite` : LE ROLE VIENT DU CHEMIN, PAS D'UN CLIC.
//
// Les neuf routes vers l'inscription connaissent deja le role — « ESPACE
// COACH » et « ESPACE ATHLETE » de l'accueil, un code d'acces, un lien
// d'invitation. La question etait pourtant reposee au formulaire, a
// quelqu'un qui venait d'y repondre. Signale par Kevin le 03/09/2026.
//
// LA PREMIERE REPONSE FAIT FOI, ET RIEN N'EN REPARLE. Un premier correctif
// laissait a la place une ligne « Tu crées un compte athlète — ce n'est pas
// ça ? » : c'etait encore du bruit sur une question deja repondue. Se tromper
// de bouton se corrige par la fleche de retour, qui ramene exactement la ou le
// choix a ete fait.
//
// LE SEPARATEUR PART AVEC LE BLOC : un trait horizontal seul, entre le genre
// et la promesse, annoncerait une section qui n'existe plus.
// ══ ?role=coach — LE COACH VENU DE coachs.html (02/10/2026) ══════════════
// importFromURL garde l'intention (rc_role_voulu, 30 jours : l'icône
// installée s'ouvre sans paramètre). Deux effets, et aucun sans elle :
//   • rcRoleRoute : la PREMIÈRE fois qu'on irait à l'accueil (s-welcome, qui
//     vend l'abonnement athlète) sans session, on va à l'Espace coach. Une
//     fois par chargement : sa flèche de retour ramène bien à l'accueil ;
//   • rcRolePreselection : à l'inscription, si personne n'a encore choisi,
//     « Coach » est coché (le bloc reste visible : on peut changer).
// Choisir « Athlète » efface l'intention.
const RC_ROLE_VOULU_JOURS=30;
let _rcRoleRouteFaite=false;
function rcRoleVoulu(){
  try{
    const o=JSON.parse(localStorage.getItem('rc_role_voulu')||'null');
    if(o&&o.role==='coach'&&Date.now()-Number(o.le)<RC_ROLE_VOULU_JOURS*864e5) return 'coach';
  }catch(e){}
  return '';
}
/** L'écran où aller : s-coach-entry au lieu de s-welcome, une fois. `o` (tests) : {connecte}. */
function rcRoleRoute(id,o){
  if(id!=='s-welcome'||_rcRoleRouteFaite||rcRoleVoulu()!=='coach') return id;
  const connecte=(o&&'connecte' in o)?!!o.connecte:(typeof currentUser!=='undefined'&&!!currentUser);
  if(connecte) return id;
  _rcRoleRouteFaite=true;
  return 's-coach-entry';
}
function rcRolePreselection(){
  if(selRole||rcRoleVoulu()!=='coach') return false;
  selectRole('coach');
  return true;
}
function selectRole(r,implicite){
  selRole=r;
  if(r==='athlete') try{ localStorage.removeItem('rc_role_voulu'); }catch(e){}
  try{
    const _b=document.getElementById('r-role-bloc');
    const _s=document.getElementById('r-role-sep');
    if(_b) _b.style.display=implicite?'none':'';
    if(_s) _s.style.display=implicite?'none':'';
  }catch(e){}
  document.getElementById('role-coach').classList.toggle('sel',r==='coach');
  document.getElementById('role-athlete').classList.toggle('sel',r==='athlete');
  // Deux compteurs distincts plutôt qu'une propriété « role » : la validation
  // serveur n'accepte que des entiers, elle ne peut donc pas laisser passer une
  // valeur libre — le rôle reste une étape, pas une donnée attachée à quelqu'un.
  // Promesse et dépliant d'invitation : réservés au rôle coach. Un athlète a
  // son propre chemin de code, et lui en montrer un second l'enverrait dans
  // le mauvais.
  const _pc=document.getElementById('r-promesse-coach');
  const _ri=document.getElementById('r-invite-repli');
  // Le texte vient de la constante : deux exemplaires de la même phrase
  // finiraient par diverger, et c'est celle-ci que les assertions verrouillent.
  if(_pc){ _pc.textContent=PROMESSE_COACH; _pc.style.display=(r==='coach')?'block':'none'; }
  if(_ri) _ri.style.display=(r==='coach')?'block':'none';
  // Le code d'un ami : athlètes seulement, pré-rempli depuis ?ref=.
  try{ parrainageChampInscription(r); }catch(e){}
  rcmVue(r==='coach'?'role_selected_coach':'role_selected_athlete');
}
// CONSERVEE, MAIS PLUS AUCUN LIEN NE L'APPELLE. Le formulaire ne reparle plus
// du role du tout ; cette fonction reste la porte de service qui rouvre le
// choix — depuis la console, ou depuis la suite de tests qui verifie que le
// bloc masque est bien masque et non supprime.
function rcRoleRouvrir(){
  try{
    const _b=document.getElementById('r-role-bloc');
    const _s=document.getElementById('r-role-sep');
    if(_b) _b.style.display='';
    if(_s) _s.style.display='';
  }catch(e){}
  return true;
}
// Consomme l'intention de retour posée par goRegisterPourSouscrire. Renvoie
// true quand la navigation a été prise en charge, pour que l'appelant n'envoie
// pas l'utilisateur vers l'écran de code par-dessus.
// L'intention est retirée dans tous les cas : elle ne vaut que pour l'inscription
// qui vient de se produire, jamais pour la suivante.
function _retourApresInscription(){
  let cible=null;
  try{
    cible=sessionStorage.getItem('rc_apres_inscription');
    sessionStorage.removeItem('rc_apres_inscription');
  }catch(e){}
  if(cible!=='s-subscribe') return false;
  goAvecRetour('s-subscribe');loadSubscribePage();
  return true;
}
// ══════════ UN SECOND COMPTE SUR LA MÊME BOÎTE MAIL ══════════════════════
//
// UNE ADRESSE = UN COMPTE, ET CE N'EST PAS NÉGOCIABLE DEPUIS ICI. Le dossier
// local (DB « users »), le nœud RTDB /users/<adresse> et l'identité Firebase
// Auth sont TOUS LES TROIS classés par adresse ; la dernière, en particulier,
// refuse net une seconde inscription sur la même adresse — accounts:signUp
// répond EMAIL_EXISTS, quoi qu'en dise l'application.
//
// LE SOUS-ADRESSAGE EST LA SORTIE, et c'en est une vraie. Le courrier envoyé
// à kevin+athlete@gmail.com arrive dans la boîte de kevin@gmail.com, tandis
// que RepCore, Firebase et le reste du monde y voient une adresse distincte.
// Un coach obtient ainsi son compte athlète sans ouvrir une seconde boîte, et
// le sélecteur de comptes déjà en place (comptesConnectes / basculerCompte)
// le fait passer de l'un à l'autre sans ressaisir de mot de passe.
//
// ON NE LE PROPOSE PAS À TOUT LE MONDE, et c'est le point délicat. Le « + »
// est une convention, pas une norme : Gmail, Outlook, iCloud, Proton et
// Fastmail la respectent ; orange.fr, free.fr, sfr.fr, laposte.net ne la
// respectent pas. Proposer l'alias à quelqu'un de chez Orange, c'est lui
// fabriquer un compte dont il ne recevra JAMAIS le courrier — donc dont il ne
// pourra jamais réinitialiser le mot de passe. Hors liste, on dit la vérité :
// il faut une autre adresse.
const SOUS_ADRESSAGE_OK=['gmail.com','googlemail.com','outlook.com','outlook.fr',
  'outlook.be','hotmail.com','hotmail.fr','hotmail.be','live.com','live.fr',
  'live.be','msn.com','icloud.com','me.com','mac.com','proton.me',
  'protonmail.com','pm.me','fastmail.com'];
// PURE. Rend l'adresse à proposer, ou null quand on ne peut rien promettre.
// `pris` est le dossier des comptes de cet appareil : proposer une adresse
// déjà occupée ferait retomber sur le même refus au clic suivant.
function _aliasSecondCompte(email,role,pris){
  const em=String(email||'').trim().toLowerCase();
  const at=em.lastIndexOf('@');
  if(at<1) return null;
  const domaine=em.slice(at+1);
  if(SOUS_ADRESSAGE_OK.indexOf(domaine)<0) return null;
  // UNE SEULE ÉTIQUETTE, JAMAIS DEUX : on repart de la base, sinon une adresse
  // déjà sous-adressée donnerait kevin+athlete+athlete@gmail.com.
  const base=em.slice(0,at).split('+')[0];
  if(!base) return null;
  const mot=(role==='coach')?'coach':'athlete';
  const occupe=a=>!!(pris&&Object.prototype.hasOwnProperty.call(pris,a));
  let a=base+'+'+mot+'@'+domaine;
  for(let n=2;occupe(a)&&n<=9;n++) a=base+'+'+mot+n+'@'+domaine;
  return occupe(a)?null:a;
}
// MASQUÉ À CHAQUE TENTATIVE. Sans cette remise à zéro, la proposition d'un
// refus précédent survivait à un refus d'une tout autre nature.
function _masquerSecondCompte(){
  const z=document.getElementById('r-2e-compte');
  if(z) z.style.display='none';
  const j=document.getElementById('r-2e-rejoindre');
  if(j) j.style.display='none';
}
// L'ADRESSE POUR LAQUELLE ON A DÉJÀ DIT OUI. Elle ne vaut que pour l'appel
// suivant et pour ELLE : changer d'adresse repose la question.
let _rcRejoindre=null;
function _rejoindreCompteExistant(){
  const inp=document.getElementById('r-email');
  _rcRejoindre=((inp&&inp.value)||'').trim().toLowerCase()||null;
  _masquerSecondCompte();
  // ON REJOUE L'INSCRIPTION ENTIÈRE plutôt que d'extraire la branche
  // d'adoption : elle route, applique un code en attente et mène à l'écran
  // d'arrivée. Un second chemin vers tout ça finirait par diverger du premier.
  return doRegister();
}
// Rend l'adresse proposée, ou null si le bloc n'a qu'un constat à donner.
// `rejoindre` porte le rôle du compte déjà en place quand il diffère de celui
// demandé : il fait apparaître la seconde issue.
function _proposerSecondCompte(email,rejoindre){
  const z=document.getElementById('r-2e-compte');
  const t=document.getElementById('r-2e-txt');
  const b=document.getElementById('r-2e-btn');
  const j=document.getElementById('r-2e-rejoindre');
  if(!z||!t||!b) return null;
  if(j){
    if(rejoindre){
      j.textContent='Ou me connecter à mon compte '+rejoindre;
      j.style.display='block';
    } else j.style.display='none';
  }
  const alias=_aliasSecondCompte(email,selRole,DB.get('users')||{});
  // CE QU'ON SAIT, ET RIEN DE PLUS : le rôle de l'autre compte n'est connu que
  // dans la branche locale. On nomme donc le rôle DE CELUI-CI, qui est certain.
  const roleMot=(selRole==='coach')?'coach':'athlète';
  if(!alias){
    t.textContent='Cette adresse porte déjà un compte, et une adresse n\u2019en porte qu\u2019un. '
      +'Pour un second compte, il te faut une autre adresse email.';
    b.style.display='none';
    // L'ADRESSE PART AVEC LE BOUTON. Sans ca, celle d'une proposition
    // precedente restait accrochee a `dataset` : invisible tant que le bouton
    // est cache, mais prete a remplir le champ avec l'adresse de quelqu'un
    // d'autre le jour ou une branche le rallumerait.
    delete b.dataset.alias;
  } else {
    t.innerHTML='Tu veux un <b style="color:var(--text)">second compte</b> : celui-ci en '
      +roleMot+' : sur la même boîte mail ? Utilise '
      +'<b style="color:var(--text);word-break:break-all">'+escapeHtml(alias)+'</b>. '
      +'Le courrier arrive au même endroit, et le sélecteur de comptes te fera '
      +'passer de l\u2019un à l\u2019autre sans ressaisir ton mot de passe.';
    b.textContent='Utiliser cette adresse';
    b.dataset.alias=alias;
    b.style.display='block';
  }
  z.style.display='block';
  return alias;
}
// LE CHAMP EST REMPLI, PAS LE FORMULAIRE ENVOYÉ. Créer le compte d'un seul
// clic sur une adresse que la personne n'a pas encore lue serait lui faire
// signer ce qu'elle n'a pas vu — et c'est l'adresse par laquelle elle se
// connectera ensuite.
function _appliquerSecondCompte(){
  const b=document.getElementById('r-2e-btn');
  const a=b&&b.dataset&&b.dataset.alias;
  if(!a) return false;
  const inp=document.getElementById('r-email');
  if(inp){ inp.value=a; try{ inp.focus(); }catch(e){} }
  _masquerSecondCompte();
  const e=document.getElementById('r-err');
  if(e) e.style.display='none';
  return true;
}
// La photo choisie a l'inscription, en attente de la creation du dossier.
// Une variable de module et non un champ cache : elle porte une image reduite,
// et un <input type=file> ne se remplit pas par programme de toute facon.
let _inscriptionPhotoB64=null;
// ── L'ETAT DE LA PHOTO, EXPLICITE ───────────────────────────────────────
// _inscriptionPhotoB64 se remplissait EN SILENCE, plusieurs secondes apres le
// choix du fichier. Entre les deux, rien a l'ecran ne disait qu'un traitement
// courait : qui touchait « Creer mon compte » pendant ce temps voyait sa photo
// perdue — elle etait pourtant en train d'arriver. Une variable qui se remplit
// toute seule ne se lit pas ; un etat, si. vide | encours | prete | echec.
// La promesse est RETENUE, pour que doRegister l'attende au lieu de refuser.
let _inscriptionPhotoEtat='vide';
let _inscriptionPhotoPromesse=null;
function _inscriptionPhotoBouton(actif){
  const b=document.getElementById('r-submit');
  if(!b) return;
  b.disabled=!actif;
  b.style.opacity=actif?'':'0.55';
  b.textContent=actif?'Créer mon compte':'Photo en cours…';
}
// LE REPLI, APRES UN ECHEC ET SEULEMENT APRES. Quand toutes les photos de la
// personne sont dans un format illisible — tout un iPhone en HEIC — « reessaie
// avec une autre photo » est un mur : la suivante echouera pareil. Proposer de
// renoncer AVANT d'avoir essaye serait inviter a renoncer ; apres, c'est une
// sortie. Elle cree le compte normalement.
function _inscriptionPhotoRepli(montrer){
  const z=document.getElementById('r-photo-repli');
  if(!z) return;
  z.innerHTML=montrer
    ? '<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" '
      +'onclick="_inscriptionPhotoAbandonner()">Continuer sans photo pour l\'instant</button>'
    : '';
}
function _inscriptionPhotoAbandonner(){
  _inscriptionPhotoB64=null;
  _inscriptionPhotoEtat='vide';
  _inscriptionPhotoPromesse=null;
  const i=document.getElementById('r-photo'); if(i) i.value='';
  const e=document.getElementById('r-err'); if(e) e.style.display='none';
  _inscriptionPhotoRepli(false);
  _inscriptionPhotoBouton(true);
  toast('Tu pourras l\'ajouter depuis ton profil','var(--green)');
}
// ── DEUX SORTIES DE SECOURS, POSEES SOUS LE MESSAGE D'ERREUR ────────────
// En DOM et non en HTML dans la zone : showErr ecrit du texte, y injecter du
// balisage exposerait la zone d'erreur a tout ce qui y transite.
function _boutonSous(zoneId,cle,libelle,action){
  const z=document.getElementById(zoneId);
  if(!z||!z.parentNode) return;
  const ancien=document.getElementById(cle);
  if(ancien) ancien.remove();
  const b=document.createElement('button');
  b.id=cle; b.type='button'; b.className='btn btn-outline btn-sm';
  b.style.cssText='width:100%;margin-top:8px';
  b.textContent=libelle;
  b.onclick=()=>action(b);
  z.parentNode.insertBefore(b,z.nextSibling);
}
// Faute de frappe a la connexion : on emmene a l'inscription avec l'adresse
// deja saisie, plutot que de laisser la retaper.
function _lienVersInscription(em){
  _boutonSous('l-err','l-vers-inscription','Créer mon compte avec cette adresse',()=>{
    go('s-register');
    // LE ROLE DEJA CHOISI EST GARDE, et s'il n'y en a pas, le choix se montre :
    // un bloc masque par une visite precedente laissait un formulaire qui
    // refusait de partir sans qu'on voie pourquoi (QA du 27/09/2026).
    try{ if(selRole) selectRole(selRole,true); else rcRoleRouvrir(); }catch(e){}
    const i=document.getElementById('r-email');
    if(i) i.value=em||'';
  });
}
// Inscription interrompue : l'adresse est prise, par soi-meme, et le mot de
// passe ne revient pas. On envoyait chercher l'ecran de connexion PUIS le lien
// « Mot de passe oublie ? » : deux ecrans de plus, au pire moment.
function _boutonReprise(em){
  _boutonSous('r-err','r-reprise','M\'envoyer un lien pour reprendre',async b=>{
    b.textContent='Envoi…'; b.disabled=true;
    let ok=false;
    try{ ok=await CLOUD.resetPassword(em); }catch(e){ ok=false; }
    b.disabled=false; b.textContent='M\'envoyer un lien pour reprendre';
    // MEME RESERVE QUE forgotPassword : la protection contre l'enumeration des
    // adresses fait repondre « succes » meme sur une adresse inconnue. On ne
    // promet donc pas un envoi, on dit ou regarder.
    toast(ok?'Si un compte existe, le lien part maintenant : pense aux spams'
            :'Envoi impossible : verifie ta connexion',
          ok?'var(--green)':'var(--orange)');
  });
}
function _inscriptionPhoto(input){
  const f=input&&input.files&&input.files[0];
  const rond=document.getElementById('r-photo-rond');
  if(!f){
    _inscriptionPhotoB64=null; _inscriptionPhotoEtat='vide'; _inscriptionPhotoPromesse=null;
    _inscriptionPhotoBouton(true); _inscriptionPhotoRepli(false);
    return false;
  }
  // Meme plafond que la photo modifiable plus tard : la reduction en 300x300
  // rend la taille d'origine indifferente au quota, mais lire un fichier de
  // 40 Mo sur un telephone ancien fige la page avant meme la reduction.
  if(f.size>20*1024*1024){ toast('Image trop lourde (max 20 Mo)','var(--orange)'); return false; }
  _inscriptionPhotoEtat='encours';
  _inscriptionPhotoBouton(false);
  _inscriptionPhotoRepli(false);
  if(rond){ rond.style.padding='6px'; rond.innerHTML='Lecture<br>en cours…'; }
  _inscriptionPhotoPromesse=_resizeImage(f,300,300,0.80).then(b64=>{
    if(!b64){
      // CE QU'IL FAUT FAIRE, PAS SEULEMENT CE QUI NE MARCHE PAS. « Reessaie
      // avec une autre photo » envoyait chercher une autre photo, qui venait
      // du meme appareil et echouait pareil : le probleme n'est pas la photo,
      // c'est son FORMAT. Une capture d'ecran, elle, est toujours un PNG.
      // DANS LA ZONE D'ERREUR, PAS DANS UN TOAST : toast() s'efface en 2,8 s,
      // et ce message demande d'aller faire une capture d'ecran avant de
      // revenir. Un conseil qui disparait avant d'avoir ete suivi n'en est pas
      // un. La zone, elle, reste jusqu'a la prochaine action.
      _inscriptionPhotoEtat='echec';
      _inscriptionPhotoB64=null;
      if(rond){ rond.style.padding='6px'; rond.innerHTML='Aucune<br>photo'; }
      _inscriptionPhotoBouton(true);
      _inscriptionPhotoRepli(true);
      showErr('r-err','Photo illisible par ton téléphone : c\'est souvent un fichier HEIC d\'iPhone. '
        +'Fais une capture d\'écran de la photo, puis envoie la capture. '
        +'Tu peux aussi continuer sans : elle est facultative.','r-photo');
      return;
    }
    _inscriptionPhotoB64=b64;
    _inscriptionPhotoEtat='prete';
    _inscriptionPhotoBouton(true);
    _inscriptionPhotoRepli(false);
    if(rond){
      rond.style.border='2px solid var(--red)';
      rond.style.padding='0';
      rond.innerHTML='<img src="'+b64+'" alt="" style="width:100%;height:100%;object-fit:cover">';
    }
    const e=document.getElementById('r-err'); if(e) e.style.display='none';
  });
  return true;
}
async function doRegister(){
  // QUATRE CHAMPS, ET UNE CASE. Le formulaire en demandait onze : prenom,
  // nom, date de naissance et genre sont DEPLACES au moment ou ils servent,
  // et le consentement sante a son propre ecran. Aucun n'est supprime.
  const em=v('r-email').toLowerCase(),pw=v('r-pwd'),pw2=v('r-pwd2');
  const err=document.getElementById('r-err');err.style.display='none';
  _masquerSecondCompte();
  if(!em||!pw){return showErr('r-err','L\'adresse et le mot de passe sont obligatoires.');}
  // ATTENDRE, PAS REFUSER. Le redimensionnement dure une a trois secondes ; le
  // formulaire se remplit pendant ce temps et le bouton se touche juste apres.
  // _resizeImage se resout TOUJOURS desormais, delai de garde compris : cette
  // attente ne peut pas pendre.
  if(_inscriptionPhotoEtat==='encours'&&_inscriptionPhotoPromesse){
    try{ await _inscriptionPhotoPromesse; }catch(e){}
  }
  // LA PHOTO N'EST PLUS OBLIGATOIRE — 10/09/2026.
  //
  // Elle l'a ete, et le raisonnement se tenait : un champ facultatif place en
  // fin de formulaire n'est jamais rempli, et le tableau de bord du coach
  // devient une grille d'initiales. Mais le refus supposait que TOUT LE MONDE
  // PUISSE en poser une. Beaucoup n'y arrivaient pas : un iPhone rend un
  // fichier HEIC, _resizeImage ne sait pas le decoder, et le formulaire se
  // fermait sur « Ajoute une photo » sans dire comment. L'inscription entiere
  // etait bloquee par un format d'image.
  //
  // Un compte qui n'existe pas ne montre aucune photo non plus. La photo reste
  // demandee EN PREMIER, avec sa place et son cadre — c'est la ou elle se
  // remplit — mais elle ne ferme plus la porte. Elle se pose ensuite depuis le
  // profil, et le coach voit les initiales en attendant.
  // LA FORME DE L'ADRESSE, avant le moindre appel réseau. Sans ce contrôle,
  // une adresse sans arobase partait jusqu'à Firebase, qui répondait
  // INVALID_EMAIL — traduit en « Inscription impossible. Réessaie. », alors
  // que réessayer ne pouvait rien changer.
  //
  // Le motif est celui qui valide déjà les adresses des paquets d'invitation :
  // un second finirait par diverger du premier.
  if(!_PKG_EMAIL_RE.test(em)) return showErr('r-err','Cette adresse email n\'est pas valide : vérifie le @ et le nom de domaine.','r-email');
  if(pw.length<6) return showErr('r-err','Mot de passe trop court (min 6 car.).','r-pwd');
  if(pw!==pw2) return showErr('r-err','Mots de passe différents.','r-pwd2');
  // ⚠ LE CONTROLE DES 16 ANS N'EST PAS SUPPRIME, IL A SUIVI SA DONNEE.
  //
  // Il vivait ici parce que la date de naissance y etait demandee, et son
  // commentaire disait la vraie raison de sa place : « AVANT CLOUD.signIn,
  // sinon un refus laisserait derriere lui le compte d'un mineur ». Cette
  // raison tenait a l'ordre des lignes, pas a l'ecran.
  //
  // La date est desormais demandee par s-naissance, au premier calcul qui en
  // a besoin, et le controle s'y applique avec le MEME AGE_MINIMUM et le MEME
  // message — voir validerNaissanceGenre. Ce qui change : le compte existe
  // deja quand le refus tombe. Il n'a alors AUCUNE donnee de sante — le
  // verrou de saveUser s'en est charge — et la seule chose qu'il porte est une
  // adresse et un mot de passe, que son titulaire peut faire effacer.
  if(!selRole) return showErr('r-err','Sélectionne ton rôle.');
  // LE GENRE RESTE OBLIGATOIRE — mais la ou il sert. Le raisonnement qui le
  // rendait obligatoire ici tenait : calcBF change de formule selon lui, les
  // reperes energetiques aussi, et les silhouettes de bilan viennent de
  // posesGenre. C'est exactement pour cela qu'il est demande AVEC la date de
  // naissance, au premier de ces calculs, et refuse vide a ce moment-la.
  // LE VERROU EST LEVÉ. Un coach inconnu crée son compte sans code, et démarre
  // au palier Libre — un athlète suivi, sans carte bancaire et sans durée.
  //
  // Ce que cette levée ne change PAS : rien, dans le parcours coach, ne relit
  // le code après l'inscription. Les pouvoirs d'un coach découlent de son rôle
  // et, pour quatre écrans, de son adresse. Le code était un portier, pas un
  // système de droits.
  //
  // Et il ne fermait pas grand-chose : la règle de /rc_codes/$code accorde
  // l'écriture dès que le nœud n'existe pas, donc n'importe quel titulaire de
  // compte pouvait déjà fabriquer son propre code d'invitation coach.
  //
  // Un code SAISI reste exigé au format : mieux vaut refuser tout de suite
  // qu'après la création du compte Firebase.
  if(selRole==='coach'&&_coachInviteCode()&&!_INVITE_RE.test(_coachInviteCode()))
    return showErr('r-err','Ce code d\'invitation est mal formé (format RC-XXXX-XXXX). Efface-le pour continuer sans code.');
  // UN SEUL CONSENTEMENT EST EXIGE ICI, celui de l'article 6. Celui de
  // l'article 9 se demande au premier geste qui le concerne, sur son propre
  // ecran — les deux restent strictement separes, ils ne sont simplement plus
  // poses au meme moment.
  //
  // AVANT L'APPEL RÉSEAU ci-dessous, qui peut durer plusieurs secondes : une
  // case oubliée n'a pas à se payer d'une attente serveur, alors que la
  // réponse tient dans la lecture de deux cases de la page.
  if(!document.getElementById('r-cgu')?.checked)
    return showErr('r-err','Accepte la politique de confidentialité et les mentions légales pour continuer.');
  // ── UN SEUL DEPART A LA FOIS ──────────────────────────────────────────
  //
  // À partir d’ici, la fonction enchaîne jusqu’à QUATRE appels réseau —
  // placeLibreDisponible, CLOUD.signIn, CLOUD.pullUser, _verifyCoachInvite —
  // sans rien changer à l’écran. Sur réseau lent, le bouton répondait au
  // second appui : la seconde inscription trouvait le compte que la première
  // venait de créer et affichait « Ce compte existe déjà », et côté coach
  // incrementerCompteurLibres comptait deux places pour une seule.
  //
  // DEUX VERROUS, parce qu’ils ne couvrent pas la même chose. Celui du
  // bouton dit à l’utilisateur qu’il se passe quelque chose ; celui de la
  // fonction tient même quand l’appel vient d’ailleurs — une touche Entrée,
  // un lien, un autre chemin ajouté plus tard.
  //
  // POSÉS ICI, après les validations synchrones : une case oubliée n’a pas à
  // attendre un tour de réseau pour être signalée, et ces refus-là sortent
  // au-dessus sans avoir rien verrouillé.
  if(window._registerEnCours) return;
  window._registerEnCours=true;
  const _btnReg=document.querySelector('#s-register .btn-red');
  const _libelleReg=_btnReg?_btnReg.textContent:'';
  if(_btnReg) arcAttendre(_btnReg,'Création…');
  // Le try couvre TOUS les chemins de sortie, y compris les `return
  // showErr(...)` du compte déjà existant et de l’invitation refusée : c’est
  // précisément eux qui laissaient le bouton mort dans doLogin avant son
  // propre correctif.
  try{
    // Plafond de capacité. Avant CLOUD.signIn : refuser plus bas laisserait
    // derrière soi un compte Firebase Auth sans dossier applicatif — et signIn
    // vient bien plus loin, le passage des consentements au-dessus ne change
    // rien à cette garantie.
    // Un coach porteur d'un code d'invitation n'est PAS concerné : il a été
    // invité, la place lui était réservée.
    if(selRole==='coach'&&!_coachInviteCode()&&!(await placeLibreDisponible()))
      return showErr('r-err',LIBRE_ATTENTE_TEXTE);
    const users=DB.get('users')||{};
    // ══ LE REFUS SEC SUR `users[em]` PORTAIT SUR UN CACHE, PAS SUR UN FAIT ══
    //
    // ⚠ LE MESSAGE N'EST PAS RECOPIÉ ICI, ET C'EST VOULU : une sonde vérifie
    // qu'il a disparu de cette fonction, et elle le retrouverait dans ce
    // commentaire même. C'est la cinquième fois que le dépôt apprend qu'une
    // sonde peut matcher son propre sujet.
    //
    // Il y avait ici un refus sec sur `users[em]`, rendu tel quel à l'écran,
    // et c'est de LUI que venaient les refus sur des adresses « jamais
    // utilisées ». `users` n'est pas le registre des comptes : c'est le cache
    // local de cet appareil, et il porte bien plus que le compte de celui qui
    // s'inscrit —
    //   • le dossier du coach, et TOUS ceux de ses athlètes (syncRelevantUsers
    //     les descend à chaque réveil) ;
    //   • les athlètes qu'il a créés lui-même (createAthlete les écrit ici) ;
    //   • les dossiers arrivés par un paquet d'import ;
    //   • tout compte ayant un jour vécu sur l'appareil — la déconnexion ne
    //     retire RIEN de ce cache, c'est ce qui fait marcher le multi-compte
    //     et le hors-ligne.
    // Une adresse jamais inscrite nulle part se voyait donc refuser parce
    // qu'un TÉLÉPHONE en avait entendu parler. Et le refus était un
    // cul-de-sac : même avec le bon mot de passe, on ne pouvait pas entrer.
    //
    // L'AUTORITÉ, C'EST FIREBASE, PAS LE TÉLÉPHONE. On laisse donc la suite
    // trancher : CLOUD.signIn plus bas dit sans ambiguïté si l'adresse est
    // prise (mot de passe faux → « un compte existe déjà », avec la
    // proposition de second compte), et si elle ne l'est pas, le compte se
    // crée. Un dossier déjà présent — ici ou dans la base — est ADOPTÉ
    // quelques lignes plus bas au lieu d'être écrasé : c'est la garantie que
    // cette garde était censée donner, et la branche d'adoption la donne
    // vraiment.
    const uid='u_'+Date.now();
    // ⚠ NI fname, NI lname, NI birthdate, NI age, NI gender, NI nutrition, NI
    // bilans. Le dossier neuf ne porte AUCUNE donnee de sante, et ce n'est pas
    // seulement parce qu'on ne les demande plus : les poser vides suffirait a
    // faire tomber le verrou de _sansSante au premier enregistrement, qui les
    // couperait en criant dans la console. Un dossier qui nait propre reste
    // propre.
    //
    // `bilans` et `nutrition` sont recrees par leurs propres ecrans, qui les
    // creent deja quand ils manquent — c'est ce que font openBilan et les
    // accesseurs de nutrition depuis toujours.
    const user={id:uid,email:em,
      role:selRole,
      createdAt:Date.now(),streak:0,lastSession:null,sessions:[],videos:[],coachId:null,coachName:null,
      status:'FREE',accessExpiry:null,paymentStatus:null,paypalSubscriptionId:null,
      // Trace du consentement : QUOI, QUAND, et sur QUELLE VERSION du texte.
      // Sans la version, on saurait que la personne a accepte quelque chose, sans
      // pouvoir dire quoi — c'est precisement ce que l'article 7.1 du RGPD demande
      // de pouvoir demontrer. Pousse tel quel vers RTDB : _doPushOne ne retire que
      // les champs sensibles (mots de passe, blobs), jamais celui-ci.
      // ⚠ health:false, ET CE N'EST PAS UN OUBLI. Les deux consentements sont
      // deux regimes : l'article 6 est acquis ici, par la case r-cgu ; l'article
      // 9 ne l'est pas, et rien ne le deduira de l'autre. Il sera pose par
      // accepterConsentementSante, avec sa propre date — `healthAt` — le jour ou
      // la premiere donnee de sante sera saisie.
      consent:{cgu:true,health:false,at:Date.now(),policyVersion:POLICY_VERSION}};
    // athletePhoto, et non `photo` : c'est le champ que la fiche, la grille de
    // vignettes et le carnet d'adresses lisent deja.
    if(_inscriptionPhotoB64) user.athletePhoto=_inscriptionPhotoB64;
    if(selRole==='coach'){
      user.code=genCode();user.clients=[];
      // Écrit À LA CRÉATION, pas rétro-écrit sur les dossiers existants : deux
      // clés sur un dossier neuf ne coûtent rien, et le palier devient lisible
      // tel quel au lieu d'être déduit d'une absence.
      user.coachPlan='libre';
      user.coachSubActive=false;
      user.coachPlanSince=Date.now();
    }
    // Authentifier Firebase AVANT de sauvegarder → le push 2s plus tard aura un token valide.
    // Si l'auth échoue on n'écrit RIEN localement : sinon un compte fantôme est créé
    // sur l'appareil (email deja pris chez Firebase, mauvais mot de passe, hors ligne...)
    // et il bloque ensuite la vraie connexion.
    const authOk=await CLOUD.signIn(em,pw);
    // UN COMPTE NEUF : le lien de verification part tout de suite, sans
    // retenir l'inscription (voir CLOUD.envoyerVerificationEmail).
    if(authOk&&CLOUD._compteCree){
      try{ CLOUD.envoyerVerificationEmail().then(ok=>{ if(ok) try{ localStorage.setItem(RAPPEL_VERIF_CLE,String(Date.now())); }catch(e){} }).catch(()=>{}); }catch(e){}
    }
    if(!authOk){
      // L'ADRESSE EST PRISE CÔTÉ SERVEUR — le compte peut très bien ne pas être
      // sur CET appareil : c'est le cas du coach qui s'inscrit en athlète depuis
      // un autre téléphone.
      if(CLOUD._signInErr==='wrong_password'){ _proposerSecondCompte(em); _boutonReprise(em); }
      return showErr('r-err',
        CLOUD._signInErr==='wrong_password'
          ? 'Un compte existe déjà avec cet email. Utilise « Se connecter », ou le bouton ci-dessous si le mot de passe ne te revient pas.'
          : CLOUD._signInErr==='network'
            ? 'Pas de connexion : impossible de créer le compte maintenant.'
            : CLOUD._signInErr==='invalid_email'
              ? 'Cette adresse email n\'est pas valide : vérifie le @ et le nom de domaine.'
              : CLOUD._signInErr==='weak_password'
                ? 'Mot de passe trop court : 6 caractères minimum.'
                : 'Inscription impossible. Réessaie.');
    }
    // Le compte peut exister CÔTÉ SERVEUR sans exister sur cet appareil :
    // réinstallation, nouveau téléphone, cache vidé. signIn réussit alors avec le
    // bon mot de passe, et l'ancien code écrivait par-dessus un objet vierge — que
    // le push suivant répliquait dans la RTDB, effaçant séances et bilans.
    // On adopte le profil distant au lieu de le remplacer.
    const cloudUser=await CLOUD.pullUser(em);
    // ET LE DOSSIER PUREMENT LOCAL, À DÉFAUT. C'est le cas de celui qui s'est
    // déjà inscrit sur CE téléphone et recommence : la base n'a rien à rendre
    // (un athlète FREE n'a encore rien poussé), mais l'appareil, si. C'est
    // exactement la situation que l'ancienne garde attrapait — sauf qu'elle la
    // renvoyait dans le mur au lieu d'ouvrir la session. Le mot de passe vient
    // d'être validé par Firebase deux lignes plus haut : il n'y a plus rien à
    // vérifier.
    const dossierExistant=cloudUser||users[em]||null;
    if(dossierExistant){
      // ══ LES RÔLES DIVERGENT : ON NE DÉCIDE PAS À SA PLACE ════════════════
      //
      // Quelqu'un demande un compte ATHLÈTE sur une adresse qui porte déjà un
      // compte COACH — c'est le cas du coach qui veut s'entraîner lui-même, et
      // c'est la demande d'origine. L'adoption silencieuse le connectait sur
      // son compte coach et l'y laissait, sans un mot : il avait demandé une
      // chose et en obtenait une autre.
      //
      // On pose donc la question, avec ses deux réponses : l'adresse
      // sous-adressée pour un VRAI second compte, ou rejoindre celui qui
      // existe. Les rôles identiques, eux, ne posent aucune question — c'est
      // la réinstallation, et elle doit rester muette.
      const _roleLa=dossierExistant.role==='coach'?'coach':'athlète';
      if(dossierExistant.role!==selRole&&_rcRejoindre!==em){
        showErr('r-err','Cette adresse porte déjà un compte '+_roleLa+'.','r-email');
        _proposerSecondCompte(em,_roleLa);
        return;
      }
      // CONSOMMÉE : le oui vaut pour cette fois, pas pour la suivante.
      _rcRejoindre=null;
      showErr('r-err','Ce compte existe déjà, connexion en cours…');
      toast(cloudUser
        ?'Ce compte existe déjà : tes données ont été récupérées.'
        :'Ce compte est déjà sur cet appareil : te voilà connecté.','var(--green)');
      // LA BASE DU DOSSIER ADOPTE (30/09/2026) : il vient du serveur, il en est
      // donc la version de reference. Sans elle, le premier envoi de cet
      // appareil partait sans fusion a trois voies.
      if(cloudUser){
        try{ dossierExistant._syncMaj=Number(cloudUser.updatedAt)||0; CLOUD._poserBase(em,cloudUser); }catch(e){}
      }
      users[em]=dossierExistant;DB.set('users',users);
      currentUser=dossierExistant;DB.set('session',dossierExistant);
      // ── LE COMPTE ENTRE AU REGISTRE DE L'APPAREIL DÈS QU'IL EXISTE ──────
      //
      // routeUser() le faisait, et le fait toujours — mais un athlète au statut
      // FREE part sur s-client-code et NE PASSE PAS par routeUser. Le compte
      // qu'on vient de créer restait donc hors du sélecteur : invisible dans
      // « Changer de compte », impossible à retrouver sans ressaisir l'adresse
      // et le mot de passe. Le compte ACTIF n'était même pas dans sa propre
      // liste.
      //
      // Ça se voit surtout depuis le second compte sur une même boîte mail : on
      // vient de créer kevin+athlete@gmail.com, et rien ne permet d'y revenir
      // sauf à se souvenir de l'alias. La proposition de l'écran d'inscription
      // promet le sélecteur ; il doit tenir.
      //
      // Idempotente — elle remplace l'entrée de même adresse — donc la rejouer
      // depuis routeUser ne fabrique aucun doublon.
      try{ comptesEnregistrer(currentUser); }catch(e){}
      // routeUser() déconnecterait un athlète encore en statut FREE ; on le mène
      // à l'écran de code, comme le fait doLogin dans la même situation.
      if(doitVoirLePaywall(dossierExistant)){
        if(_retourApresInscription()) return;
        // Même règle que pour une inscription neuve : un code déjà vérifié
        // s'applique tout seul. Ce chemin est celui du réinstallateur, qui n'a
        // aucune raison de ressaisir un code qu'il vient de valider.
        if(await _appliquerCodeApresInscription()) return;
        allerApresEssai(dossierExistant);
        const enAttente=localStorage.getItem('pendingCode')||window._invitationCode;
        if(enAttente){
          const inp=document.getElementById('cc-code');
          if(inp) inp.value=enAttente;
        // Conserve TANT QUE la liaison n'a pas abouti. L'effacer ici perdait
        // le code des qu'on affichait l'ecran : fermer l'onglet avant de valider
        // obligeait a redemander le code au coach. Il est efface a la liaison
        // reussie, dans linkToCoach et dans la branche succes de doLinkCoach.
        }
        return;
      }
      return routeUser();
    }

    // Consommation de l'invitation : ICI et pas plus haut, pour ne pas brûler un
    // code au profit de quelqu'un qui ne fait que récupérer un compte existant
    // (branche dossierExistant ci-dessus, qui sort avant d'arriver là).
    // Sans code saisi, il n'y a rien à consommer et rien à refuser : le compte
    // se crée au palier Libre. Avec un code, le comportement est EXACTEMENT
    // celui d'avant ce lot — verification serveur, PATCH redeemed, refus parlant.
    if(selRole==='coach'&&_coachInviteCode()){
      try{ await _verifyCoachInvite(_coachInviteCode(),em); }
      catch(e){ return showErr('r-err',e.message||'Invitation refusée.'); }
    } else if(selRole==='coach'){
      // SANS INVITATION : une place Libre, prise et comptee par le serveur.
      try{ await _devenirCoach(''); }
      catch(e){ return showErr('r-err',e.message||'Création du compte coach refusée.'); }
    }

    users[em]=user;DB.set('users',users);
    currentUser=user;DB.set('session',user);
    // ── LE COMPTE ENTRE AU REGISTRE DE L'APPAREIL DÈS QU'IL EXISTE ──────
    //
    // routeUser() le faisait, et le fait toujours — mais un athlète au statut
    // FREE part sur s-client-code et NE PASSE PAS par routeUser. Le compte
    // qu'on vient de créer restait donc hors du sélecteur : invisible dans
    // « Changer de compte », impossible à retrouver sans ressaisir l'adresse
    // et le mot de passe. Le compte ACTIF n'était même pas dans sa propre
    // liste.
    //
    // Ça se voit surtout depuis le second compte sur une même boîte mail : on
    // vient de créer kevin+athlete@gmail.com, et rien ne permet d'y revenir
    // sauf à se souvenir de l'alias. La proposition de l'écran d'inscription
    // promet le sélecteur ; il doit tenir.
    //
    // Idempotente — elle remplace l'entrée de même adresse — donc la rejouer
    // depuis routeUser ne fabrique aucun doublon.
    try{ comptesEnregistrer(currentUser); }catch(e){}
    // L'index de ses médias, dès la naissance du compte (voir poserProprioMedias).
    try{ CLOUD.poserProprioMedias(currentUser).catch(()=>{}); }catch(e){}
    // Ici et pas plus haut : le compte existe vraiment à cette ligne. Les deux
    // sorties précédentes (compte déjà présent côté cloud, invitation coach
    // refusée) ne sont pas des inscriptions abouties et ne doivent pas compter.
    rcm('register_completed');
    // L'ORIGINE DU COMPTE (users/<clé>/origine) et l'inscription par src.
    try{ if(attribOrigineInscription(currentUser)) saveUser(); }catch(e){}
    if(selRole==='coach'){
      // Compté seulement maintenant : les deux sorties précédentes (compte déjà
      // présent, invitation refusée) ne sont pas des inscriptions abouties.
      // Un coach invité ne consomme pas une place Libre.
      // LE COMPTEUR DES PLACES LIBRES est tenu par le Worker (devenirCoach).
      _clearCoachInvite();
      try{ rafraichirCoachRegistre(currentUser,true).catch(()=>{}); }catch(e){}
      document.getElementById('coach-code-val').textContent=user.code;
      go('s-coach-code');
    } else if(!_retourApresInscription()){
      // Le code saisi sur l'écran d'entrée a DÉJÀ été vérifié : le redemander
      // ici était la double saisie. On l'applique directement, et l'athlète part
      // sur son bilan de départ (code créateur) ou sur l'abonnement (code
      // affilié) sans jamais voir s-client-code.
      // LE PARRAINAGE, AVANT le code coach : un filleul peut arriver avec les
      // deux. La demande s'enregistre ; le mois en plus ne sert qu'à l'essai.
      // L'AMBASSADEUR D'ABORD (un seul avantage : ambassadeur > parrain).
      let _bonusParrain=0, _amb=null;
      try{ _amb=await ambassadeurApresInscription(currentUser,(document.getElementById('r-parrain')||{}).value); _bonusParrain=_amb.jours; }catch(e){ _bonusParrain=0; }
      // Un code ambassadeur appliqué, même sans jour en plus (offre de
      // lancement), ferme le parrainage : un seul avantage.
      if(!(_amb&&_amb.type)){ try{ _bonusParrain=await parrainageApresInscription(currentUser); }catch(e){ _bonusParrain=0; } }
      if(await _appliquerCodeApresInscription()) return;
      // ⚠ PAS DE CODE : C'EST ICI QUE L'ESSAI S'OUVRE, et nulle part ailleurs.
      // Cette branche est exactement « un athlete sans code coach » — celui
      // qui, jusqu'a ce lot, tombait sur 9,95 EUR/mois avant d'avoir vu une
      // repetition. Un athlete qui ARRIVE avec un code n'en a pas besoin :
      // son acces est ouvert par son coach, et lui en ouvrir un en plus
      // laisserait un essai dormant a consommer le jour ou le code expire.
      if(essaiOuvrir(currentUser,_bonusParrain)){
        saveUser();
        // L'accueil, pas l'ecran de code : l'essai est ouvert, il y a donc
        // quelque chose a faire. La promesse est rappelee a l'arrivee.
        routeUser();
        toast(PROMESSE_ATHLETE,'var(--green)');
        return;
      }
      // Essai deja ouvert et epuise, ou dossier de coach : l'écran de saisie
      // reste le filet — c'est désormais son seul rôle.
      go('s-client-code');
      // Pre-fill pending code if athlete came via s-athlete-entry
      const pending=localStorage.getItem('pendingCode');
      if(pending){
        const inp=document.getElementById('cc-code');
        if(inp){inp.value=pending;}
        // Conserve TANT QUE la liaison n'a pas abouti. L'effacer ici perdait
        // le code des qu'on affichait l'ecran : fermer l'onglet avant de valider
        // obligeait a redemander le code au coach. Il est efface a la liaison
        // reussie, dans linkToCoach et dans la branche succes de doLinkCoach.
      }
    }
  } finally {
    window._registerEnCours=false;
    if(_btnReg) arcRendre(_btnReg,_libelleReg);
  }
}
async function doLogin(){
  const em=v('l-email').toLowerCase(),pw=v('l-pwd');
  const users=DB.get('users')||{};
  let u=users[em];
  // UN SEUL VERROU POUR LES DEUX BRAS.
  //
  // Le bras « compte inconnu » verrouillait le bouton puis le rendait AVANT
  // syncUser, et restaurait un libellé ÉCRIT EN DUR — « SE CONNECTER » — qui
  // ne demandait qu’à diverger du bouton. Le bras « compte connu », lui,
  // appelait CLOUD.signIn sans rien verrouiller du tout.
  //
  // Posé ici, le verrou couvre toute la connexion, de la première requête au
  // dernier écran, et le libellé est mémorisé.
  const _btnLog=document.querySelector('#s-login .btn-red');
  // Même garde qu’au-dessus : un second appel pendant l’attente mémoriserait
  // « Connexion… » comme libellé d’origine.
  if(_btnLog&&_btnLog.disabled) return;
  const _libLog=_btnLog?_btnLog.textContent:'';
  if(_btnLog) arcAttendre(_btnLog,'Connexion…');
  try{

    if(!u){
      // Compte inconnu localement → essayer Firebase Auth puis sync RTDB
      // Le bouton est déjà verrouillé par la fonction : plus besoin de le
      // faire ici, ni de le rendre avant syncUser.
      const ok=await CLOUD.signIn(em,pw);
      if(!ok){
        if(CLOUD._signInErr==='network')
          return showErr('l-err','Erreur réseau : vérifie ta connexion et réessaie.');
        if(CLOUD._signInErr==='wrong_password')
          return showErr('l-err','Mot de passe incorrect. Utilise "Mot de passe oublié ?" pour le réinitialiser par email.','l-pwd');
        if(CLOUD._signInErr==='invalid_email')
          return showErr('l-err','Cette adresse email n\'est pas valide : vérifie le @ et le nom de domaine.','l-email');
        if(CLOUD._signInErr==='weak_password')
          return showErr('l-err','Mot de passe trop court : 6 caractères minimum.','l-pwd');
        return showErr('l-err','Impossible de se connecter. Essaie "Mot de passe oublié ?" ou vérifie ta connexion.');
      }
      // ══ UN COMPTE CREE A L'INSTANT N'EST PAS UN COMPTE RETROUVE ══════
      // Personne ne se connecte a une adresse jamais utilisee : c'est une
      // faute de frappe. Le compte vide, lui, resterait pour toujours et
      // repondrait EMAIL_EXISTS a la vraie inscription. On le defait.
      // Et surtout PAS rescueLogin : il ne vaut que pour un compte qui existe
      // cote Auth avec un dossier RTDB vide — ce n'est pas ce cas-ci.
      if(CLOUD._compteCree){
        try{ await CLOUD.supprimerCompteCourant(); }catch(e){}
        try{ CLOUD.signOut(); }catch(e){}
        showErr('l-err','Aucun compte à cette adresse. Vérifie l\'orthographe, ou crée ton compte.','l-email');
        _lienVersInscription(em);
        return;
      }
      toast('Récupération du compte…');
      await CLOUD.syncUser(em);
      let synced=DB.get('users')||{};
      u=synced[em];
      if(!u){synced=DB.get('users')||{};u=synced[em];}
      if(!u) return rescueLogin(em,pw);
      synced[em]=u;DB.set('users',synced);
      currentUser=u;DB.set('session',currentUser);
      if(doitVoirLePaywall(currentUser)){allerApresEssai(currentUser);return;}
      return routeUser();
    }

    const ok=await CLOUD.signIn(em,pw);
    if(!ok) return showErr('l-err',CLOUD._signInErr==='network'
      ?'Erreur réseau : vérifie ta connexion et réessaie.'
      :CLOUD._signInErr==='invalid_email'
        ?'Cette adresse email n\'est pas valide : vérifie le @ et le nom de domaine.'
        :'Email ou mot de passe incorrect.');
    currentUser=users[em];DB.set('session',currentUser);
    if(CLOUD.canWrite()) saveUser();
    if(doitVoirLePaywall(currentUser)){
      allerApresEssai(currentUser);
      return;
    }
    routeUser();
  } finally {
    if(_btnLog) arcRendre(_btnLog,_libLog);
  }
}
function rescueLogin(em,pw){
  // Firebase Auth OK mais RTDB vide — créer un profil minimal avec sélection du rôle
  const existing=document.getElementById('rescue-panel');
  if(existing) existing.remove();
  const panel=document.createElement('div');
  panel.id='rescue-panel';
  panel.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:center;justify-content:center;padding:20px';
  panel.innerHTML=`
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-4);padding:28px 24px;max-width:340px;width:100%;text-align:center">
      <div style="font-size:var(--fs-2xl);margin-bottom:12px">${icon('check-circle',32)}</div>
      <div style="font-size:var(--fs-md);font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Mot de passe reconnu</div>
      <p style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6;margin-bottom:20px">Le site a changé d'adresse et tes données locales n'ont pas encore été retrouvées dans le cloud. Indique ton rôle pour continuer provisoirement : si tu te reconnectes depuis ton appareil ou navigateur habituel, ton profil complet sera restauré.</p>
      <div style="display:flex;gap:10px;margin-bottom:16px">
        <button onclick="doRescue('${em}','${encodeURIComponent(pw)}','coach')"
          style="flex:1;background:#1a0000;border:1.5px solid var(--red);color:var(--text);padding:14px 8px;border-radius:var(--r-3);cursor:pointer;font-family:Montserrat,sans-serif;font-weight:800;font-size:var(--fs-sm);letter-spacing:1px">
          Coach
        </button>
        <button onclick="doRescue('${em}','${encodeURIComponent(pw)}','athlete')"
          style="flex:1;background:#0a1a0a;border:1.5px solid var(--green);color:var(--text);padding:14px 8px;border-radius:var(--r-3);cursor:pointer;font-family:Montserrat,sans-serif;font-weight:800;font-size:var(--fs-sm);letter-spacing:1px">
          Athlète
        </button>
      </div>
      <button onclick="document.getElementById('rescue-panel').remove()"
        style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-xs);cursor:pointer;font-family:Montserrat,sans-serif">Annuler</button>
    </div>`;
  document.body.appendChild(panel);
}
function doRescue(em,pwEnc,role){
  const pw=decodeURIComponent(pwEnc);
  const users=DB.get('users')||{};
  const uid='u_'+Date.now();
  const fname=em.split('@')[0];
  const user={id:uid,fname,lname:'',email:em,role,
    createdAt:Date.now(),streak:0,lastSession:null,sessions:[],bilans:[],nutrition:{},videos:[],
    coachId:null,coachName:null,
    status:role==='coach'?'COACHING_SUIVI':'FREE',
    accessExpiry:null,paymentStatus:null,paypalSubscriptionId:null};
  if(role==='coach'){user.code=genCode();user.clients=[];}
  users[em]=user;DB.set('users',users);
  currentUser=user;DB.set('session',user);
  document.getElementById('rescue-panel')?.remove();
  CLOUD.signIn(em,pw).then(()=>{if(CLOUD.canWrite()){ saveUser(); CLOUD.poserProprioMedias(user).catch(()=>{}); }}).catch(()=>{});
  if(role==='coach'){document.getElementById('coach-code-val').textContent=user.code;go('s-coach-code');}
  else{go('s-client-code');}
}
async function forgotPassword(){
  const em=(document.getElementById('l-email')?.value||'').trim().toLowerCase();
  if(!em) return toast('Saisis ton email ci-dessus d\'abord','var(--orange)');
  const btn=document.querySelector('#s-login [onclick="forgotPassword()"]');
  if(btn){btn.textContent='Envoi…';btn.style.pointerEvents='none';}
  const ok=await CLOUD.resetPassword(em);
  if(btn){btn.textContent='Mot de passe oublié ?';btn.style.pointerEvents='';}
  if(ok){
    // ON NE PROMET PLUS UN ENVOI QU'ON NE PEUT PLUS CONSTATER. La protection
    // contre l'énumération des adresses fait répondre « succès » à sendOobCode
    // même pour une adresse inconnue (mesuré le 02/09/2026) : dire « email
    // envoyé » sans réserve, c'est envoyer quelqu'un guetter un courrier qui
    // ne partira jamais, et fouiller ses spams pour rien.
    showErr('l-err','Si un compte existe à '+em+', l\'email vient de partir. Regarde aussi dans les spams. Rien reçu d\'ici quelques minutes ? C\'est que cette adresse n\'a pas de compte : passe par « Créer un compte ».');
    document.getElementById('l-err').style.color='#86efac';
    return;
  }
  const err=CLOUD._resetErr||'';
  // GARDÉ, MAIS DEVENU RARE : sans la protection contre l'énumération, Firebase
  // nomme encore l'adresse inconnue.
  if(err.includes('EMAIL_NOT_FOUND')||err.includes('USER_NOT_FOUND')){
    showErr('l-err','Cet email n\'est pas enregistré dans notre système. Essaie de te connecter directement avec ton mot de passe : un compte sera créé automatiquement.');
  } else if(err==='network'){
    showErr('l-err','Erreur réseau : vérifie ta connexion et réessaie.');
  } else {
    showErr('l-err','Impossible d\'envoyer l\'email. Vérifie l\'adresse saisie.');
  }
}
function showNewPwdRecovery(){
  const el=document.getElementById('new-pwd-recovery');
  if(el) el.style.display=el.style.display==='none'?'block':'none';
}
// NE CHANGE AUCUN MOT DE PASSE, malgré son nom hérité. accounts:signUp CRÉE un
// compte d'authentification quand l'email n'y est pas encore — le cas d'un
// dossier présent dans la seule base RTDB, ou créé avant que Firebase Auth ne
// soit configuré. Sur un compte déjà connu, Firebase répond EMAIL_EXISTS et la
// branche d'erreur renvoie vers « Mot de passe oublié ? », qui est le seul
// chemin réel pour changer un mot de passe.
//
// Les libellés ont été corrigés en conséquence : ils promettaient un choix de
// mot de passe que cette API ne peut pas rendre sur un compte existant.
async function doNewPwdRecovery(){
  const em=(document.getElementById('rec-email')?.value||'').trim().toLowerCase();
  const pw=document.getElementById('rec-pwd')?.value||'';
  const errEl=document.getElementById('rec-err');
  const show=msg=>{if(errEl){errEl.textContent=msg;errEl.style.display='block';}};
  if(!em||!pw) return show('Remplis les deux champs.');
  if(pw.length<6) return show('Le mot de passe doit faire au moins 6 caractères.');
  const btn=document.querySelector('#new-pwd-recovery .btn-red');
  if(btn) arcAttendre(btn,'Récupération…');
  // Tenter signUp — crée un compte Firebase Auth si l'email n'y est pas encore
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+CLOUD._fbKey,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:em,password:pw,returnSecureToken:true})
  }).then(r=>r.json()).catch(()=>({}));
  if(btn) arcRendre(btn,'RESTAURER MON COMPTE ICI');
  if(r.idToken){
    // Nouveau compte Firebase créé → essayer de récupérer les données RTDB
    CLOUD._idToken=r.idToken;CLOUD._refreshToken=r.refreshToken;
    CLOUD._tokenExpiry=Date.now()+(parseInt(r.expiresIn)||3600)*1000;
    CLOUD._saveAuth();
    toast('Compte créé : récupération des données…');
    await CLOUD.syncUser(em);
    const users=DB.get('users')||{};
    let u=users[em];
    if(!u){u=(DB.get('users')||{})[em];}
    if(u){
      users[em]=u;DB.set('users',users);
      currentUser=u;DB.set('session',currentUser);
      if(doitVoirLePaywall(currentUser)){allerApresEssai(currentUser);return;}
      return routeUser();
    }
    return rescueLogin(em,pw);
  }
  const code=r.error?.message||'';
  if(code.includes('EMAIL_EXISTS')){
    // Email déjà dans Firebase Auth → le compte existe avec un autre mot de passe
    // Essayer de tirer les données RTDB en lecture publique (sans token)
    const key=em.replace(/\./g,',');
    const rtdbData=await fetch(CLOUD._fbUrl.replace('users.json','users/'+key+'.json')+'?t='+Date.now())
      .then(r=>r.ok?r.json():null).catch(()=>null);
    if(rtdbData){
      show('Compte trouvé ('+( rtdbData.fname||em )+') : entre le BON mot de passe ci-dessus ou utilise "Mot de passe oublié ?" (vérifie les spams venant de noreply@repcore-sync.firebaseapp.com).');
    } else {
      show('Ce compte existe déjà dans notre système. Utilise ton ancien mot de passe ou "Mot de passe oublié ?" et vérifie les spams (expéditeur : noreply@repcore-sync.firebaseapp.com).');
    }
  } else if(code.includes('WEAK_PASSWORD')){
    show('Mot de passe trop faible : utilise au moins 6 caractères.');
  } else if(!code){
    show('Erreur réseau : vérifie ta connexion.');
  } else {
    show('Erreur : '+code);
  }
}
// LA COULEUR EST REPOSEE A CHAQUE AFFICHAGE. forgotPassword peint #l-err en
// vert pour annoncer « email envoyé » et ne le remet jamais : l'erreur
// suivante — mot de passe incorrect, panne réseau — sortait dans le vert du
// succès.
//
// On MÉMORISE la couleur d'origine au premier passage plutôt que de vider la
// propriété. `l-err` et `r-err` tiennent leur rouge du style EN LIGNE, et
// element.style EST cet attribut : `style.color=''` ne remet pas par défaut,
// elle SUPPRIME la déclaration — les deux auraient perdu leur rouge dès la
// première erreur. Quant à `cc-err`, sa classe `.err` n'existe nulle part dans
// la feuille de style.
function showErr(id,msg,champId){
  const e=document.getElementById(id);
  if(!e) return;
  if(e.dataset.coulOrigine===undefined) e.dataset.coulOrigine=e.style.color||'';
  e.style.color=e.dataset.coulOrigine;
  e.textContent=msg;
  e.style.display='block';
  // LE BANDEAU ENTRE au lieu d'apparaitre d'un coup — souvent hors du champ de
  // vision quand le clavier est ouvert. Le message, lui, s'affiche toujours :
  // c'est de l'information, pas du mouvement.
  if(!arcReduit()&&e.animate)
    e.animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],
      {duration:ARC.strike,easing:ARC.discharge,fill:'none'});
  // LE CHAMP FAUTIF EST DESIGNE. arcRefus s'applique au CHAMP, jamais a son
  // conteneur. L'haptique survit a prefers-reduced-motion.
  const c=champId&&document.getElementById(champId);
  if(c){ arcRefus(c); try{ arcHaptique('moyenne'); }catch(err){} }
}
// La carte « CRÉER MON COMPTE » demande l'invitation AVANT d'ouvrir le
// formulaire. Le contrôle de forme est fait ici pour attraper les fautes de
// frappe tout de suite ; la validité réelle est vérifiée et le code consommé
// dans doRegister, seul moment où l'on dispose d'un jeton Firebase.
// Ouvre l'inscription coach DIRECTEMENT. La modale de code n'a pas disparu :
// elle est devenue ouvrirInviteCoach(), atteignable depuis le dépliant de
// l'écran d'inscription. On ouvre une porte, on n'en condamne pas une.
function goRegisterCoach(){
  go('s-register');
  setTimeout(()=>selectRole('coach',true),50);
}
function ouvrirInviteCoach(){
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;animation:fadeIn var(--t-3) var(--c-out)">
    <h2 style="margin-bottom:6px">Code d'invitation coach</h2>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:12px;line-height:1.6">Tu n'en as pas besoin pour créer ton compte. Si le créateur de RepCore t'a remis un code, saisis-le ici : il est à usage unique.</p>
    <label for="ci-code" style="margin-top:0">Ton code</label>
    <input id="ci-code" placeholder="RC-XXXX-XXXX" autocapitalize="characters" autocomplete="off" spellcheck="false" style="font-family:monospace;letter-spacing:1px" onkeydown="if(event.key==='Enter'){event.preventDefault();_validerInviteCoach()}">
    <div id="ci-err" style="color:var(--red-light);font-size:var(--fs-sm);margin-top:8px;display:none"></div>
    <button class="btn btn-red" style="margin-top:14px" onclick="_validerInviteCoach()">Continuer</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>document.getElementById('ci-code')?.focus(),80);
}
function _validerInviteCoach(){
  const champ=document.getElementById('ci-code');
  const err=document.getElementById('ci-err');
  const v=(champ?.value||'').trim().toUpperCase();
  if(!_INVITE_RE.test(v)){
    if(err){err.textContent='Format attendu : RC-XXXX-XXXX (lettres et chiffres).';err.style.display='block';}
    champ?.focus();
    return;
  }
  try{sessionStorage.setItem('rc_coach_invite',v);}catch(e){}
  closeModal();
  // On y est déjà quand la modale vient du dépliant ; go() est idempotent et
  // couvre le cas d'un appel depuis ailleurs.
  go('s-register');
  setTimeout(()=>{
    selectRole('coach',true);
    const l=document.getElementById('r-invite-line');
    if(l){l.textContent='Invitation : '+v;l.style.display='block';}
  },50);
}
function goRegisterAthlete(){
  go('s-register');
  setTimeout(()=>selectRole('athlete',true),50);
}
/**
 * « J'ai un code coach » (26/09/2026). s-client-code RATTACHE un compte
 * connecte a un coach : sans session, doLinkCoach lisait currentUser.fname et
 * echouait. Sans compte, la bonne porte est l'Espace athlete, carte du code
 * ouverte — doAthleteCode y garde le code et enchaine sur l'inscription.
 */
function ouvrirCodeCoach(){
  if(typeof currentUser!=='undefined'&&currentUser){ go('s-client-code'); return 's-client-code'; }
  go('s-athlete-entry');
  setTimeout(()=>{ try{
    const z=document.getElementById('ae-code-zone');
    if(z&&z.style.display==='none') aeToggleCode();
  }catch(e){} },60);
  return 's-athlete-entry';
}
function aeToggleCode(){
  const zone=document.getElementById('ae-code-zone');
  const arrow=document.getElementById('ae-arrow');
  const card=document.getElementById('ae-card-new');
  const open=zone.style.display==='none';
  zone.style.display=open?'block':'none';
  arrow.style.transform=open?'rotate(90deg)':'';
  card.style.borderColor=open?'var(--red)':'var(--border)';
  if(open) setTimeout(()=>document.getElementById('ae-code')?.focus(),100);
}
function v(id){return document.getElementById(id)?.value?.trim()||'';}

// ── Âge minimum à l'inscription ─────────────────────────────────────────────
// 16 ans révolus. L'art. 8 du RGPD fixe 16 ans par défaut et laisse chaque État
// descendre jusqu'à 13 ; la France a retenu 15 ans (art. 45 de la loi
// Informatique et Libertés). RepCore se place volontairement au-dessus du seuil
// français, parce qu'il traite des données de santé au sens de l'art. 9.
const AGE_MINIMUM=16;
// Âge RÉVOLU, par comparaison des quantièmes. Une division du nombre de
// millisecondes par 365,25 jours se trompe autour de l'anniversaire et sur les
// années bissextiles — pour un seuil légal, l'à-peu-près n'est pas tenable.
function _ageRevolu(iso){
  if(!iso) return null;
  const n=new Date(iso+'T00:00:00');
  if(isNaN(n.getTime())) return null;
  const a=new Date();
  let age=a.getFullYear()-n.getFullYear();
  const m=a.getMonth()-n.getMonth();
  if(m<0||(m===0&&a.getDate()<n.getDate())) age--;
  return age;
}
// Borne haute du sélecteur natif : la date la plus récente encore acceptable.
// LES DEUX CHAMPS DE DATE partagent ces bornes : celui de l'inscription et
// celui du profil. Deux jeux finiraient par diverger, et celui du profil
// serait le dernier mis à jour.
function _initBirthdateMax(){
  const d=new Date();
  d.setFullYear(d.getFullYear()-AGE_MINIMUM);
  const max=localISODate(d);
  // 'r-birthdate' a disparu avec le champ de l'inscription ; 'nai-birthdate'
  // prend sa place — c'est le meme champ, sur l'ecran qui le demande
  // desormais. Le plafond natif reste un confort : validerNaissanceGenre
  // reverifie, car l'attribut est trivial a contourner.
  for(const id of ['nai-birthdate','atp-birthdate']){
    const el=document.getElementById(id);
    if(!el) continue;
    el.max=max;
    el.min='1900-01-01';
  }
}
// Normalise toutes les conventions historiques ('femme','F','f') → booléen
function isFemale(g){const s=String(g||'');return s==='F'||s==='f'||s.toLowerCase()==='femme';}
function genCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'GCP-'+Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join('');
}
