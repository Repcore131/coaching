// ══════════════ RÉPONSE DU COACH AU BILAN ══════════════
// Le bilan est l'acte le plus coûteux du parcours athlète — six étapes,
// quatorze mensurations, trois photos — et il ne recevait qu'un toast et une
// ligne grise non cliquable. Le coach répondait sur WhatsApp, hors de l'app,
// sans trace.
//
// Ce circuit est la COPIE de celui du retour vidéo, qui fonctionne : mêmes
// conventions de champs, même garde de premier passage, même test strict.

// Test STRICT sur false, comme feedbacksNonVus. Un bilan d'avant le déploiement
// n'a pas le champ : une simple vérification de fausseté ferait remonter tout
// l'historique comme non lu, et l'athlète recevrait une pastille pour des
// bilans auxquels personne n'a jamais répondu.
function _nomCoachAffiche(){
  try{
    const pr=profilCoachLocal(cleCoachDe(currentUser));
    if(pr&&pr.fname) return pr.fname;
  }catch(e){}
  return '';
}
function bilansAvecReponseNonVue(u){
  return ((u&&u.bilans)||[]).filter(b=>b&&b.reponseVue===false);
}
function _idBilan(b){ return b&&(b.id||('bil_'+b.date)); }
function _dateBilanCourte(b){
  return b&&b.date?dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
}
// ══ LES TROUS SE VOIENT SANS OUVRIR L'ECRAN ═════════════════════════════
//
// Le probleme metier, ecrit noir sur blanc : « l'athlete oublie, le coach
// pilote sur des trous ». Un athlete qui ne note rien pendant dix jours ne
// voyait RIEN le lui dire — il fallait ouvrir Lifestyle pour constater le vide,
// c'est-a-dire faire precisement le geste qu'il ne fait plus.
//
// PURE. Un jour est « sans donnees » quand il n'a NI pas NI sommeil : un jour
// ou l'athlete a note ses pas mais pas sa nuit n'est pas un oubli, c'est une
// saisie partielle, et la compter comme un trou ferait sonner la pastille en
// permanence chez quelqu'un qui joue le jeu.
//
// LE JOUR EN COURS N'EST JAMAIS COMPTE : il n'est pas fini, et le compter
// ferait une pastille allumee tous les matins.
function joursSansDonnees(u,jours){
  const n=(jours>0?jours:7);
  const d=new Date(); d.setHours(12,0,0,0);
  const out=[];
  for(let i=1;i<=n;i++){
    const j=new Date(d); j.setDate(d.getDate()-i);
    const iso=localISODate(j);
    if(sanPas(u,iso)==null&&sanSommeilMin(u,iso)==null) out.push(iso);
  }
  return out;
}
// La pastille, calquee sur _majPastilleVideos.
//
// ⚠ ELLE NE S'ALLUME QUE SI LA VEILLE EST VIDE, meme si la semaine porte
// d'autres trous. Quelqu'un qui vient de se remettre a noter n'a pas a voir un
// point rouge pour un oubli d'il y a cinq jours : la pastille dit « tu as
// decroche », pas « ton historique est imparfait ». Le CHIFFRE, lui, compte la
// semaine entiere — c'est ce qui reste a rattraper.
function _majPastilleLifestyle(){
  const btn=document.querySelector('#client-tabbar .tab-btn[data-tab="progres"]');
  if(!btn) return;
  // SYNCHRONISÉ : les jours arrivent seuls, on ne les réclame plus.
  if(typeof sanSyncActif==='function'&&sanSyncActif()){ _pastilleOnglet('lifestyle',0,c=>''); return; }
  const vides=joursSansDonnees(currentUser,7);
  const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-1);
  const veilleVide=vides.indexOf(localISODate(d))>=0;
  _pastilleOnglet('lifestyle',veilleVide?vides.length:0,
    c=>'Lifestyle : '+c+' jour'+(c>1?'s':'')+' sans données cette semaine');
}
// Pastille de l'onglet Bilan, calquée sur _majPastilleVideos.
function _majPastilleBilan(){
  const btn=document.querySelector('#client-tabbar .tab-btn[data-tab="coach"]');
  if(!btn) return;
  // DEUX SOURCES, UN SEUL CHIFFRE : les reponses du coach qu'on n'a pas lues,
  // et le bilan a remplir aujourd'hui. Ce dernier ne compte qu'une fois par
  // jour, et plus du tout des que l'onglet a ete ouvert.
  const _rep=bilansAvecReponseNonVue(currentUser).length;
  const _du=(_bilanAFaireAujourdhui()&&!_bilanOngletVuAujourdhui())?1:0;
  _pastilleOnglet('bilan',_rep+_du,c=>_du&&!_rep
    ? 'Bilan : à remplir aujourd\'hui'
    : 'Bilan : '+c+' élément'+(c>1?'s':'')+' à consulter');
}
// Notification système, calquée sur checkFeedbackNotif — garde de premier
// passage compris. Sans lui, la première synchro après déploiement enverrait
// une notification par bilan historique déjà répondu.
function checkReponseBilanNotif(){
  if(!currentUser||currentUser.role!=='athlete') return;
  const dates=(currentUser.bilans||[]).map(b=>b&&b.reponseDate)
    .filter(d=>typeof d==='number'&&isFinite(d));
  if(!dates.length) return;
  const plusRecent=Math.max.apply(null,dates);
  if(typeof currentUser._lastRepBilanNotif!=='number'){
    currentUser._lastRepBilanNotif=plusRecent;saveUser();return;
  }
  if(plusRecent<=currentUser._lastRepBilanNotif) return;
  const nouveaux=(currentUser.bilans||[])
    .filter(b=>b&&b.reponseDate>currentUser._lastRepBilanNotif)
    .sort((a,b)=>b.reponseDate-a.reponseDate);
  currentUser._lastRepBilanNotif=plusRecent;saveUser();
  if(!nouveaux.length) return;
  // UNE seule notification même pour plusieurs réponses : en empiler une par
  // bilan transformerait une bonne nouvelle en nuisance.
  if(_appAuPremierPlan()) return;
  const d=_dateBilanCourte(nouveaux[0]);
  try{
    if(_notifSupported()&&Notification.permission==='granted'){
      navigator.serviceWorker.ready.then(reg=>reg.showNotification('Ton coach a répondu',{
        body:'Réponse à ton bilan du '+d+'.',
        icon:'./icons/icon-192x192.png',badge:'./icons/icon-192x192.png',
        tag:'reponse-bilan',requireInteraction:false,data:{url:'./?bilan=1'}
      })).catch(()=>{});
    }
  }catch(e){}
}
// Ouverture d'une réponse : marque comme lue, éteint la pastille, et emmène
// l'athlète sur l'onglet Notes où la réponse est affichée.
function openReponseBilan(id){
  const b=((currentUser&&currentUser.bilans)||[]).find(x=>_idBilan(x)===id);
  if(b&&b.reponseVue===false){ b.reponseVue=true; saveUser(); }
  _majPastilleBilan();
  openBilanNotes(id);
}
// Onglet Notes de l'écran Évolution. Sert aussi aux lignes « bilan transmis ».
function openBilanNotes(id){
  go('s-progress');
  const btn=document.querySelector('#prog-tabs button[onclick*="notes"]');
  showProgressTab('notes',btn);
  if(id) try{ _bnVoir(id); }catch(e){}
  if(id) setTimeout(()=>{
    const el=document.getElementById('bil-'+id);
    if(el&&el.scrollIntoView) el.scrollIntoView({block:'start'});
  },60);
}

// ── Côté coach ──────────────────────────────────────────────────────────────
// Un bilan « sans réponse » est un bilan auquel le coach n'a pas écrit. Ce
// n'est plus « pas encore ouvert » : ouvrir ne suffit plus à éteindre le
// signal, il faut répondre.
// Un bilan MARQUÉ TRAITÉ (b.traite, 06/10/2026) n'en est plus : le coach l'a
// lu et a choisi de ne pas y répondre par écrit. Réversible.
function bilansSansReponse(c){
  // BUILD 1868 : un bilan complété après la réponse est à relire.
  return ((c&&c.bilans)||[]).filter(b=>b&&((!bilanRepondu(b)&&!b.traite)||bilanARelire(b))).length;
}
// PURE. Les bilans de suivi plus anciens restés sans réponse (ni traités),
// du plus récent au plus ancien.
function bilansAnciensSansReponse(c){
  const l=((c&&c.bilans)||[]).filter(b=>b&&b.date&&b.type!=='depart');
  const der=l.reduce((m,b)=>Math.max(m,Number(b.date)||0),0);
  return l.filter(b=>(Number(b.date)||0)<der&&!bilanRepondu(b)&&!b.traite)
    .sort((x,y)=>(Number(y.date)||0)-(Number(x.date)||0));
}
// « Marquer traité » : aucun texte n'est envoyé ; l'indicateur se retire.
function bilanMarquerTraite(email,bilanId,oui){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!_estMonAthlete(c,currentUser)||!Array.isArray(c.bilans)) return false;
  const b=c.bilans.find(x=>_idBilan(x)===bilanId);
  if(!b) return false;
  if(oui===false){ delete b.traite; delete b.traiteLe; }
  else { b.traite=true; b.traiteLe=Date.now(); }
  users[email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(email,c);
  toastSync(ok,envoi,oui===false?'Bilan de nouveau sans réponse':'Bilan marqué traité. « Annuler » sous le bilan pour revenir.','le marquage est');
  try{ renderBilanEvolution(c); evoTab('reponses'); _renderQuickCommentChips('bilan'); }catch(e){}
  try{ if(oui!==false) _proposerAnciensBilans(c); }catch(e){}
  return ok;
}
// ══ LE BANDEAU DU VOLET RÉPONSES (06/10/2026) ═════════════════════════════
// Le coach répondait sans voir ni la douleur, ni la dernière séance, ni le
// poids. Une ou deux lignes en --fs-xs, chaque élément un lien vers la section
// de la fiche (la même cible que le point du lundi, LUNDI_CIBLE).
function bandeauBilanFaits(c,maintenant){
  const t=Number(maintenant)||Date.now(), out=[];
  if(!c) return out;
  // Le signal principal, hors « bilan sans réponse » : c'est l'écran même.
  let sp=null; try{ sp=signalPrincipal(c,{maintenant:t,sansBilan:true}); }catch(e){ sp=null; }
  if(sp&&sp.cat!=='rien') out.push({cle:'signal',cat:sp.cat,texte:sp.libelle});
  const ss=(c.sessions||[]).filter(s=>s&&Number(s.date)>0);
  if(ss.length){
    const der=ss.reduce((a,b)=>Number(b.date)>Number(a.date)?b:a);
    const j=Math.max(0,Math.floor((t-Number(der.date))/864e5));
    const nom=String(der.name||der.sessionName||der.nom||'').trim();
    out.push({cle:'seance',cat:'absence',texte:'dernière séance '+(j===0?'aujourd’hui':'il y a '+j+' j')+(nom?' ('+nom+')':'')});
    const mot=String(der.noteAthlete||'').trim();
    if(mot) out.push({cle:'mot',cat:'absence',texte:'son mot : « '+mot.slice(0,60)+(mot.length>60?'…':'')+' »'});
  }
  let p=null; try{ const l=serieWeight(c)||[]; p=l.reduce((a,b)=>(!a||String(b.date)>String(a.date))?b:a,null); }catch(e){ p=null; }
  if(p&&p.kg){
    let q=''; try{ q=new Date(p.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){ q=''; }
    out.push({cle:'poids',cat:'poids',texte:'poids '+String(Math.round(p.kg*10)/10).replace('.',',')+' kg'+(q?' le '+q:'')});
  }
  return out;
}
function htmlBandeauBilan(c){
  const f=bandeauBilanFaits(c,Date.now());
  if(!f.length) return '';
  const id=_attrArg(String(c.id||''));
  return '<div class="bb-faits">'+f.map(x=>'<button type="button" class="bb-fait'+(x.cle==='signal'&&(x.cat==='douleur'||x.cat==='drapeau')?' bb-fait-sante':'')+'" onclick="bilanVersFiche('+id+','+_attrArg(x.cat)+')">'
    +escapeHtml(x.texte)+'</button>').join('<span class="bb-sep" aria-hidden="true">·</span>')+'</div>';
}
// Le lien : la fiche, à la section (comme le point du lundi).
function bilanVersFiche(id,cat){
  if(cat==='poids'){
    try{ openClientDetail(id,false,true); }catch(e){ return false; }
    setTimeout(()=>{ try{ const el=document.getElementById('ccd-poids'); if(el) (el.closest('section')||el).scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){} },350);
    return true;
  }
  return lundiOuvrir(id,cat);
}
// APRÈS UNE RÉPONSE : les bilans plus anciens restés sans réponse, proposés
// AVANT « Athlète suivant → ».
function _proposerAnciensBilans(c){
  const l=bilansAnciensSansReponse(c);
  const pane=document.querySelector('#evo-content [data-evo-pane="reponses"]');
  const avant=document.getElementById('bilans-anciens'); if(avant) avant.remove();
  if(!l.length||!pane) return false;
  const b=l[0], id=_idBilan(b), n=l.length;
  const z=document.createElement('div');
  z.id='bilans-anciens'; z.className='bb-anciens';
  const em=String(c.email||'');
  z.innerHTML='<span>'+n+' bilan'+(n>1?'s':'')+' plus ancien'+(n>1?'s':'')+' sans réponse : </span>'
    +'<button type="button" class="rb-lien" data-a="repondre">y répondre</button> / '
    +'<button type="button" class="rb-lien" data-a="traite">le marquer traité</button>';
  z.querySelector('[data-a="repondre"]').onclick=()=>{ z.remove(); bilanOuvrirReponse(id); };
  z.querySelector('[data-a="traite"]').onclick=()=>{ bilanMarquerTraite(em,id,true); };
  pane.insertBefore(z,pane.firstChild);
  return true;
}
// PURE. Une vidéo attend-elle encore la correction du coach ?
//
// La bande « Charge de travail » comptait `!v.feedbackDate`, la fiche athlète
// jugeait `!v.feedback && !v.feedbackTimestamps?.length`. Une vidéo corrigée
// AVANT que feedbackDate n’existe portait donc « ✓ Corrigée » sur la fiche et
// « en attente » sur le tableau de bord : le coach cherchait un travail déjà
// fait, et le compteur ne retombait jamais.
//
// LA RÉUNION DES TROIS SIGNES, et non leur intersection : une vidéo est en
// attente quand RIEN n’indique qu’on l’a corrigée. Conséquence assumée, dans
// le sens sûr — une vidéo qui ne porterait qu’un feedbackDate, sans texte ni
// repère, compte désormais pour corrigée des deux côtés. saveVideoCorrection
// refuse d’enregistrer sans texte NI repère, donc le cas ne se produit pas ;
// et s’il se produisait, se taire vaut mieux que réclamer un travail fait.
//
// Une entrée nulle n’attend rien : elle était déjà écartée par le `v&&` du
// tableau de bord, et le rester évite de compter du vide comme du travail.
function videoNonCorrigee(v){
  if(!v) return false;
  return !v.feedback&&!((v.feedbackTimestamps||[]).length)&&!v.feedbackDate;
}
// `taId` EST L IDENTIFIANT DU CHAMP SOUS LE BOUTON QU ON VIENT DE TOUCHER.
// Le bouton le passe ; le repli sur l ancien identifiant fixe ne sert qu aux
// appels qui ne le connaissent pas encore.
// LE BROUILLON PRÉ-ÉCRIT, ENVOYÉ SANS Y TOUCHER (06/10/2026) : la première
// fois, une confirmation courte ; « Ne plus demander » est mémorisé.
const RB_CONFIRME_PRE='rc_rb_confirme_pre';
function _rbPreNonTouche(email,bilanId,txt){
  try{ if(localStorage.getItem(RB_CONFIRME_PRE)==='1') return false; }catch(e){}
  if(rbBrouillon(email,bilanId)) return false;
  const c=(DB.get('users')||{})[email];
  const b=c&&Array.isArray(c.bilans)?c.bilans.find(x=>_idBilan(x)===bilanId):null;
  if(!b||bilanRepondu(b)) return false;
  const pre=String(_brouillonPourChamp(b,c)||'').trim();
  return !!pre&&pre===txt;
}
function saveReponseBilan(email,bilanId,taId,_confirme){
  const _ta=taId||_taIdBilan(bilanId||'');
  // Même garde-fou, et `false` comme tous les autres refus de cette fonction :
  // ses appelants lisent cette valeur.
  if(!tplVerifierAvantEnvoi(_ta)) return false;
  const ta=document.getElementById(_ta);
  const txt=((ta&&ta.value)||'').trim();
  if(!txt){ toast('Écris ta réponse avant d\'envoyer.','var(--orange)'); return false; }
  if(!_confirme&&_rbPreNonTouche(email,bilanId,txt)){
    const qui=((DB.get('users')||{})[email]||{}).fname||'ton athlète';
    return rcConfirm3('Envoyer le brouillon tel quel ?','Tu n’as pas modifié le texte pré-écrit. Il partira à '+qui+' tel quel.',
      'Envoyer','Envoyer, ne plus demander','Relire').then(r=>{
        if(!r) return false;
        if(r==='milieu') try{ localStorage.setItem(RB_CONFIRME_PRE,'1'); }catch(e){}
        return saveReponseBilan(email,bilanId,taId,true);
      });
  }
  const users=DB.get('users')||{};
  const c=users[email];
  // N3.13 — LE MEME CONTROLE D'APPARTENANCE QUE LES SOIXANTE-NEUF AUTRES
  // ECRITURES. L'adresse vient d'un attribut onclick, et le cache local peut
  // porter des dossiers etrangers — sur un appareil ou plusieurs comptes se
  // cotoient, notamment. Cette fonction ecrivait et poussait sans jamais
  // verifier que cet athlete est bien celui du coach connecte.
  // Le message est celui des autres refus : un refus qui se lit autrement se
  // diagnostique autrement.
  if(!c||!_estMonAthlete(c,currentUser)){
    toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  if(!Array.isArray(c.bilans)){ toast('Athlète introuvable','var(--red)'); return false; }
  const b=c.bilans.find(x=>_idBilan(x)===bilanId);
  if(!b){ toast('Bilan introuvable','var(--red)'); return false; }
  const _premiere=!b.reponseCoach, _indice=c.bilans.indexOf(b);
  // BUILD 1874 : l'instantané d'avant, pour « Annuler » ; et une MODIFICATION
  // garde la version précédente (3 au plus, côté coach seulement).
  const _avant={reponseCoach:b.reponseCoach,reponseDate:b.reponseDate,reponseVue:b.reponseVue,
    reponsesPrecedentes:b.reponsesPrecedentes?JSON.parse(JSON.stringify(b.reponsesPrecedentes)):undefined};
  const _nouveau=avecSignature(txt).slice(0,2000);
  if(b.reponseCoach&&b.reponseCoach!==_nouveau)
    b.reponsesPrecedentes=[{t:b.reponseCoach,le:Number(b.reponseDate)||Date.now()}].concat(b.reponsesPrecedentes||[]).slice(0,REPONSES_GARDEES);
  // La signature des Réglages de coaching, en dernière ligne.
  b.reponseCoach=_nouveau;
  b.reponseDate=Date.now();
  // Repasse à false même si la réponse avait déjà été lue : une réponse
  // modifiée est une nouvelle information.
  b.reponseVue=false;
  users[email]=c;
  const ok=DB.set('users',users);
  // N3.9 — LE BROUILLON MEURT ICI, et pas avant : tant que l'envoi n'a pas eu
  // lieu, le texte doit survivre a tout. Il est oublie APRES l'ecriture
  // locale, qui est ce qui rend la reponse reelle.
  try{ rbOublierBrouillon(email,bilanId); }catch(e){}
  const envoi=CLOUD.pushOne(email,c);
  noterContact(c.id);
  if(_premiere) rcmCoach('coach_bilan_repondu');
  // LA NOTIFICATION, À LA PREMIÈRE RÉPONSE SEULEMENT, et APRÈS l'envoi : le
  // serveur relit la réponse dans la base avant de prévenir l'athlète.
  // BUILD 1874 : LA NOTIFICATION ATTEND 10 s (l'écriture, elle, est faite) :
  // « Annuler » pendant ce délai défait la réponse SANS prévenir l'athlète.
  // L'attente est persistée : app tuée, elle part au démarrage suivant.
  let _cleNotif=null;
  if(_premiere) _cleNotif=notifReponseDifferer(email,_indice,bilanId,envoi);
  toastSyncAnnulable(ok,envoi,'Réponse envoyée à '+nomCourtClient(c)+'.','la réponse est',
    ()=>annulerReponseBilan(email,bilanId,_avant,txt,_cleNotif),NOTIF_REPONSE_DELAI_MS);
  // LE RETOUR À L'ASSISTANT (ia.js, iaRetour) : ce que le coach a fait de la
  // proposition, et de combien le texte envoyé s'en écarte. Sans attendre, et
  // une erreur ici ne dit rien : la réponse, elle, est partie.
  try{
    const jid=ta&&ta.dataset.journalId;
    if(jid&&CLOUD&&CLOUD._callFn){
      const prop=ta.dataset.iaProposition||'';
      const distance=_distanceTexte(prop,txt);
      const statut=ta.dataset.iaUtilisee!=='1'?'rejete':(distance===0?'valide':'modifie');
      delete ta.dataset.journalId; delete ta.dataset.iaProposition; delete ta.dataset.iaUtilisee;
      Promise.resolve(CLOUD._callFn('iaRetour',{journalId:jid,statut,distance})).catch(()=>{});
    }
  }catch(e){}
  // ENCHAÎNEMENT. Quand le coach est entré par la ligne « Nouveaux bilans à
  // lire », on lui propose le suivant plutôt que de le renvoyer sur la fiche :
  // il devait sinon repasser par le tableau de bord entre chaque réponse.
  //
  // File vide, athlète hors file, ou volet introuvable : on retombe sur le
  // retour à la fiche, c’est-à-dire exactement le comportement d’avant.
  // LES ANCIENS D'ABORD (06/10/2026) : un bilan plus ancien resté sans
  // réponse est proposé, AVANT « Athlète suivant → ».
  let anciens=false;
  try{
    if(bilansAnciensSansReponse(c).length){
      renderBilanEvolution(c); evoTab('reponses'); _renderQuickCommentChips('bilan');
      anciens=true;
    }
  }catch(e){}
  let suivant=false;
  try{ suivant=_proposerBilanSuivant(_fileBilansSuivants(c.id)); }catch(e){}
  if(anciens){ try{ _proposerAnciensBilans(c); }catch(e){} return true; }
  if(suivant) return true;
  try{ openClientDetail(c.id,true); }catch(e){}
  return true;
}
// Bloc de réponse, rendu SOUS chaque bilan — côté coach uniquement.
// LES DEUX IDENTIFIANTS DE CE BLOC, DERIVES DE L IDENTIFIANT DU BILAN.
//
// renderReponsesBilans emet ce bloc une fois par bilan : des identifiants
// fixes en produisaient autant de copies, et getElementById ne rendait que le
// premier du document — le plus RECENT, puisque la liste est inversee.
//
// Deux fonctions plutot qu une concatenation a chaque endroit : la forme de la
// cle est lue par _renderQuickCommentChips, qui doit retrouver le champ a
// partir du conteneur de chips.
// ══════ N3.9 — LE TEXTE NON ENVOYE SURVIT AU RAFRAICHISSEMENT ═════════════
// La boucle de synchro rappelle openClientDetail(currentClientId,true) toutes
// les cinq minutes ; le bloc des bilans est alors reecrit EN ENTIER, et la
// zone de reponse reconstruite depuis b.reponseCoach. Le garde de saisie ne
// couvre que le cas ou un champ a le focus AU MOMENT du reveil.
//
// Sur PC la fiche s'affiche en deux colonnes : le coach redige une reponse,
// clique dans la colonne de droite pour relire une mensuration, revient — son
// texte a disparu, et rien ne l'a prevenu. C'est le geste normal de cet ecran.
//
// MEME PATRON QUE LE BROUILLON DE L'EDITEUR DE SEANCES : une ecriture dans le
// stockage local, pas dans le dossier. Rien ne monte au cloud, rien n'atteint
// l'athlete — c'est le bouton « Envoyer ma reponse » qui publie, et lui seul.
//
// UNE CLEF PAR BILAN, pas une seule pour l'ecran : la fiche rend un bloc par
// bilan, et un brouillon commun les melangerait.
//
// BORNE ET DATE. Un brouillon oublie il y a trois semaines ne decrit plus
// rien : on le laisse expirer plutot que de le reafficher sous les yeux du
// coach comme s'il venait de l'ecrire.
const RB_BROUILLON_CLE='rc_rb_brouillons';
const RB_BROUILLON_JOURS=14;
function _rbBrouillons(){
  try{ const o=JSON.parse(localStorage.getItem(RB_BROUILLON_CLE)||'null');
    return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
function _rbCle(email,bilanId){ return String(email||'')+'|'+String(bilanId||''); }
function rbNoterBrouillon(email,bilanId,txt){
  try{
    const o=_rbBrouillons();
    const k=_rbCle(email,bilanId);
    const t=String(txt||'');
    // Un champ VIDÉ n'est pas un champ sans brouillon : le coach a effacé le
    // texte pré-écrit (C2), il ne doit pas revenir au prochain rendu.
    if(!t.trim()) o[k]={t:'',ts:Date.now(),zero:1};
    else o[k]={t:t.slice(0,2000),ts:Date.now()};
    // Purge des perimes a chaque ecriture : ce stockage ne doit pas grossir
    // indefiniment, et c'est le seul moment ou on le tient deja en main.
    const limite=Date.now()-RB_BROUILLON_JOURS*864e5;
    for(const c of Object.keys(o)) if(!o[c]||!(o[c].ts>limite)) delete o[c];
    localStorage.setItem(RB_BROUILLON_CLE,JSON.stringify(o));
  }catch(e){}
  return true;
}
function rbBrouillon(email,bilanId){
  try{
    const d=_rbBrouillons()[_rbCle(email,bilanId)];
    if(!d||!(d.ts>Date.now()-RB_BROUILLON_JOURS*864e5)) return '';
    return String(d.t||'');
  }catch(e){ return ''; }
}
function rbOublierBrouillon(email,bilanId){
  try{
    const o=_rbBrouillons();
    delete o[_rbCle(email,bilanId)];
    localStorage.setItem(RB_BROUILLON_CLE,JSON.stringify(o));
  }catch(e){}
  return true;
}
// ══ LOT C2 : LE BROUILLON DE RÉPONSE AU BILAN (29/09/2026) ═══════════════
//
// Le champ de réponse d'un bilan arrive DÉJÀ ÉCRIT : ce qui a bougé, ce qui
// accroche, une question. Le coach relit, corrige, envoie. Rien ne part sans
// lui : le texte n'est qu'une valeur de départ dans le champ, et l'envoi reste
// le bouton « Envoyer ma réponse », inchangé.
//
// ⚠ IL NE DONNE AUCUN CONSEIL. Même règle que _waTexteTodo : des faits et une
//   question, jamais « baisse la charge » ni « prends un jour ». Décider de la
//   suite est le travail du coach, pas celui d'un texte pré-écrit.
// ⚠ IL NE NOMME JAMAIS UNE DOULEUR NI UNE DONNÉE DE SANTÉ. Le signal douleur
//   devient « j'aimerais qu'on fasse un point avant ta prochaine séance » :
//   le coach sait pourquoi, le texte ne le dit pas. Le sommeil, le stress et
//   les réponses du questionnaire ne sont pas repris.
// ⚠ PROFIL TCA : aucun chiffre de poids ni de calories (l'application les lui
//   masque déjà), et le signal de restriction ne sort pas.
// ⚠ SEUL LE DERNIER BILAN reçoit un brouillon : les signaux décrivent
//   maintenant, pas le mois où un vieux bilan a été rempli.

// Les signaux, dans l'ordre où ils passent devant. Au plus deux dans le texte.
// Ni calibrageDu ni blocPrioriteFini : ce sont des tâches du coach, pas des
// choses qui accrochent chez l'athlète.
const BROUILLON_SIGNAUX=Object.freeze(['douleur','douleurDiffuse','decrochage','chuteAssiduite',
  'formeBasse','volumeHaut','sautDeCharge','plateauMuscle','sousMEV','restrictionLongue','habitudesBasses']);
const BROUILLON_MAX_SIGNAUX=2;
const BROUILLON_FORMULES_DEFAUT=Object.freeze({ouverture:'Salut {prénom},',cloture:'À très vite'});
const BROUILLON_FORMULE_MAX=80;

function _brKg(v){ return (Math.round(v*10)/10).toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}); }
function _brJour(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }catch(e){ return ''; } }
// L'article devant un muscle : « les pectoraux », « le deltoïde latéral »,
// « l'avant-bras ». _brDe donne la forme après « de » (des, du, de l').
function _brArt(lib){ const l=String(lib||''); if(/[sx]$/.test(l)) return 'les '+l; if(/^[aeiouyhàâéèêîôû]/i.test(l)) return 'l\''+l; return 'le '+l; }
function _brDe(lib){ const a=_brArt(lib); return a.indexOf('les ')===0?'des '+a.slice(4):a.indexOf('le ')===0?'du '+a.slice(3):'de '+a; }
function _brListe(l){ return l.length<2?(l[0]||''):l.slice(0,-1).join(', ')+' et '+l[l.length-1]; }

// Ce qui accroche, en mots simples. Chaque entrée : {fait, question}.
// Le muscle vient des détails du signal (lib) ; rien d'autre n'en sort.
function _brSignal(k,d){
  const lib=(d&&d.muscle)?_bbMuscle(d.muscle):'';
  switch(k){
    case 'douleur': case 'douleurDiffuse':
      return {fait:'J\'aimerais qu\'on fasse un point ensemble avant ta prochaine séance.',
        question:'Quand est-ce que tu es dispo pour qu\'on en parle ?'};
    case 'decrochage':
      return {fait:'Tes dernières séances n\'ont pas été terminées'+(d&&d.prevus?' ('+d.faits+' séries sur '+d.prevus+' prévues)':'')+'.',
        question:'Qu\'est-ce qui t\'a empêché de les finir : le temps, la fatigue, un exercice en particulier ?'};
    case 'chuteAssiduite':
      return {fait:'Tu t\'entraînes moins souvent que les semaines d\'avant.',
        question:'Qu\'est-ce qui a changé dans ton emploi du temps ces dernières semaines ?'};
    case 'formeBasse':
      return {fait:'Tes notes d\'avant séance sont plus basses que d\'habitude.',
        question:'Comment tu te sens en arrivant à la salle en ce moment ?'};
    case 'volumeHaut':
      return {fait:(lib?'Le volume '+_brDe(lib):'Le volume d\'un muscle')+' est au-dessus du haut de sa fourchette deux semaines de suite.',
        question:'Comment tu récupères d\'une séance à l\'autre en ce moment ?'};
    case 'sautDeCharge':
      return {fait:'Tes deux dernières semaines ont été nettement plus chargées que le mois d\'avant.',
        question:'Comment tu encaisses ces semaines plus chargées ?'};
    case 'plateauMuscle':
      return {fait:'Tes charges sur '+(lib?_brArt(lib):'un groupe musculaire')+' ne bougent plus'+(d&&d.semaines?' depuis '+d.semaines+' semaine'+(d.semaines>1?'s':''):'')+'.',
        question:'Comment tu sens tes exercices '+(lib?'pour '+_brArt(lib)+' ':'')+'en ce moment ?'};
    case 'sousMEV':
      return {fait:(lib?'Le volume '+_brDe(lib):'Le volume d\'un muscle')+' est resté sous son minimum deux semaines de suite.',
        question:'Est-ce qu\'il y a des séries '+(lib?'pour '+_brArt(lib)+' ':'')+'que tu as dû sauter ?'};
    case 'restrictionLongue':
      return {fait:'Ça fait '+((d&&d.semaines)||'plusieurs')+' semaines qu\'on est en phase de diète.',
        question:'Comment tu vis la diète au quotidien en ce moment ?'};
    case 'habitudesBasses':
      return {fait:'Tes habitudes sont moins régulières ces derniers jours.',
        question:'Laquelle de tes habitudes est la plus dure à tenir en ce moment ?'};
  }
  return null;
}

/**
 * PURE (les caches de volume mis à part). Le brouillon de réponse à un bilan.
 * @param athlete le dossier
 * @param bilan   le bilan auquel on répond
 * @param signaux le résultat de signauxEntrainement (complet de préférence)
 * @param opts    {formules:{ouverture,cloture}, maintenant}
 * @return {texte, bouge:[], accroche:[], question, signaux:[clés retenues]}
 */
function brouillonBilan(athlete,bilan,signaux,opts){
  const o=opts||{}, u=athlete||{}, b=bilan||{};
  const t=Number(b.date)||Number(o.maintenant)||Date.now();
  const tca=(()=>{ try{ return aTCA(u); }catch(e){ return false; } })();
  const bilans=(u.bilans||[]).filter(x=>x&&x.date&&Number(x.date)<t).sort((x,y)=>x.date-y.date);
  const prec=bilans.length?bilans[bilans.length-1]:null;
  const bouge=[];

  // ── LE POIDS. La moyenne sur 7 jours quand il y en a une aux deux dates,
  // sinon les pesées des deux bilans. Pas de bilan pesé avant : on le dit.
  if(!tca){
    let serie=[]; try{ serie=serieWeight(u); }catch(e){}
    const jour=_jourISO(t);
    const mmNow=mm7(serie,jour), mmAvant=prec?mm7(serie,_jourISO(prec.date)):null;
    const kg=getBW(b);
    const kgAvant=(()=>{ for(let i=bilans.length-1;i>=0;i--){ const v=getBW(bilans[i]); if(v!=null) return {v,date:bilans[i].date}; } return null; })();
    if(mmNow!=null&&mmAvant!=null){
      const d=mmNow-mmAvant;
      bouge.push('Ton poids moyen sur 7 jours est passé de '+_brKg(mmAvant)+' à '+_brKg(mmNow)+' kg depuis ton dernier bilan'
        +(Math.abs(d)<0.1?', stable.':' ('+(d>0?'+':'−')+_brKg(Math.abs(d))+' kg).'));
    } else if(kg!=null&&kgAvant){
      const d=kg-kgAvant.v;
      bouge.push('Tu pèses '+_brKg(kg)+' kg, contre '+_brKg(kgAvant.v)+' kg au bilan du '+_brJour(kgAvant.date)
        +(Math.abs(d)<0.1?' : stable.':' ('+(d>0?'+':'−')+_brKg(Math.abs(d))+' kg).'));
    } else if(kg!=null||mmNow!=null){
      bouge.push('Ton poids : '+_brKg(kg!=null?kg:mmNow)+' kg. C\'est notre premier point de repère pour la suite.');
    }
  }

  // ── LES SÉANCES depuis le bilan précédent (quatre semaines sans lui).
  const debut=prec?Number(prec.date):t-28*864e5;
  const faites=(u.sessions||[]).filter(s=>s&&Number(s.date)>debut&&Number(s.date)<=t).length;
  let parSem=0; try{ parSem=_creneauxPrevus(u); }catch(e){}
  const semaines=Math.max(1,Math.round((t-debut)/(7*864e5)));
  const depuis=prec?'depuis ton dernier bilan':'sur les quatre dernières semaines';
  if(!faites) bouge.push('Aucune séance enregistrée '+depuis+'.');
  else bouge.push(faites+' séance'+(faites>1?'s':'')+' faite'+(faites>1?'s':'')
    +(parSem?' sur '+(parSem*semaines)+' prévue'+(parSem*semaines>1?'s':''):'')+' '+depuis+'.');

  // ── LE VOLUME de la dernière semaine terminée, lu contre les repères.
  try{
    const lundi=_lundiDe(new Date(t));
    const cle=semaineISO(new Date(lundi.getTime()-864e5));
    const v=volumeSemaine(u,cle)||{};
    const dans=[], sous=[], dessus=[];
    for(const m of Object.keys(v)){
      if(!(v[m]>0)) continue;
      const rep=reperesEffectifs(u,m);
      if(!rep) continue;
      if(v[m]<rep.mev) sous.push(_bbMuscle(m));
      else if(v[m]>rep.mrv) dessus.push(_bbMuscle(m));
      else dans.push(_bbMuscle(m));
    }
    if(dans.length||sous.length||dessus.length){
      const lundiSem=new Date(lundi); lundiSem.setDate(lundiSem.getDate()-7);
      const p=[];
      if(dans.length) p.push(dans.length+' muscle'+(dans.length>1?'s':'')+' dans leur fourchette');
      const noms=l=>_brListe(l.slice(0,3).map(_brArt).concat(l.length>3?[(l.length-3)+' autre'+(l.length>4?'s':'')]:[]));
      if(sous.length) p.push(noms(sous)+' sous leur minimum');
      if(dessus.length) p.push(noms(dessus)+' au-dessus du haut de leur fourchette');
      bouge.push('Volume de la semaine du '+_brJour(lundiSem)+' : '+p.join(', ')+'.');
    }
  }catch(e){}

  // ── CE QUI ACCROCHE : deux signaux au plus, douleur et diffuse comptent pour un.
  const s=signaux||{}, det=s.details||{};
  const retenus=[], accroche=[];
  let question='';
  for(const k of BROUILLON_SIGNAUX){
    if(retenus.length>=BROUILLON_MAX_SIGNAUX) break;
    if(!s[k]) continue;
    if(k==='restrictionLongue'&&tca) continue;
    if(k==='douleurDiffuse'&&retenus.indexOf('douleur')>=0) continue;
    const x=_brSignal(k,det[k]);
    if(!x) continue;
    retenus.push(k); accroche.push(x.fait);
    if(!question) question=x.question;
  }
  // BUILD 1877 : une phrase tirée des alertes du bilan (comparerBilans), si
  // la place le permet — la douleur reste devant.
  let _alerte=null;
  try{
    const sv=_cbSuivis(u).filter(x=>Number(x.date)<t);
    if(b.type!=='depart'&&sv.length&&retenus.length<BROUILLON_MAX_SIGNAUX){
      _alerte=_brPhraseAlertes(comparerBilans(sv[sv.length-1],b,u).alertes,tca);
      if(_alerte){ accroche.push(_alerte.phrase); retenus.push('alerteBilan'); if(retenus.indexOf('douleur')<0&&retenus.indexOf('douleurDiffuse')<0) question=_alerte.question; }
    }
  }catch(e){}
  if(!question) question='Qu\'est-ce qui t\'a paru le plus facile, et le plus dur, depuis '+(prec?'ton dernier bilan':'le début')+' ?';

  // ── LE CADRE : la formule du coach, réglée une fois.
  const f=o.formules||{};
  const ctx={prenom:u.fname||''};
  const ouv=templateResoudre(String(f.ouverture!=null?f.ouverture:BROUILLON_FORMULES_DEFAUT.ouverture),ctx).texte.trim();
  const clo=templateResoudre(String(f.cloture!=null?f.cloture:BROUILLON_FORMULES_DEFAUT.cloture),ctx).texte.trim();
  const blocs=[bouge.join(' '),accroche.join(' '),question].filter(Boolean);
  const texte=[ouv].concat(blocs,[clo]).filter(Boolean).join('\n\n');
  return {texte,bouge,accroche,question,signaux:retenus};
}

// La formule du coach : son réglage, sinon celle par défaut.
function formulesReponse(coach){
  // Les Réglages de coaching d'abord (build 1811), l'ancien champ ensuite.
  const rg=coach&&coach.reglagesCoach&&coach.reglagesCoach.formules;
  const f=(rg&&typeof rg==='object'?rg:null)||(coach&&coach.reponseFormules)||{};
  return {ouverture:typeof f.ouverture==='string'?f.ouverture:BROUILLON_FORMULES_DEFAUT.ouverture,
    cloture:typeof f.cloture==='string'?f.cloture:BROUILLON_FORMULES_DEFAUT.cloture};
}
// Le brouillon du champ, ou '' quand ce bilan n'en reçoit pas : pas le dernier
// bilan, déjà répondu, ou le coach a choisi de repartir de zéro.
function _brouillonPourChamp(b,c){
  if(!b||!c||bilanRepondu(b)) return '';
  const derniers=(c.bilans||[]).filter(x=>x&&x.date).sort((x,y)=>y.date-x.date);
  if(!derniers.length||_idBilan(derniers[0])!==_idBilan(b)) return '';
  if(rbRepartiDeZero(c.email,_idBilan(b))) return '';
  let sig=null; try{ sig=signauxEntrainement(c,{complet:true}); }catch(e){ sig=null; }
  try{ return brouillonBilan(c,b,sig,{formules:formulesReponse(currentUser)}).texte; }catch(e){ return ''; }
}
// ══ C2 RÉÉCRIT PAR L'ASSISTANT (05/10/2026) ════════════════════════════════
// Le brouillon déterministe reste la base, et le repli : « Réécrire avec
// l'assistant » envoie au serveur (cloudflare/src/ia.js, tâche 'bilan') les
// FAITS du brouillon et les mots de l'athlète, et rien d'autre. Le serveur
// rejette tout texte qui avance un chiffre absent des faits.
// ⚠ PROFIL TCA : rien ne part (null) — le brouillon reste déterministe.
// ⚠ JAMAIS ENVOYÉS : les champs « alerte » du bilan de départ (deb-health,
//   deb-traitement, deb-tca), le sommeil et le stress CHIFFRÉS (bil-sleep-
//   quality, bil-stress). Seuls cinq champs de texte libre partent, nommés
//   ci-dessous, chacun coupé.
const IA_BILAN_TEXTE_MAX=1200, IA_BILAN_NOTES_N=8, IA_BILAN_NOTE_MAX=300;
const IA_BILAN_STYLE_N=3, IA_BILAN_STYLE_MAX=800, IA_DISTANCE_MAX=4000;
const IA_BILAN_LIBRES=Object.freeze({difficultes:'bil-diff-detail',ecarts:'bil-cheat-reasons',
  modifs:'bil-prog-modifs',stress:'bil-stress-detail',objectifs:'bil-new-goals-detail'});
/**
 * PURE (les caches de volume mis à part). Ce que le serveur reçoit pour
 * réécrire le brouillon C2, ou null (profil TCA, rien à réécrire).
 * @param c       le dossier de l'athlète
 * @param bilan   le bilan auquel on répond
 * @param signaux signauxEntrainement (complet de préférence)
 * @param coach   le coach (sa formule, son adresse)
 */
function chargeBrouillonIA(c,bilan,signaux,coach){
  if(!c||!bilan) return null;
  const tca=(()=>{ try{ return aTCA(c); }catch(e){ return true; } })();
  if(tca) return null;
  const formules=formulesReponse(coach);
  const br=brouillonBilan(c,bilan,signaux,{formules});
  const coupe=(v,n)=>String(v==null?'':v).trim().slice(0,n);
  const texteLibre={};
  for(const k of Object.keys(IA_BILAN_LIBRES)) texteLibre[k]=coupe(_texteReponse(bilan[IA_BILAN_LIBRES[k]]),IA_BILAN_TEXTE_MAX);
  // Les notes de séance depuis le bilan précédent (quatre semaines sans lui).
  const t=Number(bilan.date)||Date.now();
  const prec=(c.bilans||[]).filter(x=>x&&x.date&&Number(x.date)<t).sort((x,y)=>y.date-x.date)[0];
  const debut=prec?Number(prec.date):t-28*864e5;
  const notesSeances=(c.sessions||[]).filter(s=>s&&Number(s.date)>debut&&Number(s.date)<=t&&String(s.notes||'').trim())
    .sort((x,y)=>y.date-x.date).slice(0,IA_BILAN_NOTES_N).map(s=>coupe(s.notes,IA_BILAN_NOTE_MAX));
  // LE STYLE : les trois dernières réponses de CE coach à CET athlète. Le
  // dossier ne garde pas qui a répondu : on ne les prend que si l'athlète est
  // rattaché à ce coach.
  const kCoach=String((coach&&coach.email)||'').toLowerCase().replace(/\./g,',');
  const sienne=!!kCoach&&String(c.coachEmailKey||'').toLowerCase()===kCoach;
  const styleCoach=sienne?(c.bilans||[]).filter(x=>x&&x!==bilan&&String(x.reponseCoach||'').trim())
    .sort((x,y)=>(Number(y.reponseDate)||Number(y.date)||0)-(Number(x.reponseDate)||Number(x.date)||0))
    .slice(0,IA_BILAN_STYLE_N).map(x=>coupe(x.reponseCoach,IA_BILAN_STYLE_MAX)):[];
  return {faits:br.bouge.slice(),accroche:br.accroche.slice(),texteLibre,notesSeances,styleCoach,
    formules,prenom:String(c.fname||'')};
}
/**
 * PURE. La distance de Levenshtein entre deux textes, rapportée à la plus
 * longue des deux : 0 identiques, 1 tout réécrit. Bornée à 4 000 caractères.
 */
function _distanceTexte(a,b){
  const x=String(a==null?'':a).slice(0,IA_DISTANCE_MAX), y=String(b==null?'':b).slice(0,IA_DISTANCE_MAX);
  if(x===y) return 0;
  if(!x.length||!y.length) return 1;
  let prev=new Array(y.length+1), cur=new Array(y.length+1);
  for(let j=0;j<=y.length;j++) prev[j]=j;
  for(let i=1;i<=x.length;i++){
    cur[0]=i;
    const xi=x.charCodeAt(i-1);
    for(let j=1;j<=y.length;j++){
      const sub=prev[j-1]+(xi===y.charCodeAt(j-1)?0:1);
      cur[j]=Math.min(sub,prev[j]+1,cur[j-1]+1);
    }
    const tmp=prev; prev=cur; cur=tmp;
  }
  return Math.round(prev[y.length]/Math.max(x.length,y.length)*1000)/1000;
}
// L'appel : le champ montre l'attente ; la proposition REMPLACE le texte si le
// coach n'a pas tapé entre-temps, sinon elle s'affiche à côté avec « Utiliser ».
// Échec, quota, hors ligne : un toast calme, le brouillon reste en place.
async function rbReecrireIA(email,bilanId,taId){
  const ta=document.getElementById(taId);
  if(!ta||ta.dataset.iaAttente==='1') return false;
  const users=DB.get('users')||{}, c=users[email];
  if(!c||!_estMonAthlete(c,currentUser)){ toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  const b=(c.bilans||[]).find(x=>_idBilan(x)===bilanId);
  if(!b) return false;
  let sig=null; try{ sig=signauxEntrainement(c,{complet:true}); }catch(e){ sig=null; }
  let charge=null; try{ charge=chargeBrouillonIA(c,b,sig,currentUser); }catch(e){ charge=null; }
  if(!charge){ toast('L’assistant n’est pas proposé ici : le brouillon reste celui-ci.'); return false; }
  if(typeof navigator!=='undefined'&&navigator.onLine===false){ toast('Hors ligne : le brouillon reste celui-ci.'); return false; }
  if(!CLOUD||!CLOUD._callFn){ toast('L’assistant n’est pas joignable : le brouillon reste celui-ci.'); return false; }
  const avant=ta.value, tapeAvant=rbBrouillon(email,bilanId);
  const etat=document.getElementById('rb-ia_'+bilanId);
  ta.dataset.iaAttente='1'; ta.setAttribute('aria-busy','true'); ta.classList.add('rb-ia-attente');
  if(etat) etat.innerHTML='<span class="sub">L’assistant réécrit le brouillon…</span>';
  let r=null;
  try{ r=await CLOUD._callFn('ia',{tache:'bilan',athlete:String(email||'').toLowerCase().replace(/\./g,','),charge}); }
  catch(e){
    r=null;
    const q=e&&e.statut;
    toast(q===429?'Quota de l’assistant atteint ce mois-ci : le brouillon reste celui-ci.'
      :q===503?'L’assistant est en pause : le brouillon reste celui-ci.'
      :'L’assistant n’a pas pu répondre : le brouillon reste celui-ci.');
  }finally{
    delete ta.dataset.iaAttente; ta.removeAttribute('aria-busy'); ta.classList.remove('rb-ia-attente');
    if(etat) etat.innerHTML='';
  }
  if(!r) return false;
  if(!r.ok||!r.proposition||typeof r.proposition.texte!=='string'||!r.proposition.texte.trim()){
    toast('L’assistant n’a rien proposé d’utilisable : le brouillon reste celui-ci.'); return false; }
  const prop=r.proposition.texte.trim().slice(0,2000);
  if(r.journalId) ta.dataset.journalId=String(r.journalId);
  ta.dataset.iaProposition=prop;
  delete ta.dataset.iaUtilisee;
  const tape=ta.value!==avant||rbBrouillon(email,bilanId)!==tapeAvant;
  if(!tape) return rbUtiliserIA(email,bilanId,taId);
  if(etat) etat.innerHTML='<div class="rb-ia-prop"><div class="sub">Proposition de l’assistant (ton texte n’a pas été touché)</div>'
    +'<div class="rb-ia-texte">'+escapeHtml(prop)+'</div>'
    +'<button type="button" class="rb-lien" onclick="rbUtiliserIA(\''+escapeHtml(email)+'\',\''+escapeHtml(bilanId)+'\',\''+escapeHtml(taId)+'\')">Utiliser</button></div>';
  return true;
}
function rbUtiliserIA(email,bilanId,taId){
  const ta=document.getElementById(taId);
  if(!ta||!ta.dataset.iaProposition) return false;
  ta.value=ta.dataset.iaProposition;
  ta.dataset.iaUtilisee='1';
  delete ta.dataset.brouillon;
  rbNoterBrouillon(email,bilanId,ta.value);
  const etat=document.getElementById('rb-ia_'+bilanId);
  if(etat) etat.innerHTML='';
  return true;
}
// ══ LE POINT DE LA SEMAINE (05/10/2026) ═════════════════════════════════════
// L'app sait calculer les signaux, le Worker non : chaque jour, à
// l'ouverture, le coach dépose un résumé compact de chaque athlète actif
// (hebdo_entree/<coach>/<athlète>), seulement s'il a changé. La nuit du
// dimanche au lundi, le Worker en fait le point de la semaine
// (cloudflare/src/hebdo.js), que la carte ci-dessous affiche.
// ⚠ MÊMES EXCLUSIONS QUE chargeBrouillonIA : profil TCA → ni poids ni texte
//   de bilan ; jamais deb-health / deb-traitement / deb-tca, ni sommeil ni
//   stress chiffrés. Seuls les cinq textes libres (IA_BILAN_LIBRES).
const HEBDO_ENTREE_MAX=3000, HEBDO_NOTES_N=5, HEBDO_NOTE_MAX=200, HEBDO_TEXTE_MAX=300;
const HEBDO_MOTIFS_N=6, HEBDO_MOTIF_MAX=120, HEBDO_ACTIF_JOURS=60;
const HEBDO_EMPREINTES='rc_hebdo_empreintes', HEBDO_MASQUE='rc_hebdo_masque';
/**
 * PURE (au calcul des signaux près). Le résumé d'un athlète pour la semaine
 * qui finit à `maintenant` : moins de 3 Ko, toujours.
 */
function resumeHebdoAthlete(c,maintenant){
  const u=c||{}, t=Number(maintenant)||Date.now(), debut=t-7*864e5;
  const tca=(()=>{ try{ return aTCA(u); }catch(e){ return true; } })();
  const coupe=(v,n)=>String(v==null?'':v).trim().slice(0,n);
  const semaine=(u.sessions||[]).filter(s=>s&&Number(s.date)>debut&&Number(s.date)<=t);
  let prevues=0; try{ prevues=Number(_creneauxPrevus(u))||0; }catch(e){ prevues=0; }
  let poidsTendance=null;
  if(!tca){ try{ const v=vitesseHebdo(serieWeight(u)); if(v&&isFinite(v.kgSem)) poidsTendance=Math.round(v.kgSem*100)/100; }catch(e){} }
  let urgence=0; try{ urgence=Number(urgencyScore(u))||0; }catch(e){ urgence=0; }
  let motifs=[]; try{ motifs=ccdSignaux(u).map(x=>coupe(x.motif,HEBDO_MOTIF_MAX)).filter(Boolean).slice(0,HEBDO_MOTIFS_N); }catch(e){ motifs=[]; }
  let bilanSansReponse=false; try{ bilanSansReponse=!!hasNewBilan(u); }catch(e){}
  const notes=semaine.filter(s=>String(s.notes||'').trim()).sort((a,b)=>b.date-a.date)
    .slice(0,HEBDO_NOTES_N).map(s=>coupe(s.notes,HEBDO_NOTE_MAX));
  const bil=(u.bilans||[]).filter(b=>b&&Number(b.date)>debut&&Number(b.date)<=t).sort((a,b)=>b.date-a.date)[0];
  let texteBilan=null;
  if(bil&&!tca){
    texteBilan={};
    for(const k of Object.keys(IA_BILAN_LIBRES)) texteBilan[k]=coupe(_texteReponse(bil[IA_BILAN_LIBRES[k]]),HEBDO_TEXTE_MAX);
  }
  const r={prenom:coupe(u.fname,40),urgence,motifs,seances:{faites:semaine.length,prevues},
    poidsTendance,bilanSansReponse,notes,texteBilan};
  // LA BORNE DES 3 Ko : les textes cèdent d'abord, jamais les faits.
  const taille=()=>new TextEncoder().encode(JSON.stringify(r)).length;
  while(taille()>HEBDO_ENTREE_MAX&&r.notes.length) r.notes.pop();
  if(taille()>HEBDO_ENTREE_MAX&&r.texteBilan) for(const k of Object.keys(r.texteBilan)) r.texteBilan[k]=r.texteBilan[k].slice(0,100);
  if(taille()>HEBDO_ENTREE_MAX) r.texteBilan=null;
  return r;
}
// PURE. L'empreinte d'un résumé (FNV-1a sur sa forme JSON) : même entrée,
// même empreinte — c'est elle qui évite de réécrire un résumé inchangé.
function _empreinteHebdo(r){
  const s=JSON.stringify(r);
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); }
  return (h>>>0).toString(36);
}
const _cleFb=e=>String(e||'').toLowerCase().replace(/\./g,',');
// Actif : une séance ou un bilan dans les 60 derniers jours.
function _hebdoActif(c,t){
  const lim=t-HEBDO_ACTIF_JOURS*864e5;
  return (c.sessions||[]).some(s=>s&&Number(s.date)>lim)||(c.bilans||[]).some(b=>b&&Number(b.date)>lim);
}
// Une fois par jour, à l'ouverture du tableau de bord : les résumés changés.
async function majHebdoEntrees(maintenant){
  if(!currentUser||currentUser.role!=='coach'||!SERVEUR_LEGER||!CLOUD||typeof CLOUD.racinePatch!=='function') return 0;
  const t=Number(maintenant)||Date.now();
  const jour=localISODate(new Date(t)), kCoach=_cleFb(currentUser.email);
  let cache={}; try{ cache=JSON.parse(localStorage.getItem(HEBDO_EMPREINTES)||'{}')||{}; }catch(e){ cache={}; }
  if(cache.jour===jour&&cache.coach===kCoach) return 0;
  const emp=cache.coach===kCoach&&cache.e&&typeof cache.e==='object'?Object.assign({},cache.e):{};
  const users=DB.get('users')||{}, maj={};
  for(const c of Object.values(users)){
    if(!c||!c.email||!_estMonAthlete(c,currentUser)||!_hebdoActif(c,t)) continue;
    let r=null; try{ r=resumeHebdoAthlete(c,t); }catch(e){ r=null; }
    if(!r) continue;
    const k=_cleFb(c.email), h=_empreinteHebdo(r);
    if(emp[k]===h) continue;
    maj['hebdo_entree/'+kCoach+'/'+k]=r; emp[k]=h;
  }
  if(Object.keys(maj).length){
    let ok=false; try{ ok=await CLOUD.racinePatch(maj); }catch(e){ ok=false; }
    if(!ok) return 0;                 // demain, ou à la prochaine ouverture
  }
  try{ localStorage.setItem(HEBDO_EMPREINTES,JSON.stringify({jour,coach:kCoach,e:emp})); }catch(e){}
  return Object.keys(maj).length;
}
// Le dernier point écrit par le Worker (hebdo/<coach>, la dernière semaine).
async function _lirePointSemaine(){
  if(!currentUser||!CLOUD||typeof CLOUD._getToken!=='function') return null;
  const token=await CLOUD._getToken();
  if(!token) return null;
  const url=CLOUD._fbUrl.replace('users.json','hebdo/'+encodeURIComponent(_cleFb(currentUser.email))+'.json')
    +'?orderBy=%22%24key%22&limitToLast=1&auth='+token;
  const r=await fetch(url);
  if(!r.ok) return null;
  const v=await r.json();
  const sem=v&&typeof v==='object'?Object.keys(v).sort().pop():null;
  return sem?{semaine:sem,point:v[sem]}:null;
}
const HEBDO_TITRES=Object.freeze({aTraiter:'À traiter',progres:'Ce qui avance',silencieux:'Silencieux'});
// PURE. La carte « Ton point de la semaine », ou '' (rien, masqué).
function _htmlPointSemaine(lu,clients){
  if(!lu||!lu.point) return '';
  const p=lu.point, parCle={};
  for(const c of (clients||[])) if(c&&c.email&&c.id!=null) parCle[_cleFb(c.email)]=c;
  let lignes='';
  for(const s of Object.keys(HEBDO_TITRES)){
    const l=((p.sections&&p.sections[s])||[]).filter(x=>x&&parCle[x.athlete]);
    if(!l.length) continue;
    lignes+='<div class="ps-sec"><div class="ps-tit">'+HEBDO_TITRES[s]+'</div>'
      +l.map(x=>{ const c=parCle[x.athlete];
        return '<button type="button" class="ps-ligne" onclick="openClientDetail('+escapeHtml(JSON.stringify(c.id))+')">'
          +'<b>'+escapeHtml(c.fname||x.athlete)+'</b><span>'+escapeHtml(x.pourquoi||'')+'</span></button>'; }).join('')+'</div>';
  }
  if(!lignes&&!p.texte) return '';
  return '<section class="ps-carte content-card" aria-label="Ton point de la semaine">'
    +'<div class="ps-tete"><h3>Ton point de la semaine</h3>'
    +'<button type="button" class="rb-lien" onclick="masquerPointSemaine(\''+escapeHtml(lu.semaine)+'\')">Masquer</button></div>'
    +(p.texte?'<p class="ps-texte">'+escapeHtml(p.texte)+'</p>':'')+lignes+'</section>';
}
async function renderPointSemaine(){
  const z=document.getElementById('ch-point-semaine');
  if(!z) return false;
  let lu=null; try{ lu=await _lirePointSemaine(); }catch(e){ lu=null; }
  let masque=''; try{ masque=localStorage.getItem(HEBDO_MASQUE)||''; }catch(e){ masque=''; }
  if(!lu||masque===lu.semaine){ z.innerHTML=''; return false; }
  let clients=[]; try{ clients=Object.values(DB.get('users')||{}).filter(c=>c&&_estMonAthlete(c,currentUser)); }catch(e){ clients=[]; }
  z.innerHTML=_htmlPointSemaine(lu,clients);
  return !!z.innerHTML;
}
// « Masquer » : un choix LOCAL, pour cette semaine seulement.
function masquerPointSemaine(semaine){
  try{ localStorage.setItem(HEBDO_MASQUE,String(semaine||'')); }catch(e){}
  const z=document.getElementById('ch-point-semaine');
  if(z) z.innerHTML='';
  return true;
}
// « Repartir de zéro » : le champ se vide, et il le RESTE au prochain rendu
// (le brouillon ne revient pas tout seul). Local, comme le brouillon tapé.
function rbRepartiDeZero(email,bilanId){
  try{
    const d=_rbBrouillons()[_rbCle(email,bilanId)];
    return !!(d&&d.zero&&d.ts>Date.now()-RB_BROUILLON_JOURS*864e5);
  }catch(e){ return false; }
}
function rbRepartirDeZero(email,bilanId,taId){
  rbNoterBrouillon(email,bilanId,'');
  const ta=document.getElementById(taId);
  if(ta){ ta.value=''; delete ta.dataset.brouillon; ta.focus(); }
  const l=document.getElementById('rb-zero_'+bilanId);
  if(l) l.style.display='none';
  return true;
}
// Curseur à la fin, au PREMIER focus d'un champ pré-écrit : le coach arrive
// pour compléter, pas pour réécrire le début.
function _rbCurseurFin(ta){
  if(!ta||ta.dataset.brouillon!=='1') return;
  delete ta.dataset.brouillon;
  setTimeout(()=>{ try{ const n=ta.value.length; ta.setSelectionRange(n,n); ta.scrollTop=ta.scrollHeight; }catch(e){} },0);
}
// Le réglage, une fois : une ouverture et une clôture, {prénom} reconnu.
function ouvrirFormulesReponse(){
  const f=formulesReponse(currentUser);
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:2px">Ma formule</h2>
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.6">Elle encadre chaque brouillon de réponse aux bilans. {prénom} est remplacé par le prénom de l'athlète.</p>
    <label class="sub" for="rbf-ouv" style="display:block;font-size:var(--fs-xs);margin-bottom:4px;text-transform:none">Ouverture</label>
    <input id="rbf-ouv" maxlength="${BROUILLON_FORMULE_MAX}" value="${escapeHtml(f.ouverture)}" autocomplete="off" style="width:100%;box-sizing:border-box;margin-bottom:10px">
    <label class="sub" for="rbf-clo" style="display:block;font-size:var(--fs-xs);margin-bottom:4px;text-transform:none">Clôture</label>
    <input id="rbf-clo" maxlength="${BROUILLON_FORMULE_MAX}" value="${escapeHtml(f.cloture)}" autocomplete="off" style="width:100%;box-sizing:border-box">
    <button class="btn btn-red" style="margin-top:14px;width:100%" onclick="enregistrerFormulesReponse()">Enregistrer</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function enregistrerFormulesReponse(){
  if(!currentUser) return false;
  const lire=id=>String(((document.getElementById(id)||{}).value)||'').replace(/\s+/g,' ').trim().slice(0,BROUILLON_FORMULE_MAX);
  // UN SEUL OBJET (build 1811) : la formule vit dans reglagesCoach.
  reglageEcrire('formules',{ouverture:lire('rbf-ouv'),cloture:lire('rbf-clo')},currentUser);
  try{ saveUser(); }catch(e){ rcErreurMuette('enregistrerFormulesReponse',e); }
  closeModal();
  toast('Formule enregistrée '+ICO.coche,'var(--green)');
  return true;
}
function _qcIdBilan(id){ return 'qc-chips-bilan_'+id; }
function _taIdBilan(id){ return 'rb-texte_'+id; }
// ══ BUILD 1868 : « LUI DEMANDER DE COMPLÉTER » ════════════════════════════
// Même patron que la mesure demandée (_htmlCcdManque) : une ligne, un bouton,
// puis « Demandé le … · Retirer la demande ». Double clic sans effet.
function _bilDuClient(email,bilanId){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||c._fromCode||!_estMonAthlete(c,currentUser)||!Array.isArray(c.bilans)) return null;
  const b=c.bilans.find(x=>_idBilan(x)===bilanId);
  return b?{users,c,b}:null;
}
function _apresDemandeCompleter(c){
  try{ renderBilanEvolution(c); evoTab('reponses'); _renderQuickCommentChips('bilan'); }catch(e){}
}
function demanderCompleterBilan(email,bilanId){
  const r=_bilDuClient(email,bilanId);
  if(!r){ toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  const {users,c,b}=r;
  if(b.aCompleter) return true;
  const m=manquesBilan(b,c);
  if(_manquesVides(m)) return false;
  const t=Date.now();
  b.aCompleter={vues:m.vues,mesures:m.mesures,note:'',le:t,par:String(currentUser.id||'')};
  c.updatedAt=t; users[email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(email,c);
  const i=c.bilans.indexOf(b);
  Promise.resolve(envoi).then(x=>{ if(x!==false) deposerEvenement({type:'bilan_a_completer',dest:email.replace(/\./g,','),i:String(i)}); }).catch(()=>{});
  toastSync(ok,envoi,'Demande envoyée. '+(c.fname||'Ton athlète')+' la verra sur son accueil.','la demande est');
  _apresDemandeCompleter(c);
  return true;
}
function retirerDemandeCompleter(email,bilanId){
  const r=_bilDuClient(email,bilanId);
  if(!r||!r.b.aCompleter) return false;
  const {users,c,b}=r;
  delete b.aCompleter;
  c.updatedAt=Date.now(); users[email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(email,c);
  toastSync(ok,envoi,'Demande retirée','le retrait est');
  _apresDemandeCompleter(c);
  return true;
}
function _htmlDemandeCompleter(b,c){
  if(!b||!c||c._fromCode) return '';
  const d=b.aCompleter;
  const m=d?{vues:Array.isArray(d.vues)?d.vues:[],mesures:Array.isArray(d.mesures)?d.mesures:[]}:manquesBilan(b,c);
  if(!d&&_manquesVides(m)) return '';
  const em=escapeHtml(c.email||''), ide=escapeHtml(_idBilan(b));
  return '<p class="ccd-manque ccd-manque-a"><span class="ccd-manque-t">Il manque : '+escapeHtml(texteManquesBilan(m)||'—')+'</span>'
    +(d
      ?'<span class="ccd-manque-d">Demandé le '+escapeHtml(_ccdJour(d.le))+'.'
        +'<button type="button" class="ccd-out-r" onclick="retirerDemandeCompleter(\''+em+'\',\''+ide+'\')">Retirer la demande</button></span>'
      :'<button type="button" class="ccd-manque-b" onclick="demanderCompleterBilan(\''+em+'\',\''+ide+'\')">Lui demander de compléter</button>')
    +'</p>';
}
// ══ BUILD 1874 : UNE RÉPONSE SE RETIRE, SE DÉFAIT, GARDE SES VERSIONS ══════
const NOTIF_REPONSE_DELAI_MS=10000, REPONSES_GARDEES=3, NOTIF_ATTENTE_CLE='rc_notif_reponse_attente';
function _notifsAttente(){ try{ const l=JSON.parse(localStorage.getItem(NOTIF_ATTENTE_CLE)||'[]'); return Array.isArray(l)?l:[]; }catch(e){ return []; } }
function _notifsEcrire(l){ try{ if(l.length) localStorage.setItem(NOTIF_ATTENTE_CLE,JSON.stringify(l)); else localStorage.removeItem(NOTIF_ATTENTE_CLE); }catch(e){} }
// Dépose l'événement 10 s après, si personne n'a annulé. Rend la clé de l'attente.
function notifReponseDifferer(email,indice,bilanId,envoi){
  const cle='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  const l=_notifsAttente();
  l.push({cle,email,i:String(indice),bilanId,at:Date.now()+NOTIF_REPONSE_DELAI_MS,par:currentUser&&currentUser.email});
  _notifsEcrire(l);
  setTimeout(()=>{ Promise.resolve(envoi).then(r=>{ if(r!==false) _notifPartir(cle); }).catch(()=>{}); },NOTIF_REPONSE_DELAI_MS);
  return cle;
}
function _notifPartir(cle){
  const l=_notifsAttente();
  const x=l.find(n=>n.cle===cle);
  if(!x) return false;
  _notifsEcrire(l.filter(n=>n.cle!==cle));
  try{ deposerEvenement({type:'reponse_bilan',dest:String(x.email).replace(/\./g,','),i:x.i}); }catch(e){}
  return true;
}
function notifReponseAnnuler(cle){
  const l=_notifsAttente();
  const n=l.length;
  _notifsEcrire(l.filter(x=>x.cle!==cle));
  return _notifsAttente().length!==n;
}
// Au démarrage : ce qui attendait encore quand l'app a été tuée part maintenant.
function rejouerNotifsReponse(){
  if(!currentUser||!currentUser.email) return 0;
  const t=Date.now(); let n=0;
  for(const x of _notifsAttente()) if(x.par===currentUser.email&&Number(x.at)<=t&&_notifPartir(x.cle)) n++;
  return n;
}
try{
  if(typeof window!=='undefined') window.addEventListener('load',()=>{ setTimeout(()=>{ try{ rejouerNotifsReponse(); }catch(e){} },6000); });
}catch(e){}
function _bilanDuCoach(email,bilanId){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!_estMonAthlete(c,currentUser)||!Array.isArray(c.bilans)) return null;
  const b=c.bilans.find(x=>_idBilan(x)===bilanId);
  return b?{users,c,b}:null;
}
// « Annuler » du toast : l'état d'avant revient, aucune notification ne
// part, et le texte retourne au brouillon.
function annulerReponseBilan(email,bilanId,avant,txt,cleNotif){
  if(cleNotif) notifReponseAnnuler(cleNotif);
  const r=_bilanDuCoach(email,bilanId);
  if(!r) return 'Élève introuvable ou non autorisé : la réponse n’a pas été retirée.';
  const {users,c,b}=r;
  for(const k of ['reponseCoach','reponseDate','reponseVue','reponsesPrecedentes']){
    if(avant[k]===undefined||avant[k]===null) delete b[k]; else b[k]=avant[k];
  }
  c.updatedAt=Date.now(); users[email]=c; DB.set('users',users);
  try{ CLOUD.pushOne(email,c).catch(()=>{}); }catch(e){}
  try{ rbNoterBrouillon(email,bilanId,txt); }catch(e){}
  try{ renderBilanEvolution(c); evoTab('reponses'); }catch(e){}
  return true;
}
// « Retirer ma réponse » : le texte est gardé (reponsesRetirees, 3 au plus) et
// remis au brouillon. Déjà lue : on le dit avant.
async function retirerReponseBilan(email,bilanId){
  const r=_bilanDuCoach(email,bilanId);
  if(!r){ toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  const {users,c,b}=r;
  if(!b.reponseCoach) return false;
  if(b.reponseVue===true&&!await rcConfirm('Retirer ta réponse ?',nomCourtClient(c)+' l’a déjà lue.','Retirer')) return false;
  const txt=b.reponseCoach;
  b.reponsesRetirees=[{t:txt,le:Date.now()}].concat(b.reponsesRetirees||[]).slice(0,REPONSES_GARDEES);
  delete b.reponseCoach; delete b.reponseDate; delete b.reponseVue;
  for(const x of _notifsAttente()) if(x.email===email&&x.bilanId===bilanId) notifReponseAnnuler(x.cle);
  c.updatedAt=Date.now(); users[email]=c;
  const ok=DB.set('users',users);
  try{ rbNoterBrouillon(email,bilanId,txt); }catch(e){}
  toastSync(ok,CLOUD.pushOne(email,c),'Réponse retirée : le texte est dans ton brouillon.','le retrait est');
  try{ renderBilanEvolution(c); evoTab('reponses'); }catch(e){}
  return true;
}
// BUILD 1878 : « Compléter ma réponse » — un paragraphe AJOUTÉ à la réponse
// envoyée, jamais à sa place. Le champ se pré-remplit avec l'existant suivi
// d'une ligne vide ; « Envoyer » garde la version précédente (1874).
function completerReponseBilan(email,bilanId){
  const ta=document.getElementById(_taIdBilan(bilanId));
  const r=_bilanDuCoach(email,bilanId);
  if(!ta||!r) return false;
  const base=String(r.b.reponseCoach||'');
  if(ta.value.trim()===base.trim()||!ta.value.trim()) ta.value=base+(base?'\n\n':'')+'Suite à ta correction : ';
  try{ ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); ta.scrollIntoView({block:'center'}); }catch(e){}
  return true;
}
function blocReponseBilan(b,c){
  if(!b||!c) return '';
  const id=_idBilan(b);
  const dejaLue=b.reponseVue===true;
  const tca=(()=>{ try{ return aTCA(c); }catch(e){ return false; } })();
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    ${_htmlDemandeCompleter(b,c)}
    ${b.reponseCoach?`<div style="background:var(--surface-2);border-radius:var(--r-2);padding:10px 12px;margin-bottom:10px">
      <div style="font-size:var(--fs-xs);letter-spacing:1.5px;text-transform:uppercase;color:var(--sub);font-weight:800;margin-bottom:4px">Ta réponse${dejaLue?' · lue':' · non lue'}</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(b.reponseCoach)}</div>
      <div class="sub" style="font-size:var(--fs-2xs);line-height:1.5;margin-top:4px">${(b.reponsesPrecedentes&&b.reponsesPrecedentes.length)?'Modifiée le '+escapeHtml(_ccdJour(b.reponseDate))+' · ':''}<button type="button" class="rb-lien" onclick="retirerReponseBilan('${escapeHtml(c.email||'')}','${escapeHtml(id)}')">Retirer ma réponse</button></div>
    </div>`:''}
    ${tca?`<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);padding:10px 12px;margin-bottom:10px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
      Les chiffres de poids sont masqués dans son application. Évite de les citer par message.
    </div>`:''}
    <div id="${_qcIdBilan(id)}" style="display:flex;gap:6px;overflow-x:auto;padding:6px 0 8px;scrollbar-width:none;-ms-overflow-style:none"></div>
    ${(()=>{
      // N3.9 — LE BROUILLON PRIME SUR LA REPONSE ENVOYEE. S'il y a un texte
      // non envoye, c'est celui que le coach etait en train d'ecrire : le
      // remplacer par la version publiee serait exactement la perte qu'on
      // corrige. Sans brouillon, rien ne change — la reponse envoyee revient,
      // comme avant.
      const bro=rbBrouillon(c.email,id);
      // C2 : sans brouillon tapé ni réponse envoyée, le dernier bilan arrive
      // pré-écrit (brouillonBilan). Il n'est enregistré nulle part tant que le
      // coach n'y touche pas, et rien ne part sans son geste.
      const pre=(!bro&&!bilanRepondu(b))?_brouillonPourChamp(b,c):'';
      const val=bro||(b.reponseCoach||'')||pre;
      const em=escapeHtml(c.email||''), ide=escapeHtml(id);
      return `<textarea id="${_taIdBilan(id)}" rows="${pre?9:3}"${pre?' data-brouillon="1" onfocus="_rbCurseurFin(this)"':''} oninput="rbNoterBrouillon('${em}','${ide}',this.value)" placeholder="Ce que tu retiens de ce bilan, et ce qu'on ajuste." style="width:100%;box-sizing:border-box">${escapeHtml(val)}</textarea>`
        +(bro&&bro!==(b.reponseCoach||'')
          ?`<div class="sub" style="font-size:var(--fs-2xs);line-height:1.5;margin-top:4px">Brouillon non envoyé, retrouvé tel que tu l’avais laissé.</div>`
          :'')
        +(pre
          ?`<div class="rb-pre" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-top:4px;font-size:var(--fs-2xs);line-height:1.5">
              <span class="sub">Brouillon pré-écrit : relis-le avant d’envoyer.</span>
              <button type="button" id="rb-zero_${ide}" class="rb-lien" onclick="rbRepartirDeZero('${em}','${ide}','${_taIdBilan(id)}')">Repartir de zéro</button>
              <button type="button" class="rb-lien" onclick="ouvrirFormulesReponse()">Ma formule</button>
              ${(!tca&&SERVEUR_LEGER)?`<button type="button" class="rb-lien" onclick="rbReecrireIA('${em}','${ide}','${_taIdBilan(id)}')">Réécrire avec l’assistant</button>`:''}
            </div>
            <div id="rb-ia_${ide}" class="rb-ia" aria-live="polite"></div>`
          :'');
    })()}
    ${(b.traite&&!bilanRepondu(b))?`<div class="sub" style="font-size:var(--fs-2xs);line-height:1.5;margin-top:4px">Marqué traité, sans réponse écrite. <button type="button" class="rb-lien" onclick="bilanMarquerTraite('${escapeHtml(c.email||'')}','${escapeHtml(id)}',false)">Annuler</button></div>`:''}
    <button class="btn btn-red btn-sm" onclick="saveReponseBilan('${escapeHtml(c.email||'')}','${escapeHtml(id)}','${_taIdBilan(id)}')"
      style="margin-top:8px;letter-spacing:1px">Envoyer à ${escapeHtml(String(c.fname||'').trim()||'ton athlète')}</button>
    ${_rvHtml(b,c)}
  </div>`;
}

// « client » n'est fourni que par l'ecran COACH. Sans lui on est cote
// athlete : la reponse du coach s'affiche en lecture seule, et surtout PAS
// le formulaire d'ecriture — ce rendu est partage par les deux ecrans, et
// l'oublier aurait mis un bouton « Envoyer ma reponse » sur les bilans de
// l'athlete lui-meme.
// ══ L'ONGLET NOTES, AU DESSIN DE LA MAQUETTE DE KEVIN (27/09/2026) ═══════
//
// « change l'onglet info dans Évolution comme ça » : un bilan à la fois,
// choisi par des pastilles ; une carte d'en-tête (numéro, date, poids) ; les
// réponses rangées en quatre rubriques à icône, sur deux colonnes ; des
// jauges pour la motivation, le sommeil et le stress.
//
// ⚠ LES JAUGES LISENT LA REPONSE, ELLES N'INVENTENT RIEN. La motivation est
//   notée sur 10 : la jauge est ce chiffre. Le sommeil et le stress sont des
//   CHOIX (BIL_OPTS_SOMMEIL, BIL_OPTS_STRESS, les mêmes que le questionnaire) :
//   la jauge dit la place du choix dans la liste, et le texte coché reste
//   écrit au-dessus. Une réponse hors liste n'a pas de jauge.
//
// Le rendu reste PARTAGÉ avec la fiche du coach (`client`) : il y garde son
// champ de réponse, et une pastille marque les bilans qui l'attendent.
const BIL_OPTS_SOMMEIL=Object.freeze(['Très bien, je me sens reposé(e)','Correct, quelques nuits agitées','Mal, j\'ai du mal à me reposer']);
const BIL_OPTS_STRESS=Object.freeze(['Pas du tout','Un peu','Beaucoup','Énormément']);
const BILAN_RUBRIQUES={
  suivi:[
    {titre:'État général',ico:'flame',cles:['bil-motivation']},
    {titre:'Difficultés et écarts',ico:'alert-triangle',cles:['bil-diff-type','bil-diff-detail','bil-cheat-meals','bil-cheat-reasons']},
    {titre:'Récupération / sommeil / stress',ico:'moon',cles:['bil-sleep-quality','bil-stress','bil-stress-detail']},
    {titre:'Objectifs et demandes',ico:'target',cles:['bil-prog-modifs','bil-new-goals','bil-new-goals-detail']},
    {titre:'Les questions du coach',ico:'message-circle',cles:['coach-q1','coach-q2','coach-q3']}
  ],
  depart:[
    {titre:'Santé et précautions',ico:'alert-triangle',cles:['deb-health','deb-traitement','deb-traitement-detail','deb-allergies','deb-tca']},
    {titre:'Objectifs',ico:'target',cles:['deb-goals']},
    {titre:'Métier et rythme',ico:'activity',cles:['deb-job','deb-naf','deb-work-rhythm']},
    {titre:'Entraînement',ico:'dumbbell',cles:['deb-location','deb-gym','deb-training-days','deb-training-time','deb-session-duration','deb-sports','deb-other-sports','deb-intensity-1','deb-intensity-2','deb-history']},
    {titre:'Nutrition',ico:'utensils',cles:['deb-nutrition-type','deb-meals-day','deb-food-love','deb-food-hate','deb-water','deb-track-macros','deb-calories','deb-supplements','deb-supps-detail']}
  ]
};
// PURE. La jauge d'une réponse : {plein, sur} en dixièmes, ou null.
function _bnJauge(k,v){
  if(k==='bil-motivation'){
    const n=Math.round(parseFloat(String(_texteReponse(v)||v).replace(',','.')));
    return (n>=1&&n<=10)?{plein:n,sur:10}:null;
  }
  const t=String(_texteReponse(v)||'').trim();
  if(k==='bil-sleep-quality'){
    const i=BIL_OPTS_SOMMEIL.indexOf(t); if(i<0) return null;
    // La QUALITÉ : le premier choix remplit la jauge, le dernier la vide presque.
    return {plein:Math.round(10*(BIL_OPTS_SOMMEIL.length-i)/BIL_OPTS_SOMMEIL.length),sur:10};
  }
  if(k==='bil-stress'){
    const i=BIL_OPTS_STRESS.indexOf(t); if(i<0) return null;
    // « Pas du tout » ne remplit rien : un stress absent n'est pas un segment rouge.
    return {plein:Math.round(10*i/(BIL_OPTS_STRESS.length-1)),sur:10};
  }
  return null;
}
// PURE. La phrase sous la motivation — une lecture, pas un jugement de santé.
function _bnMotivationNote(v){
  const n=Math.round(parseFloat(String(_texteReponse(v)||v).replace(',','.')));
  if(!(n>=1&&n<=10)) return '';
  if(n<=3) return 'Motivation basse : un point à aborder ensemble.';
  if(n<=6) return 'Motivation modérée, à travailler pour assurer la régularité.';
  if(n<=8) return 'Bonne motivation, de quoi tenir le rythme.';
  return 'Motivation au plus haut.';
}
function _bnSegments(j){
  let h='';
  for(let i=0;i<j.sur;i++) h+=`<i class="${i<j.plein?'on':''}"></i>`;
  return `<span class="bn-jauge" aria-hidden="true">${h}</span>`;
}
// Montre UN bilan, et allume sa pastille. Toutes les listes « Notes » ouvertes
// qui le portent suivent : il n'y en a qu'une à l'écran, mais on ne suppose rien.
function _bnVoir(id){
  document.querySelectorAll('.bn').forEach(bn=>{
    if(!bn.querySelector('.bn-bilan[data-bn="'+id+'"]')) return;
    bn.querySelectorAll('.bn-bilan').forEach(c=>{ c.hidden=c.getAttribute('data-bn')!==id; });
    bn.querySelectorAll('.bn-select').forEach(sel=>{ if(sel.value!==id) sel.value=id; });
  });
}
// R13 — CE QUE CETTE LISTE MONTRE : les REPONSES ECRITES de l'athlete dans
// ses bilans, pas un retour du coach. Cote athlete, il peut donc la remplir
// lui-meme ; cote coach (`client`), il ne peut qu'attendre le prochain bilan.
// Le parametre `client` distingue les deux ecrans : c'est lui qui ajoute
// le formulaire d'ecriture — ce rendu est partage par les deux ecrans, et
// l'oublier aurait mis un bouton « Envoyer ma reponse » sur les bilans de
// l'athlete lui-meme.
// ══ BUILD 1877 : D'UN BILAN À L'AUTRE ════════════════════════════════════════
// Le coach lisait chaque bilan seul et devait se souvenir du précédent.
// comparerBilans (PURE) dit ce qui a bougé et ce qui alerte.
const CB_SOMMEIL_LIB=Object.freeze(['Bien','Correct','Mauvais']);
const CB_STRESS_LIB=Object.freeze(['Aucun','Un peu','Beaucoup','Énorme']);
function _cbTexte(v){ try{ return _texteReponse(v).trim(); }catch(e){ return String(v==null?'':v).trim(); } }
function _cbMotiv(b){ const n=Math.round(parseFloat(_cbTexte(b&&b['bil-motivation']).replace(',','.'))); return (n>=1&&n<=10)?n:null; }
// Le rang dans la liste d'options ; les anciens libellés par leur début.
function _cbSommeil(b){
  const t=_cbTexte(b&&b['bil-sleep-quality']); if(!t) return null;
  const i=BIL_OPTS_SOMMEIL.indexOf(t); if(i>=0) return i;
  if(/^(tr[eè]s )?bien/i.test(t)) return 0; if(/^correct|moyen/i.test(t)) return 1; if(/^mal|mauvais/i.test(t)) return 2;
  return null;
}
function _cbStress(b){
  const t=_cbTexte(b&&b['bil-stress']); if(!t) return null;
  const i=BIL_OPTS_STRESS.indexOf(t); if(i>=0) return i;
  if(/^pas|aucun/i.test(t)) return 0; if(/^un peu/i.test(t)) return 1; if(/^beaucoup/i.test(t)) return 2; if(/^[ée]norm/i.test(t)) return 3;
  return null;
}
function _cbEcarts(b){ const t=_cbTexte(b&&b['bil-cheat-meals']); if(!t) return null; if(/^aucun/i.test(t)) return 0; const n=parseInt(t,10); return isNaN(n)?null:n; }
function _cbPhotos(b){ return BIL_VUES.filter(v=>{ try{ return photoBilanExiste(b,v); }catch(e){ return false; } }).length; }
function _cbNb(v){ return String(Math.round(v*10)/10).replace('.',','); }
// La mesure RÉELLE d'un bilan (null si reportée ou absente).
function _cbMesure(b,k){ if(!b||bmReportee(b,k)) return null; return getBM(b,k); }
// Les bilans de suivi, du plus ancien au plus récent.
function _cbSuivis(u){ return ((u&&u.bilans)||[]).filter(b=>b&&b.date&&b.type!=='depart').sort((a,b)=>a.date-b.date); }
/**
 * PURE (serieWeight mis à part). Ce qui a bougé entre deux bilans de suivi.
 * @return {lignes:[{cle,lib,avant,apres,sens,fort}], alertes:[{cle,texte}]}
 */
function comparerBilans(prec,der,u){
  const out={lignes:[],alertes:[]};
  if(!der||der.type==='depart') return out;
  const tca=(function(){ try{ return aTCA(u); }catch(e){ return false; } })();
  const sansPoids=tca||!!(u&&u.masquerPoids);
  const ligne=(cle,lib,a,b,mieuxSiPlus,fort,fmt)=>{
    if(a==null||b==null) return;
    const f=fmt||(x=>String(x));
    const d=b-a;
    const sens=Math.abs(d)<1e-9?'stable':((d>0)===mieuxSiPlus?'mieux':'moins bien');
    out.lignes.push({cle,lib,avant:f(a),apres:f(b),sens,fort:!!fort});
  };
  if(prec&&prec.type!=='depart'){
    // LE POIDS : la moyenne sur 7 jours aux deux dates, sinon les pesées des bilans.
    if(!sansPoids){
      let a=null,b=null;
      try{ const s=serieWeight(u); a=mm7(s,_jourISO(prec.date)); b=mm7(s,_jourISO(der.date)); }catch(e){}
      if(a==null||b==null){ a=getBW(prec); b=getBW(der); }
      if(a!=null&&b!=null){
        const d=b-a;
        let bon=false; try{ bon=_synPoidsDansLeSens(u,d); }catch(e){}
        out.lignes.push({cle:'poids',lib:'Poids',avant:_cbNb(a)+' kg',apres:_cbNb(b)+' kg',
          sens:Math.abs(d)<0.2?'stable':(bon?'mieux':'moins bien'),fort:Math.abs(d)>=1.5});
      }
    }
    // Les tours : on ignore les valeurs reportées (pas remesurées).
    const ta=_cbMesure(prec,'waist'), tb=_cbMesure(der,'waist');
    ligne('waist','Taille',ta,tb,false,ta!=null&&tb!=null&&Math.abs(tb-ta)>=2,x=>_cbNb(x)+' cm');
    const ha=_cbMesure(prec,'hips'), hb=_cbMesure(der,'hips');
    ligne('hips','Hanches',ha,hb,false,ha!=null&&hb!=null&&Math.abs(hb-ha)>=2,x=>_cbNb(x)+' cm');
    const ma=_cbMotiv(prec), mb=_cbMotiv(der);
    ligne('bil-motivation','Motivation',ma,mb,true,ma!=null&&mb!=null&&Math.abs(mb-ma)>=2);
    const sa=_cbSommeil(prec), sb=_cbSommeil(der);
    ligne('bil-sleep-quality','Sommeil',sa,sb,false,sa!=null&&sb!=null&&Math.abs(sb-sa)>=2,x=>CB_SOMMEIL_LIB[x]);
    const sta=_cbStress(prec), stb=_cbStress(der);
    ligne('bil-stress','Stress',sta,stb,false,sta!=null&&stb!=null&&Math.abs(stb-sta)>=2,x=>CB_STRESS_LIB[x]);
    if(!tca){
      const ea=_cbEcarts(prec), eb=_cbEcarts(der);
      ligne('bil-cheat-meals','Écarts',ea,eb,false,ea!=null&&eb!=null&&Math.abs(eb-ea)>=2,x=>x>=4?'4 ou plus':String(x));
    }
    const pa=_cbPhotos(prec), pb=_cbPhotos(der);
    if(pa!==pb) ligne('photos','Photos',pa,pb,true,false,x=>x+'/3');
  }
  // LES ALERTES. L'historique des suivis jusqu'à ce bilan.
  const suivis=_cbSuivis(u).filter(b=>Number(b.date)<=Number(der.date));
  if(!suivis.length||suivis[suivis.length-1]!==der){ suivis.push(der); }
  const m=suivis.map(_cbMotiv);
  const n=m.length;
  const m3=n>=3?m.slice(-3):null;
  if(m3&&m3.every(x=>x!=null)&&m3[0]>m3[1]&&m3[1]>m3[2])
    out.alertes.push({cle:'motivation',texte:'Motivation en baisse : '+m3.join(' → '),de:m3[0],a:m3[2],bilans:3});
  else if(m[n-1]!=null&&m[n-1]<=4)
    out.alertes.push({cle:'motivation',texte:'Motivation '+m[n-1]+'/10',a:m[n-1]});
  let mauvais=0; for(let i=n-1;i>=0&&_cbSommeil(suivis[i])===2;i--) mauvais++;
  if(mauvais>=2) out.alertes.push({cle:'sommeil',texte:'Sommeil Mauvais ('+mauvais+'e fois)',fois:mauvais});
  if(_cbTexte(der['bil-prog-modifs'])) out.alertes.push({cle:'modifs',texte:'Demande de modification du programme'});
  if(prec&&prec.type!=='depart'&&_cbPhotos(prec)>0&&_cbPhotos(der)===0) out.alertes.push({cle:'photos',texte:'Photos absentes'});
  return out;
}
// Le bandeau « Depuis le bilan N−1 » (coach seulement).
function _htmlDepuisBilan(b,client,rang){
  if(!client||!b||b.type==='depart') return '';
  const s=_cbSuivis(client);
  const i=s.indexOf(b);
  if(i<1) return '';
  const r=comparerBilans(s[i-1],b,client);
  const fl={mieux:'↗','moins bien':'↘',stable:'→'};
  const puces=r.alertes.map(a=>'<div class="bn-l" style="color:var(--orange)">'+icon('alert-triangle',12)+' '+escapeHtml(a.texte)+'</div>')
    .concat(r.lignes.filter(l=>l.sens!=='stable'||l.fort).sort((x,y)=>(y.fort?1:0)-(x.fort?1:0))
      .concat(r.lignes.filter(l=>l.sens==='stable'&&!l.fort))
      .map(l=>'<div class="bn-l">'+fl[l.sens]+' '+escapeHtml(l.lib+' '+l.avant+' → '+l.apres)+(l.fort?' <b>·</b>':'')+'</div>'));
  if(!puces.length) return '';
  return '<section class="bn-rub bn-depuis"><div class="bn-rub-t"><h3>Depuis le bilan '+(rang?rang-1:'précédent')+'</h3></div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font-size:var(--fs-xs)">'+puces.slice(0,6).join('')+'</div></section>';
}
// La phrase d'alerte du brouillon (au plus une), et sa question ciblée.
function _brPhraseAlertes(alertes,tca){
  const a=k=>(alertes||[]).find(x=>x.cle===k);
  const mo=a('motivation'), so=a('sommeil'), md=a('modifs');
  const p=[];
  if(mo) p.push(mo.bilans?'ta motivation est passée de '+mo.de+' à '+mo.a+' en trois bilans':'ta motivation est à '+mo.a+'/10');
  if(so) p.push('tu dors mal depuis '+(so.fois===2?'deux':so.fois)+' bilans');
  if(p.length){
    const t=p.join(' et ');
    return {phrase:t.charAt(0).toUpperCase()+t.slice(1)+'.',question:'Qu\'est-ce qui pèse le plus en ce moment : le boulot, le sommeil, les séances ?'};
  }
  if(md) return {phrase:'Tu m\'as demandé de modifier ton programme : on en parle.',question:'Qu\'est-ce que tu changerais en premier dans ton programme ?'};
  return null;
}
function renderReponsesBilans(bilans,client){
  const bl=(bilans||[]).filter(b=>b&&b.date);
  // BUILD 1863 : les champs corrigés après la réponse ressortent (soulignés),
  // puis la correction est marquée lue.
  const _corrige=new Map();
  if(client) bl.forEach(b=>{ if(bilanCorrigeNonVu(b)) _corrige.set(b,new Set(b.correctionApresReponse.cles||[])); });
  if(client&&_corrige.size) setTimeout(()=>_bilMarquerCorrectionsVues(client),0);
  // Numérotation des bilans de SUIVI seuls. Le questionnaire de départ porte
  // son propre titre, mais il occupait quand même un rang : le premier bilan
  // de suivi s'affichait « Bilan 2 » alors qu'il n'y en avait qu'un.
  let _n=0; const _rang=new Map();
  bl.forEach(b=>{ if(b.type!=='depart') _rang.set(b,++_n); });
  const vus=[];
  bl.slice().reverse().forEach(b=>{
    const depart=b.type==='depart';
    const Q=depart?BILAN_QUESTIONS.depart:BILAN_QUESTIONS.suivi;
    // Les réponses effectivement écrites, dans l'ordre des questions.
    const rep=new Map();
    Q.forEach(q=>{ const t=_texteReponseLue(q.k,b[q.k]); if(t) rep.set(q.k,{q,t}); });
    // ⚠ UNE CARTE SANS TEXTE PEUT PORTER UNE REPONSE (QA du 27/09/2026) : elle
    //   reste des qu'il y a une reponse du coach a lire, ou a ecrire — un bilan
    //   de SUIVI ; un questionnaire de depart vide n'appelle rien.
    const _aLire=!client&&bilanRepondu(b);
    const _aEcrire=!!client&&!depart;
    if(!rep.size&&!_aLire&&!_aEcrire) return;
    // Les rubriques : celles de la maquette, puis les mesures du corps et ce
    // qui ne s'y range pas — rien d'écrit ne disparaît.
    const rubs=(depart?BILAN_RUBRIQUES.depart:BILAN_RUBRIQUES.suivi).map(r=>({titre:r.titre,ico:r.ico,cles:r.cles.slice()}));
    const ranges=new Set([].concat(...rubs.map(r=>r.cles)));
    const mesures=Q.filter(q=>!ranges.has(q.k)&&q.ico==='regle').map(q=>q.k);
    const autres=Q.filter(q=>!ranges.has(q.k)&&q.ico!=='regle').map(q=>q.k);
    if(mesures.length) rubs.push({titre:'Mesures du corps',ico:'crosshair',cles:mesures});
    if(autres.length) rubs.push({titre:'Autres réponses',ico:'clipboard',cles:autres});
    const sections=rubs.map(r=>{
      const items=r.cles.filter(k=>rep.has(k)).map(k=>rep.get(k));
      if(!items.length) return '';
      const tuiles=[];
      items.forEach(({q,t})=>{
        const j=_bnJauge(q.k,b[q.k]);
        const val=q.k==='bil-motivation'&&j?(j.plein+' / 10'):t;
        const large=String(t).length>60;
        tuiles.push({large,html:`<div class="bn-t${j?' bn-t-j':''}${q.k==='bil-motivation'&&j?' bn-t-motiv':''}">
            <div class="bn-l"${q.alerte?' style="color:#fca5a5"':''}>${escapeHtml(libelleQuestionBilan(q,b))}</div>
            <div class="bn-v"${(_corrige.get(b)&&_corrige.get(b).has(q.k))?' style="text-decoration:underline dotted;text-underline-offset:3px" title="Corrigé après ta réponse"':''}>${escapeHtml(val)}${q.k==='bil-motivation'&&j?_bnSegments(j):''}</div>
            ${j&&q.k!=='bil-motivation'?_bnSegments(j):''}
          </div>`});
        if(q.k==='bil-motivation'){
          const note=_bnMotivationNote(b[q.k]);
          if(note) tuiles.push({large:false,html:`<div class="bn-t bn-note">${escapeHtml(note)}</div>`});
        }
      });
      // Une tuile seule en fin de rubrique prend toute la largeur, comme
      // « Source du stress » sur la maquette.
      let place=0;
      const html=tuiles.map((x,i)=>{
        const seule=!x.large&&place%2===0&&i===tuiles.length-1;
        const plein=x.large||seule;
        if(plein){ place=0; return x.html.replace('class="bn-t','class="bn-t bn-t-plein'); }
        place++; return x.html;
      }).join('');
      return `<section class="bn-rub">
          <div class="bn-rub-t"><span class="bn-ico" aria-hidden="true">${icon(r.ico,18)}</span><h3>${escapeHtml(r.titre)}</h3></div>
          <div class="bn-g">${html}</div>
        </section>`;
    }).join('');
    const d=dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
    const w=getBW(b);
    const id=_idBilan(b);
    // « BILAN D'INSCRIPTION » (Kevin, 27/09/2026), le mot qu'il emploie.
    const nom=depart?'Bilan d’inscription':'Bilan '+_rang.get(b);
    vus.push({id,nom,depart,attend:!!client&&!depart&&!bilanRepondu(b),
      html:`<div id="bil-${escapeHtml(id)}" class="bn-bilan" data-bn="${escapeHtml(id)}">
        <div class="bn-tete${depart?' bn-tete-dep':''}">
          <div class="bn-tete-g">
            <div class="bn-titre">${depart?'Bilan <em>d’inscription</em>':'Bilan <em>'+_rang.get(b)+'</em>'}</div>
            <div class="bn-date">${d}${b.modifieLe?' · modifié le '+new Date(b.modifieLe).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}):''}</div>
          </div>
          ${client?'':`<button type="button" class="hb-b hb-b-tete" onclick="ouvrirHistoriqueBilans('${escapeHtml(id)}')">Détail</button>`}
          ${w?`<div class="bn-poids"><span>Poids</span><b>${String(w).replace('.',',')} kg</b></div>`:''}
        </div>
        ${(client&&b.modifApresReponse&&b.modifs)?`<div class="bn-date" style="color:var(--orange);padding:0 2px 6px">Corrigé le ${escapeHtml(new Date(Number(b.modifs.le)).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}))} : ${escapeHtml((b.modifs.cles||[]).map(libelleCleBilan).join(', '))}
          <button type="button" class="rb-lien" onclick="completerReponseBilan('${escapeHtml(client.email||'')}','${escapeHtml(id)}')">Compléter ma réponse</button></div>`:''}
        ${(function(){ try{ return _htmlDepuisBilan(b,client,_rang.get(b)); }catch(e){ return ''; } })()}
        ${sections||`<section class="bn-rub">${emptyState('','Aucune réponse écrite dans ce bilan : mesures et photos seulement.',null,null,'padding:12px 0')}</section>`}
        ${(!client&&bilanRepondu(b))?`<div class="bn-reponse">
          <div class="bn-reponse-t">Réponse de ton coach</div>
          ${b.reponseCoach?`<div class="bn-reponse-v">${escapeHtml(b.reponseCoach)}</div>`:''}
          ${(b.reponseAudio&&b.reponseAudio.url)?`<audio class="bn-audio" controls preload="none" src="${escapeHtml(b.reponseAudio.url)}"></audio><div class="bn-reponse-d">Réponse vocale · ${escapeHtml(dureeAudioTxt(b.reponseAudio.duree))}</div>`:''}
        </div>`:''}
        ${client?`<div class="bn-rub bn-rub-coach">${blocReponseBilan(b,client)}</div>`:''}
      </div>`});
  });
  if(vus.length){
    // UN MENU DÉROULANT, PLEINE LARGEUR (Kevin, 27/09/2026 : « mets un menu
    // déroulant, pas la suite bilan 1, bilan 2 ; ça prend trop de place »).
    // Le plus récent s'ouvre. Côté coach, un bilan sans réponse le dit dans
    // son libellé : le point rouge des pastilles n'existe plus.
    const opts=vus.map((v,i)=>`<option value="${escapeHtml(v.id)}"${i===0?' selected':''}>${escapeHtml(v.nom)}${v.attend?' · sans réponse':''}</option>`).join('');
    const cartes=vus.map((v,i)=>i===0?v.html:v.html.replace('class="bn-bilan"','class="bn-bilan" hidden')).join('');
    return `<div class="bn">${vus.length>1?`<div class="bn-choix"><select class="bn-select" aria-label="Bilan affiché" onchange="_bnVoir(this.value)">${opts}</select></div>`:''}${cartes}</div>`;
  }
  return client
    ?emptyState('message-circle','Pas encore de réponse écrite dans les bilans de '+escapeHtml(client.fname||'ton athlète')+'. Elles s\'afficheront ici dès son prochain bilan.')
    :emptyState('message-circle','Tes réponses écrites aux bilans s\'afficheront ici. Il n\'y en a pas encore.','Remplir mon bilan','openBilanChoice()');
}
// Les méthodes de la masse grasse mesurée, du libellé du bilan à la clé de
// masseGrasseLog (MG_METHODES).
const BIL_MG_METHODES=Object.freeze([
  Object.freeze({lib:'Balance à impédance',cle:'impedance'}),
  Object.freeze({lib:'Pince à plis',cle:'plis'}),
  Object.freeze({lib:'DEXA',cle:'dexa'})]);
// La mesure saisie au bilan, dans masseGrasseLog (dataStatus 'manual'). Hors
// bornes, rien. Rend true si une entrée a été posée.
function bilanMasseGrasseNoter(u,bi,maintenant){
  const v=parseFloat(String((bi&&bi['bil-bf-mesure'])||'').replace(',','.'));
  if(!u||!isFinite(v)||v<MG_PCT_MIN||v>MG_PCT_MAX) return false;
  const t=Number(maintenant)||Date.now();
  const m=BIL_MG_METHODES.find(x=>x.lib===bi['bil-bf-methode'])||BIL_MG_METHODES[0];
  const d=localISODate(new Date(Number(bi.date)||t));
  u.masseGrasseLog=_sanJournalPoser(u.masseGrasseLog,
    {date:d,pct:Math.round(v*10)/10,methode:m.cle,dataStatus:'manual',updatedAt:t},t,MG_RETENTION_JOURS);
  return true;
}
const BIL_STEPS=[
  // Step 1 : Mensurations — schéma corporel interactif
  ()=>bSec('Mensurations ',
    `<div style="font-size:var(--fs-sm);color:var(--sub);margin-bottom:8px;line-height:1.5">Complète tes mesures directement sur le schéma. Touche une case pour la remplir.</div>`+
    _htmlNoteReprises()+
    `<div style="display:flex;flex-direction:column;margin-bottom:4px">${bMeas('bil-weight','Poids actuel','kg')}${_htmlPoidsPesees()}</div>`+
    bBodySchema('bil',_bilEdition?null:mesuresDemandees(currentUser))+
    // LA MASSE GRASSE MESURÉE, FACULTATIVE (05/10/2026) : un chiffre d'appareil,
    // jamais calculé ici. Elle passe devant l'estimation au ruban à ±3 jours
    // (pctMasseGrasseDu) et entre dans masseGrasseLog avec sa méthode.
    `<div style="display:flex;flex-direction:column;margin-top:12px">${bMeas('bil-bf-mesure','Masse grasse mesurée (facultatif)','%')}</div>`+
    bLbl('Mesurée avec\u00a0:')+
    `<div>${bC('bil-bf-methode',BIL_MG_METHODES.map(m=>m.lib))}</div>`
  ),
  // BUILD 1882 : « TA SEMAINE ». Difficultés, alimentation, ressenti,
  // sommeil, stress et objectifs en UNE étape — mêmes clés bil-*, même ordre,
  // mêmes composants. Les détails ne s'ouvrent que si la réponse les appelle.
  ()=>bSec('Ta semaine',
    bLbl("As-tu éprouvé des difficultés récentes en séance ou avec l'alimentation ?")+
    `<div>${bC('bil-diff-type',["Oui, avec les séances","Oui, avec l'alimentation","Oui, avec les deux","Non, aucune difficulté particulière"])}</div>`+
    _bilSi('bil-diff-type',bLbl('Détaille les difficultés rencontrées :')+bTA('bil-diff-detail','Décris tes difficultés...'))+
    // « cheat meals » reste entre parentheses : c'est le mot que les athletes
    // emploient, et le coach le lit dans les reponses.
    bLbl('Combien de repas hors programme (cheat meals) as-tu pris cette semaine ?')+
    `<div>${bEmojiScale('bil-cheat-meals',[
      {v:'Aucun',f:'happy2',c:'#22c55e'},
      {v:'1',f:'happy',c:'#a3e635'},
      {v:'2',f:'neutral',c:'#eab308'},
      {v:'3',f:'sad',c:'#f97316'},
      {v:'4 ou plus',f:'angry',c:ROUGE_MARQUE},
    ])}</div>`+
    _bilSi('bil-cheat-meals',bLbl('Explique-moi les raisons (repas de famille, sorties professionnelles...) :')+bTA('bil-cheat-reasons','Repas de famille, sorties professionnelles...'))+
    bLbl('Quel est ton niveau de motivation en ce moment, sur une échelle de 1 à 10 ?')+
    `<div>${bSlider('bil-motivation')}</div>`+
    bLbl('Qualité du sommeil : comment dors-tu en ce moment ?')+
    `<div>${bC('bil-sleep-quality',BIL_OPTS_SOMMEIL.slice())}</div>`+
    bLbl('Es-tu stressé(e) en ce moment ?')+
    `<div>${bC('bil-stress',BIL_OPTS_STRESS.slice())}</div>`+
    _bilSi('bil-stress',bLbl('Peux-tu me donner des précisions sur ce qui te préoccupe en ce moment ?')+bTA('bil-stress-detail','Ce qui te préoccupe...'))+
    bLbl('Souhaiterais-tu des modifications dans ton programme ?')+bTA('bil-prog-modifs','Facultatif...')+
    bLbl('Où en es-tu de tes objectifs ?')+bTA('bil-new-goals-detail','Facultatif...')
  ),
  // Step 5 bis : le traitement, SEMESTRIELLEMENT et pas plus souvent.
  // Rend une chaîne VIDE le reste du temps : bSec n'est même pas appelé, il
  // n'y a donc ni titre ni cadre orphelin. Aucune réponse n'est exigée —
  // rien ici ne conditionne la validation du bilan, et c'est délibéré : une
  // question de santé qui bloque un bilan se répond au hasard.
  ()=>traitementARevoir(currentUser)?bSec('Traitement',
    bLbl('Ton traitement a-t-il changé depuis la dernière fois ?')+
    `<div>${bC('bil-traitement-change',['Non, rien n\'a changé','Oui, il a changé','Je ne prends plus de traitement'])}</div>`+
    `<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:8px">${escapeHtml(TRAITEMENT_MENTION)}</div>`
  ):'',
  // Les questions libres du coach, s'il en a posé : vide sinon, comme le
  // traitement. Le texte de chacune part avec la réponse (<clé>-q).
  ()=>{
    const qs=questionsCoachDe(currentUser);
    if(!qs.length) return '';
    qs.forEach((q,i)=>{ bilData['coach-q'+(i+1)+'-q']=q; });
    return bSec('Les questions de ton coach',qs.map((q,i)=>bLbl(escapeHtml(q))+bTA('coach-q'+(i+1),'Ta réponse...')).join(''));
  },
  // Step 6 : Photos de progression
  ()=>`<div style="margin-bottom:24px"><div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #181818">Photos de progression </div>`+
    `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-2);padding:16px;margin-bottom:14px;text-align:center">`+
    `<div style="font-weight:700;font-size:var(--fs-md);margin-bottom:6px;color:var(--text)">Photos de progression${grossesseSuspend(currentUser)?' <span style="font-weight:600;color:var(--sub)">(facultatif)</span>':''}</div>`+
    `<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">Reproduis les 3 poses ci-dessous, même endroit et même lumière qu'au début :<br><strong style="color:var(--red-text)">Face · Dos · Profil</strong></div></div>`+
    bPhotoCards('bil')+
    `</div>`
];

// ===== DEB STEPS (Questionnaire de début — onboarding) =====
const DEB_STEPS=[
  // Step 1 : Informations personnelles
  ()=>bSec('Informations personnelles',
    // R35 — espace insecable avant « ? », « : » et « ! » dans tous les
    // libelles des deux questionnaires ; les cles et les valeurs ne bougent pas.
    bLbl('Tu es ?')+
    `<div>${bGenderCards('deb-gender')}</div>`+
    // LA MAIN DOMINANTE (06/10/2026) : le bras qui écrit est souvent plus gros,
    // et ce n'est pas un déséquilibre à corriger (asymetries).
    bLbl('Tu es droitier, gaucher ?')+
    `<div>${bC('deb-lateralite',['Droitier','Gaucher'],false)}</div>`+
    bLbl('Quelle est ta date de naissance ?')+bDate('deb-birthdate')+
    bLbl('Quel est ton poids actuel ? (en kg)')+bQ('deb-weight')+
    bLbl('Quelle est ta taille ? (en cm)')+bQ('deb-height')+
    bLbl('Quels sont tes objectifs principaux ?')+
    `<div>${bC('deb-goals',['Perte de poids','Prise de muscle','Rééquilibrage corporel','Amélioration des performances','Bien-être général'],true)}</div>`+
    // R12 — marge haute negative : la ligne se loge dans les 8 px du libelle,
    // et la question ne grandit que de 14 px.
    bLbl('Quelle est ta profession ?')+
    `<div class="rc-micro" style="margin:-6px 0 8px">Sert à estimer ce que tu dépenses en dehors de tes séances.</div>`+
    bMetier('deb-job')+
    // Sous la profession, et pas ailleurs : c'est la meme question posee
    // autrement, et l'une eclaire l'autre.
    bLbl("Hors sport, comment situes-tu ton niveau d'activité au quotidien ?")+
    `<div>${bNaf('deb-naf')}</div>`+
    `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin:2px 0 4px">C'est ce niveau qui servira au calcul de ta dépense. Le sport est compté à part.</div>`+
    bLbl('Et ton rythme de travail ?')+
    `<div>${bC('deb-work-rhythm',['Plein temps','Partiel','En arrêt'])}</div>`+
    bLbl('As-tu des problèmes de santé ou des blessures ? (si oui, précise)')+bT('deb-health','Ex : hernie discale, entorse...')+
    // La CASE d'abord : c'est elle qui agit. Le texte est facultatif, et la
    // mention qui l'accompagne est AFFICHÉE, pas seulement commentée.
    `<label style="display:flex;align-items:flex-start;gap:10px;margin-top:10px;cursor:pointer">
      <input type="checkbox" id="deb-traitement" style="width:16px;height:16px;accent-color:var(--red);flex-shrink:0;margin-top:2px"${bilData['deb-traitement']?' checked':''} onchange="bilData['deb-traitement']=this.checked">
      <span style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.55">Je suis un traitement médicamenteux régulier</span>
    </label>`+
    bT('deb-traitement-detail','Si tu veux préciser (facultatif)')+
    `<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:6px">${escapeHtml(TRAITEMENT_MENTION)}</div>`+
    // Étape FACULTATIVE. Le texte libre ci-dessus n'est jamais analysé : si
    // l'athlète veut que l'app en tienne compte, il le structure ici lui-même.
    `<div style="margin-top:8px;background:var(--surface-2);border-radius:var(--r-3);padding:12px 14px">
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:10px">Si une zone te gêne à l'entraînement, tu peux la préciser. C'est facultatif, et ça sert à adapter ce qu'on te propose.</div>
      <button type="button" class="btn btn-outline btn-sm" onclick="ouvrirFormContrainte('','moi')" style="letter-spacing:1px;font-size:var(--fs-2xs)">Signaler une gêne</button>
    </div>`
  ),
  // Step 2 : Mensurations initiales — schéma corporel interactif
  ()=>bSec('Mensurations initiales ',
    `<div style="font-size:var(--fs-sm);color:var(--sub);margin-bottom:8px;line-height:1.5">Indique tes mesures directement sur le schéma pour suivre ton évolution !</div>`+
    bBodySchema('deb')
  ),
  // Step 3 : Entraînement
  ()=>bSec('Entraînement',
    bLbl("Où t'entraînes-tu ?")+
    `<div>${bC('deb-location',["En salle","Chez toi","Park de Street Workout"],true)}</div>`+
    bLbl("Si tu t'entraînes en salle, laquelle ?")+bT('deb-gym','Nom de la salle...')+
    bLbl('Quels jours souhaites-tu t\'entraîner ?')+
    `<div>${bC('deb-training-days',['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'],true)}</div>`+
    bLbl('Quelle est la durée de séance que tu préfères ? '+icon('clock',14))+bT('deb-session-duration','Ex : 45 min, 1 h 30...')+
    // R12 — c'est exact : besoinsProposes compte les creneaux RepCore une fois,
    // et ne les additionne jamais a une musculation declaree ici.
    bLbl("Quels sports pratiques-tu, et combien d'heures par semaine ?")+
    `<div class="rc-micro" style="margin:-6px 0 8px">Tes séances RepCore sont déjà comptées : n'ajoute que le reste.</div>`+
    bSports('deb-sports')+
    // R35 — LES DEUX QUESTIONS D'INTENSITE RESTENT, REFORMULEES. Elles ne
    // servent pas au calcul de depense (depenseSportsParJour lit l'intensite de
    // chaque ligne de deb-sports), mais deb-intensity-1 est encore lue :
    // saveBilanFinal en tire currentUser.level, le « niveau » affiche en tete
    // de la fiche athlete du coach. deb-intensity-2 n'est lue que dans les
    // reponses du bilan. Les cles et les valeurs sont inchangees ; la seconde
    // ne se montre qu'a partir de deux sports declares (_bRepeindreSports).
    bLbl("Quelle est l'intensité de ton sport principal ?")+
    `<div>${bEmojiScale('deb-intensity-1',[
      {v:'Faible intensité',l:'Faible',svg:BICON.flame1,c:'#22c55e'},
      {v:'Intensité Modérée',l:'Modérée',svg:BICON.flame2,c:'#f97316'},
      {v:'Haute intensité',l:'Haute',svg:BICON.flame3,c:ROUGE_MARQUE},
    ])}</div>`+
    `<div id="deb-intensity-2-bloc"${_bSportsDeclares('deb-sports')<2?' style="display:none"':''}>`+
    bLbl('Et celle de ton second sport ?')+
    `<div>${bEmojiScale('deb-intensity-2',[
      {v:'Faible intensité',l:'Faible',svg:BICON.flame1,c:'#22c55e'},
      {v:'Intensité Modérée',l:'Modérée',svg:BICON.flame2,c:'#f97316'},
      {v:'Haute intensité',l:'Haute',svg:BICON.flame3,c:ROUGE_MARQUE},
    ])}</div></div>`+
    bLbl('As-tu des antécédents sportifs ?')+bT('deb-history','Ex : football 5 ans, boxe 2 ans...')+
    bLbl('Quand préfères-tu t\'entraîner ? '+icon('clock',14))+
    `<div>${bC('deb-training-time',['Matin','Après-midi','Soir'],true)}</div>`
  ),
  // Step 4 : Nutrition
  ()=>bSec('Nutrition ',
    bLbl('As-tu des allergies ou régimes alimentaires spécifiques ?')+bT('deb-allergies','Ex : intolérance au lactose, végétarien...')+
    bLbl('Y a-t-il quelque chose que ton coach doit savoir sur ton rapport à l\'alimentation ?')+bT('deb-tca','Facultatif : ce que tu veux en dire')+
    // QUESTIONS DE SECURITE. Le titre ne nomme aucun trouble, aucun score
    // n est affiche, et les reponses ne sont PAS conservees : seul le
    // booleen qu elles produisent l est.
    bLbl('Quelques questions de sécurité')+
    `<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-bottom:10px;text-transform:none;letter-spacing:normal;font-weight:400">Elles servent à savoir si un objectif de poids est prudent pour toi en ce moment. Tes réponses ne sont pas enregistrées.</div>`+
    (_bilEdition?'<div class="hb-note">Les questions de sécurité ne sont pas reposées : leurs réponses ne sont pas conservées.</div>'
      :SCOFF_QUESTIONS.map(q=>bLbl(q.q)+`<div>${bC('deb-scoff-'+q.cle,['Oui','Non'])}</div>`).join(''))+
    bLbl('Quel type de suivi nutritionnel préfères-tu ?')+
    // R35 — valeurs inchangees : les libelles viennent de BIL_CHOIX_LIBELLES.
    `<div>${bC('deb-nutrition-type',['Diet strict : Plan alimentaire détaillé avec quantités précises','Diet flexible : Conseils personnalisés + calcul via application'])}</div>`+
    bLbl('Combien de repas par jour préfères-tu ?')+
    `<div>${bC('deb-meals-day',['3','4','5','6'])}</div>`+
    bLbl('Aliments que tu adores ?')+bT('deb-food-love','Ex : riz, poulet, banane...')+
    bLbl('Aliments que tu détestes ?')+bT('deb-food-hate','Ex : brocolis, poivrons...')+
    // L'echelle affiche deja les litres : la precision est retiree du libelle.
    bLbl('Combien d\'eau bois-tu par jour ?')+
    `<div>${bEmojiScale('deb-water',[
      {v:'Moins de 1L',l:'- de 1L',svg:BICON.glass(34),c:'#7dd3fc'},
      {v:'Entre 1 à 2L',l:'1 à 2L',svg:BICON.glass(27),c:'#38bdf8'},
      {v:'Entre 3 à 4L',l:'3 à 4L',svg:BICON.glass(19),c:'#0ea5e9'},
      {v:'5L et plus',l:'5L et +',svg:BICON.glass(11),c:'#2563eb'},
    ])}</div>`+
    bLbl('Suis-tu tes calories et tes macros au quotidien ?')+
    `<div>${bC('deb-track-macros',['Oui','Non'])}</div>`+
    bLbl('Si oui, combien de calories consommes-tu chaque jour, et dans quel but ? (ex. sèche, prise de masse, maintien)')+bT('deb-calories','Ex : 2200 kcal en sèche...')+
    bLbl('Souhaites-tu prendre des compléments alimentaires ?')+
    `<div>${bC('deb-supplements',['Oui','Non'])}</div>`+
    bLbl('Si tu en prends déjà, lesquels et pourquoi ?')+bT('deb-supps-detail','Ex : whey, créatine...')
  ),
  // Step 5 : Photos de départ
  ()=>`<div style="margin-bottom:24px"><div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #181818">Photos de départ </div>`+
    `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-2);padding:16px;margin-bottom:14px;text-align:center">`+
    `<div style="font-weight:700;font-size:var(--fs-md);margin-bottom:6px;color:var(--text)">Photos de départ</div>`+
    `<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">Reproduis les 3 poses ci-dessous, tenue légère, lumière naturelle : <strong style="color:var(--red-text)">touche AJOUTER sous chaque pose</strong>.</div></div>`+
    bPhotoCards('deb')+
    `</div>`
];
function saveBilanFinal(){
  // LA SANTE PASSE AVANT L INTENDANCE. Drapeau rouge ou douleur au-dessus du
  // seuil : on ecrit la trace quoi qu il arrive, absence du coach comprise.
  // Elle remonte par la synchronisation, et l appareil du coach la relevera.
  try{ _dispoTracerSante('bilan'); }catch(e){}
  if(_bilEdition) return _bilEnregistrerModif();
  // ⚠ L'ACCORD DE SANTE AVANT TOUT LE RESTE (26/09/2026). La porte etait posee
  //   plus bas, juste avant l'ecriture du bilan — mais APRES l'effacement du
  //   brouillon et apres les ecritures dans le dossier (questionnaire marque
  //   complet, niveau, poids...), et sans rien pour reprendre ensuite. Le
  //   premier bilan d'un client neuf, qui n'a pas encore donne son accord,
  //   etait donc PERDU : accord donne, retour a l'accueil, brouillon efface,
  //   aucun bilan, jamais « Bilan enregistré — Ton coach est prévenu. ».
  //   Ici, rien n'a encore bouge : on demande, et on REPREND le meme
  //   enregistrement une fois l'accord donne. Refuser ne coute rien : le
  //   brouillon est ecrit juste avant, il se reprendra plus tard.
  if(!aConsentiSante(currentUser)){
    try{ _bilEcrireDraft(); }catch(e){}
    demanderConsentementSante('mensuration',_bilanReprendreApresAccord);
    return;
  }
  const n=(currentUser.bilans||[]).filter(b=>b.type===bilType).length+1;
  const bi=Object.assign({type:bilType,date:Date.now(),num:n},bilData);
  // BUILD 1880 : le poids vient des pesées de la semaine (non retouché).
  if(_bilPoidsPesees&&String(bi['bil-weight']||'')===String(_bilPoidsPesees.kg)) bi.bilPoidsSource='pesees';
  _bilPoidsPesees=null;
  // « Envoyer sans, je les ajoute plus tard » : la promesse reste sur le bilan.
  if(Array.isArray(_bilPhotosAVenir)&&_bilPhotosAVenir.length) bi.photosAVenir=_bilPhotosAVenir.slice();
  _bilPhotosAVenir=null;
  // Le bilan est validé : le brouillon n'a plus de raison d'être, et le laisser
  // ferait reproposer une reprise au prochain bilan du même type.
  _bilClearDraft();
  if(bilType==='depart'){
    currentUser.questionnaireComplete=true;
    // BILAN DE SECURITE. Les reponses servent UNE FOIS, ici, puis elles
    // sont retirees de l objet enregistre : la finalite est atteinte par le
    // seul booleen, et conserver cinq reponses sur les conduites
    // alimentaires constituerait un dossier de sante sans necessite.
    try{
      const _rep=SCOFF_QUESTIONS.map(q=>{
        const v=_texteReponse(bilData['deb-scoff-'+q.cle]);
        if(/^oui$/i.test(String(v||'').trim())) return true;
        if(/^non$/i.test(String(v||'').trim())) return false;
        return null;                       // sans reponse : compte positif
      });
      const _pose=SCOFF_QUESTIONS.some(q=>bilData['deb-scoff-'+q.cle]!==undefined);
      if(_pose){
        const _risque=appliquerRisqueTca(currentUser,_rep);
        // rcAlerte et non alert : Chrome eteint les boites natives toutes
        // ensemble, et ce message-la ne doit pas disparaitre en silence.
        if(_risque) try{ rcAlerte(SCOFF_MSG_POSITIF); }catch(e){}
      }
      for(const q of SCOFF_QUESTIONS){ delete bi['deb-scoff-'+q.cle]; delete bilData['deb-scoff-'+q.cle]; }
    }catch(e){}
    // Objectifs bilan départ → bilanGoals (champ distinct de objective/profil)
    const goals=bilData['deb-goals'];
    if(goals&&(Array.isArray(goals)?goals.length:goals))
      currentUser.bilanGoals=Array.isArray(goals)?goals.join(' · '):goals;
    // Niveau d'intensité → currentUser.level (proxy le plus proche du bilan)
    const _lvlMap={'Faible intensité':'Débutant (< 1 an)','Intensité Modérée':'Intermédiaire (1-3 ans)','Haute intensité':'Avancé (3-5 ans)'};
    const _lvl=bilData['deb-intensity-1'];
    if(_lvl&&_lvlMap[_lvl]) currentUser.level=_lvlMap[_lvl];
    // FRÉQUENCE : trois lignes retirées le 14/08. Elles lisaient
    // `deb-sessions-week`, une clef qu'aucune étape de DEB_STEPS n'écrit — la
    // valeur était donc toujours undefined. Et `currentUser.frequency` n'avait
    // pour seul lecteur que renderQ, le questionnaire QS, dont le point
    // d'entrée initQuestionnaire n'a aucun appelant et dont le conteneur
    // `q-content` n'existe pas dans le DOM. La dériver aurait alimenté un écran
    // que personne ne peut ouvrir.
    // Type de suivi nutritionnel → nutrition.dietType. On NE TOUCHE PAS a une
    // valeur deja fixee : le coach a pu la choisir avant que l'athlete remplisse
    // son bilan, et son avis prime. Reponse absente : on n'ecrit rien, le defaut
    // de lecture s'applique.
    const _dt=_texteReponse(bilData['deb-nutrition-type']);
    if(_dt&&!((currentUser.nutrition||{}).dietType)){
      const _n=_microNorm(_dt);
      const _choix=/flexible/.test(_n)?'flexible':(/strict/.test(_n)?'strict':null);
      if(_choix){
        if(!currentUser.nutrition) currentUser.nutrition={};
        currentUser.nutrition.dietType=_choix;
      }
    }
  }
  // Traitement : la CASE va dans le dossier, le TEXTE aussi mais il n'est lu
  // par aucun calcul. Décocher fait retomber les effets et CONSERVE le texte —
  // il ne disparaît qu'à effacement explicite, sinon une case décochée par
  // erreur détruirait ce que l'athlète avait pris le temps d'écrire.
  if(bilType==='depart'){
    if(bilData['deb-traitement']) currentUser.traitementEnCours=true;
    else delete currentUser.traitementEnCours;
    const _td=(bilData['deb-traitement-detail']||'').trim();
    if(_td) currentUser.traitementDetail=_td;
  }
  // La revue semestrielle. On horodate dès que la question a été POSÉE et
  // qu'une réponse existe : sans réponse, la date ne bouge pas et la question
  // reviendra au bilan suivant plutôt que de disparaître six mois.
  const _rep=_texteReponse(bilData['bil-traitement-change']);
  if(_rep){
    currentUser.traitementRevuLe=Date.now();
    // « Je ne prends plus de traitement » : la case retombe, et le TEXTE
    // reste — même règle que partout ailleurs dans ce lot.
    if(/ne prends plus/i.test(_rep)) delete currentUser.traitementEnCours;
  }
  if(bilData['bil-weight']) currentUser.weight=bilData['bil-weight'];
  if(bilData['deb-weight']) currentUser.weight=bilData['deb-weight'];
  // Propager hauteur, âge et genre vers le profil pour les calculs de composition
  const _h=parseFloat(bilData['deb-height']||bilData['bil-height']||0);
  if(_h>100&&_h<250) currentUser._evol_height=_h;
  // ⚠ LA DATE FAIT FOI, ET L'AGE EN DECOULE. On ecrit les deux : `age` est lu
  // par une quinzaine d'endroits qui n'ont pas a savoir d'ou il vient, et le
  // recalculer au demarrage depuis `birthdate` les met tous d'accord.
  if(bilData['deb-birthdate']){
    const _a=_ageRevolu(bilData['deb-birthdate']);
    if(_a!==null&&_a>=0&&_a<=120){
      currentUser.birthdate=bilData['deb-birthdate'];
      currentUser.age=_a;
    }
  }
  // REPLI : les dossiers ouverts avant ce lot n'ont qu'un age saisi. Le lire
  // encore, c'est ne pas leur faire payer un changement qu'ils n'ont pas
  // demande.
  else if(bilData['deb-age']) currentUser.age=bilData['deb-age']||currentUser.age;
  if(bilData['deb-gender']){
    const _gMap={'Homme':'H','Femme':'F'};
    const _g=_gMap[bilData['deb-gender']]||bilData['deb-gender'];
    if(!currentUser._evol_gender) currentUser._evol_gender=_g;
  }
  // UNE MENSURATION INCHANGÉE RESTE UNE MENSURATION. Signalé par Kevin le
  // 26/08/2026 : « les mensurations restées identiques et inchangées devraient
  // être affichées et comptées même dans les graphiques — le but, voir aussi si
  // la personne stagne. »
  //
  // Toutes les reprises non touchées étaient effacées du bilan enregistré. Un
  // biceps re-mesuré à 44 cm, identique au bilan d'avant, disparaissait : la
  // ligne du tableau affichait « — » et la carte annonçait « une courbe demande
  // deux bilans, il en manque encore un » alors que deux bilans existaient. La
  // stagnation — le signal que le coach cherche justement — était le seul cas
  // que l'app ne savait pas montrer.
  //
  // LE POIDS RESTE EFFACÉ, ET LUI SEUL. C'est la seule valeur qui alimente une
  // moyenne mobile et une VITESSE : un poids repris porterait la date du jour,
  // ferait un point neuf sur la courbe, et la pente qui en sort déciderait d'un
  // ajustement calorique. Les mensurations, elles, ne se lisent que d'un bilan
  // à l'autre — reprendre la valeur d'il y a quinze jours au bilan d'aujourd'hui
  // dit ce qu'on veut dire : rien n'a bougé.
  //
  // ET ON GARDE LA TRACE. `bi.reprises` liste ce qui a été reporté sans être
  // re-mesuré : le tableau et les courbes le marquent, et rien ne fait passer
  // un report pour un relevé frais.
  //
  // Sur `bi` seulement : `bilData` a déjà servi plus haut à propager le poids,
  // la taille et l'âge vers le profil, et ces propagations réécrivent la même
  // valeur que le profil portait déjà.
  try{
    if(_bilReprises&&_bilReprises.size){
      const _rep=[];
      for(const k of _bilReprises){
        if(/-weight$/.test(k)){ delete bi[k]; continue; }
        if(bi[k]!==undefined&&bi[k]!=='') _rep.push(k);
      }
      if(_rep.length) bi.reprises=_rep;
    }
  }catch(e){}
  _bilReprises=null;
  // ⚠ LE BILAN EST LA DONNEE DE SANTE LA PLUS DENSE DU PRODUIT : mensurations,
  // photos corporelles, ressentis, reponses de sante. Rien ne doit en entrer
  // un seul dans le dossier sans l'accord de l'article 9.
  //
  // LA PORTE EST POSEE ICI, juste avant l'ecriture, et non a l'ouverture du
  // questionnaire : quelqu'un a le droit de PARCOURIR le formulaire pour voir
  // ce qu'on lui demande avant de decider. C'est au moment ou ca s'ecrit que
  // la question se pose.
  // (La porte de l'article 9 est en tete de fonction : rien de ce qui precede
  //  ne s'ecrit sans l'accord.)
  if(!currentUser.bilans) currentUser.bilans=[];
  // LE PROTOCOLE DE L'ENTREJAMBE (06/10/2026) : saisi avec la consigne du
  // livre, il le dit ; repris d'un bilan précédent, il garde le protocole de
  // ce bilan-là. Les deux protocoles ne se mélangent pas dans un calibrage.
  try{ marquerProtoEntrejambe(bi,currentUser.bilans); }catch(e){ rcErreurMuette('bilan · protocole entrejambe',e); }
  currentUser.bilans.push(bi);
  try{ bilanMasseGrasseNoter(currentUser,bi,Date.now()); }catch(e){ rcErreurMuette('bilan · masse grasse',e); }
  // LE BILAN ETEINT LES DEMANDES DE MESURE QU'IL SATISFAIT (lot 6). Il est
  // enregistre juste apres, par le meme chemin : rien a pousser de plus.
  try{ consommerDemandesMesure(bi,currentUser); }catch(e){}
  // ET IL DECLENCHE L'ANALYSE MORPHO SI ELLE N'EST PAS DEJA GELEE (lot 8).
  // Elle part APRES l'ecriture, ne bloque rien, et ne se refait jamais une fois
  // gelee. Un athlete qui avait deja son premier bilan est analyse ici aussi,
  // sur ses photos de depart : c'est le cas retroactif de la mission.
  try{ morphoInitialePeutEtre(currentUser); }catch(e){}
  if(bi.type==='depart'){
    delete currentUser._firstBilanPending;
    // Le questionnaire de départ installait la Fondation SANS regarder si un
    // programme avait déjà été assigné : l'athlète effaçait le travail de son
    // coach en validant son propre questionnaire.
    _adopterProgrammeStocke();
    if(!_configReelle(currentUser.sessions_config)){
      _pushSessionsHistory(currentUser); // rollback possible depuis l'historique
      currentUser.sessions_config=null;
      initSessionsConfig();
    }
  }
  // ── LES PHOTOS SORTENT DU DOCUMENT (build 1421) ─────────────────────────
  // Le brouillon les garde en base64 — il doit survivre a un changement
  // d'ecran, et un brouillon est transitoire. A LA VALIDATION, elles passent
  // par la MEME migration que les anciennes : un Blob dans IndexedDB, un envoi
  // chez l'hebergeur, et une reference dans le bilan. L'ancrage sous rc_photo_
  // n'a plus de raison d'etre : le blob local EST l'ancrage, et il ne mange pas
  // les cinq megaoctets de localStorage.
  //
  // ⚠ TANT QUE L'ENVOI N'A PAS REUSSI, LE BASE64 RESTE. On ne troque jamais une
  //   photo contre rien : c'est photosBilanMigrer qui garantit ce sens unique.
  Object.keys(bi).filter(k=>k.includes('photo')&&bi[k]).forEach(k=>{
    try{localStorage.removeItem('rc_pendingphoto_'+k);}catch(e){}
  });
  const enregistre=saveUser();
  // La migration des photos de CE bilan, en tache de fond : elle fait un
  // aller-retour reseau par photo, et l'ecran n'a pas a l'attendre. Elle
  // reenregistre et repousse quand elle a fini.
  (async()=>{ try{
    const r=await photosBilanMigrer(currentUser,{max:9});
    if(r.faites){ saveUser(); CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{}); }
  }catch(e){} })();
  // Le bilan vient d'être poussé dans l'historique : longueur 1 = c'était le
  // premier. Seul le compteur part — ni le type, ni la moindre réponse.
  if((currentUser.bilans||[]).length===1) rcm('first_bilan_completed');
  try{ activationCompleter(currentUser,Date.now()); }catch(e){}
  // LE SECOND ET DERNIER POINT D'APPEL DES BADGES. Le bilan est le seul
  // critère des cinq qui ne passe pas par la fin d'une séance : sans cette
  // ligne, « Premier bilan » ne tomberait qu'à la séance suivante.
  try{ majBadges(); }catch(e){}
  try{ majXp(); }catch(e){}
  if(currentUser._notifEnabled) scheduleSwNotif();
  // Un bilan représente une saisie longue : mensurations, photos et réponses
  // de santé. Annoncer « enregistré ! » alors que le quota a débordé pousse
  // l'utilisateur à fermer l'app sur une fausse certitude.
  // ⚠ `ancrageOk` A DISPARU DE CETTE CONDITION, ET IL FAUT DIRE POURQUOI. Il
  //   valait l'ecriture des photos sous rc_photo_ : 374 Ko de base64 par photo
  //   dans un localStorage de cinq megaoctets, ce qui debordait des le troisieme
  //   bilan — d'ou cet avertissement. Les photos vivent maintenant en Blob dans
  //   IndexedDB, dont le quota se compte en centaines de megaoctets, et la
  //   migration ne remplace JAMAIS une chaine avant que la reference soit
  //   valide : une photo ne peut plus etre perdue par un quota. Le « ✓ » ne
  //   depend donc plus que de l'ecriture du dossier, qui est ce qu'il annonce.
  // LE PLAN B EST DIT (06/10/2026) : une vue manque, on rappelle où l'ajouter.
  let _rappel=''; try{ _rappel=rappelPhotosManquantes(bi); }catch(e){ _rappel=''; }
  if(enregistre&&_rappel) toast(' Bilan n°'+n+' enregistré. '+_rappel,'var(--orange)',6500);
  else if(enregistre) toast(' Bilan n°'+n+' enregistré !');
  else toast('Stockage plein : bilan envoyé au cloud, mais absent de cet appareil','var(--orange)');
  go('s-client-home');loadClientHome();
  // LA SORTIE PROPRE. Vérifié : plus rien ne lit `bilData` en dessous — les
  // propagations de poids, taille, âge et genre vers le profil ont eu lieu
  // bien plus haut, et `bi` est une copie prise avant tout cela.
  //
  // `false` : _bilClearDraft a déjà retiré le brouillon en tête de fonction,
  // le bilan étant validé.
  _quitterEcranBilan(false);
  // Propose notifications après le 1er bilan
  const totalBilans=(currentUser.bilans||[]).length;
  if(totalBilans===1) setTimeout(showBilanNotifPrompt, 1500);
  // Vérifie si notif du jour
  setTimeout(checkBilanNotifToday, 500);
}

// ======= NOTIFICATIONS BILAN (toutes les 2 semaines, samedi 7h) =======
function _bilanAnchorSat(dateMs,freqWeeks){
  // Samedi le PLUS PROCHE de « bilan + freqWeeks semaines ».
  //
  // L'ancienne version remontait d'abord au samedi PRÉCÉDANT le bilan, puis
  // ajoutait freqWeeks*7. Un bilan rempli un vendredi visait donc le samedi du
  // lendemain en hebdomadaire — une échéance déjà passée le temps que l'athlète
  // rouvre l'app. La boucle de rattrapage la repoussait alors au samedi suivant,
  // exactement celui que la fréquence bimensuelle désignait de son côté : les
  // deux réglages affichaient la même date dans 14 cas sur 29 selon le jour du
  // dernier bilan, et choisir « chaque semaine » ne changeait rien à l'écran.
  //
  // En partant de la date du bilan pour y ajouter l'intervalle voulu AVANT
  // d'arrondir au samedi, l'échéance tombe toujours à ±3 jours de l'intervalle
  // demandé, et les deux fréquences restent séparées de 7 jours pleins.
  // Le samedi : le cas général (_bilanAncre, n'importe quel jour) le rend à l'identique.
  return _bilanAncre(dateMs,freqWeeks,6);
}
// rattraper : reporter l'échéance au prochain multiple encore à venir.
// Le compte à rebours ne le fait PAS, et c'est le second volet de la
// correction : quand l'échéance hebdomadaire était dépassée, le report la
// poussait au samedi suivant — précisément celui que la fréquence bimensuelle
// visait déjà. Les deux réglages affichaient alors la même date, alors que la
// vérité est qu'en hebdomadaire l'athlète est EN RETARD. Sans report,
// _updateBilanCountdown reçoit une date passée et affiche « C'est le moment ! ».
// Seul le planificateur de notification garde le report : il lui faut un
// horodatage futur, sans quoi le rappel ne pourrait jamais être programmé.
function getNextBilanSaturday(rattraper){
  // LA SEULE ÉCHÉANCE : echeanceBilan (la cadence du coach, sinon la
  // fréquence de l'athlète et le samedi). Le nom de la fonction est resté.
  const _e=echeanceBilan(currentUser,Date.now());
  if(!_e.echeance) return null;
  const freq=_e.freq;
  const next=new Date(_e.echeance);
  next.setHours(0,0,0,0);
  if(!rattraper) return next;
  const today=new Date();today.setHours(0,0,0,0);
  // Avance par pas de semaines entieres via setDate, et non en ajoutant des
  // millisecondes : un passage a l'heure d'ete decalerait l'heure et pourrait
  // faire basculer la date d'un jour.
  while(next.getTime()<today.getTime()){
    next.setDate(next.getDate()+freq*7);
    next.setHours(0,0,0,0);
  }
  return next;
}
// PURE. Le retard en jours entre une échéance et aujourd'hui. Négatif quand
// l'échéance est devant — l'appelant y lit « rien à réclamer ».
//
// Math.round et non une division sèche : un passage à l'heure d'été rend
// l'écart entre deux minuits non multiple de 24 h, et un floor perdrait un
// jour. Même raisonnement que getNextBilanSaturday, qui avance par setDate.
function _bilRetardJours(echeance,maintenant){
  if(echeance==null) return null;
  const e=new Date(echeance); e.setHours(0,0,0,0);
  const j=new Date(maintenant==null?Date.now():maintenant); j.setHours(0,0,0,0);
  const n=Math.round((j.getTime()-e.getTime())/86400000);
  return isFinite(n)?n:null;
}
// PURE. Ce que la carte doit dire, ou null quand elle ne doit RIEN dire —
// c'est ce null qui décide de l'afficher ou pas, pas le rendu.
function _bilTexteRetard(n){
  if(n==null||!isFinite(n)||n<0) return null;
  if(n===0) return 'C’est aujourd’hui.';
  if(n===1) return 'Attendu depuis hier.';
  return 'Attendu depuis '+n+' jours.';
}
// PURE. La carte du bilan en retard (maquette de Kevin, 28/09/2026).
// {retard, echeance, dernier, freq} → HTML. retard : jours (0 = aujourd'hui).
function _htmlBilanRetard(d){
  const n=Math.max(0,Math.round(Number(d&&d.retard)||0));
  const freq=Number(d&&d.freq)||2;
  const rythme=freq===1?'hebdomadaire':freq===4?'mensuel':freq===2?'bimensuel':'';
  const date=t=>{ try{ return t?new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}).toUpperCase():'—'; }catch(e){ return '—'; } };
  const sous=n===0?'Ton bilan est attendu <b>aujourd’hui</b>.':n===1?'Bilan attendu depuis <b>hier</b>.':'Bilan attendu depuis <b>'+n+' jours</b>.';
  const chrono='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="14" r="7.5"/><path d="M12 10v4l-2 2.5"/><path d="M10 3h4M12 3v3.5M18.2 7.3l1.3-1.3"/></svg>';
  const doc='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 12h6M9 15.5h6M9 19h4"/></svg>';
  const chev='<svg viewBox="0 0 16 24" aria-hidden="true"><polyline points="4 4 12 12 4 20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return '<div class="bal2-in"><div class="bal2-haut"><span class="bal2-ico">'+chrono+'</span>'
    +'<div class="bal2-txt"><div class="bal2-titre">Bilan'+(rythme?' <span>'+rythme+'</span>':'')+'</div>'
    +'<span class="bal2-pastille"><i></i>'+(n===0?'Aujourd’hui':'En retard')+'</span>'
    +'<div class="bal2-sous">'+sous+'</div></div>'
    +'<div class="bal2-j"><b>J'+(n?' + <span>'+n+'</span>':' <span>0</span>')+'</b><small>'+(n?'de retard':'c’est le jour')+'</small></div>'
    +'<span class="bal2-ch">'+chev+'</span></div>'
    +'<div class="bal2-frise"><div class="bal2-bout"><small>Dernier bilan</small><b>'+date(d&&d.dernier)+(d&&d.dernier?' <i class="bal2-ok" aria-label="fait">'+icon('coche',14)+'</i>':'')+'</b></div>'
    +'<div class="bal2-ligne" aria-hidden="true"><i class="p0"></i><i class="p1"></i><i class="p2"></i><i class="p3"></i><i class="p4"></i></div>'
    +'<div class="bal2-bout bal2-fin"><small>Prochain bilan</small><b>'+date(d&&d.echeance)+'</b><small>À compléter</small></div></div>'
    +'<span class="bal2-go"><span class="bal2-go-ico">'+doc+'</span><span class="bal2-go-t">Compléter mon bilan</span><span class="bal2-go-ch">'+chev+'</span></span>'+'</div>';
}
function isBilanNotifDay(){
  const bilans=currentUser.bilans||[];
  if(!bilans.length) return false;
  const now=new Date();
  if(now.getHours()<7) return false;
  // Le jour de la cadence (samedi sans cadence du coach), la même échéance.
  const _e=echeanceBilan(currentUser,now.getTime());
  if(!_e.echeance||now.getDay()!==_e.jour) return false;
  const freq=_e.freq;
  const anchor=new Date(_e.echeance);
  anchor.setHours(0,0,0,0);
  const today=new Date();today.setHours(0,0,0,0);
  const diff=today.getTime()-anchor.getTime();
  if(diff<0) return false;
  // EN JOURS, ET NON EN MILLISECONDES. `diff` sépare deux MINUITS LOCAUX : à
  // cheval sur un changement d'heure il vaut quatorze jours moins une heure, et
  // l'égalité exacte `Math.round(diff/cycle)*cycle===diff` échouait. Mesuré à
  // Paris : du samedi 21 mars au samedi 4 avril 2026, 1 206 000 000 ms au lieu
  // de 1 209 600 000.
  //
  // ET C'ÉTAIT DURABLE : l'ancre est la date du dernier bilan, elle ne bouge
  // pas. Le décalage se reportait sur tous les samedis suivants — plus aucun
  // rappel jusqu'à ce que l'athlète remplisse un bilan, c'est-à-dire jusqu'à
  // ce qu'il fasse ce qu'on ne lui rappelait plus.
  //
  // Math.round rend 14 aussi bien pour 13 j 23 h que pour 14 j 01 h.
  const jours=Math.round(diff/864e5);
  return jours>=0&&jours%(freq*7)===0;
}
// ── Notifications : disponibilité, testée partout avant usage ──────────────
// Safari iOS n'expose Notification QUE dans une PWA installée : dans un onglet,
// l'identifiant n'existe pas du tout, et le lire lève un ReferenceError — pas
// un `undefined`. Un `if(Notification.permission==='granted')` casse donc la
// fonction entière, et avec elle la bannière in-app qui, elle, marcherait très
// bien. Un helper unique plutôt que six tests inline, qui divergeaient déjà.
function _notifSupported(){return typeof window!=='undefined' && 'Notification' in window;}
// Message des chemins déclenchés par l'utilisateur : dire pourquoi ça ne marche
// pas ET quoi faire. « Non supportées » laissait croire à une impasse alors que
// l'installation sur l'écran d'accueil suffit.
const _NOTIF_INDISPO="Les notifications ne sont pas disponibles sur ce navigateur : installe RepCore sur ton écran d'accueil.";
// L'app au premier plan a deja sa banniere : une notification systeme par
// dessus, c'est le meme message deux fois dans la meme seconde. On ne garde
// que la banniere.
// Repli SUR : si visibilityState est indisponible, on suppose l'app cachee
// et la notification part. Un doublon vaut mieux qu'un rappel perdu.
function _appAuPremierPlan(){
  try{ return document.visibilityState==='visible'; }catch(e){ return false; }
}
function checkBilanNotifToday(){
  if(!currentUser||currentUser.role!=='athlete') return;
  if(!(currentUser.bilans||[]).length) return;
  if(!isBilanNotifDay()) return;
  const todayStr=localISODate(new Date());
  if(currentUser._lastBilanNotif===todayStr) return; // déjà montré
  currentUser._lastBilanNotif=todayStr;saveUser();
  showBilanNotifBanner();
  // La bannière in-app est déjà posée : le garde ne couvre QUE la notification
  // système. Sur un iPhone en onglet, l'athlète voit donc son rappel malgré
  // tout — avant, la ligne suivante jetait et la bannière restait, mais tout ce
  // qui suivait dans le cycle de démarrage sautait avec elle.
  if(_appAuPremierPlan()) return;
  const _fq=bilanFreqEffective(currentUser);
  const _tBil=_fq===1?'Bilan de la semaine':_fq===4?'Bilan du mois':'Bilan de quinzaine';
  const _bBil=(currentUser.fname||'')+', 10 min quand tu as le temps ce week-end.';
  if(_notifSupported()&&Notification.permission==='granted'){
    navigator.serviceWorker.ready.then(reg=>reg.showNotification(_tBil,{
      body:_bBil,
      icon:'./icons/icon-192x192.png',badge:'./icons/icon-192x192.png',
      tag:'bilan-reminder',requireInteraction:false,data:{url:'./?bilan=1'}
    })).catch(()=>{try{new Notification(_tBil,{
      body:_bBil,
      icon:'./icons/icon-192x192.png',tag:'bilan-reminder'
    });}catch(e){}});
  }
}
// Notification système à l'arrivée d'un NOUVEAU retour du coach. Même structure
// que checkBilanNotifToday ci-dessus : garde de disponibilité, service worker
// en premier, `new Notification` en repli.
// Appelée par la synchro périodique — c'est elle qui fait descendre l'écriture
// du coach jusqu'au dossier de l'athlète, donc le seul moment où l'app peut
// signaler la nouvelle sans que l'athlète ait rien fait.
function checkFeedbackNotif(){
  if(!currentUser||currentUser.role!=='athlete') return;
  const dates=(currentUser.videos||[]).map(v=>v&&v.feedbackDate)
    .filter(d=>typeof d==='number'&&isFinite(d));
  if(!dates.length) return;
  const plusRecent=Math.max.apply(null,dates);
  // PREMIER PASSAGE : on prend acte de l'existant SANS notifier. Sans ce garde,
  // un athlète ayant dix anciennes corrections recevrait dix notifications à la
  // première synchro suivant la mise à jour — le repère n'existait pas encore,
  // tout son historique passerait pour nouveau.
  if(typeof currentUser._lastFbNotif!=='number'){
    currentUser._lastFbNotif=plusRecent;saveUser();return;
  }
  if(plusRecent<=currentUser._lastFbNotif) return;
  const nouveaux=(currentUser.videos||[])
    .filter(v=>v&&v.feedbackDate>currentUser._lastFbNotif)
    .sort((a,b)=>b.feedbackDate-a.feedbackDate);
  currentUser._lastFbNotif=plusRecent;saveUser();
  if(!nouveaux.length) return;
  // Une seule notification, même pour plusieurs corrections : en empiler une
  // par vidéo transformerait une bonne nouvelle en nuisance.
  const multi=nouveaux.length>1;
  // MOTION LAB : une correction vidéo nomme l'exercice — « Ton coach a corrigé
  // ton arraché » dit ce qui attend, et que c'est à regarder.
  const _motionSeul=!multi&&!!nouveaux[0].motion;
  const titre=multi?('RepCore : '+nouveaux.length+' corrections de ton coach')
                   :_motionSeul?('RepCore : Ton coach a corrigé ton '+String(nouveaux[0].name||'mouvement').toLowerCase())
                   :'RepCore : Ton coach a corrigé ta vidéo';
  const corps=multi?(nouveaux.length+' de tes vidéos viennent d\'être corrigées.')
                   :_motionSeul?'Une correction vidéo t\'attend : regarde-la dans tes corrections.'
                   :('« '+(nouveaux[0].name||'sans nom')+' » vient d\'être corrigée.');
  if(_notifSupported()&&Notification.permission==='granted'){
    navigator.serviceWorker.ready.then(reg=>reg.showNotification(titre,{
      body:corps,icon:'./icons/icon-192x192.png',badge:'./icons/icon-192x192.png',
      tag:'feedback-coach',data:{url:'./?videos=1'}
    })).catch(()=>{try{new Notification(titre,{
      body:corps,icon:'./icons/icon-192x192.png',tag:'feedback-coach'
    });}catch(e){}});
  }
}
function showBilanNotifBanner(){
  document.getElementById('bilan-notif-banner')?.remove();
  const b=document.createElement('div');
  b.id='bilan-notif-banner';
  b.style.cssText='position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:var(--z-bar);animation:slideDown var(--t-3) var(--c-out)';
  b.innerHTML=`<div style="background:linear-gradient(135deg,#1a0000,var(--red-bg-2));border-bottom:2px solid var(--red);padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openBilanChoice();document.getElementById('bilan-notif-banner')?.remove()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <div style="flex:1;min-width:0">
      <div style="font-size:var(--fs-xs);font-weight:900;color:var(--red-text);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">Bilan bimensuel · Ce samedi</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Remplis ton bilan coaching pour suivre ton évolution !</div>
    </div>
    <button onclick="event.stopPropagation();document.getElementById('bilan-notif-banner')?.remove()" aria-label="Fermer" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;flex-shrink:0;padding:0 4px;line-height:1;min-width:44px;min-height:44px">${icon('croix',14)}</button>
  </div>`;
  document.body.appendChild(b);
  setTimeout(()=>b?.remove(),60000); // auto-dismiss après 60s
}
async function scheduleSwNotif(){
  if(!('serviceWorker' in navigator)) return;
  try{
    const reg=await navigator.serviceWorker.ready;
    // true : le rappel a besoin d'une date FUTURE. Une échéance déjà dépassée
    // ne pourrait pas être programmée, et l'athlète en retard ne serait plus
    // relancé du tout — c'est justement lui qu'il faut relancer.
    const next=getNextBilanSaturday(true);
    const c=await caches.open('repcore-sw-data');
    // La fréquence CHOISIE part avec le planning : sans elle, le Service
    // Worker avançait de quinze jours quel que soit le réglage.
    const _fq=bilanFreqEffective(currentUser);
    await c.put('/bilan-schedule',new Response(JSON.stringify({
      nextDate:next?next.getTime():Date.now()+_fq*7*24*3600*1000,
      freqSemaines:_fq,
      fname:currentUser?.fname||''
    }),{headers:{'Content-Type':'application/json'}}));
    if('periodicSync' in reg){
      try{await reg.periodicSync.register('bilan-reminder',{minInterval:12*3600*1000});}catch(e){}
    }
  }catch(e){}
}
function requestBilanNotifPermission(){
  if(!_notifSupported()){toast(_NOTIF_INDISPO,'var(--orange)');return;}
  if(Notification.permission==='granted'){
    currentUser._notifEnabled=true;saveUser();
    scheduleSwNotif();scheduleSuppNotif();
    toast(' Rappels déjà activés !');return;
  }
  if(Notification.permission==='denied'){
    toast('️ Notifications bloquées : autorise-les dans les réglages du navigateur');return;
  }
  Notification.requestPermission().then(p=>{
    if(p==='granted'){
      // PREMIER DES DEUX POINTS D'ACCORD. L'autre est dans le rappel de
      // seance ; n'en instrumenter qu'un donnerait un chiffre faux sans que
      // rien ne le signale — c'est la regle deja posee pour le guide iOS.
      try{ rcm('notif_granted'); }catch(e){}
      currentUser._notifEnabled=true;saveUser();
      try{ pushAbonner({geste:true}); }catch(e){}
      scheduleSwNotif();scheduleSuppNotif();
      toast(' Rappels activés ! Tu seras notifié chaque samedi de bilan à 7h.');
    } else {
      toast('Rappels non activés.');
    }
  });
}
function showBilanNotifPrompt(){
  // Invite automatique : pas de toast ici, l'utilisateur n'a rien demandé.
  if(!_notifSupported()||Notification.permission==='granted'||Notification.permission==='denied') return;
  const existing=document.getElementById('notif-perm-modal');if(existing) return;
  const m=document.createElement('div');
  m.id='notif-perm-modal';
  m.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center';
  m.innerHTML=`<div style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:28px 24px 40px;width:100%;max-width:480px;animation:slideUp var(--t-3) var(--c-out)">
    <div style="text-align:center;font-size:var(--fs-3xl);margin-bottom:12px"></div>
    <h2 style="text-align:center;margin-bottom:8px;font-size:var(--fs-lg);font-family:var(--pile-titre);letter-spacing:.5px">Active les rappels bilan</h2>
    <p style="text-align:center;color:var(--sub);font-size:var(--fs-sm);line-height:1.7;margin-bottom:24px">
      Reçois une notification <strong style="color:var(--text)">tous les 2 samedis à 7h00</strong><br>pour ne jamais oublier ton bilan coaching.
    </p>
    <!-- iOS ne réveille pas les Service Workers en arrière-plan : le dire ici
         évite qu'un athlète croie ses rappels cassés. -->
    <p style="text-align:center;color:var(--text-faint);font-size:var(--fs-xs);line-height:1.6;margin-bottom:20px">
      Sur iPhone, les rappels ne s'affichent que quand l'app est ouverte.
    </p>
    <button class="btn btn-red" onclick="requestBilanNotifPermission();document.getElementById('notif-perm-modal')?.remove()" style="margin-bottom:10px;letter-spacing:1.5px">Activer les notifications</button>
    <button class="btn btn-outline" onclick="document.getElementById('notif-perm-modal')?.remove()" style="font-size:var(--fs-xs);letter-spacing:1px;color:var(--sub)">Plus tard</button>
  </div>`;
  document.body.appendChild(m);
}

// ======= WORKOUT REMINDER =======
// Nom de la séance par jour de la semaine, tiré des créneaux ACTIFS. Le
// Service Worker n'a aucun accès à sessions_config : il faut le lui poster.
function _nomsSeancesParJour(u){
  const noms={};
  const jours=(u&&u._woReminderDays)||[];
  const actifs=((u&&u.sessions_config)||[]).map((s,i)=>({s,i})).filter(x=>x.s&&x.s.active);
  jours.forEach((j,k)=>{
    const c=actifs[k%Math.max(1,actifs.length)];
    if(c&&c.s.name) noms[j]=c.s.name;
  });
  return noms;
}
function _nomSeanceDuJour(u,jour){
  const n=_nomsSeancesParJour(u);
  return n[jour]||null;
}
async function scheduleWoNotif(){
  if(!('serviceWorker' in navigator))return;
  const u=currentUser;
  try{
    // Le service worker notifie SEUL, sans la page : couper la bannière ne
    // suffit pas, il faut désarmer sa copie. Sans cette ligne, un athlète sous
    // drapeau rouge continuerait de recevoir « ta séance est au programme ».
    let _susp=false;
    try{ _susp=suspensionEtat(u).actif; }catch(e){}
    const c=await caches.open('repcore-sw-data');
    await c.put('/wo-reminder',new Response(JSON.stringify({
      enabled:!_susp,
      hour:u._woReminderHour??18,
      days:u._woReminderDays||[],
      noms:_nomsSeancesParJour(u),
      // « Record à portée : … », par jour : recalculé à chaque séance terminée.
      records:(()=>{ try{ return _recordsAPorteeParJour(u); }catch(e){ return {}; } })(),
      fname:u.fname||'',
      lastNotifDate:null
    }),{headers:{'Content-Type':'application/json'}}));
    const reg=await navigator.serviceWorker.ready;
    if('periodicSync' in reg){
      try{await reg.periodicSync.register('wo-reminder',{minInterval:8*3600*1000});}catch(e){}
    }
  }catch(e){}
}
async function scheduleSuppNotif(){
  if(!('serviceWorker' in navigator)) return;
  try{
    const list=_suppStore().filter(s=>s.active!==false);
    const c=await caches.open('repcore-sw-data');
    await c.put('/supp-reminders',new Response(JSON.stringify({
      enabled:list.length>0,
      fname:currentUser.fname||'',
      items:list.map(s=>({id:s.id,name:s.name,timings:s.timings||[],dosage_quantity:s.dosage_quantity,dosage_unit:s.dosage_unit}))
    }),{headers:{'Content-Type':'application/json'}}));
    const reg=await navigator.serviceWorker.ready;
    if('periodicSync' in reg){
      try{await reg.periodicSync.register('supp-reminder',{minInterval:2*3600*1000});}catch(e){}
    }
  }catch(e){}
}

// ── L'écran de suspension, côté athlète ────────────────────────────────────
// AUCUN MOT AJOUTÉ. Le texte est TEXTE_ARRET_DRAPEAU / TEXTE_ARRET_GENERAL,
// déjà relu et déjà testé, plus le disclaimer de douleur. Rien ne qualifie la
// blessure, rien n'annonce un délai, rien ne nomme de structure au-delà de la
// zone que l'athlète a lui-même cochée.
function _suspTextes(cause){
  if(cause==='general') return (typeof TEXTE_ARRET_GENERAL!=='undefined')?TEXTE_ARRET_GENERAL:[];
  if(cause==='drapeau') return TEXTE_ARRET_DRAPEAU;
  // Douleur répétée : on ne DIAGNOSTIQUE pas, on constate ce qui a été saisi
  // et on renvoie. Même sortie que les drapeaux, sans le vocabulaire d'alerte.
  return ['On met l\'entraînement en pause sur ce mouvement.',
    'RepCore n\'est pas un dispositif médical. Une douleur qui revient demande l\'avis d\'un médecin ou d\'un kinésithérapeute.',
    'Ton coach le voit de son côté.'];
}
function htmlSuspension(u){
  const sp=suspensionEtat(u);
  if(!sp.actif) return '';
  const zone=(()=>{ try{ const d=drapeauRougeActif(u); return d?d.zone:''; }catch(e){ return ''; } })();
  const msg=suspensionMessageReprise(u);
  return `<div style="background:#1a0000;border:1px solid var(--red);border-radius:var(--r-3);padding:16px 16px;margin-bottom:16px">
    ${_suspTextes(sp.cause).map(t=>`<div style="font-size:var(--fs-md);color:var(--text);line-height:1.7;margin-bottom:10px">${escapeHtml(t)}</div>`).join('')}
    ${sp.mouvement?`<div class="sub" style="font-size:var(--fs-xs);line-height:1.6">Mouvement concerné : ${escapeHtml(sp.mouvement)}.</div>`:''}
    ${zone?`<div class="sub" style="font-size:var(--fs-xs);line-height:1.6">Zone concernée : ${escapeHtml(zone)}.</div>`:''}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px">Ton compteur de semaines est gelé à ${sp.streakGele}. Il ne descend pas pendant la pause. Tes rappels de séance sont coupés, ton réglage est conservé.</div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:8px">Tu peux continuer à noter ce que tu fais : rien n'est bloqué, rien n'est effacé. Seul ton coach peut lever cette pause.</div>
    ${msg?`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6;margin-top:8px">${escapeHtml(msg)}</div>`:''}
    ${blocDisclaimerDouleur()}
  </div>`;
}
function renderSuspension(){
  const z=document.getElementById('clh-suspension');
  if(!z) return;
  let h=''; try{ h=htmlSuspension(currentUser); }catch(e){ h=''; }
  z.innerHTML=h;
}

// ── La séance de retour ────────────────────────────────────────────────────
// RÈGLE 5 : le volume réduit est PROPOSÉ. La proposition ne touche jamais
// `sessions_config` — c'est le plan du coach, et décocher ne doit pas le
// réécrire. Elle vit dans une surcharge par séance, que l'athlète maîtrise.
function repriseDeloadPropose(u){
  const r=repriseEnCours(u);
  return !!(r&&u&&u._repriseDeload!==false);
}
function toggleRepriseDeload(val){
  currentUser._repriseDeload=!!val;
  woState.deload=!!val;
  saveUser();
  // LE BANDEAU DE DECHARGE est dessine par renderWoEx (htmlRepriseSeance et le
  // badge woState.deload). renderWorkoutHeader n'a jamais existe : l'appel
  // levait, avale par le catch, et la case ne changeait rien a l'ecran.
  try{ if(woState&&Array.isArray(woState.exercises)&&woState.exercises.length) renderWoEx(); }catch(e){}
}
// Le mouvement incriminé, rappelé avec la contre-indication au dossier.
// _rappelContreIndication rend un FRAGMENT commençant par une espace, prévu
// pour être concaténé à une phrase coach : on le rogne.
function htmlRepriseSeance(u){
  const r=repriseEnCours(u);
  if(!r) return '';
  let ci='';
  try{ ci=_rappelContreIndication(u).trim(); }catch(e){ ci=''; }
  const zero=r.remiseAZero?suspensionMessageReprise(u):'';
  return `<div style="background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:14px 16px;margin-bottom:12px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:8px">Séance de retour</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.65">Ton coach a levé la pause. Cette séance t'est proposée en volume réduit : tu peux décocher.</div>
    ${r.mouvement?`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:8px">Mouvement à l'origine de la pause : <strong style="color:var(--text)">${escapeHtml(r.mouvement)}</strong>.</div>`:''}
    ${ci?`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:6px">${escapeHtml(ci)}</div>`:''}
    ${zero?`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6;margin-top:8px">${escapeHtml(zero)}</div>`:''}
    <label class="hit44" style="display:flex;align-items:center;gap:10px;margin:12px 0 0;cursor:pointer;text-transform:none;letter-spacing:normal;font-weight:400;font-size:var(--fs-xs);color:var(--sub)">
      <input type="checkbox" ${repriseDeloadPropose(u)?'checked':''} onchange="toggleRepriseDeload(this.checked)" style="width:16px;height:16px;margin:0;accent-color:var(--info);flex-shrink:0">
      Volume réduit pour cette séance
    </label>
    ${blocDisclaimerDouleur()}
  </div>`;
}

// ── La porte de sortie, côté coach ─────────────────────────────────────────
// ELLE N'EXISTAIT POUR AUCUN DRAPEAU. `leverDrapeauRouge` n'était appelée que
// depuis les bancs de test : en production, un drapeau posé ne se retirait
// jamais. Le couloir n'a de sortie que si cette porte existe.
//
// RÈGLE 1 : c'est le SEUL point de levée du produit. Le code ne lève rien de
// lui-même, et l'athlète non plus — le bouton qu'il avait sur son écran santé
// est passé ici.
function htmlLeveeCoach(c){
  const sp=(()=>{ try{ return suspensionEtat(c); }catch(e){ return {actif:false}; } })();
  const dr=(()=>{ try{ return drapeauRougeActif(c); }catch(e){ return null; } })();
  const dg=(()=>{ try{ return drapeauGeneralActif(c); }catch(e){ return null; } })();
  if(!sp.actif&&!dr&&!dg) return '';
  const lignes=[];
  if(dg) lignes.push('Signes généraux signalés : '+dg.cases.map(x=>libelleDrapeau(x)).join(', ')+'.');
  if(dr) lignes.push('Drapeau rouge sur '+dr.zone+' : '+dr.cases.map(x=>{
    const d=DRAPEAUX_ROUGES.find(y=>y.cle===x); return d?d.lib:x; }).join(', ')+'.');
  if(sp.cause==='douleur'&&sp.mouvement)
    lignes.push('Douleur à 4 ou plus sur '+sp.mouvement+', '+SUSP_DOULEUR_SEANCES+' séances de suite.');
  return `<div style="background:#1a0000;border:1px solid var(--red);border-radius:var(--r-3);padding:14px 16px;margin-bottom:16px">
    <div style="font-size:var(--fs-2xs);color:var(--red-text);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:8px">Entraînement suspendu</div>
    ${lignes.map(t=>`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.65;margin-bottom:6px">${escapeHtml(t)}</div>`).join('')}
    ${sp.actif?`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:8px">Depuis ${sp.jours} jour${sp.jours>1?'s':''}. Compteur de semaines gelé à ${sp.streakGele}, rappels coupés, semaines hors du taux de complétion.</div>`:''}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:8px">Toi seul peux lever cette pause. RepCore ne le fera jamais à ta place.</div>
    ${dg?`<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="coachLeverDrapeau('general')">Lever le signalement général</button>`:''}
    ${dr?`<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="coachLeverDrapeau('articulaire')">Lever le drapeau rouge</button>`:''}
    ${blocDisclaimerDouleur()}
  </div>`;
}
function renderLeveeCoach(c){
  const z=document.getElementById('ccd-suspension');
  if(!z) return;
  let h=''; try{ h=c?htmlLeveeCoach(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
}
async function coachLeverDrapeau(quoi){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const lib=(quoi==='general')?'ce signalement général':'ce drapeau rouge';
  if(!await rcConfirm('Lever '+lib+' ? L\'entraînement reprendra, avec une séance de retour en volume réduit.',null,'Lever')) return false;
  let fait=false;
  try{ fait=(quoi==='general')?leverDrapeauGeneral(c):leverDrapeauRouge(c); }catch(e){ fait=false; }
  if(!fait) return false;
  // La synchronisation referme le nœud et rend sa valeur à la série. Elle est
  // appelée ICI, sur le dossier de l'athlète, avant la remontée.
  try{ suspensionSynchroniser(c); }catch(e){}
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  // N3.18 — LE SUCCES ATTEND LES DEUX DESTINATIONS. Le try/catch synchrone qui
  // entourait cette poussee ne pouvait rien capter d'une promesse, et
  // toastEcriture annoncait un « ✓ » vert sur la foi de la seule ecriture
  // locale : reseau coupe, le coach lisait « Pause levée » et son athlete ne
  // voyait rien.
  const envoi=CLOUD.pushOne(c.email,c);
  try{ _viderCacheSignaux(); }catch(e){}
  renderLeveeCoach(c);
  try{ renderDouleurCoach(c); }catch(e){}
  toastSync(ok,envoi,'Pause levée','la levée est');
  return true;
}

// ── La ligne de pastilles, côté athlète ────────────────────────────────────
// AUCUN ÉCRAN NOUVEAU, aucun formulaire : une ligne sur l'accueil, un appui
// par habitude. RÈGLE 2 : sans assignation, la ligne n'est pas rendue du tout
// — pas de cadre vide, pas d'invitation à en créer.
// ⚠ DUPLIQUE SUR LIFESTYLE, PAS DEPLACE. « Dormir assez », « Bouger tous les
// jours » sont exactement le sujet de Lifestyle — mais l'appui quotidien est un
// RITE D'ACCUEIL, et le retirer de la ou l'athlete le fait deja aurait echange
// une bonne place contre une autre. Le meme rendu sert les deux ecrans ; la
// logique, elle, n'existe qu'une fois.
// `opts.taux` ajoute la lecture a 28 jours, qui a sa place sur Lifestyle — ou
// l'on vient regarder une tendance — et pas sur l'accueil, ou l'on vient
// appuyer sur un bouton.
function htmlHabitudes(u,opts){
  const l=habitudesDe(u);
  if(!l.length) return '';
  const _taux=!!(opts&&opts.taux);
  const auj=localISODate(new Date());
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:10px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Aujourd'hui</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint)">un appui, c'est tout</span>
    </div>
    <div style="display:flex;gap:8px">
      ${l.map(h=>{
        const on=habCoche(u,h.cle,auj);
        return `<button type="button" onclick="habAppui('${escapeHtml(h.cle)}')"
          aria-pressed="${on?'true':'false'}"
          style="flex:1;min-width:0;min-height:44px;border-radius:var(--r-3);cursor:pointer;padding:8px 6px;
            font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;line-height:1.35;
            background:${on?'rgba(34,197,94,.13)':'#111'};border:1px solid ${on?'var(--green)':'var(--border)'};
            color:${on?'var(--text)':'var(--sub)'}">
          <span style="display:block;font-size:var(--fs-lg);margin-bottom:2px">${on?'●':'○'}</span>
          ${escapeHtml(h.libelle||h.cle)}
        </button>`;}).join('')}
    </div>
    ${l.map(h=>_htmlHabSemaine(u,h)).join('')}
    ${_taux?_htmlHabTaux(u):''}
  </div>`;
}
// LA FENETRE GLISSANTE, DITE. Le coach lit ce taux depuis toujours ; l'athlete,
// lui, ne voyait que ses sept pastilles — donc jamais la tendance qui, elle,
// resiste a une mauvaise semaine. La phrase reprend mot pour mot celle de la
// fiche coach : les deux doivent dire la meme chose du meme chiffre.
function _htmlHabTaux(u){
  const g=habTauxGlobal(u);
  if(g==null) return '';
  return `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);
      font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
    Moyenne sur ${HAB_FENETRE_JOURS} jours : <strong style="color:${g>=70?'var(--green)':g>=40?'var(--amber)':'var(--text)'}">${g}&nbsp;%</strong>.
    Fenêtre glissante, le jour en cours n'est pas compté.</div>`;
}
// La vue hebdomadaire L→D. Elle emprunte le rendu de renderNutriDots — même
// pastille, même ordre, même vocabulaire visuel — via le fragment partagé
// _htmlLigneDots. renderNutriDots n'est PAS réécrite : elle délègue désormais
// son propre balisage au même fragment, et garde son élément, sa source de
// données et son score.
function _htmlHabSemaine(u,h){
  const sem=habSemaine(u,h.cle);
  const n=sem.filter(x=>x===true).length;
  return `<div style="margin-top:12px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--text) 5%,transparent)">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">
      <span style="font-size:var(--fs-2xs);color:var(--sub);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(h.libelle||h.cle)}</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint);flex-shrink:0">${n}/7</span>
    </div>
    <div style="display:flex;gap:6px">${_htmlLigneDots(sem,18)}</div>
  </div>`;
}
function habAppui(cle){
  const auj=localISODate(new Date());
  if(!habBasculer(currentUser,cle,auj)) return false;
  saveUser();
  renderHabitudes();
  return true;
}
function renderHabitudes(){
  const z=document.getElementById('clh-habitudes');
  if(!z) return;
  let h=''; try{ h=accueilMasque('hab')?'':htmlHabitudes(currentUser); }catch(e){ h=''; }
  z.innerHTML=h?'<div class="acc-boite" data-acc>'+_accX('hab')+h+'</div>':'';
}

// ── Côté coach : la sélection, et le pourcentage ───────────────────────────
// LA MAQUETTE DE KEVIN (24/09/2026) : « change ca par ca et rajoute les
// fonctionnalites ». Un en-tete qui se replie et dit le compte ; l'ajout sur
// UNE ligne (la liste, ou un libelle a soi) ; six habitudes recommandees
// qui s'ajoutent d'un appui ; puis les habitudes posees, chacune avec son
// taux sur 28 jours et sa semaine en cours.
// ⚠ LES REGLES NE CHANGENT PAS : trois au plus, ni poids, ni mesure, ni
//   restriction (habitudeAjouter tranche), et le retrait garde l'historique.
const HAB_RECOMMANDEES=Object.freeze([
  {cle:'sommeil',     lib:'Sommeil',          sous:'Durée et qualité',    ico:'lit',     ton:'violet'},
  {cle:'hydratation', lib:'Hydratation',      sous:'Quantité d’eau',      ico:'verre',   ton:'bleu'},
  {cle:'alimentation',lib:'Alimentation',     sous:'Suivi global',        ico:'pomme',   ton:'vert'},
  {cle:'mobilite',    lib:'Mobilité',         sous:'Étirements, mobilité',ico:'course',  ton:'orange'},
  {cle:'stress',      lib:'Gestion du stress',sous:'Bien-être mental',    ico:'lotus',   ton:'rose'},
  {cle:'substance',   lib:'Aucune substance', sous:'Tabac, alcool, etc.', ico:'interdit',ton:'rouge'}
]);
let _habReplie=false;
function _habSvg(p,plein){ return '<svg viewBox="0 0 24 24" '+(plein?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter"')+' aria-hidden="true">'+p+'</svg>'; }
const HAB_ICO={
  chevron:_habSvg('<path d="M6 9l6 6 6-6"/>'),
  info:_habSvg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01"/>'),
  cible:_habSvg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M13 11l7-7M17 3.5l.5 3 3 .5"/>'),
  ampoule:_habSvg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',true),
  loupe:_habSvg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'),
  crayon:_habSvg('<path d="M16.9 3.6a2.1 2.1 0 0 1 3 3L8.4 18.1l-4 1 1-4z"/><path d="M14.8 5.7l3 3"/>'),
  plus:_habSvg('<path d="M12 5v14M5 12h14"/>'),
  etoile:_habSvg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',true),
  haltere:_habSvg('<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'),
  lit:_habSvg('<path d="M3 19V6.5M3 15h18v4M21 15v-2.4A2.6 2.6 0 0 0 18.4 10H11v5"/><circle cx="7" cy="11.2" r="1.9"/>'),
  verre:_habSvg('<path d="M6 3h12l-1.6 16.2a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-2-1.8z"/><path d="M6.6 9h10.8"/>'),
  pomme:_habSvg('<path d="M12 7c-2-2-6.5-1.5-6.5 3.5 0 4 2.7 9.5 5 9.5 1 0 1.2-.5 1.5-.5s.5.5 1.5.5c2.3 0 5-5.5 5-9.5C18.5 5.5 14 5 12 7z"/><path d="M12 7c0-2 1-3.5 3-4"/>',true),
  course:_habSvg('<circle cx="14" cy="4.5" r="2"/><path d="M10 21l2.5-6-3-3 2.5-4 3 3 3.5 1M9.5 8L6 9.5 5 13.5M12.5 15l3.5 6"/>'),
  lotus:_habSvg('<path d="M12 20c-4 0-8-2-9-6 3 0 5 1 6 2-1-3 0-7 3-10 3 3 4 7 3 10 1-1 3-2 6-2-1 4-5 6-9 6z"/>',true),
  interdit:_habSvg('<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>'),
  croix:_habSvg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  coche:_habSvg('<path d="M5 12.5l4.5 4.5L19 7.5"/>')
};
function htmlHabitudesCoach(c){
  const l=habitudesDe(c);
  const g=habTauxGlobal(c);
  const plein=l.length>=HAB_MAX;
  const dispo=HAB_CATALOGUE.filter(x=>!l.some(h=>h.cle===x.cle));
  const reco=HAB_RECOMMANDEES.map(r=>{
    const deja=l.some(h=>h.cle===r.cle);
    return '<button type="button" class="hbc-reco" data-ton="'+r.ton+'"'+((deja||plein)?' disabled':'')
      +(deja?' data-deja=""':'')+' onclick="habCoachAjouter(\''+r.cle+'\')"'
      +' title="'+escapeHtml(deja?'Déjà assignée':plein?'Trois habitudes au maximum':'Ajouter : '+((HAB_CATALOGUE.find(x=>x.cle===r.cle)||{}).lib||r.lib))+'">'
      +'<span class="hbc-reco-i">'+HAB_ICO[r.ico]+'</span>'
      +'<span class="hbc-reco-c"><b>'+escapeHtml(r.lib)+'</b><span>'+(deja?'Déjà assignée':escapeHtml(r.sous))+'</span></span>'
      +(deja?'<span class="hbc-reco-ok">'+HAB_ICO.coche+'</span>':'')+'</button>';
  }).join('');
  const poses=l.length
    ? l.map(h=>{
        const sem=habSemaine(c,h.cle), n=sem.filter(x=>x===true).length;
        const r=HAB_RECOMMANDEES.find(x=>x.cle===h.cle);
        return '<div class="hbc-h"><span class="hbc-reco-i" data-ton="'+(r?r.ton:'gris')+'">'+HAB_ICO[r?r.ico:'cible']+'</span>'
          +'<div class="hbc-h-c"><b>'+escapeHtml(h.libelle||h.cle)+'</b>'
            +'<span class="hbc-h-j" role="img" aria-label="'+n+' jours cochés cette semaine">'
              +sem.map(x=>'<i data-e="'+(x===true?'ok':(x===null?'futur':'vide'))+'"></i>').join('')+'<em>'+n+'/7</em></span></div>'
          +'<div class="hbc-h-t"><strong>'+habTaux(c,h.cle)+'&nbsp;%</strong><span>sur '+HAB_FENETRE_JOURS+' jours</span></div>'
          +'<button type="button" class="hbc-h-x" onclick="habCoachRetirer(\''+escapeHtml(h.cle)+'\')" aria-label="Retirer '+escapeHtml(h.libelle||h.cle)+'">'+HAB_ICO.croix+'</button>'
          +'</div>';
      }).join('')
      +(g!=null?'<div class="hbc-moy">Moyenne sur '+HAB_FENETRE_JOURS+' jours : <b>'+g+'&nbsp;%</b>. Fenêtre glissante, le jour en cours n’est pas compté.</div>':'')
    : emptyState('haltere','<b>Aucune habitude assignée pour le moment.</b>'
      +'<br>Choisis une habitude dans la liste ci-dessus ou crée la tienne pour commencer à suivre les progrès de cet athlète. Rien ne s’affiche chez l’athlète tant que tu n’en poses pas.',null,null,'padding:20px 8px');
  return '<section class="hbc'+(_habReplie?' hbc-replie':'')+'">'
    +'<div class="hbc-tete">'
      +'<button type="button" class="hbc-pli" onclick="habCoachPlier()" aria-expanded="'+(!_habReplie)+'" aria-label="Replier les habitudes">'+HAB_ICO.chevron+'</button>'
      +'<h3>Habitudes</h3><span class="hbc-compte">'+l.length+'/'+HAB_MAX+'</span>'
      +'<span class="hbc-tete-s">Les habitudes permettent de suivre des comportements clés en dehors des entraînements.</span>'
      +'<button type="button" class="hbc-info" onclick="habCoachRegles()" aria-label="Les règles des habitudes">'+HAB_ICO.info+'</button>'
    +'</div>'
    +'<div class="hbc-corps">'
      +'<div class="hbc-carte">'
        +'<div class="hbc-intro">'
          +'<span class="hbc-intro-i">'+HAB_ICO.cible+'</span>'
          +'<div class="hbc-intro-c"><h4>Suivi des <span>habitudes</span></h4><span>Ajoute jusqu’à '+HAB_MAX+' habitudes à suivre pour cet athlète.</span></div>'
          +'<div class="hbc-astuce">'+HAB_ICO.ampoule+'<span>Les habitudes aident à améliorer la récupération, les performances et la constance sur le long terme.</span></div>'
        +'</div>'
        +'<div class="hbc-lbl">Ajouter une habitude</div>'
        +(plein
          ?'<div class="hbc-plein">Trois au maximum. Retires-en une pour en ajouter une autre.</div>'
          :'<div class="hbc-ajout">'
            +'<label class="hbc-champ hbc-liste">'+HAB_ICO.loupe
              +'<select id="hab-cat" aria-label="Choisir une habitude"><option value="">Choisir dans la liste</option>'
              +dispo.map(x=>'<option value="'+x.cle+'">'+escapeHtml(x.lib)+'</option>').join('')+'</select>'+HAB_ICO.chevron+'</label>'
            +'<span class="hbc-ou">ou</span>'
            +'<label class="hbc-champ">'+HAB_ICO.crayon
              +'<input id="hab-libre" maxlength="'+HAB_LIBELLE_MAX+'" placeholder="Saisis-en une ('+HAB_LIBELLE_MAX+' caractères max)" aria-label="Habitude à saisir" onkeydown="if(event.key===\'Enter\')habCoachAjouter()"></label>'
            +'<button type="button" class="btn btn-red hbc-ajouter" onclick="habCoachAjouter()">'+HAB_ICO.plus+'<span>Ajouter</span></button>'
          +'</div>')
        +'<div class="hbc-lbl hbc-lbl-reco">'+HAB_ICO.etoile+'Habitudes recommandées</div>'
        +'<div class="hbc-recos">'+reco+'</div>'
      +'</div>'
      +'<div class="hbc-lbl">Habitudes ajoutées ('+l.length+'/'+HAB_MAX+')</div>'
      +'<div class="hbc-poses">'+poses+'</div>'
      +'<div class="hbc-note">Ni poids, ni mesure, ni restriction alimentaire : ce sont des données de santé, elles ne se cochent pas.</div>'
    +'</div>'
    +'</section>';
}
function renderHabitudesCoach(c){
  const z=document.getElementById('ccd-habitudes');
  if(!z) return;
  let h=''; try{ h=c?htmlHabitudesCoach(c):''; }catch(e){ h=''; }
  z.innerHTML=h;
}
function habCoachPlier(){
  _habReplie=!_habReplie;
  try{ renderHabitudesCoach(getOwnedClient(currentClientId)); }catch(e){}
}
function habCoachRegles(){
  _sanFeuille('Les habitudes',
    '<div class="san-aide">Trois habitudes au plus par athlète. Il les coche d’un appui sur son accueil, pour le jour même ou jusqu’à deux jours en arrière.</div>'
    +'<div class="san-aide">Le pourcentage se lit sur '+HAB_FENETRE_JOURS+' jours glissants, sans le jour en cours. Retirer une habitude garde ses coches : la remettre plus tard retrouve tout.</div>'
    +'<div class="san-aide">Une habitude ne peut porter ni sur un poids, ni sur une mesure, ni sur une restriction alimentaire : ce sont des données de santé.</div>');
}
// N3.2 — LE DOSSIER ENREGISTRE EST CELUI DE L'ATHLETE. getOwnedClient sans
// second argument rend un objet DETACHE : DB.get reparse le JSON a chaque
// appel. La mutation partait bien au serveur par pushOne, mais saveUser ne
// range que currentUser — le coach. L'habitude reapparaissait donc effacee a
// la reouverture de la fiche. On passe la carte, comme le fait deja
// coachSetPhase.
// `cleForcee` : une habitude recommandee, ajoutee d'un appui sur sa carte.
function habCoachAjouter(cleForcee){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const force=(typeof cleForcee==='string'&&HAB_CATALOGUE.some(x=>x.cle===cleForcee))?cleForcee:'';
  const cat=force||(document.getElementById('hab-cat')||{}).value||'';
  const libre=force?'':((document.getElementById('hab-libre')||{}).value||'').trim();
  if(!cat&&!libre) return toast('Choisis une habitude ou saisis-en une','var(--orange)');
  // Le libellé libre porte sa propre clé, dérivée du texte : deux habitudes
  // écrites pareil sont la même habitude, et l'historique suit.
  const cle=cat||('libre-'+exKey(libre).toLowerCase().replace(/ /g,'-').slice(0,24));
  const r=habitudeAjouter(c,cle,libre);
  if(!r.ok) return toast(r.raison,'var(--orange)');
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  // N3.18 — meme correction : le try/catch ne captait rien, et le « ✓ » vert
  // partait avant que le serveur ait repondu.
  const envoi=CLOUD.pushOne(c.email,c);
  renderHabitudesCoach(c);
  toastSync(ok,envoi,'Habitude ajoutée','l\'habitude est');
  return true;
}
async function habCoachRetirer(cle){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!await rcConfirm('Retirer cette habitude ? Les coches déjà faites sont conservées.',null,'Retirer')) return false;
  if(!habitudeRetirer(c,cle)) return false;
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  // N3.18 — meme correction.
  const envoi=CLOUD.pushOne(c.email,c);
  renderHabitudesCoach(c);
  toastSync(ok,envoi,'Habitude retirée','le retrait est');
  return true;
}
function renderWoReminderCard(){
  const el=document.getElementById('clh-wo-reminder-row');if(!el)return;
  // Plus sur l'accueil (Kevin, 28/09/2026) : le rappel se règle dans
  // Réglages › Notifications (htmlReglagesPush).
  el.innerHTML=''; return;
  const u=currentUser;
  if(!u._woReminderEnabled){
    el.innerHTML=`<button onclick="openWoReminderConfig()" style="width:100%;background:transparent;border:1px dashed var(--border);border-radius:var(--r-3);padding:12px 16px;display:flex;align-items:center;gap:10px;cursor:pointer;font-family:Montserrat,sans-serif;color:var(--sub);font-size:var(--fs-xs);font-weight:700;letter-spacing:.8px;margin-bottom:10px">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" style="width:18px;height:18px;display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Configurer un rappel séance</span>
    </button>`;
    return;
  }
  const DS=['L','Ma','Me','J','V','S','D'];
  const days=(u._woReminderDays||[]).map(i=>DS[i]).join(' · ');
  const hh=String(u._woReminderHour??18).padStart(2,'0');
  const mm=String(u._woReminderMin??0).padStart(2,'0');
  el.innerHTML=`<div style="background:var(--surface-0);border:1px solid #1a3020;border-radius:var(--r-3);padding:12px 16px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" style="width:18px;height:18px;display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
    <div style="flex:1;min-width:0">
      <div style="font-size:var(--fs-xs);font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:.8px">Rappel séance activé</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${hh}:${mm}${_fragmentSiValeur(' · ',days)}</div>
    </div>
    <button onclick="openWoReminderConfig()" style="background:none;border:1px solid var(--border);border-radius:var(--r-2);padding:6px 10px;color:var(--sub);font-size:var(--fs-xs);cursor:pointer;font-family:Montserrat,sans-serif">${icon('sliders',14)}</button>
  </div>`;
}
function checkWoReminderToday(){
  if(!currentUser||currentUser.role!=='athlete')return;
  // SOUS SUSPENSION, AUCUN RAPPEL. Convoquer à l'entraînement quelqu'un à qui
  // on vient de dire d'arrêter serait le pire des deux mondes. Le réglage
  // n'est PAS effacé : il reprend seul à la levée.
  try{ if(suspensionEtat(currentUser).actif) return; }catch(e){}
  if(!currentUser._woReminderEnabled)return;
  const days=currentUser._woReminderDays||[];if(!days.length)return;
  const now=new Date();
  const todayJS=now.getDay();
  const todayApp=todayJS===0?6:todayJS-1;
  if(!days.includes(todayApp))return;
  if(now.getHours()<(currentUser._woReminderHour??18))return;
  const todayStr=localISODate(now);
  if(currentUser._lastWoNotif===todayStr)return;
  currentUser._lastWoNotif=todayStr;saveUser();
  showWoReminderBanner();
  // Même partage qu'au rappel de bilan : la bannière d'abord, la notification
  // système seulement si le navigateur la propose.
  if(_appAuPremierPlan()) return;
  const _nomSeance=_nomSeanceDuJour(currentUser,todayApp)||'ta séance';
  const _rap=texteRappelRecord(currentUser);
  if(_notifSupported()&&Notification.permission==='granted'){
    navigator.serviceWorker.ready.then(reg=>reg.showNotification('Séance du jour',{
      body:(currentUser.fname||'')+', '+_nomSeance+' est au programme.'+(_rap?' '+_rap+'.':''),
      icon:'./icons/icon-192x192.png',badge:'./icons/icon-192x192.png',
      tag:'wo-reminder',requireInteraction:false,data:{url:'./?wo=1'}
    })).catch(()=>{});
  }
}
// Le texte « Record à portée : … » de la séance du jour, ou ''.
function texteRappelRecord(u){
  try{ return texteRecordAPortee(recordAPortee(u,seancePrevueDuJour(u))); }catch(e){ return ''; }
}
function showWoReminderBanner(){
  document.getElementById('wo-reminder-banner')?.remove();
  const b=document.createElement('div');
  b.id='wo-reminder-banner';
  b.style.cssText='position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;z-index:var(--z-bar);animation:slideDown var(--t-3) var(--c-out)';
  b.innerHTML=`<div style="background:linear-gradient(135deg,#001a06,#002810);border-bottom:2px solid var(--green);padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openSessionPicker();document.getElementById('wo-reminder-banner')?.remove()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
    <div style="font-size:var(--fs-2xl);flex-shrink:0">${icon('muscle',14)}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:var(--fs-xs);font-weight:900;color:var(--green);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px">Séance du jour</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(texteRappelRecord(currentUser)||'C\'est l\'heure de t\'entraîner ! Clique pour démarrer.')}</div>
    </div>
    <button onclick="event.stopPropagation();document.getElementById('wo-reminder-banner')?.remove()" style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-xl);cursor:pointer;flex-shrink:0;padding:0 4px;line-height:1">${icon('croix',14)}</button>
  </div>`;
  document.body.appendChild(b);
  setTimeout(()=>b?.remove(),60000);
}
function openWoReminderConfig(){
  const u=currentUser;
  const curH=u._woReminderHour??18;
  const curM=u._woReminderMin??0;
  const curDays=u._woReminderDays||(
    (u.sessions_config||[]).reduce((a,s,i)=>{if(s.active)a.push(i);return a;},[])
  );
  const DS=['L','Ma','Me','J','V','S','D'];
  const dayBtns=DS.map((d,i)=>`<button id="wrd-day-${i}" onclick="wrdToggleDay(${i})" style="flex:1;min-width:0;border:1px solid ${curDays.includes(i)?'var(--red)':'var(--border)'};border-radius:var(--r-2);padding:10px 2px;background:${curDays.includes(i)?'#1a0000':'transparent'};color:${curDays.includes(i)?'var(--red)':'var(--sub)'};font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer">${d}</button>`).join('');
  const hourOpts=Array.from({length:17},(_,i)=>i+6).map(h=>`<option value="${h}" ${h===curH?'selected':''}>${String(h).padStart(2,'0')}h</option>`).join('');
  document.getElementById('wo-reminder-config')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div id="wo-reminder-config" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center" onclick="if(event.target===this)this.remove()">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px 40px;width:100%;max-width:480px;animation:slideUp var(--t-3) var(--c-out)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2 style="margin:0;font-size:var(--fs-lg);display:flex;align-items:center;gap:6px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" style="width:16px;height:16px;display:inline-block;vertical-align:middle;flex-shrink:0"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Rappel séance</h2>
      <button onclick="document.getElementById('wo-reminder-config').remove()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;line-height:1">${icon('croix',14)}</button>
    </div>
    <label style="font-size:var(--fs-xs);display:block;margin-bottom:6px">Heure du rappel</label>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <select id="wrd-hour" style="flex:1;font-size:var(--fs-lg);font-family:var(--pile-titre);letter-spacing:1px;padding:10px;background:var(--surface-1);border:1px solid var(--border);color:var(--text);border-radius:var(--r-2)">${hourOpts}</select>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button id="wrd-min-0" onclick="wrdSetMin(0)" style="border-radius:var(--r-1);padding:6px 12px;font-size:var(--fs-xs);font-weight:800;font-family:Montserrat,sans-serif;cursor:pointer;background:${curM===0?'var(--red)':'transparent'};border:1px solid ${curM===0?'var(--red)':'var(--border)'};color:${curM===0?'var(--text)':'var(--sub)'}">:00</button>
        <button id="wrd-min-30" onclick="wrdSetMin(30)" style="border-radius:var(--r-1);padding:6px 12px;font-size:var(--fs-xs);font-weight:800;font-family:Montserrat,sans-serif;cursor:pointer;background:${curM===30?'var(--red)':'transparent'};border:1px solid ${curM===30?'var(--red)':'var(--border)'};color:${curM===30?'var(--text)':'var(--sub)'}">:30</button>
      </div>
    </div>
    <label style="font-size:var(--fs-xs);display:block;margin-bottom:6px">Jours d'entraînement</label>
    <div style="display:flex;gap:6px;margin-bottom:24px">${dayBtns}</div>
    <label class="rg-reglage"><input type="checkbox" ${(u.nutrition&&u.nutrition.rappelAvantSeance===true)?'checked':''} onchange="basculerRappelAvantSeance(this.checked)">
      <span>Avant la séance, me prévenir s’il me reste l’essentiel de mes glucides <em>(3 h avant, une fois par jour au plus)</em></span></label>
    <button class="btn btn-red" onclick="saveWoReminderConfig()" style="margin-bottom:10px;letter-spacing:1.5px">Activer le rappel</button>
    ${u._woReminderEnabled?`<button class="btn btn-outline" onclick="disableWoReminder()" style="font-size:var(--fs-xs);color:var(--sub)">Désactiver les rappels</button>`:''}
  </div></div>`);
  window._wrdDays=[...curDays];
  window._wrdMin=curM;
}
function wrdToggleDay(i){
  if(!window._wrdDays)window._wrdDays=[];
  const idx=window._wrdDays.indexOf(i);
  if(idx>=0)window._wrdDays.splice(idx,1);else window._wrdDays.push(i);
  const btn=document.getElementById('wrd-day-'+i);if(!btn)return;
  const on=window._wrdDays.includes(i);
  btn.style.border='1px solid '+(on?'var(--red)':'var(--border)');
  btn.style.background=on?'#1a0000':'transparent';
  btn.style.color=on?'var(--red)':'var(--sub)';
}
function wrdSetMin(m){
  window._wrdMin=m;
  ['wrd-min-0','wrd-min-30'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const on=id==='wrd-min-'+m;
    el.style.background=on?'var(--red)':'transparent';
    el.style.border='1px solid '+(on?'var(--red)':'var(--border)');
    el.style.color=on?'var(--text)':'var(--sub)';
  });
}
// ══════════ « JE TE PREVIENS ? » — APRES LA PREMIERE SEANCE ════════════
//
// LE DEFAUT QU'ELLE CORRIGE : Notification.requestPermission n'etait appelee
// qu'a deux endroits — le rappel de bilan et la feuille de rappel de seance.
// Deux ecrans de REGLAGE, qu'on n'atteint qu'une fois deja convaincu. La
// permission n'etait donc jamais demandee a ceux qui en auraient le plus
// besoin : ceux qui viennent de finir leur premiere seance et qu'il faut
// ramener a la deuxieme.
//
// ⚠ ON NE DEMANDE PAS UNE PERMISSION, ON PROPOSE UN SERVICE. La difference
// tient au texte : « Ta prochaine seance est mercredi a 18 h. Je te previens ? »
// nomme ce qu'on rend, pas ce qu'on prend. Le jour et l'heure viennent des
// creneaux que l'athlete a choisis lui-meme a l'inscription — c'est SA phrase
// qu'on lui relit.
//
// PURE. Le prochain creneau d'entrainement, ou null.
//
// STRICTEMENT POSTERIEUR A `maintenant` : on vient de finir une seance, celui
// d'aujourd'hui est derriere nous. Un creneau plus tard dans la MEME journee
// reste valide — quelqu'un qui s'entraine le matin et a pose son rappel a 18 h
// est un cas rare mais pas absurde, et lui annoncer mercredi prochain serait
// faux.
function prochainCreneau(u,maintenant){
  const jours=(u&&u._woReminderDays)||[];
  if(!jours.length) return null;
  const t=Number(maintenant)||0;
  if(!t) return null;
  const h=(u._woReminderHour>=0&&u._woReminderHour<=23)?u._woReminderHour:18;
  const m=(u._woReminderMin===30)?30:0;
  const d=new Date(t);
  // getDay() rend 0=dimanche ; _woReminderDays compte 0=lundi, comme DAYS.
  const auj=(d.getDay()+6)%7;
  const minutesMaintenant=d.getHours()*60+d.getMinutes();
  const cible=h*60+m;
  const tries=[...new Set(jours.map(Number).filter(x=>x>=0&&x<=6))].sort((a,b)=>a-b);
  if(!tries.length) return null;
  for(let dj=0;dj<=7;dj++){
    const j=(auj+dj)%7;
    if(!tries.includes(j)) continue;
    if(dj===0&&cible<=minutesMaintenant) continue;   // deja passe aujourd'hui
    return {jour:j,dansJours:dj,h,m};
  }
  return null;
}
// PURE. La phrase, telle qu'elle s'affiche. « aujourd'hui » et « demain »
// plutot que le nom du jour quand c'est tout proche : personne ne dit « ta
// prochaine seance est mercredi » un mardi soir.
// « 18 h » et non « 18:00 » : c'est une phrase, pas un tableau.
function texteProchainCreneau(c){
  if(!c) return '';
  const quand=c.dansJours===0?'aujourd’hui'
    :c.dansJours===1?'demain'
    :DAYS[c.jour].toLowerCase();
  return quand+' à '+c.h+' h'+(c.m?' '+c.m:'');
}
// PURE. Que faut-il montrer a cet athlete, a cet instant ? Rend 'rien',
// 'demander' ou 'installer'.
//
// LES REGLES, DANS L'ORDRE OU ELLES MORDENT :
//   • LA PREMIERE SEANCE, ET ELLE SEULE. `sessions.length===1` — la meme
//     donnee que first_workout_completed juste au-dessus dans finishWorkout,
//     et non un drapeau d'appareil.
//   • UNE SEULE FOIS DANS LA VIE DU COMPTE. Le temoin est dans le DOSSIER —
//     pas dans localStorage : « la vie du compte » traverse les appareils, et
//     reposer la question sur un second telephone serait exactement ce que
//     cette regle interdit.
//   • DEJA REPONDU AU NAVIGATEUR : on n'affiche RIEN. Un refus navigateur ne
//     se rattrape pas depuis l'app — la seule voie est les reglages du
//     systeme — et reinsister est nuisible. Un accord n'a rien a demander.
//   • PAS DE NOTIFICATIONS DU TOUT : on propose l'installation a la place.
//     C'est le cas de Safari dans un onglet, ou Notification n'existe pas ;
//     installer RepCore sur l'ecran d'accueil la fait apparaitre. Le message
//     est _NOTIF_INDISPO, deja ecrit et deja relu.
function etatInvitationNotif(u,supporte,permission){
  if(!u||u.role==='coach') return 'rien';
  if((u.sessions||[]).length!==1) return 'rien';
  if(u._notifDemandeeLe) return 'rien';
  // ⚠ CE CAS RENDAIT 'installer' ET NE LE REND PLUS. La carte des
  // notifications portait elle-meme la proposition d'installation quand
  // Notification n'existe pas — c'etait le lot precedent, et son commentaire
  // renvoyait deja « voir A6 ». A6 est arrive : l'installation est devenue une
  // etape a part entiere, juste en dessous, avec son propre argument. Deux
  // cartes qui proposent la meme chose au meme instant valent moins qu'une.
  // Le message n'est pas perdu : la carte d'installation ajoute la raison
  // « c'est aussi ce qui rend les rappels possibles » quand ils manquent.
  if(!supporte) return 'rien';
  if(permission==='granted'||permission==='denied') return 'rien';
  return 'demander';
}
// ── CE QUE L'ATHLETE ACCEPTE, EN TROIS CASES (27/09/2026) ─────────────────
// « Oui, préviens-moi » ouvrait TOUS les types d'un coup, sous une phrase qui
// promettait « un rappel, ces jours-là, et rien d'autre ». Chaque case
// regroupe des types de PUSH_TYPES ; ce qui est décoché est écrit dans
// u.pushPrefs (false) AVANT l'abonnement, et le serveur comme les rappels
// locaux lisent pushPrefs avant chaque envoi. `acces` (fin d'accès) n'est
// dans aucune case : il reste, et la carte le dit.
const NOTIF_GROUPES=Object.freeze([
  Object.freeze({cle:'seances',titre:'Mes séances et ma série',types:Object.freeze(['serie','badge','wrapped','retour','sante']),
    detail:'un rappel avant chacune de tes séances, le jeudi en fin de journée (entre 17 h et 21 h) si ta série est en danger, le dimanche quand un badge est à une ou deux séances, le 1er du mois ton mois en chiffres, après une pause (7, 14 et 30 jours sans séance), et le matin si ta nuit n’est pas arrivée (synchronisation iPhone)'}),
  Object.freeze({cle:'coach',titre:'Mon coach',types:Object.freeze(['coach','bilan','defi','relance','message']),
    detail:'quand ton coach t’écrit, répond à un bilan ou lance un défi, le samedi si ton dernier bilan date de deux semaines, et les rappels que ton coach a programmés (un par semaine au plus)'}),
  Object.freeze({cle:'invitations',titre:'Mes invitations',types:Object.freeze(['filleul']),
    detail:'quand quelqu’un s’inscrit avec ton lien'})
]);
// PURE. Les cases cochées d'office, selon le profil : les séances toujours ;
// le coach s'il y en a un ; les invitations si l'athlète a déjà un code à
// partager. Une case qui ne concerne personne ne se coche pas toute seule.
function notifGroupesDefaut(u){
  const x=u||{};
  return {seances:true,
    coach:!!x.coachEmailKey,
    invitations:!!(x.parrainage&&x.parrainage.code)};
}
// PURE. u.pushPrefs après le choix : un type décoché passe à false, un type
// coché redevient permis (la clé disparaît). Les types hors cases ne bougent pas.
function pushPrefsDepuisChoix(prefs,choix){
  const p=(prefs&&typeof prefs==='object')?Object.assign({},prefs):{};
  for(const g of NOTIF_GROUPES) for(const t of g.types){ if(choix&&choix[g.cle]) delete p[t]; else p[t]=false; }
  return p;
}
// PURE. EXACTEMENT ce qui sera envoyé, pour les cases cochées.
function texteInvitationNotif(choix){
  const l=NOTIF_GROUPES.filter(g=>choix&&choix[g.cle]).map(g=>g.detail);
  if(!l.length) return 'Aucune case cochée : rien ne te sera envoyé.';
  const t=l.length===1?l[0]:l.slice(0,-1).join(' ; ')+' ; et '+l[l.length-1];
  return 'Tu recevras '+t+'. Et, trois jours avant la fin de ton accès, un rappel. '
    +'Une notification par jour au plus, jamais entre 21 h et 8 h.';
}
function _invNotifChoixLus(){
  const c={};
  for(const g of NOTIF_GROUPES){ const e=document.getElementById('inv-notif-g-'+g.cle); c[g.cle]=!!(e&&e.checked); }
  return c;
}
function invNotifMaj(){
  const c=_invNotifChoixLus();
  const d=document.getElementById('inv-notif-detail');
  if(d) d.textContent=texteInvitationNotif(c);
  const b=document.getElementById('inv-notif-oui');
  if(b) b.disabled=!Object.keys(c).some(k=>c[k]);
}
// PURE. La carte. Deux boutons, jamais trois, et « Non merci » a le meme
// poids visuel qu'un refus doit avoir : lisible, pas honteux, pas cache.
function _htmlInvitationNotif(etat,phrase,choix){
  if(etat==='rien') return '';
  const ch=choix||{seances:true,coach:false,invitations:false};
  const cadre=(titre,corps,actions)=>
    '<div style="background:var(--info-bg);border:1px solid var(--info-border);'
    +'border-radius:var(--r-3);padding:14px 16px;margin-bottom:14px">'
    +'<div style="font-size:var(--fs-xs);color:var(--info);letter-spacing:3px;font-weight:800;'
    +'text-transform:uppercase;margin-bottom:6px">'+titre+'</div>'+corps+actions+'</div>';
  // LA PROMESSE EST NOMMEE, ET ELLE VIENT DE SES PROPRES CRENEAUX. Sans
  // planning enregistre, on ne promet pas un jour qu'on ne connait pas : la
  // phrase reste vraie, simplement moins precise.
  const promesse=phrase
    ? 'Ta prochaine séance est <strong style="color:var(--text)">'+escapeHtml(phrase)+'</strong>. Je te préviens ?'
    : 'Je peux te prévenir avant chacune de tes séances. On essaie ?';
  const cases=NOTIF_GROUPES.map(g=>'<label for="inv-notif-g-'+g.cle+'" style="display:flex;align-items:center;gap:10px;'
      +'margin:0;padding:8px 0;cursor:pointer;text-transform:none;letter-spacing:normal;font-weight:700;'
      +'font-size:var(--fs-sm);color:var(--text)">'
      +'<input type="checkbox" id="inv-notif-g-'+g.cle+'" data-groupe="'+g.cle+'"'+(ch[g.cle]?' checked':'')
      +' onchange="invNotifMaj()" style="width:20px;height:20px;accent-color:var(--red);flex-shrink:0;margin:0;cursor:pointer">'
      +escapeHtml(g.titre)+'</label>').join('');
  const aucune=!NOTIF_GROUPES.some(g=>ch[g.cle]);
  return cadre('Et la prochaine ?',
    '<div style="font-size:var(--fs-md);color:var(--text-strong);line-height:1.5;margin-bottom:4px">'
      +promesse+'</div>'
    +'<div style="margin:4px 0 6px">'+cases+'</div>'
    +'<div id="inv-notif-detail" style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-bottom:12px">'
      +escapeHtml(texteInvitationNotif(ch))+'</div>',
    '<div style="display:flex;gap:8px">'
    +'<button type="button" id="inv-notif-oui" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px;letter-spacing:.5px" '
    +(aucune?'disabled ':'')+'onclick="invNotifOui()">Oui, préviens-moi</button>'
    +'<button type="button" class="btn btn-outline btn-sm" style="flex:0 0 auto;width:auto;padding:0 16px;margin:0;'
    +'min-height:44px;letter-spacing:.5px" onclick="invNotifNon()">Non merci</button>'
    +'</div>');
}
// Le tour impur : decider, rendre, et MARQUER.
//
// ⚠ LE TEMOIN EST POSE A L'AFFICHAGE, pas a la reponse. La consigne dit « une
// seule fois, quelle que soit la reponse » — et « quelle que soit la reponse »
// inclut l'absence de reponse. Un athlete qui quitte l'ecran sans toucher aux
// deux boutons a bien vu la question ; la reposer serait insister.
function _rendreInvitationNotif(){
  const z=document.getElementById('wd-notif-invite');
  if(!z) return;
  let etat='rien';
  try{
    etat=etatInvitationNotif(currentUser,_notifSupported(),
      _notifSupported()?Notification.permission:null);
  }catch(e){ etat='rien'; }
  if(etat==='rien'){ z.innerHTML=''; return; }
  let phrase='';
  try{ phrase=texteProchainCreneau(prochainCreneau(currentUser,Date.now())); }catch(e){}
  z.innerHTML=_htmlInvitationNotif(etat,phrase,notifGroupesDefaut(currentUser));
  try{ currentUser._notifDemandeeLe=Date.now(); saveUser(); }catch(e){ rcErreurMuette('_rendreInvitationNotif',e); }
}
// ⚠ LA PERMISSION N'EST DEMANDEE QUE SUR ACCEPTATION. C'est tout l'interet de
// cette carte : le navigateur n'ouvre sa boite qu'a quelqu'un qui vient de dire
// oui, donc il ne la refuse presque jamais — et un refus navigateur est
// definitif, il n'y a pas de seconde chance a gaspiller.
//
// ⚠ LE CHOIX EST ECRIT AVANT TOUT AWAIT : dans u.pushPrefs, que le serveur lit
// avant chaque envoi — l'abonnement ne part qu'ensuite. Et la demande de
// permission reste le PREMIER await : Safari la refuse hors du geste.
async function invNotifOui(){
  const z=document.getElementById('wd-notif-invite');
  const choix=_invNotifChoixLus();
  if(!NOTIF_GROUPES.some(g=>choix[g.cle])) return invNotifNon();
  try{
    currentUser.pushPrefs=pushPrefsDepuisChoix(currentUser.pushPrefs,choix);
    saveUser();
  }catch(e){}
  try{
    if(!_notifSupported()){ toast(_NOTIF_INDISPO,'var(--orange)'); if(z) z.innerHTML=''; return; }
    const p=await Notification.requestPermission();
    if(p==='granted'){
      // TROISIEME POINT D'ACCORD — voir les deux autres, dans les rappels de
      // bilan et de seance. Les trois comptent le meme evenement.
      try{ rcm('notif_granted'); }catch(e){}
      // Le rappel avant chaque séance appartient à la case « Mes séances ».
      if(choix.seances) await scheduleWoNotif();
      // LE PUSH SERVEUR, DANS LE MEME GESTE : c'est le seul moment où iOS
      // l'accepte sans redemander. Sans attente : l'enregistrement part en
      // arrière-plan, le toast ne dépend pas du réseau.
      try{ pushAbonner({geste:true}); }catch(e){}
      toast(choix.seances?'C’est noté : je te préviens avant ta prochaine séance '+ICO.coche:'C’est noté '+ICO.coche);
    } else {
      // AUCUNE INSISTANCE. Le refus est accepte sans un mot de plus : le
      // reprocher, c'est se faire desinstaller.
      toast('Très bien, pas de rappel.');
    }
  }catch(e){}
  if(z) z.innerHTML='';
}
