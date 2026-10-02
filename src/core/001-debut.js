// ══ LE ROUGE DE LA MARQUE, POUR CE QUI NE LIT PAS LA FEUILLE (01/10/2026) ══
// La feuille dit le rouge par var(--red) (scripts/couleurs.py). Mais un canvas
// (fillStyle), un SVG exporte en image, un <input type="color">, une valeur par
// defaut enregistree dans une donnee ne lisent pas les variables CSS : il leur
// faut la couleur ecrite. Elle l'est ICI, une seule fois, et nulle part
// ailleurs dans rc-core (app/tests.js le verifie). Ce n'est pas var(--red) lu a
// l'execution : la marque d'un coach surcharge --red, et les visuels partages
// restent aux couleurs de RepCore. _MIN : la meme, en minuscules, la ou le code
// la compare a une valeur deja mise en minuscules.
const ROUGE_MARQUE='#E02020', ROUGE_MARQUE_MIN='#e02020';


// ── Version de la politique de confidentialite ────────────────────────
// A INCREMENTER A CHAQUE MODIFICATION DE privacy.html. C'est le seul geste qui
// redemande son accord a l'utilisateur : un consentement porte sur un texte
// precis, et un texte modifie n'est plus celui qui a ete accepte.
// Format AAAA-MM ; si deux revisions tombent le meme mois, suffixer (2026-07b).
// Tout compte dont consent.policyVersion differe de cette valeur revoit l'ecran
// de consentement au demarrage — y compris les comptes crees avant l'existence
// du champ, qui n'en portent aucun.
const POLICY_VERSION='2026-10';

// ── Identité créateur & configuration PayPal ─────────────────────────────────
// Ces constantes sont en dur et NE doivent jamais être exposées ni modifiables
// depuis l'interface utilisateur.
//
// CREATOR_EMAIL : compte propriétaire de l'application RepCore.
//   — Seul autorisé à émettre des codes d'INVITATION COACH.
//   — C'est le compte PayPal de ce mail qui perçoit les abonnements souscrits
//     dans l'application, par les athlètes inscrits SANS code de coach.
//
// ── OCTROI D'ACCÈS PAR UN COACH AFFILIÉ ────────────────────────────────────
// CE BLOC DISAIT L'INVERSE, et il se déclarait faisant foi. Il est réécrit
// avec le lot R-03 plutôt que corrigé ligne à ligne : un commentaire faux est
// pire qu'absent, il invite à défaire ce qu'il décrit mal.
//
// Ce qui est IMPLÉMENTÉ, sans ambiguïté :
//   • Un coach affilié accorde l'accès à ses athlètes, pour la durée qu'il
//     choisit et JUSQU'À 12 MOIS par code. Le plafond est vérifié DEUX fois :
//     à la génération et à la consommation. Un athlète invité par un affilié
//     ne rencontre plus d'écran de paiement.
//   • Le paywall subsiste pour l'inscription AUTONOME, sans code.
//   • payload.grantedBy vaut 'creator' ou 'coach'. Absent — code émis avant
//     ce lot — il est lu comme 'creator' : aucun code ancien ne change de
//     comportement.
//
// CE QUI N'EXISTE TOUJOURS PAS, ET C'EST DÉLIBÉRÉ : aucun mécanisme de
// reversement, ni automatique ni manuel. Encaisser pour le compte d'un tiers
// est une activité d'intermédiaire de paiement, réglementée — ce produit ne
// s'en approche pas. Et aucun écran ne promet de gratuité illimitée ni de
// nombre d'athlètes garanti : une limitation technique annoncée comme un
// avantage devient une promesse contractuelle dont on ne revient pas.
const CREATOR_EMAIL='guellec.coachingpro@gmail.com';
// Le WhatsApp du coach, au format international SANS le « + » — c'est celui
// que wa.me attend. Vide, le bouton de contact ne s'affiche pas du tout :
// mieux vaut pas de bouton qu'un bouton qui ouvre une conversation avec
// personne.
const RC_WHATSAPP='33778439205';
// ══ LA BOUTIQUE ══════════════════════════════════════════════════════════
//
// UN CATALOGUE DE PROGRAMMES, ET UN SEUL VENDEUR. Kevin vend ses propres
// programmes ; un autre coach peut en acheter, jamais en vendre. Ce n'est pas
// une limitation d'interface, c'est LE montage qui evite le §2 de la note de
// decision economique : encaisser l'argent d'un client pour le reverser a un
// professionnel ferait de RepCore un intermediaire de paiement au sens de la
// DSP2 — activite reglementee, agrement ou Stripe Connect obligatoire, et
// explicitement ecartee. Ici l'argent encaisse appartient deja a celui qui
// encaisse. Arbitre par Kevin le 16/09/2026.
//
// ⚠ LES PRIX SONT EN CENTIMES. Aucun flottant ne touche a de l'argent : 14,90
// s'ecrit 1490, et 0,1+0,2 ne vaut pas 0,3 en binaire.
//
// L'AFFICHE DE FONDATIONS EST DANS LE DEPOT depuis le build 1266 :
// app/img/programmes/fondations.jpg, 1080 px de large, sans metadonnees. Elle
// n'est pas dans les ASSETS du service worker — la boutique demande le reseau
// pour acheter, et le handler fetch la garde des la premiere vue. La devanture
// dessinee en CSS reste le repli permanent pour tout programme sans visuel,
// et pour celui-ci quand l'image ne se charge pas — hors ligne, avant toute
// premiere vue.
// ⚠ CE QUE LE PLAN SPARK NE PERMET PAS, ET QU'IL FAUT SAVOIR AVANT QUE DE
// L'ARGENT CIRCULE. Sans fonction serveur, RIEN NE VERIFIE UN ACHAT COTE
// SERVEUR : `programmesAchetes` est un champ du dossier, et les regles RTDB
// accordent au titulaire l'ecriture sans restriction de champ. Quelqu'un qui
// sait ouvrir une console peut donc s'octroyer un programme.
// C'est le MEME arbitrage, deja assume, que pour `status` et `paymentStatus`
// cote abonnement — voir le « point dur » du §4 de la note de decision
// economique. Il porte ici sur le prix d'un programme, pas sur un abonnement
// reconduit. Le controle redeviendra reel le jour d'un passage a Blaze ; d'ici
// la il est honorifique, et ce commentaire est la pour qu'il ne soit jamais
// pris pour autre chose.
// L'ORDRE PAYPAL, LUI, EST REEL : l'argent est bien encaisse, et
// l'identifiant de transaction est conserve dans le dossier.
// ══ LE SERVEUR LÉGER : 0 €, UN CLOUDFLARE WORKER (27/09/2026) ════════════
//
// Kevin : « le but, 0 € dépensé ». Ce que les Cloud Functions devaient faire
// (notifications app fermée, travaux à heure fixe, jugement des parrainages et
// des codes ambassadeur, défis), un Worker Cloudflare gratuit le fait —
// voir cloudflare/README.md. L'app lui parle de deux façons :
//   · elle DÉPOSE un événement dans /evenements (réponse du coach, défi
//     publié ou mis à jour, demande de parrainage) : le Worker le relève dans
//     la minute, et tout de suite si l'appel à /reveil passe ;
//   · les pages publiques comptent l'arrivée par un lien sur /arrivee.
// VIDE, rien ne part, et tout se comporte comme avant.
const SERVEUR_LEGER_URL='https://repcore-serveur.repcore.workers.dev';
const SERVEUR_LEGER=!!SERVEUR_LEGER_URL;
// ══ LES CLOUD FUNCTIONS NE TOURNERONT PAS ; LE WORKER LES REMPLACE ═══════
//
// Decision de Kevin, 24/09/2026 : « je ne payerai pas le plan Blaze ». Les
// fonctions de functions/index.js ne sont deployees par rien (voir
// functions/README.md, « NE PAS DEPLOYER »). Ce qu'elles devaient faire pour
// l'app, le Worker le fait, au meme protocole (/fn/<nom>, jeton Firebase
// verifie). FONCTIONS_WORKER (01/10/2026) remplace l'ancien booleen
// FONCTIONS_SERVEUR, qui coupait ouvrirEssai et verifierAchatProgramme : ce
// sont les appels portes de functions/ vers le Worker. On ne les envoie que
// si le Worker existe (SERVEUR_LEGER) — fonctionWorker(nom).
// (Les appels nes avec le Worker — redeemCode, devenirCoach, paiementCoach,
// garmin… — ne passent pas par cette liste : ils n'existent que la.)
const FONCTIONS_WORKER=Object.freeze(['ouvrirEssai','verifierAchatProgramme','cloudinaryDestroy','santeJeton']);
function fonctionWorker(nom){ return SERVEUR_LEGER&&FONCTIONS_WORKER.indexOf(nom)>=0; }
const RC_BOUTIQUE_GRATUITE=false;
const RC_PROGRAMMES=Object.freeze([
  Object.freeze({
    id:'fondations',
    nom:'Fondations',
    phase:'Phase 1',
    accroche:'Construire des bases solides pour progresser durablement',
    description:'Trois séances par semaine, huit à douze semaines, un jour de '
      +'repos au minimum entre deux séances. Les mouvements de base, appris '
      +'proprement, avec la charge qui monte toute seule à mesure que tu '
      +'gardes des répétitions en réserve.',
    tags:Object.freeze(['Tous niveaux','Hommes & femmes','3 séances/semaine',
      '8 à 12 semaines']),
    prixCts:1490,
    image:'./img/programmes/fondations.jpg',
    // LES SEANCES SONT LUES A L'APPLICATION, PAS COPIEES ICI. Deux jeux de
    // sept jours recopies dans le catalogue auraient diverge de FONDATION_H/F
    // au premier ajustement, et c'est la version non relue qui serait restee
    // fausse. La fonction differe la lecture : les deux constantes sont
    // declarees plus bas dans le fichier.
    // CE QUE LA FICHE ANNONCE, ECRIT UNE FOIS. Les tags le disaient deja en
    // toutes lettres ; ces trois champs le disent en DONNEES, pour que la
    // fiche produit les affiche sans les deviner dans une chaine.
    semaines:'8 à 12', seancesSemaine:3, niveau:'Tous niveaux',
    seances:genre=>(genre==='F')?FONDATION_F:FONDATION_H
  }),
  // ══ QUATRE EMPLACEMENTS, ET ILS ATTENDENT LEUR CONTENU ════════════════
  //
  // Kevin, 23/09/2026 : « Propose-moi des intitules coherents avec ce que
  // l'app sait faire et laisse les contenus a ma main. Ne les invente PAS :
  // mets des entrees visiblement a completer et dis-le-moi. »
  //
  // ⚠ ILS N'APPARAISSENT PAS DANS LA BOUTIQUE TANT QUE `aCompleter` EST VRAI.
  //   Un article sans description et sans seances serait pire qu'une boutique
  //   a un seul programme : ce serait une boutique qui vend du vide.
  //   catalogueBoutique les ecarte, et une assertion verifie qu'aucun d'eux ne
  //   se vend.
  //
  // CE QU'IL FAUT REMPLIR POUR QU'UN EMPLACEMENT S'OUVRE :
  //   accroche     une phrase, ce que le programme apporte
  //   description  trois a cinq lignes : le rythme, la progression, pour qui
  //   tags         trois ou quatre etiquettes courtes
  //   prixCts      le prix EN CENTIMES (14,90 € s'ecrit 1490)
  //   seances      la fonction qui rend les sept creneaux, comme Fondations
  //   aCompleter   a retirer, c'est lui qui tient la porte fermee
  //
  // ET IL Y A UN AUTRE CHEMIN, deja en place : « Gerer mes programmes en
  // vente » publie n'importe lequel de tes propres programmes depuis le
  // telephone, sans passer par ce fichier. Ces emplacements-ci servent aux
  // programmes livres AVEC l'application.
  Object.freeze({
    id:'prise-de-masse', nom:'Prise de masse', phase:'Phase 2',
    accroche:'', description:'', tags:Object.freeze([]),
    semaines:'', seancesSemaine:0, niveau:'',
    prixCts:0, image:'', aCompleter:true, seances:null
  }),
  Object.freeze({
    id:'seche', nom:'Sèche', phase:'Phase 3',
    accroche:'', description:'', tags:Object.freeze([]),
    semaines:'', seancesSemaine:0, niveau:'',
    prixCts:0, image:'', aCompleter:true, seances:null
  }),
  Object.freeze({
    id:'force', nom:'Force', phase:'Phase 2',
    accroche:'', description:'', tags:Object.freeze([]),
    semaines:'', seancesSemaine:0, niveau:'',
    prixCts:0, image:'', aCompleter:true, seances:null
  }),
  Object.freeze({
    id:'reprise', nom:'Reprise après arrêt', phase:'Phase 1',
    accroche:'', description:'', tags:Object.freeze([]),
    semaines:'', seancesSemaine:0, niveau:'',
    prixCts:0, image:'', aCompleter:true, seances:null
  })
]);
// PURE. UN EMPLACEMENT VIDE NE SE VEND PAS. La regle est ici, une fois, et
// tout ce qui liste la boutique passe par elle.
function programmeVendable(p){
  if(!p||p.aCompleter) return false;
  return !!(p.nom&&Number(p.prixCts)>0);
}
// ══ LA REVISION DE PROGRAMME (lot 9) ═════════════════════════════════════
//
// ⚠ CE N'EST PAS UN SECOND FLUX DE PAIEMENT, et Kevin l'a ecrit noir sur
//   blanc : « NE CREE PAS un nouveau flux de paiement : ouvrirAchatProgramme
//   fait deja exactement ca. Reutilise-le. » C'est donc un ARTICLE, avec un
//   identifiant, un prix et une fiche — simplement, il ne s'installe pas dans
//   les seances et il ne s'affiche pas en rayon.
//
// LE PRIX VIENT D'OFFRES, comme tous les autres : revision_prog, 40 €.
const REVISION_ID='revision-programme';
function offreRevision(){
  const o=offre('revision_prog')||{prix:40,mois:1};
  return Object.freeze({
    id:REVISION_ID, service:true, nom:'Révision de ton programme',
    accroche:'Un ajustement de ton plan, par ton coach.',
    // LE PERIMETRE EST ECRIT AVANT LE PAIEMENT, et c'est lui qui evite la
    // soiree d'allers-retours : on dit ce que la revision fait, ET ce qu'elle
    // n'est pas.
    description:'Une révision, c’est un ajustement de ton plan : exercices, '
      +'volume, répartition des séances. Ce n’est pas une refonte complète, '
      +'ni un nouveau plan nutrition.',
    tags:Object.freeze(['Ajustement','Par ton coach']),
    prixCts:Math.round(Number(o.prix)*100), image:'', seances:null
  });
}
// PURE. Le programme personnalise a-t-il ete livre ? C'est la seule porte de
// la revision : reviser un plan qu'on n'a pas ne veut rien dire.
//
// DEUX CHEMINS, et le second existe parce que le premier ne passe pas par
// l'application : le programme personnalise se vend hors de l'app (99 €), et
// c'est le coach qui pose le marqueur en livrant.
function programmePersoLivre(u){
  const x=u||currentUser;
  if(!x) return false;
  // ⚠ PAS A QUELQU'UN QUI EST DEJA SUIVI. Son coaching comprend deja les
  //   ajustements : lui vendre 40 € ce qu'il paie chaque mois serait lui
  //   vendre deux fois la meme chose, et il le verrait.
  try{ if(peut(x,'correctionVideo')) return false; }catch(e){}
  if(x.role==='coach') return false;
  if(x.programmePerso&&Number(x.programmePerso.le)>0) return true;
  try{ return programmeAcquis(x,'programme-perso'); }catch(e){ return false; }
}
// PURE. Les revisions deja payees.
function revisionsPayees(u){
  const x=u||currentUser;
  const l=(x&&x.revisions);
  return Array.isArray(l)?l.filter(r=>r&&Number(r.le)>0):[];
}
// PURE. CE QUE LA PERSONNE A DEPENSE en plan ecrit pour elle. C'est ce chiffre
// qui fait basculer vers Transformation : il se compare tout seul aux 350 €.
function totalPlanPerso(u,revisionsEnPlus){
  const p=Number((offre('programme_perso')||{}).prix)||0;
  const r=Number((offre('revision_prog')||{}).prix)||0;
  const n=revisionsPayees(u).length+(Number(revisionsEnPlus)||0);
  return p+n*r;
}
// ══ LE CATALOGUE EFFECTIF : LE CODE, PUIS CE QUE LE COACH A PUBLIE ═══════
//
// DEUX SOURCES, ET UNE SEULE VERITE A L'ARRIVEE. Le catalogue en dur porte les
// programmes livres avec l'application ; le noeud public porte ceux que le
// coach met en vente depuis son telephone, ET les retouches qu'il fait aux
// premiers — un prix, surtout. Le publie GAGNE, champ par champ : c'est le
// plus recent, et c'est celui que le coach a voulu.
//
// ⚠ LE CACHE EST LOCAL ET DATE. La boutique doit s'ouvrir hors ligne, et un
// prix d'hier vaut mieux qu'une page blanche — mais il ne doit pas survivre a
// une desinstallation du programme : un programme masque disparait de la
// liste des qu'on relit le noeud.
const RC_BOUTIQUE_CLE='rc_boutique';
let _boutiquePubliee=null;
function _boutiqueLocale(){
  if(_boutiquePubliee) return _boutiquePubliee;
  try{ const t=localStorage.getItem(RC_BOUTIQUE_CLE);
    const d=t?JSON.parse(t):null;
    _boutiquePubliee=(d&&typeof d==='object')?d:{};
  }catch(e){ _boutiquePubliee={}; }
  return _boutiquePubliee;
}
function _poserBoutiqueLocale(d){
  _boutiquePubliee=(d&&typeof d==='object')?d:{};
  try{ localStorage.setItem(RC_BOUTIQUE_CLE,JSON.stringify(_boutiquePubliee)); }catch(e){}
  return _boutiquePubliee;
}
// ══ LA FICHE ET LE CONTENU, SEPARES (01/10/2026) ═══════════════════════════
// boutique/<id> est lu par tout compte connecte : il ne porte plus que la
// FICHE (titre, prix, accroche, image…). Les seances — ce qui est vendu —
// vivent dans boutique_contenu/<id>, que les regles n'ouvrent qu'a
// l'acheteur (droits/<cle>/programmes/<id>, pose par le Worker a l'achat) et
// au createur. Elles se gardent ici, par programme, avec leur date.
const RC_BOUTIQUE_CONTENU_CLE='rc_boutique_contenu';
function _contenusLocaux(){
  try{ const o=JSON.parse(localStorage.getItem(RC_BOUTIQUE_CONTENU_CLE)||'null');
    return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; }
}
function _poserContenuLocal(id,c){
  try{
    const o=_contenusLocaux();
    if(c&&typeof c.seances==='string') o[id]={seances:c.seances,maj:Number(c.maj)||0};
    else delete o[id];
    localStorage.setItem(RC_BOUTIQUE_CONTENU_CLE,JSON.stringify(o));
  }catch(e){}
}
// Le contenu d'UN programme, lu au serveur et garde. true s'il est la.
async function chargerContenuBoutique(id){
  if(!id||!CLOUD.ok()) return false;
  const r=await CLOUD.lireContenuBoutique(id).catch(()=>null);
  if(!r||!r.ok) return false;
  _poserContenuLocal(id,r.contenu);
  return !!(r.contenu&&r.contenu.seances);
}
// Les contenus que ce compte peut lire : tous pour le createur, ceux qu'il a
// achetes pour un athlete. Relus seulement s'ils manquent ou si la fiche est
// plus recente que la copie.
async function _rafraichirContenus(fiches){
  const loc=_contenusLocaux();
  const a=(typeof currentUser==='object'&&currentUser&&currentUser.programmesAchetes)||{};
  const ids=Object.keys(fiches||{}).filter(id=>{
    const f=fiches[id]; if(!f||typeof f!=='object'||!f.aContenu) return false;
    if(!estVendeur()&&!Object.prototype.hasOwnProperty.call(a,id)) return false;
    return !loc[id]||Number(loc[id].maj||0)<Number(f.maj||0);
  });
  for(const id of ids){ try{ await chargerContenuBoutique(id); }catch(e){} }
  return ids.length;
}
// Rapatrie le noeud public. Silencieuse : hors ligne, on garde le cache.
async function rafraichirBoutique(){
  try{
    if(!CLOUD.ok()) return null;
    const d=await CLOUD.lireBoutique();
    if(d===null) return null;          // echec reseau : on ne vide pas le cache
    _poserBoutiqueLocale(d);
    try{ await _rafraichirContenus(d); }catch(e){}
    try{ _rendreBoutique(); }catch(e){}
    return d;
  }catch(e){ return null; }
}
// PURE (au cache pres). Un programme publie, normalise — les seances arrivent
// en CHAINE JSON depuis la base, parce que les valider champ par champ dans
// les regles aurait demande d'y transcrire tout le modele de donnees.
function _programmePublie(id){
  const b=_boutiqueLocale()||{};
  if(typeof id!=='string'||!Object.prototype.hasOwnProperty.call(b,id)) return null;
  const p=b[id];
  if(!p||typeof p!=='object') return null;
  // LE CONTENU, s'il est sur cet appareil (achete, ou createur). Une fiche
  // d'avant la separation peut encore porter ses seances : elles servent.
  const c=_contenusLocaux()[id];
  return (c&&typeof c.seances==='string')?Object.assign({},p,{seances:c.seances}):p;
}
function _seancesPubliees(p,genre){
  try{
    const d=JSON.parse(p.seances||'null');
    if(!d) return null;
    if(Array.isArray(d)) return d.length?d:null;
    // ⚠ UN JEU VIDE N'EST PAS UN JEU, ET ON RETOMBE SUR L'AUTRE GENRE. Le
    // coach publie souvent la version Homme d'abord ; `|| d.H` ne suffisait
    // pas, parce qu'un tableau VIDE est un objet, donc vrai. Une athlete
    // recevait alors un programme sans une seule seance.
    // Mieux vaut le programme de l'autre genre que pas de programme du tout :
    // c'est le meme mouvement, et la charge s'ajuste d'elle-meme.
    const plein=l=>Array.isArray(l)&&l.length?l:null;
    const voulu=(genre==='F')?plein(d.F):plein(d.H);
    return voulu||plein(d.H)||plein(d.F)||null;
  }catch(e){ return null; }
}
// PURE. Le programme tel qu'il doit etre AFFICHE ET VENDU : le catalogue en
// dur, recouvert par ce que le coach a publie.
function programmeDuCatalogue(id){
  if(typeof id!=='string'||!id) return null;
  // LA REVISION EST UN ARTICLE COMME UN AUTRE POUR L'ACHAT, et elle n'est
  // dans aucun rayon : elle se trouve par son identifiant, et uniquement la.
  if(id===REVISION_ID) return offreRevision();
  const base=RC_PROGRAMMES.find(p=>p.id===id)||null;
  const pub=_programmePublie(id);
  if(!base&&!pub) return null;
  if(!pub) return base;
  // ⚠ CHAMP PAR CHAMP, ET JAMAIS EN BLOC. Un Object.assign ecraserait
  // `seances` — une FONCTION dans le catalogue, une chaine dans la base — et
  // le programme livre avec l'application cesserait d'avoir des seances.
  const f=(k,def)=>(pub[k]!==undefined&&pub[k]!==null&&pub[k]!=='')?pub[k]:def;
  const seances=genre=>{
    const sp=_seancesPubliees(pub,genre);
    if(sp) return sp;
    return (base&&typeof base.seances==='function')?base.seances(genre):null;
  };
  return Object.freeze({
    id:id,
    nom:f('nom',base&&base.nom),
    phase:base&&base.phase,
    accroche:f('accroche',base&&base.accroche),
    description:f('description',base&&base.description),
    tags:(base&&base.tags)||null,
    prixCts:(typeof pub.prixCts==='number')?pub.prixCts:(base?base.prixCts:0),
    image:f('image',base&&base.image),
    masque:pub.masque===true,
    // CE QUE LA FICHE PRODUIT ANNONCE (lot 8). Le publie gagne, comme le reste.
    semaines:f('semaines',base&&base.semaines),
    seancesSemaine:Number(f('seancesSemaine',base&&base.seancesSemaine))||0,
    niveau:f('niveau',base&&base.niveau),
    // UN EMPLACEMENT VIDE S'OUVRE DES QUE LE COACH Y PUBLIE DES SEANCES : la
    // publication est l'autre chemin pour le remplir, et elle vaut la main.
    aCompleter:(base&&base.aCompleter)?!(pub.seances||pub.aContenu):false,
    seances:seances
  });
}
// La liste AFFICHEE : le catalogue en dur, plus ce que le coach a publie en
// propre, moins ce qu'il a retire de la vente.
function programmesBoutique(){
  const vus=new Set(), out=[];
  for(const p of RC_PROGRAMMES){ vus.add(p.id);
    // ⚠ UN EMPLACEMENT A COMPLETER NE S'AFFICHE PAS (lot 8). Il existe dans le
    //   fichier pour etre rempli, pas pour etre vendu vide.
    const e=programmeDuCatalogue(p.id); if(e&&!e.masque&&programmeVendable(e)) out.push(e); }
  const b=_boutiqueLocale()||{};
  for(const id of Object.keys(b)){
    if(vus.has(id)) continue;
    const e=programmeDuCatalogue(id);
    if(e&&!e.masque&&e.nom&&programmeVendable(e)) out.push(e);
  }
  return out;
}
// ══ CE QUE LA FICHE PRODUIT DOIT MONTRER AVANT L'ACHAT (lot 8) ═══════════
//
// Kevin : « Personne n'achete un programme qu'il ne peut pas regarder. »
// Les trois lectures ci-dessous ne DECRIVENT rien : elles lisent les seances
// du programme. Une accroche se redige, un apercu se calcule — et un apercu
// calcule ne peut pas mentir sur ce qu'on recevra.
function _seancesProgramme(p,genre){
  try{
    const l=(typeof p.seances==='function')?p.seances(genre||'H')
      :(Array.isArray(p.seances)?p.seances:null);
    return Array.isArray(l)?l:[];
  }catch(e){ return []; }
}
// PURE. Les trois premiers exercices de la premiere seance qui en porte.
function apercuProgramme(p,genre){
  for(const j of _seancesProgramme(p,genre)){
    if(!j||j.active===false) continue;
    const l=(Array.isArray(j.exercises)?j.exercises:[])
      .map(e=>String((e&&e.name)||'').trim()).filter(Boolean);
    if(l.length) return {seance:String(j.name||j.day||'').trim(),exercices:l.slice(0,3),total:l.length};
  }
  return null;
}
// PURE. Le materiel, lu dans les exercices eux-memes. Rien n'est ecrit a la
// main : un programme dont le materiel serait decrit a cote de ses exercices
// finirait par mentir au premier ajustement.
function materielProgramme(p,genre){
  const vus=[];
  for(const j of _seancesProgramme(p,genre))
    for(const e of (Array.isArray(j&&j.exercises)?j.exercises:[])){
      const m=String((e&&e.materiel)||'').trim();
      if(m&&vus.indexOf(m)<0) vus.push(m);
    }
  return vus.slice(0,5);
}
// PURE. La ligne de faits : duree, rythme, niveau. Vide quand rien n'est su.
function faitsProgramme(p){
  const l=[];
  if(p&&p.semaines) l.push(String(p.semaines)+' semaines');
  if(p&&Number(p.seancesSemaine)>0)
    l.push(Number(p.seancesSemaine)+' séance'+(Number(p.seancesSemaine)>1?'s':'')+' par semaine');
  if(p&&p.niveau) l.push(String(p.niveau));
  return l;
}
// PURE. LES MEMES FAITS, MOINS CE QUE LES ETIQUETTES DISENT DEJA. Fondations
// porte « 3 séances/semaine » et « 8 à 12 semaines » en etiquettes : les
// repeter deux lignes plus bas fait lire deux fois la meme chose, et donne
// l'impression que la fiche se remplit toute seule.
function faitsProgrammeNeufs(p){
  const norm=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\b(par|de|du|des|a|au|aux|en)\b/g,' ').replace(/[^a-z0-9]+/g,'');
  const ets=((p&&p.tags)||[]).map(norm).filter(Boolean);
  const dedans=f=>{ const n=norm(f); return ets.some(e=>e.indexOf(n)>=0||n.indexOf(e)>=0); };
  return faitsProgramme(p).filter(f=>!dedans(f));
}
// PURE. « 14,90 € ». L'espace avant l'euro est INSECABLE (U+00A0), comme
// partout ailleurs dans le fichier : « 14,90 » et « € » ne se separent pas.
function prixProgramme(p){
  const c=p&&Number(p.prixCts);
  if(!isFinite(c)||c<0) return '';
  return (c/100).toFixed(2).replace('.',',')+'\u00a0€';
}
// PURE. Ce programme est-il acquis ? Gratuit, achete, ou offert par le coach.
// ⚠ LA LECTURE EST GARDEE PAR hasOwnProperty, comme celle du lexique : la cle
// vient d'une donnee, elle n'a pas a pouvoir atteindre Object.prototype.
function programmeAcquis(u,id){
  if(RC_BOUTIQUE_GRATUITE) return true;
  const p=programmeDuCatalogue(id);
  if(p&&!p.prixCts) return true;          // un programme a zero euro est libre
  const a=u&&u.programmesAchetes;
  if(!a||typeof a!=='object'||typeof id!=='string') return false;
  return Object.prototype.hasOwnProperty.call(a,id)&&!!a[id];
}
// Le lien de contact. Vide s'il n'y a pas de numero : voir RC_WHATSAPP.
function lienWhatsApp(texte){
  if(!RC_WHATSAPP) return '';
  return 'https://wa.me/'+RC_WHATSAPP
    +'?text='+encodeURIComponent(texte||'Bonjour Kevin, je te contacte depuis RepCore.');
}

// ── Mesure de tunnel ────────────────────────────────────────────────────────
// Des COMPTEURS agrégés, dans la base déjà utilisée par l'app : aucun outil
// tiers n'est contacté, donc rien ne sort de l'hébergeur déjà déclaré dans la
// politique de confidentialité. Aucun cookie n'est posé, aucune session n'est
// tracée, et il est structurellement impossible de remonter à une personne :
// ce qui part sur le réseau est « +1 sur cette étape aujourd'hui », jamais qui,
// jamais depuis où.
// La requête est délibérément envoyée SANS jeton d'authentification : y joindre
// le jeton rattacherait chaque incrément à un compte identifié, ce que cette
// mesure ne doit précisément pas permettre.
// Les noms sont figés ici ET dans database.rules.json : le serveur refuse toute
// clé hors liste, donc une faute de frappe ou un ajout non réfléchi ne peut pas
// créer de dimension imprévue.
const RCM_EVENEMENTS=['landing_view','landing_cta_click','coach_landing_view','blog_view','welcome_view','role_selected_coach','role_selected_athlete',
  'code_entered','code_valid','code_invalid','register_started','register_completed',
  'subscribe_viewed','paypal_clicked','subscription_activated',
  'first_workout_started','first_workout_completed','first_bilan_completed',
  // ── LE TRAFIC QUI ARRIVE PAR UN NAVIGATEUR INTEGRE ──────────────────
  // Un compteur par application, et non un seul « iab_detecte » : savoir que
  // 30 % du trafic ne peut pas installer est utile ; savoir que ce sont des
  // visiteurs d'Instagram dit QUOI FAIRE — changer la forme du lien la-bas.
  // Ces noms doivent rester en accord avec la liste fermee de
  // database.rules.json : le serveur refuse toute cle qui n'y figure pas.
  'iab_instagram','iab_facebook','iab_tiktok','iab_linkedin','iab_snapchat',
  'iab_twitter','iab_autre',
  // ── LE TUNNEL D'INSTALLATION ────────────────────────────────────────
  // Il vient AVANT tout le reste du parcours : « application ouverte » ne
  // veut rien dire tant qu'on ne sait pas combien de gens l'ont sur leur
  // ecran d'accueil. Ces sept-la repondent a une seule question — a qui
  // avons-nous propose d'installer, et qui l'a fait.
  //
  // TROIS ISSUES A L'INVITATION, DEUX COMPTEURS. « accepte » et « refuse »
  // se comptent ; « indisponible » n'est pas une reponse, c'est une invite
  // qui n'a pas eu lieu — la compter ferait un refus de chaque navigateur
  // incapable.
  //
  // « lancement_autonome » n'est pas une etape du tunnel mais sa preuve :
  // une installation qui ne sert jamais ne vaut rien. Compte une fois par
  // session, comme les vues d'ecran.
  'install_ecran_vu','install_invite_montree','install_accepte','install_refuse',
  'install_guide_ios','install_fait','lancement_autonome',
  // LE NAVIGATEUR QUI INSTALLE MAL. Distinct des iab_* : ceux-la ne peuvent
  // pas installer du tout, celui-ci installe quelque chose qu'Android refuse.
  'nav_samsung',
  // ── LA RETENTION : CE QUI SE PASSE APRES L'ACQUISITION ──────────────
  //
  // Le tunnel s'arretait au premier bilan. Il disait combien de gens entrent,
  // rien sur combien restent — et les deux questions n'ont pas les memes
  // reponses. Ces quatre-la repondent a la seconde.
  //
  // ⚠ CE QUI PART SUR LE RESEAU N'A PAS CHANGE D'UN OCTET : « +1 sur cette
  // etape aujourd'hui », sans jeton, sans identifiant, sans date de naissance,
  // sans rien qui relie deux incrementations a une meme personne. Les deux
  // compteurs de retention ont besoin de savoir s'ils ont deja compte
  // AUJOURD'HUI POUR CE COMPTE — cette memoire vit dans le localStorage de
  // l'appareil, elle n'est jamais transmise, et c'est exactement le procede
  // que rcmVue emploie deja avec sessionStorage.
  //
  // ⚠ « jamais_demarre_7j » SE DEDUIT D'UNE ABSENCE DE SEANCES, et ce n'est
  // pas pour autant une donnee de sante qui sort : ce qui part est le nombre
  // de comptes dans ce cas ce jour-la, pas lesquels. Le texte de bas de page
  // de l'ecran reste vrai mot pour mot.
  'notif_granted','pwa_installed','retour_j1','jamais_demarre_7j',
  // ── LA VENTE : UN SECOND PARCOURS, QUI N'EST PAS LE TUNNEL D'ACQUISITION ──
  //
  // Les quatre precedents disent ce qu'il advient d'un COMPTE. Ces quatre-ci
  // disent ce qu'il advient d'une OFFRE : combien de gens ouvrent la vitrine
  // d'un coach, combien voient un programme, combien touchent le bouton
  // d'achat, et combien de cartes de seance sont partagees — la carte etant
  // aujourd'hui le seul chemin qui ramene quelqu'un du dehors.
  //
  // ⚠ CE QUI PART SUR LE RESEAU N'A PAS CHANGE D'UN OCTET : « +1 sur cette
  // etape aujourd'hui », sans jeton, sans identifiant. On ne saura JAMAIS quel
  // coach a ete vu ni quel programme a ete clique — seulement combien de fois.
  // Un compteur par coach identifierait les coachs entre eux, et ce n'est pas
  // ce que cette mesure doit permettre.
  //
  // « programme_clic_achat » COMPTE UN DEPART, PAS UNE VENTE. Le paiement se
  // fait sur la page du coach, hors de RepCore : nous ne savons pas — et nous
  // n'avons pas a savoir — si la personne a paye.
  'vitrine_vue','programme_vu','programme_clic_achat','story_partagee',
  // LOT N3 : combien de gestes d'ajout pour compléter une journée de journal
  // (90 % des calories visées), par tranche. Aussi dans database.rules.json.
  'nut_jour_g1_3','nut_jour_g4_6','nut_jour_g7_10','nut_jour_g11',
  // ── LOT C7 : LES GESTES DU COACH, COMPTÉS ───────────────────────────
  // Six chiffres, pas vingt. Des COMPTES, pas des journaux : « +1 aujourd'hui »,
  // sans jeton, sans identifiant d'athlète, sans contenu. Ils ne partent QUE
  // par rcmCoach, qui refuse tout compte qui n'est pas un coach.
  // coach_relance_auto est compté par le serveur léger, qui l'envoie
  // (cloudflare/src/metier.js) : il est ici pour être déclaré au même endroit.
  'coach_message_envoye','coach_programme_assigne','coach_fiche_ouverte','coach_bilan_repondu',
  'coach_canal_publie','coach_relance_auto'];
// ══════════ SONDE DE QUOTA : UNE PENTE, PAS UNE VÉRITÉ ══════════
// Le plan Spark plafonne à 10 Go téléchargés par mois, et le dépassement est
// SILENCIEUX : l'application cesse simplement de répondre. Cette sonde ne
// remplace pas la console Firebase — elle donne une pente pour voir venir.
//
// AGRÉGATION LOCALE UNIQUEMENT. Rien ne remonte au réseau : le nœud metrics
// fige quinze noms d'événements dans database.rules.json, et y ajouter des
// octets exigerait de redéployer les règles. Surtout, une sonde qui se
// mesure elle-même en consommant du quota serait une drôle de sonde.
// Conséquence dite à l'écran : ce compteur ne voit que CET appareil.
//
// Le quota compté est celui de RTDB. Firebase Auth (identitytoolkit,
// securetoken) et Storage (le PDF de programme) ont leurs propres quotas :
// les additionner gonflerait le chiffre d'un facteur inconnu.
const QUOTA_MOIS_OCTETS=10*Math.pow(2,30);
const SEUIL_ALERTE=0.70;
const SEUIL_DEGRADATION=0.85;
const QUOTA_PREFIXE='rc_quota_';
// Clé RECALCULÉE à chaque écriture, jamais mise en cache : une session
// ouverte à cheval sur deux mois doit basculer d'elle-même.
function _quotaCle(d){
  const x=(d instanceof Date)?d:new Date();
  return QUOTA_PREFIXE+x.getFullYear()+String(x.getMonth()+1).padStart(2,'0');
}
// PURE au sens du réseau : elle ne fait qu'écrire dans localStorage.
// « complet » vaut faux tant que ce navigateur n'a pas OUVERT le mois
// lui-même. Un localStorage purgé — ITP Safari efface au bout de 7 jours —
// repart donc à zéro EN LE DISANT, au lieu d'afficher un 0 qui passerait
// pour une absence de trafic.
function _quotaCompter(sens,octets){
  try{
    const n=Number(octets);
    if(!(n>0)) return null;
    if(sens!=='in'&&sens!=='out') return null;
    const cle=_quotaCle();
    let e=null;
    try{ e=JSON.parse(localStorage.getItem(cle)||'null'); }catch(err){}
    if(!e||typeof e!=='object') e={in:0,out:0,n:0,debut:Date.now(),complet:false};
    e[sens]=(Number(e[sens])||0)+n;
    e.n=(Number(e.n)||0)+1;
    e.maj=Date.now();
    // ET LE MEME COMPTE, AGREGE : ce releve-ci ne vaut que pour cet appareil,
    // et le quota du projet est la somme de tous. rcqOctets regroupe et
    // n'envoie qu'au bout de quarante-cinq secondes.
    try{ rcqOctets(sens==='in'?'oct_in_ko':'oct_out_ko',n); }catch(err){}
    localStorage.setItem(cle,JSON.stringify(e));
    return e;
  }catch(err){ return null; }   // quota localStorage saturé : on n'en meurt pas
}
// Marque le mois comme OUVERT par ce navigateur. Appelée une fois au
// démarrage : à partir de là, le relevé est complet pour cet appareil.
function _quotaOuvrirMois(){
  try{
    const cle=_quotaCle();
    let e=null;
    try{ e=JSON.parse(localStorage.getItem(cle)||'null'); }catch(err){}
    if(e&&e.complet) return e;
    // Un mois deja entame SANS drapeau : les octets deja comptes sont bons,
    // mais le debut du mois a pu etre manque. On ne ment pas dessus.
    const neuf=e&&typeof e==='object'
      ? Object.assign({},e,{complet:e.debut&&_memeMoisQue(e.debut)})
      : {in:0,out:0,n:0,debut:Date.now(),complet:_premierDuMois()};
    localStorage.setItem(cle,JSON.stringify(neuf));
    return neuf;
  }catch(err){ return null; }
}
function _premierDuMois(){ return new Date().getDate()===1; }
function _memeMoisQue(ts){
  const a=new Date(ts), b=new Date();
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()
    &&a.getDate()===1;
}
// PURE. L'état du mois courant, prêt à afficher. Rend toujours un objet :
// l'absence de relevé est un ÉTAT, pas une erreur.
function etatQuota(){
  let e=null;
  try{ e=JSON.parse(localStorage.getItem(_quotaCle())||'null'); }catch(err){}
  const oct=e?((Number(e.in)||0)+(Number(e.out)||0)):0;
  const part=oct/QUOTA_MOIS_OCTETS;
  return {octets:oct, entrant:e?(Number(e.in)||0):0, sortant:e?(Number(e.out)||0):0,
    appels:e?(Number(e.n)||0):0, part:part,
    complet:!!(e&&e.complet), releve:!!e,
    maj:e&&e.maj?e.maj:null, debut:e&&e.debut?e.debut:null,
    alerte:part>=SEUIL_ALERTE, degrade:part>=SEUIL_DEGRADATION};
}
// PURE. Projection à pente constante : la date à laquelle le quota serait
// franchi si le rythme observé se maintenait. Rend null quand la pente n'a
// pas de sens — pas assez de recul, ou trafic nul.
function projectionQuota(etat,ref){
  const e=etat||etatQuota();
  if(!e.debut||!(e.octets>0)) return null;
  const t=(ref instanceof Date?ref:new Date()).getTime();
  const jours=(t-e.debut)/864e5;
  if(jours<1) return null;            // moins d'un jour : aucune pente fiable
  const parJour=e.octets/jours;
  if(!(parJour>0)) return null;
  const restant=QUOTA_MOIS_OCTETS-e.octets;
  if(restant<=0) return {depasse:true,date:null,joursRestants:0};
  return {depasse:false,date:new Date(t+(restant/parJour)*864e5),
    joursRestants:Math.round(restant/parJour)};
}
// La DÉGRADATION, et sa limite. Elle ne touche QUE deux choses : la période
// de synchronisation périodique et le préchargement de Ciqual. Jamais
// l'écriture d'une séance, jamais un drapeau rouge, jamais un plancher.
// Un garde-fou de coût qui empêcherait de journaliser une douleur serait un
// défaut, pas une protection.
const SYNC_PERIODE_MS=300000;         // 5 min
const SYNC_PERIODE_DEGRADEE_MS=1800000; // 30 min
function quotaDegrade(){
  try{ return etatQuota().degrade; }catch(e){ return false; }
}
function periodeSync(){
  return quotaDegrade()?SYNC_PERIODE_DEGRADEE_MS:SYNC_PERIODE_MS;
}
const RCM_BASE='https://repcore-sync-default-rtdb.firebaseio.com/metrics';
function rcm(nom){
  try{
    if(RCM_EVENEMENTS.indexOf(nom)===-1) return;
    // Le développement local ne doit pas polluer les chiffres de production.
    const h=location.hostname;
    if(h==='localhost'||h==='127.0.0.1'||h===''||h.startsWith('192.168.')) return;
    // .sv/increment : incrément atomique côté serveur. Sans lui, deux visiteurs
    // simultanés liraient la même valeur et en écriraient la même — un des deux
    // passages serait perdu.
    fetch(RCM_BASE+'/'+localISODate(new Date())+'/'+nom+'.json',{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({'.sv':{'increment':1}}),
      // L'étape est souvent la dernière chose qui se produit avant un
      // changement d'écran ou une fermeture : sans keepalive, l'événement le
      // plus intéressant du tunnel serait justement celui qu'on perdrait.
      keepalive:true
    }).catch(()=>{});
  }catch(e){}
}
// ══════════════ LES COMPTEURS DE CAPACITÉ, AGRÉGÉS ═════════════════════════
//
// CE QUI MANQUAIT. `etatQuota()` compte les octets de RTDB — mais dans le
// localStorage DE CET APPAREIL. Sur le téléphone d'un athlète, il dit ce que CE
// téléphone a transporté ; le quota du projet, lui, est la somme de tous. Le
// relevé de la carte « Capacité » était donc structurellement faux comme mesure
// de capacité : juste comme mesure de cet appareil, et illisible comme mesure
// du service. Il n'existait AUCUN chiffre global, et aucune façon de savoir
// combien Cloudinary recevait.
//
// ON AGRÈGE DONC PAR JOUR, comme rcm() le fait pour le tunnel d'inscription :
// un incrément SERVEUR (`.sv`), atomique, sans lecture préalable. Deux
// appareils qui écrivent en même temps ne s'écrasent pas.
//
// ⚠ EN KILO-OCTETS, ET CE N'EST PAS UN DÉTAIL. La règle du nœud metrics borne
//   chaque compteur à dix millions : en octets, un seul jour de trafic la
//   franchirait et l'écriture serait REFUSÉE. En kilo-octets, dix millions font
//   dix gigaoctets par jour — largement au-delà de ce que ce service consomme.
//
// ⚠ ET LES NOMS DOIVENT ÊTRE DANS LES RÈGLES. Le `.validate` de metrics porte
//   une liste blanche de noms d'événements : un nom absent est refusé. Les
//   quatre noms ci-dessous y ont été ajoutés — mais database.rules.json N'EST
//   PAS DÉPLOYÉ par le déploiement automatique, qui ne publie que l'hébergement.
//   Tant que `firebase deploy --only database` n'a pas tourné, ces écritures
//   sont refusées. C'EST COMPTÉ, ET LA CARTE LE DIT : un écran qui afficherait
//   zéro pendant que les compteurs sont rejetés serait pire qu'un écran vide.
const RCQ_NOMS=Object.freeze(['oct_in_ko','oct_out_ko','cld_envois','cld_ko']);
const RCQ_FLUSH_MS=45000;
const RCQ_CIEL=9000000;
// UN PAS AU PLUS PAR ECRITURE (01/10/2026) : la regle de /metrics refuse
// qu'un compteur de capacite avance de plus d'un million en un PUT. Le reste
// attend dans le tampon le paquet suivant.
const RCQ_PAS_MAX=1000000;          // sous le plafond de dix millions de la règle
let _rcqTampon=Object.create(null);
let _rcqReste=Object.create(null);   // les octets pas encore convertis en Ko
let _rcqMinuteur=null;
let _rcqEnvoyes=0, _rcqRefuses=0, _rcqDernier=0;

/** PURE. Le jour courant, au format du nœud metrics. */
function rcqJour(d){ return localISODate(d||new Date()); }
/**
 * Ajoute au tampon. RIEN NE PART TOUT DE SUITE : une synchronisation écrit
 * plusieurs fois par minute, et un aller-retour par écriture coûterait plus
 * cher que ce qu'on mesure. On regroupe, et on vide au plus tard au bout de
 * quarante-cinq secondes.
 */
function rcq(nom,n){
  try{
    if(RCQ_NOMS.indexOf(nom)<0) return false;
    const v=Number(n);
    if(!(v>0)) return false;
    _rcqTampon[nom]=(_rcqTampon[nom]||0)+v;
    if(!_rcqMinuteur) _rcqMinuteur=setTimeout(()=>{ _rcqMinuteur=null; rcqVider(); },RCQ_FLUSH_MS);
    return true;
  }catch(e){ return false; }
}
/** Les octets se convertissent en Ko SANS PERDRE LE RESTE : mille appels de
 *  500 octets valent 488 Ko, pas zéro. */
function rcqOctets(nom,octets){
  const o=Number(octets);
  if(!(o>0)) return false;
  _rcqReste[nom]=(_rcqReste[nom]||0)+o;
  const ko=Math.floor(_rcqReste[nom]/1024);
  if(ko<1) return true;
  _rcqReste[nom]-=ko*1024;
  return rcq(nom,ko);
}
/**
 * Vide le tampon. Ne lève jamais : c'est une mesure, pas une fonctionnalité —
 * et une mesure qui casserait l'app serait le comble.
 */
async function rcqVider(){
  const t=_rcqTampon;
  _rcqTampon=Object.create(null);
  const noms=Object.keys(t);
  if(!noms.length) return {envoyes:0};
  try{
    const h=location.hostname;
    // Le développement local ne pollue pas les chiffres de production, comme
    // pour rcm() — sinon un banc à deux appareils remplirait le compteur.
    if(h==='localhost'||h==='127.0.0.1'||h===''||h.startsWith('192.168.')) return {local:true};
  }catch(e){}
  const jour=rcqJour();
  let ok=0,ko=0;
  for(const nom of noms){
    const v=Math.min(RCQ_CIEL,RCQ_PAS_MAX,Math.round(t[nom]));
    if(!(v>0)) continue;
    if(Math.round(t[nom])>v) _rcqTampon[nom]=(_rcqTampon[nom]||0)+(t[nom]-v);
    try{
      const r=await fetch(RCM_BASE+'/'+jour+'/'+nom+'.json',{
        method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({'.sv':{'increment':v}}),keepalive:true});
      if(r.ok) ok++;
      else { ko++; _rcqTampon[nom]=(_rcqTampon[nom]||0)+v; }
    }catch(e){ ko++; _rcqTampon[nom]=(_rcqTampon[nom]||0)+v; }
  }
  _rcqEnvoyes+=ok; _rcqRefuses+=ko;
  if(ok) _rcqDernier=Date.now();
  // ON NE REJOUE PAS INDÉFINIMENT : si les règles refusent, le tampon
  // regonflerait sans fin. Au-delà de trois refus, on garde le compte des
  // refus — que la carte affiche — et on jette le tampon.
  if(ko&&_rcqRefuses>3) _rcqTampon=Object.create(null);
  return {envoyes:ok,refuses:ko};
}
/** Ce que la carte doit savoir de l'état des compteurs eux-mêmes. */
function rcqEtat(){
  return {envoyes:_rcqEnvoyes,refuses:_rcqRefuses,dernier:_rcqDernier,
    enAttente:Object.keys(_rcqTampon).length};
}

// ── CE QUE LE MOIS A CONSOMMÉ, TOUS APPAREILS CONFONDUS ───────────────────
//
// ⚠ UNE SEULE REQUÊTE, bornée aux jours du mois. Lire le nœud entier
//   demanderait un droit de lecture sur `metrics`, qui n'est ouvert qu'au
//   créateur — et c'est lui, et lui seul, qui ouvre cet écran.
const CLOUDINARY_QUOTA_MOIS_OCTETS=25*Math.pow(2,30);
/**
 * PURE. La somme des compteurs d'un relevé {jour:{nom:valeur}}.
 * Séparée de la lecture réseau pour être éprouvable sans serveur.
 */
function rcqSomme(releve,mois){
  const out={oct_in_ko:0,oct_out_ko:0,cld_envois:0,cld_ko:0,jours:0,premier:null,dernier:null};
  const pref=String(mois||'');
  for(const jour of Object.keys(releve||{})){
    if(pref&&jour.indexOf(pref)!==0) continue;
    const d=releve[jour]||{};
    let vu=false;
    for(const n of RCQ_NOMS) if(Number(d[n])>0){ out[n]+=Number(d[n]); vu=true; }
    if(vu){
      out.jours++;
      if(!out.premier||jour<out.premier) out.premier=jour;
      if(!out.dernier||jour>out.dernier) out.dernier=jour;
    }
  }
  out.rtdbOctets=(out.oct_in_ko+out.oct_out_ko)*1024;
  out.cldOctets=out.cld_ko*1024;
  return out;
}
let _capaciteGlobale=null;
/** Le relevé agrégé du mois. Rend null quand il n'a pas pu être lu — et la
 *  carte le dit alors, au lieu d'afficher un zéro qui passerait pour du calme. */
async function etatCapaciteGlobale(){
  try{
    if(!currentUser||currentUser.email!==CREATOR_EMAIL) return null;
    const jeton=await CLOUD._getToken();
    if(!jeton) return null;
    const d=new Date();
    const mois=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const r=await fetch(RCM_BASE+'.json?orderBy="$key"&startAt="'+mois+'-01"'
      +'&endAt="'+mois+'-31"&auth='+encodeURIComponent(jeton));
    if(!r.ok) return {erreur:'lecture refusée ('+r.status+')'};
    const somme=rcqSomme(await r.json()||{},mois);
    somme.mois=mois;
    _capaciteGlobale=somme;
    return somme;
  }catch(e){ return {erreur:String(e&&e.message||e)}; }
}

// LOT C7 : les gestes du coach. JAMAIS depuis un compte athlète : le garde est
// ici, et nulle part ailleurs ne s'écrit un compteur coach_*.
const RCM_COACH=Object.freeze(['coach_message_envoye','coach_programme_assigne','coach_fiche_ouverte',
  'coach_bilan_repondu','coach_canal_publie','coach_relance_auto']);
function rcmCoach(nom){
  try{
    if(RCM_COACH.indexOf(nom)<0) return false;
    if(!currentUser||currentUser.role!=='coach') return false;
    rcm(nom);
    return true;
  }catch(e){ return false; }
}
// Étapes « vue d'écran » : comptées une seule fois par session de navigation.
// Sans ce garde, un aller-retour entre l'accueil et l'inscription — le
// comportement normal de quelqu'un qui hésite — gonflerait l'étape et ferait
// apparaître un taux de conversion inférieur à la réalité.
// sessionStorage et non localStorage : on veut une fois par visite, pas une
// fois dans la vie de l'appareil.
function rcmVue(nom){
  try{
    const cle='rcm_vu_'+nom;
    if(sessionStorage.getItem(cle)) return;
    sessionStorage.setItem(cle,'1');
  }catch(e){}
  rcm(nom);
}

// ══════════ RETENTION : DEUX ETAPES QUI SE DECIDENT AU DEMARRAGE ═══════
//
// Le tunnel mesurait l'acquisition et s'arretait au premier bilan. Ces deux
// compteurs-ci disent ce qu'il advient ensuite : qui revient le lendemain, et
// qui a un compte depuis une semaine sans avoir jamais lance une seance.
//
// ⚠ AUCUNE DONNEE NE CHANGE DE NATURE. Ce qui part sur le reseau reste
// « +1 sur cette etape aujourd'hui », sans jeton et sans identifiant, comme
// pour les trente autres. Ce qui est NOUVEAU, c'est qu'il faut savoir si on a
// deja compte aujourd'hui pour ce compte, sans quoi quelqu'un qui recharge
// six fois compterait six retours. Cette memoire reste SUR L'APPAREIL, dans
// une cle localStorage datee, et n'est jamais transmise — meme procede que
// rcmVue avec sessionStorage, meme garantie.
//
// PURE, ET C'EST LE POINT. Toute la decision — l'age du compte, le role, les
// seances, le jour deja compte — tient dans cette fonction, qui ne lit ni
// l'horloge ni le stockage ni le reseau : on les lui passe. Elle s'eprouve
// donc entierement sans navigateur, ce qu'une regle de retention merite : une
// erreur ici ne se verrait pas a l'ecran, elle se verrait dans six mois dans
// un chiffre faux dont personne ne saurait qu'il l'est.
//
// Rend la LISTE des etapes a compter pour ce demarrage — vide la plupart du
// temps, et c'est le cas normal.
function etapesRetention(user,vus,auj,maintenant){
  const out=[];
  if(!user||!user.email) return out;
  // SANS DATE DE CREATION, ON NE SUPPOSE RIEN. Les comptes d'avant
  // l'existence de createdAt n'ont pas d'age connu ; les compter comme
  // « plus de 24 h » gonflerait retour_j1 de tous les anciens dossiers le
  // jour de la mise en ligne, et ce pic se lirait comme un succes.
  const cree=Number(user.createdAt)||0;
  if(!cree) return out;
  const t=Number(maintenant)||0;
  if(!t) return out;
  const age=t-cree;
  const v=(vus&&typeof vus==='object')?vus:{};
  const J=864e5;
  // ── LE RETOUR DU LENDEMAIN ──────────────────────────────────────────
  // Plus de 24 h d'anciennete, et pas encore compte aujourd'hui. La cle
  // datee porte la journee : le premier demarrage d'une journee nouvelle
  // compte, les suivants non.
  if(age>J&&v.retour_j1!==auj) out.push('retour_j1');
  // ── SEPT JOURS, PAS UNE SEULE SEANCE ────────────────────────────────
  // ROLE ATHLETE SEULEMENT : un coach n'a pas a s'entrainer dans l'app, et
  // le compter ici ferait passer chaque coach pour un athlete perdu.
  // `sessions` absent vaut vide — un compte neuf n'a pas le champ.
  const seances=(user.sessions&&user.sessions.length)||0;
  if(age>7*J&&user.role==='athlete'&&!seances&&v.jamais_demarre_7j!==auj)
    out.push('jamais_demarre_7j');
  return out;
}
const RCM_RETENTION_CLE='rcm_retention_';
// Le tour impur : lire la cle, appeler la fonction pure, compter, reecrire.
//
// ⚠ LE JOUR EST MARQUE MEME SI rcm() NE PART PAS — developpement local, nom
// hors liste, reseau coupe. C'est voulu : on ne peut pas savoir si
// l'increment est arrive (la requete est deliberement sans reponse lue), et
// entre risquer de perdre un comptage et risquer d'en compter six pour un
// seul demarrage, c'est le second qui fausse le chiffre.
function rcmRetention(user){
  try{
    if(!user||!user.email) return;
    const cle=RCM_RETENTION_CLE+user.email;
    let vus={};
    try{ vus=JSON.parse(localStorage.getItem(cle)||'{}')||{}; }catch(e){ vus={}; }
    const auj=localISODate(new Date());
    const etapes=etapesRetention(user,vus,auj,Date.now());
    if(!etapes.length) return;
    for(const e of etapes){ rcm(e); vus[e]=auj; }
    try{ localStorage.setItem(cle,JSON.stringify(vus)); }catch(e){}
  }catch(e){}
}

// APP_BASE_URL : racine publique de l'app, déduite de l'adresse courante.
// Jamais codée en dur — un changement de dépôt, de chemin ou de domaine
// (GitHub Pages, domaine perso, sous-dossier) suit automatiquement.
// Sert aux liens d'invitation coach et au QR code multi-appareils.
const APP_BASE_URL=(()=>{
  const strip=u=>u.replace(/[?#].*$/,'').replace(/[^/]*$/,'');
  // location.origin vaut "null" sur les pages file:// (test local) → repli sur href
  return (location.origin&&location.origin!=='null')
    ? location.origin+strip(location.pathname)
    : strip(location.href);
})();

// ══════════ OU VIT LE FICHIER APK ══════════════════════════════════════
//
// VIDE TANT QU'AUCUN HEBERGEUR NE LE SERT, et le lien reste alors cache.
//
// ⚠ FIREBASE HOSTING NE PEUT PAS LE SERVIR. Ce n'est pas une question de
// quota : le plan Spark REFUSE les fichiers executables, et le deploiement
// echoue avec « Executable files are forbidden on the Spark billing plan ».
// Un .apk en fait partie. Le mettre dans _site fait echouer le deploiement
// ENTIER, pas seulement le fichier — mesure le 02/09/2026.
//
// Il faut donc un hebergeur tiers, et en choisir un est une decision qui
// appartient a Kevin : cela ajoute un sous-traitant au tableau de
// privacy.html, et cela suppose d'ouvrir un compte. Le jour ou l'adresse
// existe, elle se pose ICI et le lien reapparait — une ligne, rien d'autre.
//
// Le fichier, lui, existe : 2,47 Mo, signe, empreinte verifiee contre
// assetlinks.json.
const RC_APK_URL='';

// ══════════ LE LIEN COURT ══════════════════════════════════════════════
//
// repcore-sync.web.app/i — dictable a l'oral, imprimable sur un flyer, et
// surtout COURT : un QR encode moins de donnees, donc des modules plus gros,
// donc une lecture qui se fait de plus loin. C'est la seule raison technique
// qui compte ici.
//
// DEDUIT, JAMAIS CODE EN DUR, comme APP_BASE_URL juste au-dessus et pour la
// meme raison. La reecriture /i n'existe que sur l'hebergement Firebase, ou
// l'application vit sous /app/ : c'est a cette forme-la qu'on la reconnait.
// Servie depuis un sous-dossier — GitHub Pages sous /coaching/app/, ou un
// fichier local — /i n'existe pas, et on rend l'adresse longue plutot qu'un
// lien mort. Un QR qui ne mene nulle part est pire que pas de QR.
const RC_LIEN_COURT=(()=>{
  try{
    if(location.origin&&location.origin!=='null'){
      const _p=location.pathname;
      // ARRIVER PAR /i PROUVE QUE LA REECRITURE EXISTE — c'est elle qui a
      // servi cette page. Sans ce cas, le QR affiche sur ordinateur pointait
      // vers la RACINE, c'est-a-dire la page de vente, au lieu de l'ecran
      // d'installation. Et il le faisait precisement pour les gens venus par
      // le lien court : ceux a qui on l'a donne, donc tout le monde.
      // Mesure du 02/09/2026 sur https://repcore-sync.web.app/i :
      // RC_LIEN_COURT valait « https://repcore-sync.web.app/ ».
      if(_p.indexOf('/app/')===0||_p==='/i'||_p==='/i/') return location.origin+'/i';
    }
  }catch(e){}
  // SERVI DEPUIS UN SOUS-DOSSIER, /i N'EXISTE PAS : on rend l'adresse longue
  // plutot qu'un lien mort.
  return APP_BASE_URL;
})();

// ══════════ L'ADRESSE QUE PORTE LE QR DE LA CARTE DE SEANCE ════════════
//
// C'EST LE LIEN DU FLYER, ET RIEN D'AUTRE POUR L'INSTANT. repcore-sync.web.app/i
// mene a l'ecran d'installation : quelqu'un qui scanne la carte partagee par un
// athlete tombe donc sur « installe l'application », pas sur une adresse morte.
// C'est la meilleure destination qui EXISTE aujourd'hui, pas la bonne
// destination dans l'absolu.
//
// ELLE BASCULERA VERS LA VITRINE PUBLIQUE DU COACH quand celle-ci existera —
// une page servie sans compte, ou l'on verrait qui est le coach et ce qu'il
// vend. Ce jour-la, une seule ligne change ici. C'est pour cela que la valeur
// est nommee une fois, au lieu d'etre recopiee dans le dessin.
//
// ⚠ DECLAREE ICI ET NON A COTE DE RCM_BASE, bien que ce soit la meme famille de
// constantes de reglage : elle vaut RC_LIEN_COURT, et un `const` n'est pas
// hisse. Posee plus haut, elle lirait RC_LIEN_COURT avant son initialisation —
// une ReferenceError a l'evaluation du fichier, donc une application qui ne
// demarre pas du tout.
// ⚠ DEPUIS LES PAGES PUBLIQUES (26/09/2026), C'EST LEUR RACINE : /@<pseudo>
// et /coach/<slug> y vivent (urlPagePerso, lienPerso). Sur Firebase, l'origine ;
// servi depuis un sous-dossier, le dossier du site (où p/ et c/ existent). Le
// QR de la carte « Séance du jour » ne l'encode plus nue : il encode
// lienPerso('qr') (urlQrSeance), et ne retombe sur elle que sans lien perso.
const RC_URL_VITRINE=/\/i$/.test(RC_LIEN_COURT)?RC_LIEN_COURT.replace(/\/i$/,''):APP_BASE_URL.replace(/app\/$/,'');

// PAYPAL_CLIENT_ID / PAYPAL_PLAN_ID : liés au compte PayPal du créateur
//   (App créée sur developer.paypal.com avec guellec.coachingpro@gmail.com).
//   Abonnement : 9,95 EUR/mois — Plan RepCore Mensuel.
//   Ces valeurs sont fixes et centralisées : aucun coach tiers ne peut les modifier.
const PAYPAL_CLIENT_ID='AS9pdM1fxqdyzKzvuiQB3mTPAIHZW12rW_KWAOKB8XkalJXV8kEyWWBzwHPUxCBZtMMzqjJNnAjfa1f1';
const PAYPAL_PLAN_ID='P-95N51603RD882780YNJKS2QA';
// ══ LES PLANS ANNUELS (02/10/2026) : L'ANNUEL REMISÉ, DE NOUVEAUX PLANS ════
// L'annuel valait douze mensualités ; il est de nouveau remisé (tarifs.json). Les plans PayPal d'avant NE CHANGENT PAS DE PRIX : les
// abonnés annuels en cours gardent le leur. Les nouveaux prix demandent de
// NOUVEAUX plans, créés par `node scripts/paypal_plans.mjs --ecrire`, qui
// colle leurs identifiants ici (et dans OFFRES_PAYPAL du Worker).
// VIDES TANT QU'ILS NE SONT PAS CRÉÉS : l'offre annuelle n'est alors PAS
// proposée (l'écran retombe sur le mensuel). Jamais un prix annoncé et un
// autre prélevé par l'ancien plan.
const PAYPAL_PLAN_ID_ANNUEL='';
// LES ANCIENS PLANS ANNUELS : plus vendus, mais leurs abonnés en cours y
// restent. formuleDuPlan les reconnaît ; le Worker les garde dans OFFRES_PAYPAL.
// (Essentielle annuel d'avant, puis Ultime annuel d'avant : leurs montants sont
// dans OFFRES_PAYPAL, cloudflare/src/paypal.js.)
const PAYPAL_PLAN_ID_ANNUEL_ANCIEN='P-92T09491KF550281RNK2LZWY';
const PAYPAL_PLAN_ID_ULTIME_ANNUEL_ANCIEN='P-16Y44630WF304553UNK2LZXI';
const PAYPAL_PLAN_ID_ULTIME='P-2W777608239063532NK2LZXA';
// Le nouvel annuel d'Ultime : vide tant que son plan n'est pas créé, voir plus haut.
const PAYPAL_PLAN_ID_ULTIME_ANNUEL='';
// ⚠ LE PREMIER MOIS A MOITIE PRIX APRES UN PACK (lot 10). C'est un plan
//   PAYPAL A PART, et non une remise appliquee a la main : un abonnement
//   mensuel dont le PREMIER cycle est a 12,45 EUR et les suivants a 24,90.
//     PayPal → Billing Plans → « RepCore Ultime, premier mois apres pack »
//     Cycle 1 : 12,45 EUR, TRIAL, 1 mois, 1 fois.
//     Cycle 2 : 24,90 EUR, REGULAR, mensuel, illimite.
//   TANT QUE CETTE CASE EST VIDE, L'OFFRE N'EST PAS ANNONCEE DU TOUT : la
//   sortie de pack propose alors Ultime au prix normal. On ne promet pas un
//   prix qu'on ne sait pas encaisser.
const PAYPAL_PLAN_ID_ULTIME_DEMI='P-57P40267XP026613FNK2LZXQ';
// PURE. Le plan PayPal d'une offre, ou '' quand il n'a pas encore ete cree.
// UN SEUL ENDROIT SAIT QUEL PLAN VA AVEC QUELLE OFFRE : sans ca, l'ecran des
// tarifs et le bouton de paiement finiraient par ne plus parler du meme.
function planIdOffre(cle,annuel){
  if(cle==='essentielle') return annuel?PAYPAL_PLAN_ID_ANNUEL:PAYPAL_PLAN_ID;
  if(cle==='ultime') return annuel?PAYPAL_PLAN_ID_ULTIME_ANNUEL:PAYPAL_PLAN_ID_ULTIME;
  if(cle==='ultime_demi') return PAYPAL_PLAN_ID_ULTIME_DEMI;
  return '';
}
// Les deux paliers, dans l'ordre d'affichage. `dispo` est ce qui décide de
// montrer ou non une carte : il n'y a pas d'état « bientôt disponible ».
// ══ LES TARIFS : tarifs.json, A LA RACINE DU DEPOT ════════════════════════
// Les prix de l'app, de la page de vente et des CGV viennent de ce fichier, et
// de lui seul. Le bloc ci-dessous en est la COPIE, posee par
// scripts/tarifs.mjs : ne le modifie pas ici, modifie tarifs.json et relance
// le script (scripts/verif/tarifs.mjs refuse une copie en retard).
// Pas de fetch au demarrage : les prix doivent exister avant le premier
// ecran, hors ligne compris.
/* TARIFS:DEBUT */
const TARIFS=(function geler(o){ Object.values(o).forEach(v=>{ if(v&&typeof v==='object') geler(v); }); return Object.freeze(o); })({"devise":"EUR","engagementMois":12,"essentielle":{"mois":9.5,"an":95},"ultime":{"mois":24.9,"an":249},"ultime_demi":{"part":0.5,"premierMois":12.45},"essai":{"mois":1,"jours":30,"carte":false},"essai_parrainage":{"moisEnPlus":1},"coach":{"libre":0,"coach":19,"pro":39},"coaching":{"programme_perso":{"prix":99,"mois":3,"lib":"Programme personnalisé","comprend":"Un programme construit pour toi, avec 3 mois d'app inclus. Sans suivi."},"revision_prog":{"prix":40,"mois":1,"lib":"Révision de programme","comprend":"Ton programme ajusté quand tu en as besoin, sans échéance."},"boutique_prog":{"prix":14.9,"mois":3},"coaching_essentiel":{"prix":150,"mois":1,"lib":"Coaching Essentiel","comprend":"Programme sur mesure, suivi dans l'app, bilans et réponses de ton coach."},"coaching_transfo":{"prix":350,"mois":3,"lib":"Coaching Transformation","comprend":"Le suivi complet sur trois mois : programme ajusté bloc après bloc, bilans et réponses de ton coach."},"coaching_evolution":{"prix":600,"mois":6,"lib":"Coaching Évolution","comprend":"Le suivi complet sur six mois, le temps d'une vraie transformation."}}});
/* TARIFS:FIN */
// ══ LES OFFRES, ECRITES UNE SEULE FOIS (lot 1) ═══════════════════════════
//
// UNE SEULE TABLE POUR LE COACHING ET POUR LES ABONNEMENTS. Deux tables
// auraient diverge : un prix corrige d'un cote, oublie de l'autre, et deux
// ecrans qui ne disent pas la meme chose a la meme personne. C'est deja
// arrive ici — PRIX_ATHLETE_MOIS annoncait 9,50 pendant que PayPal
// encaissait 9,95.
//
// CHAQUE OFFRE DIT CE QU'ELLE OUVRE, ET POUR COMBIEN DE TEMPS :
//   palier   le palier ouvert (voir PALIERS_ORDRE)
//   mois     la duree ouverte, en mois ; 0 pour un abonnement, qui court
//   prix     en euros, un NOMBRE — la mise en forme est faite par prixOffre
//   prixAn   le tarif annuel d'un abonnement, quand il existe
//
// ⚠ AUCUN MONTANT EN DUR AILLEURS. Tout ecran qui affiche un prix le lit ici,
//   par prixOffre ou prixMoisAnnuel ; et ici, chaque montant vient de TARIFS.
const _TC=TARIFS.coaching;
const OFFRES=Object.freeze({
  // ── Ce que le coach vend ────────────────────────────────────────────
  programme_perso:    Object.freeze({lib:'Programme personnalisé',   prix:_TC.programme_perso.prix,    palier:'ultime', mois:_TC.programme_perso.mois,    type:'ponctuel'}),
  revision_prog:      Object.freeze({lib:'Révision de programme',    prix:_TC.revision_prog.prix,      palier:'ultime', mois:_TC.revision_prog.mois,      type:'ponctuel'}),
  boutique_prog:      Object.freeze({lib:'Programme de la boutique', prix:_TC.boutique_prog.prix,      palier:'ultime', mois:_TC.boutique_prog.mois,      type:'ponctuel'}),
  coaching_essentiel: Object.freeze({lib:'Coaching Essentiel',       prix:_TC.coaching_essentiel.prix, palier:'suivi',  mois:_TC.coaching_essentiel.mois, type:'coaching'}),
  coaching_transfo:   Object.freeze({lib:'Coaching Transformation',  prix:_TC.coaching_transfo.prix,   palier:'suivi',  mois:_TC.coaching_transfo.mois,   type:'coaching'}),
  coaching_evolution: Object.freeze({lib:'Coaching Évolution',       prix:_TC.coaching_evolution.prix, palier:'suivi',  mois:_TC.coaching_evolution.mois, type:'coaching'}),
  // ── Ce que l'application vend, quand personne ne suit la personne ───
  // ⚠ ENGAGEMENT DOUZE MOIS, DEUX FAÇONS DE LE RÉGLER (24/09/2026, demande de
  //   Kevin). L'annuel a valu douze mensualités ; depuis le 02/10/2026 il est
  //   de nouveau REMISÉ (95 € et 249 €, tarifs.json). La remise (− x %) se
  //   calcule (_economie) : elle s'affiche d'elle-même, et disparaîtrait si
  //   `prixAn` remontait à douze mensualités.
  essentielle:        Object.freeze({lib:'Essentielle', prix:TARIFS.essentielle.mois, prixAn:TARIFS.essentielle.an, palier:'essentielle', mois:0, type:'abonnement'}),
  ultime:             Object.freeze({lib:'Ultime',      prix:TARIFS.ultime.mois,      prixAn:TARIFS.ultime.an,      palier:'ultime',      mois:0, type:'abonnement'}),
  // ── La sortie de pack : le premier mois a moitie prix, UNE SEULE FOIS ──
  // ⚠ LE PRIX SE CALCULE, IL NE S'ECRIT PAS : la moitie d'Ultime suit Ultime
  //   le jour ou Ultime bouge. Un 12,45 ecrit en dur aurait vecu plus
  //   longtemps que le prix dont il est la moitie.
  //   Le prix se LIT sur Ultime au moment ou on le demande : un nombre
  //   recopie ici serait la moitie d'un prix d'hier.
  ultime_demi:        Object.freeze({lib:'Ultime, premier mois',
                        get prix(){ return Math.round(OFFRES.ultime.prix*TARIFS.ultime_demi.part*100)/100; },
                        palier:'ultime', mois:1, type:'abonnement'}),
  // ── Et l'essai, qui ne se paie pas ──────────────────────────────────
  essai:              Object.freeze({lib:'Essai',       prix:0,     palier:'ultime', mois:TARIFS.essai.mois, type:'essai'}),
  // Le mois d'essai EN PLUS du filleul d'un parrainage (s'ajoute à `essai`).
  essai_parrainage:   Object.freeze({lib:'Essai offert par un ami', prix:0, palier:'ultime', mois:TARIFS.essai_parrainage.moisEnPlus, type:'essai'}),
});
// PURE. Un montant en euros, a la francaise.
// ⚠ ESPACE INSECABLE AVANT LE SYMBOLE : la coupure « 9,95 » / « € » en fin de
//   ligne est fautive en typographie francaise, et elle arrive sur telephone.
function _euros(n){
  const v=Number(n)||0;
  // ⚠ DEUX DECIMALES DES QU'IL Y A DES CENTIMES, ET LES DEUX : « 24,9 € » se
  //   lit comme une faute de frappe sur un prix, et « 14,9 € » aussi.
  const s=(Math.round(v*100)%100===0)?String(Math.round(v))
    :v.toFixed(2).replace('.',',');
  return s+'\u00a0€';
}
function offre(cle){ return OFFRES[cle]||null; }
// PURE. Le prix d'une offre. `an` demande le tarif annuel quand il existe.
function prixOffre(cle,an){
  const o=offre(cle);
  if(!o) return '';
  if(an&&o.prixAn) return _euros(o.prixAn);
  return _euros(o.prix);
}
// PURE. Ce que coute un mois d'abonnement annuel — le chiffre qui vend.
function prixMoisAnnuel(cle){
  const o=offre(cle);
  if(!o||!o.prixAn) return '';
  return _euros(Math.round(o.prixAn/12*100)/100);
}

// ══ CE QUE CHAQUE PALIER OUVRE ═══════════════════════════════════════════
// UNE SEULE SOURCE DE VERITE : aucun ecran ne teste le palier a la main, tous
// appellent peut(u,'capacite'). Un test a la main dans un ecran, c'est une
// regle de plus a corriger le jour ou l'offre bouge — et celle qu'on oublie.
//
// ⚠ LES SEPT PREMIERES SONT DEJA LE COMPORTEMENT D'AUJOURD'HUI, et ce lot n'y
//   touche pas : composer ses seances, s'entrainer, son historique, ses
//   bilans, son journal libre, son lifestyle et sa sante restent ouverts.
//   Ce lot DECLARE l'existant ; les lots 3 et 4 ouvrent et ferment le reste.
const CAPACITES=Object.freeze({
  composerSeances:      Object.freeze(['essentielle','ultime','suivi']),
  seance:               Object.freeze(['essentielle','ultime','suivi']),
  historique:           Object.freeze(['essentielle','ultime','suivi']),
  bilans:               Object.freeze(['essentielle','ultime','suivi']),
  nutritionLibre:       Object.freeze(['essentielle','ultime','suivi']),
  lifestyle:            Object.freeze(['essentielle','ultime','suivi']),
  sante:                Object.freeze(['essentielle','ultime','suivi']),
  bibliothequeMethodes: Object.freeze(['ultime','suivi']),
  bibliothequeProtocoles:Object.freeze(['ultime','suivi']),
  planification:        Object.freeze(['ultime','suivi']),
  dieteCalculee:        Object.freeze(['ultime','suivi']),
  complements:          Object.freeze(['ultime','suivi']),
  volume:               Object.freeze(['ultime','suivi']),
  perfs1rm:             Object.freeze(['ultime','suivi']),
  rapport:              Object.freeze(['ultime','suivi']),
  // ⚠ LE CATALOGUE D'EXERCICES EST A ULTIME SEUL. L'athlete suivi ne le
  //   parcourt pas : il recoit les fiches DES EXERCICES DE SON PROGRAMME,
  //   ciblees par son coach (lot 3).
  bibliothequeExercices:Object.freeze(['ultime']),
  // Ce qu'un coach fait, et que personne d'autre ne fait.
  correctionVideo:      Object.freeze(['suivi']),
  canal:                Object.freeze(['suivi']),
  protocolesMorpho:     Object.freeze(['suivi']),
  amplitudes:           Object.freeze(['suivi']),
  chargesArticulaires:  Object.freeze(['suivi']),
  programmeRecu:        Object.freeze(['suivi']),
});
// PURE (elle ne lit que le dossier et le cache des droits).
//
// ⚠ L'ESSAI VAUT ULTIME, et c'est le modele : on ne convertit personne en lui
//   montrant une version amputee. Il ouvre tout ce qu'Ultime ouvre, et rien
//   de ce que seul un coach fait.
// ⚠ UN COACH PASSE PARTOUT : il travaille sur les dossiers des autres, et la
//   bibliotheque d'exercices est son outil de tous les jours.
function palierEffectif(u){
  if(!u) return 'aucun';
  if(estCoachReconnu(u)) return 'suivi';
  const p=palierDe(u);
  if(p!=='aucun') return p;
  try{ if(essaiActif(u)) return 'ultime'; }catch(e){}
  return 'aucun';
}
function peut(u,capacite){
  if(u&&estCoachReconnu(u)) return true;
  const l=CAPACITES[capacite];
  if(!l) return false;
  return l.indexOf(palierEffectif(u))>=0;
}

// ══════ LE VERROU, ET SA PHRASE QUI VEND (lot 4) ═════════════════════════
//
// UN ECRAN FERME DIT DEUX CHOSES, TOUJOURS : ce qui est ferme, et ce qui
// reste possible TOUT DE SUITE. Un mur sec fait fermer l'application ; une
// phrase qui propose la suite fait monter d'un cran. C'est la regle du
// chantier, et c'est pour ca que la construction est la meme partout.
//
// JAMAIS DE FENETRE MODALE, JAMAIS DE PAGE D'ERREUR. L'ecran s'affiche
// normalement, avec sa barre, son titre et ses onglets : SEULE la section
// fermee est remplacee par ce bloc. Le canal avait une modale « 🔒 Canal
// reserve » : elle part avec ce lot.
//
// DEUX FORMULATIONS, ET DEUX SEULEMENT, et elles vivent ICI, pas dans les
// ecrans. Un ecran qui ecrirait sa propre phrase finirait par en dire une
// troisieme, puis une quatrieme, et plus personne ne saurait ce que
// l'application promet.
const VERROU_VOIES=Object.freeze({
  ultime:Object.freeze({
    phrase:(ferme,ouvert)=>ferme+' fait partie d’Ultime. '+ouvert,
    bouton:'Voir Ultime'
  }),
  coaching:Object.freeze({
    phrase:(ferme,ouvert)=>ferme+', c’est avec un coach. '+ouvert,
    bouton:'Voir les formules de coaching'
  })
});
// CE QUI EST FERME, ET CE QUI RESTE POSSIBLE, capacite par capacite.
// ⚠ LA SECONDE MOITIE DOIT ETRE VRAIE. « Ici, tu peux ecrire le nom de ton
//   exercice » n'est pas une consolation : c'est ce que l'ecran fait vraiment
//   a cet endroit-la. Une promesse fausse se paie au premier essai.
const VERROUS=Object.freeze({
  volume:               {vers:'ultime',   ferme:'Suivre ton volume par muscle',
                         ouvert:'Tes séances et ton historique restent complets.'},
  perfs1rm:             {vers:'ultime',   ferme:'Le calcul de tes maxima',
                         ouvert:'Tes charges et tes répétitions restent notées à chaque séance.'},
  bibliothequeExercices:{vers:'ultime',   ferme:'Choisir dans la bibliothèque',
                         ouvert:'Ici, tu peux écrire le nom de ton exercice.'},
  bibliothequeMethodes: {vers:'ultime',   ferme:'Choisir une technique dans la liste',
                         ouvert:'Ici, tu peux écrire la tienne dans « Description / Technique ».'},
  // ⚠ AU SINGULIER : la phrase de la table se termine par « fait partie
  //   d'Ultime », et « Les protocoles tout prêts FAIT partie » se lit comme
  //   une faute. La tournure suit celle du catalogue, juste au-dessus.
  bibliothequeProtocoles:{vers:'ultime',  ferme:'Choisir un protocole tout prêt',
                         ouvert:'Tu peux écrire ton échauffement à la main, il reste dans ta séance.'},
  planification:        {vers:'ultime',   ferme:'La charge du bloc, semaine par semaine',
                         ouvert:'Tes séries restent visibles dans chaque séance.'},
  dieteCalculee:        {vers:'ultime',   ferme:'La diète calculée',
                         ouvert:'Tu peux noter ce que tu manges et suivre tes totaux.'},
  complements:          {vers:'ultime',   ferme:'Le plan de compléments',
                         ouvert:'Ta nutrition reste complète, avec tes totaux du jour.'},
  rapport:              {vers:'ultime',   ferme:'Le rapport complet',
                         ouvert:'Tes bilans et tes courbes restent consultables.'},
  correctionVideo:      {vers:'coaching', ferme:'La correction de tes mouvements',
                         ouvert:'Filme ta série, il te dit quoi corriger.'},
  canal:                {vers:'coaching', ferme:'Écrire à quelqu’un qui te répond',
                         ouvert:'Tes notes de séance gardent ce que tu ressens, séance après séance.'},
  chargesArticulaires:  {vers:'coaching', ferme:'Le suivi de tes charges articulaires',
                         ouvert:'Pendant ta séance, tu peux déclarer une gêne et l’app te propose un remplacement.'}
});
// LE BLOC, SANS CONDITION. Sert aux deux ou trois endroits ou la porte est
// deja fermee par une autre regle que la capacite — le canal, qui demande un
// coach nomme dans le dossier.
function rcVerrouBloc(capacite){
  const v=VERROUS[capacite];
  if(!v) return '';
  const voie=VERROU_VOIES[v.vers]||VERROU_VOIES.ultime;
  // LES CHIFFRES VENDENT, et ils viennent d'OFFRES : aucun prix n'est ecrit
  // ici. Seule la voie « ultime » en porte un ; le coaching se chiffre sur la
  // page des formules, qui est a jour la-bas et nulle part ailleurs.
  // ⚠ « X PAR MOIS EN ANNUEL » SEULEMENT S'IL Y A UNE ÉCONOMIE (02/10/2026),
  //   et si l'annuel se paie : quand l'année valait douze mensualités, le
  //   bloc disait « 24,90 € par mois en annuel, ou 24,90 € au mois » — deux
  //   fois le même montant, comme si payer d'avance changeait quelque chose.
  let prix='';
  if(v.vers==='ultime'){
    try{
      const an=_economie('ultime').texte&&planIdOffre('ultime',true);
      prix='<div class="vrr-p">'+(an
        ?'Ultime : '+prixMoisAnnuel('ultime')+' par mois en annuel, ou '+prixOffre('ultime')+' au mois.'
        :'Ultime : '+prixOffre('ultime')+' par mois.')+'</div>';
    }catch(e){ prix=''; }
  }
  const action=(v.vers==='coaching')
    ?'<a class="vrr-b" href="https://beacons.ai/kevin.gllc" target="_blank" rel="noopener">'
      +escapeHtml(voie.bouton)+'</a>'
    :'<button type="button" class="vrr-b" onclick="rcVerrouUltime()">'+escapeHtml(voie.bouton)+'</button>';
  return '<div class="vrr" data-verrou="'+escapeHtml(capacite)+'">'
    +'<div class="vrr-t">'+escapeHtml(voie.phrase(v.ferme,v.ouvert))+'</div>'
    +prix+action+'</div>';
}
// LA FONCTION UNIQUE. Rend null quand l'acces est libre — l'ecran se dessine
// alors comme si de rien n'etait — ou le bloc a afficher A LA PLACE.
//
// ⚠ LES PROTOCOLES PASSENT PAR peutVoirProtocoles ET NON PAR peut : un compte
//   qui les avait avant le lot 3 les garde, drapeau ou date de creation. Le
//   verrou ne doit pas reprendre ce que ce lot-la a promis de ne pas retirer.
function rcVerrou(capacite,user){
  const u=(user===undefined)?currentUser:user;
  if(!VERROUS[capacite]) return null;
  let libre=false;
  try{
    libre=(capacite==='bibliothequeProtocoles')?peutVoirProtocoles(u):peut(u,capacite);
  }catch(e){ libre=false; }
  return libre?null:rcVerrouBloc(capacite);
}
// LA PORTE D'ULTIME. Le meme chemin que la carte de l'ecran d'arrivee : le
// choix est memorise, et l'ecran d'abonnement s'ouvre.
function rcVerrouUltime(){
  try{ return accueilChoisir('ultime',true); }catch(e){ try{ go('s-subscribe'); }catch(_e){} }
  return true;
}
// PURE. CE QUE L'ANNÉE FAIT ÉCONOMISER, quand elle fait économiser quelque
// chose. Rend deux chaînes vides sinon — l'écran retombe alors sur le détail
// (« soit 9,50 / mois »), qui lui reste vrai.
//
// ⚠ ON NE TESTE PAS « prixAn < prix × 12 » A UN CENTIME PRES : 24,90 × 12 vaut
//   298,80000000000005 en virgule flottante. On compare des centimes entiers.
function _economie(cle){
  const o=offre(cle)||{};
  const mois=Math.round((Number(o.prix)||0)*100), an=Math.round((Number(o.prixAn)||0)*100);
  if(!an||!mois||an>=mois*12) return {texte:'',pourcent:''};
  return {texte:'Économise '+_euros(Math.round(mois*12-an)/100),
    pourcent:'−'+Math.round((1-an/(mois*12))*100)+' %'};
}
// Les deux paliers d'abonnement, dans l'ordre d'affichage.
// ⚠ LES PRIX VIENNENT D'OFFRES, PAS D'ICI (lot 1) : deux ecrans qui annoncent
//   deux prix pour le meme abonnement, c'est ce que ce lot ferme.
const SUB_PALIERS=[
  {cle:'annuel', titre:'Annuel', prix:prixOffre('essentielle',true), periode:'par an',
   detail:'soit '+prixMoisAnnuel('essentielle')+' / mois',
   // ⚠ RIEN QUAND IL N'Y A RIEN À ÉCONOMISER. Depuis que l'année vaut douze
   //   mensualités, « Économise 0,00 € » et « −0 % » s'affichaient tous les
   //   deux : deux mentions qui disent que ça ne sert à rien de payer
   //   d'avance, juste au-dessus du bouton qui le propose. Le calcul reste,
   //   la mention revient toute seule si le prix annuel redescend.
   econ:_economie('essentielle').texte,
   remise:_economie('essentielle').pourcent,
   planId:()=>PAYPAL_PLAN_ID_ANNUEL},
  {cle:'mensuel', titre:'Mensuel', prix:prixOffre('essentielle'), periode:'par mois',
   detail:_euros(Math.round(OFFRES.essentielle.prix*12*100)/100)+' sur un an', econ:'', remise:'',
   planId:()=>PAYPAL_PLAN_ID},
];
// LA TABLE EMPLOYÉE PAR L’ÉCRAN D’ABONNEMENT.
//
// souscrireCoach pose `rc_palier_coach` avant d’ouvrir l’écran : tant que
// cette clé est là, ce sont les paliers COACH qu’il faut montrer et facturer.
// Sans cette lecture, la clé était posée et jamais relue — l’écran gardait
// les paliers athlète, et le plan facturé était le mensuel de l’athlète.
//
// La clé vit en sessionStorage : elle ne survit pas à la fermeture de
// l’onglet, et c’est voulu — un coach qui revient sur cet écran par un autre
// chemin voit l’offre athlète, celle qui le concerne alors.
function _palierCoachEnAttente(){
  try{ return sessionStorage.getItem('rc_palier_coach')||''; }catch(e){ return ''; }
}
// PURE. Le palier retenu appartient-il à la table COACH ?
//
// Par appartenance à la table, et non par « ce n’est pas un palier athlète » :
// les deux tables n’ont aucune clef en commun aujourd’hui, mais une clef
// ajoutée demain d’un côté ne doit pas se faire ranger de l’autre par défaut.
function _palierEstCoach(cle){
  return !!cle&&COACH_PALIERS.some(x=>x.cle===cle);
}
// PURE. LA FORMULE QUE LA PERSONNE A CHOISIE avant d'arriver ici. Posee par
// accueilChoisir (carte de l'accueil, verrou, sortie de pack), lue ici.
// « essentielle » par defaut : c'est ce que l'ecran a toujours presente.
function subOffreChoisie(){
  let c='';
  try{ c=sessionStorage.getItem('rc_offre_choisie')||''; }catch(e){ c=''; }
  if(c==='ultime_demi') c='ultime';
  return (c==='ultime')?'ultime':'essentielle';
}
// LES DEUX PERIODES D'UNE FORMULE, a la forme que l'ecran sait afficher.
// ⚠ ELLES SE CONSTRUISENT SUR OFFRES, comme SUB_PALIERS : deux tables de prix
//   pour deux formules auraient diverge au premier ajustement.
function subPaliersDe(cle){
  const o=offre(cle);
  if(!o) return [];
  const an=Number(o.prixAn)||0, mois=Number(o.prix)||0;
  const l=[];
  if(an) l.push({cle:'annuel',titre:'Annuel',prix:prixOffre(cle,true),periode:'par an',
    detail:'soit '+prixMoisAnnuel(cle)+' / mois',
    econ:_economie(cle).texte, remise:_economie(cle).pourcent,
    planId:()=>planIdOffre(cle,true)});
  // LE DEMI-TARIF (sortie de pack, ou code ambassadeur de lancement) : le
  // mensuel d'Ultime passe par le plan « demi » — 1er mois à moitié prix.
  let demi=false;
  try{ demi=cle==='ultime'&&typeof currentUser!=='undefined'&&!!currentUser&&demiPremierMoisDispo(currentUser); }catch(e){ demi=false; }
  if(mois&&demi) l.push({cle:'mensuel',titre:'Mensuel',prix:prixOffre('ultime_demi'),periode:'le 1er mois',
    detail:'puis '+prixOffre(cle)+' par mois',econ:'1er mois à -50 %',remise:'',
    planId:()=>planIdOffre('ultime_demi')});
  else if(mois) l.push({cle:'mensuel',titre:'Mensuel',prix:prixOffre(cle),periode:'par mois',
    detail:_euros(Math.round(mois*12*100)/100)+' sur un an',econ:'',remise:'',
    planId:()=>planIdOffre(cle)});
  return l;
}
function _tablePaliers(){
  if(_palierCoachEnAttente()) return COACH_PALIERS;
  // ⚠ L'ECRAN PRESENTE LA FORMULE QU'ON A CHOISIE (lot 11). Il presentait
  //   Essentielle quoi qu'on ait demande : « Voir Ultime » ouvrait un ecran
  //   ou Ultime n'etait pas ecrit une seule fois.
  const c=subOffreChoisie();
  return (c==='ultime')?subPaliersDe('ultime'):SUB_PALIERS;
}
// `prix` est un NOMBRE dans COACH_PALIERS et une CHAÎNE dans SUB_PALIERS.
// L’écran les affiche tels quels : on normalise ici plutôt que dans chaque
// gabarit, sinon « 19 » s’afficherait sans son euro.
function _prixPalier(p){
  if(!p) return '';
  return typeof p.prix==='number'?(p.prix+' €'):String(p.prix||'');
}
function _paliersDispo(){return _tablePaliers().filter(p=>!!p.planId());}

// ══════ BASCULE DU PAYEUR — LE COACH PAIE, L'ATHLÈTE RATTACHÉ NON ══════
// Ce bloc n'installe QUE la mécanique de comptage et de palier. Il ne touche
// à aucun écran, ne modifie ni checkAccess ni le rattachement, et n'écrit
// rien dans aucun dossier. Tant que l'étape suivante n'est pas passée, un
// athlète continue exactement comme avant.
//
// PAS DE VALEUR PAR DÉFAUT ÉCRITE DANS LES DOSSIERS. Les quatre champs
// n'apparaissent que le jour où un coach choisit un palier. Un dossier qui
// n'a jamais rien choisi ne porte aucune des quatre clés et se lit « libre,
// inactif » par les accesseurs ci-dessous — même patron que `methode` sur
// une série normale. Retro-écrire un défaut coûterait un PUT du document
// entier par coach pour n'apprendre à personne ce que l'absence dit déjà.
const COACH_PLANS=Object.freeze(['libre','coach','pro']);
// Même forme que SUB_PALIERS, y compris `planId()` : _paliersDispo s'applique
// tel quel, et une carte dont le plan PayPal n'existe pas encore ne s'affiche
// pas du tout plutôt que d'échouer au moment de payer.
//
// TROIS paliers. Il n'y en a pas de quatrième, et `libre` n'est pas une offre
// de lancement : c'est le palier permanent de qui suit une seule personne.
// Son quota est une limitation technique, JAMAIS annoncée comme un avantage —
// une gratuité promise publiquement devient contractuelle et ne se reprend pas.
const PAYPAL_PLAN_ID_COACH='P-9JD300001T4718058NK2RF5Q';   // à créer sur developer.paypal.com — 19 EUR/mois
const PAYPAL_PLAN_ID_PRO='P-1WS20264K4576284KNK2RF5Y';     // idem — 39 EUR/mois
const COACH_PALIERS=Object.freeze([
  Object.freeze({cle:'libre', titre:'Libre', prix:TARIFS.coach.libre, quota:1,
   periode:'', detail:'Un athlète suivi, sans carte bancaire et sans durée.',
   planId:()=>''}),
  Object.freeze({cle:'coach', titre:'Coach', prix:TARIFS.coach.coach, quota:15,
   periode:'par mois', detail:'Jusqu\'à quinze athlètes actifs.',
   planId:()=>PAYPAL_PLAN_ID_COACH}),
  Object.freeze({cle:'pro', titre:'Pro', prix:TARIFS.coach.pro, quota:Infinity,
   periode:'par mois', detail:'Sans limite de nombre.',
   planId:()=>PAYPAL_PLAN_ID_PRO}),
]);
// Infinity NE DOIT JAMAIS partir dans un dossier : JSON.stringify le rend
// `null`, et un quota null se relirait comme zéro. Il ne vit que dans cette
// constante, jamais dans un champ persisté — un test le vérifie.

// Fenêtre d'activité. 60 jours : un athlète qui n'a pas posé une séance
// depuis deux mois ne coûte rien à suivre, et le facturer serait facturer
// du vide. Le seuil est UN, pas zéro : ouvrir l'application ne suffit pas,
// il faut avoir travaillé.
const COACH_ACTIF_JOURS=60;
const COACH_ACTIF_SEANCES_MIN=1;

// PURE. Rend 'libre' pour tout dossier qui n'a rien choisi, et pour toute
// valeur inconnue : un palier inventé ne doit jamais valoir plus qu'aucun.
// ⚠ LE REGISTRE DES COACHS D'ABORD (30/09/2026) : pour le compte connecte,
//   coachs_registre/<cle> (ecrit par le Worker) decide ; coachPlan, gele par
//   les regles, n'est plus qu'un miroir. Pour un autre dossier — ou tant que
//   le registre n'a jamais ete lu — le dossier, comme avant.
function coachPlanDe(coach){
  let r={etat:'inconnu'};
  try{ r=registreCoachDe(coach); }catch(e){}
  if(r.etat==='serveur'){
    const expire=r.plan!=='libre'&&r.actifJusqu>0&&Date.now()>=r.actifJusqu;
    return (!expire&&COACH_PLANS.indexOf(r.plan)>=0)?r.plan:'libre';
  }
  if(r.etat==='absent'&&droitsV2Actif()) return 'libre';
  const v=(coach||{}).coachPlan;
  return COACH_PLANS.indexOf(v)>=0?v:'libre';
}
// PURE. Le quota du palier, jamais celui du dossier : un dossier ne porte
// pas son propre plafond, sinon il suffirait de l'éditer pour l'augmenter.
function getCoachQuota(plan){
  const p=COACH_PALIERS.find(x=>x.cle===plan);
  return p?p.quota:1;   // palier inconnu → le plus restrictif
}
// PURE. L'abonnement coach est-il actif ? Le palier `libre` est actif SANS
// abonnement : c'est tout son objet. Pour les deux autres, il faut le
// drapeau, et c'est un drapeau D'INTERFACE, pas de sécurité — il vit dans
// users/<clé>, où l'athlète comme le coach ont le droit d'écriture et où
// aucun .validate ne s'applique. Le dire ici plutôt que de laisser croire
// à une garantie serveur qui n'existe pas.
function coachSubActif(coach){
  if(!coach) return false;
  if(coachPlanDe(coach)==='libre') return true;
  let r={etat:'inconnu'};
  try{ r=registreCoachDe(coach); }catch(e){}
  // Le registre dit un plan payant en cours (coachPlanDe a deja ecarte l'expire).
  if(r.etat==='serveur') return true;
  return !!coach.coachSubActive;
}
// Compte les athlètes ACTIFS d'un coach.
//
// LECTURE DU CACHE LOCAL, ET C'EST UNE LIMITE RÉELLE : `users` ne contient
// que ce que syncRelevantUsers a rapatrié. Sur un appareil neuf, le compte
// vaut 0 tant que la synchronisation n'a pas tourné. Tout affichage bâti
// là-dessus doit savoir dire « en cours » plutôt qu'un chiffre faux — d'où
// le second membre du couple, `countActiveAthletesFiable`.
//
// `users` est injectable pour que la suite puisse l'éprouver sans toucher
// au stockage réel.
function countActiveAthletes(coach,users){
  const id=(coach||{}).id;
  if(!id) return 0;
  const tous=users||DB.get('users')||{};
  const limite=Date.now()-COACH_ACTIF_JOURS*86400000;
  let n=0;
  for(const u of Object.values(tous)){
    if(!u||u.role==='coach') continue;
    if(u.coachId!==id) continue;
    // Une séance SUFFISAMMENT RÉCENTE. On compte, on ne se contente pas de
    // regarder la dernière : un tableau non trié ne se lit pas par la fin.
    let vues=0;
    for(const sess of (u.sessions||[])){
      if(sess&&sess.date>=limite&&++vues>=COACH_ACTIF_SEANCES_MIN) break;
    }
    if(vues>=COACH_ACTIF_SEANCES_MIN) n++;
  }
  return n;
}
// Le compte est-il digne d'être affiché ? Faux tant qu'aucun dossier
// d'athlète n'est en cache alors que le coach en déclare : afficher « 0 / 15 »
// à un coach qui suit douze personnes serait pire que ne rien afficher.
function countActiveAthletesFiable(coach,users){
  const id=(coach||{}).id;
  if(!id) return false;
  const tous=users||DB.get('users')||{};
  return Object.values(tous).some(u=>u&&u.role!=='coach'&&u.coachId===id);
}
// PURE. Le palier qui convient au nombre d'athlètes donné. Sert à nommer le
// palier SUIVANT dans un bandeau ; il ne décide rien et ne bloque rien.
// ── Suivi de palier : ce que le coach a déjà vu, et depuis quand ─────────
// user.paliers = { dernierAvertissement: ISO|null, cyclesAuDessus: number }
//
// L'HORODATAGE EST EN ISO, contrairement au reste du dossier qui compte en
// millisecondes. C'est délibéré : ce champ se lit à l'œil dans la console
// Firebase quand un coach conteste une alerte, et onze octets de plus sur
// UN champ ne pèsent rien face à ça.
//
// UN CYCLE = UN MOIS CALENDAIRE, un incrément au plus. Le cahier des charges
// dit « 2 cycles consécutifs » sans définir le cycle ; compter par ouverture
// d'application ferait franchir le seuil en deux clics, compter en jours
// glissants ferait dépendre la facturation de l'heure d'ouverture.
const PALIERS_CYCLES_MAX=24;   // deux ans : au-delà, le compteur ne dit plus rien
// PURE. Rend l'état, avec ses défauts, SANS écrire. Un dossier qui n'a
// jamais dépassé ne porte pas la clé — même doctrine qu'au lot F-19.
function paliersDe(user){
  const u=_dossier(user);
  const p=(u&&u.paliers)||{};
  const n=p.cyclesAuDessus;
  return {
    dernierAvertissement:(typeof p.dernierAvertissement==='string')?p.dernierAvertissement:null,
    cyclesAuDessus:(typeof n==='number'&&isFinite(n)&&n>=0)?Math.min(n,PALIERS_CYCLES_MAX):0
  };
}
// PURE. La clé de cycle d'une date : « 2026-08 ». C'est elle qui garantit
// « un incrément au plus par mois ».
function _cyclePalier(d){
  const x=(d instanceof Date)?d:new Date(d||Date.now());
  return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');
}
// Écrit l'état. Rend l'objet écrit. N'enregistre pas : l'appelant le fait,
// comme partout ailleurs — mélanger décision et persistance rend la
// première inéprouvable.
function _ecrirePaliers(user,champs){
  const u=_dossier(user);
  if(!u) return null;
  const cur=paliersDe(u);
  const suiv=Object.assign({},cur,champs||{});
  suiv.cyclesAuDessus=Math.max(0,Math.min(PALIERS_CYCLES_MAX,
    Math.round(Number(suiv.cyclesAuDessus)||0)));
  u.paliers=suiv;
  return suiv;
}

function coachPalierRequis(n){
  const p=COACH_PALIERS.find(x=>n<=x.quota);
  return p?p.cle:'pro';
}
// PURE. Le quota est-il dépassé ? Le dépassement ALERTE, il ne bloque
// jamais un rattachement : refuser un athlète parce qu'un paiement n'a pas
// suivi punirait l'athlète pour une affaire entre le coach et nous.
function coachQuotaDepasse(coach,users){
  return countActiveAthletes(coach,users)>getCoachQuota(coachPlanDe(coach));
}
// ══ LE QUOTA APPLIQUÉ (02/10/2026) : L'OPTION B ══════════════════════════
// Le coach paie, l'athlète rattaché est gratuit — dans la limite de sa
// formule. Les places vont aux athlètes ACTIFS dans l'ordre de RATTACHEMENT
// (rattacheLe, posé par linkToCoach et à la consommation d'un code ; repli sur
// l'ordre de coach.clients, puis l'identifiant). Un athlète inactif ne prend
// pas de place et reste couvert. Après TROIS mois d'affilée au-dessus du quota
// (la grâce : PALIERS_CYCLES_AVANT_PROPOSITION + 1), les athlètes hors quota
// perdent le « suivi » gratuit — sauf essai en cours ou abonnement personnel.
//
// ⚠ CE QUI COUPE VRAIMENT est écrit par le serveur léger dans droits/<athlète>/
//   couvertParCoach (metier.js couvertureCoach, même règle, quota-coach.js) :
//   le coach ne peut pas écrire droits/, et l'athlète ne lit pas le dossier
//   de son coach. Cette fonction-ci sert l'écran du coach et les tests ; elle
//   ne ferme rien.
const QUOTA_CYCLES_GRACE=3;   // = PALIERS_CYCLES_AVANT_PROPOSITION (2) + 1, figé ici : 001 se lit avant 002
// Les mois d'affilée au-dessus du quota : ceux du serveur s'il les a dits
// (coachs_registre/<coach>/quota, lu avec le registre), sinon le compteur de
// l'app (paliersDe).
function quotaCyclesDe(coach){
  let r={etat:'inconnu'};
  try{ r=registreCoachDe(coach); }catch(e){}
  if(r.etat==='serveur'&&r.quota&&typeof r.quota.cycles==='number') return Math.max(0,r.quota.cycles);
  return paliersDe(coach).cyclesAuDessus;
}
function coachEnGraceQuota(coach){ return quotaCyclesDe(coach)<QUOTA_CYCLES_GRACE; }
// Les athlètes actifs du coach, dans l'ordre où ils prennent les places.
function _athletesActifsOrdonnes(coach,users){
  const id=(coach||{}).id;
  const tous=users||DB.get('users')||{};
  const limite=Date.now()-COACH_ACTIF_JOURS*86400000;
  const clients=Array.isArray(coach&&coach.clients)?coach.clients:[];
  const rang=u=>{ const i=clients.indexOf(u.id); return i<0?Infinity:i; };
  return Object.values(tous).filter(u=>{
    if(!u||u.role==='coach'||u.coachId!==id) return false;
    let vues=0;
    for(const s of (u.sessions||[])) if(s&&s.date>=limite&&++vues>=COACH_ACTIF_SEANCES_MIN) break;
    return vues>=COACH_ACTIF_SEANCES_MIN;
  }).sort((a,b)=>{
    const la=Number(a.rattacheLe)>0?Number(a.rattacheLe):Infinity, lb=Number(b.rattacheLe)>0?Number(b.rattacheLe):Infinity;
    if(la!==lb) return la-lb;
    const ra=rang(a), rb=rang(b);
    if(ra!==rb) return ra-rb;
    return String(a.id)<String(b.id)?-1:1;
  });
}
/**
 * PURE (le cache est passé). L'athlète occupe-t-il une place couverte par le
 * quota de son coach ? Toujours vrai pour le créateur, une formule sans
 * limite, un cache qu'on ne sait pas compter (appareil neuf : on ne coupe
 * jamais sur un silence), pendant la grâce, et pour un athlète inactif.
 */
function athleteCouvertParCoach(athlete,coach,users){
  if(!athlete||!coach) return true;
  if(String(coach.email||'').toLowerCase()===String(CREATOR_EMAIL).toLowerCase()) return true;
  if(!countActiveAthletesFiable(coach,users)) return true;
  const quota=getCoachQuota(coachPlanDe(coach));
  if(quota===Infinity) return true;
  const actifs=_athletesActifsOrdonnes(coach,users);
  if(actifs.length<=quota||coachEnGraceQuota(coach)) return true;
  const i=actifs.findIndex(u=>(athlete.id&&u.id===athlete.id)||(athlete.email&&u.email===athlete.email));
  return i<0||i<quota;
}
// Les athlètes hors quota, aujourd'hui ou à la fin de la grâce (écran du coach).
function athletesHorsQuota(coach,users){
  if(!coach||String(coach.email||'').toLowerCase()===String(CREATOR_EMAIL).toLowerCase()) return [];
  if(!countActiveAthletesFiable(coach,users)) return [];
  const quota=getCoachQuota(coachPlanDe(coach));
  if(quota===Infinity) return [];
  return _athletesActifsOrdonnes(coach,users).slice(quota);
}
// PURE. Le jour où les athlètes hors quota perdent le suivi : le 1er du mois où
// le compteur atteint la grâce (le serveur compte au premier passage du mois).
// `mois` : 'AAAA-MM' du dernier mois compté. Passé ou à venir. Rend un Date, ou null.
function quotaDateCoupure(cycles,mois){
  const c=Math.max(0,Number(cycles)||0);
  const m=/^(\d{4})-(\d{2})$/.exec(String(mois||''));
  if(!m) return null;
  return new Date(Number(m[1]),Number(m[2])-1+(QUOTA_CYCLES_GRACE-c),1);
}
// L'état de la grâce, tel que l'app le connaît : {cycles, mois}.
function quotaEtatDe(coach){
  let r={etat:'inconnu'};
  try{ r=registreCoachDe(coach); }catch(e){}
  if(r.etat==='serveur'&&r.quota&&typeof r.quota.cycles==='number') return {cycles:r.quota.cycles,mois:String(r.quota.mois||'')};
  const p=paliersDe(coach);
  return {cycles:p.cyclesAuDessus,mois:p.dernierAvertissement?_cyclePalier(new Date(p.dernierAvertissement)):''};
}

// ── Plafond de comptes Libres ────────────────────────────────────────────
// 200 comptes gratuits, c'est ce que le plan Spark peut porter sans que le
// service se dégrade pour ceux qui l'utilisent déjà.
//
// POURQUOI UN NŒUD DÉDIÉ, ET PAS LA SONDE F-07 : etatQuota compte les octets
// de CE navigateur dans localStorage. Elle ne sait rien du nombre de comptes
// existants, et ne peut pas le savoir. Le nœud metrics, lui, compte PAR JOUR,
// exige auth != null en lecture — or on décide AVANT que le visiteur ait un
// compte — mêle athlètes et coachs, et surtout accepte l'écriture SANS
// authentification : un plafond fondé dessus se ferait pousser à dix millions
// par n'importe qui, et fermerait l'inscription à tout le monde.
//
// Ce compteur-ci est lisible sans jeton (le visiteur n'en a pas encore) et
// ne peut qu'être incrémenté de un, par la règle RTDB. Il ne dit RIEN de
// personne : c'est un entier.
// LA phrase, écrite une fois. Elle promet un CLIENT, jamais une durée : un
// compte Libre ne se referme pas, et « essai de N jours » dirait exactement
// le contraire. Elle ne promet pas non plus la gratuité AU-DELÀ du premier —
// une limitation technique annoncée comme un avantage devient une promesse
// contractuelle dont on ne revient pas.
const PROMESSE_COACH='Gratuit pour votre premier client, sans limite de durée, '
  +'sans carte bancaire.';
