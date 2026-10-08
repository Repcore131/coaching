// ══ R30 — LE SON, PROPOSE AU PREMIER REPOS DE LA SEANCE ═══════════════════
//
// Eteint par defaut, et c'est juste (salle bruyante, ecouteurs). Mais sur
// iPhone rien ne vibre : sans le son, la fin du repos n'emet aucun signal, et
// l'athlete ne sait pas que le reglage existe. On le lui dit une fois par
// seance, dans le minuteur, au moment ou ca le concerne. On propose, on
// n'insiste pas : trois seances vues sans l'activer, et la ligne se tait.
const REPOS_SON_VUS_MAX=3;
// PURE. Ce que dit la ligne, ou null.
function reposInviteSon(u){
  if(!u) return null;
  if(u.sonRepos) return {type:'actif',texte:'Un bip te préviendra'};
  const n=Number(u.vus&&u.vus.reposSonVus)||0;
  if(n>=REPOS_SON_VUS_MAX) return null;
  // « un bip te préviendra » serait faux ici : le son est coupe. La ligne dit
  // ce qui se passera VRAIMENT, et comment le changer.
  return {type:'propose',texte:'Aucun son à la fin du repos',lien:'Activer'};
}
// Remplit la ligne a l'ENTREE du bandeau, au premier repos de la seance
// seulement (woState._reposVu, local a la seance).
function _reposInviteSon(){
  if(typeof woState==='undefined'||!woState) return;
  const z=document.getElementById('rep-invite');
  if(!z) return;
  if(woState._reposVu) return;
  woState._reposVu=true;
  const m=reposInviteSon(currentUser);
  if(!m){ z.hidden=true; z.innerHTML=''; return; }
  z.dataset.type=m.type;
  z.innerHTML='<span class="rep-invite-t">'+escapeHtml(m.texte)+'</span>'
    +(m.lien?'<span class="rep-invite-sep" aria-hidden="true">·</span>'
      +'<button type="button" class="rep-invite-b" onclick="activerSonDepuisRepos(event)">'+escapeHtml(m.lien)+'</button>':'');
  z.hidden=false;
  if(m.type==='propose') _compterVueSonRepos();
}
// LE COMPTE DES SEANCES OU LA PROPOSITION A ETE VUE. Une fois par seance : la
// seance est reconnue a son heure de depart, parce qu'un rechargement de
// l'application en plein repos reconstruit woState sans _reposVu, et
// compterait la meme seance deux fois.
function _compterVueSonRepos(){
  const u=currentUser;
  if(!u||typeof woState==='undefined'||!woState) return false;
  if(!u.vus||typeof u.vus!=='object') u.vus={};
  const seance=woState.startTime||null;
  if(seance&&u.vus.reposSonSeance===seance) return false;
  u.vus.reposSonVus=(Number(u.vus.reposSonVus)||0)+1;
  if(seance) u.vus.reposSonSeance=seance;
  try{ saveUser(); }catch(e){ rcErreurMuette('_compterVueSonRepos',e); }
  return true;
}
// « Activer » : allume, confirme dans la ligne, puis la retire. Aucune
// navigation — un <button type="button">, et l'evenement s'arrete ici.
function activerSonDepuisRepos(ev){
  try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}
  if(!currentUser) return false;
  if(!currentUser.sonRepos) _ecrireSonRepos(true);
  _majInviteSon(true);
  return true;
}
// La ligne suit l'etat du son, quel que soit le chemin qui l'a change (le
// lien, ou l'icone du bandeau). Allume alors qu'elle proposait : « Son activé ✓ »
// deux secondes, puis rien. Eteint alors qu'elle promettait un bip : retiree.
let _reposInviteMinuteur=null;
function _majInviteSon(sonOn){
  const z=document.getElementById('rep-invite');
  if(!z||z.hidden) return;
  if(sonOn&&z.dataset.type==='propose'){
    z.dataset.type='ok';
    z.innerHTML='<span class="rep-invite-t">Son activé '+icon('coche',14)+'</span>';
    if(_reposInviteMinuteur) clearTimeout(_reposInviteMinuteur);
    _reposInviteMinuteur=setTimeout(()=>{ _reposInviteMinuteur=null;
      if(z.isConnected&&z.dataset.type==='ok'){ z.hidden=true; z.innerHTML=''; } },2000);
  } else if(!sonOn&&z.dataset.type==='actif'){
    z.hidden=true; z.innerHTML='';
  }
}
// L'interrupteur des réglages suit le dossier, jamais l'inverse : il est posé
// à l'ouverture de l'écran et après chaque bascule.
function _majSonReglages(){
  const c=document.getElementById('cr-son-case');
  if(c) c.checked=!!(currentUser&&currentUser.sonRepos);
  const e=document.getElementById('cr-son-etat');
  if(e) e.textContent=(currentUser&&currentUser.sonRepos)?'Activé':'Éteint';
  // L'écran allumé pendant la séance, juste en dessous.
  const ec=document.getElementById('cr-ecran-case');
  if(ec) ec.checked=ecranAllumeActif(currentUser);
  const ee=document.getElementById('cr-ecran-etat');
  if(ee) ee.textContent=ecranAllumeActif(currentUser)?'Activé':'Éteint';
}

// ══════════════ LA FIN DU REPOS, ÉCRAN ÉTEINT OU APP EN ARRIÈRE-PLAN ══════
// (30/09/2026) Téléphone posé sur le banc, l'écran s'éteignait au bout de
// 30 s : le navigateur gelait les minuteurs, et la vibration de fin de repos
// ne partait qu'au rallumage. Trois gestes, sans serveur (le cron du Worker
// tourne à la minute, bien trop grossier pour un repos de 90 s) :
//   1. l'écran reste allumé pendant la séance (Wake Lock), si le réglage le veut ;
//   2. passée en arrière-plan, la page pose une notification « Repos en cours »
//      qui dit l'heure de fin ; elle se ferme au retour ;
//   3. revenue APRÈS l'échéance, la page vibre (et bipe) tout de suite, une fois.
// Tout est dans des try/catch : l'API peut manquer (iOS ancien, Firefox) ou
// être refusée (économie d'énergie), et rien de cela ne doit casser la séance.

// Le réglage : vrai par défaut, faux seulement quand l'athlète l'a coupé.
function ecranAllumeActif(u){ return !(u&&u.ecranAllume===false); }
let _woVerrou=null;            // la sentinelle rendue par le navigateur
let _woVerrouVoulu=false;      // une séance est à l'écran : le verrou est souhaité
let _woVerrouDemande=null;     // une demande en vol (deux appels, une requête)
function _woVerrouEcran(){
  _woVerrouVoulu=true;
  try{
    if(!ecranAllumeActif(currentUser)) return Promise.resolve(false);
    const wl=(typeof navigator!=='undefined')&&navigator.wakeLock;
    if(!wl||typeof wl.request!=='function') return Promise.resolve(false);
    if(_woVerrou&&!_woVerrou.released) return Promise.resolve(true);
    if(_woVerrouDemande) return _woVerrouDemande;
    _woVerrouDemande=Promise.resolve(wl.request('screen')).then(v=>{
      _woVerrouDemande=null;
      if(!v) return false;
      // Le verrou a été rendu pendant la demande : on le relâche aussitôt.
      if(!_woVerrouVoulu||!ecranAllumeActif(currentUser)){ try{ v.release(); }catch(e){} return false; }
      _woVerrou=v;
      try{ v.addEventListener('release',()=>{ if(_woVerrou===v) _woVerrou=null; }); }catch(e){}
      return true;
    }).catch(()=>{ _woVerrouDemande=null; return false; });
    return _woVerrouDemande;
  }catch(e){ _woVerrouDemande=null; return Promise.resolve(false); }
}
function _woLibererEcran(){
  _woVerrouVoulu=false;
  const v=_woVerrou; _woVerrou=null;
  try{ if(v&&!v.released) v.release(); }catch(e){}
}
function basculerEcranAllume(){
  if(!currentUser) return;
  currentUser.ecranAllume=!ecranAllumeActif(currentUser);
  saveUser();
  if(ecranAllumeActif(currentUser)){ if(_woVerrouVoulu) _woVerrouEcran(); }
  else { const v=_woVerrou; _woVerrou=null; try{ if(v&&!v.released) v.release(); }catch(e){} }
  try{ _majSonReglages(); }catch(e){}
  toast(ecranAllumeActif(currentUser)?'L’écran restera allumé pendant la séance':'L’écran pourra s’éteindre pendant la séance');
}

// ── La notification de repos ────────────────────────────────────────────
const REPOS_NOTIF_TAG='rc-repos';
// L'enregistrement du service worker, sans jamais attendre (ready peut ne
// jamais se résoudre sans SW). Isolé pour que les tests le remplacent.
function _swReg(){
  try{
    if(typeof navigator==='undefined'||!navigator.serviceWorker||!navigator.serviceWorker.getRegistration) return Promise.resolve(null);
    return navigator.serviceWorker.getRegistration().catch(()=>null);
  }catch(e){ return Promise.resolve(null); }
}
function _hms(ms){
  const d=new Date(ms);
  return [d.getHours(),d.getMinutes(),d.getSeconds()].map(x=>String(x).padStart(2,'0')).join(':');
}
async function _reposNotifier(){
  try{
    if(typeof woState==='undefined'||!woState||!woState.reposFin||!(woState.reposFin>Date.now())) return false;
    const N=window.Notification;
    if(!N||N.permission!=='granted') return false;
    const reg=await _swReg();
    if(!reg||typeof reg.showNotification!=='function') return false;
    const ex=woState.reposLib||((woState.exercises||[])[woState.currentEx]||{}).name||'';
    await reg.showNotification('Repos en cours',{body:'Fin à '+_hms(woState.reposFin)+(ex?' · '+ex:''),
      tag:REPOS_NOTIF_TAG,renotify:false,silent:true,data:{url:'./index.html#seance'}});
    return true;
  }catch(e){ return false; }
}
// ── SÉRIE 7 (lot 1) : LA FIN DU REPOS, PAR NOTIFICATION ────────────────────
function reposNotifPermise(){ if(!_notifSupported()) return false; try{ const N=window.Notification; return !!(N&&N.permission==='granted'); }catch(e){ return false; } }
// PURE. « Série suivante : Squat · 82,5 kg × 8 » — la première série non
// faite à partir de l'exercice en cours.
function serieSuivanteTexte(etat){
  const w=etat||{}, l=w.exercises||[], deb=Math.max(0,Number(w.currentEx)||0);
  for(let k=0;k<l.length;k++){
    const idx=(deb+k)%l.length, ex=l[idx], d=(w.sessionData||{})[idx];
    const sets=(d&&d.sets)||[];
    const i=sets.findIndex(s=>s&&!s.done);
    if(!ex||i<0) continue;
    const s=sets[i], kg=parseFloat(String(s.weight==null?'':s.weight).replace(',','.'));
    const reps=s.repsProp||s.reps||ex.reps||'';
    const charge=kg>0?fmtCharge(kg):'';
    return 'Série suivante : '+ex.name+(charge||reps?' · '+[charge,reps].filter(Boolean).join(' × '):'');
  }
  return 'Dernière série faite : termine ta séance.';
}
async function _reposNotifierFin(){
  try{
    if(!reposNotifPermise()) return false;
    const reg=await _swReg();
    if(!reg||typeof reg.showNotification!=='function') return false;
    await reg.showNotification('Repos terminé',{body:serieSuivanteTexte(woState),tag:REPOS_NOTIF_TAG,renotify:true,silent:false,
      vibrate:ARC_VIBRE.finRepos,requireInteraction:false,data:{url:'./index.html#seance'}});
    return true;
  }catch(e){ return false; }
}
// L'invitation : au premier repos de la PREMIÈRE séance, une ligne sous le
// cadran, pas de modale. Refusée par le navigateur : plus jamais.
function reposInviteNotif(u,permission,premiereSeance){
  if(!u||!premiereSeance||permission!=='default') return null;
  if(u.vus&&u.vus.notifReposRefus) return null;
  return {texte:'Être prévenu même hors de l’app',lien:'Activer'};
}
function _reposInviteNotif(){
  if(typeof woState==='undefined'||!woState||woState._reposNotifVu) return false;
  woState._reposNotifVu=true;
  const z=document.getElementById('rep-notif'); if(!z) return false;
  if(!_notifSupported()){ z.hidden=true; z.innerHTML=''; return false; }
  let perm=''; try{ perm=window.Notification?Notification.permission:''; }catch(e){}
  const m=reposInviteNotif(currentUser,perm,!((currentUser&&currentUser.sessions)||[]).length);
  if(!m){ z.hidden=true; z.innerHTML=''; return false; }
  z.innerHTML='<span class="rep-invite-t">'+escapeHtml(m.texte)+'</span><span class="rep-invite-sep" aria-hidden="true">·</span>'
    +'<button type="button" class="rep-invite-b" onclick="activerNotifDepuisRepos(event)">'+escapeHtml(m.lien)+'</button>';
  z.hidden=false;
  return true;
}
async function activerNotifDepuisRepos(ev){
  try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(e){}
  const z=document.getElementById('rep-notif');
  if(!_notifSupported()) return 'unsupported';
  let r='default';
  try{ r=await Notification.requestPermission(); if(r==='granted') rcm('notif_granted'); }catch(e){ r='default'; }
  if(r!=='granted'&&currentUser){ if(!currentUser.vus||typeof currentUser.vus!=='object') currentUser.vus={}; currentUser.vus.notifReposRefus=true; try{ saveUser(); }catch(e){} }
  if(z){ z.innerHTML=r==='granted'?'<span class="rep-invite-t">Tu seras prévenu '+icon('coche',14)+'</span>':''; if(r!=='granted') z.hidden=true;
    else setTimeout(()=>{ if(z.isConnected){ z.hidden=true; z.innerHTML=''; } },2000); }
  return r;
}
async function _reposFermerNotif(){
  try{
    const reg=await _swReg();
    if(!reg||typeof reg.getNotifications!=='function') return 0;
    const l=await reg.getNotifications({tag:REPOS_NOTIF_TAG});
    (l||[]).forEach(n=>{ try{ n.close(); }catch(e){} });
    return (l||[]).length;
  }catch(e){ return 0; }
}
// Revenue après l'échéance : le signal part TOUT DE SUITE, une seule fois
// (reposVibre). Avant _peindreRepos, qui efface un repos trop dépassé sans
// rien signaler.
function _reposRattraper(){
  try{
    if(typeof woState==='undefined'||!woState||!woState.reposFin||woState.reposVibre) return false;
    if(woState.reposFin>Date.now()) return false;
    woState.reposVibre=true;
    // Série 7 (lot 1) : la notification de fin est partie (elle a vibré et
    // sonné) : pas une seconde fois au retour.
    if(woState.reposNotifFin) return false;
    try{ arcHaptique('finRepos'); }catch(e){}
    try{ if(currentUser&&currentUser.sonRepos) _bipRepos(); }catch(e){}
    return true;
  }catch(e){ return false; }
}
// Le retour d'arrière-plan est le moment où un compteur décrémenté aurait
// menti : on repeint depuis l'échéance, qui est la seule source de vérité.
async function _woVisibilite(){
  if(document.hidden){ return _reposNotifier(); }
  try{ _reposRattraper(); }catch(e){}
  try{ _peindreRepos(); }catch(e){}
  // Le navigateur relâche le verrou en arrière-plan : on le reprend.
  if(_woVerrouVoulu){ try{ _woVerrouEcran(); }catch(e){} }
  try{ await _reposFermerNotif(); }catch(e){}
  return false;
}
document.addEventListener('visibilitychange',()=>{ _woVisibilite(); });

// ══════════════ LE TEMPO ═══════════════════════════════════════════════
//
// CE COMMENTAIRE DISAIT L'INVERSE, ET IL EST REVU PLUTOT QUE LAISSE EN PLACE :
// « aucune saisie, aucune mesure, aucun decompte — mesurer un temps sous
// tension declaratif couterait une interaction par serie pour une donnee sans
// valeur ». L'argument tenait tant que la mesure etait DECLARATIVE. Elle ne
// l'est plus : le chronometre part et s'arrete au meme geste que le guide, et
// le tempo prescrit devient executable au lieu de rester un texte que
// personne ne suit. Ce qui reste vrai de l'ancien arbitrage est garde : le
// guide est facultatif, coupe par defaut, et la mesure ne coute aucun champ a
// remplir.
//
// ── LE FORMAT ──────────────────────────────────────────────────────────
//
// Quatre temps, en secondes : excentrique, pause basse, concentrique, pause
// haute. Deux ecritures acceptees, « 3-1-1-0 » et « 3110 », normalisees a la
// meme forme A L'ENREGISTREMENT.
//
// ⚠ ON NE CONVERTIT RIEN TOUT SEUL. Les tempos deja saisis en texte libre
// sont conserves et affiches TELS QUELS. Reinterpreter apres coup ce qu'un
// coach a ecrit a la main, c'est lui preter une consigne qu'il n'a pas
// donnee — et « 2 s en bas, explosif » ne se replie sur aucun quadruplet sans
// qu'on invente le reste.
const TEMPO_PHASES=Object.freeze([
  {cle:'exc', lib:'Descente'},
  {cle:'bas', lib:'Pause basse'},
  {cle:'con', lib:'Montée'},
  {cle:'haut',lib:'Pause haute'}
]);
const TEMPO_S_MAX=15;              // 15 s sur une phase : c'est une faute de saisie

// PURE. Rend la forme canonique « 3-1-1-0 », ou null si ce n'est pas un tempo
// normalise. null n'est pas une erreur : c'est un texte libre, et il a le
// droit d'exister.
//
// LOT T3 (29/09/2026) : « X » est accepté sur la MONTÉE (troisième temps),
// pour « le plus vite possible » : « 3-0-X-0 », « 30X0 », minuscule ou
// majuscule. Nulle part ailleurs : une descente ou une pause « aussi vite que
// possible » ne veut rien dire. La borne reste TEMPO_S_MAX (15 s) et non 10 :
// un tempo déjà prescrit à 12 s ne doit pas perdre son guide à la mise à jour.
function tempoNormalise(txt){
  const t=String(txt==null?'':txt).trim().toUpperCase();
  if(!t) return null;
  let n=null;
  // FORME COMPACTE : quatre signes colles, un par phase. Elle ne peut pas
  // porter de valeur a deux chiffres — « 1010 » est 1-0-1-0, jamais 10-10.
  if(/^[0-9]{2}[0-9X][0-9]$/.test(t)) n=t.split('');
  // FORME SEPAREE : n'importe quel separateur, valeurs libres.
  else if(/^[0-9]+([^0-9X]+([0-9]+|X)){3}$/.test(t))
    n=t.split(/[^0-9X]+/).filter(x=>x!=='');
  if(!n||n.length!==4) return null;
  if(n.some((x,i)=>x==='X'&&i!==2)) return null;
  const v=n.map(x=>x==='X'?'X':Number(x));
  if(v.some(x=>x!=='X'&&(!isFinite(x)||x<0||x>TEMPO_S_MAX))) return null;
  // Un tempo entierement a zero ne prescrit rien : ce n'est pas une consigne.
  if(v.every(x=>x===0)) return null;
  return v.join('-');
}
// Le guide cadence le « X » sur une seconde : c'est le rythme d'une montée
// explosive, et il lui faut une durée pour avancer son point.
const TEMPO_X_S=1;
// PURE. Le tempo LU : les quatre termes (null pour le « X »), le drapeau du
// « X », la forme canonique. null pour un texte libre.
function tempoLu(txt){
  const c=tempoNormalise(txt);
  if(!c) return null;
  const p=c.split('-'), n=x=>x==='X'?null:Number(x);
  return {exc:n(p[0]),bas:n(p[1]),con:n(p[2]),haut:n(p[3]),conX:p[2]==='X',canon:c};
}
// PURE. Les quatre durees en secondes, ou null. C'est ce que lit le guide.
function tempoSecondes(txt){
  const l=tempoLu(txt);
  return l?[l.exc,l.bas,l.conX?TEMPO_X_S:l.con,l.haut]:null;
}
// PURE. LE TEMPO EN UNE PHRASE, pour l'athlète : « Descends en 3 secondes,
// pas de pause, remonte vite. » Jamais « 3-0-X-0 » seul, qui ne dit rien à la
// moitié des gens. '' pour un texte libre : il s'affiche tel qu'il est écrit.
function tempoPhrase(txt){
  const l=tempoLu(txt);
  if(!l) return '';
  const sec=n=>n+' seconde'+(n>1?'s':'');
  const p=[l.exc>0?'Descends en '+sec(l.exc):'Descends sans freiner'];
  if(!l.bas&&!l.haut) p.push('pas de pause');
  else if(l.bas) p.push('marque '+sec(l.bas)+' en bas');
  else p.push('pas de pause en bas');
  p.push((l.conX||!(l.con>0))?'remonte vite':'remonte en '+sec(l.con));
  if(l.haut) p.push('tiens '+sec(l.haut)+' en haut');
  return p.join(', ')+'.';
}
// PURE. Duree d'une repetition complete, en secondes.
function tempoDureeRep(txt){
  const s=tempoSecondes(txt);
  return s?s.reduce((a,b)=>a+b,0):null;
}
// PURE. Ce que le coach a ecrit, TEL QU'IL L'A ECRIT. La normalisation ne
// s'applique qu'a la SAISIE ; l'affichage, lui, ne trahit jamais la source.
function tempoAffiche(ex){
  return String((ex&&ex.tempo)||'').trim();
}

// ── LA MESURE : LE TEMPS SOUS TENSION ──────────────────────────────────
//
// tut est en SECONDES, et il vaut null tant que rien n'a ete mesure. null
// n'est pas 0 : « pas mesure » et « zero seconde sous tension » sont deux
// faits differents, et les confondre ferait entrer des zeros dans une moyenne
// qui sert a juger un plateau.
//
// LES BORNES SONT LA POUR LE TELEPHONE POSE. Un chronometre qu'on oublie
// d'arreter rend vingt minutes de tension sur une serie de dix : on ecrit
// null plutot qu'un chiffre faux, exactement comme _reposReelDepuis le fait
// deja pour le repos reel.
const TUT_MIN_S=3;
const TUT_MAX_S=600;
function tutBorne(sec){
  const v=Number(sec);
  if(!isFinite(v)) return null;
  const s=Math.round(v);
  if(s<TUT_MIN_S||s>TUT_MAX_S) return null;
  return s;
}
// PURE. LA VALEUR COMPARABLE D'UNE SEMAINE A L'AUTRE. Le TUT brut suit le
// nombre de repetitions : douze reps au lieu de dix allongent la serie sans
// que rien n'ait change sous la barre. C'est le temps PAR REPETITION qui dit
// quelque chose, et c'est lui — jamais le TUT brut — qui entre dans la
// comparaison de la detection de plateau.
function tutParRep(s){
  if(!s||s.tut==null) return null;
  const t=Number(s.tut);
  if(!isFinite(t)||t<=0) return null;
  // Les MEMES repetitions que la performance : repsDone si elle existe, la
  // prescription sinon. Deux lectures de reps finiraient par diverger.
  const r=_perfReps(s);
  if(!isFinite(r)||!(r>0)) return null;
  return t/r;
}
// PURE. Le temps par repetition d'une seance : moyenne des series mesurees.
// Rend null quand aucune serie n'a ete mesuree — et non zero.
function _tutSeance(sess,exNom){
  const d=_dataDeSeance(sess,exNom);
  if(!d||!Array.isArray(d.sets)) return null;
  const v=[];
  for(const s of d.sets){
    if(!s||s.done!==true) continue;
    const x=tutParRep(s);
    if(x!=null) v.push(x);
  }
  if(!v.length) return null;
  return v.reduce((a,b)=>a+b,0)/v.length;
}
// PURE. La charge de reference d'une seance : la plus lourde serie validee.
function _chargeSeance(sess,exNom){
  const d=_dataDeSeance(sess,exNom);
  if(!d||!Array.isArray(d.sets)) return null;
  let max=0;
  for(const s of d.sets){
    if(!s||s.done!==true) continue;
    const w=parseFloat(s.weight);
    if(w>max) max=w;
  }
  return max>0?max:null;
}

// ══ LA PROGRESSION APPARENTE ═══════════════════════════════════════════
//
// LE SEUL USAGE DE LA DONNEE, ET IL SUFFIT. La charge monte, les series
// raccourcissent : l'athlete a change son execution, pas sa force. Le chiffre
// progresse pendant que la tension baisse — c'est un plateau que la mesure de
// charge, seule, declare en progression.
//
// AUCUN GRAPHIQUE DE TUT NULLE PART. La donnee sert a QUALIFIER un plateau,
// pas a etre contemplee : une courbe de temps sous tension inviterait a
// optimiser le chiffre, et on obtiendrait des series lentes pour la courbe.
const TUT_BAISSE_SEUIL=0.25;       // 25 %
const TUT_FENETRE_JOURS=28;        // quatre semaines
const TUT_MIN_SEANCES=2;           // deux seances mesurees de chaque cote

// PURE. Rend {baisse, chargeHausse, tutRecent, tutAncien, n} quand le cas est
// avere, sinon null. Prend une LISTE de seances, comme _calculEtat : c'est ce
// qui permet de rejouer le calcul sans la derniere seance.
function tensionEnBaisse(seances,exNom,slot,progName,maintenant){
  const t=Number(maintenant)||Date.now();
  const pts=[];
  for(const sess of (seances||[])){
    if(!sess||!sess.date||sess.deload) continue;
    if(!_memeCreneau(sess,slot,progName)) continue;
    const tp=_tutSeance(sess,exNom);
    const ch=_chargeSeance(sess,exNom);
    // UNE SEANCE SANS MESURE EST ECARTEE, PAS COMPTEE ZERO.
    if(tp==null||ch==null) continue;
    pts.push({date:sess.date,tut:tp,charge:ch});
  }
  pts.sort((a,b)=>a.date-b.date);
  // Quatre semaines, coupees en deux moities de deux semaines.
  const debut=t-TUT_FENETRE_JOURS*86400000;
  const milieu=t-(TUT_FENETRE_JOURS/2)*86400000;
  const anciens=pts.filter(p=>p.date>=debut&&p.date<milieu);
  const recents=pts.filter(p=>p.date>=milieu);
  if(anciens.length<TUT_MIN_SEANCES||recents.length<TUT_MIN_SEANCES) return null;
  const moy=a=>a.reduce((x,p)=>x+p.tut,0)/a.length;
  const moyC=a=>a.reduce((x,p)=>x+p.charge,0)/a.length;
  const tA=moy(anciens), tR=moy(recents);
  if(!(tA>0)) return null;
  const baisse=(tA-tR)/tA;
  const chargeHausse=moyC(recents)>moyC(anciens);
  if(!chargeHausse||baisse<=TUT_BAISSE_SEUIL) return null;
  return {baisse:baisse,chargeHausse:true,
    tutRecent:tR,tutAncien:tA,n:anciens.length+recents.length};
}
// PURE. La phrase du coach, EN CLAIR. Elle nomme les deux mouvements
// contraires : le chiffre monte, la tension baisse.
function phraseTensionEnBaisse(exNom){
  return 'Le '+String(exNom||'mouvement').toLowerCase()+' monte en charge mais '
    +'les séries raccourcissent : la tension baisse pendant que le chiffre monte.';
}

function blocTempo(ex){
  const t=tempoAffiche(ex);
  if(!t) return '';
  // ⚠ ON AFFICHE `t`, PAS LA FORME CANONIQUE. Le detail chiffre n'apparait que
  // pour un tempo NORMALISE : l'ancienne version decoupait n'importe quel
  // texte sur ses chiffres, si bien que « 2 series a 3 s, 1 min de pause »
  // ressortait en « 2 s pour descendre, 3 s en bas… ». Elle prêtait au coach
  // une consigne qu'il n'avait pas ecrite.
  // LOT T3 : la phrase (« Descends en 3 secondes, pas de pause, remonte
  // vite. ») au lieu de l'énumération chiffrée.
  const expl=tempoPhrase(t)||'Consigne de ton coach.';
  // LA PHRASE D'ABORD quand le tempo se lit : c'est elle qui dit quoi faire ;
  // le code, dessous, reste pour qui le connaît. Un texte libre garde sa place
  // en tête, tel que le coach l'a écrit.
  const ph=tempoPhrase(t);
  if(ph) return `<div style="margin-bottom:8px">
    <span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${escapeHtml(ph)}</span>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:2px">Tempo ${escapeHtml(t)}</div>
  </div>`;
  return `<div style="margin-bottom:8px">
    <span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">Tempo ${escapeHtml(t)}</span>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:2px">${escapeHtml(expl)}</div>
  </div>`;
}
function _reprendreRepos(){
  const r=_resteRepos();
  if(r!=null&&r>-REPOS_DEPASSEMENT) _lancerTickRepos();
  _peindreRepos();
}
// ── Repos réel, mesuré sans aucune saisie ───────────────────────────────────
// Écart entre deux validations DANS LE MÊME EXERCICE. En dessous de cinq
// secondes, ce n'est pas un repos mais une saisie groupée : on écrit null
// plutôt qu'un chiffre faux.
function _reposReelDepuis(d,i,maintenant){
  const prec=(d&&d.sets||[]).reduce((m,s,j)=>(j!==i&&s&&s.tValid>m)?s.tValid:m,0);
  if(!prec) return null;
  const dt=Math.round((maintenant-prec)/1000);
  if(dt<REPOS_REEL_MIN) return null;
  return Math.min(dt,REPOS_REEL_MAX);
}
// Le minuteur ne part pas sur : le cardio, la dernière série de la SÉANCE
// (la dernière série du dernier groupe), un exercice qui n'est pas le dernier
// de son groupe (sur un superset, le repos est à la fin du couple), et un
// repos qu'on ne sait pas lire.
// ⚠ LA DERNIÈRE SÉRIE D'UN EXERCICE LANCE LE REPOS (30/09/2026) quand un
//   autre groupe suit : le passage à l'exercice suivant est un repos comme un
//   autre, et c'est souvent le plus long. Durée : le repos de l'exercice (du
//   groupe, sur un superset).
function _reposApresSerie(idx,i){
  if(typeof woState==='undefined'||!woState) return null;
  const ex=(woState.exercises||[])[idx];
  if(!ex||isCardio(ex)) return null;
  const d=woState.sessionData[idx];
  if(!d||!d.sets||i>d.sets.length-1) return null;
  const grs=_groupesEx(woState.exercises);
  const g=grs.find(x=>x.indexOf(idx)>=0);
  if(g&&g[g.length-1]!==idx) return null;
  if(i>=d.sets.length-1){
    const gi=g?grs.indexOf(g):-1;
    if(gi<0||gi>=grs.length-1) return null;   // la dernière série de la séance
  }
  const src=(g&&g.length>1)?((woState.exercises[g[g.length-1]]||{}).repos||(woState.exercises[g[0]]||{}).repos):ex.repos;
  return parseRepos(src);
}

function parseReps(r){
  const s=String(r||'').trim();
  if(/puis/i.test(s)){const p=s.split(/puis/i).map(x=>x.trim());return{type:'degressive',p1:p[0],p2:p[1],label:s};}
  if(/-/.test(s)&&!/jambe|bras|cote/i.test(s)){return{type:'range',label:s};}
  if(/jambe|bras|côté|cote|par/i.test(s)){return{type:'unilateral',label:s};}
  return{type:'normal',label:s};
}
// R29 — PURE. La fourchette d'une prescription de repetitions, ou null.
// SEULE une fourchette « 10-12 » ouvre la saisie des repetitions faites
// (Kevin, 17/09/2026) : un nombre fixe (« 8 ») est une consigne, il n'y a rien
// a choisir dedans. Meme motif que repsToNumber ci-dessous, qui en prend la
// moyenne quand rien n'a ete note.
function fourchetteReps(reps){
  const m=String(reps==null?'':reps).trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if(!m) return null;
  const a=parseInt(m[1],10), b=parseInt(m[2],10);
  return (a>0&&b>a)?{min:a,max:b}:null;
}
// Valeur numérique de reps pour le calcul de volume.
// Plage "6-8" → moyenne (7). Formats textuels ("15 Par Jambe", "10 PUIS 20") →
// premier nombre trouvé : approximation, le volume réel peut différer.
function repsToNumber(reps){
  const s=String(reps||'').trim();
  const range=s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if(range) return (parseFloat(range[1])+parseFloat(range[2]))/2;
  const n=parseFloat(s);
  return isNaN(n)?0:n;
}

async function setExerciseCount(n){
  const cur=progEx.length;
  if(n===cur) return;
  if(n>cur){
    for(let i=cur;i<n;i++) progEx.push(exerciceVierge(_coachPrescription()));
  } else {
    const toRemove=progEx.slice(n);
    const hasContent=toRemove.some(ex=>ex.name||ex.description);
    if(hasContent && !await rcConfirm('Supprimer les '+(cur-n)+' dernier(s) exercice(s) ?',null,'Supprimer')) return;
    progEx=progEx.slice(0,n);
  }
  renderProgEx();
}

// ── Sélecteur de méthode dans l'éditeur ─────────────────────────────────────
// Le champ reps reste ÉDITABLE ET INDÉPENDANT : choisir « Dropset type 1 » ne
// réécrit pas « 3 x 12 ». La méthode décrit ce qu'on fait de la série, reps dit
// combien de répétitions sont prescrites. Les deux sont saisis à la main.
const LIB_FAMILLE_BADGE=Object.freeze({degressive:'DÉGRESSIVE',rest_pause:'REST-PAUSE',
  myo_reps:'MINI-SÉRIES',superset:'SUPERSET',partielles:'PARTIELLES',isometrie:'ISOMÉTRIE'});
const COUL_FAMILLE=Object.freeze({degressive:['#7c2d12','#fca5a5'],rest_pause:['#3b1a5f','#c4b5fd'],
  myo_reps:['#0f3b3b','#5eead4'],superset:['#4a2c00','#fdba74'],
  partielles:['#3f2d00','#fde047'],isometrie:['#1e3a5f','#93c5fd']});
// PURE. Le nom de la méthode, et sur quelles séries elle s’applique.
//
// '' quand aucune méthode n’est posée : `methodeSeries` seul ne décrit rien,
// et l’afficher laisserait lire une consigne sans objet.
function _libTechniqueSeries(ex){
  let m=null; try{ m=methodeDe(ex); }catch(e){ m=null; }
  if(!m) return '';
  const s=String((ex&&ex.methodeSeries)||'').trim();
  return m.nom+(s?' · séries : '+s:'');
}
function badgeTechnique(ex){
  const m=methodeDe(ex);
  const fam=techniqueDe(ex);
  if(!m&&fam==='normale') return '';
  const c=COUL_FAMILLE[fam]||['var(--border)','#bbb'];
  const txt=m?m.nom.toUpperCase():(LIB_FAMILLE_BADGE[fam]||fam.toUpperCase());
  return `<span style="background:${c[0]};color:${c[1]};padding:2px 8px;border-radius:var(--r-2);font-size:var(--fs-xs);font-weight:700">${escapeHtml(txt)}</span>`;
}
// ══════════════ LE CONTROLE A LA PRESCRIPTION ══════════════════════════
//
// LE REFUS EST EXPLICATIF, JAMAIS SILENCIEUX. Une regle qui bloque sans dire
// pourquoi est contournee dans la semaine et desactivee dans le mois : le
// coach ne comprend pas ce qu'on lui reproche, et il a raison de passer
// outre. La phrase nomme donc les trois choses : la methode, ou elle est
// posee, et ce qui cloche.
//
// ET LE COACH PASSE OUTRE EN UN GESTE. C'est LUI le coach : la regle est un
// avis de metier, pas une autorisation. Ce qu'on garde, c'est la trace.

// PURE. Rend {ok:true} ou {ok:false, phrase, raisons:[{code,texte}], regle}.
// Les seances de creneaux servent au comptage hebdomadaire ; `maintenant`
// n'est la que pour rendre le calcul rejouable.
function evaluerMethode(ex,user,options){
  const o=options||{};
  const regle=regleMethode(ex,user);
  if(!regle) return {ok:true,regle:null};
  const u=_dossier(user);
  const nomEx=String((ex&&ex.name)||'').trim();
  const raisons=[];

  // ── LA PHASE DE BLOC. Une phase INCONNUE ne refuse rien. ──────────────
  const phase=phaseBloc(u,o.maintenant);
  let av=null; try{ av=blocAvancement(u,o.maintenant); }catch(e){ av=null; }
  if(phase&&(regle.phasesBloc||[]).indexOf(phase)<0)
    raisons.push({code:'phase',
      texte:(phase==='ACCUMULATION'?'on est en accumulation':'on est en fin de bloc')});

  // ── L'AXIAL. Une seule definition, celle de la grille du coach. ───────
  if(regle.axialExclu&&methodeExerciceAxial(ex,u,o.grille))
    raisons.push({code:'axial',texte:'cet exercice charge la colonne'});

  // ── LE PATRON. Liste noire, puis liste blanche. ───────────────────────
  let schema=null; try{ schema=schemaDe(ex,u); }catch(e){ schema=null; }
  if(schema&&(regle.patronsExclus||[]).indexOf(schema)>=0)
    raisons.push({code:'patron',texte:'ce patron de mouvement est exclu'});
  if(schema&&Array.isArray(regle.patronsAutorises)){
    const okPatron=regle.patronsAutorises.indexOf(schema)>=0;
    // LE MATERIEL PEUT RATTRAPER LE PATRON : « isolation ou machines ». Un
    // tirage a la poulie n'est pas une isolation, et se relance pourtant en
    // quinze secondes.
    let okMat=false;
    if(Array.isArray(regle.materielAutorises)){
      let mat=[]; try{ mat=materielExercice(nomEx); }catch(e){ mat=[]; }
      okMat=mat.some(m=>regle.materielAutorises.indexOf(m)>=0);
    }
    if(!okPatron&&!okMat)
      raisons.push({code:'patron',texte:'ce n’est ni une isolation ni une machine'});
  }
  if(nomEx&&(regle.materielExclu||[]).length){
    let mat=[]; try{ mat=materielExercice(nomEx); }catch(e){ mat=[]; }
    if(mat.some(m=>regle.materielExclu.indexOf(m)>=0))
      raisons.push({code:'materiel',texte:'le matériel ne s’y prête pas'});
  }

  // ── LES SERIES CONCERNEES. Le champ de la table sert ici, sinon il ne
  //    serait qu'un ornement dans un objet de configuration. ─────────────
  const ms=String((ex&&ex.methodeSeries)||'').trim().toLowerCase();
  if(regle.seriesConcernees==='derniere'&&/^toutes?$/.test(ms))
    raisons.push({code:'series',texte:'elle est prévue pour la dernière série, pas pour toutes'});

  // ── LE PLAFOND HEBDOMADAIRE, tous exercices confondus. ────────────────
  const n=_methodesPosees(u,regle,ex,o);
  if(regle.maxParSemaine>0&&n>=regle.maxParSemaine)
    raisons.push({code:'frequence',
      texte:'elle est déjà posée '+n+' fois cette semaine, le repère est '+regle.maxParSemaine});

  if(!raisons.length) return {ok:true,regle:regle};
  return {ok:false,regle:regle,raisons:raisons,
    phrase:_phraseRefusMethode(regle,nomEx,av,raisons)};
}
// PURE. LA PHRASE. « Rest-pause en semaine 2 sur « Soulevé de terre » : on est
// en accumulation, cet exercice charge la colonne. Aller à l'échec puis
// relancer deux fois demande une technique intacte… »
//
// Deux temps, et l'ordre compte : D'ABORD OU L'ON EST — c'est ce que le coach
// reconnait —, ENSUITE le motif de metier. L'inverse donnerait une lecon
// avant un constat.
//
// ⚠ LE MOTIF N'EST PAS TOUJOURS AJOUTE, et c'est une correction. Il explique
// POURQUOI la methode veut telle phase et tel type d'exercice : colle sous un
// refus de FREQUENCE — « deja posee deux fois cette semaine » — il parlait
// d'autre chose que du refus, et sous un refus de phase il repetait mot pour
// mot le constat qui precede. Un texte qui se repete se lit une fois puis
// plus du tout.
const METH_RAISONS_SANS_MOTIF=Object.freeze(['frequence','series']);
function _phraseRefusMethode(regle,nomEx,av,raisons){
  const ou=[];
  if(av&&av.semaine) ou.push('en semaine '+av.semaine);
  if(nomEx) ou.push('sur « '+String(nomEx).trim()+' »');
  const constat=raisons.map(r=>r.texte).join(', ');
  const utile=raisons.some(r=>METH_RAISONS_SANS_MOTIF.indexOf(r.code)<0);
  return regle.lib+(ou.length?' '+ou.join(' '):'')+' : '+constat+'.'
    +(utile?' '+regle.motif:'');
}
// PURE. Combien de fois cette regle est deja posee dans les creneaux ACTIFS,
// l'exercice en cours exclu. C'est la semaine du PROGRAMME : ce que le coach
// a prescrit, pas ce que l'athlete a fait.
//
// ⚠ L'EDITEUR TRAVAILLE SUR progEx, PAS SUR sessions_config. Compter la seule
// configuration enregistree ferait repondre « zero » a un coach en train de
// poser sa troisieme methode dans le creneau ouvert : le plafond ne se serait
// declenche qu'apres sauvegarde, c'est-a-dire trop tard pour l'avertir. Quand
// l'appelant fournit le creneau en cours d'edition, il REMPLACE celui de la
// configuration — on ne compte pas deux fois les memes exercices.
function _methodesPosees(user,regle,exclure,options){
  const u=_dossier(user);
  if(!u) return 0;
  const o=options||{};
  try{ _aplatirSessionsConfig(u); }catch(e){}
  const cfg=Array.isArray(u.sessions_config)?u.sessions_config:[];
  const edite=(typeof o.creneauEdite==='number')?o.creneauEdite:null;
  const listes=[];
  for(let i=0;i<cfg.length;i++){
    const sc=cfg[i];
    if(edite!=null&&i===edite) continue;          // remplace par l'edition
    if(!sc||!sc.active||!Array.isArray(sc.exercises)) continue;
    listes.push(sc.exercises);
  }
  if(Array.isArray(o.exercicesEdites)) listes.push(o.exercicesEdites);
  let n=0;
  for(const l of listes)
    for(const e of l){
      if(!e||e===exclure) continue;
      const r=regleMethode(e,u);
      if(r&&r.cle===regle.cle) n++;
    }
  return n;
}
// PURE. LE COMPTEUR HEBDOMADAIRE, tous exercices et toutes methodes
// confondus : la somme des couts de fatigue prescrits sur la semaine.
function chargeMethodesSemaine(user){
  const u=_dossier(user);
  if(!u) return {total:0,detail:{},n:0};
  try{ _aplatirSessionsConfig(u); }catch(e){}
  const cfg=Array.isArray(u.sessions_config)?u.sessions_config:[];
  const detail={}; let total=0, n=0;
  for(const sc of cfg){
    if(!sc||!sc.active||!Array.isArray(sc.exercises)) continue;
    // UNE SEMAINE DE DECHARGE N'EST PAS UNE SEMAINE CHARGEE. Le creneau porte
    // deja le drapeau : le compter reviendrait a signaler comme lourde une
    // semaine dont tout le propos est d'alleger.
    if(creneauEnDecharge(sc)) continue;
    for(const e of (sc.exercises||[])){
      const r=regleMethode(e,u);
      if(!r) continue;
      total+=Number(r.coutFatigue)||0; n++;
      detail[r.cle]=(detail[r.cle]||0)+1;
    }
  }
  return {total:total,detail:detail,n:n};
}
// PURE. La phrase de la fiche client, ou ''. UNE PHRASE, PAS UNE ALERTE : le
// coach sait ce qu'il fait, il a juste besoin de le voir.
function phraseChargeMethodes(user){
  const c=chargeMethodesSemaine(user);
  if(c.total<=METH_CHARGE_SEMAINE_MAX) return '';
  return 'Semaine chargée en techniques d’intensification : '+c.n+' méthode'
    +(c.n>1?'s':'')+' posée'+(c.n>1?'s':'')+', coût cumulé '+c.total+'.';
}

// ── LE PASSAGE OUTRE, ET SA TRACE ──────────────────────────────────────
//
// UN JOURNAL A PART, ET C'EST DELIBERE. `ecartsSeance` porte les
// remplacements decides par l'ATHLETE debout dans sa salle ; `ajustHisto`
// porte les ajustements de NUTRITION et se vide a douze entrees. Un coach qui
// passe outre une regle d'emploi est un troisieme fait : le ranger dans l'un
// des deux le rendrait illisible, et le plafond de douze le ferait disparaitre.
const METH_FORCE_MAX=40;
function forcerMethode(user,ex,evaluation){
  const u=_dossier(user);
  if(!u||!ex) return {ok:false};
  const ev=evaluation||{};
  if(!Array.isArray(u.methodesForcees)) u.methodesForcees=_tabBloc(u.methodesForcees);
  u.methodesForcees.push({date:Date.now(),
    methode:String(ex.methode||''),
    regle:String((ev.regle&&ev.regle.cle)||''),
    exercice:String(ex.name||''),
    codes:(ev.raisons||[]).map(r=>String(r.code)).slice(0,6),
    phrase:String(ev.phrase||'')});
  if(u.methodesForcees.length>METH_FORCE_MAX)
    u.methodesForcees=u.methodesForcees.slice(-METH_FORCE_MAX);
  // LE DEPASSEMENT SE POSE SUR L'EXERCICE, pas seulement dans le journal :
  // sans ca l'editeur reposerait la question a chaque ouverture, et le coach
  // finirait par ne plus la lire.
  ex.methodeForcee=true;
  try{ saveUser(); }catch(e){ rcErreurMuette('forcerMethode',e); }
  return {ok:true};
}
// PURE. Les depassements des sept derniers jours, pour la fiche client.
function resumeMethodesForcees(user,maintenant){
  const u=_dossier(user);
  const t=Number(maintenant)||Date.now();
  const l=_tabBloc(u&&u.methodesForcees).filter(x=>x&&x.date>t-7*86400000);
  return l;
}
// LA LISTE DES TECHNIQUES EST L'OUTIL DU COACH, ET CELUI D'ULTIME.
// Demande de Kevin, 25/08/2026 : « la liste des techniques d'intensification
// doit être disponible uniquement aux coachs ; les athlètes sont obligés de
// taper manuellement s'ils veulent mettre une technique ». C'est la même règle
// que pour le guide des exercices, tranchée la veille : le catalogue est la
// référence du coach, l'élève écrit à la main.
//
// ⚠ LOT 3 : « l'élève » reste vrai de la formule Essentielle, qui écrit sa
//   technique à la main comme avant. Ultime, elle, choisit dans la liste : ce
//   catalogue fait partie de ce qu'elle paie. La capacité décide, pas le rôle.
//
// Même convention d'appel que peutConsulterBanque : `undefined` désigne
// l'utilisateur courant, `null` désigne PERSONNE. Les confondre ferait
// répondre « oui » à une question posée sur aucun dossier.
function peutChoisirTechnique(user){
  const u=(user===undefined)?currentUser:user;
  if(!u) return false;
  if(u.role==='coach') return true;
  try{ return !!peut(u,'bibliothequeMethodes'); }catch(e){ return false; }
}
// CE QUE L'ATHLÈTE VOIT À LA PLACE. Il n'a plus le catalogue, mais il continue
// de LIRE ce que son coach a prescrit : le nom, la consigne, la vidéo, et sur
// quelles séries. Masquer la prescription en même temps que le sélecteur
// reviendrait à lui cacher son propre programme.
function _techniqueLecture(ex,i,m,cardio){
  if(!m){
    // Rien de posé : on lui dit où écrire, et une seule fois — sur du cardio
    // aucune de ces méthodes n'a de sens, la phrase n'aurait rien à désigner.
    if(cardio) return '';
    return `<div style="margin-bottom:10px;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6">`
      +`Pour poser une technique d'intensification, écris-la dans « Description / Technique », plus bas.</div>`;
  }
  const s=String((ex&&ex.methodeSeries)||'').trim();
  return `<div style="margin-bottom:10px">
    <label>Technique</label>
    <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px">
      <div style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">${escapeHtml(m.nom)}${m.sous?`<span style="font-weight:400;color:var(--sub)"> · ${escapeHtml(m.sous)}</span>`:''}</div>
      ${s?`<div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:4px">Séries : ${escapeHtml(s)}</div>`:''}
      <div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.6;margin-top:6px">${escapeHtml(m.desc)}
        ${videoTechnique(m)?`<a href="${safeUrl(videoTechnique(m))}" target="_blank" rel="noopener" style="color:var(--link);white-space:nowrap">· voir la vidéo</a>`:''}</div>
    </div>
    ${_avertissementTechnique(ex,i)}
  </div>`;
}
// Le sélecteur est désactivé sur un exercice cardio : aucune de ces méthodes
// n'a de sens sur du vélo, et proposer un choix inopérant est pire que rien.
// `partie` (01/10/2026) : la carte du coach pose le CHOIX sur la ligne de la
// charge et du RIR cibles, et la SUITE (description, séries visées, règle,
// avertissement) dessous, sur toute la largeur. Sans `partie`, tout d'un bloc.
function _selecteurTechnique(ex,i,partie){
  const cardio=(()=>{ try{ return isCardio(ex); }catch(e){ return false; } })();
  const m=methodeDe(ex);
  if(!peutChoisirTechnique()) return _techniqueLecture(ex,i,m,cardio);
  const cles=Object.keys(TECHNIQUES);
  const sel=ex&&ex.methode&&TECHNIQUES[ex.methode]?ex.methode:'';
  // ⚠ UNE LISTE DESSINÉE, PLUS UN <select> (01/10/2026). Une option native ne
  //   porte qu'un texte, d'une seule graisse : « Dropset type 1 (3 x 12
  //   répétitions) » ne disait pas ce que la méthode fait. Chaque ligne est
  //   « Nom : ce qu'elle fait », le nom en petit, l'explication plus petite et
  //   plus fine, sur UNE ligne (nowrap, l'ellipse en dernier recours).
  //   <details> : natif, refermable, atteignable au clavier, sans une ligne de
  //   JS pour l'ouvrir ; le choix passe par _progExTechnique, comme avant.
  const ligne=(k,nom,court)=>`<button type="button" role="option" class="tq-o" data-v="${k}" aria-selected="${sel===k?'true':'false'}"`
    +` onclick="_progExTechnique(${i},'${k}')"><b>${escapeHtml(nom)}</b>${court?`<span> : ${escapeHtml(court)}</span>`:''}</button>`;
  const opts=ligne('','Aucune','série normale')
    +cles.map(k=>ligne(k,TECHNIQUES[k].nom,techniqueCourt(k))).join('');
  const courant=sel?[TECHNIQUES[sel].nom,techniqueCourt(sel)]:['Aucune','série normale'];
  const choix=`
    <label>Technique ${cardio?'<span style="font-size:var(--fs-xs);color:var(--sub);text-transform:none">(sans objet sur du cardio)</span>':''}</label>
    <details class="tq"${cardio?' data-inactif="1"':''}>
      <summary class="tq-s"${cardio?' tabindex="-1" aria-disabled="true"':''}><b>${escapeHtml(courant[0])}</b>${courant[1]?`<span> : ${escapeHtml(courant[1])}</span>`:''}<i aria-hidden="true">▾</i></summary>
      ${cardio?'':`<div class="tq-l" role="listbox" aria-label="Technique d’intensification">${opts}</div>`}
    </details>`;
  const suite=`
    ${m?`<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.6;margin-top:6px">${escapeHtml(m.desc)}
      ${videoTechnique(m)?`<a href="${safeUrl(videoTechnique(m))}" target="_blank" rel="noopener" style="color:var(--link);white-space:nowrap">· voir la vidéo</a>`:''}</div>`:''}
    <!-- SUR QUELLE(S) SÉRIE(S). Une méthode se pose rarement sur les quatre :
         c'est la dernière, ou les deux dernières. Le coach l'écrivait dans la
         description, ou pas du tout. Affiché SEULEMENT quand une méthode est
         posée : le champ seul ne décrirait rien. -->
    ${m?`<div style="margin-top:8px">
      <label style="font-size:var(--fs-xs);letter-spacing:1px;text-transform:uppercase;color:var(--sub);font-weight:700">Sur quelle(s) série(s)</label>
      <input value="${escapeHtml((ex&&ex.methodeSeries)||'')}" maxlength="40"
        onchange="_progExDirty=true;progEx[${i}].methodeSeries=this.value;renderProgEx()"
        placeholder="dernière · 3 et 4 · toutes" class="f-sm" style="margin-top:4px">
    </div>`:''}
    ${_blocRegleMethode(ex,i)}
    ${_avertissementTechnique(ex,i)}`;
  if(partie==='choix') return `<div class="px-tq">${choix}</div>`;
  if(partie==='suite') return `<div style="margin-bottom:10px">${suite}</div>`;
  return `<div style="margin-bottom:10px">${choix}${suite}</div>`;
}
// L'EVALUATION TELLE QUE L'EDITEUR LA POSE. Elle porte le contexte que les
// fonctions pures ne peuvent pas deviner : sur QUEL athlete on prescrit, et
// quel creneau est ouvert — celui de l'ecran remplace celui de la
// configuration enregistree, sinon le plafond hebdomadaire ne se declencherait
// qu'apres sauvegarde.
function _evaluerMethodeEditeur(ex){
  const cible=_cibleContraintes();
  // AUCUN ATHLETE : un modele de programme n'est rattache a personne. Pas de
  // bloc, pas de creneaux, pas de grille — donc rien a evaluer, et surtout
  // rien a refuser. Meme regle que _blocAvertissementContrainte juste a cote.
  if(!cible) return {ok:true,regle:null};
  let idx=null;
  try{ if(typeof _progEditorCtx.sessionIdx==='number'
          &&_progEditorCtx.mode!=='template') idx=_progEditorCtx.sessionIdx; }catch(e){}
  try{
    return evaluerMethode(ex,cible,
      {creneauEdite:idx,exercicesEdites:(typeof progEx!=='undefined'?progEx:null)});
  }catch(e){ return {ok:true,regle:null}; }
}
// LE BLOC DE REFUS. Il DIT, il propose de passer outre, et il ne bloque rien
// d'autre : le selecteur reste utilisable, la methode reste posee.
function _blocRegleMethode(ex,i){
  if(!ex||!ex.methode) return '';
  // DEPASSEMENT DEJA ASSUME : on rappelle la decision au lieu de reposer la
  // question a chaque ouverture de l'editeur — meme geste que la
  // justification de contrainte, quinze lignes plus bas.
  if(ex.methodeForcee){
    return '<div style="margin-top:6px;background:var(--surface-2);border:1px solid var(--border);'
      +'border-radius:var(--r-2);padding:8px 10px;font-size:var(--fs-2xs);color:var(--sub);line-height:1.55">'
      +'Règle d’emploi passée outre. C’est enregistré dans la fiche.'
      +'<button onclick="_annulerForcageMethode('+i+')" style="background:none;border:none;padding:0 0 0 6px;'
      +'color:var(--link);font-size:var(--fs-2xs);cursor:pointer">revoir</button></div>';
  }
  const ev=_evaluerMethodeEditeur(ex);
  if(ev.ok) return '';
  return '<div style="margin-top:6px;background:var(--warning-bg);border:1px solid var(--warning-border);'
    +'border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-2xs);color:var(--text);line-height:1.6">'
    +escapeHtml(ev.phrase)
    +'<div style="margin-top:8px"><button onclick="_forcerMethode('+i+')" '
    +'style="background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);'
    +'font-family:inherit;font-size:var(--fs-2xs);padding:6px 10px;cursor:pointer">Poser quand même</button></div>'
    +'</div>';
}
function _forcerMethode(i){
  const ex=progEx&&progEx[i];
  if(!ex) return false;
  const cible=_cibleContraintes();
  const ev=_evaluerMethodeEditeur(ex);
  _progExDirty=true;
  // LE JOURNAL VIT SUR LE DOSSIER DE L'ATHLETE, pas sur le brouillon
  // d'editeur : c'est une decision prise SUR LUI, et elle doit survivre a
  // l'abandon des modifications en cours.
  if(cible) try{ forcerMethode(cible,ex,ev); }catch(e){}
  ex.methodeForcee=true;
  renderProgEx();
  return true;
}
function _annulerForcageMethode(i){
  const ex=progEx&&progEx[i];
  if(!ex) return false;
  _progExDirty=true;
  delete ex.methodeForcee;
  // LA TRACE RESTE. Revoir sa decision ne l'efface pas du journal : le
  // depassement a eu lieu, et le journal dit ce qui s'est passe, pas ce que
  // l'on pense aujourd'hui.
  renderProgEx();
  return true;
}
// Avertissements de l'éditeur. Ils DÉCRIVENT une situation inhabituelle, ils
// n'empêchent rien : c'est le coach qui décide.
function _avertissementTechnique(ex,i){
  if(!ex) return '';
  const av=[];
  const fam=techniqueDe(ex);
  if(fam==='superset'&&!ex.ss&&!(progEx[i+1]&&progEx[i+1].ss)){
    av.push('Cette méthode enchaîne deux exercices, mais celui-ci n\'est chaîné à aucun autre. Utilise le bouton de liaison entre deux cartes.');
  }
  // Deux exercices supersetés sur le MÊME muscle : autorisé, mais le volume
  // comptera bien deux séries dures pour ce muscle. On le dit.
  if(ex.ss&&progEx[i-1]){
    try{
      const a=resoudreMusclesLecture(ex.name,ex,currentUser);
      const b=resoudreMusclesLecture(progEx[i-1].name,progEx[i-1],currentUser);
      const communs=((a&&a.p)||[]).filter(m=>((b&&b.p)||[]).includes(m));
      if(communs.length) av.push('Chaîné avec un exercice qui travaille le même muscle ('
        +communs.map(m=>(MUSCLES[m]||{}).lib||m).join(', ')+') : le volume comptera deux séries dures pour ce muscle.');
    }catch(e){}
  }
  if(fam==='isometrie') av.push('Le champ Reps se lit en SECONDES pour cette méthode.');
  if(!av.length) return '';
  return av.map(t=>`<div style="margin-top:6px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:8px 10px;font-size:var(--fs-2xs);color:var(--sub);line-height:1.5">${escapeHtml(t)}</div>`).join('');
}
function _progExTechnique(i,cle){
  if(!progEx[i]) return;
  // LE CATALOGUE NE S'ECRIT QUE DEPUIS UN DOSSIER DE COACH. Le selecteur
  // n'est deja plus rendu pour un athlete ; cette garde est la pour que la
  // regle tienne meme si l'appel arrive d'ailleurs — un gabarit garde en
  // cache, un rendu a moitie remplace. Sans elle, la restriction ne serait
  // qu'un habillage.
  if(!peutChoisirTechnique()) return;
  _progExDirty=true;
  // ⚠ LE DEPASSEMENT PORTAIT SUR L'ANCIENNE METHODE. Le garder ferait taire
  // la regle de la NOUVELLE, qui n'a jamais ete evaluee : le coach aurait
  // passe outre une chose et obtenu le silence sur une autre.
  delete progEx[i].methodeForcee;
  if(cle&&TECHNIQUES[cle]){
    progEx[i].methode=cle;
    // Superset et triset SONT le chaînage : on le pose, plutôt que d'ajouter
    // un second mécanisme qui pourrait le contredire.
    if(TECHNIQUES[cle].famille==='superset'&&i>0&&!progEx[i].ss) progEx[i].ss=true;
  } else {
    delete progEx[i].methode;
    // L’adresse décrivait une méthode qui n’est plus là : la garder ferait
    // « séries : dernière » sans dire dernière de QUOI.
    delete progEx[i].methodeSeries;
  }
  renderProgEx();
}

// Ajoute un exercice de la banque a la fin du programme en cours.
//
// ON RECOPIE le nom, l'execution et le repos dans progEx, et on GARDE le
// slug a cote. La recopie n'est pas un choix esthetique : l'athlete n'a pas
// acces a la banque — la regle RTDB la lui ferme — et il n'y a pas de
// serveur pour hydrater sa seance. Sans copie, il verrait une ligne sans
// consigne. Le slug, lui, sert a retrouver l'illustration, qui est publique.
//
// Consequence assumee, deja dite au lot 1 : corriger une description dans la
// banque ne met pas a jour les seances deja ecrites.
// PURE. La fiche de banque, posee sur un exercice existant. Ne mute rien :
// rend un objet neuf, comme le fait deja dupliquerSeance.
// Le repos de la fiche n'ecrase PAS celui du coach : la fiche decrit le
// mouvement en general, le coach a regle SA seance.
function exRemplaceParFiche(ex,f){
  const src=(ex&&typeof ex==='object')?ex:{};
  if(!f||!f.nom) return Object.assign({},src);
  return Object.assign({},src,{
    name:f.nom,
    description:f.execution||'',
    materiel:f.materiel||'',
    videoUrl:(f.videos&&f.videos[0])?('https://youtu.be/'+f.videos[0].id):'',
    videoUrl2:(f.videos&&f.videos[1])?('https://youtu.be/'+f.videos[1].id):'',
    exSlug:f.slug,
    // L'IMAGE EST RETIREE, pas remplacee. Une photo collee a la main sur
    // l'ancien mouvement montrerait l'ancien mouvement sous le nouveau nom :
    // c'est le slug qui va chercher l'illustration du guide.
    image:null
  });
}
// PURE. La fiche posee sur un exercice existant SANS toucher a son nom.
// Meme exercice, donc meme identite, donc memes suggestions de charge, memes
// records, meme detection de plateau. Il gagne seulement ce que le guide sait
// de lui : la photo — par le slug —, les videos, l'execution, le materiel.
function exMisAJourParFiche(ex,f){
  const src=(ex&&typeof ex==='object')?ex:{};
  if(!f||!f.nom) return Object.assign({},src);
  const maj=exRemplaceParFiche(src,f);
  // LE NOM NE BOUGE PAS. C'est toute la difference avec le remplacement, et
  // c'est ce que « juste une mise a jour » veut dire.
  maj.name=src.name;
  return maj;
}
// Remplacer l'exercice de rang `i` depuis la bibliotheque du guide.
// `mode` vaut 'remplacer' — un autre mouvement — ou 'maj' — le meme, enrichi.
async function remplacerDepuisBanque(i,mode){
  if(!peutConsulterBanque()){ toast('Réservé aux coachs.','var(--orange)'); return false; }
  const maj=(mode==='maj');
  const ex=Array.isArray(progEx)?progEx[i]:null;
  if(!ex){ toast('Exercice introuvable : rouvre la séance.','var(--orange)'); return false; }
  if(maj&&!String(ex.name||'').trim()){
    toast('Nomme d’abord l’exercice : la mise à jour garde son nom.','var(--orange)');
    return false;
  }
  // UN NOM DEJA ECRIT NE SE REMPLACE PAS SANS DEMANDER. Meme discipline que
  // _confirmerEcrasement pour un jour deja garni.
  const nom=String(ex.name||'').trim();
  const nl=String.fromCharCode(10);
  if(maj){
    if(!await rcConfirm('Mettre à jour « '+nom+' » ?'+nl+nl
      +'Il garde son nom, donc son historique et ses suggestions de charge. Il '
      +'reçoit la photo, les vidéos et l’exécution de la fiche que tu vas '
      +'choisir.',null,'Choisir la fiche')) return false;
  } else if(nom){
    if(!await rcConfirm('Remplacer « '+nom+' » ?'+nl+nl
      +'Le mouvement change : nom, photo, vidéos, exécution. C’est un AUTRE '
      +'exercice : son historique de charge repart de zéro. Tes séries, reps, '
      +'repos et RIR cible sont conservés.',null,'Choisir dans la bibliothèque')) return false;
  }
  return ouvrirBanque(f=>{
    // Le rang est relu a l'arrivee : entre le depart vers la banque et le
    // retour, rien ne reordonne progEx — mais un exercice supprime depuis un
    // autre onglet laisserait un trou, et on ecrirait a cote.
    if(!Array.isArray(progEx)||!progEx[i]){
      toast('Exercice introuvable : il a été retiré entre-temps.','var(--orange)');
      return;
    }
    progEx[i]=maj?exMisAJourParFiche(progEx[i],f):exRemplaceParFiche(progEx[i],f);
    _progExDirty=true;
    renderProgEx();
    setTimeout(()=>{ _viserOuLeDire(progEx[i].name); },60);
    // CE QUI EST ARRIVE, ET CE QUI MANQUAIT. Une fiche peut etre illustree
    // sans etre filmee, ou l'inverse : le dire evite de chercher pourquoi.
    const _ap=progEx[i];
    const _photo=(()=>{ try{ return !!illustrationExo(_ap); }catch(e){ return false; } })();
    const _nv=(()=>{ try{ return videosExo(_ap).length; }catch(e){ return 0; } })();
    const _dit=[_photo?'photo':'', _nv?(_nv+' vidéo'+(_nv>1?'s':'')):''].filter(Boolean).join(' · ')
      ||'aucun média sur cette fiche';
    toast(maj
      ?('« '+_ap.name+' » mis à jour '+ICO.coche+' : historique conservé · '+_dit)
      :('Remplacé par « '+f.nom+' » '+ICO.coche+' · '+_dit),
      (_photo||_nv)?'var(--green)':'var(--orange)');
  },'s-coach-program');
}
function ajouterDepuisBanque(){
  return ouvrirBanque(f=>{
    if(!Array.isArray(progEx)) progEx=[];
    const _v=exerciceVierge(_coachPrescription());
    progEx.push({
      name:f.nom,
      series:_v.series, reps:_v.reps, repos:f.repos||_v.repos, rir:_v.rir,
      description:f.execution||'',
      // LE MATÉRIEL DE LA FICHE. Il se retapait dans le NOM de l'exercice —
      // le placeholder du champ nom disait « (MATÉRIELS) » — alors que la
      // banque le porte déjà. Pré-rempli, et modifiable dans l’éditeur : la
      // fiche décrit le mouvement en général, le coach connaît SA salle.
      materiel:f.materiel||'',
      // videoUrl est le champ que la vue seance lit deja : on ne cree pas
      // un second canal pour la meme chose.
      videoUrl:(f.videos&&f.videos[0])?('https://youtu.be/'+f.videos[0].id):'',
      // LA SECONDE VIDÉO, quand la fiche en porte une. La vue en séance sait
      // déjà l’afficher (« ▶ VIDÉO 2 ») : elle était simplement perdue à
      // l’import, et rien ne permettait de la saisir à la main.
      videoUrl2:(f.videos&&f.videos[1])?('https://youtu.be/'+f.videos[1].id):'',
      exSlug:f.slug,
      image:null
    });
    _progExDirty=true;
    renderProgEx();
    toast('« '+f.nom+' » ajouté '+ICO.coche,'var(--green)');
  },'s-coach-program');
}
// ══ LA SILHOUETTE DANS L'ÉDITEUR DU COACH (01/10/2026) ═══════════════════
// Kevin : « sur la page création du programme par le coach, stylise ça comme
// les pages athlète, avec les images des muscles ». La même silhouette que la
// séance de l'athlète (woSrcAvatar, woHtmlZones) : ses muscles PRIMAIRES
// allumés, de dos quand ils sont tous dorsaux. Le coach voit, en composant, ce
// que chaque exercice travaille — et un nom que l'app ne reconnaît pas se
// repère tout de suite : la silhouette reste éteinte.
// ⚠ PAS la classe .wo-ava : woMajAvatar retire toutes les .wo-ava de la page
//   sauf la première, et un athlète qui édite sa séance puis la lance aurait
//   vu la silhouette de la séance partir à la place de celles-ci.
// L'athlète dont on compose le programme ; pour un modèle, le genre du modèle.
function _pxPorteur(){
  try{
    if(currentUser&&currentUser.role==='coach'&&currentClientId){
      const c=getOwnedClient(currentClientId); if(c) return c;
    }
  }catch(e){}
  return currentUser;
}
function _pxGenreAvatar(){
  try{
    if(_progEditorCtx&&_progEditorCtx.mode==='template'&&_progEditorCtx.gender!=null)
      return isFemale(_progEditorCtx.gender)?'f':'h';
  }catch(e){}
  return woGenreAvatar(_pxPorteur());
}
function _pxHtmlAvatar(ex){
  try{
    const mus=(ex&&ex.name)?woMusclesAvatar(ex,_pxPorteur()):[];
    const vue=woVueAvatar(mus), g=_pxGenreAvatar();
    const src=woSrcAvatar(WO_AVA_NIV,g,vue);
    return '<img class="wo-ava-img" alt="" aria-hidden="true" src="'+src+'">'+woHtmlZones(mus,src,vue,WO_AVA_NIV,g);
  }catch(e){ return ''; }
}
// Les muscles, en toutes lettres : les primaires, puis les secondaires en retrait.
function _pxHtmlMuscles(ex){
  try{
    if(!ex||!ex.name) return '<span class="px-mus-v">Écris le nom de l’exercice : ses muscles s’afficheront ici.</span>';
    const cls=resoudreMusclesLecture(ex.name,ex,_pxPorteur());
    const lib=m=>escapeHtml((MUSCLES[m]&&MUSCLES[m].lib)||m);
    const p=(cls&&cls.p)||[], sec=(cls&&cls.s)||[];
    if(!p.length&&!sec.length) return '<span class="px-mus-v">Muscles non reconnus pour ce nom.</span>';
    return '<b>'+p.map(lib).join(' · ')+'</b>'+(sec.length?'<span class="px-mus-s"> + '+sec.map(lib).join(', ')+'</span>':'');
  }catch(e){ return ''; }
}
// Le nom vient de changer : la silhouette et la ligne des muscles suivent.
function _pxMajMuscles(i){
  const ex=progEx[i];
  const a=document.getElementById('px-ava-'+i), m=document.getElementById('px-mus-'+i);
  if(a) a.innerHTML=_pxHtmlAvatar(ex);
  if(m) m.innerHTML=_pxHtmlMuscles(ex);
}
function renderProgEx(){
  // Lu UNE FOIS pour tout le rendu : peutConsulterBanque relit currentUser a
  // chaque appel, et une carte de dix exercices l'appellerait dix fois.
  const _bqDispo=(()=>{ try{ return !!peutConsulterBanque(); }catch(e){ return false; } })();
  // Le menu de technique (coach) partage la ligne de la charge et du RIR cibles.
  const _tqMenu=(()=>{ try{ return !!peutChoisirTechnique(); }catch(e){ return false; } })();
  // Le bouton n'apparait qu'a qui a le catalogue (un coach, ou Ultime).
  const _bq=document.getElementById('prog-banque');
  if(_bq) _bq.style.display=_bqDispo?'block':'none';
  // ET A SA PLACE, LE VERROU (lot 4) : c'est ici, devant le champ du nom, que
  // la question se pose. La phrase dit ce qui est ferme et ce qu'on peut
  // faire a la place — ecrire le nom soi-meme, ce que le champ juste en
  // dessous permet deja.
  const _bqv=document.getElementById('prog-banque-verrou');
  if(_bqv) _bqv.innerHTML=_bqDispo?'':(rcVerrou('bibliothequeExercices')||'');
  // Et les commandes d'extraction disparaissent tant que LEGACY_PDF_IMPORT
  // est baisse. Ici et non a l'ouverture de l'ecran : renderProgEx est le
  // seul point par lequel TOUS les chemins d'edition passent.
  try{ _appliquerDeprecationImport(); }catch(e){}
  setTimeout(()=>{try{_rendreSuggestionsProto();}catch(e){}},0);
  // Sync chips
  for(let n=1;n<=10;n++){const c=document.getElementById('exo-chip-'+n);if(c)c.classList.toggle('active',n===progEx.length);}
  _normaliserSS(progEx);
  const _grs=_groupesEx(progEx);
  document.getElementById('prog-exercises').innerHTML=progEx.map((ex,i)=>{
    const pr=parseReps(ex.reps);
    const enSS=_grs.some(g=>g.length>1&&g.includes(i));
    // Seule la tête d'un groupe porte la poignée : un superset se déplace d'un
    // bloc, et pour en sortir un exercice il y a le bouton DÉLIER.
    const gi=_grs.findIndex(g=>g.includes(i));
    const estTete=gi>=0&&_grs[gi][0]===i&&_grs.length>1;
    // Bandeau d'appariement au-dessus de chaque exercice sauf le premier :
    // c'est l'espace ENTRE deux exercices qu'on lie ou qu'on délie.
    const lien=i===0?'':`<div style="display:flex;align-items:center;gap:8px;margin:-6px 0 8px">
      <div style="flex:1;height:1px;background:${ex.ss?'var(--orange)':'var(--border)'}"></div>
      <button onclick="_basculerSS(${i})" style="background:${ex.ss?'#1a0f00':'var(--surface-1)'};border:1px solid ${ex.ss?'var(--orange)':'var(--border)'};color:${ex.ss?'var(--orange)':'var(--sub)'};border-radius:var(--r-4);padding:4px 12px;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;cursor:pointer;font-family:Montserrat,sans-serif;white-space:nowrap">${ex.ss?icon('echange',14)+' SUPERSET · DÉLIER':'+ SUPERSET'}</button>
      <div style="flex:1;height:1px;background:${ex.ss?'var(--orange)':'var(--border)'}"></div>
    </div>`;
    // Le badge de METHODE prime : il porte le nom exact du guide. Les badges
    // de FORME (plage, unilateral) restent pour tout le reste.
    const _bTech=badgeTechnique(ex);
    const badge=_bTech?_bTech:
      pr.type==='degressive'?`<span style="background:#7c2d12;color:#fca5a5;padding:2px 8px;border-radius:var(--r-2);font-size:var(--fs-xs);font-weight:700">DÉGRESSIVE</span>`:
      pr.type==='unilateral'?`<span style="background:#1e3a5f;color:#93c5fd;padding:2px 8px;border-radius:var(--r-2);font-size:var(--fs-xs);font-weight:700">UNILATÉRAL</span>`:
      pr.type==='range'?`<span style="background:#1a3322;color:#86efac;padding:2px 8px;border-radius:var(--r-2);font-size:var(--fs-xs);font-weight:700">PLAGE</span>`:'';
    return `${lien}
    <div id="px-carte-${i}" data-px-idx="${i}" data-ex-nom="${escapeHtml(ex.name||'')}" style="background:var(--surface-1);border-radius:var(--r-4);margin-bottom:14px;overflow:hidden;border:1px solid ${enSS?'var(--orange)':'var(--border)'}">
      <!-- Numéro + Nom, et la silhouette de l'athlète (01/10/2026) : la même
           tête que sur sa page de séance, nom en rouge et muscles allumés. -->
      <div class="px-tete">
      <div class="px-tete-g">
      <div class="px-tete-l1">
        <div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">
          ${estTete?`<button type="button" class="px-poignee" aria-label="Déplacer ${escapeHtml(ex.name||'cet exercice')}" onpointerdown="_pxDragDebut(event,${i})">⠿</button>
          <span style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
            <button type="button" class="px-mini" onclick="_pxDeplacerParFleche(${i},-1)" ${gi===0?'disabled':''} aria-label="Monter">▲</button>
            <button type="button" class="px-mini" onclick="_pxDeplacerParFleche(${i},1)" ${gi===_grs.length-1?'disabled':''} aria-label="Descendre">▼</button>
          </span>`:''}
          <span class="px-num">${_repereEx(progEx,i)}</span>
        </div>
        <!-- LE NOM À CÔTÉ DU NUMÉRO, EN GRAND ET EN BLANC, et « Remplacer » /
             « Mettre à jour » sur la MÊME ligne (Kevin, 01/10/2026) : ils
             vivaient un rang plus bas, sous un titre « Changer l'exercice ».
             Sur un téléphone la rangée se replie : le nom garde la première
             ligne, les boutons passent dessous. -->
        <input value="${escapeHtml(ex.name||'')}" onchange="_progExDirty=true;progEx[${i}].name=this.value.toUpperCase();this.value=this.value.toUpperCase();_pxMajMuscles(${i})" placeholder="NOM DE L'EXERCICE" class="f-inline px-nom" style="font-family:Montserrat,sans-serif;outline:none;text-transform:uppercase;flex:1 1 150px;min-width:0;box-sizing:border-box">
        ${_bqDispo?`<span class="px-cmd-bq">
          <span class="px-cmd">
          <button type="button" class="px-b-blanc" onclick="remplacerDepuisBanque(${i},'remplacer')">Remplacer</button>
          <button type="button" class="px-b-blanc" onclick="remplacerDepuisBanque(${i},'maj')">Mettre à jour</button>
          </span>
          <!-- L'EXPLICATION, SOUS LES DEUX BOUTONS QU'ELLE EXPLIQUE (Kevin,
               01/10/2026) : elle était au-dessus de « Séries », un rang plus
               bas que les boutons. Toujours repliée (B2.10 : quarante mots
               répétés dans chaque carte reculaient la prescription), toujours
               à un clic, et le texte n'est ni raccourci ni réécrit. -->
          <details class="px-diff">
            <summary>Remplacer ou mettre à jour : quelle différence ?</summary>
            <div><b>Remplacer</b> : un autre mouvement, l'historique repart de zéro. <b>Mettre à jour</b> : le même, qui gagne la photo et les vidéos du guide et garde ses suggestions de charge. Ou tape son nom au-dessus.</div>
          </details>
        </span>`:''}
        <span class="px-cmd px-cmd-ed">
          <button onclick="_dupliquerExUI(${i})" aria-label="Dupliquer cet exercice" title="Dupliquer" style="background:color-mix(in srgb,var(--text) 13.3%,transparent);border:none;color:var(--text);font-size:var(--fs-xs);font-weight:800;cursor:pointer;border-radius:var(--r-3);height:24px;padding:0 10px;display:flex;align-items:center;justify-content:center;font-family:inherit">Copie</button>
          <button onclick="_supprimerEx(${i})" aria-label="Supprimer cet exercice" style="background:color-mix(in srgb,var(--text) 13.3%,transparent);border:none;color:var(--text);font-size:var(--fs-md);cursor:pointer;border-radius:var(--r-full);width:24px;height:24px;display:flex;align-items:center;justify-content:center">${icon('trash',13)}</button>
        </span>
      </div>
      <div class="px-mus" id="px-mus-${i}">${_pxHtmlMuscles(ex)}</div>
      </div>
      <div class="px-ava" id="px-ava-${i}">${_pxHtmlAvatar(ex)}</div>
      </div>
      <div style="padding:12px">
        ${_htmlMorphoExercice(ex)}
        <!-- DEUX FACONS DE CHANGER D'EXERCICE, et elles sont dites. A la main,
             c'est le champ du nom juste au-dessus : il a toujours marche, mais
             rien ne le presentait comme un choix. Depuis la bibliotheque,
             c'est le bouton : la fiche du guide arrive avec sa photo, ses
             liens video et son execution.
             RESERVE AUX COACHS : la banque leur est fermee cote athlete, et le
             bouton n'apparait donc pas dans SON editeur de seance. -->
        <!-- SÉRIES / RÉPÉTITIONS / REPOS, TROIS CASES DE MÊME LARGEUR.
             LE TITRE « PRESCRIPTION » EST PARTI (Kevin, 15/09/2026) : il nommait
             un groupe dont le contenu se nomme déjà lui-même, et il coûtait un
             rang en haut de chaque carte.
             TROIS COLONNES ÉGALES et non 1fr 2fr 1fr : la case du milieu portait
             un libellé de soixante caractères, « Reps (ex: 10 PUIS 20 / 6-8 /
             15 Par Jambe) », qui passait à la ligne et décalait son champ d'un
             rang par rapport à ses deux voisins. Le libellé se réduit au mot,
             les trois champs retombent sur la même ligne.
             L'EXEMPLE N'EST PAS PERDU : le cas courant reste en placeholder et
             les trois formes reconnues passent en infobulle. Les écrire toutes
             dans le placeholder les aurait fait tronquer : trente et un
             caractères dans un champ de 106 px. -->
        <!-- 01/10/2026 (Kevin) : LES TROIS CASES VONT JUSQU'AU BORD. « Repos » était
             borné à 220 px (.px-court) et laissait un vide à droite ; .px-l1 lève
             la borne, et le champ est centré comme ses deux voisins. -->
        <div class="px-l1" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
          <div><label style="margin-top:0">Séries</label><input type="number" min="1" max="20" value="${ex.series||3}" onchange="_progExSeries(${i},this)" class="f-c"></div>
          <div>
            <label style="margin-top:0">Répétition</label>
            <input value="${escapeHtml(ex.reps||'')}" onchange="if(/^-\\d+$/.test(this.value.trim())){toast('Reps invalides : valeur négative non autorisée','var(--orange)');this.value=progEx[${i}].reps||'';return;}_progExDirty=true;progEx[${i}].reps=this.value" placeholder="10 PUIS 20" title="Exemples : 10 PUIS 20 (dégressive) · 6-8 (fourchette) · 15 par jambe (unilatéral)" class="f-c">
            <div style="margin-top:4px">${badge}</div>
          </div>
          <div><label style="margin-top:0">Repos</label><input class="px-court f-c" value="${escapeHtml(ex.repos||REPOS_DEFAUT)}" onchange="_progExDirty=true;progEx[${i}].repos=this.value" placeholder="${REPOS_DEFAUT}"></div>
        </div>
        <!-- CHARGE ET RIR CIBLES. Les deux étaient LUS depuis toujours,              _apLigne les affiche dans l’aperçu de séance, PP_COLS en fait
             deux colonnes de la fiche imprimable, et ÉCRITS nulle part.
             Le coach n’avait aucun moyen de prescrire une charge.

             « RIR CIBLE » et non « RIR » : ce champ-ci est la consigne du
             coach. Le RIR RÉALISÉ vit dans sets[i].rir, saisi en séance, et
             c’est LUI qui alimente multiplicateurRir, poidsIntensite, l’e1RM
             et la charge suggérée. Deux données différentes qui ne doivent
             jamais partager un champ, ni un libellé.

             Placés avec les séries, les reps et le tempo plutôt qu’avec le
             matériel : c’est la prescription du travail, pas de l’engin. -->
        <!-- 01/10/2026 (Kevin) : TECHNIQUE, CHARGE CIBLE, RIR CIBLE SUR UNE LIGNE,
             la technique en premier et plus longue que les deux autres, le RIR
             réduit. Pour le coach seulement : l'athlète n'a pas de menu de
             technique, sa ligne reste Charge + RIR. -->
        <div ${_tqMenu?'class="px-l2"':'style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px"'}>
          ${_tqMenu?_selecteurTechnique(ex,i,'choix'):''}
          <div>
            <label>Charge cible</label>
            <input class="px-court f-c" value="${escapeHtml(ex.charge||'')}" onchange="_progExDirty=true;progEx[${i}].charge=this.value" placeholder="Ex : 80 kg ou 75 %">
            ${_htmlRepereCharge(ex)}
          </div>
          <div>
            <!-- N6.3 : L'INTENSITE SE CHOISIT, elle ne se tape plus. Meme
                 echelle que le RIR que l'athlete saisit serie par serie : 0 est
                 l'echec, 5 est tres facile. Le champ vide vaut « pas de
                 consigne », et c'est le defaut.
                 UNE VALEUR HORS ECHELLE DEJA ECRITE EST GARDEE et signalee,
                 jamais effacee : un « 2-3 » tape a la main avant ce lot ne doit
                 pas disparaitre parce que la liste ne le connait pas. -->
            <label>RIR cible</label>
            <select class="f-c" onchange="_progExDirty=true;progEx[${i}].rir=this.value">
              ${_optionsRirCible(ex.rir)}
            </select>
            ${_direRirCible(ex.rir)?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.45;margin-top:4px">${escapeHtml(_direRirCible(ex.rir))}</div>`:''}
          </div>
        </div>
        <!-- LA TECHNIQUE D'INTENSIFICATION, AVEC LA PRESCRIPTION D'EFFORT.
             Elle etait rangee sous EXECUTION, apres le tempo et le materiel :
             le coach ne la trouvait pas. C'est une prescription d'effort, comme
             le RIR cible juste au-dessus, elle dit combien on force, pas
             comment on tient l'engin.
             MENU DEROULANT POUR LE COACH, LECTURE SEULE POUR L'ATHLETE :
             _selecteurTechnique s'en charge, et c'est la regle posee par Kevin
             le 25/08/2026, l'athlete qui veut une technique la tape dans la
             description. -->
        ${_tqMenu?_selecteurTechnique(ex,i,'suite'):_selecteurTechnique(ex,i)}
        ${_bqDispo?_htmlBoutonProgEx(ex,i):''}
        ${_bqDispo?_htmlAlternativesEx(ex,i):''}
        <div class="px-grp">EXÉCUTION</div>
        <!-- B2.3, TEMPO ET MATERIEL SE LISENT ENSEMBLE, donc ils se posent
             ensemble des qu'il y a la place. Le conteneur ne fait RIEN sous
             1025 px : deux div empiles, chacun avec sa marge, exactement comme
             avant. C'est la seule regle CSS qui le met en deux colonnes, et
             elle est bornee au coach. -->
        <!-- 01/10/2026 (Kevin) : TEMPO, MATÉRIEL, MUSCLES SUR UNE MÊME LIGNE (.px-l3).
             Tempo court, Matériel à côté, Muscles prend tout le reste. L'exemple
             « 3-1-1-0 » ne vit plus que dans la case ; dessous, en plus petit, ce
             que valent les quatre chiffres. .px-duo reste dans le rendu, sans
             boîte (display:contents) : ses deux enfants sont des cases de la ligne. -->
        <div class="px-l3">
        <div class="px-duo">
        <div class="px-tempo" style="margin-bottom:8px">
          <label style="margin-top:0">Tempo</label>
          <input class="px-court f-c" value="${escapeHtml(ex.tempo||'')}" onchange="_progTempoSaisie(${i},this)" placeholder="3-1-1-0" title="3-1-1-0 ou 3110 : descente, pause basse, montée, pause haute. Un autre texte est conservé tel quel.">
          <div class="px-sous">(descente, bas, montée, haut)</div>
        </div>
        <!-- Matériel : son propre champ depuis que la banque le pré-remplit.
             Il se retapait dans le NOM de l'exercice, ce qui le rendait
             illisible partout où le nom sert de clef. -->
        <div style="margin-bottom:8px">
          <label style="margin-top:0">Matériel</label>
          <input value="${escapeHtml(_materielMajuscule(ex.materiel))}" onchange="_progExDirty=true;this.value=_materielMajuscule(this.value);progEx[${i}].materiel=this.value" placeholder="Ex : Haltères, banc incliné">
        </div>
        </div>
        ${_ligneMuscles(ex,i)}
        </div>
        ${_blocAvertissementContrainte(ex,i)}
        <!-- Description technique -->
        <div style="margin-bottom:8px">
          <label style="margin-top:0">Description / Technique</label>
          <textarea rows="3" placeholder="Ex: Faire 10 répétitions lourdes buste droit puis diminuer la charge..." onchange="_progExDirty=true;progEx[${i}].description=this.value" class="f-sm" style="margin-top:4px;line-height:1.5">${escapeHtml(ex.description||'')}</textarea>
        </div>
        <div class="px-grp">MÉDIA</div>
        <!-- L'IMAGE ET LES DEUX VIDÉOS (Kevin, 01/10/2026).
             L'IMAGE EST CELLE DE L'EXERCICE : la photo posée à la main d'abord,
             sinon l'illustration du guide (illustrationExo, par le slug puis par
             le nom). La case restait vide pour tout exercice venu de la banque,
             dont l'image est justement retirée au profit du slug.
             DEUX LIENS, DEUX RÔLES, CÔTE À CÔTE : le premier montre comment
             EXÉCUTER le mouvement, le second explique la TECHNIQUE
             D'INTENSIFICATION posée sur l'exercice. C'est déjà ce que la séance
             en fait (videosExo lit videoUrl, videoMethodeExo lit videoUrl2) :
             seul le libellé « 2ᵉ lien vidéo (facultatif) » ne le disait pas. -->
        <div class="px-media">
          <label class="px-media-img" data-px-img="${i}" title="Changer l’image">
            <input type="file" accept="image/*" style="display:none" onchange="_progExDirty=true;loadExImage(${i},this)">
            ${_imgCarte(ex)?`<img src="${escapeHtml(_imgCarte(ex))}" alt="" loading="lazy">`:`<div class="px-media-vide"></div>`}
          </label>
          <div class="px-media-liens">
            ${_champVideoCarte(ex,i,'videoUrl','Vidéo d’exécution du mouvement','')}
            ${_champVideoCarte(ex,i,'videoUrl2','Vidéo de la technique d’intensification',_aideVideoMethode(ex))}
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
  const _bs=document.getElementById('cp-sauver');
  if(_bs){
    _bs.classList.toggle('btn-attente',_progExDirty);
    _bs.textContent=_progExDirty?'Enregistrer •':'Enregistrer';
  }
  _majEtatEnregistrement();
  _majSommaireSeance();
  _majImagesCartes();
}
// L'INDEX DES ILLUSTRATIONS N'EST PAS FORCÉMENT LÀ quand l'éditeur s'ouvre :
// sans lui, illustrationExo ne rend rien et la case restait vide. On le
// charge, puis on pose les images DANS les cases déjà rendues, sans relancer
// renderProgEx : un second rendu effacerait une frappe en cours.
function _majImagesCartes(){
  if(_exoIndex) return;
  let p=null; try{ p=chargerIndexIllustrations(); }catch(e){ p=null; }
  if(!p||!p.then) return;
  p.then(()=>{
    if(!_exoIndex) return;
    document.querySelectorAll('#prog-exercises .px-media-img[data-px-img]').forEach(l=>{
      const v=l.querySelector('.px-media-vide'); if(!v) return;
      const src=_imgCarte((progEx||[])[+l.dataset.pxImg]); if(!src) return;
      const im=document.createElement('img'); im.alt=''; im.loading='lazy'; im.src=src;
      v.replaceWith(im);
    });
  }).catch(()=>{});
}
// ══════ B2.F2 — LE SOMMAIRE, CONSTRUIT DEPUIS progEx ═══════════════════
//
// DEPUIS LE TABLEAU, jamais depuis le DOM rendu : progEx est la source de
// verite de l'editeur, et c'est elle qui bouge quand un exercice est ajoute,
// supprime, renomme ou reordonne. Rendu a la fin de renderProgEx, il suit donc
// tout cela sans qu'aucun appelant ait a y penser.
//
// IL NAVIGUE, IL NE MODIFIE PAS. Aucun controle n'y est double — le seul geste
// est « amene-moi a cette carte ».
function _majSommaireSeance(){
  try{
    const z=document.getElementById('prog-sommaire');
    if(!z) return;
    const l=Array.isArray(progEx)?progEx:[];
    if(!l.length){ z.innerHTML=''; return; }
    z.innerHTML='<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;'
      +'text-transform:uppercase;color:var(--text-faint);padding:2px 8px 8px">'
      +l.length+' exercice'+(l.length>1?'s':'')+'</div>'
      +l.map((ex,i)=>{
        const nom=String((ex&&ex.name)||'').trim();
        return '<button type="button" class="pe-lien" data-rang="'+i+'" '
          +'onclick="_sauterVersExercice('+i+')">'
          +'<span class="pe-rang">'+(i+1)+'</span>'
          +'<span class="pe-nom">'+escapeHtml(nom||'Sans nom')+'</span></button>';
      }).join('');
  }catch(e){}
}
// AMENE LA CARTE A L'ECRAN, par le meme moyen que le reste de l'editeur :
// _defiler respecte prefers-reduced-motion, la ou un scrollTop pose a la main
// l'ignorerait (voir B1.6).
function _sauterVersExercice(i){
  try{
    const cartes=document.querySelectorAll('#prog-exercises [data-ex-nom]');
    const c=cartes[i];
    if(c) _defiler(c);
    // ET LE SOMMAIRE DIT OU L'ON EST. Marque ici plutot qu'a l'observation du
    // defilement : le coach vient de designer une carte, c'est celle-la qu'il
    // regarde, et un observateur de position couterait un calcul a chaque
    // pixel pour dire la meme chose.
    document.querySelectorAll('#prog-sommaire .pe-lien').forEach(b=>{
      if(Number(b.dataset.rang)===i) b.setAttribute('aria-current','true');
      else b.removeAttribute('aria-current');
    });
  }catch(e){}
}
// ══════ B2.F3 — TROIS ETATS, ET UN SEUL POINT DE VERITE ════════════════
//
// _progExDirty RESTE LA SOURCE UNIQUE : cet indicateur la LIT, il ne la
// double pas. La garde de sortie continue de l'interroger, le bouton continue
// de basculer — rien de tout cela ne change.
//
//   • enregistrement en cours  : une ecriture est partie, on attend
//   • non enregistre           : _progExDirty
//   • a jour                   : depuis quand, en clair
//
// L'HEURE PLUTOT QU'UN DELAI : un coach qui revient a son ecran apres un appel
// telephonique lit une heure juste, la ou « il y a 3 min » mentirait jusqu'au
// prochain rendu.
let _cpEnregistreA=null, _cpEnCours=false;
function _majEtatEnregistrement(){
  try{
    const z=document.getElementById('cp-etat');
    if(!z) return;
    if(_cpEnCours){ z.textContent='enregistrement…'; z.style.color='var(--text-faint)'; return; }
    if(_progExDirty){ z.textContent='non enregistré'; z.style.color='var(--orange)'; return; }
    if(_cpEnregistreA){
      const d=new Date(_cpEnregistreA);
      z.textContent='à jour · '+String(d.getHours()).padStart(2,'0')+':'
        +String(d.getMinutes()).padStart(2,'0');
      z.style.color='var(--text-faint)';
      return;
    }
    // RIEN TANT QUE RIEN N'A ETE ENREGISTRE dans cette session d'edition :
    // « a jour » sans horodatage ne dirait rien de plus que le bouton.
    z.textContent='';
  }catch(e){}
}

// LA SECTION « REMPLAÇANTS AUTORISES » DE LA CARTE D'EXERCICE, COTE COACH.
// Des pastilles retirables, un champ qui n'accepte QUE des noms de la banque
// (liste proposee), et « Suggerer » qui preremplit depuis substitutsSalle
// sur le dossier et la salle de l'athlete edite. Tout reste modifiable.
function _htmlAlternativesEx(ex,i){
  const l=normaliserAlternatives(ex&&ex.alternatives,ex&&ex.name);
  _altDatalist();
  return `<div class="px-grp">Remplaçants autorisés</div>
    <div class="alt-zone" style="margin-bottom:8px">
      <div class="sub" style="font-size:var(--fs-2xs);line-height:1.5;margin-bottom:6px">Jusqu’à ${ALTERNATIVES_MAX} mouvements que l’athlète pourra choisir d’un geste s’il doit remplacer celui-ci en séance.</div>
      <div class="alt-l">${l.map((n,k)=>`<span class="alt-p">${escapeHtml(n)}<button type="button" class="alt-x" aria-label="Retirer ${escapeHtml(n)}" onclick="_altRetirer(${i},${k})">×</button></span>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:6px">
        ${l.length<ALTERNATIVES_MAX?`<input list="rc-banque-noms" class="f-sm" style="flex:1;min-width:0" placeholder="Ajouter un mouvement de la banque" onchange="_altAjouter(${i},this)">`:''}
        <button type="button" class="btn btn-outline btn-sm" style="margin:0;min-height:38px;letter-spacing:1px;font-size:var(--fs-2xs);white-space:nowrap" onclick="_altSuggerer(${i})">Suggérer</button>
      </div>
    </div>`;
}
// UNE SEULE LISTE DE NOMS DANS LA PAGE, construite a la premiere carte.
function _altDatalist(){
  try{
    if(document.getElementById('rc-banque-noms')) return;
    const d=document.createElement('datalist'); d.id='rc-banque-noms';
    d.innerHTML=_nomsRemplacement().map(n=>'<option value="'+escapeHtml(n)+'"></option>').join('');
    document.body.appendChild(d);
  }catch(e){}
}
function _altEcrire(i,l){
  if(!Array.isArray(progEx)||!progEx[i]) return false;
  const a=normaliserAlternatives(l,progEx[i].name);
  if(a.length) progEx[i].alternatives=a; else delete progEx[i].alternatives;
  _progExDirty=true;
  renderProgEx();
  return true;
}
function _altAjouter(i,el){
  if(!Array.isArray(progEx)||!progEx[i]||!el) return false;
  const n=nomDeBanque(el.value);
  if(!n){ toast('Choisis un mouvement de la banque.','var(--orange)'); el.value=''; return false; }
  if(exKey(n)===exKey(progEx[i].name||'')){ toast('C’est déjà l’exercice prescrit.','var(--orange)'); el.value=''; return false; }
  return _altEcrire(i,(progEx[i].alternatives||[]).concat([n]));
}
function _altRetirer(i,k){
  if(!Array.isArray(progEx)||!progEx[i]) return false;
  const l=normaliserAlternatives(progEx[i].alternatives,progEx[i].name);
  l.splice(k,1);
  return _altEcrire(i,l);
}
// LE DOSSIER DE L'ATHLETE EDITE, et sa salle : ce sont SES appareils qui
// comptent. Sans athlete (un modele), celui du coach.
function _altSuggerer(i){
  if(!Array.isArray(progEx)||!progEx[i]) return false;
  const cl=(()=>{ try{ return currentClientId?getOwnedClient(currentClientId):null; }catch(e){ return null; } })()||currentUser;
  // La salle A PART : sans salle connue, on suggere quand meme, sans filtre de materiel.
  let salle=null; try{ salle=salleActive(cl); }catch(e){ salle=null; }
  let r=null; try{ r=substitutsSalle(cl,progEx[i].name,salle); }catch(e){ r=null; }
  const noms=((r&&r.liste)||[]).map(x=>nomDeBanque(x.nom)).filter(Boolean);
  if(!noms.length){ toast((r&&r.raison)||'Aucun équivalent trouvé pour cet exercice.','var(--orange)'); return false; }
  // Les choix deja poses restent en tete : « Suggerer » complete, il n'efface pas.
  return _altEcrire(i,normaliserAlternatives(progEx[i].alternatives,progEx[i].name).concat(noms));
}
// ══════ LA PROGRAMMATION D'UN EXERCICE, COTE COACH ═════════════════════
//
// RESERVE AU COACH, comme le remplacement depuis la banque : c'est lui qui
// prescrit. _bqDispo porte deja cette distinction dans la carte, on la
// reutilise plutot que d'en ecrire une seconde.
//
// LE BOUTON DIT L'ETAT. Sans programmation il propose de la mettre en place ;
// avec, il resume en une ligne ce qui est prescrit cette semaine — c'est ce
// que le coach vient verifier, et l'ouvrir pour le lire serait un clic de
// trop.
function _htmlBoutonProgEx(ex,i){
  // Le dossier de l'athlete edite : sans lui le coach lirait une consigne
  // differente de celle que l'athlete recoit dans sa seance.
  const _cl=(()=>{ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  const c=(()=>{ try{ return consigneProgEx(ex,null,_cl); }catch(e){ return null; } })();
  const p=(()=>{ try{ return progExDe(ex); }catch(e){ return null; } })();
  const fin=(()=>{ try{ return finProgExProche(ex); }catch(e){ return null; } })();
  let resume='';
  if(c){
    resume=`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:6px">
      Semaine ${c.semaine+1} / ${c.total} · ${c.series}×${c.reps} @${c.rpe}
      ${c.kg!=null?`· <b style="color:var(--sub)">${c.kg} kg</b> (${String(c.pct).replace('.',',')} % de ${c.maxRetenu} kg)`
                  :`· <span style="color:var(--orange)">charge non calculable au-delà de ${RPE_REPS_MAX} répétitions</span>`}
      ${fin!=null&&fin<=PROG_EX_FIN_PREVENIR+1?`<span style="color:var(--orange)"> · ${fin===1?'dernière semaine':fin+' semaines restantes'}</span>`:''}
      ${c.maxDepasse?`<div style="color:var(--orange);margin-top:4px">1RM au dossier : ${c.max} kg · observé en séance : ${c.maxObserve} kg. La charge est calculée sur l’observé : corrige le 1RM pour figer la progression.</div>`:''}
    </div>`;
  } else if(p){
    // UNE PROGRAMMATION QUI NE S'APPLIQUE PAS SE DIT. Terminee, pas encore
    // commencee, ou semaine incomplete : dans les trois cas l'athlete ne
    // recoit rien, et le coach doit le savoir sans ouvrir la feuille.
    resume=`<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.5;margin-top:6px">
      Programmation de ${p.semaines.length} semaine${p.semaines.length>1?'s':''} : aucune consigne active cette semaine.</div>`;
  }
  return `<div class="px-grp">Programmation</div>
    <div style="margin-bottom:8px">
      <!-- EN ROUGE (Kevin, 01/10/2026) : c'est le geste de ce groupe. -->
      <button type="button" class="btn btn-red btn-sm px-b-prog" style="margin:0;min-height:38px;letter-spacing:1px;font-size:var(--fs-2xs)"
        onclick="ouvrirProgEx(${i})">${p?'Modifier la programmation':'Mettre en place une programmation'}</button>
      ${resume}
    </div>`;
}
// L'INDICE DE L'EXERCICE EN COURS D'EDITION. Une variable de module et non un
// argument recopie dans quinze gestionnaires : la feuille se referme sur
// elle-meme, et l'indice ne survit pas a sa fermeture.
let _progExIdx=null;
function ouvrirProgEx(i){
  if(!Array.isArray(progEx)||!progEx[i]) return;
  _progExIdx=i;
  // UNE COPIE DE TRAVAIL. Tant que le coach n'a pas valide, l'exercice n'est
  // pas touche : fermer la feuille ne doit rien laisser derriere.
  const p=(()=>{ try{ return progExDe(progEx[i]); }catch(e){ return null; } })();
  _progExBrouillon=p?{max:p.max,debut:p.debut,
      semaines:p.semaines.map(s=>({series:s.series,reps:s.reps,rpe:s.rpe}))}
    :{max:'',debut:_lundiDe(new Date()).getTime(),
      semaines:Array.from({length:4},()=>({series:null,reps:null,rpe:''}))};
  _rendreProgEx();
  _feuilleOuvrir('prog-ex-modal');
}
let _progExBrouillon=null;
function _progExFermer(){ _feuilleFermer('prog-ex-modal'); _progExIdx=null; _progExBrouillon=null; }
// LE NOMBRE DE SEMAINES : on ajoute ou on retire des LIGNES, on ne les
// reconstruit pas. Reduire puis rallonger ne doit pas effacer ce qui a ete
// saisi entre-temps.
function _progExSemaines(n){
  if(!_progExBrouillon) return;
  const v=Math.max(1,Math.min(PROG_EX_SEMAINES_MAX,Math.round(Number(n)||0)));
  const l=_progExBrouillon.semaines;
  while(l.length<v) l.push({series:null,reps:null,rpe:''});
  if(l.length>v) l.length=v;
  _rendreProgEx();
}
// BUILD 1912 : l'éditeur des séries refuse hors de 1–20, dit pourquoi, et
// remet l'ancienne valeur.
function _progExSeries(i,el){
  const r=lireSeriesSaisie(el&&el.value);
  if(!r.ok){ toast(r.msg,'var(--orange)'); if(el) el.value=String((progEx[i]&&progEx[i].series)||3); return false; }
  _progExDirty=true; progEx[i].series=r.valeur; el.value=String(r.valeur);
  return true;
}
function _progExChamp(i,cle,val){
  if(!_progExBrouillon||!_progExBrouillon.semaines[i]) return;
  if(cle==='series'){ const r=lireSeriesSaisie(val); if(!r.ok){ toast(r.msg,'var(--orange)'); _rendreProgEx(); return; } }
  if(cle==='rpe') _progExBrouillon.semaines[i].rpe=String(val||'');
  else{
    const n=Math.round(Number(val));
    _progExBrouillon.semaines[i][cle]=(isFinite(n)&&n>0)?n:null;
  }
  _rendreProgEx();
}
function _progExMax(v){
  if(!_progExBrouillon) return;
  const n=Number(String(v||'').replace(',','.'));
  _progExBrouillon.max=isFinite(n)?n:'';
  _rendreProgEx();
}
// LA LIGNE D'UNE SEMAINE. Elle montre la charge PENDANT la saisie : c'est la
// seule facon de voir qu'une progression monte trop vite, et le coach n'a pas
// a valider pour s'en rendre compte.
function _htmlLigneProgEx(s,i,max){
  const pct=(()=>{ try{ return (s.rpe&&s.reps)?pctDe1RM(s.rpe,s.reps):null; }catch(e){ return null; } })();
  const kg=(pct!=null&&max>0)?_arrondirCharge(max*pct/100):null;
  const opt=v=>`<option value="${v}" ${s.rpe===v?'selected':''}>@${v}</option>`;
  return `<tr>
    <td style="padding:6px 4px;font-size:var(--fs-2xs);color:var(--sub);white-space:nowrap">S${i+1}</td>
    <td style="padding:6px 4px"><input type="number" min="1" max="20" inputmode="numeric" value="${s.series==null?'':s.series}"
      onchange="_progExChamp(${i},'series',this.value)" aria-label="Séries semaine ${i+1}"
      style="width:100%;text-align:center;padding:6px 4px;margin:0"></td>
    <td style="padding:6px 4px"><input type="number" min="1" max="${RPE_REPS_MAX}" inputmode="numeric" value="${s.reps==null?'':s.reps}"
      onchange="_progExChamp(${i},'reps',this.value)" aria-label="Répétitions semaine ${i+1}"
      style="width:100%;text-align:center;padding:6px 4px;margin:0"></td>
    <td style="padding:6px 4px"><select onchange="_progExChamp(${i},'rpe',this.value)" aria-label="RPE semaine ${i+1}"
      style="width:100%;padding:6px 4px;margin:0"><option value="">-</option>${RPE_ECHELLE.slice().reverse().map(opt).join('')}</select></td>
    <td style="padding:6px 4px;text-align:right;white-space:nowrap;font-size:var(--fs-2xs)">
      ${kg!=null?`<b style="color:var(--text-strong)">${kg} kg</b><span style="color:var(--text-faint)"> · ${String(pct).replace('.',',')} %</span>`
        :(s.reps>RPE_REPS_MAX?`<span style="color:var(--orange)">hors table</span>`:`<span style="color:var(--text-faint)">-</span>`)}
    </td>
  </tr>`;
}
function _rendreProgEx(){
  const z=document.getElementById('prog-ex-corps');
  if(!z||!_progExBrouillon) return;
  const b=_progExBrouillon;
  const max=Number(b.max)||0;
  const nom=(progEx[_progExIdx]&&progEx[_progExIdx].name)||'';
  const rec=(()=>{ try{ return _htmlRappelRecord(nom); }catch(e){ return ''; } })();
  z.innerHTML=`
    <div style="font-size:var(--fs-xs);font-weight:800;color:var(--red-text);letter-spacing:1px;
      text-transform:uppercase;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(nom)}</div>
    <label style="margin-top:0">Charge maximale sur 1 répétition (kg)</label>
    <input id="prog-ex-max" type="text" inputmode="decimal" autocomplete="off" data-dec min="${PROG_EX_MAX_MIN}" max="${PROG_EX_MAX_MAX}"
      value="${b.max===''?'':b.max}" onchange="_progExMax(this.value)" placeholder="Ex : 145">
    ${rec}
    <label>Nombre de semaines</label>
    <input type="number" min="1" max="${PROG_EX_SEMAINES_MAX}" inputmode="numeric" value="${b.semaines.length}"
      onchange="_progExSemaines(this.value)">
    <div style="overflow-x:auto;margin-top:12px" data-scroll-fade>
      <table style="width:100%;border-collapse:collapse;min-width:320px">
        <thead><tr>
          <th style="font-size:var(--fs-2xs);color:var(--sub);text-align:left;padding:0 4px 4px"></th>
          <th style="font-size:var(--fs-2xs);color:var(--sub);padding:0 4px 4px">Séries</th>
          <th style="font-size:var(--fs-2xs);color:var(--sub);padding:0 4px 4px">Reps</th>
          <th style="font-size:var(--fs-2xs);color:var(--sub);padding:0 4px 4px">RPE</th>
          <th style="font-size:var(--fs-2xs);color:var(--sub);text-align:right;padding:0 4px 4px">Charge</th>
        </tr></thead>
        <tbody>${b.semaines.map((s,i)=>_htmlLigneProgEx(s,i,max)).join('')}</tbody>
      </table>
    </div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">
      La charge est calculée depuis la table de pourcentages du guide : elle dépend du RPE visé et
      du nombre de répétitions. Elle s'affichera pré-remplie chez ton athlète, qui pourra la corriger.
      Au-delà de ${RPE_REPS_MAX} répétitions, la table ne dit rien et aucune charge n'est suggérée.
    </div>`;
  try{ z.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el)); }catch(e){}
}
// LE RECORD DEJA AU DOSSIER, s'il existe : le coach n'a pas a aller le
// chercher ailleurs pour saisir un 1RM. On LIT ce que recordsExercice rend —
// la meme source que le repere de charge affiche sous le champ « Charge
// cible » — et on ne pose rien : le maximum estime est une estimation, c'est
// au coach de decider ce qu'il en fait.
function _htmlRappelRecord(nom){
  let r=null;
  try{ r=recordsExercice(_coachEditClient,nom); }catch(e){ r=null; }
  if(!r) return '';
  const mc=r.meilleureCharge, me=r.meilleurE1rm;
  const bouts=[];
  if(mc&&mc.kg>0) bouts.push('record '+mc.kg+(chargeParMain({name:nom})?' kg/main':' kg')+(mc.reps?(' × '+mc.reps):''));
  if(me&&me.valeur>0) bouts.push('max estimé '+me.valeur+' kg');
  if(!bouts.length) return '';
  return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">
    ${bouts.join(' · ')}${me&&me.valeur>0?` · <button type="button" onclick="_progExMax(${me.valeur});document.getElementById('prog-ex-max').value=${me.valeur}"
      style="background:none;border:none;color:var(--red-text);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:700;cursor:pointer;padding:0;text-decoration:underline">reprendre</button>`:''}</div>`;
}
// VALIDER : c'est ICI, et seulement ici, que l'exercice est touche.
function validerProgEx(){
  if(_progExIdx==null||!_progExBrouillon) return;
  const b=_progExBrouillon;
  const max=Number(b.max);
  if(!isFinite(max)||max<PROG_EX_MAX_MIN||max>PROG_EX_MAX_MAX){
    toast('Renseigne la charge maximale sur 1 répétition.','var(--orange)'); return;
  }
  // UNE SEMAINE INCOMPLETE NE PRESCRIT RIEN, et l'app le dit AVANT plutot que
  // de laisser l'athlete arriver devant une seance sans consigne.
  const trous=b.semaines.map((s,i)=>(!s.series||!s.reps||!s.rpe)?(i+1):0).filter(Boolean);
  if(trous.length===b.semaines.length){
    toast('Renseigne au moins une semaine complète.','var(--orange)'); return;
  }
  progEx[_progExIdx].prog={max,debut:b.debut,
    semaines:b.semaines.map(s=>({series:s.series,reps:s.reps,rpe:s.rpe}))};
  _progExDirty=true;
  const n=b.semaines.length-trous.length;
  toast(trous.length
    ?('Programmation enregistrée · '+n+' semaine'+(n>1?'s':'')+' sur '+b.semaines.length
      +' : semaine'+(trous.length>1?'s':'')+' '+trous.join(', ')+' incomplète'+(trous.length>1?'s':''))
    :('Programmation sur '+b.semaines.length+' semaine'+(b.semaines.length>1?'s':'')+' '+ICO.coche),
    trous.length?'var(--orange)':'var(--green)');
  _progExFermer();
  renderProgEx();
}
async function retirerProgEx(){
  if(_progExIdx==null) return;
  if(!await rcConfirm('Retirer la programmation de cet exercice ?\n\nLes charges ne seront plus suggérées, et l\'athlète retrouvera son champ RIR.',null,'Retirer')) return;
  delete progEx[_progExIdx].prog;
  _progExDirty=true;
  toast('Programmation retirée.','var(--sub)');
  _progExFermer();
  renderProgEx();
}
// Lier ou délier un exercice avec celui du dessus.
function _basculerSS(i){
  if(i<=0||!progEx[i]) return;
  progEx[i].ss=!progEx[i].ss;
  _progExDirty=true;
  renderProgEx();
}
// Supprimer la TÊTE d'un superset laisserait le suivant enchaîné avec un
// exercice qui n'a plus rien à voir : il devient tête de groupe à son tour.
function _supprimerEx(i){
  if(!progEx[i]) return;
  if(progEx[i+1]&&progEx[i+1].ss&&!progEx[i].ss) progEx[i+1].ss=false;
  progEx.splice(i,1);
  _normaliserSS(progEx);
  _progExDirty=true;
  renderProgEx();
}

// ══════════════ RÉORDONNANCEMENT DES EXERCICES ══════════════
// On déplace des GROUPES, pas des exercices : un superset se lit « 3a / 3b »
// et se déplace d'un bloc. Seule la tête porte la poignée ; pour sortir un
// exercice d'un superset il y a déjà le bouton DÉLIER. Aucun ordre incohérent
// n'est donc atteignable par glissement.
function _pxDeplacerGroupe(giDe,giVers){
  const grs=_groupesEx(progEx);
  if(giDe<0||giDe>=grs.length||giVers<0||giVers>=grs.length||giDe===giVers) return false;
  const idx=grs[giDe];
  const bloc=idx.map(i=>progEx[i]);
  const teteCible=progEx[grs[giVers][0]];
  const reste=progEx.filter((_,i)=>!idx.includes(i));
  let pos=reste.indexOf(teteCible);
  // Descendre : on se place APRÈS le groupe visé, sinon un glissement vers le
  // bas ne ferait jamais franchir la cible.
  if(giVers>giDe) pos+=grs[giVers].length;
  reste.splice(pos,0,...bloc);
  progEx=reste;
  _normaliserSS(progEx);
  _progExDirty=true;
  return true;
}
// Index de groupe d'une ligne, et index de groupe d'un objet exercice.
function _pxGroupeDeLigne(i){
  const grs=_groupesEx(progEx);
  const gi=grs.findIndex(g=>g.includes(i));
  return gi<0?0:gi;
}
function _pxDeplacerParFleche(i,delta){
  const gi=_pxGroupeDeLigne(i);
  if(_pxDeplacerGroupe(gi,gi+delta)) renderProgEx();
}

let _pxDrag=null;   // {tete, gi}
// Les champs de l'éditeur écrivent dans progEx sur « change », donc au blur.
// Sans ça, saisir un nom puis glisser sans quitter le champ perdait la frappe :
// le re-rendu détruisait la zone de saisie avant que « change » ne parte. On
// déclenche l'événement explicitement plutôt que de compter sur le blur seul,
// pour que la valeur soit reprise quoi qu'il arrive.
function _pxCommitChampActif(){
  const a=document.activeElement;
  if(!a||(a.tagName!=='INPUT'&&a.tagName!=='TEXTAREA')) return;
  try{ a.dispatchEvent(new Event('change',{bubbles:true})); a.blur(); }catch(e){}
}
function _pxDragDebut(ev,i){
  if(ev.button!=null&&ev.button!==0) return;
  _pxCommitChampActif();
  ev.preventDefault();
  const grs=_groupesEx(progEx);
  const gi=grs.findIndex(g=>g[0]===i);
  if(gi<0) return;                       // seule la tête d'un groupe se saisit
  _pxDrag={tete:progEx[i],gi};
  const c=document.getElementById('px-carte-'+i);
  if(c) c.classList.add('pe-saisi');
  try{ ev.target.setPointerCapture&&ev.target.setPointerCapture(ev.pointerId); }catch(e){}
}
// Une carte d'exercice fait près de 470 px : sur un téléphone on en voit deux
// à la fois. Sans ce défilement au bord, glisser au-delà du voisin immédiat
// était impossible, la cible n'étant jamais à l'écran.
function _pxDefilerAuBord(y){
  const marge=70, pas=16;
  const z=document.getElementById('s-coach-program')?.querySelector('.scroll-area');
  // .screen est en min-height:100dvh, donc il grandit avec son contenu et
  // .scroll-area ne déborde jamais : c'est le DOCUMENT qui défile. On vise
  // celui des deux qui peut réellement défiler, pour rester juste si la mise
  // en page change.
  const zoneDefile=z&&z.scrollHeight>z.clientHeight+2;
  const cible=zoneDefile?z:document.scrollingElement;
  if(!cible) return;
  const r=zoneDefile?z.getBoundingClientRect():{top:0,bottom:window.innerHeight};
  if(y<r.top+marge) cible.scrollTop-=pas;
  else if(y>r.bottom-marge) cible.scrollTop+=pas;
}
function _pxDragBouge(ev){
  if(!_pxDrag) return;
  ev.preventDefault();
  _pxDefilerAuBord(ev.clientY);
  const sous=document.elementFromPoint(ev.clientX,ev.clientY);
  const cible=sous&&sous.closest&&sous.closest('[data-px-idx]');
  if(!cible) return;
  const giVers=_pxGroupeDeLigne(parseInt(cible.dataset.pxIdx));
  if(isNaN(giVers)||giVers===_pxDrag.gi) return;
  if(!_pxDeplacerGroupe(_pxDrag.gi,giVers)) return;
  // Le groupe a bougé : on retrouve sa nouvelle place par l'identité de sa
  // tête, l'index seul ne suffit plus.
  _pxDrag.gi=_pxGroupeDeLigne(progEx.indexOf(_pxDrag.tete));
  renderProgEx();
  const c=document.getElementById('px-carte-'+progEx.indexOf(_pxDrag.tete));
  if(c) c.classList.add('pe-saisi');
}
function _pxDragFin(){
  if(!_pxDrag) return;
  _pxDrag=null;
  renderProgEx();
}
document.addEventListener('pointermove',_pxDragBouge,{passive:false});
document.addEventListener('pointerup',_pxDragFin);
document.addEventListener('pointercancel',_pxDragFin);

function loadExImage(idx,input){
  const f=input.files[0];if(!f) return;
  // On retient l'OBJET exercice, pas son index : la compression est
  // asynchrone, et un réordonnancement pendant ce temps ferait atterrir la
  // photo sur un autre exercice.
  const cible=progEx[idx]; if(!cible) return;
  compressImage(f,800,0.75,data=>{cible.image=data;renderProgEx();});
}

// N6.3 + B3.11 — L'ECHELLE DU RIR PRESCRIT, ET CE QU'ELLE N'A PAS.
//
// Elle va de 0 a 5. Celle que l'athlete SAISIT, RIR_OPTS, ajoute « echec » en
// tete — et le commentaire d'origine affirmait pourtant que c'etait « celle que
// l'athlete saisit deja, et aucune autre ». Ce n'est pas tout a fait vrai, et
// la difference est voulue :
//
//   • L'ATHLETE PEUT REPONDRE « ECHEC », parce que c'est ce qui lui est
//     arrive : la serie s'est terminee toute seule. C'est un CONSTAT.
//   • LE COACH NE PEUT PAS PRESCRIRE « ECHEC » ici. RIR 0 dit deja « jusqu'a
//     ne plus pouvoir » et se compare a tout le reste ; « echec » comme
//     consigne serait un mot dans une echelle de nombres.
//
// LES DEUX SE COMPARENT QUAND MEME, et c'est ce qui compte : partout ou le
// realise rencontre le prescrit — rirMoyenSeance, ecartRirPrescrit, la
// ponderation du volume — « echec » vaut RIR 0. Une seule regle, ecrite au
// meme endroit dans les trois.
// La valeur vide OUVRE la liste : c'est le defaut, et c'est ce que portent
// tous les programmes existants.
const RIR_CIBLE_ECHELLE=Object.freeze([
  {v:'',  lib:'-'},
  {v:'0', lib:'RIR 0'},
  {v:'1', lib:'RIR 1'},
  {v:'2', lib:'RIR 2'},
  {v:'3', lib:'RIR 3'},
  {v:'4', lib:'RIR 4'},
  {v:'5', lib:'RIR 5'}
]);
// PURE. Ce que la consigne veut dire, en clair. Vide : rien — une absence de
// consigne n'est pas une consigne.
const RIR_CIBLE_SENS=Object.freeze({
  '0':'À l’échec : la dernière répétition ne passe pas.',
  '1':'Une répétition en réserve.',
  '2':'Deux répétitions en réserve : le réglage le plus courant.',
  '3':'Trois en réserve : technique et volume avant l’intensité.',
  '4':'Quatre en réserve : travail léger, reprise ou décharge.',
  '5':'Cinq en réserve : très facile, échauffement ou récupération.'
});
// PURE. Les options du menu, la valeur courante toujours presente.
// ══════ B3.9 — LE REPERE DE CET ATHLETE SUR CE MOUVEMENT ═══════════════
//
// Le champ « Charge cible » est un texte libre dont l'exemple etait « 80 kg ».
// Rien ne le rapprochait de ce que l'athlete souleve REELLEMENT, alors que
// l'application estime deja un 1RM par exercice et tient les records. Un coach
// ne pouvait donc ni prescrire « 75 % », ni savoir, en ecrivant 80 kg, si
// c'etait lourd ou leger pour CET athlete sur CE mouvement. C'est le geste de
// prescription le plus courant du metier, et la donnee existait deja.
//
// RIEN SANS HISTORIQUE. Un exercice jamais fait n'affiche aucun repere : pas
// de maximum invente, pas de zero. recordsExercice rend deja null dans ce cas.
//
// LE CALCUL N'EST PAS TOUCHE, ni ses garde-fous : une seance dont les RIR
// manquent est ecartee du maximum estime, et au-dela de douze repetitions le
// modele n'est pas applique. On se contente de LIRE ce qu'il rend.
//
// LE POURCENTAGE EST CALCULE ICI ET AFFICHE, jamais ecrit dans le champ : le
// texte libre continue d'accepter ce qu'il acceptait — « 80 kg », « 3x5 »,
// « au feeling » — et les programmes existants ne perdent rien.
function _htmlRepereCharge(ex){
  try{
    const u=_coachEditClient;
    if(!u||!ex||!ex.name) return '';
    let r=null; try{ r=recordsExercice(u,ex.name); }catch(e){ return ''; }
    if(!r) return '';
    const mc=r.meilleureCharge, me=r.meilleurE1rm;
    const bouts=[];
    if(mc&&mc.kg>0) bouts.push('record '+mc.kg+' kg'+(mc.reps?(' × '+mc.reps):''));
    if(me&&me.valeur>0) bouts.push('max estimé '+me.valeur+' kg');
    if(!bouts.length) return '';
    // ET CE QUE VAUT LA CONSIGNE ECRITE, quand elle est en kilos et qu'un
    // maximum existe : c'est la seule facon de savoir si 80 kg est lourd.
    let pct='';
    if(me&&me.valeur>0){
      const m=String(ex.charge||'').match(/(\d+(?:[.,]\d+)?)\s*kg/i);
      if(m){
        const kg=parseFloat(String(m[1]).replace(',','.'));
        if(kg>0) pct=' · '+Math.round(kg/me.valeur*100)+' % du max';
      }
    }
    return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.45;margin-top:4px">`
      +escapeHtml(bouts.join(' · '))+escapeHtml(pct)+`</div>`;
  }catch(e){ return ''; }
}
function _optionsRirCible(courant){
  const v=String(courant==null?'':courant).trim();
  const connu=RIR_CIBLE_ECHELLE.some(o=>o.v===v);
  const liste=RIR_CIBLE_ECHELLE.slice();
  if(v&&!connu) liste.push({v,lib:v+' · hors échelle'});
  return liste.map(o=>`<option value="${escapeHtml(o.v)}"${v===o.v?' selected':''}>${escapeHtml(o.lib)}</option>`).join('');
}
function _direRirCible(v){
  const k=String(v==null?'':v).trim();
  return RIR_CIBLE_SENS[k]||'';
}
function addExercise(){
  // N6.3 — `rir` NAIT VIDE, comme description et videoUrl : un exercice neuf
  // ne porte aucune consigne d'intensite tant que le coach n'en a pas choisi
  // une. C'est le champ etabli, celui que l'apercu de seance et la fiche
  // imprimable lisent depuis toujours.
  // Série 6 : exerciceVierge — les défauts du coach, sinon l'historique.
  progEx.push(exerciceVierge(_coachPrescription()));
  _progExDirty=true;
  renderProgEx();
  // Scroll vers le nouvel exercice
  setTimeout(()=>{const el=document.getElementById('prog-exercises');if(el)_defiler(el.lastElementChild);},100);
}
// B2.F3 — L'INDICATEUR SUIT L'ECRITURE, du depart a l'arrivee. Le corps est
// inchange : on l'encadre, on ne le reecrit pas. SYNCHRONE comme avant — une
// trentaine d'appelants l'appellent sans await.
function saveProgram(){
  _cpEnCours=true; _majEtatEnregistrement();
  try{ return _saveProgramInterne(); }
  finally{
    _cpEnCours=false;
    if(!_progExDirty) _cpEnregistreA=Date.now();
    _majEtatEnregistrement();
  }
}
function _saveProgramInterne(){
  _progExDirty=false;
  // Comparaison des exKey avant/après AVANT que progEx ne parte dans la séance.
  // La modale, elle, s'affiche après la navigation de sortie : posée ici, elle
  // apparaîtrait sur l'éditeur qu'on est en train de quitter.
  _detecterRenommage();
  const _ctx=_progEditorCtx;
  const _f=id=>document.getElementById(id).value;
  switch(_ctx.mode){
    // Coach edite une seance d'un modele de programme H/F
    case 'template':{
      if(_ctx.progIdx==null||typeof _ctx.sessionIdx!=='number') break;
      const p=currentUser.coachPrograms?.[_ctx.progIdx];
      if(!p) break;
      const sessions=_cptSeances(p,_ctx.gender);
      const s=sessions?.[_ctx.sessionIdx];
      if(!s) break;
      s.exercises=progEx;
      s.name=_f('prog-name');s.notes=_f('prog-notes');
      s.warmup=_f('prog-warmup');s.cooldown=_f('prog-cooldown');
      _progEditorCtx={mode:'clientProgram'};
      _majCtxEditeur();
      try{ if(modeleVersionner(p,_c4Avant)) _c4Avant=_c4Snapshot(p); }catch(e){}
      toastEcriture(saveUser(),' Séance sauvegardée !','la séance est');
      go('s-coach-prog-template');loadProgTemplateSlots(_ctx.gender);return;
    }
    // Coach edite une seance d'un athlete (via openCoachSessions)
    case 'coachClient':{
      if(!_coachEditClient||typeof _ctx.sessionIdx!=='number') break;
      const sc=_coachEditClient.sessions_config?.[_ctx.sessionIdx];
      if(!sc) break;
      sc.exercises=progEx;
      sc.name=_f('prog-name');sc.notes=_f('prog-notes');
      sc.warmup=_f('prog-warmup');sc.cooldown=_f('prog-cooldown');
      _progEditorCtx={mode:'clientProgram'};
      _majCtxEditeur();
      // Le brouillon est posé ICI, et non à chaque frappe : une écriture par
      // séance terminée suffit à ne rien perdre, et le dossier du coach n'est
      // pas réécrit à chaque caractère tapé.
      // Il n'atteint PAS l'athlète : c'est saveCoachSessions qui publie.
      let broOk=false;
      if(enregistrerBrouillon()){ try{ broOk=saveUser(); }catch(e){ rcErreurMuette('_saveProgramInterne',e); } }
      toastEcriture(broOk,'Séance enregistrée en brouillon','le brouillon est');
      go('s-coach-sessions');loadCoachSessionSlots();return;
    }
    // L'athlete edite sa propre seance depuis le gestionnaire de seances
    case 'athlete':{
      if(typeof _ctx.sessionIdx!=='number') break;
      if(!currentUser.sessions_config) initSessionsConfig();
      const sa=currentUser.sessions_config[_ctx.sessionIdx];
      if(!sa) break;
      _personnaliserSeance(_ctx.sessionIdx);
      sa.exercises=progEx;
      sa.name=_f('prog-name');sa.notes=_f('prog-notes');
      sa.warmup=_f('prog-warmup');sa.cooldown=_f('prog-cooldown');
      if(progPhotoData) sa.photo=progPhotoData;
      if(progPhoto2Data) sa.photo2=progPhoto2Data;
      const _ok=saveUser();
      _progEditorCtx={mode:'clientProgram'};
      _majCtxEditeur();
      // Cette séance embarque jusqu'à deux images base64 : c'est le cas le plus
      // exposé au débordement de quota de tout l'éditeur de programme.
      toastEcriture(_ok,' Séance sauvegardée !','la séance est');
      loadSessionManager();return;
    }
  }
  // Aucun mode d'édition valide. L'ancien bloc terminal écrivait ici le champ
  // legacy c.program pour currentClientId — atteignable par les `break` ci-dessus,
  // il pouvait donc écrire sur le mauvais athlète avec un contexte périmé.
  // Le coach passe désormais par les séances (openCoachSessions) ou par le PDF.
  toast('Contexte d\'édition perdu : réouvre la séance.','var(--orange)');
}

function saveWarmupTemplate(){
  const wu=document.getElementById('prog-warmup').value.trim();
  const cd=document.getElementById('prog-cooldown').value.trim();
  if(!wu&&!cd) return toast('Saisis un échauffement ou des étirements d\'abord','var(--orange)');
  currentUser._defaultWarmup=wu;
  currentUser._defaultCooldown=cd;
  saveUser();
  toast('Modèle mémorisé : pré-rempli automatiquement à la prochaine séance','var(--green)');
}

// ======= CLIENT HOME =======
