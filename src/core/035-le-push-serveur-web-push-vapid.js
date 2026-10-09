// ══════════ LE PUSH SERVEUR (Web Push, VAPID) ══════════════════════════════
//
// Jusqu'ici, tous les rappels étaient LOCAUX : le service worker se réveillait
// quand le navigateur le voulait bien (periodicsync, Chrome seulement), et
// iOS n'en recevait aucun. Le push serveur part de functions/index.js
// (envoyerPush) à l'heure dite, sur tous les navigateurs qui le prennent en
// charge — y compris Safari iOS 16.4+, À CONDITION que l'app soit installée.
//
// ⚠ LA CLÉ PUBLIQUE EST ICI, LA PRIVÉE N'EST NULLE PART DANS LE DÉPÔT : elle
// vit dans les secrets Firebase Functions (VAPID_PRIVATE_KEY, defineSecret).
// Les deux vont par paire : changer l'une sans l'autre et chaque envoi est
// refusé (403). La même valeur figure dans functions/index.js (VAPID_PUBLIQUE).
//
// ⚠ LES SOUSCRIPTIONS VONT DANS /push/<emailKey>/<id>, PAS DANS /users : le
// dossier est envoyé EN ENTIER par PUT (CLOUD._doPushOne) ; un enfant écrit à
// part serait effacé au premier enregistrement suivant.
// Paire du serveur léger (27/09/2026) : la privée est dans les secrets du
// Worker (VAPID_PRIVATE_KEY), jamais dans le dépôt.
const VAPID_PUBLIQUE='BLOS0J9PpSZcViPM4ySSKDd0Ss-rnuo8yhmdqpvyhAE6s_HQvSM7QK5nIs329I-4tbix3-8S_3Kl3L3Z0pnf3-4';
// Les sept types, dans l'ordre de l'écran de réglages. Mêmes clés que
// PUSH_TYPES (functions/index.js) : c'est u.pushPrefs[cle]===false qui coupe.
const PUSH_TYPES=Object.freeze([
  {cle:'coach',titre:'Réponse de ton coach',txt:'Quand ton coach répond à un bilan ou à un rite.'},
  {cle:'serie',titre:'Série en danger',txt:'Le jeudi en fin de journée (entre 17 h et 21 h), si ta semaine n’est pas encore validée.'},
  {cle:'bilan',titre:'Rappel de bilan',txt:'Le samedi, quand ton dernier bilan date de deux semaines.'},
  {cle:'badge',titre:'Badge à portée',txt:'Le dimanche, quand un badge n’est plus qu’à une ou deux séances.'},
  {cle:'wrapped',titre:'Ton mois en chiffres',txt:'Le 1er du mois, quand ton Wrapped est prêt.'},
  {cle:'defi',titre:'Défi dans les annonces',txt:'Quand ton coach lance un nouveau défi.'},
  {cle:'filleul',titre:'Filleul inscrit',txt:'Quand quelqu’un s’inscrit grâce à toi.'},
  {cle:'acces',titre:'Fin de ton accès',txt:'Trois jours avant la fin de ton accès ou de ton abonnement.'},
  {cle:'retour',titre:'Après une pause',txt:'À 7, 14 et 30 jours sans séance : trois messages au plus, puis silence.'},
  {cle:'relance',titre:'Rappel de ton coach',txt:'Un bilan en retard, un programme en préparation, un accès qui se termine : un message par semaine au plus, seulement si ton coach les a allumés.'},
  {cle:'sante',titre:'Données santé non reçues',txt:'Le matin, si la nuit n’est pas arrivée (iPhone). Deux rappels au plus, puis silence jusqu’à la prochaine réception.'}
]);
// PURE. La clé base64url en octets — ce qu'attend applicationServerKey.
function pushB64VersOctets(b64){
  const s=String(b64||'').replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(s+'='.repeat((4-s.length%4)%4));
  const o=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) o[i]=bin.charCodeAt(i);
  return o;
}
// PURE. L'empreinte courte de la clé publique (≤ 12 caractères, règle
// /push/$id/vapid). Elle dit, au démarrage, qu'une souscription a été prise
// avec une AUTRE clé — et qu'il faut la refaire.
function pushEmpreinte(cle){ return String(cle||'').slice(0,12); }
// PURE. L'identifiant d'une souscription : un hachage de son endpoint, stable
// (le même appareil réécrit le même nœud au lieu d'en empiler), et conforme à
// la règle /^[a-z0-9]{6,24}$/.
function pushIdSouscription(endpoint){
  const e=String(endpoint||'');
  let a=0x811c9dc5, b=0x01000193^e.length;
  for(let i=0;i<e.length;i++){
    const c=e.charCodeAt(i);
    a=Math.imul(a^c,0x01000193)>>>0;
    b=Math.imul(b^c,0x5bd1e995)>>>0;
  }
  return ('p'+a.toString(36)+b.toString(36)).slice(0,24);
}
// PURE. Où en est l'appareil ? env = {supporte, ios, autonome, permission,
// abonne}. Rend :
//   'installer' — iOS dans Safari : le push n'y existe qu'une fois l'app
//                 ajoutée à l'écran d'accueil. On ne propose RIEN d'autre.
//   'indispo'   — navigateur sans Push API.
//   'refuse'    — permission refusée : seul le navigateur peut la rendre.
//   'actif'     — abonné, permission accordée.
//   'proposer'  — tout est possible, il manque le geste.
function pushEtat(env){
  const x=env||{};
  if(x.ios&&!x.autonome) return 'installer';
  if(!x.supporte) return 'indispo';
  if(x.permission==='denied') return 'refuse';
  if(x.abonne&&x.permission==='granted') return 'actif';
  return 'proposer';
}
// PURE. Peut-on tenter l'abonnement ? Sur iOS : app installée ET geste.
function pushPeutAbonner(env,geste){
  const x=env||{};
  if(x.ios&&(!x.autonome||!geste)) return false;
  return !!x.supporte;
}
// PURE. Un type est-il actif ? Tout est allumé par défaut ; seul false coupe.
function pushTypeActif(u,type){
  const p=u&&u.pushPrefs;
  return !(p&&typeof p==='object'&&p[type]===false);
}
function _pushSupporte(){
  return typeof window!=='undefined'&&'serviceWorker' in navigator
    &&'PushManager' in window&&_notifSupported();
}
function _pushEnv(abonne){
  let ios=false, autonome=false;
  try{ ios=rcInstalliOS(); }catch(e){}
  try{ autonome=rcInstallAutonome(); }catch(e){}
  return {supporte:_pushSupporte(),ios,autonome,
    permission:_notifSupported()?Notification.permission:null,abonne:!!abonne};
}
function _pushMemo(v){
  try{
    if(v===undefined){ return JSON.parse(localStorage.getItem('rc_push')||'null'); }
    if(v===null) localStorage.removeItem('rc_push'); else localStorage.setItem('rc_push',JSON.stringify(v));
  }catch(e){}
  return null;
}
// La souscription, et son enregistrement dans /push. o.geste : l'appel vient
// d'un toucher (bouton). ⚠ SUR iOS, RIEN SANS GESTE ET RIEN HORS DE L'APP
// INSTALLÉE : Safari refuse requestPermission hors d'un geste, et le push
// n'existe pas dans l'onglet. Ailleurs, une permission déjà accordée suffit.
async function pushAbonner(o){
  o=o||{};
  if(!currentUser||!currentUser.email) return false;
  const env=_pushEnv(false);
  if(!pushPeutAbonner(env,!!o.geste)||!_notifSupported()) return false;
  try{
    // La permission est DÉJÀ accordée : c'est l'appelant qui la demande
    // (invitation, rappels, ou le bouton des réglages), et qui compte l'accord.
    if(Notification.permission!=='granted') return false;
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    const memo=_pushMemo();
    // Une souscription prise avec une autre clé ne recevra plus rien : on la
    // défait avant d'en reprendre une.
    if(sub&&memo&&memo.vapid&&memo.vapid!==pushEmpreinte(VAPID_PUBLIQUE)){
      try{ await sub.unsubscribe(); }catch(e){}
      sub=null;
    }
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,
      applicationServerKey:pushB64VersOctets(VAPID_PUBLIQUE)});
    const j=sub.toJSON();
    const id=pushIdSouscription(j.endpoint);
    const ok=await CLOUD.enregistrerPush(currentUser.email,id,{
      endpoint:j.endpoint,keys:{p256dh:j.keys.p256dh,auth:j.keys.auth},
      cree:Date.now(),plateforme:env.ios?'ios':(/android/i.test(navigator.userAgent||'')?'android':'web'),
      vapid:pushEmpreinte(VAPID_PUBLIQUE)});
    if(ok){ _pushMemo({id,email:currentUser.email,vapid:pushEmpreinte(VAPID_PUBLIQUE),le:Date.now()}); _swPushServeur(true); }
    return ok;
  }catch(e){ return false; }
}
// Au démarrage : SANS geste, donc sans jamais demander. Ailleurs qu'iOS, une
// permission déjà accordée (par l'invitation, ou les rappels) donne une
// souscription ; sur iOS, on ne fait que rafraîchir celle qui existe. Une
// fois par jour au plus : l'enregistrement se réécrit s'il a été effacé par
// le serveur (404/410).
async function pushVerifierAuDemarrage(){
  // Retirées dans les réglages : on ne réabonne pas cet appareil.
  if(currentUser&&currentUser.pushRefus) return false;
  if(!currentUser||!_notifSupported()||!_pushSupporte()||Notification.permission!=='granted') return false;
  const memo=_pushMemo();
  if(memo&&memo.email===currentUser.email&&memo.vapid===pushEmpreinte(VAPID_PUBLIQUE)
    &&Date.now()-(Number(memo.le)||0)<86400000) return true;
  const env=_pushEnv(false);
  if(env.ios){
    if(!env.autonome) return false;
    try{
      const reg=await navigator.serviceWorker.ready;
      if(!(await reg.pushManager.getSubscription())) return false;
    }catch(e){ return false; }
  }
  return pushAbonner({geste:env.ios});
}
async function pushDesabonner(){
  const memo=_pushMemo();
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(sub) await sub.unsubscribe();
  }catch(e){}
  if(memo&&memo.id&&currentUser) try{ await CLOUD.supprimerPush(currentUser.email,memo.id); }catch(e){}
  _pushMemo(null);
  _swPushServeur(false);
  return true;
}
// LE PLAFOND COMMUN : le service worker lit '/push-serveur' pour savoir si le
// serveur porte déjà série, bilan et Wrapped sur cet appareil (sw.js,
// swPushServeurActif) — sinon ses rappels locaux doublaient ceux du serveur.
function _swPushServeur(actif){
  try{
    if(typeof caches==='undefined') return false;
    caches.open('repcore-sw-data').then(c=>actif
      ?c.put('/push-serveur',new Response(JSON.stringify({actif:true,le:Date.now()}),{headers:{'Content-Type':'application/json'}}))
      :c.delete('/push-serveur')).catch(()=>{});
    return true;
  }catch(e){ return false; }
}
// ── L'ÉCRAN DE RÉGLAGES : une case par type, et l'état de l'appareil ──────
// PURE. Le bloc. etat : pushEtat(...).
function htmlReglagesPush(u,etat){
  const ligneEtat={
    actif:'Activées sur cet appareil',
    proposer:'Pas encore activées sur cet appareil',
    refuse:'Bloquées dans les réglages du navigateur',
    indispo:'Ce navigateur ne reçoit pas les notifications',
    installer:'Ajoute RepCore à ton écran d’accueil pour les recevoir'
  }[etat]||'';
  let aide='';
  if(etat==='installer') aide='Sur iPhone, les notifications n’existent que dans l’app installée : Partager, puis « Sur l’écran d’accueil ». Ouvre ensuite RepCore depuis l’icône et reviens ici.';
  else if(etat==='refuse') aide='Pour les réactiver : réglages du navigateur, puis Notifications, puis RepCore.';
  const bouton=etat==='proposer'
    ?'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:0 0 12px;min-height:44px" onclick="pushActiverDepuisReglages()">Activer sur cet appareil</button>'
    :etat==='actif'
    ?'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:0 0 12px;min-height:44px" onclick="pushDesactiverDepuisReglages()">Désactiver sur cet appareil</button>':'';
  const cases=PUSH_TYPES.map(t=>{
    const on=pushTypeActif(u,t.cle);
    return '<label for="cr-push-'+t.cle+'" style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;margin:0;padding:10px 0;border-top:1px solid var(--border);text-transform:none;letter-spacing:normal;font-weight:400;color:var(--text)">'
      +'<input type="checkbox" id="cr-push-'+t.cle+'" data-push="'+t.cle+'"'+(on?' checked':'')
      +' onchange="basculerPushType(\''+t.cle+'\',this.checked)"'
      +' style="width:18px;height:18px;accent-color:var(--red);flex-shrink:0;margin-top:2px;cursor:pointer">'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-weight:700;font-size:var(--fs-sm)">'+escapeHtml(t.titre)+'</span>'
      +'<span style="display:block;font-size:var(--fs-xs);color:var(--sub);line-height:1.5">'+escapeHtml(t.txt)+'</span></span></label>';
  }).join('');
  return '<div class="card" style="margin-bottom:20px">'
    +'<div style="font-weight:800;font-size:var(--fs-md);margin-bottom:4px">Notifications</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:6px">Une au plus par jour, et jamais entre 21 h et 8 h.</div>'
    +'<div id="cr-push-etat" style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:1px;text-transform:uppercase;font-weight:800;margin-bottom:10px">'+escapeHtml(ligneEtat)+'</div>'
    +(aide?'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">'+escapeHtml(aide)+'</div>':'')
    +bouton+cases
    // LE RAPPEL DE SÉANCE, descendu de l'accueil (28/09/2026).
    +((u&&u.role!=='coach'&&(etat==='actif'||etat==='proposer'))?'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:12px 0 0;min-height:44px" onclick="openWoReminderConfig()">'
      +(u._woReminderEnabled?'Modifier mon rappel séance':'Configurer un rappel séance')+'</button>':'')
    +'</div>';
}
async function _rendreReglagesPush(){
  const z=document.getElementById('cr-push');
  if(!z||!currentUser) return false;
  let abonne=false;
  try{
    if(_pushSupporte()){
      const reg=await navigator.serviceWorker.ready;
      abonne=!!(await reg.pushManager.getSubscription());
    }
  }catch(e){}
  z.innerHTML=htmlReglagesPush(currentUser,pushEtat(_pushEnv(abonne)));
  return true;
}
// LE GESTE. C'est lui qui rend l'abonnement possible sur iOS.
// QUATRIÈME POINT D'ACCORD — voir les trois autres (invitation, rappels de
// bilan et de séance). Sur iOS, c'est souvent le seul : l'invitation a pu
// paraître dans l'onglet Safari, avant l'installation.
async function pushActiverDepuisReglages(){
  if(_notifSupported()&&Notification.permission==='default'){
    let p='default';
    try{ p=await Notification.requestPermission(); }catch(e){}
    if(p==='granted'){ try{ rcm('notif_granted'); }catch(e){} }
  }
  const ok=await pushAbonner({geste:true});
  if(ok){
    try{ currentUser._notifEnabled=true; delete currentUser.pushRefus; saveUser(); }catch(e){ rcErreurMuette('pushActiverDepuisReglages',e); }
    toast('Notifications activées '+ICO.coche);
  } else if(_notifSupported()&&Notification.permission==='denied'){
    toast('Notifications bloquées par le navigateur.','var(--orange)');
  } else toast('Impossible d’activer les notifications ici.','var(--orange)');
  _rendreReglagesPush();
  return ok;
}
// ══ LES NOTIFICATIONS, ACTIVÉES PAR DÉFAUT, SANS ÉCRAN (27/09/2026) ══════
//
// DEMANDE DE KEVIN : « les notifs se mettent direct », AUCUN écran pour les
// proposer, et pour les retirer on va dans les réglages. Tous les types sont
// allumés d'office (pushPrefs vide).
//
// ⚠ CE QUE LE NAVIGATEUR IMPOSE : une notification n'arrive que si le
// téléphone l'a autorisée, et l'autorisation ne peut être demandée que sur un
// geste (Safari, Firefox) — c'est toujours le téléphone qui pose la question,
// par sa propre fenêtre. On ne montre donc rien : au PREMIER TOUCHER dans
// l'app, n'importe où, la question du téléphone part d'elle-même. Accordée,
// l'appareil est abonné sans autre étape. Refusée (« Bloquer »), on n'insiste
// jamais : seuls les réglages du navigateur peuvent la rendre. Ignorée, elle
// repart au premier toucher de l'ouverture suivante.
//
// LE RETRAIT est dans les réglages : « Désactiver sur cet appareil »
// (u.pushRefus, retenu dans le dossier : plus aucune demande, plus de
// réabonnement) ou une case par type. « Activer sur cet appareil » les remet.
// Sur iPhone dans Safari (app non installée), le push n'existe pas : rien.
// PURE. Faut-il demander ? etat : pushEtat(...).
function pushDemandeAuto(u,etat){
  if(!u||!u.email||u.role==='coach'||u.pushRefus) return false;
  return etat==='proposer';
}
let _pushGesteArme=false;
async function _pushAuPremierGeste(){
  _pushGesteArme=false;
  if(!currentUser||currentUser.pushRefus||!_notifSupported()) return false;
  let p=Notification.permission;
  if(p==='default'){
    try{ p=await Notification.requestPermission(); }catch(e){}
    if(p==='granted'){ try{ rcm('notif_granted'); }catch(e){} }
  }
  if(p!=='granted') return false;
  const ok=await pushAbonner({geste:true});
  if(ok) try{ currentUser._notifEnabled=true; saveUser(); }catch(e){ rcErreurMuette('_pushAuPremierGeste',e); }
  return ok;
}
async function pushActiverParDefaut(){
  if(!currentUser||window._rcEnTests||!_notifSupported()) return false;
  let abonne=false;
  try{
    if(_pushSupporte()){
      const reg=await navigator.serviceWorker.ready;
      abonne=!!(await reg.pushManager.getSubscription());
    }
  }catch(e){}
  if(!pushDemandeAuto(currentUser,pushEtat(_pushEnv(abonne)))) return false;
  // Déjà autorisé (hors iOS, qui exige le geste) : abonné tout de suite.
  if(Notification.permission==='granted'&&!rcInstalliOS()){
    if(await pushAbonner({geste:false})) return true;
  }
  if(_pushGesteArme) return true;
  _pushGesteArme=true;
  // UN SEUL ÉCOUTEUR, UNE SEULE FOIS : le premier toucher de la session.
  // 'click' et non 'pointerdown' : Safari ne reconnaît le geste qu'au clic.
  document.addEventListener('click',()=>{ try{ _pushAuPremierGeste(); }catch(e){} },{capture:true,once:true});
  return true;
}
// RETIRER LES NOTIFICATIONS : l'abonnement de cet appareil est défait (le
// serveur n'a plus où envoyer), et le refus retenu pour ne pas redemander.
async function pushDesactiverDepuisReglages(){
  await pushDesabonner();
  if(currentUser){ currentUser.pushRefus=true; try{ saveUser(); }catch(e){ rcErreurMuette('pushDesactiverDepuisReglages',e); } }
  toast('Notifications désactivées sur cet appareil.','var(--sub)');
  _rendreReglagesPush();
  return true;
}
// Couper un type : un champ du dossier (pushPrefs), lu par le serveur avant
// chaque envoi ET par les rappels locaux (série, Wrapped).
function basculerPushType(type,actif){
  if(!currentUser||!PUSH_TYPES.some(t=>t.cle===type)) return false;
  const p=(currentUser.pushPrefs&&typeof currentUser.pushPrefs==='object')?Object.assign({},currentUser.pushPrefs):{};
  if(actif) delete p[type]; else p[type]=false;
  currentUser.pushPrefs=p;
  saveUser();
  if(type==='serie') try{ _seriePlanifierNotif(currentUser); }catch(e){}
  return true;
}
// ══════════ L'INSTALLATION DEVIENT UNE ETAPE, PAS UN BOUTON ════════════
//
// LE DEFAUT QU'ELLE CORRIGE : tout existait deja — beforeinstallprompt capte
// dans le <head>, #install-btn affiche, showIosInstallGuide pour iOS — mais
// c'etait un bouton SANS RAISON DONNEE, pose sur un ecran d'accueil. « ⬇
// Installer l'app » ne dit pas ce qu'on y gagne, et presque personne ne le
// pressait.
//
// ⚠ ELLE NE DUPLIQUE AUCUNE DETECTION. rcInstallAutonome dit si l'application
// est deja sur l'ecran d'accueil, rcInstalliOS reconnait iOS et ses navigateurs
// qui ne declenchent jamais l'invitation, rcInstallInvite rend l'invitation du
// navigateur quand elle existe, installApp et showIosInstallGuide portent les
// deux gestes. Les cinq sont appelees, aucune n'est reecrite.
//
// L'ARGUMENT EST CONCRET, ET C'EST TOUT L'OBJET DU LOT. On ne dit pas
// « installe l'application » — une action abstraite —, on dit ce qu'elle rend
// dans la salle : elle marche sans reseau, et elle est sous la main.
//
// PURE. Rend 'rien', 'inviter' (le navigateur a une invitation a declencher)
// ou 'ios' (le guide manuel, seule voie sur iPhone).
function etatInvitationInstall(u,supporteNotif,autonome,ios,invite){
  if(!u||u.role==='coach') return 'rien';
  // LA PREMIERE SEANCE, ET ELLE SEULE — la meme donnee que la carte des
  // notifications juste au-dessus, et que first_workout_completed.
  if((u.sessions||[]).length!==1) return 'rien';
  // UNE SEULE FOIS DANS LA VIE DU COMPTE, REFUS COMPRIS. Le temoin est dans le
  // DOSSIER, pas en local : « la vie du compte » traverse les appareils.
  if(u._installDemandeeLe) return 'rien';
  // DEJA INSTALLEE : la question ne se pose plus. C'est la premiere garde, et
  // celle qui compte le plus — proposer d'installer a quelqu'un qui lit depuis
  // son ecran d'accueil ferait douter du reste.
  if(autonome) return 'rien';
  if(ios) return 'ios';
  // NI iOS NI INVITATION — Firefox Android, navigateurs exotiques, ou
  // beforeinstallprompt pas encore arrive. Un bouton qui ne declencherait rien
  // est pire qu'aucun bouton : on se tait.
  return invite?'inviter':'rien';
}
// PURE. La carte. L'argument d'abord, le geste ensuite.
//
// `aussiNotif` ajoute la raison supplementaire quand le navigateur ne connait
// pas les notifications : c'est le message _NOTIF_INDISPO, deja ecrit et deja
// relu, et c'est la carte des notifications qui lui passe la main ici.
function _htmlInvitationInstall(etat,aussiNotif){
  if(etat==='rien') return '';
  const geste=etat==='ios'?'invInstallIos()':'invInstallInviter()';
  const lib=etat==='ios'?'Comment faire':'Installer RepCore';
  return '<div style="background:var(--info-bg);border:1px solid var(--info-border);'
    +'border-radius:var(--r-3);padding:14px 16px;margin-bottom:14px">'
    +'<div style="font-size:var(--fs-xs);color:var(--info);letter-spacing:2.5px;font-weight:800;'
    +'text-transform:uppercase;margin-bottom:6px">Dans la salle</div>'
    +'<div style="font-size:var(--fs-md);color:var(--text-strong);line-height:1.5;margin-bottom:4px">'
    +'RepCore fonctionne <strong style="color:var(--text)">sans réseau</strong> : '
    +'au sous-sol ou dans un coin sans barre, ta séance s’enregistre quand même.</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-bottom:12px">'
    +'Sur ton écran d’accueil, elle s’ouvre d’un doigt, sans passer par le navigateur.'
    +(aussiNotif?' C’est aussi ce qui rend les rappels possibles.':'')+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px;'
    +'letter-spacing:.5px" onclick="'+geste+'">'+lib+'</button>'
    +'<button type="button" class="btn btn-outline btn-sm" style="flex:0 0 auto;width:auto;'
    +'padding:0 16px;margin:0;min-height:44px;letter-spacing:.5px" onclick="invInstallNon()">'
    +'Plus tard</button></div></div>';
}
// Le tour impur : decider, rendre, et MARQUER.
//
// ⚠ LE TEMOIN EST POSE A L'AFFICHAGE, comme pour les notifications et pour la
// meme raison : « une seule fois, refus compris » inclut l'absence de reponse.
// Quelqu'un qui quitte l'ecran sans toucher aux boutons a bien vu la question.
function _rendreInvitationInstall(){
  const z=document.getElementById('wd-install-invite');
  if(!z) return;
  let etat='rien', sup=false;
  try{ sup=_notifSupported(); }catch(e){}
  try{
    etat=etatInvitationInstall(currentUser,sup,rcInstallAutonome(),rcInstalliOS(),!!rcInstallInvite());
  }catch(e){ etat='rien'; }
  if(etat==='rien'){ z.innerHTML=''; return; }
  z.innerHTML=_htmlInvitationInstall(etat,!sup);
  try{ currentUser._installDemandeeLe=Date.now(); saveUser(); }catch(e){ rcErreurMuette('_rendreInvitationInstall',e); }
}
// LES DEUX GESTES EXISTENT DEJA : on les appelle, on ne les refait pas.
// installApp porte la garde Samsung et l'invitation du navigateur ;
// showIosInstallGuide explique les deux touches de Safari et compte sa vue.
function invInstallInviter(){
  const z=document.getElementById('wd-install-invite');
  if(z) z.innerHTML='';
  try{ installApp(); }catch(e){}
}
function invInstallIos(){
  const z=document.getElementById('wd-install-invite');
  if(z) z.innerHTML='';
  try{ showIosInstallGuide(); }catch(e){}
}
// AUCUNE INSISTANCE. Le temoin pose a l'affichage garantit deja que la
// question ne reviendra pas ; il n'y a rien a ajouter, et surtout pas un
// « tu peux toujours l'installer depuis les reglages ».
function invInstallNon(){
  const z=document.getElementById('wd-install-invite');
  if(z) z.innerHTML='';
}
function invNotifNon(){
  const z=document.getElementById('wd-notif-invite');
  if(z) z.innerHTML='';
  // RIEN D'AUTRE. Pas de toast, pas de « tu peux changer d'avis dans les
  // reglages » : la question a ete posee une fois, la reponse est non, et le
  // temoin pose a l'affichage garantit qu'elle ne reviendra pas.
}
// ══════════════════ TON POINT DU JOUR ═════════════════════════════════════
//
// LE SEUL RENDEZ-VOUS RECURRENT ETAIT LE BILAN, toutes les une ou deux
// semaines. Bon rythme de coaching, mauvais rythme d'habitude : entre deux
// bilans, RepCore ne demandait rien a celui qui ne s'entraine pas ce jour-la.
//
// UNE QUESTION PAR JOUR. JAMAIS DEUX. Trois questions font un formulaire, et
// un formulaire quotidien est abandonne en une semaine — c'est la regle qui
// gouverne tout ce qui suit, et la raison pour laquelle PDJ_SEMAINE associe
// un jour a UN identifiant et non a une liste.
//
// Le samedi et le dimanche ne portent rien : deux jours sans rien demander
// font partie du rythme, ils ne sont pas un oubli.
//
// ⚠ AUCUN STOCKAGE PARALLELE. Les reponses vont dans les tableaux qui
// existent deja et par les memes fonctions d'ecriture que les ecrans dedies :
// _recordWeight → weightLog, _recordSleep → sleepLog, _recordSteps →
// stepsLog. Une pesee saisie ici est la meme ligne que celle saisie dans la
// carte « Pesee du jour », et elle s'y corrige.
//
// SEULE L'ENERGIE N'AVAIT NULLE PART OU ALLER, et il faut le dire : la seule
// energie enregistree jusqu'ici est `metrics.energie`, posee EN FIN DE SEANCE
// sur une echelle de 1 a 10 et qui porte desormais « durant la seance ». Elle
// ne peut pas recevoir le ressenti d'un mercredi sans entrainement : ce
// serait inventer une seance. D'ou energieLog, batie sur le meme patron que
// les trois autres — une entree par jour, ecrasement et non ajout, meme
// fenetre de retention. Ce n'est pas un doublon d'une structure existante,
// c'est la quatrieme de la meme famille.
const PDJ_SEMAINE=Object.freeze({
  1:'poids',      // lundi
  2:'sommeil',    // mardi
  3:'energie',    // mercredi
  4:'pas',        // jeudi   — ceux de LA VEILLE : personne ne connait son
                  //           total du jour a huit heures du matin.
  5:'sommeil'     // vendredi
  // 0 dimanche et 6 samedi : rien, et c'est voulu.
});
// `ecran` est le nom de la fonction qui OUVRE l'ecran complet, appelee sans
// argument — loadSleep et loadSteps le font deja par leurs valeurs par defaut,
// et ce sont exactement les fonctions que la barre d'onglets appelle. Le poids
// et l'energie n'en ont pas : la pesee n'a pas d'ecran dedie — sa saisie EST
// la carte de l'accueil, qui revient des que la question est repondue — et
// l'energie du jour ne se saisit qu'ici.
const PDJ_QUESTIONS=Object.freeze({
  poids:   {titre:'Combien pèses-tu ce matin ?',      accuse:'Pesée notée',
            ecran:null,        lienDit:null},
  sommeil: {titre:'Tu as dormi combien cette nuit ?', accuse:'Nuit notée',
            ecran:'lifestyleSommeil', lienDit:'Saisir mon coucher et mon lever'},
  energie: {titre:'Ton énergie aujourd\'hui ?',        accuse:'Énergie notée',
            ecran:null,        lienDit:null},
  pas:     {titre:'Combien de pas hier ?',            accuse:'Pas notés',
            ecran:'lifestylePas', lienDit:'Voir ma semaine de pas'}
});
// Les quatre durees proposees au doigt. Une nuit se dit a la demi-heure pres
// quand on la raconte, pas a la minute : celui qui veut la minute a le lien
// vers l'ecran de sommeil, qui demande coucher et lever.
const PDJ_NUITS=Object.freeze([5,6,7,8,9]);
const PDJ_ENERGIE_MAX=5;
const PDJ_ENERGIE_LIB=Object.freeze(['','À plat','Bas','Correct','Bien','En forme']);
const ENERGIE_RETENTION_JOURS=180;
// ECRIT. Jumelle de _recordWeight et _recordSteps, a la ligne pres : une
// entree par jour, ecrasement et non ajout — corriger son mercredi doit
// rester possible — et une fenetre glissante qui borne le document.
function _recordEnergie(dateStr,niveau){
  const n=parseInt(niveau,10);
  if(!dateStr||isNaN(n)||n<1||n>PDJ_ENERGIE_MAX) return false;
  if(!currentUser.energieLog) currentUser.energieLog=[];
  const idx=currentUser.energieLog.findIndex(e=>e&&e.date===dateStr);
  if(idx>=0) currentUser.energieLog[idx].niveau=n;
  else currentUser.energieLog.push({date:dateStr,niveau:n});
  const min=localISODate(new Date(Date.now()-ENERGIE_RETENTION_JOURS*864e5));
  currentUser.energieLog=currentUser.energieLog.filter(e=>e&&e.date>=min);
  currentUser.energieLog.sort((a,b)=>a.date<b.date?-1:1);
  return true;
}
// PURE. La question du jour, ou null. Date#getDay rend 0 pour dimanche : la
// table est ecrite dans cette convention-la, et non dans celle de
// _woReminderDays ou lundi vaut 0. Les deux coexistent dans ce fichier, et
// les confondre decalerait la semaine entiere d'un jour.
function pdjQuestionDuJour(maintenant){
  const d=new Date(typeof maintenant==='number'?maintenant:Date.now());
  return PDJ_SEMAINE[d.getDay()]||null;
}
// PURE. LE JOUR AUQUEL LA REPONSE APPARTIENT, qui n'est pas toujours
// aujourd'hui : le jeudi on demande les pas de LA VEILLE, et ils doivent
// s'inscrire a la date d'hier, sans quoi le total d'un mercredi atterrirait
// sur le jeudi et fausserait les deux journees.
function pdjDateCible(question,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  return localISODate(question==='pas'?_datePlusJours(t,-1):new Date(t));
}
// PURE. La reponse est-elle deja la ? « Si la donnee du jour est deja saisie,
// la carte n'apparait pas » — et c'est vrai quelle que soit la PORTE par
// laquelle elle est entree : l'ecran Lifestyle, l'import par capture d'ecran,
// la fin de seance ou cette carte. On interroge la donnee, jamais un temoin
// de passage.
function pdjDejaSaisi(u,question,dateISO){
  const l=(t)=>((u&&u[t])||[]).some(e=>e&&e.date===dateISO);
  if(question==='poids')   return ((u&&u.weightLog)||[]).some(e=>e&&e.date===dateISO)
                              ||((u&&u.bilans)||[]).some(b=>b&&b.date===dateISO&&b.weight);
  if(question==='sommeil') return l('sleepLog');
  if(question==='pas')     return l('stepsLog');
  if(question==='energie') return l('energieLog');
  return true;
}
// PURE. L'etat de la carte, ou null quand elle ne doit pas paraitre.
//
// LES GARDES, DANS L'ORDRE OU ELLES COMPTENT :
//   • un athlete, jamais un coach ;
//   • un jour qui porte une question — le week-end n'en porte pas ;
//   • le bloc de reprise n'est pas affiche. Celui qui n'a JAMAIS fait de
//     seance recoit une proposition unique, « commencer maintenant », et ce
//     lot-ci ne vient pas poser une question d'intendance a cote d'elle ;
//   • les gardes du POIDS, reprises telles quelles de la carte de pesee :
//     on ne demande pas son poids tous les lundis a quelqu'un qui le masque,
//     dont les signaux de TCA sont leves, ou dont les paliers de deficit
//     sont en blocage. Ce jour-la, la carte ne parait pas : il vaut mieux un
//     lundi muet qu'une question qu'on n'a pas le droit de poser ;
//   • la reponse n'est pas deja enregistree.
function pdjEtat(u,maintenant){
  if(!u||u.role==='coach') return null;
  const q=pdjQuestionDuJour(maintenant);
  if(!q||!PDJ_QUESTIONS[q]) return null;
  try{ if(_doitProposerReprise(u,(typeof maintenant==='number')?maintenant:Date.now())) return null; }catch(e){}
  if(q==='poids'){
    try{ if(aTCA(u)||u.masquerPoids||paliersDeficit(u)==='blocage') return null; }catch(e){}
  }
  const date=pdjDateCible(q,maintenant);
  if(pdjDejaSaisi(u,q,date)) return null;
  return {question:q,date,titre:PDJ_QUESTIONS[q].titre};
}
// Le gabarit. Un entete, une question, UN controle, et le lien vers l'ecran
// complet quand il en existe un — « reutilise les ecrans et champs existants »
// vaut aussi pour la sortie : celui qui veut saisir son coucher et son lever
// n'est pas coince dans une pastille.
function _htmlPointDuJour(etat){
  if(!etat) return '';
  const def=PDJ_QUESTIONS[etat.question];
  let controle='';
  if(etat.question==='poids'){
    controle='<div class="pdj-ligne">'
      +'<label class="pes-boite" for="pdj-poids"><span class="pes-duo">'
      +'<input type="text" inputmode="decimal" autocomplete="off" data-dec id="pdj-poids" '
      +'min="'+PESEE_MIN+'" max="'+PESEE_MAX+'" placeholder="-" class="pes-champ">'
      +'<span class="pes-unite">kg</span></span></label>'
      +'<button class="btn btn-red btn-sm pdj-ok" onclick="pdjValiderPoids()">Enregistrer</button></div>';
  } else if(etat.question==='pas'){
    controle='<div class="pdj-ligne">'
      +'<label class="pes-boite" for="pdj-pas"><span class="pes-duo">'
      +'<input type="number" id="pdj-pas" inputmode="numeric" step="100" '
      +'min="0" max="99999" placeholder="-" class="pes-champ">'
      +'<span class="pes-unite">pas</span></span></label>'
      +'<button class="btn btn-red btn-sm pdj-ok" onclick="pdjValiderPas()">Enregistrer</button></div>';
  } else if(etat.question==='sommeil'){
    controle='<div class="pdj-choix">'+PDJ_NUITS.map((h,i)=>
      '<button type="button" class="pdj-past" onclick="pdjValiderSommeil('+h+')">'
      +h+'h'+(i===PDJ_NUITS.length-1?'+':'')+'</button>').join('')+'</div>';
  } else {
    controle='<div class="pdj-choix">'+Array.from({length:PDJ_ENERGIE_MAX},(_,i)=>{
      const v=i+1;
      return '<button type="button" class="pdj-past" aria-label="'
        +escapeHtml(PDJ_ENERGIE_LIB[v])+'" onclick="pdjValiderEnergie('+v+')">'+v+'</button>';
    }).join('')+'</div>'
    +'<div class="pdj-echelle"><span>1 · à plat</span><span>5 · en forme</span></div>';
  }
  const lien=def.ecran
    ? '<button type="button" class="pdj-lien" onclick="'+def.ecran+'()">'
      +escapeHtml(def.lienDit)+' →</button>'
    : '';
  return '<div class="pdj-carte" id="pdj-carte" data-acc>'+_accX('pdj')
    +'<div class="pdj-tete">Ton point du jour</div>'
    +'<div class="pdj-q">'+escapeHtml(etat.titre)+'</div>'
    +controle+lien+'</div>';
}
// ══════ LA SORTIE DE PACK (lot 10) ══════════════════════════════════════
//
// Ce que ce lot repare : la fin d'un suivi menait a « Accès expiré », et la
// seule issue proposee etait de recontacter le coach. On perdait la personne
// entierement — alors qu'elle a ses seances, son programme et son historique
// dans l'application, et qu'elle vient de passer trois mois a les remplir.
//
// DEUX BOUTONS, JAMAIS UN SEUL : reprendre le suivi, ou garder l'application.
// Le second n'est pas un lot de consolation : c'est celui qui rapporte quand
// le premier ne se fait pas.
//
// PURE. Ou en est le pack : 'non' (rien a dire), 'bientot' (dans les quinze
// jours), 'finie'. La fin vient du serveur quand il parle, du dossier sinon.
function finDePack(u,maintenant){
  const x=u||currentUser;
  const t=Number(maintenant)||Date.now();
  const rien={etat:'non',jours:null,fin:0};
  if(!x||x.role==='coach') return rien;
  let fin=0,suivi=false;
  try{
    const d=droitsDe(x);
    if(d.etat==='serveur'&&d.palier==='suivi'){ suivi=true; fin=Number(d.echeance)||0; }
  }catch(e){}
  if(String(x.status||'')==='COACHING_SUIVI'){ suivi=true; fin=fin||Number(x.accessExpiry)||0; }
  if(!suivi||!fin) return rien;
  const j=Math.ceil((fin-t)/864e5);
  if(j>RELANCE_JOURS) return {etat:'non',jours:j,fin:fin};
  if(j>0) return {etat:'bientot',jours:j,fin:fin};
  return {etat:'finie',jours:j,fin:fin};
}
// PURE. L'athlète est-il arrivé par un code ambassadeur qui porte l'offre de
// lancement ? Le serveur (droits.offreAmb) d'abord ; le dossier en attendant
// que la demande soit jugée.
function offreAmbDemi(u){
  if(!u||u.role==='coach') return false;
  try{ const d=droitsDe(u); if(d.etat==='serveur'&&d.offreAmb==='ultime_demi') return true; }catch(e){}
  return !!(u.ambassadeur&&u.ambassadeur.avantage==='ultime_demi');
}
// PURE. Le premier mois d'Ultime a moitie prix, apres un pack, UNE SEULE FOIS.
//
// ⚠ ELLE REND false TANT QUE LE PLAN PAYPAL N'EXISTE PAS. Annoncer 12,45 € et
//   facturer 24,90 serait pire que ne rien annoncer du tout : la sortie de
//   pack propose alors Ultime au prix normal, ce qu'elle sait encaisser.
function demiPremierMoisDispo(u,maintenant){
  const x=u||currentUser;
  if(!x) return false;
  try{ if(!planIdOffre('ultime_demi')) return false; }catch(e){ return false; }
  if(x.demiPackUtilise===true) return false;
  try{ const d=droitsDe(x); if(d.etat==='serveur'&&d.demiPackUtilise===true) return false; }catch(e){}
  // L'OFFRE DE LANCEMENT d'un code ambassadeur « ultime_demi » : même demi-
  // tarif, même unicité (demiPackUtilise).
  if(offreAmbDemi(x)) return true;
  return finDePack(x,maintenant).etat!=='non';
}
// PURE. La phrase, selon le moment et selon ce qu'on sait encaisser.
function phraseSortiePack(u,maintenant){
  const f=finDePack(u,maintenant);
  if(f.etat==='non') return '';
  const d=f.fin?new Date(f.fin).toLocaleDateString('fr-FR'):'';
  const demi=demiPremierMoisDispo(u,maintenant);
  const prix=demi
    ?(prixOffre('ultime_demi')+' le premier mois, puis '+prixOffre('ultime')+' par mois')
    :(prixOffre('ultime')+' par mois');
  const tete=(f.etat==='bientot')
    ?('Ton suivi se termine'+(d?(' le '+d):' bientôt')+'.')
    :('Ton suivi est terminé'+(d?(' depuis le '+d):'')+'.');
  return tete+' Tu peux le reprendre, ou garder l’app, ton programme et ton '
    +'historique pour '+prix+'.';
}
// LE BLOC, AVEC SES DEUX PORTES. La premiere mene au coach quand on sait ou le
// joindre — c'est le sien, pas une page generale.
function htmlSortiePack(u,maintenant){
  const x=u||currentUser;
  const f=finDePack(x,maintenant);
  if(f.etat==='non') return '';
  const nom=String((x&&x.coachName)||'').trim();
  let href='';
  try{
    href=_coachContactHref((x&&x.coachId),'Bonjour'+(nom?' '+nom:'')
      +', je voudrais reprendre mon suivi RepCore.');
  }catch(e){ href=''; }
  const reprendre=href
    ?'<a class="vrr-b" href="'+_safeContactUrl(href)+'" target="_blank" rel="noopener">'
      +'Reprendre mon suivi</a>'
    :'<a class="vrr-b" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
      +'Reprendre mon suivi</a>';
  return '<div class="vrr">'
    +'<div class="vrr-t">'+escapeHtml(phraseSortiePack(x,maintenant))+'</div>'
    // RIEN N'EST EFFACE, et c'est ce qui decide : la peur de tout perdre est
    // la premiere raison de ne pas revenir.
    +'<div class="vrr-p">Rien n’est effacé : tes séances, ton programme et ton '
    +'historique restent à toi.</div>'
    +'<div class="vrr-deux">'+reprendre
    +'<button type="button" class="vrr-b vrr-b2" onclick="garderLApp()">Garder l’app</button>'
    +'</div></div>';
}
// LA SECONDE PORTE. Elle memorise l'offre choisie comme la carte de l'ecran
// d'arrivee, et ouvre l'ecran d'abonnement.
function garderLApp(){
  try{ return accueilChoisir(demiPremierMoisDispo()?'ultime_demi':'ultime',false); }
  catch(e){ try{ go('s-subscribe'); }catch(_e){} }
  return true;
}
// La mention d'essai. Elle emprunte son texte a texteEssaiRestant, qui est
// PURE et qui est la seule a savoir compter — ce rendu-ci ne fait que peindre.
function _rendreEssai(){
  const z=document.getElementById('clh-essai');
  if(!z) return;
  // ⚠ LA SORTIE DE PACK PASSE DEVANT L'ESSAI (lot 10), et les deux ne peuvent
  //   pas arriver ensemble : on ne fait pas d'essai pendant un suivi. La
  //   priorite est ecrite quand meme, parce qu'un dossier peut porter les deux
  //   champs apres un code coach pose sur un compte qui avait essaye.
  let pack='';
  try{ pack=htmlSortiePack(currentUser); }catch(e){ pack=''; }
  if(pack){ z.innerHTML=pack; return; }
  let t='';
  try{ t=texteEssaiRestant(currentUser); }catch(e){ t=''; }
  // LE LIBELLE DU LIEN SUIT LE MOMENT (lot 6) : « voir l'abonnement » ne dit
  // rien au premier jour, ou tout est ouvert et ou personne ne cherche a
  // payer. Il ne devient une offre que quand la fin approche.
  let lien='Voir les formules';
  try{ const r=essaiJoursRestants(currentUser); if(r!==null&&r<=3) lien='Voir Ultime'; }catch(e){}
  z.innerHTML=t
    ? '<div class="ess-ligne"><span>'+escapeHtml(t)+'</span>'
      +'<button type="button" class="ess-lien" onclick="ouvrirAbonnementDepuisEssai()">'
      +escapeHtml(lien)+'</button></div>'
    : '';
}
// ══════ L'ECRAN DE CHOIX, AU BOUT DU MOIS (lot 6) ════════════════════════
//
// ⚠ IL MONTRE SON PROGRAMME, PAS UNE GRILLE DE TARIFS. Ce qui decide, ce
//   n'est pas la liste de ce qu'on vend : c'est ce que la personne a
//   construit et qu'elle a sous les yeux.
//
// ET RIEN N'EST EFFACE. C'est ecrit en toutes lettres, parce que c'est vrai et
// parce que c'est exactement la peur qui fait fermer l'application. Ses
// seances, ses exercices et son historique restent ; ce sont les portes
// d'Ultime qui se referment, et elles se rouvrent le jour ou elle le decide.
function rendreEssaiBilan(u){
  const z=document.getElementById('eb-corps');
  if(!z) return false;
  const x=u||currentUser||{};
  const quoi=essaiBilanPhrase(x);
  const faites=essaiBilan(x).faites;
  const titre=quoi
    ? 'Ton mois est terminé, et '+quoi+' sont toujours là.'
    : 'Ton mois est terminé.';
  const ligne=(t)=>'<li style="margin-bottom:6px">'+t+'</li>';
  z.innerHTML=
    '<div class="eb-tete">Ton mois d’essai</div>'
    +'<h1 class="eb-titre">'+escapeHtml(titre)+'</h1>'
    +(faites?'<p class="eb-sous">'+faites+' séance'+(faites>1?'s':'')+' terminée'
      +(faites>1?'s':'')+' pendant le mois. Rien n’est effacé.</p>'
      :'<p class="eb-sous">Rien n’est effacé.</p>')
    +'<div class="eb-carte">'
      +'<div class="eb-c-nom">Ultime</div>'
      +'<div class="eb-c-prix">'+escapeHtml(prixMoisAnnuel('ultime'))+' par mois en annuel, '
      +'ou '+escapeHtml(prixOffre('ultime'))+' au mois</div>'
      +'<ul class="eb-c-l">'
      +ligne('Le catalogue d’exercices, filmés et illustrés')
      +ligne('La charge de ton bloc, semaine par semaine')
      +ligne('Ta diète calculée et tes compléments')
      +'</ul>'
      +'<button type="button" class="btn btn-red" style="width:100%" '
      +'onclick="accueilChoisir(\'ultime\',false)">Continuer avec Ultime</button>'
    +'</div>'
    +'<div class="eb-carte">'
      +'<div class="eb-c-nom">Essentielle</div>'
      +'<div class="eb-c-prix">'+escapeHtml(prixMoisAnnuel('essentielle'))+' par mois en annuel, '
      +'ou '+escapeHtml(prixOffre('essentielle'))+' au mois</div>'
      +'<ul class="eb-c-l">'
      +ligne('Tes séances, ton historique et tes bilans')
      +ligne('Ta nutrition et ton lifestyle')
      +'</ul>'
      +'<button type="button" class="btn btn-outline" style="width:100%" '
      +'onclick="accueilChoisir(\'essentielle\',false)">Continuer avec Essentielle</button>'
    +'</div>'
    +'<div class="eb-pied">'
      +'<p class="eb-coach">Tu veux que quelqu’un s’en occupe pour toi&nbsp;? '
      +'Avec un coach, l’application est comprise, et tes vidéos sont corrigées.</p>'
      +'<a class="eb-lien" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
      +'Voir les formules de coaching</a>'
      +'<button type="button" class="eb-lien" onclick="ouvrirCodeCoach()">J’ai un code coach</button>'
    +'</div>';
  return true;
}
// Le seul chemin vers le paywall pendant l'essai, et il est VOLONTAIRE : on
// ne le pousse pas, on le rend atteignable. C'est la difference entre une
// mention et une relance.
function ouvrirAbonnementDepuisEssai(){
  try{ goAvecRetour('s-subscribe'); loadSubscribePage(); }
  catch(e){ try{ go('s-subscribe'); }catch(_e){} }
}
// La phrase posee partout ou elle doit l'etre, sur le modele exact de ce que
// fait selectRole pour PROMESSE_COACH : un seul texte, plusieurs emplacements,
// aucune recopie.
function _poserPromesseAthlete(){
  try{
    document.querySelectorAll('[data-promesse-athlete]')
      .forEach(e=>{ e.textContent=PROMESSE_ATHLETE; });
  }catch(e){}
}
// ══ LES CARTES DE L'ACCUEIL SE FERMENT D'UNE CROIX (Kevin, 28/09/2026) ═════
// « Ton point du jour » jusqu'au lendemain, la relance de photo sept jours,
// « Tu as un code coach ? » trente jours. Le choix est local à l'appareil :
// rien n'est écrit dans le dossier.
// + le check-in / la batterie du jour et les habitudes du jour (29/09/2026) :
// une croix, et la carte revient le lendemain.
const ACC_MASQUES_JOURS=Object.freeze({pdj:0,photo:7,code:30,ci:0,hab:0,mob:0});
function accueilMasque(cle,maintenant){
  let v=null; try{ v=localStorage.getItem('rc_acc_masque_'+cle); }catch(e){ v=null; }
  if(!v) return false;
  const t=Number(maintenant)||Date.now();
  const j=ACC_MASQUES_JOURS[cle]||0;
  if(!j) return v===localISODate(new Date(t));
  return (t-new Date(v+'T00:00:00').getTime())<j*864e5;
}
function accueilMasquer(cle,bouton){
  try{ localStorage.setItem('rc_acc_masque_'+cle,localISODate(new Date())); }catch(e){}
  const c=bouton&&bouton.closest?bouton.closest('[data-acc]'):null;
  const z=c&&c.parentElement;
  if(c) c.remove();
  if(z&&!z.children.length&&z.id!=='clh-point-jour') z.style.display='none';
  return true;
}
function _accX(cle){
  return '<button type="button" class="acc-x" aria-label="Masquer" onclick="event.stopPropagation();accueilMasquer(\''+cle+'\',this)">'
    +'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
}
function _rendrePointDuJour(){
  const z=document.getElementById('clh-point-jour');
  if(!z) return;
  if(accueilMasque('pdj')){ z.innerHTML=''; return; }
  let e=null;
  try{ e=pdjEtat(currentUser,Date.now()); }catch(err){ e=null; }
  z.innerHTML=_htmlPointDuJour(e);
}
// L'ACCUSE DE RECEPTION, ET LA FERMETURE. Discret : la carte remplace son
// contenu par une coche et une phrase de trois mots, puis s'efface. Pas de
// modale, pas de toast supplementaire — les fonctions d'ecriture reutilisees
// en emettent deja un, et deux confirmations pour un geste, c'est une de trop.
//
// Sous « animations reduites » la carte part immediatement : _animer pose
// alors l'image finale sans jouer la transition, et l'accuse reste lisible le
// temps du minuteur.
function _pdjAccuser(question){
  const c=document.getElementById('pdj-carte');
  if(!c){ try{ _rendrePointDuJour(); }catch(e){} return; }
  const def=PDJ_QUESTIONS[question]||{accuse:'Noté'};
  c.innerHTML='<div class="pdj-ok-msg"><span class="pdj-coche">'+icon('coche',14)+'</span>'
    +escapeHtml(def.accuse)+'</div>';
  c.setAttribute('data-fait','');
  setTimeout(()=>{
    const a=_animer(c,[{opacity:1},{opacity:0}],
      {duration:ARC.release,easing:ARC.charge,fill:'forwards'});
    const fin=()=>{ try{ _rendrePointDuJour(); }catch(e){} };
    if(a&&a.finished) a.finished.then(fin,fin); else fin();
  },1200);
}
// Les quatre validations. Chacune ecrit PAR LA FONCTION DEJA EN PLACE, relit
// la date cible plutot que de la garder en memoire — la carte peut avoir ete
// ouverte avant minuit — et se referme sur un accuse.
async function pdjValiderPoids(){
  const inp=document.getElementById('pdj-poids');
  if(!inp) return;
  const v=parseFloat(String(inp.value).replace(',','.'));
  if(!await _enregistrerPesee(v,pdjDateCible('poids',Date.now()))) return;
  _pdjAccuser('poids');
  try{ renderCartePesee(); }catch(e){}
}
function pdjValiderPas(){
  if(!demanderConsentementSante('pas',pdjValiderPas)) return;
  const inp=document.getElementById('pdj-pas');
  if(!inp) return;
  const n=parseInt(String(inp.value).replace(/\s/g,''),10);
  if(!_recordSteps(pdjDateCible('pas',Date.now()),n)){
    toast('Saisis un nombre de pas valide','var(--red)'); return; }
  toastEcriture(saveUser(),n.toLocaleString('fr-FR')+' pas enregistrés '+ICO.coche,'tes pas sont');
  _pdjAccuser('pas');
}
function pdjValiderSommeil(h){
  if(!demanderConsentementSante('sommeil',()=>pdjValiderSommeil(h))) return;
  const d=Number(h);
  if(!_recordSleep(pdjDateCible('sommeil',Date.now()),{duration:d})){
    toast('Durée refusée','var(--red)'); return; }
  toastEcriture(saveUser(),d+'h enregistrées '+ICO.coche,'ta nuit est');
  _pdjAccuser('sommeil');
  // BUILD 1886 : la nuit complète le check-in qui ne l'a pas redemandée.
  try{ if(_ciBrouillon&&_ciBrouillon.energie&&_ciBrouillon.courbatures) checkinRepondre('energie',_ciBrouillon.energie); }catch(e){}
}
function pdjValiderEnergie(n){
  if(!demanderConsentementSante('energie',()=>pdjValiderEnergie(n))) return;
  if(!_recordEnergie(pdjDateCible('energie',Date.now()),n)){
    toast('Niveau refusé','var(--red)'); return; }
  toastEcriture(saveUser(),'Énergie enregistrée '+ICO.coche,'ton énergie est');
  _pdjAccuser('energie');
}
// ══════════════════ LA COLLECTION DE BADGES ══════════════════════════════
//
// CINQUANTE, EN TROIS SORTES. Le « cinq, et on s'arrête » d'origine est levé
// par Kevin le 26/09/2026 : la collection devient un parcours, et un parcours
// se lit par PALIERS — une ligne par famille, un palier atteint, une barre
// vers le suivant. C'est ce qui garde le signal lisible à cinquante : on ne
// regarde pas cinquante cases, on regarde huit lignes.
//
//   • 8 FAMILLES À 4 PALIERS (I à IV)          32
//   • 8 UNIQUES (dont 4 inactifs pour l'instant) 8
//   • 10 SECRETS, montrés « ??? » + un indice    10
//
// LES CINQ ANCIENNES CLÉS SONT GARDÉES TELLES QUELLES : elles vivent déjà dans
// u.badges de chaque dossier, avec leur date. « quatre-semaines » devient le
// palier I d'INARRÊTABLE — même critère, même clé, rien n'est migré.
//
// LA LISTE RESTE FERMÉE CÔTÉ SERVEUR. database.rules.json n'accepte que ces
// identifiants, et scripts/verif/regles.mjs compare les deux listes : un
// badge ajouté ici seul serait gagné sur l'appareil puis effacé à la synchro.
//
// CHAQUE ENTRÉE : id (la clé du dossier), nom, famille, palier (1 à 4, ou
// null), icone (le visuel, img/badges/<icone>.webp), condition (ce qu'il faut
// faire, lisible), indice (les secrets seulement), test (f → date d'obtention
// en ms, ou 0). `lib`, `phrase` et `attendu` restent pour la bannière et les
// anciens appelants.
//
// LE TEST NE LIT QUE `f`, les faits tirés de l'historique par _badgesFaits.
// Il rend la DATE où le badge a été mérité, pas un booléen : c'est ce qui
// permet de rendre à un athlète ancien ses badges avec leur vraie date.
const BADGE_ROMAINS=['I','II','III','IV'];
const BADGES_ACQUIS=Object.freeze([
  // ── ASSIDU : séances terminées ──────────────────────────────────────
  {id:'assidu_1',nom:'ASSIDU I',famille:'assidu',palier:1,icone:'assidu_1',condition:'Termine 10 séances.',test:f=>_bdgNieme(f.seances,10)},
  {id:'assidu_2',nom:'ASSIDU II',famille:'assidu',palier:2,icone:'assidu_2',condition:'Termine 50 séances.',test:f=>_bdgNieme(f.seances,50)},
  {id:'assidu_3',nom:'ASSIDU III',famille:'assidu',palier:3,icone:'assidu_3',condition:'Termine 100 séances.',test:f=>_bdgNieme(f.seances,100)},
  {id:'assidu_4',nom:'ASSIDU IV',famille:'assidu',palier:4,icone:'assidu_4',condition:'Termine 250 séances.',test:f=>_bdgNieme(f.seances,250)},
  // ── INARRÊTABLE : semaines consécutives au quota ────────────────────
  // Le palier I est l'ancien « Quatre semaines », sous son ancienne clé.
  {id:'quatre-semaines',nom:'INARRÊTABLE I',famille:'inarretable',palier:1,icone:'inarretable_1',condition:'Enchaîne 4 semaines consécutives.',test:f=>f.serie(4)},
  {id:'inarretable_2',nom:'INARRÊTABLE II',famille:'inarretable',palier:2,icone:'inarretable_2',condition:'Enchaîne 12 semaines consécutives.',test:f=>f.serie(12)},
  {id:'inarretable_3',nom:'INARRÊTABLE III',famille:'inarretable',palier:3,icone:'inarretable_3',condition:'Enchaîne 26 semaines consécutives.',test:f=>f.serie(26)},
  {id:'inarretable_4',nom:'INARRÊTABLE IV',famille:'inarretable',palier:4,icone:'inarretable_4',condition:'Enchaîne 52 semaines consécutives.',test:f=>f.serie(52)},
  // ── BRISEUR DE RECORDS : records de charge, cumulés ─────────────────
  {id:'briseur_1',nom:'BRISEUR DE RECORDS I',famille:'briseur',palier:1,icone:'briseur_1',condition:'Bats 5 records.',test:f=>_bdgNieme(f.records,5)},
  {id:'briseur_2',nom:'BRISEUR DE RECORDS II',famille:'briseur',palier:2,icone:'briseur_2',condition:'Bats 25 records.',test:f=>_bdgNieme(f.records,25)},
  {id:'briseur_3',nom:'BRISEUR DE RECORDS III',famille:'briseur',palier:3,icone:'briseur_3',condition:'Bats 50 records.',test:f=>_bdgNieme(f.records,50)},
  {id:'briseur_4',nom:'BRISEUR DE RECORDS IV',famille:'briseur',palier:4,icone:'briseur_4',condition:'Bats 100 records.',test:f=>_bdgNieme(f.records,100)},
  // ── TONNAGE : volume soulevé, cumulé ────────────────────────────────
  {id:'tonnage_1',nom:'TONNAGE I',famille:'tonnage',palier:1,icone:'tonnage_1',condition:'Soulève 10 tonnes au total.',test:f=>f.tonnage(10000)},
  {id:'tonnage_2',nom:'TONNAGE II',famille:'tonnage',palier:2,icone:'tonnage_2',condition:'Soulève 100 tonnes au total.',test:f=>f.tonnage(100000)},
  {id:'tonnage_3',nom:'TONNAGE III',famille:'tonnage',palier:3,icone:'tonnage_3',condition:'Soulève 500 tonnes au total.',test:f=>f.tonnage(500000)},
  {id:'tonnage_4',nom:'TONNAGE IV',famille:'tonnage',palier:4,icone:'tonnage_4',condition:'Soulève 1 000 tonnes au total.',test:f=>f.tonnage(1000000)},
  // ── SANS FAUTE : semaines à 100 %, cumulées ─────────────────────────
  {id:'sans_faute_1',nom:'SANS FAUTE I',famille:'sans_faute',palier:1,icone:'sans_faute_1',condition:'Réussis 4 semaines à 100 %.',test:f=>_bdgNieme(f.sansFaute,4)},
  {id:'sans_faute_2',nom:'SANS FAUTE II',famille:'sans_faute',palier:2,icone:'sans_faute_2',condition:'Réussis 12 semaines à 100 %.',test:f=>_bdgNieme(f.sansFaute,12)},
  {id:'sans_faute_3',nom:'SANS FAUTE III',famille:'sans_faute',palier:3,icone:'sans_faute_3',condition:'Réussis 26 semaines à 100 %.',test:f=>_bdgNieme(f.sansFaute,26)},
  {id:'sans_faute_4',nom:'SANS FAUTE IV',famille:'sans_faute',palier:4,icone:'sans_faute_4',condition:'Réussis 52 semaines à 100 %.',test:f=>_bdgNieme(f.sansFaute,52)},
  // ── MIROIR : bilans remplis ─────────────────────────────────────────
  {id:'miroir_1',nom:'MIROIR I',famille:'miroir',palier:1,icone:'miroir_1',condition:'Remplis 3 bilans.',test:f=>_bdgNieme(f.bilans,3)},
  {id:'miroir_2',nom:'MIROIR II',famille:'miroir',palier:2,icone:'miroir_2',condition:'Remplis 10 bilans.',test:f=>_bdgNieme(f.bilans,10)},
  {id:'miroir_3',nom:'MIROIR III',famille:'miroir',palier:3,icone:'miroir_3',condition:'Remplis 25 bilans.',test:f=>_bdgNieme(f.bilans,25)},
  {id:'miroir_4',nom:'MIROIR IV',famille:'miroir',palier:4,icone:'miroir_4',condition:'Remplis 50 bilans.',test:f=>_bdgNieme(f.bilans,50)},
  // ── CYCLES : cycles de 28 jours clôturés (rites de fin de cycle) ────
  {id:'cycles_1',nom:'CYCLES I',famille:'cycles',palier:1,icone:'cycles_1',condition:'Clôture 1 cycle de 28 jours.',test:f=>_bdgNieme(f.cycles,1)},
  {id:'cycles_2',nom:'CYCLES II',famille:'cycles',palier:2,icone:'cycles_2',condition:'Clôture 3 cycles de 28 jours.',test:f=>_bdgNieme(f.cycles,3)},
  {id:'cycles_3',nom:'CYCLES III',famille:'cycles',palier:3,icone:'cycles_3',condition:'Clôture 6 cycles de 28 jours.',test:f=>_bdgNieme(f.cycles,6)},
  {id:'cycles_4',nom:'CYCLES IV',famille:'cycles',palier:4,icone:'cycles_4',condition:'Clôture 12 cycles de 28 jours.',test:f=>_bdgNieme(f.cycles,12)},
  // ── CARBURANT : jours de journal alimentaire ────────────────────────
  {id:'carburant_1',nom:'CARBURANT I',famille:'carburant',palier:1,icone:'carburant_1',condition:'Tiens ton journal 7 jours.',test:f=>_bdgNieme(f.journal,7)},
  {id:'carburant_2',nom:'CARBURANT II',famille:'carburant',palier:2,icone:'carburant_2',condition:'Tiens ton journal 30 jours.',test:f=>_bdgNieme(f.journal,30)},
  {id:'carburant_3',nom:'CARBURANT III',famille:'carburant',palier:3,icone:'carburant_3',condition:'Tiens ton journal 90 jours.',test:f=>_bdgNieme(f.journal,90)},
  {id:'carburant_4',nom:'CARBURANT IV',famille:'carburant',palier:4,icone:'carburant_4',condition:'Tiens ton journal 365 jours.',test:f=>_bdgNieme(f.journal,365)},
  // ── LES UNIQUES ─────────────────────────────────────────────────────
  {id:'premiere-seance',nom:'PREMIÈRE SÉANCE',famille:'unique',palier:null,icone:'premiere_seance',condition:'Termine une première séance.',test:f=>_bdgNieme(f.seances,1),
   lib:'Première séance',phrase:'La première est faite. C\'est celle qui coûte le plus.'},
  {id:'semaine-validee',nom:'SEMAINE VALIDÉE',famille:'unique',palier:null,icone:'semaine_validee',condition:'Fais toutes tes séances prévues sur une même semaine.',test:f=>_bdgNieme(f.semaines,1),
   lib:'Semaine validée',phrase:'Toutes les séances prévues, sur une même semaine.'},
  {id:'premier-record',nom:'PREMIER RECORD',famille:'unique',palier:null,icone:'premier_record',condition:'Dépasse ta meilleure charge sur un exercice.',test:f=>_bdgNieme(f.records,1),
   lib:'Premier record',phrase:'Tu viens de passer ta meilleure performance.'},
  {id:'premier-bilan',nom:'PREMIER BILAN',famille:'unique',palier:null,icone:'premier_bilan',condition:'Remplis un premier bilan.',test:f=>_bdgNieme(f.bilans,1),
   lib:'Premier bilan',phrase:'Ton premier bilan est enregistré. La suite se mesure.'},
  // FONDATEUR : parmi les 500 premiers inscrits. Le rang d'inscription ne se
  // lit pas depuis un dossier : on compare la date d'inscription à celle du
  // 500e, FONDATEUR_LIMITE. Tant qu'elle n'est pas posée, le badge dort.
  {id:'fondateur',nom:'FONDATEUR',famille:'unique',palier:null,icone:'fondateur',condition:'Fais partie des 500 premiers inscrits.',test:f=>f.fondateur,inactif:()=>!(FONDATEUR_LIMITE>0)},
  // LE PARRAINAGE : des filleuls AU TRAVAIL (quatre séances faites, ou
  // abonnés : un inscrit ne compte pas, anti-fraude), datés du 3e et du 10e
  // (u.parrainage.actifsLe, recopié de /parrainage/comptes, où seul le Worker
  // écrit). Fermés tant que PARRAINAGE_ACTIF l'est.
  {id:'recruteur',nom:'RECRUTEUR',famille:'unique',palier:null,icone:'recruteur',condition:'Parraine 3 personnes qui font leurs quatre premières séances.',test:f=>_bdgNieme(f.parrainages,3),inactif:()=>!PARRAINAGE_ACTIF},
  {id:'mentor',nom:'MENTOR',famille:'unique',palier:null,icone:'mentor',condition:'Parraine 10 personnes qui font leurs quatre premières séances.',test:f=>_bdgNieme(f.parrainages,10),inactif:()=>!PARRAINAGE_ACTIF},
  // LES DÉFIS DU CANAL : CHAMPION est daté par la clôture du défi
  // (defis_resultats → u.defisReleves) — le premier du classement d'un défi
  // bouclé. « DÉFI RELEVÉ » N'EST PAS ICI : c'est un badge daté PAR DÉFI, hors
  // de la collection des cinquante (voir htmlDefisReleves).
  {id:'champion',nom:'CHAMPION',famille:'unique',palier:null,icone:'champion',condition:'Gagne un défi.',test:f=>f.champion},
  // LE PARCOURS DE DÉMARRAGE : les sept étapes des 14 premiers jours. Seul
  // NOM de l'app à dire « SOUS TENSION » sans « temps » devant — la clé,
  // elle, dit parcours_ (voir PARCOURS_DEMARRAGE). Le visuel : badges-bruts/
  // sous_tension.png, converti par scripts/badges.py (repli : FULL_SESSION).
  // LA MISSION DU JOUR : le coffre ouvert sept jours d'affilée.
  {id:'sept_sur_sept',nom:'SEPT SUR SEPT',famille:'unique',palier:null,icone:'sept_sur_sept',condition:'Ouvre le coffre de la mission du jour 7 jours d’affilée.',test:f=>f.septSurSept,
   phrase:'Sept coffres, sept jours. La régularité, c’est ça.'},
  // LES LIGUES : la première montée, la première place en LÉGENDE (le
  // résultat du serveur, ligues_resultats, recopié dans u.liguesReleves).
  {id:'promu',nom:'PROMU',famille:'unique',palier:null,icone:'promu',condition:'Monte de division pour la première fois.',test:f=>f.promu,
   phrase:'Le top de ta ligue. Une division de plus.'},
  {id:'sommet',nom:'SOMMET',famille:'unique',palier:null,icone:'sommet',condition:'Termine 1er d’une semaine en LÉGENDE.',test:f=>f.sommet,
   phrase:'Premier de la LÉGENDE. Il n’y a rien au-dessus.'},
  {id:'parcours_sous_tension',nom:'SOUS TENSION',famille:'unique',palier:null,icone:'sous_tension',condition:'Termine le parcours Mise sous tension.',test:f=>f.parcoursFini,
   lib:'Mise sous tension',phrase:'Toutes les étapes sont faites. Le courant passe.'},
  // ── L'ASSIETTE (lot N4) : des journées TENUES, jamais un résultat ────
  // ⚠ Aucun badge sur un déficit, une perte ou un chiffre de balance : un test
  //   relit ces lignes et tombe au premier mot qui en parle.
  {id:'assiette_premier_jour',nom:'PREMIER JOUR',famille:'assiette',palier:null,icone:'assiette_premier_jour',condition:'Tiens ta cible une journée.',test:f=>_bdgNieme(f.assiette.jours,1),
   phrase:'Une journée entière dans ta cible. La première.'},
  {id:'assiette_7',nom:'SEPT JOURS',famille:'assiette',palier:null,icone:'assiette_7',condition:'Tiens ta cible 7 jours d’affilée.',test:f=>_bdgNieme(f.assiette.serie,7),
   phrase:'Sept jours d’affilée dans ta cible. Un écart par semaine ne casse rien.'},
  {id:'assiette_21',nom:'VINGT ET UN',famille:'assiette',palier:null,icone:'assiette_21',condition:'Tiens ta cible 21 jours d’affilée.',test:f=>_bdgNieme(f.assiette.serie,21),
   phrase:'Vingt et un jours : c’est là que ça devient une habitude.'},
  {id:'assiette_100',nom:'CENT JOURS',famille:'assiette',palier:null,icone:'assiette_100',condition:'100 jours dans ta cible en un an.',test:f=>f.assiette.annee100},
  {id:'assiette_proteines',nom:'PROTÉINES',famille:'assiette',palier:null,icone:'assiette_proteines',condition:'Atteins tes protéines 30 jours.',test:f=>_bdgNieme(f.assiette.prot,30)},
  // ── L'ARBRE DES TRACTIONS (09/10/2026) : nœuds validés ─────────────
  {id:'arbre_5',nom:'MI-HAUTEUR',famille:'arbre',palier:null,icone:'arbre_5',condition:'Valide 5 nœuds de l’arbre des tractions.',test:f=>_bdgNieme(f.arbre,5),
   phrase:'Cinq nœuds de l’arbre des tractions. La barre devient un terrain connu.'},
  {id:'arbre_10',nom:'ARBRE COMPLET',famille:'arbre',palier:null,icone:'arbre_10',condition:'Valide les 10 nœuds de l’arbre des tractions.',test:f=>_bdgNieme(f.arbre,10),
   phrase:'L’arbre entier, jusqu’au muscle-up.'},
  // ── LES SECRETS : heure et date LOCALES de l'appareil ───────────────
  {id:'aube',nom:'AUBE',famille:'secret',palier:null,icone:'aube',condition:'Lance une séance avant 6 h du matin.',indice:'Le fer est plus froid avant le lever du jour.',test:f=>f.aube},
  {id:'nuit',nom:'NUIT',famille:'secret',palier:null,icone:'nuit',condition:'Termine une séance après 23 h.',indice:'Certains s’entraînent quand la ville dort.',test:f=>f.nuit},
  {id:'nouvel_an',nom:'NOUVEL AN',famille:'secret',palier:null,icone:'nouvel_an',condition:'Entraîne-toi un 1er janvier.',indice:'La première résolution tenue de l’année.',test:f=>f.nouvelAn},
  {id:'noel',nom:'NOËL',famille:'secret',palier:null,icone:'noel',condition:'Entraîne-toi un 25 décembre.',indice:'Un cadeau que personne d’autre ne t’offrira.',test:f=>f.noel},
  {id:'tempete',nom:'TEMPÊTE',famille:'secret',palier:null,icone:'tempete',condition:'Bats 3 records dans une même séance.',indice:'Quand ça tombe, ça tombe en rafale.',test:f=>f.tempete},
  {id:'foudre_serie',nom:'FOUDRE EN SÉRIE',famille:'secret',palier:null,icone:'foudre_serie',condition:'Bats au moins un record sur 3 séances d’affilée.',indice:'La foudre frappe parfois trois fois au même endroit.',test:f=>f.foudreSerie},
  {id:'phenix',nom:'PHÉNIX NOIR',famille:'secret',palier:null,icone:'phenix',condition:'Reviens après 30 jours d’arrêt, puis valide 4 semaines.',indice:'Ce qui tombe peut renaître.',test:f=>f.phenix},
  {id:'palindrome',nom:'PALINDROME',famille:'secret',palier:null,icone:'palindrome',condition:'Soulève un tonnage de séance palindrome, 10 000 kg ou plus.',indice:'Un tonnage qui se lit dans les deux sens.',test:f=>f.palindrome},
  {id:'vendredi13',nom:'VENDREDI 13',famille:'secret',palier:null,icone:'vendredi13',condition:'Entraîne-toi un vendredi 13.',indice:'Il y a des jours où l’on ne croit pas à la chance.',test:f=>f.vendredi13},
  {id:'centurion',nom:'CENTURION',famille:'secret',palier:null,icone:'centurion',condition:'Valide 100 séries dans la même semaine.',indice:'Cent, sans compter.',test:f=>f.centurion}
].map(b=>Object.freeze(Object.assign({
  // Les champs des anciens appelants, dérivés quand l'entrée ne les écrit pas.
  // « Assidu III », « Aube » : la casse d'une phrase, le chiffre romain intact.
  lib:(b.palier
    ?(b.nom.replace(/ [IV]+$/,'').toLowerCase().replace(/^./,c=>c.toUpperCase())+' '+BADGE_ROMAINS[b.palier-1])
    :b.nom.toLowerCase().replace(/^./,c=>c.toUpperCase())),
  phrase:b.famille==='secret'?('Badge secret débloqué : '+b.condition.replace(/\.$/,'').toLowerCase()+'.'):b.condition,
  attendu:b.condition,indice:null,inactif:null
},b))));
// La date du 500e inscrit (ms), à poser le jour où il arrive. D'ici là,
// FONDATEUR n'est attribué à personne : mieux vaut le donner en retard que le
// donner au 501e.
const FONDATEUR_LIMITE=0;
// Les familles, pour la vitrine : le nom sans chiffre romain, les seuils, et
// comment dire ce qui reste. `valeur(f)` lit la MÊME source que les tests.
const BADGE_FAMILLES=Object.freeze([
  {cle:'assidu',nom:'ASSIDU',seuils:[10,50,100,250],valeur:f=>f.seances.length,reste:n=>n+' séance'+(n>1?'s':'')},
  {cle:'inarretable',nom:'INARRÊTABLE',seuils:[4,12,26,52],valeur:f=>f.serieCourante,reste:n=>n+' semaine'+(n>1?'s':'')+' d’affilée'},
  {cle:'briseur',nom:'BRISEUR DE RECORDS',seuils:[5,25,50,100],valeur:f=>f.records.length,reste:n=>n+' record'+(n>1?'s':'')},
  {cle:'tonnage',nom:'TONNAGE',seuils:[10,100,500,1000],valeur:f=>Math.floor(f.tonnageTotal/100)/10,
   reste:n=>String(Math.ceil(n*10)/10).replace('.',',')+' t'},
  {cle:'sans_faute',nom:'SANS FAUTE',seuils:[4,12,26,52],valeur:f=>f.sansFaute.length,reste:n=>n+' semaine'+(n>1?'s':'')+' à 100 %'},
  {cle:'miroir',nom:'MIROIR',seuils:[3,10,25,50],valeur:f=>f.bilans.length,reste:n=>n+' bilan'+(n>1?'s':'')},
  {cle:'cycles',nom:'CYCLES',seuils:[1,3,6,12],valeur:f=>f.cycles.length,reste:n=>n+' cycle'+(n>1?'s':'')},
  {cle:'carburant',nom:'CARBURANT',seuils:[7,30,90,365],valeur:f=>f.journal.length,reste:n=>n+' jour'+(n>1?'s':'')+' de journal'}
]);
// Le visuel de REPLI d'un badge dont le dessin n'est pas encore déposé : un
// des quinze médaillons de fin de séance, choisi par le sens. Un badge obtenu
// n'est jamais montré sans image.
const BADGE_REPLI=Object.freeze({
  assidu:'DISCIPLINE',inarretable:'STREAK',briseur:'NEW_RECORD',tonnage:'HIGH_VOLUME',
  sans_faute:'PERFECT',miroir:'PROGRESSION',cycles:'FULL_SESSION',carburant:'MONSTER',
  'premiere-seance':'NEW_LOAD','semaine-validee':'FULL_SESSION','premier-record':'NEW_RECORD',
  'premier-bilan':'PROGRESSION',fondateur:'PERSONAL_BEST',recruteur:'MULTIPLE_RECORDS',
  mentor:'MULTIPLE_RECORDS',champion:'NO_MERCY',parcours_sous_tension:'FULL_SESSION',sept_sur_sept:'STREAK',promu:'PROGRESSION',sommet:'PERSONAL_BEST',aube:'NEW_PERF',nuit:'NEW_PERF',
  nouvel_an:'MONSTER',noel:'MONSTER',tempete:'NEW_PERF',foudre_serie:'NEW_PERF',
  phenix:'RETURN',palindrome:'NO_FAIL',vendredi13:'NO_MERCY',centurion:'HIGH_VOLUME',
  assiette:'FULL_SESSION',assiette_premier_jour:'FULL_SESSION',assiette_7:'STREAK',assiette_21:'DISCIPLINE',
  assiette_100:'PERFECT',assiette_proteines:'NO_FAIL',
  arbre:'PERSONAL_BEST',arbre_5:'PROGRESSION',arbre_10:'PERSONAL_BEST'
});
// L'ancien nom de la table : les cinq d'origine gardent leur médaillon.
const BADGE_ACQUIS_IMG=Object.freeze({
  'premiere-seance':'NEW_LOAD','semaine-validee':'FULL_SESSION','premier-record':'NEW_RECORD',
  'premier-bilan':'PROGRESSION','quatre-semaines':'STREAK'
});
// Le visuel dessiné (webp, 184×200), posé par scripts/badges.py.
function badgeVisuel(id,grand){
  const b=badgeAcquisDef(id); if(!b) return '';
  return BADGE_IMG_DOSSIER+b.icone+(grand?'-512':'')+'.webp';
}
// Le médaillon de repli, qui existe toujours.
function badgeAcquisFichier(id){
  const b=badgeAcquisDef(id); if(!b) return '';
  const k=BADGE_ACQUIS_IMG[id]||BADGE_REPLI[id]||BADGE_REPLI[b.famille];
  return k?_badgeFichier(k):'';
}
const BADGE_VERROU='img/badges/verrouille.webp';
// Une balise <img> qui tente le visuel dessiné et retombe sur le médaillon :
// la collection s'affiche complète même avant que les cinquante soient là.
//
// UN VISUEL TOMBÉ N'EST PLUS REDEMANDÉ (05/10/2026) : la collection repeint
// ses cinquante médaillons à chaque ouverture, et chaque visuel dessiné encore
// absent repartait en 404 — autant d'erreurs dans la console, à chaque fois.
// Le premier échec est retenu (pour la session) ; ensuite, le repli d'emblée.
const _badgesEnEchec=new Set();
function _badgeEchec(img,vis,repli){
  try{ _badgesEnEchec.add(String(vis)); }catch(e){}
  img.onerror=null;
  if(repli) img.src=repli;
}
function _htmlBadgeImg(id,o){
  o=o||{};
  const vis=o.verrou?BADGE_VERROU:badgeVisuel(id,o.grand);
  const repli=badgeAcquisFichier(id);
  const echec=_badgesEnEchec.has(String(vis))&&!!repli;
  return '<img src="'+escapeHtml(echec?repli:vis)+'" alt="" loading="lazy"'+(o.id?' id="'+o.id+'"':'')
    +(echec?'':' onerror="_badgeEchec(this,'+jsArg(vis)+','+jsArg(repli)+')"')+'>';
}
function badgeAcquisDef(id){ return BADGES_ACQUIS.find(b=>b&&b.id===id)||null; }
function _bdgNieme(l,n){ return (Array.isArray(l)&&l.length>=n)?(Number(l[n-1])||0):0; }
function _bdgInactif(b){ try{ return !!(b.inactif&&b.inactif()); }catch(e){ return true; } }

// PURE. LES FAITS, tirés une fois de l'historique. Chaque liste est TRIÉE et
// porte la date de chaque occurrence : la n-ième séance, le n-ième record, le
// n-ième jour de journal. Un palier se lit donc « quand a-t-on atteint N »,
// et c'est ce qui date correctement une rétro-attribution.
//
// L'HEURE EST CELLE DE L'APPAREIL (getHours, getDay, getDate), jamais UTC :
// « avant 6 h » veut dire 6 h là où l'athlète s'entraîne.
function _badgesFaits(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>0).slice().sort((a,b)=>a.date-b.date);
  let quota=1; try{ quota=seancesPrevuesParSemaine(u); }catch(e){ quota=1; }
  // f.seances : les séances qui COMPTENT (seanceComptee) — ASSIDU et le
  // parcours ne comptent pas un « Abandonner » à 0 série.
  const f={seances:ses.filter(seanceComptee).map(s=>s.date),records:[],semaines:[],sansFaute:[],
    bilans:[],cycles:[],journal:[],tonnageTotal:0,serieCourante:0,
    aube:0,nuit:0,nouvelAn:0,noel:0,tempete:0,foudreSerie:0,phenix:0,
    palindrome:0,vendredi13:0,centurion:0,fondateur:0,parcoursFini:0,septSurSept:0,promu:0,sommet:0,arbre:[]};
  try{ f.arbre=arbreDatesValidation(u).filter(d=>d<=t); }catch(e){ f.arbre=[]; }
  try{ const _lf=liguesFaits(u); f.promu=_lf.promu; f.sommet=_lf.sommet; }catch(e){}
  try{ f.septSurSept=missionSeptSurSept(u); }catch(e){ f.septSurSept=0; }
  const premier=(k,v)=>{ if(!f[k]) f[k]=v; };
  // Les séances passent dans l'ordre ; on retient au passage tout ce qui se
  // lit séance par séance.
  const meilleur={};                     // meilleure charge par exercice
  let volCumul=0, recSuite=0;
  const tonnages=[];                     // [seuil atteint → date]
  const semaine={};                      // lundi → {n, completes, series, derniere}
  for(const s of ses){
    const d=new Date(s.date);
    // Le début de séance : la fin moins la durée (minutes).
    const debut=new Date(s.date-(Number(s.duration)||0)*60000);
    if(debut.getHours()<6) premier('aube',s.date);
    // « Après 23 h » : de 23 h à 4 h du matin — minuit passé, c'est toujours
    // la même nuit.
    if(d.getHours()>=23||d.getHours()<4) premier('nuit',s.date);
    if(d.getMonth()===0&&d.getDate()===1) premier('nouvelAn',s.date);
    if(d.getMonth()===11&&d.getDate()===25) premier('noel',s.date);
    if(d.getDay()===5&&d.getDate()===13) premier('vendredi13',s.date);
    // Records de CHARGE : la charge maximale de la séance dépasse la
    // meilleure des séances précédentes. Même règle que recordsDeSeance (et
    // que « Mes records ») : un exercice fait pour la première fois n'est pas
    // un record, il n'y a rien à battre.
    const exos=_bdgExos(s);
    let nRec=0, nSeries=0, volCalc=0;
    for(const e of exos){
      let cur=0;
      for(const st of e.sets){
        if(!st||st.done===false) continue;
        const w=parseFloat(st.weight)||0, r=parseFloat(st.repsDone!=null?st.repsDone:st.reps)||0;
        if(st.done===true) nSeries++;
        if(w>cur) cur=w;
        volCalc+=w*r;
      }
      if(!cur) continue;
      const h=meilleur[e.cle]||0;
      if(h>0&&cur>h){ nRec++; f.records.push(s.date); }
      if(cur>h) meilleur[e.cle]=cur;
    }
    if(nRec>=3) premier('tempete',s.date);
    recSuite=nRec>0?recSuite+1:0;
    if(recSuite>=3) premier('foudreSerie',s.date);
    const vol=Number(s.volume)>0?Math.round(Number(s.volume)):Math.round(volCalc);
    if(vol>=10000&&String(vol)===String(vol).split('').reverse().join('')) premier('palindrome',s.date);
    volCumul+=vol;
    tonnages.push([volCumul,s.date]);
    let cle=0; try{ cle=_lundiDe(s.date).getTime(); }catch(e){ continue; }
    const w=semaine[cle]||(semaine[cle]={n:0,completes:true,series:0,derniere:0,validee:0});
    if(seanceComptee(s)) w.n++;
    w.derniere=s.date;
    w.series+=Number(s.sets)>0?Number(s.sets):nSeries;
    if(s.complete===false||(Number(s.setsPlanned)>0&&Number(s.sets)<Number(s.setsPlanned))) w.completes=false;
    if(!w.validee&&w.n>=quota) w.validee=s.date;
    if(w.series>=100) premier('centurion',s.date);
  }
  f.tonnageTotal=volCumul;
  f.tonnage=seuil=>{ for(const [v,d] of tonnages) if(v>=seuil) return d; return 0; };
  // LES SEMAINES : validée = le quota atteint dans la semaine calendaire
  // (lundi-dimanche, _lundiDe, la découpe de « Cette semaine »). À 100 % =
  // validée ET sans aucune séance partielle.
  const lundis=Object.keys(semaine).map(Number).sort((a,b)=>a-b);
  const serieDates=[];                   // n-ième semaine consécutive → date
  let suite=0, prec=null;
  for(const l of lundis){
    const w=semaine[l];
    if(!w.validee){ suite=0; prec=l; continue; }
    f.semaines.push(w.validee);
    if(w.completes) f.sansFaute.push(w.derniere);
    // Consécutive = la semaine calendaire d'avant était validée. Six ou huit
    // jours d'écart selon l'heure d'été : on compare les lundis au jour près.
    const suivante=prec!=null&&semaine[prec]&&semaine[prec].validee
      &&Math.round((l-prec)/864e5)===7;
    suite=suivante?suite+1:1;
    prec=l;
    if(!serieDates[suite-1]) serieDates[suite-1]=w.validee;
  }
  // La série EN COURS : celle de la dernière semaine validée, si elle n'est
  // pas rompue — la semaine courante ou la précédente.
  let courante=0;
  if(lundis.length){
    let lc=0; try{ lc=_lundiDe(t).getTime(); }catch(e){ lc=0; }
    const der=lundis[lundis.length-1];
    const ecart=Math.round((lc-der)/864e5);
    if(semaine[der].validee&&ecart<=7) courante=suite;
  }
  // LE COMPTEUR DU DOSSIER FAIT FOI AUSSI : streakSemaines porte le gel des
  // suspensions, que l'historique seul ne connaît pas. Un athlète à 4 dans
  // son compteur a mérité INARRÊTABLE I, même si ses séances ont été saisies
  // de façon irrégulière.
  let stocke=0; try{ stocke=streakSemaines(u)||0; }catch(e){ stocke=0; }
  f.serieCourante=Math.max(courante,stocke);
  f.serie=n=>serieDates[n-1]||(stocke>=n?Math.min(t,Number(u&&u.lastSession)||t):0);
  // PHÉNIX : un retour après 30 jours sans séance, puis 4 semaines validées
  // d'affilée à partir de la semaine du retour.
  for(let i=1;i<ses.length&&!f.phenix;i++){
    if(ses[i].date-ses[i-1].date<30*864e5) continue;
    let l0=0; try{ l0=_lundiDe(ses[i].date).getTime(); }catch(e){ continue; }
    let ok=0, d=0;
    for(let k=0;k<4;k++){
      const lk=_lundiDe(l0+k*7*864e5+36e5*12).getTime();
      const w=semaine[lk];
      if(!w||!w.validee) break;
      ok++; d=w.validee;
    }
    if(ok===4) f.phenix=d;
  }
  // Bilans, cycles de 28 jours (rites clôturés), jours de journal.
  f.bilans=((u&&u.bilans)||[]).filter(Boolean).map(b=>Number(b.date)||Number(b.at)||t).sort((a,b)=>a-b);
  f.cycles=((u&&u.rites)||[]).filter(r=>r&&r.date).map(r=>Number(r.date)).sort((a,b)=>a-b);
  const log=(((u&&u.nutrition)||{}).log)||{};
  f.journal=Object.keys(log).filter(j=>/^\d{4}-\d{2}-\d{2}$/.test(j)
      &&(((log[j]&&log[j].entries)||[]).length>0))
    .sort().map(j=>{ const [a,m,dd]=j.split('-').map(Number); return new Date(a,m-1,dd,20).getTime(); });
  const cree=Number(u&&u.createdAt)||0;
  if(FONDATEUR_LIMITE>0&&cree>0&&cree<=FONDATEUR_LIMITE) f.fondateur=cree;
  // Les filleuls au travail, datés (RECRUTEUR, MENTOR) ; les abonnés d'un miroir d'avant.
  const _pr=(u&&u.parrainage)||{};
  f.parrainages=(Array.isArray(_pr.actifsLe)?_pr.actifsLe:Array.isArray(_pr.payantsLe)?_pr.payantsLe:[])
    .map(Number).filter(x=>x>0).sort((a,b)=>a-b);
  // Le premier défi gagné (CHAMPION).
  const dr=(u&&u.defisReleves&&typeof u.defisReleves==='object')?Object.keys(u.defisReleves).map(k=>u.defisReleves[k]).filter(Boolean):[];
  const dc=dr.filter(x=>x.champion).map(x=>Number(x.fin)||Number(x.termineLe)||0).filter(x=>x>0).sort((a,b)=>a-b);
  f.champion=dc[0]||0;
  // Le parcours « Mise sous tension » : sa date de fin (jamais pour un compte existant).
  f.parcoursFini=(u&&u.parcours&&!u.parcours.existant&&Number(u.parcours.fini)>0)?Number(u.parcours.fini):0;
  // L'assiette (lot N4) : jours tenus, protéines, série, semaines.
  try{ f.assiette=_assietteFaits(u,t); }catch(e){ f.assiette={jours:[],prot:[],serie:[],annee100:0,semaines:[],tenus:{}}; }
  return f;
}
// Les exercices d'une séance, qu'elle soit écrite en `data` (nom → séries,
// la forme de finishWorkout) ou en `exercises` (la forme ancienne). La clé
// passe par les alias : un exercice renommé reste le même exercice.
function _bdgExos(s){
  const cle=nm=>{ try{ return resoudreAlias(exKey(nm)); }catch(e){ return String(nm); } };
  if(s&&s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
    return Object.keys(s.data).map(nm=>({cle:cle(nm),sets:((s.data[nm]||{}).sets)||[]}));
  return ((s&&s.exercises)||[]).filter(e=>e&&(e.name||e.nm))
    .map(e=>({cle:cle(e.name||e.nm),sets:e.sets||[]}));
}
// PURE. Les badges mérités, AVEC LA DATE où chacun l'a été — dans l'ordre de
// BADGES_ACQUIS. Un badge inactif n'est jamais rendu.
function badgesMeritesDates(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  let f; try{ f=_badgesFaits(u,t); }catch(e){ return []; }
  const out=[];
  for(const b of BADGES_ACQUIS){
    if(_bdgInactif(b)) continue;
    let at=0; try{ at=Number(b.test(f))||0; }catch(e){ at=0; }
    if(at>0) out.push({id:b.id,at:Math.min(at,t)});
  }
  return out;
}
// PURE. Les identifiants seuls — la forme d'origine, gardée pour ses appelants.
function badgesMerites(u,maintenant){
  return badgesMeritesDates(u,maintenant).map(x=>x.id);
}
// Les badges INSCRITS au dossier, dans l'ordre de BADGES_ACQUIS et non dans
// celui des clés d'un objet — l'ordre d'itération d'un objet reconstruit par
// le sync n'est pas celui de l'écriture.
function badgesObtenus(u){
  const m=(u&&u.badges&&typeof u.badges==='object')?u.badges:{};
  return BADGES_ACQUIS.filter(b=>m[b.id]&&m[b.id].at>0)
               .map(b=>({id:b.id,at:Number(m[b.id].at)||0}));
}
// ⚠ LE GARDE EST EN PREMIÈRE LIGNE, AVANT TOUTE ÉCRITURE.
//
// Sous suspension ou drapeau, RIEN ne se déclenche : ni la célébration, ni
// l'inscription au dossier. Fêter une série pendant qu'une douleur est
// déclarée, c'est applaudir précisément ce qu'on demande d'arrêter. Le
// critère, lui, ne s'efface pas : il se lit dans les données, et le badge
// tombera au prochain passage.
//
// LA DATE INSCRITE EST CELLE OÙ LE BADGE A ÉTÉ MÉRITÉ, lue dans l'historique
// — pas celle du passage. C'est ce qui rend à un athlète ancien, à la mise à
// jour, ses cinquante séances avec la date de la cinquantième.
function majBadges(o){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach') return [];
  try{ if(suspensionEtat(u).actif) return []; }catch(e){}
  try{ if(drapeauQuelconqueActif(u)) return []; }catch(e){}
  const deja=(u.badges&&typeof u.badges==='object')?u.badges:{};
  const t=Date.now();
  let merites=[]; try{ merites=badgesMeritesDates(u,t); }catch(e){ return []; }
  const nouveaux=merites.filter(x=>badgeAcquisDef(x.id)&&!(deja[x.id]&&deja[x.id].at>0));
  if(!nouveaux.length) return [];
  u.badges=deja;
  for(const x of nouveaux) u.badges[x.id]={at:(x.at>0?x.at:t)};
  try{ saveUser(); }catch(e){ rcErreurMuette('majBadges',e); }
  const neufs=nouveaux.map(x=>x.id);
  // LA CÉLÉBRATION : le plus rare de la séance a l'écran plein (BDG_ECRAN_MAX),
  // le reste va dans « Tes trophées du jour ». Au RATTRAPAGE (mise à jour),
  // le récapitulatif seul, sans foudre : un athlète ancien en reçoit parfois
  // vingt d'un coup — le détail attend dans le profil.
  try{ _celebrerBadges(neufs,!!(o&&o.rattrapage)); }catch(e){}
  return neufs;
}
// LE RATTRAPAGE À LA MISE À JOUR. Une fois par ouverture de l'accueil
// athlète, et une seule : c'est ce qui rend ses badges à un dossier ancien
// sans attendre sa prochaine séance. Il ne fête rien de nouveau — il ne peut
// rien arriver entre deux ouvertures qui n'ait déjà été attribué par la fin de
// séance ou le bilan — il rattrape.
let _badgesRattrapes=false;
function _rattraperBadges(){
  if(_badgesRattrapes) return [];
  _badgesRattrapes=true;
  try{ chargerStatsBadges(); }catch(e){}
  try{ return majBadges({rattrapage:true}); }catch(e){ return []; }
}
// ══ LA RARETÉ ══════════════════════════════════════════════════════════
//
// Comptée chaque nuit par la fonction planifiée statsBadges (functions/) et
// lue dans /stats/badges — lecture publique, sans jeton : ce ne sont que des
// pourcentages. Gardée en mémoire et sur l'appareil (un jour) : l'écran de
// célébration doit pouvoir l'afficher sans attendre le réseau, en salle.
//
// SANS DONNÉE, RIEN : pas de « 0 % », pas de tiret. La ligne n'existe pas.
const BADGE_STATS_URL='https://repcore-sync-default-rtdb.firebaseio.com/stats/badges.json';
const BADGE_STATS_CLE='rc_stats_badges';
let _statsBadges=null, _statsBadgesEnCours=null;
function _statsBadgesLocales(){
  if(_statsBadges) return _statsBadges;
  try{
    const x=JSON.parse(localStorage.getItem(BADGE_STATS_CLE)||'null');
    if(x&&x.d&&x.d.pct&&Number(x.d.total)>0) _statsBadges=x.d;
  }catch(e){}
  return _statsBadges;
}
// Rafraîchit au plus une fois par jour. Ne lève jamais, ne bloque rien.
function chargerStatsBadges(){
  if(_statsBadgesEnCours) return _statsBadgesEnCours;
  try{
    const x=JSON.parse(localStorage.getItem(BADGE_STATS_CLE)||'null');
    if(x&&x.t&&Date.now()-x.t<864e5&&x.d){ _statsBadges=x.d; return Promise.resolve(_statsBadges); }
  }catch(e){}
  if(typeof fetch!=='function') return Promise.resolve(_statsBadgesLocales());
  _statsBadgesEnCours=fetch(BADGE_STATS_URL,{cache:'no-store'})
    .then(r=>r.ok?r.json():null)
    .then(d=>{
      if(d&&d.pct&&typeof d.pct==='object'&&Number(d.total)>0){
        _statsBadges=d;
        try{ localStorage.setItem(BADGE_STATS_CLE,JSON.stringify({t:Date.now(),d})); }catch(e){}
      }
      return _statsBadgesLocales();
    })
    .catch(()=>_statsBadgesLocales())
    .finally(()=>{ _statsBadgesEnCours=null; });
  return _statsBadgesEnCours;
}
// PURE. La ligne de rareté, ou '' sans donnée. `stats` facultatif (tests).
function badgeRareteTexte(id,stats){
  const s=stats||_statsBadgesLocales();
  if(!s||!s.pct||!(Number(s.total)>0)) return '';
  const p=Number(s.pct[id]);
  // Des stats existent mais ce badge n'y figure pas : personne ne l'avait
  // la nuit dernière. C'est une information, et c'est la plus rare.
  const v=Number.isFinite(p)?p:0;
  if(v<1) return 'Moins de 1 % des athlètes le possèdent';
  const txt=(v<10?String(Math.round(v*10)/10):String(Math.round(v))).replace('.',',');
  return 'Possédé par '+txt+' % des athlètes';
}
// PURE. « PALIER III », ou '' pour un badge sans palier.
function badgePalierTexte(b){
  return (b&&b.palier)?('PALIER '+BADGE_ROMAINS[b.palier-1]):'';
}
// L'événement : palier IV et secrets ont droit à la version longue.
function _bdgLong(b){ return !!b&&(b.palier===4||b.famille==='secret'); }

// ══ L'ÉCRAN DE CÉLÉBRATION ═════════════════════════════════════════════
//
// Il remplace le bandeau #bdg-fete : un badge est un événement rare, il a
// droit à l'écran entier. Fond noir, la foudre frappe le centre, le médaillon
// apparaît DANS le flash en tournant sur lui-même, un halo rouge, une
// vibration. Palier IV et secrets : la rotation dure plus longtemps, et des
// arcs électriques tournent autour du médaillon pendant deux secondes.
//
// PLUSIEURS ÉVÉNEMENTS : UN SEUL écran plein, le plus rare (bdgRarete) ; les
// autres dans le carrousel « Tes trophées du jour » sous l'écran de fin.
// Chaque badge reste partageable depuis sa fiche dans « Mes badges ».
//
// LE RATTRAPAGE (mise à jour) ne joue que le récapitulatif, sans foudre :
// vingt badges d'un historique ancien ne sont pas vingt événements d'aujourd'hui.
//
// ⚠ CE N'EST PLUS UN BANDEAU SANS CONSÉQUENCE : l'écran prend la main, et
// c'est voulu. Il se ferme par « Plus tard », par Échap, et il n'arrive
// jamais PENDANT une série : majBadges n'est appelée qu'en fin de séance, en
// fin de bilan et à l'ouverture de l'accueil.
// ══ UN SEUL ÉCRAN PLEIN PAR SÉANCE (28/09/2026) ═══════════════════════
// Une séance peut tout débloquer d'un coup : un palier de série, trois
// badges, un rang, un défi. Cinq écrans à la file, cinq foudres, et plus
// rien ne se lit. Ce qui arrive ensemble (la file _bdgFile se remplit dans
// la même seconde : updateStreak, majBadges, majXp) est donc CLASSÉ PAR
// RARETÉ (bdgRarete) : le plus rare a l'écran plein et la foudre ; le reste
// part dans le carrousel « Tes trophées du jour », sous l'écran de fin
// (vignettes, Partager, fiche au toucher), sans foudre.
// UNE VAGUE dure deux minutes : ce qui arrive juste après le premier écran
// (un rang calculé un peu plus tard) rejoint le carrousel au lieu d'ouvrir
// un second écran.
// LES RATTRAPAGES (mise à jour, badges d'un historique ancien) : un seul
// récapitulatif, sans foudre.
// LE RÉGLAGE « Célébrations : discrètes » : aucun écran plein, tout dans le
// carrousel.
const BDG_ECRAN_MAX=1;
const BDG_VAGUE_MS=120e3;
let _bdgFile=[], _bdgRecap=[], _bdgArcsRaf=null;
let _bdgTrophees=[], _bdgVague={debut:0,ecrans:0}, _bdgCalme=false;
// Point d'entrée. `ids` dans l'ordre de BADGES_ACQUIS ; `recapSeul` pour le
// rattrapage.
function _celebrerBadges(ids,recapSeul){
  const l=(ids||[]).filter(id=>badgeAcquisDef(id));
  if(!l.length) return;
  try{ chargerStatsBadges(); }catch(e){}
  // À LA SUITE de ce qui attend déjà (un palier de série, par exemple) : le
  // classement se fait au moment d'afficher, sur tout ce qui est arrivé.
  if(recapSeul) _bdgRecap=_bdgRecap.concat(l); else _bdgFile=_bdgFile.concat(l);
  // Le délai laisse l'écran de fin de séance se poser : deux mouvements en
  // même temps ne se lisent ni l'un ni l'autre.
  _bdgPlanifier();
}
// L'ancien nom, gardé pour ses appelants : un badge seul.
function _celebrerBadge(id){ _celebrerBadges([id]); }
/** 'completes' (défaut) ou 'discretes' : le réglage du profil. */
function celebrationsMode(u){ return (u&&u.celebrations==='discretes')?'discretes':'completes'; }
/**
 * PURE (stats données). LA RARETÉ d'un événement de la file, de 0 à 100.
 * Un secret découvert, puis un rang (plus il est haut, plus il est rare), un
 * palier IV, les longues séries, CHAMPION ; un badge dont on connaît la
 * rareté réelle (/stats/badges) est classé par elle, dans les bornes de son
 * palier.
 */
function bdgRarete(x,stats){
  if(x&&typeof x==='object'){
    if(x.rang) return Math.min(99,88+Number(x.rang));
    if(x.serie){ const n=Number(x.serie); return n>=52?92:n>=26?82:n>=12?68:n>=8?56:44; }
    // Le retour au combat passe devant les paliers : il n'arrive qu'après une absence.
    if(x.retour) return 90;
    if(x.sous) return 30;
    if(x.defi){ const r=(typeof currentUser!=='undefined'&&currentUser&&currentUser.defisReleves||{})[x.defi]; return r&&r.champion?84:60; }
    return 0;
  }
  const b=badgeAcquisDef(x);
  if(!b) return 0;
  if(b.famille==='secret') return 100;
  // Le badge du parcours ne se gagne qu'une fois dans une vie de compte : il
  // passe devant un palier, derrière un secret.
  if(b.id===PARCOURS_BADGE) return 95;
  const base=b.palier?[0,30,42,58,86][b.palier]:50;
  const s=stats||null;
  const p=s&&s.pct&&Number(s.total)>0?Number(s.pct[x]):NaN;
  if(!isFinite(p)) return base;
  // La rareté réelle ajuste, sans faire passer un palier I devant un palier IV.
  return Math.max(base-12,Math.min(base+12,Math.round(100-p)));
}
/** PURE. La file triée : le plus rare d'abord, l'ordre d'arrivée à égalité. */
function bdgPrioriser(items,stats){
  return (items||[]).map((x,i)=>({x,i,r:bdgRarete(x,stats)})).sort((a,b)=>b.r-a.r||a.i-b.i).map(o=>o.x);
}
/** PURE. {ecrans, trophees} : `dejaMontres` écrans pleins déjà vus dans la vague. */
function bdgRepartir(items,mode,dejaMontres,stats){
  const p=bdgPrioriser(items,stats);
  const n=mode==='discretes'?0:Math.max(0,BDG_ECRAN_MAX-(Number(dejaMontres)||0));
  return {ecrans:p.slice(0,n),trophees:p.slice(n)};
}
// Série 7 (lot 7) : l'écran de fin est affiché et « Enregistrer » pas encore touché.
function finAttendEnregistrement(){
  if(!window._finEnAttente) return false;
  const z=document.getElementById('s-workout-done');
  return !!(z&&z.classList.contains('active'));
}
function _bdgAfficher(x,reste){
  if(typeof seanceAEcran==='function'&&seanceAEcran()){ _bdgRecap=_bdgRecap.concat([x]); return false; }
  // Série 7 (lot 7) : sur l'écran de fin, rien avant « Enregistrer ».
  if(finAttendEnregistrement()){ _bdgFile=[x].concat(_bdgFile); try{ _bdgVague.ecrans=Math.max(0,_bdgVague.ecrans-1); }catch(e){} return false; }
  if(x&&typeof x==='object'&&x.retour) _retourEcran(x.retour,reste);
  else if(x&&typeof x==='object'&&x.serie) _serieEcran(x.serie,reste);
  else if(x&&typeof x==='object'&&x.rang) _rangEcran(x.rang,reste);
  else if(x&&typeof x==='object'&&x.defi) _defiEcran(x.defi,reste);
  else _bdgEcran(x,reste);
}
function _bdgSuivant(){
  _bdgFermerEcran(true);
  _bdgCalme=false;
  if(_bdgFile.length){
    const t=Date.now();
    if(t-_bdgVague.debut>BDG_VAGUE_MS) _bdgVague={debut:t,ecrans:0};
    let st=null; try{ st=_statsBadgesLocales(); }catch(e){ st=null; }
    const r=bdgRepartir(_bdgFile,celebrationsMode(typeof currentUser!=='undefined'?currentUser:null),_bdgVague.ecrans,st);
    _bdgFile=[];
    if(r.trophees.length) _bdgAjouterTrophees(r.trophees);
    if(r.ecrans.length){ _bdgVague.ecrans++; _bdgAfficher(r.ecrans[0],0); return; }
  }
  if(_bdgRecap.length){ const r=_bdgRecap; _bdgRecap=[]; _bdgEcranRecap(r); }
}
// La foudre des écrans de célébration — sauf quand l'écran est rouvert
// depuis le carrousel (la fiche : on relit, on ne refête pas).
function _bdgFoudre(el,o){ if(_bdgCalme) return null; return rcFoudre(el,o); }
// ── Le carrousel « Tes trophées du jour » ─────────────────────────────────
// Sous l'écran de fin de séance (après les volts). Ailleurs (l'accueil, un
// résultat de défi arrivé du serveur), le récapitulatif, sans foudre.
function _bdgAjouterTrophees(items){
  const ancre=document.getElementById('wd-volts');
  const finVisible=!!(ancre&&ancre.isConnected&&ancre.closest('.screen.active'));
  if(!finVisible){ _bdgRecap=_bdgRecap.concat(items); return false; }
  _bdgTrophees=_bdgTrophees.concat(items);
  let z=document.getElementById('wd-trophees');
  if(!z){ z=document.createElement('div'); z.id='wd-trophees'; ancre.insertAdjacentElement('afterend',z); }
  z.innerHTML=htmlTropheesDuJour(_bdgTrophees);
  return true;
}
// PURE (sauf le dossier pour les défis). La vignette d'un trophée : {img, nom, sur}.
function tropheeVignette(x,u){
  if(x&&typeof x==='object'){
    if(x.serie) return {img:'<span class="tr-chiffre">'+Number(x.serie)+'</span>',nom:Number(x.serie)+' semaines',sur:'Palier de série'};
    if(x.retour) return {img:'<img src="'+escapeHtml(_badgeFichier('RETURN'))+'" alt="">',nom:'Retour au combat',sur:Number(x.retour.jours)+' jours d’absence'};
    if(x.sous) return {img:'<span class="tr-sous"><img src="'+rangEmbleme(x.sous.rang)+'" alt="" decoding="async">'+htmlChevrons(x.sous.n,'tr-chev')+'</span>',nom:String(x.sous.nom||''),sur:'Nouveau sous-niveau'};
    if(x.rang){ const r=RANGS[Math.max(0,Math.min(RANGS.length-1,Number(x.rang)-1))];
      return {img:'<img src="'+rangEmbleme(r.n)+'" alt="" data-rang="'+r.n+'" decoding="async">',nom:r.nom,sur:'Nouveau rang'}; }
    if(x.defi){ const res=((u&&u.defisReleves)||{})[x.defi]||{};
      return {img:'<span class="tr-chiffre">'+icon('eclair',14)+'</span>',nom:String(res.titre||'Défi'),sur:res.champion?'Champion':'Défi relevé'}; }
    return {img:'',nom:'',sur:''};
  }
  const b=badgeAcquisDef(x);
  return {img:b?_htmlBadgeImg(x):'',nom:b?b.nom:'',sur:b&&b.famille==='secret'?'Badge secret':'Badge'};
}
function htmlTropheesDuJour(items){
  const l=(items||[]);
  if(!l.length) return '';
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  return '<div class="tr-carrousel"><div class="tr-t">Tes trophées du jour <span class="bdg-compte">'+l.length+'</span></div>'
    +'<div class="tr-liste" role="list">'+l.map((x,i)=>{
      const v=tropheeVignette(x,u);
      return '<div class="tr-v" role="listitem">'
        +'<button type="button" class="tr-fiche" onclick="ouvrirTrophee('+i+')" aria-label="'+escapeHtml(v.sur+' : '+v.nom)+'">'
        +'<span class="tr-img">'+v.img+'</span><span class="tr-sur">'+escapeHtml(v.sur)+'</span><span class="tr-nom">'+escapeHtml(v.nom)+'</span></button>'
        +'<button type="button" class="tr-part" onclick="partagerTrophee('+i+',this)">'+icon('share',12)+' <span>Partager</span></button></div>';
    }).join('')+'</div></div>';
}
// LA FICHE, au toucher : celle du badge, ou l'écran du trophée SANS FOUDRE.
function ouvrirTrophee(i){
  const x=_bdgTrophees[i];
  if(x==null) return false;
  if(typeof x==='string') return ouvrirFicheBadge(x);
  _bdgFermerEcran(true);
  _bdgCalme=true;
  _bdgAfficher(x,0);
  return true;
}
// LE PARTAGE direct, depuis la vignette. SYNCHRONE jusqu'au partage (iOS).
function partagerTrophee(i,btn){
  const x=_bdgTrophees[i];
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(x==null||!u) return false;
  if(x&&typeof x==='object'&&x.serie){ _serieCourante=serieCarteDonnees(u,x.serie); return partagerSerie(btn); }
  if(x&&typeof x==='object'&&x.defi) return partagerDefi(x.defi,btn);
  if(_storyEnCours) return false;
  const v=btn&&btn.closest?btn.closest('.tr-v'):null;
  const img=v?v.querySelector('img'):null;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  let dessin=null, nom='';
  if(x&&typeof x==='object'&&x.rang){
    _rangCourant=rangCarteDonnees(u,x.rang);
    dessin=()=>_dessinerCarteRang(_rangCourant,fond,img&&img.complete&&img.naturalWidth?img:null);
    nom=visuelNomFichier('repcore-rang',fond);
  } else {
    if(!img||!img.complete||!img.naturalWidth){ toast('Le visuel se charge, réessaie dans un instant.','var(--orange)'); return false; }
    dessin=()=>_bdgCarteDe(x,fond,img);
    nom=visuelNomFichier('repcore-badge',fond);
  }
  _storyEnCours=true;
  let ok=false;
  try{ ok=_storySortirPartage(dessin(),nom,undefined,fmt)||_storySortirTelechargement(dessin(),nom,fmt); }
  catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ _texteIco(sp,'Prêt '+ICO.coche); setTimeout(()=>{ sp.textContent='Partager'; },2000); }
  return ok;
}
// ── Le réglage « Célébrations » (profil) ──────────────────────────────────
function htmlReglageCelebrations(u){
  if(!u||u.role==='coach') return '';
  const m=celebrationsMode(u);
  const b=(k,l,s)=>'<button type="button" class="cel-b'+(m===k?' actif':'')+'" role="radio" aria-checked="'+(m===k)+'" onclick="celebrationsChoisir(\''+k+'\')">'+l+'<small>'+s+'</small></button>';
  return '<div class="card cel-carte"><div class="pp-titre">Célébrations</div>'
    +'<div class="cel-choix" role="radiogroup" aria-label="Célébrations">'
    +b('completes','Complètes','Un écran plein pour le plus rare')
    +b('discretes','Discrètes','Tout dans « Tes trophées du jour »')
    +'</div></div>';
}
function celebrationsChoisir(k){
  const u=currentUser;
  if(!u||(k!=='completes'&&k!=='discretes')) return false;
  u.celebrations=k;
  try{ saveUser(); }catch(e){ rcErreurMuette('celebrationsChoisir',e); }
  for(const id of ['atp-celebrations','cr-celebrations']){ const z=document.getElementById(id); if(z) z.innerHTML=htmlReglageCelebrations(u); }
  return true;
}
function _bdgCouche(html,etiquette){
  const z=document.createElement('div');
  z.id='bdg-ecran'; z.className='bdg-ecran';
  z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true');
  z.setAttribute('aria-label',etiquette);
  z.innerHTML=html;
  document.body.appendChild(z);
  // ÉCHAP SUR L'ÉCRAN LUI-MÊME, et non sur document : le focus y est posé à
  // l'ouverture, et un écouteur global aurait avalé l'Échap des autres
  // écrans (l'éditeur de vidéo, les feuilles) tant qu'il restait branché.
  z.tabIndex=-1;
  z.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); _bdgSuivant(); } });
  return z;
}
function _bdgFermerEcran(tout_de_suite){
  if(_bdgArcsRaf){ cancelAnimationFrame(_bdgArcsRaf); _bdgArcsRaf=null; }
  const z=document.getElementById('bdg-ecran');
  if(!z) return;
  z.removeAttribute('id');
  try{ _visuelFondsMontes.delete('bdg-ecran-fonds'); }catch(e){}
  if(tout_de_suite||arcReduit()){ z.remove(); return; }
  const a=_animer(z,[{opacity:1},{opacity:0}],{duration:160,easing:'linear',fill:'forwards'});
  if(a) a.addEventListener('finish',()=>z.remove()); else z.remove();
}
// « Plus tard » : le badge suivant, ou le récapitulatif, ou rien.
function bdgPlusTard(){ _bdgSuivant(); return true; }
function _bdgEcran(id,reste){
  const b=badgeAcquisDef(id); if(!b) return _bdgSuivant();
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const m=(u&&u.badges)||{};
  const at=(m[id]&&m[id].at)||Date.now();
  const secret=b.famille==='secret';
  const long=_bdgLong(b);
  const rar=badgeRareteTexte(id);
  const pal=badgePalierTexte(b);
  const z=_bdgCouche(
    '<div class="bdg-ecran-scene"><canvas class="bdg-ecran-arcs" aria-hidden="true"></canvas>'
    +'<div class="bdg-ecran-med">'+_htmlBadgeImg(id,{grand:true,id:'bdg-ecran-img'})+'</div></div>'
    +'<div class="bdg-ecran-txt">'
    +'<div class="bdg-ecran-sur">'+(secret?'BADGE SECRET DÉCOUVERT':'BADGE DÉBLOQUÉ')+'</div>'
    +'<h2 class="bdg-ecran-nom">'+escapeHtml(b.nom)+'</h2>'
    +'<div class="bdg-ecran-meta">'+escapeHtml([pal,_bdgDate(at)].filter(Boolean).join(' · '))+'</div>'
    +'<div class="bdg-ecran-rar"'+(rar?'':' hidden')+'>'+escapeHtml(rar)+'</div>'
    // BUILD 1916 : la première séance s'adresse à quelqu'un, pas à un compte.
    +(id==='premiere-seance'
      ?'<p class="bdg-ecran-cond">'+escapeHtml(((String((u&&(u.pseudo||u.fname))||'').trim().split(/\s+/)[0])||'Toi')+', c’est parti.')+'</p>'
      :'<p class="bdg-ecran-cond">'+escapeHtml(b.condition)+'</p>')
    +_htmlVisuelFonds('bdg-ecran-fonds')
    +'<button type="button" class="btn btn-red bdg-ecran-part" onclick="partagerBadge(\''+id+'\',this)">'
      +icon('share',16)+' <span>Partager</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm bdg-ecran-tard" onclick="bdgPlusTard()">'
      +(reste||_bdgRecap.length?'Suivant':'Plus tard')+'</button>'
    +'</div>',
    secret?'Badge secret découvert : '+b.nom:'Badge débloqué : '+b.nom);
  if(long) z.classList.add('bdg-ecran-long');
  // La rareté arrive parfois APRÈS l'ouverture (premier chargement) : on la
  // pose alors, sans rien animer.
  if(!rar) chargerStatsBadges().then(()=>{
    const t=badgeRareteTexte(id), el=z.querySelector('.bdg-ecran-rar');
    if(t&&el&&z.isConnected){ el.textContent=t; el.hidden=false; }
  }).catch(()=>{});
  // Le sélecteur de fond : ses vignettes dessinent la vraie carte, qui a
  // besoin du médaillon chargé.
  const img=z.querySelector('#bdg-ecran-img');
  const monter=()=>{ try{ monterSelecteurFond('bdg-ecran-fonds',f=>_bdgCarteDe(id,f,img),null); }catch(e){} };
  if(img&&img.complete&&img.naturalWidth) monter(); else if(img) img.addEventListener('load',monter,{once:true});
  _bdgJouer(z,b,long);
  try{ const p=z.querySelector('.bdg-ecran-part'); if(p) p.focus({preventScroll:true}); }catch(e){}
}
// LA MISE EN SCÈNE. Durées : normale ~1,1 s, longue ~2,4 s (arcs compris).
function _bdgJouer(z,b,long){
  const med=z.querySelector('.bdg-ecran-med');
  const txt=z.querySelector('.bdg-ecran-txt');
  if(arcReduit()){
    // Rien ne tourne, rien ne frappe : le flash doux de rcFoudre et la
    // vibration, puis tout est là.
    try{ _bdgFoudre(med,{son:false}); }catch(e){}
    return;
  }
  _animer(z,[{opacity:0},{opacity:1}],{duration:120,easing:'linear'});
  // La foudre frappe le centre ; le médaillon naît dans le flash (t≈40 ms).
  try{ _bdgFoudre(med,{eclairs:long?3:2,conteneur:z}); }catch(e){}
  const tours=long?2:1, duree=long?1600:900;
  _animer(med,[
    {transform:'perspective(900px) rotateY('+(-360*tours-180)+'deg) scale(.25)',opacity:0,offset:0},
    {transform:'perspective(900px) rotateY(-120deg) scale(.9)',opacity:1,offset:.55},
    {transform:'perspective(900px) rotateY(12deg) scale(1.08)',opacity:1,offset:.85},
    {transform:'perspective(900px) rotateY(0deg) scale(1)',opacity:1,offset:1}
  ],{duration:duree,delay:40,easing:ARC.snap,fill:'backwards'});
  setTimeout(()=>{
    if(!z.isConnected) return;
    try{ arcGlow(med,{couleur:'rgba(224,32,32,.8)',duree:ARC.afterglow}); }catch(e){}
    try{ arcHaptique(long?'succes':'lourde'); }catch(e){}
  },40+duree*0.85);
  _animer(txt,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}],
    {duration:ARC.release,delay:long?1300:700,easing:ARC.discharge,fill:'backwards'});
  if(long) _bdgArcs(z,2000);
}
// LES ARCS QUI TOURNENT : trois arcs brisés sur un cercle autour du
// médaillon, retirés au hasard à chaque image (ils grésillent), qui tournent
// pendant `duree` ms puis s'éteignent en 300 ms. Mêmes trois passes que
// rcFoudre : halo rouge, trait rouge, cœur blanc.
function _bdgArcs(z,duree){
  const c=z.querySelector('.bdg-ecran-arcs'); if(!c||!c.getContext) return;
  const r=c.getBoundingClientRect();
  const dpr=Math.min(2,window.devicePixelRatio||1);
  c.width=Math.round(r.width*dpr); c.height=Math.round(r.height*dpr);
  const g=c.getContext('2d'); if(!g) return;
  g.setTransform(dpr,0,0,dpr,0,0);
  const W=r.width, H=r.height, cx=W/2, cy=H/2, R=Math.min(W,H)*0.44;
  const t0=performance.now();
  const image=now=>{
    if(!z.isConnected){ _bdgArcsRaf=null; return; }
    const t=now-t0;
    g.clearRect(0,0,W,H);
    if(t>duree+300){ _bdgArcsRaf=null; return; }
    const a=t<duree?1:1-(t-duree)/300;
    for(let k=0;k<3;k++){
      const debut=t/1000*2.4+k*Math.PI*2/3, long=0.9;
      const pts=[];
      for(let i=0;i<=14;i++){
        const th=debut+long*i/14, rr=R+(Math.random()*2-1)*R*0.07;
        pts.push([cx+Math.cos(th)*rr,cy+Math.sin(th)*rr]);
      }
      const trace=(w,st,al)=>{ g.globalAlpha=a*al; g.strokeStyle=st; g.lineWidth=w;
        g.beginPath(); g.moveTo(pts[0][0],pts[0][1]); for(const p of pts) g.lineTo(p[0],p[1]); g.stroke(); };
      g.save(); g.lineJoin='round'; g.lineCap='round';
      g.shadowColor=ROUGE_MARQUE; g.shadowBlur=24; trace(7,ROUGE_MARQUE,.5);
      g.shadowBlur=0; trace(3,ROUGE_MARQUE,1); trace(1.2,'#fff',1);
      g.restore();
    }
    _bdgArcsRaf=requestAnimationFrame(image);
  };
  _bdgArcsRaf=requestAnimationFrame(image);
}
// LE RÉCAPITULATIF : « Tu as débloqué N badges », leurs médaillons, et un
// seul bouton. Chacun reste partageable depuis sa fiche.
function _bdgEcranRecap(ids){
  if(finAttendEnregistrement()){ _bdgRecap=_bdgRecap.concat(ids||[]); return false; }
  // Série 7 (lot 2) : pas par-dessus une séance ; ils reviennent après.
  if(typeof seanceAEcran==='function'&&seanceAEcran()){ _bdgRecap=_bdgRecap.concat(ids||[]); return false; }
  // Série 6 (lot 13) : la visite ne fête pas l'historique d'un compte fictif.
  if(typeof RC_VISITE!=='undefined'&&RC_VISITE) return false;
  const n=ids.length;
  const vus=ids.slice(0,12);
  const z=_bdgCouche(
    '<div class="bdg-ecran-txt bdg-ecran-recap">'
    +'<div class="bdg-ecran-sur">'+(n>1?'NOUVEAUX BADGES':'NOUVEAU BADGE')+'</div>'
    +'<h2 class="bdg-ecran-nom">Tu as débloqué '+n+' badge'+(n>1?'s':'')+'</h2>'
    +'<div class="bdg-ecran-grille">'+vus.map(x=>{ const v=tropheeVignette(x,currentUser);
      return '<div>'+v.img+'<span>'+escapeHtml(v.nom)+'</span></div>'; }).join('')+'</div>'
    +(n>vus.length?'<div class="bdg-ecran-meta">et '+(n-vus.length)+' autre'+(n-vus.length>1?'s':'')+'</div>':'')
    +'<p class="bdg-ecran-cond">Retrouve-les dans ton profil, avec la date de chacun, et partage-les depuis leur fiche.</p>'
    +'<button type="button" class="btn btn-red bdg-ecran-tard" onclick="bdgPlusTard()">Voir plus tard</button>'
    +'</div>',
    'Tu as débloqué '+n+' badges');
  // SANS FOUDRE : un rattrapage n'est pas un événement d'aujourd'hui.
  if(!arcReduit()) _animer(z,[{opacity:0},{opacity:1}],{duration:160,easing:'linear'});
  try{ const p=z.querySelector('.bdg-ecran-tard'); if(p) p.focus({preventScroll:true}); }catch(e){}
}
// Le visuel de partage d'un badge, pour un fond : ce que dessinent les
// vignettes du sélecteur et ce que partage le bouton. Lit le DOSSIER pour la
// date et la signature, la mémoire pour la rareté.
function _bdgCarteDe(id,fond,img){
  const b=badgeAcquisDef(id); if(!b) return null;
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const m=(u&&u.badges)||{};
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  return _dessinerCarteBadge(b,(m[id]&&m[id].at)||Date.now(),img,fond,sig,badgeRareteTexte(id));
}
// PURE. L'état d'une famille : le palier atteint (0 à 4), la valeur, et ce
// qui reste pour le suivant.
function badgeFamilleEtat(fam,f,m){
  const ids=BADGES_ACQUIS.filter(b=>b.famille===fam.cle).sort((a,b)=>a.palier-b.palier);
  let atteint=0;
  ids.forEach((b,i)=>{ if(m[b.id]&&m[b.id].at>0) atteint=Math.max(atteint,i+1); });
  let v=0; try{ v=Number(fam.valeur(f))||0; }catch(e){ v=0; }
  const suivant=atteint<4?ids[atteint]:null;
  const seuil=atteint<4?fam.seuils[atteint]:null;
  const bas=atteint>0?fam.seuils[atteint-1]:0;
  const part=seuil?Math.max(0,Math.min(1,(v-bas)/(seuil-bas))):1;
  return {atteint,valeur:v,suivant,seuil,part,reste:seuil?Math.max(0,seuil-v):0,ids};
}
function _bdgDate(at){
  try{ return new Date(at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }
  catch(e){ return ''; }
}
// LA VITRINE. Un compteur global, puis une ligne par famille — le palier
// atteint et la barre vers le suivant —, les uniques, et les secrets en
// « ??? ». Montrer seulement les acquis répondrait à « qu'ai-je gagné » et
// jamais à « que reste-t-il », qui est la question qu'on se pose ici.
// Toucher un badge ouvre sa fiche.
function htmlMesBadges(u,maintenant){
  const m=(u&&u.badges&&typeof u.badges==='object')?u.badges:{};
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  let f=null; try{ f=_badgesFaits(u||{},t); }catch(e){ f=null; }
  const n=BADGES_ACQUIS.filter(b=>m[b.id]&&m[b.id].at>0).length;
  const a=id=>' onclick="ouvrirFicheBadge(\''+id+'\')" role="button" tabindex="0"';
  let h='<label style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1px;'
    +'text-transform:uppercase;display:block;margin-bottom:10px">Mes badges'
    +' <span class="bdg-compte"> : '+n+'/'+BADGES_ACQUIS.length+'</span></label>';
  // ── Les familles ───────────────────────────────────────────────────
  h+='<div class="bdg-fams">';
  for(const fam of BADGE_FAMILLES){
    const e=f?badgeFamilleEtat(fam,f,m):{atteint:0,part:0,reste:0,ids:BADGES_ACQUIS.filter(b=>b.famille===fam.cle)};
    const vitrine=e.atteint>0?e.ids[e.atteint-1]:e.ids[0];
    const texte=e.suivant
      ?('Encore '+fam.reste(e.reste)+' pour '+e.suivant.nom)
      :'Palier IV atteint';
    h+='<div class="bdg-fam"'+(e.atteint?'':' data-attente')+a(vitrine.id)+'>'
      +_htmlBadgeImg(vitrine.id)
      +'<div class="bdg-fam-c"><div class="bdg-fam-n">'+escapeHtml(fam.nom)
        +'<span class="bdg-fam-p">'+(e.atteint?BADGE_ROMAINS[e.atteint-1]:'-')+'</span></div>'
      +'<div class="bdg-barre" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
        +Math.round(e.part*100)+'"><span style="width:'+Math.round(e.part*100)+'%"></span></div>'
      +'<div class="bdg-fam-r">'+escapeHtml(texte)+'</div></div></div>';
  }
  h+='</div>';
  // ── Les uniques ────────────────────────────────────────────────────
  const cases=(liste,secret)=>liste.map(b=>{
    const g=m[b.id]&&m[b.id].at>0;
    const inactif=_bdgInactif(b);
    const nom=(secret&&!g)?'???':b.nom;
    const sous=g?_bdgDate(m[b.id].at):(secret?b.indice:(inactif?'Bientôt':b.condition));
    return '<div class="bdg-case"'+(g?'':' data-attente')+(secret&&!g?' data-secret':'')+a(b.id)+'>'
      +_htmlBadgeImg(b.id,{verrou:secret&&!g})
      +'<div class="bdg-nom">'+escapeHtml(nom)+'</div>'
      +'<div class="bdg-date">'+escapeHtml(sous||'')+'</div></div>';
  }).join('');
  // 4 PAR LIGNE POUR LES UNIQUES (8), 5 POUR LES SECRETS (10) : deux lignes
  // chacun, au lieu d'une colonne qui s'étirait (Kevin, 28/09/2026).
  h+='<div class="bdg-sous">Uniques</div><div class="bdg-grille bdg-grille-4">'
    +cases(BADGES_ACQUIS.filter(b=>b.famille==='unique'),false)+'</div>';
  // L'ASSIETTE (lot N4) : cinq cases, une ligne.
  h+='<div class="bdg-sous">Assiette</div><div class="bdg-grille bdg-grille-5 bdg-grille-assiette">'
    +cases(BADGES_ACQUIS.filter(b=>b.famille==='assiette'),false)+'</div>';
  h+='<div class="bdg-sous">Secrets</div><div class="bdg-grille bdg-grille-5">'
    +cases(BADGES_ACQUIS.filter(b=>b.famille==='secret'),true)+'</div>';
  // Les éditions : bouclées, en cours, et « Plus jamais disponible ».
  try{ h+=htmlEditions(u,_saisonsDuCache(),t); }catch(e){}
  h+=htmlDefisReleves(u);
  return h;
}
// PURE. LES BADGES « DÉFI RELEVÉ » : un par défi bouclé, daté, hors de la
// collection des cinquante (qui est fermée). Du plus récent au plus ancien.
function htmlDefisReleves(u){
  const m=(u&&u.defisReleves&&typeof u.defisReleves==='object')?u.defisReleves:{};
  const l=Object.keys(m).map(id=>Object.assign({id},m[id])).filter(x=>x&&x.titre!=null)
    .sort((a,b)=>(Number(b.fin)||0)-(Number(a.fin)||0));
  if(!l.length) return '';
  return '<div class="bdg-sous">Défis relevés <span class="bdg-compte">'+l.length+'</span></div><div class="dfr-liste">'
    +l.map(x=>'<button type="button" class="dfr-badge" onclick="partagerDefi(\''+escapeHtml(x.id)+'\',null)">'
      +'<span class="dfr-ico" aria-hidden="true">'+(x.champion?icon('trophy',14):icon('eclair',14))+'</span>'
      +'<span class="dfr-c"><b>'+escapeHtml(x.champion?'CHAMPION · ':'DÉFI RELEVÉ · ')+escapeHtml(defiMoisTexte(x.fin).replace(/^D’|^DE /,''))+'</b>'
      +'<span>'+escapeHtml(x.titre)+' · '+escapeHtml(_bdgDate(Number(x.termineLe)||Number(x.fin)))+'</span></span></button>').join('')+'</div>';
}
function _rendreMesBadges(){

  const z=document.getElementById('atp-badges'); if(!z) return;
  try{ z.innerHTML=htmlMesBadges(currentUser); }catch(e){ z.innerHTML=''; }
}
// ── LA FICHE D'UN BADGE ────────────────────────────────────────────────
// Le grand visuel, la date, la condition, et « Partager » quand il est obtenu.
// Un secret non obtenu reste un secret : « ??? », le cadenas et l'indice.
// Une feuille du bas, la même que les autres (modal-overlay / closeModal) :
// Échap et le voile la ferment.
function ouvrirFicheBadge(id){
  const b=badgeAcquisDef(id); if(!b) return false;
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const m=(u&&u.badges&&typeof u.badges==='object')?u.badges:{};
  const g=!!(m[id]&&m[id].at>0);
  const secret=b.famille==='secret'&&!g;
  let etat='';
  if(!g&&b.palier){
    try{
      const fam=BADGE_FAMILLES.find(x=>x.cle===b.famille);
      const e=badgeFamilleEtat(fam,_badgesFaits(u||{},Date.now()),m);
      if(e.suivant&&e.suivant.id===id) etat='Encore '+fam.reste(e.reste)+'.';
    }catch(e){ etat=''; }
  }
  if(!g&&_bdgInactif(b)) etat='Bientôt disponible.';
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="'+escapeHtml(secret?'Badge secret':b.nom)+'" class="bdg-fiche">'
  +'<div class="bdg-fiche-img'+(g?'':' attente')+'">'+_htmlBadgeImg(id,{grand:true,verrou:secret,id:'bdg-fiche-img'})+'</div>'
  +'<h2>'+escapeHtml(secret?'???':b.nom)+'</h2>'
  +(g?'<div class="bdg-fiche-date">Obtenu le '+escapeHtml(_bdgDate(m[id].at))+'</div>':'')
  +'<p>'+escapeHtml(secret?('Indice : '+b.indice):b.condition)+'</p>'
  +(etat?'<p class="bdg-fiche-etat">'+escapeHtml(etat)+'</p>':'')
  +(g&&badgeRareteTexte(id)?'<div class="bdg-fiche-rar">'+escapeHtml(badgeRareteTexte(id))+'</div>':'')
  +(g?_htmlVisuelFonds('bdg-fiche-fonds'):'')
  +(g?('<button type="button" class="btn btn-red" onclick="partagerBadge(\''+id+'\',this)">'
      +icon('share',16)+' <span>Partager</span></button>'):'')
  +'<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()" style="margin-top:8px">Fermer</button>'
  +'</div></div>');
  // Le sélecteur de fond dessine la vraie carte : il attend le médaillon.
  if(g){
    const img=document.getElementById('bdg-fiche-img');
    const monter=()=>{ try{ monterSelecteurFond('bdg-fiche-fonds',f=>_bdgCarteDe(id,f,img),null); }catch(e){} };
    if(img&&img.complete&&img.naturalWidth) monter(); else if(img) img.addEventListener('load',monter,{once:true});
  }
  try{ chargerStatsBadges(); }catch(e){}
  return true;
}
// LE VISUEL DE PARTAGE, 1080×1920, sur le modèle de la carte de record :
// mêmes outils d'écriture, même fond au choix, même signature. Le médaillon
// en géant, le nom, le palier, la rareté, la date. `img` est l'image DÉJÀ
// CHARGÉE (fiche ou écran de célébration) : le dessin est synchrone.
//
// ⚠ UN SECRET RÉVÈLE SON INDICE, JAMAIS SA CONDITION. La story est vue par
// des gens qui ne l'ont pas : leur donner la recette tuerait le secret.
function _dessinerCarteBadge(b,at,img,fond,signature,rarete,format){
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
  const secret=b&&b.famille==='secret';
  let y=post?100:250;
  g.textBaseline='alphabetic'; g.textAlign='center';
  o.ombre(true); g.fillStyle='#ffffff'; g.font='800 34px '+MONT;
  const sur=secret?'BADGE SECRET DÉCOUVERT':'BADGE DÉBLOQUÉ';
  const ss=o.ajusteEspace(sur,'800',34,MONT,10,LARG,22);
  g.font='800 '+ss+'px '+MONT;
  o.ecrireEspace(sur,cx,y,10,true);
  o.ombre(false);
  g.fillStyle=f==='rouge'?'rgba(255,255,255,.85)':ROUGE_MARQUE;
  g.fillRect(cx-44,y+20,88,5);
  y+=60;
  // LE MÉDAILLON GÉANT, 780 px, sans ombre de texte : il porte sa lueur.
  const T=post?560:780;
  if(img&&img.complete&&img.naturalWidth){
    const r=Math.min(T/img.naturalWidth,T/img.naturalHeight);
    const w=img.naturalWidth*r, h=img.naturalHeight*r;
    try{ g.drawImage(img,cx-w/2,y+(T-h)/2,w,h); }catch(e){}
  }
  y+=T+20;
  o.ombre(true); g.fillStyle='#ffffff';
  // Le nom SANS son chiffre romain : le palier a sa propre ligne.
  const nom=(b.palier?b.nom.replace(/ [IV]+$/,''):b.nom);
  const ns=o.ajuste(nom,'700',post?118:140,BEBAS,LARG,60);
  g.font='700 '+ns+'px '+BEBAS;
  o.ecrire(nom,cx,y+ns*0.8);
  y+=ns+10;
  const pal=badgePalierTexte(b);
  if(pal){
    g.fillStyle='#ffffff'; g.font='800 40px '+MONT;
    o.ecrireEspace(pal,cx,y+40,8,true);
    y+=76;
  }
  const ligne=secret?('Indice : '+(b.indice||'')):'';
  if(ligne){
    g.fillStyle='rgba(255,255,255,.9)';
    const cs=o.ajuste(ligne,'700',34,MONT,LARG,20);
    g.font='700 '+cs+'px '+MONT;
    o.ecrire(ligne,cx,y+cs);
    y+=cs+34;
  }
  if(rarete){
    g.fillStyle='rgba(255,255,255,.92)';
    const rs=o.ajuste(rarete,'700',32,MONT,LARG,20);
    g.font='700 '+rs+'px '+MONT;
    o.ecrire(rarete,cx,y+rs);
    y+=rs+30;
  }
  g.fillStyle='rgba(255,255,255,.82)'; g.font='700 30px '+MONT;
  o.ecrireEspace(_bdgDate(at),cx,y+30,4,true);
  _recSignature(g,o,String(signature||''),H-(post?50:120),LARG);
  o.ombre(false);
  return cv;
}
// Le partage : natif d'abord, téléchargement sinon, par les sorties communes
// qui copient le lien perso. SYNCHRONE jusqu'au partage (iOS).
function partagerBadge(id,btn){
  const b=badgeAcquisDef(id); if(!b) return false;
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const m=(u&&u.badges)||{};
  if(!(m[id]&&m[id].at>0)){ toast('Ce badge n’est pas encore obtenu.','var(--orange)'); return false; }
  if(_storyEnCours) return false;
  // L'image déjà chargée : celle de l'écran de célébration, sinon de la fiche.
  const img=document.getElementById('bdg-ecran-img')||document.getElementById('bdg-fiche-img');
  if(!img||!img.complete||!img.naturalWidth){ toast('Le visuel se charge, réessaie dans un instant.','var(--orange)'); return false; }
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-badge',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_bdgCarteDe(id,fond,img),nom,undefined,fmt)
      ||_storySortirTelechargement(_bdgCarteDe(id,fond,img),nom,fmt);
  }catch(e){
    toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false;
  }finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent='Partager'; },2000); }
  return ok;
}
// ══ L'ÉQUIVALENT FUN D'UN TONNAGE ═════════════════════════════════════════
//
// « 12 400 kg » ne se voit pas ; « 2 éléphants » si. La table est TRIÉE, du
// plus léger au plus lourd, et le choix tient en une règle : L'OBJET LE PLUS
// LOURD QUI DONNE AU MOINS 1. Le nombre tombe alors entre 1 et 20 — les
// écarts de la table ne dépassent jamais ×20, sauf entre la Statue de la
// Liberté et la tour Eiffel (×36) : entre 4,1 et 7,3 millions de kg, on
// garde la Statue, et le nombre dépasse 20. Arrondi au demi.
//
// Sous 2 kg (un demi-chat), rien : un « 0,5 chat » ne raconte rien.
const EQUIV_TONNAGE=Object.freeze([
  {kg:4,emoji:'🐈',un:'chat',plu:'chats'},
  {kg:75,emoji:'🧍',un:'humain',plu:'humains'},
  {kg:300,emoji:'🎹',un:'piano',plu:'pianos'},
  {kg:1200,emoji:'🚗',un:'voiture',plu:'voitures'},
  {kg:2300,emoji:'🦏',un:'rhinocéros',plu:'rhinocéros'},
  {kg:6000,emoji:'🐘',un:'éléphant',plu:'éléphants'},
  {kg:8000,emoji:'🦖',un:'T-Rex',plu:'T-Rex'},
  {kg:12000,emoji:'🚌',un:'bus',plu:'bus'},
  {kg:150000,emoji:'🐋',un:'baleine bleue',plu:'baleines bleues'},
  {kg:204000,emoji:'🗽',un:'Statue de la Liberté',plu:'Statues de la Liberté'},
  {kg:7300000,emoji:'🗼',un:'tour Eiffel',plu:'tours Eiffel'}
]);
/**
 * PURE. L'équivalent d'un tonnage, ou null sous 2 kg.
 * @param {number} kg
 * @returns {?{emoji:string,libelle:string,nombre:number,texte:string}}
 *   `libelle` est accordé au nombre (le pluriel à partir de 2, comme le veut
 *   le français : « 1,5 éléphant ») ; `texte` est la ligne prête à poser,
 *   « 2 éléphants ».
 */
function equivalentTonnage(kg){
  const v=Number(kg);
  if(!isFinite(v)||v<2) return null;
  let o=EQUIV_TONNAGE[0];
  for(const x of EQUIV_TONNAGE) if(v/x.kg>=1) o=x;
  const n=Math.max(0.5,Math.round(v/o.kg*2)/2);
  const libelle=n>=2?o.plu:o.un;
  return {emoji:o.emoji,libelle,nombre:n,texte:String(n).replace('.',',')+' '+libelle};
}
// ══════════════════ WRAPPED : LE MOIS, L'ANNÉE, EN CINQ HISTOIRES ══════════
//
// Le bilan d'une période, raconté comme une story : cinq slides plein écran,
// des chiffres qui montent, et un profil révélé par la foudre. Mensuel du 1er
// au 7 (sur le mois écoulé), annuel tout décembre (sur l'année qui s'achève).
//
// TOUT SE LIT DANS L'HISTORIQUE. calculerWrapped est PURE : elle ne tient
// aucun compteur, elle relit `sessions`, `badges` et `sessions_config`. Rien
// n'est enregistré au dossier — un Wrapped se recalcule à chaque ouverture,
// il ne peut donc jamais diverger de ce qui a été fait.
//
// L'HEURE EST CELLE DE L'APPAREIL, comme pour les badges secrets : « tu
// t'entraînes le mardi vers 18 h » veut dire 18 h là où l'athlète vit.
const WR_JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
// Les six profils. L'ORDRE EST LA PRIORITÉ : le premier dont la règle tient
// l'emporte. Des règles simples, dites en clair, et vérifiables par l'athlète
// sur ses propres chiffres — un profil qu'on ne comprend pas ne se partage pas.
const WR_PROFILS=Object.freeze([
  {cle:'revenant',nom:'Le Revenant',phrase:'Trois semaines d’arrêt ou plus, et tu es revenu. C’est le retour qui compte.',
   regle:w=>w._retour&&w.seances>=2},
  {cle:'records',nom:'La Machine à records',phrase:'Tu as battu tes charges plus souvent que la plupart ne s’entraînent.',
   regle:w=>w._records>=3&&w._records>=w.seances*0.5},
  {cle:'leve_tot',nom:'Le Lève-tôt',phrase:'La salle est à toi avant que la ville se réveille.',
   regle:w=>w.heureMoyenne&&w.heureMoyenne.minutes<9*60&&w._partMatin>=0.6},
  {cle:'metronome',nom:'Le Métronome',phrase:'Semaine après semaine, au rendez-vous. La régularité est une arme.',
   regle:w=>w._semaines>=2&&w._semainesValidees/w._semaines>=0.75},
  {cle:'volume',nom:'Le Volume',phrase:'Des tonnes, et encore des tonnes. Tu ne comptes pas, tu empiles.',
   regle:w=>w.seances>0&&w.tonnage/w.seances>=8000},
  {cle:'increvable',nom:'L’Increvable',phrase:'Rien ne t’arrête. Tu étais là, et tu as tenu.',
   regle:w=>w.seances>0}
]);
// Les exercices d'une séance, avec leur NOM d'affichage et leur clé
// d'identité (alias compris) : `data` (finishWorkout) ou `exercises`.
function _wrExos(s){
  const cle=nm=>{ try{ return resoudreAlias(exKey(nm)); }catch(e){ return String(nm); } };
  if(s&&s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
    return Object.keys(s.data).map(nm=>({nom:nm,cle:cle(nm),sets:((s.data[nm]||{}).sets)||[]}));
  return ((s&&s.exercises)||[]).filter(e=>e&&(e.name||e.nm))
    .map(e=>({nom:e.name||e.nm,cle:cle(e.name||e.nm),sets:e.sets||[]}));
}
/**
 * PURE. Le Wrapped de la période [debut, fin[ (ms). `maintenant` (facultatif)
 * borne le compte des semaines d'une période en cours (l'année en décembre).
 * @returns {{seances:number,tonnage:number,dureeTotale:number,
 *   meilleurRecord:?{nom:string,avant:number,apres:number,gain:number,date:number},
 *   muscleTop:?{cle:string,lib:string,series:number},
 *   jourPrefere:?{jour:number,lib:string,n:number},
 *   heureMoyenne:?{minutes:number,lib:string},
 *   serieMax:number,badgesGagnes:string[],
 *   profil:?{cle:string,nom:string,phrase:string},records:number}}
 */
function calculerWrapped(u,debut,fin,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const toutes=((u&&u.sessions)||[]).filter(s=>s&&s.date>0).slice().sort((a,b)=>a.date-b.date);
  const dans=s=>s.date>=debut&&s.date<fin;
  const ses=toutes.filter(dans);
  const w={seances:ses.filter(seanceComptee).length,tonnage:0,dureeTotale:0,meilleurRecord:null,muscleTop:null,
    jourPrefere:null,heureMoyenne:null,serieMax:0,badgesGagnes:[],profil:null,records:0};
  // LES RECORDS se jugent contre TOUT ce qui précède, période ou non : le
  // premier record de septembre bat peut-être une charge d'avril.
  const meilleur={};
  const muscles={}, jours=[0,0,0,0,0,0,0];
  let minutes=0, matin=0;
  for(const s of toutes){
    const inclus=dans(s);
    let vol=0;
    for(const e of _wrExos(s)){
      let cur=0, faites=0;
      for(const st of e.sets){
        if(!st||st.done===false) continue;
        const kg=parseFloat(st.weight)||0, r=parseFloat(st.repsDone!=null?st.repsDone:st.reps)||0;
        if(kg>cur) cur=kg;
        vol+=kg*r;
        if(st.done===true) faites++;
      }
      if(inclus&&cur>0){
        const h=meilleur[e.cle]||0;
        if(h>0&&cur>h){
          w.records++;
          const g=Math.round((cur-h)*100)/100;
          if(!w.meilleurRecord||g>=w.meilleurRecord.gain)
            w.meilleurRecord={nom:e.nom,avant:h,apres:cur,gain:g,date:s.date};
        }
      }
      if(cur>(meilleur[e.cle]||0)) meilleur[e.cle]=cur;
      if(inclus&&faites){
        let cls=null; try{ cls=resoudreMusclesLecture(e.nom,null,u); }catch(err){ cls=null; }
        if(cls&&cls!==VOL_CARDIO) for(const m of (cls.p||[])) muscles[m]=(muscles[m]||0)+faites;
      }
    }
    if(!inclus) continue;
    w.tonnage+=Number(s.volume)>0?Math.round(Number(s.volume)):Math.round(vol);
    w.dureeTotale+=Math.max(0,Number(s.duration)||0);
    const d=new Date(s.date-(Number(s.duration)||0)*60000);
    jours[new Date(s.date).getDay()]++;
    const mn=d.getHours()*60+d.getMinutes();
    minutes+=mn; if(mn<9*60) matin++;
  }
  // LE MUSCLE N°1 : le plus de séries validées en muscle PRINCIPAL.
  let top=null;
  for(const m in muscles) if(!top||muscles[m]>muscles[top]) top=m;
  if(top) w.muscleTop={cle:top,lib:(MUSCLES[top]&&MUSCLES[top].lib)||top,series:muscles[top]};
  // LE JOUR PRÉFÉRÉ : à égalité, le premier de la semaine (lundi d'abord).
  if(ses.length){
    let j=-1;
    for(const k of [1,2,3,4,5,6,0]) if(j<0||jours[k]>jours[j]) j=k;
    w.jourPrefere={jour:j,lib:WR_JOURS[j],n:jours[j]};
    const moy=Math.round(minutes/ses.length);
    w.heureMoyenne={minutes:moy,lib:Math.floor(moy/60)+' h '+String(moy%60).padStart(2,'0')};
  }
  // LA SÉRIE : semaines calendaires consécutives au quota, DANS la période.
  let quota=1; try{ quota=seancesPrevuesParSemaine(u); }catch(e){ quota=1; }
  const sem={};
  for(const s of ses){ let k=0; try{ k=_lundiDe(s.date).getTime(); }catch(e){ continue; } sem[k]=(sem[k]||0)+1; }
  const lundis=Object.keys(sem).map(Number).sort((a,b)=>a-b);
  let suite=0, prec=null, validees=0;
  for(const l of lundis){
    if(sem[l]<quota){ suite=0; prec=null; continue; }
    validees++;
    suite=(prec!=null&&Math.round((l-prec)/864e5)===7)?suite+1:1;
    prec=l;
    if(suite>w.serieMax) w.serieMax=suite;
  }
  // LES BADGES GAGNÉS dans la période, dans l'ordre de la collection.
  const b=(u&&u.badges&&typeof u.badges==='object')?u.badges:{};
  w.badgesGagnes=(typeof BADGES_ACQUIS!=='undefined'?BADGES_ACQUIS.map(x=>x.id):Object.keys(b))
    .filter(id=>b[id]&&b[id].at>=debut&&b[id].at<fin);
  // LES ÉDITIONS BOUCLÉES (02/10/2026) : saisons_resultats/<moi>/<id>, recopié
  // dans u.saisonsReleves, dont la fin tombe dans la période.
  const _rel=(u&&u.saisonsReleves&&typeof u.saisonsReleves==='object')?u.saisonsReleves:{};
  w.editions=Object.keys(_rel).filter(id=>{ const x=_rel[id], f=Number(x&&x.fin)||Number(x&&x.termineLe)||0; return f>=debut&&f<fin; })
    .sort((a,b)=>(Number(_rel[a].fin)||0)-(Number(_rel[b].fin)||0)).map(id=>String(_rel[id].nom||id).slice(0,60));
  // LE PROFIL. Les critères internes (préfixés _) servent aux règles puis
  // disparaissent : ils ne font pas partie de ce que la fonction promet.
  let nbSem=0;
  try{ nbSem=Math.max(1,Math.round((_lundiDe(Math.max(debut,Math.min(fin-1,t))).getTime()-_lundiDe(debut).getTime())/(7*864e5))+1); }
  catch(e){ nbSem=1; }
  const avant=toutes.filter(s=>s.date<debut);
  const retour=!!(ses.length&&avant.length&&ses[0].date-avant[avant.length-1].date>=21*864e5);
  const ctx=Object.assign({},w,{_records:w.records,_retour:retour,_partMatin:ses.length?matin/ses.length:0,
    _semaines:nbSem,_semainesValidees:validees});
  const p=WR_PROFILS.find(x=>{ try{ return !!x.regle(ctx); }catch(e){ return false; } });
  w.profil=p?{cle:p.cle,nom:p.nom,phrase:p.phrase}:null;
  return w;
}
// PURE. Les périodes offertes à l'instant `t` : le mois écoulé du 1er au 7,
// l'année qui s'achève tout décembre. Plus récente d'abord : en décembre,
// l'annuelle passe devant.
// BUILD 1921 : `u` (facultatif) ajoute la période « bloc » — voir wrappedBloc.
function wrappedPeriodes(t,u){
  const d=new Date(typeof t==='number'?t:Date.now());
  const out=[];
  // BUILD 1922 : l'ordre est la priorité — jalon, puis bloc, puis année, puis mois.
  if(u){ let j=null; try{ j=wrappedJalon(u,d.getTime()); }catch(e){ j=null; } if(j) out.push(j); }
  if(u){ let b=null; try{ b=wrappedBloc(u,d.getTime()); }catch(e){ b=null; } if(b) out.push(b); }
  if(d.getMonth()===11){
    const a=d.getFullYear();
    out.push({type:'annee',cle:'a-'+a,debut:new Date(a,0,1).getTime(),fin:new Date(a+1,0,1).getTime(),
      titre:'TON ANNÉE '+a,carte:'Ton année '+a+' est prête',lib:String(a)});
  }
  if(d.getDate()<=7){
    const dm=new Date(d.getFullYear(),d.getMonth()-1,1), fm=new Date(d.getFullYear(),d.getMonth(),1);
    let mois=''; try{ mois=dm.toLocaleDateString('fr-FR',{month:'long'}); }catch(e){ mois=''; }
    out.push({type:'mois',cle:'m-'+dm.getFullYear()+'-'+String(dm.getMonth()+1).padStart(2,'0'),
      debut:dm.getTime(),fin:fm.getTime(),titre:'TON MOIS DE '+mois.toUpperCase(),
      carte:'Ton mois de '+mois+' est prêt',lib:mois});
  }
  return out;
}
// ══ BUILD 1921 — LE WRAPPED D'UN BLOC ═════════════════════════════════════
// PURE. Le bloc d'entraînement qui vient de se terminer, offert pendant les
// 10 jours qui suivent sa fin prévue — s'il compte au moins 4 séances et n'a
// pas été INTERROMPU (aucun trou de plus de 14 jours sans séance entre son
// début et sa dernière séance). Sinon null.
const WR_BLOC_JOURS=10, WR_BLOC_SEANCES_MIN=4, WR_BLOC_TROU_J=14;
function wrappedBloc(u,t){
  let p=null; try{ p=programmeDe(u); }catch(e){ p=null; }
  if(!p) return null;
  const debut=p.debut, fin=debut+p.semaines*7*864e5;
  if(!(t>=fin&&t<fin+WR_BLOC_JOURS*864e5)) return null;
  const ts=s=>{ const v=s&&s.date; return /^\d{4}-\d{2}-\d{2}$/.test(String(v))?dateLocaleDeCle(v).getTime():(Number(v)||new Date(v).getTime()||0); };
  const dates=((u&&u.sessions)||[]).filter(s=>s&&s.complete!==false).map(ts).filter(x=>x>=debut&&x<fin).sort((a,b)=>a-b);
  if(dates.length<WR_BLOC_SEANCES_MIN) return null;
  let prec=debut;
  for(const x of dates){ if(x-prec>WR_BLOC_TROU_J*864e5) return null; prec=x; }
  const n=p.semaines;
  return {type:'bloc',cle:'b-'+localISODate(new Date(debut)),debut,fin,semaines:n,
    titre:'TON BLOC DE '+n+' SEMAINES',carte:'Ton bloc de '+n+' semaines est bouclé',lib:'bloc de '+n+' semaines',
    prevues:(()=>{ let q=0; try{ q=seancesPrevuesParSemaine(u); }catch(e){ q=0; } return Math.max(0,q)*n; })()};
}
// ══ BUILD 1922 — LES JALONS DE LA RELATION ═════════════════════════════════
// PURE. 30, 100 ou 365 jours depuis le rattachement au coach (rattacheLe,
// sinon coachSince, sinon createdAt), offerts du jour J au jour J+6, s'il y a
// eu au moins 4 séances depuis. Le plus grand jalon atteint gagne. Sinon null.
const JALONS_RELATION=Object.freeze([365,100,30]);
function debutRelation(u){
  return Number(u&&u.rattacheLe)||Number(u&&u.coachSince)||Number(u&&u.createdAt)||0;
}
function jalonRelation(u,maintenant){
  if(!u||!u.coachId) return null;
  const d0=debutRelation(u); if(!(d0>0)) return null;
  const t=Number(maintenant)||Date.now();
  const a=new Date(d0); a.setHours(0,0,0,0);
  const b=new Date(t); b.setHours(0,0,0,0);
  const jours=Math.round((b-a)/864e5);
  const J=JALONS_RELATION.find(x=>jours>=x&&jours<=x+6);
  if(!J) return null;
  const ts=s=>{ const v=s&&s.date; return /^\d{4}-\d{2}-\d{2}$/.test(String(v))?dateLocaleDeCle(v).getTime():(Number(v)||new Date(v).getTime()||0); };
  const n=((u.sessions)||[]).filter(s=>s&&s.complete!==false&&ts(s)>=d0).length;
  if(n<4) return null;
  return {jours:J,debut:d0,seances:n,cle:'j-'+J+'-'+localISODate(new Date(d0))};
}
function wrappedJalon(u,t){
  const j=jalonRelation(u,t); if(!j) return null;
  const nom=j.jours===365?'UN AN':j.jours+' JOURS';
  return {type:'jalon',cle:j.cle,debut:j.debut,fin:j.debut+(j.jours+7)*864e5,jours:j.jours,
    titre:nom+' AVEC TON COACH',carte:(j.jours===365?'Un an':j.jours+' jours')+' avec ton coach',lib:(j.jours===365?'un an':j.jours+' jours')};
}
// PURE. L'avant/après d'un jalon : le poids (sauf s'il est masqué), le meilleur
// gain de charge, le nombre de bilans. Des lignes, prêtes à afficher.
function lignesAvantApresJalon(u,debut,fin){
  const out=[];
  try{
    const bl=bilansOrdonnes(u).filter(b=>b.date>=debut-14*864e5&&b.date<fin);
    if(!u.masquerPoids&&bl.length>=2){ const a=getBW(bl[0]), b=getBW(bl[bl.length-1]);
      if(a!=null&&b!=null&&a!==b) out.push('Poids : '+_recKg(a)+' → '+_recKg(b)+' kg'); }
    const t=wrappedTop3(u,debut,fin)[0];
    if(t) out.push(t.nom+' : '+_recKg(t.de)+' → '+_recKg(t.a)+' kg');
    if(bl.length) out.push(bl.length+' bilan'+(bl.length>1?'s':''));
  }catch(e){}
  return out;
}
// PURE. Les trois exercices qui ont le plus gagné (charge max) entre la
// première et la dernière séance de la période où ils apparaissent.
function wrappedTop3(u,debut,fin){
  const ts=s=>{ const v=s&&s.date; return /^\d{4}-\d{2}-\d{2}$/.test(String(v))?dateLocaleDeCle(v).getTime():(Number(v)||new Date(v).getTime()||0); };
  const par={};
  ((u&&u.sessions)||[]).filter(s=>s&&s.complete!==false&&ts(s)>=debut&&ts(s)<fin).sort((a,b)=>ts(a)-ts(b)).forEach(s=>{
    Object.entries(s.data||{}).forEach(([nm,d])=>{
      let m=0; ((d&&d.sets)||[]).forEach(x=>{ if(x&&(x.done||x.horsCalcul)){ const kg=parseFloat(String(x.weight==null?'':x.weight).replace(',','.'))||0; if(kg>m) m=kg; } });
      if(!(m>0)) return;
      if(!par[nm]) par[nm]={nom:nm,de:m,a:m}; else par[nm].a=m;
    });
  });
  return Object.values(par).map(x=>Object.assign(x,{gain:x.a-x.de})).filter(x=>x.gain>0)
    .sort((a,b)=>b.gain-a.gain).slice(0,3);
}
// PURE. « 12,4 » t ou « 850 » kg : l'unité qui se lit.
function _wrTonnage(kg){
  if(kg>=1000){ const t=kg/1000; return {v:t<100?Math.round(t*10)/10:Math.round(t),u:'TONNES',dec:t<100?1:0}; }
  return {v:Math.round(kg),u:'KG',dec:0};
}
const _wrNb=(v,dec)=>{ const x=Number(v)||0;
  try{ return x.toLocaleString('fr-FR',{minimumFractionDigits:dec||0,maximumFractionDigits:dec||0}); }
  catch(e){ return String(x); } };
// PURE. Les cinq slides, en DONNÉES : l'écran et le dessin 1080×1920 lisent
// la même liste, et ne peuvent donc pas se contredire.
function wrappedSlides(w,per){
  const t=_wrTonnage(w.tonnage);
  // L'ÉQUIVALENT FUN : c'est sur un cumul de mois ou d'année qu'il frappe le
  // plus — 180 t, c'est une baleine bleue.
  const eq=equivalentTonnage(w.tonnage);
  const r=w.meilleurRecord;
  const nb=w.badgesGagnes.length;
  return [
    {k:'seances',sur:per.titre,grand:w.seances,dec:0,unite:w.seances>1?'SÉANCES':'SÉANCE',
     lignes:[fmtDureeHeures(w.dureeTotale)+' d’entraînement',
       w.seances?('soit '+fmtDureeHeures(Math.round(w.dureeTotale/w.seances))+' par séance'):'']},
    {k:'tonnage',sur:'TU AS SOULEVÉ',grand:t.v,dec:t.dec,unite:t.u,
     lignes:[eq?('= '+eq.texte+' '+eq.emoji):'',
       w.muscleTop?('Muscle n°1 : '+w.muscleTop.lib+' · '+w.muscleTop.series+' séries'):'']},
    {k:'records',sur:'RECORDS BATTUS',grand:w.records,dec:0,unite:w.records>1?'RECORDS':'RECORD',
     lignes:[r?(r.nom+' : '+_recKg(r.avant)+' → '+_recKg(r.apres)+' kg'):'Le prochain t’attend.',
       nb?(nb+' badge'+(nb>1?'s':'')+' débloqué'+(nb>1?'s':'')):'',
       // L'édition du mois, bouclée (saisons_resultats) : « Édition Mars en fonte bouclée ».
       (w.editions&&w.editions.length)?('Édition '+w.editions[0]+' bouclée'+(w.editions.length>1?' (+'+(w.editions.length-1)+')':'')):'']},
    // BUILD 1921 : sur un bloc, l'assiduité et le podium remplacent les habitudes.
    (per&&per.type==='jalon')
    ?{k:'avantapres',sur:'AVANT / APRÈS',grand:per.jours,dec:0,unite:'JOURS ENSEMBLE',lignes:(w.avantApres||[]).slice(0,3)}
    :(per&&per.type==='bloc'&&per.prevues>0)
    ?{k:'assiduite',sur:'TON ASSIDUITÉ',grand:Math.min(100,Math.round(100*w.seances/per.prevues)),dec:0,unite:'% DES SÉANCES PRÉVUES',
      lignes:[w.seances+' séance'+(w.seances>1?'s':'')+' sur '+per.prevues].concat(((w.top3)||[]).map((x,k)=>(k+1)+'. '+x.nom+' : +'+_recKg(x.gain)+' kg'))}
    :{k:'habitudes',sur:'TES HABITUDES',grand:w.serieMax,dec:0,unite:w.serieMax>1?'SEMAINES D’AFFILÉE':'SEMAINE D’AFFILÉE',
     lignes:[w.jourPrefere?('Ton jour : le '+w.jourPrefere.lib):'',
       w.heureMoyenne?('Ton heure : '+w.heureMoyenne.lib):'']},
    {k:'profil',sur:'TON PROFIL',profil:w.profil,equivalent:eq,
     resume:[[_wrNb(w.seances),w.seances>1?'séances':'séance'],[_wrNb(t.v,t.dec),t.u.toLowerCase()],
       [_wrNb(w.records),w.records>1?'records':'record'],[_wrNb(w.serieMax),'sem. d’affilée']]}
  ].map(s=>Object.assign(s,{lignes:(s.lignes||[]).filter(Boolean)}));
}

// ── LE DESSIN 1080×1920 ───────────────────────────────────────────────
// Fond noir, accents rouges, un éclair en filigrane : l'identité de l'écran.
// `i` : 0..4 — la slide 4 est le RÉSUMÉ, la carte qu'on publie. Mêmes outils
// d'écriture que les autres visuels (ombre double passe, Bebas, Montserrat).
// `anim.grand` (la vidéo) : le grand chiffre en train de monter.
function _dessinerWrapped(w,per,i,signature,format,anim){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=_visuelToile(anim,W,H);
  const g=cv.getContext('2d');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const s=wrappedSlides(w,per)[Math.max(0,Math.min(4,i|0))];
  g.fillStyle='#000'; g.fillRect(0,0,W,H);
  // Les accents : une lueur rouge en haut, un trait rouge en bas.
  const lu=g.createRadialGradient(cx,0,0,cx,0,H*0.6);
  lu.addColorStop(0,'rgba(224,32,32,.35)'); lu.addColorStop(1,'rgba(224,32,32,0)');
  g.fillStyle=lu; g.fillRect(0,0,W,H);
  _recEclairFiligrane(g,cx+260,post?60:120,cx-200,H*(post?0.66:0.62),_recGraine(per.cle+'|'+i),'transparent');
  g.textAlign='center'; g.textBaseline='alphabetic';
  o.ombre(true);
  g.fillStyle=ROUGE_MARQUE; g.font='800 36px '+MONT;
  const ss=o.ajusteEspace(s.sur,'800',36,MONT,8,LARG,22);
  g.font='800 '+ss+'px '+MONT;
  // En post, chaque bloc remonte : mêmes éléments, sur 1 350 px.
  const P=(st,po)=>post?po:st;
  o.ecrireEspace(s.sur,cx,P(300,110),8,true);
  if(s.k!=='profil'){
    const v=_wrNb(anim&&anim.grand!=null?anim.grand:s.grand,s.dec);
    g.fillStyle='#fff';
    // La taille suit la valeur FINALE : un chiffre qui monte ne rétrécit pas en route.
    const gs=o.ajuste(_wrNb(s.grand,s.dec),'700',P(380,300),BEBAS,LARG,140);
    g.font='700 '+gs+'px '+BEBAS;
    o.ecrire(v,cx,P(860,560));
    const us=o.ajusteEspace(s.unite,'800',52,MONT,8,LARG,26);
    g.font='800 '+us+'px '+MONT;
    o.ecrireEspace(s.unite,cx,P(960,650),8,true);
    g.fillStyle='rgba(255,255,255,.9)';
    s.lignes.forEach((l,k)=>{
      const ls=o.ajuste(l,'700',44,MONT,LARG,24);
      g.font='700 '+ls+'px '+MONT;
      o.ecrire(o.coupe(l,LARG),cx,P(1120,800)+k*P(80,72));
    });
  } else {
    const p=s.profil||{nom:'-',phrase:''};
    g.fillStyle='#fff';
    const ps=o.ajuste(p.nom.toUpperCase(),'700',P(170,140),BEBAS,LARG,70);
    if(anim) anim.geo={x:cx,y:P(560,270)-ps*0.38,taille:ps};
    g.font='700 '+ps+'px '+BEBAS;
    o.ecrire(p.nom.toUpperCase(),cx,P(560,270));
    // La phrase, sur deux lignes au plus.
    g.fillStyle='rgba(255,255,255,.88)'; g.font='600 38px '+MONT;
    const mots=String(p.phrase).split(' '); const lignes=[]; let l='';
    for(const m of mots){ const e=l?l+' '+m:m; if(g.measureText(e).width>LARG&&l){ lignes.push(l); l=m; } else l=e; }
    if(l) lignes.push(l);
    lignes.slice(0,3).forEach((x,k)=>o.ecrire(x,cx,P(660,350)+k*54));
    // Le résumé : quatre chiffres en grille 2×2.
    s.resume.forEach(([v,lib],k)=>{
      const x=M+LARG/4+(k%2)*LARG/2, y=P(1000,640)+Math.floor(k/2)*P(260,215);
      g.fillStyle='#fff';
      const vs=o.ajuste(v,'700',P(150,124),BEBAS,LARG/2-24,60);
      g.font='700 '+vs+'px '+BEBAS; o.ecrire(v,x,y);
      g.fillStyle=ROUGE_MARQUE; g.font='800 32px '+MONT; o.ecrireEspace(lib.toUpperCase(),x,y+56,4,true);
    });
    if(s.equivalent){
      const t='= '+s.equivalent.texte.toUpperCase()+' '+s.equivalent.emoji;
      g.fillStyle='#fff';
      const es=o.ajuste(t,'800',44,MONT,LARG,22);
      g.font='800 '+es+'px '+MONT; o.ecrire(t,cx,P(1530,1030));
    }
    g.fillStyle='rgba(255,255,255,.7)';
    const pts=o.ajusteEspace(per.titre,'800',30,MONT,6,LARG,18);
    g.font='800 '+pts+'px '+MONT;
    o.ecrireEspace(per.titre,cx,P(1620,1110),6,true);
  }
  o.ombre(false);
  g.fillStyle=ROUGE_MARQUE; g.fillRect(cx-60,H-(post?120:210),120,5);
  _recSignature(g,o,String(signature||''),H-(post?50:120),LARG);
  o.ombre(false);
  return cv;
}

// ── L'ÉCRAN (s-wrapped) ───────────────────────────────────────────────
// Cinq slides, une barre de progression par slide en haut, tap à droite pour
// avancer et à gauche pour reculer, avance seule toutes les 6,5 s sauf sur la
// dernière. Les chiffres montent (arcCompteur) à chaque arrivée sur leur
// slide ; la révélation du profil passe par rcFoudre.
const WR_DUREE=6500;
let _wr=null;                 // {w, per, i, minuteur, t0}
function ouvrirWrapped(cle){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const per=wrappedPeriodes(Date.now(),u).find(p=>!cle||p.cle===cle)
    ||(cle&&_wrPeriodeDeCle(cle));
  if(!u||!per) return false;
  const w=calculerWrapped(u,per.debut,per.fin);
  if(per.type==='bloc'){ try{ w.top3=wrappedTop3(u,per.debut,per.fin); }catch(e){ w.top3=[]; } }
  if(per.type==='jalon'){ try{ w.avantApres=lignesAvantApresJalon(u,per.debut,per.fin); }catch(e){ w.avantApres=[]; } }
  // BUILD 1921 : le coach lit QUAND l'athlète a vu son récapitulatif.
  try{ if(w.seances){ u.wrappedVus=Object.assign({},u.wrappedVus||{},{[per.cle]:Date.now()}); saveUser(); } }catch(e){ rcErreurMuette('wrappedVus',e); }
  if(!w.seances){ toast('Aucune séance sur cette période.','var(--orange)'); return false; }
  const z=document.getElementById('s-wrapped'); if(!z) return false;
  _wrFermer(true);
  _wr={w,per,i:0,minuteur:null};
  const sl=wrappedSlides(w,per);
  z.innerHTML='<div class="wr-barres">'+sl.map(()=>'<span><i></i></span>').join('')+'</div>'
    +'<div class="wr-haut"><button type="button" class="wr-btn" aria-label="Partager cette slide" onclick="event.stopPropagation();partagerWrapped(_wr?_wr.i:0)">'+icon('share',18)+'</button>'
    +'<button type="button" class="wr-btn" aria-label="Fermer" onclick="event.stopPropagation();fermerWrapped()">'+icon('croix',14)+'</button></div>'
    +'<div class="wr-slides" onclick="_wrTap(event)">'+sl.map((s,k)=>_wrHtmlSlide(s,k)).join('')+'</div>';
  try{ localStorage.setItem('rc_wrapped_vu_'+per.cle,'1'); }catch(e){}
  go('s-wrapped');
  _wrAller(0);
  return true;
}
// Une période désignée par sa clé (lien de notification ouvert plus tard).
function _wrPeriodeDeCle(cle){
  let m=/^m-(\d{4})-(\d{2})$/.exec(cle||'');
  if(m) return wrappedPeriodes(new Date(+m[1],+m[2],1,12).getTime()).find(p=>p.cle===cle)||null;
  if(/^j-\d+-\d{4}-\d{2}-\d{2}$/.test(cle||'')){ try{ const u=currentUser, J=+cle.split('-')[1], j=wrappedJalon(u,debutRelation(u)+J*864e5+12*3600e3); return (j&&j.cle===cle)?j:null; }catch(e){ return null; } }
  if(/^b-\d{4}-\d{2}-\d{2}$/.test(cle||'')){ try{ const u=currentUser, b=wrappedBloc(u,(programmeDe(u)||{}).debut+((programmeDe(u)||{}).semaines||0)*7*864e5); return (b&&b.cle===cle)?b:null; }catch(e){ return null; } }
  m=/^a-(\d{4})$/.exec(cle||'');
  if(m) return wrappedPeriodes(new Date(+m[1],11,15,12).getTime()).find(p=>p.cle===cle)||null;
  return null;
}
function _wrHtmlSlide(s,k){
  if(s.k==='profil'){
    const p=s.profil||{nom:'-',phrase:''};
    return '<section class="wr-slide wr-profil" data-k="'+k+'" hidden>'
      +'<div class="wr-sur">'+escapeHtml(s.sur)+'</div>'
      +'<h2 class="wr-profil-nom">'+escapeHtml(p.nom)+'</h2>'
      +'<p class="wr-phrase">'+escapeHtml(p.phrase)+'</p>'
      +'<div class="wr-resume">'+s.resume.map(([v,l])=>'<div><b>'+escapeHtml(v)+'</b><span>'+escapeHtml(l)+'</span></div>').join('')+'</div>'
      +(s.equivalent?'<p class="wr-equiv">= '+escapeHtml(s.equivalent.texte)+' '+s.equivalent.emoji+'</p>':'')
      +_htmlVisuelMedia()
      +'<button type="button" class="btn btn-red wr-partager" onclick="event.stopPropagation();partagerWrapped(4,this)">'
        +icon('share',16)+' <span>Partager mon résumé</span></button>'
      +'<button type="button" class="btn btn-outline wr-partager wr-carrousel" onclick="event.stopPropagation();partagerCarrouselWrapped(this)">'
        +icon('share',16)+' <span>Carrousel pour mon fil</span></button>'
      +'<button type="button" class="vf-legende" onclick="event.stopPropagation();voirLegende(\'wrapped\')">Voir la légende</button>'
      +htmlBoutonInviter()
      +'</section>';
  }
  return '<section class="wr-slide" data-k="'+k+'" hidden>'
    +'<div class="wr-sur">'+escapeHtml(s.sur)+'</div>'
    +'<div class="wr-grand" data-cible="'+s.grand+'" data-dec="'+(s.dec||0)+'">0</div>'
    +'<div class="wr-unite">'+escapeHtml(s.unite)+'</div>'
    +s.lignes.map(l=>'<p class="wr-ligne">'+escapeHtml(l)+'</p>').join('')
    +'</section>';
}
function _wrAller(i){
  if(!_wr) return;
  const z=document.getElementById('s-wrapped'); if(!z) return;
  const n=5;
  i=Math.max(0,Math.min(n-1,i));
  _wr.i=i;
  if(_wr.minuteur){ clearTimeout(_wr.minuteur); _wr.minuteur=null; }
  z.querySelectorAll('.wr-slide').forEach(s=>{ s.hidden=Number(s.dataset.k)!==i; });
  // Les barres : pleines avant, vides après, la courante se remplit.
  z.querySelectorAll('.wr-barres>span').forEach((b,k)=>{
    const f=b.firstElementChild;
    f.getAnimations&&f.getAnimations().forEach(a=>a.cancel());
    f.style.width=k<i?'100%':'0%';
    if(k===i){
      if(i<n-1&&!arcReduit()) _animer(f,[{width:'0%'},{width:'100%'}],{duration:WR_DUREE,easing:'linear',fill:'forwards'});
      else f.style.width='100%';
    }
  });
  const s=z.querySelector('.wr-slide[data-k="'+i+'"]');
  const el=s&&s.querySelector('.wr-grand');
  if(el){
    // Le chiffre repart de zéro à chaque arrivée : c'est la montée qu'on vient voir.
    const v=Number(el.dataset.cible)||0, dec=Number(el.dataset.dec)||0;
    el.dataset.valeur='0';
    arcCompteur(el,v,{duree:1200,format:x=>_wrNb(x,dec)});
  }
  if(s&&s.classList.contains('wr-profil')){
    const nom=s.querySelector('.wr-profil-nom');
    try{ rcFoudre(nom,{eclairs:3,conteneur:z}); }catch(e){}
    if(!arcReduit()) _animer(nom,[{opacity:0,transform:'scale(1.4)',filter:'blur(8px)'},
      {opacity:1,transform:'scale(1)',filter:'blur(0)'}],{duration:ARC.release,delay:60,easing:ARC.snap,fill:'backwards'});
  }
  if(i<n-1) _wr.minuteur=setTimeout(()=>_wrAller(_wr?_wr.i+1:0),WR_DUREE);
}
// TAP : le tiers gauche recule, le reste avance.
function _wrTap(e){
  if(!_wr) return;
  if(e&&e.target&&e.target.closest&&e.target.closest('button')) return;
  const x=e&&typeof e.clientX==='number'?e.clientX:window.innerWidth;
  if(x<window.innerWidth*0.33) _wrAller(_wr.i-1);
  else if(_wr.i<4) _wrAller(_wr.i+1);
}
function _wrFermer(){
  if(_wr&&_wr.minuteur) clearTimeout(_wr.minuteur);
  _wr=null;
}
function fermerWrapped(){
  _wrFermer();
  try{ go('s-client-home'); loadClientHome(); }catch(e){}
  return true;
}
// LE PARTAGE d'une slide (0..3) ou du résumé (4). Natif, sinon téléchargement ;
// les deux copient le lien perso. SYNCHRONE jusqu'au partage (iOS).
// Une slide, c'est une STORY (l'écran entier, 9:16) : le carrousel du fil, en
// 4:5, a son propre bouton (partagerCarrouselWrapped).
function partagerWrapped(i,btn){
  if(!_wr||_storyEnCours) return false;
  let sig=''; try{ sig=nomSurVisuels(currentUser); }catch(e){ sig=''; }
  // En vidéo, c'est TOUT le Wrapped : cinq slides, 1,5 s chacune.
  if(visuelMediaChoisi()==='video') return partagerVideo(videoScene('wrapped',{w:_wr.w,per:_wr.per,signature:sig}));
  const fmt=visuelFondFormat('rouge');           // opaque : JPEG
  const nom=visuelNomFichier('repcore-wrapped'+(i===4?'':'-'+(i+1)),'rouge','story');
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerWrapped(_wr.w,_wr.per,i,sig,'story'),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerWrapped(_wr.w,_wr.per,i,sig,'story'),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}

