// ══════ IMPORT PDF / OCR — DÉPRÉCIÉ ══════
// Le coach construisait ses séances hors de l'application, les importait en
// PDF ou en photo, et une reconnaissance de texte en extrayait les exercices.
// Ce chemin est fermé : il perdait de l'information, se trompait de lecture,
// et la banque d'exercices le rend inutile.
//
// DÉSACTIVÉ, PAS SUPPRIMÉ. Le code d'extraction reste entier derrière ce
// drapeau. Le remettre à true rouvre le parcours exactement comme avant —
// c'est la seule façon honnête de couper une fonctionnalité dont on ne peut
// pas prouver que plus personne ne s'en sert.
//
// CE QUI N'EST PAS COUPÉ, et qu'il ne faut pas couper :
//   • les téléversements de photo de séance : cette photo est AUSSI la
//     vignette affichée dans le sélecteur de séances de l'athlète. Retirer
//     l'upload retirerait la vignette ;
//   • le collage MANUEL de liens YouTube — ce n'est pas de l'extraction ;
//   • la fiche programme PDF, les vidéos d'exécution, les photos de bilan,
//     la photo du coach : quatre chemins de fichier qui n'ont jamais eu de
//     rapport avec l'import de séance.
//
// Les SÉANCES DÉJÀ IMPORTÉES restent lisibles et exécutables. On coupe une
// entrée, on ne détruit rien.
const LEGACY_PDF_IMPORT=false;
// Garde unique. Toutes les fonctions d'extraction passent par elle : une
// garde par fonction finirait par en oublier une.
function _importLegacyOuvert(){ return LEGACY_PDF_IMPORT===true; }
function _refusImportLegacy(){
  toast('L\'import de séance par PDF ou photo a été remplacé par la banque '
    +'d\'exercices.','var(--orange)');
  return false;
}
// Masque les commandes d'extraction. Appelée par les écrans qui les portent ;
// elle ne touche à rien d'autre, et surtout pas aux zones de téléversement.
function _appliquerDeprecationImport(){
  if(_importLegacyOuvert()) return false;
  for(const id of ['prog-analyze-btn','prog-photo2-photo','prog-photo2-pdf']){
    const e=document.getElementById(id);
    if(e) e.style.setProperty('display','none','important');
  }
  return true;
}

// ══════ BANQUE D'EXERCICES ══════
// 406 fiches : illustration, guide d'exécution, repos, liens vidéo. Elles
// viennent du guide du coach, extraites par scripts/seed_exercices.py.
//
// DEUX MOITIÉS, DEUX ENDROITS, ET C'EST DÉLIBÉRÉ :
//
//   • Les ILLUSTRATIONS sont des fichiers statiques de app/exercices/,
//     servis publiquement. C'est ce qui permet à un athlète de voir l'image
//     des exercices que son coach lui a prescrits SANS qu'on lui ouvre le
//     catalogue. Il n'y a pas de serveur ici : sans ce choix, il faudrait
//     une couche d'hydratation qui n'existe pas.
//
//   • Les MÉTADONNÉES vivent dans le nœud RTDB /exercices, en lecture
//     réservée aux coachs par database.rules.json. C'est le seul contrôle
//     d'accès RÉEL dont ce projet dispose. Un athlète qui appelle cette URL
//     reçoit 401, et ce n'est pas une question de bouton masqué.
//
// LE GUIDE D'EXÉCUTION VU PAR L'ATHLÈTE ne vient donc PAS de la banque : il
// est recopié dans sessions_config[].exercises[].description au moment où le
// coach prescrit — ce que l'application fait déjà depuis toujours. La
// conséquence, qu'il faut connaître : corriger une description dans la banque
// ne met pas à jour les séances déjà écrites. Sans serveur, c'est le prix.
const EXO_IMG_DOSSIER='exercices/';
// ⚠ UNE SEULE TAILLE, PARCE QU'IL N'EN A JAMAIS EXISTE DEUX. Ce bloc décrivait
// un schéma à deux dossiers posé le 07/09/2026 — une FICHE de 900 px et une
// VIGNETTE de 256 px sous le même slug — et annonçait que « une image existe
// pour les deux tailles ou pour aucune ». C'était faux : `exercices/vignettes/`
// n'a jamais été créé, et le seeding qui devait le remplir n'a jamais tourné.
// Chaque ligne de liste demandait donc un fichier absent et prenait un 404
// avant de se rabattre sur la fiche. Vérifié le 15/09/2026, dossier absent du
// dépôt comme du disque.
//
// ET LE CALCUL QUI LE JUSTIFIAIT ÉTAIT FAUX AUSSI. Les 436 fiches pèsent
// 3,3 Mo au total — médiane 7 Ko, largeur médiane 248 px — et non les 900 px
// et 10 Mo invoqués ici. Une vignette économiserait deux ou trois kilo-octets
// sur sept, contre 1,5 Mo ajoutés au dépôt. C'est exactement ce que dit
// _htmlVignetteExo depuis le premier lot, mesures à l'appui.
//
// La constante et ses deux fonctions — EXO_VIGNETTE_DOSSIER, _vignetteParSlug,
// vignetteDe — ont été retirées plutôt que laissées en place : une fonction
// qui rend l'URL d'un fichier inexistant n'attend qu'un appelant.
const EXO_INDEX_URL=EXO_IMG_DOSSIER+'index.json';
const BANQUE_CLE='rc_banque_exos';
// Une semaine : la banque ne bouge qu'à un nouveau seeding, et 256 Ko relus
// à chaque ouverture pèseraient sur un quota de 10 Go partagé par tout le
// monde. Le coach peut forcer la relecture.
const BANQUE_TTL_MS=7*24*3600*1000;

// Slug : la MÊME normalisation que exKey, plus les espaces en tirets. C'est
// le seul lien entre un nom d'exercice et son illustration ; toute divergence
// avec le script de seeding casserait 406 images d'un coup. Un test l'éprouve
// sur des cas réels.
function exSlug(nom){ const k=exKey(nom); return k?k.toLowerCase().replace(/ /g,'-'):''; }

// Index PUBLIC des illustrations disponibles. Il ne divulgue rien — les 460
// noms sont en clair dans ce fichier depuis toujours — et il évite 460
// requêtes 404 sur les exercices sans image.
//
// C'EST UNE Map slug → [largeur, hauteur], et non plus un Set. Les dimensions
// servent à la modale de fiche : le ratio varie d'une image à l'autre, le
// figer dans le CSS ferait sauter la mise en page à chaque ouverture. Une
// Map répond à .has() et .size exactement comme un Set — tous les appels
// existants continuent de fonctionner, y compris les tests qui posent un Set
// à la main.
//
// La valeur peut être `null` : « image présente, taille inconnue ». C'est le
// cas des exercices renommés, dont le .webp reste sur le disque sans que le
// seeding le reproduise. L'image s'affiche alors sans width/height.
let _exoIndex=null, _exoIndexEnCours=null;
// PURE. Accepte les DEUX formats d'index.
//
// ⚠ LE REPLI SUR LE FORMAT 1 N'EST PAS DE LA POLITESSE. Le service worker
// sert index.json depuis son cache : un athlète qui n'a pas encore basculé
// sur la v1140 reçoit l'ANCIENNE liste plate de slugs. La refuser lui ferait
// perdre TOUTES ses illustrations d'un coup, pendant que son app se met à
// jour. Il rend alors des dimensions nulles, ce qui est exactement l'état
// « je sais que l'image existe, je ne sais pas sa taille ».
//
// RETRAIT DU REPLI : après le 07/10/2026. Un mois couvre le pire cas — un
// athlète qui n'ouvre l'app qu'une fois par mois — et la v1140 purge de
// toute façon /exercices/ à son activation.
function _lireIndexIllustrations(brut){
  const m=new Map();
  if(Array.isArray(brut)){
    for(const sl of brut) if(typeof sl==='string'&&sl) m.set(sl,null);
    return m;
  }
  const f=brut&&brut.fiches;
  if(f&&typeof f==='object'){
    for(const sl in f){
      const d=f[sl];
      // Une dimension nulle, négative ou mal formée vaut « taille inconnue » :
      // poser width="0" ferait disparaître l'image.
      m.set(sl,(Array.isArray(d)&&d.length===2&&d[0]>0&&d[1]>0)
        ?[d[0]|0,d[1]|0]:null);
    }
  }
  return m;
}
// ⚠ UN ECHEC NE SE MEMORISE PAS. La version d'avant posait `_exoIndex` a une
// Map VIDE des que le reseau echouait — et comme la premiere ligne rend
// `_exoIndex` des qu'il est truthy, une Map vide en est une, cet echec devenait
// DEFINITIF pour toute la duree de la page. Un seul creux de reseau au
// demarrage — un metro, un ascenseur, un service worker qui n'a pas encore la
// reponse — et l'athlete n'avait plus AUCUNE illustration nulle part, jusqu'a
// ce qu'il recharge : ni dans sa seance, ni dans le guide, ni dans la banque.
// Rien ne le lui disait, et rien ne retentait.
//
// On rend donc une Map vide POUR CET APPEL-LA — l'appelant continue sans
// image, comme avant — mais `_exoIndex` reste null et le prochain rendu
// retente. L'affichage se repare tout seul des que le reseau revient.
async function chargerIndexIllustrations(){
  if(_exoIndex) return _exoIndex;
  if(_exoIndexEnCours) return _exoIndexEnCours;
  _exoIndexEnCours=(async()=>{
    try{
      const r=await fetch(EXO_INDEX_URL);
      if(!r.ok) throw new Error(r.status);
      _exoIndex=_lireIndexIllustrations(await r.json());
    }catch(e){
      _exoIndexEnCours=null;
      return new Map();                  // pas d'index CETTE FOIS : on retentera
    }
    _exoIndexEnCours=null;
    return _exoIndex;
  })();
  return _exoIndexEnCours;
}
// PURE. Rend le chemin de l'illustration, ou null. Null tant que l'index
// n'est pas chargé : jamais une URL qui produirait une image cassée.
function illustrationDe(nom){
  const sl=exSlug(nom);
  return _illustrationParSlug(sl);
}
// PURE. LE SLUG QUI A REELLEMENT UNE IMAGE, ou null. Ecrit UNE fois et
// partage par la fiche et la vignette : les deux tailles vivent dans le meme
// index, sous le meme nom, et si ces deux resolutions divergeaient une ligne
// de liste montrerait la photo d'un autre exercice que sa fiche.
// Null tant que l'index n'est pas charge : jamais une URL qui produirait une
// image cassee.
// LES MOTS QUI CHANGENT D'EXERCICE, PAS SEULEMENT D'EXECUTION.
//
// Ils nomment l'agres ou le trajet de la charge : retirer l'un d'eux d'un nom
// ne laisse pas « le meme mouvement en moins precis », il laisse un AUTRE
// mouvement. « Curl barre poulie » sans « poulie » est un curl barre libre ;
// « developpe couche haltere » sans « haltere » est un developpe a la barre.
//
// NE PAS Y METTRE LES PRECISIONS D'EXECUTION — prise, large, serre, pieds,
// haut, bas, incline, decline, neutre, unilateral, assis, debout : ce sont
// elles que la regle de prefixe est faite pour retirer, et les interdire la
// viderait de son objet.
const EX_MOTS_AGRES=new Set(['poulie','poulies','machine','guidee','guide',
  'haltere','halteres','barre','smith','kettlebell','elastique','elastiques',
  'trx','sangle','sangles','disque','disques','sac','corde','pupitre','banc',
  'gym80','presse','chaise','cadre','roulette','ballon','swiss','bulgare',
  'landmine','hack','pendlay','sol','tapis','velo','rameur','ergo']);
function _slugIllustre(sl){
  if(!sl||!_exoIndex) return null;
  if(_exoIndex.has(sl)) return sl;
  // LE SLUG NE RÉPOND PAS : la fiche porte peut-être encore le nom d'avant un
  // renommage du guide. L'index des illustrations, lui, est écrit avec les
  // NOUVEAUX slugs. On retente donc une fois avec le nom d'aujourd'hui, ce qui
  // évite de réécrire les programmes déjà publiés pour qu'ils gardent leur
  // photo. Seule EX_RENOMMAGES est consultée : cette fonction reste PURE.
  // String() et non sl : l'entree n'est pas garantie textuelle — un appelant
  // qui passe un nombre ferait lever .replace, et cette fonction est appelee
  // pour CHAQUE exercice de CHAQUE carte.
  const k=String(sl).replace(/-/g,' ').toUpperCase();
  const r=exSlug(_cleRenommee(k));
  if(r&&r!==sl&&_exoIndex.has(r)) return r;
  // ── ET LA VARIANTE PREND L'IMAGE DE SA BASE ──────────────────────────
  // Le guide ne fournit qu'UNE illustration par ligne, et les 29 variantes
  // d'execution viennent toutes d'une ligne unique. Elles pointent donc sur
  // l'image de leur base tant que le coach n'en fournit pas d'autre.
  // ⚠ LE FICHIER N'EST PAS DUPLIQUE, et c'est le point : 29 copies du meme
  // octet dans un depot public, c'est du poids pour rien. C'est la
  // RESOLUTION qui redirige, pas le disque. Le jour ou une variante recoit sa
  // propre photo, le fichier apparait sous son slug et cette branche ne joue
  // plus pour elle — sans qu'on touche a quoi que ce soit ici.
  const v=EX_VARIANTES[k];
  if(v&&v.base){
    const b=exSlug(v.base);
    if(b&&b!==sl&&_exoIndex.has(b)) return b;
  }
  // ── ET « X + PRECISION » PREND L'IMAGE DE X ───────────────────
  //
  // ⚠ CINQUANTE EXERCICES DU GUIDE ONT UNE VIDEO ET DES CONSIGNES, ET
  // AUCUNE IMAGE — mesure du 14/09/2026. Ce sont presque tous des
  // declinaisons : « CURL BARRE PRISE LARGE » quand le guide illustre
  // « CURL BARRE », « PRESSE A CUISSE INCLINE PIEDS EN HAUT » quand il
  // illustre « PRESSE A CUISSE INCLINE ». La fiche montrait donc une video
  // et un texte, et un cadre vide a la place du dessin.
  //
  // EX_VARIANTES faisait deja exactement cela, mais a la main, pour vingt-neuf
  // noms ecrits un par un. Ici on le derive du nom : on retire le dernier mot
  // tant qu'il en reste au moins deux, et le PLUS LONG prefixe illustre gagne
  // — le plus long, parce que « TIRAGE HORIZONTAL MACHINE UNILATERAL NEUTRE »
  // doit prendre l'unilateral s'il existe, et la machine sinon.
  //
  // DEUX MOTS AU MINIMUM, jamais un seul : « CURL » ou « SQUAT » tout court
  // rattacherait des mouvements qui n'ont rien a voir. Le prefixe retenu est
  // le meme mouvement avec une precision d'execution en moins ; c'est la seule
  // chose que cette regle affirme, et elle ne va pas plus loin.
  // 37 des 50 retrouvent ainsi leur dessin ; les 13 autres n'ont pas de base
  // illustree dans le guide, et gardent leur cadre — on n'invente rien.
  //
  // ⚠ LA REGLE S'ARRETE DES QU'ON RETIRE LE MATERIEL. Signale par Kevin le
  // 15/09/2026 : « CURL BARRE POULIE » affichait l'image de « CURL BARRE »,
  // c'est-a-dire une barre libre a la place d'une poulie. Ce n'est pas le meme
  // exercice — ni le meme trajet de charge, ni la meme tension au long du
  // mouvement — et l'athlete voyait un dessin qui contredisait sa consigne.
  //
  // CE QUE LA REGLE AFFIRMAIT ETAIT TROP LARGE. « Le prefixe est le meme
  // mouvement avec une precision d'execution en moins » est vrai pour « PRISE
  // LARGE » ou « PIEDS EN HAUT » ; c'est FAUX des que le mot retire nomme
  // l'AGRES. Montrer une image approchante vaut mieux que pas d'image ; montrer
  // l'image d'un AUTRE exercice ne vaut pas mieux que rien, ca vaut moins.
  //
  // On s'arrete donc net — et non « on essaie plus court » : tout prefixe plus
  // court retire le meme mot, plus d'autres.
  const mots=String(sl).split('-').filter(Boolean);
  for(let c=mots.length-1;c>=2;c--){
    if(mots.slice(c).some(m=>EX_MOTS_AGRES.has(m))) break;
    const pref=mots.slice(0,c).join('-');
    if(_exoIndex.has(pref)) return pref;
  }
  return null;
}
// PURE. L'illustration PLEINE RESOLUTION d'un slug deja calcule — 900 px, la
// taille de la fiche.
function _illustrationParSlug(sl){
  const s=_slugIllustre(sl);
  return s?EXO_IMG_DOSSIER+s+'.webp':null;
}
// PURE. [largeur, hauteur] de la FICHE, ou null quand l'index ne les porte
// pas — ancien format, ou exercice renommé dont le fichier survit sans que le
// seeding le reproduise. Sert à réserver la place de l'image dans la modale.
function _dimsParSlug(sl){
  const s=_slugIllustre(sl);
  const d=s&&_exoIndex&&_exoIndex.get?_exoIndex.get(s):null;
  return (d&&d.length===2)?d:null;
}
// L'illustration d'un EXERCICE, slug d'abord. Un exercice mis a jour depuis la
// bibliotheque garde le nom que le coach lui a donne — c'est ce qui preserve
// son historique de charge — et porte le slug de la fiche du guide. Sans cette
// lecture, il resterait sans photo.
function illustrationExo(ex){
  if(!ex||typeof ex!=='object') return null;
  const parSlug=_illustrationParSlug(String(ex.exSlug||'').trim());
  return parSlug||illustrationDe(ex.name);
}

// ── Accès à la banque : les coachs, et Ultime ────────────────────────────
// Garde D'INTERFACE. La vraie barrière est dans database.rules.json, et elle
// tient même si celle-ci saute.
//
// ⚠ ULTIME Y ENTRE DEPUIS LE LOT 3. Le catalogue n'est plus l'outil du seul
//   coach : c'est une des deux choses qu'Ultime achète. La CAPACITE décide
//   donc, plus le rôle seul, et la formule Essentielle continue d'écrire ses
//   noms d'exercices à la main — ce comportement-là existait déjà, il ne
//   change pas d'un iota.
// ⚠ LA REGLE DE LA BASE SUIT DANS LE MEME LOT : /exercices ne se lisait
//   qu'avec un compte coach. Elle s'ouvre au palier « ultime », que le serveur
//   écrit dans droits/. TANT QU'ELLE N'EST PAS PUBLIEE, un athlète Ultime voit
//   un catalogue VIDE et non une erreur : chargerBanque garde ce qu'il a.
function peutConsulterBanque(user){
  // undefined → l'utilisateur courant. null → PERSONNE. Les deux ne disent
  // pas la même chose, et les confondre ferait répondre « oui » à une
  // question posée sur aucun dossier.
  const u=(user===undefined)?currentUser:user;
  if(!u) return false;
  if(u.role==='coach') return true;
  try{ return !!peut(u,'bibliothequeExercices'); }catch(e){ return false; }
}
let _banque=null;
function _banqueUrl(){ return CLOUD._fbUrl.replace('/users.json','/exercices.json'); }
// Rend le tableau des fiches, ou [] tant que rien n'est chargé. Ne charge
// rien de lui-même : le chargement est explicite, et réservé aux coachs.
function fichesBanque(){ return _banque?_banque.liste:[]; }
function banqueEstChargee(){ return !!_banque; }
// PURE. Retrouve une fiche par slug OU par nom, en passant par l'alias de
// l'utilisateur : un exercice renommé doit continuer de trouver sa fiche.
//
// ficheBanque et NON ficheExercice : ce dernier nom est déjà pris depuis
// FB-06 par la fiche de CONTRAINTES ARTICULAIRES (l. ~16930). Deux
// déclarations du même nom, et c'est la dernière du fichier qui gagne —
// silencieusement.
function ficheBanque(ref,user){
  if(!_banque||!ref) return null;
  const direct=_banque.parSlug[ref];
  if(direct) return direct;
  const k=_aliasPour(exKey(ref),user||currentUser);
  return _banque.parSlug[k.toLowerCase().replace(/ /g,'-')]||null;
}
// LES MUSCLES D'UNE FICHE SUIVENT LA TABLE DE L'APP (01/10/2026). La banque en
// ligne est une COPIE figée au jour de son remplissage : après la révision des
// signatures du 30/09, les dips y restaient « pectoraux d'abord » et les
// écartés gardaient le triceps. La recherche classait donc sur des muscles
// périmés. Quand le guide connaît le nom, c'est lui qui fait foi : principal
// en premier, secondaires ensuite. Une fiche inconnue du guide garde les siens.
function _musclesAJour(f){
  if(!f||!f.nom||f.perso) return f;
  let k=''; try{ k=exKey(f.nom); }catch(e){ return f; }
  if(!k) return f;
  try{
    const g=_exGuide().get(k);
    if(g) f.muscles=g.p.concat(g.s);
    const tag=_exGuideEstPosing(k)?'posing':(_exGuideEstCardio(k)?'cardio':'');
    if(tag){
      const t=Array.isArray(f.tags)?f.tags:[];
      if(t.indexOf(tag)<0) f.tags=t.concat([tag]);
    }
  }catch(e){}
  return f;
}
function _indexerBanque(liste){
  const parSlug={};
  for(const f of (liste||[])) if(f&&f.slug) parSlug[f.slug]=_musclesAJour(f);
  return {liste:(liste||[]),parSlug,at:Date.now()};
}
// Réseau d'abord, cache ensuite. Un coach hors ligne garde la banque qu'il
// avait ; un coach qui n'y a jamais accédé n'a rien, et l'écran le dira
// plutôt que de tourner dans le vide.
async function chargerBanque(force){
  if(!peutConsulterBanque()) return null;
  if(_banque&&!force) return _banque;
  if(!force){
    try{
      const brut=localStorage.getItem(BANQUE_CLE);
      if(brut){
        const d=JSON.parse(brut);
        if(d&&Array.isArray(d.exercices)&&(Date.now()-(d.at||0))<BANQUE_TTL_MS){
          _banque=_indexerBanque(d.exercices);
          return _banque;
        }
      }
    }catch(e){}
  }
  try{
    const tok=await CLOUD._getToken();
    if(!tok) return _banque;
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(_banqueUrl()+'?auth='+tok,{signal:ctrl.signal});
    // 401 : normal pour qui n'a pas le catalogue, et normal aussi pour un
    // athlète Ultime tant que la règle du lot 3 n'est pas publiée. On garde ce
    // qu'on a plutôt que de vider : un catalogue vide se voit, une erreur non.
    if(!r.ok) return _banque;
    const t=await r.text();
    try{ _quotaCompter('in',t.length); }catch(e){}
    const d=t?JSON.parse(t):null;
    const liste=(d&&Array.isArray(d.exercices))?d.exercices:null;
    if(!liste) return _banque;
    _banque=_indexerBanque(liste);
    try{ localStorage.setItem(BANQUE_CLE,JSON.stringify({at:Date.now(),exercices:liste})); }catch(e){}
  }catch(e){}
  return _banque;
}
// Vidage du cache local. Appelé à la déconnexion : le catalogue suit le
// compte qui y a droit, il n'a rien à faire dans le stockage de celui qui se
// connecterait ensuite sur le même appareil.
function oublierBanque(){
  _banque=null;
  try{ localStorage.removeItem(BANQUE_CLE); }catch(e){}
}

// ══════ ÉCRAN « BANQUE D'EXERCICES » ══════
// Le sélecteur rend un exercice à qui l'a ouvert. Il ne sait RIEN de ce
// qu'on en fera : c'est l'appelant qui décide, et c'est ce qui permettra au
// lot 3 de le brancher sur le constructeur de séance sans le rouvrir.
let _bqCb=null, _bqRetour='s-coach-home', _bqOnglet='banque', _bqFiltres={}, _bqTimer=null;
// 250 ms : en dessous, chaque frappe relance un tri sur 400 fiches ; au-delà,
// la liste traîne derrière le doigt.
const BQ_DEBOUNCE_MS=250;
// Au-delà, on n'affiche pas tout : 400 lignes d'un coup font ramer le rendu
// et personne ne fait défiler jusqu'en bas. On le DIT plutôt que de tronquer
// en silence.
const BQ_MAX_LIGNES=60;

// Les familles de filtres, dans l'ordre d'utilité réelle : on cherche
// d'abord par muscle, puis par ce qu'on a sous la main.
const BQ_FAMILLES=Object.freeze([
  {cle:'muscle',   lib:'Muscle',   valeurs:()=>Object.keys(MUSCLES),
   libelle:v=>(MUSCLES[v]||{}).lib||v},
  {cle:'materiel', lib:'Matériel', valeurs:()=>_bqValeurs('materiel'), libelle:v=>v},
  {cle:'schema',   lib:'Schéma',   valeurs:()=>_bqValeurs('schema'),
   libelle:v=>SCHEMA_LIB[v]||v},
  {cle:'niveau',   lib:'Niveau',   valeurs:()=>['debutant','intermediaire','avance'], libelle:v=>v},
]);
// Les valeurs RÉELLEMENT présentes dans le catalogue : proposer un filtre
// qui ne rend rien est pire que ne pas le proposer.
function _bqValeurs(champ){
  const v=new Set();
  for(const f of catalogueCoach()) if(f&&f[champ]) v.add(f[champ]);
  return [...v].sort();
}
async function ouvrirBanque(cb,retour){
  if(!peutConsulterBanque()){ toast('Réservé aux coachs.','var(--orange)'); return false; }
  _bqCb=(typeof cb==='function')?cb:null;
  _bqRetour=retour||(document.querySelector('.screen.active')||{}).id||'s-coach-home';
  _bqOnglet='banque'; _bqFiltres={}; _bqMusclesOuvert=false;
  const q=document.getElementById('bq-q'); if(q) q.value='';
  go('s-coach-banque');
  _bqRendre();                       // ce qu'on a déjà, tout de suite
  await chargerIndexIllustrations();
  await chargerBanque();
  _bqRendre();
  return true;
}
function fermerBanque(){ _bqCb=null; go(_bqRetour||'s-coach-home'); }
function bqOnglet(o){
  _bqOnglet=o;
  for(const [id,actif] of [['bq-tab-banque',o==='banque'],['bq-tab-perso',o==='perso']]){
    const b=document.getElementById(id); if(b) b.classList.toggle('active',actif);
  }
  _bqRendre();
}
function _bqSaisie(){ clearTimeout(_bqTimer); _bqTimer=setTimeout(_bqRendre,BQ_DEBOUNCE_MS); }
function _bqBasculerFiltre(cle,val){
  _bqFiltres[cle]=(_bqFiltres[cle]===val)?null:val;
  if(!_bqFiltres[cle]) delete _bqFiltres[cle];
  // Un muscle choisi (ou retiré) : la grille se replie sur lui, ou se rouvre entière.
  if(cle==='muscle') _bqMusclesOuvert=false;
  _bqRendre();
}
// Choisir un exercice : on le note en récent, on l'enregistre, et on rend la
// main à l'appelant. L'écran se ferme — c'est le geste le plus fréquent, il
// ne doit pas demander un second tap.
function bqChoisir(slug){
  const f=ficheBanque(slug)||catalogueCoach().find(x=>x.slug===slug);
  if(!f) return false;
  noterRecent(slug);
  try{ saveUser(); }catch(e){}
  const cb=_bqCb;
  fermerBanque();
  if(cb) try{ cb(f); }catch(e){ console.error('[RepCore] banque :',e); }
  return true;
}
function bqFavori(slug,ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  basculerFavori(slug);
  try{ saveUser(); }catch(e){}
  _bqRendre();
}

// UNE ILLUSTRATION QUI NE CHARGE PAS BASCULE SUR LE MESSAGE DEJA ECRIT. Les
// deux rendus portaient chacun leur repli — « Aucune illustration pour cet
// exercice » sur la fiche, un cadre neutre de meme taille dans la liste — mais
// aucun des deux ne servait quand l'URL existait et que l'image, elle, ne
// chargeait pas : le guide republie sous d'autres noms de fichier, un index
// plus recent que les images, un cache a moitie rempli. On voyait alors
// l'icone cassee du navigateur, qui ne veut rien dire pour personne.
//
// LE REPLI EST CELUI DU CONTEXTE, pas un troisieme message : sur la fiche on
// prend la place de l'image et on l'explique ; dans la liste on rend le cadre
// neutre, parce que c'est la HAUTEUR qui compte — sans lui la ligne se
// decalerait et la liste deviendrait un escalier.
//
// onerror EST RETIRE AVANT DE REMPLACER : sans ca, un repli qui echouerait a
// son tour rappellerait la fonction indefiniment.
// ⚠ ELLE TENTE LA PLEINE RESOLUTION AVANT D'ABANDONNER — 14/09/2026.
// Elle remplacait la vignette manquante par un cadre gris, directement. Or
// l'image de 900 px, elle, EXISTE : le dossier vignettes/ etait absent du
// depot alors que l'index le declarait, et les 436 exercices s'affichaient
// donc en gris dans toutes les listes pendant que leur fiche montrait bien
// une photo. Un cadre vide ne dit rien a personne et ne se signale nulle part.
//
// Le repli coute une requete de plus SUR LE SEUL CAS D'ECHEC, et il rend le
// produit insensible a une vignette manquante — celle d'aujourd'hui comme
// celle d'un exercice ajoute demain sans sa miniature.
function _illusAbsente(el){
  if(!el||!el.parentNode) return false;
  try{ el.onerror=null; }catch(e){}
  const plein=el.getAttribute&&el.getAttribute('data-plein');
  if(plein&&!el.dataset.repliTente){
    el.dataset.repliTente='1';
    // Le srcset doit partir : il redesignerait la vignette absente.
    try{ el.removeAttribute('srcset'); el.removeAttribute('sizes'); }catch(e){}
    el.onerror=function(){ _illusAbsente(el); };
    el.src=plein;
    return true;
  }
  const fiche=el.style&&el.style.width==='100%';
  const d=document.createElement('div');
  if(fiche){
    d.className='sub';
    d.style.cssText='font-size:var(--fs-xs);text-align:center;padding:16px;'
      +'background:var(--surface-1);border-radius:var(--r-3);margin-bottom:12px';
    d.textContent='Aucune illustration pour cet exercice.';
  } else {
    d.style.cssText='width:64px;height:48px;border-radius:var(--r-2);background:var(--surface-2);'
      +'border:1px solid var(--border);flex-shrink:0';
  }
  el.replaceWith(d);
  return true;
}
// ── Rendu ────────────────────────────────────────────────────────────────
function _bqLigne(f){
  // LA LIGNE PREND LA VIGNETTE, PAS LA FICHE. Soixante lignes affichees en
  // 64x48 tiraient 60 fiches de 900 px : plusieurs mega-octets pour des
  // images grandes comme un ongle.
  //
  // ⚠ DESCRIPTEURS `w`, ET SUREMENT PAS `1x / 2x`. Mesure au navigateur le
  // 07/09/2026 : avec `vignette 1x, fiche 2x`, un ecran a DPR 2 — c'est-a-dire
  // TOUS les telephones — choisit la FICHE. La liste tirait alors 60 images de
  // 25 Ko pour des cadres de 64 px, soit exactement le gaspillage que ces deux
  // tailles existent pour supprimer.
  //
  // La raison est arithmetique : `2x` annonce « deux fois la densite du 1x ».
  // Or la vignette fait deja 256 px dans un cadre de 64 : elle EST du 4x. La
  // declarer 1x ment au navigateur, qui monte d'un cran pour rien.
  //
  // Avec `256w` / `900w` et `sizes="64px"`, le calcul est fait sur la largeur
  // REELLE : 64 px x DPR 2 = 128 px necessaires, la vignette de 256 en offre
  // deux fois plus, elle gagne. La fiche ne sortirait que si le cadre grandis-
  // sait vraiment. Et `sizes` cesse d'etre decoratif : avec des descripteurs
  // `x` la specification l'IGNORE, avec des `w` il est ce qui decide.
  // ⚠ LE DOSSIER DES VIGNETTES N'A JAMAIS EXISTE. Tout ce qui precede decrit
  // un schema a deux tailles pose le 07/09/2026 ; les 427 vignettes de 256 px
  // qu'il annonce n'ont jamais ete produites, et `app/exercices/vignettes/`
  // n'est pas dans le depot. Chaque ligne de liste demandait donc un fichier
  // ABSENT, prenait un 404, puis se rabattait sur la fiche par `onerror` :
  // soixante allers-retours perdus par liste, et un cadre vide le temps du
  // repli. Constate le 15/09/2026, dossier verifie.
  //
  // ET L'ECONOMIE N'EN ETAIT PAS UNE. Les 436 fiches pesent 3,3 Mo au total,
  // mediane 7 Ko, largeur mediane 248 px — pas les « 900 px » et les 12,7 Mo
  // que decrivaient ces commentaires. Une vignette de 256 px economiserait
  // deux ou trois kilo-octets sur sept, contre 1,5 Mo ajoutes au depot : le
  // calcul ne tient pas, et c'est ce que dit deja _htmlVignetteExo.
  //
  // On sert donc la seule image qui existe. Le jour ou les vignettes seront
  // vraiment produites, ce sont ces trois lignes qui changent, et elles
  // seules — srcset et `data-plein` sont restes en place juste en dessous.
  const sl=_slugIllustre(exSlug(f.nom));
  const img=sl?EXO_IMG_DOSSIER+sl+'.webp':null;
  const img2x=img;
  // ⚠ « 900w » ETAIT UN CHIFFRE INVENTE, et il coutait cher. Le descripteur
  // annoncait au navigateur une image de 900 px ; aucune des 436 n'atteint
  // cette largeur — la mediane est de 248 px. Sur un ecran a DPR 3, le
  // navigateur choisissait donc la « grande » en croyant gagner en finesse,
  // et affichait un dessin de 248 px la ou il en fallait 192. Depuis que
  // l'index porte les dimensions REELLES, on lui dit la verite ; sans elles,
  // on ne dit rien du tout, ce qui vaut mieux qu'un mensonge.
  // PLUS DE srcset : il departageait DEUX fichiers, il n'y en a plus qu'un.
  // L'annoncer deux fois sous deux largeurs serait un mensonge de plus.
  const _srcset='';
  const fav=estFavoriExo(f.slug);
  const sous=[(f.muscles||[]).slice(0,2).map(m=>(MUSCLES[m]||{}).lib||m).join(', '),
    f.materiel||''].filter(Boolean).join(' · ');
  return `<div onclick="bqChoisir('${escapeHtml(f.slug)}')" role="button" tabindex="0"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
    class="bq-l"
    style="display:flex;align-items:center;gap:12px;background:var(--surface-1);
    border:1px solid var(--border);border-radius:var(--r-3);padding:10px 12px;margin-bottom:8px;
    cursor:pointer;min-height:66px">
    ${img?`<img src="${escapeHtml(img)}"${_srcset}
      alt="" loading="lazy" decoding="async" width="64" height="48"
      data-plein="${escapeHtml(img2x||'')}"
      onerror="_illusAbsente(this)"
      style="width:64px;height:48px;object-fit:cover;border-radius:var(--r-2);background:#f4f4f4;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.12);flex-shrink:0">`
      // Pas d'illustration : un cadre neutre de la MÊME taille. Sans lui, la
      // ligne se décalerait et la liste deviendrait un escalier.
      :`<div style="width:64px;height:48px;border-radius:var(--r-2);background:var(--surface-2);
        border:1px solid var(--border);flex-shrink:0"></div>`}
    <div style="flex:1;min-width:0">
      <div style="font-weight:800;font-size:var(--fs-sm);line-height:1.3">${escapeHtml(f.nom)}${f.perso?' <span style="color:var(--sub);font-weight:600">· perso</span>':''}</div>
      ${sous?`<div class="sub" style="font-size:var(--fs-2xs);margin-top:2px">${escapeHtml(sous)}</div>`:''}
    </div>
    <button onclick="bqFavori('${escapeHtml(f.slug)}',event)" aria-label="Favori"
      style="background:none;border:none;font-size:var(--fs-xl);line-height:1;cursor:pointer;width:40px;
      height:40px;min-width:40px;display:flex;align-items:center;justify-content:center;
      color:${fav?'var(--orange)':'var(--text-faint)'};flex-shrink:0">${fav?'<span class="ico-plein">'+icon('etoile',16)+'</span>':icon('etoile',16)}</button>
    <button onclick="ouvrirFicheBanque('${escapeHtml(f.slug)}',event)" aria-label="Détail"
      style="background:none;border:none;font-size:var(--fs-lg);line-height:1;cursor:pointer;width:40px;
      height:40px;min-width:40px;display:flex;align-items:center;justify-content:center;
      color:var(--sub);flex-shrink:0">ⓘ</button>
  </div>`;
}
function _bqSection(titre,fiches){
  if(!fiches.length) return '';
  return `<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:800;
    text-transform:uppercase;margin:12px 0 8px">${escapeHtml(titre)}</div>`
    +fiches.map(_bqLigne).join('');
}
// ══ LES MUSCLES, EN GRILLE DE VIGNETTES (01/10/2026) ════════════════════
// Kevin : « ne mets pas sous forme de liste déroulante : un carré, un muscle,
// les uns par-dessus les autres, cinq par ligne, la petite image comme pour le
// volume, et le nom du muscle ». Dix-huit puces sur une seule rangée : il
// fallait la faire glisser pour savoir ce qu'elle contenait.
// Les illustrations sont celles du volume (_volIllus). Un muscle choisi, la
// grille se replie sur lui : la liste des exercices remonte, et « Changer »
// la rouvre.
let _bqMusclesOuvert=false;
function _bqMusclesOuvrir(){ _bqMusclesOuvert=true; _bqRendre(); }
function _bqVignetteMuscle(m,actif){
  const illus=_volIllus(m);
  // « Abdominaux » est le seul nom qui ne tient pas dans une vignette de téléphone.
  const lib=m==='ABDOS'?'Abdos':((MUSCLES[m]||{}).lib||m);
  return `<button type="button" class="bq-mus${actif?' on':''}" data-muscle="${m}" aria-pressed="${actif?'true':'false'}"
    onclick="_bqBasculerFiltre('muscle','${m}')" style="--bq-c:${(MUSCLES[m]||{}).c||'var(--red)'}">
    ${illus?`<img src="${illus}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:'<i></i>'}
    <span>${escapeHtml(lib)}</span></button>`;
}
function _bqHtmlMuscles(){
  const sel=_bqFiltres.muscle;
  if(sel&&MUSCLES[sel]&&!_bqMusclesOuvert){
    return `<div class="bq-mus-choisi">${_bqVignetteMuscle(sel,true)}
      <div class="bq-mus-cmd">
        <button type="button" class="pf-chip" onclick="_bqMusclesOuvrir()">Changer de muscle</button>
        <button type="button" class="pf-chip" onclick="_bqBasculerFiltre('muscle','${sel}')">Tous les muscles</button>
      </div></div>`;
  }
  return `<div class="bq-mus-grille">`+Object.keys(MUSCLES).map(m=>_bqVignetteMuscle(m,sel===m)).join('')+`</div>`;
}
function _bqRendreFiltres(){
  const z=document.getElementById('bq-filtres'); if(!z) return;
  z.innerHTML=BQ_FAMILLES.map(fam=>{
    if(fam.cle==='muscle') return _bqHtmlMuscles();
    const vals=fam.valeurs();
    if(!vals.length) return '';
    return `<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch">`
      +vals.map(v=>`<button class="pf-chip${_bqFiltres[fam.cle]===v?' active':''}"
        onclick="_bqBasculerFiltre('${fam.cle}','${escapeHtml(String(v))}')">${escapeHtml(fam.libelle(v))}</button>`).join('')
      +`</div>`;
  }).join('');
}
function _bqRendre(){
  const z=document.getElementById('bq-liste'); if(!z) return;
  // ══ LE VERROU (lot 4) : l'ecran garde sa barre et son titre ; la liste dit
  // ce qui est ferme, et ce qui reste possible dans le compositeur.
  const _vrr=rcVerrou('bibliothequeExercices');
  if(_vrr){
    const zf=document.getElementById('bq-filtres'); if(zf) zf.innerHTML='';
    z.innerHTML=_vrr; return;
  }
  _bqRendreFiltres();
  const q=(document.getElementById('bq-q')||{}).value||'';
  const filtres=Object.assign({},_bqFiltres);
  if(_bqOnglet==='perso') filtres.perso=true;
  const res=rechercherBanque(q,filtres);
  // Les muscles nommes par la requete servent DEUX fois : a grouper la liste
  // et a proposer la puce. Une seule lecture.
  const _musclesQ=musclesVises(q,filtres);
  _bqPuceMuscle(musclesDeRequete(q));
  const cpt=document.getElementById('bq-compte');
  if(cpt) cpt.textContent=res.length?String(res.length):'';

  if(!banqueEstChargee()&&_bqOnglet==='banque'&&!exercicesPerso().length){
    // R13 — « rouvre cet écran » devient un bouton : c'est le meme geste.
    z.innerHTML=emptyState('folder','<strong style="font-size:var(--fs-md)">Banque indisponible</strong>'
      +'<br><span style="font-size:var(--fs-sm);display:inline-block;margin-top:6px">Elle n\'a pas encore '
      +'été téléchargée sur cet appareil. Reconnecte-toi au réseau, puis réessaie.</span>',
      'Réessayer','chargerBanque(true).then(()=>_bqRendre())');
    return;
  }
  if(!res.length){
    // R13 — onglet perso : le bouton de creation est deja pose juste dessous,
    // pas de second. Banque : si une recherche ou un filtre vide la liste, on
    // offre de tout effacer ; sans rien de pose, il n'y a rien a effacer.
    const _filtre=!!(q.trim()||Object.keys(_bqFiltres).some(k=>_bqFiltres[k]));
    z.innerHTML=(_bqOnglet==='perso'
      ?emptyState('search','<strong style="font-size:var(--fs-md)">Aucun exercice personnel</strong><br>'
        +'<span style="font-size:var(--fs-sm);display:inline-block;margin-top:6px">Crée le tien avec le bouton ci-dessous.</span>')
      :(_filtre
        ?emptyState('search','Aucun exercice ne correspond à ta recherche.','Effacer la recherche','_bqToutEffacer()')
        :emptyState('search','Aucun exercice dans la banque pour l\'instant.')))
      +(_bqOnglet==='perso'?_bqBoutonCreer():'');
    return;
  }
  // Recherche vide et aucun filtre : on met à portée de pouce ce qu'il
  // réutilise. Un coach revient toujours aux mêmes quarante exercices.
  const nu=!q.trim()&&!Object.keys(_bqFiltres).length;
  let html='';
  if(nu&&_bqOnglet==='banque'){
    const rec=fichesDeSlugs(recentsCoach()).slice(0,8);
    const fav=fichesDeSlugs(favorisCoach()).filter(f=>!rec.some(r=>r.slug===f.slug));
    html+=_bqSection('Récents',rec);
    html+=_bqSection('Favoris',fav);
    const vus=new Set([...rec,...fav].map(f=>f.slug));
    const reste=res.filter(f=>!vus.has(f.slug));
    html+=_bqSection('Tous les exercices',reste.slice(0,BQ_MAX_LIGNES));
    if(reste.length>BQ_MAX_LIGNES) html+=_bqTrop(reste.length-BQ_MAX_LIGNES);
  } else if(_musclesQ.length&&res.length){
    // ── DEUX SECTIONS QUAND LA REQUETE NOMME UN MUSCLE ──────────────────
    // « Le triceps travaille » et « le triceps aide » ne se prescrivent pas
    // pareil. Les melanger dans une liste triee obligeait a lire chaque ligne
    // pour savoir laquelle on regardait.
    const estPrim=f=>_musclesQ.indexOf((f.muscles||[])[0])>=0;
    const prim=res.filter(estPrim), sec=res.filter(f=>!estPrim(f));
    // ⚠ LE PLAFOND EST GLOBAL, PAS PAR SECTION. Soixante par section, c'est
    // cent vingt lignes — le plafond existe pour que le rendu tienne, pas pour
    // decorer. La seconde section recoit donc ce que la premiere laisse.
    const nP=Math.min(prim.length,BQ_MAX_LIGNES);
    const nS=Math.max(0,Math.min(sec.length,BQ_MAX_LIGNES-nP));
    html+=_bqSection('Muscle principal',prim.slice(0,nP));
    html+=_bqSection('Sollicité en secondaire',sec.slice(0,nS));
    // ET ON DIT CE QU'ON NE MONTRE PAS. Tronquer en silence est deja interdit
    // ailleurs dans ce fichier ; ce n'est pas parce qu'il y a deux sections
    // que le reste a le droit de disparaitre.
    const reste=(prim.length-nP)+(sec.length-nS);
    if(reste>0) html+=_bqTrop(reste);
  } else {
    html+=res.slice(0,BQ_MAX_LIGNES).map(_bqLigne).join('');
    if(res.length>BQ_MAX_LIGNES) html+=_bqTrop(res.length-BQ_MAX_LIGNES);
  }
  if(_bqOnglet==='perso') html+=_bqBoutonCreer();
  z.innerHTML=html;
}
// La puce de raccourci. Un seul muscle proposé : quand la requête en nomme
// plusieurs — « épaules » touche les trois deltoïdes — on ne devine pas lequel
// il visait, et proposer trois puces reconstruirait le tri qu'on vient de
// supprimer. On prend le premier, qui est celui de la table.
function _bqPuceMuscle(muscles){
  const z=document.getElementById('bq-puce-muscle'); if(!z) return false;
  const m=(muscles||[])[0];
  if(!m||!MUSCLES[m]||_bqFiltres.muscle===m){ z.innerHTML=''; return false; }
  z.innerHTML=`<button class="pf-chip" onclick="_bqFiltrerMuscle('${m}')"
    style="border-color:${MUSCLES[m].c};color:${MUSCLES[m].c}">Filtrer sur ${escapeHtml(MUSCLES[m].lib)}</button>`;
  return true;
}
// Le tap : on pose le filtre ET on vide le champ. Garder la requête ferait un
// ET avec le filtre — « triceps » ne matcherait plus que les fiches qui
// portent le mot, alors que le coach vient justement de dire qu'il voulait
// TOUS les triceps.
function _bqFiltrerMuscle(m){
  _bqFiltres.muscle=m;
  const q=document.getElementById('bq-q'); if(q) q.value='';
  _bqRendre();
}
// On DIT ce qu'on ne montre pas. Une liste tronquée en silence se lit comme
// une liste complète.
function _bqTrop(n){
  return `<div class="sub" style="font-size:var(--fs-xs);text-align:center;padding:12px 8px;line-height:1.6">`
    +n+` autre${n>1?'s':''} exercice${n>1?'s':''} ne ${n>1?'sont':'est'} pas affiché${n>1?'s':''}.`
    +` Précise ta recherche ou pose un filtre.</div>`;
}
function _bqBoutonCreer(){
  return '<button class="btn btn-red" style="margin-top:14px;width:100%" onclick="ouvrirCreationExo()">'
    +'+ Créer un exercice</button>';
}

// ── Fiche complète ───────────────────────────────────────────────────────
function ouvrirFicheBanque(slug,ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  const f=catalogueCoach().find(x=>x.slug===slug);
  if(!f) return false;
  // LA FICHE GARDE LA PLEINE RESOLUTION : c'est le seul endroit ou l'image est
  // regardee, en width:100% dans une modale de 480 px.
  //
  // width/height VIENNENT DE L'INDEX, PAS D'UNE VALEUR FIGEE. Ils ne
  // contraignent pas l'affichage — le style qui suit l'emporte — ils donnent
  // au navigateur le RATIO, ce qui lui permet de reserver la hauteur avant que
  // l'image arrive. Sans eux, le contenu de la modale saute vers le bas au
  // chargement. Et le ratio n'est pas le meme d'une fiche a l'autre : le figer
  // ferait sauter la mise en page dans l'autre sens.
  //
  // ⚠ `height:auto` EST OBLIGATOIRE DANS LE STYLE, et une capture l'a montre
  // avant que ca parte. `width:100%` neutralise bien l'attribut width, mais
  // RIEN ne neutralisait l'attribut height : la hauteur utilisee devenait 532,
  // rabotee a 260 par max-height, et `object-fit:contain` centrait la photo
  // dans une boite trop haute — 30 px de bande BLANCHE en haut et en bas de
  // chaque fiche. Avec `height:auto`, la hauteur redevient calculee depuis le
  // ratio, et les attributs ne servent plus qu'a reserver la place.
  const _sl=_slugIllustre(exSlug(f.nom));
  const img=_sl?EXO_IMG_DOSSIER+_sl+'.webp':null;
  const _d=_dimsParSlug(exSlug(f.nom));
  // ⚠ ET ELLE NE S'AGRANDIT PLUS. `width:100%` dans une modale de 480 px
  // etirait un dessin de 248 px a DEUX FOIS sa taille : c'est exactement le
  // « images de mauvaise qualite » rapporte. Aucune des 436 illustrations
  // n'atteint 900 px, contrairement a ce que le commentaire du dossier
  // affirmait. `max-width` a la largeur reelle la montre NETTE, centree, et
  // laisse `width:100%` faire son travail sur les ecrans plus etroits qu'elle.
  // Sans dimension connue, on ne borne rien : le comportement d'avant.
  const l=(t,v)=>v?`<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);padding:4px 0">`
    +`<span style="color:var(--sub)">${escapeHtml(t)}</span><span style="color:var(--text);text-align:right">${escapeHtml(v)}</span></div>`:'';
  const liste=(titre,arr)=>(arr&&arr.length)?`<div style="margin-top:12px">`
    +`<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">${escapeHtml(titre)}</div>`
    +`<ul style="margin:0 0 0 16px;padding:0;font-size:var(--fs-sm);color:#bbb;line-height:1.6">`
    +arr.map(x=>`<li style="margin-bottom:4px">${escapeHtml(x)}</li>`).join('')+`</ul></div>`:'';
  // Variantes : les exercices du MÊME schéma moteur. C'est la seule parenté
  // que les données portent réellement — inventer une liste de variantes
  // serait un jugement de métier qu'aucune donnée ne soutient ici.
  const variantes=f.schema?catalogueCoach().filter(x=>x.schema===f.schema&&x.slug!==f.slug).slice(0,6):[];
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div class="mdl-large" onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h2 style="margin-bottom:10px;font-size:var(--fs-lg)">${escapeHtml(f.nom)}</h2>
    ${img?`<img src="${escapeHtml(img)}" alt="${escapeHtml(f.nom)}" decoding="async"${_d?` width="${_d[0]}" height="${_d[1]}"`:''} onerror="_illusAbsente(this)" style="display:block;margin:0 auto 12px;width:100%;${_d?`max-width:${_d[0]}px;`:''}height:auto;max-height:260px;object-fit:contain;background:#fff;border-radius:var(--r-3)">`
      :`<div class="sub" style="font-size:var(--fs-xs);text-align:center;padding:16px;background:var(--surface-1);border-radius:var(--r-3);margin-bottom:12px">Aucune illustration pour cet exercice.</div>`}
    ${l('Muscles',(f.muscles||[]).map(m=>(MUSCLES[m]||{}).lib||m).join(', '))}
    ${l('Schéma',SCHEMA_LIB[f.schema]||f.schema||'')}
    ${l('Matériel',f.materiel||'')}
    ${l('Niveau',f.niveau||'')}
    ${f.unilateral?l('Unilatéral','oui'):''}
    ${l('Repos conseillé',f.repos||'')}
    ${f.execution?`<div style="margin-top:12px"><div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Exécution</div>
      <div style="font-size:var(--fs-sm);color:#bbb;line-height:1.65">${escapeHtml(f.execution)}</div></div>`:''}
    ${liste('Erreurs fréquentes',f.erreurs)}
    ${liste('Consignes',f.consignes)}
    ${(f.videos||[]).map(v=>`<a href="https://youtu.be/${escapeHtml(v.id)}" target="_blank" rel="noopener" style="display:block;margin-top:10px;font-size:var(--fs-sm);color:var(--link)">Vidéo technique${v.lib?' : '+escapeHtml(v.lib):''}</a>`).join('')}
    ${variantes.length?`<div style="margin-top:14px"><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Même schéma moteur</div>
      ${variantes.map(v=>`<button class="pf-chip" style="margin:0 6px 6px 0" onclick="closeModal();ouvrirFicheBanque('${escapeHtml(v.slug)}')">${escapeHtml(v.nom)}</button>`).join('')}</div>`:''}
    <button class="btn btn-red" style="margin-top:16px" onclick="closeModal();bqChoisir('${escapeHtml(f.slug)}')">Ajouter à la séance</button>
    ${f.perso?`<button class="btn btn-outline" style="margin-top:10px;color:var(--red-light)" onclick="_supprimerExoPerso('${escapeHtml(f.slug)}')">Supprimer cet exercice</button>`:''}
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
async function _supprimerExoPerso(slug){
  if(!await rcConfirm('Supprimer cet exercice de tes exercices personnels ?',null,'Supprimer')) return false;
  const ok=supprimerExercicePerso(slug);
  if(ok){ try{ saveUser(); }catch(e){} }
  closeModal(); _bqRendre();
  return ok;
}

// ── Création d'un exercice personnel ─────────────────────────────────────
function ouvrirCreationExo(){
  if(!peutConsulterBanque()){ toast('Réservé aux coachs.','var(--orange)'); return false; }
  const opt=(v,lib,sel)=>`<option value="${escapeHtml(v)}"${sel?' selected':''}>${escapeHtml(lib)}</option>`;
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h2 style="margin-bottom:4px;font-size:var(--fs-lg)">Créer un exercice</h2>
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.6">Il n'appartient qu'à toi : aucun autre coach ne le voit. L'illustration est facultative : il n'y en aura pas.</p>
    <label for="ce-nom">Nom</label>
    <input id="ce-nom" placeholder="Ex : TIRAGE POITRINE PRISE NEUTRE" autocapitalize="characters">
    <label for="ce-muscle" style="margin-top:10px">Muscle principal</label>
    <select id="ce-muscle">${opt('','aucun - ',true)}${Object.keys(MUSCLES).map(m=>opt(m,MUSCLES[m].lib)).join('')}</select>
    <label for="ce-schema" style="margin-top:10px">Schéma moteur</label>
    <select id="ce-schema">${opt('','aucun - ',true)}${Object.keys(SCHEMA_LIB).map(k=>opt(k,SCHEMA_LIB[k])).join('')}</select>
    <label for="ce-materiel" style="margin-top:10px">Matériel</label>
    <select id="ce-materiel">${opt('','non précisé - ',true)}${_bqValeurs('materiel').map(v=>opt(v,v)).join('')}</select>
    <label for="ce-exec" style="margin-top:10px">Exécution (facultatif)</label>
    <textarea id="ce-exec" rows="4" placeholder="Ce que l'athlète doit faire, étape par étape."></textarea>
    <div id="ce-err" style="color:var(--red-light);font-size:var(--fs-sm);margin-top:8px;display:none"></div>
    <button class="btn btn-red" style="margin-top:14px" onclick="_validerCreationExo()">Créer</button>
    <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  setTimeout(()=>document.getElementById('ce-nom')?.focus(),80);
  return true;
}
function _validerCreationExo(){
  const v=id=>(document.getElementById(id)||{}).value||'';
  const m=v('ce-muscle');
  const r=creerExercicePerso({nom:v('ce-nom'),muscles:m?[m]:[],schema:v('ce-schema')||null,
    materiel:v('ce-materiel')||null,execution:v('ce-exec')});
  if(!r.ok){
    const e=document.getElementById('ce-err');
    if(e){ e.textContent=r.raison; e.style.display='block'; }
    return false;
  }
  // L'exercice n'existe pour l'instant que dans currentUser : si le quota
  // déborde, il disparaît au rechargement. L'annoncer créé sans le savoir
  // envoyait le coach construire une séance autour d'un exercice perdu.
  let ok=false;
  try{ ok=saveUser(); }catch(e){}
  closeModal();
  // N4.8 — LA CREATION S'ENCHAINE SUR L'AJOUT. Le coach qui vient d'ecrire une
  // fiche voulait s'en servir : il devait la retrouver dans la liste et
  // cliquer dessus. Le rappel pose par ouvrirBanque est pourtant encore arme,
  // et bqChoisir sait deja noter le recent, enregistrer, fermer l'ecran et
  // rendre la fiche a l'appelant.
  //
  // SEULEMENT QUAND LA BANQUE A ETE OUVERTE AVEC UN RAPPEL : ouverte pour
  // consultation depuis le tableau de bord, elle ne doit rien ajouter nulle
  // part, et le comportement d'avant tient.
  //
  // ET SEULEMENT SI L'ENREGISTREMENT A REUSSI. L'exercice n'existe pour
  // l'instant que dans currentUser : si le quota deborde il disparait au
  // rechargement, et batir une seance autour d'un exercice perdu est pire que
  // de demander un clic de plus.
  const _slug=(r.fiche&&r.fiche.slug)||null;
  if(ok&&_bqCb&&_slug&&bqChoisir(_slug)){
    toast('Exercice créé et ajouté '+ICO.coche);
    return true;
  }
  bqOnglet('perso');
  toastEcriture(ok,'Exercice créé '+ICO.coche,'l\'exercice est');
  return true;
}

// ── Recherche, favoris, récents, exercices du coach ──────────────────────
// Tout ce bloc est PUR et travaille sur des listes qu'on lui passe : la
// suite l'éprouve sans toucher au stockage ni au réseau.

// Les exercices que le coach a écrits lui-même. Ils vivent dans SON dossier :
// un autre coach ne peut structurellement pas les voir, aucune règle à écrire
// pour ça. Le préfixe garantit qu'un slug perso n'écrasera jamais une fiche
// de la banque, même si le coach nomme son exercice « Développé couché ».
const EXO_PERSO_PREFIXE='perso-';
const EXO_PERSO_MAX=200;
const EXO_FAVORIS_MAX=60;
// Vingt : un coach réutilise toujours les mêmes quarante exercices, et les
// vingt derniers suffisent à couvrir la séance en cours sans noyer l'écran.
const EXO_RECENTS_MAX=20;

// undefined → l'utilisateur courant. null → PERSONNE. Toute fonction de ce
// bloc qui accepte un `user` passe par ici : la règle est écrite une fois.
function _dossier(user){ return (user===undefined)?currentUser:user; }
function exercicesPerso(user){
  const u=_dossier(user);
  return Array.isArray(u&&u.exCustom)?u.exCustom:[];
}
// Banque officielle + exercices du coach. C'est CETTE liste que le sélecteur
// parcourt ; les deux sources se distinguent par `perso`.
function catalogueCoach(user){
  const perso=exercicesPerso(user).map(f=>Object.assign({},f,{perso:true}));
  return fichesBanque().concat(perso);
}

// PURE. Normalisation de recherche : minuscules, sans accents, sans
// ponctuation. « Développé couché » et « DEVELOPPE COUCHE » doivent se
// rejoindre, et « poulie/élastique » se couper en deux mots.
function _normRech(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
// ── LE VOCABULAIRE DU METIER, ECRIT EN TOUTES LETTRES ────────────────────
//
// La recherche ne lisait que le nom et le slug. Mesure du 07/09/2026 :
// « triceps » rendait 19 fiches — la premiere etant SIDE TRICEPS, une POSE de
// posing — et manquait 14 exercices dont le triceps est le muscle moteur.
// « biceps » rendait 3 fiches dont 2 poses, et manquait 27 exercices. Le coach
// tape le muscle qu'il veut travailler ; c'est la premiere chose qu'il tape.
//
// LA TABLE EST EXPLICITE, PAS DERIVEE. Un « ajoute un s / retire un s » aurait
// rattache « delt » a rien et « lats » a « lat spread ». Ces mots sont ceux du
// terrain, ils ne se devinent pas : ils s'ecrivent.
//
// Les clefs brutes (TRICEPS, DELT_ANT) sont ajoutees automatiquement plus bas
// avec les libelles de MUSCLES : inutile de les repeter ici.
const MUSCLE_SYNONYMES=Object.freeze({
  TRICEPS   :['triceps'],
  BICEPS    :['biceps'],
  PECTORAUX :['pecs','pectoraux','poitrine','pec'],
  DORSAUX   :['dos','dorsaux','lats','grand dorsal','dorsal'],
  DELT_ANT  :['epaules','epaule','deltoide','delt','deltoide anterieur','avant epaule'],
  DELT_LAT  :['epaules','epaule','deltoide','delt','deltoide lateral','moyen deltoide'],
  DELT_POST :['epaules','epaule','deltoide','delt','deltoide posterieur','arriere epaule'],
  // « trapezes » tout court reste reconnu, et va au SUPERIEUR : c'est celui
  // que tout le monde designe en disant « les trapezes ».
  TRAP_SUP  :['trapezes','traps','trapeze','trapeze superieur','trapezes superieurs','haut des trapezes'],
  TRAP_MED  :['trapeze moyen','trapezes moyens','trapeze median','trapezes medians','milieu du dos'],
  LOMBAIRES :['lombaires','lombaire','bas du dos','erecteurs'],
  QUADRICEPS:['quadriceps','quads','quad','cuisses','cuisse'],
  ISCHIOS   :['ischios','ischio','ischio jambiers','hamstrings','hamstring'],
  FESSIERS  :['fessiers','fessier','glutes','glute','fesses'],
  MOLLETS   :['mollets','mollet','calves','calf','triceps sural'],
  ABDOS     :['abdos','abdominaux','abdo','gainage','ceinture abdominale','sangle abdominale'],
  AVANT_BRAS:['avant bras','avant-bras','grip','poignets'],
  ABDUCTEURS:['abducteurs','abducteur','abduction'],
  ADDUCTEURS:['adducteurs','adducteur','adduction','interieur de cuisse']
});
// PURE. Tous les mots qui designent un muscle donne : ses synonymes, sa clef
// brute et son libelle. Calculee une fois, pas a chaque frappe.
const _MOTS_MUSCLE=(()=>{
  const m={};
  for(const k in MUSCLES){
    const l=new Set((MUSCLE_SYNONYMES[k]||[]).map(_normRech));
    l.add(_normRech(k));
    l.add(_normRech((MUSCLES[k]||{}).lib||''));
    l.delete('');
    m[k]=[...l];
  }
  return Object.freeze(m);
})();
// PURE. Les muscles que la requete NOMME. Rend [] quand elle n'en nomme aucun.
//
// ⚠ ELLE LIT LA REQUETE ENTIERE, PAS MOT A MOT. « avant bras » et « grand
// dorsal » sont des expressions de deux mots : les couper les perdrait tous
// les deux. On teste donc la chaine normalisee complete, et a defaut chaque
// mot pris seul.
function musclesDeRequete(q){
  const n=_normRech(q);
  if(!n) return [];
  const mots=n.split(' ').filter(Boolean);
  const out=[];
  for(const k in _MOTS_MUSCLE){
    const trouve=_MOTS_MUSCLE[k].some(t=>
      t.indexOf(' ')>=0 ? n.indexOf(t)>=0 : mots.indexOf(t)>=0);
    if(trouve) out.push(k);
  }
  return out;
}
// PURE. Le foin d'une fiche : tout ce dans quoi la recherche a le droit de
// chercher. Calcule UNE fois par fiche et par appel — le recalculer pour
// chacun des mots de la requete multipliait le cout par la longueur de la
// requete, sur 450 fiches, a chaque frappe.
function _foinBanque(fiche,user){
  let foin=_normRech(fiche.nom)+' '+_normRech(fiche.slug);
  // LE MUSCLE, SOUS TOUS SES NOMS. C'est l'ajout qui change tout : le coach
  // cherche « triceps », pas « barre au front ».
  for(const m of (fiche.muscles||[])) if(_MOTS_MUSCLE[m]) foin+=' '+_MOTS_MUSCLE[m].join(' ');
  // LA PARTIE SPECIFIQUE DU GUIDE, ecrite a la main par le coach exercice par
  // exercice — « longue portion », « chef lateral », « grand dorsal ». Ce sont
  // des mots qu'il tape vraiment, et rien ne les lisait.
  if(fiche.partie_specifique) foin+=' '+_normRech(fiche.partie_specifique);
  if(fiche.libelle) foin+=' '+_normRech(fiche.libelle);
  // Les renommages du coach servent d'alias : s'il appelle le développé
  // couché « DC », taper « DC » doit le trouver.
  const a=(_dossier(user)||{}).exAlias;
  if(a) for(const k of Object.keys(a))
    if(exKey(a[k])===exKey(fiche.nom)) foin+=' '+_normRech(k);
  return foin;
}
// PURE. Tous les mots de la requête doivent être présents, dans n'importe
// quel ordre. « couche barre » trouve « DÉVELOPPÉ COUCHÉ BARRE » ; un ET et
// non un OU, sinon deux mots élargissent au lieu de resserrer.
function _correspond(fiche,mots,user){
  if(!mots.length) return true;
  const foin=_foinBanque(fiche,user);
  return mots.every(m=>foin.indexOf(m)>=0);
}
// PURE. Filtres : un critère non renseigné ne filtre rien. Les critères se
// cumulent en ET — c'est ce qu'on attend en resserrant une recherche.
function _passeFiltres(f,ft){
  if(!ft) return true;
  if(ft.muscle&&!(f.muscles||[]).includes(ft.muscle)) return false;
  if(ft.materiel&&f.materiel!==ft.materiel) return false;
  if(ft.schema&&f.schema!==ft.schema) return false;
  if(ft.niveau&&f.niveau!==ft.niveau) return false;
  if(ft.perso&&!f.perso) return false;
  return true;
}
// ══ LE BAREME DE PERTINENCE ══════════════════════════════════════════════
//
// Le tri d'avant classait par LONGUEUR DE NOM. « SIDE TRICEPS » — une pose de
// posing — sortait donc en tete de « triceps », devant quatorze exercices dont
// le triceps est le moteur. Un nom court n'est pas une reponse pertinente,
// c'est un nom court.
//
// CHAQUE POIDS, ET POURQUOI IL VAUT CA :
//
//   +100  MUSCLE PRIMAIRE. Le coach qui tape « triceps » veut travailler le
//         triceps, pas trouver un exercice qui l'accompagne. C'est la reponse
//         a sa question, et rien ne doit passer devant.
//   + 40  MUSCLE SECONDAIRE. Utile — il complete un volume — mais ce n'est
//         pas ce qu'il cherchait. Moins de la moitie du primaire : deux
//         secondaires ne doivent jamais remonter au niveau d'un primaire.
//   + 30  DANS LE NOM. « barre au front » quand on tape « barre » : c'est une
//         correspondance litterale, elle merite d'etre devant le secondaire.
//   + 20  DANS LA PARTIE SPECIFIQUE. « longue portion », « chef lateral » :
//         le coach les tape, mais c'est un affinage, pas une cible.
//   + 15  EGALITE EXACTE avec le nom complet. Petit, et c'est voulu : il
//         s'AJOUTE au +30 du nom, il ne le remplace pas. « SQUAT » tape en
//         entier vaut donc 45, devant « SQUAT BULGARE » a 30.
//   + 10  LE NOM COMMENCE PAR LA REQUETE. Le geste de frappe le plus courant.
//   -200  POSING OU CARDIO quand la requete est un NOM DE MUSCLE. Assez pour
//         passer derriere n'importe quel exercice, jamais assez pour les
//         faire disparaitre : SIDE TRICEPS reste trouvable en tapant son nom,
//         il cesse seulement de squatter la premiere place de « triceps ».
//
// A SCORE EGAL : le nom le plus court d'abord — « SQUAT » avant « SQUAT
// BULGARE HALTERE » — puis l'ordre alphabetique, pour que deux rendus
// successifs donnent le meme ordre.
//
// Ce bareme sera relu et ajuste. Les nombres sont ronds pour ca.
const BQ_SCORE=Object.freeze({
  primaire:100, secondaire:40, nom:30, partie:20, exact:15, debut:10, horsSujet:-200
});
// PURE. Le score d'une fiche pour une requete. `muscles` est le resultat de
// musclesDeRequete(q), calcule UNE fois par recherche et passe ici.
function scoreBanque(f,q,muscles,user){
  const n=_normRech(q);
  // 01/10/2026 : LE MUSCLE COMPTE MÊME SANS TEXTE. Un muscle choisi par sa
  // tuile arrive ici avec une requête vide : le score valait 0 pour toutes les
  // fiches, et la liste sortait triée par longueur de nom, un développé
  // couché (triceps secondaire) devant une extension à la poulie.
  if(!n&&!(muscles||[]).length) return 0;
  let sc=0;
  const nom=_normRech(f.nom), lib=f.libelle?_normRech(f.libelle):'';
  const prim=(f.muscles||[])[0]||null;
  const sec=(f.muscles||[]).slice(1);
  for(const m of (muscles||[])){
    if(prim===m) sc+=BQ_SCORE.primaire;
    else if(sec.indexOf(m)>=0) sc+=BQ_SCORE.secondaire;
  }
  if(!n){
    if((f.tags||[]).some(t=>t==='posing'||t==='cardio')) sc+=BQ_SCORE.horsSujet;
    return sc;
  }
  const mots=n.split(' ').filter(Boolean);
  if(mots.every(m=>nom.indexOf(m)>=0||lib.indexOf(m)>=0)) sc+=BQ_SCORE.nom;
  if(f.partie_specifique){
    const ps=_normRech(f.partie_specifique);
    if(mots.every(m=>ps.indexOf(m)>=0)) sc+=BQ_SCORE.partie;
  }
  if(nom===n||lib===n) sc+=BQ_SCORE.exact;
  if(nom.indexOf(n)===0||(lib&&lib.indexOf(n)===0)) sc+=BQ_SCORE.debut;
  // ⚠ LE MALUS NE TOMBE QUE SUR UNE REQUETE DE MUSCLE. Taper « side triceps »
  // ou « posing » doit rendre les poses normalement : ce n'est pas la fiche
  // qu'on ecarte, c'est la confusion entre « travailler le triceps » et
  // « poser en montrant le triceps ».
  if((muscles||[]).length&&(f.tags||[]).some(t=>t==='posing'||t==='cardio'))
    sc+=BQ_SCORE.horsSujet;
  return sc;
}
// PURE. Les muscles que la recherche VISE : ceux que la requête nomme, plus
// celui du filtre (la tuile). Les deux chemins classent donc pareil : muscle
// principal d'abord, secondaire ensuite.
function musclesVises(q,filtres){
  const l=musclesDeRequete(q).slice();
  const m=filtres&&filtres.muscle;
  if(m&&l.indexOf(m)<0) l.push(m);
  return l;
}
// PURE. Rend les fiches correspondantes, la plus PERTINENTE d'abord. Voir le
// barème ci-dessus : à score égal, la plus courte, puis l'ordre alphabétique.
function rechercherBanque(q,filtres,source,user){
  const liste=source||catalogueCoach(user);
  const mots=_normRech(q).split(' ').filter(Boolean);
  const muscles=musclesVises(q,filtres);
  const out=[];
  for(const f of liste){
    if(!f||!f.slug) continue;
    if(!_passeFiltres(f,filtres)) continue;
    if(!_correspond(f,mots,user)) continue;
    // LE SCORE EST CALCULE UNE FOIS PAR FICHE, PAS A CHAQUE COMPARAISON. Un
    // tri fait O(n log n) comparaisons : le calculer dedans, c'est le refaire
    // trois mille fois sur 450 fiches, a chaque frappe, sous un debounce de
    // 250 ms.
    f._sc=(mots.length||muscles.length)?scoreBanque(f,q,muscles,user):0;
    out.push(f);
  }
  out.sort((a,b)=>{
    if(a._sc!==b._sc) return b._sc-a._sc;
    const la=(a.nom||'').length, lb=(b.nom||'').length;
    if(la!==lb) return la-lb;
    return String(a.nom||'').localeCompare(String(b.nom||''));
  });
  return out;
}

// ── Favoris ──────────────────────────────────────────────────────────────
function favorisCoach(user){
  const u=_dossier(user);
  return Array.isArray(u&&u.exFavoris)?u.exFavoris:[];
}
// estFavoriExo et non estFavori : ce dernier existe deja pour les ALIMENTS
// (l. ~21168). Deux declarations du meme nom, et la derniere du fichier
// gagne en silence — le piege qui a fait disparaitre ficheBanque au lot 1.
function estFavoriExo(slug,user){ return favorisCoach(user).indexOf(slug)>=0; }
// Bascule et rend le nouvel état. N'ÉCRIT PAS : l'appelant enregistre, comme
// partout ailleurs — mélanger décision et persistance rend la première
// inéprouvable.
function basculerFavori(slug,user){
  const u=_dossier(user);
  if(!u||!slug) return false;
  if(!Array.isArray(u.exFavoris)) u.exFavoris=[];
  const i=u.exFavoris.indexOf(slug);
  if(i>=0){ u.exFavoris.splice(i,1); return false; }
  u.exFavoris.push(slug);
  if(u.exFavoris.length>EXO_FAVORIS_MAX) u.exFavoris=u.exFavoris.slice(-EXO_FAVORIS_MAX);
  return true;
}
// ── Récents ──────────────────────────────────────────────────────────────
function recentsCoach(user){
  const u=_dossier(user);
  return Array.isArray(u&&u.exRecents)?u.exRecents:[];
}
// Le plus récent en tête, sans doublon. Un exercice repris remonte au lieu
// d'apparaître deux fois.
function noterRecent(slug,user){
  const u=_dossier(user);
  if(!u||!slug) return recentsCoach(u);
  const l=recentsCoach(u).filter(x=>x!==slug);
  l.unshift(slug);
  u.exRecents=l.slice(0,EXO_RECENTS_MAX);
  return u.exRecents;
}
// PURE. Les fiches correspondant à une liste de slugs, dans CET ordre, en
// sautant celles qui n'existent plus — un exercice retiré de la banque ne
// doit pas laisser un trou ni une ligne vide.
function fichesDeSlugs(slugs,user){
  const cat=catalogueCoach(user);
  const par={}; for(const f of cat) par[f.slug]=f;
  return (slugs||[]).map(s=>par[s]).filter(Boolean);
}

// ── Exercices écrits par le coach ────────────────────────────────────────
// Le slug est dérivé du nom, préfixé, et rendu unique par un suffixe
// numérique : deux exercices persos du même nom sont peu probables mais pas
// impossibles, et un slug écrasé ferait disparaître le premier.
function _slugPerso(nom,existants){
  const base=EXO_PERSO_PREFIXE+(exSlug(nom)||'exercice');
  if(existants.indexOf(base)<0) return base;
  for(let i=2;i<500;i++) if(existants.indexOf(base+'-'+i)<0) return base+'-'+i;
  return base+'-'+Date.now();
}
// Rend la fiche créée, ou null avec la raison. N'ÉCRIT PAS dans le stockage.
function creerExercicePerso(champs,user){
  const u=_dossier(user);
  if(!u||u.role!=='coach') return {ok:false,raison:'Réservé aux coachs.'};
  const nom=String((champs||{}).nom||'').trim().toUpperCase();
  if(nom.length<3) return {ok:false,raison:'Donne un nom d\'au moins 3 caractères.'};
  if(!Array.isArray(u.exCustom)) u.exCustom=[];
  if(u.exCustom.length>=EXO_PERSO_MAX)
    return {ok:false,raison:'Tu as atteint '+EXO_PERSO_MAX+' exercices personnels.'};
  // Un nom déjà pris dans la banque officielle n'est PAS refusé : un coach a
  // le droit d'avoir sa propre version d'un mouvement. Les deux coexistent,
  // le préfixe les distingue.
  if(u.exCustom.some(f=>exKey(f.nom)===exKey(nom)))
    return {ok:false,raison:'Tu as déjà un exercice personnel de ce nom.'};
  const f={
    slug:_slugPerso(nom,u.exCustom.map(x=>x.slug)),
    nom,
    muscles:Array.isArray(champs.muscles)?champs.muscles.slice(0,4):[],
    schema:champs.schema||null,
    materiel:champs.materiel||null,
    niveau:champs.niveau||'debutant',
    unilateral:!!champs.unilateral,
    execution:String(champs.execution||'').trim().slice(0,1200),
    // Pas d'illustration : le coach n'en fournit pas, et le cahier des
    // charges l'autorise explicitement. L'écran affiche alors un cadre
    // neutre, non cliquable.
    image:null, repos:'', videos:[], tags:[], erreurs:[], consignes:[]
  };
  u.exCustom.push(f);
  return {ok:true,fiche:f};
}
function supprimerExercicePerso(slug,user){
  const u=_dossier(user);
  if(!u||!Array.isArray(u.exCustom)) return false;
  const n=u.exCustom.length;
  u.exCustom=u.exCustom.filter(f=>f.slug!==slug);
  // Il sort aussi des favoris et des récents, sinon il y laisserait un trou.
  if(Array.isArray(u.exFavoris)) u.exFavoris=u.exFavoris.filter(x=>x!==slug);
  if(Array.isArray(u.exRecents)) u.exRecents=u.exRecents.filter(x=>x!==slug);
  return u.exCustom.length<n;
}

function exKey(nom){
  return String(nom||'')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
}

// ── Alias : « cet exercice est en fait celui-là » ───────────────────────────
// Écrit par la détection de renommage et par la fusion manuelle. Résolution
// bornée à 3 sauts : au-delà, on rend la dernière clé atteinte plutôt que de
// boucler. Un cycle A→B→A est refusé à l'écriture (voir ajouterAlias).
//
// DEUX TABLES, UN SEUL CHEMIN. EX_RENOMMAGES porte les renommages du guide,
// exAlias ceux du coach. Ce cœur commun est écrit UNE fois et sert aux deux
// points d'entrée — resoudreAlias (utilisateur courant) et _aliasPour
// (utilisateur explicite, en lecture seule). S'ils divergeaient, un exercice
// renommé compterait dans deux muscles différents selon l'écran ouvert.
//
// ORDRE DE PRIORITÉ, à chaque saut :
//   1. EX_RENOMMAGES est consultée D'ABORD, en ce sens qu'elle s'applique
//      même sans dossier chargé : l'ancien code sortait sur `if(!a) return k`
//      et un renommage du guide n'aurait jamais eu lieu pour ces appels-là.
//   2. Mais un alias PERSONNEL qui vise explicitement une AUTRE cible
//      l'emporte. C'est une décision que le coach a prise sur SES données
//      (« ces deux exercices n'en font qu'un chez moi ») ; un renommage
//      décidé dans le guide n'a pas à la défaire dans son dos.
// `glob` n'existe que pour les tests : la production ne le passe jamais et
// travaille donc toujours sur EX_RENOMMAGES.
function _resoudreAliasChaine(k,perso,glob){
  const g=glob||EX_RENOMMAGES;
  let cur=k;
  for(let i=0;i<3;i++){
    const p=perso&&perso[cur];
    // Un alias personnel qui pointe sur lui-même ne dit rien : il ne doit pas
    // pour autant masquer le renommage du guide.
    const suiv=(p&&p!==cur)?p:g[cur];
    if(!suiv||suiv===cur) return cur;
    cur=suiv;
  }
  return cur;
}
function resoudreAlias(k){
  return _resoudreAliasChaine(k,currentUser?.exAlias);
}
// Refuse tout ajout qui refermerait une chaîne sur elle-même.
function ajouterAlias(de,vers){
  const d=exKey(de), v=exKey(vers);
  if(!d||!v||d===v) return {ok:false,msg:'Les deux exercices sont identiques.'};
  if(!currentUser.exAlias) currentUser.exAlias={};
  // v remonte-t-il déjà jusqu'à d ? Si oui, écrire d→v fermerait le cycle.
  let cur=v;
  for(let i=0;i<4;i++){
    if(cur===d) return {ok:false,msg:'Fusion refusée : elle créerait une boucle entre ces deux exercices.'};
    const suiv=currentUser.exAlias[cur]; if(!suiv||suiv===cur) break; cur=suiv;
  }
  currentUser.exAlias[d]=v;
  if(!currentUser.exCatalogVersion) currentUser.exCatalogVersion=1;
  // Les index de séance portent des clés canonicalisées : ils sont périmés.
  _aliasGen++;
  // Une fusion change la résolution musculaire de tout l'historique, donc les
  // volumes déjà calculés.
  _viderCacheVolume();
  return {ok:true};
}

// ── File « à classer » ──────────────────────────────────────────────────────
// Dérivée, jamais persistée : elle se reconstruit à chaque session.
const _exAClasser=new Set();

// ── Résolution musculaire ───────────────────────────────────────────────────
// ex : l'objet exercice complet quand on l'a, pour pouvoir écarter le cardio.
// Appelée avec le seul nom, la détection cardio est sautée plutôt que devinée.
// Écriture opportuniste : un rattachement trouvé automatiquement est mémorisé
// dans user.exMuscles avec src:'auto', ce qui évite de refaire le travail et
// laisse une trace corrigeable. Un choix manuel n'est JAMAIS réécrit.
// ── UN DOSSIER MUSCULAIRE QUI REVIENT DE FIREBASE A PERDU SES TABLEAUX VIDES ──
// La base ne stocke pas un tableau sans element : elle supprime la clef. Un
// exercice classe avec des muscles PRIMAIRES et aucun secondaire est ecrit
// {p:['pecs'],s:[]} et relu {p:['pecs']}. Tout appelant qui fait `r.s.map` leve
// alors — et c est precisement ce qui empechait Kevin d ouvrir ses seances, sur
// ses DEUX profils : le meme dossier est lu par l ecran athlete et par la fiche
// coach.
//
// C EST LA MEME CAUSE RACINE QUE LE BUG DES SEANCES corrige la veille, ou
// sessions_config revenait en objet a trous. Firebase et les tableaux, encore.
//
// ON REPARE SUR PLACE plutot que de rendre une copie : le dossier stocke est
// remis d aplomb pour de bon, et il repart correct a la prochaine ecriture. Une
// copie aurait masque le defaut a l affichage en le laissant en base, ou il
// aurait ressurgi au prochain appelant qui ne se garde pas.
//
// TROIS APPELANTS FAISAIENT .map OU .slice SANS GARDE — _ligneMuscles,
// ouvrirSelecteurMuscles et le selecteur du classement. On corrige donc a LA
// SOURCE : les deux resolveurs. Garder chaque point de chute laisserait passer
// le quatrieme.
function _normaliserMuscles(r,k){
  if(!r||typeof r!=='object') return r;
  if(!Array.isArray(r.p)) r.p=[];
  if(!Array.isArray(r.s)) r.s=[];
  // L'ANCIEN MUSCLE « TRAPEZES » (avant le 08/09/2026). migrerTrapezes ne
  // reportait que les reperes de volume : un exercice classe a l'epoque,
  // meme a la main, gardait la clef, que l'ecran affichait telle quelle
  // (« TRAPEZES ») et que le volume ne comptait nulle part. Kevin, 27/09/2026 :
  // « je ne veux plus de juste trapèze ». Un tirage ou un rowing retracte
  // l'omoplate (trapeze median) ; le reste l'eleve (trapeze superieur).
  if(r.p.indexOf('TRAPEZES')>=0||r.s.indexOf('TRAPEZES')>=0){
    const med=/\bROW|ROWING|TIRAGE (HORIZONTAL|ASSIS)|FACE PULL|OISEAU|ELEVATION Y/.test(String(k||''));
    const t=med?'TRAP_MED':'TRAP_SUP';
    const conv=l=>l.map(m=>m==='TRAPEZES'?t:m).filter((m,i,a)=>a.indexOf(m)===i);
    r.p=conv(r.p); r.s=conv(r.s).filter(m=>r.p.indexOf(m)<0);
  }
  return r;
}
// ══ R15 — LES CLASSEMENTS AUTOMATIQUES D'AVANT UNE CORRECTION DE REGLE ══
// resoudreMuscles ECRIT ce qu'il deduit dans exMuscles, et le relit ensuite
// comme un choix enregistre. Corriger la regle ne corrigeait donc personne :
// un « NORDIC CURL » deja classe BICEPS le restait pour toujours.
// On ne revient QUE sur ce que l'app a deduit (src 'auto'), jamais sur un
// choix fait a la main (src 'manuel'), et seulement pour les motifs listes
// ici, chacun avec le muscle faux qu'il a pu produire.
const EX_AUTO_REVUS=Object.freeze([
  {motif:/\bNORDIC\b/, faux:'BICEPS'}
]);
// CE QUE LE GUIDE ET LES REGLES DISENT AUJOURD'HUI, sans rien ecrire.
function _musclesDeduits(k){
  const g=_exGuide().get(k);
  if(g) return {p:g.p,s:g.s};
  for(const rg of EX_REGLES) if(rg.motif.test(k)) return {p:rg.p,s:rg.s};
  return null;
}
// ⚠ UN CLASSEMENT AUTOMATIQUE N'EST PAS UN CHOIX (27/09/2026). La liste
//   EX_AUTO_REVUS ne corrigeait que les cas qu'on pensait a y ecrire : la
//   revue des trapezes et des pull-overs (builds 1614-1615) ne touchait donc
//   aucun exercice deja rencontre — Kevin : « c'est toujours pas mis en
//   place ». Desormais, ce que l'app a DEDUIT est recalcule des que le guide
//   ou les regles disent autre chose. Un choix fait a la main ('manuel') ne
//   bouge jamais.
function _autoARevoir(k,r){
  if(!r||r.src!=='auto'||!Array.isArray(r.p)) return false;
  if(EX_AUTO_REVUS.some(x=>x.motif.test(k)&&r.p.indexOf(x.faux)>=0)) return true;
  // Devenu cardio ou pose (30/09/2026) : le guide ne le classe plus nulle part,
  // _musclesDeduits rendrait null et l'ancien classement resterait à jamais.
  if(_exGuideEstCardio(k)||_exGuideEstPosing(k)) return true;
  const d=_musclesDeduits(k);
  if(!d) return false;
  const pareil=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((m,i)=>m===b[i]);
  return !(pareil(r.p,d.p)&&pareil(r.s||[],d.s));
}
function resoudreMuscles(nom,ex){
  if(!currentUser) return null;
  let k=exKey(nom);
  if(!k) return null;
  k=resoudreAlias(k);
  const dejaVu=currentUser.exMuscles&&currentUser.exMuscles[k];
  if(dejaVu&&!_autoARevoir(k,dejaVu)) return _normaliserMuscles(dejaVu,k);
  // Cardio : aucun rattachement, et surtout pas de mise en file.
  if((ex&&isCardio(ex))||_exGuideEstCardio(k)||_exGuideEstPosing(k)) return null;
  // 1. Le guide du coach fait foi.
  const g=_exGuide().get(k);
  if(g){
    const r={p:g.p.slice(),s:g.s.slice(),src:'auto'};
    _ecrireMuscles(k,r); return r;
  }
  // 2. Repli sur les règles, dans l'ordre.
  for(const rg of EX_REGLES){
    if(rg.motif.test(k)){
      const r={p:rg.p.slice(),s:rg.s.slice(),src:'auto'};
      _ecrireMuscles(k,r); return r;
    }
  }
  // 3. Rien de sûr : on ne devine pas, on met en file.
  _exAClasser.add(k);
  return null;
}
// Création à la volée des champs : ils n'existent chez AUCUN utilisateur
// actuel, et leur absence doit rester un état valide.
function _ecrireMuscles(k,r){
  if(!currentUser.exMuscles) currentUser.exMuscles={};
  if(!currentUser.exCatalogVersion) currentUser.exCatalogVersion=1;
  currentUser.exMuscles[k]=r;
  _viderCacheVolume();
}

// Parse reps string : "10 PUIS 20", "6-8", "15 Par Jambe", "8"

// ══════════════ TECHNIQUES D'INTENSIFICATION ══════════════
// Catalogue repris MOT POUR MOT du « Guide des méthodes et des exercices de
// musculation » du coach : son nom, sa description, sa vidéo. L'application
// n'invente aucune méthode et n'en renomme aucune.
//
// « famille » est la seule chose qui pilote le COMPORTEMENT de l'app : elle
// dit ce qu'il faut afficher, ce qu'il faut saisir et ce que la série vaut au
// volume. Sept familles suffisent parce qu'elles décrivent ce que le logiciel
// doit faire de différent, pas ce que le muscle subit. Re-router une méthode
// tient en un mot.
//
// Ce catalogue ne SUGGÈRE jamais rien : il n'est lu que par le sélecteur de
// l'éditeur, qui n'est ouvert que par un coach ou par un athlète qui va
// délibérément le chercher.
// ── LE CHAMP EST UN TABLEAU DEPUIS LE 07/09/2026 ────────────────────────
// `video` (chaine) est devenu `videos` (tableau). Le guide du 06/09/2026 filme
// TROIS methodes deux fois — « Stop and go » et les deux isometries — et la
// chaine unique en perdait une a chaque fois, sans que rien ne le dise.
// videoTechnique() rend la PREMIERE pour tout le code existant : le selecteur
// de methode n'a pas eu a changer.
//
// QUATORZE METHODES N'ONT AUCUNE VIDEO, et c'est conforme au guide (« H » ou
// rien du tout). Elles portent `videos:[]`, PAS une URL inventee : une
// pastille qui n'ouvre rien est pire que pas de pastille.
const TECHNIQUES=Object.freeze({
  "dropset_type_1":{nom:"Dropset type 1",sous:"3 x 12 répétitions",famille:"degressive",desc:"Fais 12 répétitions, puis baisse la charge et, sans repos, refais 12 répétitions. Baisse une seconde fois et termine par 12 répétitions.",videos:["https://youtu.be/BeyRmP_R_d8"]},
  "dropset_type_2":{nom:"Dropset type 2",sous:"3 x 8 répétitions",famille:"degressive",desc:"Fais 8 répétitions, puis baisse la charge et, sans repos, refais 8 répétitions. Baisse une seconde fois et termine par 8 répétitions.",videos:["https://youtu.be/rYi9stYwuaU"]},
  "dropset_type_3":{nom:"Dropset type 3",sous:"100 répétitions",famille:"degressive",desc:"Prends une charge conséquente et fais le maximum de répétitions. Baisse la charge, refais le maximum, baisse encore, et continue jusqu’à un total de 100 répétitions.",videos:["https://youtu.be/aDXSxfCGYlE"]},
  "methode_5_repetitions_10_sec":{nom:"Méthode 5 répétitions / 10 secondes",sous:"",famille:"myo_reps",desc:"Fais 5 répétitions puis 10 s de repos, refais 5 répétitions, 10 s de repos, et termine par 5 répétitions.",videos:["https://youtu.be/fnifu6TSPkM"]},
  "methode_10_repetitions_10_se":{nom:"Méthode 10 répétitions / 10 secondes",sous:"",famille:"myo_reps",desc:"Fais 10 répétitions puis 10 s de repos, refais 10 répétitions, 10 s de repos, et termine par 10 répétitions.",videos:["https://youtu.be/wfuCe8SzLm4"]},
  "methode_lourd_leger":{nom:"Méthode lourd / léger",sous:"",famille:"degressive",desc:"Fais 8 répétitions lourdes, puis baisse la charge et fais 15 répétitions légères.",videos:["https://youtu.be/ScIXBxNgrCs"]},
  "rest_in_pause":{nom:"Rest in pause",sous:"",famille:"rest_pause",desc:"Une fois ta limite atteinte : 15 s de repos, puis termine ta série.",videos:["https://youtu.be/K3b7rjKt9xg"]},
  "stop_and_go":{nom:"Stop and go",sous:"",famille:"normale",desc:"Marque 2 s de repos en haut ou en bas du mouvement.",videos:["https://youtu.be/TPbobxebyNs","https://youtu.be/nnjatRNzuu8"]},
  "maximum":{nom:"Maximum",sous:"",famille:"normale",desc:"Ne compte pas tes répétitions : fais-en le maximum et va au-delà de la sensation de brûlure.",videos:["https://youtu.be/pvfzmIOnYPc"]},
  "unilaterale":{nom:"Unilatérale",sous:"",famille:"normale",desc:"Fais _ _ répétitions du côté droit puis _ _ du côté gauche. Touche le muscle qui travaille pour mieux le ressentir.",videos:["https://youtu.be/2nF1EggRxmQ"]},
  "superset":{nom:"Superset",sous:"",famille:"superset",desc:"Enchaîne 2 exercices à la suite, sans temps de repos.",videos:["https://youtu.be/i0LlHtgMTo0"]},
  "methode_curl_barre":{nom:"Méthode curl barre",sous:"",famille:"normale",desc:"Fais 10 répétitions prise serrée, 10 prise large et 10 prise largeur d’épaules, sans temps de repos.",videos:["https://youtu.be/yztTEdUz9Po"]},
  "methode_1_des_demis_repetiti":{nom:"Méthode 1 des demis répétitions",sous:"10 b/m, 10 m/h, 10 entière",famille:"partielles",desc:"Fais 10 répétitions du bas du mouvement jusqu’au milieu, puis 10 du milieu jusqu’en haut, et termine par 10 répétitions complètes.",videos:["https://youtu.be/2_Gd6MOBPL0"]},
  "methode_isometrie_type_1":{nom:"Méthode isométrie type 1",sous:"20s puis 8 reps",famille:"normale",desc:"Fais une répétition et reste 20 s contracté en haut ou en bas du mouvement, puis enchaîne 8 répétitions.",videos:["https://youtu.be/3loSbniuDNA","https://youtu.be/dB6ENEkEwhQ"]},
  "methode_isometrie_type_2":{nom:"Méthode isométrie type 2",sous:"8 reps puis 20s",famille:"normale",desc:"Sur la dernière répétition de ta série, reste 20 secondes contracté en haut ou en bas du mouvement.",videos:["https://youtu.be/OXnzVh8bKuM","https://youtu.be/UUISiSZQcUQ"]},
  "triset":{nom:"Triset",sous:"",famille:"superset",desc:"Enchaîne 3 exercices à la suite, sans temps de repos.",videos:["https://youtu.be/fI2fVawJ4DA"]},
  "fst_7":{nom:"FST 7",sous:"",famille:"myo_reps",desc:"Fais 8 à 12 répétitions. Pendant le repos, contracte 20 à 30 s les muscles travaillés, puis prends 15 s de repos et recommence.",videos:["https://youtu.be/udzloBhc8RU"]},
  "repetition_partielle":{nom:"Répétition partielle",sous:"",famille:"partielles",desc:"Ne fais pas le mouvement en entier : arrête-toi avant de tendre les bras ou les jambes.",videos:["https://youtu.be/du4tHFWQXbs"]},
  "20_10_10_20":{nom:"20/10/10/20",sous:"",famille:"normale",desc:"Fais 20 répétitions sur la première et la dernière série, et 10 sur la deuxième et la troisième.",videos:["https://youtu.be/BOljyOZbL30"]},
  "bulgare":{nom:"Bulgare",sous:"",famille:"degressive",desc:"Fais 3 répétitions à 85 % de ta charge maximale sur une répétition, puis 6 répétitions à 50 %.",videos:["https://youtu.be/oQeJBHWgKSQ"]},
  "isotention":{nom:"Isotention",sous:"3s en bas",famille:"normale",desc:"Reste 3 s en contraction en bas de ton mouvement.",videos:["https://youtu.be/CfozUMUqmKc"]},
  "isometrie_max":{nom:"Isométrie max",sous:"",famille:"isometrie",desc:"Prends une charge impossible à lever ou à pousser, et tente de la pousser ou de la tirer pendant 4 s. Repose-toi 4 s et recommence 2 fois.",videos:["https://youtu.be/nFL2bUg46z8"]},
  "methode_2_des_demis_repetiti":{nom:"Méthode 2 des demis répétitions",sous:"",famille:"partielles",desc:"Fais 1 répétition du bas du mouvement jusqu’au milieu, puis 1 complète. Les deux ne comptent que pour 1 répétition.",videos:["https://youtu.be/YMwFRdaBeP0"]},
  "methode_isometrie_type_3":{nom:"Méthode isométrie type 3",sous:"10 reps d’un côté iso de l’autre",famille:"normale",desc:"Fais 10 répétitions d’un bras pendant que l’autre reste plié et contracté, en position fixe. Inverse, puis termine par 10 répétitions avec les deux bras en même temps.",videos:["https://youtu.be/r70usBSJAr8"]},
  "methode_7_7_7":{nom:"Méthode 7/7/7",sous:"3x 7 reps 7s",famille:"normale",desc:"Fais 7 répétitions puis maintiens la charge 7 s, et enchaîne cette séquence 2 fois de plus (21 répétitions et 21 secondes au total).",videos:["https://youtu.be/Ym-coFOBAcY"]},
  "excentrique_ralentit":{nom:"Excentrique ralentit",sous:"Descente de 5 secondes",famille:"normale",desc:"Freine la descente sur 5 secondes.",videos:["https://youtu.be/CN8X-2D1eD8"]},
  "methode_trinite":{nom:"Méthode trinité",sous:"",famille:"partielles",desc:"Fais le maximum de répétitions complètes, puis sans repos le maximum de répétitions partielles (du bas ou du haut jusqu’au milieu du mouvement), et termine en maintenant la charge en haut du mouvement le plus longtemps possible.",videos:["https://youtu.be/-OjDIkIASBs"]},
  "methode_infinite":{nom:"Méthode Infinité",sous:"120 répétitions",famille:"rest_pause",desc:"Fais 12 répétitions, 12 s de repos, 24 répétitions, 24 s de repos, 36 répétitions, 36 s de repos, 50 répétitions, 50 s de repos.",videos:["https://youtu.be/t4CLx1MHGPw"]},
  "methode_sst":{nom:"Méthode SST",sous:"Patrick Tuor",famille:"degressive",desc:"Fais 6 à 8 répétitions lourdes, baisse la charge de 20 à 30 % et fais 5 répétitions en freinant la descente sur 5 s. Rebaisse de 20 à 30 %, fais 5 répétitions en freinant la montée sur 5 s, puis 5 s de repos, et termine par 20 s en maintenant la charge en bas ou en haut de l’exercice.",videos:["https://youtu.be/CqChnh7ZBnQ"]},
  "8_reps_puis_5_5s":{nom:"8 reps puis 5 / 5s",sous:"",famille:"degressive",desc:"Fais 8 répétitions, puis baisse la charge et fais 5 répétitions en freinant la descente sur 5 s.",videos:[]},
  // ══════ TREIZE METHODES DE PLUS — guide du 26/08/2026 ══════
  // Recopiees telles qu'elles sont ecrites dans le guide : ce sont des
  // textes de coaching, relus par Kevin, et les reformuler serait les
  // reecrire. AUCUNE n'a de lien video dans le guide — videos:[] et non un
  // lien invente : le selecteur n'affiche la pastille que s'il y a un lien,
  // et une pastille qui n'ouvre rien serait pire que pas de pastille.
  // La FAMILLE est ce qui compte pour le volume : chacune est rangee dans
  // l'une des sept familles existantes, on n'en cree pas une huitieme sans
  // donnee pour la ponderer.
  "prefatigue":{nom:"Pré-fatigue",sous:"",famille:"normale",desc:"Fais un exercice d'isolation juste avant le mouvement polyarticulaire pour épuiser le muscle cible avant qu'il ne soit limité par les muscles secondaires (ex : leg extension avant squat).",videos:[]},
  "repetitions_forcees":{nom:"Répétitions forcées",sous:"",famille:"normale",desc:"Une fois l'échec atteint, un partenaire t'aide légèrement à faire 2 ou 3 répétitions de plus, en soulageant juste ce qu'il faut pour que tu continues le mouvement.",videos:[]},
  "cluster_sets":{nom:"Cluster sets",sous:"séries en grappe",famille:"rest_pause",desc:"Fais 2 ou 3 répétitions lourdes, repose-toi 10 à 15 s, refais 2 ou 3 répétitions, et ainsi de suite jusqu'à 12 à 15 répétitions au total. Tu utilises ainsi une charge plus lourde que d'habitude sur un volume plus important.",videos:[]},
  "myo_reps":{nom:"Myo-reps",sous:"",famille:"myo_reps",desc:"Une série d'activation à 12-15 reps proche de l'échec, puis des mini-séries de 3-5 reps avec seulement 10-20s de repos, répétées 4-5 fois. Très efficace pour l'hypertrophie en peu de temps.",videos:[]},
  "repetitions_allongees":{nom:"Répétitions allongées",sous:"loaded stretch",famille:"partielles",desc:"Ne travaille que la portion basse, étirée, du mouvement (ex : bas du curl, bas du développé couché), avec une pause. Technique très étudiée récemment pour l'hypertrophie.",videos:[]},
  "serie_geante":{nom:"Série géante",sous:"",famille:"superset",desc:"Enchaîne 4 exercices ou plus sans repos, souvent sur le même groupe musculaire, sous différents angles.",videos:[]},
  "running_the_rack":{nom:"Running the rack",sous:"",famille:"degressive",desc:"Une variante du dropset propre aux haltères : enchaîne immédiatement plusieurs paires d'haltères de poids décroissant, sans les reposer, jusqu'à épuisement.",videos:[]},
  "negatives_pures":{nom:"Négatives pures",sous:"",famille:"normale",desc:"Charge supérieure à ton max concentrique (souvent avec assistance ou machine) : tu ne travailles que la descente, contrôlée sur 5 à 8 secondes.",videos:[]},
  "contrast_training":{nom:"Contrast training",sous:"",famille:"normale",desc:"Alterner une série lourde (3-5 reps, 85%+) avec une série explosive légère du même mouvement, pour stimuler la force et la puissance en simultané.",videos:[]},
  "reps_tricheur":{nom:"Reps tricheur",sous:"",famille:"normale",desc:"Sur les dernières répétitions, utiliser un léger élan contrôlé pour dépasser le point de blocage, tout en gardant le contrôle de la descente.",videos:[]},
  "occlusion_bfr":{nom:"Occlusion / BFR",sous:"",famille:"normale",desc:"Utilisation de bandes de compression sur le haut des membres pour restreindre partiellement le flux sanguin, permettant de travailler à charge légère (20-30%) avec un stimulus hypertrophique élevé.",videos:[]},
  "constant_tension":{nom:"Constant tension",sous:"",famille:"normale",desc:"Ne jamais tendre complètement l'articulation en haut du mouvement pour garder le muscle constamment sous tension.",videos:[]},
  "dc_training":{nom:"DC Training",sous:"",famille:"rest_pause",desc:"3 mini-séries : jusqu'à l'échec, 10-15s de repos, refaire jusqu'à l'échec, 10-15s, refaire une dernière fois. Suivi d'un « extreme stretch » : maintenir une position d'étirement maximal du muscle pendant 30-60s en fin de série pour stimuler l'hyperplasie via la tension mécanique en position allongée.",videos:[]}
});
// ══ CE QUE FAIT CHAQUE MÉTHODE, EN UNE LIGNE (01/10/2026) ═══════════════
// Kevin : « le nom de la technique, deux points, et en police beaucoup plus
// petite et plus fine l'explication ; il faut que ça tienne sur une ligne, que
// la personne sache sur quoi elle clique ». Le `desc` du catalogue est le
// texte du guide, long de deux ou trois phrases : il reste affiché, entier,
// une fois la méthode choisie. Ces résumés ne servent qu'à la LISTE : cinquante
// caractères au plus, sans rien inventer que le `desc` ne dise.
const TECHNIQUES_COURT=Object.freeze({
  "dropset_type_1":"3 × 12 reps en baissant la charge, sans repos",
  "dropset_type_2":"3 × 8 reps en baissant la charge, sans repos",
  "dropset_type_3":"max de reps, on baisse, jusqu’à 100 reps au total",
  "methode_5_repetitions_10_sec":"5 reps, 10 s de repos, trois fois",
  "methode_10_repetitions_10_se":"10 reps, 10 s de repos, trois fois",
  "methode_lourd_leger":"8 reps lourdes puis 15 reps légères",
  "rest_in_pause":"à l’échec, 15 s de repos, puis on finit la série",
  "stop_and_go":"2 s d’arrêt en haut ou en bas du mouvement",
  "maximum":"le maximum de reps, au-delà de la brûlure",
  "unilaterale":"un côté, puis l’autre",
  "superset":"2 exercices enchaînés sans repos",
  "methode_curl_barre":"10 serrée, 10 large, 10 moyenne, sans repos",
  "methode_1_des_demis_repetiti":"10 bas-milieu, 10 milieu-haut, 10 complètes",
  "methode_isometrie_type_1":"20 s contracté, puis 8 reps",
  "methode_isometrie_type_2":"20 s contracté sur la dernière rep",
  "triset":"3 exercices enchaînés sans repos",
  "fst_7":"8 à 12 reps, contraction 20 à 30 s pendant le repos",
  "repetition_partielle":"mouvement incomplet, sans tendre bras ou jambes",
  "20_10_10_20":"20 reps, 10, 10, puis 20",
  "bulgare":"3 reps à 85 %, puis 6 reps à 50 %",
  "isotention":"3 s de contraction en bas du mouvement",
  "isometrie_max":"pousser une charge immobile 4 s, trois fois",
  "methode_2_des_demis_repetiti":"une demi-rep puis une complète comptent pour 1",
  "methode_isometrie_type_3":"10 reps d’un bras, l’autre bloqué, puis les deux",
  "methode_7_7_7":"7 reps puis 7 s de maintien, trois fois",
  "excentrique_ralentit":"descente freinée sur 5 s",
  "methode_trinite":"complètes, puis partielles, puis maintien en haut",
  "methode_infinite":"12, 24, 36 puis 50 reps, repos égal en secondes",
  "methode_sst":"lourd, puis deux baisses de charge en tempo lent",
  "8_reps_puis_5_5s":"8 reps, puis 5 reps avec descente de 5 s",
  "prefatigue":"isolation juste avant le mouvement de base",
  "repetitions_forcees":"2 ou 3 reps de plus avec l’aide d’un partenaire",
  "cluster_sets":"2 à 3 reps lourdes, 10 à 15 s de repos, en boucle",
  "myo_reps":"série d’activation, puis mini-séries de 3 à 5 reps",
  "repetitions_allongees":"seulement la partie basse, étirée, du mouvement",
  "serie_geante":"4 exercices ou plus enchaînés sans repos",
  "running_the_rack":"haltères de plus en plus légers, sans les reposer",
  "negatives_pures":"seulement la descente, 5 à 8 s, charge très lourde",
  "contrast_training":"une série lourde, puis une série légère explosive",
  "reps_tricheur":"léger élan sur les dernières reps, descente tenue",
  "occlusion_bfr":"bandes de compression, charge légère à 20-30 %",
  "constant_tension":"sans jamais tendre l’articulation en haut",
  "dc_training":"3 fois à l’échec, 10-15 s entre, puis étirement"
});
// PURE. Le résumé d'une méthode, ou '' si elle n'en a pas (méthode ajoutée
// au catalogue sans son résumé : la ligne garde son nom seul).
function techniqueCourt(cle){ return TECHNIQUES_COURT[cle]||''; }
// PURE. La video a montrer pour une methode : la PREMIERE du guide, ou ''.
// Elle existe pour que le passage de `video` a `videos` ne demande rien aux
// trois endroits qui l'affichent — et pour qu'une methode sans video rende une
// chaine vide, que le rendu traite deja comme « pas de pastille ».
function videoTechnique(m){
  const v=m&&m.videos;
  return (Array.isArray(v)&&v.length&&typeof v[0]==='string')?v[0]:'';
}

const FAMILLES_TECHNIQUE=Object.freeze(['normale','degressive','rest_pause','myo_reps','superset','partielles','isometrie']);

// ══════════════ LES REGLES D'EMPLOI DES METHODES ═══════════════════════
//
// Le catalogue TECHNIQUES dit ce QU'EST une methode. Rien ne disait OU elle
// est acceptable : le coach pouvait poser un rest-pause en premiere semaine
// sur du souleve de terre, et l'application n'avait pas un mot.
//
// ⚠ TROIS ECARTS ENTRE LA FICHE ET LE CODE, ET ILS SONT TRAITES ICI PLUTOT
// QUE CONTOURNES :
//
// 1. LA FICHE PARLE DE QUATRE METHODES — dropset, rest-pause, myo-reps,
//    cluster. Le catalogue en porte QUARANTE-CINQ, rangees en sept familles.
//    Ces quatre-la sont donc trois FAMILLES (degressive, rest_pause,
//    myo_reps) plus UNE technique precise (cluster_sets). La table s'accroche
//    aux clefs qui existent deja : ecrire un second vocabulaire de methodes a
//    cote du catalogue, c'est garantir qu'ils divergeront.
//
// 2. phasesBloc SUPPOSE UN CHAMP QUI N'EXISTE PAS. Aucune phase de bloc n'est
//    stockee nulle part. Elle est DEDUITE du bloc de priorite existant : le
//    dernier tiers d'un bloc est son intensification, ce qui avant est son
//    accumulation. Sans bloc ouvert, la phase est `null` — et une phase
//    inconnue ne refuse rien. Une donnee manquante n'est pas un refus.
//
// 3. _axialContrainteLombaire NE DIT PAS SI UN EXERCICE EST AXIAL. Elle dit
//    si l'ATHLETE a une contrainte lombaire declaree. La notion d'exercice
//    axial existe ailleurs, et elle est deja partagee : chargeLombaireSchema,
//    qui lit la grille de charges articulaires du coach. C'est elle qu'on
//    reutilise — les deux servent, mais pas a la meme question, et les
//    confondre aurait fait refuser le souleve de terre uniquement aux
//    athletes deja blesses.
const METH_AXIAL_SEUIL=2;          // 2 ou 3 sur 3 : le schema charge la colonne
const METH_CHARGE_SEMAINE_MAX=6;   // au-dela, la fiche client le dit

// PURE. Un schema charge-t-il la colonne ? UNE SEULE DEFINITION, celle qui
// existait deja. `null` — pas encore juge — n'est pas axial : on ne refuse
// pas sur une case que le coach n'a pas remplie.
function methodeSchemaAxial(schema,grille){
  let v=null;
  try{ v=chargeLombaireSchema(schema,grille); }catch(e){ v=null; }
  return (typeof v==='number')&&v>=METH_AXIAL_SEUIL;
}
// PURE. L'exercice est-il axial ? Meme question, posee sur son schema.
function methodeExerciceAxial(ex,user,grille){
  let s=null;
  try{ s=schemaDe(ex,user); }catch(e){ s=null; }
  return s?methodeSchemaAxial(s,grille):false;
}
// PURE. La phase du bloc, DEDUITE — voir l'ecart n°2 ci-dessus.
// Rend 'ACCUMULATION', 'INTENSIFICATION', ou null quand aucun bloc ne court.
function phaseBloc(user,maintenant){
  let av=null;
  try{ av=blocAvancement(user,maintenant); }catch(e){ av=null; }
  if(!av||!(av.total>0)) return null;
  // Le dernier tiers, jamais moins d'une semaine : c'est la ou la cible de
  // volume approche le MRV, et donc la ou une methode d'intensification a un
  // sens. blocCibleHaut fait deja monter la charge de travail sur ce profil.
  const finales=Math.max(1,Math.ceil(av.total/3));
  return (av.semaine>av.total-finales)?'INTENSIFICATION':'ACCUMULATION';
}

// LA TABLE. Valeurs de depart, et le coach les ajuste — voir methodesRegles.
//
// `motif` PORTE LA PHRASE AFFICHEE QUAND LA REGLE REFUSE. Une regle qui
// refuse sans dire pourquoi sera contournee ou desactivee : c'est la seule
// facon dont une regle meurt.
const METHODES=Object.freeze([
  {cle:'dropset', lib:'Dropset',
   familles:['degressive'], techniques:[],
   phasesBloc:['ACCUMULATION','INTENSIFICATION'],
   axialExclu:true, patronsExclus:['halterophilie'], patronsAutorises:null,
   materielExclu:[], maxParSemaine:3, seriesConcernees:'derniere', coutFatigue:2,
   consigne:'Dropset : va au bout de la série, baisse la charge sans repos, repars aussitôt.',
   motif:'Baisser la charge à l’échec sur un mouvement qui charge la colonne, '
     +'c’est demander une technique qui n’est déjà plus là.'},
  {cle:'rest-pause', lib:'Rest-pause',
   familles:['rest_pause'], techniques:[],
   phasesBloc:['INTENSIFICATION'],
   axialExclu:true, patronsExclus:['halterophilie'], patronsAutorises:null,
   materielExclu:[], maxParSemaine:2, seriesConcernees:'derniere', coutFatigue:3,
   consigne:'Rest-pause : va à l’échec, 15 secondes de pause, repars, trois fois.',
   motif:'Aller à l’échec puis relancer deux fois demande une technique intacte : '
     +'en accumulation la fatigue s’empile déjà, et sur un mouvement axial l’échec '
     +'se paie sur le dos.'},
  {cle:'myo-reps', lib:'Myo-reps',
   familles:['myo_reps'], techniques:[],
   phasesBloc:['INTENSIFICATION'],
   axialExclu:true, patronsExclus:[],
   // ISOLATION ET MACHINES UNIQUEMENT : la liste blanche est ecrite en
   // patrons, pas en noms d'exercices, parce que c'est le patron qui dit si
   // le mouvement se relance en dix secondes sans replacer personne.
   patronsAutorises:['isolation-epaule','isolation-coude','isolation-genou',
                     'isolation-hanche','mollets-cheville'],
   materielAutorises:['MACHINE','POULIE','POULIE_HAUTE','POULIE_BASSE','PRESSE','HACK','SMITH'],
   materielExclu:[], maxParSemaine:2, seriesConcernees:'derniere', coutFatigue:2,
   consigne:'Myo-reps : une série d’activation près de l’échec, puis des mini-séries '
     +'de 3 à 5 reps toutes les 15 secondes.',
   motif:'Quinze secondes ne suffisent pas à se replacer sous une barre : la '
     +'méthode ne tient que là où l’on reste en position.'},
  {cle:'cluster', lib:'Cluster',
   familles:[], techniques:['cluster_sets'],
   phasesBloc:['ACCUMULATION'],
   // ⚠ LE SEUL A NE PAS EXCLURE L'AXIAL, ET C'EST LE PROPOS DE LA METHODE :
   // le cluster existe pour porter du lourd en fractionnant la serie.
   axialExclu:false, patronsExclus:[], patronsAutorises:null,
   materielExclu:[], maxParSemaine:2, seriesConcernees:'toutes', coutFatigue:2,
   consigne:'Cluster : 2 à 3 reps lourdes, 10 à 15 secondes de repos, on repart, '
     +'jusqu’à 12 à 15 reps au total.',
   motif:'Le cluster sert à accumuler du volume lourd : en fin de bloc il ajoute '
     +'de la fatigue là où il faudrait en retirer.'}
]);

// LES REGLES EFFECTIVES : la table, surchargee par le coach. Meme patron que
// POIDS_TECHNIQUE et que reperesEffectifs — la table de depart ne bouge
// jamais, l'ajustement vit sur le dossier.
function methodesRegles(user){
  const u=_dossier(user);
  const perso=(u&&u.methodesRegles&&typeof u.methodesRegles==='object')?u.methodesRegles:{};
  return METHODES.map(m=>{
    const p=perso[m.cle];
    if(!p||typeof p!=='object') return m;
    const o=Object.assign({},m);
    for(const k of ['maxParSemaine','coutFatigue'])
      if(typeof p[k]==='number'&&isFinite(p[k])&&p[k]>=0) o[k]=p[k];
    if(Array.isArray(p.phasesBloc)&&p.phasesBloc.length) o.phasesBloc=p.phasesBloc.slice();
    if(typeof p.axialExclu==='boolean') o.axialExclu=p.axialExclu;
    return o;
  });
}
// PURE. La regle qui couvre un exercice, ou null. LA TECHNIQUE PRECISE PASSE
// AVANT SA FAMILLE : cluster_sets est range dans la famille rest_pause, et
// c'est pourtant sa propre regle qui doit s'appliquer.
function regleMethode(ex,user){
  const cle=String((ex&&ex.methode)||'');
  if(!cle||!TECHNIQUES[cle]) return null;
  const regles=methodesRegles(user);
  for(const m of regles) if((m.techniques||[]).indexOf(cle)>=0) return m;
  const fam=TECHNIQUES[cle].famille;
  for(const m of regles) if((m.familles||[]).indexOf(fam)>=0) return m;
  return null;
}


// Contribution d'une série au volume, PAR FAMILLE.
// Aucune donnée ne permet aujourd'hui de dire ce que vaut un rest-pause en
// séries dures. 1,0 est une CONVENTION affichée comme telle, pas une mesure.
// Ne pas la transformer en valeur d'apparence précise.
const POIDS_TECHNIQUE=Object.freeze({
  normale:1.0,        // mesure
  degressive:1.0,     // convention, inchangée depuis l'origine
  rest_pause:1.0,     // CONVENTION
  myo_reps:1.0,       // CONVENTION
  superset:1.0,       // mesure : 1,0 PAR EXERCICE, donc 1,0 pour chacun des deux muscles
  partielles:1.0,     // CONVENTION
  isometrie:0.5       // CONVENTION : pas de travail mécanique au sens des répétitions
});
const TEXTE_CONVENTION_TECHNIQUE="Il n'existe pas de facteur de conversion validé pour ces techniques. Nous comptons une série dure par défaut. Tu peux l'ajuster.";
const POIDS_TECHNIQUE_MIN=0, POIDS_TECHNIQUE_MAX=2;

// Résolution de la technique d'un exercice.
// RÉTROCOMPATIBILITÉ : aucun programme existant ne porte ces champs. Un
// exercice dont reps contient « PUIS » reste une dégressive, exactement comme
// avant. La chaîne reps n'est JAMAIS réécrite, dans aucun sens.
//
// ex.ss n'entre PAS dans cette résolution : le chaînage est orthogonal à la
// méthode. Un dropset chaîné au précédent reste un dropset, et son volume vaut
// de toute façon 1,0 par exercice comme le superset.
function techniqueDe(ex){
  if(!ex) return 'normale';
  const m=ex.methode&&TECHNIQUES[ex.methode];
  if(m) return m.famille;
  if(ex.technique&&FAMILLES_TECHNIQUE.indexOf(ex.technique)>=0) return ex.technique;
  try{ if(parseReps(ex.reps).type==='degressive') return 'degressive'; }catch(e){}
  try{ if(ex.name&&EX_ISOMETRIQUES.indexOf(resoudreAlias(exKey(ex.name)))>=0) return 'isometrie'; }catch(e){}
  return 'normale';
}
function methodeDe(ex){
  return (ex&&ex.methode&&TECHNIQUES[ex.methode])?TECHNIQUES[ex.methode]:null;
}
// Poids d'une famille, surchargeable par athlète — même patron que
// user.reperesVolume. Une surcharge hors bornes est REFUSÉE : elle vient d'une
// saisie erronée, et un facteur de 40 rendrait l'écran Volume absurde.
function poidsTechniqueSurcharge(fam,user){
  const o=user&&user.poidsTechnique&&user.poidsTechnique[fam];
  return (typeof o==='number'&&isFinite(o)&&o>=POIDS_TECHNIQUE_MIN&&o<=POIDS_TECHNIQUE_MAX)?o:null;
}
function poidsTechnique(fam,user){
  const base=POIDS_TECHNIQUE[fam];
  if(base==null) return 1;
  const o=poidsTechniqueSurcharge(fam,user);
  return o!=null?o:base;
}
// Tonnage en kilos d'une série validée. Extrait de finishWorkout pour avoir
// une seule source de vérité, et pour être testable : c'est la ligne qui porte
// la contribution de la dégressive depuis l'origine, et elle ne doit pas bouger.
function tonnageSerie(s,ex){
  if(!s||!s.done) return 0;
  // Isométrie : reps est une durée. Multiplier 30 secondes par la charge
  // fabriquerait un tonnage qui ne veut rien dire.
  if(ex&&techniqueDe(ex)==='isometrie') return 0;
  // R29 — les repetitions NOTEES d'abord (repsDone, sur une fourchette), la
  // prescription sinon : la meme lecture que la performance. Sans repsDone,
  // _perfReps rend exactement repsToNumber(s.reps) — rien ne bouge.
  const r1=_perfReps(s), w1=parseFloat(s.weight||0);
  if(!(w1>0&&r1>0)) return 0;
  let v=w1*r1;
  if(s.degressive&&s.weight2) v+=parseFloat(s.weight2||0)*parseFloat(s.p2reps||0);
  return v;
}
// L'isométrie compte des SECONDES et non des répétitions : multiplier 30 s par
// la charge donnerait un tonnage inventé. On neutralise la contribution en kg
// sans toucher au comptage en séries dures, qui vaut 0,5.
function repsPourTonnage(ex){
  return techniqueDe(ex)==='isometrie'?0:repsToNumber(ex&&ex.reps);
}
// ══════════════ TEMPS DE REPOS ══════════════
// ex.repos est et reste une CHAÎNE EN TEXTE LIBRE : « 2 min », « 1 min 30 »,
// « au feeling ». On la lit, on ne la réécrit jamais, et on n'impose aucun
// format à la saisie. Ce qui n'est pas lisible n'a simplement pas de minuteur.
const REPOS_MIN=10, REPOS_MAX=600;
// Fenêtre d'affichage APRÈS l'échéance, pendant laquelle le compteur monte en
// positif. Le cahier des charges disait « 10 s » mais exigeait aussi de voir
// « +0:12 » : à 10 s le bandeau avait déjà disparu. Trente secondes couvrent
// le cas et disent quelque chose d'utile — de combien le repos a débordé —
// sans laisser le bandeau à l'écran indéfiniment.
const REPOS_DEPASSEMENT=30;
const REPOS_REEL_MIN=5;          // en dessous : saisie groupée, pas un repos
const REPOS_REEL_MAX=900;        // plafond : au-delà, ce n'est plus un repos
const REPOS_RELANCE=15;          // « 15 s de repos », valeur du guide du coach

// null signifie « pas de minuteur », JAMAIS « zéro ».
function parseRepos(str){
  if(str==null) return null;
  const s=String(str).toLowerCase()
    .replace(/ /g,' ').replace(/,/g,'.')
    .trim().replace(/\s+/g,' ');
  if(!s||!/\d/.test(s)) return null;
  let sec=null;
  // Plage « 2-3 min » ou « 2 à 3 min » : moyenne des deux bornes.
  const plage=s.match(/^(\d+(?:\.\d+)?)\s*(?:-|–|à)\s*(\d+(?:\.\d+)?)\s*([a-z]*)$/);
  if(plage){
    const moy=(parseFloat(plage[1])+parseFloat(plage[2]))/2;
    sec=/^m/.test(plage[3]||'')?moy*60:moy;
  } else {
    // « 2 min », « 2 minutes », « 1 min 30 », « 1min30 », « 1 min 30 s »
    const mm=s.match(/^(\d+(?:\.\d+)?)\s*m(?:in|n|inute)?[a-z]*\s*(?:(\d+)\s*s?[a-z]*)?$/);
    if(mm) sec=parseFloat(mm[1])*60+(mm[2]?parseInt(mm[2],10):0);
    else{
      const ss=s.match(/^(\d+(?:\.\d+)?)\s*s(?:ec|econde)?[a-z]*$/);
      if(ss) sec=parseFloat(ss[1]);
      // Un nombre NU est interprété en SECONDES. « 2 » vaut donc 2 s, sous le
      // plancher, donc null : c'est voulu, un coach qui écrit « 2 » pour deux
      // minutes écrit « 2 min » partout ailleurs dans le produit.
      else if(/^\d+(?:\.\d+)?$/.test(s)) sec=parseFloat(s);
    }
  }
  if(sec==null||!isFinite(sec)) return null;
  sec=Math.round(sec);
  return (sec<REPOS_MIN||sec>REPOS_MAX)?null:sec;
}

// ── Minuteur ────────────────────────────────────────────────────────────────
// On stocke une ÉCHÉANCE et on recalcule à chaque affichage. Un compteur qu'on
// décrémente dérive de plusieurs dizaines de secondes : setInterval est bridé
// dès que l'onglet passe en arrière-plan sur mobile, et l'écran verrouillé le
// suspend franchement. L'échéance, elle, survit à tout.
let _reposTick=null;
// LE CONTEXTE AUDIO DU REPOS, UNIQUE ET DURABLE. iOS Safari ne laisse un
// AudioContext quitter l'état « suspended » que s'il est créé ou repris
// PENDANT un geste utilisateur. Celui-ci est donc amorcé au geste, puis
// réutilisé à l'échéance — qui, elle, tombe depuis un setInterval.
//
// JAMAIS FERMÉ. close() rendrait le contexte inutilisable et le suivant
// redemanderait un geste : ce serait revenir au défaut corrigé ici. Un
// contexte inactif ne coûte rien ; c'en ouvrir un par bip qui coûtait.
let _ctxSon=null;
// AMORCE LE CONTEXTE. À N APPELER QUE DEPUIS UN GESTE UTILISATEUR.
//
// Le resume() seul ne suffit pas sur iOS : il faut qu'un son ait réellement
// été JOUÉ pendant le geste. D'où l'oscillateur de 20 ms à gain quasi nul —
// inaudible, mais c'est lui qui ouvre la voie au bip qui suivra.
//
// NE LÈVE JAMAIS : le son est un confort, et une erreur ici ne doit pouvoir
// empêcher ni la bascule de l'interrupteur, ni la validation d'une série.
function _amorcerSon(){
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return;
    // Un contexte fermé ne se reprend pas : on en refait un. Rien ne le ferme
    // ici, mais le navigateur peut le faire sous pression mémoire.
    if(_ctxSon&&_ctxSon.state==='closed') _ctxSon=null;
    if(!_ctxSon) _ctxSon=new C();
    try{ _ctxSon.resume(); }catch(e){}
    const o=_ctxSon.createOscillator(), g=_ctxSon.createGain();
    o.frequency.value=440; o.connect(g); g.connect(_ctxSon.destination);
    g.gain.setValueAtTime(0.0001,_ctxSon.currentTime);
    o.start(); o.stop(_ctxSon.currentTime+0.02);
  }catch(e){}
}
function _resteRepos(){
  if(typeof woState==='undefined'||!woState||!woState.reposFin) return null;
  return Math.round((woState.reposFin-Date.now())/1000);
}
// LES MINUTES SONT PADDEES ELLES AUSSI. Sans cela le decompte perd un
// caractere en passant sous la barre des dix minutes, et le cadran entier se
// recentre d'un demi-glyphe sous les yeux de l'athlete.
function _fmtRepos(s){
  const a=Math.abs(Math.round(s));
  return String(Math.floor(a/60)).padStart(2,'0')+':'+String(a%60).padStart(2,'0');
}
function demarrerRepos(sec,lib){
  if(!(sec>0)||typeof woState==='undefined'||!woState) return false;
  woState.reposFin=Date.now()+sec*1000;
  woState.reposTotal=sec;
  woState.reposLib=lib||'';
  woState.reposVibre=false;
  _reposDernierBat=null;
  _lancerTickRepos();
  _peindreRepos();
  woPersist();
  return true;
}
function annulerRepos(){
  if(typeof woState==='undefined'||!woState) return;
  woState.reposFin=null; woState.reposTotal=null; woState.reposLib=''; woState.reposVibre=false;
  _reposDernierBat=null;
  if(_reposTick){ clearInterval(_reposTick); _reposTick=null; }
  _peindreRepos();
  woPersist();
}
function ajusterRepos(delta){
  if(typeof woState==='undefined'||!woState||!woState.reposFin) return;
  woState.reposFin+=delta*1000;
  woState.reposTotal=Math.max(1,(woState.reposTotal||0)+delta);
  // Retirer du temps peut mettre l'échéance dans le passé : c'est légitime,
  // le dépassement prend le relais.
  if(delta>0) woState.reposVibre=false;
  _reposDernierBat=null;
  _peindreRepos();
  woPersist();
}
function _lancerTickRepos(){
  if(_reposTick) clearInterval(_reposTick);
  _reposTick=setInterval(_peindreRepos,1000);
}
// ── LE BANDEAU DE REPOS ───────────────────────────────────────────
// LA STRUCTURE EST BATIE UNE FOIS, le tick ne met plus a jour que quatre
// choses. Auparavant _peindreRepos reecrivait 2,6 ko d'innerHTML CHAQUE
// SECONDE — deux cercles SVG, quatre boutons, deux icones — soit jusqu'a 210
// reconstructions par repos et vingt-cinq repos par seance : un parse HTML,
// une mise en page et une peinture par seconde pendant trois minutes, sur un
// Android d'entree de gamme. L'anneau avancait par crans d'une seconde parce
// qu'aucune transition ne survit a un noeud detruit, et tout l'artifice du
// animation-delay negatif n'existait que pour rattraper cette destruction.
// Il disparait avec elle.
let _reposVisible=false;
// La seconde deja battue. _peindreRepos est aussi rappelee par
// visibilitychange et par ajusterRepos : sans ce drapeau, un meme tick
// battrait deux fois.
let _reposDernierBat=null;
// Le bouton son n'est reecrit que si son etat a change depuis le dernier tick.
let _reposSonRendu=null;
// LE CADRAN EST DESSINÉ DANS UN REPÈRE DE 200, quelle que soit sa taille à
// l'écran : les rayons et les épaisseurs ci-dessous sont donc des PROPORTIONS,
// et changer --rep-d ne demande de retoucher aucun nombre.
const REPOS_R=89, REPOS_C=2*Math.PI*89;
// L'éclair de la maison, à deux tailles. Un seul tracé, jamais deux.
const REPOS_BOLT='<svg viewBox="0 0 24 32" fill="currentColor" aria-hidden="true"><path d="M14.6 0 2 18h7.2L8 32 22 12h-7.6z"/></svg>';
// LES GRADUATIONS DU BAS. Quinze traits sur un arc de 44°, celui du milieu
// rouge et plus long : c'est ce qui donne l'échelle d'un instrument plutôt
// qu'un simple cercle. Calculées une fois, à la construction.
function _reposGraduations(){
  let g='';
  const n=15, r1=68, deb=-22, pas=44/(n-1);
  for(let i=0;i<n;i++){
    const mid=(i===Math.floor(n/2));
    // +180 ET NON +90 : le <svg> porte un rotate(-90deg) — indispensable pour
    // que l'arc parte de midi — et les graduations tournent avec lui. On les
    // pose donc dans le repère TOURNÉ, où le bas est à 180°.
    const a=(180+deb+i*pas)*Math.PI/180;
    const r2=r1+(mid?6:3.5);
    const x1=100+Math.cos(a)*r1, y1=100+Math.sin(a)*r1;
    const x2=100+Math.cos(a)*r2, y2=100+Math.sin(a)*r2;
    g+='<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)
      +'" stroke="'+(mid?'var(--red)':'#3a3a3a')+'" stroke-width="'+(mid?2:1.4)+'" stroke-linecap="round"/>';
  }
  return g;
}
// LES ÉCLAIRS LATÉRAUX. Décor pur : aucun événement, aucune animation, aucun
// état. Tracés une fois à la construction, puis plus jamais touchés — c'est ce
// qui autorise le flou du calque du dessous, qui n'est rastérisé qu'une fois.
// LES ÉCLAIRS LATÉRAUX. Décor pur : aucun événement, aucun état, aucune
// animation. Tracés UNE FOIS au chargement du module, puis plus jamais touchés
// — c'est ce qui autorise le flou des deux calques du dessous, rastérisé une
// seule fois et jamais recalculé.
//
// TIRÉS AU SORT, MAIS TOUJOURS LE MÊME. Un générateur à graine fixe : le tracé
// est organique sans être aléatoire d'un rendu à l'autre — un éclair qui change
// de forme à chaque repos se remarquerait, et ce décor n'a rien à dire.
// LES ÉCLAIRS LATÉRAUX. Décor pur : aucun événement, aucun état, aucune
// animation. Tracés UNE FOIS au chargement du module, puis plus jamais touchés
// — c'est ce qui autorise le flou des deux calques du dessous, rastérisé une
// seule fois et jamais recalculé.
//
// TIRÉS AU SORT, MAIS TOUJOURS LE MÊME. Un générateur à graine fixe : le tracé
// est organique sans être aléatoire d'un rendu à l'autre — un éclair qui change
// de forme à chaque repos se remarquerait, et ce décor n'a rien à dire.
// LES ÉCLAIRS LATÉRAUX. Décor pur : aucun événement, aucun état, aucune
// animation. Tracés UNE FOIS au chargement du module, puis plus jamais touchés
// — c'est ce qui autorise le flou des deux calques du dessous, rastérisé une
// seule fois et jamais recalculé.
//
// TIRÉS AU SORT, MAIS TOUJOURS LE MÊME. Un générateur à graine fixe : le tracé
// est organique sans être aléatoire d'un rendu à l'autre — un éclair qui change
// de forme à chaque repos se remarquerait, et ce décor n'a rien à dire.
//
// ── OÙ COMMENCE LE BORD DE L'ANNEAU, ET POURQUOI CE CALCUL EST ÉCRIT ICI ──
// Le calque mesure 2,55 × --rep-d de large pour un viewBox de 400 : une unité
// vaut donc 2,55·d/400 px, et le cadran — qui fait d px — occupe 400/2,55 ≈ 157
// unités, soit un RAYON DE 78. Les brins doivent naître à x = 200 ∓ 79, pas un
// pixel de moins : posés plus près, ils passent SOUS l'anneau et disparaissent.
// C'est exactement l'erreur que ce commentaire existe pour empêcher.
const REPOS_ECLAIRS=(function(){
  const CX=200, CY=75, R=79;                 // centre et bord du cadran, en unités
  let g=20260819;
  const rnd=()=>{ g=(g*1103515245+12345)&0x7fffffff; return g/0x7fffffff; };
  // Un brin : une marche le long d'une DIRECTION, avec un tremblement
  // perpendiculaire. Radial et non horizontal : un éclair qui part du cercle
  // s'en éloigne par son rayon, sinon il rase la surface et se lit comme un
  // trait posé à côté. L'amplitude vaut environ 1,6 fois le pas — au-delà le
  // trait se replie sur lui-même et donne un gribouillis, en deçà une diagonale
  // molle.
  const brin=(x,y,ux,uy,n,pas,amp)=>{
    const px=-uy, py=ux;                      // la perpendiculaire à la marche
    let d='M'+x.toFixed(1)+','+y.toFixed(1), cx=x, cy=y;
    const pts=[];
    for(let i=0;i<n;i++){
      const av=pas*(0.6+rnd()*0.8), la=(rnd()-0.5)*amp;
      cx+=ux*av+px*la; cy+=uy*av+py*la;
      // LA BANDE EST FERMÉE. Sans cette borne, une fourche part sur le titre ou
      // sur les commandes : la décharge cesse d'encadrer le cadran pour devenir
      // un décor qui traverse la carte.
      cy=Math.max(CY-56,Math.min(CY+56,cy));
      d+=' L'+cx.toFixed(1)+','+cy.toFixed(1);
      pts.push([cx,cy,ux,uy]);
    }
    return {d,pts};
  };
  const brins=[];
  // Cinq départs par côté, répartis sur la hauteur du cadran, chacun posé SUR
  // le cercle — et repartant selon SON rayon, ce qui donne l'éventail.
  [-40,-20,0,20,38].forEach((dy,i)=>{
    [-1,1].forEach(dir=>{
      const c=Math.sqrt(Math.max(1,R*R-dy*dy));
      const x=CX+dir*c, y=CY+dy;
      // LE RAYON, MAIS APLATI. Un éventail purement radial envoie des brins
      // vers le haut et vers le bas, par-dessus le titre et les commandes :
      // la maquette les tient dans une BANDE HORIZONTALE. On garde le sens du
      // rayon, on en comprime la composante verticale — 14° au plus — et on
      // ajoute un souffle pour que l'éventail ne soit pas mécanique.
      const th=Math.atan2(dy*0.45,dir*c)+(rnd()-0.5)*0.18;
      const ux=Math.cos(th), uy=Math.sin(th);
      // ASYMÉTRIQUE, PARCE QUE LA MISE EN PAGE L'EST. Le cadran vit à gauche :
      // la décharge a du champ de ce côté et bute sur les commandes de l'autre.
      // Elle porte donc loin à gauche et se retient à droite.
      const t=(dir<0)?brin(x,y,ux,uy,10,10.5,16):brin(x,y,ux,uy,6,8,15);
      brins.push({d:t.d,gros:true,lot:i%3});
      // LA RAMURE EST DENSE PRÈS DU CADRAN et se dégarnit en s'éloignant :
      // c'est ce gradient de densité, autant que le dégradé d'opacité, qui
      // fait lire une décharge plutôt qu'un trait. Les fourches sont donc
      // prises sur les DEUX PREMIERS sommets deux fois sur trois.
      for(let k=0;k<(i%2?1:2);k++){
        const p=t.pts[rnd()<.66?Math.floor(rnd()*2):2+Math.floor(rnd()*3)];
        // La fourche s'écarte du tronc de 20 à 34°, puis meurt vite.
        const ph=Math.atan2(p[3],p[2])+(rnd()<.5?-1:1)*(0.35+rnd()*0.25);
        brins.push({d:brin(p[0],p[1],Math.cos(ph),Math.sin(ph),dir<0?4:3,dir<0?8:6.5,18).d,gros:false,lot:i%3});
      }
    });
  });
  // L'ÉCLAIR S'ÉTEINT EN S'ÉLOIGNANT. Un masque en dégradé le long de l'axe, et
  // non une opacité uniforme : sans lui le trait s'arrête net et se lit comme
  // un dessin, pas comme une décharge. Les rectangles débordent en hauteur —
  // le cadran est plus haut que le viewBox, et ce qui sort ne doit pas être
  // masqué au ras du bord.
  const defs='<defs>'
    +'<linearGradient id="ecG" gradientUnits="userSpaceOnUse" x1="124" y1="0" x2="30" y2="0">'
    +'<stop offset="0" stop-color="#fff" stop-opacity="1"/>'
    +'<stop offset=".42" stop-color="#fff" stop-opacity=".5"/>'
    +'<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
    +'<linearGradient id="ecD" gradientUnits="userSpaceOnUse" x1="276" y1="0" x2="370" y2="0">'
    +'<stop offset="0" stop-color="#fff" stop-opacity="1"/>'
    +'<stop offset=".42" stop-color="#fff" stop-opacity=".5"/>'
    +'<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>'
    +'<mask id="ecM"><rect x="-40" y="-60" width="240" height="270" fill="url(#ecG)"/>'
    +'<rect x="200" y="-60" width="240" height="270" fill="url(#ecD)"/></mask></defs>';
  // Trois faisceaux, pris un départ sur trois : chacun mêle des brins du haut
  // et du bas, sinon le clignotement se lirait comme un volet qui s'ouvre.
  const couche=(lot,w,o,c,cls)=>'<g'+(cls?' class="'+cls+'"':'')+'>'+lot.map(b=>
    '<path d="'+b.d+'" fill="none" stroke="'+c+'" stroke-width="'+(b.gros?w:w*0.6).toFixed(2)
    +'" stroke-linecap="round" stroke-linejoin="round" opacity="'+o+'"/>').join('')+'</g>';
  const faisceau=(n,retard)=>{
    const lot=brins.filter(b=>b.lot===n);
    return '<g class="ec-faisceau fx-loop" style="animation-delay:'+retard+'ms">'
      + couche(lot,8,.50,'#ff1010','ec-flou')     // la nappe : large, très floue
      + couche(lot,2.8,.80,'#ff4444','ec-doux')   // la lueur, c'est elle qui fait le rouge
      + couche(lot,0.9,1,'#fff0f0','')            // le cœur, net et presque blanc
      + '</g>';
  };
  return '<svg class="rep-eclairs" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'
    + defs + '<g mask="url(#ecM)">'
    + faisceau(0,0) + faisceau(1,-900) + faisceau(2,-1700)
    + '</g></svg>';
})();
// ── LA FORME DU MINUTEUR (30/09/2026) ─────────────────────────────────────
// Compact sous 800 px de haut, ou quand un superset met deux exercices à
// l'écran ; le grand cadran sinon. Un toucher sur le décompte inverse la
// forme, pour la séance (woState._reposForme). La hauteur passe par une
// fonction : les tests la remplacent pour simuler un écran de 667 px.
const REPOS_COMPACT_SOUS=800;
function _reposHauteur(){ return window.innerHeight||0; }
function _reposEnSuperset(){
  try{
    if(typeof woState==='undefined'||!woState||!woState.exercises) return false;
    const g=_groupesEx(woState.exercises).find(x=>x.indexOf(woState.currentEx)>=0);
    return !!(g&&g.length>1);
  }catch(e){ return false; }
}
function reposCompact(){
  if(typeof woState!=='undefined'&&woState&&(woState._reposForme==='grand'||woState._reposForme==='compact'))
    return woState._reposForme==='compact';
  return _reposHauteur()<REPOS_COMPACT_SOUS||_reposEnSuperset();
}
function basculerCadranRepos(){
  if(typeof woState==='undefined'||!woState) return;
  woState._reposForme=reposCompact()?'grand':'compact';
  const b=document.getElementById('rep-bandeau');
  if(b) b.classList.toggle('rep-compact',reposCompact());
}
function _monterRepos(z){
  const _sonOn=!!(currentUser&&currentUser.sonRepos);
  _reposSonRendu=_sonOn;
  z.innerHTML=`<div id="rep-bandeau" class="rep-carte">
    <!-- L'EN-TÊTE. Le titre à gauche, un seul éclair derrière lui : placé
         AVANT le mot il se lirait comme une puce, après il se lit comme une
         signature. -->
    <div class="rep-entete">
      <span class="rep-titre" id="rep-lbl">Temps de récup</span>${REPOS_BOLT}
    </div>
    <!-- LE SON, COUPABLE SUR PLACE. Le réglage se pose une fois ; ce bouton
         sert au moment où le son dérange : quelqu'un à côté, ou les écouteurs
         qu'on vient de retirer. -->
    <button id="rep-son" class="rep-son hit44" onclick="basculerSonRepos()" aria-pressed="${_sonOn?'true':'false'}"
      aria-label="${_sonOn?'Couper le son de fin de repos':'Activer le son de fin de repos'}"
      title="${_sonOn?'Son de fin de repos activé':'Son de fin de repos coupé'}">${_icoSon(_sonOn,14)}</button>
    <div class="rep-corps">
    <div class="rep-scene" role="button" tabindex="0" onclick="basculerCadranRepos()"
      aria-label="Changer la taille du minuteur">
    <div class="rep-cadran">
      ${REPOS_ECLAIRS}
      <svg class="rep-anneau" viewBox="0 0 200 200" aria-hidden="true">
        <!-- Le liseré extérieur, puis la piste, puis l'arc. Trois cercles
             concentriques : c'est le liseré qui donne sa profondeur au cadran. -->
        <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="1.1"/>
        <circle cx="100" cy="100" r="${REPOS_R}" fill="none" stroke="#2b2b2b" stroke-width="8.5"/>
        <circle id="rep-arc" cx="100" cy="100" r="${REPOS_R}" fill="none" stroke="var(--red)" stroke-width="8.5"
          stroke-linecap="round" stroke-dasharray="${REPOS_C.toFixed(2)}" stroke-dashoffset="0"/>
        <circle cx="100" cy="100" r="75" fill="url(#repDisque)"/>
        <circle cx="100" cy="100" r="75" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="1"/>
        ${_reposGraduations()}
        <defs><radialGradient id="repDisque" cx="50%" cy="34%" r="72%">
          <stop offset="0" stop-color="#141414"/><stop offset="1" stop-color="#040404"/>
        </radialGradient></defs>
      </svg>
      <div id="rep-ronde" class="arc-ronde fx-loop" aria-hidden="true">
        <span id="rep-point" class="arc-point" style="background:var(--red);box-shadow:0 0 6px var(--red)"></span>
      </div>
      <div class="rep-centre">
        ${REPOS_BOLT}
        <div id="rep-num">0:00</div>
        <div id="rep-etat">Repos</div>
      </div>
    </div>
    </div>
    <div class="rep-actions">
      <button class="rep-btn" onclick="ajusterRepos(-15)">
        <span class="rep-btn-v">−15</span><span class="rep-btn-l">secondes</span></button>
      <button class="rep-btn" onclick="ajusterRepos(15)">
        <span class="rep-btn-v">+15</span><span class="rep-btn-l">secondes</span></button>
      <button class="rep-btn rep-btn-large" onclick="annulerRepos()">
        <span class="rep-btn-v rep-maj">Passer<span class="rep-chev">&#187;</span></span></button>
    </div>
    </div>
    <!-- R30 : LA LIGNE DU SON, au premier repos de la seance seulement. Vide et
         masquee a la construction : _peindreRepos la remplit une fois, a
         l'entree du bandeau (_reposInviteSon). SOUS les deux colonnes, jamais
         par-dessus : « Passer » reste entier. -->
    <div id="rep-invite" class="rep-invite" hidden></div>
  </div>`;
}
// LA SORTIE, puis le retrait. pointer-events coupes TOUT DE SUITE : les boutons
// ne doivent plus rien intercepter pendant les 140 ms — meme discipline que
// .arc-sortie. Jamais plus lente que l'entree.
function _reposRetirer(z){
  const c=z.firstElementChild;
  _reposDernierBat=null;
  const net=()=>{ try{ z.style.display='none'; z.innerHTML=''; z.style.pointerEvents=''; _reposVisible=false; _reposSonRendu=null; }catch(e){} };
  if(!c||arcReduit()||!c.animate){ net(); return; }
  z.style.pointerEvents='none';
  let fait=false;
  const une=()=>{ if(fait) return; fait=true; net(); };
  const a=_animer(c,[{transform:'translateY(0)',opacity:1},{transform:'translateY(8px)',opacity:0}],
    {duration:ARC.strike,easing:ARC.charge,fill:'none'});
  if(!a){ une(); return; }
  a.addEventListener('finish',une); a.addEventListener('cancel',une);
  setTimeout(une,ARC.strike+80);   // le filet
}
function _peindreRepos(){
  const z=document.getElementById('wo-repos');
  if(!z) return;
  const reste=_resteRepos();
  if(reste==null||reste<-REPOS_DEPASSEMENT){
    if(_reposTick&&(reste==null||reste<-REPOS_DEPASSEMENT)){ clearInterval(_reposTick); _reposTick=null; }
    if(reste!=null&&woState) { woState.reposFin=null; woState.reposTotal=null; }
    if(_reposVisible) _reposRetirer(z); else { z.style.display='none'; z.innerHTML=''; }
    return;
  }
  const fini=reste<=0;
  if(fini&&woState&&!woState.reposVibre){
    woState.reposVibre=true;
    // Dégradation silencieuse : iOS Safari n'expose pas vibrate, et un message
    // d'erreur pour un confort serait pire que l'absence du confort.
    // Le motif passe par arcHaptique, qui porte EXACTEMENT le même 180-90-180 :
    // deux avertissements qui se ressembleraient sans être identiques seraient
    // pires que deux avertissements franchement distincts.
    try{ arcHaptique('avertir'); }catch(e){}
    try{ if(currentUser&&currentUser.sonRepos) _bipRepos(); }catch(e){}
    // La décharge de fin, pleine largeur. Posée ici et pas dans le rendu :
    // reposVibre est déjà le drapeau « une seule fois », et le rendu, lui,
    // repasse chaque seconde. Le report d'une frame laisse au bandeau le temps
    // d'être peint — sans lui, la traversée viserait un rectangle vide.
    try{ setTimeout(()=>{ const b=document.getElementById('wo-repos');
      if(b&&b.firstElementChild) arcTraversee(b.firstElementChild,{duree:ARC.strike}); },0); }catch(e){}
  }
  z.style.display='block';
  z.style.pointerEvents='';
  // LA STRUCTURE, UNE SEULE FOIS. Le tick ne touche plus qu'aux quatre valeurs.
  let arc=document.getElementById('rep-arc');
  if(!arc){ _monterRepos(z); arc=document.getElementById('rep-arc'); }
  const num=document.getElementById('rep-num');
  const lbl=document.getElementById('rep-lbl');
  const ronde=document.getElementById('rep-ronde');
  const point=document.getElementById('rep-point');
  const bandeau=document.getElementById('rep-bandeau');
  if(bandeau) bandeau.classList.toggle('rep-compact',reposCompact());
  const etat=document.getElementById('rep-etat');
  // L'ENTREE. La hauteur se reserve tout de suite — on ne masque jamais le
  // contenu — et le CONTENU monte. Un drapeau, sinon l'animation rejouerait
  // a chaque seconde.
  if(!_reposVisible){
    _reposVisible=true;
    // R30 — le premier repos de la seance porte la ligne du son.
    try{ _reposInviteSon(); }catch(e){}
    const c=z.firstElementChild;
    if(c&&!arcReduit()&&c.animate){
      _animer(c,[{transform:'translateY(14px)',opacity:0},{transform:'translateY(0)',opacity:1}],
        {duration:180,easing:ARC.discharge,fill:'none'});
      try{ arcTraversee(c,{duree:ARC.strike}); }catch(e){}
    }
  }
  const tot=woState.reposTotal||1;
  const pc=fini?100:Math.max(0,Math.min(100,(1-reste/tot)*100));
  // LE DECOMPTE EST BLANC, l anneau porte la couleur. Le chiffre etait rouge
  // et l anneau cyan : deux teintes vives pour une seule information, et le
  // rouge — la couleur d alerte de l application — servait a un etat normal.
  // Vert a la fin : ce n est plus un decompte, c est un etat.
  const coul=fini?'var(--green)':'var(--text)';
  // ── ANIMATION 4 : L'ANNEAU ET SON POINT DE COURANT ────────────────────
  // L ANNEAU EST ROUGE. Les dix dernieres secondes le font passer au BLANC,
  // pas au violet : le decompte etant desormais blanc, le violet aurait
  // introduit une troisieme teinte sans rien dire de plus. Les DEUX signaux
  // de la fin sont conserves — la teinte change ET la cadence du point
  // double — parce que l athlete ne regarde pas son telephone et qu une
  // teinte seule ne s attrape pas du coin de l oeil.
  const AVANT_FIN=10;
  const bientot=!fini&&reste<=AVANT_FIN;
  const anneau=fini?'var(--green)':(bientot?'var(--text)':'var(--red)');
  const cad=bientot?ARC.ambient/2:ARC.ambient;
  if(arc){
    // ══ L'ANNEAU SE VIDE, IL NE SE REMPLIT PAS ═══════════════════════
    //
    // `pc` est le pourcentage ECOULE : 0 au depart, 100 a l'echeance. Le
    // decalage valait C*(100-pc)/100 — donc C au depart (trait entierement
    // masque, anneau VIDE) et 0 a la fin (trait entier, anneau PLEIN). Un
    // decompte circulaire se lit dans l'autre sens : on part d'un cercle
    // complet, et il se vide a mesure que le temps s'en va. Le chiffre du
    // centre etait juste ; c'est le repere visuel qui disait le contraire de
    // ce qu'il montrait.
    //
    // C*pc/100 : 0 au depart — trait entier, anneau PLEIN — et C a l'echeance.
    const _off=REPOS_C*pc/100;
    // ══ ET AUCUN SAUT AU PASSAGE ═════════════════════════════════════
    //
    // La transition posee en CSS fait glisser le trait d'une seconde a l'autre,
    // au lieu du cran d'un soixantieme de tour que le bandeau produisait a
    // chaque reconstruction. Mais elle ne doit PAS jouer quand le minuteur
    // REPART : le decalage retombe alors de C a 0, et l'anneau balaierait un
    // tour complet a l'envers avant de commencer a se vider.
    //
    // LE SENS DU MOUVEMENT SUFFIT A DISTINGUER LES DEUX CAS : en marche normale
    // le decalage ne fait que CROITRE. S'il diminue, c'est un depart — on pose
    // la valeur sans transition, et la seconde suivante reprend le glissement.
    const _prec=parseFloat(arc.style.strokeDashoffset);
    if(!isFinite(_prec)||_off<_prec-0.01){
      arc.style.transition='none';
      arc.style.strokeDashoffset=_off.toFixed(2);
      // Une lecture force le navigateur a appliquer la valeur AVANT de rendre
      // la transition : sans elle, les deux ecritures seraient regroupees et le
      // glissement rejouerait le retour en arriere qu'on veut eviter.
      void arc.getBoundingClientRect();
      arc.style.transition='';
    } else {
      arc.style.strokeDashoffset=_off.toFixed(2);
    }
    arc.style.stroke=anneau;
    // LE HALO SUIT LA TEINTE DE L'ARC. Deux drop-shadow sur un cadran de
    // 118 px, redessinés pendant la transition d'une seconde : la règle 3 les
    // autorise — petite surface, durée bornée, jamais « infinite ».
    arc.style.filter='drop-shadow(0 0 2px '+anneau+') drop-shadow(0 0 6px '+anneau+')';
  }
  if(point){ point.style.background=anneau; point.style.boxShadow='0 0 6px '+anneau; }
  // Le noeud n'etant plus detruit, la boucle continue d'elle-meme : le delai
  // negatif qui rattrapait la destruction n'a plus de raison d'etre.
  if(ronde&&ronde.style.animationDuration!==cad+'ms') ronde.style.animationDuration=cad+'ms';
  if(num){
    const txt=(fini?'+':'')+_fmtRepos(reste);
    num.textContent=txt;
    num.style.color=coul;
    // Six glyphes ne tiennent pas dans le disque à la taille de cinq.
    num.classList.toggle('rep-long',txt.length>5);
  }
  if(lbl) lbl.textContent=fini?'Récup terminée':'Temps de récup';
  if(etat){ etat.textContent=fini?'Terminé':'Repos'; etat.style.color=coul===''?'':anneau; }
  // La carte prend la teinte de l'état : rouge pendant, vert à l'échéance.
  if(bandeau){
    bandeau.style.borderColor=fini?'rgba(34,197,94,.35)':'rgba(255,255,255,.07)';
    bandeau.toggleAttribute('data-fini',fini);
  }
  // LE DECOMPTE BAT LES CINQ DERNIERES SECONDES. Un battement par tick, jamais
  // deux. A partir de 3 s une haptique legere tombe sur le meme battement :
  // trois pulsations courtes qui PREPARENT la vibration d'avertissement de
  // l'echeance sans jamais lui ressembler. Le battement visuel commence a 5 s
  // et non a 3 : sur iPhone, ou navigator.vibrate n'existe pas, il porte seul
  // l'information et il faut deux battements d'avance pour qu'on le remarque.
  if(!fini&&reste>0&&reste<=5&&reste!==_reposDernierBat){
    _reposDernierBat=reste;
    if(num&&!arcReduit()&&num.animate){
      _animer(num,[{transform:'scale(1)'},{transform:'scale(1.10)',offset:.38},{transform:'scale(1)'}],
        {duration:220,easing:ARC.snap,fill:'none'});
    }
    // L'HAPTIQUE SURVIT a prefers-reduced-motion : c'est le mouvement a
    // l'ecran qui declenche nausees et migraines, pas une pulsation dans la paume.
    if(reste<=3) try{ arcHaptique('legere'); }catch(e){}
  }
  // Le bouton son n'est reecrit que si son etat a change.
  const _sonOn=!!(currentUser&&currentUser.sonRepos);
  if(_sonOn!==_reposSonRendu){
    _reposSonRendu=_sonOn;
    // R30 — la ligne ne doit pas contredire l'icone qu'on vient de toucher.
    try{ _majInviteSon(_sonOn); }catch(e){}
    const b=document.getElementById('rep-son');
    if(b){
      b.setAttribute('aria-pressed',_sonOn?'true':'false');
      b.setAttribute('aria-label',_sonOn?'Couper le son de fin de repos':'Activer le son de fin de repos');
      b.setAttribute('title',_sonOn?'Son de fin de repos activé':'Son de fin de repos coupé');
      // La teinte vient de la feuille (.rep-son[aria-pressed]) : rien a
      // ecrire ici, l'attribut suffit.
      b.innerHTML=_icoSon(_sonOn,14);
    }
  }
}
// Aucun son par défaut : une salle est bruyante et l'athlète a souvent ses
// écouteurs. Le réglage existe, il est éteint.
// Le pictogramme du haut-parleur, barré quand le son est coupé. Dessiné ici
// et non deux fois : le bandeau et les réglages montrent le même état, et
// deux tracés finiraient par diverger.
function _icoSon(actif,taille){
  const t=taille||15;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    +'stroke-linecap="square" stroke-linejoin="miter" width="'+t+'" height="'+t+'" '
    +'style="display:block;flex-shrink:0" aria-hidden="true">'
    +'<path d="M11 5 6 9H2v6h4l5 4z"/>'
    +(actif
      ?'<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'
      :'<path d="m22 9-6 6"/><path d="m16 9 6 6"/>')
    +'</svg>';
}
// APPELÉ DEPUIS UN MINUTEUR, jamais depuis un geste : il ne crée donc plus
// son propre contexte, il reprend celui qu'un geste a déjà amorcé.
function _bipRepos(){
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return;
    // REPLI. Le contexte manque si le son était déjà actif au chargement et
    // qu'aucun geste n'est encore passé — un repos lancé par le minuteur
    // libre, par exemple. On en crée un : sur iOS il naîtra suspendu et
    // restera muet, comme avant ce lot, mais ailleurs le bip sortira. Ne rien
    // faire du tout serait une régression sur les plateformes qui marchaient.
    if(_ctxSon&&_ctxSon.state==='closed') _ctxSon=null;
    if(!_ctxSon) _ctxSon=new C();
    const ctx=_ctxSon;
    // Le contexte a pu être suspendu par la mise en arrière-plan de l'onglet —
    // ce qui est le cas ordinaire pendant un repos, téléphone posé.
    try{ ctx.resume(); }catch(e){}
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25,ctx.currentTime+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.35);
    o.start(); o.stop(ctx.currentTime+0.36);
    // PAS DE close() : le contexte sert au bip suivant. Les nœuds, eux, sont
    // libérés par le navigateur une fois l'oscillateur arrêté.
  }catch(e){}
}
function basculerSonRepos(){
  if(!currentUser) return;
  _ecrireSonRepos(!currentUser.sonRepos);
  toast(currentUser.sonRepos?'Son de fin de repos activé':'Son de fin de repos désactivé');
}
// R30 — L'ECRITURE DU REGLAGE, SEPAREE DE LA BASCULE. Le lien « Activer » du
// minuteur doit ALLUMER, jamais inverser : si l'icone du bandeau a deja allume
// le son entre-temps, une bascule l'eteindrait. Et il ne porte pas de toast —
// la ligne dit elle-meme « Son activé ✓ ».
// A N'APPELER QUE DEPUIS UN GESTE : c'est ici que le contexte audio s'ouvre.
function _ecrireSonRepos(actif){
  if(!currentUser) return false;
  currentUser.sonRepos=!!actif;
  // LE GESTE EST ICI, et nulle part ailleurs dans la vie du son : c'est le
  // seul moment où l'on peut ouvrir le contexte. À l'extinction, on ne touche
  // à rien — le contexte déjà amorcé resservira si le son revient.
  if(currentUser.sonRepos){
    _amorcerSon();
    // R30 — allumer casse la serie des « vue sans activer » : si le son est
    // eteint plus tard, la proposition revient pour trois seances.
    if(currentUser.vus&&typeof currentUser.vus==='object'&&currentUser.vus.reposSonVus) currentUser.vus.reposSonVus=0;
  }
  saveUser();
  // Les deux surfaces qui montrent l'état se remettent d'accord tout de suite.
  // _peindreRepos sort de lui-même quand aucun repos ne court : rien à garder
  // ici. _majSonReglages ne fait rien si l'écran de réglages n'est pas monté.
  try{ _peindreRepos(); }catch(e){}
  try{ _majSonReglages(); }catch(e){}
  return true;
}
