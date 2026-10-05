// ══════ N3.4 — UN TABLEAU A TROU REVIENT DE FIREBASE EN OBJET ═════════════
// Firebase RTDB rend `sessions_config` sous la forme {0:…,3:…} des qu'un
// creneau manque. Toute methode de tableau LEVE alors — et dans une fonction
// async, le rejet n'est capte par personne : le panneau nutrition du coach
// restait vide sans un mot, « Programmer une decharge » ne faisait rien, le
// bandeau « Non publie » disparaissait.
// Vingt-deux sites appelaient une methode de tableau directement sur ce champ.
// Les garder un par un, c'etait accepter que le vingt-troisieme, ecrit demain,
// retombe dans le meme trou.
//
// LA REMISE A PLAT SE FAIT DONC A L'ENTREE : la ou un dossier entre dans
// l'application — la lecture du stockage local et la fusion d'un dossier
// distant — et plus aucun lecteur n'a a se garder lui-meme.
//
// LES CLEFS NUMERIQUES REPRENNENT LEUR RANG. `{0:…,3:…}` redonne le lundi et
// le jeudi, pas les deux premiers jours : le jour est porte par la POSITION
// dans toute l'app, et tasser les trous decalerait tout le programme d'un
// athlete sans que rien ne le dise. C'est exactement la semantique de
// _normaliserSessionsConfig, qui delegue desormais ici pour qu'il n'y ait
// qu'une seule definition de ce que « remettre a plat » veut dire.
//
// CETTE FONCTION NE FAIT QUE LA STRUCTURE. Elle ne cree pas les sept jours,
// n'assainit aucun exercice et ne signale rien : elle est appelee sur chaque
// dossier a chaque lecture du stockage, et doit rester de l'ordre du test de
// type. Le reste est le travail de _normaliserSessionsConfig, appele la ou on
// s'apprete a ECRIRE.
// PURE-ISH. Remet a plat UN champ rendu par Firebase sous forme d'objet.
//
// FIREBASE NE STOCKE PAS DE TABLEAUX. Il rend un tableau quand les clefs sont
// 0,1,2… sans trou, et un OBJET des qu'il en manque une : {0:…,3:…}. Un objet
// est vrai, il n'a pas de .map, et il n'est pas iterable — donc `[...x]` leve
// une TypeError. Dans une methode async dont personne n'attend le resultat,
// cette exception devient un rejet non capture : l'ecriture qui suit n'est
// jamais atteinte, et la synchronisation s'arrete SANS LE MOINDRE MESSAGE.
//
// LE PLAFOND EST PASSE EN PARAMETRE parce qu'il n'a pas le meme sens partout :
// soixante-quatre pour des creneaux, mais un athlete peut porter des centaines
// de seances. Un plafond trop bas ne protegerait de rien — il TRONQUERAIT
// l'historique, en silence, ce qui est pire que l'exception qu'on corrige.
function _aplatirChamp(u,champ,max,garderTrous){
  if(!u||typeof u!=='object') return u;
  const v=u[champ];
  if(v&&!Array.isArray(v)&&typeof v==='object'){
    const plafond=(typeof max==='number')?max:100000;
    const t=[];
    for(const k of Object.keys(v)){
      const i=parseInt(k,10);
      if(Number.isInteger(i)&&i>=0&&i<plafond) t[i]=v[k];
    }
    // GARDER LES TROUS OU LES RETIRER : c'est une propriete de la DONNEE, pas
    // de son nom. Quand l'indice porte un sens — le jour de la semaine, pour un
    // creneau comme pour une seance de modele — un trou est le mardi vide, et
    // le tasser decalerait le mercredi sur le mardi. Quand il n'en porte pas —
    // bilans, seances — un `undefined` au milieu de la liste n'est pas un
    // bilan, et les lecteurs en aval ne le reconnaissent pas.
    //
    // C'ETAIT DEDUIT DU NOM DU CHAMP. Trois champs gardent desormais leurs
    // trous, et deduire d'un nom ce qui est une propriete de la donnee finit
    // toujours par se tromper de champ.
    u[champ]=garderTrous?t:t.filter(x=>x!==undefined);
  }
  return u;
}
// Le creneau hebdomadaire : sept cases, l'indice EST le jour. Le plafond a 64
// est large a dessein — il ecarte une clef aberrante sans jamais tronquer.
//
// ⚠ ET LES EXERCICES DE CHAQUE CRENEAU, depuis le build 1415. Firebase ne
//   stocke pas de tableaux : `exercises: []` revient en OBJET VIDE, et un objet
//   n'a pas de .map. Mesure au banc a deux appareils, en ouvrant « Séances » de
//   l'athlete chez le coach apres un aller-retour reel :
//       Ouverture des séances impossible — (s.exercises || []).map is not a
//       function
//   Le `|| []` ne protege de rien : un objet vide est VRAI. L'ecran de
//   l'athlete, lui, s'en sortait — _normaliserSessionsConfig repare les
//   exercices avant d'ecrire — mais le coach n'a pas ce passage, et il lit le
//   dossier de quelqu'un d'autre.
//
//   LA REPARATION EST DONC ICI, a la porte par ou tout dossier venu du reseau
//   entre : les deux ecrans en profitent, et le prochain lecteur aussi. Le
//   plafond a 400 : un creneau tres charge en porte quelques dizaines, jamais
//   des centaines — et tronquer en silence serait pire que l'exception.
//   L'indice d'un exercice ne porte aucun sens : les trous se tassent.
function _aplatirSessionsConfig(u){
  const r=_aplatirChamp(u,'sessions_config',64,true);
  const l=u&&u.sessions_config;
  if(Array.isArray(l)) for(const s of l){
    if(s&&typeof s==='object') _aplatirChamp(s,'exercises',400,false);
  }
  return r;
}
// LA LISTE DES CRENEAUX, aplatie, toujours un tableau.
// ⚠ _aplatirSessionsConfig APLATIT EN PLACE ET REND LE DOSSIER, pas la liste.
//   Trois appelants la lisaient comme si elle rendait les creneaux —
//   `cfg=_aplatirSessionsConfig(c)||[]` puis cfg.map / cfg.forEach : sur un
//   dossier, TypeError. Les gestes du bloc prioritaire (reordonner, retrouver
//   les exercices d'un muscle) tombaient donc a chaque appel. Releve le
//   21/09/2026 en branchant l'attribution des muscles sur la meme ligne.
function _creneauxDe(u){
  try{ _aplatirSessionsConfig(u); }catch(e){}
  const v=u&&u.sessions_config;
  return Array.isArray(v)?v:[];
}
// ══════ LES MODELES DE PROGRAMME DU COACH ══════════════════════════════
//
// MEME PIEGE, ET C'EST CELUI QUI COUTE LE PLUS CHER. Un modele porte deux jeux
// de sept seances, sessions_H et sessions_F. Firebase les rend en OBJET des
// qu'un jour est vide — un modele sans seance le mercredi suffit. _cptSeances
// repondait alors `p[cle]=[]` : elle ne reconstruisait pas, elle REMPLACAIT
// par un tableau vide. Et comme elle mute le modele lui-meme, le premier clic
// sur Sauvegarder gravait la perte. Le coach retrouvait un modele de sept
// jours vides, sans un mot, et son travail de plusieurs heures avec.
//
// L'INDICE EST LE JOUR : les trous se gardent, comme pour sessions_config.
function _aplatirModeles(u){
  const l=u&&u.coachPrograms;
  if(!Array.isArray(l)) return u;
  for(const p of l){
    if(!p||typeof p!=='object') continue;
    _aplatirChamp(p,'sessions_H',64,true);
    _aplatirChamp(p,'sessions_F',64,true);
  }
  return u;
}
// LES TROIS PORTES D'UN DOSSIER. Elles sont nommees ici, une fois, pour que
// chaque endroit qui fait entrer un dossier venu du reseau les traite toutes —
// et pour qu'en ajouter une quatrieme demain soit un geste, pas un oubli.
function _aplatirDossier(u){
  _aplatirSessionsConfig(u);
  _aplatirChamp(u,'bilans');
  _aplatirChamp(u,'sessions');
  // Les modeles ne vivent que dans le dossier du COACH, mais la porte est la
  // meme pour tout le monde : la fonction sort d'elle-meme sur un dossier qui
  // n'en porte pas.
  _aplatirModeles(u);
  return u;
}
function _aplatirTousSessionsConfig(m){
  if(!m||typeof m!=='object') return m;
  for(const k in m) _aplatirDossier(m[k]);
  return m;
}
// PURE (sur `dossier`). Reinjecte dans `dossier.sessions` les seances de
// `session` (par id) qu'il ne porte pas — sauf celles qu'une pierre tombale
// designe : une seance supprimee ne ressuscite pas. Rend le nombre ajoute.
function reinjecterSeancesSession(dossier,session){
  if(!dossier||!session||!Array.isArray(session.sessions)) return 0;
  if(!Array.isArray(dossier.sessions)) dossier.sessions=[];
  const ids=new Set(dossier.sessions.map(x=>x&&x.id!=null?String(x.id):'').filter(Boolean));
  const morts=(dossier.supprimes&&dossier.supprimes.sessions)||{};
  let n=0;
  for(const x of session.sessions){
    if(!x||x.id==null) continue;
    const id=String(x.id);
    if(ids.has(id)||morts[id]) continue;
    dossier.sessions.push(x); ids.add(id); n++;
  }
  if(n) dossier.sessions.sort((a,b)=>(Number(a&&a.date)||0)-(Number(b&&b.date)||0));
  return n;
}
// Trois 412 de suite sur le meme dossier : l'envoi repart par la file de relance.
// Une base non servie depuis trente jours est la premiere a partir, stockage plein.
const SYNC_BASE_INUTILE_MS=30*864e5;
// La file d'envoi : cinq cents dossiers au plus (un coach et ses athletes).
const CLOUD_FILE_MAX=500;
const CLOUD_CONFLITS_MAX=3;
const DB={
  // N3.4 — LES DEUX CLEFS QUI PORTENT DES DOSSIERS SONT REMISES A PLAT ICI.
  // `users` est la carte de tous les dossiers, `session` est le dossier
  // courant : ce sont les deux seules portes par lesquelles un sessions_config
  // venu de Firebase entre dans le code qui le lit.
  //
  // ══ LE CACHE MEMOIRE (build 1764) ══════════════════════════════════════
  // POURQUOI. get('users') faisait JSON.parse PUIS l'aplatissement a CHAQUE
  // appel — 216 appels dans rc-core, dont 212 sur 'users' — pour 3 Mo de
  // dossiers chez un coach : ~60 ms l'appel a CPU x4, et un rendu en enchaine
  // plusieurs.
  //
  // CE QUI EST GARDE : _memo, clef -> {brut, val}. `brut` est la chaine RENDUE
  // PAR localStorage.getItem, et c'est elle qu'on compare (===) a celle du
  // prochain getItem : Chrome rend la MEME chaine tant que la valeur n'a pas
  // change, et la comparaison est alors immediate (0,04 ms contre 6,5 ms pour
  // deux chaines de 3 Mo distinctes). Une ecriture DIRECTE —
  // un setItem direct de la clef, hors de DB, un autre onglet — change la
  // chaine : le cache rate, et on relit. Il ne peut donc pas servir une valeur
  // perimee, meme sans passer par setLocal.
  // `val` est la valeur DEJA APLATIE. On ne la rend JAMAIS : les appelants
  // modifient ce qu'ils lisent (users[email]=…, puis DB.set).
  //
  // LA COPIE, MESUREE (rc_users synthetique de 2,3 Mo, CPU x4, Chromium 141) :
  //   JSON.parse ~74-103 ms · structuredClone ~243 ms · _dbCopie ~39 ms.
  // structuredClone coute ~3x le parse : il est ecarte (la consigne : pas plus
  // de 30 % du parse). _dbCopie, la copie d'un arbre JSON, coute ~40 % du parse.
  // Pour 'users', la copie est en plus PARESSEUSE, dossier par dossier
  // (_dbCopieUsers) : get('users')[email] ne copie qu'un dossier sur cinquante.
  //
  // CE QUI A ETE GAGNE, mesure (scripts/verif/banc-db.mjs, rc_users synthetique
  // de 2,87 Mo — 52 dossiers de 60 seances —, CPU x4, trois passages) :
  //                                         avant (1763)   apres (1764)
  //   10 x DB.get('users')                  587-661 ms     < 1 ms
  //   10 x DB.get('users')[un dossier]      446-761 ms     8-18 ms
  //   10 x Object.values(DB.get('users'))…  390-745 ms     315-532 ms
  // La derniere ligne lit TOUS les dossiers : chacun est copie, et le gain se
  // borne a l'aplatissement evite (la copie coute ~40 % du parse, mais
  // Object.values passe par les accesseurs) — de 1,2 a 1,4x selon le passage.
  //
  // CE QUI N'A PAS CHANGE : la synchronisation (CLOUD.*) ne voit rien de ce
  // cache ; set/setLocal ecrivent comme avant. Apres un quota plein, le
  // stockage n'a pas change : le cache rend l'ANCIENNE copie, comme le
  // JSON.parse d'avant (CLOUD._doPush s'appuie sur _echecLocal pour ce cas).
  _memo:new Map(),
  _perfMs:0,
  get(k){
    const t0=DB_PERF?performance.now():0;
    try{
      let brut;
      try{ brut=localStorage.getItem('rc_'+k); }catch(e){ return null; }
      if(brut==null){ this._memo.delete(k); return null; }
      const m=this._memo.get(k);
      if(m&&m.brut===brut) return k==='users'?_dbCopieUsers(m.val):_dbCopie(m.val);
      let v=null;
      try{ v=JSON.parse(brut); }catch(e){ this._memo.delete(k); return null; }
      try{
        if(k==='users') _aplatirTousSessionsConfig(v);
        else if(k==='session') _aplatirSessionsConfig(v);
      }catch(e){}
      // Un scalaire n'a rien a proteger : il est rendu tel quel, sans cache.
      if(v===null||typeof v!=='object') return v;
      this._memo.set(k,{brut,val:v});
      return k==='users'?_dbCopieUsers(v):_dbCopie(v);
    }finally{ if(DB_PERF) this._perfMs+=performance.now()-t0; }
  },
  // Le quota local ne doit pas empêcher l'envoi au cloud : l'ancien `return`
  // dans le catch sautait CLOUD.push, donc un stockage saturé faisait perdre
  // la donnée des DEUX côtés. On avertit, et on pousse quand même.
  set(k,v){
    const localOk=this.setLocal(k,v);
    if(k==='users') CLOUD.push(v);
    return localOk;
  },
  // ECRIT SANS POUSSER. Meme gestion du quota, sans l'effet de bord — c'est
  // `set` qui decide de pousser, et lui seul. Sert a CLOUD.pushOne, qui doit
  // reparer l'horodatage d'un dossier DEJA en cours d'envoi : passer par `set`
  // y programmerait un envoi COMPLET de tous les dossiers a chaque ecriture du
  // coach.
  //
  // ⚠ L'ECHEC EST MEMORISE (_echecLocal), CLEF PAR CLEF, et c'est ce qui
  //   empeche la perte (30/09/2026). Apres un quota plein, DB.get('users')
  //   rend l'ANCIENNE copie : CLOUD._doPush, qui la relit, poussait donc le
  //   dossier d'avant la seance — la seance ne partait jamais, pendant qu'un
  //   toast disait « envoyees au cloud ». _doPush lit ce drapeau et pousse
  //   alors le dossier en memoire.
  // ⚠ ET ON NE DIT PLUS « ENVOYE » AVANT QUE CE SOIT VRAI. Le message du quota
  //   dit ce qui est vrai a cet instant — c'est en memoire, et nulle part
  //   ailleurs. Le « ✓ envoye » vient de _doPushOne, apres un PUT reussi.
  //   `silencieux` : pour les reecritures d'integration, qui suivent un envoi
  //   deja annonce.
  _echecLocal:{},
  _quotaAnnonce:false,
  setLocal(k,v,silencieux){
    let localOk=true;
    try{
      localStorage.setItem('rc_'+k,JSON.stringify(v));
    }catch(e){
      if(e.name==='QuotaExceededError'||e.code===22){
        localOk=false;
        if(k==='users'||k==='session') this._quotaAnnonce=true;
        if(!silencieux) toast('Stockage plein : séance gardée en mémoire, NE FERME PAS l’app avant le '+ICO.coche,'var(--orange)');
      } else throw e;
    }
    // Le cache : oublie apres une ecriture reussie (le prochain get relit et
    // repart du nouveau texte). Apres un echec, le stockage n'a pas bouge, et
    // ce que garde le cache est toujours exact.
    if(localOk) this._memo.delete(k);
    this._echecLocal[k]=!localOk;
    return localOk;
  },
  del(k){ this._memo.delete(k); localStorage.removeItem('rc_'+k); },
};
// ?perf=1 : chaque seconde, le temps passe dans DB.get pendant cette seconde.
const DB_PERF=(()=>{ try{ return new URLSearchParams(location.search).get('perf')==='1'; }catch(e){ return false; } })();
if(DB_PERF) setInterval(()=>{
  if(DB._perfMs>0) console.log('[perf] DB.get : '+DB._perfMs.toFixed(1)+' ms dans la derniere seconde');
  DB._perfMs=0;
},1000);
// UN AUTRE ONGLET a ecrit : sa clef est oubliee (clear() : key null, tout).
// Par prudence seulement — la comparaison du texte brut le verrait aussi.
try{
  window.addEventListener('storage',(e)=>{
    if(e.key==null) DB._memo.clear();
    else if(e.key.startsWith('rc_')) DB._memo.delete(e.key.slice(3));
  });
}catch(e){}
// LA COPIE PROFONDE D'UN ARBRE JSON (objets, tableaux, scalaires) — ce que
// rend JSON.parse, aplati. Les TROUS d'un tableau sont gardes : sessions_config
// et sessions_H/F en portent a dessein (l'indice y est le jour de la semaine,
// _aplatirChamp), et un `undefined` ecrit a leur place changerait `i in t`.
function _dbCopie(x){
  if(x===null||typeof x!=='object') return x;
  if(Array.isArray(x)){
    const n=x.length,o=new Array(n);
    for(let i=0;i<n;i++) if(i in x) o[i]=_dbCopie(x[i]);
    return o;
  }
  const o={};
  for(const c in x) o[c]=_dbCopie(x[c]);
  return o;
}
// LA CARTE DES DOSSIERS, COPIEE DOSSIER PAR DOSSIER, A LA DEMANDE. Chaque
// clef est un accesseur qui, a la premiere lecture, copie son dossier
// (_dbCopie) et se remplace par une propriete ordinaire. Une ecriture
// (users[email]=…) la remplace aussi, sans copier. Pour l'appelant, c'est une
// copie profonde : chaque objet qu'il atteint est neuf, et rien de ce qu'il
// modifie n'atteint le cache. Object.keys, for…in, `in`, delete,
// JSON.stringify et Object.values se comportent comme sur l'objet d'avant
// (les deux derniers lisent tout, donc copient tout).
function _dbCopieUsers(m){
  if(!m||typeof m!=='object'||Array.isArray(m)) return _dbCopie(m);
  const o={};
  for(const c in m){
    Object.defineProperty(o,c,{enumerable:true,configurable:true,
      get(){ const v=_dbCopie(m[c]); Object.defineProperty(this,c,{value:v,writable:true,enumerable:true,configurable:true}); return v; },
      set(v){ Object.defineProperty(this,c,{value:v,writable:true,enumerable:true,configurable:true}); }});
  }
  return o;
}
// ══════ N3.7 — MARQUER UNE ENTREE COMME SUPPRIMEE ═════════════════════════
// TOUTE suppression d'une seance ou d'un bilan doit passer par ici, sinon
// l'union de CLOUD._mergeUser la ressuscitera a la prochaine descente sur
// chacun des appareils de l'athlete.
// Elle ne retire RIEN elle-meme : elle pose la pierre tombale, et l'appelant
// retire l'entree du tableau. Deux gestes distincts parce que l'ordre importe
// — la pierre doit exister dans le dossier qui part, meme si le retrait
// echoue.
const SUPPRESSIONS_MAX=200;
function marquerSupprime(user,type,cle){
  if(!user||typeof user!=='object') return false;
  // `videos` depuis que _mergeUser les unit : sans pierre tombale, une video
  // supprimee sur un telephone ressusciterait sur l'autre a la descente
  // suivante — exactement ce que ce mecanisme existe pour empecher.
  if(type!=='sessions'&&type!=='bilans'&&type!=='videos') return false;
  const k=String(cle||'');
  if(!k) return false;
  if(!user.supprimes||typeof user.supprimes!=='object') user.supprimes={};
  if(!user.supprimes[type]||typeof user.supprimes[type]!=='object') user.supprimes[type]={};
  const m=user.supprimes[type];
  m[k]=Date.now();
  // BORNEE, et les plus ANCIENNES sortent : une entree supprimee il y a deux
  // ans a eu le temps de disparaitre de tous les appareils.
  const clefs=Object.keys(m);
  if(clefs.length>SUPPRESSIONS_MAX){
    clefs.sort((a,b)=>(m[a]||0)-(m[b]||0));
    for(const vieux of clefs.slice(0,clefs.length-SUPPRESSIONS_MAX)) delete m[vieux];
  }
  return true;
}
// La MEME clef que celle de l'union, pour que la pierre recouvre la bonne
// tombe. Exposee parce que l'appelant doit la calculer avant de retirer.
function cleSuppressionBilan(b){ return b?String(b.date)+'|'+String(b.type||''):''; }
function cleSuppressionSeance(s){ return s?String(s.id):''; }
// ── Validation des paquets URL (coachpkg / athletepkg) ─────────────────────
// SÉCURITÉ — Ces paquets JSON-base64 ne sont PAS signés : n'importe qui peut en
// forger un. Ce mécanisme ne doit JAMAIS écraser des champs sensibles d'un compte
// existant (status, paymentStatus, paypalSubscriptionId, coachId) sans passage
// par un flux de validation explicite par l'utilisateur. Les fonctions ci-dessous
// extraient uniquement les champs attendus et vérifient type, longueur et email
// avant tout Object.assign / DB.set.
// ── Caches photo : écriture et purge ────────────────────────────────────────
// Point d'écriture unique pour les copies photo hors ligne. Trois des cinq
// sites avalaient l'échec en silence : la photo disparaissait au rechargement
// suivant, derrière un « ✓ » vert.
function _setPhotoLS(key,val){
  try{ localStorage.setItem(key,val); return true; }
  catch(e){
    if(e.name==='QuotaExceededError'||e.code===22){
      toast('Stockage plein : les photos les plus anciennes ne sont plus conservées hors ligne.','var(--orange)');
    }
    return false;
  }
}
// Les clés rc_photo_<date>_<champ> s'accumulaient sans limite : chaque bilan y
// dépose jusqu'à trois photos et rien ne les retirait jamais. Sur un compte
// suivi depuis un an, c'est précisément ce qui remplit le quota et fait
// échouer l'enregistrement du bilan en cours.
// On garde les trois derniers bilans DE CHAQUE utilisateur présent sur
// l'appareil : ces clés ne portent que la date, pas l'identité de l'athlète —
// sur le téléphone d'un coach, purger d'après les seuls bilans de currentUser
// effacerait les photos de tous ses élèves.
const _PHOTO_BILANS_GARDES=3;
function purgerPhotosAnciennes(){
  const dates=new Set();
  try{
    const users=DB.get('users')||{};
    Object.values(users).forEach(u=>{
      (u?.bilans||[]).map(b=>b&&b.date).filter(Boolean)
        .sort((a,b)=>b-a).slice(0,_PHOTO_BILANS_GARDES)
        .forEach(d=>dates.add(String(d)));
    });
  }catch(e){ return 0; }
  // Aucun bilan connu localement — dossier pas encore synchronisé, par exemple.
  // On ne sait pas ce qui est encore utile : supprimer serait pire que garder.
  if(!dates.size) return 0;
  let supprimes=0;
  try{
    Object.keys(localStorage).filter(k=>k.startsWith('rc_photo_')).forEach(k=>{
      const m=k.match(/^rc_photo_(\d+)_/);
      if(!m) return;               // format inattendu : ne pas y toucher
      if(dates.has(m[1])) return;  // bilan récent : on garde
      localStorage.removeItem(k);supprimes++;
    });
  }catch(e){}
  return supprimes;
}

const _PKG_EMAIL_RE=/^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,64}$/;
function _validateCoachPkg(o){
  if(typeof o!=='object'||o===null||o.role!=='coach') return null;
  if(typeof o.id!=='string'||!o.id||o.id.length>100) return null;
  if(typeof o.email!=='string'||!_PKG_EMAIL_RE.test(o.email)||o.email.length>200) return null;
  return {
    id:o.id.slice(0,100),
    fname:typeof o.fname==='string'?o.fname.slice(0,100):'',
    lname:typeof o.lname==='string'?o.lname.slice(0,100):'',
    email:o.email.toLowerCase().slice(0,200),
    code:typeof o.code==='string'?o.code.slice(0,30):null,
    role:'coach'
  };
}
// ⚠ CE PAQUET N'EST PAS UNE REPONSE DE PORTABILITE. NE PAS L'UTILISER POUR CA.
//
// Il retient DOUZE champs sur les quelque quatre-vingt-dix que porte un
// dossier : ni constantes, ni analyses, ni cycle, ni grossesse, ni PES, ni
// traitement, ni etats de sante, ni statut hormonal, ni sommeil, ni pesees,
// ni programmes. C'est un TRANSFERT FONCTIONNEL d'un appareil a un autre,
// concu pour redemarrer vite — pas un export.
//
// Le RGPD art. 15 (acces) et art. 20 (portabilite) exigent l'INTEGRALITE des
// donnees traitees, y compris celles du noeud sante_privee. Repondre a une
// demande avec ce paquet serait une reponse INCOMPLETE, donc un manquement.
// L'export complet est le lot F-10, et il vient APRES.
function _validateAthletePkg(o){
  if(typeof o!=='object'||o===null||o.role!=='athlete') return null;
  if(typeof o.id!=='string'||!o.id||o.id.length>100) return null;
  if(typeof o.email!=='string'||!_PKG_EMAIL_RE.test(o.email)||o.email.length>200) return null;
  return {
    id:o.id.slice(0,100),
    fname:typeof o.fname==='string'?o.fname.slice(0,100):'',
    lname:typeof o.lname==='string'?o.lname.slice(0,100):'',
    email:o.email.toLowerCase().slice(0,200),
    role:'athlete',
    gender:typeof o.gender==='string'?o.gender.slice(0,20):'',
    bilans:Array.isArray(o.bilans)?o.bilans:[],
    sessions:Array.isArray(o.sessions)?o.sessions:[],
    nutrition:(o.nutrition&&typeof o.nutrition==='object'&&!Array.isArray(o.nutrition))?o.nutrition:{},
    videos:Array.isArray(o.videos)?o.videos:[],
    streak:typeof o.streak==='number'&&isFinite(o.streak)?Math.max(0,Math.floor(o.streak)):0,
    lastSession:typeof o.lastSession==='number'&&isFinite(o.lastSession)?o.lastSession:null
  };
}
// ── Import depuis URL (coachpkg ou athletepkg) ──
// ?role=coach (02/10/2026) : l'intention du coach venu de coachs.html, gardée
// pour rcRoleRoute et rcRolePreselection (006). Toute autre valeur : rien.
function rcRoleDepuisParams(params){
  if(!params||params.get('role')!=='coach') return false;
  try{ localStorage.setItem('rc_role_voulu',JSON.stringify({role:'coach',le:Date.now()})); }catch(e){ return false; }
  return true;
}
(function importFromURL(){
  // Le nettoyage de l'adresse est décidé AVANT tout décodage, et exécuté dans un
  // `finally` : un paquet malformé jetait auparavant avant d'atteindre le
  // replaceState, et restait donc dans la barre d'adresse, prêt à repartir à
  // chaque rechargement.
  let aNettoyer=false;
  let _coachRetenu=null;
  try{
    const params=new URLSearchParams(window.location.search);
    aNettoyer=!!(params.get('coachpkg')||params.get('athletepkg')||params.get('s')
      ||params.get('bilan')==='1'||params.get('wo')==='1'||params.get('diete')==='1'
      ||!!params.get('wrapped')||params.get('canal')==='1'||!!params.get('ref')||params.get('parrainage')==='1'
      ||!!params.get('coach')||!!params.get('src')||!!params.get('amb')||params.get('paiements')==='1'
      ||!!params.get('duel')||params.get('duels')==='1'||params.get('ligue')==='1'||!!params.get('saison')||params.get('parcours')==='1'||params.get('reprise')==='1'
      ||!!params.get('apk')||!!params.get('sante')||params.get('prospects')==='1'||!!params.get('payer')||!!params.get('paiement_coach')
      ||!!params.get('garmin')||params.get('messages')==='1'||!!params.get('role')||!!params.get('inv'));
    // ?apk=<versionCode> — l'APK Android (LauncherActivity) l'ajoute à chaque
    // ouverture. Rangé dans rc_apk : la feuille « Connecter mes données
    // santé » sait ainsi qu'elle tourne dans l'APK (rcDansApk).
    const _apkV=String(params.get('apk')||'');
    if(/^\d{1,6}$/.test(_apkV)){ try{ localStorage.setItem('rc_apk',_apkV); }catch(e){} }
    // ?sante=ok|erreur — le retour de ConnecterSanteActivity, après « Autoriser ».
    // #sante-envoyer — la notification du matin (iPhone) : Lifestyle, et la bande.
    try{ if(location.hash==='#sante-envoyer') window._pendingSanteEnvoyer=true; }catch(e){}
    const _santeR=params.get('sante');
    if(_santeR==='ok'||_santeR==='erreur') window._pendingSanteRetour=_santeR;
    // Coach invite → athlete device
    const cpkg=params.get('coachpkg');
    if(cpkg){
      const rawC=JSON.parse(decodeURIComponent(escape(atob(cpkg))));
      const coach=_validateCoachPkg(rawC);
      if(coach){
        const users=DB.get('users')||{};
        users[coach.email]=Object.assign(users[coach.email]||{},coach);
        DB.set('users',users);
        window._importedCoach=coach;
        _coachRetenu=coach;
        // _st géré séparément — jamais mergé dans le profil coach
        if(typeof rawC._st==='string'&&rawC._st&&!CLOUD.canWrite()) CLOUD.configure(rawC._st);
      }
    }
    // Athlete profile → coach device
    // Ce paquet n'est PAS signé : il suffit d'un lien pour en présenter un. La
    // version précédente écrivait le profil et le poussait dans le cloud dès
    // l'ouverture de l'URL, avant que quiconque ait rien demandé — ouvrir un
    // lien reçu suffisait à écraser le dossier d'un athlète, y compris à
    // distance. On se contente ici de valider et de mettre de côté ; l'écriture
    // attend une confirmation nommée (_proposerImportAthlete, plus bas).
    const apkg=params.get('athletepkg');
    if(apkg){
      const rawA=JSON.parse(decodeURIComponent(escape(atob(apkg))));
      const athlete=_validateAthletePkg(rawA);
      if(athlete) window._pendingAthletePkg=athlete;
    }
    // ── Invitation ouverte ────────────────────────────────────────────
    // Le code de l'invitation voyage a cote du profil coach. On le retient
    // pour deux choses : marquer « ouvert », et pre-remplir le champ code.
    const inv=params.get('inv');
    const _invOk=!!(inv&&/^[A-Z0-9-]{6,20}$/.test(inv));
    if(_invOk){
      window._invitationCode=inv;
      // ⚠ DIFFÉRÉ (05/10/2026). Ce bloc tourne PENDANT le chargement du script :
      //   _armerMarqueurOuverture lit _invMarqueurArme, un `let` déclaré plus
      //   loin dans rc-core (054) — appelée ici, elle levait une ReferenceError
      //   (zone morte), le marqueur « ouvert » ne s'armait jamais, et le `try`
      //   sautait TOUT ce qui suit (rc_invitation, ?s=, ?bilan=1, ?ref=…).
      try{ setTimeout(()=>{ try{ _armerMarqueurOuverture(inv); }catch(e){} },0); }catch(e){}
    }
    // ⚠ L'INVITATION SURVIT À L'INSTALLATION (05/10/2026). La PWA installée
    //   s'ouvre sur start_url, SANS paramètres : gardée en mémoire seulement,
    //   l'invitation était perdue au premier lancement depuis l'icône. Elle est
    //   rangée dans rc_invitation (30 jours, invitationEnAttente). Du coach, on
    //   ne garde que ce que la bannière et le repli lisent : le profil complet
    //   (photo comprise) est déjà dans rc_users, et le recopier ici remplirait
    //   le stockage. Écrit en clair : ce bloc tourne au chargement du script.
    if(_invOk||_coachRetenu){
      const _c=_coachRetenu?{email:String(_coachRetenu.email||''),fname:String(_coachRetenu.fname||''),
        lname:String(_coachRetenu.lname||''),code:String(_coachRetenu.code||'')}:null;
      try{ localStorage.setItem('rc_invitation',JSON.stringify({inv:_invOk?inv:null,coach:_c,le:Date.now()})); }catch(e){}
    }
    const st=params.get('s');
    if(!CLOUD.canWrite()&&st) CLOUD.configure(atob(st));
    const _bilanDeepLink=params.get('bilan')==='1';
    if(_bilanDeepLink) window._pendingBilanOpen=true;
    const _woDeepLink=params.get('wo')==='1';
    if(_woDeepLink) window._pendingWoOpen=true;
    // ?diete=1 — AJOUTE POUR LE RACCOURCI DU MANIFESTE. « Nouvelle séance »
    // avait déjà son ?wo=1 ; la diète n'avait aucune adresse, et un raccourci
    // qui ouvre l'accueil au lieu de l'écran promis est un lien mort qui ne
    // dit pas son nom. Même patron que les deux au-dessus, à la ligne près :
    // un drapeau ici, sa consommation dans la même liste plus bas.
    const _dieteDeepLink=params.get('diete')==='1';
    if(_dieteDeepLink) window._pendingDieteOpen=true;
    // ?wrapped=<clé> — la notification du Wrapped (sw.js, 'wrapped-reminder').
    const _wrDeep=params.get('wrapped');
    if(_wrDeep&&/^(m-\d{4}-\d{2}|a-\d{4}|1)$/.test(_wrDeep)) window._pendingWrappedOpen=_wrDeep;
    // ?canal=1 — les push des défis (nouveau défi, plus que 48 h).
    if(params.get('canal')==='1') window._pendingCanalOpen=true;
    // ?prospects=1 — les notifications au coach d'un nouveau contact (C6).
    if(params.get('prospects')==='1') window._pendingProspectsOpen=true;
    // ?payer=<slug>~<formule> (la vitrine d'un coach relié) : gardé BRUT, une heure,
    // jusqu'à la connexion. ?paiement_coach=retour|annule&token=<commande> : le retour de PayPal.
    if(params.get('payer')){ try{ localStorage.setItem('rc_payer',JSON.stringify({brut:String(params.get('payer')).slice(0,90),at:Date.now()})); }catch(e){} }
    if(params.get('paiement_coach')) window._pendingPaiementCoach={etat:String(params.get('paiement_coach')),commande:String(params.get('token')||'')};
    // ?formule=validee|annulee — le retour de PayPal après « Changer de formule ».
    if(/^(validee|annulee)$/.test(String(params.get('formule')||''))) window._pendingFormule=String(params.get('formule'));
    // ?ref=<CODE> — le lien de parrainage. Gardé jusqu'à l'inscription.
    // ⚠ ÉCRIT ICI, EN CLAIR, ET NON PAR parrainageMemoriserRef : ce bloc tourne
    //   pendant le chargement du script, AVANT que les constantes du module
    //   parrainage soient initialisées (elles lèveraient, et le code serait
    //   perdu en silence). Même clé, même forme.
    const _ref=String(params.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[A-Z]{4,6}[A-Z2-9]{3}$/.test(_ref)){
      const _v=JSON.stringify({code:_ref,le:Date.now()});
      try{ localStorage.setItem('rc_ref',_v); }catch(e){}
      try{ sessionStorage.setItem('rc_ref',_v); }catch(e){}
      window._refCode=_ref;
    }
    // ?amb=<CODE> — un lien d'ambassadeur. Même garde que ?ref= (écrit ici,
    // en clair : les constantes du module ne sont pas encore initialisées).
    const _amb=String(params.get('amb')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(/^[A-Z0-9]{3,16}$/.test(_amb)){
      const _va=JSON.stringify({code:_amb,le:Date.now()});
      try{ localStorage.setItem('rc_amb',_va); }catch(e){}
      try{ sessionStorage.setItem('rc_amb',_va); }catch(e){}
      window._ambCode=_amb;
    }
    // L'ORIGINE (attribution) : src, amb, ref de ce lien, jusqu'à l'inscription.
    // Écrite ici, en clair (constantes du module pas encore initialisées). La
    // dernière arrivée l'emporte : c'est elle qui a fait venir.
    const _osrc=String(params.get('src')||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,20);
    if(_osrc||_amb||params.get('ref')){
      try{ localStorage.setItem('rc_origine',JSON.stringify({src:_osrc,amb:_amb,
        ref:String(params.get('ref')||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12),le:Date.now()})); }catch(e){}
    }
    // ?role=coach — arrivé par coachs.html (« Créer mon espace coach ») : gardé
    // 30 jours (rc_role_voulu), car l'icône installée s'ouvre sans paramètre.
    // rcRoleRoute l'envoie à l'Espace coach plutôt qu'à l'accueil athlète, et
    // rcRolePreselection coche « Coach » à l'inscription. Sans lui, rien ne change.
    rcRoleDepuisParams(params);
    // ?coach=<slug> — arrivé par la vitrine publique d'un coach (/coach/<slug>).
    const _vit=String(params.get('coach')||'').toLowerCase();
    if(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(_vit)) try{ localStorage.setItem('rc_vitrine_coach',_vit); }catch(e){}
    // ?parrainage=1 — les push du parrainage (filleul inscrit, abonné).
    if(params.get('parrainage')==='1') window._pendingParrainageOpen=true;
    // ?duel=<id> — un défi reçu (« Défie un pote ») : gardé jusqu'à ce que
    // l'athlète, connecté, le relève. /i y a déjà mis le prénom de qui défie.
    const _duel=String(params.get('duel')||'').toLowerCase();
    if(/^d[a-z0-9]{10,24}$/.test(_duel)){
      let _dv=null; try{ _dv=JSON.parse(localStorage.getItem('rc_duel_invite')||'null'); }catch(e){ _dv=null; }
      if(!_dv||_dv.id!==_duel) try{ localStorage.setItem('rc_duel_invite',JSON.stringify({id:_duel,le:Date.now()})); }catch(e){}
    }
    // ?saison=<id> — les push d'un événement saisonnier.
    if(/^[a-z0-9][a-z0-9-]{2,40}$/.test(String(params.get('saison')||''))) window._pendingSaisonOpen=true;
    // ?parcours=1 — le rappel du 21e jour d'essai : la carte revient.
    if(params.get('parcours')==='1') window._pendingParcoursOpen=true;
    // ?messages=1 — la notification d'un message privé (lot M2).
    if(params.get('messages')==='1') window._pendingMessagesOpen=true;
    // ?garmin=ok|refus|expire|erreur|ferme — le retour de la liaison Garmin (lot G1).
    if(/^[a-z]{2,8}$/.test(String(params.get('garmin')||''))) window._pendingGarmin=String(params.get('garmin'));
    // ?reprise=1 — la relance du 30e jour : l'écran « Reprise en douceur ».
    if(params.get('reprise')==='1') window._pendingRepriseOpen=true;
    // ?duels=1 — les push des duels (début, J-2, résultat).
    if(params.get('duels')==='1') window._pendingDuelsOpen=true;
    // ?ligue=1 — les push des ligues (zone de bascule, résultat du lundi).
    if(params.get('ligue')==='1') window._pendingLigueOpen=true;
    // ?paiements=1 — le push d'un litige PayPal, pour l'administrateur.
    if(params.get('paiements')==='1') window._pendingPaiementsOpen=true;
  }catch(e){}
  finally{
    if(aNettoyer){
      try{window.history.replaceState({},'',window.location.pathname);}catch(e){}
    }
  }
})();
// PURE (le stockage mis à part). L'invitation gardée par importFromURL, si elle
// a moins de 30 jours : {inv, coach} — l'un des deux peut être null — ou null.
// Valeurs écrites EN CLAIR, sans constante d'un autre module : elle est appelée
// juste en dessous, pendant le chargement du script.
function invitationEnAttente(maintenant){
  let o=null;
  try{ o=JSON.parse(localStorage.getItem('rc_invitation')||'null'); }catch(e){ return null; }
  if(!o||typeof o!=='object') return null;
  const t=Number(maintenant)||Date.now(), le=Number(o.le)||0;
  if(!(le>0)||t-le>30*864e5||le>t+864e5) return null;
  const inv=(typeof o.inv==='string'&&/^[A-Z0-9-]{6,20}$/.test(o.inv))?o.inv:null;
  const c=(o.coach&&typeof o.coach==='object')?o.coach:null;
  const coach=c?{email:String(c.email||''),fname:String(c.fname||''),lname:String(c.lname||''),code:String(c.code||'')}:null;
  if(!inv&&!coach) return null;
  return {inv,coach};
}
// LE PREMIER LANCEMENT DEPUIS L'ICÔNE : sans paramètres, _invitationCode est
// vide — on le reprend de l'invitation gardée.
try{ if(!window._invitationCode){ const _ie=invitationEnAttente(Date.now()); if(_ie&&_ie.inv) window._invitationCode=_ie.inv; } }catch(e){}

// ── Import d'un profil athlète : proposer, puis seulement écrire ────────────
// Le paquet vient de l'URL et n'est pas signé. Rien n'est écrit, ni en local ni
// dans le cloud, tant que la personne devant l'écran n'a pas dit oui en voyant
// le nom et les volumes concernés.

// Ce que l'import changerait réellement, pour pouvoir l'annoncer sans mentir.
// Les bilans sont FUSIONNÉS (union sur date+type) : n'annoncer que les
// nouveaux, pas le total du paquet. Les séances, elles, sont REMPLACÉES par
// Object.assign — un paquet sans séances viderait l'historique, et c'est
// précisément ce qu'il faut montrer avant, pas découvrir après.
function _diffAthletePkg(a){
  const existant=(DB.get('users')||{})[a.email]||null;
  const exBilans=(existant&&existant.bilans)||[];
  const pkgBilans=a.bilans||[];
  return {
    existant:existant,
    connu:!!existant,
    bilansNouveaux:pkgBilans.filter(nb=>!exBilans.find(eb=>eb.date===nb.date&&eb.type===nb.type)).length,
    bilansConserves:exBilans.length,
    seances:(a.sessions||[]).length,
    seancesExistantes:((existant&&existant.sessions)||[]).length,
    // nutrition et videos sont eux aussi remplacés en bloc par l'Object.assign,
    // sans apparaître dans le décompte bilans/séances : un paquet qui ne les
    // porte pas effacerait le plan nutritionnel sans que l'écran l'ait dit.
    ecrase:[
      (existant&&Object.keys(existant.nutrition||{}).length&&!Object.keys(a.nutrition||{}).length)?'le plan nutritionnel':'',
      (existant&&((existant.videos||[]).length)&&!((a.videos||[]).length))?'les vidéos':''
    ].filter(Boolean)
  };
}
// Qui a qualité pour accepter : un coach (ce paquet va d'un athlète VERS un
// appareil de coach), ou l'athlète lui-même qui rapatrie son propre dossier.
// Le déclencheur étant en tête de routeUser(), donc avant le test de rôle,
// sans ce garde un athlète connecté se verrait proposer d'écrire le dossier
// d'un tiers puis de le pousser sous sa propre identité. Un consentement n'est
// pas une autorisation.
// ── Re-consentement quand la politique change ───────────────────────────────
// Un consentement porte sur un TEXTE. Modifier privacy.html sans redemander
// l'accord laisserait des comptes rattaches a une version qu'ils n'ont jamais
// lue. On compare donc la version stockee a POLICY_VERSION.
// Les comptes anterieurs a ce champ n'en portent aucun : ils passent aussi par
// cet ecran, ce qui est le comportement voulu — leur accord d'origine portait
// sur un texte qui a change depuis.
// ══════════ LE CONSENTEMENT SANTE, ET LE VERROU QUI LE REND LEGAL ═════════
//
// L'inscription demandait onze choses avant d'avoir rien montre. Six sont
// DEPLACEES — jamais supprimees, jamais fusionnees — au moment ou elles
// servent, chacune avec la phrase qui dit pourquoi on la demande la.
//
// ⚠ CE DEPLACEMENT N'EST LEGAL QUE SI UNE GARANTIE TIENT : aucune donnee de
// sante ne peut etre ecrite, ni localement ni a distance, avant que le
// consentement sante ait ete recueilli. C'est tout l'objet de ce bloc, et
// c'est la seule chose de ce fichier dont une erreur est une faute au sens de
// l'article 9 du RGPD. Tout le reste n'est que confort.
//
// LES DEUX CONSENTEMENTS RESTENT STRICTEMENT SEPARES. L'article 6 (accepter
// des conditions) et l'article 9 (traiter des donnees de sante) sont deux
// regimes distincts. Ils ne sont ni fusionnes, ni pre-coches, ni deduits l'un
// de l'autre : `consent.cgu` et `consent.health` sont deux booleens, poses par
// deux gestes, a deux moments.
//
// ── LA CLASSIFICATION, ET POURQUOI ELLE EST ECRITE EN DUR ────────────────
//
// ⚠ CHAMPS_SANTE, ET NON SANTE_CHAMPS : ce nom-la est deja pris, par la
// table {bloc: champs} qui masque grossesse, pes, constantes et analyses
// avant l'envoi vers sante_privee. Deux listes differentes, deux roles
// differents, et les confondre melangerait un masquage de partage avec un
// verrou de consentement.
//
// Les 165 champs qu'un dossier peut porter sont ranges dans DEUX listes, et
// chacun doit figurer dans EXACTEMENT UNE. Une assertion du depot balaye le
// source, releve tout champ affecte sur un dossier, et tombe si l'un d'eux
// n'est classe nulle part. C'est ce qui rend la garantie durable : un champ
// ajoute l'an prochain fait TOMBER LE TEST tant que quelqu'un n'a pas dit ce
// qu'il contient. Sans ce balayage, une liste ecrite a la main derive en
// silence, et la derive ne se voit qu'apres la fuite.
//
// EN CAS DE DOUTE, SANTE. C'est le seul biais acceptable ici : classer a tort
// un champ anodin en sante retarde une ecriture jusqu'a une question ; classer
// a tort un champ de sante en anodin ecrit une donnee de l'article 9 sans
// consentement.
const CHAMPS_SANTE=Object.freeze([
  // Poids, mensurations, photos corporelles
  'weightLog','profileWeight','weight','bilans','photosBilan','photosProgression',
  'comparaisons','bilanGoals','_evol_height','_evol_gender',
  // Sommeil, pas, energie, habitudes quotidiennes
  'sleepLog','stepsLog','fcReposLog','vfcLog',
  // Le point de la semaine (lot N1) : la vitesse du poids, semaine par semaine.
  'pointsSemaine','stepsDayType','stepsGoals','sleepGoal','energieLog','habitudesLog',
  // Le check-in du matin : sommeil, énergie, courbatures, et la batterie tirée.
  'checkin',
  // Cycle menstruel et ce qui l'entoure
  'cycle','currentCycle','cycleSuivi','cycleArretPropose','cycleChoixVus',
  'cycleIgnoresSuite','grossesse','statutHormonal','traitementHormonal',
  'contraception','thyroide','etatsSante','famillesTraitement','traitementDetail',
  'traitementEnCours','traitementRevuLe',
  // Douleur, drapeaux, suspension : de la donnee de sante pure
  'drapeauRouge','drapeauGeneral','historiqueDrapeaux','journalDouleur',
  'contraintesSante','suspension','sante','santeSignal','santeSource',
  'tracesSante','constantes','analyses','encartOsseuxVu',
  // L'analyse morphologique initiale (lot 8) : des longueurs de segments en
  // centimetres, lues une fois sur une photo de bilan et figees. Aucune image
  // dedans — la photo n'est designee que par la date de son bilan — mais ce
  // sont des mesures d'un corps : elles sont de sante, comme les mensurations.
  'morphoInitiale',
  // L'analyse morpho-anatomique (24/09/2026) : les 33 points des photos de
  // face et de dos du premier bilan, et le masque de la personne. Aucune image
  // — mais c'est le contour d'un corps, lu sur une photo corporelle : santé.
  'morphoAnat',
  // La carte d'athlète : sa note de force est l'e1RM RAPPORTÉ AU POIDS DE
  // CORPS. Une dérivée du poids : en cas de doute, santé.
  'carte','carteHist',
  // Les trois mesures au mètre du chantier A12 : elles vivent dans les bilans
  // (déjà de santé), et le seraient aussi recopiées ailleurs.
  'deb-envergure','deb-pied','deb-thorax',
  // Alimentation, cafeine, complements — nutrition porte les trois
  'nutrition','paliers','phase','phaseRefusee',
  // Troubles alimentaires et vigilance energetique
  'tcaRisque','tcaRisqueDate','redsScreening','masquerPoids',
  // Produits ameliorant la performance
  'pes','pesPartagee',
  // Ressentis de seance et ce qui en derive
  'fatigue','journalSeance','ecartsSeance','retourMuscle','rites','allegementJour',
  'monteeChargeMasquee','reperesAuto','calibrageRir',
  // ⚠ L'AGE EST UNE DONNEE DE SANTE, et le texte de r-health le dit depuis
  // toujours : « … pas quotidiens et age pour mon suivi sportif ». Il est
  // demande au premier calcul de charge, et ce moment-la passe donc par le
  // meme verrou que les autres.
  'birthdate','age',
  // Le genre n'est PAS une donnee de sante au sens de l'article 9. Il est
  // pourtant ici : il n'est demande qu'avec la date de naissance, au meme
  // ecran, et il ne sert qu'a des calculs de sante — masse grasse, repere
  // energetique, fourchette de perte. Le laisser passer seul n'apporterait
  // rien et ouvrirait une porte a surveiller.
  'gender'
]);
// L'AUTRE MOITIE. Identite, authentification, lien au coach, programme,
// preferences d'affichage, et tout l'espace coach — qui ne porte aucune donnee
// de sante SUR LE COACH LUI-MEME. Ces champs s'ecrivent librement avant le
// consentement sante, et c'est ce qui permet a quelqu'un de s'inscrire, de se
// rattacher, de recevoir un programme et de s'entrainer sans avoir eu a
// consentir a quoi que ce soit d'autre que la politique de confidentialite.
const CHAMPS_NON_SANTE=Object.freeze([
  'id','email','fname','lname','role','createdAt','updatedAt','consent','rgpd',
  'status','accessExpiry','paymentStatus','paypalSubscriptionId','abonnement',
  // La date du rattachement à son coach (02/10/2026) : le rang dans le quota
  // de la formule du coach (athleteCouvertParCoach). Une date, pas une mesure.
  'rattacheLe',
  // Le modèle du coach posé comme programme (invitations en lot, 05/10/2026,
  // _appliquerProgrammeDepart) : un nom et une version, pas une mesure.
  'assignedProgramName','assignedProgramAt','assignedProgramId','assignedProgramGenre','assignedProgramVersion',
  // Le jour du point de la semaine (lot N1) : un rendez-vous, pas une mesure.
  'pointJour',
  // Le fuseau horaire de l'appareil (« Europe/Paris ») : le serveur s'en sert
  // pour n'envoyer de notification qu'entre 8 h et 21 h CHEZ l'athlete. Un
  // reglage, pas une mesure.
  'tz',
  // `essai` compte des seances pour decider d'un paywall : c'est de la
  // facturation, pas de la sante. Il ne porte ni mesure, ni ressenti, ni
  // date de naissance — seulement un horodatage d'ouverture et un nombre de
  // seances deja faites au depart.
  'essai',
  // Le nom sous lequel l'athlete signe ses visuels (seance, et ceux a venir) :
  // un reglage d'affichage et un pseudo qu'il choisit. Aucune donnee de sante,
  // mais ils DOIVENT etre classes, sinon ils ne sont proteges par rien.
  'pseudo','visuelNom',
  // L'accord de l'athlète pour que son coach EXPORTE son avant/après : une
  // date, ou null. Un consentement, pas une donnée de santé — et il doit être
  // lu par le coach, donc rester dans /users.
  'consentementPartageCoach',
  // La date a laquelle les medias d'un dossier dormant ont ete detruits. Une
  // date, et rien d'autre : ni mesure, ni ressenti. Elle DOIT etre classee,
  // sinon elle n'est protegee par rien — signale par l'assertion « Chaque champ
  // du dossier est classe sante ou non-sante » a la premiere execution.
  'mediasDormantsPurgesLe',
  // La trace du programme choisi dans la boutique : un identifiant, un nom, la
  // version H/F et une date. Ce n'est pas une donnee de sante — c'est un achat
  // et un choix de programme — mais elle DOIT etre classee, sinon elle n'est
  // protegee par rien. Signale par l'assertion « Chaque champ du dossier est
  // classe sante ou non-sante » a la premiere execution.
  // ⚠ LE GENRE Y FIGURE, et il est deja classe ailleurs : c'est le meme que
  // `gender`, recopie ici pour savoir quelle version a ete posee.
  'programmeApplique',
  // Les trois mesures que le coach a epinglees sur la fiche d'un athlete
  // (lot 5). C'est une preference DE LECTURE, rangee dans le dossier DU COACH :
  // une table {idAthlete: [cles de mesure]}, sans une seule valeur mesuree.
  // Elle DOIT etre classee, sinon elle n'est protegee par rien.
  'ccdEpingles',
  // Les programmes achetes : un identifiant, une date, le prix paye et le
  // numero d'ordre PayPal. De la facturation, pas de la sante — mais qui DOIT
  // etre classee, sinon elle n'est protegee par rien.
  'programmesAchetes',
  // Le mouchard d'envoi video : une etape, un horodatage, une taille de
  // fichier et un message d'erreur. Du diagnostic, pas de la sante — mais il
  // DOIT etre classe, sinon il n'est protege par rien.
  'videoDiag',
  // Les volts : une copie du total recalculé (xpCalcul), le plus haut rang
  // déjà fêté, et les volts des nuits purgées du journal. Des scores, pas des
  // mesures — mais ils DOIVENT être classés.
  'xp','xpRang','xpArchive',
  // Les défis bouclés (titre, dates, champion) : recopiés de /defis_resultats.
  'defisReleves',
  // Les ligues (01/10/2026) : les résultats recopiés du serveur (place,
  // mouvement, division) et le choix de ne pas y participer. Des classements
  // et une préférence, comme les défis.
  'liguesReleves','liguesOff',
  // Le MIROIR du parrainage (code, compteurs, dates des filleuls abonnés) —
  // l'original, qui seul fait foi, vit dans /parrainage/comptes.
  'parrainage',
  // Les pages publiques : le pseudo, l'état et les choix de la page d'un
  // athlète ; le slug et les spécialités de la vitrine d'un coach. Des
  // réglages d'affichage — la page elle-même n'accepte aucune donnée de santé.
  'pagePublique','vitrineSlug','vitrinePubliee','specialites',
  // Les duels de l'athlète : leurs identifiants, son rôle, une date.
  'duels',
  // Le réglage des célébrations (complètes ou discrètes).
  'celebrations',
  // Le parcours de démarrage : des étapes datées, rien de santé.
  'parcours',
  // Le tonnage cumulé (relance du serveur léger) et le choix de la reprise
  // en douceur (une date, oui ou non).
  'tonnageTotal','_repriseDouce',
  // Le détail des volts (lu et borné par le serveur) et le sous-niveau fêté.
  'xpDetail','xpNiveau',
  // Les éditions saisonnières : les badges reçus, la dernière valeur envoyée.
  'saisonsReleves','saisonsVal',
  // Combien de fois la page a été proposée à un passage de rang (deux au plus).
  'pagePropose',
  // L'ambassadeur par qui le compte est arrivé : un code, un nom, une date.
  'ambassadeur',
  // L'origine du compte (attribution) : le type de lien, un code parrain ou
  // ambassadeur, les dates d'arrivée, d'inscription et de premier paiement.
  'origine',
  // Les types de notification push que l'athlète a coupés : {type:false}.
  // Un réglage, lu par le serveur avant chaque envoi — aucune donnée de santé.
  'pushPrefs','pushRefus','_pushInstallVu',
  'echeance','alertStatus','supprimes','_export',
  'coachId','coachName','coachEmailKey','coachCode','coachPhoto','code','clients',
  'coachPlan','coachSubActive','coachPlanSince','coachPrograms','coachNotes',
  // Les étiquettes d'athlètes et le dernier contact : dans le dossier du coach.
  'etiquettes','etiquettesAth','contacts',
  // Le temps passé par athlète et par semaine (chronoCoach).
  'chrono',
  'studentCodes','msgTemplates','reponseFormules','relancesAuto','quickComments','protocolesPerso','canalEpingle',
  'canalDernier','journalGroupe','cloudinaryName','cloudinaryPreset','teamName',
  // Les programmes qu'un coach met en vente : un nom, un pitch, un prix, un
  // lien et une image. Du commerce, pas de la sante — mais il DOIT etre classe,
  // sinon il n'est protege par rien.
  'vitrineProgrammes',
  // Les formules proposées sur la vitrine (des clés du tableau des offres) et
  // le message d'accueil des prospects (lot C6).
  'vitrineFormules','prospectAccueil',
  // Le miroir de la liaison PayPal du coach (le serveur fait foi : coach_paiement).
  'paiementCoach',
  'catchphrase','phone','diplomes','promoBanners','seenBilans','bio','dispo',
  'contact','vision','level','salles','rapPreset','blocPriorite','lastCoachVisit',
  'demandesVideo',
  // Les mesures que le coach reclame a un athlete (lot 6) : une cle de mesure,
  // une date, l'id du demandeur. Aucune VALEUR mesuree la-dedans — c'est la
  // meme forme que demandesVideo, et elle doit etre classee comme elle.
  'demandesMesure',
  'motCoach','brouillonsProg','methodesForcees','programme',
  // Les notes d'exercice (30/09/2026) : un texte libre de 140 caractères par
  // exercice, lu par le coach — même nature que motCoach, et classé comme lui.
  'notesExo',
  'programPdf','programPdfDate','programPdfLink','programPdfName','programPdfSize',
  'programPdfStorageUrl','programPdfVersion',
  'exAlias','exMuscles','exCatalogVersion','exCustom','exFavoris','exRecents',
  'chargesSchema','sessions_config','sessions','streak','streakWeek','lastSession',
  // Les jokers de série (26/09/2026) : des compteurs et une date, comme streak.
  'streakJokers','streakJokersUtilises','streakJokerLe',
  // La mission du jour (01/10/2026) : les cases faites (des clés : séance,
  // nuit, protéines…), les actes vus par l'app et le coffre. Elles disent ce
  // qui a été FAIT ce jour-là, comme sessions et sleepLog : classées avec eux.
  'missions',
  // correctionsOrphelines porte EXACTEMENT ce que porte videos[].feedback :
  // le retour d'un coach sur un mouvement, quand la video qui l'a motive
  // n'existe plus (lot 7). Il est classe avec elle, et pour la meme raison.
  // programmePerso : la DATE a laquelle un coach a ecrit un plan pour cette
  // personne, et l'identifiant du coach. revisions : les ajustements payes,
  // date et montant. Ni l'une ni les autres ne disent quoi que ce soit du
  // corps : ce sont des faits commerciaux, comme programmesAchetes (lot 9).
  // cloudinaryAPurger : des identifiants de fichiers a supprimer chez
  // l'hebergeur, rien d'autre. Aucun contenu, aucune mesure, aucun nom : de
  // la comptabilite de menage, classee avec les videos qu'elle designe.
  'videos','correctionsOrphelines','cloudinaryAPurger','programmePerso','revisions',
  'athletePhoto','objective','badges','habitudes','sonRepos','ecranAllume',
  // R20 — le dernier onglet d'Évolution ouvert : un NOM d'onglet ('perf',
  // 'mensus'…), une preference d'affichage. Aucune mesure n'y transite.
  'uiProgressTab',
  'questionnaireComplete','_firstBilanPending','_reprise','_repriseDeload',
  '_defaultCooldown','_defaultWarmup','_bilanFreq','_notifEnabled',
  // La cadence des bilans et les questions de fin de bilan, posées par le coach :
  // un rythme et des questions, aucune réponse (les réponses vivent dans bilans).
  'bilanCadence','questionsCoach',
  // L'unité des charges et les pas de matériel de l'athlète (arrondiCharge).
  'unite','pasMateriel',
  // « Compter le travail indirect » (réglage du coach, écran Volume).
  'reperesComptage',
  '_woReminderDays','_woReminderEnabled','_woReminderHour','_woReminderMin',
  '_lastBilanNotif','_lastFbNotif','_lastRepBilanNotif','_lastWoNotif',
  '_notifDemandeeLe','_installDemandeeLe',
  // R09 — CE QUE L'ATHLETE A DEJA VU : des booleens d'affichage, un par encart
  // explicatif (« surcharge » d'abord). Ni mesure, ni ressenti — une
  // preference d'interface.
  'vus',
  // La lignee de synchronisation (voir CLOUD._baseDe) : un horodatage du
  // serveur, retire avant tout envoi. Rien de l'athlete.
  '_syncMaj',
  // `innerHTML` est un faux positif du balayage : c'est une propriete du DOM,
  // jamais un champ de dossier. Il est nomme pour que le test reste exact.
  'innerHTML'
]);
// PURE. A-t-il consenti UN JOUR ? C'est la question du VERROU, et elle ne
// regarde pas la version du texte.
//
// ⚠ LA DISTINCTION AVEC aConsentiSante N'EST PAS UN DETAIL : elle empeche une
// perte de donnees. Quelqu'un qui a consenti sous la politique de mars et n'a
// pas encore revu celle de septembre A DEJA des donnees de sante, legitimement
// recueillies. Si le verrou lisait la version, la prochaine sauvegarde les
// effacerait toutes. Le verrou dit « a-t-il consenti », la porte dit « son
// accord est-il a jour » — et c'est la porte qui redemande.
function santeJamaisConsentie(u){
  return !(u&&u.consent&&u.consent.health===true);
}
// PURE. L'accord est-il a jour ? C'est la question de la PORTE, celle qui
// decide s'il faut redemander avant d'ecrire.
function aConsentiSante(u){
  const c=u&&u.consent;
  return !!(c&&c.health===true&&c.policyVersion===POLICY_VERSION);
}
// PURE. Le dossier, ampute de ce qu'il n'a pas le droit de porter.
//
// ⚠ RENDU TEL QUEL DANS LE CAS NORMAL — meme objet, aucune copie, aucun cout.
// La branche qui coupe ne sert qu'aux dossiers qui n'ont JAMAIS consenti,
// c'est-a-dire aux comptes neufs, dont le dossier est presque vide.
//
// C'EST UNE SECONDE LIGNE, PAS LA PREMIERE. Les portes en amont sont censees
// faire qu'aucune donnee de sante n'arrive jamais jusqu'ici sans accord. Si
// celle-ci coupe quelque chose, c'est qu'une porte manque : elle le DIT en
// console plutot que de le faire en silence, et la sonde de recette lit ce
// signal. Une defense muette ne s'entretient pas.
function _sansSante(u){
  if(!u||!santeJamaisConsentie(u)) return u;
  const copie={},coupes=[];
  for(const k in u){
    if(CHAMPS_SANTE.indexOf(k)>=0){ if(u[k]!==undefined&&u[k]!==null) coupes.push(k); continue; }
    copie[k]=u[k];
  }
  // Les seances restent — s'entrainer n'est pas une donnee de sante — mais
  // LEURS RESSENTIS partent : fatigue, sensations, motivation et hydratation
  // sont nommes comme donnees de sante au §2 de la politique.
  if(Array.isArray(copie.sessions)&&copie.sessions.some(x=>x&&x.metrics)){
    copie.sessions=copie.sessions.map(x=>{
      if(!x||!x.metrics) return x;
      const c=Object.assign({},x); delete c.metrics; return c;
    });
    coupes.push('sessions.metrics');
  }
  if(coupes.length){
    try{ console.error('[RepCore] donnée de santé écrite sans consentement, '
      +'coupée avant enregistrement : '+coupes.join(', ')
      +' : il manque une porte en amont.'); }catch(e){}
    try{ window._santeCoupee=(window._santeCoupee||[]).concat(coupes); }catch(e){}
  }
  return copie;
}
// ── LA PORTE, ET IL N'Y EN A QU'UNE ──────────────────────────────────────
//
// Tout geste qui va ecrire une donnee de sante passe par ici. Elle rend true
// quand l'ecriture peut se faire tout de suite, false quand elle a ete
// suspendue le temps de poser la question — et dans ce cas elle rejoue
// `apres` toute seule des que l'accord est donne.
//
// `motif` est la phrase qui dit POURQUOI on demande maintenant. Elle n'est pas
// decorative : c'est elle qui fait la difference entre un consentement
// eclaire et une case a cocher de plus.
const SANTE_MOTIFS=Object.freeze({
  poids:      'Ton poids est une donnée de santé.',
  mensuration:'Tes mensurations et tes photos de progression sont des données de santé.',
  photo:      'Tes photos de progression sont des données de santé.',
  cycle:      'Le suivi de ton cycle est une donnée de santé.',
  sommeil:    'Ton sommeil est une donnée de santé.',
  stress:     'Ton niveau de stress est une donnée de santé.',
  cafeine:    'Ta consommation de caféine est une donnée de santé.',
  complement: 'Les compléments que tu prends sont une donnée de santé.',
  pas:        'Ton nombre de pas quotidiens est une donnée de santé.',
  energie:    'Ton niveau d\'énergie est une donnée de santé.',
  age:        'Ta date de naissance sert à calculer tes repères : c\'est une donnée de santé.',
  ressenti:   'Ton ressenti de séance (fatigue, sensations) est une donnée de santé.'
});
// ── LES DEUX AUTRES DEPLACEMENTS ────────────────────────────────────────
//
// Meme forme que la porte de sante, et pour la meme raison : l'appelant dit
// POURQUOI il a besoin de la donnee, la porte se charge de l'obtenir, et le
// geste d'origine reprend tout seul.
const IDENTITE_MOTIFS=Object.freeze({
  coach:   'Ton coach a besoin de savoir qui tu es.',
  partage: 'Ce que tu t\'apprêtes à partager porte ton nom.',
  defaut:  'RepCore a besoin de ton nom pour cette action.'
});
const NAISSANCE_MOTIFS=Object.freeze({
  charge: 'Pour calculer tes repères, RepCore a besoin de ton âge et de ton genre.',
  cycle:  'Le suivi du cycle a besoin de ta date de naissance et de ton genre.',
  defaut: 'Ce calcul a besoin de ton âge et de ton genre.'
});
// PURE. Le dossier porte-t-il de quoi calculer ?
function identiteComplete(u){
  return !!(u&&String(u.fname||'').trim()&&String(u.lname||'').trim());
}
// ⚠ ELLE DOIT LIRE COMME LE CALCUL QU'ELLE GARDE, ET PAS PLUS STRICTEMENT.
//
// La premiere version exigeait `u.birthdate` et `u.gender`. Or ageActuel lit
// la date de naissance, PUIS `deb-birthdate` du bilan, PUIS `deb-age`, et son
// commentaire est explicite : « des dossiers en portent un sans date de
// naissance, et les priver de calcul serait leur faire payer un changement
// qu'ils n'ont pas demande ». Le genre a le meme repli, par `_evol_gender` et
// `deb-gender`.
//
// Une porte plus stricte que son calcul redemande une donnee que le dossier
// porte deja, ailleurs. Deux assertions du depot l'ont montre sur un gabarit
// dont l'age ne vivait que dans un bilan de depart.
function naissanceComplete(u){
  if(!u) return false;
  let age=null;
  try{ age=ageActuel(u); }catch(e){ age=(u.birthdate?_ageRevolu(u.birthdate):null); }
  if(!(age!=null&&age>0)) return false;
  const bl=((u.bilans)||[]).filter(b=>b&&b.date).slice().sort((x,y)=>x.date-y.date);
  const der=bl[bl.length-1]||{};
  return !!(u.gender||u._evol_gender||der['deb-gender']);
}
let _identiteSuite=null,_naissanceSuite=null;
function demanderIdentite(motif,apres){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(identiteComplete(u)) return true;   // meme contrat : on ne rejoue pas l'appelant
  _identiteSuite=(typeof apres==='function')?apres:null;
  const z=document.getElementById('id-motif');
  if(z) z.textContent=IDENTITE_MOTIFS[motif]||IDENTITE_MOTIFS.defaut;
  const a=document.getElementById('id-fname'); if(a) a.value=u.fname||'';
  const b=document.getElementById('id-lname'); if(b) b.value=u.lname||'';
  const e=document.getElementById('id-err'); if(e) e.style.display='none';
  go('s-identite');
  return false;
}
function validerIdentite(){
  const fn=String(document.getElementById('id-fname')?.value||'').trim().slice(0,40);
  const ln=String(document.getElementById('id-lname')?.value||'').trim().slice(0,40);
  const e=document.getElementById('id-err');
  if(!fn||!ln){
    if(e){ e.style.display=''; e.textContent='Renseigne ton prénom et ton nom.'; }
    return;
  }
  // Ni l'un ni l'autre n'est une donnee de sante : ils s'ecrivent sans passer
  // par le verrou de l'article 9, et _sansSante les laisse traverser.
  currentUser.fname=fn; currentUser.lname=ln;
  saveUser();
  const suite=_identiteSuite; _identiteSuite=null;
  if(typeof suite==='function'){ try{ suite(); }catch(err){} }
  else { try{ routeUser(); }catch(err){} }
}
function passerIdentite(){
  _identiteSuite=null;
  try{ routeUser(); }catch(e){ go('s-client-home'); }
}
// ⚠ LE CONSENTEMENT SANTE PASSE D'ABORD. L'age est nomme donnee de sante par
// le texte meme de la case, et l'ecrire sans accord ferait exactement ce que
// le verrou interdit. Les deux questions s'enchainent au lieu de se melanger :
// d'abord l'accord, ensuite la donnee.
function demanderNaissanceGenre(motif,apres){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(naissanceComplete(u)) return true;   // meme contrat
  // ⚠ L'ACCORD SANTE D'ABORD : l'age est nomme donnee de sante par le texte
  // meme de la case. Si l'accord manque, la question de l'accord s'affiche, et
  // c'est ELLE qui ouvrira l'ecran de naissance ensuite — d'ou la reprise
  // passee en `apres`. Si l'accord est la, on enchaine directement.
  if(!demanderConsentementSante('age',()=>_ouvrirNaissance(motif,apres))) return false;
  _ouvrirNaissance(motif,apres);
  return false;                           // l'ecran est ouvert : le geste est suspendu
}
function _ouvrirNaissance(motif,apres){
  _naissanceSuite=(typeof apres==='function')?apres:null;
  const z=document.getElementById('nai-motif');
  if(z) z.textContent=NAISSANCE_MOTIFS[motif]||NAISSANCE_MOTIFS.defaut;
  const b=document.getElementById('nai-birthdate');
  if(b){ b.value=currentUser.birthdate||''; }
  const g=document.getElementById('nai-gender');
  if(g) g.value=currentUser.gender||'';
  const e=document.getElementById('nai-err'); if(e) e.style.display='none';
  try{ _initBirthdateMax(); }catch(e){}
  go('s-naissance');
}
// ⚠ LE CONTROLE DES 16 ANS REVOLUS, DEPLACE DEPUIS doRegister ET INCHANGE.
// Meme constante, meme bornes, meme message. C'est la seule porte par
// laquelle une date de naissance entre dans un dossier depuis cet ecran.
function validerNaissanceGenre(){
  const e=document.getElementById('nai-err');
  const dire=m=>{ if(e){ e.style.display=''; e.textContent=m; } };
  const bd=String(document.getElementById('nai-birthdate')?.value||'').trim();
  const gn=String(document.getElementById('nai-gender')?.value||'').trim();
  if(!bd) return dire('Renseigne ta date de naissance.');
  const age=_ageRevolu(bd);
  if(age===null||age<0||age>120) return dire('Date de naissance invalide.');
  if(age<AGE_MINIMUM)
    return dire('RepCore demande d\'avoir '+AGE_MINIMUM+' ans révolus. '
      +'L\'application traite des données de santé, et le consentement d\'un '
      +'mineur plus jeune ne peut pas être recueilli ici.');
  if(!gn) return dire('Sélectionne ton genre : il sert au calcul de tes repères énergétiques et de ta masse grasse.');
  // Le consentement sante a ete recueilli par demanderNaissanceGenre AVANT
  // l'ouverture de cet ecran : cette ecriture-ci est donc couverte. Si elle ne
  // l'etait pas, _sansSante la couperait et le dirait en console — c'est la
  // seconde ligne, et elle ne doit jamais avoir a servir.
  currentUser.birthdate=bd; currentUser.age=age; currentUser.gender=gn;
  saveUser();
  const suite=_naissanceSuite; _naissanceSuite=null;
  if(typeof suite==='function'){ try{ suite(); }catch(err){} }
  else { try{ routeUser(); }catch(err){} }
}
function passerNaissance(){
  _naissanceSuite=null;
  try{ routeUser(); }catch(e){ go('s-client-home'); }
}
let _santeSuite=null;
// ⚠ LE CONTRAT, ET IL N'EST PAS NEGOCIABLE : quand l'accord EST la, la porte
// rend true et NE JOUE PAS `apres`. L'appelant continue en ligne — c'est
// l'idiome `if(!demanderConsentementSante(...)) return;`.
//
// La premiere version jouait `apres` dans les deux cas. Comme `apres` est
// presque toujours l'appelant lui-meme — la facon de reprendre le geste apres
// la question — elle se rappelait, retrouvait l'accord, se rappelait encore :
// « Maximum call stack size exceeded », et 3 900 assertions emportees avec.
//
// `apres` ne sert QU'A REPRENDRE, une fois la question posee et repondue.
function demanderConsentementSante(motif,apres){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(aConsentiSante(u)) return true;
  _santeSuite=(typeof apres==='function')?apres:null;
  _ouvrirConsentementSante(motif);
  return false;
}
function _ouvrirConsentementSante(motif){
  const z=document.getElementById('cs-motif');
  if(z) z.textContent=SANTE_MOTIFS[motif]||SANTE_MOTIFS.poids;
  const c=document.getElementById('cs-health');
  if(c) c.checked=false;                 // JAMAIS PRE-COCHEE. Article 9.2.a.
  const e=document.getElementById('cs-err');
  if(e) e.style.display='none';
  // Un compte qui avait deja consenti sous une politique ANTERIEURE le voit
  // dit : il ne decouvre pas une question qu'il croyait avoir reglee.
  const r=document.getElementById('cs-rappel');
  if(r) r.style.display=(currentUser&&currentUser.consent&&currentUser.consent.health===true)?'':'none';
  go('s-consent-sante');
}
function accepterConsentementSante(){
  const c=document.getElementById('cs-health');
  const e=document.getElementById('cs-err');
  if(!c||!c.checked){
    if(e){ e.style.display=''; e.textContent='Coche la case pour continuer, ou reviens en arrière : rien ne sera enregistré.'; }
    return;
  }
  // ⚠ ON N'ECRIT QUE `health`. `cgu` garde la valeur qu'il avait — il a ete
  // recueilli a l'inscription, par un autre geste, et le reecrire ici
  // reviendrait a deduire un consentement de l'autre.
  const av=(currentUser.consent&&typeof currentUser.consent==='object')?currentUser.consent:{};
  currentUser.consent=Object.assign({},av,{health:true,healthAt:Date.now(),
    policyVersion:POLICY_VERSION});
  saveUser();
  const suite=_santeSuite; _santeSuite=null;
  try{ rcm('health_consent_granted'); }catch(e){}
  if(typeof suite==='function'){ try{ suite(); }catch(err){} }
  else { try{ routeUser(); }catch(err){} }
}
function refuserConsentementSante(){
  _santeSuite=null;
  // RIEN N'EST ECRIT, et c'est dit. Un refus n'est pas un echec : il ramene
  // simplement la ou on etait.
  try{ routeUser(); }catch(e){ go('s-client-home'); }
}
// ⚠ CETTE PORTE-CI NE REGARDE PLUS QUE LES CGU, et c'est la consequence
// directe du deplacement du consentement sante.
//
// Elle commande _proposerReconsentement, dont la seule autre issue est la
// deconnexion : elle BLOQUE l'application. Tant que le consentement sante
// etait recueilli a l'inscription, exiger les deux ici etait juste. Depuis
// qu'il est recueilli au premier usage, l'exiger ici bloquerait tout compte
// neuf sur une question que le produit n'a pas encore eu de raison de poser
// — exactement ce que ce lot supprime.
//
// LE CONSENTEMENT SANTE N'EST PAS ABANDONNE POUR AUTANT : aConsentiSante le
// verifie, VERSION COMPRISE, avant chaque ecriture de donnee de sante, et la
// porte le redemande a ce moment-la. Un texte qui change redemande donc les
// deux accords — l'un tout de suite parce qu'il conditionne l'usage, l'autre
// au premier geste qui le concerne.
function _consentementAJour(u){
  const c=u&&u.consent;
  return !!(c&&c.cgu&&c.policyVersion===POLICY_VERSION);
}
function _proposerReconsentement(){
  if(!currentUser||_consentementAJour(currentUser)) return;
  if(document.getElementById('rc-consent-modal')) return;   // idempotent
  const dejaVu=!!(currentUser.consent&&currentUser.consent.policyVersion);
  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div id="rc-consent-modal" onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h2 style="font-size:var(--fs-lg);margin-bottom:8px">${dejaVu?'La politique de confidentialité a changé':'Ton accord est nécessaire'}</h2>
    <p class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:16px">${dejaVu
      ?'Le texte que tu avais accepté a été modifié. Relis-le et confirme ton accord pour continuer.'
      :'Ton compte a été créé avant que ces deux accords soient recueillis séparément. Confirme-les pour continuer.'}</p>
    <div style="display:flex;align-items:flex-start;gap:10px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-2)">
      <input type="checkbox" id="rc-cgu" style="margin-top:2px;flex-shrink:0;accent-color:var(--red);width:16px;height:16px;cursor:pointer">
      <label for="rc-cgu" style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6;cursor:pointer">J'ai lu et j'accepte la <a href="../privacy.html" target="_blank" rel="noopener" style="color:var(--red-text);text-decoration:underline;font-weight:600">politique de confidentialité</a> et les <a href="../legal.html" target="_blank" rel="noopener" style="color:var(--red-text);text-decoration:underline;font-weight:600">mentions légales</a>.</label>
    </div>
    <!-- PAS DE CASE SANTE ICI. Cette modale bloque l'application : y
         remettre le consentement sante le rendrait de fait obligatoire pour
         ouvrir l'app, ce qui est precisement ce que le deplacement supprime.
         Il est redemande par s-consent-sante, au premier geste qui le
         concerne, version du texte comprise. -->
    <div id="rc-consent-err" style="color:var(--red-light);font-size:var(--fs-sm);margin-top:10px;display:none"></div>
    <button class="btn btn-red" style="margin-top:14px" onclick="_validerReconsentement()">Confirmer mon accord</button>
    <!-- Pas de « plus tard » : un traitement de donnees de sante sans accord en
         cours de validite ne doit pas continuer. La seule autre issue est de se
         deconnecter, ce qui laisse le compte intact. -->
    <button class="btn btn-outline" style="margin-top:10px" onclick="logout()">Se déconnecter</button>
  </div></div>`;
  closeModal();
  document.body.insertAdjacentHTML('beforeend',html);
}
function _validerReconsentement(){
  const cgu=document.getElementById('rc-cgu')?.checked;
  const err=document.getElementById('rc-consent-err');
  if(!cgu){
    if(err){err.style.display='';
      err.textContent='Accepte la politique de confidentialité et les mentions légales pour continuer.';}
    return;
  }
  // ⚠ `health` EST REPORTE TEL QUEL, jamais remis a true : deduire l'accord
  // sante de l'accord CGU serait exactement la fusion que l'article 9
  // interdit. Un compte qui avait consenti sous une politique anterieure
  // garde `health:true` — ses donnees existantes restent legitimes — et
  // aConsentiSante, qui lit la version, redemandera avant la prochaine
  // ecriture de sante.
  const _av=(currentUser.consent&&typeof currentUser.consent==='object')?currentUser.consent:{};
  currentUser.consent=Object.assign({},_av,{cgu:true,at:Date.now(),
    policyVersion:POLICY_VERSION});
  const users=DB.get('users')||{};
  users[currentUser.email]=currentUser;
  const ok=DB.set('users',users)&&DB.set('session',currentUser);
  const envoi=CLOUD.pushOne(currentUser.email,currentUser);
  closeModal();
  toastSync(ok,envoi,'Accord enregistré '+ICO.coche,'ton accord est');
}
function _peutImporterPkg(a){
  return !!(a&&currentUser&&(currentUser.role==='coach'||currentUser.email===a.email));
}
function _proposerImportAthlete(){
  const a=window._pendingAthletePkg;
  // Idempotent : routeUser() peut être appelé deux fois (démarrage puis
  // connexion) et ne doit pas empiler deux modales.
  if(!a||document.getElementById('rc-pkg-modal')) return;
  // Le consentement passe avant : sa modale ne doit pas etre recouverte.
  if(document.getElementById('rc-consent-modal')) return;
  // Pas qualifié : on ne propose rien et on ne jette rien non plus — si un
  // coach se connecte ensuite sur le même onglet, routeUser() repassera ici.
  if(!_peutImporterPkg(a)) return;
  const d=_diffAthletePkg(a);
  const nom=((a.fname||'')+' '+(a.lname||'')).trim();
  // Tous ces champs viennent de l'URL : échappés sans exception.
  const nomAff=escapeHtml(nom||a.email);
  // Tout ce que l'import DÉTRUIRAIT, en une seule liste : c'est la partie que
  // le décompte au-dessus ne dit pas, et la seule qui soit irréversible.
  const degats=[];
  if(d.connu&&d.seances<d.seancesExistantes)
    degats.push((d.seancesExistantes-d.seances)+' séance'+((d.seancesExistantes-d.seances)>1?'s':''));
  degats.push(...d.ecrase);
  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div id="rc-pkg-modal" onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <h2 style="font-size:var(--fs-lg)">Importer un profil ?</h2>
      <button onclick="_refuserImportAthlete()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">${icon('croix',14)}</button>
    </div>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:14px;line-height:1.6">Ce lien contient un profil d'athlète. Il n'a rien enregistré pour l'instant.</p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px;margin-bottom:14px">
      <div style="font-weight:800;color:var(--text);font-size:var(--fs-md)">${nomAff}</div>
      <div class="sub" style="font-size:var(--fs-xs);margin-bottom:10px">${escapeHtml(a.email)}</div>
      <div style="font-size:var(--fs-sm);color:#bbb;line-height:1.9">
        ${d.bilansNouveaux} nouveau${d.bilansNouveaux>1?'x':''} bilan${d.bilansNouveaux>1?'s':''}${d.bilansConserves?(d.bilansConserves>1?' (les '+d.bilansConserves+' déjà enregistrés sont conservés)':' (le bilan déjà enregistré est conservé)'):''}<br>
        ${d.seances} séance${d.seances>1?'s':''}${d.connu?' : remplacera les '+d.seancesExistantes+' actuellement enregistrée'+(d.seancesExistantes>1?'s':''):''}
      </div>
    </div>
    ${degats.length?`<p style="font-size:var(--fs-sm);color:var(--orange);line-height:1.6;margin-bottom:14px">L'import supprimerait ${degats.join(', ')}. C'est irréversible.</p>`:''}
    ${d.connu?'':'<p class="sub" style="font-size:var(--fs-xs);margin-bottom:14px;line-height:1.6">Aucun dossier ne porte encore cet email : l\'import créerait une nouvelle fiche.</p>'}
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:16px;line-height:1.6">N'importe qui peut fabriquer un lien de ce type. N'accepte que s'il vient de ton élève.</p>
    <button class="btn btn-red" onclick="_confirmerImportAthlete()">Importer ce profil</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="_refuserImportAthlete()">Refuser</button>
  </div></div>`;
  // closeModal() et non un remove() direct : lui seul annule un enregistrement
  // audio en cours, que le remove laisserait tourner micro ouvert.
  closeModal();
  document.body.insertAdjacentHTML('beforeend',html);
  // Sert à la restaurer si un rafraîchissement de fond la balaie (voir go()).
  window._pkgDejaProposee=true;
}
function _refuserImportAthlete(){
  window._pendingAthletePkg=null;
  window._pkgDejaProposee=false;
  closeModal();
  toast('Import ignoré : rien n\'a été modifié.');
}
// Seul point d'écriture de tout le mécanisme.
function _confirmerImportAthlete(){
  const athlete=window._pendingAthletePkg;
  if(!athlete) return;
  // Redit ici, et pas seulement à l'affichage : cette fonction est le point
  // d'écriture, et elle est atteignable autrement que par le bouton.
  if(!_peutImporterPkg(athlete)){closeModal();return;}
  // Consommé AVANT l'écriture : un double clic ne doit pas pousser deux fois.
  window._pendingAthletePkg=null;
  window._pkgDejaProposee=false;
  const users=DB.get('users')||{};
  const existing=users[athlete.email]||{};
  // Fusionner les bilans : ajouter les nouveaux sans écraser les existants
  const exBilans=existing.bilans||[];
  const newBilans=athlete.bilans||[];
  const merged=[...exBilans];
  newBilans.forEach(nb=>{
    if(!merged.find(eb=>eb.date===nb.date&&eb.type===nb.type)) merged.push(nb);
  });
  merged.sort((a,b)=>a.date-b.date);
  users[athlete.email]=Object.assign({},existing,athlete,{bilans:merged,_fromCode:false});
  const okMaj=DB.set('users',users);
  const envoiMaj=CLOUD.pushOne(athlete.email,users[athlete.email]);
  window._importedAthlete=athlete;
  const nb=newBilans.filter(nb=>!exBilans.find(eb=>eb.date===nb.date&&eb.type===nb.type)).length;
  closeModal();
  toastSync(okMaj,envoiMaj,
    ICO.coche+' '+((athlete.fname||'')+' '+(athlete.lname||'')).trim()+' mis à jour'+(nb?' : '+nb+' nouveau'+(nb>1?'x':'')+' bilan'+(nb>1?'s':''):'')+'.',
    'la mise à jour est');
  // Sans ça, l'athlète importé n'apparaît sur le tableau de bord qu'à la sync
  // suivante, jusqu'à 30 secondes plus tard.
  if(currentUser?.role==='coach'&&document.getElementById('s-coach-home')?.classList.contains('active')) loadCoachHome();
}

let currentUser=null,currentClientId=null;
// ── Contexte unique de l'editeur d'exercices (ecran s-coach-program) ──────────
// Remplace les anciens drapeaux _editProgTemplateSessionIdx / _editingCoachSessionIdx
// / _editingSessionIdx, qui pouvaient rester positionnes et faire ecrire la
// sauvegarde dans la mauvaise cible (ex. modele au lieu de l'athlete).
// Chaque point d'entree ecrit le contexte EN ENTIER ; saveProgram() le lit via switch.
//   mode 'template'      : coach edite une seance d'un modele H/F  (+progIdx, gender, sessionIdx)
//   mode 'coachClient'   : coach edite une seance d'un athlete      (+sessionIdx)
//   mode 'athlete'       : l'athlete edite sa propre seance         (+sessionIdx)
//   mode 'clientProgram' : coach edite le programme d'un athlete
let _progEditorCtx={mode:'clientProgram'};
// N1.12 — L'EDITEUR D'EXERCICES S'ELARGIT POUR LE COACH, JAMAIS POUR
// L'ATHLETE. C'est l'ecran ou le coach passe le plus de temps, et il y
// travaillait en colonne de 480 px sur un moniteur de 1440 — parce qu'un
// athlete y entre AUSSI, pour composer sa propre seance, et que la regle
// « ecrans athlete : rien ne change » interdisait de l'elargir sur son seul
// identifiant.
// Le contexte etait deja distingue en memoire ; il est simplement POSE sur
// l'ecran, ou une requete de media peut le lire. Rien ne change pour
// l'athlete : mode vaut alors 'clientProgram', et l'attribut est retire.
function _majCtxEditeur(){
  try{
    const e=document.getElementById('s-coach-program');
    if(!e) return;
    const m=(_progEditorCtx&&_progEditorCtx.mode)||'';
    if(m==='coachClient'||m==='template') e.setAttribute('data-ctx','coach');
    else e.removeAttribute('data-ctx');
  }catch(err){}
}
// Index de seance uniquement quand l'athlete edite la sienne (photo2 localStorage, OCR)
function _athleteSessionIdx(){
  return _progEditorCtx.mode==='athlete'&&typeof _progEditorCtx.sessionIdx==='number'
    ? _progEditorCtx.sessionIdx : null;
}
let woState={exercises:[],currentEx:0,startTime:null,timerInterval:null,sessionData:{}};

// ── Réseau ──────────────────────────────────────────────────────────────────
// LES DEUX INDICATEURS DU HAUT DE L'ÉCRAN SONT PARTIS (demande du 20/08/2026) :
// la bande pleine largeur « Hors ligne… / Synchronisé ✓ » et la ligne
// « ● Synchronisé » sous le nom de l'athlète. Les écouteurs, eux, restent —
// c'est eux qui annulent la relance en attente et repoussent les données dès le
// retour du réseau, et ils n'affichaient rien par eux-mêmes.
// CE QUE ÇA COÛTE : hors ligne, plus rien ne dit à l'athlète que ses données
// sont en attente d'envoi. Les badges du coach, eux, subsistent.
window.addEventListener('offline',()=>{
  CLOUD._setSyncStatus(false);
});
// ── « n envois en attente », RETABLI (30/09/2026) ─────────────────────────
// Le commentaire ci-dessus le reconnaissait : hors ligne, plus rien ne disait a
// l'athlete que ses donnees attendaient. Une pastille discrete, seulement
// quand la file n'est pas vide, et seulement cote athlete (le coach a ses
// badges). Elle se met a jour a chaque ecriture de la file.
// ══ LE RAPPEL « VÉRIFIE TON ADRESSE » (01/10/2026) ══════════════════════════
// Discret, cote athlete, tant que le jeton dit email_verified:false. Le jeton
// ne change qu'a son renouvellement : « C'est fait » le force. Des que
// l'adresse est verifiee, le Worker en est prevenu UNE fois (emailVerifie) :
// c'est lui, et lui seul, qui note la verification pour le parrainage.
const RAPPEL_VERIF_CLE='rc_verif_envoye';
const VERIF_SIGNALEE_CLE='rc_verif_signalee';
function _majRappelVerification(){
  let z=document.getElementById('rc-verif');
  const u=(typeof currentUser==='object'&&currentUser)||null;
  const athlete=!!(u&&u.email&&u.role!=='coach');
  const v=(athlete&&CLOUD.emailVerifieDuJeton)?CLOUD.emailVerifieDuJeton():null;
  if(v===true){
    try{
      const deja=localStorage.getItem(VERIF_SIGNALEE_CLE)||'';
      if(deja!==String(u.email).toLowerCase())
        CLOUD._callFn('emailVerifie',{}).then(()=>{ try{ localStorage.setItem(VERIF_SIGNALEE_CLE,String(u.email).toLowerCase()); }catch(e){} }).catch(()=>{});
    }catch(e){}
  }
  if(v!==false){ if(z) z.hidden=true; return false; }
  if(!z){
    z=document.createElement('div');
    z.id='rc-verif'; z.className='rc-verif'; z.setAttribute('role','status');
    z.innerHTML='<span>'+icon('mail',14)+' Vérifie ton adresse e-mail</span>'
      +'<button type="button" data-v="fait">C’est fait</button><button type="button" data-v="renvoyer">Renvoyer</button>';
    z.addEventListener('click',async e=>{
      const b=e.target&&e.target.closest?e.target.closest('button[data-v]'):null;
      if(!b) return;
      if(b.dataset.v==='renvoyer'){
        const ok=await CLOUD.envoyerVerificationEmail();
        toast(ok?'Lien renvoyé : regarde ta boîte mail (et les indésirables).':'Envoi impossible pour le moment : réessaie plus tard.',ok?'var(--green)':'var(--orange)');
      } else {
        CLOUD._tokenExpiry=0;
        try{ await CLOUD._getToken(); }catch(err){}
        if(CLOUD.emailVerifieDuJeton()!==true) toast('Pas encore vérifiée : ouvre le lien reçu par e-mail.','var(--orange)');
        _majRappelVerification();
      }
    });
    document.body.appendChild(z);
  }
  z.hidden=false;
  return true;
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ try{ _majRappelVerification(); }catch(e){} } });
function _majIndicAttente(){
  let n=0; try{ n=CLOUD.enAttenteDeSync(); }catch(e){ n=0; }
  let z=document.getElementById('rc-attente');
  const athlete=!!(typeof currentUser==='object'&&currentUser&&currentUser.email&&currentUser.role!=='coach');
  if(!n||!athlete){ if(z) z.hidden=true; return 0; }
  if(!z){
    z=document.createElement('div');
    z.id='rc-attente'; z.className='rc-attente';
    z.setAttribute('role','status'); z.setAttribute('aria-live','polite');
    document.body.appendChild(z);
  }
  z.textContent='↻ '+n+' envoi'+(n>1?'s':'')+' en attente';
  z.hidden=false;
  return n;
}
// LE SERVICE WORKER DEMANDE DE VIDER LA FILE (Background Sync, voir _syncFond).
try{
  if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',ev=>{
    if(ev&&ev.data&&ev.data.rc==='vider-file'&&CLOUD.enAttenteDeSync()>0) CLOUD.viderFile().catch(()=>{});
  });
}catch(e){}
window.addEventListener('online',async()=>{
  // Le réseau est revenu : renvoyer maintenant, sans attendre le prochain
  // palier de _queueRetry qui peut être à dix minutes.
  CLOUD._annulerRetry();
  try{
    if(currentUser?.email){
      const u=(DB.get('users')||{})[currentUser.email]||currentUser;
      await CLOUD._doPushOne(currentUser.email,u);
    }
    if(CLOUD.enAttenteDeSync()>0) await CLOUD.viderFile();
  }catch(e){
    // Réseau annoncé revenu mais serveur injoignable : _doPushOne a déjà réarmé
    // la relance. Il n'y a plus rien à afficher, mais l'état interne, lui, doit
    // rester faux — sans quoi les badges du coach mentiraient.
    CLOUD._setSyncStatus(false);
  }
});

// ======= BOOT =======
window.onload=()=>{
  // Les prix affichés en clair viennent de la table, pas du balisage.
  _majPrixAffiches();
  // Et la promesse d'essai vient de PROMESSE_ATHLETE, pas du balisage non
  // plus : meme mecanique, meme raison. Trois textes en dur auraient fini par
  // annoncer trois essais differents le jour ou ESSAI_SEANCES change.
  _poserPromesseAthlete();
  // L'app peut démarrer hors ligne : l'événement `offline` ne se déclenchera
  // pas, il n'y a pas de transition.
  document.querySelectorAll('#client-tabbar .tab-btn[data-icon]').forEach(b=>b.insertAdjacentHTML('afterbegin',icon(b.dataset.icon,19)));
  // APRÈS l'injection des icônes : elles font la moitié de la hauteur de la
  // barre. Mesurer avant donnerait une valeur trop basse, et le dernier
  // élément de chaque page passerait sous la barre.
  _majHauteurTabbar();
  // Les polices arrivent après ce point et rehaussent la barre de 2px : sans
  // cette reprise, la compensation resterait courte d'autant.
  if(document.fonts?.ready) document.fonts.ready.then(_majHauteurTabbar).catch(()=>{});
  // La hauteur bouge avec la largeur (à 340px les libellés se réorganisent) et
  // avec la zone sûre en rotation.
  window.addEventListener('resize',_majHauteurTabbar);
  window.addEventListener('orientationchange',()=>setTimeout(_majHauteurTabbar,150));
  // MEME RAISON POUR LA BANNIERE : sous 380px son texte passe sur deux lignes
  // et elle grandit de 17px. Une rotation change cette largeur.
  window.addEventListener('resize',_majHauteurBanniere);
  window.addEventListener('orientationchange',()=>setTimeout(_majHauteurBanniere,150));
  // Mêmes mécanique et source que ci-dessus, pour les deux cartes de rôle de
  // l'inscription : le conteneur .role-icon avait perdu son glyphe et laissait
  // 40px de vide au-dessus de « COACH » et « ATHLÈTE ». Passer par ICONS plutôt
  // que réinliner un SVG garde une seule définition par pictogramme.
  document.querySelectorAll('.role-icon[data-icon]').forEach(e=>{e.innerHTML=icon(e.dataset.icon,36);});
  // LES ICONES D'INDEX.HTML (01/10/2026) : la page statique ne peut pas appeler
  // icon(). Ses anciens emojis sont devenus <span data-ico="croix"
  // data-taille="14">, remplis ici d'apres le meme jeu ICONS.
  document.querySelectorAll('[data-ico]').forEach(e=>{e.innerHTML=icon(e.dataset.ico,Number(e.dataset.taille)||14);});
  // Onglets de catégorie caféine : même principe, une seule définition
  // d'icône (CAFF_ICONES) partagée entre les onglets, les tuiles produit et
  // la liste des prises.
  document.querySelectorAll('.caff-tab-ico[data-caff]').forEach(e=>{e.innerHTML=caffIcone(e.dataset.caff,14);});
  CLOUD._loadAuth();
  _initBirthdateMax();
  // Purge AVANT toute écriture de la session : c'est ce qui libère la place
  // pour le bilan que l'utilisateur s'apprête à remplir. Synchrone et bornée à
  // un balayage des clés — aucun dataURL n'est relu.
  try{
    const _purges=purgerPhotosAnciennes();
    if(_purges) console.info('[RepCore] '+_purges+' cache(s) photo périmé(s) supprimé(s)');
  }catch(e){}
  // Reprise des envois restés en échec lors de la session précédente. Différée :
  // l'accueil doit s'afficher d'abord, la file est une tâche d'arrière-plan.
  setTimeout(()=>{CLOUD.viderFile().catch(()=>{});},3000);
  // ET LA FILE DES MEDIAS A DETRUIRE CHEZ L'HEBERGEUR, plus tard encore :
  // elle depend d'un jeton, et rien ne presse. Une suppression que l'app n'a
  // pas pu faire au moment du geste ne doit pas rester en plan indefiniment —
  // ni couter une requete a chaque ouverture quand le service est absent.
  setTimeout(()=>{ try{ cldFileRejouer().catch(()=>{}); }catch(e){} },9000);
  // ET LA RETENTION, apres tout le reste. Elle detruit des fichiers : elle ne
  // passe donc jamais avant que l'app soit debout, jamais pendant une seance,
  // et jamais sans que le preavis ait ete rendu au moins une fois (c'est
  // `preavisVuLe` qui l'atteste, pose au rendu de la liste des videos).
  setTimeout(()=>{ try{ retentionAuDemarrage().catch(()=>{}); }catch(e){} },14000);
  // LES PHOTOS DE BILAN RESTEES EN BASE64, par paquets de six, une fois l'app
  // debout. Elles ne sont PAS perdues si l'envoi echoue : le document garde sa
  // chaine, et le prochain demarrage reessaie. C'est pour cela que ce passage
  // peut tourner sans filet.
  setTimeout(()=>{ try{
    photosBilanMigrer(currentUser,{max:6}).then(r=>{
      if(r&&r.faites) { saveUser(); CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{});
        console.log('[RepCore] photos de bilan sorties du document : '+r.faites
          +' ('+Math.round(r.octets/1024)+' Ko), '+r.restantes+' restante(s)'); }
    }).catch(()=>{})
    // Puis celles dont l'envoi avait échoué : le blob est ici, le coach attend.
    .then(()=>photosBilanRenvoyer(currentUser,{max:6})).then(r=>{
      if(r&&r.faites){ saveUser(); CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{});
        console.log('[RepCore] photos de bilan renvoyées : '+r.faites+', '+r.restantes+' restante(s)'); }
    }).catch(()=>{});
  }catch(e){} },18000);
  // UN SEUL INSTANT DE DEPART. Le voile et l'eclair partaient a l'analyse du
  // HTML, le logo en JS a la toute fin du demarrage — l'eclair frappait donc
  // AVANT que le logo n'apparaisse, et l'ecart grandissait avec la lenteur de
  // l'appareil. Les cinq animations sont posees dans la MEME frame. Les retards
  // de 0,05 s disparaissent : ils attendaient une peinture qui a deja eu lieu.
  const logoAnim=document.getElementById('splash-logo-anim');
  if(logoAnim){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      try{
        const _f=document.getElementById('splash-flash');
        const _b=document.querySelector('#s-splash g[data-bolt]');
        const _h=document.getElementById('splash-halo');
        const _l=document.getElementById('splash-line');
        const _m=document.getElementById('splash-word');
        if(_f) _f.style.animation='screenFlash var(--t-3) var(--c-out) both';
        if(_b) _b.style.animation='boltFlash var(--t-4) var(--c-out) both';
        // IDEMPOTENT (01/10/2026) : le logo et le halo sont deja animes par le
        // CSS critique d'index.html, des la premiere peinture. Relancer leur
        // animation ici les ferait reflasher. On ne la pose que s'il n'y en a
        // aucune (une page servie sans ce CSS, une copie ancienne en cache).
        const _sansAnim=el=>{ try{ return getComputedStyle(el).animationName==='none'; }catch(e){ return true; } };
        if(_sansAnim(logoAnim)) logoAnim.style.animation='rcStrike 420ms var(--c-out) both';
        if(_h&&_sansAnim(_h)) _h.style.animation='rcHalo 420ms var(--c-out) both';
        if(_l) _l.style.animation='splashLineIn var(--t-3) var(--c-out) 260ms both';
        if(_m) _m.style.animation='splashTextIn var(--t-2) var(--c-out) 340ms both';
      }catch(e){}
    }));
  }
  // LA SORTIE SUIT L'ANIMATION, pas l'horloge — avec un filet a 900 ms au cas
  // ou l'onglet passerait en arriere-plan : aucune frame n'est alors produite
  // et l'evenement n'arrive jamais.
  let _splashParti=false;
  const _quitterSplash=()=>{
    if(_splashParti) return; _splashParti=true;
    const splash=document.getElementById('s-splash');
    if(splash){splash.style.transition='opacity var(--t-2) var(--c-in)';splash.style.opacity='0';}
    setTimeout(()=>{
      const sess=DB.get('session');
      if(sess){
        currentUser=sess;
        // Données locales d'abord — la sync cloud se fait en arrière-plan (accueil instantané)
        const users=DB.get('users')||{};
        // FUSION ET NON REMPLACEMENT, la meme regle que la boucle de synchro,
        // qui la dit deja en toutes lettres. La carte des utilisateurs peut
        // avoir perdu un champ qu'une synchro maladroite a efface pendant que
        // la session, elle, le gardait : remplacer ferait gagner la version
        // amputee a chaque rechargement.
        // L'ordre compte : la carte est la reference — c'est elle que les
        // ecritures visent — et la session ne comble que ce qui y manque.
        if(users[currentUser.email]){
          const _sess=currentUser;
          currentUser=users[currentUser.email];
          for(const k in _sess)
            if(currentUser[k]===undefined&&_sess[k]!==undefined) currentUser[k]=_sess[k];
          // LES SEANCES QUE LA SESSION A GARDEES ET QUE LA CARTE A PERDUES
          // (quota plein au moment de l'ecriture) : reinjectees AVANT toute
          // ecriture, puis ecrites et poussees.
          try{
            if(reinjecterSeancesSession(currentUser,_sess)>0){
              currentUser.updatedAt=Date.now();
              users[currentUser.email]=currentUser;
              DB.set('users',users);
              DB.set('session',currentUser);
            }
          }catch(e){}
        }
        // age est une VUE de birthdate : figé à l'inscription, il annoncerait
        // encore 16 ans à quelqu'un qui en a 19. On le recalcule à chaque
        // démarrage quand la date de naissance est connue.
        // La correction est ÉCRITE, pas seulement posée en mémoire : la sync
        // cloud relit le stockage une seconde après le démarrage et rétablirait
        // sinon l'ancienne valeur — mesuré, l'âge revenait à 16 entre 1 et 2 s.
        // N'écrit qu'au changement réel, soit une fois par an et par compte.
        if(currentUser.birthdate){
          const _a=_ageRevolu(currentUser.birthdate);
          if(_a!==null&&_a!==currentUser.age){
            currentUser.age=_a;
            users[currentUser.email]=currentUser;
            DB.set('users',users);
            DB.set('session',currentUser);
          }
        }
        // ── LES DEUX ETAPES DE RETENTION ────────────────────────────
        // ICI, et pas ailleurs : c'est le seul endroit ou un demarrage avec un
        // compte deja ouvert passe a coup sur, et ou `currentUser` porte enfin
        // la fusion session + carte. Avant la fusion, `sessions` pouvait
        // manquer du cote lu, et un athlete qui s'entraine aurait ete compte
        // comme « jamais demarre ». Apres l'aiguillage, routeUser() a change
        // d'ecran — et ce qui suit un changement d'ecran finit un jour par ne
        // plus s'executer.
        // Elle se garde elle-meme : compte nouveau, compte sans date de
        // creation, journee deja comptee, elle ne fait rien.
        try{ rcmRetention(currentUser); }catch(e){}
        // Le statut ne gouverne QUE l'accès athlète : doRegister crée tout compte
        // en status:'FREE' et rien ne le change jamais pour un coach, qui serait
        // donc déconnecté à chaque rechargement. Aligné sur doLogin (l. ~3177).
        // Un athlète encore FREE n'est PAS un compte invalide : il vient de
        // s'inscrire et n'a pas encore saisi de code. Le déconnecter détruisait
        // son compte à chaque rechargement. On garde la session et on l'amène
        // à s-client-code, qui propose à la fois le code et les abonnements.
        if(!currentUser.email){
          // Session corrompue : là, et seulement là, la purge est justifiée.
          silentLogout();
          go('s-welcome');
        } else if(doitVoirLePaywall(currentUser)){
          allerApresEssai(currentUser);
        } else if(sessionStorage.getItem('rc_paypal_return')){
          // Retour depuis redirection PayPal → remettre sur la page paiement
          sessionStorage.removeItem('rc_paypal_return');
          goAvecRetour('s-subscribe');
          loadSubscribePage();
        } else {
          routeUser();
        }
        // Sync cloud en arrière-plan : rafraîchit l'écran si les données ont changé
        if(sess.email&&CLOUD.ok()){
          (async()=>{
            try{ await CLOUD.syncUser(sess.email); }catch(e){}
            const u2=(DB.get('users')||{})[sess.email];
            // Quota plein : rc_users est en retard sur la memoire, que syncUser
            // a deja fusionnee. La remplacer par u2 perdrait la seance.
            if(u2&&!(DB._echecLocal&&DB._echecLocal.users)){currentUser=u2;DB.set('session',currentUser);}
            // Même exclusion coach qu'au démarrage synchrone : sans elle le coach
            // atteint bien s-coach-home puis en est éjecté ~1s plus tard, à la fin
            // de la sync cloud.
            if(doitVoirLePaywall(currentUser)){
              // La sync de fond arrive ~1s après le boot : l'utilisateur peut
              // déjà être parti voir les abonnements ou remplir son inscription.
              // On ne le ramène que s'il est resté sur un écran d'accès.
              const _ec=document.querySelector('.screen.active')?.id;
              if(_ec!=='s-client-code'&&_ec!=='s-subscribe'&&_ec!=='s-register'&&_ec!=='s-essai-bilan')
                allerApresEssai(currentUser);
              return;
            }
            if(CLOUD.canWrite()){
              try{ saveUser(); }catch(e){ rcErreurMuette('_majIndicAttente',e); }
              // Push immédiat non-debounced pour garantir l'envoi des données locales (profil coach pré-v144)
              setTimeout(()=>{try{const u=DB.get('users');if(u) CLOUD._doPush(u);}catch{}},800);
            }
            if(currentUser.role==='athlete'&&document.getElementById('s-client-home')?.classList.contains('active')) loadClientHome();
            if(currentUser.role==='coach'&&document.getElementById('s-coach-home')?.classList.contains('active')) loadCoachHome();
          })();
        }
      } else if(window._importedCoach||invitationEnAttente(Date.now())){
        // CE BRAS NE VOIT QUE LE CAS SANS SESSION — il est dans le `else` de
        // `if(sess)`. Le cas AVEC session est traité plus bas, hors de cette
        // chaîne : il ne s'atteignait jamais ici, et un athlète déjà connecté
        // qui ouvrait le lien de son coach ne voyait donc rien du tout.
        // Ouverture directe du lien d'invitation. Un toast disparaissait avant
        // que l'athlète ait pu agir, et il devait retrouver puis ressaisir le
        // code lui-même. On ouvre l'accordéon, on pré-remplit, et la bannière
        // reste affichée : il ne lui reste qu'à valider.
        // 05/10/2026 : OU L'INVITATION GARDÉE (rc_invitation) — le lancement
        // depuis l'icône installée n'a plus l'URL. Jamais par s-welcome (la
        // page de vente) : l'athlète vient pour son coach.
        const _ie=invitationEnAttente(Date.now());
        const c=window._importedCoach||(_ie&&_ie.coach)||null;
        go('s-athlete-entry');
        window._importedCoach=null;
        setTimeout(()=>{
          const zone=document.getElementById('ae-code-zone');
          if(zone&&zone.style.display==='none') aeToggleCode();
          const inp=document.getElementById('ae-code');
          // LE CODE DU LIEN D'ABORD. `inv` porte le code d'accès RC-XXXX-XXXX,
          // celui qui vit dans /rc_codes et porte la durée. `c.code` est le code
          // GCP permanent du coach : il rattache, mais n'ouvre aucun accès daté.
          // Pré-rempli avec le second, la validation partait sur le mauvais
          // chemin et l'athlète obtenait un accès sans échéance.
          if(inp) inp.value=window._invitationCode||(_ie&&_ie.inv)||(c&&c.code)||'';
          const ban=document.getElementById('ae-coach-banner');
          if(ban){
            ban.textContent=c
              ?'Coach '+((c.fname||c.lname||'?').trim())+' reconnu : valide pour créer ton compte'
              :'Invitation reconnue : valide pour créer ton compte';
            ban.style.display='block';
          }
          // LE LIEN NE PORTE PLUS LE COACH (05/10/2026) : son nom vient du code.
          if(!c&&inp&&inp.value) try{ _aeBanniereDepuisCode(inp.value); }catch(e){}
        },350);
      } else {
        go(rcEcranDeDepart());
      }
      // ── L'INVITATION, SESSION DÉJÀ OUVERTE ────────────────────────────
      // Hors de la chaîne de `else` ci-dessus, et APRÈS son routage : le
      // traitement d'origine vivait dans un `else if` que la présence d'une
      // session rendait inatteignable. Quelqu'un qui a déjà l'app ouverte et
      // qui reçoit le lien de son coach — le cas le plus courant — arrivait
      // sur son accueil sans qu'aucun signe ne lui soit donné.
      //
      // On ANNONCE, on n'applique pas. Différé : le routage vient de changer
      // d'écran, et le champ à pré-remplir doit exister.
      if(window._importedCoach&&currentUser&&currentUser.role!=='coach'){
        const _ci=window._importedCoach;
        window._importedCoach=null;
        setTimeout(()=>{ try{ _annoncerInvitation(_ci); }catch(e){} },400);
      }
      // SYNC PÉRIODIQUE. La cadence vient de periodeSync() : 5 minutes
      // normalement, 30 au-delà de 85 % du quota. Le commentaire annonçait
      // encore « toutes les 30 secondes », une valeur qui n’a plus cours.
      //
      // setTimeout QUI SE REPLANIFIE, et non setInterval : ce dernier évalue
      // periodeSync() UNE SEULE FOIS au démarrage, si bien que le passage en
      // mode dégradé ne s’appliquait JAMAIS dans la session courante — c’est-à-
      // dire précisément tant que le quota continuait de se remplir.
      //
      // LA REPLANIFICATION EST DANS UN `finally`, ET NULLE PART AILLEURS.
      //
      // Elle était posée sur DEUX des QUATRE sorties. Les deux autres tuaient
      // la boucle : `if(_typing) return;` — un champ au focus à l’échéance —
      // et surtout `if(!_change) return;`, à l’intérieur du try, dont le
      // `return` sautait la replanification placée après le catch. Or
      // `_change` est faux dès que rien n’a bougé côté serveur, c’est-à-dire
      // le cas ORDINAIRE : la toute première échéance arrêtait la synchro de
      // fond pour toute la session, sans un mot.
      //
      // Le `finally` couvre toutes les sorties, y compris celles qu’on
      // ajoutera plus tard. Un seul point de replanification : en garder
      // d’autres replanifierait deux fois, et la période serait divisée.
      const _replanifierSync=()=>{
        try{ setTimeout(_tourSync,periodeSync()); }catch(e){}
      };
      const _tourSync=async()=>{
       try{
        // LE CHANGEMENT DE JOUR D’ABORD, et AVANT le garde de connexion : une
        // app hors ligne a la même horloge, et sa date doit suivre minuit.
        try{ _repeindreSiJourChange(); }catch(e){}
        if(!CLOUD.ok()||!currentUser) return;
        // Garde d'edition GLOBAL, en tete : proteger le seul re-render ne
        // suffit pas, car la synchro elle-meme remplace currentUser sous les
        // doigts de l'utilisateur. Tant qu'un champ a le focus, on ne touche
        // a rien — le reveil suivant s'en chargera.
        const _typing=document.activeElement
          && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if(_typing) return;
        // Corps entierement garde : une exception dans un callback async
        // n'est rattrapee par personne et tue l'intervalle definitivement.
        // L'app cessait de se synchroniser jusqu'au rechargement.
        try{
          // syncUser renvoie desormais s'il y a eu un changement REEL. Sans ce
          // signal, on repeignait l'ecran toutes les 30 s pour rien : loadCoachHome
          // et loadClientHome refont tout le rendu, et go() ferme au passage les
          // modales ouvertes.
          let _change=await CLOUD.syncUser(currentUser.email);
          // Rafraîchir currentUser
          const u2=(DB.get('users')||{})[currentUser.email];
          if(u2){
            // Fusion et non remplacement : currentUser porte des champs de
            // travail que le distant ignore. Le remplacer les effaçait au
            // milieu d'une interaction.
            Object.assign(currentUser,u2);DB.set('session',currentUser);
          }
          // La correction du coach vient d'atterrir dans le dossier de l'athlète.
          // Les trois couches sont remises à jour dans la foulée : notification
          // système, pastille d'onglet, et liste d'accueil si elle est à l'écran.
          if(currentUser.role==='athlete'){
            checkFeedbackNotif();
            _majPastilleVideos();
            // Meme traitement pour la reponse au bilan : elle arrive par la
            // meme synchro, dans le meme dossier.
            checkReponseBilanNotif();
            _majPastilleBilan();
            if(document.getElementById('s-client-home')?.classList.contains('active')) renderNotifs();
          }
          // ⚠ LE COACH NE REDESCENDAIT QUE SON PROPRE DOSSIER (corrige au
          //   build 1412). Mesure au banc a deux appareils : l'athlete bouge son
          //   total de −20, son dossier part au serveur, et la fiche ouverte chez
          //   le coach continue d'afficher l'ancien chiffre — indefiniment. Seul
          //   un retour d'arriere-plan (_descenteAuRetour → syncRelevantUsers)
          //   allait le chercher. C'est la meme cecite que celle corrigee au 1407
          //   cote athlete, vue de l'autre bord.
          //
          //   ON NE DESCEND QUE CE QU'IL REGARDE : la fiche ouverte, et rien
          //   d'autre. Un coach de trente athletes ne doit pas payer trente
          //   requetes toutes les cinq minutes pour un ecran qui n'en montre
          //   qu'un. Le tableau de bord, lui, garde son rythme d'avant — il se
          //   remet a jour au retour au premier plan, ou quand le coach ouvre
          //   une fiche.
          //
          //   AVANT LES RENDUS, comme la synchro du dossier du coach juste
          //   au-dessus : c'est ce qui fait que _change couvre ce dossier-la et
          //   que la fiche se repeint dans le meme tour.
          if(currentUser.role==='coach'&&currentClientId
             &&document.getElementById('s-coach-client')?.classList.contains('active')){
            let _em=null;
            try{ _em=(getOwnedClient(currentClientId)||{}).email||null; }catch(e){ _em=null; }
            if(_em){
              const _a2=await CLOUD.syncUser(_em).catch(()=>false);
              _change=_change||_a2;
            }
          }
          // Athlète : sync les données du coach pour mettre à jour le banner.
          // Fait AVANT les rendus, pour que _change couvre aussi ce dossier-là.
          if(currentUser.role==='athlete'&&currentUser.coachId){
            const _uu=DB.get('users')||{};
            const _ce=Object.keys(_uu).find(k=>_uu[k]?.id===currentUser.coachId);
            if(_ce){
              const _c2=await CLOUD.syncUser(_ce).catch(()=>false);
              _change=_change||_c2;
            }
          }
          // Rendus : SEULEMENT si quelque chose a bougé. Une heure passée sur
          // l'accueil sans activité du coach ne repeint donc plus rien.
          if(!_change) return;
          // Ne jamais repeindre pendant une saisie. loadCoachHome reecrit la
          // liste ET rappelle coachTab : un champ en cours de frappe perdrait
          // son focus et les caracteres tapes entre deux reveils.
          // Le garde couvre TOUS les onglets, pas seulement le tableau de bord :
          // c'est justement sur PAIEMENTS que l'on saisit un numero.
          if(currentUser.role==='coach'&&document.getElementById('s-coach-home')?.classList.contains('active')){
            const _ae=document.activeElement;
            const _saisie=_ae&&_ae.matches&&_ae.matches('input,textarea,select');
            const _surDashboard=document.getElementById('ct-dashboard')
              &&getComputedStyle(document.getElementById('ct-dashboard')).display!=='none';
            if(!_saisie&&_surDashboard) loadCoachHome();
          }
          if(currentUser.role==='coach'&&document.getElementById('s-coach-client')?.classList.contains('active')&&currentClientId){
            openClientDetail(currentClientId,true);
          }
          if(currentUser.role==='athlete'&&document.getElementById('s-client-home')?.classList.contains('active')){
            loadClientHome();
          }
          // ET SON ECRAN NUTRITION : voir _repeindreNutritionAthlete.
          if(currentUser.role==='athlete') _repeindreNutritionAthlete();
          // ET TOUS SES AUTRES ECRANS : voir _repeindreEcransAthlete.
          if(currentUser.role==='athlete') _repeindreEcransAthlete();
        }catch(e){console.warn('sync periodique :',e);}
       }finally{
        // TOUTES LES SORTIES PASSENT ICI : les quatre `return`, la fin
        // normale, et toute exception qui aurait echappé au catch interne.
        _replanifierSync();
       }
      };
      _replanifierSync();
      // Le passage à 5 minutes rendrait l'app molle au retour d'arrière-plan :
      // un athlète qui rouvre son téléphone attendrait jusqu'à 5 min pour voir
      // la correction de son coach. Le retour au premier plan déclenche donc
      // une synchro unique, immédiate — c'est le seul moment où l'utilisateur
      // regarde vraiment l'écran.
      document.addEventListener('visibilitychange',()=>{
        if(document.visibilityState!=='visible') return;
        // AVANT le garde anti-rafale et le garde de connexion : c’est au retour
        // d’arrière-plan qu’un jour a pu passer, et ces deux gardes sortent
        // tôt — l’un pendant 60 s, l’autre dès que le réseau manque.
        try{ _repeindreSiJourChange(); }catch(e){}
        // LA FILE D'ENVOI D'ABORD : ce qui n'est pas parti avant la mise en
        // arriere-plan repart des le retour (30/09/2026).
        try{ if(CLOUD.enAttenteDeSync()>0) CLOUD.viderFile().catch(()=>{}); }catch(e){}
        // La descente, ses deux gardes ET LE REPEINT : voir _descenteAuRetour.
        _descenteAuRetour().catch(()=>{});
      });
    },220);
  };
  try{
    const _mot=document.getElementById('splash-word');
    if(_mot) _mot.addEventListener('animationend',_quitterSplash,{once:true});
  }catch(e){}
  // Sous « animations reduites » aucun animationend n'arrive : on garde le
  // minutage d'avant plutot que d'attendre le filet.
  let _red=false; try{ _red=(typeof arcReduit==='function')&&arcReduit(); }catch(e){}
  setTimeout(_quitterSplash,_red?640:900);
};

// ══════════════ PLUSIEURS COMPTES SUR LE MÊME APPAREIL ══════════════════════
// Un coach qui s'entraîne a deux dossiers : le sien de coach, et le sien
// d'athlète, avec deux e-mails et deux mots de passe. Il doit pouvoir passer de
// l'un à l'autre sans se déconnecter.
//
// Ce qui rend la chose délicate n'est PAS currentUser — c'est tout ce qui vit à
// côté de lui et n'appartient qu'à un seul compte :
//   rc_fb_auth   Firebase Auth ne garde QU'UN jeu de jetons. Chaque compte a
//                donc le sien, rangé dans le registre, et on échange le slot
//                actif à la bascule.
//   woState      une séance en cours appartient à un compte. On REFUSE de
//                basculer pendant une séance plutôt que de la transporter.
//   bilData      un bilan à moitié rempli, même raison.
//   les caches   volume, signaux, plateau : ils portent l'e-mail dans leur clé
//                pour certains, pas pour tous. On les vide, c'est le seul choix
//                sûr.
//   les rappels  ils vivent dans le cache du Service Worker, à l'échelle de
//                l'APPAREIL et non du compte. Ils suivent donc le compte
//                ACTIF : basculer replanifie, et le compte en veille ne reçoit
//                plus de rappel. C'est une limite du navigateur, pas un choix.
const CPT_CLE='rc_comptes';
const CPT_MAX=5;

function comptesConnectes(){
  try{
    const l=JSON.parse(localStorage.getItem(CPT_CLE)||'[]');
    return Array.isArray(l)?l.filter(c=>c&&c.email):[];
  }catch(e){ return []; }
}
function _comptesEcrire(l){
  try{ localStorage.setItem(CPT_CLE,JSON.stringify((l||[]).slice(0,CPT_MAX))); return true; }
  catch(e){ return false; }
}
// Jetons Firebase du compte, tels qu'ils sont dans le slot actif. On relit le
// stockage plutôt que les champs de CLOUD : c'est lui la source de vérité, et
// il est réécrit à chaque rafraîchissement de jeton.
function _jetonsActifs(){
  try{ return JSON.parse(localStorage.getItem('rc_fb_auth')||'null')||null; }
  catch(e){ return null; }
}
function _jetonsPoser(j){
  try{
    if(j) localStorage.setItem('rc_fb_auth',JSON.stringify(j));
    else localStorage.removeItem('rc_fb_auth');
  }catch(e){}
  // On repasse par le chargeur de CLOUD : une seule mécanique de lecture.
  CLOUD._idToken=null; CLOUD._refreshToken=null; CLOUD._tokenExpiry=0;
  if(j) CLOUD._loadAuth();
}
// Enregistre ou rafraîchit le compte COURANT dans le registre, avec ses jetons.
// Appelée depuis routeUser : ce seul point couvre le démarrage, la connexion et
// la bascule, sans toucher aux quatre sorties de doLogin.
function comptesEnregistrer(u){
  const user=u||currentUser;
  if(!user||!user.email) return comptesConnectes();
  const l=comptesConnectes().filter(c=>c.email!==user.email);
  l.unshift({email:user.email,fname:user.fname||'',lname:user.lname||'',
    role:user.role||'athlete',avatar:user.athletePhoto||user.coachPhoto||'',
    auth:_jetonsActifs(),vuLe:Date.now()});
  _comptesEcrire(l);
  return l;
}
function compteActif(){ return (currentUser&&currentUser.email)||null; }
// Bascule interdite pendant une séance ou un bilan : ces deux états sont
// globaux et n'appartiennent qu'au compte qui les a commencés.
function peutBasculer(){
  if(typeof woState==='object'&&woState&&!woState.termine
     &&woState.exercises&&woState.exercises.length&&woState.startTime)
    return {ok:false,raison:'Termine ou annule ta séance avant de changer de compte.'};
  if(typeof bilData==='object'&&bilData&&Object.keys(bilData).length)
    return {ok:false,raison:'Termine ou quitte ton bilan avant de changer de compte.'};
  return {ok:true,raison:''};
}
// Remise à zéro de tout ce qui n'appartient PAS au compte d'arrivée.
function _comptesRemiseAZero(){
  currentClientId=null;
  // N3.10 — LE BROUILLON DE SEANCES PART AVEC LE COMPTE. Il porte le
  // dossier COMPLET d'un athlete, copie profonde prise a l'ouverture de
  // l'editeur : le laisser derriere soi sur un appareil partage, c'est y
  // laisser les seances, les notes et les photos de quelqu'un d'autre.
  try{ _coachEditClient=null; }catch(e){}
  // N3.17 — SIX ETATS APPARTENAIENT ENCORE AU COMPTE QUITTE.
  // La bascule purgeait currentClientId, woState, bilData, le brouillon de
  // bilan et trois caches, et laissait derriere elle : le brouillon de
  // seances, le plan alimentaire en composition, la video en cours de
  // correction, les messages du canal, le profil coach mis en cache sous
  // une clef UNIQUE — non indexee par compte — et les deux drapeaux de
  // session qui empechent de republier la vitrine jusqu'au rechargement.
  // Un aller-retour coach -> athlete -> coach repartait donc avec le
  // travail du compte precedent sous les yeux, et une vitrine qui ne
  // remontait plus.
  try{ _cplPlan=null; }catch(e){}
  try{ window._vcEmail=null; window._vcVideoId=null; }catch(e){}
  try{ window._canalMsgsCoach={}; }catch(e){}
  try{ localStorage.removeItem('rc_coach_profil'); }catch(e){}
  // Les deux drapeaux sont des « deja fait POUR CE COMPTE » : les laisser
  // vrais fait croire au suivant que son profil est deja publie.
  try{ window._ratProfilFait=false; window._profilCoachPublie=false; }catch(e){}
  try{ if(woState&&woState.timerInterval) clearInterval(woState.timerInterval); }catch(e){}
  woState={};
  try{ localStorage.removeItem('rc_wo_state'); }catch(e){}
  bilData={};
  // LE BROUILLON PART AVEC. Il porte désormais une adresse, donc le compte
  // d’arrivée ne le lirait pas — mais le laisser derrière soi, c’est laisser
  // les mensurations de quelqu’un dans le stockage d’un appareil partagé.
  try{ localStorage.removeItem(BIL_DRAFT_KEY); }catch(e){}
  try{ _ckEtat={}; _ckStopChrono(); }catch(e){}
  try{ _viderCacheVolume(); }catch(e){}
  try{ _viderCacheSignaux(); }catch(e){}
  try{ _viderCachePlateau(); }catch(e){}
  try{ closeModal(); }catch(e){}
}
function basculerCompte(email){
  if(!email||email===compteActif()) return false;
  const g=peutBasculer();
  if(!g.ok){ toast(g.raison,'var(--orange)'); return false; }
  const users=DB.get('users')||{};
  const cible=users[email];
  if(!cible){ toast('Ce compte n\'est plus sur cet appareil','var(--orange)'); return false; }
  // Les jetons du compte qu'on quitte sont rangés AVANT tout échange.
  comptesEnregistrer(currentUser);
  const entree=comptesConnectes().find(c=>c.email===email);
  _comptesRemiseAZero();
  _jetonsPoser(entree&&entree.auth?entree.auth:null);
  currentUser=cible;
  DB.set('session',currentUser);
  comptesEnregistrer(currentUser);
  // Les rappels suivent le compte actif : voir l'en-tête de ce bloc.
  try{ if(_notifSupported()&&Notification.permission==='granted'){
    scheduleSwNotif(); scheduleWoNotif(); scheduleSuppNotif(); } }catch(e){}
  routeUser();
  toast('Compte : '+((cible.fname||cible.email)+''));
  return true;
}
function retirerCompte(email){
  if(!email) return false;
  if(email===compteActif()){ toast('Déconnecte-toi pour retirer le compte actif','var(--orange)'); return false; }
  _comptesEcrire(comptesConnectes().filter(c=>c.email!==email));
  return true;
}
// « Ajouter un compte » : on range le compte courant et ses jetons, on vide le
// slot actif, et on envoie sur l'écran de connexion. Le compte courant reste
// dans le registre — on ne se déconnecte de rien.
function ajouterCompte(){
  const g=peutBasculer();
  if(!g.ok){ toast(g.raison,'var(--orange)'); return; }
  comptesEnregistrer(currentUser);
  _comptesRemiseAZero();
  _jetonsPoser(null);
  currentUser=null;
  try{ DB.del('session'); }catch(e){}
  go('s-login');
}
// PURE. Ce slot permet-il une bascule SANS MOT DE PASSE ?
//
// Il lui faut ses jetons : basculerCompte appelle _jetonsPoser avec ce que
// le slot porte, et sans rien c’est _jetonsPoser(null) — une session ouverte
// et NON AUTHENTIFIÉE. Le filtre vivait dans go() pendant que le rendu vivait
// ici : deux copies de la même règle, dont une seule était appliquée.
function _compteAvecJetons(c){ return !!(c&&c.auth); }
// Sélecteur. Rendu vide avec un seul compte : un sélecteur à un choix n'a rien
// à sélectionner, mais le bouton d'ajout reste.
//
// `jetonsRequis` N’EST PAS LE DÉFAUT, et c’est délibéré : depuis le profil
// athlète et depuis la modale « Changer de compte », une session est OUVERTE.
// Un slot sans jetons y reste légitime — on peut vouloir le retirer, et le
// masquer le rendrait impossible à effacer. C’est sur s-login, et là
// seulement, que le montrer promet une bascule qui n’aura pas lieu.
function htmlSelecteurComptes(opts){
  const _req=!!(opts&&opts.jetonsRequis);
  const l=_req?comptesConnectes().filter(_compteAvecJetons):comptesConnectes();
  const actif=compteActif();
  const ini=c=>((c.fname||c.email||'?')[0]||'?').toUpperCase()
    +((c.lname||'')[0]||'').toUpperCase();
  const ligne=c=>{
    const est=c.email===actif;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:var(--r-3);margin-bottom:6px;
      background:${est?'#1a0505':'var(--surface-1)'};border:1px solid ${est?'var(--red)':'var(--border)'}">
      <div style="width:34px;height:34px;border-radius:var(--r-full);flex-shrink:0;overflow:hidden;background:var(--surface-2);
        display:flex;align-items:center;justify-content:center;font-size:var(--fs-sm);font-weight:800;color:#bbb">
        ${c.avatar?`<img src="${escapeHtml(c.avatar)}" style="width:100%;height:100%;object-fit:cover">`:escapeHtml(ini(c))}</div>
      <div style="flex:1;min-width:0;cursor:${est?'default':'pointer'}"${est?'':` onclick="basculerCompte('${escapeHtml(c.email)}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"`}>
        <div style="font-size:var(--fs-sm);font-weight:800;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(((c.fname||'')+' '+(c.lname||'')).trim()||c.email)}</div>
        <div style="font-size:var(--fs-2xs);color:var(--text-faint)">${c.role==='coach'?'Coach':'Élève'}${est?' · actif':''}</div>
      </div>
      ${est?'<span style="font-size:var(--fs-md);color:var(--red-text);flex-shrink:0">'+icon('coche',14)+'</span>'
           :`<button onclick="retirerCompte('${escapeHtml(c.email)}');_majSelecteurComptes()" class="hit44"
              style="flex:0 0 auto;background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;padding:0 4px" title="Retirer">${icon('croix',14)}</button>`}
    </div>`;
  };
  // DEUX GROUPES, NOMMÉS (Kevin, 28/09/2026) : le compte athlète, puis le
  // compte coach. Un groupe vide ne s'affiche pas.
  const groupe=(titre,liste)=>liste.length?(`<div class="cpt-groupe">${titre}</div>`+liste.map(ligne).join('')):'';
  return `<div id="cpt-selecteur">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">Mes comptes</div>
    ${groupe('Compte athlète',l.filter(c=>c.role!=='coach'))}
    ${groupe('Compte coach',l.filter(c=>c.role==='coach'))}
    <button class="btn btn-outline btn-sm" style="width:100%;margin:2px 0 0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="ajouterCompte()">+ Ajouter un compte</button>
    ${l.length>1?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:8px">Les rappels de notification suivent le compte actif : le compte en veille n'en reçoit pas.</div>`:''}
  </div>`;
}
// Modale des comptes. Le profil athlete affiche le selecteur en ligne ; le
// coach n'a pas d'ecran de profil, il passe par ici depuis son en-tete.
function ouvrirComptes(){
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    `<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
      <div onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:520px;max-height:88vh;overflow:auto">
        <div style="font-size:var(--fs-lg);font-weight:800;margin-bottom:4px">Changer de compte</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:14px">Tes comptes restent connectés sur cet appareil. Tu passes de l'un à l'autre sans ressaisir ton mot de passe.</div>
        ${htmlSelecteurComptes()}
      </div></div>`);
}
// LE RÉGLAGE SUIT L’ÉCRAN, il n’est pas mémorisé. Cette fonction est appelée
// par la croix de retrait, présente dans les TROIS contextes : lire l’écran
// actif est la seule façon de redessiner la même liste que celle qu’on vient
// de modifier.
function _majSelecteurComptes(){
  const z=document.getElementById('cpt-selecteur');
  if(!z) return;
  let _login=false;
  try{ _login=document.querySelector('.screen.active')?.id==='s-login'; }catch(e){}
  z.outerHTML=htmlSelecteurComptes(_login?{jetonsRequis:true}:null);
}

function routeUser(){
  // Marque le mois comme suivi par CE navigateur. Sans cet appel, un relevé
  // ne saurait pas distinguer « aucun trafic » de « compteur effacé ».
  try{ _quotaOuvrirMois(); }catch(e){}
  // Une résiliation demandée hors ligne attend dans la file : on la rejoue
  // dès qu'un dossier est chargé. Exactement une fois — la file se vide au
  // premier envoi qui aboutit.
  // ET UNE RÉSILIATION DEMANDÉE AVANT LE 02/10/2026, que le serveur n'a
  // jamais reçue (elle n'était écrite que dans le dossier) : remise en file
  // une fois, pour que le serveur arrête l'abonnement à sa date d'effet. Le
  // serveur ne l'enregistre qu'une fois, quel que soit le nombre d'envois.
  setTimeout(()=>{ try{
    const _r=resiliationDemandee(currentUser);
    if(_r&&currentUser.paypalSubscriptionId&&!_resilEffetLu(currentUser.email)&&!_fileResilLire()) _fileResilPoser(currentUser.email,_r.ts);
    _rejouerResiliation();
  }catch(e){} },1500);
  // Relevés de santé : union locale ↔ nœud privé. Différée, pour ne pas
  // retarder l'écran d'arrivée d'un aller-retour réseau. Idempotente : la
  // rejouer à chaque démarrage ne crée aucun doublon.
  setTimeout(()=>{ try{ _migrerSantePriveeLocale(); }catch(e){} },2000);
  // Le push serveur : la souscription de cet appareil, rafraîchie (au plus une
  // fois par jour) ou refaite si la clé VAPID a changé. Jamais de demande.
  setTimeout(()=>{ try{ pushVerifierAuDemarrage(); }catch(e){} },4000);
  // LE CODE PARRAIN, DÈS LE DÉMARRAGE et pas seulement à l'ouverture de
  // « Inviter des amis » : sans lui, les liens partagés partaient sans ref.
  setTimeout(()=>{ try{ if(PARRAINAGE_ACTIF&&currentUser&&currentUser.role!=='coach') parrainageAssurerCode(currentUser).catch(()=>{}); }catch(e){} },6000);
  setTimeout(()=>{ try{ if(currentUser&&currentUser.paypalSubscriptionId) abonnementSignaler(currentUser.paypalSubscriptionId,false); }catch(e){} },7000);
  // Le trapeze s'est dedouble le 08/09/2026 : on reporte l'ancien reglage sur
  // les deux portions, une fois, au demarrage. Elle ne sauve QUE si elle a
  // change quelque chose — un dossier deja migre ne declenche aucune poussee.
  try{ if(migrerTrapezes(currentUser)) saveUser(); }catch(e){ rcErreurMuette('routeUser',e); }
  // Les entrées du journal comptées 0 kcal alors que leurs macros sont connues.
  try{ if(migrerKcalEstimees(currentUser)) saveUser(); }catch(e){ rcErreurMuette('routeUser',e); }
  // Une seule fois par chargement, et après que l'écran d'arrivée soit peint.
  setTimeout(_pastilleServiParCache,900);
  if(!currentUser) return go('s-welcome');
  // Session corrompue (objet sans email) : seul cas où la purge est justifiée.
  if(!currentUser.email){silentLogout();return go('s-welcome');}
  // Registre des comptes de l'appareil. Ici et nulle part ailleurs : ce point
  // couvre le démarrage, les quatre sorties de doLogin, et la bascule.
  try{ comptesEnregistrer(currentUser); }catch(e){}
  // Un actif de plus cette semaine (le dénominateur du coefficient viral).
  try{ attribActifSemaine(currentUser); }catch(e){}
  // LE FUSEAU DE L'APPAREIL, pour le serveur léger : ses heures calmes et le
  // jour du plafond d'un push sont ceux de l'athlète. Écrit seulement s'il a changé.
  try{ if(fuseauAssurer(currentUser)) saveUser(); }catch(e){ rcErreurMuette('routeUser',e); }
  // Un paquet athlète attend une décision. Le déclencheur est ICI, en tête, et
  // non plus bas avec _pendingBilanOpen : ce paquet vise un appareil de COACH,
  // et la branche coach retourne deux lignes plus loin — le code d'en bas ne
  // serait jamais atteint. Le délai laisse l'écran d'arrivée se peindre, et
  // couvre aussi la connexion tardive : doLogin rappelle routeUser().
  // Consentement d'abord : tant qu'il n'est pas a jour, rien d'autre ne doit
  // s'interposer. Meme delai, pour laisser l'ecran d'arrivee se peindre.
  setTimeout(_proposerReconsentement,600);
  if(window._pendingAthletePkg) setTimeout(_proposerImportAthlete,700);
  // LOT M1 : un coach n'est jamais habillé ; un athlète prend la marque de son coach Pro.
  if(currentUser.role==='coach'){ try{ retirerMarque(); }catch(e){} }
  else { try{ chargerMarqueCoach().catch(()=>{}); }catch(e){} }
  if(currentUser.role==='coach'){loadCoachHome();
    // ?prospects=1 : la notification d'un nouveau contact (C6). Ici, dans la branche coach.
    if(window._pendingProspectsOpen){ window._pendingProspectsOpen=false; setTimeout(()=>{ try{ ouvrirProspects(); }catch(e){} },1000); }
    if(window._pendingMessagesOpen){ window._pendingMessagesOpen=false; setTimeout(()=>{ try{ ouvrirMessages(); }catch(e){} },1000); }
    return;}
  // Athlète : vérifier l'accès
  const s=currentUser.status||'FREE';
  // Athlète FREE = inscrit mais pas encore activé. Ce n'est pas un compte
  // invalide : on conserve sa session et on l'amène à l'écran qui propose le
  // code ET les abonnements. Le déconnecter revenait à détruire son compte
  // parce qu'il n'avait pas encore choisi comment payer.
  // ⚠ ET L'ESSAI SE LIT ICI AUSSI. Sans cette condition, checkAccess aurait
  // beau dire oui, la ligne d'au-dessus aurait detourne l'athlete vers
  // l'ecran de code avant meme qu'on la consulte : s-subscribe et s-client-code
  // ne sont presentes qu'a l'epuisement.
  if(doitVoirLePaywall(currentUser)) return allerApresEssai(currentUser);
  if(!checkAccess(currentUser)){go('s-access-gate');loadAccessGate();return;}
  // ── L'ACCUEIL DU NOUVEL INSCRIT ──────────────────────────────────────
  // ICI, et nulle part ailleurs. routeUser est le seul point qui DECIDE ou un
  // athlete atterrit — c'est deja lui qui l'envoie sur l'ecran de code ou sur
  // la barriere d'acces, deux lignes plus haut. Les deux accueils sont des
  // aiguillages de meme nature, ils appartiennent donc a la meme fonction.
  // Consequence assumee et voulue : un retour a l'accueil par la fleche ou par
  // un onglet ne les redeclenche pas. Ce sont des RETOURS, pas des arrivees.
  // LES NOTIFICATIONS, ACTIVÉES PAR DÉFAUT : aucun écran ; la question du
  // téléphone part au premier toucher (pushActiverParDefaut).
  setTimeout(()=>{ try{ pushActiverParDefaut(); }catch(e){} },1200);
  if(_aiguillerNouvelInscrit()) return;
  loadClientHome();
  if(window._pendingBilanOpen){window._pendingBilanOpen=false;setTimeout(()=>openBilanChoice(),800);}
  if(window._pendingWoOpen){window._pendingWoOpen=false;setTimeout(()=>openSessionPicker(),900);}
  // MEME DELAI ECHELONNE que ses deux voisins : le routage de démarrage doit
  // avoir posé son écran avant qu'on en pousse un autre par-dessus.
  if(window._pendingSanteEnvoyer){ window._pendingSanteEnvoyer=false;
    setTimeout(()=>{ try{ sanEnvoyerOuvrir(); }catch(e){} },1000);}
  if(window._pendingSanteRetour){ const _r=window._pendingSanteRetour; window._pendingSanteRetour=false;
    setTimeout(()=>{ try{ loadLifestyle(); _sanSyncLu=0; sanSyncTirer(true).catch(()=>{});
      toast(_r==='ok'?'Données santé connectées':'Première synchronisation à reprendre : elle repartira à la prochaine ouverture',_r==='ok'?'var(--green)':'var(--orange)'); }catch(e){} },1000);}
  if(window._pendingDieteOpen){window._pendingDieteOpen=false;
    setTimeout(()=>{ try{ go('s-nutrition'); loadNutrition(); }catch(e){} },1000);}
  if(window._pendingWrappedOpen){ const _k=window._pendingWrappedOpen; window._pendingWrappedOpen=false;
    setTimeout(()=>{ try{ ouvrirWrapped(_k==='1'?null:_k); }catch(e){} },1000);}
  if(window._pendingCanalOpen){ window._pendingCanalOpen=false;
    setTimeout(()=>{ try{ loadCanal(); }catch(e){} },1000);}
  // Le paiement d'une formule de coach : le retour de PayPal, ou la proposition de payer.
  if(window._pendingPaiementCoach){ const _pc=window._pendingPaiementCoach; window._pendingPaiementCoach=false;
    setTimeout(()=>{ try{ pcRetourPaypal(_pc.etat,_pc.commande); }catch(e){} },1100);}
  else setTimeout(()=>{ try{ pcProposerPaiement(); }catch(e){} },1300);
  if(window._pendingFormule){ const _f=window._pendingFormule; window._pendingFormule=false;
    setTimeout(()=>{ try{ toast(_f==='validee'?'Changement validé chez PayPal : ta formule suit dès que PayPal le confirme.'
      :'Changement de formule annulé : ton abonnement reste tel quel.',_f==='validee'?'var(--green)':'var(--orange)'); }catch(e){} },1200);}
  if(window._pendingParrainageOpen){ window._pendingParrainageOpen=false;
    setTimeout(()=>{ try{ ouvrirParrainage(); }catch(e){} },1000);}
  if(window._pendingSaisonOpen){ window._pendingSaisonOpen=false;
    setTimeout(()=>{ try{ chargerSaisons(true).then(()=>renderSaisonAccueil()); }catch(e){} },1000);}
  if(window._pendingRepriseOpen){ window._pendingRepriseOpen=false;
    setTimeout(()=>{ try{ ouvrirRepriseDouce(); }catch(e){} },1000);}
  if(window._pendingLigueOpen){ window._pendingLigueOpen=false;
    setTimeout(()=>{ try{ ouvrirLigue(); }catch(e){} },1000);}
  if(window._pendingParcoursOpen){ window._pendingParcoursOpen=false;
    setTimeout(()=>{ try{ parcoursRelancer(); }catch(e){} },1000);}
  if(window._pendingMessagesOpen){ window._pendingMessagesOpen=false;
    setTimeout(()=>{ try{ msgOuvrirFil(); }catch(e){} },1000);}
  if(window._pendingGarmin){ const _g=window._pendingGarmin; window._pendingGarmin=null;
    setTimeout(()=>{ try{ garminRetour(_g); }catch(e){} },1000);}
  if(window._pendingDuelsOpen){ window._pendingDuelsOpen=false;
    setTimeout(()=>{ try{ _duelsLusLe=0; _rendreDuelsAccueil(); }catch(e){} },1000);}
  if(window._pendingPaiementsOpen){ window._pendingPaiementsOpen=false;
    setTimeout(()=>{ try{ if(estAdminAmbassadeurs()) ouvrirAmbassadeurs(); }catch(e){} },1000);}
}
// ARBITRAGE ASSUMÉ (24/07/2026, plan Spark) — status, paymentStatus et
// paypalSubscriptionId ne sont protégés par AUCUNE règle serveur :
// database.rules.json autorise le titulaire du nœud à y écrire n'importe quelle
// valeur. La seule barrière est l'interface.
// Ne pas retirer les contrôles client en croyant qu'un filet serveur existe.
// Condition de réouverture : premier coach affilié payant, ou passage au plan Blaze.
//
// Ce que dit exactement database.rules.json aujourd'hui : sous users/$emailKey,
// .write est accordé au titulaire du nœud (et à son coach), sans aucune
// restriction de champ — le seul .validate du fichier porte sur coachEmailKey.
// Le commentaire précédent affirmait l'inverse : « champs contrôlés
// exclusivement par le serveur (Cloud Functions Admin SDK) », « les règles RTDB
// bloquent toute tentative de self-upgrade ». Les Cloud Functions ne tournent
// plus depuis le passage en 100 % client, et cette règle n'a jamais existé.
// Un commentaire faux est pire qu'absent : il invite à retirer le seul garde
// qui reste.
