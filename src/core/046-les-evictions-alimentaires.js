// ══════════════ LES EVICTIONS ALIMENTAIRES ═════════════════════════════
//
// Une liste declaree UNE FOIS, appliquee PARTOUT. Six chemins menaient a un
// aliment — la recherche Ciqual, les aliments perso, ceux du coach, la
// recherche du plan, les equivalences, le scan d'un code-barres — et aucun ne
// savait qu'un athlete peut etre allergique a l'arachide.
//
// ⚠ UN SEUL POINT DE PASSAGE, ET C'EST TOUT L'INTERET. `evictionDe` est la
// seule fonction qui decide ; aucun chemin ne filtre par lui-meme. Six filtres
// ecrits six fois divergeraient au premier ajout — et le chemin oublie serait
// celui par lequel l'arachide passe.
const EV_NIVEAUX=Object.freeze(['allergie','intolerance','choix']);
// ⚠ L'ORDRE EST UNE HIERARCHIE DE GRAVITE, pas une liste. Un aliment qui
// tombe sous deux evictions rend la PLUS GRAVE : « allergie » l'emporte sur
// « intolerance », qui l'emporte sur « choix ». Rendre la premiere trouvee
// ferait dependre l'avertissement de l'ordre de saisie.
const EV_GRAVITE=Object.freeze({allergie:3,intolerance:2,choix:1});
const EV_CIBLES=Object.freeze(['aliment','groupe','motif']);
const EV_LIB_MAX=60, EV_NOTE_MAX=200;

function _evStore(user){
  const u=_dossier(user);
  if(!u) return [];
  if(!u.sante||typeof u.sante!=='object') u.sante={};
  if(!Array.isArray(u.sante.evictions)) u.sante.evictions=_tabBloc(u.sante.evictions);
  return u.sante.evictions;
}
// PURE. La liste normalisee, quel que soit l'etat du champ revenu de Firebase.
function evictions(user){
  const u=_dossier(user);
  return _tabBloc(u&&u.sante&&u.sante.evictions)
    .filter(e=>e&&typeof e==='object'&&e.cible&&EV_NIVEAUX.indexOf(e.niveau)>=0
      &&EV_CIBLES.indexOf(e.cible.type)>=0&&String(e.cible.valeur||'').trim());
}

// PURE. LE NOM ET LE GROUPE D'UN ALIMENT, quelle que soit sa forme.
//
// ⚠ SIX FORMES CIRCULENT DANS LE FICHIER pour designer un aliment : la fiche
// Ciqual {id,n,g,s}, l'aliment perso, celui du coach, le produit OFF, l'entree
// du journal {nom,groupe,alim_id} et la ligne de plan {lib}. Les six passent
// par ici, et c'est la raison pour laquelle un seul filtre peut les servir
// toutes. Une fonction qui ne lirait que `.n` laisserait passer le journal
// entier sans qu'aucune erreur ne le dise.
function _evChamps(aliment){
  const a=aliment||{};
  const nom=a.n!=null?a.n:(a.nom!=null?a.nom:(a.name!=null?a.name:
    (a.lib!=null?a.lib:(a.libelle!=null?a.libelle:''))));
  const groupe=a.g!=null?a.g:(a.groupe!=null?a.groupe:'');
  const id=(a.alim_id!=null)?a.alim_id:a.id;
  // ⚠ LES ALLERGENES D'OPEN FOOD FACTS, quand ils existent. Ils entrent dans
  // le texte cherche par un motif — c'est ce qui permet de SIGNALER une
  // presence. Ils ne permettent jamais d'affirmer une absence : voir
  // EV_OFF_RESERVE.
  let sup='';
  try{
    const o=a._off||{};
    sup=[o.allergenes,o.traces,o.ingredients].filter(Boolean).join(' ');
  }catch(e){ sup=''; }
  return {nom:String(nom||''),groupe:String(groupe||''),id:id,
    texte:_fjNorm(String(nom||'')+' '+String(groupe||'')+' '+sup)};
}

// PURE. LE POINT UNIQUE. Rend null, ou {niveau, libelle, raison, id, cible}.
//
// `raison` est destinee a etre LUE : elle dit pourquoi cet aliment ressort,
// pas quelle regle interne a mordu.
function evictionDe(user,aliment){
  const l=evictions(user);
  if(!l.length||!aliment) return null;
  const c=_evChamps(aliment);
  let meilleur=null;
  for(const e of l){
    const t=e.cible.type, v=String(e.cible.valeur||'').trim();
    let touche=false, raison='';
    if(t==='aliment'){
      // Comparaison en CHAINE des deux cotes : les identifiants Ciqual sont
      // des nombres, ceux des aliments perso des chaines, et un === entre les
      // deux serait faux sans que rien ne le dise.
      touche=(c.id!=null&&String(c.id)===v);
      if(touche) raison='cet aliment est dans ta liste';
    } else if(t==='groupe'){
      touche=(!!c.groupe&&_fjNorm(c.groupe)===_fjNorm(v));
      if(touche) raison='groupe « '+c.groupe+' »';
    } else {
      // ⚠ LE MOTIF CHERCHE DANS LE NOM ET DANS LE GROUPE, pas seulement dans
      // le nom. « pas de lait » doit attraper « Yaourt nature » par son groupe
      // « produits laitiers », qui ne porte le mot dans aucun de ses noms.
      // ⚠ LA VIRGULE SEPARE DES SYNONYMES, et ce n'est pas un ornement.
      // « arachide » n'attrape pas « Beurre de cacahuète » — mesure faite sur
      // la table : deux mots pour la meme legumineuse, et le second est celui
      // qui figure sur la moitie des etiquettes. La reponse n'est PAS un
      // dictionnaire cache de synonymes, qui se tromperait un jour sans que
      // personne ne sache ou : c'est un champ que l'athlete LIT et corrige.
      // « arachide, cacahuete » se cherche donc comme deux motifs, et l'un
      // suffit.
      const alts=String(v).split(',').map(x=>_fjNorm(x).trim()).filter(Boolean);
      let quel='';
      for(const alt of alts){
        const mots=alt.split(/\s+/).filter(w=>w.length>1);
        if(mots.length&&_fjContientTous(c.texte,mots)){ quel=alt; break; }
      }
      touche=!!quel;
      // LA RAISON NOMME L'ALTERNATIVE QUI A MORDU, pas la liste entiere :
      // « contient « arachide, cacahuete » » se lit mal, « contient
      // « cacahuete » » dit ce qui s'est passe.
      if(touche) raison='contient « '+quel+' »';
    }
    if(!touche) continue;
    const g=EV_GRAVITE[e.niveau]||0;
    if(!meilleur||g>meilleur._g)
      meilleur={niveau:e.niveau,libelle:String(e.libelle||v),raison:raison,
        id:String(e.id||''),cible:t,_g:g};
  }
  if(meilleur) delete meilleur._g;
  return meilleur;
}

// ══════════════ LES TROIS NIVEAUX, ET LEURS EFFETS ═════════════════════
//
// ⚠ LES TROIS NE SE RESSEMBLENT PAS, et c'est le coeur de ce lot :
//
//  · ALLERGIE — retiree des listes. Si l'aliment entre malgre tout (un
//    code-barres scanne, une entree deja au journal), on AVERTIT avant
//    d'enregistrer, en nommant l'eviction. On ne BLOQUE pas : c'est l'athlete
//    qui sait, et une app qui refuse d'enregistrer ce qu'il a mange ne fait
//    pas disparaitre le repas, elle fait disparaitre la donnee.
//
//  · INTOLERANCE — conservee, releguee en fin de liste, avec la raison
//    affichee. Beaucoup de gens tolerent une petite quantite ; un filtrage dur
//    les priverait d'un aliment qu'ils utilisent volontairement.
//
//  · CHOIX — filtre EN SILENCE. Aucun message, aucune icone, aucun
//    commentaire, aucun « masque » affiche. Rien dans le produit ne doit
//    avoir l'air de discuter ce niveau-la : c'est une decision, pas un
//    symptome, et elle n'a pas a etre justifiee a une application.
//
// PURE. Range une liste d'aliments selon ces trois regles.
// Rend {liste, releguees:[{aliment,eviction}], retirees:n}.
function evictionTrier(user,liste){
  const l=_tabBloc(liste);
  if(!evictions(user).length) return {liste:l.slice(),releguees:[],retirees:0};
  const garde=[], fin=[];
  let retirees=0;
  for(const a of l){
    const e=evictionDe(user,a);
    if(!e){ garde.push(a); continue; }
    if(e.niveau==='intolerance'){ fin.push({aliment:a,eviction:e}); continue; }
    // allergie ET choix sortent de la liste. La difference entre les deux ne
    // se joue pas ici mais a l'ENREGISTREMENT : l'allergie y avertit, le
    // choix n'y dit jamais rien.
    retirees++;
  }
  return {liste:garde,releguees:fin,retirees:retirees};
}
// PURE. La mention affichee a cote d'un aliment relegue. Vide pour tout le
// reste — et notamment pour « choix », qui ne s'annonce jamais.
function evictionMention(ev){
  if(!ev||ev.niveau!=='intolerance') return '';
  return ev.libelle+' : '+ev.raison;
}

// ⚠ LA PHRASE DU SCAN, ET ELLE N'EST PAS DECORATIVE.
//
// Open Food Facts porte des listes d'allergenes heterogenes, saisies par des
// contributeurs, souvent incompletes et parfois absentes. L'app peut donc
// SIGNALER une presence ; elle ne peut JAMAIS garantir une absence. Ecrire
// « ne contient pas de gluten » a partir de cette base serait la seule phrase
// de RepCore capable d'envoyer quelqu'un a l'hopital.
//
// Une assertion verifie qu'aucune formulation d'absence n'existe dans la
// source de production.
const EV_OFF_RESERVE="Les allergènes des produits de marque viennent d’Open Food "
  +"Facts, où ils sont saisis par des contributeurs et souvent incomplets. "
  +"RepCore peut signaler une présence, jamais garantir une absence : lis "
  +"l’étiquette.";
// ══════════════ DECLARER SES EVICTIONS ═════════════════════════════════
//
// ⚠ SANS CET ECRAN, TOUT CE QUI PRECEDE EST INERTE. Le module savait filtrer
// six chemins et n'avait aucune porte pour recevoir la premiere eviction.
//
// Les motifs proposes sont les plus courants, et la liste n'est pas fermee :
// un champ libre reste ouvert. Une liste fermee d'allergenes serait fausse
// pour quelqu'un des le premier usage.
// ⚠ CHAQUE SUGGESTION PORTE SES SYNONYMES, separes par des virgules, et ils
// sont ECRITS DANS LE CHAMP : l'athlete voit exactement ce qui sera cherche et
// peut en retirer ou en ajouter. Une correspondance cachee qui se tromperait
// ne serait corrigible par personne.
const EV_MOTIFS_COURANTS=Object.freeze([
  ['lait, laitier, lactose','Lait et produits laitiers'],
  ['gluten, ble, seigle, orge','Gluten'],
  ['arachide, cacahuete, peanut','Arachide'],
  ['noix, noisette, amande, pistache, cajou','Fruits à coque'],
  ['oeuf','Œuf'],['soja','Soja'],
  ['crustace, crevette, crabe, homard, langoustine','Crustacés'],
  ['poisson, saumon, thon, cabillaud','Poisson'],
  ['porc, jambon, lardon, saucisson','Porc'],
  ['sesame','Sésame']]);

let _evEdit=null;   // {email, id, retour}

function ouvrirEditeurEviction(email,id,retour){
  const u=_trtCible(email);
  if(!u) return false;
  _evEdit={email:email||(currentUser&&currentUser.email),id:id||null,
    retour:retour||'s-evictions'};
  go('s-eviction-edit');
  renderEditeurEviction();
  return true;
}
function fermerEditeurEviction(){
  const r=(_evEdit&&_evEdit.retour)||'s-evictions';
  _evEdit=null;
  go(r);
  try{ if(r==='s-evictions') renderEvictions(); }catch(e){}
  try{ if(r==='s-coach-client') renderCoachEvictionsSection(
    getOwnedClient(currentClientId,DB.get('users')||{})); }catch(e){}
  return true;
}
function renderEditeurEviction(){
  const z=document.getElementById('eve-corps');
  if(!z||!_evEdit) return false;
  const u=_trtCible(_evEdit.email);
  const e=_evEdit.id?(evictions(u).filter(x=>x.id===_evEdit.id)[0]||null):null;
  const ti=document.getElementById('eve-titre');
  if(ti) ti.textContent=e?'Modifier':'Nouvelle éviction';
  const v=x=>escapeHtml(String(x==null?'':x));
  const niv=(e&&e.niveau)||'choix';
  const typ=(e&&e.cible&&e.cible.type)||'motif';
  let h='';
  // ⚠ LES TROIS NIVEAUX SONT DECRITS PAR CE QU'ILS FONT, pas par ce qu'ils
  // sont. « Intolérance » ne veut rien dire tant qu'on ne sait pas que
  // l'aliment restera proposable.
  const NIV=[['allergie','Allergie',
      'Retiré des listes. Si l’aliment entre malgré tout, RepCore te prévient avant d’enregistrer, sans bloquer.'],
    ['intolerance','Intolérance',
      'Gardé, mais rangé en fin de liste avec la raison. Beaucoup de gens en tolèrent une petite quantité.'],
    ['choix','Choix personnel',
      'Filtré sans un mot. Aucun message, aucune icône : RepCore n’a pas à commenter ce choix.']];
  h+='<div style="margin:12px 0 14px">'
    +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Niveau</div>'
    +NIV.map(([id,lib,txt])=>'<label class="reg-ligne reg-ligne--nue" style="display:flex;align-items:flex-start;gap:10px;'
      +'padding:10px 12px;background:var(--surface-1);border:1px solid var(--border);'
      +'border-radius:var(--r-2);margin-bottom:6px;cursor:pointer;'
      +'text-transform:none;letter-spacing:normal;font-weight:400">'
      +'<input type="radio" name="eve-niv" value="'+id+'"'+(niv===id?' checked':'')
      +' style="width:16px;height:16px;margin:2px 0 0;accent-color:var(--red);flex-shrink:0">'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-size:var(--fs-sm);'
      +'color:var(--text)">'+escapeHtml(lib)+'</span>'
      +'<span style="display:block;font-size:var(--fs-2xs);color:var(--text-faint);'
      +'line-height:1.55;margin-top:2px">'+escapeHtml(txt)+'</span></span></label>').join('')
    +'</div>';
  const champ=(id,lbl,attrs,aide)=>
    '<label style="display:block;margin-bottom:12px">'
    +'<span style="display:block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">'+escapeHtml(lbl)+'</span>'
    +'<input id="'+id+'" '+attrs+' style="width:100%;box-sizing:border-box;background:var(--surface-1);'
    +'border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
    +'padding:10px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">'
    +(aide?'<span style="display:block;font-size:var(--fs-2xs);color:var(--text-faint);'
      +'line-height:1.5;margin-top:4px">'+escapeHtml(aide)+'</span>':'')
    +'</label>';
  h+=champ('eve-lib','Nom de l’éviction','type="text" maxlength="'+EV_LIB_MAX
    +'" value="'+v(e&&e.libelle)+'" placeholder="Arachide"');
  // ⚠ TROIS TYPES DE CIBLE, ET IL EN FAUT TROIS. « Pas de porc » n'est ni un
  // aliment precis ni un groupe Ciqual : c'est un mot qu'on cherche.
  h+='<label style="display:block;margin-bottom:12px">'
    +'<span style="display:block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Ce que ça vise</span>'
    +'<select id="eve-type" onchange="_evMajType()" style="width:100%;box-sizing:border-box;'
    +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);'
    +'color:var(--text);padding:10px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">'
    +[['motif','Un mot, cherché dans le nom et le groupe'],
      ['groupe','Un groupe alimentaire entier'],
      ['aliment','Un aliment précis, par son identifiant']]
      .map(([id,lib])=>'<option value="'+id+'"'+(typ===id?' selected':'')+'>'
        +escapeHtml(lib)+'</option>').join('')
    +'</select></label>';
  h+='<div id="eve-suggest" style="display:'+(typ==='motif'?'flex':'none')+';'
    +'flex-wrap:wrap;gap:6px;margin:-4px 0 12px">'
    +EV_MOTIFS_COURANTS.map(([val,lib])=>'<button type="button" class="btn btn-outline btn-sm" '
      +'style="margin:0;font-size:var(--fs-2xs);padding:6px 10px" '
      +'onclick="_evPoserMotif('+JSON.stringify(val).replace(/"/g,'&quot;')+','
      +JSON.stringify(lib).replace(/"/g,'&quot;')+')">'+escapeHtml(lib)+'</button>').join('')
    +'</div>';
  h+=champ('eve-val','Valeur','type="text" maxlength="80" value="'
    +v(e&&e.cible&&e.cible.valeur)+'" placeholder="arachide"',
    'Pour un groupe, écris-le exactement comme la table Ciqual le nomme.');
  h+=champ('eve-note','Note','type="text" maxlength="'+EV_NOTE_MAX
    +'" value="'+v(e&&e.note)+'" placeholder="choc anaphylactique en 2019"');
  h+='<button type="button" class="btn" style="width:100%;margin:4px 0 0" '
    +'onclick="sauverEviction()">Enregistrer</button>';
  if(e)
    h+='<button type="button" class="btn btn-outline" style="width:100%;margin:10px 0 0" '
      +'onclick="supprimerEviction()">Retirer cette éviction</button>';
  z.innerHTML=h;
  return true;
}
function _evMajType(){
  const t=(document.getElementById('eve-type')||{}).value||'motif';
  const s=document.getElementById('eve-suggest');
  if(s) s.style.display=(t==='motif')?'flex':'none';
  return t;
}
function _evPoserMotif(val,lib){
  const v=document.getElementById('eve-val'), l=document.getElementById('eve-lib');
  if(v) v.value=val;
  if(l&&!String(l.value||'').trim()) l.value=lib;
  return true;
}
// PURE. La validation, hors du DOM.
function _evValider(e){
  if(!e) return 'Éviction vide.';
  if(EV_NIVEAUX.indexOf(e.niveau)<0) return 'Choisis un niveau.';
  if(!e.cible||EV_CIBLES.indexOf(e.cible.type)<0) return 'Choisis ce que ça vise.';
  const v=String(e.cible.valeur||'').trim();
  if(!v) return 'Donne la valeur visée.';
  // ⚠ UN MOTIF D'UNE SEULE LETTRE ATTRAPERAIT LA MOITIE DE LA TABLE, et
  // l'athlete ne verrait plus rien sans comprendre pourquoi.
  if(e.cible.type==='motif'
     &&v.split(',').some(x=>x.replace(/\s+/g,'').length<2))
    return 'Chaque mot doit faire au moins deux lettres, sinon il attrape presque tout.';
  if(!String(e.libelle||'').trim()) return 'Donne un nom à cette éviction.';
  return '';
}
function sauverEviction(){
  if(!_evEdit) return false;
  const g=id=>document.getElementById(id);
  const txt=id=>String((g(id)||{}).value||'').trim();
  const u=_trtCible(_evEdit.email);
  const ancien=_evEdit.id?(evictions(u).filter(x=>x.id===_evEdit.id)[0]||null):null;
  const e={
    id:_evEdit.id||('ev'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),
    libelle:txt('eve-lib').slice(0,EV_LIB_MAX),
    niveau:(document.querySelector('input[name="eve-niv"]:checked')||{}).value||'choix',
    cible:{type:((g('eve-type')||{}).value)||'motif',valeur:txt('eve-val').slice(0,80)},
    note:txt('eve-note').slice(0,EV_NOTE_MAX),
    depuis:(ancien&&ancien.depuis)||Date.now()
  };
  const err=_evValider(e);
  if(err){ try{ toast(err,'var(--orange)'); }catch(x){} return false; }
  if(!_trtEcrire(_evEdit.email,d=>{
    const l=_evStore(d);
    const i=l.findIndex(x=>x&&x.id===e.id);
    if(i>=0) l[i]=e; else l.push(e);
  })) return false;
  try{ toast('Éviction enregistrée','var(--success)'); }catch(x){}
  fermerEditeurEviction();
  return true;
}
// ⚠ CELLE-CI SE SUPPRIME VRAIMENT, contrairement a un traitement. Une eviction
// n'est pas une trace medicale : c'est un REGLAGE, et la garder « terminee »
// dans un historique ferait croire a un antecedent la ou il n'y a qu'un
// changement d'avis.
async function supprimerEviction(){
  if(!_evEdit||!_evEdit.id) return false;
  const ok=await rcConfirm('Retirer cette éviction',
    'Les aliments concernés réapparaîtront dans tes listes.','Retirer');
  if(!ok) return false;
  const id=_evEdit.id;
  if(!_trtEcrire(_evEdit.email,d=>{
    const l=_evStore(d);
    const i=l.findIndex(x=>x&&x.id===id);
    if(i<0) return false;
    l.splice(i,1);
  })) return false;
  fermerEditeurEviction();
  return true;
}
function renderEvictions(){
  const z=document.getElementById('ev-liste');
  if(!z) return false;
  const l=evictions(currentUser);
  const LIB={allergie:'Allergie',intolerance:'Intolérance',choix:'Choix'};
  z.innerHTML='<button type="button" class="btn" style="width:100%;margin:12px 0 14px" '
    +'onclick="ouvrirEditeurEviction(currentUser.email,null,\'s-evictions\')">'
    +'+ Ajouter une éviction</button>'
    +(l.length?l.map(e=>'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;'
      +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);'
      +'margin-bottom:6px">'
      +'<span style="flex:1;min-width:0">'
      +'<span style="display:block;font-size:var(--fs-sm);color:var(--text)">'
      +escapeHtml(e.libelle)+'</span>'
      +'<span style="display:block;font-size:var(--fs-2xs);color:var(--sub);margin-top:2px">'
      +escapeHtml(LIB[e.niveau]+' · '+e.cible.type+' « '+e.cible.valeur+' »')+'</span></span>'
      +'<button type="button" class="btn btn-outline btn-sm" style="margin:0;flex:0 0 auto;'
      +'font-size:var(--fs-2xs);padding:4px 8px" onclick="ouvrirEditeurEviction(currentUser.email,\''
      +escapeHtml(e.id)+'\',\'s-evictions\')">Modifier</button></div>').join('')
      :'<div class="sub" style="font-size:var(--fs-sm);line-height:1.6;padding:8px 0">'
       +'Aucune éviction déclarée. Ce que tu déclares ici est retiré de toutes '
       +'les listes de l’app : recherche, équivalences, plan de ton coach.</div>');
  return true;
}
// ══════════════ LES TRAITEMENTS ════════════════════════════════════════
//
// ⚠ UN OBJET SEPARE DES COMPLEMENTS, ET CE N'EST PAS COSMETIQUE. Un
// complement se conseille ; un medicament ne se conseille pas. Un simple
// champ `type` sur supplements ferait heriter aux traitements le classement
// par NIVEAU DE PREUVE A/B/C — qui n'a aucun sens pour une ordonnance : on ne
// note pas la « preuve » d'un traitement prescrit, on le prend.
//
// ⚠ ET IL VIT SOUS `sante`, PAS SOUS `nutrition`. C'est une donnee de sante au
// sens du RGPD, et sa place dans l'objet doit le dire — c'est aussi ce qui le
// fait tomber sous la machinerie de partage deja en place pour les autres
// blocs de sante.
//
// LES MOMENTS SONT CEUX DES COMPLEMENTS. SUPP_ORDRE_JOURNEE, SUPP_TIMING_META
// et TIMINGS_LIST sont reutilises tels quels : deux chronologies de journee
// finiraient par diverger, et c'est precisement le croisement des deux listes
// qui permet de detecter une interaction.
const TRT_RYTHMES=Object.freeze(['quotidien','jours','cycle','ponctuel']);

function _trtStore(user){
  const u=_dossier(user);
  if(!u) return [];
  if(!u.sante||typeof u.sante!=='object') u.sante={};
  if(!Array.isArray(u.sante.traitements)) u.sante.traitements=_tabBloc(u.sante.traitements);
  return u.sante.traitements;
}
// PURE. La liste normalisee, quel que soit l'etat du champ revenu de Firebase.
function traitements(user){
  const u=_dossier(user);
  const l=_tabBloc(u&&u.sante&&u.sante.traitements);
  return l.filter(t=>t&&typeof t==='object'&&t.nom);
}

// PURE. LE RYTHME. Rend true si ce traitement est a prendre ce jour-la.
//
// ⚠ ON COMPARE DES JOURS DE CALENDRIER, JAMAIS DES MILLISECONDES. Un cycle
// compte en jours civils : diviser un ecart de temps par 86 400 000 se decale
// d'un jour a chaque changement d'heure — deux fois par an, un traitement
// change de phase sans raison. _dateDeISO ramene chaque borne a minuit local,
// et la difference se lit alors en jours pleins.
function _trtJoursEntre(isoA,isoB){
  const a=_dateDeISO(isoA), b=_dateDeISO(isoB);
  if(!a||!b) return null;
  // Midi local des deux cotes : un ecart de 23 h ou de 25 h — les deux nuits
  // de changement d'heure — reste alors un jour plein, sans arrondi.
  const ja=new Date(a.getFullYear(),a.getMonth(),a.getDate(),12,0,0).getTime();
  const jb=new Date(b.getFullYear(),b.getMonth(),b.getDate(),12,0,0).getTime();
  return Math.round((jb-ja)/86400000);
}
function aPrendreLe(traitement,dateISO){
  const t=traitement||{};
  const jour=String(dateISO||'').slice(0,10);
  if(!jour||!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return false;
  if(t.actif===false) return false;
  // HORS FENETRE : avant le debut, ou apres la fin. Un traitement TERMINE ne
  // revient pas dans la journee — mais il reste dans le dossier, voir
  // terminerTraitement.
  if(t.debut){
    const d=localISODate(new Date(Number(t.debut)));
    if(jour<d) return false;
  }
  if(t.fin){
    const f=localISODate(new Date(Number(t.fin)));
    if(jour>f) return false;
  }
  const r=(t.rythme&&typeof t.rythme==='object')?t.rythme:{type:'quotidien'};
  const type=TRT_RYTHMES.indexOf(r.type)>=0?r.type:'quotidien';
  if(type==='quotidien') return true;
  // ⚠ 'ponctuel' NE REND JAMAIS TRUE. « Au besoin » n'a pas de jour : le
  // faire apparaitre dans la journee reviendrait a le prescrire. Il n'existe
  // que dans la fiche.
  if(type==='ponctuel') return false;
  if(type==='jours'){
    const l=_tabBloc(r.jours).map(x=>Math.round(Number(x)))
      .filter(x=>isFinite(x)&&x>=0&&x<=6);
    if(!l.length) return false;
    // getDay() rend 0 pour dimanche ; la table est en 0..6 dans cet ordre,
    // comme partout ailleurs dans le fichier.
    return l.indexOf(_dateDeISO(jour).getDay())>=0;
  }
  if(type==='cycle'){
    const on=Math.round(Number(r.cycleOn)), off=Math.round(Number(r.cycleOff));
    if(!(on>0)||!(off>=0)) return false;
    const ancre=Number(r.ancre)||Number(t.debut)||0;
    if(!(ancre>0)) return false;
    const n=_trtJoursEntre(localISODate(new Date(ancre)),jour);
    if(n===null||n<0) return false;
    return (n%(on+off))<on;
  }
  return false;
}
// PURE. Les traitements A PRENDRE ce jour-la, a ce moment-la.
function traitementsDuMoment(user,moment,dateISO){
  const j=dateISO||localISODate(new Date());
  return traitements(user).filter(t=>
    _tabBloc(t.moments).indexOf(moment)>=0 && aPrendreLe(t,j));
}
// PURE. Terminé ou non. Un traitement dont la fin est passee sort de la
// journee mais reste dans le dossier.
function traitementTermine(t,dateISO){
  const j=String(dateISO||localISODate(new Date())).slice(0,10);
  if(!t||!t.fin) return false;
  return localISODate(new Date(Number(t.fin)))<j;
}
// ON NE SUPPRIME PAS UN TRAITEMENT, ON LE TERMINE. La trace est une donnee
// medicale : savoir qu'un traitement a ete pris pendant six mois explique une
// prise de poids, une fatigue ou un plateau, des annees plus tard.
function terminerTraitement(user,id,quand){
  const l=_trtStore(user);
  const t=l.filter(x=>x&&x.id===id)[0];
  if(!t) return {ok:false,raison:'Traitement introuvable.'};
  t.fin=Number(quand)||Date.now();
  t.actif=false;
  // ⚠ SEULEMENT SI C'EST BIEN SON PROPRE DOSSIER. saveUser() ecrit et pousse
  // le dossier de l'utilisateur CONNECTE : appele quand un coach arrete le
  // traitement de son athlete, il sauvait le dossier du coach et laissait
  // celui de l'athlete non pousse. L'appelant s'en charge.
  const _u=_dossier(user);
  if(!currentUser||!_u||_u===currentUser||_u.email===currentUser.email)
    saveUserOuDire('Ton traitement');
  return {ok:true};
}
// ══════════════ LA TABLE D'INTERACTIONS ════════════════════════════════
//
// ⚠ RIEN N'ENTRE ICI SANS SOURCE CITABLE. Une fausse alerte sur un medicament
// est PIRE que pas d'alerte du tout : elle apprend a ignorer les vraies. Trois
// entrees, pas une de plus, et chacune porte sa source en clair — une
// assertion refuse toute entree sans source.
//
// ⚠ ET LA QUATRIEME REGLE DEMANDEE N'Y EST PAS : « AINS a ne pas prendre a
// jeun ». Verification faite avant d'ecrire : il n'existe AUCUNE etude
// publiee montrant que prendre un AINS au cours d'un repas previent la lesion
// gastrique. Le repas reduit la dyspepsie ressentie, pas le risque d'ulcere ;
// la recommandation est une habitude ancienne, reprise par les notices, sans
// donnee de qualite derriere. Elle ne passe donc pas le critere pose pour
// cette table. Elle n'entrerait de toute facon pas dans sa forme : la table
// dit « decale de tant de minutes », et il n'y a rien a decaler entre un
// comprime et un repas absent.
//   Rainsford KD et coll., « NSAIDs: take with food or after fasting? »,
//   Journal of Pharmacy and Pharmacology, 2012.
//
// LES FAMILLES SONT DES MOTIFS SUR LE NOM, en minuscules sans accent. On ne
// tient pas un dictionnaire de medicaments : on reconnait les quelques noms
// que ces trois regles concernent, et rien d'autre. Un nom non reconnu ne
// declenche RIEN — c'est le sens de la regle « aucune interaction inventee ».
const INTERACTIONS=Object.freeze([
  {
    cle:'thyroide-mineraux',
    // Les hormones thyroidiennes : levothyroxine et ses noms commerciaux.
    motifs:[/l[ée]vothyrox/i,/levothyrox/i,/euthyral/i,/l[- ]?thyroxin/i],
    contre:[/\bfer\b/i,/ferreu/i,/sulfate de fer/i,/bisglycinate de fer/i,
            /calcium/i,/carbonate de calcium/i,/citrate de calcium/i],
    delaiMin:240,
    phrase:'Le fer et le calcium diminuent l’absorption de l’hormone '
      +'thyroïdienne. Prends l’hormone à jeun, et attends 4 heures avant le fer '
      +'ou le calcium.',
    source:'NICE, British National Formulary : interaction lévothyroxine / sels '
      +'de fer et de calcium : intervalle d’au moins 4 heures. Absorption '
      +'réduite de 20 à 64 % (fer) et de 15 à 20 % (calcium).'
  },
  {
    cle:'fer-calcium',
    motifs:[/\bfer\b/i,/ferreu/i,/sulfate de fer/i,/bisglycinate de fer/i],
    contre:[/calcium/i,/carbonate de calcium/i,/citrate de calcium/i],
    delaiMin:120,
    phrase:'Le calcium gêne l’absorption du fer quand les deux sont pris '
      +'ensemble. Espace-les d’au moins 2 heures.',
    source:'Interaction d’absorption documentée de longue date (compétition au '
      +'niveau du transporteur DMT1) ; recommandation d’espacement reprise par '
      +'l’ANSES et les notices de sels de fer.'
  },
  {
    cle:'pamplemousse-statines',
    // ⚠ SEULEMENT LES STATINES METABOLISEES PAR LE CYP3A4. Verification faite :
    // simvastatine, lovastatine et atorvastatine sont concernees ;
    // pravastatine, rosuvastatine, fluvastatine et pitavastatine NE LE SONT
    // PAS — elles passent par le CYP2C9 ou par sulfatation. Alerter sur une
    // rosuvastatine serait exactement la fausse alerte que cette table doit
    // eviter, et c'est le genre d'erreur qu'on ne fait qu'une fois avant de
    // n'etre plus jamais cru.
    motifs:[/simvastatin/i,/lovastatin/i,/atorvastatin/i,/tahor/i,/zocor/i],
    contre:[/pamplemousse/i,/grapefruit/i,/pomelo/i],
    delaiMin:null,
    phrase:'Le pamplemousse augmente fortement la concentration sanguine de '
      +'cette statine. Ce n’est pas une question d’horaire : il est à éviter '
      +'tant que dure le traitement. Parles-en à ton médecin.',
    source:'Bailey DG et coll. ; Lee JW et coll., « Grapefruit Juice and '
      +'Statins », The American Journal of Medicine, 2016. Simvastatine et '
      +'lovastatine +260 %, atorvastatine +80 %. Pravastatine, rosuvastatine et '
      +'fluvastatine NON concernées (CYP2C9 / sulfatation).'
  }
]);

// PURE. Un nom correspond-il a l'un des motifs ?
function _intCorrespond(nom,motifs){
  const n=String(nom||'');
  if(!n.trim()) return false;
  return (motifs||[]).some(re=>{ try{ return re.test(n); }catch(e){ return false; } });
}
// PURE. LES INTERACTIONS D'UNE JOURNEE, moment par moment.
//
// ⚠ LE DECLENCHEMENT SE FAIT SUR LE MOMENT DE PRISE, pas sur la simple
// coexistence dans le dossier. Deux produits en interaction pris a huit heures
// d'intervalle ne posent aucun probleme : alerter la reviendrait a alerter
// tous les jours, pour rien.
//
// La seule exception est `delaiMin:null` — le pamplemousse et les statines ne
// se decalent pas, l'eviction est la seule reponse. Celle-la se signale des
// que les deux sont presents le meme jour.
function interactionsDuJour(user,dateISO){
  const j=dateISO||localISODate(new Date());
  const trts=traitements(user).filter(t=>aPrendreLe(t,j));
  let comps=[];
  try{ comps=(_dossier(user)&&_dossier(user).nutrition&&_dossier(user).nutrition.supplements)||[]; }catch(e){ comps=[]; }
  comps=_tabBloc(comps).filter(s=>s&&s.active!==false&&s.name);
  const out=[];
  const vus={};
  for(const r of INTERACTIONS){
    for(const t of trts){
      if(!_intCorrespond(t.nom,r.motifs)) continue;
      for(const s of comps){
        if(!_intCorrespond(s.name,r.contre)) continue;
        const mT=_tabBloc(t.moments), mS=_tabBloc(s.timings);
        // SANS DELAI : la coexistence suffit, le moment n'y change rien.
        const communs=(r.delaiMin===null)
          ? (mT.length&&mS.length?['*']:[])
          : mT.filter(m=>mS.indexOf(m)>=0);
        if(!communs.length) continue;
        for(const m of communs){
          const cle=r.cle+'|'+t.id+'|'+(s.id||s.name)+'|'+m;
          if(vus[cle]) continue;
          vus[cle]=true;
          out.push({cle:r.cle,traitement:t.nom,complement:s.name,
            moment:(m==='*'?null:m),delaiMin:r.delaiMin,
            phrase:r.phrase,source:r.source,
            // CE QU'IL FAUT DECALER, et non « quelque chose ». Le traitement
            // prescrit ne bouge pas : c'est le complement qui s'ecarte.
            aDecaler:(r.delaiMin===null)?null:s.name});
        }
      }
    }
  }
  return out;
}
// ══════════════ LE SUIVI DE PRISE ══════════════════════════════════════
//
// UNE CASE PAR PRISE ET PAR JOUR. Le releve vit sous sante.prises, indexe par
// jour puis par « id|moment » : c'est la granularite de la case cochee, et
// c'est la seule qui permette de dire « le comprime du soir est oublie, celui
// du matin non ».
//
// ⚠ IL N'ALIMENTE AUCUN SIGNAL VERS LE COACH. L'observance d'un traitement ne
// le regarde pas : ce n'est pas lui qui l'a prescrit, et un athlete qui sait
// son oubli remonte a son coach cesse de cocher. Le taux est pour l'athlete,
// et pour lui seul.
//
// ⚠ ET LA COCHE N'EST PAS UNE CHRONOLOGIE DE PLUS. Les compléments n'avaient
// AUCUNE coche de prise — il n'y avait donc rien a « reutiliser » : la voici,
// ecrite une fois, et elle sert aux deux. `quoi` vaut 'trt' ou 'supp'.
const PRISE_JOURS_MAX=120;          // au-dela, le releve ne sert plus a rien

function _priseStore(user){
  const u=_dossier(user);
  if(!u) return {};
  if(!u.sante||typeof u.sante!=='object') u.sante={};
  if(!u.sante.prises||typeof u.sante.prises!=='object') u.sante.prises={};
  return u.sante.prises;
}
function _priseCle(quoi,id,moment){ return String(quoi)+':'+String(id)+'|'+String(moment); }
// PURE. Cette prise est-elle cochee ce jour-la ?
function prisePrise(user,quoi,id,moment,dateISO){
  const u=_dossier(user);
  const p=(u&&u.sante&&u.sante.prises)||{};
  const j=p[String(dateISO||localISODate(new Date())).slice(0,10)];
  return !!(j&&typeof j==='object'&&j[_priseCle(quoi,id,moment)]);
}
// LA BASCULE. Decocher EFFACE au lieu d'ecrire `false` : un dossier reecrit en
// entier a chaque sauvegarde n'a pas besoin de porter la trace de ce qui n'a
// pas eu lieu.
function basculerPrise(user,quoi,id,moment,dateISO){
  const u=_dossier(user);
  if(!u) return false;
  const p=_priseStore(u);
  const j=String(dateISO||localISODate(new Date())).slice(0,10);
  if(!p[j]||typeof p[j]!=='object') p[j]={};
  const c=_priseCle(quoi,id,moment);
  const etait=!!p[j][c];
  if(etait){ delete p[j][c]; if(!Object.keys(p[j]).length) delete p[j]; }
  else p[j][c]=true;
  // PURGE DES VIEUX JOURS, ici et pas ailleurs : le dossier entier repart a
  // chaque sauvegarde, et un releve qui s'accumule sans borne finit par peser.
  const jours=Object.keys(p).sort();
  while(jours.length>PRISE_JOURS_MAX) delete p[jours.shift()];
  saveUserOuDire('Ton suivi de traitement');
  return !etait;
}
// PURE. LE TAUX DE PRISE sur `n` jours. Rend null quand rien n'etait DU sur la
// periode : un taux de 0 % dirait « tout oublie » la ou il n'y avait rien a
// prendre, et c'est un reproche fabrique.
function tauxPrise(user,n,dateISO){
  const jours=Math.max(1,Math.round(Number(n)||7));
  const fin=_dateDeISO(String(dateISO||localISODate(new Date())).slice(0,10));
  if(!fin) return null;
  const l=traitements(user);
  let du=0, fait=0;
  for(let k=0;k<jours;k++){
    const d=new Date(fin.getFullYear(),fin.getMonth(),fin.getDate()-k);
    const j=localISODate(d);
    for(const t of l){
      if(!aPrendreLe(t,j)) continue;
      for(const m of _tabBloc(t.moments)){
        du++;
        if(prisePrise(user,'trt',t.id,m,j)) fait++;
      }
    }
  }
  if(!du) return null;
  return {du:du,fait:fait,pct:Math.round(fait/du*100),jours:jours};
}

// ══════════════ CE QUE LE COACH VOIT ═══════════════════════════════════
//
// ⚠ partageCoach VAUT FALSE PAR DEFAUT, et sans partage le coach voit qu'un
// traitement est actif A TEL MOMENT — de quoi eviter de proposer un complement
// qui entrerait en conflit — et RIEN DE PLUS : ni le nom, ni le dosage, ni le
// prescripteur, ni les notes.
//
// C'est le minimum utile a la securite, et le maximum acceptable sans
// consentement explicite. Un coach n'a pas a savoir que son athlete prend un
// antidepresseur pour eviter de lui proposer du millepertuis : il lui suffit
// de savoir qu'il y a QUELQUE CHOSE le soir.
function traitementsPourCoach(user){
  return traitements(user).filter(t=>t.actif!==false&&!traitementTermine(t))
    .map(t=>{
      // `saisiPar` PART TOUJOURS, meme sans partage. Il ne dit pas ce qu'est
      // le traitement, il dit qui l'a tape : sans lui, un coach ne pourrait pas
      // distinguer sa propre saisie de celle de son athlete, et le filet de
      // poussee ne saurait pas ce qu'il a le droit de reecrire.
      const base={id:String(t.id||''),moments:_tabBloc(t.moments).slice(),
        partage:t.partageCoach===true,
        saisiPar:(t.saisiPar==='coach')?'coach':'athlete'};
      if(t.partageCoach!==true) return base;
      // PARTAGE EXPLICITE : le nom et le dosage suivent, le reste non. Le
      // prescripteur et les notes ne servent a aucune decision d'entrainement.
      return Object.assign(base,{nom:String(t.nom||''),
        dosage_quantite:(Number(t.dosage_quantite)>0)?Number(t.dosage_quantite):null,
        dosage_unite:String(t.dosage_unite||'')});
    });
}
// PURE. La phrase du coach. Elle ne nomme rien quand rien n'est partage.
function phraseTraitementsCoach(user){
  const l=traitementsPourCoach(user);
  if(!l.length) return '';
  const moments={};
  for(const t of l) for(const m of t.moments) moments[m]=(moments[m]||0)+1;
  const ordre=Object.keys(moments).sort((a,b)=>_rangMoment(a)-_rangMoment(b));
  const lib=id=>{ const t=TIMINGS_LIST.filter(x=>x.id===id)[0]; return t?t.label.toLowerCase():id; };
  const n=l.length;
  return n+' traitement'+(n>1?'s':'')+' en cours'
    +(ordre.length?' : '+ordre.map(lib).join(', '):'')
    +'. Tiens-en compte avant de proposer un complément.';
}
// ══════════════ L'ECRAN DES TRAITEMENTS ════════════════════════════════
//
// LA LIMITE EST ECRITE DANS LE PRODUIT, PAS DANS UNE POLITIQUE QU'IL FAUDRAIT
// ALLER CHERCHER. Elle s'affiche a l'ouverture, UNE FOIS : repetee a chaque
// visite, elle deviendrait un bandeau qu'on ne lit plus — et c'est exactement
// ce qu'une mention de ce genre ne doit pas devenir.
const TRT_MENTION='RepCore n’est pas un dispositif médical. Il affiche et '
  +'rappelle ce que ton médecin a prescrit, il ne le modifie pas et ne le '
  +'conseille pas.';

function _trtMentionVue(user){
  const u=_dossier(user);
  return !!(u&&u.sante&&u.sante.mentionTraitementsVue);
}
function _trtMarquerMention(user){
  const u=_dossier(user);
  if(!u) return false;
  if(!u.sante||typeof u.sante!=='object') u.sante={};
  if(u.sante.mentionTraitementsVue) return false;
  u.sante.mentionTraitementsVue=Date.now();
  try{ saveUser(); }catch(e){ rcErreurMuette('_trtMarquerMention',e); }
  return true;
}
function ouvrirTraitements(){
  go('s-traitements');
  renderTraitements();
  return true;
}
function renderTraitements(){
  const j=localISODate(new Date());
  // ── LA MENTION, UNE FOIS ─────────────────────────────────────────────
  const zm=document.getElementById('trt-limite');
  if(zm){
    zm.innerHTML=_trtMentionVue(currentUser)?''
      :'<div style="background:var(--info-bg);border:1px solid var(--info-border);'
       +'border-radius:var(--r-3);padding:12px 14px;margin:12px 0 14px;'
       +'font-size:var(--fs-xs);color:var(--text);line-height:1.6">'
       +escapeHtml(TRT_MENTION)+'</div>';
    if(!_trtMentionVue(currentUser)) _trtMarquerMention(currentUser);
  }
  // ── LES INTERACTIONS DU JOUR ─────────────────────────────────────────
  const zi=document.getElementById('trt-interactions');
  if(zi){
    let l=[]; try{ l=interactionsDuJour(currentUser,j); }catch(e){ l=[]; }
    zi.innerHTML=!l.length?'':l.map(x=>
      '<div style="background:var(--warning-bg);border:1px solid var(--warning-border);'
      +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:10px">'
      +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
      +escapeHtml(x.phrase)+'</div>'
      +'<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.55;margin-top:6px">'
      +escapeHtml(x.traitement)+' · '+escapeHtml(x.complement)
      +(x.aDecaler?' : décaler « '+escapeHtml(x.aDecaler)+' » de '
        +(x.delaiMin>=60?(x.delaiMin/60)+' h':x.delaiMin+' min'):'')+'</div>'
      // LA SOURCE EST LISIBLE, pas cachee dans le code : c'est ce qui
      // distingue un avertissement d'une opinion.
      +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">'
      +escapeHtml(x.source)+'</div></div>').join('');
  }
  // ── LA LISTE DU JOUR ─────────────────────────────────────────────────
  const zl=document.getElementById('trt-liste');
  if(zl){
    const actifs=traitements(currentUser).filter(t=>!traitementTermine(t,j)&&t.actif!==false);
    const t7=tauxPrise(currentUser,7,j), t28=tauxPrise(currentUser,28,j);
    let h='';
    if(t7||t28){
      h+='<div style="display:flex;gap:8px;margin-bottom:12px">'
        +[[t7,'7 jours'],[t28,'28 jours']].map(([t,lib])=>
          '<div style="flex:1;background:var(--surface-1);border:1px solid var(--border);'
          +'border-radius:var(--r-3);padding:10px;text-align:center">'
          +'<div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:var(--text)">'
          +(t?t.pct+' %':'-')+'</div>'
          +'<div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;'
          +'text-transform:uppercase">'+lib+'</div></div>').join('')
        +'</div>';
    }
    // ⚠ LE BOUTON D'AJOUT EST AU-DESSUS DE LA LISTE, ET IL Y EST MEME QUAND
    // ELLE EST VIDE. Sans lui, le module n'avait aucune porte d'entree : il
    // savait tout calculer et rien recevoir.
    h+='<button type="button" class="btn" style="width:100%;margin:0 0 14px" '
      +'onclick="ouvrirEditeurTraitement(currentUser.email,null,\'s-traitements\')">'
      +'+ Ajouter un traitement</button>';
    if(!actifs.length){
      h+='<div class="sub" style="font-size:var(--fs-sm);line-height:1.6;padding:14px 0">'
        +'Aucun traitement en cours.</div>';
    } else {
      // PAR MOMENT DE JOURNEE, dans l'ordre des complements — la meme
      // chronologie, lue au meme endroit.
      const parMoment={};
      for(const t of actifs){
        if(!aPrendreLe(t,j)) continue;
        for(const m of _tabBloc(t.moments)) (parMoment[m]=parMoment[m]||[]).push(t);
      }
      const moments=Object.keys(parMoment).sort((a,b)=>_rangMoment(a)-_rangMoment(b));
      for(const m of moments){
        const lib=(TIMINGS_LIST.filter(x=>x.id===m)[0]||{}).label||m;
        h+='<div style="display:flex;align-items:center;gap:8px;margin:14px 0 6px">'
          +_suppTimingIcon(m,15)
          +'<span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;'
          +'color:var(--sub);text-transform:uppercase">'+escapeHtml(lib)+'</span></div>';
        for(const t of parMoment[m]){
          const coche=prisePrise(currentUser,'trt',t.id,m,j);
          const dose=(Number(t.dosage_quantite)>0)
            ? String(t.dosage_quantite).replace('.',',')+' '+escapeHtml(t.dosage_unite||'') : '';
          h+='<label class="reg-ligne reg-ligne--nue" style="display:flex;align-items:center;gap:10px;padding:10px 12px;'
            +'background:var(--surface-1);border:1px solid var(--border);'
            +'border-radius:var(--r-2);margin-bottom:6px;cursor:pointer;'
            +'text-transform:none;letter-spacing:normal;font-weight:400">'
            +'<input type="checkbox" '+(coche?'checked':'')+' '
            +'onchange="basculerPrise(currentUser,\'trt\',\''+escapeHtml(t.id)+'\',\''+m+'\');renderTraitements()" '
            +'style="width:18px;height:18px;margin:0;accent-color:var(--red);flex-shrink:0">'
            +'<span style="flex:1;min-width:0;font-size:var(--fs-sm);color:'
            +(coche?'var(--text-faint)':'var(--text)')+';'+(coche?'text-decoration:line-through':'')+'">'
            +escapeHtml(t.nom)+(dose?' <span style="color:var(--sub)">· '+dose+'</span>':'')
            // CE QUI VIENT DU COACH EST DIT. Une ligne apparue sans qu'on l'ait
            // tapee, dans une liste de medicaments, doit s'expliquer d'elle-meme.
            +(t.saisiPar==='coach'?'<span style="display:block;font-size:var(--fs-2xs);'
              +'color:var(--text-faint);margin-top:2px">saisi par ton coach</span>':'')
            +'</span>'
            +'<button type="button" class="btn btn-outline btn-sm" style="margin:0;flex:0 0 auto;'
            +'font-size:var(--fs-2xs);padding:4px 8px" '
            +'onclick="event.preventDefault();event.stopPropagation();ouvrirEditeurTraitement(currentUser.email,\''+escapeHtml(t.id)+'\',\'s-traitements\')">Modifier</button>'
            +'</label>';
        }
      }
      // LES PONCTUELS : dans la fiche, jamais dans la journee. On les nomme
      // quand meme, sans case a cocher — « au besoin » ne s'oublie pas.
      const ponct=actifs.filter(t=>((t.rythme||{}).type)==='ponctuel');
      if(ponct.length)
        h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:14px">'
          +'Au besoin, sans jour fixe : '
          // ATTEIGNABLES EUX AUSSI. Un ponctuel n'a pas de case a cocher : sans
          // ce lien, il n'existait aucun chemin pour le modifier ni l'arreter.
          +ponct.map(t=>'<a href="#" onclick="event.preventDefault();'
            +'ouvrirEditeurTraitement(currentUser.email,\''+escapeHtml(t.id)+'\',\'s-traitements\')" '
            +'style="color:var(--text-dim);text-decoration:underline">'
            +escapeHtml(t.nom)+'</a>').join(', ')+'.</div>';
    }
    zl.innerHTML=h;
  }
  // ── L'HISTORIQUE ─────────────────────────────────────────────────────
  const zh=document.getElementById('trt-histo');
  if(zh){
    const finis=traitements(currentUser).filter(t=>traitementTermine(t,j));
    zh.innerHTML=!finis.length?''
      :'<div style="margin-top:24px;border-top:1px solid var(--border);padding-top:12px">'
       +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;'
       +'color:var(--sub);text-transform:uppercase;margin-bottom:8px">Terminés</div>'
       // ON NE SUPPRIME PAS UN TRAITEMENT : la trace est une donnee medicale,
       // et elle explique parfois une periode entiere, des annees plus tard.
       +finis.map(t=>'<div style="font-size:var(--fs-xs);color:var(--text-faint);'
         +'line-height:1.6">'
         +'<a href="#" onclick="event.preventDefault();ouvrirFicheTraitement(\''
         +escapeHtml(t.id)+'\')" style="color:var(--text-faint);text-decoration:underline">'
         +escapeHtml(t.nom)+'</a>, jusqu’au '
         +new Date(Number(t.fin)).toLocaleDateString('fr-FR')+'</div>').join('')
       +'</div>';
  }
  return true;
}

// ══════════════ LA SAISIE D'UN TRAITEMENT ══════════════════════════════
//
// UN SEUL EDITEUR POUR LES DEUX COTES. L'athlete saisit ce qu'il prend ; le
// coach saisit ce qu'il sait. Deux formulaires auraient diverge au premier
// champ ajoute, et c'est le genre de divergence qui finit par produire deux
// dossiers qui ne se relisent pas.
//
// ⚠ CE QUE LE COACH SAISIT EST NECESSAIREMENT PARTAGE AVEC LUI. Il vient de
// l'ecrire : le ranger en « non partage » serait un mensonge d'interface, et
// il le verrait de toute facon dans sa propre copie. `partageCoach` est donc
// force a vrai, et l'interrupteur ne lui est meme pas propose.
//
// ⚠ ET L'ATHLETE LE VOIT COMME VENANT DE SON COACH. `saisiPar` n'est pas un
// champ d'audit : c'est ce qui permet a l'athlete de savoir qu'une ligne de sa
// liste ne vient pas de lui, et au filet de poussee de savoir ce que le coach
// a le droit de reecrire.
const TRT_UNITES=Object.freeze(['mg','µg','g','ml','UI','comprimé','gélule','goutte','bouffée','patch','sachet']);
const TRT_VOIES=Object.freeze([['orale','Par la bouche'],['cutanee','Sur la peau'],
  ['inhalee','Inhalée'],['injectable','Injection'],['autre','Autre']]);
const TRT_JOURS_LIB=Object.freeze(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']);
const TRT_NOM_MAX=80, TRT_PRESC_MAX=60, TRT_NOTE_MAX=300;

// {email, id, retour, parCoach}. En memoire, jamais persiste : un editeur
// laisse ouvert d'une session a l'autre rouvrirait sur un dossier qui n'est
// peut-etre plus celui qu'on regarde.
let _trtEdit=null;

// PURE. Le dossier vise. C'est le SEUL endroit qui decide sur quel document on
// ecrit : partout ailleurs on manipule l'objet rendu ici.
function _trtCible(email){
  if(!email||(currentUser&&email===currentUser.email)) return currentUser;
  const users=DB.get('users')||{};
  return users[email]||null;
}
// L'ECRITURE, DES DEUX COTES — lecture, mutation et sauvegarde EN UN SEUL
// PASSAGE.
//
// ⚠ DB.get('users') REND UNE COPIE FRAICHE A CHAQUE APPEL : c'est un
// JSON.parse du stockage local, pas une reference. Muter le dossier rendu par
// un premier appel puis sauvegarder l'objet rendu par un SECOND jette la
// modification a la poubelle, en silence et sans erreur — la saisie du coach
// paraissait reussir et rien n'etait ecrit. Le dossier mute et le dossier
// sauve doivent etre le meme objet, et c'est tout l'objet de cette fonction.
//
// `muter` rend false pour annuler sans rien ecrire.
function _trtEcrire(email,muter){
  if(currentUser&&email===currentUser.email){
    if(muter(currentUser)===false) return false;
    try{ saveUser(); }catch(e){ return false; }
    return true;
  }
  const users=DB.get('users')||{};
  const u=users[email];
  if(!u) return false;
  if(muter(u)===false) return false;
  // Un traitement saisi et pas pousse est un traitement perdu au changement
  // d'appareil : la poussee fait partie de l'enregistrement, pas de la suite.
  u.updatedAt=Date.now(); users[email]=u;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(email,u),'Traitement enregistré','le traitement est');
  return ok;
}

function ouvrirEditeurTraitement(email,id,retour){
  const u=_trtCible(email);
  if(!u) return false;
  _trtEdit={email:email||(currentUser&&currentUser.email),id:id||null,
    retour:retour||'s-traitements',
    parCoach:!!(currentUser&&currentUser.role==='coach'&&email!==currentUser.email)};
  go('s-traitement-edit');
  renderEditeurTraitement();
  return true;
}
function fermerEditeurTraitement(){
  const r=(_trtEdit&&_trtEdit.retour)||'s-traitements';
  _trtEdit=null;
  go(r);
  try{ if(r==='s-traitements') renderTraitements(); }catch(e){}
  try{ if(r==='s-coach-client') renderCoachMicroSection(getOwnedClient(currentClientId,DB.get('users')||{})); }catch(e){}
  return true;
}

function renderEditeurTraitement(){
  const z=document.getElementById('trte-corps');
  if(!z||!_trtEdit) return false;
  const u=_trtCible(_trtEdit.email);
  const t=_trtEdit.id?(traitements(u).filter(x=>x.id===_trtEdit.id)[0]||null):null;
  const ti=document.getElementById('trte-titre');
  if(ti) ti.textContent=t?'Modifier':'Nouveau traitement';
  const v=(x,d)=>escapeHtml(String(x==null?(d==null?'':d):x));
  const moments=_tabBloc(t&&t.moments);
  const ryt=((t&&t.rythme&&t.rythme.type)||'quotidien');
  const jours=_tabBloc(t&&t.rythme&&t.rythme.jours);
  const iso=ms=>{ const n=Number(ms); if(!n) return ''; try{ return localISODate(new Date(n)); }catch(e){ return ''; } };
  const champ=(id,lbl,attrs,aide)=>
    '<label style="display:block;margin-bottom:12px">'
    +'<span style="display:block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">'+escapeHtml(lbl)+'</span>'
    +'<input id="'+id+'" '+attrs+' style="width:100%;box-sizing:border-box;background:var(--surface-1);'
    +'border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
    +'padding:10px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">'
    +(aide?'<span style="display:block;font-size:var(--fs-2xs);color:var(--text-faint);'
      +'line-height:1.5;margin-top:4px">'+escapeHtml(aide)+'</span>':'')
    +'</label>';

  let h='';
  // ⚠ LA MENTION AVANT LE PREMIER CHAMP, et non en bas de page. Ce qui borne
  // ce que l'app fait d'une donnee de sante doit etre lu AVANT qu'elle soit
  // saisie, pas apres.
  h+='<div style="background:var(--info-bg);border:1px solid var(--info-border);'
    +'border-radius:var(--r-3);padding:12px 14px;margin:12px 0 16px;'
    +'font-size:var(--fs-2xs);color:var(--text);line-height:1.6">'
    +escapeHtml(TRT_MENTION)+'</div>';
  if(_trtEdit.parCoach)
    h+='<div style="background:var(--warning-bg);border:1px solid var(--warning-border);'
      +'border-radius:var(--r-3);padding:12px 14px;margin-bottom:16px;'
      +'font-size:var(--fs-2xs);color:var(--text);line-height:1.6">'
      +'Tu saisis ce traitement dans le dossier de ton athlète. Il y sera '
      +'affiché comme venant de toi, et il pourra l’arrêter lui-même. '
      +'Un traitement que tu saisis t’est forcément visible.</div>';

  h+=champ('trte-nom','Nom du traitement',
    'type="text" maxlength="'+TRT_NOM_MAX+'" value="'+v(t&&t.nom)+'" placeholder="Lévothyrox 75 µg"');

  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +champ('trte-dq','Dose','type="number" step="any" min="0" value="'
      +v(t&&t.dosage_quantite)+'" placeholder="75"')
    +'<label style="display:block;margin-bottom:12px">'
    +'<span style="display:block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Unité</span>'
    +'<select id="trte-du" style="width:100%;box-sizing:border-box;background:var(--surface-1);'
    +'border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
    +'padding:10px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">'
    +'<option value=""></option>'
    +TRT_UNITES.map(x=>'<option value="'+escapeHtml(x)+'"'
      +(((t&&t.dosage_unite)===x)?' selected':'')+'>'+escapeHtml(x)+'</option>').join('')
    +'</select></label></div>';

  h+='<label style="display:block;margin-bottom:12px">'
    +'<span style="display:block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Voie</span>'
    +'<select id="trte-voie" style="width:100%;box-sizing:border-box;background:var(--surface-1);'
    +'border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);'
    +'padding:10px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)">'
    +TRT_VOIES.map(([id,lib])=>'<option value="'+id+'"'
      +(((t&&t.voie)||'orale')===id?' selected':'')+'>'+escapeHtml(lib)+'</option>').join('')
    +'</select></label>';

  // ── LES MOMENTS ────────────────────────────────────────────────────────
  // Dans l'ordre de la JOURNEE, celui des complements. Deux modules qui
  // rangent les memes moments dans deux ordres differents se lisent mal l'un
  // apres l'autre, et l'ecran des interactions les met cote a cote.
  h+='<div style="margin-bottom:14px">'
    +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Moments de prise</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
    +SUPP_ORDRE_JOURNEE.map(id=>{
      const lib=(TIMINGS_LIST.filter(x=>x.id===id)[0]||{}).label||id;
      const on=moments.indexOf(id)>=0;
      return '<label style="display:inline-flex;align-items:center;gap:6px;'
        +'background:'+(on?'var(--red-dim, var(--surface-2))':'var(--surface-1)')+';'
        +'border:1px solid '+(on?'var(--red)':'var(--border)')+';border-radius:var(--r-2);'
        +'padding:8px 10px;cursor:pointer;font-size:var(--fs-xs);color:var(--text);'
        +'text-transform:none;letter-spacing:normal;font-weight:400">'
        +'<input type="checkbox" class="trte-m" value="'+id+'"'+(on?' checked':'')
        +' style="width:15px;height:15px;margin:0;accent-color:var(--red)">'
        +escapeHtml(lib)+'</label>';
    }).join('')
    +'</div></div>';

  // ── LE RYTHME ──────────────────────────────────────────────────────────
  const rad=(val,lib)=>'<label class="reg-ligne reg-ligne--nue" style="display:flex;align-items:center;gap:8px;'
    +'padding:10px 12px;background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-2);margin-bottom:6px;cursor:pointer;font-size:var(--fs-sm);'
    +'color:var(--text);text-transform:none;letter-spacing:normal;font-weight:400">'
    +'<input type="radio" name="trte-ryt" value="'+val+'"'+(ryt===val?' checked':'')
    +' onchange="_trtMajRythme()" style="width:16px;height:16px;margin:0;accent-color:var(--red)">'
    +escapeHtml(lib)+'</label>';
  h+='<div style="margin-bottom:14px">'
    +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;'
    +'color:var(--sub);text-transform:uppercase;margin-bottom:6px">Rythme</div>'
    +rad('quotidien','Tous les jours')
    +rad('jours','Certains jours de la semaine')
    +rad('cycle','Par cycle : X jours de prise, Y d’arrêt')
    +rad('ponctuel','Au besoin, sans jour fixe')
    +'<div id="trte-jours" style="display:'+(ryt==='jours'?'flex':'none')+';flex-wrap:wrap;gap:6px;margin-top:8px">'
    +[1,2,3,4,5,6,0].map(n=>'<label style="display:inline-flex;align-items:center;gap:6px;'
      +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);'
      +'padding:6px 10px;cursor:pointer;font-size:var(--fs-xs);color:var(--text);'
      +'text-transform:none;letter-spacing:normal;font-weight:400">'
      +'<input type="checkbox" class="trte-j" value="'+n+'"'
      +(jours.indexOf(n)>=0?' checked':'')
      +' style="width:14px;height:14px;margin:0;accent-color:var(--red)">'
      +TRT_JOURS_LIB[n].slice(0,3)+'</label>').join('')
    +'</div>'
    +'<div id="trte-cycle" style="display:'+(ryt==='cycle'?'grid':'none')+';'
    +'grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">'
    +champ('trte-on','Jours de prise','type="number" min="1" max="365" value="'
      +v(t&&t.rythme&&t.rythme.cycleOn,21)+'"')
    +champ('trte-off','Jours d’arrêt','type="number" min="0" max="365" value="'
      +v(t&&t.rythme&&t.rythme.cycleOff,7)+'"')
    +'</div>'
    +'<div id="trte-ancre" style="display:'+(ryt==='cycle'?'block':'none')+';margin-top:2px">'
    +champ('trte-ancred','Premier jour du cycle','type="date" value="'
      +v(iso(t&&t.rythme&&t.rythme.ancre)||iso(t&&t.debut)||localISODate(new Date()))+'"',
      'Le compte des jours part de cette date.')
    +'</div></div>';

  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +champ('trte-debut','Début','type="date" value="'+v(iso(t&&t.debut)||localISODate(new Date()))+'"')
    +champ('trte-fin','Fin (si connue)','type="date" value="'+v(iso(t&&t.fin))+'"')
    +'</div>';
  h+=champ('trte-presc','Prescripteur','type="text" maxlength="'+TRT_PRESC_MAX
    +'" value="'+v(t&&t.prescripteur)+'" placeholder="Dr Martin"');
  h+=champ('trte-note','Note','type="text" maxlength="'+TRT_NOTE_MAX
    +'" value="'+v(t&&t.note)+'" placeholder="à jeun, 30 min avant le petit-déjeuner"');

  // ── LE PARTAGE ─────────────────────────────────────────────────────────
  // ⚠ IL N'EST PROPOSE QU'A L'ATHLETE, et il vaut NON tant qu'il n'y touche
  // pas. Un interrupteur pre-coche n'est pas un consentement.
  if(!_trtEdit.parCoach)
    h+='<label class="reg-ligne reg-ligne--nue" style="display:flex;align-items:flex-start;gap:10px;padding:12px 12px;'
      +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);'
      +'margin:6px 0 16px;cursor:pointer;text-transform:none;letter-spacing:normal;font-weight:400">'
      +'<input type="checkbox" id="trte-partage"'+((t&&t.partageCoach===true)?' checked':'')
      +' style="width:18px;height:18px;margin:2px 0 0;accent-color:var(--red);flex-shrink:0">'
      +'<span style="flex:1;min-width:0"><span style="display:block;font-size:var(--fs-sm);'
      +'color:var(--text);line-height:1.5">Montrer ce traitement à mon coach</span>'
      +'<span style="display:block;font-size:var(--fs-2xs);color:var(--text-faint);'
      +'line-height:1.55;margin-top:4px">Sans ça, il voit seulement qu’un traitement '
      +'est pris à ce moment de la journée, ni le nom, ni la dose, ni le '
      +'prescripteur. Ce que tu ne partages pas ne quitte pas ce téléphone, et '
      +'ne sera donc pas retrouvé si tu en changes.</span></span></label>';

  h+='<button type="button" class="btn" style="width:100%;margin:4px 0 0" '
    +'onclick="sauverTraitement()">Enregistrer</button>';
  if(t&&!traitementTermine(t))
    h+='<button type="button" class="btn btn-outline" style="width:100%;margin:10px 0 0" '
      +'onclick="arreterTraitement()">Arrêter ce traitement</button>';
  // ⚠ AUCUN BOUTON « SUPPRIMER ». On n'efface pas un traitement : la trace est
  // une donnee medicale, et elle explique parfois une periode entiere des
  // annees plus tard. On l'arrete, il passe dans les termines.
  z.innerHTML=h;
  return true;
}
// Le rythme choisi commande ce qui est visible. Ecrit une fois, appele par les
// quatre boutons radio.
function _trtMajRythme(){
  const r=(document.querySelector('input[name="trte-ryt"]:checked')||{}).value||'quotidien';
  const d=(id,on,mode)=>{ const e=document.getElementById(id); if(e) e.style.display=on?(mode||'block'):'none'; };
  d('trte-jours',r==='jours','flex');
  d('trte-cycle',r==='cycle','grid');
  d('trte-ancre',r==='cycle','block');
  return r;
}

// PURE. LA VALIDATION, SEPAREE DU DOM pour qu'une assertion puisse l'exercer
// sans ouvrir d'ecran. Rend un message, ou la chaine vide.
function _trtValider(t){
  if(!t||!String(t.nom||'').trim()) return 'Donne un nom à ce traitement.';
  if(String(t.nom).length>TRT_NOM_MAX) return 'Le nom est trop long.';
  const r=(t.rythme||{}).type||'quotidien';
  // ⚠ UN PONCTUEL N'A PAS DE MOMENT OBLIGATOIRE : « au besoin » n'a pas
  // d'heure, et exiger une case ferait inventer une reponse.
  if(r!=='ponctuel'&&!_tabBloc(t.moments).length)
    return 'Choisis au moins un moment de prise.';
  if(r==='jours'&&!_tabBloc(t.rythme.jours).length)
    return 'Choisis au moins un jour de la semaine.';
  if(r==='cycle'){
    if(!(Number(t.rythme.cycleOn)>0)) return 'Le nombre de jours de prise doit être au moins 1.';
    if(!(Number(t.rythme.cycleOff)>=0)) return 'Le nombre de jours d’arrêt ne peut pas être négatif.';
  }
  // ⚠ UNE FIN AVANT LE DEBUT rendrait le traitement invisible partout sans
  // qu'aucun ecran ne dise pourquoi : aPrendreLe repondrait faux tous les
  // jours, et la liste resterait vide.
  if(t.debut&&t.fin&&Number(t.fin)<Number(t.debut))
    return 'La date de fin est avant la date de début.';
  return '';
}

function sauverTraitement(){
  if(!_trtEdit) return false;
  const u=_trtCible(_trtEdit.email);
  if(!u) return false;
  const g=id=>document.getElementById(id);
  const txt=id=>String((g(id)||{}).value||'').trim();
  const msDe=id=>{ const s=txt(id); if(!s) return null;
    const d=_dateDeISO(s); return d?d.getTime():null; };
  const ryt=(document.querySelector('input[name="trte-ryt"]:checked')||{}).value||'quotidien';
  const rythme={type:ryt};
  if(ryt==='jours')
    rythme.jours=Array.prototype.slice.call(document.querySelectorAll('.trte-j'))
      .filter(x=>x.checked).map(x=>parseInt(x.value,10));
  if(ryt==='cycle'){
    rythme.cycleOn=Math.max(1,parseInt(txt('trte-on'),10)||21);
    rythme.cycleOff=Math.max(0,parseInt(txt('trte-off'),10)||0);
    rythme.ancre=msDe('trte-ancred')||Date.now();
  }
  const ancien=_trtEdit.id?(traitements(u).filter(x=>x.id===_trtEdit.id)[0]||null):null;
  const dq=parseFloat(txt('trte-dq'));
  const t={
    id:_trtEdit.id||('t'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)),
    nom:txt('trte-nom').slice(0,TRT_NOM_MAX),
    dosage_quantite:(isFinite(dq)&&dq>0)?dq:null,
    dosage_unite:String(((g('trte-du')||{}).value)||''),
    voie:String(((g('trte-voie')||{}).value)||'orale'),
    moments:Array.prototype.slice.call(document.querySelectorAll('.trte-m'))
      .filter(x=>x.checked).map(x=>x.value),
    rythme:rythme,
    debut:msDe('trte-debut')||(ancien&&ancien.debut)||Date.now(),
    fin:msDe('trte-fin'),
    prescripteur:txt('trte-presc').slice(0,TRT_PRESC_MAX),
    note:txt('trte-note').slice(0,TRT_NOTE_MAX),
    actif:ancien?(ancien.actif!==false):true,
    // ⚠ QUI L'A SAISI NE CHANGE PLUS JAMAIS. Un traitement saisi par le coach
    // et modifie ensuite par l'athlete reste « du coach » : c'est ce que le
    // filet de poussee lit pour savoir ce que le coach a le droit de reecrire,
    // et le retourner ferait perdre la ligne au premier envoi.
    saisiPar:(ancien&&ancien.saisiPar)||(_trtEdit.parCoach?'coach':'athlete'),
    // ⚠ CE QUE LE COACH SAISIT LUI EST FORCEMENT VISIBLE. Il vient de l'ecrire.
    partageCoach:_trtEdit.parCoach?true:!!((g('trte-partage')||{}).checked)
  };
  const err=_trtValider(t);
  if(err){ try{ toast(err,'var(--orange)'); }catch(e){} return false; }
  // ⚠ _trtStore REND LE TABLEAU LUI-MEME, deja normalise et deja accroche au
  // dossier — pas l'objet `sante`. On ecrit donc dedans, sans le reposer, et
  // SUR LE DOSSIER QUE _trtEcrire VA SAUVER : `u` ci-dessus n'a servi qu'a
  // relire l'ancienne version.
  if(!_trtEcrire(_trtEdit.email,d=>{
    const l=_trtStore(d);
    const i=l.findIndex(x=>x&&x.id===t.id);
    if(i>=0) l[i]=t; else l.push(t);
  })) return false;
  try{ toast('Traitement enregistré','var(--success)'); }catch(e){}
  fermerEditeurTraitement();
  return true;
}
async function arreterTraitement(){
  if(!_trtEdit||!_trtEdit.id) return false;
  const u=_trtCible(_trtEdit.email);
  if(!u) return false;
  const t=traitements(u).filter(x=>x.id===_trtEdit.id)[0];
  if(!t) return false;
  const ok=await rcConfirm('Arrêter ce traitement',
    'Il sortira de ta journée dès demain et passera dans les traitements '
    +'terminés. Il n’est pas supprimé : la trace reste dans ton dossier.',
    'Arrêter');
  if(!ok) return false;
  if(!_trtEcrire(_trtEdit.email,d=>{
    if(!terminerTraitement(d,t.id).ok) return false;
  })) return false;
  fermerEditeurTraitement();
  return true;
}
function ouvrirFicheTraitement(id){
  const t=traitements(currentUser).filter(x=>x.id===id)[0];
  if(!t) return false;
  const r=(t.rythme&&t.rythme.type)||'quotidien';
  const JOURS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const rythme=r==='quotidien'?'Tous les jours'
    :r==='jours'?('Les '+_tabBloc(t.rythme.jours).map(n=>JOURS[n]).join(', '))
    :r==='cycle'?(t.rythme.cycleOn+' jours de prise puis '+t.rythme.cycleOff+' d’arrêt')
    :'Au besoin, sans jour fixe';
  const NL=String.fromCharCode(10);
  const l=[t.nom];
  if(Number(t.dosage_quantite)>0)
    l.push('Dose : '+String(t.dosage_quantite).replace('.',',')+' '+(t.dosage_unite||''));
  l.push('Rythme : '+rythme);
  if(t.prescripteur) l.push('Prescrit par : '+t.prescripteur);
  if(t.notes) l.push(t.notes);
  l.push(t.partageCoach===true
    ? 'Ton coach voit le nom et la dose de ce traitement.'
    : 'Ton coach voit seulement qu’un traitement est actif à ce moment de la journée, ni le nom, ni la dose.');
  // ⚠ AUCUNE MODIFICATION DE POSOLOGIE DEPUIS L'APP. Ni ici, ni cote
  // coach : la dose se change chez le medecin, et une application qui
  // offrirait le geste laisserait croire qu'elle en a le droit. Cette fiche
  // est en LECTURE, et rcAlerte n'offre qu'un bouton de fermeture.
  l.push(TRT_MENTION);
  try{ rcAlerte(l.join(NL+NL)); }catch(e){}
  return true;
}
function _suppTimingIcon(id,size,color){
  const m=SUPP_TIMING_META[id];
  if(!m) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color||m.color}" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter" width="${size}" height="${size}" style="flex-shrink:0">${m.svg}</svg>`;
}
// ── L'ENCART « QUALITÉ ET SOURCING » A ÉTÉ RETIRÉ ─────────────────────────
//
// Retiré sur demande de Kevin, le 21/08/2026. La trace reste ici parce que ce
// bloc n'était pas décoratif, et que quelqu'un — Kevin lui-même dans six
// mois — pourrait le réintroduire sans savoir ce qu'il portait.
//
// Il disait que la qualité varie d'une marque à l'autre, qu'un complément
// contaminé suffit à rendre positif un athlète qui concourt sous contrôle
// antidopage, et qu'il faut chercher un contrôle par laboratoire tiers. Il
// existait en deux versions, tutoyée pour l'athlète et à la troisième
// personne pour le coach, et ne nommait aucune marque.
//
// C'ÉTAIT LE SEUL ENDROIT DU PRODUIT OÙ L'ANTIDOPAGE APPARAISSAIT. La
// contamination croisée est une cause documentée de contrôle positif chez des
// athlètes de bonne foi ; l'encart s'affichait même sur une liste vide, parce
// que c'est avant le premier achat qu'il servait le plus. Rien ne le remplace
// aujourd'hui : l'information a disparu de l'application, elle n'a pas été
// déplacée ailleurs.
//
// La décision appartient à Kevin, elle est appliquée. Ceci n'est pas une
// objection, c'est le compte rendu de ce qui a été retiré.
// Générique, et le rester : aucune interaction n'est nommée, aucun complément
// n'est déconseillé, aucun texte n'est lu. On dit qu'il existe une question à
// poser, et à QUI la poser — c'est tout ce que le produit peut honnêtement
// faire depuis une case à cocher.
const TRAITEMENT_SUPP='Tu as déclaré un traitement régulier. Avant d\'ajouter '
  +'un complément, demande à ton médecin ou à ton pharmacien : c\'est à eux '
  +'de dire si l\'un peut gêner l\'autre.';
function _htmlTraitementSupp(user){
  if(!traitementDeclare(user||currentUser)) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(TRAITEMENT_SUPP)}</div>
  </div>`;
}
// Libellé de la forme retenue dans le dossier. Le produit a pu être renommé
// depuis : la clé stockée ne retrouve alors plus sa fiche, et on rend la clé
// telle quelle plutôt que de faire disparaître ce que l'athlète avait choisi.
function _libelleForme(fiche,cle){
  if(!cle) return '';
  const f=((fiche&&fiche.formes)||[]).find(x=>x.cle===cle);
  return f?f.lib:String(cle);
}
// « À juger après 4 semaines de prise régulière », et seulement pour les trois
// produits qui portent le champ. Les autres n'affichent rien : une durée
// inventée vaudrait moins que pas de durée du tout.
function phraseDureeJugement(fiche){
  const n=fiche&&fiche.dureeAvantJugement;
  if(!(n>0)) return '';
  return 'À juger après '+n+' semaine'+(n>1?'s':'')+' de prise régulière.';
}
// Les formes d'un produit, dans l'ordre de la fiche — de la mieux tolérée à la
// moins bien. Rangées dans le dépli « à savoir » : c'est une information
// d'achat, elle n'a pas à occuper la ligne de tous les jours.
function _htmlFormesFiche(fiche,cleRetenue){
  const l=(fiche&&fiche.formes)||[];
  if(!l.length) return '';
  return `<div style="margin-top:8px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Formes</div>
    ${l.map(f=>`<div style="font-size:var(--fs-xs);color:${f.cle===cleRetenue?'var(--text)':'#bbb'};line-height:1.55;margin-bottom:4px">
      <b style="font-weight:800">${escapeHtml(f.lib)}</b> : ${escapeHtml(f.note)}</div>`).join('')}
  </div>`;
}

// Compléments regroupés par moment de prise — une section par créneau de la journée
// Toute entrée porte un identifiant AVANT que le HTML ne le cite. Les trois
// chemins de création en posent déjà un ; il reste les dossiers écrits avant
// que ce champ n'existe. On le pose ici, au seul endroit où son absence
// coûterait quelque chose : la ligne qui va le mettre dans un onclick.
//
// Unicité assurée contre les identifiants DÉJÀ présents : deux entrées créées
// dans la même milliseconde partageraient sinon la même clef, et le défaut
// qu'on corrige reviendrait par une autre porte.
function _suppAssurerIds(list){
  if(!Array.isArray(list)) return list;
  const vus=new Set(list.filter(x=>x&&x.id!=null).map(x=>x.id));
  let n=Date.now();
  for(const x of list){
    if(!x||x.id!=null) continue;
    while(vus.has(n)) n++;
    x.id=n; vus.add(n); n++;
  }
  return list;
}
// PURE. Le rang d'une entrée dans SA liste, par identité. -1 si absente : les
// appelants s'en servent comme garde, exactement comme avant avec un index.
function _suppIndexParId(list,id){
  if(!Array.isArray(list)) return -1;
  const n=Number(id);
  if(!Number.isFinite(n)) return -1;
  return list.findIndex(x=>x&&Number(x.id)===n);
}
// ── LES VIGNETTES DES COMPLEMENTS (build 1380) ─────────────────────────
//
// Soixante vignettes decoupees dans la planche de Kevin (« RepCore —
// compléments alimentaires, icônes officielles »), rangees dans UNE image :
// img/complements.webp, 12 × 5 cases de 128 px, 85 ko. Une seule requete, et
// en cache des l'installation du service worker, comme les medaillons : le
// plan de complements se lit en salle, souvent sans reseau.
//
// L'ORDRE EST CELUI DE LA PLANCHE, rangee par rangee — la colonne de gauche
// puis celle de droite. Le rang dans ce tableau EST la case : le changer sans
// recouper l'image decalerait toutes les vignettes d'un cran.
const SUPP_ICO_COLS=12, SUPP_ICO_RANGS=5;
const SUPP_ICONES=Object.freeze([
  'whey','isolat','caseine','beef','vegetale','clear-whey',
  'bcaa','eaa','glutamine','taurine','glycine','citrulline',
  'creatine','creatine-hcl','creatine-ethyl','creatine-kre','creatine-magnapower','creatine-buffered',
  'pre-workout','cafeine','the-vert','theobromine','dmha','dmaa',
  'vitamine-a','vitamine-b','vitamine-c','vitamine-d','vitamine-e','vitamine-k',
  'magnesium','zinc','fer','calcium','potassium','selenium',
  'omega-3','collagene','coq10','probiotiques','curcumine','resveratrol',
  'melatonine','ashwagandha','rhodiola','l-theanine','5-htp','gaba',
  'psyllium','enzymes','l-glutamine','charbon','betaine','fibres',
  'multivitamines','nac','alpha-gpc','hmb','spiruline','adaptogenes']);
// LA FAMILLE DIT CE QU'EST LE PRODUIT, JAMAIS CE QU'IL FAIT. La maquette
// portait « Énergie », « Immunité », « Anti-catabolisme », « Force » : autant
// d'effets promis, dont l'un contredisait la fiche du produit (les EAA,
// « redondants si le total de protéines est atteint », niveau C). Une
// etiquette qui promet ce que la fiche dement ne tient pas dans cet ecran. On
// garde la forme de la maquette — l'etiquette coloree sous la dose — et on y
// met ce qui est vrai de tous les produits de la famille.
const SUPP_FAMILLES=Object.freeze({
  proteine:   {lib:'Protéine',    c:'#ef4444'},
  acide:      {lib:'Acide aminé', c:'#f59e0b'},
  creatine:   {lib:'Créatine',    c:'#fb923c'},
  booster:    {lib:'Booster',     c:ROUGE_MARQUE},
  vitamine:   {lib:'Vitamine',    c:'#facc15'},
  mineral:    {lib:'Minéral',     c:'#f59e0b'},
  gras:       {lib:'Acides gras', c:'#f59e0b'},
  sante:      {lib:'Santé',       c:'#f59e0b'},
  sommeil:    {lib:'Sommeil',     c:'#a78bfa'},
  plante:     {lib:'Plante',      c:'#84cc16'},
  algue:      {lib:'Algue',       c:'#84cc16'},
  digestion:  {lib:'Diges\u00ADtion',c:'#84cc16'},
  glucides:   {lib:'Glucides',    c:'#f59e0b'},
  // Les deux libelles d'un seul mot trop long pour 48 px portent un trait
  // d'union CONDITIONNEL : invisible quand la place suffit, « ÉLECTRO- /
  // LYTES » quand elle manque.
  hydratation:{lib:'Électro\u00ADlytes',c:'#38bdf8'}
});
// LE NOM SAISI, RAPPROCHE D'UNE VIGNETTE. Les dossiers stockent un nom libre :
// « Vitamine C 1000 », « Mon iso vanille », « Électrolytes ». On compare sans
// accent, en minuscules, la ponctuation reduite a des espaces — et LE PREMIER
// MOTIF QUI RECONNAIT GAGNE : les formes precises passent avant les mots
// generiques (« clear whey » avant « whey », « créatine HCl » avant
// « créatine »).
//
// ⚠ Quand deux produits partagent une vignette — la crème de riz prend la
// dosette de la caséine, les électrolytes le potassium, faute de mieux sur
// la planche —, la FAMILLE reste juste : c'est elle qui se lit.
const SUPP_ICO_REGLES=Object.freeze([
  [/\bclear\b/,'clear-whey','proteine'],
  [/\bisolat|\biso\b|\bisolate\b/,'isolat','proteine'],
  [/\bcasein/,'caseine','proteine'],
  [/\bbeef\b|\bboeuf\b/,'beef','proteine'],
  [/\bvegetal|\bvegan|\bpois\b|\bchanvre\b|\bproteine de riz\b|\bsoja\b/,'vegetale','proteine'],
  [/\bcollagen/,'collagene','proteine'],
  [/\bwhey\b|\bprotein|\bgainer\b/,'whey','proteine'],
  [/\belectrolyte|\bisotonique\b|\bhydratation\b/,'potassium','hydratation'],
  [/\bcreme de riz\b|\bcream of rice\b|\bmaltodextrine\b|\bdextrose\b|\bglucide|\bcyclodextrine\b|\bvitargo\b|\bpalatinose\b|\bavoine\b|\bgel energetique\b/,'caseine','glucides'],
  [/\bhcl\b.*\bcreatine\b|\bcreatine\b.*\bhcl\b|\bchlorhydrate de creatine\b/,'creatine-hcl','creatine'],
  [/\bethyl ester\b/,'creatine-ethyl','creatine'],
  [/\bkre\b|\balkalyn/,'creatine-kre','creatine'],
  [/\bmagnapower\b/,'creatine-magnapower','creatine'],
  [/\bcreatine\b.*\b(buffered|tamponnee)\b/,'creatine-buffered','creatine'],
  [/\bcreatine\b/,'creatine','creatine'],
  [/\bbcaa\b|\bleucine\b/,'bcaa','acide'],
  [/\beaa\b|\bacides? amines? essentiels?\b/,'eaa','acide'],
  [/\bglutamine\b/,'glutamine','acide'],
  [/\btaurine\b/,'taurine','acide'],
  [/\bglycine\b/,'glycine','acide'],
  [/\bcitrulline\b|\barginine\b|\bbeta alanine\b|\bornithine\b|\bcarnitine\b/,'citrulline','acide'],
  [/\btheanine\b/,'l-theanine','acide'],
  [/\b5 htp\b|\bgriffonia\b|\btryptophane?\b/,'5-htp','acide'],
  [/\bgaba\b/,'gaba','acide'],
  [/\bnac\b|\bacetyl ?cysteine\b/,'nac','acide'],
  [/\bpre ?workout\b|\bpre entrainement\b|\bbooster\b/,'pre-workout','booster'],
  [/\bcafeine\b|\bcaffeine\b|\bguarana\b/,'cafeine','booster'],
  [/\bdmha\b/,'dmha','booster'],
  [/\bdmaa\b/,'dmaa','booster'],
  [/\btheobromine\b|\bcacao\b/,'theobromine','booster'],
  [/\bthe vert\b|\bgreen tea\b|\begcg\b|\bmatcha\b/,'the-vert','plante'],
  [/\bmulti ?vitamine|\bmultivit|\bmulti\b/,'multivitamines','vitamine'],
  [/\bvit(amine)?s? ?a\b|\bretinol\b/,'vitamine-a','vitamine'],
  [/\bvit(amine)?s? ?b\d*\b|\bb12\b|\bb6\b|\bb9\b|\bfolate|\bbiotine\b/,'vitamine-b','vitamine'],
  [/\bvit(amine)?s? ?c\b|\bascorbique\b/,'vitamine-c','vitamine'],
  [/\bvit(amine)?s? ?d\d?\b|\bd3\b|\bcholecalciferol\b/,'vitamine-d','vitamine'],
  [/\bvit(amine)?s? ?e\b|\btocopherol/,'vitamine-e','vitamine'],
  [/\bvit(amine)?s? ?k\d?\b|\bk2\b/,'vitamine-k','vitamine'],
  [/\bzma\b|\bzinc\b/,'zinc','mineral'],
  [/\bmagnesium\b/,'magnesium','mineral'],
  [/\bfer\b|\biron\b/,'fer','mineral'],
  [/\bcalcium\b/,'calcium','mineral'],
  [/\bpotassium\b|\bsodium\b/,'potassium','mineral'],
  [/\bselenium\b|\biode\b/,'selenium','mineral'],
  [/\bomega\b|\bhuile de poisson\b|\bfish oil\b|\bepa\b|\bdha\b|\bkrill\b/,'omega-3','gras'],
  [/\bq10\b|\bcoenzyme\b|\bubiquinol\b/,'coq10','sante'],
  [/\bprobiotique|\blactobac|\bbifido/,'probiotiques','digestion'],
  [/\bcurcum|\bturmeric\b|\bgingembre\b/,'curcumine','plante'],
  [/\bresveratrol\b/,'resveratrol','sante'],
  [/\bmelatonine\b/,'melatonine','sommeil'],
  [/\bashwagandha\b|\bksm\b/,'ashwagandha','plante'],
  [/\brhodiola\b/,'rhodiola','plante'],
  [/\bpsyllium\b/,'psyllium','digestion'],
  [/\benzyme/,'enzymes','digestion'],
  [/\bcharbon\b/,'charbon','digestion'],
  [/\bbetaine\b/,'betaine','digestion'],
  [/\bfibre|\bprebiotique|\binuline\b/,'fibres','digestion'],
  [/\balpha ?gpc\b|\bcholine\b/,'alpha-gpc',null],
  [/\bhmb\b/,'hmb',null],
  [/\bspirulin|\bchlorella\b/,'spiruline','algue'],
  // Build 1847 : les nitrates (jus de betterave) prennent la case générique
  // des plantes ; le bicarbonate passe par « sodium » (potassium, minéral).
  [/\bnitrate|\bbetterave\b/,'adaptogenes','plante'],
  [/\bbicarbonate\b/,'potassium','mineral'],
  [/\badaptogene|\bmaca\b|\bginseng\b/,'adaptogenes','plante']
]);
// PURE. Le nom reduit a ce qui se compare.
function _suppIcoNorm(s){
  return ' '+String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' ';
}
// PURE. Aucun motif ne reconnait le nom : la vignette suit L'UNITE — une
// gelule pour des gelules, un comprime pour des comprimes, une dosette pour
// des scoops. Elle ressemble a ce que l'athlete a dans la main, et AUCUNE
// famille n'est inventee : l'etiquette reste vide.
function _suppIconeParUnite(unite){
  const u=_suppIcoNorm(unite);
  if(/\bgelule|\bcapsule|\bcaps\b/.test(u)) return 'nac';
  if(/\bcomprime|\bcp\b|\bpastille/.test(u)) return 'calcium';
  if(/\bscoop|\bdose|\bmesure|\bcuill/.test(u)) return 'caseine';
  if(/\bml\b|\bcl\b|\bgoutte/.test(u)) return 'vitamine-d';
  if(/\bmg\b|\bmcg\b|\bug\b|\bui\b/.test(u)) return 'l-theanine';
  if(/\bg\b|\bgramme/.test(u)) return 'glycine';
  return 'nac';
}
// PURE. {ico, fam} pour une entree du dossier. fam vaut null quand rien ne
// permet de dire ce qu'est le produit.
function suppIcone(s){
  const n=_suppIcoNorm(s&&s.name);
  for(const [re,ico,fam] of SUPP_ICO_REGLES) if(re.test(n)) return {ico:ico,fam:fam};
  return {ico:_suppIconeParUnite(s&&s.dosage_unit),fam:null};
}
// PURE. La position CSS de la case. Une cle inconnue retombe sur la
// premiere case plutot que de montrer un carre vide.
function suppIconePos(ico){
  const i=Math.max(0,SUPP_ICONES.indexOf(ico));
  const c=i%SUPP_ICO_COLS, r=Math.floor(i/SUPP_ICO_COLS);
  const p=(v,n)=>(Math.round(v/(n-1)*10000)/100)+'%';
  return p(c,SUPP_ICO_COLS)+' '+p(r,SUPP_ICO_RANGS);
}
// Le sous-titre de chaque moment, sous son nom. Ceux de la maquette pour
// les cinq qu'elle montre ; les autres dans le meme registre.
const SUPP_MOMENT_SOUS=Object.freeze({
  'jeun':'Au réveil, avant de manger',
  'matin':'Énergie & focus',
  'avant-entrainement':'Performance maximale',
  'intra':'Hydratation & endurance',
  'apres-entrainement':'Juste après la séance',
  'midi':'Soutien au quotidien',
  'apres-midi':'Le cap de la journée',
  'soir':'Récupération & sommeil',
  'coucher':'Avant la nuit',
  'toutes-4h':'Prises réparties',
  '_none':'À placer dans la journée'
});

// ── LA COCHE DU JOUR (build 1380) ──────────────────────────────────────
//
// nutrition.suppPrises : { 'AAAA-MM-JJ': ['<id>@<moment>', …] }. UNE CLE PAR
// PRISE, et non par produit : la whey du matin et celle du coucher se cochent
// chacune a son heure.
//
// ⚠ C'EST UNE DONNEE DE SANTE, parce que nutrition en est une — CHAMPS_SANTE
// le dit, et _sansSante la couperait sans consentement. Le geste passe donc
// par la porte : demanderConsentementSante('complement', …).
//
// BORNEE A 35 JOURS, purgee a chaque ecriture : le dossier est reecrit en
// entier a chaque sauvegarde, et un journal qui ne s'arrete jamais finirait
// par peser plus que tout le reste. Le rendu, lui, NE PURGE PAS — un rendu
// n'ecrit rien dans le dossier.
//
// Le coach ne voit pas la coche : son ecran montre le plan, pas le journal.
const SUPP_PRISES_JOURS=35;
function _suppCle(id,mid){ return String(id)+'@'+String(mid); }
// PURE. Les cles cochees un jour donne. Firebase peut rendre un tableau a
// trous sous forme d'objet : on accepte les deux.
function suppPrisesDuJour(user,iso){
  const p=user&&user.nutrition&&user.nutrition.suppPrises;
  if(!p||typeof p!=='object'||Array.isArray(p)) return [];
  const l=p[iso];
  const a=Array.isArray(l)?l:((l&&typeof l==='object')?Object.values(l):[]);
  return a.filter(x=>typeof x==='string');
}
function _suppPrisesEcrire(cles,on){
  if(!currentUser) return false;
  const n=currentUser.nutrition||(currentUser.nutrition={});
  const iso=localISODate(new Date());
  const p=(n.suppPrises&&typeof n.suppPrises==='object'&&!Array.isArray(n.suppPrises))?n.suppPrises:{};
  const l=suppPrisesDuJour(currentUser,iso);
  cles.forEach(k=>{
    const i=l.indexOf(k);
    if(on&&i<0) l.push(k);
    else if(!on&&i>=0) l.splice(i,1);
  });
  if(l.length) p[iso]=l; else delete p[iso];
  const borne=localISODate(new Date(Date.now()-SUPP_PRISES_JOURS*864e5));
  Object.keys(p).forEach(k=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||k<borne) delete p[k]; });
  if(Object.keys(p).length) n.suppPrises=p; else delete n.suppPrises;
  return saveUser();
}
// Les entrees ACTIVES d'un moment, dans le dossier. « _none » est le moment
// des produits qui n'en ont aucun de connu — le meme critere que le rendu.
function _suppEntreesDuMoment(mid){
  return _suppStore().filter(s=>{
    if(!s||s.active===false) return false;
    const mts=(s.timings||[]).filter(id=>TIMINGS_LIST.some(x=>x.id===id));
    return mid==='_none'?!mts.length:mts.indexOf(mid)>=0;
  });
}
function basculerPriseSupp(id,mid){
  if(!demanderConsentementSante('complement',()=>basculerPriseSupp(id,mid))) return false;
  const s=_suppEntreesDuMoment(mid).find(x=>String(x.id)===String(id));
  if(!s) return false;
  const k=_suppCle(s.id,mid);
  const on=suppPrisesDuJour(currentUser,localISODate(new Date())).indexOf(k)<0;
  _suppPrisesEcrire([k],on);
  _suppMajCoches();
  // WHEY ET CASÉINE, LA PREMIÈRE FOIS DU JOUR (build 1848) : la prise peut
  // rejoindre le journal, sur proposition. Jamais en diète stricte.
  if(on){ try{ _suppProposerJournal(s,mid); }catch(e){} }
  return on;
}
// ══ L'OBSERVANCE D'UN COMPLÉMENT (build 1848) ══════════════════════════════
// PURE. Sur les `n` jours qui finissent à finISO : `jours` = jours où le
// produit est actif ET où l'athlète a coché au moins une prise de quoi que ce
// soit (sinon on ne sait pas : jour exclu, jamais compté comme un oubli) ;
// `pris` = jours où CE produit porte au moins une coche.
function observanceSupp(user,suppId,finISO,n){
  const nb=Math.max(1,Math.round(Number(n)||14));
  const l=(((user&&user.nutrition)||{}).supplements)||[];
  const s=l.find(x=>x&&String(x.id)===String(suppId));
  if(!s) return {jours:0,pris:0};
  const fin=finISO||localISODate(new Date());
  const desactive=Number(s.desactiveLe)||0;
  let jours=0, pris=0;
  for(let i=0;i<nb;i++){
    const d=localISODate(_datePlusJours(_dateDeISO(fin),-i));
    if(s.active===false&&!(desactive&&d<localISODate(new Date(desactive)))) continue;
    const c=suppPrisesDuJour(user,d);
    if(!c.length) continue;
    jours++;
    if(c.some(k=>k.split('@')[0]===String(s.id))) pris++;
  }
  return {jours,pris};
}
// La régularité, en semaines pleines : jours consécutifs avec une prise de ce
// produit (les jours sans aucune coche ne cassent pas la suite), jusqu'à finISO.
function _suppRegulariteSemaines(user,s,finISO){
  const fin=finISO||localISODate(new Date());
  let suite=0;
  for(let i=0;i<SUPP_PRISES_JOURS;i++){
    const d=localISODate(_datePlusJours(_dateDeISO(fin),-i));
    const c=suppPrisesDuJour(user,d);
    if(!c.length){ continue; }
    if(c.some(k=>k.split('@')[0]===String(s.id))) suite++; else break;
  }
  return Math.floor(suite/7);
}
const SUPP_OBS_MIN_JOURS=4;
function texteObservanceSupp(user,s,finISO){
  const o=observanceSupp(user,s&&s.id,finISO,14);
  if(o.jours<SUPP_OBS_MIN_JOURS) return '';
  let t='pris '+o.pris+' j / '+o.jours;
  const f=_suppFiche(s&&s.name);
  if(f&&f.dureeAvantJugement){ const w=_suppRegulariteSemaines(user,s,finISO); t+=' · régularité : '+w+' semaine'+(w>1?'s':''); }
  return t;
}
// ── Whey et caséine : « Ajouter 30 g au journal » ──────────────────────────
const SUPP_REPAS_DU_MOMENT=Object.freeze({jeun:'matin',matin:'matin',midi:'dejeuner','apres-midi':'collation',
  soir:'diner',coucher:'coucher','avant-entrainement':'collation','apres-entrainement':'collation',intra:'collation','toutes-4h':'collation'});
const _suppProposeLe={};
function _suppAlimentDe(s){
  const f=_suppFiche(s&&s.name);
  if(!f) return null;
  if(f.nom==='Caséine') return -3;
  if(f.nom==='Whey / Protéine en poudre') return /\biso/i.test(String(s.name||''))?-2:-1;
  return null;
}
// PURE. La quantité ajoutée : la dose en g, sinon 30 g.
function _suppQteJournal(s){
  const q=_planNb(s&&s.dosage_quantity);
  return (String((s&&s.dosage_unit)||'').toLowerCase()==='g'&&q>0)?q:30;
}
function _suppProposerJournal(s,mid){
  const idAlim=_suppAlimentDe(s);
  if(idAlim==null||!currentUser) return false;
  const nut=currentUser.nutrition||{};
  try{ if(typeDiete(nut)!=='flexible') return false; }catch(e){ return false; }
  const iso=localISODate(new Date());
  const cle=iso+'|'+s.id;
  if(_suppProposeLe[cle]) return false;
  _suppProposeLe[cle]=true;
  const qty=_suppQteJournal(s);
  _suppActionToast('Ajouter '+String(qty).replace('.',',')+' g au journal ?','Ajouter',()=>suppAjouterAuJournal(s.id,mid));
  return true;
}
// ÉCRIT. Une seule entrée par produit et par jour (un double tap n'en crée
// pas deux) ; rend l'entrée, ou null.
function suppAjouterAuJournal(suppId,mid){
  const s=_suppStore().find(x=>x&&String(x.id)===String(suppId));
  if(!s) return null;
  const idAlim=_suppAlimentDe(s);
  let f=null; try{ f=(Array.isArray(_ciqualDB)?_ciqualDB.find(x=>x&&x.id===idAlim):null); }catch(e){}
  if(!f) f=SUPP_ALIM_REPLI[idAlim]||null;
  if(!f) return null;
  const iso=localISODate(new Date());
  const n=currentUser.nutrition||(currentUser.nutrition={});
  if(!n.log) n.log={};
  if(!n.log[iso]) n.log[iso]={entries:[]};
  const marque='supp:'+s.id;
  if(n.log[iso].entries.some(e=>e&&e.origine===marque)) return null;
  const qty=_suppQteJournal(s), r=qty/100;
  const entry={id:Date.now(),alim_id:f.id,nom:f.n,groupe:f.g||'',qty,repas:SUPP_REPAS_DU_MOMENT[mid]||'collation',
    kcal:Math.round((Number(f.k)||0)*r),
    p:f.p!=null?parseFloat((f.p*r).toFixed(1)):null,c:f.c!=null?parseFloat((f.c*r).toFixed(1)):null,
    l:f.l!=null?parseFloat((f.l*r).toFixed(1)):null,fi:f.f!=null?parseFloat((f.f*r).toFixed(1)):null,
    sel:f.e!=null?parseFloat((f.e*r).toFixed(2)):null,periSeance:false,origine:marque};
  try{ _poserMicros(entry,f,r); }catch(e){}
  n.log[iso].entries.push(entry);
  saveUser();
  // « Annuler » pendant 5 s : retire l'entrée par le chemin du journal.
  _suppActionToast(f.n+' '+String(qty).replace('.',',')+' g ajouté au journal','Annuler',()=>{ try{ deleteFoodEntry(iso,entry.id); }catch(e){} },5000);
  return entry;
}
// Si la base n'est pas chargée : les trois fiches locales, recopiées.
const SUPP_ALIM_REPLI=Object.freeze({
  [-1]:{id:-1,n:'Whey concentrée (protéine de lactosérum), poudre',g:'produits pour sportifs',k:390,p:76,c:8,l:6,f:0,e:0.5},
  [-2]:{id:-2,n:'Whey isolat, poudre',g:'produits pour sportifs',k:370,p:88,c:2,l:1,f:0,e:0.5},
  [-3]:{id:-3,n:'Caséine micellaire, poudre',g:'produits pour sportifs',k:355,p:78,c:6,l:1.5,f:0,e:0.6}});
// Un message avec UNE action, posé au-dessus du bas de l'écran.
function _suppActionToast(texte,lib,fn,duree){
  let z=document.getElementById('supp-action-toast');
  if(z) z.remove();
  z=document.createElement('div');
  z.id='supp-action-toast';
  z.setAttribute('role','status');
  z.style.cssText='position:fixed;left:50%;transform:translateX(-50%);bottom:96px;z-index:var(--z-modal);max-width:420px;width:calc(100% - 32px);'
    +'background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 12px;display:flex;align-items:center;gap:12px;'
    +'font-size:var(--fs-sm);color:var(--text)';
  const t=document.createElement('span'); t.style.flex='1'; t.textContent=texte;
  const b=document.createElement('button'); b.type='button'; b.className='btn btn-sm'; b.style.margin='0'; b.textContent=lib;
  b.onclick=()=>{ try{ z.remove(); }catch(e){} fn(); };
  z.appendChild(t); z.appendChild(b);
  document.body.appendChild(z);
  setTimeout(()=>{ try{ z.remove(); }catch(e){} },duree||6000);
  return z;
}
function prendreToutSupp(mid){
  if(!demanderConsentementSante('complement',()=>prendreToutSupp(mid))) return false;
  const cles=_suppEntreesDuMoment(mid).map(s=>_suppCle(s.id,mid));
  if(!cles.length) return false;
  _suppPrisesEcrire(cles,true);
  _suppMajCoches();
  return cles.length;
}
// L'ECRAN SUIT SANS ETRE REDESSINE. Redessiner fermerait un depli ouvert et
// ferait sauter la page ; on met a jour les coches et les boutons en place,
// dans les deux emplacements qui peuvent les porter (la page et la diete).
function _suppMajCoches(){
  const pris=new Set(suppPrisesDuJour(currentUser,localISODate(new Date())));
  document.querySelectorAll('[data-supp-coche]').forEach(b=>{
    b.setAttribute('aria-pressed',pris.has(b.getAttribute('data-supp-coche'))?'true':'false');
  });
  document.querySelectorAll('[data-supp-tout]').forEach(bt=>{
    const sec=bt.closest('.supp-moment');
    if(!sec) return;
    const l=Array.from(sec.querySelectorAll('[data-supp-coche]'));
    const tout=l.length>0&&l.every(b=>b.getAttribute('aria-pressed')==='true');
    bt.disabled=tout;
    _texteIco(bt,tout?ICO.coche+' Tout pris':'Tout prendre ('+l.length+')');
  });
}
function _renderSuppTable(list, isCoach, editFn){
  _suppAssurerIds(list);
  // L encart de sourcing survivait ici a la liste vide — l athlete qui n a
  // rien enregistre etant precisement celui qui n a rien achete. L encart a
  // ete retire ; la liste vide ne rend donc plus que son etat vide.
  // R13 — PAS DE BOUTON ICI, ET C'EST UNE REGLE : le geste existe deja, dans
  // le meme bloc. Cote athlete, « + AJOUTER » est l'en-tete de cette carte ;
  // cote coach, le formulaire d'ajout est juste dessous. Un second bouton
  // ferait deux boutons pour le meme geste. Le message dit ou il est.
  if(!list.length) return emptyState('pill',isCoach
      ?'Aucun complément noté pour l\'instant. Tu peux en ajouter un juste en dessous.'
      :'Aucun complément noté pour l\'instant. Ajoute le premier avec « + Ajouter », juste au-dessus.',
    null,null,'padding:28px 0');
  // Virgule francaise, et pas de decimale inutile : « 2 » et non « 2,0 ».
  const nb=v=>(Math.round(v*100)/100).toString().replace('.',',');
  // Les moments d un complement suivent la JOURNEE, jamais l ordre de saisie :
  // « avant entrainement » doit preceder « soir » a la lecture.
  const momentsDe=s=>TIMINGS_LIST.filter(t=>(s.timings||[]).includes(t.id))
    .sort((a,b)=>_rangMoment(a.id)-_rangMoment(b.id));

  // Tout ce qu'une carte doit savoir, lu une seule fois. La couleur est celle
  // du PREMIER moment : elle situe le complement dans la journee sans qu'on
  // ait a lire quoi que ce soit.
  const lu=(s,mid)=>{
    const mts=momentsDe(s);
    const q=_planNb(s.dosage_quantity);
    const prises=Math.max(1,mts.length);
    // LE MOMENT EST DESORMAIS DONNE PAR L APPELANT. La couleur et l icone
    // sont celles de CETTE prise, pas celles de la premiere du produit :
    // la whey du coucher doit etre bleue, pas jaune comme celle du matin.
    const id=mid!==undefined?mid:(mts[0]||{}).id;
    return {mts:mts, id:id,
      c:(SUPP_TIMING_META[id]||{color:'#6a6a6a'}).color,
      q:q, prises:prises, total:(q!=null&&mts.length)?q*prises:null,
      unite:s.dosage_unit||'', fiche:_suppFiche(s.name), eteint:s.active===false};
  };

  // Le dépli « à savoir ». Il ne tient pas sur la ligne de tous les jours :
  // c'est une information d'achat, pas une information de prise.
  // TOUT LE DEPLI ETAIT SUSPENDU A LA FICHE DE REFERENCE, et c'etait un defaut
  // silencieux : l'athlete qui renomme son produit — « Mon magnesium a moi » —
  // ne correspond plus a aucune fiche, et voyait disparaitre de l'ecran la
  // FORME qu'il avait lui-meme choisie. Elle etait toujours dans son dossier ;
  // seul l'affichage l'avait perdue. Or c'est precisement l'information qu'on
  // relit devant un rayon.
  //
  // Trois autres subissaient la meme suspension pour la meme mauvaise raison :
  // sa note personnelle, l'ecart entre le moment de prise et celui conseille, et
  // le rappel de duree. Aucune des quatre n'a besoin d'une fiche pour exister.
  //
  // ON ASSEMBLE DONC LE CONTENU D'ABORD, et le depli ne s'affiche que s'il a
  // quelque chose a montrer — un chevron qui n'ouvre sur rien est pire qu'un
  // chevron absent.
  const depli=(s,x,pose)=>{
    const bloc=(t,st)=>t?`<div style="font-size:var(--fs-xs);${st};margin-top:4px;white-space:normal">${escapeHtml(t)}</div>`:'';
    const corps=
      (x.fiche?`<div style="font-size:var(--fs-xs);color:#ccc;line-height:1.6;margin-top:6px;white-space:normal">${escapeHtml(x.fiche.note)}</div>`:'')
      +(x.fiche?_htmlFormesFiche(x.fiche,s.forme):'')
      +(s.forme?`<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px;font-weight:700">Forme : ${escapeHtml(_libelleForme(x.fiche,s.forme))}</div>`:'')
      +bloc(phraseDureeJugement(x.fiche),'color:var(--text-dim);line-height:1.5')
      +bloc(s.notes,'color:var(--text-dim);font-style:italic')
      +bloc(_suppEcartMoment(s),'color:var(--text-dim);line-height:1.5');
    if(!corps) return '';
    return `<details onclick="event.stopPropagation()" style="flex-shrink:0;min-width:0;${pose||''}">
      <summary style="font-size:var(--fs-sm);color:var(--sub);cursor:pointer;list-style:none;padding:0 2px">▾</summary>
      ${corps}
    </details>`;
  };

  // LA DOSE DE CETTE PRISE, en toutes lettres : « 1 comprimé », « 2 scoops »,
  // « 6 g ». L'unite « comprimé(s) » du formulaire se resout sur la quantite
  // — la maquette ecrit « 1 comprimé », pas « 1 comprimé(s) ». Les unites de
  // mesure ne prennent jamais d's : « 2 mcg », pas « 2 mcgs ».
  const dose=x=>{
    const u0=String(x.unite||'');
    const plur=x.q!=null&&Math.abs(x.q)>=2;
    let u;
    if(/\(s\)/i.test(u0)) u=u0.replace(/\(s\)/i,plur?'s':'');
    else if(/^(g|kg|mg|mcg|µg|ug|ml|cl|dl|l|ui|kcal|%)$/i.test(u0)) u=u0;
    else u=planUnitePluriel(x.q,u0);
    return x.q!=null?(nb(x.q)+(u?' '+u:'')):u;
  };

  // LA REFERENCE REJOINT LA DOSE, ENTRE PARENTHESES. Elle occupait une ligne
  // a elle, sous le couple chiffre-unite, alors qu elle ne fait que le
  // commenter : « 2 scoops » d abord, « (ref. 20 a 30 g) » ensuite, c est une
  // seule information. En incise elle se lit dans la foulee, et la carte perd
  // une ligne quand la place suffit — sinon flex-wrap la renvoie dessous, ce
  // qui vaut toujours mieux qu un texte coupe par overflow:hidden.
  // L'unite « gélule(s) » de la fiche se resout comme celle de la dose : « 1 à
  // 2 gélules », « 1 comprimé » — le « (s) » est une facon d'ecrire le
  // formulaire, pas une facon de parler.
  const reference=x=>x.fiche?`<span style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.2px">(réf. ${escapeHtml(x.fiche.dose)} ${escapeHtml(String(x.fiche.unite||'').replace(/\(s\)/i,/[2-9]|\d\d/.test(String(x.fiche.dose))?'s':''))})</span>`:'';

  // L'IDENTITÉ, ET NON LE RANG. `list.indexOf(s)` donnait la position dans la
  // liste REÇUE — filtrée sur les actifs côté athlète — pendant que
  // openSuppEdit relisait le store complet. Un inactif placé avant un actif
  // suffisait à ouvrir, puis écraser, la mauvaise entrée.
  const ouverture=s=>`onclick="${editFn}(${s.id})" role="button" tabindex="0" aria-label="${escapeHtml(s.name||'Complément')}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"`;

  // LA COCHE DU JOUR : l'athlete seul, et seulement sur un produit actif.
  // Son clic et sa touche s'arretent a elle : sans quoi la carte, qui ouvre
  // la fiche au clic comme a Entree, s'ouvrirait avec.
  const iso=localISODate(new Date());
  const pris=new Set(isCoach?[]:suppPrisesDuJour(currentUser,iso));
  const coche=(s,mid)=>{
    const k=_suppCle(s.id,mid);
    return `<button type="button" class="supp-coche" data-supp-coche="${k}" aria-pressed="${pris.has(k)?'true':'false'}" aria-label="Pris : ${escapeHtml(s.name||'Complément')}" onclick="event.stopPropagation();basculerPriseSupp(${s.id},'${mid}')" onkeydown="event.stopPropagation()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><polyline points="5 12.5 10 17.5 19 7"/></svg></button>`;
  };

  // ── LA CARTE ───────────────────────────────────────────────────────────
  // La vignette du produit, son nom et sa pastille de preuve, sa dose et sa
  // reference, sa famille et le depli « à savoir », puis la coche. La
  // pastille reste COLLEE AU NOM : c'est lui qu'elle qualifie, et la legende
  // qui l'explique est sous les panneaux.
  const carte=(s,mid)=>{
    const x=lu(s,mid);
    const ic=suppIcone(s);
    const fam=ic.fam?SUPP_FAMILLES[ic.fam]:null;
    // L'ORDRE DU BALISAGE EST CELUI DE LA LECTURE : vignette, nom, dose,
    // puis le type et la coche — la grille de la demi-carte les remonte
    // entre la vignette et la coche sans changer cet ordre.
    const tag=fam?`<span class="supp-tag" style="--tc:${fam.c}">${escapeHtml(fam.lib)}</span>`:'';
    return `<div class="supp-carte${x.eteint?' eteint':''}${isCoach?' supp-co':''}" ${ouverture(s)}><div class="supp-in">
      <span class="supp-ico" aria-hidden="true" style="background-position:${suppIconePos(ic.ico)}"></span>
      <div class="supp-txt">
        <div class="supp-nomr"><span class="supp-nom">${escapeHtml(s.name||'')}</span>${x.fiche?_suppPastille(x.fiche.preuve):''}</div>
        <div class="supp-dose"><span>${escapeHtml(dose(x))}</span>${x.fiche?reference(x):''}${depli(s,x)}</div>
        ${isCoach?(function(){ const t=(function(){ try{ return texteObservanceSupp(getOwnedClient(currentClientId),s); }catch(e){ return ''; } })();
          return t?'<div class="supp-obs" style="font-size:var(--fs-2xs);color:var(--text-faint)">'+escapeHtml(t)+'</div>':''; })():''}
      </div>${tag}${(!isCoach&&!x.eteint)?coche(s,mid):''}
    </div></div>`;
  };

  // ── LE PANNEAU D'UN MOMENT ─────────────────────────────────────────────
  // Une bande par creneau, la whey figurant sous chacun des siens : la
  // repetition EST l'information — c'est ce qu'on a devant soi au moment de
  // servir. « Tout prendre (N) » compte les produits ACTIFS du moment ; tous
  // coches, il devient « ✓ Tout pris » et se desactive — decocher se fait
  // produit par produit, jamais d'un geste qui effacerait toute une prise.
  const panneau=sec=>{
    const mc=(SUPP_TIMING_META[sec.id]||{color:'#6a6a6a'}).color;
    const actifs=sec.items.filter(e=>e.s.active!==false);
    const tous=actifs.length>0&&actifs.every(e=>pris.has(_suppCle(e.s.id,sec.id)));
    const tout=(!isCoach&&actifs.length)
      ?`<button type="button" class="supp-tout" data-supp-tout="${sec.id}" onclick="prendreToutSupp('${sec.id}')"${tous?' disabled':''}>${tous?icon('coche',14)+' Tout pris':'Tout prendre ('+actifs.length+')'}</button>`:'';
    return `<section class="supp-moment" style="--mc:${mc}" data-moment="${sec.id}">
      <div class="supp-mh">
        <span class="supp-mi" aria-hidden="true">${_suppTimingIcon(sec.id,26,mc)}</span>
        <div style="flex:1;min-width:0"><div class="supp-mt" role="heading" aria-level="3">${escapeHtml(sec.lib||'')}</div><div class="supp-ms">${escapeHtml(SUPP_MOMENT_SOUS[sec.id]||'')}</div></div>
        ${tout}
      </div>
      <div class="supp-bac"><div class="supp-grille">${sec.items.map(e=>carte(e.s,e.id)).join('')}</div></div>
    </section>`;
  };

  // UNE ENTREE PAR PRISE, ET NON PAR PRODUIT. Un complement pris trois fois
  // dans la journee produit trois entrees, une sous chaque creneau. Il ne
  // figurait auparavant que sous son PREMIER moment, ses autres prises
  // reduites a des pastilles : lire son plan du soir obligeait a parcourir
  // les cartes du matin.
  //
  // Un complement sans aucun moment donne UNE entree, dans « Moment non
  // defini » — il ne disparait pas de la liste faute de creneau.
  const entrees=[];
  list.forEach(s=>{
    const mts=momentsDe(s);
    if(!mts.length){ entrees.push({s:s,id:'_none',lib:'Moment non défini',r:999}); return; }
    mts.forEach(m=>entrees.push({s:s,id:m.id,lib:m.label,r:_rangMoment(m.id)}));
  });
  // Ordre de lecture : la journee d abord, puis l alphabet dans chaque creneau.
  entrees.sort((a,b)=>a.r-b.r
    ||String(a.s.name||'').localeCompare(String(b.s.name||''),'fr'));
  const sections=[];
  entrees.forEach(e=>{
    const der=sections[sections.length-1];
    if(!der||der.id!==e.id) sections.push({id:e.id,lib:e.lib,items:[e]});
    else der.items.push(e);
  });

  return _htmlSuppInteractions(list,(function(){ try{ return isCoach?getOwnedClient(currentClientId):currentUser; }catch(e){ return null; } })())
    +sections.map(panneau).join('')
    +_htmlSuppLegende(isCoach);
}

let _suppReturnToNutrition=false;
// La rétention du journal de caféine, nommée : elle vivait en dur dans
// addCaffeineEntry, et la borne du sélecteur de jour doit être LA MÊME —
// proposer un jour que la purge effacera serait un piège.
const CAFF_RETENTION_JOURS=180;
let _caffReturnToNutrition=false;
let _caffeineViewDate=null;  // date affichée dans l'écran standalone s-caffeine
// Meme role pour la cafeine, indexe sur l horodatage : les prises n ont pas
// d identifiant propre, mais leur ts est ecrit a la milliseconde.
let _caffTsNeuf=null;
// Le palier du rendu precedent ET sa couleur. Sert a faire PARTIR la transition :
// sans point de depart different, une transition CSS ne joue pas.
let _caffPalierPrec=null;
let _caffeineEmbedDate=null; // date affichée dans la section embarquée s-nutrition
let _pendingCaffProduct=null;

// ── LE BLOC « MES COMPLEMENTS », RENDU UNE SEULE FOIS ─────────────────────
//
// Les deux ecrans qui montrent les complements — la page dediee et la section
// de la diete — rendaient les MEMES cartes dans DEUX habillages differents :
// ici un titre h3 sur barre rouge et un bouton rouge en haut a droite, la un
// petit titre gris interlettre et un bouton pointille en bas. Mesure au
// navigateur, la meme liste rendue dans les deux conteneurs : sur 269 noeuds,
// ZERO difference de style dans les cartes elles-memes. Tout l ecart etait
// dans l habillage, et il n avait aucune raison d exister.
//
// PIRE QUE DE L INCOHERENCE : la diete n affichait pas _htmlTraitementSupp,
// l avertissement d interaction montre a qui a declare un traitement. Un
// athlete sous traitement qui consultait ses complements par la diete ne le
// voyait jamais. Ce n est pas un ecart de style, c est un avertissement absent.
//
// `avant` laisse la diete glisser ses bandeaux de cycle DANS la carte, a la
// place exacte qu ils occupaient : ils portent une information que la page
// dediee n a pas a montrer, et les perdre serait regler un probleme en en
// creant un autre.
function _htmlBlocSupplements(list,avant){
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:3px;height:20px;background:var(--red);border-radius:var(--r-1)"></div>
        <h3 class="t-section" style="margin:0">Mes compléments</h3>
      </div>
      <button class="btn btn-red btn-sm" onclick="openSuppEdit(-1)">+ Ajouter</button>
    </div>
    ${_htmlTraitementSupp(currentUser)}
    <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4);padding:14px">
      <!-- LES TRAITEMENTS SONT AILLEURS, et le lien le dit : un complement se
           conseille, un medicament ne se conseille pas. Les melanger sur le
           meme ecran ferait croire qu'ils se lisent de la meme facon. -->
      <button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:0 0 14px"
        onclick="ouvrirTraitements()">Mes traitements</button>
      <!-- CE QUE JE NE MANGE PAS. Pose ici et pas dans un reglage : une
           eviction se declare au moment ou on pense a ce qu'on mange, pas au
           moment ou on regle l'application. -->
      <button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:0 0 14px"
        onclick="go('s-evictions');renderEvictions()">Ce que je ne mange pas</button>
      ${avant||''}${_renderSuppTable(list,false,'openSuppEdit')}
    </div>`;
}
function loadSupplements(){
  go('s-supplements');
  _renderSupplements();
}
// LE TABLEAU SEUL, SANS go() — voir _repeindreComplementsAthlete.
function _renderSupplements(){
  const list=_suppStore();
  const el=document.getElementById('supp-table-content');
  if(!el) return;
  const _vrr=rcVerrou('complements');
  if(_vrr){ el.innerHTML=_vrr; return; }
  el.innerHTML=_htmlBlocSupplements(list)+'<div style="height:20px"></div>';
}

function loadSuppEmbedded(){
  const el=document.getElementById('supp-embedded');
  if(!el) return;
  const list=_suppStore().filter(s=>s.active!==false);
  const conf=_getCycleNutConf();
  const today=localISODate(new Date());
  const _phBan=_getCyclePhaseNut(today);
  const inLuteal=conf.enabled&&isFemale(currentUser.gender)
    &&phaseAgissante(_phBan)&&_phBan==='luteal_late';
  // Le bandeau ne RECOMMANDE plus rien : il rappelle ce que l'athlète a noté.
  // Sa condition suit ce changement — n'importe quelle entrée d'oméga-3 ACTIVE,
  // y compris une suggestion acceptée, et plus seulement celles qu'elle avait
  // saisies elle-même. Et il annonce la quantité RÉELLEMENT enregistrée : le
  // « +2 gélules » codé en dur mentait à qui en avait noté trois.
  const _omega=inLuteal
    ?_suppStore().find(s=>s&&s.active!==false&&/om[eé]ga/i.test(String(s.name||'')))
    :null;
  const _omQte=_omega&&_omega.dosage_quantity
    ?(String(_omega.dosage_quantity).replace('.',',')+' '+(_omega.dosage_unit||'')).trim()
    :null;
  const omegaBanner=_omQte
    ?`<div data-bandeau-cycle style="margin-bottom:10px;background:rgba(251,146,60,.07);border:1px solid rgba(251,146,60,.22);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-xs);color:#fb923c;font-weight:700">Phase lutéale : tu as noté ${escapeHtml(_omQte)} d'oméga-3 pour aujourd'hui.</div>`:'';
  el.innerHTML=_htmlBlocSupplements(list,
    _htmlMigrationCycleSupp(currentUser)+_htmlSuggestionCycle(currentUser)+omegaBanner)
    +'<div style="height:4px"></div>';
}

// `id` est un IDENTIFIANT, plus un rang. -1 reste le nouveau complément : aucun
// identifiant ne vaut -1, la sentinelle survit sans ambiguïté.
function openSuppEdit(id){
  _suppReturnToNutrition=document.getElementById('s-nutrition')?.classList.contains('active')||false;
  go('s-supplement-edit');
  const list=_suppAssurerIds(_suppStore());
  const idx=_suppIndexParId(list,id);
  const s=idx>=0?list[idx]:null;
  document.getElementById('supp-edit-title').textContent=s?'Modifier le complément':'Nouveau complément';
  // Le champ caché porte l'IDENTIFIANT, pas le rang : entre l'ouverture et
  // l'enregistrement, une synchro peut avoir réordonné la liste.
  document.getElementById('supp-edit-idx').value=s?s.id:-1;
  document.getElementById('supp-name').value=s?s.name:'';
  document.getElementById('supp-qty').value=s?(s.dosage_quantity||''):'';
  document.getElementById('supp-unit').value=s?(s.dosage_unit||'g'):'g';
  document.getElementById('supp-notes').value=s?(s.notes||''):'';
  const activeChk=document.getElementById('supp-active');
  activeChk.checked=s?s.active!==false:true;
  document.getElementById('supp-active-label').textContent=activeChk.checked?'Oui':'Non';
  activeChk.onchange=()=>{document.getElementById('supp-active-label').textContent=activeChk.checked?'Oui':'Non';};
  document.getElementById('supp-edit-delete-row').style.display=s?'block':'none';
  document.getElementById('supp-timings-err').style.display='none';
  document.getElementById('supp-caff-warning').style.display='none';
  // Remplir la datalist
  const dl=document.getElementById('supp-name-list');
  if(dl) dl.innerHTML=SUPPLEMENTS_LIST.map(f=>`<option value="${escapeHtml(f.nom)}">`).join('');
  majSelectForme(s?s.name:'', s?s.forme:'');
  // Grille timings
  const selected=s?s.timings||[]:[];
  const grid=document.getElementById('supp-timings-grid');
  if(grid) grid.innerHTML=TIMINGS_LIST.map(t=>`
    <button type="button" class="supp-timing-chip${selected.includes(t.id)?' active':''}"
      onclick="toggleSuppTimingChip(this,'${t.id}')">${t.label}</button>`).join('');
}

// Le sélecteur de forme suit le nom saisi. Un produit sans formes[] — ou un
// complément maison tapé à la main — n'en affiche aucun : la fiche se comporte
// alors exactement comme avant ce lot.
// La forme DÉJÀ retenue est conservée même quand elle ne figure plus dans la
// liste du produit (produit renommé, fiche qui a changé) : elle réapparaît en
// tête, telle quelle. Perdre en silence ce que l'athlète avait choisi serait
// pire que de garder une clé qu'on ne sait plus traduire.
function majSelectForme(nom,formeRetenue){
  const grp=document.getElementById('supp-forme-group');
  const sel=document.getElementById('supp-forme');
  if(!grp||!sel) return;
  const courante=formeRetenue!==undefined?(formeRetenue||''):(sel.value||'');
  const fiche=_suppFiche(nom);
  const formes=(fiche&&fiche.formes)||[];
  if(!formes.length&&!courante){
    grp.style.display='none'; sel.innerHTML=''; majNoteForme(); return;
  }
  const opts=[`<option value="">Non précisée</option>`];
  if(courante&&!formes.some(f=>f.cle===courante))
    opts.push(`<option value="${escapeHtml(courante)}">${escapeHtml(courante)}</option>`);
  formes.forEach(f=>opts.push(`<option value="${escapeHtml(f.cle)}">${escapeHtml(f.lib)}</option>`));
  sel.innerHTML=opts.join('');
  sel.value=courante;
  grp.style.display='block';
  majNoteForme();
}
// La phrase de la forme choisie, sous le sélecteur. C'est l'information utile
// au moment d'acheter, et elle n'a de sens qu'une fois la forme choisie.
function majNoteForme(){
  const sel=document.getElementById('supp-forme');
  const el=document.getElementById('supp-forme-note');
  if(!el) return;
  const fiche=_suppFiche((document.getElementById('supp-name')||{}).value||'');
  const f=((fiche&&fiche.formes)||[]).find(x=>x.cle===(sel?sel.value:''));
  el.textContent=f?f.note:'';
}
function checkSuppCaffeineRedirect(val){
  const w=document.getElementById('supp-caff-warning');
  if(!w) return;
  w.style.display=/caf[eé]/i.test(val)?'block':'none';
}

function toggleSuppTimingChip(btn,id){
  btn.classList.toggle('active');
  document.getElementById('supp-timings-err').style.display='none';
}

function validateSuppFields(name,qty,timings){
  if(!name) return {field:'name',msg:'Saisis un nom'};
  if(!qty||parseFloat(qty)<=0) return {field:'qty',msg:'Saisis un dosage'};
  if(!timings.length) return {field:'timings',msg:'Sélectionne au moins un moment'};
  return null;
}

function saveSuppEntry(){
  const name=(document.getElementById('supp-name').value||'').trim();
  const qty=document.getElementById('supp-qty').value;
  const unit=document.getElementById('supp-unit').value;
  const notes=(document.getElementById('supp-notes').value||'').trim();
  const active=document.getElementById('supp-active').checked;
  const _id=parseInt(document.getElementById('supp-edit-idx').value);
  const timings=Array.from(document.querySelectorAll('#supp-timings-grid .supp-timing-chip.active')).map(b=>{
    const txt=b.textContent.trim();
    return (TIMINGS_LIST.find(t=>t.label===txt)||{id:txt}).id;
  });
  const err=validateSuppFields(name,qty,timings);
  if(err){
    toast(err.msg,'var(--orange)');
    if(err.field==='name') document.getElementById('supp-name').focus();
    else if(err.field==='qty') document.getElementById('supp-qty').focus();
    else document.getElementById('supp-timings-err').style.display='block';
    return;
  }
  const entry={id:Date.now(),name,dosage_quantity:parseFloat(qty),dosage_unit:unit,timings,notes,active};
  // Champ optionnel : ABSENT par défaut, jamais posé à vide. Un dossier qui
  // n'a jamais choisi de forme ne porte pas la clé.
  const forme=((document.getElementById('supp-forme')||{}).value||'').trim();
  if(forme) entry.forme=forme;
  const list=_suppStore();
  // Résolu MAINTENANT, sur la liste telle qu'elle est à l'enregistrement.
  const idx=_suppIndexParId(list,_id);
  if(idx>=0){
    const maj={...list[idx],...entry,id:list[idx].id};
    // Revenir à « Non précisée » doit EFFACER : le spread, seul, aurait
    // reconduit l'ancienne forme indéfiniment.
    if(!forme) delete maj.forme;
    list[idx]=maj;
  }
  else{list.push(entry);}
  const ok=saveUser();
  if(currentUser._notifEnabled) scheduleSuppNotif();
  toastEcriture(ok,idx>=0?'Complément mis à jour '+ICO.coche:'Complément ajouté '+ICO.coche,'le complément est');
  _suppReturnToNutrition?loadNutrition():loadSupplements();
}

function deleteSuppEntry(id){
  const list=_suppStore();
  const idx=_suppIndexParId(list,id);
  if(idx<0) return;
  list.splice(idx,1);
  saveUser();
  if(currentUser._notifEnabled) scheduleSuppNotif();
  toast('Complément supprimé');
  _suppReturnToNutrition?loadNutrition():loadSupplements();
}

// ══════════════ LES EVICTIONS, COTE COACH ══════════════════════════════
//
// ⚠ LE COACH LES LIT, IL NE LES DECLARE PAS. Une allergie est une donnee de
// sante que l'athlete seul peut affirmer ; la saisir a sa place, c'est
// engager sa securite sur une conversation mal entendue. Aucun bouton
// d'ajout ici — contrairement aux traitements, ou le coach a une prise
// legitime sur ce qu'il prescrit.
//
// ⚠ ET « CHOIX » Y EST MONTRE. C'est le seul endroit ou il l'est : le coach
// compose des repas, il doit savoir ce que son athlete ne mangera pas, sans
// quoi il proposera du porc a quelqu'un qui n'en mange pas et le plan sera
// abandonne sans un mot. Ce que la regle interdit, c'est de COMMENTER ce
// niveau dans le produit de l'athlete — pas de le cacher a celui qui cuisine.
function _htmlEvictionsCoach(c){
  if(!c) return '';
  let l=[];
  try{ l=evictions(c); }catch(e){ l=[]; }
  const LIB={allergie:'Allergie',intolerance:'Intolérance',choix:'Choix'};
  const COUL={allergie:'var(--red-text)',intolerance:'var(--orange)',choix:'var(--sub)'};
  const conflits=(function(){ try{ return planConflitsEviction(c); }catch(e){ return []; } })();
  return '<div style="background:var(--dark);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:16px;margin-bottom:20px">'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;'
    +'font-weight:700;text-transform:uppercase;margin-bottom:6px">Ce qu’il ne mange pas</div>'
    +(l.length
      ? l.map(e=>'<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
          +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.5">'
          +escapeHtml(e.libelle)
          +' <span style="color:'+COUL[e.niveau]+';font-size:var(--fs-2xs)">· '
          +escapeHtml(LIB[e.niveau])+'</span></div>'
          +'<div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:2px">'
          +escapeHtml(e.cible.type+' « '+e.cible.valeur+' »'
            +(e.note?' : '+e.note:''))+'</div></div>').join('')
      : '<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;'
        +'padding:4px 0">Aucune éviction déclarée. Lui seul peut les déclarer, '
        +'depuis son application.</div>')
    // ── CHEMIN 5 : CE QUE LE PLAN EXISTANT CONTIENT DEJA ────────────────
    //
    // ⚠ ON SIGNALE, ON NE RETIRE PAS. Le coach a peut-etre une raison — une
    // eviction declaree apres coup, un aliment homonyme, une reintroduction
    // convenue de vive voix. Une suppression silencieuse dans un plan est pire
    // que l'erreur : elle laisse un repas incomplet que personne ne sait lire.
    +(conflits.length
      ? '<div style="margin-top:12px;padding:12px 12px;background:var(--warning-bg);'
        +'border:1px solid var(--warning-border);border-radius:var(--r-2)">'
        +'<div style="font-size:var(--fs-xs);color:var(--text);line-height:1.6;font-weight:600">'
        +escapeHtml('Son plan contient '+conflits.length+' ligne'
          +(conflits.length>1?'s':'')+' qui correspond'+(conflits.length>1?'ent':'')
          +' à une éviction.')+'</div>'
        +conflits.slice(0,8).map(x=>'<div style="font-size:var(--fs-2xs);color:var(--text-dim);'
          +'line-height:1.55;margin-top:4px">· '+escapeHtml(x.libelle+' : '
          +x.eviction.libelle+' ('+x.eviction.raison+')')+'</div>').join('')
        +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;'
        +'margin-top:8px">RepCore ne retire rien du plan : à toi de trancher.</div></div>'
      : '')
    +'</div>';
}
// PURE. LES LIGNES DU PLAN QUI TOMBENT SOUS UNE EVICTION.
//
// Elle balaie le squelette et les catalogues — c'est-a-dire tout ce que le
// coach a pose, et donc tout ce qui peut arriver dans l'assiette.
function planConflitsEviction(c){
  const u=_dossier(c);
  const p=(u&&u.nutrition&&u.nutrition.plan)||null;
  if(!p||!evictions(u).length) return [];
  const vus={}, out=[];
  const voir=(lib,id)=>{
    const l=String(lib||'').trim();
    if(!l) return;
    const cle=l+'|'+String(id==null?'':id);
    if(vus[cle]) return;
    vus[cle]=true;
    const ev=evictionDe(u,{lib:l,id:id,g:''});
    if(ev) out.push({libelle:l,eviction:ev});
  };
  try{ for(const r of _tabBloc(planSquelette(p))) voir(r&&(r.lib||r.nom),r&&r.alim_id); }catch(e){}
  for(const m of ['p','c','l']){
    try{ for(const r of _tabBloc(planCatalogue(p,m))) voir(r&&(r.lib||r.nom),r&&r.alim_id); }catch(e){}
  }
  return out;
}
function renderCoachEvictionsSection(c){
  const el=document.getElementById('ccd-evictions');
  if(!el||!c) return false;
  try{ el.innerHTML=_htmlEvictionsCoach(c); }catch(e){ el.innerHTML=''; }
  return true;
}
// ⚠ RENDUE MEME VIDE, contrairement aux micro-signaux : c'est la seule porte
// par laquelle un coach peut saisir un traitement, et une porte qui n'apparait
// que lorsqu'il y a deja quelque chose derriere n'est pas une porte. La
// section est repliee par defaut, ce qui lui coute une ligne et pas un ecran.
/**
 * La section Amplitudes de la fiche coach : ce qui a été relevé, quand, et
 * l'entrée vers l'écran de relevé. C'est ici qu'un test se saisit — le bloc
 * « Proportions » des Signaux faibles, lui, ne fait que lire.
 */
