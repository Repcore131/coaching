// ══════════════ L'ENVOI QUI SE VOIT ═════════════════════════
//
// ⚠ FETCH NE SAIT PAS DIRE OÙ EN EST UN ENVOI, et c'était tout le problème.
// L'ancienne version postait le fichier avec `fetch` et écrivait « Upload en
// cours... » une fois pour toutes : sur un réseau mobile, cinquante mégaoctets
// tiennent la ligne une minute entière sans que rien ne bouge à l'écran. La
// personne croit à un blocage, relance, et envoie deux fois le même fichier.
//
// XMLHttpRequest, lui, émet `upload.onprogress`. C'est la SEULE raison de ne
// pas utiliser fetch ici — le reste de l'app n'a pas à changer.
function _envoiPanneau(titre){
  let z=document.getElementById('rc-envoi-panneau');
  if(!z){
    z=document.createElement('div');
    z.id='rc-envoi-panneau';
    document.body.appendChild(z);
  }
  z.className='rc-envoi';
  z.setAttribute('role','status');
  z.setAttribute('aria-live','polite');
  z.innerHTML='<div class="rc-envoi-t"></div>'
    +'<div class="rc-envoi-piste"><div class="rc-envoi-jauge"></div></div>'
    +'<div class="rc-envoi-d"><span class="rc-envoi-g"></span><span class="rc-envoi-dr"></span></div>'
    +'<div class="rc-envoi-n"></div>'
    +'<button type="button" class="rc-envoi-x" style="display:none">Annuler</button>';
  const t=z.querySelector('.rc-envoi-t'), j=z.querySelector('.rc-envoi-jauge'),
        g=z.querySelector('.rc-envoi-g'), d=z.querySelector('.rc-envoi-dr'),
        n=z.querySelector('.rc-envoi-n'),
        x=/** @type {HTMLButtonElement} */(z.querySelector('.rc-envoi-x'));
  t.textContent=titre||'Envoi en cours';
  g.textContent='0 %'; d.textContent=''; n.textContent='';
  let mort=null;
  const fermer=()=>{ if(mort) clearTimeout(mort); if(z&&z.parentNode) z.parentNode.removeChild(z); };
  const differer=ms=>{ if(mort) clearTimeout(mort); mort=setTimeout(fermer,ms); };
  // ── LE DÉBIT, LISSÉ. Un débit instantané saute d'un facteur trois entre deux
  //    paquets : affiché tel quel il est illisible, et le temps restant qu'on
  //    en tire saute avec lui. On garde les échantillons des huit dernières
  //    secondes et on lit la pente sur cette fenêtre-là.
  const FENETRE_MS=8000;
  /** @type {{t:number, o:number}[]} */
  let ech=[];
  let derniereCle='';
  const vitesse=(charge)=>{
    const now=Date.now();
    ech.push({t:now,o:charge});
    while(ech.length>2&&now-ech[0].t>FENETRE_MS) ech.shift();
    const a=ech[0], b=ech[ech.length-1];
    const dt=(b.t-a.t)/1000, dOct=b.o-a.o;
    // MOINS D'UNE SECONDE DE RECUL : on ne dit rien plutôt que d'annoncer un
    // temps restant qui changerait à la seconde suivante.
    return (dt>=1&&dOct>0)?dOct/dt:0;
  };
  /** « 2 min 10 s » — jamais « 130 secondes », que personne ne lit. */
  const duree=(s)=>{
    if(!(s>0)||!isFinite(s)) return '';
    const m=Math.floor(s/60), r=Math.round(s%60);
    return m?(m+' min'+(r?' '+r+' s':'')):(Math.max(1,r)+' s');
  };
  return {
    // Pendant le transfert : le pourcentage ET les mégaoctets. Le pourcentage
    // seul ne dit pas si l'attente sera de dix secondes ou de deux minutes.
    maj(charge,total){
      z.className='rc-envoi';
      const pct=total>0?Math.min(100,Math.round(charge/total*100)):0;
      j.style.width=pct+'%';
      g.textContent=pct+' %';
      const v=vitesse(charge);
      const reste=(v>0&&total>charge)?duree((total-charge)/v):'';
      d.textContent=total>0
        ?(_mo(charge)+' / '+_mo(total)
          +(v>0?' · '+String(Math.round(v/1048576*10)/10).replace('.',',')+' Mo/s':'')
          +(reste?' · '+reste+' restantes':''))
        :'';
    },
    // LE TITRE CHANGE DE PHASE. « Envoi » pendant qu'on allège serait un
    // mensonge : rien n'est parti, et l'athlète qui coupe croit annuler un
    // envoi alors qu'il annule une compression.
    titre(txt){ t.textContent=txt||''; ech=[]; },
    // Une ligne de contexte sous la jauge : ce que la compression a fait, ou
    // ce qu'elle n'a pas pu faire. Elle reste tant qu'on ne la remplace pas.
    note(txt){ n.textContent=txt||''; n.style.display=txt?'block':'none'; },
    // ⚠ LE BOUTON N'APPARAÎT QUE S'IL FAIT QUELQUE CHOSE. Un « Annuler » qui
    //   ne coupe rien est pire que pas de bouton : on le presse, il ne se passe
    //   rien, et on presse le suivant.
    annuler(cb){
      if(typeof cb!=='function'){ x.style.display='none'; x.onclick=null; return; }
      x.style.display='block';
      x.disabled=false;
      x.textContent='Annuler';
      x.onclick=()=>{ x.disabled=true; x.textContent='Annulation…'; try{ cb(); }catch(e){} };
    },
    // Les octets sont partis, le serveur travaille encore. Une jauge figée à
    // 100 % se lirait comme un blocage : elle se met à balayer.
    attente(msg){
      z.className='rc-envoi attente';
      g.textContent=msg||'Traitement…';
      d.textContent='';
      x.style.display='none';
    },
    fini(msg){
      z.className='rc-envoi ok';
      t.textContent='Envoi terminé';
      g.textContent=msg||'Vidéo envoyée';
      d.textContent='';
      x.style.display='none';
      differer(4000);
    },
    rate(msg){
      z.className='rc-envoi ko';
      t.textContent='Envoi interrompu';
      g.textContent=msg||'Échec';
      d.textContent='';
      x.style.display='none';
      differer(7000);
    },
    fermer:fermer
  };
}
// Des mégaoctets à une décimale, virgule française. « 12.3 Mo » se lit mal ici.
function _mo(o){
  return String(Math.round(Number(o||0)/1048576*10)/10).replace('.',',')+' Mo';
}
// POST multipart avec progression. Résout avec le corps de la réponse tel quel ;
// c'est l'appelant qui sait s'il attend du JSON.
//
// ⚠ LES QUATRE FINS SONT TRAITÉES. Un envoi peut aboutir, échouer côté
// serveur, tomber avec le réseau, ou être abandonné — et une promesse qui ne
// se règle jamais laisserait le panneau à l'écran pour toujours.
//
// ⚠ LA PROMESSE PORTE SON XHR. Sans lui, personne ne peut couper un envoi en
// cours : l'objet mourait dans la closure, et le bouton « Annuler » n'aurait
// rien eu à appeler. `p.xhr` est posé sur la promesse elle-même — c'est le
// seul moyen de le rendre sans changer la signature des appelants.
//
// @param {string} url
// @param {any} corps
// @param {((charge:number,total:number)=>void)|null} [surProgres]
// @param {{timeoutMs?:number, inactiviteMs?:number, signal?:any, entetes?:Object<string,string>}} [opt]
function _envoiXhr(url,corps,surProgres,opt){
  const o=opt||{};
  const x=new XMLHttpRequest();
  const p=new Promise((resolve,reject)=>{
    x.open('POST',url);
    for(const k in (o.entetes||{})) x.setRequestHeader(k,o.entetes[k]);
    // ⚠ x.timeout MESURE LA DURÉE TOTALE, PAS L'INACTIVITÉ. Posé bas, il tue
    //   un envoi lent mais vivant. On ne le pose donc QUE là où la taille est
    //   bornée par construction — un morceau — et l'inactivité se surveille à
    //   la main pour le reste. Jusqu'ici il n'était jamais posé du tout, et
    //   x.ontimeout était du code mort.
    if(Number(o.timeoutMs)>0) x.timeout=Number(o.timeoutMs);
    let veille=null, mortParInactivite=false;
    const inactivite=Number(o.inactiviteMs)>0?Number(o.inactiviteMs):ENVOI_INACTIVITE_MS;
    const relancer=()=>{
      if(veille) clearTimeout(veille);
      veille=setTimeout(()=>{ mortParInactivite=true; try{ x.abort(); }catch(e){} },inactivite);
    };
    const eteindre=()=>{ if(veille) clearTimeout(veille); veille=null; };
    if(x.upload){
      x.upload.onprogress=e=>{
        relancer();
        // `lengthComputable` est faux quand la taille n'est pas connue : on
        // n'invente pas un pourcentage, on laisse l'appelant afficher l'attente.
        if(e.lengthComputable&&typeof surProgres==='function') surProgres(e.loaded,e.total);
      };
    }
    x.onload=()=>{
      eteindre();
      if(x.status>=200&&x.status<300) resolve(x.responseText);
      else{
        const err=new Error('Erreur serveur '+x.status);
        /** @type {any} */(err).statut=x.status;
        /** @type {any} */(err).corps=String(x.responseText||'').slice(0,500);
        reject(err);
      }
    };
    x.onerror=()=>{ eteindre(); const e=new Error('Réseau indisponible'); /** @type {any} */(e).reseau=true; reject(e); };
    x.onabort=()=>{
      eteindre();
      // UN ABANDON N'EST PAS TOUJOURS UNE ANNULATION : la veille d'inactivité
      // coupe par le même chemin, et les deux ne se disent pas pareil.
      if(mortParInactivite){ const e=new Error('Délai dépassé'); /** @type {any} */(e).reseau=true; reject(e); }
      else reject(new Error('Envoi annulé'));
    };
    x.ontimeout=()=>{ eteindre(); const e=new Error('Délai dépassé'); /** @type {any} */(e).reseau=true; reject(e); };
    // LE SIGNAL D'ANNULATION, quand l'appelant en pose un : c'est par lui que
    // le bouton du panneau et la file d'attente coupent le même envoi.
    if(o.signal){
      if(o.signal.aborted){ eteindre(); reject(new Error('Envoi annulé')); return; }
      try{ o.signal.addEventListener('abort',()=>{ try{ x.abort(); }catch(e){} },{once:true}); }catch(e){}
    }
    relancer();
    x.send(corps);
  });
  /** @type {any} */(p).xhr=x;
  return p;
}

// ══════════════ L'ENVOI PAR MORCEAUX, REPRENABLE ═══════════════════════════
//
// Un seul POST de quatre-vingts mégaoctets sur un réseau mobile, c'est une
// minute et demie pendant laquelle UNE coupure d'ascenseur renvoie tout à
// zéro. Découpé, on ne reperd que le morceau en cours.
//
// ⚠ LE PROTOCOLE CLOUDINARY SE RESPECTE AU MOT PRÈS, et chacune de ses règles
//   a coûté cher à quelqu'un :
//   · X-Unique-Upload-Id IDENTIQUE sur tous les morceaux d'un fichier, et
//     UNIQUE entre deux fichiers — deux envois simultanés qui partageraient
//     l'identifiant se mélangeraient en une seule vidéo illisible.
//   · Content-Range en indices INCLUSIFS, et le total est celui du fichier
//     ENTIER, jamais celui du morceau.
//   · Chaque morceau fait au moins cinq mégaoctets, SAUF LE DERNIER. Un
//     morceau plus petit au milieu est refusé, et le refus arrive tard.
//   · SEULE LA RÉPONSE DU DERNIER MORCEAU porte secure_url et public_id. Les
//     autres rendent un accusé de réception sans lien.

/** Six mégaoctets. Au-dessus du minimum de cinq, et assez gros pour que les
 *  allers-retours ne mangent pas le gain sur un fichier de cent mégaoctets. */
const ENVOI_MORCEAU_OCTETS=6*1024*1024;
/** Le plancher du protocole. Un morceau plus petit — hors le dernier — est
 *  refusé par Cloudinary. */
const ENVOI_MORCEAU_MIN=5*1024*1024;
/** Trois tentatives par morceau, puis on rend la main. Les temporisations
 *  triplent : une seconde absorbe un changement d'antenne, neuf secondes
 *  absorbent un ascenseur, au-delà c'est que le réseau n'est pas là. */
const ENVOI_TENTATIVES=3;
const ENVOI_ATTENTES_MS=Object.freeze([1000,3000,9000]);

/**
 * PURE. Au-delà du plafond par requête, le fichier part en morceaux — en
 * dessous, l’envoi simple. Le découpage coûte des allers-retours qui ne se
 * justifient pas sur quinze mégaoctets.
 * @param {number} octets @returns {boolean}
 */
function _envoiDecoupeRequis(octets){ return Number(octets)>VIDEO_MAX_OCTETS_REQUETE; }
/**
 * PURE. Le découpage d'un fichier, en indices INCLUSIFS.
 * ⚠ LE DERNIER MORCEAU PEUT ÊTRE PLUS PETIT QUE LE PLANCHER, et lui seul.
 *   Un reste de deux cent mille octets est un dernier morceau valide.
 * @param {number} total  octets du fichier entier
 * @param {number} [taille]
 * @returns {{i:number, debut:number, fin:number, octets:number}[]}
 */
function _envoiMorceaux(total,taille){
  const T=Math.max(0,Math.round(Number(total)||0));
  const C=Math.max(1,Math.round(Number(taille)||ENVOI_MORCEAU_OCTETS));
  const out=[];
  if(!T) return out;
  for(let d=0,i=0;d<T;d+=C,i++){
    const f=Math.min(T-1,d+C-1);
    out.push({i,debut:d,fin:f,octets:f-d+1});
  }
  return out;
}
/**
 * PURE. « bytes 0-6291455/19123456 ». Les indices sont INCLUSIFS — `fin` est
 * le dernier octet envoyé, pas le premier du suivant — et le total est celui
 * du fichier entier.
 * @param {number} debut @param {number} fin @param {number} total
 * @returns {string}
 */
function _envoiContentRange(debut,fin,total){
  return 'bytes '+Math.round(debut)+'-'+Math.round(fin)+'/'+Math.round(total);
}
/** Un identifiant d'envoi. Horodatage ET aléa : deux fichiers choisis dans la
 *  même milliseconde — ça arrive, un sélecteur multiple — auraient sinon le
 *  même, et Cloudinary les recollerait en une seule vidéo. */
function _envoiIdUnique(){
  return 'rc'+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
}
/**
 * PURE. Ce qui vaut la peine d'être réessayé : une panne de réseau, ou un
 * serveur qui a un mauvais moment.
 * ⚠ UN 4xx EST DÉFINITIF. Un preset invalide, un fichier refusé, un morceau
 *   hors séquence : réessayer trois fois ne changerait rien et ferait attendre
 *   treize secondes de plus pour le même refus.
 * @param {any} e
 * @returns {boolean}
 */
function _envoiReessayable(e){
  if(!e) return false;
  if(e.reseau) return true;
  const st=Number(e.statut);
  if(st>=500&&st<600) return true;
  if(st>=400&&st<500) return false;
  return /réseau|reseau|network/i.test(String(e.message||''));
}

/**
 * L'ENVOI DÉCOUPÉ. Rend le corps de la réponse du DERNIER morceau — c'est le
 * seul qui porte le lien.
 *
 * @param {string} url
 * @param {File|Blob} file
 * @param {Object<string,string>} champs  les champs SIGNÉS rendus par _cloudinarySigner
 * @param {{onProgres?:(charge:number,total:number)=>void, signal?:any,
 *          tailleMorceau?:number, onMorceau?:(i:number,n:number)=>void}} [opt]
 * @returns {Promise<string>}
 */
async function _envoiXhrDecoupe(url,file,champs,opt){
  const o=opt||{};
  const total=file.size;
  const morceaux=_envoiMorceaux(total,o.tailleMorceau);
  if(!morceaux.length) throw new Error('Fichier vide');
  const id=_envoiIdUnique();
  let dejaEnvoye=0, dernier='';
  for(const m of morceaux){
    if(o.signal&&o.signal.aborted) throw new Error('Envoi annulé');
    if(typeof o.onMorceau==='function') o.onMorceau(m.i,morceaux.length);
    let erreur=null;
    for(let t=0;t<ENVOI_TENTATIVES;t++){
      try{
        const fd=new FormData();
        fd.append('file',file.slice(m.debut,m.fin+1),/** @type {any} */(file).name||'video');
        for(const k in (champs||{})) fd.append(k,champs[k]);
        dernier=await _envoiXhr(url,fd,
          // ⚠ LA PROGRESSION EST CELLE DU FICHIER, PAS DU MORCEAU. Une jauge
          //   qui repart à zéro tous les six mégaoctets est pire que pas de
          //   jauge : on croit que l'envoi recommence.
          (charge)=>{ if(typeof o.onProgres==='function') o.onProgres(Math.min(total,dejaEnvoye+charge),total); },
          {signal:o.signal,timeoutMs:ENVOI_MORCEAU_TIMEOUT_MS,
           entetes:{'X-Unique-Upload-Id':id,'Content-Range':_envoiContentRange(m.debut,m.fin,total)}});
        erreur=null;
        break;
      }catch(e){
        erreur=e;
        if(o.signal&&o.signal.aborted) throw e;
        if(/annulé/i.test(String(e&&e.message))) throw e;
        if(!_envoiReessayable(e)||t===ENVOI_TENTATIVES-1) break;
        await new Promise(r=>setTimeout(r,ENVOI_ATTENTES_MS[t]||ENVOI_ATTENTES_MS[ENVOI_ATTENTES_MS.length-1]));
      }
    }
    if(erreur) throw erreur;
    dejaEnvoye+=m.octets;
    if(typeof o.onProgres==='function') o.onProgres(dejaEnvoye,total);
  }
  return dernier;
}


// ══════════════ LA FILE QUI SURVIT À LA FERMETURE ══════════════════════════
//
// Un envoi de quatre-vingts mégaoctets prend deux minutes. Pendant ces deux
// minutes, l'athlète verrouille son téléphone, prend un appel, ou l'app passe
// en arrière-plan — et le transfert meurt avec l'onglet. Au retour, RIEN ne
// disait qu'une vidéo avait failli partir.
//
// ⚠ ON PROPOSE, ON NE REPREND JAMAIS D'OFFICE. Une reprise silencieuse qui
//   consomme cent trente mégaoctets de forfait sans prévenir est un abus, et
//   c'est exactement ce que fait la concurrence. Le geste est explicite, et le
//   poids est écrit sur le bouton.
//
// ⚠ LE BLOB VIT DANS INDEXEDDB, PAS DANS LE DOCUMENT. Aucun octet de vidéo
//   n'approche de `users/{email}` : le document est relu et réécrit en entier
//   à chaque poussée, et c'est ce volume qui est le plafond de RepCore.

const ENVOI_FILE_BASE='repcore-envois';
const ENVOI_FILE_MAGASIN='attente';
/**
 * VINGT-QUATRE HEURES. Au-delà, la vidéo décrit une séance d'hier : la
 * proposer reviendrait à faire payer un envoi pour un contenu que personne
 * n'attend plus. Et garder des blobs de cent mégaoctets indéfiniment remplit
 * le stockage du téléphone sans que rien ne le dise.
 */
const ENVOI_FILE_MAX_MS=24*3600*1000;

/** La base, ouverte à la demande. Rend null si IndexedDB n'est pas là —
 *  navigation privée, vieux navigateur — et la file devient alors un
 *  non-événement : l'envoi marche exactement comme avant. */
function _fileOuvrir(){
  return new Promise(res=>{
    try{
      if(typeof indexedDB==='undefined') return res(null);
      const r=indexedDB.open(ENVOI_FILE_BASE,1);
      r.onupgradeneeded=()=>{
        const db=r.result;
        if(!db.objectStoreNames.contains(ENVOI_FILE_MAGASIN))
          db.createObjectStore(ENVOI_FILE_MAGASIN,{keyPath:'id'});
      };
      r.onsuccess=()=>res(r.result);
      r.onerror=()=>res(null);
      r.onblocked=()=>res(null);
    }catch(e){ res(null); }
  });
}
/** @param {IDBDatabase|null} db @param {string} mode */
function _fileMagasin(db,mode){
  if(!db) return null;
  try{ return db.transaction(ENVOI_FILE_MAGASIN,mode).objectStore(ENVOI_FILE_MAGASIN); }
  catch(e){ return null; }
}
/** @param {IDBRequest} r */
function _fileAttendre(r){
  return new Promise(res=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); });
}
/**
 * PURE. Une entrée encore proposable ? Trop vieille, elle ne l'est plus.
 * @param {any} e @param {number} [maintenant]
 * @returns {boolean}
 */
function fileEnvoiFraiche(e,maintenant){
  const t=Number(maintenant)||Date.now();
  const c=Number(e&&e.cree);
  return !!(e&&e.blob&&c>0&&(t-c)<ENVOI_FILE_MAX_MS);
}
/**
 * Pose un envoi dans la file AVANT de le tenter. Rend l'identifiant, ou ''
 * quand la file n'est pas disponible — auquel cas l'envoi se poursuit sans
 * filet, comme avant ce lot.
 * @param {{blob:Blob, nom:string, emailCible:string, octetsOrigine:number,
 *          voieCompression:string, lien?:any}} e
 * @returns {Promise<string>}
 */
async function fileEnvoiPoser(e){
  const db=await _fileOuvrir();
  const m=_fileMagasin(db,'readwrite');
  if(!m){ try{ if(db) db.close(); }catch(x){} return ''; }
  const id='e_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  try{
    await _fileAttendre(m.put({id,cree:Date.now(),blob:e.blob,nom:String(e.nom||''),
      emailCible:String(e.emailCible||''),octetsOrigine:Number(e.octetsOrigine)||0,
      voieCompression:String(e.voieCompression||'aucune'),
      lien:(e.lien&&e.lien.exerciceCle)?e.lien:null}));
  }catch(x){ try{ db.close(); }catch(y){} return ''; }
  try{ db.close(); }catch(x){}
  return id;
}
/** Retire une entrée. Appelée à la confirmation Cloudinary, et sur un refus
 *  définitif : garder un fichier que le serveur refuse ne mène nulle part. */
async function fileEnvoiRetirer(id){
  if(!id) return false;
  const db=await _fileOuvrir();
  const m=_fileMagasin(db,'readwrite');
  if(!m){ try{ if(db) db.close(); }catch(x){} return false; }
  try{ await _fileAttendre(m.delete(id)); }catch(x){}
  try{ db.close(); }catch(x){}
  return true;
}
/** Les entrées encore fraîches, les périmées purgées au passage. */
async function fileEnvoiLister(maintenant){
  const db=await _fileOuvrir();
  const m=_fileMagasin(db,'readwrite');
  if(!m){ try{ if(db) db.close(); }catch(x){} return []; }
  const tout=await _fileAttendre(m.getAll());
  const l=Array.isArray(tout)?tout:[];
  const bonnes=[], vieilles=[];
  for(const e of l) (fileEnvoiFraiche(e,maintenant)?bonnes:vieilles).push(e);
  // LA PURGE SE FAIT EN LISANT, pas dans un balayage à part : c'est le seul
  // moment où on sait qu'on a la main sur la base, et un blob de cent
  // mégaoctets oublié pèse sur le stockage du téléphone.
  for(const v of vieilles){ try{ m.delete(v.id); }catch(x){} }
  try{ db.close(); }catch(x){}
  return bonnes;
}

/** Le carton de reprise, posé une seule fois par session. */
let _repriseMontree=false;
/**
 * AU DÉMARRAGE : on PROPOSE. Le carton dit ce qui reste, combien ça pèse, et
 * offre les deux issues — reprendre, ou oublier. Rien ne part tant que
 * personne n'a touché un bouton.
 */
async function proposerRepriseEnvoi(){
  if(_repriseMontree||!currentUser) return false;
  _repriseMontree=true;
  let l=[];
  try{ l=await fileEnvoiLister(); }catch(e){ return false; }
  const e=l.filter(x=>x.emailCible===currentUser.email)[0];
  if(!e) return false;
  const z=document.createElement('div');
  z.id='rc-reprise';
  z.className='rc-envoi';
  z.setAttribute('role','status');
  z.innerHTML='<div class="rc-envoi-t">Un envoi n’est pas allé au bout</div>'
    +'<div class="rc-envoi-n" style="display:block">'+escapeHtml(e.nom||'Une vidéo')
    +' · '+_mo(e.blob.size)+' · '+new Date(e.cree).toLocaleString('fr-FR')
    +'. Rien ne repart tant que tu ne le demandes pas.</div>'
    +'<button type="button" class="rc-envoi-x" id="rc-reprise-go">Reprendre l’envoi ('+_mo(e.blob.size)+')</button>'
    +'<button type="button" class="rc-envoi-x" id="rc-reprise-non">Oublier cette vidéo</button>';
  document.body.appendChild(z);
  const partir=()=>{ try{ z.remove(); }catch(x){} };
  const go=document.getElementById('rc-reprise-go');
  const non=document.getElementById('rc-reprise-non');
  if(go) go.onclick=()=>{ partir(); reprendreEnvoi(e.id); };
  if(non) non.onclick=()=>{ partir(); fileEnvoiRetirer(e.id); toast('Envoi oublié'); };
  return true;
}
/**
 * LA REPRISE, sur geste explicite. Elle repasse par uploadVideoFile — le
 * chemin d'envoi unique — avec le blob DÉJÀ allégé : on ne recompresse pas ce
 * qui l'a été.
 */
async function reprendreEnvoi(id){
  let l=[];
  try{ l=await fileEnvoiLister(); }catch(e){ return false; }
  const e=l.filter(x=>x.id===id)[0];
  if(!e){ toast('Cet envoi n’est plus disponible.','var(--orange)'); return false; }
  const f=new File([e.blob],(e.nom||'video')+'.mp4',{type:e.blob.type||'video/mp4'});
  // ⚠ `dejaAllege` COUPE LA PHASE DE COMPRESSION : le blob en file est déjà
  //   passé par elle, et la repasser coûterait une seconde compression pour
  //   un résultat identique — ou pire, plus lourd.
  await uploadVideoFile({files:[f],value:''},
    {nom:e.nom,lien:e.lien||null,dejaAllege:true,octetsOrigine:e.octetsOrigine,
     voieCompression:e.voieCompression,fileId:e.id});
  return true;
}

/**
 * PURE au sens de l'effet : la durée d'une vidéo, lue par un élément caché.
 * Rend null quand le navigateur ne sait pas lire le fichier — c'est un cas
 * fréquent (un .mov HEVC sur un Chrome de bureau) et ce n'est pas une raison
 * de refuser l'envoi : on ne bloque que sur ce qu'on SAIT.
 * @param {File|Blob} file
 * @returns {Promise<number|null>}
 */
function _videoDureeS(file){
  return new Promise(res=>{
    let url='';
    const v=document.createElement('video');
    const finir=(d)=>{
      try{ v.removeAttribute('src'); v.load(); }catch(e){}
      try{ if(url) URL.revokeObjectURL(url); }catch(e){}
      try{ v.remove(); }catch(e){}
      res(d);
    };
    const garde=setTimeout(()=>finir(null),8000);
    v.preload='metadata'; v.muted=true;
    v.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    v.onloadedmetadata=()=>{ clearTimeout(garde);
      finir(isFinite(v.duration)&&v.duration>0?v.duration:null); };
    v.onerror=()=>{ clearTimeout(garde); finir(null); };
    try{ url=URL.createObjectURL(file); }catch(e){ clearTimeout(garde); finir(null); return; }
    document.body.appendChild(v);
    v.src=url;
  });
}
/** « 2 min 05 s » — la durée telle qu'on la dit à quelqu'un. */
function _dureeTexte(s){
  const n=Math.round(Number(s)||0);
  const m=Math.floor(n/60), r=n%60;
  return m?(m+' min'+(r?' '+(r<10?'0':'')+r+' s':'')):(n+' s');
}

async function uploadVideoFile(input,options){
  const _opt=options||{};
  const file=input.files[0];if(!file) return;
  const errEl=document.getElementById('vid-upload-error');
  const progEl=document.getElementById('vid-upload-progress');
  const dire=(txt)=>{ if(errEl){ errEl.style.display='block'; errEl.textContent=txt; } };
  // ══ LE MOUCHARD D'ENVOI ═══════════════════════════════════════════════════
  //
  // UN ENVOI QUI ÉCHOUE NE LAISSE AUCUNE TRACE AILLEURS QUE SUR L'ÉCRAN, et
  // l'écran, personne ne le relit. Quand l'athlète dit « ça ne part pas », il
  // n'y a rien à regarder : le dossier n'a pas bougé, et c'est précisément
  // parce que rien n'a été écrit.
  //
  // On note donc l'ÉTAPE atteinte, et on la pousse. Quelques dizaines d'octets
  // qui disent où ça s'arrête — la taille du fichier, sa durée, la voie
  // d'allègement, le message d'erreur — sans rien du contenu de la vidéo.
  // Effacé dès qu'un envoi aboutit : ce champ ne décrit QUE le dernier échec.
  const noter=(etape,detail)=>{
    try{
      if(!currentUser) return;
      currentUser.videoDiag={ quand:Date.now(), build:String(window.RC_BUILD||'?'),
        etape:String(etape), detail:String(detail==null?'':detail).slice(0,180),
        octets:(file&&file.size)||0, type:(file&&file.type)||'' };
      saveUser();
    }catch(e){}
  };
  if(errEl) errEl.style.display='none';
  // La confirmation du PRECEDENT envoi part tout de suite : la laisser sous un
  // fichier refuse reviendrait a annoncer une reussite qui n'a pas eu lieu.
  if(progEl){ progEl.style.display='none'; progEl.textContent=''; }

  // ══ 1. CE QUI SE REFUSE AVANT TOUTE ATTENTE ══════════════════════════════
  //
  // ⚠ ON NE FAIT PLUS PAYER DEUX MINUTES POUR UN REFUS PRÉVISIBLE. Tout ce
  //   qui se sait en une seconde se dit en une seconde, AVEC l'issue concrète
  //   — pas seulement le refus.
  if(!file.type.startsWith('video/')){
    dire('Fichier invalide : sélectionne une vidéo (MP4, MOV, WebM…)');
    noter('refus_type',(file&&file.type)||'');
    input.value='';return;
  }
  // ══ LE SERVICE EST-IL EN CHARGE ? ════════════════════════════════════════
  //
  // Au-delà de 85 % du quota, la synchronisation périodique ralentit déjà. UNE
  // VIDÉO EST LE PLUS GROS ENVOI DE L'APPLICATION : c'est le seul endroit où
  // demander, poliment, si ça peut attendre ce soir change quelque chose.
  //
  // ⚠ ON NE REFUSE JAMAIS. Une série filmée ne se refilme pas, et un garde-fou
  //   de coût qui empêcherait d'envoyer sa vidéo serait un défaut, pas une
  //   protection. On PROPOSE de différer ; la file persistante existe déjà pour
  //   ça, et elle propose la reprise au démarrage suivant — jamais d'office.
  // ⚠ UN ENVOI REPRIS DEPUIS LA FILE NE SE REPROPOSE PAS : il vient DE la
  //   file, et lui offrir d'y retourner l'y enfermerait pour de bon.
  if(quotaDegrade()&&!_opt.fileId&&!_opt.dejaAllege){
    const differer=await rcConfirm(
      'Le service est en charge : ton envoi peut attendre ce soir.\n\n'
      +'La vidéo est gardée sur ton téléphone et te sera proposée à la prochaine '
      +'ouverture de l’app. Tu peux aussi l’envoyer maintenant, ça marchera.',
      // rcConfirm(titre, texte, libelleOk, libelleNon) : le LIBELLE DU OUI est
      // « Attendre ce soir », donc rendre vrai veut dire differer. Ecrit sans
      // le `null`, le grand message servait de titre ET « Attendre ce soir »
      // devenait le texte : le bouton d'accord disait « Envoyer maintenant »
      // et repondre oui aurait differe. L'inverse exact de ce qu'il affichait.
      null,'Attendre ce soir','Envoyer maintenant');
    if(differer){
      const id=await fileEnvoiPoser({blob:file,nom:_opt.nom||file.name||'video',
        emailCible:(currentUser&&currentUser.email)||'',octetsOrigine:file.size,
        voieCompression:'aucune',lien:_opt.lien}).catch(()=>'');
      if(id){
        toast('Gardée sur ton téléphone. Je te la proposerai à la prochaine ouverture.','var(--green)');
        input.value=''; return;
      }
      // La file n'a pas voulu : on ne perd pas la vidéo pour autant, on envoie.
      toast('Je n’ai pas pu la mettre de côté : on l’envoie maintenant.','var(--orange)');
    }
  }
  if(file.size>VIDEO_MAX_OCTETS_TOTAL){
    dire('Fichier trop volumineux ('+_mo(file.size)+', maximum '+_mo(VIDEO_MAX_OCTETS_TOTAL)
      +'). Filme plus court, ou baisse la qualité vidéo dans les réglages du téléphone.');
    noter('refus_taille',file.size);
    input.value='';return;
  }
  // LA DURÉE, quand le navigateur sait la lire. Un fichier illisible ici n'est
  // pas refusé : c'est souvent un .mov HEVC que le téléphone de l'athlète,
  // lui, lit très bien.
  const dureeS=await _videoDureeS(file);
  if(dureeS!=null&&dureeS>VIDEO_DUREE_MAX_S){
    dire('Vidéo trop longue ('+_dureeTexte(dureeS)+', maximum '+_dureeTexte(VIDEO_DUREE_MAX_S)
      +'). Découpe la série qui t’intéresse : le coach regarde le mouvement, pas la séance.');
    noter('refus_duree',dureeS);
    input.value='';return;
  }

  const targetEmail=currentUser.email; // capturé avant tout await

  // Cherche la config Cloudinary du coach (ou de l'utilisateur lui-même si solo)
  // Le compte Cloudinary et les champs d'envoi viennent de la SIGNATURE,
  // demandee juste avant l'envoi (voir _cloudinarySigner).
  const folder='repcore/'+(currentUser.id||currentUser.email);
  let cloudName='dntu57ml';

  // Le panneau flottant est le SEUL affichage commun aux deux ecrans d'envoi :
  // `vid-upload-progress` n'existe pas au milieu d'une seance.
  const pan=_envoiPanneau('Préparation de la vidéo');
  const ctrl=(typeof AbortController==='function')?new AbortController():null;
  // UN CONTRÔLEUR PROPRE À L'ALLÈGEMENT. Il partage le bouton « Annuler » avec
  // l'envoi, mais le délai de garde ci-dessous doit pouvoir couper la
  // compression SANS couper le transfert qui la suit.
  const ctrlAlleg=(typeof AbortController==='function')?new AbortController():null;
  if(ctrl) pan.annuler(()=>{
    try{ ctrl.abort(); }catch(e){}
    try{ if(ctrlAlleg) ctrlAlleg.abort(); }catch(e){}
  });
  pan.maj(0,file.size);
  if(progEl){progEl.style.display='block';progEl.textContent='Préparation…';}
  noter('demarre',dureeS==null?'duree illisible':dureeS+' s');
  // L'ENTREE DE FILE, DECLAREE HORS DU try (01/10/2026, trouve par le lint) :
  // posee dedans avec `let`, elle etait invisible du catch, ou `typeof fileId`
  // valait toujours 'undefined' — un refus definitif ne vidait jamais la file.
  let fileId='';
  try{
    // ══ 2. ALLÉGER. Le panneau dit « Allègement », jamais « Envoi » : rien
    //    n'est parti, et quelqu'un qui coupe ici ne coupe pas un envoi.
    let aEnvoyer=file, voie=_opt.voieCompression||'aucune', raisonVoie='';
    const RCV=/** @type {any} */(window).RepCoreVideo;
    // ⚠ UNE REPRISE NE REPASSE PAS PAR LA COMPRESSION. Le blob gardé en
    //   file en sort déjà : le recompresser coûterait une seconde attente
    //   pour un résultat identique, ou plus lourd.
    if(!_opt.dejaAllege&&RCV&&typeof RCV.compresser==='function'){
      pan.titre('Allègement de la vidéo');
      // ⚠ UNE COMPRESSION QUI NE REND JAMAIS LA MAIN RETIENT LA VIDÉO POUR
      //   TOUJOURS. La voie `recorder` rejoue le fichier en temps réel : sur un
      //   téléphone qui se verrouille, ou un onglet passé en arrière-plan, le
      //   décodage s'arrête et la promesse ne se résout jamais. Le panneau reste
      //   sur « Allègement… », aucune entrée n'est écrite, et l'athlète voit
      //   simplement que sa vidéo « ne part pas » — sans erreur, sans rien.
      //
      //   LE DÉLAI EST LARGE, parce que la voie temps réel est LENTE PAR NATURE :
      //   deux fois la durée de la vidéo, plus vingt secondes, jamais moins de
      //   quarante-cinq. On n'attrape que le blocage, pas la lenteur normale.
      //   Au-delà, on coupe l'allègement et le fichier d'origine part.
      const _plafondAllegMs=Math.max(45000,Math.round((dureeS>0?dureeS:0)*2000)+20000);
      let _allegDepasse=false;
      const res=await Promise.race([
        RCV.compresser(file,{
        hauteur:VIDEO_CIBLE_HAUTEUR,debit:VIDEO_CIBLE_DEBIT,dureeMaxS:VIDEO_DUREE_MAX_S,
        // ⚠ PAS DE VOIE TEMPS RÉEL. WebCodecs allège en une seconde ou ne fait
        //   rien ; `recorder`, lui, rejoue la vidéo à vitesse normale et rend
        //   soit un clip d'une image, soit rien du tout. Quand WebCodecs ne
        //   peut pas, LE FICHIER PART TEL QUEL — c'est plus lourd, et ça arrive.
        sansRecorder:true,
        signal:ctrlAlleg?ctrlAlleg.signal:null,
        onVoie:(v)=>{
          // LE TEMPS RÉEL S'ANNONCE. La voie MediaRecorder rejoue la vidéo à
          // vitesse normale : laisser croire que c'est instantané, c'est
          // garantir qu'on coupe au bout de dix secondes.
          if(v==='recorder'&&dureeS) pan.note('Allègement en temps réel : compte environ '+_dureeTexte(dureeS)+'.');
        },
        onProgres:(p)=>{
          const pct=Math.max(0,Math.min(100,Math.round(p*100)));
          pan.maj(pct,100);
          if(progEl) progEl.textContent='Allègement… '+pct+' %';
        }
        }).catch(e=>{
          // ⚠ UNE ANNULATION N'EST PAS UNE PANNE D'ALLÈGEMENT. Elle doit
          //   REMONTER et arrêter tout l'envoi : avalée ici, elle laissait
          //   partir le fichier d'origine que l'athlète venait justement de
          //   refuser, et une entrée était écrite malgré l'annulation.
          //   Seules les vraies pannes retombent sur l'envoi tel quel.
          if(/annul/i.test(String(e&&e.message))) throw e;
          return null;
        }),
        new Promise(r=>setTimeout(()=>{ _allegDepasse=true; r(null); },_plafondAllegMs))
      ]);
      // COUPER CE QUI TOURNE ENCORE : sans ça, une compression abandonnée
      // continue de décoder pendant que l'envoi démarre.
      if(_allegDepasse){ try{ if(ctrlAlleg) ctrlAlleg.abort(); }catch(e){} }
      // ⚠ UNE VIDÉO ALLÉGÉE QUI A PERDU SA DURÉE N'EST PLUS LA VIDÉO.
      //
      // La voie `recorder` rejoue le fichier EN TEMPS RÉEL dans un
      // MediaRecorder. Si le décodage s'arrête en route — onglet passé en
      // arrière-plan, téléphone verrouillé, source que le navigateur ne sait
      // pas relire — elle rend un clip d'UNE IMAGE, sans lever la moindre
      // erreur. Mesuré sur un clip de 2,0 s : la sortie faisait 0,033 s et
      // 2,7 Ko, et Cloudinary l'acceptait sans broncher. L'athlète croyait
      // avoir envoyé sa série ; le coach recevait un trentième de seconde.
      //
      // ON NE COMPARE PAS LES OCTETS MAIS LA DURÉE : un allègement qui marche
      // divise légitimement le poids par vingt, jamais la durée. Le seuil est
      // large — 80 % — parce qu'un réencodage peut rogner quelques dixièmes en
      // fin de fichier, et qu'on ne veut refuser QUE l'effondrement.
      let _dureeApres=null;
      if(res&&res.blob&&dureeS>0){
        try{ _dureeApres=await _videoDureeS(new File([res.blob],'v.mp4',
          {type:res.blob.type||'video/mp4'})); }catch(e){ _dureeApres=null; }
      }
      // DURÉE ILLISIBLE : ON NE BLOQUE PAS. Même raison qu'au contrôle d'entrée
      // — un fichier que le navigateur ne sait pas ouvrir n'est pas un fichier
      // cassé, et refuser sur une lecture manquée coûterait plus que ça ne rend.
      const _dureeEffondree=(dureeS>0&&_dureeApres!=null&&_dureeApres<dureeS*0.8);
      if(res&&res.blob&&!_dureeEffondree){
        aEnvoyer=new File([res.blob],(file.name||'video').replace(/\.[^.]+$/,'')+'.mp4',
          {type:res.blob.type||'video/mp4'});
        voie=res.voie;
        pan.note('Allégée : '+_mo(res.octetsAvant)+' → '+_mo(res.octetsApres)
          +' en '+res.hauteur+'p'+(res.sansAudio?', sans le son':''));
      } else if(_dureeEffondree){
        // L'ORIGINAL PART À LA PLACE, et on dit pourquoi : c'est le seul cas où
        // l'app a fabriqué elle-même un fichier inutilisable.
        raisonVoie='duree_effondree';
        pan.note('L’allègement a abîmé la vidéo ('+_dureeTexte(_dureeApres)+' au lieu de '
          +_dureeTexte(dureeS)+') : elle part telle quelle, '+_mo(file.size)+'.');
      } else if(_allegDepasse){
        raisonVoie='allegement_trop_long';
        pan.note('L’allègement a pris trop de temps sur ce téléphone : la vidéo part '
          +'telle quelle, '+_mo(file.size)+'. Garde l’écran allumé pendant l’envoi.');
      } else {
        raisonVoie=(res&&res.raison)||'';
        // ⚠ ON LE DIT. Un silence ici, et l'athlète attend trois minutes sans
        //   savoir pourquoi — et sans savoir quoi faire la prochaine fois.
        pan.note('Ton téléphone ne sait pas alléger cette vidéo. Elle part telle quelle : '
          +_mo(file.size)+'. Filme plus court, ou baisse la qualité vidéo dans les réglages du téléphone.');
      }
    }
    if(ctrl&&ctrl.signal.aborted) throw new Error('Envoi annulé');
    // ⚠ LE PLAFOND SE REVÉRIFIE APRÈS COUP. Une vidéo non allégée peut passer
    //   le plafond total et rester au-dessus du plafond par requête : c'est
    //   exactement le cas qui part en morceaux.
    // APRÈS L'ALLÈGEMENT, SUR CE QUI PART VRAIMENT. C'est ici que le plafond de
    // Cloudinary s'applique — et le message doit dire quoi faire, parce qu'à ce
    // stade l'athlète a déjà attendu.
    if(aEnvoyer.size>VIDEO_MAX_OCTETS_ENVOI){
      noter('trop_lourd_apres_allegement',aEnvoyer.size+' o (voie '+voie+')');
      throw new Error('Même allégée, la vidéo pèse '+_mo(aEnvoyer.size)
        +' et le serveur n’accepte pas au-delà de '+_mo(VIDEO_MAX_OCTETS_ENVOI)
        +'. Filme la série seule, ou baisse la qualité vidéo dans les réglages du téléphone.');
    }

    // ══ 3. ENVOYER. La jauge repart de zéro : ce sont d'autres octets.
    //
    // ⚠ ON POSE DANS LA FILE AVANT DE TENTER. Le téléphone qui se verrouille
    //   pendant deux minutes d’envoi tue le transfert avec l’onglet : sans
    //   cette ligne, rien au retour ne dirait qu’une vidéo a failli partir.
    fileId=_opt.fileId||'';
    if(!fileId){
      try{ fileId=await fileEnvoiPoser({blob:aEnvoyer,nom:_opt.nom||file.name||'',
        emailCible:targetEmail,octetsOrigine:_opt.octetsOrigine||file.size,voieCompression:voie,
        lien:_opt.lien||null}); }catch(e){ fileId=''; }
    }
    pan.titre('Envoi de la vidéo');
    pan.maj(0,aEnvoyer.size);
    noter('envoi_lance',voie+' · '+aEnvoyer.size+' o'
      +(_envoiDecoupeRequis(aEnvoyer.size)?' · en morceaux':' · en une fois'));
    const surProgres=(charge,total)=>{
      pan.maj(charge,total);
      if(progEl) progEl.textContent='Envoi… '+(total>0?Math.round(charge/total*100):0)+' %';
      // Les octets sont partis : ce qui reste est le travail de Cloudinary.
      if(total>0&&charge>=total){
        pan.attente('Traitement de la vidéo…');
        if(progEl) progEl.textContent='Traitement de la vidéo…';
      }
    };
    // SIGNE, APRES la mise en file : un refus laisse la video dans la file.
    const sig=await _cloudinarySigner(folder,'video');
    cloudName=sig.cloudName||cloudName;
    const cible=sig.url;
    let brut;
    if(_envoiDecoupeRequis(aEnvoyer.size)){
      // AU-DELÀ DU PLAFOND PAR REQUÊTE : en morceaux. En dessous on garde
      // l'envoi simple — le découpage coûte des allers-retours qui ne se
      // justifient pas sur quinze mégaoctets.
      brut=await _envoiXhrDecoupe(cible,aEnvoyer,sig.champs,
        {onProgres:surProgres,signal:ctrl?ctrl.signal:null,
         onMorceau:(i,n)=>{ pan.note('Morceau '+(i+1)+' sur '+n+' · une coupure ne fait reperdre que celui-ci.'); }});
    } else {
      const fd=new FormData();
      fd.append('file',aEnvoyer);
      _champsDansFormData(fd,sig.champs);
      brut=await _envoiXhr(cible,fd,surProgres,{signal:ctrl?ctrl.signal:null});
    }
    let data;
    // Une reponse qui n'est pas du JSON est une panne cote serveur, pas un
    // envoi reussi : la laisser passer poserait une entree sans URL.
    try{ data=JSON.parse(brut); }
    catch(_){ throw new Error('Réponse illisible du serveur vidéo'); }
    if(data.error) throw new Error(data.error.message);
    if(!data.secure_url) throw new Error('Le serveur n’a pas renvoyé de lien');
    // CONFIRMÉ PAR CLOUDINARY : la file n’a plus rien à garder.
    if(fileId){ try{ await fileEnvoiRetirer(fileId); }catch(e){} }
    // ET LE COMPTE AGREGE : une video est le plus gros envoi de l'app, et
    // c'est celui qu'il faut voir sur l'ecran de capacite.
    try{ rcq('cld_envois',1);
      rcqOctets('cld_ko',Number(data.bytes)||(aEnvoyer&&aEnvoyer.size)||0); }catch(e){}
    const url=data.secure_url;
    const _saisi=_opt.nom||((document.getElementById('vid-name-input')||{}).value||'').trim();
    const name=_saisi||file.name.replace(/\.(mp4|mov|webm|mkv|avi)$/i,'');
    // ⚠ SEULEMENT L'URL ET DES METADONNEES. `url` est le lien Cloudinary, et
    // rien de ce qui suit ne porte d'octet de video ou de vignette : le
    // document Firebase est relu et reecrit en entier a chaque poussee, et
    // c'est ce volume-la qui est le plafond de RepCore.
    //
    // `octetsOrigine` et `voieCompression` sont deux CHAMPS COURTS — un nombre
    // et un mot — et ils servent : le coach qui trouve une video floue sait si
    // elle a ete reencodee, et nous savons quelle voie sert vraiment.
    const entry={id:'v_'+Date.now(),name,url,date:Date.now(),
      size:Math.round(aEnvoyer.size/1024/1024*10)/10+' Mo',
      octetsOrigine:_opt.octetsOrigine||file.size,voieCompression:voie,
      feedback:null,cloudinaryPublicId:data.public_id,cloudinaryName:cloudName};
    // LE RATTACHEMENT. Absent quand l'envoi ne vient pas d'une serie — et
    // absent vaut mieux qu'un objet a moitie rempli de nulls.
    if(_opt.lien&&_opt.lien.exerciceCle) entry.lien=_opt.lien;
    let _localOk=true;
    /** La poussée vers Firebase. C'est ELLE qui décide si le coach recevra. */
    let _envoi=null;
    if(currentUser?.email!==targetEmail){
      // Session changée pendant l'upload — écrire directement dans le compte cible
      const allUsers=DB.get('users')||{};
      const target=allUsers[targetEmail];
      if(!target){toast('Session expirée : vidéo non sauvegardée.','var(--orange)');pan.rate('Session expirée');if(progEl)progEl.style.display='none';input.value='';return;}
      if(!target.videos) target.videos=[];
      target.videos.push(entry);
      target.updatedAt=Date.now();
      allUsers[targetEmail]=target;
      _localOk=DB.set('users',allUsers);
      _envoi=CLOUD.pushOne(targetEmail,target);
    }else{
      if(!currentUser.videos) currentUser.videos=[];
      currentUser.videos.push(entry);
      consommerDemandeVideo(name,currentUser);
      // RÉUSSI : le champ ne doit plus décrire un échec qui n'existe plus. Posé
      // AVANT la poussée, sinon on enverrait le mouchard du coup précédent.
      try{ delete currentUser.videoDiag; }catch(e){}
      _localOk=saveUser();
      // ⚠ ON PREND LA PROMESSE DE LA POUSSÉE, ET ON L'ATTEND.
      //
      // saveUser() écrit en local et programme un envoi DIFFÉRÉ dont personne
      // ne lit le résultat. « Vidéo envoyée au coach » se disait donc sur la
      // seule écriture LOCALE : jeton expiré, réseau coupé, garde-fou de
      // version — l'athlète lisait le ✓ vert, le serveur ne recevait rien, et
      // le coach ne voyait jamais la vidéo. C'est exactement la leçon que
      // N3.18 impose déjà à cinq autres écritures ; celle-ci y avait échappé.
      if(CLOUD.canWrite()) _envoi=CLOUD.pushOne(currentUser.email,currentUser);
    }
    // ⚠ LA CONFIRMATION RESTE, elle ne se contente plus d'un toast. Le toast
    // dure trois secondes et part : quelqu'un qui a repose son telephone
    // pendant l'envoi ne le voit jamais, et ne sait pas si sa video est
    // partie. Le panneau se ferme seul ; la ligne sous le bouton, elle, tient
    // jusqu'au prochain envoi.
    const _nomEl=document.getElementById('vid-name-input'); if(_nomEl) _nomEl.value='';
    input.value='';
    // resterIci : envoye depuis la seance ou l'ecran de fin, on ne change pas
    // d'ecran. La liste des videos se repeint seulement si elle est affichee.
    if(!_opt.resterIci) loadVideos();
    else{ try{ const _sv=document.getElementById('s-videos'); if(_sv&&_sv.classList.contains('active')) _renderVideosListe(); }catch(e){} }
    // ══ ON N'ANNONCE RIEN AVANT QUE LE COACH PUISSE LA VOIR ══════════════════
    //
    // Le fichier est sur Cloudinary, l'entrée est écrite en local — mais tant
    // que la poussée n'a pas abouti, le coach n'a RIEN. Dire « envoyée au
    // coach » à ce stade est un mensonge, et c'est celui qui a coûté le plus
    // cher : l'athlète range son téléphone, le coach attend, et personne ne
    // sait que rien n'est parti.
    let _arrivee=true, _pourquoi='';
    try{ if(_envoi) await _envoi; }
    catch(e){ _arrivee=false; _pourquoi=String((e&&e.message)||e).slice(0,200); }
    if(_arrivee){
      pan.fini('Vidéo envoyée au coach');
      if(progEl){
        progEl.style.display='block';
        _texteIco(progEl,ICO.coche+' Vidéo envoyée au coach · '+name);
      }
      toastEcriture(_localOk,'Vidéo envoyée au coach !','la vidéo est référencée');
    }else{
      // ⚠ LA VIDÉO N'EST PAS PERDUE : elle est sur Cloudinary et dans la liste
      //   locale. Ce qui manque, c'est la synchronisation — et elle repartira
      //   d'elle-même à la prochaine écriture réussie. On le dit, plutôt que
      //   de laisser croire à un envoi abouti.
      noter('poussee_refusee',_pourquoi);
      pan.rate('Vidéo enregistrée, mais pas encore synchronisée');
      if(progEl){
        progEl.style.display='block';
        progEl.style.color='var(--orange)';
        // ⚠ LA RAISON S'AFFICHE, ET C'EST LE SEUL ENDROIT OÙ ELLE PEUT. Le
        //   mouchard s'écrit bien dans le dossier, mais il n'en sort QUE par la
        //   poussée — celle-là même qui vient d'être refusée. Tant qu'elle ne
        //   passe pas, l'écran est le seul canal vers l'extérieur, et un message
        //   qui tait la cause ne laisse rien à quoi se raccrocher.
        progEl.textContent='Vidéo gardée sur ton téléphone : elle n’est pas encore '
          +'arrivée chez ton coach.'+(_pourquoi?' Motif : '+_pourquoi:'')
          +' Vérifie ta connexion, puis rouvre l’app.';
      }
    }
  }catch(e){
    console.error('[uploadVideoFile]',e);
    // ⚠ UN REFUS DÉFINITIF VIDE LA FILE. Reproposer chaque matin un fichier
    //   que le serveur a refusé est une nuisance ; une coupure réseau, elle,
    //   garde son entrée — c’est exactement pour elle que la file existe.
    try{ if(fileId&&!_envoiReessayable(e)
      &&!/annulé/i.test(String(e&&e.message))) await fileEnvoiRetirer(fileId); }catch(x){}
    noter('echec',(e&&e.message)||String(e));
    const msg=_cloudinaryUserMsg(e,'video');
    pan.rate(msg);
    if(progEl) progEl.style.display='none';
    dire(msg);
    input.value='';
  }
}
// ══════════════ LA VIDEO RATTACHEE ═════════════════════════════════════
//
// UNE VIDEO SANS CHARGE N'EST QU'UN SOUVENIR. Rattachee a la serie, elle
// devient une donnee d'entrainement : deux prises du meme mouvement, a des
// charges connues, se comparent. C'est ce que le rattachement apporte, et
// c'est tout ce qu'il apporte — il ne change rien a l'hebergement.
//
// ⚠ LE VRAI RISQUE EST LE POIDS DES DONNEES, ET IL EST DEVANT LA PORTE.
// _doPushOne RELIT ET REECRIT LE DOCUMENT ENTIER a chaque poussee : le plafond
// de RepCore n'est pas un nombre d'utilisateurs, c'est le volume Firebase, et
// les photos de bilan en base64 y pesent deja. AUCUNE VIDEO, AUCUNE VIGNETTE
// ne doit entrer dans le document. Le fichier part sur Cloudinary ; le
// document ne porte que l'URL et les metadonnees — sept champs de nombres et
// de chaines courtes. Une assertion le garde.
//
// ⚠ ET LA CHARGE NE S'INVENTE PAS. `chargeKg` vaut null quand la serie n'en
// portait pas : un envoi depuis l'ecran Videos ne demande pas la charge, il
// laisse le champ vide. Une charge devinee ferait comparer deux prises sur un
// chiffre que personne n'a mesure — exactement le contraire du propos.

// PURE. Le lien d'une video a la serie qui l'a produite. Rend null quand il
// n'y a pas d'exercice a nommer : sans lui, il n'y a rien a comparer.
function lienVideoSerie(ex,set,options){
  const o=options||{};
  // ⚠ `ex.name||ex` RETOMBAIT SUR L'OBJET quand le nom etait vide, et
  // String(objet) rend « [object Object] » : exKey en tirait une clef
  // « OBJECT OBJECT », sous laquelle toutes les videos d'exercices sans nom se
  // seraient retrouvees ensemble — et se seraient comparees entre elles.
  // Mesure faite sur {name:''}.
  const nom=String((ex&&typeof ex==='object')?(ex.name||''):(ex||'')).trim();
  if(!nom) return null;
  let cle=''; try{ cle=exKey(nom)||''; }catch(e){ cle=''; }
  if(!cle) return null;
  const s=set||{};
  // LA CHARGE ET LES REPS VIENNENT DE LA SERIE, telles qu'elles y sont.
  const w=parseFloat(s.weight);
  const r=(typeof _perfReps==='function')?Number(_perfReps(s)):Number(s.reps);
  // RIR : la valeur saisie, ou null. « echec » est un RIR de 0 — c'est la
  // lecture que fait deja _perfRir, on ne s'en invente pas une seconde.
  let rir=null;
  if(s.rir==='echec') rir=0;
  else if(s.rir!==''&&s.rir!=null&&isFinite(Number(s.rir))) rir=Number(s.rir);
  const out={exerciceCle:cle,exerciceNom:nom,
    seance:String(o.seance||''),
    slot:(o.slot!=null&&isFinite(Number(o.slot)))?Number(o.slot):null,
    serieIdx:(typeof o.serieIdx==='number'&&o.serieIdx>=0)?o.serieIdx:null,
    chargeKg:(isFinite(w)&&w>0)?w:null,
    reps:(isFinite(r)&&r>0)?r:null,
    rir:rir,
    date:Number(o.date)||Date.now()};
  // LOT T3 : le tempo PRESCRIT à cette série, sous sa forme canonique, pour que
  // Motion Lab compare au tempo d'alors et non à celui d'aujourd'hui. Absent
  // quand il n'y en a pas (ou en texte libre) : rien ne change pour les autres.
  try{ const tl=(ex&&typeof ex==='object')?tempoLu(ex.tempo):null; if(tl) out.tempo=tl.canon; }catch(e){}
  return out;
}
// PURE. Le libelle de surimpression : la premiere chose que le coach doit
// lire. Rend '' quand rien n'est connu — un cartouche vide vaut mieux qu'un
// cartouche qui affiche « — kg ».
function libLienVideo(lien){
  if(!lien) return '';
  const p=[];
  if(lien.chargeKg!=null) p.push(String(lien.chargeKg).replace('.',',')+' kg');
  if(lien.reps!=null) p.push(lien.reps+' reps');
  if(lien.rir!=null) p.push('RIR '+lien.rir);
  return p.join(' · ');
}
// PURE. LA SERIE VISEE PAR « FILMER » : celle en cours, c'est-a-dire la
// premiere non validee. Quand tout est valide, la derniere — on filme souvent
// juste apres avoir coche.
function _videoSerieVisee(data){
  const sets=(data&&data.sets)||[];
  if(!sets.length) return -1;
  for(let i=0;i<sets.length;i++) if(sets[i]&&!sets[i].done) return i;
  return sets.length-1;
}

// ══ DEUX GESTES, ET PAS TROIS ══════════════════════════════════════════
//
// Le flux de correction technique passe aujourd'hui par Instagram. Ce module
// n'a d'interet que s'il est PLUS RAPIDE qu'un message : si le parcours en
// demande cinq, l'athlete retourne sur Instagram et le code meurt.
//
// LES GESTES, COMPTES : (1) toucher « Filmer », la camera du telephone
// s'ouvre — c'est `capture` qui l'ouvre, pas un ecran de plus ; (2) filmer et
// valider dans la camera. L'envoi part seul, avec la charge, les reps et le
// RIR deja rattaches. AUCUNE QUESTION N'EST POSEE : ni le nom de l'exercice,
// ni la charge, ni un titre. Toute question ajoutee ici est un geste de plus,
// et le module se rapproche de sa mort.
let _videoLienEnAttente=null, _videoSerieEnAttente=null;
function filmerSerie(idx){
  const ex=woState&&woState.exercises&&woState.exercises[idx];
  const data=woState&&woState.sessionData&&woState.sessionData[idx];
  if(!ex||!data) return false;
  const i=_videoSerieVisee(data);
  if(i<0) return false;
  _videoSerieEnAttente={idx,i};
  _videoLienEnAttente=lienVideoSerie(ex,data.sets[i],
    // LE CRENEAU, NOMME COMME PARTOUT AILLEURS : progName et slot. Ni
    // `sessionName` ni `name` n'existent sur woState — c'est ce couple-la que
    // lisent _memeCreneau, getPrevPerf et l'enregistrement de la seance.
    {seance:String((woState&&woState.progName)||''),
     slot:(woState&&woState.slot!=null)?woState.slot:null,
     serieIdx:i,date:Date.now()});
  const inp=document.getElementById('wo-video-input');
  if(!inp) return false;
  inp.value='';
  inp.click();
  return true;
}
// L'ENVOI DEPUIS LA SEANCE. Il reutilise uploadVideoFile — un seul chemin
// d'envoi, une seule gestion d'erreur, une seule configuration Cloudinary — et
// se contente de POSER LE LIEN qui sera rattache a l'entree.
async function _videoSerieEnvoyer(input){
  const lien=_videoLienEnAttente, vise=_videoSerieEnAttente;
  _videoLienEnAttente=null; _videoSerieEnAttente=null;
  if(!input||!input.files||!input.files[0]) return false;
  // Le nom de l'exercice sert de titre : sans lui l'entree s'appellerait
  // « VID_20260903 », et le coach devrait ouvrir chaque video pour savoir de
  // quoi elle parle. Ce n'est PAS une question posee a l'athlete.
  const nom=(lien&&lien.exerciceNom)||'';
  // ══ EN SEANCE, ON GARDE ; ON N'ENVOIE PAS (30/09/2026) ══════════════════
  // L'envoi prenait l'ecran : panneau d'allegement, puis loadVideos(), qui
  // faisait go('s-videos') — l'athlete sortait de sa seance au milieu du
  // repos, et un envoi de 20 Mo en 4G se jouait pendant la serie suivante.
  // La video va dans la file du telephone ; la carte de fin de seance la
  // propose, d'un geste. Aucune question n'est posee.
  if(woState&&!woState.termine){
    const file=input.files[0];
    let id='';
    try{ id=await fileEnvoiPoser({blob:file,nom:nom||file.name||'video',
      emailCible:(currentUser&&currentUser.email)||'',octetsOrigine:file.size||0,
      voieCompression:'aucune',lien:lien}); }catch(e){ id=''; }
    try{ input.value=''; }catch(e){}
    if(id){
      toast('Vidéo gardée, envoi à la fin de la séance','var(--green)');
      const d=vise&&woState.sessionData&&woState.sessionData[vise.idx];
      const s=d&&d.sets&&d.sets[vise.i];
      if(s){
        s.video=true;
        try{ woPersist(); }catch(e){}
        try{ _woMajLignes(woState.exercises[vise.idx],d,vise.idx); }catch(e){}
      }
      return true;
    }
    // LA FILE N'EST PAS DISPONIBLE (navigation privee, vieux navigateur) : on
    // ne perd pas la video, on l'envoie — sans quitter l'ecran de seance.
    await uploadVideoFile({files:[file],value:''},{lien:lien,nom:nom,resterIci:true});
    return true;
  }
  await uploadVideoFile(input,{lien:lien,nom:nom});
  return true;
}

// ══ LES VIDEOS GARDEES, A LA FIN DE LA SEANCE ═══════════════════════════
// PURE. « Wi-Fi recommandé » seulement quand le navigateur dit quelque chose
// de la connexion, et qu'elle n'est pas deja du Wi-Fi. Sans l'API (Safari),
// on ne devine pas.
function indicationReseauEnvoi(conn){
  if(!conn) return '';
  const t=String(conn.type||''), e=String(conn.effectiveType||'');
  if(t==='wifi'||t==='ethernet') return '';
  return (t||e)?'Wi-Fi recommandé':'';
}
async function renderVideosAEnvoyer(){
  const z=document.getElementById('wd-aenvoyer');
  if(!z||!currentUser) return false;
  let l=[];
  try{ l=(await fileEnvoiLister()).filter(e=>e.emailCible===currentUser.email); }catch(e){ l=[]; }
  if(!l.length){ z.innerHTML=''; return false; }
  const res=indicationReseauEnvoi(navigator.connection||navigator.mozConnection||navigator.webkitConnection);
  z.innerHTML='<div class="wd-env">'
    +'<div class="wd-env-t">Vidéos à envoyer</div>'
    +(res?'<div class="wd-env-res">'+escapeHtml(res)+' · '+_mo(l.reduce((a,e)=>a+((e.blob&&e.blob.size)||0),0))+'</div>':'')
    +l.map(e=>'<div class="wd-env-l"><span class="wd-env-n">'+escapeHtml(e.nom||'Vidéo')
      +' <span class="sub">· '+_mo((e.blob&&e.blob.size)||0)+'</span></span>'
      +'<button type="button" class="btn btn-red btn-sm wd-env-b" data-id="'+escapeHtml(e.id)+'">Envoyer maintenant</button></div>').join('')
    +'</div>';
  z.querySelectorAll('.wd-env-b').forEach(b=>{ b.onclick=()=>envoyerVideoGardee(b.getAttribute('data-id'),b); });
  return true;
}
// L'ENVOI D'UNE VIDEO GARDEE : le chemin unique, uploadVideoFile, avec
// l'identifiant de file (retiree a la confirmation) et resterIci — on reste
// sur l'ecran de fin.
async function envoyerVideoGardee(id,btn){
  let l=[];
  try{ l=await fileEnvoiLister(); }catch(e){ l=[]; }
  const e=l.find(x=>x.id===id);
  if(!e){ toast('Cette vidéo n’est plus disponible.','var(--orange)'); renderVideosAEnvoyer(); return false; }
  if(btn){ btn.disabled=true; btn.textContent='Envoi…'; }
  const f=new File([e.blob],(e.nom||'video')+'.mp4',{type:e.blob.type||'video/mp4'});
  try{
    await uploadVideoFile({files:[f],value:''},{nom:e.nom,lien:e.lien||null,fileId:e.id,
      octetsOrigine:e.octetsOrigine,voieCompression:e.voieCompression,resterIci:true});
  }finally{ try{ await renderVideosAEnvoyer(); }catch(x){} }
  return true;
}

// ══ LA PURGE : PROPOSEE, JAMAIS FAITE D'OFFICE ═════════════════════════
//
// Une video de plus de douze mois est proposee a la suppression. JAMAIS
// supprimee toute seule : c'est la seule trace video d'une periode, et
// l'effacer sans le dire serait retirer a quelqu'un ce qu'il croyait garde.
// ⚠ CE QUI ÉTAIT ICI, ET POURQUOI IL N'Y EST PLUS. `videosAPurger` /
//   `phraseVideosAPurger` proposaient, à douze mois, de supprimer soi-même —
//   « la purge propose, elle n'agit pas ». L'intention était juste et elle est
//   TENUE PLUS FORT ci-dessous : annoncée sept jours avant, récupérable d'un
//   geste, journalisée. Ce qui change, c'est qu'à la fin le fichier part pour
//   de bon, au lieu de rester à jamais chez l'hébergeur en attendant un geste
//   que personne ne faisait. Garder les deux mécanismes aurait affiché deux
//   messages contradictoires sur le même écran.
// ══════════════ LA RÉTENTION DES MÉDIAS ═══════════════════════════════════
//
// POURQUOI ELLE EXISTE, alors que rien n'expirait jusqu'ici. Une vidéo de série
// pèse 15 à 20 Mo après allègement, et un athlète suivi en envoie deux par
// semaine : un gigaoctet et demi par an et par personne, gardé pour toujours
// chez l'hébergeur. Ce coût ne se voit sur aucun écran, personne ne le décide,
// et c'est le compte qui le paie. QUATRE-VINGT-DIX JOURS suffisent à ce que
// ces fichiers servent : une correction se lit dans la semaine, et une
// comparaison se fait sur deux prises — qu'on épingle.
//
// ⚠ ET RIEN NE DISPARAÎT EN SILENCE. Trois garanties, dans cet ordre :
//
//   1. ANNONCÉ AVANT. Le bandeau « expire dans 7 jours » s'affiche sept jours
//      avant. Et L'EXPIRATION N'A PAS LIEU TANT QUE CE BANDEAU N'A PAS ÉTÉ
//      RENDU : `preavisVuLe` est posé au rendu, et rien ne part avant sept
//      jours de plus. Quelqu'un qui n'ouvre pas l'application pendant trois
//      mois ne perd donc rien à son retour — il est prévenu, puis il a une
//      semaine. C'est la seule lecture honnête de « annoncée avant de
//      survenir » : un compte à rebours que personne n'a vu n'annonce rien.
//
//   2. RÉCUPÉRABLE D'UN GESTE. « Garder » épingle — dix au plus par dossier,
//      et le compte est affiché ; « Télécharger » rend le fichier. Une vidéo
//      épinglée n'expire JAMAIS, ni par l'âge, ni par la dormance.
//
//   3. JOURNALISÉ. Ce qui a expiré est inscrit dans rc_expirations, avec son
//      nom et ses deux dates, et l'entrée du dossier GARDE {nom, date,
//      expiree:true} — plus le retour du coach, qui est du texte et ne coûte
//      rien. « Où est passée ma vidéo ? » a une réponse, à l'écran.
//
// CE QUI N'EXPIRE PAS, ET IL FAUT LE DIRE : un lien YouTube ou Drive collé par
// l'athlète (aucune copie chez nous — ce n'est pas notre fichier et il ne coûte
// rien), une vidéo épinglée, et tout ce qui n'a pas de date.
// ⚠ LOT 7 : KEVIN A DEMANDE QUATORZE JOURS ET TROIS JOURS, ET CES DEUX
//   NOMBRES NE SONT PAS ENCORE POSES. Sa consigne, dans le meme lot et mot
//   pour mot : « TESTE LES DEUX SUR UN VRAI TELEPHONE avant d'activer la
//   purge. Une purge adossee a un telechargement qui echoue, c'est une perte
//   de donnees, et c'est impardonnable. »
//
//   Le telechargement est ecrit (telechargerVideo, deux chemins), et la moitie
//   Android est verifiee : l'URL fl_attachment rend bien
//   « Content-Disposition: attachment » — mesure du 23/09/2026 sur
//   res.cloudinary.com. La moitie iPhone passe par la feuille de partage, et
//   il n'y a pas d'iPhone sur ce banc : je ne peux pas la verifier.
//
//   CE QU'IL RESTE A FAIRE, ET C'EST TOUT :
//     1. Sur iPhone, « Telecharger » sur une video, puis « Enregistrer la
//        video » dans la feuille : elle doit arriver dans Photos.
//     2. Sur Android, « Telecharger » doit poser le fichier dans les
//        telechargements, sans ouvrir d'onglet.
//     3. Ces deux nombres passent a 14 et 3. Rien d'autre ne bouge : toutes
//        les phrases de l'ecran les lisent.
const VIDEO_RETENTION_J=90;
const VIDEO_PREAVIS_J=7;
const VIDEO_EPINGLES_MAX=10;
const EXPIRATIONS_CLE='rc_expirations';
const EXPIRATIONS_MAX=300;

function _vidDate(v){ return Number(v&&v.date)||0; }
function _vidListe(user){ const u=_dossier(user); return Array.isArray(u&&u.videos)?u.videos:[]; }
function videoEpinglee(v){ return !!(v&&v.epingle); }
function videoExpiree(v){ return !!(v&&v.expiree); }
function videosEpinglees(user){ return _vidListe(user).filter(videoEpinglee); }
/** Une copie chez l'hébergeur, donc un coût, donc une rétention. */
function videoHebergee(v){ return !!(v&&v.cloudinaryPublicId&&!videoExpiree(v)); }

/**
 * PURE. Où en est une vidéo vis-à-vis de la rétention.
 *
 * `etat` vaut : 'epinglee' (jamais), 'expiree' (déjà partie), 'hors hebergeur'
 * (un lien collé), 'sans date', 'loin', 'preavis' (le bandeau doit s'afficher),
 * 'a prevenir' (échue mais JAMAIS annoncée — on annonce, on n'efface pas), ou
 * 'due' (annoncée depuis au moins sept jours : elle peut partir).
 */
function videoRetention(v,maintenant){
  const t=Number(maintenant)||Date.now();
  if(videoExpiree(v)) return {etat:'expiree',jours:null,le:Number(v.expireeLe)||null};
  if(videoEpinglee(v)) return {etat:'epinglee',jours:null};
  if(!videoHebergee(v)) return {etat:'hors hebergeur',jours:null};
  if(!_vidDate(v)) return {etat:'sans date',jours:null};
  const du=_vidDate(v)+VIDEO_RETENTION_J*864e5;
  const jours=Math.ceil((du-t)/864e5);
  if(jours>VIDEO_PREAVIS_J) return {etat:'loin',jours:jours,du:du};
  if(jours>0) return {etat:'preavis',jours:jours,du:du};
  // ÉCHUE. Reste à savoir si quelqu'un a été prévenu.
  const vu=Number(v.preavisVuLe)||0;
  if(!vu) return {etat:'a prevenir',jours:0,du:du};
  const reste=Math.ceil((vu+VIDEO_PREAVIS_J*864e5-t)/864e5);
  if(reste>0) return {etat:'preavis',jours:reste,du:vu+VIDEO_PREAVIS_J*864e5};
  return {etat:'due',jours:0,du:du};
}
function videosEnPreavis(user,maintenant){
  return _vidListe(user).filter(v=>{const e=videoRetention(v,maintenant).etat;
    return e==='preavis'||e==='a prevenir';});
}
function videosDues(user,maintenant){
  return _vidListe(user).filter(v=>videoRetention(v,maintenant).etat==='due');
}
/**
 * LE PRÉAVIS EST POSÉ QUAND IL EST RENDU, et c'est tout l'intérêt : c'est
 * l'horodatage de l'annonce qui autorise l'expiration sept jours plus tard.
 * Rend le nombre de marques posées — zéro veut dire « rien de neuf à annoncer ».
 */
function marquerPreavisVideos(user,maintenant){
  const t=Number(maintenant)||Date.now();
  let n=0;
  for(const v of videosEnPreavis(user,t)) if(!Number(v.preavisVuLe)){ v.preavisVuLe=t; n++; }
  return n;
}
/**
 * ÉPINGLER, OU DÉSÉPINGLER. Le plafond est de dix par dossier, et il est
 * ANNONCÉ : un bouton qui refuse sans dire pourquoi est un bouton cassé.
 */
function basculerEpingleVideo(user,id,maintenant){
  const l=_vidListe(user);
  const v=l.find(x=>x&&x.id===id);
  if(!v) return {ok:false,raison:'Vidéo introuvable.'};
  if(videoExpiree(v)) return {ok:false,raison:'Cette vidéo a déjà expiré : il n’y a plus de fichier à garder.'};
  // ⚠ DESEPINGLER EFFACE AUSSI L'ANNONCE, et pas seulement l'epingle. Sans
  //   cela, une video gardee il y a six mois — dont le preavis d'alors dormait
  //   dans l'entree — partirait dans la seconde qui suit son desepinglage. Le
  //   geste inverse serait un piege. Elle repart par une annonce.
  if(videoEpinglee(v)){ delete v.epingle; delete v.preavisVuLe; return {ok:true,epingle:false}; }
  const n=videosEpinglees(user).length;
  if(n>=VIDEO_EPINGLES_MAX)
    return {ok:false,raison:'Tu gardes déjà '+VIDEO_EPINGLES_MAX+' vidéos. Désépingle-en une pour garder celle-ci.'};
  v.epingle=true;
  // Épingler remet le compte à zéro côté préavis : la vidéo n'est plus en
  // sursis, et si elle est désépinglée un jour, elle recommencera par être
  // annoncée. Sans cela, un désépinglage la ferait partir dans la seconde.
  delete v.preavisVuLe;
  return {ok:true,epingle:true,reste:VIDEO_EPINGLES_MAX-(n+1)};
}
/**
 * L'ENTRÉE RESTE, LE FICHIER PART. On retire les pointeurs vers l'hébergeur et
 * RIEN D'AUTRE : le nom, la date, le rattachement à l'exercice et le retour du
 * coach sont du texte, ils ne coûtent rien, et ce sont eux qu'on garde.
 */
function expirerEntreeVideo(v,maintenant){
  const t=Number(maintenant)||Date.now();
  const trace={id:v.id,nom:v.name||'',date:_vidDate(v),le:t,
    publicId:v.cloudinaryPublicId||'',octets:Number(v.octetsOrigine)||0};
  delete v.url; delete v.cloudinaryPublicId; delete v.cloudinaryName;
  delete v.deleteToken; delete v.preavisVuLe;
  v.expiree=true; v.expireeLe=t;
  return trace;
}
// ── LE JOURNAL, SUR L'APPAREIL ────────────────────────────────────────────
// Local et non dans le dossier : c'est une trace pour la personne, pas une
// donnée à synchroniser, et elle doit survivre à une synchro qui échoue.
function journalExpirations(){
  try{ const l=JSON.parse(localStorage.getItem(EXPIRATIONS_CLE)||'[]');
    return Array.isArray(l)?l.filter(x=>x&&x.nom!==undefined):[]; }catch(e){ return []; }
}
function journalExpirationsEcrire(l){
  try{ localStorage.setItem(EXPIRATIONS_CLE,JSON.stringify((l||[]).slice(-EXPIRATIONS_MAX)));
    return true; }catch(e){ return false; }
}
function journalExpirationAjouter(trace){
  if(!trace) return false;
  const l=journalExpirations();
  l.push({nom:trace.nom||'',date:trace.date||0,le:trace.le||Date.now(),
    quoi:trace.quoi||'vidéo',octets:trace.octets||0});
  return journalExpirationsEcrire(l);
}
/** La phrase du journal, pour l'écran. Vide quand il n'y a rien à dire. */
function phraseJournalExpirations(maintenant){
  const l=journalExpirations();
  if(!l.length) return '';
  const t=Number(maintenant)||Date.now();
  const recents=l.filter(x=>t-(x.le||0)<180*864e5);
  if(!recents.length) return '';
  const d=new Date(recents[recents.length-1].le).toLocaleDateString('fr-FR');
  return recents.length+' média'+(recents.length>1?'s ont':' a')
    +' expiré depuis six mois, le dernier le '+d+'.';
}

/**
 * L'EXPIRATION, POUR DE BON. Le fichier est détruit chez l'hébergeur par la
 * porte unique (_cldDetruire, qui met en file ce qui résiste), l'entrée est
 * réduite à son texte, et la trace est écrite.
 *
 * ⚠ ELLE NE TOUCHE QUE CE QUI EST 'due' — donc annoncé depuis au moins sept
 *   jours. Tout le reste attend, y compris une vidéo échue depuis un an que
 *   personne n'a jamais vue à l'écran.
 */
async function expirerVideosEchues(user,maintenant){
  const u=_dossier(user);
  const dues=videosDues(u,maintenant);
  if(!dues.length) return {expirees:0,restants:0};
  let n=0;
  for(const v of dues){
    const pid=v.cloudinaryPublicId;
    // On détruit AVANT de réduire l'entrée : après, on n'aurait plus
    // l'identifiant, et le fichier resterait chez l'hébergeur pour toujours.
    if(pid) await _cldDetruire(pid,'video',
      {proprietaire:u&&u.email,cloudName:v.cloudinaryName,quoi:'vidéo expirée '+(v.name||'')});
    const trace=expirerEntreeVideo(v,maintenant);
    journalExpirationAjouter(trace);
    n++;
  }
  return {expirees:n,restants:cldFileLire().length};
}

// ══════════════ LES DOSSIERS DORMANTS ══════════════════════════════════════
//
// Un athlète dont l'accès est fermé depuis six mois ne revient pas, et ses
// vidéos continuent de peser. ON DÉTRUIT SES MÉDIAS, ET RIEN D'AUTRE : le
// dossier texte RESTE — mesures, séances, bilans, échanges. C'est son histoire,
// elle ne pèse rien, et il peut revenir.
//
// ⚠ TRENTE JOURS D'AVERTISSEMENT À L'ÉCRAN, avant. Chez lui s'il ouvre
//   l'application, et dans sa fiche chez le coach, qui peut l'appeler.
const MEDIA_DORMANT_J=180;
const MEDIA_DORMANT_PREAVIS_J=30;
/** PURE. L'accès est-il fermé, et depuis quand ? null s'il est ouvert. */
function accesFermeDepuis(u,maintenant){
  if(!u||u._fromCode) return null;
  const t=Number(maintenant)||Date.now();
  const e=Number(u.accessExpiry);
  if(u.status==='COACHING_SUIVI'&&isFinite(e)&&e>0&&e<=t) return e;
  // Un abonnement résilié : la date de résiliation n'est pas conservée, la
  // dernière écriture du dossier est ce qu'on a de plus juste.
  if(u.status==='AUTONOMIE_PREMIUM'&&u.paymentStatus==='cancelled')
    return Number(u.updatedAt)||null;
  return null;
}
/** PURE. {etat:'actif'|'preavis'|'du', jours, depuis} */
function mediaDormant(u,maintenant){
  const t=Number(maintenant)||Date.now();
  const ferme=accesFermeDepuis(u,t);
  if(!ferme) return {etat:'actif',jours:null,depuis:null};
  // La dernière écriture compte autant que la fermeture : un dossier qu'on
  // remplit encore n'est pas dormant, même si l'accès est clos.
  const depuis=Math.max(ferme,Number(u.updatedAt)||0);
  const jours=Math.floor((t-depuis)/864e5);
  if(jours>=MEDIA_DORMANT_J) return {etat:'du',jours:jours,depuis:depuis};
  if(jours>=MEDIA_DORMANT_J-MEDIA_DORMANT_PREAVIS_J)
    return {etat:'preavis',jours:MEDIA_DORMANT_J-jours,depuis:depuis};
  return {etat:'actif',jours:jours,depuis:depuis};
}
/** La phrase de l'avertissement. Vide quand il n'y a rien à annoncer. */
function phraseDormant(u,maintenant){
  const d=mediaDormant(u,maintenant);
  if(d.etat==='preavis')
    return 'Ton accès est fermé depuis six mois. Dans '+d.jours+' jour'+(d.jours>1?'s':'')
      +', tes vidéos et tes photos partagées seront supprimées de l’hébergeur. '
      +'Tes mesures, tes séances et tes bilans restent. Épingle ou télécharge ce que tu veux garder.';
  if(d.etat==='du')
    return 'Tes vidéos et tes photos partagées ont été supprimées de l’hébergeur : '
      +'ton accès était fermé depuis plus de six mois. Tes mesures, tes séances et tes bilans sont intacts.';
  return '';
}
/**
 * DÉTRUIT LES MÉDIAS D'UN DOSSIER DORMANT. Les épinglées sont épargnées : c'est
 * le geste par lequel quelqu'un a dit « celle-là, je la garde ».
 */
async function expirerMediasDormants(user,maintenant){
  const u=_dossier(user);
  if(mediaDormant(u,maintenant).etat!=='du') return {videos:0,photos:0};
  const t=Number(maintenant)||Date.now();
  let nv=0,np=0;
  for(const v of _vidListe(u)){
    if(videoEpinglee(v)||!videoHebergee(v)) continue;
    await _cldDetruire(v.cloudinaryPublicId,'video',
      {proprietaire:u&&u.email,cloudName:v.cloudinaryName,quoi:'vidéo d’un dossier dormant'});
    journalExpirationAjouter(Object.assign(expirerEntreeVideo(v,t),{quoi:'vidéo (dossier dormant)'}));
    nv++;
  }
  // LES PHOTOS DE PROGRESSION PARTAGÉES passent par leur propre porte, qui
  // sait ce qu'elle a détruit et ce qui reste à purger.
  try{
    if(u&&u.photosProgression&&typeof phpRevoquer==='function'&&phpPartagees(u).length){
      const r=await phpRevoquer(u);
      np=(r&&r.local!==undefined)?phpPartagees(u).length===0?1:0:0;
      journalExpirationAjouter({nom:'photos de progression',date:t,le:t,quoi:'photos (dossier dormant)'});
    }
  }catch(e){}
  u.mediasDormantsPurgesLe=t;
  return {videos:nv,photos:np};
}

/**
 * LE PASSAGE DE RÉTENTION, UNE FOIS PAR OUVERTURE. Il ne fait QUE ce qui a été
 * annoncé : les vidéos dont le préavis a été rendu il y a au moins sept jours,
 * et les médias d'un dossier dormant depuis six mois — avertis trente jours
 * avant. Il dit ce qu'il a fait, à l'écran.
 *
 * ⚠ JAMAIS PENDANT UNE SÉANCE. Écrire le dossier au milieu d'un entraînement,
 *   pour une tâche de fond, c'est risquer de perdre des séries en cours pour
 *   gagner des octets. Ça attendra la prochaine ouverture.
 */
async function retentionAuDemarrage(){
  try{
    if(!currentUser||!currentUser.email) return {saute:'personne'};
    if(typeof _seanceEnCours==='function'&&_seanceEnCours()) return {saute:'séance en cours'};
    let bilan={expirees:0,dormants:null,metrics:null};
    const r=await expirerVideosEchues(currentUser);
    bilan.expirees=r.expirees;
    const d=await expirerMediasDormants(currentUser);
    bilan.dormants=d;
    if(r.expirees||d.videos){
      saveUser();
      CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{});
      const n=r.expirees+d.videos;
      // ON LE DIT. Une expiration muette est un défaut, pas une optimisation.
      toast(n+' vidéo'+(n>1?'s ont':' a')+' expiré après '+VIDEO_RETENTION_J
        +' jours. Le nom, la date et le retour du coach restent.','var(--sub)');
      try{ if(document.getElementById('s-videos')
        &&document.getElementById('s-videos').classList.contains('active')) _renderVideosListe(); }catch(e){}
    }
    // LE MENAGE DE LA FILE : cinq fichiers verifies, pas plus. Ceux qui ont
    // vraiment disparu de chez l'hebergeur quittent le dossier, et Kevin ne
    // redemande pas chaque mois la suppression de ce qui est deja supprime.
    try{ bilan.menage=await cldDossierMenage(5); }catch(e){ bilan.menage=0; }
    // LES MÉTRIQUES : réservées au créateur, et silencieuses pour tout autre.
    bilan.metrics=await purgerMetricsPerimes();
    return bilan;
  }catch(e){ return {saute:String(e&&e.message||e)}; }
}

// ══════════════ LES MÉTRIQUES : QUATRE CENTS JOURS ═════════════════════════
//
// Le nœud metrics porte un compteur par jour et par étape. Il n'a JAMAIS été
// purgé : il grossit d'une trentaine d'entiers par jour, pour toujours. Quatre
// cents jours couvrent une comparaison d'une année sur l'autre, ce qui est le
// seul usage réel de ces chiffres.
//
// ⚠ SEUL LE CRÉATEUR PEUT PURGER, et il faut une règle pour cela : le nœud
//   accepte des incréments de tout le monde, mais une SUPPRESSION écrit `null`,
//   que le `.validate` de $evenement refuse (il exige un nombre). La règle
//   ajoutée n'autorise donc au créateur que des suppressions, sur le jour
//   entier. Tant que database.rules.json n'est pas déployé — le déploiement
//   automatique ne publie que l'hébergement — cette purge échoue, et elle le
//   DIT plutôt que de faire semblant.
const METRICS_RETENTION_J=400;
/** PURE. Les clefs de jour trop vieilles, parmi celles qu'on lui donne. */
function metricsJoursPerimes(cles,maintenant){
  const t=Number(maintenant)||Date.now();
  const limite=t-METRICS_RETENTION_J*864e5;
  return (Array.isArray(cles)?cles:[]).filter(function(k){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(k))) return false;
    const d=new Date(String(k)+'T12:00:00Z').getTime();
    return isFinite(d)&&d<limite;
  }).sort();
}
/**
 * La purge, côté créateur. Rend ce qu'elle a fait, et pourquoi elle n'a pas pu.
 * Elle ne lève jamais : c'est une tâche de fond, pas un geste d'utilisateur.
 */
async function purgerMetricsPerimes(){
  try{
    if(!currentUser||currentUser.email!==CREATOR_EMAIL) return {saute:'réservé au créateur'};
    const jeton=await CLOUD._getToken();
    if(!jeton) return {saute:'aucun jeton'};
    const r=await fetch(RCM_BASE+'.json?shallow=true&auth='+encodeURIComponent(jeton));
    if(!r.ok) return {saute:'lecture refusée ('+r.status+')'};
    const cles=Object.keys((await r.json())||{});
    const vieux=metricsJoursPerimes(cles);
    if(!vieux.length) return {jours:0,total:cles.length};
    let n=0,refus=0;
    for(const k of vieux.slice(0,60)){
      const d=await fetch(RCM_BASE+'/'+k+'.json?auth='+encodeURIComponent(jeton),{method:'DELETE'});
      if(d.ok) n++; else refus++;
    }
    if(refus) console.warn('[RepCore] purge des métriques : '+refus+' jour(s) refusé(s) : '
      +'database.rules.json n’est peut-être pas déployé');
    return {jours:n,refus:refus,total:cles.length,restants:vieux.length-n};
  }catch(e){ return {saute:String(e&&e.message||e)}; }
}

// ══════════════ LE COMPARATEUR A ETE RETIRE (lot 7) ════════════════════
//
// Kevin, 23/09/2026 : « supprime le comparateur, entierement. Je n'en ai pas
// besoin, je corrige la video directement. » Partent avec lui : l'ecran
// s-comparer, le bouton « Comparer avec la premiere prise », les huit
// fonctions de paire et d'annotation, les constantes CMP_, et le champ
// `comparaisons` du dossier.
//
// ⚠ CE QUE LE COACH AVAIT DEJA ECRIT NE DISPARAIT PAS AVEC L'ECRAN. Les
//   annotations vivaient dans le dossier de l'athlete, rattachees a une PAIRE
//   de videos. Elles sont recopiees sur la video qu'elles visent, dans
//   feedbackTimestamps — le meme format, le meme rendu, le meme lecteur — et
//   celles dont la video n'existe plus sont gardees a part plutot que jetees.
//
// LA CORRECTION DIRECTE NE BOUGE PAS : le coach ouvre la video, il annote, il
// commente, c'est dans videos[].feedback. Motion Lab non plus : c'est
// l'analyse d'UNE video, et c'est exactement ce qu'on garde.
function migrerComparaisons(user){
  const u=user||currentUser;
  if(!u||typeof u!=='object') return 0;
  const c=u.comparaisons;
  if(!c||typeof c!=='object') return 0;
  const vids=Array.isArray(u.videos)?u.videos:[];
  const parId=new Map();
  for(const v of vids) if(v&&v.id!=null) parId.set(String(v.id),v);
  let n=0;
  for(const k of Object.keys(c)){
    const t=c[k];
    if(!t||typeof t!=='object') continue;
    const l=Array.isArray(t.annotations)?t.annotations:[];
    for(const a of l){
      if(!a) continue;
      const sec=Math.max(0,Number(a.sec)||0);
      const e={sec:sec,note:String(a.note||''),date:Number(a.date)||0};
      try{ e.ts=secsToTs(sec); }catch(err){ e.ts='0:00'; }
      if(a.audioUrl) e.audioUrl=String(a.audioUrl);
      const v=parId.get(String(a.sur==='avant'?t.avant:t.apres))||null;
      if(v){
        v.feedbackTimestamps=_tabBloc(v.feedbackTimestamps);
        // On ne recopie pas deux fois la meme chose : la migration peut
        // repasser sur un dossier deja migre par un autre appareil.
        const deja=v.feedbackTimestamps.some(x=>x&&Math.abs((Number(x.sec)||0)-sec)<0.05
          &&String(x.note||'')===e.note&&String(x.audioUrl||'')===String(e.audioUrl||''));
        if(!deja){ v.feedbackTimestamps.push(e); n++; }
      }else{
        // LA VIDEO N'EXISTE PLUS — expiree, supprimee. Le commentaire du coach,
        // lui, pese quelques octets et vaut encore quelque chose : il est garde
        // avec le nom de l'exercice, et l'ecran des videos le montre.
        u.correctionsOrphelines=_tabBloc(u.correctionsOrphelines);
        const o=Object.assign({exercice:String(t.cle||'')},e);
        const dejaO=u.correctionsOrphelines.some(x=>x&&x.exercice===o.exercice
          &&Math.abs((Number(x.sec)||0)-sec)<0.05&&String(x.note||'')===o.note
          &&String(x.audioUrl||'')===String(o.audioUrl||''));
        if(!dejaO){ u.correctionsOrphelines.push(o); n++; }
      }
    }
  }
  delete u.comparaisons;
  return n;
}
// LE BLOC DES CORRECTIONS SANS VIDEO, en bas de la liste. Vide tant qu'il n'y
// en a pas, ce qui est le cas de presque tout le monde.
function htmlCorrectionsOrphelines(user){
  const u=_dossier(user);
  const l=_tabBloc(u&&u.correctionsOrphelines);
  if(!l.length) return '';
  const ligne=o=>'<div style="padding:8px 0;border-bottom:1px solid var(--surface-2)">'
    +'<div style="font-size:var(--fs-2xs);color:var(--red-text);font-weight:800;letter-spacing:.5px">'
    +escapeHtml(String(o.exercice||'').replace(/-/g,' ').toUpperCase())+'</div>'
    +(o.audioUrl
      ?'<audio src="'+escapeHtml(o.audioUrl)+'" controls style="height:32px;width:100%;margin-top:4px"></audio>'
      :'<div style="font-size:var(--fs-sm);line-height:1.5;margin-top:2px">'+escapeHtml(o.note||'')+'</div>')
    +'</div>';
  return '<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-top:14px">'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);font-weight:800;letter-spacing:1px;'
    +'text-transform:uppercase;margin-bottom:4px">Corrections de ton coach</div>'
    +'<p class="sub" style="font-size:var(--fs-2xs);line-height:1.5;margin:0 0 6px">'
    +'La vidéo n’existe plus, le retour de ton coach reste.</p>'
    +l.map(ligne).join('')+'</div>';
}
// ======= QUICK COMMENTS =======

// ══════════════ MODÈLES DE MESSAGE ═══════════════════════════════════════
// Une seule bibliothèque, dans le document du coach. Elle ABSORBE les
// commentaires rapides : il n'existe plus deux systèmes côte à côte.
//
// DOCTRINE. RepCore suspend, élargit une fourchette et renvoie — il ne
// prescrit pas. Aucun modèle livré par défaut ne dit quoi faire de sa santé :
// une assertion l'interdit, et le vocabulaire des défauts s'y tient.
//
// AUCUNE IA, aucun service tiers : ce sont des textes que le coach écrit.
const TPL_CATS=Object.freeze(['technique','motivation','nutrition','administratif','absence']);
const TPL_GROUPE_MAX=50;
// Les quatre variables reconnues, accentuées ou non. Tout le reste entre
// accolades est laissé TEL QUEL : « {mon truc} » n'est pas une variable, et
// prétendre le contraire ferait disparaître du texte du coach.
const TPL_VARS=Object.freeze({'prénom':'prenom','prenom':'prenom',
  'exercice':'exercice','séance':'seance','seance':'seance','charge':'charge'});
// Athlète sans prénom : on ne montre JAMAIS « {prénom} » à l'écran. Ce mot-là
// est la seule valeur de repli du lot ; change-le ici si le ton ne va pas.
const TPL_PRENOM_NEUTRE='toi';

// PURE. Les variables reconnues d'un corps, sans doublon, dans l'ordre.
function templateVariables(corps){
  const out=[];
  const re=/\{([^{}]{1,20})\}/g;
  let m;
  while((m=re.exec(String(corps||'')))){
    const cle=TPL_VARS[m[1].trim().toLowerCase()];
    if(cle&&out.indexOf(cle)<0) out.push(cle);
  }
  return out;
}
// PURE. Rend {texte, manquantes[]}.
//
// Le PRÉNOM ne bloque jamais : un athlète sans prénom renseigné existe, et le
// coach ne doit pas rester coincé pour ça — d'où le repli neutre. Les trois
// autres bloquent : « beau travail sur {exercice} » sans exercice ne veut
// rien dire, et l'envoyer tel quel serait pire que ne rien envoyer.
function templateResoudre(corps,contexte){
  const c=contexte||{};
  const manquantes=[];
  const texte=String(corps||'').replace(/\{([^{}]{1,20})\}/g,(brut,nom)=>{
    const cle=TPL_VARS[String(nom).trim().toLowerCase()];
    if(!cle) return brut;                       // pas une variable : on n'y touche pas
    const v=c[cle];
    if(v!=null&&String(v).trim()!=='') return String(v).trim();
    if(cle==='prenom') return TPL_PRENOM_NEUTRE;
    if(manquantes.indexOf(cle)<0) manquantes.push(cle);
    return brut;                                // laissée VISIBLE : elle doit sauter aux yeux
  });
  return {texte,manquantes};
}
// PURE. Le modèle résolu, inséré dans le brouillon. Même règle de séparation
// que insertQC, qu'il remplace : un point si le texte précédent n'en a pas.
function templateInserer(brouillon,modele,contexte){
  const b=String(brouillon||'');
  const corps=(modele&&modele.corps!=null)?modele.corps:String(modele||'');
  const r=templateResoudre(corps,contexte);
  const sep=(b&&!/[\s\n]$/.test(b))?'. ':'';
  return b+sep+r.texte;
}
// Les six commentaires vidéo et les cinq du bilan, en modèles. Le TEXTE est
// repris mot pour mot : la migration ne réécrit rien.
const TPL_DEFAUTS=Object.freeze([
  {cat:'technique',  titre:'Dos droit',           corps:'Garde le dos droit'},
  {cat:'technique',  titre:'Descends plus bas',   corps:'Descends plus bas'},
  {cat:'technique',  titre:'Souffle',             corps:"Souffle sur l'effort"},
  {cat:'technique',  titre:'Genoux',              corps:"Attention aux genoux qui rentrent vers l'intérieur"},
  {cat:'motivation', titre:'Beau travail !',      corps:'Beau travail'},
  {cat:'motivation', titre:'Belle progression',   corps:'Belle progression depuis la dernière séance'},
  {cat:'motivation', titre:'Bonne semaine',       corps:'Bonne semaine, le poids évolue comme prévu.'},
  {cat:'administratif',titre:'On ajuste',         corps:'On ajuste le programme, je te mets ça à jour.'},
  {cat:'technique',  titre:'Sommeil',             corps:'Le sommeil me préoccupe plus que le reste : on en parle ?'},
  {cat:'nutrition',  titre:'Écarts',              corps:"Les écarts ne sont pas un problème à cette fréquence."},
  {cat:'administratif',titre:'Mesures',           corps:'Pense à reprendre les mesures dans les mêmes conditions.'}
]);
// Migration SANS PERTE et IDEMPOTENTE.
//
// L'ordre choisi par le coach (`pos`) n'a pas de champ équivalent dans le
// nouveau format : il est reporté dans `createdAt`, dont le tri croissant
// reproduit exactement l'ancien classement. C'est un détournement, il est dit
// ici pour qu'on ne s'étonne pas de dates toutes voisines.
function templateMigrerCommentaires(user){
  if(!user) return [];
  if(Array.isArray(user.msgTemplates)&&user.msgTemplates.length) return user.msgTemplates;
  const base=Date.now();
  const out=[];
  const anciens=Array.isArray(user.quickComments)?user.quickComments.slice() : [];
  anciens.sort((a,b)=>((a&&a.pos)||0)-((b&&b.pos)||0));
  anciens.forEach((c,i)=>{
    if(!c) return;
    const corps=String(c.text!=null?c.text:'');
    if(!corps.trim()) return;
    out.push({id:'tpl'+base+'_'+i,cat:'technique',
      titre:String(c.label||corps).slice(0,40),corps:corps,createdAt:base+i});
  });
  // Aucun commentaire personnalisé : on sème la bibliothèque par défaut, qui
  // contient AUSSI les cinq phrases du retour de bilan — elles étaient figées
  // dans le code, elles deviennent modifiables et supprimables.
  if(!out.length)
    TPL_DEFAUTS.forEach((t,i)=>out.push({id:'tpld'+i,cat:t.cat,titre:t.titre,
      corps:t.corps,createdAt:base+i}));
  return out;
}
// Le plafond de l'envoi groupé. RepCore N'ENVOIE RIEN lui-même : il prépare
// des ouvertures de conversation, une par athlète. Le plafond protège donc
// d'un geste qu'on ne pourrait plus arrêter, pas d'un coût serveur.
function templateEnvoiGroupe(destinataires,journal){
  const l=Array.isArray(destinataires)?destinataires.filter(Boolean):[];
  if(l.length>TPL_GROUPE_MAX)
    return {ok:false,raison:'plafond',max:TPL_GROUPE_MAX,demandes:l.length};
  if(Array.isArray(journal))
    journal.push({quand:Date.now(),nb:l.length});
  return {ok:true,nb:l.length};
}
const QC_DEFAULTS=[
  {label:'Dos droit',text:"Garde le dos droit"},
  {label:'Descends plus bas',text:"Descends plus bas"},
  {label:'Souffle',text:"Souffle sur l'effort"},
  {label:'Genoux',text:"Attention aux genoux qui rentrent vers l'intérieur"},
  {label:'Beau travail !',text:"Beau travail"},
  {label:'Belle progression',text:"Belle progression depuis la dernière séance"},
];
// Chips du retour de BILAN. Liste distincte de celle des videos : melanger
// « Garde le dos droit » et « Bonne semaine » dans le meme jeu n'aurait pas
// de sens. Elle est FIXE, donc rien n'est ecrit dans le dossier du coach.
const QC_BILAN_DEFAULTS=[
  {label:'Bonne semaine',text:"Bonne semaine, le poids évolue comme prévu."},
  {label:'On ajuste',text:"On ajuste le programme, je te mets ça à jour."},
  {label:'Sommeil',text:"Le sommeil me préoccupe plus que le reste : on en parle ?"},
  {label:'Écarts',text:"Les écarts ne sont pas un problème à cette fréquence."},
  {label:'Mesures',text:"Pense à reprendre les mesures dans les mêmes conditions."}
];

// ── La bibliothèque, côté écran ───────────────────────────────────────────
// UN SEUL système : _getQC ne lit plus `quickComments` mais la bibliothèque de
// modèles, en la migrant à la première lecture. Les chips existantes et
// insertQC ne changent pas de forme — ce sont les mêmes appels, avec une autre
// source. C'est ce qui permet d'absorber sans rien casser.
const TPL_CAT_LIB=Object.freeze({technique:'Technique',motivation:'Motivation',
  nutrition:'Nutrition',administratif:'Administratif',absence:'Absence'});
// Le contexte de la zone de composition. Rempli par qui ouvre l’écran :
// c'est lui qui sait de quel exercice et de quel athlète on parle.
//
// `cible` EST L’ID DE LA ZONE POUR LAQUELLE CE CONTEXTE VAUT, et ce n’est pas
// un détail. Le coach ouvre la correction d’une vidéo SQUAT, annule, puis
// répond à un bilan : sans cette borne, le contexte porterait encore
// exercice:'SQUAT' et « Beau travail sur {exercice} » se remplirait tout
// seul, avec un exercice dont ce bilan ne parle pas. Une valeur fausse posée
// en silence est pire qu’une variable restée visible.
let _tplContexte={};
let _tplContexteCible=null;
function tplContexte(c,cible){ _tplContexte=c||{}; _tplContexteCible=cible||null; }
// PURE au sens qui compte ici : elle ne décide de rien d’autre que du champ
// de validité. Une autre zone ne garde que le PRÉNOM — le seul qui reste vrai
// d’une zone à l’autre, puisqu’on est dans la fiche du même athlète. Les
// trois autres redeviennent visibles, donc bloquantes à l’envoi.
function _tplCtxPour(cible){
  if(!_tplContexteCible||_tplContexteCible===cible) return _tplContexte;
  return {prenom:_tplContexte.prenom};
}

function _tplListe(){
  if(!currentUser) return [];
  if(!Array.isArray(currentUser.msgTemplates)||!currentUser.msgTemplates.length){
    currentUser.msgTemplates=templateMigrerCommentaires(currentUser);
    try{ saveUser(); }catch(e){}
  }
  return currentUser.msgTemplates.slice().sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
}
// La feuille « Modèles ». Rangée par catégorie, recherche par TITRE — le corps
// n'est pas cherché : on cherche le modèle qu'on connaît, pas un mot perdu.
function ouvrirModeles(cible){
  const l=_tplListe();
  window._tplCible=cible||'vc-general';
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:2px">Modèles</h2>
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:10px">Le texte reste modifiable après insertion : rien ne part sans que tu l'aies relu.</p>
    <input id="tpl-rech" placeholder="Rechercher un titre…" oninput="_tplFiltrer()" autocomplete="off"
      style="width:100%;font-size:var(--fs-md);padding:10px 12px;box-sizing:border-box;margin-bottom:10px">
    <div id="tpl-liste"></div>
    <button class="btn btn-outline" style="margin-top:12px;width:100%" onclick="ouvrirGestionModeles()">Gérer mes modèles</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  _tplFiltrer();
}
function _tplFiltrer(){
  const z=document.getElementById('tpl-liste');
  if(!z) return;
  const q=((document.getElementById('tpl-rech')||{}).value||'').toLowerCase().trim();
  const l=_tplListe().filter(t=>!q||String(t.titre||'').toLowerCase().indexOf(q)>=0);
  if(!l.length){
    z.innerHTML=`<div class="sub" style="font-size:var(--fs-sm);padding:14px 2px;line-height:1.6">${q?'Aucun modèle ne porte ce titre.':'Aucun modèle. Crée le premier depuis « Gérer mes modèles ».'}</div>`;
    return;
  }
  const parCat={};
  for(const t of l) (parCat[t.cat]=parCat[t.cat]||[]).push(t);
  z.innerHTML=Object.keys(TPL_CAT_LIB).filter(c=>parCat[c]).map(c=>`
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.6px;font-weight:800;text-transform:uppercase;margin:12px 0 6px">${escapeHtml(TPL_CAT_LIB[c])}</div>
    ${parCat[c].map(t=>{
      const v=templateVariables(t.corps);
      return `<button type="button" onclick="tplInserer('${escapeHtml(t.id)}')"
        style="width:100%;text-align:left;min-height:44px;padding:10px 12px;margin-bottom:6px;border-radius:var(--r-2);cursor:pointer;
          background:var(--surface-1);border:1px solid var(--border);color:var(--text-strong);font-family:Montserrat,sans-serif">
        <div style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${escapeHtml(t.titre)}</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-top:4px">${escapeHtml(t.corps)}</div>
        ${v.length?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">Variables : ${v.map(x=>escapeHtml(x)).join(', ')}</div>`:''}
      </button>`;}).join('')}`).join('');
}
// L'INSERTION résout les variables. Une variable non résolue ne bloque pas
// l'insertion — elle bloque l'ENVOI, et le champ est surligné pour qu'on la
// voie. « Bravo {prénom} » ne doit jamais partir tel quel.
function tplInserer(id){
  const t=_tplListe().find(x=>x&&x.id===id);
  if(!t) return false;
  const cible=window._tplCible||'vc-general';
  const ta=document.getElementById(cible);
  if(!ta) return false;
  const ctx=_tplCtxPour(cible);
  const r=templateResoudre(t.corps,ctx);
  ta.value=templateInserer(ta.value,t,ctx);
  closeModal();
  ta.focus();
  if(r.manquantes.length){
    _tplSurligner(ta,true);
    toast('À compléter : '+r.manquantes.join(', '),'var(--orange)');
  } else _tplSurligner(ta,false);
  return true;
}
function _tplSurligner(ta,ko){
  if(!ta) return;
  ta.style.borderColor=ko?'var(--orange)':'';
  ta.style.boxShadow=ko?'0 0 0 2px rgba(245,158,11,.25)':'';
}
// Garde-fou d'envoi. Appelé par les écrans qui envoient : tant qu'une variable
// reconnue subsiste dans le texte, on refuse et on surligne.
function tplVerifierAvantEnvoi(cible){
  const ta=document.getElementById(cible);
  if(!ta) return true;
  const r=templateResoudre(ta.value,{});
  const reste=templateVariables(ta.value);
  if(!reste.length){ _tplSurligner(ta,false); return true; }
  _tplSurligner(ta,true);
  ta.focus();
  toast('Une variable n\'est pas remplie : '+reste.join(', '),'var(--orange)');
  return false;
}
// ── Gestion : créer, modifier, supprimer ──────────────────────────────────
function ouvrirGestionModeles(){
  closeModal();
  const l=_tplListe();
  const opts=(sel)=>Object.keys(TPL_CAT_LIB).map(c=>`<option value="${c}"${c===sel?' selected':''}>${escapeHtml(TPL_CAT_LIB[c])}</option>`).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:2px">Mes modèles</h2>
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px">Variables reconnues : {prénom}, {exercice}, {séance}, {charge}. Elles sont remplies au moment où tu insères le modèle.</p>
    ${l.map(t=>`<div style="border:1px solid var(--border);border-radius:var(--r-3);padding:10px 10px;margin-bottom:8px">
      <div style="display:flex;gap:8px;align-items:center">
        <div style="flex:1;min-width:0;font-size:var(--fs-sm);font-weight:800;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.titre)}</div>
        <span style="flex-shrink:0;font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;text-transform:uppercase">${escapeHtml(TPL_CAT_LIB[t.cat]||t.cat)}</span>
        <button onclick="tplSupprimer('${escapeHtml(t.id)}')" aria-label="Supprimer ce modèle"
          style="flex-shrink:0;min-width:44px;min-height:38px;background:none;border:1px solid #3a1a1a;border-radius:var(--r-2);color:var(--red-text);cursor:pointer">${icon('croix',14)}</button>
      </div>
      <textarea oninput="tplMajCorps('${escapeHtml(t.id)}',this.value)" rows="2"
        style="width:100%;margin-top:8px;font-size:var(--fs-sm);box-sizing:border-box">${escapeHtml(t.corps)}</textarea>
    </div>`).join('')}
    <div style="border:1px dashed var(--border);border-radius:var(--r-3);padding:10px;margin-top:6px">
      <input id="tpl-n-titre" placeholder="Titre (ex : Genoux)" maxlength="40" style="width:100%;font-size:var(--fs-md);margin-bottom:6px;box-sizing:border-box">
      <select id="tpl-n-cat" style="width:100%;font-size:var(--fs-md);margin-bottom:6px">${opts('technique')}</select>
      <textarea id="tpl-n-corps" rows="2" placeholder="Texte du modèle…" style="width:100%;font-size:var(--fs-md);box-sizing:border-box"></textarea>
      <button class="btn btn-red btn-sm" style="width:100%;margin-top:8px" onclick="tplCreer()">Ajouter ce modèle</button>
    </div>
    <button class="btn btn-outline" style="margin-top:10px;width:100%" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function tplCreer(){
  const titre=((document.getElementById('tpl-n-titre')||{}).value||'').trim();
  const corps=((document.getElementById('tpl-n-corps')||{}).value||'').trim();
  const cat=((document.getElementById('tpl-n-cat')||{}).value||'technique');
  if(!titre||!corps) return toast('Un titre et un texte, au minimum.','var(--orange)');
  const l=_tplListe();
  currentUser.msgTemplates=l.concat([{id:'tpl'+Date.now(),cat:cat,
    titre:titre.slice(0,40),corps:corps,createdAt:Date.now()}]);
  toastEcriture(saveUser(),'Modèle ajouté '+ICO.coche,'le modèle est');
  ouvrirGestionModeles();
}
function tplMajCorps(id,v){
  const t=(currentUser.msgTemplates||[]).find(x=>x&&x.id===id);
  if(!t) return;
  t.corps=String(v||'');
  try{ saveUser(); }catch(e){}
}
// Un modèle supprimé ne doit PAS vider un brouillon en cours : l'insertion a
// copié le TEXTE, jamais une référence. Il n'y a donc rien à faire ici — le
// brouillon vit sa vie. Ce commentaire est là pour qu'on ne « répare » pas ça.
function tplSupprimer(id){
  const l=_tplListe().filter(x=>x&&x.id!==id);
  currentUser.msgTemplates=l;
  toastEcriture(saveUser(),'Modèle supprimé','le modèle est');
  ouvrirGestionModeles();
}
// « liste » est facultatif et vaut 'video' par defaut : tous les appels
// existants gardent exactement leur comportement.
// ABSORPTION. Il n existe plus deux systemes : les chips lisent la MEME
// bibliotheque de modeles que la feuille « Modeles », filtree par categorie.
// La forme rendue est inchangee ({id,label,text,pos}), donc insertQC et le
// rendu des chips ne bougent pas d une ligne.
//
// Les deux jeux restent DISTINCTS : melanger « Garde le dos droit » et
// « Bonne semaine » n aurait pas plus de sens qu avant.
const QC_CATS_VIDEO=Object.freeze(['technique','motivation']);
const QC_CATS_BILAN=Object.freeze(['motivation','nutrition','administratif','absence']);
function _getQC(liste){
  const cats=(liste==='bilan')?QC_CATS_BILAN:QC_CATS_VIDEO;
  return _tplListe().filter(t=>t&&cats.indexOf(t.cat)>=0)
    .map((t,i)=>({id:t.id,label:t.titre,text:t.corps,pos:i}));
}
// Le composant etait cable en dur sur l'ecran de retour video : la zone
// '#qc-chips' et la cible '#vc-general' etaient ecrites dans le code. On les
// parametre, avec les memes valeurs par defaut — les appels existants ne
// changent pas, et une batterie de non-regression le verifie.
function _renderQuickCommentChips(liste){
  const bilan=liste==='bilan';
  // LA ZONE DU BILAN EXISTE EN PLUSIEURS EXEMPLAIRES — une par bilan affiché.
  // On les peuple TOUTES, chacune pointant sur le champ de SON bloc : des
  // chips qui insèrent dans le champ du haut quel que soit le bilan sous lequel
  // on a cliqué sont pires que pas de chips du tout.
  if(bilan){
    const qcsB=_getQC(liste);
    const zones=document.querySelectorAll('[id^="qc-chips-bilan_"]');
    zones.forEach(z=>{
      const _id=String(z.id||'').slice('qc-chips-bilan_'.length);
      z.innerHTML=_htmlChipsQC(qcsB,_taIdBilan(_id));
    });
    return;
  }
  const zone='qc-chips';
  const cible='vc-general';
  const el=document.getElementById(zone);if(!el)return;
  const qcs=_getQC(liste);
  el.innerHTML=(qcs.length?qcs.map(c=>`<button data-qc="${escapeHtml(c.text)}" onclick="insertQC(this.dataset.qc,'${cible}')" style="flex-shrink:0;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-4);padding:0 14px;height:44px;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:600;cursor:pointer;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.label)}</button>`).join(''):'')
    // La liste du bilan est fixe : pas de bouton de gestion.
    // La feuille complete est atteignable des DEUX zones : c est la meme
    // bibliotheque, il n y a plus de raison de la reserver a la video.
    +`<button onclick="ouvrirModeles('${cible}')" style="flex-shrink:0;background:transparent;border:1px dashed var(--border);border-radius:var(--r-4);padding:0 14px;height:44px;color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">${icon('edit-2',13)} Modèles</button>`;
}
// LE MEME GABARIT POUR LES DEUX CHEMINS. Deux copies du même balisage
// finiraient par diverger — ce fichier en a déjà fait les frais ailleurs.
function _htmlChipsQC(qcs,cible){
  return ((qcs&&qcs.length)?qcs.map(c=>`<button data-qc="${escapeHtml(c.text)}" onclick="insertQC(this.dataset.qc,'${cible}')" style="flex-shrink:0;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-4);padding:0 14px;height:44px;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:600;cursor:pointer;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(c.label)}</button>`).join(''):'')
    +`<button onclick="ouvrirModeles('${cible}')" style="flex-shrink:0;background:transparent;border:1px dashed var(--border);border-radius:var(--r-4);padding:0 14px;height:44px;color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;white-space:nowrap">${icon('edit-2',13)} Modèles</button>`;
}
// LES VARIABLES SONT RESOLUES AVANT L INSERTION, comme dans tplInserer.
//
// Les deux lisent la MÊME bibliothèque — _getQC — et l’écran de gestion des
// modèles promet que les variables sont remplies à l’insertion. Ici le texte
// entrait tel quel : un modèle contenant {prénom} arrivait littéral, et
// tplVerifierAvantEnvoi refusait l’envoi en surlignant un champ que le coach
// venait de remplir d’un clic.
//
// LA CIBLE SERT DEUX FOIS : à trouver le champ, et à décider du contexte —
// _tplCtxPour ne rend le contexte entier qu’à la zone visée.
function insertQC(text,cible){
  const _cible=cible||'vc-general';
  const ta=document.getElementById(_cible);if(!ta)return;
  const r=templateResoudre(text,_tplCtxPour(_cible));
  const s=ta.selectionStart,e=ta.selectionEnd;
  const before=ta.value.substring(0,s),after=ta.value.substring(e);
  const sep=(before&&!/[\s\n]$/.test(before))?'. ':'';
  const ins=sep+r.texte;
  ta.value=before+ins+after;
  const p=s+ins.length;ta.setSelectionRange(p,p);ta.focus();
  // MÊME SUITE QUE tplInserer : ce qui reste à compléter est SURLIGNÉ et DIT.
  // Sans cela, le coach découvrirait le manque au refus d’envoi.
  if(r.manquantes.length){
    _tplSurligner(ta,true);
    toast('À compléter : '+r.manquantes.join(', '),'var(--orange)');
  } else _tplSurligner(ta,false);
}
// ABSORBE. L ancien gestionnaire ecrivait dans `quickComments`, que _getQC ne
// lit plus : le laisser en place aurait donne un ecran ou l on modifie des
// textes qui ne s affichent nulle part. Il renvoie vers l editeur unique.
// Les fonctions qc* qui suivent ne sont plus atteignables depuis l interface.
function openQCManager(){ return ouvrirGestionModeles(); }
function qcAdd(){
  const label=(document.getElementById('qc-new-label')?.value||'').trim();
  const text=(document.getElementById('qc-new-text')?.value||'').trim()||label;
  if(!label){toast('Entre un texte pour la chip','var(--orange)');return;}
  if(!currentUser.quickComments)currentUser.quickComments=[];
  const maxPos=currentUser.quickComments.reduce((m,c)=>Math.max(m,c.pos??0),0);
  currentUser.quickComments.push({id:'qc'+Date.now(),label:label.slice(0,40),text:text.slice(0,120),pos:maxPos+1});
  toastEcriture(saveUser(),'Commentaire ajouté '+ICO.coche,'le commentaire est');
  openQCManager();_renderQuickCommentChips();
}
function qcEditRow(id){
  const c=(currentUser.quickComments||[]).find(x=>x.id===id);if(!c)return;
  const row=document.getElementById('qcr-'+id);if(!row)return;
  row.innerHTML=`<div style="flex:1;min-width:0">
    <input id="qce-lbl-${c.id}" value="${escapeHtml(c.label)}" maxlength="40" style="width:100%;box-sizing:border-box;margin-bottom:4px;font-size:var(--fs-sm)">
    <input id="qce-txt-${c.id}" value="${escapeHtml(c.text)}" maxlength="120" style="width:100%;box-sizing:border-box;font-size:var(--fs-xs)">
  </div>
  <button data-id="${c.id}" onclick="qcSaveEdit(this.dataset.id)" style="background:var(--red);border:none;color:var(--text);border-radius:var(--r-1);padding:8px 12px;font-size:var(--fs-xs);font-weight:800;cursor:pointer;font-family:Montserrat,sans-serif">Enregistrer</button>
  <button onclick="openQCManager()" style="background:none;border:1px solid var(--border);border-radius:var(--r-1);padding:8px 10px;font-size:var(--fs-sm);cursor:pointer;color:var(--sub)">${icon('croix',14)}</button>`;
  document.getElementById('qce-lbl-'+c.id)?.focus();
}
function qcSaveEdit(id){
  const c=(currentUser.quickComments||[]).find(x=>x.id===id);if(!c)return;
  const label=(document.getElementById('qce-lbl-'+id)?.value||'').trim();
  const text=(document.getElementById('qce-txt-'+id)?.value||'').trim();
  if(!label){toast('Le label ne peut pas être vide','var(--orange)');return;}
  c.label=label.slice(0,40);c.text=(text||label).slice(0,120);
  saveUser();openQCManager();_renderQuickCommentChips();
}
async function qcDel(id){
  if(!await rcConfirm('Supprimer ce commentaire-type ?',null,'Supprimer'))return;
  currentUser.quickComments=(currentUser.quickComments||[]).filter(c=>c.id!==id);
  saveUser();openQCManager();_renderQuickCommentChips();
}
function qcUp(idx){
  const qcs=_getQC();if(idx===0)return;
  [qcs[idx-1].pos,qcs[idx].pos]=[qcs[idx].pos,qcs[idx-1].pos];
  currentUser.quickComments=qcs;saveUser();openQCManager();_renderQuickCommentChips();
}
function qcDown(idx){
  const qcs=_getQC();if(idx===qcs.length-1)return;
  [qcs[idx].pos,qcs[idx+1].pos]=[qcs[idx+1].pos,qcs[idx].pos];
  currentUser.quickComments=qcs;saveUser();openQCManager();_renderQuickCommentChips();
}
async function qcReset(){
  if(!await rcConfirm('Réinitialiser aux 6 commentaires par défaut ?',null,'Confirmer'))return;
  currentUser.quickComments=QC_DEFAULTS.map((c,i)=>({id:'qcd'+Date.now()+i,label:c.label,text:c.text,pos:i}));
  toastEcriture(saveUser(),'Liste réinitialisée '+ICO.coche,'la liste est');openQCManager();_renderQuickCommentChips();
}
// ======= VIDEO CORRECTION =======

// ══════════════ LECTEUR DE CORRECTION — RALENTI, IMAGE PAR IMAGE ══════════
// Tout se passe dans l'élément <video> LOCAL. Aucune transformation n'est
// demandée à Cloudinary ni à Firebase Storage : le coût serveur est
// strictement nul, le fichier téléchargé est le même qu'avant.
//
// AUCUN CHAMP AJOUTÉ AU DOCUMENT user par ce lot — sauf `sec` sur une
// annotation, qui est la seule façon de garder la précision que le ralenti
// fait justement gagner (voir _vcAnnoterIci).
const VID_FPS_DEFAUT=30;
const VID_RATES=[0.25,0.5,1,2];
const VID_BOUCLE_MAX_S=10;      // au-delà, on retéléchargerait le média entier
const VID_DUREE_MIN_BOUCLE=2;   // sous 2 s, une boucle n'a aucun sens

// PURE côté effet : pose la vitesse et rend celle réellement appliquée.
// iOS REMET parfois playbackRate à 1 après un play() : l'appelant réapplique
// sur l'évènement 'play', c'est pour ça que la fonction est idempotente.
function videoSetRate(el,rate){
  const r=Number(rate);
  if(!el||!(r>0)) return null;
  try{ el.playbackRate=r; }catch(e){ return null; }
  return el.playbackRate;
}
// Le fps n'est donné par AUCUNE API. requestVideoFrameCallback permet de
// l'estimer (Safari 15.4+, Chrome 83+) ; ailleurs on rend 30 et l'écran le
// dit. Mieux vaut un repli annoncé qu'une exactitude prétendue.
function videoDetectFps(el){
  const f=el&&Number(el._rcFps);
  return (isFinite(f)&&f>0)?f:VID_FPS_DEFAUT;
}
// Mesure asynchrone, quand le navigateur la permet. Elle ne bloque rien :
// tant qu'elle n'a pas abouti, videoDetectFps rend 30.
function _videoMesurerFps(el,fini){
  if(!el||typeof el.requestVideoFrameCallback!=='function'){ if(fini) fini(VID_FPS_DEFAUT,false); return; }
  let t0=null,f0=null,n=0;
  const pas=(now,meta)=>{
    if(t0==null){ t0=meta.mediaTime; f0=meta.presentedFrames; }
    else{
      const dt=meta.mediaTime-t0, df=meta.presentedFrames-f0;
      if(dt>0.4&&df>0){
        const fps=df/dt;
        el._rcFps=Math.round(fps*100)/100;
        // Écart franc à un fps entier : la cadence est variable (téléphones
        // récents qui filment en 30-60 adaptatif). On le DIT.
        el._rcFpsVariable=Math.abs(fps-Math.round(fps))>0.6;
        if(fini) fini(videoDetectFps(el),!!el._rcFpsVariable);
        return;
      }
    }
    if(++n<180) el.requestVideoFrameCallback(pas);
    else if(fini) fini(VID_FPS_DEFAUT,false);
  };
  try{ el.requestVideoFrameCallback(pas); }catch(e){ if(fini) fini(VID_FPS_DEFAUT,false); }
}
// Une image en avant ou en arrière. La vidéo est mise en PAUSE : avancer
// d'une image pendant la lecture n'a pas de sens, la lecture reprendrait
// aussitôt par-dessus.
function videoStepFrame(el,direction,fps){
  if(!el) return null;
  const f=(fps>0)?fps:videoDetectFps(el);
  const d=(direction<0)?-1:1;
  try{ el.pause(); }catch(e){}
  const duree=Number(el.duration);
  let t=Number(el.currentTime||0)+d*(1/f);
  if(t<0) t=0;
  if(isFinite(duree)&&duree>0&&t>duree) t=duree;
  try{ el.currentTime=t; }catch(e){ return null; }
  return t;
}
// Boucle de segment. Bornée à dix secondes : au-delà, la lecture en boucle
// finirait par retélécharger le média entier à chaque tour, ce qui coûterait
// de la bande passante à l'athlète pour rien.
function videoSetLoop(el,a,b){
  if(!el) return null;
  const d1=Number(a), d2=Number(b);
  if(!(isFinite(d1)&&isFinite(d2))) return null;
  const debut=Math.max(0,Math.min(d1,d2)), fin=Math.max(d1,d2);
  if(!(fin>debut)) return null;
  if((fin-debut)>VID_BOUCLE_MAX_S) return null;   // REFUS explicite
  el._rcLoop={a:debut,b:fin};
  if(!el._rcLoopFn){
    el._rcLoopFn=()=>{
      const l=el._rcLoop;
      if(!l) return;
      if(el.currentTime>=l.b||el.currentTime<l.a-0.05){
        try{ el.currentTime=l.a; }catch(e){}
      }
    };
    el.addEventListener('timeupdate',el._rcLoopFn);
  }
  return {a:debut,b:fin};
}
function videoClearLoop(el){
  if(!el) return false;
  el._rcLoop=null;
  if(el._rcLoopFn){ el.removeEventListener('timeupdate',el._rcLoopFn); el._rcLoopFn=null; }
  return true;
}
// PURE. Secondes → « m:ss ». Le libellé reste au format que la liste connaît
// déjà ; la précision, elle, part dans le champ `sec` (voir _vcAnnoterIci).
function secsToTs(sec){
  const s=Math.max(0,Math.floor(Number(sec)||0));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}

// ── La barre de commandes, sous la vidéo ──────────────────────────────────
// Tant que les métadonnées ne sont pas là, les commandes sont DÉSACTIVÉES —
// pas masquées : une barre qui apparaît après coup fait sauter la mise en
// page et laisse croire à un défaut.
//
// Sur une vidéo YouTube, il n'y a pas d'élément <video> à piloter : la barre
// ne s'affiche pas du tout. La piloter demanderait l'API iframe de YouTube,
// c'est-à-dire un script externe — exclu.
// `video` (facultatif) : l'entree de la video, pour proposer ses repetitions
// decoupees dans Motion Lab. Sans elle, la barre est exactement celle d'avant.
// ══ LA MAQUETTE « CORRIGER LA VIDEO » DE KEVIN, 21/09/2026 ════════════════
// La barre devient deux cartes, « Vitesse de lecture » et « Contrôles » :
// image par image, lecture, son, position, boucle A-B. Les identifiants et les
// attributs data-* d'avant sont TOUS conserves : rcVitesse, rcPas, rcMarque,
// rcRepetition et _rcActiver les retrouvent sans changer de regle.
const _VCX_SVG=(p,t,plein)=>'<svg viewBox="0 0 24 24" width="'+t+'" height="'+t+'" aria-hidden="true"'
  +(plein?' fill="currentColor"':' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter"')
  +'>'+p+'</svg>';
const _VCX_P=Object.freeze({
  jauge:'<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.4" fill="currentColor"/>',
  prec:'<path d="M6 5v14"/><path d="M18 5 9 12l9 7z" fill="currentColor"/>',
  suiv:'<path d="M18 5v14"/><path d="m6 5 9 7-9 7z" fill="currentColor"/>',
  lire:'<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause:'<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  son:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  muet:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',
  boucle:'<path d="M20 12a8 8 0 0 1-13.7 5.7M4 12a8 8 0 0 1 13.7-5.7"/><path d="M17.7 2.5v3.8h-3.8M6.3 21.5v-3.8h3.8"/>',
  retour:'<path d="m15 18-6-6 6-6"/>',
  camera:'<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/>',
  reglages:'<path d="M6 3v6M6 13v8M12 3v10M12 17v4M18 3v4M18 11v10"/><circle cx="6" cy="11" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="18" cy="9" r="2"/>',
  agenda:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  format:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  ciseaux:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  fleche:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  bulle:'<path d="M4 5h16v11H9.5L4 20z"/>',
  horloge:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  micro:'<path d="M12 2.5a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0v-6a3 3 0 0 0-3-3z"/><path d="M18.5 10.5v1a6.5 6.5 0 0 1-13 0v-1M12 18v3.5M8.5 21.5h7"/>',
  dossier:'<path d="M21 18.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2h4.5l2 2.5H19a2 2 0 0 1 2 2z"/>',
  plein:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'});
function htmlLecteurCorrection(vidId,video){
  const segs=video?segmentsVideo(video):[];
  const q='\''+vidId+'\'';
  const b=(lib,act,titre,extra,cl)=>`<button type="button" class="rcx-b${cl?' '+cl:''}" onclick="${act}" title="${escapeHtml(titre)}"
    aria-label="${escapeHtml(titre)}" ${extra||''} disabled>${lib}</button>`;
  return `<div id="rc-barre-${vidId}" data-vid="${vidId}" class="rcx">
    <section class="vcx-carte rcx-carte">
      <div class="vcx-ct" role="heading" aria-level="3">${_VCX_SVG(_VCX_P.jauge,22)}Vitesse de lecture</div>
      <div class="rcx-vitesses">
      ${VID_RATES.map(r=>`<button type="button" class="rcx-b rcx-v" onclick="rcVitesse(${q},${r})"
        data-rate="${r}" disabled aria-pressed="false"
        aria-label="Lire à ${String(r).replace('.',',')} fois la vitesse normale">${String(r).replace('.',',')}×</button>`).join('')}
      </div>
    </section>
    <section class="vcx-carte rcx-carte">
      <div class="vcx-ct" role="heading" aria-level="3">${_VCX_SVG(_VCX_P.jauge,22)}Contrôles<span id="rc-fps-${vidId}" class="rcx-fps"></span></div>
      <div class="rcx-ligne">
        ${b(_VCX_SVG(_VCX_P.prec,20),'rcPas('+q+',-1)','Reculer d\'une image (flèche gauche)','data-cmd="pas"')}
        ${/* LA LECTURE EST ACTIVE D'EMBLEE, comme les repetitions : la video est
             en preload="none", et c'est ce bouton qui la charge. */
          b(_VCX_SVG(_VCX_P.lire,20),'rcLecture('+q+')','Lire la vidéo','data-cmd="lecture" id="rc-lire-'+vidId+'"').replace(' disabled','')}
        ${b(_VCX_SVG(_VCX_P.suiv,20),'rcPas('+q+',1)','Avancer d\'une image (flèche droite)','data-cmd="pas"')}
        ${b(_VCX_SVG(_VCX_P.son,22),'rcSon('+q+')','Couper le son','data-cmd="son" id="rc-son-'+vidId+'" aria-pressed="false"','rcx-son')}
      </div>
      <div class="rcx-temps">
        <input type="range" id="rc-pos-${vidId}" class="rcx-pos" min="0" max="1000" step="1" value="0" disabled
          aria-label="Position dans la vidéo" oninput="rcAller(${q},this.value)">
        <span id="rc-t-${vidId}" class="rcx-t">0:00 / 0:00</span>
      </div>
      <div id="rc-boucle-${vidId}" class="rcx-ab">
        ${b('A','rcMarque('+q+',\'a\')','Poser le début de la boucle ici','data-cmd="ab"','rcx-lettre')}
        ${b('B','rcMarque('+q+',\'b\')','Poser la fin de la boucle ici','data-cmd="ab"','rcx-lettre')}
        ${b(_VCX_SVG(_VCX_P.boucle,20)+'<span>Effacer la boucle</span>','rcEffacerBoucle('+q+')','Effacer la boucle','data-cmd="ab"')}
      </div>
      <div id="rc-ab-${vidId}" class="rcx-info" aria-live="polite"></div>
      ${segs.length?`<!-- MOTION LAB : LES REPETITIONS DECOUPEES. Une touche lit la
           repetition en boucle, de son debut a sa fin : le lecteur respecte les
           bornes posees, sans rien reencoder. Les bornes voyagent en attribut,
           en millisecondes, pour que rcRepetition n'ait rien a relire du dossier. -->
      <div id="rc-reps-${vidId}" data-segs="${escapeHtml(JSON.stringify(segs.map(s=>[s.debutMs,s.finMs])))}" class="rcx-reps">
        <span class="rcx-reps-t">Répétitions</span>
        ${segs.map((s,i)=>b(escapeHtml(s.label),'rcRepetition('+q+','+i+')',
          'Lire '+s.label+' en boucle','data-cmd="rep" data-rep="'+i+'" aria-pressed="false"','rcx-rep')
          // ACTIVES D'EMBLEE, contrairement au reste de la barre : la video de la
          // feuille est en preload="none", et une repetition qui attendrait qu'on
          // lance la lecture pour se laisser choisir ferait un geste de trop.
          // rcRepetition charge elle-meme les metadonnees.
          .replace(' disabled','')).join('')}
      </div>`:''}
    </section>
  </div>`;
}
function _rcVideo(vidId){ return document.getElementById(vidId); }
function _rcActiver(vidId,ok){
  const z=document.getElementById('rc-barre-'+vidId);
  if(!z) return;
  // La glissiere en fait partie, et « Annoter ici », posee dans la carte des
  // repères, s'y rattache par data-rc-hors.
  [...z.querySelectorAll('button,input[type="range"]'),...document.querySelectorAll('[data-rc-hors="'+vidId+'"]')]
    .forEach(b=>{ b.disabled=!ok; b.style.opacity=ok?'1':'.45'; });
}
function rcVitesse(vidId,r){
  const v=_rcVideo(vidId);
  const applique=videoSetRate(v,r);
  if(applique==null) return false;
  const z=document.getElementById('rc-barre-'+vidId);
  if(z) z.querySelectorAll('button[data-rate]').forEach(b=>{
    const actif=Math.abs(Number(b.dataset.rate)-applique)<1e-6;
    b.setAttribute('aria-pressed',actif?'true':'false');
  });
  const badge=document.getElementById('rc-badge-'+vidId);
  if(badge) badge.textContent=String(applique).replace('.',',')+'×';
  if(v) v._rcRate=applique;
  return true;
}
function rcPas(vidId,dir){
  const v=_rcVideo(vidId);
  if(!v) return false;
  videoStepFrame(v,dir,videoDetectFps(v));
  return true;
}
function rcMarque(vidId,quel){
  const v=_rcVideo(vidId);
  if(!v) return false;
  v._rcAB=v._rcAB||{};
  v._rcAB[quel]=Number(v.currentTime)||0;
  const {a,b}=v._rcAB;
  const z=document.getElementById('rc-ab-'+vidId);
  if(a!=null&&b!=null){
    const r=videoSetLoop(v,a,b);
    if(!r){
      if(z) z.textContent='Segment trop long : '+VID_BOUCLE_MAX_S+' s au maximum.';
      return false;
    }
    if(z) z.textContent='Boucle '+secsToTs(r.a)+' → '+secsToTs(r.b);
  } else if(z) z.textContent=(quel==='a'?'A':'B')+' posé à '+secsToTs(v._rcAB[quel]);
  return true;
}
function rcEffacerBoucle(vidId){
  const v=_rcVideo(vidId);
  if(!v) return false;
  videoClearLoop(v); v._rcAB={};
  const z=document.getElementById('rc-ab-'+vidId);
  if(z) z.textContent='';
  _rcMarquerRepetition(vidId,-1);
  return true;
}
// MOTION LAB — LIRE UNE REPETITION DECOUPEE. Elle demarre a son debut et
// boucle a sa fin : c'est la boucle A-B existante, posee sur les bornes du
// coach. videoSetLoop refuse au-dela de dix secondes, et segmentsVideo n'en
// laisse jamais passer de plus longue.
function rcRepetition(vidId,i){
  const v=_rcVideo(vidId), z=document.getElementById('rc-reps-'+vidId);
  if(!v||!z) return false;
  let l=[];
  try{ l=JSON.parse(z.dataset.segs||'[]'); }catch(e){ l=[]; }
  const s=l[i];
  if(!Array.isArray(s)) return false;
  // PAS ENCORE DE METADONNEES (preload="none") : on les demande, et la
  // repetition se pose des qu'elles arrivent.
  if(v.readyState<1){
    v.addEventListener('loadedmetadata',()=>{ rcRepetition(vidId,i); },{once:true});
    try{ v.preload='metadata'; v.load(); }catch(e){ return false; }
    return true;
  }
  const r=videoSetLoop(v,Number(s[0])/1000,Number(s[1])/1000);
  if(!r) return false;
  v._rcAB={a:r.a,b:r.b};
  try{ v.currentTime=r.a; }catch(e){}
  const ab=document.getElementById('rc-ab-'+vidId);
  if(ab) ab.textContent='Boucle '+secsToTs(r.a)+' → '+secsToTs(r.b);
  _rcMarquerRepetition(vidId,i);
  try{ const p=v.play(); if(p&&typeof p.catch==='function') p.catch(()=>{}); }catch(e){}
  return true;
}
function _rcMarquerRepetition(vidId,i){
  const z=document.getElementById('rc-reps-'+vidId);
  if(!z) return;
  z.querySelectorAll('button[data-rep]').forEach(b=>{
    const on=Number(b.dataset.rep)===i;
    b.setAttribute('aria-pressed',on?'true':'false');
  });
}
// ── LES COMMANDES DE LA MAQUETTE : lecture, son, position, plein ecran ─────
// Elles doublent les controles natifs de la video, qui restent la : un coach
// qui a pris l'habitude du lecteur du navigateur ne perd rien.
function rcLecture(vidId){
  const v=_rcVideo(vidId);
  if(!v) return false;
  try{
    if(v.paused||v.ended){ const p=v.play(); if(p&&typeof p.catch==='function') p.catch(()=>{}); }
    else v.pause();
  }catch(e){ return false; }
  return true;
}
function rcSon(vidId){
  const v=_rcVideo(vidId);
  if(!v) return false;
  v.muted=!v.muted;
  _rcMajSon(vidId);
  return true;
}
// `val` sur 1000 : la glissiere ne connait pas la duree, la video si.
function rcAller(vidId,val){
  const v=_rcVideo(vidId);
  const d=Number(v&&v.duration);
  if(!v||!isFinite(d)||d<=0) return false;
  try{ v.currentTime=d*Math.max(0,Math.min(1000,Number(val)||0))/1000; }catch(e){ return false; }
  _rcMajTemps(vidId);
  return true;
}
function rcPleinEcran(vidId){
  const v=_rcVideo(vidId);
  if(!v) return false;
  try{
    if(v.requestFullscreen){ const p=v.requestFullscreen(); if(p&&typeof p.catch==='function') p.catch(()=>{}); }
    else if(v.webkitEnterFullscreen) v.webkitEnterFullscreen();     // iPhone
    else if(v.webkitRequestFullscreen) v.webkitRequestFullscreen();
    else return false;
  }catch(e){ return false; }
  return true;
}
function _rcMajTemps(vidId){
  const v=_rcVideo(vidId);
  if(!v) return;
  const d=Number(v.duration), t=Number(v.currentTime)||0;
  const ok=isFinite(d)&&d>0;
  const pos=document.getElementById('rc-pos-'+vidId);
  if(pos){
    const p=ok?Math.max(0,Math.min(1000,Math.round(t/d*1000))):0;
    if(document.activeElement!==pos) pos.value=String(p);
    pos.style.setProperty('--p',(p/10)+'%');
  }
  const l=document.getElementById('rc-t-'+vidId);
  if(l) l.textContent=secsToTs(t)+' / '+(ok?secsToTs(d):'0:00');
}
function _rcMajLecture(vidId){
  const v=_rcVideo(vidId), b=document.getElementById('rc-lire-'+vidId);
  if(!v||!b) return;
  const joue=!v.paused&&!v.ended;
  b.innerHTML=_VCX_SVG(joue?_VCX_P.pause:_VCX_P.lire,20);
  const lib=joue?'Mettre en pause':'Lire la vidéo';
  b.title=lib; b.setAttribute('aria-label',lib);
}
function _rcMajSon(vidId){
  const v=_rcVideo(vidId), b=document.getElementById('rc-son-'+vidId);
  if(!v||!b) return;
  b.innerHTML=_VCX_SVG(v.muted?_VCX_P.muet:_VCX_P.son,22);
  b.setAttribute('aria-pressed',v.muted?'true':'false');
  const lib=v.muted?'Remettre le son':'Couper le son';
  b.title=lib; b.setAttribute('aria-label',lib);
}
// PURE. Le format d'une video, lu dans ses VRAIES dimensions. La maquette
// proposait un menu « Story Instagram (9:16) » ; rien ici ne reencode ni
// n'exporte une video, et un menu qui ne change rien mentirait. On dit donc
// ce que la video EST — c'est ce que le coach a besoin de savoir pour la
// regarder, et pour la reprendre dans Motion Lab.
const VID_FORMATS=Object.freeze([[9,16,'Vertical'],[3,4,'Portrait'],[4,5,'Portrait'],[1,1,'Carré'],[4,3,'Paysage'],[16,9,'Paysage']]);
function formatVideo(w,h){
  w=Number(w); h=Number(h);
  if(!(w>0&&h>0)) return null;
  const r=w/h;
  let m=null;
  for(const [a,b,lib] of VID_FORMATS){
    const e=Math.abs(Math.log(r/(a/b)));
    if(!m||e<m.e) m={a:a,b:b,lib:lib,e:e};
  }
  const dims=Math.round(w)+' × '+Math.round(h);
  // Au-dela de 4 % d'ecart, aucun format courant : l'orientation et les
  // dimensions, sans rapport invente.
  if(m.e>0.04) return {lib:r<1?'Vertical':(r>1?'Paysage':'Carré'),ratio:'',dims:dims};
  return {lib:m.lib,ratio:m.a+':'+m.b,dims:dims};
}
function _rcMajFormat(vidId){
  const v=_rcVideo(vidId);
  const f=v?formatVideo(v.videoWidth,v.videoHeight):null;
  if(!f) return;
  const nom=f.lib+(f.ratio?' ('+f.ratio+')':'');
  const z=document.getElementById('vcx-format'), dm=document.getElementById('vcx-dims');
  if(z) z.textContent=nom;
  if(dm) dm.textContent=f.dims;
  const bd=document.getElementById('vcx-badge');
  if(bd){ bd.innerHTML=escapeHtml(f.lib)+(f.ratio?'<small>'+escapeHtml(f.ratio)+'</small>':''); bd.hidden=false; }
}
// Le compteur de caracteres du commentaire. Il n'y a PAS de limite : la
// maquette affichait « 0/500 », mais saveVideoCorrection n'en impose aucune, et
// un plafond affiche qu'aucun code ne tient serait un mensonge.
function _vcxCompte(){
  const ta=document.getElementById('vc-general'), z=document.getElementById('vcx-compte');
  if(!ta||!z) return;
  const n=String(ta.value||'').length;
  z.textContent=n+' caractère'+(n>1?'s':'');
}
// « Annoter ici ». Le timecode enregistré est le temps RÉEL de la vidéo, pas
// le temps perçu au ralenti : currentTime ne dépend pas de playbackRate.
function rcAnnoterIci(vidId){
  const v=_rcVideo(vidId);
  if(!v) return false;
  const t=Number(v.currentTime)||0;
  const champ=document.getElementById('vc-ts-time');
  if(champ){ champ.value=secsToTs(t); champ.dataset.sec=String(Math.round(t*10)/10); }
  const note=document.getElementById('vc-ts-note');
  if(note) note.focus();
  return true;
}
// Câblage. Appelé après l'insertion de la modale.
function rcInitLecteur(vidId){
  const v=_rcVideo(vidId);
  const z=document.getElementById('rc-barre-'+vidId);
  if(!v||!z) return false;
  const pret=()=>{
    _rcActiver(vidId,true);
    // Vidéo trop courte : la boucle de segment n'a aucun sens, on la masque.
    const d=Number(v.duration);
    const bo=document.getElementById('rc-boucle-'+vidId);
    if(bo&&isFinite(d)&&d<VID_DUREE_MIN_BOUCLE) bo.style.display='none';
    _videoMesurerFps(v,(fps,variable)=>{
      const f=document.getElementById('rc-fps-'+vidId);
      if(!f) return;
      f.textContent=variable
        ?'Cadence variable : le pas est approché ('+Math.round(fps)+' i/s).'
        :((v._rcFps?Math.round(fps):VID_FPS_DEFAUT)+' i/s'+(v._rcFps?'':' (estimation par défaut)'));
    });
  };
  if(v.readyState>=1) pret(); else v.addEventListener('loadedmetadata',pret,{once:true});
  // LA MAQUETTE : la position, la lecture, le son et le format suivent la video.
  const maj=()=>_rcMajTemps(vidId);
  ['timeupdate','durationchange','loadedmetadata','seeked'].forEach(ev=>v.addEventListener(ev,maj));
  ['play','pause','ended'].forEach(ev=>v.addEventListener(ev,()=>_rcMajLecture(vidId)));
  v.addEventListener('volumechange',()=>_rcMajSon(vidId));
  v.addEventListener('loadedmetadata',()=>_rcMajFormat(vidId));
  if(v.readyState>=1) _rcMajFormat(vidId);
  _rcMajTemps(vidId); _rcMajLecture(vidId); _rcMajSon(vidId);
  // iOS remet playbackRate à 1 apres un play() : on le repose.
  v.addEventListener('play',()=>{ if(v._rcRate&&v._rcRate!==1) videoSetRate(v,v._rcRate); });
  // Flèches gauche/droite = image par image. IGNORÉES quand le focus est dans
  // un champ de saisie : sinon on casserait le déplacement du curseur, et la
  // modale en contient deux.
  if(!z._rcClavier){
    z._rcClavier=true;
    const modale=z.closest('#modal-overlay')||document;
    modale.addEventListener('keydown',e=>{
      const c=e.target&&e.target.tagName;
      if(c==='INPUT'||c==='TEXTAREA'||c==='SELECT') return;
      if(e.key==='ArrowLeft'){ e.preventDefault(); rcPas(vidId,-1); }
      else if(e.key==='ArrowRight'){ e.preventDefault(); rcPas(vidId,1); }
    });
  }
  rcVitesse(vidId,1);
  return true;
}
