// ══ LE CARROUSEL POUR LE FIL : les cinq slides en 4:5, en une fois ═════
// Instagram publie un carrousel de dix images au plus, en 4:5 pour occuper
// l'écran. Les cinq slides sont redessinées en post (pas recadrées), puis
// partagées D'UN SEUL GESTE quand le téléphone sait partager plusieurs
// fichiers ; sinon, elles s'affichent l'une sous l'autre, chacune avec son
// bouton, et se gardent une par une. SYNCHRONE jusqu'au partage (iOS).
// PURE. Les noms, dans l'ordre du carrousel.
function wrappedNomsCarrousel(){
  return [0,1,2,3,4].map(i=>visuelNomFichier('repcore-wrapped-'+(i+1),'rouge','post'));
}
function partagerCarrouselWrapped(btn){
  if(!_wr||_storyEnCours) return false;
  let sig=''; try{ sig=nomSurVisuels(currentUser); }catch(e){ sig=''; }
  const noms=wrappedNomsCarrousel();
  _storyEnCours=true;
  let ok=false, urls=[];
  try{
    urls=noms.map((n,i)=>{ const cv=_dessinerWrapped(_wr.w,_wr.per,i,sig,'post');
      const u=cv.toDataURL('image/jpeg',0.9); cv.width=0; cv.height=0; return u; });
    let fichiers=null;
    try{ fichiers=urls.map((u,i)=>new File([_b64versBlob(u)],noms[i],{type:'image/jpeg'})); }catch(e){ fichiers=null; }
    // UN CARROUSEL EST UN POST : la légende est copiée, et part aussi dans `text`.
    const legende=_legendePour('wrapped');
    _storyCopierLegende(legende);
    if(fichiers&&navigator.canShare&&navigator.share&&navigator.canShare({files:fichiers})){
      let charge={files:fichiers};
      try{ if(navigator.canShare({files:fichiers,text:legende})) charge={files:fichiers,text:legende}; }catch(e){}
      navigator.share(charge).then(()=>{ try{ attribCompter('partage','wrapped'); }catch(e){} }).catch(()=>{});
      ok=true;
    } else {
      _wrCarrouselUnParUn(urls,noms);
      ok=true;
    }
    try{ attribCompter('telechargement','wrapped'); }catch(e){}
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Carrousel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}
// Le repli : les cinq images, chacune avec son lien « Enregistrer ». Chaque
// toucher est un geste : aucun navigateur ne bloque un téléchargement par
// geste, alors qu'il en bloque cinq d'affilée. Sur iPhone, l'appui long.
function _wrCarrouselUnParUn(urls,noms){
  document.getElementById('story-apercu')?.remove();
  const d=document.createElement('div');
  d.id='story-apercu';
  d.style.cssText='position:fixed;inset:0;z-index:var(--z-modal);background:var(--scrim);overflow-y:auto;'
    +'display:flex;flex-direction:column;align-items:center;gap:14px;padding:20px';
  d.innerHTML='<div style="font-size:var(--fs-sm);color:var(--text-strong);text-align:center;line-height:1.6;max-width:320px">'
    +'Garde les cinq images dans l’ordre, puis publie-les en <b>carrousel</b>. '
    +'Sur iPhone : appui <b>long</b> sur chaque image, puis <b>Ajouter aux photos</b>.</div>'
    +urls.map((u,i)=>'<figure style="margin:0;display:flex;flex-direction:column;align-items:center;gap:8px">'
      +'<img src="'+u+'" alt="Slide '+(i+1)+' sur 5" style="width:min(300px,80vw);aspect-ratio:4/5;border-radius:var(--r-3);box-shadow:var(--e3)">'
      +'<a href="'+u+'" download="'+escapeHtml(noms[i])+'" type="image/jpeg" class="btn btn-outline btn-sm" style="width:auto;padding:8px 20px">'
      +'Enregistrer '+(i+1)+'/5</a></figure>').join('')
    +'<button type="button" class="btn btn-outline btn-sm" style="width:auto;padding:8px 20px" onclick="fermerApercuStory()">Fermer</button>';
  document.body.appendChild(d);
  return true;
}

// ── LA CARTE DE L'ACCUEIL ET LA NOTIFICATION ──────────────────────────
// Du 1er au 7 : « Ton mois de septembre est prêt ». Tout décembre : « Ton
// année 2026 est prête ». Rien quand la période est vide — il n'y a rien à
// raconter, et une carte « 0 séance » serait un reproche.
function _rendreCarteWrapped(){
  const z=document.getElementById('clh-wrapped'); if(!z) return false;
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  let html='';
  try{
    for(const p of wrappedPeriodes(Date.now())){
      const w=calculerWrapped(u||{},p.debut,p.fin);
      if(!w.seances) continue;
      if(accCarteMasquee('wrapped-'+p.cle)) continue;
      let vu=false; try{ vu=localStorage.getItem('rc_wrapped_vu_'+p.cle)==='1'; }catch(e){}
      html+='<div class="acc-fermable">'+_htmlCroixAccueil('wrapped-'+p.cle,p.carte)
        +'<button type="button" class="wr-carte" onclick="ouvrirWrapped(\''+p.cle+'\')">'
        +'<span class="wr-carte-eclair" aria-hidden="true">'+icon('zap',18)+'</span>'
        +'<span class="wr-carte-t"><b>'+escapeHtml(p.carte)+'</b>'
        +'<span>'+w.seances+' séance'+(w.seances>1?'s':'')+(w.profil?' · '+escapeHtml(vu?w.profil.nom:'ton profil t’attend'):'')+'</span></span>'
        +'<span class="wr-carte-v">'+(vu?'Revoir':'Voir')+'</span></button></div>';
    }
  }catch(e){ html=''; }
  z.innerHTML=html;
  _wrPlanifierNotif();
  return !!html;
}
// LA NOTIFICATION LOCALE, par le service worker (periodicsync 'wrapped') :
// une par période, seulement si l'athlète a activé les rappels. Le push
// serveur (pushWrappedPret, functions/index.js) envoie le même titre, la même
// adresse (?wrapped=<clé>) et le même tag : si les deux arrivent, l'un
// remplace l'autre. Le local reste le filet quand les Functions manquent.
function _wrPlanifierNotif(){
  try{
    if(!('serviceWorker' in navigator)) return;
    const u=currentUser;
    if(!u||!u._notifEnabled) return;
    const coupe=!pushTypeActif(u,'wrapped');
    navigator.serviceWorker.ready.then(async reg=>{
      try{
        const c=await caches.open('repcore-sw-data');
        // Coupé dans les réglages : le worker ne trouve plus de config, il se tait.
        if(coupe){ await c.delete('/wrapped'); return; }
        // La dernière séance : le worker ne notifie pas une période où
        // l'athlète ne s'est pas entraîné — il n'y aurait rien à raconter.
        const der=((u.sessions||[]).reduce((m,x)=>Math.max(m,Number(x&&x.date)||0),0));
        await c.put('/wrapped',new Response(JSON.stringify({fname:u.fname||'',derniereSeance:der}),
          {headers:{'Content-Type':'application/json'}}));
        if('periodicSync' in reg) await reg.periodicSync.register('wrapped-reminder',{minInterval:12*3600*1000});
      }catch(e){}
    }).catch(()=>{});
  }catch(e){}
}
// ══════════════════ LA CARTE MUSCULAIRE ════════════════════════════════════
//
// La silhouette, face et dos côte à côte, où chaque groupe musculaire prend
// une couleur entre #2a2a2a (au repos) et ROUGE_MARQUE (à sa cible) — et, à la
// cible, une lueur électrique et de fines veines lumineuses.
//
// ⚠ LES ZONES VIENNENT DES CARTES z-*.png, PAS DE TRACÉS SVG. La demande
//   parlait de « chemins simples par groupe ». Mais les territoires musculaires
//   de ces silhouettes ont déjà été détourés pixel par pixel, puis recoupés à
//   la demande de Kevin (pecs jusqu'à la clavicule, biceps en entier, cuisse
//   entière, trapèze coupé à l'épine de l'omoplate — voir CORPS_ZONES_ORDRE et
//   scripts/corps_zones.py). Des chemins simples auraient refait, en moins
//   juste, un découpage déjà validé, et deux découpages du même corps finissent
//   toujours par se contredire. On lit donc LES MÊMES cartes que la fiche
//   coach, et tout se peint dans un canvas — ce qui rend le même dessin à
//   l'écran et dans le visuel 1080×1920.
//
// LE VOLUME EST CELUI DE L'ONGLET VOLUME : séries dures, un muscle secondaire
// compte une demi-série, pondération par le RIR — _volumeSeance, extrait de
// _calculSemaine, et partagé avec lui. Aucun second calcul.

// Les onze groupes affichés, et les muscles de la carte qu'ils couvrent.
// Les adducteurs colorent avec la cuisse, les abducteurs avec les fessiers ;
// l'avant-bras reste neutre (aucun groupe ne le dit).
const MUSC_GROUPES=Object.freeze([
  {cle:'pectoraux',lib:'Pectoraux',m:['PECTORAUX'],cat:'Pecs'},
  {cle:'epaules',lib:'Épaules',m:['DELT_ANT','DELT_LAT','DELT_POST'],cat:'Épaules'},
  {cle:'biceps',lib:'Biceps',m:['BICEPS'],cat:'Bras'},
  {cle:'triceps',lib:'Triceps',m:['TRICEPS'],cat:'Bras'},
  {cle:'abdos',lib:'Abdos',m:['ABDOS'],cat:'Abdos'},
  {cle:'quadriceps',lib:'Quadriceps',m:['QUADRICEPS','ADDUCTEURS'],cat:'Jambes'},
  {cle:'ischios',lib:'Ischios',m:['ISCHIOS'],cat:'Jambes'},
  {cle:'fessiers',lib:'Fessiers',m:['FESSIERS','ABDUCTEURS'],cat:'Jambes'},
  {cle:'mollets',lib:'Mollets',m:['MOLLETS'],cat:'Jambes'},
  {cle:'dos',lib:'Dos',m:['DORSAUX','LOMBAIRES'],cat:'Dos'},
  // DEUX GROUPES, ET NON « Trapèzes » (Kevin, 27/09/2026) : le supérieur
  // élève l'omoplate, le médian la rétracte ; un seul groupe s'allumait pour
  // l'un comme pour l'autre.
  {cle:'trap_sup',lib:'Trapèze supérieur',m:['TRAP_SUP'],cat:'Dos'},
  {cle:'trap_med',lib:'Trapèze médian',m:['TRAP_MED'],cat:'Dos'}
]);
const MUSC_FROID=[0x2a,0x2a,0x2a], MUSC_CHAUD=[0xE0,0x20,0x20];

/**
 * PURE. Le volume d'une période, par groupe musculaire, normalisé 0..1.
 *
 * LA NORMALISATION : pour chaque muscle, ses séries dures rapportées à sa
 * CIBLE — la borne haute du MAV (reperesEffectifs : table, retours de
 * l'athlète, surcharge du coach), multipliée par `semaines` ; le groupe prend
 * le score de son muscle le plus avancé. 1 = la cible est atteinte ou
 * dépassée : c'est là que le muscle s'allume. Une séance seule vaut 1/quota semaine : c'est sa part de la
 * semaine prévue.
 *
 * @param {Array} seances  des séances enregistrées (format de finishWorkout)
 * @param {{user?:object, semaines?:number}} [o]
 * @returns {{groupes:Object<string,number>, series:Object<string,number>,
 *   muscles:Object<string,number>, total:number, semaines:number}}
 */
function volumeParMuscle(seances,o){
  o=o||{};
  const user=o.user||null;
  const sem=(Number(o.semaines)>0)?Number(o.semaines):1;
  const muscles={};
  let total=0;
  for(const s of (seances||[])){
    if(!s||!s.data) continue;
    const r=_volumeSeance(s,user);
    total+=r.eligibles;
    for(const m in r.muscles) muscles[m]=(muscles[m]||0)+r.muscles[m];
  }
  // LE SCORE D'UN GROUPE EST CELUI DE SON MUSCLE LE PLUS AVANCÉ. Sommer les
  // cibles pénalisait les groupes composés : un dos dont les dorsaux sont à
  // leur cible restait tiède parce que les lombaires ne l'étaient pas.
  const groupes={}, series={};
  for(const g of MUSC_GROUPES){
    let n=0, best=0;
    for(const m of g.m){
      const x=muscles[m]||0;
      n+=x;
      let rep=null; try{ rep=reperesEffectifs(user,m); }catch(e){ rep=null; }
      // Sans repère (cas qui n'existe pas aujourd'hui : les dix-huit muscles
      // en ont un), une cible prudente de 12 séries plutôt qu'une division
      // par zéro.
      const cible=((rep&&rep.mavMax>0)?rep.mavMax:12)*sem;
      best=Math.max(best,Math.min(1,x/cible));
    }
    series[g.cle]=n;
    groupes[g.cle]=Math.max(0,best);
  }
  return {groupes,series,muscles,total,semaines:sem};
}
// PURE. La couleur d'un score : #2a2a2a → ROUGE_MARQUE.
function muscCouleur(s){
  const t=Math.max(0,Math.min(1,Number(s)||0));
  const c=MUSC_FROID.map((a,i)=>Math.round(a+(MUSC_CHAUD[i]-a)*t));
  return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
// PURE. Le titre : les régions sous tension (score ≥ 0,66), de la plus
// chargée à la moins chargée. « Dos et jambes sous tension ».
function muscTitre(groupes){
  const cats=[];
  const l=MUSC_GROUPES.map(g=>({cat:g.cat,s:Number(groupes&&groupes[g.cle])||0}))
    .filter(x=>x.s>=0.66).sort((a,b)=>b.s-a.s);
  for(const x of l) if(cats.indexOf(x.cat)<0) cats.push(x.cat);
  if(!cats.length) return 'Des muscles au repos';
  if(cats.length>=4) return 'Tout le corps sous tension';
  const noms=cats.map((c,i)=>i?c.toLowerCase():c);
  return (noms.length===1?noms[0]:(noms.slice(0,-1).join(', ')+' et '+noms[noms.length-1]))+' sous tension';
}
// PURE. Les données d'une carte : titre, trois chiffres, période.
function muscDonnees(seances,o){
  const v=volumeParMuscle(seances,o);
  const tonnage=(seances||[]).reduce((a,s)=>a+(Number(s&&s.volume)||0),0);
  const t=_wrTonnage(tonnage);
  const auMax=MUSC_GROUPES.filter(g=>v.groupes[g.cle]>=1).length;
  return {groupes:v.groupes,series:v.series,titre:muscTitre(v.groupes),periode:(o&&o.periode)||'',
    chiffres:[
      {v:_wrNb(Math.round(v.total)),l:'séries dures'},
      {v:_wrNb(t.v,t.dec),l:t.u==='KG'?'kg soulevés':'tonnes'},
      {v:String(auMax),l:auMax>1?'groupes au max':'groupe au max'}]};
}

// ── LES RESSOURCES : silhouettes, cartes de zones, fond détouré ────────
// Lues une fois par sexe. Le FOND des dessins est noir et opaque : il est
// retiré par remplissage depuis les bords (pixels sombres joignables de
// l'extérieur), pour que la silhouette se pose sur les trois fonds du visuel.
// Le short et les cheveux, sombres mais enclos, restent.
const _muscRes={};
function chargerSilhouettes(genre){
  const g=genre==='f'?'f':'h';
  if(_muscRes[g]) return _muscRes[g];
  const lire=src=>new Promise((ok,ko)=>{
    const i=new Image();
    i.onload=()=>{ try{
      const c=document.createElement('canvas'); c.width=i.naturalWidth; c.height=i.naturalHeight;
      const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(i,0,0);
      ok(x.getImageData(0,0,c.width,c.height)); }catch(e){ ko(e); } };
    i.onerror=()=>ko(new Error('image illisible : '+src));
    i.src=src;
  });
  const vue=v=>{
    const pl=CORPS_PLANCHE[g+'-'+v];
    return Promise.all([lire(pl.src),_corpsCarte(pl.zones)]).then(([img,carte])=>({img,carte,fond:_muscFond(img)}));
  };
  _muscRes[g]=Promise.all([vue('face'),vue('dos')]).then(([face,dos])=>{
    const r={face,dos}; _muscRes[g].pret=r; return r; })
    .catch(e=>{ delete _muscRes[g]; throw e; });
  return _muscRes[g];
}
function _muscPret(genre){ const p=_muscRes[genre==='f'?'f':'h']; return (p&&p.pret)||null; }
// Le masque du fond : 1 = fond.
//
// ⚠ UN REMPLISSAGE SIMPLE FUIT. Le fond vaut 0 à 5, mais le short et les
//   cheveux ont des pixels à 1 qui touchent l'extérieur : un remplissage
//   « sombre et joignable » trouait le short. On fait donc une FERMETURE : les
//   traits du dessin (L > 24) sont épaissis de 3 px, ce qui referme les
//   passages de moins de 6 px ; on remplit depuis les bords ce qui reste ; et
//   la bande de 3 px rendue au dessin est redonnée au fond là où elle est
//   sombre — la silhouette garde son contour exact.
function _muscFond(img){
  const w=img.width, h=img.height, d=img.data, n=w*h, R=3;
  const trait=new Uint8Array(n);
  for(let p=0,i=0;p<n;p++,i+=4) trait[p]=(0.3*d[i]+0.59*d[i+1]+0.11*d[i+2])>24?1:0;
  // Dilatation séparable (carré 7×7) : lignes, puis colonnes.
  const t1=new Uint8Array(n), epais=new Uint8Array(n);
  for(let y=0;y<h;y++){ let run=0;
    for(let x=0;x<w;x++){ let v=0; for(let k=-R;k<=R&&!v;k++){ const xx=x+k; if(xx>=0&&xx<w&&trait[y*w+xx]) v=1; } t1[y*w+x]=v; } }
  for(let x=0;x<w;x++) for(let y=0;y<h;y++){ let v=0;
    for(let k=-R;k<=R&&!v;k++){ const yy=y+k; if(yy>=0&&yy<h&&t1[yy*w+x]) v=1; } epais[y*w+x]=v; }
  // Remplissage depuis les bords, hors des traits épaissis.
  const fond=new Uint8Array(n), pile=[];
  for(let x=0;x<w;x++) pile.push(x,(h-1)*w+x);
  for(let y=0;y<h;y++) pile.push(y*w,y*w+w-1);
  while(pile.length){
    const i=pile.pop();
    if(fond[i]||epais[i]) continue;
    fond[i]=1;
    const x=i%w;
    if(x>0) pile.push(i-1); if(x<w-1) pile.push(i+1);
    if(i>=w) pile.push(i-w); if(i<n-w) pile.push(i+w);
  }
  // La bande rendue : un pixel sombre à moins de R+1 px du fond redevient fond.
  const bord=fond.slice();
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const p=y*w+x; if(fond[p]||trait[p]) continue;
    let pres=0;
    for(let dy=-R-1;dy<=R+1&&!pres;dy++) for(let dx=-R-1;dx<=R+1&&!pres;dx++){
      const xx=x+dx, yy=y+dy; if(xx>=0&&yy>=0&&xx<w&&yy<h&&fond[yy*w+xx]) pres=1; }
    if(pres){
      const i=p*4; if((0.3*d[i]+0.59*d[i+1]+0.11*d[i+2])<10) bord[p]=1;
    }
  }
  return bord;
}
// Le groupe de chaque rang de la carte de zones (null : neutre).
const _muscGroupeDeRang=(()=>{
  const t=[null];
  for(const m of CORPS_ZONES_ORDRE){ const g=MUSC_GROUPES.find(x=>x.m.indexOf(m)>=0); t.push(g?g.cle:null); }
  return t;
})();
/**
 * Peint UNE vue : trois toiles à la taille du dessin.
 *   base   — le dessin en niveaux de gris, chaque muscle teinté par son score ;
 *   lueur  — le masque plein des groupes AU MAXIMUM (à flouter) ;
 *   veines — des éclairs fins, tracés dans ces mêmes muscles et découpés
 *            par leur masque.
 * @returns {{base:HTMLCanvasElement,lueur:HTMLCanvasElement,veines:HTMLCanvasElement,w:number,h:number}}
 */
function _muscPeindreVue(r,groupes,graine){
  const {img,carte,fond}=r, w=img.width, h=img.height;
  const mk=()=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
  const base=mk(), lueur=mk(), veines=mk();
  const bx=base.getContext('2d'), lx=lueur.getContext('2d');
  const out=bx.createImageData(w,h), lm=lx.createImageData(w,h);
  const s=img.data, z=carte.data, o=out.data, l=lm.data;
  const coul={}, max={};
  for(const g of MUSC_GROUPES){
    const sc=Number(groupes&&groupes[g.cle])||0;
    coul[g.cle]=MUSC_FROID.map((a,i)=>a+(MUSC_CHAUD[i]-a)*Math.max(0,Math.min(1,sc)));
    max[g.cle]=sc>=1;
  }
  const boites={};
  for(let i=0,p=0;i<s.length;i+=4,p++){
    if(fond[p]) continue;                                   // alpha 0
    const L=0.3*s[i]+0.59*s[i+1]+0.11*s[i+2];
    const k=(z.length===s.length)?Math.round(z[i]/CORPS_ZONES_PAS):0;
    const gc=_muscGroupeDeRang[k]||null;
    if(gc){
      // L'ombrage du dessin est gardé : la couleur est modulée par sa
      // luminosité, comme un « multiply » éclairci.
      const f=Math.min(1.25,0.3+L/255*1.5), c=coul[gc];
      o[i]=Math.min(255,c[0]*f); o[i+1]=Math.min(255,c[1]*f); o[i+2]=Math.min(255,c[2]*f);
      if(max[gc]){
        l[i]=255; l[i+1]=40; l[i+2]=40; l[i+3]=255;
        const x=p%w, y=(p/w)|0, b=boites[gc]||(boites[gc]=[x,y,x,y,0]);
        if(x<b[0]) b[0]=x; if(y<b[1]) b[1]=y; if(x>b[2]) b[2]=x; if(y>b[3]) b[3]=y; b[4]++;
      }
    } else {
      const v=L*0.62; o[i]=v; o[i+1]=v; o[i+2]=v;
    }
    o[i+3]=255;
  }
  bx.putImageData(out,0,0);
  lx.putImageData(lm,0,0);
  // LES VEINES : trois éclairs par groupe au max, dans sa boîte, tirés d'une
  // graine (le même dessin à chaque rendu), puis découpés par le masque.
  const vx=veines.getContext('2d');
  const al=_recAlea(graine||1);
  vx.lineCap='round'; vx.lineJoin='round';
  for(const gc in boites){
    const b=boites[gc]; if(b[4]<40) continue;
    const bw=b[2]-b[0], bh=b[3]-b[1];
    for(let n=0;n<3;n++){
      let pts=[{x:b[0]+bw*(0.2+al()*0.6),y:b[1]+bh*0.05},{x:b[0]+bw*(0.2+al()*0.6),y:b[3]-bh*0.05}];
      if(bw>bh){ pts=[{x:b[0]+bw*0.05,y:b[1]+bh*(0.2+al()*0.6)},{x:b[2]-bw*0.05,y:b[1]+bh*(0.2+al()*0.6)}]; }
      let d=Math.hypot(pts[1].x-pts[0].x,pts[1].y-pts[0].y)*0.14;
      for(let k=0;k<5;k++){
        const nv=[pts[0]];
        for(let i=0;i<pts.length-1;i++){
          const a=pts[i], c=pts[i+1], dx=c.x-a.x, dy=c.y-a.y, L=Math.hypot(dx,dy)||1, e=(al()*2-1)*d;
          nv.push({x:(a.x+c.x)/2-dy/L*e,y:(a.y+c.y)/2+dx/L*e},c);
        }
        pts=nv; d/=2;
      }
      vx.beginPath(); vx.moveTo(pts[0].x,pts[0].y); for(const p of pts) vx.lineTo(p.x,p.y);
      vx.strokeStyle='rgba(255,70,70,.9)'; vx.lineWidth=2.6; vx.stroke();
      vx.strokeStyle='rgba(255,235,235,.95)'; vx.lineWidth=0.9; vx.stroke();
    }
  }
  vx.globalCompositeOperation='destination-in';
  vx.drawImage(lueur,0,0);
  vx.globalCompositeOperation='source-over';
  return {base,lueur,veines,w,h};
}
// Pose une vue peinte dans un contexte, avec la lueur floue et les veines.
// Le flou passe par l'OMBRE décalée (le filtre de canvas manque à Safari).
function _muscPoser(g,v,x,y,wd,ht,intensite){
  g.drawImage(v.base,x,y,wd,ht);
  const k=(intensite==null)?1:intensite;
  if(k>0){
    g.save();
    g.globalCompositeOperation='lighter';
    g.globalAlpha=0.55*k;
    g.shadowColor='rgba(255,40,40,1)'; g.shadowBlur=Math.max(6,wd*0.045);
    g.shadowOffsetX=10000;
    g.drawImage(v.lueur,x-10000,y,wd,ht);
    g.shadowOffsetX=0; g.shadowBlur=0;
    g.globalAlpha=0.9*k;
    g.drawImage(v.veines,x,y,wd,ht);
    g.restore();
  }
}

// ── L'ÉCRAN : le cadre et son rendu ───────────────────────────────────
// `id` : la place ('wd' fin de séance, 'ev' Évolution). Les données de chaque
// place sont gardées : le partage et le sélecteur de fond les relisent.
const _muscPlaces={};
function htmlCarteMuscles(id,d,o){
  o=o||{};
  _muscPlaces[id]=Object.assign({d},o);
  return '<section class="musc" id="musc-'+id+'">'
    +'<div class="musc-sur">Carte musculaire'+(d.periode?' · '+escapeHtml(d.periode):'')+'</div>'
    +(o.bascule||'')
    +'<h3 class="musc-titre">'+escapeHtml(d.titre)+'</h3>'
    +'<div class="musc-duo">'
      +['face','dos'].map(v=>'<div class="musc-vue" data-vue="'+v+'">'
        +'<canvas class="musc-base" aria-hidden="true"></canvas>'
        +'<canvas class="musc-lueur" aria-hidden="true"></canvas>'
        +'<canvas class="musc-veines" aria-hidden="true"></canvas></div>').join('')
    +'</div>'
    +'<div class="musc-chiffres">'+d.chiffres.map(c=>'<div><b>'+escapeHtml(c.v)+'</b><span>'+escapeHtml(c.l)+'</span></div>').join('')+'</div>'
    +'<div class="musc-legende"><span>Repos</span><i aria-hidden="true"></i><span>Cible atteinte</span></div>'
    // `o.sansPartage` : la carte se lit, elle ne se télécharge pas (fin de
    // séance, Kevin 28/09/2026 — seul le visuel de la séance y est à télécharger).
    +(o.sansPartage?'':(_htmlVisuelFonds('musc-'+id+'-fonds')
    +'<div class="musc-actions">'
      +'<button type="button" class="btn btn-red btn-casse" onclick="partagerCarteMuscles(\''+id+'\',this)">'+icon('share',16)+' <span>Partager</span></button>'
      +'<button type="button" class="btn btn-outline" onclick="telechargerCarteMuscles(\''+id+'\',this)">'+icon('download',16)+' <span>Télécharger</span></button>'
    +'</div>'))+'</section>';
}
// Peint les trois toiles de chaque vue, une fois les images lues.
function monterCarteMuscles(id){
  const p=_muscPlaces[id]; if(!p) return Promise.resolve(false);
  const genre=p.genre||'h';
  return chargerSilhouettes(genre).then(res=>{
    const z=document.getElementById('musc-'+id); if(!z) return false;
    for(const v of ['face','dos']){
      const pv=_muscPeindreVue(res[v],p.d.groupes,_recGraine(id+v));
      const box=z.querySelector('.musc-vue[data-vue="'+v+'"]');
      if(!box) continue;
      box.style.aspectRatio=pv.w+'/'+pv.h;
      const poser=(sel,src)=>{ const c=box.querySelector(sel); c.width=pv.w; c.height=pv.h; c.getContext('2d').drawImage(src,0,0); };
      poser('.musc-base',pv.base); poser('.musc-lueur',pv.lueur); poser('.musc-veines',pv.veines);
    }
    if(!p.sansPartage){ try{ monterSelecteurFond('musc-'+id+'-fonds',f=>_muscCarteDe(id,f),null); }catch(e){} }
    return true;
  }).catch(()=>false);
}
function _muscCarteDe(id,fond){
  const p=_muscPlaces[id]; if(!p) return null;
  const res=_muscPret(p.genre); if(!res) return null;
  let sig=''; try{ sig=nomSurVisuels(currentUser); }catch(e){ sig=''; }
  return _dessinerCarteMuscles(p.d,fond,res,sig);
}
/**
 * LE VISUEL 1080×1920. Même famille que le bilan et les records : fond au
 * choix (idée 02), ombre en double passe, Bebas et Montserrat. La
 * silhouette face + dos, le titre, trois chiffres, la signature. `res` est
 * chargé (chargerSilhouettes) : le dessin est synchrone.
 */
function _dessinerCarteMuscles(d,fond,res,signature,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  g.textAlign='center'; g.textBaseline='alphabetic';
  o.ombre(true); g.fillStyle='#fff'; g.font='800 32px '+MONT;
  const sur='CARTE MUSCULAIRE'+(d.periode?' · '+String(d.periode).toUpperCase():'');
  const ss=o.ajusteEspace(sur,'800',32,MONT,8,LARG,20);
  g.font='800 '+ss+'px '+MONT;
  const yh=post?92:190;
  o.ecrireEspace(sur,cx,yh,8,true);
  const titre=String(d.titre||'').toUpperCase();
  const ts=o.ajuste(titre,'700',post?96:112,BEBAS,LARG,56);
  g.font='700 '+ts+'px '+BEBAS;
  o.ecrire(titre,cx,yh+30+ts*0.85);
  o.ombre(false);
  // Les deux vues, même hauteur, côte à côte.
  if(res){
    // En post, les silhouettes passent de 1 080 à 700 px de haut.
    const HS=post?700:1080, y=post?245:390;
    const vs=['face','dos'].map((v,i)=>_muscPeindreVue(res[v],d.groupes,_recGraine('carte'+v)));
    const ws=vs.map(v=>v.w*HS/v.h);
    const gap=30, tot=ws[0]+ws[1]+gap;
    let x=cx-tot/2;
    // UN HALO CLAIR AUTOUR DES SILHOUETTES (Kevin, 27/09/2026 : « un petit
    // ombrage, qu'on puisse les distinguer »). Sur un fond sombre, le corps
    // au repos (#2a2a2a) se confondait avec lui. La silhouette est d'abord
    // posée avec son ombre, puis repeinte nette par _muscPoser.
    vs.forEach((v,i)=>{
      g.save(); g.shadowColor='rgba(255,255,255,.42)'; g.shadowBlur=34;
      g.drawImage(v.base,x,y,ws[i],HS); g.drawImage(v.base,x,y,ws[i],HS); g.restore();
      _muscPoser(g,v,x,y,ws[i],HS,1); x+=ws[i]+gap; });
  }
  // Les trois chiffres.
  const cw=LARG/3;
  (d.chiffres||[]).slice(0,3).forEach((c,i)=>{
    const x=M+cw*i+cw/2;
    o.ombre(true); g.fillStyle='#fff';
    const vs=o.ajuste(c.v,'700',post?92:110,BEBAS,cw-20,50);
    const yc=post?1062:1590;
    g.font='700 '+vs+'px '+BEBAS; o.ecrire(c.v,x,yc);
    g.fillStyle=f==='rouge'?'rgba(255,255,255,.9)':ROUGE_MARQUE;
    const ls=o.ajusteEspace(c.l.toUpperCase(),'800',24,MONT,3,cw-16,14);
    g.font='800 '+ls+'px '+MONT; o.ecrireEspace(c.l.toUpperCase(),x,yc+42,3,true);
  });
  _recSignature(g,o,String(signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
function _muscSortir(id,btn,partager){
  if(_storyEnCours) return false;
  const res=_muscPret((_muscPlaces[id]||{}).genre);
  if(!res){ toast('La silhouette se charge, réessaie dans un instant.','var(--orange)'); return false; }
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-muscles',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=(partager&&_storySortirPartage(_muscCarteDe(id,fond),nom,undefined,fmt))
      ||_storySortirTelechargement(_muscCarteDe(id,fond),nom,fmt);
  }catch(e){ toast('Visuel impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}
function partagerCarteMuscles(id,btn){ return _muscSortir(id,btn,true); }
function telechargerCarteMuscles(id,btn){ return _muscSortir(id,btn,false); }

// ── SA PLACE ──────────────────────────────────────────────────────────
// La fin de séance ne la porte plus (Kevin, 01/10/2026) : seule Évolution.
// Évolution : la semaine affichée par l'onglet Volume, ou les quatre
// semaines qui finissent avec elle (« mois »).
let _muscEvoPeriode='semaine';
function muscEvoPeriode(p){ _muscEvoPeriode=(p==='mois')?'mois':'semaine'; rendreMusclesEvolution(); }
function rendreMusclesEvolution(){
  const z=document.getElementById('prog-muscles'); if(!z) return false;
  const u=currentUser;
  const lundi=_lundiDeSemaine(_volCleDecalee(typeof _volDecalage==='number'?_volDecalage:0));
  if(!lundi||!u){ z.innerHTML=''; return false; }
  const fin=lundi.getTime()+7*864e5;
  const mois=_muscEvoPeriode==='mois';
  const debut=mois?fin-28*864e5:lundi.getTime();
  const ses=(u.sessions||[]).filter(s=>s&&s.date>=debut&&s.date<fin);
  const bascule='<div class="musc-bascule" role="group" aria-label="Période">'
    +['semaine','mois'].map(k=>'<button type="button" aria-pressed="'+(_muscEvoPeriode===k)+'" onclick="muscEvoPeriode(\''+k+'\')">'
      +(k==='semaine'?'Semaine':'4 semaines')+'</button>').join('')+'</div>';
  const d=muscDonnees(ses,{user:u,semaines:mois?4:1,periode:mois?'4 semaines':'la semaine'});
  z.innerHTML=htmlCarteMuscles('ev',d,{genre:woGenreAvatar(u),bascule});
  monterCarteMuscles('ev');
  return true;
}
// ══════════════════ MON AVANT / APRÈS ══════════════════════════════════════
//
// DEUX GESTES : toucher « Mon avant/après », puis « Partager en story ». Tout le
// reste est déjà choisi — le premier et le dernier bilan, la vue de face — et
// se change sous « Personnaliser » pour qui le veut.
//
// ⚠ 100 % LOCAL. Les photos sont lues là où elles sont — le blob sur
//   l'appareil d'abord, sinon l'URL de l'hébergeur (téléchargée, jamais
//   renvoyée) — et composées dans un canvas. Le flou du visage, le fond, les
//   chiffres : tout se fait ici. Rien ne part, sauf ce que l'athlète partage
//   lui-même, et la PREMIÈRE fois il est prévenu que l'image contient sa photo.
//
// ⚠ CÔTÉ COACH, MÊME OUTIL, EXPORT SOUS ACCORD. Le coach voit l'aperçu ; il ne
//   partage ni n'enregistre qu'avec u.consentementPartageCoach = {date}, posé
//   par l'athlète lui-même dans son propre avant/après.
const AA_VUES=Object.freeze([{k:'face',lib:'Face'},{k:'back',lib:'Dos'},{k:'side',lib:'Profil'}]);
// Le réglage commun : l'avant/après lit et retient le même format que les autres visuels.
const AA_FORMATS=VISUEL_FORMATS;
// PURE. Les bilans qui portent une photo de cette vue, dans l'ordre.
function aaBilansAvecPhoto(u,vue){
  let bl=[]; try{ bl=bilansOrdonnes(u)||[]; }catch(e){ bl=[]; }
  return bl.filter(b=>{ try{ return photoBilanExiste(b,vue); }catch(e){ return false; } });
}
// PURE. Les vues pour lesquelles un avant/après existe (au moins deux bilans).
function aaVuesDisponibles(u){
  return AA_VUES.map(v=>v.k).filter(k=>aaBilansAvecPhoto(u,k).length>=2);
}
function aaDisponible(u){ return aaVuesDisponibles(u).length>0; }
// PURE. « 12 SEMAINES », « 9 JOURS », « 1 AN ET 3 MOIS » n'existe pas : au-delà
// d'un an, des mois.
function aaEcart(d1,d2){
  const j=Math.max(0,Math.round((Number(d2)-Number(d1))/864e5));
  if(j<14) return j+(j>1?' JOURS':' JOUR');
  const s=Math.round(j/7);
  if(s<=52) return s+' SEMAINES';
  return Math.round(j/30.44)+' MOIS';
}
// PURE. La meilleure charge soulevée jusqu'à la date `t` (séries validées).
function aaChargeMax(u,t){
  let best=null;
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!(s.date<=t)) continue;
    for(const e of _wrExos(s)) for(const st of e.sets){
      if(!st||st.done===false) continue;
      const kg=parseFloat(st.weight)||0;
      if(kg>0&&(!best||kg>best.kg)) best={kg,nom:e.nom};
    }
  }
  return best;
}
// PURE. L'indicateur choisi, ou null : 'aucun' (défaut), 'taille', 'charge'.
function aaIndicateur(u,avant,apres,cle){
  if(cle==='taille'){
    const a=getBM(avant,'waist'), b=getBM(apres,'waist');
    if(!(a>0&&b>0)) return null;
    return {lib:'TOUR DE TAILLE',avant:a,apres:b,unite:'cm'};
  }
  if(cle==='charge'){
    const a=aaChargeMax(u,avant.date), b=aaChargeMax(u,apres.date);
    if(!a||!b) return null;
    return {lib:'CHARGE MAX',avant:a.kg,apres:b.kg,unite:'kg'};
  }
  return null;
}
// PURE. Les options par défaut : premier et dernier bilan, face si possible.
function aaDefaut(u){
  const vues=aaVuesDisponibles(u);
  if(!vues.length) return null;
  const vue=vues.indexOf('face')>=0?'face':vues[0];
  const l=aaBilansAvecPhoto(u,vue);
  return {vue,avant:Number(l[0].date),apres:Number(l[l.length-1].date),
    flou:false,poids:false,indicateur:'aucun',fond:'noir',format:visuelFormatChoisi()};
}
// Le bouton, là où il sert : l'onglet Évolution (photos), l'étape photos du
// bilan, la fiche coach. Rien tant qu'il n'y a pas deux photos du même angle.
function htmlBoutonAvantApres(u,role){
  if(!aaDisponible(u)) return '';
  // ROUGE, AVEC LE LOGO INSTAGRAM (Kevin, 28/09/2026) : le bouton mène à une
  // story, il le dit par son logo plutôt que par un éclair. La variante
  // aa-bouton-ig ne touche que lui : « Partager une victoire » garde son style.
  return '<button type="button" class="aa-bouton aa-bouton-ig" onclick="ouvrirAvantApres(\''+(role==='coach'?'coach':'athlete')+'\')">'
    +'<span class="aa-bouton-i" aria-hidden="true">'+icon('instagram',26)+'</span>'
    +'<span><b>'+(role==='coach'?'Avant / après':'Mon avant/après')+'</b>'
    +'<span>'+(role==='coach'?'Aperçu composé en un geste':'Composé en un geste, prêt pour ta story')+'</span></span></button>';
}

// ── LES PHOTOS, LUES SUR PLACE ─────────────────────────────────────────
// Le blob local d'abord (la haute définition, sans réseau) ; sinon l'URL,
// demandée en CORS pour que le canvas reste exportable ; sinon le data-URL
// de l'ancien format.
const _aaImages=new Map();
function aaChargerPhoto(b,vue){
  const k=Number(b&&b.date)+'|'+vue;
  if(_aaImages.has(k)) return _aaImages.get(k);
  const p=(async()=>{
    let src=null, objet=null;
    const ref=photoBilanRef(b,vue);
    if(ref&&ref.cle){
      try{ const bl=await photoBilanBlob(ref); if(bl){ objet=URL.createObjectURL(bl); src=objet; } }catch(e){}
    }
    if(!src) src=photoBilanSrc(b,vue);
    if(!src) throw new Error('photo introuvable');
    return await new Promise((ok,ko)=>{
      const i=new Image();
      if(/^https?:/i.test(src)) i.crossOrigin='anonymous';
      i.onload=()=>ok(i);
      i.onerror=()=>{ _aaImages.delete(k); ko(new Error('photo illisible')); };
      i.src=src;
    });
  })();
  p.catch(()=>_aaImages.delete(k));
  _aaImages.set(k,p);
  return p;
}

// ── LA COMPOSITION ─────────────────────────────────────────────────────
// Recadre une photo pour REMPLIR un cadre (cover), centrée en largeur, calée
// un peu haut : on coupe les pieds plutôt que la tête.
function _aaCouvrir(g,img,x,y,w,h){
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  const k=Math.max(w/iw,h/ih), dw=iw*k, dh=ih*k;
  g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip();
  g.drawImage(img,x+(w-dw)/2,y+(h-dh)*0.3,dw,dh);
  g.restore();
}
// LE FLOU DU VISAGE : le tiers haut du cadre, réduit par paliers puis agrandi
// avec lissage — l'équivalent d'un flou gaussien large, SANS lire un seul
// pixel (getImageData lèverait sur une photo sans en-tête CORS). Le visage
// est illisible ; la silhouette, elle, reste.
function _aaFlouterHaut(g,x,y,w,h){
  const hh=Math.round(h/3);
  const src=document.createElement('canvas'); src.width=w; src.height=hh;
  src.getContext('2d').drawImage(g.canvas,x,y,w,hh,0,0,w,hh);
  let cur=src, cw=w, ch=hh;
  while(cw>w/28){
    const n=document.createElement('canvas'); n.width=Math.max(2,Math.round(cw/2)); n.height=Math.max(2,Math.round(ch/2));
    const nx=n.getContext('2d'); nx.imageSmoothingEnabled=true; nx.imageSmoothingQuality='high';
    nx.drawImage(cur,0,0,n.width,n.height); cur=n; cw=n.width; ch=n.height;
  }
  // LE BAS DE LA BANDE EST FONDU (le dernier quart) : pas de coupure nette
  // au niveau des épaules.
  const t=document.createElement('canvas'); t.width=w; t.height=hh;
  const tx=t.getContext('2d'); tx.imageSmoothingEnabled=true; tx.imageSmoothingQuality='high';
  tx.drawImage(cur,0,0,w,hh);
  const m=tx.createLinearGradient(0,hh*0.72,0,hh);
  m.addColorStop(0,'rgba(0,0,0,1)'); m.addColorStop(1,'rgba(0,0,0,0)');
  tx.globalCompositeOperation='destination-in';
  tx.fillStyle=m; tx.fillRect(0,0,w,hh);
  g.save(); g.beginPath(); g.rect(x,y,w,hh); g.clip();
  g.drawImage(t,x,y);
  g.restore();
  return hh;
}
// ── LE CADRAGE : les deux corps à la même taille, à la même hauteur ─────
// Les repères viennent de la lecture des articulations de Motion Lab
// (mlAnatPhoto, sur le téléphone, rien n'est envoyé) : le milieu des épaules et
// celui des hanches. Le tronc (épaules → hanches) prend la même part du cadre
// sur les deux photos, et les épaules tombent à la même hauteur : deux photos
// prises à des distances différentes se comparent enfin d'égal à égal. Sans
// repères (moteur absent, personne mal vue), on revient au recadrage simple.
const AA_TRONC=0.34, AA_EPAULES=0.28, AA_LARG=0.46;
const _aaReperesCache=new Map();
// PURE. Les repères d'une lecture, ou null si les épaules ne sont pas bien
// vues. ex, ey : le milieu des épaules (fractions de la largeur et de la
// hauteur) ; tronc : épaules → hanches, en fraction de la hauteur, null si les
// hanches sont hors cadre (photo en buste) ; larg : la largeur d'épaules,
// ramenée elle aussi à la hauteur de la photo.
function aaReperesDe(r){
  const p=r&&r.ok&&Array.isArray(r.pts)?r.pts:null;
  if(!p||p.length<25) return null;
  const vu=i=>p[i]&&Number(p[i][2])>=0.5;
  if(!vu(11)||!vu(12)) return null;
  const ex=(p[11][0]+p[12][0])/2, ey=(p[11][1]+p[12][1])/2;
  const asp=(Number(r.w)>0&&Number(r.h)>0)?Number(r.w)/Number(r.h):1;
  const larg=Math.abs(p[11][0]-p[12][0])*asp;
  let tronc=null;
  if(vu(23)&&vu(24)){ const t=(p[23][1]+p[24][1])/2-ey; if(t>0.05) tronc=t; }
  if(tronc===null&&!(larg>0.03)) return null;
  // LE NEZ situe la tête : le haut du crâne est à peu près deux fois plus
  // haut au-dessus des épaules que le nez.
  const nez=(vu(0)&&p[0][1]<ey)?ey-p[0][1]:null;
  // BUILD 1883 : épaules → chevilles, quand les chevilles sont dans le cadre.
  let chev=null;
  if(vu(27)&&vu(28)){ const c=(p[27][1]+p[28][1])/2-ey; if(c>0.1) chev=c; }
  return {ex,ey,tronc,larg:larg>0.03?larg:null,nez,chev};
}
// PURE. La mesure commune aux deux photos : le tronc si les deux le montrent,
// sinon la largeur d'épaules si les deux la montrent (vue de face ou de dos),
// sinon rien — une seule photo calée ne se comparerait plus à l'autre.
function aaModeCadrage(ra,rb){
  if(!ra||!rb) return null;
  if(ra.tronc&&rb.tronc) return 'tronc';
  if(ra.larg&&rb.larg) return 'epaules';
  return null;
}
// La lecture, une fois par photo. Motion Lab se charge à la demande.
function aaReperes(img){
  const src=img&&img.src;
  if(!src) return Promise.resolve(null);
  if(_aaReperesCache.has(src)) return _aaReperesCache.get(src);
  const p=(async()=>{
    try{
      await chargerMotionLab();
      const lire=(typeof window!=='undefined')?/** @type {any} */(window).mlAnatPhoto:null;
      if(typeof lire!=='function') return null;
      return aaReperesDe(await lire(src,{}));
    }catch(e){ _aaReperesCache.delete(src); return null; }
  })();
  _aaReperesCache.set(src,p);
  return p;
}
// Dessine une photo dans son cadre : alignée sur ses repères si elle en a,
// sinon recadrée « cover » calée haut (_aaCouvrir). L'image couvre toujours
// tout le cadre : jamais de bande vide.
function _aaCadrer(g,img,x,y,w,h,rep,mode){
  if(!rep||!mode){ _aaCouvrir(g,img,x,y,w,h); return; }
  const iw=img.naturalWidth||img.width, ih=img.naturalHeight||img.height;
  const cover=Math.max(w/iw,h/ih);
  const voulu=mode==='tronc'?(AA_TRONC*h)/(rep.tronc*ih):(AA_LARG*w)/(rep.larg*ih);
  const s=Math.max(cover,voulu);
  // LA PLACE DE LA TÊTE au-dessus des épaules : environ une largeur d'épaules
  // (ou 60 % du tronc), plus une marge. Sur une photo en buste, les épaules
  // descendent d'autant ; la tête n'est jamais coupée.
  const tete=rep.nez?rep.nez*ih*s*2:(mode==='tronc'?rep.tronc*ih*s*0.62:(rep.larg||0)*ih*s*1.5);
  const yE=Math.max(AA_EPAULES*h,tete+0.05*h);
  let dx=x+w/2-rep.ex*iw*s, dy=y+yE-rep.ey*ih*s;
  dx=Math.min(x,Math.max(x+w-iw*s,dx)); dy=Math.min(y,Math.max(y+h-ih*s,dy));
  g.save(); g.beginPath(); g.rect(x,y,w,h); g.clip();
  g.drawImage(img,dx,dy,iw*s,ih*s);
  g.restore();
}
// PURE. « −4,6 », « +20 », « −8 » : le signe typographique, la virgule.
function aaDelta(a,b){
  const d=Math.round((Number(b)-Number(a))*10)/10;
  const v=String(Math.abs(d)).replace('.',',');
  return (d>0?'+':d<0?'−':'')+v;
}
// PURE. Les chiffres du bas, dans l'ordre : le poids s'il est demandé, puis
// l'indicateur choisi ; l'écart complète quand il reste de la place (il y a
// toujours au moins un chiffre).
function aaChiffres(o){
  const l=[];
  if(o.poids&&o.avant&&o.apres&&o.avant.poids>0&&o.apres.poids>0) l.push({v:aaDelta(o.avant.poids,o.apres.poids),lib:'KG'});
  const ind=o.indicateur;
  if(ind) l.push({v:aaDelta(ind.avant,ind.apres),lib:(ind.unite||'').toUpperCase()+' · '+(ind.lib==='TOUR DE TAILLE'?'TAILLE':ind.lib)});
  if(l.length<3){
    const e=aaEcart(o.avant.date,o.apres.date).split(' ');
    l.unshift({v:e[0],lib:e.slice(1).join(' ')});
  }
  return l;
}
/**
 * Le visuel « TRANSFORMATION », 1080×1920 (story) ou 1080×1350 (post) :
 * titre, dates, deux cartes photo (l'après cerclée de rouge), l'éclair entre
 * les deux, les chiffres en colonnes, puis la marque du coach et la signature.
 * @param {{avant:{img:any,date:number,poids:?number,rep?:any},apres:{img:any,date:number,poids:?number,rep?:any},
 *   format?:'story'|'post', fond?:'noir'|'rouge', flou?:boolean, poids?:boolean,
 *   indicateur?:?{lib:string,avant:number,apres:number,unite:string}, signature?:string,
 *   equipe?:string, marque?:any}} o
 */
function _dessinerAvantApres(o){
  const post=o.format==='post';
  const F=AA_FORMATS[post?'post':'story'], W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const rouge=o.fond==='rouge';
  if(rouge) _visuelPeindreFond(g,W,H,'rouge');
  else {
    g.fillStyle='#070707'; g.fillRect(0,0,W,H);
    const hl=g.createRadialGradient(W*0.75,H*0.45,50,W*0.75,H*0.45,H*0.5);
    hl.addColorStop(0,'rgba(224,32,32,.22)'); hl.addColorStop(1,'rgba(224,32,32,0)');
    g.fillStyle=hl; g.fillRect(0,0,W,H);
  }
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const vo=_visuelOutils(g);
  const L=post?{M:60,T:104,yT:150,D:24,yD:196,yR:226,py:258,ph:712,lib:66,dt:19,v:96,ys:118,etq:20,
                 yb:88,logo:62,eq:44,sig:40}
              :{M:72,T:150,yT:250,D:30,yD:312,yR:352,py:400,ph:980,lib:84,dt:22,v:130,ys:170,etq:24,
                 yb:118,logo:88,eq:58,sig:72};
  const M=L.M, cx=W/2;
  // ── Le titre et les dates
  g.textAlign='left'; g.textBaseline='alphabetic';
  vo.ombre(true); g.fillStyle='#fff';
  vo.ajuste('TRANSFORMATION','400',L.T,BEBAS,W-2*M,60);
  vo.ecrire('TRANSFORMATION',M,L.yT);
  const dates=_recDate(o.avant.date)+'   →   '+_recDate(o.apres.date)+'   ·   '+aaEcart(o.avant.date,o.apres.date);
  g.fillStyle='rgba(255,255,255,.88)';
  vo.ajusteEspace(dates,'700',L.D,MONT,3,W-2*M,16);
  vo.ecrireEspace(dates,M,L.yD,3,false);
  vo.ombre(false);
  g.strokeStyle=rouge?'rgba(255,255,255,.7)':'rgba(255,255,255,.55)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(M,L.yR); g.lineTo(W-M,L.yR); g.stroke();
  // ── Les deux cartes
  const mode=aaModeCadrage(o.avant.rep,o.apres.rep);
  const gap=28, pw=(W-2*M-gap)/2, ph=L.ph, py=L.py, R=28;
  const arrondi=(x,y,w,h,r)=>{ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r);
    g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); };
  [[o.avant,M,'AVANT',false],[o.apres,M+pw+gap,'APRÈS',true]].forEach(([c,x,lib,fort])=>{
    g.save(); arrondi(x,py,pw,ph,R); g.clip();
    g.fillStyle='#111'; g.fillRect(x,py,pw,ph);
    if(c.img){
      // LES DEUX PHOTOS PARLENT LA MÊME LANGUE : même contraste, même
      // saturation, même voile rouge (ignoré sans erreur là où le filtre de
      // canvas n'existe pas).
      try{ g.filter='contrast(1.08) saturate(0.88)'; }catch(e){}
      _aaCadrer(g,c.img,x,py,pw,ph,c.rep||null,mode);
      try{ g.filter='none'; }catch(e){}
      g.globalCompositeOperation='soft-light'; g.fillStyle='rgba(224,32,32,.10)'; g.fillRect(x,py,pw,ph);
      g.globalCompositeOperation='source-over';
    }
    if(o.flou) _aaFlouterHaut(g,x,py,pw,ph);
    const v=g.createLinearGradient(0,py+ph-240,0,py+ph);
    v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.85)');
    g.fillStyle=v; g.fillRect(x,py+ph-240,pw,240);
    g.restore();
    g.save();
    if(fort){ g.shadowColor=rouge?'rgba(255,255,255,.6)':ROUGE_MARQUE; g.shadowBlur=40; g.strokeStyle=rouge?'#fff':ROUGE_MARQUE; g.lineWidth=5; }
    else { g.strokeStyle='rgba(255,255,255,.25)'; g.lineWidth=2; }
    arrondi(x,py,pw,ph,R); g.stroke(); g.restore();
    vo.ombre(true); g.fillStyle='#fff'; g.textAlign='left';
    g.font='400 '+L.lib+'px '+BEBAS; vo.ecrire(lib,x+(post?22:30),py+ph-(post?30:44));
    g.textAlign='right'; g.fillStyle='rgba(255,255,255,.85)'; g.font='700 '+L.dt+'px '+MONT;
    vo.ecrire(_recDate(c.date),x+pw-(post?20:26),py+ph-(post?36:52));
    vo.ombre(false);
  });
  // ── L'éclair entre les deux cartes, tiré d'une graine (le même à chaque rendu)
  const al=_recAlea(_recGraine(String(o.avant.date)+'|'+o.apres.date));
  let pts=[{x:cx+6,y:py-30},{x:cx-6,y:py+ph+30}], d=16;
  for(let k=0;k<7;k++){
    const nv=[pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i], b=pts[i+1];
      nv.push({x:Math.max(cx-gap/2+2,Math.min(cx+gap/2-2,(a.x+b.x)/2+(al()*2-1)*d)),y:(a.y+b.y)/2},b);
    }
    pts=nv; d*=0.55;
  }
  const trace=(w,c,sh)=>{ g.save(); g.lineJoin='round'; g.lineCap='round'; g.strokeStyle=c; g.lineWidth=w;
    if(sh){ g.shadowColor=rouge?'rgba(255,255,255,.7)':ROUGE_MARQUE; g.shadowBlur=sh; }
    g.beginPath(); g.moveTo(pts[0].x,pts[0].y); for(const p of pts) g.lineTo(p.x,p.y); g.stroke(); g.restore(); };
  trace(10,rouge?'rgba(255,255,255,.45)':'rgba(224,32,32,.45)',30); trace(4,rouge?'#fff':ROUGE_MARQUE,0); trace(1.4,'#fff',0);
  // ── Les chiffres, en colonnes, comme le bilan de séance
  const chiffres=aaChiffres(o).slice(0,3), n=chiffres.length, cw=(W-2*M)/n;
  const ys=py+ph+L.ys;
  chiffres.forEach((c,i)=>{
    const x=M+i*cw+cw/2;
    vo.ombre(true); g.fillStyle='#fff'; g.textAlign='center';
    vo.ajuste(c.v,'400',L.v,BEBAS,cw-20,40); vo.ecrire(c.v,x,ys);
    g.fillStyle=(i===0&&!rouge)?ROUGE_MARQUE:'rgba(255,255,255,.78)';
    vo.ajusteEspace(c.lib,'800',L.etq,MONT,4,cw-24,12);
    vo.ecrireEspace(c.lib,x,ys+(post?36:50),4,true);
    vo.ombre(false);
  });
  g.strokeStyle='rgba(255,255,255,.18)'; g.lineWidth=2;
  for(let i=1;i<n;i++){ const x=M+i*cw; g.beginPath(); g.moveTo(x,ys-L.v*0.85); g.lineTo(x,ys+(post?44:60)); g.stroke(); }
  // ── LA MARQUE DU COACH : « COACHÉ PAR », son logo et le nom de sa team.
  // Sans coach, le mot-symbole REPCORE tient la place.
  const marque=o.marque||null, equipe=String(o.equipe||'').trim();
  const yb=ys+L.yb;
  if(marque||equipe){
    vo.ombre(true); g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.textAlign='center';
    g.font='800 '+(post?16:20)+'px '+MONT; vo.ecrireEspace('COACHÉ PAR',cx,yb,6,true);
    const hl=L.logo, yl=yb+(post?14:20);
    let lw=0, lh=0;
    if(marque){ const r=Math.min((hl*2.4)/marque.naturalWidth,hl/marque.naturalHeight);
      lw=Math.round(marque.naturalWidth*r); lh=Math.round(marque.naturalHeight*r); }
    let tw=0, ts=L.eq, nom='';
    if(equipe){ nom=equipe.toLocaleUpperCase('fr-FR');
      ts=vo.ajusteEspace(nom,'400',L.eq,BEBAS,3,W-2*M-(lw?lw+24:0),24);
      g.font='400 '+ts+'px '+BEBAS;
      tw=String(nom).split('').reduce((a,c)=>a+g.measureText(c).width+3,0)-3; }
    const tot=lw+(lw&&tw?24:0)+tw; let x0=cx-tot/2;
    const my=yl+hl/2;
    if(marque){ try{ g.drawImage(marque,Math.round(x0),Math.round(my-lh/2),lw,lh); }catch(e){} x0+=lw+(tw?24:0); }
    if(equipe){ g.fillStyle='#fff'; g.font='400 '+ts+'px '+BEBAS; g.textAlign='left';
      vo.ecrireEspace(nom,x0,my+ts*0.36,3,false); }
    vo.ombre(false);
  } else {
    vo.ombre(true); g.fillStyle='#fff'; g.textAlign='center'; g.font='400 '+(post?40:52)+'px '+BEBAS;
    vo.ecrireEspace('REPCORE',cx,yb+(post?30:40),14,true); vo.ombre(false);
  }
  _recSignature(g,vo,String(o.signature||''),H-L.sig,W-2*M);
  vo.ombre(false);
  return cv;
}

// ── L'ÉCRAN : l'aperçu plein écran ─────────────────────────────────────
let _aa=null;           // {role, u, o, imgs:{avant,apres}}
function _aaDossier(role){
  if(role==='coach'){ try{ return getOwnedClient(currentClientId)||null; }catch(e){ return null; } }
  return (typeof currentUser!=='undefined')?currentUser:null;
}
function aaExportAutorise(role,u){
  if(role!=='coach') return true;
  const c=u&&u.consentementPartageCoach;
  return !!(c&&Number(c.date)>0);
}
function ouvrirAvantApres(role){
  const u=_aaDossier(role);
  const o=aaDefaut(u);
  if(!u||!o){ toast('Il faut deux bilans avec une photo du même angle.','var(--orange)'); return false; }
  fermerAvantApres();
  _aa={role:role==='coach'?'coach':'athlete',u,o,imgs:{}};
  // LE LOGO DU COACH se charge maintenant : le dessin est synchrone (geste iOS).
  // S'il arrive après la première composition, l'aperçu est repeint.
  try{ _prechaufferMarqueCoach(); }catch(e){}
  try{ const im=_marqueCoachImg; if(im&&!(im.complete&&im.naturalWidth>0)) im.addEventListener('load',()=>{ try{ _aaPeindre(); }catch(e){} },{once:true}); }catch(e){}
  const z=document.createElement('div');
  z.id='aa-ecran'; z.className='aa-ecran';
  z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true'); z.setAttribute('aria-label','Avant / après');
  z.tabIndex=-1;
  z.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); fermerAvantApres(); } });
  document.body.appendChild(z);
  _aaRendreEcran();
  _aaComposer();
  try{ z.focus({preventScroll:true}); }catch(e){}
  return true;
}
function fermerAvantApres(){
  try{ aaAnimArreter(); }catch(e){}
  const z=document.getElementById('aa-ecran'); if(z) z.remove();
  _aa=null;
  return true;
}
function _aaRendreEcran(){
  const z=document.getElementById('aa-ecran'); if(!z||!_aa) return;
  const {role,u,o}=_aa;
  const autorise=aaExportAutorise(role,u);
  const l=aaBilansAvecPhoto(u,o.vue);
  const date=b=>{ try{ return dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); }catch(e){ return ''; } };
  const opts=sel=>l.map(b=>'<option value="'+Number(b.date)+'"'+(Number(b.date)===sel?' selected':'')+'>'+escapeHtml(date(b))+'</option>').join('');
  const seg=(nom,val,liste)=>'<div class="aa-seg" role="group">'+liste.map(([k,lib,dis])=>'<button type="button"'
    +(dis?' disabled':'')+' aria-pressed="'+(val===k)+'" onclick="aaReglage(\''+nom+'\',\''+k+'\')">'+escapeHtml(lib)+'</button>').join('')+'</div>';
  const vues=aaVuesDisponibles(u);
  const cons=u&&u.consentementPartageCoach&&Number(u.consentementPartageCoach.date)>0;
  z.innerHTML='<div class="aa-haut"><span>'+(role==='coach'?'Avant / après de '+escapeHtml(u.fname||'l’athlète'):'Mon avant/après')+'</span>'
    +'<button type="button" class="aa-fermer" aria-label="Fermer" onclick="fermerAvantApres()">'+icon('croix',14)+'</button></div>'
    +'<div class="aa-apercu"><canvas id="aa-canvas" aria-label="Aperçu de l’image"></canvas><div class="aa-charge" id="aa-charge">Composition…</div></div>'
    +'<div class="aa-bas">'
    // BUILD 1885 : « Image / Évolution animée ».
    +'<div class="aa-seg" role="group" style="margin-bottom:8px"><button type="button" aria-pressed="'+(_aa.mode!=='anime')+'" onclick="aaMode(\'image\')">Image</button>'
      +'<button type="button" aria-pressed="'+(_aa.mode==='anime')+'"'+(aaBilansAvecPhoto(u,o.vue).length<2?' disabled':'')+' onclick="aaMode(\'anime\')">Évolution animée</button></div>'
    +(_aa.mode==='anime'
      ?('<button type="button" class="btn btn-outline btn-sm" onclick="aaAnimJouer()">Rejouer</button>'
        +(autorise&&aaFormatVideo()?'<button type="button" class="btn btn-red aa-partager" onclick="aaVideoSortir(this)">'+icon('share',18)+' <span>Partager la vidéo</span></button>':'')
        +(autorise?'<button type="button" class="btn btn-outline btn-casse aa-enregistrer" onclick="aaMode(\'image\');aaEnregistrer(this)">'+icon('download',16)+' <span>Enregistrer l’image</span></button>':''))
      :'')
    +(_aa.mode==='anime'?'':autorise
      ?('<button type="button" class="btn btn-red aa-partager" onclick="aaPartager(this)">'+icon('share',18)
          +' <span>'+(o.format==='post'?'Partager en post':'Partager en story')+'</span></button>'
        +'<button type="button" class="btn btn-outline btn-casse aa-enregistrer" onclick="aaEnregistrer(this)">'+icon('download',16)+' <span>Enregistrer</span></button>'
        +'<button type="button" class="vf-legende" onclick="voirLegende(\'avant\')">Voir la légende</button>')
      :'<p class="aa-refus">L’export demande l’accord de '+escapeHtml(u.fname||'l’athlète')
        +'. Il peut l’accorder depuis son propre avant/après, sous « Personnaliser ».</p>')
    +'<p class="aa-avert" id="aa-avert" hidden></p>'
    +'<details class="aa-perso"><summary>Personnaliser</summary>'
      +'<label>Avant<select onchange="aaReglage(\'avant\',this.value)">'+opts(o.avant)+'</select></label>'
      +'<label>Après<select onchange="aaReglage(\'apres\',this.value)">'+opts(o.apres)+'</select></label>'
      +'<div class="aa-l">Angle</div>'+seg('vue',o.vue,AA_VUES.map(v=>[v.k,v.lib,vues.indexOf(v.k)<0]))
      +'<div class="aa-l">Chiffre</div>'+seg('indicateur',o.indicateur,[['aucun','Aucun'],['taille','Tour de taille'],['charge','Charge max']])
      +'<div class="aa-l">Fond</div>'+seg('fond',o.fond,[['noir','Noir'],['rouge','Rouge']])
      +'<div class="aa-l">Format</div>'+seg('format',o.format,[['story','Story 9:16'],['post','Post 4:5']])
      +'<label class="aa-case"><input type="checkbox"'+(o.flou?' checked':'')+' onchange="aaReglage(\'flou\',this.checked)"> Flouter le visage</label>'
      +'<label class="aa-case"><input type="checkbox"'+(o.poids?' checked':'')+' onchange="aaReglage(\'poids\',this.checked)"> Afficher le poids</label>'
      +((role!=='coach'&&u&&u.coachId)
        ?'<label class="aa-case"><input type="checkbox"'+(cons?' checked':'')+' onchange="aaConsentementCoach(this.checked)"> Autoriser mon coach à partager mes progrès</label>':'')
      +'<p class="aa-local">Tout est composé sur ton téléphone : aucune photo n’est envoyée.</p>'
    +'</details></div>';
}
// Un réglage change : on recompose, sans refermer « Personnaliser ».
function aaReglage(nom,val){
  if(!_aa) return;
  const o=_aa.o;
  if(nom==='avant'||nom==='apres') o[nom]=Number(val);
  else if(nom==='flou'||nom==='poids') o[nom]=!!val;
  else if(nom==='vue'){
    const l=aaBilansAvecPhoto(_aa.u,val);
    if(l.length<2) return;
    o.vue=val; o.avant=Number(l[0].date); o.apres=Number(l[l.length-1].date);
  } else o[nom]=val;
  // Le format est le réglage commun des visuels : retenu pour tous.
  if(nom==='format') visuelFormatMemoriser(val);
  if(o.avant===o.apres){ toast('Choisis deux bilans différents.','var(--orange)'); }
  const ouvert=!!document.querySelector('#aa-ecran .aa-perso[open]');
  _aaRendreEcran();
  if(ouvert){ const d=document.querySelector('#aa-ecran .aa-perso'); if(d) d.open=true; }
  if(_aa.mode==='anime'){ aaAnimArreter(); aaAnimPreparer(); return; }
  _aaComposer();
}
// L'ACCORD DE L'ATHLÈTE pour l'export par son coach : une date, ou rien.
function aaConsentementCoach(on){
  const u=currentUser; if(!u) return false;
  u.consentementPartageCoach=on?{date:Date.now()}:null;
  try{ saveUser(); }catch(e){ rcErreurMuette('aaConsentementCoach',e); }
  toast(on?'Ton coach peut partager tes progrès.':'Ton coach ne peut plus partager tes progrès sous ton nom.');
  return true;
}
// Les données du dessin pour les réglages courants (images comprises).
function _aaDonnees(){
  const {u,o,imgs}=_aa;
  const bl=aaBilansAvecPhoto(u,o.vue);
  const av=bl.find(b=>Number(b.date)===o.avant)||bl[0];
  const ap=bl.find(b=>Number(b.date)===o.apres)||bl[bl.length-1];
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  let equipe=''; try{ equipe=_nomCoachStory(u); }catch(e){ equipe=''; }
  let marque=null; try{ marque=_marqueCoachPrete(); }catch(e){ marque=null; }
  const reps=_aa.reps||{};
  return {avant:{img:imgs.avant||null,date:Number(av.date),poids:getBW(av),rep:reps.avant||null},
    apres:{img:imgs.apres||null,date:Number(ap.date),poids:getBW(ap),rep:reps.apres||null},
    format:o.format,fond:o.fond,flou:o.flou,poids:o.poids,
    indicateur:o.indicateur==='aucun'?null:aaIndicateur(u,av,ap,o.indicateur),signature:sig,
    equipe,marque,_av:av,_ap:ap};
}
// COMPOSITION IMMÉDIATE : les deux photos sont lues, puis dessinées. Tant
// qu'elles arrivent, le cadre dit « Composition… ».
// Peint l'aperçu avec les réglages et ce qui est déjà arrivé (photos,
// repères, logo du coach).
function _aaPeindre(){
  if(!_aa||!_aa.imgs.avant||!_aa.imgs.apres) return false;
  const cv=_dessinerAvantApres(_aaDonnees());
  const c=document.getElementById('aa-canvas'); if(!c) return false;
  c.width=cv.width; c.height=cv.height;
  c.getContext('2d').drawImage(cv,0,0);
  return true;
}
function _aaComposer(){
  if(!_aa) return;
  const moi=_aa;
  const d=_aaDonnees();
  const ch=document.getElementById('aa-charge'); if(ch) ch.hidden=false;
  Promise.all([aaChargerPhoto(d._av,moi.o.vue),aaChargerPhoto(d._ap,moi.o.vue)]).then(([a,b])=>{
    if(_aa!==moi) return;
    moi.imgs.avant=a; moi.imgs.apres=b;
    _aaPeindre();
    if(ch) ch.hidden=true;
    // LE CADRAGE FIN ARRIVE ENSUITE : les articulations sont lues sur le
    // téléphone (Motion Lab), puis l'image est recomposée, alignée. Tant
    // qu'elles n'arrivent pas, le recadrage simple reste affiché.
    if(!moi.reps||moi.reps.a!==a||moi.reps.b!==b){
      moi.reps={a,b,avant:null,apres:null};
      // L'UNE APRÈS L'AUTRE : le moteur de lecture ne se partage pas entre
      // deux photos lues en même temps.
      aaReperes(a).then(ra=>aaReperes(b).then(rb=>[ra,rb])).then(([ra,rb])=>{
        if(_aa!==moi||!moi.reps||moi.reps.a!==a||moi.reps.b!==b) return;
        // Les deux ou aucune : une seule photo alignée ne se comparerait plus.
        if(aaModeCadrage(ra,rb)){ moi.reps.avant=ra; moi.reps.apres=rb; _aaPeindre(); }
      });
    }
  }).catch(()=>{ if(ch){ ch.hidden=false; ch.textContent='Une des deux photos n’est pas lisible sur cet appareil.'; } });
}
// AVANT LE PREMIER PARTAGE SEULEMENT : « Cette image contient ta photo.
// Continuer ? ». Une question dans l'écran, pas un confirm() : le « oui » est
// un nouveau geste, et c'est lui qui ouvre le partage (iOS exige un geste).
function _aaAvertiCle(){ return 'rc_aa_averti_'+(((_aa&&_aa.role)||'')+'_'+((currentUser&&currentUser.email)||'')); }
function _aaDejaAverti(){ try{ return localStorage.getItem(_aaAvertiCle())==='1'; }catch(e){ return false; } }
function _aaSortir(partager,btn,confirme){
  if(!_aa||!_aa.imgs.avant||!_aa.imgs.apres){ toast('L’image se compose, un instant.','var(--orange)'); return false; }
  if(!aaExportAutorise(_aa.role,_aa.u)) return false;
  if(!confirme&&!_aaDejaAverti()){
    const p=document.getElementById('aa-avert');
    if(p){
      const qui=_aa.role==='coach'?('la photo de '+escapeHtml(_aa.u.fname||'ton athlète')):'ta photo';
      p.innerHTML='Cette image contient '+qui+'. Continuer ?'
        +'<span><button type="button" class="btn btn-red btn-sm" onclick="_aaSortir('+(partager?'true':'false')+',null,true)">Continuer</button>'
        +'<button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById(\'aa-avert\').hidden=true">Annuler</button></span>';
      p.hidden=false;
    }
    return false;
  }
  try{ localStorage.setItem(_aaAvertiCle(),'1'); }catch(e){}
  const p=document.getElementById('aa-avert'); if(p) p.hidden=true;
  if(_storyEnCours) return false;
  const nom=visuelNomFichier('repcore-avant-apres','noir',_aa.o.format), fmt={type:'image/jpeg',ext:'jpg',q:0.9};
  _storyEnCours=true;
  let ok=false;
  try{
    ok=(partager&&_storySortirPartage(_dessinerAvantApres(_aaDonnees()),nom,undefined,fmt))
      ||_storySortirTelechargement(_dessinerAvantApres(_aaDonnees()),nom,fmt);
  }catch(e){ toast('Image impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const t=sp.textContent; _texteIco(sp,'Image prête '+ICO.coche); setTimeout(()=>{ sp.textContent=t; },2000); }
  return ok;
}
function aaPartager(btn){ return _aaSortir(true,btn,false); }
// ══ BUILD 1885 : L'ÉVOLUTION ANIMÉE ═════════════════════════════════════════
// Toutes les photos d'une vue (8 au plus : la première, la dernière et des
// intermédiaires régulières), alignées une à une sur la première (épaules →
// chevilles), enchaînées en fondus de 600 ms. Tout est local ; l'export vidéo
// passe par les mêmes garde-fous que l'image.
const AA_ANIM_MAX=8, AA_ANIM_FONDU=600, AA_ANIM_DUREE=7000;
/** PURE. n éléments au plus, la première et la dernière toujours gardées. */
function aaSelectionAnimee(liste,n){
  const l=Array.isArray(liste)?liste:[];
  const m=Math.max(2,Number(n)||AA_ANIM_MAX);
  if(l.length<=m) return l.slice();
  const idx=[];
  for(let i=0;i<m;i++){ const k=Math.round(i*(l.length-1)/(m-1)); if(idx.indexOf(k)<0) idx.push(k); }
  return idx.map(k=>l[k]);
}
/** PURE. Aligne b sur a (coordonnées normalisées) : p' = p × échelle + (dx, dy). */
function aaTransformeAlignement(ra,rb){
  if(!ra||!rb) return {echelle:1,dx:0,dy:0};
  const ha=(ra.chev&&rb.chev)?ra.chev:((ra.tronc&&rb.tronc)?ra.tronc:null);
  const hb=(ra.chev&&rb.chev)?rb.chev:((ra.tronc&&rb.tronc)?rb.tronc:null);
  const s=(ha&&hb)?ha/hb:1;
  return {echelle:s,dx:ra.ex-rb.ex*s,dy:ra.ey-rb.ey*s};
}
let _aaAnim=null;   // {images:[{img,rep,b}], t0, raf}
async function aaAnimPreparer(){
  if(!_aa) return false;
  const moi=_aa;
  const bl=aaSelectionAnimee(aaBilansAvecPhoto(moi.u,moi.o.vue),AA_ANIM_MAX);
  const ch=document.getElementById('aa-charge'); if(ch){ ch.hidden=false; ch.textContent='Préparation de l’animation…'; }
  const images=[];
  for(const b of bl){
    try{ const img=await aaChargerPhoto(b,moi.o.vue); if(img) images.push({img,b,rep:null}); }catch(e){ /* photo illisible : sautée */ }
  }
  if(_aa!==moi) return false;
  if(images.length<2){ if(ch) ch.textContent='Il faut au moins deux photos lisibles de cet angle.'; return false; }
  for(const x of images){ try{ x.rep=await aaReperes(x.img); }catch(e){ x.rep=null; } }
  if(_aa!==moi) return false;
  const r0=images[0].rep;
  images.forEach(x=>{ x.tr=(r0&&x.rep)?aaTransformeAlignement(r0,x.rep):{echelle:1,dx:0,dy:0}; });
  _aaAnim={images,t0:0,raf:0};
  if(ch) ch.hidden=true;
  aaAnimJouer();
  return true;
}
// La durée d'une photo tenue, pour que l'ensemble fasse 6 à 8 s.
function _aaAnimTenue(n){ return Math.max(300,(AA_ANIM_DUREE-(n-1)*AA_ANIM_FONDU)/n); }
function _aaAnimDessiner(g,W,H,t){
  const A=_aaAnim; if(!A) return true;
  const L=A.images, n=L.length, tenue=_aaAnimTenue(n), pas=tenue+AA_ANIM_FONDU;
  const i=Math.min(n-1,Math.floor(t/pas)), r=t-i*pas;
  const a=r>tenue&&i<n-1?(r-tenue)/AA_ANIM_FONDU:0;
  g.fillStyle='#070707'; g.fillRect(0,0,W,H);
  const base=L[0].img, iw=base.naturalWidth||base.width, ih=base.naturalHeight||base.height;
  const k=Math.max(W/iw,H/ih), dw=iw*k, dh=ih*k, ox=(W-dw)/2, oy=(H-dh)*0.3;
  const peindre=(x,alpha)=>{
    const tr=x.tr||{echelle:1,dx:0,dy:0};
    g.globalAlpha=alpha;
    g.drawImage(x.img,ox+tr.dx*dw,oy+tr.dy*dh,tr.echelle*dw,tr.echelle*dh);
    g.globalAlpha=1;
  };
  peindre(L[i],1);
  if(a>0) peindre(L[i+1],a);
  if(_aa&&_aa.o.flou){ try{ _aaFlouterHaut(g,0,0,W,H); }catch(e){} }
  const cur=a>0.5?L[i+1]:L[i];
  const sem=Math.max(0,Math.round((Number(cur.b.date)-Number(L[0].b.date))/(7*864e5)));
  const u=_aa&&_aa.u;
  const sansPoids=!u||u.masquerPoids||(function(){ try{ return aTCA(u); }catch(e){ return false; } })();
  const morceaux=[(function(){ try{ return dateLocaleDeCle(cur.b.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } })(),'Semaine '+sem];
  if(_aa&&_aa.o.poids&&!sansPoids&&getBW(cur.b)) morceaux.push(String(getBW(cur.b)).replace('.',',')+' kg');
  if(_aa&&_aa.o.indicateur==='taille'&&getBM(cur.b,'waist')) morceaux.push('taille '+String(getBM(cur.b,'waist')).replace('.',',')+' cm');
  g.fillStyle='rgba(0,0,0,.55)'; g.fillRect(0,H-H*0.08,W,H*0.08);
  g.fillStyle='#fff'; g.font='700 '+Math.round(H*0.028)+'px Montserrat,sans-serif'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(morceaux.join(' · '),W/2,H-H*0.04);
  return t>=n*pas-AA_ANIM_FONDU;
}
function aaAnimJouer(){
  const A=_aaAnim, c=document.getElementById('aa-canvas');
  if(!A||!c) return false;
  const F=AA_FORMATS[_aa&&_aa.o.format==='post'?'post':'story'];
  c.width=F.w; c.height=F.h;
  const g=c.getContext('2d');
  cancelAnimationFrame(A.raf);
  A.t0=performance.now();
  const pas=()=>{ if(_aaAnim!==A||!document.getElementById('aa-canvas')) return; const fini=_aaAnimDessiner(g,c.width,c.height,performance.now()-A.t0); if(!fini) A.raf=requestAnimationFrame(pas); };
  A.raf=requestAnimationFrame(pas);
  return true;
}
function aaAnimArreter(){ if(_aaAnim){ try{ cancelAnimationFrame(_aaAnim.raf); }catch(e){} } _aaAnim=null; }
function aaMode(m){
  if(!_aa) return false;
  _aa.mode=m==='anime'?'anime':'image';
  aaAnimArreter();
  _aaRendreEcran();
  if(_aa.mode==='anime') aaAnimPreparer(); else _aaComposer();
  return true;
}
/** Le format vidéo enregistrable ici, ou null (certains iOS : lecture seule). */
function aaFormatVideo(){
  try{
    if(typeof MediaRecorder==='undefined'||!MediaRecorder.isTypeSupported) return null;
    for(const t of ['video/webm;codecs=vp9','video/webm','video/mp4']) if(MediaRecorder.isTypeSupported(t)) return t;
  }catch(e){}
  return null;
}
async function aaVideoSortir(btn,confirme){
  if(!_aa||!_aaAnim) return false;
  if(!aaExportAutorise(_aa.role,_aa.u)) return false;
  if(!confirme&&!_aaDejaAverti()){
    const p=document.getElementById('aa-avert');
    if(p){
      p.innerHTML='Cette vidéo contient '+(_aa.role==='coach'?'les photos de '+escapeHtml(_aa.u.fname||'ton athlète'):'tes photos')+'. Continuer ?'
        +'<span><button type="button" class="btn btn-red btn-sm" onclick="aaVideoSortir(null,true)">Continuer</button>'
        +'<button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById(\'aa-avert\').hidden=true">Annuler</button></span>';
      p.hidden=false;
    }
    return false;
  }
  try{ localStorage.setItem(_aaAvertiCle(),'1'); }catch(e){}
  const p=document.getElementById('aa-avert'); if(p) p.hidden=true;
  const type=aaFormatVideo();
  const c=document.getElementById('aa-canvas');
  if(!type||!c||!c.captureStream){ toast('La vidéo ne s’enregistre pas sur cet appareil : l’animation se lit à l’écran.','var(--orange)'); return false; }
  if(_storyEnCours) return false;
  _storyEnCours=true;
  try{
    const flux=c.captureStream(30), rec=new MediaRecorder(flux,{mimeType:type}), morceaux=[];
    rec.ondataavailable=e=>{ if(e.data&&e.data.size) morceaux.push(e.data); };
    const fini=new Promise(r=>{ rec.onstop=r; });
    rec.start();
    aaAnimJouer();
    const n=_aaAnim.images.length;
    await new Promise(r=>setTimeout(r,n*(_aaAnimTenue(n)+AA_ANIM_FONDU)));
    rec.stop(); await fini;
    try{ flux.getTracks().forEach(t=>t.stop()); }catch(e){}
    const ext=/mp4/.test(type)?'mp4':'webm';
    const blob=new Blob(morceaux,{type:type.split(';')[0]});
    const f=new File([blob],'repcore-evolution.'+ext,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[f]})){ try{ await navigator.share({files:[f]}); return true; }catch(e){ if(e&&e.name==='AbortError') return false; } }
    const u=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=u; a.download=f.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),3000);
    return true;
  }catch(e){ toast('Vidéo impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); return false; }
  finally{ _storyEnCours=false; }
}
function aaEnregistrer(btn){ return _aaSortir(false,btn,false); }
// ══ LA CARTE DE CYCLE : « CYCLE N TERMINÉ » ═══════════════════════════════
//
// Le rite de 28 jours se referme sur un visuel, et c'est le seul moment où il
// a quelque chose à montrer : quatre semaines tenues. Même famille que les
// autres cartes 1080×1920 — fond au choix (idée 02), ombre en double passe,
// Bebas et Montserrat, signature — et même sortie que le bilan.
//
// PURE. Les données de la carte, lues au moment de la validation.
function riteCarteDonnees(u,cycle,now){
  const t=(typeof now==='number')?now:Date.now();
  const n=Number(cycle)||0;
  const c=riteContenu(u,t);
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>=c.depuis&&s.date<=c.jusqua);
  // Prévues : le quota du programme sur quatre semaines ; sans programme,
  // on ne l'invente pas.
  let prevues=0; try{ prevues=_creneauxPrevus(u)*(RITE_JOURS/7); }catch(e){ prevues=0; }
  const faites=c.seances;
  const taux=prevues>0?Math.min(100,Math.round(faites/prevues*100)):null;
  const tonnage=ses.reduce((a,s)=>a+(Number(s.volume)||0),0);
  let eq=null; try{ eq=equivalentTonnage(tonnage); }catch(e){ eq=null; }
  let groupes=null; try{ groupes=muscDonnees(ses,{user:u,semaines:RITE_JOURS/7}).groupes; }catch(e){ groupes=null; }
  // Le nom du cycle qui se termine : celui que le coach lui a donné au rite
  // précédent, sinon son numéro. Le suivant : riteNomPeriode, comme l'écran.
  const r=((u&&u.rites)||[]).find(x=>x&&Number(x.cycle)===n-1&&x.nom);
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  return {cycle:n,nom:r?String(r.nom):('Cycle '+n),prochain:riteNomPeriode(u,n),
    jours:RITE_JOURS,faites,prevues,taux,records:(c.records||[]).length,
    tonnage,equivalent:eq,groupes,genre:(()=>{ try{ return woGenreAvatar(u); }catch(e){ return 'h'; } })(),
    signature:sig};
}
/**
 * Le visuel 1080×1920. `resMuscles` : les silhouettes chargées
 * (chargerSilhouettes) — sans elles, la carte se passe de la heatmap et
 * remonte le reste.
 */
function _dessinerCarteCycle(d,fond,resMuscles,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const rouge=f==='rouge';
  const accent=rouge?'#ffffff':ROUGE_MARQUE;
  g.textAlign='center'; g.textBaseline='alphabetic';
  // CYCLE N TERMINÉ
  o.ombre(true); g.fillStyle='#fff';
  const titre='CYCLE '+d.cycle+' TERMINÉ';
  const ts=o.ajuste(titre,'700',post?118:150,BEBAS,LARG,70);
  g.font='700 '+ts+'px '+BEBAS; o.ecrire(titre,cx,post?130:230);
  // Le nom, s'il dit autre chose que le numéro, et les 28 jours.
  let y=post?190:300;
  if(d.nom&&d.nom!=='Cycle '+d.cycle){
    g.fillStyle='rgba(255,255,255,.92)';
    const ns=o.ajuste(d.nom,'700',44,MONT,LARG,22);
    g.font='700 '+ns+'px '+MONT; o.ecrire(d.nom,cx,y); y+=58;
  }
  g.fillStyle=accent; g.font='800 32px '+MONT;
  o.ecrireEspace(d.jours+' JOURS',cx,y,8,true);
  o.ombre(false);
  // L'ANNEAU : le taux de complétion. Sans programme, le nombre de séances
  // seul, au centre, sans arc.
  // En post, l'anneau rapetisse et remonte : la heatmap garde sa place.
  const ry=y+(post?180:250), R=post?128:175;
  g.save();
  g.lineCap='round'; g.lineWidth=34;
  g.strokeStyle='rgba(255,255,255,.14)';
  g.beginPath(); g.arc(cx,ry,R,0,Math.PI*2); g.stroke();
  if(d.taux!=null&&d.taux>0){
    g.strokeStyle=accent;
    g.shadowColor=rouge?'rgba(255,255,255,.6)':'rgba(224,32,32,.8)'; g.shadowBlur=24;
    g.beginPath(); g.arc(cx,ry,R,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(1,d.taux/100)); g.stroke();
  }
  g.restore();
  o.ombre(true); g.fillStyle='#fff';
  const centre=d.taux!=null?(d.taux+' %'):String(d.faites);
  g.font='700 '+(post?100:130)+'px '+BEBAS; o.ecrire(centre,cx,ry+(post?30:40));
  g.fillStyle='rgba(255,255,255,.85)'; g.font='800 24px '+MONT;
  o.ecrireEspace(d.taux!=null?'COMPLÉTION':'SÉANCES',cx,ry+(post?68:86),5,true);
  // Les trois chiffres.
  y=ry+R+(post?96:120);
  const t=_wrTonnage(d.tonnage);
  const chiffres=[
    {v:d.prevues>0?(d.faites+'/'+Math.round(d.prevues)):String(d.faites),l:'SÉANCES'},
    {v:String(d.records),l:d.records>1?'RECORDS':'RECORD'},
    {v:_wrNb(t.v,t.dec)+(t.u==='KG'?' KG':' T'),l:'TONNAGE'}];
  const cw=LARG/3;
  chiffres.forEach((c,i)=>{
    const x=M+cw*i+cw/2;
    g.fillStyle='#fff';
    const vs=o.ajuste(c.v,'700',post?80:96,BEBAS,cw-16,44);
    g.font='700 '+vs+'px '+BEBAS; o.ecrire(c.v,x,y);
    g.fillStyle=accent; g.font='800 22px '+MONT; o.ecrireEspace(c.l,x,y+40,4,true);
  });
  y+=post?80:90;
  if(d.equivalent){
    const e='= '+d.equivalent.texte.toUpperCase()+' '+d.equivalent.emoji;
    g.fillStyle='#fff';
    const es=o.ajuste(e,'800',34,MONT,LARG,20);
    g.font='800 '+es+'px '+MONT; o.ecrire(e,cx,y); y+=30;
  }
  o.ombre(false);
  // LA HEATMAP MUSCULAIRE (idée 07), si les silhouettes sont là.
  const basTexte=H-(post?186:250);
  if(resMuscles&&d.groupes){
    const HM=Math.max(200,basTexte-40-(y+20));
    const vs=['face','dos'].map(v=>_muscPeindreVue(resMuscles[v],d.groupes,_recGraine('cycle'+d.cycle+v)));
    const ws=vs.map(v=>v.w*HM/v.h), gap=24, tot=ws[0]+ws[1]+gap;
    let x=cx-tot/2;
    vs.forEach((v,i)=>{ _muscPoser(g,v,x,y+20,ws[i],HM,1); x+=ws[i]+gap; });
  }
  // « Prochain chapitre : … »
  o.ombre(true);
  g.fillStyle=accent; g.font='800 26px '+MONT;
  o.ecrireEspace('PROCHAIN CHAPITRE',cx,basTexte,6,true);
  g.fillStyle='#fff';
  const ps=o.ajuste(String(d.prochain||''),'700',64,BEBAS,LARG,30);
  g.font='700 '+ps+'px '+BEBAS; o.ecrire(String(d.prochain||''),cx,basTexte+66);
  _recSignature(g,o,String(d.signature||''),H-(post?42:90),LARG);
  o.ombre(false);
  return cv;
}
// L'écran qui suit « Enregistrer et repartir » : le cycle est noté, et on
// propose de le partager. Il REMPLACE la feuille du rite (même modal-overlay :
// Échap et le voile la ferment).
let _riteCarte=null;
function _riteAfficherFin(d){
  _riteCarte=d;
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Cycle terminé" class="rite-fin">'
  +'<div class="rite-fin-sur">'+d.jours+' jours</div>'
  +'<h2>Cycle '+d.cycle+' terminé</h2>'
  +'<p>Nouveau cycle noté. Prochain chapitre : <b>'+escapeHtml(d.prochain)+'</b>.</p>'
  +_htmlVisuelFonds('rite-fonds')
  +'<button type="button" class="btn btn-red" onclick="partagerCycle(this)">'+icon('share',16)+' <span>Partager mon cycle</span></button>'
  +'<button type="button" class="btn btn-outline" style="margin-top:8px" onclick="closeModal()">Fermer</button>'
  +'</div></div>');
  const monter=res=>{ try{ monterSelecteurFond('rite-fonds',f=>_dessinerCarteCycle(_riteCarte||d,f,res||null),null); }catch(e){} };
  monter(null);
  // Les silhouettes arrivent : les vignettes se repeignent avec la heatmap.
  try{ chargerSilhouettes(d.genre).then(r=>{ if(document.getElementById('rite-fonds')) monter(r); }).catch(()=>{}); }catch(e){}
}
// MÊME SORTIE QUE LE BILAN : partage natif, sinon téléchargement ; les deux
// copient le lien perso (_storyCopierLien).
function partagerCycle(btn){
  const d=_riteCarte; if(!d||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-cycle',fond);
  const res=_muscPret(d.genre);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerCarteCycle(d,fond,res),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerCarteCycle(d,fond,res),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent='Partager mon cycle'; },2000); }
  return ok;
}
// ══ LES PALIERS DE SÉRIE : 4, 8, 12, 26, 52 SEMAINES ══════════════════════
//
// Même file que les badges : un palier atteint en même temps qu'un badge
// (4 semaines = INARRÊTABLE I) passe D'ABORD — updateStreak tourne avant
// majBadges —, puis le badge, sur le même écran plein.
function _celebrerSerie(n){
  const v=Number(n)||0; if(!v) return;
  _bdgFile.push({serie:v});
  _bdgPlanifier();
}
let _bdgMinuterie=null;
function _bdgPlanifier(){
  if(_bdgMinuterie||document.getElementById('bdg-ecran')) return;
  _bdgMinuterie=setTimeout(()=>{ _bdgMinuterie=null; _bdgSuivant(); },arcReduit()?0:900);
}
// PURE. Les données de la carte de série.
function serieCarteDonnees(u,n){
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  return {semaines:Math.max(0,Number(n)||0),jokers:Math.max(0,Number(u&&u.streakJokersUtilises)||0),signature:sig};
}
let _serieCourante=null;
// L'écran : le grand chiffre, frappé par la foudre, et les semaines en carrés.
function _serieEcran(n,reste){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const d=serieCarteDonnees(u,n);
  _serieCourante=d;
  const z=_bdgCouche(
    '<div class="bdg-ecran-txt serie-ecran">'
    +'<div class="bdg-ecran-sur">PALIER DE SÉRIE</div>'
    +'<div class="serie-chiffre" id="serie-chiffre">'+d.semaines+'</div>'
    +'<div class="serie-lib">SEMAINES D’AFFILÉE</div>'
    +'<div class="serie-cal" aria-hidden="true">'+Array.from({length:d.semaines},()=>'<i></i>').join('')+'</div>'
    +(d.jokers?'<p class="bdg-ecran-cond">Dont '+d.jokers+' semaine'+(d.jokers>1?'s':'')+' sauvée'+(d.jokers>1?'s':'')+' par un joker</p>':'')
    +_htmlVisuelFonds('serie-fonds')
    +'<button type="button" class="btn btn-red bdg-ecran-part" onclick="partagerSerie(this)">'+icon('share',16)+' <span>Partager</span></button>'
    +htmlBoutonInviter()
    +'<button type="button" class="btn btn-outline btn-sm bdg-ecran-tard" onclick="bdgPlusTard()">'
      +(reste||_bdgRecap.length?'Suivant':'Plus tard')+'</button>'
    +'</div>',
    d.semaines+' semaines d’affilée');
  try{ monterSelecteurFond('serie-fonds',f=>_dessinerCarteSerie(_serieCourante||d,f),null); }catch(e){}
  const ch=z.querySelector('#serie-chiffre');
  if(arcReduit()){ try{ _bdgFoudre(ch,{son:false}); }catch(e){} }
  else{
    _animer(z,[{opacity:0},{opacity:1}],{duration:120,easing:'linear'});
    try{ _bdgFoudre(ch,{eclairs:n>=26?3:2,conteneur:z}); }catch(e){}
    _animer(ch,[{transform:'scale(.3)',opacity:0},{transform:'scale(1.12)',opacity:1,offset:.6},{transform:'scale(1)',opacity:1}],
      {duration:700,delay:40,easing:ARC.snap,fill:'backwards'});
    z.querySelectorAll('.serie-cal i').forEach((c,i)=>_animer(c,[{opacity:0,transform:'scale(.2)'},{opacity:1,transform:'scale(1)'}],
      {duration:220,delay:500+Math.min(i,52)*18,easing:ARC.discharge,fill:'backwards'}));
  }
  try{ arcHaptique('succes'); }catch(e){}
  try{ const p=z.querySelector('.bdg-ecran-part'); if(p) p.focus({preventScroll:true}); }catch(e){}
}
/**
 * LA CARTE 1080×1920 : le grand chiffre, « SEMAINES D'AFFILÉE », le
 * calendrier des semaines en carrés rouges, la signature. Fond au choix.
 */
function _dessinerCarteSerie(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const rouge=f==='rouge';
  const n=Math.max(0,d.semaines|0);
  // LE CALENDRIER MONTRE UN AN AU PLUS : 52 cases, les dernières semaines. Le
  // grand chiffre, lui, dit tout (au-delà, les cases sortaient de l'image).
  const nc=Math.min(n,52);
  g.textAlign='center'; g.textBaseline='alphabetic';
  // LA MISE EN PAGE SE CALCULE D'ABORD : le bloc entier est centré entre le
  // haut et la signature, quel que soit le nombre de semaines.
  const cols=nc<=4?4:(nc<=8?4:(nc<=12?6:13));
  const rows=Math.max(1,Math.ceil(nc/cols));
  const gap=nc>26?10:16;
  // En post, le chiffre et les cases rapetissent : le bloc tient entre le
  // haut et la signature, même à 52 semaines.
  const CS=post?(n<=12?400:300):560;
  g.font='700 '+CS+'px '+BEBAS;
  const cs=o.ajuste(String(n),'700',CS,BEBAS,LARG,160);
  const cote=Math.max(16,Math.min(nc<=12?(post?100:130):(nc<=26?(post?54:66):(post?46:54)),Math.floor((LARG-gap*(cols-1))/cols)));
  const hCal=rows*(cote+gap)-gap;
  const HB=60+cs*0.82+90+70+hCal+(d.jokers?70:0);
  let y=Math.max(post?60:150,Math.round((H-(post?140:200)-HB)/2));
  o.ombre(true);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE; g.font='800 34px '+MONT;
  o.ecrireEspace('SÉRIE EN COURS',cx,y+34,10,true);
  // LE GRAND CHIFFRE.
  g.fillStyle='#fff';
  g.font='700 '+cs+'px '+BEBAS; o.ecrire(String(n),cx,y+60+cs*0.82);
  y+=60+cs*0.82+90;
  const lib='SEMAINES D’AFFILÉE';
  const ls=o.ajusteEspace(lib,'800',58,MONT,8,LARG,28);
  g.font='800 '+ls+'px '+MONT; o.ecrireEspace(lib,cx,y,8,true);
  o.ombre(false);
  // LE CALENDRIER : une case par semaine, en lignes de 13 (un trimestre) au
  // plus. Tout est rouge — ce sont des semaines tenues ; la dernière brille.
  y+=70;
  const larg=cols*cote+(cols-1)*gap;
  const x0=cx-larg/2;
  for(let i=0;i<nc;i++){
    const c=i%cols, r=Math.floor(i/cols);
    const x=x0+c*(cote+gap), yy=y+r*(cote+gap);
    g.save();
    const dernier=i===nc-1;
    g.fillStyle=rouge?(dernier?'#fff':'rgba(255,255,255,.82)'):(dernier?'#ff3b3b':ROUGE_MARQUE);
    g.shadowColor=rouge?'rgba(255,255,255,.5)':'rgba(224,32,32,.85)'; g.shadowBlur=dernier?26:10;
    g.fillRect(x,yy,cote,cote);
    g.restore();
  }
  y+=hCal+60;
  if(d.jokers){
    o.ombre(true); g.fillStyle='rgba(255,255,255,.88)'; g.font='700 32px '+MONT;
    o.ecrire('dont '+d.jokers+' sauvée'+(d.jokers>1?'s':'')+' par un joker 🛡',cx,y);
    o.ombre(false);
  }
  _recSignature(g,o,String(d.signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
function partagerSerie(btn){
  const d=_serieCourante; if(!d||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-serie',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerCarteSerie(d,fond),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerCarteSerie(d,fond),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent='Partager'; },2000); }
  return ok;
}
// ══ LES VOLTS (XP) ET LES DIX RANGS ═══════════════════════════════════════
//
// ⚠ u.xp EST UN RÉSULTAT, PAS UN COMPTEUR. xpCalcul le recalcule en entier
// depuis ce que le dossier contient déjà — séances, records, bilans, journal,
// sommeil, semaines validées, badges — et ne l'incrémente jamais. Aucune
// migration : un athlète ancien a ses volts dès la mise à jour, et changer un
// barème ou un seuil ci-dessous recalcule tout le monde, sans rien réécrire.
// u.xp n'est qu'une copie, pour que le coach lise le rang sans refaire le
// calcul (Canal) — l'athlète, lui, recalcule toujours.
//
// Le seul morceau qui ne se recalcule pas : le sommeil de plus de 180 jours,
// que saveSleep retire du journal. Ses volts sont mis de côté à la purge
// (u.xpArchive.sommeil) au lieu de disparaître.
const XP_ACTIONS=Object.freeze({
  seance:100,          // séance terminée
  complete:30,         // … et complète (toutes les séries prévues faites)
  record:50,           // par record de charge battu
  bilan:80,
  nutrition:15,        // journée de journal « remplie » (XP_NUTRITION_MIN aliments)
  sommeil:5,           // nuit saisie
  semaine:150,         // semaine validée (le quota de séances atteint)
  badge:40,            // badge débloqué…
  badgePalier4:200,    // … sauf un palier IV
  checkin:10,          // check-in du matin (dans le plafond du jour)
  // LOT N2 (29/09/2026) : la journée DANS SA CIBLE (kcal à ±7 %, protéines à
  // 95 % au moins), une fois par jour, dans le plafond. La saisie seule reste
  // à 15 (nutrition) : c'est la cible tenue qui vaut davantage.
  cible:40,
  // LOT N4 : la SEMAINE D'ASSIETTE (5 jours tenus du lundi au dimanche), un
  // jalon hors plafond comme la semaine d'entraînement, mais à MOITIÉ : les
  // cinq jours ont déjà rapporté 5 × 40 V, et l'application reste d'abord un
  // outil d'entraînement (une semaine d'assiette parfaite : 5 × 40 + 75 = 275 V,
  // une semaine de trois séances complètes : 3 × 130 + 150 = 540 V).
  semaineAssiette:75,
  // LE RETOUR (02/10/2026) : la 1re séance après 14 jours ou plus sans séance
  // (RETOUR_COMBAT_J), une fois par période d'absence. Un jalon, hors plafond.
  retour:50
});
const XP_NUTRITION_MIN=3;
// ══ LOT N2 : LA CIBLE TENUE ═══════════════════════════════════════════════
// ⚠ EN DESSOUS COMPTE COMME UN ÉCART. Une journée à 1 200 kcal pour une cible
//   de 2 200 n'est pas une réussite : c'est le début d'une spirale, et une
//   application qui la récompense fabrique un trouble. Même doctrine que le
//   plancher calorique. La fourchette est donc SYMÉTRIQUE : ni au-dessus, ni
//   en dessous.
const CIBLE_KCAL_TOLERANCE=0.07;
const CIBLE_PROT_MIN=0.95;
// PURE. `totaux` : {kcal, p} de la journée ; `cibles` : {kcal, p} du jour.
// Les bornes sont INCLUSES, comparées au dixième (les totaux additionnent des
// décimales : 0,1 + 0,2 ne doit pas faire rater une borne exacte).
function cibleTenue(totaux,cibles){
  const non={kcal:false,prot:false,tenue:false};
  const c=cibles||{}, t=totaux||{};
  const ck=Number(c.kcal), cp=Number(c.p), tk=Number(t.kcal), tp=Number(t.p);
  if(!(ck>0)||!isFinite(tk)) return non;
  const d=v=>Math.round(v*10)/10;
  const kcal=d(Math.abs(tk-ck))<=d(ck*CIBLE_KCAL_TOLERANCE);
  const prot=(cp>0&&isFinite(tp))?d(tp)>=d(cp*CIBLE_PROT_MIN):false;
  return {kcal,prot,tenue:kcal&&prot};
}
// La journée d'un dossier : ses totaux au journal, et SA cible du jour (jour ON
// ou OFF selon ses séances prévues, cycle compris), par le même chemin que
// l'écart au journal (adherence). Rien au journal : rien de tenu.
function cibleTenueJour(u,j){
  const nut=(u&&u.nutrition)||{};
  const tot=journalTotalJour(nut.log||{},j);
  if(!tot.n||!nut.macros) return {kcal:false,prot:false,tenue:false};
  let c=null; try{ c=_getEffectiveMacros(nut,nutIsOnDay(j,u),j,u); }catch(e){ c=null; }
  return cibleTenue(tot,c);
}
// ══ LOT N4 : LA SÉRIE ET LES BADGES DE L'ASSIETTE (29/09/2026) ═════════════
// Un jour « tenu » est celui du lot N2 (cibleTenue : kcal à ±7 %, protéines à
// 95 % au moins). La série compte les jours tenus d'affilée.
//
// ⚠ UN JOUR NON TENU N'EST PAS UNE RUPTURE. Un seul par semaine glissante met
//   la série en PAUSE (il ne compte pas, il ne casse rien) : un repas de
//   famille ne doit pas remettre un mois à zéro. Deux jours non tenus à moins
//   de sept jours l'un de l'autre la rompent. Un jour sans journal est un jour
//   non tenu.
// ⚠ LE JOUR EN COURS ne compte que s'il est DÉJÀ tenu : sinon la série
//   s'arrête à hier, et la journée d'aujourd'hui peut encore la prolonger.
// ⚠ AUCUN BADGE NI AUCUN VOLT SUR UN RÉSULTAT CORPOREL. On récompense une
//   journée tenue, jamais un déficit ni un chiffre de balance. Sous aTCA, ni
//   série, ni badge, ni semaine d'assiette (même garde que le point du lot N1).
const ASSIETTE_PAUSE_JOURS=7;
const ASSIETTE_SEMAINE_JOURS=5;
// PURE. Les jours du journal jusqu'à « jusqua » (inclus) : {jour: {tenue, prot}}.
// « cibles » : la cible {kcal, p}, ou une fonction jour → cible (jour ON ou OFF).
function joursAssiette(log,cibles,jusqua){
  const out={}, L=log||{};
  for(const j of Object.keys(L)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(j)||(jusqua&&j>jusqua)) continue;
    const tot=journalTotalJour(L,j);
    if(!tot.n) continue;
    let c=null; try{ c=(typeof cibles==='function')?cibles(j):cibles; }catch(e){ c=null; }
    const r=cibleTenue(tot,c);
    out[j]={tenue:r.tenue,prot:r.prot};
  }
  return out;
}
// PURE. La série au soir de chaque jour, du premier jour tenu jusqu'à « fin » :
// [[jour, série], …]. Les jours comptés en jours de CALENDRIER (_jourPlus,
// _joursEntre) : un changement d'heure ne crée ni ne mange aucun jour.
// Entre deux jours non tenus, tout est tenu : quand le second rompt la série,
// elle repart donc des jours tenus qui les séparent.
function _assietteSeries(tenus,fin){
  const t=tenus||{}, ok=j=>!!(t[j]&&t[j].tenue);
  const premiers=Object.keys(t).filter(j=>ok(j)&&(!fin||j<=fin)).sort();
  const out=[];
  if(!premiers.length) return out;
  // Avant le premier jour tenu, rien n'est tenu : la veille est un écart, et
  // l'avant-veille aussi, la série part donc de zéro.
  let j=premiers[0], n=0, ecart=_jourPlus(j,-1);
  for(let i=0;i<5000&&j<=fin;i++){
    if(ok(j)) n++;
    else{
      const d=_joursEntre(ecart,j);
      if(d<ASSIETTE_PAUSE_JOURS) n=Math.max(0,d-1);
      ecart=j;
    }
    out.push([j,n]);
    j=_jourPlus(j,1);
  }
  return out;
}
// PURE. LA SÉRIE DE L'ASSIETTE : les jours tenus d'affilée, jusqu'à hier, ou
// jusqu'à aujourd'hui si aujourd'hui est déjà tenu.
function serieAssiette(log,cibles,maintenant){
  return serieAssietteDetail(log,cibles,maintenant).n;
}
// PURE. La même, avec ce que l'affichage dit : « pause », le dernier jour
// compté (hier) n'était pas tenu mais la série tient.
function serieAssietteDetail(log,cibles,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const auj=localISODate(new Date(t));
  const tenus=joursAssiette(log,cibles,auj);
  const dep=(tenus[auj]&&tenus[auj].tenue)?auj:_jourPlus(auj,-1);
  const l=_assietteSeries(tenus,dep);
  const der=l.length?l[l.length-1]:null;
  const n=(der&&der[0]===dep)?der[1]:0;
  return {n,pause:n>0&&!(tenus[dep]&&tenus[dep].tenue),aujourdhui:dep===auj};
}
// La cible d'un jour pour un dossier : jour ON ou OFF, cycle compris (le
// chemin de cibleTenueJour).
function _assietteCibles(u){
  const nut=(u&&u.nutrition)||{};
  return j=>_getEffectiveMacros(nut,nutIsOnDay(j,u),j,u);
}
// La série d'un dossier, maintenant. Zéro sans cible, et sous aTCA.
function serieAssietteDe(u,maintenant){
  const nut=(u&&u.nutrition)||{};
  if(!u||!nut.macros) return {n:0,pause:false,aujourdhui:false};
  try{ if(aTCA(u)) return {n:0,pause:false,aujourdhui:false}; }catch(e){}
  return serieAssietteDetail(nut.log||{},_assietteCibles(u),maintenant);
}
// PURE (dossier donné). LES FAITS DE L'ASSIETTE pour _badgesFaits, chaque
// liste datée comme le journal (20 h du jour, jamais après « t ») :
//   jours    : les jours tenus, dans l'ordre ;
//   prot     : les jours aux protéines atteintes ;
//   serie    : serie[n-1] = le jour où la série a atteint n pour la première fois ;
//   annee100 : le 100e jour tenu d'une même année civile ;
//   semaines : les semaines (lundi à dimanche) à 5 jours tenus, datées du 5e ;
//   tenus    : la table jour → {tenue, prot}, que xpCalcul relit pour la cible.
function _assietteFaits(u,t){
  const r={jours:[],prot:[],serie:[],annee100:0,semaines:[],tenus:{}};
  const nut=(u&&u.nutrition)||{};
  if(!u||!nut.macros) return r;
  const auj=localISODate(new Date(t));
  let tenus={}; try{ tenus=joursAssiette(nut.log||{},_assietteCibles(u),auj); }catch(e){ tenus={}; }
  r.tenus=tenus;
  let tca=false; try{ tca=aTCA(u); }catch(e){ tca=false; }
  if(tca) return r;
  const at=j=>{ const [a,m,d]=j.split('-').map(Number); return Math.min(new Date(a,m-1,d,20).getTime(),t); };
  const parAn={}, parSem={};
  for(const j of Object.keys(tenus).sort()){
    if(tenus[j].prot) r.prot.push(at(j));
    if(!tenus[j].tenue) continue;
    r.jours.push(at(j));
    const a=j.slice(0,4); parAn[a]=(parAn[a]||0)+1;
    if(parAn[a]===100&&!r.annee100) r.annee100=at(j);
    const [y,m,d]=j.split('-').map(Number);
    let l=''; try{ l=localISODate(_lundiDe(new Date(y,m-1,d,12))); }catch(e){ l=''; }
    if(!l) continue;
    parSem[l]=(parSem[l]||0)+1;
    if(parSem[l]===ASSIETTE_SEMAINE_JOURS) r.semaines.push(at(j));
  }
  r.semaines.sort((a,b)=>a-b);
  let max=0;
  for(const [j,n] of _assietteSeries(tenus,auj)) while(n>max){ max++; r.serie.push(at(j)); }
  return r;
}
// ── LE CADRE DE L'ACCUEIL, JUMEAU DE CELUI DES SEMAINES ────────────────
// PURE. Ce que le cadre affiche : le compte, son libellé, la ligne du dessous.
function affichageSerieAssiette(d){
  const n=Math.max(0,Math.round(Number(d&&d.n)||0));
  if(n>0) return {valeur:n,libelle:n>1?'JOURS':'JOUR',sous:(d&&d.pause)?'En pause':'Dans ta cible',nul:false};
  return {valeur:null,libelle:'JOUR 1',sous:'Vise ta cible',nul:true};
}
// Sous le cadre des semaines, même forme, même taille. Seulement avec une
// cible alimentaire, jamais pour un coach, jamais sous aTCA : sans cible, il
// n'y a rien à tenir, et la bande garde sa hauteur d'origine.
function _rendreSerieAssiette(u){
  const tete=document.querySelector('#s-client-home .clh-tete');
  if(!tete) return;
  let el=document.getElementById('clh-assiette');
  const nut=(u&&u.nutrition)||{};
  let montrer=!!(u&&u.role!=='coach'&&nut.macros);
  try{ if(montrer&&aTCA(u)) montrer=false; }catch(e){}
  if(!montrer){ if(el) el.hidden=true; tete.removeAttribute('data-assiette'); return; }
  if(!el){
    const dial=document.querySelector('#clh-streak .sk-dial');
    el=document.createElement('div');
    el.id='clh-assiette'; el.className='sk-badge';
    el.setAttribute('role','button'); el.tabIndex=0; el.setAttribute('aria-haspopup','dialog');
    el.setAttribute('onclick',"rcInfoOuvrir('assiette')");
    el.setAttribute('onkeydown',"if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}");
    el.innerHTML='<div class="sk-cadre"><div class="sk-dial"></div>'
      +'<div class="sk-chiffres"><span id="clh-assiette-val"></span><span class="sk-lbl"></span>'
      +'<span class="sk-reste" id="clh-assiette-reste"></span><span class="sk-date" id="clh-assiette-sous"></span></div>'
      +'<span class="sk-chev" aria-hidden="true"><svg viewBox="0 0 16 24"><polyline points="4 4 12 12 4 20" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>';
    const zd=el.querySelector('.sk-dial');
    if(dial) zd.innerHTML=dial.innerHTML;
    // L'ASSIETTE ET LES COUVERTS à la place de la flamme, même trait.
    const ico=zd.querySelector('.sk-ico');
    const ic='<svg class="sk-ico" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'
      +'<circle cx="16" cy="17" r="7.5"/><circle cx="16" cy="17" r="4"/><path d="M4.5 6v5.5a2 2 0 0 0 2 2M8.5 6v5.5a2 2 0 0 1-2 2M6.5 6v22"/><path d="M27.5 28V6c-2.2 1.2-3.2 4-3.2 7.5 0 1.6.9 2.5 3.2 2.5"/></g></svg>';
    if(ico) ico.outerHTML=ic; else zd.insertAdjacentHTML('beforeend',ic);
    const st=document.getElementById('clh-streak');
    if(st&&st.parentNode===tete) st.after(el); else tete.appendChild(el);
  }
  el.hidden=false;
  tete.setAttribute('data-assiette','');
  let a;
  try{ a=affichageSerieAssiette(serieAssietteDe(u)); }catch(e){ a=affichageSerieAssiette(null); }
  const val=document.getElementById('clh-assiette-val');
  const lbl=el.querySelector('.sk-lbl');
  const res=document.getElementById('clh-assiette-reste');
  const sous=document.getElementById('clh-assiette-sous');
  const zone=el.querySelector('.sk-chiffres');
  if(lbl) lbl.textContent=a.libelle;
  if(res) res.textContent=a.nul?a.sous:'';
  if(sous) sous.textContent=a.nul?'':a.sous;
  if(zone) zone.toggleAttribute('data-nul',a.nul);
  el.setAttribute('aria-label',(a.valeur!==null?a.valeur+' jour'+(a.valeur>1?'s':'')+' dans ta cible'
    +(a.sous==='En pause'?', en pause':''):'Jour 1, vise ta cible')+'. Voir ce qui est compté');
  if(val){
    if(a.valeur===null){ val.textContent=''; try{ delete val.dataset.valeur; }catch(e){} }
    else{ try{ arcCompteur(val,a.valeur,{duree:ARC.release}); }catch(e){ val.textContent=String(a.valeur); } }
  }
}
// LE PLAFOND ANTI-TRICHE, par jour (jour local). Il porte sur tout ce qui se
// répète à volonté — séances, records, bilans, journal, sommeil. Une grosse
// vraie journée y tient (séance complète à trois records + bilan + journal +
// nuit = 380) ; dix séances saisies en une soirée, non. Les jalons — semaine
// validée, badge — n'y sont pas soumis : ils ne se répètent pas.
const XP_PLAFOND_JOUR=400;
// LES RANGS ET LEURS SEUILS, en volts cumulés. C'est LA table à retoucher.
// Calibrée (01/10/2026) sur TROIS athlètes, que le test « Volts : la courbe
// tient le calendrier » rejoue :
//  1. L'ATHLÈTE RÉGULIER : 3 séances par semaine de 5 exercices (complètes à
//     85 %, un bilan toutes les deux semaines, un record par exercice avec une
//     chance de 45 % au début qui fond vers 6 %, badges compris), SANS journal
//     ni sommeil : IMPULSION ~2 semaines, VOLTAGE ~1 mois, MACHINE ~2 mois,
//     ÉLITE ~4 mois, SURTENSION ~6-7 mois, MONSTRE ~10 mois, FOUDRE ~14 mois,
//     TITAN ~19 mois, LÉGENDE ~26-29 mois (±25 % à chaque rang) ;
//  2. « TOUT REMPLIR » : le même, plus le journal chaque jour (la cible tenue
//     5 jours sur 7), le check-in et la nuit chaque jour. Hors entraînement,
//     cela rapporte ~485 V par semaine (journal 105, cible 200, check-in 70,
//     nuit 35, semaine d'assiette 75) : AU PLUS 40 % des volts d'entraînement
//     de la semaine, ou 150 V (XP_HORS_PART). LÉGENDE pas avant 20 mois ;
//  3. « NUTRITION SEULE », aucune séance : le plancher de 150 V par semaine,
//     jamais au-delà de VOLTAGE en six mois.
// Ce qui n'est PAS borné par semaine : les jalons rares (badges, bilans, le
// parcours), et le plafond du jour (XP_PLAFOND_JOUR) reste au-dessus de tout.
// ══ LE PARCOURS DE DÉMARRAGE « MISE SOUS TENSION » (28/09/2026) ══════════
//
// Les premiers paliers de badges demandent dix séances ou cinq records : un
// nouveau ne débloquait presque rien la première semaine, celle où tout se
// joue. Sept étapes, chacune avec ses volts, à faire dans les 14 premiers
// jours ; toutes faites, le badge unique SOUS TENSION (écran plein, carte
// partageable).
//
// ⚠ « SOUS TENSION » EXISTE DÉJÀ DANS L'APP : le TEMPS SOUS TENSION d'une
//   série (champ `tut`, TUT_MIN_S…), et le titre de la carte des charges
//   (« Dos et jambes sous tension »). Tout ce qui appartient au parcours porte
//   donc le préfixe PARCOURS / parcours_ (u.parcours, parcours_sous_tension,
//   parcours_j21) et le libellé « Mise sous tension » ; seul le NOM du badge
//   dit « SOUS TENSION ». Le test « Parcours : aucun libellé ne se mélange »
//   le vérifie.
//
// LES VOLTS DU PARCOURS ne comptent pas dans le plafond du jour et ne se
// gagnent qu'une fois : l'étape est DATÉE dans u.parcours.etapes à sa
// première réussite, et xpCalcul les ajoute à part (cat.parcours). La 1re
// séance et la 1re semaine validée rapportent déjà leurs volts ordinaires
// (130 V et 150 V) : leur étape n'en ajoute pas.
//
// LES COMPTES EXISTANTS (créés avant PARCOURS_DEPUIS) : parcours considéré
// comme terminé, sans carte, sans volts, sans badge — pas de rétro-célébration.
//
// L'ESSAI : au 21e jour de l'essai, si le parcours n'est pas fini, le serveur
// léger envoie « encore N étapes » (push de type serie). L'app tient à jour
// /parcours_j21/<jour J21>/<moi> = le nombre d'étapes restantes ; le Worker
// ne lit que la liste du jour.
const PARCOURS_DEPUIS=Date.parse('2026-09-28T00:00:00+02:00');
const PARCOURS_JOURS=14;
const PARCOURS_BADGE='parcours_sous_tension';
const PARCOURS_DEMARRAGE=Object.freeze([
  Object.freeze({cle:'premiere_seance',lib:'Termine ta 1re séance',volts:0,test:(u,f)=>f.seances.length>=1}),
  Object.freeze({cle:'premier_record',lib:'Bats un 1er record',volts:50,test:(u,f)=>f.records.length>=1}),
  Object.freeze({cle:'profil',lib:'Complète ton profil : une photo ou un pseudo',volts:50,
    test:u=>!!(u&&(u.athletePhoto||String(u.pseudo||'').trim())),action:'openAthleteProfile()',bouton:'Compléter mon profil'}),
  Object.freeze({cle:'notifications',lib:'Active les notifications',volts:50,
    test:(u,f,env)=>!!(env&&env.notif),action:'parcoursActiverNotifs(this)',bouton:'Activer'}),
  Object.freeze({cle:'deuxieme_seance',lib:'Fais ta 2e séance',volts:50,test:(u,f)=>f.seances.length>=2}),
  Object.freeze({cle:'premiere_semaine',lib:'Valide ta 1re semaine',volts:0,test:(u,f)=>f.semaines.length>=1}),
  Object.freeze({cle:'inviter',lib:'Invite un pote',volts:100,parrainage:true,
    test:u=>!!(u&&u.parcours&&u.parcours.invite)||Number(u&&u.parrainage&&u.parrainage.inscrits)>0,
    action:'inviterUnPote(this)',bouton:'Inviter un pote'})
]);
// ══ LOT C1 : L'ACCUEIL D'UN ATHLÈTE COACHÉ (29/09/2026) ═══════════════════
//
// Un second jeu d'étapes, SUR LE MÊME MOTEUR que « Mise sous tension »
// (majParcours, parcoursEtat, parcoursVolts, la carte de l'accueil) : les
// étapes se datent une fois, leurs volts sont hors plafond et comptés une fois.
// Le jeu est choisi à la naissance du parcours (u.parcours.jeu = 'coache')
// quand l'athlète a déjà un coach, et seulement pour un parcours né après la
// mise en ligne : qui a commencé « Mise sous tension » le garde.
//
// ⚠ AUCUNE ÉTAPE NE DÉPEND DU COACH SANS LE DIRE. « Ton programme est prêt »
//   n'est une case que quand le programme existe (hasProgram) ; avant, la
//   carte dit « Ton coach prépare ton programme », sans bouton ni volts.
// ⚠ LES RELANCES (bilan à J2, programme non lu à J5, première séance à J6)
//   partent du serveur (travail « accueil » de planif.js), au plafond commun
//   d'UNE poussée par jour et par athlète, et une seule fois par étape
//   (accueil_trace). Le bilan et la séance sont déposés par l'app de
//   l'athlète ; le programme, par le coach qui le publie, parce que lui seul
//   sait qu'il existe.
// ⚠ LE COACH N'EST SOLLICITÉ QUE DEUX FOIS pendant les dix jours : « Programme
//   à écrire » dès le bilan de départ (le bilan s'ouvre au bon endroit), puis
//   « Premier point » à J7. « Nouveau bilan à lire » et « Jamais démarré » se
//   taisent pour lui pendant l'accueil.

const ACCUEIL_DEPUIS=Date.parse('2026-09-29T00:00:00+02:00');
const ACCUEIL_JOURS=10;
const ACCUEIL_RELANCES=Object.freeze([{etape:'bilan',jour:2},{etape:'programme',jour:5},{etape:'seance',jour:6}]);
const PARCOURS_COACHE=Object.freeze([
  Object.freeze({cle:'bilan_depart',lib:'Remplis ton bilan de départ : c’est lui qui permet à ton coach d’écrire ton programme',volts:100,
    test:u=>((u&&u.bilans)||[]).some(b=>b&&b.type==='depart'),action:'openBilan(\'depart\')',bouton:'Remplir mon bilan'}),
  Object.freeze({cle:'installation',lib:'Installe l’app sur ton téléphone',volts:50,
    test:(u,f,env)=>!!(env&&env.installe),action:'invInstallInviter()',bouton:'Installer'}),
  Object.freeze({cle:'creneaux',lib:'Choisis tes créneaux d’entraînement',volts:50,
    test:u=>((u&&u._woReminderDays)||[]).length>0,action:'_ouvrirJoursEntrainement()',bouton:'Choisir mes jours'}),
  Object.freeze({cle:'programme_lu',lib:'Ton programme est prêt : lis-le',volts:50,
    attente:'Ton coach prépare ton programme',
    test:u=>{ let h=false; try{ h=hasProgram(u); }catch(e){ h=false; } return h&&Number(u&&u.parcours&&u.parcours.programmeLu)>0; },
    pret:u=>{ try{ return hasProgram(u); }catch(e){ return false; } },
    action:'openSessionPicker()',bouton:'Voir mon programme'}),
  Object.freeze({cle:'premiere_seance',lib:'Fais ta première séance',volts:0,test:(u,f)=>f.seances.length>=1}),
  Object.freeze({cle:'premier_retour',lib:'Envoie ton premier retour à ton coach : un check-in, ou ton ressenti après une séance',volts:50,
    test:u=>((u&&u.sessions)||[]).some(s=>s&&s.metrics&&String(s.metrics.fatigue==null?'':s.metrics.fatigue).trim()!=='')
      ||Object.keys((u&&u.checkin)||{}).some(j=>{ try{ return checkinComplet(u.checkin[j]); }catch(e){ return false; } })})
]);
// PURE. Un parcours d'accueil coaché, et encore dans ses dix jours ?
function accueilCoacheActif(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const p=u&&u.parcours;
  return !!(p&&p.jeu==='coache'&&!p.existant&&t-(Number(p.debut)||t)<ACCUEIL_JOURS*864e5);
}
// PURE. Le jour d'accueil (1 à 10) d'un instant.
function accueilJour(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  return Math.max(1,Math.floor((t-(Number(u&&u.parcours&&u.parcours.debut)||t))/864e5)+1);
}
// PURE. Les relances à déposer par l'app de l'athlète : les étapes pas encore
// faites, à leur jour. Un athlète qui a tout fait le premier jour n'en dépose
// aucune. (Le programme, c'est le coach qui le dépose.)
function accueilRelancesAthlete(u){
  const p=u&&u.parcours;
  if(!p||p.jeu!=='coache'||p.existant||p.fini) return [];
  const et=p.etapes||{}, out=[];
  const debut=Number(p.debut)||0;
  for(const r of ACCUEIL_RELANCES){
    if(r.etape==='programme') continue;
    if(r.etape==='bilan'&&et.bilan_depart) continue;
    if(r.etape==='seance'&&et.premiere_seance) continue;
    out.push({etape:r.etape,jour:localISODate(new Date(debut+r.jour*864e5))});
  }
  return out;
}
// PURE. Le jour de la relance « programme non lu », déposée par le coach à la
// publication : J5, ou deux jours après la publication si elle est plus tardive.
function accueilJourProgramme(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const d=Number(u&&u.parcours&&u.parcours.debut)||t;
  return localISODate(new Date(Math.max(d+5*864e5,t+2*864e5)));
}
async function _accueilDeposer(cle,jour,etape){
  const r=await _fbJson('parcours_relances/'+jour+'/'+cle+'/'+etape,'PUT',true);
  return !!(r&&r.ok);
}
// L'app de l'athlète : une fois, à la naissance de l'accueil.
async function accueilEcrireRelances(u){
  if(!SERVEUR_LEGER||!u||!u.email||!u.parcours||u.parcours.jeu!=='coache'||u.parcours.relancesEcrites||!CLOUD.ok()) return false;
  const moi=String(u.email).replace(/\./g,',');
  const l=accueilRelancesAthlete(u);
  let ok=true;
  for(const x of l) ok=(await _accueilDeposer(moi,x.jour,x.etape))&&ok;
  if(ok){ u.parcours.relancesEcrites=Date.now(); try{ saveUser(); }catch(e){ rcErreurMuette('accueilEcrireRelances',e); } }
  return ok;
}
// Le coach publie : si l'athlète est dans son accueil et n'a pas lu son
// programme, la relance « programme » part à son jour.
async function accueilRelanceProgramme(a){
  if(!SERVEUR_LEGER||!a||!a.email||!accueilCoacheActif(a)||(a.parcours.etapes||{}).programme_lu) return false;
  const cle=String(a.email).replace(/\./g,',');
  return _accueilDeposer(cle,accueilJourProgramme(a),'programme');
}
// « Ton programme est prêt : lis-le » : l'ouverture du programme le marque.
function accueilProgrammeLu(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.parcours||u.parcours.jeu!=='coache'||u.parcours.programmeLu) return false;
  let h=false; try{ h=hasProgram(u); }catch(e){ h=false; }
  if(!h) return false;
  u.parcours.programmeLu=Date.now();
  try{ parcoursAvancer(); }catch(e){}
  return true;
}

// ── Les deux moments du coach, dans « À traiter » ─────────────────────────
// PURE. Les lignes d'accueil, et les athlètes dont on tait « Nouveau bilan à
// lire » et « Jamais démarré » pendant l'accueil.
function accueilLignesCoach(clients,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const prog=[], retour=[], silence=new Set();
  for(const c of (clients||[])){
    if(!c||c._fromCode||!accueilCoacheActif(c,t)) continue;
    silence.add(c.id);
    const depart=(c.bilans||[]).some(b=>b&&b.type==='depart');
    let h=false; try{ h=hasProgram(c); }catch(e){ h=false; }
    if(depart&&!h) prog.push(c);
    if(accueilJour(c,t)>=7) retour.push(c);
  }
  return {prog,retour,silence};
}
function accueilOuvrirBilanDepart(id){
  if(!id) return false;
  currentClientId=id;
  const c=(()=>{ try{ return getOwnedClient(id); }catch(e){ return null; } })();
  if(!c) return false;
  try{ viewClientBilans(); }catch(e){ return false; }
  const b=(c.bilans||[]).find(x=>x&&x.type==='depart');
  setTimeout(()=>{ try{ evoTab('reponses'); if(b) _bnVoir(_idBilan(b)); }catch(e){} },60);
  return true;
}

// ── La trace, sur la fiche ────────────────────────────────────────────────
const ACCUEIL_LIB_RELANCE=Object.freeze({bilan:'le bilan de départ',programme:'le programme à lire',seance:'la première séance'});
// PURE. La phrase de la fiche : où en est l'accueil, et ce qui est parti tout seul.
function htmlAccueilFiche(c,trace,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const p=c&&c.parcours;
  if(!p||p.jeu!=='coache'||p.existant) return '';
  const E=escapeHtml;
  let e={faites:0,total:PARCOURS_COACHE.length,prochaine:null}; try{ e=parcoursEtat(c); }catch(er){}
  const j=Math.min(accueilJour(c,t),99);
  const tr=(trace&&typeof trace==='object')?trace:{};
  const envois=Object.keys(tr).filter(k=>ACCUEIL_LIB_RELANCE[k]&&Number(tr[k])>0).sort((a,b)=>tr[a]-tr[b])
    .map(k=>'le '+new Date(Number(tr[k])).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+' pour '+ACCUEIL_LIB_RELANCE[k]);
  const suite=e.prochaine?(e.prochaine.cle==='programme_lu'&&!(e.prochaine.pret&&e.prochaine.pret(c))?'Il attend son programme.':'Prochaine étape : '+e.prochaine.lib.split(' : ')[0].toLowerCase()+'.'):'Accueil bouclé.';
  return '<div class="acf">'
    +'<div class="acf-t">'+E(p.fini?'Accueil bouclé':'Accueil · jour '+Math.min(j,ACCUEIL_JOURS)+'/'+ACCUEIL_JOURS)+' · '+e.faites+'/'+e.total+' étapes</div>'
    +'<div class="acf-l">'+E(suite)+'</div>'
    +'<div class="acf-l">'+(envois.length?'L’app l’a relancé tout seul '+E(envois.join(', puis '))+'.':'Aucune relance automatique ne lui est partie.')+'</div></div>';
}
function renderAccueilFiche(c){
  const z=document.getElementById('ccd-accueil');
  if(!z) return false;
  const s=z.closest('section');
  const vide=!c||!c.parcours||c.parcours.jeu!=='coache';
  if(s) s.style.display=vide?'none':'';
  if(vide){ z.innerHTML=''; return false; }
  z.innerHTML=htmlAccueilFiche(c,null);
  const cle=String(c.email||'').replace(/\./g,',');
  _fbJson('accueil_trace/'+cle).then(r=>{ if(r&&r.ok) z.innerHTML=htmlAccueilFiche(c,r.v||{}); }).catch(()=>{});
  return true;
}

/** PURE. Les étapes : « inviter un pote » seulement si le parrainage est actif.
 *  jeu 'coache' (lot C1) : l'accueil d'un athlète coaché. */
function parcoursEtapes(actif,jeu){
  if(jeu==='coache') return PARCOURS_COACHE;
  const on=(typeof actif==='boolean')?actif:PARRAINAGE_ACTIF;
  return PARCOURS_DEMARRAGE.filter(e=>!e.parrainage||on);
}
// Les notifications sont-elles actives sur cet appareil ?
function _parcoursNotifActives(u){
  try{ return !!(u&&!u.pushRefus&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&_pushMemo()); }
  catch(e){ return false; }
}
/**
 * PURE (horloge et environnement donnés, écrit dans u). Pose le parcours
 * d'un compte qui n'en a pas (existant : terminé d'office), date les étapes
 * réussies, et le termine. Rend {nouvelles:[cles], fini:bool (à l'instant)}.
 */
function majParcours(u,maintenant,env){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach') return {nouvelles:[],fini:false};
  if(!u.parcours||typeof u.parcours!=='object'){
    const ses=((u.sessions)||[]).filter(s=>s&&s.date>0).map(s=>Number(s.date));
    const cree=Math.min(Number(u.createdAt)||Infinity,Number(u.essai&&u.essai.ouvertLe)||Infinity,ses.length?Math.min(...ses):Infinity);
    // Aucune date : un compte qui vient de naître.
    if(!isFinite(cree)) u.parcours={debut:t,etapes:{}};
    else u.parcours=cree<PARCOURS_DEPUIS?{existant:true,fini:t,debut:cree}:{debut:cree,etapes:{}};
    // LOT C1 : né avec un coach, après la mise en ligne, c'est l'accueil coaché.
    if(!u.parcours.existant&&(u.coachEmailKey||u.coachId)&&t>=ACCUEIL_DEPUIS){ u.parcours.jeu='coache'; u.parcours.debut=Math.max(Number(u.parcours.debut)||t,ACCUEIL_DEPUIS); }
  }
  const p=u.parcours;
  if(p.existant||p.fini) return {nouvelles:[],fini:false};
  p.etapes=(p.etapes&&typeof p.etapes==='object')?p.etapes:{};
  // Inscrit d'abord, relié à son coach ensuite : tant qu'aucune étape n'est faite, l'accueil coaché prend la place.
  if(!p.jeu&&(u.coachEmailKey||u.coachId)&&!Object.keys(p.etapes).length&&Number(p.debut)>=ACCUEIL_DEPUIS-864e5&&t>=ACCUEIL_DEPUIS){ p.jeu='coache'; p.debut=Math.max(Number(p.debut)||t,ACCUEIL_DEPUIS); }
  let f; try{ f=_badgesFaits(u,t); }catch(e){ return {nouvelles:[],fini:false}; }
  const e=Object.assign({notif:_parcoursNotifActives(u),installe:(()=>{ try{ return rcInstallAutonome(); }catch(er){ return false; } })()},env||{});
  const nouvelles=[];
  for(const x of parcoursEtapes(undefined,p.jeu)){
    if(p.etapes[x.cle]) continue;
    let ok=false; try{ ok=!!x.test(u,f,e); }catch(er){ ok=false; }
    if(ok){ p.etapes[x.cle]=t; nouvelles.push(x.cle); }
  }
  const total=parcoursEtapes(undefined,p.jeu).length;
  p.total=total;
  const fini=parcoursEtapes(undefined,p.jeu).every(x=>p.etapes[x.cle]);
  if(fini) p.fini=t;
  return {nouvelles,fini};
}
/** PURE. Les volts du parcours (hors plafond, une fois) : 0 pour un compte existant. */
function parcoursVolts(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Infinity;
  const p=u&&u.parcours;
  if(!p||p.existant||!p.etapes) return 0;
  return (p.jeu==='coache'?PARCOURS_COACHE:PARCOURS_DEMARRAGE).reduce((a,x)=>a+((Number(p.etapes[x.cle])>0&&Number(p.etapes[x.cle])<=t)?x.volts:0),0);
}
/** PURE. Faite, sur combien : {faites, total, prochaine}. */
function parcoursEtat(u){
  const p=(u&&u.parcours)||{}, l=parcoursEtapes(undefined,p.jeu);
  const et=p.etapes||{};
  const faites=l.filter(x=>et[x.cle]).length;
  return {faites,total:l.length,prochaine:l.find(x=>!et[x.cle])||null};
}
/** PURE. La carte se montre-t-elle ? 14 jours, ou jusqu'à la fin. */
function parcoursVisible(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const p=u&&u.parcours;
  if(!p||p.existant||p.fini||!u||u.role==='coach') return false;
  // Rouverte par le rappel du 21e jour : trois jours de plus.
  if(Number(p.relance)>0&&t-Number(p.relance)<3*864e5) return true;
  return t-(Number(p.debut)||t)<PARCOURS_JOURS*864e5;
}
// PURE. La carte « Mise sous tension · 3/7 ».
function htmlParcoursAccueil(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!parcoursVisible(u,t)) return '';
  const e=parcoursEtat(u), p=u.parcours, et=p.etapes||{};
  const coache=p.jeu==='coache', J=coache?ACCUEIL_JOURS:PARCOURS_JOURS;
  const j=Math.max(1,Math.min(J,Math.floor((t-Number(p.debut))/864e5)+1));
  const x=e.prochaine;
  // L'ÉTAPE QUI DÉPEND DU COACH le dit : tant que le programme n'existe pas, ni
  // case, ni bouton, ni volts. « Ton coach prépare ton programme. »
  const attend=!!(x&&x.attente&&x.pret&&!x.pret(u));
  const titre=coache?'Ton accueil':'Mise sous tension';
  return '<div class="mst-carte" role="region" aria-label="'+titre+'">'
    +'<div class="mst-tete"><b>'+titre+' · '+e.faites+'/'+e.total+'</b><span>Jour '+j+'/'+J+'</span></div>'
    +'<div class="mst-points" aria-hidden="true">'+parcoursEtapes(undefined,p.jeu).map(y=>'<i class="'+(et[y.cle]?'on':'')+'"></i>').join('')+'</div>'
    +(x&&attend?'<div class="mst-suite"><span>'+escapeHtml(x.attente)+'</span></div>'
      :x?'<div class="mst-suite"><span>'+escapeHtml(x.lib)+(x.volts?' <em>+'+x.volts+' V</em>':'')+'</span>'
      +(x.action?'<button type="button" class="btn btn-red btn-sm mst-b" onclick="'+x.action+'">'+escapeHtml(x.bouton||'Y aller')+'</button>':'')+'</div>':'')
    +'<div class="mst-note">Les '+e.total+' étapes débloquent le badge SOUS TENSION.</div></div>';
}
function _rendreParcours(u){
  const z=document.getElementById('clh-parcours');
  if(!z) return false;
  z.innerHTML=htmlParcoursAccueil(u,Date.now());
  return !!z.innerHTML;
}
// Le parcours avance hors séance (profil, notifications, invitation) : on
// le relit, et s'il vient de finir, le badge est fêté (écran plein).
function parcoursAvancer(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return null;
  const r=majParcours(u);
  if(r.nouvelles.length){ try{ saveUser(); }catch(e){ rcErreurMuette('parcoursAvancer',e); } }
  if(r.fini){ try{ majBadges(); }catch(e){} try{ majXp(); }catch(e){} }
  try{ _rendreParcours(u); }catch(e){}
  parcoursEcrireJ21(u).catch(()=>{});
  accueilEcrireRelances(u).catch(()=>{});
  return r;
}
// Le push du 21e jour ouvre l'app : la carte, cachée après 14 jours, revient.
function parcoursRelancer(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.parcours||u.parcours.existant||u.parcours.fini) return false;
  u.parcours.relance=Date.now();
  try{ saveUser(); }catch(e){ rcErreurMuette('parcoursRelancer',e); }
  try{ _rendreParcours(u); }catch(e){}
  return true;
}
async function parcoursActiverNotifs(btn){
  if(btn) btn.disabled=true;
  try{ await pushActiverDepuisReglages(); }catch(e){}
  if(btn) btn.disabled=false;
  parcoursAvancer();
  return true;
}
// ── Le rappel du 21e jour de l'essai ──────────────────────────────────────
/** PURE. Le jour J21 (AAAA-MM-JJ) de l'essai, ou ''. */
function parcoursJourJ21(u){
  const o=Number(u&&u.essai&&u.essai.ouvertLe);
  if(!(o>0)) return '';
  try{ return localISODate(new Date(o+21*864e5)); }catch(e){ return ''; }
}
async function parcoursEcrireJ21(u){
  if(!SERVEUR_LEGER||!u||!u.email||!u.parcours||u.parcours.existant||!CLOUD.ok()) return false;
  const jour=parcoursJourJ21(u);
  if(!jour) return false;
  const e=parcoursEtat(u);
  const v=u.parcours.fini?null:Math.max(1,e.total-e.faites);
  if(u.parcours.j21===v||(v===null&&u.parcours.j21==null&&u.parcours.j21Ecrit)) return false;
  const token=await CLOUD._getToken();
  if(!token) return false;
  const moi=String(u.email).replace(/\./g,',');
  const r=await fetch(CLOUD._fbUrl.replace('users.json','parcours_j21/'+jour+'/'+moi+'.json')+'?auth='+token,
    {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(v)}).catch(()=>null);
  if(r&&r.ok){ u.parcours.j21=v; u.parcours.j21Ecrit=true; try{ saveUser(); }catch(er){ rcErreurMuette('parcoursEcrireJ21',er); } return true; }
  return false;
}
// Une invitation partie (lien de parrainage, carte, duel) : l'étape
// « Invite un pote » est faite — on ne peut pas savoir si le message a été
// envoyé, le partage ouvert suffit.
function parcoursInvitation(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.parcours||u.parcours.existant||u.parcours.fini||u.parcours.invite) return false;
  u.parcours.invite=Date.now();
  try{ parcoursAvancer(); }catch(e){}
  return true;
}

// LISSÉS LE 01/10/2026 : des écarts qui croissent d'un rang à l'autre
// (1 800, 2 000, 3 700, 6 000, 7 500, 9 500, 11 500, 13 500, 28 500) — ils
// sautaient de 6 000 à 16 000 puis 32 000. MÊMES SEUILS AU SERVEUR
// (cloudflare/src/xp.js, RANGS ; un test compare les deux).
// ⚠ UN RANG FÊTÉ NE REDESCEND JAMAIS (u.xpRang) : un total repassé sous son
//   seuil (barème revu, part hors entraînement bornée) affiche le rang fêté
//   (rangAffiche).
const RANGS=Object.freeze([
  {n:1, nom:'ÉTINCELLE', seuil:0},
  {n:2, nom:'IMPULSION', seuil:1800},
  {n:3, nom:'VOLTAGE',   seuil:3800},
  {n:4, nom:'MACHINE',   seuil:7500},
  {n:5, nom:'ÉLITE',     seuil:13500},
  {n:6, nom:'SURTENSION',seuil:21000},
  {n:7, nom:'MONSTRE',   seuil:30500},
  {n:8, nom:'FOUDRE',    seuil:42000},
  {n:9, nom:'TITAN',     seuil:55500},
  {n:10,nom:'LÉGENDE',   seuil:84000}
]);
// ══ LE PRESTIGE (01/10/2026) : chaque tranche de 20 000 V au-delà de
// LÉGENDE, une étoile — « LÉGENDE ★2 ». Aucune image nouvelle : l'emblème de
// LÉGENDE, l'étoile écrite. Fêtée petit, comme un sous-niveau.
const PRESTIGE_TRANCHE=20000;
/** PURE. Le nombre d'étoiles d'un total (0 avant LÉGENDE). */
function prestigeDe(xp){
  const v=Math.max(0,Number(xp)||0), l=RANGS[RANGS.length-1].seuil;
  return v>=l?Math.floor((v-l)/PRESTIGE_TRANCHE):0;
}
/** PURE. Le rang AFFICHÉ : celui du total, jamais sous le rang déjà fêté. */
function rangAffiche(xp,rangFete){
  const r=rangDe(xp), n=Math.max(0,Math.min(RANGS.length,Math.round(Number(rangFete)||0)));
  if(n<=r.rang.n) return r;
  const rang=RANGS[n-1], suivant=RANGS[n]||null;
  return {rang,suivant,part:0,reste:suivant?Math.max(0,suivant.seuil-r.xp):0,xp:r.xp,fete:true};
}
function rangEmbleme(n,grand){
  const k=Math.max(1,Math.min(RANGS.length,Number(n)||1));
  return './img/rangs/rang_'+k+(grand?'-512':'')+'.webp';
}
// PURE. Le rang d'un total : {rang, suivant, part (0-1 vers le suivant), reste}.
function rangDe(xp){
  const v=Math.max(0,Number(xp)||0);
  let i=0;
  for(let k=0;k<RANGS.length;k++) if(v>=RANGS[k].seuil) i=k;
  const rang=RANGS[i], suivant=RANGS[i+1]||null;
  const part=suivant?Math.max(0,Math.min(1,(v-rang.seuil)/(suivant.seuil-rang.seuil))):1;
  return {rang,suivant,part,reste:suivant?Math.max(0,suivant.seuil-v):0,xp:v};
}
// ══ LES SOUS-NIVEAUX I / II / III (28/09/2026) ═════════════════════════
// Après ÉLITE, six mois et plus sans rien entre deux rangs : chaque
// intervalle de RANGS, À PARTIR DE VOLTAGE, est coupé en trois sous-niveaux
// égaux. Le passage se fête petit — un toast et une petite foudre, jamais un
// écran plein — et s'inscrit dans « Tes trophées du jour ». Les chevrons
// (1, 2 ou 3) sont DESSINÉS sous l'emblème : aucune image nouvelle.
// LÉGENDE, le dernier rang, n'a pas de borne haute : pas de sous-niveau.
const SOUS_NIVEAU_DES=3;                  // VOLTAGE
const SOUS_ROMAINS=Object.freeze(['I','II','III']);
/** PURE. Le sous-niveau d'un total, ou null (avant VOLTAGE, et LÉGENDE). */
function sousNiveauDe(xp){
  const r=rangDe(xp);
  if(r.rang.n<SOUS_NIVEAU_DES||!r.suivant) return null;
  // Les bornes, arrondies au volt : ce sont ELLES qui font foi (affichées et comparées).
  const w=(r.suivant.seuil-r.rang.seuil)/3;
  const b=[r.rang.seuil,Math.round(r.rang.seuil+w),Math.round(r.rang.seuil+2*w),r.suivant.seuil];
  const k=r.xp>=b[2]?2:(r.xp>=b[1]?1:0);
  const de=b[k], a=b[k+1];
  return {n:k+1,lib:SOUS_ROMAINS[k],de,a,part:Math.max(0,Math.min(1,(r.xp-de)/(a-de))),
    vers:k<2?(r.rang.nom+' '+SOUS_ROMAINS[k+1]):r.suivant.nom};
}
/** PURE. « MONSTRE II », ou le nom du rang seul. */
function nomRangComplet(xp){
  const r=rangDe(xp), s=sousNiveauDe(xp), p=prestigeDe(xp);
  return r.rang.nom+(s?' '+s.lib:'')+(p?' ★'+p:'');
}
/** PURE. Le code d'un niveau, pour comparer : rang × 10 + sous-niveau ; en
 *  LÉGENDE, 100 + les étoiles. */
function niveauCode(xp){
  const r=rangDe(xp), s=sousNiveauDe(xp);
  return r.rang.n*10+(s?s.n:0)+prestigeDe(xp);
}
/** PURE. Le rang d'un code de niveau (LÉGENDE au-delà de 100). */
function _rangDuCode(c){ return Math.min(RANGS.length,Math.floor((Number(c)||0)/10)); }
/** PURE. 1, 2 ou 3 chevrons rouges, en SVG. */
function htmlChevrons(n,classe){
  const k=Math.max(0,Math.min(3,Math.round(Number(n)||0)));
  if(!k) return '';
  const W=k*8+2;
  let p='';
  for(let i=0;i<k;i++){ const x=1+i*8; p+='<path d="M'+x+' 6 L'+(x+3.5)+' 2 L'+(x+7)+' 6"/>'; }
  return '<svg class="'+(classe||'rg-chev')+'" viewBox="0 0 '+W+' 8" width="'+W+'" height="8" aria-hidden="true" focusable="false">'
    +'<g fill="none" stroke="#ff2a2a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</g></svg>';
}
// Le passage : toast, petite foudre sur l'en-tête, trophée du jour si la fin
// de séance est à l'écran.
function _celebrerSousNiveau(xp){
  const nom=nomRangComplet(xp), p=prestigeDe(xp), s=sousNiveauDe(xp)||(p?{n:p}:null);
  if(!s) return false;
  try{ toast(ICO.eclair+' '+nom+(p?' · nouvelle étoile':' · nouveau sous-niveau')); }catch(e){}
  try{ const el=document.getElementById('clh-rang'); rcFoudre(el&&el.offsetParent?el:null,{eclairs:1,son:false}); }catch(e){}
  try{
    const ancre=document.getElementById('wd-volts');
    if(ancre&&ancre.isConnected&&ancre.closest('.screen.active')) _bdgAjouterTrophees([{sous:{nom,n:s.n,rang:rangDe(xp).rang.n}}]);
  }catch(e){}
  return true;
}

// ══ LES VOLTS D'UNE SÉANCE ════════════════════════════════════════════
// Une séance d'une minute valait 130 V. Désormais : 100 V seulement si elle
// dure au moins 15 min ET compte au moins 6 séries validées ; sinon 10 V par
// série validée (100 au plus). Le bonus « complète » (+30) ne change pas.
// MÊME RÈGLE AU SERVEUR (cloudflare/src/xp.js, voltsSeance).
const SEANCE_VOLTS_MIN_MIN=15, SEANCE_VOLTS_MIN_SERIES=6, VOLTS_PAR_SERIE=10;
/** PURE. Les séries validées, comptées dans les données de la séance. */
function seriesValideesSeance(s){
  const d=s&&s.data&&typeof s.data==='object'?s.data:null;
  if(!d) return Math.max(0,Math.round(Number(s&&s.sets)||0));
  let n=0;
  for(const k of Object.keys(d)) for(const st of ((d[k]||{}).sets||[])) if(st&&st.done===true) n++;
  return n;
}
/** PURE. Les volts d'une séance (hors bonus « complète » et records). */
function voltsSeance(s){
  const n=seriesValideesSeance(s), m=Number(s&&s.duration)||0;
  if(m>=SEANCE_VOLTS_MIN_MIN&&n>=SEANCE_VOLTS_MIN_SERIES) return XP_ACTIONS.seance;
  return Math.min(XP_ACTIONS.seance,n*VOLTS_PAR_SERIE);
}

// ══ LE TOTAL DU SERVEUR (/xp_serveur/<compte>) ═════════════════════════
// Écrit par le serveur léger à chaque séance terminée (événement seance_fin,
// cloudflare/src/xp.js) : séances recalculées, le reste borné, les badges
// secrets horaires contrôlés à son heure. LE COACH, LES DÉFIS ET LE CANAL
// LE LISENT (xpDe d'un autre dossier que le sien) ; la page publique lit sa
// copie /volts_publics/<pseudo>. L'athlète, lui, voit son calcul local :
// immédiat, et le même aux bornes près.
const _xpServeur={};
const XP_SERVEUR_TTL=10*60e3;
function _cleCompte(u){ return (u&&u.email)?String(u.email).replace(/\./g,','):''; }
async function chargerXpServeur(k,force){
  if(!k||!SERVEUR_LEGER||!CLOUD||!CLOUD.ok()) return null;
  const c=_xpServeur[k];
  if(c&&!force&&Date.now()-c.lu<XP_SERVEUR_TTL) return c.v;
  _xpServeur[k]={lu:Date.now(),v:c?c.v:null};
  try{
    const token=await CLOUD._getToken();
    if(!token) return null;
    const r=await fetch(CLOUD._fbUrl.replace('users.json','xp_serveur/'+k+'.json')+'?auth='+token);
    const v=r.ok?await r.json():null;
    _xpServeur[k]={lu:Date.now(),v:(v&&typeof v.total==='number')?v:null};
    return _xpServeur[k].v;
  }catch(e){ return null; }
}
// Les athlètes du coach, en tâche de fond (dix minutes de mémoire).
function chargerXpServeurClients(){
  try{
    if(!currentUser||currentUser.role!=='coach') return 0;
    const users=DB.get('users')||{};
    const moi=_cleCompte(currentUser);
    let n=0;
    for(const e of Object.keys(users)){
      const c=users[e];
      if(!c||c.role==='coach'||(c.coachEmailKey&&c.coachEmailKey!==moi)) continue;
      const k=_cleCompte(c);
      if(k){ chargerXpServeur(k).catch(()=>{}); n++; }
    }
    return n;
  }catch(e){ return 0; }
}
/** PURE (mémoire lue). Le total serveur connu d'un dossier, ou null. */
function xpServeurDe(u){
  const c=_xpServeur[_cleCompte(u)];
  return (c&&c.v&&typeof c.v.total==='number')?c.v.total:null;
}
// PURE. Une séance complète : même règle que les semaines « à 100 % » des
// badges — ni marquée incomplète, ni moins de séries que prévu.
function _xpComplete(s){
  if(!s||s.complete===false) return false;
  return !(Number(s.setsPlanned)>0&&Number(s.sets)<Number(s.setsPlanned));
}
function _xpJour(t){ try{ return localISODate(new Date(t)); }catch(e){ return ''; } }
// ══ LA PART HORS ENTRAÎNEMENT (01/10/2026) ══════════════════════════════
// Journal, cible, nuit, check-in et semaine d'assiette ne peuvent pas
// rapporter, sur 7 jours glissants, plus de 40 % des volts d'entraînement de
// la même fenêtre (séance, complète, records, semaine validée) — ou 150 V,
// si c'est plus : le PLANCHER d'un athlète blessé ou suspendu, qui tient son
// journal sans pouvoir s'entraîner. L'excédent est écrêté (`ecrete`).
// ⚠ POURQUOI 40 % ET UN PLANCHER, ET NON « 60 % + 150 V » (la demande) : un
//   athlète à 3 séances par semaine gagne ~560 V d'entraînement par
//   semaine ; 60 % + 150 lui laissaient ~490 V hors entraînement, plus que ce
//   que « tout remplir » rapporte (~485 V) — la borne ne mordait jamais, et
//   l'athlète « tout remplir » touchait LÉGENDE en 14 mois. À 40 % avec un
//   plancher de 150 V, il y met plus de 20 mois, l'athlète régulier ~29,
//   et un compte sans séance plafonne à ~150 V par semaine (VOLTAGE en six
//   mois). Le test « la courbe tient le calendrier » rejoue les trois.
// MÊME BORNE AU SERVEUR (cloudflare/src/xp.js, totalServeur), sur des
// semaines entières : il n'a pas le détail par jour.
const XP_HORS_PART=0.4, XP_HORS_PLANCHER=150, XP_HORS_FENETRE=7;
const XP_HORS=Object.freeze(['nutrition','cible','sommeil','checkin','semaineAssiette']);
const XP_ENTRAINEMENT=Object.freeze(['seance','complete','record','semaine']);
// L'ordre du rabot quand la borne mord : la semaine d'assiette d'abord, la
// nuit en dernier.
const XP_HORS_RABOT=Object.freeze(['semaineAssiette','cible','nutrition','checkin','sommeil']);
function _xpJourPlus(j,n){ const [a,m,d]=String(j).split('-').map(Number); return localISODate(new Date(a,m-1,d+n)); }
/** PURE (écrit dans parJour). Borne la part hors entraînement ; rend l'écrêté. */
function _xpBornerHors(parJour){
  const jl=Object.keys(parJour).sort();
  const somme=(o,l)=>l.reduce((a,c)=>a+(Number(o&&o[c])||0),0);
  const pris={};
  let ecrete=0;
  for(let i=0;i<jl.length;i++){
    const j=jl[i], d0=_xpJourPlus(j,-(XP_HORS_FENETRE-1));
    let train=0, avant=0;
    for(let k=i;k>=0&&jl[k]>=d0;k--){ train+=somme(parJour[jl[k]],XP_ENTRAINEMENT); if(k<i) avant+=pris[jl[k]]||0; }
    const permis=Math.max(0,Math.floor(Math.max(XP_HORS_PART*train,XP_HORS_PLANCHER)-avant));
    const o=parJour[j], hors=somme(o,XP_HORS);
    if(hors>permis){
      let trop=hors-permis;
      for(const c of XP_HORS_RABOT){ const v=Number(o[c])||0, r=Math.min(v,trop); if(r){ o[c]=v-r; trop-=r; } if(!trop) break; }
      ecrete+=hors-permis;
    }
    pris[j]=Math.min(hors,permis);
  }
  return ecrete;
}
/** PURE. Les dates des séances de RETOUR : comptées, et 14 jours ou plus
 *  (jours civils) après la séance comptée précédente. */
function xpRetours(ses){
  const l=(ses||[]).filter(s=>s&&Number(s.date)>0&&seanceComptee(s)).map(s=>Number(s.date)).sort((a,b)=>a-b);
  const midi=t=>{ const x=new Date(t); x.setHours(12,0,0,0); return x.getTime(); };
  const out=[];
  for(let i=1;i<l.length;i++) if(Math.round((midi(l[i])-midi(l[i-1]))/864e5)>=RETOUR_COMBAT_J) out.push(l[i]);
  return out;
}
// PURE. LE CALCUL. Rend {total, cat:{seance, complete, record, bilan,
// nutrition, sommeil, semaine, badge, archive}, ecrete} — `ecrete`, ce que le
// plafond a retenu. Les catégories du jour passent dans l'ordre ci-dessous
// jusqu'au plafond : la séance d'abord, la nuit en dernier.
function xpCalcul(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const cat={seance:0,complete:0,record:0,bilan:0,nutrition:0,sommeil:0,checkin:0,cible:0,mission:0,semaine:0,semaineAssiette:0,retour:0,badge:0,parcours:0,archive:0};
  const vide={total:0,cat,ecrete:0};
  if(!u) return vide;
  let f; try{ f=_badgesFaits(u,t); }catch(e){ return vide; }
  const jours={};                         // jour → [[categorie, volts], …]
  const pose=(j,c,v)=>{ if(!j||!(v>0)) return; (jours[j]||(jours[j]=[])).push([c,v]); };
  // Les records, par séance : _badgesFaits en pousse la date une fois par record.
  const recs={};
  for(const d of f.records) recs[d]=(recs[d]||0)+1;
  const ses=((u.sessions)||[]).filter(s=>s&&s.date>0&&s.date<=t);
  for(const s of ses){
    const j=_xpJour(s.date);
    pose(j,'seance',voltsSeance(s));
    if(_xpComplete(s)) pose(j,'complete',XP_ACTIONS.complete);
    if(recs[s.date]){ pose(j,'record',XP_ACTIONS.record*recs[s.date]); recs[s.date]=0; }
  }
  for(const d of f.bilans) if(d<=t) pose(_xpJour(d),'bilan',XP_ACTIONS.bilan);
  const log=((u.nutrition||{}).log)||{};
  for(const j of Object.keys(log)){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(j)) continue;
    if(((log[j]&&log[j].entries)||[]).length>=XP_NUTRITION_MIN) pose(j,'nutrition',XP_ACTIONS.nutrition);
    // LOT N2 : la cible tenue, une fois par jour, jamais un jour futur.
    // LOT N4 : la table des jours tenus est calculée une fois par _badgesFaits
    // (même chemin que cibleTenueJour), et relue ici.
    let _ct=null; try{ _ct=(j<=_xpJour(t))?((f.assiette&&f.assiette.tenus)?f.assiette.tenus[j]:cibleTenueJour(u,j)):null; }catch(e){ _ct=null; }
    if(_ct&&_ct.tenue) pose(j,'cible',XP_ACTIONS.cible);
  }
  const nuits=new Set();
  for(const e of (Array.isArray(u.sleepLog)?u.sleepLog:[])){
    if(e&&/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))&&Number(e.duration)>0&&!nuits.has(e.date)){
      nuits.add(e.date); pose(e.date,'sommeil',XP_ACTIONS.sommeil);
    }
  }
  // Le check-in du matin : 10 V par jour, dans le plafond.
  for(const j of Object.keys((u.checkin&&typeof u.checkin==='object')?u.checkin:{})){
    if(/^\d{4}-\d{2}-\d{2}$/.test(j)&&checkinComplet(u.checkin[j])&&Number(u.checkin[j].at||0)<=t) pose(j,'checkin',XP_ACTIONS.checkin);
  }
  // LA MISSION DU JOUR : le coffre (20 ou 50 V) le jour de son ouverture, ou
  // les volts doublés de la séance qui suit, SOUS le plafond et en dernier.
  try{ for(const [j,v] of missionVoltsParJour(u,t)) pose(j,'mission',v); }catch(e){}
  // LA CIBLE PASSE EN DERNIER sous le plafond : sur la journée de référence
  // (séance complète à trois records + bilan + journal + nuit = 380), elle ne
  // prend que les 20 V qui restent, et la nuit comme le check-in gardent leur
  // place.
  const ordre=['seance','complete','record','bilan','nutrition','sommeil','checkin','cible','mission'];
  let ecrete=0;
  const parJour={};                       // jour → {catégorie: volts retenus}
  const ajoute=(j,c,v)=>{ if(!j||!(v>0)) return; const o=parJour[j]||(parJour[j]={}); o[c]=(o[c]||0)+v; };
  for(const j of Object.keys(jours)){
    let reste=XP_PLAFOND_JOUR;
    const l=jours[j].sort((a,b)=>ordre.indexOf(a[0])-ordre.indexOf(b[0]));
    for(const [c,v] of l){
      const pris=Math.min(v,reste);
      ajoute(j,c,pris); reste-=pris; ecrete+=v-pris;
    }
  }
  // Les jalons, hors plafond du jour, rangés à leur date.
  for(const d of f.semaines) if(d<=t) ajoute(_xpJour(d),'semaine',XP_ACTIONS.semaine);
  for(const d of ((f.assiette&&f.assiette.semaines)||[])) if(d<=t) ajoute(_xpJour(d),'semaineAssiette',XP_ACTIONS.semaineAssiette);
  // LE RETOUR : +50 V à la 1re séance comptée après RETOUR_COMBAT_J jours ou
  // plus, une fois par période (chaque retour la referme).
  for(const d of xpRetours(ses)) ajoute(_xpJour(d),'retour',XP_ACTIONS.retour);
  // LA PART HORS ENTRAÎNEMENT, sur 7 jours glissants (voir XP_HORS_PART).
  ecrete+=_xpBornerHors(parJour);
  for(const j of Object.keys(parJour)) for(const c of Object.keys(parJour[j])) cat[c]+=parJour[j][c];
  for(const b of BADGES_ACQUIS){
    if(_bdgInactif(b)) continue;
    let at=0; try{ at=Number(b.test(f))||0; }catch(e){ at=0; }
    if(at>0&&at<=t) cat.badge+=(b.palier===4?XP_ACTIONS.badgePalier4:XP_ACTIONS.badge);
  }
  // Le parcours « Mise sous tension » : chaque étape une fois, à sa date.
  cat.parcours=parcoursVolts(u,t);
  const ar=u.xpArchive&&typeof u.xpArchive==='object'?Number(u.xpArchive.sommeil)||0:0;
  cat.archive=Math.max(0,Math.round(ar));
  const total=Object.keys(cat).reduce((a,k)=>a+cat[k],0);
  return {total,cat,ecrete};
}
// PURE. Ce qu'une séance a rapporté : le calcul avec elle, moins le calcul
// sans elle. Les badges et la semaine qu'elle débloque comptent donc — et le
// plafond aussi, tel qu'il s'applique vraiment. Rend {total, lignes:[{lib,v}]}.
function xpGainsSeance(u,sess,maintenant){
  if(!u||!sess) return {total:0,lignes:[]};
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const apres=xpCalcul(u,t);
  const sans=Object.assign({},u,{sessions:(u.sessions||[]).filter(s=>s!==sess&&!(s&&s.date===sess.date))});
  // Les étapes du parcours datées à la fin de CETTE séance comptent dans son gain.
  if(u.parcours&&u.parcours.etapes){
    const et={};
    for(const k of Object.keys(u.parcours.etapes)){ const d=Number(u.parcours.etapes[k]); if(!(d>=sess.date&&d-sess.date<15*60e3)) et[k]=d; }
    sans.parcours=Object.assign({},u.parcours,{etapes:et});
  }
  const avant=xpCalcul(sans,t);
  const d=k=>(apres.cat[k]||0)-(avant.cat[k]||0);
  const lignes=[];
  const nRec=Math.round(d('record')/XP_ACTIONS.record);
  if(d('seance')>0) lignes.push({lib:'Séance terminée',v:d('seance')});
  if(d('complete')>0) lignes.push({lib:'Séance complète',v:d('complete')});
  if(d('record')>0) lignes.push({lib:nRec>1?nRec+' records':'Record battu',v:d('record')});
  if(d('semaine')>0) lignes.push({lib:'Semaine validée',v:d('semaine')});
  if(d('badge')>0) lignes.push({lib:'Badge débloqué',v:d('badge')});
  if(d('parcours')>0) lignes.push({lib:'Mise sous tension',v:d('parcours')});
  if(d('mission')>0) lignes.push({lib:'Volts doublés (coffre)',v:d('mission')});
  if(d('retour')>0) lignes.push({lib:'Retour au combat',v:d('retour')});
  const autres=(apres.total-avant.total)-lignes.reduce((a,l)=>a+l.v,0);
  if(autres>0) lignes.push({lib:'Autres gains du jour',v:autres});
  return {total:Math.max(0,apres.total-avant.total),lignes,ecrete:apres.ecrete>avant.ecrete,
    avant:avant.total,apres:apres.total};
}
// Le total d'un dossier QUELCONQUE (le coach lit ses athlètes) : la copie
// u.xp quand elle existe, sinon le calcul.
function xpDe(u){
  if(!u) return 0;
  // Un autre dossier que le sien (le coach, les défis, le Canal) : le total
  // du SERVEUR quand il est connu — celui que le client ne peut pas écrire.
  if(typeof currentUser!=='undefined'&&currentUser&&u!==currentUser&&_cleCompte(u)!==_cleCompte(currentUser)){
    const v=xpServeurDe(u);
    if(v!=null) return v;
  }
  if(typeof u.xp==='number'&&isFinite(u.xp)) return u.xp;
  try{ return xpCalcul(u).total; }catch(e){ return 0; }
}
function xpFormat(v){ try{ return Math.round(Number(v)||0).toLocaleString('fr-FR'); }catch(e){ return String(Math.round(Number(v)||0)); } }
// LA MISE À JOUR : la copie u.xp, et le PASSAGE DE RANG. u.xpRang retient le
// plus haut rang déjà fêté ; au premier calcul (mise à jour de l'app), il est
// posé SANS fête — un athlète ancien ne voit pas défiler six écrans pour des
// mois passés. Même garde que les badges : sous suspension ou drapeau, le
// passage attend (u.xpRang ne bouge pas, il sera fêté ensuite).
function majXp(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach') return null;
  let r; try{ r=xpCalcul(u); }catch(e){ return null; }
  const rg=rangDe(r.total);
  let change=false;
  if(u.xp!==r.total){ u.xp=r.total; change=true; }
  // Le détail, pour le serveur léger : il recalcule les séances et BORNE le
  // reste avec (xp_serveur). Écrit seulement quand il change.
  const det=Object.assign({total:r.total},r.cat);
  if(JSON.stringify(u.xpDetail||null)!==JSON.stringify(det)){ u.xpDetail=det; change=true; }
  let bloque=false;
  try{ if(suspensionEtat(u).actif) bloque=true; }catch(e){}
  try{ if(drapeauQuelconqueActif(u)) bloque=true; }catch(e){}
  const vu=Number(u.xpRang)||0;
  let fete=0;
  if(!vu){ u.xpRang=rg.rang.n; change=true; }
  else if(rg.rang.n>vu){
    if(!bloque){ u.xpRang=rg.rang.n; fete=rg.rang.n; change=true; }
  }
  // LE SOUS-NIVEAU : posé sans fête au premier calcul ; fêté petit ensuite,
  // sauf quand un rang entier vient d'être passé (son écran le dit déjà).
  const code=niveauCode(r.total), vuN=Number(u.xpNiveau)||0;
  let sous=0;
  if(!vuN){ u.xpNiveau=code; change=true; }
  else if(code>vuN&&!bloque){
    u.xpNiveau=code; change=true;
    if(!fete&&_rangDuCode(code)===_rangDuCode(vuN)) sous=code;
  }
  if(change) try{ saveUser(); }catch(e){ rcErreurMuette('majXp',e); }
  if(fete) try{ _celebrerRang(fete); }catch(e){}
  if(sous) try{ _celebrerSousNiveau(r.total); }catch(e){}
  return {total:r.total,rang:rg.rang.n,fete,sous};
}
// ── L'ACCUEIL : l'emblème et le nom du rang sous le prénom, et la jauge ──
// PURE.
function htmlRangAccueil(xp,rangFete){
  // Le rang FÊTÉ ne redescend pas : sous son seuil, il reste affiché, jauge
  // à zéro vers le rang suivant.
  const r=rangAffiche(xp,rangFete);
  // À partir de VOLTAGE, la jauge va au sous-niveau suivant : « MONSTRE II ·
  // 30 240 / 31 667 V vers MONSTRE III ». En LÉGENDE, vers l'étoile suivante.
  const s=r.fete?null:sousNiveauDe(xp), p=r.fete?0:prestigeDe(xp);
  const l=RANGS[RANGS.length-1].seuil;
  const etoile=r.rang.n===RANGS.length&&!r.fete?{de:l+p*PRESTIGE_TRANCHE,a:l+(p+1)*PRESTIGE_TRANCHE}:null;
  const part=s?s.part:etoile?Math.max(0,Math.min(1,(r.xp-etoile.de)/PRESTIGE_TRANCHE)):r.part;
  const cible=s?s.a:etoile?etoile.a:(r.suivant?r.suivant.seuil:0);
  const vers=s?s.vers:etoile?'LÉGENDE ★'+(p+1):(r.suivant?r.suivant.nom:'');
  const txt=cible
    ?xpFormat(r.xp)+' / '+xpFormat(cible)+' V vers '+vers
    :xpFormat(r.xp)+' V · rang maximal';
  return '<div class="rg-ligne"><span class="rg-emb-w"><img class="rg-emb" src="'+rangEmbleme(r.rang.n)+'" alt="" width="22" height="22" decoding="async">'
    // PLUS DE CHEVRONS SOUS L'EMBLEME (Kevin, 28/09/2026 : « deux vagues sous
    // le logo, je ne comprends pas ce qu'elles font »). Le sous-niveau reste
    // ecrit en toutes lettres dans le nom du rang.
    +'</span>'
    +'<span class="rg-nom">'+escapeHtml(r.rang.nom+(s?' '+s.lib:'')+(p?' ★'+p:''))+'</span></div>'
    +'<div class="rg-jauge" role="progressbar" aria-label="Volts vers '+(s?'le sous-niveau suivant':etoile?'l’étoile suivante':'le rang suivant')+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
      +Math.round(part*100)+'"><span style="width:'+Math.round(part*100)+'%"></span></div>'
    // LA MAQUETTE DE L'EN-TETE (27/09/2026) : les chiffres en blanc, « vers »
    // plus petit et gris, le rang suivant en blanc.
    +'<div class="rg-txt">'+(cible
      ?'<b>'+escapeHtml(xpFormat(r.xp)+' / '+xpFormat(cible)+' V')+'</b> <span class="rg-vers">vers</span> '+escapeHtml(vers)
      :escapeHtml(txt))+'</div>';
}
function _rendreRang(u){
  const z=document.getElementById('clh-rang');
  if(!z) return false;
  if(!u||u.role==='coach'){ z.innerHTML=''; z.hidden=true; return false; }
  let m=null; try{ m=majXp(); }catch(e){ m=null; }
  z.hidden=false;
  z.innerHTML=htmlRangAccueil(m?m.total:xpDe(u),u.xpRang);
  // LA LIGNE DES FILLEULS, sous l'en-tête (la bande a une hauteur fixe) :
  // rien avant le premier filleul.
  try{
    const t=z.closest('.clh-tete');
    let l=document.getElementById('clh-filleuls');
    const h=htmlLigneFilleuls(u);
    if(!l&&h&&t){ l=document.createElement('div'); l.id='clh-filleuls'; t.insertAdjacentElement('afterend',l); }
    if(l){ l.innerHTML=h; l.hidden=!h; }
  }catch(e){}
  return true;
}
// ══ LA MISSION DU JOUR (01/10/2026) ═══════════════════════════════════════
//
// Trois missions par jour, sous l'en-tête de l'accueil. Elles se cochent
// SEULES : chaque case est relue, à chaque rendu, dans ce que le dossier
// contient déjà (séance, check-in, journal, nuit) ou dans un acte que l'app a
// vu se faire (le minuteur de mobilité arrivé au bout, la prochaine séance
// ouverte, une réaction envoyée — u.missions[jour].actes). Aucune case ne se
// coche à la main : rien de déclaratif.
//
// LE TIRAGE EST DÉTERMINISTE : graine = hash(clé du compte + jour local).
// Le même jour rend les mêmes missions et le même coffre, sur tous les
// appareils, et le serveur n'a aucun aléa à tenir.
//
// LE TYPE DE JOUR est celui du CALENDRIER (nutIsOnDayCalendrier) et non la
// réalité du jour (jourOnReel) : une séance faite un jour de repos ne doit
// pas remplacer les missions au milieu de la journée.
//
// ⚠ JAMAIS UNE MISSION IMPOSSIBLE : pas de protéines sans cible, rien de
//   nutritionnel sous aTCA, pas de réaction sans carnet d'amis, pas de
//   prochaine séance sans créneau actif.
// ⚠ LE COFFRE (les trois cases faites) : 60 % +20 V, 25 % +50 V, 10 % un
//   joker de série (+50 V si la réserve est pleine), 5 % les volts doublés
//   sur la prochaine séance. Ses volts (xpCalcul, cat.mission) passent SOUS
//   le plafond du jour, en dernier ; le serveur les borne à jours × 50.
// ⚠ COACH : rien. SUSPENSION : missions en pause, pas de coffre. COMPTE DE
//   MOINS DE 2 JOURS : les étapes du parcours à la place, sans coffre.
const MISSION_JEUNE_JOURS=2;
const MISSION_COFFRE=Object.freeze([
  Object.freeze({gain:20,p:0.60}),Object.freeze({gain:50,p:0.25}),
  Object.freeze({gain:'joker',p:0.10}),Object.freeze({gain:'double',p:0.05})
]);
const MISSION_VOLTS_MAX=50;
const MISSION_MOBILITE_S=600;
const MISSION_GARDE_DETAIL_J=14;
// Les séances du jour qui comptent (seanceComptee), jour local de leur fin.
function _mjSeances(u,j){ return ((u&&u.sessions)||[]).filter(s=>s&&Number(s.date)>0&&seanceComptee(s)&&_xpJour(Number(s.date))===j); }
function _mjActe(u,j,k){ const m=u&&u.missions&&u.missions[j]; return !!(m&&m.actes&&Number(m.actes[k])>0); }
// Les séries validées d'un exercice d'une séance (forme data).
function _mjSeries(s,nom){ const d=s&&s.data&&s.data[nom]; const l=d&&d.sets; return (Array.isArray(l)?l:(l&&typeof l==='object'?Object.values(l):[])).filter(st=>st&&st.done===true); }
// PURE. +1 rép sur le 1er exercice : à la charge de tête de la fois d'avant,
// une rép de plus qu'elle (ou une charge au-dessus).
function _mjRepPlus(u,j){
  const ses=((u&&u.sessions)||[]).filter(s=>s&&Number(s.date)>0).slice().sort((a,b)=>a.date-b.date);
  for(const s of _mjSeances(u,j)){
    const nom=Object.keys((s.data&&typeof s.data==='object')?s.data:{})[0];
    if(!nom) continue;
    const avant=ses.filter(x=>x.date<s.date&&_mjSeries(x,nom).length).pop();
    if(!avant) continue;
    const w=x=>parseFloat(x.weight)||0, r=x=>parseFloat(x.repsDone!=null?x.repsDone:x.reps)||0;
    const pa=_mjSeries(avant,nom), wTete=Math.max(...pa.map(w));
    const rTete=Math.max(...pa.filter(x=>w(x)===wTete).map(r));
    if(_mjSeries(s,nom).some(x=>w(x)>wTete||(w(x)===wTete&&r(x)>=rTete+1))) return true;
  }
  return false;
}
function _mjCible(u,j){
  try{ const n=u&&u.nutrition; if(!n||!n.macros) return 0; const c=_getEffectiveMacros(n,nutIsOnDay(j,u),j,u); return Number(c&&c.p)||0; }catch(e){ return 0; }
}
function _mjCreneauActif(u){ return ((u&&u.sessions_config)||[]).some(s=>s&&s.active&&Array.isArray(s.exercises)&&s.exercises.length); }
// LA TABLE. type : jour de séance ou de repos. `faite(u, jour, ctx)` lit les
// faits ; `possible(u, jour, ctx)` écarte ce qui ne peut pas se faire.
const MISSIONS=Object.freeze([
  Object.freeze({cle:'seance_finie',type:'seance',lib:'Termine ta séance',
    faite:(u,j)=>_mjSeances(u,j).length>0,action:'openSessionPicker()',bouton:'Y aller'}),
  Object.freeze({cle:'record_rep',type:'seance',lib:'Bats 1 record ou fais +1 rép sur ton 1er exercice',
    faite:(u,j,c)=>(c.f.records||[]).some(d=>_xpJour(d)===j)||_mjRepPlus(u,j)}),
  Object.freeze({cle:'rir',type:'seance',lib:'Note ton RIR sur toutes les séries',
    faite:(u,j)=>{ const l=[]; for(const s of _mjSeances(u,j)) for(const k of Object.keys(s.data||{})) l.push(..._mjSeries(s,k));
      return l.length>0&&l.every(st=>st.rir!=null&&String(st.rir).trim()!==''&&isFinite(Number(st.rir))); }}),
  Object.freeze({cle:'checkin',type:'repos',lib:'Check-in du matin',
    faite:(u,j)=>{ try{ return checkinComplet(u.checkin&&u.checkin[j]); }catch(e){ return false; } }}),
  Object.freeze({cle:'mobilite',type:'repos',lib:'10 min de mobilité',
    faite:(u,j)=>_mjActe(u,j,'mobilite'),action:'missionMobiliteLancer()',bouton:'Lancer'}),
  Object.freeze({cle:'proteines',type:'repos',lib:'Atteins tes protéines',nutrition:true,
    possible:(u,j)=>_mjCible(u,j)>0,
    faite:(u,j)=>{ try{ return !!cibleTenueJour(u,j).prot; }catch(e){ return false; } }}),
  Object.freeze({cle:'nuit',type:'repos',lib:'Saisis ta nuit',
    faite:(u,j)=>(Array.isArray(u.sleepLog)?u.sleepLog:[]).some(e=>e&&e.date===j&&Number(e.duration)>0),
    action:'lifestyleSommeil()',bouton:'Saisir'}),
  Object.freeze({cle:'prochaine',type:'repos',lib:'Regarde ta prochaine séance et ses records à portée',
    possible:u=>_mjCreneauActif(u),
    faite:(u,j)=>_mjActe(u,j,'prochaine'),action:'missionProchaineVoir()',bouton:'Voir'}),
  Object.freeze({cle:'reaction_ami',type:'repos',lib:'Réagis à la séance d’un ami',
    possible:(u,j,c)=>Number(c.amis)>0,
    faite:(u,j)=>_mjActe(u,j,'reaction_ami'),action:'ouvrirAmis()',bouton:'Mes potes'})
]);
// PURE. FNV-1a 32 bits, puis mulberry32 : un aléa rejouable.
function _mjHash(s){ let h=0x811c9dc5; for(const ch of String(s)){ h^=ch.codePointAt(0); h=Math.imul(h,0x01000193)>>>0; } return h>>>0; }
function _mjAlea(graine){
  let a=graine>>>0;
  return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
}
function missionGraine(u,jour){ return _mjHash(_cleCompte(u)+'|'+jour); }
// PURE. Le coffre du jour : le PREMIER tirage de la graine.
function coffreTirage(u,jour){
  const r=_mjAlea(missionGraine(u,jour))();
  let cumul=0;
  for(const x of MISSION_COFFRE){ cumul+=x.p; if(r<cumul) return x.gain; }
  return MISSION_COFFRE[MISSION_COFFRE.length-1].gain;
}
// PURE. Le compte a-t-il moins de deux jours, ce jour-là ? Le jour entier
// compte (sa fin) : le tirage ne change pas en cours de journée.
function _mjDebutCompte(u){
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>0).map(s=>Number(s.date));
  const d=Math.min(Number(u&&u.createdAt)||Infinity,Number(u&&u.parcours&&u.parcours.debut)||Infinity,ses.length?Math.min(...ses):Infinity);
  return isFinite(d)?d:0;
}
function _mjFinJour(jour){ const [a,m,d]=String(jour).split('-').map(Number); return new Date(a,m-1,d+1).getTime(); }
function missionCompteJeune(u,jour){ const d=_mjDebutCompte(u); return d>0&&_mjFinJour(jour)-d<MISSION_JEUNE_JOURS*864e5; }
// Le contexte lu sur l'appareil (carnet d'amis) ; un test le donne lui-même.
function _mjContexte(u,ctx){
  const c=Object.assign({},ctx||{});
  if(!c.f){ try{ c.f=_badgesFaits(u,typeof c.maintenant==='number'?c.maintenant:Date.now()); }catch(e){ c.f={records:[]}; } }
  if(c.amis==null){ try{ c.amis=amisListe().length; }catch(e){ c.amis=0; } }
  return c;
}
/**
 * PURE. Les 3 missions du jour `jour` (AAAA-MM-JJ local) : [{cle, lib, type,
 * action?, bouton?, parcours?}]. [] pour un coach.
 */
function missionsDuJour(u,jour,ctx){
  if(!u||u.role==='coach'||!/^\d{4}-\d{2}-\d{2}$/.test(String(jour||''))) return [];
  const c=_mjContexte(u,ctx);
  // Les deux premiers jours : les étapes du parcours, pas encore le coffre.
  const p=u.parcours;
  if(missionCompteJeune(u,jour)&&p&&!p.existant&&!p.fini){
    const et=p.etapes||{};
    return parcoursEtapes(undefined,p.jeu).filter(x=>!et[x.cle]).slice(0,3)
      .map(x=>({cle:'parcours:'+x.cle,lib:x.lib,type:'parcours',parcours:true,action:x.action||null,bouton:x.bouton||null}));
  }
  const type=nutIsOnDayCalendrier(jour,u)?'seance':'repos';
  const tca=aTCA(u);
  const l=MISSIONS.filter(m=>m.type===type&&!(m.nutrition&&tca)&&(!m.possible||(()=>{ try{ return !!m.possible(u,jour,c); }catch(e){ return false; } })()));
  // Le mélange : Fisher-Yates sur la même graine, APRÈS le tirage du coffre.
  const r=_mjAlea(missionGraine(u,jour)); r();
  const t=l.slice();
  for(let i=t.length-1;i>0;i--){ const k=Math.floor(r()*(i+1)); [t[i],t[k]]=[t[k],t[i]]; }
  // Un jour de séance garde l'ordre de la table (séance, record, RIR).
  return (type==='seance'?l:t).slice(0,3).map(m=>({cle:m.cle,lib:m.lib,type,action:m.action||null,bouton:m.bouton||null}));
}
/** PURE. L'état du jour : les cases relues dans les faits, la pause, le coffre. */
function missionsEtat(u,jour,ctx){
  const c=_mjContexte(u,ctx);
  const t=typeof c.maintenant==='number'?c.maintenant:Date.now();
  const liste=missionsDuJour(u,jour,c);
  const p=u&&u.parcours, et=(p&&p.etapes)||{};
  const missions=liste.map(m=>{
    let faite=false;
    if(m.parcours) faite=!!et[m.cle.slice(9)];
    else { const d=MISSIONS.find(x=>x.cle===m.cle); try{ faite=!!(d&&d.faite(u,jour,c)); }catch(e){ faite=false; } }
    return Object.assign({},m,{faite});
  });
  let pause=false; try{ pause=!!suspensionEtat(u,t).actif; }catch(e){ pause=false; }
  const parcours=missions.some(m=>m.parcours);
  const toutes=missions.length===3&&missions.every(m=>m.faite);
  const coffre=(u&&u.missions&&u.missions[jour]&&u.missions[jour].coffre)||null;
  return {jour,missions,toutes,pause,parcours,coffre,ouvrable:toutes&&!pause&&!parcours&&!coffre};
}
// ÉCRIT. Un acte vu par l'app (minuteur fini, prochaine séance ouverte,
// réaction envoyée), daté dans u.missions[jour].actes.
function missionActe(u,k,t){
  if(!u||u.role==='coach') return false;
  const at=typeof t==='number'?t:Date.now(), j=_xpJour(at);
  u.missions=(u.missions&&typeof u.missions==='object')?u.missions:{};
  const m=u.missions[j]=(u.missions[j]&&typeof u.missions[j]==='object')?u.missions[j]:{};
  m.actes=(m.actes&&typeof m.actes==='object')?m.actes:{};
  if(Number(m.actes[k])>0) return false;
  m.actes[k]=at;
  return true;
}
// ÉCRIT. Le détail (faites, actes) d'un jour ancien part ; le coffre reste,
// c'est lui qui porte les volts et le badge.
function _mjPurger(u,t){
  const lim=localISODate(_datePlusJours(t,-MISSION_GARDE_DETAIL_J));
  for(const j of Object.keys(u.missions||{})){
    const m=u.missions[j];
    if(j>=lim||!m||typeof m!=='object') continue;
    if(m.coffre) u.missions[j]={coffre:m.coffre}; else delete u.missions[j];
  }
}
/**
 * ÉCRIT. Ouvre le coffre du jour : rend {gain, at} (gain : 20, 50, 'joker',
 * 'double'), ou null. Le joker se pose ici, dans u.streakJokers ; la réserve
 * pleine, il vaut +50 V.
 */
function ouvrirCoffre(u,jour,ctx){
  const c=_mjContexte(u,ctx);
  const t=typeof c.maintenant==='number'?c.maintenant:Date.now();
  const e=missionsEtat(u,jour,c);
  if(!e.ouvrable) return null;
  let gain=coffreTirage(u,jour);
  if(gain==='joker'){
    const n=Math.max(0,Number(u.streakJokers)||0);
    if(n>=STREAK_JOKERS_MAX) gain=MISSION_VOLTS_MAX; else u.streakJokers=n+1;
  }
  u.missions=(u.missions&&typeof u.missions==='object')?u.missions:{};
  const m=Object.assign({},u.missions[jour]||{});
  m.faites=e.missions.map(x=>x.cle);
  m.coffre={gain,at:t};
  u.missions[jour]=m;
  _mjPurger(u,t);
  return m.coffre;
}
/** PURE. Les volts des coffres, par jour : [[jour, volts]] (xpCalcul). */
function missionVoltsParJour(u,t){
  const out=[];
  const ms=(u&&u.missions&&typeof u.missions==='object')?u.missions:{};
  const ses=((u&&u.sessions)||[]).filter(s=>s&&Number(s.date)>0&&s.date<=t&&seanceComptee(s)).sort((a,b)=>a.date-b.date);
  for(const j of Object.keys(ms)){
    const k=ms[j]&&ms[j].coffre, at=Number(k&&k.at)||0;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(j)||!(at>0)||at>t) continue;
    if(typeof k.gain==='number') out.push([j,Math.max(0,Math.min(MISSION_VOLTS_MAX,k.gain))]);
    else if(k.gain==='double'){
      // La PROCHAINE séance après l'ouverture : ses volts une deuxième fois.
      const s=ses.find(x=>x.date>at);
      if(s) out.push([_xpJour(s.date),voltsSeance(s)]);
    }
  }
  return out;
}
/** PURE. SEPT SUR SEPT : la date du 7e coffre de 7 jours d'affilée, ou 0. */
function missionSeptSurSept(u){
  const ms=(u&&u.missions&&typeof u.missions==='object')?u.missions:{};
  const j=Object.keys(ms).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&Number(ms[k]&&ms[k].coffre&&ms[k].coffre.at)>0).sort();
  let suite=0, prec=null;
  for(const k of j){
    const d=new Date(+k.slice(0,4),+k.slice(5,7)-1,+k.slice(8,10)).getTime();
    suite=(prec!==null&&Math.round((d-prec)/864e5)===1)?suite+1:1;
    prec=d;
    if(suite>=7) return Number(ms[k].coffre.at);
  }
  return 0;
}
// ── LA CARTE, sous l'en-tête de l'accueil ────────────────────────────────
function _mjLibGain(g){
  return g==='joker'?'Un joker de série':g==='double'?'Volts doublés sur ta prochaine séance':'+'+g+' V';
}
/** PURE. La carte « Mission du jour ». */
function htmlMissionDuJour(e){
  if(!e||!e.missions.length) return '';
  const E=escapeHtml, n=e.missions.filter(m=>m.faite).length;
  const cases=e.missions.map(m=>'<li class="mj-case'+(m.faite?' on':'')+'">'
    +'<span class="mj-coche" aria-hidden="true">'+(m.faite?icon('coche',14):'')+'</span>'
    +'<span class="mj-lib">'+E(m.lib)+'<span class="mj-lu">'+(m.faite?' : faite':' : à faire')+'</span></span>'
    +(!m.faite&&!e.pause&&m.action&&m.bouton?'<button type="button" class="btn btn-outline btn-sm mj-b" onclick="'+m.action+'">'+E(m.bouton)+'</button>':'')
    +'</li>').join('');
  let pied='';
  if(e.pause) pied='<div class="mj-note">Missions en pause pendant ta suspension.</div>';
  else if(e.parcours) pied='<div class="mj-note">Le coffre s’ouvre à partir de ton 3e jour.</div>';
  else if(e.coffre) pied='<div class="mj-coffre mj-ouvert" role="status">'+icon('cadeau',16)
    +' <b class="mj-gain"'+(typeof e.coffre.gain==='number'?' data-gain="'+e.coffre.gain+'"':'')+'>'+E(_mjLibGain(e.coffre.gain))+'</b></div>';
  else if(e.ouvrable) pied='<button type="button" class="btn btn-red mj-ouvrir" onclick="missionOuvrirCoffre(this)">'+icon('cadeau',16)+' Ouvrir</button>';
  else pied='<div class="mj-note">Les trois faites : un coffre s’ouvre.</div>';
  return '<section class="mj-carte" role="region" aria-label="Mission du jour">'
    +'<div class="mj-tete"><b>'+(e.parcours?'Tes premières missions':'Mission du jour')+'</b><span>'+n+'/3</span></div>'
    +'<ul class="mj-liste">'+cases+'</ul>'+pied+'</section>';
}
function _rendreMission(u){
  const z=document.getElementById('clh-mission');
  if(!z) return null;
  if(!u||u.role==='coach'){ z.innerHTML=''; return null; }
  let e=null; try{ e=missionsEtat(u,localISODate(new Date())); }catch(er){ e=null; }
  z.innerHTML=htmlMissionDuJour(e);
  return e;
}
// Le bouton « Ouvrir » : le tirage, l'animation courte (arcCompteur), les
// volts et le badge.
function missionOuvrirCoffre(btn){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return null;
  const k=ouvrirCoffre(u,localISODate(new Date()));
  if(!k) return null;
  try{ saveUser(); }catch(e){ rcErreurMuette('missionOuvrirCoffre',e); }
  const e=_rendreMission(u);
  try{
    const g=document.querySelector('#clh-mission .mj-gain');
    if(g&&typeof k.gain==='number'){ g.dataset.valeur='0'; arcCompteur(g,k.gain,{duree:ARC.release,format:x=>'+'+Math.round(x)+' V'}); }
  }catch(er){}
  try{ majBadges(); }catch(er){}
  try{ majXp(); _rendreRang(u); }catch(er){}
  return e&&e.coffre;
}
// ── Les actes vus par l'app ───────────────────────────────────────────────
let _mjMinuteur=null;
function missionMobiliteLancer(){
  if(_mjMinuteur) return false;
  const d=document.createElement('div');
  d.className='mj-minuteur'; d.setAttribute('role','dialog'); d.setAttribute('aria-label','Mobilité, 10 minutes');
  d.innerHTML='<div class="mj-min-c"><div class="mj-min-t">Mobilité</div><div class="mj-min-v" aria-live="polite">10:00</div>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="missionMobiliteArreter()">Arrêter</button></div>';
  document.body.appendChild(d);
  const debut=Date.now();
  const tic=()=>{
    const reste=Math.max(0,MISSION_MOBILITE_S-Math.floor((Date.now()-debut)/1000));
    const v=d.querySelector('.mj-min-v'); if(v) v.textContent=Math.floor(reste/60)+':'+String(reste%60).padStart(2,'0');
    if(reste>0) return;
    missionMobiliteArreter();
    const u=currentUser;
    if(missionActe(u,'mobilite')){ try{ saveUser(); }catch(e){ rcErreurMuette('missionMobiliteLancer',e); } }
    try{ toast(ICO.coche+' 10 min de mobilité','var(--green)'); }catch(e){}
    try{ _rendreMission(u); }catch(e){}
  };
  _mjMinuteur={d,id:setInterval(tic,1000)};
  return true;
}
function missionMobiliteArreter(){
  if(!_mjMinuteur) return false;
  clearInterval(_mjMinuteur.id);
  try{ _mjMinuteur.d.remove(); }catch(e){}
  _mjMinuteur=null;
  return true;
}
// La prochaine séance et ses records à portée (_recordsAPorteeParJour).
function htmlProchaineSeance(u,maintenant){
  const t=typeof maintenant==='number'?maintenant:Date.now();
  const cfg=(u&&u.sessions_config)||[];
  const auj=(new Date(t).getDay()+6)%7;
  let c=null, dj=0;
  for(let k=1;k<=7&&!c;k++){ const s=cfg[(auj+k)%7]; if(s&&s.active&&Array.isArray(s.exercises)&&s.exercises.length){ c=s; dj=k; } }
  if(!c) return '<p class="mj-note">Aucune séance prévue cette semaine.</p>';
  let o=null; try{ o=recordAPortee(u,c,t); }catch(e){ o=null; }
  let rap={}; try{ rap=_recordsAPorteeParJour(u,t)||{}; }catch(e){ rap={}; }
  const autres=Object.keys(rap).map(k=>rap[k]).filter(Boolean);
  const quand=dj===1?'Demain':new Date(t+dj*864e5).toLocaleDateString('fr-FR',{weekday:'long'}).replace(/^./,x=>x.toUpperCase());
  return '<div class="mj-pro-t">'+escapeHtml(quand+' · '+(c.name||c.nom||'Ta séance'))+'</div>'
    +'<ul class="mj-pro-l">'+c.exercises.slice(0,8).map(x=>'<li>'+escapeHtml(String((x&&(x.name||x.nom))||''))+'</li>').join('')+'</ul>'
    +(o?htmlRecordAPortee(o,'accueil'):'')
    +(autres.length?'<div class="mj-note">'+autres.map(escapeHtml).join('<br>')+'</div>':'');
}
function missionProchaineVoir(){
  const u=currentUser;
  if(!u) return false;
  const d=document.createElement('div');
  d.className='mj-feuille'; d.setAttribute('role','dialog'); d.setAttribute('aria-label','Ta prochaine séance');
  d.innerHTML='<div class="mj-feuille-c">'+htmlProchaineSeance(u)
    +'<button type="button" class="btn btn-outline btn-sm" onclick="this.closest(\'.mj-feuille\').remove()">Fermer</button></div>';
  d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
  document.body.appendChild(d);
  if(missionActe(u,'prochaine')){ try{ saveUser(); }catch(e){ rcErreurMuette('missionProchaineVoir',e); } }
  try{ _rendreMission(u); }catch(e){}
  return true;
}
// ══ LES LIGUES (01/10/2026) ═══════════════════════════════════════════════
//
// Chaque lundi, le serveur range les athlètes actifs en groupes de 20 par
// division (BRONZE → LÉGENDE) ; le lundi suivant, le top 5 monte, les 5
// derniers descendent (cloudflare/src/ligues.js). LE SCORE EST CELUI DU
// SERVEUR, les volts d'entraînement de la semaine : l'app ne calcule rien,
// elle LIT ligues_membres/<moi> (sa ligue) puis ligues_public/<lundi>/<groupe>
// (lisible par les seuls membres du groupe), et n'écrit jamais dans les
// ligues. Les résultats (ligues_resultats/<moi>) arrivent avec les autres
// récompenses du serveur (majRecompensesServeur) et datent PROMU et SOMMET.
// ⚠ Le classement affiché suit la règle du serveur : volts, puis séances,
//   puis la dernière séance la plus tôt. Hors ligue (coach, opt-out
//   u.liguesOff, suspension, absent deux semaines) : pas de carte.
const LIGUES_DIVISIONS=Object.freeze([
  {cle:'bronze',nom:'BRONZE'},{cle:'acier',nom:'ACIER'},{cle:'voltage',nom:'VOLTAGE'},
  {cle:'foudre',nom:'FOUDRE'},{cle:'titan',nom:'TITAN'},{cle:'legende',nom:'LÉGENDE'}
].map(Object.freeze));
const LIGUE_CACHE_MS=10*60e3;
let _ligue={lu:0,cle:'',v:null};
function ligueIndex(cle){ return Math.max(0,LIGUES_DIVISIONS.findIndex(d=>d.cle===cle)); }
function ligueNomDivision(cle){ return LIGUES_DIVISIONS[ligueIndex(cle)].nom; }
// Combien montent (et descendent) : 5 à partir de 15 membres, un tiers en dessous.
function ligueNMonte(n){ return Math.max(0,Math.min(5,Math.floor(n/3))); }
/** PURE. Le classement du groupe (ligues_public) : [{cle, nom, v, n, der, place}]. */
function ligueClasser(pub){
  const l=Object.keys((pub&&typeof pub==='object')?pub:{}).map(k=>{ const x=pub[k]||{};
    return {cle:k,nom:String(x.nom||k).slice(0,40),v:Math.max(0,Math.round(Number(x.v)||0)),n:Math.max(0,Number(x.n)||0),der:Number(x.der)||0}; });
  l.sort((a,b)=>(b.v-a.v)||(b.n-a.n)||((a.der||Infinity)-(b.der||Infinity))||(a.cle<b.cle?-1:1));
  return l.map((x,i)=>Object.assign(x,{place:i+1}));
}
/** PURE. L'état de ma ligue : division, lignes avec leur zone, ma place. */
function ligueEtat(m,pub){
  if(!m||!m.lundi||!m.groupe) return null;
  const lignes=ligueClasser(pub), n=lignes.length, q=ligueNMonte(n), d=ligueIndex(m.division);
  for(const x of lignes) x.zone=(x.place<=q&&d<LIGUES_DIVISIONS.length-1)?'monte':(x.place>n-q&&d>0)?'descend':'';
  const moi=lignes.find(x=>x.nom===m.nom)||null;
  return {division:m.division||'bronze',groupe:m.groupe,lundi:m.lundi,lignes,taille:n,q,moi};
}
function _lgPlace(p){ return p+(p===1?'er':'e'); }
/** PURE. La carte de l'accueil, sous le rang. */
function htmlLigueAccueil(e){
  if(!e||!e.moi) return '';
  const E=escapeHtml, z=e.moi.zone;
  const etat=z==='monte'?'Zone de montée':z==='descend'?'Zone de descente':(e.q?'Le top '+e.q+' monte':'');
  return '<button type="button" class="lg-carte'+(z?' lg-'+z:'')+'" onclick="ouvrirLigue()" aria-label="Ma ligue '+E(ligueNomDivision(e.division))+', '+_lgPlace(e.moi.place)+' sur '+e.taille+'">'
    +'<span class="lg-ico" aria-hidden="true">'+icon('bouclier',16)+'</span>'
    +'<span class="lg-txt"><b>Ligue '+E(ligueNomDivision(e.division))+'</b><span>'+E(_lgPlace(e.moi.place)+' sur '+e.taille+(etat?' · '+etat:''))+'</span></span>'
    +'<span class="lg-v">'+E(xpFormat(e.moi.v))+' V</span></button>';
}
/** PURE. L'écran : la liste, zones de montée et de descente colorées. */
function htmlLigueListe(e,off){
  const E=escapeHtml;
  if(off) return '<div class="lg-hors">Tu ne participes pas aux ligues.</div>'
    +'<button type="button" class="btn btn-red btn-sm" onclick="liguesBasculer(true)">Rejoindre les ligues</button>';
  if(!e) return emptyState('','Pas de ligue cette semaine. Une séance, et tu entres dans une ligue de ta division.');
  const lignes=e.lignes.map(x=>'<li class="lg-ligne'+(x.zone?' lg-'+x.zone:'')+(e.moi&&x.cle===e.moi.cle?' lg-moi':'')+'">'
    +'<span class="lg-p">'+x.place+'</span><span class="lg-nom">'+E(x.nom)+'</span>'
    +'<span class="lg-n">'+x.n+' séance'+(x.n>1?'s':'')+'</span><span class="lg-pts">'+E(xpFormat(x.v))+' V</span></li>').join('');
  return '<div class="lg-tete"><b>Ligue '+E(ligueNomDivision(e.division))+'</b><span>'+e.taille+' athlètes · se clôt dimanche soir</span></div>'
    +'<div class="lg-legende"><span class="lg-l-monte">Les '+e.q+' premiers montent</span>'
    +(ligueIndex(e.division)>0?'<span class="lg-l-descend">Les '+e.q+' derniers descendent</span>':'')+'</div>'
    +'<ol class="lg-liste">'+lignes+'</ol>'
    +'<p class="lg-note">Le score : tes volts d’entraînement de la semaine, comptés par le serveur. À égalité, le nombre de séances, puis la séance la plus tôt.</p>'
    +'<button type="button" class="lg-off" onclick="liguesBasculer(false)">Ne plus participer aux ligues</button>';
}
async function chargerLigue(force){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach'||u.liguesOff||!SERVEUR_LEGER||!CLOUD||!CLOUD.ok()) return null;
  const moi=_cleCompte(u);
  if(!force&&_ligue.cle===moi&&Date.now()-_ligue.lu<LIGUE_CACHE_MS) return _ligue.v;
  _ligue={lu:Date.now(),cle:moi,v:_ligue.cle===moi?_ligue.v:null};
  // HORS LIGNE (ou un refus passager) : la dernière ligue connue reste.
  const m=await _fbJson('ligues_membres/'+moi);
  if(!m.ok) return _ligue.v;
  if(!m.v||!m.v.lundi||!m.v.groupe){ _ligue.v=null; return null; }
  const p=await _fbJson('ligues_public/'+m.v.lundi+'/'+m.v.groupe);
  if(!p.ok) return _ligue.v;
  _ligue.v={m:m.v,pub:p.v};
  return _ligue.v;
}
function _ligueEtatCourant(){ const v=_ligue.v; return v?ligueEtat(v.m,v.pub):null; }
function _rendreLigue(u){
  const z=document.getElementById('clh-ligue');
  if(!z) return null;
  if(!u||u.role==='coach'||u.liguesOff){ z.innerHTML=''; z.hidden=true; return null; }
  const peindre=()=>{ const e=_ligueEtatCourant(); z.innerHTML=htmlLigueAccueil(e); z.hidden=!z.innerHTML; return e; };
  const e=peindre();
  chargerLigue().then(()=>{ try{ peindre(); }catch(er){} }).catch(()=>{});
  return e;
}
function ouvrirLigue(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  document.querySelectorAll('.lg-feuille').forEach(x=>x.remove());
  const d=document.createElement('div');
  d.className='lg-feuille'; d.setAttribute('role','dialog'); d.setAttribute('aria-label','Ma ligue');
  const peindre=()=>{ d.innerHTML='<div class="lg-feuille-c">'+htmlLigueListe(_ligueEtatCourant(),!!u.liguesOff)
    +'<button type="button" class="btn btn-outline btn-sm" onclick="this.closest(\'.lg-feuille\').remove()">Fermer</button></div>'; };
  peindre();
  d.addEventListener('click',e=>{ if(e.target===d) d.remove(); });
  document.body.appendChild(d);
  chargerLigue(true).then(()=>{ if(d.isConnected) peindre(); }).catch(()=>{});
  return true;
}
// L'opt-out : u.liguesOff. Le serveur le lit au lundi suivant (hors ligue).
function liguesBasculer(on){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(on) delete u.liguesOff; else u.liguesOff=true;
  try{ saveUser(); }catch(e){ rcErreurMuette('liguesBasculer',e); }
  try{ toast(on?'Tu rejoins les ligues dès ta prochaine séance.':'Tu ne participes plus aux ligues.','var(--green)'); }catch(e){}
  try{ _rendreLigue(u); }catch(e){}
  document.querySelectorAll('.lg-feuille').forEach(x=>x.remove());
  return true;
}
/** PURE (écrit dans u). Les résultats du serveur, recopiés une fois : PROMU, SOMMET. */
function liguesFusionnerResultats(u,r){
  if(!u||!r||typeof r!=='object') return 0;
  const m=(u.liguesReleves&&typeof u.liguesReleves==='object')?u.liguesReleves:{};
  let n=0;
  for(const l of Object.keys(r)){
    const x=r[l];
    if(!/^\d{4}-\d{2}-\d{2}$/.test(l)||!x||typeof x!=='object'||m[l]) continue;
    m[l]={division:ligueIndex(x.division)>=0?LIGUES_DIVISIONS[ligueIndex(x.division)].cle:'bronze',vers:LIGUES_DIVISIONS[ligueIndex(x.vers)].cle,
      place:Math.max(0,Math.round(Number(x.place)||0)),mouvement:['monte','descend','reste','sorti'].indexOf(x.mouvement)>=0?x.mouvement:'reste',
      taille:Math.max(0,Math.round(Number(x.taille)||0)),at:Number(x.at)||0};
    n++;
  }
  if(n) u.liguesReleves=m;
  return n;
}
/** PURE. PROMU : la 1re montée ; SOMMET : 1er d'une semaine en LÉGENDE. Des dates. */
function liguesFaits(u){
  const m=(u&&u.liguesReleves&&typeof u.liguesReleves==='object')?u.liguesReleves:{};
  const l=Object.keys(m).sort().map(k=>m[k]).filter(x=>x&&Number(x.at)>0);
  const p=l.find(x=>x.mouvement==='monte'), s=l.find(x=>x.division==='legende'&&x.place===1&&x.mouvement!=='sorti');
  return {promu:p?Number(p.at):0,sommet:s?Number(s.at):0};
}
