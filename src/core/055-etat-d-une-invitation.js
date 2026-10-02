// ══════ ÉTAT D'UNE INVITATION ══════
// Un coach qui envoie un lien ne sait rien de ce qu'il devient. Trois états,
// et une seule direction : envoyé → ouvert → créé. On ne redescend jamais.
//
// CE QU'ON N'ÉCRIT PAS DANS /rc_codes : rien de nominatif au-delà du prénom
// et du nom que le coach a lui-même saisis. Pas d'e-mail, pas de téléphone.
// Le nœud est en lecture PUBLIQUE — c'est ce qui permet à un athlète sans
// compte de valider son code — donc tout ce qu'on y met est lisible par
// quiconque connaît le code.
const INV_ETATS=Object.freeze(['envoye','ouvert','cree']);
// PURE. Rend le rang d'un état, -1 s'il est inconnu. C'est lui qui garantit
// le sens unique.
function _rangEtat(e){ return INV_ETATS.indexOf(e); }
// PURE. L'état est-il une progression ? Un aperçu de messagerie qui repasse
// après la création du compte ne doit pas ramener l'invitation à « ouvert ».
function etatProgresse(avant,apres){
  const a=_rangEtat(avant), b=_rangEtat(apres);
  if(b<0) return false;
  return b>(a<0?-1:a);
}
// PURE. L'état affichable d'un code, avec son repli : un code écrit avant ce
// lot n'a pas de champ `etat`, et se lit « créé » s'il a été consommé,
// « envoyé » sinon. Aucune migration, aucun rattrapage.
function etatInvitation(c){
  if(!c) return null;
  // redeemed PRIME. Un compte existe ou n'existe pas, et c'est ce champ qui
  // le dit — un `etat` reste en arriere ferait relancer quelqu'un qui a deja
  // son acces. C'est aussi ce qui couvre les codes emis avant ce lot, qui
  // portent redeemed:true et aucun etat.
  if(c.redeemed===true) return 'cree';
  if(_rangEtat(c.etat)>=0) return c.etat;
  return 'envoye';
}
const INV_ETAT_LIB=Object.freeze({envoye:'Envoyée',ouvert:'Ouverte',cree:'Compte créé'});

// Écrit une progression d'état sur le nœud distant. PATCH et non PUT : on ne
// touche qu'aux champs de suivi, jamais au reste du code.
// Rend true si l'écriture est partie ET a abouti.
//
// SANS JETON, ET C'EST VOULU : l'athlète marque « ouvert » avant d'avoir un
// compte. La règle RTDB borne cette écriture à `etat` et `ouvertLe`, sur un
// nœud existant, et pour cette seule transition.
async function _marquerEtatInvitation(code,etat,champs){
  if(!code||_rangEtat(etat)<0) return false;
  try{
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),6000);
    const lu=await fetch(_rcCodesUrl(code),{signal:ctrl.signal});
    if(!lu.ok) return false;
    const t=await lu.text();
    try{ _quotaCompter('in',t.length); }catch(e){}
    const d=t?JSON.parse(t):null;
    if(!d) return false;
    // Sens unique. Un aperçu tardif ne fait pas reculer un compte déjà créé.
    if(!etatProgresse(etatInvitation(d),etat)) return false;
    const corps=JSON.stringify(Object.assign({etat},champs||{}));
    const tok=await CLOUD._getToken().catch(()=>null);
    const r=await fetch(_rcCodesUrl(code)+(tok?'?auth='+tok:''),
      {method:'PATCH',headers:{'Content-Type':'application/json'},body:corps});
    try{ _quotaCompter('out',corps.length); }catch(e){}
    return r.ok;
  }catch(e){ return false; }
}

async function _genAccessCode(studentName,months,type){
  const fbTok=await CLOUD._getToken();
  const expiry=Date.now()+months*_MONTH_MS;
  const codeId='sc_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);
  const code=_rcRandCode();
  const isCreator=currentUser.email===CREATOR_EMAIL;
  // Refus EXPLICITE plutôt que rabotage silencieux : un coach qui demande
  // 24 mois doit savoir qu'il n'en obtiendra pas 24, pas découvrir 12 plus
  // tard sur le dossier de son athlète.
  if(!isCreator&&months>CODE_MOIS_MAX_AFFILIE)
    throw new Error('Durée maximale : '+CODE_MOIS_MAX_AFFILIE+' mois par code. '
      +'Tu pourras en générer un nouveau à l\'échéance.');
  const payload={
    coachId:currentUser.id,
    coachName:(currentUser.fname||'')+' '+(currentUser.lname||''),
    // Identite RTDB du coach transportee PAR LE CODE. Sans elle, un athlete
    // qui saisit le code sur un appareil neuf n'a aucun moyen de connaitre la
    // cle a inscrire : le coach n'est pas dans son localStorage, et c'est
    // pourtant cette cle que .read/.write de database.rules.json exigent pour
    // lui accorder l'acces au dossier.
    coachEmail:currentUser.email||null,
    coachEmailKey:(currentUser.email||'').replace(/\./g,',')||null,
    coachCode:currentUser.code||null,
    studentName,expiry,months,codeId,
    // Prénom et nom séparés : le tableau des invitations en attente les
    // affiche, et recomposer un prénom depuis « studentName » se trompe dès
    // qu'un nom en porte deux.
    prenom:String(studentName||'').trim().split(/\s+/)[0]||'',
    nom:String(studentName||'').trim().split(/\s+/).slice(1).join(' '),
    type:type||'athlete',
    // creatorFree est CONSERVÉ tel quel : des codes en circulation le portent,
    // et _appliquerPayloadCode s'en sert encore pour eux. grantedBy le double
    // sans le remplacer — retirer un champ d'un code déjà distribué le
    // casserait.
    creatorFree:isCreator,
    grantedBy:isCreator?'creator':'coach'
  };
  // Hors ligne, la generation ne peut PAS aboutir : le code doit exister
  // cote serveur avant d'etre transmis, sinon l'athlete recevrait un lien
  // mort. On le dit franchement, et on ne met rien en file : une invitation
  // qui partirait plus tard, sans que le coach le sache, est pire.
  if(typeof navigator!=='undefined'&&navigator.onLine===false)
    throw new Error('Tu es hors ligne : le code doit être enregistré avant '
      +'d\'être envoyé. Reconnecte-toi et réessaie : rien n\'a été créé.');
  // ⚠ SANS JETON, LE SERVEUR REFUSE (27/09/2026). Constaté chez Kévin : un
  //   code impossible à créer, et pour seul retour « Erreur sauvegarde du code
  //   (401) : vérifie ta connexion » — alors que la connexion allait très
  //   bien. C'est la SESSION qui manquait (jeton d'un autre compte après une
  //   bascule ⇄, ou session expirée) : on le dit, avec le geste qui répare.
  if(!fbTok) throw new Error(_msgSessionCode());
  const url=_rcCodesUrl(code)+'?auth='+fbTok;
  let r;
  try{
    r=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...payload,token:code,active:true,redeemed:false,createdAt:Date.now(),
      // L'état de départ. Les trois dates restent nulles : elles se posent
      // aux transitions, et une date absente vaut « ce n'est pas arrivé ».
      etat:'envoye',ouvertLe:null,creeLe:null,relanceLe:null})});
  }catch(e){
    // Reseau coupe en cours de route : « Failed to fetch » ne dit rien a
    // personne. On traduit, et on redit que rien n'a ete cree.
    throw new Error('Le code n\'a pas pu être enregistré : vérifie ta connexion. '
      +'Rien n\'a été créé, tu peux réessayer.');
  }
  if(!r.ok){
    // LE MOTIF DU SERVEUR, EN CLAIR. Un 401 ou un 403, c'est un refus des
    // règles : la session, pas le réseau.
    let motif='';
    try{ const j=await r.json(); motif=String((j&&j.error)||''); }catch(e){}
    if(r.status===401||r.status===403) throw new Error(_msgSessionCode());
    throw new Error('Le serveur n’a pas enregistré le code ('+r.status+(motif?' : '+motif:'')+'). '
      +'Rien n’a été créé, tu peux réessayer.');
  }
  return {token:code,payload};
}
// Le message quand le serveur refuse faute de session valide : il nomme le
// compte en cause quand c'en est un autre (bascule ⇄), sinon il demande de se
// reconnecter. Rien n'a été créé dans les deux cas.
function _msgSessionCode(){
  const affiche=(currentUser&&currentUser.email)||'';
  const autre=(CLOUD&&CLOUD._jetonEtranger)||'';
  return autre
    ?('Code non créé : la session ouverte est celle de « '+autre+' », pas de « '+affiche
      +' ». Déconnecte-toi (Profil) puis reconnecte-toi avec '+affiche+'.')
    :('Code non créé : ta session a expiré. Déconnecte-toi (Profil) puis reconnecte-toi, '
      +'et génère le code à nouveau.');
}
// ── Invitation coach ────────────────────────────────────────────────────────
// L'inscription coach était libre : n'importe qui pouvait se déclarer coach et
// obtenir un tableau de bord, des codes élèves et une place dans la liste
// d'offboarding. Elle passe désormais par un code émis par le créateur.
const _INVITE_RE=/^RC-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
function _coachInviteCode(){try{return sessionStorage.getItem('rc_coach_invite')||'';}catch(e){return '';}}
function _clearCoachInvite(){try{sessionStorage.removeItem('rc_coach_invite');}catch(e){}}

// Ne peut pas réutiliser _verifyAccessCode : celui-ci s'appuie sur currentUser,
// qui n'existe pas encore au moment où quelqu'un s'inscrit.
// Appelée APRÈS CLOUD.signIn, car les règles RTDB exigent auth != null pour
// lire rc_codes. Conséquence assumée : un code refusé laisse un compte Firebase
// Auth sans dossier applicatif — état inoffensif, identique à une inscription
// abandonnée, que la tentative suivante avec le même mot de passe rattrape.
// CE QUE LE SERVEUR GARANTIT, ET CE QU'IL NE GARANTIT PAS. Relu sur
// database.rules.json : le retour en arriere EST bloque. La regle de
// /rc_codes/$code n'accorde l'ecriture d'un noeud existant que si
// data.redeemed !== true ET newData.redeemed === true — remettre redeemed a
// false est donc refuse par Firebase, pas seulement par le client. Le
// commentaire precedent affirmait l'inverse ; il invitait a relacher une
// verification qui, elle, tient.
//
// CE QUI RESTE OUVERT, et qu'il faut savoir : la meme regle accorde
// l'ecriture des que le noeud N'EXISTE PAS. N'importe quel compte
// authentifie peut donc CREER /rc_codes/RC-XXXX-XXXX avec type:'coach'. Le
// verrou d'invitation n'a jamais ferme que la porte principale — raison de
// plus pour ne pas faire reposer de droits dessus, ce que ce lot acte.
async function _verifyCoachInvite(raw,email){
  const code=String(raw||'').trim().toUpperCase();
  if(!_INVITE_RE.test(code)) throw new Error('Code d\'invitation mal formé (format RC-XXXX-XXXX).');
  const fbTok=await CLOUD._getToken();
  const url=_rcCodesUrl(code)+(fbTok?'?auth='+fbTok:'');
  let data;
  try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);data=await r.json();}
  catch(e){throw new Error('Impossible de vérifier le code d\'invitation : vérifie ta connexion.');}
  if(!data) throw new Error('Code d\'invitation inconnu.');
  if(data.type!=='coach') throw new Error('Ce code n\'est pas une invitation coach.');
  if(!data.active) throw new Error('Cette invitation a été désactivée.');
  if(Date.now()>data.expiry) throw new Error('Cette invitation a expiré.');
  if(data.redeemed) throw new Error('Cette invitation a déjà servi.');
  await _devenirCoach(code);
  return {valid:true,payload:data};
}
// ══ DEVENIR COACH, PAR LE WORKER (30/09/2026) ═══════════════════════════════
// Le role 'coach' est gele par les regles : devenirCoach le pose, avec la
// ligne du registre des coachs. Avec une invitation (emise par le createur,
// consommee en transaction) ou, sans, sur une place Libre que le serveur
// compte lui-meme — le client ne touche plus au compteur.
async function _devenirCoach(invitation){
  let r;
  try{ r=await CLOUD._callFn('devenirCoach',invitation?{invitation:String(invitation).trim().toUpperCase()}:{}); }
  catch(e){
    if(e&&e.statut>=400&&e.statut<500&&e.statut!==404) throw new Error(e.message);
    throw new Error('Création du compte coach impossible pour le moment : réessaie dans un instant.');
  }
  try{ if(currentUser&&currentUser.email) await rafraichirCoachRegistre(currentUser,true); }catch(e){}
  return r;
}

// Contrôle de validité SANS effet de bord, pour l'athlète qui n'a pas encore de
// compte. Ne peut pas réutiliser _verifyAccessCode : celui-ci lit currentUser
// (inexistant avant l'inscription) et surtout CONSOMME le code par un PATCH —
// le brûler ici le rendrait inutilisable par l'inscription qui suit.
// Le rejet d'un code déjà consommé est ici sans nuance, contrairement à
// _verifyAccessCode qui tolère `redeemed` pour le compte qui l'a consommé :
// personne ne peut être ce compte avant de s'être inscrit.
// DE QUEL COACH VIENT CE CODE ? Rien d'autre. Aucune validation : ni actif,
// ni expiré, ni déjà utilisé — ces trois-là restent l'affaire de
// _verifyAccessCode, qui les rend avec ses propres messages.
//
// Elle existe parce que _verifyAccessCode CONSOMME le code (PATCH
// redeemed:true) : l'appeler pour décider s'il faut refuser brûlerait le code
// avant de savoir. Et parce que _verifierCodeSansConsommer, lui, refuse un
// code déjà utilisé — ce qui empêcherait de comparer les coachs dans
// précisément le cas où un athlète a déjà consommé le code d'un autre.
async function _coachDuCode(code){
  try{
    const c=String(code||'').trim().toUpperCase();
    if(!_INVITE_RE.test(c)) return null;
    const t=await CLOUD._getToken().catch(()=>null);
    const r=await fetch(_rcCodesUrl(c)+(t?'?auth='+t:''));
    if(!r.ok) return null;
    const d=await r.json();
    // La forme attendue par _annoncerDejaRattache : un objet coach.
    return (d&&d.coachId)?{id:d.coachId,fname:d.coachName||'',lname:''}:null;
  }catch(e){ return null; }
}
async function _verifierCodeSansConsommer(raw){
  const code=String(raw||'').trim().toUpperCase();
  if(!_INVITE_RE.test(code)) throw new Error('Format attendu : RC-XXXX-XXXX (lettres et chiffres).');
  // Sans jeton : la règle .read de /rc_codes/$code est publique précisément
  // pour ce cas. Le jeton est tout de même joint s'il existe (rattrapage
  // depuis un compte connecté), pour rester correct si la règle se resserre.
  const fbTok=await CLOUD._getToken().catch(()=>null);
  const url=_rcCodesUrl(code)+(fbTok?'?auth='+fbTok:'');
  let data;
  try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);data=await r.json();}
  catch(e){throw new Error('Impossible de vérifier le code : vérifie ta connexion.');}
  if(!data) throw new Error('Code invalide ou introuvable. Vérifie avec ton coach.');
  if(data.type==='coach') throw new Error('Ce code est une invitation coach, pas un code d\'accès athlète.');
  if(!data.active) throw new Error('Ce code a été désactivé par ton coach.');
  if(Date.now()>data.expiry) throw new Error('Ce code a expiré. Demande un nouveau code à ton coach.');
  if(data.redeemed) throw new Error('Ce code a déjà été utilisé par un autre compte.');
  return data;
}

// ── Code retenu entre l'écran d'entrée et la fin de l'inscription ────────────
// Doublé sessionStorage + localStorage à dessein : sessionStorage seul est
// perdu si l'inscription rouvre l'app dans un autre onglet (lien de
// vérification, gestionnaire de mots de passe), localStorage seul survit trop
// longtemps et re-proposerait un vieux code. On écrit les deux, on lit le plus
// frais disponible, on efface les deux à la consommation.
const _CLE_CODE='rc_code_verifie';
function _retenirCodeVerifie(code,payload){
  const brut=JSON.stringify({code,payload,at:Date.now()});
  try{sessionStorage.setItem(_CLE_CODE,brut);}catch(e){}
  try{localStorage.setItem(_CLE_CODE,brut);}catch(e){}
  // pendingCode reste écrit pour le pré-remplissage de s-client-code : c'est
  // lui que lit le rattrapage, et cinq chemins en dépendent encore.
  _poserCodeEnAttente(code);
}
function _codeVerifieEnAttente(){
  for(const st of [sessionStorage,localStorage]){
    try{
      const b=st.getItem(_CLE_CODE);
      if(b) return JSON.parse(b);
    }catch(e){}
  }
  return null;
}
function _oublierCodeVerifie(){
  try{sessionStorage.removeItem(_CLE_CODE);}catch(e){}
  try{localStorage.removeItem(_CLE_CODE);}catch(e){}
  try{localStorage.removeItem('pendingCode');}catch(e){}
}

async function _verifyAccessCode(raw,athleteName){
  const fbTok=await CLOUD._getToken();
  const url=_rcCodesUrl(raw)+(fbTok?'?auth='+fbTok:'');
  let data;
  try{const r=await fetch(url);if(!r.ok)throw new Error(r.status);data=await r.json();}
  catch(e){throw new Error('Impossible de vérifier le code : vérifie ta connexion.');}
  if(!data) throw new Error('Code invalide ou introuvable. Vérifie avec ton coach.');
  // AVANT TOUT LE RESTE, et surtout avant le PATCH plus bas : une invitation
  // coach acceptée ici était CONSOMMÉE — marquée redeemed:true — alors qu'elle
  // ne servait à rien à un athlète. Le coach invité trouvait ensuite son propre
  // code « déjà utilisé ».
  //
  // _verifierCodeSansConsommer refusait déjà ce cas ; les deux fonctions
  // disaient donc le contraire sur le même code, et seule celle qui consomme
  // laissait passer.
  if(data.type==='coach') throw new Error("Ce code est une invitation coach, pas un code d'accès athlète. Crée ton compte depuis l'Espace Coach.");
  if(!data.active) throw new Error('Ce code a été désactivé par ton coach.');
  if(Date.now()>data.expiry) throw new Error('Ce code a expiré. Demande un nouveau code à ton coach.');
  if(data.redeemed&&data.athleteEmail&&data.athleteEmail!==currentUser.email)
    throw new Error('Ce code a déjà été utilisé par un autre compte.');
  // ══ C'EST LE WORKER QUI CONSOMME (30/09/2026) ══════════════════════════
  // Le PATCH redeemed:true que l'app faisait ici est refuse par les regles :
  // redeemCode verifie que le coach emetteur est au registre, plafonne les
  // mois, consomme en transaction, puis ecrit droits/<athlete> et, dans le
  // dossier, coachEmailKey, coachId et status. Rejouer pour le meme compte ne
  // rallonge rien. Les refus (code d'un non-coach, deja pris) remontent tels
  // quels : ils sont definitifs, et leur message dit quoi faire.
  if(!currentUser||!currentUser.email) throw new Error('Connecte-toi pour activer ce code.');
  let res;
  try{ res=await CLOUD._callFn('redeemCode',{code:String(raw||'').trim().toUpperCase(),nom:athleteName||data.studentName||''}); }
  catch(e){
    if(e&&e.statut>=400&&e.statut<500&&e.statut!==404) throw new Error(e.message);
    throw new Error('Activation impossible pour le moment ('+((e&&e.message)||'serveur injoignable')+'). Réessaie dans un instant : ton code n’a pas été utilisé.');
  }
  return {valid:true,payload:Object.assign({},data,{
    // L'échéance que le SERVEUR a posée : c'est elle que l'affichage doit dire.
    expiry:(res&&Number(res.echeance))||data.expiry,
    coachEmailKey:(res&&res.coachEmailKey)||data.coachEmailKey,serveur:res||null})};
}
async function _extendAccessCode(codeId,addMonths,token){
  if(!token) throw new Error('Token du code introuvable : recopie le code depuis la liste.');
  const fbTok=await CLOUD._getToken();
  const url=_rcCodesUrl(token)+(fbTok?'?auth='+fbTok:'');
  const r=await fetch(url); const data=r.ok?await r.json():null;
  const base=Math.max((data&&data.expiry)||0,Date.now());
  const newExpiry=base+addMonths*_MONTH_MS;
  const newMonths=((data&&data.months)||0)+addMonths;
  await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({expiry:newExpiry,months:newMonths})});
  const payload={...(data||{}),expiry:newExpiry,months:newMonths};
  let appliedImmediately=false;
  if(data&&data.athleteEmail){
    const users=DB.get('users')||{};
    const ath=users[data.athleteEmail];
    // La prolongation touche le dossier de QUELQU'UN D'AUTRE : le coach voit sa
    // nouvelle date, l'athlete garde l'ancienne tant que l'envoi n'est pas parti.
    // L'ACCES DE L'ATHLETE SUIT PAR LE WORKER (30/09/2026) : accessExpiry est
    // gele dans son dossier, et c'est droits/ qui decide. prolongerCode relit
    // le code au serveur et plafonne.
    if(ath){ath.accessExpiry=newExpiry;users[data.athleteEmail]=ath;DB.setLocal('users',users);}
    try{
      const _p=await CLOUD._callFn('prolongerCode',{code:token});
      appliedImmediately=!!(_p&&_p.applique);
    }catch(e){
      toast('Prolongation enregistrée sur le code, pas encore sur l’accès de ton athlète : '+(e.message||'réessaie'),'var(--orange)');
    }
  }
  return {token,payload,appliedImmediately};
}

// ── Coach: generate student access code ──
let lastGeneratedCode=null;
// Génération d'une invitation coach. Même garde que les codes gratuits : seul
// CREATOR_EMAIL peut en émettre, sinon n'importe quel coach pourrait s'inviter
// des confrères et le contrôle ne vaudrait rien.
let _dernierInviteCoach=null;
async function generateCoachInvite(){
  if(currentUser.email!==CREATOR_EMAIL){
    toast('Seul l\'administrateur RepCore peut inviter un coach.','var(--red)');
    return;
  }
  const nom=(document.getElementById('ci-nom')?.value||'').trim();
  const mois=parseInt(document.getElementById('ci-duree')?.value)||1;
  if(!nom){toast('Entre le nom du coach à inviter','var(--orange)');return;}
  let gen;
  try{ gen=await _genAccessCode(nom,mois,'coach'); }
  catch(e){ toast(e.message||'Impossible de générer l\'invitation : réessaie.','var(--red)'); return; }
  _dernierInviteCoach=gen.token;
  const val=document.getElementById('ci-code-val');
  const inf=document.getElementById('ci-expiry-info');
  const res=document.getElementById('ci-result');
  if(val) val.textContent=gen.token;
  if(inf) inf.textContent='Pour '+nom+' · valable jusqu\'au '
    +new Date(gen.payload.expiry).toLocaleDateString('fr-FR')+' · usage unique';
  if(res) res.style.display='block';
  toast('Invitation coach générée','var(--green)');
}
function _copierInviteCoach(){
  if(!_dernierInviteCoach){toast('Génère d\'abord une invitation','var(--orange)');return;}
  const t=_dernierInviteCoach;
  try{
    navigator.clipboard.writeText(t)
      .then(()=>toast('Invitation copiée','var(--green)'))
      .catch(()=>toast('Copie refusée : sélectionne le code à la main.','var(--orange)'));
  }catch(e){toast('Copie impossible sur cet appareil.','var(--orange)');}
}

async function generateStudentCode(){
  // Depuis R-03, un coach affilié accorde l'accès à ses athlètes : lui
  // refuser la génération ici contredisait l'encart juste au-dessus, qui
  // lui annonce « chaque code que tu génères ouvre l'accès à ton athlète ».
  // Le PLAFOND, lui, subsiste : _genAccessCode refuse au-delà de
  // CODE_MOIS_MAX_AFFILIE et le dit, plutôt que de raboter en silence.
  // Seule l'invitation COACH reste réservée au créateur — c'est lui qui
  // décide qui rejoint la plateforme.
  const name=document.getElementById('sc-name').value.trim();
  const months=parseInt(document.getElementById('sc-duration').value)||3;
  if(!name){toast('Entre le nom de l\'élève');return;}
  let gen;
  try{
    gen=await _genAccessCode(name,months);
  }catch(e){
    toast(e.message||'Impossible de générer le code : réessaie.','var(--red)');
    return;
  }
  const {token,payload}=gen;
  const expiry=payload.expiry;
  // Store in coach's studentCodes
  if(!currentUser.studentCodes) currentUser.studentCodes=[];
  currentUser.studentCodes.push({...payload,token,usedBy:null,active:true,createdAt:Date.now()});
  currentUser.updatedAt=Date.now();
  const users=DB.get('users')||{};
  users[currentUser.email]=currentUser;
  DB.set('users',users);DB.set('session',currentUser);
  // LE PLUS COUTEUX DES SEPT SILENCES. Un code vit dans /rc_codes cote serveur :
  // si la poussee echoue, il existe sur l'appareil du coach et NULLE PART
  // AILLEURS. Le coach le lit a l'ecran, le donne a son athlete, et le code ne
  // marche pas — sans qu'aucun des deux ne puisse comprendre pourquoi.
  direSiEnvoiEchoue(CLOUD.pushOne(currentUser.email,currentUser),'Ce code',
    'il ne fonctionnera pas tant qu\'il n\'est pas parti, attends d\'être en ligne avant de le donner');
  // Display
  lastGeneratedCode=token;
  document.getElementById('sc-code-val').textContent=token;
  const exp=new Date(expiry);
  document.getElementById('sc-expiry-info').textContent='Accès pour '+name+' - expire le '+exp.toLocaleDateString('fr-FR')+' ('+months+' mois)';
  document.getElementById('sc-result').style.display='';
  loadStudentCodes();
}
function copyStudentCode(){
  if(!lastGeneratedCode) return;
  // LE MESSAGE ENTIER, PAS LE CODE NU : c'est ce que le coach envoie a son
  // athlete (demande de Kevin, 29/09/2026). Le code seul si l'entree manque.
  const c=((currentUser&&currentUser.studentCodes)||[]).find(x=>x&&x.token===lastGeneratedCode);
  _rcCopierOuMontrer(c?_texteInvitationAthlete(c):lastGeneratedCode,'Message copié : colle-le dans WhatsApp','Copie ce message et envoie-le à l\'élève :');
}
function loadStudentCodes(){
  const isCreator=currentUser.email===CREATOR_EMAIL;
  const genCard=document.getElementById('sc-generate-card');
  const nonCreatorMsg=document.getElementById('sc-noncreatormsg');
  // La carte de génération s'affiche pour TOUS les coachs : l'affilié en a
  // l'usage, et la lui cacher pendant que l'encart lui promet des codes
  // était la contradiction la plus visible de cet écran.
  if(genCard) genCard.style.display='';
  // L'encart reste réservé à l'affilié : il porte le plafond de 12 mois,
  // qui ne s'applique pas au créateur.
  if(nonCreatorMsg) nonCreatorMsg.style.display=isCreator?'none':'';
  // L'invitation coach suit la même règle : réservée au créateur.
  const inviteCard=document.getElementById('sc-coach-invite-card');
  if(inviteCard) inviteCard.style.display=isCreator?'':'none';
  const codes=currentUser.studentCodes||[];
  const el=document.getElementById('sc-list');
  if(!codes.length){el.innerHTML=emptyState('key','Aucun code pour l\'instant. Chaque code ouvre l\'accès à un athlète.','Générer un code','generateStudentCode()');return;}
  const now=Date.now();
  el.innerHTML=[...codes].reverse().map((c,ri)=>{
    const i=codes.length-1-ri;
    const expired=now>c.expiry;
    const exp=new Date(c.expiry);
    const st=!c.active?'<span class="badge badge-gray">Désactivé</span>':expired?'<span class="badge badge-red">Expiré</span>':'<span class="badge badge-green">Actif</span>';
    // usedBy vient du nom que l'ATHLÈTE saisit en rachetant son code
    // (_verifyAccessCode), studentName de la saisie du coach : les deux
    // atterrissent dans l'écran du coach et doivent être échappés.
    const used=c.usedBy?'<div style="font-size:var(--fs-xs);color:var(--sub)">Utilisé par : '+escapeHtml(c.usedBy)+'</div>':'<div style="font-size:var(--fs-xs);color:var(--sub)">Non utilisé</div>';
    return '<div style="background:var(--dark);border:1px solid var(--surface-2);border-radius:var(--r-3);padding:14px;margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<div style="font-weight:700">'+escapeHtml(c.studentName||'')+'</div>'+st+'</div>'
      +'<div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px">Expire: '+exp.toLocaleDateString('fr-FR')+' ('+c.months+' mois)</div>'
      +used
      +'<div style="display:flex;gap:8px;margin-top:10px">'
      +'<button onclick="toggleStudentCode('+i+')" style="flex:1;background:none;border:1px solid var(--border);color:var(--sub);border-radius:var(--r-2);padding:8px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;font-weight:700">'+(c.active?'Désactiver':'Activer')+'</button>'
      +'<button onclick="extendStudentCode('+i+')" style="flex:1;background:none;border:1px solid #1a3a1a;color:var(--green);border-radius:var(--r-2);padding:8px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;font-weight:700">+3 mois</button>'
      +'</div>'
      // ══ LE GESTE PRINCIPAL DE LA LIGNE, ET IL PREND SA PROPRE LARGEUR ══
      // « Copier » etait un troisieme bouton de la rangee, du meme rang que
      // « Desactiver ». C'est pourtant CE geste-la qu'on fait apres avoir
      // genere un code : on l'envoie. Et « Copier l'invitation » ne tient pas
      // dans un tiers de carte sur un telephone — il s'y couperait en trois
      // lignes. Il passe donc sur sa propre ligne, au-dessus du rouge.
      +'<button onclick="_copierInvitationAthlete('+i+')" style="width:100%;margin-top:8px;background:none;border:1px solid #1a1a3a;color:#7ab;border-radius:var(--r-2);padding:8px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;font-weight:700">Copier l\'invitation</button>'
      // ══ LE QUATRIEME GESTE : FERMER ET EFFACER ══════════════════════════
      // Demande de Kevin, 08/09/2026 : « ca m'eviterait de devoir rechercher
      // des codes ou des athletes avec qui je ne peux plus travailler ».
      // Desactiver laisse la ligne ; celui-ci la retire, et emporte la fiche
      // de l'eleve avec elle quand il y en a une. Il est SEUL SUR SA LIGNE et
      // en rouge : ce n'est pas une quatrieme option du meme rang.
      +'<button onclick="supprimerCodeEtFiche('+i+')" style="width:100%;margin-top:8px;background:none;border:1px solid #3a0000;color:var(--red-light);border-radius:var(--r-2);padding:8px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);cursor:pointer;font-weight:700">Rendre inactif et supprimer la fiche + le code</button>'
      +'</div>';
  }).join('');
}
// ══ FERMER UN CODE ET EFFACER CE QU'IL A OUVERT ══════════════════════════
//
// Trois choses peuvent exister derriere une ligne de code : le code lui-meme,
// le noeud /rc_codes qui le rend lisible aux athletes, et — s'il a ete
// consomme — le dossier de l'eleve. Ce bouton les retire toutes les trois.
//
// ⚠ LE SERVEUR D'ABORD, ET DANS CET ORDRE. La regle d'ecriture de
// /users/$emailKey accorde le droit au coach QUE LE DOSSIER DESIGNE : nettoyer
// localement avant, c'est se retirer soi-meme le droit de supprimer a
// distance, et laisser un dossier orphelin dans la base. Meme raison pour le
// code : un code encore actif cote serveur continue de rattacher des eleves
// alors que le coach le croit ferme.
//
// UN DOSSIER QUI PORTE QUELQUE CHOSE FAIT RETAPER LE PRENOM. Ce sont les
// seances, les bilans et les photos d'une personne, et il n'y a pas de
// corbeille. Un dossier vide — le cas courant, un code jamais utilise — part
// sur une simple confirmation.
async function supprimerCodeEtFiche(i){
  const codes=currentUser.studentCodes||[];
  const code=codes[i];
  if(!code){ toast('Code introuvable.','var(--orange)'); return false; }
  const nom=String(code.studentName||code.usedBy||'').trim();
  // L'eleve inscrit derriere ce code, s'il y en a un.
  const users=DB.get('users')||{};
  const ath=Object.values(users).find(u=>u&&_estMonAthlete(u,currentUser)&&(
    (code.athleteEmail&&String(u.email||'').toLowerCase()===String(code.athleteEmail).toLowerCase())
    ||(nom&&exKey((u.fname||'')+' '+(u.lname||''))===exKey(nom))));
  const vide=!ath||_dossierVide(ath);
  const quoi=ath?('le code ET le dossier de '+(((ath.fname||'')+' '+(ath.lname||'')).trim()||nom||'cet élève'))
                :('le code de '+(nom||'cet élève'));
  if(vide){
    if(!await rcConfirm('Supprimer '+quoi+' ?\n\n'
      +(ath?'Ce dossier ne porte aucune séance ni aucun bilan. ':'')
      +'Le code sera désactivé puis retiré : personne ne pourra plus s\'en servir.',
      null,'Supprimer')) return false;
  } else {
    const attendu=(ath.fname||'').trim();
    const saisi=await rcSaisie('Supprimer '+quoi+' ?\n\n'
      +'Ses séances, bilans, mesures et photos seront SUPPRIMÉS de la base. '
      +'Ce sont ses données, et rien ne les rendra.\n\n'
      +'Retape son prénom ('+attendu+') pour confirmer.','',
      {libelleOk:'Supprimer définitivement'});
    if(saisi===null) return false;
    if(exKey(saisi)!==exKey(attendu)){
      toast('Le prénom ne correspond pas : rien n\'a été supprimé.','var(--orange)');
      return false;
    }
  }
  // 1. Le code, cote serveur. Un code sans jeton n'a pas de noeud a fermer.
  if(code.token&&!await _majActifDistant(code.token,false)){
    toast('Impossible de désactiver le code : vérifie ta connexion. RIEN n\'a été supprimé.','var(--red)');
    return false;
  }
  // 2. Le dossier, tant que le lien existe encore.
  if(ath&&ath.email&&!await CLOUD.supprimerDossier(ath.email)){
    toast('Impossible de supprimer le dossier dans la base : vérifie ta connexion. '
      +'Le code a été désactivé, RIEN d\'autre n\'a été supprimé.','var(--red)');
    return false;
  }
  // 3. L'appareil suit.
  if(ath){
    for(const k of Object.keys(users)) if(users[k]&&users[k].id===ath.id) delete users[k];
    DB.set('users',users);
    if(currentUser.clients) currentUser.clients=currentUser.clients.filter(id=>id!==ath.id);
    if(currentUser.seenBilans) delete currentUser.seenBilans[ath.email];
  }
  currentUser.studentCodes=codes.filter((c,j)=>j!==i);
  const ok=saveUser();
  try{ loadStudentCodes(); }catch(e){}
  try{ if(document.getElementById('ch-clients-list')) renderClientList(); }catch(e){}
  toast(ok?(ath?'Code et dossier supprimés':'Code supprimé')
          :'Supprimé, mais l\'enregistrement local a échoué', ok?'var(--green)':'var(--orange)');
  return true;
}
// Sur le modèle de _marquerRelanceDistante. Le nœud /rc_codes est la seule
// source qui fasse autorité pour les lecteurs du code : c’est là que
// _verifierCodeSansConsommer et _verifyAccessCode vont chercher `active`.
// Rend true SEULEMENT si le serveur a accepté l’écriture.
async function _majActifDistant(code,actif){
  try{
    const tok=await CLOUD._getToken().catch(()=>null);
    if(!tok) return false;
    const r=await fetch(_rcCodesUrl(code)+'?auth='+tok,
      {method:'PATCH',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({active:!!actif})});
    return r.ok;
  }catch(e){ return false; }
}
// DÉSACTIVER UN CODE DOIT LE DÉSACTIVER POUR DE BON.
//
// Cette fonction ne retournait que la copie locale du coach. Le nœud
// /rc_codes/{token} gardait active:true, et c’est LUI que lisent les deux
// vérifications : un code annoncé fermé continuait d’ouvrir l’accès, avec un
// coach persuadé du contraire. Sans ce bouton il aurait su qu’il ne pouvait
// pas fermer un code ; avec lui, il croyait l’avoir fait.
//
// L’ORDRE EST LE POINT : le nœud d’abord, l’affichage ensuite. Basculer
// localement puis échouer reproduirait exactement le défaut corrigé ici.
async function toggleStudentCode(i){
  if(!currentUser.studentCodes||!currentUser.studentCodes[i]) return;
  const c=currentUser.studentCodes[i];
  const nouveau=!c.active;
  // Un code sans jeton n’a pas de nœud à modifier. Le dire, plutôt que de
  // parler de connexion : le coach chercherait une panne qui n’existe pas.
  if(!c.token){ toast('Ce code est trop ancien pour être fermé à distance : régénère-le.','var(--orange)'); return; }
  if(!await _majActifDistant(c.token,nouveau)){
    toast(nouveau?'Impossible d\'activer le code : vérifie ta connexion'
                 :'Impossible de désactiver le code : vérifie ta connexion','var(--red)');
    return;
  }
  c.active=nouveau;
  currentUser.updatedAt=Date.now();
  const users=DB.get('users')||{};users[currentUser.email]=currentUser;
  DB.set('users',users);DB.set('session',currentUser);
  // Sans ce push, l’état ne suivait pas le coach d’un appareil à l’autre :
  // il rouvrait l’application sur son autre téléphone et lisait « actif ».
  // N3.18 — et le toast plus bas l'annoncait sans l'attendre.
  const _envoiCode=CLOUD.pushOne(currentUser.email,currentUser);
  loadStudentCodes();
  toastSync(true,_envoiCode,nouveau?'Code activé':'Code désactivé','le code est');
}
async function extendStudentCode(i){
  if(!currentUser.studentCodes||!currentUser.studentCodes[i]) return;
  const c=currentUser.studentCodes[i];
  let res;
  try{
    res=await _extendAccessCode(c.codeId,3,c.token);
  }catch(e){
    toast(e.message||'Impossible de prolonger le code : réessaie.','var(--red)');
    return;
  }
  Object.assign(c,res.payload,{token:res.token});
  currentUser.updatedAt=Date.now();
  const users=DB.get('users')||{};
  users[currentUser.email]=currentUser;
  DB.set('users',users);DB.set('session',currentUser);
  loadStudentCodes();
  // LA DATE, DES DEUX CÔTÉS : « prolongé de 3 mois » ne dit pas jusqu’à quand,
  // et c’est la seule chose que le coach cherche à savoir.
  const _jusquau=new Date(res.payload.expiry).toLocaleDateString('fr-FR');
  if(res.appliedImmediately){
    toast('Accès prolongé jusqu\'au '+_jusquau+' : actif immédiatement.','var(--green)');
  } else {
    // « Nouveau code généré » était FAUX : _extendAccessCode rend le même
    // jeton, aucun code n’est créé. Le coach cherchait dans sa liste un code
    // qui n’existait pas.
    //
    // Ce qui est vrai : le nœud du code est prolongé — le PATCH a eu lieu —
    // mais le dossier de l’athlète n’a pas pu être mis à jour sur CET
    // appareil. Resaisir le même code applique la prolongation :
    // _verifyAccessCode accepte un code déjà consommé par cette adresse, et
    // _appliquerPayloadCode retient la date la plus lointaine.
    toast('Code prolongé jusqu\'au '+_jusquau+'. Son dossier n\'est pas encore synchronisé ici : renvoie-lui le MÊME code (bouton Copier) pour qu\'il applique la prolongation.','var(--orange)');
  }
}
// ══ L'INVITATION ENTIERE, PLUS LE CODE NU ════════════════════════════════
//
// ⚠ copyExistingCode A ETE REMPLACEE le 14/09/2026. Elle copiait le token
// seul : le coach devait ensuite reecrire de memoire, a chaque athlete, ou
// cliquer, dans quel navigateur, et que le code n'est pas optionnel. Ce sont
// exactement les trois points sur lesquels une installation echoue, et ils
// etaient confies a sa memoire une fois par athlete.
//
// TEXTE BRUT, JAMAIS escapeHtml : ceci part dans un presse-papier, pas dans
// une page. Un prenom avec une apostrophe y deviendrait « M&#39;Bala ».
// La video qui montre l'installation et le premier bilan, citee dans l'invitation.
const RC_VIDEO_INSTALLATION='https://youtu.be/wX0qTHqMMZY';
function _texteInvitationAthlete(c){
  // Le prenom se prend comme partout ailleurs dans cet ecran : le premier mot
  // du nom saisi par le coach. Sans nom, la phrase se referme proprement
  // plutot que de trainer une virgule vide.
  const prenom=String((c&&c.studentName)||'').trim().split(' ')[0];
  // DEDUIT, JAMAIS CODE EN DUR — meme regle que le QR. Servie hors de
  // l'hebergement Firebase, la reecriture /i n'existe pas et RC_LIEN_COURT
  // rend l'adresse longue : un lien mort dans une invitation ne se rattrape
  // pas, l'athlete est deja parti.
  const lien=RC_LIEN_COURT;
  // LE TEXTE DE KEVIN, MOT POUR MOT (29/09/2026). Seuls le prenom, le code et
  // le lien court sont remplis ici.
  return [
    'Bienvenue dans la team'+(prenom?' '+prenom:'')+' 💪',
    'Ton accès RepCore est prêt : ton programme, ta nutrition et ton suivi avec moi, tout au même endroit.',
    'Tout est expliqué en 2 minutes ici (installation + premier bilan) : '+RC_VIDEO_INSTALLATION,
    '1️⃣ Ouvre ce lien 👇',
    lien,
    '(Ouvre-le dans Safari (iPhone) ou Chrome (Android), PAS dans Instagram.)',
    '2️⃣ Installe l\'app : le bouton te la propose direct (sur iPhone : Partager, puis "Sur l\'écran d\'accueil").',
    // ⚠ LE CODE EST NU, SANS PARENTHESES, ET EN FIN DE LIGNE. Il est colle tel
    // quel dans le champ de l'athlete, et _lierCoach ne retire que les
    // ESPACES : « (RC-XXXX) » serait cherche avec ses parentheses et rendrait
    // « code introuvable ».
    '3️⃣ L\'app te demande ton code : '+String((c&&c.token)||''),
    '',
    'Le code est obligatoire, ensuite, remplis ton bilan de départ (une dizaine de minutes) et écris moi "BILAN FAIT" : ton programme sera prêt sous 24 h'
  ].join('\n');
}
function _copierInvitationAthlete(i){
  const c=currentUser.studentCodes&&currentUser.studentCodes[i];
  if(!c) return;
  _rcCopier(_texteInvitationAthlete(c)).then(ok=>{
    // ON NE DIT « COPIE » QUE SI CA L'EST. Un accuse de reception faux fait
    // coller dans le vide — ici, envoyer un message vide a un athlete qui
    // attend son acces, et ne s'en apercevoir que par son silence.
    if(ok) toast('Invitation copiée : colle-la dans WhatsApp','var(--green)');
    else toast('Copie refusée par le navigateur. Réessaie, ou copie le code à la main.','var(--orange)');
  });
}

// ═══════════════════════════════════════════════════
// ATHLETE: Subscribe page
// Départ vers l'inscription DEPUIS l'écran d'abonnement. L'intention est
// mémorisée en sessionStorage — pas en variable : l'inscription authentifie
// auprès de Firebase, et un rechargement en cours de route perdrait le fil.
function goRegisterPourSouscrire(){
  try{sessionStorage.setItem('rc_apres_inscription','s-subscribe');}catch(e){}
  go('s-register');selectRole('athlete',true);
}
// ═══════════════════════════════════════════════════
// ── Paliers d'abonnement : rendu et sélection ───────────────────────────────
// Un seul palier disponible : on n'affiche aucun sélecteur, seulement le prix.
// Proposer un « choix » entre une option et rien serait du décor.
function _renderSubPaliers(){
  const zone=document.getElementById('sub-paliers');
  if(!zone) return;
  try{ _subAnnoncerFormule(); }catch(e){}
  const dispo=_paliersDispo();
  if(!dispo.length){zone.innerHTML='';return;}
  // Le palier retenu doit toujours exister : si l'annuel disparaît (constante
  // vidée) alors qu'il était sélectionné, on retombe sur le premier disponible.
  // Le palier COACH en attente est celui qu’on présélectionne : le coach
  // vient de le choisir sur son écran, le lui redemander serait le perdre.
  const _pc=_palierCoachEnAttente();
  if(_pc&&dispo.some(p=>p.cle===_pc)) _subPalier=_pc;
  if(!_subPalier||!dispo.some(p=>p.cle===_subPalier)) _subPalier=dispo[0].cle;
  if(dispo.length===1){
    const p=dispo[0];
    zone.innerHTML='<div style="font-size:var(--fs-xl);font-weight:900;color:var(--red-text);line-height:1">'
      +escapeHtml(_prixPalier(p))+'<span style="font-size:var(--fs-sm);color:var(--sub);font-weight:600"> '
      +escapeHtml(p.periode)+'</span></div>';
    return;
  }
  zone.innerHTML=dispo.map(p=>{
    const sel=p.cle===_subPalier;
    return `<div onclick="_choisirPalier('${p.cle}')" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
      style="flex:1;position:relative;cursor:pointer;border:2px solid ${sel?'var(--red)':'var(--border)'};
      background:${sel?'rgba(224,32,32,.08)':'transparent'};border-radius:var(--r-3);padding:14px 12px;
      text-align:center;transition:border-color var(--t-1),background var(--t-1);min-height:44px">
      ${p.remise?`<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);
        background:var(--green);color:#04210d;font-size:var(--fs-xs);font-weight:900;
        padding:2px 8px;border-radius:var(--r-4);letter-spacing:.5px;white-space:nowrap">${escapeHtml(p.remise)}</div>`:''}
      <div style="font-size:var(--fs-xs);color:${sel?'var(--red)':'var(--sub)'};font-weight:800;
        text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${escapeHtml(p.titre)}</div>
      <div style="font-size:var(--fs-xl);font-weight:900;color:var(--text);line-height:1">${escapeHtml(_prixPalier(p))}</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">${escapeHtml(p.periode)}</div>
      <div style="font-size:var(--fs-xs);color:${p.econ?'var(--green)':'var(--sub)'};margin-top:6px;
        font-weight:${p.econ?'800':'400'}">${escapeHtml(p.econ||p.detail)}</div>
    </div>`;
  }).join('');
}
// CE QUE L'ECRAN ANNONCE, AVANT SES TARIFS (lot 11).
//
// Trois cas, et le troisieme est celui qui manquait :
//   1. On a choisi Essentielle : rien a dire, l'ecran est le sien.
//   2. On a choisi Ultime et ses plans existent : il nomme Ultime.
//   3. On a choisi Ultime et ses plans n'existent pas encore : IL LE DIT, et
//      il dit ce qui reste possible tout de suite. Presenter Essentielle en
//      silence a quelqu'un qui a demande Ultime, c'est lui faire payer autre
//      chose que ce qu'il a demande.
function _subAnnoncerFormule(){
  const z=document.getElementById('sub-formule');
  if(!z) return false;
  if(_palierCoachEnAttente()){ z.innerHTML=''; return false; }
  const cle=subOffreChoisie();
  if(cle!=='ultime'){ z.innerHTML=''; return false; }
  const payable=subPaliersDe('ultime').some(p=>!!p.planId());
  if(payable){
    z.innerHTML='<div class="sub-form-t">Ultime</div>'
      +'<div class="sub-form-s">Le catalogue d’exercices, la charge de ton bloc, '
      +'ta diète calculée et tes compléments.</div>';
    return true;
  }
  z.innerHTML='<div class="sub-form-t">Ultime</div>'
    +'<div class="sub-form-s">Le paiement d’Ultime n’est pas encore ouvert ici. '
    +'Ce qui se règle dans l’application aujourd’hui, c’est Essentielle, à '
    +escapeHtml(prixOffre('essentielle'))+' par mois. Écris-moi et je t’ouvre Ultime.</div>'
    +'<a class="sub-form-b" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
    +'Me contacter</a>';
  return true;
}
// PRENDRE CE QUI SE PAIE VRAIMENT. On ne change pas d'avis a la place de la
// personne : c'est un bouton, elle le prend ou elle ne le prend pas.
function subPrendreEssentielle(){
  try{ sessionStorage.setItem('rc_offre_choisie','essentielle'); }catch(e){}
  _subPalier='';
  loadSubscribePage();
  return true;
}
function _choisirPalier(cle){
  _subPalier=cle;
  _renderSubPaliers();
  _majBoutonSouscrire();
}
// Le libellé du bouton suit la sélection : il doit annoncer exactement ce qui
// sera débité, sans quoi l'athlète découvre le montant sur l'écran PayPal.
function _majBoutonSouscrire(){
  const b=document.getElementById('paypal-loading-btn');
  if(!b) return;
  const p=_paliersDispo().find(x=>x.cle===_subPalier)||_paliersDispo()[0];
  if(p) b.textContent='Souscrire pour '+_prixPalier(p)+' '+p.periode+' →';
}
function _planIdChoisi(){
  const p=_paliersDispo().find(x=>x.cle===_subPalier)||_paliersDispo()[0];
  return p?p.planId():'';
}
// PURE. LA FORMULE QU'UN PLAN PAYPAL FACTURE, lue sur l'identifiant lui-meme.
//
// ⚠ ON NE SE FIE PAS A CE QU'ON A CHOISI A L'ECRAN, mais a ce qui a ete
//   FACTURE : entre le choix et le paiement, on a pu changer d'avis, revenir
//   en arriere, ou arriver par un autre chemin. L'identifiant du plan, lui,
//   est celui que PayPal a debite.
function formuleDuPlan(planId){
  const id=String(planId||'');
  if(!id) return '';
  if(id===PAYPAL_PLAN_ID_ULTIME||id===PAYPAL_PLAN_ID_ULTIME_ANNUEL
     ||id===PAYPAL_PLAN_ID_ULTIME_DEMI) return 'ultime';
  if(id===PAYPAL_PLAN_ID||id===PAYPAL_PLAN_ID_ANNUEL) return 'essentielle';
  // ET LES DEUX FORMULES DU COACH (24/09/2026). Elles n'ouvrent aucun palier
  // d'acces — un coach a le sien par son role — mais le dossier doit dire ce
  // qui a ete facture. Sans ces deux lignes, subOffreChoisie prenait le relais
  // et ecrivait « essentielle » dans le dossier d'un coach qui vient de payer
  // 39 euros : un champ faux, que personne ne lit aujourd'hui et que
  // quelqu'un lira un jour.
  if(id===PAYPAL_PLAN_ID_COACH) return 'coach';
  if(id===PAYPAL_PLAN_ID_PRO) return 'pro';
  return '';
}
// SANS COMPTE, s-client-code EST UN PIÈGE : doLinkCoach y lit currentUser.fname
// dès sa première branche réelle, ce qui lève une TypeError sur un visiteur.
// s-athlete-entry fait le chemin complet — le code PUIS la création du compte —
// et c'est le seul écran qui sache le faire.
function _subOuvrirCode(){
  go(currentUser?'s-client-code':'s-athlete-entry');
}
function loadSubscribePage(mode,payload){
  // LE PALIER COACH EN ATTENTE NE SURVIT PAS À UN CHANGEMENT DE COMPTE.
  //
  // `rc_palier_coach` était posée par souscrireCoach et retirée par personne.
  // Un coach qui ouvrait cet écran, renonçait, puis basculait sur son compte
  // athlète se voyait facturer le plan COACH : _planIdChoisi lit la table que
  // cette clef désigne, et elle vivait jusqu’à la fermeture de l’onglet.
  //
  // EN TÊTE DE FONCTION, avant _renderSubPaliers : rendre les cartes puis
  // retirer la clef laisserait à l’écran les paliers qu’on vient de désavouer.
  if(!(currentUser&&currentUser.role==='coach')){
    try{sessionStorage.removeItem('rc_palier_coach');}catch(e){}
  }
  // La case est REMISE À SON ÉTAT STOCKÉ à chaque ouverture, et cet état est
  // faux par défaut. Elle n'est jamais cochée par le code.
  try{
    const t=document.getElementById('sub-renonc-txt');
    if(t) t.textContent=RENONC_TEXTE;
    const c=document.getElementById('sub-renonciation');
    if(c) c.checked=renonciationRetractation(currentUser).accepte;
    _majBoutonPaypal();
  }catch(e){}
  // L'écran est atteignable sans compte : c'est justement là que le prix doit
  // être visible avant toute inscription. Mais PayPal ne peut pas être lancé
  // dans cet état — onApprove écrit dans currentUser, qui vaut null. On propose
  // donc la création de compte, et l'abonnement se souscrit juste après.
  const _pp=document.getElementById('paypal-btn-container');
  rcmVue('subscribe_viewed');
  // Les paliers sont rendus AVANT le test de connexion : le prix doit être
  // visible même sans compte, c'est justement le rôle de cet écran.
  _renderSubPaliers();
  // AVANT le retour anticipé du visiteur sans compte : cet écran-là doit lui
  // aussi retrouver l’argumentaire, sinon il resterait masqué pour l’athlète
  // suivant de la même session.
  const _argsAth=document.getElementById('sub-args-athlete');
  if(_argsAth) _argsAth.style.display=_palierCoachEnAttente()?'none':'';
  if(!currentUser){
    // goRegisterPourSouscrire pose l'intention de retour : après création du
    // compte, doRegister ramène ici au lieu d'envoyer vers l'écran de code.
    if(_pp) _pp.innerHTML='<button class="btn btn-red" onclick="goRegisterPourSouscrire()">Créer mon compte pour souscrire →</button>'
      +'<div style="font-size:var(--fs-xs);color:var(--sub);text-align:center;margin-top:10px;line-height:1.6">Le paiement se fait juste après, en une étape.</div>';
    // LE VERROU EST LEVÉ EXPLICITEMENT. _majBoutonPaypal vient de le poser
    // quelques lignes plus haut, sur la foi d'un renoncement absent — et il
    // l'est forcément, puisqu'il se stocke dans un dossier qui n'existe pas.
    // Sans ces deux lignes, le bouton de création qu'on vient d'injecter dans
    // ce conteneur est mort au toucher : le visiteur appuie, rien ne bouge.
    if(_pp){ _pp.style.opacity='1'; _pp.style.pointerEvents='auto'; }
    _subAfficherRenonciation(false);
    const _co=document.getElementById('sub-code-option');
    if(_co) _co.style.display='';
    const _pi=document.getElementById('sub-pending-info');
    if(_pi) _pi.style.display='none';
    return;
  }
  // Le compte existe : le renoncement redevient obligatoire et visible. Le
  // remontrer n'est pas de la symétrie décorative — sans compte on l'a masqué,
  // et le parcours nominal repasse ici juste après la création.
  _subAfficherRenonciation(true);
  _majBoutonPaypal();
  // ⚠ AUCUN BOUTON DE PAIEMENT QUAND AUCUN TARIF N'EST FACTURABLE (lot 11).
  //   Le bouton appelait initPaypalSubscription, qui retombait sur le mensuel
  //   d'Essentielle faute de mieux : quelqu'un qui demande Ultime se serait
  //   fait debiter autre chose que ce qu'il a demande. A la place, la seule
  //   chose vraie : ce qui se paie aujourd'hui.
  // ⚠ UN ABONNEMENT COURT DÉJÀ (02/10/2026) : aucun bouton de souscription,
  //   « Changer de formule » à la place. Souscrire de nouveau faisait payer
  //   deux abonnements, l'ancien continuant d'être prélevé.
  if(abonnementEnCours(currentUser)){
    _pp.innerHTML=htmlChangerFormule(currentUser,_planIdChoisi());
  }else if(!_paliersDispo().length){
    _pp.innerHTML=(subOffreChoisie()==='ultime')
      ?'<button class="btn btn-outline" onclick="subPrendreEssentielle()">'
        +'Prendre Essentielle à '+escapeHtml(prixOffre('essentielle'))+' par mois</button>'
      :'<div class="bq-note">Aucun abonnement n’est ouvert au paiement pour le moment.</div>';
  }else{
    _pp.innerHTML='<button class="btn btn-red" onclick="initPaypalSubscription()" id="paypal-loading-btn">Souscrire</button>';
    // Ecrit apres l insertion : le bouton doit exister pour recevoir son libelle.
    _majBoutonSouscrire();
  }
  const codeOpt=document.getElementById('sub-code-option');
  const pendingInfo=document.getElementById('sub-pending-info');
  if(mode==='pending-code'&&payload){
    if(codeOpt) codeOpt.style.display='none';
    if(pendingInfo){
      pendingInfo.style.display='';
      pendingInfo.innerHTML='<div style="background:#0a1a0a;border:1px solid #1a3a1a;border-radius:var(--r-3);padding:14px;margin-bottom:14px;font-size:var(--fs-sm);line-height:1.7">Code de <strong>'+escapeHtml(payload.coachName||'ton coach')+'</strong> reconnu '+icon('coche',14)+'<br><br>Pour finaliser ton accès à l\'app, souscris à l\'abonnement ci-dessous.</div>';
    }
  } else {
    if(codeOpt) codeOpt.style.display='';
    if(pendingInfo) pendingInfo.style.display='none';
    sessionStorage.removeItem('pendingCodePayload');
  }
  // « Entrer mon code coach » N A PAS DE SENS POUR UN COACH : c’est lui qui
  // les distribue. En DERNIER, parce que les deux branches ci-dessus viennent
  // de décider de cette carte et écraseraient la décision prise plus haut.
  if(_palierCoachEnAttente()&&codeOpt) codeOpt.style.display='none';
}
function initPaypalSubscription(){
  // Défense en profondeur : le SDK ne doit jamais être chargé sans compte, même
  // si un appel arrivait par un autre chemin que le bouton de loadSubscribePage.
  if(!currentUser){
    toast('Crée ton compte avant de souscrire.','var(--orange)');
    go('s-register');selectRole('athlete',true);
    return;
  }
  const clientId=PAYPAL_CLIENT_ID;
  // Le plan facture est celui que l athlete a choisi a l ecran, jamais une
  // constante figee : sans cela, selectionner l annuel debiterait le mensuel.
  //
  // ⚠ ET LE REPLI SUR PAYPAL_PLAN_ID A DISPARU (lot 11). Il facturait le
  //   mensuel d'Essentielle des que le plan choisi n'existait pas — donc a
  //   qui demandait Ultime. On ne devine pas ce que quelqu'un veut payer.
  // DÉFENSE EN PROFONDEUR : un abonnement court déjà, ce chemin ne charge pas
  // PayPal, quel que soit le bouton qui l'a appelé.
  if(abonnementEnCours(currentUser)){ loadSubscribePage(); return; }
  const planId=_planIdChoisi();
  if(!planId){
    toast('Ce tarif n’est pas encore ouvert au paiement.','var(--orange)');
    return;
  }
  const coachId=CREATOR_EMAIL;
  const _ppCon=document.getElementById('paypal-btn-container');
  if(_ppCon) _ppCon.innerHTML='<div class="skeleton fx-loop" style="height:55px;border-radius:var(--r-2)"></div>';
  // Load PayPal SDK dynamically
  if(document.getElementById('paypal-sdk')){
    renderPaypalButton(planId,coachId);return;
  }
  const script=document.createElement('script');
  script.id='paypal-sdk';
  // ⚠ LE SDK NE DEMANDAIT RIEN, DONC PAYPAL DECIDAIT SEUL (corrige au lot 5).
  //   `enable-funding=card` demande explicitement le paiement par carte sans
  //   compte PayPal. L'argent arrive sur le meme compte : PayPal encaisse la
  //   carte et reverse, il n'y a rien a changer cote encaissement.
  script.src='https://www.paypal.com/sdk/js?client-id='+clientId
    +'&vault=true&intent=subscription&currency=EUR&enable-funding=card';
  script.onload=()=>renderPaypalButton(planId,coachId);
  script.onerror=()=>{toast('Erreur chargement PayPal. Vérifie la connexion.');if(_ppCon)_ppCon.innerHTML='<button class="btn btn-red" onclick="initPaypalSubscription()" id="paypal-loading-btn">Réessayer →</button>';};
  document.head.appendChild(script);
}
function renderPaypalButton(planId,coachId){
  const container=document.getElementById('paypal-btn-container');
  // Acceptation des CGV, DISTINCTE du consentement RGPD de l'inscription : les
  // deux n'ont pas le meme objet. Le consentement RGPD porte sur un traitement
  // de donnees, celui-ci sur un engagement contractuel et un prelevement
  // reconduit. Les fusionner priverait chacun de sa validite.
  // Le bouton PayPal n'est pas seulement masque : createSubscription refuse
  // aussi, pour qu'aucun chemin ne contourne la case.
  container.innerHTML=
    '<label for="cgv-ok" style="display:flex;gap:10px;align-items:flex-start;'
    +'background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-3);'
    +'padding:14px 16px;margin-bottom:16px;cursor:pointer;text-align:left">'
    +'<input type="checkbox" id="cgv-ok" style="margin-top:4px;flex-shrink:0;'
    +'width:18px;height:18px;accent-color:var(--red);cursor:pointer">'
    +'<span style="font-size:var(--fs-sm);line-height:1.6;color:var(--sub)">'
    +"J'ai lu et j'accepte les <a href=\"../terms.html\" target=\"_blank\" rel=\"noopener\">"
    +"conditions générales de vente</a>. Je demande l'accès immédiat au service et "
    +"reconnais qu'à ce titre je perds mon droit de rétractation de 14 jours une fois "
    +"le contenu numérique fourni.</span></label>"
    +'<div id="paypal-buttons-inner" style="display:none">'
    +'<div id="pp-abo"></div>'
    +'<div id="pp-carte-lib" style="display:none;margin:10px 0 6px;font-size:var(--fs-xs);'
    +'color:var(--sub);text-align:left">Payer par carte bancaire, sans compte PayPal</div>'
    +'<div id="pp-carte"></div></div>';
  const _cgv=document.getElementById('cgv-ok');
  const _inner=document.getElementById('paypal-buttons-inner');
  _cgv.addEventListener('change',()=>{_inner.style.display=_cgv.checked?'':'none';});
  if(typeof paypal==='undefined'){toast('PayPal non charge');return;}
  // ══ LES OPTIONS SONT NOMMEES : DEUX BOUTONS S'EN SERVENT (lot 5) ══════
  // Celui de PayPal, et celui de la carte bancaire. Le meme abonnement, le
  // meme plan, la meme confirmation : seul le moyen de paiement change.
  const _optsAbo={
    style:{layout:'vertical',color:'black',shape:'rect',label:'subscribe'},
    createSubscription:function(data,actions){
      // Deuxieme verrou : masquer ne suffit pas, un clic programmatique
      // contournerait l'affichage.
      // TROISIÈME VERROU : un abonnement court déjà (statut relu à l'instant).
      if(abonnementEnCours(currentUser)){
        toast('Tu as déjà un abonnement : change de formule plutôt que d’en prendre un second.','var(--orange)');
        throw new Error('abonnement deja en cours');
      }
      const ok=document.getElementById('cgv-ok');
      if(!ok||!ok.checked){
        toast('Accepte les conditions générales avant de payer','var(--orange)');
        throw new Error('CGV non acceptees');
      }
      // Après le verrou CGV : un clic bloqué par la case non cochée n'est pas
      // une intention de payer aboutie, et le compter masquerait justement le
      // frottement que cette étape sert à détecter.
      rcm('paypal_clicked');
      sessionStorage.setItem('rc_paypal_return','1');
      // LE COMPTE VOYAGE AVEC L'ABONNEMENT : custom_id est ce que le serveur
      // léger relit chez PayPal pour savoir à qui il appartient, jamais
      // l'adresse du payeur.
      return actions.subscription.create({'plan_id':planId,'custom_id':_cleComptePaypal()});
    },
    onApprove:async function(data){
      const pendingStr=sessionStorage.getItem('pendingCodePayload');
      const pending=pendingStr?JSON.parse(pendingStr):null;
      toast('Vérification du paiement…');
      const _estCoach=_palierEstCoach(_subPalier);
      try{
        // ══ L'APP N'ACTIVE PLUS RIEN ELLE-MEME (30/09/2026) ═══════════════
        // status, paymentStatus, coachPlan et abonnement/formule sont geles
        // par les regles : c'est le webhook PayPal, au Worker, qui ouvre
        // droits/ (athlete) ou coachs_registre/ (coach) apres avoir relu
        // l'abonnement chez PayPal. L'app garde l'identifiant de l'abonnement
        // (le Worker s'en sert pour savoir a qui il est), la periode choisie,
        // puis ATTEND le serveur : voir _attendreActivation.
        // L'ANCIEN ABONNEMENT, S'IL Y EN AVAIT UN : signalé au serveur, qui
        // l'annule chez PayPal dès que le nouveau est ACTIVE (déjà annulé :
        // rien). Son engagement court toujours : il n'est pas remis à zéro.
        const _ancien=String(currentUser.paypalSubscriptionId||'');
        const _remplace=(_ancien&&_ancien!==data.subscriptionID)?_ancien:'';
        const _engAvant=Number(abonnementDe(currentUser).engagementJusqu)||0;
        currentUser.paypalSubscriptionId=data.subscriptionID;
        // Simple affichage : « paiement reçu, activation… » (paiementRecent).
        paiementRecentNoter(currentUser,'abonnement');
        if(_estCoach) currentUser.coachPlanSince=Date.now();
        // LE PALIER RETENU, A COTE DU STATUT. Sans lui, abonnement.palier
        // n était écrit nulle part et _renderAbonnement retombait toujours
        // sur « Mensuel » — y compris pour qui venait de payer un an.
        //
        // Object.assign et non une affectation : `abonnement` porte aussi
        // l échéance, la résiliation et le renoncement à la rétractation. Le
        // remplacer les effacerait.
        currentUser.abonnement=Object.assign({},currentUser.abonnement,
          {palier:_subPalier||'mensuel',
           // LA FORMULE N'EST PLUS ECRITE ICI (gelee) : le Worker la pose
           // d'apres le plan FACTURE, relu chez PayPal.
           // ⚠ LE TERME DE L'ENGAGEMENT, POSE UNE FOIS (24/09/2026). Douze mois
           //   a compter d'aujourd'hui : c'est la seule date de ce dossier qui
           //   ne vieillira jamais, parce qu'elle ne depend d'aucun evenement
           //   futur. `prochaineEcheance` avait ete ecartee pour cette raison
           //   exacte — personne ne peut la rafraichir a chaque prelevement,
           //   elle serait fausse des le deuxieme mois.
           //
           //   ⚠ POUR L'ATHLETE SEULEMENT : les formules coach se facturent au
           //     mois, sans duree, et un terme ecrit dans leur dossier
           //     promettrait un engagement que personne n'a pris.
           engagementJusqu:(_estCoach?undefined:(_remplace&&_engAvant>Date.now()?_engAvant:moisApres(Date.now(),TARIFS.engagementMois)))});
        rcm('subscription_activated');
        // LE SERVEUR APPREND QUEL ABONNEMENT EST À QUI : les avis de PayPal
        // (paiement, résiliation) ne portent que son identifiant.
        abonnementSignaler(data.subscriptionID,true,_remplace);
        try{ attribPremierPaiement(currentUser); }catch(e){}
        if(pending){
          currentUser.coachId=pending.coachId||currentUser.coachId||null;
          currentUser.coachName=pending.coachName||currentUser.coachName||'';
          // Meme raison que dans doLinkCoach : sans cette cle, database.rules.json
          // n'accorde au coach aucun droit de lecture sur le dossier. L'athlete
          // aurait paye et serait reste invisible pour lui.
          const _ck2=pending.coachEmailKey
            ||((pending.coachEmail||'').replace(/\./g,','))||null;
          if(_ck2) currentUser.coachEmailKey=_ck2;
          sessionStorage.removeItem('pendingCodePayload');
        }
        // Activation d'abonnement : c'est le pire moment pour un « ✓ » menteur,
        // l'athlète vient de payer et croirait son accès acquis sur l'appareil.
        // L INTENTION EST CONSOMMÉE. Sans ce retrait, la clef vivait jusqu’à
        // la fermeture de l’onglet et faisait facturer le plan coach au compte
        // suivant qui ouvrirait cet écran.
        try{sessionStorage.removeItem('rc_palier_coach');}catch(e){}
        saveUser();
        toast('Paiement reçu, activation…','var(--info)');
        const _actif=await _attendreActivation(_estCoach?{coach:_subPalier}:{});
        toast(_actif?'Abonnement activé ! Bienvenue sur RepCore '+ICO.coche
          :'Paiement reçu. L’activation prend plus de temps que prévu : elle apparaîtra d’elle-même, sans rien refaire.',
          _actif?'var(--green)':'var(--orange)');
        // UN COACH NE RENTRE PAS SUR L ACCUEIL ATHLÈTE. loadClientHome y lit
        // bilans, séances et nutrition d’un dossier qui n’en porte pas, et
        // l’aurait posé devant un écran qui ne le concerne pas juste après
        // avoir payé.
        if(_estCoach){ go('s-coach-home'); loadCoachHome(); }
        else loadClientHome();
      }catch(e){
        toast('Erreur d\'activation : '+(e.message||'Réessaie ou contacte le support.'),'var(--orange)');
      }
    },
    onError:function(err){
      toast('Erreur paiement. Réessaie.');
      console.error('PayPal error',err);
    }
  };
  paypal.Buttons(Object.assign({},_optsAbo,_paiementPayPalOptions(paypal))).render('#pp-abo');
  // LE BOUTON CARTE, EXPLICITE ET SOUS L'AUTRE. `isEligible` decide : si le
  // compte marchand ou le pays ne l'accepte pas, on n'affiche RIEN plutot
  // qu'un cadre vide — et le chemin PayPal, lui, reste entier.
  try{
    const carte=paypal.Buttons(Object.assign({},_optsAbo,_paiementCarteOptions(paypal)));
    if(carte.isEligible&&carte.isEligible()){
      const lib=document.getElementById('pp-carte-lib');
      if(lib) lib.style.display='';
      carte.render('#pp-carte');
    }
  }catch(e){}
}
// ══════════════ UI DE CLASSIFICATION MUSCULAIRE ══════════════

// Ligne « Muscles » sous le champ Reps de l'éditeur d'exercice.
// Primaires en pastilles pleines, secondaires en pastilles creuses : la
// hiérarchie doit se lire sans légende. Un rattachement trouvé tout seul est
// annoncé comme proposé, pour que le coach sache qu'il peut le corriger.
function _ligneMuscles(ex,i){
  const nom=ex&&ex.name;
  if(!nom||!String(nom).trim()) return '';
  if(isCardio(ex)) return '';
  const r=resoudreMuscles(nom,ex);
  const past=(g,plein)=>{
    const m=MUSCLES[g]; if(!m) return '';
    return `<span style="display:inline-block;padding:4px 10px;border-radius:var(--r-2);font-size:var(--fs-xs);font-weight:800;letter-spacing:.3px;white-space:nowrap;`
      +(plein?`background:${m.c};color:#08080a;border:1px solid ${m.c}`
             :`background:transparent;color:${m.c};border:1px solid ${m.c}`)+`">${m.lib}</span>`;
  };
  const corps=r
    ? [...r.p.map(g=>past(g,true)),...r.s.map(g=>past(g,false))].join(' ')
      +(r.src==='auto'?`<span style="color:var(--text-dim);font-size:var(--fs-xs);margin-left:6px">proposé, à corriger</span>`:'')
    : `<span style="color:var(--orange);font-size:var(--fs-xs);font-weight:700">Non classé, appuie pour choisir</span>`;
  // 01/10/2026 : le titre est un libellé de champ, AU-DESSUS de la case, comme
  // Tempo et Matériel à sa gauche : les trois cases de la ligne s'alignent.
  return `<div class="px-musc" onclick="ouvrirSelecteurMuscles(${i})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <label style="margin-top:0;cursor:pointer">Muscles</label>
    <div class="px-musc-c">${corps}</div>
  </div>`;
}

// Sélecteur : deux colonnes, primaire et secondaire, sur les 17 groupes.
// Un même groupe ne peut pas être les deux à la fois — cocher d'un côté
// décoche de l'autre, sinon un exercice sortirait « pectoraux ET pectoraux ».
let _selMusclesIdx=null,_selMusclesP=[],_selMusclesS=[];
// UN TITRE ET UNE ECRITURE DE RECHANGE, pour la fiche coach (voir
// _coachClasserMuscles) : le selecteur ecrit sinon dans le dossier de
// l'utilisateur connecte. Remis a zero a chaque ouverture ordinaire, sans quoi
// une attribution coach annulee aurait detourne la suivante.
let _selMusclesTitre=null,_selMusclesEcrire=null;
function ouvrirSelecteurMuscles(i){
  const ex=progEx[i]; if(!ex||!ex.name) return;
  _selMusclesTitre=null; _selMusclesEcrire=null;
  const r=resoudreMuscles(ex.name,ex);
  _selMusclesIdx=i; _selMusclesP=r?r.p.slice():[]; _selMusclesS=r?r.s.slice():[];
  _rendreSelecteurMuscles(escapeHtml(ex.name));
}
function _rendreSelecteurMuscles(titre){
  const lignes=Object.keys(MUSCLES).map(g=>{
    const m=MUSCLES[g],p=_selMusclesP.includes(g),s=_selMusclesS.includes(g);
    const b=(actif,col,lbl,fn)=>`<button onclick="${fn}('${g}')" style="flex:1;padding:8px 4px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;`
      +(actif?`background:${col};color:#08080a;border:1px solid ${col}`:`background:transparent;color:var(--text-dim);border:1px solid var(--border)`)+`">${lbl}</button>`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #161616">
      <span style="flex:1;min-width:0;font-size:var(--fs-sm);font-weight:700;color:${(p||s)?'var(--text)':'var(--sub)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.lib}</span>
      <div style="display:flex;gap:6px;flex:0 0 122px">${b(p,m.c,'PRIM.','_selMusclePrim')}${b(s,m.c,'SEC.','_selMuscleSec')}</div>
    </div>`;
  }).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
    <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column">
      <h2 style="margin-bottom:2px;font-size:var(--fs-lg)">Muscles travaillés</h2>
      <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.5">${titre}</p>
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;margin-bottom:12px">${lignes}</div>
      <button class="btn btn-red" onclick="_validerSelecteurMuscles()">Enregistrer</button>
      <button class="btn btn-outline" style="margin-top:8px" onclick="closeModal()">Annuler</button>
    </div></div>`;
  const old=document.getElementById('modal-overlay'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',html);
}
function _selMusclePrim(g){
  _selMusclesS=_selMusclesS.filter(x=>x!==g);
  _selMusclesP=_selMusclesP.includes(g)?_selMusclesP.filter(x=>x!==g):[..._selMusclesP,g];
  _rendreSelecteurMuscles(_selMusclesTitre||escapeHtml(progEx[_selMusclesIdx]?.name||''));
}
function _selMuscleSec(g){
  _selMusclesP=_selMusclesP.filter(x=>x!==g);
  _selMusclesS=_selMusclesS.includes(g)?_selMusclesS.filter(x=>x!==g):[..._selMusclesS,g];
  _rendreSelecteurMuscles(_selMusclesTitre||escapeHtml(progEx[_selMusclesIdx]?.name||''));
}
function _validerSelecteurMuscles(){
  if(typeof _selMusclesEcrire==='function'){
    if(!_selMusclesP.length) return toast('Choisis au moins un muscle principal','var(--orange)');
    const f=_selMusclesEcrire; _selMusclesEcrire=null; _selMusclesTitre=null;
    f({p:_selMusclesP.slice(),s:_selMusclesS.slice(),src:'manuel'});
    return;
  }
  const ex=progEx[_selMusclesIdx]; if(!ex) return closeModal();
  if(!_selMusclesP.length) return toast('Choisis au moins un muscle principal','var(--orange)');
  const k=resoudreAlias(exKey(ex.name));
  // src:'manuel' : resoudreMuscles rend cette entrée telle quelle et ne la
  // recalcule jamais, quelle que soit l'évolution du guide ou des règles.
  _ecrireMuscles(k,{p:_selMusclesP.slice(),s:_selMusclesS.slice(),src:'manuel'});
  _exAClasser.delete(k);
  saveUser();
  closeModal();
  // Le sélecteur sert aussi à l'écran de tri : chacun reprend la main
  // sur son propre rendu plutôt que de forcer celui de l'éditeur.
  if(typeof _apresSelecteur==='function'){const f=_apresSelecteur;_apresSelecteur=null;f();return;}
  renderProgEx();
}

// ══════════════ ÉCRAN « EXERCICES À CLASSER » ══════════════
// Balaie tout ce que l'utilisateur possède — programmes configurés, modèles
// coach, et l'historique des séances — pour lister ce qui n'a pas trouvé de
// rattachement. La liste est DÉRIVÉE : rien n'est persisté, elle se
// reconstruit à chaque ouverture et suit donc les corrections en direct.
function _collecterExercices(){
  const vus=new Map();   // exKey -> { nom d'origine, nb de séances }
  const noter=(nom,nb)=>{
    if(!nom||!String(nom).trim()) return;
    const k=resoudreAlias(exKey(nom)); if(!k) return;
    const e=vus.get(k)||{nom,seances:0};
    e.seances+=nb||0;
    vus.set(k,e);
  };
  (currentUser.sessions_config||[]).forEach(s=>(s.exercises||[]).forEach(e=>noter(e.name,0)));
  (currentUser.coachPrograms||[]).forEach(p=>['sessions_H','sessions_F'].forEach(g=>
    (p[g]||[]).forEach(s=>(s.exercises||[]).forEach(e=>noter(e.name,0)))));
  (currentUser.sessions||[]).forEach(s=>Object.keys(s.data||{}).forEach(n=>noter(n,1)));
  return vus;
}
function loadExClassify(){
  goAvecRetour('s-ex-classify');
  const el=document.getElementById('exc-corps'); if(!el) return;
  const vus=_collecterExercices();
  const aClasser=[];
  for(const [k,e] of vus){
    // On passe l'exercice tel qu'on le connaît pour que le cardio soit écarté.
    const ex=_exemplaireExercice(k)||{reps:''};
    if(isCardio(ex)) continue;
    if(!resoudreMuscles(e.nom,ex)) aClasser.push({k,...e});
  }
  aClasser.sort((a,b)=>b.seances-a.seances||a.nom.localeCompare(b.nom));
  if(!aClasser.length){
    el.innerHTML=emptyState('check','Tous tes exercices sont classés.',null,null,'padding:32px 0');
    return;
  }
  el.innerHTML=`<p class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:16px">${aClasser.length} exercice${aClasser.length>1?'s':''} sans muscle rattaché. Classe-les, ou fusionne un doublon avec l'exercice qu'il désigne vraiment pour lui rendre son historique de charge.</p>`
    +aClasser.map(a=>`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:10px">
      <div style="font-weight:800;font-size:var(--fs-md);margin-bottom:4px">${escapeHtml(a.nom)}</div>
      <div class="sub" style="font-size:var(--fs-xs);margin-bottom:10px">${a.seances?a.seances+' séance'+(a.seances>1?'s':''):'jamais réalisé'}</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="_classerDepuisFile('${escapeHtml(a.k).replace(/'/g,"\'")}')">Classer</button>
        <button class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="ouvrirFusion('${escapeHtml(a.k).replace(/'/g,"\'")}')">Fusionner avec…</button>
      </div>
    </div>`).join('');
}
// Retrouve un exemplaire de l'exercice pour disposer de ses reps (test cardio).
function _exemplaireExercice(k){
  const sources=[...(currentUser.sessions_config||[]),
    ...(currentUser.coachPrograms||[]).flatMap(p=>[...(p.sessions_H||[]),...(p.sessions_F||[])])];
  for(const s of sources) for(const e of (s.exercises||[]))
    if(resoudreAlias(exKey(e.name))===k) return e;
  return null;
}
// Classer depuis la file : on réutilise le sélecteur de l'éditeur en lui
// fabriquant un exercice temporaire, plutôt que d'en écrire un second.
function _classerDepuisFile(k){
  _selMusclesTitre=null; _selMusclesEcrire=null;
  const ex=_exemplaireExercice(k)||{name:k,reps:''};
  progEx=[ex]; _selMusclesIdx=0;
  const r=resoudreMuscles(ex.name,ex);
  _selMusclesP=r?r.p.slice():[]; _selMusclesS=r?r.s.slice():[];
  _rendreSelecteurMuscles(escapeHtml(ex.name));
  _apresSelecteur=()=>{progEx=[];loadExClassify();};
}
let _apresSelecteur=null;

// Fusion : « ce nom désigne en réalité cet exercice-là ».
function ouvrirFusion(k){
  const vus=_collecterExercices();
  const cibles=[...vus.entries()].filter(([kk])=>kk!==k)
    .sort((a,b)=>b[1].seances-a[1].seances).slice(0,60);
  if(!cibles.length) return toast('Aucun autre exercice avec qui fusionner.','var(--orange)');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
    <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column">
      <h2 style="margin-bottom:2px;font-size:var(--fs-lg)">Fusionner</h2>
      <p class="sub" style="font-size:var(--fs-xs);margin-bottom:6px;line-height:1.5">« ${escapeHtml(k)} » désigne en réalité :</p>
      <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.5;color:var(--text-dim)">L'historique de charge des deux noms sera réuni. Rien n'est renommé ni effacé.</p>
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch">
        ${cibles.map(([kk,e])=>`<button onclick="_confirmerFusion('${escapeHtml(k).replace(/'/g,"\'")}','${escapeHtml(kk).replace(/'/g,"\'")}')" style="width:100%;text-align:left;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:12px 14px;margin-bottom:8px;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:700;cursor:pointer">
          ${escapeHtml(e.nom)}<span style="display:block;color:var(--sub);font-size:var(--fs-2xs);font-weight:400;margin-top:2px">${e.seances?e.seances+' séance'+(e.seances>1?'s':''):'jamais réalisé'}</span></button>`).join('')}
      </div>
      <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
    </div></div>`;
  const old=document.getElementById('modal-overlay'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',html);
}
function _confirmerFusion(de,vers){
  const r=ajouterAlias(de,vers);
  if(!r.ok){ toast(r.msg,'var(--orange)'); return; }
  saveUser(); closeModal(); loadExClassify();
  toast('Fusionné, historique réuni');
}

// Compte les exercices sans rattachement et n'affiche l'entrée que s'il y en a.
// Un lien « 0 exercice à classer » serait du bruit permanent dans l'interface.
function _nbExAClasser(){
  if(!currentUser) return 0;
  let n=0;
  for(const [k,e] of _collecterExercices()){
    const ex=_exemplaireExercice(k)||{reps:''};
    if(isCardio(ex)) continue;
    if(!resoudreMuscles(e.nom,ex)) n++;
  }
  return n;
}
function _majLiensClasser(){
  const n=_nbExAClasser();
  [['sm-lien-classer','sm-nb-classer'],['ccd-lien-classer','ccd-nb-classer']].forEach(([w,c])=>{
    const wrap=document.getElementById(w),cnt=document.getElementById(c);
    if(!wrap) return;
    wrap.style.display=n?'block':'none';
    if(cnt) cnt.textContent=n?'('+n+')':'';
  });
}

// ══════════════ DÉTECTION DE RENOMMAGE ══════════════
// Photographie des exKey à l'ouverture de l'éditeur. Comparée à la sortie,
// elle permet de proposer de conserver l'historique de charge quand un
// exercice a simplement changé de nom.
let _progExAvant=null;
function _photographierProgEx(){ _progExAvant=(progEx||[]).map(e=>exKey(e&&e.name)).filter(Boolean); }

// Appelée par saveProgram AVANT d'écrire progEx dans la séance.
// Un seul disparu et un seul apparu : le cas est net, on propose la fusion.
// Plusieurs des deux côtés : on ne devine pas, l'écran « à classer » est là
// pour ça.
function _detecterRenommage(){
  if(!_progExAvant) return;
  const avant=_progExAvant, apres=(progEx||[]).map(e=>exKey(e&&e.name)).filter(Boolean);
  _progExAvant=null;
  const disparus=avant.filter(k=>!apres.includes(k));
  const apparus =apres.filter(k=>!avant.includes(k));
  if(disparus.length!==1||apparus.length!==1) return;
  const [x]=disparus,[y]=apparus;
  // Rien à conserver si l'ancien nom n'a aucun historique.
  const aDeLHistorique=(currentUser.sessions||[]).some(s=>{
    const idx=_indexSessionData(s); return idx&&idx[x]!==undefined;
  });
  if(!aDeLHistorique) return;
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
    <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px">
      <h2 style="margin-bottom:8px;font-size:var(--fs-lg)">Même exercice ?</h2>
      <p class="sub" style="font-size:var(--fs-sm);line-height:1.65;margin-bottom:16px">
        « <strong style="color:var(--text)">${escapeHtml(x)}</strong> » a disparu et
        « <strong style="color:var(--text)">${escapeHtml(y)}</strong> » est apparu dans cette séance.<br><br>
        Répondre oui conserve l'historique de charge : les séries déjà réalisées sous l'ancien nom continueront d'alimenter la charge suggérée.
      </p>
      <button class="btn btn-red" onclick="_confirmerRenommage('${escapeHtml(x).replace(/'/g,"\'")}','${escapeHtml(y).replace(/'/g,"\'")}')">Oui, c'est le même</button>
      <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Non, ce sont deux exercices</button>
    </div></div>`;
  // Différée : saveProgram enchaîne sur un go() de sortie, et la modale posée
  // tout de suite s'afficherait par-dessus l'éditeur qu'on quitte.
  setTimeout(()=>{
    const old=document.getElementById('modal-overlay'); if(old) old.remove();
    document.body.insertAdjacentHTML('beforeend',html);
  },420);
}
function _confirmerRenommage(x,y){
  const r=ajouterAlias(x,y);
  closeModal();
  if(!r.ok) return toast(r.msg,'var(--orange)');
  saveUser();
  toast('Historique de charge conservé');
}

// ══════════════ CHOIX D'UN PROTOCOLE DANS L'ÉDITEUR ══════════════
// Trois suggestions par phase, plus l'accès à la liste complète. Choisir écrit
// le déroulé dans le champ texte existant : c'est lui que l'athlète verra, et
// un coach qui le retouche crée sa propre version sans toucher au protocole.
function _rendreSuggestionsProto(){
  const type=typeDeSeance(progEx);
  // LE PORTEUR, EXPLICITE. Cet écran sert le coach sur la fiche d’une
  // cliente autant que l’athlète sur son propre programme : `currentUser`
  // désignerait le mauvais dossier une fois sur deux.
  const _porteur=_porteurEditeurProto();
  const sug=suggestProtocols(
    {type},
    {antecedentLombaire:_aAntecedentLombaire(_porteur)},
    _porteur
  );
  for(const [phase,zone,champ] of [['warmup','proto-sug-warmup','prog-warmup'],
                                   ['cooldown','proto-sug-cooldown','prog-cooldown']]){
    const el=document.getElementById(zone); if(!el) continue;
    const actuel=(document.getElementById(champ)?.value||'').trim();
    // 01/10/2026 (Kevin) : SUR ORDINATEUR, LES TROIS SUGGESTIONS CÔTE À CÔTE,
    // en trois colonnes de même taille (.pr-grille), au lieu d'être empilées.
    // Sur téléphone et tablette, la grille ne fait rien : une carte par rang.
    el.innerHTML='<div class="pr-grille">'+sug[phase].map(p=>{
      const o=PROTO_OBJECTIFS[p.objectif]||{lib:p.objectif,c:'var(--sub)'};
      // Comparaison sur la ligne d'en-tête entière, pas sur un préfixe : deux
      // protocoles peuvent partager un début de nom.
      const pose=actuel&&actuel.split('\n')[0].trim()===protoTexte(p).split('\n')[0];
      const duree=p.dureeMin===p.dureeMax?p.dureeMin:p.dureeMin+' à '+p.dureeMax;
      // LA COULEUR DE L'OBJECTIF DESCEND PAR --c, ET RIEN D'AUTRE. Elle peint
      // le rail de gauche et le contour de la pastille ; elle ne remplit plus
      // celle-ci. Un aplat saturé sur fond noir a la luminosité d'un bouton :
      // il se lisait comme une action à faire, et surtout il passait devant le
      // nom du protocole, qui est pourtant ce qu'on vient lire.
      return `<button type="button" class="pr-carte"${pose?' data-pose':''} style="--c:${o.c}" onclick="_appliquerProto('${p.slug}','${champ}')">
        <div class="pr-haut">
          <span class="pr-nom">${escapeHtml(p.nom)}</span>
          <span class="pr-meta">
            <span class="pr-paire">
              <span class="pr-duree">${duree} min</span>
              <span class="pr-obj">${escapeHtml(o.lib.toUpperCase())}</span>
            </span>
            ${pose?'<span class="pr-pose">En place</span>':''}
          </span>
        </div>
        <div class="pr-desc">${escapeHtml(p.desc)}</div>
        ${p.contreInd.length?`<div class="pr-ci">À éviter si : ${escapeHtml(p.contreInd.map(c=>_PROTO_CI_LIB[c]||c).join(', '))}</div>`:''}
      </button>`;
    }).join('')+'</div>'
    +`<button type="button" class="pr-tous" onclick="ouvrirProtocoles('${phase==='warmup'?'WARMUP':'COOLDOWN'}','${champ}')">Voir tous les protocoles</button>`;
  }
  const t=document.getElementById('proto-type-seance');
  if(t) t.textContent=type?('Séance reconnue : '+_PROTO_TYPE_LIB[type]):'Type de séance indéterminé, suggestions générales';
}
const _PROTO_TYPE_LIB={PUSH:'poussée',PULL:'tirage',JAMBES_QUADRI:'jambes, quadriceps',
  JAMBES_HANCHE:'jambes, hanches',FULL_BODY:'full body',FORCE_MAX:'force',
  METABOLIQUE:'métabolique',CARDIO:'cardio',REPOS_ACTIF:'repos actif'};
const _PROTO_CI_LIB={DOS_LOMBAIRE:'dos',GENOU:'genou',EPAULE:'épaule',
  HANCHE:'hanche',CARDIO:'problème cardiaque',GROSSESSE:'grossesse'};

// Antécédent lombaire lu dans le texte libre du bilan. Sert UNIQUEMENT à
// remonter les protocoles de prévention dans la liste, jamais à en écarter :
// une lecture par mots-clés se trompe, et un protocole écarté à tort est
// invisible pour le coach.
// LE DOSSIER QUE L ÉDITEUR EST EN TRAIN DE SERVIR.
//
// `coachClient` : la cliente, jamais le coach — c’est SON post-partum et SES
//   antécédents qui décident, pas ceux de qui tient le téléphone.
// `template` : PERSONNE. Un modèle est réassignable à n’importe qui ;
//   le restreindre sur l’état d’un dossier serait faux dans les deux sens,
//   et le laisser complet est le seul choix qui ne ment pas.
// le reste : l’athlète sur son propre programme.
function _porteurEditeurProto(){
  const m=(typeof _progEditorCtx==='object'&&_progEditorCtx&&_progEditorCtx.mode)||null;
  if(m==='template') return null;
  if(m==='coachClient') return (typeof _coachEditClient!=='undefined'&&_coachEditClient)||null;
  return (typeof currentUser!=='undefined'&&currentUser)||null;
}
// `u` EXPLICITE, avec repli sur currentUser pour ne rien changer aux appels
// existants : lue depuis la fiche d’une cliente, cette fonction rendait
// jusqu’ici les antécédents du COACH.
function _aAntecedentLombaire(u){
  const _u=u||currentUser;
  const b=(_u&&_u.bilans)||[];
  const txt=b.map(x=>String(x['deb-health']||x['bil-health']||'')).join(' ').toLowerCase();
  return /lombaire|hernie|sciatique|lumbago|dos\b/.test(txt);
}

// REND UN BOOLEEN : true quand le texte a ete pose, false sur un refus ou une
// sortie anticipee. _pfUtiliser en avait besoin — il deduisait le resultat en
// comparant le contenu du champ, un test indirect qui lisait « refus » quand
// on reappliquait le protocole deja en place.
async function _appliquerProto(slug,champ){
  const p=protocole(slug); if(!p) return false;
  const el=document.getElementById(champ); if(!el) return false;
  const actuel=(el.value||'').trim();
  // Le texte écrit à la main n'est jamais écrasé sans confirmation : il peut
  // porter une consigne pour cet athlète-là. En revanche un texte issu d'un
  // protocole se remplace directement, sinon essayer les suggestions l'une
  // après l'autre demande une confirmation à chaque clic.
  if(actuel&&!_vientDunProtocole(actuel)&&!await rcConfirm('Remplacer le texte actuel par « '+p.nom+' » ?',null,'Remplacer')) return false;
  el.value=protoTexte(p);
  _progExDirty=true;
  // Provenance conservée, pour savoir plus tard d'où vient ce texte.
  if(champ==='prog-warmup') _protoChoisi.warmup=slug; else _protoChoisi.cooldown=slug;
  _rendreSuggestionsProto();
  toast(p.nom+' appliqué');
  return true;
}
let _protoChoisi={warmup:null,cooldown:null};

// Un texte vient d'un protocole si sa première ligne est « Nom (durée) » d'un
// protocole existant. On ne se fie pas à _protoChoisi : il est vide au
// rechargement de l'éditeur, alors que le texte, lui, est enregistré.
function _vientDunProtocole(txt){
  const l1=String(txt||'').trim().split('\n')[0].trim();
  // En-tête reconstruite via protoTexte, pour qu'un changement de format là-bas
  // n'ait pas à être répercuté ici.
  return tousProtocoles().some(p=>l1===protoTexte(p).split('\n')[0]);
}

// ── Checklist athlète, avec chrono par étape ────────────────────────────────
// Carte dépliable rendue à partir du texte de la séance. Les lignes numérotées
// « 1. … » écrites par un protocole deviennent une liste à cocher ; un texte
// libre saisi à la main reste affiché tel quel.
//
// Les coches vivent dans _ckEtat et non dans le DOM : sans ça, mettre la séance
// en pause pendant l'échauffement remettait tout à zéro au retour.
let _ckEtat={};
// `fin` EST UNE ÉCHÉANCE, pas un reste. Voir le commentaire de doctrine du
// minuteur de repos : un compteur décrémenté dérive de plusieurs dizaines de
// secondes, et s’arrête franchement écran verrouillé.
let _ckChrono=null;   // {cle, i, fin, id} — un seul chrono à la fois

// Durée d'une étape, en secondes, ou null si l'étape n'en annonce pas.
// Plancher à 20 s : en dessous ce n'est pas une étape à chronométrer mais une
// cadence (« inspiration 4 s »), et c'est là que se logeaient les faux
// positifs. La garde (?![a-zà-ÿ]) est indispensable : sans elle « 2 séries »
// se lisait « 2 s ».
const CK_SECONDES_MIN=20;
function dureeEtape(txt){
  const t=String(txt||'');
  let m=t.match(/(\d+)\s*min(?:utes?)?\s+(\d{1,2})\s*(?:s|sec|secondes?)?(?![a-zà-ÿ])/i);
  if(m) return _ckPlancher((+m[1])*60+(+m[2]));
  // Sur une fourchette on retient la borne BASSE : on peut toujours prolonger,
  // alors qu'un compte à rebours qui exige d'emblée le haut de la fourchette
  // décourage.
  m=t.match(/(\d+)(?:\s*(?:à|-|–)\s*\d+)?\s*min(?:utes?)?(?![a-zà-ÿ])/i);
  if(m) return _ckPlancher((+m[1])*60);
  m=t.match(/(\d+)(?:\s*(?:à|-|–)\s*\d+)?\s*(?:s|sec|secondes?)(?![a-zà-ÿ])/i);
  if(m) return _ckPlancher(+m[1]);
  return null;
}
function _ckPlancher(s){ return s>=CK_SECONDES_MIN?s:null; }
function _ckMMSS(s){ return Math.floor(s/60)+':'+String(Math.max(0,s%60)).padStart(2,'0'); }

function _ckCocher(cle,i,val){
  (_ckEtat[cle]=_ckEtat[cle]||{})[i]=!!val;
  // Cocher une étape en cours de chrono l'arrête : elle est faite.
  if(_ckChrono&&_ckChrono.cle===cle&&_ckChrono.i===i&&val) _ckStopChrono();
  _ckMajEntete(cle);
  if(typeof woPersist==='function') woPersist();
}
function _ckStopChrono(){
  if(!_ckChrono) return;
  clearInterval(_ckChrono.id);
  const b=document.getElementById('ck-chrono-'+_ckChrono.cle+'-'+_ckChrono.i);
  if(b){ b.textContent=b.dataset.libelle; b.classList.remove('ck-actif'); }
  _ckChrono=null;
}
// LE REPEINT, ISOLÉ DU DÉMARRAGE pour être appelable de l’extérieur : par
// l’intervalle et par le retour d’avant-plan. C’est le rôle de _peindreRepos
// côté minuteur de repos, et il est ici pour la même raison.
//
// LE RESTE EST RECALCULÉ, jamais retenu : c’est tout le lot. Un compteur
// décrémenté perd chaque tic que le navigateur ne lui donne pas, et l’écran
// verrouillé ne lui en donne plus aucun.
function _ckPeindreChrono(){
  if(!_ckChrono) return;
  const cle=_ckChrono.cle, i=_ckChrono.i;
  // Le bouton a disparu (changement d'écran, séance terminée) : on s'arrête
  // au lieu de faire tourner un intervalle sur un DOM qui n'existe plus.
  const el=document.getElementById('ck-chrono-'+cle+'-'+i);
  if(!el){ _ckStopChrono(); return; }
  const reste=Math.max(0,Math.round((_ckChrono.fin-Date.now())/1000));
  el.textContent=_ckMMSS(reste);
  if(reste<=0){
    _ckStopChrono();
    try{ navigator.vibrate&&navigator.vibrate([180,90,180]); }catch(e){}
    const c=document.getElementById('ck-case-'+cle+'-'+i);
    if(c&&!c.checked){ c.checked=true; _ckCocher(cle,i,true); }
  }
}
function _ckDemarrerChrono(cle,i,secs){
  // Relancer le chrono déjà en cours l'annule : c'est le seul geste d'arrêt.
  const memeEtape=_ckChrono&&_ckChrono.cle===cle&&_ckChrono.i===i;
  _ckStopChrono();
  if(memeEtape) return;
  const b=document.getElementById('ck-chrono-'+cle+'-'+i);
  if(!b) return;
  b.classList.add('ck-actif');
  _ckChrono={cle,i,fin:Date.now()+secs*1000,id:null};
  _ckPeindreChrono();
  if(_ckChrono) _ckChrono.id=setInterval(_ckPeindreChrono,1000);
}
// LE RETOUR D AVANT-PLAN est le moment où un compteur décrémenté aurait
// menti : on repeint depuis l’échéance, qui est la seule source de vérité.
// Sans lui, l’étape terminée pendant que l’écran était éteint n’afficherait
// sa fin — et ne cocherait sa case — qu’au tic suivant, ou jamais.
//
// Jumeau EXACT de celui du minuteur de repos, à la garde près : `_ckChrono`
// est nul la plupart du temps, et repeindre à vide n’aurait aucun sens.
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden&&_ckChrono) _ckPeindreChrono();
});
function _ckMajEntete(cle){
  const el=document.getElementById('ck-compte-'+cle);
  if(!el) return;
  const et=_ckEtat[cle]||{};
  const tot=parseInt(el.dataset.total)||0;
  const n=Object.keys(et).filter(k=>et[k]).length;
  el.textContent=n+'/'+tot;
  el.style.color=n>=tot&&tot?'var(--success)':'var(--sub)';
}

// ══════════════ LES MONTEES EN CHARGE, EN KILOS ════════════════════════
//
// « Montees en charge 40 / 60 / 80 % » demande un calcul mental au moment ou
// l'on est le moins dispose a en faire un : debout devant la barre, avant la
// premiere serie. Rendus en kilos, les paliers se chargent sans reflechir.
//
// ⚠ DEUX ECARTS ENTRE LA DEMANDE ET LE CODE :
//
// 1. _choisirPalier N'A RIEN A VOIR AVEC LES CHARGES. C'est le selecteur de
//    palier d'ABONNEMENT — mensuel, trimestriel, annuel — qui pilote le
//    bouton PayPal. On n'y touche pas. La fonction utile est _arrondirCharge,
//    et elle fait exactement ce qu'il faut.
//
// 2. IL N'EXISTE AUCUN INVENTAIRE DE DISQUES dans le projet. L'inventaire des
//    salles porte du materiel — barre, halteres, poulie — pas des
//    denominations de disques. « Arrondi aux disques disponibles » se lit donc
//    comme l'increment realiste que _arrondirCharge tient deja : 2,5 kg, soit
//    un disque de 1,25 kg de chaque cote, et 1,25 kg sous 20 kg ou les petits
//    disques sont la regle. Inventer une table de disques par salle serait
//    demander a l'athlete de saisir un inventaire pour un arrondi qu'il fait
//    de tete.

// PURE. Les pourcentages annonces par une etape, ou []. On ne lit QUE la forme
// « 40 / 60 / 80 % » : une etape qui dit « 2×10 » ou « 3 min » n'annonce aucun
// palier, et y voir des pourcentages inventerait une consigne.
const MONTEE_PCT_MIN=20, MONTEE_PCT_MAX=100;
function pctMontee(txt){
  const t=String(txt||'');
  // Une suite de nombres separes par « / », suivie d'un signe pourcent.
  const m=t.match(/(\d{1,3}(?:\s*\/\s*\d{1,3})+)\s*%/);
  if(!m) return [];
  const l=m[1].split('/').map(x=>Number(String(x).trim()));
  if(l.some(x=>!isFinite(x)||x<MONTEE_PCT_MIN||x>MONTEE_PCT_MAX)) return [];
  // Une montee MONTE : une suite qui redescend n'est pas un echauffement, et
  // c'est le signe qu'on a lu autre chose que des paliers.
  for(let i=1;i<l.length;i++) if(l[i]<=l[i-1]) return [];
  return l;
}
// PURE. Les paliers en kilos reels, arrondis. Rend [] sans reference — et []
// n'est pas « zero kilo », c'est « on ne sait pas », ce que l'appelant traduit
// en laissant le texte tel quel.
function paliersMontee(txt,refKg){
  const pcts=pctMontee(txt);
  const ref=Number(refKg);
  if(!pcts.length||!isFinite(ref)||!(ref>0)) return [];
  // ⚠ L'ARRONDI EST CELUI QUI EXISTE DEJA. Un second arrondi, meme identique
  // aujourd'hui, finirait par ne plus donner les memes kilos que la charge
  // suggeree de la serie suivante — et l'athlete lirait deux chiffres
  // differents pour le meme mouvement, a trente secondes d'intervalle.
  const out=[];
  for(const p of pcts){
    const kg=_arrondirCharge(ref*p/100);
    if(kg==null||!(kg>0)) return [];
    out.push(kg);
  }
  return out;
}
// PURE. L'etape, augmentee de ses kilos. SANS REFERENCE, LE TEXTE NE BOUGE
// PAS : les pourcentages restent, et le coach garde sa consigne intacte.
function etapeMontee(txt,refKg){
  const t=String(txt||'');
  const kg=paliersMontee(t,refKg);
  if(!kg.length) return t;
  return t+' : '+kg.map(k=>String(k).replace('.',','))
    .join(' · ')+' kg';
}

// LA CHARGE DE REFERENCE DU PREMIER EXERCICE. Deux sources, dans cet ordre :
//   1. la programmation de la semaine, quand le coach en a pose une — c'est
//      une consigne, elle prime sur toute deduction ;
//   2. la charge suggeree pour la premiere serie, celle que l'ecran affiche
//      deja juste en dessous.
// Rien d'autre. Une moyenne d'historique donnerait un troisieme chiffre, et
// l'echauffement annoncerait des kilos que la premiere serie contredirait.
function chargeReferenceEchauffement(idx){
  const i=(typeof idx==='number')?idx:0;
  const ex=woState&&woState.exercises&&woState.exercises[i];
  if(!ex||!ex.name) return null;
  try{ if(isCardio(ex)) return null; }catch(e){}
  // CONTREPOIDS EXCLU : sur des tractions assistees, le poids affiche est
  // l'ASSISTANCE. « 40 % de l'assistance » ne veut rien dire, et les kilos
  // rendus seraient l'inverse de ce qu'il faut charger.
  try{ if(isCounterweightEx(ex.name)) return null; }catch(e){}
  try{
    const c=consigneProgEx(ex,null,currentUser);
    if(c&&c.kg>0) return c.kg;
  }catch(e){}
  try{
    const prev=getPrevPerf(ex.name,woState.slot,woState.progName);
    if(prev&&prev.weight){
      const isCW=isCounterweightEx(ex.name);
      const s=chargeSuivante(prev.weight,prev.rir,isCW,1,ex.name);
      if(s>0) return s;
    }
  }catch(e){}
  return null;
}
function _carteProtocole(txt,titre,couleur,id,replie,refKg){
  const t=String(txt||'').trim();
  if(!t) return '';
  const lignes=t.split('\n').map(x=>x.trim()).filter(Boolean);
  // Première ligne « Nom (12 à 15 min) » : c'est un protocole, pas du texte libre.
  const entete=/^.+\(\d+( à \d+)? min\)$/.test(lignes[0])?lignes.shift():null;
  // LES KILOS SONT POSES ICI, sur le texte affiche, et JAMAIS ecrits dans le
  // protocole : la bibliotheque garde ses pourcentages, qui valent pour tout
  // le monde. Sans reference, etapeMontee rend le texte inchange.
  const etapes=lignes.filter(l=>/^\d+\.\s/.test(l)).map(l=>l.replace(/^\d+\.\s*/,''))
    .map(e=>etapeMontee(e,refKg));
  const cle=id;
  const et=_ckEtat[cle]||{};
  const corps=etapes.length
    ? etapes.map((e,i)=>{
        const secs=dureeEtape(e);
        const coche=!!et[i];
        // La règle globale « label » met en majuscules, espace les lettres et
        // ajoute 16px de marge haute : lisible pour un intitulé de champ,
        // illisible pour une consigne d'exercice. On la neutralise ici.
        return `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;margin:0;cursor:pointer;border-bottom:1px solid #141414;text-transform:none;letter-spacing:normal;font-weight:400">
        <input type="checkbox" id="ck-case-${cle}-${i}" ${coche?'checked':''} onchange="_ckCocher('${cle}',${i},this.checked)" style="width:17px;height:17px;margin:0;accent-color:${couleur};flex-shrink:0;cursor:pointer">
        <span style="flex:1;min-width:0;font-size:var(--fs-sm);line-height:1.5;color:${coche?'var(--text-faint)':'#ccc'};${coche?'text-decoration:line-through':''}">${escapeHtml(e)}</span>
        ${secs?`<button type="button" id="ck-chrono-${cle}-${i}" data-libelle="${_ckMMSS(secs)}" onclick="event.preventDefault();_ckDemarrerChrono('${cle}',${i},${secs})" class="ck-chrono">${_ckMMSS(secs)}</button>`:''}
      </label>`;
      }).join('')
    : `<div style="font-size:var(--fs-sm);line-height:1.6;color:#ccc;white-space:pre-wrap">${escapeHtml(lignes.join('\n'))}</div>`;
  const faits=etapes.length?Object.keys(et).filter(k=>et[k]).length:0;
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-left:3px solid ${couleur};border-radius:var(--r-3);margin-bottom:14px;overflow:hidden">
    <div onclick="const c=document.getElementById('${id}');c.style.display=c.style.display==='none'?'block':'none';this.querySelector('.chev').textContent=c.style.display==='none'?'▸':'▾'"
         role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
         style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer">
      <span style="flex:1;min-width:0">
        <span style="font-size:var(--fs-xs);letter-spacing:2px;font-weight:800;color:${couleur};text-transform:uppercase">${titre}</span>
        ${entete?`<span style="display:block;font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${escapeHtml(entete)}</span>`:''}
      </span>
      ${etapes.length?`<span id="ck-compte-${cle}" data-total="${etapes.length}" style="font-size:var(--fs-xs);font-weight:800;color:${faits>=etapes.length?'var(--success)':'var(--sub)'}">${faits}/${etapes.length}</span>`:''}
      <span class="chev" style="color:var(--sub);font-size:var(--fs-md)">${replie?'▸':'▾'}</span>
    </div>
    <div id="${id}" style="padding:0 14px 12px${replie?';display:none':''}">${corps}</div>
  </div>`;
}

// ══════════════ BIBLIOTHÈQUE DE PROTOCOLES ══════════════
// La modale d'avant listait les 10 protocoles d'une phase, sans filtre et sans
// moyen de chercher. Cet écran couvre les 20 et permet de restreindre par
// phase, objectif, durée, matériel et type de séance.
//
// Deux usages : consultation seule, ou choix d'un protocole pour un champ de
// l'éditeur. _pfCible porte le champ à remplir, null en consultation.
let _pfCible=null, _pfRetour='s-coach-program';
let _pfFiltres={phase:'',objectif:'',duree:0,materiel:'',type:'',q:''};
// Repliés par défaut : dépliés, les cinq groupes de filtres occupaient 48 % de
// la hauteur d'un écran de téléphone (59 % sur un petit modèle), ne laissant
// presque rien à la liste qu'ils servent à filtrer. Un résumé de ce qui est
// actif reste affiché replié, sinon on ne comprend pas pourquoi la liste est
// courte.
let _pfOuvert=false;
const _PF_DUREES=[[10,'10 min ou moins'],[15,'15 min ou moins'],[20,'20 min ou moins']];

// ══════════════ ÉDITEUR DE PROTOCOLE SUR MESURE ══════════════
// _peBrouillon est une copie de travail : tant qu'on n'a pas enregistré, rien
// n'est écrit sur l'utilisateur, et « Annuler » n'a rien à défaire.
let _peBrouillon=null, _peRetour='s-protocoles', _peModifie=false;

function _peNeuf(){
  return {slug:'perso_'+Date.now().toString(36),nom:'',phase:'WARMUP',objectif:'PERFORMANCE',
    dureeMin:10,dureeMax:12,intensite:'MODEREE',priorite:10,
    compatible:PROTO_TYPES.slice(),materiel:['AUCUN'],contreInd:[],desc:'',etapes:[''],perso:true};
}
function ouvrirEditeurProto(slug,retour){
  _peRetour=retour||'s-protocoles';
  const src=slug?protocolesPerso().find(p=>p.slug===slug):null;
  _peBrouillon=src?JSON.parse(JSON.stringify(src)):_peNeuf();
  if(!_peBrouillon.etapes.length) _peBrouillon.etapes=[''];
  _peModifie=false;
  document.getElementById('pe-titre').textContent=src?'Modifier le protocole':'Nouveau protocole';
  go('s-proto-edit');
  _peRendre();
}
async function _peQuitter(){
  if(_peModifie&&!await rcConfirm('Quitter sans enregistrer ? Les modifications seront perdues.',null,'Quitter')) return;
  _peBrouillon=null;
  go(_peRetour);
  if(_peRetour==='s-protocoles') _pfRendre();
}
function _peSet(cle,val){ _peBrouillon[cle]=val; _peModifie=true; _peRendre(); }
function _peBascule(cle,val){
  const l=_peBrouillon[cle];
  const i=l.indexOf(val);
  if(i>=0) l.splice(i,1); else l.push(val);
  _peModifie=true; _peRendre();
}

// ── Étapes ──
function _peEtapeTexte(i,v){ _peBrouillon.etapes[i]=v; _peModifie=true; _peMajApercu(); }
function _peAjouterEtape(){
  _peBrouillon.etapes.push(''); _peModifie=true; _peRendre();
  setTimeout(()=>{const c=document.getElementById('pe-et-'+(_peBrouillon.etapes.length-1));if(c)c.focus();},30);
}
function _peSupprimerEtape(i){
  if(_peBrouillon.etapes.length<=1){ _peBrouillon.etapes=['']; }
  else _peBrouillon.etapes.splice(i,1);
  _peModifie=true; _peRendre();
}
function _peDeplacerEtape(de,vers){
  const l=_peBrouillon.etapes;
  if(vers<0||vers>=l.length||de===vers) return;
  l.splice(vers,0,l.splice(de,1)[0]);
  _peModifie=true; _peRendre();
}

// ── Glisser-déposer des étapes ──────────────────────────────────────────────
// Pointer Events et non l'API drag HTML5 : celle-ci ne se déclenche pas au
// doigt, et cette application est d'abord utilisée sur téléphone. Les flèches
// restent là pour qui préfère, et pour le clavier.
let _peDrag=null;   // {de, y0, ligne}
function _peDragDebut(ev,i){
  // Seul le bouton gauche ou un doigt : un clic droit ne doit pas saisir.
  if(ev.button!=null&&ev.button!==0) return;
  ev.preventDefault();
  const ligne=document.getElementById('pe-ligne-'+i);
  if(!ligne) return;
  _peDrag={de:i,ligne};
  ligne.classList.add('pe-saisi');
  try{ ev.target.setPointerCapture&&ev.target.setPointerCapture(ev.pointerId); }catch(e){}
}
function _peDragBouge(ev){
  if(!_peDrag) return;
  ev.preventDefault();
  // Ligne survolée, déterminée par la position réelle du doigt : plus fiable
  // qu'un calcul de hauteurs, qui se décale dès qu'une étape passe sur deux
  // lignes de texte.
  const sous=document.elementFromPoint(ev.clientX,ev.clientY);
  const cible=sous&&sous.closest&&sous.closest('[data-pe-idx]');
  if(!cible) return;
  const vers=parseInt(cible.dataset.peIdx);
  if(isNaN(vers)||vers===_peDrag.de) return;
  const l=_peBrouillon.etapes;
  l.splice(vers,0,l.splice(_peDrag.de,1)[0]);
  _peDrag.de=vers;
  _peModifie=true;
  _peRendreEtapes();
  const nv=document.getElementById('pe-ligne-'+vers);
  if(nv){ nv.classList.add('pe-saisi'); _peDrag.ligne=nv; }
}
function _peDragFin(){
  if(!_peDrag) return;
  if(_peDrag.ligne) _peDrag.ligne.classList.remove('pe-saisi');
  _peDrag=null;
  _peRendre();
}

document.addEventListener('pointermove',_peDragBouge,{passive:false});
document.addEventListener('pointerup',_peDragFin);
document.addEventListener('pointercancel',_peDragFin);

function _peLigneEtape(e,i,total){
  return `<div id="pe-ligne-${i}" data-pe-idx="${i}" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
    <button type="button" class="pe-poignee" aria-label="Déplacer l'étape ${i+1}"
      onpointerdown="_peDragDebut(event,${i})">⠿</button>
    <span style="font-size:var(--fs-xs);font-weight:800;color:var(--red-text);padding-top:12px;min-width:14px;text-align:right">${i+1}</span>
    <textarea id="pe-et-${i}" rows="1" oninput="_peEtapeTexte(${i},this.value);this.style.height='auto';this.style.height=this.scrollHeight+'px'"
      placeholder="Ex : Rameur, 3 min" style="flex:1;font-size:var(--fs-sm);padding:8px 10px;margin:0;line-height:1.5;resize:none;min-height:38px">${escapeHtml(e)}</textarea>
    <div style="display:flex;flex-direction:column;gap:2px;flex-shrink:0">
      <button type="button" class="pe-mini" onclick="_peDeplacerEtape(${i},${i-1})" ${i===0?'disabled':''} aria-label="Monter">▲</button>
      <button type="button" class="pe-mini" onclick="_peDeplacerEtape(${i},${i+1})" ${i===total-1?'disabled':''} aria-label="Descendre">▼</button>
    </div>
    <button type="button" class="pe-mini pe-suppr" onclick="_peSupprimerEtape(${i})" aria-label="Supprimer l'étape">${icon('croix',14)}</button>
  </div>`;
}
function _peRendreEtapes(){
  const z=document.getElementById('pe-etapes'); if(!z) return;
  const l=_peBrouillon.etapes;
  z.innerHTML=l.map((e,i)=>_peLigneEtape(e,i,l.length)).join('');
  // Hauteur des zones de texte ajustée au contenu, sinon une étape longue est
  // tronquée à une ligne.
  z.querySelectorAll('textarea').forEach(t=>{t.style.height='auto';t.style.height=t.scrollHeight+'px';});
  _peMajApercu();
}
function _peMajApercu(){
  const a=document.getElementById('pe-apercu'); if(!a) return;
  const p=_peNormaliser();
  a.textContent=p.etapes.length?protoTexte(p):'(aucune étape)';
  const d=document.getElementById('pe-duree-chrono');
  if(d){
    const n=p.etapes.filter(e=>dureeEtape(e)!=null).length;
    d.textContent=n?(n+' étape'+(n>1?'s':'')+' chronométrable'+(n>1?'s':'')):'aucune étape chronométrable';
  }
}
// Copie propre du brouillon : étapes vides retirées, durées remises dans l'ordre.
function _peNormaliser(){
  const b=_peBrouillon;
  const dmin=Math.max(1,parseInt(b.dureeMin)||1);
  const dmax=Math.max(dmin,parseInt(b.dureeMax)||dmin);
  return Object.assign({},b,{
    nom:(b.nom||'').trim(),
    desc:(b.desc||'').trim(),
    etapes:b.etapes.map(e=>String(e||'').trim()).filter(Boolean),
    materiel:b.materiel.length?b.materiel:['AUCUN'],
    compatible:b.compatible.length?b.compatible:PROTO_TYPES.slice(),
    dureeMin:dmin,dureeMax:dmax
  });
}

function _peRendre(){
  const z=document.getElementById('pe-corps'); if(!z||!_peBrouillon) return;
  const b=_peBrouillon;
  const puce=(actif,lib,onclick)=>`<button type="button" class="pf-chip${actif?' active':''}" onclick="${onclick}">${lib}</button>`;
  const groupe=(titre,contenu,aide)=>`<div style="margin-bottom:16px">
    <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:6px">${titre}</div>
    ${aide?`<div style="font-size:var(--fs-2xs);color:var(--sub);margin-bottom:6px;line-height:1.5">${aide}</div>`:''}
    <div style="display:flex;flex-wrap:wrap;gap:6px">${contenu}</div></div>`;

  z.innerHTML=`
    <div style="margin-bottom:16px">
      <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:6px">Nom</div>
      <input id="pe-nom" value="${escapeHtml(b.nom)}" oninput="_peBrouillon.nom=this.value;_peModifie=true;_peMajApercu()"
        placeholder="Ex : Échauffement épaules sensibles" style="font-size:var(--fs-md);padding:10px 12px;margin:0">
    </div>
    ${groupe('Moment',
      puce(b.phase==='WARMUP','Échauffement',"_peSet('phase','WARMUP')")+
      puce(b.phase==='COOLDOWN','Fin de séance',"_peSet('phase','COOLDOWN')"))}
    ${groupe('Objectif',Object.keys(PROTO_OBJECTIFS).map(k=>
      puce(b.objectif===k,PROTO_OBJECTIFS[k].lib,`_peSet('objectif','${k}')`)).join(''))}
    <div style="margin-bottom:16px">
      <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:6px">Durée (minutes)</div>
      <div style="display:flex;align-items:center;gap:8px">
        <input type="number" min="1" max="120" value="${b.dureeMin}" oninput="_peBrouillon.dureeMin=this.value;_peModifie=true;_peMajApercu()" style="text-align:center;margin:0;width:74px">
        <span style="font-size:var(--fs-xs);color:var(--sub)">à</span>
        <input type="number" min="1" max="120" value="${b.dureeMax}" oninput="_peBrouillon.dureeMax=this.value;_peModifie=true;_peMajApercu()" style="text-align:center;margin:0;width:74px">
        <span style="font-size:var(--fs-xs);color:var(--sub)">min</span>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:6px">Description</div>
      <textarea rows="2" oninput="_peBrouillon.desc=this.value;_peModifie=true" placeholder="À quoi sert ce protocole, en une phrase." style="font-size:var(--fs-sm);padding:10px 12px;margin:0;line-height:1.5">${escapeHtml(b.desc)}</textarea>
    </div>

    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800">Étapes</div>
        <div id="pe-duree-chrono" style="font-size:var(--fs-2xs);color:var(--sub)"></div>
      </div>
      <div style="font-size:var(--fs-2xs);color:var(--sub);margin-bottom:8px;line-height:1.5">
        Glisse la poignée ⠿ pour réordonner. Une étape qui annonce une durée
        (« Rameur, 3 min ») devient chronométrable pour l'athlète.
      </div>
      <div id="pe-etapes"></div>
      <button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:6px 0 0" onclick="_peAjouterEtape()">+ Ajouter une étape</button>
    </div>

    ${groupe('Matériel',
      Object.keys(PROTO_MATERIEL).map(m=>
        puce(b.materiel.includes(m),PROTO_MATERIEL[m],`_peBascule('materiel','${m}')`)).join(''),
      'Sert à filtrer. Sans choix, le protocole est rangé en « sans matériel ».')}
    ${groupe('Types de séance',
      PROTO_TYPES.map(t=>
        puce(b.compatible.includes(t),_PROTO_TYPE_LIB[t]||t,`_peBascule('compatible','${t}')`)).join(''),
      'Ceux pour lesquels ce protocole sera suggéré. Sans choix, il vaut pour toutes.')}
    ${groupe('À éviter si',
      Object.keys(_PROTO_CI_LIB).map(c=>
        puce(b.contreInd.includes(c),_PROTO_CI_LIB[c],`_peBascule('contreInd','${c}')`)).join(''),
      'Affiché en garde-fou, jamais utilisé pour masquer le protocole.')}

    <div style="margin-bottom:16px">
      <div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:6px">Ce que verra l'athlète</div>
      <pre id="pe-apercu" style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);color:#bbb;line-height:1.7;white-space:pre-wrap;margin:0"></pre>
    </div>

    ${estProtoPerso(b.slug)&&protocolesPerso().some(p=>p.slug===b.slug)?
      `<button type="button" class="btn btn-outline" style="color:var(--red-light);border-color:#3a0000;margin-bottom:8px" onclick="_peSupprimer()">Supprimer ce protocole</button>`:''}
  `;
  _peRendreEtapes();
}

function _peEnregistrer(){
  const p=_peNormaliser();
  if(!p.nom){ toast('Donne un nom à ce protocole.','var(--orange)'); return; }
  if(!p.etapes.length){ toast('Ajoute au moins une étape.','var(--orange)'); return; }
  // Un nom qui reprend celui d'un protocole livré rendrait les deux
  // indiscernables dans le champ de la séance, qui ne contient que du texte.
  const collision=tousProtocoles().some(x=>x.slug!==p.slug&&x.nom.toLowerCase()===p.nom.toLowerCase());
  if(collision){ toast('Un protocole porte déjà ce nom.','var(--orange)'); return; }
  if(!Array.isArray(currentUser.protocolesPerso)) currentUser.protocolesPerso=[];
  const i=currentUser.protocolesPerso.findIndex(x=>x.slug===p.slug);
  if(i>=0) currentUser.protocolesPerso[i]=p; else currentUser.protocolesPerso.push(p);
  const ok=saveUser();
  _peModifie=false;
  _peBrouillon=null;
  go(_peRetour);
  if(_peRetour==='s-protocoles') _pfRendre();
  if(typeof toastEcriture==='function') toastEcriture(ok,'Protocole enregistré','le protocole est');
  else toast('Protocole enregistré');
}
async function _peSupprimer(){
  const slug=_peBrouillon&&_peBrouillon.slug;
  if(!slug) return;
  if(!await rcConfirm('Supprimer ce protocole ? Les séances où son déroulé a déjà été écrit ne changent pas.',null,'Supprimer')) return;
  currentUser.protocolesPerso=protocolesPerso().filter(p=>p.slug!==slug);
  saveUser();
  _peModifie=false; _peBrouillon=null;
  go(_peRetour);
  if(_peRetour==='s-protocoles') _pfRendre();
  toast('Protocole supprimé');
}

// ══════ CE QU'ON NE RETIRE A PERSONNE (lot 3) ════════════════════════════
//
// La bibliotheque de protocoles etait OUVERTE a tout le monde. La fermer pour
// la formule Essentielle retirerait quelque chose a des gens qui l'ont deja
// et qui s'en servent : ce n'est pas une porte a fermer, c'est un droit acquis.
//
// DEUX CHEMINS, DANS CET ORDRE :
//   1. le drapeau `protocolesHerites`, pose une fois pour toutes sur les
//      dossiers existants (migrerDroits, dans functions/index.js) ;
//   2. A DEFAUT, LA DATE DE CREATION DU DOSSIER. Le drapeau demande une
//      fonction deployee ; la date, elle, est deja dans le dossier. Le second
//      chemin fait donc tenir la promesse meme si le premier n'a jamais tourne,
//      et c'est la raison d'etre de ce repli.
//
// UN DOSSIER SANS DATE DE CREATION EST ANCIEN, et non recent : createdAt est
// pose a l'inscription depuis longtemps. Trancher dans l'autre sens fermerait
// la porte a des comptes qui l'avaient ouverte.
const PROTOCOLES_HERITAGE_AVANT=Date.UTC(2026,8,24);
function protocolesHerites(user){
  const u=(user===undefined)?currentUser:user;
  if(!u||typeof u!=='object') return false;
  if(u.protocolesHerites===true) return true;
  const c=Number(u.createdAt)||0;
  return c?(c<PROTOCOLES_HERITAGE_AVANT):true;
}
// LA QUESTION QUE L'INTERFACE POSE, et la seule : la capacite, ou l'heritage.
function peutVoirProtocoles(user){
  const u=(user===undefined)?currentUser:user;
  try{ if(peut(u,'bibliothequeProtocoles')) return true; }catch(e){}
  return protocolesHerites(u);
}
function ouvrirProtocoles(phase,champ,retour){
  // L'ECRAN S'OUVRE POUR TOUT LE MONDE DEPUIS LE LOT 4 : _pfRendre y pose le
  // verrou, et celui qui herite des protocoles (lot 3) ne le voit jamais.
  _pfCible=champ||null;
  _pfRetour=retour||(champ?'s-coach-program':(currentUser?.role==='coach'?'s-coach-home':'s-client-home'));
  // Arriver depuis le champ « échauffement » sans voir d'emblée les fins de
  // séance : le filtre de phase part pré-réglé, et reste modifiable.
  _pfFiltres={phase:phase||'',objectif:'',duree:0,materiel:'',type:'',q:''};
  const q=document.getElementById('pf-q'); if(q) q.value='';
  go('s-protocoles');
  _pfRendre();
}
function _pfRetourner(){ go(_pfRetour); }

function _pfSet(cle,val){
  // Recliquer une puce déjà active l'enlève : c'est le seul moyen de revenir à
  // « tous » sans une puce « tous » par ligne.
  _pfFiltres[cle]=(cle!=='q'&&_pfFiltres[cle]===val)?(cle==='duree'?0:''):val;
  _pfRendre();
}
function _pfReset(){
  _pfFiltres={phase:'',objectif:'',duree:0,materiel:'',type:'',q:''};
  const q=document.getElementById('pf-q'); if(q) q.value='';
  _pfRendre();
}

function _pfFiltrer(){
  const f=_pfFiltres;
  const q=(f.q||'').trim().toLowerCase();
  return tousProtocoles().filter(p=>{
    if(f.phase&&p.phase!==f.phase) return false;
    if(f.objectif&&p.objectif!==f.objectif) return false;
    // Sur une fourchette, c'est la durée HAUTE qui engage : annoncer 12 min
    // pour un protocole qui peut en prendre 15 fait déborder la séance.
    if(f.duree&&p.dureeMax>f.duree) return false;
    if(f.materiel==='AUCUN'&&!p.materiel.every(m=>m==='AUCUN')) return false;
    if(f.materiel&&f.materiel!=='AUCUN'&&!p.materiel.includes(f.materiel)) return false;
    if(f.type&&!p.compatible.includes(f.type)) return false;
    if(q){
      const foin=(p.nom+' '+p.desc+' '+p.etapes.join(' ')).toLowerCase();
      if(!foin.includes(q)) return false;
    }
    return true;
  });
}

function _pfRendre(){
  const zf=document.getElementById('pf-filtres'); if(!zf) return;
  // ══ LE VERROU (lot 4). Les filtres s'effacent avec la liste : filtrer un
  // catalogue qu'on ne voit pas n'a pas de sens.
  const _vrr=rcVerrou('bibliothequeProtocoles');
  if(_vrr){
    zf.innerHTML='';
    // La barre de recherche part avec les filtres : chercher dans un
    // catalogue qu'on ne voit pas ne mene nulle part.
    const _zq=document.getElementById('pf-q'); if(_zq) _zq.style.display='none';
    const _zl=document.getElementById('pf-liste');
    if(_zl) _zl.innerHTML=_vrr; else zf.innerHTML=_vrr;
    return;
  }
  const _zq=document.getElementById('pf-q'); if(_zq) _zq.style.display='';
  const f=_pfFiltres;
  const puce=(actif,libelle,onclick)=>
    `<button class="pf-chip${actif?' active':''}" onclick="${onclick}">${libelle}</button>`;
  const ligne=(titre,contenu)=>
    `<div style="margin-bottom:8px"><div style="font-size:var(--fs-2xs);letter-spacing:1.5px;color:var(--text-faint);font-weight:800;margin-bottom:4px">${titre}</div>
     <div style="display:flex;flex-wrap:wrap;gap:6px">${contenu}</div></div>`;

  const actifs=[f.phase,f.objectif,f.duree,f.materiel,f.type,f.q].filter(Boolean).length;
  // Résumé de ce qui filtre, lisible sans déplier.
  const resume=[
    f.phase?(f.phase==='WARMUP'?'Échauffement':'Fin de séance'):'',
    f.objectif?PROTO_OBJECTIFS[f.objectif].lib:'',
    f.duree?(f.duree+' min ou moins'):'',
    f.materiel?(PROTO_MATERIEL[f.materiel]||f.materiel):'',
    f.type?(_PROTO_TYPE_LIB[f.type]||f.type):''
  ].filter(Boolean).join(' · ');

  const barre=`<button onclick="_pfOuvert=!_pfOuvert;_pfRendre()"
      style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;padding:2px 0;cursor:pointer;font-family:Montserrat,sans-serif;text-align:left">
      <span class="pf-chip${actifs?' active':''}" style="pointer-events:none">${icon('sliders',12)} Filtres${actifs?' ('+actifs+')':''}</span>
      <span style="flex:1;min-width:0;font-size:var(--fs-2xs);color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(resume)}</span>
      <span style="color:var(--sub);font-size:var(--fs-sm)">${_pfOuvert?'▾':'▸'}</span>
    </button>`;

  if(!_pfOuvert){ zf.innerHTML=barre; _pfRendreListe(); return; }

  // Les puces passent à la ligne au lieu de défiler horizontalement : un filtre
  // qu'il faut faire glisser pour découvrir n'est jamais utilisé.
  zf.innerHTML=barre+`<div style="margin-top:10px">`+
    ligne('Moment',
      puce(f.phase==='WARMUP','Échauffement',"_pfSet('phase','WARMUP')")+
      puce(f.phase==='COOLDOWN','Fin de séance',"_pfSet('phase','COOLDOWN')"))
   +ligne('Objectif',
      Object.keys(PROTO_OBJECTIFS).map(k=>
        puce(f.objectif===k,PROTO_OBJECTIFS[k].lib,`_pfSet('objectif','${k}')`)).join(''))
   +ligne('Durée',
      _PF_DUREES.map(([v,lib])=>puce(f.duree===v,lib,`_pfSet('duree',${v})`)).join(''))
   +ligne('Matériel',
      puce(f.materiel==='AUCUN','Sans matériel',"_pfSet('materiel','AUCUN')")+
      `<select onchange="_pfSet('materiel',this.value)" class="pf-select">
        <option value="">Tout matériel</option>
        ${Object.keys(PROTO_MATERIEL).filter(m=>m!=='AUCUN').map(m=>
          `<option value="${m}" ${f.materiel===m?'selected':''}>${PROTO_MATERIEL[m]}</option>`).join('')}
      </select>`)
   +ligne('Type de séance',
      `<select onchange="_pfSet('type',this.value)" class="pf-select">
        <option value="">Tous les types</option>
        ${PROTO_TYPES.map(t=>
          `<option value="${t}" ${f.type===t?'selected':''}>${_PROTO_TYPE_LIB[t]||t}</option>`).join('')}
      </select>`)
   +`</div>`;
  _pfRendreListe();
}

function _pfRendreListe(){
  const f=_pfFiltres;
  const liste=_pfFiltrer();
  const actifs=[f.phase,f.objectif,f.duree,f.materiel,f.type,f.q].filter(Boolean).length;
  const zl=document.getElementById('pf-liste'); if(!zl) return;

  const entete=`<button class="btn btn-outline btn-sm" style="width:100%;margin:0 0 12px" onclick="ouvrirEditeurProto(null,'s-protocoles')">+ Créer un protocole</button>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px">
      <span style="font-size:var(--fs-xs);color:var(--sub)">${liste.length} protocole${liste.length>1?'s':''} sur ${tousProtocoles().length}</span>
      ${actifs?`<button onclick="_pfReset()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xs);font-family:Montserrat,sans-serif;cursor:pointer;text-decoration:underline;padding:4px 0">Tout afficher</button>`:''}
    </div>`;

  if(!liste.length){
    zl.innerHTML=entete+`<div class="sub" style="font-size:var(--fs-sm);background:var(--surface-2);border-radius:var(--r-3);padding:16px;line-height:1.6;text-align:center">
      Aucun protocole ne correspond. Retire un filtre pour élargir la recherche.</div>`;
    return;
  }

  zl.innerHTML=entete+liste.map(p=>{
    const o=PROTO_OBJECTIFS[p.objectif]||{lib:p.objectif,c:'var(--sub)'};
    const duree=p.dureeMin===p.dureeMax?p.dureeMin:p.dureeMin+' à '+p.dureeMax;
    const universel=p.compatible.length>=PROTO_TYPES.length;
    // Un protocole déjà écrit dans le champ visé : le dire évite de le
    // réappliquer en croyant changer quelque chose.
    const pose=_pfCible&&_vientDunProtocole(document.getElementById(_pfCible)?.value)
      &&(document.getElementById(_pfCible)?.value||'').trim().split('\n')[0]===protoTexte(p).split('\n')[0];
    return `<div style="background:var(--surface-1);border:1px solid ${pose?'var(--success)':'var(--border)'};border-radius:var(--r-3);padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <span style="font-size:var(--fs-md);font-weight:800">${escapeHtml(p.nom)}</span>
        <span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;padding:1px 6px;border-radius:var(--r-3);background:${o.c};color:#08080a">${o.lib.toUpperCase()}</span>
        <span style="font-size:var(--fs-2xs);color:var(--sub)">${duree} min</span>
        <span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;color:var(--text-faint)">${p.phase==='WARMUP'?'ÉCHAUFFEMENT':'FIN DE SÉANCE'}</span>
        ${estProtoPerso(p.slug)?'<span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;padding:1px 6px;border-radius:var(--r-3);border:1px solid var(--border);color:var(--sub)">PERSO</span>':''}
        ${pose?'<span style="font-size:var(--fs-2xs);color:var(--success);font-weight:800">EN PLACE</span>':''}
      </div>
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-bottom:8px">${escapeHtml(p.desc)}</div>
      <ol style="margin:0 0 8px 16px;padding:0;font-size:var(--fs-xs);color:#bbb;line-height:1.7">${p.etapes.map(e=>'<li>'+escapeHtml(e)+'</li>').join('')}</ol>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6">
        Matériel : ${p.materiel.map(m=>PROTO_MATERIEL[m]||m).join(', ')}<br>
        Convient à : ${universel?'toutes les séances':p.compatible.map(t=>_PROTO_TYPE_LIB[t]||t).join(', ')}
      </div>
      ${p.contreInd.length?`<div style="font-size:var(--fs-2xs);color:var(--orange);margin-top:6px">À éviter si : ${p.contreInd.map(c=>_PROTO_CI_LIB[c]||c).join(', ')}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:10px">
        ${_pfCible?`<button class="btn btn-outline btn-sm" style="margin:0;flex:1" onclick="_pfUtiliser('${p.slug}')">Utiliser ce protocole</button>`:''}
        ${estProtoPerso(p.slug)?`<button class="btn btn-outline btn-sm" style="margin:0;${_pfCible?'flex:0 0 auto;width:auto;padding:0 14px':'flex:1'}" onclick="ouvrirEditeurProto('${p.slug}','s-protocoles')">Modifier</button>`:''}
      </div>
    </div>`;
  }).join('');
}

// ASYNCHRONE. _appliquerProto se suspend sur rcConfirm quand le champ porte un
// texte écrit à la main : sans await, la suite lisait l'ANCIENNE valeur et
// l'écran de la bibliothèque ne se refermait jamais après une confirmation.
async function _pfUtiliser(slug){
  if(!_pfCible) return;
  // SUR LE RÉSULTAT, et non sur une comparaison du contenu du champ : ce test
  // indirect lisait « refus » quand on réappliquait le protocole déjà en place,
  // puisque le texte ne changeait pas. On demande, on ne déduit plus.
  if(await _appliquerProto(slug,_pfCible)) _pfRetourner();
  else _pfRendre();
}
// ══════════════ TESTS DE LA COUCHE D'IDENTITÉ D'EXERCICE ══════════════
// Exécutable depuis la console : testExercices().
// Ne touche à AUCUNE donnée réelle : currentUser est sauvegardé puis restauré.

// ══════════════ LA SUITE DE TESTS, À LA DEMANDE ════════════════════════
//
// Elle vivait ici et pesait 38,9 % du fichier, pour du code sans aucun
// appelant : chaque athlète la téléchargeait et l’analysait à chaque
// chargement à froid. Elle est dans ./tests.js, et n’arrive que si on la
// demande — depuis la console, en tapant chargerTests().
//
// tests.js n’est PAS dans ASSETS du service worker, délibérément : l’y
// mettre le ferait télécharger d’office et annulerait ce lot.
//
// LA SOURCE EST LUE AVANT, et pas par la suite elle-même : une trentaine
// d’assertions la lisent de façon SYNCHRONE, à l’intérieur de leur test.
// Un fetch à l’intérieur les aurait toutes rendues asynchrones.
async function chargerTests(){
  // L'étape notifications ne doit pas recouvrir les écrans que la suite mesure.
  window._rcEnTests=true;
  if(!window._RC_SRC_PROD){
    try{
      const r=await fetch('./index.html',{cache:'no-store'});
      let src=r.ok?await r.text():'';
      // ⚠ LA SOURCE DU PRODUIT N'EST PLUS DANS LE SEUL index.html (build 1417).
      //   Le gros du code vit dans rc-core.<build>.js et la feuille de styles
      //   dans rc-style.<build>.css, servis immuables pour un an : c'est ce qui
      //   empeche 1,9 Mo de repartir sur le reseau A CHAQUE OUVERTURE.
      //   CENT QUARANTE-SIX ASSERTIONS LISENT CETTE SOURCE, et quarante-quatre
      //   lisent le CSS. Sans recollage ici, elles ne regarderaient plus rien —
      //   et toutes celles qui verifient une ABSENCE passeraient au vert sur du
      //   vide, ce qui est pire que de tomber.
      //
      //   LA PAGE SEULE, AUSSI : c'est elle qu'on mesure pour verifier qu'aucun
      //   bloc en ligne n'est revenu.
      window._RC_PAGE_PROD=src;
      //   ON RECONSTITUE A SA PLACE, et non bout a bout : chaque reference
      //   externe est remplacee, LA OU ELLE EST, par le bloc en ligne qu'elle a
      //   remplace. Recollee en queue de fichier, la source n'etait plus une
      //   page : l'assertion « rien ne suit </html> » tombait, et le scanner de
      //   domaines — qui ne retire les commentaires QUE dans un <script> —
      //   lisait « anses.fr », cite dans un commentaire, comme un appel reseau.
      const _rendreEnLigne=async(el,attr,ouvrant,fermant)=>{
        if(!el) return;
        const u=el.getAttribute(attr)||'';
        const j=u?src.indexOf(u):-1;
        if(j<0) return;                       // l'URL, donc la balise qui la porte
        const d=src.lastIndexOf('<',j);
        let f=src.indexOf('>',j);
        if(d<0||f<0) return;
        f+=1;
        if(src.substr(f,9).toLowerCase()==='<'+'/script>') f+=9;
        try{ const r2=await fetch(u,{cache:'no-store'});
          if(r2.ok) src=src.slice(0,d)+ouvrant+await r2.text()+fermant+src.slice(f);
        }catch(e2){}
      };
      await _rendreEnLigne(document.querySelector('link[rel="stylesheet"][href*="rc-style."]'),
        'href','<style>','<'+'/style>');
      await _rendreEnLigne(document.getElementById('rc-theme-clair'),'href','<style>','<'+'/style>');
      await _rendreEnLigne(document.querySelector('script[src*="rc-core."]'),
        'src','<script>','<'+'/script>');
      window._RC_SRC_PROD=src;
    }catch(e){ window._RC_SRC_PROD=''; }
  }
  // LA FEUILLE DE STYLES SEULE, pour les assertions qui lisent le CSS : voir
  // _stylesProd dans tests.js, qui la recolle aux <style> restes en ligne.
  if(window._RC_CSS_PROD===undefined){
    let css='';
    try{
      const _l=document.querySelector('link[rel="stylesheet"][href*="rc-style."]');
      if(_l){ const r=await fetch(_l.getAttribute('href'),{cache:'no-store'});
        if(r.ok) css=await r.text(); }
      // ET LE THEME CLAIR, sorti dans sa propre feuille (01/10/2026) : les
      // assertions qui lisent ses regles le trouvent a la suite, dans l'ordre.
      const _t=document.getElementById('rc-theme-clair');
      if(_t){ const r=await fetch(_t.getAttribute('href'),{cache:'no-store'});
        if(r.ok) css+='\n'+await r.text(); }
    }catch(e){}
    window._RC_CSS_PROD=css;
  }
  // LE WORKER ET LES EN-TETES D'HEBERGEMENT, POUR LA MEME RAISON. Deux pieces
  // de ce lot vivent dans des fichiers que le navigateur ne charge pas : la
  // purge des actifs perimes dans sw.js, et le « immutable » d'un an dans
  // firebase.json. Sans eux, un renommage malheureux remettrait 1,9 Mo sur le
  // reseau a chaque ouverture sans qu'une seule assertion bronche.
  // ET LE MODULE D'ALLEGEMENT VIDEO. Vingt-deux kilo-octets qui decident du
  // plus gros levier de l'application — 6 Mo au lieu de 130 — et que la suite ne
  // pouvait pas lire du tout : il est servi a part, comme le code. Une assertion
  // y garde desormais ce qu'aucun faux VideoEncoder ne peut eprouver.
  if(window._RC_VIDEO_PROD===undefined){
    try{ const r=await fetch('./vendor/rc-video.js',{cache:'no-store'});
      window._RC_VIDEO_PROD=r.ok?await r.text():null; }catch(e){ window._RC_VIDEO_PROD=null; }
  }
  if(window._RC_SW===undefined){
    try{ const r=await fetch('./sw.js',{cache:'no-store'});
      window._RC_SW=r.ok?await r.text():null; }catch(e){ window._RC_SW=null; }
  }
  if(window._RC_HOSTING===undefined){
    try{ const r=await fetch('../firebase.json',{cache:'no-store'});
      window._RC_HOSTING=r.ok?await r.text():null; }catch(e){ window._RC_HOSTING=null; }
  }
  // LES REGLES DE LA BASE, POUR LA MEME RAISON ET AU MEME MOMENT. Une sonde
  // compare la liste blanche de coach_public a CHAMPS_PROFIL_COACH : un champ
  // ecrit par le code et absent des regles fait rejeter le PUT ENTIER par
  // Firebase, donc le profil public cesse DEFINITIVEMENT de se publier. C'est
  // arrive avec « dispo ».
  //
  // ELLES NE SONT PAS SERVIES PAR LE SITE DEPLOYE — _site/ ne contient que
  // app/ — et la sonde le dit alors plutot que de tomber. Le lanceur de la
  // suite, lui, sert la racine du depot : c'est la que la verification a un
  // sens, et c'est la qu'elle tourne.
  if(window._RC_RULES===undefined){
    try{
      const r=await fetch('../database.rules.json',{cache:'no-store'});
      window._RC_RULES=r.ok?await r.text():null;
    }catch(e){ window._RC_RULES=null; }
  }
  if(typeof testExercices!=='function'){
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='./tests.js';
      s.onload=res;
      // DEUX RAISONS, DEUX PHRASES. tests.js n'est jamais publie (firebase.yml
      // et scripts/assembler_site.sh le retirent) : en production, la suite
      // n'existe pas, et le dire ainsi evite de chercher une panne reseau. Hors
      // ligne, c'est l'autre cas : il n'est jamais mis en cache.
      s.onerror=()=>{
        const horsLigne=(typeof navigator!=='undefined'&&navigator.onLine===false);
        const msg=horsLigne
          ?'Suite de tests non disponible hors ligne : tests.js n\'est jamais mis en cache.'
          :'Suite de tests non disponible ici : tests.js n\'est pas publié en production (lancer la suite depuis le dépôt local, node scripts/verif/suite.mjs).';
        try{ console.warn('[RepCore] '+msg); }catch(e){}
        try{ toast(horsLigne?'Suite de tests non disponible hors ligne.':'Suite de tests non disponible ici.','var(--orange)'); }catch(e){}
        rej(new Error(msg));
      };
      document.head.appendChild(s);
    });
  }
  // testExercices est defini par tests.js, charge juste au-dessus.
  return window.testExercices();
}
