// ══ LA MESSAGERIE COACH ↔ ATHLÈTE (lot M2, 30/09/2026) ═════════════════════
//
// Un fil privé par couple coach/athlète, texte seulement :
//   messages/<coachKey>/<athleteKey>/<msgId> = {de:'coach'|'athlete', texte, at, lu}
//
// ⚠ PAS DANS users/<email> : saveUser réécrit le dossier entier, et deux
//   appareils qui écrivent en même temps y perdraient des messages.
// ⚠ PAS D'ÉCOUTE PERMANENTE (plan Spark : connexions simultanées comptées).
//   Un fil se lit à son ouverture, au retour au premier plan, et par pages de
//   50 (orderBy $key : l'identifiant commence par l'heure en base 36, donc
//   l'ordre des clés est celui des messages).
// ⚠ LES RÈGLES décident : chacun n'écrit que SON rôle, l'athlète seulement
//   tant qu'il est rattaché au coach, et seul le destinataire passe `lu` à
//   true. Un athlète détaché ne lit plus le fil.
// ⚠ HORS LIGNE : refusé avec un toast. Aucune file d'envoi existante ne
//   convient à un texte qui doit arriver dans l'ordre.
// ⚠ LA NOTIFICATION passe par deposerEvenement({type:'message'}) : le Worker
//   relit le message en base avant de pousser (type 'coach' vers l'athlète,
//   'message' vers le coach).
const MSG_TEXTE_MAX=1000;
const MSG_PAGE=50;
const MSG_SANS_REPONSE_MS=24*3600e3;
const MSG_CACHE_MS=10*60e3;
// PURE. Un identifiant qui se range dans l'ordre du temps.
function msgId(t){ return 'm'+(Number(t)||Date.now()).toString(36)+Math.random().toString(36).slice(2,8); }
// PURE. Le texte à envoyer : 1 à 1000 caractères, pas seulement des blancs.
function msgTexteValide(t){
  const s=String(t==null?'':t).replace(/\r\n/g,'\n').trim();
  if(!s) return {ok:false,texte:'',raison:'Écris un message avant d’envoyer.'};
  if(s.length>MSG_TEXTE_MAX) return {ok:false,texte:s,raison:'Un message tient en '+MSG_TEXTE_MAX+' caractères ('+s.length+' ici).'};
  return {ok:true,texte:s,raison:null};
}
// PURE. Un fil lu dans la base ({id:msg}) → une liste dans l'ordre.
function msgListe(obj){
  const o=(obj&&typeof obj==='object')?obj:{};
  return Object.keys(o).filter(k=>o[k]&&typeof o[k]==='object').sort()
    .map(k=>Object.assign({},o[k],{id:k}));
}
// PURE. Le résumé d'un fil : le dernier message, et ce que `role` n'a pas lu.
function msgResume(liste,role){
  const l=Array.isArray(liste)?liste:[];
  const autre=role==='coach'?'athlete':'coach';
  return {dernier:l.length?l[l.length-1]:null,nonLus:l.filter(m=>m.de===autre&&!m.lu).length,n:l.length};
}
// PURE. Les fils, du plus récent au plus ancien ; un fil vide passe en dernier.
function msgFilsTries(fils){
  return (Array.isArray(fils)?fils:[]).slice().sort((a,b)=>{
    const x=Number(a&&a.dernier&&a.dernier.at)||0, y=Number(b&&b.dernier&&b.dernier.at)||0;
    if(x!==y) return y-x;
    return String(a&&a.nom||'').localeCompare(String(b&&b.nom||''),'fr');
  });
}
// PURE. « Message sans réponse » : le dernier message vient de l'athlète et
// date de 24 h ou plus. S'éteint quand le coach RÉPOND (dernier = coach),
// pas quand il ouvre le fil.
function msgSansReponse(fil,maintenant,seuil){
  const d=fil&&fil.dernier;
  if(!d||d.de!=='athlete') return false;
  const t=typeof maintenant==='number'?maintenant:Date.now();
  return t-(Number(d.at)||t)>=(Number(seuil)>0?Number(seuil):MSG_SANS_REPONSE_MS);
}
// PURE. L'heure d'un message : « 14:05 » aujourd'hui, sinon « lun. 28 sept. 14:05 ».
function msgHeure(at,maintenant){
  const d=new Date(Number(at)||0), n=new Date(typeof maintenant==='number'?maintenant:Date.now());
  const h=d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  return d.toDateString()===n.toDateString()?h:d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})+' '+h;
}

// ── L'accès à la base ────────────────────────────────────────────────────
function _msgCles(u,athleteCle){
  if(!u) return null;
  if(u.role==='coach'){ const c=String(u.email||'').replace(/\./g,','); return (c&&athleteCle)?{coach:c,athlete:String(athleteCle)}:null; }
  const coach=u.coachEmailKey, moi=_relCle(u);
  return (coach&&moi)?{coach:String(coach),athlete:moi}:null;
}
function _msgEnLigne(){ return !(typeof navigator!=='undefined'&&navigator.onLine===false); }
// Une page du fil : les 50 derniers, ou les 50 d'avant `avant` (exclu).
// `limite` (06/10/2026) : le repli de la liste des fils n'en lit qu'un.
async function msgChargerPage(k,avant,limite){
  if(!k) return {ok:false,st:0,liste:[]};
  let tok=null; try{ tok=await CLOUD._getToken(); }catch(e){ tok=null; }
  if(!tok) return {ok:false,st:0,liste:[]};
  let url=CLOUD._fbUrl.replace('users.json','messages/'+k.coach+'/'+k.athlete+'.json')+'?auth='+tok+'&orderBy=%22%24key%22';
  url+=avant?'&endAt='+encodeURIComponent(JSON.stringify(avant))+'&limitToLast='+(MSG_PAGE+1):'&limitToLast='+(Number(limite)>0?Number(limite):MSG_PAGE);
  try{
    const r=await fetch(url);
    if(!r.ok) return {ok:false,st:r.status,liste:[]};
    let l=msgListe(await r.json());
    if(avant) l=l.filter(m=>m.id!==avant);
    return {ok:true,st:200,liste:l,complet:l.length<MSG_PAGE};
  }catch(e){ return {ok:false,st:0,liste:[]}; }
}
// ══ L'INDEX DES FILS (06/10/2026) ═══════════════════════════════════════
// La liste des fils lançait UNE requête par athlète, l'une après l'autre,
// chacune de cinquante messages, pour n'en garder que le dernier et le compte
// des non-lus : plusieurs secondes à soixante athlètes. Et si elles
// échouaient, l'écran disait « Aucun athlète rattaché ».
//
// messagesIndex/<coach>/<athlète> = {dernierTexte (80 car.), de, at,
// nonLusCoach, nonLusAthlete}, écrit à chaque envoi (msgEnvoyer : le compteur
// de l'autre monte, par incrément serveur) et à chaque lecture
// (_msgMarquerLus : recalculé depuis la page lue). La liste le lit en UN
// appel ; les fils sans index (d'avant) se lisent au plus six à la fois, un
// message chacun. Le même index sert aux deux appareils du coach.
const MSG_FILS_CACHE_MS=60e3, MSG_REPLI_PARALLELE=6, MSG_INDEX_TEXTE=80, MSG_INDEX_LOCAL='rc_msg_index_';
// PURE. Ce que l'index retient d'un message.
function msgIndexEntree(m){
  return {dernierTexte:String((m&&m.texte)||'').replace(/\s+/g,' ').trim().slice(0,MSG_INDEX_TEXTE),
    de:m&&m.de==='athlete'?'athlete':'coach',at:Number(m&&m.at)||Date.now()};
}
// PURE. L'index d'un fil recalculé depuis sa dernière page (null : fil vide).
function msgIndexDepuisListe(liste){
  const l=Array.isArray(liste)?liste:[];
  if(!l.length) return null;
  return Object.assign(msgIndexEntree(l[l.length-1]),{
    nonLusCoach:l.filter(m=>m.de==='athlete'&&!m.lu).length,
    nonLusAthlete:l.filter(m=>m.de==='coach'&&!m.lu).length});
}
// PURE. Le fil d'un athlète, vu du coach, depuis son entrée d'index.
function msgFilDepuisIndex(c,cle,e){
  const ini=((c&&c.lname)||'').charAt(0);
  return {cle,id:c&&c.id,nom:(((c&&c.fname)||'')+(ini?' '+ini+'.':'')).trim()||'Athlète',
    dernier:e&&e.at?{de:e.de,at:Number(e.at),texte:String(e.dernierTexte||'')}:null,
    nonLus:Math.max(0,Number(e&&e.nonLusCoach)||0)};
}
const _msgIndexChemin=k=>'messagesIndex/'+k.coach+'/'+k.athlete;
/** Recalcule l'index d'un fil depuis sa dernière page (message retiré…). */
async function msgIndexRecalculer(k){
  if(!k) return false;
  const p=await msgChargerPage(k);
  if(!p.ok) return false;
  const e=msgIndexDepuisListe(p.liste);
  const r=await _fbJson(_msgIndexChemin(k),e?'PUT':'DELETE',e||undefined);
  return !!(r&&r.ok);
}
/** Le détachement : le fil sort de l'index du coach. */
function msgIndexRetirer(athleteCle){
  const k=_msgCles(currentUser,athleteCle);
  if(!k) return Promise.resolve(false);
  return _fbJson(_msgIndexChemin(k),'DELETE').then(r=>!!(r&&r.ok)).catch(()=>false);
}
function _msgIndexLocalLire(coach){
  try{ const o=JSON.parse(localStorage.getItem(MSG_INDEX_LOCAL+coach)||'null'); return o&&o.index&&typeof o.index==='object'?o:null; }catch(e){ return null; }
}
function _msgIndexLocalEcrire(coach,index){
  try{ localStorage.setItem(MSG_INDEX_LOCAL+coach,JSON.stringify({t:Date.now(),index})); }catch(e){}
}
// Les fils du coach : l'index en un appel, le repli six à la fois. 60 s.
let _msgFils=null;            // {t, fils:[{cle, id, nom, dernier, nonLus}], horsLigne?, erreur?}
async function msgChargerFils(force){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role!=='coach') return null;
  if(!force&&_msgFils&&!_msgFils.erreur&&!_msgFils.horsLigne&&Date.now()-_msgFils.t<MSG_FILS_CACHE_MS) return _msgFils;
  let clients=[]; try{ clients=getClients().filter(c=>c&&c.email&&!c._fromCode); }catch(e){ clients=[]; }
  const coach=String(u.email||'').replace(/\./g,',');
  const construire=(index)=>clients.map(c=>{ const cle=_relCle(c); return msgFilDepuisIndex(c,cle,index&&index[cle]); });
  const r=_msgEnLigne()?await _fbJson('messagesIndex/'+coach):{ok:false,st:0};
  if(!r||!r.ok){
    // LA VRAIE RAISON, ET LA DERNIÈRE LISTE CONNUE. Hors ligne, on montre
    // l'index d'avant, marqué ; on ne dit jamais « aucun athlète » faute de
    // réseau.
    const raison=(!r||r.st===0)?'hors_ligne':(r.st===401||r.st===403)?'acces':'erreur';
    const cache=_msgIndexLocalLire(coach);
    _msgFils=cache?{t:Date.now(),fils:construire(cache.index),horsLigne:true,raison,depuis:cache.t}
      :{t:Date.now(),fils:[],erreur:raison};
    return _msgFils;
  }
  const index=(r.v&&typeof r.v==='object')?r.v:{};
  const fils=construire(index);
  // LE REPLI : les fils sans index (d'avant), six à la fois, un message chacun.
  const sans=fils.filter(f=>!index[f.cle]);
  let i=0;
  const travail=async()=>{
    while(i<sans.length){
      const f=sans[i++];
      const p=await msgChargerPage(_msgCles(u,f.cle),null,1);
      if(!p.ok||!p.liste.length) continue;
      const d=p.liste[p.liste.length-1];
      f.dernier=d; f.nonLus=(d.de==='athlete'&&!d.lu)?1:0;
    }
  };
  await Promise.all(Array.from({length:Math.min(MSG_REPLI_PARALLELE,sans.length)},travail));
  _msgIndexLocalEcrire(coach,index);
  _msgFils={t:Date.now(),fils};
  return _msgFils;
}
function msgFilsReessayer(){
  _msgFils=null; _rendreFils();
  msgChargerFils(true).then(()=>{ if(!_msgFil) _rendreFils(); try{ renderEntreeMessages(); }catch(e){} }).catch(()=>{});
  return true;
}
// La ligne « Message sans réponse » du tableau de bord : lue dans le cache.
function msgClientsSansReponse(clients,maintenant){
  if(!_msgFils) return [];
  const s=new Set(_msgFils.fils.filter(f=>msgSansReponse(f,maintenant)).map(f=>f.cle));
  return (clients||[]).filter(c=>c&&s.has(_relCle(c)));
}

// ── L'envoi ──────────────────────────────────────────────────────────────
// `o` (06/10/2026, envoi groupé) : {id} impose l'identifiant — la clé
// d'idempotence du lot —, {silencieux} tait les toasts (le compte rendu du lot
// parle à leur place).
async function msgEnvoyer(athleteCle,brut,o){
  const u=currentUser, x=o||{};
  const dire=(t)=>{ if(!x.silencieux) toast(t,'var(--orange)'); };
  const v=msgTexteValide(brut);
  if(!v.ok){ dire(v.raison); return {ok:false,raison:v.raison}; }
  if(!_msgEnLigne()){ dire('Pas de réseau : ton message n’est pas parti. Réessaie une fois connecté.'); return {ok:false,raison:'hors_ligne'}; }
  // Un modèle dont une variable n'est pas résolue ne part jamais tel quel.
  if(u.role==='coach'&&/\{[^}\s]{2,20}\}/.test(v.texte)){ dire('Une variable du modèle n’est pas complétée'); return {ok:false,raison:'variable'}; }
  const k=_msgCles(u,athleteCle);
  if(!k){ dire('Ce fil n’est plus accessible'); return {ok:false,raison:'acces'}; }
  const de=u.role==='coach'?'coach':'athlete';
  const id=x.id||msgId();
  const m={de,texte:v.texte,at:Date.now(),lu:false};
  const chemin='messages/'+k.coach+'/'+k.athlete+'/'+id;
  let r=await _fbJson(chemin,'PUT',m);
  // DÉJÀ LÀ ? Un renvoi du même identifiant (réseau coupé après l'écriture,
  // réponse perdue) est refusé par la règle — un message ne se réécrit pas.
  // On relit : s'il existe avec ce texte, il est parti, sans doublon.
  if(x.id&&r&&(r.st===401||r.st===403)){
    const g=await _fbJson(chemin);
    if(g&&g.ok&&g.v&&g.v.texte===v.texte) r={ok:true,st:200,v:g.v,deja:true};
  }
  if(!r||!r.ok){
    dire(r&&(r.st===401||r.st===403)?'Ce fil n’est plus accessible (rattachement au coach terminé ?)':'Envoi impossible, réessaie');
    return {ok:false,raison:r&&(r.st===401||r.st===403)?'acces':'refus',st:r?r.st:0};
  }
  if(r.deja) return {ok:true,id,deja:true};
  // L'INDEX DU FIL : le dernier message, et le compteur de l'AUTRE qui monte
  // (incrément serveur : deux appareils n'écrasent pas leurs comptes).
  try{ await _fbJson(_msgIndexChemin(k),'PATCH',Object.assign(msgIndexEntree(m),
    {[de==='coach'?'nonLusAthlete':'nonLusCoach']:{'.sv':{increment:1}}})); }catch(e){}
  // Le dernier contact du coach (étiquettes et dernier contact).
  if(de==='coach') try{ const _c=getClients().find(x=>_relCle(x)===k.athlete); if(_c) noterContact(_c.id); }catch(e){}
  // La notification : le Worker relit ce message avant de pousser.
  try{ deposerEvenement({type:'message',coach:k.coach,dest:de==='coach'?k.athlete:k.coach,i:id}).catch(()=>{}); }catch(e){}
  // Le fil du coach se met à jour tout de suite : le signal « sans réponse » s'éteint.
  if(de==='coach'&&_msgFils){ const f=_msgFils.fils.find(x=>x.cle===k.athlete); if(f) f.dernier=Object.assign({id},m); }
  if(_msgFil&&_msgFil.cle===k.athlete) _msgFil.liste.push(Object.assign({id},m));
  return {ok:true,id};
}
// Le destinataire a ouvert le fil : ce qui lui était adressé passe à lu.
async function _msgMarquerLus(k,liste,role){
  const autre=role==='coach'?'athlete':'coach';
  const aLire=(liste||[]).filter(m=>m.de===autre&&!m.lu);
  if(!aLire.length) return 0;
  const maj={}; for(const m of aLire) maj[m.id+'/lu']=true;
  const r=await _fbJson('messages/'+k.coach+'/'+k.athlete,'PATCH',maj);
  if(r&&r.ok){
    aLire.forEach(m=>{ m.lu=true; });
    // L'index, recalculé depuis la page lue : il se répare au passage (fil
    // d'avant l'index, message retiré).
    try{ const e=msgIndexDepuisListe(liste); if(e) await _fbJson(_msgIndexChemin(k),'PUT',e); }catch(e){}
    return aLire.length;
  }
  return 0;
}

// ── L'écran : la liste des fils (coach), puis un fil ─────────────────────
let _msgFil=null;             // {cle, nom, liste, complet, zone}
function _msgZone(){ return (currentUser&&currentUser.role==='coach')?'msg-corps':'msga-corps'; }
function ouvrirMessages(){
  _msgFil=null;
  goAvecRetour('s-coach-messages');
  _rendreFils();
  msgChargerFils(true).then(()=>{ if(!_msgFil) _rendreFils(); try{ renderEntreeMessages(); }catch(e){} }).catch(()=>{});
}
function _rendreFils(){
  const z=document.getElementById('msg-corps');
  if(!z) return;
  // TROIS CAS, ET CHACUN DIT SA VRAIE RAISON (06/10/2026).
  let n=0; try{ n=getClients().filter(c=>c&&c.email&&!c._fromCode).length; }catch(e){ n=0; }
  if(!n){ z.innerHTML=emptyState('users','Aucun athlète rattaché pour l’instant.'); return; }
  if(!_msgFils){ z.innerHTML=etatChargement(3); return; }
  if(_msgFils.erreur){
    z.innerHTML=etatErreur(_msgFils.erreur==='hors_ligne'?'Pas de réseau : la liste s’affichera une fois connecté.'
      :_msgFils.erreur==='acces'?'La liste n’a pas pu être chargée : reconnecte-toi.':'La liste n’a pas pu être chargée.','Réessayer','msgFilsReessayer()');
    return;
  }
  const l=msgFilsTries(_msgFils.fils);
  const t=Date.now();
  z.innerHTML=(_msgFils.horsLigne?'<div class="msg-hl">Hors ligne : dernière liste connue. <button type="button" class="msg-hl-b" onclick="msgFilsReessayer()">Réessayer</button></div>':'')
    +l.map(f=>{
    const d=f.dernier;
    const ap=d?(d.de==='coach'?'Toi : ':'')+String(d.texte||'').replace(/\s+/g,' ').slice(0,80):'Aucun message';
    return '<button type="button" class="msg-fil'+(f.nonLus?' msg-fil-nl':'')+'" onclick="msgOuvrirFil('+_attrArg(f.cle)+')">'
      +'<span class="msg-fil-h"><span class="msg-fil-n">'+escapeHtml(f.nom)+'</span>'
      +(d?'<span class="msg-fil-t">'+escapeHtml(msgHeure(d.at,t))+'</span>':'')+'</span>'
      +'<span class="msg-fil-a">'+escapeHtml(ap)+'</span>'
      +(f.nonLus?'<span class="msg-pastille" aria-label="'+f.nonLus+' non lu'+(f.nonLus>1?'s':'')+'">'+f.nonLus+'</span>':'')
      +(msgSansReponse(f,t)?'<span class="msg-attente">sans réponse</span>':'')
      +'</button>';
  }).join('');
}
// Ouvre un fil : le coach donne la clé de l'athlète ; l'athlète n'en donne pas.
async function msgOuvrirFil(athleteCle){
  const u=currentUser;
  const coach=u&&u.role==='coach';
  if(!coach&&!u.coachEmailKey){ toast('Tu n’as pas de coach rattaché','var(--orange)'); return false; }
  const cle=coach?String(athleteCle||''):_relCle(u);
  let nom='Ton coach';
  if(coach){
    const c=(()=>{ try{ return getClients().find(x=>_relCle(x)===cle); }catch(e){ return null; } })();
    nom=c?(c.fname||'Athlète'):'Athlète';
    try{ tplContexte({prenom:c&&c.fname||''},'msg-texte'); }catch(e){}
    goAvecRetour('s-coach-messages');
  } else {
    // Le profil public du coach, rangé par pullProfilCoach (hors du dossier).
    try{ const cp=JSON.parse(localStorage.getItem('rc_coach_profil')||'null'); if(cp&&cp.key===u.coachEmailKey&&cp.d&&cp.d.fname) nom=cp.d.fname; }catch(e){}
    goAvecRetour('s-messages');
  }
  _msgFil={cle,nom,liste:[],complet:false,charge:true};
  _rendreFil();
  await _msgRecharger();
  return true;
}
async function _msgRecharger(){
  const f=_msgFil; if(!f) return false;
  const k=_msgCles(currentUser,f.cle);
  const p=await msgChargerPage(k);
  if(_msgFil!==f) return false;
  f.charge=false;
  if(!p.ok){ f.erreur=p.st===401||p.st===403?'acces':(p.st===0&&!_msgEnLigne()?'hors_ligne':'erreur'); _rendreFil(); return false; }
  f.erreur=null; f.liste=p.liste; f.complet=p.complet;
  _rendreFil();
  const n=await _msgMarquerLus(k,f.liste,currentUser.role==='coach'?'coach':'athlete');
  if(n){ try{ if(currentUser.role==='coach'){ const x=_msgFils&&_msgFils.fils.find(y=>y.cle===f.cle); if(x) x.nonLus=0; renderEntreeMessages(); } else _rendreEntreeMessagesAthlete(true); }catch(e){} }
  return true;
}
async function msgPlusAnciens(){
  const f=_msgFil; if(!f||!f.liste.length) return false;
  const k=_msgCles(currentUser,f.cle);
  const p=await msgChargerPage(k,f.liste[0].id);
  if(!p.ok||_msgFil!==f) return false;
  f.liste=p.liste.concat(f.liste); f.complet=p.complet;
  _rendreFil(true);
  return true;
}
function _rendreFil(garderPosition){
  const z=document.getElementById(_msgZone());
  const f=_msgFil;
  if(!z||!f) return;
  const moi=currentUser.role==='coach'?'coach':'athlete';
  const t=Date.now();
  const tete=moi==='coach'?'<button type="button" class="msg-retour" onclick="msgRetourFils()">Tous les fils</button>':'';
  let corps;
  if(f.charge) corps=etatChargement(3);
  else if(f.erreur==='acces') corps=etatErreur('Ce fil n’est plus accessible.'+(moi==='athlete'?' Tu n’es plus rattaché à ce coach.':' Cet athlète n’est plus rattaché à toi.'));
  else if(f.erreur) corps=etatErreur(f.erreur==='hors_ligne'?'Pas de réseau : les messages s’afficheront une fois connecté.':'Les messages n’ont pas pu être chargés.','Réessayer','msgOuvrirFil('+_attrArg(f.cle)+')');
  else if(!f.liste.length) corps=emptyState('message-circle','Aucun message pour l’instant. '+(moi==='coach'?'Écris le premier.':'Écris à ton coach, il reçoit une notification.'),null,null,'padding:24px 8px');
  else corps=(f.complet?'':'<button type="button" class="msg-anciens" onclick="msgPlusAnciens()">Messages plus anciens</button>')
    +f.liste.map(m=>'<div class="msg-b '+(m.de===moi?'msg-moi':'msg-lui')+'"><div class="msg-b-t">'+escapeHtml(m.texte)+'</div>'
      +'<div class="msg-b-h">'+escapeHtml(msgHeure(m.at,t))+(m.de===moi&&m.lu?' · lu':'')+'</div></div>').join('');
  const ferme=f.erreur==='acces';
  z.innerHTML=tete+'<div class="msg-fil-titre">'+escapeHtml(f.nom)+'</div>'
    +'<div class="msg-liste" id="msg-liste">'+corps+'</div>'
    +(ferme?'':'<div class="msg-saisie">'
      +'<textarea id="msg-texte" maxlength="'+MSG_TEXTE_MAX+'" rows="3" placeholder="Ton message" oninput="_msgCompteur()"></textarea>'
      +'<div class="msg-saisie-b"><span id="msg-compte" class="msg-compte"></span>'
      +(moi==='coach'?'<button type="button" class="btn btn-outline btn-sm" style="margin:0;width:auto" onclick="ouvrirModeles(\'msg-texte\')">Modèles</button>':'')
      +'<button type="button" class="btn btn-red btn-sm" id="msg-envoyer" style="margin:0;width:auto" onclick="msgEnvoyerSaisie()">Envoyer</button></div></div>');
  if(!garderPosition){ const l=document.getElementById('msg-liste'); if(l) l.scrollTop=l.scrollHeight; }
}
function _msgCompteur(){
  const ta=document.getElementById('msg-texte'), z=document.getElementById('msg-compte');
  if(!ta||!z) return;
  const n=ta.value.length;
  z.textContent=n>MSG_TEXTE_MAX-100?n+' / '+MSG_TEXTE_MAX:'';
}
async function msgEnvoyerSaisie(){
  const f=_msgFil, ta=document.getElementById('msg-texte'), b=document.getElementById('msg-envoyer');
  if(!f||!ta) return false;
  if(b) b.disabled=true;
  const brouillon=ta.value;
  const r=await msgEnvoyer(f.cle,brouillon);
  if(b) b.disabled=false;
  if(!r.ok) return false;
  _rendreFil();
  try{ renderEntreeMessages(); renderTodoBlock(getClients()); }catch(e){}
  return true;
}
function msgRetourFils(){ _msgFil=null; _rendreFils(); }
// Retour au premier plan : le fil ouvert se relit, les compteurs aussi.
try{
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden||!currentUser) return;
    const ecran=(document.querySelector('.screen.active')||{}).id;
    if(_msgFil&&(ecran==='s-coach-messages'||ecran==='s-messages')){ _msgRecharger().catch(()=>{}); return; }
    if(currentUser.role==='coach'){ msgChargerFils().then(()=>{ try{ renderEntreeMessages(); if(ecran==='s-coach-home') renderTodoBlock(getClients()); }catch(e){} }).catch(()=>{}); }
    else _rendreEntreeMessagesAthlete().catch(()=>{});
  });
}catch(e){}

// ── Les entrées : accueil du coach, accueil de l'athlète ─────────────────
function renderEntreeMessages(){
  const z=document.getElementById('ch-messages');
  if(!z||!currentUser||currentUser.role!=='coach') return false;
  const nl=_msgFils?_msgFils.fils.reduce((a,f)=>a+(Number(f.nonLus)||0),0):0;
  const attente=_msgFils?_msgFils.fils.filter(f=>msgSansReponse(f)).length:0;
  z.innerHTML='<button type="button" class="rel-entree" onclick="ouvrirMessages()"><span class="rel-entree-t">Messages'
    +(nl?' <span class="msg-pastille">'+nl+'</span>':'')+'</span>'
    +'<span class="rel-entree-e">'+(nl?nl+' non lu'+(nl>1?'s':''):attente?attente+' sans réponse':'un fil privé par athlète')+'</span></button>';
  // L'INDEX SE RELIT TOUTES LES 60 S (un appel) : le signal « sans réponse »
  // de l'accueil ne dépend plus d'un cache de dix minutes.
  if(!_msgFils||Date.now()-_msgFils.t>MSG_FILS_CACHE_MS) msgChargerFils().then(()=>{ try{ renderEntreeMessages(); renderTodoBlock(getClients()); }catch(e){} }).catch(()=>{});
  return true;
}
let _msgAth=null;             // {t, nonLus}
async function _rendreEntreeMessagesAthlete(force){
  const z=document.getElementById('clh-messages');
  const u=currentUser;
  if(!z) return false;
  if(!u||u.role==='coach'||!u.coachEmailKey){ z.innerHTML=''; return false; }
  const peindre=()=>{ const n=_msgAth?_msgAth.nonLus:0;
    z.innerHTML='<button type="button" class="rel-entree" onclick="msgOuvrirFil()"><span class="rel-entree-t">Mon coach'
      +(n?' <span class="msg-pastille">'+n+'</span>':'')+'</span><span class="rel-entree-e">'+(n?n+' message'+(n>1?'s':'')+' non lu'+(n>1?'s':''):'Lui écrire, en privé')+'</span></button>'; };
  peindre();
  if(!force&&_msgAth&&Date.now()-_msgAth.t<MSG_CACHE_MS) return true;
  if(!_msgEnLigne()) return true;
  const p=await msgChargerPage(_msgCles(u));
  if(p.ok){ _msgAth={t:Date.now(),nonLus:msgResume(p.liste,'athlete').nonLus}; peindre(); }
  else if(p.st===401||p.st===403) z.innerHTML='';
  return true;
}

function renderEntreeRelances(){
  const z=document.getElementById('ch-relances');
  if(!z||!currentUser) return false;
  const r=relancesRegles(currentUser);
  const n=RELANCE_SIGNAUX.filter(s=>r[s].actif).length;
  const etat=relancesEnPause(currentUser)?'en pause':(n?n+' règle'+(n>1?'s':'')+' allumée'+(n>1?'s':''):'coupées');
  const parties=_relJournal?relCetteSemaine(_relJournal).filter(e=>e.statut==='parti').length:null;
  z.innerHTML='<button type="button" class="rel-entree" onclick="ouvrirRelances()">'
    +'<span class="rel-entree-t">Relances automatiques</span>'
    +'<span class="rel-entree-e">'+escapeHtml(etat)+(parties?' · '+parties+' partie'+(parties>1?'s':'')+' cette semaine':'')+'</span></button>';
  if(!_relJournal&&n) _relChargerJournal().then(()=>{ try{ renderEntreeRelances(); }catch(e){} });
  return true;
}
function ouvrirRelances(){
  go('s-coach-relances');
  renderRelancesCoach();
  _relChargerJournal(true).then(()=>{ try{ renderRelancesCoach(); }catch(e){} });
  // Les athlètes à risque (risque.js) : la ligne « Proposer un message ».
  try{ risqueCharger(getClients()).then(ch=>{ if(ch) renderRelancesCoach(); }).catch(()=>{}); }catch(e){}
}

// ── L'ÉCRAN ───────────────────────────────────────────────────────────────
function renderRelancesCoach(){
  const z=document.getElementById('rel-corps');
  if(!z||!currentUser) return false;
  const pause=relancesEnPause(currentUser);
  const r=relancesRegles(currentUser);
  const sem=_relJournal?relCetteSemaine(_relJournal):null;
  const partis=sem?sem.filter(e=>e.statut==='parti'):[];
  let h='<div class="rel-frein'+(pause?' rel-frein-on':'')+'">'
    +'<div class="rel-frein-l"><b>Je reprends la main</b><span>'
    +(pause?'Rien ne part. Tes règles sont gardées telles quelles.':'Coupe tout, tout de suite, y compris ce qui allait partir aujourd’hui.')+'</span></div>'
    +'<label class="rel-switch"><input type="checkbox"'+(pause?' checked':'')+' onchange="relancesReprendreLaMain(this.checked)" aria-label="Je reprends la main"><span></span></label></div>';
  // LES ATHLÈTES À RISQUE, avant tout : un message proposé, jamais envoyé seul.
  try{ h+=_htmlRisqueRelances(); }catch(e){}
  // CE QUI EST PARTI CETTE SEMAINE : lisible en dix secondes.
  h+='<h2 class="rel-h">Cette semaine</h2>';
  if(!sem) h+=etatChargement(2);
  else if(!sem.length) h+=emptyState('','Rien n’est parti ces sept derniers jours.',null,null,'padding:12px 0');
  else h+='<div class="rel-sem-n">'+partis.length+' message'+(partis.length>1?'s':'')+' parti'+(partis.length>1?'s':'')
    +(sem.length>partis.length?', '+(sem.length-partis.length)+' pas parti'+(sem.length-partis.length>1?'s':''):'')+'</div>'
    +sem.map(e=>_relLigneJournal(e,_relNom(e.cle))).join('');
  // LES RÈGLES : une ligne par signal, dans l'ordre de « À traiter ».
  h+='<h2 class="rel-h">Les règles</h2>'
    +'<p class="sub rel-p">Un message par athlète sur sept jours au plus, tous signaux confondus. Le texte par défaut est celui de tes relances WhatsApp ; tu peux écrire le tien, il est toujours précédé du prénom. Une ligne que tu reportes dans « Mes notifications » ne part pas.</p>';
  // Les cinq réglables d'abord, puis les onze qui ne le seront jamais : le
  // coach règle en haut, et lit en bas pourquoi le reste n'y est pas.
  const lignes=RELANCE_LIGNES.filter(l=>l.auto).concat(RELANCE_LIGNES.filter(l=>!l.auto));
  for(const l of lignes){
    if(!l.auto){
      if(l===lignes.find(x=>!x.auto)) h+='<h2 class="rel-h">Jamais automatiques</h2>';
      h+='<div class="rel-l rel-l-off"><div class="rel-l-t">'+escapeHtml(l.lib)+'</div>'
        +'<div class="rel-l-r">'+escapeHtml(l.raison)+'</div></div>';
      continue;
    }
    const x=r[l.type];
    const _delais=l.type==='inactif'?RELANCE_DELAIS_INACTIF:RELANCE_DELAIS;
    const _perso=relancesTextes(currentUser)[l.type]||'';
    h+='<div class="rel-l'+(x.actif?' rel-l-on':'')+'">'
      +'<div class="rel-l-h"><div class="rel-l-t">'+escapeHtml(l.lib)+'</div>'
      +'<label class="rel-switch"><input type="checkbox"'+(x.actif?' checked':'')+' onchange="relancesRegler(\''+l.type+'\',\'actif\',this.checked)" aria-label="'+escapeHtml(l.lib)+'"><span></span></label></div>'
      +'<div class="rel-l-r">Le signal se lève '+escapeHtml(l.type==='inactif'?'après '+l.quand.replace('N',String(x.delai))+' ni bilan':l.quand)+'.</div>'
      +'<div class="rel-l-c"><label>Après <select onchange="relancesRegler(\''+l.type+'\',\'delai\',this.value)">'
      +(l.type==='inactif'&&_delais.indexOf(x.delai)<0?[x.delai].concat(_delais).sort((a,b)=>a-b):_delais).map(d=>'<option value="'+d+'"'+(d===x.delai?' selected':'')+'>'+(d?d+' jour'+(d>1?'s':''):'le jour même')+'</option>').join('')
      +'</select></label><label>Par <select onchange="relancesRegler(\''+l.type+'\',\'moyen\',this.value)">'
      +Object.keys(RELANCE_MOYENS).map(m=>'<option value="'+m+'"'+(m===x.moyen?' selected':'')+'>'+escapeHtml(RELANCE_MOYENS[m])+'</option>').join('')
      +'</select></label></div>'
      // LE TEXTE DU COACH, et son aperçu tel qu'il partira.
      +(x.actif?'<div class="rel-txt"><label for="rel-txt-'+l.type+'">Ton texte <span>facultatif, '+RELANCE_TEXTE_MAX+' caractères au plus'
        +(l.type==='inactif'?' ; {prénom} et {jours} sont remplacés':' ; {prénom} est remplacé')+'</span></label>'
        +'<textarea id="rel-txt-'+l.type+'" rows="3" maxlength="'+RELANCE_TEXTE_MAX+'" placeholder="'+escapeHtml(relanceCorpsDefaut(l.type))+'" oninput="relApercu(\''+l.type+'\')" onchange="relancesTexte(\''+l.type+'\',this.value)">'+escapeHtml(_perso)+'</textarea>'
        +'<div class="rel-ap"><span>Aperçu</span><div id="rel-ap-'+l.type+'">'+escapeHtml(_relApercuTexte(l.type,_perso,x.delai))+'</div></div>'
        +(_perso?'<button type="button" class="rel-defaut" onclick="relancesTexte(\''+l.type+'\',\'\')">Revenir au texte par défaut</button>':'')+'</div>':'')
      +'</div>';
  }
  z.innerHTML=h;
  return true;
}

// ── LA FICHE DE L'ATHLÈTE : la dernière relance, et l'exclusion ───────────
function _relHtmlFiche(c,liste){
  const exclu=relanceExclu(currentUser,c);
  const der=(liste||[]).find(e=>e.statut==='parti');
  const em=escapeHtml(c.email||'');
  return '<div class="rel-fiche">'
    +'<div class="rel-fiche-l">'+(der
      ?'Dernière relance automatique le '+escapeHtml(new Date(der.at).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}))+' : '+escapeHtml((RELANCE_LIB[der.signal]||'').toLowerCase())
        +', '+escapeHtml((RELANCE_MOYENS[der.moyen]||'').toLowerCase())+'.'
      :'Aucune relance automatique ne lui est partie.')
    +(exclu?' <b>Exclu des relances automatiques.</b>':(relancesAllumees(currentUser)?'':' Tes relances sont coupées.'))+'</div>'
    +'<button type="button" class="rel-lien" onclick="relanceExclure(\''+em+'\','+(exclu?'false':'true')+')">'
    +(exclu?'Le réintégrer aux relances':'L’exclure des relances automatiques')+'</button></div>';
}
function renderRelanceFiche(c){
  const z=document.getElementById('ccd-relance');
  if(!z||!c) return false;
  const k=_relCle(c);
  const liste=_relJournal?_relJournal.filter(e=>e.cle===k):[];
  z.innerHTML=_relHtmlFiche(c,liste);
  if(!_relJournal) _relChargerJournal().then(l=>{ if(_relJournal) z.innerHTML=_relHtmlFiche(c,l.filter(e=>e.cle===k)); });
  return true;
}

// ── CÔTÉ ATHLÈTE : le message privé (moyen « canal ») ─────────────────────
const RELANCE_VUE_CLE='rc_relance_vue';
// PURE. Le message à montrer : le dernier parti par l'app, de moins de sept
// jours, pas encore fermé.
function relanceAMontrer(journal,vueJusqua,t){
  const n=Number(t)||Date.now();
  const l=Object.keys((journal&&typeof journal==='object')?journal:{}).map(id=>journal[id])
    .filter(e=>e&&e.statut==='parti'&&(e.moyen==='canal'||(e.moyen==='ia_valide'&&e.voie==='canal'))&&n-Number(e.at)<RELANCE_FENETRE_J*864e5&&Number(e.at)>(Number(vueJusqua)||0))
    .sort((a,b)=>Number(b.at)-Number(a.at));
  return l[0]||null;
}
let _relAthCache=null;
async function _rendreRelanceAthlete(u){
  const z=document.getElementById('clh-relance');
  if(!z) return false;
  const coach=u&&u.coachEmailKey, moi=_relCle(u);
  if(!coach||!moi){ z.innerHTML=''; return false; }
  const cle=coach+'/'+moi;
  let r=_relAthCache&&_relAthCache.cle===cle&&Date.now()-_relAthCache.lu<10*60e3?_relAthCache.r:null;
  if(!r){ r=await _fbJson('relances_auto/'+cle); if(r.ok) _relAthCache={cle,lu:Date.now(),r}; }
  let vue=0; try{ vue=Number(localStorage.getItem(RELANCE_VUE_CLE))||0; }catch(e){}
  const m=r.ok?relanceAMontrer(r.v,vue,Date.now()):null;
  if(!m){ z.innerHTML=''; return false; }
  z.innerHTML='<div class="rel-carte"><div class="rel-carte-t">Un mot de ton coach</div>'
    +'<div class="rel-carte-l">'+escapeHtml(m.texte||'')+'</div>'
    +'<div class="rel-carte-b"><button type="button" class="btn btn-outline btn-sm" onclick="relanceVue('+Number(m.at)+')">Compris</button>'
    // LOT M2 : répondre en privé, dans le fil.
    +'<button type="button" class="btn btn-red btn-sm" onclick="relanceVue('+Number(m.at)+');msgOuvrirFil()">Répondre</button></div></div>';
  return true;
}
function relanceVue(at){
  try{ localStorage.setItem(RELANCE_VUE_CLE,String(Number(at)||Date.now())); }catch(e){}
  const z=document.getElementById('clh-relance');
  if(z) z.innerHTML='';
  return true;
}
// ══ LOT T8 : LA VUE DU LUNDI MATIN (29/09/2026) ═══════════════════════════
//
// Un athlète par ligne, rangé par ce qui appelle une action : le prénom, le
// signal en trois mots, depuis quand. Un clic ouvre la fiche À L'ENDROIT du
// signal.
//
// ⚠ ELLE NE RECALCULE RIEN. Elle LIT signauxEntrainement, avec la même
//   variante que la liste d'athlètes (urgencyScore) : le cache est déjà chaud
//   quand la liste a été affichée. Mesuré sur vingt dossiers (banc) : froid,
//   7 à 43 ms selon l'historique, 64 ms au pire en processeur bridé ; chaud,
//   moins d'une milliseconde. Froid, la liste se remplit par paquets plutôt
//   que de faire attendre. Un compteur (_signauxCalculs) le vérifie en test.
// ⚠ AUCUN SCORE, AUCUN CLASSEMENT DES ATHLÈTES ENTRE EUX. Le rang est celui du
//   SIGNAL (santé avant intendance) ; à signal égal, le plus ancien d'abord.
// ⚠ « DEPUIS QUAND » N'EST JAMAIS INVENTÉ : la date de la première séance ou
//   semaine qui a levé le signal quand elle existe, sinon « en ce moment ».

// ══ LE SIGNAL PRINCIPAL D'UN ATHLÈTE (06/10/2026) ════════════════════════
// « À traiter » et le point du lundi donnaient des verdicts opposés : Léa
// (bilan sans réponse, volume sous le minimum), Hugo (bloc terminé), Julie
// (bilan en retard) et Tom (inscrit, rien fait) étaient « Rien à signaler »
// le lundi et présents dans les notifications. Le lundi ne lisait que les
// signaux d'entraînement.
//
// UN SEUL ORDRE, LES MÊMES PRÉDICATS, LES MÊMES REPORTS. Chaque signal est
// lu avec la condition et la clé de report (isAlertSnoozed) de la ligne
// d'« À traiter » qui le porte : reporté là, il l'est ici, jusqu'à la même
// échéance. Au-delà des signaux nommés, tout ce qui fait une ligne dans « À
// traiter » (vidéo, note, accès, programme à écrire…) donne 'autre' : un
// athlète qui a une ligne n'est jamais « Rien à signaler ».
const SIGNAL_CATS=Object.freeze(['drapeau','douleur','bilan','message','retard','fatigue','regression','plateau',
  'volume','forme','absence','bloc','nostart','autre','rien']);
const LUNDI_RANGS=SIGNAL_CATS;
const LUNDI_CIBLE=Object.freeze({drapeau:'ccd-securite',douleur:'ccd-douleur',bilan:'bilan',message:'message',retard:null,
  fatigue:'ccd-volume',regression:'ccd-plateaux',plateau:'ccd-plateaux',volume:'ccd-volume',forme:'ccd-volume',
  absence:'ccd-sessions-recap',bloc:'bloc',nostart:null,autre:null,rien:null});
const LUNDI_PAQUET=4;
/**
 * PURE (lit le dossier, les signaux en cache et les reports du coach).
 * @param {any} c
 * @param {{sg?:any, drapeau?:any, proposition?:any, maintenant?:number, messages?:Set<string>, acc?:any, u?:any}} [ctx]
 * @returns {{cat:string, libelle:string, depuis:number|null, cible:string|null}}
 */
function signalPrincipal(c,ctx){
  const x=ctx||{}, t=Number(x.maintenant)||Date.now();
  const id=c&&c.id;
  const r=(cat,libelle,depuis)=>({cat,libelle,depuis:Number(depuis)>0?Number(depuis):null,cible:LUNDI_CIBLE[cat]||null});
  if(!c) return r('rien','Rien à signaler');
  const ok=f=>{ try{ return !!f(); }catch(e){ return false; } };
  const rep=(type,vu)=>ok(()=>isAlertSnoozed(type,id,vu||0,c));
  const sg=('sg' in x)?(x.sg||{}):(()=>{ try{ return signauxEntrainement(c)||{}; }catch(e){ return {}; } })();
  const d=sg.details||{};
  const dr=('drapeau' in x)?x.drapeau:(()=>{ try{ return drapeauQuelconqueActif(c)||null; }catch(e){ return null; } })();
  const pr=('proposition' in x)?x.proposition:(()=>{ try{ return propositionDechargeOuverte(c)||null; }catch(e){ return null; } })();
  const acc=x.acc||(()=>{ try{ return accueilLignesCoach([c],t); }catch(e){ return {prog:[],retour:[],silence:new Set()}; } })();
  const enAccueil=acc.silence&&acc.silence.has(id);
  // 1. Santé : le drapeau (jamais reportable), puis la douleur.
  if(dr) return r('drapeau','Drapeau rouge santé',dr.date);
  if(sg.douleur&&!rep('douleur')){
    const dates=((d.douleur&&d.douleur.dates)||[]).map(Number).filter(n=>n>0);
    return r('douleur','Douleur répétée',dates.length?Math.min(...dates):null);
  }
  if(sg.douleurDiffuse&&!rep('douleurdiff')) return r('douleur','Douleurs diffuses');
  // 2. Ce qu'une personne attend.
  const lt=(c.bilans||[]).reduce((m,b)=>Math.max(m,Number(b&&b.date)||0),0);
  if(!x.sansBilan&&!enAccueil&&ok(()=>hasNewBilan(c))&&!rep('bilan',lt)) return r('bilan','Bilan sans réponse',lt);
  const msg=x.messages?x.messages.has(id):ok(()=>msgClientsSansReponse([c],t).length>0);
  if(msg&&!rep('message')) return r('message','Message sans réponse');
  if(!c._fromCode&&ok(()=>needsAlert(c))&&!rep('overdue')) return r('retard','Bilan en retard');
  // 3. L'entraînement : même précédence que les libellés d'« À traiter ».
  if(pr&&!rep('entrainement')) return r('fatigue','Décharge proposée',pr.creeLe);
  const repEnt=rep('entrainement');
  if(sg.plateauMuscle&&!repEnt){
    const p=d.plateauMuscle||{};
    const depuis=Number(p.joursRecord)>0?t-Number(p.joursRecord)*864e5:null;
    return p.regression?r('regression','Charges en baisse',depuis):r('plateau','Progression bloquée',depuis);
  }
  if(sg.sousMEV&&!repEnt) return r('volume','Volume sous le minimum');
  if(sg.formeBasse&&!repEnt) return r('forme','Forme en baisse');
  if(sg.decrochage&&!rep('decrochage')) return r('absence','Séances écourtées');
  if(sg.chuteAssiduite&&!repEnt) return r('absence','Assiduité en baisse');
  // 4. Le bloc, puis le démarrage.
  const f=(()=>{ try{ return finProgramme(c,t); }catch(e){ return null; } })();
  if(f&&!rep('progfin')) return r('bloc',f.suivant?'Bloc suivant prêt':f.fini?'Bloc terminé':'Bloc qui se termine',f.finPrevue);
  if(sg.blocPrioriteFini&&!rep('blocfini')) return r('bloc','Bloc de priorité terminé');
  if(!enAccueil&&ok(()=>neverStarted(c))&&!rep('nostart')) return r('nostart','Jamais démarré');
  // 5. Tout ce qui fait encore une ligne dans « À traiter ».
  const autre=signalAutre(c,sg,acc,t,rep);
  if(autre) return r('autre',autre);
  return r('rien','Rien à signaler');
}
// Les lignes d'« À traiter » qui ne sont pas un signal nommé, AVEC LEURS
// PRÉDICATS (renderTodoBlock) : le libellé de la première qui s'applique.
function signalAutre(c,sg,acc,t,rep){
  const id=c.id, ok=f=>{ try{ return !!f(); }catch(e){ return false; } };
  const enAccueil=acc&&acc.silence&&acc.silence.has(id);
  if(acc&&(acc.prog||[]).some(a=>a&&a.id===id)&&!rep('accueil_prog')) return 'Programme à écrire';
  if(acc&&(acc.retour||[]).some(a=>a&&a.id===id)&&!rep('accueil_retour')) return 'Premier point de l’accueil';
  if(sg.sautDeCharge&&!rep('saut_charge')) return 'Charge en hausse marquée';
  if((sg.restrictionLongue||sg.volumeHaut)&&!rep('entrainement')) return sg.restrictionLongue?'Restriction prolongée':'Volume élevé';
  if(ok(()=>(c.videos||[]).some(videoNonCorrigee))&&!rep('videos')) return 'Vidéo à corriger';
  if(ok(()=>notesEchues(currentUser&&currentUser.coachNotes,id).length)&&!rep('notes')) return 'Note à revoir';
  if(!c._fromCode&&c.status==='COACHING_SUIVI'&&c.accessExpiry&&(c.accessExpiry-t)>0&&(c.accessExpiry-t)<14*864e5&&!rep('expiring')) return 'Accès qui expire';
  if(!c._fromCode){
    const l=(c.rites||[]).filter(q=>q&&q.date&&String(q.question||'').trim());
    const der=l[l.length-1], av=l[l.length-2];
    if(der&&!der.reponseCoach&&!(av&&!av.reponseCoach)) return 'Bilan de 4 semaines';
  }
  if(!c._fromCode&&!enAccueil&&ok(()=>!hasProgram(c))&&(c.bilans||[]).some(b=>b&&b.type==='depart')&&!rep('noprog')) return 'Sans programme';
  if(sg.calibrageDu&&!rep('calibrage')) return 'Calibrage à faire';
  if(ok(()=>lignesSansContact([c],currentUser&&currentUser.contacts,t,()=>rep('silence')).length)) return 'Sans échange récent';
  return '';
}
// PURE. La ligne d'un athlète, depuis ce qui est DÉJÀ calculé.
//   sg : signauxEntrainement(c) ; o : {drapeau, proposition, maintenant, messages, acc}
function lundiLigne(c,sg,o){
  const x=Object.assign({},o||{},{sg:sg||{}});
  if(!('drapeau' in x)) x.drapeau=null;
  if(!('proposition' in x)) x.proposition=null;
  const prenom=String((c&&c.fname)||'').trim()||String((c&&c.email)||'Athlète').split('@')[0];
  const sp=signalPrincipal(c,x);
  return {id:c&&c.id,prenom,cle:(()=>{ try{ return _relCle(c); }catch(e){ return ''; } })(),
    cat:sp.cat,signal:sp.libelle,depuis:sp.depuis,cible:sp.cible};
}
// PURE. L'ordre : le rang du signal, puis le plus ancien d'abord, puis ceux
// sans date. Jamais un score.
function lundiTrier(lignes){
  const r=l=>LUNDI_RANGS.indexOf(l.cat);
  return (lignes||[]).slice().sort((a,b)=>(r(a)-r(b))
    ||((a.depuis==null)-(b.depuis==null))||((a.depuis||0)-(b.depuis||0))
    ||String(a.prenom).localeCompare(String(b.prenom)));
}
function lundiDepuis(t){
  if(!(Number(t)>0)) return 'en ce moment';
  try{ return 'depuis le '+new Date(Number(t)).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }catch(e){ return 'en ce moment'; }
}
// La ligne d'un athlète, lue sur son dossier : les signaux (cache), le
// drapeau et la proposition de décharge (des champs déjà écrits).
function _lundiLire(c,ctx){
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){ sg=null; }
  let dr=null; try{ dr=drapeauQuelconqueActif(c)||null; }catch(e){ dr=null; }
  let pr=null; try{ pr=propositionDechargeOuverte(c); }catch(e){ pr=null; }
  return lundiLigne(c,sg,Object.assign({drapeau:dr,proposition:pr},ctx||{}));
}
function _htmlLundiLigne(l){
  const E=escapeHtml, id=E(String(l.id||''));
  return '<button type="button" class="ld-l ld-'+l.cat+'" onclick="lundiOuvrir(\''+id+'\',\''+l.cat+'\','+_attrArg(l.cle||'')+')">'
    +'<b>'+E(l.prenom)+'</b><span class="ld-s">'+E(l.signal)+'</span>'
    +'<span class="ld-d">'+(l.cat==='rien'?'':E(lundiDepuis(l.depuis)))+'</span></button>';
}
let _lundiJeton=0;
function renderLundi(){
  const z=document.getElementById('ld-corps');
  if(!z) return false;
  let clients=[]; try{ clients=getClients().filter(c=>c&&!c._fromCode); }catch(e){ clients=[]; }
  if(!clients.length){ z.innerHTML=emptyState('users','Aucun athlète suivi pour l’instant. Ils apparaissent ici dès qu’un athlète a rejoint ton équipe avec ton code.',null,null,''); return true; }
  const jeton=++_lundiJeton, lignes=[];
  // Ce qui se lit une fois pour tous : l'accueil et les fils sans réponse.
  const t=Date.now();
  let acc=null; try{ acc=accueilLignesCoach(clients,t); }catch(e){ acc=null; }
  let msgs=new Set(); try{ msgs=new Set(msgClientsSansReponse(clients,t).map(c=>c.id)); }catch(e){}
  const ctx={maintenant:t,messages:msgs,...(acc?{acc}:{})};
  const peindre=fini=>{
    if(jeton!==_lundiJeton) return;
    const l=lundiTrier(lignes);
    z.innerHTML=l.map(_htmlLundiLigne).join('')
      +(fini?'':'<div class="ld-attente">'+(clients.length-lignes.length)+' à lire…</div>');
  };
  let i=0;
  const paquet=()=>{
    if(jeton!==_lundiJeton) return;
    for(let k=0;k<LUNDI_PAQUET&&i<clients.length;k++,i++) lignes.push(_lundiLire(clients[i],ctx));
    peindre(i>=clients.length);
    if(i<clients.length) setTimeout(paquet,0);
  };
  paquet();
  return true;
}
function ouvrirLundi(){ go('s-coach-lundi'); renderLundi(); }
// Le clic : la fiche, puis l'onglet qui porte le bloc du signal, et le bloc.
function lundiOuvrir(id,cat,cle){
  if(!id) return false;
  const cible=LUNDI_CIBLE[cat];
  // LES TROIS GESTES QUI NE SONT PAS UN BLOC DE LA FICHE (06/10/2026) : la
  // réponse au bilan, le fil de messages, le bilan du bloc.
  if(cible==='bilan'){ currentClientId=id; try{ viewClientBilans(); evoTab('reponses'); }catch(e){ return false; } return true; }
  if(cible==='message'){ try{ msgOuvrirFil(cle||_relCle(getOwnedClient(id))); }catch(e){ return false; } return true; }
  if(cible==='bloc'){ try{ return _ouvrirProgfin(id); }catch(e){ return false; } }
  try{ openClientDetail(id,false,true); }catch(e){ return false; }
  if(!cible) return true;
  setTimeout(()=>{
    try{
      let el=document.getElementById(cible);
      for(const v of CCD_VUES){
        if(el&&el.offsetParent!==null) break;
        ccdVue(v); el=document.getElementById(cible);
      }
      if(el) (el.closest('section')||el).scrollIntoView({behavior:'smooth',block:'start'});
    }catch(e){}
  },350);
  return true;
}
// ══ « À TRAITER » : RIEN D'IMPORTANT NE PASSE SOUS LE PLAFOND (30/09/2026) ══
//
// Neuf athlètes en « Progression bloquée » et un nouveau bilan : les neuf
// lignes d'entraînement remplissaient les huit places, la ligne du bilan
// passait dans « + 2 autres », et « + 2 autres » ne s'ouvrait pas.
//
// ⚠ SIX LIGNES NE COMPTENT JAMAIS DANS LE PLAFOND : le drapeau rouge, le
//   nouveau bilan à lire, le bilan en retard, le message sans réponse, le
//   programme à écrire et le premier point de l'accueil. Le plafond ne s'applique qu'aux
//   autres, dans leur ordre de gravité. L'ordre de `rows` ne change pas :
//   `vues` en garde la suite, et window._todoRows reste `vues` (les index de
//   dismissTodoRow, ouvrirAjustement et des files sont ceux de l'écran).
// ⚠ AU-DELÀ DE TROIS ATHLÈTES pour un même signal d'entraînement, une ligne
//   « N athlètes · Progression bloquée » les regroupe ; elle ouvre une file
//   (« Athlète suivant »). Les douleurs restent une ligne par athlète : un
//   signe de santé se lit avec son détail, jamais en paquet.
// ⚠ « + N autres » se déplie (état en mémoire, jamais en localStorage).
// ⚠ Un report groupé passe par une feuille (une case par athlète), et tout
//   report s'annule pendant 6 s : alertStatus revient à l'identique.
const TODO_TOUJOURS_VISIBLES=Object.freeze(['drapeau','bilan','bilan_corrige','overdue','message','accueil_prog','accueil_retour']);
const TODO_GROUPE_SEUIL=3;
const TODO_ANNULER_MS=6000;
let _todoDeplie=false;
// PURE. Les lignes d'entraînement d'un même signal, au-delà de `seuil`
// athlètes, en une ligne ; à la place de la première, l'ordre reste celui de
// la gravité. Les lignes de santé ne se regroupent jamais.
function grouperLignesEntrainement(lignes,seuil){
  const s=Number(seuil)>0?Number(seuil):TODO_GROUPE_SEUIL;
  const l=Array.isArray(lignes)?lignes:[];
  const cle=r=>r.type+'|'+r.label;
  const n={};
  for(const r of l) if(r&&!r.sante) n[cle(r)]=(n[cle(r)]||0)+1;
  const out=[], faits={};
  for(const r of l){
    if(!r) continue;
    if(r.sante||n[cle(r)]<=s){ out.push(r); continue; }
    const k=cle(r);
    if(faits[k]){ faits[k].list.push(r.list[0]); continue; }
    faits[k]={type:r.type,icon:r.icon,color:r.color,label:r.label,list:[r.list[0]],groupe:true,sante:false};
    out.push(faits[k]);
  }
  return out;
}
// PURE. Les lignes affichées : toutes celles qui ne comptent pas dans le
// plafond, et les `max` premières des autres (toutes si `deplie`), DANS
// L'ORDRE DE `rows`.
function todoLignesVisibles(rows,max,deplie){
  const m=Number(max)>0?Number(max):TODO_MAX_LIGNES;
  let n=0;
  return (rows||[]).filter(r=>{
    if(TODO_TOUJOURS_VISIBLES.indexOf(r.type)>=0) return true;
    if(deplie) return true;
    n++;
    return n<=m;
  });
}
function todoDeplier(v){ _todoDeplie=!!v; try{ renderTodoBlock(getClients()); }catch(e){} }

// ── La file d'une ligne groupée : « Athlète suivant » ───────────────────
let _fileSignal=null;          // {type, label, ids}
function _entrerFileSignal(idx){
  const r=(window._todoRows||[])[idx];
  const ids=((r&&r.list)||[]).map(c=>c&&c.id).filter(Boolean);
  if(!ids.length){ _fileSignal=null; return false; }
  _fileSignal={type:r.type,label:r.label,ids};
  openClientDetail(ids[0]);
  return true;
}
// Les athlètes de la file placés après `idApres`, qui portent ENCORE le signal
// (non reporté entre-temps) : le compte reste honnête, comme pour les bilans.
function _fileSignalSuivants(idApres){
  const f=_fileSignal;
  if(!f) return [];
  const i=f.ids.indexOf(idApres);
  if(i<0) return [];
  return f.ids.slice(i+1).filter(id=>{
    try{
      const c=getOwnedClient(id);
      return !!c&&_lignesEntrainement([c]).some(r=>r.type===f.type&&r.label===f.label);
    }catch(e){ return false; }
  });
}
function _rendreFileSignal(id){
  let z=document.getElementById('ccd-file-signal');
  const suivants=_fileSignalSuivants(id);
  const dans=!!(_fileSignal&&_fileSignal.ids.indexOf(id)>=0);
  if(!dans){ if(z) z.remove(); return false; }
  if(!z){
    const tb=document.querySelector('#s-coach-client .topbar');
    if(!tb) return false;
    z=document.createElement('div'); z.id='ccd-file-signal'; z.className='td-file';
    tb.insertAdjacentElement('afterend',z);
  }
  const pos=_fileSignal.ids.indexOf(id)+1, tot=_fileSignal.ids.length;
  z.innerHTML='<span class="td-file-t">'+escapeHtml(_fileSignal.label)+' · '+pos+'/'+tot+'</span>'
    +(suivants.length?'<button type="button" class="btn btn-outline btn-sm td-file-b" onclick="_allerSignalSuivant()">Athlète suivant → ('+suivants.length+' restant'+(suivants.length>1?'s':'')+')</button>'
      :'<button type="button" class="btn btn-outline btn-sm td-file-b" onclick="_quitterFileSignal()">Fin de la file</button>');
  return true;
}
function _allerSignalSuivant(){
  const s=_fileSignalSuivants(currentClientId);
  if(!s.length){ _quitterFileSignal(); return false; }
  openClientDetail(s[0]);
  return true;
}
function _quitterFileSignal(){
  _fileSignal=null;
  const z=document.getElementById('ccd-file-signal'); if(z) z.remove();
  try{ retourDe('s-coach-client','s-coach-home'); }catch(e){}
}

// ── Reporter, et pouvoir revenir en arrière ─────────────────────────────
// Une copie EXACTE de ce que le report va toucher : les clés d'alertStatus
// (valeur d'avant, ou absence) et la longueur du journal de douleur.
function _todoInstantane(type,clients){
  const st=(currentUser&&currentUser.alertStatus)||{};
  const cles={};
  for(const c of clients){
    const k=type+'-'+c.id;
    cles[k]=Object.prototype.hasOwnProperty.call(st,k)?JSON.parse(JSON.stringify(st[k])):undefined;
  }
  return {cles,avaitStatus:!!(currentUser&&currentUser.alertStatus),
    journal:Array.isArray(currentUser&&currentUser.journalDouleur)?currentUser.journalDouleur.length:null};
}
function _todoRestaurer(inst){
  if(!inst||!currentUser) return false;
  if(!inst.avaitStatus){ delete currentUser.alertStatus; }
  else{
    if(!currentUser.alertStatus) currentUser.alertStatus={};
    for(const k of Object.keys(inst.cles)){
      if(inst.cles[k]===undefined) delete currentUser.alertStatus[k];
      else currentUser.alertStatus[k]=inst.cles[k];
    }
  }
  if(inst.journal===null) delete currentUser.journalDouleur;
  else if(Array.isArray(currentUser.journalDouleur)) currentUser.journalDouleur=currentUser.journalDouleur.slice(0,inst.journal);
  return true;
}
let _todoAnnulable=null, _todoAnnulerMinuteur=null;
// Reporte `clients` pour la ligne `r`, sauvegarde, redessine, propose d'annuler.
function todoReporter(r,clients){
  const l=(clients||[]).filter(Boolean);
  if(!r||r.nonReportable||!l.length) return false;
  const inst=_todoInstantane(r.type,l);
  l.forEach(c=>reporterAlerte(r.type,c));
  saveUser();
  renderTodoBlock(getClients());
  _todoAnnulable=inst;
  _todoProposerAnnuler(l.length>1?l.length+' athlètes reportés de 7 jours':(l[0].fname||'Athlète')+' reporté de 7 jours');
  return true;
}
function todoAnnulerReport(){
  const inst=_todoAnnulable;
  _todoAnnulable=null;
  if(_todoAnnulerMinuteur){ clearTimeout(_todoAnnulerMinuteur); _todoAnnulerMinuteur=null; }
  const z=document.getElementById('td-annuler'); if(z) z.remove();
  if(!inst) return false;
  _todoRestaurer(inst);
  saveUser();
  renderTodoBlock(getClients());
  return true;
}
function _todoProposerAnnuler(msg){
  let z=document.getElementById('td-annuler');
  if(!z){ z=document.createElement('div'); z.id='td-annuler'; z.className='td-annuler'; z.setAttribute('role','status'); document.body.appendChild(z); }
  z.innerHTML='<span>'+escapeHtml(msg)+'</span><button type="button" onclick="todoAnnulerReport()">Annuler</button>';
  if(_todoAnnulerMinuteur) clearTimeout(_todoAnnulerMinuteur);
  _todoAnnulerMinuteur=setTimeout(()=>{ _todoAnnulerMinuteur=null; _todoAnnulable=null; const x=document.getElementById('td-annuler'); if(x) x.remove(); },TODO_ANNULER_MS);
}
// La feuille d'une ligne groupée : une case par athlète, toutes cochées.
let _todoFeuille=null;         // {r, ids}
function _todoOuvrirFeuille(r){
  _todoFeuille={r,ids:r.list.map(c=>c.id)};
  document.getElementById('modal-overlay')?.remove();
  const cases=r.list.map(c=>{
    const ini=(c.lname||'').charAt(0);
    const nom=((c.fname||'')+(ini?' '+ini+'.':'')).trim()||'Athlète';
    return '<label class="td-case"><input type="checkbox" checked value="'+escapeHtml(String(c.id))+'" onchange="_todoCocher()"> '+escapeHtml(nom)+'</label>';
  }).join('');
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="_todoFermerFeuille()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Reporter" class="td-feuille">'
    +'<div class="td-feuille-t">'+escapeHtml(r.label)+'</div>'
    +'<div class="td-feuille-d">Qui reporter de 7 jours ?</div>'
    +'<div class="td-cases">'+cases+'</div>'
    +'<div class="td-feuille-pied"><button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="_todoFermerFeuille()">Retour</button>'
    +'<button type="button" id="td-feuille-ok" class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="_todoReporterFeuille()">Reporter 7 jours</button></div>'
    +'</div></div>');
}
function _todoCocher(){
  const b=document.getElementById('td-feuille-ok');
  if(b) b.disabled=!document.querySelectorAll('.td-case input:checked').length;
}
function _todoFermerFeuille(){ document.getElementById('modal-overlay')?.remove(); _todoFeuille=null; }
function _todoReporterFeuille(){
  const f=_todoFeuille;
  if(!f) return false;
  const coches=new Set([...document.querySelectorAll('.td-case input:checked')].map(i=>i.value));
  const l=f.r.list.filter(c=>coches.has(String(c.id)));
  _todoFermerFeuille();
  return todoReporter(f.r,l);
}

// ══ LA FIN D'UN PROGRAMME, DANS « À TRAITER » (30/09/2026) ═════════════════
//
// Un bloc (programmeDe : début, semaines) qui s'achève sans que rien ne le
// dise laisse l'athlète sans consigne le lundi suivant. La ligne « Bloc qui se
// termine » se lève sept jours avant le dernier jour du bloc (le dimanche de
// sa dernière semaine), devient « Bloc terminé » le lendemain, et tombe
// vingt et un jours après : au-delà, le coach a choisi de laisser tourner.
//
// ⚠ HORS D'urgencyScore, comme 'rite' et 'blocfini' : une décision à prendre,
//   pas une alerte. Bande « À traiter » (vert), groupée, reportable 7 jours.
// ⚠ UN NOUVEAU PROGRAMME pose un nouveau début : le calcul repart, le signal
//   tombe de lui-même. Rien n'est mémorisé.
// ⚠ LE CHEMIN : la ligne ouvre l'écran Programme de l'athlète sur « Bilan du
//   bloc » ; la feuille du bilan propose « Assigner le bloc suivant » (un
//   programme de la bibliothèque, un geste), qui ouvre l'assignation avec
//   l'athlète déjà coché. Trois gestes de la ligne à l'assignation.
const PROGFIN_AVANT_J=7, PROGFIN_APRES_J=21;
// PURE. null, ou {joursRestants (négatif une fois le bloc passé), fini, finPrevue (ms, minuit du dernier jour)}.
function finProgramme(c,maintenant){
  if(!c||c._fromCode) return null;
  // LE BLOC SUIVANT (06/10/2026). Démarré (sa date est passée, la bascule ne
  // s'est peut-être pas encore faite sur cet appareil) : c'est LUI qui se lit,
  // et un bloc qui vient de commencer ne se termine pas. Préparé, pas encore
  // démarré : la fin se signale, avec sa date (« bloc suivant prêt »).
  const _t=typeof maintenant==='number'?maintenant:Date.now();
  const ps=blocSuivantDe(c);
  if(ps&&_t>=ps.debut) return finProgramme(Object.assign({},c,{programme:{debut:ps.debut,semaines:ps.semaines},programmeSuivant:null}),_t);
  let p=null; try{ p=programmeDe(c); }catch(e){ p=null; }
  if(!p) return null;
  const fin=new Date(p.debut); fin.setHours(0,0,0,0);
  fin.setDate(fin.getDate()+p.semaines*7-1);      // le dimanche de la dernière semaine (setDate : heure d'été)
  const j=new Date(typeof maintenant==='number'?maintenant:Date.now()); j.setHours(0,0,0,0);
  const restants=Math.round((fin.getTime()-j.getTime())/864e5);
  if(!isFinite(restants)||restants>PROGFIN_AVANT_J||restants<-PROGFIN_APRES_J) return null;
  return Object.assign({joursRestants:restants,fini:restants<0,finPrevue:fin.getTime()},ps?{suivant:ps.debut}:{});
}
// PURE. Les lignes « À traiter » : une pour les blocs qui se terminent, une
// pour les blocs terminés (deux libellés, un seul type).
function lignesFinProgramme(clients,maintenant,reporte){
  const bientot=[], finis=[], prets=[];
  for(const c of (clients||[])){
    const f=finProgramme(c,maintenant);
    if(!f||(reporte&&reporte(c))) continue;
    (f.suivant?prets:f.fini?finis:bientot).push({c,f});
  }
  const ligne=(l,lib,coul)=>({type:'progfin',icon:icon('flag',16),color:coul||'var(--green)',label:lib,list:l.map(x=>x.c||x)});
  const out=[];
  // LE BLOC SUIVANT EST PRÊT : la ligne le dit, avec sa date, et passe en gris.
  for(const x of prets) out.push(ligne([x],'Bloc suivant prêt, démarre le '+_jourCourt(x.f.suivant),'var(--sub)'));
  if(bientot.length) out.push(ligne(bientot,'Bloc qui se termine'));
  if(finis.length) out.push(ligne(finis,'Bloc terminé'));
  return out;
}
function _jourCourt(t){ try{ return new Date(Number(t)).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){ return ''; } }
// ══ LE BLOC SUIVANT (06/10/2026) ══════════════════════════════════════════
// Il n'existait pas de bloc suivant programmé : à la fin d'un bloc, le coach
// reconduisait à la main, ou l'athlète restait sur l'ancien. Le dossier porte
// désormais programmeSuivant {debut, semaines, sessions_config}, une COPIE
// PROFONDE (le bloc courant modifié ensuite ne le touche pas), modifiable et
// supprimable jusqu'à son lundi. Ce lundi-là, il devient le programme courant
// (basculerBlocSuivant), côté athlète et côté coach, et c'est journalisé.
const BLOC_HISTO_MAX=12;
// PURE. Le lundi de la semaine qui suit `t`.
function lundiSuivant(t){ const d=_lundiDe(Number(t)||Date.now()); d.setDate(d.getDate()+7); return d.getTime(); }
// PURE. Le lundi où le bloc courant se termine (le lendemain de son dernier
// dimanche) ; sans bloc, le lundi suivant.
function finBlocLundi(c,t){
  let p=null; try{ p=programmeDe(c); }catch(e){ p=null; }
  if(!p) return lundiSuivant(t);
  const d=new Date(p.debut); d.setDate(d.getDate()+p.semaines*7);
  return _lundiDe(d).getTime();
}
// PURE. Le bloc suivant d'un dossier, normalisé, ou null.
function blocSuivantDe(c){
  const ps=c&&c.programmeSuivant;
  if(!ps||typeof ps!=='object') return null;
  const debut=Number(ps.debut), n=Math.round(Number(ps.semaines));
  if(!(debut>0)||!(n>=PROG_SEMAINES_MIN&&n<=PROG_SEMAINES_MAX)) return null;
  return {debut:_lundiDe(debut).getTime(),semaines:n,sessions_config:ps.sessions_config};
}
/**
 * ÉCRIT (le dossier `u`, rien d'autre). Au lundi prévu, et pas avant, le bloc
 * suivant devient le courant : séances, début, semaines ; l'ancien bloc va à
 * l'historique (programmeHisto). Rend true si la bascule a eu lieu.
 */
function basculerBlocSuivant(u,t){
  const ps=blocSuivantDe(u);
  const now=Number(t)||Date.now();
  if(!ps||now<ps.debut) return false;
  let ancien=null; try{ ancien=programmeDe(u); }catch(e){ ancien=null; }
  try{ if(typeof _pushSessionsHistory==='function') _pushSessionsHistory(u); }catch(e){}
  const sc=ps.sessions_config;
  u.sessions_config=JSON.parse(JSON.stringify(Array.isArray(sc)?sc:Object.values(sc||{})));
  u.programme={debut:ps.debut,semaines:ps.semaines,decharges:[],ecarts:{}};
  u.programmeHisto=(Array.isArray(u.programmeHisto)?u.programmeHisto:[]).concat([{
    le:now,de:ancien?{debut:ancien.debut,semaines:ancien.semaines}:null,a:{debut:ps.debut,semaines:ps.semaines}}]).slice(-BLOC_HISTO_MAX);
  delete u.programmeSuivant;
  u.updatedAt=now;
  return true;
}
// ── La file : un athlète après l'autre ──────────────────────────────────
let _fileProgfin=[];
function _entrerFileProgfin(idx){
  const r=(window._todoRows||[])[idx];
  _fileProgfin=((r&&r.list)||[]).map(c=>c&&c.id).filter(Boolean);
  if(!_fileProgfin.length) return false;
  return _ouvrirProgfin(_fileProgfin[0]);
}
// L'écran Programme de l'athlète, le bouton « Bilan du bloc » mis en avant.
function _ouvrirProgfin(id){
  currentClientId=id;
  if(!ouvrirSeancesSansBrouillon()) return false;
  setTimeout(()=>{
    const b=document.querySelector('#csm-bloc .bb-ouvrir');
    if(!b) return;
    try{ b.scrollIntoView({block:'center'}); }catch(e){}
    b.classList.add('pf-attention');
    try{ b.focus({preventScroll:true}); }catch(e){}
  },60);
  return true;
}
function _fileProgfinSuivants(idApres){
  const i=_fileProgfin.indexOf(idApres);
  if(i<0) return [];
  return _fileProgfin.slice(i+1).filter(id=>{ try{ return !!finProgramme(getOwnedClient(id)); }catch(e){ return false; } });
}
// La fin de la feuille « Bilan du bloc » : le bloc suivant, et l'athlète suivant.
function _htmlSuiteBilanBloc(c){
  // RECONDUIRE ET PRÉPARER (06/10/2026), EN TÊTE : le cas le plus fréquent est
  // de garder le programme de l'athlète, pas d'en prendre un autre.
  const ps=blocSuivantDe(c);
  const tete='<div class="bb-suite"><div class="bb-suite-t">Le bloc suivant</div><div class="bb-progs">'
    +'<button type="button" class="bb-prog bb-prog-1" onclick="progfinReconduire()">Reconduire ce bloc</button>'
    +(ps?'<button type="button" class="bb-prog" onclick="progfinOuvrirSuivant()">Bloc suivant prêt, démarre le '+escapeHtml(_jourCourt(ps.debut))+' · modifier</button>'
      :'<button type="button" class="bb-prog" onclick="progfinPreparerSuivant()">Préparer le bloc suivant</button>')
    +'</div></div>';
  return tete+_htmlSuiteBilanBlocBiblio(c);
}
function _htmlSuiteBilanBlocBiblio(c){
  const progs=((currentUser&&currentUser.coachPrograms)||[]).map((p,i)=>({p,i})).filter(x=>x.p);
  const enCours=c&&c.assignedProgramId;
  const suivants=_fileProgfinSuivants(c&&c.id);
  const boutons=progs.slice(-6).reverse().map(x=>'<button type="button" class="bb-prog" onclick="progfinAssigner('+x.i+')">'
    +escapeHtml(x.p.name||'Programme')+(enCours&&x.p.id===enCours?' <small>(en cours)</small>':'')+'</button>').join('');
  return '<div class="bb-suite"><div class="bb-suite-t">Assigner le bloc suivant</div>'
    +(progs.length?'<div class="bb-progs">'+boutons+'</div>'
      +(progs.length>6?'<button type="button" class="bb-lien" onclick="progfinTousProgrammes()">Tous mes programmes</button>':'')
      :'<div class="bb-s">Ta bibliothèque de programmes est vide.</div>')
    +(suivants.length?'<button type="button" class="btn btn-outline btn-sm bb-suivant" onclick="progfinSuivant()">Athlète suivant → ('+suivants.length+' restant'+(suivants.length>1?'s':'')+')</button>':'')
    +'</div>';
}
function progfinAssigner(idx){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  closeModal();
  openAssignProgram(idx,[c.id]);
  return true;
}
function progfinTousProgrammes(){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  SEL_ATHLETES.clear(); SEL_ATHLETES.add(c.id);
  closeModal();
  return selVersProgramme();
}
function progfinSuivant(){
  const s=_fileProgfinSuivants(currentClientId);
  closeModal();
  return s.length?_ouvrirProgfin(s[0]):false;
}
// Coche, dans un écran de destination, les athlètes voulus (value = id).
function _cocherIds(conteneur,ids){
  const veut=new Set((ids||[]).map(String));
  let n=0;
  try{
    document.querySelectorAll('#'+conteneur+' input[type=checkbox]').forEach(cb=>{
      if(veut.has(String(cb.value))){ cb.checked=true; n++; }
    });
  }catch(e){}
  return n;
}

// ══ ÉTIQUETTES D'ATHLÈTES ET DERNIER CONTACT (30/09/2026) ══════════════════
//
// Deux champs du dossier DU COACH, jamais de celui de l'athlète (comme
// coachNotes et motsLus) : aucun geste d'étiquetage ne réécrit le document
// d'un athlète, et un coach sur deux appareils retrouve les mêmes étiquettes
// par la synchronisation de son propre dossier.
//   etiquettes    {e0..e19: {lib (24 caractères au plus), couleur (#rrggbb)}}
//   etiquettesAth {<id de l'athlète>: ['e0','e3']}
//   contacts      {<id de l'athlète>: ms du dernier échange parti de l'app}
//
// ⚠ VINGT AU PLUS, ET LA RÈGLE DE LA BASE LE TIENT : les identifiants sont
//   e0 à e19, le motif de database.rules.json refuse tout le reste.
// ⚠ UNE ÉTIQUETTE SUPPRIMÉE est retirée de tous les athlètes ; un athlète
//   supprimé perd ses entrées (etiquettesOublierAthlete). Une lecture ne
//   montre jamais un identifiant sans étiquette : etiquettesAthlete filtre.
// ⚠ LE DERNIER CONTACT se lit aussi dans le dossier de l'athlète (réponse au
//   bilan, retour vidéo) : au premier jour, personne n'est déclaré silencieux
//   parce que le champ contacts vient d'apparaître.
const ETIQ_MAX=20, ETIQ_LIB_MAX=24;
const ETIQ_COULEURS=Object.freeze([ROUGE_MARQUE,'#f5c518','#22c55e','#3b82f6','#a855f7','#ec4899','#f97316','#14b8a6']);
const SANS_CONTACT_J=14;
let _filtreEtiquette=null;
function _etiqId(i){ return 'e'+i; }
// PURE. Les étiquettes du coach, dans l'ordre de leur identifiant.
function etiquettesDe(u){
  const t=(u&&u.etiquettes&&typeof u.etiquettes==='object')?u.etiquettes:{};
  const out=[];
  for(let i=0;i<ETIQ_MAX;i++){
    const e=t[_etiqId(i)];
    if(e&&typeof e==='object'&&String(e.lib||'').trim()) out.push({id:_etiqId(i),lib:String(e.lib).slice(0,ETIQ_LIB_MAX),couleur:/^#[0-9a-fA-F]{6}$/.test(e.couleur)?e.couleur:ETIQ_COULEURS[0]});
  }
  return out;
}
// PURE. Les identifiants posés sur un athlète, seulement ceux qui existent.
function etiquettesAthlete(u,athId){
  const l=(u&&u.etiquettesAth&&u.etiquettesAth[athId])||[];
  const t=(u&&u.etiquettes)||{};
  return (Array.isArray(l)?l:Object.values(l)).filter((x,i,a)=>t[x]&&a.indexOf(x)===i);
}
// PURE. Le filtrage de la liste : les athlètes qui portent cette étiquette.
function athletesAvecEtiquette(clients,etiqId,u){
  if(!etiqId) return (clients||[]).slice();
  return (clients||[]).filter(c=>c&&etiquettesAthlete(u,c.id).indexOf(etiqId)>=0);
}
function _etiqLib(lib){ return String(lib||'').replace(/\s+/g,' ').trim().slice(0,ETIQ_LIB_MAX); }
function etiquetteCreer(lib,couleur){
  const u=currentUser;
  if(!u||u.role!=='coach') return null;
  const l=_etiqLib(lib);
  if(!l){ toast('Donne un nom à l’étiquette.','var(--orange)'); return null; }
  const liste=etiquettesDe(u);
  const deja=liste.find(e=>norm(e.lib)===norm(l));
  if(deja) return deja.id;
  if(!u.etiquettes||typeof u.etiquettes!=='object') u.etiquettes={};
  let id=null;
  for(let i=0;i<ETIQ_MAX;i++) if(!u.etiquettes[_etiqId(i)]){ id=_etiqId(i); break; }
  if(!id){ toast('Vingt étiquettes au plus : supprimes-en une d’abord.','var(--orange)'); return null; }
  u.etiquettes[id]={lib:l,couleur:ETIQ_COULEURS.indexOf(couleur)>=0?couleur:ETIQ_COULEURS[liste.length%ETIQ_COULEURS.length]};
  saveUser();
  return id;
}
function etiquetteRenommer(id,lib){
  const u=currentUser, l=_etiqLib(lib);
  if(!u||!u.etiquettes||!u.etiquettes[id]||!l) return false;
  u.etiquettes[id].lib=l;
  saveUser();
  return true;
}
// Retirée de tous les athlètes, et du filtre si c'était lui.
function etiquetteSupprimer(id){
  const u=currentUser;
  if(!u||!u.etiquettes||!u.etiquettes[id]) return false;
  delete u.etiquettes[id];
  const a=u.etiquettesAth||{};
  for(const k of Object.keys(a)){
    const l=(Array.isArray(a[k])?a[k]:Object.values(a[k]||{})).filter(x=>x!==id);
    if(l.length) a[k]=l; else delete a[k];
  }
  if(_filtreEtiquette===id) _filtreEtiquette=null;
  saveUser();
  return true;
}
// Pose (ou retire) une étiquette sur plusieurs athlètes : UNE sauvegarde.
function etiquetterAthletes(ids,etiqId,poser){
  const u=currentUser;
  if(!u||!u.etiquettes||!u.etiquettes[etiqId]) return 0;
  if(!u.etiquettesAth||typeof u.etiquettesAth!=='object') u.etiquettesAth={};
  let n=0;
  for(const id of (ids||[])){
    if(!id) continue;
    const l=etiquettesAthlete(u,id);
    const a=l.indexOf(etiqId)>=0;
    if(poser===false){ if(!a) continue; const r=l.filter(x=>x!==etiqId); if(r.length) u.etiquettesAth[id]=r; else delete u.etiquettesAth[id]; }
    else { if(a) continue; u.etiquettesAth[id]=l.concat(etiqId).slice(0,ETIQ_MAX); }
    n++;
  }
  if(n) saveUser();
  return n;
}
// Un athlète supprimé : ses étiquettes et son dernier contact partent avec lui.
function etiquettesOublierAthlete(u,athId){
  if(!u||!athId) return false;
  let fait=false;
  if(u.etiquettesAth&&u.etiquettesAth[athId]){ delete u.etiquettesAth[athId]; fait=true; }
  if(u.contacts&&u.contacts[athId]){ delete u.contacts[athId]; fait=true; }
  if(u.chrono&&typeof u.chrono==='object') for(const w of Object.keys(u.chrono)) if(u.chrono[w]&&u.chrono[w][athId]){ delete u.chrono[w][athId]; fait=true; }
  return fait;
}

// ── Le dernier contact ─────────────────────────────────────────────────
// Posé par chaque échange parti de l'app : réponse au bilan (écrite ou
// vocale), retour vidéo, lien WhatsApp ouvert, message de la messagerie.
function noterContact(athId,t){
  try{
    const u=currentUser;
    if(!u||u.role!=='coach'||!athId) return false;
    if(!u.contacts||typeof u.contacts!=='object') u.contacts={};
    u.contacts[athId]=Number(t)||Date.now();
    saveUser();
    return true;
  }catch(e){ return false; }
}
// PURE. Le dernier échange connu : le champ du coach, ou ce que le dossier de
// l'athlète en garde (une réponse au bilan, un retour vidéo). 0 si rien.
function dernierContact(c,contacts){
  if(!c) return 0;
  let t=Number(contacts&&contacts[c.id])||0;
  for(const b of (c.bilans||[])) if(b&&(b.reponseCoach||b.reponseAudio)) t=Math.max(t,Number(b.reponseDate)||0);
  for(const v of (c.videos||[])) if(v&&v.feedbackDate) t=Math.max(t,Number(v.feedbackDate)||0);
  return t;
}
// PURE. Vrai quand rien n'a été échangé depuis `jours` jours. Un athlète
// rattaché depuis moins longtemps n'est pas encore silencieux : la date de
// rattachement compte comme un premier échange.
function sansContact(c,contacts,maintenant,jours){
  if(!c||c._fromCode) return false;
  const j=Number(jours)>0?Number(jours):SANS_CONTACT_J;
  const t=Number(maintenant)||Date.now();
  const ref=Math.max(dernierContact(c,contacts),dateRattachement(c));
  return t-ref>=j*864e5;
}
// PURE. La ligne « À traiter » : les athlètes actifs sans échange.
function lignesSansContact(clients,contacts,maintenant,reporte){
  const l=(clients||[]).filter(c=>c&&!c._fromCode&&isActive(c)&&sansContact(c,contacts,maintenant)&&!(reporte&&reporte(c)));
  return l.length?[{type:'silence',icon:icon('message-circle',16),color:'var(--green)',label:'Sans échange depuis '+SANS_CONTACT_J+' j',list:l}]:[];
}

// ── L'interface ────────────────────────────────────────────────────────
function _etiqPuce(e,extra){
  return '<span class="etq-puce" style="--etq:'+e.couleur+'">'+escapeHtml(e.lib)+(extra||'')+'</span>';
}
// Les puces-filtres, sous la barre d'état du portefeuille. Rien sans étiquette.
function renderFiltresEtiquettes(){
  const z=document.getElementById('ch-etiq-filtres');
  if(!z) return;
  const l=etiquettesDe(currentUser);
  if(_filtreEtiquette&&!l.some(e=>e.id===_filtreEtiquette)) _filtreEtiquette=null;
  if(!l.length){ z.innerHTML=''; z.style.display='none'; return; }
  z.style.display='';
  const a=(currentUser&&currentUser.etiquettesAth)||{};
  const compte=id=>Object.keys(a).filter(k=>etiquettesAthlete(currentUser,k).indexOf(id)>=0).length;
  z.innerHTML=l.map(e=>'<button type="button" class="etq-filtre" style="--etq:'+e.couleur+'" aria-pressed="'+(_filtreEtiquette===e.id)+'" onclick="setFiltreEtiquette('+_attrArg(e.id)+')">'
      +escapeHtml(e.lib)+' <b>'+compte(e.id)+'</b></button>').join('')
    +'<button type="button" class="etq-gerer" onclick="ouvrirEtiquettes()">Gérer</button>';
}
function setFiltreEtiquette(id){
  _filtreEtiquette=(_filtreEtiquette===id)?null:id;
  renderClientList();
  return _filtreEtiquette;
}
// La feuille : poser ou retirer sur `ids` (la sélection, ou un athlète),
// créer, renommer, supprimer. Sans `ids`, c'est la gestion seule.
let _etiqCibles=[];
function ouvrirEtiquettes(ids){
  _etiqCibles=Array.isArray(ids)?ids.filter(Boolean):[];
  closeModal();
  document.body.insertAdjacentHTML('beforeend',`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" class="etq-feuille" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;animation:fadeIn var(--t-3) var(--c-out);max-height:88vh;overflow-y:auto">
    <div id="etq-corps"></div>
    <button class="btn btn-outline" style="margin-top:12px" onclick="closeModal();renderClientList()">Fermer</button>
  </div></div>`);
  _etiqRepeindre();
  return true;
}
function _etiqRepeindre(){
  const z=document.getElementById('etq-corps');
  if(!z) return;
  const l=etiquettesDe(currentUser), ids=_etiqCibles, n=ids.length;
  const titre=n?('Étiqueter '+(n>1?n+' athlètes':escapeHtml(_nomAthlete(getOwnedClient(ids[0])||{})||'cet athlète'))):'Mes étiquettes';
  const lignes=l.map(e=>{
    const ont=ids.filter(id=>etiquettesAthlete(currentUser,id).indexOf(e.id)>=0).length;
    const act=n
      ?(ont<n?'<button type="button" class="btn btn-red btn-sm etq-b" onclick="_etiqPoser('+_attrArg(e.id)+',true)">Ajouter</button>':'')
        +(ont?'<button type="button" class="btn btn-outline btn-sm etq-b" onclick="_etiqPoser('+_attrArg(e.id)+',false)">Retirer</button>':'')
      :'<button type="button" class="btn btn-outline btn-sm etq-b" onclick="_etiqRenommer('+_attrArg(e.id)+')">Renommer</button>'
        +'<button type="button" class="btn btn-outline btn-sm etq-b" onclick="_etiqSupprimer('+_attrArg(e.id)+')">Supprimer</button>';
    return '<div class="etq-ligne">'+_etiqPuce(e)+(n&&ont?'<span class="sub etq-ont">'+(n>1?ont+' sur '+n:'posée')+'</span>':'')+'<div style="flex:1"></div>'+act+'</div>';
  }).join('');
  z.innerHTML='<h2 style="margin-bottom:4px">'+titre+'</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);margin-bottom:10px">Tes étiquettes ne sont visibles que par toi.</p>'
    +(lignes||'<div class="sub" style="font-size:var(--fs-sm);padding:6px 0 10px">Aucune étiquette pour l’instant.</div>')
    +(l.length<ETIQ_MAX
      ?'<div class="etq-nouvelle"><label for="etq-lib" style="margin-top:10px">Nouvelle étiquette</label>'
        +'<div style="display:flex;gap:8px"><input id="etq-lib" maxlength="'+ETIQ_LIB_MAX+'" placeholder="ex. Prépa compét" style="flex:1;margin:0">'
        +'<button type="button" class="btn btn-red btn-sm" style="margin:0;min-height:44px" onclick="_etiqCreer()">Créer</button></div>'
        +'<div class="etq-couleurs" role="radiogroup" aria-label="Couleur">'+ETIQ_COULEURS.map((c,i)=>'<button type="button" role="radio" aria-checked="'+(i===0)+'" aria-label="Couleur '+(i+1)+'" style="--etq:'+c+'" onclick="_etiqCouleur(this)"></button>').join('')+'</div></div>'
      :'<div class="sub" style="font-size:var(--fs-xs);margin-top:10px">Vingt étiquettes : c’est le maximum.</div>');
}
function _etiqCouleur(b){
  b.parentNode.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(x===b)));
}
function _etiqCreer(){
  const i=document.getElementById('etq-lib');
  const b=document.querySelector('.etq-couleurs [aria-checked="true"]');
  const id=etiquetteCreer(i&&i.value,b?getComputedStyle(b).getPropertyValue('--etq').trim():'');
  if(!id) return false;
  if(_etiqCibles.length) etiquetterAthletes(_etiqCibles,id,true);
  _etiqRepeindre(); _etiqApres();
  return id;
}
function _etiqPoser(id,poser){
  etiquetterAthletes(_etiqCibles,id,poser);
  _etiqRepeindre(); _etiqApres();
  return true;
}
async function _etiqRenommer(id){
  const e=etiquettesDe(currentUser).find(x=>x.id===id);
  if(!e) return false;
  const v=prompt('Nouveau nom de l’étiquette',e.lib);
  if(v==null) return false;
  etiquetteRenommer(id,v);
  _etiqRepeindre(); _etiqApres();
  return true;
}
async function _etiqSupprimer(id){
  const e=etiquettesDe(currentUser).find(x=>x.id===id);
  if(!e) return false;
  if(!(await rcConfirm('Supprimer « '+e.lib+' » ?','Elle sera retirée de tous tes athlètes.','Supprimer','Garder'))) return false;
  etiquetteSupprimer(id);
  _etiqRepeindre(); _etiqApres();
  return true;
}
// Ce qui montre les étiquettes se repeint : les puces, et la fiche ouverte.
function _etiqApres(){
  try{ renderFiltresEtiquettes(); }catch(e){}
  try{ const c=currentClientId&&getOwnedClient(currentClientId); if(c) _rendreEtiquettesFiche(c); }catch(e){}
}
// Sur la fiche : les pastilles, chacune retirable, et « + Étiquette ».
function _rendreEtiquettesFiche(c){
  const z=document.getElementById('ccd-etiq');
  if(!z) return;
  if(!c||c._fromCode||!currentUser||currentUser.role!=='coach'){ z.innerHTML=''; return; }
  const t=etiquettesDe(currentUser), l=etiquettesAthlete(currentUser,c.id);
  z.innerHTML=t.filter(e=>l.indexOf(e.id)>=0).map(e=>_etiqPuce(e,'<button type="button" class="etq-x" aria-label="Retirer '+escapeHtml(e.lib)+'" onclick="etiquetterAthletes(['+_attrArg(c.id)+'],'+_attrArg(e.id)+',false);_etiqApres()">'+icon('croix',14)+'</button>')).join('')
    +'<button type="button" class="etq-plus" onclick="ouvrirEtiquettes(['+_attrArg(c.id)+'])">+ Étiquette</button>';
}
// « Cocher l'étiquette… » : dans les trois écrans qui cochent des athlètes.
function _htmlCocherEtiquette(conteneur){
  const l=etiquettesDe(currentUser);
  if(!l.length) return '';
  return '<select class="etq-cocher" aria-label="Cocher les athlètes d’une étiquette" onchange="cocherEtiquette('+_attrArg(conteneur)+',this.value);this.selectedIndex=0">'
    +'<option value="">Cocher l’étiquette…</option>'
    +l.map(e=>'<option value="'+e.id+'">'+escapeHtml(e.lib)+'</option>').join('')+'</select>';
}
function cocherEtiquette(conteneur,etiqId){
  if(!etiqId) return 0;
  const a=(currentUser&&currentUser.etiquettesAth)||{};
  const ids=Object.keys(a).filter(k=>etiquettesAthlete(currentUser,k).indexOf(etiqId)>=0);
  const n=_cocherIds(conteneur,ids);
  if(conteneur==='cdg-athletes') try{ _cdgMajBouton(); }catch(e){}
  if(!n) toast('Aucun athlète de cette liste ne porte cette étiquette.','var(--orange)');
  return n;
}
function selEtiqueter(){
  if(!SEL_ATHLETES.size) return false;
  return ouvrirEtiquettes(Array.from(SEL_ATHLETES));
}

// ── Les cadres repliés du haut : trois noms, puis « voir tout » ─────────
const CADRE_REPLIE_MAX=3;
function _crListe(l,fn,opts){
  const vus=l.slice(0,CADRE_REPLIE_MAX), reste=l.slice(CADRE_REPLIE_MAX);
  return renderDataList(vus,fn,opts)
    +(reste.length?'<div class="cr-plus" hidden>'+renderDataList(reste,fn,opts)+'</div>'
      +'<button type="button" class="cr-voir" onclick="cadreVoirTout(this)">Voir tout ('+l.length+')</button>':'');
}
function cadreVoirTout(b){
  const z=b&&b.closest?b.closest('.cadre-replie'):null;
  if(!z) return false;
  z.querySelectorAll('.cr-plus').forEach(x=>x.removeAttribute('hidden'));
  b.remove();
  return true;
}

function renderTodoBlock(clients){
  _renderPremiersPas(clients);
  try{ renderEntreeRelances(); }catch(e){}
  try{ renderEntreeProspects(); }catch(e){}
  try{ renderEntreeMessages(); }catch(e){}
  const el=document.getElementById('ch-todo');if(!el) return;
  const now=Date.now(),SOON=14*864e5;
  const lt=c=>(c.bilans||[]).reduce((m,b)=>Math.max(m,b.date),0);
  // LOT C1 : pendant l'accueil d'un athlète coaché, deux moments seulement.
  const _acc=accueilLignesCoach(clients,now);
  const newBil=clients.filter(c=>hasNewBilan(c)&&!_acc.silence.has(c.id)&&!isAlertSnoozed('bilan',c.id,lt(c)));
  const overdue=clients.filter(c=>!c._fromCode&&needsAlert(c)&&!isAlertSnoozed('overdue',c.id));
  const expiring=clients.filter(c=>!c._fromCode&&c.status==='COACHING_SUIVI'&&c.accessExpiry&&(c.accessExpiry-now)>0&&(c.accessExpiry-now)<SOON&&!isAlertSnoozed('expiring',c.id));
  const noProg=clients.filter(c=>!c._fromCode&&!_acc.silence.has(c.id)&&!hasProgram(c)&&(c.bilans||[]).some(b=>b.type==='depart')&&!isAlertSnoozed('noprog',c.id));
  const noStart=clients.filter(c=>neverStarted(c)&&!_acc.silence.has(c.id)&&!isAlertSnoozed('nostart',c.id));
  // Drapeau rouge d'abord : c'est le seul signal que le coach ne peut pas
  // reporter d'un clic. Une ligne par athlete, avec les signes declares.
  //
  // LES DEUX FAMILLES. Un signe général n’arrivait pas jusqu’ici : l’athlète
  // le déclarait, lisait « Ton coach a été prévenu », et rien ne montait.
  const rows=clients.filter(c=>drapeauQuelconqueActif(c)).map(c=>{
    const d=drapeauQuelconqueActif(c);
    // libelleDrapeau couvre LES DEUX TABLES : chercher dans DRAPEAUX_ROUGES
    // seulement rendait la clef brute — « thoracique » — pour un signe général.
    const lib=d.cases.map(libelleDrapeau);
    // LA ZONE N EST AFFICHÉE QUE QUAND C EN EST UNE. `general` n’est pas une
    // zone du corps, et « Général · une douleur dans la poitrine » nommerait
    // une région qui n’existe pas.
    const _z=(d.zone&&d.zone!==DRAPEAU_ZONE_GENERALE)?(libZone(d.zone)+' · '):'';
    return {type:'drapeau',icon:icon('flag',16),color:'var(--red)',label:'Drapeau rouge santé signalé',
      list:[c],sante:true,nonReportable:true,
      texte:_z+lib.join(' · ')+". Aucun exercice de remplacement n'est proposé."};
  });
  // PUIS CE QU'UNE PERSONNE ATTEND (06/10/2026) : le bilan à lire, le bilan
  // en retard, le message sans réponse, le programme à écrire et le premier
  // point de l'accueil passent AVANT les signaux d'entraînement, et ne
  // comptent pas dans le plafond (TODO_TOUJOURS_VISIBLES) : huit plateaux ne
  // replient plus un athlète qui attend une réponse ou son programme.
  // BUILD 1863 : les bilans CORRIGÉS après la réponse ont leur propre libellé.
  const _corBil=newBil.filter(c=>{ const d=dernierBilan(c); return !(d&&!bilanRepondu(d)&&!d.traite); });
  const _neufBil=newBil.filter(c=>_corBil.indexOf(c)<0);
  if(_neufBil.length) rows.push({type:'bilan',icon:icon('download',16),color:'var(--orange)',label:'Nouveau'+(_neufBil.length>1?'x bilans à lire':' bilan à lire'),list:_neufBil});
  // BUILD 1878 : sa propre ligne, 'bilan_corrige', rangée avec 'bilan' et hors plafond.
  if(_corBil.length) rows.push({type:'bilan_corrige',icon:icon('download',16),color:'var(--orange)',
    label:_corBil.length===1?libelleCorrectionBilan(_corBil[0],null,{ligne:true}):_corBil.length+' bilans corrigés à relire',list:_corBil});
  if(overdue.length) rows.push({type:'overdue',icon:icon('alert-triangle',16),color:'var(--red)',label:'Bilan'+(overdue.length>1?'s':'')+' en retard',list:overdue});
  // LOT M2 : le dernier message d'un fil vient de l'athlète depuis 24 h ou plus.
  // S'éteint quand le coach RÉPOND (lu dans le cache des fils), pas quand il ouvre.
  const _msgs=msgClientsSansReponse(clients,now).filter(c=>!isAlertSnoozed('message',c.id));
  if(_msgs.length) rows.push({type:'message',icon:icon('message-circle',16),color:'var(--orange)',label:'Message'+(_msgs.length>1?'s':'')+' sans réponse',list:_msgs});
  const _accProg=_acc.prog.filter(c=>!isAlertSnoozed('accueil_prog',c.id)), _accRet=_acc.retour.filter(c=>!isAlertSnoozed('accueil_retour',c.id));
  if(_accProg.length) rows.push({type:'accueil_prog',icon:icon('clipboard',16),color:'var(--orange)',label:'Programme à écrire',list:_accProg});
  if(_accRet.length) rows.push({type:'accueil_retour',icon:icon('message-circle',16),color:'var(--orange)',label:'Premier point de l’accueil',list:_accRet});
  // Puis les signaux d'entrainement : la sante avant l'intendance.
  // Au-delà de trois athlètes pour un même signal : une ligne, et une file.
  rows.push.apply(rows,grouperLignesEntrainement(_lignesEntrainement(clients)));
  // En tête des lignes administratives : relancer un inscrit qui n'a jamais démarré.
  if(noStart.length) rows.push({type:'nostart',icon:icon('user-plus',16),color:'var(--red)',label:'Inscrit, n\'a jamais commencé',list:noStart});
  // N6.8 — LES VIDEOS A CORRIGER REMONTENT ICI. La donnee existait,
  // videoNonCorrigee disait deja lesquelles attendent, et agregerPortefeuille
  // les comptait pour le volet « Vue d'ensemble » — un volet ferme a chaque
  // ouverture. Un athlete pouvait deposer une video et attendre une semaine.
  // Entre les bilans et les acces qui expirent : c'est du travail de coach,
  // pas de l'intendance, mais ca ne prime pas sur un bilan en retard.
  const _vids=clients.filter(c=>{
    try{ return (c.videos||[]).some(videoNonCorrigee)&&!isAlertSnoozed('videos',c.id); }
    catch(e){ return false; }
  });
  if(_vids.length) rows.push({type:'videos',icon:icon('video',16),color:'var(--orange)',
    label:'Vidéo'+(_vids.length>1?'s':'')+' à corriger',list:_vids});
  // N6.13 — LES NOTES DONT L'ECHEANCE EST ATTEINTE. Niveau administratif,
  // comme le rite : urgencyScore ne les connait pas et ne les connaitra pas —
  // la ligne se voit, elle ne remonte personne dans le tri.
  // REPORTABLE de sept jours comme les autres lignes de ce niveau, via
  // dismissTodoRow, qui n'ecrit que dans alertStatus du COACH.
  const _notes=clients.filter(c=>{
    try{ return notesEchues(currentUser&&currentUser.coachNotes,c.id).length
      &&!isAlertSnoozed('notes',c.id); }
    catch(e){ return false; }
  });
  if(_notes.length) rows.push({type:'notes',icon:icon('pencil',16),color:'var(--sub)',
    label:'Note'+(_notes.length>1?'s':'')+' à revoir',list:_notes});
  if(expiring.length) rows.push({type:'expiring',icon:icon('clock',16),color:'var(--orange)',label:'Accès expire dans <14j',list:expiring});
  // RITE DE FIN DE CYCLE : niveau administratif. urgencyScore ne le connaît
  // pas et ne le connaîtra pas — la ligne se voit, elle ne remonte personne.
  // Elle se reporte comme les autres, via dismissTodoRow, qui n'écrit que dans
  // alertStatus du COACH : le dossier de l'athlète n'est jamais touché.
  // Relance UNIQUE : si le cycle précédent est déjà resté sans réponse, le
  // suivant ne redemande rien.
  const _rites=clients.filter(c=>{
    if(!c||c._fromCode) return false;
    // SEULS LES RITES PORTEURS D UNE QUESTION. Un cycle clôturé sans question
    // n’attend aucune réponse : l’annoncer « à lire » envoyait le coach vers
    // un écran où il n’y a rien à lire. La règle de relance unique ci-dessous
    // s’applique alors à cette liste-là, celle des rites qui demandent
    // vraiment quelque chose.
    const l=(c.rites||[]).filter(r=>r&&r.date&&String(r.question||'').trim());
    if(!l.length) return false;
    const der=l[l.length-1];
    if(der.reponseCoach) return false;
    const avant=l[l.length-2];
    return !(avant&&!avant.reponseCoach);      // deja relance une fois : plus rien
  });
  if(_rites.length) rows.push({type:'rite',icon:icon('calendar',16),color:'var(--sub)',
    label:'Bilan de 4 semaines à lire',list:_rites});
  // La fin d'un bloc (finProgramme) : une décision à prendre, bande « À traiter ».
  rows.push.apply(rows,lignesFinProgramme(clients,now,c=>isAlertSnoozed('progfin',c.id)));
  if(noProg.length) rows.push({type:'noprog',icon:icon('clipboard',16),color:'var(--sub)',label:'Sans programme',list:noProg});
  // Les athlètes actifs sans échange depuis 14 jours (sansContact), EN DERNIER
  // et seulement ceux qu'aucune autre ligne ne nomme : un athlète n'occupe
  // qu'une ligne, et toute autre ligne appelle déjà un échange.
  { const _nommes=new Set(); rows.forEach(r=>(r.list||[]).forEach(c=>c&&_nommes.add(c.id)));
    rows.push.apply(rows,lignesSansContact(clients,currentUser&&currentUser.contacts,now,c=>_nommes.has(c.id)||isAlertSnoozed('silence',c.id))); }
  if(!rows.length){ window._todoRows=[]; el.innerHTML=''; return; }
  // Un tableau de bord qui affiche trente alertes n'oriente plus rien. Les
  // lignes sont deja triees par gravite : on coupe la queue et on l'annonce.
  // Les lignes de TODO_TOUJOURS_VISIBLES ne comptent jamais dans le
  // plafond ; les autres lignes s'y rangent, dans leur ordre.
  const vues=todoLignesVisibles(rows,TODO_MAX_LIGNES,_todoDeplie);
  const restant=rows.length-vues.length;
  const _repliable=_todoDeplie&&todoLignesVisibles(rows,TODO_MAX_LIGNES,false).length<rows.length;
  window._todoRows=vues;
  const unique=new Set(rows.flatMap(r=>r.list.map(c=>c.id))).size;
  // Le disclaimer est rendu des qu'une ligne de douleur est visible, et il
  // vient de la constante unique partagee avec les deux autres affichages.
  const aDouleur=vues.some(r=>r.sante&&r.type!=='drapeau');
  // Un drapeau rouge n'a rien a voir avec l'echelle de douleur de 1 a 6 : le
  // disclaimer qui convient est celui des contraintes de sante.
  const aDrapeau=vues.some(r=>r.type==='drapeau');
  // ══ TROIS BANDES, PAS UNE PILE ═══════════════════════════════════════════
  //
  // Huit lignes d'affilée ne se lisent pas : le coach cherche d'abord ce qui
  // ne peut pas attendre, et il devait pour cela relire la couleur de chaque
  // intitulé. La couleur portait déjà le niveau — elle ne faisait que le
  // colorier. Elle RANGE maintenant.
  //
  // ⚠ LE TRI ET LE PLAFOND NE BOUGENT PAS. `rows` reste ordonné par gravité,
  //   `vues` reste les huit premières, et `window._todoRows` reste `vues` :
  //   c'est l'index dans CE tableau que dismissTodoRow, ouvrirAjustement et
  //   _entrerFileBilans reçoivent. On range à l'affichage, on ne renumérote
  //   rien.
  const BANDES=[
    {titre:'Urgent',    couleur:'var(--red)',    test:(/** @type {any} */ r)=>r.color==='var(--red)'},
    {titre:'Important', couleur:'var(--orange)', test:(/** @type {any} */ r)=>r.color==='var(--orange)'},
    // VERT, ET NON GRIS — demande de Kévin, 19/09/2026. Ces lignes ne sont pas
    // des alertes éteintes : ce sont des décisions à prendre — un calibrage,
    // un bloc terminé, une note à revoir. Le gris les faisait lire comme du
    // bruit de fond, et elles restaient au fond du bloc pour toujours.
    {titre:'À traiter', couleur:'var(--green)',  test:()=>true}
  ];
  const _bande=(/** @type {any} */ r)=>BANDES.findIndex(b=>b.test(r));
  // LE COMPTE D'UNE BANDE VIENT DE TOUTES LES LIGNES, pas des seules affichées.
  // Le plafond de huit coupe la queue, donc la bande verte en premier : sans
  // ce total, une colonne vidée par le plafond dirait « Rien » alors qu'il
  // reste du travail dedans.
  const _cols=BANDES.map((b,i)=>({...b,
    total:rows.filter(r=>_bande(r)===i).length,
    // On garde l'index d'origine avec la ligne : la colonne n'est qu'une vue.
    lignes:vues.map((r,idx)=>({r,idx})).filter(x=>_bande(x.r)===i)}));
  el.innerHTML=`<div style="background:var(--red-bg);border:1px solid var(--red-bg-2);border-left:1px solid var(--border);border-radius:var(--r-3);margin-bottom:20px;overflow:hidden;box-shadow:var(--e3)">
    <div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;background:var(--red-bg);border-bottom:1px solid #1e0000">
      <span style="font-size:13px;font-weight:800;color:var(--red-text);text-transform:uppercase;letter-spacing:2.4px">Mes notifications</span>
      <span style="background:var(--red);color:var(--text);font-size:14px;font-weight:400;padding:1px 10px;border-radius:var(--r-3);font-family:var(--pile-titre);letter-spacing:1px">${unique}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(272px,1fr));gap:10px;padding:10px">
    ${_cols.map(b=>`<div style="min-width:0;background:var(--red-bg);border:1px solid #1e0000;border-radius:0;overflow:hidden">
      <div style="padding:8px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:${b.couleur}">
        <!-- LE TEXTE EST PRESQUE NOIR SUR LE BANDEAU PLEIN, et non blanc : sur
             l'orange et sur le vert, du blanc tombe sous trois pour un de
             contraste et ne se lit plus au soleil d'une salle. Le noir tient
             les trois : 4,8 sur le rouge, 7,2 sur l'orange, 8,7 sur le vert. -->
        <span style="font-size:var(--fs-2xs);font-weight:800;color:#0a0000;text-transform:uppercase;letter-spacing:1.8px">${b.titre}</span>
        <span style="font-size:var(--fs-2xs);font-weight:800;color:#0a0000;opacity:.72">${b.total}</span>
      </div>
      ${b.lignes.length?renderDataList(b.lignes,(x)=>{
      const r=x.r, idx=x.idx, coul=b.couleur;
      // XSS stocké : le prénom est saisi par l'athlète lui-même et atterrissait
      // brut dans le tableau de bord de son coach. Trouvé en testant les liens
      // WhatsApp avec un prénom hostile — le défaut est antérieur.
      const names=r.list.slice(0,2).map(c=>escapeHtml(c.fname||'')).join(', ')+(r.list.length>2?' +'+(r.list.length-2):'');
      // Ligne d'entrainement : elle porte un nom d'athlete et SA donnee, pas
      // un groupe. Le corps differe donc de celui des lignes administratives,
      // qui restent rendues exactement comme avant.
      const _n0=r.list[0]||{};
      const _ini=(_n0.lname||'').charAt(0);
      const nomA=escapeHtml(((_n0.fname||'')+(_ini?' '+_ini+'.':'')).trim()||'Athlète');
      const corps=r.texte
        ? `<div style="flex:1;min-width:0"><span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${nomA}</span><span style="font-size:var(--fs-sm);font-weight:700;color:${coul}"> · ${r.label}</span><div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-top:2px">${escapeHtml(r.texte)}</div></div>`
        : r.groupe
        ? `<div style="flex:1;min-width:0"><span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${r.list.length} athlètes</span><span style="font-size:var(--fs-sm);font-weight:700;color:${coul}"> · ${r.label}</span><span style="font-size:var(--fs-xs);color:var(--sub)"> · ${names}</span></div>`
        : `<div style="flex:1;min-width:0"><span style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">${r.list.length>1?r.list.length+' ':''}</span><span style="font-size:var(--fs-sm);font-weight:700;color:${coul}">${r.label}</span><span style="font-size:var(--fs-xs);color:var(--sub)"> · ${names}</span></div>`;
      // L'ICÔNE EST BLANCHE ET ELLE RAYONNE, quelle que soit la bande : la
      // couleur est déjà portée par la colonne et par l'intitulé. Une icône
      // colorée de plus ferait trois rouges côte à côte et plus rien ne
      // ressortirait. Deux halos, un serré et un large : c'est ce qui fait le
      // néon plutôt qu'un simple trait clair.
      return{html:`<span style="flex-shrink:0;align-self:flex-start;margin-top:2px;display:inline-flex;color:#fff;filter:drop-shadow(0 0 4px rgba(255,255,255,.7)) drop-shadow(0 0 11px rgba(255,255,255,.3))">${r.icon}</span>${corps}${_ajBouton(r,idx)}${_waBoutonTodo(r,idx)}${r.nonReportable?'':`<button onclick="event.stopPropagation();dismissTodoRow(${idx})" title="Snoozer 7 jours" style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;padding:4px 8px;flex-shrink:0;transition:color var(--t-1);border-radius:var(--r-1)" onmouseover="this.style.color='var(--sub)'" onmouseout="this.style.color='#444'">${icon('croix',14)}</button>`}`,
      // LA LIGNE DES BILANS POSE LA FILE au passage. Les autres lignes ouvrent
      // la fiche comme avant : elles ne décrivent pas une série à traiter.
      onClick:r.type==='bilan'?`_entrerFileBilans(${idx})`
        // BUILD 1878 : le bilan corrigé, ouvert sur ses réponses.
        :r.type==='bilan_corrige'?`ouvrirBilanCorrige('${r.list[0].id}')`
        // Une ligne groupée ouvre sa file : un athlète, puis « Athlète suivant ».
        :r.groupe?`_entrerFileSignal(${idx})`
        // La file de correction des videos est deja ecrite : la ligne y entre,
        // elle n'ouvre pas une fiche que le coach devrait ensuite fouiller.
        :r.type==='videos'?`_entrerFileVideos()`
        // LOT M2 : le fil de l'athlète, prêt à répondre.
        :r.type==='message'?`msgOuvrirFil(${_attrArg(_relCle(r.list[0]))})`
        :r.type==='rite'?`_ouvrirRiteClient('${r.list[0].id}')`
        // La fin d'un bloc : sa file, un athlète après l'autre, sur « Bilan du bloc ».
        :r.type==='progfin'?`_entrerFileProgfin(${idx})`
        // LOT C1 : le bilan de départ, ouvert à l'endroit où l'on écrit le programme.
        :r.type==='accueil_prog'?`accueilOuvrirBilanDepart('${r.list[0].id}')`
        :`openClientDetail('${r.list[0].id}')`,
      style:'cursor:pointer;transition:background var(--t-1);'};
    },{pad:'9px 11px',gap:9,border:'#180000',hover:'#140000'})
      // UNE COLONNE VIDE LE DIT, et dit laquelle des deux raisons : il n'y a
      // rien à ce niveau, ou le plafond de huit lignes a coupé ici.
      :`<div style="padding:10px 12px;font-size:var(--fs-xs);color:var(--text-faint)">${b.total?'+ '+b.total+' plus bas':'Rien ici'}</div>`}
    </div>`).join('')}
    </div>
    ${restant?`<button type="button" class="td-plus" onclick="todoDeplier(true)" aria-expanded="false">+ ${restant} autre${restant>1?'s':''}</button>`
      :_repliable?`<button type="button" class="td-plus" onclick="todoDeplier(false)" aria-expanded="true">Réduire la liste</button>`:''}
    ${aDrapeau?`<div style="padding:8px 14px;border-top:1px solid #180000">${blocDisclaimerSante()}</div>`:''}
    ${aDouleur?`<div style="padding:8px 14px;border-top:1px solid #180000">${blocDisclaimerDouleur()}</div>`:''}
  </div>`;
}
// status 'FREE' = aucun accès : l'athlète se heurte au paywall à chaque
// ouverture. Le badge d'activité seul affichait « Inactif », ce qui se lisait
// comme un manque d'assiduité alors que l'élève ne peut tout simplement pas
// entrer. Le coach doit savoir ce qu'il reste à faire.
// ⚠ PAS PENDANT L'ESSAI. Le commentaire ci-dessus dit la raison d'etre de ce
// signal : « l'eleve ne peut tout simplement pas entrer ». Pendant ses trois
// seances libres, il entre — et afficher au coach qu'il est bloque serait lui
// faire relancer quelqu'un qui est en train de s'entrainer.
function _enAttenteAbonnement(c){
  return !c._fromCode&&c.status==='FREE'&&!essaiActif(c);
}
// R-03 : accès expiré = LECTURE SEULE, jamais suppression. Le dossier, les
// séances, les bilans et l'historique restent intacts et consultables par le
// coach ; c'est l'athlète qui ne peut plus entrer tant qu'un nouveau code ne
// lui a pas été donné. Rien ici n'efface quoi que ce soit — et un test le
// vérifie, parce qu'une suppression est irréversible et qu'un jour quelqu'un
// trouvera plus simple de « nettoyer ».
//
// PURE, et distincte de _enAttenteAbonnement : un athlète FREE n'a jamais eu
// d'accès, un athlète expiré en a eu un. Les deux méritent des mots
// différents sur la fiche.
function _accesExpire(c){
  if(!c||c._fromCode||c.role==='coach') return false;
  if((c.status||'FREE')!=='COACHING_SUIVI') return false;
  return !!c.accessExpiry&&Date.now()>=c.accessExpiry;
}
// ── Les trois mesures de la liste ────────────────────────────────────────
//
// PURES. Chacune rend '' quand il n'y a rien à dire : _chargeHebdo demande
// cinq semaines d’historique, _exercicesEnProgres un couple comparable, et un
// athlète sans bilan en attente n’a rien à afficher. Un « 0 » ou un « — » se
// lirait comme un constat, alors que c’est une absence de mesure.
// N6.5 — LE RAPPORT AIGU / CHRONIQUE RECOIT ENFIN UNE LECTURE.
// Le pourcentage etait calcule, affiche a la ligne d'athlete et a la fiche, et
// jamais interprete : le coach lisait « +38 % » sans savoir si c'etait normal.
//
// LES DEUX BANDES, EN UN SEUL ENDROIT. Au-dela de +30 %, la charge de la
// semaine depasse d'un tiers la moyenne des quatre precedentes : c'est le seuil
// au-dela duquel la litterature sur le rapport charge aigue / charge chronique
// situe l'augmentation du risque de blessure. En dessous de -30 %, la semaine
// est un creux — decharge voulue, ou semaine manquee, et le coach doit savoir
// laquelle. Entre les deux, rien ne se dit : une variation ordinaire n'a pas
// besoin d'etre commentee.
//
// PAS DE QUATRIEME TEINTE SUR LA LIGNE. Le filet gauche porte deja l'etat de
// l'athlete ; la lecture se fait par un MOT, a cote du chiffre, qui reste
// ecrit. Ajouter une couleur affaiblirait le filet — voir le commentaire de
// _etatAthlete.
const CHARGE_BANDE=30;   // % d'ecart a la moyenne des 4 semaines precedentes
// B3.6 — LA DERIVE DU RIR, EN UN MOT.
//
// La carte affichait « 2,1 · ▼ 0,4 sur les 4 precedentes » : le coach lisait
// une fleche sans savoir si elle etait bonne. Un RIR qui baisse peut etre une
// montee d'intensite VOULUE ou une fatigue qui s'installe — et c'est le
// croisement avec le volume qui tranche. Le rapport aigu/chronique a recu ce
// traitement ; la derive du RIR ne l'avait pas recu.
//
// LE SEUIL EST UN DEMI-POINT DE RIR. En deca, sur quatre seances, l'ecart
// tient a la facon dont l'athlete a estime ses series ce jour-la : ce n'est pas
// une derive, c'est du bruit. Le silence est donc le comportement par defaut —
// une variation ordinaire ne se commente pas.
const RIR_DERIVE_BANDE=0.5;
// PURE. `d` est la derive du RIR (positive = plus facile), `dVol` la variation
// de volume sur la meme fenetre, en pourcentage, ou null si on ne la connait
// pas. Rend '' quand il n'y a rien a dire.
function lectureDeriveRir(d,dVol){
  if(d==null||!isFinite(d)) return '';
  if(Math.abs(d)<RIR_DERIVE_BANDE) return '';
  // UN RIR QUI BAISSE = ON POUSSE PLUS FORT. Reste a savoir si c'est voulu.
  if(d<0){
    // Le volume monte AUSSI : les deux leviers montent ensemble, et c'est la
    // definition d'une surcharge. On le dit, prudemment.
    if(dVol!=null&&isFinite(dVol)&&dVol>=CHARGE_BANDE) return 'surcharge';
    return 'intensification';
  }
  // UN RIR QUI MONTE = on pousse moins. Avec un volume qui baisse aussi, c'est
  // un relachement ; sinon, un affaissement de l'intensite seule.
  if(dVol!=null&&isFinite(dVol)&&dVol<=-CHARGE_BANDE) return 'allègement';
  return 'affaissement';
}
function lectureChargeHebdo(pct){
  if(pct==null||!isFinite(pct)) return '';
  if(pct>=CHARGE_BANDE) return 'pic';
  if(pct<=-CHARGE_BANDE) return 'creux';
  return '';
}
function _crCharge(c){
  let r=null; try{ r=_chargeHebdo(c); }catch(e){ r=null; }
  // `pct` peut être null alors que l’objet existe : moyenne de référence à
  // zéro, aucun pourcentage n’a alors de sens.
  if(!r||r.pct==null) return '';
  // La colonne du tableau est etroite : le mot y tient en abrege, et le
  // chiffre reste ecrit a cote — c'est lui qu'on compare d'une ligne a l'autre.
  const l=lectureChargeHebdo(r.pct);
  return (r.pct>0?'+':'')+r.pct+' %'+(l?' · '+l:'');
}
function _crProgres(c){
  let r=null; try{ r=_exercicesEnProgres(c); }catch(e){ r=null; }
  if(!r) return '';
  return r.enProgres+'/'+r.total;
}
function _crBilans(c){
  let n=0; try{ n=bilansSansReponse(c); }catch(e){ n=0; }
  return n>0?String(n):'';
}
// N6.4 — L'ASSIDUITE. tauxCompletion rend deja un objet qui dit s'il est
// interpretable : sans programme, en reprise, sous suspension, il ne l'est pas
// et tauxCompletionLib rend « — ». On prefere le VIDE au tiret : dans une
// colonne de tableau, un tiret par ligne fait une colonne de tirets.
function _crAssidu(c){
  let r=null; try{ r=tauxCompletion(c); }catch(e){ r=null; }
  if(!r||!r.interpretable||r.taux==null) return '';
  return r.taux+' %';
}
// N6.4 — LE POIDS. vitesseHebdo rend des kilos par semaine, ou null tant qu'il
// n'y a pas deux semaines de recul depuis la derniere reprise. Le signe est
// ECRIT : « 0,3 » sans signe se lit comme une prise autant que comme une perte.
function _crPoids(c){
  // vitesseHebdo rend un OBJET — {kgSem, pctSem, points, regime} — et non un
  // nombre : c'est `kgSem` qu'on affiche, la meme grandeur que la fiche.
  let r=null;
  try{ r=vitesseHebdo(serieWeight(c)); }catch(e){ r=null; }
  const v=r?r.kgSem:null;
  if(v==null||!isFinite(v)) return '';
  const n=Math.round(v*10)/10;
  // « kg » ET NON « kg/sem » : la colonne fait 74 px, et l'intitule dit deja
  // qu'il s'agit d'une vitesse. Le titre du survol porte la phrase entiere.
  return (n>0?'+':(n<0?'−':''))+String(Math.abs(n)).replace('.',',')+' kg';
}
// N6.4 — LA DIETE. _tauxDieteRespectee rend null quand aucun jour n'a pu etre
// juge — pas de cible, pas de journal — et c'est un silence, pas un zero.
function _crDiete(c){
  let r=null; try{ r=_tauxDieteRespectee(c); }catch(e){ r=null; }
  if(!r||r.pct==null) return '';
  return r.pct+' %';
}
// LES NON MESURABLES EN FIN DE LISTE. Un sentinelle très négative et non -1 :
// une charge peut légitimement valoir -20 %, et -1 la placerait AU-DESSUS
// d’un athlète dont on ne sait rien. Pas -Infinity non plus — la soustraction
// de deux infinis rend NaN, et un comparateur qui rend NaN désordonne la
// liste au lieu de la trier.
const TRI_SANS_MESURE=-1e9;
function _triCharge(c){
  let r=null; try{ r=_chargeHebdo(c); }catch(e){}
  return (r&&r.pct!=null)?r.pct:TRI_SANS_MESURE;
}
function _triProgres(c){
  let r=null; try{ r=_exercicesEnProgres(c); }catch(e){}
  return (r&&r.total>0)?(r.enProgres/r.total):TRI_SANS_MESURE;
}
// L ETAT D UN ATHLETE, EN UN SEUL ENDROIT. Trois ecrans le lisent maintenant :
// la liste du portefeuille, l assignation de programme et la decharge groupee.
// Le duplique aurait suffi a ce que deux ecrans finissent par se contredire.
//
// L ORDRE EST CELUI DU BADGE, cas par cas : abonnement a souscrire, puis
// lecture seule, puis nouveau bilan, puis alerte, puis actif. Un ordre
// different donnerait un badge orange sur un filet rouge — deux signaux
// contradictoires, et le plus visible serait le faux.
//
// LA DOULEUR D'ABORD (06/10/2026). Le badge disait « Actif », en vert, pour un
// athlete qui declarait une douleur repetee : urgencyScore la classait en
// tete, la liste la peignait en vert. Le drapeau rouge et la douleur repetee
// non reportee — LES MEMES CONDITIONS que les rangs 10 et 9 d'urgencyScore —
// passent donc avant tout le reste, nouveau bilan compris.
function athleteDouleur(c){
  if(!c) return false;
  try{ if(drapeauQuelconqueActif(c)) return true; }catch(e){}
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){ sg=null; }
  return !!(sg&&sg.douleur&&!isAlertSnoozed('douleur',c.id,0,c));
}
function etatAthlete(c){
  return athleteDouleur(c)?'douleur'
    :_enAttenteAbonnement(c)?'attente'
    :_accesExpire(c)?'lecture'
    :hasNewBilan(c)?'bilan'
    :needsAlert(c)?'alerte'
    :isActive(c)?'actif':'dormant';
}
// La couleur du filet, par etat. Meme table pour les trois ecrans.
const ETAT_FILET=Object.freeze({douleur:ROUGE_MARQUE,alerte:ROUGE_MARQUE,bilan:'#f97316',attente:'#f97316',
  actif:'#22c55e',lecture:'#8a8a8a',dormant:'#666666'});
// Le badge, par etat : le MEME etat que le filet, donc le meme mot.
const ETAT_BADGE=Object.freeze({douleur:['badge-red','Douleur'],attente:['badge-orange','Abonnement à souscrire'],
  lecture:['badge-gray','Lecture seule'],bilan:['badge-orange','Nouveau bilan'],alerte:['badge-red','Alerte'],
  actif:['badge-green','Actif'],dormant:['badge-gray','Inactif']});
// LA META DU TELEPHONE (06/10/2026) : une ligne, deux faits au plus, dans cet
// ordre — la derniere seance, les bilans a lire, le dernier contact. La
// derniere seance est la PLUS RECENTE (max des dates), jamais la derniere du
// tableau : sessions n'est pas garanti trie (import, synchro, saisie a
// posteriori). Un athlete invite par code n'a pas de seance a dire.
function _crJours(t,maintenant){
  const j=Math.max(0,Math.floor(((Number(maintenant)||Date.now())-t)/864e5));
  return j===0?'aujourd’hui':'il y a '+j+' j';
}
function crMetaFaits(c,contacts,maintenant){
  if(!c) return [];
  // [forme seule, forme courte] : a deux faits, « dernière » tombe — mesure a
  // 390 px, deux faits complets ne tenaient pas sur la ligne.
  /** @type {string[][]} */
  const out=[];
  if(!c._fromCode){
    const der=(c.sessions||[]).reduce((m,s)=>Math.max(m,Number(s&&s.date)||0),0);
    if(der>0){ const j=_crJours(der,maintenant); out.push(['dernière séance '+j,'séance '+j]); }
  }
  let nb=0; try{ nb=bilansSansReponse(c); }catch(e){ nb=0; }
  if(nb>0){ const b=nb+' bilan'+(nb>1?'s':'')+' à lire'; out.push([b,b]); }
  let ct=0; try{ ct=dernierContact(c,contacts); }catch(e){ ct=0; }
  if(ct>0){ const j=_crJours(ct,maintenant); out.push(['dernier contact '+j,'contact '+j]); }
  const deux=out.slice(0,2);
  return deux.map(f=>f[deux.length>1?1:0]);
}
// ══════ N4.13 — COCHER DES ATHLETES SANS QUITTER LA LISTE ═════════════════
// Les cases a cocher existaient, mais sur deux ecrans separes et mono-usage :
// l'un pour assigner un programme, l'autre pour la decharge groupee. Toute
// action en lot demandait donc de quitter la liste, d'aller sur un ecran
// special et de re-selectionner — deux navigations par action, et une seule
// action par ecran.
//
// LA SELECTION VIT HORS DU CONTENEUR REECRIT. #ch-clients-list est reecrit
// toutes les trente secondes par la boucle de synchro : c'est exactement pour
// cela que la recherche et les filtres sont places au-dessus de lui. Meme
// discipline ici — la selection est un Set en memoire, et chaque ligne rendue
// y relit son etat. Cocher puis attendre une minute ne perd rien.
//
// ON NE REECRIT PAS LES ACTIONS GROUPEES : elles existent, elles sont
// eprouvees, et elles ont leur ecran. La barre les OUVRE avec la selection
// deja cochee — ce qui etait la seule chose qui manquait.
const SEL_ATHLETES=new Set();
function selAthleteBascule(id,ev){
  // La ligne entiere ouvre la fiche : sans ce coup d'arret, cocher ouvrirait
  // l'athlete qu'on voulait seulement designer.
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(SEL_ATHLETES.has(id)) SEL_ATHLETES.delete(id);
  else SEL_ATHLETES.add(id);
  _selMaj();
  return true;
}
function selAthleteVider(){
  SEL_ATHLETES.clear();
  try{ renderClientList(); }catch(e){ _selMaj(); }
  return true;
}
// Les identifiants d'athletes qui ne sont PLUS dans la liste sortent : un
// athlete libere ou supprime ne doit pas continuer a compter dans la barre.
function _selElaguer(vus){
  if(!Array.isArray(vus)) return;
  const presents=new Set(vus.map(c=>c&&c.id).filter(Boolean));
  for(const id of Array.from(SEL_ATHLETES)) if(!presents.has(id)) SEL_ATHLETES.delete(id);
}
function _selMaj(){
  const z=document.getElementById('ch-selection');
  if(!z) return;
  const n=SEL_ATHLETES.size;
  // ELLE N'APPARAIT QUE COCHEE : une barre d'actions permanente sur un
  // tableau de bord deja dense serait un bandeau de plus a lire.
  if(!n){ z.innerHTML=''; z.style.display='none'; return; }
  z.style.display='';
  z.innerHTML='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;'
    +'padding:10px 12px;background:var(--surface-1);border:1px solid var(--red);'
    +'border-radius:var(--r-3)">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;color:var(--text-strong);letter-spacing:.4px">'
    +n+' athlète'+(n>1?'s':'')+' sélectionné'+(n>1?'s':'')+'</span>'
    +'<div style="flex:1"></div>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selVersMessage()">Message</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selEtiqueter()">Étiqueter</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selVersDecharge()">Décharge</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selVersProgramme()">Programme</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selCadence()">Cadence</button>'
    +'<button type="button" onclick="selAthleteVider()" title="Tout décocher" style="background:none;border:none;color:var(--sub);font-family:inherit;font-size:var(--fs-xs);cursor:pointer;padding:4px 6px;min-height:30px">'+icon('croix',14)+'</button>'
    +'</div>';
}
// Les cases de l'ecran de destination sont cochees APRES son rendu : c'est lui
// qui les fabrique, et il les fabrique toutes decochees.
function _selCocherSur(conteneur){
  let n=0;
  try{
    document.querySelectorAll('#'+conteneur+' input[type=checkbox]').forEach(cb=>{
      const veut=SEL_ATHLETES.has(cb.value);
      cb.checked=veut;
      if(veut) n++;
    });
  }catch(e){}
  return n;
}
function selVersDecharge(){
  if(!SEL_ATHLETES.size) return false;
  openDechargeGroupee();
  setTimeout(()=>{ _selCocherSur('cdg-athletes'); try{ _cdgMajBouton(); }catch(e){} },0);
  return true;
}
function selVersProgramme(){
  if(!SEL_ATHLETES.size) return false;
  const progs=(currentUser&&currentUser.coachPrograms)||[];
  if(!progs.length){
    toast('Tu n’as encore aucun programme à assigner.','var(--orange)');
    return false;
  }
  // L'ecran d'assignation demande QUEL programme : on ouvre la liste des
  // programmes, ou le coach choisit, et la selection l'attend a l'arrivee.
  openCoachPrograms();
  toast(SEL_ATHLETES.size+' athlète'+(SEL_ATHLETES.size>1?'s':'')
    +' en attente : choisis le programme à leur assigner.','var(--info)');
  return true;
}
// ══ AVEC SUIVI / SANS SUIVI ════════════════════════════════════════════
// Un portefeuille melange deux populations qui ne se pilotent pas pareil :
// ceux que le coach suit vraiment, et ceux qui ont un acces sans
// accompagnement. Les memes alertes pour les deux noient les premieres.
//
// LE DEFAUT EST « AVEC SUIVI », et c'est deliberé : un dossier existant n'a
// pas ce champ, et rien ne doit changer pour lui tant que le coach n'a rien
// dit. C'est LUI qui bascule, athlete par athlete — aucune deduction
// automatique, aucune surprise.
function estSuivi(c){ return !!c && c.suivi!==false; }
// ══ LE TRI ATTEND QUE LE DOIGT AIT FINI ═════════════════════════════════════
//
// ⚠ LA PANNE QUE CECI CORRIGE, et elle ne ressemblait pas a ce qu'elle etait.
//   Kevin : « le bouton on/off de suivi n'est pas tout le temps cliquable ».
//   Le clic partait toujours. C'est la SUITE qui trompait : basculer un
//   athlete le fait changer de section, la liste se repeignait aussitot, et il
//   descendait de trois rangs. Mesure sur douze athletes — a3 bascule, passe
//   du rang 3 au rang 6, et sous le point exact ou l'on venait de cliquer se
//   trouvait desormais le curseur de a4. Un second clic au meme endroit
//   basculait a4 : de la chaise du coach, le premier clic « n'avait rien
//   fait » et un autre athlete changeait tout seul.
//
// LE TRI EST DONC DIFFERE. La bascule ecrit tout de suite — donnee, nuage,
// message — et le curseur bascule sous le doigt, comme une case a cocher
// ordinaire. Le reordonnancement, lui, attend que plus rien ne se touche. Le
// coach qui fait passer cinq athletes d'un coup les touche tous les cinq, et
// la liste se range UNE fois, quand il a fini.
//
// UNE SECONDE ET DEMIE : au-dela, le desordre dure assez pour qu'on s'y perde ;
// en-deca, on retombe dans le saut sous le doigt.
const SUIVI_REORDRE_MS=1500;
let _suiviReordre=0;
/**
 * Range la liste, une fois que la salve de bascules est finie. Chaque appel
 * repousse l'echeance : c'est ce qui rend la salve possible.
 */
function _suiviRangerPlusTard(){
  try{ clearTimeout(_suiviReordre); }catch(e){}
  _suiviReordre=setTimeout(()=>{ try{ renderClientList(); }catch(e){} },SUIVI_REORDRE_MS);
}
function coachBasculerSuivi(id,ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  const users=DB.get('users')||{};
  const c=getOwnedClient(id,users);
  if(!c) return;
  c.suivi=!estSuivi(c);
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  // LES COMPTEURS ET LES TITRES DE SECTION, EUX, SUIVENT TOUT DE SUITE : ils
  // ne sont pas sous le doigt, et les laisser mentir pendant une seconde et
  // demie ferait douter du clic qu'on vient justement de rendre fiable.
  try{ renderPortefeuille(); }catch(e){}
  try{ _majComptesSectionsSuivi(); }catch(e){}
  _suiviRangerPlusTard();
  try{ if(currentClientId===id) openClientDetail(id,true,true); }catch(e){}
  toastSync(ok,envoi,estSuivi(c)?'Passé en suivi':'Passé sans suivi',"le changement est");
}
/**
 * Recompte « Mes athletes (avec / sans suivi) » sans repeindre la liste. Les
 * deux titres portent la classe `.sec-suivi`, et leur compte est le second
 * <span> — c'est _htmlSectionsSuivi qui les ecrit, et lui seul.
 */
function _majComptesSectionsSuivi(){
  const z=document.getElementById('ch-clients-list');
  if(!z) return;
  const lignes=[...z.querySelectorAll('.client-row')];
  const suivi=id=>{ try{ return estSuivi(getOwnedClient(id,DB.get('users')||{})||{}); }catch(e){ return false; } };
  const avec=lignes.filter(l=>suivi(l.dataset.cid)).length;
  const t=[...z.querySelectorAll('.sec-suivi')];
  if(t[0]) t[0].textContent=String(avec);
  if(t[1]) t[1].textContent=String(lignes.length-avec);
}
// Le curseur, tel qu'il apparait sur la ligne et sur la fiche.
// ══ LE SUIVI EST UN INTERRUPTEUR, PLUS UNE PILULE ═══════════════════════
//
// Demande de Kevin, 14/09/2026 : « j'aurais aimé un curseur type on/off pour
// activer le suivi ». Il avait raison au-dela de l'esthetique : « ● SUIVI » et
// « ○ SANS SUIVI » sont deux libelles de LONGUEURS DIFFERENTES dans une colonne
// de tableau — la ligne changeait de largeur selon l'etat de l'athlete, et
// l'oeil qui descend la liste voyait la colonne respirer. Un interrupteur a une
// seule largeur, et sa position dit l'etat sans qu'on lise un mot.
//
// LE VOCABULAIRE EST CELUI DE .tbk-swi, l'interrupteur des macros du coach :
// meme gabarit, meme course, meme pastille. Seul l'accent change — rouge, le
// domaine de cette liste, la ou les macros sont en orange.
//
// `taille` GARDE SON SENS pour les appelants hors tableau : ils demandent
// « grand », ils obtiennent un interrupteur accompagne de son mot.
function _htmlCurseurSuivi(c,taille){
  const on=estSuivi(c);
  const nom=((c&&c.fname)||'')+' '+((c&&c.lname)||'');
  const lbl='Suivi de '+(nom.trim()||'cet athlète');
  // stopPropagation : la ligne entiere est cliquable, et sans lui basculer le
  // suivi ouvrirait aussi la fiche.
  return '<label class="cr-swi'+(taille==='grand'?' cr-swi-g':'')+'"'
    +' title="Suivi actif ou non" onclick="event.stopPropagation()">'
    +'<input type="checkbox"'+(on?' checked':'')
    +' onchange="coachBasculerSuivi(\''+c.id+'\',event)"'
    +' aria-label="'+escapeHtml(lbl)+'">'
    +'<span class="cr-swi-p"></span>'
    +(taille==='grand'?'<span class="cr-swi-t">'+(on?'Suivi':'Sans suivi')+'</span>':'')
    +'</label>';
}
function renderClientRow(c){
  // Le `title` porte le texte ENTIER : en mode tableau le badge se coupe a la
  // largeur de sa colonne, et « Abonnement a souscrire » n'y tiendra jamais.
  const _bdg=(cls,txt)=>'<span class="badge '+cls+'" title="'+escapeHtml(txt)+'">'+escapeHtml(txt)+'</span>';
  // UN SEUL PREDICAT : le badge, le filet (data-etat) et les autres ecrans
  // lisent etatAthlete. Ils ne peuvent plus se contredire.
  const _etat=etatAthlete(c);
  const badge=_bdg(ETAT_BADGE[_etat][0],ETAT_BADGE[_etat][1]);
  const lastSession=c.sessions?.length?c.sessions[c.sessions.length-1].date:0;
  const lastBilan=c.bilans?.length?c.bilans[c.bilans.length-1].date:0;
  const lastActivity=Math.max(lastSession,lastBilan);
  const activityLine=lastActivity?'Dernière activité : '+ago(lastActivity):'Aucune activité encore';
  const avatarHtml=c.athletePhoto
    ?`<img src="${escapeHtml(c.athletePhoto)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--r-full)">`
    :escapeHtml(ini(c.fname,c.lname));
  const _objDisplay=c.objective||c.bilanGoals||'';
  // Objectif et phase sont emis MEME absents, avec un contenu vide. Sur grand
  // ecran la ligne devient une ligne de tableau, et une cellule qui disparait
  // sur les seules lignes sans objectif decalerait toutes les colonnes qui la
  // suivent. `.cr-obj:empty{display:none}` les efface sous 1025 px : la carte
  // empilee du telephone est rigoureusement celle d'avant.
  const objLine=`<div class="cr-obj" style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_objDisplay?escapeHtml(_objDisplay):''}</div>`;
  // ⚠ PHASE, POIDS ET PROGRES ONT QUITTE LA LIGNE le 19/09/2026, a la demande
  //   de Kevin. Ils n'ont pas disparu de l'application : le tiroir de
  //   contexte les affiche pour l'athlete qu'on regarde, avec leur intitule
  //   en toutes lettres — `_crPoids` et `_crProgres` y servent toujours. Ce
  //   qui partait ici, c'est trois colonnes de plus a balayer sur une ligne
  //   qu'on lit en diagonale.
  // Les trois mesures, EMISES MEME VIDES, pour la même raison que l’objectif
  // et la phase : sur grand écran la ligne devient une ligne de tableau, et
  // une cellule absente décalerait toutes les colonnes suivantes.
  //
  // Aucun seuil, aucune couleur par valeur : la liste porte déjà un filet
  // d’état et un badge, et une quatrième teinte à interpréter les affaiblirait
  // tous les trois.
  const _cel=(cls,txt,titre)=>`<div class="${cls}" title="${escapeHtml(titre)}" style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px;white-space:nowrap">${txt?escapeHtml(txt):''}</div>`;
  const chLine=_cel('cr-charge',_crCharge(c),'Charge de la semaine, sur la moyenne des 4 précédentes');
  const biLine=_cel('cr-bilans',_crBilans(c),'Bilans sans réponse');
  // N6.4 — les trois mesures qui manquaient, sur le meme patron : emises MEME
  // VIDES, effacees sous le seuil du tableau par la regle :empty existante.
  const asLine=_cel('cr-assidu',_crAssidu(c),'Séances faites sur séances prévues');
  const diLine=_cel('cr-diete',_crDiete(c),'Jours où la cible a été tenue');
  const _nm=(escapeHtml(c.fname||'')+' '+escapeHtml(c.lname||'')).trim()||'Profil incomplet';
  // L'ETAT est porte par un attribut plutot que par une classe : il pilote la
  // couleur du filet gauche, et c est ce qui permet de balayer la liste sans
  // lire un seul badge. Le classement suit CELUI DU BADGE, a la lettre — deux
  // regles differentes donneraient une carte rouge a badge vert.
  // N4.13 — LA CASE RELIT LE Set A CHAQUE RENDU : c'est ce qui la fait
  // survivre a la reecriture du conteneur toutes les trente secondes.
  const _coche=SEL_ATHLETES.has(c.id)?' checked':'';
  // La meta du telephone : cachee au-dela de 600 px (et en tableau, ou elle
  // ne doit pas devenir une cellule).
  let _meta=''; try{ _meta=crMetaFaits(c,currentUser&&currentUser.contacts,Date.now()).map(escapeHtml).join(' · '); }catch(e){ _meta=''; }
  return `<div class="client-row${_etat!=='douleur'&&!hasNewBilan(c)&&!needsAlert(c)&&!isActive(c)?' row-inactive':''}" data-etat="${_etat}" data-cid="${c.id}" onclick="openClientDetail('${c.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <input type="checkbox" class="cr-coche"${_coche} value="${c.id}"
      onclick="selAthleteBascule('${c.id}',event)"
      aria-label="Sélectionner ${escapeHtml(((c.fname||'')+' '+(c.lname||'')).trim()||'cet athlète')}">
    <div class="avatar" style="width:44px;height:44px;font-size:var(--fs-lg);overflow:hidden;flex-shrink:0">${avatarHtml}</div>
    <div style="flex:1;min-width:0"><div class="cr-nom" title="${_nm}">${_nm}</div><div class="cr-meta">${_meta}</div>${objLine}${asLine}${diLine}${chLine}${biLine}</div>
    <!-- ══ LE BOUTON EST DANS LA LIGNE, A COTE DU NOM ═══════════════════
         Demande de Kevin, 08/09/2026 : « je vois Claire Boumar, je peux
         cliquer directement sur ouvrir la fiche a cote de son prenom ».
         Il REMPLACE la ligne « Derniere activite », qui disait la meme chose
         que le badge d'etat deux colonnes plus loin.
         stopPropagation : la ligne entiere est deja cliquable, et sans lui le
         clic partirait deux fois. -->
    <!-- IL FORCE L'OUVERTURE, ET C'EST TOUT SON PROPOS. Sans le troisieme
         argument, ce bouton passait par le tiroir : on cliquait « OUVRIR LA
         FICHE » et on obtenait un panneau qui proposait… « Ouvrir la fiche ».
         Signale par Kevin le 08/09/2026, capture a l'appui. Un bouton qui
         porte un verbe fait ce que le verbe dit, du premier coup.
         Le clic sur le RESTE de la ligne, lui, garde l'apercu : c'est le
         geste vague, et il merite un apercu. -->
    <button class="btn btn-red btn-sm cr-fiche" onclick="event.stopPropagation();openClientDetail('${c.id}',false,true)"
      title="Ouvrir la fiche de ${_nm}" aria-label="Ouvrir la fiche de ${_nm}"
      style="margin:0;flex-shrink:0;letter-spacing:1px;padding:8px 12px;min-height:36px;font-size:var(--fs-2xs);white-space:nowrap"><span class="cr-fiche-l">Ouvrir la fiche</span><span class="cr-fiche-c">Voir profil</span><span class="cr-fiche-f" aria-hidden="true">›</span></button>
    ${_htmlCurseurSuivi(c)}
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">${badge}<span class="rq-z" data-rq="${escapeHtml(_relCle(c))}">${_htmlPuceRisqueDe(c)}</span></div>
  </div>`;
}
// ══════ ANNUAIRE : LES DEUX DÉCISIONS, SORTIES DU RÉSEAU ═══════════════════
// Elles vivaient dans le corps de pullAnnuaire et de _rapatrierElevesInconnus,
// derrière un `await` — donc intestables depuis une suite synchrone. Ce sont
// pourtant elles qui décident QUI apparaît sur le tableau de bord : autant les
// mettre là où on peut les éprouver.
//
// PURES : ni DOM, ni réseau, ni currentUser.

// Les adresses d'un nœud d'annuaire, tel que Firebase le rend.
// LA CLEF EST L'ADRESSE, virgules à la place des points. On lit quand même le
// champ `email` quand il est là : inverser la clef marche, mais dépendre d'une
// inversion là où la valeur est écrite noir sur blanc serait fragile pour rien.
// L'inversion reste le REPLI — une entrée écrite par une version antérieure,
// ou tronquée, ne doit pas faire disparaître l'élève de la liste.
function _annuaireAdresses(noeud){
  if(!noeud||typeof noeud!=='object') return [];
  return Object.keys(noeud).map(k=>{
    const v=noeud[k];
    const e=(v&&typeof v.email==='string'&&v.email)?v.email:String(k).replace(/,/g,'.');
    return String(e).toLowerCase();
  }).filter(Boolean);
}
// Celles dont cet appareil n'a pas encore le dossier.
// SANS CE FILTRE, 40 ATHLÈTES FONT 40 ALLERS-RETOURS à chaque ouverture du
// tableau de bord, pour retélécharger ce qu'on a déjà. La comparaison est
// insensible à la casse : les adresses servent de clefs de stockage, et une
// majuscule saisie à l'inscription suffirait à créer un doublon.
function _annuaireManquants(adresses,connues){
  const vus=new Set((connues||[]).map(k=>String(k||'').toLowerCase()));
  const out=[];
  for(const a of (adresses||[])){
    // TRIM : une entree d'annuaire faite d'espaces passait le filtre — elle
    // est non vide au sens de JavaScript — et partait en synchronisation
    // vers /users/  .json. Trouve par l'assertion, pas en production.
    const e=String(a||'').trim().toLowerCase();
    if(!e||vus.has(e)) continue;
    vus.add(e);                       // et pas deux fois la même dans un lot
    out.push(e);
  }
  return out;
}

// Releve des codes consommes. Un athlete qui saisit un code sur un appareil
// neuf n'existe nulle part chez le coach : ni dans ses users locaux, ni dans
// sa liste clients. Le seul lien est le noeud /rc_codes/{token}, que l'athlete
// marque redeemed en y inscrivant son email. On le relit donc a chaque
// ouverture du tableau de bord, et on tire le dossier correspondant.
// Sans reseau, la fonction ne fait rien et n'affiche pas d'erreur : ce n'est
// pas une action demandee par le coach.
// Rapatrie les élèves que cet appareil n'a jamais vus.
//
// Le tableau de bord ne montrait que les athlètes DÉJÀ dans le stockage local :
// ceux venus d'une invitation par lien, et ceux inscrits sur ce même appareil.
// Un élève qui a créé son compte sur son propre téléphone n'était nulle part —
// c'est le cas signalé par Kevin le 25/08/2026.
//
// L'annuaire donne les ADRESSES ; c'est syncUser qui va chercher les dossiers,
// un par un, exactement comme pour les autres. Les règles décident : un dossier
// qui ne désigne pas ce coach répond 401 et n'entre pas.
//
// SANS AWAIT DANS L'APPELANT : le tableau de bord s'affiche tout de suite avec
// ce qu'on a, et se complète quand le réseau répond. Même traitement que
// _rafraichirCodesEleves, juste à côté.
async function _rapatrierElevesInconnus(){
  if(!currentUser||currentUser.role!=='coach'||!CLOUD.ok()) return 0;
  let adresses=[];
  try{ adresses=await CLOUD.pullAnnuaire(currentUser); }catch(e){ return 0; }
  if(!adresses.length) return 0;
  const manquants=_annuaireManquants(adresses,Object.keys(DB.get('users')||{}));
  if(!manquants.length) return 0;
  let venus=0;
  for(const e of manquants){
    // Un échec ne doit pas arrêter les suivants : un dossier peut avoir été
    // supprimé, ou son rattachement défait, pendant que les autres vont bien.
    try{ if(await CLOUD.syncUser(e)) venus++; }catch(err){}
  }
  // Re-rendu seulement si le coach est encore sur son tableau de bord : la
  // requête est longue, il a pu naviguer ailleurs entre-temps.
  if(venus&&document.getElementById('s-coach-home')?.classList.contains('active'))
    loadCoachHome();
  return venus;
}
async function _rafraichirCodesEleves(){
  const codes=(currentUser&&currentUser.studentCodes)||[];
  const actifs=codes.filter(c=>c&&c.token&&c.active!==false);
  if(!actifs.length||!CLOUD.ok()) return;
  let tok=null;
  try{tok=await CLOUD._getToken();}catch(e){return;}
  let change=false;
  for(const c of actifs){
    let data=null;
    try{
      const r=await fetch(_rcCodesUrl(c.token)+(tok?'?auth='+tok:''));
      if(!r.ok) continue;
      data=await r.json();
    }catch(e){continue;}
    if(!data) continue;
    // L'ÉTAT D'OUVERTURE D'ABORD, et AVANT la sortie sur `redeemed` : c’est
    // précisément quand l’athlète a ouvert le lien SANS avoir encore créé son
    // compte que `etat:'ouvert'` existe. La sortie plus bas l’écartait donc
    // dans le seul cas où il avait quelque chose à dire, et « Ouverte » était
    // littéralement inatteignable.
    //
    // etatProgresse GARDE LE SENS UNIQUE : un aperçu tardif ne fait pas reculer
    // un compte déjà créé, et etatInvitation fait primer `redeemed`.
    if(etatProgresse(etatInvitation(c),data.etat)){
      c.etat=data.etat;
      if(data.ouvertLe) c.ouvertLe=data.ouvertLe;
      change=true;
    }
    if(!data.redeemed||!data.athleteEmail) continue;
    // Le dossier n'est lisible que si l'athlete a bien inscrit coachEmailKey :
    // c'est la condition posee par database.rules.json. Un echec ici signifie
    // que le rattachement n'est pas alle au bout, pas que le code est faux.
    try{await CLOUD.syncUser(data.athleteEmail);}catch(e){}
    if(c.redeemed!==true||c.athleteEmail!==data.athleteEmail){
      c.redeemed=true;
      c.athleteEmail=data.athleteEmail;
      if(data.usedBy) c.usedBy=data.usedBy;
      change=true;
    }
  }
  if(change){
    saveUser();
    // Re-rendu seulement si le coach est encore sur son tableau de bord : la
    // requete est longue, il a pu naviguer ailleurs entre-temps.
    if(document.getElementById('s-coach-home')?.classList.contains('active')) loadCoachHome();
  }
}

// ══════════════ ACTIVITÉ DU PORTEFEUILLE — 13 MOIS GLISSANTS ══════════════
// Six fonctions PURES, sans DOM, sans réseau. Elles ne lisent que le tableau
// d'athlètes déjà en mémoire (getClients → localStorage), et n'ajoutent aucun
// champ : tout est dérivé de sessions[], createdAt et phase.
//
// AUCUN CHIFFRE D'ARGENT, aucun classement, aucune moyenne de marché :
// RepCore ne connaît ni le prix de vente du coach, ni les autres coachs.
//
// AUCUNE DONNÉE DE SANTÉ NE SORT D'ICI. _estEnPause rend un booléen et rien
// d'autre : ni la cause, ni le champ qui l'a déclenchée. C'est volontaire —
// « en pause » se dit, « enceinte » ne se dit pas.
const ACT_MOIS=13;
const ACT_SORTIE_JOURS=60;      // sans séance depuis ce délai = sortie
const ACT_MIN_ATHLETES=5;       // en dessous, ni médiane ni tendance
const ACT_FENETRE_SEM=4;        // fenêtre de complétion

function _actMoisCle(d){
  const p=n=>(n<10?'0':'')+n;
  return d.getFullYear()+'-'+p(d.getMonth()+1);
}
function _actDebutMois(d){ return new Date(d.getFullYear(),d.getMonth(),1).getTime(); }
function _actSessions(a){
  const l=(a&&a.sessions)||[];
  return Array.isArray(l)?l.filter(s=>s&&typeof s.date==='number'&&s.date>0):[];
}
// PURE. Au moins une séance loggée dans [debut, fin[. C'est LA définition
// d'« actif », elle n'existe qu'ici, et l'écran l'affiche mot pour mot.
function _estActifSurPeriode(a,debut,fin){
  for(const s of _actSessions(a)) if(s.date>=debut&&s.date<fin) return true;
  return false;
}
// PURE. Vrai si l'athlète est en pause DÉCLARÉE, quelle qu'en soit la cause.
// La cause n'est jamais rendue : quatre situations, un seul booléen.
//
// LIMITE ASSUMÉE : une grossesse NON PARTAGÉE est retirée du dossier avant
// qu'il n'arrive chez le coach (CLOUD, « if(!safe.grossessePartagee) delete
// safe.grossesse »). Elle est donc invisible ici, et l'athlète sera comptée
// comme sortie. On ne la devine pas — l'écran dit la limite au lieu de la
// contourner.
function _estEnPause(a){
  if(!a) return false;
  try{ if(pauseActive(a)) return true; }catch(e){}
  try{ if(drapeauRougeActif(a)) return true; }catch(e){}
  const g=a.grossesse;
  if(g&&(g.etat==='enceinte'||g.etat==='allaitement'||g.actif===true)) return true;
  const e=a.etatGrossesse;
  if(e==='enceinte'||e==='allaitement') return true;
  return false;
}
// PURE. Treize entrées au plus, la plus ancienne d'abord. La fenêtre s'arrête
// au premier mois où le coach avait au moins un athlète : un coach de trois
// mois voit trois barres, pas dix à zéro suivies de trois.
function _actifsParMois(athletes,now){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  // AUCUN athlète : aucune barre. Sans ce retour, `plusVieux` restait à
  // l'infini, le garde-fou ci-dessous ne se déclenchait jamais, et un coach
  // qui vient de s'inscrire lisait treize mois à zéro — soit exactement le
  // faux effondrement que cette fenêtre doit éviter.
  if(!l.length) return [];
  const d=(now instanceof Date)?new Date(now):new Date(now||Date.now());
  let plusVieux=Infinity;
  for(const a of l){
    const c=Number(a.createdAt);
    if(isFinite(c)&&c>0&&c<plusVieux) plusVieux=c;
    for(const s of _actSessions(a)) if(s.date<plusVieux) plusVieux=s.date;
  }
  const out=[];
  for(let i=ACT_MOIS-1;i>=0;i--){
    const m=new Date(d.getFullYear(),d.getMonth()-i,1);
    const debut=m.getTime();
    const fin=new Date(d.getFullYear(),d.getMonth()-i+1,1).getTime();
    // Rien avant le premier athlète : on n'affiche pas des zéros trompeurs.
    if(isFinite(plusVieux)&&fin<=plusVieux) continue;
    let n=0;
    for(const a of l) if(_estActifSurPeriode(a,debut,fin)) n++;
    out.push({mois:_actMoisCle(m),actifs:n});
  }
  return out;
}
// ══════════════════ CROISSANCE HEBDOMADAIRE DU COACH ══════════════════════
// Combien d'athlètes sont arrivés semaine par semaine, d'après la date de
// création de leur dossier, et où en est le total.
const CROISSANCE_SEMAINES=12;
// Le lundi de la semaine contenant t. getDay() rend 0 pour dimanche : le
// décalage remet lundi à 0, sans quoi une arrivée du dimanche basculerait
// dans la semaine suivante.
function _lundiDe(t){
  const d=new Date(t); d.setHours(0,0,0,0);
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return d;
}
// ══════════ N JOURS APRES, EN CALENDRIER ET NON EN MILLISECONDES ═══════
//
// LE DERNIER DIMANCHE D'OCTOBRE DURE VINGT-CINQ HEURES. Ajouter 7 x 864e5 a un
// lundi de minuit rend donc le dimanche a 23 h, pas le lundi suivant — et tout
// ce qui range cette date dans une semaine la range dans la PRECEDENTE. Le
// commentaire de croissanceHebdo le dit deja pour ses propres bornes ; cette
// fonction-ci le rend disponible partout, pour que la lecon n'ait pas a etre
// reapprise a chaque nouveau calcul.
//
// setDate ACCEPTE LES DEBORDEMENTS et les negatifs : le 35 janvier devient le
// 4 fevrier, le 0 janvier le 31 decembre. C'est le moteur de dates du langage
// qui fait le calendrier, avec ses mois inegaux, ses annees bissextiles et ses
// changements d'heure — on ne le refait pas.
//
// setHours APRES setDate, et pas avant : c'est le decalage du jour d'ARRIVEE
// qui compte, pas celui du depart.
function _datePlusJours(t,n){
  const d=new Date(t);
  d.setDate(d.getDate()+Math.round(Number(n)||0));
  d.setHours(0,0,0,0);
  return d;
}
// PURE. Une entrée par semaine, de la plus ancienne à la semaine en cours.
//
// Les bornes sont calculées EN DATES et non en millisecondes : ajouter
// 7 × 864e5 traverse mal un changement d'heure, la frontière dérive d'une
// heure et un dossier créé dans cet intervalle change de semaine.
//
// Les dossiers SANS date de création sont antérieurs au champ — le reste du
// fichier les traite déjà comme anciens. Ils entrent donc dans le total dès
// le premier point mais ne font naître aucune barre : on ne leur invente pas
// une semaine d'arrivée.
function croissanceHebdo(athletes,now,nbSemaines){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  const n=Math.max(1,Math.floor(nbSemaines||CROISSANCE_SEMAINES));
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  const base=_lundiDe(t);
  // k est un nombre de SEMAINES, d'ou le x7 : sans lui la fenetre de douze
  // semaines couvrait douze JOURS, et presque toutes les arrivees tombaient
  // hors du graphique sans que rien ne le signale.
  const lundi=k=>{ const d=new Date(base); d.setDate(d.getDate()+k*7); d.setHours(0,0,0,0); return d.getTime(); };
  let socle=0; const dates=[];
  for(const a of l){
    const c=Number(a&&a.createdAt);
    // ⚠ LE SUIVI EST GARDÉ AVEC LA DATE, et c'est lui qui donne les deux
    //   couleurs de la barre. Le repli sur « avec suivi » n'est pas un aveu
    //   d'ignorance : estSuivi rend vrai par défaut dans l'application, et une
    //   barre entière vaut mieux qu'une barre amputée si la fonction manque.
    let s=true;
    try{ if(typeof estSuivi==='function') s=!!estSuivi(a); }catch(e){ s=true; }
    if(isFinite(c)&&c>0&&c<=t) dates.push({t:c,suivi:s}); else socle++;
  }
  const debutFenetre=lundi(-(n-1));
  let cumul=socle+dates.filter(x=>x.t<debutFenetre).length;
  const out=[];
  for(let i=0;i<n;i++){
    const debut=lundi(i-(n-1)), fin=lundi(i-(n-1)+1);
    const dans=dates.filter(x=>x.t>=debut&&x.t<fin);
    const nouveaux=dans.length, avec=dans.filter(x=>x.suivi).length;
    cumul+=nouveaux;
    // `nouveaux` ET `cumul` NE BOUGENT PAS : ce sont eux que lisent l'échelle
    // de gauche, la ligne du total et les trois phrases de la carte. `avec` et
    // `sans` s'ajoutent, ils ne remplacent rien.
    out.push({debut,fin,nouveaux,avec,sans:nouveaux-avec,cumul});
  }
  return out;
}
// Le tracé. Deux échelles : les barres comptent les arrivées de la semaine,
// la ligne compte le total. Sur une échelle commune, une barre de 1 face à un
// total de 40 ferait un pixel de haut.
function _dessinerCroissance(id,pts){
  const c=_setupCanvas(id,150); if(!c||!pts||!pts.length) return;
  const{ctx,w,h}=c;
  const gL=26,gR=24,gT=12,gB=26;
  const iw=Math.max(1,w-gL-gR), ih=Math.max(1,h-gT-gB);
  const maxN=Math.max(1,...pts.map(p=>p.nouveaux));
  const maxC=Math.max(1,...pts.map(p=>p.cumul));
  const yN=v=>gT+ih-(v/maxN)*ih;
  const yC=v=>gT+ih-(v/maxC)*ih;
  const pas=iw/pts.length;
  // Un voile sous la zone tracée : sans lui, le graphique flotte sur le noir
  // et rien ne dit où commence la surface de lecture.
  const voile=ctx.createLinearGradient(0,gT,0,gT+ih);
  voile.addColorStop(0,'rgba(255,255,255,.030)');voile.addColorStop(1,'rgba(255,255,255,.004)');
  ctx.fillStyle=voile;ctx.fillRect(gL,gT,iw,ih);
  // La grille : pointillés, sauf le socle. Les repères de GAUCHE comptent les
  // arrivées, ceux de DROITE le total.
  ctx.font='600 8.5px Montserrat,sans-serif';ctx.textBaseline='middle';
  [0,.5,1].forEach(f=>{
    const y=gT+ih-f*ih;
    ctx.strokeStyle=f===0?_tok('--border','#242424'):_tok('--border','#242424');ctx.lineWidth=1;
    ctx.setLineDash(f===0?[]:[3,4]);
    ctx.beginPath();ctx.moveTo(gL,y);ctx.lineTo(gL+iw,y);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='rgba(255,90,90,.55)';ctx.textAlign='right';
    ctx.fillText(String(Math.round(f*maxN)),gL-5,y);
    ctx.fillStyle='rgba(255,255,255,.42)';ctx.textAlign='left';
    ctx.fillText(String(Math.round(f*maxC)),gL+iw+5,y);
  });
  // LES BARRES, EN DEUX TEINTES. Demande de Kévin, 19/09/2026 : rouge pour
  // ceux qu'on suit, blanc pour les autres. La carte disait déjà la
  // répartition en une ligne de texte ; elle se lit maintenant semaine par
  // semaine, là où la question se pose — « ce mois-ci, j'ai recruté quoi ? ».
  //
  // EMPILÉES, ET NON CÔTE À CÔTE. La hauteur totale reste le nombre
  // d'arrivées, donc l'échelle de gauche continue de se lire et la ligne du
  // total reste cohérente avec les barres. Deux barres jumelles auraient
  // divisé la largeur par deux sur douze semaines : trois pixels chacune.
  //
  // LE ROUGE AU SOL. C'est la part qu'on veut voir grandir, et une base de
  // référence commune se compare d'une semaine à l'autre ; posée en haut,
  // elle flotterait à une altitude différente chaque fois.
  const bw=Math.max(3,Math.min(18,pas*0.52));
  pts.forEach((pt,i)=>{
    if(!pt.nouveaux) return;
    const x=gL+i*pas+(pas-bw)/2;
    // ⚠ REPLI SUR UNE SEULE TEINTE quand la série ne porte pas la répartition.
    //   Sans lui, un appelant d'avant ce lot aurait dessiné des barres VIDES :
    //   Number(undefined)||0 vaut zéro, et zéro plus zéro ne fait aucune barre.
    const deux=isFinite(Number(pt.avec))&&isFinite(Number(pt.sans));
    const avec=deux?Math.max(0,Number(pt.avec)):pt.nouveaux;
    const sans=deux?Math.max(0,Number(pt.sans)):0;
    const segs=[];
    if(avec) segs.push({n:avec,a:'#ff4a4a',b:'#6d0000',
      lueur:'rgba(224,32,32,.75)',arete:'rgba(255,255,255,.35)'});
    if(sans) segs.push({n:sans,a:'#ffffff',b:'#8f8f8f',
      lueur:'rgba(255,255,255,.55)',arete:'rgba(255,255,255,.95)'});
    let socle=0;
    segs.forEach((s,k)=>{
      const yBas=yN(socle), yHaut=yN(socle+s.n), bh=yBas-yHaut;
      const g=ctx.createLinearGradient(0,yHaut,0,yBas);
      g.addColorStop(0,s.a);g.addColorStop(1,s.b);
      ctx.fillStyle=g;ctx.shadowColor=s.lueur;ctx.shadowBlur=10;
      ctx.beginPath();
      // SEUL LE SEGMENT DU HAUT porte les coins arrondis : les arrondir tous
      // creuserait une encoche à la jonction des deux couleurs.
      const r=(k===segs.length-1)?[3,3,0,0]:[0,0,0,0];
      if(ctx.roundRect) ctx.roundRect(x,yHaut,bw,bh,r); else ctx.rect(x,yHaut,bw,bh);
      ctx.fill();ctx.shadowBlur=0;
      // Un liseré clair sur l'arête haute : c'est lui qui donne le relief.
      ctx.strokeStyle=s.arete;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x+1,yHaut+.5);ctx.lineTo(x+bw-1,yHaut+.5);ctx.stroke();
      socle+=s.n;
    });
  });
  // LA LIGNE DU TOTAL, sur les milieux de semaine.
  const ptsC=pts.map((pt,i)=>({x:gL+i*pas+pas/2,y:yC(pt.cumul)}));
  if(ptsC.length>1){
    const g=ctx.createLinearGradient(0,gT,0,gT+ih);
    g.addColorStop(0,'rgba(255,255,255,.26)');g.addColorStop(1,'rgba(255,255,255,.02)');
    ctx.beginPath();ctx.moveTo(ptsC[0].x,gT+ih);
    ptsC.forEach(q=>ctx.lineTo(q.x,q.y));
    ctx.lineTo(ptsC[ptsC.length-1].x,gT+ih);ctx.closePath();
    ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle=_tok('--text','#efefef');ctx.lineWidth=2;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.shadowColor='rgba(255,255,255,.85)';ctx.shadowBlur=9;
    ctx.beginPath();ptsC.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.stroke();
    ctx.shadowBlur=0;
  }
  // Le dernier point seul est marqué : c'est la valeur d'aujourd'hui.
  const dern=ptsC[ptsC.length-1];
  ctx.fillStyle=_tok('--text','#efefef');ctx.shadowColor='rgba(255,255,255,.9)';ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(dern.x,dern.y,3.5,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='#0b0b0b';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(dern.x,dern.y,3.5,0,Math.PI*2);ctx.stroke();
  // Les dates, une sur deux quand la place manque.
  ctx.fillStyle='#555';ctx.font='700 8.5px Montserrat,sans-serif';
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  const saut=pas<26?2:1;
  pts.forEach((pt,i)=>{
    if((pts.length-1-i)%saut) return;
    const d=new Date(pt.debut);
    ctx.fillText(d.getDate()+'/'+(d.getMonth()+1),gL+i*pas+pas/2,h-4);
  });
}
// La carte. Elle n'apparaît pas sans athlète : un graphique vide n'apprend
// rien et occupe la place de ce qui compte quand on démarre.
// QUI EST SUR L'APPLI, EN UNE LIGNE — les totaux, sous le titre de la carte.
// LE CHANTIER ANNONCE ICI A ETE FAIT le 19/09/2026 : ce commentaire disait que
// repeindre les barres en deux teintes demanderait de passer deux series a
// _dessinerCroissance. C'est exactement ce que croissanceHebdo rend desormais
// — `avec` et `sans` a cote de `nouveaux` — et les barres sont empilees, rouge
// pour les suivis, blanc pour les autres. Cette ligne de totaux reste : elle
// dit le portefeuille ENTIER, la ou les barres disent semaine par semaine.

// ══ LE RISQUE D'ABANDON, ET LA RELANCE PROPOSÉE PAR L'ASSISTANT (05/10/2026) ═
// Le Worker apprend chaque nuit (cloudflare/src/risque.js, travail
// 'retention') : risque_modele = {poids, n, auc, t} (aucune clé de compte) et
// risque/<athlète> = {p, t}, lu par son coach seul.
// ⚠ UNE INFORMATION DE PLUS, PAS UN RANG. urgencyScore n'est pas touché : la
//   puce « risque » s'ajoute sur la ligne et sur la fiche quand p ≥ 0,6, avec
//   les deux variables qui pèsent le plus (poids × valeur), en mots.
// ⚠ LA RELANCE N'EST JAMAIS ENVOYÉE SEULE. « Proposer un message » demande un
//   texte à l'assistant (tâche 'relance_courte') et l'affiche, modifiable ;
//   seul le bouton « Envoyer » appelle relanceIA, qui l'envoie (carte « Un mot
//   de ton coach » ou notification) et l'écrit au journal, moyen:'ia_valide'.
// ⚠ LES VARIABLES SONT CELLES DU SERVEUR (risqueVariables = variables de
//   risque.js, à la date du jour), recalculées ici depuis activiteResume :
//   même résumé, mêmes fenêtres, mêmes arrondis.
const RISQUE_SEUIL=0.6, RISQUE_CACHE_MS=60*60e3, RISQUE_RELANCE_J=7, RELANCE_IA_MAX=280;
const RISQUE_VARIABLES=Object.freeze(['a7','a14','a30','pente','dernier','checkin','notif','coach','anciennete']);
/** PURE. Les variables du résumé r au jour de t (risque.js, variables(r, t, 0)). */
function risqueVariables(r,t){
  if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.inscrit||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.jour||''))||!/^[01]{1,40}$/.test(String(r.j30||''))) return null;
  const J=864e5, ref=new Date(t).toLocaleDateString('fr-CA',{timeZone:'Europe/Paris'});
  const jours=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/J);
  const age=jours(r.inscrit,ref);
  if(age<0) return null;
  const etat=d=>{
    const x=new Date(Date.parse(ref+'T00:00:00Z')-d*J);
    // Le jour UTC de minuit UTC : la date du calendrier, sans fuseau (comme risque.js).
    const jour=x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0');
    if(jour<r.inscrit) return null;
    const apres=jours(r.jour,jour);
    if(apres>0) return 0;
    const b=String(r.j30), i=b.length-1+apres;
    return i<0?null:(b[i]==='1'?1:0);
  };
  const fen=(d0,n)=>{ let a=0,k=0; for(let d=d0;d<d0+n;d++){ const e=etat(d); if(e===null) continue; k++; a+=e; } return k?a*n/k:0; };
  const r3=x=>Math.round(x*1000)/1000;
  const a14=fen(0,14), avant=fen(14,14);
  let dernier=30;
  for(let d=0;d<30;d++){ const e=etat(d); if(e===null) break; if(e===1){ dernier=d; break; } }
  const lev=(r.lev&&typeof r.lev==='object')?r.lev:{};
  return {a7:r3(fen(0,7)/7),a14:r3(a14/14),a30:r3(fen(0,30)/30),pente:r3((a14-avant)/14),dernier:r3(dernier/30),
    checkin:lev.checkin?1:0,notif:lev.notif?1:0,coach:lev.coach?1:0,anciennete:r3(Math.min(age,180)/180)};
}
// Une variable en mots, du côté où elle pousse vers l'abandon.
function _risqueMot(k,v){
  const n=(x,m)=>Math.round(x*m);
  if(k==='dernier') return v>=1?'aucune activité depuis 30 jours ou plus':n(v,30)+' jours sans activité';
  if(k==='a7') return n(v,7)+' jour'+(n(v,7)>1?'s':'')+' actif'+(n(v,7)>1?'s':'')+' sur 7';
  if(k==='a14') return n(v,14)+' jour'+(n(v,14)>1?'s':'')+' actif'+(n(v,14)>1?'s':'')+' sur 14';
  if(k==='a30') return n(v,30)+' jour'+(n(v,30)>1?'s':'')+' actif'+(n(v,30)>1?'s':'')+' sur 30';
  if(k==='pente') return v<0?'activité en baisse sur deux semaines':'activité en hausse sur deux semaines';
  if(k==='checkin') return v?'check-ins réguliers au départ':'peu de check-ins au départ';
  if(k==='notif') return v?'notifications activées':'notifications coupées';
  if(k==='coach') return 'suivi par un coach';
  return 'inscrit depuis '+n(v,180)+' jours';
}
/**
 * PURE. Les deux variables qui pèsent le plus vers l'abandon (poids × valeur),
 * en mots. Le modèle prédit P(actif) : une contribution −w·x positive pousse
 * vers l'abandon.
 */
function risqueRaisons(v,poids){
  if(!v||!poids) return [];
  return RISQUE_VARIABLES.map(k=>({k,c:-(Number(poids[k])||0)*(Number(v[k])||0)}))
    .filter(x=>x.c>0).sort((a,b)=>b.c-a.c).slice(0,2).map(x=>_risqueMot(x.k,v[x.k]));
}
/** PURE. La puce, ou '' sous le seuil (ou sans risque connu). */
function htmlPuceRisque(p,raisons){
  const x=Number(p);
  if(!(x>=RISQUE_SEUIL)) return '';
  const r=(raisons||[]).filter(Boolean);
  return '<span class="rq-puce" title="Risque d’abandon estimé : '+Math.round(x*100)+' %'+(r.length?' — '+escapeHtml(r.join(', ')):'')+'">'
    +'Risque'+(r.length?'<span class="rq-pq"> · '+escapeHtml(r.join(', '))+'</span>':'')+'</span>';
}
// LA LECTURE, avec une heure de mémoire : le modèle, puis un nœud par athlète.
const _risque={modele:null,lu:0,p:{}};
function risqueDe(c){
  const k=_relCle(c), e=k&&_risque.p[k];
  return (e&&typeof e==='object'&&Number.isFinite(Number(e.p)))?Number(e.p):null;
}
function _htmlPuceRisqueDe(c){
  const p=risqueDe(c);
  if(!(p>=RISQUE_SEUIL)) return '';
  let v=null; try{ v=risqueVariables(activiteResume(c),Date.now()); }catch(e){ v=null; }
  return htmlPuceRisque(p,risqueRaisons(v,_risque.modele&&_risque.modele.poids));
}
async function risqueCharger(clients,force){
  if(!currentUser||currentUser.role!=='coach'||!CLOUD||!CLOUD._getToken) return false;
  const frais=!force&&Date.now()-_risque.lu<RISQUE_CACHE_MS;
  const l=(clients||[]).filter(c=>c&&c.email&&!c._fromCode).map(_relCle).filter(k=>k&&(!frais||!(k in _risque.p)));
  if(frais&&!l.length) return false;
  if(!frais||!_risque.modele){ const m=await _fbJson('risque_modele'); if(m.ok&&m.v) _risque.modele=m.v; }
  const res=await Promise.all(l.map(k=>_fbJson('risque/'+k).then(r=>[k,r]).catch(()=>[k,null])));
  for(const [k,r] of res) _risque.p[k]=(r&&r.ok)?(r.v||null):(_risque.p[k]||null);
  _risque.lu=Date.now();
  return true;
}
// Les emplacements de la liste et de la fiche, repeints quand la lecture arrive.
function risqueRepeindre(){
  document.querySelectorAll('[data-rq]').forEach(z=>{
    const c=(getClients()||[]).find(x=>_relCle(x)===z.dataset.rq);
    z.innerHTML=c?_htmlPuceRisqueDe(c):'';
  });
  return true;
}
function _risqueApresListe(clients){
  risqueCharger(clients).then(ch=>{ if(ch) risqueRepeindre(); }).catch(()=>{});
}
function renderRisqueFiche(c){
  const z=document.getElementById('ccd-risque');
  if(!z||!c) return false;
  z.dataset.rq=_relCle(c);
  z.innerHTML=_htmlPuceRisqueDe(c);
  risqueCharger([c]).then(ch=>{ if(ch) z.innerHTML=_htmlPuceRisqueDe(c); }).catch(()=>{});
  return true;
}

// ── « Proposer un message » (écran des relances) ─────────────────────────
/** PURE. Les athlètes à proposer : p ≥ 0,6, et aucune relance partie depuis 7 jours. */
function risqueAProposer(clients,journal,t){
  const n=Number(t)||Date.now();
  const recent=new Set((journal||[]).filter(e=>e&&e.statut==='parti'&&n-Number(e.at)<RISQUE_RELANCE_J*864e5).map(e=>e.cle));
  return (clients||[]).filter(c=>c&&c.email&&!c._fromCode&&risqueDe(c)>=RISQUE_SEUIL&&!recent.has(_relCle(c)))
    .sort((a,b)=>risqueDe(b)-risqueDe(a));
}
const _relIA={};   // cle → {texte, journalId, propose, attente}
function _htmlRisqueRelances(){
  if(!currentUser||currentUser.role!=='coach') return '';
  let l=[]; try{ l=risqueAProposer(getClients(),_relJournal||[],Date.now()); }catch(e){ l=[]; }
  if(!l.length) return '';
  const E=escapeHtml;
  return '<h2 class="rel-h">À risque de décrocher</h2>'
    +'<p class="sub rel-p">Estimé chaque nuit sur leur activité. L’assistant propose un message court ; tu le relis, tu le modifies, et rien ne part sans ton clic.</p>'
    +l.map(c=>{
      const k=_relCle(c), x=_relIA[k]||{}, ka=_attrArg(k);
      const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email;
      let h='<div class="rel-l rq-l" id="rq-l-'+E(k)+'"><div class="rel-l-h"><div class="rel-l-t">'+E(nom)+' '+_htmlPuceRisqueDe(c)+'</div></div>';
      if(x.texte==null) h+='<button type="button" class="btn btn-outline btn-sm" onclick="proposerRelanceIA('+ka+')"'+(x.attente?' disabled aria-busy="true"':'')+'>'
        +(x.attente?'L’assistant écrit…':'Proposer un message')+'</button>';
      else h+='<textarea class="rq-txt" id="rq-txt-'+E(k)+'" rows="4" maxlength="'+RELANCE_IA_MAX+'" aria-label="Message à '+E(nom)+'">'+E(x.texte)+'</textarea>'
        +'<div class="rel-l-c"><label>Par <select id="rq-voie-'+E(k)+'"><option value="canal">Dans l’app</option><option value="push">'+E(RELANCE_MOYENS.push)+'</option></select></label></div>'
        +'<div class="rq-b"><button type="button" class="btn btn-red btn-sm" onclick="envoyerRelanceIA('+ka+')"'+(x.attente?' disabled':'')+'>Envoyer</button>'
        +'<button type="button" class="btn btn-outline btn-sm" onclick="laisserRelanceIA('+ka+')">Laisser</button></div>';
      return h+'</div>';
    }).join('');
}
// La charge : le prénom, les jours sans séance, la dernière séance (son nom),
// les deux derniers messages du coach à cet athlète, ses formules.
async function chargeRelanceIA(c){
  let style=[];
  try{
    const p=await msgChargerPage(_msgCles(currentUser,_relCle(c)));
    if(p&&p.ok) style=p.liste.filter(m=>m&&m.de==='coach'&&m.texte).slice(-2).map(m=>String(m.texte).slice(0,400));
  }catch(e){ style=[]; }
  const ses=(c.sessions||[]).filter(s=>s&&Number(s.date)>0).sort((a,b)=>Number(b.date)-Number(a.date))[0];
  let j=-1; try{ j=joursSansSeance(c,Date.now()); }catch(e){ j=-1; }
  let formules=null; try{ formules=formulesReponse(currentUser); }catch(e){ formules=null; }
  return {prenom:String(c.fname||'').trim(),joursInactif:j,derniereSeance:ses?String(ses.name||'').slice(0,80):'',styleCoach:style,formules};
}
async function proposerRelanceIA(k){
  const c=(getClients()||[]).find(x=>_relCle(x)===k);
  if(!c||!CLOUD||!CLOUD._callFn) return false;
  const x=_relIA[k]=Object.assign(_relIA[k]||{},{attente:true});
  try{ renderRelancesCoach(); }catch(e){}
  let r=null, st=0;
  try{ r=await CLOUD._callFn('ia',{tache:'relance_courte',athlete:k,charge:await chargeRelanceIA(c)}); }
  catch(e){ r=null; st=(e&&e.statut)||0; }
  x.attente=false;
  if(!r||!r.ok||!r.proposition||!String(r.proposition.texte||'').trim()){
    toast(st===429?'Quota de l’assistant atteint ce mois-ci.':st===503?'L’assistant est en pause.':'L’assistant n’a rien proposé d’utilisable.','var(--orange)');
    try{ renderRelancesCoach(); }catch(e){}
    return false;
  }
  x.propose=String(r.proposition.texte).slice(0,RELANCE_IA_MAX);
  x.texte=x.propose; x.journalId=r.journalId||null;
  try{ renderRelancesCoach(); }catch(e){}
  return true;
}
function laisserRelanceIA(k){
  const x=_relIA[k];
  if(x&&x.journalId&&CLOUD&&CLOUD._callFn) try{ Promise.resolve(CLOUD._callFn('iaRetour',{journalId:x.journalId,statut:'rejete',distance:1})).catch(()=>{}); }catch(e){}
  delete _relIA[k];
  try{ renderRelancesCoach(); }catch(e){}
  return true;
}
// LE SEUL CHEMIN D'ENVOI : le bouton « Envoyer » du coach.
async function envoyerRelanceIA(k){
  const x=_relIA[k]; if(!x||x.texte==null||x.attente) return false;
  const ta=document.getElementById('rq-txt-'+k), sel=document.getElementById('rq-voie-'+k);
  const texte=String(ta?ta.value:x.texte).trim();
  if(!texte||texte.length>RELANCE_IA_MAX){ toast('Message vide ou trop long (280 caractères au plus).','var(--orange)'); return false; }
  x.texte=texte; x.attente=true;
  let r=null, st=0;
  try{ r=await CLOUD._callFn('relanceIA',{athlete:k,texte,voie:sel&&sel.value==='push'?'push':'canal',journalId:x.journalId||null}); }
  catch(e){ r=null; st=(e&&e.statut)||0; }
  x.attente=false;
  if(!r){ toast(st===409?'Une relance lui est déjà partie cette semaine.':'Le message n’est pas parti, réessaie.','var(--orange)'); try{ renderRelancesCoach(); }catch(e){} return false; }
  if(x.journalId) try{
    const d=_distanceTexte(x.propose||'',texte);
    Promise.resolve(CLOUD._callFn('iaRetour',{journalId:x.journalId,statut:d===0?'valide':'modifie',distance:d})).catch(()=>{});
  }catch(e){}
  delete _relIA[k];
  toast(r.ok?'Message envoyé '+ICO.coche:'Pas parti : '+((RELANCE_RAISONS&&RELANCE_RAISONS[r.raison])||'notification impossible'),r.ok?'var(--green)':'var(--orange)');
  _relChargerJournal(true).then(()=>{ try{ renderRelancesCoach(); }catch(e){} }).catch(()=>{});
  return true;
}
// ══ LA RECHERCHE RAPIDE (06/10/2026) ══════════════════════════════════════
// Mesure de Kevin, 60 athletes a 390 x 844 : un accueil de 16 068 px, la
// recherche a 9 066 px, plus de 7 000 px de vignettes au-dessus. Ouvrir un
// athlete precis demandait treize ecrans de defilement.
//
// UNE BARRE FIXE sous l'en-tete (onglet Athletes, et les ecrans coach qui
// reviennent a l'accueil), meme hauteur que #ch-search. La saisie ouvre huit
// resultats au plus, en surimpression, chacun avec quatre gestes directs.
// #ch-search reste plus bas et filtre la liste ; les deux champs partagent la
// meme valeur. Rien de tout cela n'est dans #ch-clients-list : le
// rafraichissement periodique ne le touche pas.
const RR_MAX=8, RR_APPROCHE_MIN=5;
// PURE. Distance de Levenshtein, bornee : on ne veut savoir que « 0, 1 ou
// plus ». Au-dela de `max`, rend max+1 sans finir le calcul.
function _rrDistance(a,b,max){
  const m=a.length, n=b.length;
  if(Math.abs(m-n)>max) return max+1;
  let prec=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cour=[i];
    let mini=i;
    for(let j=1;j<=n;j++){
      cour[j]=Math.min(prec[j]+1,cour[j-1]+1,prec[j-1]+(a[i-1]===b[j-1]?0:1));
      if(cour[j]<mini) mini=cour[j];
    }
    if(mini>max) return max+1;
    prec=cour;
  }
  return prec[n];
}
/**
 * PURE. Les athletes trouves par `q`, du plus sur au plus lointain :
 *   0. prenom exact ;
 *   1. debut du prenom, du nom, du nom complet ou de l'e-mail ;
 *   2. libelle d'une etiquette posee sur l'athlete ;
 *   3. contenu ailleurs dans le nom ou l'e-mail ;
 *   4. approche : une lettre de difference sur le prenom ou le nom, des que
 *      la saisie depasse quatre lettres (« karym » trouve Karim).
 * Meme normalisation que norm() : accents et casse ne comptent pas.
 * @param {any[]} clients
 * @param {string} q
 * @param {any} [etiquettes]  l'objet qui porte etiquettes et etiquettesAth (currentUser)
 * @returns {string[]} les identifiants, dans l'ordre
 */
function rechercheAthletes(clients,q,etiquettes){
  const s=norm(q);
  if(!s) return [];
  const libs={};
  try{ for(const e of etiquettesDe(etiquettes)) libs[e.id]=norm(e.lib); }catch(e){}
  const out=[];
  for(const c of (clients||[])){
    if(!c||c.id==null) continue;
    const f=norm(c.fname), l=norm(c.lname), full=(f+' '+l).trim(), mail=norm(c.email);
    const mots=full.split(/\s+/).filter(Boolean);
    const jetons=s.split(/\s+/).filter(Boolean);
    let rang=-1;
    if(f&&f===s) rang=0;
    else if((f&&f.startsWith(s))||(l&&l.startsWith(s))||full.startsWith(s)||(mail&&mail.startsWith(s))
      ||(jetons.length>1&&jetons.every(j=>mots.some(m=>m.startsWith(j))))) rang=1;
    else {
      let et=[]; try{ et=etiquettesAthlete(etiquettes,c.id); }catch(e){ et=[]; }
      if(et.some(id=>libs[id]&&libs[id].includes(s))) rang=2;
      else if(full.includes(s)||(mail&&mail.split('@')[0].includes(s))) rang=3;
      else if(s.length>=RR_APPROCHE_MIN&&mots.some(m=>m.length>=RR_APPROCHE_MIN-1&&_rrDistance(m,s,1)<=1)) rang=4;
    }
    if(rang>=0) out.push({id:String(c.id),rang,cle:full||mail});
  }
  out.sort((a,b)=>a.rang-b.rang||a.cle.localeCompare(b.cle,'fr'));
  return out.map(x=>x.id);
}
// PURE. Le fait qu'on lit d'un coup d'oeil : la douleur d'abord, puis le
// bilan a lire, puis la derniere seance.
function rrFait(c,maintenant){
  try{ if(athleteDouleur(c)) return 'douleur'; }catch(e){}
  let nb=0; try{ nb=bilansSansReponse(c); }catch(e){ nb=0; }
  if(nb>0) return nb>1?nb+' bilans à lire':'bilan à lire';
  const f=crMetaFaits(Object.assign({},c,{bilans:[]}),null,maintenant);
  return f[0]||'';
}
let _rrResultats=[];
function _rrChamp(){ return document.getElementById('ch-rech'); }
function _rrFermer(){
  const z=document.getElementById('ch-rech-res');
  if(z){ z.innerHTML=''; z.hidden=true; }
  const c=_rrChamp(); if(c) c.setAttribute('aria-expanded','false');
  return true;
}
function _rrHtml(c){
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Profil incomplet';
  const id=String(c.id).replace(/'/g,'');
  let fait=''; try{ fait=rrFait(c,Date.now()); }catch(e){ fait=''; }
  const b=(lib,js)=>'<button type="button" class="rr-a" onclick="event.stopPropagation();_rrFermer();'+js+'">'+lib+'</button>';
  return '<li class="rr-l" role="option"><button type="button" class="rr-nom" onclick="_rrFermer();openClientDetail(\''+id+'\',false,true)">'
    +'<span class="rr-n">'+escapeHtml(nom)+'</span>'+(fait?'<span class="rr-f'+(fait==='douleur'?' rr-f-d':'')+'">'+escapeHtml(fait)+'</span>':'')+'</button>'
    +'<span class="rr-actions">'
    +b('Fiche','openClientDetail(\''+id+'\',false,true)')
    +b('Bilan','rrOuvrirBilan(\''+id+'\')')
    +b('Message','msgOuvrirFil('+_attrArg(_relCle(c))+')')
    +b('Programme','rrOuvrirProgramme(\''+id+'\')')
    +'</span></li>';
}
function rrOuvrirBilan(id){
  currentClientId=id;
  try{ viewClientBilans(); evoTab('reponses'); }catch(e){ return false; }
  return true;
}
function rrOuvrirProgramme(id){
  currentClientId=id;
  try{ return ouvrirSeancesSansBrouillon(); }catch(e){ return false; }
}
// Aucun resultat : les codes en attente, la ou vivent ceux qui ne sont pas
// encore inscrits.
function rrChercherCodes(){
  const q=norm((_rrChamp()||{}).value||'');
  _rrFermer();
  try{ coachTab('codes'); }catch(e){}
  setTimeout(()=>{
    const z=document.getElementById('ct-codes');
    if(!z||!q) return;
    const n=[...z.querySelectorAll('div,li,span')].find(x=>x.children.length===0&&norm(x.textContent).includes(q));
    if(n){ try{ n.scrollIntoView({block:'center'}); }catch(e){} }
    else toast('Aucun code en attente ne correspond','var(--orange)');
  },60);
  return true;
}
/** La saisie : la liste plus bas suit, la surimpression s'ouvre. */
function rrSaisie(v){
  const val=String(v==null?'':v);
  const bas=document.getElementById('ch-search');
  if(bas&&bas.value!==val) bas.value=val;
  try{ renderClientList(); }catch(e){}
  const z=document.getElementById('ch-rech-res');
  if(!z) return [];
  if(!norm(val)){ _rrResultats=[]; _rrFermer(); return []; }
  let tous=[]; try{ tous=getClients(); }catch(e){ tous=[]; }
  const par={}; for(const c of tous) if(c) par[String(c.id)]=c;
  _rrResultats=rechercheAthletes(tous,val,currentUser).slice(0,RR_MAX).map(id=>par[id]).filter(Boolean);
  z.innerHTML=_rrResultats.length?_rrResultats.map(_rrHtml).join('')
    :'<li class="rr-aucun">Aucun athlète trouvé. <button type="button" class="rr-a" onclick="rrChercherCodes()">Rechercher dans les codes en attente</button></li>';
  z.hidden=false;
  const c=_rrChamp(); if(c) c.setAttribute('aria-expanded','true');
  return _rrResultats.map(c=>String(c.id));
}
/** Entree ouvre la fiche du premier, Echap ferme. */
function rrTouche(ev){
  if(!ev) return;
  if(ev.key==='Escape'){ _rrFermer(); try{ ev.target.blur(); }catch(e){} return; }
  if(ev.key==='Enter'){
    ev.preventDefault();
    const p=_rrResultats[0];
    if(p){ _rrFermer(); openClientDetail(String(p.id),false,true); }
  }
}
/** #ch-search, plus bas, renvoie sa valeur au champ du haut. */
function rrSynchroBas(v){
  const c=_rrChamp();
  if(c&&c.value!==v) c.value=v;
}
// OU VIT LA BARRE. Un seul element, deplace plutot que recopie : la saisie
// survit au changement d'ecran. Sur l'accueil, sous l'en-tete, et seulement
// sur l'onglet Athletes ; ailleurs, dans un ecran coach qui a un retour vers
// l'accueil, sous l'element qui porte ce retour.
function rrPlacer(){
  const bar=document.getElementById('ch-rech-barre');
  if(!bar) return false;
  const act=document.querySelector('.screen.active');
  if(!act||!act.classList.contains('ecran-coach')){ bar.hidden=true; return false; }
  if(act.id==='s-coach-home'){
    const h=document.getElementById('ch-mobile-header');
    if(h&&bar.previousElementSibling!==h) h.after(bar);
    const d=document.getElementById('ct-dashboard');
    bar.hidden=!!(d&&getComputedStyle(d).display==='none');
    return !bar.hidden;
  }
  const r=act.querySelector('[onclick*="s-coach-home"]');
  if(!r){ bar.hidden=true; return false; }
  let tete=r; while(tete.parentElement&&tete.parentElement!==act) tete=tete.parentElement;
  if(tete.parentElement===act){ if(bar.previousElementSibling!==tete) tete.after(bar); }
  else act.prepend(bar);
  bar.hidden=false;
  _rrFermer();
  return true;
}
// LES VIGNETTES SE REPLIENT au-dela de douze athletes. L'etat est memorise :
// un coach qui les veut ouvertes les retrouve ouvertes.
const VIG_REPLI_SEUIL=12, VIG_CLE='rc_vignettes_ouvertes';
function vignettesOuvertes(){ try{ return localStorage.getItem(VIG_CLE)==='1'; }catch(e){ return false; } }
function vignettesBasculer(oui){
  try{ if(oui) localStorage.setItem(VIG_CLE,'1'); else localStorage.removeItem(VIG_CLE); }catch(e){}
  try{ renderClientList(); }catch(e){}
  return true;
}
