// ══ DECODER L'IMAGE AVANT DE LA REDIMENSIONNER ═══════════════════════════
//
// LE VRAI DEFAUT ETAIT EN AMONT. _resizeImage passait par FileReader puis une
// <img> alimentee en base64 : un seul chemin, et le plus fragile des trois.
// Un HEIC d'iPhone n'y arrive pas, un fichier de 12 Mpx triple sa taille en
// memoire au passage, et sur iOS toDataURL rend parfois « data:, » SANS RIEN
// SIGNALER — une chaine vide etait alors enregistree A LA PLACE de la photo,
// l'emplacement s'affichait vide au rechargement, et aucun message n'etait
// jamais apparu. Rendre la photo facultative masquait ce defaut ; ceci le
// corrige, et pour les onze points d'envoi du produit d'un coup.
//
// Ces deux fonctions viennent de la branche ou elles avaient ete ecrites pour
// ce probleme precis. Elles sont reprises telles quelles.
const IMG_DECODE_MS=25000;
// Decodage d'un fichier image. Trois chemins, du plus econome au plus ancien,
// essayes dans l'ordre :
//  1. createImageBitmap(file) — decode SANS passer par une chaine base64 (le
//     detour historique triplait la memoire occupee par une photo de 12 Mpx,
//     et c'est ce qui faisait echouer les gros fichiers sur un vieux telephone)
//     et s'appuie sur les codecs du systeme : c'est ce qui fait passer un HEIC
//     partout ou le systeme sait le lire.
//  2. blob: dans une <img> — meme economie de memoire, disponible partout.
//  3. FileReader + dataURL — le chemin d'origine, garde en dernier recours.
// Rend { src, w, h, liberer }. liberer() DOIT etre appele : sans lui le blob
// et le bitmap restent en memoire pour la duree de la session.
function _decoderImage(file){
  return new Promise((resolve,reject)=>{
    let fini=false,minuteur=null;
    const gagne=d=>{ if(fini) return; fini=true; clearTimeout(minuteur); resolve(d); };
    const perdu=()=>{ if(fini) return; fini=true; clearTimeout(minuteur); reject(); };
    minuteur=setTimeout(perdu,IMG_DECODE_MS);
    const depuisImg=(im,liberer)=>gagne({src:im,w:im.naturalWidth||im.width,
      h:im.naturalHeight||im.height,liberer:liberer||function(){}});
    // Chemin 3.
    const parLecteur=()=>{
      const r=new FileReader();
      r.onerror=perdu; r.onabort=perdu;
      r.onload=ev=>{
        const im=new Image();
        im.onerror=perdu;
        im.onload=()=>depuisImg(im);
        im.src=ev.target.result;
      };
      try{ r.readAsDataURL(file); }catch(e){ perdu(); }
    };
    // Chemin 2. Son echec retombe sur le chemin 3 plutot que d'abandonner :
    // quelques navigateurs anciens refusent un blob: comme source d'image.
    const parBlob=()=>{
      let url;
      try{ url=URL.createObjectURL(file); }catch(e){ return parLecteur(); }
      const rendre=()=>{ try{ URL.revokeObjectURL(url); }catch(e){} };
      const im=new Image();
      im.onerror=()=>{ rendre(); parLecteur(); };
      im.onload=()=>depuisImg(im,rendre);
      im.src=url;
    };
    // Chemin 1.
    if(typeof createImageBitmap==='function'){
      let p=null;
      try{ p=createImageBitmap(file); }catch(e){ p=null; }
      if(p&&typeof p.then==='function'){
        p.then(bm=>gagne({src:bm,w:bm.width,h:bm.height,
          liberer(){ try{ bm.close&&bm.close(); }catch(e){} }}),parBlob);
        return;
      }
    }
    parBlob();
  });
}
// ENCODAGE, AVEC REPLI SUR PLUS PETIT. Deux echecs distincts sont couverts :
// toDataURL qui JETTE faute de memoire, et — propre a iOS — toDataURL qui
// rend « data:, » sans rien signaler. Le second passait pour une reussite :
// une chaine vide etait enregistree A LA PLACE de la photo, l'emplacement
// s'affichait vide au rechargement, et aucun message n'etait jamais apparu.
// On redescend donc en taille jusqu'a obtenir un JPEG credible : une photo
// plus petite vaut mieux qu'un emplacement vide.
function _canvasVersJpeg(source,w,h,quality){
  for(const ech of [1,0.7,0.5,0.35,0.22]){
    const cw=Math.max(1,Math.round(w*ech)),ch=Math.max(1,Math.round(h*ech));
    try{
      const cv=document.createElement('canvas');
      cv.width=cw; cv.height=ch;
      const cx=cv.getContext('2d');
      if(!cx) continue;
      cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high';
      cx.drawImage(source,0,0,cw,ch);
      const url=cv.toDataURL('image/jpeg',quality||0.75);
      // 512 octets : un JPEG utile ne descend pas la-dessous, « data:, » si.
      if(url&&url.length>512&&url.indexOf('data:image/jpeg')===0) return url;
    }catch(e){}
  }
  return null;
}
// _resizeImage garde sa signature et son contrat — une promesse qui rend un
// data-URL JPEG ou null, JAMAIS d'attente sans fin. Ses sept appelants n'ont
// pas a savoir que le chemin a change.
function _resizeImage(file,maxW,maxH,quality){
  return new Promise(resolve=>{
    let fini=false;
    const sortir=v=>{ if(fini) return; fini=true; clearTimeout(minuteur); resolve(v); };
    // 30 s, soit APRES les 25 s de IMG_DECODE_MS : le delai du decodeur doit
    // jouer en premier et rendre la main proprement. Celui-ci ne couvre que
    // l'encodage, ou rien ne peut pendre en theorie — c'est une ceinture.
    const minuteur=setTimeout(()=>sortir(null),30000);
    let img=null;
    try{
      _decoderImage(file).then(d=>{
        img=d;
        if(!d||!(d.w>0)||!(d.h>0)) return sortir(null);
        const sc=Math.min(maxW/d.w,maxH/d.h,1);
        const url=_canvasVersJpeg(d.src,d.w*sc,d.h*sc,quality||0.75);
        try{ d.liberer&&d.liberer(); }catch(e){}
        sortir(url||null);
      },()=>sortir(null)).catch(()=>{
        try{ img&&img.liberer&&img.liberer(); }catch(e){}
        sortir(null);
      });
    }catch(e){ sortir(null); }
  });
}
function uploadCoachPhoto(input){
  const f=input.files[0];if(!f) return;
  // 20 Mo, comme les envois de PDF de ce fichier. L'ancien plafond de 3 Mo
  // datait d'avant la compression : il refusait une photo de téléphone
  // ordinaire pour protéger un quota que le redimensionnement en 200×200
  // rend hors d'atteinte. Ce qui reste plafonné, c'est le décodage.
  if(f.size>20*1024*1024){toast('Image trop lourde (max 20 Mo)','var(--orange)');return;}
  _resizeImage(f,200,200,0.80).then(b64=>{
    // Le silence d'avant était le pire des cas : rien ne changeait à
    // l'écran, et rien ne disait pourquoi.
    if(!b64){toast('Image illisible : réessaie avec une autre photo','var(--orange)');return;}
    currentUser.coachPhoto=b64;
    // La promesse est RETENUE : c’est elle que toastSync attend, et sans elle
    // le « ✓ » ne mesurait que l’écriture locale.
    const _envoi=CLOUD.pushProfilCoach(currentUser);
    const ok=saveUser();
    // Push immédiat non-debounced pour que les athlètes voient la photo immédiatement
    setTimeout(()=>{try{const u=DB.get('users');if(u) CLOUD._doPush(u);}catch{}},300);
    const el=document.getElementById('coach-photo-circle');
    if(el) el.innerHTML=`<img src="${b64}" style="width:100%;height:100%;object-fit:cover">`;
    // L'aperçu vient d'être posé dans le DOM : sans ce garde-fou, l'image
    // affichée renforcerait la fausse certitude d'un enregistrement réussi.
    toastSync(ok,_envoi,'Photo enregistrée '+ICO.coche,'le profil public est');
  });
}
// Une ligne de diplome : un intitule, une image facultative. Le DOM est la
// source de verite pendant l'edition — comme les bannieres promo, et pour
// la meme raison : ajouter une ligne ne doit rien enregistrer tant que le
// coach n'a pas valide.
// Lecture d'une image choisie, redimensionnee — meme chemin que la photo de
// profil du coach. Le resultat est une donnee, pas un lien : rien a heberger.
function _lireImage(input,maxW,maxH,apres){
  const f=input.files&&input.files[0];
  if(!f) return;
  if(f.size>20*1024*1024){toast('Image trop lourde (max 20 Mo)','var(--orange)');return;}
  _resizeImage(f,maxW,maxH,0.82).then(b64=>{
    if(!b64){toast('Image illisible : réessaie avec une autre','var(--orange)');return;}
    apres(b64);
  }).catch(()=>toast('Image illisible','var(--orange)'));
}
// Les trois images de la vitrine. L'apercu est mis a jour tout de suite :
// sans lui, rien ne dit que le fichier a ete pris en compte.
const _IMG_VITRINE={'coach-photo-vitrine':['photoVitrine',900,1200],
  'coach-signature':['signature',700,350],
  // CARRE, et non 700x350 : un logo est rarement une bande. La plus grande
  // dimension commande, _resizeImage garde le rapport.
  'coach-logo':['logo',700,700],
  'coach-cartepro':['cartePro',900,1200]};
function _apercuVitrine(id,b64){
  const z=document.getElementById(id+'-apercu');
  if(!z) return;
  // object-fit CONTAIN et fond transparent : une signature doit se voir
  // entiere, et sur rien. `cover` la rognait en plus de l aplatir.
  z.style.background=b64?'transparent':'var(--surface-2)';
  z.innerHTML=b64?('<img src="'+escapeHtml(b64)+'" alt="" style="width:100%;height:100%;object-fit:contain">'):'+';
}
// LE PNG PASSE INTACT. _resizeImage encode en JPEG : une signature a fond
// transparent en ressortait sur un aplat opaque, ce qui se voit tout de
// suite sur le fond carbone. Un PNG raisonnable est donc lu tel quel, sans
// re-encodage — sa transparence est justement ce qu on veut garder.
// LE POIDS EN BASE64 EST CE QUI COMPTE : c'est sous cette forme que l'image
// occupe le stockage local, et ce stockage vaut ~5 Mo pour TOUT l'appareil —
// le dossier du coach, ceux de ses athletes, leurs bilans et leurs seances.
// Une seule image qui deborde bloque l'enregistrement de tout le reste.
//
// Les budgets sont poses sur ce que la vitrine affiche reellement : la
// signature en `max-width:210px`, les deux autres en pleine largeur de carte.
const IMG_BUDGET_KO={signature:200,logo:200,photoVitrine:320,cartePro:320};
// PURE au sens ou elle ne touche rien d'autre : reduit la DIMENSION du canvas
// jusqu'a ce que le PNG tienne sous le budget. Le format ne change pas — un
// JPEG remettrait un fond opaque la ou on vient justement de le retirer.
// Rend toujours une image : le plus petit essai vaut mieux que rien, et
// toastEcriture dira la verite si le stockage refuse quand meme.
function _pngSousBudget(cv,budgetKo){
  const max=(budgetKo||240)*1024;
  let b64=cv.toDataURL('image/png');
  if(b64.length<=max) return b64;
  for(const ech of [0.72,0.52,0.38,0.28,0.2]){
    const c2=document.createElement('canvas');
    c2.width=Math.max(1,Math.round(cv.width*ech));
    c2.height=Math.max(1,Math.round(cv.height*ech));
    const x=c2.getContext('2d');
    x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
    x.drawImage(cv,0,0,c2.width,c2.height);
    b64=c2.toDataURL('image/png');
    if(b64.length<=max) return b64;
  }
  return b64;
}
// Meme plafond, applique a un PNG deja lu. On repasse par un canvas a sa
// taille d'origine avant de reduire : sans ce redessin, il n'y a rien a
// mesurer ni a reduire.
function _pngRamener(b64,budgetKo,apres){
  if(!b64||b64.length<=(budgetKo||240)*1024) return apres(b64);
  const im=new Image();
  im.onload=()=>{
    try{
      const cv=document.createElement('canvas');
      cv.width=im.naturalWidth; cv.height=im.naturalHeight;
      cv.getContext('2d').drawImage(im,0,0);
      apres(_pngSousBudget(cv,budgetKo));
    }catch(e){ apres(b64); }
  };
  // Illisible ne doit pas vouloir dire perdue : on garde ce qu'on avait.
  im.onerror=()=>apres(b64);
  im.src=b64;
}
function _lirePngIntact(f,apres){
  const fr=new FileReader();
  fr.onload=()=>apres(fr.result);
  fr.onerror=()=>toast('Image illisible','var(--orange)');
  fr.readAsDataURL(f);
}
// DETOURAGE DE LA SIGNATURE. Un fichier scanne ou photographie porte un fond
// — blanc de la feuille, gris du scanner — meme quand il est enregistre en
// PNG. Le rendre transparent a la main dans un logiciel n est pas une chose
// a demander a un coach. On le fait ici.
//
// La couleur du fond est RELEVEE aux quatre coins, pas supposee blanche : un
// scan tire souvent vers le gris ou le creme, et un seuil sur le blanc pur
// ne retirerait rien. Tout pixel proche de cette couleur devient transparent,
// avec un fondu sur la bordure pour ne pas hacher le trace.
function _detourerSignature(f,apres,budgetKo){
  const url=URL.createObjectURL(f);
  const im=new Image();
  im.onload=()=>{
    try{
      // 560 et non 900 : _htmlVitrineCoach affiche la signature en
      // `max-width:210px`. Meme a trois pixels physiques par point, il n'y a
      // rien a voir au-dela — et _IMG_VITRINE declarait deja 700x350.
      const MAX=560;
      const r=Math.min(1,MAX/Math.max(im.width,im.height));
      const c=document.createElement('canvas');
      c.width=Math.round(im.width*r); c.height=Math.round(im.height*r);
      const x=c.getContext('2d');
      x.drawImage(im,0,0,c.width,c.height);
      const d=x.getImageData(0,0,c.width,c.height), px=d.data;
      const coin=i=>[px[i],px[i+1],px[i+2]];
      const W=c.width,H=c.height;
      const angles=[0,(W-1)*4,(H-1)*W*4,((H-1)*W+W-1)*4];
      // ⚠ UNE IMAGE DEJA DETOUREE NE SE REDETOURE PAS, ET C'EST UN DEFAUT QUI
      // EXISTAIT DEJA POUR LA SIGNATURE. Les pixels jamais peints d'un PNG
      // transparent valent (0,0,0,0) : la couleur relevee aux quatre coins
      // etait donc le NOIR, et le seuil effacait tout trait noir — c'est-a-dire
      // la signature entiere. Le coach chargeait un PNG propre et recevait une
      // image vide, sans un mot.
      //
      // L'alpha des coins repond a la question : s'ils sont deja transparents,
      // le fond a deja ete retire par quelqu'un d'autre, et le meilleur
      // traitement est de n'y pas toucher.
      if(angles.every(i=>px[i+3]<16)){
        apres(_pngSousBudget(c,budgetKo||IMG_BUDGET_KO.signature));
        return;
      }
      const coins=angles.map(coin);
      const fond=[0,1,2].map(k=>Math.round(coins.reduce((a,v)=>a+v[k],0)/coins.length));
      // Deux seuils : en deca, transparent ; entre les deux, alpha progressif.
      const DUR=42, DOUX=88;
      for(let i=0;i<px.length;i+=4){
        const dist=Math.sqrt(Math.pow(px[i]-fond[0],2)+Math.pow(px[i+1]-fond[1],2)+Math.pow(px[i+2]-fond[2],2));
        if(dist<=DUR) px[i+3]=0;
        else if(dist<DOUX) px[i+3]=Math.round(px[i+3]*(dist-DUR)/(DOUX-DUR));
      }
      x.putImageData(d,0,0);
      // Le detourage laisse un PNG a canal alpha : sa compression depend du
      // trace, pas de la dimension seule. On le PESE plutot que de le supposer
      // leger — un logo photographie en produisait plus d'un megaoctet.
      apres(_pngSousBudget(c,budgetKo||IMG_BUDGET_KO.signature));
    }catch(e){ toast('Détourage impossible','var(--orange)'); }
    finally{ URL.revokeObjectURL(url); }
  };
  im.onerror=()=>{ URL.revokeObjectURL(url); toast('Image illisible','var(--orange)'); };
  im.src=url;
}
function _majImageVitrine(input,id){
  // La signature est TOUJOURS detouree, quel que soit le format d origine :
  // c est le seul moyen de garantir zero fond sans rien demander au coach.
  const _fs=input.files&&input.files[0];
  // LE LOGO SUIT LE MEME CHEMIN QUE LA SIGNATURE : il est destine a etre pose
  // sur une image sans fond, un aplat blanc de scanner s'y verrait autant.
  // La difference est faite par la table, pas par une seconde branche.
  const _detour={'coach-signature':['signature','Signature détourée'],
                 'coach-logo':['logo','Logo détouré']}[id];
  if(_detour&&_fs){
    _detourerSignature(_fs,b64=>{
      currentUser[_detour[0]]=b64;
      _apercuVitrine(id,b64);
      toast(_detour[1]+' : pense à enregistrer');
    },IMG_BUDGET_KO[_detour[0]]);
    return;
  }
  const _f=input.files&&input.files[0];
  // Au-dela de 1,2 Mo on redimensionne quand meme : la transparence ne vaut
  // pas de faire porter une image lourde a chaque athlete.
  if(_f&&/png/i.test(_f.type)&&_f.size<=1200*1024){
    const cfg=_IMG_VITRINE[id]; if(!cfg) return;
    _lirePngIntact(_f,brut=>{
      // 1,2 Mo de fichier font ~1,6 Mo une fois en base64. Le controle de
      // taille a l'entree ne suffisait donc pas : il portait sur le fichier,
      // pas sur ce qui allait etre stocke.
      _pngRamener(brut,IMG_BUDGET_KO[cfg[0]]||240,b64=>{
        currentUser[cfg[0]]=b64;
        _apercuVitrine(id,b64);
        toast('Image ajoutée : pense à enregistrer');
      });
    });
    return;
  }
  const cfg=_IMG_VITRINE[id]; if(!cfg) return;
  _lireImage(input,cfg[1],cfg[2],b64=>{
    currentUser[cfg[0]]=b64;
    _apercuVitrine(id,b64);
    toast('Image ajoutée : pense à enregistrer');
  });
}
function _viderImageVitrine(id){
  const cfg=_IMG_VITRINE[id]; if(!cfg) return;
  currentUser[cfg[0]]='';
  _apercuVitrine(id,'');
}
function ajouterDiplomeRow(titre,image){
  const z=document.getElementById('coach-diplomes-liste');
  if(!z) return;
  const row=document.createElement('div');
  row.className='dip-row';
  row.style.cssText='display:flex;gap:6px;margin-bottom:6px;align-items:center';
  const st='flex:1;min-width:0;font-size:var(--fs-sm);padding:10px;background:var(--surface-2);border:1.5px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif';
  const t=document.createElement('input');
  t.type='text'; t.className='dip-titre'; t.placeholder='ex : Licence STAPS';
  t.maxLength=120; t.style.cssText=st; t.value=titre||'';
  const i=document.createElement('input');
  // L'image du diplome est un FICHIER, pas un lien. On la garde en memoire
  // sur la ligne : le champ file ne peut pas porter une valeur existante.
  i.type='button'; i.className='dip-image';
  i.dataset.img=image||'';
  _texteIco(i,image?'Image '+ICO.coche:'Ajouter une image');
  i.style.cssText=st+';cursor:pointer;text-align:left';
  i.onclick=()=>{
    const f=document.createElement('input');
    f.type='file'; f.accept='image/*';
    f.onchange=()=>{ _lireImage(f,900,1200,(b64)=>{
      i.dataset.img=b64; _texteIco(i,'Image '+ICO.coche); }); };
    f.click();
  };
  const x=document.createElement('button');
  x.type='button'; _texteIco(x,ICO.croix);
  x.setAttribute('aria-label','Retirer ce diplôme');
  x.style.cssText='flex:none;min-width:44px;min-height:44px;background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);cursor:pointer';
  x.onclick=()=>row.remove();
  row.appendChild(t); row.appendChild(i); row.appendChild(x);
  z.appendChild(row);
}
// Ce que l'editeur porte, nettoye. Une ligne sans intitule ne part pas :
// une image seule ne dit pas de quel diplome il s'agit.
function _lireDiplomes(){
  const z=document.getElementById('coach-diplomes-liste');
  if(!z) return null;
  return [...z.querySelectorAll('.dip-row')].map(r=>({
    titre:(r.querySelector('.dip-titre')?.value||'').trim(),
    image:(r.querySelector('.dip-image')?.dataset.img||'')
  })).filter(d=>d.titre).map(d=>({
    titre:d.titre,
    image:d.image||''
  })).slice(0,12);
}
// ══════ VITRINE DU COACH ══════
// Ce que l'athlete lit en touchant la carte de son coach. La source est le
// PROFIL PUBLIC : sur le telephone de l'athlete, le dossier complet du coach
// n'est pas lisible, exactement comme pour la carte elle-meme.
// Rien n'est rendu quand rien n'est rempli — une vitrine vide vaut moins
// qu'une carte qui ne s'ouvre pas.
function vitrineCoachRemplie(pub){
  const p=pub||{};
  return !!((p.bio||'').trim()||(p.vision||'').trim()||p.photoVitrine||p.signature
    ||p.cartePro||((p.diplomes||[]).length));
}
// Le detail technique, en petit, sous la phrase. Il ne s adresse pas a
// l athlete mais a qui depanne : sans lui, un ecran vide ne distingue pas
// une cle manquante d un profil non publie ou d un champ absent.
function _diagVitrine(){
  try{
    const cle=cleCoachDe(currentUser);
    const pub=cle?profilCoachLocal(cle):null;
    const loc=Object.values(DB.get('users')||{})
      .find(x=>x&&currentUser&&x.id===currentUser.coachId);
    const dit=[];
    if(!currentUser||!currentUser.coachId) dit.push('aucun coach rattaché');
    if(!cle) dit.push('clé coach absente (coachEmailKey)');
    else if(!pub) dit.push('profil public jamais téléchargé');
    else if(!(pub.bio||pub.vision||pub.photoVitrine||(pub.diplomes||[]).length))
      dit.push('profil public reçu, mais sans présentation');
    if(loc&&(loc.bio||loc.vision)) dit.push('la présentation existe en local mais n’est pas publiée');
    if(!dit.length) return '';
    return '<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:10px">'
      +escapeHtml(dit.join(' · '))+'</div>';
  }catch(e){ return ''; }
}
function _htmlVitrineCoach(pub){
  const p=pub||{};
  const nom=[p.fname,p.lname].filter(Boolean).join(' ').trim()||p.teamName||'Ton coach';
  const img=(src,st)=>src?('<img src="'+escapeHtml(src)+'" alt="" loading="lazy" style="'+st+'">'):'';
  const TRAME="repeating-linear-gradient(-50deg,transparent,transparent 12px,rgba(255,255,255,.020) 12px,rgba(255,255,255,.020) 13px)";
  const CARTE="background:linear-gradient(168deg,var(--surface-3),var(--surface-1) 52%,var(--surface-0));border:1px solid var(--border);border-radius:var(--r-3);padding:20px;margin-bottom:16px;box-shadow:var(--e1);position:relative;overflow:hidden";
  const TITRE="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:800;text-transform:uppercase;margin-bottom:12px;--halo-c:color-mix(in srgb,var(--red) 55%,transparent);text-shadow:var(--halo-2)";
  // La trame carbone, posee en calque : elle donne la matiere sans rien
  // telecharger, et ne mange aucun contraste au texte pose dessus.
  const grain='<div style="position:absolute;inset:0;pointer-events:none;background:'+TRAME+'"></div>';
  const carte=(titre,texte)=>{
    const t=(texte||'').trim();
    if(!t) return '';
    return '<div style="'+CARTE+'">'+grain
      +'<div style="position:relative">'
      +'<div style="'+TITRE+'">'+titre+'</div>'
      +'<div style="font-size:var(--fs-md);color:var(--text-strong);line-height:1.8">'+escapeHtml(t).replace(/\n/g,'<br>')+'</div>'
      +'</div></div>';
  };
  // ── MES PROGRAMMES ──────────────────────────────────────────────────
  // ENTRE « Qui je suis » ET « Ma vision », et pas ailleurs. C'est la position
  // qui suit la confiance et precede le detail : on ne propose rien avant
  // d'avoir dit qui on est, et on ne fait pas defiler trois cartes de methode
  // avant d'arriver a ce qui se vend.
  //
  // RIEN N'EST RENDU QUAND RIEN N'EST EN VENTE. La regle du fichier, celle que
  // _htmlDiplomesCoach et _htmlJamaisDemarre appliquent deja : un cadre vide qui
  // annonce zero devient du decor, et on cesse de le lire le jour ou il dit
  // quelque chose.
  const _progs=(Array.isArray(p.vitrineProgrammes)?p.vitrineProgrammes:[])
    .map(_htmlCarteProgVitrine).filter(Boolean);
  const blocProgrammes=_progs.length
    ?('<div style="margin-bottom:16px">'
      +'<div style="'+TITRE+'">Mes programmes</div>'+_progs.join('')+'</div>')
    :'';
  // UNE VITRINE QUI N'A QUE DES PROGRAMMES N'EST PAS VIDE. Sans ce terme, un
  // coach qui met un programme en vente sans avoir rempli sa bio verrait son
  // athlete tomber sur « Ton coach n'a pas encore rempli sa présentation ».
  const _rempli=(p.bio||'').trim()||(p.vision||'').trim()||p.photoVitrine
    ||p.signature||p.cartePro||((p.diplomes||[]).length)||_progs.length;
  if(!_rempli){
    return '<div class="pad" style="padding-bottom:48px">'
      +'<h1 style="margin-bottom:14px">'+escapeHtml(nom)+'</h1>'
      +'<div style="'+CARTE+';border-left:1px solid var(--border)">'+grain
      +'<div style="position:relative;font-size:var(--fs-md);color:var(--text-strong);line-height:1.75">'
      +(currentUser&&currentUser.role==='coach'
        ?'Ta présentation est vide. Remplis « Qui tu es » dans ton profil, puis touche <strong>Enregistrer</strong> : le bouton rouge, pas « Prévisualiser ».'
        :('Ton coach n’a pas encore rempli sa présentation.'+_diagVitrine()))
      +'</div></div></div>';
  }
  const eyebrow=p.teamName?('<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:3.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px;--halo-c:color-mix(in srgb,var(--red) 60%,transparent);text-shadow:var(--halo-2)">'+escapeHtml(p.teamName)+'</div>'):'';
  const titre='<h1 style="margin:0;font-weight:400;line-height:1.02;text-shadow:0 3px 18px rgba(0,0,0,.9)">'+escapeHtml(nom)+'</h1>';
  const phrase=(p.catchphrase||'').trim()
    ?('<div style="font-size:15px;color:var(--text-strong);letter-spacing:.2px;font-style:italic;line-height:1.65;margin-top:12px">« '+escapeHtml(p.catchphrase.trim())+' »</div>')
    :'';
  // TETE. Le filet rouge lumineux sous la photo raccorde l ecran a
  // l identite de l app, et separe l image du texte sans trait dur.
  const tete=p.photoVitrine
    ?('<div style="position:relative;border-radius:var(--r-4);overflow:hidden;margin-bottom:20px;box-shadow:var(--e3)">'
      +img(p.photoVitrine,'width:100%;display:block')
      +'<div style="position:absolute;inset:0;background:'+TRAME+';pointer-events:none"></div>'
      +'<div style="position:absolute;inset:auto 0 0 0;padding:64px 20px 20px;background:linear-gradient(to top,color-mix(in srgb,var(--bg) 97%,transparent),color-mix(in srgb,var(--bg) 78%,transparent) 42%,transparent)">'
      +eyebrow+titre+'</div>'
      +'<div style="position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,var(--red),transparent);box-shadow:0 0 16px color-mix(in srgb,var(--red) 85%,transparent)"></div>'
      +'</div>'+(phrase?('<div style="margin:-8px 4px 20px">'+phrase+'</div>'):''))
    :('<div style="margin-bottom:20px">'+eyebrow+titre+phrase+'</div>');
  return '<div class="pad" style="padding-bottom:48px">'
    +tete
    +carte('Qui je suis',p.bio)
    +blocProgrammes
    +carte('Ma vision',p.vision)
    +_htmlDiplomesCoach(p)
    +(p.signature?('<div style="text-align:center;margin-top:20px;padding-top:32px;position:relative">'
        +'<div style="position:absolute;top:0;left:12%;right:12%;height:1px;background:linear-gradient(90deg,transparent,var(--border),transparent)"></div>'
        +img(p.signature,'max-width:210px;width:58%;display:inline-block;background:none')
        +'</div>'):'')
    // R34 — LES BANNIERES DU COACH NE SONT PLUS ICI : elles sont revenues au
    // bas de l'accueil athlete (#clh-promo-banners), a la demande de Kevin.
    +'</div>';
}
// Diplomes et carte pro, et le texte qui dit pourquoi ca compte. Rien n'est
// rendu quand rien n'est renseigne : ce bloc ne doit pas devenir un encart
// vide qui laisse croire a un document manquant.
//
// Le texte parle de FORMATION, jamais de sante : RepCore ne pose aucun
// diagnostic et ne promet aucun resultat. Il dit ce qu'un diplome garantit
// — une formation verifiee — et rien de plus.
function _htmlDiplomesCoach(p){
  const dips=((p||{}).diplomes||[]).filter(d=>d&&d.titre);
  const carte=(p||{}).cartePro||'';
  if(!dips.length&&!carte) return '';
  const TRAME="repeating-linear-gradient(-50deg,transparent,transparent 12px,rgba(255,255,255,.020) 12px,rgba(255,255,255,.020) 13px)";
  const CARTE="background:linear-gradient(168deg,var(--surface-3),var(--surface-1) 52%,var(--surface-0));border:1px solid var(--border);border-radius:var(--r-3);padding:20px;margin-bottom:16px;box-shadow:var(--e1);position:relative;overflow:hidden";
  const TITRE="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:800;text-transform:uppercase;margin-bottom:12px;--halo-c:color-mix(in srgb,var(--red) 55%,transparent);text-shadow:var(--halo-2)";
  const grain='<div style="position:absolute;inset:0;pointer-events:none;background:'+TRAME+'"></div>';
  const img=src=>'<img src="'+escapeHtml(src)+'" alt="" loading="lazy" style="width:100%;border-radius:var(--r-3);margin-top:12px;display:block;box-shadow:var(--e2)">';
  // La pastille porte un halo : c est le seul point rouge de la liste, et
  // c est lui qui fait lire la ligne comme une validation.
  const ligne=d=>'<div style="padding:14px 0;border-bottom:1px solid #191919">'
    +'<div style="display:flex;gap:12px;align-items:center">'
    +'<span style="flex:none;width:21px;height:21px;border-radius:var(--r-full);background:linear-gradient(150deg,#ff4a3a,#b81515);color:var(--text);font-size:var(--fs-xs);font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px color-mix(in srgb,var(--red) 60%,transparent)">'+icon('coche',14)+'</span>'
    +'<span style="flex:1;min-width:0;font-size:var(--fs-sm);font-weight:700;color:var(--text);letter-spacing:.4px">'+escapeHtml(d.titre)+'</span>'
    +'</div>'+(d.image?img(d.image):'')+'</div>';
  let h='<div style="'+CARTE+'">'+grain+'<div style="position:relative">';
  if(dips.length) h+='<div style="'+TITRE+'">Diplômes et formations</div>'+dips.map(ligne).join('');
  if(carte) h+='<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;text-transform:uppercase;font-weight:800;margin:20px 0 8px">Carte professionnelle</div>'
      +'<img src="'+escapeHtml(carte)+'" alt="" loading="lazy" style="width:100%;border-radius:var(--r-3);display:block;box-shadow:var(--e2)">';
  h+='</div></div>';
  // L encart pedagogique : fond plus chaud, liseré lumineux. Il parle du
  // metier, pas du coach — il ne doit pas se confondre avec la liste.
  h+='<div style="position:relative;overflow:hidden;background:linear-gradient(160deg,var(--red-bg),var(--red-bg));border:1px solid color-mix(in srgb,var(--red) 30%,transparent);border-left:1px solid var(--border);border-radius:var(--r-4);padding:20px 20px;margin-bottom:16px;box-shadow:var(--e3),var(--glow-red)">'+grain
    +'<div style="position:relative">'
    +'<div style="font-size:var(--fs-xs);letter-spacing:2.5px;text-transform:uppercase;color:var(--red-text);font-weight:800;margin-bottom:10px;--halo-c:color-mix(in srgb,var(--red) 70%,transparent);text-shadow:var(--halo-2)">Pourquoi un professionnel diplômé</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.8">'
    +'Un diplôme n\'est pas une formalité administrative : c\'est la preuve que la personne '
    +'qui règle tes charges, corrige ta technique et t\'oriente sur ton alimentation a été '
    +'formée pour le faire et qu\'elle sait où s\'arrête son domaine. '
    +'Un accompagnement improvisé, c\'est au mieux des mois perdus, au pire une blessure.'
    +'</div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:12px">'
    +'Les documents ci-dessus ont été publiés par ton coach lui-même.'
    +'</div></div></div>';
  return h;
}
// Cote athlete : depuis la carte du coach.
function ouvrirVitrineCoach(){
  // LES MEMES SOURCES QUE LA CARTE, et dans le meme ordre. Ne lire que le
  // profil public suffisait a rendre la vitrine muette dans deux cas reels :
  // sur l appareil du COACH, ou profilCoachLocal ne rend rien puisqu il n a
  // pas de coach ; et chez un athlete dont le cache rc_coach_profil date
  // d avant l existence de ces champs. Le dossier local complete le public,
  // exactement comme _applyCoachData le fait pour la carte.
  const _cle=cleCoachDe(currentUser);
  const _pub=profilCoachLocal(_cle)||{};
  const _loc=Object.values(DB.get('users')||{})
    .find(x=>x&&currentUser&&x.id===currentUser.coachId)||{};
  // Et si l utilisateur EST le coach, sa vitrine est dans son propre dossier.
  const _moi=(currentUser&&currentUser.role==='coach')?currentUser:{};
  // PREMIERE VALEUR NON VIDE, champ par champ. Un Object.assign laissait la
  // derniere source ecraser les precedentes avec du vide : sur l appareil du
  // coach, cleCoachDe rend null, profilCoachLocal rend alors le cache de
  // n importe quel profil — souvent anterieur a ces champs — et il effacait
  // le dossier du coach lui-meme. L ordre ne decide plus de rien : seul
  // compte qu une valeur soit renseignee.
  const _plein=v=>Array.isArray(v)?v.length>0:!!(v&&String(v).trim());
  const pub={};
  // vitrineProgrammes A REJOINT CETTE LISTE. Il se dessine sur cet ecran :
  // absent d'ici, il n'aurait jamais atteint _htmlVitrineCoach, et la vitrine
  // se serait affichee sans lui — sans erreur, sans trace, exactement comme la
  // photo du coach avant lui. R34 — promoBanners en est ressorti : les
  // bannieres sont revenues sur l'accueil.
  ['fname','lname','teamName','catchphrase','bio','vision','photoVitrine',
   'signature','cartePro','diplomes','vitrineProgrammes'].forEach(k=>{
    const v=[_pub[k],_loc[k],_moi[k]].find(_plein);
    if(v!==undefined) pub[k]=v;
  });
  // Aucune condition : on ouvre, et l ecran dit lui-meme ce qui manque.
  const z=document.getElementById('vitrine-coach-corps');
  if(!z) return false;
  z.innerHTML=_htmlVitrineCoach(pub);
  goAvecRetour('s-vitrine');
  // ── LA MESURE ───────────────────────────────────────────────────────
  // rcmVue ET NON rcm : une fois par visite, comme les autres vues d'ecran.
  // Un aller-retour entre l'accueil et la vitrine — le comportement normal de
  // quelqu'un qui hesite — gonflerait le compteur et ferait apparaitre un taux
  // de clic plus bas que la realite.
  //
  // ⚠ LE COACH NE SE COMPTE PAS LUI-MEME. Il ouvre sa propre vitrine pour la
  // relire, souvent, et chaque relecture aurait pese autant qu'une visite
  // d'athlete. « programme_vu » suit la meme regle et n'est emis que s'il y a
  // effectivement une carte a voir : sans cela, il aurait compte des vitrines
  // sans le moindre programme.
  try{
    if(!currentUser||currentUser.role!=='coach'){
      rcmVue('vitrine_vue');
      if((Array.isArray(pub.vitrineProgrammes)?pub.vitrineProgrammes.length:0)>0)
        rcmVue('programme_vu');
    }
  }catch(e){}
  // RAFRAICHISSEMENT A L OUVERTURE. Le cache rc_coach_profil n etait relu
  // qu au demarrage : un coach qui vient de publier sa presentation ne la
  // voyait pas arriver chez son athlete avant le prochain lancement, et rien
  // ne disait qu il fallait attendre. On retire maintenant, et on redessine
  // si le contenu a change — sans bloquer l ouverture, qui a deja eu lieu.
  try{
    if(_cle&&CLOUD&&CLOUD.ok&&CLOUD.ok()){
      CLOUD.pullProfilCoach(_cle).then(frais=>{
        if(!frais) return;
        const maj={};
        ['fname','lname','teamName','catchphrase','bio','vision','photoVitrine',
         'signature','cartePro','diplomes','vitrineProgrammes'].forEach(k=>{
          const v=[frais[k],pub[k]].find(x=>Array.isArray(x)?x.length:(x&&String(x).trim()));
          if(v!==undefined) maj[k]=v;
        });
        const zz=document.getElementById('vitrine-coach-corps');
        // AUCUNE MESURE ICI : c'est le meme ecran, deja compte a l'ouverture.
        // Le rafraichissement redessine, il ne revisite pas.
        if(zz) zz.innerHTML=_htmlVitrineCoach(maj);
      }).catch(()=>{});
    }
  }catch(e){}
  return true;
}
// Cote coach : la meme fonction de rendu, sur son propre dossier — sinon
// l'apercu et ce que voit l'athlete pourraient diverger.
function apercuVitrineCoach(){
  const z=document.getElementById('vitrine-coach-corps');
  if(!z) return;
  // SEULS LA BIO ET LA VISION SONT LUES DANS LE FORMULAIRE : ce sont les deux
  // seuls champs en cours de saisie, dans des <textarea>.
  //
  // Les deux lignes qui suivaient lisaient getElementById('coach-photo-vitrine')
  // et ...('coach-signature'). Ces chaînes ne sont pas des identifiants : ce
  // sont les CLÉS de _IMG_VITRINE, celles que les <input type="file"> passent
  // à _majImageVitrine — et ces inputs ne portent aucun id. getElementById
  // rendait null, et `||''` posait une chaîne vide : l'aperçu effaçait les
  // deux images qu'il était censé montrer.
  const brouillon=Object.assign({},currentUser,{
    bio:(document.getElementById('coach-bio')?.value||''),
    vision:(document.getElementById('coach-vision')?.value||'')});
  // Les images viennent du DOSSIER, où _majImageVitrine les a déjà posées —
  // même règle que saveCoachIdentity, qui le dit déjà en toutes lettres.
  //
  // La table décide desquelles : la recopier à la main ici est précisément ce
  // qui avait produit le défaut. Une image ajoutée à _IMG_VITRINE demain sera
  // couverte sans qu'on y revienne.
  Object.values(_IMG_VITRINE).forEach(cfg=>{ brouillon[cfg[0]]=currentUser[cfg[0]]||''; });
  // LES PROGRAMMES EN VENTE SE DERIVENT ICI AUSSI. Le champ n'existe dans le
  // dossier qu'apres une publication : sans cette ligne, le coach qui met un
  // programme en vente puis previsualise sa vitrine ne l'y verrait pas, et
  // croirait que rien n'a pris.
  try{ brouillon.vitrineProgrammes=vitrineProgrammesDe(currentUser); }catch(e){}
  z.innerHTML=_htmlVitrineCoach(brouillon);
  // AUCUNE MESURE : un coach qui relit sa propre vitrine n'est pas une visite.
  goAvecRetour('s-vitrine');
}
function saveCoachIdentity(){
  // ⚠ CES DEUX CHAMPS-LA ETAIENT ECRITS SANS CONDITION, et c'est la premiere
  // cause de disparition. `?.value||''` rend la chaine VIDE quand l'editeur
  // n'est pas dans le document — et la ligne suivante l'ecrivait par-dessus le
  // nom de la team. La garde existait deja trois lignes plus bas, posee pour
  // la bio et la vision : elle n'avait simplement jamais ete appliquee aux
  // deux premiers.
  //
  // Et l'effacement ne s'arrete pas la : une chaine vide poussee vers /users
  // EFFACE la valeur locale des autres appareils au reveil suivant, parce que
  // la fusion applique — a juste titre — la regle « absent n'est pas vide ».
  // Un champ vide cote distant est un effacement volontaire ; encore faut-il
  // qu'il en soit vraiment un.
  const _v=id=>{const e=document.getElementById(id);return e?(e.value||'').trim():null;};
  const _nom=_v('coach-team-name'), _phrase=_v('coach-catchphrase');
  if(_nom!==null) currentUser.teamName=_nom;
  if(_phrase!==null) currentUser.catchphrase=_phrase;
  const _bio=_v('coach-bio'), _vis=_v('coach-vision');
  // Les images sont deja posees sur currentUser par _majImageVitrine.
  if(_bio!==null) currentUser.bio=_bio;
  if(_vis!==null) currentUser.vision=_vis;
  // Les spécialités : la vitrine publique (/coach/<slug>) en fait des puces.
  const _spe=_v('coach-specialites');
  if(_spe!==null) currentUser.specialites=_spe.slice(0,200);
  // Une URL vide efface le champ ; une URL non http est refusee plutot que
  // publiee telle quelle a tous les athletes.


  const _dip=_lireDiplomes();
  if(_dip!==null) currentUser.diplomes=_dip;
  // C6 : les formules de la vitrine et le message d'accueil des prospects.
  try{ _lireReglagesProspects(); }catch(e){}
  const _envoi=CLOUD.pushProfilCoach(currentUser);
  const ok=saveUser();
  // Push immédiat non-debounced pour que les athlètes voient les données immédiatement
  setTimeout(()=>{try{const u=DB.get('users');if(u) CLOUD._doPush(u);}catch{}},300);
  toastSync(ok,_envoi,'Identité de la team enregistrée '+ICO.coche,'le profil public est');
}

// ── Le cadre de disponibilité, côté écran ─────────────────────────────────
// Côté coach : une section de réglages. Côté athlète : un bandeau AVANT la
// zone de saisie, jamais après l'envoi. Le compteur de délai médian n'existe
// que sur l'écran du coach — il n'est pas dans CHAMPS_PROFIL_COACH, donc il
// ne peut pas partir vers l'athlète, et une assertion le vérifie.
const DISPO_TRACES_MAX=50;
function _dispoLireDate(id){
  const el=document.getElementById(id);
  const v=el&&el.value?String(el.value).trim():'';
  if(!v) return null;
  const t=Date.parse(v+'T00:00:00');
  return isFinite(t)?t:null;
}
function saveCoachDispo(){
  if(!currentUser) return;
  const dEl=document.getElementById('coach-dispo-delai');
  const brut=dEl&&dEl.value!==''?Number(dEl.value):null;
  if(brut!=null&&!(brut>=DISPO_DELAI_MIN_H&&brut<=DISPO_DELAI_MAX_H)){
    toast('Le délai doit tenir entre 1 h et 7 jours.','var(--orange)'); return;
  }
  const actif=!!(document.getElementById('coach-dispo-abs')||{}).checked;
  const du=_dispoLireDate('coach-dispo-du');
  const au=_dispoLireDate('coach-dispo-au');
  const msg=((document.getElementById('coach-dispo-msg')||{}).value||'').trim().slice(0,140);
  if(actif){
    // REFUS EXPLICITE, pas un silence : une absence sans fin ne s'éteint
    // jamais et l'athlète ne sait pas quand revenir.
    if(au==null){ toast('Une date de fin est obligatoire pour une absence.','var(--orange)'); return; }
    if(!absenceValide({du,au},Date.now())){
      toast('Absence impossible : la fin doit suivre le début, et 90 jours au plus.','var(--orange)');
      return;
    }
  }
  const anc=(currentUser.dispo&&currentUser.dispo.plages)||[];
  currentUser.dispo={delaiH:(brut!=null?Math.round(brut):null),plages:anc,
    absence:{actif:actif,du:du,au:au,message:msg}};
  const _envoi=CLOUD.pushProfilCoach(currentUser);
  const ok=saveUser();
  setTimeout(()=>{try{const u=DB.get('users');if(u) CLOUD._doPush(u);}catch(e){}},300);
  toastSync(ok,_envoi,'Disponibilité enregistrée '+ICO.coche,'le profil public est');
  _chargerDispoCoach(currentUser);
}
function _dispoAAAAMMJJ(ts){
  if(ts==null) return '';
  const d=new Date(ts);
  const p=n=>(n<10?'0':'')+n;
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function _chargerDispoCoach(u){
  const d=(u&&u.dispo)||{};
  const set=(id,v)=>{const e=document.getElementById(id); if(e) e.value=v;};
  set('coach-dispo-delai',d.delaiH!=null?d.delaiH:'');
  const a=d.absence||{};
  const cb=document.getElementById('coach-dispo-abs');
  if(cb) cb.checked=a.actif===true;
  set('coach-dispo-du',_dispoAAAAMMJJ(a.du));
  set('coach-dispo-au',_dispoAAAAMMJJ(a.au));
  set('coach-dispo-msg',a.message||'');
  // Aperçu : le coach lit EXACTEMENT ce que son athlète lira.
  const ap=document.getElementById('coach-dispo-apercu');
  if(ap){
    const t=dispoLibelle(d,Date.now());
    ap.textContent=t?('Tes athlètes liront : « '+t+' »')
                    :'Rien n\'est affiché tant que tu n\'as pas déclaré de délai.';
  }
  // ── Le compteur, POUR LE COACH SEUL ──
  // Ce n'est pas un score et il ne quitte pas cet écran : ni la liste blanche
  // du profil public, ni aucun rendu athlète ne le portent.
  const md=document.getElementById('coach-dispo-median');
  if(md){
    let m=null;
    try{ m=delaiMedianReponse(dispoEchangesDe(getClients()),Date.now()); }catch(e){}
    md.innerHTML=(m==null)
      ?'<span style="color:var(--text-faint)">Pas encore assez de bilans répondus pour calculer ton délai réel.</span>'
      :'Ton délai réel médian sur '+DISPO_MEDIAN_FENETRE_J+' jours : <b>'
        +(m<24?(Math.round(m*10)/10).toString().replace('.',',')+' h'
              :(Math.round(m/2.4)/10).toString().replace('.',',')+' jours')
        +'</b> <span style="color:var(--text-faint)">: visible de toi seul.</span>';
  }
}
// ── Côté athlète : le bandeau, AVANT la saisie ────────────────────────────
// Il informe, il ne censure pas : aucun envoi n'est bloqué, différé ni filtré.
// Quand un signal de santé est levé, on le dit — la santé passe avant
// l'intendance, et le message part de toute façon.
function htmlBandeauDispo(){
  let d=null;
  try{ d=(profilCoachLocal(cleCoachDe(currentUser))||{}).dispo||null; }catch(e){}
  const txt=dispoLibelle(d,Date.now());
  const sante=dispoSanteForce(currentUser);
  if(!txt&&!sante) return '';
  const abs=(()=>{ try{ return absenceEnCours(d,Date.now()); }catch(e){ return false; } })();
  const msg=(abs&&d&&d.absence&&d.absence.message)?d.absence.message:'';
  const couleur=abs?'var(--orange)':'var(--sub)';
  const fond=abs?'var(--warning-bg)':'var(--surface-1)';
  const bord=abs?'var(--warning-border)':'var(--border)';
  return `<div style="background:${fond};border:1px solid ${bord};border-radius:var(--r-3);padding:10px 12px;margin-bottom:12px">
    ${txt?`<div style="font-size:var(--fs-xs);color:${couleur};font-weight:700;line-height:1.5">${escapeHtml(txt)}</div>`:''}
    ${msg?`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.55;margin-top:4px">${escapeHtml(msg)}</div>`:''}
    ${sante?`<div style="font-size:var(--fs-xs);color:var(--red-text);line-height:1.55;margin-top:${txt||msg?'6':'0'}px;font-weight:700">Ce que tu signales touche ta santé : ton coach en est averti quoi qu'il arrive.</div>`
           :`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">Tu peux écrire quand tu veux : rien n'est bloqué.</div>`}
  </div>`;
}
function _majBandeauDispo(id){
  const el=document.getElementById(id);
  if(el) el.innerHTML=htmlBandeauDispo();
}
// La TRACE. Sans serveur, l'appareil de l'athlète ne peut pas faire sonner
// celui du coach : on écrit donc la trace dans le dossier de l'athlète, elle
// remonte par la synchronisation ordinaire, et c'est l'appareil du coach qui
// la relèvera à sa prochaine ouverture. Le mode absence n'y change rien.
function _dispoTracerSante(contexte){
  try{
    const motif=dispoSanteForce(currentUser);
    if(!motif||!currentUser) return false;
    if(!Array.isArray(currentUser.tracesSante)) currentUser.tracesSante=[];
    currentUser.tracesSante.push({quand:Date.now(),motif:motif,ou:String(contexte||'')});
    if(currentUser.tracesSante.length>DISPO_TRACES_MAX)
      currentUser.tracesSante=currentUser.tracesSante.slice(-DISPO_TRACES_MAX);
    saveUser();
    return true;
  }catch(e){ return false; }
}
function addCoachBannerRow(imageUrl, linkUrl){
  const list=document.getElementById('coach-banners-list');
  if(!list) return;
  if(list.children.length>=5){toast('Maximum 5 bannières','var(--orange)');return;}
  const n=list.children.length+1;
  const row=document.createElement('div');
  row.className='banner-row';
  row.dataset.imageUrl=imageUrl||'';
  row.style.cssText='background:#0f0f1f;border:1px solid #2a2a4a;border-radius:var(--r-2);padding:10px;display:flex;flex-direction:column;gap:8px';
  const previewHtml=imageUrl
    ?`<img src="${escapeHtml(imageUrl)}" style="width:100%;height:90px;object-fit:cover;border-radius:var(--r-1);display:block">`
    :`<div style="height:90px;display:flex;align-items:center;justify-content:center;background:#0a0a1a;border-radius:var(--r-1);font-size:var(--fs-xs);color:var(--text-dim)">Ajouter une photo</div>`;
  row.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between">
    <span style="font-size:var(--fs-xs);font-weight:800;color:var(--info);letter-spacing:1px">BANNIÈRE ${n}</span>
    <button onclick="this.closest('.banner-row').remove()" style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;line-height:1">${icon('croix',14)}</button>
  </div>
  <label style="cursor:pointer;display:block">
    <div class="banner-preview">${previewHtml}</div>
    <div style="text-align:center;font-size:var(--fs-xs);color:var(--text-dim);margin-top:4px;letter-spacing:1px">APPUYER POUR CHANGER LA PHOTO</div>
    <input type="file" accept="image/*" style="display:none" onchange="handleBannerImage(this)">
  </label>
  <input type="url" placeholder="URL du lien au clic (https://…)" value="${escapeHtml(linkUrl||'')}" style="width:100%;font-size:var(--fs-sm);padding:8px 10px;box-sizing:border-box;border-radius:var(--r-1)">`;
  list.appendChild(row);
}
function handleBannerImage(input){
  const f=input.files[0];if(!f) return;
  const row=input.closest('.banner-row');
  const prev=row?.querySelector('.banner-preview');
  if(prev) prev.innerHTML='<div class="skeleton fx-loop" style="height:90px;border-radius:var(--r-1)"></div>';
  compressImage(f,1800,0.88,b64=>{
    if(!row) return;
    row.dataset.imageUrl=b64;
    if(prev) prev.innerHTML=`<img src="${b64}" style="width:100%;height:auto;border-radius:var(--r-1);display:block">`;
  });
}
function saveCoachBanners(){
  const list=document.getElementById('coach-banners-list');
  if(!list) return;
  const banners=[];
  list.querySelectorAll('.banner-row').forEach(row=>{
    const img=row.dataset.imageUrl||'';
    const url=(row.querySelector('input[type=url]')?.value||'').trim();
    if(img||url) banners.push({imageUrl:img,linkUrl:url});
  });
  currentUser.promoBanners=banners;
  const _envoi=CLOUD.pushProfilCoach(currentUser);
  const ok=saveUser();
  setTimeout(()=>{try{const u=DB.get('users');if(u) CLOUD._doPush(u);}catch{}},300);
  toastSync(ok,_envoi,'Bannières enregistrées '+ICO.coche,'le profil public est');
}
// R34 — LE CONTENEUR EST REVENU AU BAS DE L'ACCUEIL ATHLETE (#clh-promo-banners).
// Un seul identifiant dans toute l'application — un second, reste dans la
// vitrine, aurait fait afficher les memes bannieres a deux endroits, et le
// premier trouve aurait decide lequel.
// LE CARROUSEL (Kevin, 30/09/2026) : les bannieres ne s'empilent plus, elles
// se relaient au meme endroit, une toutes les PROMO_DEFILE_MS. Toutes sont
// posees dans la meme case de grille : la hauteur est celle de la plus haute,
// et rien ne saute quand l'une remplace l'autre. Une seule banniere : pas de
// carrousel, pas de points.
const PROMO_DEFILE_MS=9000;
let _promoMinuteur=null, _promoIdx=0;
function _promoMontrer(n){
  const el=document.getElementById('clh-promo-banners');
  if(!el) return;
  const items=el.querySelectorAll('.promo-item'), pts=el.querySelectorAll('.promo-pt');
  if(!items.length) return;
  _promoIdx=((n%items.length)+items.length)%items.length;
  items.forEach((it,k)=>{ const on=k===_promoIdx; it.classList.toggle('on',on); it.setAttribute('aria-hidden',on?'false':'true');
    it.querySelectorAll('a').forEach(a=>{ a.tabIndex=on?0:-1; }); });
  pts.forEach((p,k)=>p.setAttribute('aria-current',k===_promoIdx?'true':'false'));
}
function _promoRelancer(){
  if(_promoMinuteur){ clearInterval(_promoMinuteur); _promoMinuteur=null; }
  const el=document.getElementById('clh-promo-banners');
  if(!el||el.querySelectorAll('.promo-item').length<2) return;
  _promoMinuteur=setInterval(()=>{
    const z=document.getElementById('clh-promo-banners');
    if(!z||!z.isConnected||z.querySelectorAll('.promo-item').length<2){ clearInterval(_promoMinuteur); _promoMinuteur=null; return; }
    // Onglet cache ou accueil hors de l'ecran : on ne tourne pas dans le vide.
    if(document.hidden||!z.offsetParent) return;
    _promoMontrer(_promoIdx+1);
  },PROMO_DEFILE_MS);
}
// Un point touche : on y va, et le compte des 9 secondes repart de zero.
function promoAller(n){ _promoMontrer(n); _promoRelancer(); }
function _renderPromoBanners(coach){
  const el=document.getElementById('clh-promo-banners');
  if(!el) return;
  const banners=(coach?.promoBanners||[]).filter(b=>b.imageUrl);
  if(!banners.length){el.style.display='none';el.innerHTML='';_promoRelancer();return;}
  el.style.display='block';
  const items=banners.map((b,k)=>{
    const img=`<img src="${escapeHtml(b.imageUrl)}" alt="" style="width:100%;height:auto;display:block;border-radius:var(--r-2);border:1px solid var(--border)" onerror="this.style.display='none'">`;
    return `<div class="promo-item${k===0?' on':''}" aria-hidden="${k===0?'false':'true'}">${b.linkUrl?`<a href="${safeUrl(b.linkUrl)}" target="_blank" rel="noopener" style="display:block"${k===0?'':' tabindex="-1"'}>${img}</a>`:img}</div>`;
  }).join('');
  const pts=banners.length>1
    ?'<div class="promo-pts">'+banners.map((b,k)=>`<button type="button" class="promo-pt" aria-label="Bannière ${k+1}" aria-current="${k===0?'true':'false'}" onclick="promoAller(${k})"></button>`).join('')+'</div>'
    :'';
  el.innerHTML=`<div class="promo-pile">${items}</div>${pts}`;
  _promoIdx=0;
  _promoRelancer();
}
function uploadAthletePhoto(input){
  const f=input.files[0];if(!f) return;
  // Même raison que pour l'avatar du coach : la compression en 300×300 rend
  // la taille du fichier d'origine indifférente au quota.
  if(f.size>20*1024*1024){toast('Image trop lourde (max 20 Mo)','var(--orange)');return;}
  _resizeImage(f,300,300,0.80).then(b64=>{
    if(!b64){toast('Image illisible : réessaie avec une autre photo','var(--orange)');return;}
    currentUser.athletePhoto=b64;
    const ok=saveUser();
    const circle=document.getElementById('atp-photo-circle');
    if(circle) circle.innerHTML=`<img src="${b64}" style="width:100%;height:100%;object-fit:cover">`;
    const avatar=document.getElementById('clh-athlete-avatar');
    if(avatar) avatar.innerHTML=`<img src="${b64}" style="width:100%;height:100%;object-fit:cover">`;
    toastEcriture(ok,'Photo enregistrée '+ICO.coche,'la photo est');
  });
}
// Suivi du cycle, modifiable à tout moment. La carte suit la convention de
// l'écran : on choisit, puis on enregistre — comme le genre juste au-dessus.
let _atpCycleSuivi=null;
const ATP_CYCLE_OPTIONS=Object.freeze([
  ['actif','Oui, je l\'indiquerai avant mes séances',''],
  ['sans_objet','Non, ça ne s\'applique pas à moi',
   'Ménopause, contraception continue, absence de règles, autre'],
  ['jamais_demander','Non, je préfère ne pas suivre ça',''],
]);
let _atpEtats=[];
let _atpThyEtat=null, _atpThyTrait=false;
let _atpHormo=null, _atpHormoTrait=false;
let _atpFamilles=[];
// Facultatif, et réversible d'un geste. Aucune dose, aucune molécule,
// aucune date : quatre cases, et rien à saisir.
function basculerFamilleTraitement(cle){
  if(!FAMILLES_TRAITEMENT.some(f=>f.cle===cle)) return false;
  const i=_atpFamilles.indexOf(cle);
  if(i>=0) _atpFamilles.splice(i,1); else _atpFamilles.push(cle);
  currentUser.famillesTraitement=_atpFamilles.slice();
  saveUser();
  _renderAtpTraitement();
  return true;
}
function _renderAtpTraitement(){
  const c=document.getElementById('atp-trait-card');
  if(!c) return;
  // La carte n'existe que pour qui a coché la case au bilan : proposer des
  // familles à qui ne déclare aucun traitement serait poser la question deux
  // fois, et par la bande.
  const on=traitementDeclare(currentUser);
  c.style.display=on?'block':'none';
  if(!on) return;
  const z=document.getElementById('atp-trait-opts');
  if(z) z.innerHTML=FAMILLES_TRAITEMENT.map(f=>
    `<div class="obj-opt${_atpFamilles.indexOf(f.cle)>=0?' sel':''}" onclick="basculerFamilleTraitement('${f.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(f.lib)}</div>
    </div>`).join('');
  const n=document.getElementById('atp-trait-note');
  if(n) n.textContent=TRAITEMENT_MENTION;
}
// Écriture immédiate, comme la grossesse : la déclaration n'attend pas le
// bouton SAUVEGARDER, et la retirer EFFACE tout — le partage avec elle.
function basculerPES(v){
  if(v) currentUser.pes=true;
  else { delete currentUser.pes; delete currentUser.pesPartagee; }
  try{ marquerDeclaration(currentUser,'pes','pes',v?'declare':'retire'); }catch(e){}
  saveUser();
  _renderAtpPES();
  return true;
}
function basculerPartagePES(v){
  if(!aPES(currentUser)){ delete currentUser.pesPartagee; saveUser(); _renderAtpPES(); return false; }
  if(v) currentUser.pesPartagee=true; else delete currentUser.pesPartagee;
  saveUser();
  _renderAtpPES();
  return true;
}
function _renderAtpPES(){
  const c=document.getElementById('atp-pes');
  if(!c) return;
  const a=aPES(currentUser);
  c.checked=a;
  const b=document.getElementById('atp-pes-bloc');
  if(b) b.style.display=a?'block':'none';
  // Jamais pré-cochée, et remise à faux dès que la déclaration tombe.
  const pa=document.getElementById('atp-pes-partage');
  if(pa) pa.checked=a&&!!currentUser.pesPartagee;
  const ph=document.getElementById('atp-pes-phrase');
  if(ph) ph.textContent=PES_PHRASE;
  const no=document.getElementById('atp-pes-partage-note');
  if(no) no.textContent=PES_NOTE_PARTAGE;
}
function setAtpHormonal(cle){
  _atpHormo=(STATUTS_HORMONAUX.some(x=>x.cle===cle)&&_atpHormo!==cle)?cle:null;
  _renderAtpEtats();
}
// La déclaration ÉCRIT tout de suite : un consentement se donne au moment où
// on le donne, pas au clic d'un bouton « Enregistrer » plus bas dans l'écran.
function declarerGrossesse(etat){
  if(!GROSSESSE_ETATS.some(x=>x.cle===etat)) return false;
  const c=document.getElementById('atp-gross-consent');
  if(c&&!c.checked){ toast('Coche la case pour enregistrer','var(--orange)'); return false; }
  currentUser.grossesse={etat,declareLe:Date.now()};
  // Une sèche EN COURS est SUSPENDUE, jamais supprimée : l'historique reste,
  // et nutrition.macros n'est pas touché. On cesse de faire évoluer les
  // chiffres, on ne les efface pas.
  if(grossesseSuspend(currentUser)){
    const ph=phaseCourante(currentUser);
    if(ph&&ph.type==='seche'&&currentUser.phase) currentUser.phase.suspendue=true;
  }
  // Drapeau NEUTRE, sans motif : le coach saura que la détection est en pause,
  // pas pourquoi. Posé sur un saveUser qui existe déjà — aucune écriture de
  // plus sur un plan Spark où chaque sauvegarde est un PUT du document entier.
  majSuspensionFatigue(currentUser);
  saveUser();
  _renderAtpGrossesse();
  try{ _renderPostPartum(); }catch(e){}
  try{ renderDossierSante(); }catch(e){}
  return true;
}
// Révocation : effacement COMPLET, aucun historique conservé. La phase
// suspendue redevient active telle qu'elle était.
function revoquerGrossesse(){
  delete currentUser.grossesse;
  if(currentUser.phase) delete currentUser.phase.suspendue;
  majSuspensionFatigue(currentUser);
  saveUser();
  _renderAtpGrossesse();
  try{ _renderPostPartum(); }catch(e){}
  try{ renderDossierSante(); }catch(e){}
  return true;
}
function accuserMessageGrossesse(){
  if(currentUser.grossesse) currentUser.grossesse.msgVu=true;
  saveUser();
  _renderAtpGrossesse();
  try{ _renderPostPartum(); }catch(e){}
  try{ renderDossierSante(); }catch(e){}
  return true;
}
// Aucun bandeau permanent : le message se lit une fois, puis disparaît. Rien
// dans l'écran ne doit laisser deviner l'état à quelqu'un qui regarde par
// dessus l'épaule.
function _renderAtpGrossesse(){
  const z=document.getElementById('atp-gross-opts');
  if(!z) return;
  const e=etatGrossesse(currentUser);
  const g=(currentUser&&currentUser.grossesse)||{};
  const msg=document.getElementById('atp-gross-msg');
  if(msg){
    const aDire=e&&!g.msgVu;
    msg.style.display=aDire?'block':'none';
    if(aDire) msg.innerHTML=
      `<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7">${escapeHtml(GROSSESSE_MSG)}</div>`
      +(e==='allaitement'
        ?`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7;margin-top:10px">${escapeHtml(GROSSESSE_MSG_ALLAITEMENT)}</div>`:'')
      +`<button onclick="accuserMessageGrossesse()" class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0;font-size:var(--fs-2xs);letter-spacing:1px">J'ai compris</button>`;
  }
  const cons=document.getElementById('atp-gross-consent-row');
  if(cons) cons.style.display=e?'none':'block';
  z.innerHTML=GROSSESSE_ETATS.map(x=>
    `<div class="obj-opt${e===x.cle?' sel':''}" onclick="declarerGrossesse('${x.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(x.lib)}</div>
    </div>`).join('')
    +(e?`<button onclick="revoquerGrossesse()" class="btn btn-outline btn-sm" style="width:100%;margin:4px 0 0;font-size:var(--fs-2xs);letter-spacing:1px;color:var(--sub)">Retirer cette déclaration</button>`:'');
}
// Le retour post-partum suit le meme rythme de rendu que la declaration
// dont il depend : declarer, revoquer et accuser passent tous par la.
function _renderAtpEtats(){
  const z=document.getElementById('atp-etats-opts');
  if(!z) return;
  z.innerHTML=ETATS_DECLARABLES.map(e=>
    `<div class="obj-opt${_atpEtats.indexOf(e.cle)>=0?' sel':''}" onclick="basculerAtpEtat('${e.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(e.lib)}</div>
    </div>`).join('');
  const bloc=document.getElementById('atp-thyroide-bloc');
  if(bloc) bloc.style.display=(_atpEtats.indexOf('thyroide')>=0)?'block':'none';
  const zt=document.getElementById('atp-thyroide-etats');
  if(zt) zt.innerHTML=THYROIDE_ETATS.map(t=>
    `<div class="obj-opt${_atpThyEtat===t.cle?' sel':''}" onclick="setAtpThyroide('${t.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(t.lib)}</div>
    </div>`).join('');
  const c=document.getElementById('atp-thyroide-trait');
  if(c) c.checked=!!_atpThyTrait;
  // Le statut hormonal n'est proposé qu'à qui il concerne.
  const bh=document.getElementById('atp-hormo-bloc');
  if(bh) bh.style.display=_hormonalApplicable(currentUser)?'block':'none';
  const zh=document.getElementById('atp-hormo-opts');
  if(zh) zh.innerHTML=STATUTS_HORMONAUX.map(x=>
    `<div class="obj-opt${_atpHormo===x.cle?' sel':''}" onclick="setAtpHormonal('${x.cle}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(x.lib)}</div>
    </div>`).join('');
  const ch=document.getElementById('atp-hormo-trait');
  if(ch) ch.checked=!!_atpHormoTrait;
}
function basculerAtpEtat(cle){
  if(!ETATS_DECLARABLES.some(e=>e.cle===cle)) return;
  const i=_atpEtats.indexOf(cle);
  if(i>=0) _atpEtats.splice(i,1); else _atpEtats.push(cle);
  _renderAtpEtats();
}
function setAtpThyroide(cle){
  _atpThyEtat=(THYROIDE_ETATS.some(x=>x.cle===cle)&&_atpThyEtat!==cle)?cle:null;
  _renderAtpEtats();
}
function _renderAtpCycle(){
  const z=document.getElementById('atp-cycle-opts');
  const carte=document.getElementById('atp-cycle-card');
  if(!z||!carte) return;
  // Visible pour qui la question concerne, ET pour quiconque a déjà une
  // réponse enregistrée : sans quoi un réglage posé ne serait plus annulable.
  const montrer=isFemale(currentUser&&currentUser.gender)||!!cycleSuiviDe(currentUser);
  carte.style.display=montrer?'block':'none';
  if(!montrer) return;
  z.innerHTML=ATP_CYCLE_OPTIONS.map(([v,titre,sous])=>
    `<div class="obj-opt${_atpCycleSuivi===v?' sel':''}" onclick="setAtpCycleSuivi('${v}')"
      role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="font-weight:800">${escapeHtml(titre)}</div>
      ${sous?`<div class="sub" style="font-size:var(--fs-xs);margin-top:4px">${escapeHtml(sous)}</div>`:''}
    </div>`).join('');
}
function setAtpCycleSuivi(v){
  _atpCycleSuivi=(CYCLE_SUIVI_VALEURS.indexOf(v)>=0)?v:null;
  _renderAtpCycle();
}
let _atpGender='';
function setAthleteGender(g){
  _atpGender=g;
  const bm=document.getElementById('atp-btn-m');
  const bf=document.getElementById('atp-btn-f');
  if(bm){bm.style.background=g==='H'?'var(--red)':'none';bm.style.borderColor=g==='H'?'var(--red)':'var(--border)';}
  if(bf){bf.style.background=g==='F'?'var(--red)':'none';bf.style.borderColor=g==='F'?'var(--red)':'var(--border)';}
}
// « NOM AFFICHE SUR MES VISUELS ». Trois choix, un pseudo s'il le veut.
let _atpVisuelNom='prenom';
function setVisuelNom(v){
  _atpVisuelNom=VISUEL_NOMS.indexOf(v)>=0?v:'prenom';
  for(const k of VISUEL_NOMS){
    const b=document.getElementById('atp-vn-'+k);
    if(!b) continue;
    const on=k===_atpVisuelNom;
    b.style.background=on?'var(--red)':'none';
    b.style.borderColor=on?'var(--red)':'var(--border)';
    b.setAttribute('aria-pressed',on?'true':'false');
  }
  const bloc=document.getElementById('atp-pseudo-bloc');
  if(bloc) bloc.style.display=_atpVisuelNom==='pseudo'?'block':'none';
  _apercuVisuelNom();
}
function _apercuVisuelNom(){
  const z=document.getElementById('atp-vn-apercu');
  if(!z||!currentUser) return;
  const essai=Object.assign({},currentUser,{visuelNom:_atpVisuelNom,
    pseudo:(document.getElementById('atp-pseudo')?.value||''),
    fname:(document.getElementById('atp-fname')?.value||currentUser.fname||'')});
  const n=nomSurVisuels(essai);
  z.textContent=n?(n+' · REPCORE'):'REPCORE';
}
function openAthleteProfile(){
  const u=currentUser;
  try{ _rendreEntreeParrainage(); }catch(e){}
  try{ _rendrePagePublique(); }catch(e){}
  const circle=document.getElementById('atp-photo-circle');
  if(circle) circle.innerHTML=u.athletePhoto?`<img src="${escapeHtml(u.athletePhoto)}" style="width:100%;height:100%;object-fit:cover">`:icon('user',36);
  const fnEl=document.getElementById('atp-fname');
  if(fnEl) fnEl.value=u.fname||'';
  const lnEl=document.getElementById('atp-lname');
  if(lnEl) lnEl.value=u.lname||'';
  const psEl=document.getElementById('atp-pseudo');
  if(psEl) psEl.value=u.pseudo||'';
  setVisuelNom(u.visuelNom||'prenom');
  // LA DATE D'ABORD. Le champ d'âge n'apparaît qu'à défaut — dossiers créés
  // par doRescue, qui ne portent pas de date de naissance.
  const bdEl=document.getElementById('atp-birthdate');
  if(bdEl) bdEl.value=u.birthdate||'';
  try{ _initBirthdateMax(); }catch(e){}
  const ageEl=document.getElementById('atp-age');
  if(ageEl) ageEl.value=u.age||'';
  const repli=document.getElementById('atp-age-repli');
  if(repli) repli.style.display=u.birthdate?'none':'block';
  const wtEl=document.getElementById('atp-weight');
  if(wtEl) wtEl.value=u.profileWeight||'';
  const pl=document.getElementById('atp-poids-lu');
  if(pl) pl.innerHTML=htmlPoidsProfil(u);
  const objEl=document.getElementById('atp-objective');
  if(objEl) objEl.value=u.objective||'';
  _atpGender=isFemale(u.gender)?'F':(u.gender?'H':'');
  setAthleteGender(_atpGender);
  _atpCycleSuivi=cycleSuiviDe(u);
  _renderAtpCycle();
  _renderAtpGrossesse();
  try{ _renderPostPartum(); }catch(e){}
  try{ renderDossierSante(); }catch(e){}
  _atpEtats=etatsDeclares(u).slice();
  const _thy=thyroideDe(u);
  _atpThyEtat=_thy.etat; _atpThyTrait=_thy.traitement;
  const _st=statutHormonal(u);
  _atpHormo=(_st==='cycles_reguliers'&&u.statutHormonal===undefined)?null:_st;
  _atpHormoTrait=!!u.traitementHormonal;
  _renderAtpPES();
  _atpFamilles=famillesTraitement(u).slice();
  _renderAtpTraitement();
  _renderAtpEtats();
  const zc=document.getElementById('atp-comptes');
  if(zc) zc.innerHTML=htmlSelecteurComptes();
  try{ _rendreMesBadges(); }catch(e){}
  go('s-athlete-profile');
}
function _appliquerCycleSuivi(u,v){
  if(!u||!v) return false;
  // Repasser à « oui » remet les compteurs à zéro : sinon une proposition
  // d'arrêt déjà faite, ou trois reports déjà comptés, condamneraient la
  // question que l'athlète vient tout juste de rouvrir.
  if(u.cycleSuivi!==v){
    u.cycleIgnoresSuite=0;
    u.cycleArretPropose=false;
    u.cycleChoixVus=0;
  }
  u.cycleSuivi=v;
  // Ne plus suivre, c'est aussi ne plus traîner la dernière phase déclarée.
  if(v!=='actif') u.currentCycle='ignore';
  return true;
}
// BUILD 1889 : depuis les Réglages, l'écriture est immédiate (pas de bouton
// « Enregistrer » sur cet écran).
function _enregistrerCycleReglages(){
  if(!_appliquerCycleSuivi(currentUser,_atpCycleSuivi)) return false;
  saveUserOuDire('ton suivi du cycle');
  try{ _rendreReglagesSections(); }catch(e){}
  return true;
}
function _enregistrerVisuelNom(){
  if(!currentUser) return false;
  currentUser.visuelNom=_atpVisuelNom;
  const _ps=(document.getElementById('atp-pseudo')?.value||'').replace(/\s+/g,' ').trim().slice(0,24);
  if(_ps) currentUser.pseudo=_ps; else delete currentUser.pseudo;
  saveUserOuDire('ton nom sur les visuels');
  return true;
}
function ouvrirTrophees(){
  go('s-trophees');
  try{ _rendreMesBadges(); }catch(e){}
  try{ _rendrePagePublique(); }catch(e){}
  try{ _rendreEntreeParrainage(); }catch(e){}
  return true;
}
function saveAthleteProfile(){
  const _fn=(document.getElementById('atp-fname')?.value||'').trim().slice(0,40);
  const _ln=(document.getElementById('atp-lname')?.value||'').trim().slice(0,40);
  if(_fn) currentUser.fname=_fn;
  if(_ln) currentUser.lname=_ln;
  // Le nom sur les visuels : le reglage, et le pseudo (vide = retire).
  currentUser.visuelNom=_atpVisuelNom;
  const _ps=(document.getElementById('atp-pseudo')?.value||'').replace(/\s+/g,' ').trim().slice(0,24);
  if(_ps) currentUser.pseudo=_ps; else delete currentUser.pseudo;
  // L'ÂGE EST DÉDUIT, JAMAIS SAISI — quand une date est disponible. C'est ce
  // qui met fin à la correction effacée au redémarrage : le boot recalcule
  // depuis `birthdate`, il retrouvera donc exactement ce qui est écrit ici.
  const _bd=(document.getElementById('atp-birthdate')?.value||'').trim();
  if(_bd){
    const _a=_ageRevolu(_bd);
    // Une date illisible ou aberrante n'écrase rien : mieux vaut garder
    // l'ancienne valeur qu'en inscrire une fausse.
    if(_a!==null&&_a>=0&&_a<=120){ currentUser.birthdate=_bd; currentUser.age=_a; }
  } else if(!currentUser.birthdate){
    // REPLI : aucune date connue, ni saisie ni enregistrée. Le champ libre
    // reste la seule source, avec son comportement d'avant.
    currentUser.age=parseInt(document.getElementById('atp-age')?.value)||undefined;
  }
  // Champ vidé alors qu'une date est enregistrée : on ne détruit rien. Effacer
  // sa date de naissance par inadvertance ferait disparaître son âge partout.
  // BUILD 1893 : plus de champ de poids au profil ; sans lui, rien n'est touché.
  const _wEl=document.getElementById('atp-weight');
  if(_wEl) currentUser.profileWeight=parseFloat(_wEl.value)||undefined;
  currentUser.gender=_atpGender||currentUser.gender;
  // Le champ « Objectif » a quitté le profil (28/09/2026 : il est demandé
  // ailleurs). Sans lui, on ne touche pas à l'objectif déjà enregistré.
  const _objEl=document.getElementById('atp-objective');
  if(_objEl) currentUser.objective=(_objEl.value||'').trim()||undefined;
  // Les états déclarés. Une liste vide EFFACE : se retirer d'une déclaration
  // doit être aussi simple que de la faire.
  // On compare AVANT d ecrire : une sauvegarde de profil qui ne touche pas
  // aux etats ne doit pas rajeunir leur date de declaration.
  const _avEtats=(etatsDeclares(currentUser)||[]).slice().sort().join(',');
  const _avThy=((currentUser.thyroide||{}).etat)||'';
  const _avHormo=currentUser.statutHormonal||'';
  currentUser.etatsSante=_atpEtats.slice();
  if(_atpEtats.indexOf('thyroide')>=0){
    const c=document.getElementById('atp-thyroide-trait');
    currentUser.thyroide={etat:_atpThyEtat||undefined,
      traitement:c?!!c.checked:!!_atpThyTrait};
  } else {
    delete currentUser.thyroide;
  }
  // Le statut hormonal. Aucun choix = on retire la déclaration.
  if(_atpHormo) currentUser.statutHormonal=_atpHormo;
  else delete currentUser.statutHormonal;
  try{
    const _apEtats=(etatsDeclares(currentUser)||[]).slice().sort().join(',');
    if(_apEtats!==_avEtats)
      marquerDeclaration(currentUser,'etats',_apEtats,_apEtats?'declare':'retire');
    const _apThy=((currentUser.thyroide||{}).etat)||'';
    if(_apThy!==_avThy)
      marquerDeclaration(currentUser,'traitement',_apThy,_apThy?'declare':'retire');
    const _apHormo=currentUser.statutHormonal||'';
    if(_apHormo!==_avHormo)
      marquerDeclaration(currentUser,'statutHormonal',_apHormo,_apHormo?'declare':'retire');
  }catch(e){}
  const _ch=document.getElementById('atp-hormo-trait');
  if(_atpHormo&&_ch&&_ch.checked) currentUser.traitementHormonal=true;
  else delete currentUser.traitementHormonal;
  _appliquerCycleSuivi(currentUser,_atpCycleSuivi);
  toastEcriture(saveUser(),'Profil enregistré '+ICO.coche,'ton profil est');
  go('s-client-home');
  loadClientHome();
}
function _renderCoachPhonePreview(raw){
  const digits=_numWa(raw);
  const el=document.getElementById('coach-phone-preview');
  if(!el) return;
  // L'aperçu servait de confirmation : il affichait wa.me/0612345678 comme si
  // le lien marchait. Un numéro sans indicatif est maintenant signalé comme tel.
  if(!digits){
    el.innerHTML=(raw||'').trim()
      ?'<span style="color:var(--orange)">Numéro sans indicatif pays : WhatsApp le refusera. Écris-le sous la forme +33612345678.</span>':'';
    return;
  }
  // « tes athlètes verront ce bouton » était FAUX depuis ce lot : sans
  // consentement, personne ne le voit. L'aperçu montre le lien, et l'état
  // réel est dit juste en dessous par _renderContactCoach.
  el.innerHTML='→ Lien : <a href="https://wa.me/'+digits+'" target="_blank" rel="noopener" style="color:var(--green);text-decoration:none">wa.me/'+digits+'</a>';
}
async function _cloudinaryUpload(file){
  const folder='repcore/'+(currentUser.id||currentUser.email);
  const type=/^audio\//.test(String(file&&file.type||''))?'audio':'video';
  const sig=await _cloudinarySigner(folder,type);
  const fd=new FormData();
  fd.append('file',file);
  _champsDansFormData(fd,sig.champs);
  const res=await fetch(sig.url,{method:'POST',body:fd});
  if(!res.ok) throw new Error('Erreur serveur '+res.status);
  const data=await res.json();
  if(data.error) throw new Error(data.error.message);
  try{ rcq('cld_envois',1); rcqOctets('cld_ko',(file&&file.size)||Number(data.bytes)||0); }catch(e){}
  return data.secure_url;
}
function saveCloudinaryConfig(){
  const name=(document.getElementById('cld-cloud-name')?.value||'').trim();
  const preset=(document.getElementById('cld-preset')?.value||'').trim();
  if(!name||!preset){toast('Renseigne les deux champs','var(--orange)');return;}
  currentUser.cloudinaryName=name;
  currentUser.cloudinaryPreset=preset;
  toastEcriture(saveUser(),'Configuration vidéo enregistrée '+ICO.coche,'la configuration est');
}
// ══ L'ACCES DES ATHLETES, ET LA RELANCE ══════════════════════════════════
//
// LE LIEN QUE LE COACH ENVOIE. L'athlete ouvre l'app, va dans « Abonnement »
// et paie ses 9,50 € par mois. On n'envoie pas vers une page de paiement
// exterieure : le paiement vit dans l'application, et un lien qui court-
// circuite l'app enverrait l'athlete sur un ecran qui ne connait pas son
// compte.
// ⚠ CONSTRUIT DEPUIS L'ORIGINE, JAMAIS ECRIT EN DUR. Un domaine litteral dans
// la source doit etre declare dans privacy.html — c'est la regle du depot, et
// une assertion la tient. Or ce lien ne vise aucun tiers : il vise l'app
// elle-meme, la ou elle est servie. Le deduire de location.origin le fait
// suivre l'hebergement sans qu'on y repense, et le garde des domaines reste
// strict pour ce qu'il surveille vraiment — les appels sortants.
// Le repli sert au cas ou l'application tourne depuis un fichier local.
function lienAbonnement(){
  try{
    const o=String(location.origin||'');
    if(/^https?:/.test(o)) return o+'/app/';
  }catch(e){}
  return '/app/';
}
// ⚠ IL ANNONCAIT 9,50 PENDANT QUE PAYPAL ENCAISSAIT 9,95 (corrige au lot 1).
//   Un prix ecrit en dur finit toujours par diverger de celui qu'on facture :
//   celui-ci vient d'OFFRES, comme tous les autres.
const PRIX_ATHLETE_MOIS=prixOffre('essentielle');
// Quinze jours : assez tot pour relancer sans harceler, assez tard pour que la
// relance parle d'une echeance que l'athlete a en tete.
const RELANCE_JOURS=15;
// PURE. L'etat d'acces d'un athlete, et dans combien de jours il tombe.
// Rend {cle, libelle, jours, couleur, relancable}.
function etatAccesAthlete(c,maintenant){
  const now=maintenant||Date.now();
  if(!c||c._fromCode) return {cle:'invite',libelle:'Invitation non utilisée',jours:null,
    couleur:'var(--sub)',relancable:false};
  if(c.paymentStatus==='active') return {cle:'paye',libelle:'Abonné',jours:null,
    couleur:'var(--green)',relancable:false};
  const fin=Number(c.accessExpiry)||0;
  if(!fin) return {cle:'sansfin',libelle:'Accès sans échéance',jours:null,
    couleur:'var(--sub)',relancable:false};
  const j=Math.ceil((fin-now)/864e5);
  if(j<0) return {cle:'expire',libelle:'Accès expiré',jours:j,
    couleur:'var(--red-light)',relancable:true};
  if(j<=RELANCE_JOURS) return {cle:'bientot',libelle:'Expire dans '+j+' jour'+(j>1?'s':''),
    jours:j,couleur:'var(--orange)',relancable:true};
  return {cle:'ok',libelle:'Actif, '+j+' jours restants',jours:j,couleur:'var(--green)',
    relancable:false};
}
// PURE. Le message de relance, pret a coller. Ecrit au tutoiement, comme tout
// le reste de l'application.
function messageRelanceAcces(c,etat){
  const p=(c&&c.fname)?String(c.fname).trim():'';
  const fin=Number(c&&c.accessExpiry)||0;
  const d=fin?new Date(fin).toLocaleDateString('fr-FR'):'';
  const quand=(etat&&etat.cle==='expire')
    ?('Ton accès à RepCore a expiré'+(d?(' le '+d):'')+'.')
    :('Ton accès à RepCore se termine'+(d?(' le '+d):' bientôt')+'.');
  return (p?('Salut '+p+' ! '):'Salut ! ')+quand
    +' Pour continuer, ouvre l\'app et prends l\'abonnement à '+PRIX_ATHLETE_MOIS
    +' par mois (engagement '+TARIFS.engagementMois+' mois) : '+lienAbonnement()
    +'. Dis-moi si tu as le moindre souci, je m\'en occupe.';
}
// Ouvre WhatsApp avec le message pre-rempli. ⚠ REPCORE N'ENVOIE RIEN : il
// ouvre la conversation, c'est le coach qui appuie sur envoyer. Meme regle que
// le message groupe et que le carnet d'adresses.
function relancerAccesAthlete(id){
  const c=getClients().find(x=>x&&String(x.id)===String(id));
  if(!c){ toast('Athlète introuvable.','var(--orange)'); return false; }
  const tel=String(c.phone||'').replace(/[^0-9]/g,'');
  const msg=messageRelanceAcces(c,etatAccesAthlete(c));
  if(!tel){
    // Pas de numero : on ne fait pas semblant. Le message est copie, le coach
    // l'envoie par le canal qu'il veut.
    // La copie est ATTENDUE : « message copié » ne s'annonce que s'il l'est.
    _rcCopierOuMontrer(msg,'Pas de numéro : message copié.','Pas de numéro pour '+(c.fname||'cet athlète')+'. Copie ce message :');
    return false;
  }
  window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank','noopener');
  return true;
}
// ── LE CRÉATEUR AGIT DEPUIS LA LISTE, LES AUTRES COACHS NON ──────────────
// La règle n'accorde l'écriture de droits/ qu'à une adresse. Un bouton qui
// échouerait chez les autres coachs serait pire que pas de bouton : il leur
// ferait croire qu'ils ont fermé un accès qui reste ouvert.
function _htmlAccesPose(c){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL) return '';
  const d=(()=>{ try{ return droitsDe(c); }catch(e){ return null; } })();
  if(!d||d.etat!=='serveur') return '';
  const e=accesEtatPhrase(d);
  return '<div style="font-size:var(--fs-2xs);color:'+e.couleur+';font-weight:700;margin-top:2px">'
    +'Posé à la main : '+escapeHtml(e.phrase)+(e.verifier?' · à vérifier':'')+'</div>';
}
function _htmlAccesBoutons(c){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL) return '';
  const mail=String((c&&c.email)||'');
  if(!mail||mail.indexOf('@')<0) return '';
  const d=(()=>{ try{ return droitsDe(c); }catch(e){ return null; } })();
  const ferme=!!(d&&d.etat==='serveur'&&String(d.palier||'aucun')==='aucun');
  const st='margin:0;letter-spacing:1px;font-size:var(--fs-2xs);padding:8px 12px;min-height:34px';
  const arg='&#39;'+escapeHtml(mail)+'&#39;';
  // `avant:'suivi'` : ce qui était ouvert quand rien n'est posé. Sans lui,
  // rouvrir un athlète suivi lui aurait rendu « Essentielle ».
  return ferme
    ?'<button class="btn btn-red btn-sm" style="'+st+'" onclick="accesRouvrir('+arg+')">Rouvrir</button>'
    :'<button class="btn btn-outline btn-sm" style="'+st+'" onclick="accesSuspendre('+arg+',{avant:&#39;suivi&#39;})">Fermer</button>';
}
function _rendreAccesAthletes(){
  const z=document.getElementById('mon-acces-athletes');
  if(!z) return false;
  const l=getClients().filter(c=>c&&!c._fromCode);
  if(!l.length){ z.innerHTML=''; return false; }
  const now=Date.now();
  // LES ECHEANCES D'ABORD : expires en tete, puis ceux qui approchent, puis le
  // reste. C'est l'ordre dans lequel le coach a quelque chose a faire.
  const rang={expire:0,bientot:1,sansfin:2,ok:3,paye:4,invite:5};
  const avec=l.map(c=>({c,e:etatAccesAthlete(c,now)}))
    .sort((a,b)=>(rang[a.e.cle]-rang[b.e.cle])
      ||((a.e.jours==null?9e9:a.e.jours)-(b.e.jours==null?9e9:b.e.jours))
      ||String(a.c.fname||'').localeCompare(String(b.c.fname||'')));
  const aRelancer=avec.filter(x=>x.e.relancable).length;
  z.innerHTML='<div style="display:flex;align-items:center;gap:10px;margin:28px 0 12px">'
    +'<div style="width:20px;height:2px;background:var(--red);flex-shrink:0"></div>'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:var(--fs-xs);letter-spacing:3px;font-weight:800;text-transform:uppercase;color:var(--red-text)">Accès de mes athlètes</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);margin-top:2px">'
    +(aRelancer?(aRelancer+' à relancer'):'Personne à relancer')
    +' · abonnement athlète : '+PRIX_ATHLETE_MOIS+' par mois</div></div></div>'
    +avec.map(({c,e})=>{
      const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Sans nom';
      const fin=Number(c.accessExpiry)||0;
      const d=fin?new Date(fin).toLocaleDateString('fr-FR'):'';
      return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;'
        +'padding:10px 12px;background:var(--surface-1);border:1px solid var(--border);'
        +'border-radius:var(--r-3);margin-bottom:8px">'
        +'<div style="flex:1;min-width:120px">'
        +'<div style="font-weight:800;font-size:var(--fs-sm)">'+escapeHtml(nom)+'</div>'
        +'<div style="font-size:var(--fs-2xs);color:'+e.couleur+';font-weight:800;margin-top:2px">'
        +escapeHtml(e.libelle)+(d?'<span class="sub" style="font-weight:600"> · '+escapeHtml(d)+'</span>':'')
        +'</div>'+_htmlAccesPose(c)+'</div>'
        +(e.relancable
          ?'<button class="btn btn-red btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs);padding:8px 14px;min-height:34px" '
            +'onclick="relancerAccesAthlete(\''+escapeHtml(String(c.id||''))+'\')">Relancer</button>'
          :'')
        +_htmlAccesBoutons(c)
        +'</div>';
    }).join('');
  return true;
}
function loadMonetisationTab(){
  try{ _rendreAccesAthletes(); }catch(e){}
  // N'ecrase JAMAIS un champ que le coach est en train de remplir. Le
  // rafraichissement periodique rappelle cette fonction : sans ce garde, un
  // numero tape lentement etait remis a sa valeur enregistree a chaque reveil.
  // `dirty` survit a la perte de focus : un champ modifie puis quitte sans
  // enregistrer garde la saisie de l'utilisateur, qui prime sur le stocke.
  const setIf=(el,v)=>{
    if(!el) return;
    if(el===document.activeElement) return;
    if(el.dataset.dirty) return;
    el.value=v;
  };
  const suivre=(el)=>{
    if(!el||el.dataset.suivi) return;
    el.dataset.suivi='1';
    el.addEventListener('input',()=>{el.dataset.dirty='1';});
  };
  updateCloudStatus();
  _renderAbonnementCoach();
  const u=currentUser;
  // Identité coach
  const photoCircle=document.getElementById('coach-photo-circle');
  if(photoCircle) photoCircle.innerHTML=u.coachPhoto?`<img src="${escapeHtml(u.coachPhoto)}" style="width:100%;height:100%;object-fit:cover">`:icon('user',28);
  const teamNameEl=document.getElementById('coach-team-name');
  setIf(teamNameEl,u.teamName||'');suivre(teamNameEl);
  const catchEl=document.getElementById('coach-catchphrase');
  setIf(catchEl,u.catchphrase||'');suivre(catchEl);
  ['coach-bio:bio','coach-vision:vision','coach-specialites:specialites'].forEach(paire=>{
    const [id,champ]=paire.split(':');
    const el=document.getElementById(id);
    if(el){ setIf(el,u[champ]||''); suivre(el); }
  });
  Object.keys(_IMG_VITRINE).forEach(id=>_apercuVitrine(id,u[_IMG_VITRINE[id][0]]||''));
  try{ _rendreLienVitrineCoach(); }catch(e){}
  try{ _rendreReglagesProspects(); }catch(e){}
  // LOT M1 : la marque, réservée au palier Pro.
  try{ _mqEd=null; renderMarqueCoach(); }catch(e){}
  const _dz=document.getElementById('coach-diplomes-liste');
  if(_dz){ _dz.innerHTML=''; (u.diplomes||[]).forEach(d=>ajouterDiplomeRow(d&&d.titre,d&&d.image)); }
  _chargerDispoCoach(u);
  const bannerList=document.getElementById('coach-banners-list');
  if(bannerList){bannerList.innerHTML='';(u.promoBanners||[]).forEach(b=>addCoachBannerRow(b.imageUrl,b.linkUrl));}
  const phoneInput=document.getElementById('coach-phone-input');
  setIf(phoneInput,u.phone||'');suivre(phoneInput);
  _renderCoachPhonePreview(u.phone||'');
  _renderContactCoach();
  const cldName=document.getElementById('cld-cloud-name');
  const cldPreset=document.getElementById('cld-preset');
  setIf(cldName,u.cloudinaryName||'');suivre(cldName);
  setIf(cldPreset,u.cloudinaryPreset||'');suivre(cldPreset);
  const isCreator=u.email===CREATOR_EMAIL;
  const users=DB.get('users')||{};
  // ══ LES CHIFFRES DU CRÉATEUR VIENNENT DU SERVEUR (02/10/2026) ══════════
  // Ils étaient recalculés ici depuis le cache de l'appareil : un abonné à
  // l'ancien tarif comptait au nouveau, un annuel pour un mois plein, un
  // résilié tant que son dossier disait « active ». Le serveur léger les
  // calcule chaque jour (metier.js, indicateurs) et les écrit dans
  // indicateurs/<jour>, que le créateur seul peut lire. Plus aucun calcul ici.
  // Un coach tiers ne voit que sa formule et son quota.
  const _bloc=document.getElementById('pp-bloc'), _coach=document.getElementById('pp-coach');
  if(_bloc) _bloc.style.display=isCreator?'':'none';
  if(_coach) _coach.innerHTML=isCreator?'':htmlFormuleCoach(u,users);
  if(isCreator) _chargerIndicateurs();
  // LA LISTE (créateur seul) : les dossiers synchronisés sur cet appareil, à
  // titre de liste. Les CHIFFRES, eux, sont ceux du serveur, juste au-dessus.
  const el=document.getElementById('pp-subs-list');
  if(el&&isCreator){
    const subs=Object.values(users).filter(x=>x&&x.status==='AUTONOMIE_PREMIUM');
    el.innerHTML=!subs.length
      ?emptyState('user','Aucun abonné sur cet appareil pour l\'instant. Ils apparaissent ici dès leur premier paiement.')
      :subs.map(s=>{
        const st=s.paymentStatus==='active'?'<span class="badge badge-green">Actif</span>':'<span class="badge badge-red">'+escapeHtml(s.paymentStatus||'Inactif')+'</span>';
        const coachInfo=s.coachName?'<div class="sub" style="font-size:var(--fs-xs)">Coach : '+escapeHtml(s.coachName)+'</div>':'';
        const _snm=((s.fname||'')+' '+(s.lname||'')).trim()||'';
        return '<div class="client-row"><div class="avatar" style="width:36px;height:36px;font-size:var(--fs-md)">'+ini(s.fname,s.lname)+'</div><div style="flex:1"><div style="font-weight:700">'+escapeHtml(_snm)+'</div>'+coachInfo+'<div class="sub" style="font-size:var(--fs-xs);font-family:monospace">'+escapeHtml(s.paypalSubscriptionId||'no sub id')+'</div></div><div>'+st+'<button onclick="toggleSubStatus(\''+escapeHtml(s.email)+'\')" style="margin-top:4px;font-size:var(--fs-xs);background:none;border:1px solid var(--border);color:var(--sub);border-radius:var(--r-2);padding:4px 8px;cursor:pointer;font-family:Montserrat,sans-serif">'+(s.paymentStatus==='active'?'Suspendre':'Activer')+'</button></div></div>';
      }).join('');
  }
  // Section admin offboarding — visible créateur seulement
  // LE LIEN VERS L'ÉCRAN « Accès ». Créateur seulement : lui seul peut écrire
  // droits/, et un lien qui mène à un écran qui refuse ne vaut pas mieux que
  // pas de lien du tout.
  const _lienAcces=document.getElementById('ch-lien-acces');
  if(_lienAcces) _lienAcces.style.display=isCreator?'block':'none';
  const adminSection=document.getElementById('coach-admin-offboard');
  const adminSel=document.getElementById('admin-offboard-select');
  if(adminSection&&adminSel){
    if(isCreator){
      adminSection.style.display='block';
      const coaches=Object.values(users).filter(c=>c.role==='coach'&&c.email!==CREATOR_EMAIL);
      adminSel.innerHTML='<option value=""> - Sélectionne un coach - </option>'+coaches.map(c=>{
        const n=Object.values(users).filter(a=>a.coachId===c.id).length;
        return '<option value="'+c.id+'">'+escapeHtml((c.fname||'')+' '+(c.lname||''))
          +' ('+n+' athlète'+(n>1?'s':'')+')</option>';
      }).join('');
    }else{
      adminSection.style.display='none';
    }
  }
}

// ══ LES INDICATEURS, LUS (créateur seul) ══════════════════════════════════
let _indicateursCache=null;
async function _chargerIndicateurs(){
  const z=document.getElementById('pp-indicateurs');
  if(_indicateursCache) rendreIndicateurs(_indicateursCache);
  else if(z) z.innerHTML='<div class="sub" style="font-size:var(--fs-xs)">Chargement des indicateurs…</div>';
  try{ _indicateursCache=await CLOUD.indicateurs(); }catch(e){ if(!_indicateursCache&&z) z.innerHTML='<div class="sub" style="font-size:var(--fs-xs)">Indicateurs illisibles pour l’instant.</div>'; return false; }
  rendreIndicateurs(_indicateursCache);
  return true;
}
// PURE. Le dernier jour, et la courbe : le dernier relevé de chacun des douze
// derniers mois, du plus ancien au plus récent.
function indicateursPoints(tous){
  const jours=Object.keys(tous||{}).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&tous[k]&&typeof tous[k]==='object').sort();
  if(!jours.length) return {dernier:null,jour:'',courbe:[]};
  const parMois={};
  for(const j of jours) parMois[j.slice(0,7)]=j;
  const courbe=Object.keys(parMois).sort().slice(-12).map(m=>({mois:m,mrr:Number(tous[parMois[m]].mrrTTC)||0}));
  const jour=jours[jours.length-1];
  return {dernier:tous[jour],jour,courbe};
}
// PURE. Le bloc des indicateurs : la ventilation, les taux, la courbe.
function htmlIndicateurs(pts){
  if(!pts||!pts.dernier) return '<div class="sub" style="font-size:var(--fs-xs)">Pas encore d’indicateurs : le serveur les écrit chaque matin.</div>';
  const d=pts.dernier, f=d.mrrParFormule||{};
  const pc=(x)=>(x===null||x===undefined)?'–':String(x).replace('.',',')+' %';
  const eu=(x)=>(x===null||x===undefined)?'–':_euros(Number(x)||0);
  const l=(t,v)=>'<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">'
    +'<span style="color:var(--sub)">'+escapeHtml(t)+'</span><span style="color:var(--text)">'+escapeHtml(v)+'</span></div>';
  const max=Math.max(1,...pts.courbe.map(p=>p.mrr));
  const W=300,H=60,n=pts.courbe.length;
  const xy=pts.courbe.map((p,i)=>[(n>1?i*(W/(n-1)):W/2),H-4-(p.mrr/max)*(H-8)]);
  const svg=n?'<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="MRR sur douze mois" style="display:block;margin:8px 0">'
    +'<polyline fill="none" stroke="var(--green)" stroke-width="2" points="'+xy.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')+'"/>'
    +xy.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.5" fill="var(--green)"/>').join('')+'</svg>'
    +'<div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);color:var(--sub)"><span>'+escapeHtml(pts.courbe[0].mois)+'</span><span>'+escapeHtml(pts.courbe[n-1].mois)+'</span></div>':'';
  return '<div id="pp-ind" style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:14px 16px;margin-bottom:20px">'
    +'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:6px">Au '+escapeHtml(pts.jour)+', calculé par le serveur</div>'
    +l('Essentielle',eu(f.essentielle))+l('Ultime',eu(f.ultime))+l('Coach',eu(f.coach))+l('Pro',eu(f.pro))
    +l('Churn du mois',pc(d.churnMois))+l('Conversion de l’essai',pc(d.conversionEssai))
    +l('Part en annuel',pc(d.partAnnuel))+l('Revenu par coach',eu(d.revenuParCoach))+l('Remboursé ce mois',eu(d.remboursesMois))
    +svg+'</div>';
}
function rendreIndicateurs(tous){
  const pts=indicateursPoints(tous), d=pts.dernier;
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('pp-total-subs',d?String(Number(d.abonnesActifs)||0):'–');
  set('pp-mrr',d?_euros(Number(d.mrrTTC)||0):'–');
  set('pp-cancelled',d?String(Number(d.resiliesEnCours)||0):'–');
  const z=document.getElementById('pp-indicateurs');
  if(z) z.innerHTML=htmlIndicateurs(pts);
  return pts;
}
// PURE. Ce qu'un coach tiers voit à la place : sa formule et son quota.
function htmlFormuleCoach(u,users){
  const cle=coachPlanDe(u), pal=COACH_PALIERS.find(x=>x.cle===cle)||COACH_PALIERS[0];
  const fiable=countActiveAthletesFiable(u,users);
  const quota=getCoachQuota(cle);
  return '<div id="pp-coach-formule" class="sub" style="font-size:var(--fs-sm);margin-bottom:20px">Ta formule : <b>'+escapeHtml(pal.titre)+'</b>, '
    +escapeHtml(fiable?(countActiveAthletes(u,users)+' / '+_quotaTexte(quota)+' athlètes actifs'):'quota en cours de synchronisation')+'.</div>';
}

async function toggleSubStatus(email){
  const users=DB.get('users')||{};
  const u=users[email];
  if(!u){toast('Élève introuvable','var(--orange)');return;}
  // Vérification d'appartenance côté client (defense-in-depth).
  // Le créateur voit tous les abonnés ; les coachs sont limités à leurs propres élèves.
  const isCreator=currentUser?.email===CREATOR_EMAIL;
  if(!isCreator&&!getOwnedClient(u.id,users)) return; // getOwnedClient affiche le toast
  if(u.paymentStatus==='active'&&!await rcConfirm('Suspendre l\'abonnement de '+u.fname+' ? Il perdra l\'accès immédiatement.',null,'Confirmer')) return;
  u.paymentStatus=u.paymentStatus==='active'?'cancelled':'active';
  u.updatedAt=Date.now();
  users[email]=u;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(email,u),u.fname+' : '+u.paymentStatus,'le statut est');
  loadMonetisationTab();
}

// ── Offboarding & suppression de compte coach (RGPD Art. 17) ─────────────────
function offboardCoach(coachId){
  if(!coachId) return;
  document.getElementById('modal-overlay')?.remove();
  const users=DB.get('users')||{};
  const coach=Object.values(users).find(u=>u.id===coachId);
  if(!coach){toast('Coach introuvable','var(--orange)');return;}
  const athletes=Object.values(users).filter(u=>u.coachId===coachId&&u.role!=='coach');
  const creator=Object.values(users).find(u=>u.email===CREATOR_EMAIL);
  const isCreatorSelf=coach.email===CREATOR_EMAIL;
  const otherCoaches=Object.values(users).filter(u=>u.role==='coach'&&u.id!==coachId&&u.email!==CREATOR_EMAIL);
  if(!athletes.length){
    toast('Aucun athlète rattaché à ce coach.','var(--sub)');
    return;
  }
  const athListHtml=athletes.slice(0,10).map(a=>
    '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--surface-2);font-size:var(--fs-sm)">'
    +'<div style="width:26px;height:26px;border-radius:var(--r-full);background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:700;flex-shrink:0">'+((a.fname||'?')[0]).toUpperCase()+'</div>'
    +'<div style="flex:1">'+escapeHtml((a.fname||'')+' '+(a.lname||''))+'</div></div>'
  ).join('')+(athletes.length>10?'<div style="font-size:var(--fs-xs);color:var(--sub);padding:6px 0">… et '+(athletes.length-10)+' autre(s)</div>':'');
  const coachOptsHtml=otherCoaches.map(c=>
    '<option value="'+c.id+'">'+escapeHtml((c.fname||'')+' '+(c.lname||'')+' : '+(c.email||''))+'</option>'
  ).join('');
  const reassignBlock=otherCoaches.length
    ?'<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);cursor:pointer">'
      +'<input type="radio" name="ob-action" value="reassign" checked style="margin-top:4px;flex-shrink:0">'
      +'<div style="width:100%"><div style="font-weight:700;font-size:var(--fs-sm)">Réassigner à un autre coach</div>'
      +'<select id="ob-target" style="margin-top:8px;width:100%;padding:10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-size:var(--fs-sm);font-family:Montserrat,sans-serif">'+coachOptsHtml+'</select>'
      +'</div></label>'
    :'';
  const creatorBlock=(!isCreatorSelf&&creator)
    ?'<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);cursor:pointer">'
      +'<input type="radio" name="ob-action" value="creator" '+(otherCoaches.length?'':'checked')+' style="margin-top:4px;flex-shrink:0">'
      +'<div><div style="font-weight:700;font-size:var(--fs-sm)">Transférer au créateur</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">'+escapeHtml((creator.fname||'')+' '+(creator.lname||''))+' · '+CREATOR_EMAIL+'</div></div></label>'
    :'';
  const freeBlock='<label style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);cursor:pointer">'
    +'<input type="radio" name="ob-action" value="free" '+((!otherCoaches.length&&isCreatorSelf)?'checked':'')+' style="margin-top:4px;flex-shrink:0">'
    +'<div><div style="font-weight:700;font-size:var(--fs-sm)">Libérer (sans coach assigné)</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">Les athlètes conservent leur compte mais n\'ont plus de coach</div></div></label>';
  const ov=document.createElement('div');
  ov.id='modal-overlay';ov.onclick=closeModal;
  ov.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML='<div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-sizing:border-box">'
    +'<div style="width:40px;height:4px;background:var(--surface-3);border-radius:var(--r-1);margin:0 auto 20px"></div>'
    +'<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:3px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Réassignation des athlètes</div>'
    +'<div style="font-size:var(--fs-lg);font-weight:800;margin-bottom:4px">'+escapeHtml((coach.fname||'')+' '+(coach.lname||''))+'</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--sub);margin-bottom:14px">'+athletes.length+' athlète'+(athletes.length>1?'s':'')+' à traiter avant désactivation</div>'
    +'<div style="background:var(--surface-1);border-radius:var(--r-2);padding:8px 10px;margin-bottom:16px;max-height:140px;overflow-y:auto">'+athListHtml+'</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">'+reassignBlock+creatorBlock+freeBlock+'</div>'
    +'<div style="display:flex;gap:10px">'
    +'<button onclick="closeModal()" style="flex:1;background:none;border:1px solid var(--border);border-radius:var(--r-2);padding:12px;color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;font-weight:700">Annuler</button>'
    +'<button onclick="executeOffboard(\''+coachId+'\')" style="flex:2;background:var(--red);border:none;border-radius:var(--r-2);padding:12px;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;letter-spacing:1px">RÉASSIGNER '+athletes.length+' ATHLÈTE'+(athletes.length>1?'S':'')+' →</button>'
    +'</div></div>';
  document.body.appendChild(ov);
}

function executeOffboard(coachId){
  const action=document.querySelector('input[name="ob-action"]:checked')?.value;
  if(!action){toast('Choisis une option','var(--orange)');return;}
  const users=DB.get('users')||{};
  const athletes=Object.values(users).filter(u=>u.coachId===coachId&&u.role!=='coach');
  if(!athletes.length){closeModal();toast('Aucun athlète à réassigner.','var(--sub)');return;}
  let targetId=null,targetName='';
  if(action==='reassign'){
    targetId=document.getElementById('ob-target')?.value;
    if(!targetId){toast('Sélectionne un coach cible','var(--orange)');return;}
    const tc=Object.values(users).find(u=>u.id===targetId);
    if(!tc){toast('Coach cible introuvable','var(--orange)');return;}
    targetName=(tc.fname||'')+' '+(tc.lname||'');
  }else if(action==='creator'){
    const cr=Object.values(users).find(u=>u.email===CREATOR_EMAIL);
    if(!cr){toast('Compte créateur introuvable','var(--orange)');return;}
    targetId=cr.id;targetName=(cr.fname||'')+' '+(cr.lname||'');
  }
  // action==='free' → targetId reste null
  const envois=[];
  athletes.forEach(a=>{
    a.coachId=targetId;
    a.coachName=targetId?targetName:null;
    a.coachCode=targetId?a.coachCode||null:null;
    a.updatedAt=Date.now();
    users[a.email]=a;
    envois.push(CLOUD.pushOne(a.email,a));
  });
  const ok=DB.set('users',users);
  const label=action==='free'?'libérés':'transférés vers '+(targetName.trim()||'le créateur');
  closeModal();
  // Un transfert non synchronisé laisse l'ancien coach avec ses droits d'accès
  // côté serveur : l'annoncer fait n'est pas anodin.
  toastSync(ok,Promise.all(envois),
    athletes.length+' athlète'+(athletes.length>1?'s':'')+' '+label+' '+ICO.coche,'le transfert est');
}

// ── Portabilité RGPD (art. 20) : un bouton, un fichier ─────────────────────
// Le dossier EXACT tel qu'il est stocké, moins les secrets d'authentification.
// On part d'une COPIE : delete sur le dossier vivant effacerait le mot de passe
// du compte en mémoire, et la prochaine écriture le propagerait au cloud.
//
// Les photos de bilan ne vivent PAS dans le dossier : elles sont en localStorage
// sous rc_photo_<date>_<champ>, précisément pour ne jamais partir en base. Un
// export qui les oublierait rendrait un dossier amputé de ce que l'athlète
// considère comme le plus personnel.
// LE LIEN DU PIED DU PROFIL : on dit ce que contient le fichier, puis on
// l'exporte. Rien ne part tant que la personne n'a pas confirmé.
async function exporterMesDonneesConfirme(){
  const ok=await rcConfirm('EXPORTER MES DONNÉES ?\n\n'
    +'RGPD (Art. 20) : tu récupères l’intégralité de ton dossier dans un fichier JSON : '
    +'bilans, séances, nutrition, mensurations et photos. Les mots de passe en sont exclus.',null,'Exporter');
  if(!ok) return false;
  exportMyData();
  return true;
}
function exportMyData(){
  try{
    const src=(DB.get('users')||{})[currentUser.email];
    if(!src){ toast('Aucune donnée à exporter.','var(--orange)'); return; }
    const u=JSON.parse(JSON.stringify(src));
    // Secrets d'authentification : ils ne sont pas des données personnelles
    // portables, et les écrire dans un fichier que l'athlète va transmettre
    // serait leur faire courir un risque qu'il ne mesure pas.
    delete u.pwd; delete u.pwdHash; delete u.password;
    // Les photos, rattachées à leur date et à leur champ.
    const photos={};
    try{
      Object.keys(localStorage).filter(k=>k.indexOf('rc_photo_')===0).forEach(k=>{
        const v=localStorage.getItem(k);
        if(v) photos[k.slice('rc_photo_'.length)]=v;
      });
    }catch(e){}
    if(Object.keys(photos).length) u.photosBilan=photos;
    // De quoi relire le fichier dans six mois sans deviner d'où il vient.
    u._export={version:1,date:new Date().toISOString(),source:'RepCore',
      note:'Export personnel RGPD art. 20. Les mots de passe en sont exclus.'};
    const blob=new Blob([JSON.stringify(u,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='repcore-mes-donnees-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Révocation DIFFÉRÉE : révoquer dans la foulée du clic annule le
    // téléchargement sur plusieurs navigateurs, qui n'ont pas encore lu le blob.
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} },4000);
    toast('Export prêt : ' + a.download);
  }catch(e){
    toast('Export impossible : '+(e&&e.message||'erreur'),'var(--red)');
  }
}
// LA SANTÉ SYNCHRONISÉE, À LA SUPPRESSION DU COMPTE. Le serveur révoque le
// jeton : il efface sante_sync/<clé> ET les entrées de sante_jetons qui
// pointent vers ce compte (l'empreinte y porte la clé). Puis l'app efface
// elle-même sante_sync/<clé> (les règles l'y autorisent, nœud entier) : si
// le serveur était injoignable, le jeton meurt quand même, et l'entrée
// orpheline est nettoyée à la prochaine révocation. Rend {revoque, efface}.
async function _supprimerSanteSync(safeKey,fbTok){
  const r={revoque:false,efface:false};
  try{ await CLOUD._callFn('santeJeton',{action:'revoquer'}); r.revoque=true; }catch(e){}
  try{
    const x=await fetch(CLOUD._fbUrl.replace('users.json','sante_sync/'+safeKey+'.json')+(fbTok?'?auth='+fbTok:''),{method:'DELETE'});
    r.efface=!!(x&&x.ok);
  }catch(e){}
  return r;
}
async function requestAccountDeletion(){
  // L'article 17 vaut pour TOUT LE MONDE. Le garde d'origine reservait la
  // suppression aux coachs : un athlete ne pouvait pas faire effacer son
  // poids, ses mensurations, ses photos, son cycle ni ses analyses depuis
  // l'application — alors que ce sont precisement les donnees les plus
  // sensibles qu'il y depose.
  if(!currentUser) return;
  const users=DB.get('users')||{};
  // La reassignation ne concerne QUE le coach : lui seul a des athletes
  // rattaches, et les laisser sans coach serait pire que de refuser la
  // suppression. Chez un athlete le filtre ne rendrait rien de toute facon,
  // mais le dire explicitement vaut mieux que de compter sur un tableau vide.
  if(currentUser.role==='coach'){
    const remaining=Object.values(users).filter(u=>u.coachId===currentUser.id&&u.role!=='coach');
    if(remaining.length>0){
      toast(remaining.length+' athlète'+(remaining.length>1?'s':'')+' encore rattaché'+(remaining.length>1?'s':'')+' : réassigne-les d\'abord','var(--orange)');
      offboardCoach(currentUser.id);
      return;
    }
  }
  // L'ATHLÈTE LIT CE QU'IL PERD, données de santé comprises : le texte qui
  // était sur le profil passe ici, au moment du geste (28/09/2026).
  const ok=await rcConfirm(currentUser.role==='coach'
    ?('SUPPRIMER DÉFINITIVEMENT MON COMPTE ?\n\n'
      +'Cette action est irréversible.\n'
      +'Toutes tes données personnelles (profil, programmes, codes d\'accès, messages audio)\n'
      +'seront effacées conformément au RGPD (Art. 17).\n\n'
      +'Les données financières sont conservées 5 ans (obligation légale).')
    :('SUPPRIMER DÉFINITIVEMENT MON COMPTE ?\n\n'
      +'Action irréversible. Conformément au RGPD (Art. 17), toutes tes données seront effacées : '
      +'profil, séances, bilans, photos, et tes données de santé (poids, mensurations, cycle, constantes, analyses).\n\n'
      +'Les données financières sont conservées 5 ans (obligation légale).')
  ,null,'Supprimer');
  if(!ok) return;
  toast('Suppression en cours…','var(--sub)');
  try{
    const users=DB.get('users')||{};
    const myKey=currentUser.email;
    // Délier tous les athlètes de ce coach
    for(const k of Object.keys(users)){
      const u=users[k];
      if(u&&u.coachId===currentUser.id&&k!==myKey){
        u.coachId=null;u.coachName=null;u.coachCode=null;u.updatedAt=Date.now();
        users[k]=u;CLOUD.pushOne(k,u);
      }
    }
    // Les dates de bilan sont relevées AVANT que le dossier disparaisse : ce
    // sont elles qui désignent les photos en cache à effacer, et on ne les
    // retrouverait plus après.
    const _datesBilans=((currentUser.bilans)||[]).map(b=>b&&b.date).filter(Boolean);
    delete users[myKey];
    DB.set('users',users);
    // ── Effacement distant, PUIS local ────────────────────────────────────
    // L'ORDRE EST CRITIQUE. Le jeton d'identite vit dans rc_fb_auth : vider
    // localStorage en premier le detruirait, et les quatre appels distants
    // partiraient sans autorisation pour echouer en silence. On obtient donc
    // le jeton d'abord, on efface le distant, et le local en dernier.
    const safeKey=myKey.toLowerCase().replace(/\./g,',');
    let fbTok=null;
    try{ fbTok=await CLOUD._getToken(); }catch(e){}

    // 1. Dossier utilisateur dans la base temps reel
    try{
      await fetch(CLOUD._fbUrl.replace('users.json','users/'+safeKey+'.json')
        +(fbTok?'?auth='+fbTok:''),{method:'DELETE'});
    }catch(e){}

    // 1 bis. Sante privee. Elle vit HORS de users/ : supprimer le dossier la
    //    laisserait intacte, ce qui serait un manquement RGPD — des donnees
    //    de sante survivant a la suppression du compte qui les portait.
    try{
      await fetch(CLOUD._urlSantePrivee(safeKey)+(fbTok?'?auth='+fbTok:''),
        {method:'DELETE'});
    }catch(e){}

    // 1 ter. Le résumé d'activité (statistiques de rétention) : hors de users/.
    try{
      await fetch(CLOUD._fbUrl.replace('users.json','activite/'+safeKey+'.json')+(fbTok?'?auth='+fbTok:''),{method:'DELETE'});
    }catch(e){}

    // 1 ter. La santé synchronisée : voir _supprimerSanteSync.
    await _supprimerSanteSync(safeKey,fbTok);

    // 2. Fiche programme PDF dans Storage. Chemin encode en entier : le nom
    //    d'objet contient des barres obliques qui doivent etre echappees.
    if(fbTok){
      try{
        await fetch('https://firebasestorage.googleapis.com/v0/b/'+STORAGE_BUCKET
          +'/o/'+encodeURIComponent('pdfs/'+safeKey+'/programme.pdf'),
          {method:'DELETE',headers:{'Authorization':'Bearer '+fbTok}});
      }catch(e){}
    }

    // 3. Codes d'acces emis par ce coach. Ils vivent hors du dossier
    //    utilisateur : supprimer le dossier les laisserait actifs, et un code
    //    orphelin resterait utilisable par un athlete.
    for(const c of (currentUser.studentCodes||[])){
      if(!c||!c.token) continue;
      try{
        await fetch(_rcCodesUrl(c.token)+(fbTok?'?auth='+fbTok:''),{method:'DELETE'});
      }catch(e){}
    }

    // 4. Identite Firebase Auth. Sans cet appel, le dossier disparait mais le
    //    compte d'authentification survit : l'adresse resterait prise et une
    //    reconnexion reussirait sur un dossier vide.
    if(fbTok){
      try{
        await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+CLOUD._fbKey,
          {method:'POST',headers:{'Content-Type':'application/json'},
           body:JSON.stringify({idToken:fbTok})});
      }catch(e){}
    }

    // 5. Traces locales, CIBLÉES. Le balayage de toutes les clés `rc_`
    //    emportait rc_users — le dossier de TOUS les comptes de cet appareil —
    //    et rc_comptes, le registre du multi-compte. Supprimer son compte
    //    effaçait donc aussi celui d'à côté.
    //
    //    Le commentaire d'origine défendait le balayage : « une liste figée
    //    laisserait passer toute clé ajoutée plus tard ». C'est vrai, et c'est
    //    le prix : mieux vaut oublier une clé du compte sortant — qu'un lot
    //    suivant rattrapera — que détruire les données de quelqu'un qui n'a
    //    rien demandé.
    // LES BLOBS DE PHOTOS DE PROGRESSION, dans IndexedDB `repcore-photos`.
    //
    // Leurs clés sont `<date>/<pose>` : elles ne portent AUCUNE adresse. Rien
    // ne pourra donc les rattacher à ce compte plus tard — ne pas les
    // supprimer maintenant, c’est les laisser là pour toujours, orphelines et
    // illisibles, mais bien présentes.
    //
    // phpViderBlobs vide le magasin ENTIER. Tant qu’un autre compte reste sur
    // l’appareil, ce serait détruire SES photos. On ne vide tout que si on
    // part seul ; sinon on retire clé par clé celles que CE dossier déclare.
    //
    // Et DANS LE DOUTE, on ne vide pas tout : si le registre des comptes est
    // illisible, on retombe sur le retrait ciblé. Oublier un blob à soi se
    // rattrape ; effacer celui d’un autre, non.
    try{
      let _seulSurLAppareil=false;
      try{ _seulSurLAppareil=!comptesConnectes().some(c=>c&&c.email!==myKey); }
      catch(e){ _seulSurLAppareil=false; }
      if(_seulSurLAppareil){ await phpViderBlobs(); }
      else {
        const _sc=((currentUser.photosProgression||{}).seances)||[];
        for(const _s of _sc)
          for(const _po of Object.values((_s&&_s.poses)||{}))
            if(_po&&_po.cle) try{ await phpSupprimerBlob(_po.cle); }catch(e){}
      }
    }catch(e){}
    try{
      // Le registre du multi-compte : on en retire CETTE entrée, pas le reste.
      try{ _comptesEcrire(comptesConnectes().filter(c=>c.email!==myKey)); }catch(e){}
      // Clés propres à cet appareil ou au compte actif — aucune ne porte les
      // données d'un autre compte.
      // BIL_DRAFT_KEY et PHP_FILE_CLE sont nommées, pas retapées : leur valeur
      // est déclarée ailleurs, et deux écritures d’une même clé finissent par
      // désigner deux endroits.
      for(const k of ['rc_wo_state','rc_session','rc_fb_auth','rc_resil_file',
                      'rc_code_verifie','pendingCode',BIL_DRAFT_KEY,PHP_FILE_CLE])
        try{ localStorage.removeItem(k); }catch(e){}
      // Les photos et les secondes vues, préfixées par ce compte ou datées par
      // SES bilans. rc_p2_ porte l'email ; rc_photo_ ne porte qu'une date,
      // d'où le relevé fait plus haut.
      const _prefP2='rc_p2_'+myKey+'_';
      const _datesSet=new Set(_datesBilans.map(String));
      for(const k of Object.keys(localStorage)){
        if(k.indexOf(_prefP2)===0){ localStorage.removeItem(k); continue; }
        if(k.indexOf('rc_photo_')===0){
          // rc_photo_<date>_<vue> : on ne touche qu'aux dates de CE compte.
          const _d=k.slice('rc_photo_'.length).split('_')[0];
          if(_datesSet.has(_d)) localStorage.removeItem(k);
        }
      }
      // ── LES PHOTOS D'UN BILAN JAMAIS TERMINÉ ────────────────────────
      //
      // rc_pendingphoto_<champ> : les photos de mensuration d'un bilan
      // COMMENCÉ et ni validé ni annulé. Elles ne passent en rc_photo_ qu'à la
      // validation — avant ça, elles n'existent que là. La suppression
      // effaçait rc_photo_ et rc_p2_, et les laissait : un athlète qui avait
      // ouvert un bilan, photographié son corps, puis fermé l'application
      // gardait ces photos sur l'appareil après un effacement que l'interface
      // annonce comme total. Manquement à l'article 17, sur les données les
      // plus intimes de toutes.
      //
      // AUCUNE CONDITION, et c'est délibéré : ces clés ne portent NI adresse NI
      // date, seulement un nom de champ. Rien ne pourra donc les rattacher à un
      // compte plus tard. Le même raisonnement que pour les blobs IndexedDB
      // — sauf qu'ici il n'y a même pas de doute à lever, parce que le
      // BROUILLON qui les accompagne, BIL_DRAFT_KEY, part déjà sans condition
      // juste au-dessus. Le texte du bilan et ses photos décrivent la même
      // saisie inachevée : en effacer un et garder l'autre n'a de sens dans
      // aucun des deux sens.
      _bilPurgerPhotos('depart'); _bilPurgerPhotos('coaching');
      // ET LE RESTE DU PRÉFIXE, s'il en reste. Les deux appels ci-dessus
      // passent par _bilPhotoPrefixe, qui ne connaît que 'deb-' et 'bil-'. Un
      // troisième type de bilan ajouté plus tard glisserait au travers en
      // silence, et le silence est exactement ce qu'on ne peut pas se permettre
      // ici : une photo de corps oubliée ne se signale jamais d'elle-même.
      for(const k of Object.keys(localStorage))
        if(k.indexOf('rc_pendingphoto_')===0)
          try{ localStorage.removeItem(k); }catch(e){}
      // sessionStorage est propre à cet onglet et ne survit pas : rien d'un
      // autre compte n'y vit durablement.
      sessionStorage.clear();
    }catch(e){}

    // Un autre compte reste sur l'appareil : on l'active plutôt que de
    //    renvoyer sur l'écran d'accueil — même geste que logout.
    let _reste=[];
    try{ _reste=comptesConnectes(); }catch(e){}
    silentLogout();
    const _apres=DB.get('users')||{};
    const _suivant=_reste.find(c=>_apres[c.email]);
    // MÊME RAISON QUE DANS logout : le compte vient d’être SUPPRIMÉ, une
    // séance ou un bilan en cours ne protège plus rien, et un refus de
    // basculerCompte laissait l’application sans écran ni session.
    _comptesRemiseAZero();
    // L’adieu est dit UNE FOIS, sur les deux chemins. Il était écrit deux
    // fois, et il aurait fallu l’écrire trois avec le repli.
    if(!(_suivant && basculerCompte(_suivant.email))) go('s-welcome');
    setTimeout(()=>toast('Compte supprimé. Au revoir.','var(--sub)'),400);
  }catch(e){
    toast('Erreur : '+(e.message||String(e)),'var(--red)');
  }
}

function _adminOffboardSelected(){
  const id=document.getElementById('admin-offboard-select')?.value;
  if(!id){toast('Sélectionne un coach','var(--orange)');return;}
  offboardCoach(id);
}
// ── Access codes via Firebase RTDB (sans Cloud Functions — plan Spark) ──
// Format: RC-XXXX-XXXX stocké dans /rc_codes/{code} du RTDB
const _MONTH_MS=30*24*60*60*1000;
// ── R-03 : un coach affilié accorde l'accès, dans une limite dure ────────
// Le plafond est vérifié DEUX fois — à la génération ET à la consommation.
// Une seule vérification côté émetteur ne protège de rien : le code est un
// objet distant, et rien n'empêche d'en poser un à la main dans /rc_codes.
const CODE_MOIS_MAX_AFFILIE=12;
// Un code émis AVANT ce lot ne porte pas grantedBy. Il est lu comme
// 'creator' : sa branche d'octroi est exactement celle d'avant, et aucun code
// en circulation ne change de comportement. Migration implicite, sans écriture.
function _octroyePar(payload){
  const v=(payload||{}).grantedBy;
  return (v==='coach'||v==='creator')?v:'creator';
}
// PURE. Le plafond ne s'applique qu'aux affiliés : le créateur reste libre.
function _moisAutorises(payload){
  const m=Number((payload||{}).months);
  if(!(m>0)) return 0;
  return _octroyePar(payload)==='coach'?Math.min(m,CODE_MOIS_MAX_AFFILIE):m;
}
function _rcRandCode(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s='RC-';
  for(let i=0;i<4;i++) s+=c[Math.floor(Math.random()*c.length)];
  s+='-';
  for(let i=0;i<4;i++) s+=c[Math.floor(Math.random()*c.length)];
  return s;
}
function _rcCodesUrl(code){
  return CLOUD._fbUrl.replace('/users.json','/rc_codes/'+encodeURIComponent(code)+'.json');
}
// type : 'athlete' (défaut, code d'accès élève) ou 'coach' (invitation à créer
// un compte coach). Le type est écrit dans le nœud RTDB et re-vérifié à la
// consommation : un code élève ne peut pas ouvrir un compte coach.
// ══════ INVITATIONS EN ATTENTE ══════
// 48 h entre deux relances. Ce n'est pas une limite technique : c'est ce qui
// sépare un rappel d'un harcèlement. Le coach n'a pas envie de passer pour
// un importun, et l'interface ne doit pas l'y aider.
const RELANCE_DELAI_MS=48*3600*1000;
// PURE. Les invitations qui n'ont pas abouti, la plus récente d'abord.
// Un code désactivé n'y figure pas : le coach l'a révoqué, il n'attend rien.
function invitationsEnAttente(user){
  const u=_dossier(user);
  return ((u&&u.studentCodes)||[])
    .filter(c=>c&&c.token&&c.active!==false&&etatInvitation(c)!=='cree')
    .slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
// PURE. Peut-on relancer ? Rend {ok, reste} — `reste` en heures, pour le
// dire plutôt que de griser un bouton sans explication.
function relancePossible(c,maintenant){
  const t=maintenant||Date.now();
  const d=(c&&c.relanceLe)?Date.parse(c.relanceLe):NaN;
  if(!isFinite(d)) return {ok:true,reste:0};
  const ecoule=t-d;
  if(ecoule>=RELANCE_DELAI_MS) return {ok:true,reste:0};
  return {ok:false,reste:Math.ceil((RELANCE_DELAI_MS-ecoule)/3600000)};
}
// PURE. Le lien d'invitation d'un code donné : LE CODE SEUL, par le lien court.
//
// ⚠ PLUS DE coachpkg (05/10/2026). Le profil du coach en base64 faisait un
//   lien de 300 caractères, illisible dans un message, et qui sautait la page
//   /i (le tuto, l'aide Instagram). Le coach se retrouve désormais par le CODE :
//   _verifierCodeSansConsommer lit /rc_codes/<code>, qui porte coachId et
//   coachName. Les anciens liens (?coachpkg=…&inv=…) restent lus par
//   importFromURL.
// /i sur Firebase (RC_LIEN_COURT) ; ailleurs — GitHub Pages, sous-dossier —
// la réécriture n'existe pas, mais i/index.html est à côté de app/ : 'i/'.
function lienInvitation(code,user){
  const u=_dossier(user);
  if(!u||!code) return '';
  const base=/\/i$/.test(RC_LIEN_COURT)?RC_LIEN_COURT:APP_BASE_URL.replace(/app\/$/,'')+'i/';
  return lienAttribue(base+'?inv='+encodeURIComponent(code),{src:'invitation'});
}
// Le retour à la ligne d'un message WhatsApp. Nommé pour ne pas le confondre
// avec celui du code source, et déclaré AVANT son usage : un const n'est pas
// hissé, et s'appuyer sur l'ordre d'appel pour que ça tienne est fragile.
const NL_MSG='\n\n';
// PURE. Le message de relance. Pré-rédigé, jamais envoyé automatiquement :
// la relance est un geste du coach, pas une tâche de fond.
function messageRelance(c,user){
  const u=_dossier(user);
  const prenom=(c&&(c.prenom||String(c.studentName||'').split(' ')[0]))||'';
  const nom=((u&&u.fname)||'').trim();
  return (prenom?('Salut '+prenom+', '):'Salut, ')
    +'je t\'ai préparé ton accès RepCore'+(nom?(' : c\'est '+nom):'')+'. '
    +'Tu peux le récupérer ici quand tu veux, le lien n\'expire pas :'+NL_MSG
    +lienInvitation(c&&c.token,u);
}

/**
 * Le geste « Son code » d'une invitation : l'invitation entiere, prete a
 * coller — le lien, le code, et la marche a suivre.
 *
 * ⚠ LE JETON VOYAGE, PAS L'INDEX. Un index dans `studentCodes` bouge des qu'un
 *   code est cree ou supprime, et le bouton d'un rectangle rendu il y a dix
 *   secondes aurait copie l'invitation de quelqu'un d'autre. Le jeton, lui, ne
 *   bouge jamais — c'est deja par lui que `relancerInvitation` travaille.
 * @param {string} token
 */
function invCopierCode(token){
  const i=((currentUser&&currentUser.studentCodes)||[]).findIndex(c=>c&&c.token===token);
  if(i<0){ toast('Invitation introuvable','var(--orange)'); return false; }
  _copierInvitationAthlete(i);
  return true;
}
// Le rendu de la section « En attente ». Un RECTANGLE par invitation, huit par
// ligne, avec son etat, sa date, et les deux gestes qui servent : relancer, et
// recuperer le code pour le coller soi-meme.
//
// ⚠ MEME GRILLE QUE « JAMAIS DEMARRE », ET C'EST VOULU. Les deux blocs se
//   suivent a l'ecran et posent la meme question — qui attend, et depuis
//   quand. Deux mises en page differentes pour deux listes voisines auraient
//   fait croire a deux natures de donnees.
function _htmlInvitationsEnAttente(user){
  const u=_dossier(user);
  if(!u||u.role!=='coach') return '';
  const l=invitationsEnAttente(u);
  if(!l.length) return '';
  const MAX=8;
  const reste=Math.max(0,l.length-MAX);
  const d=(iso)=>{ if(!iso) return ''; const t=Date.parse(iso);
    return isFinite(t)?new Date(t).toLocaleDateString('fr-FR'):''; };
  const lignes=l.map((c,rang)=>{
    const e=etatInvitation(c);
    const quand=(e==='ouvert')?d(c.ouvertLe):(c.createdAt?new Date(c.createdAt).toLocaleDateString('fr-FR'):'');
    const r=relancePossible(c);
    const nom=((c.prenom||'')+' '+(c.nom||'')).trim()||c.studentName||'Invitation';
    const couleur=(e==='ouvert')?'var(--green)':'var(--sub)';
    // ⚠ escapeHtml APRES JSON.stringify, ET NON UN SIMPLE REMPLACEMENT DES
    //   GUILLEMETS. `&` doit etre echappe LE PREMIER, sinon un jeton contenant
    //   `&quot;` se redecoderait en guillemet a la lecture de l'attribut et
    //   sortirait de l'appel. escapeHtml tient deja cet ordre.
    const jeton=escapeHtml(JSON.stringify(String(c.token||'')));
    return '<div class="jd-carte'+(rang>=MAX?' jd-plus" hidden':'"')+'>'
      +'<div><div class="jd-nom" title="'+escapeHtml(nom)+'">'+escapeHtml(nom)+'</div>'
      +'<div class="jd-date" style="color:'+couleur+'">'+escapeHtml(INV_ETAT_LIB[e]||e)+'</div>'
      +(quand?'<div class="jd-date">le '+escapeHtml(quand)+'</div>':'')
      +'</div>'
      +'<div class="jd-cmd">'
      // ⚠ LES 48 H ENTRE DEUX RELANCES TIENNENT TOUJOURS. Ce n'est pas une
      //   limite technique : c'est ce qui separe un rappel d'un harcelement, et
      //   le rectangle DIT le temps qui reste plutot que de griser un bouton.
      +(r.ok
        ? '<button type="button" class="btn btn-red btn-sm" onclick="relancerInvitation('+jeton+')">Relancer</button>'
        : '<span class="jd-attendre">Encore '+r.reste+' h</span>')
      // « SON CODE » RESTE OUVERT MEME PENDANT LES 48 H : copier une invitation
      // n'envoie rien a personne, c'est le coach qui decide ou il la colle.
      +'<button type="button" class="btn btn-blanc btn-sm" onclick="invCopierCode('+jeton+')">Son code</button>'
      +'</div></div>';
  }).join('');
  return '<div style="margin-bottom:20px">'
    +'<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:800;'
    +'text-transform:uppercase;margin-bottom:8px">En attente ('+l.length+')</div>'
    +'<div class="jd-grille" style="padding:0">'+lignes+'</div>'
    +(reste?'<button type="button" onclick="jdVoirTout(this)" style="display:block;width:100%;background:none;border:none;'
      +'color:var(--red-text);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;'
      +'letter-spacing:1px;text-transform:uppercase;cursor:pointer;padding:10px 0 0;min-height:36px;'
      +'text-align:left">+ '+reste+' autre'+(reste>1?'s':'')+' · tout afficher</button>':'')
    +'</div>';
}
// Relancer : on ouvre WhatsApp avec le message pré-rédigé, et on horodate.
// L'horodatage part MEME si le coach referme WhatsApp sans envoyer : on ne
// peut pas savoir ce qu'il a fait dans une autre application, et compter
// large protège l'athlète d'être relancé trois fois de suite.
function relancerInvitation(token){
  const u=currentUser;
  if(!u||u.role!=='coach') return false;
  const c=((u.studentCodes)||[]).find(x=>x&&x.token===token);
  if(!c) return false;
  const r=relancePossible(c);
  if(!r.ok){
    toast('Déjà relancé. Attends encore '+r.reste+' h : un rappel de trop se '
      +'retient plus qu\'un rappel utile.','var(--orange)');
    return false;
  }
  const msg=messageRelance(c,u);
  c.relanceLe=new Date().toISOString();
  try{ saveUser(); }catch(e){ rcErreurMuette('relancerInvitation',e); }
  // L'horodatage part aussi sur le nœud, pour que le coach retrouve l'état
  // depuis un autre appareil. Sans jeton ce PATCH échouera — ce n'est pas
  // grave, la limite locale a déjà joué.
  try{ _marquerRelanceDistante(c.token,c.relanceLe); }catch(e){}
  try{ window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank','noopener'); }catch(e){}
  _rendreInvitations();
  return true;
}
async function _marquerRelanceDistante(code,iso){
  try{
    const tok=await CLOUD._getToken().catch(()=>null);
    if(!tok) return false;
    const r=await fetch(_rcCodesUrl(code)+'?auth='+tok,
      {method:'PATCH',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({relanceLe:iso})});
    return r.ok;
  }catch(e){ return false; }
}
function _rendreInvitations(){
  const z=document.getElementById('ch-invitations');
  if(z) z.innerHTML=_htmlInvitationsEnAttente(currentUser);
  return !!z;
}

// Le geste complet : emettre le code, copier le lien, ouvrir le partage
// natif. Un seul tap pour le cas courant.
async function _envoyerInvitation(){
  const v=id=>((document.getElementById(id)||{}).value||'').trim();
  const err=document.getElementById('inv-err');
  const dire=(m)=>{ if(err){ err.textContent=m; err.style.display='block'; } };
  if(err) err.style.display='none';
  const r=await inviterAthlete(v('inv-prenom'),v('inv-nom'));
  if(!r.ok){ dire(r.raison); return false; }
  const p1=document.getElementById('inv-prenom'), p2=document.getElementById('inv-nom');
  if(p1) p1.value=''; if(p2) p2.value='';
  // Le presse-papier D ABORD : si le partage natif est refuse ou absent, le
  // coach a quand meme le lien. L inverse le laisserait les mains vides.
  try{ if(navigator.clipboard) await navigator.clipboard.writeText(r.lien); }catch(e){}
  let partage=false;
  try{
    if(navigator.share){
      await navigator.share({title:'Ton accès RepCore',text:messageRelance(r.invitation,currentUser)});
      try{ attribCompter('partage','invitation'); }catch(e){}
      partage=true;
    }
  }catch(e){}   // annule par l utilisateur : ce n est pas une erreur
  toast(partage?'Invitation envoyée '+ICO.coche:ICO.coche+' Lien copié : envoie-le à '
    +(r.invitation.prenom||'ton athlète'),'var(--green)');
  _rendreInvitations();
  return true;
}

// ══════ INVITER SANS CRÉER DE DOSSIER ══════
// Le lien d'invitation ne transportait AUCUN code : c'était le profil du
// coach, réutilisable par n'importe qui, sans destinataire. Rien à tracer.
// Émettre un code demandait de créer le dossier de l'athlète — donc de
// connaître son e-mail avant même de l'avoir invité.
//
// Ce chemin-ci émet un code pour une PERSONNE NOMMÉE, sans rien créer
// d'autre. Le dossier naîtra quand elle s'inscrira.
const INV_MOIS_DEFAUT=12;
// PURE. Deux invitations pour la même personne, c'est une erreur de saisie.
// Dédoublonnage sur prénom+nom normalisés : le formulaire ne demande pas
// d'e-mail, et en demander un ajouterait une donnée nominative dans un nœud
// public que le cahier des charges limite au prénom et au nom.
function _clePersonne(prenom,nom){
  return exKey((prenom||'')+' '+(nom||''));
}
function invitationExistante(prenom,nom,user){
  const k=_clePersonne(prenom,nom);
  if(!k) return null;
  return invitationsEnAttente(user).find(c=>_clePersonne(c.prenom,c.nom)===k
    ||exKey(c.studentName||'')===k)||null;
}
async function inviterAthlete(prenom,nom,opts){
  const u=currentUser;
  if(!u||u.role!=='coach') return {ok:false,raison:'Réservé aux coachs.'};
  const pn=String(prenom||'').trim(), nm=String(nom||'').trim();
  if(pn.length<2) return {ok:false,raison:'Donne au moins un prénom.'};
  const deja=invitationExistante(pn,nm,u);
  if(deja) return {ok:false,raison:'Tu as déjà une invitation en attente pour '
    +((deja.prenom||deja.studentName||'cette personne'))+'. Relance-la plutôt '
    +'que d\'en créer une seconde.',existante:deja};
  let gen;
  try{ gen=await _genAccessCode((pn+' '+nm).trim(),INV_MOIS_DEFAUT,undefined,
    {programmeModeleId:opts&&opts.programmeModeleId}); }
  catch(e){ return {ok:false,raison:e.message||'Impossible de créer l\'invitation.'}; }
  const entree={...gen.payload,token:gen.token,active:true,redeemed:false,
    createdAt:Date.now(),etat:'envoye',ouvertLe:null,creeLe:null,relanceLe:null,
    prenom:pn,nom:nm};
  if(!u.studentCodes) u.studentCodes=[];
  u.studentCodes.push(entree);
  try{ saveUser(); }catch(e){ rcErreurMuette('inviterAthlete',e); }
  return {ok:true,invitation:entree,lien:lienInvitation(gen.token,u)};
}

// ══════ INVITER PLUSIEURS ATHLÈTES D'UN COUP (05/10/2026) ══════
// Un coach qui démarre arrive avec une liste : vingt prénoms dans ses notes,
// pas vingt formulaires à remplir. Il colle la liste, choisit un programme de
// départ s'il le veut, et repart avec un lien par personne.
//
// ⚠ L'E-MAIL NE QUITTE PAS L'APPAREIL. /rc_codes est en lecture publique : on
//   n'y écrit que le prénom et le nom (voir _clePersonne). L'adresse, si le
//   coach l'a collée, ne sert qu'à l'écran de résultat (« E-mail »).
// ⚠ UN APPEL APRÈS L'AUTRE, JAMAIS EN PARALLÈLE. Cinquante PUT simultanés sur
//   le plan Spark, c'est cinquante connexions ouvertes d'un coup ; en série,
//   un échec réseau arrête tout proprement et le rapport dit où.
const INV_LOT_MAX=50;
const INV_LOT_EMAIL_RE=/^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/;
// PURE. Le texte collé → [{prenom,nom,email?}]. Une personne par ligne,
// « Prénom Nom » ou « Prénom Nom ; e-mail ». Lignes vides ignorées, doublons
// retirés (même clé que invitationExistante), INV_LOT_MAX personnes au plus.
// Une ligne sans nom de famille reste valable : beaucoup de coachs ne
// connaissent que le prénom.
function parserListeInvites(texte){
  const vus=new Set(), l=[];
  for(const brut of String(texte||'').split(/\r?\n/)){
    if(l.length>=INV_LOT_MAX) break;
    const [nomComplet,mail]=brut.split(';');
    const mots=String(nomComplet||'').trim().split(/\s+/).filter(Boolean);
    if(!mots.length) continue;
    const prenom=mots[0], nom=mots.slice(1).join(' ');
    const k=_clePersonne(prenom,nom);
    if(!k||vus.has(k)) continue;
    vus.add(k);
    const o={prenom,nom};
    const e=String(mail||'').trim();
    if(INV_LOT_EMAIL_RE.test(e)) o.email=e;
    l.push(o);
  }
  return l;
}
// PURE. Les modèles du coach qu'on peut donner comme programme de départ :
// la même source que l'assignation (coachPrograms), et seulement ceux qui ont
// au moins une séance garnie — un modèle vide ne donnerait rien à l'athlète.
function modelesDepartDe(user){
  const u=_dossier(user);
  return (((u&&u.coachPrograms)||[]).filter(p=>p&&p.id
    &&(_cplSeancesPleines(p,'H').length||_cplSeancesPleines(p,'F').length)))
    .map(p=>({id:String(p.id),name:String(p.name||'Programme')}));
}
// Le message d'arrêt : hors ligne, ou session refusée — inutile d'essayer les
// lignes suivantes, elles échoueraient toutes pour la même raison.
function _lotArretDe(raison){
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return 'hors ligne';
  return /hors ligne|connexion|session/i.test(String(raison||''))?'connexion':'';
}
/**
 * Émet une invitation par personne, en série. Rend
 * {resultats:[{prenom,nom,email?,lien,token}|{prenom,nom,email?,raison}],crees,arret}.
 * @param {{prenom:string,nom:string,email?:string}[]} liste  parserListeInvites
 * @param {string} [modeleId]  le programme de départ (coachPrograms[].id)
 * @param {(fait:number,total:number)=>void} [surProgres]
 */
async function inviterEnLot(liste,modeleId,surProgres){
  const l=(liste||[]).slice(0,INV_LOT_MAX), resultats=[];
  let crees=0, arret='';
  for(let i=0;i<l.length;i++){
    const p=l[i], base={prenom:p.prenom,nom:p.nom||''};
    if(p.email) base.email=p.email;
    if(arret){ resultats.push(Object.assign(base,{raison:'Non créée : '+arret+'.'})); continue; }
    if(typeof navigator!=='undefined'&&navigator.onLine===false){
      arret='hors ligne';
      resultats.push(Object.assign(base,{raison:'Non créée : hors ligne.'}));
      continue;
    }
    if(invitationExistante(p.prenom,p.nom,currentUser)){
      resultats.push(Object.assign(base,{raison:'Déjà une invitation en attente : relance-la.'}));
      continue;
    }
    const r=await inviterAthlete(p.prenom,p.nom,{programmeModeleId:modeleId||undefined});
    if(r.ok){ crees++; resultats.push(Object.assign(base,{lien:r.lien,token:r.invitation.token})); }
    else {
      resultats.push(Object.assign(base,{raison:r.raison}));
      arret=_lotArretDe(r.raison);
    }
    try{ if(surProgres) surProgres(i+1,l.length); }catch(e){}
  }
  return {resultats,crees,arret};
}
// L'avertissement de quota : la règle existante (coachQuotaDepasse), et ce
// que le lot y ajoute. JAMAIS bloquant — le quota se lit sur les athlètes
// ACTIFS, et une invitation n'en est pas encore un.
function _lotAvertissementQuota(n){
  const u=currentUser;
  if(!u||u.role!=='coach') return '';
  const users=DB.get('users')||{};
  const q=getCoachQuota(coachPlanDe(u)), actifs=countActiveAthletes(u,users);
  if(coachQuotaDepasse(u,users))
    return 'Tu dépasses déjà le quota de ta formule ('+actifs+' / '+q+' athlètes actifs). '
      +'Les invitations partent quand même.';
  if(n&&actifs+n>q)
    return 'Si tous deviennent actifs, tu dépasseras le quota de ta formule ('+q+' athlètes). '
      +'Les invitations partent quand même.';
  return '';
}
let _lotResultats=[], _lotPartages=0;
const _lotChamp='width:100%;box-sizing:border-box;font-family:Montserrat,sans-serif;font-size:var(--fs-md);'
  +'background:var(--surface-1);color:var(--text);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px';
function ouvrirInvitationsLot(){
  if(!currentUser||currentUser.role!=='coach') return false;
  try{ closeModal(); }catch(e){}
  const mods=modelesDepartDe(currentUser);
  const opts='<option value="">Aucun</option>'+mods.map(m=>'<option value="'+escapeHtml(m.id)+'">'
    +escapeHtml(m.name)+'</option>').join('');
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div id="lot-feuille" role="dialog" aria-modal="true" aria-labelledby="lot-titre" onclick="event.stopPropagation()" '
    +'style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px 20px 24px;width:100%;'
    +'max-width:520px;max-height:88vh;overflow-y:auto;box-sizing:border-box;animation:fadeIn var(--t-3) var(--c-out)">'
    +'<h2 id="lot-titre" style="margin:0 0 4px;font-size:var(--fs-lg)">Inviter plusieurs athlètes</h2>'
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.5;margin:0 0 12px">Une personne par ligne : '
    +'« Prénom Nom », ou « Prénom Nom ; e-mail ». '+INV_LOT_MAX+' au plus. L’e-mail reste sur ton appareil.</p>'
    +'<textarea id="lot-texte" rows="8" oninput="_lotCompter()" placeholder="Léa Martin\nTom Petit ; tom@exemple.fr" '
    +'style="'+_lotChamp+';resize:vertical;min-height:140px"></textarea>'
    +'<div id="lot-compte" style="font-size:var(--fs-xs);color:var(--sub);margin:6px 0 12px">0 personne</div>'
    +'<label for="lot-modele" style="display:block;font-size:var(--fs-xs);color:var(--sub);font-weight:700;margin-bottom:6px">'
    +'Programme de départ</label>'
    +'<select id="lot-modele" style="'+_lotChamp+';margin-bottom:12px">'+opts+'</select>'
    +'<div id="lot-quota" style="display:none;font-size:var(--fs-xs);color:var(--orange);line-height:1.5;margin-bottom:12px"></div>'
    +'<div id="lot-err" style="display:none;font-size:var(--fs-sm);color:var(--red-light);line-height:1.5;margin-bottom:8px"></div>'
    +'<button type="button" id="lot-go" class="btn btn-red" style="width:100%;min-height:46px;margin-bottom:10px" onclick="_lotEnvoyer()">'
    +'Créer les invitations</button>'
    +'<button type="button" class="btn btn-outline" style="width:100%;min-height:44px" onclick="closeModal()">Annuler</button>'
    +'</div></div>';
  document.body.insertAdjacentHTML('beforeend',html);
  _lotCompter();
  return true;
}
// Le compte sous la zone de texte, et ce qui sera ignoré au-delà du maximum.
function _lotCompter(){
  const t=(document.getElementById('lot-texte')||{}).value||'';
  const n=parserListeInvites(t).length;
  const lignes=t.split(/\r?\n/).filter(x=>x.trim()).length;
  const z=document.getElementById('lot-compte');
  if(z) z.textContent=n+' personne'+(n>1?'s':'')
    +(lignes>INV_LOT_MAX?' · au-delà de '+INV_LOT_MAX+', les lignes sont ignorées':'');
  const q=document.getElementById('lot-quota'), m=_lotAvertissementQuota(n);
  if(q){ q.textContent=m; q.style.display=m?'block':'none'; }
  return n;
}
async function _lotEnvoyer(){
  const t=(document.getElementById('lot-texte')||{}).value||'';
  const modele=(document.getElementById('lot-modele')||{}).value||'';
  const liste=parserListeInvites(t);
  const err=document.getElementById('lot-err'), go=document.getElementById('lot-go');
  if(!liste.length){
    if(err){ err.textContent='Colle au moins un prénom, une personne par ligne.'; err.style.display='block'; }
    return false;
  }
  if(err) err.style.display='none';
  if(go){ go.disabled=true; go.textContent='Création… 0 / '+liste.length; }
  const r=await inviterEnLot(liste,modele,(f,n)=>{ if(go) go.textContent='Création… '+f+' / '+n; });
  _lotResultats=r.resultats; _lotPartages=0;
  _rendreResultatLot(r);
  try{ _rendreInvitations(); }catch(e){}
  return r;
}
// L'écran de résultat : une ligne par personne, son lien ou sa raison.
function _rendreResultatLot(r){
  const f=document.getElementById('lot-feuille');
  if(!f) return false;
  const lignes=r.resultats.map((x,i)=>{
    const nom=escapeHtml((x.prenom+' '+(x.nom||'')).trim());
    return '<div class="lot-l" style="display:flex;align-items:center;gap:8px;padding:10px 12px;margin-bottom:6px;'
      +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3)">'
      +'<div style="flex:1;min-width:0"><div style="font-size:var(--fs-sm);font-weight:800;color:var(--text-strong)">'+nom+'</div>'
      +(x.lien
        ?'<div class="lot-lien" style="font-size:var(--fs-xs);color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'
          +escapeHtml(x.lien)+'</div>'
        :'<div class="lot-raison" style="font-size:var(--fs-xs);color:var(--orange);line-height:1.4">'+escapeHtml(x.raison||'')+'</div>')
      +'</div>'
      +(x.lien?'<button type="button" class="btn btn-blanc btn-sm" onclick="_lotCopier('+i+')">Copier</button>':'')
      +(x.lien&&x.email?'<a class="btn btn-outline btn-sm" href="mailto:'+escapeHtml(encodeURIComponent(x.email))
        +'?subject='+encodeURIComponent('Ton accès RepCore')+'&body='+encodeURIComponent(x.lien)+'">E-mail</a>':'')
      +'</div>';
  }).join('');
  const titre=r.crees+' invitation'+(r.crees>1?'s':'')+' créée'+(r.crees>1?'s':'');
  const avert=_lotAvertissementQuota(0);
  f.innerHTML='<h2 id="lot-titre" style="margin:0 0 4px;font-size:var(--fs-lg)">'+titre+'</h2>'
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.5;margin:0 0 12px">'
    +(r.arret?'Arrêt '+(r.arret==='hors ligne'?'hors ligne':'sur une erreur de connexion')
      +' : les lignes suivantes n’ont pas été créées. Reconnecte-toi et colle-les à nouveau.'
      :'Elles apparaissent dans « En attente ». Envoie à chacun son lien.')+'</p>'
    +(avert?'<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.5;margin-bottom:12px">'+escapeHtml(avert)+'</div>':'')
    +'<div id="lot-liste">'+lignes+'</div>'
    +(r.crees?'<div style="display:flex;gap:8px;margin:12px 0 10px">'
      +'<button type="button" class="btn btn-red" style="flex:1;min-height:46px" onclick="_lotToutCopier()">Tout copier</button>'
      +'<button type="button" id="lot-partager" class="btn btn-blanc" style="flex:1;min-height:46px" onclick="_lotPartager()">Partager</button>'
      +'</div>':'')
    +'<button type="button" class="btn btn-outline" style="width:100%;min-height:44px" onclick="closeModal()">Fermer</button>';
  return true;
}
// PURE. « Prénom : lien », une ligne par invitation créée.
function texteLot(resultats){
  return (resultats||[]).filter(x=>x&&x.lien).map(x=>x.prenom+' : '+x.lien).join('\n');
}
async function _lotEcrire(t,quoi){
  try{ await navigator.clipboard.writeText(t); toast(ICO.coche+' '+quoi,'var(--green)'); return true; }
  catch(e){ toast('Copie impossible ici : appuie longuement sur le lien pour le copier.','var(--orange)'); return false; }
}
function _lotCopier(i){
  const x=_lotResultats[i];
  return x&&x.lien?_lotEcrire(x.lien,'Lien de '+x.prenom+' copié'):false;
}
function _lotToutCopier(){ return _lotEcrire(texteLot(_lotResultats),'Tous les liens copiés'); }
// Partager UN PAR UN : le partage natif exige un geste par envoi, et chaque
// athlète doit recevoir SON lien, pas la liste des autres.
async function _lotPartager(){
  const l=_lotResultats.filter(x=>x&&x.lien);
  if(!l.length) return false;
  if(!navigator.share) return _lotToutCopier();
  const x=l[_lotPartages%l.length];
  const c=((currentUser&&currentUser.studentCodes)||[]).find(y=>y&&y.token===x.token)||{prenom:x.prenom,token:x.token};
  try{
    await navigator.share({title:'Ton accès RepCore',text:messageRelance(c,currentUser)});
    try{ attribCompter('partage','invitation'); }catch(e){}
    _lotPartages++;
  }catch(e){ return false; }   // annulé : on reste sur la même personne
  const b=document.getElementById('lot-partager');
  if(b) b.textContent=_lotPartages>=l.length?'Tout est partagé '+ICO.coche
    :'Partager ('+(_lotPartages+1)+' / '+l.length+' : '+(l[_lotPartages%l.length].prenom)+')';
  return true;
}

// ══════ OUVERTURE RÉELLE, PAS UN APERÇU ══════
// LE FAUX POSITIF GARANTI de ce lot : WhatsApp, Messenger et consorts
// chargent la page pour en fabriquer un aperçu. Compter cette visite comme
// une ouverture ferait dire au coach « il a vu » alors que personne n'a rien
// vu — et c'est exactement le genre d'information fausse qui pousse à
// relancer quelqu'un pour rien.
//
// DEUX ANCRAGES, dont un seul suffit, et qu'un robot d'aperçu ne franchit :
//   • un pointerdown : quelqu'un a touché l'écran ;
//   • quatre secondes de page VISIBLE : un aperçu ne reste pas au premier
//     plan quatre secondes, et document.visibilityState le dit.
// Le second couvre le cas de l'athlète qui lit sans toucher.
const INV_DELAI_OUVERTURE_MS=4000;
let _invMarqueurArme=false;
function _armerMarqueurOuverture(code){
  if(_invMarqueurArme||!code) return false;
  _invMarqueurArme=true;
  let fait=false;
  const declencher=()=>{
    if(fait) return;
    fait=true;
    document.removeEventListener('pointerdown',declencher,true);
    _marquerEtatInvitation(code,'ouvert',{ouvertLe:new Date().toISOString()});
  };
  document.addEventListener('pointerdown',declencher,true);
  // Le compte a rebours ne tourne que page visible. Un onglet ouvert en
  // arriere-plan par un apercu ne l'atteint jamais.
  let visible=0;
  const tic=setInterval(()=>{
    if(fait){ clearInterval(tic); return; }
    if(document.visibilityState==='visible') visible+=500;
    if(visible>=INV_DELAI_OUVERTURE_MS){ clearInterval(tic); declencher(); }
  },500);
  return true;
}

