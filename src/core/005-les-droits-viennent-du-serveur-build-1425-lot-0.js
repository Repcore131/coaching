// ══ LES DROITS VIENNENT DU SERVEUR (build 1425, lot 0) ═══════════════════════════════
//
// CE QUI CHANGE. Le palier d'un athlete ne se lit plus dans son dossier —
// status, paymentStatus, accessExpiry — mais dans un noeud A PART, droits/,
// que database.rules.json ouvre en LECTURE au titulaire et a son coach, et
// qu'il ferme en ECRITURE A TOUT LE MONDE. Seules les Cloud Functions y
// ecrivent, par l'Admin SDK, qui ne passe pas par les regles.
//
// POURQUOI. users/<cle> est ecrit par son titulaire, sans restriction de
// champ : n'importe qui pouvait taper status:'AUTONOMIE_PREMIUM' dans la
// console de son navigateur et ouvrir toutes les portes. Le fichier
// l'assumait en commentaire depuis le 24/07/2026, faute de serveur.
//
// LES QUATRE PALIERS, du plus ferme au plus ouvert :
//   'aucun'  ·  'essentielle'  ·  'ultime'  ·  'suivi'
const PALIERS_ORDRE=Object.freeze(['aucun','essentielle','ultime','suivi']);
const DROITS_CLE='rc_droits';
// Une lecture reussie vaut quinze minutes : au-dela on redemande, mais on
// continue de s'en servir tant que rien de neuf n'est arrive.
const DROITS_FRAIS_MS=900000;
function _droitsTous(){
  try{ const o=JSON.parse(localStorage.getItem(DROITS_CLE)||'null');
    return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
// GARDE CE QUE LE SERVEUR A DIT, avec la date de la lecture. `vide:true` est
// une reponse a part entiere : « le serveur a repondu, et il n'y a rien ».
function _droitsPoser(email,d,vide){
  if(!email) return;
  try{
    const o=_droitsTous();
    o[String(email).toLowerCase()]={d:d||null,vide:!!vide,lu:Date.now()};
    localStorage.setItem(DROITS_CLE,JSON.stringify(o));
  }catch(e){}
}
function _droitsLus(email){
  if(!email) return null;
  const o=_droitsTous()[String(email).toLowerCase()];
  return (o&&typeof o==='object')?o:null;
}
// ⚠ ON NE PURGE PAS LES DROITS D'UN AUTRE COMPTE : chaque adresse a sa ligne,
//   et un appareil partage garde celle de chacun. Ce qui part a la
//   deconnexion, c'est la session, pas la memoire de ce que le serveur a dit.
//
// PURE. Le droit connu pour ce dossier, et D'OU IL VIENT :
//   'serveur'  le noeud a ete lu, il existe
//   'absent'   le noeud a ete lu, il est vide (personne n'a rien ouvert)
//   'inconnu'  on n'a jamais reussi a le lire (regles pas deployees, hors
//              ligne, premiere ouverture) — c'est le seul cas ou l'ancien
//              modele sert encore de repli
function droitsDe(u){
  const e=(u&&u.email)||'';
  const o=_droitsLus(e);
  if(!o) return {etat:'inconnu',palier:null,echeance:0,source:null,maj:0};
  if(o.vide||!o.d) return {etat:'absent',palier:'aucun',echeance:0,source:null,maj:0,lu:o.lu};
  const d=o.d||{};
  const p=PALIERS_ORDRE.indexOf(String(d.palier))>0?String(d.palier):'aucun';
  // `avant` EST CE QUI ETAIT OUVERT AVANT UNE SUSPENSION. Sans lui, rouvrir
  // demanderait de se souvenir du palier de quelqu’un.
  return {etat:'serveur',palier:p,echeance:Number(d.echeance)||0,
    source:d.source||null,maj:Number(d.maj)||0,lu:o.lu,
    avant:(PALIERS_ORDRE.indexOf(String(d.avant))>0?String(d.avant):''),
    essaiOuvertLe:Number(d.essaiOuvertLe)||0,essaiFinit:Number(d.essaiFinit)||0,
    // Le mois d'Ultime offert au 10e filleul abonné (parrainage).
    bonusUltimeFin:Number(d.bonusUltimeFin)||0,
    // Ultime ouvert par un programme acheté, par-dessus l'abonnement (serveur léger).
    ultimeJusqu:Number(d.ultimeJusqu)||0,abo:d.abo||null,
    // Le suivi payé à un coach, par-dessus le palier (serveur léger, paiements-coach.js).
    suiviJusqu:Number(d.suiviJusqu)||0,
    // Ce qu'une fermeture à la main a remplacé, pour que « Rouvrir » le rende.
    avantEcheance:Number(d.avantEcheance)||0,avantSource:d.avantSource||null,
    // Le demi-tarif du 1er mois d'Ultime, déjà consommé ; l'offre de lancement
    // d'un code ambassadeur (écrite par le serveur léger).
    demiPackUtilise:d.demiPackUtilise===true,offreAmb:d.offreAmb==='ultime_demi'?'ultime_demi':'',
    // LE QUOTA DU COACH (02/10/2026, serveur léger) : jusqu'à quand la formule du
    // coach couvre cet athlète. 0 : jamais dit (rien ne se ferme sur un silence).
    couvertJusqu:Number(d.couvertParCoach&&d.couvertParCoach.jusqu)||0,
    // L'offre de ce coach, posée avec la couverture (05/10/2026) : l'athlète ne
    // peut pas lire coachs_registre. Sert à ouvrir la photo du repas.
    planCoach:['libre','coach','pro'].indexOf(String(d.couvertParCoach&&d.couvertParCoach.plan))>=0?String(d.couvertParCoach.plan):''};
}
// PURE. Hors du quota de son coach, d'après le serveur : le « suivi » d'un
// CODE de coach ne s'ouvre plus. Un palier payé, un essai, un accès posé à la
// main ne sont pas concernés (voir palierDe).
function horsQuotaCoach(d,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  return !!(d&&d.etat==='serveur'&&d.couvertJusqu>0&&t>=d.couvertJusqu);
}
// ⚠ UN NOEUD VIDE NE FERME RIEN, ET C'EST LA CORRECTION DU 24/09/2026.
//
//   Le lot 0 faisait de droits/ la source unique : vide valait « aucun droit »,
//   parce qu'une Cloud Function allait le remplir a chaque paiement. Kevin a
//   tranche : pas de plan Blaze, donc pas de fonctions, donc PERSONNE n'ecrira
//   jamais ce noeud. Garder cette lecture-la aurait coupe l'acces a TOUS les
//   abonnes et a TOUS les athletes suivis le jour ou les regles seraient
//   publiees — la lecture aurait abouti, rendu null, et ferme la porte.
//
//   CE QUI DECIDE DONC :
//     droits/ PORTE QUELQUE CHOSE  → il decide, et il prime sur le dossier.
//     droits/ VIDE OU ILLISIBLE    → le dossier decide, comme avant le lot 0.
//
//   CE QU'ON GARDE EN ECHANGE : le noeud s'ecrit depuis la CONSOLE FIREBASE,
//   qui passe par l'Admin SDK et ignore les regles. Un acces pose la ne se
//   trafique pas depuis un navigateur, contrairement au dossier. Pour ouvrir
//   Ultime trois mois a quelqu'un qui a paye hors de l'application :
//     droits/<adresse avec des virgules>/palier   = "ultime"
//     droits/<adresse avec des virgules>/echeance = <millisecondes>
//     droits/<adresse avec des virgules>/source   = "main"
//   Pour le refermer, remettre palier a "aucun" : la, le noeud PORTE quelque
//   chose, et il prime.
//
// PURE (elle ne lit que le dossier et le cache local).
function palierDe(u){
  if(!u) return 'aucun';
  // ⚠ PLUS DE RACCOURCI role==='coach' (30/09/2026) : un dossier se disait
  //   coach et tout s'ouvrait. Un coach AU REGISTRE a le suivi ; avant la
  //   bascule, le role du dossier (gele par les regles) en tient lieu.
  if(estCoachReconnu(u)) return 'suivi';
  const d=droitsDe(u);
  if(d.etat==='serveur'){
    // LE QUOTA DU COACH (02/10/2026) : hors quota, le « suivi » ouvert par un
    // code de coach se ferme ; l'essai en cours (checkAccess) et un abonnement
    // payé (le palier, ou suiviJusqu par-dessus) restent.
    const hq=horsQuotaCoach(d);
    const p0=(d.echeance>0&&Date.now()>=d.echeance)?'aucun':d.palier;
    const p=(hq&&p0==='suivi'&&d.source==='code_coach')?'aucun':p0;
    // LE MOIS D'ULTIME DU PARRAINAGE s'ajoute PAR-DESSUS le palier payé, sans
    // le remplacer : un renouvellement Essentielle pendant ce mois ne le
    // referme pas, et il retombe seul à sa date.
    // UN PROGRAMME ACHETÉ, de même (ultimeJusqu, posé par le serveur léger).
    const p1=(Math.max(Number(d.bonusUltimeFin)||0,Number(d.ultimeJusqu)||0)>Date.now()&&PALIERS_ORDRE.indexOf(p)<PALIERS_ORDRE.indexOf('ultime'))?'ultime':p;
    // UNE FORMULE PAYÉE À UN COACH ouvre le suivi jusqu'à sa date, sans toucher au palier payé.
    const p2=(Number(d.suiviJusqu)||0)>Date.now()?'suivi':p1;
    // AVANT LA BASCULE SEULEMENT : le suivi d'un coach ne passait pas par
    // droits/, et un ancien abonne suivi depuis gardait son suivi par le
    // dossier. Apres, redeemCode l'ecrit dans droits/ (suiviJusqu).
    if(droitsV2Actif()) return p2;
    const auto=(d.source==='paypal'||d.source==='parrainage');
    const h0=(auto&&String(u.status)==='COACHING_SUIVI')?_palierHerite(u,'absent'):'aucun';
    const h=(hq&&h0==='suivi')?'aucun':h0;
    return PALIERS_ORDRE.indexOf(h)>PALIERS_ORDRE.indexOf(p2)?h:p2;
  }
  if(droitsV2Actif()){
    // droits/ LU ET VIDE : rien d'ouvert, quoi que dise le dossier.
    if(d.etat==='absent') return 'aucun';
    // JAMAIS LU (hors ligne a la premiere ouverture) : le dossier, sauf le
    // suivi — COACHING_SUIVI n'ouvre plus rien sans droits/.
    const h=_palierHerite(u,d.etat);
    return h==='suivi'?'aucun':h;
  }
  return _palierHerite(u,d.etat);
}
// LE MODELE DU DOSSIER, ET IL N'EST PLUS EN SURSIS. Il servait « le temps que
// les regles soient deployees et que la migration ait tourne » : sans plan
// Blaze, cette migration ne tournera pas, et c'est lui qui decide pour tout le
// monde sauf pour les acces poses a la main dans droits/.
//
// ⚠ IL NE PROTEGE DE RIEN, ET ON NE FAIT PAS SEMBLANT. database.rules.json
//   accorde au titulaire l'ecriture sans restriction de champ sur son propre
//   dossier : qui sait ouvrir une console de navigateur peut s'ecrire
//   status:'AUTONOMIE_PREMIUM'. C'est le meme arbitrage qu'avant le lot 0,
//   assume, et la seule barriere reelle reste droits/, ecrit a la main.
//
// ⚠ DEPUIS LE 27/09/2026, LE SERVEUR LÉGER ÉCRIT droits/ À CHAQUE PAIEMENT.
//   Ce que le dossier dit avoir PAYÉ (abonnement, programme) ne compte donc
//   plus dès que droits/ a pu être lu : un nœud vide veut dire « rien de payé
//   côté serveur », et effacer accessExpiry ou s'écrire AUTONOMIE_PREMIUM dans
//   son propre dossier n'ouvre plus rien. Deux exceptions, le temps de la
//   transition :
//     · droits/ jamais lu (`etat` 'inconnu' : hors ligne à la première
//       ouverture, règles pas encore publiées) : l'ancien modèle, entier ;
//     · un paiement fait SUR CET APPAREIL il y a moins de 72 h
//       (paiementRecent) : le webhook de PayPal n'a peut-être pas encore
//       écrit droits/, et quelqu'un qui vient de payer ne doit pas trouver
//       la porte fermée.
//   Le suivi par un coach (COACHING_SUIVI) n'est pas un paiement PayPal : il
//   reste lu ici.
function _palierHerite(u,etat){
  const s=String((u&&u.status)||'FREE');
  const ech=Number(u&&u.accessExpiry)||0;
  if(ech>0&&Date.now()>=ech) return 'aucun';
  if(s==='COACHING_SUIVI') return 'suivi';
  // ⚠ UN PROGRAMME QUI VIENT D'ÊTRE ACHETÉ (02/10/2026) ouvre Ultime AVANT le
  //   test du paiement cru, mais seulement PAIEMENT_RECENT_MS après l'achat :
  //   le serveur relit la commande chez PayPal et écrit droits/ dans ce délai.
  //   Au-delà, c'est droits/ qui décide, et l'écran boutique dit que l'achat
  //   est en vérification (achatEnVerification) au lieu d'un cadenas muet.
  if(programmeAchatRecent(u)) return 'ultime';
  const payeCru=(etat!=='absent')||!droitsServeurActif()||paiementRecent(u);
  if(!payeCru) return 'aucun';
  if(s==='AUTONOMIE_PREMIUM'&&u.paymentStatus==='active'){
    // LA FORMULE PAYEE, quand le dossier la porte. Les dossiers ouverts avant
    // le 24/09/2026 n'en ont pas : ils valent Essentielle, qui est ce qu'ils
    // ont effectivement paye — Ultime n'etait pas en vente.
    const f=String(((u.abonnement||{}).formule)||'');
    return (f==='ultime')?'ultime':'essentielle';
  }
  // UN PROGRAMME ACHETE OUVRE ULTIME LE TEMPS DE SON PROGRAMME (lot 8). Meme
  // sursis que le reste de ce repli : le serveur decidera des qu'il parlera.
  if(programmeOuvreUltime(u)) return 'ultime';
  return 'aucun';
}
// ⚠ LA BASCULE NE SE FAIT QU'UNE FOIS LE RATTRAPAGE PASSÉ. Tant que le script
//   remplir-paiements.mjs n'a pas écrit droits/ pour les abonnés d'avant (et
//   posé reglages_publics/droitsServeur), un nœud vide ne prouve rien : ce
//   sont eux, justement, qui n'en ont pas. Le dossier décide alors comme avant.
//   Lu une fois par session avec droits/, et gardé entre deux sessions.
const DROITS_SERVEUR_CLE='rc_droits_serveur';
function droitsServeurActif(){ try{ return localStorage.getItem(DROITS_SERVEUR_CLE)==='1'; }catch(e){ return false; } }
let _droitsServeurLu=false;
// ⚠ ET IL REDESCEND (05/10/2026, ordre de fermeture, étape 1d). Il restait à
//   '1' pour toujours sur l'appareil : retirer le réglage dans la base (le
//   seul retour arrière prévu si la bascule coupait un payeur) n'atteignait
//   donc aucun téléphone. Il est maintenant relu à chaque session, et retiré
//   quand le serveur RÉPOND qu'il n'existe plus — les deux réglages, v1 et v2.
//   Une lecture qui échoue ne change rien : hors ligne, l'appareil garde ce
//   qu'il savait.
async function rafraichirDroitsServeur(){
  if(_droitsServeurLu) return;
  const v=await CLOUD.pullDroitsServeur().catch(()=>null);
  if(v===null) return;
  _droitsServeurLu=true;
  try{ if(v&&v.actif) localStorage.setItem(DROITS_SERVEUR_CLE,'1'); else localStorage.removeItem(DROITS_SERVEUR_CLE); }catch(e){}
  try{ if(v&&v.v>=2) localStorage.setItem(DROITS_V2_CLE,'1'); else localStorage.removeItem(DROITS_V2_CLE); }catch(e){}
}
// ══ CE QUE LE DOSSIER OUVRE SEUL (ordre de fermeture, étape 1c, 05/10/2026) ══
//
// Trois portes s'ouvrent encore par une simple écriture dans son propre
// dossier : l'essai (essai.finit), le suivi (status COACHING_SUIVI) et, tant
// que la bascule n'est pas posée, l'abonnement (status + paymentStatus). Avant
// de les fermer une à une, il faut savoir COMBIEN de comptes légitimes ne
// tiennent leur accès que par là : ce sont eux qu'une fermeture couperait.
//
// droitsEcarts ne DÉCIDE RIEN : aucun écran ne la lit, aucun accès n'en
// dépend. Elle compare ce que l'app accorde aujourd'hui à ce que le serveur
// atteste seul (droits/), et nomme les portes que seul le dossier tient.
// PURE (le dossier et le cache local). [] quand le serveur n'a jamais répondu :
// on ne juge pas sans lui.
function droitsEcarts(u,maintenant){
  if(!u||u.role==='coach') return [];
  const d=droitsDe(u);
  if(d.etat==='inconnu') return [];
  const t=Number(maintenant)||Date.now(), rang=p=>PALIERS_ORDRE.indexOf(p);
  // Le palier que le serveur atteste, sans rien lire du dossier.
  let strict='aucun';
  if(d.etat==='serveur'){
    strict=(d.echeance>0&&t>=d.echeance)?'aucun':d.palier;
    if(Math.max(Number(d.bonusUltimeFin)||0,Number(d.ultimeJusqu)||0)>t&&rang(strict)<rang('ultime')) strict='ultime';
    if((Number(d.suiviJusqu)||0)>t) strict='suivi';
  }
  const out=[];
  let accorde='aucun'; try{ accorde=palierDe(u); }catch(e){ accorde='aucun'; }
  if(rang(accorde)>rang(strict)) out.push(accorde==='suivi'?'suivi':'abo');
  // L'essai : ouvert par le dossier, pas attesté par le serveur.
  let essai=false; try{ essai=essaiActif(u); }catch(e){ essai=false; }
  if(essai&&!((Number(d.essaiFinit)||0)>t)&&rang(strict)<rang('ultime')) out.push('essai');
  return out;
}
// Un passage par jour et par appareil, dans les compteurs agrégés (aucun nom,
// aucun identifiant : un entier par jour). `droits_ecart_vu` est le
// dénominateur : les comptes jugés ce jour-là.
const DROITS_ECART_CLE='rc_droits_ecart_jour';
function droitsEcartsCompter(u){
  try{
    if(!u||!u.email||u.role==='coach') return false;
    if(droitsDe(u).etat==='inconnu') return false;
    const jour=localISODate(new Date()), marque=jour+'|'+String(u.email).toLowerCase();
    if(localStorage.getItem(DROITS_ECART_CLE)===marque) return false;
    localStorage.setItem(DROITS_ECART_CLE,marque);
    rcm('droits_ecart_vu');
    for(const e of droitsEcarts(u)) rcm('droits_ecart_'+e);
    return true;
  }catch(e){ return false; }
}
// ══ LA BASCULE COMPLETE : droits/ ET coachs_registre/ SEULS (30/09/2026) ══
// Posee (reglages_publics/droitsServeur/v = 2) par cloudflare/scripts/
// remplir-droits.mjs, une fois droits/ rempli pour les athletes suivis et les
// abonnes, et coachs_registre/ pour les coachs. A partir de la :
//   · le palier d'un athlete ne se lit QUE dans droits/ ; le dossier ne sert
//     plus de repli que si droits/ n'a JAMAIS pu etre lu, et jamais pour
//     'suivi' — COACHING_SUIVI n'ouvre plus rien sans droits/ ;
//   · un coach est un compte AU REGISTRE, pas un dossier role:'coach' ;
//   · son plan est celui du registre, pas coachPlan.
// Avant : l'ancien modele, dont les champs sont DEJA geles par les regles —
// plus personne ne peut s'y ecrire un statut, seules les valeurs d'avant
// restent en place le temps du rattrapage.
const DROITS_V2_CLE='rc_droits_v2';
function droitsV2Actif(){ try{ return localStorage.getItem(DROITS_V2_CLE)==='1'; }catch(e){ return false; } }
// Le registre des coachs, lu et garde comme droits/ (meme forme de cache).
const REGISTRE_CLE='rc_coachs_registre';
function _registreTous(){
  try{ const o=JSON.parse(localStorage.getItem(REGISTRE_CLE)||'null');
    return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
function _registrePoser(email,d){
  if(!email) return;
  try{
    const o=_registreTous();
    o[String(email).toLowerCase()]={d:d||null,vide:!d,lu:Date.now()};
    localStorage.setItem(REGISTRE_CLE,JSON.stringify(o));
  }catch(e){}
}
// PURE. Ce que le registre dit de ce compte : 'serveur' (inscrit), 'absent'
// (lu, pas inscrit), 'inconnu' (jamais lu — ou un AUTRE compte que celui
// connecte : les regles ne laissent lire que sa propre ligne).
function registreCoachDe(u){
  const e=String((u&&u.email)||'').toLowerCase();
  if(!e) return {etat:'inconnu'};
  const o=_registreTous()[e];
  if(!o||typeof o!=='object') return {etat:'inconnu'};
  if(o.vide||!o.d) return {etat:'absent',lu:o.lu};
  const d=o.d;
  // `quota` (02/10/2026) : le compteur de mois au-dessus du quota, tenu par le
  // serveur (metier.js couvertureCoach) — c'est lui qui décide de la grâce.
  const q=(d.quota&&typeof d.quota==='object')?{cycles:Math.max(0,Number(d.quota.cycles)||0),mois:String(d.quota.mois||''),
    n:Number(d.quota.n)||0,horsQuota:Number(d.quota.horsQuota)||0}:null;
  return {etat:'serveur',plan:String(d.plan||'libre'),actifJusqu:Number(d.actifJusqu)||0,le:Number(d.le)||0,quota:q,lu:o.lu};
}
// PURE. Ce compte est-il un coach ? Le registre d'abord ; tant que la bascule
// n'est pas faite, ou que le registre n'a jamais ete lu, le role du dossier
// (gele par les regles depuis le 30/09/2026).
function estCoachReconnu(u){
  if(!u) return false;
  const r=registreCoachDe(u);
  if(r.etat==='serveur') return true;
  if(r.etat==='absent'&&droitsV2Actif()) return false;
  return u.role==='coach';
}
async function rafraichirCoachRegistre(u,force){
  const cible=u||currentUser;
  const mail=String((cible&&cible.email)||'').toLowerCase();
  if(!mail) return false;
  const o=_registreTous()[mail];
  if(!force&&o&&(Date.now()-Number(o.lu||0))<DROITS_FRAIS_MS) return true;
  let r=null;
  try{ r=await CLOUD.pullCoachRegistre(mail); }catch(e){ r=null; }
  if(!r||!r.ok) return false;
  _registrePoser(mail,r.registre);
  return true;
}
// LA PREUVE LOCALE D'UN PAIEMENT QUI VIENT D'ABOUTIR, pour 72 heures : posée
// par onApprove (abonnement) et par l'achat d'un programme, sur l'appareil qui
// a payé. Elle ne voyage pas avec le dossier : la trafiquer ne vaut que pour
// cet appareil, et trois jours.
// ══ ATTENDRE QUE LE SERVEUR OUVRE (30/09/2026) ═══════════════════════════
// Apres un paiement, le webhook PayPal ecrit droits/ (athlete) ou
// coachs_registre/ (coach). On relit toutes les 5 s, pendant 2 min au plus.
// Rend true des que c'est ouvert, false au bout du delai — l'ouverture
// arrivera de toute facon a la relecture suivante (synchro, retour au
// premier plan) : il n'y a rien a refaire.
async function _attendreActivation(o,pasMs,maxMs){
  const pas=Number(pasMs)||5000, fin=Date.now()+(Number(maxMs)||120000);
  const coach=o&&o.coach;
  for(;;){
    try{
      if(coach){
        await rafraichirCoachRegistre(currentUser,true);
        if(coachPlanDe(currentUser)===coach) return true;
      } else {
        await rafraichirDroits(currentUser,true);
        if(palierDe(currentUser)!=='aucun') return true;
      }
    }catch(e){}
    if(Date.now()+pas>fin) return false;
    await new Promise(r=>setTimeout(r,pas));
  }
}
const PAIEMENT_RECENT_CLE='rc_paiement_recent';
const PAIEMENT_RECENT_MS=72*3600000;
function paiementRecentNoter(u,quoi){
  try{ if(u&&u.email) localStorage.setItem(PAIEMENT_RECENT_CLE,JSON.stringify({email:String(u.email).toLowerCase(),le:Date.now(),quoi:String(quoi||'')})); }catch(e){}
}
function paiementRecent(u,maintenant){
  try{
    const o=JSON.parse(localStorage.getItem(PAIEMENT_RECENT_CLE)||'null');
    const t=Number(maintenant)||Date.now();
    return !!(o&&u&&u.email&&o.email===String(u.email).toLowerCase()&&t-Number(o.le)>=0&&t-Number(o.le)<PAIEMENT_RECENT_MS);
  }catch(e){ return false; }
}
// PURE. Un programme achete, encore dans sa fenetre. Rend false sur un dossier
// sans achat, ce qui est le cas de presque tout le monde.
function programmeOuvreUltime(u,maintenant){
  const a=u&&u.programmesAchetes;
  if(!a||typeof a!=='object') return false;
  const t=Number(maintenant)||Date.now();
  for(const k of Object.keys(a)){
    const x=a[k];
    if(x&&Number(x.ouvertJusqu)>t) return true;
  }
  return false;
}
// PURE. Un programme acheté il y a moins de PAIEMENT_RECENT_MS, encore dans sa fenêtre.
function programmeAchatRecent(u,maintenant){
  const a=u&&u.programmesAchetes;
  if(!a||typeof a!=='object') return false;
  const t=Number(maintenant)||Date.now();
  return Object.keys(a).some(k=>{ const x=a[k];
    return !!(x&&Number(x.ouvertJusqu)>t&&t-Number(x.le)>=0&&t-Number(x.le)<PAIEMENT_RECENT_MS); });
}
// PURE. Un achat noté au dossier, que le serveur n'a pas (encore) ouvert :
// passé PAIEMENT_RECENT_MS, droits/ lu et sans ultimeJusqu. C'est le cas d'un
// paiement que le serveur n'a pas pu relire : l'écran le dit, avec qui écrire.
function achatEnVerification(u,id,maintenant){
  const a=u&&u.programmesAchetes;
  const x=a&&typeof a==='object'?a[id]:null;
  if(!x||!(Number(x.le)>0)) return false;
  const t=Number(maintenant)||Date.now();
  if(t-Number(x.le)<PAIEMENT_RECENT_MS) return false;
  const d=droitsDe(u);
  if(d.etat==='inconnu') return false;     // jamais lu : on ne dit rien sur un silence
  return !(Number(d.ultimeJusqu)>0);
}
// PURE. L'echeance connue, pour l'affichage — 0 quand il n'y en a pas.
function echeanceDe(u){
  const d=droitsDe(u);
  if(d.etat==='serveur') return d.echeance;
  return Number(u&&u.accessExpiry)||0;
}
// LIT droits/ AU SERVEUR et le garde. Rend true si la lecture a abouti (meme
// vide), false sinon — un appel qui echoue ne change RIEN au cache.
async function rafraichirDroits(u,force){
  const cible=u||currentUser;
  const mail=(cible&&cible.email)||'';
  if(!mail||(cible&&cible.role==='coach')) return false;
  const o=_droitsLus(mail);
  if(!force&&o&&(Date.now()-Number(o.lu||0))<DROITS_FRAIS_MS) return true;
  try{ await rafraichirDroitsServeur(); }catch(e){}
  let r=null;
  try{ r=await CLOUD.pullDroits(mail); }catch(e){ r=null; }
  if(!r||!r.ok) return false;
  _droitsPoser(mail,r.droits,!r.droits);
  // Le serveur vient de répondre : c'est le moment de compter (étape 1c).
  if(cible===currentUser) droitsEcartsCompter(cible);
  return true;
}
// ══════════════════════════════════════════════════════════════════════════
//  OUVRIR ET FERMER UN ACCÈS, À LA MAIN (24/09/2026)
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI CET ÉCRAN EXISTE. PayPal prélève tout seul, mais rien ne redescend
//  jusqu’à l’application : une résiliation, un impayé, une carte qui expire ne
//  changent RIEN ici, et ne le changeront jamais — il n’y a pas de serveur pour
//  écouter PayPal. Le rapport du 1er du mois dit qui a payé et qui n’a pas payé ;
//  cet écran est le geste qui va avec. Sans lui, le rapport n’est qu’une liste
//  qu’on lit en soupirant.
//
//  ⚠ FERMER N’EFFACE RIEN, et l’écran d’accueil de la personne le dit dans ces
//    termes : ses séances, son programme et son historique l’attendent. C’est
//    aussi ce qui fait revenir quelqu’un qui a simplement oublié de payer.
//
//  ⚠ ROUVRIR N’ÉCRIT PAS UNE DATE, IL REND LA MAIN AU DOSSIER. Poser « ouvert
//    un mois » sur un athlète suivi trois mois l’aurait coupé au bout d’un mois
//    sans que personne ne comprenne pourquoi. Le dossier sait déjà jusqu’à quand
//    va son pack ou son abonnement : on efface la fermeture, il redécide.
//
//  ⚠ ET CE QUI N’EST PAS ICI : arrêter le prélèvement. Ça se passe chez PayPal,
//    l’application n’a aucun moyen de l’ordonner. L’écran le dit et donne
//    l’adresse, plutôt que de laisser croire que fermer l’accès arrête le
//    paiement.
const ACCES_DUREES=Object.freeze([{mois:1,libelle:'1 mois'},{mois:3,libelle:'3 mois'},
  {mois:12,libelle:'12 mois'},{mois:0,libelle:'sans fin'}]);
// PURE. La même date, n mois plus tard. Date.setMonth seul déborde : le 31
// janvier plus un mois donnerait le 3 mars. On passe par le 1er, puis on
// redescend au dernier jour du mois visé quand il est plus court.
function moisApres(t,n){
  const d=new Date(Number(t)||Date.now());
  const jour=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+(Number(n)||0));
  const dernier=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(jour,dernier));
  return d.getTime();
}
// PURE. Le nom d’un palier, lu sur OFFRES quand il y est : renommer Ultime un
// jour ne laissera pas cet écran seul à dire l’ancien nom.
function nomDuPalier(p){
  const c=String(p||'');
  if(c==='suivi') return 'Suivi par un coach';
  if(c==='aucun'||!c) return 'Fermé';
  const o=OFFRES[c];
  return (o&&o.lib)?o.lib:c;
}
// PURE. CE QU’ON VA ÉCRIRE, à partir de ce qui est déjà là. Elle ne touche à
// rien, et c’est elle qu’on teste : l’envoi n’est qu’un envoi.
//   'ouvrir'     pose le palier demandé pour `mois` mois (0 = sans fin)
//   'prolonger'  garde le palier, repousse l’échéance de `mois` mois
//   'suspendre'  palier 'aucun', et GARDE dans `avant` ce qui était ouvert
//   'rendre'     après une fermeture à la main : rend ce qu’elle avait
//                remplacé (palier, échéance, source) ; sinon null, c’est-à-
//                dire efface le nœud (le serveur léger le repose au prochain
//                événement PayPal)
// `d` est ce que droitsDe rend — y compris {etat:'absent'} quand le nœud est
// vide, ce qui est le cas de presque tout le monde.
function accesCalcul(action,d,opt){
  const o=opt||{};
  const now=Number(o.maintenant)||Date.now();
  const actuel=(d&&d.etat==='serveur')?d:null;
  if(action==='rendre'){
    // UNE FERMETURE SUR UN ACCÈS PAYPAL SE DÉFAIT EN LE RENDANT TEL QU’IL
    // ÉTAIT. Effacer le nœud le fermerait : depuis que droits/ porte les
    // paiements, un nœud vide veut dire « rien de payé ».
    if(actuel&&actuel.source==='suspension'&&actuel.avantSource)
      return {palier:(PALIERS_ORDRE.indexOf(String(actuel.avant))>0?String(actuel.avant):'essentielle'),
        echeance:Number(actuel.avantEcheance)||0,source:String(actuel.avantSource),
        avant:null,avantEcheance:null,avantSource:null,maj:now};
    return null;
  }
  const pal=actuel?String(actuel.palier||'aucun'):'aucun';
  const mois=(o.mois==null)?1:Number(o.mois);
  if(action==='suspendre'){
    // CE QUI ÉTAIT OUVERT EST GARDÉ, même quand le nœud était vide : dans ce
    // cas c’est l’appelant qui le sait (un athlète suivi vaut 'suivi').
    const avant=(pal!=='aucun')?pal
      :((PALIERS_ORDRE.indexOf(String(actuel&&actuel.avant))>0)?String(actuel.avant)
        :((PALIERS_ORDRE.indexOf(String(o.avant))>0)?String(o.avant):'essentielle'));
    const garde=(actuel&&pal!=='aucun'&&actuel.source&&actuel.source!=='suspension')
      ?{avantEcheance:Number(actuel.echeance)||0,avantSource:String(actuel.source)}:{};
    return Object.assign({palier:'aucun',echeance:0,source:'suspension',avant:avant,maj:now},garde);
  }
  // L’ÉCHÉANCE REPART DE LA PLUS TARDIVE DES DEUX. Prolonger d’un mois le 3,
  // alors que l’accès court jusqu’au 28, doit donner le 28 du mois suivant et
  // non le 3 : un mois réglé ne se perd pas parce qu’on a cliqué tôt.
  const socle=(actuel&&actuel.echeance>now)?actuel.echeance:now;
  let palier=String(o.palier||'');
  if(action==='prolonger'){
    palier=(pal!=='aucun')?pal
      :((PALIERS_ORDRE.indexOf(String(actuel&&actuel.avant))>0)?String(actuel.avant)
        :String(o.palier||''));
  }
  if(PALIERS_ORDRE.indexOf(palier)<1) palier='essentielle';
  return {palier:palier,echeance:(mois>0?moisApres(socle,mois):0),source:'main',maj:now};
}
// PURE. L’état d’un accès, en une phrase, une couleur, et un « à vérifier » qui
// ne se devine pas : une échéance dépassée, ou un accès fermé à la main.
function accesEtatPhrase(d,maintenant){
  const t=Number(maintenant)||Date.now();
  if(!d||d.etat==='inconnu')
    return {cle:'inconnu',phrase:'Pas encore lu',couleur:'var(--sub)',verifier:false};
  if(d.etat==='absent')
    return {cle:'absent',phrase:'Rien de payé côté serveur : seul un suivi coach ouvre l’accès',
      couleur:'var(--sub)',verifier:false};
  const pal=String(d.palier||'aucun');
  if(pal==='aucun')
    return {cle:'ferme',phrase:(d.source==='suspension'?'Accès fermé':'Fermé'),
      couleur:'var(--red-light)',verifier:true,
      avant:(d.avant?nomDuPalier(d.avant):'')};
  const nom=nomDuPalier(pal);
  if(!d.echeance)
    return {cle:'sansfin',phrase:nom+', sans fin',couleur:'var(--green)',verifier:false};
  const jours=Math.ceil((d.echeance-t)/864e5);
  const date=new Date(d.echeance).toLocaleDateString('fr-FR');
  if(jours<0)
    return {cle:'depasse',phrase:nom+', terminé le '+date,
      couleur:'var(--red-light)',verifier:true,jours:jours};
  if(jours<=7)
    return {cle:'bientot',phrase:nom+', jusqu’au '+date+' ('+jours+' jour'+(jours>1?'s':'')+')',
      couleur:'var(--orange)',verifier:false,jours:jours};
  return {cle:'ok',phrase:nom+', jusqu’au '+date,couleur:'var(--green)',
    verifier:false,jours:jours};
}
// PURE. Un accès fermé À LA MAIN, et de quelle façon : c’est ce qui décide de la
// phrase que la personne lit. '' quand rien n’est fermé de cette manière.
function accesFermeParMain(u){
  const d=droitsDe(u);
  if(!d||d.etat!=='serveur') return '';
  if(String(d.palier||'aucun')==='aucun')
    return (d.source==='suspension')?'suspension':'ferme';
  if(d.echeance>0&&Date.now()>=d.echeance) return 'echu';
  return '';
}
// PURE. Le message à envoyer, prêt à coller. Il dit ce qui est fermé ET ce qui
// reste possible tout de suite, comme l’écran que la personne voit.
function messageAcces(etat){
  const e=etat||{};
  const quoi=(e.cle==='ferme')
    ?'Ton accès à RepCore est en pause en attendant le règlement de ce mois.'
    :((e.cle==='depasse')
      ?'Ton accès à RepCore est arrivé au bout de la période réglée.'
      :'Ton accès à RepCore se termine bientôt.');
  return 'Salut ! '+quoi
    +' Rien n’est effacé : tes séances, ton programme et ton historique t’attendent.'
    +' Ouvre l’app et reprends ton abonnement, tout revient au même endroit : '
    +lienAbonnement()+' Dis-moi si tu as le moindre souci, je m’en occupe.';
}
// ── LE GESTE ──────────────────────────────────────────────────────────────
// ⚠ ON LIT AVANT D’ÉCRIRE, TOUJOURS. Prolonger sans connaître l’échéance en
//   cours la raccourcirait ; suspendre sans connaître le palier perdrait de
//   quoi rouvrir. Une lecture qui échoue annule le geste et le dit : mieux vaut
//   ne rien faire que fermer un accès en croyant le prolonger.
async function accesAgir(action,email,opt){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL){
    toast('Réservé au créateur.','var(--orange)'); return false; }
  const mail=String(email||'').trim().toLowerCase();
  if(!mail||mail.indexOf('@')<0){ toast('Il manque l’adresse.','var(--orange)'); return false; }
  const lu=await CLOUD.pullDroits(mail);
  if(!lu||!lu.ok){
    toast('Pas pu lire cet accès : rien n’a changé.','var(--orange)'); return false; }
  _droitsPoser(mail,lu.droits,!lu.droits);
  const avantEtat=accesEtatPhrase(droitsDe({email:mail}));
  const champs=accesCalcul(action,droitsDe({email:mail}),opt);
  const dit=(action==='suspendre')
    ?('Fermer l’accès de '+mail+' ? Rien n’est effacé, et tu le rouvres quand tu veux.')
    :((action==='rendre')
      ?('Rouvrir l’accès de '+mail+' ? Ce que la fermeture avait remplacé revient (abonnement PayPal compris) ; sinon, seul un suivi coach l’ouvre.')
      :((action==='prolonger')
        ?('Prolonger l’accès de '+mail+' d’un mois ?')
        :('Ouvrir '+nomDuPalier(champs.palier)+' à '+mail
          +(champs.echeance?(' jusqu’au '+new Date(champs.echeance).toLocaleDateString('fr-FR')):' sans fin')+' ?')));
  if(!await rcConfirm(dit,null,'Confirmer')) return false;
  const r=await CLOUD.poserDroits(mail,champs);
  if(!r||!r.ok){
    toast('Pas envoyé ('+((r&&r.raison)||'réseau')+') : rien n’a changé.','var(--orange)');
    return false; }
  // LE CACHE SUIT L’ÉCRITURE. Sans ça, l’écran affichait encore l’état d’avant
  // et on cliquait deux fois, en croyant que le premier clic avait raté.
  if(champs===null) _droitsPoser(mail,null,true);
  else _droitsPoser(mail,Object.assign({},lu.droits||{},champs),false);
  const apres=accesEtatPhrase(droitsDe({email:mail}));
  toast(mail+' : '+apres.phrase.toLowerCase(),'var(--green)');
  try{ if(_accesVu&&_accesVu.email===mail) _rendreConsoleAcces(); }catch(e){}
  try{ _rendreAccesAthletes(); }catch(e){}
  return true;
}
// Les quatre entrées, une par geste : elles lisent la durée choisie à l’écran
// au moment du clic, et non au moment du rendu.
function _accesDureeChoisie(){
  const s=document.getElementById('acces-duree');
  const v=s?Number(s.value):1;
  return (ACCES_DUREES.some(x=>x.mois===v))?v:1;
}
function accesOuvrir(palier,email){
  return accesAgir('ouvrir',email||(_accesVu&&_accesVu.email),
    {palier:palier,mois:_accesDureeChoisie()});
}
function accesProlonger(email,opt){
  return accesAgir('prolonger',email||(_accesVu&&_accesVu.email),
    Object.assign({mois:1},opt||{}));
}
function accesSuspendre(email,opt){
  return accesAgir('suspendre',email||(_accesVu&&_accesVu.email),opt||{});
}
function accesRouvrir(email){
  return accesAgir('rendre',email||(_accesVu&&_accesVu.email),{});
}
// ══ BUILD 1876 : LE DIAGNOSTIC ET LE SIGNALEMENT ═══════════════════════════
// Les 20 dernières erreurs JS, en mémoire et dans le stockage local (tampon
// circulaire). Le texte est nettoyé : pas d'adresse, pas de longue suite de
// chiffres (une mesure, un identifiant). Rien du dossier n'y entre.
const ERREURS_MAX=20, ERREURS_CLE='rc_erreurs';
/** PURE. Ajoute en fin, garde les `max` dernières. */
function ajouterErreurTampon(l,e,max){ return (Array.isArray(l)?l:[]).concat([e]).slice(-(max||ERREURS_MAX)); }
function _nettoyerTexteDiag(t,garderChiffres){
  let x=String(t==null?'':t).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,'[e-mail]');
  if(!garderChiffres) x=x.replace(/\d{3,}/g,'#');
  return x.slice(0,200);
}
let _rcErreurs=(function(){ try{ const l=JSON.parse(localStorage.getItem(ERREURS_CLE)||'[]'); return Array.isArray(l)?l.slice(-ERREURS_MAX):[]; }catch(e){ return []; } })();
function noterErreurJS(msg,src){
  _rcErreurs=ajouterErreurTampon(_rcErreurs,{le:Date.now(),m:_nettoyerTexteDiag(msg),s:_nettoyerTexteDiag(src,true)});
  try{ localStorage.setItem(ERREURS_CLE,JSON.stringify(_rcErreurs)); }catch(e){}
  try{ signalerErreur(msg,src,'js'); }catch(e){}
}
// ══ SÉRIE 6, LOT 14 — LE CAPTEUR D'ERREURS ═════════════════════════════════
// Chaque erreur devient une SIGNATURE (message nettoyé, endroit, build,
// empreinte) envoyée au Worker (POST /erreur), au plus 20 par jour et une
// fois par empreinte et par jour. Jamais le dossier, jamais une adresse.
// En développement local et en visite, rien ne part.
const ERREUR_ENVOI_JOUR_MAX=20, ERREUR_ENVOI_CLE='rc_erreurs_envoi';
// PURE. L'empreinte : djb2 en base 36.
function empreinteErreur(t){ let h=5381; const s=String(t||''); for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0; return h.toString(36); }
// PURE. La signature d'une erreur.
function signatureErreur(msg,src,ou,build){
  const m=_nettoyerTexteDiag(msg), s=_nettoyerTexteDiag(String(src||'').replace(/\?[^:\s]*/,''),true).slice(0,120), o=_nettoyerTexteDiag(ou,true).slice(0,40);
  const b=String(build||(typeof window!=='undefined'&&window.RC_BUILD)||'0');
  return {m,s,ou:o,b,h:empreinteErreur(m+'|'+s.replace(/:\d+(:\d+)?$/,'')+'|'+o)};
}
// PURE. L'état de la file après une erreur : {etat, envoyer}.
function erreurAEnvoyer(etat,sig,jour){
  const e=(etat&&etat.jour===jour)?{jour,n:Number(etat.n)||0,vus:(Array.isArray(etat.vus)?etat.vus:[]).slice(),file:(Array.isArray(etat.file)?etat.file:[]).slice()}:{jour,n:0,vus:[],file:[]};
  if(!sig||!sig.m||e.vus.indexOf(sig.h)>=0||e.n>=ERREUR_ENVOI_JOUR_MAX) return {etat:e,envoyer:false};
  e.n++; e.vus.push(sig.h); e.file.push(sig);
  return {etat:e,envoyer:true};
}
function _erreurEtat(){ try{ return JSON.parse(localStorage.getItem(ERREUR_ENVOI_CLE)||'null'); }catch(e){ return null; } }
let _erreurVidage=null, _erreurDansEnvoi=false;
function signalerErreur(msg,src,ou){
  if(_erreurDansEnvoi) return false;
  const sig=signatureErreur(msg,src,ou);
  const r=erreurAEnvoyer(_erreurEtat(),sig,localISODate(new Date()));
  if(!r.envoyer) return false;
  try{ localStorage.setItem(ERREUR_ENVOI_CLE,JSON.stringify(r.etat)); }catch(e){}
  clearTimeout(_erreurVidage); _erreurVidage=setTimeout(()=>{ viderErreurs().catch(()=>{}); },4000);
  return true;
}
function _erreursEnvoiPermis(){
  if(typeof window!=='undefined'&&window._rcErreurForcer) return true;
  if(typeof RC_VISITE!=='undefined'&&RC_VISITE) return false;
  const h=location.hostname; return !(h==='localhost'||h==='127.0.0.1'||h===''||h.startsWith('192.168.'));
}
// Envoie la file ; ce qui part est retiré, le reste attend le prochain passage.
async function viderErreurs(){
  const e=_erreurEtat(); if(!e||!Array.isArray(e.file)||!e.file.length) return 0;
  if(!_erreursEnvoiPermis()) return 0;
  let n=0; const reste=[];
  _erreurDansEnvoi=true;
  try{
    for(const sig of e.file){
      try{ const r=await fetch(SERVEUR_LEGER_URL+'/erreur',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(sig),keepalive:true});
        if(r&&(r.ok||r.status===400||r.status===429)) n++; else reste.push(sig); }catch(err){ reste.push(sig); }
    }
  }finally{ _erreurDansEnvoi=false; }
  const e2=_erreurEtat()||e; e2.file=reste.concat((e2.file||[]).filter(x=>e.file.every(y=>y.h!==x.h)));
  try{ localStorage.setItem(ERREUR_ENVOI_CLE,JSON.stringify(e2)); }catch(err){}
  return n;
}
try{
  if(typeof window!=='undefined'){
    window.addEventListener('error',e=>{ try{ noterErreurJS(e&&e.message,String((e&&e.filename)||'').split('/').pop()+':'+((e&&e.lineno)||0)); }catch(x){} });
    window.addEventListener('unhandledrejection',e=>{ try{ const r=e&&e.reason; noterErreurJS('promesse : '+((r&&r.message)||r),''); }catch(x){} });
  }
}catch(e){}
function _octetsStockage(){ let n=0; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); n+=k.length+String(localStorage.getItem(k)||'').length; } }catch(e){} return n*2; }
/** Le diagnostic joint au signalement : technique seulement. */
function diagnosticSupport(){
  let att=null; try{ att=CLOUD.enAttenteDeSync(); }catch(e){}
  return {build:(typeof window!=='undefined'&&window.RC_BUILD)||null,
    ecran:((document.querySelector('.screen.active')||{}).id)||null,
    role:(currentUser&&currentUser.role)||null, enAttente:att,
    erreurs:_rcErreurs.slice(-ERREURS_MAX), stockageOctets:_octetsStockage(),
    enLigne:(typeof navigator!=='undefined')?navigator.onLine:null,
    appareil:(typeof navigator!=='undefined')?String(navigator.userAgent||'').slice(0,120):''};
}
function ouvrirSignalement(){
  try{ closeModal(); }catch(e){}
  document.body.insertAdjacentHTML('beforeend',`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px">
    <h2 style="margin-bottom:4px">Signaler un problème</h2>
    <p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:8px">Dis ce qui s’est passé. Un diagnostic technique part avec (version, écran, envois en attente, dernières erreurs) : aucune de tes mesures.</p>
    <textarea id="sig-texte" rows="5" maxlength="2000" style="width:100%;box-sizing:border-box" placeholder="Ce que tu faisais, ce que tu attendais, ce qui est arrivé."></textarea>
    <button class="btn btn-red" style="margin-top:10px;width:100%" onclick="envoyerSignalement()">Envoyer</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Annuler</button>
  </div></div>`);
}
async function envoyerSignalement(){
  const z=document.getElementById('sig-texte');
  const texte=String((z&&z.value)||'').trim();
  if(!texte){ toast('Décris le problème en quelques mots.','var(--orange)'); return false; }
  try{
    await CLOUD._callFn('signalerProbleme',{texte,diag:diagnosticSupport()});
    try{ closeModal(); }catch(e){}
    toast('Merci : ton signalement est parti.');
    return true;
  }catch(e){ toast((e&&e.message)||'Envoi impossible : réessaie.','var(--orange)'); return false; }
}

// ══ BUILD 1876 : L'ÉCRAN SUPPORT DU CRÉATEUR ════════════════════════════════
// Le Worker fait tout (POST /fn/support, réservé au créateur) ; l'écran lit,
// demande confirmation en nommant la personne, et relit le journal.
let _supVu=null;
function ouvrirSupport(){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL){ toast('Réservé au créateur.','var(--orange)'); return false; }
  go('s-support');
  _rendreSupport();
  supportListes();
  return true;
}
async function _supAppel(data){
  try{ return await CLOUD._callFn('support',data); }
  catch(e){ toast((e&&e.message)||'Le serveur a refusé.','var(--orange)'); return null; }
}
function _supNom(){ const v=_supVu||{}; return ((v.fname||'')+' '+(v.lname||'')).trim()||v.email||'cette personne'; }
function _rendreSupport(){
  const z=document.getElementById('sup-fiche');
  if(!z) return;
  const v=_supVu;
  if(!v){ z.innerHTML=''; return; }
  const E=escapeHtml, j=t=>t?new Date(Number(t)).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'—';
  z.innerHTML='<div class="card" style="margin-bottom:12px">'
    +'<div style="font-weight:800">'+E(_supNom())+' <span class="sub" style="font-size:var(--fs-xs)">'+E(v.email||'')+'</span></div>'
    +'<div class="sub" style="font-size:var(--fs-xs);line-height:1.6">'+E(v.role||'?')+' · coach : '+E(v.coach||'aucun')+' · '+E(v.status||'')+' '+E(v.paymentStatus||'')
      +' · '+v.seances+' séances · dossier du '+j(v.updatedAt)+(v.evenementsEnAttente&&v.evenementsEnAttente.length?' · '+v.evenementsEnAttente.length+' événement(s) en attente':'')+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">'
      +'<button type="button" class="btn btn-sm" style="margin:0" onclick="supportRattacher()">Rattacher à un coach</button>'
      +'<button type="button" class="btn btn-sm" style="margin:0" onclick="supportExporter()">Exporter</button></div></div>'
    +'<div class="card" style="margin-bottom:12px"><div style="font-weight:800;margin-bottom:6px">Bilans</div>'
    +((v.bilans||[]).slice().reverse().map(b=>'<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);font-size:var(--fs-xs)">'
      +'<span style="flex:1">'+E(j(b.date))+' · '+E(b.type)+' · '+b.photos+'/3 photos'+(b.repondu?' · répondu':'')+(b.aCompleter?' · à compléter':'')+'</span>'
      +'<button type="button" class="rb-lien" onclick="supportRouvrirBilan('+_attrArg(b.id)+')">Rouvrir pour les photos</button>'
      +'<button type="button" class="rb-lien" onclick="supportRetirerDoublon('+_attrArg(b.id)+')">Retirer ce doublon</button></div>').join('')||'<div class="sub">Aucun bilan.</div>')
    +'</div>'
    +'<div class="card" style="margin-bottom:12px"><div style="font-weight:800;margin-bottom:6px">Versions du programme</div>'
    +((v.historique||[]).map(h=>'<div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border);font-size:var(--fs-xs)">'
      +'<span style="flex:1">'+E(new Date(Number(h.ts)||0).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}))+(h.motif?' · '+E(h.motif):'')+'</span>'
      +'<button type="button" class="rb-lien" onclick="supportRestaurer('+h.index+')">Restaurer</button></div>').join('')||'<div class="sub">Aucune version gardée.</div>')
    +'</div>';
}
async function supportOuvrir(email){
  const champ=document.getElementById('sup-mail');
  const mail=String((email!=null?email:(champ&&champ.value))||'').trim().toLowerCase();
  if(!mail||mail.indexOf('@')<0){ toast('Colle l’adresse de la personne.','var(--orange)'); return false; }
  if(champ) champ.value=mail;
  const r=await _supAppel({action:'lire',email:mail});
  if(!r) return false;
  _supVu=r; _rendreSupport(); supportListes();
  return true;
}
async function _supAgir(question,data,fait){
  if(!_supVu) return false;
  if(!await rcConfirm(question,null,'Confirmer')) return false;
  const r=await _supAppel(Object.assign({email:_supVu.email},data));
  if(!r) return false;
  toast(fait);
  await supportOuvrir(_supVu.email);
  return true;
}
function supportRouvrirBilan(id){ return _supAgir('Rouvrir ce bilan de '+_supNom()+' pour ses photos ?',{action:'rouvrirBilan',bilanId:id,vues:['face','back','side']},'Bilan rouvert : la demande est sur son accueil.'); }
function supportRetirerDoublon(id){ return _supAgir('Retirer ce bilan de '+_supNom()+' ? Il reste 30 jours dans la corbeille du support.',{action:'retirerDoublonBilan',bilanId:id},'Bilan retiré.'); }
function supportRestaurer(i){ return _supAgir('Restaurer cette version du programme de '+_supNom()+' ? L’actuelle est gardée dans l’historique.',{action:'restaurerProgramme',index:i},'Programme restauré.'); }
async function supportRattacher(){
  if(!_supVu) return false;
  const c=(await rcSaisie('Rattacher '+_supNom()+' à quel coach ? (adresse e-mail)','',{libelleOk:'Suivant'})||'').trim();
  if(!c) return false;
  return _supAgir('Rattacher '+_supNom()+' au coach '+c+' ?',{action:'rattacher',coachEmail:c},'Rattaché.');
}
async function supportExporter(){
  if(!_supVu) return false;
  if(!await rcConfirm('Exporter le dossier complet de '+_supNom()+' ?','Il contient ses données de santé : garde le fichier en lieu sûr.','Exporter')) return false;
  const r=await _supAppel({action:'exporter',email:_supVu.email});
  if(!r) return false;
  try{
    const u=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));
    const a=document.createElement('a'); a.href=u; a.download='dossier-'+String(_supVu.email).replace(/[^a-z0-9]+/gi,'_')+'.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000);
  }catch(e){ toast('Téléchargement impossible.','var(--orange)'); return false; }
  return true;
}
async function supportListes(){
  const zj=document.getElementById('sup-journal'), zt=document.getElementById('sup-tickets');
  if(!zj&&!zt) return false;
  const E=escapeHtml, d=t=>new Date(Number(t)||0).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  const t=await _supAppel({action:'tickets'});
  if(zt&&t) zt.innerHTML=t.length?t.map(x=>'<button type="button" class="btn btn-outline" style="display:block;width:100%;text-align:left;margin:0 0 6px;font-size:var(--fs-xs)" onclick="supportOuvrir('+_attrArg(String(x.email||'').replace(/,/g,'.'))+')">'
    +E(d(x.le))+' · '+E(String(x.email||'').replace(/,/g,'.'))+'<br><span class="sub">'+E(String(x.texte||'').slice(0,160))+'</span></button>').join(''):'<div class="sub">Aucun signalement.</div>';
  const l=await _supAppel({action:'journal'});
  if(zj&&l) zj.innerHTML=l.length?l.map(x=>'<div style="font-size:var(--fs-xs);padding:4px 0;border-bottom:1px solid var(--border)">'+E(d(x.le))+' · '+E(x.action)+' · '+E(String(x.email||'').replace(/,/g,'.'))+'</div>').join(''):'<div class="sub">Journal vide.</div>';
  return true;
}
// ── L’ÉCRAN ───────────────────────────────────────────────────────────────
// L’adresse qu’on regarde, et l’état de sa lecture. Une seule à la fois : on
// vient du rapport, une ligne après l’autre.
let _accesVu=null;
function ouvrirAccesConsole(){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL){
    toast('Réservé au créateur.','var(--orange)'); return false; }
  go('s-coach-acces');
  _rendreConsoleAcces();
  return true;
}
async function accesVoir(email){
  const champ=document.getElementById('acces-mail');
  const mail=String((email!=null?email:(champ?champ.value:''))||'').trim().toLowerCase();
  if(!mail||mail.indexOf('@')<0){
    toast('Colle l’adresse de la personne.','var(--orange)'); return false; }
  _accesVu={email:mail,lecture:'en cours'};
  _rendreConsoleAcces();
  const r=await CLOUD.pullDroits(mail);
  if(!r||!r.ok){
    _accesVu={email:mail,lecture:'echec',raison:(r&&r.raison)||'réseau'};
    _rendreConsoleAcces(); return false; }
  _droitsPoser(mail,r.droits,!r.droits);
  _accesVu={email:mail,lecture:'ok'};
  _rendreConsoleAcces();
  return true;
}
function _rendreConsoleAcces(){
  const z=document.getElementById('acces-corps');
  if(!z) return false;
  if(!currentUser||currentUser.email!==CREATOR_EMAIL){
    z.innerHTML=emptyState('lock','Cet écran est réservé au créateur.'); return false; }
  const mail=(_accesVu&&_accesVu.email)||'';
  const S='style="font-size:var(--fs-xs);color:var(--sub);line-height:1.7"';
  let etat=null,d=null;
  if(mail&&_accesVu.lecture==='ok'){ d=droitsDe({email:mail}); etat=accesEtatPhrase(d); }
  const carte=(h)=>'<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-4);padding:16px;margin-bottom:14px">'+h+'</div>';
  const titre=(x)=>'<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2.5px;'
    +'font-weight:800;text-transform:uppercase;margin-bottom:12px">'+x+'</div>';
  const bouton=(lib,act,couleur)=>'<button class="btn '+couleur+' btn-sm" style="margin:0;flex:1;'
    +'min-width:132px;font-size:var(--fs-2xs);letter-spacing:1px;padding:10px 10px;min-height:38px" '
    +'onclick="'+act+'">'+lib+'</button>';
  let h=carte(titre('Une adresse')
    +'<input id="acces-mail" type="email" inputmode="email" autocapitalize="off" autocomplete="off" '
    +'spellcheck="false" placeholder="adresse@exemple.fr" value="'+escapeHtml(mail)+'" '
    +'style="width:100%;margin-bottom:10px" onkeydown="if(event.key===\'Enter\'){event.preventDefault();accesVoir()}">'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin:0" onclick="accesVoir()">Voir son accès</button>'
    +'<div '+S+' style="margin-top:10px">Le rapport du 1er du mois donne l’adresse de chaque '
    +'personne qui paie. Colle-la ici : tu n’as pas besoin d’ouvrir son dossier pour '
    +'ouvrir ou fermer son accès.</div>');
  if(mail&&_accesVu.lecture==='en cours')
    h+=carte('<div '+S+'>Lecture de l’accès de '+escapeHtml(mail)+'…</div>');
  if(mail&&_accesVu.lecture==='echec')
    h+=carte('<div style="font-size:var(--fs-sm);color:var(--orange);line-height:1.6">'
      +'Pas pu lire l’accès de '+escapeHtml(mail)+' ('+escapeHtml(String(_accesVu.raison||''))+').'
      +'</div><div '+S+' style="margin-top:8px">Rien n’a été changé. Réessaie : '
      +'les boutons n’apparaissent que sur un état lu pour de bon.</div>');
  if(etat){
    const msg=messageAcces(etat);
    const lien='mailto:'+encodeURIComponent(mail)+'?subject='
      +encodeURIComponent('Ton accès à RepCore')+'&body='+encodeURIComponent(msg);
    const durees=ACCES_DUREES.map(x=>'<option value="'+x.mois+'">'+x.libelle+'</option>').join('');
    h+=carte(titre('Son accès aujourd’hui')
      +'<div style="font-weight:800;font-size:var(--fs-sm);color:'+etat.couleur+'">'
      +escapeHtml(etat.phrase)+(etat.verifier?' <span class="badge badge-red" '
        +'style="vertical-align:middle">à vérifier</span>':'')+'</div>'
      +(etat.avant?('<div '+S+' style="margin-top:4px">Avant la fermeture : '
        +escapeHtml(etat.avant)+'</div>'):'')
      +'<div '+S+' style="margin-top:4px">'+escapeHtml(mail)+'</div>'
      // CE QUI EST FERMÉ, CE QUI RESTE POSSIBLE : la même règle pour lui que
      // pour la personne en face.
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">'
      // L'ORDRE EST CELUI DE L'INTENTION. Sur un accès fermé, rouvrir est LE
      // geste, et il est rouge. Sur un accès ouvert, le même bouton ne veut
      // plus dire « rouvrir » mais « retirer ce que j'ai posé » : même effet,
      // autre intention, donc autre mot et dernière place.
      +((etat.cle==='ferme')?bouton('Rouvrir','accesRouvrir()','btn-red'):'')
      +((['ok','bientot','depasse'].indexOf(etat.cle)>=0)
        ?bouton('Prolonger d’un mois','accesProlonger()','btn-outline')
        :'')
      +((etat.cle!=='ferme')?bouton('Fermer son accès','accesSuspendre()','btn-outline'):'')
      +'<a href="'+escapeHtml(lien)+'" class="btn btn-outline btn-sm" style="margin:0;flex:1;'
      +'min-width:132px;font-size:var(--fs-2xs);letter-spacing:1px;padding:10px 10px;min-height:38px;'
      +'display:flex;align-items:center;justify-content:center;text-decoration:none">Lui écrire</a>'
      +((d&&d.etat==='serveur'&&etat.cle!=='ferme')
        ?bouton('Retirer ce que j’ai posé','accesRouvrir()','btn-outline')
        :'')
      +'</div>');
    h+=carte(titre('Ouvrir un accès réglé ailleurs')
      +'<div '+S+' style="margin-bottom:10px">Un programme payé de la main à la main, un mois '
      +'offert, un dépannage : ça se posait dans la console Firebase, ça se pose ici.</div>'
      +'<select id="acces-duree" style="width:100%;margin-bottom:10px">'+durees+'</select>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap">'
      +bouton('Ouvrir '+escapeHtml(nomDuPalier('essentielle')),'accesOuvrir(\'essentielle\')','btn-outline')
      +bouton('Ouvrir '+escapeHtml(nomDuPalier('ultime')),'accesOuvrir(\'ultime\')','btn-red')
      +'</div>');
  }
  h+=carte(titre('Ce qui ne se fait pas d’ici')
    +'<div '+S+'>Arrêter le prélèvement se passe chez PayPal, l’application ne peut pas '
    +'l’ordonner : <a href="https://www.paypal.com/myaccount/autopay/" target="_blank" '
    +'rel="noopener" style="color:var(--red-text)">paypal.com, Paiements automatiques</a>. '
    +'Ici, tu ouvres et tu fermes l’accès.<br>'
    +'Fermer l’accès de quelqu’un n’arrête pas son prélèvement, et arrêter son prélèvement '
    +'ne ferme pas son accès : les deux gestes vont ensemble.</div>');
  // BUILD 1876 : l'écran Support (lire et réparer un dossier, journal, signalements).
  h+='<button type="button" class="btn btn-outline" style="margin-top:16px;width:100%" onclick="ouvrirSupport()">Support : réparer un dossier</button>';
  z.innerHTML=h;
  return true;
}
// ══ L'ARRIVEE : LES DEUX FORMULES, LES CHIFFRES, LES PORTES (lot 2) ══════
// Les prix viennent d'OFFRES et de nulle part ailleurs : l'ecran d'arrivee et
// l'ecran de paiement ne peuvent donc pas annoncer deux chiffres differents.
let _accueilAnnuel=true;   // l'annuel est montre par defaut
function accueilVersTarifs(){
  const z=document.getElementById('wel-tarifs');
  if(z) z.scrollIntoView({behavior:'smooth',block:'start'});
  return true;
}
function accueilPeriode(annuel){
  _accueilAnnuel=!!annuel;
  const a=document.getElementById('wel-b-an'), m=document.getElementById('wel-b-mois');
  if(a) a.classList.toggle('actif',_accueilAnnuel);
  if(m) m.classList.toggle('actif',!_accueilAnnuel);
  // ⚠ LE BANDEAU DISAIT « 2 mois offerts », EN DUR, DANS index.html. Depuis
  //   que l'année vaut douze mensualités (24/09/2026), la promesse était
  //   fausse — et affichée juste au-dessus des deux prix qui la démentent.
  //   Il porte maintenant la remise CALCULÉE, et ne s'affiche pas quand il
  //   n'y en a pas. Le jour où le prix annuel redescendra, il reviendra tout
  //   seul, avec le bon pourcentage.
  const b=document.getElementById('wel-badge');
  if(b){
    const e=_economie('essentielle');
    if(_accueilAnnuel&&e.pourcent){ b.textContent=e.pourcent+' sur l’année'; b.style.display=''; }
    else b.style.display='none';
  }
  accueilRendreTarifs();
  return _accueilAnnuel;
}
// UNE CARTE D'OFFRE. Le prix AU MOIS est toujours le chiffre le plus gros ; le
// total annuel est ecrit en petit dessous. Jamais l'inverse : c'est le prix
// mensuel que les gens comparent.
function _accueilCarte(cle,pref,lignes){
  const o=offre(cle);
  if(!o) return '';
  const annuel=_accueilAnnuel&&!!o.prixAn;
  const auMois=annuel?prixMoisAnnuel(cle):prixOffre(cle);
  const dessous=annuel
    ? (prixOffre(cle,true)+' par an, facturés en une fois')
    : (_euros(Math.round(o.prix*12*100)/100)+' sur un an');
  const plan=planIdOffre(cle,annuel);
  // ⚠ UN BOUTON QUI NE PEUT PAS ABOUTIR NE S'AFFICHE PAS EN ROUGE. Tant que le
  //   plan n'existe pas chez PayPal, on le dit au lieu de faire semblant.
  const bouton=plan
    ? '<button type="button" class="wel-c-b" onclick="accueilChoisir(\''+cle+'\','+(annuel?'true':'false')+')">Commencer le mois offert</button>'
    : '<button type="button" class="wel-c-b creux" onclick="accueilChoisir(\''+cle+'\','+(annuel?'true':'false')+')">Commencer le mois offert</button>'
      +'<div class="wel-c-att">Le paiement de cette formule ouvre bientôt. Ton mois offert, lui, commence tout de suite.</div>';
  return '<div class="wel-c'+(pref?' pref':'')+'">'
    +'<div class="wel-c-top"><span class="wel-c-nom">'+escapeHtml(o.lib)+'</span>'
    +(pref?'<span class="wel-c-pref">Le plus choisi</span>':'')+'</div>'
    +'<div class="wel-c-prix"><span class="wel-c-nb">'+auMois+'</span>'
    +'<span class="wel-c-par">par mois</span></div>'
    +'<div class="wel-c-tot">'+dessous+'</div>'
    +bouton+'</div>';
}
// CE QUI JUSTIFIE LE PRIX. Quatre chiffres, quatre icones, aucune phrase
// creuse. ⚠ LES DEUX NOMBRES SONT MESURES, pas arrondis pour faire joli :
// 436 fiches d'exercices dans le depot, 3 484 aliments dans la base
// ANSES-Ciqual embarquee.
const ACCUEIL_CHIFFRES=Object.freeze([
  Object.freeze({i:'video',t:'436 exercices filmés et illustrés',
    s:'Chaque mouvement montré, pas décrit.'}),
  Object.freeze({i:'utensils',t:'3 484 aliments',
    s:'La base ANSES-Ciqual, dans ton téléphone, utilisable sans réseau.'}),
  Object.freeze({i:'dumbbell',t:'Tes séances en salle, même sans connexion',
    s:'Le sous-sol de ta salle ne coupe plus ton entraînement.'}),
  Object.freeze({i:'crosshair',t:'L’analyse de tes mouvements, image par image',
    s:'Angles, trajectoires, amplitude : ce que l’œil ne voit pas à vitesse réelle.'}),
]);
const ACCUEIL_DIFF=Object.freeze([
  Object.freeze({t:'Essentielle',l:Object.freeze([
    'Tu composes tes séances et tu les enchaînes.',
    'Tu t’entraînes : charges, séries, minuteur.',
    'Tu mesures : historique, bilans, poids.'])}),
  Object.freeze({t:'Ultime',l:Object.freeze([
    '436 exercices filmés, avec les erreurs à éviter.',
    'Les méthodes d’intensification et les échauffements tout faits.',
    'La planification de tes blocs, et ta diète calculée.'])}),
]);
function accueilRendreTarifs(){
  const z=document.getElementById('wel-cartes');
  if(!z) return false;
  z.innerHTML=_accueilCarte('essentielle',false)+_accueilCarte('ultime',true);
  const d=document.getElementById('wel-diff');
  if(d) d.innerHTML=ACCUEIL_DIFF.map(x=>'<div class="wel-d"><div class="wel-d-t">'
    +escapeHtml(x.t)+'</div><ul>'+x.l.map(y=>'<li>'+escapeHtml(y)+'</li>').join('')+'</ul></div>').join('');
  const c=document.getElementById('wel-chiffres');
  if(c) c.innerHTML=ACCUEIL_CHIFFRES.map(x=>'<div class="wel-ch">'
    +'<span class="wel-ch-i" aria-hidden="true">'+icon(x.i,18)+'</span>'
    +'<span><span class="wel-ch-t">'+escapeHtml(x.t)+'</span>'
    +'<span class="wel-ch-s">'+escapeHtml(x.s)+'</span></span></div>').join('');
  // Le prix annonce sur la troisieme porte vient de la meme table.
  document.querySelectorAll('[data-prix-essentielle-mois]')
    .forEach(e=>{ e.textContent=prixOffre('essentielle'); });
  return true;
}
// LA PORTE « JE M'ENTRAINE SEUL » MENE A L'INSCRIPTION, pas a un mur de
// paiement : l'essai d'un mois est offert et sans carte bancaire. Le choix de
// la formule est garde pour l'ecran d'abonnement, qui le relira.
function accueilChoisir(cle,annuel){
  try{ sessionStorage.setItem('rc_offre_choisie',String(cle||'')); }catch(e){}
  try{ sessionStorage.setItem('rc_offre_annuel',annuel?'1':''); }catch(e){}
  // UN ABONNÉ NE SOUSCRIT PAS UNE SECONDE FOIS (02/10/2026) : l'écran
  // d'abonnement lui propose « Changer de formule », sans bouton PayPal.
  // SÉRIE 6 (lot 11) : connecté, UN SEUL CHEMIN — l'écran d'abonnement, qui
  // présélectionne la formule et la période choisies. PayPal ne se charge
  // qu'au geste « Souscrire », jamais d'office (initPaypalSubscription).
  if(currentUser){ _subPalier=''; go('s-subscribe'); try{ loadSubscribePage(); }catch(e){} return true; }
  go('s-register');
  try{ selectRole('athlete',true); }catch(e){}
  return true;
}
function checkAccess(u){
  if(!u) return true;
  // UN COACH AU REGISTRE (30/09/2026), et non un dossier qui se dit coach.
  if(estCoachReconnu(u)) return true;
  const s=u.status||'FREE';
  // ⚠ L'ESSAI PASSE PAR LA MEME PORTE QUE TOUT LE RESTE, et c'est voulu :
  // checkAccess est le seul endroit du fichier qui dise oui ou non a un
  // athlete. Un essai branche ailleurs — un garde dans go(), une exception
  // dans routeUser — aurait fait deux verites sur le meme sujet.
  //
  // FREE + essai en cours = acces. FREE + essai epuise = le paywall, comme
  // avant. FREE sans essai du tout = comme avant, inchange : les comptes
  // anterieurs a ce lot ne se voient pas ouvrir un essai retroactif.
  // ══ LE SERVEUR D'ABORD (build 1425, lot 0) ══════════════════════════════════════
  // Un droit pose par le serveur ouvre la porte, quoi que dise le dossier ;
  // un droit expire la ferme, quoi que dise le dossier. L'essai reste lu ici
  // aussi : il n'ouvre rien d'autre qu'une porte, et c'est la meme porte.
  const d=droitsDe(u);
  if(d.etat==='serveur'){
    const p=palierDe(u);
    if(p!=='aucun') return true;
    return essaiActif(u);
  }
  // ⚠ APRES LA BASCULE (reglages_publics/droitsServeur/v = 2), le dossier ne
  //   decide plus : droits/ lu et vide ferme la porte, quel que soit le
  //   status. Jamais lu : palierDe, qui ne rend jamais 'suivi' sur la foi du
  //   dossier. C'est ce qui ferme la reproduction « PUT status=COACHING_SUIVI ».
  if(droitsV2Actif()){
    if(palierDe(u)!=='aucun') return true;
    return essaiActif(u);
  }
  // ⚠ 'absent' ET 'inconnu' SE REJOIGNENT (24/09/2026). Un noeud vide ne veut
  //   pas dire « aucun droit » : il veut dire que personne n'y a rien ecrit,
  //   et sans fonctions personne n'y ecrira. Le dossier decide, exactement
  //   comme avant le lot 0, et ON NE COUPE PERSONNE SUR UN SILENCE.
  if(s==='FREE') return essaiActif(u);
  if(s==='COACHING_SUIVI'){
    if(!u.accessExpiry) return true;
    return Date.now()<u.accessExpiry;
  }
  if(s==='AUTONOMIE_PREMIUM') return u.paymentStatus==='active';
  return false;
}
function loadAccessGate(){
  const u=currentUser;
  const title=document.getElementById('ag-title');
  const sub=document.getElementById('ag-sub');
  const block=document.getElementById('ag-status-block');
  const ic=document.getElementById('ag-icon');
  if(!u){return;}
  if(ic) ic.innerHTML=icon('lock',56);
  const L='<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.8">';
  // ══ FERMÉ À LA MAIN (24/09/2026) ═══════════════════════════════════════
  // ⚠ CETTE BRANCHE PASSE AVANT TOUTES LES AUTRES, et c'est voulu. Un accès
  //   fermé depuis l'écran « Accès » l'est pour une raison précise, et les
  //   phrases d'à côté parleraient d'autre chose : « Abonnement inactif » alors
  //   que le prélèvement tourne peut-être encore chez PayPal, « Accès requis »
  //   à quelqu'un qui en avait un hier.
  const _ferme=(()=>{ try{ return accesFermeParMain(u); }catch(e){ return ''; } })();
  const _renM=document.getElementById('ag-renouveler');
  if(_ferme){
    // LES DEUX CHOSES, TOUJOURS : ce qui est fermé, et ce qui reste possible
    // tout de suite. Ce qui reste possible est juste dessous, les deux boutons
    // de l'écran — qu'on remet en place au cas où une autre branche les ait
    // cachés pendant la même session.
    title.textContent=(_ferme==='echu')?'Ta période est arrivée au bout':'Ton accès est en pause';
    sub.textContent='Rien n’est effacé. Tes séances, ton programme et ton historique t’attendent.';
    block.innerHTML=L+((_ferme==='echu')
      ?'La période réglée est terminée.<br><br>Tu la reprends quand tu veux, et tout revient au même endroit.'
      :'En attente du règlement de ce mois.<br><br>Ton accès se rouvre dès qu’il est passé, et tout revient au même endroit.')
      +'</div>';
    if(_renM) _renM.style.display='';
  } else if((()=>{ try{ const d=droitsDe(u); return horsQuotaCoach(d)&&d.palier==='suivi'&&d.source==='code_coach'; }catch(e){ return false; } })()){
    // ══ HORS DU QUOTA DE SON COACH (02/10/2026) ═══════════════════════════
    // Le coach suit plus d'athlètes que sa formule n'en couvre, depuis plus de
    // trois mois. L'athlète n'y est pour rien : on le dit, on dit que rien
    // n'est perdu, et on donne les deux issues — s'abonner lui-même, ou
    // demander à son coach de passer à la formule supérieure.
    const nom=String(u.coachName||'').trim();
    title.textContent='Ton suivi gratuit est en pause';
    sub.textContent='Rien n’est effacé. Tes séances, ton programme et ton historique t’attendent.';
    const href=(()=>{ try{ return _coachContactHref(u.coachId,'Bonjour'+(nom?' '+nom:'')
      +', RepCore m’indique que ta formule ne couvre plus mon suivi. Peux-tu passer à la formule supérieure ? Mon accès reviendra aussitôt.'); }catch(e){ return ''; } })();
    block.innerHTML=L
      +(nom?escapeHtml(nom):'Ton coach')+' suit plus d’athlètes que sa formule n’en couvre : ta place n’est plus prise en charge.<br><br>'
      +'Deux façons de continuer :<br>'
      +'• prendre l’abonnement <strong style="color:var(--text-strong)">Essentielle</strong> à '+escapeHtml(prixAutonomie())+', et garder ton coach ;<br>'
      +'• demander à '+(nom?escapeHtml(nom):'ton coach')+' de passer à la formule supérieure : ton accès revient aussitôt.</div>'
      +(href?'<a href="'+_safeContactUrl(href)+'" target="_blank" rel="noopener" class="btn btn-outline" '
        +'style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none">'
        +'Prévenir '+(nom?escapeHtml(nom):'mon coach')+'</a>':'');
    if(_renM) _renM.style.display='';
  } else if(u.status==='COACHING_SUIVI'&&u.accessExpiry&&Date.now()>=u.accessExpiry){
    const d=new Date(u.accessExpiry).toLocaleDateString('fr-FR');
    const nom=(u.coachName||'').trim();
    // ══ LA SORTIE DE PACK (lot 10) ════════════════════════════════════
    // ⚠ CET ECRAN DISAIT « Accès expiré » ET PROPOSAIT UNE SEULE ISSUE :
    //   recontacter le coach. Quelqu'un qui ne le recontacte pas etait perdu,
    //   avec ses seances, son programme et son historique derriere la porte.
    //   Il porte maintenant les deux sorties, et dit d'abord que rien n'est
    //   efface — c'est la peur de tout perdre qui fait ne pas revenir.
    const _pack=(()=>{ try{ return htmlSortiePack(u); }catch(e){ return ''; } })();
    const _ren=document.getElementById('ag-renouveler');
    if(_pack){
      title.textContent='Ton suivi est terminé';
      sub.textContent='Rien n’est effacé. Tes séances, ton programme et ton historique t’attendent.';
      block.innerHTML=_pack;
      // « Renouveler mon accès » mene au meme endroit que « Garder l'app » :
      // deux boutons identiques a deux centimetres l'un de l'autre font
      // hesiter, et l'hesitation coute la vente. Le code coach reste, lui :
      // c'est une troisieme chose, pas la meme.
      if(_ren) _ren.style.display='none';
      return;
    }
    if(_ren) _ren.style.display='';
    title.textContent='Accès expiré';
    sub.textContent='Ton accès coaching avec suivi a expiré le '+d+'.';
    // Sur cet écran, joindre son coach est la seule action qui débloque
    // quoi que ce soit : quand on sait où le joindre, on affiche le bouton
    // plutôt que de dire à l'athlète de se débrouiller. Le message est
    // pré-rempli — il n'a plus qu'à envoyer.
    const href=_coachContactHref(u.coachId,
      'Bonjour'+(nom?' '+nom:'')+", mon accès RepCore a expiré le "+d+'. Peux-tu le prolonger ?');
    block.innerHTML=L
      +'Expiré le : <strong style="color:var(--text-strong)">'+escapeHtml(d)+'</strong>'
      +(nom?'<br>Coach : <strong style="color:var(--text-strong)">'+escapeHtml(nom)+'</strong>':'')
      +'</div>'
      +(href
        ?'<a href="'+_safeContactUrl(href)+'" target="_blank" rel="noopener" class="btn btn-red" '
          +'style="margin-top:14px;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none">'
          +'Demander une prolongation'+(nom?' à '+escapeHtml(nom):'')+'</a>'
        // Pas de coach rattaché, ou aucun moyen de le joindre : la phrase
        // reste, faute de mieux.
        :L+'Contacte ton coach pour le prolonger.</div>');
  } else if(u.status==='AUTONOMIE_PREMIUM'&&u.paymentStatus!=='active'){
    title.textContent='Abonnement inactif';
    sub.textContent="Ton abonnement mensuel n'est plus actif.";
    block.innerHTML=L
      +'Statut : <span style="color:var(--red-light)">'+escapeHtml(u.paymentStatus||'inactif')+'</span>'
      +'<br>Abonnement : <span style="font-family:monospace;font-size:var(--fs-xs)">'
      +escapeHtml(u.paypalSubscriptionId||'non renseigné')+'</span>'
      +'<br><br>Renouvelle-le pour retrouver ton accès.</div>';
  } else {
    title.textContent='Accès requis';
    sub.textContent='Tu dois activer un accès pour utiliser RepCore.';
    // Espace insécable avant le € : la coupure « 9,50 » / « €/mois » en fin de
    // ligne est fautive en typographie française. Le prix vient de la table,
    // jamais d'ici : prixAutonomie le lit sur SUB_PALIERS, qui le lit sur OFFRES.
    block.innerHTML=L+"Tu n'as pas encore d'accès actif.<br>"
      +"Entre un code fourni par ton coach, ou souscris à l'abonnement autonomie à "+escapeHtml(prixAutonomie())+".</div>";
  }
}

// ======= NAV =======
// ── Barre d'onglets athlète : visibilité et onglet actif ───────────────────
// Les écrans qui la portent, et l'onglet que chacun allume. Tout ce qui ne
// figure PAS dans cette table la masque : séance en cours, bilan, recherche
// d'aliment, portail d'accès, abonnement, et l'intégralité des écrans coach.
// Une table d'inclusion plutôt qu'une liste d'exclusion : un écran ajouté plus
// tard est masqué par défaut, ce qui est le comportement sûr — l'oubli inverse
// ferait apparaître la barre en pleine séance.
// BUILD 1887 : cinq onglets. Les écrans rangés sous un onglet gardent la
// barre visible (Pas, Sommeil, Historique la perdaient).
const TABBAR_ECRANS={
  's-client-home':'home',
  's-entrainement':'entrainement','s-videos':'entrainement','s-historique-seances':'entrainement',
  's-session-manager':'entrainement','s-records':'entrainement',
  's-nutrition':'nutrition',
  's-progress':'progres','s-lifestyle':'progres','s-steps':'progres','s-sleep':'progres',
  's-mon-coach':'coach','s-bilan-choice':'coach','s-canal':'coach','s-messages':'coach'
};
// L'onglet qui porte la pastille d'une source (les anciens onglets).
const ONGLET_PARENT=Object.freeze({videos:'entrainement',bilan:'coach',canal:'coach',lifestyle:'progres',evolution:'progres'});
// Hauteur mesurée, pas devinée : elle dépend des icônes injectées au boot et de
// l'échelle typographique (--fs-xs). Une constante en dur laisserait soit une
// bande morte sous le contenu, soit le dernier élément caché par la barre.
function _majHauteurTabbar(){
  const b=document.getElementById('client-tabbar');
  if(!b) return;
  // Mesure possible même barre masquée : on l'affiche le temps d'un calcul,
  // en visibility:hidden pour qu'aucun scintillement ne soit visible.
  const cache=!b.classList.contains('show');
  if(cache){b.style.visibility='hidden';b.classList.add('show');}
  const h=b.offsetHeight;
  if(cache){b.classList.remove('show');b.style.visibility='';}
  if(h>0) document.documentElement.style.setProperty('--tabbar-h',h+'px');
}
// Retours coach pas encore consultés. `=== false` est STRICT et volontaire :
// une vidéo corrigée avant l'arrivée de ce champ vaut undefined et n'est donc
// pas comptée. Sans cela, la mise à jour aurait ressorti d'un coup toutes les
// anciennes corrections comme si elles venaient d'arriver.
// Source unique : la notification d'accueil, la pastille d'onglet et le
// marquage à la lecture comptent tous la même chose.
function feedbacksNonVus(u){
  return ((u&&u.videos)||[]).filter(v=>v&&v.feedbackSeen===false);
}
// Pastille rouge sur l'onglet Corrections (data-tab="videos"). Le libellé
// accessible est mis à jour en même temps : une pastille seule n'est
// perceptible que visuellement. R17 — il porte le nom VISIBLE de l'onglet.
function _majPastilleVideos(){
  const btn=document.querySelector('#client-tabbar .tab-btn[data-tab="'+(ONGLET_PARENT.videos)+'"]');
  if(!btn) return;
  _pastilleOnglet('videos',feedbacksNonVus(currentUser).length,
    c=>'Corrections : '+c+' retour'+(c>1?'s':'')+' du coach à consulter');
}
function _majTabbar(id){
  // La bande « envois en attente » suit l'écran (bas, séance ou sous la barre de titre).
  try{ setTimeout(_majIndicAttente,0); }catch(e){}
  const bar=document.getElementById('client-tabbar');
  if(!bar) return;
  const onglet=TABBAR_ECRANS[id];
  const montrer=currentUser?.role==='athlete'&&!!onglet;
  bar.classList.toggle('show',montrer);
  document.body.classList.toggle('with-tabbar',montrer);
  if(!montrer) return;
  // Re-mesure dans les conditions réelles d'affichage. Mesuré : la valeur prise
  // au boot vaut 63px, la barre effectivement rendue 65px — les polices
  // (Montserrat) n'étaient pas encore chargées et la ligne de texte était plus
  // basse. Ces 2px suffisaient à laisser le dernier élément sous la barre.
  _majHauteurTabbar();
  // L'onglet allumé se déduit de l'ÉCRAN AFFICHÉ, jamais du dernier clic : un
  // retour par la flèche appelle go() sans passer par clientTab(), et laissait
  // donc allumé l'onglet quitté.
  // L'onglet quitté est relevé AVANT la bascule : après, il n'y a plus de
  // « avant », et l'arc n'aurait plus de point de départ.
  const _ongletAvant=bar.querySelector('.tab-btn.active');
  bar.querySelectorAll('.tab-btn').forEach(b=>{
    const actif=b.dataset.tab===onglet;
    b.classList.toggle('active',actif);
    if(actif) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  // Seulement quand l'onglet CHANGE. _majTabbar est appelée à chaque go(),
  // y compris pour revenir sur l'écran où l'on est déjà : sans cette garde,
  // l'arc repartirait sur place, d'un onglet vers lui-même.
  const _ongletApres=bar.querySelector('.tab-btn.active');
  if(_ongletAvant&&_ongletApres&&_ongletAvant!==_ongletApres)
    _arcOnglet(_ongletAvant,_ongletApres);
  // À chaque navigation : les pastilles suivent l'état réel des retours non
  // vus, qu'ils viennent d'arriver par la synchro ou d'être consultés à
  // l'instant.
  _majPastilleVideos();
  _majOngletCanal();
  _majPastilleBilan();
  _majPastilleLifestyle();
}
function go(id){
  // ?role=coach (02/10/2026) : le coach venu de coachs.html ne passe pas par
  // l'accueil athlète, et le rôle est coché d'avance à l'inscription.
  try{ id=rcRoleRoute(id); }catch(e){}
  try{ if(id==='s-register') setTimeout(rcRolePreselection,80); }catch(e){}
  try{ lectureCacher(); }catch(e){}
  // BUILD 1914 : quitter la fin de séance pose la bannière d'installation.
  try{ _installApresFeteQuitter(id); }catch(e){}
  // La pastille « n envois en attente » suit le compte affiche (connexion,
  // deconnexion, changement de compte).
  try{ setTimeout(_majIndicAttente,0); }catch(e){}
  // Le temps du coach : relu APRÈS le changement d'écran (segment fermé ou ouvert).
  try{ setTimeout(_chronoTick,0); }catch(e){}
  // La recherche rapide suit l'ecran (rrPlacer) : apres le changement.
  try{ setTimeout(rrPlacer,0); }catch(e){}
  // Des cibles non transmises, et le coach quitte la fiche : le bandeau.
  try{ if(id!=='s-coach-client') nutBrouillonAvertir(); }catch(e){}
  // ON NE VIDE QUE SI L ON QUITTE LE MODULE. Naviguer de la nutrition vers la
  // cafeine ne rejoue rien ; revenir depuis l accueil rejoue l entree une fois.
  try{ if(!NUT_ECRANS.test(String(id||''))) _dejaAnime.clear(); }catch(e){}
  // MEME REGLE POUR LA LISTE D'ATHLETES : la cascade rejoue quand on REVIENT
  // sur l'accueil coach depuis un autre ecran, et jamais pendant qu'on y est.
  try{ if(id!=='s-coach-home'){ const _l=document.getElementById('ch-clients-list');
       if(_l) delete _l.dataset.deja; } }catch(e){}
  // UNE SAISIE OUVERTE NE SURVIT PAS AU CHANGEMENT D’ÉCRAN. Sans ça, le calque
  // restait affiché par-dessus le nouvel écran et son appelant attendait une
  // promesse qui ne se résoudrait jamais. C’est un no-op quand rien n’est
  // ouvert — donc à chaque appel ordinaire.
  try{ rcSaisieFermer(true); }catch(e){}
  // LA MODALE DE PAUSE NON PLUS. Même raison : le retour matériel n’est pas
  // le seul chemin qui change d’écran, et elle survivait à tous les autres.
  // No-op quand elle est fermée, donc à chaque appel ordinaire.
  // INSTANTANEE : une feuille qui sortirait en fondu par-dessus le nouvel
  // ecran serait pire que le clignotement d'avant.
  try{ _feuilleFermer('wo-pause-modal',true); }catch(e){}
  // ET LE LEXIQUE. Meme raison que les deux precedentes : il s'ouvre depuis
  // n'importe quel ecran, il doit donc mourir avec celui qui l'a ouvert. Une
  // definition posee par-dessus l'ecran suivant n'explique plus rien.
  try{ rcInfoFermer(true); }catch(e){}
  try{ fermerHistoriqueExo(true); }catch(e){}
  try{ fermerAchatProgramme(true); }catch(e){}
  // LES DEUX FICHES DE VENTE aussi : elles s'ouvrent depuis « Mes programmes »,
  // et une fiche laissee ouverte par-dessus l'ecran suivant y publierait un
  // programme qu'on ne voit plus.
  try{ fermerVenteProgramme(true); }catch(e){}
  try{ fermerFicheVente(true); }catch(e){}
  // MOTION LAB : sa vidéo continuerait de jouer, son compris, derrière
  // l'écran suivant. La quitter par une autre porte que sa flèche l'arrête —
  // et met en pause une correction en cours d'enregistrement plutôt que de la
  // laisser tourner sur un écran qu'on ne voit plus.
  try{ if(id!=='s-coach-motion-lab'){
    const _mv=document.getElementById('ml-video'); if(_mv&&!_mv.paused) _mv.pause();
    if(typeof window.mlSortieEcran==='function') window.mlSortieEcran();
  } }catch(e){}
  // LA CORRECTION REJOUÉE : sa voix se tait quand on change d'écran.
  try{ if(id!=='s-motion-correction'&&typeof window.mlQuitterCorrection==='function') window.mlQuitterCorrection(); }catch(e){}
  try{ fermerContactCoach(true); }catch(e){}
  try{ fermerChoixDiete(true); }catch(e){}
  // LA BOITE DU COACH s'ouvre a l'arrivee sur son accueil (voir BOITE_COACH) ;
  // un autre compte a l'ecran la ferme.
  try{
    if(id==='s-coach-home') BOITE_COACH.ouvrir();
    else if(BOITE_COACH._cle&&BOITE_COACH._cle!==BOITE_COACH._maCle()) BOITE_COACH.fermer();
  }catch(e){}
  // RATTRAPAGE DU PROFIL PUBLIC, une seule fois par session. Accroche ici et
  // non au seul accueil coach : un coach qui ouvre l app ailleurs ne passait
  // jamais par loadCoachHome, et sa vitrine restait non publiee sans que rien
  // ne le signale. go() est le seul point par ou tout le monde passe.
  try{
    if(!window._ratProfilFait&&currentUser&&currentUser.role==='coach'){
      window._ratProfilFait=true;
      setTimeout(()=>{ try{ _rattraperProfilCoach(); }catch(e){} },1200);
    }
  }catch(e){}
  // SCAN : quitter l ecran coupe la camera. La garde est ICI, dans go(),
  // et pas seulement sur le bouton retour : un lien, une notification ou
  // un retour materiel passent tous par la, et aucun ne doit laisser une
  // piste video active.
  try{
    // Relache AUSSI le WebAssembly, et pas seulement la camera : c est la
    // seule porte par laquelle tout le monde passe — bouton, lien,
    // notification, retour materiel.
    if(id!=='s-scan'&&document.querySelector('.screen.active')?.id==='s-scan') scanLibererTout();
  }catch(e){}
  // Sortie de l ecran multi-athletes : on date la visite. Seule ecriture de ce
  // lot, et elle ne part que si le coach quitte vraiment cet ecran-la.
  try{
    const _cur=document.querySelector('.screen.active');
    if(_cur&&_cur.id==='s-coach-home'&&id!=='s-coach-home') _pilMarquerVisite();
  }catch(e){}
  // L'écran quitté, relevé AVANT toute bascule : il sert à décider s'il y a
  // vraiment changement d'écran, donc s'il faut empiler une entrée d'historique.
  const _avant=document.querySelector('.screen.active')?.id;
  const _safe=['s-splash','s-welcome','s-coach-home','s-client-home','s-coach-entry','s-athlete-entry'];
  // Par une adresse neuve, comme la sonde de version : location.reload()
  // pouvait ressortir la page du cache du navigateur.
  if(window._swUpdatePending&&_safe.includes(id)){ if(window._rcForcerMaj) window._rcForcerMaj(); else location.reload(); return; }
  // Filet de sécurité UI — le vrai contrôle d'accès reste côté données/serveur (P02).
  // s-coach-program est l'éditeur d'exercices partagé : l'athlète y accède pour SA propre
  // séance (openSessionExercises fixe le contexte juste avant l'appel à go()).
  const _athleteEditing=_progEditorCtx.mode==='athlete';
  // LA GRILLE DE CHARGE EST LE SECOND ECRAN PARTAGE (lot 3), au meme titre et
  // pour la meme raison : l'athlete Ultime y regarde SON bloc. _gcSurSoi le
  // dit, et il ne peut le dire que de lui-meme — ouvrirGrilleCharge ne pose
  // _gcAthlete a autre chose que currentUser que pour un coach.
  const _athleteCharge=(id==='s-coach-charge')&&(()=>{ try{ return _gcSurSoi(); }catch(e){ return false; } })();
  if(id.startsWith('s-coach-')&&!['s-coach-home','s-coach-entry'].includes(id)&&currentUser?.role!=='coach'&&!(id==='s-coach-program'&&_athleteEditing)&&!_athleteCharge){
    toast('Accès réservé au coach','var(--orange)');
    go(currentUser?'s-client-home':'s-welcome');
    return;
  }
  if((id.startsWith('s-client-')||id.startsWith('s-athlete-'))&&!['s-client-home','s-athlete-entry'].includes(id)&&currentUser?.role==='coach'){
    toast('Écran réservé aux athlètes','var(--orange)');
    go('s-coach-home');
    return;
  }
  closeModal();
  // Une question sans réponse ne doit pas s'évanouir. closeModal() ci-dessus
  // efface AUSSI la demande de confirmation d'import, et le rafraîchissement de
  // fond appelle loadCoachHome() — donc go() — a chaque synchronisation, soit
  // toutes les 5 minutes (SYNC_PERIODE_MS) : mesuré,
  // la modale disparaissait au bout d'une demi-minute en laissant le paquet en
  // attente, sans plus aucun moyen ni de l'accepter ni de le refuser.
  // Restaurée seulement si elle avait déjà été montrée : sinon elle s'ouvrirait
  // dès le premier go() du démarrage, avant même que l'utilisateur soit routé.
  if(window._pendingAthletePkg&&window._pkgDejaProposee) setTimeout(_proposerImportAthlete,0);
  // LE SENS DE L'ONGLET, lu ICI et pas dans _majTabbar : cette derniere est
  // appelee APRES s.classList.add('active') — l'animation est deja engagee,
  // l'onglet actif deja deplace, et le delta ne serait plus calculable.
  // L'arc d'onglet et l'ecran partent enfin du meme cote.
  try{
    const _cible=TABBAR_ECRANS[id];
    const _bar=document.getElementById('client-tabbar');
    if(_cible&&_bar&&currentUser?.role==='athlete'){
      const _tabs=Array.prototype.slice.call(_bar.querySelectorAll('.tab-btn'));
      const _de=_tabs.findIndex(b=>b.classList.contains('active'));
      const _vers=_tabs.findIndex(b=>b.dataset.tab===_cible);
      if(_de>=0&&_vers>=0&&_de!==_vers) _sensNav=(_vers>_de)?'av':'ar';
    }
  }catch(e){}
  // Remise a 'av' immediate : un seul go() consomme le sens, jamais deux.
  document.documentElement.dataset.nav=_sensNav; _sensNav='av';
  document.querySelectorAll('.screen').forEach(s=>{
    s.classList.remove('active');
    s.style.display='none';
  });
  const s=document.getElementById(id);
  if(s){
    s.classList.add('active');
    s.style.display='flex';
    // ── REMETTRE LA PAGE EN HAUT, ET SUR CE QUI DÉFILE VRAIMENT ──────────
    //
    // `s.scrollTop=0` ne faisait RIEN, et c'était le bug. `.screen` est en
    // `min-height:100dvh` sans `overflow` : il GRANDIT avec son contenu et ne
    // déborde donc jamais. `.scroll-area` non plus, pour la même raison — le
    // commentaire de _pxDefilerAuBord le disait déjà : « c'est le DOCUMENT qui
    // défile ». Le scrollTop de ces deux éléments-là vaut toujours 0, et le
    // remettre à 0 ne déplace rien.
    //
    // CE QUE ÇA DONNAIT, ET POURQUOI ON CROYAIT LE BOUTON MORT. Le coach
    // descendait sa grille de sept jours jusqu'au jeudi — mille pixels plus
    // bas — puis appuyait sur « Modifier les exercices ». L'écran changeait
    // bien, mais la PAGE restait à mille pixels : l'éditeur s'ouvrait au
    // milieu d'un formulaire, ou après sa fin, sur du vide. Rien ne bougeait
    // sous les yeux, aucune erreur, aucun message. Et les séances du HAUT de
    // la liste marchaient, elles : d'où « certaines séances » seulement, et
    // surtout sur téléphone, où sept cartes ne tiennent jamais dans l'écran.
    //
    // INSTANTANÉ, ET C'EST OBLIGATOIRE : `html{scroll-behavior:smooth}` est
    // posé plus haut dans la feuille de style, et sans `behavior:'instant'`
    // le changement d'écran partirait en défilement animé de deux mille
    // pixels — le seul mouvement de l'app qui rende réellement malade.
    // L'option écrite en JS l'emporte sur la feuille de style, dans les deux
    // sens : c'est la même raison qui fait passer _defiler par du JS.
    //
    // Les deux autres remises à zéro sont GARDÉES, pas remplacées : elles ne
    // coûtent rien, et le jour où une mise en page donnera enfin un
    // débordement à `.scroll-area`, c'est elle qu'il faudra remettre en haut.
    s.scrollTop=0;
    try{ const _z=s.querySelector('.scroll-area'); if(_z) _z.scrollTop=0; }catch(_e){}
    // B2.F4 — SAUF QUAND ON REVIENT SUR LE TABLEAU DE BORD.
    //
    // B1.5 a decide que l'arrivee sur un ecran se fait EN HAUT, et c'est la
    // bonne regle pour une navigation avant. Le retour depuis la fiche d'un
    // athlete est le seul cas ou elle dessert : sur quinze athletes tries par
    // urgence, le coach devait re-parcourir la liste pour retrouver ou il en
    // etait. C'est la donnee qu'on memorise d'un ecran a l'autre parce qu'elle
    // n'est plus visible.
    //
    // EN MEMOIRE SEULEMENT, jamais dans le stockage : la position ne survit ni
    // a une deconnexion, ni a un changement de compte, ni a un rechargement.
    // La liste, elle, continue d'etre rechargee — on rend une position, pas un
    // contenu perime, et c'est pourquoi la restitution passe par
    // requestAnimationFrame : le rendu doit avoir eu lieu.
    if(id==='s-coach-home'&&_retourAccueilCoach){
      _retourAccueilCoach=false;
      const _y=_posAccueilCoach, _revoir=_ligneARevoir;
      _ligneARevoir=null;
      try{
        requestAnimationFrame(()=>{
          try{
            const pan=document.getElementById('ct-dashboard');
            if(pan&&_y>0) pan.scrollTop=_y;
            _signalerLigneAthlete(_revoir);
          }catch(e){}
        });
      }catch(e){}
      try{ window.scrollTo({top:0,left:0,behavior:'instant'}); }
      catch(_e){ try{ window.scrollTo(0,0); }catch(_e2){} }
      return;
    }
    // B1.5 — ET LES CONTENEURS QUI DEFILENT REELLEMENT, LE CAS ECHEANT.
    //
    // Les trois remises a zero ci-dessus ne touchaient pas l'accueil coach :
    // #s-coach-home est en overflow:hidden, et ce qui defile chez lui est
    // #ct-dashboard — ni .screen, ni .scroll-area, ni le document. Le coach
    // qui revenait d'une fiche athlete retrouvait sa liste a la profondeur ou
    // il l'avait laissee. Parfois heureux, jamais decide : c'est cela le
    // defaut, et non la position elle-meme.
    //
    // UNE CLASSE PLUTOT QUE L'IDENTIFIANT DU PANNEAU. Quatre panneaux defilent
    // sur cet ecran et un cinquieme s'ajoutera : la classe dit ce qu'ils sont,
    // et le prochain en herite sans qu'on revienne ici. Elle est cherchee DANS
    // l'ecran qu'on ouvre — jamais dans tout le document.
    //
    // MEME COMPORTEMENT QUE LE RESTE : on arrive en haut. C'est le choix
    // deja fait pour .screen et pour le document, et deux regles opposees sur
    // un meme geste seraient pires qu'une regle qu'on discute.
    try{ s.querySelectorAll('.zone-defilante').forEach(_z=>{ _z.scrollTop=0; }); }catch(_e){}
    try{ window.scrollTo({top:0,left:0,behavior:'instant'}); }
    catch(_e){ try{ window.scrollTo(0,0); }catch(_e2){} }
  }
  // Après l'affichage : la barre suit l'écran courant, quel que soit le chemin
  // emprunté pour y arriver (onglet, flèche retour, redirection interne).
  _majTabbar(id);
  // B2.1 — ET LA BARRE LATERALE DU BUREAU AUSSI, pour exactement la meme
  // raison et au meme endroit. Elle designait le dernier ONGLET visite, pas
  // l'ecran ouvert.
  _majBarreCoach();
  // ── L'ÉCRAN D'INSTALLATION SE DÉCIDE À L'OUVERTURE ────────────────────
  //
  // C'ETAIT LE DEFAUT : rcInstallDecider() n'etait appelee QUE depuis
  // _rcInviteArrivee(), c'est-a-dire uniquement quand le navigateur envoyait
  // beforeinstallprompt. Partout ailleurs — le routage de demarrage, le
  // fragment #install de la page de vente, la banniere de relance — l'ecran
  // s'ouvrait tel qu'il est ecrit dans le document : TOUS les blocs en
  // display:none, le bouton principal cache et sans libelle, le sous-titre
  // vide. Il ne restait a l'ecran que « Installe RepCore. » et le lien de
  // sortie. Un ecran d'installation sans aucun moyen d'installer.
  //
  // ICI ET NON CHEZ LES APPELANTS, pour la meme raison que le pre-remplissage
  // du code juste en dessous : quatre chemins menent a s-install et go() est
  // le seul par lequel ils passent tous.
  if(id==='s-install'){ try{ rcInstallDecider(); }catch(e){} }
  // Pre-remplissage du code en attente, pose ICI et non chez les appelants :
  // cinq chemins menent a s-client-code (doRegister, doLogin, la reprise de
  // session, doNewPwdRecovery, les boutons « entrer un code ») et seuls deux
  // pre-remplissaient. Au centre, le comportement est le meme quel que soit
  // le chemin, et un chemin ajoute plus tard en herite.
  if(id==='s-client-code'){
    try{
      const _pc=localStorage.getItem('pendingCode');
      const _in=document.getElementById('cc-code');
      if(_pc&&_in&&!_in.value) _in.value=_pc;
    }catch(e){}
  }
  // LE SÉLECTEUR DE COMPTES, sur l’écran de connexion. Posé ICI pour la même
  // raison que le pré-remplissage ci-dessus : plusieurs chemins mènent à
  // s-login — « Ajouter un compte », la déconnexion, le retour depuis
  // l’accueil — et n’en instrumenter qu’un laisserait les autres sans rien.
  //
  // SEULEMENT SI UN COMPTE PORTE DES JETONS. Sans eux, basculerCompte pose
  // _jetonsPoser(null) : on arrive sur le compte sans être authentifié.
  // Afficher le sélecteur promettrait alors une bascule sans mot de passe
  // qui n’en serait pas une — c’est précisément le défaut qu’on corrige.
  //
  // REMPLI À CHAQUE PASSAGE, jamais une seule fois : le registre change à la
  // connexion, à l’ajout et au retrait, et un rendu figé le dirait faux.
  if(id==='s-login'){
    try{
      const _z=document.getElementById('l-comptes');
      if(_z){
        // LE MÊME PRÉDICAT que celui du rendu, et non une seconde copie :
        // c’est leur divergence qui affichait ici des comptes que ce filtre
        // venait pourtant d’écarter.
        const _avecJetons=comptesConnectes().filter(_compteAvecJetons);
        _z.innerHTML=_avecJetons.length?htmlSelecteurComptes({jetonsRequis:true}):'';
      }
    }catch(e){}
  }
  // Étapes de tunnel adossées à l'affichage d'un écran. Posées ici plutôt que
  // chez les appelants : plusieurs chemins mènent à chacun de ces écrans, et
  // n'en instrumenter qu'un donnerait un tunnel faux sans que ça se voie.
  if(id==='s-welcome'){
    rcmVue('welcome_view');
    // LES DEUX FORMULES SE PEIGNENT A L'ARRIVEE (lot 2) : leurs prix viennent
    // d'OFFRES, et l'ecran doit les montrer des la premiere ouverture.
    try{ accueilRendreTarifs(); }catch(e){}
  }
  if(id==='s-register') rcmVue('register_started');
  // L'ECRAN D'INSTALLATION EST LE HAUT DU TUNNEL, et il se rejoint par trois
  // chemins : le demarrage, le fragment #install, et un retour arriere. La
  // meme raison que les deux lignes ci-dessus impose de le compter ici.
  if(id==='s-install'){
    rcmVue('install_ecran_vu');
    // ET LA BANNIERE SE TAIT POUR TOUTE LA VISITE. « Jamais au premier
    // lancement » veut dire : jamais dans une session ou l'ecran a deja
    // pose la question. Les trois chemins qui menent ici passent par go(),
    // donc ce marquage les couvre tous.
    // sessionStorage ET NON localStorage : c'est la VISITE qu'on borne, pas
    // la vie de l'appareil — et le stockage local est deja sature.
    try{ sessionStorage.setItem('rc_inst_ecran','1'); }catch(e){}
  }
  // ANIMATION 9 — les courbes SVG. Posé ICI et pas chez les appelants pour la
  // même raison que les deux lignes ci-dessus : _courbePesee et _rapCourbePoids
  // rendent des CHAÎNES, insérées au milieu d'un innerHTML bien plus grand par
  // plusieurs chemins. Il n'existe aucun moment où l'une d'elles « se monte »
  // — le seul instant commun est l'affichage de l'écran qui la contient.
  // Reporté d'une frame : à cette ligne, l'écran vient d'être affiché mais son
  // contenu est peint par le loadX() qui suit. Les canvas, eux, ont leur propre
  // rappel au moment du dessin — le WeakSet garantit qu'aucun ne joue deux fois.
  if(s){ try{ requestAnimationFrame(()=>arcTracerCourbes(s)); }catch(e){} }
  // L'ENTRÉE D'HISTORIQUE, en dernier et sous deux conditions.
  //
  // APRÈS l’affichage : les retours anticipés plus haut — rechargement
  // _swUpdatePending, accès refusé qui rappelle go() ailleurs — ne doivent
  // rien empiler. Celui du rechargement quitte la page de toute façon.
  //
  // Sur un VRAI changement : go() vers l’écran courant est fréquent —
  // loadCoachHome le fait toutes les 30 s — et empiler là remplirait la pile
  // d’entrées identiques. Il faudrait autant d’appuis pour en sortir.
  // ET L'ORIGINE, sous la MÊME condition : un changement d'écran réel, pas
  // provoqué par un retour. C’est le même événement, il n’y a pas de raison
  // que les deux mémoires en aient chacune une lecture.
  //
  // _ecranOrigine n’était écrit que par goAvecRetour, employée sur CINQ écrans
  // sur 53 : partout ailleurs, le retour matériel ramenait à l’accueil au lieu
  // de l’écran précédent.
  if(!_navParHistorique&&id!==_avant){
    // DEUX ORIGINES NE S ECRIVENT JAMAIS.
    //
    // s-splash : c’est l’écran actif au chargement, donc l’origine du PREMIER
    // écran routé de la session. Le retour matériel y ramenait, sur un écran
    // d’amorçage que rien ne sait plus rendre.
    //
    // ET CELLE QUI REBOUCLE : si `_avant` a déjà `id` pour origine, écrire
    // l’inverse crée un va-et-vient sans fin — c’est exactement ce que
    // s-access-gate et s-subscribe faisaient, l’aller par goAvecRetour et le
    // retour par retourDe.
    // R21 — LA REGLE EST DANS _origineAEcrire : plus seulement le va-et-vient
    // a deux ecrans, mais toute boucle, et jamais un ecran de saisie.
    // ET UN RETOUR N'ECRIT AUCUNE ORIGINE : revenir sur A depuis B ne fait pas
    // de B l'origine de A. L'ancienne garde ne le savait que lorsque l'origine
    // de B etait deja A ; un retour vers l'ecran PAR DEFAUT (aucune origine
    // connue) ecrivait donc l'inverse, et deux ecrans se renvoyaient la main.
    if(!_navRetourEnCours){
      const _o=_origineAEcrire(_avant,id);
      if(_o===null) delete _ecranOrigine[id];
      else if(_o) _ecranOrigine[id]=_o;
    }
    _histPousser(id);
  }
}
// ── Retour vers l'écran d'origine ───────────────────────────────────────────
// La navigation se fait en basculant la classe .active entre les div.screen.
// On mémorise l’origine à l’ouverture plutôt que d’y coder une destination en
// dur : ces écrans sont atteignables depuis plusieurs endroits.
//
// AUCUN BOUTON de l’interface n’appelle history.back() — une assertion le
// surveille. Le retour MATÉRIEL, lui, passe par le bloc juste en dessous, qui
// réutilise _ecranOrigine comme source de l’écran précédent.
const _ecranOrigine={};
// ══ R21 — CE QUI PEUT ETRE UNE ORIGINE ══════════════════════════════════
//
// LES ECRANS DE SAISIE NE SONT JAMAIS L'ORIGINE D'UN AUTRE. Un formulaire qui
// enregistre avance vers l'ecran suivant : l'ajout d'un aliment rouvre la
// nutrition, la connexion ouvre l'accueil. Retenu comme origine, il faisait
// revenir SUR LE FORMULAIRE qu'on vient de valider. On remonte donc a SA
// propre origine — l'ecran d'ou le formulaire avait ete ouvert.
//
// Seulement des saisies qu'on quitte en avancant. Les editeurs a garde
// (s-coach-program, s-proto-edit) n'y sont pas : goAvecRetour y pose une
// origine explicite, qu'une inference ici ecraserait.
// R32 — s-bilan-fait y figure aussi : c'est la sortie d'une saisie. Depuis
// « Voir ma progression », le retour doit rendre l'accueil, pas cet ecran.
const ECRANS_DE_SAISIE=new Set(['s-bilan-fait','s-food-add','s-food-perso','s-supplement-edit',
  's-caffeine-add','s-eviction-edit','s-traitement-edit','s-bilan','s-workout',
  's-scan','s-login','s-register','s-identite','s-naissance','s-consent-sante',
  's-client-code','s-coach-code','s-welcome','s-coach-entry','s-athlete-entry','s-install']);
// PURE (a la lecture de _ecranOrigine pres). L'origine a ecrire pour `id`
// quand on y arrive depuis `avant` : un ecran, `undefined` pour ne rien
// changer, `null` pour effacer.
//
// ⚠ AUCUNE BOUCLE, DE QUELQUE LONGUEUR QUE CE SOIT. L'ancienne garde ne
// voyait que le va-et-vient a deux ecrans (A → B → A). Les onglets en font de
// plus longs : Nutrition → Corrections → Évolution → Nutrition ecrivait
// Nutrition ← Évolution ← Corrections ← Nutrition, et la fleche tournait
// entre les trois sans jamais rendre l'accueil. On suit donc la chaine des
// origines depuis le candidat : si elle repasse par `id`, on n'ecrit rien et
// l'origine d'avant — celle qui ne boucle pas — reste en place.
function _origineAEcrire(avant,id){
  if(!avant||avant==='s-splash'||avant===id) return undefined;
  let o=avant, garde=0;
  while(o&&ECRANS_DE_SAISIE.has(o)&&garde++<20) o=_ecranOrigine[o];
  // Une saisie sans origine connue : aucune origine plutot qu'une fausse. Le
  // retour retombera sur l'accueil du role, qui est previsible.
  if(!o||o==='s-splash') return null;
  if(o===id) return undefined;
  for(let x=o,n=0;x&&n<60;x=_ecranOrigine[x],n++) if(x===id) return undefined;
  return o;
}
function goAvecRetour(id){
  const actif=document.querySelector('.screen.active')?.id;
  // Rentrer sur l'écran depuis lui-même (rechargement de sa propre liste) ne
  // doit pas écraser l'origine par lui-même, sinon le retour tourne en rond.
  if(actif&&actif!==id) _ecranOrigine[id]=actif;
  go(id);
}
// ══ R21 — LE RETOUR REPEINT L'ECRAN RETROUVE ════════════════════════════
// Les fleches ecrites en dur appelaient le chargeur de leur destination —
// « go('s-client-home');loadClientHome() », « loadNutrition() ». Un retour
// par retourDe ne faisait que go() : l'ecran retrouve aurait montre ce qu'il
// affichait AVANT la saisie qu'on vient de faire. Ces chargeurs-la, et
// seulement eux, sont rappeles.
// `nav` : le chargeur appelle go() lui-meme. On l'appelle alors A LA PLACE
// de go(), pour que le sens de l'animation reste celui d'un retour.
const RETOUR_RECHARGE=Object.freeze({
  's-client-home':{f:()=>loadClientHome(),nav:false},
  's-coach-home':{f:()=>loadCoachHome(),nav:true},
  's-nutrition':{f:()=>loadNutrition(),nav:true},
  's-supplements':{f:()=>loadSupplements(),nav:true},
  's-historique-seances':{f:()=>loadHistoriqueSeances(),nav:true},
  's-coach-programs':{f:()=>loadCoachProgramsList(),nav:false}
});
// Leve le temps d'un retour : go() n'ecrit alors aucune origine. Voir go().
let _navRetourEnCours=false;
function retourDe(id,defaut){
  _sensNav='ar';
  const cible=_ecranOrigine[id]||defaut||(currentUser?.role==='coach'?'s-coach-home':'s-client-home');
  const r=RETOUR_RECHARGE[cible];
  const avant=_navRetourEnCours;
  _navRetourEnCours=true;
  try{
    if(r&&r.nav){ try{ r.f(); return; }catch(e){} }
    go(cible);
    // Seulement si go() a bien abouti : la garde de role peut rediriger.
    if(r&&!r.nav&&document.querySelector('.screen.active')?.id===cible){ try{ r.f(); }catch(e){} }
  } finally { _navRetourEnCours=avant; }
}
// ══════════════════ RETOUR MATÉRIEL (Android) ══════════════════════════
//
// Le manifeste déclare "display":"standalone" : l’application n’a pas de
// barre d’adresse, et le bouton matériel est le SEUL retour du système.
// Comme rien n’empilait d’état d’historique, chaque appui SORTAIT de
// l’application — en pleine séance, en plein bilan, n’importe où.
//
// go() empile une entrée par changement d’écran réel ; ce handler la
// consomme et rappelle go() SANS en repousser une — d’où _navParHistorique,
// sans quoi la pile ne se viderait jamais et l’app ne pourrait plus se
// fermer du tout : le défaut inverse, tout aussi bloquant.
//
// L'ÉCRAN PRÉCÉDENT VIENT DE retourDe, donc de _ecranOrigine. On ne tient pas
// une seconde pile : deux mémoires de la même chose finiraient par se
// contredire, et c’est déjà ce que le produit évite pour les boutons retour.
const HIST_RACINES=['s-welcome','s-coach-home','s-client-home','s-entrainement','s-mon-coach'];
// Les deux écrans qu’on ne quitte pas par mégarde. Le texte dit ce qui est
// gardé : sans cela, « Quitter ? » se répond au hasard.
const HIST_CONFIRME={
  's-workout':['Quitter la séance ?','Ta séance est enregistrée au fur et à mesure : tu la retrouveras en cours.','Quitter','Rester'],
  's-bilan':['Quitter le bilan ?','Tes réponses sont gardées en brouillon : tu reprendras où tu en étais.','Quitter','Rester']
};
// Deux secondes : au-delà, le deuxième appui n’est plus une confirmation mais
// un nouveau geste.
const HIST_QUITTER_MS=2000;
// LE SENS DE LA PROCHAINE NAVIGATION. Consomme par go(), remis a 'av'
// immediatement : un seul go() consomme le sens, jamais deux.
let _sensNav='av';
// Les .back-btn qui ne passent pas par retourDe() — fermetures dediees et
// retours forces, recenses au lot R21 — posent aussi le sens « retour » :
// une seule ecoute deleguee, en capture et passive, les couvre toutes.
document.addEventListener('pointerdown',e=>{
  if(e.target&&e.target.closest&&e.target.closest('.back-btn')) _sensNav='ar';
},{passive:true,capture:true});
let _navParHistorique=false;
let _histQuitter=0;
let _histSortie=false;
// UNE SEULE ENTREE au-dessus de l’entrée initiale, jamais une par écran.
//
// La pile grandissait d’un cran par écran visité, alors qu’un appui sur retour
// n’en consomme qu’un tout en remontant DIRECTEMENT à l’origine : après dix
// écrans, il aurait fallu dix appuis pour vider ce que l’accueil ne consommait
// pas. Sur un écran racine, le second appui reculait alors de deux crans dans
// une pile profonde — on restait DANS l’application, sur une vieille entrée,
// et comme go() n’était pas appelé, rien ne changeait à l’écran.
//
// `rcScreen` sert de MARQUEUR de présence, pas de mémoire : l’écran précédent
// vient de _ecranOrigine, et rien ne relit cette valeur. On la garde parce
// qu’un état vide serait indiscernable de l’entrée initiale.
function _histPousser(id){
  try{
    if(history.state&&history.state.rcScreen) return;
    history.pushState({rcScreen:id},'');
  }catch(e){}
}
// PURE-ish : elle ne fait que regarder. Deux calques peuvent être ouverts —
// les feuilles (#modal-overlay) et la demande de confirmation (#rc-confirm),
// qui n’est pas une feuille et ne se ferme pas avec closeModal().
// TROIS calques peuvent être ouverts : les feuilles (#modal-overlay), la
// demande de confirmation (#rc-confirm) et la SAISIE (#rc-saisie). Les deux
// dernières ne sont pas des feuilles et ne se ferment pas avec closeModal().
//
// #rc-saisie manquait : un retour matériel pendant une saisie changeait d’écran
// en laissant le calque affiché par-dessus, promesse en attente pour toujours.
function _histCalqueOuvert(){
  if(document.getElementById('modal-overlay')) return true;
  // LA MODALE DE PAUSE, AVANT LES DEUX AUTRES. Elle s’ouvre par-dessus la
  // séance et n’était pas comptée : le retour matériel tombait en cas 4,
  // déléguait la flèche de s-workout, et la modale restait affichée
  // par-dessus l’accueil.
  // `!dataset.sortie` : pendant les 140 ms de sortie la feuille est encore en
  // flex, et un appui sur retour serait alors mange une seconde fois.
  const _wp=document.getElementById('wo-pause-modal');
  if(_wp&&_wp.style.display==='flex'&&!_wp.dataset.sortie) return true;
  // R26 — la feuille « Mon approche » : le retour la ferme et reste sur la
  // nutrition, comme le voile et « Annuler ».
  // L'ACHAT, LA VENTE, LE CONTACT ET LE LEXIQUE manquaient, alors que
  // _histFermerCalque sait les fermer : le retour tombait plus bas, go()
  // les fermait au passage, et l'ecran changeait avec. Meme ordre que
  // _histFermerCalque, pour qu'on lise les deux listes cote a cote.
  for(const id of ['rc-achat','rc-progvente','rc-vente','rc-contact','rc-recherche','rc-lexique','rc-histo','rc-diete','rc-confirm','rc-saisie']){
    const z=document.getElementById(id);
    if(z&&z.style.display==='flex'&&!z.dataset.sortie) return true;
  }
  return false;
}
function _histFermerCalque(){
  // LA MODALE DE PAUSE D’ABORD, ET À LA MAIN. Contrairement aux deux
  // suivantes elle ne rend aucune promesse et personne ne l’attend : la
  // masquer suffit, c’est ce que fait déjà son bouton « Continuer la séance ».
  // LE LEXIQUE D'ABORD, parce qu'il peut s'ouvrir PAR-DESSUS les autres : on
  // demande « c'est quoi RIR ? » depuis un ecran qui a lui-meme un calque
  // ouvert. Le retour doit defaire le dernier geste, pas l'avant-dernier.
  const _ah=document.getElementById('rc-achat');
  if(_ah&&_ah.style.display==='flex'&&!_ah.dataset.sortie){ fermerAchatProgramme(); return; }
  const _pv=document.getElementById('rc-progvente');
  if(_pv&&_pv.style.display==='flex'&&!_pv.dataset.sortie){ fermerVenteProgramme(); return; }
  const _vb=document.getElementById('rc-vente');
  if(_vb&&_vb.style.display==='flex'&&!_vb.dataset.sortie){ fermerFicheVente(); return; }
  const _ct=document.getElementById('rc-contact');
  if(_ct&&_ct.style.display==='flex'&&!_ct.dataset.sortie){ fermerContactCoach(); return; }
  const _rh=document.getElementById('rc-recherche');
  if(_rh&&_rh.style.display==='flex'&&!_rh.dataset.sortie){ fermerRecherche(); return; }
  const _lx=document.getElementById('rc-lexique');
  if(_lx&&_lx.style.display==='flex'&&!_lx.dataset.sortie){ rcInfoFermer(); return; }
  // L'historique d'un exercice, APRES le lexique : ce dernier peut s'ouvrir
  // par-dessus n'importe quoi, et le retour defait le dernier geste.
  const _hx=document.getElementById('rc-histo');
  if(_hx&&_hx.style.display==='flex'&&!_hx.dataset.sortie){ fermerHistoriqueExo(); return; }
  const _dc=document.getElementById('rc-diete');
  if(_dc&&_dc.style.display==='flex'&&!_dc.dataset.sortie){ fermerChoixDiete(); return; }
  const _wp=document.getElementById('wo-pause-modal');
  if(_wp&&_wp.style.display==='flex'&&!_wp.dataset.sortie){ _feuilleFermer('wo-pause-modal'); return; }
  // PAR LEUR BOUTON « non » : c’est lui qui résout la promesse. Les fermer à
  // la main laisserait l’appelant attendre pour toujours.
  for(const id of ['rc-confirm','rc-saisie']){
    const z=document.getElementById(id);
    if(z&&z.style.display==='flex'&&!z.dataset.sortie){
      const non=document.getElementById(id+'-non');
      if(non&&typeof non.onclick==="function"){ non.onclick(); return; }
      _feuilleFermer(id); return;
    }
  }
  closeModal();
}
function _histRetour(actuel){
  _sensNav='ar';
  _navParHistorique=true;
  try{ retourDe(actuel); } finally { _navParHistorique=false; }
}
// Exporté pour le banc et la suite de tests : le handler lui-même n’est pas
// atteignable autrement, et le vérifier par sa seule lecture ne prouve rien.
function _histPopstate(){
  const actuel=document.querySelector('.screen.active')?.id;
  if(!actuel){ return; }
  // 1. UN CALQUE OUVERT SE FERME D’ABORD, et rien d’autre ne bouge. On
  //    repousse une entrée : celle qui vient d’être consommée décrivait
  //    l’écran, pas le calque, et sans elle la pile aurait perdu un cran.
  if(_histCalqueOuvert()){ _histFermerCalque(); _histPousser(actuel); return; }
  // 2. SÉANCE ET BILAN : on demande avant de sortir. La question est
  //    asynchrone, donc on repousse TOUT DE SUITE — on reste pendant qu’elle
  //    est posée — et on ne s’en va que si la réponse est oui.
  const q=HIST_CONFIRME[actuel];
  if(q){
    _histPousser(actuel);
    try{
      // LE TROISIÈME CHEMIN DE SORTIE DE SÉANCE. Il quittait l’écran sans
      // baisser le drapeau, comme la pause et l’annulation avant ce lot.
      Promise.resolve(rcConfirm(q[0],q[1],q[2],q[3])).then(ok=>{
        if(!ok) return;
        if(actuel==='s-workout'){ try{ _quitterEcranSeance(true); }catch(e){} }
        // LA QUATRIEME SORTIE DU BILAN. Elle ne passe pas par bilBack, et
        // laissait donc `bilData` plein — la bascule de compte restait
        // interdite jusqu’à la fermeture de l’app.
        if(actuel==='s-bilan'){ try{ _quitterEcranBilan(true); }catch(e){} }
        _histRetour(actuel);
      });
    }catch(e){}
    return;
  }
  // 3. ÉCRAN RACINE : on laisse l’application se fermer, mais pas au premier
  //    appui — sortir par erreur d’une app sans barre d’adresse est agaçant.
  if(HIST_RACINES.includes(actuel)){
    if(Date.now()-_histQuitter<HIST_QUITTER_MS){
      // Deuxième appui : on consomme l’entrée du dessous pour que le système
      // referme l’application. Le drapeau BORNE l’opération à un seul saut —
      // sans lui, le popstate suivant repasserait ici et viderait
      // l’historique du navigateur, y compris ce qui ne nous appartient pas.
      // ON NE REPOSE RIEN. Le popstate vient de consommer la sentinelle : nous
      // sommes sur l’entrée initiale, et history.back() sort donc de
      // l'application plutôt que de reculer dans une pile d'écrans.
      //
      // Le drapeau BORNE l’opération à un seul saut. Il servait à absorber le
      // popstate que provoquait ce back() dans une pile profonde ; il ne peut
      // plus s’en produire, mais l’application peut avoir été ouverte depuis un
      // lien, auquel cas une entrée étrangère reste dessous.
      if(_histSortie) return;
      _histSortie=true;
      setTimeout(()=>{_histSortie=false;},1500);
      try{ history.back(); }catch(e){}
      return;
    }
    _histQuitter=Date.now();
    try{ toast('Appuie encore pour quitter'); }catch(e){}
    _histPousser(actuel);
    return;
  }
  // 4. L'ÉCRAN A SON PROPRE BOUTON RETOUR : c'est LUI qui décide.
  //
  //    s-coach-program et s-proto-edit recâblent leur .back-btn avec un garde
  //    de modifications non enregistrées. Le retour matériel les contournait et
  //    quittait sans rien demander : le travail était perdu en silence.
  //
  //    Déléguer plutôt qu’allonger HIST_CONFIRME : une table figée redirait ce
  //    que les écrans savent déjà, et il faudrait y penser au prochain écran
  //    qui se dote d’un garde. C’est aussi ce qui fait que la flèche affichée
  //    et le bouton matériel mènent enfin au même endroit.
  //
  //    L’entrée est repoussée AVANT l’appel : la question peut être
  //    asynchrone, et sans elle la pile perdrait un cran pendant qu’elle est
  //    posée. _histPousser ne pose qu’une sentinelle, l’appel à go() qui suivra
  //    n’en ajoutera donc pas une seconde.
  //    LA DERNIÈRE VISIBLE, PAS LA PREMIÈRE. s-coach-plan en porte deux : celle
  //    de sa barre de titre, et celle de la surcouche #cpl-search qui referme
  //    la recherche d’aliment. querySelector rendait la première : un retour
  //    matériel pendant la recherche quittait la composition entière et perdait
  //    ce qui n’était pas enregistré — l’inverse exact de ce à quoi la
  //    surcouche sert. Dernière, parce qu’une surcouche est déclarée APRÈS la
  //    barre qu’elle recouvre ; visible, parce qu’elle est en display:none le
  //    reste du temps et qu’il faut alors retomber sur la barre de titre.
  //
  //    getClientRects() et non offsetParent : ce dernier rend null pour tout
  //    élément en position:fixed, visible ou non. En cas de doute on répond
  //    VISIBLE, ce qui conserve le comportement d’avant.
  //
  //    s-coach-plan est le SEUL écran à deux flèches — les 58 ont été comptés.
  const _fl=document.querySelectorAll('#'+actuel+' .back-btn');
  let _bk=null;
  for(let _i=0;_i<_fl.length;_i++){
    const _b=_fl[_i];
    let _vu=true;
    try{ if(typeof _b.getClientRects==='function') _vu=_b.getClientRects().length>0; }catch(e){}
    if(_vu) _bk=_b;
  }
  if(_bk&&typeof _bk.onclick==='function'){
    _histPousser(actuel);
    // LE DRAPEAU EST LEVE ICI AUSSI, comme dans _histRetour : sans lui, le
    // go() declenche par la flèche écrivait l’origine À L’ENVERS.
    //
    // RELACHE APRES LA PROMESSE, pas au retour synchrone : trois écrans
    // recâblent leur flèche avec un garde de modifications non enregistrées,
    // et ces handlers-là sont `async`. Relâcher tout de suite laisserait le
    // go() qui suit la confirmation s’exécuter drapeau baissé.
    _navParHistorique=true;
    let _p=null;
    try{ _p=_bk.onclick(); }catch(e){}
    if(_p&&typeof _p.then==='function') Promise.resolve(_p)
      .then(()=>{_navParHistorique=false;},()=>{_navParHistorique=false;});
    else _navParHistorique=false;
    return;
  }
  // 5. LE CAS COURANT : aucun bouton retour à l’écran, on remonte à l’origine.
  //
  //    LA SENTINELLE EST REPOUSSÉE ICI AUSSI, comme dans les quatre cas
  //    précédents. _histRetour appelle go() avec _navParHistorique levé, ce
  //    qui bloque justement le _histPousser de go() : après un retour depuis
  //    un écran sans .back-btn — s-client-code, s-coach-code, s-bilan-choice,
  //    s-access-gate — la sentinelle avait disparu, et l’appui suivant
  //    fermait l’application sans le double appui.
  _histPousser(actuel);
  _histRetour(actuel);
}
try{ window.addEventListener('popstate',_histPopstate); }catch(e){}
// ══════════════════════ ARC — SYSTÈME D'ANIMATION ══════════════════════
// Le pendant JS de la section « ARC » de la feuille de style. Toute animation
// du produit passe par ces trois primitives — arcFlash (le flash de décharge),
// arcGlow (la rémanence), arcDecharge (le cycle en trois temps). Aucune valeur
// d'animation ne doit être écrite ailleurs qu'ici ou dans les variables CSS.
//
// POURQUOI LES MÊMES VALEURS DES DEUX CÔTÉS. Les durées, les courbes et les
// amplitudes existent en variables CSS (pour les états gouvernés par la
// feuille, :active en tête) ET dans l'objet ci-dessous, parce que la Web
// Animations API ne lit pas les variables CSS. C'est UNE duplication assumée,
// et elle est verrouillée par une assertion qui compare les deux sources — pas
// deux vérités laissées libres de diverger en silence.
const ARC=Object.freeze({
  // CES NOMBRES DOIVENT RESTER EGAUX AUX TOKENS CSS --t-0..--t-4 :
  // attack=--t-0, strike=--t-1, release=--t-3, afterglow=--t-4,
  // ambient=--t-boucle, plat=--t-1. Une seule echelle, deux ecritures.
  attack:90, strike:120, release:320, afterglow:620, ambient:2400,
  plat:120,                                   // variante « animations réduites »
  // ET CES TROIS COURBES DOIVENT RESTER EGALES AUX TOKENS CSS
  // --arc-c-charge / --arc-c-discharge / --arc-c-snap. Meme courbe, deux
  // ecritures — le CSS ecrit « .16,1,.3,1 », le JS « 0.16,1.00,0.30,1.00 ».
  charge:'cubic-bezier(0.40,0.00,0.90,0.20)',
  // LA DECHARGE A DIVERGE, et longtemps : le JS jouait 0.05,0.70,0.10,1.00 quand
  // le CSS jouait 0.16,1,0.30,1. Deux textures de mouvement dans la meme
  // interface, sur le meme geste, selon que l'animation venait d'une transition
  // ou de la Web Animations API.
  //
  // C'EST LE CSS QUI A GAGNE, et le comptage ne laissait pas le choix : sur
  // l'application chargee, 198 elements rendus portent 0.16,1,0.30,1 —
  // --arc-c-discharge n'en est qu'un alias, la vraie source est --c-out, le
  // token de sortie de TOUTE l'application, appele 95 fois en direct. La valeur
  // du JS, elle, n'etait portee par AUCUN element : elle ne vivait que dans les
  // dix-sept appels a element.animate(). Aligner dix-sept appels sur cent
  // dix-huit regles, et non l'inverse.
  discharge:'cubic-bezier(0.16,1.00,0.30,1.00)',
  // SNAP N'EST PAS --c-snap, malgre le nom. --c-snap vaut .2,1.5,.4,1 : il
  // DEPASSE puis revient, c'est la courbe des deux « pop » de badge. Celle-ci ne
  // depasse pas — le depassement du cycle ARC vient des paliers de scale, pas de
  // la courbe. Deux gestes differents, deux courbes differentes, un mot commun.
  snap:'cubic-bezier(0.20,0.00,0.00,1.00)',
  scaleCharge:0.94, scaleImpact:1.14, scaleSettle:0.97,
  translate:24, glowRadius:18, glowRest:6, flashPeak:0.85
});

// « Réduire les animations » du système. RELU À CHAQUE APPEL, jamais mis en
// cache dans un booléen : le réglage se change sans recharger l'application, et
// une valeur figée au démarrage l'aurait ignoré jusqu'au lancement suivant.
// Seul l'objet MediaQueryList est conservé — c'est sa création qui coûte, pas
// la lecture de .matches, qui est un simple champ.
let _arcMq=null;
function arcReduit(){
  try{
    if(!_arcMq&&window.matchMedia) _arcMq=window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(_arcMq&&_arcMq.matches);
  }catch(e){ return false; }
}

// ══ LA SEULE FAÇON D'ANIMER EN JS ═══════════════════════════════════════════
// Aucune ligne du fichier ne doit appeler element.animate() directement : la
// préférence système « réduire les animations » ne s'applique PAS à la Web
// Animations API, et le garde recopié à la main finit toujours par être oublié
// une fois. Rend l'Animation, ou null quand rien n'a été joué — l'appelant peut
// donc attendre .finished et distinguer « fini » de « jamais parti ».
function _animer(el,keyframes,options){
  if(!el||!el.animate) return null;
  if(arcReduit()){
    // On POSE l'image finale au lieu de ne rien faire : une animation qui
    // portait la mise en forme (opacity:0 → 1) figerait l'élément invisible.
    try{
      const fin=Array.isArray(keyframes)?keyframes[keyframes.length-1]:null;
      if(fin&&(options&&options.fill&&options.fill!=='none'))
        Object.keys(fin).forEach(k=>{ if(k!=='offset'&&k!=='easing') el.style[k]=fin[k]; });
    }catch(e){}
    return null;
  }
  try{ return el.animate(keyframes,options); }catch(e){ return null; }
}

// scroll-behavior:auto!important du bloc prefers-reduced-motion ne peut PAS
// atteindre un scrollIntoView({behavior:'smooth'}) : l'option écrite en JS
// l'emporte sur la feuille de style. Un défilement plein écran est le seul
// mouvement de l'app qui rende réellement malade — il passe donc par ici.
function _defiler(el,o){
  if(!el||!el.scrollIntoView) return;
  const opt=Object.assign({block:'start'},o||{});
  opt.behavior=arcReduit()?'auto':(opt.behavior||'smooth');
  try{ el.scrollIntoView(opt); }
  catch(e){ try{ el.scrollIntoView(true); }catch(e2){} }
}

// UNE SEULE FOIS PAR ÉLÉMENT, et l'observateur se retire lui-même. Un
// observateur qui reste rallumerait l'animation à chaque passage : joli une
// fois, insupportable à la dixième. rootMargin négatif en bas : l'élément doit
// être franchement entré, pas effleurer le bord.
const _champVus=new WeakSet();
function _auChamp(el,fn){
  if(!el||typeof fn!=='function'||_champVus.has(el)) return false;
  // Rendu tout de suite, sans attendre le defilement (charte du 26/09/2026).
  if(ARC_VUE_AU_DEFILEMENT!==true||arcReduit()||!('IntersectionObserver' in window)){
    _champVus.add(el); try{fn(el);}catch(e){} return true;
  }
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(!e.isIntersecting||_champVus.has(e.target)) return;
      _champVus.add(e.target);
      io.unobserve(e.target);          // AVANT fn : si fn lève, l'observateur est déjà parti
      try{ fn(e.target); }catch(err){}
    });
  },{rootMargin:'0px 0px -12% 0px',threshold:0.15});
  io.observe(el);
  return true;
}

// Vibrations. TROIS RÉSERVES, dites ici une fois pour toutes :
//   1. iOS Safari n'implémente pas navigator.vibrate. Sur iPhone, AUCUNE de ces
//      lignes ne produit quoi que ce soit, et rien côté web n'y remédie. Le
//      système d'animation ne doit donc jamais faire PORTER une information par
//      la seule vibration — elle confirme, elle n'annonce pas.
//   2. L'API ne connaît que des durées en millisecondes. « légère » et
//      « lourde » sont des durées choisies, pas des moteurs haptiques distincts
//      comme en natif.
//   3. Elles SURVIVENT à « réduire les animations », par décision explicite :
//      c'est le mouvement à l'écran qui déclenche nausées et migraines, pas une
//      pulsation dans la paume.
// « avertir » reprend exactement le motif déjà employé par la fin de repos
// (180-90-180) : deux signaux d'avertissement qui se ressembleraient sans être
// identiques seraient pires que deux signaux franchement distincts.
// « foudre » : le craquement puis le grondement de rcFoudre — deux coups secs,
// un temps, et une longue qui roule. Distinct de « succes » à dessein : un
// record n'est pas une série de plus.
const ARC_VIBRE=Object.freeze({legere:12,moyenne:26,lourde:55,
  succes:[55,60,55],avertir:[180,90,180],foudre:[25,40,25,60,90],
  // Série 7 (lot 1) : la FIN DU REPOS seule, plus longue (un téléphone posé
  // sur le banc doit se faire entendre) ; et la pré-alerte à 10 s, brève.
  finRepos:[400,150,400,150,400],preAlerte:60});
function arcHaptique(nom){
  try{
    if(!navigator.vibrate) return false;
    const m=ARC_VIBRE[nom];
    if(m==null) return false;
    return !!navigator.vibrate(m);
  }catch(e){ return false; }
}

// LE CALQUE. Créé à la première étincelle et pas au démarrage : une application
// ouverte puis reposée n'a aucune raison de porter un nœud de plus.
// isConnected et pas seulement une variable : un innerHTML posé sur <body>
// détacherait le calque sans que la référence en sache rien, et toutes les
// animations suivantes se joueraient hors du document, invisibles.
let _arcCouche=null;
function _arcCalque(){
  if(_arcCouche&&_arcCouche.isConnected) return _arcCouche;
  _arcCouche=document.getElementById('arc-calque');
  if(!_arcCouche){
    _arcCouche=document.createElement('div');
    _arcCouche.id='arc-calque';
    // aria-hidden : rien de ce qui s'y peint ne porte de sens. Un lecteur
    // d'écran n'a pas à annoncer un halo.
    _arcCouche.setAttribute('aria-hidden','true');
    document.body.appendChild(_arcCouche);
  }
  return _arcCouche;
}
// Pose un nœud du calque à l'aplomb d'un rectangle écran. getBoundingClientRect
// rend des coordonnées VIEWPORT, et le calque est en position:fixed : les deux
// repères coïncident, aucun décalage de défilement à corriger.
function _arcPoser(n,r,marge){
  const m=marge||0;
  n.style.left=(r.left-m)+'px'; n.style.top=(r.top-m)+'px';
  n.style.width=Math.max(0,r.width+m*2)+'px';
  n.style.height=Math.max(0,r.height+m*2)+'px';
}
// Retire le nœud à la fin comme à l'annulation. Les deux, jamais un seul : une
// animation annulée n'émet PAS 'finish', et le nœud serait resté sur le calque
// à opacité nulle — invisible, et accumulé à chaque geste.
//
// LE PLAFOND N'EST PAS UNE PRÉCAUTION THÉORIQUE, il vient d'une mesure. Quand
// l'onglet passe en arrière-plan, le navigateur GÈLE la timeline des
// animations : elles ne se terminent plus, 'finish' n'arrive jamais, et les
// nœuds restent. Constaté à 15 nœuds sur une seule salve, page cachée. Ils
// repartent bien au retour au premier plan — ce n'est donc pas une fuite sans
// fond — mais un calque qui garde des restes d'une session à l'autre finirait
// par peser sur la première frame du retour. Deux gestes simultanés sont déjà
// beaucoup ; au-delà de ARC_CALQUE_MAX, le plus ancien part.
const ARC_CALQUE_MAX=12;
function _arcJeter(n,a){
  const fin=()=>{ try{ n.remove(); }catch(e){} };
  a.addEventListener('finish',fin); a.addEventListener('cancel',fin);
  const c=n.parentNode;
  while(c&&c.childElementCount>ARC_CALQUE_MAX&&c.firstElementChild!==n)
    c.removeChild(c.firstElementChild);
  return a;
}

// ── PRIMITIVE : la RÉMANENCE ───────────────────────────────────────────────
// Un halo posé sur le calque à l'aplomb de la cible, qui s'éteint en 380 ms.
// Rend l'Animation, ou null quand rien n'a été joué — l'appelant peut donc
// attendre .finished, et distinguer « éteint » de « jamais allumé ».
function arcGlow(cible,o){
  o=o||{};
  if(arcReduit()) return null;          // la variante plate n'a pas de trace
  const el=(typeof cible==='string')?document.getElementById(cible):cible;
  if(!el||!el.getBoundingClientRect) return null;
  const r=el.getBoundingClientRect();
  if(!r.width&&!r.height) return null;  // élément masqué : rien à éclairer
  const n=document.createElement('div');
  n.className='arc-halo';
  if(o.couleur) n.style.setProperty('--arc-halo-c',o.couleur);
  // Le halo épouse le rayon de la cible : un halo carré autour d'un bouton
  // arrondi se voit tout de suite, et se lit comme un défaut d'affichage.
  try{ n.style.borderRadius=getComputedStyle(el).borderRadius||'0'; }catch(e){}
  _arcPoser(n,r,2);
  _arcCalque().appendChild(n);
  return _arcJeter(n,_animer(n,
    [{opacity:0},{opacity:(o.pic==null?1:o.pic),offset:0.12},{opacity:0}],
    {duration:o.duree||ARC.release,easing:ARC.discharge,fill:'none'}));
}

// ── PRIMITIVE : le FLASH de décharge ───────────────────────────────────────
// Le point le plus chaud de l'arc. Accepte un ÉLÉMENT ou un POINT {x,y} : la
// validation de série part du doigt, pas du centre géométrique d'une ligne, et
// c'est cette différence-là qui donne une direction à l'énergie.
function arcFlash(cible,o){
  o=o||{};
  if(arcReduit()) return null;
  const n=document.createElement('div');
  n.className='arc-eclair';
  if(o.couleur) n.style.background=o.couleur;
  if(cible&&cible.nodeType===1){
    const r=cible.getBoundingClientRect();
    if(!r.width&&!r.height) return null;
    try{ n.style.borderRadius=getComputedStyle(cible).borderRadius||'0'; }catch(e){}
    _arcPoser(n,r,0);
  }else if(cible&&typeof cible.x==='number'&&typeof cible.y==='number'){
    const d=o.taille||64;
    n.style.borderRadius='50%';
    n.style.left=(cible.x-d/2)+'px'; n.style.top=(cible.y-d/2)+'px';
    n.style.width=d+'px'; n.style.height=d+'px';
  }else return null;
  _arcCalque().appendChild(n);
  return _arcJeter(n,_animer(n,
    [{opacity:0},{opacity:ARC.flashPeak,offset:0.30},{opacity:0}],
    {duration:o.duree||ARC.strike,easing:ARC.discharge,fill:'none'}));
}

// ── PRIMITIVE : le CYCLE EN TROIS TEMPS ────────────────────────────────────
// CHARGE 90 ms (scale ↓) · DÉCHARGE 140 ms (scale ↑, flash) · RÉMANENCE 380 ms
// (le halo s'éteint sur le calque).
//
// LE CYCLE DURE 610 ms ET NE FAIT JAMAIS ATTENDRE. Le geste de l'athlète a déjà
// produit son effet quand la charge démarre ; la rémanence se joue APRÈS coup,
// sur un calque qui n'intercepte rien. Le plafond de 400 ms du chemin critique
// porte sur ce qui retient l'athlète — ici les 230 ms de scale, et elles seules.
//
// UNE ANIMATION EN COURS EST TOUJOURS ANNULÉE PAR LA SUIVANTE. Un athlète qui
// tape deux fois de suite ne doit pas voir le second geste faire la queue
// derrière le premier : l'animation cède, jamais l'action.
//
// `base` : le transform À CONSERVER. La Web Animations API REMPLACE le
// transform pendant qu'elle joue. Sur un élément déjà centré par
// translateX(-50%) — #toast, par exemple — animer « scale(...) » seul l'aurait
// décalé de la moitié de sa largeur le temps de l'animation, puis remis en
// place. Le passer ici le compose au lieu de l'écraser.
const _arcEnCours=new WeakMap();
function arcDecharge(el,o){
  o=o||{};
  if(typeof el==='string') el=document.getElementById(el);
  if(!el||!el.animate) return null;
  const prec=_arcEnCours.get(el);
  if(prec){ try{ prec.cancel(); }catch(e){} }
  if(o.haptique) arcHaptique(o.haptique);
  const base=o.base?(o.base+' '):'';
  let a;
  if(arcReduit()){
    // VARIANTE PLATE, développée ICI et pas dans un lot « plus tard » : un
    // fondu d'opacité de 120 ms, aucun scale, aucune translation, aucun flash,
    // aucune trace. C'est le même appel pour l'appelant, qui n'a donc jamais à
    // savoir laquelle des deux il déclenche.
    a=el.animate([{opacity:0.55},{opacity:1}],
      {duration:ARC.plat,easing:'linear',fill:'none'});  // deja sous arcReduit()
  }else{
    const pic=(o.impact==null)?ARC.scaleImpact:o.impact;
    const tot=ARC.attack+ARC.strike;
    const t=ms=>ms/tot;
    a=_animer(el,[
      {transform:base+'scale(1)',                     easing:ARC.charge,    offset:0},
      {transform:base+'scale('+ARC.scaleCharge+')',   easing:ARC.discharge, offset:t(ARC.attack)},
      {transform:base+'scale('+pic+')',               easing:ARC.snap,      offset:t(ARC.attack+ARC.strike*0.42)},
      {transform:base+'scale('+ARC.scaleSettle+')',   easing:ARC.snap,      offset:t(ARC.attack+ARC.strike*0.74)},
      {transform:base+'scale(1)',                                           offset:1}
    ],{duration:tot,fill:'none'});
    // Les deux autres temps partent À LA FIN DE LA CHARGE, jamais avant : c'est
    // ce décalage qui fait lire l'impact comme la CONSÉQUENCE de la
    // compression, et non comme un effet posé à côté. Même règle que
    // l'haptique de la validation de série.
    setTimeout(()=>{
      // Le geste a pu être annulé entre-temps par un second appui : sans cette
      // garde, le flash du premier serait parti par-dessus le second.
      if(_arcEnCours.get(el)!==a) return;
      if(o.flash!==false) arcFlash(el,{couleur:o.couleur});
      if(o.halo!==false) arcGlow(el,{couleur:o.couleur});
    },ARC.attack);
  }
  _arcEnCours.set(el,a);
  const fin=()=>{ if(_arcEnCours.get(el)===a) _arcEnCours.delete(el); };
  a.addEventListener('finish',fin); a.addEventListener('cancel',fin);
  return a;
}

// ── PRIMITIVE : la TRAVERSÉE ───────────────────────────────────────────────
// Un arc de courant parcourt un élément de part en part, de gauche à droite.
// C'est le cœur du geste signature (validation de série) et la décharge de fin
// de repos. Rendu sur le calque, donc insensible au fait que la ligne de série
// soit reconstruite par renderSets à l'instant même où l'arc la traverse.
//
// La translation part de -100 % et va jusqu'à 265 % : l'arc entre entièrement
// par la gauche et sort entièrement par la droite, sans jamais apparaître ni
// disparaître sur place. Une opacité qui monte et redescend aurait donné une
// lueur qui clignote ; ici, quelque chose PASSE.
function arcTraversee(cible,o){
  o=o||{};
  if(arcReduit()) return null;
  const el=(typeof cible==='string')?document.getElementById(cible):cible;
  if(!el||!el.getBoundingClientRect) return null;
  const r=el.getBoundingClientRect();
  if(!r.width||!r.height) return null;
  const n=document.createElement('div');
  n.className='arc-trace';
  if(o.couleur) n.style.setProperty('--arc-trace-c',o.couleur);
  try{ n.style.borderRadius=getComputedStyle(el).borderRadius||'0'; }catch(e){}
  _arcPoser(n,r,0);
  const bar=document.createElement('div');
  bar.className='arc-trace-arc';
  n.appendChild(bar);
  _arcCalque().appendChild(n);
  const a=_animer(bar,
    [{transform:'translateX(-100%)'},{transform:'translateX(265%)'}],
    {duration:o.duree||ARC.strike,easing:ARC.discharge,fill:'none'});
  return _arcJeter(n,a);
}

// ── LE DERNIER POINT DE CONTACT ────────────────────────────────────────────
// « L'arc part du doigt » — encore faut-il savoir où il est. Les gestionnaires
// de cette application sont appelés depuis des onclick écrits dans des chaînes
// innerHTML : ils ne reçoivent AUCUN événement, et n'ont donc aucun moyen de
// connaître le point de contact. On le retient donc en amont, à la source.
// pointerdown et non pointerup : c'est l'appui qui désigne l'endroit, et un
// doigt peut glisser de quelques millimètres avant de se relever.
let _arcPoint=null;
function _arcNoter(e){
  try{
    if(e&&typeof e.clientX==='number'&&typeof e.clientY==='number')
      _arcPoint={x:e.clientX,y:e.clientY,t:Date.now(),el:e.target||null};
  }catch(err){}
}
// LE DERNIER ELEMENT, pour la meme raison que le dernier point : un onclick
// ecrit dans une chaine innerHTML ne recoit aucun evenement et ne peut donc
// pas remonter a sa propre ligne. Rend le premier ancetre qui repond au
// selecteur, et seulement si le contact est frais.
function arcDernierElement(selecteur){
  try{
    const p=arcDernierPoint();
    if(!p||!p.el||!p.el.closest) return null;
    return p.el.closest(selecteur);
  }catch(e){ return null; }
}
// Rend le dernier contact seulement s'il est FRAIS. Un point vieux d'une
// seconde ne désigne plus rien : une action déclenchée au clavier, par la
// reprise d'une séance ou par un minuteur ferait alors jaillir un arc depuis
// l'endroit où le doigt se trouvait à un tout autre moment. Sans point frais,
// l'appelant retombe sur le centre de l'élément — jamais sur un mensonge.
const ARC_POINT_FRAIS=1200;
function arcDernierPoint(fraicheur){
  if(!_arcPoint) return null;
  return (Date.now()-_arcPoint.t<=(fraicheur||ARC_POINT_FRAIS))?_arcPoint:null;
}

// ── PRIMITIVE : l'INTERPOLATION D'UNE VALEUR ───────────────────────────────
// « Le chiffre s'anime aussi, pas seulement la barre. » Une écriture de
// textContent par frame : un seul nœud de texte, aucun recalcul de mise en page
// tant que la largeur du texte ne change pas — d'où le conseil d'appliquer
// font-variant-numeric:tabular-nums à ce qu'on anime, sinon les chiffres de
// largeurs différentes font trembler ce qui les suit.
// requestAnimationFrame et non setInterval : la boucle s'arrête d'elle-même
// quand l'onglet passe en arrière-plan, au lieu de peindre pour personne.
// ══════ UN COMPTEUR ANIME NE SE RELIT PAS DANS SON PROPRE TEXTE ════════
//
// LE BUG, ET IL SE MORD LA QUEUE. Le score hebdomadaire « 3/7 » etait ranime
// depuis la valeur PRECEDEMMENT AFFICHEE, relue dans textContent puis nettoyee
// par replace(/[^\d.-]/g,''). Cette expression retire le « / » : « 3/7 »
// devient « 37 », lu 37 au lieu de 3. arcChiffre ecrit alors « 37/7 » dans le
// DOM, que le rendu suivant relit « 377 », puis « 3777 »… C'est l'origine
// exacte du 7777777/7 observe.
//
// LE TEXTE AFFICHE N'EST PAS UNE DONNEE. Il est mis en forme — une fraction,
// une unite, un separateur de milliers — et toute mise en forme est une
// transformation qu'on ne sait pas inverser a coup sur. On garde donc la
// valeur A COTE, dans un attribut qui n'appartient qu'a elle, et on la lit
// telle quelle.
//
// C'EST DEJA CE QUE FONT LES METRIQUES D'ACCUEIL, qui lisent data-num et n'ont
// jamais eu ce defaut. Cette fonction generalise leur patron aux compteurs qui,
// eux, doivent partir de la valeur precedente et non de zero.
function arcCompteur(el,vers,o){
  if(!el) return;
  const brut=el.dataset?el.dataset.valeur:undefined;
  const de=(brut===undefined||brut==='')?NaN:Number(brut);
  // ON RANGE LA VALEUR D'ARRIVEE TOUT DE SUITE, avant meme d'animer : si un
  // second rendu tombe pendant l'interpolation, il repart de la cible et non
  // d'une image intermediaire. C'est la seconde moitie du defaut d'origine.
  try{ if(el.dataset) el.dataset.valeur=String(vers); }catch(e){}
  const fmt=(o&&o.format)||(x=>String(Math.round(x)));
  // PREMIER RENDU, ou valeur inchangee : on pose, on n'anime pas. Animer depuis
  // rien ferait partir le compteur de zero a chaque ouverture d'ecran.
  if(!isFinite(de)||(de===vers&&!(o&&o.gresille))){ _arcEcrire(el,fmt(vers)); return; }
  try{ el.style.fontVariantNumeric='tabular-nums'; }catch(e){}
  arcChiffre(el,de,vers,o);
}
const _arcChiffres=new WeakMap();
// LE COMPTEUR, EN FONCTION DU TEMPS. arcChiffre l'appelle à chaque frame avec
// l'horloge de l'écran ; la vidéo (exporterVideoVisuel), avec le temps de la
// vidéo. Une seule courbe pour les deux : ce qu'on publie compte comme l'app.
/** Les 2 ou 3 valeurs du grésillement, tirées une fois ([] sans grésillement). */
function arcBruit(de,vers,gr){
  const nGr=gr?(2+(Math.random()<0.5?1:0)):0;
  const bruit=[];
  const amp=Math.max(Math.abs(vers-de)*0.6,Math.abs(vers)*0.05,2);
  for(let k=0;k<nGr;k++) bruit.push(vers+(Math.random()*2-1)*amp);
  return bruit;
}
/** PURE. La valeur affichée à la progression p (0..1). */
function arcValeurA(de,vers,p,bruit){
  const nGr=(bruit&&bruit.length)||0;
  const q=Math.max(0,Math.min(1,Number(p)||0));
  if(nGr&&q>=0.62&&q<1){
    // [0,62 ; 1[ découpé en nGr+1 plages : nGr valeurs au hasard, puis la vraie.
    const k=Math.floor((q-0.62)/(0.38/(nGr+1)));
    return k<nGr?bruit[k]:vers;
  }
  // Sortie longue, sans rebond : un chiffre qui dépasse sa valeur puis y
  // revient se lit comme une erreur de calcul, pas comme une animation.
  const e=1-Math.pow(1-(nGr?Math.min(1,q/0.62):q),3);
  return q>=1?vers:de+(vers-de)*e;
}
// Un champ de saisie n'affiche pas son textContent : la charge d'une série est
// un <input>, et rcFoudre la fait compter. On écrit donc sa value.
function _arcEcrire(el,txt){
  if(el.tagName==='INPUT'||el.tagName==='TEXTAREA') el.value=txt;
  else el.textContent=txt;
}
function arcChiffre(el,de,vers,o){
  o=o||{};
  if(typeof el==='string') el=document.getElementById(el);
  if(!el) return null;
  const fmt=o.format||(v=>String(Math.round(v)));
  const prec=_arcChiffres.get(el);
  if(prec){ cancelAnimationFrame(prec); _arcChiffres.delete(el); }
  // `duree` vaut 0 quand on la passe à 0, et non 620 : un `o.duree||défaut`
  // rendait un zéro explicite indiscernable d'une absence, et « pose la valeur
  // tout de suite » devenait « anime pendant 620 ms ».
  const d=(o.duree==null)?ARC.afterglow:o.duree;
  // Variante plate ET cas dégénérés : on pose la valeur d'arrivée, sans détour.
  // PAGE CACHEE COMPRISE : requestAnimationFrame ne s'y execute pas, et le
  // compteur resterait fige sur sa valeur de DEPART — un zero, qui se lit comme
  // une donnee perdue. Mieux vaut le chiffre juste, sans la montee.
  let _cachee=false; try{ _cachee=!!(typeof document!=='undefined'&&document.hidden); }catch(e){}
  // `gresille` : 2 ou 3 valeurs au hasard avant de se fixer (rcFoudre). Il
  // anime MEME quand de===vers — un record d'e1RM à charge égale grésille sur
  // place au lieu de ne rien dire.
  const gr=!!o.gresille;
  if(arcReduit()||!(d>0)||(de===vers&&!gr)||_cachee){
    _arcEcrire(el,fmt(vers));
    return null;
  }
  // LA VALEUR DE DÉPART EST ÉCRITE TOUT DE SUITE, avant la moindre frame.
  // requestAnimationFrame ne s'exécute PAS sur une page cachée : sans cette
  // ligne, un compteur mis à jour pendant que l'athlète a rangé son téléphone
  // restait VIDE — pas figé sur l'ancienne valeur, vide — jusqu'au retour à
  // l'écran. Un chiffre absent se lit comme une donnée perdue.
  _arcEcrire(el,fmt(de));
  const t0=(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  // LE GRÉSILLEMENT OCCUPE LE DERNIER TIERS : la montée d'abord, lisible, puis
  // le chiffre « saute » entre des valeurs voisines et tombe sur la bonne. Les
  // valeurs sont tirées une fois, à l'avance : une nouvelle par frame serait un
  // flou illisible, pas un grésillement.
  const bruit=arcBruit(de,vers,gr);
  const pas=(maintenant)=>{
    const p=Math.min(1,(maintenant-t0)/d);
    _arcEcrire(el,fmt(arcValeurA(de,vers,p,bruit)));
    if(p<1) _arcChiffres.set(el,requestAnimationFrame(pas));
    else _arcChiffres.delete(el);
  };
  _arcChiffres.set(el,requestAnimationFrame(pas));
  return el;
}


// ── La santé de l'app (créateur) : sept jours d'erreurs, et le quota ────────
const QUOTA_MOIS_KO=10e6, QUOTA_SEUILS=Object.freeze([70,90]);
// PURE. Les erreurs de plusieurs jours → une ligne par build et empreinte.
//   parJour : {AAAA-MM-JJ: {build: {empreinte: {n,m,s,ou,premier,dernier}}}}
function santeAppResume(parJour,hier){
  const lignes=new Map(), jours=Object.keys(parJour||{}).sort();
  for(const j of jours){
    const pb=parJour[j]||{};
    for(const b of Object.keys(pb)) for(const h of Object.keys(pb[b]||{})){
      const e=pb[b][h]||{}, k=b+'/'+h;
      const l=lignes.get(k)||{b,h,m:e.m||'',s:e.s||'',ou:e.ou||'',n:0,nHier:0,nAvant:0,premierJour:j,dernier:0};
      l.n+=Number(e.n)||0;
      if(j===hier) l.nHier+=Number(e.n)||0; else if(j<hier) l.nAvant+=Number(e.n)||0;
      l.dernier=Math.max(l.dernier,Number(e.dernier)||0);
      lignes.set(k,l);
    }
  }
  return [...lignes.values()].map(l=>Object.assign(l,{nouvelle:l.premierJour>=hier,doublee:l.nAvant>0&&l.nHier>=2*l.nAvant/Math.max(1,jours.filter(j=>j<hier).length)}))
    .sort((a,b)=>b.n-a.n||b.dernier-a.dernier);
}
// PURE. Le quota de téléchargement du mois (metrics oct_out_ko, en Ko).
function quotaMois(metricsParJour,mois){
  let ko=0;
  for(const j of Object.keys(metricsParJour||{})) if(j.indexOf(mois)===0) ko+=Number((metricsParJour[j]||{}).oct_out_ko)||0;
  const pct=Math.round(ko/QUOTA_MOIS_KO*1000)/10;
  return {ko,pct,seuil:QUOTA_SEUILS.filter(s=>pct>=s).pop()||0};
}
function htmlSanteApp(lignes,quota){
  const E=escapeHtml;
  const q=quota?'<div class="card sa-q'+(quota.seuil?' sa-q'+quota.seuil:'')+'"><div class="t-carte">Quota de la base, ce mois</div>'
    +'<div class="sa-q-v">'+String(quota.pct).replace('.',',')+' %</div><div class="sub">'+Math.round(quota.ko/1000).toLocaleString('fr-FR')+' Mo téléchargés sur 10 Go'+(quota.seuil?' · au-delà de '+quota.seuil+' %':'')+'</div></div>':'';
  if(!lignes.length) return q+emptyState('','Aucune erreur signalée sur sept jours.',null,null,'padding:16px 8px');
  return q+'<div class="t-section">Erreurs, sept jours</div>'+lignes.slice(0,60).map(l=>'<div class="sa-l'+(l.nouvelle?' sa-neuve':'')+(l.doublee?' sa-double':'')+'">'
    +'<div class="sa-l-h"><b>'+E(l.m)+'</b><span>'+l.n+'</span></div>'
    +'<div class="sub">build '+E(l.b)+(l.ou?' · '+E(l.ou):'')+(l.s?' · '+E(l.s):'')+(l.nouvelle?' · nouvelle':'')+(l.doublee?' · en hausse':'')+'</div></div>').join('');
}
async function ouvrirSanteApp(){
  go('s-sante-app');
  const z=document.getElementById('sa-corps'); if(!z) return false;
  z.innerHTML=etatChargement(3);
  const t=Date.now(), jours=[...Array(7)].map((_,i)=>localISODate(new Date(t-i*864e5)));
  const mois=jours[0].slice(0,7), jm=[...Array(Number(jours[0].slice(8)))].map((_,i)=>mois+'-'+String(i+1).padStart(2,'0'));
  const [er,me]=await Promise.all([Promise.all(jours.map(j=>_fbJson('erreurs/'+j))),Promise.all(jm.map(j=>_fbJson('metrics/'+j)))]);
  if(er.some(r=>!r.ok&&(r.st===401||r.st===403))){ z.innerHTML=emptyState('','Réservé au compte créateur.',null,null,'padding:16px 8px'); return false; }
  const parJour={}, mj={};
  jours.forEach((j,i)=>{ if(er[i].ok&&er[i].v) parJour[j]=er[i].v; });
  jm.forEach((j,i)=>{ if(me[i].ok&&me[i].v) mj[j]=me[i].v; });
  z.innerHTML=htmlSanteApp(santeAppResume(parJour,jours[1]),quotaMois(mj,mois));
  return true;
}
