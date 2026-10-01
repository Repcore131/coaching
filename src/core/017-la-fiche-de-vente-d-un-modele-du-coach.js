// ══ LA FICHE DE VENTE D'UN MODELE DU COACH ════════════════════════════════
//
// `_cpvIdx` est l'index DANS LE TABLEAU coachPrograms, comme les cinq autres
// commandes de la liste. `_cpvVisuel` porte l'image choisie tant qu'elle n'est
// pas enregistree : `null` veut dire « inchangee », '' veut dire « effacee »,
// et une chaine veut dire « celle-ci ». Trois etats, parce que deux ne
// suffisent pas — sans le troisieme, ouvrir la fiche sans toucher au fichier
// aurait efface l'image a chaque enregistrement.
let _cpvIdx=null, _cpvVisuel=null;
function ouvrirVenteProgramme(idx){
  const p=((currentUser&&currentUser.coachPrograms)||[])[idx];
  if(!p){ toast('Programme introuvable.','var(--orange)'); return false; }
  _cpvIdx=idx; _cpvVisuel=null;
  const t=document.getElementById('cpv-titre');
  if(t) t.textContent=String(p.name||'Ce programme').slice(0,60);
  const g=(id,v)=>{ const z=document.getElementById(id); if(z) z.value=v==null?'':String(v); };
  const c=document.getElementById('cpv-envente');
  if(c) c.checked=progEnVente(p);
  g('cpv-prix',p.prix); g('cpv-pitch',p.pitch); g('cpv-lien',p.lienAchat);
  // Le champ fichier se vide : garder le nom d'un fichier choisi la fois
  // precedente ferait croire qu'il est deja joint.
  const f=document.getElementById('cpv-img'); if(f) f.value='';
  const err=document.getElementById('cpv-err');
  if(err){ err.style.display='none'; err.textContent=''; }
  _cpvApercu();
  _feuilleOuvrir('rc-progvente');
  return true;
}
function fermerVenteProgramme(tout_de_suite){
  _feuilleFermer('rc-progvente',tout_de_suite);
  _cpvIdx=null; _cpvVisuel=null;
}
// PURE au sens du dossier : elle lit les champs, elle n'ecrit nulle part.
function _cpvLire(){
  const v=id=>{ const z=document.getElementById(id); return z?String(z.value||''):''; };
  const c=document.getElementById('cpv-envente');
  const p=((currentUser&&currentUser.coachPrograms)||[])[_cpvIdx]||{};
  return {enVente:!!(c&&c.checked), prix:v('cpv-prix').trim(),
    pitch:v('cpv-pitch').slice(0,CPT_PITCH_MAX).trim(),
    lienAchat:v('cpv-lien').trim(),
    // `null` = pas touche, donc on garde l'image deja enregistree.
    visuel:(_cpvVisuel===null)?String(p.visuel||''):_cpvVisuel};
}
function _cpvApercu(){
  const z=document.getElementById('cpv-apercu');
  if(!z) return false;
  const v=_cpvLire();
  const p=((currentUser&&currentUser.coachPrograms)||[])[_cpvIdx]||{};
  z.innerHTML=_htmlCarteProgVitrine(Object.assign({},v,{name:p.name}))
    ||'<div class="sub" style="font-size:var(--fs-sm);padding:4px 0">Ce programme n’a pas de nom : renomme-le dans « Modifier » pour pouvoir l’afficher.</div>';
  // Le compteur de caracteres passe a l'orange au dernier dixieme : on previent
  // avant la butee, pas au moment ou la frappe cesse de repondre.
  const r=document.getElementById('cpv-reste');
  if(r){
    const reste=CPT_PITCH_MAX-String(v.pitch||'').length;
    r.textContent=reste+' caractère'+(reste>1?'s':'')+' restant'+(reste>1?'s':'');
    r.dataset.plein=(reste<=28)?'1':'0';
  }
  return true;
}
// ⚠ 320 Ko, LE MEME BUDGET QUE LA PHOTO DE VITRINE, et pour la meme raison :
// l'image part dans coach_public, que CHAQUE athlete du coach retelecharge en
// entier a chaque ouverture de son accueil. Une photo de telephone non reduite
// y couterait plusieurs megaoctets par athlete et par jour, sur un plan qui
// compte les octets descendus.
//
// LA QUALITE BAISSE PAR PALIERS jusqu'a passer sous le budget. On ne coupe pas
// la dimension : une devanture de 900 px trop compressee reste lisible, une
// devanture de 300 px ne l'est plus.
// ⚠ LE BUDGET EST UNE LIMITE DURE, PAS UN OBJECTIF. Les regles de la base
// bornent ce champ, et coach_public se publie par un PUT du profil ENTIER :
// une image trop lourde ne serait pas rognee, elle ferait rejeter la branche
// et effacerait la vitrine du coach. On descend donc jusqu'a passer, et si
// meme la derniere etape ne suffit pas, ON REFUSE L'IMAGE en le disant —
// jamais on n'en garde une qu'on sait trop grosse.
const CPV_VISUEL_ETAPES=Object.freeze([[900,.82],[900,.68],[760,.60],[620,.52],[480,.44]]);
function _cpvVisuelSousBudget(f,i,apres){
  const et=CPV_VISUEL_ETAPES[i||0];
  if(!et){
    toast('Cette image reste trop lourde même très réduite. Essaie une autre photo.','var(--orange)');
    return apres(null);
  }
  compressImage(f,et[0],et[1],b64=>{
    const max=(IMG_BUDGET_KO.photoVitrine||320)*1024;
    if(b64&&b64.length>max) return _cpvVisuelSousBudget(f,(i||0)+1,apres);
    apres(b64||null);
  },()=>{ toast('Image illisible : réessaie avec une autre','var(--orange)'); apres(null); });
}
function _cpvChoisirVisuel(input){
  const f=input&&input.files&&input.files[0];
  if(!f) return false;
  if(f.size>20*1024*1024){ toast('Image trop lourde (max 20 Mo)','var(--orange)'); return false; }
  _cpvVisuelSousBudget(f,0,b64=>{
    if(!b64) return;
    _cpvVisuel=b64;
    _cpvApercu();
  });
  return true;
}
function _cpvErreur(m){
  const z=document.getElementById('cpv-err');
  if(z){ z.textContent=m; z.style.display=''; }
  return false;
}
async function enregistrerVenteProgramme(){
  const p=((currentUser&&currentUser.coachPrograms)||[])[_cpvIdx];
  if(!p) return _cpvErreur('Programme introuvable : rouvre la fiche.');
  const v=_cpvLire();
  // LE LIEN EST REFUSE AVANT TOUTE ECRITURE, et le message dit pourquoi : un
  // champ qui refuse sans expliquer se remplit deux fois de la meme facon.
  if(v.lienAchat&&!_lienAchatValide(v.lienAchat))
    return _cpvErreur('Le lien d’achat doit commencer par https:// : c’est une page de paiement, elle ne peut pas être en clair.');
  // EN VENTE SANS LIEN : ON PREVIENT, ON NE BLOQUE PAS. Un coach peut vouloir
  // annoncer avant d'avoir sa page de paiement ; ce qu'il ne doit pas pouvoir
  // faire, c'est l'ignorer.
  if(v.enVente&&!v.lienAchat){
    const suite=await rcConfirm('Publier sans lien de paiement ?',
      'La carte s’affichera sur ta vitrine avec son nom, son pitch et son prix, '
      +'mais SANS bouton : personne ne pourra acheter. Tu pourras ajouter le lien plus tard.',
      'Publier quand même','Revenir au lien');
    if(!suite) return false;
  }
  _venteProgAppliquer(p,v);
  const local=saveUser();
  // pushProfilCoach recalcule `vitrineProgrammes` lui-meme : rien a preparer
  // ici, et aucun chemin ne peut publier une liste perimee.
  const envoi=CLOUD.pushProfilCoach(currentUser);
  toastSync(local,envoi,
    progEnVente(p)?'Programme publié sur ta vitrine ✓':'Programme retiré de ta vitrine ✓',
    'ta vitrine est');
  fermerVenteProgramme();
  loadCoachProgramsList();
  return true;
}

// LES EXERCICES D'UNE SÉANCE, RENDUS RENDABLES.
//
// MÊME CLASSE DE BUG QUE _cptSeances juste en dessous, et même correctif.
// renderProgEx lève sur trois formes de données, et les TROIS éditeurs
// l'appellent AVANT go(). L'exception remonte donc jusqu'au clic : l'écran ne
// bouge pas, rien n'est écrit nulle part, et « Modifier les exercices »
// devient un bouton bien visible qui ne fait rien, sans un mot.
//
// Les trois formes, mesurées au navigateur :
//   • une entrée nulle dans le tableau — parseReps lit ex.reps sur null ;
//   • des reps qui ne sont pas du texte — isCardio fait .toLowerCase dessus ;
//   • un « exercises » qui n'est pas un tableau — _photographierProgEx fait
//     .map dessus, avant même le rendu.
//
// AUCUN CHEMIN D'ÉCRITURE DE L'APP NE LES PRODUIT : le champ reps n'est écrit
// qu'à un seul endroit, par un input, donc toujours en texte. Elles viennent
// du STOCKAGE ou d'un import ancien. On répare donc à la LECTURE : interdire
// une écriture qui n'existe déjà plus ne réparerait aucun dossier existant.
//
// RÉPARE EN MÉMOIRE, N'ENREGISTRE RIEN. C'est la règle de l'écran du coach :
// il valide par SAUVEGARDER, puis par PUBLIER. Rend le nombre d'entrées
// réparées — 0 quand il n'y avait rien à faire, et dans ce cas la séance
// n'est pas touchée du tout.
// ══ LES REMPLAÇANTS AUTORISES D'UN EXERCICE (30/09/2026) ═══════════════
// ex.alternatives : de 0 a 3 noms, choisis par le COACH dans la banque. C'est
// la seule facon dont un athlete voit des noms de la banque au moment de
// remplacer : ils ont ete prescrits, il ne les a pas cherches (la garde de
// candidatsRemplacement ne bouge pas).
const ALTERNATIVES_MAX=3;
/** PURE. La forme seule : des chaines non vides, sans doublon, sans le nom de
 *  l'exercice lui-meme, trois au plus. Un tableau revenu de Firebase en objet
 *  a cles numeriques est remis en tableau. La BANQUE n'est pas verifiee ici :
 *  un nom renomme dans le guide ne doit pas disparaitre en silence d'un
 *  programme. Elle l'est a la saisie du coach (_altAjouter). */
function normaliserAlternatives(v,nomEx){
  let l=Array.isArray(v)?v:(v&&typeof v==='object'?Object.keys(v).sort((a,b)=>a-b).map(k=>v[k]):[]);
  const vus=new Set(); let k0=''; try{ k0=exKey(nomEx||''); }catch(e){ k0=''; }
  const out=[];
  for(const x of l){
    const n=String(x==null?'':x).replace(/\s+/g,' ').trim().slice(0,80);
    let k=''; try{ k=exKey(n); }catch(e){ k=''; }
    if(!n||!k||k===k0||vus.has(k)) continue;
    vus.add(k); out.push(n);
    if(out.length>=ALTERNATIVES_MAX) break;
  }
  return out;
}
/** PURE. Le nom tel qu'il est ecrit dans la banque, ou '' s'il n'y est pas. */
function nomDeBanque(nom){
  let k=''; try{ k=exKey(nom); }catch(e){ k=''; }
  if(!k) return '';
  return _nomsRemplacement().find(n=>exKey(n)===k)||'';
}
function _assainirExercices(seance){
  if(!seance||typeof seance!=='object') return 0;
  if(!Array.isArray(seance.exercises)){ seance.exercises=[]; return 0; }
  let repares=0;
  const propres=[];
  for(const ex of seance.exercises){
    if(!ex||typeof ex!=='object'||Array.isArray(ex)){ repares++; continue; }
    // `'reps' in ex` et non `ex.reps` : on ne CRÉE pas le champ chez un
    // exercice qui ne l'a jamais porté — son absence ne casse rien, tous les
    // lecteurs écrivent `(ex.reps||'')`. On ne réécrit que ce qui casse.
    if(('reps' in ex)&&typeof ex.reps!=='string'){
      ex.reps=(ex.reps==null)?'':String(ex.reps);
      repares++;
    }
    // LES REMPLAÇANTS SONT GARDES, remis en forme seulement s'il le faut.
    if('alternatives' in ex){
      const a=normaliserAlternatives(ex.alternatives,ex.name);
      if(!a.length){ delete ex.alternatives; repares++; }
      else if(JSON.stringify(a)!==JSON.stringify(ex.alternatives)){ ex.alternatives=a; repares++; }
    }
    propres.push(ex);
  }
  if(propres.length!==seance.exercises.length) seance.exercises=propres;
  return repares;
}
// LA GRILLE DE SÉANCES, RENDUE PARCOURABLE.
//
// LE BUG QU'ELLE FERME, ET IL EST SILENCIEUX DE BOUT EN BOUT. Firebase RTDB
// ne stocke pas de tableaux : il stocke des objets à clefs numériques, et il
// ne rend un TABLEAU à la lecture que si les clefs forment une suite pleine
// à partir de 0. Une seule case tombée — Firebase supprime toute valeur
// nulle, et un jour de repos réduit à rien en est une — et le dossier
// revient avec `sessions_config` en OBJET, `{0:…, 3:…}`.
//
// Trois lecteurs faisaient alors une méthode de tableau sur un objet :
//   • _seancesCoachRendre → `sc.some(…)`, AVANT go() : le coach appuie sur
//     « Gérer le programme » et rien ne se passe. La fonction appelante est
//     `async`, donc l'exception part en rejet de promesse non traité — pas
//     même une ligne rouge visible selon le navigateur ;
//   • loadCoachSessionSlots → `sessions.map(…)` : l'écran s'ouvre mais la
//     grille n'est pas remplacée, et le coach lit les séances de l'athlète
//     PRÉCÉDENT en croyant lire celles de celui qu'il vient d'ouvrir ;
//   • loadSessionManager, côté athlète, pour la même raison.
//
// Et le dossier n'est pas abîmé pour autant : les séances sont toutes là,
// c'est leur EMBALLAGE qui a changé de forme en passant par le réseau. On le
// remet donc à l'endroit à la lecture, une fois, au plus près du dossier.
//
// GARANTIT SEPT CRÉNEAUX, comme _cptSeances le fait pour les modèles, et
// assainit chacun au passage. Rend le tableau, toujours.
//
// `rapport` est FACULTATIF : un objet dont .repares est incrémenté de ce qui a
// vraiment été réparé. L'appelant qui doit décider d'un enregistrement s'en
// sert au lieu de comparer deux sérialisations de la grille — celle-ci porte
// les photos de séance en base64, et la sérialiser deux fois à chaque
// ouverture d'écran coûterait plusieurs mégaoctets de travail pour rien.
function _normaliserSessionsConfig(dossier,rapport){
  const _noter=n=>{ if(rapport&&n) rapport.repares=(rapport.repares||0)+n; };
  if(!dossier||typeof dossier!=='object') return [];
  // N3.4 — LA STRUCTURE EST REMISE A PLAT PAR _aplatirSessionsConfig, une
  // seule definition pour toute l'app. Ce qui reste ici est ce qu'elle ne fait
  // pas, et ne doit pas faire a chaque lecture : creer les sept jours,
  // assainir les exercices, et COMPTER les reparations pour le rapport.
  let cfg=dossier.sessions_config;
  if(!Array.isArray(cfg)){
    _aplatirSessionsConfig(dossier);
    cfg=Array.isArray(dossier.sessions_config)?dossier.sessions_config:[];
    _noter(1);
  }
  DAYS.forEach((day,i)=>{
    if(!cfg[i]||typeof cfg[i]!=='object'){
      cfg[i]={day,name:'',photo:null,exercises:[],active:false,notes:'',warmup:''};
      _noter(1);
    }
    if(!cfg[i].day){ cfg[i].day=day; _noter(1); }
    _noter(_assainirExercices(cfg[i]));
  });
  // Au-delà des sept jours — un import ancien en portait parfois plus — on ne
  // JETTE rien : on assainit et on laisse. Supprimer une séance qu'un coach a
  // peut-être écrite serait une perte, et sept créneaux suffisent à l'écran.
  for(let i=DAYS.length;i<cfg.length;i++){
    if(!cfg[i]||typeof cfg[i]!=='object'){ cfg[i]={day:'',name:'',photo:null,exercises:[],active:false,notes:'',warmup:''}; _noter(1); }
    _noter(_assainirExercices(cfg[i]));
  }
  dossier.sessions_config=cfg;
  return cfg;
}
// CE QU'ON DIT QUAND L'ÉDITEUR NE S'OUVRE PAS.
//
// Les trois éditeurs montent leur écran — copie des exercices, champs du
// formulaire, contexte, titre, rendu — AVANT d'appeler go(). C'est voulu :
// entrer dans s-coach-program pour y trouver la séance précédente serait pire
// qu'un bouton qui ne répond pas. Mais tant que ce montage n'était protégé
// par rien, la moindre exception au milieu remontait jusqu'au gestionnaire de
// clic, et le bouton devenait muet.
//
// N'AVALE PAS L'ERREUR : la console garde la pile entière, le coach lit de
// quoi la rapporter.
// LE DETAIL VA A L ECRAN, PAS SEULEMENT EN CONSOLE. Sur un telephone, la
// console n est pas atteignable : « signale-le, la console en garde le detail »
// demandait a l athlete quelque chose qu il ne pouvait pas faire. Le message
// portait donc la panne sans jamais permettre de la nommer — trente-trois
// reproductions a l aveugle plus tard, c est ce qui manquait.
//
// CE QU ON AJOUTE : le NOM de l erreur, et la PREMIERE LIGNE DE PILE, qui
// porte le fichier et le numero de ligne. C est ce qui transforme un rapport
// en correctif.
//
// ET IL SE COPIE. Le detail est aussi pose dans le presse-papier quand le
// navigateur le permet : recopier a la main « TypeError ... index.html:24907 »
// depuis un ecran de telephone est une epreuve, et une transcription fausse
// envoie chercher au mauvais endroit.
function _detailErreurEditeur(e){
  const nom=(e&&e.name)||'Erreur';
  const msg=(e&&e.message)||'erreur inconnue';
  let ou='';
  try{
    const l=String((e&&e.stack)||'').split(String.fromCharCode(10))
      .map(x=>x.trim()).filter(x=>x&&x.indexOf('at ')===0)[0]||'';
    // On ne garde que le dernier segment : le chemin complet du fichier tient
    // trois lignes sur un telephone et n apprend rien de plus.
    ou=l?l.replace(/.*\//,'').replace(/\)$/,''):'';
  }catch(_e){}
  return nom+' : '+msg+(ou?' ('+ou+')':'');
}
function _echecOuvertureEditeur(e){
  const detail=_detailErreurEditeur(e);
  try{ console.error("Ouverture de l'éditeur d'exercices impossible",e); }catch(_e){}
  try{ if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(detail).catch(()=>{}); }catch(_e){}
  try{ toast("Cette séance n'a pas pu être ouverte. "+detail
    +" : détail copié, envoie-le à ton coach.","var(--red)"); }catch(_e){}
}
// LES SEANCES D UN MODELE, PAR GENRE — ET GARANTIES EXISTANTES.
//
// Six fonctions ecrivaient le meme ternaire, et QUATRE plantaient si le jeu
// demande manquait : un modele cree avant que les deux genres existent, ou
// importe par un autre chemin, n a que sessions_H. Le rendu levait alors une
// exception AVANT d avoir remplace le contenu du conteneur : les boutons de
// l onglet precedent restaient a l ecran, et les cliquer relevait la meme
// exception. Un bouton bien visible qui ne fait rien, sans un mot.
//
// Cette fonction SELECTIONNE et NORMALISE d un seul geste. Les appelants ne
// peuvent plus diverger, et aucun ne peut plus recevoir undefined.
function _cptSeances(p,genre){
  if(!p) return null;
  const cle=(genre==='H')?'sessions_H':'sessions_F';
  // `p[cle]=[]` EFFACAIT LE MODELE. Le garde-fou visait `undefined` — un modele
  // cree avant que les deux genres existent — et il avait raison pour ce
  // cas-la. Mais un objet a trous rendu par Firebase n'est pas un tableau non
  // plus, et il tombait dans la meme branche : sept jours de travail remplaces
  // par un tableau vide, puis graves au premier Sauvegarder.
  //
  // ON RECONSTRUIT PAR POSITION, comme pour sessions_config. Les trous sont
  // gardes : l'indice est le jour.
  if(p[cle]&&!Array.isArray(p[cle])&&typeof p[cle]==='object')
    _aplatirChamp(p,cle,64,true);
  // ET ON REFUSE DE VIDER CE QUI NE L'ETAIT PAS. C'est le filet de derniere
  // main : si une forme qu'on n'a pas prevue arrivait ici, elle ne doit pas
  // pouvoir effacer le travail du coach en silence. On compte AVANT ce qui
  // ressemble a du contenu, et on refuse de rendre un jeu vide a la place.
  const _avant=_cptContenu(p[cle]);
  if(!Array.isArray(p[cle])){
    if(_avant){
      // On ne touche a rien : mieux vaut un ecran qui ne s'affiche pas qu'un
      // modele efface. Et on le DIT — c'est la seule facon que le coach ne
      // reecrive pas par-dessus.
      try{ toast('Ce modèle n’a pas pu être lu et n’a PAS été modifié. Recharge la page ; s’il manque encore, dis-le avant d’enregistrer.','var(--red)'); }catch(e){}
      console.error('[RepCore] modèle illisible, écrasement refusé :',cle,p[cle]);
      return null;
    }
    p[cle]=[];
  }
  const t=p[cle];
  DAYS.forEach((day,i)=>{
    if(!t[i]) t[i]={day,name:'',active:false,photo:null,exercises:[],notes:'',warmup:''};
    _assainirExercices(t[i]);
  });
  // LE CONTENU N'A PAS PU DISPARAITRE EN CHEMIN. Les sept jours vides ajoutes
  // ci-dessus sont normaux ; perdre ce qui existait ne l'est pas.
  if(_avant&&!_cptContenu(t)){
    try{ toast('Ce modèle n’a pas pu être lu et n’a PAS été modifié. Recharge la page avant d’enregistrer.','var(--red)'); }catch(e){}
    console.error('[RepCore] modèle vidé par la normalisation, refusé :',cle);
    return null;
  }
  return t;
}
// PURE. Y a-t-il du travail la-dedans ? Un jeu de sept jours vides n'est pas du
// contenu — c'est ce que rend un modele neuf. Un seul exercice, un seul nom de
// seance, un seul jour actif suffit.
function _cptContenu(v){
  if(!v||typeof v!=='object') return 0;
  const l=Array.isArray(v)?v:Object.keys(v).map(k=>v[k]);
  let n=0;
  for(const s of l){
    if(!s||typeof s!=='object') continue;
    if((Array.isArray(s.exercises)&&s.exercises.length)
      ||(s.name&&String(s.name).trim())
      ||s.active===true
      ||(s.notes&&String(s.notes).trim())) n++;
  }
  return n;
}
// N4.4 — REPORTER UN ONGLET DE GENRE SUR L'AUTRE.
// Un modele porte DEUX jeux de sept seances, sessions_H et sessions_F, tenus
// separes par _cptSeances. Rien ne permettait de reporter le travail de l'un
// sur l'autre : le coach qui avait fini l'onglet HOMME refaisait tout dans
// l'onglet FEMME, exercice par exercice.
//
// COPIE PROFONDE, ET RIEN D'AUTRE. Le fichier a deja eu ce bug — voir le
// commentaire de saveCoachSessionsAsTemplate : sans clone, un tableau imbrique
// restait partage entre les deux onglets, et modifier la copie modifiait la
// source. On repasse par JSON, comme lui.
//
// RIEN N'EST ECRIT AVANT « SAUVEGARDER ». C'est la regle de cet ecran, posee
// par cptCopyDay : le report vit dans currentUser.coachPrograms en memoire, et
// le bouton d'enregistrement de l'ecran le persiste comme le reste.
async function cptReporterGenre(){
  if(_editProgTemplateIdx===null) return false;
  const p=(currentUser.coachPrograms||[])[_editProgTemplateIdx];
  if(!p) return false;
  const src=_editProgTemplateGender, dst=(src==='H')?'F':'H';
  const lS=(src==='H')?'HOMME':'FEMME', lD=(dst==='H')?'HOMME':'FEMME';
  const a=_cptSeances(p,src)||[], b=_cptSeances(p,dst)||[];
  const nSrc=a.filter(s=>s&&s.active&&(s.exercises||[]).length).length;
  if(!nSrc){ toast('L’onglet '+lS+' n’a aucune séance à reporter.','var(--orange)'); return false; }
  // CONFIRMATION QUAND LA DESTINATION PORTE DEJA QUELQUE CHOSE, comme
  // _confirmerEcrasement le fait pour un jour. Un report qui efface en silence
  // le travail de l'autre onglet serait pire que pas de report du tout.
  const nDst=b.filter(s=>s&&s.active&&(s.exercises||[]).length).length;
  const nl=String.fromCharCode(10);
  let txt='Reporter les '+nSrc+' séance'+(nSrc>1?'s':'')+' de l’onglet '+lS
    +' vers l’onglet '+lD+' ?';
  if(nDst) txt+=nl+nl+'L’onglet '+lD+' porte déjà '+nDst+' séance'+(nDst>1?'s':'')
    +' : elle'+(nDst>1?'s seront remplacées':' sera remplacée')+'.';
  txt+=nl+nl+'Rien n’est enregistré tant que tu n’as pas appuyé sur « Enregistrer ».';
  if(!await rcConfirm(txt,null,'Reporter')) return false;
  const cle=(dst==='H')?'sessions_H':'sessions_F';
  p[cle]=a.map(s=>({
    day:s.day,name:s.name||'',active:!!s.active,notes:s.notes||'',
    warmup:s.warmup||'',cooldown:s.cooldown||'',photo:null,photo2:null,
    exercises:JSON.parse(JSON.stringify(s.exercises||[]))
  }));
  // On BASCULE sur l'onglet destination : le coach vient de le remplir, c'est
  // lui qu'il veut relire et ajuster.
  loadProgTemplateSlots(dst);
  toast('Reporté vers '+lD+'. Appuie sur « Enregistrer » pour le garder.');
  return true;
}
function loadProgTemplateSlots(gender){
  _editProgTemplateGender=gender;
  if(_editProgTemplateIdx===null) return;
  const p=currentUser.coachPrograms[_editProgTemplateIdx];
  const sessions=_cptSeances(p,gender);
  if(!sessions) return;
  const tH=document.getElementById('cpt-tab-h'),tF=document.getElementById('cpt-tab-f');
  if(tH){tH.style.color=gender==='H'?'var(--red)':'var(--sub)';tH.style.borderBottomColor=gender==='H'?'var(--red)':'transparent';}
  if(tF){tF.style.color=gender==='F'?'var(--red)':'var(--sub)';tF.style.borderBottomColor=gender==='F'?'var(--red)':'transparent';}
  // N4.4 — LE REPORT D UN GENRE VERS L AUTRE, en tete de la liste. Le libelle
  // nomme les deux onglets : « reporter » sans dire dans quel sens obligerait
  // a essayer pour savoir.
  try{ renderPropagationEntree(); }catch(e){}
  const zr=document.getElementById('cpt-report');
  if(zr) zr.innerHTML=`<button class="btn btn-outline btn-sm" onclick="cptReporterGenre()" style="width:100%;margin:0 0 14px;letter-spacing:1px;font-size:var(--fs-2xs)">Reporter ${gender==='H'?'HOMME → FEMME':'FEMME → HOMME'}</button>`;
  const container=document.getElementById('cpt-session-slots');if(!container)return;
  container.innerHTML=sessions.map((s,i)=>`
    <div style="background:var(--surface-1);border-radius:var(--r-4);margin-bottom:14px;overflow:hidden;border:1.5px solid ${s.active?'var(--red)':'var(--border)'}">
      <div style="background:${s.active?'linear-gradient(135deg,#1a0000,#2a0000)':'var(--surface-2)'};padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:${s.active?'var(--red)':'var(--surface-2)'};border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;flex-shrink:0">${DAY_ICONS[i]}</div>
          <div>
            <div style="font-weight:800;font-size:var(--fs-lg)">${s.day}</div>
            <div class="sub" style="font-size:var(--fs-xs);margin-top:1px">${s.active?(escapeHtml(s.name)||'Séance sans nom'):'Jour de repos'}</div>
          </div>
        </div>
        <div onclick="cptToggleDay(${i})" style="width:44px;height:24px;border-radius:var(--r-3);background:${s.active?'var(--red)':'var(--border)'};position:relative;cursor:pointer;flex-shrink:0" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
          <div style="position:absolute;width:18px;height:18px;border-radius:var(--r-2);background:#fff;top:3px;left:${s.active?'23px':'3px'}"></div>
        </div>
      </div>
      ${s.active?`
      <div style="padding:14px 16px">
        <div style="margin-bottom:12px">
          <label style="margin-top:0">Nom de la séance</label>
          <input value="${escapeHtml(s.name||'')}" placeholder="Ex: PECS & TRICEPS" onchange="cptRenameSession(${i},this.value)" style="margin-top:4px">
        </div>
        <button class="btn btn-red btn-sm" style="width:100%" onclick="openProgTemplateSessionExercises(${i})"> Modifier les exercices (${s.exercises?.length||0})</button>
        ${_boutonsCopieJour('cptCopyDay',i)}
      </div>`:''}
    </div>
  `).join('');
}

// ── Copier une séance sur un autre jour ─────────────────────────────────────
// Rangée de boutons compacts, aucun écran nouveau. Les six autres jours en
// initiales : à 375 px un menu déroulant coûterait deux appuis de plus.
// ══════ N4.17 — PORTER UNE SEANCE CHEZ UN AUTRE ATHLETE ═══════════════════
// Les boutons « Copier vers » ne travaillaient qu'entre les sept jours d'un
// MEME athlete. Pour porter une seule seance chez un autre, il fallait
// enregistrer les sept jours comme modele, le nommer, puis l'appliquer chez
// l'autre — ce qui ecrase ses sept jours. Deux ecrans, une saisie, et le tout
// ou rien sur la semaine entiere pour une seance.
//
// LA COPIE ATTERRIT DANS LE BROUILLON DU DESTINATAIRE, PAS CHEZ LUI. C'est la
// regle de cet ecran et elle ne bouge pas : seul saveCoachSessions publie. Le
// coach retrouvera la seance a l'ouverture du programme de l'autre athlete,
// avec le bandeau de reprise que le brouillon declenche deja.
//
// ON REUTILISE dupliquerSeance : elle sait deja la copie profonde, le nom
// unique dans la semaine d'arrivee, et le fait de ne PAS recopier la photo —
// du base64 qui doublerait le poids du dossier pour une image identique.
function _cibleCopieAthlete(){
  const users=DB.get('users')||{};
  return Object.values(users)
    .filter(u=>_estMonAthlete(u,currentUser)&&u.id!==currentClientId&&u.email)
    .sort((a,b)=>((a.fname||'')+(a.lname||'')).localeCompare((b.fname||'')+(b.lname||'')));
}
async function copierSeanceVersAthlete(i){
  const src=_coachEditClient&&(_coachEditClient.sessions_config||[])[i];
  if(!src||!src.active||!((src.exercises||[]).length)){
    toast('Ce créneau est vide : rien à porter.','var(--orange)'); return false;
  }
  const cibles=_cibleCopieAthlete();
  if(!cibles.length){ toast('Aucun autre athlète à qui porter cette séance.','var(--orange)'); return false; }
  const nl=String.fromCharCode(10);
  const liste=cibles.map((a,n)=>(n+1)+'. '+(((a.fname||'')+' '+(a.lname||'')).trim()||a.email)).join(nl);
  const rep=await rcSaisie('Porter « '+(src.name||DAYS[i])+' » chez qui ?'+nl+nl
    +liste+nl+nl+'Écris le numéro.','',{libelleOk:'Choisir',inputmode:'numeric'});
  const n=parseInt(String(rep||'').trim(),10);
  if(!isFinite(n)||n<1||n>cibles.length) return false;
  const dest=cibles[n-1];
  const nom=((dest.fname||'')+' '+(dest.lname||'')).trim()||dest.email;
  // LE JOUR D'ARRIVEE. Le meme par defaut : porter le lundi de l'un sur le
  // lundi de l'autre est ce qu'on veut neuf fois sur dix.
  const jr=await rcSaisie('Quel jour chez '+nom+' ?'+nl+nl
    +DAYS.map((d,k)=>(k+1)+'. '+d).join(nl),String(i+1),
    {libelleOk:'Porter',inputmode:'numeric'});
  const j=parseInt(String(jr||'').trim(),10)-1;
  if(!isFinite(j)||j<0||j>=DAYS.length) return false;
  // LE BROUILLON DU DESTINATAIRE, ou son dossier s'il n'en a pas encore.
  const base=_brouillonSessionsDe(dest)||_normaliserSessionsConfig(dest).map(s=>JSON.parse(JSON.stringify(s)));
  const dst=base[j];
  if(dst&&dst.active&&((dst.exercises||[]).length)){
    if(!await rcConfirm('Chez '+nom+', '+DAYS[j]+' porte déjà « '+(dst.name||'une séance')
      +' » et ses '+(dst.exercises||[]).length+' exercices.'+nl+nl+'La remplacer ?',null,'Remplacer')) return false;
  }
  // dupliquerSeance travaille DANS un tableau : on y pose la source le temps
  // de la copie, sur un creneau qu'on retire ensuite.
  const atelier=base.slice();
  atelier.push(JSON.parse(JSON.stringify(src)));
  const r=dupliquerSeance(atelier,atelier.length-1,j);
  atelier.pop();
  if(!r.ok){ toast(r.raison,'var(--orange)'); return false; }
  // LE NOM GARDE LE SIEN QUAND IL EST LIBRE. _nomSeanceLibre ajoute TOUJOURS
  // une lettre : elle est faite pour dupliquer DANS une meme semaine, ou le
  // nom de base est par construction deja pris. Porter chez quelqu'un d'autre
  // est un autre geste — « Haut du corps » arrivait en « Haut du corps B »
  // alors que rien de ce nom n'existait dans sa semaine. On ne suffixe que
  // s'il y a vraiment un homonyme.
  const _voulu=String(src.name||'').trim();
  const _pris=atelier.some((s,k)=>k!==j&&s&&s.name
    &&String(s.name).trim().toUpperCase()===_voulu.toUpperCase());
  atelier[j].name=(_voulu&&!_pris)?_voulu:_nomSeanceLibre(atelier,src.name,j);
  r.nom=atelier[j].name;
  if(!_poserBrouillonSessions(dest,atelier)){
    toast('Brouillon non enregistré : stockage plein.','var(--red)'); return false;
  }
  try{ saveUser(); }catch(e){}
  toast('« '+r.nom+' » portée chez '+nom+' en brouillon. Publie depuis son programme.','var(--success)');
  return true;
}
// Le brouillon d'un athlete, tel que enregistrerBrouillon l'ecrit — meme
// stockage, meme forme. Rendre null et non un tableau vide : « pas de
// brouillon » et « brouillon vide » ne sont pas la meme chose.
function _brouillonSessionsDe(dest){
  try{
    const b=_brouillons(currentUser)[dest.id];
    return (b&&Array.isArray(b.sessions_config))
      ?b.sessions_config.map(s=>JSON.parse(JSON.stringify(s))):null;
  }catch(e){ return null; }
}
function _poserBrouillonSessions(dest,cfg){
  try{
    _brouillons(currentUser)[dest.id]={
      at:Date.now(),
      nom:dest.fname||'',
      sessions_config:cfg.map(sc=>({
        day:sc.day, name:sc.name||'', active:!!sc.active, notes:sc.notes||'',
        warmup:sc.warmup||'', cooldown:sc.cooldown||'', deload:!!sc.deload,
        exercises:(sc.exercises||[]).map(e=>Object.assign({},e))
      }))
    };
    _brouillonsElaguer(currentUser);
    return true;
  }catch(e){ return false; }
}
// ══════ N4.1 — LE BLOC DE PLUSIEURS SEMAINES SE CREE ENFIN ════════════════
// user.programme = {debut, semaines, decharges, ecarts} etait documente et lu
// par QUATRE fonctions — programmeDe, indexSemaineBloc, getSemaineEffective,
// semainesDuBloc — et ECRIT PAR AUCUNE : aucune ligne du fichier ne le creait.
// Un bloc de quatre semaines coutait donc quatre fois la manoeuvre complete,
// plus une republication a la main chaque lundi.
//
// AUCUN CHAMP NOUVEAU. On se sert exactement de la forme deja documentee, y
// compris des ecarts par semaine, pour que les quatre lecteurs fonctionnent
// sans etre touches. sessions_config reste le GABARIT et ne change pas de
// forme : le bloc dit sur combien de semaines il court et lesquelles sont des
// decharges, il ne duplique pas le programme.
//
// RIEN N'ATTEINT L'ATHLETE SANS PUBLIER — comme tout ce qui se regle sur cet
// ecran. Le bloc est ecrit dans le dossier par le meme chemin que le reste,
// horodate, et pousse.
// ══ LOT T7 : LE BILAN DE FIN DE BLOC (29/09/2026) ════════════════════════
// Ce qui s'est passé pendant un bloc (user.programme, N4.1), sur une page :
// le cadre, les séries dures par muscle situées sur MEV / MAV / MRV, l'e1RM
// des exercices vus au moins trois fois, les douleurs au-delà du seuil dur
// existant (SIG_PAIN_SEUIL), et une phrase.
//
// ⚠ ELLE NE NOTE PAS LE BLOC. Ni note, ni score, ni « réussite » : elle montre
//   ce qui s'est passé, le jugement appartient au coach. Elle ne propose pas
//   non plus le bloc suivant.
// ⚠ AUCUN CHIFFRE NOUVEAU : volumeSemaine (les séries dures d'une semaine),
//   reperesEffectifs (MEV, MAV, MRV), e1rm et _perfRir (comme les records),
//   _seriesDouloureuses et SIG_PAIN_SEUIL (comme les signaux).
// ⚠ UN BLOC EN COURS OU RETIRÉ AVANT SA FIN est lu jusqu'à maintenant : les
//   semaines comptées sont celles déjà commencées, et la page le dit.
const BILAN_BLOC_MIN_SEANCES_EXO=3;
// Le libellé de MUSCLES, abréviations écrites en entier (« Deltoïde lat. »
// devient « deltoïde latéral ») : c'est une phrase, pas une légende de graphique.
function _bbMuscle(m){
  const l=(typeof MUSCLES!=='undefined'&&MUSCLES[m]&&MUSCLES[m].lib)||String(m||'').replace(/_/g,' ');
  return String(l).replace(/ ant\.$/,' antérieur').replace(/ lat\.$/,' latéral').replace(/ post\.$/,' postérieur').toLowerCase();
}
function _bbJour(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ return ''; } }
/**
 * PURE (horloge donnée). Le bilan d'un bloc.
 * @param u  le dossier
 * @param opts {bloc:{debut,semaines,decharges}, maintenant, nom}
 *   bloc : celui du dossier (programmeDe) par défaut.
 */
function bilanBloc(u,opts){
  const o=opts||{};
  const t=Number(o.maintenant)||Date.now();
  const p=o.bloc||(()=>{ try{ return programmeDe(u); }catch(e){ return null; } })();
  if(!p||!(Number(p.debut)>0)||!(Number(p.semaines)>0)) return null;
  const debut=Number(p.debut), prevues=Math.round(Number(p.semaines));
  const finPrevue=_datePlusJours(debut,prevues*7).getTime();
  const interrompu=t<finPrevue;
  const finLue=Math.min(t,finPrevue);
  const ecoulees=Math.max(0,Math.min(prevues,Math.ceil((finLue-debut)/(7*864e5))));
  const ses=((u&&u.sessions)||[]).filter(s=>s&&Number(s.date)>=debut&&Number(s.date)<finLue).sort((a,b)=>a.date-b.date);
  let parSem=0; try{ parSem=((u&&u.sessions_config)||[]).some(s=>s&&s.active)?seancesPrevuesParSemaine(u):0; }catch(e){ parSem=0; }
  // LES SEMAINES TERMINÉES. Un bloc lu en cours de route a une semaine
  // entamée : elle tirerait moyennes et assiduité vers le bas (tout le monde
  // serait sous le MEV un lundi matin). Même règle que les signaux : les
  // séries par muscle et l'assiduité portent sur les semaines révolues ; les
  // séances de la semaine en cours sont dites à part.
  const completes=interrompu?Math.max(0,Math.min(prevues,Math.floor((finLue-debut)/(7*864e5)))):ecoulees;
  const finCompletes=_datePlusJours(debut,completes*7).getTime();
  const sesC=ses.filter(s=>Number(s.date)<finCompletes).length;
  const cadre={nom:o.nom||(u&&u.assignedProgramName)||'',debut,finPrevue,semaines:prevues,ecoulees,completes,interrompu,
    seances:ses.length,seancesCompletes:sesC,enCours:ses.length-sesC,prevues:parSem?parSem*completes:null,
    assiduite:(parSem&&completes)?Math.round(sesC/(parSem*completes)*100):null};
  // ── PAR MUSCLE : chaque semaine terminée, lue comme le compteur de volume.
  const semaines=[];
  for(let i=0;i<completes;i++){
    let v={}; try{ v=volumeSemaine(u,semaineISO(_datePlusJours(debut,i*7)))||{}; }catch(e){ v={}; }
    semaines.push(v);
  }
  const vus=new Set(); semaines.forEach(v=>Object.keys(v).forEach(m=>{ if(v[m]>0) vus.add(m); }));
  const muscles=[];
  for(const m of vus){
    let rep=null; try{ rep=reperesEffectifs(u,m); }catch(e){ rep=null; }
    const vals=semaines.map(v=>Number(v[m])||0);
    const moy=Math.round(vals.reduce((a,b)=>a+b,0)/Math.max(1,vals.length)*10)/10;
    const der=Math.round((vals[vals.length-1]||0)*10)/10;
    const zone=x=>!rep?null:(x<rep.mev?'sous':(x<rep.mavMin?'mev':(x<=rep.mavMax?'mav':(x<=rep.mrv?'haut':'dessus'))));
    muscles.push({muscle:m,lib:_bbMuscle(m),moyenne:moy,derniere:der,
      mev:rep?rep.mev:null,mavMin:rep?rep.mavMin:null,mavMax:rep?rep.mavMax:null,mrv:rep?rep.mrv:null,
      zone:zone(moy),sousMev:rep?vals.filter(x=>x<rep.mev).length:null,dessusMrv:rep?vals.filter(x=>x>rep.mrv).length:null});
  }
  muscles.sort((a,b)=>b.moyenne-a.moyenne);
  // ── PAR EXERCICE : l'e1RM de la première et de la dernière séance, décharges
  //    exclues, séries dans les bornes de fiabilité, trois séances au moins.
  const parEx={};
  for(const s of ses){
    if(s.deload) continue;
    const d=(s&&s.data)||{};
    for(const nom of Object.keys(d)){
      let best=0;
      for(const st of ((d[nom]&&d[nom].sets)||[])){
        if(!st||st.done!==true) continue;
        const w=parseFloat(st.weight)||0, r=_perfReps(st);
        if(!(w>0)||!(r>0)||!e1rmFiable(r,_perfRir(st,u))) continue;
        let x=0; try{ x=e1rm(w,r,_perfRir(st,u)); }catch(e){ x=0; }
        if(x>best) best=x;
      }
      if(!(best>0)) continue;
      (parEx[nom]=parEx[nom]||[]).push({date:s.date,v:best});
    }
  }
  const exercices=Object.keys(parEx).filter(n=>parEx[n].length>=BILAN_BLOC_MIN_SEANCES_EXO).map(n=>{
    const l=parEx[n].sort((a,b)=>a.date-b.date);
    const d0=Math.round(l[0].v*10)/10, d1=Math.round(l[l.length-1].v*10)/10;
    return {nom:n,seances:l.length,debut:d0,fin:d1,ecart:Math.round((d1-d0)*10)/10};
  }).sort((a,b)=>b.seances-a.seances||a.nom.localeCompare(b.nom));
  // ── CE QUI A FAIT MAL : le seuil dur existant, par exercice.
  const dl={};
  for(const s of ses){
    for(const x of _seriesDouloureuses(s)){
      const e=dl[x.nom]=dl[x.nom]||{nom:x.nom,series:0,max:0,dates:[]};
      e.series++; e.max=Math.max(e.max,x.pain);
      const j=localISODate(new Date(s.date)); if(e.dates.indexOf(j)<0) e.dates.push(j);
    }
  }
  const douleurs=Object.values(dl).sort((a,b)=>b.max-a.max||b.series-a.series);
  return {cadre,muscles,exercices,douleurs,seuilDouleur:SIG_PAIN_SEUIL,phrase:phraseBilanBloc({cadre,muscles})};
}
// PURE. LA phrase : les semaines, l'assiduité, et le muscle le plus souvent
// hors de ses repères. Un constat, jamais un verdict.
function phraseBilanBloc(b){
  const c=b&&b.cadre;
  if(!c) return '';
  const nb=['zéro','une','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze'];
  const mot=n=>n<nb.length?nb[n]:String(n);
  const sem=c.ecoulees+' semaine'+(c.ecoulees>1?'s':'')+(c.interrompu?' sur '+c.semaines+' prévues':'');
  if(!c.seances) return sem+', aucune séance enregistrée pendant le bloc.';
  const ass=c.assiduite!=null?', '+c.assiduite+' % d’assiduité':', '+c.seances+' séance'+(c.seances>1?'s':'');
  const l=(b.muscles||[]).filter(m=>m.sousMev!=null);
  const sous=l.filter(m=>m.sousMev>0).sort((a,b)=>b.sousMev-a.sousMev||a.moyenne-b.moyenne)[0];
  const dessus=l.filter(m=>m.dessusMrv>0).sort((a,b)=>b.dessusMrv-a.dessusMrv)[0];
  let fin='';
  const n=c.completes!=null?c.completes:c.ecoulees;
  if(sous&&(!dessus||sous.sousMev>=dessus.dessusMrv)) fin=', '+sous.lib+' sous le MEV '+mot(sous.sousMev)+' semaine'+(sous.sousMev>1?'s':'')+' sur '+mot(n);
  else if(dessus) fin=', '+dessus.lib+' au-dessus du MRV '+mot(dessus.dessusMrv)+' semaine'+(dessus.dessusMrv>1?'s':'')+' sur '+mot(n);
  else if(l.length) fin=', tous les muscles travaillés entre leur MEV et leur MRV';
  return sem+ass+fin+'.';
}
// La page (app et export) : le même contenu, deux habillages.
function _htmlBilanBlocCorps(b){
  const E=escapeHtml, c=b.cadre, nb=v=>String(v).replace('.',',');
  const zones={sous:'sous le MEV',mev:'entre MEV et MAV',mav:'dans le MAV',haut:'entre MAV et MRV',dessus:'au-dessus du MRV'};
  let h='<p class="bb-phrase">'+E(b.phrase)+'</p>';
  h+='<h2>Le cadre</h2><table><tbody>'
    +(c.nom?'<tr><th>Programme</th><td>'+E(c.nom)+'</td></tr>':'')
    +'<tr><th>Dates</th><td>du '+E(_bbJour(c.debut))+' au '+E(_bbJour(_datePlusJours(c.finPrevue,-1)))+(c.interrompu?' (lu jusqu’à aujourd’hui)':'')+'</td></tr>'
    +'<tr><th>Semaines</th><td>'+c.ecoulees+(c.interrompu?' sur '+c.semaines+' prévues':'')+'</td></tr>'
    +'<tr><th>Séances</th><td>'+c.seancesCompletes+(c.prevues!=null?' faites sur '+c.prevues+' prévues (projection du programme actuel)':' faites')
      +(c.enCours?', et '+c.enCours+' cette semaine, en cours':'')+'</td></tr>'
    +(c.interrompu&&c.completes<c.ecoulees?'<tr><th>Lecture</th><td>séries et assiduité sur les '+c.completes+' semaine'+(c.completes>1?'s':'')+' terminée'+(c.completes>1?'s':'')+'</td></tr>':'')
    +'</tbody></table>';
  if(b.muscles.length){
    h+='<h2>Séries dures par muscle</h2><table><thead><tr><th>Muscle</th><th>Moyenne / sem.</th><th>Dernière sem.</th><th>MEV · MAV · MRV</th><th>Où</th></tr></thead><tbody>'
      +b.muscles.map(m=>'<tr><td>'+E(m.lib)+'</td><td class="v">'+nb(m.moyenne)+'</td><td>'+nb(m.derniere)+'</td>'
        +'<td>'+(m.mev!=null?m.mev+' · '+m.mavMin+' à '+m.mavMax+' · '+m.mrv:'-')+'</td>'
        +'<td>'+E(m.zone?zones[m.zone]:'-')+(m.sousMev?'<small>'+m.sousMev+' sem. sous le MEV</small>':'')+'</td></tr>').join('')
      +'</tbody></table>';
  }
  h+='<h2>e1RM par exercice</h2>';
  h+=b.exercices.length
    ?'<table><thead><tr><th>Exercice</th><th>Séances</th><th>Début</th><th>Fin</th><th>Écart</th></tr></thead><tbody>'
      +b.exercices.map(x=>'<tr><td>'+E(x.nom)+'</td><td>'+x.seances+'</td><td>'+nb(x.debut)+' kg</td><td>'+nb(x.fin)+' kg</td>'
        +'<td class="v">'+(x.ecart>0?'+':'')+nb(x.ecart)+' kg</td></tr>').join('')+'</tbody></table>'
    :'<p class="bb-vide">Aucun exercice fait au moins '+BILAN_BLOC_MIN_SEANCES_EXO+' fois pendant le bloc : en dessous, l’écart ne vaut rien.</p>';
  h+='<h2>Ce qui a fait mal</h2>';
  h+=b.douleurs.length
    ?'<table><thead><tr><th>Exercice</th><th>Séries</th><th>Maximum</th><th>Jours</th></tr></thead><tbody>'
      +b.douleurs.map(x=>'<tr><td>'+E(x.nom)+'</td><td>'+x.series+'</td><td>'+x.max+'</td><td>'+x.dates.length+'</td></tr>').join('')
      +'</tbody></table><p class="bb-s">Séries déclarées à '+b.seuilDouleur+' ou plus. '+E(DISCLAIMER_DOULEUR)+'</p>'
    :'<p class="bb-vide">Aucune série déclarée à '+b.seuilDouleur+' ou plus pendant le bloc.</p>';
  return h;
}
function htmlBilanBloc(b){
  if(!b) return '<p class="bb-vide">Aucun bloc défini : le bilan se lit sur un bloc de plusieurs semaines.</p>';
  return '<div class="bb">'+_htmlBilanBlocCorps(b)+'</div>';
}
function bilanBlocExportHtml(c,b){
  const nom=[c&&c.fname,c&&c.lname].filter(Boolean).join(' ');
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bilan de bloc</title><style>'+_anatExportCss()
    +'.bb-phrase{font-size:12pt;font-weight:700;margin:6px 0 4px}.bb-vide,.bb-s{font-size:8.5pt;color:#52525b}td small{display:block;font-size:7.5pt;color:#71717a}'
    +'</style></head><body><div class="ex-t"><div><h1>Bilan <span>de bloc</span></h1><p>'+escapeHtml(nom)+'</p></div>'
    +'<div class="ex-m">Édité le '+escapeHtml(_bbJour(Date.now()))+'</div></div>'+_htmlBilanBlocCorps(b)
    +'<p class="ex-n">Ce document montre ce qui s’est passé pendant le bloc. Il ne le note pas.</p></body></html>';
}
// La feuille, depuis le bloc de la fiche coach : lire, puis exporter.
function ouvrirBilanBloc(){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  let b=null; try{ b=bilanBloc(c); }catch(e){ b=null; }
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Bilan du bloc" class="bb-feuille">'
    +'<h2 class="bb-t">Bilan du bloc</h2>'+htmlBilanBloc(b)
    // Et la suite : le bloc suivant à assigner, l'athlète suivant de la file.
    +_htmlSuiteBilanBloc(c)
    +'<div class="bb-btns">'+(b?'<button type="button" class="btn btn-red btn-sm" onclick="bilanBlocExporter()">Exporter</button>':'')
    +'<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Fermer</button></div></div></div>');
  return true;
}
// L'EXPORT : le même chemin que les exports morpho (iframe srcdoc, polices du
// dépôt par chemin relatif, impression par le navigateur, rien ne quitte
// l'appareil).
async function bilanBlocExporter(o){
  const opt=o||{};
  const c=getOwnedClient(currentClientId);
  let b=null; try{ b=bilanBloc(c); }catch(e){ b=null; }
  if(!c||!b){ toast('Aucun bloc à exporter.','var(--orange)'); return null; }
  document.getElementById('bb-export')?.remove();
  const f=document.createElement('iframe');
  f.id='bb-export'; f.setAttribute('aria-hidden','true'); f.tabIndex=-1;
  f.style.cssText='position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;opacity:0;pointer-events:none;z-index:-1';
  const pret=new Promise(r=>{ f.onload=()=>r(); });
  f.srcdoc=bilanBlocExportHtml(c,b);
  document.body.appendChild(f);
  await Promise.race([pret,new Promise(r=>setTimeout(r,4000))]);
  try{ const d=f.contentDocument; await Promise.race([d.fonts?d.fonts.ready:Promise.resolve(),new Promise(r=>setTimeout(r,8000))]); }catch(e){}
  if(opt.imprimer===false) return f;
  const w=f.contentWindow;
  const retirer=()=>{ setTimeout(()=>{ try{ f.remove(); }catch(e){} },500); };
  try{ w.addEventListener('afterprint',retirer,{once:true}); }catch(e){}
  setTimeout(retirer,120000);
  try{ w.focus(); w.print(); }catch(e){ toast('Impression impossible sur ce navigateur.','var(--orange)'); retirer(); }
  return f;
}
function _progBlocLundiProchain(){
  const d=_lundiDe(new Date());
  // Le lundi de la semaine EN COURS, pas le suivant : un bloc qui commence
  // dans six jours ne decrit pas la semaine que l'athlete est en train de
  // faire, et les quatre lecteurs rendraient null jusqu'a lundi.
  return d.getTime();
}
function htmlBlocProgramme(c){
  const p=(()=>{ try{ return programmeDe(c); }catch(e){ return null; } })();
  const t=(s)=>'<div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;'
    +'text-transform:uppercase;font-weight:800;margin-bottom:6px">'+s+'</div>';
  if(!p) return '<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">'
    +t('Bloc d’entraînement')
    +'<div class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:10px">'
    +'Aucun bloc défini : le programme ci-dessous vaut semaine après semaine, '
    +'sans début ni fin, et sans décharge planifiée.</div>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" '
    +'onclick="reglerBlocProgramme()">Définir un bloc</button></div>';
  const dep=new Date(p.debut);
  // Le DERNIER JOUR du bloc (le dimanche de sa dernière semaine), celui de finProgramme,
  // et non le lundi de la dernière semaine : « au 28 sept. » pour un bloc qui court jusqu'au 4 octobre.
  const fin=new Date(p.debut); fin.setDate(fin.getDate()+p.semaines*7-1);
  const fmt=d=>d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  const i=(()=>{ try{ return indexSemaineBloc(c,Date.now()); }catch(e){ return null; } })();
  const dech=p.decharges.length
    ? p.decharges.map(x=>'S'+(x+1)).join(', ')
    : 'aucune';
  return '<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-left:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">'
    +t('Bloc d’entraînement')
    +'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">'
    +'<b>'+p.semaines+' semaine'+(p.semaines>1?'s':'')+'</b>, du '+fmt(dep)+' au '+fmt(fin)+'</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);line-height:1.6">Décharges : '+escapeHtml(dech)
    +(i===null?' · <span style="color:var(--orange)">hors bloc aujourd’hui</span>'
              :' · semaine '+(i+1)+' en cours')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" '
    +'onclick="reglerBlocProgramme()">Modifier le bloc</button>'
    +'<button class="btn btn-outline btn-sm" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" '
    +'onclick="retirerBlocProgramme()">Retirer</button>'
    // LOT T7 : le bilan, en cours de bloc comme à sa fin (lu jusqu'à aujourd'hui).
    +'<button class="btn btn-outline btn-sm bb-ouvrir" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)" '
    +'onclick="ouvrirBilanBloc()">Bilan du bloc</button>'
    +'</div></div>';
}
async function reglerBlocProgramme(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  if(!c.email){ toast('Cet élève n’a pas encore de dossier synchronisé','var(--orange)'); return false; }
  const nl=String.fromCharCode(10);
  const actuel=(()=>{ try{ return programmeDe(c); }catch(e){ return null; } })();
  // ── Combien de semaines ──
  const rn=await rcSaisie('Combien de semaines ?'+nl+nl
    +'De '+PROG_SEMAINES_MIN+' à '+PROG_SEMAINES_MAX+'. Le programme ci-dessous sert de '
    +'gabarit à chacune d’elles.',
    String(actuel?actuel.semaines:4),{libelleOk:'Suivant',inputmode:'numeric'});
  if(rn===null||rn===undefined) return false;
  const n=Math.round(Number(String(rn).trim()));
  if(!isFinite(n)||n<PROG_SEMAINES_MIN||n>PROG_SEMAINES_MAX){
    toast('Il faut un nombre entre '+PROG_SEMAINES_MIN+' et '+PROG_SEMAINES_MAX+'.','var(--orange)');
    return false;
  }
  // ── Quand il commence ──
  const parDefaut=new Date(actuel?actuel.debut:_progBlocLundiProchain());
  const iso=d=>{ const m=String(d.getMonth()+1).padStart(2,'0');
    const j=String(d.getDate()).padStart(2,'0'); return d.getFullYear()+'-'+m+'-'+j; };
  const rd=await rcSaisie('Le bloc commence quand ?'+nl+nl
    +'La semaine part toujours du LUNDI : une date en milieu de semaine sera '
    +'ramenée au lundi qui la précède.',
    iso(parDefaut),{libelleOk:'Suivant',type:'date'});
  if(rd===null||rd===undefined) return false;
  const d=new Date(String(rd).trim()+'T00:00:00');
  if(!isFinite(d.getTime())){ toast('Date illisible.','var(--orange)'); return false; }
  // ── Lesquelles sont des décharges ──
  const rdech=await rcSaisie('Quelles semaines sont des décharges ?'+nl+nl
    +'Leurs numéros, séparés par des virgules : « 4 » pour la quatrième, « 4,8 » '
    +'pour deux. Laisse vide s’il n’y en a aucune.',
    (actuel?actuel.decharges.map(x=>x+1).join(','):''),{libelleOk:'Enregistrer'});
  if(rdech===null||rdech===undefined) return false;
  const dech=String(rdech).split(',').map(x=>Math.round(Number(String(x).trim()))-1)
    .filter(x=>isFinite(x)&&x>=0&&x<n);
  // ── L'écriture, par le même chemin que le reste de la fiche ──
  if(!c.programme||typeof c.programme!=='object') c.programme={};
  c.programme.debut=_lundiDe(d).getTime();
  c.programme.semaines=n;
  c.programme.decharges=[...new Set(dech)].sort((a,b)=>a-b);
  // LES ECARTS SONT CONSERVES : ils portent le travail semaine par semaine, et
  // raccourcir un bloc ne doit pas effacer ce qui a ete ecrit pour la semaine 6
  // si le coach le rallonge demain. programmeDe ignore deja ce qui sort du bloc.
  if(!c.programme.ecarts||typeof c.programme.ecarts!=='object') c.programme.ecarts={};
  // B3.3 — ET LES ALLEGEMENTS SUIVENT LA LISTE QU'ON VIENT D'ECRIRE : une
  // semaine ajoutee aux decharges recoit le sien, une semaine retiree le perd.
  try{ synchroniserEcartsDecharge(c); }catch(e){}
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ renderCoachSessionsBloc(); }catch(e){}
  toastSync(ok,envoi,'Bloc de '+n+' semaine'+(n>1?'s':'')+' enregistré','le bloc est');
  return true;
}
async function retirerBlocProgramme(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.email) return false;
  const nl=String.fromCharCode(10);
  if(!await rcConfirm('Retirer le bloc ?'+nl+nl
    +'Le programme continue de s’appliquer semaine après semaine, sans début ni '
    +'fin. Les écarts déjà écrits pour chaque semaine sont conservés.',
    null,'Retirer')) return false;
  if(c.programme&&typeof c.programme==='object'){
    delete c.programme.debut;
    delete c.programme.semaines;
    delete c.programme.decharges;
  }
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ renderCoachSessionsBloc(); }catch(e){}
  toastSync(ok,envoi,'Bloc retiré','le retrait est');
  return true;
}
function renderCoachSessionsBloc(){
  const z=document.getElementById('csm-bloc');
  if(!z) return;
  const c=getOwnedClient(currentClientId);
  z.innerHTML=c?htmlBlocProgramme(c):'';
}
function _boutonsCopieJour(fn,i){
  return `<div style="margin-top:10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
    <span class="sub" style="font-size:var(--fs-xs);text-transform:uppercase;letter-spacing:.5px;flex-shrink:0">Copier vers</span>
    ${DAYS.map((d,j)=>j===i?'':`<button onclick="${fn}(${i},${j})" title="Copier vers ${d}" aria-label="Copier cette séance vers ${d}" style="background:none;border:1px solid var(--border);color:var(--sub);border-radius:var(--r-2);min-width:44px;min-height:44px;padding:4px 8px;font-size:var(--fs-xs);font-weight:700;cursor:pointer;font-family:inherit">${DAY_ICONS[j]}</button>`).join('')}
    <!-- N4.17, ET CHEZ UN AUTRE ATHLETE. Seulement depuis la fiche d'un
         athlete : un MODELE n'a pas de destinataire, et coachCopyDay est le
         seul appelant qui en ait un. -->
    ${fn==='coachCopyDay'?`<button onclick="copierSeanceVersAthlete(${i})" title="Porter cette séance chez un autre athlète" aria-label="Porter cette séance chez un autre athlète" style="background:none;border:1px dashed var(--red);color:var(--red-text);border-radius:var(--r-2);min-height:44px;padding:4px 12px;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;cursor:pointer;font-family:inherit">→ Autre athlète</button>`:''}
  </div>`;
}
function _copierSeance(src,dst){
  dst.name=src.name||'';
  // Clone PROFOND, comme dupliquerSeance : le {...e} par exercice laissait
  // partage tout objet imbriqué, et modifier la copie touchait la source.
  dst.exercises=JSON.parse(JSON.stringify(src.exercises||[]));
  dst.warmup=src.warmup||'';
  dst.cooldown=src.cooldown||'';
  dst.notes=src.notes||'';
  dst.active=true;
  // Une séance recopiée volontairement n'est plus un exemple.
  delete dst._essai;delete dst._foundation;
}
// Un mauvais appui ne doit pas effacer une séance déjà écrite : c'est le seul
// endroit de ce lot où l'on peut détruire du travail.
async function _confirmerEcrasement(src,dst){
  if(!dst.active||!dst.exercises?.length) return true;
  const n=dst.exercises.length;
  return await rcConfirm(dst.day+' contient déjà '+n+' exercice'+(n>1?'s':'')
    +'.\nLes remplacer par ceux de '+src.day+' ?',null,'Confirmer');
}
// ── Duplication de séance ───────────────────────────────────────────────────
// Le NOM porte une conséquence : _memeCreneau compare d'abord le slot, mais
// retombe sur le nom quand une séance ancienne a été enregistrée sans slot.
// Trois « PUSH » sur trois créneaux mélangeraient alors leurs historiques
// d'exercice. Une copie reçoit donc toujours une lettre libre — « PUSH B »,
// puis « PUSH C ». C'est exactement ce que _copierSeance ne faisait pas :
// il recopiait le nom tel quel.
const _RE_SUFFIXE_COPIE=/^(.*\S)\s+([B-Z])$/;
function _baseNomSeance(nom){
  const s=String(nom||'').trim();
  const m=_RE_SUFFIXE_COPIE.exec(s);
  return m?m[1]:s;
}
// Premier nom « <base> <lettre> » que ne porte aucun AUTRE créneau. Le créneau
// destination est exclu de la comparaison : il est sur le point d'être écrasé.
function _nomSeanceLibre(cfg,nomSource,slotDest){
  const base=_baseNomSeance(nomSource);
  if(!base) return '';
  const pris=new Set();
  (cfg||[]).forEach((s,i)=>{
    if(i===slotDest||!s||!s.name) return;
    pris.add(String(s.name).trim().toUpperCase());
  });
  for(let c=66;c<=90;c++){                       // B … Z
    const n=base+' '+String.fromCharCode(c);
    if(!pris.has(n.toUpperCase())) return n;
  }
  // Vingt-cinq lettres épuisées. On ne rend JAMAIS un nom déjà porté : mieux
  // vaut un nom laid qu'un historique mélangé.
  return base+' '+Date.now();
}
// PURE : ne lit ni le DOM ni le stockage, ne demande rien, n'écrit rien.
// La confirmation et l'instantané appartiennent à l'appelant.
function dupliquerSeance(cfg,slotSource,slotDest){
  if(!Array.isArray(cfg)) return {ok:false,raison:'Aucune configuration de séances.'};
  if(slotSource===slotDest) return {ok:false,raison:'Source et destination identiques.'};
  const src=cfg[slotSource], dst=cfg[slotDest];
  if(!src||!dst) return {ok:false,raison:'Créneau inconnu.'};
  if(!src.active||!((src.exercises||[]).length))
    return {ok:false,raison:'Le créneau source est vide : rien à dupliquer.'};
  const nom=_nomSeanceLibre(cfg,src.name,slotDest);
  // Copie PROFONDE. Le {...e} par exercice de _copierSeance laissait partagé
  // tout objet imbriqué : modifier la copie touchait la source.
  dst.name=nom;
  dst.exercises=JSON.parse(JSON.stringify(src.exercises||[]));
  dst.warmup=src.warmup||'';
  dst.cooldown=src.cooldown||'';
  dst.notes=src.notes||'';
  dst.active=true;
  // La photo n'est JAMAIS copiée : c'est du base64 en localStorage, et la
  // dupliquer doublerait le poids du dossier pour une image identique.
  dst.photo=null; dst.photo2=null;
  // Une séance dupliquée volontairement n'est plus un exemple.
  delete dst._essai; delete dst._foundation;
  _normaliserSS(dst.exercises);
  return {ok:true,nom};
}
// ── Duplication d'un exercice dans l'éditeur ────────────────────────────────
// La copie se pose juste après sa source, SAUF quand celle-ci ouvre un
// superset : s'insérer au milieu volerait la suite du groupe à la source.
// Dans ce cas la copie se pose après le groupe entier, et reste seule.
function _dupliquerExUI(i){
  if(!dupliquerExercice(i)) return;
  renderProgEx();
  toast('Exercice dupliqué');
}
function dupliquerExercice(i){
  if(!progEx||!progEx[i]) return false;
  const copie=JSON.parse(JSON.stringify(progEx[i]));
  copie.name=((progEx[i].name||'')+' (COPIE)').trim().toUpperCase();
  const groupe=_groupeDe(progEx,i);
  const tete=groupe[0]===i&&groupe.length>1;
  if(tete) copie.ss=false;
  progEx.splice((tete?groupe[groupe.length-1]:i)+1,0,copie);
  _normaliserSS(progEx);
  _progExDirty=true;
  return true;
}

async function cptCopyDay(i,j){
  if(_editProgTemplateIdx===null) return;
  const p=currentUser.coachPrograms[_editProgTemplateIdx];
  const sessions=_cptSeances(p,_editProgTemplateGender);
  if(!sessions) return;
  const src=sessions[i],dst=sessions[j];
  if(!src||!dst||!await _confirmerEcrasement(src,dst)) return;
  _copierSeance(src,dst);
  loadProgTemplateSlots(_editProgTemplateGender);
  // Pas de saveUser ici : comme cptToggleDay et cptRenameSession, l'écriture
  // appartient au bouton SAUVEGARDER de l'écran.
  toast(src.day+' → '+dst.day+' ✓');
}
// Le programme d'un ATHLÈTE passe par dupliquerSeance : copie profonde, nom
// unique, photo non reprise. cptCopyDay garde _copierSeance — un modèle n'a ni
// historique d'exercice ni _memeCreneau à protéger.
// Aucun _pushSessionsHistory ici : cet écran n'écrit rien avant SAUVEGARDER, et
// c'est saveCoachSessions qui archive la version STOCKÉE — donc bien celle
// d'avant la duplication. Un instantané posé sur la copie en mémoire serait
// écrasé à la sauvegarde et ne survivrait à aucun rechargement.
async function coachCopyDay(i,j){
  const sc=_coachEditClient?.sessions_config;
  if(!sc) return;
  const src=sc[i],dst=sc[j];
  if(!src||!dst) return;
  if(!src.active||!((src.exercises||[]).length)){
    toast('Le créneau source est vide : rien à dupliquer.','var(--orange)'); return; }
  if(!await _confirmerEcrasement(src,dst)) return;
  const r=dupliquerSeance(sc,i,j);
  if(!r.ok){ toast(r.raison,'var(--orange)'); return; }
  loadCoachSessionSlots();
  toast(src.day+' → '+dst.day+' : '+r.nom+' ✓');
}

function cptToggleDay(i){
  if(_editProgTemplateIdx===null) return;
  const p=currentUser.coachPrograms[_editProgTemplateIdx];
  const sessions=_cptSeances(p,_editProgTemplateGender);
  if(!sessions) return;
  sessions[i].active=!sessions[i].active;
  if(sessions[i].active) _garnirSeanceVierge(sessions[i]);
  loadProgTemplateSlots(_editProgTemplateGender);
}
function cptRenameSession(i,val){
  if(_editProgTemplateIdx===null) return;
  const p=currentUser.coachPrograms[_editProgTemplateIdx];
  const sessions=_cptSeances(p,_editProgTemplateGender);
  if(!sessions) return;
  sessions[i].name=val;
}

// LA PHOTO N EST PLUS MONTEE ICI. Sa zone a quitte l ecran le 25/08/2026, a la
// demande de Kevin : le guide des exercices est desormais la seule reference du
// coach. Ce montage-la deferencait `prog-photo-preview` et `prog-photo-ph` sans
// garde — une fois les elements partis, il levait, et l editeur ne s ouvrait
// plus du tout. C est exactement le symptome que Kevin venait de signaler, pour
// une autre cause ; je l ai reproduit en retirant le bloc.
//
// progPhotoData ET progPhoto2Data SONT REMIS A null, et les parametres `photo`
// et `photo2` disparaissent : plus rien ne peut en charger. Ils ne sont pas
// supprimes du fichier — l enregistrement les lit encore, et c est ce qui
// PROTEGE les photos deja deposees, voir savePlanCoach et ses jumelles.
function _prepProgEditor({name='',notes='',warmup='',cooldown=''}={}){
  document.getElementById('prog-name').value=name||'';
  document.getElementById('prog-notes').value=notes||'';
  document.getElementById('prog-warmup').value=warmup||'';
  document.getElementById('prog-cooldown').value=cooldown||'';
  progPhotoData=null;
  progPhoto2Data=null;
  _pdfVideoLinks=null;
}
function openProgTemplateSessionExercises(idx){
  if(_editProgTemplateIdx===null) return;
  const p=currentUser.coachPrograms[_editProgTemplateIdx];
  const sessions=_cptSeances(p,_editProgTemplateGender);
  if(!sessions) return;
  const s=sessions[idx];
  // TOUT LE MONTAGE EST SOUS FILET, et pas seulement le rendu : la copie
  // des exercices, les champs du formulaire, le titre et le rendu peuvent
  // chacun lever. Sans lui, l'exception remontait au gestionnaire de clic
  // et le bouton restait muet, quel que soit le maillon qui a cassé.
  try{
  _assainirExercices(s);
  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();
  _prepProgEditor({name:s.name,notes:s.notes,warmup:s.warmup,cooldown:s.cooldown});
  _progEditorCtx={mode:'template',sessionIdx:idx,progIdx:_editProgTemplateIdx,gender:_editProgTemplateGender};
  _majCtxEditeur();
  const backBtn=document.querySelector('#s-coach-program .back-btn');
  // MÊME GARDE-FOU QUE LES DEUX AUTRES ÉDITEURS. Sans lui, un ← jetait tout
  // le travail en cours sans un mot — et c’est le seul des trois qui édite un
  // MODÈLE, donc du travail réutilisé sur plusieurs athlètes.
  if(backBtn) backBtn.onclick=async ()=>{if(_progExDirty&&!await rcConfirm('Modifications non enregistrées : quitter quand même ?',null,'Quitter'))return;_progEditorCtx={mode:'clientProgram'};_majCtxEditeur();go('s-coach-prog-template');loadProgTemplateSlots(_editProgTemplateGender);};
  const title=document.querySelector('#s-coach-program .topbar-title');
  if(title) title.textContent=(s.name||DAYS[idx])+' ('+_editProgTemplateGender+') : Exercices';
  renderProgEx();go('s-coach-program');
  // Le drapeau est REMIS À ZÉRO à l’ouverture, comme dans les deux autres.
  // Sans cette ligne, celui laissé par l’éditeur précédent survivrait ici et
  // ferait poser la question sur des modifications qui n’existent pas — une
  // question qui se pose sans raison apprend à répondre oui sans lire.
  _progExDirty=false;
  }catch(e){ return _echecOuvertureEditeur(e); }
}

// ─── Assignation ───
// `precoches` : les athlètes à cocher d'office (la fin d'un bloc) ; sinon la
// sélection du tableau de bord (SEL_ATHLETES), qui ne l'était jamais jusqu'ici.
function openAssignProgram(idx,precoches){
  _assigningProgIdx=idx;
  const p=currentUser.coachPrograms[idx];
  const title=document.getElementById('cpa-title');
  if(title) title.textContent='Assigner : '+escapeHtml(p.name||'Programme');
  go('s-coach-prog-assign');
  loadAssignAthletes();
  const _ids=Array.isArray(precoches)?precoches:Array.from(SEL_ATHLETES);
  if(_ids.length) _cocherIds('cpa-athletes',_ids);
}

/** Le modele en cours d'assignation, ou un objet vide. */
function _progAssigne(){
  return ((currentUser&&currentUser.coachPrograms)||[])[_assigningProgIdx]||{};
}
function loadAssignAthletes(){
  const users=DB.get('users')||{};
  // N4.13 — LE MEME PREDICAT QUE LA LISTE. Filtrer sur le seul coachId
  // laissait hors de l'assignation les athletes rattaches par coachEmailKey :
  // visibles au tableau de bord, absents ici.
  const athletes=Object.values(users).filter(u=>_estMonAthlete(u,currentUser));
  const container=document.getElementById('cpa-athletes');if(!container)return;
  if(!athletes.length){container.innerHTML=`<div style="text-align:center;padding:24px;color:var(--sub);font-size:var(--fs-sm)">Aucun athlète lié à ton compte.</div>`;return;}
  container.innerHTML=_htmlCocherEtiquette('cpa-athletes')+athletes.map(a=>{
    // Detect gender from _evol_gender first, then fall back to gender field
    const gRaw=a._evol_gender||a.gender||'';
    const detectedF=isFemale(gRaw);
    // LE PUBLIC DU PROGRAMME PASSE DEVANT LE GENRE DE L'ATHLETE : c'est le
    // coach qui a decide a qui ce modele s'adresse, et l'ecran doit montrer ce
    // qui sera reellement assigne plutot que ce qu'on aurait choisi par defaut.
    const defG=progGenreServi(_progAssigne(),detectedF?'F':'H');
    return `
    <div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid #242424;padding:12px 10px;border-left:3px solid ${ETAT_FILET[etatAthlete(a)]||'#666666'};border-radius:0 8px 8px 0;background:linear-gradient(168deg,#141414,#0d0d0d);margin-bottom:6px">
      <div class="avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${escapeHtml(ini(a.fname,a.lname))}</div>
      <input type="checkbox" id="cpa-cb-${a.id}" value="${a.id}" data-gender="${defG}"${cpaCocheDefaut(a)?'':' data-encours="1"'} style="width:18px;height:18px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      <label for="cpa-cb-${a.id}" style="flex:1;cursor:pointer">
        <div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml((a.fname||'')+' '+(a.lname||''))}</div>
        ${(()=>{ const x=programmeRemplace(a); return x?`<div class="c4-encours">Programme en cours${x.nom?' : '+escapeHtml(x.nom):''}${x.bloc?', semaine '+x.bloc.semaine+' sur '+x.bloc.semaines:''}</div>`:''; })()}
      </label>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button onclick="cpaSwitchGender('${a.id}','H')" id="cpa-g-H-${a.id}" style="padding:4px 10px;border-radius:var(--r-1);border:none;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;background:${defG==='H'?'var(--red)':'#222'};color:${defG==='H'?'var(--text)':'var(--sub)'}">H</button>
        <button onclick="cpaSwitchGender('${a.id}','F')" id="cpa-g-F-${a.id}" style="padding:4px 10px;border-radius:var(--r-1);border:none;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;background:${defG==='F'?'var(--red)':'#222'};color:${defG==='F'?'var(--text)':'var(--sub)'}">F</button>
      </div>
    </div>
  `;}).join('');
}
function cpaSwitchGender(id,g){
  const bH=document.getElementById('cpa-g-H-'+id);
  const bF=document.getElementById('cpa-g-F-'+id);
  const cb=document.getElementById('cpa-cb-'+id);
  if(!bH||!bF)return;
  bH.style.background=g==='H'?'var(--red)':'#222';bH.style.color=g==='H'?'var(--text)':'var(--sub)';
  bF.style.background=g==='F'?'var(--red)':'#222';bF.style.color=g==='F'?'var(--text)':'var(--sub)';
  if(cb) cb.dataset.gender=g;
}

// « Tout cocher » laisse de côté qui a un programme en cours (C4) : celui-là se coche un par un.
function cpaSelectAll(v){document.querySelectorAll('#cpa-athletes input[type=checkbox]').forEach(cb=>{ if(v&&cb.dataset.encours) return; cb.checked=v; });}

// LIMITE CONNUE : chaque athlète n'a qu'un seul sessions_config actif à la fois.
// Un système multi-programmes (ex : programme A le lundi, programme B en décharge)
// n'est pas prévu ; sessions_config_history permet uniquement un rollback unitaire.
const _SESSIONS_HISTORY_MAX=5;
function _pushSessionsHistory(a){
  if(!a.sessions_config) return;
  if(!a.sessions_config_history) a.sessions_config_history=[];
  a.sessions_config_history.unshift({ts:Date.now(),sessions_config:JSON.parse(JSON.stringify(a.sessions_config))});
  if(a.sessions_config_history.length>_SESSIONS_HISTORY_MAX) a.sessions_config_history.length=_SESSIONS_HISTORY_MAX;
}

async function confirmAssignProgram(){
  const checked=[...document.querySelectorAll('#cpa-athletes input[type=checkbox]:checked')];
  if(!checked.length){toast('Sélectionne au moins un athlète','var(--orange)');return;}
  const prog=currentUser.coachPrograms[_assigningProgIdx];
  const users=DB.get('users')||{};
  // Construire la liste des noms pour le confirm()
  const targets=checked.map(cb=>{
    const emailKey=Object.keys(users).find(k=>users[k]?.id===cb.value);
    if(!emailKey) return null;
    const a=users[emailKey];
    return {emailKey,a,gender:cb.dataset.gender,name:((a.fname||'')+(a.lname?' '+a.lname:'')).trim()||a.email};
  }).filter(Boolean);
  if(!targets.length){toast('Aucun athlète trouvé','var(--orange)');return;}
  // C4 : LE RÉCAPITULATIF AVANT D'ÉCRIRE, à la place de la question. Qui
  // reçoit quoi, qui perd un programme en cours (et ce qu'il perd), et ce
  // que la revue morpho voit dans CE modèle pour chacun. Rien n'est écrit
  // avant « Assigner » dans le récapitulatif.
  const recap=assignationRecap(targets,prog,{morpho:_c4Morpho,brouillon:a=>!!_brouillonSessionsDe(a)});
  ouvrirRecapAssignation(recap,prog);
}

// Renseigner le numéro d'un athlète depuis sa fiche. Écrit dans le nœud de
// l'athlète, donc synchronisé et visible depuis n'importe quel appareil du coach.
async function setClientPhone(){
  const users=DB.get('users')||{};
  const emailKey=Object.keys(users).find(k=>users[k]?.id===currentClientId);
  if(!emailKey){toast('Athlète introuvable','var(--orange)');return;}
  const a=users[emailKey];
  const saisi=await rcSaisie('Numéro WhatsApp de '+(a.fname||'cet athlète')
    +'\n\nAvec l\'indicatif pays, ex : +33612345678',a.phone||'+33',
    {type:'tel',inputmode:'tel',placeholder:'+33612345678',libelleOk:'Enregistrer'});
  if(saisi===null) return; // annulé
  const brut=saisi.trim();
  // Refuser à la saisie plutôt que de stocker un numéro qui ouvrira WhatsApp
  // sur « numéro invalide ». _numWa rejette tout ce qui commence par 0.
  if(brut&&_numWa(brut).length<8){
    toast('Numéro inutilisable : mets l\'indicatif pays sans le 0, ex : +33612345678','var(--orange)');
    return;
  }
  a.phone=brut||null;   // champ vidé = numéro retiré
  a.updatedAt=Date.now();
  users[emailKey]=a;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(emailKey,a);
  openClientDetail(currentClientId,true);
  toastSync(ok,envoi,brut?'Numéro enregistré ✓':'Numéro retiré','le numéro est');
}

// Cœur d'assignation, partagé par l'écran d'assignation en masse et par
// « Appliquer un modèle » depuis la fiche d'un athlète. Un seul endroit écrit
// sessions_config ET la trace du modèle : les deux chemins ne peuvent pas
// diverger, et la fiche affichera toujours le bon nom quel que soit le geste.
function _assignerModele(a,prog,genre){
  // ⚠ LE PUBLIC DU PROGRAMME TRANCHE, PAS LE GENRE DEMANDE. Un modele declare
  //   « Pour les hommes » n'a pas de version Femme : la lui demander aurait
  //   ecrase les seances de l'athlete avec un tableau VIDE, et la fiche aurait
  //   affiche « Programme : … » par-dessus. Une seule regle, ici, au seul
  //   endroit qui ecrit — les deux chemins d'assignation en heritent.
  const g=progGenreServi(prog,genre);
  const base=(g==='F'?prog.sessions_F:prog.sessions_H)||[];
  _pushSessionsHistory(a); // sauvegarde avant écrasement — rollback possible
  // Clone PROFOND. A plat, le tableau `sets` restait partagé : l'athlète
  // retouchait ses séries et le modèle du coach bougeait avec — donc aussi
  // toutes les assignations suivantes de ce modèle.
  a.sessions_config=_marquerCommePublie(JSON.parse(JSON.stringify(base)));
  a.assignedProgramName=prog.name||'Programme';
  a.assignedProgramAt=Date.now();
  // C4 : le lien sûr (l'identifiant), la version servie et la version du
  // modèle. Sans eux, « qui utilise ce modèle » ne se lirait que par le nom.
  a.assignedProgramId=prog.id||null;
  a.assignedProgramGenre=g;
  a.assignedProgramVersion=Number(prog.majAt)||Number(prog.createdAt)||0;
  a.updatedAt=Date.now();
  rcmCoach('coach_programme_assigne');
}

// ══ LOT C4 : LE MODÈLE POSÉ SUR PLUSIEURS, ET LA PROPAGATION (29/09/2026) ═
//
// Trois gestes autour d'un modèle de coachPrograms :
//   1. l'ASSIGNER à plusieurs athlètes, avec un récapitulatif AVANT d'écrire ;
//   2. REPORTER une correction du modèle chez ceux qui l'utilisent, athlète
//      par athlète, ce que le coach coche ;
//   3. SIGNALER, à l'assignation, ce que la revue morpho (T4) voit dans ce
//      modèle pour chaque athlète.
//
// ⚠ UN PROGRAMME EN COURS NE S'ÉCRASE PAS SANS LE DIRE. Décoché par défaut
//   dans la liste, et le récapitulatif dit ce qui est remplacé.
// ⚠ LA PROPAGATION NE TOUCHE QUE LE PRESCRIT (sessions_config). Jamais
//   `sessions` (l'historique), jamais les champs propres à l'athlète
//   (MOD_PROTEGES : sa charge, son réglage morpho, la justification d'une
//   contrainte). Ce qui a été ajusté chez lui est montré, et décoché.
// ⚠ AUCUN EXERCICE N'EST RETIRÉ PAR L'APP. La revue morpho signale, le coach
//   décide ; un retrait ne vient que d'une correction du modèle, cochée.
//
// LE LIEN ATHLÈTE → MODÈLE. Avant ce lot, seul le nom existait
// (assignedProgramName). _assignerModele écrit désormais l'identifiant, la
// version servie (H ou F) et la version du modèle (assignedProgramVersion =
// majAt du modèle à ce moment-là). Un athlète assigné avant ce lot est
// reconnu par le nom, et comparé directement (tout décoché).
//
// LES VERSIONS DU MODÈLE. À chaque enregistrement qui change le contenu, la
// version précédente est gardée, allégée (MOD_VERSIONS_MAX au plus) : le nom
// des séances et des exercices, les champs prescrits, et une empreinte de la
// consigne (description, vidéos). Sans elle, on ne saurait pas distinguer ce
// que le coach a corrigé dans le modèle de ce qu'il a ajusté chez l'athlète.

const MOD_CHAMPS=Object.freeze(['series','reps','repos','tempo','rir','rirCible','methode','methodeSeries','ss','materiel','alternatives']);
const MOD_CONSIGNE=Object.freeze(['description','videoUrl','videoUrl2','technique']);
const MOD_PROTEGES=Object.freeze(['charge','poids','reglageCoach','justificationContrainte','methodeForcee']);
const MOD_VERSIONS_MAX=3;
const MOD_LIB_CHAMP=Object.freeze({series:'séries',reps:'répétitions',repos:'repos',tempo:'tempo',rir:'RIR',rirCible:'RIR visé',
  methode:'méthode',methodeSeries:'séries de la méthode',ss:'superset',materiel:'matériel',alternatives:'remplaçants',consigne:'consigne'});

function _modVal(v){ return v==null?'':(typeof v==='object'?JSON.stringify(v):String(v)); }
function _modCle(nom){ try{ return exKey(nom); }catch(e){ return String(nom||'').trim().toUpperCase(); } }
// PURE. Une empreinte courte de la consigne : la comparer suffit, la garder
// en entier doublerait le poids du modèle à chaque version.
function _modEmpreinte(ex){
  const s=MOD_CONSIGNE.map(k=>_modVal(ex&&ex[k])).join('|');
  let h=5381; for(let i=0;i<s.length;i++) h=((h*33)^s.charCodeAt(i))>>>0;
  return h.toString(36);
}
// PURE. Les séances allégées : ce que la comparaison lit, rien d'autre.
function modSlim(sessions){
  return (Array.isArray(sessions)?sessions:[]).map(s=>({day:s&&s.day,name:String((s&&s.name)||''),active:!!(s&&s.active),
    exercises:((s&&Array.isArray(s.exercises))?s.exercises:[]).filter(e=>e&&e.name).map(e=>{
      const o={name:String(e.name)};
      for(const k of MOD_CHAMPS) if(e[k]!=null&&e[k]!=='') o[k]=e[k];
      o.h=e.h!=null?e.h:_modEmpreinte(e);
      return o;
    })}));
}
function _modPleine(s){ return !!(s&&s.active&&Array.isArray(s.exercises)&&s.exercises.some(e=>e&&e.name)); }

/**
 * PURE. Ce que la correction change, séance par séance : une liste
 * d'opérations {id, type, jour, ...}. `avant` et `apres` : des séances
 * (entières ou allégées, sept créneaux, rangés par jour).
 *   seance_ajout / seance_retrait / seance_nom
 *   ex_ajout {nom, pos} / ex_retrait {nom} / ex_modif {nom, champs:[{champ,de,a}]}
 */
function diffModele(avant,apres){
  const A=modSlim(avant), B=modSlim(apres), ops=[];
  const n=Math.max(A.length,B.length);
  for(let j=0;j<n;j++){
    const a=A[j]||{exercises:[]}, b=B[j]||{exercises:[]};
    const pa=_modPleine(a), pb=_modPleine(b);
    if(!pa&&pb){ ops.push({id:'s'+j+':ajout',type:'seance_ajout',jour:j,seance:b.name}); continue; }
    if(pa&&!pb){ ops.push({id:'s'+j+':retrait',type:'seance_retrait',jour:j,seance:a.name}); continue; }
    if(!pa&&!pb) continue;
    if(a.name!==b.name) ops.push({id:'s'+j+':nom',type:'seance_nom',jour:j,de:a.name,a:b.name,seance:b.name});
    const pris=new Set();
    b.exercises.forEach((eb,pos)=>{
      const k=_modCle(eb.name);
      const ia=a.exercises.findIndex((ea,i)=>!pris.has(i)&&_modCle(ea.name)===k);
      if(ia<0){ ops.push({id:'s'+j+':+'+k,type:'ex_ajout',jour:j,nom:eb.name,pos,seance:b.name}); return; }
      pris.add(ia);
      const ea=a.exercises[ia], champs=[];
      for(const c of MOD_CHAMPS) if(_modVal(ea[c])!==_modVal(eb[c])) champs.push({champ:c,de:ea[c]==null?'':ea[c],a:eb[c]==null?'':eb[c]});
      if(ea.h!==eb.h) champs.push({champ:'consigne',de:ea.h,a:eb.h});
      if(champs.length) ops.push({id:'s'+j+':~'+k,type:'ex_modif',jour:j,nom:eb.name,champs,seance:b.name});
    });
    a.exercises.forEach((ea,i)=>{ if(!pris.has(i)) ops.push({id:'s'+j+':-'+_modCle(ea.name),type:'ex_retrait',jour:j,nom:ea.name,seance:b.name}); });
  }
  return ops;
}

/**
 * PURE. Chez UN athlète, ce que chaque opération ferait : {op, etat, coche, detail}.
 *   etat : 'applicable' (coché), 'ajuste' (il a été réglé chez lui : décoché,
 *          et on dit sa valeur), 'deja' (déjà comme le modèle), 'impossible'
 *          (rien sur quoi l'appliquer : pas d'exercice, jour occupé).
 * `direct` : la version reçue n'est plus connue, la comparaison se fait
 * contre son programme tel qu'il est : tout arrive décoché.
 */
function propagationAthlete(config,ops,direct){
  const C=modSlim(config);
  return (ops||[]).map(op=>{
    const s=C[op.jour]||{exercises:[]};
    const r={op,etat:'applicable',coche:true,detail:''};
    const trouve=nom=>s.exercises.find(e=>_modCle(e.name)===_modCle(nom));
    if(op.type==='seance_ajout'){
      if(_modPleine(s)){ r.etat=_modVal(s.name)===_modVal(op.seance)?'deja':'impossible'; r.detail=r.etat==='impossible'?'il a déjà « '+(s.name||'une séance')+' » ce jour-là':''; }
    } else if(op.type==='seance_retrait'){
      if(!_modPleine(s)) r.etat='deja';
    } else if(op.type==='seance_nom'){
      if(!_modPleine(s)) r.etat='impossible';
      else if(s.name===op.a) r.etat='deja';
      else if(s.name!==op.de){ r.etat='ajuste'; r.detail='chez lui : « '+s.name+' »'; }
    } else if(!_modPleine(s)){ r.etat='impossible'; r.detail='pas de séance ce jour-là chez lui'; }
    else if(op.type==='ex_ajout'){ if(trouve(op.nom)) r.etat='deja'; }
    else if(op.type==='ex_retrait'){ if(!trouve(op.nom)) r.etat='deja'; }
    else if(op.type==='ex_modif'){
      const e=trouve(op.nom);
      if(!e){ r.etat='impossible'; r.detail='cet exercice n’est pas dans sa séance'; }
      else {
        const lu=c=>c.champ==='consigne'?e.h:e[c.champ];
        const restants=op.champs.filter(c=>_modVal(lu(c))!==_modVal(c.a));
        if(!restants.length) r.etat='deja';
        else {
          const ajustes=restants.filter(c=>_modVal(lu(c))!==_modVal(c.de));
          if(ajustes.length){ r.etat='ajuste';
            r.detail='chez lui : '+ajustes.map(c=>c.champ==='consigne'?'consigne réécrite':(MOD_LIB_CHAMP[c.champ]||c.champ)+' '+_modVal(lu(c))).join(', '); }
        }
      }
    }
    if(r.etat!=='applicable') r.coche=false;
    if(direct&&r.etat==='applicable'){ r.coche=false; }
    return r;
  });
}

/**
 * PURE. Le prescrit après report des opérations cochées (ids). Rend une
 * COPIE : ni `config` ni rien d'autre du dossier n'est touché. `apres` : les
 * séances ENTIÈRES du modèle (un exercice ajouté arrive avec sa consigne).
 */
function appliquerPropagation(config,ops,ids,apres){
  const out=JSON.parse(JSON.stringify(Array.isArray(config)?config:[]));
  const B=Array.isArray(apres)?apres:[];
  const choix=new Set(ids||[]);
  const exDe=(j,nom)=>(((B[j]||{}).exercises)||[]).find(e=>e&&_modCle(e.name)===_modCle(nom));
  for(const op of (ops||[])){
    if(!choix.has(op.id)) continue;
    const j=op.jour;
    while(out.length<=j) out.push({day:DAYS[out.length]||'',name:'',active:false,exercises:[]});
    const s=out[j];
    if(op.type==='seance_ajout'){ const src=JSON.parse(JSON.stringify(B[j]||{})); delete src._essai; delete src._foundation; out[j]=Object.assign(src,{day:s.day||src.day}); continue; }
    if(op.type==='seance_retrait'){ s.active=false; continue; }
    if(op.type==='seance_nom'){ s.name=op.a; continue; }
    if(!Array.isArray(s.exercises)) s.exercises=[];
    const i=s.exercises.findIndex(e=>e&&_modCle(e.name)===_modCle(op.nom));
    if(op.type==='ex_ajout'){ if(i<0){ const e=exDe(j,op.nom); if(e) s.exercises.splice(Math.min(op.pos,s.exercises.length),0,JSON.parse(JSON.stringify(e))); } continue; }
    if(op.type==='ex_retrait'){ if(i>=0) s.exercises.splice(i,1); continue; }
    if(op.type==='ex_modif'&&i>=0){
      const e=s.exercises[i], src=exDe(j,op.nom)||{};
      for(const c of op.champs){
        const cles=c.champ==='consigne'?MOD_CONSIGNE:[c.champ];
        for(const k of cles){
          if(MOD_PROTEGES.indexOf(k)>=0) continue;
          if(src[k]==null||src[k]==='') delete e[k]; else e[k]=JSON.parse(JSON.stringify(src[k]));
        }
      }
    }
  }
  return out;
}

// PURE. Qui utilise ce modèle : par l'identifiant (lien sûr), ou par le nom
// pour un athlète assigné avant ce lot (lien « par le nom »).
function utilisateursModele(athletes,prog){
  if(!prog) return [];
  const nom=String(prog.name||'').trim().toLowerCase();
  return (athletes||[]).filter(a=>a&&a.sessions_config).map(a=>{
    if(a.assignedProgramId) return a.assignedProgramId===prog.id?{a,lien:'id'}:null;
    const n=String(a.assignedProgramName||'').trim().toLowerCase();
    return (nom&&n===nom)?{a,lien:'nom'}:null;
  }).filter(Boolean);
}
// PURE. La version du modèle reçue par cet athlète, ou null (comparaison directe).
function versionRecue(prog,a){
  if(!prog||!a||!a.assignedProgramId||a.assignedProgramId!==prog.id) return null;
  const v=Number(a.assignedProgramVersion)||0;
  if(v===(Number(prog.majAt)||Number(prog.createdAt)||0)) return 'courante';
  const x=(prog.versions||[]).find(z=>z&&Number(z.at)===v);
  return x||null;
}
// PURE. Les opérations à reporter chez un athlète : {ops, direct, aJour}.
function opsPourAthlete(prog,a,genreParDefaut){
  const g=(a&&a.assignedProgramGenre)||progGenreServi(prog,genreParDefaut||'H');
  const apres=(g==='F'?prog.sessions_F:prog.sessions_H)||[];
  const v=versionRecue(prog,a);
  if(v==='courante') return {ops:[],direct:false,aJour:true,genre:g,apres};
  if(v) return {ops:diffModele(g==='F'?v.F:v.H,apres),direct:false,aJour:false,genre:g,apres};
  return {ops:diffModele((a&&a.sessions_config)||[],apres),direct:true,aJour:false,genre:g,apres};
}

// ── L'ASSIGNATION : LE RÉCAPITULATIF, AVANT D'ÉCRIRE ─────────────────────
// PURE. Coché par défaut dans la liste : oui, sauf s'il a déjà un programme.
function cpaCocheDefaut(a){ try{ return !hasProgram(a); }catch(e){ return true; } }
// PURE. Ce qu'il a aujourd'hui et que l'assignation remplace.
function programmeRemplace(a){
  let has=false; try{ has=hasProgram(a); }catch(e){ has=false; }
  if(!has) return null;
  const l=((a&&a.sessions_config)||[]).filter(_modPleine);
  let bloc=null; try{ bloc=programmeDe(a); }catch(e){ bloc=null; }
  const sem=bloc?Math.floor((Date.now()-bloc.debut)/(7*864e5))+1:0;
  return {nom:String((a&&a.assignedProgramName)||'').trim(),seances:l.length,
    exercices:l.reduce((n,s)=>n+s.exercises.filter(e=>e&&e.name).length,0),
    pdf:!!(a&&(a.programPdfStorageUrl||a.programPdfLink||a.programPdf)),
    bloc:(bloc&&sem>=1&&sem<=bloc.semaines)?{semaine:sem,semaines:bloc.semaines}:null};
}
/**
 * PURE. Le récapitulatif : une ligne par athlète visé.
 *   cibles : [{a, genre}] ; opts.morpho(a, seances) → lignes de revueMorpho ;
 *   opts.brouillon(a) → vrai si le coach a un brouillon de ses séances.
 */
function assignationRecap(cibles,prog,opts){
  const o=opts||{};
  return (cibles||[]).filter(x=>x&&x.a).map(({a,genre})=>{
    const g=progGenreServi(prog,genre||'H');
    const seances=((g==='F'?prog.sessions_F:prog.sessions_H)||[]);
    const rempl=programmeRemplace(a);
    let morpho=[]; try{ morpho=typeof o.morpho==='function'?(o.morpho(a,seances)||[]):[]; }catch(e){ morpho=[]; }
    let bro=false; try{ bro=typeof o.brouillon==='function'&&!!o.brouillon(a); }catch(e){ bro=false; }
    return {a,id:a.id,nom:((a.fname||'')+' '+(a.lname||'')).trim()||a.email||'Athlète',genre:g,
      recoit:{seances:seances.filter(_modPleine).length,exercices:seances.filter(_modPleine).reduce((n,s)=>n+s.exercises.filter(e=>e&&e.name).length,0)},
      remplace:rempl,brouillon:bro,morpho,coche:true};
  });
}
function _c4Prenom(a){ return String((a&&a.fname)||'').trim()||'Cet athlète'; }
// Les lignes morpho, avec le programme du MODÈLE au lieu du sien.
function _c4Morpho(a,seances){
  try{
    const e=_etatRevueMorpho(a,_morphoCalCache(),_morphoAthletesDuCoach(),seances);
    return _revueGrouper(e.lignes||[]).slice(0,REVUE_MORPHO_MAX);
  }catch(e){ return []; }
}
function _htmlRecapLigne(r,i){
  const E=escapeHtml;
  let h='<label class="c4-l'+(r.remplace?' c4-l-rempl':'')+'"><input type="checkbox" data-c4="'+i+'"'+(r.coche?' checked':'')+'>'
    +'<div class="c4-l-c"><div class="c4-l-n">'+E(r.nom)+' <span>version '+r.genre+'</span></div>'
    +'<div class="c4-l-r">Reçoit '+r.recoit.seances+' séance'+(r.recoit.seances>1?'s':'')+', '+r.recoit.exercices+' exercice'+(r.recoit.exercices>1?'s':'')+'.</div>';
  if(r.remplace){
    const x=r.remplace;
    h+='<div class="c4-perdu"><b>Remplace son programme'+(x.nom?' « '+E(x.nom)+' »':'')+'</b> : '
      +(x.seances?x.seances+' séance'+(x.seances>1?'s':'')+' et '+x.exercices+' exercice'+(x.exercices>1?'s':'')+' prescrits':'un programme en PDF')
      +(x.bloc?', en semaine '+x.bloc.semaine+' sur '+x.bloc.semaines+' de son bloc':'')
      +'. Les réglages que tu lui avais faits exercice par exercice partent avec. Son historique, ses charges et ses records restent, et l’ancien programme reste récupérable dans l’historique.</div>';
  }
  if(r.brouillon) h+='<div class="c4-perdu">Tu as un brouillon de ses séances : il ne sera pas appliqué.</div>';
  for(const m of (r.morpho||[]))
    h+='<div class="c4-morpho">'+E(_c4Prenom(r.a))+' : '+E((m.source&&m.source.lib)||'profil morpho')+'. Ce modèle contient '
      +E(m.exercices.join(', '))+'. À envisager : '+E(m.quoi)+', '+E(m.reglage)+'</div>';
  return h+'</div></label>';
}
let _c4Recap=null;
function ouvrirRecapAssignation(recap,prog){
  _c4Recap={recap,prog};
  const n=recap.length, morpho=recap.filter(r=>r.morpho&&r.morpho.length).length;
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">Avant d’assigner</h2>
    <p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:12px">« ${escapeHtml(prog.name||'Ce programme')} » à ${n} athlète${n>1?'s':''}. Rien n’est écrit tant que tu n’as pas confirmé.${morpho?' La revue morpho signale des réglages chez '+morpho+' d’entre eux : aucun exercice n’est retiré, tu ajustes si tu veux.':''}</p>
    <div id="c4-recap">${recap.map(_htmlRecapLigne).join('')}</div>
    <button class="btn btn-red" style="margin-top:14px;width:100%" onclick="assignerDepuisRecap()">Assigner</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
async function assignerDepuisRecap(){
  const x=_c4Recap; if(!x) return false;
  const coches=[...document.querySelectorAll('#c4-recap input[data-c4]')].filter(cb=>cb.checked).map(cb=>x.recap[Number(cb.dataset.c4)]).filter(Boolean);
  if(!coches.length){ toast('Aucun athlète coché.','var(--orange)'); return false; }
  const users=DB.get('users')||{};
  const pushes=[];
  for(const r of coches){
    const k=Object.keys(users).find(kk=>users[kk]&&users[kk].id===r.id);
    if(!k) continue;
    _assignerModele(users[k],x.prog,r.genre);
    pushes.push(CLOUD.pushOne(k,users[k]));
  }
  const ok=DB.set('users',users);
  closeModal();
  _c4Recap=null;
  go('s-coach-programs'); loadCoachProgramsList();
  toastSync(ok,Promise.all(pushes),' Programme assigné à '+pushes.length+' athlète'+(pushes.length>1?'s':'')+' !','le programme est');
  return true;
}

// ── LA PROPAGATION ────────────────────────────────────────────────────────
let _c4Avant=null;   // les séances du modèle à l'ouverture de l'éditeur
function _c4Snapshot(p){ return p?{id:p.id,H:modSlim(p.sessions_H),F:modSlim(p.sessions_F)}:null; }
// Appelé à l'enregistrement : si le contenu a changé, la version d'avant est
// gardée et le modèle date sa nouvelle version.
function modeleVersionner(p,avant,t){
  if(!p||!avant||avant.id!==p.id) return false;
  const now=_c4Snapshot(p);
  if(JSON.stringify([now.H,now.F])===JSON.stringify([avant.H,avant.F])) return false;
  const at=Number(p.majAt)||Number(p.createdAt)||0;
  const v=(Array.isArray(p.versions)?p.versions:[]).filter(z=>z&&Number(z.at)!==at);
  v.unshift({at,H:avant.H,F:avant.F});
  p.versions=v.slice(0,MOD_VERSIONS_MAX);
  p.majAt=Number(t)||Date.now();
  return true;
}
function _c4Athletes(){
  const users=DB.get('users')||{};
  return Object.values(users).filter(u=>{ try{ return _estMonAthlete(u,currentUser); }catch(e){ return false; } });
}
function renderPropagationEntree(){
  const z=document.getElementById('cpt-propag');
  if(!z) return false;
  const p=((currentUser&&currentUser.coachPrograms)||[])[_editProgTemplateIdx];
  if(!p){ z.innerHTML=''; return false; }
  const us=utilisateursModele(_c4Athletes(),p);
  if(!us.length){ z.innerHTML='<div class="c4-entree sub">Personne n’utilise ce modèle pour l’instant.</div>'; return true; }
  const aReporter=us.filter(x=>{ const o=opsPourAthlete(p,x.a); return !o.aJour&&o.ops.length; }).length;
  z.innerHTML='<div class="c4-entree"><span>'+us.length+' athlète'+(us.length>1?'s':'')+' l’utilise'+(us.length>1?'nt':'')
    +(aReporter?', '+aReporter+' n’'+(aReporter>1?'ont':'a')+' pas la dernière version':', tous à jour')+'.</span>'
    +(aReporter?'<button type="button" class="btn btn-outline btn-sm" onclick="ouvrirPropagation()">Reporter chez les athlètes qui l’utilisent</button>':'')+'</div>';
  return true;
}
function _c4LibOp(op){
  const E=escapeHtml;
  if(op.type==='seance_ajout') return 'Nouvelle séance « '+E(op.seance||'')+' »';
  if(op.type==='seance_retrait') return 'Séance « '+E(op.seance||'')+' » retirée';
  if(op.type==='seance_nom') return 'Séance renommée « '+E(op.a)+' »';
  if(op.type==='ex_ajout') return E(op.nom)+' ajouté';
  if(op.type==='ex_retrait') return E(op.nom)+' retiré';
  return E(op.nom)+' : '+op.champs.map(c=>c.champ==='consigne'?'consigne modifiée':E(MOD_LIB_CHAMP[c.champ]||c.champ)+' '+E(_modVal(c.de)||'vide')+' → '+E(_modVal(c.a)||'vide')).join(', ');
}
let _c4Prop=null;
function ouvrirPropagation(){
  const p=((currentUser&&currentUser.coachPrograms)||[])[_editProgTemplateIdx];
  if(!p) return false;
  const lignes=utilisateursModele(_c4Athletes(),p).map(x=>{
    const o=opsPourAthlete(p,x.a);
    let bro=false; try{ bro=!!_brouillonSessionsDe(x.a); }catch(e){ bro=false; }
    return {a:x.a,lien:x.lien,o,res:propagationAthlete(x.a.sessions_config,o.ops,o.direct),brouillon:bro};
  }).filter(l=>!l.o.aJour&&l.o.ops.length);
  if(!lignes.length){ toast('Tous tes athlètes ont déjà la dernière version.','var(--sub)'); return false; }
  _c4Prop={p,lignes};
  const E=escapeHtml;
  const corps=lignes.map((l,i)=>{
    const vis=l.res.filter(r=>r.etat!=='deja');
    return '<div class="c4-ath"><div class="c4-l-n">'+E(((l.a.fname||'')+' '+(l.a.lname||'')).trim()||l.a.email)+' <span>version '+E(l.o.genre)+'</span></div>'
      +(l.o.direct?'<div class="c4-perdu">'+(l.lien==='nom'?'Assigné avant le suivi des versions':'Sa version n’est plus gardée')+' : comparé à son programme tel qu’il est. Tout est décoché, coche ce qui manque vraiment.</div>':'')
      +(l.brouillon?'<div class="c4-perdu">Tu as un brouillon de ses séances : la correction va dans son programme publié, pas dans le brouillon.</div>':'')
      +(vis.length?vis.map(r=>{
        const k=l.res.indexOf(r);
        const off=r.etat==='impossible';
        return '<label class="c4-op'+(off?' c4-op-off':'')+'"><input type="checkbox" data-a="'+i+'" data-o="'+k+'"'+(r.coche?' checked':'')+(off?' disabled':'')+'>'
          +'<span><span class="c4-op-s">'+E(r.op.seance||DAYS[r.op.jour]||'')+'</span> '+_c4LibOp(r.op)
          +(r.detail?'<em>'+E(r.detail)+'</em>':'')+'</span></label>';
      }).join(''):'<div class="sub c4-vide">Déjà comme le modèle.</div>')+'</div>';
  }).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">Reporter la correction</h2>
    <p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin-bottom:12px">Seul le prescrit à venir change. Les séances faites, les charges saisies et ses réglages personnels ne bougent pas. Ce qui a été ajusté chez lui arrive décoché.</p>
    <div id="c4-prop">${corps}</div>
    <button class="btn btn-red" style="margin-top:14px;width:100%" onclick="reporterPropagation()">Reporter</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
function reporterPropagation(){
  const x=_c4Prop; if(!x) return false;
  const choix={};
  document.querySelectorAll('#c4-prop input[data-a]').forEach(cb=>{ if(cb.checked&&!cb.disabled) (choix[cb.dataset.a]=choix[cb.dataset.a]||[]).push(Number(cb.dataset.o)); });
  const users=DB.get('users')||{};
  const pushes=[];
  x.lignes.forEach((l,i)=>{
    const k=Object.keys(users).find(kk=>users[kk]&&users[kk].id===l.a.id);
    if(!k) return;
    const a=users[k];
    const ids=(choix[i]||[]).map(n=>l.res[n]&&l.res[n].op.id).filter(Boolean);
    if(ids.length){
      _pushSessionsHistory(a);
      a.sessions_config=appliquerPropagation(a.sessions_config,l.o.ops,ids,l.o.apres);
    }
    // Le lien est posé, même sans rien cocher : le coach a vu cette version.
    a.assignedProgramId=x.p.id;
    a.assignedProgramGenre=l.o.genre;
    a.assignedProgramVersion=Number(x.p.majAt)||Number(x.p.createdAt)||0;
    a.updatedAt=Date.now();
    pushes.push(CLOUD.pushOne(k,a));
  });
  const ok=DB.set('users',users);
  closeModal();
  _c4Prop=null;
  try{ renderPropagationEntree(); }catch(e){}
  toastSync(ok,Promise.all(pushes),' Correction reportée chez '+pushes.length+' athlète'+(pushes.length>1?'s':''),'la correction est');
  return true;
}

// ── Appliquer un modèle depuis la fiche de l'athlète ────────────────────────
// Sans quitter l'écran : ouvrir la liste des programmes puis revenir coûtait
// jusqu'ici quatre navigations, et faisait perdre le contexte de l'athlète.
let _atGenre={};
function openApplyTemplate(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  if(c._fromCode){toast('Cet athlète n\'a pas encore créé son compte.','var(--orange)');return;}
  const progs=currentUser.coachPrograms||[];
  if(!progs.length){
    toast('Aucun modèle enregistré : crée-en un depuis l\'onglet Programmes.','var(--orange)');
    return;
  }
  // Pré-positionné sur le genre connu de l'athlète : dans la grande majorité
  // des cas le coach n'a rien à toucher, ce qui ramène le geste à deux appuis.
  const genreDefaut=isFemale(c._evol_gender||c.gender)?'F':'H';
  _atGenre={};
  progs.forEach((_,i)=>{_atGenre[i]=genreDefaut;});
  const bg=(actif)=>actif?'var(--red)':'#222';
  const fg=(actif)=>actif?'var(--text)':'var(--sub)';
  const lignes=progs.map((p,i)=>`
    <div style="padding:14px 0;border-bottom:1px solid #181818">
      <div style="font-weight:800;font-size:var(--fs-md);margin-bottom:4px">${escapeHtml(p.name||'Sans nom')}</div>
      <div class="sub" style="font-size:var(--fs-xs);margin-bottom:10px">${_cptCount(p.sessions_H)} séances H · ${_cptCount(p.sessions_F)} séances F</div>
      <div style="display:flex;align-items:center;gap:8px">
        <button onclick="_atSwitchGenre(${i},'H')" id="at-g-H-${i}" style="min-height:44px;min-width:52px;padding:0 12px;border-radius:var(--r-1);border:none;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;background:${bg(genreDefaut==='H')};color:${fg(genreDefaut==='H')}">H</button>
        <button onclick="_atSwitchGenre(${i},'F')" id="at-g-F-${i}" style="min-height:44px;min-width:52px;padding:0 12px;border-radius:var(--r-1);border:none;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;background:${bg(genreDefaut==='F')};color:${fg(genreDefaut==='F')}">F</button>
        <button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="applyTemplateToClient(${i})">Enregistrer</button>
      </div>
    </div>`).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div class="mdl-large" onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:85vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">Appliquer un modèle</h2>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:6px">à ${escapeHtml((c.fname||'')+' '+(c.lname||'')).trim()||'cet athlète'} : version ${genreDefaut==='F'?'F':'H'} pré-sélectionnée</p>
    ${lignes}
    <button class="btn btn-outline" style="margin-top:14px" onclick="closeModal()">Annuler</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function _atSwitchGenre(i,g){
  _atGenre[i]=g;
  const bH=document.getElementById('at-g-H-'+i),bF=document.getElementById('at-g-F-'+i);
  if(!bH||!bF) return;
  bH.style.background=g==='H'?'var(--red)':'#222';bH.style.color=g==='H'?'var(--text)':'var(--sub)';
  bF.style.background=g==='F'?'var(--red)':'#222';bF.style.color=g==='F'?'var(--text)':'var(--sub)';
}
async function applyTemplateToClient(idx){
  const prog=(currentUser.coachPrograms||[])[idx];
  if(!prog) return;
  const users=DB.get('users')||{};
  const emailKey=Object.keys(users).find(k=>users[k]?.id===currentClientId);
  if(!emailKey){toast('Athlète introuvable','var(--orange)');return;}
  const a=users[emailKey];
  const genre=_atGenre[idx]||'H';
  // Remplacer un programme existant est destructeur : on le dit, et on rappelle
  // que l'historique permet un retour en arrière. Aucun athlète sans programme
  // n'a à subir cette question — le geste reste à deux appuis dans ce cas.
  if(hasProgram(a)){
    const rollback=a.sessions_config
      ?'\n\nL\'ancien programme sera sauvegardé dans l\'historique (rollback possible).':'';
    if(!await rcConfirm('Remplacer le programme actuel de '+(a.fname||'cet athlète')
      +' par « '+(prog.name||'ce modèle')+' » (version '+genre+') ?'+rollback,null,'Remplacer')) return;
  }
  _assignerModele(a,prog,genre);
  users[emailKey]=a;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(emailKey,a);
  closeModal();
  openClientDetail(currentClientId,true);
  toastSync(ok,envoi,'« '+(prog.name||'Modèle')+' » appliqué à '+(a.fname||'l\'athlète'),'le programme est');
}

// ======= COACH SESSION MANAGER =======
let _coachEditClient=null;
// L'OUVERTURE DE L'ÉDITEUR, EN TROIS TEMPS.
//
// Elle était en un seul, et _proposerBrouillon n’y était pas attendue : tout
// ce qui suit s’exécutait pendant que la question était encore posée. La garde
// de migration jugeait le PUBLIÉ, la grille se dessinait sur le publié, et une
// reprise acceptée remplaçait sessions_config sans que l’écran soit redessiné.
//
// LES DEUX MOITIÉS RESTENT SYNCHRONES. Cinq assertions de la suite intégrée
// exécutent ce chemin, et testExercices() est synchrone : tout rendre
// asynchrone les aurait fait lire l’état d’AVANT la migration et passer au vert
// sans rien mesurer.
//
// Son unique appelant est un onclick= : « lance et oublie », rien à changer.
async function openCoachSessions(){
  if(!_seancesCoachPreparer()) return;
  // ATTENDUE. C’est tout le lot.
  try{ await _proposerBrouillon(); }catch(e){}
  // ELLE EST `async`, ET C'EST CE QUI RENDAIT LA PANNE INVISIBLE : une
  // exception dans _seancesCoachRendre ne remontait pas au clic, elle
  // partait en rejet de promesse non traité. Le coach appuyait sur
  // « Gérer le programme » et rien ne se passait — pas d'écran, pas de
  // message, et selon le navigateur pas même une ligne dans la console.
  try{ _seancesCoachRendre(); }
  catch(e){
    try{ console.error("Ouverture des séances de l’athlète impossible",e); }catch(_e){}
    toast("Le programme de cet athlète n’a pas pu s’ouvrir : "+((e&&e.message)||"erreur inconnue")
      +". Signale-le, la console en garde le détail.","var(--red)");
  }
}
// LE MÊME CHEMIN, SANS LA QUESTION. Employé par la suite intégrée, qui est
// synchrone, et qui n’a rien à tester du brouillon ici.
function ouvrirSeancesSansBrouillon(){
  if(!_seancesCoachPreparer()) return false;
  _seancesCoachRendre();
  return true;
}
// Prend le dossier et en fait une copie de travail. Rend false quand il n’y a
// rien à ouvrir — les deux gardes d’origine, inchangées.
function _seancesCoachPreparer(){
  const c=getOwnedClient(currentClientId);
  // Ce garde sortait en silence, comme les autres de ce chemin : le coach
  // appuyait et rien ne se passait. Il se déclenche quand la fiche a été
  // ouverte puis le dossier remplacé par une synchronisation.
  if(!c){
    try{ toast('Athlète introuvable : reviens à la liste et rouvre sa fiche.','var(--orange)'); }catch(_e){}
    return false;
  }
  if(c._fromCode){toast('Cet athlète n\'a pas encore créé son compte.','var(--orange)');return false;}
  _coachEditClient=JSON.parse(JSON.stringify(c));
  return true;
}
// Migration éventuelle, titre, écran, grille. Lit la configuration RETENUE :
// appelée après la réponse, elle ne peut plus juger le publié à sa place.
function _seancesCoachRendre(){
  // LA GRILLE REMISE À L'ENDROIT AVANT LA PREMIÈRE LECTURE. `sc.some` plus
  // bas est une méthode de TABLEAU, et Firebase rend parfois un OBJET :
  // elle levait alors ici, AVANT go(), et l'appelant est `async` — donc en
  // rejet de promesse non traité. Voir _normaliserSessionsConfig.
  //
  // SEULEMENT SI QUELQUE CHOSE EST LÀ : sans cette condition, la grille
  // vide fabriquée ici passerait pour un programme, et la Fondation posée
  // juste en dessous ne le serait plus jamais pour un nouvel athlète.
  if(_coachEditClient.sessions_config&&!Array.isArray(_coachEditClient.sessions_config))
    _normaliserSessionsConfig(_coachEditClient);
  const sc=_coachEditClient.sessions_config;
  // _evol_gender n'existe qu'à partir du premier bilan. Un athlète créé par le
  // coach porte son genre dans .gender et rien d'autre : lu seul, _evol_gender
  // valait undefined, aucune Fondation ne correspondait, et le coach héritait
  // de la liste générique defEx pour une athlète femme. On retombe donc sur
  // .gender, via isFemale qui absorbe les conventions historiques
  // ('F', 'f', 'femme'). g sert AUSSI au test de migration plus bas : la
  // normalisation profite aux deux.
  const _gBrut=_coachEditClient._evol_gender||_coachEditClient.gender;
  const g=isFemale(_gBrut)?'F':(_gBrut?'H':null);
  // Init sessions_config si absent
  // ⚠ SEPT CRENEAUX VIDES, QUEL QUE SOIT LE GENRE. La grille partait de la
  // Fondation quand le genre etait connu : le coach ouvrait la fiche d'un
  // nouvel athlete et trouvait trois seances de six exercices qu'il n'avait
  // pas ecrites. Une grille vide dit la verite — il n'y a pas encore de
  // programme — et c'est la meme regle que pour l'athlete.
  if(!_coachEditClient.sessions_config){
    _coachEditClient.sessions_config=_seancesViergesSemaine();
  }
  // MIGRATION VERS FONDATION — seulement sur une grille qui ne porte RIEN.
  //
  // La garde reposait sur `_foundation`. Ce marqueur est SUPPRIMÉ par
  // _marquerCommePublie à chaque publication, et enregistrerBrouillon ne le
  // recopie pas : dès qu’un programme était publié, la garde ne le
  // reconnaissait plus. Un vrai programme dont les séances actives n’avaient
  // pas de nom était donc remplacé par FONDATION_H/F à la simple OUVERTURE de
  // cet écran, sans un mot et sans que rien ne soit encore enregistré.
  //
  // On ne regarde plus qu’une chose, visible et durable : cette configuration
  // porte-t-elle une séance ACTIVE avec des exercices, ou un nom ?
  //
  // LE NOM COMPTE AUTANT QUE LES EXERCICES. Un coach qui a nommé ses quatre
  // séances avant d’y mettre le moindre mouvement a déjà fait un travail :
  // migrer par-dessus le lui prendrait, et ce serait la même perte silencieuse
  // que celle qu’on corrige ici, simplement déplacée.
  //
  // Les Fondations elles-mêmes portent des séances actives avec exercices :
  // une config déjà migrée ne peut donc pas l’être une seconde fois.
  // ⚠ LA MIGRATION VERS LA FONDATION EST SUPPRIMEE. Le commentaire ci-dessus
  // raconte comment elle a deja coute le travail d'un coach une premiere fois,
  // et comment sa garde a ete resserree. Le lot du 16/09/2026 va plus loin :
  // il n'y a plus de pose automatique du tout, donc plus de garde a tenir
  // juste. Une grille vide reste vide jusqu'a ce que quelqu'un la remplisse.
  const title=document.getElementById('csm-title');
  if(title) title.textContent=(_coachEditClient.fname||'Athlète')+' : Séances';
  go('s-coach-sessions');
  loadCoachSessionSlots();
}

// Versions precedentes de la configuration de seances. Alimente par
// _snapshotSessionsConfig, appele avant chaque application de modele.
function renderSessionsHistory(){
  const box=document.getElementById('csm-history');
  const list=document.getElementById('csm-history-list');
  if(!box||!list) return;
  const hist=(_coachEditClient&&_coachEditClient.sessions_config_history)||[];
  if(!hist.length){box.style.display='none';return;}
  box.style.display='block';
  const n=document.getElementById('csm-history-n');
  if(n) n.textContent=hist.length;
  list.innerHTML=hist.map((e,i)=>{
    const d=new Date(e.ts).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    const actifs=((e.sessions_config)||[]).filter(s=>s&&s.active).length;
    return `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid #1a1a1a">
      <div style="min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text-strong)">${escapeHtml(d)}</div>
        <div class="sub" style="font-size:var(--fs-xs)">${actifs} jour${actifs>1?'s':''} actif${actifs>1?'s':''}</div>
      </div>
      <button class="btn btn-outline btn-sm" style="flex-shrink:0;margin:0" onclick="restaurerSessionsConfig(${i})">Restaurer</button>
    </div>`;
  }).join('');
}
// Restauration : on remet la copie en memoire et on redessine. On N'ENREGISTRE
// PAS — le coach valide par SAUVEGARDER, comme pour toute autre modification.
// C'est ce qui lui laisse une porte de sortie s'il s'est trompe de version.
async function restaurerSessionsConfig(i){
  const hist=(_coachEditClient&&_coachEditClient.sessions_config_history)||[];
  const e=hist[i];
  if(!e||!e.sessions_config) return;
  const d=new Date(e.ts).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  // N3.12 — LE BOUTON DE CET ECRAN S'APPELLE PUBLIER. Ces deux messages
  // envoyaient le coach chercher un « SAUVEGARDER » qui appartient a l'editeur
  // d'exercices, un autre ecran : il ne le trouvait pas, quittait, et la
  // restauration etait perdue — l'athlete gardait le programme d'avant.
  // Le comportement ne change pas : rien n'est enregistre tant qu'il n'a pas
  // valide.
  if(!await rcConfirm("Restaurer la configuration du "+d+" ?\n\n"
    +"Le programme affiché sera remplacé. Rien n'est enregistré tant que tu n'as "
    +"pas touché PUBLIER.",null,'Confirmer')) return;
  _coachEditClient.sessions_config=JSON.parse(JSON.stringify(e.sessions_config));
  loadCoachSessionSlots();
  renderSessionsHistory();
  toast('Version du '+d+' chargée : valide par PUBLIER','var(--orange)');
}
function loadCoachSessionSlots(){
  // Redessine aussi l'historique : l'ecran peut etre rouvert apres qu'un
  // modele a ete applique, donc apres qu'une version a ete archivee.
  try{renderSessionsHistory();}catch(e){}
  // N4.1 — et le bloc de plusieurs semaines, qui se lit au-dessus de la
  // grille : c'est le cadre dans lequel elle s'applique.
  try{renderCoachSessionsBloc();}catch(e){}
  try{
    const _bb=document.getElementById('cs-bandeau-brouillon');
    if(_bb) _bb.innerHTML=_htmlBandeauBrouillon();
  }catch(e){}
  const c=_coachEditClient;
  // LA GRILLE DU PRÉCÉDENT NE RESTE JAMAIS À L'ÉCRAN. Ce garde sortait sans
  // rien redessiner : le coach ouvrait l'athlète suivant et lisait encore
  // les séances de celui d'avant, en croyant lire les siennes. Vider est la
  // seule chose honnête à faire quand on n'a rien à montrer.
  if(!c?.sessions_config){
    const _vide=document.getElementById('coach-session-slots');
    if(_vide) _vide.innerHTML='';
    return;
  }
  // Rend un TABLEAU de sept créneaux quoi qu'il arrive, même si Firebase a
  // rendu un objet : sans lui, le sessions.map plus bas levait et laissait,
  // là encore, la grille du précédent en place.
  const sessions=_normaliserSessionsConfig(c);
  try{ renderVolumePrescrit(sessions,c); }catch(e){}
  const container=document.getElementById('coach-session-slots');
  if(!container) return;
  container.innerHTML=sessions.map((s,i)=>`
    <div style="background:var(--surface-1);border-radius:var(--r-4);margin-bottom:14px;overflow:hidden;border:1.5px solid ${s.active?'var(--red)':'var(--border)'}">
      <div style="background:${s.active?'linear-gradient(135deg,#1a0000,#2a0000)':'var(--surface-2)'};padding:14px 16px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:${s.active?'var(--red)':'var(--surface-2)'};border-radius:var(--r-1);display:flex;align-items:center;justify-content:center;font-size:var(--fs-xs);font-weight:900;letter-spacing:.5px;flex-shrink:0">${DAY_ICONS[i]}</div>
          <div>
            <div style="font-weight:800;font-size:var(--fs-lg)">${s.day}</div>
            <div class="sub" style="font-size:var(--fs-xs);margin-top:1px" id="csm-sub-${i}">${s.active?(escapeHtml(s.name)||'Séance sans nom'):'Jour de repos'}</div>
          </div>
        </div>
        <div onclick="coachToggleDay(${i})" style="width:44px;height:24px;border-radius:var(--r-3);background:${s.active?'var(--red)':'var(--border)'};position:relative;cursor:pointer;transition:background var(--t-3);flex-shrink:0" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
          <div style="position:absolute;width:18px;height:18px;border-radius:var(--r-2);background:#fff;top:3px;left:3px;transition:transform var(--t-3);transform:translateX(${s.active?'20px':'0px'})"></div>
        </div>
      </div>
      ${s.active?`
      <div style="padding:14px 16px">
        <div style="margin-bottom:12px">
          <label style="margin-top:0">Nom de la séance</label>
          <input value="${escapeHtml(s.name||'')}" placeholder="Ex: DOS & BICEPS" onchange="coachRenameSession(${i},this.value)" style="margin-top:4px">
        </div>
        <label class="hit44" style="display:flex;align-items:center;gap:8px;margin:0 0 12px;cursor:pointer;text-transform:none;letter-spacing:normal;font-weight:400;font-size:var(--fs-xs);color:var(--sub)">
          <input type="checkbox" ${s.deload?'checked':''} onchange="coachToggleDeload(${i},this.checked)" style="width:16px;height:16px;margin:0;accent-color:var(--info);flex-shrink:0">
          Séance de décharge : elle ne comptera pas dans la détection de plateau
        </label>
        <button class="btn btn-red btn-sm" style="width:100%" onclick="openCoachSessionExercises(${i})"> Modifier les exercices (${s.exercises?.length||0})</button>
        ${_boutonsCopieJour('coachCopyDay',i)}
      </div>`:''}
    </div>
  `).join('');
  // LE BOUTON DIT CE QUE LE BANDEAU DIT DEJA, mais lui reste sous les yeux :
  // le bandeau se defile hors de vue des la premiere seance ouverte.
  const _bp=document.getElementById('csm-publier');
  if(_bp){
    const _att=!!_htmlBandeauBrouillon();
    _bp.classList.toggle('btn-attente',_att);
    _bp.textContent=_att?'PUBLIER •':'PUBLIER';
  }
}

// Transformer le programme abouti d'un athlète en modèle réassignable, sans
// ressaisir un exercice.
async function saveCoachSessionsAsTemplate(){
  const c=_coachEditClient;
  if(!c) return;
  const src=c.sessions_config||[];
  if(!src.some(s=>s.active&&s.exercises?.length)){
    toast('Aucune séance à enregistrer : active au moins un jour avec des exercices.','var(--orange)');
    return;
  }
  const defaut=((c.fname||'Athlète')+' : '+new Date().toLocaleDateString('fr-FR'));
  const nom=(await rcSaisie('Nom du modèle ?',defaut,{libelleOk:'Enregistrer'})||'').trim();
  if(!nom) return; // annulé, ou nom vide
  // Les photos de séance sont écartées : elles sont en base64 et les modèles
  // vivent dans currentUser, poussé en entier à chaque synchro. Sept jours de
  // photos y ajouteraient plusieurs Mo, pour une valeur nulle dans un modèle.
  // Les marqueurs d'exemple sautent aussi : un modèle est un choix délibéré.
  const copie=()=>src.map(s=>({
    day:s.day,name:s.name||'',active:!!s.active,notes:s.notes||'',
    warmup:s.warmup||'',cooldown:s.cooldown||'',photo:null,photo2:null,
    // Clone PROFOND. Sans lui, un tableau imbriqué restait partagé entre le
    // modèle et le dossier de l'athlète dont il est tiré — et entre les deux
    // onglets H et F, que copie() est justement appelée deux fois pour rendre
    // indépendants.
    exercises:JSON.parse(JSON.stringify(s.exercises||[]))
  }));
  if(!currentUser.coachPrograms) currentUser.coachPrograms=[];
  currentUser.coachPrograms.push({
    id:Date.now().toString(36),name:nom,createdAt:Date.now(),
    // SON RAYON, dans « Mes programmes » : sous « Enregistrés depuis un
    // athlète », juste en dessous de ceux crees de zero. Le prenom seul — il
    // dit d'ou vient le programme, le dossier de l'athlete n'a rien a y faire.
    origine:'athlete',depuis:String(c.fname||'').trim().slice(0,40),
    // Les deux genres partent de la même copie : le coach adapte l'autre.
    sessions_H:copie(),sessions_F:copie()
  });
  // L'AUTRE VERSION, nommee : « l'onglet F » etait faux pour une athlete.
  const _autre=isFemale(c._evol_gender||c.gender||'')?'Homme':'Femme';
  toastEcriture(saveUser(),'« '+nom+' » ajouté à Mes programmes : adapte la version '+_autre,'le programme est');
}

// Une decharge est PLANIFIEE par le coach, pas constatee apres coup : elle ne
// doit pas pouvoir servir a effacer une mauvaise seance de l historique.
// CE QUE L’ÉDITEUR DE SÉANCES POSSÈDE — et rien d’autre.
//
// `_coachEditClient` est une copie PROFONDE du dossier ENTIER, prise à
// l’ouverture de l’écran. L’écrire telle quelle rendait le dossier à son état
// d’il y a dix minutes : les séances faites, le bilan, le poids et les photos
// enregistrés par l’athlète PENDANT l’édition étaient effacés.
//
// Et le garde-fou de _doPushOne ne pouvait pas rattraper ça : il refuse un
// envoi dont l’updatedAt est plus ancien que le distant, or celui de la copie
// vient d’être remis à maintenant. Un écrasement local passait donc pour une
// mise à jour légitime jusque dans le cloud.
//
// On ne remplace plus l’objet : on relit le dossier stocké et on y REPORTE
// ces champs-là. Tout le reste appartient à l’athlète.
const COACH_CHAMPS_SEANCES=['sessions_config','sessions_config_history',
  'assignedProgramName','assignedProgramAt','assignedProgramId','assignedProgramGenre','assignedProgramVersion'];
// `in` et non un test de vérité : assignedProgramAt peut valoir 0 ou null,
// et un `if(edite[champ])` laisserait ces valeurs-là derrière lui.
function _reporterSeances(stocke,edite){
  if(!stocke||!edite) return stocke;
  for(const champ of COACH_CHAMPS_SEANCES) if(champ in edite) stocke[champ]=edite[champ];
  stocke.updatedAt=Date.now();
  return stocke;
}
// LA DÉCHARGE N’EST PAS PUBLIÉE PAR UNE CASE À COCHER.
//
// Cette fonction envoyait `_coachEditClient` chez l’athlète. Or
// `_coachEditClient` EST le brouillon : l’écran affiche au même instant le
// bandeau « Non publié — ces modifications ne sont pas encore chez ton
// athlète ». Cocher une case publiait donc tout le travail en cours, en
// contredisant ce que l’écran venait d’écrire au coach.
//
// Elle se range avec coachToggleDay et coachRenameSession, juste en dessous :
// elle touche le brouillon, et PUBLIER seul écrit. Les caches de plateau et
// de signaux sont vidés parce qu’ils sont calculés à partir des séances et
// que l’écran du coach les relit tout de suite.
//
// loadCoachSessionSlots redessine le bandeau : sans lui, le coach cocherait
// la case sans voir apparaître le « Non publié » qui l’attend.
function coachToggleDeload(i,val){
  const c=_coachEditClient; if(!c?.sessions_config?.[i]) return;
  c.sessions_config[i].deload=!!val;
  _viderCachePlateau();
  _viderCacheSignaux();
  loadCoachSessionSlots();
}
function coachToggleDay(i){
  if(!_coachEditClient?.sessions_config) return;
  const s=_coachEditClient.sessions_config[i];
  s.active=!s.active;
  if(s.active) _garnirSeanceVierge(s);
  loadCoachSessionSlots();
}
function coachRenameSession(i,val){
  if(!_coachEditClient?.sessions_config) return;
  _coachEditClient.sessions_config[i].name=val;
  const sub=document.getElementById('csm-sub-'+i);
  if(sub) sub.textContent=val||'Séance sans nom';
}
function openCoachSessionExercises(idx){
  const c=_coachEditClient;
  // UN BOUTON QUI NE FAIT RIEN N APPREND RIEN. Ce garde sortait en silence : si
  // le dossier a ete remplace entre le rendu et le clic — la synchronisation
  // tourne toutes les 5 minutes — le coach appuyait dans le vide.
  if(!c?.sessions_config?.[idx]){
    try{ toast("Séance introuvable : rouvre la fiche de l'athlète.",'var(--orange)'); }catch(e){}
    return;
  }
  const s=c.sessions_config[idx];
  // TOUT LE MONTAGE EST SOUS FILET, et pas seulement le rendu : la copie
  // des exercices, les champs du formulaire, le titre et le rendu peuvent
  // chacun lever. Sans lui, l'exception remontait au gestionnaire de clic
  // et le bouton restait muet, quel que soit le maillon qui a cassé.
  try{
  _assainirExercices(s);
  progEx=JSON.parse(JSON.stringify(s.exercises||[]));_photographierProgEx();
  _prepProgEditor({name:s.name,notes:s.notes,warmup:s.warmup,cooldown:s.cooldown||currentUser._defaultCooldown});
  _progEditorCtx={mode:'coachClient',sessionIdx:idx};
  _majCtxEditeur();
  const backBtn=document.querySelector('#s-coach-program .back-btn');
  if(backBtn) backBtn.onclick=async ()=>{if(_progExDirty&&!await rcConfirm('Modifications non enregistrées : quitter quand même ?',null,'Quitter'))return;_progEditorCtx={mode:'clientProgram'};_majCtxEditeur();go('s-coach-sessions');loadCoachSessionSlots();};
  const title=document.querySelector('#s-coach-program .topbar-title');
  if(title) title.textContent=(s.name||DAYS[idx])+' : Exercices';
  renderProgEx();go('s-coach-program');
  _progExDirty=false;
  }catch(e){ return _echecOuvertureEditeur(e); }
}
// ══════ BROUILLON DE PROGRAMME ══════
// Il vit dans le dossier DU COACH, pas dans celui de l'athlète. Trois raisons,
// dans cet ordre :
//   • l'athlète ne doit rien voir — le mettre chez lui l'exposerait à son
//     propre export RGPD, où il lirait un programme non publié ;
//   • le document de l'athlète est relu ET réécrit à chaque envoi : y ajouter
//     un second jeu de séances doublerait son poids pour rien ;
//   • c'est le travail du coach, il appartient au coach.
const BROUILLON_MAX=30;
// Trente jours : au-delà, un brouillon décrit un athlète qui a changé, et le
// restaurer ferait plus de mal que de bien. On ne le SUPPRIME pas pour autant
// — voir _brouillonsElaguer, qui ne retire que le surnombre.
const BROUILLON_PEREMPTION_J=30;
function _brouillons(user){
  const u=_dossier(user);
  if(!u) return {};
  if(!u.brouillonsProg||typeof u.brouillonsProg!=='object') u.brouillonsProg={};
  return u.brouillonsProg;
}
// PURE. Rend le brouillon d'un athlète, ou null. Un brouillon périmé est rendu
// quand même, avec son âge : c'est à l'écran de le dire, pas à la lecture de
// le cacher.
function brouillonDe(athleteId,user){
  const b=_brouillons(user)[athleteId];
  return (b&&Array.isArray(b.sessions_config))?b:null;
}
function brouillonAgeJours(b){
  return (b&&b.at)?Math.floor((Date.now()-b.at)/86400000):null;
}
function brouillonEstPerime(b){
  const a=brouillonAgeJours(b);
  return a!==null&&a>BROUILLON_PEREMPTION_J;
}
// Ne garde que les BROUILLON_MAX plus récents. On élague par date, jamais par
// péremption : un brouillon vieux de six mois reste celui du coach, et le
// supprimer d'office lui ferait perdre du travail sans le lui demander.
function _brouillonsElaguer(user){
  const u=_dossier(user); if(!u) return;
  const b=_brouillons(u);
  const cles=Object.keys(b);
  if(cles.length<=BROUILLON_MAX) return;
  cles.sort((x,y)=>(b[y].at||0)-(b[x].at||0));
  for(const c of cles.slice(BROUILLON_MAX)) delete b[c];
}
// Enregistre l'état courant de _coachEditClient comme brouillon. N'ÉCRIT PAS
// chez l'athlète : c'est tout l'objet du brouillon.
//
// Les photos de séance sont ÉCARTÉES. Elles sont en base64, et le dossier du
// coach est poussé en entier à chaque synchro : sept jours de photos y
// ajouteraient plusieurs mégaoctets. Elles restent dans _coachEditClient et
// repartent à la publication ; seule la reprise APRÈS fermeture les perd, et
// c'est un compromis assumé plutôt qu'un quota explosé.
function enregistrerBrouillon(user){
  const u=_dossier(user);
  const c=_coachEditClient;
  if(!u||u.role!=='coach'||!c||!c.id||!Array.isArray(c.sessions_config)) return false;
  _brouillons(u)[c.id]={
    at:Date.now(),
    nom:c.fname||'',
    sessions_config:c.sessions_config.map(sc=>({
      day:sc.day, name:sc.name||'', active:!!sc.active, notes:sc.notes||'',
      warmup:sc.warmup||'', cooldown:sc.cooldown||'',
      // `deload` était absent : un brouillon repris effaçait la décharge en
      // silence, et brouillonDiffere aurait comparé un champ que le brouillon
      // ne savait pas transporter.
      deload:!!sc.deload,
      exercises:(sc.exercises||[]).map(e=>Object.assign({},e))
    }))
  };
  _brouillonsElaguer(u);
  return true;
}
function oublierBrouillon(athleteId,user){
  const u=_dossier(user); if(!u||!athleteId) return false;
  const b=_brouillons(u);
  if(!(athleteId in b)) return false;
  delete b[athleteId];
  return true;
}
// PURE. Le brouillon diffère-t-il de ce qui est publié ? Sert au bandeau : un
// brouillon identique au publié n'a rien à annoncer, et l'annoncer quand même
// apprendrait au coach à ignorer le bandeau.
function brouillonDiffere(b,publie){
  if(!b||!Array.isArray(b.sessions_config)) return false;
  const net=cfg=>JSON.stringify((cfg||[]).map(s=>({
    // `dl` : sans lui, cocher « Séance de décharge » ne déclenchait aucun
    // bandeau — le coach quittait l’écran en croyant n’avoir rien modifié.
    d:s.day,n:s.name||'',a:!!s.active,no:s.notes||'',w:s.warmup||'',c:s.cooldown||'',
    dl:!!s.deload,
    e:(s.exercises||[]).map(x=>({n:x.name||'',s:x.series,r:x.reps,p:x.repos,
      d:x.description||'',ss:!!x.ss,t:x.methode||null}))
  })));
  return net(b.sessions_config)!==net(publie);
}

// Propose la reprise d'un brouillon. Rend true s'il a été repris.
async function _proposerBrouillon(){
  const c=_coachEditClient;
  if(!c||!c.id) return false;
  const b=brouillonDe(c.id);
  if(!b) return false;
  if(!brouillonDiffere(b,c.sessions_config)){
    // Identique au publié : rien à reprendre, et le brouillon a fait son
    // temps. On le retire pour ne pas reposer la question à chaque ouverture.
    if(oublierBrouillon(c.id)) try{ saveUser(); }catch(e){}
    return false;
  }
  const age=brouillonAgeJours(b);
  const quand=age===0?"aujourd'hui":(age===1?'hier':('il y a '+age+' jours'));
  const vieux=brouillonEstPerime(b)
    ?'\n\nIl a plus de '+BROUILLON_PEREMPTION_J+' jours : vérifie qu\'il correspond encore à cet athlète.'
    :'';
  const ok=await rcConfirm('Tu as un brouillon non publié pour cet athlète ('+quand+').'
    +vieux+'\n\nOK : reprendre le brouillon.\nAnnuler : repartir du programme publié.',null,'Confirmer');
  if(!ok){
    if(oublierBrouillon(c.id)) try{ saveUser(); }catch(e){}
    return false;
  }
  // Les photos ne sont pas dans le brouillon : on les REPREND du publié
  // plutôt que de les perdre.
  const parJour={}; (c.sessions_config||[]).forEach(sc=>{ parJour[sc.day]=sc; });
  c.sessions_config=b.sessions_config.map(sc=>{
    const anc=parJour[sc.day]||{};
    return Object.assign({},sc,{photo:anc.photo||null,photo2:anc.photo2||null});
  });
  toast('Brouillon repris','var(--green)');
  return true;
}
// Le bandeau de l'écran des séances : il DIT qu'un travail n'est pas encore
// chez l'athlète. Sans lui, un coach croit avoir publié parce qu'il a vu
// « Séance enregistrée ».
function _htmlBandeauBrouillon(){
  const c=_coachEditClient;
  if(!c||!c.id) return '';
  const users=DB.get('users')||{};
  const publie=(Object.values(users).find(u=>u&&u.id===c.id)||{}).sessions_config||[];
  if(!brouillonDiffere({sessions_config:c.sessions_config},publie)) return '';
  return '<div style="background:linear-gradient(135deg,#2a1a00,#160e00);border:1.5px solid var(--orange);'
    +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">'
    +'<div style="font-weight:900;font-size:var(--fs-xs);color:var(--orange);text-transform:uppercase;'
    +'letter-spacing:1px;margin-bottom:6px">Non publié</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6">Ces modifications ne sont pas '
    +'encore chez ton athlète. Il voit toujours son programme précédent. '
    +'Touche PUBLIER, en haut de cet écran, quand tu as terminé.</div></div>';
}
function saveCoachSessions(){
  const c=_coachEditClient;
  if(!c) return;
  // N3.10 — LE CONTENU ET LA CIBLE VIENNENT DE DEUX SOURCES : le programme
  // publie est lu dans _coachEditClient, l'athlete destinataire dans
  // currentClientId, et RIEN ne verifiait que les deux designent la meme
  // personne. Le getOwnedClient ci-dessous ne controle que la propriete de la
  // CIBLE — pas l'appartenance du brouillon.
  // _coachEditClient n'est pose que par _seancesCoachPreparer et n'etait remis
  // a null nulle part : ni par _comptesRemiseAZero, ni au changement d'athlete.
  // Publier le programme de A dans le dossier de B est le pire accident que
  // cet ecran puisse produire, et il ne s'annonce par rien.
  // On refuse, on le DIT, et le brouillon est abandonne au changement de
  // contexte (voir openClientDetail).
  if(c.id&&currentClientId&&c.id!==currentClientId){
    _coachEditClient=null;
    toast('Ce brouillon est celui d’un autre athlète : rouvre son programme depuis sa fiche.','var(--red)');
    return;
  }
  const users=DB.get('users')||{};
  if(!getOwnedClient(currentClientId,users)) return;
  const emailKey=Object.keys(users).find(k=>users[k]?.id===currentClientId);
  if(!emailKey){toast('Athlète introuvable','var(--orange)');return;}
  // L'instantané se pose sur l'objet STOCKÉ, mais la ligne qui suivait
  // — users[emailKey]=c — le remplaçait par _coachEditClient, copie profonde
  // prise à l'ouverture de l'écran. L'entrée qui venait d'être créée était donc
  // jetée à chaque sauvegarde, et la liste de rollback du coach ne grossissait
  // jamais. On archive la version stockée, puis on REPORTE l'historique sur la
  // copie qui va être écrite.
  _pushSessionsHistory(users[emailKey]); // snapshot avant écrasement
  c.sessions_config_history=users[emailKey].sessions_config_history;
  // Le coach publie : ce n'est plus un repli, même s'il valide la Fondation
  // telle quelle. Sans ça, l'athlète continuerait de lire « ton coach n'a pas
  // encore publié ton programme » devant un programme bel et bien publié.
  _marquerCommePublie(c.sessions_config);
  // ON REPORTE, ON NE REMPLACE PAS : voir _reporterSeances. `users[emailKey]`
  // est le dossier RELU à l’instant, avec ce que l’athlète y a écrit depuis
  // l’ouverture de l’éditeur.
  const stocke=_reporterSeances(users[emailKey],c);
  // ⚠ LE PROGRAMME ECRIT POUR QUELQU'UN EST DATE ICI (lot 9), une seule fois.
  //   C'est ce qui ouvre la revision a 40 € chez lui : reviser un plan qu'on
  //   n'a pas ne veut rien dire, et cette date est le seul endroit du produit
  //   qui sache qu'un plan a ete ECRIT POUR LUI. Elle ne se repose jamais :
  //   une deuxieme publication n'est pas un deuxieme plan.
  if(!stocke.programmePerso||!Number(stocke.programmePerso.le))
    stocke.programmePerso={le:Date.now(),par:String((currentUser&&currentUser.id)||'')};
  c.updatedAt=stocke.updatedAt;
  users[emailKey]=stocke;
  // LOT C1 : publié pendant l'accueil et pas encore lu : la relance « programme » part à son jour.
  try{ accueilRelanceProgramme(stocke).catch(()=>{}); }catch(e){}
  // Publié : le brouillon n'a plus de raison d'être, et le garder ferait
  // proposer une reprise vers un état identique à la prochaine ouverture.
  if(oublierBrouillon(c.id)) try{ saveUser(); }catch(e){}
  const localOk=DB.set('users',users);
  // « Enregistrement… » écraserait l'avertissement de quota émis par DB.set.
  if(localOk) toast('Enregistrement…');
  // LA PUBLICATION EST FAITE. Tout ce qui precede — DB.set, l historique, le
  // marquage, le report, l oubli du brouillon, la poussee distante — s est
  // execute de facon synchrone. SEULE la navigation est retardee, de 420 ms,
  // le temps que le bouton dise que c est parti.
  // LE LIBELLE ET LE VERROU ONT LIEU DANS TOUS LES CAS : le bouton disait
  // encore « PUBLIER • » pendant sa propre celebration — le point est le
  // marqueur « non publie » — et un second appui pendant la sortie
  // republierait. Ce ne sont pas des decorations, ils sortent du if.
  const _b=document.getElementById('csm-publier');
  if(_b){
    _b.classList.remove('btn-attente');
    _b.textContent='PUBLIÉ ✓';
    _b.disabled=true;
    if(!arcReduit()) _b.classList.add('celebrate');
  }
  // N4.11 — PUBLIER NE RENVOIE PLUS LE COACH AILLEURS. Il etait ramene de
  // force sur la fiche apres 620 ms : celui qui publie pour continuer a
  // travailler la grille des sept jours devait rouvrir « Programme », deux
  // clics a chaque publication — quinze fois par semaine de decharge retiree.
  // La sortie devient EXPLICITE : la fleche de retour de l'ecran, qui existe
  // deja et ne demandera plus de confirmation puisqu'il n'y a plus rien
  // d'enregistre a perdre.
  // LE RETOUR VISUEL RESTE ENTIER — « PUBLIÉ ✓ », le verrou contre le double
  // appui, la celebration — et AUCUNE ecriture n'est avancee ni retardee : ce
  // qui precede est synchrone et le reste. Le bouton reprend simplement son
  // libelle une fois la celebration finie, sinon le coach a devant lui un
  // bouton mort sur un ecran ou il continue de travailler.
  setTimeout(()=>{
    try{
      const b=document.getElementById('csm-publier');
      if(!b) return;
      b.classList.remove('celebrate');
      b.textContent='PUBLIER';
      b.disabled=false;
    }catch(e){}
  },620);
  toastSync(localOk,CLOUD.pushOne(emailKey,stocke),' Séances sauvegardées !','les séances sont');
}

function resolveClient(cid){
  const users=DB.get('users')||{};
  const c=getOwnedClient(cid,users);
  if(!c) return null;
  if(c._fromCode){toast('Cet athlète n\'a pas encore créé son compte. Le programme sera disponible après son inscription.','var(--orange)');return null;}
  return {c,users};
}

// ⚠ LES QUATRE FONCTIONS DU DEPOT DE PDF ONT ETE RETIREES le 08/09/2026 :
// removeCoachPdf, renderClientPdfCard, uploadCoachPdfInline et
// saveCoachPdfLinkInline. Elles ne servaient QUE le cadre « Programme PDF » de
// la fiche athlete, retire le meme jour — et saveCoachPdfLinkInline n'avait
// deja plus aucun appelant depuis que son champ de saisie avait disparu.
// CE N'EST PAS LE MEME CAS QUE L'IMPORT PDF/OCR, qui est DESACTIVE et non
// efface (LEGACY_PDF_IMPORT) : celui-la, on ne pouvait pas prouver que plus
// personne n'en voulait. Ici le depot etait deja ferme, l'ecran ne montrait
// plus qu'une croix, et Kevin a tranche. La lecture des PDF deja deposes, elle,
// n'est pas touchee : hasProgram, _exportMedias et triggerAthletePdfParse les
// lisent toujours.

// ── Identité stable d'un exercice ───────────────────────────────────────────
// Normalisation déterministe et SANS état : majuscules, accents dépliés puis
// retirés, toute ponctuation ramenée à une espace simple.
// « Développé  Couché–Haltère » et « DEVELOPPE COUCHE HALTERE » donnent la
// même clé, donc renommer un exercice ne coupe plus son historique de charge.
// Ce n'est PAS une clé de stockage : rien n'est écrit sous cette forme dans
// sessions[n].data, qui reste indexé par le nom en clair.
