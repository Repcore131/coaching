// ══════ B2.6 — LES RACCOURCIS SE VOIENT ════════════════════════════════
//
// Quatre raccourcis existaient, annonces dans un attribut title= : une
// infobulle qui n'apparait qu'apres une seconde de survol, SUR LE BOUTON QU'ON
// S'APPRETAIT DEJA A CLIQUER. Le gain de decouverte etait nul — on n'apprend
// pas un raccourci en survolant ce qu'on allait faire a la souris.
//
// CONSTRUIT DEPUIS LA TABLE, jamais recopie : une liste ecrite a la main
// mentirait au premier ajout, et c'est exactement ce que la fiche interdit.
// Filtre sur l'ecran actif, parce qu'annoncer « P publier » sur l'accueil
// apprendrait une touche qui n'y fait rien.
//
// LES GARDES SONT CELLES DU GESTIONNAIRE, et elles ne sont pas dupliquees :
// c'est raccourciCoach qui recoit la touche, donc _rcSaisieActive et
// _rcModaleOuverte s'appliquent avant meme qu'on arrive ici. Une touche tapee
// dans un champ n'ouvre rien.
const AIDE_RC_ID='rc-aide-raccourcis';
function ouvrirAideRaccourcis(){
  try{
    fermerAideRaccourcis();
    const ecran=_rcEcranActif();
    const l=raccourcisDeLEcran(ecran);
    const n=document.createElement('div');
    n.id=AIDE_RC_ID;
    n.setAttribute('role','dialog');
    n.setAttribute('aria-label','Raccourcis clavier');
    n.style.cssText='position:fixed;inset:0;z-index:var(--z-modal);background:var(--scrim);'
      +'display:flex;align-items:center;justify-content:center;padding:20px';
    n.innerHTML='<div style="background:var(--surface-2);border:1px solid var(--border);'
      +'border-radius:var(--r-4);padding:20px 20px;max-width:340px;width:100%">'
      +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;'
      +'text-transform:uppercase;color:var(--sub);margin-bottom:12px">Raccourcis clavier</div>'
      +(l.length?l.map(r=>'<div style="display:flex;align-items:baseline;gap:12px;'
        +'justify-content:space-between;margin-bottom:8px">'
        +'<span style="font-size:var(--fs-xs);color:var(--text-strong)">'+escapeHtml(r.dit)+'</span>'
        +'<kbd style="font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;'
        +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-1);'
        +'padding:4px 8px;color:var(--text);white-space:nowrap">'
        +escapeHtml(r.touche.toUpperCase())+'</kbd></div>').join('')
        :'<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.55">'
         +'Aucun raccourci sur cet écran.</div>')
      +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:12px;'
      +'line-height:1.5">Échap pour fermer.</div></div>';
    // FERME AU CLIC N'IMPORTE OU : c'est un panneau de lecture, il n'y a rien
    // a y valider.
    n.addEventListener('click',fermerAideRaccourcis);
    document.body.appendChild(n);
  }catch(e){}
}
function fermerAideRaccourcis(){
  try{ const n=document.getElementById(AIDE_RC_ID); if(n) n.remove(); }catch(e){}
}
// ECHAP FERME, et sans passer par raccourciCoach : ce panneau EST une modale,
// et le gestionnaire refuse de repondre quand une modale est ouverte.
try{
  document.addEventListener('keydown',ev=>{
    if(ev&&ev.key==='Escape'&&document.getElementById(AIDE_RC_ID)) fermerAideRaccourcis();
  });
}catch(e){}
// ANNONCE DANS L'INTERFACE. Un raccourci que rien ne dit n'existe pas : le
// titre du bouton le porte, la ou l'oeil le cherche deja.
// GARDE, ET NON REMPLACE : l'infobulle sert celui qui a deja la souris sur le
// bouton, le panneau sert celui qui ne sait pas encore qu'il y a des touches.
function _rcAnnoncerRaccourcis(){
  for(const r of RACCOURCIS_COACH){
    if(!r.bouton) continue;
    const b=document.getElementById(r.bouton);
    if(!b) continue;
    const av=b.getAttribute('title')||'';
    if(av.indexOf('('+r.touche.toUpperCase()+')')>=0) continue;
    b.setAttribute('title',(av?av+' ':r.dit+' ')+'('+r.touche.toUpperCase()+')');
  }
  const c=document.getElementById('ch-search');
  if(c&&(c.getAttribute('title')||'').indexOf('/')<0)
    c.setAttribute('title','Rechercher un athlète (touche /)');
  // B2.13 — CHAQUE DESTINATION PORTE SA FORME. Les neuf boutons reservaient
  // deja la place — display:flex;align-items:center;gap:10px — pour un
  // pictogramme qui n'avait jamais ete pose : neuf mots en capitales, meme
  // graisse, meme taille, que le coach relisait a chaque fois.
  //
  // LE JEU EXISTANT, jamais un second : icon() rend les cinquante-deux formes
  // deja utilisees partout ailleurs dans la zone coach. Aucun emoji — ils ne
  // suivent ni la couleur du texte ni son etat.
  //
  // POSE ICI ET NON DANS LE GABARIT parce qu'icon() est une fonction JS et que
  // cette barre est du balisage statique. Une seule fois : le test `firstChild`
  // empeche le doublon si l'annonce est rejouee.
  try{
    document.querySelectorAll('#ch-sidebar .sb-lien[data-icone]').forEach(b=>{
      if(b.querySelector('svg')) return;
      const s=icon(b.dataset.icone,16);
      if(!s) return;
      // flex:none : sans lui, le picto se comprime quand le libelle est long,
      // et « DECHARGE GROUPEE » l'ecrasait a quelques pixels.
      b.insertAdjacentHTML('afterbegin','<span style="flex:none;display:flex;opacity:.7">'+s+'</span>');
    });
  }catch(e){}
  // B2.6 — ET LA BARRE LATERALE PORTE LA PORTE D'ENTREE, en toutes lettres :
  // c'est le seul endroit visible sur tous les ecrans coach, et une touche
  // qu'aucun texte ne nomme reste aussi introuvable qu'avant.
  try{
    const sb=document.getElementById('ch-sidebar');
    if(sb&&!document.getElementById('rc-aide-lien')){
      const b=document.createElement('button');
      b.id='rc-aide-lien';
      b.type='button';
      b.className='sb-lien';
      b.style.cssText='margin-top:auto;font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:1.5px';
      b.textContent='? RACCOURCIS';
      b.onclick=ouvrirAideRaccourcis;
      sb.appendChild(b);
    }
  }catch(e){}
}
try{
  document.addEventListener('keydown',raccourciCoach);
  // Le document peut deja etre pret quand ce script s'execute : l'evenement ne
  // se rejouerait alors jamais, et les titres resteraient muets.
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',_rcAnnoncerRaccourcis);
  else setTimeout(_rcAnnoncerRaccourcis,0);
}catch(e){}
function _htmlBoutonDecharge(c){
  const actifs=((c&&c.sessions_config)||[]).filter(x=>x&&x.active);
  if(!actifs.length) return '';
  const dejaTout=actifs.every(x=>x.deload);
  const enDecharge=actifs.some(x=>x.deload);
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    ${dejaTout?`<div style="font-size:var(--fs-xs);color:var(--info);line-height:1.6;margin-bottom:8px">Semaine de décharge programmée sur les ${actifs.length} créneaux actifs. Les séances de décharge sortent de la détection de plateau. À toi de la retirer quand elle est passée.</div>`:''}
    <!-- N4.3 : LE RETRAIT EST A COTE DE LA POSE. Il n avait qu un seul point
         d ecriture dans tout le fichier : la case a cocher d un creneau, dans
         l editeur de seances. Sept clics par athlete pour defaire un geste qui
         en coutait un. -->
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${dejaTout?'':`<button class="btn btn-outline btn-sm" onclick="programmerDecharge()" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)">Programmer une semaine de décharge</button>`}
      ${enDecharge?`<button class="btn btn-outline btn-sm" onclick="programmerDecharge(false)" style="margin:0;letter-spacing:1px;font-size:var(--fs-2xs)">Retirer la décharge</button>`:''}
    </div>
  </div>`;
}
// ══════════════ DÉCHARGE GROUPÉE ══════════════
// Même geste que programmerDecharge, sur plusieurs athlètes. Rien n'est
// implicite : aucune case n'est cochée au départ, le récapitulatif nomme les
// athlètes touchés, et le rapport final NOMME chaque échec. Un athlète qu'on
// croit traité et qui ne l'est pas, c'est une semaine d'entraînement fausse.
const _DECHARGE_LOT_MAX=40;
function _nomAthlete(a){
  const n=((a&&a.fname)||'')+' '+((a&&a.lname)||'');
  return n.trim()||((a&&a.email)||'Athlète sans nom');
}
// Phase LOCALE, synchrone et testable : qui peut être traité, qui ne peut pas
// et pourquoi. Ne touche ni au stockage ni au réseau, et ne modifie rien.
// N4.3 — LE RETRAIT EMPRUNTE LE MEME CHEMIN QUE LA POSE. Poser une decharge
// se faisait d'un clic, sur un athlete ou sur un lot. La RETIRER n'avait qu'un
// seul point d'ecriture dans tout le fichier : la case a cocher d'un creneau,
// dans l'editeur de seances — sept clics par athlete, cent cinq pour quinze.
// `pose` distingue les deux gestes ; tout le reste est partage, pour qu'il n'y
// ait jamais deux mecanismes de decharge a tenir d'accord.
function _preparerDechargeGroupee(ids,users,pose){
  const _p=(pose!==false);
  const cibles=[], echecs=[];
  const tous=users||{};
  for(const id of (ids||[])){
    const c=Object.values(tous).find(u=>u&&u.id===id&&u.coachId===(currentUser&&currentUser.id));
    if(!c){ echecs.push({nom:String(id),raison:'élève introuvable ou non autorisé'}); continue; }
    // Un élève créé par code n'a pas encore de dossier : programmerDecharge le
    // refuse déjà un par un, on le refuse ici AVEC son nom.
    if(c._fromCode||!c.email){
      echecs.push({nom:_nomAthlete(c),raison:'dossier non synchronisé'}); continue; }
    // ON N'ECRIT RIEN SUR UN CRENEAU INACTIF, dans les deux sens. Au retrait,
    // on ne vise que ceux qui portent EFFECTIVEMENT une decharge : un athlete
    // qui n'en a pas est un echec nomme, pas une ecriture silencieuse.
    const vises=((c.sessions_config)||[]).map((x,i)=>({x,i}))
      .filter(o=>o.x&&o.x.active&&(_p?!o.x.deload:!!o.x.deload));
    if(!vises.length){ echecs.push({nom:_nomAthlete(c),
      raison:_p?'aucun créneau actif à charger':'aucune décharge à retirer'}); continue; }
    cibles.push({c,nom:_nomAthlete(c),n:vises.length,index:vises.map(o=>o.i)});
  }
  return {cibles,echecs};
}
// Écriture, athlète par athlète, par le chemin de programmerDecharge : carte
// users + DB.set + CLOUD.pushOne. Un envoi refusé n'arrête pas les suivants et
// ne perd pas l'écriture locale — il est simplement rapporté.
async function appliquerDechargeGroupee(ids,pose){
  const _p=(pose!==false);
  const users=DB.get('users')||{};
  const {cibles,echecs}=_preparerDechargeGroupee(ids,users,_p);
  const faits=[];
  for(const cible of cibles){
    cible.index.forEach(i=>{ cible.c.sessions_config[i].deload=_p; });
    cible.c.updatedAt=Date.now();
    users[cible.c.email]=cible.c;
    const localOk=DB.set('users',users);
    if(!localOk){ echecs.push({nom:cible.nom,raison:'écriture locale refusée'}); continue; }
    try{ await CLOUD.pushOne(cible.c.email,cible.c); faits.push(cible.nom); }
    catch(e){ echecs.push({nom:cible.nom,raison:'envoi refusé'}); }
  }
  // Les caches se purgent une fois le lot passé : ils sont globaux, les vider
  // à chaque athlète ne ferait que répéter le même travail.
  _viderCachePlateau();
  _viderCacheSignaux();
  return {faits,echecs,total:(ids||[]).length,pose:_p};
}
// « Décharge appliquée à 6 athlètes sur 8. Échec pour Untel (dossier non
// synchronisé) et Unetelle (envoi refusé). » Aucun échec silencieux.
function _rapportDecharge(r){
  const n=r.faits.length;
  let s=(r.pose===false?'Décharge retirée chez ':'Décharge appliquée à ')
    +n+' athlète'+(n>1?'s':'')+' sur '+r.total+'.';
  if(r.echecs.length){
    const l=r.echecs.map(e=>e.nom+' ('+e.raison+')');
    const dernier=l.pop();
    s+=' Échec pour '+(l.length?l.join(', ')+' et '+dernier:dernier)+'.';
  }
  return s;
}

// ── Écran de sélection ──────────────────────────────────────────────────────
function openDechargeGroupee(){
  go('s-coach-decharge');
  loadDechargeAthletes();
}
function loadDechargeAthletes(){
  const users=DB.get('users')||{};
  // N4.13 — meme predicat que la liste, pour la meme raison.
  const athletes=Object.values(users).filter(u=>_estMonAthlete(u,currentUser));
  const el=document.getElementById('cdg-athletes');
  if(!el) return;
  if(!athletes.length){
    el.innerHTML='<div style="text-align:center;padding:24px;color:var(--sub);font-size:var(--fs-sm)">Aucun athlète lié à ton compte.</div>';
    _cdgMajBouton(); return;
  }
  // LES SUIVIS SEULEMENT. Une decharge groupee est un geste d'accompagnement :
  // la proposer sur quelqu'un qu'on ne suit pas allonge la liste sans jamais
  // servir. Demande de Kevin, 11/09/2026. Le repli garde TOUT LE MONDE quand
  // personne n'est suivi — une liste vide serait un ecran mort, pas un filtre.
  const _suivis=athletes.filter(estSuivi);
  const _liste=_suivis.length?_suivis:athletes;
  const _caches=athletes.length-_liste.length;
  el.innerHTML=_htmlCocherEtiquette('cdg-athletes')+(_caches?'<div style="padding:10px 10px;font-size:var(--fs-2xs);color:var(--text-faint);'
      +'border-bottom:1px solid var(--border);line-height:1.5">'+_caches+' athlète'+(_caches>1?'s':'')
      +' sans suivi ne sont pas listés ici.</div>':'')
    +_liste.map(a=>{
    const n=((a.sessions_config)||[]).filter(s=>s&&s.active).length;
    // Un athlète qui ne peut pas être traité reste VISIBLE et cochable : c'est
    // le récapitulatif qui dira pourquoi. Le masquer ferait croire au coach
    // qu'il n'existe pas.
    const empeche=(!a.email?'dossier non synchronisé':(!n?'aucun créneau actif':''));
    return `<div style="display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--border);padding:12px 10px;border-left:3px solid ${ETAT_FILET[etatAthlete(a)]||'#666666'};border-radius:0 8px 8px 0;background:linear-gradient(168deg,var(--surface-1),var(--surface-0));margin-bottom:6px">
      <div class="avatar" style="width:32px;height:32px;font-size:12px;flex-shrink:0">${escapeHtml(ini(a.fname,a.lname))}</div>
      <input type="checkbox" id="cdg-cb-${escapeHtml(a.id)}" value="${escapeHtml(a.id)}" onchange="_cdgMajBouton()" style="width:18px;height:18px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      <label for="cdg-cb-${escapeHtml(a.id)}" style="flex:1;cursor:pointer;min-width:0">
        <div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml(_nomAthlete(a))}</div>
        ${empeche?'':_cdgMotifs(a)}
        <div class="sub" style="font-size:var(--fs-xs);color:${empeche?'var(--orange)':'var(--sub)'}">${empeche?escapeHtml(empeche):(n+' créneau'+(n>1?'x':'')+' actif'+(n>1?'s':''))}</div>
      </label>
    </div>`;
  }).join('');
  _cdgMajBouton();
}
// N6.14 — LES MOTIFS D'UN ATHLETE, EN UNE LIGNE.
// RIEN DU TOUT quand scoreFatigue n'est pas exploitable : une absence de motif
// n'est pas un motif vide, et le module s'interdit deja toute proposition
// muette. Le coach voit alors la ligne sans commentaire, ce qui est
// l'information juste — on ne sait pas.
// BORNEE A TROIS : a vingt athletes, la page deviendrait un mur de texte. Les
// motifs arrivent deja par poids decroissant.
const CDG_MOTIFS_MAX=3;
function _cdgMotifs(a){
  let r=null;
  try{ r=scoreFatigue(a); }catch(e){ r=null; }
  if(!r||!r.exploitable||!(r.motifs||[]).length) return '';
  const l=r.motifs.slice(0,CDG_MOTIFS_MAX).map(m=>{
    const v=(m.valeur==null||m.valeur==='')?'':(' '+m.valeur+(m.unite||''));
    return escapeHtml(String(m.libelle||'')+v);
  }).filter(Boolean);
  if(!l.length) return '';
  const reste=r.motifs.length-l.length;
  return '<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.45;margin-top:2px">'
    +l.join(' · ')+(reste>0?' · +'+reste:'')+'</div>';
}
function _cdgCoches(){
  return [...document.querySelectorAll('#cdg-athletes input[type=checkbox]:checked')]
    .map(cb=>cb.value);
}
// Le bouton ne s'allume qu'à partir d'un athlète coché : appliquer une décharge
// à personne n'est pas une action, c'est une erreur silencieuse.
function _cdgMajBouton(){
  const b=document.getElementById('cdg-appliquer');
  if(!b) return;
  const n=_cdgCoches().length;
  b.disabled=!n;
  b.style.background=n?'var(--red)':'#222';
  b.style.color=n?'var(--text)':'var(--text-dim)';
  b.style.cursor=n?'pointer':'not-allowed';
  // Le bouton de RETRAIT suit la meme selection. Discret : il defait, il ne
  // doit pas se cliquer a la place de la pose.
  const r=document.getElementById('cdg-retirer');
  if(r){
    r.disabled=!n;
    r.style.color=n?'var(--sub)':'var(--text-dim)';
    r.style.cursor=n?'pointer':'not-allowed';
  }
}
function cdgSelectAll(v){
  document.querySelectorAll('#cdg-athletes input[type=checkbox]').forEach(cb=>{cb.checked=v;});
  _cdgMajBouton();
}
// Récapitulatif NOMMÉ avant d'écrire : le coach voit qui est touché, sur
// combien de créneaux, et qui ne le sera pas.
async function confirmDechargeGroupee(pose){
  const _p=(pose!==false);
  const ids=_cdgCoches();
  if(!ids.length) return;
  const users=DB.get('users')||{};
  const prep=_preparerDechargeGroupee(ids,users,_p);
  const nl=String.fromCharCode(10);
  let txt=(_p?'Programmer une semaine de décharge ?':'Retirer la semaine de décharge ?')+nl+nl;
  txt+=prep.cibles.length
    ?prep.cibles.map(x=>'· '+x.nom+' : '+x.n+' créneau'+(x.n>1?'x':'')).join(nl)
    :'Aucun athlète traitable dans cette sélection.';
  if(prep.echecs.length) txt+=nl+nl+'Ne seront PAS traités :'+nl
    +prep.echecs.map(e=>'· '+e.nom+' ('+e.raison+')').join(nl);
  if(!prep.cibles.length){ await rcAlerte(txt); return; }
  if(!await rcConfirm(txt,null,'Confirmer')) return;
  const r=await appliquerDechargeGroupee(ids,_p);
  loadDechargeAthletes();
  // Une liste d'échecs ne se lit pas en deux secondes de toast.
  // Une liste d’échecs ne se lit pas en deux secondes de toast, et l’écran
  // vient d’être redessiné : on attend que le rapport soit lu.
  if(r.echecs.length) await rcAlerte(_rapportDecharge(r)); else toast(_rapportDecharge(r));
}

async function programmerDecharge(pose){
  const _p=(pose!==false);
  // Ecriture par la carte des utilisateurs, comme toute autre modification
  // depuis la fiche athlete : _coachEditClient est une copie profonde reservee
  // a l'editeur de seances et n'est pas forcement renseigne ici.
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(!c.email){ toast('Cet élève n\'a pas encore de dossier synchronisé','var(--orange)'); return; }
  // On ne vise que les creneaux CONCERNES : ceux a charger a la pose, ceux qui
  // portent deja une decharge au retrait. Rien n'est ecrit sur un creneau
  // inactif, ni dans un sens ni dans l'autre.
  const actifs=((c.sessions_config)||[]).map((x,i)=>({x,i}))
    .filter(o=>o.x&&o.x.active&&(_p?!o.x.deload:!!o.x.deload));
  if(!actifs.length){ toast(_p?'Aucun créneau actif':'Aucune décharge à retirer','var(--orange)'); return; }
  if(!await rcConfirm((_p?'Programmer une semaine de décharge ?':'Retirer la semaine de décharge ?')
    +String.fromCharCode(10)+String.fromCharCode(10)
    +(_p?('Les '+actifs.length+' séances actives seront marquées « décharge » et sortiront de la détection de plateau.'
        +String.fromCharCode(10)+'Aucun décochage automatique : c\'est toi qui la retires ensuite.')
       :('Les '+actifs.length+' séances en décharge repassent en séances normales et rentrent à nouveau dans la détection de plateau.')),
    null,_p?'Programmer':'Retirer')) return;
  actifs.forEach(o=>{ c.sessions_config[o.i].deload=_p; });
  // HORODATÉ. Sans ça, _mergeUser n'applique pas le dossier distant sur
  // l'appareil de l'athlète, et son envoi suivant écrase la décharge. C'était
  // la seule écriture coach→athlète du fichier à l’omettre.
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  _viderCachePlateau();
  _viderCacheSignaux();
  try{ renderVolumeCoach(getOwnedClient(currentClientId)); }catch(e){}
  toastSync(ok,envoi,(_p?'Décharge programmée sur ':'Décharge retirée sur ')+actifs.length+' séances','la décharge est');
}

// ── Volume PRESCRIT : ce que le programme impose, avant publication ─────────
// Σ séries × poids de rôle × poids d'intensité, sur les créneaux actifs.
//
// B3.8 — CE COMMENTAIRE AFFIRMAIT LE CONTRAIRE, et il avait raison quand il a
// été écrit : « le RIR n'est pas prescrit, il est constaté ». Depuis, l'éditeur
// d'exercices porte un sélecteur de RIR cible, sur le MÊME écran que ce
// chiffre. Le coach lisait donc, sous le champ où il venait d'écrire « RIR 2 »,
// une phrase lui disant que l'intensité n'était pas prescrite — et le calcul
// lui donnait raison, en pondérant chaque série comme si aucune consigne
// n'existait.
//
// UNE ABSENCE DE CONSIGNE N'EST PAS UNE CONSIGNE. Sans RIR prescrit, la série
// pèse POIDS_RIR_ABSENT — soit 1, exactement comme avant : un programme sans
// aucune consigne rend les MÊMES chiffres qu'hier, au dixième près. C'est ce
// qui permet de ne pas toucher aux repères auxquels ce volume est comparé.
//
// Avec une consigne, c'est poidsIntensite qui tranche — LA MÊME table que le
// volume réalisé, jamais une seconde : deux pondérations pour une même notion
// finiraient par ne plus dire la même chose du même programme.
// ══════════════ RECORDS, TONNAGE, RIR MOYEN, PRESCRIT / RÉALISÉ ══════════════
// Quatre indicateurs entièrement DÉRIVÉS. Aucun champ n'est ajouté au dossier :
// tout se recalcule à la lecture, avec le cache de la détection de plateau —
// déjà purgé à l'enregistrement d'une séance.
//
// Les garde-fous sont ceux de la détection de plateau, RÉUTILISÉS et non
// réécrits : perfExercice pour le score d'une séance, _marquerAberrations pour
// la saisie fautive, sansRirDominant pour l'e1RM, et l'exclusion des décharges.
// Une différence assumée : la série est assemblée sur TOUTES les séances, sans
// filtre de créneau. Un record est un record — le filtre par créneau de
// _serieExercice sert à juger un plateau, pas à tenir un palmarès.

// Nom réellement présent dans une séance pour cet exercice, alias compris.
// _dataDeSeance ferait le travail, mais il résout contre le currentUser GLOBAL :
// sur la fiche coach, les records d'un athlète se résoudraient alors contre la
// table d'alias DU COACH. Ici l'utilisateur est explicite.
function _nomDansSeance(sess,nomEx,user){
  if(!sess||!sess.data) return null;
  if(sess.data[nomEx]) return nomEx;
  const cible=_aliasPour(exKey(nomEx),user);
  if(!cible) return null;
  for(const k in sess.data) if(_aliasPour(exKey(k),user)===cible) return k;
  return null;
}
// Série temporelle, tous créneaux confondus, décharges exclues et aberrations
// marquées. Même forme que _serieExercice, sans le filtre de créneau.
function _serieRecords(user,nomEx){
  const out=[];
  for(const sess of ((user&&user.sessions)||[])){
    if(!sess||!sess.date||sess.deload) continue;
    const nom=_nomDansSeance(sess,nomEx,user);
    if(!nom) continue;
    const p=perfExercice(sess,nom,user);
    if(!p||!(p.score>0)) continue;
    out.push({date:sess.date,score:p.score,sansRirDominant:p.sansRirDominant,
      nom,sess});
  }
  out.sort((a,b)=>a.date-b.date);
  return _marquerAberrations(out);
}
/** Les tranches de répétitions des records (« au moins N »). */
const RECORDS_TRANCHES=Object.freeze([1,3,5,8,10,12]);
// PURE. Rend null quand rien n'est retenable.
function recordsExercice(user,nomEx){
  if(!user||!nomEx) return null;
  const cle=(user.email||'?')+'|'+exKey(nomEx)+'|records';
  if(_cachePlateau[cle]) return _cachePlateau[cle];
  let mc=null, me=null;
  const _ex=_exPourCharge(nomEx,user), _t=typeCharge(_ex);
  // ASSISTÉ : le record est l'assistance la plus FAIBLE, et à assistance égale
  // le plus de répétitions (c'est tout ce qu'on sait sans poids de corps).
  // Toutes les séances sont lues : sans poids de corps, perfExercice n'y voit rien.
  const _pts=_t==='assiste'
    ?((user.sessions)||[]).filter(x=>x&&x.date&&!x.deload).map(x=>{ const nom=_nomDansSeance(x,nomEx,user); return nom?{date:x.date,nom,sess:x,sansRirDominant:false}:null; }).filter(Boolean)
    :_serieRecords(user,nomEx);
  // LES RECORDS PAR TRANCHE DE RÉPÉTITIONS (05/10/2026) : la meilleure charge
  // soulevée pour AU MOINS N répétitions validées. 100 kg × 6 vaut record à 1,
  // 3 et 5 — pas à 8. Et la meilleure série en volume (charge × répétitions).
  // Mêmes séries que le record de charge : validées, non aberrantes, hors
  // décharge ; rien pour une machine assistée, où la charge se lit à l'envers.
  /** @type {Object<string,{kg:number,date:number}>} */
  const parReps={};
  let mv=null;
  for(const pt of _pts){
    if(pt.aberrant) continue;              // saisie probablement fautive
    const d=pt.sess.data[pt.nom];
    if(!d||!Array.isArray(d.sets)) continue;
    for(const s of d.sets){
      if(!s||s.done!==true) continue;
      const w=parseFloat(s.weight)||0;
      const r=_perfReps(s);
      if(_t==='assiste'){
        if(w>0&&r>0&&(!mc||w<mc.kg||(w===mc.kg&&r>(mc.reps||0)))) mc={kg:w,reps:r,date:pt.date,assiste:true};
      }
      // Meilleure charge : la plus lourde, et à charge égale la plus longue.
      else if(w>0&&(!mc||w>mc.kg||(w===mc.kg&&(r||0)>(mc.reps||0))))
        mc={kg:w,reps:(r>0?r:null),date:pt.date};
      if(_t!=='assiste'&&w>0&&r>0){
        for(const N of RECORDS_TRANCHES)
          if(r>=N&&(!parReps[N]||w>parReps[N].kg)) parReps[N]={kg:w,date:pt.date};
        const vol=Math.round(w*r*10)/10;
        if(!mv||vol>mv.volume) mv={volume:vol,kg:w,reps:r,date:pt.date};
      }
      // e1RM : la séance doit avoir ses RIR, et la série rester dans les bornes
      // où le modèle vaut quelque chose. Au-delà de PERF_REPS_MAX_E1RM,
      // perfExercice bascule déjà sur le tonnage-série — même règle ici.
      if(pt.sansRirDominant) continue;
      if(!(r>0)||!e1rmFiable(r,_perfRir(s,user))) continue;
      const _eff=chargeEffective(s,_ex,user);
      if(!(_eff>0)) continue;
      const v=e1rm(_eff,r,_perfRir(s,user));
      if(v>0&&(!me||v>me.valeur)) me={valeur:Math.round(v*10)/10,date:pt.date};
    }
  }
  const res=(mc||me)?{meilleureCharge:mc,meilleurE1rm:me,parReps,meilleurVolumeSerie:mv}:null;
  _cachePlateau[cle]=res;
  return res;
}

// ══ LE RECORD À PORTÉE (28/09/2026) ════════════════════════════════════
//
// Avant la séance, UN objectif : la charge qui ferait un nouveau record
// (record de CHARGE, celui que la fin de séance et la carte record fêtent),
// tirée de la TENDANCE de l'e1RM sur les six dernières séances de
// l'exercice (droite des moindres carrés, projetée d'une séance).
//
// PRUDENT PAR CONSTRUCTION :
//   • la charge que la tendance permet (e1RM projeté, ramené aux répétitions
//     visées avec le RIR habituel de l'athlète) est PLAFONNÉE à +2,5 % du
//     record de charge, puis arrondie AU PAS (1,25 kg sous 20 kg, 2,5 kg
//     au-delà — les paliers de _arrondirCharge) ; il n'y a objectif que si
//     elle dépasse le record ;
//   • RIEN quand la tendance est plate ou en baisse, pendant une décharge
//     (cochée, planifiée dans le bloc, ou séance de retour), ou quand le
//     cycle réduit la charge du jour (getCycleFactor < 1) ;
//   • rien non plus sans trois séances récentes (60 jours) mesurables.
// Le calcul d'e1RM est celui du fichier (e1rm, séries validées ≤ 12 reps).
const RAP_SEANCES=6, RAP_MIN_POINTS=3, RAP_PLAFOND=0.025, RAP_FRAICHEUR_J=60;
/** PURE. Le pas de charge : 1,25 kg sous 20 kg, 2,5 kg au-delà. */
function pasDeCharge(kg){ return (Number(kg)<20)?1.25:2.5; }
/** PURE. Arrondi au pas de charge le plus proche. */
function arrondiAuPas(kg){
  // Enveloppe d'arrondiCharge (le rattrapage flottant y est : 102,4999999 est 102,5).
  return arrondiCharge(kg,{sens:'proche'})||0;
}
// Les répétitions visées : le BAS de la fourchette (« 8-10 » → 8), la plus
// lourde des charges prévues.
function _rapReps(reps){
  const m=String(reps==null?'':reps).match(/\d+(?:[.,]\d+)?/);
  return m?Math.round(parseFloat(m[0].replace(',','.'))):0;
}
// La meilleure e1RM d'une liste de séries (validées, ≤ 12 reps), et le RIR
// de la série qui la donne.
function _rapE1rm(sets,user){
  let v=0, rir=0;
  for(const s of (sets||[])){
    if(!s||s.done!==true) continue;
    const w=parseFloat(s.weight), r=_perfReps(s);
    if(!(w>0)||!(r>0)||!e1rmFiable(r,_perfRir(s,user))) continue;
    const i=_perfRir(s,user);
    const x=e1rm(w,r,i);
    if(x>v){ v=x; rir=Number(i)||0; }
  }
  return {v,rir};
}
/** PURE. Pente et projection (séance suivante) des moindres carrés. */
function tendanceLineaire(vals){
  const n=vals.length;
  if(n<2) return {pente:0,projection:n?vals[0]:0};
  const mx=(n-1)/2, my=vals.reduce((a,v)=>a+v,0)/n;
  let num=0, den=0;
  for(let i=0;i<n;i++){ num+=(i-mx)*(vals[i]-my); den+=(i-mx)*(i-mx); }
  const pente=den?num/den:0;
  return {pente,projection:my+pente*(n-mx)};
}
/** PURE. L'objectif d'UN exercice, ou null. */
function recordAPorteeExo(u,nomEx,reps,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const r=Math.round(Number(reps));
  if(!u||!nomEx||!(r>=1&&r<=PERF_REPS_MAX_E1RM)) return null;
  // Une CHARGE à viser n'a de sens que sur une charge externe (typeCharge).
  if(typeCharge(_exPourCharge(nomEx,u))!=='externe') return null;
  const ses=((u.sessions)||[]).filter(s=>s&&Number(s.date)>0&&Number(s.date)<=t);
  // LE RECORD DE CHARGE : la même règle que recordsDeSeance, toutes séances.
  let recKg=0;
  for(const s of ses){
    const d=_dataDeSeance(s,nomEx);
    for(const st of ((d&&d.sets)||[])){
      if(!st||st.done!==true) continue;
      const w=parseFloat(st.weight)||0;
      if(w>recKg) recKg=w;
    }
  }
  // LA TENDANCE : les six dernières séances mesurables, hors décharges et
  // saisies aberrantes (_serieRecords les écarte déjà).
  let pts=[];
  try{ pts=_serieRecords(Object.assign({},u,{sessions:ses}),nomEx).filter(p=>!p.aberrant); }catch(e){ pts=[]; }
  const vals=[];
  for(const p of pts){
    const d=p.sess&&p.sess.data&&p.sess.data[p.nom];
    const x=_rapE1rm(d&&d.sets,u);
    if(x.v>0) vals.push({v:x.v,rir:x.rir,date:p.date});
  }
  const der=vals.slice(-RAP_SEANCES);
  if(der.length<RAP_MIN_POINTS||!(recKg>0)) return null;
  if(t-der[der.length-1].date>RAP_FRAICHEUR_J*864e5) return null;
  const tr=tendanceLineaire(der.map(x=>x.v));
  if(!(tr.pente>0)) return null;
  // L'e1RM projeté, ramené à une charge aux répétitions visées — avec le RIR
  // médian des séances retenues : le modèle e1rm() en tient compte, la
  // conversion inverse aussi.
  const rirs=der.map(x=>x.rir).sort((a,b)=>a-b);
  const rirRef=rirs[Math.floor(rirs.length/2)]||0;
  // La réciproque exacte de e1rm(), en un seul endroit : chargePourReps.
  const tendance=chargePourReps(tr.projection,r,rirRef);
  const plafond=recKg*(1+RAP_PLAFOND);
  const charge=arrondiAuPas(Math.min(tendance,plafond));
  if(!(charge>recKg)) return null;
  return {nm:nomEx,charge,reps:r,record:recKg,serie:0,
    e1rm:Math.round(tr.projection*10)/10,pente:Math.round(tr.pente*100)/100,
    gain:Math.round((charge-recKg)*100)/100};
}
/**
 * PURE (horloge donnée). LE RECORD À PORTÉE de la séance prévue : un seul
 * exercice, le plus grand gain relatif. null quand rien n'est à portée.
 * @returns {?{nm:string,charge:number,reps:number,record:number,serie:number,e1rm:number,pente:number,gain:number}}
 */
function recordAPortee(u,seancePrevue,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach'||!seancePrevue||!Array.isArray(seancePrevue.exercises)) return null;
  if(seancePrevue.deload) return null;
  try{ if(semaineEstDecharge(u,new Date(t))) return null; }catch(e){}
  try{ if(repriseDeloadPropose(u)) return null; }catch(e){}
  try{ if(getCycleFactor(u,localISODate(new Date(t))).factor<1) return null; }catch(e){}
  try{ if(suspensionEtat(u).actif) return null; }catch(e){}
  let best=null;
  for(const ex of seancePrevue.exercises){
    if(!ex||!ex.name) continue;
    try{ if(isCardio(ex)) continue; }catch(e){ continue; }
    let o=null; try{ o=recordAPorteeExo(u,ex.name,_rapReps(ex.reps),t); }catch(e){ o=null; }
    if(o&&(!best||o.gain/o.record>best.gain/best.record)) best=o;
  }
  return best;
}
const _rapKg=v=>String(Math.round(Number(v)*100)/100).replace('.',',');
/** PURE. « Record à portée : Squat 102,5 kg × 5 ». */
function texteRecordAPortee(o){
  if(!o||!o.nm||!(o.charge>0)) return '';
  return 'Record à portée : '+o.nm+' '+_rapKg(o.charge)+' kg × '+o.reps;
}
// La séance prévue AUJOURD'HUI : le créneau actif du jour (sessions_config
// est indexé lundi → dimanche, comme le sélecteur de séance).
function seancePrevueDuJour(u,maintenant){
  const d=new Date((typeof maintenant==='number')?maintenant:Date.now());
  const j=d.getDay()===0?6:d.getDay()-1;
  const cfg=(u&&u.sessions_config)||[];
  const s=cfg[j];
  return (s&&s.active&&Array.isArray(s.exercises)&&s.exercises.length)?s:null;
}
// Pour le rappel du service worker : le texte par jour de rappel, avec la
// même correspondance jour → créneau que _nomsSeancesParJour.
function _recordsAPorteeParJour(u,maintenant){
  const out={};
  const jours=(u&&u._woReminderDays)||[];
  const actifs=((u&&u.sessions_config)||[]).filter(s=>s&&s.active);
  jours.forEach((j,k)=>{
    const c=actifs[k%Math.max(1,actifs.length)];
    let o=null; try{ o=c?recordAPortee(u,c,maintenant):null; }catch(e){ o=null; }
    if(o) out[j]=texteRecordAPortee(o);
  });
  return out;
}
const _ECLAIR_SVG='<svg viewBox="0 0 24 24" aria-hidden="true" style="width:1em;height:1em;vertical-align:-2px"><path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="currentColor"/></svg>';
// PURE. Le bandeau (accueil, tête de séance).
function htmlRecordAPortee(o,lieu){
  if(!o) return '';
  return '<div class="rpo-carte'+(lieu==='seance'?' rpo-seance':'')+'" role="note">'
    +'<span class="rpo-ico">'+_ECLAIR_SVG+'</span>'
    +'<span class="rpo-txt"><span class="rpo-tag">Record à portée</span>'
    +'<b>'+escapeHtml(o.nm)+' · '+_rapKg(o.charge)+' kg × '+o.reps+'</b>'
    +'<span class="rpo-sous">Ton record : '+_rapKg(o.record)+' kg · ta progression le permet'+(lieu==='seance'?' — série '+(o.serie+1):'')+'</span></span></div>';
}
function _rendreRecordAPortee(u){
  const z=document.getElementById('clh-record-portee');
  if(!z) return null;
  let o=null;
  try{ o=recordAPortee(u,seancePrevueDuJour(u)); }catch(e){ o=null; }
  z.innerHTML=htmlRecordAPortee(o,'accueil');
  return o;
}
// En séance : l'index de l'exercice visé dans woState.
function _rapIndexSeance(){
  const o=woState&&woState.objectif;
  if(!o||!Array.isArray(woState.exercises)) return -1;
  const k=exKey(o.nm);
  return woState.exercises.findIndex(e=>e&&(e.name===o.nm||exKey(e.name)===k));
}
// Le petit éclair sur la série concernée (tant qu'elle n'est pas validée).
function _eclairObjectif(idx,i){
  const o=woState&&woState.objectif;
  if(!o||i!==o.serie||_rapIndexSeance()!==idx) return '';
  const d=woState.sessionData&&woState.sessionData[idx];
  if(d&&d.sets&&d.sets[i]&&d.sets[i].done) return '';
  return '<span class="rpo-eclair" title="'+escapeHtml(texteRecordAPortee(o))+'">'+_ECLAIR_SVG+'</span>';
}
// PURE. Le record d'une séance a-t-il atteint l'objectif qu'elle portait ?
function objectifAtteint(objectif,record){
  if(!objectif||!record||!(Number(objectif.charge)>0)) return false;
  const a=String(objectif.nm||''), b=String(record.nm||'');
  const meme=a===b||(()=>{ try{ return exKey(a)===exKey(b); }catch(e){ return false; } })();
  return meme&&Number(record.curMax)>=Number(objectif.charge);
}

// ══ LE CHECK-IN DU MATIN ET LA BATTERIE DU JOUR (28/09/2026) ═══════════
//
// Trois questions en trois touches (sommeil, énergie, courbatures, de 1 à 5),
// proposées sur l'accueil jusqu'à 14 h. Enregistré dans le dossier,
// u.checkin[AAAA-MM-JJ] (donc /users/<id>/checkin/<date>) : une donnée de
// SANTÉ (CHAMPS_SANTE), lue par le coach dans la fiche athlète.
//
// LA BATTERIE (batterieDuJour) : 0..100 % et une phrase — séance à fond,
// séance normale, baisse de 10 % conseillée, repos conseillé. Le ressenti
// pèse d'abord ; la charge des 7 derniers jours, comparée à la semaine
// habituelle (les 4 d'avant), l'ajuste. Un conseil, jamais une consigne :
// rien n'est modifié dans la séance.
//
// +10 V par check-in (XP_ACTIONS.checkin), DANS le plafond du jour.
const CHECKIN_HEURE_MAX=14;
const CHECKIN_QUESTIONS=Object.freeze([
  Object.freeze({cle:'sommeil',lib:'Sommeil',bas:'Très mauvais',haut:'Excellent'}),
  Object.freeze({cle:'energie',lib:'Énergie',bas:'Vidé',haut:'Au top'}),
  Object.freeze({cle:'courbatures',lib:'Courbatures',bas:'Aucune',haut:'Fortes',inverse:true}),
  // LOT N5 : la faim, FACULTATIVE (checkinComplet ne la demande pas). Libellé
  // neutre : il ne suggère rien, ni « résister », ni « craquer ».
  Object.freeze({cle:'faim',lib:'Ta faim, hier ?',bas:'Faible',haut:'Très forte',inverse:true,facultatif:true})
]);
const BATTERIE_NIVEAUX=Object.freeze([
  Object.freeze({min:80,cle:'fond',phrase:'Séance à fond possible'}),
  Object.freeze({min:55,cle:'normale',phrase:'Séance normale'}),
  Object.freeze({min:35,cle:'baisse',phrase:'Baisse de 10 % conseillée'}),
  Object.freeze({min:0,cle:'repos',phrase:'Repos conseillé'})
]);
const RECHARGE_CONSEILS=Object.freeze([
  'Couche-toi 30 minutes plus tôt ce soir.',
  'Vise tes protéines à chaque repas aujourd’hui.',
  'Vingt minutes de marche, sans forcer.',
  'Cinq minutes de mobilité : hanches, épaules, chevilles.'
]);
const _ciNote=v=>{ const n=Math.round(Number(v)); return (n>=1&&n<=5)?n:0; };
/** PURE. Le check-in est-il complet (trois réponses de 1 à 5) ? */
function checkinComplet(c){ return !!(c&&_ciNote(c.sommeil)&&_ciNote(c.energie)&&_ciNote(c.courbatures)); }
/**
 * PURE. La charge des 7 derniers jours : {semaine, moyenne} en kg soulevés
 * (volume des séances), la moyenne sur les 4 semaines d'avant. null sans
 * semaine habituelle à comparer.
 */
function chargeSeptJours(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  let semaine=0, avant=0, nAvant=0;
  for(const s of ((u&&u.sessions)||[])){
    const d=Number(s&&s.date), v=Number(s&&s.volume)||0;
    if(!(d>0)||d>t) continue;
    if(t-d<7*864e5) semaine+=v;
    else if(t-d<35*864e5){ avant+=v; nAvant++; }
  }
  if(!nAvant||!(avant>0)) return null;
  return {semaine:Math.round(semaine),moyenne:Math.round(avant/4)};
}
/**
 * PURE. LA BATTERIE DU JOUR.
 * @param {{sommeil:number,energie:number,courbatures:number}} checkin  1..5
 * @param {?{semaine:number,moyenne:number}} charge  chargeSeptJours
 * @returns {?{pct:number,niveau:string,phrase:string}}
 */
function batterieDuJour(checkin,charge){
  if(!checkinComplet(checkin)) return null;
  const s=(_ciNote(checkin.sommeil)-1)/4, e=(_ciNote(checkin.energie)-1)/4, c=1-(_ciNote(checkin.courbatures)-1)/4;
  let pct=100*(0.35*s+0.40*e+0.25*c);
  // La charge : une semaine bien plus lourde que d'habitude vide la
  // batterie ; une semaine très légère la recharge un peu.
  const r=(charge&&Number(charge.moyenne)>0)?Number(charge.semaine)/Number(charge.moyenne):null;
  if(r!=null){
    if(r>=1.5) pct-=15;
    else if(r>=1.25) pct-=8;
    else if(r<0.5) pct+=5;
  }
  pct=Math.max(0,Math.min(100,Math.round(pct)));
  const n=BATTERIE_NIVEAUX.find(x=>pct>=x.min);
  return {pct,niveau:n.cle,phrase:n.phrase};
}
function _ciJour(t){ return localISODate(new Date((typeof t==='number')?t:Date.now())); }
function checkinDuJour(u,maintenant){
  const c=u&&u.checkin&&u.checkin[_ciJour(maintenant)];
  return checkinComplet(c)?c:null;
}
/** PURE. La série de check-ins : jours d'affilée jusqu'à aujourd'hui (ou hier). */
function serieCheckins(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const l=(u&&u.checkin)||{};
  let d=new Date(t); d.setHours(12,0,0,0);
  if(!checkinComplet(l[localISODate(d)])) d=new Date(d.getTime()-864e5);
  let n=0;
  while(checkinComplet(l[localISODate(d)])&&n<3650){ n++; d=new Date(d.getTime()-864e5); }
  return n;
}
/** PURE. Le formulaire est-il proposé ? Un athlète, avant 14 h, pas encore fait. */
function checkinAProposer(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach'||!u.email) return false;
  if(new Date(t).getHours()>=CHECKIN_HEURE_MAX) return false;
  return !checkinDuJour(u,t);
}
// Le sommeil importé de la nuit (sleepLog), s'il existe : montré, pas demandé.
function _ciSommeilImporte(u,maintenant){
  const j=_ciJour(maintenant);
  const e=((u&&Array.isArray(u.sleepLog))?u.sleepLog:[]).find(x=>x&&x.date===j&&Number(x.duration)>0);
  if(!e) return '';
  const m=Math.round(Number(e.duration)*(Number(e.duration)<24?60:1));
  return Math.floor(m/60)+' h '+String(m%60).padStart(2,'0');
}
// Le conseil du jour de repos, et le prochain record à portée en teaser.
function _ciRecharge(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const d=new Date(t);
  const conseil=RECHARGE_CONSEILS[(d.getDate()+d.getMonth())%RECHARGE_CONSEILS.length];
  let teaser='';
  try{
    for(let k=1;k<=7&&!teaser;k++){
      const s=seancePrevueDuJour(u,t+k*864e5);
      const o=s?recordAPortee(u,s,t):null;
      if(o) teaser=texteRecordAPortee(o);
    }
  }catch(e){ teaser=''; }
  return {conseil,teaser};
}
let _ciBrouillon={};
// PURE (sauf le brouillon passé). La carte : le formulaire, ou la batterie.
function htmlCheckinAccueil(u,maintenant,brouillon){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach') return '';
  const fait=checkinDuJour(u,t);
  const serie=serieCheckins(u,t);
  const serieTxt=serie>=2?'<span class="ci-serie">'+serie+' matins</span>':'';
  if(fait){
    const b=batterieDuJour(fait,chargeSeptJours(u,t));
    if(!b) return '';
    let repos=false; try{ repos=!seancePrevueDuJour(u,t); }catch(e){ repos=false; }
    const rc=repos?_ciRecharge(u,t):null;
    return '<div class="ci-carte ci-fait" data-acc data-niveau="'+b.niveau+'">'+_accX('ci')
      +'<div class="ci-tete"><span class="eyebrow">Batterie du jour</span>'+serieTxt+'</div>'
      +'<div class="ci-bat"><div class="ci-pile" aria-hidden="true"><i style="width:'+b.pct+'%"></i></div>'
      +'<b class="ci-pct" id="ci-pct" data-cible="'+b.pct+'">'+b.pct+' %</b></div>'
      +'<div class="ci-phrase">'+escapeHtml(repos?'Recharge : ta prochaine séance sera meilleure si…':b.phrase)+'</div>'
      +(rc?'<div class="ci-conseil">'+escapeHtml(rc.conseil)+'</div>'+(rc.teaser?'<div class="ci-teaser">'+escapeHtml(rc.teaser)+'</div>':''):'')
      +_htmlCiFaimApres(fait)
      +'</div>';
  }
  if(!checkinAProposer(u,t)) return '';
  const br=brouillon||{};
  const imp=_ciSommeilImporte(u,t);
  return '<div class="ci-carte" data-acc role="group" aria-label="Check-in du matin">'+_accX('ci')
    +'<div class="ci-tete"><span class="eyebrow eyebrow-act">Check-in du matin</span>'+serieTxt+'</div>'
    +CHECKIN_QUESTIONS.map(q=>'<div class="ci-ligne"><span class="ci-lib">'+q.lib
      +(q.cle==='sommeil'&&imp?' <em>'+imp+' cette nuit</em>':'')+'</span>'
      +'<span class="ci-pastilles">'+[1,2,3,4,5].map(n=>'<button type="button" class="ci-p'+(Number(br[q.cle])===n?' on':'')+'" '
        +'aria-label="'+escapeHtml(q.lib+' : '+n+' sur 5'+(n===1?' ('+q.bas+')':n===5?' ('+q.haut+')':''))+'" '
        +'onclick="checkinRepondre(\''+q.cle+'\','+n+')">'+n+'</button>').join('')+'</span></div>').join('')
    +'<div class="ci-note">1 = '+escapeHtml(CHECKIN_QUESTIONS[0].bas.toLowerCase())+' · 5 = '+escapeHtml(CHECKIN_QUESTIONS[0].haut.toLowerCase())
      +' ; courbatures : 1 = aucune ; faim : 1 = faible, facultatif · +10 V</div>'
    +'</div>';
}
function _rendreCheckin(u){
  const z=document.getElementById('clh-checkin');
  if(!z) return false;
  if(accueilMasque('ci')){ z.innerHTML=''; return false; }
  z.innerHTML=htmlCheckinAccueil(u,Date.now(),_ciBrouillon);
  try{ const p=z.querySelector('#ci-pct'); if(p&&z.dataset.anime!=='1'){ z.dataset.anime='1'; p.dataset.valeur='0';
    arcCompteur(p,Number(p.dataset.cible)||0,{duree:700,format:x=>Math.round(x)+' %'}); } }catch(e){}
  return !!z.innerHTML;
}
// Une touche : la réponse est gardée ; à la troisième, le check-in est écrit.
function checkinRepondre(cle,n){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!CHECKIN_QUESTIONS.some(q=>q.cle===cle)||!_ciNote(n)) return false;
  // LOT N5 : la faim donnée APRÈS le check-in (la carte de la batterie la
  // propose encore) s'ajoute à celui du jour, sans rien recalculer.
  const _fait=checkinDuJour(u,Date.now());
  if(cle==='faim'&&_fait){
    _fait.faim=_ciNote(n);
    saveUserOuDire('Ton check-in');
    _rendreCheckin(u);
    return true;
  }
  _ciBrouillon[cle]=_ciNote(n);
  if(checkinComplet(_ciBrouillon)){
    const t=Date.now(), j=_ciJour(t);
    const c={sommeil:_ciBrouillon.sommeil,energie:_ciBrouillon.energie,courbatures:_ciBrouillon.courbatures,at:t};
    if(_ciNote(_ciBrouillon.faim)) c.faim=_ciNote(_ciBrouillon.faim);
    const b=batterieDuJour(c,chargeSeptJours(u,t));
    if(b) c.batterie=b.pct;
    u.checkin=(u.checkin&&typeof u.checkin==='object')?u.checkin:{};
    u.checkin[j]=c;
    _ciBrouillon={};
    saveUserOuDire('Ton check-in');
    try{ majXp(); _rendreRang(u); }catch(e){}
    try{ arcHaptique('succes'); }catch(e){}
  }
  _rendreCheckin(u);
  return true;
}
// Côté coach : la batterie du jour et la tendance 14 jours.
function _htmlBatterieCoach(c,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const l=(c&&c.checkin)||{};
  const jours=[];
  for(let k=13;k>=0;k--){
    const d=new Date(t-k*864e5), j=localISODate(d);
    const x=l[j];
    const b=checkinComplet(x)?(Number(x.batterie)>=0&&x.batterie!==undefined?Number(x.batterie):(batterieDuJour(x,null)||{}).pct):null;
    jours.push({j,b:(b==null||!isFinite(b))?null:b});
  }
  const faits=jours.filter(x=>x.b!=null);
  if(!faits.length) return '';
  const auj=jours[jours.length-1].b;
  const moy=Math.round(faits.reduce((a,x)=>a+x.b,0)/faits.length);
  const niv=auj==null?null:BATTERIE_NIVEAUX.find(x=>auj>=x.min);
  return '<section class="cc-sect cc-bat"><div class="cc-sect-t">Batterie du jour</div>'
    +'<div class="ci-coach-l"><b>'+(auj==null?'Pas de check-in aujourd’hui':auj+' %')+'</b>'
    +(niv?'<span>'+escapeHtml(niv.phrase)+'</span>':'')+'</div>'
    +'<div class="ci-coach-barres" role="img" aria-label="Tendance 14 jours, moyenne '+moy+' %">'
    +jours.map(x=>'<i title="'+escapeHtml(x.j+(x.b==null?' : pas de check-in':' : '+x.b+' %'))+'" style="height:'+(x.b==null?4:Math.max(6,x.b))+'%"'+(x.b==null?' class="vide"':'')+'></i>').join('')
    +'</div><div class="ci-coach-n">14 jours · moyenne '+moy+' % · '+faits.length+' check-in'+(faits.length>1?'s':'')+'</div>'
    +_htmlCheckinCoachDetail(c,t)+'</section>';
}
// La faim, proposée encore sur la carte de la batterie tant qu'elle n'est pas
// donnée ce jour-là : la troisième touche écrit le check-in, la quatrième
// question ne doit pas disparaître avec le formulaire.
function _htmlCiFaimApres(fait){
  if(!fait||_ciNote(fait.faim)) return '';
  const q=CHECKIN_QUESTIONS.find(x=>x.cle==='faim');
  if(!q) return '';
  return '<div class="ci-ligne ci-faim"><span class="ci-lib">'+escapeHtml(q.lib)+'</span>'
    +'<span class="ci-pastilles">'+[1,2,3,4,5].map(n=>'<button type="button" class="ci-p" '
      +'aria-label="'+escapeHtml('Faim : '+n+' sur 5'+(n===1?' ('+q.bas+')':n===5?' ('+q.haut+')':''))+'" '
      +'onclick="checkinRepondre(\'faim\','+n+')">'+n+'</button>').join('')+'</span></div>';
}
// ══ LOT N5 : LA FAIM DANS LE CHECK-IN, ET CE QU'ELLE DÉCLENCHE (29/09/2026) ══
// La faim est la quatrième question du check-in, FACULTATIVE : checkinComplet
// ne la demande pas (un check-in à trois réponses reste complet, et les volts
// des journées passées ne bougent pas).
//
// fatigueDiete lit la faim et l'énergie sur quatorze jours, en sèche
// seulement, et rend un niveau de 0 à 3. Au niveau 3, la carte du point de la
// semaine propose une PAUSE au maintien, de 7 à 14 jours.
//
// ⚠ UN SIGNAL DE FATIGUE NE FAIT JAMAIS DESCENDRE. Dès le niveau 1, une baisse
//   proposée par l'ajustement est retenue (on stabilise) ; au niveau 3, la
//   pause remonte au maintien, jamais en dessous des objectifs actuels, jour
//   par jour. propositionFatigue le porte, et un test le verrouille.
// ⚠ SOUS aTCA, la question reste, le déclenchement ne s'affiche pas : la carte
//   du point n'existe pas dans ce mode (lot N1), et c'est au coach, qui voit la
//   faim et le niveau sur sa fiche, d'en parler.
// ⚠ SOUS DRAPEAU, rien n'est proposé : la carte reste informative (lot N1).
const FATIGUE_FENETRE_JOURS=14;
const FATIGUE_MIN_CHECKINS=7;        // check-ins AVEC la faim, dans la fenêtre
const FATIGUE_FAIM_HAUTE=4;          // moyenne sur 5
const FATIGUE_FAIM_MOYENNE=3.5;
const FATIGUE_ENERGIE_BASSE=2.5;     // moyenne sur 5
const PAUSE_FATIGUE_JOURS=Object.freeze([7,10,14]);
const PAUSE_FATIGUE_DEFAUT=10;
const PAUSE_FATIGUE_FAIT='Pendant la pause, tu manges à ton maintien : la faim redescend, l’énergie revient, et ta sèche repart mieux ensuite.';
const PAUSE_FATIGUE_NE_FAIT_PAS='Tu ne perds pas ce que tu as gagné, tu récupères de la marge. Un peu plus sur la balance les premiers jours, c’est de l’eau et des réserves, pas un recul.';
/**
 * PURE. Le niveau de fatigue de la diète, de 0 à 3.
 * @param checkins  u.checkin : {AAAA-MM-JJ: {sommeil, energie, courbatures, faim?}}
 * @param phase     le type de phase ('seche'…) ou l'objet phase
 * @param maintenant  ms ; la fenêtre est les 14 jours qui finissent ce jour-là
 * 0 : hors sèche, moins de 7 check-ins avec la faim, ou rien à signaler.
 * 1 : faim plutôt haute (≥ 3,5) OU énergie basse (≤ 2,5).
 * 2 : faim haute (≥ 4) seule, ou faim plutôt haute ET énergie basse.
 * 3 : faim haute ET énergie basse.
 */
function fatigueDiete(checkins,phase,maintenant){
  const type=(phase&&typeof phase==='object')?phase.type:phase;
  if(type!=='seche') return 0;
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const l=(checkins&&typeof checkins==='object')?checkins:{};
  const fin=localISODate(new Date(t));
  let n=0, sf=0, se=0;
  for(let i=0;i<FATIGUE_FENETRE_JOURS;i++){
    const c=l[_jourPlus(fin,-i)];
    if(!checkinComplet(c)||!_ciNote(c.faim)) continue;
    n++; sf+=_ciNote(c.faim); se+=_ciNote(c.energie);
  }
  if(n<FATIGUE_MIN_CHECKINS) return 0;
  const faim=sf/n, energie=se/n;
  const haute=faim>=FATIGUE_FAIM_HAUTE, moyenne=faim>=FATIGUE_FAIM_MOYENNE, basse=energie<=FATIGUE_ENERGIE_BASSE;
  if(haute&&basse) return 3;
  if(haute||(moyenne&&basse)) return 2;
  if(moyenne||basse) return 1;
  return 0;
}
/**
 * PURE. Ce que la fatigue fait de la proposition de la semaine.
 * @param niveau    fatigueDiete
 * @param a         ajustementPropose (ou null)
 * @param macros    nutrition.macros ({on, off})
 * @param depense   la dépense estimée (le maintien), kcal
 * @returns {{type:'pause',jours,macros:{on,off}}|{type:'garde',retenue:boolean}|{type:'ajustement',a}|null}
 * Niveau 0 : la proposition telle quelle. Dès 1 : une BAISSE est retenue.
 * Au 3 : la pause, chaque jour au plus haut de son objectif actuel et du
 * maintien ; si elle ne change rien (déjà au maintien ou au-dessus), on garde.
 */
function propositionFatigue(niveau,a,macros,depense){
  const n=Number(niveau)||0;
  if(n>=3){
    const m=macros||{}, dep=Math.round(Number(depense)||0);
    const un=j=>{
      const b=m[j];
      if(!b||!(Number(b.kcal)>0)) return null;
      const k=Math.max(Number(b.kcal),dep);
      if(k===Number(b.kcal)) return Object.assign({},b);
      const p=Number(b.p)||0, l=Number(b.l)||0;
      return {kcal:k,p:b.p,l:b.l,g:Math.max(0,Math.round((k-4*p-9*l)/4)),f:Math.round(FIBRES_PAR_1000*k/1000)};
    };
    const on=un('on'), off=un('off');
    if(on&&off&&(on.kcal>Number(m.on.kcal)||off.kcal>Number(m.off.kcal)))
      return {type:'pause',jours:PAUSE_FATIGUE_DEFAUT,macros:{on,off}};
    return {type:'garde',retenue:!!(a&&a.sens==='baisse')};
  }
  if(a&&a.sens==='baisse'&&n>=1) return {type:'garde',retenue:true};
  return a?{type:'ajustement',a}:null;
}
// La pause lancée par l'athlète depuis son point (origine 'fatigue') : même
// objet que celle du coach (u.phase.pause), que cibleVitesse, ajustementPropose
// et la fiche coach lisent déjà. kcalAvant est la seule trace de la reprise.
function appliquerPauseFatigue(jours){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.phase) return false;
  let e=null; try{ e=etatPointSemaine(u,Date.now()); }catch(err){ e=null; }
  if(!e||!e.pause){ toast('Cette proposition n’est plus d’actualité','var(--orange)'); return false; }
  const j=PAUSE_FATIGUE_JOURS.indexOf(Number(jours))>=0?Number(jours):PAUSE_FATIGUE_DEFAUT;
  const n=u.nutrition, m=n.macros;
  const avant=JSON.parse(JSON.stringify({on:m.on||{},off:m.off||{}}));
  u.phase.pause={debut:Date.now(),jours:j,kcalAvant:avant,origine:'fatigue'};
  n.macros=Object.assign({},m,{on:e.pause.macros.on,off:e.pause.macros.off,origine:'pause',origineDate:Date.now()});
  _pauseJournaliser(u,'pause_debut',{jours:j,motif:'fatigue'});
  enregistrerPointSemaine(u,e,'pause');
  const ok=saveUser();
  toastEcriture(ok,'Pause de '+j+' jours au maintien','ta pause est');
  try{ _viderCachePlateau(); _viderCacheSignaux(); }catch(err){}
  _rendrePointSemaine();
  return true;
}
// Fin de SA pause : reprendre la sèche (les objectifs d'avant), ou une semaine
// de plus au maintien. Jamais d'elle-même : une pause dépassée reste active.
function finPauseFatigue(choix){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const p=u&&pauseActive(u);
  if(!p||p.origine!=='fatigue') return false;
  if(choix==='reprendre'){
    const av=p.kcalAvant;
    if(!av||!av.on||!av.off){ toast('Les objectifs d’avant la pause sont introuvables','var(--orange)'); return false; }
    u.nutrition.macros=Object.assign({},u.nutrition.macros,{on:av.on,off:av.off,origine:'pause_fin',origineDate:Date.now()});
    delete u.phase.pause;
    _pauseJournaliser(u,'pause_fin_reprise',{motif:'fatigue'});
    toastEcriture(saveUser(),'Sèche reprise','la reprise est');
  } else {
    p.jours=Math.min(PAUSE_JOURS_MAX,Number(p.jours)+7);
    _pauseJournaliser(u,'pause_prolongee',{jours:p.jours,motif:'fatigue'});
    toastEcriture(saveUser(),'Une semaine de plus au maintien','ta pause est');
  }
  try{ _viderCachePlateau(); _viderCacheSignaux(); }catch(err){}
  _rendrePointSemaine();
  return true;
}
// PURE. Le bloc de la pause sur la carte du point : ce que ça fait, ce que ça
// ne fait pas, la durée, et deux boutons.
function htmlPauseFatigue(e){
  if(!e||!e.pause) return '';
  const k=e.pause.macros, lib=v=>escapeHtml(Math.round(Number(v)).toLocaleString('fr-FR'))+' kcal';
  return '<div class="ps-pause">'
    +'<div class="ps-pause-l"><b>Ce que ça fait</b> '+escapeHtml(PAUSE_FATIGUE_FAIT)+'</div>'
    +'<div class="ps-pause-l"><b>Ce que ça ne fait pas</b> '+escapeHtml(PAUSE_FATIGUE_NE_FAIT_PAS)+'</div>'
    +'<div class="ps-pause-k">Au maintien : '+lib(k.on.kcal)+' les jours d’entraînement, '+lib(k.off.kcal)+' les jours de repos. Protéines et lipides ne changent pas.</div>'
    +'<label class="ps-rdv">Durée : <select id="ps-pause-j" aria-label="Durée de la pause">'
      +PAUSE_FATIGUE_JOURS.map(j=>'<option value="'+j+'"'+(j===PAUSE_FATIGUE_DEFAUT?' selected':'')+'>'+j+' jours</option>').join('')+'</select></label>'
    +'<div class="ps-btns"><button type="button" class="btn btn-red btn-sm" onclick="appliquerPauseFatigue(document.getElementById(\'ps-pause-j\').value)">Je fais la pause</button>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="pointSemaineDecider(\'garde\')">Pas maintenant</button></div>'
    +'</div>';
}
// Côté coach : les quatre réponses sur 14 jours, même courbe pour chacune, et
// le niveau de fatigue quand il parle (sous aTCA aussi : c'est à lui).
function _htmlCheckinCoachDetail(c,t){
  const l=(c&&c.checkin)||{};
  const fin=localISODate(new Date(t));
  const rangs=CHECKIN_QUESTIONS.map(q=>{
    const v=[];
    for(let k=13;k>=0;k--){ const j=_jourPlus(fin,-k), x=l[j]; v.push({j,n:(checkinComplet(x)&&_ciNote(x[q.cle]))?_ciNote(x[q.cle]):null}); }
    const faits=v.filter(x=>x.n!=null);
    const moy=faits.length?Math.round(faits.reduce((a,x)=>a+x.n,0)/faits.length*10)/10:null;
    return '<div class="ci-coach-q"><span class="ci-coach-ql">'+escapeHtml(q.cle==='faim'?'Faim':q.lib)
      +'<em>'+(moy==null?'-':String(moy).replace('.',',')+'/5')+'</em></span>'
      +'<span class="ci-coach-mini" role="img" aria-label="'+escapeHtml((q.cle==='faim'?'Faim':q.lib)+' sur 14 jours'+(moy==null?'':', moyenne '+moy+' sur 5'))+'">'
      +v.map(x=>'<i title="'+escapeHtml(x.j+(x.n==null?' : pas de réponse':' : '+x.n+'/5'))+'" style="height:'+(x.n==null?4:x.n*20)+'%"'+(x.n==null?' class="vide"':'')+'></i>').join('')
      +'</span></div>';
  }).join('');
  let niv=0; try{ niv=fatigueDiete(l,phaseCourante(c),t); }catch(e){ niv=0; }
  const fat=niv>=3?'Faim haute et énergie basse sur 14 jours, en sèche : une pause diététique au maintien est à envisager.'
    :niv===2?'Faim haute sur 14 jours, en sèche : à regarder avant de baisser quoi que ce soit.':'';
  return '<div class="ci-coach-detail">'+rangs+'</div>'+(fat?'<div class="ci-coach-fat">'+escapeHtml(fat)+'</div>':'');
}

function renderBatterieCoach(c){
  const z=document.getElementById('ccd-batterie');
  if(!z) return;
  let h=''; try{ h=_htmlBatterieCoach(c); }catch(e){ h=''; }
  z.innerHTML=h; z.style.display=h?'':'none';
}

// ══ LA REPRISE EN DOUCEUR (J+30) ════════════════════════════════════════
// Un mois sans séance : l'app PROPOSE de baisser de 10 % les charges de la
// prochaine séance. Jamais automatique : l'athlète choisit (u._repriseDouce).
// Accepté, la prochaine séance part en DÉCHARGE (woState.deload, la logique
// existante : bandeau, hors détection de plateau) et ses charges suggérées
// sont décotées de 10 % — sans cumuler avec la décote de reprise existante
// (decoteReprise) : la plus forte des deux s'applique. La séance suivante la
// consomme (sa date dépasse celle du choix).
const REPRISE_DOUCE_J=30, REPRISE_DOUCE_FACTEUR=0.9;
function derniereSeanceDate(u){
  let m=0;
  for(const s of ((u&&u.sessions)||[])){ const d=Number(s&&s.date); if(d>m) m=d; }
  return m;
}
/** PURE. Jours entiers sans séance, ou -1 sans historique. */
function joursSansSeance(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const d=derniereSeanceDate(u);
  if(!d) return -1;
  const a=new Date(d); a.setHours(12,0,0,0);
  const b=new Date(t); b.setHours(12,0,0,0);
  return Math.round((b-a)/864e5);
}
/** PURE. Le tonnage cumulé de toutes les séances (kg). */
function tonnageTotalDe(u){
  let v=0;
  for(const s of ((u&&u.sessions)||[])) v+=Math.max(0,Number(s&&s.volume)||0);
  return Math.round(v);
}
/** PURE. Faut-il proposer la reprise en douceur ? */
function repriseDouceAProposer(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach') return false;
  if(u.suspension&&u.suspension.actif) return false;
  try{ if(suspensionEtat(u).actif) return false; }catch(e){}
  if(joursSansSeance(u,t)<REPRISE_DOUCE_J) return false;
  const r=u._repriseDouce;
  return !(r&&Number(r.depuis)>derniereSeanceDate(u));
}
/** PURE. La baisse acceptée attend-elle sa séance ? */
function repriseDouceActive(u){
  const r=u&&u._repriseDouce;
  return !!(r&&r.accepte&&Number(r.depuis)>derniereSeanceDate(u));
}
function htmlRepriseDouce(u,maintenant){
  const n=joursSansSeance(u,maintenant);
  return '<div class="rd-carte" role="region" aria-label="Reprise en douceur">'
    +'<div class="eyebrow eyebrow-act">Reprise en douceur</div>'
    +'<p class="rd-txt">Ta dernière séance date de '+n+' jours. On te propose de baisser de <b>10 %</b> les charges de ta prochaine séance : '
    +'elle comptera comme une décharge, et tu repars sur de bonnes bases. C’est toi qui décides.</p>'
    +'<div class="rd-actions"><button type="button" class="btn btn-red btn-sm" onclick="repriseDouceChoisir(true)">Baisser de 10 %</button>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="repriseDouceChoisir(false)">Garder mes charges</button></div></div>';
}
function _afficherRepriseDouce(u){
  const z=document.getElementById('clh-reprise-douce');
  if(!z) return false;
  let on=false; try{ on=repriseDouceAProposer(u); }catch(e){ on=false; }
  z.innerHTML=on?htmlRepriseDouce(u):'';
  return on;
}
function repriseDouceChoisir(oui){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  u._repriseDouce={depuis:Date.now(),accepte:!!oui};
  saveUserOuDire('Ton choix de reprise');
  try{ _afficherRepriseDouce(u); }catch(e){}
  try{ document.getElementById('rd-ecran')?.remove(); }catch(e){}
  try{ toast(oui?'C’est noté : ta prochaine séance part 10 % plus légère '+ICO.coche:'C’est noté : tes charges restent les mêmes '+ICO.coche); }catch(e){}
  return true;
}
// L'écran ouvert par la notification du 30e jour (./?reprise=1).
function ouvrirRepriseDouce(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!repriseDouceAProposer(u)) return false;
  document.getElementById('rd-ecran')?.remove();
  const z=document.createElement('div');
  z.id='rd-ecran'; z.className='rd-ecran';
  z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true'); z.setAttribute('aria-label','Reprise en douceur');
  z.innerHTML='<div class="rd-boite">'+htmlRepriseDouce(u)+'</div>';
  z.addEventListener('click',e=>{ if(e.target===z) z.remove(); });
  document.body.appendChild(z);
  return true;
}

// ══ RETOUR AU COMBAT (1re séance après 14 jours ou plus) ════════════════
// 10 jours jusqu'au 02/10/2026 ; 14 désormais, la même période que le bonus
// de volts « retour » (+50 V, xpCalcul, cat.retour : une fois par période,
// recalculé depuis l'historique, borné par le serveur).
// Un écran plein dans la file des célébrations (le médaillon RETURN), avec
// la quête de PHÉNIX NOIR : revenir après 30 jours d'arrêt, puis valider 4
// semaines d'affilée à partir de la semaine du retour (_badgesFaits).
const RETOUR_COMBAT_J=14, PHENIX_ARRET_J=30, PHENIX_SEMAINES=4;
/** PURE. Le retour que marque la séance `sess`, ou null. */
function retourAuCombat(u,sess){
  const d=Number(sess&&sess.date);
  if(!u||!(d>0)) return null;
  let prev=0;
  for(const s of (u.sessions||[])){ const x=Number(s&&s.date); if(x<d&&x>prev) prev=x; }
  if(!prev) return null;
  const a=new Date(prev); a.setHours(12,0,0,0);
  const b=new Date(d); b.setHours(12,0,0,0);
  const jours=Math.round((b-a)/864e5);
  if(jours<RETOUR_COMBAT_J) return null;
  const eligible=jours>=PHENIX_ARRET_J;
  let faites=0;
  if(eligible){
    try{
      const f=_badgesFaits(u,Math.max(d,Date.now()));
      const l0=_lundiDe(d).getTime();
      for(let k=0;k<PHENIX_SEMAINES;k++){
        const lk=_lundiDe(l0+k*7*864e5+12*36e5).getTime();
        if(f.semaines.some(v=>{ try{ return _lundiDe(v).getTime()===lk; }catch(e){ return false; } })) faites++;
        else break;
      }
    }catch(e){ faites=0; }
  }
  return {jours,eligible,faites,reste:PHENIX_SEMAINES-faites};
}
/** PURE. La ligne de la quête. */
function textePhenixNoir(r){
  if(!r) return '';
  if(!r.eligible) return 'PHÉNIX NOIR se gagne en revenant après '+PHENIX_ARRET_J+' jours d’arrêt, puis '+PHENIX_SEMAINES+' semaines validées d’affilée.';
  if(r.reste<=0) return 'PHÉNIX NOIR est à toi.';
  return 'PHÉNIX NOIR : encore '+r.reste+' semaine'+(r.reste>1?'s':'')+' à valider.';
}
function _retourEcran(r,reste){
  const z=_bdgCouche(
    '<div class="bdg-ecran-txt rc-retour">'
    +'<div class="bdg-ecran-sur">'+r.jours+' JOURS SANS SÉANCE</div>'
    +'<div class="bdg-ecran-img" id="rc-retour-img"><img src="'+escapeHtml(_badgeFichier('RETURN'))+'" alt=""></div>'
    +'<div class="bdg-ecran-nom">RETOUR AU COMBAT</div>'
    +'<p class="bdg-ecran-cond">Tu es revenu. C’est la séance la plus difficile, et elle est faite.</p>'
    +'<p class="bdg-ecran-cond rc-retour-v"><b>+'+XP_ACTIONS.retour+' V</b> · retour</p>'
    +'<div class="rc-phenix"><div class="rc-phenix-cases" aria-hidden="true">'
      +Array.from({length:PHENIX_SEMAINES},(_,i)=>'<i'+(i<r.faites?' class="on"':'')+'></i>').join('')+'</div>'
      +'<div class="rc-phenix-txt">'+escapeHtml(textePhenixNoir(r))+'</div></div>'
    +'<button type="button" class="btn btn-outline btn-sm bdg-ecran-tard" onclick="bdgPlusTard()">'
      +(reste||_bdgRecap.length?'Suivant':'Continuer')+'</button>'
    +'</div>','Retour au combat');
  try{ _bdgFoudre(z.querySelector('#rc-retour-img'),{eclairs:2,conteneur:z}); }catch(e){}
  try{ arcHaptique('succes'); }catch(e){}
  return z;
}
function _celebrerRetour(r){
  if(!r) return;
  _bdgFile.push({retour:r});
  _bdgPlanifier();
}

// ── Tonnage hebdomadaire ──────────────────────────────────────────────────
// Le tonnage ne dépend PAS du RIR : une séance mal renseignée en est donc
// exclue du record d'e1RM, mais compte ici entièrement.
function tonnageSemaine(user,decalageSemaines){
  const res={kg:0,nSeances:0};
  const lundi=_lundiDeSemaine(_volCleDecalee(decalageSemaines||0));
  if(!lundi||!user||!Array.isArray(user.sessions)) return res;
  const debut=lundi.getTime(), fin=debut+7*86400000;
  for(const sess of user.sessions){
    if(!sess||!sess.data) continue;
    const t=sess.date;
    if(!(t>=debut&&t<fin)) continue;
    res.nSeances++;
    for(const nom of Object.keys(sess.data)){
      const d=sess.data[nom];
      if(!d||!Array.isArray(d.sets)||!d.sets.length) continue;
      // reps forcée en chaîne par précaution : parseReps sait lire un nombre,
      // mais isCardio fait .toLowerCase() sans garde et a déjà vidé l'écran
      // Volume deux fois. On normalise à la source plutôt que de parier sur
      // le chemin emprunté par les aides qui recevront cet ex.
      const ex={name:nom,reps:String((d.sets[0]&&d.sets[0].reps)||''),
        methode:d.methode,technique:d.technique};
      for(const s of d.sets) res.kg+=tonnageSerie(s,ex);
    }
  }
  res.kg=Math.round(res.kg);
  return res;
}

// ── RIR moyen d'une séance ────────────────────────────────────────────────
// Une série SANS RIR est exclue, jamais comptée 0 : la compter zéro
// transformerait un oubli de saisie en série menée à l'échec.
function rirMoyenSeance(sess){
  let somme=0,n=0,total=0;
  for(const nom of Object.keys((sess&&sess.data)||{})){
    const d=sess.data[nom];
    if(!d||!Array.isArray(d.sets)) continue;
    for(const s of d.sets){
      if(!s||s.done!==true) continue;
      total++;
      if(s.rir===''||s.rir==null) continue;
      somme+=(s.rir==='echec')?0:(parseInt(s.rir,10)||0);
      n++;
    }
  }
  if(!n) return null;
  return {moyenne:Math.round(somme/n*100)/100,nRenseignees:n,nTotal:total};
}

// ── Prescrit contre réalisé ───────────────────────────────────────────────
// « Sur 7 jours » = la semaine ISO courante, ce que la fiche coach appelle
// déjà « Volume 7 jours ». Le calendrier n'est pas réimplémenté.
function ecartPrescritRealise(user){
  const out=[];
  if(!user) return out;
  // B3.13 — LA SEMAINE EFFECTIVE, ET NON LE GABARIT.
  //
  // La comparaison portait sur volumePrescrit(user.sessions_config) : ce qui
  // etait prevu EN GENERAL, jamais ce qui etait prevu CETTE SEMAINE-LA. Tant
  // que `ecarts` restait vide, les deux coincidaient — mais une semaine de
  // decharge etait deja comparee a une semaine pleine, et l'ecart affiche au
  // coach disait « il en a fait 40 % de moins » d'un athlete qui avait fait
  // exactement ce qu'on lui demandait. Depuis que le bloc se periodise (B3.2),
  // ce chiffre serait faux toutes les semaines qui portent un ecart.
  //
  // getSemaineEffective EXISTE PRECISEMENT POUR CELA, et elle est PURE.
  //
  // ET UN ATHLETE SANS BLOC DATE NE PERD RIEN : sans programme, on retombe sur
  // le gabarit, exactement comme avant.
  const pres=(function(){
    try{ return volumePrescritSemaine(user,new Date()); }
    catch(e){ return {muscles:{}}; }
  })();
  const c=(function(){ try{ return _calculSemaine(user,_volCleDecalee(0)); }
    catch(e){ return {muscles:{}}; } })();
  const noms={};
  Object.keys(pres.muscles||{}).forEach(m=>{noms[m]=1;});
  Object.keys(c.muscles||{}).forEach(m=>{noms[m]=1;});
  Object.keys(noms).forEach(m=>{
    const p=(pres.muscles||{})[m]||0, r=(c.muscles||{})[m]||0;
    if(!(p>0)&&!(r>0)) return;
    out.push({muscle:m,prescrit:Math.round(p*10)/10,realise:Math.round(r*10)/10,
      // Sans prescription, aucune part : on ne divise pas par zéro pour
      // annoncer un dépassement infini.
      part:p>0?Math.round(r/p*100)/100:null});
  });
  out.sort((a,b)=>(a.part==null?99:a.part)-(b.part==null?99:b.part));
  return out;
}

// ── Nouveau record, au moment de valider une série ────────────────────────
// La comparaison porte sur les séances PASSÉES : la séance en cours n'est pas
// encore dans user.sessions, il n'y a donc rien à en retrancher. Le drapeau
// vit dans un Set de module et JAMAIS sur la série : woState.sessionData est
// enregistré tel quel en fin de séance, et un champ posé là serait persisté.
let _recordsVus=new Set();
// Les records déjà foudroyés dans cette séance (clés idx:i, comme _recordsVus).
let _foudresJouees=new Set();
function _resetRecordsVus(){ _recordsVus=new Set(); _foudresJouees=new Set(); }
// OUBLIE LES RECORDS D'UN SEUL EXERCICE, par sa POSITION. Appelée quand un
// mouvement est remplacé en cours de séance : ses séries sont reconstruites à
// vide, mais les clés `idx:i` survivraient et _badgeRecord — rendu sans
// condition — recollerait « RECORD » sur les séries vides du nouveau.
//
// LE DEUX-POINTS EST DANS LE PRÉFIXE, et il compte : sans lui, purger
// l'exercice 1 emporterait aussi les clés de l'exercice 10.
function _oublierRecordsExo(idx){
  const pre=idx+':';
  for(const k of Array.from(_recordsVus))
    if(String(k).indexOf(pre)===0) _recordsVus.delete(k);
  for(const k of Array.from(_foudresJouees))
    if(String(k).indexOf(pre)===0) _foudresJouees.delete(k);
}
// UNE SEANCE REPRISE RETROUVE SES BADGES. Ils ne sont pas dans l'instantane
// — le drapeau vit dans un Set de module et JAMAIS sur la serie, puisque
// sessionData est enregistre tel quel en fin de seance. Ils se RECALCULENT :
// estNouveauRecord compare aux seances PASSEES, et celle en cours n'est pas
// encore dans user.sessions. Le verdict est donc le meme qu'au moment de la
// validation. Sans cette reconstruction, une seance reprise apres un
// rechargement n'affichait plus aucun record, y compris la ou il y en avait.
function _rebatirRecordsVus(){
  _resetRecordsVus();
  try{
    const exs=(woState&&woState.exercises)||[];
    const d=(woState&&woState.sessionData)||{};
    for(const k of Object.keys(d)){
      const nom=(exs[parseInt(k,10)]||{}).name;
      if(!nom) continue;
      const sets=(d[k]&&d[k].sets)||[];
      // estNouveauRecord ecarte deja les series non validees.
      for(let i=0;i<sets.length;i++)
        if(estNouveauRecord(currentUser,nom,sets[i])) _recordsVus.add(k+':'+i);
    }
  }catch(e){}
}
function estNouveauRecord(user,nomEx,serie){
  if(!user||!nomEx||!serie||serie.done!==true) return false;
  const _ex=_exPourCharge(nomEx,user), _t=typeCharge(_ex);
  const w=parseFloat(serie.weight)||0;
  const eff=chargeEffective(serie,_ex,user);
  if(!(w>0)&&!(eff>0)) return false;
  const r=_perfReps(serie);
  const rec=recordsExercice(user,nomEx);
  if(!rec) return true;                    // premier record de cet exercice
  const mc=rec.meilleureCharge, me=rec.meilleurE1rm;
  // Assisté : moins d'assistance, ou autant avec plus de répétitions.
  if(_t==='assiste'){ if(mc&&w>0&&r>0&&(w<mc.kg||(w===mc.kg&&r>(mc.reps||0)))) return true; }
  else if(mc&&w>mc.kg) return true;
  // ⚠ SANS RIR, PAS D'e1RM (30/09/2026), comme dans recordsExercice : un RIR
  //   vide y vaut « à l'échec », et une série RIR-less à charge ÉGALE passait
  //   pour un record e1RM à chaque fois — les séries validées sans RIR sont
  //   devenues le chemin court (charge recopiée, RIR en option après le ✓).
  const _sansRir=(serie.rir===''||serie.rir==null);
  if(!_sansRir&&r>0&&eff>0&&e1rmFiable(r,_perfRir(serie,user))){
    const v=e1rm(eff,r,_perfRir(serie,user));
    if(v>0&&(!me||v>me.valeur)) return true;
  }
  return !mc&&!me;
}
function _marquerRecordSiBesoin(idx,i){
  try{
    const ex=(woState.exercises||[])[idx];
    const d=woState.sessionData[idx];
    if(!ex||!d||!d.sets[i]) return;
    if(estNouveauRecord(currentUser,ex.name,d.sets[i])) _recordsVus.add(idx+':'+i);
  }catch(e){}
}
function _badgeRecord(idx,i){
  return _recordsVus.has(idx+':'+i)
    ? `<span title="Nouveau record" style="display:inline-block;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.4px;color:var(--red-text);background:var(--red-bg-2);border:1px solid color-mix(in srgb,var(--red) 60%,transparent);border-radius:var(--r-1);padding:0 4px;margin-left:4px;white-space:nowrap;--halo-c:color-mix(in srgb,var(--red) 50%,transparent);text-shadow:var(--halo-1)">RECORD</span>`
    : '';
}

// PURE. Le volume que le programme PREVOIT pour la semaine de `date`, en
// ENTIER : la semaine effective du bloc — decharge et ecarts compris —, ou le
// gabarit quand l'athlete n'a pas de bloc date. L'ecart prescrit / realise le
// lit : lui compare bien UNE semaine a ce qui y a ete fait.
function volumePrescritSemaine(user,date){
  let w=null;
  try{ w=getSemaineEffective(user,date||new Date()); }catch(e){ w=null; }
  if(w&&Array.isArray(w.creneaux)) return Object.assign(volumePrescrit(w.creneaux,user),{semaine:w,source:'bloc'});
  return Object.assign(volumePrescrit((user&&user.sessions_config)||[],user),{semaine:null,source:'gabarit'});
}
// PURE. Le volume que prevoit TOUT LE PROGRAMME : chacune de ses semaines —
// ecarts et decharges compris —, additionnees (`total`), puis ramenees a la
// semaine (`muscles`). La teinte de la silhouette « Evolution eleve » le lit.
//
// ⚠ RAMENE A LA SEMAINE, ET C'EST VOULU. Les reperes MEV/MAV/MRV, dont les
//   zones colorent la silhouette (build 1397), sont hebdomadaires : un total
//   brut de huit semaines passerait le MRV partout, et la silhouette sortirait
//   toute rouge. La moyenne garde la repartition du total, et le total reste
//   dit en toutes lettres sous le doigt.
// SANS BLOC DATE, le programme est son gabarit : une semaine type, entiere.
function volumePrescritProgramme(user){
  const p=programmeDe(user);
  const total={};
  let semaines=0, avec=0, sans=0, nonR=0;
  if(p) for(let i=0;i<p.semaines;i++){
    let w=null;
    try{ w=getSemaineEffective(user,_datePlusJours(p.debut,i*7)); }catch(e){ w=null; }
    if(!w||!Array.isArray(w.creneaux)) continue;
    const v=volumePrescrit(w.creneaux,user);
    semaines++;
    for(const m in v.muscles) total[m]=(total[m]||0)+v.muscles[m];
    avec+=v.avecConsigne||0; sans+=v.sansConsigne||0; nonR+=v.nonRattaches||0;
  }
  if(!semaines){
    const v=volumePrescrit((user&&user.sessions_config)||[],user);
    return Object.assign(v,{total:Object.assign({},v.muscles),semaines:1,decharges:0,source:'gabarit'});
  }
  const muscles={};
  for(const m in total) muscles[m]=total[m]/semaines;
  return {muscles,total,semaines,decharges:p?p.decharges.length:0,
    avecConsigne:avec,sansConsigne:sans,nonRattaches:nonR,source:'bloc'};
}
function volumePrescrit(cfg,user){
  const out={muscles:{},nonRattaches:0,avecConsigne:0,sansConsigne:0};
  for(const s of (cfg||[])){
    if(!s||!s.active||!Array.isArray(s.exercises)) continue;
    for(const ex of s.exercises){
      if(!ex||!ex.name||isCardio(ex)) continue;
      const cls=resoudreMusclesLecture(ex.name,ex,user);
      const nb=Math.max(0,parseInt(ex.series)||0);
      if(!nb) continue;
      if(!cls||cls===VOL_CARDIO){ if(!cls) out.nonRattaches+=nb; continue; }
      // B3.8 — L'INTENSITE PRESCRITE COMPTE, QUAND ELLE EST PRESCRITE.
      // poidsIntensite lit `rir` ; _rirPrescrit sait aussi lire `rirCible`,
      // l'ancien champ. On lui passe donc ce qu'il a resolu, ce qui evite de
      // rater une consigne ecrite avant le lot qui a change de champ.
      const _r=_rirPrescrit(ex);
      const pi=poidsIntensite({rir:_r===''?null:_r});
      if(_r!=='') out.avecConsigne=(out.avecConsigne||0)+nb;
      else out.sansConsigne=(out.sansConsigne||0)+nb;
      for(const m of (cls.p||[])) out.muscles[m]=(out.muscles[m]||0)+nb*pi*POIDS_ROLE.PRIMAIRE;
      for(const m of (cls.s||[])) out.muscles[m]=(out.muscles[m]||0)+nb*pi*poidsSecondaire(user);
    }
  }
  return out;
}
// N6.11 — PURE. Les series de poussee et de tirage d'un programme prescrit.
// MEME PARCOURS QUE volumePrescrit : creneaux ACTIFS, cardio ecarte, series
// entieres et positives. Deux fonctions qui compteraient differemment
// finiraient par ne plus dire la meme chose du meme programme.
// LES NON RESOLUS NE COMPTENT NI AU NUMERATEUR NI AU DENOMINATEUR, et leur
// nombre est annonce : c'est la discipline que volumePrescrit tient deja pour
// ses series non rattachees.
const SCHEMAS_POUSSEE=Object.freeze(['poussee-verticale','poussee-horizontale']);
const SCHEMAS_TIRAGE=Object.freeze(['tirage-vertical','tirage-horizontal']);
function ratioPousseeTirage(cfg,user){
  let poussee=0,tirage=0,horsSchema=0;
  for(const s of (cfg||[])){
    if(!s||!s.active||!Array.isArray(s.exercises)) continue;
    for(const ex of s.exercises){
      if(!ex||!ex.name||isCardio(ex)) continue;
      const nb=Math.max(0,parseInt(ex.series)||0);
      if(!nb) continue;
      let sc=null; try{ sc=schemaDe(ex,user); }catch(e){ sc=null; }
      if(SCHEMAS_POUSSEE.indexOf(sc)>=0) poussee+=nb;
      else if(SCHEMAS_TIRAGE.indexOf(sc)>=0) tirage+=nb;
      else horsSchema+=nb;
    }
  }
  // AUCUN EXERCICE CLASSE : rien plutot qu'un rapport de zero. Un programme
  // entierement compose d'exercices inconnus ne dit rien sur l'equilibre.
  if(!poussee&&!tirage) return null;
  return {poussee,tirage,horsSchema,
          // Le rapport n'existe que si les deux cotes existent : diviser par
          // zero rendrait l'infini, et « poussee seule » se lit deja aux deux
          // nombres ecrits a cote.
          ratio:tirage?Math.round(poussee/tirage*100)/100:null};
}
// B3.7 — LA BANDE OU RIEN NE SE DIT.
//
// Le coach lisait « 1,4 » sans savoir si c'etait acceptable. Meme traitement
// que lectureChargeHebdo : une bande centrale silencieuse, un mot quand on en
// sort, dans un sens comme dans l'autre.
//
// 0,8 A 1,3, ET LE SEUIL EST ASSUME. L'equilibre de reference en musculature
// du haut du corps est 1:1 — autant de series de tirage que de poussee — et la
// pratique tolere une legere dominante de poussee, d'ou la bande dissymetrique.
// En sortir dans un sens ou dans l'autre est un choix qui se defend ; ne pas
// le SAVOIR n'en est pas un.
const PT_BANDE_BAS=0.8, PT_BANDE_HAUT=1.3;
// PURE. Rend '' dans la bande, un mot en dehors, '' si le rapport n'existe pas.
function lectureRatioPousseeTirage(ratio){
  if(ratio==null||!isFinite(ratio)) return '';
  if(ratio>PT_BANDE_HAUT) return 'poussée dominante';
  if(ratio<PT_BANDE_BAS) return 'tirage dominant';
  return '';
}
function _htmlRatioPousseeTirage(cfg,user){
  const r=ratioPousseeTirage(cfg,user);
  if(!r) return '';
  const nb=v=>String(v).replace('.',',');
  const mot=lectureRatioPousseeTirage(r.ratio);
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
      <span style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;text-transform:uppercase;font-weight:800">Poussée / tirage</span>
      <span style="font-size:var(--fs-xs);color:var(--text-strong);white-space:nowrap">${r.ratio!=null?nb(r.ratio):'-'}${mot?`<span style="color:var(--orange)"> · ${mot}</span>`:''} · ${r.poussee} / ${r.tirage} séries</span>
    </div>
    ${r.horsSchema?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">${r.horsSchema} série${r.horsSchema>1?'s':''} sur exercice au schéma non résolu, hors du compte.</div>`:''}
  </div>`;
}
function renderVolumePrescrit(cfg,user){
  const z=document.getElementById('csm-volume');
  if(!z) return;
  const u=user||_coachEditClient||currentUser;
  const v=volumePrescrit(cfg,u);
  const lignes=Object.keys(v.muscles).filter(m=>v.muscles[m]>=0.5)
    .sort((a,b)=>v.muscles[b]-v.muscles[a]);
  if(!lignes.length){ z.innerHTML=''; return; }
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:4px">Volume prescrit</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-bottom:10px;line-height:1.5">
      ${v.avecConsigne
        ? (v.sansConsigne
            ? 'Séries programmées sur les créneaux actifs, pondérées par l’intensité que tu as prescrite. '
              +v.sansConsigne+' série'+(v.sansConsigne>1?'s':'')+' sans consigne comptent pour un maximum.'
            : 'Séries programmées sur les créneaux actifs, pondérées par l’intensité que tu as prescrite.')
        : 'Séries programmées sur les créneaux actifs. Aucune intensité n’est prescrite : c’est un maximum, le volume réellement dur sera au plus égal.'}
    </div>
    ${lignes.map(m=>{
      // ⚠ LA CARTE DE L'ATHLÈTE, PAS UNE SECONDE MISE EN PAGE (01/10/2026).
      //   Kevin : « fais cette partie comme celle de l'athlète avec les
      //   images ». Mêmes classes que renderVolume (.vc, .vc-illus, .vb) :
      //   l'illustration du muscle, son nom à sa couleur, la barre et le
      //   statut avec son icône. Le coach lit son programme comme l'athlète
      //   lira sa semaine.
      const n=v.muscles[m];
      const rep=reperesEffectifs(u,m);
      const zo=zoneVolume(n,rep,u);
      const illus=_volIllus(m);
      const mc=(MUSCLES[m]||{}).c||'var(--text)';
      const _s=(rep&&rep.source)||'table';
      const src=_s==='table'?'':`<span style="font-weight:400;color:var(--text-faint);font-size:var(--fs-2xs)"> · ${_s==='perso'?'ajusté sur ses retours':'fixé par toi'}</span>`;
      return `<div class="vc${illus?'':' vc-sans-illus'}" data-muscle="${m}" style="--vc-c:${zo?zo.c:'#3a3a3a'}">
      ${illus?`<img class="vc-illus" src="${illus}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:''}
      <div class="vc-corps">
        <div class="vc-tete">
          <span class="vc-nom" style="color:${mc}">${(MUSCLES[m]||{}).lib||m}${src}</span>
          <span class="vc-chiffres"><span class="vc-series">${volAffiche(n)} série${n>=2?'s':''}</span></span>
        </div>
        ${_volBarre(m,n,rep,false,u)}
        <div class="vc-zone" style="color:${zo?zo.c:'var(--text-faint)'}">
          ${_volIconeZone(zo)}<span>${zo?zo.lib:'pas de repère établi'}</span>
        </div>
      </div>
    </div>`;}).join('')}
    ${(()=>{ try{ return _htmlRatioPousseeTirage(cfg,u); }catch(e){ return ''; } })()}
    ${v.nonRattaches?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">${v.nonRattaches} série${v.nonRattaches>1?'s':''} sur exercice non classé</div>`:''}
  </div>`;  // Le remplissage des barres : posé à width:0, il attend _animerJauges, comme
  // chez l'athlète. Sans cet appel, la barre restait vide et seul le trait de
  // repère se voyait.
  try{
    z.querySelectorAll('.rc-barre').forEach((b,k)=>b.style.setProperty('--rcv-d',Math.min(k,8)*40+'ms'));
    _animerJauges(z);
  }catch(e){}
}

// ══ R20 — ÉVOLUTION ROUVRE SUR LE DERNIER ONGLET ═══════════════════════
// Les sept onglets, dans l'ordre de la bande. Un nom hors de cette liste n'est
// ni memorise ni restaure.
const PROG_ONGLETS=Object.freeze(['poids','mensus','masseGrasse','perf','volume','photos','notes']);
// Le bouton de la bande qui porte cet onglet — et non plus « le premier ».
function _progBoutonOnglet(tab){
  return [...document.querySelectorAll('#prog-tabs button')]
    .find(b=>(b.getAttribute('onclick')||'').indexOf("showProgressTab('"+tab+"'")===0)||null;
}
// Une photo de bilan, sous toutes les clefs ou elle a pu etre rangee. Sortie
// de showProgressTab pour que _progOngletVide lise EXACTEMENT la meme chose.
function _progPhotoBilan(b,t){
  // DELEGUE, PLUS RECOPIE. Cette fonction existait deja pour que deux lecteurs
  // lisent EXACTEMENT la meme chose ; depuis le build 1421, la reference neuve
  // {cle,w,h,url} est un cinquieme rangement, et photoBilanSrc est le seul
  // endroit qui les connaisse tous.
  return photoBilanSrc(b,t);
}
// PURE (a la lecture du stockage local pres, pour les photos). Cet onglet
// s'ouvrirait-il sur un etat vide ? Les conditions sont CELLES de
// showProgressTab et de renderVolume, recopiees branche par branche — une
// assertion rend chaque onglet et verifie que les deux disent la meme chose.
function _progOngletVide(tab,u){
  u=u||{};
  // ⚠ UN ONGLET VERROUILLE N'EST PAS VIDE (lot 4) : il porte la phrase du
  //   verrou et son bouton. Le dire vide ferait proposer par-dessus un geste
  //   qui ne mene nulle part, et les deux se disputeraient le meme espace.
  try{ if(rcVerrou(tab==='volume'?'volume':(tab==='perf'?'perfs1rm':''),u)) return false; }catch(e){}
  const bl=bilansOrdonnes(u);
  if(tab==='poids') return !bl.length&&!(u.weightLog||[]).length;
  if(tab==='mensus') return !bl.length;
  // Une masse grasse MESURÉE (synchronisée ou saisie) suffit à remplir l'onglet.
  if(tab==='masseGrasse') return !bl.length&&!(((currentUser||{}).masseGrasseLog)||[]).length;
  // « Notes » a DEUX etats vides : aucun bilan, ou des bilans sans aucune
  // reponse ecrite — renderReponsesBilans rend alors son propre etat vide.
  // Memes filtres, memes questions, meme lecture de la reponse.
  if(tab==='notes'){
    return !bl.filter(b=>b&&b.date).some(b=>
      (b.type==='depart'?BILAN_QUESTIONS.depart:BILAN_QUESTIONS.suivi).some(q=>_texteReponse(b[q.k])));
  }
  if(tab==='perf') return !(u.sessions||[]).length;
  if(tab==='volume'){
    try{ return !_calculSemaine(u,_volCleDecalee(_volDecalage)).seances; }catch(e){ return false; }
  }
  if(tab==='photos'){
    return !bl.some(b=>['face','back','side'].some(t=>_progPhotoBilan(b,t)));
  }
  return false;
}
// `sansMemo` : le rendu ne change pas le choix memorise. C'est le cas du repli
// de loadProgress, et c'est le seul.
function showProgressTab(tab,btn,sansMemo){
  // R20 — LE CHOIX DE L'ATHLETE EST MEMORISE, ET SEULEMENT QUAND IL CHANGE.
  // saveUser pousse le dossier : le rappeler a chaque rendu — et plusieurs
  // gestes repeignent l'onglet courant (creneau de Perfs, masquer le poids,
  // photos) — lancerait une synchronisation pour rien.
  if(!sansMemo&&currentUser&&PROG_ONGLETS.indexOf(tab)>=0&&currentUser.uiProgressTab!==tab){
    currentUser.uiProgressTab=tab;
    try{ saveUser(); }catch(e){ rcErreurMuette('showProgressTab',e); }
  }
  document.querySelectorAll('#prog-tabs button').forEach(b=>{b.className='btn btn-outline btn-sm';b.style.whiteSpace='nowrap';});
  if(btn){btn.className='btn btn-red btn-sm';btn.style.whiteSpace='nowrap';}
  const c=document.getElementById('progress-content');
  // ══ LE VERROU (lot 4). Les onglets restent tous la, et le choix reste
  // memorise : seule la vue fermee est remplacee. Un onglet qu'on retire de
  // la bande ne se vend pas, il s'oublie.
  const _vrr=rcVerrou(tab==='volume'?'volume':(tab==='perf'?'perfs1rm':''));
  if(_vrr){ c.innerHTML=_vrr; return; }
  // N3.16 — le MEME ordre et le MEME filtre que la fiche du coach.
  const bl=bilansOrdonnes(currentUser);
  const ss=currentUser.sessions||[];
  const bilLabels=bl.map((_,i)=>'Bilan '+(i+1));

  if(tab==='poids'){
    // Métriques, courbe et vitesse viennent désormais de la série FUSIONNÉE
    // (pesées quotidiennes + poids des bilans). Le tableau, lui, reste bilan
    // par bilan : c'est la seule vue qui aligne le poids sur les dates des
    // mensurations, et le mélanger à des pesées quotidiennes le rendrait
    // illisible.
    if(!bl.length&&!(currentUser.weightLog||[]).length){
      // R13 — le geste qui remplit l'onglet, s'il est permis : l'accueil
      // retire la pesee a dessein dans trois cas, voir _peseePossible.
      c.innerHTML=_peseePossible(currentUser)
        ?emptyState('clipboard','Ta courbe de poids part de ta première pesée. Il n\'y en a pas encore.','Noter mon poids','ouvrirPeseeAccueil()')
        // Pesee retiree a dessein : on ne parle pas de poids. Le bilan, lui,
        // reste le geste qui remplit cet ecran.
        :emptyState('clipboard','Ton suivi s\'affichera ici après ton premier bilan.','Remplir mon bilan','openBilanChoice()');
      return;}
    const vals=bl.map(b=>getBW(b));
    c.innerHTML=blocPoids(currentUser)
      +((bl.length&&!currentUser.masquerPoids)?renderDataTable(
        ['',...bilLabels],
        [{label:'Poids (kg)',labelColor:'#bbb',
          values:vals.map(v=>v!==null?v:null)}],
        {stickyCol0:true,firstColMinWidth:'130px',bodyLabelBg:'var(--dark)',
         wrapperStyle:'border-radius:var(--r-3);border:1px solid var(--border);background:var(--dark)',
         pad:'7px 14px',cellBorder:'#141414',cellBorderSide:'bottom',mb:'14px',
         emptyColor:'var(--sub)',valueColor:'var(--text)'}
      ):'');
    c.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el));

  } else if(tab==='mensus'){
    if(!bl.length){c.innerHTML=emptyState('trending-up','Tes mensurations se remplissent pendant le bilan.','Remplir mon bilan','openBilanChoice()');return;}
    // ⚠ LA LISTE A ETE REMONTEE AU NIVEAU MODULE le 20/09/2026, sous le nom
    //   MENS_GROUPES : le schema corporel de la fiche coach trace les memes
    //   groupes, et deux listes auraient fini par montrer deux decoupages du
    //   meme corps selon l'ecran. Rien d'autre n'a bouge ici.
    const GROUPS=MENS_GROUPES;
    // UNE COLONNE. À deux, les cartes de droite sortaient de l'écran sur un
    // téléphone : on ne voyait qu'un tiers de la moitié des courbes.
    let miniCharts='<div style="display:flex;flex-direction:column;gap:12px;margin-top:6px">';
    const groupsToRender=[];
    GROUPS.forEach(g=>{
      const hasData=g.items.some(it=>bl.some(b=>getBM(b,it.k)!==null));
      if(!hasData) return;
      const isGroup=g.items.length>1;
      const mainVals=bl.map(b=>getBM(b,g.items[0].k));
      const filtered=mainVals.filter(v=>v!==null);
      const tracable=g.items.some(it=>bl.filter(b=>getBM(b,it.k)!==null).length>1);
      const diff=filtered.length>1?parseFloat((filtered[filtered.length-1]-filtered[0]).toFixed(1)):null;
      const col=diff===null?'var(--sub)':diff===0?'var(--sub)'
        :diff<0?'var(--green)':'var(--red)';
      // Le filet de gauche prend la couleur de la mesure : c'est ce qui
      // rattache la carte à sa courbe sans avoir à lire le titre.
      // LA CARTE AU DESSIN DE LA COURBE DU POIDS (26/09/2026) : meme en-tete,
      // meme trace — les couleurs des mesures distinguent droite et gauche.
      const _iso=b=>{ try{ return localISODate(new Date(b.date)); }catch(e){ return ''; } };
      const _series=g.items.map(it=>({label:it.l||'Mesure relevée',color:it.color,
        pts:bl.map(b=>({d:_iso(b),v:getBM(b,it.k)})).filter(p=>p.v!==null&&p.d)}));
      const _trace=tracable?_courbeMesures(_series,{unite:'cm',
        couleur:e=>e===0?'var(--sub)':(e<0?'var(--green)':'var(--red)')}):'';
      miniCharts+=`<div class="evo-carte pc-carte pc-carte-m">
        <div class="pc-tete">
          <span class="pc-ico" aria-hidden="true">${_pesIcone('barres')}</span>
          <span class="pc-titre">${g.label}</span>
          ${diff!==null?`<span class="pc-ecart" style="color:${col}">${diff>0?'+':''}${String(diff).replace('.',',')} cm</span>`:''}
        </div>
        ${tracable&&_trace
          ?_trace
          :`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;padding:12px 2px 4px">
             ${bl.length<2
               ?'Une courbe demande deux bilans. Il en manque encore un.'
               :'Cette mesure n’a été relevée qu’une fois, au '+bilLabels[
                  bl.findIndex(b=>g.items.some(it=>getBM(b,it.k)!==null))]
                 +'. Reprends-la au prochain bilan : c’est ce qui dira si elle bouge.'}</div>`}
      </div>`;
      groupsToRender.push(g);
    });
    miniCharts+='</div>';
    c.innerHTML=renderDataTable(
      ['PARTIES MESURÉES',...bilLabels,'ÉCART'],
      MEAS.map(m=>({label:m.l,labelColor:'var(--text-strong)',
        values:bl.map(b=>{const v=getBM(b,m.k);return v!==null?v:null;})
          .concat([(()=>{ try{ return _cellEcartMensuration(bl,m.k); }catch(e){ return null; } })()]),
        // REPORTÉE, DONC GRISE. Elle vaut autant qu'une autre pour lire une
        // stagnation, et rien ne doit la faire passer pour un relevé du jour.
        valueStyleFn:(v,ci,empty)=>ci>=bl.length
          ? (empty?'color:var(--sub);':'color:var(--sub);')
          : (empty?'color:var(--sub);'
            :(bmReportee(bl[ci],m.k)?'color:var(--text-faint);':'color:var(--text);'))})),
      {stickyCol0:true,firstColMinWidth:'130px',bodyLabelBg:'var(--dark)',
       wrapperStyle:'border-radius:var(--r-3);border:1px solid var(--border);background:var(--dark)',
       pad:'7px 14px',cellBorder:'#141414',cellBorderSide:'bottom',mb:'16px',
       emptyColor:'var(--sub)',valueColor:'var(--text)',zebre:true,unite:'cm'}
    )+(bl.some(b=>MEAS.some(m=>bmReportee(b,m.k)))
      ?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin:-10px 0 16px">
         Les valeurs en gris ont été reportées du bilan précédent, sans être
         re-mesurées : rien n’avait bougé.</div>`:'')
    +miniCharts;
    // ⚠ LE SCHEMA CORPOREL PASSE DEVANT LE TABLEAU. C'est la demande de Kevin
    //   du 23/09/2026 : l'athlete ouvre cet onglet pour voir OU son corps a
    //   bouge, et une silhouette repond a cette question en une seconde la ou
    //   un tableau de douze lignes demande d'etre lu. Les chiffres restent
    //   dessous, dans le meme ordre qu'avant.
    //   Le conteneur est POSE AVANT le rendu : renderCorpsAthlete y ecrit puis
    //   peint les calques de zones, ce qu'une chaine HTML ne sait pas faire.
    c.insertAdjacentHTML('afterbegin','<div id="prog-corps"></div>');
    try{ renderCorpsAthlete(document.getElementById('prog-corps')); }catch(e){}
    c.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el));
    // Les courbes sont DEJA dans les cartes (_courbeMesures, du HTML et du
    // SVG) : il ne reste qu'a lancer leur trace, comme celle du poids.
    try{ if(typeof arcTracerCourbes==='function') arcTracerCourbes(c); }catch(e){}

  } else if(tab==='masseGrasse'){
    // LES MESURES (05/10/2026) : masse grasse synchronisée (balance à impédance)
    // ou saisie au bilan. Masquées comme le poids (antécédent, poids masqué).
    const _mgCache=mgMasquee(currentUser);
    const _mesMG=_mgCache?[]:((currentUser.masseGrasseLog)||[]).map(_mgMesure).filter(Boolean).sort((a,b)=>a.date<b.date?-1:1);
    if(!bl.length&&!_mesMG.length){c.innerHTML=emptyState('clipboard','Ta masse grasse se calcule sur les mesures d\'un bilan. Il n\'y en a pas encore.','Remplir mon premier bilan','openBilanChoice()');return;}
    const deb=(currentUser.bilans||[]).find(b=>b.type==='depart');
    const storedH=parseFloat(currentUser._evol_height||deb?.['deb-height']||currentUser['init-height']||0);
    const storedG=currentUser._evol_gender||currentUser.gender||'H';
    const female=isFemale(storedG);
    const bfPcts=bl.map(b=>{
      const waist=getBM(b,'waist'),neck=getBM(b,'neck'),hips=getBM(b,'hips');
      return calcBF(waist,neck,hips,storedH,storedG);
    });
    const mgKgs=bl.map((b,i)=>{const w=getBW(b),p=bfPcts[i];return(p!==null&&w)?Math.round(w*(p/100)*10)/10:null;});
    const mmKgs=bl.map((b,i)=>{const w=getBW(b),mg=mgKgs[i];return(mg!==null&&w)?Math.round((w-mg)*10)/10:null;});
    // LE DÉPART ET L'ACTUEL SE LISENT DANS UNE MÊME MÉTHODE : la dernière valeur
    // (mesure ou estimation, la plus récente) et la première de SA méthode.
    const _isoB=b=>{ try{ return localISODate(new Date(b.date)); }catch(e){ return ''; } };
    const _navyPts=bl.map((b,i)=>({d:_isoB(b),v:bfPcts[i]})).filter(p=>p.v!==null&&p.d)
      .filter(p=>!_mesMG.some(m=>Math.abs(_joursEntre(p.d,m.date))<=MG_FENETRE_JOURS));
    const _mesPts=_mesMG.map(m=>({d:m.date,v:m.pct,type:m.type}));
    const _derN=_navyPts[_navyPts.length-1], _derM=_mesPts[_mesPts.length-1];
    const _methAct=(_derM&&(!_derN||_derM.d>=_derN.d))?'mesure':(_derN?'navy':null);
    const _serieAct=_methAct==='mesure'?_mesPts:_navyPts;
    const valid=_serieAct.map(p=>p.v);
    const fb=valid[0]??null,lb=valid[valid.length-1]??null;
    const diff=fb!==null&&lb!==null?parseFloat((lb-fb).toFixed(1)):null;
    const _libAct=_methAct==='mesure'?libMethodeMG({methode:'mesure',type:_derM.type}):(_methAct?'estimée (US Navy)':'');
    // R33 — l'ecart sous le bruit se dit « stable », en gris : ni vert ni rouge
    // pour un mouvement que la formule ne sait pas distinguer de sa marge.
    const ecartLib=ecartMasseGrasse(diff);
    const col=(diff===null||ecartLib==='stable')?'var(--sub)':(diff<=0?'var(--green)':'var(--red)');
    const missingHeight=!storedH;
    // R33 — LE MESSAGE NOMME CE QUI MANQUE, au DERNIER bilan : c'est lui qui
    // decide s'il y a un chiffre « actuel ». Les bilans plus anciens sans
    // estimation sont cites a part, en une ligne.
    const _der=bl[bl.length-1];
    const msgMesures=(bl.length&&!missingHeight&&bfPcts[bl.length-1]===null&&_methAct!=='mesure')?messageMesuresMasseGrasse(_der,female):null;
    const _ancSans=missingHeight?[]:bl.slice(0,-1).map((b,i)=>bfPcts[i]===null?String(i+1):null).filter(Boolean);
    const msgAnciens=_ancSans.length
      ?'Pas d’estimation '+(_ancSans.length===1?'au bilan '+_ancSans[0]
        :'aux bilans '+_ancSans.slice(0,-1).join(', ')+' et '+_ancSans[_ancSans.length-1])
        +' : une mesure y manquait.'
      :null;
    // LA COURBE AU DESSIN DE CELLES DU POIDS ET DES MENSURATIONS (27/09/2026,
    // Kevin : « comme les précédents graphiques, restylise celui sur le % de
    // masse grasse »). Même en-tête, même tracé SVG, points à la DATE de chaque
    // bilan — et l'ancienne couleur, gardée. L'écart suit R33 : sous la marge
    // de la formule il se dit « stable », en gris.
    // DEUX SÉRIES, JAMAIS RELIÉES (05/10/2026) : l'estimation US Navy aux bilans,
    // et les mesures. Passer de l'une à l'autre n'est pas un mouvement du corps.
    const _couleurMG=e=>(ecartMasseGrasse(e)==='stable')?'var(--sub)':(e<0?'var(--green)':'var(--red)');
    const _seriesMG=[];
    if(_navyPts.length>1) _seriesMG.push({label:'Estimée (US Navy)',color:ROUGE_MARQUE,pts:_navyPts});
    if(_mesPts.length>1) _seriesMG.push({label:'Mesurée ('+(MG_METHODES[_derM.type]||MG_METHODES.impedance).lib+')',color:'#3b82f6',pts:_mesPts});
    const _traceMG=_seriesMG.length?_courbeMesures(_seriesMG,{unite:'%',couleur:_couleurMG}):'';
    const _ecartMG=ecartLib===null?''
      :`<span class="pc-ecart" style="color:${col}">${ecartLib==='stable'?'stable'
        :(diff>0?'+':'')+String(diff).replace('.',',')+' %'}</span>`;
    const _carteCourbeMG=`<div class="evo-carte pc-carte">
        <div class="pc-tete">
          <span class="pc-ico" aria-hidden="true">${_pesIcone('barres')}</span>
          <span class="pc-titre">% de masse grasse corporelle</span>
          ${_ecartMG}
        </div>
        ${_traceMG||`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;padding:12px 2px 4px">${
          !valid.length?'La courbe apparaîtra dès qu’une première estimation sera possible.'
          :_methAct==='mesure'?'Une seule mesure pour l’instant : la courbe en demande deux.'
          :bl.length<2?'Une courbe demande deux bilans. Il en manque encore un.'
          :'Une seule estimation pour l’instant. Reprends tes mesures au prochain bilan : c’est ce qui dira si elle bouge.'}</div>`}
      </div>`;
    // LA CARTE DES DEUX BILANS AU DESSIN DE LA MAQUETTE (27/09/2026, Kevin :
    // « change l'image 1 en 2 »). Chaque bilan a son bandeau rouge avec sa
    // date, l'anneau nomme ce qu'il chiffre (« masse grasse »), MG et MM sont
    // separes d'un filet, et un trait rouge en biais coupe les deux bilans.
    const _dateBil=b=>{ try{ return dateLocaleDeCle(b.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}); }catch(e){ return ''; } };
    const pieSec=(idx,title)=>{
      const mg=mgKgs[idx]??0,mm=mmKgs[idx]??0;
      if(!mg&&!mm) return '';
      const mgC=idx===0?ROUGE_MARQUE:'#3b82f6';
      const kg=v=>String(v)+'<small> kg</small>';
      return `<div class="mgc-col">
        <div class="mgc-tete"><div class="mgc-titre">${title}</div><div class="mgc-date">${_dateBil(bl[idx])}</div></div>
        <canvas id="pie-${idx}" class="mgc-pie"></canvas>
        <div class="mgc-leg">
          <div class="mgc-item"><div class="mgc-nom"><span class="mgc-pt" style="background:${mgC};box-shadow:0 0 8px ${mgC}"></span>MG</div><div class="mgc-val">${kg(mg)}</div></div>
          <div class="mgc-item"><div class="mgc-nom"><span class="mgc-pt" style="background:var(--green);box-shadow:0 0 8px var(--green)"></span>MM</div><div class="mgc-val">${kg(mm)}</div></div>
        </div>
      </div>`;
    };
    const _pie1=bl.length>=1?pieSec(0,'Bilan 1'):'',_pieN=bl.length>1?pieSec(bl.length-1,'Bilan '+bl.length):'';
    const _camemberts=_pie1+(_pie1&&_pieN?'<div class="mgc-eclair" aria-hidden="true"></div>':'')+_pieN;
    c.innerHTML=`
      <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
        <!-- Le titre nommait la METHODE, « Paramètres : Formule US Navy »,              la ou l athlete cherche ce que la carte lui donne. Renomme sur
             demande de Kevin le 21/08/2026. La formule reste nommee deux fois
             plus bas, dans la note de methode et dans le pied de carte : elle
             n est pas escamotee, elle cesse seulement de servir de titre. -->
        <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:10px">Masse graisseuse</div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div style="flex:1;min-width:70px"><label for="evol-height" style="font-size:var(--fs-xs)">Taille (cm)</label><input type="text" inputmode="decimal" id="evol-height" value="${escapeHtml(String(storedH||''))}" placeholder="176" style="padding:8px;font-size:var(--fs-md);font-weight:700;text-align:center"></div>
          <div style="flex:1;min-width:80px">
            <label style="font-size:var(--fs-xs)">Sexe</label>
            <div style="display:flex;gap:4px;margin-top:6px">
              <button onclick="setEvolGender('H')" style="flex:1;padding:10px;border-radius:var(--r-1);border:1px solid ${!female?'var(--red)':'var(--border)'};background:${!female?'#1a0000':'#111'};color:${!female?'var(--red)':'#555'};font-size:var(--fs-md);font-weight:900;cursor:pointer;letter-spacing:1px">H</button>
              <button onclick="setEvolGender('F')" style="flex:1;padding:10px;border-radius:var(--r-1);border:1px solid ${female?'var(--red)':'var(--border)'};background:${female?'#1a0000':'#111'};color:${female?'var(--red)':'#555'};font-size:var(--fs-md);font-weight:900;cursor:pointer;letter-spacing:1px">F</button>
            </div>
          </div>
          <button class="btn btn-red btn-sm" onclick="refreshMG()" style="height:40px;padding:0 16px;align-self:flex-end;letter-spacing:1px">Enregistrer</button>
        </div>
        ${missingHeight?`<div style="margin-top:10px;padding:8px 10px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-2);font-size:var(--fs-xs);color:var(--warning);line-height:1.5">Renseigne ta taille ci-dessus pour calculer ta masse grasse.</div>`:''}
        ${msgMesures?`<div class="mg-manque" style="margin-top:10px;padding:10px 12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);font-size:var(--fs-xs);color:var(--text-strong);line-height:1.55">${escapeHtml(msgMesures)}</div>`:''}
        ${msgAnciens?`<div class="mg-anciens" style="margin-top:8px;font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5">${escapeHtml(msgAnciens)}</div>`:''}
      </div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div class="metric-box"><div class="metric-val">${fb!==null?fb+'%':'-'}</div><div class="metric-label">MG départ</div></div>
        <div class="metric-box"><div class="metric-val">${lb!==null?lb+'%':'-'}</div><div class="metric-label">MG actuel</div><span class="metric-i">${rcInfo('masse_grasse')}</span>${_libAct?`<div class="mg-methode" style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:2px">${escapeHtml(_libAct)}</div>`:''}</div>
        <div class="metric-box"><div class="metric-val" style="color:${col}">${ecartLib!==null?ecartLib:'-'}</div><div class="metric-label">Évolution</div></div>
      </div>
      <!-- R11 : LA NOTE DE METHODE PERMANENTE A ETE RETIREE (Kevin,
           17/09/2026). Elle nommait la formule US Navy, sa marge de 3 a 4
           points, l'erreur plus forte aux extremes et le conseil de lire le
           SENS de l'evolution. RIEN N'EST PERDU : tout cela vit dans la fiche
           « masse_grasse » du lexique, a un doigt, dans le coin de la tuile
           « MG actuel ». L'honnetete sur la fiabilite reste ; c'est sa
           repetition a chaque visite qui disparait. -->
      ${_carteCourbeMG}
      ${_camemberts?`<div class="evo-carte mgc">
        <span class="mgc-coin mgc-coin-hg"></span><span class="mgc-coin mgc-coin-hd"></span>
        <span class="mgc-coin mgc-coin-bg"></span><span class="mgc-coin mgc-coin-bd"></span>
        ${_camemberts}
      </div>`:''}
      ${renderDataTable(
        ['',...bilLabels],
        [
          {label:'% Masse grasse',labelColor:ROUGE_MARQUE,labelBg:'var(--dark)',
            values:bfPcts.map(v=>v!==null?v+'%':null)},
          {label:'Masse grasse (kg)',labelColor:'#f97316',labelBg:'var(--surface-1)',
            values:mgKgs.map(v=>v!==null?v:null)},
          {label:'Masse musculaire (kg)',labelColor:'#22c55e',labelBg:'var(--dark)',
            values:mmKgs.map(v=>v!==null?v:null)},
        ],
        {stickyCol0:true,firstColMinWidth:'130px',bodyLabelBg:'var(--dark)',
         wrapperStyle:'border-radius:var(--r-3);border:1px solid var(--border);background:var(--dark)',
         pad:'7px 14px',cellBorder:'#141414',cellBorderSide:'bottom',mb:'16px',
         emptyColor:'var(--sub)',valueColor:'var(--text)'}
      )}
      <!-- LE PIED DE CARTE A ETE RETIRE le 21/08/2026, sur demande de Kevin.
           Il portait deux lignes centrees : la provenance du pourcentage
          , « Formule US Navy, basee sur tour de cou, tour de taille (et tour
           de hanche chez la femme) + taille », et la derivation des deux
           kilos affiches dans le tableau juste au-dessus : masse grasse =
           poids x (% MG / 100), masse musculaire = poids moins masse grasse.
           CE QUI SUBSISTE, et c est le principal : la formule et sa marge
           d erreur, 3 a 4 points, davantage aux extremes. La note de methode
           qui les portait ici est devenue, en R11, la fiche « masse_grasse »
           du lexique : le ⓘ de la tuile « MG actuel ». -->
    `;
    c.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el));
    // La courbe est DEJA dans la carte (_courbeMesures) : on lance son trace.
    try{ if(typeof arcTracerCourbes==='function') arcTracerCourbes(c); }catch(e){}
    setTimeout(()=>{
      const mg0=mgKgs[0]??0,mm0=mmKgs[0]??0;
      if(mg0&&mm0) drawPie('pie-0',[{val:mg0,color:ROUGE_MARQUE},{val:mm0,color:'#22c55e'}],{label:'Masse grasse',max:170});
      if(bl.length>1){
        const mgL=mgKgs[bl.length-1]??0,mmL=mmKgs[bl.length-1]??0;
        if(mgL&&mmL) drawPie('pie-'+(bl.length-1),[{val:mgL,color:'#3b82f6'},{val:mmL,color:'#22c55e'}],{label:'Masse grasse',max:170});
      }
    },60);

  } else if(tab==='volume'){
    // Onglet Perfs et son graphique de tonnage conserves tels quels : ce
    // sont deux grandeurs differentes, le tonnage et les series dures.
    renderVolume();
  } else if(tab==='perf'){
    // R13 — sur un compte neuf, aucun creneau n'est actif : le geste devient
    // « Préparer mes séances ». Voir _etatVideSeances.
    if(!ss.length){const _g=_etatVideSeances(currentUser);
      c.innerHTML=emptyState('dumbbell','Tes perfs se lisent sur tes séances. Il n\'y en a pas encore.',_g[0],_g[1]);return;}
    const sl=ss.slice(-8);
    let _blocFormePerf='';
    try{ _blocFormePerf=blocForme(currentUser,false); }catch(e){}
    try{ _blocFormePerf+=blocEnergie(currentUser,false); }catch(e){}
    // F-61 : la satisfaction est RENDUE. Encadre distinct, comme l'energie :
    // la fondre dans la forme laisserait croire qu'elle pese sur l'indice.
    try{ _blocFormePerf+=_htmlSatisfaction(currentUser); }catch(e){}
    let _lst=[];
    try{ _lst=_listeEtats(currentUser); }catch(e){ _lst=[]; }
    // R10 — L'ENCADRE PERMANENT DEVIENT UN ⓘ. PERF_ENCADRE redisait sous la
    // liste, a chaque visite, ce que l'e1RM vaut ; l'explication est desormais
    // dans le lexique, a un doigt, a cote du premier « e1RM » de l'ecran.
    // ⚠ LA CONSTANTE N'EST PAS SUPPRIMEE : l'ecran de fin de seance et la carte
    // « Ce qui bloque » la rendent toujours.
    const _iE1rm=_lst.findIndex(x=>/e1RM/.test(PERF_METRIQUE_LIB[x.metrique]||''));
    c.innerHTML=`<div class="metric-row-4" style="margin-bottom:16px">
      <div class="metric-box"><div class="metric-val">${ss.length}</div><div class="metric-label">Total</div></div>
      <div class="metric-box"><div class="metric-val">${streakSemaines(currentUser)}</div><div class="metric-label">Semaines</div></div>
        <div class="metric-box">${htmlTauxCompletion(currentUser,false)}</div>
      <div class="metric-box"><div class="metric-val">${ss.length?Math.round(ss.reduce((s,x)=>s+(x.duration||0),0)/ss.length):0}min</div><div class="metric-label">Durée</div></div>
    </div>
    ${_blocFormePerf}
    <button class="btn btn-outline btn-sm" style="width:100%;margin-bottom:16px" onclick="ouvrirRapport(currentUser)">Rapport de la période</button>
    <div id="perf-etats" style="margin-bottom:20px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:10px">Progression par exercice</div>
      ${_lst.length?_lst.map((x,i)=>_ligneEtat(x,i===_iE1rm)).join(''):'<div class="sub" style="font-size:var(--fs-sm)">Aucun exercice suivi pour l\'instant.</div>'}
    </div>
    ${_htmlVolumeCreneau(currentUser)}`;
    setTimeout(()=>{ try{ _peindreVolumeCreneau(currentUser); }catch(e){} },50);
    c.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el));

  } else if(tab==='photos'){
    // LES PHOTOS DE BILAN, ET ELLES SEULES (27/09/2026) : la seance photo
    // quatre poses et son comparateur, qui passaient devant, ont ete retires.
    const getP=_progPhotoBilan;
    const hasSome=bl.some(b=>getP(b,'face')||getP(b,'back')||getP(b,'side'));
    if(!hasSome){
      c.innerHTML=emptyState('image','Aucune photo de bilan.<br>Ajoute des photos lors de ton prochain bilan.','Remplir mon bilan','openBilanChoice()');
      return;
    }
    // Fresque : lignes = pose (Face/Dos/Profil), colonnes = bilans
    // La fresque lit le profil : elle relit tout l'historique, pas un bilan en
    // cours de saisie. D'ou posesGenre sans prefixe.
    const BP=posesGenre(null);
    const poses=[['face','DE FACE',BP.face],['back','DE DOS',BP.back],['side','DE PROFIL',BP.side]];
    const POSES_N=poses.length;
    const cellW=Math.max(72,Math.min(104,Math.floor(((window.innerWidth||360)-124)/Math.max(1,Math.min(bl.length,3)))));
    const first=bl[0],last=bl[bl.length-1];
    const wFirst=getBW(first),wLast=getBW(last);
    const dW=(wFirst&&wLast)?Math.round((wLast-wFirst)*10)/10:null;
    const dCol=dW==null?'#8a8a8a':dW<0?'#22c55e':dW>0?'#f5c518':'#8a8a8a';
    const period=(()=>{
      if(bl.length<2) return '';
      const d1=new Date(first.date),d2=new Date(last.date);
      const days=Math.round((d2-d1)/864e5);
      if(days<31) return days+' jours';
      const m=Math.round(days/30.4);
      return m+' mois';
    })();

    // --fq porte la largeur d'une photo. C'est une VARIABLE et non une valeur
    // écrite dans chaque cellule : elle est réajustée après le rendu, une fois
    // la place réellement disponible mesurée, et une seule écriture suffit.
    // MON AVANT/APRÈS : dès deux bilans à photo du même angle, en tête.
    let html=htmlBoutonAvantApres(currentUser)+`<div data-fresque class="fq-carte" style="--fq:${cellW}px;background:linear-gradient(160deg,var(--surface-1) 0%,var(--surface-0) 55%,var(--bg) 100%);border:1px solid var(--border);border-radius:var(--r-4);position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 14px 34px rgba(0,0,0,.55);animation:fadeInUp var(--t-3) var(--c-out)">
      
      <div style="position:absolute;left:-16px;top:34px;width:66px;height:150px;background:none;opacity:.4;pointer-events:none;z-index:0"></div>
      <div style="position:absolute;right:-16px;bottom:44px;width:66px;height:150px;background:none;opacity:.4;pointer-events:none;z-index:0"></div>
      <div style="position:relative;z-index:1">
        <!-- Titre facon affiche -->
        <div style="text-align:center;margin-bottom:6px">
          <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px">
            <div style="flex:1;max-width:52px;height:1px;background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--red) 85%,transparent))"></div>
            <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:4px;color:var(--red-text);text-transform:uppercase;white-space:nowrap;--halo-c:color-mix(in srgb,var(--red) 65%,transparent);text-shadow:var(--halo-1)">RepCore</div>
            <div style="flex:1;max-width:52px;height:1px;background:linear-gradient(90deg,color-mix(in srgb,var(--red) 85%,transparent),transparent)"></div>
          </div>
          <div class="fq-titre" style="font-family:var(--pile-titre);line-height:.96;letter-spacing:2px;color:var(--text);text-shadow:var(--halo-3),0 0 44px color-mix(in srgb,var(--red) 35%,transparent)">MA TRANSFORMATION</div>
          <div style="width:46px;height:2.5px;background:linear-gradient(90deg,#ff3b30,var(--red-deep));border-radius:var(--r-1);margin:10px auto 0;box-shadow:0 0 12px color-mix(in srgb,var(--red) 85%,transparent)"></div>
          <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2.8px;color:var(--text-faint);text-transform:uppercase;margin-top:8px">${period?period+' de travail':'Suivi photo'} &nbsp;·&nbsp; ${bl.length} bilan${bl.length>1?'s':''}</div>
        </div>
        ${dW!=null?`<div style="display:flex;justify-content:center;gap:10px;margin:12px 0 14px">
          <div style="flex:1;max-width:112px;background:linear-gradient(180deg,var(--surface-1),var(--surface-0));border:1px solid var(--border);border-radius:var(--r-3);padding:8px 6px;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.04)">
            <div style="font-family:var(--pile-titre);font-size:var(--fs-xl);line-height:1;color:var(--sub)">${wFirst}<span style="font-size:var(--fs-xs)">kg</span></div>
            <div style="font-size:var(--fs-xs);letter-spacing:1.6px;color:var(--text-dim);margin-top:4px;font-weight:800">DÉPART</div>
          </div>
          <div style="flex:1;max-width:112px;background:linear-gradient(160deg,#c10000,#6d0000);border:1px solid rgba(255,90,90,.42);border-radius:var(--r-3);padding:8px 6px;text-align:center;box-shadow:0 0 20px color-mix(in srgb,var(--red) 40%,transparent),inset 0 1px 0 rgba(255,255,255,.18)">
            <div style="font-family:var(--pile-titre);font-size:var(--fs-xl);line-height:1;color:var(--text);text-shadow:var(--halo-2)">${wLast}<span style="font-size:var(--fs-xs)">kg</span></div>
            <div style="font-size:var(--fs-xs);letter-spacing:1.6px;color:rgba(255,255,255,.8);margin-top:4px;font-weight:800">AUJOURD'HUI</div>
          </div>
          <div style="flex:1;max-width:112px;background:linear-gradient(180deg,var(--surface-1),var(--surface-0));border:1px solid ${dCol}44;border-radius:var(--r-3);padding:8px 6px;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 16px ${dCol}22">
            <div style="font-family:var(--pile-titre);font-size:var(--fs-xl);line-height:1;color:${dCol};--halo-c:${dCol};text-shadow:var(--halo-2)bb">${dW>0?'+':''}${dW}<span style="font-size:var(--fs-xs)">kg</span></div>
            <div style="font-size:var(--fs-xs);letter-spacing:1.6px;color:${dCol}aa;margin-top:4px;font-weight:800">ÉVOLUTION</div>
          </div>
        </div>`:'<div style="height:8px"></div>'}
        <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:6px" data-scroll-fade>
          <table style="border-collapse:separate;border-spacing:0 0;min-width:100%">
            <thead><tr>
              <td style="padding:4px 6px;min-width:56px"></td>
              ${bl.map((_,i)=>{
                const isLast=i===bl.length-1;
                return `<td style="padding:4px 4px 8px;text-align:center;min-width:var(--fq)">
                  <div style="display:inline-block;padding:4px 10px;border-radius:var(--r-2);background:${isLast?'linear-gradient(160deg,#c10000,#6d0000)':'#141414'};border:1px solid ${isLast?'rgba(255,90,90,.45)':'#222'};box-shadow:${isLast?'0 0 14px rgba(224,32,32,.5)':'none'}">
                    <span style="font-family:var(--pile-titre);font-size:var(--fs-md);letter-spacing:1.5px;color:${isLast?'var(--text)':'#7a7a7a'};${isLast?'text-shadow:var(--halo-1)':''}">B${i+1}</span>
                  </div>
                  <div style="font-size:var(--fs-xs);font-weight:800;color:${isLast?'#ff7a7a':'#3f3f3f'};margin-top:4px;letter-spacing:.5px">${getBW(bl[i])?getBW(bl[i])+'KG':''}</div>
                </td>`;
              }).join('')}
            </tr></thead>
            <tbody>
            ${poses.map(([key,lbl,poseImg])=>`<tr>
              <td style="padding:6px 4px;vertical-align:middle;text-align:center">
                <img src="${poseImg}" alt="${lbl}" style="height:calc(var(--fq) * .5);max-width:52px;object-fit:contain;filter:drop-shadow(0 0 7px rgba(255,255,255,.55));display:block;margin:0 auto 4px">
                <div style="font-family:var(--pile-titre);font-size:var(--fs-xs);letter-spacing:1.4px;color:var(--text);text-shadow:var(--halo-1);white-space:nowrap">${lbl}</div>
              </td>
              ${bl.map((b,i)=>{
                const src=getP(b,key);
                const isLast=i===bl.length-1;
                return `<td style="padding:4px;vertical-align:top">
                  ${src
                    ?`<div style="width:var(--fq);aspect-ratio:.65;border-radius:var(--r-2);overflow:hidden;background:var(--surface-1);cursor:pointer;border:1.5px solid ${isLast?'rgba(224,32,32,.75)':'#242424'};box-shadow:${isLast?'0 0 16px rgba(224,32,32,.45)':'0 5px 14px rgba(0,0,0,.5)'};position:relative" onclick="openPhotoFull(this.querySelector('img').src,'Bilan ${i+1} : ${lbl}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"><img src="${srcImageSure(src)}" style="width:100%;height:100%;object-fit:cover"><div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 62%,rgba(0,0,0,.55));pointer-events:none"></div></div>`
                    :`<div style="width:var(--fq);aspect-ratio:.65;border-radius:var(--r-2);background:linear-gradient(180deg,var(--surface-1),var(--bg));border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:#1e1e1e">${icon('image',20)}</div>`}
                </td>`;
              }).join('')}
            </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <!-- Pied facon signature -->
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
          <img src="./icons/logo.png" alt="" style="width:20px;height:20px;border-radius:var(--r-1);object-fit:cover;opacity:.9">
          <span style="font-family:var(--pile-titre);font-size:var(--fs-md);letter-spacing:3px;color:var(--text-faint)">REPCORE</span>
          <span style="font-size:var(--fs-xs);color:var(--text-dim);letter-spacing:1.5px;font-weight:700">· GUELLEC COACHING PRO</span>
        </div>
      </div>
    </div>
    <div style="margin-top:10px;font-size:var(--fs-xs);color:var(--text-dim);text-align:center">Touche une photo pour l'agrandir · fais défiler pour voir tous tes bilans</div>`;
    c.innerHTML=html;
    setTimeout(()=>{ try{ _fresqueTenirEcran(c,POSES_N,cellW); }catch(e){} },0);
    c.querySelectorAll('[data-scroll-fade]').forEach(el=>setupScrollFade(el));
  } else if(tab==='notes'){
    if(!bl.length){c.innerHTML=emptyState('clipboard','Tes réponses aux bilans s\'afficheront ici. Il n\'y en a pas encore.','Remplir mon premier bilan','openBilanChoice()');return;}
    // Liste et mise en forme partagées avec l'écran coach : voir
    // BILAN_QUESTIONS et renderReponsesBilans. Elles vivaient ici, en local,
    // et l'athlète était donc le seul à pouvoir lire ses propres réponses.
    c.innerHTML=renderReponsesBilans(bl);
    // ⚠ LUE A L'AFFICHAGE (QA du 27/09/2026), comme renderRiteReponse. Seul
    //   openReponseBilan — la notification, la ligne de l'accueil — marquait la
    //   reponse lue : l'athlete qui allait la lire ici par l'onglet la lisait
    //   bel et bien, et la pastille restait allumee pour toujours.
    try{
      let _lu=false;
      for(const b of bl) if(b&&bilanRepondu(b)&&b.reponseVue===false){ b.reponseVue=true; _lu=true; }
      if(_lu){ saveUser(); _majPastilleBilan(); }
    }catch(e){}
  }
  // arcTracerCourbes n'etait declenchee que par go() : la premiere arrivee sur
  // Evolution tracait bien la courbe, mais un aller-retour vers Mensurations
  // reconstruisait un <path> neuf que plus rien n'atteignait. Le WeakSet
  // empeche deja tout rejeu sur un element deja trace ; les branches vides
  // sortent plus haut, et c'est voulu — il n'y a alors aucune courbe a tracer.
  try{
    const _pc=document.getElementById('progress-content');
    if(_pc) requestAnimationFrame(()=>arcTracerCourbes(_pc));
  }catch(e){}
}

// LA FRESQUE DOIT TENIR DANS UN ÉCRAN : elle est faite pour être capturée et
// repartagée, et une affiche qui demande deux captures n'est pas une affiche.
//
// On MESURE plutôt que de calculer à l'aveugle : la hauteur de l'en-tête
// dépend du nombre de bilans (les trois chiffres n'apparaissent qu'à partir de
// deux), la barre du bas dépend de l'encoche de l'appareil, et un bloc de
// photos guidées peut s'insérer au-dessus. Rien de tout cela n'est connu à
// l'écriture du gabarit.
//
// Le raisonnement : on retire de la carte tout ce qui n'est PAS une photo, ce
// qui donne sa hauteur incompressible ; le reste de la place disponible se
// répartit sur les lignes de pose.
function _fresqueTenirEcran(racine,lignes,largeurMax){
  const carte=(racine||document).querySelector('[data-fresque]');
  if(!carte||!lignes) return null;
  // LA POSITION DE LA CARTE NE COMPTE PAS. On peut toujours faire defiler
  // jusqu'a elle : la seule contrainte est qu'elle ne soit pas PLUS HAUTE que
  // la zone visible. Mesurer sa position aurait rendu le calcul dependant du
  // defilement en cours — deja descendu d'un ecran, l'ajustement n'aurait
  // plus rien fait.
  const zone=carte.closest('.scroll-area');
  const dispo=(zone?zone.clientHeight:(window.innerHeight||720))-12;
  const actuel=parseFloat(carte.style.getPropertyValue('--fq'))||largeurMax;
  // Une photo occupe sa largeur divisée par son rapport, plus le remplissage
  // de sa cellule (4 px en haut et en bas, écrits dans le gabarit).
  const hUne=n=>n/0.65+8;
  const fixe=carte.offsetHeight-lignes*hUne(actuel);
  const cible=Math.floor(((dispo-fixe)/lignes-8)*0.65);
  // PLANCHER À 52 : sous cette taille une photo de progression ne montre plus
  // rien. Si même là ça ne rentre pas, une fresque lisible qui déborde vaut
  // mieux qu'une fresque illisible qui rentre.
  const n=Math.max(52,Math.min(largeurMax,cible));
  carte.style.setProperty('--fq',n+'px');
  // LE PLANCHER EST ATTEINT : ce ne sont plus les photos qui débordent, c'est
  // l'en-tête. On le resserre et on refait le calcul UNE fois — pas de boucle,
  // le mode resserré est un cran unique et il ne peut pas se rappeler
  // lui-même : data-serre est déjà posé au second passage.
  if(n<=52&&!carte.hasAttribute('data-serre')){
    carte.setAttribute('data-serre','');
    return _fresqueTenirEcran(racine,lignes,largeurMax);
  }
  return n;
}
function setEvolGender(g){
  currentUser._evol_gender=g;saveUser();
  showProgressTab('masseGrasse',document.querySelector('#prog-tabs .btn-red'));
}
// Bornes EXCLUES, exactement celles du test qui existait : au-dessus de 100,
// en dessous de 250. Nommées ici pour que le message et le contrôle ne
// puissent pas annoncer deux intervalles différents.
const TAILLE_MIN_CM=100, TAILLE_MAX_CM=250;
// PURE. La taille utilisable, ou null. LA VIRGULE EST ACCEPTÉE : « 176,5 »
// est une saisie française ordinaire, et parseFloat s'y arrête — 176,5
// deviendrait 176 sans un mot, dans une valeur qui entre ensuite dans la
// formule US Navy.
function tailleSaisie(v){
  const n=parseFloat(String(v==null?'':v).replace(',','.'));
  return (Number.isFinite(n)&&n>TAILLE_MIN_CM&&n<TAILLE_MAX_CM)?n:null;
}
// UN REFUS SE DIT. L'ancienne version enregistrait et redessinait dans tous
// les cas : une taille hors bornes rendait donc un écran identique, et le
// bouton passait pour mort. On ne redessine plus rien — l'écran garde la
// saisie sous les yeux, ce qui est exactement ce dont on a besoin pour la
// corriger.
function refreshMG(){
  const el=document.getElementById('evol-height');
  const h=tailleSaisie(el&&el.value);
  if(h===null){
    toast('Taille attendue en centimètres, entre '+(TAILLE_MIN_CM+1)+' et '
      +(TAILLE_MAX_CM-1)+' (ex : 176).','var(--orange)');
    return false;
  }
  currentUser._evol_height=h;
  saveUser();
  showProgressTab('masseGrasse',document.querySelector('#prog-tabs .btn-red'));
  return true;
}
// ======= NUTRITION =======
// ══════════════ RÉPARTITION PAR REPAS ET REPÈRE PÉRI-SÉANCE ══════════════
// Deux réponses du questionnaire de départ étaient collectées depuis toujours
// et n'allaient nulle part : le nombre de repas et le moment d'entraînement.
// Elles servent ici, et seulement à titre INDICATIF.
//
// Ce module ne produit qu'un seul chiffre — les protéines divisées par le
// nombre de repas — et il ne le présente jamais comme une cible. Aucun gramme
// de glucides ou de lipides par repas, aucune fenêtre chiffrée, aucune notion
// de délai après la séance.
const REPAS_MIN=3, REPAS_MAX=6;
// PURE. Rend {nRepas, gParRepas} ou null.
function protParRepas(user,macrosJour){
  const brut=_dernierChamp(user,'deb-meals-day');
  const n=parseInt(Array.isArray(brut)?brut[0]:brut,10);
  if(!(n>=REPAS_MIN&&n<=REPAS_MAX)) return null;
  const p=Number(macrosJour&&macrosJour.p);
  if(!(p>0)) return null;
  return {nRepas:n,gParRepas:Math.round(p/n)};
}
function phraseProtParRepas(r){
  if(!r) return '';
  return r.nRepas+' repas par jour : environ '+r.gParRepas+' g de protéines par repas.';
}


// ══════════════ DOSSIER SANTÉ HORMONALE : LIRE, DATER, RENDRE ═════════════
// AUCUNE LOGIQUE MÉTIER NOUVELLE. Ce module ne décide rien : il lit les états
// déjà déclarés, nomme les effets déjà appliqués ailleurs, et les horodate.
//
// L'AUDIT A TROUVÉ UNE SEULE DÉCLARATION SUR SIX DÉJÀ DATÉE — `grossesse`
// porte `declareLe` depuis son lot d'origine. Les cinq autres s'écrivaient
// nues. On les date À LEUR EMPLACEMENT, sans créer de nœud parallèle : la
// consigne « ne rien recopier » est tenue, et deux copies d'une donnée de
// santé finiraient de toute façon par diverger.
//
// LE PIÈGE, ET IL EST GRAVE : une date de déclaration EST une donnée de
// santé. Savoir qu'une date existe pour `pes`, c'est savoir que le PES a été
// déclaré. Les dates suivent donc EXACTEMENT le même filtre réseau que les
// blocs eux-mêmes — voir _retirerDatesNonPartagees, appelée dans _doPushOne
// au même endroit que les autres retraits.
const DOSSIER_BLOCS=Object.freeze([
  Object.freeze({bloc:'cycle',         lib:'Contraception'}),
  Object.freeze({bloc:'statutHormonal',lib:'Statut hormonal'}),
  Object.freeze({bloc:'etats',         lib:'États déclarés'}),
  Object.freeze({bloc:'traitement',    lib:'Thyroïde'}),
  Object.freeze({bloc:'grossesse',     lib:'Grossesse, allaitement, post-partum'}),
  Object.freeze({bloc:'pes',           lib:'Produits déclarés'})
]);
const DOSSIER_DATE_INCONNUE='date inconnue';
const DOSSIER_VIDE='Rien n\'est déclaré. Cet écran n\'affiche que ce que tu as '
  +'renseigné toi-même, et il reste vide tant que tu ne déclares rien.';
const DOSSIER_ART9='DONNÉES DE SANTÉ : ARTICLE 9 DU RGPD. Ce dossier contient '
  +'des données relatives à la santé, dont le traitement relève du régime '
  +'renforcé de l\'article 9. Il n\'est ni chiffré ni protégé par mot de passe : '
  +'ne le dépose pas sur un service partagé.';
const DOSSIER_JOURNAL_MAX=120;
// PURE. La date de déclaration d'un bloc, ou null. `grossesse` est lue à son
// emplacement historique — on ne migre pas une donnée qui fonctionne.
function dateDeclaration(user,bloc){
  const u=user||{};
  if(bloc==='grossesse'){
    const d=Number(((u.grossesse)||{}).declareLe);
    return d>0?d:null;
  }
  const d=Number((((u.sante)||{}).declare||{})[bloc]);
  return d>0?d:null;
}
// ÉCRIT. Pose la date, et journalise. Appelée depuis les écrans de
// déclaration EXISTANTS, jamais toute seule.
//
// RÈGLE 4 : le journal survit au retrait. Il est PURGEABLE — purgerJournalSante
// existe pour ça — mais une déclaration retirée laisse sa trace datée, sans
// quoi « l'effet a-t-il été appliqué à cette date ? » n'a plus de réponse.
//
// EXCEPTION DOCUMENTÉE : `grossesse`. revoquerGrossesse efface TOUT, sans
// historique, et c'est une décision antérieure verrouillée par un test. La
// défaire pour ce lot reviendrait à conserver la trace datée d'une grossesse
// révoquée — exactement ce que cette décision protégeait.
function marquerDeclaration(user,bloc,cle,action){
  if(!user) return false;
  if(!DOSSIER_BLOCS.some(x=>x.bloc===bloc)) return false;
  const t=Date.now();
  if(!user.sante||typeof user.sante!=='object') user.sante={};
  if(bloc!=='grossesse'){
    if(!user.sante.declare||typeof user.sante.declare!=='object') user.sante.declare={};
    if(action==='retire') delete user.sante.declare[bloc];
    else user.sante.declare[bloc]=t;
  }
  if(bloc==='grossesse') return true;          // journal tenu par son module
  const j=Array.isArray(user.sante.journal)?user.sante.journal:[];
  j.push({bloc,cle:String(cle||''),action:(action==='retire')?'retire':'declare',date:t});
  user.sante.journal=j.slice(-DOSSIER_JOURNAL_MAX);
  return true;
}
// ÉCRIT. La purge RGPD. Elle ne touche à AUCUNE déclaration active : elle
// efface l'historique, et lui seul.
function purgerJournalSante(user){
  if(!user||!user.sante) return false;
  delete user.sante.journal;
  return true;
}
// PURE. Le journal d'un dossier, filtré par ce que le lecteur a le droit de
// voir. Le filtre est le MÊME que partout ailleurs.
function journalSante(user,pourCoach){
  const j=Array.isArray(((user||{}).sante||{}).journal)?user.sante.journal:[];
  if(!pourCoach) return j.slice();
  return j.filter(e=>{ try{ return santeVisibleCoach(user,e.bloc)===true; }catch(x){ return false; } });
}
// ── Ce que chaque bloc DÉCLARE, en clair ─────────────────────────────────
// PURE. Rend [{bloc, lib, valeur, date}] — jamais un état nu sans son bloc.
// RÈGLE 1 : rien qui n'ait été déclaré. Les valeurs par défaut ne comptent pas
// pour des déclarations : « aucune contraception » et « cycles réguliers » sont
// ce que rend le produit quand personne n'a rien dit.
function etatsDeclaresDossier(user,pourCoach){
  const u=user||{};
  const out=[];
  const lib=b=>(DOSSIER_BLOCS.find(x=>x.bloc===b)||{}).lib||b;
  const visible=b=>{ if(!pourCoach) return true;
    try{ return santeVisibleCoach(u,b)===true; }catch(e){ return false; } };
  const pousser=(bloc,valeur)=>{ if(!valeur||!visible(bloc)) return;
    out.push({bloc,lib:lib(bloc),valeur,date:dateDeclaration(u,bloc)}); };
  try{
    const c=contraceptionDe(u);
    if(c&&c!=='aucune')
      pousser('cycle',(CONTRACEPTIONS.find(x=>x.cle===c)||{}).lib||c);
  }catch(e){}
  try{
    const h=statutHormonal(u);
    if(h&&h!=='cycles_reguliers'&&_hormonalApplicable(u))
      pousser('statutHormonal',(STATUTS_HORMONAUX.find(x=>x.cle===h)||{}).lib||h);
  }catch(e){}
  try{
    const l=etatsDeclares(u);
    for(const cle of l)
      pousser('etats',(ETATS_DECLARABLES.find(x=>x.cle===cle)||{}).lib||cle);
  }catch(e){}
  try{
    const t=thyroideDe(u);
    if(t&&t.etat)
      pousser('traitement',(THYROIDE_ETATS.find(x=>x.cle===t.etat)||{}).lib||t.etat
        +(t.traitement?' · traitement en cours':''));
  }catch(e){}
  try{
    const g=etatGrossesse(u);
    if(g) pousser('grossesse',(GROSSESSE_ETATS.find(x=>x.cle===g)||{}).lib||g);
  }catch(e){}
  // RÈGLE 3 : le PES n'apparaît QUE si pesPartagee est vrai. Sans exception.
  // Côté réseau il n'atteint même pas le coach ; ici on le redit à
  // l'affichage, parce qu'une seule barrière est une barrière qu'on oublie.
  try{ if(aPES(u)) pousser('pes','Produits déclarés'); }catch(e){}
  return out;
}
// ── Les effets EN COURS ──────────────────────────────────────────────────
// PURE. Chacun sous la forme « effet — cause — date ». RÈGLE 2 : jamais un
// état nu, toujours l'effet et sa cause.
//
// AUCUN EFFET N'EST CALCULÉ ICI. Chaque ligne interroge la fonction qui décide
// déjà, ailleurs, et se contente de la nommer.
function effetsEnCours(user,pourCoach){
  const u=user||{};
  const out=[];
  const visible=b=>{ if(!pourCoach) return true;
    try{ return santeVisibleCoach(u,b)===true; }catch(e){ return false; } };
  const add=(effet,bloc,cause)=>{ if(!visible(bloc)) return;
    out.push({effet,bloc,cause,date:dateDeclaration(u,bloc)}); };
  try{
    if(grossesseSuspend(u)){
      const g=etatGrossesse(u);
      const cause=(GROSSESSE_ETATS.find(x=>x.cle===g)||{}).lib||g;
      add('Objectifs de perte de poids désactivés','grossesse',cause);
      add('Alertes de poids désactivées','grossesse',cause);
      add('Limite de caféine abaissée à '+CAFFEINE_MAX_GROSSESSE+' mg','grossesse',cause);
    }
  }catch(e){}
  try{
    if(sopkApplicable(u))
      add('Fourchette de vitesse de sèche élargie','etats','SOPK déclaré');
  }catch(e){}
  try{
    if(menopauseDeclaree(u))
      add('Fourchette de vitesse de sèche élargie','statutHormonal','Ménopause déclarée');
  }catch(e){}
  try{
    if(menopauseeOuAgee(u)){
      add('Échelle protéique relevée','statutHormonal','Ménopause ou âge déclaré');
      add('Repère de protéines par prise relevé','statutHormonal','Ménopause ou âge déclaré');
    }
  }catch(e){}
  try{
    if(aEtat(u,'thyroide')&&correctionMBSuggeree(u)!==1)
      add('Correction du métabolisme suggérée au coach','traitement',
        (THYROIDE_ETATS.find(x=>x.cle===thyroideDe(u).etat)||{}).lib||'Trouble déclaré');
  }catch(e){}
  try{
    if(aPES(u)) add('Échelle protéique ouverte vers le haut','pes','Produits déclarés');
  }catch(e){}
  try{
    if(cycleSansCycle(u))
      add('Modèle calendaire de cycle désactivé','cycle',
        (CONTRACEPTIONS.find(x=>x.cle===contraceptionDe(u))||{}).lib||'Contraception déclarée');
  }catch(e){}
  try{
    const f=ppFenetre(u);
    if(f) add('Impacts non proposés tant que la fenêtre court','grossesse',
      'Date d\'accouchement renseignée');
  }catch(e){}
  return out;
}
// ── Les renvois médicaux ─────────────────────────────────────────────────
// ARBITRAGE. Aucun renvoi n'est journalisé à l'émission — ce sont huit
// constantes de texte qui s'affichent et ne laissent pas de trace. Les
// journaliser aurait été une écriture nouvelle, contraire au « cet écran lit,
// il ne décide pas ». On rend donc les renvois ACTUELLEMENT ACTIFS, datés par
// la déclaration qui les cause : traçable, et sans rien inventer.
function renvoisEnCours(user,pourCoach){
  const u=user||{};
  const out=[];
  const visible=b=>{ if(!pourCoach) return true;
    try{ return santeVisibleCoach(u,b)===true; }catch(e){ return false; } };
  const add=(texte,bloc)=>{ if(!visible(bloc)) return;
    out.push({texte,bloc,date:dateDeclaration(u,bloc)}); };
  try{ if(grossesseSuspend(u)) add(GROSSESSE_REFUS_SECHE,'grossesse'); }catch(e){}
  try{ if(sopkApplicable(u)) add(SOPK_RENVOI_ATHLETE,'etats'); }catch(e){}
  try{ if(aPES(u)) add(PES_PHRASE,'pes'); }catch(e){}
  try{ const r=ppRenvoi(u); if(r) add(r,'grossesse'); }catch(e){}
  return out;
}
// PURE. LE DOSSIER. Un seul point d'entrée, une seule notion de « pour qui ».
function dossierSante(user,pourCoach){
  return {
    pourCoach:!!pourCoach,
    etats:etatsDeclaresDossier(user,pourCoach),
    effets:effetsEnCours(user,pourCoach),
    renvois:renvoisEnCours(user,pourCoach),
    journal:journalSante(user,pourCoach)
  };
}
function dossierSanteVide(d){
  return !d||(!d.etats.length&&!d.effets.length&&!d.renvois.length);
}
// ── Le rendu, commun aux deux écrans ─────────────────────────────────────
// RÈGLE 5 : aucune interprétation, aucun score, aucune synthèse, aucune
// tendance, aucun graphique. Trois listes, et rien d'autre.
function _dossDate(t){
  if(!(t>0)) return DOSSIER_DATE_INCONNUE;
  try{ return new Date(t).toLocaleDateString('fr-FR'); }catch(e){ return DOSSIER_DATE_INCONNUE; }
}
function _htmlDossierSante(user,pourCoach){
  let d=null;
  try{ d=dossierSante(user,pourCoach); }catch(e){ d=null; }
  if(!d) return '';
  // CÔTÉ ATHLÈTE, UN DOSSIER VIDE NE DIT RIEN (Kevin, 28/09/2026) : la phrase
  // « rien n'est déclaré… » occupait le menu médical pour n'annoncer que du vide.
  if(dossierSanteVide(d)&&!pourCoach) return '';
  if(dossierSanteVide(d))
    return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px;font-size:var(--fs-sm);color:var(--text-strong);line-height:1.75">${escapeHtml(DOSSIER_VIDE)}</div>`;
  const titre=t=>`<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin:14px 0 8px">${escapeHtml(t)}</div>`;
  const ligne=(g,dr)=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
      <span style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;min-width:0">${g}</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint);white-space:nowrap;flex-shrink:0">${escapeHtml(dr)}</span>
    </div>`;
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 16px">
    ${titre('Ce qui est déclaré')}
    ${d.etats.length?d.etats.map(x=>ligne(escapeHtml(x.valeur),_dossDate(x.date))).join('')
      :'<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Rien de déclaré.</div>'}
    ${titre('Ce que RepCore applique')}
    ${d.effets.length?d.effets.map(x=>ligne(
        escapeHtml(x.effet)+' <span style="color:var(--text-dim)"> : '+escapeHtml(x.cause)+'</span>',
        _dossDate(x.date))).join('')
      :'<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucun effet en cours.</div>'}
    ${d.renvois.length?titre('Ce vers quoi RepCore renvoie')
      +d.renvois.map(x=>ligne(escapeHtml(x.texte),_dossDate(x.date))).join(''):''}
    ${d.journal.length?titre('Historique des déclarations')
      +d.journal.slice().reverse().map(x=>ligne(
        escapeHtml((DOSSIER_BLOCS.find(y=>y.bloc===x.bloc)||{}).lib||x.bloc)
        +' <span style="color:var(--text-dim)"> : '+(x.action==='retire'?'retiré':'déclaré')+'</span>',
        _dossDate(x.date))).join(''):''}
    ${blocDisclaimerSante()}
    ${!pourCoach?`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
      <button type="button" class="btn btn-outline btn-sm" style="flex:1;min-width:150px;margin:0" onclick="telechargerDossierSante()">Télécharger mon dossier</button>
      ${d.journal.length?`<button type="button" class="btn btn-outline btn-sm" style="flex:1;min-width:150px;margin:0" onclick="purgerHistoriqueSante()">Effacer l'historique des déclarations</button>`:''}
    </div>`:''}
  </div>`;
}
// LES DEUX BOUTONS N'EXISTENT QUE COTE ATHLETE. Ce n'est pas une question de
// mise en page : telechargerDossierSante et purgerHistoriqueSante operent sur
// `currentUser`. Rendus dans le panneau du coach — même fonction, pourCoach
// vrai, injectée dans ccd-dossier — ils téléchargeraient et purgeraient le
// dossier DU COACH depuis la fiche d'un athlète.
//
// Et l'effacement ne s'affiche que s'il y a un historique : proposer
// d'effacer ce qui n'existe pas ferait douter de ce qui est effacé.
function renderDossierSante(){
  const z=document.getElementById('atp-dossier');
  if(!z) return;
  let h=''; try{ h=_htmlDossierSante(currentUser,false); }catch(e){ h=''; }
  z.innerHTML=h;
}
function _htmlDossierSanteCoachSrc(c){ return _htmlDossierSante(c,true); }
function renderDossierSanteCoach(c){
  const z=document.getElementById('ccd-dossier');
  if(!z) return;
  let h=''; try{ h=c?_htmlDossierSante(c,true):''; }catch(e){ h=''; }
  z.innerHTML=h;
}
// ── L'export ─────────────────────────────────────────────────────────────
// PURE. Le dossier sous forme sérialisable, avertissement en TÊTE. Il rejoint
// le flux d'export EXISTANT plutôt que d'en ouvrir un second qui divergerait.
function exportDossierSante(user){
  const d=dossierSante(user,false);
  return {
    _avertissement:DOSSIER_ART9,
    genereLe:new Date().toISOString(),
    etats:d.etats.map(x=>({bloc:x.bloc,valeur:x.valeur,
      declare_le:x.date?new Date(x.date).toISOString():null})),
    effets:d.effets.map(x=>({effet:x.effet,cause:x.cause,
      depuis:x.date?new Date(x.date).toISOString():null})),
    renvois:d.renvois.map(x=>({texte:x.texte,
      depuis:x.date?new Date(x.date).toISOString():null})),
    historique:d.journal.map(x=>({bloc:x.bloc,action:x.action,
      date:x.date?new Date(x.date).toISOString():null}))
  };
}
function exportDossierSanteTexte(user){
  const e=exportDossierSante(user);
  const l=[e._avertissement,''];
  l.push('Généré le '+e.genereLe,'');
  l.push('CE QUI EST DÉCLARÉ');
  e.etats.forEach(x=>l.push('  '+x.valeur+'  ['+(x.declare_le||DOSSIER_DATE_INCONNUE)+']'));
  if(!e.etats.length) l.push('  (rien)');
  l.push('','CE QUE REPCORE APPLIQUE');
  e.effets.forEach(x=>l.push('  '+x.effet+' : '+x.cause+'  ['+(x.depuis||DOSSIER_DATE_INCONNUE)+']'));
  if(!e.effets.length) l.push('  (aucun)');
  l.push('','RENVOIS');
  e.renvois.forEach(x=>l.push('  '+x.texte+'  ['+(x.depuis||DOSSIER_DATE_INCONNUE)+']'));
  if(!e.renvois.length) l.push('  (aucun)');
  l.push('','HISTORIQUE');
  e.historique.forEach(x=>l.push('  '+x.bloc+' '+x.action+'  ['+(x.date||DOSSIER_DATE_INCONNUE)+']'));
  if(!e.historique.length) l.push('  (vide)');
  return l.join('\n');
}
function telechargerDossierSante(){
  try{
    _telecharger('repcore-dossier-sante.txt',exportDossierSanteTexte(currentUser),'text/plain;charset=utf-8');
    toast('Dossier téléchargé '+ICO.coche,'var(--green)');
    return true;
  }catch(e){ toast('Export impossible.','var(--red)'); return false; }
}
async function purgerHistoriqueSante(){
  if(!await rcConfirm('Effacer l\'historique des déclarations ? Les déclarations actives ne sont pas touchées. Ce choix est définitif.',null,'Effacer')) return false;
  purgerJournalSante(currentUser);
  saveUser();
  renderDossierSante();
  return true;
}
