// ══════════ L'ESSAI ATHLETE, SYMETRIQUE DE LA PROMESSE COACH ══════════════
//
// Le coach a PROMESSE_COACH : gratuit pour son premier client, sans carte.
// L'athlete sans code, lui, arrivait sur 9,95 EUR/mois, PayPal et une case de
// renonciation au droit de retractation — avant d'avoir vu une repetition.
//
// ── POURQUOI DES SEANCES ET NON DES JOURS ────────────────────────────────
//
// NOTE-DECISION-MODELE-ECONOMIQUE.md a ete lue avant d'ecrire cette ligne :
// elle tranche « AUCUNE — statu quo » sur A contre B, et ne dit RIEN d'une
// duree d'essai. Le choix n'y est donc pas fait, et il est fait ici, avec ses
// raisons — pour qu'il se relise et se defasse.
//
//   1. LA MAISON A DEJA TRANCHE CONTRE LES DUREES. Le commentaire de
//      PROMESSE_COACH, quinze lignes plus bas, dit mot pour mot : « Elle promet
//      un CLIENT, jamais une duree […] et "essai de N jours" dirait exactement
//      le contraire. » Un essai athlete en jours contredirait la phrase soeur
//      sur le meme ecran d'accueil.
//
//   2. LA SYMETRIE EST UNE UNITE D'USAGE, PAS UNE HORLOGE. « Ton premier
//      client » se traduit par « tes trois premieres seances », pas par « ta
//      premiere semaine ».
//
//   3. UNE DUREE EXPIRE SANS AVOIR SERVI. Sept jours pour quelqu'un qui
//      s'inscrit un vendredi et ouvre l'app le mardi suivant, c'est un essai
//      consomme a 60 % par du sommeil. Un compteur de seances ne se vide que
//      quand il a servi.
//
//   4. ET SURTOUT : UNE SEANCE SE COMPTE DANS LA DONNEE DEJA ENREGISTREE.
//      `sessions` est ecrit par finishWorkout et par personne d'autre. Le
//      texte promet donc exactement ce que le code applique. Une duree, elle,
//      se compte sur l'horloge de l'appareil — que le plan Spark ne permet pas
//      de contredire (voir l'avertissement ci-dessous). Promettre sept jours
//      quand on ne sait pas quel jour il est serait la promesse contractuelle
//      dont on ne revient pas.
//
// Trois est le nombre : assez pour qu'une progression commence a se voir,
// assez peu pour que l'essai ne remplace pas l'abonnement. Il se change ici,
// en un endroit, et la phrase suit — voir PROMESSE_ATHLETE.
// ⚠ TROIS SEANCES SONT DEVENUES UN MOIS (lot 6), et la trace reste ici.
//
// ESSAI_SEANCES=3 comptait des SEANCES, parce que le jour ne se tenait nulle
// part : l'horloge du telephone se change en trois secondes dans les reglages,
// et « trois seances » etait la seule limite qu'un dossier local savait tenir.
// Le lot 0 a change cela — l'echeance est posee par le serveur dans droits/,
// et c'est elle qui decide des qu'elle existe.
//
// UN MOIS COMPLET, ET COMPLET VEUT DIRE ULTIME. On ne convertit personne en
// lui montrant une version amputee : pendant l'essai, tout ce qu'Ultime ouvre
// est ouvert. Ce qu'un coach fait reste a un coach.
const ESSAI_JOURS=TARIFS.essai.jours;
// ⚠ CE QUE LE CLIENT TIENT, ET CE QU'IL NE TIENT PAS.
//
// Tant que les fonctions ne tournent pas (plan Spark), l'essai est garde par
// le dossier : `essai.ouvertLe` et `essai.finit`. Les deux se reecrivent
// depuis la console d'un navigateur, et on ne fait pas semblant du contraire.
// La barriere reelle est `ouvrirEssai` (le Worker, cloudflare/src/essai.js), qui pose
// l'echeance dans droits/ — noeud en ecriture interdite pour tout le monde.
// essaiFin lit le serveur D'ABORD : le jour ou la fonction tourne, le dossier
// ne decide plus de rien, sans qu'une ligne d'interface change.

// LA phrase, ecrite une fois, sur le modele de PROMESSE_COACH. Elle dit CE QUE
// L'ESSAI FAIT, et rien de plus : un mois, tout ouvert, pas de carte, puis on
// choisit. Elle ne promet ni renouvellement, ni gratuite au-dela.
const PROMESSE_ATHLETE='Ton premier mois est complet, sans carte bancaire. '
  +'Tu choisis ensuite.';
// ECRIT. Ouvre l'essai, UNE SEULE FOIS DANS LA VIE DU COMPTE.
//
// `finit` est pose EN MEME TEMPS QUE `ouvertLe` : une duree qu'on recalcule a
// chaque lecture derive au premier changement de constante, et deux dossiers
// ouverts le meme jour n'auraient pas la meme fin. Le serveur, lui, posera la
// sienne dans droits/, et c'est elle qui l'emportera.
// `bonusJours` : le mois en plus d'un filleul (parrainage). Le serveur, lui,
// ne le reçoit PAS du client : il l'ajoute de lui-même quand la demande de
// rattachement est acceptée (parrainageDemande, bonusEssaiJours).
function essaiOuvrir(u,bonusJours){
  if(!u||u.role==='coach') return false;
  if(u.essai&&typeof u.essai==='object') return false;   // deja ouvert, ou deja fini
  const t=Date.now();
  const b=Math.max(0,Math.min(60,Math.round(Number(bonusJours)||0)));
  u.essai={ouvertLe:t,finit:t+(ESSAI_JOURS+b)*86400000};
  if(b) u.essai.bonusParrainage=b;
  // LE WORKER OUVRE L'ESSAI (30/09/2026) : droits/<cle>, une fois par compte,
  // refuse a qui a deja paye. Il borne `jours` a ESSAI_JOURS (tarifs.json) ;
  // le palier se relit apres, et son echeance prend la main sur u.essai.
  try{
    if(fonctionWorker('ouvrirEssai')&&CLOUD&&CLOUD._callFn)
      CLOUD._callFn('ouvrirEssai',{jours:ESSAI_JOURS})
        .then(()=>rafraichirDroits(u,true)).then(()=>{ try{ _planifierRepeint(u.email); }catch(e){} }).catch(()=>{});
  }catch(e){}
  return true;
}
// PURE. La fin de l'essai, en millisecondes, ou 0 quand il n'y en a pas.
//
// L'ORDRE COMPTE : le serveur, puis la date ecrite a l'ouverture, puis la
// duree recalculee depuis `ouvertLe` — ce dernier repli sert aux dossiers
// ouverts AVANT ce lot, qui portent `seancesAuDebut` et aucune fin.
function essaiFin(u){
  if(!u) return 0;
  // APRES LA BASCULE : l'essai est celui que le Worker a ouvert (ouvrirEssai),
  // et u.essai — que son titulaire ecrit — ne sert plus que si droits/ n'a
  // jamais pu etre lu.
  try{
    const d=droitsDe(u);
    if(d.etat==='serveur'&&d.essaiFinit>0) return d.essaiFinit;
    if(droitsV2Actif()&&d.etat!=='inconnu') return 0;
  }catch(e){}
  if(!u.essai||typeof u.essai!=='object') return 0;
  const f=Number(u.essai.finit)||0;
  if(f>0) return f;
  const o=Number(u.essai.ouvertLe)||0;
  return o?(o+ESSAI_JOURS*86400000):0;
}
// PURE. Les jours qu'il reste, arrondis au jour entamé, ou NULL quand ce
// compte n'a jamais eu d'essai — zero veut dire « fini », null veut dire
// « il n'y en a jamais eu », et le second ne doit rien afficher.
function essaiJoursRestants(u){
  const f=essaiFin(u);
  if(!f) return null;
  return Math.max(0,Math.ceil((f-Date.now())/86400000));
}
// PURE. La duree REELLE de cet essai, en jours : 30 pour tout le monde, 60
// pour un filleul (le mois offert par son ami), 60 aussi pour un parrain a
// l'essai dont le filleul a fait ses quatre seances (le Worker recule sa fin).
function essaiDuree(u){
  const f=essaiFin(u);
  let o=Number(u&&u.essai&&u.essai.ouvertLe)||0;
  try{ const d=droitsDe(u); if(d.etat==='serveur'&&d.essaiOuvertLe>0) o=d.essaiOuvertLe; }catch(e){}
  if(!f||!o||f<=o) return ESSAI_JOURS;
  return Math.max(ESSAI_JOURS,Math.round((f-o)/86400000));
}
// PURE. Le numero du jour en cours dans l'essai : 1 le premier jour.
function essaiJour(u){
  const f=essaiFin(u);
  if(!f) return 0;
  return Math.max(1,essaiDuree(u)-(essaiJoursRestants(u)||0)+1);
}
function essaiActif(u){
  const f=essaiFin(u);
  return f>0&&Date.now()<f;
}
// PURE. L'essai a existe, et il est fini. Ce n'est pas la meme chose que
// « pas d'essai » : c'est a ceux-la, et a eux seuls, qu'on montre le bilan.
function essaiFini(u){
  const f=essaiFin(u);
  return f>0&&Date.now()>=f;
}
// PURE. ⚠ LA QUESTION « FAUT-IL MONTRER LE PAYWALL », ECRITE UNE FOIS.
//
// SIX endroits du fichier detournaient un athlete FREE vers s-client-code :
// le demarrage synchrone, la synchro de fond, les trois sorties de doLogin, et
// la reprise d'un dossier distant. Chacun posait la meme question a la main —
// `role!=='coach' && (status||'FREE')==='FREE'` — et chacun aurait donc
// renvoye un athlete EN ESSAI au paywall, une fois par rechargement, malgre un
// checkAccess qui disait oui.
//
// Une seule fonction, six appels. Le jour ou l'essai change de regle, il n'y a
// qu'un endroit a ouvrir, et aucun des six ne peut etre oublie.
function doitVoirLePaywall(u){
  if(!u||estCoachReconnu(u)) return false;
  // APRES LA BASCULE (30/09/2026) : le dossier ne dit plus rien, checkAccess
  // lit droits/ seul.
  if(droitsV2Actif()) return !checkAccess(u);
  // UN ABONNEMENT QUE LE SERVEUR NE CONFIRME PAS n'évite plus l'écran de
  // paiement : s'écrire AUTONOMIE_PREMIUM dans son dossier ne suffit plus
  // quand droits/ a été lu (voir _palierHerite).
  if(u.status==='AUTONOMIE_PREMIUM'&&droitsDe(u).etat!=='inconnu'&&palierDe(u)==='aucun') return !essaiActif(u);
  if((u.status||'FREE')!=='FREE') return false;
  return !essaiActif(u);
}
// PURE. OU L'ON ATTERRIT QUAND L'ACCES EST FERME (lot 6). Celui qui a vecu le
// mois voit CE QU'IL A FAIT et ce qu'il garde ; celui qui n'a jamais eu
// d'essai voit l'ecran de code, comme avant.
function ecranApresEssai(u){
  return essaiFini(u)?'s-essai-bilan':'s-client-code';
}
function allerApresEssai(u){
  const id=ecranApresEssai(u);
  go(id);
  if(id==='s-essai-bilan'){ try{ rendreEssaiBilan(u); }catch(e){} }
  return id;
}
// PURE. CE QUE LA PERSONNE A CONSTRUIT, EN CHIFFRES REELS. C'est ce qui
// convertit : on ne montre pas une grille de tarifs, on lui montre SON
// programme. Rien n'est efface a l'expiration, et ces chiffres restent vrais.
function essaiBilan(u){
  const x=u||currentUser||{};
  const jours=Array.isArray(x.sessions_config)?x.sessions_config
    :(x.sessions_config&&typeof x.sessions_config==='object')
      ?Object.keys(x.sessions_config).map(k=>x.sessions_config[k]):[];
  let seances=0,exos=0,illustres=0;
  for(const j of jours){
    if(!j||typeof j!=='object') continue;
    const l=(Array.isArray(j.exercises)?j.exercises:[]).filter(e=>e&&String(e.name||'').trim());
    if(j.active!==false&&l.length) seances++;
    exos+=l.length;
    for(const e of l){ try{ if(illustrationExo(e)) illustres++; }catch(err){} }
  }
  let semaines=0;
  try{ const p=programmeDe(x); semaines=(p&&Number(p.semaines))||0; }catch(e){ semaines=0; }
  return {seances:seances,exos:exos,illustres:illustres,semaines:semaines,
    faites:((x&&x.sessions)||[]).length};
}
// PURE. La meme chose en une phrase, sans les zeros : « tes 4 seances, tes 23
// exercices illustres et ta planification sur 8 semaines ».
function essaiBilanPhrase(u){
  const b=essaiBilan(u);
  const m=[];
  // « Tes 1 seance » ne se dit pas : au singulier, le possessif change avec le
  // nombre, et le nombre disparait.
  if(b.seances) m.push(b.seances===1?'ta séance':('tes '+b.seances+' séances'));
  if(b.illustres) m.push(b.illustres===1?'ton exercice illustré'
    :('tes '+b.illustres+' exercices illustrés'));
  else if(b.exos) m.push(b.exos===1?'ton exercice':('tes '+b.exos+' exercices'));
  if(b.semaines) m.push('ta planification sur '+b.semaines+' semaine'+(b.semaines>1?'s':''));
  if(!m.length) return '';
  if(m.length===1) return m[0];
  return m.slice(0,-1).join(', ')+' et '+m[m.length-1];
}
// PURE. LA SEQUENCE DE RELANCE, canal principal : le bandeau dans l'app.
//
// ⚠ C'EST LE SEUL CANAL QUI MARCHE PARTOUT. periodicsync (sw.js) n'existe ni
//   sur iPhone ni hors application installee, et c'est le navigateur qui
//   decide s'il se declenche : une relance qui ne reposerait que sur lui ne
//   toucherait pas la moitie des gens. La notification poussee et l'e-mail
//   s'ajouteront a celui-ci, ils ne le remplaceront pas.
//
// ET ON NE HARCELE PAS. Le premier jour on accueille, puis on se tait jusqu'au
// vingt-et-unieme. Un bandeau tous les jours se regarde comme un meuble.
function texteEssaiRestant(u){
  if(!essaiActif(u)) return '';
  // LE COMPTE SUIT LE NUMERO DU JOUR, et non les jours restants : c'est la
  // sequence ecrite par Kevin (jour 1, jour 21, jour 27), et « il te reste 9
  // jours » au vingt-et-unieme se lit 30 moins 21. Les deux comptes different
  // d'une unite, et c'est le sien qui s'affiche.
  // Sur un essai plus long (60 jours d'un filleul), les memes paliers se
  // comptent depuis la fin : neuf jours avant, puis trois.
  const D=essaiDuree(u), j=essaiJour(u);
  const n=Math.max(0,D-j);
  if(j<=1) return 'Tout est ouvert pendant '+(D>=55?'deux mois':'un mois')+'. Compose ta première séance.';
  if(j<D-9) return '';
  if(j<D-3) return 'Il te reste '+n+' jour'+(n>1?'s':'')+' d’accès complet.';
  const quoi=essaiBilanPhrase(u);
  const prix='tu les gardes avec Ultime à '+prixOffre('ultime')
    +', ou '+prixMoisAnnuel('ultime')+' par mois en annuel.';
  const tete=n>0?('Plus que '+n+' jour'+(n>1?'s':'')+'.'):'Dernier jour d’accès complet.';
  return tete+(quoi?(' '+quoi.charAt(0).toUpperCase()+quoi.slice(1)+', '+prix)
                   :(' Ton accès complet, '+prix));
}
const LIBRE_MAX=200;
function _urlCoachsLibres(){
  return CLOUD._fbUrl.replace('/users.json','/coachs_libres.json');
}
// Rend le nombre, ou NULL quand on ne sait pas. Les deux ne se confondent
// pas : un zéro bloquerait à tort si on le prenait pour un plafond atteint,
// et un null doit LAISSER PASSER — voir placeLibreDisponible.
async function lireCompteurLibres(){
  try{
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),5000);
    const r=await fetch(_urlCoachsLibres(),{signal:ctrl.signal});
    if(!r.ok) return null;
    const t=await r.text();
    try{ _quotaCompter('in',t.length); }catch(e){}
    const d=t?JSON.parse(t):null;
    if(d===null||d===undefined) return 0;   // nœud absent = aucun compte encore
    const n=(typeof d==='object')?d.n:d;
    return (typeof n==='number'&&isFinite(n)&&n>=0)?n:null;
  }catch(e){ return null; }
}
// EN CAS DE DOUTE, ON LAISSE PASSER. Un plafond qui se referme sur une panne
// réseau transforme une limite de capacité en panne d'inscription — et c'est
// l'inverse du service rendu. Le pire cas est 201 comptes Libres.
async function placeLibreDisponible(){
  const n=await lireCompteurLibres();
  if(n===null) return true;
  return n<LIBRE_MAX;
}
// Incrément de un, en meilleur effort. Son échec ne doit JAMAIS empêcher une
// inscription qui a déjà abouti : un compte créé et non compté est un écart
// d'un sur deux cents, un compte refusé parce que le compteur n'a pas répondu
// est une porte fermée au nez de quelqu'un.
async function incrementerCompteurLibres(){
  try{
    const n=await lireCompteurLibres();
    if(n===null) return false;
    const corps=JSON.stringify({n:n+1});
    const tok=await CLOUD._getToken().catch(()=>null);
    const r=await fetch(_urlCoachsLibres()+(tok?'?auth='+tok:''),
      {method:'PUT',headers:{'Content-Type':'application/json'},body:corps});
    try{ _quotaCompter('out',corps.length); }catch(e){}
    return r.ok;
  }catch(e){ return false; }
}
// Ce que voit un coach quand il n'y a plus de place. AUCUN document n'est
// écrit : ni dossier local, ni nœud distant. On dit ce qui se passe et on
// laisse une adresse — pas de formulaire, pas de collecte, pas d'e-mail
// sortant à envoyer.
const LIBRE_ATTENTE_TEXTE='Les '+LIBRE_MAX+' comptes gratuits ouverts sont pris. '
  +'Ce n\'est pas un refus : c\'est la place qu\'il reste sur l\'hébergement, et elle se '
  +'libère. Écris à '+CREATOR_EMAIL+' pour être prévenu dès qu\'une place se '
  +'rouvre : aucun compte n\'a été créé, et rien n\'a été enregistré.';
// Le quota, en toutes lettres. Infinity ne s'affiche pas.
function _quotaTexte(q){ return q===Infinity?'sans limite':String(q); }
// Le palier PAYANT qui vient après le palier courant, s'il en existe un.
// Rend null au sommet : « prix du palier suivant » n'a alors aucun sens.
// ── Deux cycles au-dessus, et seulement alors ───────────────────────────
// Un coach qui oscille autour d'un seuil ne doit jamais être facturé sur un
// pic. On ne PROPOSE le palier supérieur qu'après deux mois consécutifs
// au-dessus — et proposer reste proposer : rien ne bascule.
//
// DEUX CHAMPS SUFFISENT, sans en inventer un troisième :
//   cyclesAuDessus       le nombre de mois consécutifs au-dessus du quota ;
//   dernierAvertissement la date du dernier mois COMPTÉ — c'est elle qui
//                        garantit « un incrément au plus par cycle ».
// Retomber au niveau ou en dessous remet le compteur à zéro : « consécutifs »
// veut dire consécutifs.
const PALIERS_CYCLES_AVANT_PROPOSITION=2;
// Met à jour le compteur de cycles. Rend l'état écrit, ou null si rien n'a
// changé. N'ENREGISTRE PAS : l'appelant le fait.
function majCyclesPaliers(coach,users){
  const u=_dossier(coach);
  if(!u||u.role!=='coach') return null;
  // Un compte qu'on ne sait pas compter ne compte pas : sur un appareil
  // neuf, le cache est vide et tout paraîtrait « en dessous ».
  if(!countActiveAthletesFiable(u,users)) return null;
  const n=countActiveAthletes(u,users);
  const quota=getCoachQuota(coachPlanDe(u));
  const etat=paliersDe(u);
  if(!(n>quota)){
    // Au niveau ou en dessous : le compteur repart de zéro. On ne touche pas
    // à la date — elle ne sert qu'à empêcher un double comptage mensuel.
    if(etat.cyclesAuDessus===0) return null;
    return _ecrirePaliers(u,{cyclesAuDessus:0});
  }
  const cycleCourant=_cyclePalier();
  const dejaCompte=etat.dernierAvertissement
    &&_cyclePalier(new Date(etat.dernierAvertissement))===cycleCourant;
  if(dejaCompte) return null;              // un incrément au plus par mois
  return _ecrirePaliers(u,{cyclesAuDessus:etat.cyclesAuDessus+1,
    dernierAvertissement:new Date().toISOString()});
}

// PURE. Ce qu'il y a à DIRE au coach, ou null. Elle ne décide rien, n'écrit
// rien, et ne bloque rien — trois propriétés qu'une assertion vérifie.
//
// Trois cas, dans cet ordre de priorité :
//   falaise   : il est à un athlète du palier suivant. On le prévient AVANT
//               qu'il le subisse, avec le prix exact.
//   montee    : deux cycles au-dessus. On propose, on n'impose pas.
//   descente  : il paie pour plus qu'il n'utilise — fin de saison, athlètes
//               partis. Personne ne le lui dirait sinon.
function alertePalier(coach,users){
  const u=_dossier(coach);
  if(!u||u.role!=='coach') return null;
  if(!countActiveAthletesFiable(u,users)) return null;
  const cle=coachPlanDe(u);
  const n=countActiveAthletes(u,users);
  const quota=getCoachQuota(cle);
  const suivant=_palierSuivant(cle);
  // ── Falaise : N === M-1, et il existe un palier au-dessus ─────────────
  if(suivant&&quota!==Infinity&&n===quota-1){
    return {type:'falaise',palier:suivant.cle,
      titre:'Au prochain athlète, ta formule passe à '+suivant.titre
        +', '+suivant.prix+' €/mois.',
      texte:'Tu peux ajouter cet athlète sans changer de formule maintenant. '
        +'Rien n\'est prélevé tant que tu ne l\'as pas décidé toi-même.'};
  }
  // ── Montée : au-dessus depuis deux cycles ─────────────────────────────
  // L'OPTION B (02/10/2026) : le quota s'applique. Après trois mois d'affilée
  // au-dessus, les athlètes hors quota perdent le suivi gratuit (voir
  // athleteCouvertParCoach). L'alerte le dit avec la DATE et le NOMBRE, au
  // lieu de promettre que rien ne change.
  if(suivant&&n>quota){
    const e=quotaEtatDe(u);
    const c=Math.max(e.cycles,paliersDe(u).cyclesAuDessus);
    if(c<PALIERS_CYCLES_AVANT_PROPOSITION) return null;   // un pic ne compte pas
    const k=n-quota, s=k>1?'s':'';
    const coupure=quotaDateCoupure(e.cycles,e.mois);
    const jour=d=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    const offre='La formule '+suivant.titre+' est à '+suivant.prix+'\u00a0€/mois : elle les couvre tous.';
    let texte;
    if(coupure&&coupure.getTime()<=Date.now()){
      texte='Depuis le '+jour(coupure)+', '+k+' athlète'+s+' n’'+(k>1?'ont':'a')+' plus '+(k>1?'leur':'son')
        +' accès suivi : '+(k>1?'ils voient':'il voit')+' une proposition d’abonnement. '+offre+' L’accès revient aussitôt.';
    } else if(coupure){
      texte='Au-delà du '+jour(new Date(coupure.getTime()-86400000))+', '+k+' athlète'+s+' perdr'+(k>1?'ont leur':'a son')
        +' accès suivi. '+offre;
    } else {
      texte='Après trois mois d’affilée au-dessus de ta formule, '+k+' athlète'+s+' perdr'+(k>1?'ont leur':'a son')+' accès suivi. '+offre;
    }
    return {type:'montee',palier:suivant.cle,horsQuota:k,coupure:coupure?coupure.getTime():0,
      // « ACTIFS » ET NON « Tu suis » (build 1811) : « Tu suis » est le compte de
      // la liste (nbAthletesSuivis) ; le quota, lui, compte les actifs.
      titre:n+' athlètes actifs depuis '+c+' mois, pour une formule qui en '
        +'prévoit '+_quotaTexte(quota)+'.',
      texte};
  }
  // ── Descente : il paie pour plus qu'il n'utilise ──────────────────────
  const inf=COACH_PALIERS.filter(x=>x.quota>=n&&x.prix<(COACH_PALIERS.find(y=>y.cle===cle)||{}).prix);
  if(inf.length){
    const cible=inf[0];
    return {type:'descente',palier:cible.cle,
      titre:n+' athlète'+(n>1?'s actifs':' actif')+' : la formule '+cible.titre
        +' te suffirait.',
      texte:(cible.prix?('Il est à '+cible.prix+' €/mois. '):'Il est gratuit. ')
        +'Le changement prend effet à la fin de la période déjà réglée, '
        +'quand tu veux : aucune fenêtre, aucun préavis.'};
  }
  return null;
}
// Le rendu. Aucun bouton de fermeture : ce n'est pas une interruption, c'est
// une ligne d'information qui disparaît d'elle-même quand la situation change.
function _htmlAlertePalier(coach,users){
  const a=alertePalier(coach,users);
  if(!a) return '';
  const chaud=(a.type!=='descente');
  const bord=chaud?'var(--orange)':'var(--green)';
  return '<div style="background:var(--surface-1);border:1px solid '+bord+';'
    +'border-left:3px solid '+bord+';border-radius:0 var(--r-3) var(--r-3) 0;padding:12px 14px;'
    +'margin-bottom:14px">'
    +'<div style="font-weight:800;font-size:var(--fs-sm);color:'+bord+';line-height:1.5">'
    +escapeHtml(a.titre)+'</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);margin-top:6px;line-height:1.6">'
    +escapeHtml(a.texte)+'</div>'
    +'<button class="btn btn-outline btn-sm" style="margin-top:10px;width:100%;min-height:44px" '
    +'onclick="ouvrirMonAbonnement()">Changer de formule</button>'
    +'</div>';
}

// Le bandeau permanent du tableau de bord. « N / M athlètes actifs » et le
// palier, en clair.
//
// `users` EST OBLIGATOIRE ET DÉJÀ LU. Mesuré : DB.get('users') coûte 130 ms
// à 40 athlètes — c'est le JSON.parse du cache, pas le comptage, qui pèse
// (0,11 ms). Rendre ce bandeau sans lui passer le cache déjà en main
// bloquerait le fil principal huit images à chaque ouverture.
function _htmlBandeauPaliers(coach,users){
  const u=coach||currentUser;
  if(!u||u.role!=='coach') return '';
  const cle=coachPlanDe(u);
  const pal=COACH_PALIERS.find(x=>x.cle===cle)||COACH_PALIERS[0];
  const quota=getCoachQuota(cle);
  const fiable=countActiveAthletesFiable(u,users);
  const n=countActiveAthletes(u,users);
  // Le compteur se tait plutôt que d'annoncer un chiffre faux : sur un
  // appareil neuf, le cache est vide et « 0 / 15 » mentirait.
  const compte=fiable?(n+' / '+_quotaTexte(quota)+' athlètes actifs')
    :'athlètes actifs : en cours de synchronisation';
  const depasse=fiable&&n>quota;
  return '<div style="display:flex;align-items:center;gap:10px;background:var(--surface-1);'
    +'border:1px solid '+(depasse?'var(--orange)':'var(--border)')+';border-radius:var(--r-3);'
    +'padding:10px 14px;margin-bottom:14px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-weight:800;font-size:var(--fs-sm)">'+escapeHtml(compte)+'</div>'
    +'<div class="sub" style="font-size:var(--fs-2xs);margin-top:2px">Formule '+escapeHtml(pal.titre)
    +(pal.prix?(' : '+pal.prix+' € par mois'):' : gratuit')+'</div></div>'
    +'<button class="btn btn-outline btn-sm" style="flex-shrink:0;min-height:38px" '
    +'onclick="ouvrirMonAbonnement()">Changer</button>'
    +'</div>';
}
// Un seul chemin vers l'écran d'abonnement : l'onglet qui le porte. Le
// dupliquer ferait diverger les deux.
function ouvrirMonAbonnement(){
  go('s-coach-home');
  coachTab('monetisation');
  const z=document.getElementById('coach-abo');
  if(z) z.scrollIntoView({block:'start'});
  return true;
}

function _palierSuivant(cle){
  const i=COACH_PALIERS.findIndex(x=>x.cle===cle);
  return (i>=0&&i+1<COACH_PALIERS.length)?COACH_PALIERS[i+1]:null;
}
// « Mon abonnement », côté coach.
//
// LES TROIS CARTES SONT TOUJOURS MONTRÉES, mais le bouton de paiement
// n'apparaît QUE sur un palier dont le plan PayPal existe. Le cahier des
// charges demandait les deux : « trois cartes » et « une carte dont le
// planId est vide ne s'affiche pas ». Appliquée à la lettre, la seconde
// règle donne aujourd'hui un écran d'abonnement à ZÉRO carte, puisque
// aucun des deux plans n'est encore créé sur PayPal. On garde donc
// l'échelle visible — le coach doit savoir où il se situe — et on ne
// propose de payer que ce qui est réellement payable. Aucun état
// « bientôt disponible » : les boutons apparaîtront d'eux-mêmes le jour
// où les deux constantes seront remplies.
// PURE. CE QUI ATTEND D'ETRE SUPPRIME CHEZ L'HEBERGEUR, tous dossiers
// confondus. Le coach a ceux de ses athletes sous la main : c'est assez pour
// savoir s'il y a un geste a faire, et l'export de la base, lui, voit tout le
// monde — y compris les abonnes sans coach.
function cldAPurgerTotal(users){
  const m=users||DB.get('users')||{};
  let fichiers=0,dossiers=0,plusVieux=0;
  for(const k of Object.keys(m)){
    const l=(m[k]&&m[k].cloudinaryAPurger);
    if(!Array.isArray(l)||!l.length) continue;
    dossiers++; fichiers+=l.length;
    for(const e of l){
      const t=Number(e&&e.le)||0;
      if(t&&(!plusVieux||t<plusVieux)) plusVieux=t;
    }
  }
  return {fichiers:fichiers,dossiers:dossiers,plusVieux:plusVieux};
}
// LE SEUIL. En dessous, on se tait : un rappel qui s'affiche pour trois
// fichiers finit par ne plus se lire du tout.
const CLD_RAPPEL_MINI=20;
function _htmlRappelPurge(users){
  const t=(()=>{ try{ return cldAPurgerTotal(users); }catch(e){ return {fichiers:0}; } })();
  if(t.fichiers<CLD_RAPPEL_MINI) return '';
  const jours=t.plusVieux?Math.floor((Date.now()-t.plusVieux)/864e5):0;
  return '<div style="margin-top:10px;background:var(--surface-2);border:1px solid var(--border);'
    +'border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">'
    +'<strong style="color:var(--text)">'+t.fichiers+' fichiers</strong> attendent d’être supprimés '
    +'chez l’hébergeur'+(jours>2?(', le plus ancien depuis '+jours+' jours'):'')+'.<br>'
    +'Exporte la base (console Firebase, Realtime Database, Exporter le JSON) et lance&nbsp;:<br>'
    +'<code style="font-size:var(--fs-2xs);color:var(--text)">python scripts/purge_cloudinary_orphelins.py '
    +'export.json --supprimer</code></div>';
}
function _renderAbonnementCoach(users){
  const z=document.getElementById('coach-abo');
  if(!z) return false;
  const u=currentUser;
  if(!u||u.role!=='coach'){ z.innerHTML=''; return false; }
  const cle=coachPlanDe(u), pal=COACH_PALIERS.find(x=>x.cle===cle)||COACH_PALIERS[0];
  const quota=getCoachQuota(cle);
  const fiable=countActiveAthletesFiable(u,users);
  const n=countActiveAthletes(u,users);
  const depasse=fiable&&n>quota;
  const suivant=_palierSuivant(cle);
  const l=(t,v)=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">`
    +`<span style="color:var(--sub)">${escapeHtml(t)}</span><span style="color:var(--text)">${escapeHtml(v)}</span></div>`;
  // Le compteur ne ment pas quand il ne sait pas. `users` ne contient que ce
  // que la synchronisation a rapatrié : sur un appareil neuf, annoncer
  // « 0 / 15 » à un coach qui suit douze personnes serait pire que se taire.
  const compteur=fiable?(n+' / '+_quotaTexte(quota)+' athlètes actifs')
    :'en cours de synchronisation';
  const cartes=COACH_PALIERS.map(x=>{
    const ici=x.cle===cle, id=x.planId();
    return `<div style="flex:1;min-width:140px;border:2px solid ${ici?'var(--red)':'var(--border)'};
      background:${ici?'rgba(224,32,32,.08)':'transparent'};border-radius:var(--r-3);padding:14px 12px;text-align:center">
      <div style="font-size:var(--fs-xs);color:${ici?'var(--red)':'var(--sub)'};font-weight:800;
        text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${escapeHtml(x.titre)}</div>
      <div style="font-size:var(--fs-xl);font-weight:900;color:var(--text);line-height:1">${x.prix===0?'Gratuit':escapeHtml(x.prix+' €')}</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">${escapeHtml(x.periode||'')}</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:6px;line-height:1.5">${escapeHtml(x.detail)}</div>
      ${(id&&!ici)?`<button class="btn btn-red btn-sm" style="margin-top:10px;width:100%"
        onclick="souscrireCoach('${x.cle}')">Choisir ${escapeHtml(x.titre)}</button>`:''}
    </div>`;
  }).join('');
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:20px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:3px;font-weight:800;text-transform:uppercase;margin-bottom:14px">Mon abonnement</div>
    ${l('Formule',pal.titre)}
    ${l('Athlètes suivis',texteTuSuis(nbAthletesSuivis()).replace(/^Tu suis |\.$/g,''))}
    ${l('Athlètes',compteur)}
    ${suivant?l('Formule suivante',suivant.titre+', '+suivant.prix+' € '+suivant.periode):''}
    ${depasse?`<div style="margin-top:10px;background:var(--warning-bg);border:1px solid var(--warning-border);
      border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:var(--orange);line-height:1.6">
      ${n} athlètes actifs pour une formule qui en prévoit ${_quotaTexte(quota)}.
      Après trois mois d'affilée au-dessus, les athlètes hors de ta formule perdent leur accès suivi gratuit.</div>`:''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">${cartes}</div>
    <button class="btn btn-outline btn-sm" style="margin-top:14px;width:100%"
      onclick="exporterMesDonnees()">Exporter toutes mes données</button>
    ${_htmlRappelPurge(users)}
  </div>`;
  return true;
}
// Souscription d'un palier coach. Elle passe par le MÊME écran PayPal que
// l'abonnement autonome : un second chemin de paiement divergerait un jour
// de celui-ci. Sans plan créé, la fonction refuse plutôt que d'ouvrir une
// page qui échouera au moment de payer.
function souscrireCoach(cle){
  const p=COACH_PALIERS.find(x=>x.cle===cle);
  if(!p||!p.planId()){ toast('Cette formule n\'est pas encore ouverte au paiement.','var(--orange)'); return false; }
  try{ sessionStorage.setItem('rc_palier_coach',cle); }catch(e){}
  go('s-subscribe');
  // L ÉCRAN DOIT ÊTRE RENDU. Sans cet appel, il gardait les paliers ATHLÈTE
  // — et _planIdChoisi aurait facturé PAYPAL_PLAN_ID, le mensuel de
  // l'athlète, à un coach qui croyait souscrire son palier.
  loadSubscribePage();
  return true;
}
// ══════ RÉSILIATION EN LIGNE ET RENONCEMENT À LA RÉTRACTATION ══════
// L215-1-1 du code de la consommation, applicable depuis le 01/06/2023 :
// résilier doit être aussi simple que souscrire. Ici, trois clics depuis
// l'accueil — Réglages, Résilier, Confirmer. AUCUN écran de rétention,
// aucune remise de dernière minute, aucun « êtes-vous vraiment sûr » répété :
// la friction volontaire est exactement ce que la loi interdit.
//
// L'ARRÊT CHEZ PAYPAL EST FAIT PAR LE SERVEUR (02/10/2026). La demande est
// envoyée au serveur léger (POST /resiliation), qui l'enregistre et annule
// l'abonnement chez PayPal trois jours avant la date d'effet : le terme de
// l'engagement (CGV §5), ou, après les douze mois, la fin de la période en
// cours. Pendant l'engagement, rien n'est annulé chez PayPal : les échéances
// restantes sont dues. La personne n'a aucune démarche à faire chez PayPal.
//
// L'ABSENCE DES DEUX CHAMPS EST UN ÉTAT VALIDE. Aucune migration : les
// accesseurs rendent un objet vide, partout.
const RESIL_MOTIFS=Object.freeze(['Trop cher','Je n\'utilise plus l\'app',
  'Je change de coach','Objectif atteint','Autre']);
const RESIL_FILE='rc_resil_file';
// PURE. L'état d'abonnement, toujours un objet.
function abonnementDe(user){
  const a=(user||{}).abonnement;
  return (a&&typeof a==='object')?a:{};
}
// PURE. Une résiliation déjà demandée n'est pas redemandable.
function resiliationDemandee(user){
  const r=abonnementDe(user).resiliationDemandee;
  return (r&&typeof r==='object'&&typeof r.ts==='number')?r:null;
}
// PURE. Le renoncement au droit de rétractation. JAMAIS coché par défaut :
// l'absence du champ vaut refus, et rien dans le code ne le pose à true de
// lui-même — un test l'interdit.
function renonciationRetractation(user){
  const x=abonnementDe(user).renonciationRetractation;
  if(!x||typeof x!=='object') return {accepte:false,ts:null};
  return {accepte:x.accepte===true,ts:(typeof x.ts==='number')?x.ts:null};
}
// PURE. Qui a un abonnement à résilier ? Pas celui qui accède gratuitement
// par code coach : il n'a rien souscrit, et lui parler de résiliation serait
// lui parler d'un contrat qui n'existe pas.
function aUnAbonnement(user){
  const u=user||{};
  if(u.role==='coach') return false;
  if(u.status==='AUTONOMIE_PREMIUM') return true;
  // Un abonnement déjà résilié reste affichable : l'accès court jusqu'au terme.
  return !!resiliationDemandee(u)||!!u.paypalSubscriptionId;
}
// ══ UN SEUL ABONNEMENT À LA FOIS (02/10/2026) ═════════════════════════════
// Un abonné Essentielle qui choisissait Ultime souscrivait un SECOND
// abonnement : l'ancien continuait d'être prélevé. Désormais, tant qu'un
// abonnement PayPal court, l'app ne monte AUCUN bouton de souscription :
// elle propose « Changer de formule », qui RÉVISE l'abonnement en cours chez
// PayPal (Worker, POST /abonnement/changer). Un coach (Coach → Pro) suit la
// même règle.
//
// Ce que le serveur a écrit (statutPaypal) fait foi : résilié, échu ou
// remboursé, l'abonnement ne court plus, et une nouvelle souscription est
// permise (l'ancien est alors signalé au serveur, voir onApprove).
const STATUTS_PAYPAL_FINIS=Object.freeze(['CANCELLED','EXPIRED','REMBOURSE']);
// PURE. L'abonnement PayPal qu'une nouvelle souscription DOUBLERAIT :
// {id, coach}, ou null. Sans identifiant PayPal (accès offert, parrainage,
// accès posé à la main), il n'y a rien à doubler.
function abonnementEnCours(user){
  const u=user||{};
  const id=String(u.paypalSubscriptionId||'');
  if(!/^I-[A-Z0-9]{6,30}$/.test(id)) return null;
  const st=String(abonnementDe(u).statutPaypal||'').toUpperCase();
  if(STATUTS_PAYPAL_FINIS.indexOf(st)>=0) return null;
  if(u.role==='coach') return {id:id,coach:true};
  if(!aUnAbonnement(u)) return null;
  return {id:id,coach:false};
}
const _NOM_FORMULE=Object.freeze({essentielle:'Essentielle',ultime:'Ultime',coach:'Coach',pro:'Pro'});
const _RANG_FORMULE=Object.freeze({essentielle:1,ultime:2,coach:1,pro:2});
// PURE. La formule que l'abonnement en cours facture : celle que le serveur a
// écrite (abonnement.formule, coachPlan), jamais ce qu'on a choisi à l'écran.
function formuleEnCours(user){
  const u=user||{};
  if(u.role==='coach'){ const cp=String(u.coachPlan||''); return ['coach','pro'].indexOf(cp)>=0?cp:''; }
  const f=abonnementDe(u).formule;
  return (f==='essentielle'||f==='ultime')?f:'';
}
// PURE. Le plan PayPal de l'abonnement en cours, d'après sa formule et sa période.
function planIdEnCours(user){
  const f=formuleEnCours(user);
  if(f==='coach') return PAYPAL_PLAN_ID_COACH;
  if(f==='pro') return PAYPAL_PLAN_ID_PRO;
  if(!f) return '';
  return planIdOffre(f,abonnementDe(user).palier==='annuel');
}
// PURE. Ce que l'écran d'abonnement montre à quelqu'un qui en a déjà un :
// jamais un bouton de souscription, toujours « Changer de formule ».
function htmlChangerFormule(user,planId){
  const act=formuleEnCours(user), cib=formuleDuPlan(planId);
  const nom=(f)=>_NOM_FORMULE[f]||'ta formule actuelle';
  if(!planId||!cib) return '<div class="bq-note">Cette formule n’est pas encore ouverte au changement.</div>';
  if(planId===planIdEnCours(user)) return '<div class="bq-note" id="sub-deja">C’est déjà ta formule : '+escapeHtml(nom(act))+'.</div>';
  const baisse=!!act&&(_RANG_FORMULE[cib]||0)<(_RANG_FORMULE[act]||0);
  return '<div class="bq-note" id="sub-changer-note">Tu as déjà un abonnement '+escapeHtml(nom(act))
    +'. Il est modifié chez PayPal, jamais doublé : '
    +(baisse?'le passage à '+escapeHtml(nom(cib))+' prend effet à ta prochaine échéance, et tu gardes '+escapeHtml(nom(act))+' jusque-là.'
      :escapeHtml(nom(cib))+' s’ouvre dès que tu valides chez PayPal.')+'</div>'
    +'<button class="btn btn-red" id="sub-changer" onclick="changerFormule(this)">Changer de formule</button>';
}
// PURE. Après la réponse du serveur : la date d'effet (baisse) et le lien de
// validation chez PayPal. Un lien qui ne mène pas chez PayPal n'est pas montré.
function htmlChangementPret(r,user){
  const href=String((r&&r.approve)||'');
  if(!/^https:\/\/(www\.)?(sandbox\.)?paypal\.com\//.test(href)) return '<div class="bq-note">PayPal n’a pas rendu de lien de validation. Réessaie dans un instant.</div>';
  const nom=(f)=>_NOM_FORMULE[f]||'ta nouvelle formule';
  const act=formuleEnCours(user);
  const txt=(r.baisse&&Number(r.effet)>0)
    ?'Ton passage à '+nom(r.formule)+' prendra effet le '+new Date(Number(r.effet)).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})
      +'. Jusque-là, tu gardes '+nom(act)+'. Ton engagement ne repart pas à zéro.'
    :nom(r.formule)+' s’ouvre dès que tu valides chez PayPal. Ton engagement ne repart pas à zéro.';
  return '<div class="bq-note" id="sub-effet">'+escapeHtml(txt)+'</div>'
    +'<a class="btn btn-red" id="sub-valider-pp" href="'+escapeHtml(href)+'" rel="noopener">Valider chez PayPal</a>';
}
async function changerFormule(btn){
  const z=document.getElementById('paypal-btn-container');
  const planId=_planIdChoisi();
  if(!currentUser||!planId) return false;
  if(!SERVEUR_LEGER||!CLOUD||!CLOUD._callFn){ toast('Le changement de formule demande une connexion au serveur.','var(--orange)'); return false; }
  if(btn) btn.disabled=true;
  let r=null;
  try{ r=await CLOUD._callFn('/abonnement/changer',{plan_id:planId}); }
  catch(e){
    if(btn) btn.disabled=false;
    toast((e&&e.message)||'Changement impossible pour le moment.','var(--orange)');
    return false;
  }
  // L'ABONNEMENT ÉTAIT DÉJÀ ANNULÉ CHEZ PAYPAL (le serveur vient de l'écrire
  // au dossier) : plus rien ne court, la souscription redevient possible.
  if(r&&r.fini){
    currentUser.abonnement=Object.assign({},currentUser.abonnement,{statutPaypal:String(r.statut||'CANCELLED')});
    toast('Ton ancien abonnement est terminé chez PayPal : tu peux souscrire ta nouvelle formule.','var(--info)');
    loadSubscribePage();
    return true;
  }
  if(z) z.innerHTML=htmlChangementPret(r,currentUser);
  return true;
}
// La date de fin d'accès. L'accès reste OUVERT jusqu'au terme de la période
// réglée : on ne coupe rien à la confirmation.
function finAccesAbonnement(user){
  const u=user||{};
  if(typeof u.accessExpiry==='number'&&u.accessExpiry>0) return u.accessExpiry;
  const a=abonnementDe(u);
  // ⚠ LE TERME DE L'ENGAGEMENT D'ABORD (24/09/2026). C'est la date jusqu'a
  //   laquelle l'acces court quand quelqu'un resilie, et la seule que le
  //   dossier connaisse avec certitude : elle est posee a l'achat et ne bouge
  //   plus. Sans elle, l'ecran de resiliation disait « la fin de la periode
  //   reglee » — vrai, et inutilisable.
  if(typeof a.engagementJusqu==='number'&&a.engagementJusqu>0) return a.engagementJusqu;
  if(typeof a.prochaineEcheance==='number') return a.prochaineEcheance;
  return null;
}
// LA FILE HORS LIGNE. La demande est enregistrée localement d'abord — c'est
// elle qui fait foi pour l'utilisateur — et rejouée à la reconnexion. Elle
// ne se rejoue QU'UNE FOIS : la clé est vidée dès que l'envoi aboutit.
function _fileResilLire(){
  try{ const x=JSON.parse(localStorage.getItem(RESIL_FILE)||'null');
    return (x&&typeof x==='object')?x:null; }catch(e){ return null; }
}
function _fileResilPoser(email,ts){
  try{ localStorage.setItem(RESIL_FILE,JSON.stringify({email:email,ts:ts})); }catch(e){}
}
function _fileResilVider(){ try{ localStorage.removeItem(RESIL_FILE); }catch(e){} }
async function _rejouerResiliation(){
  const f=_fileResilLire();
  if(!f||!f.email) return false;
  if(!currentUser||currentUser.email!==f.email) return false;
  if(!CLOUD.ok||!CLOUD.ok()) return false;
  try{
    await CLOUD.pushOne(currentUser.email,currentUser);
    // PUIS LE SERVEUR, qui arrêtera l'abonnement chez PayPal à la date
    // d'effet. Une réponse définitive (4xx : pas d'abonnement PayPal sur ce
    // compte) vide aussi la file ; une panne la garde pour le prochain essai.
    if(SERVEUR_LEGER&&CLOUD._callFn){
      const r=resiliationDemandee(currentUser);
      try{
        const rep=await CLOUD._callFn('/resiliation',{motif:(r&&r.motif)||'',ts:(r&&r.ts)||f.ts});
        _resilEffetNoter(currentUser.email,rep);
      }catch(e){ if(!(e&&e.statut>=400&&e.statut<500)) return false; }
    }
    _fileResilVider();   // exactement une fois
    return true;
  }catch(e){ return false; }
}
// LA DATE D'EFFET RENDUE PAR LE SERVEUR, gardée sur l'appareil pour l'écran
// « Mon abonnement » (le dossier ne la porte pas : resiliations/ est au serveur).
const RESIL_EFFET='rc_resil_effet';
function _resilEffetNoter(email,rep){
  if(!rep||!(Number(rep.effet)>0)) return;
  try{ localStorage.setItem(RESIL_EFFET,JSON.stringify({email:String(email||''),effet:Number(rep.effet)})); }catch(e){}
}
function _resilEffetLu(email){
  try{ const x=JSON.parse(localStorage.getItem(RESIL_EFFET)||'null');
    return (x&&x.email===email&&Number(x.effet)>0)?Number(x.effet):0; }catch(e){ return 0; }
}
// PURE. LA DATE D'EFFET D'UNE RÉSILIATION, la même règle que le serveur
// (paypal.js, effetResiliation) : pendant l'engagement, son terme ; après,
// la fin de la période en cours. {date, engagement} ; date 0 : inconnue
// (« à la fin du mois en cours »).
function dateEffetResiliation(user,t){
  const n=Number(t)||Date.now();
  const a=abonnementDe(user);
  const eng=Number(a.engagementJusqu)||0;
  if(eng>n) return {date:eng,engagement:true};
  const p=Number(a.prochaineEcheance)||Number((user||{}).accessExpiry)||0;
  return {date:p>n?p:0,engagement:false};
}
// PURE. La phrase de la date d'effet, montrée AVANT la confirmation et après.
function texteEffetResiliation(user,t,effetServeur){
  const e=dateEffetResiliation(user,t);
  const d=Number(effetServeur)>0?Number(effetServeur):e.date;
  const jour=d?new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
  if(e.engagement) return 'Ta résiliation prendra effet le '+jour+', au terme de ton engagement. '
    +'Ton accès reste ouvert jusque-là et les échéances restantes sont dues ; RepCore arrête lui-même les prélèvements chez PayPal à cette date.';
  return 'Ta résiliation prendra effet '+(jour?'le '+jour:'à la fin du mois en cours')+', à la fin de la période déjà payée. '
    +'RepCore arrête lui-même les prélèvements chez PayPal : aucun autre prélèvement.';
}
// Le motif est FACULTATIF, toujours. Il n'est jamais bloquant, et une chaîne
// vide est un motif parfaitement acceptable.
function demanderResiliation(motif){
  const u=currentUser;
  if(!u) return false;
  if(resiliationDemandee(u)) return false;   // pas redemandable
  if(!u.abonnement||typeof u.abonnement!=='object') u.abonnement={};
  const ts=Date.now();
  u.abonnement.resiliationDemandee={ts:ts,motif:String(motif||'').slice(0,300)};
  // Le LOCAL d'abord : hors ligne, l'utilisateur doit voir son accusé.
  try{ saveUser(); }catch(e){ rcErreurMuette('demanderResiliation',e); }
  _fileResilPoser(u.email,ts);
  // Puis l'envoi. S'il aboutit, la file se vide ; sinon elle sera rejouée.
  _rejouerResiliation();
  return true;
}
// La case de renoncement. JAMAIS appelée avec true par le code : seul un
// geste de l'utilisateur passe par ici.
function _majRenonciation(accepte){
  const u=currentUser;
  if(!u) return false;
  if(!u.abonnement||typeof u.abonnement!=='object') u.abonnement={};
  u.abonnement.renonciationRetractation=
    accepte===true?{accepte:true,ts:Date.now()}:{accepte:false,ts:null};
  try{ saveUser(); }catch(e){ rcErreurMuette('_majRenonciation',e); }
  _majBoutonPaypal();
  return true;
}
// LE BLOC DE RENONCEMENT N'A DE SENS QU'AVEC UN COMPTE : la case s'enregistre
// dans le dossier de l'utilisateur, et _majRenonciation refuse de tourner sans
// lui. Sans compte on le masque, et l'écran ne propose que la création.
//
// LA VISIBILITÉ EST POSÉE DANS LES DEUX SENS, jamais supposée : quelqu'un qui
// crée son compte revient sur cet écran, et un bouton PayPal actif SANS la
// case serait un manquement à l'article L221-28 13°.
function _subAfficherRenonciation(visible){
  const c=document.getElementById('sub-renonciation');
  // On masque le LABEL, pas la case seule : le label porte aussi le texte du
  // renoncement, et le masquer à moitié laisserait une boîte vide de 10 px.
  const l=c?c.closest('label'):null;
  if(l) l.style.display=visible?'':'none';
  const t=document.getElementById('sub-renonc-txt');
  if(t) t.style.display=visible?'':'none';
  const m=document.getElementById('sub-renonc-msg');
  if(m&&!visible) m.style.display='none';   // remontré par _majBoutonPaypal
}
function _majBoutonPaypal(){
  const z=document.getElementById('paypal-btn-container');
  const ok=renonciationRetractation(currentUser).accepte;
  if(z){
    z.style.opacity=ok?'1':'.35';
    z.style.pointerEvents=ok?'auto':'none';
  }
  const m=document.getElementById('sub-renonc-msg');
  if(m) m.style.display=ok?'none':'block';
}
const RENONC_TEXTE='Je demande expressément que l\'accès soit ouvert '
  +'immédiatement et je reconnais perdre mon droit de rétractation de 14 jours '
  +'une fois le service pleinement fourni (art. L221-28 13°).';
// ══ L'APPARENCE ET L'AIDE ═══════════════════════════════════════════════════
//
// UN BLOC, DEUX PLACES : les réglages de l'athlète (#cr-prefs) et l'onglet
// PROFIL du coach (#ct-prefs). Il porte le choix de l'apparence, les questions
// fréquentes (dépliables), le contact du créateur de l'application — pas du
// coach : pour un bug, une question de compte, un paiement — et la date de la
// dernière mise à jour (window.RC_MAJ, posée par scripts/versionner_actifs.py).
//
// L'APPARENCE : sombre par défaut. « Clair » est une surcouche générée depuis
// la feuille sombre (scripts/theme_clair.py) ; « auto » suit le téléphone. Le
// choix est gardé sur l'appareil (rc_theme) et appliqué AVANT le premier
// affichage par le premier script de index.html.
const THEMES=Object.freeze([
  {cle:'sombre',nom:'Sombre'},
  {cle:'clair',nom:'Clair'},
  {cle:'auto',nom:'Auto'}
]);
const THEME_CLE='rc_theme';
function themeChoisi(){
  try{ const v=localStorage.getItem(THEME_CLE); return THEMES.some(t=>t.cle===v)?v:'sombre'; }catch(e){ return 'sombre'; }
}
// PURE. Ce qui s'affiche pour un choix, selon le réglage du téléphone.
function themeEffectif(choix,systemeClair){
  if(choix==='clair') return 'clair';
  if(choix==='auto'&&systemeClair) return 'clair';
  return 'sombre';
}
function themeAppliquer(choix){
  let sys=false;
  try{ sys=!!(window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches); }catch(e){}
  const e=themeEffectif(choix||themeChoisi(),sys);
  const r=document.documentElement;
  if(e==='clair') r.setAttribute('data-theme','clair'); else r.removeAttribute('data-theme');
  // LA FEUILLE DU THEME CLAIR (rc-theme.<build>.css) : appliquee en clair
  // seulement, sinon media="not all" — voir index.html, rcThemeFeuille.
  try{ const l=document.getElementById('rc-theme-clair'); if(l) l.media=e==='clair'?'all':'not all'; }catch(err){}
  const m=document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content',e==='clair'?'#f4f4f4':'#0A0A0A');
  return e;
}
function themeChoisir(choix){
  const t=THEMES.find(x=>x.cle===choix);
  if(!t) return false;
  try{ localStorage.setItem(THEME_CLE,choix); }catch(e){}
  themeAppliquer(choix);
  document.querySelectorAll('.prf-theme button').forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute('data-theme')===choix)));
  toast('Apparence : '+t.nom.toLowerCase()+(choix==='auto'?', comme ton téléphone':''));
  return true;
}
try{
  themeAppliquer();
  const mq=window.matchMedia&&matchMedia('(prefers-color-scheme: light)');
  if(mq&&mq.addEventListener) mq.addEventListener('change',()=>{ if(themeChoisi()==='auto') themeAppliquer('auto'); });
}catch(e){}

// LES QUESTIONS FRÉQUENTES. Des réponses VRAIES et vérifiables dans l'app :
// chaque « où » désigne un écran qui existe. `pour` : 'client', 'coach', ou
// les deux.
const FAQ_APP=Object.freeze([
  {pour:['client','coach'],q:'Mes données sont-elles gardées sans connexion ?',
    r:'Oui. Ce que tu enregistres est d’abord gardé sur ton téléphone, puis envoyé dès que la connexion revient. Si un envoi échoue, un message te le dit.'},
  {pour:['client','coach'],q:'Comment installer RepCore sur mon téléphone ?',
    r:'Sur Android : menu du navigateur, puis « Ajouter à l’écran d’accueil ». Sur iPhone, dans Safari : bouton Partager, puis « Sur l’écran d’accueil ».'},
  {pour:['client','coach'],q:'Les notifications n’arrivent pas.',
    r:'Le bloc « Notifications » des réglages indique l’état de ton appareil. Sur iPhone, installe d’abord RepCore sur l’écran d’accueil : Safari n’envoie de notifications qu’aux applications installées.'},
  {pour:['client'],q:'Comment récupérer mes données ?',
    r:'Plus haut sur cet écran, « Mes données » : un fichier avec tout ce que RepCore conserve à ton sujet, disponible même si ton accès a expiré.'},
  {pour:['client'],q:'Comment résilier mon abonnement ?',
    r:'Plus haut sur cet écran, le bloc « Mon abonnement » : la demande s’y fait directement, et la date de fin de ton accès y est écrite.'},
  {pour:['client','coach'],q:'Qui voit mes données ?',
    r:'Toi, ton coach si tu es rattaché à un coach, et le créateur de RepCore pour le support. Le détail est dans la politique de confidentialité.'},
  {pour:['coach'],q:'Comment inviter un athlète ?',
    r:'Onglet ATHLÈTES, « Ajouter de nouveaux élèves » : tu obtiens un code à lui transmettre. Il le saisit à l’inscription et apparaît dans ta liste.'},
  {pour:['client','coach'],q:'L’écran est trop sombre, ou trop clair.',
    r:'Juste au-dessus, « Apparence » : Sombre, Clair, ou Auto pour suivre le réglage de ton téléphone. Le choix est gardé sur cet appareil.'}
]);
const CONTACT_CREATEUR='guellec.coachingpro@gmail.com';
// PURE. Le lien de contact : un objet clair et, dans le corps, ce qui aide à
// comprendre un souci (version, date, rôle, appareil). Rien d'autre.
function lienContactCreateur(role,build,maj,appareil){
  const corps='Bonjour,\n\n(Décris le souci ici : ce que tu faisais, ce qui s’est passé.)\n\n'
    +'Version : '+(build||'?')+(maj?' du '+maj:'')+'\nCompte : '+(role==='coach'?'coach':'athlète')
    +(appareil?'\nAppareil : '+String(appareil).slice(0,160):'');
  return 'mailto:'+CONTACT_CREATEUR+'?subject='+encodeURIComponent('RepCore : un souci')+'&body='+encodeURIComponent(corps);
}
// PURE. « Mis à jour le 26 septembre 2026 · version 1598 ».
function texteMiseAJour(maj,build){
  let d='';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(maj||''))){
    const [a,m,j]=String(maj).split('-').map(Number);
    d=new Date(a,m-1,j).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  }
  return (d?'Mis à jour le '+d:'Date de mise à jour inconnue')+(build?' · version '+build:'');
}
// PURE.
function htmlPrefsAide(role,choix,maj,build,appareil){
  const r=role==='coach'?'coach':'client';
  const seg=THEMES.map(t=>'<button type="button" data-theme="'+t.cle+'" aria-pressed="'+(t.cle===choix)+'" onclick="themeChoisir(\''+t.cle+'\')">'+t.nom+'</button>').join('');
  const faq=FAQ_APP.filter(x=>x.pour.indexOf(r)>=0).map(x=>'<details class="prf-q"><summary>'+escapeHtml(x.q)+'</summary><p>'+escapeHtml(x.r)+'</p></details>').join('');
  return '<section class="prf card" aria-labelledby="prf-t-app">'
    +'<h3 class="prf-t" id="prf-t-app">Apparence</h3>'
    +'<p class="prf-sub">Sombre par défaut. Auto suit le réglage de ton téléphone.</p>'
    +'<div class="prf-theme" role="group" aria-label="Apparence">'+seg+'</div>'
    +'</section>'
    +'<section class="prf card" aria-labelledby="prf-t-faq">'
    +'<h3 class="prf-t" id="prf-t-faq">Questions fréquentes</h3>'+faq
    +'</section>'
    +'<section class="prf card" aria-labelledby="prf-t-ct">'
    +'<h3 class="prf-t" id="prf-t-ct">Un souci avec l’application ?</h3>'
    +'<p class="prf-sub">Pour un bug, une question de compte ou de paiement, écris directement au créateur de RepCore'+(r==='client'?' (pas à ton coach)':'')+'. La version de ton application est jointe au message.</p>'
    +'<a class="btn btn-outline btn-casse prf-contact" href="'+escapeHtml(lienContactCreateur(r,build,maj,appareil))+'">Écrire au créateur de RepCore</a>'
    +'<p class="prf-maj">'+escapeHtml(texteMiseAJour(maj,build))+'</p>'
    +'</section>';
}
// ══ LOT M1 : LA MARQUE DU COACH PRO (30/09/2026) ═══════════════════════════
//
// Un coach de palier Pro (ou le créateur) habille l'app de SES athlètes : sa
// couleur remplace l'accent rouge, son logo et son nom coiffent l'accueil et
// le canal ; « Propulsé par RepCore » reste en petit dans les réglages.
//
//   coachs/<coach>/marque = {nom (≤ 40), couleur '#RRGGBB', logoUrl?, maj}
//
// ⚠ LE PALIER EST VÉRIFIÉ PAR LA BASE, pas par l'app : les règles refusent
//   l'écriture à un coach qui n'est pas Pro, et la LECTURE à ses athlètes dès
//   qu'il ne l'est plus. L'athlète reçoit alors un refus : la marque est
//   retirée, le cache vidé, l'app redevient RepCore. Même chose si le lien
//   au coach est rompu (plus de coachEmailKey) : rien n'est demandé.
// ⚠ LA COULEUR EST REJUGÉE CHEZ L'ATHLÈTE (couleurAccessible) : une couleur
//   illisible sur le fond sombre (contraste < 3:1) est remplacée par la plus
//   proche qui passe, même si elle a été écrite par un autre chemin.
// ⚠ SEULS LES TOKENS D'ACCENT CHANGENT (--red, --red-deep, --red-glow,
//   --red-text, --red-bg, --glow-red, et --red-light qui dérive de --red).
//   Les rouges écrits en dur dans la feuille de style restent rouges.
// ⚠ HORS LIGNE : la dernière marque reçue (DB 'coach_marque') s'applique au
//   lancement ; la réponse du réseau la confirme, la remplace ou la retire.

// ── couleur:debut (le Worker en a la même copie : cloudflare/src/marque.js ;
//    pages.test.mjs vérifie que les deux répondent pareil)
// PURE. #RGB ou #RRGGBB (casse libre) → '#RRGGBB' en capitales, ou null.
function hexMarque(v){
  const s=String(v==null?'':v).trim();
  let m=/^#?([0-9a-fA-F]{6})$/.exec(s);
  if(m) return '#'+m[1].toUpperCase();
  m=/^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  return m?('#'+m[1]+m[1]+m[2]+m[2]+m[3]+m[3]).toUpperCase():null;
}
function _mqRgb(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function _mqHex(r,g,b){ return '#'+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
// La luminance relative de WCAG 2.x.
function luminanceRelative(hex){
  const h=hexMarque(hex); if(!h) return null;
  const c=_mqRgb(h).map(v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
// PURE. Le rapport de contraste WCAG entre deux couleurs (1 à 21).
function contrasteCouleurs(a,b){
  const x=luminanceRelative(a), y=luminanceRelative(b);
  if(x==null||y==null) return null;
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
function _mqHsl(h){
  const [r,g,b]=_mqRgb(h).map(v=>v/255);
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
  if(mx===mn) return [0,0,l];
  const d=mx-mn, s=l>0.5?d/(2-mx-mn):d/(mx+mn);
  let t=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;
  return [t/6,s,l];
}
function _mqDeHsl(hh,s,l){
  if(s===0) return _mqHex(l*255,l*255,l*255);
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
  const f=t=>{ if(t<0) t+=1; if(t>1) t-=1; return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p; };
  return _mqHex(f(hh+1/3)*255,f(hh)*255,f(hh-1/3)*255);
}
/**
 * PURE. Une couleur est-elle lisible sur le fond (sombre par défaut, #080808,
 * le --bg de l'app) avec un contraste d'au moins `min` (3:1 par défaut) ?
 * Rend {ok, couleur, ratio, proposee}. Refusée, `proposee` est la plus
 * proche qui passe : MÊME teinte, même saturation, la luminosité la plus
 * proche de l'originale qui atteint le seuil (éclaircie sur un fond sombre,
 * assombrie sur un fond clair).
 */
function couleurAccessible(hex,fond,min){
  const c=hexMarque(hex), f=hexMarque(fond||'#080808')||'#080808', seuil=Number(min)||3;
  if(!c) return {ok:false,couleur:null,ratio:null,proposee:null,raison:'format'};
  const ratio=contrasteCouleurs(c,f);
  if(ratio>=seuil) return {ok:true,couleur:c,ratio,proposee:null};
  const [h,s,l]=_mqHsl(c);
  const sombre=luminanceRelative(f)<0.5;
  // Recherche par dichotomie du premier cran qui passe, entre la couleur et le blanc (ou le noir).
  let bas=sombre?l:0, haut=sombre?1:l;
  for(let i=0;i<30;i++){
    const m=(bas+haut)/2;
    const ok=contrasteCouleurs(_mqDeHsl(h,s,m),f)>=seuil;
    if(sombre){ if(ok) haut=m; else bas=m; } else { if(ok) bas=m; else haut=m; }
  }
  let p=_mqDeHsl(h,s,sombre?haut:bas);
  // L'arrondi à l'octet peut retomber d'un cheveu sous le seuil : un cran de plus.
  for(let k=0;k<20&&contrasteCouleurs(p,f)<seuil;k++){ const x=_mqHsl(p); p=_mqDeHsl(x[0],x[1],Math.max(0,Math.min(1,x[2]+(sombre?0.004:-0.004)))); }
  return {ok:false,couleur:c,ratio,proposee:p};
}
// ── couleur:fin

const MARQUE_NOM_MAX=40, MARQUE_LOGO_KO=200, MARQUE_LOGO_PX=256;
const MARQUE_FOND='#080808', MARQUE_FOND_CLAIR='#f4f4f4';
const MARQUE_LOGO_RE=/^https:\/\/res\.cloudinary\.com\/[^\s"'<>]{1,460}$/;
const MARQUE_CREATEUR='guellec,coachingpro@gmail,com';
// PURE. La marque à appliquer, ou null (nom 1 à 40, couleur rendue lisible,
// logo hébergé chez Cloudinary ou absent).
function marqueValide(m){
  if(!m||typeof m!=='object') return null;
  const nom=String(m.nom||'').replace(/\s+/g,' ').trim();
  if(!nom||nom.length>MARQUE_NOM_MAX) return null;
  const c=couleurAccessible(m.couleur);
  if(!c.couleur) return null;
  return {nom,couleur:c.ok?c.couleur:c.proposee,logoUrl:MARQUE_LOGO_RE.test(String(m.logoUrl||''))?String(m.logoUrl):null};
}
// PURE. « Kévin Guellec Coaching » → « KG » ; rien de lisible → « RC ».
function initialesMarque(nom){
  const mots=String(nom||'').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean);
  return mots.slice(0,2).map(w=>w[0]).join('').toUpperCase()||'RC';
}
// PURE. Mélange deux couleurs (t = part de b).
function _mqMelange(a,b,t){
  const x=_mqRgb(hexMarque(a)), y=_mqRgb(hexMarque(b));
  return _mqHex(x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t);
}
// PURE. Les tokens d'accent, pour le thème sombre et le thème clair.
function marqueTokens(couleur){
  const c=hexMarque(couleur);
  if(!c) return null;
  const [r,g,b]=_mqRgb(c);
  const texteSombre=couleurAccessible(c,MARQUE_FOND,4.5), texteClair=couleurAccessible(c,MARQUE_FOND_CLAIR,4.5);
  // Le texte POSÉ SUR l'accent : blanc, ou presque noir si la couleur est claire (un jaune).
  const sur=contrasteCouleurs('#FFFFFF',c)>=contrasteCouleurs('#0B0B0B',c)?'#FFFFFF':'#0B0B0B';
  return {commun:{'--red':c,'--red-deep':_mqMelange(c,'#000000',0.18),'--red-glow':_mqMelange(c,'#FFFFFF',0.2),
      '--glow-red':'0 0 18px rgba('+r+','+g+','+b+',.35)','--mq-sur':sur,
      '--mq-sombre':_mqMelange(c,'#000000',0.45),'--mq-nuit':_mqMelange(c,'#000000',0.78)},
    sombre:{'--red-text':texteSombre.ok?c:texteSombre.proposee,'--red-bg':_mqMelange(c,'#000000',0.94)},
    clair:{'--red-text':texteClair.ok?c:texteClair.proposee,'--red-bg':_mqMelange(c,'#FFFFFF',0.9)}};
}
// PURE. La feuille qui surcharge ces tokens. Placée APRÈS rc-style : à
// spécificité égale, elle gagne ; le thème clair a son propre bloc.
function marqueCss(couleur){
  const t=marqueTokens(couleur);
  if(!t) return '';
  const decl=o=>Object.keys(o).map(k=>k+':'+o[k]).join(';');
  // LES COMPOSANTS LES PLUS VUS, dont le rouge est écrit en dur : le bouton
  // principal, la carte « Séance du jour » (assombrie : son texte est blanc),
  // « Défie un pote », le contour de l'avatar.
  const M=':root[data-marque="coach"] ';
  return ':root,:root[data-theme="clair"]{'+decl(t.commun)+'}'
    +':root{'+decl(t.sombre)+'}'
    +':root[data-theme="clair"]{'+decl(t.clair)+'}'
    +M+'.btn-red,'+M+'.btn-red:hover{background:var(--red);border-color:color-mix(in srgb,var(--red) 60%,transparent);color:var(--mq-sur)}'
    +M+'.du-defier{background:linear-gradient(var(--red-glow),var(--red),var(--red-deep));color:var(--mq-sur)}'
    +M+'.banner-hero{background:linear-gradient(145deg,var(--mq-sombre) 0%,var(--mq-nuit) 100%)}'
    +M+'#clh-athlete-avatar{border-color:var(--red)}';
}
// PURE. Le logo, ou les initiales quand il manque ou ne se charge pas (l'image
// posée PAR-DESSUS les initiales s'efface d'elle-même en cas d'erreur).
function htmlMarqueLogo(m,classe){
  if(!m) return '';
  return '<span class="mq-logo'+(classe?' '+classe:'')+'" aria-hidden="true"><span class="mq-init">'+escapeHtml(initialesMarque(m.nom))+'</span>'
    +(m.logoUrl?'<img src="'+escapeHtml(m.logoUrl)+'" alt="" onerror="this.remove()">':'')+'</span>';
}
// PURE. La bande de l'accueil et du canal.
function htmlMarqueBande(m){
  if(!m) return '';
  return '<div class="mq-bande">'+htmlMarqueLogo(m)+'<span class="mq-nom">'+escapeHtml(m.nom)+'</span></div>';
}

// ── L'application chez l'athlète ─────────────────────────────────────────
let _marqueActive=null;
function marqueActive(){ return _marqueActive; }
function _rendreMarqueEntetes(){
  for(const id of ['clh-marque','canal-marque']){
    const z=document.getElementById(id);
    if(!z) continue;
    z.innerHTML=htmlMarqueBande(_marqueActive);
    z.hidden=!_marqueActive;
  }
}
// Pose (ou retire, avec null) la marque : variables, attribut, en-têtes.
function appliquerMarque(m){
  const v=marqueValide(m);
  const avant=document.getElementById('rc-marque');
  if(avant) avant.remove();
  if(!v){
    _marqueActive=null;
    document.documentElement.removeAttribute('data-marque');
    _rendreMarqueEntetes();
    return false;
  }
  const st=document.createElement('style');
  st.id='rc-marque';
  st.textContent=marqueCss(v.couleur);
  // DANS LE <body>, APRES rc-style (01/10/2026). La feuille de l'app est liee
  // sous #s-splash, dans le <body> (index.html, CSS critique) : une feuille
  // ajoutee au <head> passerait AVANT elle dans l'ordre du document, et ses
  // :root{--red…} perdraient a specificite egale.
  (document.body||document.head).appendChild(st);
  document.documentElement.setAttribute('data-marque','coach');
  _marqueActive=v;
  _rendreMarqueEntetes();
  return true;
}
function retirerMarque(){ return appliquerMarque(null); }
function _marqueCache(){ try{ return DB.get('coach_marque')||null; }catch(e){ return null; } }
function _marqueCacher(k,m){ try{ DB.set('coach_marque',{key:k,m:m||null,t:Date.now()}); }catch(e){} }
// Au lancement de l'athlète : le cache d'abord (hors ligne compris), puis la base.
async function chargerMarqueCoach(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach'){ retirerMarque(); return null; }
  const k=cleCoachDe(u);
  // Athlète autonome, ou lien au coach rompu : RepCore, et le cache se vide.
  if(!k){ if(_marqueCache()) _marqueCacher(null,null); retirerMarque(); return null; }
  const c=_marqueCache();
  if(c&&c.key===k&&c.m) appliquerMarque(c.m); else retirerMarque();
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return _marqueActive;
  let r=null;
  try{ r=await _fbJson('coachs/'+k+'/marque'); }catch(e){ r=null; }
  if(r&&r.ok){ _marqueCacher(k,r.v||null); appliquerMarque(r.v||null); }
  // Refus des règles : le coach n'est plus Pro, ou n'est plus le sien.
  else if(r&&(r.st===401||r.st===403)){ _marqueCacher(k,null); retirerMarque(); }
  // Réseau absent (st 0) : la marque du cache reste.
  return _marqueActive;
}

// ── Le réglage, chez le coach ────────────────────────────────────────────
// PURE. Le coach peut-il poser une marque ? (La base le vérifie aussi.)
function coachMarqueOuvert(u){
  return !!u&&(String(u.email||'').replace(/\./g,',')===MARQUE_CREATEUR||(u.role==='coach'&&'pro'===u.coachPlan));
}
let _mqEd=null;
async function renderMarqueCoach(){
  const z=document.getElementById('coach-marque');
  if(!z||!currentUser||currentUser.role!=='coach') return false;
  const E=escapeHtml;
  const tete='<div class="mq-carte-t">Ta marque dans l’app de tes athlètes</div>';
  if(!coachMarqueOuvert(currentUser)){
    z.innerHTML='<div class="mq-carte">'+tete+'<div class="mq-carte-d">Avec le palier Pro, ta couleur et ton logo habillent l’app de tes athlètes, ta vitrine aussi.</div></div>';
    return true;
  }
  if(!_mqEd){
    _mqEd={nom:String(currentUser.teamName||((currentUser.fname||'')+' '+(currentUser.lname||'')).trim()||'').slice(0,MARQUE_NOM_MAX),
      couleur:ROUGE_MARQUE,logoUrl:'',envoi:false,lu:false};
    const cle=String(currentUser.email||'').replace(/\./g,',');
    _fbJson('coachs/'+cle+'/marque').then(r=>{
      if(!_mqEd) return;
      _mqEd.lu=true;
      if(r&&r.ok&&r.v){ _mqEd.nom=String(r.v.nom||_mqEd.nom); _mqEd.couleur=hexMarque(r.v.couleur)||_mqEd.couleur; _mqEd.logoUrl=String(r.v.logoUrl||''); _mqEd.existe=true; }
      renderMarqueCoach();
    }).catch(()=>{});
  }
  const e=_mqEd;
  const aLogoProfil=/^data:image\//.test(String(currentUser.logo||''));
  z.innerHTML='<div class="mq-carte">'+tete
    +'<div class="mq-carte-d">Ta couleur remplace le rouge, ton logo et ton nom coiffent leur accueil et le canal. Ils la voient au prochain lancement.</div>'
    +'<label class="mq-lab" for="mq-nom">Nom affiché</label>'
    +'<input id="mq-nom" class="mq-champ" maxlength="40" value="'+E(e.nom)+'" oninput="mqChamp(\'nom\',this.value)">'
    +'<label class="mq-lab" for="mq-hex">Couleur</label>'
    +'<div class="mq-coul"><input type="color" id="mq-couleur" value="'+E((hexMarque(e.couleur)||ROUGE_MARQUE).toLowerCase())+'" oninput="mqChamp(\'couleur\',this.value)" aria-label="Choisir la couleur">'
    +'<input id="mq-hex" class="mq-champ" maxlength="7" value="'+E(e.couleur)+'" oninput="mqChamp(\'couleur\',this.value)"></div>'
    +'<div id="mq-verdict" class="mq-verdict"></div>'
    +'<label class="mq-lab">Logo (carré, 200 Ko au plus)</label>'
    +'<div class="mq-logo-l"><div id="mq-logo-apercu"></div><div style="flex:1;min-width:0">'
      +'<label class="btn btn-outline btn-sm mq-b">'+(e.envoi?'Envoi…':'Choisir une image')+'<input type="file" accept="image/*" style="display:none" onchange="mqLogoFichier(this)"></label>'
      +(aLogoProfil?'<button type="button" class="mq-lien" onclick="mqLogoProfil()">Reprendre le logo de mon profil</button>':'')
      +(e.logoUrl?'<button type="button" class="mq-lien" onclick="mqChamp(\'logoUrl\',\'\');renderMarqueCoach()">Sans logo (initiales)</button>':'')
    +'</div></div>'
    +'<div class="mq-lab">Aperçu</div><div id="mq-apercu" class="mq-apercu"></div>'
    +'<div style="display:flex;gap:8px;margin-top:12px">'
      +(e.existe?'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="mqRetirer()">Retirer ma marque</button>':'')
      +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="mqEnregistrer()">Enregistrer ma marque</button></div>'
    +'</div>';
  _mqApercu();
  return true;
}
// La saisie ne redessine que l'aperçu : réécrire les champs ferait perdre le clavier.
function mqChamp(k,v){
  if(!_mqEd) return;
  _mqEd[k]=String(v==null?'':v);
  if(k==='couleur'){
    const h=hexMarque(v);
    const a=document.getElementById('mq-couleur'), b=document.getElementById('mq-hex');
    if(h&&a&&document.activeElement!==a) a.value=h.toLowerCase();
    if(h&&b&&document.activeElement!==b) b.value=h;
  }
  _mqApercu();
}
function mqUtiliser(hex){ mqChamp('couleur',hex); const b=document.getElementById('mq-hex'); if(b) b.value=hex; const a=document.getElementById('mq-couleur'); if(a) a.value=hex.toLowerCase(); }
function _mqApercu(){
  const e=_mqEd; if(!e) return;
  const c=couleurAccessible(e.couleur);
  const v=document.getElementById('mq-verdict');
  if(v) v.innerHTML=!c.couleur?'<span class="mq-ko">Écris une couleur au format #RRGGBB.</span>'
    :c.ok?'<span class="mq-ok">Lisible sur le fond de l’app (contraste '+String(Math.round(c.ratio*10)/10).replace('.',',')+':1).</span>'
    :'<span class="mq-ko">Trop sombre sur le fond de l’app (contraste '+String(Math.round(c.ratio*10)/10).replace('.',',')+':1, il en faut 3).</span> '
      +'<button type="button" class="mq-lien" onclick="mqUtiliser('+_attrArg(c.proposee)+')">Utiliser '+escapeHtml(c.proposee)+', la plus proche lisible</button>';
  const l=document.getElementById('mq-logo-apercu');
  const m={nom:e.nom||'?',couleur:c.ok?c.couleur:(c.proposee||ROUGE_MARQUE),logoUrl:e.logoUrl||null};
  if(l){ l.innerHTML=htmlMarqueLogo(m,'mq-logo-grand'); l.style.setProperty('--mq-c',m.couleur); }
  const a=document.getElementById('mq-apercu');
  if(a) a.innerHTML='<div class="mq-apercu-fond" style="--mq-c:'+escapeHtml(m.couleur)+'">'+htmlMarqueBande(m)
    +'<div class="mq-apercu-b">Commencer ma séance</div></div>';
}
// Un logo CARRÉ, 256 px, fond transparent, 200 Ko au plus (PNG, sinon WebP).
function _mqLogoCarre(src){
  return new Promise((ok,ko)=>{
    const im=new Image();
    im.onload=async()=>{
      try{
        for(const px of [MARQUE_LOGO_PX,192,128]){
          const cv=document.createElement('canvas'); cv.width=cv.height=px;
          const cx=cv.getContext('2d');
          const k=Math.min(px/im.naturalWidth,px/im.naturalHeight);
          const w=im.naturalWidth*k, h=im.naturalHeight*k;
          cx.drawImage(im,(px-w)/2,(px-h)/2,w,h);
          for(const [type,q] of [['image/png',1],['image/webp',0.92],['image/webp',0.8],['image/webp',0.65]]){
            const b=await new Promise(r=>cv.toBlob(r,type,q));
            if(b&&b.size<=MARQUE_LOGO_KO*1024) return ok(b);
          }
        }
        ko(new Error('Logo trop lourd, même réduit'));
      }catch(e){ ko(e); }
    };
    im.onerror=()=>ko(new Error('Image illisible'));
    im.src=src;
  });
}
async function _mqEnvoyerLogo(src){
  if(!_mqEd) return false;
  _mqEd.envoi=true; renderMarqueCoach();
  try{
    const b=await _mqLogoCarre(src);
    const d=await phpUploadImage(b,'logo-'+Date.now(),'marque');
    if(!d||!MARQUE_LOGO_RE.test(String(d.secure_url||''))) throw new Error('Envoi refusé');
    _mqEd.logoUrl=String(d.secure_url);
    toast('Logo prêt : pense à enregistrer ta marque','var(--green)');
  }catch(e){ toast((e&&e.message)||'Envoi impossible','var(--orange)'); }
  finally{ if(_mqEd){ _mqEd.envoi=false; renderMarqueCoach(); } }
  return true;
}
function mqLogoFichier(input){
  const f=input&&input.files&&input.files[0];
  if(!f) return;
  if(f.size>20*1024*1024){ toast('Image trop lourde (20 Mo au plus)','var(--orange)'); return; }
  const url=URL.createObjectURL(f);
  _mqEnvoyerLogo(url).finally(()=>URL.revokeObjectURL(url));
}
function mqLogoProfil(){ if(/^data:image\//.test(String(currentUser.logo||''))) _mqEnvoyerLogo(currentUser.logo); }
async function mqEnregistrer(){
  const e=_mqEd; if(!e) return false;
  const nom=String(e.nom||'').replace(/\s+/g,' ').trim();
  if(!nom||nom.length>MARQUE_NOM_MAX){ toast('Donne un nom de 1 à 40 caractères','var(--orange)'); return false; }
  const c=couleurAccessible(e.couleur);
  if(!c.couleur){ toast('Couleur au format #RRGGBB','var(--orange)'); return false; }
  if(!c.ok){ toast('Couleur trop sombre : utilise '+c.proposee+' ou une plus claire','var(--orange)'); return false; }
  const corps={nom,couleur:c.couleur,maj:Date.now()};
  if(MARQUE_LOGO_RE.test(String(e.logoUrl||''))) corps.logoUrl=e.logoUrl;
  const cle=String(currentUser.email||'').replace(/\./g,',');
  const r=await _fbJson('coachs/'+cle+'/marque','PUT',corps);
  if(r&&r.ok){ e.existe=true; toast('Ta marque est enregistrée : tes athlètes la verront au prochain lancement','var(--green)'); renderMarqueCoach(); return true; }
  toast(r&&(r.st===401||r.st===403)?'Réservé au palier Pro':'Enregistrement impossible, réessaie','var(--orange)');
  return false;
}
async function mqRetirer(){
  if(!await rcConfirm('Retirer ta marque ?','Tes athlètes retrouvent l’app RepCore au prochain lancement.','Retirer')) return false;
  const cle=String(currentUser.email||'').replace(/\./g,',');
  const r=await _fbJson('coachs/'+cle+'/marque','DELETE');
  if(r&&r.ok){ _mqEd=null; toast('Marque retirée','var(--green)'); renderMarqueCoach(); return true; }
  toast('Retrait impossible, réessaie','var(--orange)');
  return false;
}

function rendrePrefsAide(){
  const role=(currentUser&&currentUser.role==='coach')?'coach':'client';
  const z=document.getElementById(role==='coach'?'ct-prefs':'cr-prefs');
  if(!z) return false;
  let ua='';
  try{ ua=navigator.userAgent||''; }catch(e){}
  z.innerHTML=htmlPrefsAide(role,themeChoisi(),window.RC_MAJ||'',window.RC_BUILD||'',ua);
  // LOT M1 : l'app porte la marque du coach ; RepCore le dit, en petit.
  if(role==='client'&&_marqueActive) z.insertAdjacentHTML('beforeend','<p class="mq-propulse">'+escapeHtml(_marqueActive.nom)+' · propulsé par RepCore</p>');
  return true;
}
function ouvrirReglagesAthlete(){
  go('s-client-reglages');
  _renderAbonnement();
  // L'interrupteur du son reflète le dossier à chaque ouverture.
  try{ _majSonReglages(); }catch(e){}
  try{ _rendreReglagesPush(); }catch(e){}
  try{ _majConsentementCoachReglages(); }catch(e){}
  try{ rendrePrefsAide(); }catch(e){}
  try{ _rendreUniteReglages(); }catch(e){}
  try{ _rendreReglagesSections(); }catch(e){ rcErreurMuette('_rendreReglagesSections',e); }
  const v=document.getElementById('cr-version');
  if(v) versionSW().then(x=>{ if(x) v.textContent='RepCore · '+x; });
  return true;
}
// Ouvre directement l'écran d'abonnement — un tap depuis les réglages.
function ouvrirEcranAbonnement(){
  ouvrirReglagesAthlete();
  const z=document.getElementById('cr-abo');
  // La section Compte est repliée : on l'ouvre avant d'y aller.
  const d=z&&z.closest('details'); if(d) d.open=true;
  if(z) z.scrollIntoView({block:'start'});
  return true;
}
// ══ BUILD 1889 : LES SECTIONS DES RÉGLAGES ═════════════════════════════════
// Les contrôles appellent les MÊMES fonctions qu'ailleurs (régime, unité des
// macros, objectifs pas et sommeil, poids masqué, cycle, fréquence des bilans,
// célébrations, nom sur les visuels) : seule leur place change.
function _rendreReglagesSections(){
  const u=currentUser; if(!u) return false;
  const carte='background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px;margin-bottom:12px';
  const tit=x=>'<div class="t-carte" style="margin-bottom:8px">'+escapeHtml(x)+'</div>';
  const bt=(lib,act,on)=>'<button type="button" class="btn '+(on?'btn-red':'btn-outline')+' btn-sm" style="flex:1;margin:0" aria-pressed="'+(on?'true':'false')+'" onclick="'+act+'">'+escapeHtml(lib)+'</button>';
  const zn=document.getElementById('cr-nutrition');
  if(zn){
    let mu=''; try{ mu=htmlMacroUnite(u,'cr'); }catch(e){ mu=''; }
    zn.innerHTML='<div style="'+carte+'">'+tit('Approche alimentaire')
      +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:0" onclick="ouvrirChoixDiete()">Choisir mon approche</button></div>'
      +'<div style="'+carte+'">'+tit('Unité des macros')+'<div id="cr-macro">'+mu+'</div></div>';
  }
  const zs=document.getElementById('cr-objectifs');
  if(zs){
    let h='<div style="'+carte+'">'+tit('Objectifs')+'<div style="display:flex;gap:8px">'
      +bt('Pas du jour','sanObjectif(\'pas\')')+bt('Sommeil','sanObjectif(\'sommeil\')')+'</div></div>'
      +'<div style="'+carte+'">'+tit('Suivi du poids')
      +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:0" onclick="togglePoidsMasque();_rendreReglagesSections()">'
      +(u.masquerPoids?'Réafficher le suivi du poids':'Masquer le suivi du poids')+'</button></div>';
    let montrer=false; try{ montrer=isFemale(u.gender)||!!cycleSuiviDe(u); }catch(e){}
    if(montrer){
      let cs=null; try{ cs=cycleSuiviDe(u); }catch(e){}
      h+='<div style="'+carte+'">'+tit('Suivi du cycle')+'<div style="display:flex;flex-direction:column;gap:8px">'
        +ATP_CYCLE_OPTIONS.map(([v,titre])=>bt(titre,'setAtpCycleSuivi(\''+v+'\');_enregistrerCycleReglages()',cs===v)).join('')+'</div></div>';
    }
    zs.innerHTML=h;
  }
  const zb=document.getElementById('cr-bilans'), sb=document.getElementById('cr-sec-bilans');
  let cad=null; try{ cad=bilanCadenceValide(u.bilanCadence); }catch(e){}
  // Une cadence fixée par le coach prime : la section disparaît.
  if(sb) sb.hidden=!!cad;
  if(zb&&!cad){
    const f=u._bilanFreq||2;
    zb.innerHTML='<div style="'+carte+'">'+tit('Fréquence des bilans')+'<div style="display:flex;gap:8px">'
      +bt('Chaque semaine','setBilanFreq(1);_rendreReglagesSections()',f===1)+bt('Toutes les 2 semaines','setBilanFreq(2);_rendreReglagesSections()',f===2)+'</div></div>';
  }
  const zc=document.getElementById('cr-celebrations');
  if(zc){ try{ zc.innerHTML=htmlReglageCelebrations(u); }catch(e){ zc.innerHTML=''; } }
  // Le nom sur les visuels : l'état du dossier, comme à l'ouverture du profil.
  const ps=document.getElementById('atp-pseudo'); if(ps) ps.value=u.pseudo||'';
  try{ setVisuelNom(u.visuelNom||'prenom'); }catch(e){}
  return true;
}
// Créé CONDITIONNELLEMENT : un accès gratuit par code coach ne voit ni
// l'écran d'abonnement ni la case. Rien dans le DOM, pas un bloc masqué.
function _renderAbonnement(){
  const z=document.getElementById('cr-abo');
  if(!z) return false;
  const u=currentUser;
  if(!aUnAbonnement(u)){ z.innerHTML=''; return false; }
  const r=resiliationDemandee(u);
  const fin=finAccesAbonnement(u);
  const finTxt=fin?new Date(fin).toLocaleDateString('fr-FR'):'la fin de la période réglée';
  const pal=SUB_PALIERS.find(x=>x.cle===(abonnementDe(u).palier))||SUB_PALIERS[1];
  const l=(t,v)=>`<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">
    <span style="color:var(--sub)">${escapeHtml(t)}</span><span style="color:var(--text)">${escapeHtml(v)}</span></div>`;
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:20px;margin-bottom:20px">
    <div style="font-weight:800;font-size:var(--fs-md);margin-bottom:8px">Mon abonnement</div>
    ${l('Formule',(pal&&pal.titre)||'Mensuel')}
    ${l('Prix',((pal&&pal.prix)||prixOffre('essentielle'))+' '+((pal&&pal.periode)||'par mois'))}
    ${/* ⚠ CE LIBELLE DISAIT « Prochaine échéance » et affichait le TERME DE
          L'ENGAGEMENT (corrigé le 24/09/2026) : quelqu'un qui paie au mois y
          lisait qu'il ne serait pas prélevé avant un an. La date n'a pas
          changé, le mot si. */''}
    ${fin?l(r?'Accès jusqu\'au':'Engagement jusqu\'au',finTxt):''}
    ${r?`<div style="margin-top:12px;background:var(--surface-2);border-radius:var(--r-3);padding:12px 14px">
        <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7;margin-bottom:8px" id="resil-effet">Résiliation demandée le ${escapeHtml(new Date(r.ts).toLocaleDateString('fr-FR'))}. ${escapeHtml(texteEffetResiliation(u,r.ts,_resilEffetLu(u.email)))}</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.7">${escapeHtml(RESIL_MOYENS)}</div>
      </div>`
      :`<button class="btn btn-outline" style="width:100%;margin-top:12px;letter-spacing:1px" onclick="_ouvrirResiliation()">Résilier mon abonnement</button>
        <div id="cr-resil" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px"></div>`}
  </div>`;
  return true;
}
// UN écran de confirmation, avec un motif FACULTATIF. Pas de rétention, pas
// de remise, pas de second « êtes-vous sûr » : c'est exactement la friction
// que L215-1-1 interdit.
function _ouvrirResiliation(){
  const z=document.getElementById('cr-resil');
  if(!z) return false;
  z.style.display='block';
  z.innerHTML=`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7;margin-bottom:10px" id="resil-effet-avant">${escapeHtml(texteEffetResiliation(currentUser,Date.now()))}</div>
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:8px">Si tu veux nous dire pourquoi : c'est facultatif, et ça ne change rien à ta résiliation.</div>
    <select id="resil-motif" style="width:100%;background:var(--surface-2);border:1px solid var(--border);color:var(--text);padding:12px 14px;border-radius:var(--r-3);font-family:Montserrat,sans-serif;font-size:var(--fs-md);margin-bottom:8px">
      <option value="">Sans réponse</option>
      ${RESIL_MOTIFS.map(m=>'<option value="'+escapeHtml(m)+'">'+escapeHtml(m)+'</option>').join('')}
    </select>
    <input id="resil-libre" type="text" maxlength="300" placeholder="Préciser (facultatif)" style="width:100%;font-size:var(--fs-md);padding:10px 12px;margin-bottom:10px">
    <button class="btn btn-red" style="width:100%;margin:0" onclick="_confirmerResiliation()">Confirmer la résiliation</button>`;
  return true;
}
function _confirmerResiliation(){
  const m=(document.getElementById('resil-motif')||{}).value||'';
  const l=(document.getElementById('resil-libre')||{}).value||'';
  const motif=[m,l].filter(Boolean).join(' : ');
  if(!demanderResiliation(motif)){ toast('Résiliation déjà enregistrée.','var(--sub)'); return false; }
  _renderAbonnement();
  toast('Résiliation enregistrée '+ICO.coche,'var(--green)');
  return true;
}
// ⚠ CE TEXTE PROMETTAIT LE REMBOURSEMENT DE TOUT PRELEVEMENT POSTERIEUR A LA
//   DEMANDE. Depuis l'engagement de douze mois (24/09/2026), les echeances
//   restantes sont dues : la promesse inverse, affichee au moment ou quelqu'un
//   resilie, aurait coute soit de l'argent, soit la confiance. Ce qui reste
//   vrai, et qui est dit : l'acces court jusqu'au terme, rien ne se reconduit
//   ensuite, et un prelevement APRES le terme se rembourse.
//
// ⚠ ET IL DISAIT « RepCore ne peut pas annuler l'abonnement à ta place »
//   (corrigé le 02/10/2026) : le serveur léger l'annule lui-même chez PayPal
//   à la date d'effet. Demander à la personne de couper elle-même pendant
//   l'engagement l'aurait poussée à rompre son contrat.
const RESIL_MOYENS='Ta demande est enregistrée. Tu n\'as rien à faire chez PayPal : '
  +'RepCore arrête lui-même ton abonnement à la date d\'effet, et rien ne se '
  +'reconduit ensuite. Annuler directement chez PayPal avant le terme ne met pas fin '
  +'à l\'engagement. Un prélèvement postérieur à la date d\'effet te serait '
  +'remboursé (CGV §5).';
// Palier retenu. L'annuel est pré-sélectionné quand il existe ; sinon le
// premier disponible, pour qu'aucun état ne laisse la sélection vide.
let _subPalier=null;
// ══ LE LEXIQUE ═══════════════════════════════════════════════════════════
//
// UNE SOURCE DE VERITE, UN COMPOSANT, ET RIEN D'AUTRE. L'application employait
// « RIR », « e1RM », « NEAT », « macros » sans les definir nulle part, ou en
// les redefinissant a l'endroit ou ils tombaient — ce qui revient au meme
// defaut avec plus de travail : deux explications du meme mot finissent
// toujours par diverger, et c'est celle qu'on ne relit pas qui reste fausse.
//
// LA STRUCTURE D'UNE ENTREE, et elle est faite pour en accueillir d'autres :
//   t : le titre affiche.
//   d : la definition. VINGT MOTS AU PLUS, au tutoiement — regle tenue par une
//       assertion, pas par la bonne volonte. Au-dela on ecrit un article, et
//       un article ne se lit pas au milieu d'une serie.
//   p : la ligne « en pratique », facultative. Elle dit quoi FAIRE la ou d dit
//       ce que c'est. Les deux ne se remplacent pas.
//   e : l'echelle, facultative, deux a quatre lignes. Elle n'existe que pour
//       ce qu'on NOTE : un chiffre qu'on doit choisir a besoin de ses reperes,
//       une notion qu'on lit n'en a pas besoin.
//
// ⚠ AJOUTER UNE ENTREE NE DEMANDE RIEN D'AUTRE QUE D'ECRIRE ICI. Le composant
// ne connait aucune cle : il lit t, d, p et e, et se tait sur ce qui manque.
// Une entree sans p ne rend pas de bloc vide, une entree sans e ne rend pas de
// tableau vide.
//
// ⚠ GELE, jusqu'aux lignes d'echelle. Les textes sont valides ; une definition
// qui derive d'une version a l'autre est exactement ce que ce catalogue existe
// pour empecher.
const RC_LEXIQUE=Object.freeze({
  rir:Object.freeze({
    t:'RIR (répétitions en réserve)',
    d:'Le nombre de répétitions que tu aurais encore pu faire après ta dernière.',
    p:'Vise RIR 2 sur tes premières séries, RIR 0 à 1 sur la dernière.',
    e:Object.freeze([Object.freeze(['RIR 0','Échec : pas une de plus']),
      Object.freeze(['RIR 1','Une encore en réserve']),
      Object.freeze(['RIR 2','Deux encore : intense mais contrôlé']),
      Object.freeze(['RIR 3+','Encore loin de l\'échec'])])}),
  rpe:Object.freeze({
    t:'RPE (intensité demandée par ton coach)',
    d:'Une note sur 10 fixée par ton coach pour cette série.',
    p:'Tu ne la règles pas : note ta charge, c\'est tout.'}),
  e1rm:Object.freeze({
    t:'Force max estimée (e1RM)',
    d:'La charge que tu pourrais sans doute soulever une seule fois, calculée depuis tes séries.',
    // R11 — la precision que l'encadre de l'onglet Perfs portait seul : le
    // calcul part des repetitions PREVUES. R29 — sauf sur une fourchette, ou
    // l'athlete note ce qu'il a fait (repsDone) : c'est alors ce chiffre-la.
    p:'Fiable jusqu\'à 12 répétitions, approximative au-delà. Jamais testée en vrai. Calculée sur les répétitions prévues au programme, ou sur celles que tu as notées quand l\'exercice a une fourchette.'}),
  douleur:Object.freeze({
    t:'Échelle de gêne',
    d:'Note ce que tu as ressenti pendant la série, pas après.',
    e:Object.freeze([Object.freeze(['1 à 2','À peine perceptible']),
      Object.freeze(['3','Gênant mais supportable']),
      Object.freeze(['4 à 5','Ça fait mal, ta technique se dégrade']),
      Object.freeze(['6','Je dois arrêter'])])}),
  neat:Object.freeze({
    t:'Activité hors sport (NEAT)',
    d:'Ce que tu dépenses en dehors de tes séances : marche, travail, gestes du quotidien.'}),
  macros:Object.freeze({
    t:'Macros',
    d:'Protéines, glucides et lipides : les trois familles qui composent tes calories.'}),
  volume:Object.freeze({
    t:'Volume',
    d:'La quantité de travail accumulée sur une période, muscle par muscle.'}),
  // La fiche du ⓘ de chaque carte de muscle, onglet Volume : ce que disent
  // les couleurs de la barre et le trait blanc.
  zones_volume:Object.freeze({
    t:'Lire la barre de volume',
    d:'La barre situe tes séries de la semaine par rapport aux repères de ce muscle.',
    p:'Le trait blanc marque le repère haut. Au-delà, la récupération devient difficile.',
    e:Object.freeze([Object.freeze(['Gris','Sous le minimum utile']),
      Object.freeze(['Bleu','Maintien : tu gardes ce que tu as']),
      Object.freeze(['Vert','Zone de progrès']),
      Object.freeze(['Orange','Volume élevé']),
      Object.freeze(['Rouge','Au-dessus du repère'])])}),
  surcharge:Object.freeze({
    t:'Surcharge progressive',
    d:'Augmenter un peu la charge dès que tu gardes des répétitions en réserve.',
    p:'RepCore le fait pour toi : la charge proposée monte toute seule.'}),
  masse_grasse:Object.freeze({
    t:'Masse grasse estimée',
    d:'Estimée depuis ton tour de taille, ton cou et ta taille (jamais mesurée).',
    // R11 — la note de methode de l'onglet Masse grasse, qui s'affichait en
    // permanence, vit desormais ici : la formule, les extremes, la tendance.
    p:'Formule US Navy : marge de 3 à 4 points, davantage aux extrêmes (très maigre ou très corpulent). Regarde la tendance entre deux bilans, pas le chiffre exact.'}),
  '1rm':Object.freeze({
    t:'1RM',
    d:'La charge maximale que tu pourrais soulever une seule fois.'}),
  // ── R10 ─────────────────────────────────────────────────────────────────
  // ⚠ DEUX DEFINITIONS ONT ETE ALIGNEES SUR LE CODE, et c'est la regle du lot :
  // on n'ecrit pas une definition que le calcul ne tient pas.
  // - assiduite : updateStreak ne credite une semaine que si les seances
  //   PREVUES au programme sont faites — pas « au moins une ».
  // - score_diete : en diete flexible, le jour se juge sur le journal compare
  //   aux cibles (jourDieteTenu), pas sur une reponse « oui ».
  assiduite:Object.freeze({
    t:'Semaines d\'assiduité',
    d:'Le nombre de semaines d\'affilée où tu as fait toutes les séances prévues à ton programme.'}),
  // LOT N4 : le cadre de l'assiette, sous celui des semaines.
  assiette:Object.freeze({
    t:'Jours dans ta cible',
    d:'Les jours d\'affilée où ton journal tient ta cible : calories à 7 % près, protéines atteintes.',
    p:'Un seul jour hors cible dans la semaine ne casse pas la série : il la met en pause. Deux, si. La journée en cours compte dès qu\'elle est tenue.'}),
  score_diete:Object.freeze({
    t:'Diète respectée',
    d:'La part des jours tenus : selon ta réponse du jour, ou ton journal comparé à tes cibles.',
    p:'Les jours non renseignés ne comptent ni en bien ni en mal.'}),
  reds:Object.freeze({
    t:'RED-S (déficit énergétique relatif)',
    d:'Des signes que l\'apport alimentaire ne couvre plus la dépense : sommeil, cycle, blessures, humeur.'}),
  plateau:Object.freeze({
    t:'Plateau',
    d:'Aucun nouveau maximum sur cet exercice depuis plusieurs semaines.'}),
  // ── LES QUATRE ZONES DE VOLUME (23/09/2026) ─────────────────────────────
  // Elles teintent la silhouette « Évolution » et colorent la grille de
  // charge ; leur nom — « MEV-MAV » — ne dit rien à qui ne connaît pas les
  // sigles, et la légende était muette. Kevin : « donne la possibilité de
  // cliquer sur chacun et d'avoir une définition sur ce que ça signifie ».
  //
  // ⚠ LES DÉFINITIONS DISENT CE QUE LE CODE FAIT, pas ce qu'un manuel
  //   raconte : les bornes sont celles de _repereDe — sous le MEV, du MEV au
  //   MAV, du MAV au MRV inclus, au-delà du MRV.
  // ⚠ ET AUCUNE NE PRESCRIT. Elles se lisent sur l'écran de l'athlète comme
  //   sur celui du coach, et c'est le coach qui décide d'un volume : elles
  //   disent où l'on est, jamais ce qu'il faut faire.
  zone_sous_mev:Object.freeze({
    t:'sous-MEV (minimum efficace)',
    d:'Moins de séries que le minimum efficace : le muscle garde ce qu\'il a, sans de quoi progresser.',
    p:'Les trois seuils changent d\'un muscle à l\'autre, et peuvent être ajustés sur les retours de séance ou fixés par le coach.'}),
  zone_mev_mav:Object.freeze({
    t:'MEV-MAV (minimum à adapté)',
    d:'Au-dessus du minimum efficace, sous le volume adapté : de quoi entretenir, et progresser lentement.',
    p:'Les trois seuils changent d\'un muscle à l\'autre, et peuvent être ajustés sur les retours de séance ou fixés par le coach.'}),
  zone_mav_mrv:Object.freeze({
    t:'MAV-MRV (adapté à maximum récupérable)',
    d:'Du volume adapté jusqu\'au maximum récupérable : la zone où le muscle progresse le mieux.',
    p:'Les trois seuils changent d\'un muscle à l\'autre, et peuvent être ajustés sur les retours de séance ou fixés par le coach.'}),
  zone_sur_mrv:Object.freeze({
    t:'sur-MRV (au-delà du maximum récupérable)',
    d:'Plus de séries que ce que la récupération suit : le travail s\'accumule sans se transformer.',
    p:'Les trois seuils changent d\'un muscle à l\'autre, et peuvent être ajustés sur les retours de séance ou fixés par le coach.'})
});
// ⚠ ON LIT PAR hasOwnProperty, JAMAIS PAR L'ACCESSEUR. RC_LEXIQUE est un
// objet litteral : il herite d'Object.prototype, et rcInfo('toString') y
// trouvait une fonction — donc une entree « vraie », donc un bouton mort dont
// le titre disait « undefined ». Une cle viendra un jour d'une donnee et non
// d'un litteral ; elle n'a pas a pouvoir atteindre le prototype.
// Trouve par l'assertion « rcInfo rend une pastille, ou rien du tout ».
function _lexEntree(cle){
  return (typeof cle==='string'&&Object.prototype.hasOwnProperty.call(RC_LEXIQUE,cle))
    ?RC_LEXIQUE[cle]:null;
}
// PURE. La pastille : un ⓘ de 13 px, et une zone tactile autour de lui.
// ⚠ UNE CLE INCONNUE REND LA CHAINE VIDE, jamais une erreur et jamais un
// bouton mort. C'est ce qui permet de l'appeler sans precaution depuis
// n'importe quel gabarit : `${rcInfo(cle)}` ne peut pas casser la ligne qui
// l'accueille, meme si la cle se trompe ou disparait.
function rcInfo(cle){
  const e=_lexEntree(cle);
  if(!e) return '';
  return '<button type="button" class="rc-i hit44" '
    +'onclick="rcInfoOuvrir(\''+cle+'\')" '
    +'aria-label="Qu\'est-ce que '+escapeHtml(e.t)+' ?">ⓘ</button>';
}
// L'OUVERTURE. Une cle inconnue n'ouvre RIEN : une feuille vide serait pire
// qu'une pastille absente, parce qu'elle promet une reponse.
function rcInfoOuvrir(cle){
  const e=_lexEntree(cle);
  if(!e) return null;
  const z=document.getElementById('rc-lexique-corps');
  if(!z) return null;
  // ⚠ TOUT PASSE PAR escapeHtml. Les textes viennent d'une constante gelee
  // aujourd'hui ; le jour ou une entree viendra d'ailleurs — R10 en ajoutera —
  // le composant n'aura pas a etre relu pour rester sur.
  // R11 — LE TITRE EN DEUX VOIX. Le nom en capitales de titre, sa
  // parenthese — « (répétitions en réserve) », « (e1RM) » — en texte courant,
  // plus petit : c'est une precision, pas un second titre. Le texte lu reste
  // mot pour mot celui du catalogue ; s'il n'a pas cette forme, il passe
  // tel quel.
  const _tm=/^(.*\S) (\([^()]+\))$/.exec(e.t);
  const titre=_tm
    ?escapeHtml(_tm[1])+' <span class="rci-t2">'+escapeHtml(_tm[2])+'</span>'
    :escapeHtml(e.t);
  let h='<div class="rci-t" id="rc-lexique-titre">'+titre+'</div>'
    +'<div class="rci-d">'+escapeHtml(e.d)+'</div>';
  // « En pratique » n'est pas la suite de la definition, c'est un autre
  // registre : l'une dit ce que c'est, l'autre dit quoi faire.
  // R11 — l'etiquette est sur sa propre ligne, plus de tiret pour la lier.
  if(e.p) h+='<div class="rci-p"><b>En pratique</b><span>'+escapeHtml(e.p)+'</span></div>';
  // DEUX COLONNES, SANS EN-TETE. Un en-tete sur quatre lignes de reperes
  // ajouterait une ligne a lire pour n'annoncer que « libelle » et « sens ».
  if(e.e&&e.e.length){
    h+='<table class="rci-e"><tbody>'+e.e.map(l=>'<tr>'
      +'<th scope="row">'+escapeHtml(l[0])+'</th>'
      +'<td>'+escapeHtml(l[1])+'</td></tr>').join('')+'</tbody></table>';
  }
  z.innerHTML=h;
  const f=_feuilleOuvrir('rc-lexique');
  // Le focus part sur la SORTIE : au clavier comme au lecteur d'ecran, on
  // arrive dans la feuille, et le seul geste possible est d'en sortir.
  try{ const b=document.getElementById('rc-lexique-ok'); if(b) b.focus({preventScroll:true}); }catch(x){}
  return f;
}
function rcInfoFermer(tout_de_suite){ _feuilleFermer('rc-lexique',tout_de_suite); }
// ── Système d'icônes SVG inline (style Lucide / Feather) ─────────────────────
const ICONS={
  // Réseau coupé (états d'erreur, build 1898) : le wifi barré, au trait.
  'wifi-off':'<line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.68"/><path d="M5 12.86a10 10 0 0 1 5.17-2.69"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
  // Une petite hache (« Défie un pote », 28/09/2026), dessin Lucide « axe » (licence ISC).
  hache:'<path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" stroke-linecap="round" stroke-linejoin="round"/>',
  // Des barres qui montent et une flèche (mesure « Progression » des duels).
  progres:'<rect x="4" y="15" width="3.2" height="6" fill="currentColor" stroke="none"/><rect x="10" y="12" width="3.2" height="9" fill="currentColor" stroke="none"/><rect x="16" y="9" width="3.2" height="12" fill="currentColor" stroke="none"/><polyline points="3 11 9 6 13 8 20 3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="16 3 20 3 20 7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  // Deux haches croisées, têtes pleines (bandeau « Défie un pote », 28/09/2026) : la hache Lucide et son miroir.
  haches:'<g transform="rotate(38 12 13)"><path d="M12 3v19.5" stroke-width="2.4" stroke-linecap="round"/><path d="M11.2 4.4 15 4.8 16.6 1.6c3 1.4 4.2 4.6 3.3 8.2-2-.7-3.3-1.2-4.9-1.2l-3.8.4z" fill="currentColor" stroke-linejoin="round" stroke-width="1.2"/></g><g transform="rotate(-38 12 13) matrix(-1 0 0 1 24 0)"><path d="M12 3v19.5" stroke-width="2.4" stroke-linecap="round"/><path d="M11.2 4.4 15 4.8 16.6 1.6c3 1.4 4.2 4.6 3.3 8.2-2-.7-3.3-1.2-4.9-1.2l-3.8.4z" fill="currentColor" stroke-linejoin="round" stroke-width="1.2"/></g>',
  // Le logo Instagram, au trait (bouton « Mon avant/après », 28/09/2026).
  instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/>',
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  // Suppression : la corbeille dit ce que fait le bouton là où une croix
  // signifierait « fermer ». Ajoutée au jeu plutôt qu'inlinée, pour que le
  // prochain bouton de suppression n'en réinvente pas une variante.
  trash:'<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  'chart-bar':'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  // ── CINQ TRAITS POUR « À TRAITER » ────────────────────────────────────────
  // Le bloc portait des emojis. Un emoji est rendu par la POLICE DU SYSTÈME :
  // il change de dessin et de couleur d'un téléphone à l'autre, il ignore la
  // palette, et il pose des visages là où il faut des signaux. Ces cinq-là
  // manquaient au jeu ; les onze autres y étaient déjà.
  flag:'<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  activity:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  'trending-down':'<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  'user-plus':'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  utensils:'<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><line x1="7" y1="2" x2="7" y2="22"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3"/><line x1="21" y1="15" x2="21" y2="22"/>',
  video:'<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'trending-up':'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  pill:'<path d="M10.5 20.5 3.5 13.5a5 5 0 1 1 7-7l7 7a5 5 0 1 1-7 7z"/><line x1="14" y1="14" x2="10" y2="10"/>',
  coffee:'<path d="M17 8h1a4 4 0 0 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  folder:'<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  dumbbell:'<line x1="6" y1="12" x2="18" y2="12"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="18" y1="8" x2="18" y2="16"/><line x1="3" y1="9.5" x2="7" y2="9.5"/><line x1="3" y1="14.5" x2="7" y2="14.5"/><line x1="17" y1="9.5" x2="21" y2="9.5"/><line x1="17" y1="14.5" x2="21" y2="14.5"/>',
  bell:'<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  'check-circle':'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'x-circle':'<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  clipboard:'<rect x="9" y="2" width="6" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  'refresh-cw':'<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  'message-circle':'<path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>',
  smartphone:'<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  cloud:'<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  // Le panier et l'oeil : deux gestes de la boutique — ce qui s'achete, ce qui
  // se relit. Ajoutes AU JEU plutot qu'inlines dans la carte, comme la
  // corbeille au-dessus et pour la meme raison : le prochain bouton d'achat ne
  // doit pas en redessiner une variante.
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  key:'<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  'plus-circle':'<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
  zap:'<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  // L'haltere des proteines, l'epi des glucides, la goutte des lipides.
  // L'HALTERE ET NON UN BRAS FLECHI. Cinq silhouettes de bras ont ete dessinees
  // et rendues a la taille d'emploi -- dix-sept pixels, au sommet d'un anneau :
  // toutes se lisent comme une botte. Celle-ci se lit du premier coup. C'est
  // une variante EPAISSE de l'icone `dumbbell` deja au jeu : les barres y sont
  // plus courtes et les disques plus hauts, parce qu'a cette taille les traits
  // fins de l'originale se referment les uns sur les autres.
  haltere:'<path d="M7 12h10"/><path d="M7 7.5v9"/><path d="M17 7.5v9"/><path d="M3.6 9.8v4.4"/><path d="M20.4 9.8v4.4"/>',
  // TROIS PAIRES DE GRAINS PLEINS, et non des contours : a dix-huit pixels un
  // grain dessine au trait se referme sur lui-meme et vire au point.
  wheat:'<path d="M12 21.5v-5"/><path d="M12 16c-3 0-4.8-1.9-4.8-4.9 3 0 4.8 1.9 4.8 4.9z" fill="currentColor" stroke="none"/><path d="M12 16c3 0 4.8-1.9 4.8-4.9-3 0-4.8 1.9-4.8 4.9z" fill="currentColor" stroke="none"/><path d="M12 10.2c-3 0-4.8-1.9-4.8-4.9 3 0 4.8 1.9 4.8 4.9z" fill="currentColor" stroke="none"/><path d="M12 10.2c3 0 4.8-1.9 4.8-4.9-3 0-4.8 1.9-4.8 4.9z" fill="currentColor" stroke="none"/><path d="M12 5.6V2.5"/>',
  droplet:'<path d="M12 2.6 7.2 8.4a6.2 6.2 0 1 0 9.6 0z"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  shoe:'<path d="M2 17h18a2 2 0 0 0 2-2c0-1.6-1.2-2.3-2.8-2.9l-4.4-1.7a3 3 0 0 1-1.3-1L11.6 6.4a1.4 1.4 0 0 0-2.2-.2L7.6 8.1 2 8.1z"/><path d="M2 17v2h20v-2"/><path d="M7.6 8.1 9.3 10M10.6 9.2l1.7 1.9"/>',
  sun:'<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.2" y1="4.2" x2="6" y2="6"/><line x1="18" y1="18" x2="19.8" y2="19.8"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.2" y1="19.8" x2="6" y2="18"/><line x1="18" y1="6" x2="19.8" y2="4.2"/>',
  leaf:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  pencil:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  'alert-triangle':'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'edit-2':'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  // Saliere : le corps, son epaulement, le bouchon et trois grains. La
  // maquette de la carte du jour en demandait une ; c est la seule des six
  // icones qui n existait pas deja.
  salt:`<path d="M8 21h8a1 1 0 0 0 1-1.1l-1-9.4A2 2 0 0 0 14 8.7h-4a2 2 0 0 0-2 1.8l-1 9.4A1 1 0 0 0 8 21z"/><path d="M9.5 8.7V6.5a2.5 2.5 0 0 1 5 0v2.2"/><line x1="11" y1="3.4" x2="11" y2="4.2"/><line x1="13" y1="3.4" x2="13" y2="4.2"/><line x1="12" y1="2" x2="12" y2="2.8"/>`,
  // ── Six icones pour la carte des objectifs alimentaires ──────────────
  // Maquette de Kevin du 24/08/2026. Cinq viennent du meme jeu que les
  // quarante-quatre autres ; le biceps, lui, n existe dans aucun jeu de
  // pictogrammes au trait et est dessine ici.
  crosshair:'<circle cx="12" cy="12" r="9"/><line x1="12" y1="1.5" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22.5" y2="12"/><circle cx="12" cy="12" r="2.5"/>',
  calendar:'<rect x="3" y="4.5" width="18" height="17" rx="2.5"/><line x1="16" y1="2" x2="16" y2="7"/><line x1="8" y1="2" x2="8" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'chevron-right':'<polyline points="9 5 16 12 9 19"/>',
  sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  info:'<circle cx="12" cy="12" r="9.5"/><line x1="12" y1="16.5" x2="12" y2="11"/><line x1="12" y1="7.5" x2="12.01" y2="7.5"/>',
  // Le bras flechi : le poing en haut a gauche, l avant-bras qui descend, le
  // coude, le bras qui part a droite, et le renflement du biceps par-dessus.
  biceps:'<path d="M3 19h8a5 5 0 0 0 5-5v-3"/><path d="M16 11V7a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-3"/><path d="M3 19v-2.5C3 13 6 11 9.5 11H16"/>',
  // Les deux gestes de l apercu de seance. Memes traces que ceux deja inlines
  // dans la carte hebdomadaire : la fleche descend pour telecharger, monte
  // pour partager, sur la meme base de plateau.
  download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  share:'<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>',
  moon:'<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  trophy:'<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
};
// ── LES ICONES QUI REMPLACENT LES EMOJIS DE L'INTERFACE (01/10/2026) ─────────
// Un emoji est dessine par la police du systeme : il change d'un telephone a
// l'autre et ignore la palette. Ces noms francais sont ceux que
// scripts/emojis.py pose a sa place (✓ coche, ✕ croix, ⚡ eclair…). Meme
// trait que le reste du jeu : viewBox 24, trace au trait, rendu par icon().
// Celles qui existaient sous un nom anglais reprennent le meme dessin.
Object.assign(ICONS,{
  eclair:ICONS.zap, muscle:ICONS.biceps, flamme:ICONS.flame, cafe:ICONS.coffee,
  gelule:ICONS.pill, cible:ICONS.target, coche:ICONS.check, croix:ICONS.x,
  alerte:ICONS['alert-triangle'],
  // La regle graduee (mesures en cm du bilan de depart), dessin Lucide « ruler » (ISC).
  regle:'<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  // La tasse sans fumee, son fil et son etiquette : le the, distinct du cafe.
  the:'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 9V5h3"/><rect x="11" y="3.5" width="3" height="3.5"/><line x1="3" y1="22" x2="19" y2="22"/>',
  bouclier:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  coeur:'<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  cadeau:'<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  // L'etoile : au trait ; pleine, elle porte la classe .ico-plein (favori).
  etoile:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  // Trois de plus, pour index.html : le menu du navigateur (☰), l'echange de
  // compte ou de superset (⇄), la carte bancaire (💳) ; et l'enveloppe (✉ 📭).
  menu:'<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  echange:'<polyline points="17 3 21 7 17 11"/><line x1="21" y1="7" x2="7" y2="7"/><polyline points="7 13 3 17 7 21"/><line x1="3" y1="17" x2="17" y2="17"/>',
  'carte-bancaire':'<rect x="1.5" y="4.5" width="21" height="15" rx="2"/><line x1="1.5" y1="10" x2="22.5" y2="10"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22 6 12 13 2 6"/>',
});
// UNE ICONE DANS UN TEXTE BRUT. toast() et les libelles poses par textContent
// n'acceptent pas de balisage (et ne doivent pas : ils portent des noms
// d'athletes). ICO.coche est un MARQUEUR (deux caracteres d'usage prive autour
// du nom) ; _texteIco(el,texte) ecrit le texte en noeuds texte et chaque
// marqueur en icone. Un marqueur qui atteint un autre puits (journal, presse-
// papiers) s'y lit comme rien : _sansIco(texte) le retire.
/** @type {Record<string,string>} */
const ICO=Object.freeze(Object.fromEntries(Object.keys(ICONS).map(n=>[n,'\uE000'+n+'\uE001'])));
function _texteIco(el,texte,taille){
  if(!el) return;
  el.textContent='';
  String(texte==null?'':texte).split(/\uE000([\w-]+)\uE001/).forEach((p,i)=>{
    if(i%2){ if(ICONS[p]) el.insertAdjacentHTML('beforeend',icon(p,taille||14)); }
    else if(p) el.appendChild(document.createTextNode(p));
  });
}
function _sansIco(texte){ return String(texte==null?'':texte).replace(/\s?\uE000[\w-]+\uE001/g,''); }
function _icoG(nom,cx,cy,taille,couleur,epaisseur){
  const p=ICONS[nom]; if(!p) return '';
  const k=taille/24;
  return '<g transform="translate('+(cx-taille/2).toFixed(2)+' '+(cy-taille/2).toFixed(2)+') scale('+k.toFixed(4)+')"'
    +' fill="none" stroke="'+couleur+'" stroke-width="'+(epaisseur||2)+'" stroke-linecap="round" stroke-linejoin="round">'
    +p+'</g>';
}
function icon(name,size=20){const s=ICONS[name];if(!s) return '';return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" style="width:'+size+'px;height:'+size+'px;display:inline-block;vertical-align:middle;flex-shrink:0">'+s+'</svg>';}
const ILLUS={
  dumbbell:`<line x1="24" y1="48" x2="72" y2="48" stroke-dasharray="4.5 3"/><line x1="24" y1="32" x2="24" y2="64"/><line x1="12" y1="38" x2="28" y2="38"/><line x1="12" y1="58" x2="28" y2="58"/><line x1="72" y1="32" x2="72" y2="64"/><line x1="68" y1="38" x2="84" y2="38"/><line x1="68" y1="58" x2="84" y2="58"/><line x1="48" y1="72" x2="48" y2="80" stroke-width="1.5"/><line x1="44" y1="76" x2="52" y2="76" stroke-width="1.5"/>`,
  pill:`<rect x="14" y="36" width="68" height="24" rx="12" stroke-dasharray="5 3"/><line x1="48" y1="36" x2="48" y2="60" stroke-dasharray="2 2.5" opacity="0.5"/><line x1="48" y1="70" x2="48" y2="78" stroke-width="1.5"/><line x1="44" y1="74" x2="52" y2="74" stroke-width="1.5"/>`,
  coffee:`<path d="M28,38 L68,38 L64,72 Q63,76 59,76 L37,76 Q33,76 32,72 Z" stroke-dasharray="5 3"/><path d="M68,50 Q80,50 80,59 Q80,68 68,68" stroke-dasharray="4 3"/><line x1="22" y1="80" x2="74" y2="80" stroke-width="1.5"/><line x1="48" y1="24" x2="48" y2="32" stroke-width="1.5"/><line x1="44" y1="28" x2="52" y2="28" stroke-width="1.5"/>`,
  clipboard:`<rect x="20" y="24" width="56" height="60" rx="4" stroke-dasharray="5 3"/><path d="M36,24 L36,18 Q36,12 42,12 L54,12 Q60,12 60,18 L60,24"/><line x1="32" y1="42" x2="64" y2="42" stroke-dasharray="3 2.5"/><line x1="32" y1="52" x2="64" y2="52" stroke-dasharray="3 2.5"/><line x1="32" y1="62" x2="56" y2="62" stroke-dasharray="3 2.5" opacity="0.6"/>`,
  'trending-up':`<line x1="22" y1="22" x2="22" y2="76"/><line x1="22" y1="76" x2="74" y2="76"/><path d="M32,68 L45,56 L58,46 L69,32" stroke-dasharray="4 3"/><circle cx="32" cy="68" r="3.5"/><circle cx="45" cy="56" r="3.5"/><circle cx="58" cy="46" r="3.5"/><circle cx="69" cy="32" r="3.5"/>`,
  video:`<rect x="8" y="26" width="72" height="50" rx="6" stroke-dasharray="5 3"/><path d="M38,37 L38,59 L62,48 Z" stroke-linejoin="round" stroke-dasharray="5 3"/><line x1="66" y1="14" x2="66" y2="22" stroke-width="1.5"/><line x1="62" y1="18" x2="70" y2="18" stroke-width="1.5"/>`,
  users:`<circle cx="38" cy="38" r="14" stroke-dasharray="5 3"/><path d="M10,76 Q10,58 38,58 Q66,58 66,76" stroke-dasharray="5 3"/><circle cx="62" cy="33" r="9" stroke-dasharray="3.5 2.5" opacity="0.5"/><line x1="76" y1="16" x2="76" y2="24" stroke-width="1.5"/><line x1="72" y1="20" x2="80" y2="20" stroke-width="1.5"/>`,
  folder:`<path d="M14,40 L14,76 Q14,80 18,80 L78,80 Q82,80 82,76 L82,40 Q82,36 78,36 L50,36 Q46,36 44,32 L40,27 Q38,24 34,24 L18,24 Q14,24 14,28 Z" stroke-dasharray="5 3"/><line x1="48" y1="52" x2="48" y2="64"/><line x1="42" y1="58" x2="54" y2="58"/>`,
};
function illusIcon(name,size=96){const s=ILLUS[name];if(!s)return icon(name,Math.round(size*.58));return '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" style="width:'+size+'px;height:'+size+'px;display:block;margin:0 auto">'+s+'</svg>';}
// ══ L'ÉTAT VIDE, UNE SEULE FABRIQUE (build 1898) ══════════════════════════
// <div class="vide"> : icône 28 px à 40 %, titre facultatif (.t-carte), texte
// 12 px gris centré sur 280 px, CTA facultatif en .btn .btn-sm .btn-outline.
// Les classes etat/empty-state restent (les tests R13 et les sondes les lisent).
// L'icône ne grossit jamais au survol.
function emptyState(iconName,message,ctaLabel,ctaFn,wrapStyle,titre){
  const ico=iconName?(ILLUS[iconName]?illusIcon(iconName,28):icon(iconName,28)):'';
  const cta=(ctaLabel&&ctaFn)?`<button type="button" class="btn btn-sm btn-outline empty-cta" onclick="${ctaFn}">${ctaLabel}</button>`:'';
  const sa=wrapStyle?' style="'+wrapStyle+'"':'';
  return `<div class="vide etat empty-state"${sa}>${ico?`<div class="vide-ico empty-illus">${ico}</div>`:''}`
    +(titre?`<div class="t-carte vide-titre">${titre}</div>`:'')
    +`<div class="vide-texte">${message}</div>${cta}</div>`;
}
// ══ LES TROIS ETATS D'UN BLOC : VIDE, EN CHARGEMENT, EN ERREUR (01/10/2026) ══
// Meme structure et meme racine .etat que emptyState : un bloc qui attend, qui
// a echoue ou qui n'a rien a montrer occupe la meme place et se lit pareil.
// etatChargement : des lignes squelettes aux largeurs du fil du canal (62 %,
// 88 %, 35 %, puis de nouveau), avec fx-loop pour que prefers-reduced-motion
// coupe le balayage.
function etatChargement(lignes=3){
  const L=[62,88,35], n=Math.max(1,Math.min(8,Number(lignes)||3));
  let h='';
  for(let k=0;k<n;k++) h+='<div class="skeleton fx-loop" style="height:'+(k===0?15:11)+'px;width:'+L[k%3]+'%;margin:'+(k===0?'0 auto 10px':'0 auto 6px')+'"></div>';
  return '<div class="etat etat-chargement" aria-busy="true" aria-label="Chargement">'+h+'</div>';
}
// etatErreur : l'icone d'alerte, le message en --sub, et un seul geste,
// secondaire comme celui de emptyState. fnReessayer est une CHAINE posee dans
// un onclick entre guillemets doubles (meme regle que ctaFn).
function etatErreur(message,libelleReessayer,fnReessayer,titre){
  // La même forme que l'état vide ; « Réessayer » en .btn-sm.
  return emptyState('alerte',message,libelleReessayer,fnReessayer,null,titre)
    .replace('<div class="vide etat empty-state"','<div class="vide etat empty-state etat-erreur" role="alert"');
}
// ══ R13 — AUCUN ECRAN MORT ═══════════════════════════════════════════════
// Le bouton d'un etat vide est SECONDAIRE (.btn-outline .btn-sm) : il ne doit
// pas concurrencer l'action principale de l'ecran. ctaFn est une CHAINE posee
// dans un onclick entre guillemets doubles : elle n'en contient jamais.
//
// Les gestes ci-dessous verifient qu'ils menent quelque part AVANT d'y aller.
// Un bouton qui aboutit a un toast « rien a faire » est un cul-de-sac de plus.

// Le geste qui remplit un ecran de seances. Sur un compte neuf, aucun creneau
// n'est actif : openSessionPicker ne ferait qu'afficher un toast. On ouvre
// alors la gestion des seances, d'ou l'on choisit un programme.
function _etatVideSeances(u){
  let pret=false;
  try{ pret=((u&&u.sessions_config)||initSessionsConfig()).some(s=>s&&s.active); }catch(e){}
  return pret?['Démarrer ma première séance','openSessionPicker()']
             :['Préparer mes séances','loadSessionManager()'];
}
// La pesee est un geste de l'accueil, et il y est MASQUE a dessein dans trois
// cas : antecedent alimentaire, poids masque, deficit au palier de blocage.
// Meme garde que renderCartePesee : on ne propose pas ailleurs ce que
// l'accueil retire volontairement.
function _peseePossible(u){
  try{
    if(!u||aTCA(u)||u.masquerPoids) return false;
    if(paliersDeficit(u)==='blocage') return false;
  }catch(e){ return false; }
  return true;
}
// Ouvre l'accueil et pose le doigt sur le champ de poids : la carte de pesee,
// ou le point du jour quand c'est lui qui pose la question.
function ouvrirPeseeAccueil(){
  go('s-client-home');
  try{ loadClientHome(); }catch(e){}
  setTimeout(()=>{
    const i=document.getElementById('pesee-input')||document.getElementById('pdj-poids');
    if(!i) return;
    try{ i.scrollIntoView({block:'center'}); i.focus({preventScroll:true}); }catch(e){}
  },120);
}
// Le bouton d'envoi est deja sur l'ecran, en haut : on y amene le doigt.
// R17 — sur « Choisir une vidéo », et plus sur le champ du lien, qui est
// replie : le chemin le plus simple d'abord. On n'ouvre PAS le selecteur de
// fichiers d'office : le geste suivant reste celui de l'athlete.
function _focusEnvoiVideo(){
  const b=document.getElementById('vid-file-btn');
  if(!b) return;
  try{ b.scrollIntoView({block:'center'}); b.focus({preventScroll:true}); }catch(e){}
}
// Banque d'exercices du coach : tout ce qui filtre, remis a zero.
function _bqToutEffacer(){
  _bqFiltres={};
  const q=document.getElementById('bq-q'); if(q) q.value='';
  _bqRendre();
}
function setupScrollFade(el){if(!el||el._sfBound)return;el._sfBound=true;const par=el.parentElement;const badge=document.createElement('div');badge.style.cssText='position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.85);border:1px solid var(--border);color:var(--sub);font-size:var(--fs-xs);font-weight:800;font-family:Montserrat,sans-serif;letter-spacing:.5px;padding:2px 8px;border-radius:var(--r-3);pointer-events:none;transition:opacity var(--t-2);opacity:0;z-index:10;white-space:nowrap;line-height:1.5';par.appendChild(badge);const grad='linear-gradient(to right,#000 82%,transparent 100%)';const upd=()=>{const hidden=el.scrollWidth-el.scrollLeft-el.clientWidth;const hasMore=hidden>4;el.style.webkitMaskImage=hasMore?grad:'';el.style.maskImage=hasMore?grad:'';if(hasMore){let n=0;const tbl=el.querySelector('table');if(tbl){const row=tbl.querySelector('tr');if(row){const right=el.getBoundingClientRect().right;n=[...row.querySelectorAll('th,td')].filter(c=>c.getBoundingClientRect().left>=right-4).length;}}else{const right=el.getBoundingClientRect().right;n=[...el.children].filter(c=>c.getBoundingClientRect().left>=right-4).length;}badge.textContent=n>0?'+'+n:'';badge.style.opacity=n>0?'1':'0';}else{badge.style.opacity='0';}};el.addEventListener('scroll',upd,{passive:true});upd();}

// ─── List / Table generics ───────────────────────────────────────────────────
// renderDataList: flex rows with automatic border-bottom separator (removed on last child)
// rowRenderer(item, idx) → string | {html, onClick?, style?}
// opts: pad, gap, align, justify, border, hover, empty
function renderDataList(items,rowRenderer,opts={}){
  if(!items.length)return opts.empty||'';
  const{pad='12px 0',gap=12,align='center',justify='',border='var(--border)',hover=''}=opts;
  const jStr=justify?`justify-content:${justify};`:'';
  return items.map((item,i)=>{
    const last=i===items.length-1;
    const r=rowRenderer(item,i);
    const html=typeof r==='string'?r:r.html;
    const onC=typeof r==='object'&&r.onClick?` onclick="${r.onClick}"`:'';
    const xSt=typeof r==='object'&&r.style?r.style:'';
    // rc-ligne : le point d'ancrage du retrait anime. Aucune mise en forme n'y
    // est attachee — c'est une prise, pas un style.
    const xCls=` class="rc-ligne${typeof r==='object'&&r.cls?' '+r.cls:''}"`;
    const sep=last?'':`border-bottom:1px solid ${border};`;
    const hov=hover?` onmouseover="this.style.background='${hover}'" onmouseout="this.style.background=''"` :'';
    return `<div${xCls} style="display:flex;align-items:${align};gap:${gap}px;padding:${pad};${sep}${jStr}${xSt}"${onC}${hov}>${html}</div>`;
  }).join('');
}
// renderDataTable: <table> with sticky-capable first column and uniform header styling
// columns: string[]  rows: {label, labelBg?, labelColor?, values[], valueStyleFn?(v,ci,isEmpty)}[]
// opts: headerBg, headerColor, border, cellBorder, cellBorderSide('all'|'bottom'), stickyCol0,
//       firstColMinWidth, bodyLabelBg, pad, dataPad, wrapperStyle, mb, emptyVal, emptyColor, valueColor
function renderDataTable(columns,rows,opts={}){
  const{
    headerBg='var(--surface-2)',headerColor='var(--red)',
    border='#222',cellBorder='var(--surface-2)',cellBorderSide='all',
    stickyCol0=false,firstColMinWidth=null,bodyLabelBg=null,
    pad='5px 8px',dataPad=null,wrapperStyle='',mb='16px',
    emptyVal='-',emptyColor='var(--sub)',valueColor='var(--text)',
    // OPT-IN toutes les deux : ce rendu sert a plusieurs tableaux, qui n ont
    // pas a changer parce que celui des mensurations en avait besoin.
    zebre=false,   // une ligne sur deux legerement eclaircie
    unite='',      // suffixe d affichage, jamais stocke dans la donnee
    virgule=false, // build 1879 : « 76,2 » et non « 76.2 » (affichage seul)
  }=opts;
  const dp=dataPad||pad;
  const cbS=cellBorderSide==='bottom'?`border-bottom:1px solid ${cellBorder};`:`border:1px solid ${cellBorder};`;
  const fcmw=stickyCol0&&firstColMinWidth?`min-width:${firstColMinWidth};`:'';
  const sh=stickyCol0?'position:sticky;left:0;z-index:2;':'';
  const sd=stickyCol0?'position:sticky;left:0;z-index:1;':'';
  const thBase=`background:${headerBg};color:${headerColor};font-size:var(--fs-xs);font-weight:800;white-space:nowrap;border:1px solid ${border};text-transform:uppercase;letter-spacing:.5px;font-variant-numeric:tabular-nums;padding:${pad};`;
  const thead=`<thead><tr>${columns.map((col,i)=>`<th style="${thBase}text-align:${i===0?'left':'right'};${i===0?sh+fcmw:''}">${col}</th>`).join('')}</tr></thead>`;
  const tbody=`<tbody>${rows.map((row,ri)=>{
    // Le zebrage est pose sur la LIGNE, label compris : eclaircir les seules
    // cellules de valeurs aurait coupe la ligne en deux au lieu de la tenir.
    const zb=zebre&&(ri%2===1)?'rgba(255,255,255,.035)':'';
    const lBg=row.labelBg||(bodyLabelBg||headerBg);
    const lCol=row.labelColor||headerColor;
    const lSt=`background:${zb?`linear-gradient(${zb},${zb}),${lBg}`:lBg};color:${lCol};font-size:var(--fs-xs);font-weight:800;padding:${pad};white-space:nowrap;border:1px solid ${border};${sd}`;
    const cells=row.values.map((v,ci)=>{
      const empty=v===null||v===undefined||v===0||v==='0'||v==='';
      // L unite ne s ajoute JAMAIS a une case vide : « — cm » n a pas de sens.
      const display=empty?emptyVal:((virgule?String(v).replace(/(\d)\.(\d)/g,'$1,$2'):String(v))+(unite?' '+unite:''));
      const color=row.valueStyleFn?row.valueStyleFn(v,ci,empty):(empty?`color:${emptyColor};`:`color:${valueColor};`);
      return `<td style="font-size:var(--fs-xs);font-weight:700;padding:${dp};padding-right:14px;text-align:right;font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;white-space:nowrap;${cbS}${color}${zb?`background-image:linear-gradient(${zb},${zb});`:''}">${display}</td>`;
    }).join('');
    return `<tr><td style="${lSt}">${row.label}</td>${cells}</tr>`;
  }).join('')}</tbody>`;
  const ws=wrapperStyle?`${wrapperStyle};`:'';
  return `<div style="position:relative;margin-bottom:${mb}"><div style="overflow-x:auto;${ws}" data-scroll-fade><table style="border-collapse:collapse;min-width:100%">${thead}${tbody}</table></div></div>`;
}

// ======= DATA =======
// ── Compression image universelle ──
// Redimensionne et compresse en JPEG avant stockage localStorage
// `onError` est OPTIONNEL et arrive en cinquieme : les appels existants ne
// changent pas d'un iota. Sans lui, l'echec reste silencieux comme avant —
// mais il ne laisse plus son appelant suspendu, puisque celui-ci peut
// desormais le savoir.
//
// TROIS FACONS D'ECHOUER, toutes couvertes : le fichier illisible
// (reader.onerror), le contenu qui n'est pas une image decodable
// (img.onerror — c'est le cas d'un fichier renomme), et l'encodage qui
// abandonne faute de memoire sur une image enorme (toDataURL qui jette).
// Ce dernier survenait DANS un gestionnaire, donc personne ne le voyait.
function compressImage(file, maxPx, quality, cb, onError){
  // UN SEUL DES DEUX CHEMINS SORT. Un appelant qui rend un jeton dans chacun
  // le rendrait deux fois, et son compteur passerait sous zero.
  let fait=false;
  const echec=()=>{ if(fait) return; fait=true; if(typeof onError==='function') onError(); };
  const reader=new FileReader();
  reader.onerror=echec;
  reader.onload=ev=>{
    const img=new Image();
    img.onerror=echec;
    img.onload=()=>{
      let url;
      // Le try n'enveloppe QUE l'encodage : une exception venue de `cb`
      // lui-meme ne doit pas se faire passer pour une image illisible.
      try{
        let w=img.width,h=img.height;
        if(w>maxPx||h>maxPx){
          if(w>=h){h=Math.round(h*maxPx/w);w=maxPx;}
          else{w=Math.round(w*maxPx/h);h=maxPx;}
        }
        const canvas=document.createElement('canvas');
        canvas.width=w;canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        url=canvas.toDataURL('image/jpeg',quality);
      }catch(e){ echec(); return; }
      if(fait) return;
      fait=true;
      cb(url);
    };
    img.src=ev.target.result;
  };
  reader.readAsDataURL(file);
}

// ── Cloud sync (Firebase Realtime Database — auth requise via Email/Password) ──
// Écriture : idToken Firebase obligatoire (?auth=token sur chaque PUT /users/{emailKey}.json).
// Lecture  : idToken obligatoire lui aussi. pullUser CONSTRUIT bien une URL
//   sans ?auth quand le jeton manque, mais le serveur la refuse : .read exige
//   auth != null. Une lecture non authentifiee recoit 401 et pullUser retourne
//   null — verifie en interrogeant la base sans jeton. Il n'y a donc PAS de
//   « repli public » ; le commentaire precedent en promettait un, ce qui
//   laissait croire que l'app pouvait encore lire hors session.
// Regles REELLEMENT deployees (database.rules.json, deploye le 27/07/2026) :
//   - /users/{emailKey}  : lecture ET ecriture au titulaire du noeud, ou a son
//     coach (reconnu via data().coachEmailKey). AUCUNE restriction par champ,
//     hormis le .validate qui protege coachEmailKey lui-meme.
//   - /rc_codes/{code}   : lecture ET ECRITURE ouvertes a tout compte
//     authentifie. Ce n'est pas un oubli : sans serveur, la consommation d'un
//     code se fait depuis le client, qui doit donc pouvoir ecrire redeemed.
//   - /deleted_accounts  : ferme des deux cotes.
//   AUCUNE Cloud Function ne tourne : le plan Spark ne les execute pas, et
//   l'app est passee 100 % client. Toute mention d'un controle « serveur »
//   ailleurs dans ce fichier serait donc fausse.
// Bucket Firebase Storage du projet repcore-sync. Valeur relevée sur la
// configuration du projet elle-même (firebase apps:sdkconfig web), c'est-à-dire
// la source qu'affiche la console.
// Elle était écrite EN DEUX ENDROITS, avec DEUX VALEURS DIFFÉRENTES : l'upload
// de PDF visait « repcore-sync.appspot.com », l'upload de vidéo
// « repcore-sync.firebasestorage.app ». Les projets créés depuis fin 2024
// reçoivent le second suffixe ; le premier n'a jamais existé ici, et tout
// téléversement de PDF partait donc vers un bucket fantôme.
// Une seule constante, pour que les deux ne puissent plus diverger.
const STORAGE_BUCKET='repcore-sync.firebasestorage.app';
// ══ LA FUSION A TROIS VOIES DES DOSSIERS ════════════════════════════════════
//
// ⚠ LE DEFAUT QU'ELLE REPARE, MESURE LE 21/09/2026 SUR DEUX APPAREILS REELS.
//   Chaque envoi etait un PUT du document ENTIER. Le garde-fou « la version
//   distante est plus recente » ne se declenchait jamais : pushOne pose
//   updatedAt = maintenant AVANT de comparer, donc la copie locale gagnait
//   toujours. Consequences relevees au banc a deux navigateurs :
//
//     · le coach pose 2 350 kcal ; l'athlete, qui n'a pas encore redescendu,
//       se pese — son telephone renvoie son dossier perime et le serveur
//       retombe a 2 000. La descente suivante ne ramene rien : l'athlete est
//       devenue « la plus recente ». Modification du coach perdue pour de bon.
//     · l'athlete envoie une seance et un bilan ; le coach, perime, ajoute un
//       exercice — son envoi EFFACE la seance et le bilan du serveur.
//
//   Et la descente avait le meme travers : hors seances, bilans et videos,
//   tout le dossier passait en « le plus recent gagne ». Nutrition, programme,
//   phase, reponses aux bilans : ce que l'autre avait ecrit disparaissait des
//   que l'appareil avait touche a n'importe quoi entre-temps.
//
// ⚠ LE PRINCIPE, CELUI DE GIT. Chaque appareil retient l'EMPREINTE de la
//   derniere version du serveur qu'il a integree — sa « base ». A l'envoi comme
//   a la descente, champ par champ :
//     · je n'y ai pas touche depuis la base → je prends la valeur de l'autre ;
//     · l'autre n'y a pas touche → je garde la mienne ;
//     · les deux y ont touche → on descend d'un niveau, et au dernier niveau
//       celui qui ecrit maintenant l'emporte.
//   Aucune liste de champs « du coach » ou « de l'athlete » : une telle liste
//   aurait vieilli au premier champ ajoute, et le defaut serait revenu par la.
//
// ⚠ LES TABLEAUX A IDENTIFIANT SE FUSIONNENT ELEMENT PAR ELEMENT, ET CHAMP PAR
//   CHAMP DANS CHAQUE ELEMENT. Le coach ecrit A L'INTERIEUR des elements de
//   l'athlete — `reponseCoach` sur un bilan, `feedback` sur une video — et
//   l'athlete ajoute des photos au meme bilan. Fusionner le bilan comme un bloc
//   aurait perdu l'un ou l'autre.
//
// ⚠ ET LE VIDE AU SENS DE FIREBASE. La base ne stocke ni null, ni objet vide,
//   ni tableau vide. Un `nutrition:{}` pose localement et absent du serveur est
//   donc le MEME etat ; les compter comme differents aurait fait « gagner » un
//   objet vide contre les macros du coach.
const SYNC_PROFONDEUR=4;
const SYNC_SEP='';
// Les tableaux qui se fusionnent par identifiant, et comment on nomme chaque
// element. Les bilans n'ont pas d'identifiant : on reprend la clef que les
// pierres tombales emploient deja, date et type.
const SYNC_PAR_CLEF=Object.freeze({
  sessions:s=>(s&&s.id!=null)?('s:'+s.id):null,
  videos:  v=>(v&&v.id!=null)?('v:'+v.id):null,
  bilans:  b=>b?('b:'+String(b.date)+'|'+String(b.type||'')):null,
  // LES JOURNAUX, ELEMENT PAR ELEMENT (30/09/2026). Ils etaient des feuilles :
  // deux appareils qui pesaient chacun un jour different se disputaient le
  // tableau entier, et le dernier a ecrire effacait la pesee de l'autre.
  // Une entree par jour ('YYYY-MM-DD') : _recordWeight, _recordSteps, le
  // sommeil, l'energie et _sanJournalPoser remplacent l'entree du jour.
  weightLog:   e=>e&&e.date?('w:'+e.date):null,
  sleepLog:    e=>e&&e.date?('z:'+e.date):null,
  stepsLog:    e=>e&&e.date?('p:'+e.date):null,
  energieLog:  e=>e&&e.date?('e:'+e.date):null,
  fcReposLog:  e=>e&&e.date?('f:'+e.date):null,
  vfcLog:      e=>e&&e.date?('h:'+e.date):null,
  // Le journal de douleur du coach : horodate a la milliseconde, par athlete.
  journalDouleur:e=>e&&e.at!=null?('j:'+e.at+'|'+String(e.clientId||'')):null,
  historiqueDrapeaux:e=>e&&e.leve?('d:'+e.leve):null
});
// LES TABLEAUX « PAR INDEX » : une position, pas une identite. Les sept
// creneaux de sessions_config n'ont jamais d'id — le creneau 2 est le mardi.
// Fusionnes creneau par creneau (clef 'c:'+i), ils redeviennent un tableau
// ORDONNE PAR INDEX, jamais trie par date.
const SYNC_PAR_INDEX=Object.freeze(['sessions_config']);
// Le champ qui ordonne chaque journal a la reconstruction (defaut : date).
const SYNC_TRI=Object.freeze({journalDouleur:'at',historiqueDrapeaux:'leve'});
// PURE. Compare deux valeurs d'ordre : numerique si les deux sont des nombres
// (seances : Date.now()), sinon en chaine ('YYYY-MM-DD' se trie tel quel).
function _syncOrdre(va,vb){
  const na=typeof va==='number'&&isFinite(va), nb=typeof vb==='number'&&isFinite(vb);
  if(na&&nb) return va-vb;
  if(na!==nb) return na?-1:1;
  const sa=va==null?'':String(va), sb=vb==null?'':String(vb);
  return sa<sb?-1:(sa>sb?1:0);
}
function _syncTrier(k,l){
  const f=SYNC_TRI[k]||'date';
  return l.sort((a,b)=>_syncOrdre(a&&a[f],b&&b[f]));
}
// L'horodatage n'est pas une donnee : il est recalcule a chaque envoi.
const SYNC_HORS_FUSION=Object.freeze(['updatedAt','_syncMaj']);
const SYNC_VIDE='0';
function _syncFnv(s){
  let h=0x811c9dc5;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); }
  return (h>>>0).toString(36);
}
function _syncEstObjet(v){
  return v!==null&&typeof v==='object'&&!Array.isArray(v);
}
// PURE. La forme canonique d'une valeur : clefs triees, vides elagues — ce
// que Firebase en garderait.
function _syncCanon(v){
  if(v===undefined||v===null) return undefined;
  if(typeof v==='number') return isFinite(v)?v:undefined;
  if(typeof v!=='object') return v;
  if(Array.isArray(v)){
    if(!v.length) return undefined;
    return v.map(x=>{ const c=_syncCanon(x); return c===undefined?null:c; });
  }
  const o={};
  for(const k of Object.keys(v).sort()){
    const c=_syncCanon(v[k]);
    if(c!==undefined) o[k]=c;
  }
  return Object.keys(o).length?o:undefined;
}
// PURE. Les tableaux a identifiant deviennent des objets indexes, pour que la
// fusion les traite comme n'importe quel objet. Rend une copie de surface.
function _syncVersArbre(doc){
  if(!_syncEstObjet(doc)) return doc;
  const t=Object.assign({},doc);
  for(const k of Object.keys(SYNC_PAR_CLEF)){
    let a=t[k];
    if(a==null) continue;
    // Firebase rend parfois un tableau sous forme d'objet {0:…,1:…}.
    if(_syncEstObjet(a)) a=Object.values(a);
    if(!Array.isArray(a)) continue;
    const m={};
    for(const x of a){
      if(x==null) continue;
      let c=SYNC_PAR_CLEF[k](x);
      if(c==null) c='x:'+_syncFnv(JSON.stringify(_syncCanon(x))||'');
      if(!(c in m)) m[c]=x;
    }
    t[k]=m;
  }
  for(const k of SYNC_PAR_INDEX){
    let a=t[k];
    if(a==null) continue;
    const m={};
    if(Array.isArray(a)) a.forEach((x,i)=>{ if(x!=null) m['c:'+i]=x; });
    else if(_syncEstObjet(a)) for(const i of Object.keys(a)){ if(/^\d+$/.test(i)&&a[i]!=null) m['c:'+i]=a[i]; }
    else continue;
    t[k]=m;
  }
  return t;
}
// PURE. L'inverse : les objets indexes redeviennent des tableaux, dans
// l'ordre chronologique.
function _syncDepuisArbre(t){
  if(!_syncEstObjet(t)) return t;
  const d=Object.assign({},t);
  for(const k of Object.keys(SYNC_PAR_CLEF)){
    const m=d[k];
    if(!_syncEstObjet(m)) continue;
    // ⚠ PAR CHAMP ET SANS Number() : un 'YYYY-MM-DD' donnait NaN, donc 0, et
    //   les journaux gardaient un ordre de hasard.
    d[k]=_syncTrier(k,Object.values(m).filter(x=>x!=null));
  }
  for(const k of SYNC_PAR_INDEX){
    const m=d[k];
    if(!_syncEstObjet(m)) continue;
    // PAR INDEX : le creneau i revient a la place i. Un creneau absent des deux
    // cotes laisse un trou (null), que _aplatirSessionsConfig sait combler.
    const out=[];
    for(const c of Object.keys(m)){
      const i=/^c:(\d+)$/.exec(c);
      if(i&&m[c]!=null) out[Number(i[1])]=m[c];
    }
    for(let i=0;i<out.length;i++) if(out[i]===undefined) out[i]=null;
    d[k]=out;
  }
  return d;
}
// PURE. Carte chemin → empreinte de chaque noeud, jusqu'a SYNC_PROFONDEUR.
// Empreinte de Merkle : celle d'un objet se calcule sur celles de ses
// enfants, si bien que tout le dossier se parcourt UNE fois.
function _syncCarte(t){
  const out={};
  const rec=(v,p,prof)=>{
    let h;
    if(_syncEstObjet(v)&&prof<SYNC_PROFONDEUR){
      const parts=[];
      for(const k of Object.keys(v).sort()){
        if(!p&&SYNC_HORS_FUSION.indexOf(k)>=0) continue;
        const hk=rec(v[k],p?(p+SYNC_SEP+k):k,prof+1);
        if(hk!==SYNC_VIDE) parts.push(k+'='+hk);
      }
      h=parts.length?_syncFnv('{'+parts.join(',')+'}'):SYNC_VIDE;
    } else {
      const c=_syncCanon(v);
      h=(c===undefined)?SYNC_VIDE:_syncFnv(JSON.stringify(c));
    }
    out[p]=h;
    return h;
  };
  rec(t,'',0);
  return out;
}
// PURE. Les empreintes d'un dossier tel que le serveur le porte : c'est ce
// qu'un appareil retient comme base.
function syncEmpreintes(doc){ return _syncCarte(_syncVersArbre(doc)); }
/**
 * PURE. La fusion a trois voies de deux versions d'un dossier.
 *
 * @param {Object|null} base    empreintes de la derniere version du serveur
 *                              integree par CET appareil ; null s'il n'en a
 *                              aucune — alors la version locale l'emporte,
 *                              exactement comme avant ce correctif.
 * @param {Object} local        la version de cet appareil
 * @param {Object} distant      la version du serveur
 * @returns {Object}            le dossier fusionne, pierres tombales appliquees
 */
// La clef de pierre tombale de chaque element (voir marquerSupprime) : l'id
// pour une seance ou une video, « date|type » pour un bilan.
const SYNC_CLEF_TOMBE=Object.freeze({
  sessions:s=>(s&&s.id!=null)?String(s.id):null,
  videos:  v=>(v&&v.id!=null)?String(v.id):null,
  bilans:  b=>b?(String(b.date)+'|'+String(b.type||'')):null
});
function _syncTableau(a){ return Array.isArray(a)?a:(_syncEstObjet(a)?Object.values(a):[]); }
/** PURE. Les pierres tombales reunies de plusieurs dossiers : {type:Set}. */
function syncTombes(...docs){
  const out={sessions:new Set(),videos:new Set(),bilans:new Set()};
  for(const d of docs){
    const s=(d&&d.supprimes)||{};
    for(const k of Object.keys(out)) if(_syncEstObjet(s[k])) for(const c of Object.keys(s[k])) out[k].add(String(c));
  }
  return out;
}
/** PURE. Une copie de `doc` sans les elements que `tombes` designe : ce que le
 *  serveur DOIT encore porter apres un envoi legitime. */
function syncSansTombes(doc,tombes){
  if(!_syncEstObjet(doc)) return doc;
  const out=Object.assign({},doc);
  for(const k of Object.keys(SYNC_CLEF_TOMBE)){
    if(doc[k]==null) continue;
    out[k]=_syncTableau(doc[k]).filter(x=>{ const c=x!=null?SYNC_CLEF_TOMBE[k](x):null; return x!=null&&!(c&&tombes[k].has(c)); });
  }
  return out;
}
/**
 * PURE. LA FUSION SANS BASE (30/09/2026). Sans base, syncFusion rend le local
 * tel quel : la premiere synchro d'un appareil neuf, ou d'une base perdue,
 * ecrasait donc le serveur par une copie locale qui n'avait jamais vu ses
 * seances. Ici, rien ne se perd :
 *   • sessions, videos, bilans (SYNC_PAR_CLEF) : UNION par clef, local
 *     d'abord, puis les pierres tombales des DEUX cotes appliquees ;
 *   • supprimes : union des pierres, date la plus recente ;
 *   • tout autre champ : le distant si le local est vide ou absent, sinon le
 *     local ; updatedAt : le plus grand.
 */
function syncUnionSansBase(local,distant){
  if(!_syncEstObjet(distant)) return local;
  if(!_syncEstObjet(local)) return distant;
  const out={};
  const tombes=syncTombes(local,distant);
  for(const k of new Set([...Object.keys(distant),...Object.keys(local)])){
    if(k in SYNC_PAR_CLEF){
      const vus=new Set(), l=[];
      for(const x of _syncTableau(local[k]).concat(_syncTableau(distant[k]))){
        if(x==null) continue;
        let c=SYNC_PAR_CLEF[k](x);
        if(c==null) c='x:'+_syncFnv(JSON.stringify(_syncCanon(x))||'');
        if(vus.has(c)) continue;
        vus.add(c);
        // Seuls sessions, videos et bilans ont des pierres tombales.
        const ft=SYNC_CLEF_TOMBE[k], t=ft?ft(x):null;
        if(t&&tombes[k]&&tombes[k].has(t)) continue;
        l.push(x);
      }
      _syncTrier(k,l);
      if(l.length||local[k]!==undefined||distant[k]!==undefined) out[k]=l;
    } else if(k==='supprimes'){
      const m={};
      for(const src of [distant.supprimes,local.supprimes]){
        if(!_syncEstObjet(src)) continue;
        for(const t of Object.keys(src)){
          if(!_syncEstObjet(src[t])) continue;
          m[t]=m[t]||{};
          for(const c of Object.keys(src[t])) m[t][c]=Math.max(Number(m[t][c])||0,Number(src[t][c])||0);
        }
      }
      out.supprimes=m;
    } else if(k==='updatedAt'){
      out.updatedAt=Math.max(Number(local.updatedAt)||0,Number(distant.updatedAt)||0);
    } else {
      out[k]=(_syncCanon(local[k])===undefined)?distant[k]:local[k];
    }
  }
  return out;
}
function syncFusion(base,local,distant){
  if(!_syncEstObjet(distant)) return local;
  if(!_syncEstObjet(local)) return distant;
  const L=_syncVersArbre(local), D=_syncVersArbre(distant);
  const HL=_syncCarte(L), HD=_syncCarte(D);
  const B=_syncEstObjet(base)?base:null;
  const rec=(l,d,p,prof)=>{
    const hl=HL[p]||SYNC_VIDE, hd=HD[p]||SYNC_VIDE;
    if(hl===hd) return l;
    if(B){
      const hb=(p in B)?B[p]:SYNC_VIDE;
      if(hl===hb) return d;           // je n'y ai pas touche : la valeur de l'autre
      if(hd===hb) return l;           // l'autre n'y a pas touche : la mienne
    }
    if(prof<SYNC_PROFONDEUR&&_syncEstObjet(l)&&_syncEstObjet(d)){
      const out={};
      const cles=new Set(Object.keys(l).concat(Object.keys(d)));
      for(const k of cles){
        if(!p&&SYNC_HORS_FUSION.indexOf(k)>=0) continue;
        const v=rec(l[k],d[k],p?(p+SYNC_SEP+k):k,prof+1);
        if(v!==undefined) out[k]=v;
      }
      return out;
    }
    // Les deux ont touche a la meme feuille — ou il n'y a aucune base : celui
    // qui ecrit maintenant l'emporte.
    return l;
  };
  const r=_syncDepuisArbre(rec(L,D,'',0));
  // LES PIERRES TOMBALES DU DOSSIER FUSIONNE. Elles se sont unies champ par
  // champ comme le reste ; un element supprime d'un cote ne revient pas par
  // l'autre.
  const tb=(r&&r.supprimes)||{};
  const mort=o=>new Set(_syncEstObjet(o)?Object.keys(o).map(String):[]);
  const ms=mort(tb.sessions), mv=mort(tb.videos), mb=mort(tb.bilans);
  if(Array.isArray(r.sessions)) r.sessions=r.sessions.filter(s=>!(s&&ms.has(String(s.id))));
  if(Array.isArray(r.videos)) r.videos=r.videos.filter(v=>!(v&&mv.has(String(v.id))));
  if(Array.isArray(r.bilans))
    r.bilans=r.bilans.filter(b=>!(b&&mb.has(String(b.date)+'|'+String(b.type||''))));
  // L'horodatage n'est pas fusionne : le plus recent des deux, pour que
  // l'autre appareil voie bien qu'il y a du neuf.
  const ua=Math.max(Number(local.updatedAt)||0,Number(distant.updatedAt)||0);
  if(ua) r.updatedAt=ua;
  return r;
}
// ══ LES CHAMPS DE DROITS SONT GELES PAR LES REGLES (30/09/2026) ══════════
// database.rules.json refuse toute MODIFICATION de ces champs dans users/<cle>
// (sauf par le createur) : ils s'ecrivent par le Worker. L'app, elle, envoie
// le dossier ENTIER — et un seul champ modifie ferait rejeter tout le PUT,
// definitivement et en silence, comme 'dispo' l'a fait sur coach_public.
// Avant chaque PUT, ces champs repartent donc EXACTEMENT comme le serveur les
// porte ; absents du serveur, ils partent absents. Un dossier neuf ne peut
// naitre qu'en role 'athlete'. Ce que l'appareil y a ecrit localement reste
// chez lui : ca n'ouvre plus rien, le palier se lit dans droits/.
const CHAMPS_GELES=Object.freeze(['status','paymentStatus','accessExpiry','coachPlan','coachSubActive','programmesAchetes','role']);
const CHAMPS_GELES_ABO=Object.freeze(['formule','statutPaypal','finAccesPaypal','dernierPaiementLe']);
function _alignerChampsGeles(safe,d){
  if(!safe||typeof safe!=='object') return safe;
  const dist=(d&&typeof d==='object')?d:null;
  for(const k of CHAMPS_GELES){
    // La PREMIERE pose du role, a 'athlete' seulement, est admise par la
    // regle — dossier neuf, ou ancien dossier qui n'en portait pas.
    if(k==='role'&&safe.role==='athlete'&&(!dist||dist.role==null)) continue;
    if(!dist){ delete safe[k]; continue; }
    const v=dist[k];
    if(v===undefined||v===null) delete safe[k];
    else safe[k]=JSON.parse(JSON.stringify(v));
  }
  const da=(dist&&dist.abonnement&&typeof dist.abonnement==='object')?dist.abonnement:{};
  if(safe.abonnement&&typeof safe.abonnement==='object'){
    safe.abonnement=Object.assign({},safe.abonnement);
    for(const k of CHAMPS_GELES_ABO){
      if(da[k]===undefined||da[k]===null) delete safe.abonnement[k];
      else safe.abonnement[k]=da[k];
    }
  }
  return safe;
}
// ══ LES LIENS DE VIDEO, CONFORMES A LA REGLE (30/09/2026) ═══════════════════
// database.rules.json n'admet videos[].url que sur Cloudinary, Firebase
// Storage, https://youtu.be/ et https://www.youtube.com/, en moins de 600
// caracteres. Un seul lien hors liste, et c'est le PUT ENTIER du dossier qui
// serait rejete — seances comprises. Avant chaque envoi : un lien YouTube
// d'une autre forme devient https://youtu.be/<id> ; tout autre lien quitte
// `url` pour `lienRefuse`, que rien n'affiche comme lien mais qui garde la
// trace. PURE sur ses arguments : modifie `doc` en place et le rend.
const VIDEO_URL_PREFIXES=Object.freeze(['https://res.cloudinary.com/','https://firebasestorage.googleapis.com/','https://youtu.be/','https://www.youtube.com/']);
function _videoUrlConforme(u){
  return typeof u==='string'&&u.length<600&&VIDEO_URL_PREFIXES.some(p=>u.indexOf(p)===0);
}
function _videosConformes(doc){
  if(!doc||typeof doc!=='object'||!doc.videos||typeof doc.videos!=='object') return doc;
  const liste=Array.isArray(doc.videos)?doc.videos:Object.values(doc.videos);
  for(const v of liste){
    if(!v||typeof v!=='object'||v.url==null) continue;
    if(_videoUrlConforme(v.url)) continue;
    const n=normaliserUrlVideo(v.url);
    const yt=String(n||'').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if(yt){ v.url='https://youtu.be/'+yt[1]; continue; }
    if(_videoUrlConforme(n)){ v.url=n; continue; }
    v.lienRefuse=String(v.url).slice(0,300);
    delete v.url;
  }
  return doc;
}
