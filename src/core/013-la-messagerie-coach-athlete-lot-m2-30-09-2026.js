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
async function msgChargerPage(k,avant){
  if(!k) return {ok:false,st:0,liste:[]};
  let tok=null; try{ tok=await CLOUD._getToken(); }catch(e){ tok=null; }
  if(!tok) return {ok:false,st:0,liste:[]};
  let url=CLOUD._fbUrl.replace('users.json','messages/'+k.coach+'/'+k.athlete+'.json')+'?auth='+tok+'&orderBy=%22%24key%22';
  url+=avant?'&endAt='+encodeURIComponent(JSON.stringify(avant))+'&limitToLast='+(MSG_PAGE+1):'&limitToLast='+MSG_PAGE;
  try{
    const r=await fetch(url);
    if(!r.ok) return {ok:false,st:r.status,liste:[]};
    let l=msgListe(await r.json());
    if(avant) l=l.filter(m=>m.id!==avant);
    return {ok:true,st:200,liste:l,complet:l.length<MSG_PAGE};
  }catch(e){ return {ok:false,st:0,liste:[]}; }
}
// Les fils du coach : un résumé par athlète (une page chacun), gardé 10 min.
let _msgFils=null;            // {t, fils:[{cle, id, nom, dernier, nonLus}]}
async function msgChargerFils(force){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role!=='coach') return null;
  if(!force&&_msgFils&&Date.now()-_msgFils.t<MSG_CACHE_MS) return _msgFils;
  if(!_msgEnLigne()) return _msgFils;
  let clients=[]; try{ clients=getClients().filter(c=>c&&c.email&&!c._fromCode); }catch(e){ clients=[]; }
  const fils=[];
  for(const c of clients){
    const k=_msgCles(u,_relCle(c));
    const p=await msgChargerPage(k);
    if(!p.ok) continue;
    const r=msgResume(p.liste,'coach');
    const ini=(c.lname||'').charAt(0);
    fils.push({cle:k.athlete,id:c.id,nom:((c.fname||'')+(ini?' '+ini+'.':'')).trim()||'Athlète',dernier:r.dernier,nonLus:r.nonLus});
  }
  _msgFils={t:Date.now(),fils};
  return _msgFils;
}
// La ligne « Message sans réponse » du tableau de bord : lue dans le cache.
function msgClientsSansReponse(clients,maintenant){
  if(!_msgFils) return [];
  const s=new Set(_msgFils.fils.filter(f=>msgSansReponse(f,maintenant)).map(f=>f.cle));
  return (clients||[]).filter(c=>c&&s.has(_relCle(c)));
}

// ── L'envoi ──────────────────────────────────────────────────────────────
async function msgEnvoyer(athleteCle,brut){
  const u=currentUser;
  const v=msgTexteValide(brut);
  if(!v.ok){ toast(v.raison,'var(--orange)'); return {ok:false,raison:v.raison}; }
  if(!_msgEnLigne()){ toast('Pas de réseau : ton message n’est pas parti. Réessaie une fois connecté.','var(--orange)'); return {ok:false,raison:'hors_ligne'}; }
  // Un modèle dont une variable n'est pas résolue ne part jamais tel quel.
  if(u.role==='coach'&&/\{[^}\s]{2,20}\}/.test(v.texte)){ toast('Une variable du modèle n’est pas complétée','var(--orange)'); return {ok:false,raison:'variable'}; }
  const k=_msgCles(u,athleteCle);
  if(!k){ toast('Ce fil n’est plus accessible','var(--orange)'); return {ok:false,raison:'acces'}; }
  const de=u.role==='coach'?'coach':'athlete';
  const id=msgId();
  const m={de,texte:v.texte,at:Date.now(),lu:false};
  const r=await _fbJson('messages/'+k.coach+'/'+k.athlete+'/'+id,'PUT',m);
  if(!r||!r.ok){
    toast(r&&(r.st===401||r.st===403)?'Ce fil n’est plus accessible (rattachement au coach terminé ?)':'Envoi impossible, réessaie','var(--orange)');
    return {ok:false,raison:'refus'};
  }
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
  if(r&&r.ok){ aLire.forEach(m=>{ m.lu=true; }); return aLire.length; }
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
  if(!_msgFils){ z.innerHTML='<div class="msg-vide">Chargement des fils…</div>'; return; }
  const l=msgFilsTries(_msgFils.fils);
  if(!l.length){ z.innerHTML='<div class="msg-vide">Aucun athlète rattaché pour l’instant.</div>'; return; }
  const t=Date.now();
  z.innerHTML=l.map(f=>{
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
  if(f.charge) corps='<div class="msg-vide">Chargement…</div>';
  else if(f.erreur==='acces') corps='<div class="msg-vide">Ce fil n’est plus accessible.'+(moi==='athlete'?' Tu n’es plus rattaché à ce coach.':' Cet athlète n’est plus rattaché à toi.')+'</div>';
  else if(f.erreur) corps='<div class="msg-vide">'+(f.erreur==='hors_ligne'?'Pas de réseau : les messages s’afficheront une fois connecté.':'Les messages n’ont pas pu être chargés.')+'</div>';
  else if(!f.liste.length) corps='<div class="msg-vide">Aucun message pour l’instant. '+(moi==='coach'?'Écris le premier.':'Écris à ton coach, il reçoit une notification.')+'</div>';
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
  if(!_msgFils) msgChargerFils().then(()=>{ try{ renderEntreeMessages(); renderTodoBlock(getClients()); }catch(e){} }).catch(()=>{});
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
  // CE QUI EST PARTI CETTE SEMAINE : lisible en dix secondes.
  h+='<h2 class="rel-h">Cette semaine</h2>';
  if(!sem) h+='<div class="sub rel-vide">Lecture du journal…</div>';
  else if(!sem.length) h+='<div class="sub rel-vide">Rien n’est parti ces sept derniers jours.</div>';
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
    .filter(e=>e&&e.statut==='parti'&&e.moyen==='canal'&&n-Number(e.at)<RELANCE_FENETRE_J*864e5&&Number(e.at)>(Number(vueJusqua)||0))
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

const LUNDI_RANGS=Object.freeze(['drapeau','douleur','fatigue','regression','plateau','absence','rien']);
const LUNDI_CIBLE=Object.freeze({drapeau:'ccd-securite',douleur:'ccd-douleur',fatigue:'ccd-volume',
  regression:'ccd-plateaux',plateau:'ccd-plateaux',absence:'ccd-sessions-recap',rien:null});
const LUNDI_PAQUET=4;

// PURE. La ligne d'un athlète, depuis ce qui est DÉJÀ calculé.
//   sg : signauxEntrainement(c) ; o : {drapeau, proposition, maintenant}
function lundiLigne(c,sg,o){
  const x=o||{}, s=sg||{}, d=s.details||{};
  const prenom=String((c&&c.fname)||'').trim()||String((c&&c.email)||'Athlète').split('@')[0];
  const base={id:c&&c.id,prenom};
  const le=v=>(Number(v)>0?Number(v):null);
  if(x.drapeau) return Object.assign(base,{cat:'drapeau',signal:'Drapeau rouge santé',depuis:le(x.drapeau.date)});
  if(s.douleur){
    const dates=((d.douleur&&d.douleur.dates)||[]).map(Number).filter(n=>n>0);
    return Object.assign(base,{cat:'douleur',signal:'Douleur répétée',depuis:dates.length?Math.min(...dates):null});
  }
  if(s.douleurDiffuse) return Object.assign(base,{cat:'douleur',signal:'Douleurs diffuses',depuis:null});
  if(x.proposition) return Object.assign(base,{cat:'fatigue',signal:'Décharge proposée',depuis:le(x.proposition.creeLe)});
  if(s.plateauMuscle){
    const p=d.plateauMuscle||{};
    const t=Number(x.maintenant)||Date.now();
    const depuis=Number(p.joursRecord)>0?t-Number(p.joursRecord)*864e5:null;
    return Object.assign(base,p.regression?{cat:'regression',signal:'Charges en baisse',depuis}:{cat:'plateau',signal:'Progression bloquée',depuis});
  }
  if(s.decrochage) return Object.assign(base,{cat:'absence',signal:'Séances écourtées',depuis:null});
  if(s.chuteAssiduite) return Object.assign(base,{cat:'absence',signal:'Assiduité en baisse',depuis:null});
  return Object.assign(base,{cat:'rien',signal:'Rien à signaler',depuis:null});
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
function _lundiLire(c){
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){ sg=null; }
  let dr=null; try{ dr=drapeauQuelconqueActif(c)||null; }catch(e){ dr=null; }
  let pr=null; try{ pr=propositionDechargeOuverte(c); }catch(e){ pr=null; }
  return lundiLigne(c,sg,{drapeau:dr,proposition:pr});
}
function _htmlLundiLigne(l){
  const E=escapeHtml, id=E(String(l.id||''));
  return '<button type="button" class="ld-l ld-'+l.cat+'" onclick="lundiOuvrir(\''+id+'\',\''+l.cat+'\')">'
    +'<b>'+E(l.prenom)+'</b><span class="ld-s">'+E(l.signal)+'</span>'
    +'<span class="ld-d">'+(l.cat==='rien'?'':E(lundiDepuis(l.depuis)))+'</span></button>';
}
let _lundiJeton=0;
function renderLundi(){
  const z=document.getElementById('ld-corps');
  if(!z) return false;
  let clients=[]; try{ clients=getClients().filter(c=>c&&!c._fromCode); }catch(e){ clients=[]; }
  if(!clients.length){ z.innerHTML='<div class="ld-vide">Aucun athlète suivi pour l’instant. Ils apparaissent ici dès qu’un athlète a rejoint ton équipe avec ton code.</div>'; return true; }
  const jeton=++_lundiJeton, lignes=[];
  const peindre=fini=>{
    if(jeton!==_lundiJeton) return;
    const l=lundiTrier(lignes);
    z.innerHTML=l.map(_htmlLundiLigne).join('')
      +(fini?'':'<div class="ld-attente">'+(clients.length-lignes.length)+' à lire…</div>');
  };
  let i=0;
  const paquet=()=>{
    if(jeton!==_lundiJeton) return;
    for(let k=0;k<LUNDI_PAQUET&&i<clients.length;k++,i++) lignes.push(_lundiLire(clients[i]));
    peindre(i>=clients.length);
    if(i<clients.length) setTimeout(paquet,0);
  };
  paquet();
  return true;
}
function ouvrirLundi(){ go('s-coach-lundi'); renderLundi(); }
// Le clic : la fiche, puis l'onglet qui porte le bloc du signal, et le bloc.
function lundiOuvrir(id,cat){
  if(!id) return false;
  try{ openClientDetail(id,false,true); }catch(e){ return false; }
  const cible=LUNDI_CIBLE[cat];
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
// ⚠ TROIS LIGNES NE COMPTENT JAMAIS DANS LE PLAFOND : le drapeau rouge, le
//   nouveau bilan à lire, le bilan en retard. Le plafond ne s'applique qu'aux
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
const TODO_TOUJOURS_VISIBLES=Object.freeze(['drapeau','bilan','overdue']);
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
  let p=null; try{ p=programmeDe(c); }catch(e){ p=null; }
  if(!p) return null;
  const fin=new Date(p.debut); fin.setHours(0,0,0,0);
  fin.setDate(fin.getDate()+p.semaines*7-1);      // le dimanche de la dernière semaine (setDate : heure d'été)
  const j=new Date(typeof maintenant==='number'?maintenant:Date.now()); j.setHours(0,0,0,0);
  const restants=Math.round((fin.getTime()-j.getTime())/864e5);
  if(!isFinite(restants)||restants>PROGFIN_AVANT_J||restants<-PROGFIN_APRES_J) return null;
  return {joursRestants:restants,fini:restants<0,finPrevue:fin.getTime()};
}
// PURE. Les lignes « À traiter » : une pour les blocs qui se terminent, une
// pour les blocs terminés (deux libellés, un seul type).
function lignesFinProgramme(clients,maintenant,reporte){
  const bientot=[], finis=[];
  for(const c of (clients||[])){
    const f=finProgramme(c,maintenant);
    if(!f||(reporte&&reporte(c))) continue;
    (f.fini?finis:bientot).push(c);
  }
  const ligne=(l,lib)=>({type:'progfin',icon:icon('flag',16),color:'var(--green)',label:lib,list:l});
  const out=[];
  if(bientot.length) out.push(ligne(bientot,'Bloc qui se termine'));
  if(finis.length) out.push(ligne(finis,'Bloc terminé'));
  return out;
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
  z.innerHTML=t.filter(e=>l.indexOf(e.id)>=0).map(e=>_etiqPuce(e,'<button type="button" class="etq-x" aria-label="Retirer '+escapeHtml(e.lib)+'" onclick="etiquetterAthletes(['+_attrArg(c.id)+'],'+_attrArg(e.id)+',false);_etiqApres()">✕</button>')).join('')
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
  // Puis les signaux d'entrainement : la sante avant l'intendance.
  // Au-delà de trois athlètes pour un même signal : une ligne, et une file.
  rows.push.apply(rows,grouperLignesEntrainement(_lignesEntrainement(clients)));
  // En tête des lignes administratives : relancer un inscrit qui n'a jamais démarré prime sur tout le reste.
  const _accProg=_acc.prog.filter(c=>!isAlertSnoozed('accueil_prog',c.id)), _accRet=_acc.retour.filter(c=>!isAlertSnoozed('accueil_retour',c.id));
  if(_accProg.length) rows.push({type:'accueil_prog',icon:icon('clipboard',16),color:'var(--orange)',label:'Programme à écrire',list:_accProg});
  if(_accRet.length) rows.push({type:'accueil_retour',icon:icon('message-circle',16),color:'var(--orange)',label:'Premier point de l’accueil',list:_accRet});
  if(noStart.length) rows.push({type:'nostart',icon:icon('user-plus',16),color:'var(--red)',label:'Inscrit, n\'a jamais commencé',list:noStart});
  if(newBil.length) rows.push({type:'bilan',icon:icon('download',16),color:'var(--orange)',label:'Nouveau'+(newBil.length>1?'x bilans à lire':' bilan à lire'),list:newBil});
  // LOT M2 : le dernier message d'un fil vient de l'athlète depuis 24 h ou plus.
  // S'éteint quand le coach RÉPOND (lu dans le cache des fils), pas quand il ouvre.
  const _msgs=msgClientsSansReponse(clients,now).filter(c=>!isAlertSnoozed('message',c.id));
  if(_msgs.length) rows.push({type:'message',icon:icon('message-circle',16),color:'var(--orange)',label:'Message'+(_msgs.length>1?'s':'')+' sans réponse',list:_msgs});
  if(overdue.length) rows.push({type:'overdue',icon:icon('alert-triangle',16),color:'var(--red)',label:'Bilan'+(overdue.length>1?'s':'')+' en retard',list:overdue});
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
  // Le drapeau, le nouveau bilan et le bilan en retard ne comptent jamais
  // dans le plafond ; les autres lignes s'y rangent, dans leur ordre.
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
      return{html:`<span style="flex-shrink:0;align-self:flex-start;margin-top:2px;display:inline-flex;color:#fff;filter:drop-shadow(0 0 4px rgba(255,255,255,.7)) drop-shadow(0 0 11px rgba(255,255,255,.3))">${r.icon}</span>${corps}${_ajBouton(r,idx)}${_waBoutonTodo(r,idx)}${r.nonReportable?'':`<button onclick="event.stopPropagation();dismissTodoRow(${idx})" title="Snoozer 7 jours" style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;padding:4px 8px;flex-shrink:0;transition:color var(--t-1);border-radius:var(--r-1)" onmouseover="this.style.color='var(--sub)'" onmouseout="this.style.color='#444'">✕</button>`}`,
      // LA LIGNE DES BILANS POSE LA FILE au passage. Les autres lignes ouvrent
      // la fiche comme avant : elles ne décrivent pas une série à traiter.
      onClick:r.type==='bilan'?`_entrerFileBilans(${idx})`
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
function etatAthlete(c){
  return _enAttenteAbonnement(c)?'attente'
    :_accesExpire(c)?'lecture'
    :hasNewBilan(c)?'bilan'
    :needsAlert(c)?'alerte'
    :isActive(c)?'actif':'dormant';
}
// La couleur du filet, par etat. Meme table pour les trois ecrans.
const ETAT_FILET=Object.freeze({alerte:ROUGE_MARQUE,bilan:'#f97316',attente:'#f97316',
  actif:'#22c55e',lecture:'#8a8a8a',dormant:'#666666'});
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
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selEtiqueter()">Étiqueter</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selVersDecharge()">Décharge</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selVersProgramme()">Programme</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="selCadence()">Cadence</button>'
    +'<button type="button" onclick="selAthleteVider()" title="Tout décocher" style="background:none;border:none;color:var(--sub);font-family:inherit;font-size:var(--fs-xs);cursor:pointer;padding:4px 6px;min-height:30px">✕</button>'
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
  const badge=_enAttenteAbonnement(c)?_bdg('badge-orange','Abonnement à souscrire')
    :_accesExpire(c)?_bdg('badge-gray','Lecture seule')
    :hasNewBilan(c)?_bdg('badge-orange','Nouveau bilan'):needsAlert(c)?_bdg('badge-red','Alerte'):isActive(c)?_bdg('badge-green','Actif'):_bdg('badge-gray','Inactif');
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
  const _etat=etatAthlete(c);
  // N4.13 — LA CASE RELIT LE Set A CHAQUE RENDU : c'est ce qui la fait
  // survivre a la reecriture du conteneur toutes les trente secondes.
  const _coche=SEL_ATHLETES.has(c.id)?' checked':'';
  return `<div class="client-row${!hasNewBilan(c)&&!needsAlert(c)&&!isActive(c)?' row-inactive':''}" data-etat="${_etat}" data-cid="${c.id}" onclick="openClientDetail('${c.id}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <input type="checkbox" class="cr-coche"${_coche} value="${c.id}"
      onclick="selAthleteBascule('${c.id}',event)"
      aria-label="Sélectionner ${escapeHtml(((c.fname||'')+' '+(c.lname||'')).trim()||'cet athlète')}">
    <div class="avatar" style="width:44px;height:44px;font-size:var(--fs-lg);overflow:hidden;flex-shrink:0">${avatarHtml}</div>
    <div style="flex:1;min-width:0"><div class="cr-nom" title="${_nm}">${_nm}</div>${objLine}${asLine}${diLine}${chLine}${biLine}</div>
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
      style="margin:0;flex-shrink:0;letter-spacing:1px;padding:8px 12px;min-height:36px;font-size:var(--fs-2xs);white-space:nowrap"><span class="cr-fiche-l">Ouvrir la fiche</span><span class="cr-fiche-c">Voir profil</span></button>
    ${_htmlCurseurSuivi(c)}
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">${badge}</div>
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
