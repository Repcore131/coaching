// ── L'ÉCRAN ────────────────────────────────────────────────────────────────
const _anatEnCours=new Set();
const _anatSilEnCours=new Set();
const _anatSuiviEnCours=new Set();
/** Les bilans à photos de face et de dos dont la posture n'est pas encore lue. */
function anatPostureAFaire(c){
  const a=c&&c.morphoAnat;
  if(!a||a.v!==ANAT_VERSION) return [];
  const faits=new Set((Array.isArray(a.suivi)?a.suivi:[]).map(x=>Number(x.bilan)));
  let bl=[]; try{ bl=(Array.isArray(c.bilans)?c.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  return bl.filter(b=>!faits.has(Number(b.date))&&Number(b.date)!==Number(a.bilan)
    &&(()=>{ try{ return !!photoBilanSrc(b,'face')&&!!photoBilanSrc(b,'back'); }catch(e){ return false; } })());
}
/**
 * Lit, un bilan à la fois, les photos de face et de dos, et range les quatre
 * nombres posturaux (A23). CÔTÉ COACH. Aucune image, aucun point gardés.
 */
async function anatSuivrePosture(email){
  if(_anatSuiviEnCours.has(email)||_anatEnCours.has(email)||_anatSilEnCours.has(email)) return false;
  const c0=(DB.get('users')||{})[email];
  if(!c0||!currentUser||c0.coachId!==currentUser.id) return false;
  const aFaire=anatPostureAFaire(c0);
  if(!aFaire.length) return false;
  _anatSuiviEnCours.add(email);
  const lus=[];
  try{
    await chargerMotionLab();
    const lire=(typeof window!=='undefined')?/** @type {any} */(window).mlAnatPhoto:null;
    if(typeof lire!=='function') throw new Error('lecture indisponible');
    for(const b of aFaire){
      const vue=async(nom,src)=>{ let r=null; try{ r=await lire(src,{}); }catch(e){ r=null; }
        const auto=(r&&r.ok)?anatPointsAuto(r,nom):null; return auto?{w:r.w,h:r.h,auto,man:null}:null; };
      const fa=await vue('face',photoBilanSrc(b,'face')), da=await vue('dos',photoBilanSrc(b,'back'));
      if(!fa){ lus.push({bilan:Number(b.date),mesures:null}); continue; }
      const tmp={v:ANAT_VERSION,bilan:Number(b.date),face:fa,dos:da,opts:{}};
      const r=_anatSafe(()=>anatMesures(tmp,c0,{brut:true}));
      const m=r?anatMesuresPosture(r):null;
      lus.push(m?{bilan:Number(b.date),mesures:m.mesures,conf:m.conf}:{bilan:Number(b.date),mesures:null});
    }
  }catch(e){}
  _anatSuiviEnCours.delete(email);
  if(!lus.length) return false;
  const users=DB.get('users')||{}, d=users[email];
  if(!d||!d.morphoAnat) return false;
  const deja=new Set(lus.map(x=>x.bilan));
  d.morphoAnat.suivi=(Array.isArray(d.morphoAnat.suivi)?d.morphoAnat.suivi:[]).filter(x=>!deja.has(Number(x.bilan))).concat(lus);
  d.updatedAt=Date.now(); users[email]=d;
  DB.set('users',users);
  CLOUD.pushOne(email,d);
  try{ const cc=getOwnedClient(currentClientId); if(cc&&cc.email===email) renderAnatCoach(cc); }catch(e){}
  return true;
}
/** Les bilans à photo de face dont la silhouette n'est pas encore lue. */
function anatSilhouettesAFaire(c){
  const a=c&&c.morphoAnat;
  if(!a||a.v!==ANAT_VERSION) return [];
  const faits=new Set((Array.isArray(a.silhouettes)?a.silhouettes:[]).map(x=>Number(x.bilan)));
  let bl=[]; try{ bl=(Array.isArray(c.bilans)?c.bilans:[]).filter(b=>b&&b.date); }catch(e){ bl=[]; }
  // Le bilan analysé aussi : son V vient de l'analyse, mais ses hanches (le X) de là.
  return bl.filter(b=>!faits.has(Number(b.date))
    &&(()=>{ try{ return !!photoBilanSrc(b,'face'); }catch(e){ return false; } })());
}
/**
 * Lit, en arrière-plan et un bilan à la fois, deltoïdes, taille et hanches sur
 * chaque photo de face. CÔTÉ COACH. Il ne reste que six points, V, X, la
 * confiance et la date du bilan — ni les 33 points du moteur, ni le masque.
 * Un bilan illisible est noté (V null) pour ne pas être relu à chaque écran.
 */
async function anatSuivreSilhouettes(email){
  if(_anatSilEnCours.has(email)||_anatEnCours.has(email)) return false;
  const c0=(DB.get('users')||{})[email];
  if(!c0||!currentUser||c0.coachId!==currentUser.id) return false;
  const aFaire=anatSilhouettesAFaire(c0);
  if(!aFaire.length) return false;
  _anatSilEnCours.add(email);
  const lus=[];
  try{
    await chargerMotionLab();
    const lire=(typeof window!=='undefined')?/** @type {any} */(window).mlAnatPhoto:null;
    if(typeof lire!=='function') throw new Error('lecture indisponible');
    for(const b of aFaire){
      let r=null; try{ r=await lire(photoBilanSrc(b,'face'),{}); }catch(e){ r=null; }
      const sil=(r&&r.ok)?anatSilhouetteDe(r):null;
      lus.push(sil?{bilan:Number(b.date),V:sil.V,X:sil.X,conf:sil.conf,pts:sil.pts,w:sil.w,h:sil.h}:{bilan:Number(b.date),V:null});
    }
  }catch(e){}
  _anatSilEnCours.delete(email);
  if(!lus.length) return false;
  const users=DB.get('users')||{};
  const d=users[email];
  if(!d||!d.morphoAnat) return false;
  const deja=new Set(lus.map(x=>x.bilan));
  d.morphoAnat.silhouettes=(Array.isArray(d.morphoAnat.silhouettes)?d.morphoAnat.silhouettes:[]).filter(x=>!deja.has(Number(x.bilan))).concat(lus);
  d.updatedAt=Date.now();
  users[email]=d;
  DB.set('users',users);
  CLOUD.pushOne(email,d);
  try{ const cc=getOwnedClient(currentClientId); if(cc&&cc.email===email) renderAnatCoach(cc); }catch(e){}
  return true;
}
const _anatEchecs=new Map();
let _anatVueActive='face';
/** L'édition des points en cours : {email, vue, pts, opts, auto:boolean} ou null. */
let _anatEdit=null;
const ANAT_SVG={
  tete:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="4.5" r="2.2"/><path d="M8 21l1.2-7.5M16 21l-1.2-7.5M7 9.5c1.5-1.4 3.2-2 5-2s3.5.6 5 2M9.2 13.5h5.6M12 7.5v6"/></svg>',
  loupe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5M8 10.5h5M10.5 8v5"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 9l6 6 6-6"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>',
  msg:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/></svg>',
  relancer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
  points:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="9" r="2.2"/><circle cx="9" cy="18" r="2.2"/><path d="M8 7l8 1.6M16.8 10.8l-6.4 5.6"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  export:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v7H6z"/></svg>',
  disquette:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/></svg>',
  cadrer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/><circle cx="12" cy="9" r="2"/><path d="M9 17l1-4h4l1 4"/></svg>',
  entiere:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>',
  gauche:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M15 6l-6 6 6 6"/></svg>',
  droite:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 6l6 6-6 6"/></svg>',
  reglage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  recadrer:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 2v16h16M2 6h16v16"/></svg>',
  squat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"><circle cx="13" cy="4" r="2"/><path d="M4 8h16M12 8l-3 6 5 2-1 6M9 14l-4 1"/></svg>',
  souleve:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"><circle cx="9" cy="4.5" r="2"/><path d="M9 7l4 5v8M13 12l-6 1M3 20h18M5 17v6M19 17v6"/></svg>',
  couples:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"><path d="M12 4v16M7 20h10M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z"/></svg>',
  developpe:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"><path d="M2 6h20M5 3v6M19 3v6M8 6v7M16 6v7M4 17h16M6 17l2-4h8l2 4"/></svg>'
};
/** Les segments dessinés : [a, b, classe]. Les paires se dédoublent par côté. */
const ANAT_TRAITS={
  face:[['acromion_l','acromion_r','an-t-os'],['epaule_l','epaule_r',''],['hanche_l','hanche_r',''],['crete_l','crete_r','an-t-os'],
    ['deltoide_l','deltoide_r','an-t-sil'],['taille_l','taille_r','an-t-sil'],
    ['epaule_*','coude_*',''],['coude_*','poignet_*',''],['epaule_*','hanche_*','an-t-fin'],['hanche_*','genou_*',''],
    ['genou_*','cheville_*',''],['cheville_*','talon_*','an-t-fin'],['talon_*','pointe_*','an-t-fin']],
  dos:[['acromion_l','acromion_r','an-t-os'],['epaule_l','epaule_r',''],['hanche_l','hanche_r',''],['crete_l','crete_r','an-t-os'],
    ['omoplate_l','omoplate_r','an-t-os'],['omoplate_int_l','omoplate_int_r','an-t-os'],['c7','sacrum','an-t-axe'],['taille_l','taille_r','an-t-sil'],
    ['epaule_*','coude_*',''],['coude_*','poignet_*',''],['epaule_*','hanche_*','an-t-fin'],['hanche_*','genou_*',''],
    ['genou_*','cheville_*',''],['cheville_*','talon_*','an-t-fin'],
    ['mollet_*','achille_*','an-t-axe'],['achille_*','talon_*','an-t-axe']],
  profil:[['c7','tragus','an-t-axe'],['acromion','trochanter',''],['trochanter','genou',''],['genou','malleole',''],['malleole','talon','an-t-fin']]
};
function _anatTraits(vue){
  const out=[];
  for(const [a,b,c] of ANAT_TRAITS[vue]||[]){
    if(a.endsWith('_*')) for(const s of ['l','r']) out.push([a.replace('*',s),b.replace('*',s),c]);
    else out.push([a,b,c]);
  }
  return out;
}

/**
 * LES CONSIGNES DE PLACEMENT, une par repère — l'étoile « * » de l'écran
 * d'édition. Kevin : « donne le nom des points et une consigne sur comment
 * ils doivent être placés ». Écrites pour une photo, pas pour la palpation :
 * ce qu'on VOIT, et où ça tombe quand on ne le voit pas.
 */
const ANAT_AIDE=Object.freeze({
  vertex:{court:'Crâne',aide:'Le point le plus haut du crâne, cheveux aplatis : c’est lui qui fixe l’échelle avec les talons. Si le téléphone cache le visage, estime le haut de la tête dans l’axe du cou : jamais la lampe ou le mur derrière.'},
  acromion:{court:'Acromion',aide:'La pointe osseuse du dessus de l’épaule, là où la clavicule se termine : sur le haut du moignon de l’épaule, 2 à 3 cm en dedans du bord du deltoïde. C’est l’os, pas le muscle.'},
  epaule:{court:'Épaule',aide:'Le centre de l’articulation de l’épaule : au milieu du moignon, environ 3 cm sous l’acromion, dans le prolongement de l’axe du bras.'},
  deltoide:{court:'Deltoïde',aide:'Le bord extérieur du deltoïde, à l’endroit où l’épaule est la plus large sur la photo. Sert au rapport deltoïdes / taille (le V).'},
  coude:{court:'Coude',aide:'Le centre du coude : de face, au milieu du pli du coude ; de dos, sur la pointe du coude (olécrane).'},
  poignet:{court:'Poignet',aide:'Le milieu du poignet, à la hauteur des deux petits os saillants (styloïdes), juste avant la main.'},
  taille:{court:'Taille',aide:'Le bord de la taille à son endroit le plus étroit, entre les dernières côtes et le haut du bassin. Sert au rapport deltoïdes / taille.'},
  crete:{court:'Crête',aide:'Le sommet de l’os du bassin sur le côté : là où l’on pose les mains « sur les hanches », en général à la hauteur du nombril ou juste en dessous, au-dessus de l’élastique du sous-vêtement.'},
  hanche:{court:'Hanche',aide:'Le centre de l’articulation de la hanche : de face, dans le pli de l’aine, à hauteur de la bosse osseuse sur le côté de la cuisse (grand trochanter). Environ 8 à 10 cm sous la crête.'},
  genou:{court:'Genou',aide:'Le centre du genou : de face, au milieu de la rotule ; de dos, au milieu du creux poplité (le pli derrière le genou).'},
  cheville:{court:'Cheville',aide:'Le centre de la cheville, à mi-chemin entre les deux bosses osseuses (malléoles interne et externe).'},
  talon:{court:'Talon',aide:'Le bas du talon, là où il touche le sol. Avec le sommet du crâne, c’est ce point qui met la photo à l’échelle de la taille.'},
  pointe:{court:'Orteil',aide:'Le bout du gros orteil. Sert à lire l’ouverture du pied (talon → orteil).'},
  c7:{court:'C7',aide:'La vertèbre la plus saillante à la base du cou (C7) : la bosse qui dépasse le plus quand on penche la tête en avant.'},
  omoplate:{court:'Omoplate',aide:'La pointe basse de l’omoplate (angle inférieur), en général à la hauteur de la 7e côte. Si elle ne se voit pas, suis le bord interne de l’omoplate jusqu’en bas.'},
  sacrum:{court:'Sacrum',aide:'Le milieu entre les deux fossettes du bas du dos (fossettes de Vénus), au-dessus du pli fessier.'},
  tragus:{court:'Tragus',aide:'Le petit cartilage devant le conduit de l’oreille. Si les cheveux le cachent, au milieu de l’oreille, à la hauteur de l’ouverture du conduit.'},
  trochanter:{court:'Trochanter',aide:'La bosse osseuse sur le côté de la hanche (grand trochanter), environ une main sous la crête du bassin, au milieu de l’épaisseur de la cuisse vue de côté.'},
  omoplate_int:{court:'Omo. int.',aide:'Le bord interne de l’omoplate (celui qui longe la colonne), à mi-hauteur entre l’épine de l’omoplate et sa pointe basse. Bras relâchés, il se voit comme un relief vertical de chaque côté du dos.'},
  mollet:{court:'Mollet',aide:'De dos, le milieu du mollet à mi-hauteur entre le creux du genou et la cheville : au centre de la largeur de la jambe, pas sur le bord du muscle.'},
  achille:{court:'Achille',aide:'De dos, le milieu du tendon d’Achille à la hauteur des malléoles (les bosses de la cheville) : là où la jambe est la plus fine au-dessus du talon.'},
  malleole:{court:'Malléole',aide:'La bosse osseuse à l’extérieur de la cheville (malléole latérale) : c’est par elle que passe le fil à plomb.'}
});
/** Les consignes qui changent de profil (A9) : même repère, autre prise de vue. */
const ANAT_AIDE_PROFIL=Object.freeze({
  acromion:{court:'Acromion',aide:'De profil, la pointe osseuse du dessus de l’épaule, au milieu de l’épaisseur de l’épaule vue de côté, pas le bord avant du deltoïde.'},
  c7:{court:'C7',aide:'De profil, la bosse la plus saillante à la base de la nuque (C7), sur le contour du cou vu de côté, au-dessus de la ligne des épaules.'},
  genou:{court:'Genou',aide:'De profil, le milieu du genou vu de côté (condyle latéral du fémur), à mi-épaisseur entre la rotule et le creux du genou.'},
  talon:{court:'Talon',aide:'Le bas du talon, là où il touche le sol. Avec le sommet du crâne, il met la photo de profil à l’échelle de la taille.'}
});
function anatAide(cle,opts,vue){
  const k=String(cle||'').replace(/_[lr]$/,'');
  if(vue==='profil'&&ANAT_AIDE_PROFIL[k]) return ANAT_AIDE_PROFIL[k];
  if(k==='vertex'&&opts&&opts.cheveux)
    return {court:'Crâne',aide:'L’os, sous les cheveux : estime où le crâne s’arrête sous la masse des cheveux (environ un doigt à deux doigts sous leur sommet pour une coiffure volumineuse), dans l’axe du cou. La marge d’échelle passe à ±'+ANAT_ECHELLE_CHEVEUX_PCT+' %.'};
  return ANAT_AIDE[k]||{court:k,aide:''};
}
/** Où poser le nom d'un point, en hauteur (fraction du cadre) : les repères
 *  voisins — taille et crête, talon et orteil — ne se couvrent plus. */
const ANAT_NOM_DY=Object.freeze({acromion:-0.014,deltoide:0.02,taille:-0.012,crete:0.024,talon:0.03,pointe:0.04,cheville:-0.012,epaule:0.042,achille:0.012});
/** Le nom complet d'un repère, avec le côté de l'écran. */
function anatNomPoint(vue,cle){
  const r=anatRepere(vue,cle);
  return (r?r.lib:cle)+(String(cle).endsWith('_l')?' · écran gauche':String(cle).endsWith('_r')?' · écran droit':'');
}

// ── LES RÉGLAGES DE LA PHOTO ───────────────────────────────────────────────
// Kevin : « donne la possibilité de mettre du contraste, recadrer la photo et
// jouer sur la luminosité ». Rien n'est réécrit : la photo reste celle de
// l'athlète ; les réglages sont un FILTRE d'affichage et un CADRE, rangés dans
// `morphoAnat.opts.photo`. La détection, relancée, lit la photo réglée — c'est
// ce qui sauve une photo à contre-jour.
const ANAT_REGLAGE_DEFAUT=Object.freeze({lum:100,con:100,cadre:null,net:true});
function anatReglage(anat,vue){
  const p=anat&&anat.opts&&anat.opts.photo&&anat.opts.photo[vue];
  const r=Object.assign({},ANAT_REGLAGE_DEFAUT,p||{});
  r.lum=Math.max(40,Math.min(250,Number(r.lum)||100));
  r.con=Math.max(40,Math.min(250,Number(r.con)||100));
  const c=r.cadre;
  r.cadre=(c&&c.x1-c.x0>0.05&&c.y1-c.y0>0.05)?{x0:Math.max(0,c.x0),y0:Math.max(0,c.y0),x1:Math.min(1,c.x1),y1:Math.min(1,c.y1)}:null;
  return r;
}
function anatFiltre(r){
  return (r&&(r.lum!==100||r.con!==100))?'brightness('+r.lum+'%) contrast('+r.con+'%)':'';
}
let _anatRecadre=false;
let _anatSauveMinuteur=null;
/** Écrit un réglage de photo dans le dossier, sans toast à chaque cran. */
function anatReglerPhoto(vue,patch,rendre){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  if(!d||!d.morphoAnat) return;
  const a=d.morphoAnat;
  a.opts=a.opts||{};
  a.opts.photo=a.opts.photo||{};
  a.opts.photo[vue]=Object.assign({},anatReglage(a,vue),patch);
  d.updatedAt=Date.now();
  users[c.email]=d;
  DB.set('users',users);
  clearTimeout(_anatSauveMinuteur);
  _anatSauveMinuteur=setTimeout(()=>{ CLOUD.pushOne(c.email,d); },800);
  if(rendre){ const cc=getOwnedClient(currentClientId); if(cc) renderAnatCoach(cc); }
}
/** Le curseur bouge : on applique tout de suite, on écrit au relâché. */
function anatCurseur(el,nom,fin){
  const z=document.getElementById('ccd-anat');
  const vue=z&&z.querySelector('.an-scene')?.getAttribute('data-vue');
  if(!vue) return;
  const v=Number(el.value)||100;
  const lum=nom==='lum'?v:Number(z.querySelector('input[data-r="lum"]')?.value||100);
  const con=nom==='con'?v:Number(z.querySelector('input[data-r="con"]')?.value||100);
  const f=anatFiltre({lum,con});
  z.querySelectorAll('img[data-v="'+vue+'"]').forEach(i=>{ i.style.filter=f; });
  const l=z.querySelector('.an-loupe'); if(l) l.style.filter=f;
  const s=el.parentElement&&el.parentElement.querySelector('output'); if(s) s.textContent=v+' %';
  if(fin) anatReglerPhoto(vue,{[nom]:v},false);
}
function anatCadrerPersonne(){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  const vue=(_anatEdit&&_anatEdit.vue)||_anatVueDe(c.morphoAnat,_anatVueActive);
  const pts=(_anatEdit&&_anatEdit.pts)||anatPoints(c.morphoAnat,vue)||{};
  const xs=[],ys=[];
  for(const k in pts){ xs.push(pts[k][0]); ys.push(pts[k][1]); }
  if(xs.length<4) return;
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const mx=(x1-x0)*0.18+0.02, my=(y1-y0)*0.05+0.01;
  anatReglerPhoto(vue,{cadre:{x0:x0-mx,y0:y0-my,x1:x1+mx,y1:y1+my}},true);
}
function anatPhotoEntiere(){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  const vue=(_anatEdit&&_anatEdit.vue)||_anatVueDe(c.morphoAnat,_anatVueActive);
  _anatRecadre=false;
  anatReglerPhoto(vue,{cadre:null},true);
}
function anatReinitialiserPhoto(){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  const vue=(_anatEdit&&_anatEdit.vue)||_anatVueDe(c.morphoAnat,_anatVueActive);
  _anatRecadre=false;
  anatReglerPhoto(vue,{lum:100,con:100,cadre:null},true);
}
function anatModeRecadrage(on){
  _anatRecadre=!!on;
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}
/** Choisir un point depuis la liste des repères (et montrer sa consigne). */
function anatChoisirPoint(k){
  if(!_anatEdit) return;
  _anatEdit.sel=k;
  _anatEdit.aide=k;
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}

// ── LA LISTE, LES LEVIERS, LA SAUVEGARDE ──────────────────────────────────
let _anatLevIdx=0;
/** Les menus déroulants de la colonne centrale : ouverts ou fermés. */
let _anatDeplie={lev:true,inf:false};
let _anatToutes=false;
/** L'onglet « À charge égale » (A19) : une barre divergente par articulation, et la lecture du carnet. */
function _htmlCouples(l,c){
  const force=_anatSafe(()=>anatForceCarnet(c))||{};
  const B=ANAT_COUPLES.BORNE, P=ANAT_COUPLES.PROCHE;
  const mot=v=>v>P?'levier plus long : à charge égale, cette articulation travaille plus':(v<-P?'levier plus court : à charge égale, elle travaille moins':'dans la moyenne');
  const barre=v=>{ const x=Math.max(-B,Math.min(B,v)), w=Math.abs(x)/B*50;
    return '<span class="an-cpl-b" role="img" aria-label="'+_anatSN(v,0)+' %"><i class="an-cpl-0"></i><i class="an-cpl-f'+(x<0?' an-cpl-n':'')+'" style="'+(x<0?'right:50%':'left:50%')+';width:'+w.toFixed(1)+'%"></i></span>'; };
  const rows=l.rows.map(r=>{
    const f=force[r.cle], haut=r.arts.reduce((a,b)=>Math.abs(b.pct)>Math.abs(a.pct)?b:a,r.arts[0]);
    const note=f&&f.faible?'<p class="an-cpl-note">Carnet : 1RM estimé '+_anatN(f.e1,0)+' kg ('+escapeHtml(f.nom)+'), à '+_anatN(f.rel*100,0)+' % de tes autres mouvements'
      +(haut.pct>P?' : le levier ('+haut.art+' '+_anatSN(haut.pct,0)+' %) y contribue : à charge égale, le mouvement demande plus.':' : le levier n’explique pas l’écart ('+haut.art+' '+_anatSN(haut.pct,0)+' %).')+'</p>':'';
    return '<div class="an-cpl-r"><b>'+escapeHtml(r.lib)+'</b>'
      +r.arts.map(a=>'<div class="an-cpl-a" title="'+escapeHtml(a.def)+'"><span class="an-cpl-l">'+escapeHtml(a.art)+'</span>'+barre(a.pct)+'<span class="an-cpl-v">'+_anatSN(a.pct,0)+' %</span><span class="an-cpl-m">'+escapeHtml(mot(a.pct))+'</span></div>').join('')
      +note+'</div>';
  }).join('');
  return '<div class="an-cpl"><div class="an-cpl-e" aria-hidden="true"><span class="an-cpl-es"><span>−'+B+' %</span><span>moyenne</span><span>+'+B+' %</span></span></div>'+rows+'</div>'
    +'<p>'+escapeHtml(l.txt)+'</p>'
    +(Object.keys(force).length>1?'<p class="an-lev-n">Carnet : meilleurs 1RM estimés des '+PROG_EX_OBS_JOURS+' derniers jours, ramenés aux '+escapeHtml(ANAT_COUPLES.FORCE_SOURCE)+'.</p>':'');
}
// ── LE DÉVELOPPÉ RÉGLÉ (A18) : θ et l'arche, un état d'écran ─────────────
let _anatDevReg=null, _anatDevL=null;
function _anatDevCfg(){
  const c=getOwnedClient(currentClientId);
  return Object.assign({theta:ANAT_DEV.THETA,arche:false},(_anatDevReg&&_anatDevReg.email===(c&&c.email))?_anatDevReg.cfg:{});
}
function _htmlDeveloppeRes(l){
  _anatDevL=l;
  const cfg=_anatDevCfg(), M=l.modele;
  const moi=anatDeveloppeModele(Object.assign({},M.A,cfg)), ref=anatDeveloppeModele(Object.assign({},M.Rm,cfg));
  const c0=v=>v==null?'-':_anatN(v,0)+'\u00a0cm', c1=v=>_anatN(v,1)+'\u00a0cm';
  const bag=moi.bague>=0?c1(moi.bague)+' à l’intérieur':c1(-moi.bague)+' à l’extérieur';
  const jl=Object.assign({},l,{val:Math.round(moi.trajet),ref:Math.round(ref.trajet)});
  return '<p class="an-dev-p">Prise conseillée : <b>'+c0(moi.index)+' entre index</b> (bagues à '+ANAT_DEV.BAGUES_CM+'\u00a0cm : '+bag+')</p>'
    +'<div class="an-lev-v">'+_anatJauge(jl)+'<div class="an-lev-vt"><strong>'+c0(moi.trajet)+'</strong><em>trajet à cette prise<br>moyenne '+c0(ref.trajet)+'</em>'
      +'<span class="an-lev-leg"><span><i class="l-moi"></i>athlète</span><span><i class="l-moy"></i>moyenne</span></span></div></div>'
    +'<table class="an-tab an-dev-t"><thead><tr><th>Prise</th><th>Largeur</th><th>Entre index</th><th>Trajet</th></tr></thead><tbody>'
      +moi.prises.map((x,i)=>'<tr><th>'+_anatN(x.k,1)+' × la carrure</th><td>'+c0(x.G)+'</td><td>'+c0(x.index)+'</td><td>'+c0(x.trajet)
        +(ref.prises[i].trajet!=null?' <small class="an-def">moy. '+c0(ref.prises[i].trajet)+'</small>':'')+'</td></tr>').join('')
    +'</tbody></table>'
    +'<p>Humérus à '+_anatN(moi.theta,0)+'° du tronc en bas, avant-bras vertical : '+c0(moi.prise)+' de milieu de paume à milieu de paume'+(cfg.arche?', arche de '+ANAT_DEV.ARCHE_CM+'\u00a0cm':'')+'.</p>';
}
function _htmlDeveloppeCtl(l){
  const cfg=_anatDevCfg();
  return '<div class="an-sq an-dev-c" role="group" aria-label="Régler le développé">'
    +'<label class="an-sq-c"><span>Humérus en bas <output id="an-dev-th">'+_anatN(cfg.theta,0)+'°</output></span><input type="range" min="'+ANAT_DEV.THETA_MIN+'" max="'+ANAT_DEV.THETA_MAX+'" step="1" value="'+cfg.theta+'" oninput="anatDevRegler(\'theta\',this.value)" aria-label="Écart de l’humérus au tronc en bas du mouvement"></label>'
    +'<label class="an-sq-k"><input type="checkbox"'+(cfg.arche?' checked':'')+' onchange="anatDevRegler(\'arche\',this.checked)"><span>Arche (−'+ANAT_DEV.ARCHE_CM+' cm)</span></label>'
    +'</div>';
}
function anatDevRegler(k,v){
  const l=_anatDevL; if(!l||!l.modele) return;
  const c=getOwnedClient(currentClientId), cfg=_anatDevCfg();
  cfg[k]=k==='theta'?Number(v):!!v;
  _anatDevReg={email:c&&c.email,cfg};
  const z=document.getElementById('an-dev-res'); if(z) z.innerHTML=_htmlDeveloppeRes(l);
  const o=document.getElementById('an-dev-th'); if(o) o.textContent=_anatN(cfg.theta,0)+'°';
}
/**
 * LES TROIS PRIORITÉS (chantier A22). Score d'une fiche = |niveau| × poids de
 * confiance (A 1, B 0,8, C 0,3) × pertinence pour l'objectif (1 pour les
 * fiches de l'objectif, 0,75 pour les autres). N'entrent que les fiches au
 * moins « nettes » et qui portent une action concrète (aménagement, sinon
 * première recommandation).
 */
const ANAT_PRIO=Object.freeze({CONF:Object.freeze({A:1,B:0.8,C:0.3}),AUTRE:0.75,SEUIL:2,
  OBJ:Object.freeze({hypertrophie:['buste','bras','clavicules'],force:['jambes','bras','buste','genoux'],posture:['epaules','bassin','dos','posture','tete']}),
  LIB:Object.freeze({hypertrophie:'Hypertrophie',force:'Force',posture:'Posture'})});
/** PURE. L'objectif de l'athlète, d'après ce qu'il en a écrit au bilan. */
function anatObjectif(u){
  const t=(_anatSafe(()=>_objectifTexte(u))||'').toLowerCase();
  if(/force|powerlift|record|1 ?rm|compét|strongman/.test(t)) return 'force';
  if(/postur|dos droit|mal de dos|redresser|alignement|maintien/.test(t)) return 'posture';
  return 'hypertrophie';
}
/** PURE. Les trois priorités d'une analyse, pour un objectif. [] quand rien n'est au-dessus de « léger ». */
function anatPriorites(res,objectif){
  const obj=ANAT_PRIO.OBJ[objectif]?objectif:'hypertrophie', rel=ANAT_PRIO.OBJ[obj];
  const out=[];
  for(const f of ((res&&res.fiches)||[])){
    if(!f||f.etat!=='ok'||f.niveau==null||f.grise||Math.abs(f.niveau)<ANAT_PRIO.SEUIL) continue;
    const t=_anatSafe(()=>anatTexte(f,res));
    const am=t&&t.amenager&&t.amenager[0], pr=t&&t.privilegier&&t.privilegier[0];
    const action=am?(am.quoi+' : '+am.reglage):(pr?String(pr):'');
    if(!action) continue;
    const conf=ANAT_PRIO.CONF[f.conf]!=null?ANAT_PRIO.CONF[f.conf]:ANAT_PRIO.CONF.C;
    const score=Math.abs(f.niveau)*conf*(rel.indexOf(f.cle)>=0?1:ANAT_PRIO.AUTRE);
    out.push({cle:f.cle,lib:f.lib,verdict:anatVerdict(f),niveau:f.niveau,conf:f.conf||null,score,action,
      exercices:(am&&am.exercices)||(pr&&pr.exercices)||[],
      // E5 : de quoi la dire à l'athlète — l'exercice, et le réglage sans un mot du lexique.
      quoi:(am&&am.quoi)||'',consigne:(am&&am.consigne)||''});
  }
  return out.sort((a,b)=>b.score-a.score||Math.abs(b.niveau)-Math.abs(a.niveau)).slice(0,3);
}
let _anatPrioObj=null;
function anatPrioObjectif(o){
  _anatPrioObj=ANAT_PRIO.OBJ[o]?o:null;
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}
/** Le bandeau sous l'en-tête : trois cartes numérotées, ou le message neutre — jamais un vide. */
function _htmlAnatPriorites(res,c){
  const auto=anatObjectif(c), obj=_anatPrioObj||auto;
  const l=anatPriorites(res,obj);
  const seg='<span class="an-prio-o" role="group" aria-label="Objectif">'+Object.keys(ANAT_PRIO.OBJ).map(k=>'<button type="button" class="'+(k===obj?'actif':'')+'" aria-pressed="'+(k===obj)+'" onclick="anatPrioObjectif(\''+k+'\')">'+ANAT_PRIO.LIB[k]+(k===auto?' <small>(bilan)</small>':'')+'</button>').join('')+'</span>';
  const corps=l.length?'<div class="an-prio-l">'+l.map((x,i)=>'<button type="button" class="an-prio-c" data-k="'+x.cle+'" data-n="'+Math.abs(x.niveau)+'" onclick="anatOuvrir(\''+x.cle+'\',true)">'
      +'<span class="an-prio-n">'+(i+1)+'</span><span class="an-prio-t"><b>'+escapeHtml(x.lib)+'</b><em>'+escapeHtml(x.verdict)+(x.conf?' · confiance '+x.conf:'')+'</em>'
      +'<span class="an-prio-a">'+escapeHtml(x.action)+'</span></span></button>').join('')+'</div>'
    :emptyState('','Rien à corriger : leviers dans la moyenne. Aucune zone n’est au-dessus de « léger » sur ce bilan.',null,null,'padding:12px 0');
  return '<div class="an-prio"><div class="an-prio-h"><h5>3 priorités</h5>'+seg+'</div>'+corps+'</div>';
}
// ── LES DEUX EXPORTS (E5, 26/09/2026) ─────────────────────────────────────
// Un HTML d'impression A4, avec les polices du dépôt, imprimé par le
// navigateur depuis une iframe dédiée : pas de service tiers, rien ne quitte
// l'appareil. Deux versions :
//   COACH   — tout : priorités, chiffres, repères, sources, dates et marges ;
//   ATHLÈTE — la photo avec ses points, et les trois priorités dites en
//             consignes d'exécution. Aucun chiffre de population, aucun mot du
//             lexique morphologique (ANAT_LEXIQUE_MORPHO) : c'est ce qui peut
//             descendre chez l'athlète, et rien d'autre.
/** Le style d'impression, commun aux deux versions. */
function _anatExportCss(){
  // LES POLICES DU DÉPÔT, par leur chemin relatif : un document srcdoc prend
  // l'adresse de la page qui l'ouvre, et l'impression attend fonts.ready.
  return "@font-face{font-family:'RC Texte';src:url('fonts/montserrat-var-latin.woff2') format('woff2');font-weight:100 900;font-display:swap;}"
    +"@font-face{font-family:'RC Titre';src:url('fonts/bebasneue-400-latin.woff2') format('woff2');font-display:swap;}"
    +'@page{size:A4;margin:14mm 13mm}'
    +'*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'html,body{margin:0;background:#fff;color:#18181b;font:10pt/1.45 "RC Texte",Arial,sans-serif}'
    +'h1,h2,h3{font-family:"RC Titre","Arial Narrow",Impact,sans-serif;font-weight:400;letter-spacing:.04em;margin:0;color:#111}'
    +'h1{font-size:24pt;line-height:1}h1 span{color:#c81e1e}h2{font-size:14pt;margin:16px 0 6px;border-bottom:1.5px solid #c81e1e;padding-bottom:2px}h3{font-size:11.5pt;margin:0 0 4px}'
    +'.ex-t{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:10px}'
    +'.ex-t p{margin:4px 0 0;font-size:9pt;color:#52525b}.ex-m{font-size:8pt;color:#52525b;text-align:right}'
    +'.ex-ph{display:flex;gap:10px;justify-content:center;margin:6px 0 4px}'
    +'.ex-f{margin:0;text-align:center;break-inside:avoid}.ex-f figcaption{font-size:8pt;color:#52525b;margin-top:4px}'
    +'.ex-c{position:relative;height:118mm;margin:0 auto;border-radius:6px;overflow:hidden;background:#111}'
    +'.ex-a .ex-c{height:150mm}'
    +'.ex-c img,.ex-c svg{position:absolute;inset:0;width:100%;height:100%}.ex-c img{object-fit:fill}'
    +'.ex-c .an-t{stroke:#ff3b3b;stroke-width:3;stroke-linecap:round;opacity:.9}.ex-c .an-t-plomb,.ex-c .an-t-sol{stroke:#fff;stroke-width:2;stroke-dasharray:8 6;opacity:.7}'
    +'.ex-c .an-pt{fill:#ff3b3b;stroke:#fff;stroke-width:2.5}.ex-c .an-pt.est{fill:#f5a524}.ex-c .an-pt.man{fill:#22c55e}.ex-c .an-hit{display:none}'
    +'.ex-p{display:grid;gap:8px;margin:4px 0}.ex-p>div{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;border:1px solid #e4e4e7;border-left:1px solid var(--border);border-radius:6px;padding:8px 10px;break-inside:avoid}'
    +'.ex-p b.n{display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#c81e1e;color:#fff;font:400 13pt "RC Titre","Arial Narrow",Impact,sans-serif}'
    +'.ex-p p{margin:2px 0 0}.ex-p em{font-style:normal;color:#52525b;font-size:8.5pt}'
    +'table{width:100%;border-collapse:collapse;font-size:8.5pt;margin:4px 0 8px}th,td{text-align:left;vertical-align:top;padding:4px 6px;border-bottom:1px solid #e4e4e7}'
    +'th{font-size:7.5pt;text-transform:uppercase;letter-spacing:.05em;color:#52525b;border-bottom:1.5px solid #18181b}td.v{white-space:nowrap;font-weight:700}'
    +'.ex-z{break-inside:avoid;border:1px solid #e4e4e7;border-radius:6px;padding:8px 10px;margin:0 0 8px}'
    +'.ex-z .h{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.ex-z .h span{font-size:8.5pt;font-weight:700;color:#c81e1e}'
    +'.ex-z small,.ex-s{display:block;font-size:7.5pt;color:#71717a;margin-top:4px}.ex-z ul{margin:4px 0 0 16px;padding:0}'
    +'.ex-n{font-size:8pt;color:#52525b;margin-top:12px;border-top:1px solid #e4e4e7;padding-top:6px}';
}
/** La photo d'une vue, avec ses points et ses traits — sans un mot : ni étiquette ni infobulle. */
function _anatExportPhoto(a,pb,vue,legende){
  const v=a&&a[vue], src=_anatSrcVue(pb,vue), pts=anatPoints(a,vue);
  if(!v||!src||!pts||!v.w||!v.h) return '';
  const dessin=String(_anatDessin(vue,pts,v.w,v.h,false)||'')
    .replace(/<circle class="an-hit"[^>]*>[\s\S]*?<\/circle>/g,'').replace(/<title>[\s\S]*?<\/title>/g,'').replace(/<text[\s\S]*?<\/text>/g,'');
  return '<figure class="ex-f"><div class="ex-c" style="aspect-ratio:'+v.w+'/'+v.h+'"><img src="'+escapeHtml(src)+'" alt="">'
    +'<svg viewBox="0 0 '+v.w+' '+v.h+'" preserveAspectRatio="none" aria-hidden="true">'+dessin+'</svg></div>'
    +(legende?'<figcaption>'+escapeHtml(legende)+'</figcaption>':'')+'</figure>';
}
/**
 * Les trois priorités, dites en consignes pour l'athlète : le nom de
 * l'exercice et le réglage, clause par clause, sans aucune qui porte un mot du
 * lexique. Une priorité qui n'a plus rien à dire une fois filtrée est omise.
 * PURE.
 */
function anatConsignesExport(prios){
  const out=[];
  for(const x of (prios||[])){
    const texte=x.consigne||anatConsigneAthlete(x.action||'');
    if(!texte||ANAT_LEXIQUE_MORPHO.test(texte)) continue;
    const titre=(x.quoi&&!ANAT_LEXIQUE_MORPHO.test(x.quoi))?x.quoi:'Consigne '+(out.length+1);
    out.push({titre,texte});
  }
  return out;
}
/**
 * PURE (hors lecture des polices). Le document d'impression complet.
 * @param {any} c le dossier  @param {'coach'|'athlete'} mode
 * @returns {string} le HTML, ou '' s'il n'y a pas d'analyse à exporter
 */
function anatExportHtml(c,mode){
  if(!c||!c.morphoAnat) return '';
  const pb=anatPremierBilan(c);
  const a=(c.morphoAnat.v===ANAT_VERSION&&Number(c.morphoAnat.bilan)===pb.date)?c.morphoAnat:null;
  if(!a||pb.manque.length) return '';
  const res=anatMesuresRendu(a,c);
  const obj=_anatPrioObj||anatObjectif(c);
  const prios=anatPriorites(res,obj);
  const prenom=String(c.fname||'').trim(), nom=(prenom+' '+String(c.lname||'').trim()).trim()||'Athlète';
  const dBilan=_anatDateFr(pb.date), dJour=_anatDateFr(Date.now());
  const tete=(titre,sous,droite)=>'<header class="ex-t"><div><h1>'+titre+'</h1><p>'+escapeHtml(sous)+'</p></div><div class="ex-m">'+droite+'</div></header>';
  const doc=(titre,corps,cls)=>'<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>'+escapeHtml(titre)+'</title><style>'+_anatExportCss()+'</style></head><body class="'+cls+'">'+corps+'</body></html>';

  if(mode==='athlete'){
    const cs=anatConsignesExport(prios);
    const corps=tete('Tes <span>consignes</span>',(prenom||'')+(prenom?' · ':'')+'bilan du '+dBilan,'Préparé par ton coach<br>le '+dJour)
      +'<div class="ex-ph">'+_anatExportPhoto(a,pb,'face','Ta photo de face, bilan du '+dBilan)+'</div>'
      +'<h2>Tes '+(cs.length>1?cs.length+' priorités':'priorités')+' à l’entraînement</h2>'
      +(cs.length?'<div class="ex-p">'+cs.map((x,i)=>'<div><b class="n">'+(i+1)+'</b><div><h3>'+escapeHtml(x.titre)+'</h3><p>'+escapeHtml(x.texte)+'</p></div></div>').join('')+'</div>'
        :'<p>Rien à changer pour l’instant : garde tes réglages habituels, séance après séance.</p>')
      +'<p class="ex-n">Applique-les dès l’échauffement, puis à ta charge de travail. On en reparle à ta prochaine séance ou à ton prochain bilan.</p>';
    return doc('Consignes · '+(prenom||'athlète'),corps,'ex-a');
  }

  // ── LA VERSION COACH : tout, avec ses sources, ses dates et ses marges.
  const ech=res.echelle;
  const echTxt=ech&&ech.cmPx?'Échelle par la taille du dossier : '+_anatN(ech.taille,0)+' cm, ±'+ech.pct+' %':'Sans taille au dossier : des rapports, aucun centimètre';
  const textes={};
  res.fiches.forEach(f=>{ textes[f.cle]=_anatSafe(()=>anatTexte(f,res))||{}; });
  const lignePrio=(x,i)=>'<div><b class="n">'+(i+1)+'</b><div><h3>'+escapeHtml(x.lib)+'</h3><em>'+escapeHtml(x.verdict)+(x.conf?' · confiance '+x.conf:'')+'</em><p>'+escapeHtml(x.action)+'</p></div></div>';
  const synthese='<table><thead><tr><th>Zone</th><th>Lecture</th><th>Valeur</th><th>Marge</th><th>Confiance</th></tr></thead><tbody>'
    +res.fiches.map(f=>'<tr><td>'+escapeHtml(f.lib)+'</td><td>'+escapeHtml(f.etat==='ok'?anatVerdict(f):'non lisible')+(f.grise?' (à confirmer)':'')+'</td><td class="v">'+escapeHtml(f.valeur||'-')+'</td><td>'+escapeHtml(f.tolerance||'-')+'</td><td>'+escapeHtml(f.conf||'-')+'</td></tr>').join('')
    +'</tbody></table>';
  const zone=(f)=>{
    const t=textes[f.cle]||{};
    const lis=(l)=>(l&&l.length)?'<ul>'+l.map(x=>'<li>'+escapeHtml(typeof x==='string'?x:(x&&x.quoi?x.quoi+' : '+x.reglage:String(x)))+'</li>').join('')+'</ul>':'';
    const ch=(f.chiffres||[]).length?'<table><thead><tr><th>Mesure</th><th>Valeur</th><th>Repère</th><th>Écart</th></tr></thead><tbody>'
      +f.chiffres.map(l=>'<tr><td>'+escapeHtml(l.lib)+(l.def?'<small>'+escapeHtml(l.def)+'</small>':'')+'</td><td class="v">'+escapeHtml(l.val==null?'-':String(l.val))+'</td><td>'+escapeHtml(l.ref==null?'':String(l.ref))+'</td><td>'+escapeHtml(l.ecart==null?'':String(l.ecart))+'</td></tr>').join('')+'</tbody></table>':'';
    return '<section class="ex-z"><div class="h"><h3>'+escapeHtml(f.lib)+'</h3><span>'+escapeHtml(f.etat==='ok'?anatVerdict(f):'non lisible')+(f.conf?' · confiance '+f.conf:'')+'</span></div>'
      +(t.court?'<p>'+escapeHtml(t.court)+'</p>':'')+ch
      +(t.privilegier&&t.privilegier.length?'<b>À privilégier</b>'+lis(t.privilegier):'')
      +(t.amenager&&t.amenager.length?'<b>À aménager</b>'+lis(t.amenager):'')
      +(t.verifier?'<small>À vérifier : '+escapeHtml(t.verifier)+'</small>':'')
      +'<small>Marge : '+escapeHtml(f.tolerance||'-')+' · Source : '+escapeHtml(f.source||'photo du bilan du '+dBilan)+'</small></section>';
  };
  const corps=tete('Analyse <span>morpho-anatomique</span>',nom+' · bilan du '+dBilan+(pb.bilan&&pb.bilan.type==='depart'?' (départ)':''),
      'Analyse du '+_anatDateFr(a.date||pb.date)+'<br>Exportée le '+dJour)
    +'<div class="ex-ph">'+_anatExportPhoto(a,pb,'face','Face · '+dBilan)+_anatExportPhoto(a,pb,'dos','Dos · '+dBilan)+(a.profil?_anatExportPhoto(a,pb,'profil','Profil · '+dBilan):'')+'</div>'
    +'<p class="ex-s">'+escapeHtml(echTxt)+' · repères '+escapeHtml(ANAT_REF.SOURCE)+' · points rouges lus par le moteur, verts posés à la main, orangés estimés.</p>'
    +'<h2>3 priorités : objectif '+escapeHtml(ANAT_PRIO.LIB[obj]||obj)+'</h2>'
    +(prios.length?'<div class="ex-p">'+prios.map(lignePrio).join('')+'</div>':'<p>Rien au-dessus de « léger » sur ce bilan.</p>')
    +'<h2>Résultats</h2>'+synthese
    +'<h2>Détail par zone</h2>'+res.fiches.map(zone).join('')
    +'<p class="ex-n">Les repères sont posés sur les photos du bilan, puis ajustables à la main ; la photo est mise à l’échelle par la taille du dossier. Chaque écart à la moyenne est un levier à connaître, pas un défaut. Document de travail du coach : il ne se transmet pas tel quel à l’athlète.</p>';
  // ⚠ PAS « ex-c » : c'est la classe du cadre photo (fond noir, hauteur fixe, rogné).
  return doc('Analyse · '+nom+' · '+dBilan,corps,'ex-coach');
}
/**
 * « Exporter » : le document dans une iframe dédiée, puis la boîte d'impression
 * du navigateur — qui propose aussi « Enregistrer en PDF ». On attend les
 * polices et la photo : imprimer avant, c'est imprimer une page sans elles.
 * @param {'coach'|'athlete'} mode  @param {{imprimer?:boolean}} [o]  imprimer:false pour le banc et les tests
 * @returns {Promise<HTMLIFrameElement|null>}
 */
async function anatExporter(mode,o){
  const opt=o||{};
  try{ document.querySelectorAll('details.an-exp[open]').forEach(d=>d.open=false); }catch(e){}
  const c=getOwnedClient(currentClientId);
  const html=_anatSafe(()=>anatExportHtml(c,mode==='athlete'?'athlete':'coach'));
  if(!html){ toast('Rien à exporter : l’analyse n’est pas encore faite.','var(--orange)'); return null; }
  document.getElementById('an-export')?.remove();
  const f=document.createElement('iframe');
  f.id='an-export'; f.setAttribute('aria-hidden','true'); f.tabIndex=-1;
  f.style.cssText='position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1';
  const pret=new Promise(r=>{ f.onload=()=>r(); });
  f.srcdoc=html;
  document.body.appendChild(f);
  await Promise.race([pret,new Promise(r=>setTimeout(r,4000))]);
  const d=f.contentDocument;
  try{
    await Promise.race([Promise.all([
      d.fonts?d.fonts.ready:Promise.resolve(),
      ...[...d.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{ i.onload=i.onerror=()=>r(); }))
    ]),new Promise(r=>setTimeout(r,8000))]);
  }catch(e){}
  if(opt.imprimer===false) return f;
  const w=f.contentWindow;
  const retirer=()=>{ setTimeout(()=>{ try{ f.remove(); }catch(e){} },500); };
  try{ w.addEventListener('afterprint',retirer,{once:true}); }catch(e){}
  setTimeout(retirer,120000);
  try{ w.focus(); w.print(); }catch(e){ toast('Impression impossible sur ce navigateur.','var(--orange)'); retirer(); }
  return f;
}
/** Le menu « Exporter » de l'en-tête. */
function _htmlAnatExport(){
  return '<details class="an-exp"><summary aria-label="Exporter l’analyse">'+ANAT_SVG.export+'<span>Exporter</span>'+ANAT_SVG.chev+'</summary>'
    +'<div class="an-exp-m" role="menu">'
    +'<button type="button" role="menuitem" onclick="anatExporter(\'coach\')"><b>Coach</b><span>Tous les chiffres, sources, dates et marges</span></button>'
    +'<button type="button" role="menuitem" onclick="anatExporter(\'athlete\')"><b>Athlète</b><span>Sa photo et ses consignes d’exécution</span></button>'
    +'</div></details>';
}
/** E1 : ce que le contrôle à l'envoi a dit des photos de ce bilan, pour le coach. */
function _anatCtlEnvoi(b){
  if(!b) return '';
  const pre=(b.type==='depart'?'deb':'bil')+'-photo-';
  const lib={face:'face',back:'dos',side:'profil'}, mot={vert:'contrôle passé',orange:'envoyée avec réserve',rouge:'à reprendre'};
  const l=['face','back','side'].map(v=>{
    const c=b[pre+v+'-ctl']; if(!c) return null;
    const [e,cs]=String(c).split('|');
    const codes=(cs||'').split(',').filter(Boolean);
    return lib[v]+' : '+(mot[e]||e)+(codes.length?' ('+codes.map(x=>({personne:'personne',pieds:'pieds',tete:'tête',points:'visibilité',bras:'bras',rotation:'rotation',rotationDos:'rotation',profil:'profil',sombre:'lumière',clair:'lumière',plongee:'téléphone trop haut',contre:'téléphone trop bas'})[x]||x).join(', ')+')':'');
  }).filter(Boolean);
  return l.length?' Contrôle des photos à l’envoi : '+l.join(' · ')+'.':' Photos envoyées avant le contrôle à l’envoi.';
}
/** Le nom d'une fiche du catalogue, ou son slug mis en forme. */
function _anatNomExo(slug){
  let f=null; try{ f=catalogueCoach().find(x=>x.slug===slug); }catch(e){ f=null; }
  if(f&&f.nom) return f.nom;
  const t=String(slug||'').replace(/-/g,' ');
  return t.charAt(0).toUpperCase()+t.slice(1);
}
/** Les puces d'exercices d'une recommandation, et le menu « Ajouter au programme ». */
function _htmlAnatExos(slugs,dossier){
  const l=Array.isArray(slugs)?slugs:[];
  if(!l.length) return '';
  // E4 : le rendu passe le dossier qu'il tient déjà. Relu ici, c'était 25
  // lectures du magasin par rendu de la section.
  const c=dossier||getOwnedClient(currentClientId);
  const sc=(c&&Array.isArray(c.sessions_config))?c.sessions_config:[];
  const puces=l.map(sl=>{
    // Les slugs d'ANAT_EXOS_LIENS existent tous dans app/exercices (un test le vérifie) :
    // l'image n'attend pas le chargement de l'index.
    const img=_anatSafe(()=>_illustrationParSlug(sl))||(EXO_IMG_DOSSIER+sl+'.webp');
    return '<button type="button" class="an-exo" data-exo="'+escapeHtml(sl)+'" onclick="anatOuvrirExo(\''+escapeHtml(sl)+'\')" title="Ouvrir la fiche">'
      +(img?'<img src="'+escapeHtml(img)+'" alt="" loading="lazy" width="28" height="20">':'')+'<span>'+escapeHtml(_anatNomExo(sl))+'</span></button>';
  }).join('');
  const menu=sc.length?'<select class="an-exo-aj" aria-label="Ajouter au programme" onchange="if(this.value){anatAjouterExo(this.value);this.value=\'\';}">'
    +'<option value="">+ Ajouter au programme…</option>'
    +l.map(sl=>'<optgroup label="'+escapeHtml(_anatNomExo(sl))+'">'+sc.map((x,i)=>'<option value="'+escapeHtml(sl)+'|'+i+'">'+escapeHtml((x&&x.name)||('Séance '+(i+1)))+'</option>').join('')+'</optgroup>').join('')
    +'</select>':'';
  return '<div class="an-exos">'+puces+menu+'</div>';
}
/** La fiche d'un exercice du catalogue ; à défaut, son illustration. */
function anatOuvrirExo(slug){
  try{ if(ouvrirFicheBanque(slug)) return true; }catch(e){}
  try{ ouvrirIllustration(slug); return true; }catch(e){ return false; }
}
/** « Ajouter au programme » : l'exercice entre à la fin de la séance choisie. CÔTÉ COACH. */
function anatAjouterExo(val){
  const [slug,iS]=String(val||'').split('|'); const i=Number(iS);
  const c=getOwnedClient(currentClientId);
  if(!c||!slug||!isFinite(i)) return false;
  const users=DB.get('users')||{}, d=users[c.email];
  const sc=d&&Array.isArray(d.sessions_config)?d.sessions_config[i]:null;
  if(!sc){ toast('Séance introuvable.','var(--orange)'); return false; }
  let f=null; try{ f=catalogueCoach().find(x=>x.slug===slug); }catch(e){ f=null; }
  const base={name:_anatNomExo(slug),series:3,reps:'10-12',repos:'1 min 30',description:'',exSlug:slug};
  const ex=f?exRemplaceParFiche(base,f):base;
  try{ _pushSessionsHistory(d); }catch(e){}
  sc.exercises=(Array.isArray(sc.exercises)?sc.exercises:[]).concat([ex]);
  d.updatedAt=Date.now(); users[c.email]=d;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,d),ex.name+' ajouté à « '+(sc.name||('Séance '+(i+1)))+' » '+ICO.coche,'le programme est');
  return true;
}
/**
 * PURE. Pose la consigne sur les exercices du programme qui correspondent
 * (même slug, ou même nom que l'une des fiches citées). Rend le nombre touché.
 * ⚠ G7 : SEULE LA CONSIGNE D'EXÉCUTION descend — `reglageCoach` —, jamais la
 *   raison morphologique qui l'a fait écrire.
 */
function anatPoserConsigne(sessions,slugs,consigne){
  let n=0;
  const cles=(slugs||[]).map(x=>String(x));
  for(const sc of (sessions||[])) for(const ex of ((sc&&sc.exercises)||[])){
    if(!ex) continue;
    const sl=String(ex.exSlug||'')||_anatSafe(()=>exSlug(ex.name))||'';
    if(cles.indexOf(sl)<0&&cles.indexOf(_anatSafe(()=>exSlug(ex.name))||'')<0) continue;
    ex.reglageCoach=consigne; n++;
  }
  return n;
}
/** « Envoyer la consigne » d'un aménagement : elle s'attache aux exercices du programme. CÔTÉ COACH. */
function anatEnvoyerConsigne(cle,i){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return false;
  const res=anatMesuresRendu(c.morphoAnat,c);
  const f=res.fiches.find(x=>x.cle===cle); if(!f) return false;
  const am=(anatTexte(f,res).amenager||[])[i];
  if(!am||!am.consigne){ toast('Pas de consigne à envoyer pour cet aménagement.','var(--orange)'); return false; }
  const users=DB.get('users')||{}, d=users[c.email];
  if(!d||!Array.isArray(d.sessions_config)||!d.sessions_config.length){ toast('Son programme est vide : ajoute d’abord l’exercice.','var(--orange)'); return false; }
  try{ _pushSessionsHistory(d); }catch(e){}
  const n=anatPoserConsigne(d.sessions_config,am.exercices,am.consigne);
  if(!n){ toast('Aucun exercice de son programme ne correspond à « '+am.quoi+' ».','var(--orange)'); return false; }
  d.updatedAt=Date.now(); users[c.email]=d;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,d),'Consigne envoyée sur '+n+' exercice'+(n>1?'s':'')+' '+ICO.coche,'la consigne est');
  return true;
}
/** Une jauge de tronc, de l'horizontale (0°) à la verticale (90°) : athlète et moyenne. */
function _anatJaugeTronc(moi,ref,lib){
  const O={x:8,y:74},R=64;
  const pt=(a,r)=>{ const t=a*Math.PI/180; return {x:O.x+(r||R)*Math.cos(t),y:O.y-(r||R)*Math.sin(t)}; };
  const arc=(a0,a1,r)=>{ const p0=pt(a0,r),p1=pt(a1,r); return 'M'+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+' A'+r+' '+r+' 0 0 0 '+p1.x.toFixed(1)+' '+p1.y.toFixed(1); };
  const aig=(a,cl,r)=>{ const p=pt(Math.max(0,Math.min(90,a)),r||R-6); return '<line class="'+cl+'" x1="'+O.x+'" y1="'+O.y+'" x2="'+p.x.toFixed(1)+'" y2="'+p.y.toFixed(1)+'"/>'; };
  let g='<svg class="an-jauge an-jauge-t" viewBox="0 0 80 80" role="img" aria-label="'+escapeHtml(lib)+' : tronc à '+Math.round(moi)+'° de l’horizontale, moyenne '+Math.round(ref)+'°">'
    +'<path class="an-j-fond" d="'+arc(0,90,R)+'"/>'
    +'<path class="an-j-zone" d="'+arc(Math.min(moi,ref),Math.max(moi,ref),R)+'"/>';
  for(const t of [0,30,60,90]){ const a=pt(t,R+1),b=pt(t,R-5); g+='<line class="an-j-gr" x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'"/>'; }
  return g+'<line class="an-j-sol" x1="'+O.x+'" y1="'+O.y+'" x2="78" y2="'+O.y+'"/>'+aig(ref,'an-j-moy')+aig(moi,'an-j-moi')
    +'<circle class="an-j-piv" cx="'+O.x+'" cy="'+O.y+'" r="3.5"/></svg>';
}
/** La carte du soulevé (A17) : conventionnel et sumo côte à côte, et la phrase de décision. */
function _htmlSouleve(l){
  const H=l.taille, cmv=v=>_anatN(v*H,0)+' cm';
  const bloc=(style,lib)=>{
    const x=l.styles[style];
    return '<div class="an-sdt-s"><b>'+lib+'</b><div class="an-sdt-j">'+_anatJaugeTronc(x.moi.tronc,x.ref.tronc,lib)
      +'<div class="an-sdt-v"><strong>'+_anatN(x.moi.tronc,0)+'°</strong><em>tronc / horizontale<br>moyenne '+_anatN(x.ref.tronc,0)+'°</em></div></div>'
      +'<p class="an-sdt-c">hanche à '+cmv(x.moi.hanche)+' du sol · levier hanche → barre '+cmv(x.moi.brasHanche)+'</p></div>';
  };
  return '<div class="an-sdt">'+bloc('conventionnel','Conventionnel')+bloc('sumo','Sumo')+'</div>'
    +'<span class="an-lev-leg"><span><i class="l-moi"></i>athlète</span><span><i class="l-moy"></i>moyenne</span></span>'
    +'<p class="an-sdt-d">'+escapeHtml(l.decision)+'</p><p>'+escapeHtml(l.txt)+'</p>'+_htmlAnatVideo(l);
}
// ── LE SQUAT RÉGLÉ (A16) : un état d'écran, pas une donnée ────────────────
let _anatSquatReg=null, _anatSquatL=null;
function _anatSquatCfg(l){
  const b=(l&&l.modele&&l.modele.base)||{alpha:ANAT_SQUAT.ALPHA,beta:0,barre:'haute',cale:false};
  return Object.assign({},b,(_anatSquatReg&&_anatSquatReg.email===((getOwnedClient(currentClientId)||{}).email))?_anatSquatReg.cfg:{});
}
/** Le haut de la carte : la jauge (athlète, moyenne, réglage) et le texte recalculé. */
function _htmlSquatRes(l){
  _anatSquatL=l;
  const M=l.modele, cfg=_anatSquatCfg(l);
  const moi=anatSquatCalc(M.A,cfg), ref=anatSquatCalc(M.Rp,cfg);
  const regle=Math.round(moi.angle), change=JSON.stringify(cfg)!==JSON.stringify(M.base);
  const j=_anatJauge(Object.assign({},l,{regle:change?regle:null,cale:change?null:l.cale}));
  return '<div class="an-lev-v">'+j+'<div class="an-lev-vt"><strong>'+l.val+'°</strong><em>buste à la parallèle<br>moyenne '+l.ref+'°'
      +(change?'<br>réglage : <b class="an-sq-r">'+regle+'°</b> (moyenne '+Math.round(ref.angle)+'°)':'')+'</em>'
    +'<span class="an-lev-leg"><span><i class="l-moi"></i>athlète</span><span><i class="l-moy"></i>moyenne</span><span><i class="l-cale"></i>'+(change?'réglage':'avec cale')+'</span></span></div></div>'
    +'<p>'+escapeHtml(change?anatSquatTexte(moi,ref,cfg,M.taille):l.txt)+'</p>'
    +_htmlAnatVideo(l);
}
/** Prévu / mesuré (A20), et le lien vers la dernière vidéo analysée. */
function _htmlAnatVideo(l){
  const v=l&&l.video; if(!v) return '';
  const c=getOwnedClient(currentClientId);
  const loin=Math.abs(v.ecart)>ANAT_VIDEO_ECART;
  return '<p class="an-vid'+(loin?' an-vid-loin':'')+'">Prévu <b>'+_anatN(v.prevu,0)+'°</b> · mesuré en vidéo <b>'+_anatN(v.mesure,0)+'°</b> ('+_anatDateFr(v.date)+') : écart '+_anatSN(v.ecart,0)+'°.'
    +(loin?' '+escapeHtml(ANAT_VIDEO_PHRASE):'')
    +(c&&v.videoId?' <button type="button" class="an-vid-b" onclick="ouvrirMotionLab(\''+escapeHtml(c.email)+'\',\''+escapeHtml(String(v.videoId))+'\')">Voir la vidéo analysée</button>':'')+'</p>';
}
/** Les quatre contrôles : cheville, écart, barre haute / basse, cale. */
function _htmlSquatCtl(l){
  const cfg=_anatSquatCfg(l), M=l.modele;
  return '<div class="an-sq" role="group" aria-label="Régler le squat">'
    +'<label class="an-sq-c"><span>Cheville <output id="an-sq-a">'+_anatN(cfg.alpha,0)+'°</output></span><input type="range" min="'+ANAT_SQUAT.ALPHA_MIN+'" max="'+ANAT_SQUAT.ALPHA_MAX+'" step="1" value="'+Math.round(cfg.alpha)+'" oninput="anatSquatRegler(\'alpha\',this.value)" aria-label="Inclinaison du tibia'+(M.alphaSrc==='test'?' (départ : test du genou au mur)':'')+'"></label>'
    +'<label class="an-sq-c"><span>Écart <output id="an-sq-b">'+_anatN(cfg.beta,0)+'°</output></span><input type="range" min="0" max="45" step="1" value="'+Math.round(cfg.beta)+'" oninput="anatSquatRegler(\'beta\',this.value)" aria-label="Abduction de hanche : écart et ouverture des pieds"></label>'
    +'<div class="an-sq-t" role="group" aria-label="Position de la barre">'+['haute','basse'].map(b=>'<button type="button" class="'+(cfg.barre===b?'actif':'')+'" aria-pressed="'+(cfg.barre===b)+'" onclick="anatSquatRegler(\'barre\',\''+b+'\')">Barre '+b+'</button>').join('')+'</div>'
    +'<label class="an-sq-k"><input type="checkbox"'+(cfg.cale?' checked':'')+' onchange="anatSquatRegler(\'cale\',this.checked)"><span>Cale</span></label>'
    +'</div>';
}
/** Un contrôle bouge : le résultat se recalcule sur place, les contrôles restent sous le doigt. */
function anatSquatRegler(k,v){
  const l=_anatSquatL; if(!l||!l.modele) return;
  const c=getOwnedClient(currentClientId);
  const cfg=_anatSquatCfg(l);
  cfg[k]=(k==='alpha'||k==='beta')?Number(v):(k==='cale'?!!v:v);
  _anatSquatReg={email:c&&c.email,cfg};
  const z=document.getElementById('an-sq-res');
  if(z) z.innerHTML=_htmlSquatRes(l);
  const oa=document.getElementById('an-sq-a'), ob=document.getElementById('an-sq-b');
  if(oa) oa.textContent=_anatN(cfg.alpha,0)+'°';
  if(ob) ob.textContent=_anatN(cfg.beta,0)+'°';
  const ck=document.querySelector('.an-sq-k input'); if(ck) ck.checked=!!cfg.cale;
  if(k==='barre') document.querySelectorAll('.an-sq-t button').forEach(b=>{ const on=b.textContent==='Barre '+v; b.classList.toggle('actif',on); b.setAttribute('aria-pressed',on); });
}
function anatLevier(d,i){
  _anatLevIdx=(i!=null)?Number(i)||0:_anatLevIdx+(Number(d)||0);
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}
function anatToutesFiches(){
  _anatToutes=!_anatToutes;
  const z=document.getElementById('ccd-anat');
  const col=z&&z.querySelector('.an-col-g');
  if(!col){ const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c); return; }
  col.classList.toggle('toutes',_anatToutes);
  const b=col.querySelector('.an-deroule');
  if(b){
    b.setAttribute('aria-expanded',_anatToutes?'true':'false');
    const n=col.querySelectorAll('.an-f-plus-l').length;
    b.querySelector('span').textContent=_anatToutes?'Replier la liste':'Voir les '+n+' autres zones';
  }
}
function _anatDateHeure(t){
  try{ return new Date(t).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; }
}
function _anatResumeSauvegarde(x){
  const n=v=>(x&&x[v]&&x[v].man)?Object.keys(x[v].man).length:0;
  const p=[];
  const nf=n('face'),nd=n('dos');
  p.push(nf||nd?(nf+nd)+' point'+(nf+nd>1?'s':'')+' à la main':'points automatiques');
  const ph=x&&x.opts&&x.opts.photo;
  if(ph&&Object.values(ph).some(r=>r&&(r.cadre||(r.lum&&r.lum!==100)||(r.con&&r.con!==100)))) p.push('photo réglée');
  if(x&&x.opts&&x.opts.miroir) p.push('miroir');
  return p.join(' · ');
}
/**
 * « Un petit menu sauvegarde pour sauvegarder la position et tout ce qu'on
 * aura fait comme modification sur l'image » (Kevin). Ce qui est en cours
 * d'édition est d'abord appliqué, puis l'état entier — points posés à la
 * main, options, réglages de la photo — est rangé sous sa date. Huit
 * versions au plus : au-delà, la plus ancienne part.
 */
function anatSauvegarder(){
  if(_anatEdit) anatEnregistrerPoints(true);
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  if(!d||!d.morphoAnat) return;
  const a=d.morphoAnat;
  const copie=o=>o?JSON.parse(JSON.stringify(o)):null;
  const v={id:String(Date.now()),date:Date.now(),
    face:{man:copie(a.face&&a.face.man)},dos:{man:copie(a.dos&&a.dos.man)},profil:{man:copie(a.profil&&a.profil.man)},opts:copie(a.opts)||{}};
  a.sauvegardes=(Array.isArray(a.sauvegardes)?a.sauvegardes:[]).concat([v]).slice(-8);
  d.updatedAt=Date.now();
  users[c.email]=d;
  const ok=DB.set('users',users);
  renderAnatCoach(getOwnedClient(currentClientId)||c);
  toastSync(ok,CLOUD.pushOne(c.email,d),'Analyse sauvegardée '+ICO.coche,'la sauvegarde est');
}
/**
 * Changer le bilan analysé. « auto » (ou le bilan par défaut) revient au
 * départ. Ce qui a été posé à la main sur le bilan quitté — points, options,
 * réglages de la photo, versions sauvegardées — est MIS DE CÔTÉ sous sa date,
 * et reviendra si l'on y revient : changer de bilan pour comparer ne doit
 * jamais coûter le travail fait sur l'autre.
 */
function anatChoisirBilan(val){
  if(_anatEdit) return;
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  if(!d) return;
  const def=anatPremierBilan(Object.assign({},d,{morphoAnat:null})).date;
  const n=(val==='auto')?0:(Number(val)||0);
  const choix=(n&&n!==def)?n:0;
  const a=(d.morphoAnat&&typeof d.morphoAnat==='object')?d.morphoAnat:{};
  if((Number(a.choix)||0)===choix) return;
  const copie=o=>o?JSON.parse(JSON.stringify(o)):null;
  const quitte=Number(a.bilan)||0;
  if(quitte&&(a.face||a.dos)){
    const aMain=(a.face&&a.face.man)||(a.dos&&a.dos.man)||(a.profil&&a.profil.man)||(a.opts&&Object.keys(a.opts).length)
      ||(Array.isArray(a.sauvegardes)&&a.sauvegardes.length);
    if(aMain){
      a.archives=Object.assign({},a.archives||{});
      a.archives[String(quitte)]={v:a.v,face:{man:copie(a.face&&a.face.man)},dos:{man:copie(a.dos&&a.dos.man)},profil:{man:copie(a.profil&&a.profil.man)},
        opts:copie(a.opts)||{},sauvegardes:copie(a.sauvegardes)||[]};
    }
  }
  if(choix) a.choix=choix; else delete a.choix;
  d.morphoAnat=a;
  d.updatedAt=Date.now();
  users[c.email]=d;
  const ok=DB.set('users',users);
  _anatLevIdx=0;
  renderAnatCoach(getOwnedClient(currentClientId)||d);
  const txt=choix?'Bilan du '+_anatDateFr(choix)+' '+ICO.coche:'Bilan de départ '+ICO.coche;
  toastSync(ok,CLOUD.pushOne(c.email,d),txt,'le changement de bilan est');
}
function anatRestaurer(id){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  const a=d&&d.morphoAnat;
  const v=a&&(a.sauvegardes||[]).find(x=>String(x.id)===String(id));
  if(!v) return;
  _anatEdit=null; _anatRecadre=false;
  const copie=o=>o?JSON.parse(JSON.stringify(o)):null;
  if(a.face) a.face.man=copie(v.face&&v.face.man);
  if(a.dos) a.dos.man=copie(v.dos&&v.dos.man);
  if(a.profil) a.profil.man=copie(v.profil&&v.profil.man);
  a.opts=copie(v.opts)||{};
  a.date=Date.now();
  d.updatedAt=Date.now();
  users[c.email]=d;
  const ok=DB.set('users',users);
  renderAnatCoach(getOwnedClient(currentClientId)||c);
  toastSync(ok,CLOUD.pushOne(c.email,d),'Version du '+_anatDateHeure(v.date)+' restaurée '+ICO.coche,'la restauration est');
}
function anatSupprimerSauvegarde(id){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  const a=d&&d.morphoAnat;
  if(!a||!Array.isArray(a.sauvegardes)) return;
  a.sauvegardes=a.sauvegardes.filter(x=>String(x.id)!==String(id));
  d.updatedAt=Date.now();
  users[c.email]=d;
  DB.set('users',users);
  CLOUD.pushOne(c.email,d);
  renderAnatCoach(getOwnedClient(currentClientId)||c);
}

// ── LA NETTETÉ AUTOMATIQUE ────────────────────────────────────────────────
// Kevin : « booste la qualité de la photo, repixelise-la en automatique, pour
// qu'elle soit plus facile à lire, notamment quand on zoome ». Une photo de
// bilan pèse 1280 px au plus, compressée, souvent sombre (contre-jour, salle
// de bain). Ce qu'on peut faire honnêtement, sur l'appareil, sans l'envoyer
// nulle part :
//   1. l'agrandir à ~2 000 px de haut en interpolation haute qualité, pour que
//      le zoom et la loupe ne tombent pas sur des pixels grossiers ;
//   2. étirer les niveaux (0,5 % des pixels les plus sombres et les plus
//      clairs écartés), et relever les tons moyens d'une photo sombre ;
//   3. accentuer les contours (masque flou) — c'est ce qui rend lisibles une
//      rotule, un bord de deltoïde, une malléole.
// ⚠ AUCUN DÉTAIL N'EST INVENTÉ. Pas d'IA, pas de « super-résolution » qui
//   dessinerait des muscles : on rend lisible ce que la photo contient, rien
//   de plus. Et c'est un affichage : la photo de l'athlète n'est pas touchée.
const _anatNetCache=new Map();
/** La version du traitement : la changer invalide les copies nettes gardées. */
const ANAT_NET_VERSION=1;
/** Ce que le traitement a fait, pour le banc et les tests. */
const _anatNetStats={worker:0,principal:0,idb:0,memoire:0};
/**
 * PURE ET AUTONOME : les pixels RGBA d'une image, traités sur place — niveaux,
 * gamma des photos sombres, accentuation. ⚠ ELLE EST ENVOYÉE TELLE QUELLE AU
 * WORKER (son texte) : elle ne doit rien lire hors de ses arguments.
 */
function _anatNetPixels(d,w,h){
  const n=w*h;
  // 1. Les niveaux : histogramme de la luminance.
  const hist=new Uint32Array(256);
  for(let i=0;i<d.length;i+=4) hist[(d[i]*77+d[i+1]*150+d[i+2]*29)>>8]++;
  const seuil=n*0.005;
  let lo=0,hi=255,acc=0;
  for(let v=0;v<256;v++){ acc+=hist[v]; if(acc>seuil){ lo=v; break; } }
  acc=0;
  for(let v=255;v>=0;v--){ acc+=hist[v]; if(acc>seuil){ hi=v; break; } }
  if(hi-lo<40){ lo=Math.max(0,lo-20); hi=Math.min(255,hi+20); }
  let somme=0;
  for(let v=0;v<256;v++) somme+=hist[v]*Math.max(0,Math.min(1,(v-lo)/(hi-lo)));
  const moy=somme/n;
  // Gamma : on ne relève que les photos sombres, jamais on ne les assombrit.
  const g=moy>0.02&&moy<0.42?Math.max(0.55,Math.log(0.45)/Math.log(moy)):1;
  const lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++) lut[v]=Math.round(255*Math.pow(Math.max(0,Math.min(1,(v-lo)/(hi-lo))),g));
  for(let i=0;i<d.length;i+=4){ d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]]; }
  // 2. L'accentuation : original + 0,7 × (original − flou), flou en boîte
  //    séparable de rayon 2 (après agrandissement, ~1 px de la photo).
  const r=2, flou=new Uint8ClampedArray(d.length), tmp=new Uint8ClampedArray(d.length);
  const passe=(srcA,dst,horiz)=>{
    const L=horiz?w:h, M=horiz?h:w;
    for(let m=0;m<M;m++){
      for(let ch=0;ch<3;ch++){
        let s=0;
        const at=(i)=>{ const ii=Math.max(0,Math.min(L-1,i)); return horiz?((m*w+ii)*4+ch):((ii*w+m)*4+ch); };
        for(let i=-r;i<=r;i++) s+=srcA[at(i)];
        for(let i=0;i<L;i++){
          dst[at(i)]=s/(2*r+1);
          s+=srcA[at(i+r+1)]-srcA[at(i-r)];
        }
      }
    }
  };
  passe(d,tmp,true); passe(tmp,flou,false);
  const A=0.7;
  for(let i=0;i<d.length;i+=4){
    d[i]=d[i]+A*(d[i]-flou[i]); d[i+1]=d[i+1]+A*(d[i+1]-flou[i+1]); d[i+2]=d[i+2]+A*(d[i+2]-flou[i+2]);
  }
  return d;
}
/**
 * LE WORKER DE NETTETÉ (E4, 26/09/2026). Deux secondes de calcul par photo
 * sur un téléphone, et 224 ms sur le banc : c'était un gel franc de l'écran à
 * chaque ouverture de l'analyse. Le code est INLINE, par une URL de Blob — pas
 * de fichier de plus à versionner ni à mettre en cache. Sans Worker ni
 * OffscreenCanvas, on garde le calcul d'avant, sur le fil principal.
 */
let _anatNetWk=null, _anatNetSeq=0;
const _anatNetAttente=new Map();
function _anatNetWorker(){
  if(_anatNetWk!==null) return _anatNetWk||null;
  _anatNetWk=false;
  try{
    if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function') return null;
    const code='const _anatNetPixels='+String(_anatNetPixels)+';\n'
      +'self.onmessage=async(ev)=>{ const m=ev.data;\n'
      +'  try{ const cv=new OffscreenCanvas(m.w,m.h); const x=cv.getContext("2d",{willReadFrequently:true});\n'
      +'    x.imageSmoothingEnabled=true; x.imageSmoothingQuality="high"; x.drawImage(m.bmp,0,0,m.w,m.h);\n'
      +'    try{ m.bmp.close(); }catch(e){}\n'
      +'    const id=x.getImageData(0,0,m.w,m.h); _anatNetPixels(id.data,m.w,m.h); x.putImageData(id,0,0);\n'
      +'    const blob=await cv.convertToBlob({type:"image/jpeg",quality:0.92}); self.postMessage({id:m.id,blob});\n'
      +'  }catch(e){ self.postMessage({id:m.id,err:String((e&&e.message)||e)}); } };';
    const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
    const wk=new Worker(url);
    wk.onmessage=(ev)=>{ const f=_anatNetAttente.get(ev.data&&ev.data.id); if(f){ _anatNetAttente.delete(ev.data.id); f(ev.data); } };
    wk.onerror=()=>{ for(const f of _anatNetAttente.values()) f({err:'worker'}); _anatNetAttente.clear(); _anatNetWk=false; };
    _anatNetWk=wk;
  }catch(e){ _anatNetWk=false; }
  return _anatNetWk||null;
}
/** Le traitement dans le worker : un Blob JPEG, ou null (et l'on se replie). */
async function _anatNetParWorker(im,w,h){
  const wk=_anatNetWorker(); if(!wk) return null;
  let bmp=null;
  try{ bmp=await createImageBitmap(im); }catch(e){ return null; }
  const id=++_anatNetSeq;
  const r=await new Promise(res=>{
    const garde=setTimeout(()=>{ _anatNetAttente.delete(id); res({err:'délai'}); },20000);
    _anatNetAttente.set(id,(m)=>{ clearTimeout(garde); res(m); });
    try{ wk.postMessage({id,bmp,w,h},[bmp]); }catch(e){ clearTimeout(garde); _anatNetAttente.delete(id); res({err:'envoi'}); }
  });
  return (r&&r.blob)||null;
}
/** Le traitement d'avant, sur le fil principal : le repli. */
async function _anatNetPrincipal(im,w,h){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
  const x=cv.getContext('2d',{willReadFrequently:true});
  if(!x) return null;
  x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
  x.drawImage(im,0,0,w,h);
  let id;
  try{ id=x.getImageData(0,0,w,h); }catch(e){ return null; } // photo sans CORS
  _anatNetPixels(id.data,w,h);
  x.putImageData(id,0,0);
  return await new Promise(res=>cv.toBlob(b=>res(b),'image/jpeg',0.92));
}
// LA COPIE NETTE GARDÉE SUR L'APPAREIL. Dans le magasin des photos (IndexedDB) :
// c'est une image du corps de l'athlète, elle part donc avec lui quand le
// magasin est vidé (retrait de l'accord). Douze au plus, les plus anciennes
// s'effacent. Jamais pour une URL blob:, qui ne vit que le temps de la page.
const ANAT_NET_MAX=12, ANAT_NET_JOURNAL='rc_anat_net';
function _anatNetCle(src){
  let h=0x811c9dc5;
  const t=String(src);
  for(let i=0;i<t.length;i++){ h^=t.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; }
  return 'anat-net/'+ANAT_NET_VERSION+'/'+h.toString(16)+'-'+t.length.toString(36);
}
function _anatNetGarder(cle,blob){
  try{
    phpEcrireBlob(cle,blob).then(()=>{
      let l=[];
      try{ l=JSON.parse(localStorage.getItem(ANAT_NET_JOURNAL)||'[]'); }catch(e){ l=[]; }
      l=(Array.isArray(l)?l:[]).filter(k=>k!==cle); l.push(cle);
      while(l.length>ANAT_NET_MAX){ const k=l.shift(); try{ phpSupprimerBlob(k).catch(()=>{}); }catch(e){} }
      try{ localStorage.setItem(ANAT_NET_JOURNAL,JSON.stringify(l)); }catch(e){}
    }).catch(()=>{});
  }catch(e){}
}
function anatAmeliorer(src){
  if(!src) return Promise.resolve(null);
  const cm=src+'|'+ANAT_NET_VERSION;
  if(_anatNetCache.has(cm)){ _anatNetStats.memoire++; return _anatNetCache.get(cm); }
  const p=(async()=>{
    const persist=!/^blob:/i.test(String(src));
    const cle=persist?_anatNetCle(src):null;
    if(cle){
      let b=null;
      try{ b=await phpLireBlob(cle); }catch(e){ b=null; }
      if(b&&b.size){ _anatNetStats.idb++; return URL.createObjectURL(b); }
    }
    const im=await new Promise(res=>{
      const i=new Image(); i.crossOrigin='anonymous';
      i.onload=()=>res(i); i.onerror=()=>res(null); i.src=src;
    });
    if(!im||!im.naturalWidth) return null;
    const k=Math.max(1,Math.min(2,2000/im.naturalHeight));
    const w=Math.round(im.naturalWidth*k),h=Math.round(im.naturalHeight*k);
    let blob=await _anatNetParWorker(im,w,h);
    if(blob) _anatNetStats.worker++;
    else { blob=await _anatNetPrincipal(im,w,h); if(blob) _anatNetStats.principal++; }
    if(!blob) return null;
    if(cle) _anatNetGarder(cle,blob);
    return URL.createObjectURL(blob);
  })().catch(()=>null);
  _anatNetCache.set(cm,p);
  return p;
}
/**
 * LES MESURES DU RENDU (E4). Un seul anatMesures par rendu, et les gestes qui
 * suivent de près — le zoom, l'ouverture de l'édition, « envoyer la consigne »
 * — reprennent ce même résultat pendant 2 s au lieu de tout recalculer. La clé
 * change dès que le dossier change (updatedAt, date de l'analyse, biais appris).
 */
// ⚠ LE RENDU CALCULE TOUJOURS (frais) : c'est lui qui range. Seuls les gestes
//   qui le suivent relisent — et seulement sur LE MÊME objet d'analyse.
let _anatMesCache={cle:'',t:0,a:null,res:null};
function anatMesuresRendu(a,c,frais){
  const biais=anatBiaisCoach();
  const cle=[c&&c.email,c&&c.updatedAt,a&&a.date,a&&a.bilan,_anatBiaisCache&&_anatBiaisCache.cle].join('|');
  const t=Date.now();
  if(!frais&&_anatMesCache.res&&_anatMesCache.a===a&&_anatMesCache.cle===cle&&t-_anatMesCache.t<2000) return _anatMesCache.res;
  const res=anatMesures(a,c,{biais});
  _anatMesCache={cle,t,a,res};
  return res;
}
/** Pose la version nette sur toutes les images d'une vue, dès qu'elle est prête. */
function _anatNettete(z,c){
  const a=c&&c.morphoAnat;
  if(!a||!z) return;
  const pb=anatPremierBilan(c);
  for(const vue of ['face','dos','profil']){
    if(!a[vue]||anatReglage(a,vue).net===false) continue;
    const src=_anatSrcVue(pb,vue);
    const imgs=z.querySelectorAll('img[data-v="'+vue+'"]');
    if(!src||!imgs.length) continue;
    anatAmeliorer(src).then(u=>{ if(u) imgs.forEach(i=>{ if(i.isConnected) i.src=u; }); });
  }
}

/** L'analyse est-elle à faire (ou à refaire) pour ce bilan ? */
function anatARefaire(c,pb){
  const a=c&&c.morphoAnat;
  if(!pb||!pb.face||!pb.dos) return false;
  if(!a||typeof a!=='object') return true;
  if(a.v!==ANAT_VERSION) return true;
  if(Number(a.bilan)!==pb.date) return true;
  // Une photo de profil jamais lue (analyse antérieure à A9, ou photo ajoutée
  // depuis) : on relit, une fois — les points posés à la main restent.
  return !!(pb.profil&&!a.profil&&a.profilLu!==pb.profil);
}
/** Les dimensions d'une photo, quand le moteur n'a rien rendu. */
function _anatDimensions(src){
  return new Promise(res=>{
    const i=new Image();
    i.onload=()=>res({w:i.naturalWidth,h:i.naturalHeight}); i.onerror=()=>res(null);
    i.src=src;
  });
}
/**
 * Des points de départ quand le moteur ne voit personne : un gabarit aux
 * proportions de de Leva (1996) — celles d'ANAT_REF, du sexe demandé — et aux
 * largeurs d'ANSUR II (ANAT_LARGEURS),
 * centré, que le coach n'a plus qu'à caler. Les segments sont posés À LEUR
 * LONGUEUR EXACTE (l'écart latéral est retiré de la hauteur), si bien qu'un
 * gabarit mesuré sort « dans la marge » sur les bras, les jambes et le buste.
 */
function anatGabarit(w,h,vue,femme){
  const R=anatRef(femme);
  const Hh=h*0.86, top=h*0.06, cx=w/2, out={};
  const y=f=>top+Hh*(1-f);
  // En fraction de la taille : de la hauteur `f0` et de l'écart latéral `dx0`
  // à `dx1`, la hauteur où poser l'autre bout pour une longueur `L`.
  const bout=(f0,dx0,dx1,L)=>f0-Math.sqrt(Math.max(0,L*L-(dx1-dx0)*(dx1-dx0)));
  const pose=(k,x,yy)=>{ out[k]=[Math.round(x/w*100000)/100000,Math.round(yy/h*100000)/100000,0.5]; };
  const lat=(k,dx,f)=>{ pose(k+'_l',cx-dx*Hh,y(f)); pose(k+'_r',cx+dx*Hh,y(f)); };
  // La cheville est posée pour que le genou tombe à 0,278 de la taille, la
  // hauteur de rotule d'ANSUR II : un gabarit doit CONFIRMER son échelle.
  const jV=Math.sqrt(R.jambe*R.jambe-0.005*0.005);
  const fCh=Math.max(0.02,ANAT_ROTULE.part-jV), fGenou=fCh+jV;
  const fHa=fGenou+R.cuisse, fEp=fHa+R.tronc;
  const fCo=bout(fEp,0.10,0.12,R.bras);
  // L'avant-bras s'écarte en dehors du bras de l'angle de port moyen (A10) :
  // un gabarit sort « port moyen », à sa longueur exacte.
  const aPort=Math.asin(0.02/R.bras)+ANAT_COUDE[femme?'F':'H'].moy*Math.PI/180;
  const dxPo=0.12+R.avantbras*Math.sin(aPort), fPo=fCo-R.avantbras*Math.cos(aPort);
  // DE PROFIL (A9), regard vers la droite : tragus, acromion, grand trochanter,
  // genou et malléole sur la même verticale (la ligne de Kendall) ; C7 en
  // arrière du tragus, à 50° (le repère cranio-vertébral).
  if(vue==='profil'){
    const pt=(k,dx,f)=>pose(k,cx+dx*Hh,y(f));
    const fTr=0.935, dC7=0.04;
    pt('vertex',-0.01,1); pt('tragus',0,fTr);
    pt('c7',-dC7,fTr-dC7*Math.tan(ANAT_PROFIL.cva*Math.PI/180));
    pt('acromion',0,fEp+0.012); pt('trochanter',0,fHa); pt('genou',0,fGenou); pt('malleole',0,fCh);
    pt('talon',-0.025,0);
    return out;
  }
  pose('vertex',cx,y(1));
  const LG=ANAT_LARGEURS[femme?'F':'H'];
  lat('acromion',LG.biacromial/2,fEp+0.012); lat('epaule',0.10,fEp); lat('deltoide',0.14,fEp-0.02);
  lat('coude',0.12,fCo); lat('poignet',dxPo,fPo); lat('taille',0.075,fHa+0.09);
  lat('crete',LG.bicretal/2,fHa+0.07); lat('hanche',0.055,fHa); lat('genou',0.055,fGenou);
  lat('cheville',0.05,fCh); lat('talon',0.05,0.0);
  if(vue==='face') lat('pointe',0.07,-0.01);
  if(vue==='dos'){ pose('c7',cx,y(fEp+0.04)); pose('sacrum',cx,y(fHa+0.04)); lat('omoplate',0.06,fEp-0.10); lat('omoplate_int',0.035,fEp-0.05);
    // A11 : mollet, tendon et talon sur la même verticale.
    lat('mollet',0.05,(fGenou+fCh)/2); lat('achille',0.05,fCh); }
  return out;
}

/**
 * Lit les deux photos et range les repères dans le dossier. CÔTÉ COACH.
 * ⚠ LES POINTS DU COACH NE SONT JAMAIS ÉCRASÉS PAR UNE RELANCE AUTOMATIQUE :
 *   seule la détection change ; ce qu'il a posé à la main reste.
 */
async function anatAnalyser(email,force){
  if(_anatEnCours.has(email)) return false;
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!currentUser||c.coachId!==currentUser.id) return false;
  const pb=anatPremierBilan(c);
  if(!pb.face||!pb.dos) return false;
  if(!force&&!anatARefaire(c,pb)) return false;
  _anatEnCours.add(email);
  _anatEchecs.delete(email);
  try{ renderAnatCoach(c); }catch(e){}
  let res=null;
  try{
    await chargerMotionLab();
    const lire=(typeof window!=='undefined')?/** @type {any} */(window).mlAnatPhoto:null;
    if(typeof lire!=='function') throw new Error('lecture de photo indisponible');
    // CE QUI A ÉTÉ POSÉ À LA MAIN APPARTIENT À UN BILAN. Sur le bilan déjà
    // lu : l'analyse en cours ; sur un bilan qu'on retrouve : ce que
    // anatChoisirBilan avait mis de côté en le quittant.
    const cour=c.morphoAnat&&typeof c.morphoAnat==='object'?c.morphoAnat:null;
    const ancien=(cour&&cour.v>=2&&Number(cour.bilan)===pb.date)?cour
      :((cour&&cour.archives&&cour.archives[String(pb.date)])||null);
    const vue=async(nom,src)=>{
      let r=null;
      // LA DÉTECTION LIT LA PHOTO RÉGLÉE : luminosité, contraste et cadre du
      // coach — c'est ce qui rattrape une photo à contre-jour.
      const rg=anatReglage(c.morphoAnat,nom);
      try{ r=await lire(src,{filtre:anatFiltre(rg),cadre:rg.cadre}); }catch(e){ r=null; }
      let auto=(r&&r.ok)?anatPointsAuto(r,nom):null;
      let w=r&&r.w, h=r&&r.h;
      if(!w||!h){ const d=await _anatDimensions(src); if(!d) return null; w=d.w; h=d.h; }
      // Rien de lu : un gabarit à caler, marqué comme tel.
      if(!auto) auto={pts:anatGabarit(w,h,nom),telephone:null,miroir:false,triangles:null,gabarit:true};
      return {w,h,auto,man:(ancien&&ancien[nom]&&ancien[nom].man)||null};
    };
    const face=await vue('face',pb.face);
    const dos=await vue('dos',pb.dos);
    const profil=pb.profil?await vue('profil',pb.profil):null;
    if(!face) throw new Error('la photo de face n’a pas pu être lue');
    res={v:ANAT_VERSION,date:Date.now(),bilan:pb.date,depart:!!(pb.bilan&&pb.bilan.type==='depart'),
      face,dos,profil,profilLu:pb.profil||null,opts:(ancien&&ancien.opts)||((cour&&Number(cour.bilan)===pb.date&&cour.opts&&cour.opts.photo)?{photo:cour.opts.photo}:{})};
    // ⚠ LES VERSIONS SAUVEGARDÉES NE PARTENT PLUS À LA DÉTECTION. Avant, « Refaire
    //   la détection » réécrivait morphoAnat sans elles : huit versions perdues
    //   d'un geste. Elles suivent le bilan, comme les points.
    if(ancien&&Array.isArray(ancien.sauvegardes)&&ancien.sauvegardes.length) res.sauvegardes=ancien.sauvegardes;
    // Le choix du bilan et ce qui a été mis de côté pour les autres bilans.
    if(cour&&cour.choix) res.choix=cour.choix;
    // Les silhouettes des autres bilans (A13) ne dépendent pas du bilan lu.
    if(cour&&Array.isArray(cour.silhouettes)&&cour.silhouettes.length) res.silhouettes=cour.silhouettes;
    if(cour&&Array.isArray(cour.suivi)&&cour.suivi.length) res.suivi=cour.suivi;
    if(cour&&cour.archives){
      const ar=Object.assign({},cour.archives); delete ar[String(pb.date)];
      if(Object.keys(ar).length) res.archives=ar;
    }
  }catch(e){
    _anatEchecs.set(email,String((e&&e.message)||e||'échec'));
  }
  _anatEnCours.delete(email);
  const frais=DB.get('users')||{};
  const d=frais[email];
  if(res&&d){
    d.morphoAnat=res;
    d.updatedAt=Date.now();
    frais[email]=d;
    DB.set('users',frais);
    CLOUD.pushOne(email,d);
  }
  try{ const cc=getOwnedClient(currentClientId); if(cc&&cc.email===email) renderAnatCoach(cc); }catch(e){}
  return !!res;
}
/** Refaire la détection automatique (les points posés à la main restent). */
function anatRelancer(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  toast('Détection des repères…');
  anatAnalyser(c.email,true).then(ok=>{
    if(ok) toast('Détection refaite '+ICO.coche);
    else toast('Rien de lu : '+(_anatEchecs.get(c.email)||'la photo n’a pas pu être lue'),'var(--orange)');
  });
}
/** Une option de lecture posée hors édition (A15 : la photo prise vers le sol). */
function anatReglerOption(nom,val){
  const c=getOwnedClient(currentClientId);
  if(!c||_anatEdit) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  if(!d||!d.morphoAnat) return;
  d.morphoAnat.opts=Object.assign({},d.morphoAnat.opts||{},{[nom]:!!val});
  d.updatedAt=Date.now();
  users[c.email]=d;
  const ok=DB.set('users',users);
  try{ renderAnatCoach(getOwnedClient(currentClientId)||d); }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,d),'Lecture mise à jour '+ICO.coche,'le réglage est');
}
/** La demande « paumes vers l'avant » pour les prochaines photos de bilan (A10). */
function anatDemanderPaumes(on){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const users=DB.get('users')||{};
  const d=users[c.email];
  if(!d) return;
  if(on) d.photoPaumes=true; else delete d.photoPaumes;
  d.updatedAt=Date.now();
  users[c.email]=d;
  const ok=DB.set('users',users);
  try{ renderAnatCoach(getOwnedClient(currentClientId)||d); }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,d),on?'Prochaines photos : paumes vers l’avant '+ICO.coche:'Demande retirée '+ICO.coche,'la demande est');
}
function anatVue(v){
  if(_anatEdit) return;
  _anatVueActive=(v==='dos'||v==='profil')?v:'face';
  try{ const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c); }catch(e){}
}

// ── L'ÉDITION DES POINTS ──────────────────────────────────────────────────
function anatEditer(sel){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  let k=(typeof sel==='string')?sel:null;
  if(_anatEdit&&_anatEdit.email===c.email){ if(k) _anatEdit.sel=k; renderAnatCoach(c); return; }
  // A7 : sans point demandé, le premier point de confiance C de la dernière
  // fiche ouverte — c'est lui qu'il faut vérifier d'abord.
  if(!k&&_anatDerniereFiche){
    const f=_anatSafe(()=>anatMesuresRendu(c.morphoAnat,c).fiches.find(x=>x.cle===_anatDerniereFiche));
    if(f&&f.confCles&&f.confCles.length){ k=f.confCles[0]; _anatVueActive=f.confVue; }
  }
  const vue=_anatVueDe(c.morphoAnat,_anatVueActive);
  const pts=anatPoints(c.morphoAnat,vue);
  if(!pts) return;
  _anatEdit={email:c.email,vue,pts:JSON.parse(JSON.stringify(pts)),opts:Object.assign({},anatOptions(c.morphoAnat)),reinit:false,sel:k};
  renderAnatCoach(c);
  try{ document.querySelector('#ccd-anat .an-scene')?.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
}
function anatAnnulerEdition(){
  _anatEdit=null;
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}
function anatPointsAutomatiques(){
  const c=getOwnedClient(currentClientId);
  if(!c||!_anatEdit||!c.morphoAnat) return;
  const v=c.morphoAnat[_anatEdit.vue];
  if(!v||!v.auto) return;
  _anatEdit.pts=JSON.parse(JSON.stringify(v.auto.pts));
  _anatEdit.reinit=true;
  renderAnatCoach(c);
}
function anatOption(nom,val){
  if(!_anatEdit) return;
  _anatEdit.opts[nom]=val;
  const c=getOwnedClient(currentClientId); if(c) renderAnatCoach(c);
}
/**
 * E3 (26/09/2026) — CE QUE CHAQUE POINT FAIT BOUGER. Pour un repère (sans
 * son côté), les lignes de chiffres qui le lisent : [fiche, libellé exact de
 * la ligne, nom court dans la bulle]. Trois au plus : la bulle se lit d'un
 * coup d'œil pendant le glisser, le détail reste dans la fiche.
 * ⚠ Les libellés sont ceux d'anatMesures, À LA LETTRE : un test vérifie que
 *   chacun existe, sans quoi une ligne renommée viderait la bulle sans bruit.
 */
const ANAT_DEPENDANCES=Object.freeze({
  face:Object.freeze({
    vertex:[['buste','Tronc (épaules → hanches)','Tronc'],['jambes','Hauteur de hanche','Hauteur de hanche']],
    acromion:[['clavicules','Largeur biacromiale','Biacromial'],['clavicules','Épaules / bassin','Épaules / bassin'],['bras','Membre supérieur','Membre sup.']],
    epaule:[['bras','Humérus (épaule → coude)','Humérus'],['buste','Tronc (épaules → hanches)','Tronc'],['epaules','Inclinaison de face','Inclinaison']],
    deltoide:[['buste','Rapport deltoïdes / taille (V)','V']],
    coude:[['bras','Humérus (épaule → coude)','Humérus'],['bras','Avant-bras (coude → poignet)','Avant-bras'],['bras','Humérus / avant-bras','Hum. / av.-bras']],
    poignet:[['bras','Avant-bras (coude → poignet)','Avant-bras'],['bras','Membre supérieur','Membre sup.'],['bras','Écart gauche / droite','Écart G / D']],
    taille:[['buste','Rapport deltoïdes / taille (V)','V'],['buste','Rapport hanches / taille (X)','X']],
    crete:[['clavicules','Largeur bicrêtale (bassin)','Bicrêtal'],['clavicules','Épaules / bassin','Épaules / bassin'],['bassin','Inclinaison de face','Inclinaison']],
    hanche:[['jambes','Cuisse (hanche → genou)','Cuisse'],['buste','Tronc (épaules → hanches)','Tronc'],['jambes','Hauteur de hanche','Hauteur de hanche']],
    genou:[['jambes','Cuisse (hanche → genou)','Cuisse'],['jambes','Jambe (genou → cheville)','Jambe'],['jambes','Cuisse / jambe','Cuisse / jambe']],
    cheville:[['jambes','Jambe (genou → cheville)','Jambe'],['jambes','Cuisse / jambe','Cuisse / jambe']],
    talon:[['jambes','Hauteur de hanche','Hauteur de hanche'],['buste','Tronc (épaules → hanches)','Tronc']],
    pointe:[['pieds','Écart G/D','Écart G / D']]}),
  dos:Object.freeze({
    c7:[['dos','Axe C7 → sacrum','Axe C7 → sacrum']],
    sacrum:[['dos','Axe C7 → sacrum','Axe C7 → sacrum']],
    omoplate:[['dos','Omoplates (différence de hauteur)','Omoplates']],
    omoplate_int:[['dos','Bord interne des omoplates (G / D)','Bord interne']],
    acromion:[['epaules','Inclinaison de dos','Inclinaison']],
    epaule:[['epaules','Inclinaison de dos','Inclinaison'],['dos','Triangles bras-tronc (G / D)','Triangles']],
    crete:[['bassin','Inclinaison de dos','Inclinaison']],
    coude:[['dos','Triangles bras-tronc (G / D)','Triangles']],
    poignet:[['dos','Triangles bras-tronc (G / D)','Triangles']],
    taille:[['dos','Triangles bras-tronc (G / D)','Triangles']],
    hanche:[['dos','Triangles bras-tronc (G / D)','Triangles']],
    mollet:[['arriere_pied','Arrière-pied gauche','Arrière-pied G'],['arriere_pied','Arrière-pied droit','Arrière-pied D']],
    cheville:[['arriere_pied','Arrière-pied gauche','Arrière-pied G'],['arriere_pied','Arrière-pied droit','Arrière-pied D']],
    achille:[['arriere_pied','Arrière-pied gauche','Arrière-pied G'],['arriere_pied','Arrière-pied droit','Arrière-pied D']],
    talon:[['arriere_pied','Arrière-pied gauche','Arrière-pied G'],['arriere_pied','Arrière-pied droit','Arrière-pied D']]}),
  profil:Object.freeze({
    tragus:[['tete','Angle cranio-vertébral','Cranio-vertébral'],['tete','Tragus / acromion','Tragus / acromion']],
    c7:[['tete','Angle cranio-vertébral','Cranio-vertébral']],
    acromion:[['tete','Tragus / acromion','Tragus / acromion'],['posture','Inclinaison du tronc','Tronc']],
    trochanter:[['posture','Inclinaison du tronc','Tronc'],['posture','Angle hanche-genou-cheville','Hanche-genou-cheville']],
    genou:[['posture','Angle hanche-genou-cheville','Hanche-genou-cheville']],
    malleole:[['posture','Angle hanche-genou-cheville','Hanche-genou-cheville']]})
});
/**
 * PURE. L'APERÇU D'UN POINT EN COURS DE DÉPLACEMENT : anatMesures sur une
 * COPIE du dossier où la vue porte les points de l'édition — rien n'est écrit,
 * l'original n'est pas touché. Rend les lignes qui lisent ce point.
 * @returns {{lib:string,val:string,marge:string}[]}
 */
function anatApercu(anat,u,vue,pts,opts,k,o){
  const deps=(ANAT_DEPENDANCES[vue]||{})[String(k||'').replace(/_[lr]$/,'')];
  if(!deps||!anat||!anat[vue]||!pts) return [];
  const man={};
  for(const q of Object.keys(pts)) if(pts[q]&&pts[q][2]===2) man[q]=[pts[q][0],pts[q][1]];
  const copie=Object.assign({},anat,{opts:Object.assign({},anat.opts||{},opts||{})});
  copie[vue]=Object.assign({},anat[vue],{man:Object.keys(man).length?man:null});
  let res=null;
  try{ res=anatMesures(copie,u,o||{}); }catch(e){ return []; }
  const out=[];
  for(const [fc,lib,court] of deps){
    const f=(res.fiches||[]).find(x=>x.cle===fc);
    const l=f&&(f.chiffres||[]).find(x=>x.lib===lib);
    if(!l) continue;
    const m=String(f.tolerance||'').match(/±\s?[\d,]+\s?(%|°)/);
    out.push({lib:court,val:String(l.val==null||l.val===''?'-':l.val),marge:m?m[0].replace(/\s/g,'\u00a0'):''});
  }
  return out;
}
/** Le HTML de la bulle : deux ou trois valeurs, et ce qu'elles sont. */
function _htmlAnatBulle(lignes){
  if(!lignes||!lignes.length) return '';
  // Une seule marge pour toutes les lignes : dite une fois, en pied.
  const m=[...new Set(lignes.map(l=>l.marge).filter(Boolean))];
  const une=m.length===1&&lignes.every(l=>l.marge===m[0]);
  return lignes.map(l=>'<div class="an-bulle-l"><span>'+escapeHtml(l.lib)+'</span><b>'+escapeHtml(l.val)+'</b>'
    +(!une&&l.marge?'<i>'+escapeHtml(l.marge)+'</i>':'')+'</div>').join('')
    +'<div class="an-bulle-s">'+(une?'Marge '+escapeHtml(m[0])+' · ':'')+'aperçu, non enregistré</div>';
}
/** « Analyser avec ces points » : on enregistre, et tout se recalcule. */
function anatEnregistrerPoints(silencieux){
  const e=_anatEdit;
  if(!e) return;
  const users=DB.get('users')||{};
  const c=users[e.email];
  if(!c||!currentUser||c.coachId!==currentUser.id||!c.morphoAnat){ _anatEdit=null; return; }
  const a=c.morphoAnat;
  const v=a[e.vue];
  if(!v){ _anatEdit=null; return; }
  if(e.reinit&&!_anatBouge(e.pts,v.auto&&v.auto.pts)) v.man=null;
  else {
    // ⚠ SEULS LES POINTS TOUCHÉS SONT « À LA MAIN ». Les autres restent
    //   automatiques — et gardent leur mention « estimé » quand ils le sont.
    const man={};
    for(const k of Object.keys(e.pts)) if(e.pts[k][2]===2) man[k]=[e.pts[k][0],e.pts[k][1]];
    v.man=Object.keys(man).length?man:null;
  }
  a.opts=Object.assign({},a.opts||{},e.opts);
  a.date=Date.now();
  c.updatedAt=Date.now();
  users[e.email]=c;
  const ok=DB.set('users',users);
  _anatEdit=null;
  try{ const cc=getOwnedClient(currentClientId); if(cc) renderAnatCoach(cc); }catch(x){}
  if(silencieux){ CLOUD.pushOne(e.email,c); return; }
  toastSync(ok,CLOUD.pushOne(e.email,c),'Analyse refaite avec tes points '+ICO.coche,'l’analyse est');
}
function _anatBouge(a,b){
  if(!a||!b) return true;
  for(const k of Object.keys(a)){
    if(!b[k]) return true;
    if(Math.abs(a[k][0]-b[k][0])>0.0005||Math.abs(a[k][1]-b[k][1])>0.0005) return true;
  }
  return false;
}
/**
 * Branche les gestes sur la scène.
 * HORS ÉDITION : un double-clic (ou double tap) sur un point le saisit et
 *   ouvre l'édition sur lui. Kevin : « en double-cliquant dessus, pouvoir les
 *   bouger ».
 * EN ÉDITION : on saisit le point LE PLUS PROCHE du doigt (pas celui que le
 *   navigateur trouve au-dessus : les zones de prise se chevauchent autour
 *   des hanches et des épaules), on le glisse ; et un simple appui ailleurs
 *   sur la photo y amène le point sélectionné.
 */
function _anatBrancherEdition(z){
  const scene=z.querySelector('.an-scene[data-w]');
  const svg=scene&&scene.querySelector('svg.an-os');
  const img=scene&&scene.querySelector('img.an-photo');
  if(!svg||!img) return;
  const W=Number(scene.getAttribute('data-w')),H=Number(scene.getAttribute('data-h'));
  const E=Number(scene.getAttribute('data-e'))||H;
  const e=_anatEdit;
  // LE RECADRAGE : on trace un rectangle sur la photo, il devient le cadre.
  if(_anatRecadre){
    const r=svg.querySelector('.an-cadre-r');
    const vers=(ev)=>{
      const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
      const m=svg.getScreenCTM(); if(!m) return null;
      const q=pt.matrixTransform(m.inverse());
      return {x:Math.max(0,Math.min(W,q.x)),y:Math.max(0,Math.min(H,q.y))};
    };
    let d0=null;
    svg.style.touchAction='none';
    svg.addEventListener('pointerdown',ev=>{ d0=vers(ev); if(!d0) return; ev.preventDefault(); try{ svg.setPointerCapture(ev.pointerId); }catch(x){} });
    svg.addEventListener('pointermove',ev=>{
      if(!d0||!r) return;
      const q=vers(ev); if(!q) return;
      r.setAttribute('x',Math.min(d0.x,q.x).toFixed(1)); r.setAttribute('y',Math.min(d0.y,q.y).toFixed(1));
      r.setAttribute('width',Math.abs(q.x-d0.x).toFixed(1)); r.setAttribute('height',Math.abs(q.y-d0.y).toFixed(1));
    });
    svg.addEventListener('pointerup',ev=>{
      if(!d0) return;
      const q=vers(ev); const a0=d0; d0=null;
      if(!q||Math.abs(q.x-a0.x)<W*0.08||Math.abs(q.y-a0.y)<H*0.08) return;
      const vue=scene.getAttribute('data-vue');
      _anatRecadre=false;
      anatReglerPhoto(vue,{cadre:{x0:Math.min(a0.x,q.x)/W,y0:Math.min(a0.y,q.y)/H,x1:Math.max(a0.x,q.x)/W,y1:Math.max(a0.y,q.y)/H}},true);
    });
    return;
  }
  if(!e){
    let dernier={k:null,t:0};
    const saisir=(k)=>{ if(k) anatEditer(k); };
    svg.addEventListener('dblclick',ev=>{
      const t=/** @type {Element} */(ev.target);
      const k=t&&t.getAttribute&&t.getAttribute('data-k');
      if(k){ ev.preventDefault(); saisir(k); }
    });
    // Le double tap au doigt : tous les navigateurs mobiles ne rendent pas
    // de « dblclick ».
    svg.addEventListener('pointerup',ev=>{
      if(ev.pointerType==='mouse') return;
      const t=/** @type {Element} */(ev.target);
      const k=t&&t.getAttribute&&t.getAttribute('data-k');
      if(!k) return;
      const now=Date.now();
      if(dernier.k===k&&now-dernier.t<400){ ev.preventDefault(); dernier={k:null,t:0}; saisir(k); }
      else dernier={k,t:now};
    });
    return;
  }
  const loupe=scene.querySelector('.an-loupe');
  // E3 — LA BULLE. Le dossier est lu UNE fois, ici, et jamais réécrit : les
  // chiffres de la bulle viennent d'une copie (anatApercu). Seul « Analyser
  // avec ces points » écrit.
  let bulle=scene.querySelector('.an-bulle');
  if(!bulle){ bulle=document.createElement('div'); bulle.className='an-bulle'; bulle.setAttribute('role','status'); bulle.setAttribute('aria-live','polite'); scene.appendChild(bulle); }
  let base=null;
  try{ const d=(DB.get('users')||{})[e.email]; base=d?{anat:d.morphoAnat,u:d}:null; }catch(x){ base=null; }
  const biais=_anatSafe(()=>anatBiaisCoach());
  let bulleT=0, bulleK=null, bulleMin=null, tactile=false;
  const calculerBulle=(k)=>{
    const lignes=base?anatApercu(base.anat,base.u,e.vue,e.pts,e.opts,k,{biais}):[];
    bulle.innerHTML=_htmlAnatBulle(lignes);
    bulle.classList.toggle('on',!!lignes.length);
    placerBulle(k);
  };
  // LA PLACE, à chaque mouvement (le calcul, lui, attend 60 ms) : à côté du
  // point, jamais sur la loupe ni hors de la scène.
  const placerBulle=(k)=>{
    if(!bulle.classList.contains('on')) return;
    const ri=img.getBoundingClientRect(), rs=scene.getBoundingClientRect();
    const q=e.pts[k]; if(!q) return;
    const px=ri.left-rs.left+q[0]*ri.width, py=ri.top-rs.top+q[1]*ri.height;
    const bw=bulle.offsetWidth, bh=bulle.offsetHeight, G=22, Gd=tactile?56:G;
    const lp=(loupe&&scene.classList.contains('glisse'))?{x:parseFloat(loupe.style.left)||0,y:parseFloat(loupe.style.top)||0,w:loupe.offsetWidth,h:loupe.offsetHeight}:null;
    const libre=(x,y)=>x>=4&&y>=4&&x+bw<=rs.width-4&&y+bh<=rs.height-4
      &&!(lp&&x<lp.x+lp.w+4&&x+bw>lp.x-4&&y<lp.y+lp.h+4&&y+bh>lp.y-4);
    const essais=[[px+G,py-8],[px-G-bw,py-8],[px+G,py-bh-G],[px-G-bw,py-bh-G],[px-bw/2,py+Gd],[px-bw/2,py-bh-G]];
    let pos=essais.find(([x,y])=>libre(x,y));
    if(!pos){ const [x,y]=essais[0]; pos=[Math.max(4,Math.min(rs.width-bw-4,x)),Math.max(4,Math.min(rs.height-bh-4,y))]; }
    bulle.style.left=Math.round(pos[0])+'px'; bulle.style.top=Math.round(pos[1])+'px';
  };
  // Au plus une mesure toutes les 60 ms ; la dernière position est toujours rendue.
  const majBulle=(k)=>{
    bulleK=k;
    const t=Date.now();
    if(t-bulleT>=60){ bulleT=t; calculerBulle(k); return; }
    placerBulle(k);
    if(!bulleMin) bulleMin=setTimeout(()=>{ bulleMin=null; bulleT=Date.now(); calculerBulle(bulleK); },60-(t-bulleT));
  };
  let actif=null;
  const versImage=(ev)=>{
    const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
    const m=svg.getScreenCTM(); if(!m) return null;
    const p=pt.matrixTransform(m.inverse());
    return {x:Math.max(0,Math.min(W,p.x)),y:Math.max(0,Math.min(H,p.y))};
  };
  const nomDe=(k)=>{
    const r=anatRepere(e.vue,k);
    return (r?r.lib:k)+(k.endsWith('_l')?' (écran gauche)':k.endsWith('_r')?' (écran droit)':'');
  };
  const choisir=(k)=>{
    if(k!==bulleK){ bulle.classList.remove('on'); }
    e.sel=k; e.aide=k;
    svg.querySelectorAll('.an-pt').forEach(c=>c.classList.toggle('actif',c.getAttribute('data-k')===k));
    svg.querySelectorAll('.an-pt-t').forEach(t=>t.classList.toggle('actif',t.getAttribute('data-t')===k));
    const nom=scene.parentElement&&scene.parentElement.querySelector('.an-nom');
    if(nom) nom.textContent=nomDe(k)+' : glisse-le, ou touche l’endroit où il doit aller';
    // La consigne suit le point choisi, et la liste aussi.
    const z2=scene.closest('.an');
    const cs=z2&&z2.querySelector('.an-consigne');
    if(cs){ cs.innerHTML='<b>* '+escapeHtml(anatNomPoint(e.vue,k))+'</b><span>'+escapeHtml(anatAide(k,e.opts,e.vue).aide)+'</span>'; }
    if(z2) z2.querySelectorAll('.an-rep-c').forEach(x=>{
      const b=x.querySelector('.an-rep-n'); const on=!!b&&(b.getAttribute('onclick')||'').indexOf("'"+k+"'")>=0;
      x.classList.toggle('actif',on);
    });
  };
  const deplacer=(k,x,y)=>{
    e.pts[k]=[Math.round(x/W*10000)/10000,Math.round(y/H*10000)/10000,2];
    svg.querySelectorAll('[data-k="'+k+'"]').forEach(c=>{ c.setAttribute('cx',x.toFixed(1)); c.setAttribute('cy',y.toFixed(1)); });
    svg.querySelectorAll('.an-pt[data-k="'+k+'"]').forEach(c=>{ c.classList.add('man'); c.classList.remove('est'); });
    svg.querySelectorAll('line[data-a="'+k+'"]').forEach(l=>{ l.setAttribute('x1',x.toFixed(1)); l.setAttribute('y1',y.toFixed(1)); });
    svg.querySelectorAll('line[data-b="'+k+'"]').forEach(l=>{ l.setAttribute('x2',x.toFixed(1)); l.setAttribute('y2',y.toFixed(1)); });
    svg.querySelectorAll('text[data-t="'+k+'"]').forEach(t=>{
      const g=t.getAttribute('text-anchor')==='end';
      t.setAttribute('x',(x+(g?-1:1)*E*0.022).toFixed(1)); t.setAttribute('y',(y+Number(t.getAttribute('data-dy')||0)).toFixed(1));
    });
    if(loupe){
      // LA LOUPE : le doigt cache le point qu'il déplace. Elle montre la photo
      // grossie trois fois autour du point, au-dessus du doigt.
      const ri=img.getBoundingClientRect(), rs=scene.getBoundingClientRect();
      const px=x/W*ri.width, py=y/H*ri.height, Z=3, R=loupe.offsetWidth/2||55;
      loupe.style.backgroundImage='url("'+(img.currentSrc||img.src).replace(/"/g,'%22')+'")';
      loupe.style.backgroundSize=(ri.width*Z)+'px '+(ri.height*Z)+'px';
      loupe.style.backgroundPosition=(-(px*Z-R))+'px '+(-(py*Z-R))+'px';
      let lx=ri.left-rs.left+px-R, ly=ri.top-rs.top+py-2.4*R;
      if(ly<4) ly=ri.top-rs.top+py+0.6*R;
      loupe.style.left=Math.max(4,Math.min(rs.width-2*R-4,lx))+'px';
      loupe.style.top=ly+'px';
    }
    majBulle(k);
  };
  /** Le point le plus proche, dans un rayon de prise raisonnable. */
  const plusProche=(p)=>{
    let best=null,d0=E*0.045;
    for(const k of Object.keys(e.pts)){
      const q=e.pts[k];
      const d=Math.hypot(q[0]*W-p.x,q[1]*H-p.y);
      if(d<d0){ d0=d; best=k; }
    }
    return best;
  };
  svg.addEventListener('pointerdown',ev=>{
    const p=versImage(ev); if(!p) return;
    tactile=ev.pointerType!=='mouse';
    let k=plusProche(p);
    // Un appui loin de tout point amène le point sélectionné à cet endroit.
    if(!k&&e.sel) k=e.sel;
    if(!k) return;
    ev.preventDefault();
    actif=k;
    choisir(k);
    try{ svg.setPointerCapture(ev.pointerId); }catch(x){}
    scene.classList.add('glisse');
    if(k===e.sel&&!plusProche(p)) deplacer(k,p.x,p.y);
    else deplacer(k,e.pts[k][0]*W,e.pts[k][1]*H);
  });
  svg.addEventListener('pointermove',ev=>{
    if(!actif) return;
    const p=versImage(ev); if(p) deplacer(actif,p.x,p.y);
  });
  const fin=()=>{ actif=null; scene.classList.remove('glisse'); };
  svg.addEventListener('pointerup',fin);
  svg.addEventListener('pointercancel',fin);
  // AU CLAVIER : Tab pour choisir un point, flèches pour le déplacer.
  svg.addEventListener('focusin',ev=>{
    const t=/** @type {Element} */(ev.target);
    const k=t&&t.getAttribute&&t.getAttribute('data-k');
    if(k) choisir(k);
  });
  svg.addEventListener('keydown',ev=>{
    const t=/** @type {Element} */(ev.target);
    const k=t&&t.getAttribute&&t.getAttribute('data-k');
    if(!k||!e.pts[k]) return;
    const pas=(ev.shiftKey?10:2)*E/1000;
    const d={ArrowLeft:[-pas,0],ArrowRight:[pas,0],ArrowUp:[0,-pas],ArrowDown:[0,pas]}[ev.key];
    if(!d) return;
    ev.preventDefault();
    deplacer(k,Math.max(0,Math.min(W,e.pts[k][0]*W+d[0])),Math.max(0,Math.min(H,e.pts[k][1]*H+d[1])));
  });
  if(e.sel&&e.pts[e.sel]) choisir(e.sel);
}
/** Déplie / replie une fiche, et l'amène sous les yeux depuis l'anneau. */
let _anatDerniereFiche=null;
function anatOuvrir(cle,depuisAnneau){
  const z=document.getElementById('ccd-anat');
  if(!z) return;
  const f=z.querySelector('.an-f[data-k="'+cle+'"]');
  if(!f) return;
  if(f.classList.contains('an-f-plus-l')&&!_anatToutes) anatToutesFiches();
  const ouvrir=depuisAnneau?true:!f.classList.contains('ouvert');
  _anatDerniereFiche=ouvrir?cle:null;
  f.classList.toggle('ouvert',ouvrir);
  const b=f.querySelector('.an-f-plus');
  if(b) b.setAttribute('aria-expanded',ouvrir?'true':'false');
  z.querySelectorAll('.an-lbl,.an-r').forEach(e=>e.classList.toggle('actif',e.getAttribute('data-k')===cle&&ouvrir));
  if(depuisAnneau){
    try{ f.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
    f.classList.add('an-eclair'); setTimeout(()=>f.classList.remove('an-eclair'),1200);
  }
}

/** Une zone (pixels) ajustée au format voulu, sans rogner. */
function _anatAjuster(zone,aspect){
  let {x0,y0,x1,y1}=zone;
  let w=x1-x0,h=y1-y0;
  if(w/h<aspect){ const nw=h*aspect; x0-=(nw-w)/2; w=nw; }
  else { const nh=w/aspect; y0-=(nh-h)/2; h=nh; }
  return {x0,y0,w,h};
}
/** Le recadrage d'une zone : la photo positionnée dans une fenêtre au bon format. */
function _anatCadrage(zone,v,aspect){
  if(!zone||!v) return null;
  const z=_anatAjuster(zone,aspect);
  return {l:-z.x0/z.w*100,t:-z.y0/z.h*100,w:v.w/z.w*100,h:v.h/z.h*100,z};
}
function _anatImg(src,cad,vue,filtre){
  if(!cad||!src) return '';
  return '<img class="an-img" src="'+escapeHtml(src)+'" alt="" loading="lazy" decoding="async" draggable="false"'+(vue?' data-v="'+vue+'"':'')+' style="left:'+cad.l.toFixed(3)+'%;top:'+cad.t.toFixed(3)
    +'%;width:'+cad.w.toFixed(3)+'%;height:'+cad.h.toFixed(3)+'%'+(filtre?';filter:'+filtre:'')+'">';
}
/** Les traits et les points d'une vue, dans le repère de pixels de la photo. */
function _anatDessin(vue,pts,W,H,edit,E){
  E=E||H;
  const P=k=>pts[k]?{x:pts[k][0]*W,y:pts[k][1]*H,e:pts[k][2]}:null;
  let s='';
  // La ligne du sol et le fil à plomb : ce qui met la photo à l'échelle.
  const vx=P('vertex'),tl=P('talon_l'),tr=P('talon_r');
  if(vx&&(tl||tr)){
    const sol=Math.max(tl?tl.y:0,tr?tr.y:0);
    s+='<line class="an-t-plomb" x1="'+vx.x.toFixed(1)+'" y1="'+vx.y.toFixed(1)+'" x2="'+vx.x.toFixed(1)+'" y2="'+sol.toFixed(1)+'"/>'
      +'<line class="an-t-sol" x1="'+(vx.x-W*0.3).toFixed(1)+'" y1="'+sol.toFixed(1)+'" x2="'+(vx.x+W*0.3).toFixed(1)+'" y2="'+sol.toFixed(1)+'"/>';
  }
  // DE PROFIL, le fil à plomb passe par la MALLÉOLE (A9) : c'est de lui que
  // se mesurent les distances de la fiche Posture.
  const ma=vue==='profil'?P('malleole'):null, ta=vue==='profil'?P('talon'):null;
  if(ma&&vx){
    const sol=ta?ta.y:ma.y;
    s+='<line class="an-t-plomb an-t-plomb-p" x1="'+ma.x.toFixed(1)+'" y1="'+(vx.y-H*0.02).toFixed(1)+'" x2="'+ma.x.toFixed(1)+'" y2="'+sol.toFixed(1)+'"/>'
      +'<line class="an-t-sol" x1="'+(ma.x-W*0.3).toFixed(1)+'" y1="'+sol.toFixed(1)+'" x2="'+(ma.x+W*0.3).toFixed(1)+'" y2="'+sol.toFixed(1)+'"/>';
  }
  for(const [a,b,c] of _anatTraits(vue)){
    const A=P(a),B=P(b);
    if(!A||!B) continue;
    s+='<line class="an-t '+c+'" data-a="'+a+'" data-b="'+b+'" x1="'+A.x.toFixed(1)+'" y1="'+A.y.toFixed(1)+'" x2="'+B.x.toFixed(1)+'" y2="'+B.y.toFixed(1)+'"/>';
  }
  const r=E*(edit?0.0105:0.0068);
  const cx=(()=>{ const a=P('hanche_l'),b=P('hanche_r'); return a&&b?(a.x+b.x)/2:W/2; })();
  const sensP=(vue==='profil'&&P('tragus')&&P('c7'))?(Math.sign(P('tragus').x-P('c7').x)||1):0;
  for(const k of anatCles(vue)){
    const p=P(k);
    if(!p) continue;
    const rep=anatRepere(vue,k);
    const cls='an-pt'+(p.e>=2?' man':(p.e<1?' est':''))+(rep&&rep.est?' an-pt-os':'');
    s+='<circle class="an-hit" data-k="'+k+'" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(E*(edit?0.03:0.02)).toFixed(1)+'">'
      +(edit?'':'<title>'+escapeHtml((rep?rep.lib:k)+' : double-clic pour le déplacer')+'</title>')+'</circle>';
    s+='<circle class="'+cls+'" data-k="'+k+'" cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+r.toFixed(1)+'"'
      +(edit?' tabindex="0" role="button" aria-label="'+escapeHtml((rep?rep.lib:k)+(k.endsWith('_l')?', côté gauche de l’écran':k.endsWith('_r')?', côté droit de l’écran':''))+'. Flèches pour déplacer."':'')+'/>';
    // LE NOM DU POINT, en édition : côté extérieur, pour ne pas couvrir le corps.
    if(edit){
      // De profil (A9) : les noms devant le corps, celui de C7 derrière la nuque.
      const g=sensP?(k==='c7'?sensP>0:sensP<0):p.x<cx-E*0.01, mil=!sensP&&Math.abs(p.x-cx)<=E*0.01;
      const dx=(g?-1:1)*E*0.022;
      const dy=E*(ANAT_NOM_DY[k.replace(/_[lr]$/,'')]||0.007);
      s+='<text class="an-pt-t" data-t="'+k+'" data-dy="'+dy.toFixed(1)+'" x="'+(p.x+dx).toFixed(1)+'" y="'+(p.y+dy).toFixed(1)+'" font-size="'+(E*0.021).toFixed(1)+'" text-anchor="'+(g&&!mil?'end':'start')+'">'+escapeHtml(anatAide(k,null,vue).court)+'</text>';
    }
  }
  return s;
}
function _anatPoints(f){
  const n=f.niveau;
  // Une mesure de confiance C : les points du niveau en contour seul (A7).
  let h='<span class="an-pts'+(n==null?' an-pts-vide':'')+(f.conf==='C'?' an-pts-c':'')+'" role="img" aria-label="'
    +escapeHtml(n==null?'sans position':(n===0?'dans la marge':f.bornes[n>0?1:0]+', niveau '+Math.abs(n)+' sur 3'))+'">';
  for(let i=-3;i<=3;i++){
    const on=(n!=null)&&(n===0?i===0:(n>0?(i>0&&i<=n):(i<0&&i>=n)));
    h+='<i data-i="'+Math.abs(i)+'"'+(on?' data-on="1"':'')+'></i>';
  }
  return h+'</span>';
}
function _anatDateFr(t){
  try{ return new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){ return ''; }
}
function _anatContact(c,manque,locales){
  const pre=String(c.fname||'').trim()||'l’athlète';
  const L=Array.isArray(locales)?locales:[];
  const vraies=(manque||[]).filter(m=>m!==ANAT_MANQUE_LOCALE.face&&m!==ANAT_MANQUE_LOCALE.dos);
  let txt='Salut '+(String(c.fname||'').trim())+' ! ';
  // LA PHOTO PRISE MAIS PAS ARRIVÉE : on ne la redemande pas, on dit où elle est.
  if(L.length){
    const q=L.length>1?'Tes photos de '+L.join(' et de ')+' sont':'Ta photo de '+L[0]+' est';
    txt+=q+' bien dans ton bilan, mais '+(L.length>1?'elles sont restées':'elle est restée')
      +' sur ton téléphone : '+(L.length>1?'elles ne sont':'elle n’est')+' pas encore synchronisée'+(L.length>1?'s':'')
      +' et je ne '+(L.length>1?'les':'la')+' vois pas de mon côté. Ouvre l’application avec du réseau (Wi-Fi ou 4G) : '
      +(L.length>1?'elles partiront':'elle partira')+' toute'+(L.length>1?'s':'')+' seule'+(L.length>1?'s':'')
      +'. Si rien n’arrive, remets-'+(L.length>1?'les':'la')+' dans ton bilan.'
      +(vraies.length?' Il me manque aussi '+vraies.join(' et ')+'.':'')+' Merci !';
  }else{
    txt+='Pour ton analyse morpho-anatomique, il me manque '
    +(manque&&manque.length?manque.join(' et '):'tes photos de bilan')
    +'. Tu peux compléter ton bilan dans l’application (photos de face et de dos en pied, pieds nus à largeur de hanches et posés comme d’habitude, bras relâchés légèrement écartés du corps'
    +(c.photoPaumes?', paumes tournées vers l’avant sur la photo de face':'')
    +', idéalement prises par quelqu’un d’autre ou avec un minuteur) ? Merci !';
  }
  const tel=String(c.phone||'').trim();
  let url='';
  try{ if(tel&&_numWa(tel)) url=waLink(tel,txt); }catch(e){ url=''; }
  if(!url&&c.email) url='mailto:'+c.email+'?subject='+encodeURIComponent('Ton bilan')+'&body='+encodeURIComponent(txt);
  return {url,pre};
}

function renderAnatCoach(c){
  const z=document.getElementById('ccd-anat');
  if(!z) return false;
  if(_anatEdit&&(!c||_anatEdit.email!==c.email)) _anatEdit=null;
  let h='';
  try{ h=_htmlAnat(c); }catch(e){ h=''; }
  z.innerHTML=h;
  if(!h) return true;
  try{ _anatBrancherEdition(z); }catch(e){}
  try{ _anatNettete(z,c); }catch(e){}
  try{ _anatCalerListe(z); }catch(e){}
  _anatLancerFond(c);
  return true;
}
/**
 * LES LECTURES DE FOND — détection, silhouettes, suivi postural. Elles
 * chargent le moteur de pose et son modèle « full » (≈ 6 Mo, et des secondes
 * de calcul) : E4 (26/09/2026) les réserve à L'ONGLET DONNÉES, où l'analyse
 * se lit. Avant, ouvrir une fiche sur Entraînement gelait l'écran 3,6 s pour
 * une analyse que personne ne regardait. ccdVue les relance à l'arrivée sur
 * Données.
 */
function _anatLancerFond(c){
  if(!c||_ccdVue!=='donnees') return false;
  // ⚠ L'ONGLET EST RELU AU DÉPART, PAS SEULEMENT AU RENDU. openClientDetail
  //   rend la nouvelle fiche AVANT de repasser sur Entraînement (un minuteur à
  //   0) : au rendu, _ccdVue est encore l'onglet de l'athlète d'avant.
  const surDonnees=()=>_ccdVue==='donnees';
  try{
    const pb=anatPremierBilan(c);
    if(anatARefaire(c,pb)&&!_anatEnCours.has(c.email)&&!_anatEchecs.has(c.email))
      setTimeout(()=>{ if(surDonnees()) anatAnalyser(c.email).catch(()=>{}); },50);
    else if(anatSilhouettesAFaire(c).length&&!_anatSilEnCours.has(c.email))
      setTimeout(()=>{ if(surDonnees()) anatSuivreSilhouettes(c.email).catch(()=>{}); },400);
    else if(anatPostureAFaire(c).length&&!_anatSuiviEnCours.has(c.email))
      setTimeout(()=>{ if(surDonnees()) anatSuivrePosture(c.email).catch(()=>{}); },600);
    else return false;
  }catch(e){ return false; }
  return true;
}

/**
 * La ligne sous le titre : le bilan lu. Un seul bilan à photos : le texte,
 * comme avant. Plusieurs : un menu, le départ en tête et marqué
 * « automatique ». Figé pendant l'ajustement des points — changer de photo
 * sous des points en cours de pose les rendrait faux.
 */
function _htmlAnatChoixBilan(c,pb,fige){
  let liste=[];
  try{ liste=anatBilansPhotos(c).filter(x=>x.dos||x.date===pb.date); }catch(e){ liste=[]; }
  const nomDe=x=>(x.depart?'Départ':'Bilan')+' · '+_anatDateFr(x.date);
  if(liste.length<2||!pb.date)
    return '<span>'+(pb.date?(pb.auto?'Photos du premier bilan · ':'Photos du bilan du ')+_anatDateFr(pb.date)
      :'Photos de face et de dos du premier bilan')+'</span>';
  const opts=liste.slice().reverse().map(x=>'<option value="'+(x.defaut?'auto':x.date)+'"'+(x.date===pb.date?' selected':'')+'>'
    +escapeHtml(nomDe(x)+(x.defaut?' (auto)':'')+(x.dos?'':' · sans dos'))+'</option>').join('');
  return '<label class="an-bilan"><span>Photos du</span><select'+(fige?' disabled':'')
    +' aria-label="Bilan dont on analyse les photos" onchange="anatChoisirBilan(this.value)">'+opts+'</select></label>';
}
function _htmlAnat(c){
  if(!c) return '';
  // Mêmes gardes que la silhouette : une invitation n'a pas de corps, et une
  // grossesse déclarée met les photos du corps de côté.
  if(c._fromCode) return '';
  try{ if(!phpDisponible(c)) return ''; }catch(e){}
  const pb=anatPremierBilan(c);
  const a=(c.morphoAnat&&c.morphoAnat.v===ANAT_VERSION&&Number(c.morphoAnat.bilan)===pb.date)?c.morphoAnat:null;
  const enCours=_anatEnCours.has(c.email);
  const echec=_anatEchecs.get(c.email)||null;
  const manque=pb.manque;
  const grise=manque.length>0;
  const edit=_anatEdit&&_anatEdit.email===c.email?_anatEdit:null;
  const tete='<div class="an-tete"><span class="an-tete-i">'+ANAT_SVG.tete+'</span><div class="an-tete-c"><h4>Analyse <span>morpho-anatomique</span></h4>'
    +_htmlAnatChoixBilan(c,pb,!!edit)+'</div>'
    +((grise||!a)?'':_htmlAnatExport())
    +((grise||!a)?'':'<div class="an-vues" role="tablist">'
      +['face','dos','profil'].map(v=>{ const sans=v==='profil'&&!a.profil, on=_anatVueDe(a,_anatVueActive)===v;
        return '<button type="button" role="tab" class="an-vue-b'+(on?' actif':'')+'" aria-selected="'+on+'"'+((edit||sans)?' disabled':'')
          +(sans?' title="Pas de photo de profil sur ce bilan"':'')+' onclick="anatVue(\''+v+'\')">'+({face:'Face',dos:'Dos',profil:'Profil'})[v]+'</button>'; }).join('')
      +'</div>')+'</div>';

  if(grise){
    const k=_anatContact(c,manque,pb.locales);
    const fant='<div class="an-fant">'+Array.from({length:5}).map(()=>'<div class="an-fant-c"><i></i><div><b></b><span></span><span></span></div></div>').join('')+'</div>';
    return '<div class="an an-grise">'+tete
      +'<div class="an-grise-corps" aria-hidden="true"><div class="an-grille">'+fant+'<div class="an-scene-vide"></div>'+fant+'</div></div>'
      +'<div class="an-voile"><div class="an-voile-c"><b>Analyse indisponible</b><span>Il manque '+escapeHtml(manque.join(' et '))
      +(pb.locales&&pb.locales.length?(pb.locales.length>1?'. Elles ont été prises, mais leur envoi n’a pas abouti : elles partiront':'. Elle a été prise, mais son envoi n’a pas abouti : elle partira')
        +' quand l’athlète rouvrira l’application avec du réseau.'
        :'. L’analyse se lit sur les photos de face et de dos '+(pb.date&&!pb.auto?'du bilan du '+_anatDateFr(pb.date):'du premier bilan')+'.')+'</span>'
      +(k.url?'<a class="btn an-contact" href="'+escapeHtml(k.url)+'" target="_blank" rel="noopener">'+ANAT_SVG.msg+'<span>Contacter '+escapeHtml(k.pre)+' pour mettre à jour ses données</span></a>'
        :'<span class="an-voile-s">Aucun numéro ni adresse pour contacter '+escapeHtml(k.pre)+'.</span>')
      +'</div></div></div>';
  }
  if(!a){
    return '<div class="an">'+tete+'<div class="an-attente">'
      +'<div class="an-attente-ph"><img src="'+escapeHtml(pb.face)+'" alt="Photo de face du premier bilan"></div>'
      +'<div class="an-attente-c">'+(echec
        ?'<b>La photo n’a pas pu être lue</b><span>'+escapeHtml(echec)+'.</span>'
          +'<div class="an-attente-b"><button type="button" class="btn btn-red btn-casse an-relance" onclick="anatRelancer()">'+ANAT_SVG.relancer+'<span>Réessayer</span></button></div>'
        :'<span class="an-roue" aria-hidden="true"></span><b>Détection des repères anatomiques…</b><span>Les photos de face et de dos du premier bilan passent dans le moteur de pose, sur cet appareil. Quelques secondes la première fois ; les points pourront ensuite être ajustés à la main.</span>')
      +'</div></div></div>';
  }

  // ── L'ANALYSE ────────────────────────────────────────────────────────────
  // En édition, les chiffres restent ceux de l'analyse enregistrée : ils ne
  // bougent qu'au clic sur « Analyser avec ces points ».
  const res=anatMesuresRendu(a,c,true);
  const fiches=res.fiches;
  const textes={};
  fiches.forEach(f=>{ try{ textes[f.cle]=anatTexte(f,res); }catch(e){ textes[f.cle]={court:'',lecture:'',privilegier:[],amenager:[],verifier:''}; } });
  const vueAct=(edit?edit.vue:_anatVueDe(a,_anatVueActive));
  const V=a[vueAct];
  const src=_anatSrcVue(pb,vueAct);
  const pts=edit?edit.pts:anatPoints(a,vueAct);
  const opts=edit?edit.opts:res.opts;
  const W=V.w,H=V.h;
  // LE CADRE : toute la photo, ou la partie que le coach a recadrée. Tout —
  // photo, traits, étiquettes — se dessine dans le repère de pixels de la
  // photo ; le cadre ne change que la fenêtre.
  const reglage=anatReglage(a,vueAct);
  const filtre=anatFiltre(reglage);
  const C=reglage.cadre?{x0:reglage.cadre.x0*W,y0:reglage.cadre.y0*H,x1:reglage.cadre.x1*W,y1:reglage.cadre.y1*H}:{x0:0,y0:0,x1:W,y1:H};
  const CW=C.x1-C.x0,CH=C.y1-C.y0,G=Math.round(CW*0.34),TW=CW+2*G,VX=C.x0-G;
  const pctX=x=>((x-VX)/TW*100);

  // L'anneau : une étiquette par région lisible sur cette vue.
  let anneau='',fils='';
  if(!edit&&!_anatRecadre){
    const M=res;
    const cotes=anatCotes(vueAct,vueAct==='face'&&opts.miroir);
    const Pp=k=>pts[k]?{x:pts[k][0]*W,y:pts[k][1]*H}:null;
    const P2=(k,s)=>Pp(k+'_'+cotes[s]);
    const ancre={face:{clavicules:()=>P2('acromion','g'),epaules:()=>P2('acromion','d'),buste:()=>{ const a1=P2('epaule','g'),b1=P2('hanche','d'); return a1&&b1?_anatMil(a1,b1):null; },
        bras:()=>P2('coude','g'),bassin:()=>P2('crete','g'),jambes:()=>{ const a1=P2('hanche','d'),b1=P2('genou','d'); return a1&&b1?_anatMil(a1,b1):null; },
        genoux:()=>P2('genou','g'),pieds:()=>P2('pointe','d'),coudes:()=>P2('coude','d')},
      dos:{arriere_pied:()=>P2('achille','d'),epaules:()=>P2('acromion','g'),dos:()=>Pp('c7')&&Pp('sacrum')?_anatMil(Pp('c7'),Pp('sacrum')):null,bassin:()=>P2('crete','g'),
        bras:()=>P2('coude','d'),genoux:()=>P2('genou','d')},
      profil:{tete:()=>Pp('tragus'),posture:()=>Pp('trochanter')}}[vueAct];
    const et=[];
    M.fiches.forEach(f=>{
      const fn=ancre[f.cle]; if(!fn) return;
      const p=fn(); if(!p) return;
      // Hors du cadre : pas d'étiquette.
      if(p.x<C.x0||p.x>C.x1||p.y<C.y0||p.y>C.y1) return;
      et.push({f,p,cote:p.x<(C.x0+C.x1)/2?'g':'d'});
    });
    for(const cote of ['g','d']){
      const l=et.filter(e=>e.cote===cote).sort((x,y)=>x.p.y-y.p.y);
      let min=C.y0+CH*0.05;
      l.forEach(e=>{ e.y=Math.max(e.p.y,min); min=e.y+CH*0.1; });
      const deb=l.length?l[l.length-1].y-(C.y0+CH*0.96):0;
      if(deb>0) l.forEach(e=>{ e.y-=deb; });
    }
    et.forEach(e=>{
      const xl=e.cote==='g'?C.x0-G*0.14:C.x1+G*0.14;
      fils+='<polyline class="an-fil" points="'+xl.toFixed(1)+','+e.y.toFixed(1)+' '+e.p.x.toFixed(1)+','+e.p.y.toFixed(1)+'"/>'
        +'<circle class="an-fil-p" cx="'+e.p.x.toFixed(1)+'" cy="'+e.p.y.toFixed(1)+'" r="'+(CH*0.009).toFixed(1)+'"/>';
      anneau+='<button type="button" class="an-lbl an-lbl-'+e.cote+'" data-k="'+e.f.cle+'" data-n="'+(e.f.niveau==null?'':Math.abs(e.f.niveau))+'" style="top:'+((e.y-C.y0)/CH*100).toFixed(2)+'%;'
        // L'étiquette ne sort jamais de la scène : sa largeur est bornée à
        // la marge qui lui reste, bord compris.
        +(e.cote==='g'?'right:'+(100-pctX(xl)).toFixed(2)+'%;max-width:'+(pctX(xl)-1).toFixed(2)+'%'
          :'left:'+pctX(xl).toFixed(2)+'%;max-width:'+(99-pctX(xl)).toFixed(2)+'%')+'" onclick="anatOuvrir(\''+e.f.cle+'\',true)"'+(e.f.court?' aria-label="'+escapeHtml(e.f.lib)+'"':'')+'>'+escapeHtml(e.f.court||e.f.lib)+'</button>';
    });
  }
  const echelle=res.echelle;
  const ver=echelle&&echelle.verif;   // les deux échelles et leur accord (A4)
  // La photo : positionnée pour que le cadre remplisse la fenêtre, et rognée
  // au cadre (les marges des étiquettes restent sombres).
  const clip=reglage.cadre?';clip-path:inset('+(C.y0/H*100).toFixed(3)+'% '+((W-C.x1)/W*100).toFixed(3)+'% '+((H-C.y1)/H*100).toFixed(3)+'% '+(C.x0/W*100).toFixed(3)+'%)':'';
  const scene='<div class="an-scene'+(edit?' an-edit':'')+(_anatRecadre?' an-recadre':'')+'" data-vue="'+vueAct+'"'+(edit?' data-edit="1"':'')+' data-w="'+W+'" data-h="'+H+'" data-e="'+CH.toFixed(1)+'" style="aspect-ratio:'+TW.toFixed(1)+'/'+CH.toFixed(1)+';max-width:calc(78vh * '+(TW/CH).toFixed(4)+')">'
    +'<img class="an-photo" data-v="'+vueAct+'" src="'+escapeHtml(src)+'" alt="Photo de '+({face:'face',dos:'dos',profil:'profil'})[vueAct]+' du bilan" decoding="async" draggable="false" style="left:'+pctX(0).toFixed(3)+'%;top:'+(-C.y0/CH*100).toFixed(3)+'%;width:'+(W/TW*100).toFixed(3)+'%;height:'+(H/CH*100).toFixed(3)+'%'+clip+(filtre?';filter:'+filtre:'')+'">'
    +'<svg class="an-os" viewBox="'+VX.toFixed(1)+' '+C.y0.toFixed(1)+' '+TW.toFixed(1)+' '+CH.toFixed(1)+'" preserveAspectRatio="xMidYMid meet"'+(edit?' aria-label="Repères déplaçables"':' aria-hidden="true"')+'>'+fils+_anatDessin(vueAct,pts,W,H,!!edit,CH)
      +(_anatRecadre?'<rect class="an-cadre-r" x="0" y="0" width="0" height="0"/>':'')+'</svg>'
    +anneau
    +(edit?'<div class="an-loupe" aria-hidden="true"'+(filtre?' style="filter:'+filtre+'"':'')+'></div>':'')
    +'</div>'
    +(edit?'<div class="an-nom" aria-live="polite">Touche un point et fais-le glisser, ou sélectionne-le puis touche l’endroit où il doit aller</div>':'')
    +(_anatRecadre?'<div class="an-nom">Trace sur la photo le rectangle à garder</div>':'');
  // Sous la scène : l'échelle, les options, et le geste d'édition.
  const ath=(s)=>{ const cc=anatCotes('face',!!opts.miroir); return s===cc.g?'gauche':'droit'; };
  const optsHtml=vueAct==='face'?'<div class="an-opts">'
      +(edit?'<label class="an-opt"><input type="checkbox"'+(opts.miroir?' checked':'')+' onchange="anatOption(\'miroir\',this.checked)"><span>Photo prise dans un miroir</span></label>'
        +'<label class="an-opt"><input type="checkbox"'+(opts.cheveux?' checked':'')+' onchange="anatOption(\'cheveux\',this.checked)"><span>Cheveux volumineux (sommet du crâne sur l’os)</span></label>'
        +'<label class="an-opt"><input type="checkbox"'+((opts.paumes!=null?opts.paumes:res.opts.paumes)?' checked':'')+' onchange="anatOption(\'paumes\',this.checked)"><span>Paumes tournées vers l’avant (angle de port des coudes)</span></label>'
        +'<div class="an-opt-seg" role="group" aria-label="Bras qui tient le téléphone"><span>Téléphone tenu :</span>'
        +[['','aucun'],[anatCotes('face',!!opts.miroir).g,'bras gauche'],[anatCotes('face',!!opts.miroir).d,'bras droit']].map(([v,l])=>'<button type="button" class="'+((opts.telephone||'')===v?'actif':'')+'" onclick="anatOption(\'telephone\','+(v?'\''+v+'\'':'null')+')">'+l+'</button>').join('')+'</div>'
      :'<span class="an-puce">'+(opts.miroir?'Photo au miroir':'Photo sans miroir')+'</span>'
        +(opts.cheveux?'<span class="an-puce">Cheveux volumineux : crâne posé sur l’os, échelle ±'+ANAT_ECHELLE_CHEVEUX_PCT+' %</span>':'')
        +(opts.paumes?'<span class="an-puce">Paumes vers l’avant</span>':'')
        +(opts.telephone?'<span class="an-puce an-puce-o">Téléphone tenu : bras '+ath(opts.telephone)+' : écarté des mesures</span>':''))
      +'</div>':'';
  const aideSel=edit&&(edit.aide||edit.sel)?(edit.aide||edit.sel):null;
  const liste=edit?'<div class="an-rep"><h6>Repères <span> : touche un nom pour le sélectionner, « * » pour sa consigne ; ◂ ▸ : côté gauche ou droit de l’écran</span></h6><div class="an-rep-l">'
      +anatCles(vueAct).filter(k=>pts[k]).map(k=>{
        const e2=pts[k][2];
        return '<span class="an-rep-c'+(edit.sel===k?' actif':'')+'" data-e="'+(e2>=2?'man':e2<1?'est':'auto')+'">'
          +'<button type="button" class="an-rep-n" title="'+escapeHtml(anatNomPoint(vueAct,k))+'" onclick="anatChoisirPoint(\''+k+'\')">'+escapeHtml(anatAide(k,null,vueAct).court)+(k.endsWith('_l')?' ◂':k.endsWith('_r')?' ▸':'')+'</button>'
          +'<button type="button" class="an-rep-a" aria-label="Consigne : '+escapeHtml(anatNomPoint(vueAct,k))+'" onclick="anatChoisirPoint(\''+k+'\')">*</button></span>';
      }).join('')+'</div>'
      +'<div class="an-consigne" aria-live="polite">'+(aideSel?'<b>* '+escapeHtml(anatNomPoint(vueAct,aideSel))+'</b><span>'+escapeHtml(anatAide(aideSel,edit&&edit.opts,vueAct).aide)+'</span>'
        :'<span>Touche un repère ou son « * » : sa consigne de placement s’affiche ici.</span>')+'</div></div>':'';
  const reg=anatReglage(a,vueAct);
  const modif=!!(reg.cadre||reg.lum!==100||reg.con!==100);
  // LES RÉGLAGES DE LA PHOTO, SOUS LA LISTE DES ZONES (colonne de gauche).
  // Kevin, 25/09/2026 : « décale réglage de la photo pile dessous toute cette
  // liste-là ».
  const photoHtml='<div class="an-ph"><div class="an-ph-t">'+ANAT_SVG.reglage+'<span>Réglages de la photo</span>'
      +(modif?'<i>modifiée</i>':'')
      +'<label class="an-net" title="Accentuation et niveaux automatiques de l’affichage"><input type="checkbox"'+(reg.net!==false?' checked':'')+' onchange="anatReglerPhoto(\''+vueAct+'\',{net:this.checked},true)"><span>Netteté auto</span></label></div>'
      +'<div class="an-ph-l">'
      +'<label class="an-ph-r"><span>Luminosité</span><input type="range" min="40" max="250" step="5" value="'+reg.lum+'" data-r="lum" oninput="anatCurseur(this,\'lum\')" onchange="anatCurseur(this,\'lum\',true)"><output>'+reg.lum+' %</output></label>'
      +'<label class="an-ph-r"><span>Contraste</span><input type="range" min="40" max="250" step="5" value="'+reg.con+'" data-r="con" oninput="anatCurseur(this,\'con\')" onchange="anatCurseur(this,\'con\',true)"><output>'+reg.con+' %</output></label>'
      +'</div><div class="an-ph-b">'+(_anatRecadre
        ?'<button type="button" class="an-b3 actif" onclick="anatModeRecadrage(false)">'+ANAT_SVG.x+'<span>Annuler le recadrage</span></button><span class="an-ph-aide">Trace sur la photo le rectangle à garder.</span>'
        :'<button type="button" class="an-b3" onclick="anatModeRecadrage(true)">'+ANAT_SVG.recadrer+'<span>Recadrer</span></button>'
          +'<button type="button" class="an-b3" onclick="anatCadrerPersonne()">'+ANAT_SVG.cadrer+'<span>Cadrer</span></button>'
          +'<button type="button" class="an-b3" onclick="anatPhotoEntiere()"'+(reg.cadre?'':' disabled')+'>'+ANAT_SVG.entiere+'<span>Photo entière</span></button>'
          +'<button type="button" class="an-b3" onclick="anatReinitialiserPhoto()"'+(modif?'':' disabled')+'>'+ANAT_SVG.relancer+'<span>Réinitialiser</span></button>')
      +'</div></div>';
  // LA SAUVEGARDE : l'état courant (points, options, réglages) enregistré
  // sous une date, et les versions précédentes qu'on peut restaurer.
  const sauv=Array.isArray(a.sauvegardes)?a.sauvegardes:[];
  const sauvHtml='<details class="an-sv"><summary>'+ANAT_SVG.disquette+'<span>Sauvegarde</span>'+(sauv.length?'<i>'+sauv.length+'</i>':'')+ANAT_SVG.chev+'</summary>'
    +'<div class="an-sv-m"><button type="button" class="an-sv-b an-sv-p" onclick="anatSauvegarder()">'+ANAT_SVG.disquette+'<span>Enregistrer cette version<small>points, options et réglages de la photo</small></span></button>'
    +(sauv.length?'<p class="an-sv-t">Versions enregistrées</p>'+sauv.slice().reverse().map(x=>'<div class="an-sv-v"><span>'+escapeHtml(_anatDateHeure(x.date))+'<small>'+escapeHtml(_anatResumeSauvegarde(x))+'</small></span>'
        +'<button type="button" class="an-sv-r" onclick="anatRestaurer(\''+escapeHtml(String(x.id))+'\')">Restaurer</button>'
        +'<button type="button" class="an-sv-x" aria-label="Supprimer cette version" onclick="anatSupprimerSauvegarde(\''+escapeHtml(String(x.id))+'\')">'+ANAT_SVG.x+'</button></div>').join('')
      :'<p class="an-sv-t">Aucune version enregistrée pour l’instant.</p>')
    +'</div></details>';
  const outils=edit
    ?'<div class="an-outils an-outils-edit"><p class="an-aide">Glisse chaque point sur son repère (loupe au-dessus du doigt ; double-clic ou appui pour le saisir ; au clavier : Tab puis flèches). Les points <b class="an-aide-est">orangés</b> sont estimés : à vérifier en priorité.</p>'+liste
      +'<div class="an-outils-b"><button type="button" class="btn btn-red btn-casse an-analyser" onclick="anatEnregistrerPoints()">'+ANAT_SVG.relancer+'<span>Analyser avec ces points</span></button>'
      +'<button type="button" class="an-b2" onclick="anatPointsAutomatiques()">Points automatiques</button>'
      +'<button type="button" class="an-b2" onclick="anatAnnulerEdition()">Annuler</button>'
      +'<button type="button" class="an-b2" onclick="anatRelancer()">'+ANAT_SVG.relancer+'<span>Refaire la détection</span></button>'+sauvHtml+'</div></div>'
    :'<div class="an-outils"><button type="button" class="an-b2 an-b2-r" onclick="anatEditer()">'+ANAT_SVG.points+'<span>Ajuster les points</span></button>'+sauvHtml+'</div>';
  // LES LEVIERS, SOUS LA PHOTO, EN MENU DÉROULANT SUR UNE LIGNE. Kevin : « je
  // réduirais le petit degré au centre ; modèle plan dans un petit carré à
  // gauche, le squat à droite, deux parties sur la même ligne ; les petites
  // flèches pour passer d'un levier à l'autre ».
  const nLev=res.leviers.length;
  const iLev=nLev?((_anatLevIdx%nLev)+nLev)%nLev:0;
  const lev=nLev?(()=>{
      const l=res.leviers[iLev];
      const val=l.cle==='couples'?'jusqu’à '+_anatSN(l.pire,0)+' %':l.cle==='squat'?l.val+'°':l.cle==='souleve'?_anatN(l.val,0)+'°':(l.val!=null?l.val+' cm':_anatSN(l.ecart,0)+' %');
      const ref=l.cle==='squat'?l.ref+'°':l.cle==='souleve'?_anatN(l.ref,0)+'°':(l.ref!=null?l.ref+' cm':'');
      const sous=l.cle==='squat'?'buste à la parallèle':l.cle==='souleve'?'tronc / horizontale':'trajet de barre';
      const modele={squat:'Cuisse parallèle au sol, tibia incliné de '+_anatN((l.modele&&l.modele.base)?l.modele.base.alpha:30,0)+'°, barre au-dessus du milieu du pied, 0,3 × pied devant la cheville ; barre haute 4 % de la taille sous les épaules, basse 8 %.',
        souleve:'Au décollage : barre à 22,5 cm du sol au-dessus du milieu du pied, épaule 1,5 cm devant, tibia contre la barre ; en sumo, hanches ouvertes à 40° et tibia à 10° au plus.',
        developpe:'Allongé, vu de face : humérus écarté du tronc de θ en bas, avant-bras vertical ; trajet = verrouillage − poitrine.',
        couples:'Pour chaque mouvement, le bras de levier de l’articulation principale, rapporté au même calcul sur des proportions moyennes, à taille égale.'}[l.cle]||'';
      return '<details class="an-dr an-lev"'+(_anatDeplie.lev!==false?' open':'')+' ontoggle="_anatDeplie.lev=this.open">'
        +'<summary><span class="an-dr-i">'+(ANAT_SVG[l.cle]||'')+'</span><span class="an-dr-t">Leviers mécaniques</span>'
        +'<span class="an-dr-r">'+escapeHtml(l.lib)+' · <b>'+escapeHtml(val)+'</b></span>'+ANAT_SVG.chev+'</summary>'
        +'<div class="an-lev-g">'
        +'<div class="an-lev-mod"><b>Modèle plan</b><p>'+escapeHtml(modele)+'</p><p class="an-lev-n">Appliqué aux longueurs de l’athlète, puis aux proportions moyennes publiées par de Leva (1996), du même sexe : c’est l’écart qui renseigne.</p>'
          +(l.source?'<p class="an-lev-n">Source : '+escapeHtml(l.source)+'.</p>':'')+'</div>'
        +'<div class="an-lev-c"><div class="an-lev-top"><b>'+escapeHtml(l.lib)+'</b>'
          +'<div class="an-lev-nav"><button type="button" aria-label="Levier précédent" onclick="anatLevier(-1)"'+(nLev<2?' disabled':'')+'>'+ANAT_SVG.gauche+'</button>'
          +'<span>'+(iLev+1)+' / '+nLev+'</span>'
          +'<button type="button" aria-label="Levier suivant" onclick="anatLevier(1)"'+(nLev<2?' disabled':'')+'>'+ANAT_SVG.droite+'</button></div></div>'
          +(l.cle==='couples'?_htmlCouples(l,c)
          :l.cle==='developpe'&&l.prise?'<div id="an-dev-res">'+_htmlDeveloppeRes(l)+'</div>'+_htmlDeveloppeCtl(l)
          :l.cle==='souleve'&&l.styles?_htmlSouleve(l)
          :l.cle==='squat'&&l.modele?'<div id="an-sq-res">'+_htmlSquatRes(l)+'</div>'+_htmlSquatCtl(l)
          :'<div class="an-lev-v">'+_anatJauge(l)+'<div class="an-lev-vt"><strong>'+escapeHtml(val)+'</strong><em>'+escapeHtml(sous)+(ref?'<br>moyenne '+escapeHtml(ref):'')+'</em>'
            +'<span class="an-lev-leg"><span><i class="l-moi"></i>athlète</span><span><i class="l-moy"></i>moyenne</span></span></div></div>'
          +'<p>'+escapeHtml(l.txt)+'</p>')+'</div>'
        +'</div></details>';
    })():'';
  // ET DESSOUS, CE QUI « ÉVALUE » LA PHOTO : l'échelle, l'origine des points,
  // le miroir et le téléphone — replié par défaut.
  const infos='<details class="an-dr an-inf"'+(_anatDeplie.inf?' open':'')+' ontoggle="_anatDeplie.inf=this.open">'
    +'<summary><span class="an-dr-i">'+ANAT_SVG.info+'</span><span class="an-dr-t">Échelle et prise de vue</span>'
    +'<span class="an-dr-r">'+(echelle&&echelle.cmPx?_anatN(echelle.taille,0)+' cm · ±'+echelle.pct+' %':'sans taille')+(ver?' · '+ANAT_ECHELLE_MOTS[ver.statut]:'')+(res.rotation&&res.rotation.fiable&&res.rotation.deg>ANAT_ROTATION_SEUIL?' · corps tourné ≈ '+_anatN(res.rotation.deg,0)+'°':'')+'</span>'+ANAT_SVG.chev+'</summary>'
    +'<div class="an-inf-c"><p>'+(echelle&&echelle.cmPx?'Échelle 1, par la taille : '+_anatN(echelle.taille,0)+' cm du sommet du crâne aux talons (taille du dossier), ±'+echelle.pct+' % : perspective et posture.'
        :'Taille absente du dossier : les longueurs sont données en % de la hauteur sur la photo.')
      +' Biais du moteur : '+(res.biais?Object.keys(res.biais).map(k=>(ANAT_BIAIS_SEGMENTS.find(x=>x.cle===k)||{}).lib+' '+_anatSN((res.biais[k].k-1)*100,1)+' % (calibré sur '+res.biais[k].n+' athlètes)').join(', ')+'.'
        :'non calibré : il faut au moins '+MORPHO_CALIB_MIN+' athlètes avec photo et mesures au mètre ; d’ici là, ±'+ANAT_BIAIS_DEFAUT_PCT+' % de biais possible dans la marge des longueurs.')
      +(echelle&&echelle.cheveux?' Cheveux volumineux : le sommet du crâne est posé sur l’os, marge d’échelle ±'+ANAT_ECHELLE_CHEVEUX_PCT+' % au moins.':'')
      +(echelle&&echelle.piedsCoupes?' Pieds coupés : le talon est deviné, l’échelle est estimée.':'')
      +(ver?' Échelle 2, par le genou : '+(ver.source==='metre'
          ?_anatN(ver.mesureCm,1)+' cm du sol au milieu de la rotule, mesurés au mètre au bilan'
          :'hauteur de rotule estimée ('+ANAT_ROTULE.source+')')
        +(ver.genouCm1!=null&&ver.genouCm2!=null?' : le genou est à '+_anatN(ver.genouCm1,1)+' cm du sol par la taille, '+_anatN(ver.genouCm2,1)+' cm par '+(ver.source==='metre'?'le mètre':'l’estimation'):'')
        +'. Écart entre les deux : '+_anatN(ver.ecart*100,1)+' %, '+ANAT_ECHELLE_MOTS[ver.statut]
        +(ver.statut==='confirmee'?' (au plus '+_anatN(ANAT_ECHELLE_CONFIRMEE*100,0)+' %).'
          :ver.statut==='verifier'?' (entre '+_anatN(ANAT_ECHELLE_CONFIRMEE*100,0)+' et '+_anatN(MORPHO_ECHELLE_ECART_MAX*100,0)+' %) : marge d’échelle portée à ±'+ANAT_ECHELLE_A_VERIFIER_PCT+' %.'
          :' (au-delà de '+_anatN(MORPHO_ECHELLE_ECART_MAX*100,0)+' %) : longueurs en gris.')
        +(ver.source==='estimation'?' Pour une échelle au mètre : la hauteur du sol au milieu de la rotule, au prochain bilan.':''):'')
      +(res.rotation&&res.rotation.deg!=null?' Rotation du corps estimée : environ '+_anatN(res.rotation.deg,0)+'° (rapport épaules / hanches de face ÷ de dos : '+_anatN(res.rotation.rapport,2)+')'
          +(res.rotation.fiable&&res.rotation.deg>ANAT_ROTATION_SEUIL?' : au-delà de '+ANAT_ROTATION_SEUIL+'°, les écarts gauche / droite ne sont pas lus. '+ANAT_ROTATION_CONSIGNE
            :!res.rotation.fiable?' : dans le bruit du placement des points (±'+_anatN(ANAT_ROTATION_BRUIT*100,0)+' % sur ce rapport), le corps est lu de face.':'.')
        :(res.rotation?' Rotation du corps : non estimée sans photo de dos.':''))
      +(res.rotation&&res.rotation.asyBras!=null?' Écart des deux bras sur la photo de face : '+_anatN(res.rotation.asyBras*100,1)+' %.':'')
      +(_anatSafe(()=>_anatCtlEnvoi(pb.bilan))||'')
      +' '+(V.man?'Des points ont été ajustés à la main.':(V.auto&&V.auto.gabarit?'Personne non détectée : les points sont à placer.':'Points placés automatiquement.'))+'</p>'
    +optsHtml
    // A10 : la demande de photos du prochain bilan. Elle ne descend chez
    // l'athlète que comme une consigne de prise de vue.
    +'<label class="an-opt an-demande"><input type="checkbox"'+(res.opts.sol?' checked':'')+' onchange="anatReglerOption(\'sol\',this.checked)"><span>Photo prise vers le sol (pieds vus du dessus) : ouverture des pieds lue telle quelle</span></label>'
    +'<label class="an-opt an-demande"><input type="checkbox"'+(c.photoPaumes?' checked':'')+' onchange="anatDemanderPaumes(this.checked)"><span>Demander les prochaines photos de face paumes vers l’avant</span></label>'
    +'</div></details>';

  const carte=(f)=>{
    const t=textes[f.cle]||{};
    const vv=a[f.vue];
    const s2=_anatSrcVue(pb,f.vue);
    const cad=_anatCadrage(f.zone,vv,4/3);
    const li=(l)=>l&&l.length?'<ul>'+l.map(x=>'<li>'+escapeHtml(String(x))+_htmlAnatExos(x&&x.exercices,c)+'</li>').join('')+'</ul>':'';
    const tab=f.chiffres&&f.chiffres.length?'<table class="an-tab"><thead><tr><th>Mesure</th><th>Athlète</th><th>Repère</th><th>Écart</th></tr></thead><tbody>'
      +f.chiffres.map(r=>'<tr><th>'+escapeHtml(r.lib)+(r.def?'<small class="an-def">'+escapeHtml(r.def)+'</small>':'')+'</th><td'+(((r.val||'').length>16||/→/.test(r.val||''))?' class="an-td-txt"':'')+'>'+escapeHtml(r.val||'-')+'</td><td>'+escapeHtml(r.ref||'')+'</td><td>'+escapeHtml(r.ecart||'')+'</td></tr>').join('')+'</tbody></table>':'';
    // LA COURBE DU V (A13), avec la carte des courbes de l'onglet Données.
    const courbe=f.courbeV?_anatSafe(()=>_htmlCorpsGraphe('Rapport deltoïdes / taille (V)','',
      [{lib:'V',couleur:ROUGE_MARQUE,points:f.courbeV.map(x=>({x:x.bilan,v:x.V})),bande:ANAT_V_REF.BRUIT}],
      {h:72,dates:true,valeur:_anatN(f.courbeV[f.courbeV.length-1].V,2),
       pied:'Un point par bilan à photo de face · la bande grise est le bruit de placement : ± '+_anatN(ANAT_V_REF.BRUIT,2)}))||'':'';
    const cP=(f.suivi&&f.suivi.serie.length>1)?_anatSafe(()=>_htmlCorpsGraphe(f.suivi.lib,f.suivi.unite.trim(),
      [{lib:f.suivi.lib,couleur:ROUGE_MARQUE,points:f.suivi.serie.map(x=>({x:x.bilan,v:x.v})),bande:f.suivi.marge}],
      {h:60,dates:true,valeur:_anatSN(f.suivi.serie[f.suivi.serie.length-1].v,1)+f.suivi.unite,
       pied:'Un point par bilan à photos de face et de dos · la bande grise est la marge : ± '+_anatN(f.suivi.marge,1)+f.suivi.unite}))||'':'';
    const detail='<div class="an-f-long" id="an-long-'+f.cle+'">'+tab+(courbe?'<div class="an-f-courbe">'+courbe+'</div>':'')+(cP?'<div class="an-f-courbe">'+cP+'</div>':'')
      +(t.lecture?'<h6>Lecture</h6><p class="an-f-lec">'+escapeHtml(t.lecture)+'</p>':'')
      +(t.privilegier&&t.privilegier.length?'<h6>À privilégier</h6>'+li(t.privilegier):'')
      +(t.amenager&&t.amenager.length?'<h6>À aménager</h6><ul>'+t.amenager.map((x,i)=>'<li><b>'+escapeHtml(x.quoi)+'</b> : '+escapeHtml(x.reglage)
        +_htmlAnatExos(x.exercices,c)
        +(x.consigne?'<div class="an-cons"><span>Consigne pour l’athlète : « '+escapeHtml(x.consigne)+' »</span><button type="button" class="an-cons-b" onclick="anatEnvoyerConsigne(\''+f.cle+'\','+i+')">Envoyer la consigne</button></div>':'')+'</li>').join('')+'</ul>':'')
      +(t.verifier?'<h6>Comment vérifier</h6><p>'+escapeHtml(t.verifier)+'</p>':'')
      +'<p class="an-f-src">Source : '+escapeHtml(f.source||'')+(f.tolerance?' · marge '+escapeHtml(f.tolerance):'')+' · bilan du '+_anatDateFr(a.bilan)+'</p>'
      +'</div>';
    return '<div class="an-f" data-k="'+f.cle+'" data-etat="'+f.etat+'" data-n="'+(f.niveau==null?'':Math.abs(f.niveau))+'">'
      +'<button type="button" class="an-f-vig" '+(cad?'onclick="anatZoom(\''+f.cle+'\')" aria-label="Agrandir : '+escapeHtml(f.lib)+'"':'disabled')+'>'
      +(cad?_anatImg(s2,cad,f.vue,anatFiltre(anatReglage(a,f.vue)))+'<span class="an-f-loupe">'+ANAT_SVG.loupe+'</span>':'')+'</button>'
      +'<div class="an-f-c"><div class="an-f-h"><b>'+escapeHtml(f.lib)+'</b>'
        +(f.conf?'<i class="an-conf" data-c="'+f.conf+'" title="'+escapeHtml(f.confPourquoi||'')+'" aria-label="'+escapeHtml(f.confPourquoi||'')+'">'+f.conf+'</i>':'')+(f.valeur?'<em>'+escapeHtml(f.valeur)+'</em>':'')+(f.estime?'<i class="an-f-est" title="Points estimés, à vérifier">estimé</i>':'')+'</div>'
      +'<p class="an-f-court">'+escapeHtml(t.court||'')+'</p>'
      +'<button type="button" class="an-f-plus" aria-expanded="false" aria-controls="an-long-'+f.cle+'" onclick="anatOuvrir(\''+f.cle+'\')"><span class="an-f-plus-o">Recommandations détaillées</span><span class="an-f-plus-f">Replier</span>'+ANAT_SVG.chev+'</button>'
      +'</div>'+detail+'</div>';
  };
  // TOUTES LES ZONES À GAUCHE, DANS UNE LISTE QUI DÉFILE, À LA HAUTEUR DE LA
  // PHOTO. Kevin : « pas un bouton, plutôt un menu déroulant du haut vers le
  // bas ; que tout cet espace prenne la même place que la photo ».
  // LA MESURE FAUTIVE D'ABORD (05/10/2026) : quand la hauteur de rotule du
  // bilan a été écartée, le bandeau le dit, avec le chiffre et la fourchette,
  // et propose de la redemander à l'athlète (le chemin des mesures demandées).
  const alerteRotule=(ver&&ver.mesureEcartee)?(function(){
    const e=ver.mesureEcartee;
    const dem=_anatSafe(()=>demandeMesurePour('deb-rotule',getOwnedClient(currentClientId)));
    const coach=_anatSafe(()=>!!getOwnedClient(currentClientId));
    return '<div class="an-alerte" role="status">'+ANAT_SVG.info+'<span><b>Hauteur de rotule du bilan écartée</b> : '
      +_anatN(e.cm,1)+' cm pour '+_anatN(e.taille,0)+' cm de taille, on attend entre '+e.min+' et '+e.max
      +' cm. Elle ne sert pas : l’échelle est vérifiée par l’estimation à la place. À remesurer debout, pieds nus, du sol au milieu de la rotule.'
      +(coach?(dem?' <i>Mesure déjà redemandée.</i>'
        :' <button type="button" class="ccd-out-r" onclick="demanderMesure(\'deb-rotule\')">Redemander la mesure</button>'):'')
      +'</span></div>';
  })():'';
  const alertePrise=(ver&&ver.statut==='divergence'&&ver.prise)
    ?'<div class="an-alerte" role="alert">'+ANAT_SVG.info+'<span><b>Photo prise '+(ver.prise.sens==='plongee'?'en plongée':'en contre-plongée')+'</b> : le téléphone était trop '
      +(ver.prise.sens==='plongee'?'haut ou trop près':'bas')+'. Les jambes y paraissent environ '+ver.prise.pct+' % plus '
      +(ver.prise.sens==='plongee'?'courtes':'longues')+' qu’elles ne sont, par rapport au buste. <b>Les points ne sont pas en cause</b>, inutile de les déplacer : '
      +'les longueurs restent en gris sur cette photo. À refaire : téléphone posé à hauteur de hanche, bien droit, à 2 ou 3 m, le corps en entier dans le cadre.</span></div>':'';
  const alerteEch=alerteRotule+(alertePrise?alertePrise:(ver&&ver.statut==='divergence')
    ?'<div class="an-alerte" role="alert">'+ANAT_SVG.info+'<span><b>Les deux repères ne donnent pas la même échelle</b> ('+_anatN(ver.ecart*100,1)+' % d’écart, au-delà des '+_anatN(MORPHO_ECHELLE_ECART_MAX*100,0)+' % admis) : vérifie le sommet du crâne, les talons et les genoux. Les longueurs sont en gris tant que les deux échelles ne s’accordent pas.'
      +((ver.source==='metre'&&ver.mesureCm)?' La hauteur de rotule saisie est de '+_anatN(ver.mesureCm,1)+' cm : si les points sont bien placés, c’est elle ou la taille du dossier qu’il faut vérifier.':'')
      +'</span></div>':'');
  const alertePieds=(echelle&&echelle.piedsCoupes)
    ?'<div class="an-alerte" role="status">'+ANAT_SVG.info+'<span><b>Pieds coupés : l’échelle est estimée.</b> Les orteils sortent du cadre ou ne se lisent pas : le talon, bout bas de l’échelle, est deviné. Au prochain bilan, photo en pied avec un peu de sol sous les pieds.</span></div>':'';
  const colG='<div class="an-col an-col-g"><h5>Détails morphologiques <span>'+fiches.length+' zones</span></h5>'+alerteEch+alertePieds
    +'<div class="an-liste" tabindex="0" aria-label="Zones analysées, faire défiler">'+fiches.map(carte).join('')+'</div>'
    +'<div class="an-liste-fin" aria-hidden="true">'+ANAT_SVG.chev+'<span>Fais défiler pour voir toutes les zones</span></div>'
    +photoHtml+'</div>';
  // LES RÉSULTATS, STYLISÉS : un bandeau, le compte de ce qui est à
  // surveiller, et chaque ligne teintée de son niveau.
  const cpt=anatCompteurs(fiches);
  const nSurv=cpt.surveiller, nMarge=cpt.marge, nIll=cpt.illisibles, nConf=cpt.confirmer;
  const resHtml='<div class="an-res"><div class="an-res-h"><h5>Résultats de l’analyse</h5>'
    +'<div class="an-res-k"><span data-t="s"><b>'+nSurv+'</b>à surveiller</span><span data-t="m"><b>'+nMarge+'</b>dans la marge</span>'+(nConf?'<span data-t="c" title="Niveau net ou marqué sur des points estimés : à confirmer en les replaçant"><b>'+nConf+'</b>à confirmer</span>':'')+(nIll?'<span data-t="i"><b>'+nIll+'</b>non lisible'+(nIll>1?'s':'')+'</span>':'')+'</div></div>'
    +'<div class="an-res-l">'+fiches.map(f=>'<button type="button" class="an-r" data-k="'+f.cle+'" data-n="'+(f.niveau==null?'':Math.abs(f.niveau))+'" onclick="anatOuvrir(\''+f.cle+'\',true)">'
      +'<span class="an-r-l">'+escapeHtml(f.lib)+'</span>'+_anatPoints(f)+'<span class="an-r-v">'+escapeHtml(anatVerdict(f))+(f.stat?'<small class="an-r-p">'+escapeHtml(f.stat.court||f.stat.txt)+'</small>':'')+'</span></button>').join('')+'</div>'
    +'<p class="an-res-leg"><span><i data-i="0"></i>dans la marge</span><span><i data-i="1"></i>léger</span><span><i data-i="2"></i>net</span><span><i data-i="3"></i>marqué</span><span>gris : non lisible</span></p></div>';
  const pourquoi='<div class="an-pq"><span class="an-pq-i">'+ANAT_SVG.info+'</span><div class="an-pq-c"><h5>Méthode</h5>'
    +'<span>Les repères sont posés sur les vraies photos du bilan : automatiquement, puis ajustables à la main. La photo est mise à l’échelle par la taille du dossier (du sommet du crâne aux talons), les longueurs sont mesurées d’un centre articulaire à l’autre et comparées aux longueurs publiées par de Leva (1996), mesurées elles aussi d’un centre articulaire à l’autre, pour le même sexe ; la hauteur de hanche et les largeurs d’os, aux moyennes ANSUR II (2012). Sous chaque mesure, sa définition. Un écart à la moyenne est un levier à connaître, pas un défaut. '
    +escapeHtml(MORPHO_DISCLAIMER)+'</span></div>'
    +'<button type="button" class="an-b2" onclick="anatRelancer()"'+(enCours?' disabled':'')+'>'+ANAT_SVG.relancer+'<span>'+(enCours?'Détection…':'Refaire la détection')+'</span></button></div>';
  return '<div class="an" data-vue="'+vueAct+'">'+tete
    +(_anatSafe(()=>_htmlAnatPriorites(res,c))||'')
    +'<div class="an-grille">'+colG
    +'<div class="an-centre">'+scene+outils+'</div>'
    +'<div class="an-col an-col-d">'+resHtml+'</div>'
    // LES LEVIERS SUR TOUTE LA LONGUEUR, sous la photo ET sous les résultats.
    // Kevin : « qu'il prenne la place ×2, l'allonger sur la longueur ».
    +'<div class="an-bas">'+lev+infos+'</div></div>'
    +pourquoi+'</div>';
}
/**
 * LA LISTE DES ZONES À LA HAUTEUR DE LA PHOTO. Quand les trois colonnes sont
 * côte à côte, la liste défile dans la hauteur exacte de la scène ; sinon elle
 * s'étale normalement. Recalculé au rendu et à chaque changement de taille.
 */
/**
 * LA JAUGE D'UN LEVIER, en SVG : un rapporteur pour le squat (le buste de
 * l'athlète en rouge, la moyenne en pointillé blanc, la cale en vert) ; une
 * règle pour le soulevé et le développé (l'athlète contre la moyenne).
 */
function _anatJauge(l){
  if(!l) return '';
  if(l.cle==='squat'){
    const O={x:14,y:74},R=62;
    const pt=(a,r)=>{ const t=a*Math.PI/180; return {x:O.x+(r||R)*Math.sin(t),y:O.y-(r||R)*Math.cos(t)}; };
    const arc=(a0,a1,r)=>{ const p0=pt(a0,r),p1=pt(a1,r); return 'M'+p0.x.toFixed(1)+' '+p0.y.toFixed(1)+' A'+r+' '+r+' 0 0 1 '+p1.x.toFixed(1)+' '+p1.y.toFixed(1); };
    const aig=(a,cl,r)=>{ const p=pt(Math.max(0,Math.min(70,a)),r||R-6); return '<line class="'+cl+'" x1="'+O.x+'" y1="'+O.y+'" x2="'+p.x.toFixed(1)+'" y2="'+p.y.toFixed(1)+'"/>'; };
    let g='<svg class="an-jauge" viewBox="0 0 92 82" role="img" aria-label="Inclinaison du buste : '+l.val+'°, moyenne '+l.ref+'°">'
      +'<path class="an-j-fond" d="'+arc(0,70,R)+'"/>'
      +'<path class="an-j-zone" d="'+arc(Math.min(l.val,l.ref),Math.max(l.val,l.ref),R)+'"/>';
    for(const t of [0,15,30,45,60]){ const a=pt(t,R+1),b=pt(t,R-5); g+='<line class="an-j-gr" x1="'+a.x.toFixed(1)+'" y1="'+a.y.toFixed(1)+'" x2="'+b.x.toFixed(1)+'" y2="'+b.y.toFixed(1)+'"/>'; }
    g+='<line class="an-j-sol" x1="'+O.x+'" y1="'+O.y+'" x2="88" y2="'+O.y+'"/>'
      +aig(l.ref,'an-j-moy')+(l.regle!=null?aig(l.regle,'an-j-cale',R-14):(l.cale!=null?aig(l.cale,'an-j-cale',R-14):''))+aig(l.val,'an-j-moi')
      +'<circle class="an-j-piv" cx="'+O.x+'" cy="'+O.y+'" r="3.5"/></svg>';
    return g;
  }
  const v=Number(l.cle==='souleve'?l.val:(l.val!=null?l.val:null));
  const r=Number(l.cle==='souleve'?l.ref:(l.ref!=null?l.ref:null));
  if(!isFinite(v)||!isFinite(r)||!(r>0)) return '';
  const pos=x=>Math.max(4,Math.min(96,50+(x/r-1)/0.2*46));
  return '<svg class="an-jauge an-jauge-r" viewBox="0 0 100 40" role="img" aria-label="'+escapeHtml(l.lib)+' : athlète contre moyenne">'
    +'<rect class="an-j-rail" x="4" y="17" width="92" height="6" rx="3"/>'
    +'<rect class="an-j-zone2" x="'+Math.min(pos(v),50).toFixed(1)+'" y="17" width="'+Math.abs(pos(v)-50).toFixed(1)+'" height="6" rx="3"/>'
    +'<line class="an-j-moy" x1="50" y1="10" x2="50" y2="30"/>'
    +'<circle class="an-j-moi2" cx="'+pos(v).toFixed(1)+'" cy="20" r="5.5"/>'
    +'<text x="4" y="38">−20 %</text><text x="50" y="38" text-anchor="middle">moyenne</text><text x="96" y="38" text-anchor="end">+20 %</text></svg>';
}
let _anatObsListe=null;
let _anatCale=null;
function _anatCalerListe(z){
  const liste=z&&z.querySelector('.an-liste');
  const scene=z&&z.querySelector('.an-scene');
  const grille=z&&z.querySelector('.an-grille');
  if(!liste||!scene||!grille) return;
  // ⚠ LIRE TOUT, PUIS ÉCRIRE TOUT (E4). Lectures et écritures alternées
  //   forçaient quatre mises en page par rendu — la moitié du temps de la
  //   section. On remet d'abord à zéro ce qui fausserait les lectures, on lit
  //   d'un bloc, on écrit d'un bloc : deux mises en page.
  const caler=(prevu)=>{
    const col=liste.parentElement;
    const res=z.querySelector('.an-res');
    // LE CALAGE D'AVANT, REPOSÉ AVANT TOUTE LECTURE (E4). À largeur égale, un
    // nouveau rendu retombe presque toujours sur les mêmes hauteurs : posées
    // d'avance, elles font de la première mise en page la bonne, et la
    // seconde n'a lieu que si quelque chose a vraiment bougé.
    if(prevu){
      liste.style.maxHeight=prevu.max; col.classList.toggle('an-col-cale',prevu.colCale);
      if(res){ res.style.height=prevu.resH; res.classList.toggle('an-res-cale',!!prevu.resH); }
      col.classList.toggle('an-liste-defile',prevu.plus); col.classList.toggle('an-liste-bas',false);
    }else if(res){ res.style.height=''; res.classList.remove('an-res-cale'); }
    // ── Les lectures (une mise en page).
    const cols=getComputedStyle(grille).gridTemplateColumns.split(' ').filter(Boolean).length;
    const rS=scene.getBoundingClientRect();
    const titre=col.querySelector('h5');
    const hT=(cols>=3&&titre)?titre.getBoundingClientRect().height+8:0;
    let cote=false;
    if(res){
      // LES RÉSULTATS À LA HAUTEUR DE LA PHOTO : leur bord bas s'aligne sur le
      // bas de l'image dès que les deux sont côte à côte ; les lignes se
      // répartissent la hauteur.
      const nL=res.querySelectorAll('.an-r').length;
      const mini=(res.querySelector('.an-res-h')||{offsetHeight:0}).offsetHeight+(res.querySelector('.an-res-leg')||{offsetHeight:0}).offsetHeight+nL*26+(nL-1)*3+30;
      // Le calage posé d'avance fausse cette lecture : la hauteur retenue
      // est celle de la scène, qu'il ne touche pas.
      cote=cols>=2&&rS.height>=mini&&Math.abs(res.getBoundingClientRect().top-rS.top)<40;
    }
    const voulu={max:cols>=3?Math.max(260,Math.round(rS.height-hT))+'px':'',colCale:cols>=3,
      resH:(res&&cote)?Math.round(rS.height)+'px':''};
    // ── Rien n'a bougé : la mise en page déjà faite est la bonne.
    //    (La mise en page est propre : lire le débordement ne coûte rien.)
    if(prevu&&prevu.max===voulu.max&&prevu.colCale===voulu.colCale&&prevu.resH===voulu.resH){
      const p2=liste.scrollHeight>liste.clientHeight+4, bas=p2&&liste.scrollTop+liste.clientHeight>=liste.scrollHeight-4;
      col.classList.toggle('an-liste-defile',p2); col.classList.toggle('an-liste-bas',bas);
      _anatCale.plus=p2;
      return;
    }
    // ── Les écritures.
    liste.style.maxHeight=voulu.max;
    col.classList.toggle('an-col-cale',voulu.colCale);
    if(res){ res.style.height=voulu.resH; res.classList.toggle('an-res-cale',!!voulu.resH); }
    // ── La liste déborde-t-elle ? (seconde mise en page)
    const plus=liste.scrollHeight>liste.clientHeight+4;
    col.classList.toggle('an-liste-defile',plus);
    col.classList.toggle('an-liste-bas',plus&&liste.scrollTop+liste.clientHeight>=liste.scrollHeight-4);
    _anatCale={largeur:window.innerWidth,max:voulu.max,colCale:voulu.colCale,resH:voulu.resH,plus};
  };
  caler((_anatCale&&_anatCale.largeur===window.innerWidth)?_anatCale:null);
  liste.addEventListener('scroll',()=>{
    const col=liste.parentElement;
    col.classList.toggle('an-liste-bas',liste.scrollTop+liste.clientHeight>=liste.scrollHeight-4);
  },{passive:true});
  const img=scene.querySelector('img.an-photo');
  if(img&&!img.complete) img.addEventListener('load',()=>caler(),{once:true});
  try{
    if(_anatObsListe) _anatObsListe.disconnect();
    // ⚠ LA SCÈNE ET LA GRILLE. Rendue pendant que l'onglet Données est caché,
    //   la scène n'a pas encore de taille : on recale quand elle en prend une,
    //   et quand la grille change de largeur (fenêtre, panneau latéral).
    _anatObsListe=new ResizeObserver(()=>requestAnimationFrame(()=>caler()));
    _anatObsListe.observe(scene);
    _anatObsListe.observe(grille);
  }catch(e){}
  let essais=0;
  const reessayer=()=>{ if(!scene.isConnected) return; if(scene.getBoundingClientRect().height>0){ caler(); return; } if(++essais<40) setTimeout(reessayer,250); };
  // ⚠ PAS UN SECOND CALAGE DANS LA MÊME TÂCHE (E4) : caler() vient de tourner.
  //   On ne réessaie que si la scène n'avait pas encore de taille.
  if(!(scene.getBoundingClientRect().height>0)) setTimeout(reessayer,250);
}
/** Le zoom d'une vignette : la photo d'origine, nette, avec ses repères. */
function anatZoom(cle){
  const c=getOwnedClient(currentClientId);
  if(!c||!c.morphoAnat) return;
  const a=c.morphoAnat;
  const res=anatMesuresRendu(a,c);
  const f=res.fiches.find(x=>x.cle===cle);
  if(!f||!f.zone) return;
  const vue=f.vue;
  const v=a[vue];
  const pb=anatPremierBilan(c);
  const src=_anatSrcVue(pb,vue);
  const zw=f.zone.x1-f.zone.x0, zh=f.zone.y1-f.zone.y0;
  const asp=Math.max(0.6,Math.min(1.8,zw/zh));
  const cad=_anatCadrage(f.zone,v,asp);
  const z=cad.z;
  const pts=anatPoints(a,vue);
  const t=anatTexte(f,res);
  document.getElementById('an-zoom')?.remove();
  const o=document.createElement('div');
  o.id='an-zoom'; o.className='an-zoom';
  o.setAttribute('role','dialog'); o.setAttribute('aria-modal','true'); o.setAttribute('aria-label','Zoom : '+f.lib);
  o.innerHTML='<div class="an-zoom-b"><div class="an-zoom-h"><b>'+escapeHtml(f.lib)+'</b>'+(f.valeur?'<em>'+escapeHtml(f.valeur)+'</em>':'')
    +'<button type="button" class="an-zoom-o" aria-pressed="true">Masquer les repères</button>'
    +'<button type="button" class="an-zoom-x" aria-label="Fermer">'+ANAT_SVG.x+'</button></div>'
    +'<div class="an-zoom-img" style="aspect-ratio:'+asp.toFixed(3)+';width:min(100%,calc(66vh * '+asp.toFixed(3)+'))">'+_anatImg(src,cad,vue,anatFiltre(anatReglage(a,vue)))
    +'<svg class="an-os" viewBox="'+z.x0.toFixed(1)+' '+z.y0.toFixed(1)+' '+z.w.toFixed(1)+' '+z.h.toFixed(1)+'" preserveAspectRatio="none" aria-hidden="true">'+_anatDessin(vue,pts,v.w,v.h,false)+'</svg></div>'
    +'<p>'+escapeHtml(t.court||'')+'</p></div>';
  const fermer=()=>{ o.remove(); document.removeEventListener('keydown',esc); };
  const esc=(e)=>{ if(e.key==='Escape') fermer(); };
  o.addEventListener('click',e=>{ if(e.target===o) fermer(); });
  o.querySelector('.an-zoom-x').addEventListener('click',fermer);
  const bo=o.querySelector('.an-zoom-o');
  bo.addEventListener('click',()=>{
    const on=bo.getAttribute('aria-pressed')!=='true';
    bo.setAttribute('aria-pressed',on?'true':'false');
    bo.textContent=on?'Masquer les repères':'Afficher les repères';
    o.querySelector('.an-zoom-img svg').style.display=on?'':'none';
  });
  document.addEventListener('keydown',esc);
  document.body.appendChild(o);
  if(anatReglage(a,vue).net!==false) anatAmeliorer(src).then(u=>{ const i=o.querySelector('img'); if(u&&i) i.src=u; });
  setTimeout(()=>{ try{ o.querySelector('.an-zoom-x').focus(); }catch(e){} },30);
}
function renderCorpsCoach(c){
  const z=document.getElementById('ccd-corps');
  if(!z) return false;
  let h='';
  // ⚠ LES COURBES SONT MONTEES D'UN ETAGE (lot 4) : elles vivent desormais
  //   dans « Ses courbes », sous le selecteur de periode qui les commande
  //   toutes. Le cadre garde la silhouette, ses etiquettes et sa legende.
  // LA PAIRE DE BILANS BORNE AUSSI LA SILHOUETTE (lot 5) : les etiquettes
  // disent alors l'ecart entre les deux bilans choisis, et la teinte le sens
  // de cet ecart-la.
  // ⚠ SUR L'ONGLET ENTRAINEMENT, LE CADRE D'HIER MATIN, COURBES COMPRISES.
  //   Kevin, 24/09/2026 : « y avait les graphiques hier matin a droite, et le
  //   rectangle "Chaque muscle…" ». La colonne de droite porte les courbes ET
  //   l'explication de la teinte : sans courbes, l'explication tombait sous
  //   la silhouette. Le meme #ccd-corps suit l'onglet ouvert (voir
  //   _ccdPlacerBlocs), qui le repeint quand il change d'onglet.
  try{
    h=(_ccdVue==='entrainement')
      ?_htmlCorpsCadre(c)
      :_htmlCorpsCadre(ccdBorner(_dossier(c)),
        {graphes:false,deuxVues:true,evoPremier:ccdPaireActive()});
    h=h||'';
  }catch(e){ h=''; }
  z.innerHTML=h;
  // Les calques de zones se peignent une fois dans la page : ils lisent une
  // image, ce qu'une chaine HTML ne sait pas faire.
  try{ _corpsPeindreCalques(z); }catch(e){}
  return true;
}
// LA LIGNE D'ASYMETRIE. La phrase, puis le geste. Pas de couleur d'alarme :
// c'est un signal de priorite BASSE, et il doit se lire comme tel.
function renderAsymetrieCoach(c){
  const z=document.getElementById('ccd-asymetrie');
  if(!z) return false;
  let s=null;
  try{ s=signalAsymetrie(c); }catch(e){ s=null; }
  if(!s){ z.innerHTML=''; return true; }
  z.innerHTML='<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:16px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);'
    +'text-transform:uppercase;margin-bottom:6px">Asymétrie</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
    +escapeHtml(s.phrase)+'</div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.55;margin-top:6px">'
    +escapeHtml(s.geste)+'</div>'
    +(s.toutes.length>1
      ?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">'
        +s.toutes.slice(1).map(a=>escapeHtml(phraseAsymetrie(a))).join(' ')+'</div>'
      :'')
    +'</div>';
  return true;
}
function renderMethodesCoach(c){
  const z=document.getElementById('ccd-methodes');
  if(!z) return false;
  let phrase='', forces=[];
  try{ phrase=phraseChargeMethodes(c); }catch(e){ phrase=''; }
  try{ forces=resumeMethodesForcees(c); }catch(e){ forces=[]; }
  if(!phrase&&!forces.length){ z.innerHTML=''; return true; }
  let h='<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:16px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);'
    +'text-transform:uppercase;margin-bottom:6px">Techniques d’intensification</div>';
  if(phrase)
    h+='<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
      +escapeHtml(phrase)+'</div>';
  if(forces.length){
    h+='<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.55;margin-top:'
      +(phrase?'7px':'0')+'">'
      +forces.length+' règle'+(forces.length>1?'s':'')+' d’emploi passée'
      +(forces.length>1?'s':'')+' outre cette semaine :</div>';
    for(const f of forces.slice(-4))
      h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">'
        +'· '+escapeHtml(f.exercice||'-')+' : '+escapeHtml(f.regle||'')+'</div>';
  }
  h+='</div>';
  z.innerHTML=h;
  return true;
}
