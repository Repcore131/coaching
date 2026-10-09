// ══ LE DÉFI 28 JOURS (build 1956) ═════════════════════════════════════════
// Créé par le coach : dates (28 jours pile), phases, règles, seuil de
// check-ins, nombre de gagnants. Chaque athlète inscrit fait son check-in
// quotidien, et peut poser une photo J1 et une photo J28, TAMPONNÉES dans
// l'app (date, heure, jour du défi, prénom, dessinés dans l'image par le
// canvas). Une photo posée ne se remplace jamais (règles : écrite une fois) ;
// elle se retire (retrait du consentement).
//   ⚠ CONSENTEMENT EXPLICITE : l'image ne part chez le coach que si la case
//     « Je partage cette photo avec mon coach » est cochée. Sans elle, seule
//     l'empreinte SHA-256 part (la preuve qu'une photo datée existe) ; la
//     photo tamponnée reste sur le téléphone (téléchargement proposé).
// LE TIRAGE AU SORT, ÉQUITABLE ET VÉRIFIABLE : la graine (32 hexa) est tirée
// et PUBLIÉE à la création, avant toute inscription, et les règles la gèlent.
// Le ticket de chacun vaut SHA-256(graine + ':' + sa clé) ; les éligibles
// sont rangés par ticket croissant, les N premiers gagnent. Le résultat
// publié donne la graine et tous les tickets, jamais une clé : chacun recalcule
// le sien (sur n'importe quel outil SHA-256) et vérifie son rang.
// Stockage : canaux/<coach>/defis28/<id>/{def, tirage, participants/<clé>}
// (database.rules.json), et canaux/<coach>/defis28_liste/<id> = debut (ce
// que l'athlète peut lister).

const D28_JOURS=28;
const D28_J=864e5;
const D28_PHOTO_FENETRE=3;          // J1 : jours 1 à 3 ; J28 : jours 26 à 28 (+ le lendemain)
const D28_PHOTO_COTE=720;           // le grand côté de la photo tamponnée
const D28_ID_RE=/^t[a-z0-9]{8,24}$/;

// ── SHA-256, PUR ET SYNCHRONE ────────────────────────────────────────────────
// Le même résultat que tout outil SHA-256 (FIPS 180-4) : c'est ce qui rend
// le tirage vérifiable hors de l'app. Entrée : une chaîne, encodée en UTF-8.
const _SHA_K=Object.freeze([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
/** PURE. SHA-256 d'une chaîne (UTF-8) ou d'octets, en 64 hexa minuscules. */
function sha256Hex(entree){
  const o=(entree instanceof Uint8Array)?entree:new TextEncoder().encode(String(entree==null?'':entree));
  const l=o.length, nb=((l+9+63)>>6)<<6;
  const m=new Uint8Array(nb); m.set(o); m[l]=0x80;
  const bits=l*8, dv=new DataView(m.buffer);
  dv.setUint32(nb-8,Math.floor(bits/0x100000000)); dv.setUint32(nb-4,bits>>>0);
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const w=new Uint32Array(64);
  const r=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let p=0;p<nb;p+=64){
    for(let i=0;i<16;i++) w[i]=dv.getUint32(p+i*4);
    for(let i=16;i<64;i++){
      const s0=r(w[i-15],7)^r(w[i-15],18)^(w[i-15]>>>3), s1=r(w[i-2],17)^r(w[i-2],19)^(w[i-2]>>>10);
      w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;
    }
    let [a,b,c,d,e,f,g,k]=h;
    for(let i=0;i<64;i++){
      const t1=(k+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+_SHA_K[i]+w[i])>>>0;
      const t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      k=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
    h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+k)>>>0;
  }
  return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}

// ── LE CALCUL, PUR ───────────────────────────────────────────────────────────
/** Une graine neuve : 16 octets aléatoires, 32 hexa. */
function d28NouvelleGraine(){
  const b=new Uint8Array(16);
  try{ crypto.getRandomValues(b); }catch(e){ for(let i=0;i<16;i++) b[i]=Math.floor(Math.random()*256); }
  return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
}
function d28NouvelId(){
  const a='abcdefghijklmnopqrstuvwxyz0123456789';
  let s='t';
  try{ const b=new Uint8Array(14); crypto.getRandomValues(b); for(const x of b) s+=a[x%36]; }
  catch(e){ for(let i=0;i<14;i++) s+=a[Math.floor(Math.random()*36)]; }
  return s;
}
/**
 * PURE. Le défi tiré du formulaire du coach.
 * @param {{titre:string, debut:number, phases:{titre,du,au}[], regles:string[], minCheckins:number, gagnants:number, recompense?:string}} x
 * @returns {{def?:object, erreur?:string}}
 */
function d28Definition(x,graine,maintenant){
  const t=typeof maintenant==='number'?maintenant:Date.now();
  const titre=String((x&&x.titre)||'').trim().slice(0,80);
  if(!titre) return {erreur:'Donne un titre au défi.'};
  const debut=Number(x&&x.debut);
  if(!(debut>0)) return {erreur:'Choisis la date de début.'};
  if(debut<t-D28_J) return {erreur:'Le défi ne peut pas commencer dans le passé.'};
  if(!/^[0-9a-f]{32}$/.test(String(graine||''))) return {erreur:'Graine du tirage invalide.'};
  const phases=(Array.isArray(x.phases)?x.phases:[]).map(p=>({titre:String((p&&p.titre)||'').trim().slice(0,40),du:Math.floor(Number(p&&p.du)),au:Math.floor(Number(p&&p.au))}))
    .filter(p=>p.titre);
  if(phases.length>4) return {erreur:'Quatre phases au plus.'};
  for(const p of phases) if(!(p.du>=1&&p.au>=p.du&&p.au<=D28_JOURS)) return {erreur:'La phase « '+p.titre+' » doit tenir entre J1 et J28.'};
  const tri=phases.slice().sort((a,b)=>a.du-b.du);
  for(let i=1;i<tri.length;i++) if(tri[i].du<=tri[i-1].au) return {erreur:'Les phases se chevauchent.'};
  const regles=(Array.isArray(x.regles)?x.regles:[]).map(r=>String(r||'').trim().slice(0,120)).filter(Boolean);
  if(regles.length>8) return {erreur:'Huit règles au plus.'};
  const minCheckins=Math.floor(Number(x.minCheckins));
  if(!(minCheckins>=1&&minCheckins<=D28_JOURS)) return {erreur:'Le seuil de check-ins va de 1 à 28.'};
  const gagnants=Math.floor(Number(x.gagnants));
  if(!(gagnants>=1&&gagnants<=10)) return {erreur:'De 1 à 10 gagnants.'};
  const def={titre,debut,fin:debut+D28_JOURS*D28_J-1,graine,minCheckins,gagnants,creeLe:t};
  if(tri.length) def.phases=tri;
  if(regles.length) def.regles=regles;
  const rec=String(x.recompense||'').trim().slice(0,120);
  if(rec) def.recompense=rec;
  return {def};
}
/** PURE. Le jour du défi à l'instant t : 1 à 28, 0 avant, 29 après. */
function d28Jour(def,t){
  const d=Number(def&&def.debut); if(!(d>0)) return 0;
  if(t<d) return 0;
  const j=Math.floor((t-d)/D28_J)+1;
  return j>D28_JOURS?D28_JOURS+1:j;
}
/** PURE. La phase d'un jour, ou null. */
function d28Phase(def,j){
  const l=(def&&Array.isArray(def.phases))?def.phases:Object.values((def&&def.phases)||{});
  return l.find(p=>p&&j>=p.du&&j<=p.au)||null;
}
/** PURE. La photo `quelle` (j1, j28) peut-elle se prendre à l'instant t ? */
function d28PhotoOuverte(def,quelle,t){
  const j=d28Jour(def,t);
  if(quelle==='j1') return j>=1&&j<=D28_PHOTO_FENETRE;
  if(quelle==='j28') return (j>D28_JOURS-D28_PHOTO_FENETRE&&j<=D28_JOURS)||(j===D28_JOURS+1&&t<=Number(def.fin)+D28_J);
  return false;
}
/** PURE. Les jours cochés d'un participant (1 à 28), triés. */
function d28Checkins(p){
  const c=(p&&p.checkins&&typeof p.checkins==='object')?p.checkins:{};
  return Object.keys(c).map(Number).filter(j=>j>=1&&j<=D28_JOURS&&Number(c[j])>0).sort((a,b)=>a-b);
}
/**
 * PURE. Le tableau de participation (vue coach) : une ligne par inscrit.
 * @returns {{cle, prenom, jours:boolean[], total:number, photos:{j1:string, j28:string}, eligible:boolean}[]}
 */
function d28Grille(def,participants){
  const min=Number(def&&def.minCheckins)||D28_JOURS;
  return Object.keys(participants||{}).map(cle=>{
    const p=participants[cle]||{};
    if(!p.inscription) return null;
    const faits=d28Checkins(p);
    const jours=Array.from({length:D28_JOURS},(_,i)=>faits.indexOf(i+1)>=0);
    const ph=p.photos||{};
    const etat=x=>!x?'':(x.img?'partagee':'privee');
    return {cle,prenom:String(p.inscription.prenom||'').slice(0,24)||'Athlète',jours,total:faits.length,
      photos:{j1:etat(ph.j1),j28:etat(ph.j28)},eligible:faits.length>=min};
  }).filter(Boolean).sort((a,b)=>b.total-a.total||a.prenom.localeCompare(b.prenom,'fr'));
}
/** PURE. Le ticket d'un participant : SHA-256(graine:clé). */
function d28Ticket(graine,cle){ return sha256Hex(String(graine)+':'+String(cle)); }
/**
 * PURE. LE TIRAGE : les éligibles rangés par ticket croissant, les `n`
 * premiers gagnent. Même graine, mêmes éligibles → même résultat, quel que
 * soit l'ordre d'entrée.
 * @param {string} graine
 * @param {{cle:string, prenom:string, total:number}[]} lignes
 * @param {number} minCheckins
 * @param {number} n
 */
function tirageDefi28(graine,lignes,minCheckins,n){
  const el=(lignes||[]).filter(l=>l&&l.cle&&Number(l.total)>=Number(minCheckins));
  const tickets=el.map(l=>({ticket:d28Ticket(graine,l.cle),cle:l.cle,prenom:l.prenom}))
    .sort((a,b)=>a.ticket<b.ticket?-1:a.ticket>b.ticket?1:0);
  const k=Math.max(0,Math.min(Math.floor(Number(n)||0),tickets.length));
  return {graine,eligibles:tickets.length,tickets,gagnants:tickets.slice(0,k)};
}
/** PURE. Ce que le coach publie : graine, tickets et prénoms des gagnants — aucune clé. */
function d28TiragePublic(r,t){
  return {le:t,graine:r.graine,eligibles:r.eligibles,tickets:r.tickets.map(x=>x.ticket),gagnants:r.gagnants.map(x=>String(x.prenom||'').slice(0,24))};
}
/**
 * PURE. La vérification par l'athlète : son ticket recalculé, son rang dans
 * les tickets publiés, et si la publication est bien triée et tirée de LA graine.
 */
function d28Verifier(def,tirage,cle){
  if(!def||!tirage) return {ok:false,raison:'Pas encore de tirage.'};
  if(tirage.graine!==def.graine) return {ok:false,raison:'La graine du tirage n’est pas celle publiée à la création.'};
  const l=Array.isArray(tirage.tickets)?tirage.tickets:Object.values(tirage.tickets||{});
  for(let i=1;i<l.length;i++) if(!(l[i-1]<l[i])) return {ok:false,raison:'Les tickets publiés ne sont pas dans l’ordre.'};
  const mien=d28Ticket(def.graine,cle);
  const i=l.indexOf(mien);
  const ng=(Array.isArray(tirage.gagnants)?tirage.gagnants:Object.values(tirage.gagnants||{})).length;
  return {ok:true,ticket:mien,rang:i>=0?i+1:0,total:l.length,gagne:i>=0&&i<ng};
}
/** PURE. Le texte du tampon : « J1 · 09/10/2026 14:32 · Léa ». */
function d28TexteTampon(quelle,t,prenom){
  const d=new Date(t);
  const z=x=>String(x).padStart(2,'0');
  return (quelle==='j1'?'J1':'J28')+' · '+z(d.getDate())+'/'+z(d.getMonth()+1)+'/'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes())
    +(prenom?' · '+String(prenom).slice(0,24):'');
}

// ── LA PHOTO TAMPONNÉE ───────────────────────────────────────────────────────
/** Lit l'image, la réduit, dessine le tampon. Rend {dataUrl, empreinte, at}. */
function d28Tamponner(fichier,quelle,prenom,titre){
  return new Promise((ok,ko)=>{
    const url=URL.createObjectURL(fichier);
    const im=new Image();
    im.onerror=()=>{ URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
    im.onload=()=>{
      try{
        const k=Math.min(1,D28_PHOTO_COTE/Math.max(im.width,im.height));
        const W=Math.round(im.width*k), H=Math.round(im.height*k);
        const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
        const g=cv.getContext('2d');
        g.drawImage(im,0,0,W,H);
        URL.revokeObjectURL(url);
        const at=Date.now();
        const bande=Math.max(34,Math.round(H*0.075));
        g.fillStyle='rgba(0,0,0,.72)'; g.fillRect(0,H-bande,W,bande);
        g.fillStyle=ROUGE_MARQUE; g.fillRect(0,H-bande,6,bande);
        g.fillStyle='#fff'; g.textBaseline='middle';
        g.font='700 '+Math.round(bande*0.42)+"px Montserrat,'Segoe UI',sans-serif";
        g.fillText('REPCORE · '+d28TexteTampon(quelle,at,prenom),16,H-bande/2,W-24);
        if(titre){ g.font='600 '+Math.round(bande*0.32)+"px Montserrat,'Segoe UI',sans-serif"; g.fillText(String(titre).slice(0,60),16,H-bande-bande*0.4,W-24); }
        let q=0.8, d=cv.toDataURL('image/jpeg',q);
        while(d.length>290000&&q>0.4){ q-=0.1; d=cv.toDataURL('image/jpeg',q); }
        cv.width=0; cv.height=0;
        ok({dataUrl:d,empreinte:sha256Hex(d),at});
      }catch(e){ ko(e); }
    };
    im.src=url;
  });
}

// ── LA BASE ──────────────────────────────────────────────────────────────────
async function _d28Get(chemin,q){
  const token=await CLOUD._getToken(); if(!token) return null;
  const r=await fetch(CLOUD._fbUrl.replace('users.json',chemin+'.json')+'?auth='+token+(q||''));
  return r.ok?await r.json():null;
}
const _d28Base=(coach,id)=>'canaux/'+coach+'/defis28/'+id;
let _d28Cache={};

// ══ LE COACH : CRÉER, SUIVRE, TIRER ══════════════════════════════════════════
function ouvrirCreerDefi28(){
  if(currentUser?.role!=='coach') return false;
  closeModal();
  const auj=localISODate(new Date(Date.now()+D28_J));
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="d28-h" class="dfm-feuille">'
    +'<h2 id="d28-h" style="margin-bottom:4px">Défi 28 jours</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);margin-bottom:12px;line-height:1.55">Check-in quotidien, photos J1 et J28 tamponnées, tirage au sort vérifiable entre ceux qui tiennent le rythme.</p>'
    +'<label for="d28-titre">Titre</label><input id="d28-titre" type="text" maxlength="80" placeholder="28 jours sans lâcher">'
    +'<label for="d28-debut" style="margin-top:12px">Début (fin 28 jours plus tard)</label><input id="d28-debut" type="date" value="'+auj+'" min="'+localISODate(new Date())+'">'
    +'<label for="d28-phases" style="margin-top:12px">Phases (une par ligne : titre ; du ; au)</label>'
    +'<textarea id="d28-phases" rows="3" maxlength="300" placeholder="Fondations ; 1 ; 7&#10;Volume ; 8 ; 21&#10;Final ; 22 ; 28"></textarea>'
    +'<label for="d28-regles" style="margin-top:12px">Règles (une par ligne)</label>'
    +'<textarea id="d28-regles" rows="3" maxlength="960" placeholder="Une séance ou 20 min de marche par jour"></textarea>'
    +'<div class="dfm-ligne" style="margin-top:12px"><div style="flex:1"><label for="d28-min">Check-ins pour le tirage</label><input id="d28-min" type="number" inputmode="numeric" min="1" max="28" value="24"></div>'
    +'<div style="flex:1"><label for="d28-n">Gagnants</label><input id="d28-n" type="number" inputmode="numeric" min="1" max="10" value="1"></div></div>'
    +'<label for="d28-rec" style="margin-top:12px">Récompense (optionnel)</label><input id="d28-rec" type="text" maxlength="120">'
    +'<div id="d28-err" class="arb-err" hidden></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>'
    +'<button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="enregistrerDefi28(this)">Lancer le défi</button></div>'
    +'</div></div>');
  return true;
}
/** PURE. Les phases écrites « titre ; du ; au », une par ligne. */
function d28LirePhases(texte){
  return String(texte||'').split('\n').map(l=>l.split(';').map(x=>x.trim())).filter(p=>p[0])
    .map(p=>({titre:p[0],du:Number(p[1]),au:Number(p[2])}));
}
async function enregistrerDefi28(btn){
  const g=id=>(document.getElementById(id)||{}).value||'';
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(g('d28-debut'));
  const debut=m?new Date(+m[1],+m[2]-1,+m[3],0,0,0).getTime():0;
  const r=d28Definition({titre:g('d28-titre'),debut,phases:d28LirePhases(g('d28-phases')),regles:g('d28-regles').split('\n'),
    minCheckins:g('d28-min'),gagnants:g('d28-n'),recompense:g('d28-rec')},d28NouvelleGraine());
  const err=document.getElementById('d28-err');
  if(r.erreur){ if(err){ err.textContent=r.erreur; err.hidden=false; } return false; }
  const cle=canalCle(currentUser);
  if(!cle||!CLOUD.ok()){ toast('Création impossible hors connexion.','var(--orange)'); return false; }
  if(btn) btn.disabled=true;
  const id=d28NouvelId();
  const ok=await CLOUD.racinePatch({[_d28Base(cle,id)+'/def']:r.def,['canaux/'+cle+'/defis28_liste/'+id]:r.def.debut}).catch(()=>false);
  if(btn) btn.disabled=false;
  if(!ok){ if(err){ err.textContent='Création refusée pour l’instant (règles pas encore déployées ?).'; err.hidden=false; } return false; }
  closeModal();
  toast('Défi 28 jours lancé. Graine du tirage publiée : '+r.def.graine.slice(0,8)+'…','var(--green)',5000);
  ouvrirDefis28();
  return true;
}
// ══ L'ÉCRAN, COACH ET ATHLÈTE ════════════════════════════════════════════════
function ouvrirDefis28(){
  rendreDefis28();
  go('s-defi28');
  return true;
}
async function rendreDefis28(){
  const z=document.getElementById('d28-contenu'); if(!z) return false;
  const u=currentUser; if(!u) return false;
  const coach=u.role==='coach'?canalCle(u):String(u.coachEmailKey||'');
  if(!coach){ z.innerHTML='<p class="sub">Le défi 28 jours se lance par ton coach.</p>'; return false; }
  z.innerHTML=(u.role==='coach'?'<button type="button" class="btn btn-red" style="width:100%;margin-bottom:14px" onclick="ouvrirCreerDefi28()">Créer un défi 28 jours</button>':'')
    +'<div id="d28-liste"><p class="sub">Chargement…</p></div>';
  let liste=null;
  try{ liste=await _d28Get('canaux/'+coach+'/defis28_liste'); }catch(e){ liste=null; }
  const ids=Object.keys(liste||{}).filter(id=>D28_ID_RE.test(id)).sort((a,b)=>Number(liste[b])-Number(liste[a])).slice(0,6);
  const moi=_moiCle(), t=Date.now();
  let h='';
  for(const id of ids){
    const base=_d28Base(coach,id);
    const [def,tirage]=await Promise.all([_d28Get(base+'/def').catch(()=>null),_d28Get(base+'/tirage').catch(()=>null)]);
    if(!def) continue;
    const parts=u.role==='coach'?(await _d28Get(base+'/participants').catch(()=>null)||{})
      :{[moi]:await _d28Get(base+'/participants/'+moi).catch(()=>null)};
    _d28Cache[id]={coach,def,tirage,parts};
    h+=u.role==='coach'?htmlDefi28Coach(id,def,tirage,parts,t):htmlDefi28Athlete(id,def,tirage,parts[moi],moi,t);
  }
  const zl=document.getElementById('d28-liste');
  if(zl) zl.innerHTML=h||'<p class="sub">'+(u.role==='coach'?'Aucun défi 28 jours pour l’instant.':'Ton coach n’a pas lancé de défi 28 jours.')+'</p>';
  return true;
}
/** PURE. L'en-tête d'un défi : titre, jour, phase, règles, graine. */
function htmlDefi28Tete(def,t){
  const E=escapeHtml, j=d28Jour(def,t), ph=j>=1&&j<=D28_JOURS?d28Phase(def,j):null;
  const regles=Array.isArray(def.regles)?def.regles:Object.values(def.regles||{});
  return '<div class="d28-t">'+E(def.titre)+'</div>'
    +'<div class="d28-etat">'+(j===0?'Commence le '+E(new Date(def.debut).toLocaleDateString('fr-FR')):j>D28_JOURS?'Terminé':'Jour '+j+' / '+D28_JOURS+(ph?' · '+E(ph.titre):''))+'</div>'
    +(regles.length?'<ul class="ds-regles">'+regles.map(r=>'<li>'+E(r)+'</li>').join('')+'</ul>':'')
    +'<div class="d28-graine">Tirage : '+def.gagnants+' gagnant'+(def.gagnants>1?'s':'')+' parmi ceux qui ont au moins '+def.minCheckins+' check-ins'
    +(def.recompense?' · '+E(def.recompense):'')+'. Graine publiée : <code>'+E(def.graine)+'</code></div>';
}
/** PURE. Les 28 cases. */
function htmlCases28(jours,auj){
  return '<div class="d28-cases" role="img" aria-label="'+jours.filter(Boolean).length+' check-ins sur 28">'
    +jours.map((x,i)=>'<span class="'+(x?'on':'')+(i+1===auj?' auj':'')+'"></span>').join('')+'</div>';
}
function htmlDefi28Coach(id,def,tirage,parts,t){
  const E=escapeHtml, gr=d28Grille(def,parts), j=d28Jour(def,t);
  let h='<div class="d28-carte">'+htmlDefi28Tete(def,t)
    +'<div class="ds-lab">Participation · '+gr.length+' inscrit'+(gr.length>1?'s':'')+'</div>';
  h+=gr.length?'<div class="d28-grille">'+gr.map(l=>'<div class="d28-ligne'+(l.eligible?' elig':'')+'"><span class="d28-p">'+E(l.prenom)+'</span>'
    +htmlCases28(l.jours,j)+'<span class="d28-n">'+l.total+'</span>'
    +'<span class="d28-ph">'+(l.photos.j1==='partagee'?'J1':'')+(l.photos.j28==='partagee'?' J28':'')+'</span></div>').join('')+'</div>'
    :'<p class="sub">Personne encore.</p>';
  if(tirage) h+=htmlTirage28(tirage);
  else if(t>Number(def.fin)) h+='<button type="button" class="btn btn-red" style="width:100%;margin-top:10px" onclick="tirerDefi28('+jsArg(id)+',this)">Faire le tirage</button>';
  return h+'</div>';
}
/** PURE. Le résultat publié. */
function htmlTirage28(tirage,verif){
  const E=escapeHtml;
  const g=Array.isArray(tirage.gagnants)?tirage.gagnants:Object.values(tirage.gagnants||{});
  return '<div class="d28-tirage"><div class="ds-lab">Tirage du '+E(new Date(tirage.le).toLocaleDateString('fr-FR'))+'</div>'
    +(g.length?'<div class="d28-g">'+g.map((p,i)=>(i+1)+'. '+E(p)).join(' · ')+'</div>':'<p class="sub">Aucun éligible.</p>')
    +'<p class="sub">'+tirage.eligibles+' éligible'+(tirage.eligibles>1?'s':'')+'. Chaque ticket = SHA-256(graine:clé), rangés par ordre croissant.</p>'
    +(verif?(verif.ok?'<p class="d28-verif">Ton ticket <code>'+E(verif.ticket.slice(0,12))+'…</code> '+(verif.rang?'est '+verif.rang+'e sur '+verif.total+(verif.gagne?' : gagnant':''):'n’est pas dans le tirage (moins de check-ins que le seuil)')+'. Vérifié.</p>'
      :'<p class="d28-verif ko">'+E(verif.raison)+'</p>'):'')
    +'</div>';
}
async function tirerDefi28(id,btn){
  const c=_d28Cache[id]; if(!c||currentUser?.role!=='coach') return false;
  if(btn) btn.disabled=true;
  const r=tirageDefi28(c.def.graine,d28Grille(c.def,c.parts),c.def.minCheckins,c.def.gagnants);
  const pub=d28TiragePublic(r,Date.now());
  const ok=await CLOUD.racinePatch({[_d28Base(c.coach,id)+'/tirage']:pub}).catch(()=>false);
  if(btn) btn.disabled=false;
  toast(ok?'Tirage publié.':'Tirage refusé (déjà fait, ou défi pas terminé).',ok?'var(--green)':'var(--orange)');
  if(ok) rendreDefis28();
  return ok;
}
function htmlDefi28Athlete(id,def,tirage,p,moi,t){
  const j=d28Jour(def,t), ins=!!(p&&p.inscription), faits=d28Checkins(p);
  const jours=Array.from({length:D28_JOURS},(_,i)=>faits.indexOf(i+1)>=0);
  let h='<div class="d28-carte">'+htmlDefi28Tete(def,t);
  if(!ins){
    if(j<=D28_JOURS) h+='<button type="button" class="btn btn-red" style="width:100%" onclick="rejoindreDefi28('+jsArg(id)+',this)">Je participe</button>';
    return h+(tirage?htmlTirage28(tirage):'')+'</div>';
  }
  h+=htmlCases28(jours,j)+'<div class="d28-etat">'+faits.length+' check-in'+(faits.length>1?'s':'')+' sur '+def.minCheckins+' pour le tirage</div>';
  if(j>=1&&j<=D28_JOURS&&!jours[j-1]) h+='<button type="button" class="btn btn-red" style="width:100%;margin-top:8px" onclick="checkinDefi28('+jsArg(id)+',this)">Check-in du jour '+j+'</button>';
  const ph=(p&&p.photos)||{};
  for(const q of ['j1','j28']){
    const x=ph[q], lib=q==='j1'?'Photo J1':'Photo J28';
    if(x) h+='<div class="d28-photo"><span>'+lib+' tamponnée le '+escapeHtml(new Date(x.at).toLocaleDateString('fr-FR'))+(x.consentement?' · partagée avec ton coach':' · gardée sur ton téléphone')+'</span>'
      +'<button type="button" class="rb-lien" onclick="retirerPhotoDefi28('+jsArg(id)+','+jsArg(q)+')">Retirer</button></div>';
    else if(d28PhotoOuverte(def,q,t)) h+='<div class="d28-photo"><label class="d28-consent"><input type="checkbox" id="d28-c-'+id+'-'+q+'"> Je partage cette photo avec mon coach</label>'
      +'<label class="btn btn-outline btn-sm" style="display:block;text-align:center">'+lib+'<input type="file" accept="image/*" capture="user" hidden data-id="'+id+'" data-q="'+q+'" onchange="photoDefi28(this)"></label>'
      +'<p class="sub" style="font-size:var(--fs-xs)">La date et l’heure sont dessinées dans la photo par l’app ; une photo posée ne se remplace pas. Sans la case, seule son empreinte part.</p></div>';
  }
  if(tirage) h+=htmlTirage28(tirage,d28Verifier(def,tirage,moi));
  return h+'</div>';
}
async function rejoindreDefi28(id,btn){
  const c=_d28Cache[id], u=currentUser; if(!c||!u) return false;
  if(btn) btn.disabled=true;
  const ok=await CLOUD.racinePatch({[_d28Base(c.coach,id)+'/participants/'+_moiCle()+'/inscription']:{le:Date.now(),prenom:String(u.fname||'').trim().slice(0,24)||'Athlète'}}).catch(()=>false);
  if(btn) btn.disabled=false;
  toast(ok?'Inscrit. Un check-in par jour !':'Inscription impossible pour l’instant.',ok?'var(--green)':'var(--orange)');
  if(ok) rendreDefis28();
  return ok;
}
async function checkinDefi28(id,btn){
  const c=_d28Cache[id]; if(!c) return false;
  const t=Date.now(), j=d28Jour(c.def,t);
  if(!(j>=1&&j<=D28_JOURS)) return false;
  if(btn) btn.disabled=true;
  const ok=await CLOUD.racinePatch({[_d28Base(c.coach,id)+'/participants/'+_moiCle()+'/checkins/'+j]:t}).catch(()=>false);
  if(btn) btn.disabled=false;
  toast(ok?'Check-in du jour '+j+' '+ICO.coche:'Check-in impossible pour l’instant.',ok?'var(--green)':'var(--orange)');
  if(ok) rendreDefis28();
  return ok;
}
async function photoDefi28(input){
  const id=String(input&&input.dataset&&input.dataset.id||''), q=String(input&&input.dataset&&input.dataset.q||'');
  const fl=input&&input.files&&input.files[0];
  try{ if(input) input.value=''; }catch(e){}
  const c=_d28Cache[id]; if(!fl||!c||!d28PhotoOuverte(c.def,q,Date.now())) return false;
  const consent=!!(document.getElementById('d28-c-'+id+'-'+q)||{}).checked;
  let r;
  try{ r=await d28Tamponner(fl,q,String(currentUser.fname||'').slice(0,24),c.def.titre); }
  catch(e){ toast('Photo illisible.','var(--orange)'); return false; }
  const entree={at:r.at,empreinte:r.empreinte,consentement:consent};
  if(consent) entree.img=r.dataUrl;
  const ok=await CLOUD.racinePatch({[_d28Base(c.coach,id)+'/participants/'+_moiCle()+'/photos/'+q]:entree}).catch(()=>false);
  if(!ok){ toast('Photo non enregistrée (déjà posée, ou hors connexion).','var(--orange)'); return false; }
  // Sans partage, la photo tamponnée reste à l'athlète : on la lui donne.
  if(!consent){ try{ const a=document.createElement('a'); a.href=r.dataUrl; a.download='repcore-defi28-'+q+'.jpg'; a.click(); }catch(e){} }
  toast(consent?'Photo tamponnée et partagée avec ton coach.':'Photo tamponnée, gardée sur ton téléphone.','var(--green)',4000);
  rendreDefis28();
  return true;
}
async function retirerPhotoDefi28(id,q){
  const c=_d28Cache[id]; if(!c) return false;
  const ok=await CLOUD.racinePatch({[_d28Base(c.coach,id)+'/participants/'+_moiCle()+'/photos/'+q]:null}).catch(()=>false);
  toast(ok?'Photo retirée.':'Retrait impossible pour l’instant.',ok?'var(--green)':'var(--orange)');
  if(ok) rendreDefis28();
  return ok;
}
