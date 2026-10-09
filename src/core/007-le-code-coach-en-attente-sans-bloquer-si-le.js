// ══════ LE CODE COACH EN ATTENTE, SANS BLOQUER SI LE STOCKAGE EST PLEIN ══
//
// Ce n'est PAS une donnee de l'utilisateur : c'est un relais de quelques
// caracteres entre deux ecrans, et l'ecran d'arrivee sait le redemander. Son
// echec ne doit donc jamais couter plus que lui-meme — surtout pas le go() qui
// le suit, comme c'etait le cas.
//
// ON LE DIT QUAND MEME. Regle du projet : aucune perte silencieuse. L'athlete
// qui devra retaper son code doit savoir pourquoi, sinon il croit que le lien
// de son coach est casse.
function _poserCodeEnAttente(code){
  try{
    localStorage.setItem('pendingCode',code||'');
    return true;
  }catch(e){
    console.warn('[RepCore] pendingCode non enregistré :',e);
    try{ toast('Stockage plein : garde ton code sous la main, il te sera redemandé à l’écran suivant.','var(--orange)'); }catch(_){}
    return false;
  }
}
function localISODate(d){
  const m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return d.getFullYear()+'-'+m+'-'+day;
}
// LA CLÉ « AAAA-MM-JJ » EST UN JOUR LOCAL, PAS UN INSTANT UTC (02/10/2026).
// new Date('2026-09-29') lit minuit UTC : à la Martinique (UTC-4), c'est le
// 28 à 20 h, et l'écran affichait la veille. La clé est posée à MIDI local,
// loin des deux minuits et des changements d'heure. Toute autre valeur
// (horodatage, date complète) passe telle quelle à new Date.
function dateLocaleDeCle(s){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s||'')); return m?new Date(+m[1],+m[2]-1,+m[3],12):new Date(s); }
function copyCoachInviteLink(){
  if(!currentUser||currentUser.role!=='coach') return;
  // Embed coach profile in URL so athlete's device can import it without a backend
  const payload={
    id:currentUser.id,
    fname:currentUser.fname,
    lname:currentUser.lname,
    email:currentUser.email,
    code:currentUser.code,
    role:'coach',
    _st:undefined
  };
  const encoded=btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const url=APP_BASE_URL+'?coachpkg='+encoded;
  // LA COPIE PEUT ETRE REFUSEE (QA du 27/09/2026) : permission, navigateur
  // integre d'une application, page sans le focus. writeText rejetait alors
  // sans rien dire — aucun toast, et le coach croyait le lien copie. _rcCopier
  // essaie le presse-papiers puis l'ancienne copie ; en dernier recours, le
  // lien s'affiche pour etre copie a la main.
  _rcCopierOuMontrer(url,ICO.coche+' Lien copié ! Envoie-le à ton athlète par WhatsApp ou SMS.','Copie ce lien et envoie-le à ton athlète :');
}
/**
 * Copier, et DIRE ce qui s'est passe : le toast de reussite seulement si la
 * copie a reussi ; sinon le texte s'affiche dans une boite ou il se
 * selectionne a la main. Rend une promesse de booleen (copie faite ou non).
 */
function _rcCopierOuMontrer(texte,okMsg,titreManuel){
  return _rcCopier(String(texte||'')).then(ok=>{
    if(ok){ try{ toast(okMsg,'var(--green)'); }catch(e){} return true; }
    try{ toast('Copie refusée par le navigateur : copie-le à la main.','var(--orange)'); }catch(e){}
    try{ window.prompt(titreManuel||'Copie ce texte :',String(texte||'')); }catch(e){}
    return false;
  });
}

async function doAthleteCode(){
  // La valeur brute est lue SANS mise en majuscules : la charge base64 d'un lien
  // d'invitation y est sensible, et c'est ce qui faisait échouer tout collage de
  // lien complet dans ce champ. La normalisation n'intervient qu'après, pour les
  // codes courts — même logique que le oninput de cc-code.
  const raw=(document.getElementById('ae-code').value||'').trim();
  const errEl=document.getElementById('ae-err');
  errEl.style.display='none';
  if(!raw){errEl.textContent='Entre un code valide.';errEl.style.display='block';return;}
  // Compté sur la tentative RÉELLE, après le champ vide : un clic sur un
  // formulaire vide n'est pas une saisie de code, et le compter ferait croire
  // à un abandon massif entre « code saisi » et « code valide ».
  rcm('code_entered');

  // Cas 1 : lien d'invitation complet (?coachpkg=BASE64) — aligné sur doLinkCoach.
  // L'athlète n'a pas encore de compte : on mémorise le coach et son code, puis
  // on enchaîne sur l'inscription, exactement comme la branche du code GCP.
  // LE CODE DU LIEN EST RETENU, PAS VÉRIFIÉ ICI. Le `catch` de ce try est vide
  // — il l'était déjà, pour tolérer une saisie qui n'est pas une URL. Y mettre
  // la vérification réseau aurait avalé ses erreurs : « ce code a déjà été
  // utilisé » serait devenu un silence, puis le message générique du bas.
  let _invDuLien=null;
  try{
    const _url=new URL(raw);
    const pkg=_url.searchParams.get('coachpkg');
    const inv=String(_url.searchParams.get('inv')||'').trim().toUpperCase();
    if(pkg){
      const coach=_validateCoachPkg(JSON.parse(decodeURIComponent(escape(atob(pkg)))));
      if(coach){
        const users=DB.get('users')||{};
        users[coach.email]=Object.assign(users[coach.email]||{},coach);
        DB.set('users',users);
        // Le lien porte un vrai code d'accès : on le traite comme tel, à
        // l'identique de la branche RC-XXXX-XXXX plus bas. Sinon seulement,
        // on retombe sur le code GCP — le rattachement même-appareil.
        if(_INVITE_RE.test(inv)){ _invDuLien=inv; }
        else {
          // LE QUOTA NE DOIT PAS BLOQUER L'INSCRIPTION. Sur un stockage
          // sature — 81 % de base64 d'images chez cet utilisateur — cette
          // ecriture levait, et l'exception emportait le go() qui suit : l'app
          // affichait « VERIFICATION… » et ne faisait plus rien. Un ecran mort,
          // sans un mot, sur le tout premier geste d'un nouvel athlete.
          //
          // MEME COMPORTEMENT QUE DB.setLocal : on avertit, et ON CONTINUE. Le
          // code sera redemande a l'ecran suivant — c'est une gene, pas une
          // impasse, et c'est infiniment mieux qu'un bouton qui ne repond plus.
          _poserCodeEnAttente(coach.code||'');
          go('s-register');
          setTimeout(()=>selectRole('athlete',true),50);
          return;
        }
      }
    }
  }catch(e){}
  // Hors du try : ici, une erreur se dit.
  if(_invDuLien){
    const btn=document.getElementById('ae-valider');
    const libelle=btn?btn.textContent:'';
    if(btn) arcAttendre(btn,'VÉRIFICATION…');
    try{
      // SANS CONSOMMER : le compte n'existe pas encore, et un code brûlé par
      // une inscription abandonnée serait perdu pour de bon.
      const payload=await _verifierCodeSansConsommer(_invDuLien);
      rcm('code_valid');
      _retenirCodeVerifie(_invDuLien,payload);
      go('s-register');
      setTimeout(()=>selectRole('athlete',true),50);
    }catch(e){
      rcm('code_invalid');
      errEl.textContent=e.message||'Code invalide.';
      errEl.style.display='block';
    }finally{
      if(btn) arcRendre(btn,libelle);
    }
    return;
  }

  // Cas 2 : codes courts. C'est SEULEMENT ici que la mise en majuscules a un sens.
  const code=raw.toUpperCase();
  // Try RCACCESS token (starts with "RCACCESS:")
  // Format abandonné : doLinkCoach le refuse déjà en aval. Le laisser passer
  // jusqu'à l'inscription faisait créer un compte à quelqu'un qui apprenait
  // ensuite seulement que son code n'était plus accepté.
  if(code.startsWith('RCACCESS:')){
    errEl.textContent='Ancien format de code : demande un nouveau code (RC-XXXX-XXXX) à ton coach.';
    errEl.style.display='block';
    return;
  }
  // Code RC-XXXX-XXXX : vérifié AUPRÈS DU SERVEUR avant toute inscription.
  // L'ancienne version se contentait du format et envoyait sur s-register :
  // un code désactivé, expiré ou déjà utilisé n'était découvert qu'APRÈS la
  // création du compte Firebase et le consentement au traitement des données
  // de santé — un consentement collecté pour un accès qui n'existait pas.
  if(_INVITE_RE.test(code)){
    const btn=document.getElementById('ae-valider');
    const libelle=btn?btn.textContent:'';
    if(btn) arcAttendre(btn,'VÉRIFICATION…');
    try{
      const payload=await _verifierCodeSansConsommer(code);
      rcm('code_valid');
      _retenirCodeVerifie(code,payload);
      go('s-register');
      setTimeout(()=>selectRole('athlete',true),50);
    }catch(e){
      rcm('code_invalid');
      errEl.textContent=e.message||'Code invalide.';
      errEl.style.display='block';
    }finally{
      if(btn) arcRendre(btn,libelle);
    }
    return;
  }
  // Try coach main GCP code or student code
  const users=DB.get('users')||{};
  const allCoaches=Object.values(users).filter(u=>u.role==='coach');
  // Check coach's main GCP code
  const directCoach=allCoaches.find(u=>u.code&&u.code.toUpperCase()===code);
  if(directCoach){
    // Meme geste, meme risque : voir _poserCodeEnAttente.
    _poserCodeEnAttente(code);
    go('s-register');
    setTimeout(()=>selectRole('athlete',true),50);
    return;
  }
  // Le lien d'invitation vient d'être tenté sans succès : ne pas le recommander.
  errEl.textContent='Ce code ne correspond à aucun coach. Vérifie que tu as bien collé le lien complet envoyé par ton coach, ou demande-lui de te le renvoyer.';
  errEl.style.display='block';
}
function linkToCoach(coach){
  // Helper: link currentUser to a coach object and save
  const users=DB.get('users')||{};
  // LE RANG DE RATTACHEMENT (02/10/2026) : les places du quota d'un coach vont
  // dans cet ordre (athleteCouvertParCoach). Posé à chaque NOUVEAU coach.
  if(currentUser.coachId!==coach.id||!(Number(currentUser.rattacheLe)>0)) currentUser.rattacheLe=Date.now();
  currentUser.coachId=coach.id;
  currentUser.coachName=coach.fname+' '+coach.lname;
  currentUser.coachCode=coach.code;
  currentUser.status='COACHING_SUIVI';
  if(!coach.clients) coach.clients=[];
  if(!coach.clients.includes(currentUser.id)) coach.clients.push(currentUser.id);
  users[currentUser.email]=currentUser;
  users[coach.email]=coach;
  DB.set('users',users);DB.set('session',currentUser);
  // La liaison a abouti : le code a joue son role et peut partir.
  try{localStorage.removeItem('pendingCode');}catch(e){}
  toast('Lié à '+((coach.fname||'')+' '+(coach.lname||'')).trim()+' '+ICO.coche);
  _apresRattachement();
}

// Point d'arrivée unique après un rattachement réussi — trois chemins y
// menaient et ouvraient chacun `openBilan('depart')` sans détour.
// Un questionnaire de six étapes barrait donc l'entrée d'un athlète qui venait
// de saisir son code et voulait simplement voir son programme : le seul moyen
// d'avancer était de le remplir, ou de trouver le lien « plus tard ».
// Le bilan reste demandé — carte permanente sur l'accueil, relance à la fin de
// la première séance — mais il ne conditionne plus l'accès à l'app.
function _apresRattachement(){
  // L'INVITATION A SERVI (05/10/2026) : elle ne se représente plus.
  try{ localStorage.removeItem('rc_invitation'); }catch(e){}
  try{ window._invitationCode=null; }catch(e){}
  // L INSCRIPTION A L ANNUAIRE DE SON COACH. C est le seul moyen pour lui de
  // DECOUVRIR ce dossier depuis un autre appareil : les regles lui
  // interdisent de parcourir /users. Sans await et sans traitement d echec —
  // c est du confort pour le coach, pas une etape de ce parcours-ci, et
  // l ouverture suivante la reposera de toute facon.
  try{ CLOUD.pushAnnuaire(currentUser); }catch(e){}
  go('s-client-home');
  loadClientHome();
}

// Applique un code DÉJÀ vérifié et consommé à currentUser. Extrait de
// doLinkCoach pour que le rattachement automatique d'après inscription et la
// saisie manuelle de rattrapage produisent exactement le même état — deux
// copies de cette logique auraient divergé au premier correctif porté sur une
// seule (coachEmailKey, pushOne et accessExpiry sont trop faciles à oublier).
// LE PROGRAMME DE DÉPART D'UNE INVITATION (05/10/2026). Le code porte
// programmeModeleId quand le coach a choisi un modèle en invitant. Deux
// sources, dans cet ordre :
//   1. la réponse de redeemCode (payload.serveur.programme) : le Worker a lu
//      le modèle — que l'athlète, lui, ne peut pas lire — et l'a déjà écrit
//      dans son dossier ;
//   2. le modèle LISIBLE sur cet appareil (coach et athlète sur le même
//      téléphone, ou Worker pas encore à jour).
// Sinon, rien : pas d'événement différé, le programme ne serait pas là à la
// première ouverture (voir cloudflare/README.md). Un programme RÉEL déjà en
// place n'est jamais remplacé. Rend 'serveur', 'local' ou null.
function _appliquerProgrammeDepart(u,payload){
  if(!u||!payload||!payload.programmeModeleId) return null;
  if(_configReelle(u.sessions_config)) return null;
  const srv=payload.serveur&&payload.serveur.programme;
  let prog=null, source=null, g='H', base=null;
  if(srv&&_configReelle(srv.sessions_config)){
    base=srv.sessions_config; source='serveur';
  } else {
    const coach=Object.values(DB.get('users')||{}).find(x=>x&&x.id===payload.coachId);
    prog=((coach&&coach.coachPrograms)||[]).find(p=>p&&String(p.id)===String(payload.programmeModeleId));
    if(!prog) return null;
    g=progGenreServi(prog,u.gender);
    base=(g==='F'?prog.sessions_F:prog.sessions_H)||[];
    source='local';
  }
  const sc=_marquerCommePublie(JSON.parse(JSON.stringify(Array.isArray(base)?base:Object.values(base))));
  if(!_configReelle(sc)) return null;
  u.sessions_config=sc;
  if(srv&&source==='serveur'){
    ['assignedProgramName','assignedProgramAt','assignedProgramId','assignedProgramGenre','assignedProgramVersion']
      .forEach(k=>{ if(srv[k]!=null) u[k]=srv[k]; });
  } else {
    u.assignedProgramName=prog.name||'Programme';
    u.assignedProgramAt=Date.now();
    u.assignedProgramId=prog.id||null;
    u.assignedProgramGenre=g;
    u.assignedProgramVersion=Number(prog.majAt)||Number(prog.createdAt)||0;
  }
  u.updatedAt=Date.now();
  return source;
}
function _appliquerPayloadCode(payload){
  const users=DB.get('users')||{};
  const coach=Object.values(users).find(u=>u.id===payload.coachId);
  if(coach){
    if(!coach.clients) coach.clients=[];
    if(!coach.clients.includes(currentUser.id)) coach.clients.push(currentUser.id);
    users[coach.email]=coach;
  }
  // R-03 : l'octroi ne dépend plus de creatorFree. Un code de type 'athlete',
  // émis par le créateur OU par un affilié, ouvre l'accès. Le paywall ne
  // subsiste que pour l'inscription AUTONOME, sans code — ce chemin-ci n'y
  // passe pas.
  const _mois=_moisAutorises(payload);
  const _octroi=payload.creatorFree||(payload.type||'athlete')==='athlete';
  if(_octroi){
    // Accès accordé immédiatement
    // LE RANG DE RATTACHEMENT (02/10/2026), comme dans linkToCoach : le serveur
    // pose le sien dans droits/ (redeemCode), qui fait foi.
    if(currentUser.coachId!==payload.coachId||!(Number(currentUser.rattacheLe)>0)) currentUser.rattacheLe=Date.now();
    currentUser.coachId=payload.coachId;
    currentUser.coachName=payload.coachName||'Coach';
    // Pose EXPLICITE, depuis le code et non depuis le cache local : c'est la
    // seule valeur qui ouvre le dossier au coach cote serveur. Le repli
    // derive la cle de coachEmail pour les codes emis avant ce changement.
    const _ck=payload.coachEmailKey
      ||((payload.coachEmail||'').replace(/\./g,','))||null;
    if(_ck) currentUser.coachEmailKey=_ck;
    currentUser.status='COACHING_SUIVI';
    // Le plafond est RE-VÉRIFIÉ ici, à la consommation : le payload vient du
    // réseau, et une vérification côté émetteur seule ne protège de rien.
    // On recalcule l'échéance depuis months plutôt que de faire confiance à
    // expiry, qu'un code forgé porterait à dix ans.
    const _exp=_mois>0?Date.now()+_mois*_MONTH_MS:payload.expiry;
    // Un athlète DÉJÀ payant garde la date la plus lointaine : saisir un code
    // de coach ne doit jamais raccourcir un accès acheté.
    currentUser.accessExpiry=Math.max(Number(currentUser.accessExpiry)||0,
      Number(_exp)||0)||_exp;
    // La cadence de bilan du coach (Réglages de coaching), si le dossier n'en a pas.
    heriterCadence(currentUser,payload);
    try{ heriterProfilSuivi(currentUser,payload); }catch(e){}
    try{ _appliquerProgrammeDepart(currentUser,payload); }catch(e){ rcErreurMuette('_appliquerProgrammeDepart',e); }
    users[currentUser.email]=currentUser;
    const _u1=DB.set('users',users),_s1=DB.set('session',currentUser);
    // Envoi immediat : sans lui, le coach ne voit rien tant que l'athlete
    // n'a pas declenche une autre ecriture.
    // N3.18 — LE « ✓ » ATTEND LES DEUX DESTINATIONS. C'est l'ecriture la plus
    // consequente de tout le parcours de l'athlete : reseau coupe, il lisait
    // « Acces active ✓ » et son coach ne le voyait jamais apparaitre.
    const _envoi=CLOUD.pushOne(currentUser.email,currentUser);
    // LE PALIER VIENT DE droits/, que redeemCode vient d'ecrire (30/09/2026).
    try{ rafraichirDroits(currentUser,true).then(()=>{ try{ _planifierRepeint(currentUser.email); }catch(e){} }).catch(()=>{}); }catch(e){}
    // Idem : succes confirme, le code en attente n'a plus lieu d'etre.
    _oublierCodeVerifie();
    toastSync(_u1&&_s1,_envoi,'Accès activé '+ICO.coche,'ton accès est');
    _apresRattachement();
  } else {
    // Code NON athlète (invitation coach) : le paiement reste le chemin
    sessionStorage.setItem('pendingCodePayload',JSON.stringify(payload));
    users[currentUser.email]=currentUser;
    DB.set('users',users);
    // Le code n'est PAS oublié ici : le paiement peut échouer ou être
    // abandonné, et l'athlète doit pouvoir revenir sur s-subscribe sans
    // redemander son code au coach. loadSubscribePage le relit.
    goAvecRetour('s-subscribe');
    loadSubscribePage('pending-code',payload);
  }
}

// Rattachement automatique juste après l'inscription. Le code a déjà été
// validé sur l'écran d'entrée ; _verifyAccessCode est rappelée ici parce que
// c'est elle qui CONSOMME (PATCH redeemed), ce que la vérification préalable
// s'interdit — et parce qu'à ce stade currentUser et le jeton existent enfin.
// Retourne true si l'athlète a été routé, false s'il faut le laisser sur
// l'écran de rattrapage.
async function _appliquerCodeApresInscription(){
  const retenu=_codeVerifieEnAttente();
  if(!retenu||!retenu.code) return false;
  try{
    const r=await _verifyAccessCode(retenu.code,(currentUser.fname||'')+' '+(currentUser.lname||''));
    _appliquerPayloadCode(r.payload);
    return true;
  }catch(e){
    // Rare : le code était valide quelques secondes plus tôt. Réseau coupé
    // pendant l'inscription, ou code consommé entre-temps par un autre
    // appareil. On ne laisse pas l'athlète sans explication ni sans issue.
    toast(e.message||'Code non appliqué : ressaisis-le.','var(--orange)');
    return false;
  }
}

// PURE. L athlete est-il deja rattache, et a qui ? Rend le nom du coach, ou
// null. On lit le dossier, pas l ecran.
function coachActuelDe(user){
  const u=_dossier(user);
  if(!u||!u.coachId) return null;
  const nom=String(u.coachName||'').trim();
  if(nom) return nom;
  const c=Object.values(DB.get('users')||{}).find(x=>x&&x.id===u.coachId);
  return c?((c.fname||'')+' '+(c.lname||'')).trim()||'ton coach':'ton coach';
}
// PURE. Le lien recu designe-t-il le coach qu on a deja ? Deux cas tres
// differents : rouvrir SON propre lien est anodin, en ouvrir un AUTRE est un
// changement de coach, et ca ne se fait pas par inadvertance.
function _memeCoachQueLien(coachDuLien,user){
  const u=_dossier(user);
  if(!u||!u.coachId||!coachDuLien) return false;
  return String(coachDuLien.id||'')===String(u.coachId);
}
// Le message dedie. Rend true quand il a pris la main — l appelant s arrete
// alors la, et AUCUN second rattachement n a lieu.
// L'INVITATION EST ANNONCÉE, JAMAIS APPLIQUÉE. On pose le code en attente et
// on le dit ; la validation reste un geste de l'athlète, et
// _annoncerDejaRattache — juste en dessous — garde la main sur ce geste.
//
// Le code du LIEN passe avant le code GCP du coach : `inv` porte le code
// d'accès daté, `coach.code` ne rattache qu'au même appareil.
function _annoncerInvitation(coach){
  if(!coach) return null;
  const code=window._invitationCode||coach.code||'';
  // MEME CHEMIN QUE LES DEUX AUTRES : l'echec etait avale en silence ici, et
  // l'athlete ne comprenait pas pourquoi son code lui etait redemande.
  if(code) _poserCodeEnAttente(code);
  const prenom=(coach.fname||coach.lname||'ton coach').trim();
  // DÉJÀ SUIVI PAR QUELQU'UN D'AUTRE : on ne promet rien. « Valide ton accès »
  // annoncerait exactement ce que _annoncerDejaRattache va refuser au clic
  // suivant.
  const _mien=currentUser&&currentUser.coachId;
  const _autre=!!_mien&&_mien!==coach.id;
  const msg=_autre
    ? 'Invitation de '+prenom+' reçue. Tu es déjà suivi par '+(coachActuelDe(currentUser)||'un coach')
      +' : parles-en à ton coach avant tout changement.'
    : 'Invitation de '+prenom+' reconnue, valide ton accès.';
  const z=document.getElementById('cc-invit');
  const inp=document.getElementById('cc-code');
  // Le champ est pré-rempli quoi qu'il arrive, mais seulement s'il est vide :
  // il servira le jour où l'athlète ouvrira l'écran de saisie.
  if(inp&&!inp.value&&code) inp.value=code;
  if(z){ z.textContent=msg; }
  // LE MESSAGE SUIT L'ÉCRAN AFFICHÉ, PAS L'EXISTENCE DE L'ÉLÉMENT. #cc-invit
  // vit dans s-client-code, qui est TOUJOURS dans le document — seulement
  // masqué quand il n'est pas actif. Se fier à sa présence écrivait le message
  // dans un écran caché : un athlète dont l'accès est actif atterrit sur son
  // accueil et ne voyait rien du tout. Mesuré, la branche toast était morte.
  const _surEcranCode=!!document.getElementById('s-client-code')
    &&document.getElementById('s-client-code').classList.contains('active');
  if(_surEcranCode){
    if(z) z.style.display='block';
  } else {
    if(z) z.style.display='none';
    toast(msg,_autre?'var(--orange)':'var(--green)');
  }
  return {code,msg,autre:_autre,canal:_surEcranCode?'encart':'toast'};
}
// N’EST PLUS APPELÉE QUE POUR UN AUTRE COACH.
//
// Ses deux appelants vérifient l’écart d’identité avant d’appeler : le lien
// de SON coach est une prolongation, pas un changement. La branche « même
// coach » est donc partie — elle affirmait « ton accès est déjà actif, ce
// lien ne sert plus à rien », ce qui était faux dès que accessExpiry était
// dépassée, et plus rien ne l’affichait.
function _annoncerDejaRattache(coachDuLien){
  const actuel=coachActuelDe();
  if(!actuel) return false;
  const nomLien=coachDuLien?(((coachDuLien.fname||'')+' '+(coachDuLien.lname||'')).trim()||'ce coach'):'ce coach';
  const html='<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;'
    +'background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--surface-2);'
    +'border-radius:var(--r-4) var(--r-4) 0 0;padding:20px 20px 24px;width:100%;max-width:480px;'
    +'animation:fadeIn var(--t-3) var(--c-out)">'
    +'<h2 style="margin-bottom:8px;font-size:var(--fs-lg)">Tu es déjà suivi</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);line-height:1.65;margin-bottom:14px">'
    +'Tu es actuellement suivi par <strong style="color:var(--text-strong)">'+escapeHtml(actuel)+'</strong>, '
    +'et ce lien vient de <strong style="color:var(--text-strong)">'+escapeHtml(nomLien)+'</strong>. '
    +'Changer de coach ne se fait pas en ouvrant un lien : demande à '
    +escapeHtml(actuel)+' de te libérer, puis rouvre celui-ci. '
    +'<strong style="color:var(--text-strong)">Rien n\'a été modifié.</strong>'
    +'</p>'
    +'<button class="btn btn-red" style="min-height:46px" onclick="closeModal();go(\'s-client-home\')">'
    +'Revenir à mon accueil</button>'
    +'<button class="btn btn-outline" style="margin-top:10px;min-height:44px" onclick="closeModal()">Fermer</button>'
    +'</div></div>';
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
async function doLinkCoach(){
  const raw=document.getElementById('cc-code').value.trim();
  if(!raw){return showErr('cc-err','Entre un code ou lien coach.');}
  // LE BOUTON DIT QU IL SE PASSE QUELQUE CHOSE. À partir d’ici, la fonction
  // peut enchaîner _verifyAccessCode, _coachDuCode puis _appliquerPayloadCode
  // — trois allers-retours réseau pendant lesquels rien ne bougeait à
  // l’écran. Un second appui relançait toute la vérification, et le PATCH de
  // _verifyAccessCode consomme le code : le deuxième passage le trouvait
  // « déjà utilisé ».
  //
  // Le libellé est MÉMORISÉ, jamais réécrit en dur : celui du bouton et
  // celui du code finiraient par diverger.
  const _btnLC=document.getElementById('cc-valider');
  // DEJA EN COURS : on ne relance rien. Sans ce garde, un second appel
  // memoriserait « VÉRIFICATION… » comme libellé d’origine et le rendrait à
  // la fin — le bouton resterait figé sur un mot d’attente.
  if(_btnLC&&_btnLC.disabled) return;
  const _libLC=_btnLC?_btnLC.textContent:'';
  if(_btnLC) arcAttendre(_btnLC,'VÉRIFICATION…');
  // Le try couvre TOUS les chemins de sortie, `return showErr(...)` compris :
  // c’est précisément eux qui laissaient le bouton mort dans doAthleteCode
  // avant son propre correctif.
  try{

    // Case 1: URL d'invitation coach (?coachpkg=BASE64) — cross-device
    //
    // LE CODE DU LIEN EST RETENU, PAS VÉRIFIÉ ICI : le `catch` de ce try est
    // vide, et la vérification réseau y perdrait ses messages d'erreur.
    let _invDuLien=null;
    try{
      const urlObj=new URL(raw);
      const pkg=urlObj.searchParams.get('coachpkg');
      const inv=String(urlObj.searchParams.get('inv')||'').trim().toUpperCase();
      if(pkg){
        const coach=_validateCoachPkg(JSON.parse(decodeURIComponent(escape(atob(pkg)))));
        if(coach){
          // DEJA RATTACHE A UN AUTRE : on le DIT, et on s’arrête là. Ni erreur
          // muette, ni second rattachement — changer de coach ne se fait pas en
          // ouvrant un lien.
          //
          // MAIS LE LIEN DE SON PROPRE COACH EST LE GESTE DE PROLONGATION.
          // L’arrêter refusait de renouveler un accès, et le message annonçait
          // « ton accès est déjà actif » à quelqu’un dont l’échéance venait
          // justement de passer. On continue donc vers `inv`, comme le cas 2.
          //
          // _memeCoachQueLien rend exactement le test du cas 2 : un coach en
          // place ET différent. Sans coach du tout, il rend false et
          // _annoncerDejaRattache s’abstient de lui-même.
          if(!_memeCoachQueLien(coach)&&_annoncerDejaRattache(coach)) return;
          const users=DB.get('users')||{};
          users[coach.email]=Object.assign(users[coach.email]||{},coach);
          DB.set('users',users);
          // LE LIEN PORTE UN VRAI CODE D'ACCÈS. linkToCoach rattache mais ne
          // pose PAS accessExpiry, et checkAccess lit une échéance absente
          // comme un accès ILLIMITÉ : tout athlète arrivé par lien obtenait un
          // accès perpétuel, et le code restait « ouvert » dans /rc_codes, donc
          // réutilisable par quelqu'un d'autre. On passe par le vrai chemin.
          if(_INVITE_RE.test(inv)){ _invDuLien=inv; }
          else return linkToCoach(coach);
        }
      }
    }catch(e){}
    // Hors du try : ici, une erreur se dit.
    if(_invDuLien){
      let _res;
      try{
        _res=await _verifyAccessCode(_invDuLien,(currentUser.fname||'')+' '+(currentUser.lname||''));
      }catch(e){
        return showErr('cc-err',e.message||'Code invalide ou corrompu. Contacte ton coach.');
      }
      _appliquerPayloadCode(_res.payload);
      return;
    }

    // Case 2: code RC-XXXX-XXXX — vérifié via Firebase RTDB directement
    if(/^RC-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(raw)||raw.startsWith('RCACCESS:')){
      if(raw.startsWith('RCACCESS:')) return showErr('cc-err','Ancien format de code : demande un nouveau code (RC-XXXX-XXXX) à ton coach.');
      // LA MÊME GARDE QU'AU CAS 1. Sans elle, un code suffisait à changer de
      // coach en silence — là où le lien d'invitation, lui, était arrêté.
      //
      // La lecture est SEULE et ne juge rien : elle ne sert qu'à comparer les
      // coachs. Elle vient AVANT _verifyAccessCode, qui consomme le code par un
      // PATCH : décider après aurait brûlé un code qu'on refuse.
      //
      // Elle n'a lieu que si un coach est déjà en place. Un athlète qui n'en a
      // pas, ou qui saisit un code de SON coach — la prolongation — ne paie
      // aucun aller-retour supplémentaire.
      if(coachActuelDe()){
        const _cl=await _coachDuCode(raw);
        if(_cl&&String(_cl.id)!==String(currentUser.coachId||'')){
          _annoncerDejaRattache(_cl);
          return;
        }
      }
      let result;
      try{
        result=await _verifyAccessCode(raw,(currentUser.fname||'')+' '+(currentUser.lname||''));
      }catch(e){
        return showErr('cc-err',e.message||'Code invalide ou corrompu. Contacte ton coach.');
      }
      _appliquerPayloadCode(result.payload);
      return;
    }

    // NOTE — une branche « ancien format RC-XXXX-XXXX » figurait ici. Elle etait
    // INATTEIGNABLE : la Case 2 plus haut teste le MEME motif exact et retourne
    // toujours. Son commentaire affirmait de surcroit qu'une « regle RTDB bloque
    // /rc_codes/* », alors que database.rules.json les ouvre en lecture ET en
    // ecriture a tout compte authentifie. Code mort porteur d'une contre-verite :
    // retire plutot que corrige.

    // Case 3: RCLINK token (legacy)
    if(raw.startsWith('RCLINK:')){
      try{
        const payload=JSON.parse(decodeURIComponent(escape(atob(raw.slice(7)))));
        if(!payload.c||!payload.f||!payload.i) throw new Error('invalid');
        currentUser.coachId=payload.i;
        currentUser.coachName=payload.f+(payload.l?' '+payload.l:'');
        currentUser.coachCode=payload.c;
        currentUser.status='COACHING_SUIVI';
        const users=DB.get('users')||{};
        users[currentUser.email]=currentUser;
        const _u2=DB.set('users',users),_s2=DB.set('session',currentUser);
        toastEcriture(_u2&&_s2,'Lié à '+currentUser.coachName+' '+ICO.coche,'le rattachement est');
        _apresRattachement();return;
      }catch(e){return showErr('cc-err','Lien invalide. Demande un nouveau lien à ton coach.');}
    }

    // Case 4: Code GCP-XXXXXX
    const code=raw.toUpperCase().replace(/\s/g,'');
    if(code.startsWith('GCP-')){
      const users=DB.get('users')||{};
      const coach=Object.values(users).find(u=>u.role==='coach'&&u.code&&u.code.toUpperCase()===code);
      if(coach) return linkToCoach(coach);
      // Code GCP non trouvé → probablement autre appareil
      return showErr('cc-err','Code introuvable sur cet appareil.\n\nTon coach doit appuyer sur "Copier le lien d\'invitation" depuis son écran de code, puis t\'envoyer ce lien par WhatsApp. Colle ce lien ici à la place du code court.');
    }

    showErr('cc-err','Format non reconnu. Entre le lien d\'invitation de ton coach.');
  } finally {
    if(_btnLC) arcRendre(_btnLC,_libLC);
  }
}
function showCoachCode(){
  document.getElementById('coach-code-val').textContent=currentUser.code;
  go('s-coach-code');
}
async function regenCoachCode(){
  // CE QUE ÇA COUPE, ET CE QUE ÇA NE COUPE PAS. L'ancien texte promettait que
  // « tous les liens déjà partagés » cesseraient de fonctionner : c'était vrai
  // quand le seul lien portait le code GCP. Les invitations NOMINATIVES portent
  // &inv=RC-XXXX-XXXX, et doAthleteCode traite cette branche EN PRIORITÉ sans
  // jamais lire coach.code — le pré-remplissage de l’écran d’entrée non plus.
  //
  // Un message de sécurité doit dire ce qu’il fait, et surtout ce qu’il NE fait
  // pas : croire avoir fermé un accès qui reste ouvert est pire que de savoir
  // qu’il faut le fermer ailleurs. D’où le renvoi vers l’onglet CODES.
  if(!await rcConfirm('Régénérer ton code coach ?',
    'Ça remplace ton code court et le lien générique de « Copier le lien '
    +'d\'invitation » : les deux cessent de fonctionner.\n\n'
    +'En revanche, les invitations NOMINATIVES déjà envoyées continuent de '
    +'fonctionner : elles portent leur propre code. Pour en fermer une, '
    +'désactive-la dans l\'onglet CODES.\n\n'
    +'Les athlètes déjà liés ne sont PAS affectés.','Régénérer')) return;
  currentUser.code=genCode();
  saveUser();
  document.getElementById('coach-code-val').textContent=currentUser.code;
  toast('Nouveau code généré : pense à partager le nouveau lien.','var(--green)');
}

// ======= COACH HOME =======
// Types d'alerte portant sur la SANTÉ. Leur report obéit à deux règles que les
// alertes administratives n'ont pas :
//   — il ne peut jamais dépasser sept jours, même si une valeur plus lointaine
//     a été écrite. Un coach peut décider de ne pas agir ; il ne doit pas
//     pouvoir faire disparaître définitivement une alerte de santé d'un clic.
//   — une aggravation le casse immédiatement.
const ALERTES_SANTE=Object.freeze(['douleur','douleurdiff']);
const REPORT_SANTE_MAX=7*864e5;
function _pireDouleur(c){
  const sg=signauxEntrainement(c);
  return Math.max(
    (sg.details&&sg.details.douleur&&sg.details.douleur.painMax)||0,
    (sg.details&&sg.details.douleurDiffuse&&sg.details.douleurDiffuse.painMax)||0);
}
function isAlertSnoozed(type,clientId,latestBilanTs,client){
  const st=(currentUser.alertStatus||{})[type+'-'+clientId];
  if(!st) return false;
  if(st.until&&Date.now()>=st.until) return false;
  if(type==='bilan'&&latestBilanTs&&st.seenUpTo&&latestBilanTs>st.seenUpTo) return false;
  if(ALERTES_SANTE.includes(type)){
    // Plafond appliqué à la LECTURE et non seulement à l'écriture : une entrée
    // écrite autrement, ou par une version future du code, reste bornée.
    // Sans horodatage de report, l'entrée n'est PAS un report valable — sinon
    // il suffisait d'écrire un « until » lointain sans « at » pour enterrer
    // définitivement une alerte de santé. reporterAlerte écrit toujours « at ».
    if(!st.at||Date.now()>=st.at+REPORT_SANTE_MAX) return false;
    if(client&&st.painMax!=null&&_pireDouleur(client)>st.painMax) return false;
  }
  return true;
}
// Report d'un athlète pour un type donné. Extrait de dismissTodoRow pour que
// la ligne par athlète et la ligne groupée écrivent exactement la même chose.
function reporterAlerte(type,c,jours){
  if(!currentUser.alertStatus) currentUser.alertStatus={};
  const lt=(c.bilans||[]).reduce((m,b)=>Math.max(m,b.date),0);
  // `jours` est FACULTATIF : sans lui, les sept jours d avant. Les appels
  // existants ne changent donc pas d un iota, et il n existe toujours qu un
  // seul mecanisme de mise en veille.
  const _j=(Number(jours)>0)?Number(jours):7;
  const st={s:'ignoré',until:Date.now()+_j*864e5,at:Date.now(),
    seenUpTo:type==='bilan'?lt:0};
  if(ALERTES_SANTE.includes(type)){
    // Niveau de douleur au moment du report : sans cette référence,
    // « passer de 4 à 6 » n'est pas détectable.
    st.painMax=_pireDouleur(c);
    if(!currentUser.journalDouleur) currentUser.journalDouleur=[];
    currentUser.journalDouleur.push({at:Date.now(),type,clientId:c.id,painMax:st.painMax});
    // Journal borné : c'est une trace, pas un historique complet.
    if(currentUser.journalDouleur.length>200)
      currentUser.journalDouleur=currentUser.journalDouleur.slice(-200);
  }
  currentUser.alertStatus[type+'-'+c.id]=st;
}
function dismissTodoRow(idx){
  const r=window._todoRows&&window._todoRows[idx];if(!r) return;
  // Un drapeau rouge ne se reporte jamais, même appelé directement.
  if(r.nonReportable) return false;
  // Une ligne groupée : une case par athlète, toutes cochées, avant de reporter.
  if(r.list.length>1){ _todoOuvrirFeuille(r); return true; }
  // L'ECRITURE N'EST PAS RETARDEE PAR L'ANIMATION : elle est groupee avec le
  // re-rendu, qui l'etait deja. pointer-events coupes TOUT DE SUITE — le report
  // est deja decide, un second appui pendant les 180 ms ne doit rien atteindre.
  // A huit lignes a reporter le dimanche soir, le coach visait une cible qui
  // avait bouge entre deux appuis.
  // Le report passe par todoReporter : sauvegarde, redessin, et « Annuler » 6 s.
  const fin=()=>{ todoReporter(r,r.list); };
  const n=arcDernierElement('.rc-ligne');
  if(!n||arcReduit()||!n.animate) return fin();
  n.style.pointerEvents='none';
  const a=n.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(-16px)'}],
    {duration:180,easing:ARC.charge,fill:'forwards'});
  if(!a) return fin();
  let fait=false;
  const une=()=>{ if(fait) return; fait=true; fin(); };
  a.addEventListener('finish',une);
  a.addEventListener('cancel',une);
  setTimeout(une,260);             // le filet : le rappel porte l'ecriture
}

// ══════════════ SIGNAUX D'ENTRAÎNEMENT ══════════════
// Le tableau de bord triait sur six signaux dont AUCUN ne parlait
// d'entraînement : bilan en retard, accès qui expire, inscrit qui n'a jamais
// commencé. La douleur par série était collectée depuis toujours, colorait la
// ligne pendant la séance, et ne remontait nulle part.
//
// Ces signaux DÉCRIVENT, ils ne décident pas : aucune modification de
// programme, aucune charge réduite, aucun exercice retiré automatiquement.
// Retirer un exercice sur la foi d'un chiffre de 1 à 6 serait une décision de
// coaching prise par un algorithme.
const SIG_PAIN_SEUIL=4;
const SIG_SEANCES=3;              // fenêtre « les trois dernières séances »
const SIG_DOULEUR_MIN_SEANCES=2;  // la sécurité n'attend pas un échantillon
const SIG_DIFFUS_JOURS=14;
const SIG_DIFFUS_MIN=5;
const SIG_DECROCHAGE=0.70;
const SIG_FORME_ECART=1.5;
const SIG_MEV_SEMAINES_CANDIDAT=4;// recul servant à savoir si le muscle est travaillé
const SIG_DOULEUR_JOURS=30;       // bloc « douleur » de la fiche client

// Disclaimer unique, réutilisé partout où une douleur est affichée — coach
// comme athlète. Une seule constante : impossible d'ajouter un affichage de
// douleur en oubliant l'avertissement, il suffit de le concaténer.
const DISCLAIMER_DOULEUR='L\'échelle de douleur est déclarative. Elle n\'est ni un diagnostic ni un avis médical. Une douleur qui persiste ou qui s\'aggrave doit être évaluée par un professionnel de santé.';
function blocDisclaimerDouleur(){
  return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:8px">${DISCLAIMER_DOULEUR}</div>`;
}

// Muscles en plateau. Extrait de renderPlateauxCoach pour être partagé avec
// signauxEntrainement : la logique contient un piège qu'il ne faut pas
// réécrire deux fois. Le verdict est construit à partir de la liste DÉJÀ
// calculée par _listeEtats, et non par un appel à etatMuscle : celui-ci exige
// un créneau, et _memeCreneau rejette TOUTES les séances quand slot et
// progName sont nuls. Chaque exercice porte déjà le créneau où il a été vu.
function musclesEnPlateau(c){
  const parMuscle={};
  for(const x of _listeEtats(c)){
    if(x.etat==='insuffisant') continue;
    const cls=resoudreMusclesLecture(x.nom,{name:x.nom},c);
    if(!cls||cls===VOL_CARDIO) continue;
    for(const m of (cls.p||[])) (parMuscle[m]=parMuscle[m]||[]).push(x);
  }
  const out=[];
  for(const m in parMuscle){
    const ex=parMuscle[m];
    if(ex.filter(e=>e.etat==='plateau'||e.etat==='regression').length>=2) out.push({m,exercices:ex});
  }
  return out;
}

// Séries à douleur déclarée d'une séance. La série n'a pas besoin d'être
// validée : une douleur saisie est une douleur saisie, et l'ignorer parce que
// la case « fait » est restée vide irait dans le mauvais sens.
function _seriesDouloureuses(sess){
  const out=[];
  if(!sess||!sess.data) return out;
  for(const nom of Object.keys(sess.data)){
    const d=sess.data[nom];
    for(const s of ((d&&d.sets)||[])){
      const p=parseInt(s&&s.pain,10);
      if(isFinite(p)&&p>=SIG_PAIN_SEUIL) out.push({nom,pain:p});
    }
  }
  return out;
}
// Clés des n dernières semaines ISO RÉVOLUES. La semaine en cours est exclue :
// le lundi matin elle est vide, et tout le monde serait sous son MEV.
function _semainesRevolues(n){
  const out=[], lundi=_lundiDe(new Date());
  for(let i=1;i<=n;i++){
    const d=new Date(lundi); d.setDate(d.getDate()-7*i);
    out.push(semaineISO(d));
  }
  return out;
}
// Douleur des trente derniers jours, par exercice. Sert au bloc de la fiche
// client et au détail des alertes.
function douleurParExercice(c,jours){
  const limite=Date.now()-(jours||SIG_DOULEUR_JOURS)*864e5;
  const parEx={};
  for(const sess of ((c&&c.sessions)||[])){
    if(!sess||!(sess.date>=limite)) continue;
    for(const x of _seriesDouloureuses(sess)){
      const e=parEx[x.nom]=parEx[x.nom]||{nom:x.nom,n:0,painMax:0,derniere:0};
      e.n++; e.painMax=Math.max(e.painMax,x.pain);
      e.derniere=Math.max(e.derniere,sess.date);
    }
  }
  return Object.values(parEx).sort((a,b)=>b.n-a.n||b.derniere-a.derniere);
}

// ══════════ VISIBILITÉ COACH : DES DÉFAUTS EXPLICITES, PAS DEVINÉS ══════════
// Quatre blocs sont visibles du coach par défaut parce qu'il en a besoin pour
// décider : le cycle règle des repères nutritionnels, les états déclarés font
// ajuster les lipides et poser la question du bilan, le traitement change la
// lecture d'une prise de poids, le statut hormonal décale la fourchette.
//
// Quatre ne le sont PAS, et le défaut compte plus que le réglage : personne
// ne va chercher un interrupteur qu'il ignore. Grossesse et PES relèvent de
// l'intime avant de relever du coaching ; constantes et analyses sont des
// données médicales brutes que RepCore conserve sans les interpréter.
//
// MODIFIABLE PAR L'ATHLÈTE SEULEMENT. Aucune fonction d'écriture n'est
// exposée côté coach, et un test le vérifie.
const SANTE_BLOCS=Object.freeze(['cycle','etats','traitement','statutHormonal',
  'grossesse','pes','constantes','analyses']);
const SANTE_VISIBLE_DEFAUT=Object.freeze({
  cycle:true, etats:true, traitement:true, statutHormonal:true,
  grossesse:false, pes:false, constantes:false, analyses:false
});
// PURE. Rend le défaut du bloc quand l'athlète n'a rien réglé, et false pour
// un bloc inconnu : un nom mal orthographié ne doit pas ouvrir une visibilité.
function santeVisibleCoach(user,bloc){
  if(SANTE_BLOCS.indexOf(bloc)<0) return false;
  const v=(((user||{}).sante)||{}).visibleCoach;
  if(v&&typeof v[bloc]==='boolean') return v[bloc];
  // Repli sur les interrupteurs déjà livrés, à leur emplacement historique.
  // Aucune écriture, aucune migration : on LIT là où la donnée se trouve.
  const u=user||{};
  if(bloc==='grossesse'&&typeof u.grossessePartagee==='boolean') return u.grossessePartagee;
  if(bloc==='pes'&&typeof u.pesPartagee==='boolean') return u.pesPartagee;
  if(bloc==='cycle'&&u.cycle&&typeof u.cycle.contraceptionPartagee==='boolean')
    return u.cycle.contraceptionPartagee;
  return SANTE_VISIBLE_DEFAUT[bloc];
}
// Les blocs masqués, et OÙ ils vivent dans le dossier. C'est la seule table
// qui fasse le lien entre un nom de bloc et un champ : la garder unique évite
// qu'un envoi et un effacement divergent un jour.
const SANTE_CHAMPS=Object.freeze({
  grossesse:['grossesse'],
  pes:['pes'],
  constantes:['constantes'],
  analyses:['analyses']
});
// PURE. Ce qui doit partir vers sante_privee pour ce dossier.
// ══════ MIGRATION DES RELEVÉS VERS sante_privee ══════
// constantes et analyses étaient retirées avant envoi, faute de nœud où les
// mettre : elles ne survivaient pas à un changement d'appareil, et un
// localStorage purgé les emportait. Le nœud existe désormais ; ce lot les y
// écrit et les relit.
//
// LE SCHÉMA DES RÈGLES ÉTAIT FAUX et rejetait tout : elles déclaraient
// {valeur, valeur2, unite} là où le client émet {sys, dia, pouls}. Firebase
// refuse le PUT ENTIER sur un champ hors liste blanche, sans un mot. Ce sont
// les règles qui ont été alignées sur le client.
//
// UNION PAR DATE, jamais écrasement. Deux appareils qui relèvent chacun une
// tension le même jour doivent garder les deux ; c'est la date ISO complète
// qui dédoublonne, à la milliseconde.
function _unionParDate(a,b){
  const out=[];
  const vus=new Set();
  for(const l of [Array.isArray(a)?a:[],Array.isArray(b)?b:[]]){
    for(const e of l){
      if(!e||typeof e!=='object'||!e.date) continue;
      // La clé porte TOUT le contenu, pas seulement la date : deux relevés
      // différents au même horodatage — une tension et un pouls saisis
      // ensemble — ne doivent pas s'annuler.
      const k=JSON.stringify(e);
      if(vus.has(k)) continue;
      vus.add(k);
      out.push(e);
    }
  }
  return out.sort((x,y)=>x.date<y.date?-1:(x.date>y.date?1:0));
}
// IDEMPOTENTE : deux exécutions produisent le même état. Le drapeau `migre`
// n'est pas une garde d'exécution — c'est un horodatage. La garde, c'est
// l'union elle-même : rejouer ne crée aucun doublon.
//
// AUCUNE DONNÉE LOCALE N'EST SUPPRIMÉE. localStorage reste un cache, jamais
// une source unique. Si l'écriture distante échoue, le local est intact et
// la migration se rejoue au prochain démarrage.
async function _migrerSantePriveeLocale(){
  try{
    const u=currentUser;
    if(!u||!u.email||u.role==='coach') return null;
    if(!CLOUD.ok||!CLOUD.ok()) return null;
    const dist=await CLOUD.pullSantePrivee(u.email);
    const cst=_unionParDate(u.constantes,dist&&dist.constantes);
    const ana=_unionParDate(u.analyses,dist&&dist.analyses);
    // Rien des deux côtés : pas d'écriture à vide, qui écraserait le nœud.
    if(!cst.length&&!ana.length) return null;
    // Le LOCAL est enrichi le premier : même si l'envoi échoue, l'athlète
    // récupère ce que l'autre appareil avait déjà écrit.
    if(cst.length) u.constantes=cst;
    if(ana.length) u.analyses=ana;
    try{ saveUser(); }catch(e){ rcErreurMuette('_migrerSantePriveeLocale',e); }
    // L'envoi passe par le chemin NORMAL : santeBlocsPrives collecte les
    // deux séries, _doPushOne les écrit dans sante_privee. Un second chemin
    // d'écriture divergerait un jour de celui-ci.
    await CLOUD.pushOne(u.email,u);
    return {constantes:cst.length,analyses:ana.length};
  }catch(e){ console.warn('[RepCore] migration santé privée :',e); return null; }
}
// ══════════ EXPORT INTÉGRAL — ARTICLES 15 ET 20 ══════════
// Un export incomplet est PIRE qu'une absence d'export : il donne l'illusion
// d'avoir répondu. Tout ce qui n'est pas exportable est donc NOMMÉ dans le
// manifeste, avec sa raison.
//
// LE PIÈGE CENTRAL : un export bâti sur le seul objet currentUser raterait
// constantes, analyses, grossesse et pes — ils vivent dans sante_privee,
// hors de users/. On lit les DEUX nœuds, explicitement.
//
// Et un fait mesuré, contraire à ce qu'on croit souvent ici : cycle,
// contraception, SOPK, thyroïde, traitements et statut hormonal vivent dans
// users/, PAS dans sante_privee — ils sont délibérément visibles du coach,
// qui ajuste des repères avec. L'export les prend donc par le premier nœud.
//
// _validateAthletePkg n'est PAS réutilisée : douze champs sur quatre-vingt-dix.
const EXPORT_AVERTISSEMENT='CE FICHIER CONTIENT DES DONNÉES DE SANTÉ EN CLAIR. '
  +'Il n\'est ni chiffré ni protégé par mot de passe. Ne le dépose pas sur un '
  +'service partagé et ne l\'envoie pas par un canal que tu ne maîtrises pas.';
// Catégories annoncées dans privacy.html qui ne PEUVENT pas figurer, et
// pourquoi. Les taire rendrait l'export silencieusement incomplet.
const EXPORT_NON_INCLUS=Object.freeze([
  Object.freeze({categorie:'Photos de plan alimentaire (diète stricte)',
    raison:'Stockées uniquement sur cet appareil (localStorage), jamais synchronisées : elles ne font partie d\'aucun dossier.'}),
  Object.freeze({categorie:'Fichiers vidéo d\'exécution',
    raison:'Hébergés chez Cloudinary. Seules les URL figurent dans « medias » ; les fichiers se demandent par écrit.'}),
  Object.freeze({categorie:'Fiche programme au format PDF',
    raison:'Hébergée chez Firebase Storage. Seule l\'URL figure dans « medias ».'}),
  Object.freeze({categorie:'Jeton d\'authentification',
    raison:'Secret technique de connexion. L\'exporter reviendrait à exporter un mot de passe.'}),
  Object.freeze({categorie:'Profil de ton coach',
    raison:'Données d\'un tiers. Un export ne contient jamais les données de quelqu\'un d\'autre.'}),
  // Une note ECRITE PAR le coach mais PORTANT SUR l athlete est la donnee
  // personnelle de l athlete (art. 15), pas celle d un tiers. La ranger sous
  // « profil de ton coach » rendrait ce manifeste faux — or il existe
  // exactement pour dire ce qui manque et pourquoi.
  Object.freeze({categorie:'Notes privées de ton coach à ton sujet',
    raison:'Elles sont enregistrées dans le dossier de ton coach, auquel RepCore ne te donne pas accès : '
      +'cet export ne peut pas les contenir. Elles te sont néanmoins communicables : demande-les-lui.'}),
  Object.freeze({categorie:'Compteurs techniques (quota, mesure de tunnel)',
    raison:'Agrégats anonymes sans lien avec ton compte : ils ne te concernent pas individuellement.'}),
  Object.freeze({categorie:'Brouillon de séance en cours',
    raison:'État transitoire de l\'écran, effacé à la fin de la séance.'})
]);
// Les URL de médias, sans les fichiers. Ta règle : aucun contenu embarqué.
function _exportMedias(u){
  const out=[];
  try{
    for(const v of (u.videos||[])) if(v&&v.url)
      out.push({type:'video',url:v.url,exercice:v.exercice||v.nom||'',date:v.date||null});
  }catch(e){}
  try{ if(u.programPdfUrl) out.push({type:'pdf',url:u.programPdfUrl,nom:u.programPdfName||''}); }catch(e){}
  try{
    for(const b of (u.bilans||[]))
      for(const k of Object.keys(b||{}))
        if(/photo/i.test(k)&&typeof b[k]==='string'&&/^https?:/.test(b[k]))
          out.push({type:'photo',url:b[k],date:b.date||null});
  }catch(e){}
  return out;
}
const EXPORT_MEDIAS_MARCHE='Ces fichiers ne sont pas inclus dans l\'export. '
  +'Les URL ci-dessus permettent de les télécharger tant qu\'ils existent. '
  +'Pour en obtenir une copie durable, écris à '+CREATOR_EMAIL+' en '
  +'mentionnant ton adresse de compte : la réponse est due sous un mois '
  +'(RGPD art. 12.3).';
// Charge les DEUX nœuds. Réseau d'abord, cache local en repli — et le
// manifeste DIT lequel a servi. Un export amputé qui ne se déclare pas
// amputé est un piège pour celui qui s'en sert.
//
// DISPONIBLE SUR UN COMPTE EXPIRÉ, IMPAYÉ, OU SANS COACH. Règle cardinale :
// le droit d'accès ne se suspend pas pour défaut de paiement.
async function _chargerExportComplet(user){
  const u=user||currentUser;
  if(!u||!u.email) return null;
  const src={profil:'local',sante_privee:'absent'};
  const notes=[];
  // 1. Le dossier. Le local fait foi s'il est plus complet : c'est lui que
  // l'utilisateur voit, et un export doit refléter ce qu'il a sous les yeux.
  let profil={...u};
  try{
    if(CLOUD.ok&&CLOUD.ok()){
      const dist=await CLOUD.pullUser(u.email);
      if(dist&&typeof dist==='object'){
        profil=Object.assign({},dist,u);   // le local prime, champ par champ
        src.profil='réseau + local';
      } else {
        notes.push('Le dossier distant n\'a pas pu être lu : cet export repose sur les données de cet appareil. Il peut manquer ce qui a été saisi ailleurs et pas encore redescendu.');
      }
    } else {
      notes.push('Hors ligne au moment de l\'export : seules les données de cet appareil y figurent.');
    }
  }catch(e){
    notes.push('Lecture du dossier distant en échec ('+(e&&e.message||'erreur')+') : export construit sur cet appareil.');
  }
  // Jamais dans un export : ce sont des secrets, pas des données personnelles.
  for(const k of ['pwd','pwdHash','_st','_stb64','_sk']) delete profil[k];
  // 2. Le nœud privé. SANS LUI, l'export raterait exactement l'article 9.
  let prive=null;
  try{
    if(CLOUD.ok&&CLOUD.ok()){
      prive=await CLOUD.pullSantePrivee(u.email);
      if(prive) src.sante_privee='réseau';
    }
  }catch(e){
    notes.push('Lecture du nœud de santé privée en échec : les relevés locaux sont utilisés à la place.');
  }
  // Repli local : santeBlocsPrives sait exactement ce qui y vit.
  const local=santeBlocsPrives(u);
  if(!prive&&Object.keys(local).length){ prive=local; src.sante_privee='local'; }
  else if(prive){
    // Union, jamais écrasement : un relevé local non encore monté doit sortir.
    for(const k of ['constantes','analyses'])
      if(local[k]) prive[k]=_unionParDate(prive[k],local[k]);
    for(const k of ['grossesse','pes'])
      if(prive[k]===undefined&&local[k]!==undefined) prive[k]=local[k];
  }
  return {profil:profil,prive:prive||{},sources:src,notes:notes};
}
// Le manifeste : ce qu'il y a, et surtout ce qu'il n'y a PAS.
function _manifesteExport(paquet){
  const pr=paquet.profil||{}, pv=paquet.prive||{};
  const presentes=[];
  const inspecter=(obj,noeud)=>{
    for(const k of Object.keys(obj||{})){
      const v=obj[k];
      if(v===undefined||v===null) continue;
      if(Array.isArray(v)&&!v.length) continue;
      presentes.push({cle:k,noeud:noeud,
        entrees:Array.isArray(v)?v.length:(typeof v==='object'?Object.keys(v).length:1)});
    }
  };
  inspecter(pr,'users');
  inspecter(pv,'sante_privee');
  return {
    genere_le:new Date().toISOString(),
    politique_acceptee:((pr.consent||{}).policyVersion)||null,
    politique_courante:POLICY_VERSION,
    sources:paquet.sources,
    avertissements:paquet.notes||[],
    categories_incluses:presentes,
    categories_non_incluses:EXPORT_NON_INCLUS.map(x=>({categorie:x.categorie,raison:x.raison})),
    a_savoir:'Cet export est un INSTANTANÉ. Il n\'est pas conçu pour être réimporté dans RepCore. '
      +'Les catégories non incluses ci-dessus sont listées pour que tu saches ce qui manque et pourquoi : '
      +'un export silencieusement incomplet ne vaudrait rien.'
  };
}
// ── CSV : trois séries, pour qui veut ouvrir un tableur ─────────────────
// Le JSON répond à l'article 20 — format structuré, lisible par machine. Le
// CSV répond à l'usage réel : ouvrir ses pesées dans un tableur sans savoir
// ce qu'est un JSON.
function _csvEchap(v){
  const t=(v===undefined||v===null)?'':String(v);
  // Point-virgule comme séparateur : Excel en français découpe là-dessus.
  return /[";\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;
}
function _csv(lignes){
  // BOM UTF-8 : sans lui, Excel affiche « SÃ©ance » au lieu de « Séance ».
  return '\ufeff'+lignes.map(l=>l.map(_csvEchap).join(';')).join('\r\n');
}
function _csvSeances(u){
  const l=[['date','seance','exercice','serie','charge_kg','repetitions','rir','douleur']];
  for(const s2 of ((u&&u.sessions)||[])){
    const d=s2&&s2.date?new Date(s2.date).toISOString():'';
    const nom=(s2&&s2.name)||'';
    const data=(s2&&s2.data)||{};
    for(const ex of Object.keys(data)){
      const sets=(data[ex]&&data[ex].sets)||[];
      sets.forEach((st,i)=>l.push([d,nom,ex,i+1,
        st&&st.weight,st&&st.reps,st&&st.rir,st&&st.pain]));
    }
  }
  return _csv(l);
}
function _csvJournalAlimentaire(u){
  const l=[['jour','repas','aliment','quantite','kcal','proteines_g','glucides_g','lipides_g','sel_g','fibres_g','tenu']];
  const nut=((u&&u.nutrition)||{}), log=nut.log||{};
  for(const jour of Object.keys(log).sort()){
    // LOT N8 : le jour tenu (cibleTenue), répété sur chaque ligne du jour.
    let tenu='';
    try{
      const m=nut.macros?(_getEffectiveMacros(nut,nutIsOnDay(jour,u),jour,u)||{}):{};
      const ck=Number(m.kcal)>0?Number(m.kcal):_dieteKcal(m), cp=Number(m.p)||0;
      if(ck>0&&cp>0) tenu=cibleTenue(journalTotalJour(log,jour),{kcal:ck,p:cp}).tenue?1:0;
    }catch(e){ tenu=''; }
    for(const e of ((log[jour]&&log[jour].entries)||[]))
      l.push([jour,e&&e.repas,e&&e.nom,e&&(e.qty!=null?e.qty:e.qte),e&&e.kcal,e&&e.p,e&&e.c,e&&e.l,e&&e.sel,
        e&&(e.fi!=null?e.fi:e.fibres),tenu]);
  }
  return _csv(l);
}
function _csvPesees(u){
  const l=[['date','poids_kg']];
  for(const e of ((u&&u.weightLog)||[])) if(e&&e.date) l.push([e.date,e.kg]);
  return _csv(l);
}
// Un téléchargement, et l'URL objet RÉVOQUÉE : sans révocation, le blob reste
// en mémoire jusqu'au rechargement de la page — et un export de dossier
// complet pèse.
function _telecharger(nom,contenu,type){
  try{
    const b=new Blob([contenu],{type:type||'application/json;charset=utf-8'});
    const url=URL.createObjectURL(b);
    const a=document.createElement('a');
    a.href=url; a.download=nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} },4000);
    return true;
  }catch(e){ console.error('[RepCore] export :',e); return false; }
}
function _nomFichierExport(ext){
  const d=new Date();
  const j=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')
    +'-'+String(d.getDate()).padStart(2,'0');
  return 'repcore-mes-donnees-'+j+'.'+ext;
}
// L'export complet, disponible SANS CONDITION : compte expiré, impayé, coach
// parti. Le droit d'accès ne se suspend pas pour défaut de paiement, et rien
// ici ne consulte checkAccess ni le statut.
async function exporterMesDonnees(){
  const u=currentUser;
  if(!u||!u.email){ toast('Aucun dossier à exporter.','var(--orange)'); return false; }
  toast('Préparation de ton export…','var(--sub)');
  const paquet=await _chargerExportComplet(u);
  if(!paquet){ toast('Export impossible : dossier illisible.','var(--red)'); return false; }
  const doc={
    _avertissement:EXPORT_AVERTISSEMENT,
    manifeste:_manifesteExport(paquet),
    profil:paquet.profil,
    sante_privee:paquet.prive,
    medias:{fichiers:_exportMedias(paquet.profil),marche_a_suivre:EXPORT_MEDIAS_MARCHE}
  };
  _telecharger(_nomFichierExport('json'),JSON.stringify(doc,null,2));
  _telecharger('repcore-seances.csv',_csvSeances(paquet.profil),'text/csv;charset=utf-8');
  _telecharger('repcore-journal-alimentaire.csv',_csvJournalAlimentaire(paquet.profil),'text/csv;charset=utf-8');
  _telecharger('repcore-pesees.csv',_csvPesees(paquet.profil),'text/csv;charset=utf-8');
  // LA DATE SEULE. Ni le contenu, ni la taille, ni ce qui a été demandé.
  try{
    if(!u.rgpd||typeof u.rgpd!=='object') u.rgpd={};
    u.rgpd.dernierExport=Date.now();
    saveUser();
  }catch(e){}
  toast('Export téléchargé '+ICO.coche,'var(--green)');
  return true;
}
// Voir AVANT de télécharger : ce qui sort, et surtout ce qui ne sort pas.
async function voirContenuExport(cible){
  // Deux écrans l'appellent — celui du coach et celui de l'athlète — et un
  // même identifiant ne peut pas exister deux fois. La cible est passée.
  const z=document.getElementById(cible||'exp-manifeste');
  if(!z) return false;
  z.style.display='block';
  z.innerHTML='<div class="sub" style="font-size:var(--fs-sm)">Lecture…</div>';
  const paquet=await _chargerExportComplet(currentUser);
  if(!paquet){ z.innerHTML='<div class="sub" style="font-size:var(--fs-sm)">Dossier illisible.</div>'; return false; }
  const m=_manifesteExport(paquet);
  const lst=(t,items)=>`<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin:10px 0 6px">${escapeHtml(t)}</div>`
    +items.map(x=>`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;padding:2px 0">${x}</div>`).join('');
  z.innerHTML=lst('Inclus ('+m.categories_incluses.length+')',
      m.categories_incluses.map(c=>escapeHtml(c.cle)+' <span style="color:var(--text-faint)">· '+escapeHtml(c.noeud)+' · '+c.entrees+'</span>'))
    +lst('NON inclus ('+m.categories_non_incluses.length+')',
      m.categories_non_incluses.map(c=>'<b>'+escapeHtml(c.categorie)+'</b><br><span style="color:var(--text-faint)">'+escapeHtml(c.raison)+'</span>'))
    +(m.avertissements.length?lst('À savoir',m.avertissements.map(escapeHtml)):'')
    +`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:10px">${escapeHtml(EXPORT_AVERTISSEMENT)}</div>`;
  return true;
}
function santeBlocsPrives(user){
  const out={};
  for(const bloc of Object.keys(SANTE_CHAMPS)){
    if(santeVisibleCoach(user,bloc)) continue;
    for(const champ of SANTE_CHAMPS[bloc]){
      const v=(user||{})[champ];
      if(v!==undefined&&v!==null) out[champ]=v;
    }
  }
  return out;
}
const _cacheSignaux=new Map();
// LOT T8 : le nombre de calculs COMPLETS (hors cache). La vue du lundi le lit en
// test : lire les signaux ne doit jamais en déclencher un de plus.
let _signauxCalculs=0;
function _viderCacheSignaux(){ _cacheSignaux.clear(); }
const SIGNAUX_VIDES=Object.freeze({douleur:false,douleurDiffuse:false,decrochage:false,chuteAssiduite:false,
  plateauMuscle:false,sousMEV:false,volumeHaut:false,formeBasse:false,
  restrictionLongue:false,calibrageDu:false,blocPrioriteFini:false,
  sautDeCharge:false,details:Object.freeze({})});

// opts.complet : ne PAS court-circuiter les signaux de rang 6 quand un rang
// superieur est deja acquis. Le classement n en a pas besoin — un 6 ne peut
// pas depasser un 9 deja obtenu — mais celui qui SCORE, si : sans cette
// option, un athlete douloureux ET en surcharge de volume pesait MOINS qu un
// athlete seulement en surcharge, l inverse de ce qu on mesure.
function signauxEntrainement(c,opts){
  const _complet=!!(opts&&opts.complet);
  // Invité non inscrit : aucun historique d'entraînement chez le coach, donc
  // aucun signal. Cohérent avec les exclusions déjà présentes d'urgencyScore.
  if(!c||c._fromCode) return SIGNAUX_VIDES;
  const ss=(c.sessions||[]).filter(s=>s&&s.date);
  const tri=ss.slice().sort((a,b)=>a.date-b.date);
  const der=tri.slice(-SIG_SEANCES);
  // La clé porte une empreinte du CONTENU douleur des trois dernières séances,
  // et pas seulement (identifiant, nombre, date). Sans elle, deux historiques
  // de même longueur et de même date finale partagent une entrée de cache —
  // et une douleur qui passe de 4 à 6 dans une séance corrigée ou resynchronisée
  // reste invisible. C'est exactement le cas que la règle d'aggravation doit
  // rattraper : le cache ne doit pas la masquer. Coût borné à trois séances.
  let emp='';
  for(const sess of der){
    const l=_seriesDouloureuses(sess);
    emp+=';'+(sess.id||sess.date)+':'+l.length+':'+l.reduce((m,x)=>Math.max(m,x.pain),0);
  }
  const _ph=c.phase&&c.phase.type?(c.phase.type+'@'+c.phase.debut):'';
  const _mk=(()=>{ const m=(c.nutrition||{}).macros;
    if(!m) return ''; return String((m.on&&m.on.kcal)||'')+'/'+String((m.off&&m.off.kcal)||''); })();
  const cle=c.id+'|'+ss.length+'|'+(ss.length?tri[tri.length-1].date:0)+'|'+emp+'|'+_ph+'|'+_mk+(_complet?'|C':'');
  if(_cacheSignaux.has(cle)) return _cacheSignaux.get(cle);
  _signauxCalculs++;
  const r={douleur:false,douleurDiffuse:false,decrochage:false,chuteAssiduite:false,
    plateauMuscle:false,sousMEV:false,volumeHaut:false,formeBasse:false,
    restrictionLongue:false,calibrageDu:false,blocPrioriteFini:false,
    sautDeCharge:false,details:{}};
  // La restriction prolongée ne dépend pas des séances : elle se calcule ICI,
  // avant le retour anticipé. Placée plus bas, un athlète en sèche longue qui
  // ne journalise aucune séance ne serait jamais remonté au coach.
  try{
    if(restrictionProlongee(c)){
      r.restrictionLongue=true;
      const _pl=plancherEffectif(c);
      const _m=(c.nutrition||{}).macros||{};
      const _bas=Math.min.apply(null,[_m.on,_m.off].filter(x=>x&&Number(x.kcal)>0).map(x=>Number(x.kcal)));
      r.details.restrictionLongue={semaines:semainesEcoulees(c),kcal:_bas,plancher:_pl.kcal};
    }
  }catch(e){}
  if(!ss.length){ _cacheSignaux.set(cle,r); return r; }

  // ── Douleur ciblée : même exercice, au moins deux séries ET deux séances ──
  if(tri.length>=SIG_DOULEUR_MIN_SEANCES){
    const parEx={};
    for(const sess of der){
      const vues=new Set();
      for(const x of _seriesDouloureuses(sess)){
        const e=parEx[x.nom]=parEx[x.nom]||{nom:x.nom,series:0,seances:0,painMax:0,dates:[]};
        e.series++; e.painMax=Math.max(e.painMax,x.pain);
        if(!vues.has(x.nom)){ vues.add(x.nom); e.seances++; e.dates.push(sess.date); }
      }
    }
    const touches=Object.values(parEx)
      .filter(e=>e.series>=2&&e.seances>=SIG_DOULEUR_MIN_SEANCES)
      .sort((a,b)=>b.painMax-a.painMax||b.seances-a.seances);
    if(touches.length){
      r.douleur=true;
      r.details.douleur=touches[0];
      r.details.douleurTous=touches;
    }
  }

  // ── Douleur diffuse : exercices confondus, sur quatorze jours ──
  const limite=Date.now()-SIG_DIFFUS_JOURS*864e5;
  let nDiffus=0, painMaxDiffus=0; const exDiffus=new Set();
  for(const sess of tri){
    if(!(sess.date>=limite)) continue;
    for(const x of _seriesDouloureuses(sess)){
      nDiffus++; exDiffus.add(x.nom); painMaxDiffus=Math.max(painMaxDiffus,x.pain);
    }
  }
  if(nDiffus>=SIG_DIFFUS_MIN){
    r.douleurDiffuse=true;
    r.details.douleurDiffuse={series:nDiffus,exercices:[...exDiffus],
      jours:SIG_DIFFUS_JOURS,painMax:painMaxDiffus};
  }

  // ── Décrochage d'exécution ──
  // Les séances antérieures au champ setsPlanned sont EXCLUES : un « 5 » sans
  // prévu ne dit pas s'il vaut 5 sur 5 ou 5 sur 12.
  if(tri.length>=SIG_SEANCES){
    const evaluables=der.filter(s=>Number(s.setsPlanned)>0);
    if(evaluables.length){
      let faits=0,prevus=0;
      for(const s of evaluables){ faits+=(parseInt(s.sets,10)||0); prevus+=Number(s.setsPlanned); }
      if(prevus>0&&(faits/prevus)<SIG_DECROCHAGE){
        r.decrochage=true;
        r.details.decrochage={faits,prevus,seances:evaluables.length,
          ratio:Math.round(faits/prevus*100)/100};
      }
    }
  }

  // ── Signaux de niveau 6 : jamais calculés si un niveau supérieur est acquis ──
  // Ce n'est pas une approximation. Un signal de niveau 6 ne peut pas dépasser
  // un 7, 8 ou 9 déjà obtenu : le classement est identique, et on épargne le
  // parcours complet de l'historique pour les athlètes déjà en tête.
  if(!_complet&&(r.douleur||r.douleurDiffuse||r.decrochage)){ _cacheSignaux.set(cle,r); return r; }

  // CHUTE D ASSIDUITE. Le taux de completion ne declenche AUCUNE notification :
  // il n alimente que ce signal-la, et seulement si la tendance perd plus de
  // TC_TENDANCE_CHUTE points. Un taux bas mais STABLE ne remonte rien - c est
  // une mesure, pas un jugement.
  try{
    const _tc=tauxCompletion(c,Date.now());
    if(_tc&&_tc.interpretable&&_tc.tendance!=null&&_tc.tendance<-TC_TENDANCE_CHUTE){
      r.chuteAssiduite=true;
      r.details.chuteAssiduite={taux:_tc.taux,tendance:_tc.tendance,fenetre:_tc.fenetre};
    }
  }catch(e){}
  // ── Habitudes sous le seuil ──
  // Un signal d'INTENDANCE, jamais de santé : il rejoint le niveau 6 et n'y
  // bouge plus. Sans habitude assignée, il ne se lève pas — l'absence n'est
  // pas un manquement.
  try{
    if(habSignalBas(c)){
      r.habitudesBasses=true;
      r.details.habitudesBasses={taux:habTauxGlobal(c,HAB_SIGNAL_JOURS),
        jours:HAB_SIGNAL_JOURS,seuil:HAB_SIGNAL_SEUIL};
    }
  }catch(e){}
  try{
    const mus=musclesEnPlateau(c);
    if(mus.length){
      r.plateauMuscle=true;
      const x=mus[0];
      r.details.plateauMuscle={muscle:x.m,
        lib:(MUSCLES[x.m]||{}).lib||x.m,
        bloques:x.exercices.filter(e=>e.etat==='plateau'||e.etat==='regression').length,
        semaines:Math.max(0,Math.floor(Math.max(...x.exercices.map(e=>e.joursDepuisRecord||0))/7)),
        // LOT T8 : régression ou plateau, et depuis quand (le dernier record).
        regression:x.exercices.some(e=>e.etat==='regression'),
        joursRecord:Math.max(0,...x.exercices.map(e=>e.joursDepuisRecord||0))};
    }
  }catch(e){}

  // ── LE BLOC DE PRIORITE EST-IL ARRIVE A ECHEANCE ? ──
  // RIEN NE SE RECONDUIT TOUT SEUL. A l'echeance, le coach decide de
  // reconduire, d'inverser ou de revenir a plat — et pour decider il lui faut
  // le rapprochement avec les mensurations, qui ferme la boucle : le volume a
  // bouge, est-ce que le corps a suivi ?
  try{
    const _av=blocAvancement(c);
    if(_av&&_av.fini){
      const _b=blocPriorite(c);
      r.blocPrioriteFini=true;
      const _m=(_b&&_b.hauts.length)
        ? blocMesureBilan(c,_b.hauts[0],_b.debut,Date.now()) : null;
      r.details.blocPrioriteFini={semaines:_av.total,
        hauts:(_b&&_b.hauts)||[],mesure:_m};
    }
  }catch(e){}
  // ── LA CHARGE A-T-ELLE SAUTE ? ──
  // DEUX SEMAINES DE SUITE, PAS UNE. Une semaine chargee est un choix
  // d'entrainement ; deux d'affilee au-dessus de la moitie de la moyenne du
  // mois, c'est une derive que personne n'a decidee.
  try{
    const _sc=sautDeCharge(c);
    if(_sc){ r.sautDeCharge=true; r.details.sautDeCharge=_sc; }
  }catch(e){}
  // ── LE CALIBRAGE DU RIR EST-IL A REFAIRE ? ──
  // CE N'EST PAS UNE URGENCE, C'EST DE L'ENTRETIEN. Le signal n'entre pas dans
  // urgencyScore — deliberement : un calibrage perime ne remonte personne dans
  // la liste du coach, il ajoute seulement une ligne en bas de ses taches.
  // Trois mois, parce que la perception s'affine avec l'entrainement : un
  // repere pris au huitieme mois ne dit plus rien au vingtieme.
  try{ if(calibrageRirDu(c)){
    r.calibrageDu=true;
    const _cal=calibrageRirDe(c);
    r.details.calibrageDu={n:(_cal&&_cal.n)||0,maj:(_cal&&_cal.maj)||null,
      seances:ss.length,
      jours:(_cal&&_cal.maj)?Math.floor((Date.now()-_cal.maj)/864e5):null};
  } }catch(e){}
  try{
    const [s1,s2]=_semainesRevolues(2);
    const recentes=_semainesRevolues(SIG_MEV_SEMAINES_CANDIDAT);
    const v1=volumeSemaine(c,s1)||{}, v2=volumeSemaine(c,s2)||{};
    // Muscle CANDIDAT : travaillé au moins une fois sur les quatre dernières
    // semaines révolues. Sans ce filtre, un débutant qui ne fait que du haut
    // du corps serait signalé « sous MEV » sur douze muscles qu'il n'a jamais
    // eu l'intention de travailler.
    const candidats=new Set();
    for(const cle2 of recentes){
      const v=volumeSemaine(c,cle2)||{};
      for(const m in v) if(v[m]>0) candidats.add(m);
    }
    for(const m of candidats){
      const rep=reperesEffectifs(c,m);
      // Un muscle sans repere ne peut sortir d'aucune zone : ni sous le MEV,
      // ni au-dessus du MRV. LOMBAIRES, ABDUCTEURS et ADDUCTEURS sont dans ce
      // cas et ne leveront donc jamais ces deux signaux.
      if(!rep) continue;
      if(!r.sousMEV&&(v1[m]||0)<rep.mev&&(v2[m]||0)<rep.mev){
        r.sousMEV=true;
        r.details.sousMEV={muscle:m,lib:(MUSCLES[m]||{}).lib||m,
          mev:rep.mev,s1:v1[m]||0,s2:v2[m]||0,semaines:[s1,s2]};
      }
      // Symetrique du sous-MEV, sur le MEME patron : deux semaines revolues
      // consecutives au-dessus du repere haut. Une seule semaine ne suffit
      // pas — un pic isole est un choix d'entrainement, pas une derive.
      if(!r.volumeHaut&&(v1[m]||0)>rep.mrv&&(v2[m]||0)>rep.mrv){
        r.volumeHaut=true;
        r.details.volumeHaut={muscle:m,lib:(MUSCLES[m]||{}).lib||m,
          mrv:rep.mrv,s1:v1[m]||0,s2:v2[m]||0,semaines:[s1,s2]};
      }
      if(r.sousMEV&&r.volumeHaut) break;
    }
  }catch(e){}

  try{
    if(tri.length>=SIG_SEANCES){
      const moy=formeMoy3(c), base=baseForme(c);
      if(moy!=null&&base!=null&&moy<=base-SIG_FORME_ECART){
        r.formeBasse=true;
        r.details.formeBasse={moy:Math.round(moy*10)/10,base:Math.round(base*10)/10,
          ecart:Math.round((base-moy)*10)/10};
      }
    }
  }catch(e){}

  _cacheSignaux.set(cle,r);
  return r;
}

// ══════════════ FATIGUE ACCUMULÉE ══════════════
// PROPOSER une semaine de décharge, motivée par des chiffres. JAMAIS la
// déclencher : aucune écriture sur `deload` sans un geste explicite du coach.
//
// CE CALCUL NE MESURE RIEN DE NEUF, ET C'EST VOULU.
// Quatre des cinq signaux demandés existaient déjà, calculés, chiffrés et mis
// en cache dans signauxEntrainement : volumeHaut, plateauMuscle (qui porte
// aussi la régression), formeBasse, douleur et douleurDiffuse. Les recalculer
// avec des règles voisines mais différentes — « ≥ 1 primaire ou ≥ 2 muscles »
// contre « deux semaines révolues consécutives » — aurait produit deux verdicts
// divergents sur le même athlète. scoreFatigue LIT donc signauxEntrainement et
// se contente de pondérer. Un seul calcul, une seule vérité, et aucun seuil
// existant n'est touché.
//
// LA DOULEUR RÉUTILISE LE SEUIL DUR EXISTANT (série ≥ 4, sur ≥ 2 séries ET
// ≥ 2 séances, ou ≥ 6 séries diffuses sur quatorze jours). Une « moyenne ≥ 3 »
// aurait été un SECOND seuil de douleur, plus bas que celui que l'application
// défend partout ailleurs, et verrouillé par une assertion.
const FATIGUE_SEUIL=60;              // score à partir duquel on propose
const FATIGUE_SEMAINES_MIN=3;        // en dessous, aucun verdict
const FATIGUE_SOMMEIL_J=21;          // un refus met la détection en sommeil
const FATIGUE_REPORT_J=7;            // un report la décale d'une semaine
const FATIGUE_COUPURE_J=21;          // au-delà, les compteurs repartent de zéro
// Les poids, EXPOSÉS et non cachés : c'est ce qui permet au coach de discuter
// la proposition au lieu de la subir.
const FATIGUE_POIDS=Object.freeze({
  volumeHaut:35, regression:25, plateau:15, douleur:15, forme:10,
  // build 1828 : la disponibilité orange ou rouge 3 jours sur 7 — le feu du
  // jour et la proposition de décharge racontent la même histoire.
  recuperation:15
});
const FATIGUE_DISPO_JOURS=3;
// PURE. Le sous-dossier fatigue, quel que soit l'état du document. Un champ
// corrompu ne doit ni lever d'exception ni faire disparaître l'écran coach.
function fatigueDe(user){
  const f=user&&user.fatigue;
  if(!f||typeof f!=='object'||Array.isArray(f)) return null;
  const pa=(f.propositionActive&&typeof f.propositionActive==='object'
    &&!Array.isArray(f.propositionActive))?f.propositionActive:null;
  return {
    score:isFinite(Number(f.score))?Number(f.score):0,
    motifs:Array.isArray(f.motifs)?f.motifs.filter(m=>m&&typeof m==='object'):[],
    calculeLe:isFinite(Number(f.calculeLe))?Number(f.calculeLe):0,
    sommeilJusquA:isFinite(Number(f.sommeilJusquA))?Number(f.sommeilJusquA):0,
    suspendue:f.suspendue===true,
    propositionActive:(pa&&pa.statut==='ouverte')?pa:null
  };
}
// PURE. La détection est SUSPENDUE sans jamais dire pourquoi.
//
// L'athlète décide si son coach voit sa grossesse : _sanitizeForCoach efface
// le champ quand elle ne l'a pas partagé. Une carte qui annoncerait « détection
// suspendue pour raison de santé » la révélerait donc à celui à qui elle a
// choisi de ne rien dire. Le drapeau `suspendue` est écrit CÔTÉ ATHLÈTE, au
// moment où elle déclare ou révoque — un point de sauvegarde qui existe déjà,
// donc pas une écriture de plus — et il ne porte AUCUN motif.
function fatigueSuspendue(c){
  if(!c) return true;
  const f=fatigueDe(c);
  if(f&&f.suspendue) return true;
  try{ if(grossesseSuspend(c)) return true; }catch(e){}
  try{ if(drapeauQuelconqueActif(c)) return true; }catch(e){}
  return false;
}
// Écrit le drapeau neutre. Appelée aux transitions de grossesse, jamais en
// boucle : elle ne provoque aucune sauvegarde à elle seule.
function majSuspensionFatigue(user){
  const u=_dossier(user);
  if(!u) return false;
  let susp=false;
  try{ susp=grossesseSuspend(u); }catch(e){}
  if(!u.fatigue||typeof u.fatigue!=='object'||Array.isArray(u.fatigue)) u.fatigue={};
  if(susp) u.fatigue.suspendue=true; else delete u.fatigue.suspendue;
  // Une détection suspendue ne laisse pas une proposition ouverte derrière
  // elle : elle serait appliquée sans que rien ne la recalcule.
  if(susp) delete u.fatigue.propositionActive;
  return susp;
}
// PURE. Le nombre de semaines révolues CONSÉCUTIVES portant au moins une
// séance, en partant de la plus récente. Sert de garde d'exploitabilité.
function _semainesFatigue(user,dateRef){
  const ss=((user&&user.sessions)||[]).filter(x=>x&&x.date);
  if(!ss.length) return 0;
  const ref=(dateRef instanceof Date)?dateRef.getTime():Number(dateRef||Date.now());
  // Reprise après une coupure longue : les compteurs repartent de zéro. Ce
  // n'est pas de la fatigue accumulée, c'est un retour.
  const derniere=ss.reduce((m,x)=>Math.max(m,x.date),0);
  if(ref-derniere>=FATIGUE_COUPURE_J*864e5) return 0;
  const lundi=_lundiDe(new Date(ref)).getTime();
  let n=0;
  for(let i=1;i<=FATIGUE_SEMAINES_MIN+9;i++){
    // EN CALENDRIER : une borne de semaine posee en millisecondes derive d'une
    // heure au changement d'horaire, et une seance du dimanche soir bascule
    // alors dans la semaine voisine — ici, elle romprait la serie et ferait
    // sous-estimer l'anciennete de la charge.
    const d=_datePlusJours(lundi,-i*7).getTime(), f=_datePlusJours(lundi,-(i-1)*7).getTime();
    if(ss.some(x=>x.date>=d&&x.date<f)) n++; else break;
  }
  return n;
}
// PURE, AUCUNE ÉCRITURE. Rend {score, motifs, exploitable}.
//
// Chaque motif porte sa valeur ET son unité : une proposition sans motif chiffré
// serait une injonction, et l'application n'en produit pas.
function scoreFatigue(user,dateRef){
  const vide={score:0,motifs:[],exploitable:false};
  if(!user) return vide;
  const semaines=_semainesFatigue(user,dateRef);
  if(semaines<FATIGUE_SEMAINES_MIN) return vide;
  let sg=null;
  try{ sg=signauxEntrainement(user,{complet:true}); }catch(e){ return vide; }
  if(!sg) return vide;
  const d=sg.details||{};
  const motifs=[]; let score=0;
  const pousser=(code,libelle,valeur,unite,poids)=>{
    motifs.push({code,libelle,valeur,unite}); score+=poids; };
  if(sg.volumeHaut&&d.volumeHaut){
    pousser('volume','Volume au-dessus du MRV sur '+(d.volumeHaut.lib||d.volumeHaut.muscle),
      Math.round((d.volumeHaut.s1||0)*10)/10,'séries pondérées (MRV '+d.volumeHaut.mrv+')',
      FATIGUE_POIDS.volumeHaut);
  }
  // Plateau et régression viennent du MÊME calcul par muscle : on les sépare
  // parce qu'un recul ne se lit pas comme une stagnation.
  // _listeEtats est le parcours DEJA partage entre l ecran de plateaux et
  // signauxEntrainement : meme detecteur, memes seuils, meme cache. On le lit
  // au niveau de l EXERCICE et non de l agregat musculaire de musclesEnPlateau,
  // qui exige deux primaires en plateau sur un meme muscle — un critere de
  // remontee au coach, trop strict pour peser une fatigue.
  let recul=0, stagne=0, nomRecul=null, nomStagne=null;
  try{
    for(const x of _listeEtats(user)){
      if(x.etat==='regression'){ recul++; if(!nomRecul) nomRecul=x.nom; }
      else if(x.etat==='plateau'){ stagne++; if(!nomStagne) nomStagne=x.nom; }
    }
  }catch(e){}
  if(recul){
    pousser('regression','Recul sur '+String(nomRecul||'').toLowerCase(),
      recul,recul>1?'exercices':'exercice',FATIGUE_POIDS.regression);
  }
  if(stagne){
    pousser('plateau','Plateau sur '+String(nomStagne||'').toLowerCase(),
      stagne,stagne>1?'exercices':'exercice',FATIGUE_POIDS.plateau);
  }
  if(sg.douleur&&d.douleur){
    pousser('douleur','Douleur répétée sur '+String(d.douleur.nom||'').toLowerCase(),
      d.douleur.series,'séries douloureuses',FATIGUE_POIDS.douleur);
  }else if(sg.douleurDiffuse&&d.douleurDiffuse){
    pousser('douleur','Douleur diffuse sur '+d.douleurDiffuse.jours+' jours',
      d.douleurDiffuse.series,'séries douloureuses',FATIGUE_POIDS.douleur);
  }
  if(sg.formeBasse&&d.formeBasse){
    pousser('forme','Indice de forme sous sa base habituelle',
      d.formeBasse.ecart,'points sous '+d.formeBasse.base,FATIGUE_POIDS.forme);
  }
  try{
    const ref=(dateRef instanceof Date)?dateRef:new Date(Number(dateRef||Date.now()));
    const h=historiqueDispo(user,localISODate(ref),7);
    const bas=h.filter(x=>x.drapeau==='orange'||x.drapeau==='rouge').length;
    if(bas>=FATIGUE_DISPO_JOURS)
      pousser('recuperation','Récupération orange ou rouge '+bas+' jours sur 7',bas,'jours',FATIGUE_POIDS.recuperation);
  }catch(e){}
  return {score,motifs,exploitable:true,semaines};
}
// PURE. La semaine visée : l'index dans le bloc quand F-31 en fournit un, la
// clé ISO sinon. Les deux voyagent, la carte se sert de ce qu'elle a.
function _semaineFatigue(user,dateRef){
  const dt=(dateRef instanceof Date)?dateRef:new Date(Number(dateRef||Date.now()));
  let idx=null;
  try{ idx=indexSemaineBloc(user,dt); }catch(e){}
  return {cle:semaineISO(dt),index:(typeof idx==='number')?idx:null};
}
// La décharge DÉJÀ planifiée qui suit la semaine visée, s'il y en a une : la
// carte propose alors de l'AVANCER au lieu d'en ajouter une seconde.
function dechargePlanifieeApres(user,index){
  if(typeof index!=='number') return null;
  let pr=null;
  try{ pr=programmeDe(user); }catch(e){}
  if(!pr) return null;
  const suivantes=pr.decharges.filter(x=>x>index);
  return suivantes.length?suivantes[0]:null;
}
// Évalue et ÉCRIT la proposition dans le dossier — mais jamais sur `deload`.
// Rend la proposition ouverte, ou null. Une seule à la fois par athlète.
function evaluerPropositionDecharge(user,dateRef){
  const u=_dossier(user);
  if(!u) return null;
  if(fatigueSuspendue(u)) return null;
  const now=(dateRef instanceof Date)?dateRef.getTime():Number(dateRef||Date.now());
  const f=fatigueDe(u);
  if(f&&f.sommeilJusquA>now) return null;
  if(f&&f.propositionActive) return f.propositionActive;
  const r=scoreFatigue(u,now);
  if(!r.exploitable||r.score<FATIGUE_SEUIL) return null;
  // Règle 3, tenue par le code et pas seulement par le commentaire : une
  // proposition sans motif chiffré ne sort pas d'ici.
  if(!r.motifs.length) return null;
  if(!u.fatigue||typeof u.fatigue!=='object'||Array.isArray(u.fatigue)) u.fatigue={};
  const sem=_semaineFatigue(u,now);
  u.fatigue.score=r.score;
  u.fatigue.motifs=r.motifs;
  u.fatigue.calculeLe=now;
  u.fatigue.propositionActive={semaineProposee:sem.cle,semaineIndex:sem.index,
    creeLe:now,statut:'ouverte'};
  return u.fatigue.propositionActive;
}
// Lecture SANS calcul : c'est elle que le tri des athlètes appelle, sur des
// dizaines de dossiers. Recalculer un score à chaque rendu de liste coûterait
// cinq millisecondes par athlète pour une information déjà écrite.
function propositionDechargeOuverte(c){
  const f=fatigueDe(c);
  return (f&&f.propositionActive)?f.propositionActive:null;
}
function _fermerProposition(u){ if(u&&u.fatigue) delete u.fatigue.propositionActive; }
// Un refus met la détection en sommeil vingt-et-un jours POUR CET ATHLÈTE.
function refuserDecharge(user){
  const u=_dossier(user);
  if(!u||!propositionDechargeOuverte(u)) return false;
  if(!u.fatigue) u.fatigue={};
  u.fatigue.sommeilJusquA=Date.now()+FATIGUE_SOMMEIL_J*864e5;
  _fermerProposition(u);
  return true;
}
// Un report la décale d'une semaine, sans l'enterrer.
function reporterDecharge(user){
  const u=_dossier(user);
  if(!u||!propositionDechargeOuverte(u)) return false;
  if(!u.fatigue) u.fatigue={};
  u.fatigue.sommeilJusquA=Date.now()+FATIGUE_REPORT_J*864e5;
  _fermerProposition(u);
  return true;
}
// APPLIQUE. Le seul point du lot qui touche à la décharge, et il n'est atteint
// que par un clic du coach.
//
// Deux représentations de la décharge cohabitent : le booléen `deload` des
// créneaux, sans date, et `programme.decharges`, des index de semaines. Quand
// un bloc existe, on écrit dans le BLOC — et si une décharge était déjà prévue
// plus loin, on l'AVANCE au lieu d'en ajouter une seconde. Sans bloc, on
// retombe sur le geste existant : `deload` sur les créneaux actifs, les
// inactifs intacts.
// B3.3 — L'ALLEGEMENT PAR DEFAUT D'UNE SEMAINE DE DECHARGE. Nommes, pour
// qu'on puisse en discuter : ce sont des reglages de coaching, pas des
// constantes techniques.
const DECHARGE_FACTEUR_SERIES=0.6;   // 60 % du volume du gabarit
const DECHARGE_RIR_PLUS=1;           // une repetition de plus en reserve
// ══════ LA DÉCHARGE PAR CRÉNEAU EST DATÉE (06/10/2026, build 1823) ══════
//
// Hors bloc, la décharge était un booléen `deload` posé sur les créneaux, SANS
// DATE : il valait jusqu'à ce que le coach pense à le retirer — une semaine
// de décharge oubliée devenait un mois. Et il n'allégeait rien : la séance
// partait avec le gabarit (4 séries RIR 2), seul le bandeau changeait.
//
// DÉSORMAIS `deloadJusqua` : le dimanche 23:59 de la semaine où elle est
// posée, en ms. launchWorkout allège la COPIE de travail par les mêmes règles
// que le bloc (séries × DECHARGE_FACTEUR_SERIES, au moins 1 ; RIR + 1,
// plafonné à 5). La case du coach reste décochable à tout moment.
//
// ⚠ MIGRATION EN LECTURE. Un ancien `deload:true` sans date vaut jusqu'à la
//   fin de la semaine où il est lu pour la première fois
//   (migrerDechargesCreneaux, à la porte des dossiers), puis s'efface.
/** PURE. Le dimanche 23:59:59,999 (heure locale) de la semaine de `t`, en ms. */
function finDeSemaineMs(t){
  const l=_lundiDe(new Date(Number(t)||Date.now()));
  return new Date(l.getFullYear(),l.getMonth(),l.getDate()+6,23,59,59,999).getTime();
}
/** PURE. Ce créneau est-il en décharge à cet instant ? Un ancien `deload:true`
 *  sans date l'est encore, jusqu'à sa migration. */
function creneauEnDecharge(sc,maintenant){
  if(!sc||typeof sc!=='object') return false;
  const j=Number(sc.deloadJusqua);
  if(isFinite(j)&&j>0) return (Number(maintenant)||Date.now())<=j;
  return sc.deload===true;
}
/** Pose (jusqu'à dimanche soir) ou retire la décharge d'un créneau. ÉCRIT.
 *  `par` : 'coach' (défaut) ou 'athlete' — l'ORIGINE est gardée dans
 *  `deloadPar`, et le bandeau de séance la dit. Retirée, il ne reste rien. */
function poserDechargeCreneau(sc,pose,maintenant,par){
  if(!sc||typeof sc!=='object') return false;
  delete sc.deload;
  if(pose===false){ delete sc.deloadJusqua; delete sc.deloadPar; }
  else { sc.deloadJusqua=finDeSemaineMs(maintenant); sc.deloadPar=par==='athlete'?'athlete':'coach'; }
  return true;
}
/** ÉCRIT. La migration en lecture : date l'ancien booléen, efface l'échu.
 *  Rend le nombre de créneaux touchés. */
function migrerDechargesCreneaux(u,maintenant){
  const cfg=u&&Array.isArray(u.sessions_config)?u.sessions_config:[];
  const t=Number(maintenant)||Date.now();
  let n=0;
  for(const sc of cfg){
    if(!sc||typeof sc!=='object') continue;
    const j=Number(sc.deloadJusqua);
    if(isFinite(j)&&j>0){
      if(t>j){ delete sc.deloadJusqua; delete sc.deload; delete sc.deloadPar; n++; }
      else if('deload' in sc){ delete sc.deload; n++; }
    } else if(sc.deload===true){
      // L'ancien booléen ne s'écrivait que par le coach, ou par l'athlète via
      // le même geste : sans trace, on garde la lecture d'avant (le coach).
      sc.deloadJusqua=finDeSemaineMs(t); sc.deloadPar='coach'; delete sc.deload; n++;
    } else if('deload' in sc||'deloadJusqua' in sc){
      delete sc.deload; delete sc.deloadJusqua; delete sc.deloadPar; n++;
    }
  }
  return n;
}
/** ÉCRIT SUR LA COPIE. Les règles de la décharge du bloc, appliquées aux
 *  exercices d'une séance : séries × 0,6 arrondi (au moins 1), RIR + 1
 *  plafonné à 5. Un exercice sans consigne de RIR n'en reçoit pas. */
// Série 6 : `coach` (facultatif) donne son facteur et son RIR de décharge.
function allegerExercicesDecharge(exercises,coach){
  const fs=coach?facteurDecharge(coach):DECHARGE_FACTEUR_SERIES, rp=coach?rirDecharge(coach):DECHARGE_RIR_PLUS;
  for(const ex of (exercises||[])){
    if(!ex||typeof ex!=='object') continue;
    const n0=parseInt(ex.series,10)||0;
    if(n0) ex.series=Math.max(1,Math.round(n0*fs));
    const r0=_rirPrescrit(ex);
    if(r0!==''){
      const r=String(Math.min(5,Number(r0)+rp));
      // Le champ LU par _rirPrescrit : rirCible passe devant rir.
      if(ex.rirCible!=null&&String(ex.rirCible).trim()!=='') ex.rirCible=r;
      else ex.rir=r;
    }
  }
  return exercises;
}
// `par` : qui la demande — 'athlete' depuis « Alléger la semaine », le coach
// sinon. Seule la décharge du créneau le garde (deloadPar).
function appliquerDecharge(user,semaine,par){
  const u=_dossier(user);
  if(!u) return false;
  const idx=(typeof semaine==='number')?semaine:null;
  let pr=null;
  try{ pr=programmeDe(u); }catch(e){}
  let fait=false;
  if(pr&&idx!==null&&idx>=0&&idx<pr.semaines){
    const avancee=dechargePlanifieeApres(u,idx);
    const l=pr.decharges.filter(x=>x!==avancee);
    if(l.indexOf(idx)<0) l.push(idx);
    u.programme.decharges=l.sort((a,b)=>a-b);
    // B3.3 — ET LA SEMAINE PRESCRIT REELLEMENT MOINS.
    //
    // Cette branche se contentait d'ajouter l'index dans programme.decharges.
    // Faute d'ecart, la semaine marquee « dech. » prescrivait EXACTEMENT le
    // meme travail que les autres : _volumePrevisionnel lit les creneaux,
    // c'est-a-dire le gabarit. La decharge n'etait qu'un bandeau chez
    // l'athlete et une exclusion de la detection de plateau. Un coach qui
    // planifiait une decharge en S5 croyait avoir allege la semaine ; il ne
    // l'avait pas fait.
    //
    // MOINS DE SERIES ET PLUS DE RIR, les deux ensemble : une decharge qui ne
    // toucherait qu'au volume laisserait l'athlete pousser jusqu'a l'echec sur
    // ce qui reste, et ce n'est pas une decharge.
    //
    // 60 % DES SERIES ET +1 DE RIR : c'est l'allegement le plus courant en
    // periodisation, et il est ECRIT — donc visible dans la grille, et
    // modifiable comme n'importe quel autre ecart. Un allegement silencieux
    // dont le coach ignorerait l'existence serait pire que pas d'allegement.
    // Série 6 : le pourcentage et le RIR de décharge du coach (repli 0,6 / +1).
    const _co=(()=>{ try{ return _coachDeAthlete(u); }catch(e){ return null; } })();
    try{ poserEcartSemaine(u,idx,{facteurSeries:facteurDecharge(_co),
                                  rir:rirDecharge(_co),_decharge:true}); }catch(e){}
    fait=true;
  }else{
    const cfg=Array.isArray(u.sessions_config)?u.sessions_config:[];
    const actifs=cfg.filter(x=>x&&x.active);
    if(!actifs.length) return false;
    // DATÉE : jusqu'à dimanche soir, plus un booléen sans fin.
    actifs.forEach(x=>{ poserDechargeCreneau(x,true,undefined,par); });
    fait=true;
  }
  if(!fait) return false;
  _fermerProposition(u);
  // Les caches portent des verdicts que la décharge change : une séance de
  // décharge sort de la détection de plateau.
  try{ _viderCachePlateau(); _viderCacheVolume(); _cacheSignaux.clear(); }catch(e){}
  return true;
}
// ══════════════ LA STRUCTURE DU BLOC, COTE ATHLETE ═════════════════════
//
// Le coach lit « 8 semaines, du 1er au 26 · Decharges : S3, S6 · semaine 3 en
// cours ». L'athlete, lui, ne voyait rien : il traversait une semaine dure
// sans savoir combien il en restait ni quand ca s'allegerait. Une semaine
// dure qu'on sait etre l'avant-derniere se traverse ; la meme, sans horizon,
// se negocie.
//
// UNE SEULE SOURCE : le programme date. Il porte le nombre de semaines ET les
// decharges — le bloc de priorite, lui, n'a que des semaines, et melanger les
// deux ferait une phrase dont les deux moities ne parleraient pas de la meme
// chose.
//
// ⚠ LA DECHARGE ANNONCEE EST LA PROCHAINE, PAS LA PREMIERE. dechargePlanifiee-
// Apres existe deja pour cela : sans elle, un athlete en semaine 5 d'un bloc
// dont la decharge de S3 est passee se serait vu annoncer « decharge en
// semaine 3 » — une consigne dans le passe.
//
// PURE. Rend '' quand il n'y a rien a dire : pas de programme, ou une date
// hors bloc. Une absence de structure n'est pas une structure a annoncer.
function ligneStructureBloc(user,maintenant){
  const u=_dossier(user);
  let p=null;
  try{ p=programmeDe(u); }catch(e){ p=null; }
  if(!p) return '';
  const d=(maintenant instanceof Date)?maintenant:new Date(Number(maintenant)||Date.now());
  let i=null;
  try{ i=indexSemaineBloc(u,d); }catch(e){ i=null; }
  if(i===null) return '';
  const base='Semaine '+(i+1)+' sur '+p.semaines;
  // CETTE SEMAINE EST LA DECHARGE : on le dit, et on ne renvoie pas vers une
  // autre. C'est l'information la plus utile du jour.
  if(p.decharges.indexOf(i)>=0) return base+' · c’est ta semaine de décharge.';
  let suivante=null;
  try{ suivante=dechargePlanifieeApres(u,i); }catch(e){ suivante=null; }
  if(suivante===null) return base+'.';
  return base+' · décharge en semaine '+(suivante+1)+'.';
}
// LE PONT. Une semaine planifiée en décharge dans le bloc ne posait `deload`
// sur AUCUNE séance : le bandeau ne s'allumait pas, et les séances de cette
// semaine continuaient d'entrer dans la détection de plateau — alors qu'une
// décharge cochée à la main, elle, en sortait. Deux décharges, deux
// comportements. PURE, aucune écriture.
function semaineEstDecharge(user,date){
  try{
    const w=getSemaineEffective(user,date||new Date());
    return !!(w&&w.decharge);
  }catch(e){ return false; }
}

// ── Dépistage par profil : des QUESTIONS au coach, rien d'autre ────────────
// Toutes les règles reposent sur des données DÉJÀ déclarées : aucune question
// nouvelle à l'athlète, aucune case à cocher de plus. Si une donnée manque, la
// règle ne se déclenche pas — on ne déduit rien.
//
// Ce bloc ne nomme aucune carence, ne propose aucun complément, ne pose aucun
// diagnostic. Il produit un constat chiffré puis une question à poser. Il
// n'entre PAS dans urgencyScore et ne déclenche aucune notification : ce n'est
// pas une alerte, c'est une aide à la conversation.
const MICRO_SECHE_SEMAINES=8;      // fer : ancienneté de sèche requise
const MICRO_SOMMEIL_SEUIL=6;       // magnésium : moyenne en heures
const MICRO_SOMMEIL_JOURS=14;      // fenêtre d'observation
// Une moyenne sur deux nuits n'est pas une moyenne sur quinze jours. En dessous
// de la moitié de la fenêtre, la donnée manque et la règle se tait.
const MICRO_SOMMEIL_MIN_NUITS=7;
// Novembre à mars inclus, en indices JavaScript (0 = janvier).
const MICRO_MOIS_PEU_SOLEIL=Object.freeze([10,11,0,1,2]);
const MICRO_MOTS_VEGE=Object.freeze(['vegetarien','vegetarienne','vegetalien',
  'vegetalienne','vegan','vegane','vegetalisme','vegetarisme']);
// Les trois champs libres du bilan de départ où ce genre de précision se tape
// en pratique. On ne fouille pas tout le dossier : ailleurs, le mot voudrait
// dire autre chose.
const MICRO_CHAMPS_VEGE=Object.freeze(['deb-allergies','deb-food-hate','deb-health','deb-food-love']);
// ══════════════ COUVERTURE EN MICRONUTRIMENTS ══════════════
// On CONSTATE une couverture, on ne diagnostique rien. Le mot « carence »
// n'apparaît nulle part hors de MICRO_DISCLAIMER, et aucun score global n'est
// produit : agréger huit nutriments en une note donnerait un chiffre qui ne
// veut rien dire et que personne ne pourrait contredire.
//
// RÉFÉRENCES NUTRITIONNELLES POUR LA POPULATION (RNP), adulte.
// Source unique : Anses, « Les références nutritionnelles en vitamines et
// minéraux », https://www.anses.fr/fr/content/les-references-nutritionnelles-en-vitamines-et-mineraux
// Consulté le 30 juillet 2026. Aucune valeur n'est estimée ni interpolée : un
// nutriment absent de cette source aurait été retiré du lot.
//
// Trois valeurs demandent un choix explicite, l'Anses en donnant plusieurs
// selon le contexte (même source, reconsultée le 6 octobre 2026) :
//  · FER, femme : 16 mg correspond aux pertes menstruelles ÉLEVÉES, 11 mg aux
//    pertes faibles ou modérées et aux femmes ménopausées. BUILD 1846 : 11 mg
//    quand la ménopause est déclarée, quand il n'y a pas de cycle (aménorrhée,
//    contraception continue), ou quand l'intensité des règles est RENSEIGNÉE
//    et n'est pas « difficile » ; 16 mg sinon — « difficile » ou rien de dit :
//    la borne prudente reste le défaut. La ménopause prime sur tout le reste.
//  · ZINC : la RNP dépend de l'acide phytique du régime. On retient la ligne
//    600 mg/j de phytates (H 11,7 · F 9,3), régime mixte courant. Un régime
//    très végétal en contient davantage et sa vraie RNP serait plus haute : la
//    couverture affichée est donc OPTIMISTE pour ces athlètes.
//  · CALCIUM : 950 mg à partir de 25 ans, 1 000 mg de 18 à 24 ans (BUILD
//    1846, âge tiré de la date de naissance ; inconnu → 950).
//  · GROSSESSE ET ALLAITEMENT : les références changent et le suivi médical
//    prime. Aucune couverture, aucun signal : « Repères suspendus pendant la
//    grossesse : ton suivi médical prime. »
const MICRO_REFS=Object.freeze({
  fe: {lib:'Fer',          unite:'mg', H:11,   F:16},
  ca: {lib:'Calcium',      unite:'mg', H:950,  F:950},
  mg: {lib:'Magnésium',    unite:'mg', H:380,  F:300},
  zn: {lib:'Zinc',         unite:'mg', H:11.7, F:9.3},
  io: {lib:'Iode',         unite:'µg', H:150,  F:150},
  k_: {lib:'Potassium',    unite:'mg', H:3500, F:3500},
  b9: {lib:'Folates',      unite:'µg', H:330,  F:330},
  b12:{lib:'Vitamine B12', unite:'µg', H:4,    F:4},
  // BUILD 1860 : la vitamine D, colonne « Vitamine D (µg/100 g) » de Ciqual
  // 2025 (clé 'vd'). Repère Anses : apport satisfaisant de 15 µg/j chez l'adulte
  // (Anses 2021, références nutritionnelles en vitamines et minéraux). ⚠ Il
  // suppose une synthèse cutanée nulle : par l'assiette seule, la couverture
  // est presque toujours basse — la carte le montre, sans en tirer de carence.
  vd: {lib:'Vitamine D',   unite:'µg', H:15,   F:15}
});
// Hors repères, pour l'AFFICHAGE seulement : les oméga-3 à longue chaîne
// (EPA + DHA, g/100 g, clé 'o3'). Hors de MICRO_REFS pour ne déclencher ni
// signalMicro ni risquesMicro ; repère Anses : 500 mg/j d'EPA + DHA.
const MICRO_HORS_REFS=Object.freeze(['o3']);
const MICRO_O3_REPERE_MG=500;
const MICRO_JOURS_FENETRE=7;
const MICRO_COUVERTURE_SEUIL=0.70;
const MICRO_DOC_MINIMALE=0.60;
// Sexe inconnu : on prend la référence la PLUS ÉLEVÉE des deux, et l'affichage
// le dit. Sous-estimer la référence gonflerait la couverture et éteindrait la
// question au moment où elle serait le plus utile.
const MICRO_FER_F_BAS=11, MICRO_CA_JEUNE=1000, MICRO_CA_AGE=25;
const MICRO_GROSSESSE='Repères suspendus pendant la grossesse : ton suivi médical prime.';
function refMicro(user,cle){
  const r=MICRO_REFS[cle];
  if(!r) return null;
  const sexe=(user&&(user._evol_gender||user.gender))||'';
  // CALCIUM : moins de 25 ans → 1 000 mg, quel que soit le sexe.
  if(cle==='ca'){
    let age=null; try{ age=ageActuel(user); }catch(e){ age=null; }
    if(age!=null&&age>0&&age<MICRO_CA_AGE)
      return {valeur:MICRO_CA_JEUNE,sexeConnu:!!sexe,lib:r.lib,unite:r.unite,motifRef:'moins de 25 ans'};
  }
  if(!sexe) return {valeur:Math.max(r.H,r.F),sexeConnu:false,lib:r.lib,unite:r.unite};
  const femme=isFemale(sexe);
  if(cle==='fe'&&femme){
    let meno=false; try{ meno=menopauseDeclaree(user); }catch(e){}
    if(meno) return {valeur:MICRO_FER_F_BAS,sexeConnu:true,lib:r.lib,unite:r.unite,motifRef:'après la ménopause'};
    let sansCycle=false; try{ sansCycle=contraceptionDe(user)==='continue'; }catch(e){}
    if(sansCycle) return {valeur:MICRO_FER_F_BAS,sexeConnu:true,lib:r.lib,unite:r.unite,motifRef:'sans règles déclarées'};
    // L'intensité RENSEIGNÉE, pas le défaut de confCycle ('supportable').
    const c=(user&&user.cycle)||{}, a=((user&&user.nutrition)||{}).cycleAdaptation||{};
    const intens=c.intensiteRegles!==undefined?c.intensiteRegles:a.intensite_regles;
    if(intens&&intens!=='difficile') return {valeur:MICRO_FER_F_BAS,sexeConnu:true,lib:r.lib,unite:r.unite,motifRef:'règles modérées'};
    return {valeur:r.F,sexeConnu:true,lib:r.lib,unite:r.unite,motifRef:intens==='difficile'?'règles abondantes':null};
  }
  return {valeur:femme?r.F:r.H,sexeConnu:true,lib:r.lib,unite:r.unite};
}
// Grossesse ou allaitement déclarés : les repères sont suspendus.
function _microSuspendu(user){
  try{ return grossesseSuspend(_dossier(user)||user); }catch(e){ return false; }
}
// PURE. Rend {part, partDocumentee, nJours, ...} ou null.
//
// partDocumentee est la FIABILITÉ du calcul, pas un résultat nutritionnel :
// la part des kilocalories journalisées dont l'aliment porte une valeur pour ce
// nutriment. Un aliment sans donnée est exclu de l'apport ET du total — il
// n'est JAMAIS compté zéro, ce qui reviendrait à affirmer qu'il n'en contient
// pas. C'est la même règle que le sel du journal, pour la même raison.
function couvertureMicro(user,cle,joursISO){
  const r=MICRO_REFS[cle];
  if(!r||!user) return null;
  if(_microSuspendu(user)) return null;
  const log=((user.nutrition||{}).log)||{};
  const jours=(joursISO||[]).filter(j=>log[j]&&Array.isArray(log[j].entries)&&log[j].entries.length);
  if(jours.length<MICRO_JOURS_FENETRE) return null;
  const ref=refMicro(user,cle);
  if(!ref||!(ref.valeur>0)) return null;
  let apport=0, kcalDoc=0, kcalTotal=0;
  for(const j of jours){
    for(const e of log[j].entries){
      if(!e) continue;
      const kc=Number(e.kcal)||0;
      kcalTotal+=kc;
      const v=e[cle];
      // undefined (journée saisie avant ce lot) et null (aliment sans donnée)
      // tombent du même côté : inconnu.
      if(v==null) continue;
      apport+=Number(v)||0;
      kcalDoc+=kc;
    }
  }
  return {
    part:Math.round((apport/jours.length)/ref.valeur*1000)/1000,
    partDocumentee:kcalTotal>0?Math.round(kcalDoc/kcalTotal*1000)/1000:0,
    nJours:jours.length,ref:ref.valeur,unite:ref.unite,lib:ref.lib,
    sexeConnu:ref.sexeConnu,motifRef:ref.motifRef||null
  };
}
// Les MICRO_JOURS_FENETRE derniers jours calendaires, du plus ancien au plus
// récent. La fenêtre est FIXE : « sept jours consécutifs » ne veut pas dire
// « les sept dernières journées où l'athlète a saisi quelque chose ».
function _microDerniersJours(ref){
  const base=(ref instanceof Date)?ref:new Date();
  const out=[];
  for(let i=MICRO_JOURS_FENETRE-1;i>=0;i--)
    // EN CALENDRIER : au passage a l'heure d'hiver, reculer de 24 h depuis
    // minuit rend 23 h la veille de la veille — un jour serait saute, un autre
    // compte deux fois, et la fenetre des micro-signaux mentirait d'un jour.
    out.push(localISODate(_datePlusJours(base,-i)));
  return out;
}
// Phrase du journal. La mention de fiabilité est OBLIGATOIRE dès que la part
// documentée n'est pas totale : sans elle, « 68 % de la référence » se lirait
// comme un résultat, alors que c'est un calcul partiel.
function phraseCouvertureMicro(c){
  if(!c) return '';
  let s=c.lib+' : '+Math.round(c.part*100)+' % de la référence sur '+c.nJours+' jours';
  if(c.partDocumentee<1)
    s+=' : calculé sur '+Math.round(c.partDocumentee*100)
      +' % de ce que tu as journalisé, le reste n\'a pas de donnée';
  s+='.';
  if(!c.sexeConnu)
    s+=' Sexe non renseigné : la référence la plus élevée est retenue.';
  return s;
}
// ══ LA CARTE, REFONDUE (build 1842) ═══════════════════════════════════════
// Huit lignes compactes « libellé · mini-barre neutre · NN % », dans l'ordre
// FIXE de MICRO_REFS ; la barre plafonne à 100 % à l'œil, la valeur réelle
// reste écrite. Aucune couleur d'alerte. La fiabilité ne se dit que sous 90 %
// documentés (« calculé sur 69 % du journal »), le sexe inconnu UNE fois en
// pied de carte, et le rappel médical une seule fois par écran
// (opts.sansDisclaimer quand le signal d'apport l'affiche déjà).
// ⚠ SOUS aTCA, RIEN : même garde que _htmlSignalMicro. Le coach garde son
//   accès par risquesMicro.
const MICRO_FIABILITE_DITE=0.90;
// ══ LE POISSON GRAS DE LA SEMAINE (build 1849) ═════════════════════════════
// Aucun suivi des oméga-3 ni de la vitamine D par l'alimentation : le repère
// PNNS (deux portions de poisson par semaine, dont une de poisson gras) se
// compte sur le journal. PURE. Les 7 derniers jours jusqu'à finISO : une
// entrée dont le nom contient l'un de ces poissons vaut une portion à partir
// de 80 g, deux à partir de 200 g ; dans un plat ou un sandwich (groupe
// « entrées et plats composés »), une demi-portion.
const MICRO_POISSONS_GRAS=Object.freeze(['saumon','sardine','maquereau','hareng','truite','anchois','thon rouge']);
const MICRO_POISSON_PORTION_G=80, MICRO_POISSON_DOUBLE_G=200, MICRO_POISSON_REPERE=2;
function poissonGrasSemaine(user,finISO){
  const log=((((user&&user.nutrition)||{}).log)||{});
  const fin=String(finISO||localISODate(new Date())).slice(0,10);
  let portions=0, jours=0, saisies=0;
  for(let i=0;i<7;i++){
    const d=localISODate(_datePlusJours(_dateDeISO(fin),-i));
    const es=(log[d]&&Array.isArray(log[d].entries))?log[d].entries:[];
    if(es.length) saisies++;
    let p=0;
    for(const e of es){
      if(!e) continue;
      const n=_microNorm(e.nom);
      if(!MICRO_POISSONS_GRAS.some(m=>n.indexOf(m)>=0)) continue;
      const q=Number(e.qty)||0;
      const plat=/plats? composes|entrees/.test(_microNorm(e.groupe))||/\bsandwich|\bwrap\b|\bsalade composee|\bpizza\b|\bquiche\b/.test(n);
      if(plat) p+=0.5;
      else if(q>=MICRO_POISSON_DOUBLE_G) p+=2;
      else if(q>=MICRO_POISSON_PORTION_G) p+=1;
    }
    if(p>0){ portions+=p; jours++; }
  }
  return {portions,jours,saisies};
}
// La ligne de la carte, ou '' : masquée chez un végétarien (remplacée, sans
// complément oméga-3 actif, par les oméga-3 végétaux).
function ligneOmega3(user,finISO){
  let vege=false; try{ vege=_microVege(user); }catch(e){}
  if(vege){
    const omega=(((user&&user.nutrition)||{}).supplements||[]).some(x=>x&&x.active!==false&&/omega/i.test(_microNorm(x.name)));
    return omega?'':'Oméga-3 végétaux : noix, colza, lin';
  }
  const p=poissonGrasSemaine(user,finISO);
  if(!p.saisies) return '';
  return 'Poisson gras : '+String(p.portions).replace('.',',')+' / '+MICRO_POISSON_REPERE+' cette semaine (repère PNNS)';
}
function _htmlCouvertureMicro(user,ref,opts){
  try{ if(aTCA(_dossier(user))) return ''; }catch(e){}
  const o=opts||{};
  // Grossesse ou allaitement : une seule phrase, aucun pourcentage (build 1846).
  if(_microSuspendu(user)) return `<div class="micro-carte" style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Micronutriments · ${MICRO_JOURS_FENETRE} jours</div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.5">${escapeHtml(MICRO_GROSSESSE)}</div></div>`;
  const jours=_microDerniersJours(ref);
  const cs=[];
  for(const cle in MICRO_REFS){
    const c=couvertureMicro(user,cle,jours);
    // Un nutriment SANS AUCUNE donnée sur la fenêtre : ligne absente.
    if(c&&c.partDocumentee>0) cs.push(c);
  }
  if(!cs.length) return '';
  const sexeInconnu=cs.some(c=>!c.sexeConnu);
  const ligne=c=>{
    const pct=Math.round(c.part*100);
    const larg=Math.max(0,Math.min(100,pct));
    const fiab=c.partDocumentee<MICRO_FIABILITE_DITE
      ?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.3;margin:1px 0 0">calculé sur '+Math.round(c.partDocumentee*100)+' % du journal</div>':'';
    return '<div class="micro-l" style="padding:2px 0">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<span style="flex:0 0 92px;font-size:var(--fs-xs);color:var(--text-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+escapeHtml(c.lib)+'</span>'
      +'<span aria-hidden="true" style="flex:1;height:4px;background:var(--border);border-radius:var(--r-1);overflow:hidden"><span style="display:block;height:100%;width:'+larg+'%;background:var(--sub)"></span></span>'
      +'<span style="flex:0 0 auto;min-width:38px;text-align:right;font-size:var(--fs-xs);color:var(--text-strong);font-variant-numeric:tabular-nums">'+pct+' %</span>'
      +'</div>'+fiab+'</div>';
  };
  return `<div class="micro-carte" style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Micronutriments · ${MICRO_JOURS_FENETRE} jours</div>
    ${cs.map(ligne).join('')}
    ${(function(){ const t=(function(){ try{ return ligneOmega3(user,localISODate((ref instanceof Date)?ref:new Date())); }catch(e){ return ''; } })();
      return t?'<div class="micro-omega3" style="font-size:var(--fs-xs);color:var(--text-strong);padding:2px 0">'+escapeHtml(t)+'</div>':''; })()}
    ${(function(){ let t=''; try{ t=ligneOmega3Mesure(user,_microDerniersJours(ref)); }catch(e){ t=''; }
      return t?'<div class="micro-omega3-mg" style="font-size:var(--fs-xs);color:var(--text-strong);padding:2px 0">'+escapeHtml(t)+'</div>':''; })()}
    ${sexeInconnu?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:6px">Sexe non renseigné : la référence la plus élevée est retenue.</div>':''}
    ${o.sansDisclaimer?'':`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:6px">${escapeHtml(MICRO_DISCLAIMER)}</div>`}
  </div>`;
}

// ══════════════ CE QUE LE COACH A LE DROIT DE REECRIRE ═════════════════
//
// ⚠ LE COACH PEUT ECRIRE DANS /users/<son athlete>. Les regles de la base le
// permettent, et une trentaine d'ecritures du produit passent par pushOne :
// assigner une phase, demander une video, repondre a un bilan. Or le coach ne
// detient du tableau des traitements QUE la version masquee — id, moments, et
// rien d'autre. La poussee est un PUT, un remplacement complet : sans ce qui
// suit, la premiere phase assignee remplacait chez l'athlete le nom, la dose et
// le prescripteur de chacun de ses traitements par du vide.
//
// LA VERITE EST LE NOEUD DISTANT. On repart de lui, et on n'y superpose que ce
// que le coach a LUI-MEME saisi — `saisiPar:'coach'`. Tout le reste est
// recopie verbatim, y compris ce que le coach ne peut pas lire.
//
// PURE, et separee pour cette raison : c'est la fonction qu'on peut casser
// exprès pour verifier qu'une assertion la retient.
function _fusionnerTraitementsPoussee(distant,localCoach){
  const dist=_tabBloc(distant).filter(t=>t&&typeof t==='object');
  const loc =_tabBloc(localCoach).filter(t=>t&&typeof t==='object');
  // Ce que le coach a saisi, et lui seul. Un traitement de l'athlete present
  // dans sa copie n'y est qu'en version masquee : le reprendre l'effacerait.
  const siens={};
  for(const t of loc) if(t.saisiPar==='coach'&&t.id!=null) siens[String(t.id)]=t;
  const out=[];
  const vus={};
  for(const t of dist){
    const k=String(t.id);
    vus[k]=true;
    // ⚠ RIEN N'EST JAMAIS RETIRE ICI. Un traitement ne se supprime pas — la
    // trace est une donnee medicale, et elle explique parfois une periode
    // entiere des annees plus tard ; on l'ARRETE, en posant une date de fin.
    // Une absence dans la copie du coach est donc une desynchronisation, pas
    // une intention, et la lire comme une suppression detruirait le dossier de
    // l'athlete a la premiere ouverture d'un coach mal synchronise.
    out.push(siens[k]||t);
  }
  // Les siens qui n'existent pas encore a distance : ce sont les ajouts.
  for(const k in siens) if(!vus[k]) out.push(siens[k]);
  return out;
}
// PURE. LA REGLE DE TROIS DES MICRONUTRIMENTS, ECRITE UNE SEULE FOIS.
//
// Elle l'etait deux fois, mot pour mot : dans saveFoodEntry et dans l'entree
// d'equivalence. Deux copies d'un prorata ne divergent pas le jour ou on les
// ecrit, elles divergent le jour ou quelqu'un en corrige une.
//
// ⚠ LA CLE N'EST POSEE QUE SI L'ALIMENT PORTE LA VALEUR. Un aliment sans
// donnee reste sans cle : il n'est JAMAIS ecrit a zero, ce qui reviendrait a
// affirmer qu'il n'en contient pas. C'est toute la difference entre « on ne
// sait pas » et « il n'y en a pas », et c'est le piege central de ce lot.
//
// Trois decimales : l'iode et la B12 se comptent en microgrammes, et un
// arrondi au centieme y perdrait le dixieme de la reference journaliere.
function _poserMicros(cible,f,r){
  for(const _mc of Object.keys(MICRO_REFS).concat(MICRO_HORS_REFS)){
    const _v=f&&f[_mc];
    if(_v!=null) cible[_mc]=parseFloat((_v*r).toFixed(3));
  }
  return cible;
}
// PURE. Les oméga-3 EPA + DHA par jour, sur la fenêtre des micronutriments, en
// mg — mêmes règles que couvertureMicro : sept jours journalisés, un aliment
// sans donnée sort de l'apport ET de la part documentée, jamais compté zéro.
function omega3Semaine(user,joursISO){
  if(!user||_microSuspendu(user)) return null;
  const log=((user.nutrition||{}).log)||{};
  const jours=(joursISO||[]).filter(j=>log[j]&&Array.isArray(log[j].entries)&&log[j].entries.length);
  if(jours.length<MICRO_JOURS_FENETRE) return null;
  let g=0,kDoc=0,kTot=0;
  for(const j of jours) for(const e of log[j].entries){
    if(!e) continue;
    const kc=Number(e.kcal)||0; kTot+=kc;
    if(e.o3==null) continue;
    g+=Number(e.o3)||0; kDoc+=kc;
  }
  return {mgJour:Math.round(g*1000/jours.length),partDocumentee:kTot>0?Math.round(kDoc/kTot*1000)/1000:0};
}
function ligneOmega3Mesure(user,joursISO){
  const o=omega3Semaine(user,joursISO);
  if(!o||o.partDocumentee<MICRO_DOC_MINIMALE) return '';
  return 'Oméga-3 EPA + DHA : '+o.mgJour+' mg/j · repère '+MICRO_O3_REPERE_MG+' mg';
}
const MICRO_DISCLAIMER="RepCore n'est pas un dispositif médical. Seul un bilan sanguin peut établir une carence.";

// ══════════════ LE SIGNAL D'APPORT ═════════════════════════════════════════
//
// Ce qui precede CONSTATE, en huit lignes, chaque fois que le journal est
// ouvert. Ce qui suit SIGNALE, au plus une fois, et seulement quand quatre
// gardes sont franchies ensemble. Les deux ne se remplacent pas : l'un est un
// tableau de bord, l'autre est une phrase qu'on lit parce qu'elle est rare.
//
// ⚠ LES REPERES SONT CEUX DE MICRO_REFS, et il n'en existe pas d'autres. Une
// seconde table serait une seconde doctrine : le jour ou l'Anses revise le
// zinc, l'une des deux serait corrigee et pas l'autre.
//
// ⚠ ILS NE SONT PAS MAJORES PAR L'ENTRAINEMENT, et ce n'est pas un oubli. Il
// n'existe pas de reference nutritionnelle publiee pour le sportif sur ces
// huit nutriments — seulement des fourchettes de revue, sans consensus. Une
// majoration inventee, meme prudente, rendrait TOUT LE MONDE deficitaire et
// ferait de ce signal un bruit permanent. Que personne ne « corrige » ceci
// dans six mois sans une source qui le porte.
const MICRO_SIGNAL_JOURS_MIN=5;      // sur les 7 de la fenetre
const MICRO_SIGNAL_SEUIL=0.70;       // sous 70 % du repere journalier
const MICRO_SIGNAL_SEMAINES=2;       // et vrai deux semaines de suite
const MICRO_SIGNAL_N_ALIMENTS=3;
// Un aliment n'est dit « riche » que si 100 g en apportent au moins un
// dixieme de la reference du jour. Sans ce plancher, la liste se remplirait
// d'aliments qui contiennent le nutriment sans en apporter : proposer une
// salade verte contre un apport en fer bas, c'est perdre la confiance du
// lecteur en une ligne.
const MICRO_RICHE_PART=0.10;
// ⚠ ET UN PLAFOND, QUI VAUT AUTANT QUE LE PLANCHER. Trier la base par teneur
// au cent grammes remonte ce qui n'est pas mange au cent grammes : l'ao-nori
// sechee (205 mg de fer), la chlorelle (177), le maerl (144), le sel marin, la
// levure chimique. Mesure faite sur les 3 484 fiches Ciqual avant d'ecrire
// cette ligne. Proposer de la chlorelle contre un apport en fer bas, c'est
// pire qu'une liste d'abats : c'est la derniere fois que la phrase est lue.
//
// Deux filtres, et ils ne s'appliquent QU'A LA BASE :
//  · un aliment qui livre plus de DEUX jours de reference en 100 g n'est pas
//    mange en 100 g — c'est un condiment, une poudre ou une algue sechee ;
//  · deux groupes Ciqual sortent en entier. « Aides culinaires et ingredients
//    divers » contient les epices, les algues et les levures ; « eaux et
//    autres boissons » remontait le cafe soluble sur le potassium et la
//    feuille de the sur le fer. Les aliments infantiles n'ont rien a faire
//    dans une proposition faite a un adulte.
//
// ⚠ CE QUE L'ATHLETE A DEJA JOURNALISE ECHAPPE AUX DEUX. S'il mange de
// l'ao-nori, la lui proposer est juste : c'est la base qu'on borne, pas lui.
const MICRO_RICHE_PLAFOND=2;
const MICRO_GROUPES_EXCLUS=Object.freeze(['aides culinaires et ingrédients divers',
  'eaux et autres boissons','aliments infantiles','']);

// PURE. LA SEMAINE, SOMMEE. Les sept jours calendaires qui s'achevent a
// `finISO`, celui-ci compris.
//
// ⚠ LA COMPARAISON SE FAIT EN MOYENNE JOURNALIERE, jamais en total sur sept.
// La garde d'en dessous accepte 5 jours renseignes sur 7 ; opposer la somme de
// cinq journees a une reference multipliee par sept donnerait au mieux 71 %, et
// declarerait donc un manque a quiconque ne journalise pas le week-end. Le
// manque serait fabrique par la garde censee l'eviter.
//
// ⚠ ET UN CHAMP ABSENT N'EST PAS UN ZERO. L'aliment sort de l'apport ET du
// total : sa part d'energie est accumulee a part, dans `couverture`, qui dit
// sur quelle fraction du journal le chiffre est calcule. Compter zero
// fabriquerait un manque des qu'un produit OpenFoodFacts entre au journal —
// et OFF ne porte presque jamais l'iode ni la B12.
function microSemaine(user,finISO){
  const u=_dossier(user);
  const log=((u&&u.nutrition)||{}).log||{};
  const fin=_dateDeISO(String(finISO||localISODate(new Date())).slice(0,10));
  const jours=_microDerniersJours(fin);
  const out={joursRenseignes:0,jours:jours.slice(),couverture:{},part:{},kcal:0};
  const apport={}, kcalDoc={};
  for(const cle in MICRO_REFS){ out[cle]=0; apport[cle]=0; kcalDoc[cle]=0; }
  let kcalTotal=0;
  for(const j of jours){
    const es=(log[j]&&Array.isArray(log[j].entries))?log[j].entries:null;
    if(!es||!es.length) continue;
    out.joursRenseignes++;
    for(const e of es){
      if(!e) continue;
      const kc=Number(e.kcal)||0;
      kcalTotal+=kc;
      for(const cle in MICRO_REFS){
        const v=e[cle];
        // undefined (journee saisie avant que la cle existe) et null (aliment
        // sans donnee) tombent du meme cote : inconnu.
        if(v==null) continue;
        apport[cle]+=Number(v)||0;
        kcalDoc[cle]+=kc;
      }
    }
  }
  out.kcal=Math.round(kcalTotal);
  for(const cle in MICRO_REFS){
    out[cle]=Math.round(apport[cle]*1000)/1000;
    out.couverture[cle]=kcalTotal>0?Math.round(kcalDoc[cle]/kcalTotal*1000)/1000:0;
    const r=refMicro(u,cle);
    out.part[cle]=(out.joursRenseignes>0&&r&&r.valeur>0)
      ? Math.round((apport[cle]/out.joursRenseignes)/r.valeur*1000)/1000
      : null;
  }
  return out;
}

// PURE. LES NUTRIMENTS EN DEFAUT SUR UNE SEMAINE — trois des quatre gardes.
// La quatrieme, la persistance, ne peut pas se juger sur une seule semaine :
// elle est appliquee par signalMicro.
function _microDefauts(user,finISO){
  const s=microSemaine(user,finISO);
  const out=[];
  if(s.joursRenseignes<MICRO_SIGNAL_JOURS_MIN) return out;
  for(const cle in MICRO_REFS){
    if(!(s.couverture[cle]>MICRO_SIGNAL_SEUIL)) continue;
    const p=s.part[cle];
    if(p==null||!(p<MICRO_SIGNAL_SEUIL)) continue;
    out.push({cle:cle,part:p,couverture:s.couverture[cle],
      joursRenseignes:s.joursRenseignes});
  }
  return out;
}

// PURE. LE SIGNAL, OU RIEN. Quatre gardes ensemble, deux semaines de suite,
// et UN SEUL nutriment nomme — le plus bas de la semaine courante.
//
// ⚠ UNE PHRASE QUI EN LISTE TROIS N'EST PLUS UNE CONSIGNE. Elle devient un
// bulletin, on la lit une fois, et on ne la lit plus.
function signalMicro(user,finISO){
  const u=_dossier(user);
  if(!u) return null;
  if(_microSuspendu(u)) return null;
  const fin=String(finISO||localISODate(new Date())).slice(0,10);
  const cette=_microDefauts(u,fin);
  if(!cette.length) return null;
  // LA SEMAINE PRECEDENTE, decalee de la largeur exacte de la fenetre.
  const avant=_microDefauts(u,localISODate(
    _datePlusJours(_dateDeISO(fin),-MICRO_JOURS_FENETRE)));
  const persistants=cette.filter(x=>avant.some(y=>y.cle===x.cle));
  if(!persistants.length) return null;
  // LE PLUS BAS, et lui seul.
  persistants.sort((a,b)=>a.part-b.part);
  const g=persistants[0];
  const r=refMicro(u,g.cle);
  return {cle:g.cle,lib:r.lib,unite:r.unite,ref:r.valeur,sexeConnu:r.sexeConnu,motifRef:r.motifRef||null,
    part:g.part,pct:Math.round(g.part*100),couverture:g.couverture,
    joursRenseignes:g.joursRenseignes,semaines:MICRO_SIGNAL_SEMAINES,
    autres:persistants.length-1};
}

// PURE. TROIS ALIMENTS RICHES, PRIS D'ABORD DANS LES SIENS.
//
// ⚠ UN CONSEIL BATI SUR SES PROPRES ALIMENTS EST SUIVI ; une liste d'abats ne
// l'est pas. On balaie donc le journal ET le dictionnaire des aliments
// frequents avant d'ouvrir la base, et chaque proposition dit d'ou elle vient.
function alimentsRichesEn(user,cle,n,finISO){
  const r=MICRO_REFS[cle];
  if(!r) return [];
  const combien=Math.max(1,Math.round(Number(n)||MICRO_SIGNAL_N_ALIMENTS));
  const ref=refMicro(_dossier(user),cle);
  const plancher=(ref&&ref.valeur>0)?ref.valeur*MICRO_RICHE_PART:0;
  let base=[];
  try{ base=Array.isArray(_ciqualDB)?_ciqualDB:[]; }catch(e){ base=[]; }
  if(!base.length) return [];
  // ── CE QU'IL A DEJA ENREGISTRE ────────────────────────────────────────
  const siens={};
  const u=_dossier(user);
  const log=((u&&u.nutrition)||{}).log||{};
  for(const j in log){
    const es=log[j]&&log[j].entries;
    if(!Array.isArray(es)) continue;
    for(const e of es) if(e&&e.alim_id!=null) siens[String(e.alim_id)]=true;
  }
  try{ for(const k in (((u&&u.nutrition)||{}).usageFoods||{})) siens[k]=true; }catch(e){}
  const trier=(a,b)=>(Number(b[cle])||0)-(Number(a[cle])||0);
  const riche=f=>f&&f[cle]!=null&&Number(f[cle])>=plancher;
  // Le plafond et l'exclusion de groupe ne bornent QUE la base.
  const mangeable=f=>riche(f)
    && Number(f[cle])<=(ref&&ref.valeur>0?ref.valeur*MICRO_RICHE_PLAFOND:Infinity)
    && MICRO_GROUPES_EXCLUS.indexOf(String(f.g||''))<0;
  const dedans=base.filter(f=>riche(f)&&siens[String(f.id)]).sort(trier)
    .slice(0,combien).map(f=>({id:f.id,nom:f.n,valeur:Number(f[cle]),
      unite:r.unite,sien:true}));
  if(dedans.length>=combien) return dedans;
  // ── ET SEULEMENT ENSUITE, LA BASE ─────────────────────────────────────
  // Le complement est trie par teneur, mais on ecarte ce qui est deja retenu.
  // BUILD 1843 : SUR LA BASE SEULEMENT (ce qu'il mange déjà reste proposable),
  // trois filtres : ce qu'il a déclaré ne pas manger (evictionDe), la viande
  // et le poisson chez un végétarien, et le cru quand le cuit existe (tout
  // abat cru, à défaut). La B12 d'un végétarien ne liste rien du tout.
  const vege=(function(){ try{ return _microVege(u); }catch(e){ return false; } })();
  if(vege&&cle==='b12') return [];
  const exclu=_microExclusBase(u,base,vege);
  const pris={}; for(const x of dedans) pris[String(x.id)]=true;
  const reste=base.filter(f=>mangeable(f)&&!pris[String(f.id)]&&!exclu(f)).sort(trier)
    .slice(0,combien-dedans.length).map(f=>({id:f.id,nom:f.n,
      valeur:Number(f[cle]),unite:r.unite,sien:false}));
  return dedans.concat(reste);
}

// Les mots qui signent un aliment d'origine animale (chair, abats, poisson),
// pour un athlète végétarien. Le groupe Ciqual « viandes, oeufs, poissons »
// est écarté en entier ; ces mots attrapent le reste (plats, charcuterie…).
const MICRO_MOTS_ANIMAUX=Object.freeze(['viande','abats','abat','foie','rognon','coeur','cervelle','langue',
  'tripes','poisson','fruits de mer','crustace','mollusque','boeuf','veau','porc','agneau','mouton','poulet',
  'dinde','canard','oie','lapin','gibier','jambon','saucisse','saucisson','lardon','bacon','thon','saumon',
  'sardine','maquereau','hareng','anchois','cabillaud','crevette','moule','huitre','calmar','poulpe','escargot',
  'gelatine','boudin','pate de foie','rillettes','chorizo','merguez','steak','escalope']);
const MICRO_MOTS_ABATS=Object.freeze(['foie','rognon','coeur','cervelle','langue','tripes','abats','ris de','gesier']);
// PURE. Le filtre des aliments de la BASE à ne pas proposer.
function _microExclusBase(u,base,vege){
  const nrm=s=>_microNorm(s).replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
  const cru=/\bcrue?s?\b/, cuit=/\b(cuite?s?|bouilli|bouillie|grille|grillee|roti|rotie|braise|braisee|poele|poelee|saute|sautee|vapeur)\b/;
  const cle=n=>nrm(n).replace(cru,' ').replace(cuit,' ').replace(/\s+/g,' ').trim();
  const cuits={};
  for(const f of base){ const n=nrm(f&&f.n); if(cuit.test(n)) cuits[cle(f.n)]=true; }
  const mot=(n,l)=>l.some(m=>(' '+n+' ').indexOf(' '+m+' ')>=0||n.indexOf(m+' ')===0||n.indexOf(' '+m)>=0);
  return f=>{
    if(!f) return true;
    try{ if(evictionDe(u,f)) return true; }catch(e){}
    const n=nrm(f.n);
    if(vege){
      if(_microNorm(f.g||'').indexOf('viandes')===0) return true;
      if(mot(n,MICRO_MOTS_ANIMAUX)) return true;
    }
    if(cru.test(n)){
      if(cuits[cle(f.n)]) return true;
      if(mot(n,MICRO_MOTS_ABATS)) return true;
    }
    return false;
  };
}
// LA B12 DU VÉGÉTARIEN : pas de liste, une phrase. Registre « apports ».
const MICRO_B12_VEGE='Chez les végétaliens, la B12 ne vient pas des végétaux : c’est un sujet à voir avec ton coach ou un professionnel de santé.';

// « Vitamine B12 » → « vitamine B12 » : la seule initiale passe en minuscule
// (build 1845) ; « vitamine b12 » se lisait comme une coquille.
function _microLibMin(lib){
  const s=String(lib||'');
  return s.charAt(0).toLowerCase()+s.slice(1);
}
// ══ LES RISQUES, REGROUPÉS PAR NUTRIMENT (build 1845) ═════════════════════
// PURE. Les règles de déclenchement ne changent pas ; la LECTURE, si. Le fer
// apparaissait dans trois blocs, la question « Un bilan sanguin récent
// existe-t-il ? » finissait six blocs sur neuf. Désormais :
//   · « Fer » = fer + couverture_fe + la partie fer du régime végétarien ;
//   · « Vitamine B12 » = couverture_b12 + la partie B12 du régime ;
//   · la question du bilan sanguin sort de chaque bloc et apparaît UNE fois,
//     en pied, suivie des nutriments concernés (« ferritine, B12, zinc ») ;
//   · les blocs à plusieurs motifs d'abord, puis le reste, dans l'ordre.
// Rend {blocs:[{cle, lib, motifs:[...], question}], bilan:{question, nutriments}}.
const MICRO_Q_BILAN='Un bilan sanguin récent existe-t-il ?';
const MICRO_DOSAGE=Object.freeze({fe:'ferritine',fer:'ferritine',b12:'B12',zn:'zinc',ca:'calcium',mg:'magnésium',
  io:'iode',k_:'potassium',b9:'folates'});
function regrouperRisquesMicro(liste){
  const l=(liste||[]).slice();
  const prends=c=>{ const i=l.findIndex(x=>x&&x.cle===c); return i<0?null:l.splice(i,1)[0]; };
  const fer=[prends('fer'),prends('couverture_fe')].filter(Boolean);
  const b12=[prends('couverture_b12')].filter(Boolean);
  const vege=l.find(x=>x&&x.cle==='b12_fer_vegetal');
  const blocs=[], dosages=[];
  const dose=d=>{ if(d&&dosages.indexOf(d)<0) dosages.push(d); };
  const bilanQ=q=>/bilan sanguin/i.test(String(q||''));
  const grouper=(cle,lib,items,partVege,dos)=>{
    const motifs=items.map(x=>x.motif);
    if(vege&&partVege) motifs.push(partVege);
    let question=null;
    for(const x of items) if(!bilanQ(x.question)){ question=x.question; break; }
    if(items.some(x=>bilanQ(x.question))||(vege&&partVege)) dose(dos);
    blocs.push({cle,lib,motifs,question});
  };
  const vegeDecoupe=vege&&(fer.length||b12.length);
  if(fer.length||vegeDecoupe) grouper('groupe_fer','Fer',fer,vegeDecoupe?'Régime végétarien ou végétalien déclaré (fer non héminique).':null,'ferritine');
  if(b12.length||vegeDecoupe) grouper('groupe_b12','Vitamine B12',b12,vegeDecoupe?'Régime végétarien ou végétalien déclaré (la B12 vient des produits animaux).':null,'B12');
  if(vegeDecoupe) l.splice(l.indexOf(vege),1);
  for(const x of l){
    if(!x) continue;
    let question=x.question;
    if(bilanQ(question)){
      question=null;
      const m=/^couverture_(.+)$/.exec(x.cle);
      dose(m?(MICRO_DOSAGE[m[1]]||_microLibMin((MICRO_REFS[m[1]]||{}).lib||m[1])):(x.cle==='b12_fer_vegetal'?'B12':null));
      if(x.cle==='b12_fer_vegetal') dose('ferritine');
    }
    blocs.push({cle:x.cle,lib:x.lib,motifs:[x.motif],question});
  }
  // Les blocs à plusieurs motifs d'abord (tri stable).
  const tri=blocs.map((b,i)=>({b,i})).sort((a,c)=>((c.b.motifs.length>1)-(a.b.motifs.length>1))||(a.i-c.i)).map(x=>x.b);
  return {blocs:tri,bilan:dosages.length?{question:MICRO_Q_BILAN,nutriments:dosages}:null};
}

// ⚠ LE MOT « CARENCE » N'EST PAS ECRIT ICI, ET IL NE DOIT PAS L'ETRE. L'app
// parle d'APPORTS ALIMENTAIRES — ce qui est entre dans le journal — et non
// d'un etat biologique, qu'elle n'a ni les moyens ni la qualite d'etablir. Le
// seul endroit du fichier ou le mot apparait est MICRO_DISCLAIMER, qui dit
// justement que seul un bilan sanguin peut en etablir une.
function phraseSignalMicro(s){
  if(!s) return '';
  let t='Tes apports en '+_microLibMin(s.lib)+' sont à '+s.pct
    +' % du repère depuis deux semaines.';
  if(!s.sexeConnu) t+=' Sexe non renseigné : le repère le plus élevé est retenu.';
  return t;
}
// PURE. La ligne du coach. Meme rarete, meme unicite du nutriment ; ce qui
// change est qu'elle porte la fiabilite du calcul, parce que c'est un
// professionnel qui la lit et qu'il doit savoir sur quoi elle se fonde.
function phraseSignalMicroCoach(s){
  if(!s) return '';
  return 'Ses apports en '+_microLibMin(s.lib)+' ressortent à '+s.pct
    +' % du repère'+(s.motifRef?' ('+s.motifRef+')':'')+' sur deux semaines consécutives, calculés sur '
    +Math.round(s.couverture*100)+' % de ce qui a été journalisé ('
    +s.joursRenseignes+' jours sur '+MICRO_JOURS_FENETRE+' la dernière semaine).'
    +(s.autres>0?' '+s.autres+' autre'+(s.autres>1?'s':'')
      +' nutriment'+(s.autres>1?'s sont':' est')+' dans le même cas.':'');
}


function _microNorm(s){
  return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
}
// Sommeil : moyenne des nuits renseignées dans la fenêtre. Rend null quand il
// n'y en a pas assez pour que le mot « moyenne » veuille dire quelque chose.
function _microSommeil(user,ref){
  const maintenant=(ref instanceof Date)?ref.getTime():Date.now();
  const limite=localISODate(_datePlusJours(maintenant,-MICRO_SOMMEIL_JOURS));
  const nuits=((user&&user.sleepLog)||[])
    .filter(e=>e&&e.date&&String(e.date)>=limite&&Number(e.duration)>0)
    .map(e=>Number(e.duration));
  if(nuits.length<MICRO_SOMMEIL_MIN_NUITS) return null;
  return {moyenne:Math.round(nuits.reduce((a,b)=>a+b,0)/nuits.length*10)/10,
    nuits:nuits.length};
}
// Cycle DÉCLARÉ actif : la case activée et une date de dernières règles. C'est
// la même condition que _manageCycleSupplements — on ne devine pas un cycle.
function _microCycleActif(user){
  const c=confCycle(user);
  return !!(c.enabled&&c.lastPeriodDate);
}
// Vrai si la reponse vaut oui, quelle que soit la forme sous laquelle la case
// a ete enregistree au fil des versions du questionnaire.
function _microCoche(v){
  const t=_microNorm(_texteReponse(v));
  return t==='oui'||t==='true'||t==='1'||t==='on'||t==='vege'||t==='vegetarien'
    ||t==='vegetalien';
}
function _microVege(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.type==='depart');
  // La case cochee PRIME : elle est explicite. La recherche de mot-cle n'est
  // qu'un rattrapage pour les dossiers anterieurs a ce champ.
  for(const b of bl) if(_microCoche(b['deb-vege'])) return true;
  for(const b of bl){
    for(const champ of MICRO_CHAMPS_VEGE){
      const t=_microNorm(b[champ]);
      if(t&&MICRO_MOTS_VEGE.some(m=>t.indexOf(m)>=0)) return true;
    }
  }
  return false;
}

// PURE : ne lit aucun état global hors constantes, n'écrit rien. `ref` sert aux
// tests à fixer la date — sans elle, la règle saisonnière serait inéprouvable
// huit mois par an.
function risquesMicro(user,ref){
  const out=[];
  if(!user||typeof user!=='object') return out;
  const date=(ref instanceof Date)?ref:new Date();
  const phase=phaseCourante(user);
  const enSeche=!!(phase&&phase.type==='seche');
  const semaines=enSeche
    ? Math.floor((date.getTime()-phase.debut)/(7*24*3600*1000))
    : null;

  // ── Fer : sèche longue chez une athlète dont le cycle est suivi ──────────
  const sexe=(user._evol_gender||user.gender)||'';
  if(isFemale(sexe)&&_microCycleActif(user)&&semaines!=null&&semaines>=MICRO_SECHE_SEMAINES){
    out.push({cle:'fer',lib:'Sèche longue et cycle actif',
      motif:'Sèche depuis '+semaines+' semaines, cycle menstruel suivi dans l\'app.',
      question:'As-tu un bilan sanguin récent (ferritine) ?'});
  }

  // ── Stagnation inexpliquée : la question thyroïdienne, au coach ──────────
  // Côté COACH, la question est nommée : c'est un professionnel qui parle à
  // un médecin. Côté athlète, aucune pathologie n'est citée.
  try{
    const st=_ajustStagnationBloque(user);
    if(st){
      const a=st.adh||{};
      const pctAdh=(a.cibleMoyenne>0)
        ?Math.round(100-Math.abs(a.ecartKcal)/a.cibleMoyenne*100):null;
      out.push({cle:'stagnation',lib:'Stagnation inexpliquée',
        motif:'Sèche de '+st.semaines+' semaines, adhérence de '
          +(pctAdh!=null?pctAdh+' %':'-')+' sur '+(a.nJours||0)
          +' jours journalisés, perte mesurée quasi nulle.',
        question:'Un bilan thyroïdien récent existe-t-il ?'});
    }
  }catch(e){}

  // ── SOPK déclaré : on renvoie vers le suivi, on n'affirme rien ───────────
  // Aucun contenu sur le traitement, aucun complément suggéré : une question,
  // au même format que les autres.
  try{
    if(aSOPK(user)){
      out.push({cle:'sopk',lib:'SOPK déclaré',
        motif:'Un SOPK est déclaré dans son dossier.',
        question:'Le suivi médical est-il en place ? Y a-t-il un traitement en cours ?'});
    }
  }catch(e){}

  // ── Saison : de novembre à mars, pour tout le monde ──────────────────────
  // Meme motif que hasUserOmega : un complement ACTIF portant le nom du
  // nutriment eteint la regle. La question a deja recu sa reponse, et la
  // reposer chaque hiver use la seule chose qui compte ici, l'attention.
  const _aVitD=(((user.nutrition||{}).supplements)||[]).some(x=>x&&x.active!==false
    &&/vitamine\s*d\b|\bd3\b/i.test(String(x.name||'')));
  if(!_aVitD&&MICRO_MOIS_PEU_SOLEIL.indexOf(date.getMonth())>=0){
    const mois=date.toLocaleDateString('fr-FR',{month:'long'});
    // Build 1849 : le poisson gras du journal, quand il est renseigné.
    let _pg=''; try{ const p=poissonGrasSemaine(user,localISODate(date)); if(p.saisies) _pg=' Poisson gras : '+String(p.portions).replace('.',',')+' portion'+(p.portions>1?'s':'')+' sur 7 jours.'; }catch(e){}
    out.push({cle:'vitamineD',lib:'Saison peu ensoleillée',
      motif:'Nous sommes en '+mois+' : de novembre à mars, l\'ensoleillement est faible sous nos latitudes.'+_pg,
      question:'Le dosage de la vitamine D a-t-il été abordé avec un professionnel de santé ?'});
  }

  // ── Couverture journalisée sous le seuil ─────────────────────────────────
  // Deux conditions, et la seconde compte autant que la premiere : une
  // couverture basse calculee sur un tiers du journal ne dit rien du tout.
  // En dessous de MICRO_DOC_MINIMALE, la regle SE TAIT — l'affichage du
  // journal, lui, continue de montrer la faible fiabilite.
  {
    const _jours=_microDerniersJours(date);
    // ⚠ LE SIGNAL PERSISTANT PASSE DEVANT, ET IL RETIRE SON NUTRIMENT DE LA
    // BOUCLE. Deux lignes sur le meme fer — l'une disant « la derniere semaine
    // journalisee », l'autre « deux semaines consecutives » — feraient lire la
    // moins informative des deux, et laisseraient croire a deux constats
    // independants la ou il n'y en a qu'un.
    //
    // Il ne remplace pas la boucle : un nutriment tombe UNE seule semaine reste
    // dit, sans la persistance, exactement comme avant ce lot.
    let _sig=null;
    try{ _sig=signalMicro(user,localISODate(date)); }catch(e){ _sig=null; }
    if(_sig) out.push({cle:'couverture_'+_sig.cle,
      lib:'Couverture '+_microLibMin(_sig.lib)+' : deux semaines',
      motif:phraseSignalMicroCoach(_sig),
      question:'Un bilan sanguin récent existe-t-il ?'});
    for(const _cle in MICRO_REFS){
      if(_sig&&_sig.cle===_cle) continue;
      const _c=couvertureMicro(user,_cle,_jours);
      if(!_c) continue;
      if(!(_c.part<MICRO_COUVERTURE_SEUIL)) continue;
      if(!(_c.partDocumentee>=MICRO_DOC_MINIMALE)) continue;
      out.push({cle:'couverture_'+_cle,lib:'Couverture '+_microLibMin(_c.lib),
        motif:'Ses apports en '+_microLibMin(_c.lib)+' ressortent à '
          +Math.round(_c.part*100)+' % de la référence'+(_c.motifRef?' ('+_c.motifRef+')':'')+' sur la dernière semaine'
          +' journalisée, sur '+Math.round(_c.partDocumentee*100)
          +' % de ce qui a été journalisé.',
        question:'Un bilan sanguin récent existe-t-il ?'});
    }
  }

  // ── Hydratation basse déclarée ──────────────────────────────────────────
  // Une question, pas un verdict : « moins d'un litre » est une DÉCLARATION,
  // faite une fois au bilan de départ, et elle ne dit rien de ce que l'athlète
  // boit aujourd'hui. Elle ne se déclenche que quand le contexte la rend
  // pertinente — une sèche, ou un volume d'entraînement soutenu.
  {
    const eau=_texteReponse(_dernierChamp(user,'deb-water'));
    const basse=eau&&/moins de 1\s*l/i.test(_microNorm(eau));
    const creneaux=((user.sessions_config)||[]).filter(x=>x&&x.active).length;
    if(basse&&(enSeche||creneaux>=4)){
      out.push({cle:'hydratation',lib:'Hydratation basse déclarée',
        // Accordé au sexe (build 1845), « Déclare » quand il est inconnu.
        motif:(function(){ const sx=(user._evol_gender||user.gender)||''; if(!sx) return 'Déclare';
          try{ return isFemale(sx)?'Elle déclare':'Il déclare'; }catch(e){ return 'Déclare'; } })()+' boire moins d\'un litre par jour.',
        question:'Est-ce que l\'hydratation a été abordée ?'});
    }
  }

  // ── Alimentation végétarienne ou végétalienne déclarée ───────────────────
  if(_microVege(user)){
    out.push({cle:'b12_fer_vegetal',lib:'Régime végétarien ou végétalien',
      motif:'Un régime végétarien ou végétalien est mentionné au bilan de départ.',
      question:'Un bilan sanguin (B12, ferritine) a-t-il été fait depuis ce changement d\'alimentation ?'});
  }

  // ── Sommeil court pendant une sèche ──────────────────────────────────────
  if(enSeche){
    const s=_microSommeil(user,date);
    if(s&&s.moyenne<MICRO_SOMMEIL_SEUIL){
      out.push({cle:'magnesium',lib:'Sommeil court en sèche',
        motif:'Moyenne de '+String(s.moyenne).replace('.',',')+' h sur '+s.nuits
          +' nuits renseignées, pendant une sèche.',
        question:'Est-ce que le sommeil fait partie de ce que vous suivez ensemble en ce moment ?'});
    }
  }

  // ── Traitement déclaré ──────────────────────────────────────────────────
  // La CASE seule. Le motif ne reprend RIEN du texte libre : le coach le lit
  // dans les réponses au bilan, pas dans une entrée générée.
  if(traitementDeclare(user)){
    const fam=famillesTraitement(user)
      .map(c=>(FAMILLES_TRAITEMENT.find(f=>f.cle===c)||{}).lib).filter(Boolean);
    out.push({cle:'traitement',lib:'Traitement déclaré',
      motif:'Un traitement régulier est déclaré.'
        +(fam.length?' Familles indiquées : '+fam.join(', ')+'.':''),
      question:'A-t-il été pris en compte dans les objectifs ?'});
  }

  // ── Récupération : le palier du lot A3-04, porté au coach ───────────────
  // SANS CONDITION DE GENRE. Le score de A3-04 compte des critères dont
  // certains sont féminins par nature — l'absence de règles — mais il ne
  // s'adresse pas qu'aux femmes : la restriction longue, le sommeil court et
  // le volume au plafond comptent pour tout le monde. Chez un homme, le motif
  // se compose simplement des critères qui, eux, sont remplis.
  //
  // Les libellés viennent de risqueDeficitEnergetique TELS QUELS : les
  // reformuler ici ferait deux vocabulaires pour un seul score.
  try{
    const pal=paliersDeficit(user);
    if(pal==='vigilance'||pal==='blocage'){
      const r=risqueDeficitEnergetique(user);
      const lst=(r.criteres||[]).map(c=>c.lib+(c.valeur?' ('+c.valeur+')':''));
      // Dédoublonnage par clé : rien ne pousse 'recuperation' aujourd'hui,
      // la garde est là pour le jour où le palier arriverait par deux
      // chemins. Une question posée deux fois se lit comme une insistance.
      if(lst.length&&!out.some(x=>x.cle==='recuperation')){
        out.push({cle:'recuperation',lib:'Récupération à vérifier',
          motif:lst.join(', ')+'.',
          question:'La récupération est-elle suffisante ? Un avis médical a-t-il été envisagé ?'});
      }
    }
  }catch(e){}
  return out;
}

// ══════════════ PROPORTIONS SEGMENTAIRES ══════════════
// Deux longueurs, deux ratios, et des QUESTIONS au coach. Rien de plus : aucun
// exercice n'est retiré, remplacé ni masqué, et l'athlète ne voit jamais rien
// de tout ceci. Même registre que risquesMicro — un constat chiffré, puis une
// question à poser en séance.
//
// Les valeurs de référence sont des REPÈRES DE POPULATION, pas des seuils et
// encore moins une norme : la longueur de jambe rapportée à la taille tourne
// autour de 0,46 chez l'adulte, avec une dispersion large. Être en dehors
// n'est ni un défaut ni un diagnostic — c'est une raison de proposer une
// variante d'un mouvement, jamais de l'interdire.
const RATIO_JAMBES_REF=0.46;
const RATIO_MARGE=0.03;
/**
 * LA LONGUEUR DE BRAS (deb-bras), ACROMION → STYLOÏDE, en fraction de la
 * taille, PAR SEXE, AVEC SA DISPERSION.
 *
 * Source : ANSUR II (Gordon et al., 2014, NATICK/TR-15/007), fichiers publics —
 * calcul RepCore du 06/10/2026, n = 4 082 hommes / 1 986 femmes. Le rapport
 * (acromion-radiale + radiale-stylion) / stature est calculé PERSONNE PAR
 * PERSONNE, puis moyenné ; `et` est son écart-type. Même méthode
 * qu'ANAT_LARGEURS.
 *
 * ⚠ POURQUOI CE N'EST PLUS 0,45. L'ancien repère unique (0,45 ± 0,03)
 *   supposait une mesure jusqu'au BOUT DES DOIGTS, alors que la mesure est
 *   définie partout de l'acromion à la styloïde (MORPHO_MESURES, questions,
 *   biais photo). Acromion → poignet vaut 0,34 de la taille : tout athlète bien
 *   mesuré sortait « bras courts », et le profil P4 ne pouvait jamais sortir.
 * ⚠ LA MARGE vaut 1,5 écart-type (RATIO_BRAS_ET_MARGE), et jamais moins que
 *   l'erreur du ruban rapportée à la taille.
 * ⚠ POPULATION MILITAIRE : un repère d'adultes actifs, pas une norme. Sur les
 *   6 068 personnes, aucune ne dépasse 0,382 : au-delà de RATIO_BRAS_DOIGTS
 *   (0,40), la mesure est allée jusqu'au bout des doigts, et l'app le demande
 *   au lieu d'en tirer une position.
 */
const RATIO_BRAS=Object.freeze({
  H:Object.freeze({ref:0.3434,et:0.0101}),
  F:Object.freeze({ref:0.3392,et:0.0108}),
  SOURCE:'ANSUR II (Gordon et al., 2014), calcul RepCore du 06/10/2026, n = 4 082 H / 1 986 F'
});
const RATIO_BRAS_ET_MARGE=1.5;
const RATIO_BRAS_DOIGTS=0.40;
const BRAS_DOIGTS_QUESTION='Mesuré jusqu’au bout des doigts ? La mesure s’arrête à l’os du poignet.';
// Comparaison au centième : un entrejambe relevé au centimètre près sur une
// personne de 180 cm ne porte pas plus de précision que ça, et c'est déjà
// l'arrondi qu'affiche le motif (« 49 % »). La marge est ATTEINTE, pas
// dépassée : sinon 0,489 tomberait dedans, alors que le cahier des charges le
// donne dehors.
function _horsMarge(ratio,ref){
  if(ratio==null||!isFinite(ratio)) return false;
  return Math.abs(Math.round(ratio*100)/100-ref)>=RATIO_MARGE-1e-9;
}
// Bornes d'aberration. Une mesure hors de ces bornes n'est pas calculée : elle
// est signalée à revérifier. Mieux vaut une case vide qu'un ratio faux.
const LONGUEUR_MIN_CM=30;
const MORPHO_DISCLAIMER="RepCore n'est pas un dispositif médical. Ces proportions ne disent pas ce qu'il faut faire : elles ouvrent une conversation.";
// Au-delà, la question du rapport quadriceps / ischios se pose. Ce n'est pas
// un seuil de risque : c'est le rapport à partir duquel l'écart cesse d'être
// une préférence d'exercices et mérite d'être vu.
const DOMINANCE_QI_SIGNAL=2.0;

// Taille en centimètres, lue comme partout ailleurs dans l'app.
function _tailleCm(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const b=bl[bl.length-1]||{};
  const t=parseFloat((user&&(user._evol_height||user['init-height']))
    ||b['deb-height']||(user&&user.height)||0);
  return (isFinite(t)&&t>0)?t:null;
}
// PURE. Rend {cm} si la mesure tient debout, {motif:'absente'|'aberrante'}
// sinon. Jamais 0, jamais une valeur devinée.
function longueurSegment(user,champ){
  const t=_tailleCm(user);
  const brut=_dernierChamp(user,champ);
  if(brut==null||String(brut).trim()==='') return {cm:null,motif:'absente'};
  const v=parseFloat(String(brut).replace(',','.'));
  if(!isFinite(v)||v<=0) return {cm:null,motif:'aberrante'};
  if(v<LONGUEUR_MIN_CM) return {cm:null,motif:'aberrante'};
  // Un segment plus long que la personne entière : la mesure est fausse, ou
  // saisie en millimètres. On ne calcule pas, on le dit.
  if(t!=null&&v>t) return {cm:null,motif:'aberrante'};
  if(t==null) return {cm:null,motif:'taille-absente'};
  return {cm:v,motif:null};
}
function ratioJambes(user){
  const l=longueurSegment(user,'deb-entrejambe');
  const t=_tailleCm(user);
  return (l.cm!=null&&t)?l.cm/t:null;
}
// Le rapport BRUT (deb-bras / taille), sans jugement : positionBras le lit.
function ratioBras(user){
  const l=longueurSegment(user,'deb-bras');
  const t=_tailleCm(user);
  return (l.cm!=null&&t)?l.cm/t:null;
}
// PURE. 'H', 'F', ou null quand rien ne le dit (jamais deviné).
function sexeMorpho(user){
  const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const s=String((user&&(user._evol_gender||user.gender))||(bl.length?bl[bl.length-1]['deb-gender']:'')||'').trim();
  if(!s) return null;
  return isFemale(s)?'F':'H';
}
// PURE. Le repère du bras pour CET athlète, ou null sans sexe.
function repereBras(user){
  const s=sexeMorpho(user);
  if(!s) return null;
  const r=RATIO_BRAS[s], t=_tailleCm(user);
  const ruban=t?MORPHO_ERREUR_CM/t:0;
  return {sexe:s,ref:r.ref,et:r.et,marge:Math.max(RATIO_BRAS_ET_MARGE*r.et,ruban)};
}
/**
 * PURE. Où se situe le bras : {ratio, position:'bas'|'neutre'|'haut'|null,
 * motif:null|'absente'|'doigts'|'sexe', ref, marge}. 'doigts' : rapport au-delà
 * de RATIO_BRAS_DOIGTS, la mesure n'est pas la bonne ; 'sexe' : sans lui, pas
 * de repère, donc pas de position.
 */
function positionBras(user){
  const rb=ratioBras(user);
  if(rb==null) return {ratio:null,position:null,motif:'absente',ref:null,marge:null};
  if(rb>RATIO_BRAS_DOIGTS) return {ratio:rb,position:null,motif:'doigts',ref:null,marge:null};
  const rp=repereBras(user);
  if(!rp) return {ratio:rb,position:null,motif:'sexe',ref:null,marge:null};
  return {ratio:rb,position:_morphoPosition(rb,rp.ref,rp.marge),motif:null,ref:rp.ref,marge:rp.marge,sexe:rp.sexe};
}

// Exercices du même schéma moteur, à titre de VARIANTES POSSIBLES. Ce lot
// n'écarte rien : ces noms sont proposés à côté, jamais à la place.
//
// ⚠ PLUS LES N PREMIERS PAR ORDRE ALPHABÉTIQUE (06/10/2026) : « FESSIER A LA
//   MACHINE DE TRACTION, MUSCLE UP » sortaient en variantes de tirage. Dans
//   l'ordre :
//   1. la liste CHOISIE par les profils (`opts.preferees`, champ `variantes`
//      des aménagements), quand elle existe ;
//   2. à défaut, le catalogue du schéma, SANS la famille de l'exercice courant
//      (`opts.exclure`), sans les exercices dont le groupe principal n'est pas
//      celui du schéma, sans les mouvements avancés, et trié par fréquence
//      d'usage dans les programmes du coach.
const VARIANTES_EXCLUES_AVANCEES=Object.freeze(['MUSCLE UP','HANDSTAND PUSH UP','SQUAT PISTOL',
  'SNATCH','CLEAN AND JERK','POWER CLEAN','DIPS AUX ANNEAUX','POMPE AUX ANNEAUX','MONTEE DE CORDE SANS LES JAMBES']);
// « TRACTIONS PRISE NEUTRE » → « TRACTION PRISE » : les deux premiers mots, au singulier.
function _familleEx(k){
  const m=String(k||'').split(' ').filter(Boolean).slice(0,2).map(w=>w.replace(/S$/,''));
  return m.join(' ');
}
function _principalEx(k){
  try{ const g=_exGuide().get(k); return (g&&g.p&&g.p[0])||null; }catch(e){ return null; }
}
const _principalSchemaCache={};
// Le groupe principal le plus fréquent parmi les exercices du schéma.
function _principalSchema(schema){
  if(schema in _principalSchemaCache) return _principalSchemaCache[schema];
  const n={};
  for(const k in _SCHEMA_INDEX) if(_SCHEMA_INDEX[k]===schema){ const p=_principalEx(k); if(p) n[p]=(n[p]||0)+1; }
  let best=null; for(const p in n) if(!best||n[p]>n[best]) best=p;
  return (_principalSchemaCache[schema]=best);
}
// La fréquence d'usage : combien de fois chaque exercice figure dans les
// programmes des athlètes en cache et dans les modèles du coach.
let _freqExos={t:0,m:{}};
function _frequencesExercices(){
  const t=Date.now();
  if(t-_freqExos.t<30000) return _freqExos.m;
  const m={};
  const compter=l=>{ for(const s of (Array.isArray(l)?l:[])) for(const ex of ((s&&s.exercises)||[])){
    if(!ex||!ex.name) continue; let k=''; try{ k=exKey(ex.name); }catch(e){ continue; } m[k]=(m[k]||0)+1; } };
  try{ Object.values(DB.get('users')||{}).forEach(u=>{ if(u) compter(u.sessions_config); }); }catch(e){}
  try{ ((currentUser&&currentUser.coachPrograms)||[]).forEach(p=>{ compter(p&&p.sessions_config); compter(p&&p.H); compter(p&&p.F); }); }catch(e){}
  _freqExos={t,m};
  return m;
}
function _variantesSchema(schema,combien,opts){
  const o=opts||{}, n=combien||4;
  let cur=''; try{ cur=o.exclure?exKey(o.exclure):''; }catch(e){ cur=''; }
  const out=[];
  for(const v of (o.preferees||[])){
    let k=''; try{ k=exKey(v); }catch(e){ continue; }
    if(!k||k===cur||!_SCHEMA_INDEX[k]||out.indexOf(k)>=0) continue;
    out.push(k);
    if(out.length>=n) return out;
  }
  const fam=cur?_familleEx(cur):'';
  const princ=_principalSchema(schema);
  const freq=_frequencesExercices();
  const cand=Object.keys(_SCHEMA_INDEX).filter(k=>_SCHEMA_INDEX[k]===schema&&k!==cur&&out.indexOf(k)<0
    &&(!fam||_familleEx(k)!==fam)
    &&VARIANTES_EXCLUES_AVANCEES.indexOf(k)<0
    &&(!princ||_principalEx(k)===princ));
  cand.sort((a,b)=>(freq[b]||0)-(freq[a]||0)||(a<b?-1:a>b?1:0));
  return out.concat(cand).slice(0,n);
}

// Rapport des volumes quadriceps / ischios sur les dernières semaines
// ENTRAÎNÉES, avec le comptage de volume existant et les mêmes bornes que le
// reste du produit — VOL_COUPURE pour la coupure, VOL_DELTA_MIN pour le
// minimum exploitable. Rend null si l'un des deux volumes est nul : un rapport
// à dénominateur nul ne veut rien dire.
function dominanceQuadIschio(user){
  let q=0,i=0,n=0,vides=0;
  for(let k=0;k<=26&&n<VOL_DELTA_N;k++){
    const c=_calculSemaine(user,_volCleDecalee(k));
    if(!c.eligibles){ if(++vides>=VOL_COUPURE) break; continue; }
    vides=0; n++;
    q+=c.muscles.QUADRICEPS||0;
    i+=c.muscles.ISCHIOS||0;
  }
  if(n<VOL_DELTA_MIN) return null;
  if(!(q>0)||!(i>0)) return null;
  return Math.round(q/i*100)/100;
}

