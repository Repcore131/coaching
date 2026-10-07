// ══════════════ DIÈTE STRICTE : COMPOSITION, CÔTÉ COACH ═══════════════════
// La copie de TRAVAIL vit en mémoire, comme les curseurs de la fiche client
// (_propProt, _propLip…). Rien n'atteint le dossier de l'athlète avant le
// bouton d'enregistrement : un plan à moitié composé ne doit pas arriver sur
// son téléphone au milieu d'une synchronisation.
let _cplPlan=null;
let _cplCible=null;      // ce que la recherche d'aliment va remplir
let _cplPliage={};       // repas repliés, purement visuel
// Catalogues dépliés, par macro. Il FAUT s'en souvenir : le bloc des sources
// est repeint à chaque frappe pour recalculer les grammages, et un <details>
// se refermerait sous les doigts du coach à chaque chiffre saisi ailleurs.
let _cplSrcOuvert={};
function cplNoterSources(macro,ouvert){ _cplSrcOuvert[macro]=!!ouvert; }
let _cplNeuf=false;      // la composition vient d'un modèle, pas encore relue

function _cplId(){
  return 'l'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
}
// Les identifiants de ligne finissent DANS des attributs onclick. escapeHtml
// n'y protège de rien — les entités sont décodées avant que le JS ne soit
// parsé, le fichier le dit noir sur blanc au-dessus de sa définition. Plutôt
// que d'échapper, on garantit la forme : tout identifiant qui n'est pas
// strictement alphanumérique est remplacé à la lecture. Un plan trafiqué dans
// la base ne peut donc pas poser de code dans la page du coach.
function _cplIdSain(v){
  return (typeof v==='string'&&/^[A-Za-z0-9]{1,32}$/.test(v))?v:_cplId();
}
function _cplCopie(p){
  const src=p||{};
  return {v:PLAN_V,
    avecComplements:!!src.avecComplements,
    nRepasSourcesLibres:_planNb(src.nRepasSourcesLibres),
    modele:src.modele||null,
    // null = « suit la réponse de l'athlète ». Une valeur inconnue arrivant de
    // la base retombe sur null plutôt que de figer un ordre que personne ne
    // sait relire.
    momentSeance:PLAN_ANCRE_SEANCE[src.momentSeance]?src.momentSeance:null,
    squelette:planSquelette(src).map(x=>Object.assign({},x,{id:_cplIdSain(x.id)})),
    // Les sources hors Ciqual sont des OBJETS : les copier à plat les ferait
    // partager entre la copie de travail et le dossier, et une retouche
    // toucherait les deux.
    sources:{proteines:planCatalogue(src,'p').map(x=>typeof x==='object'?Object.assign({},x):x),
             glucides:planCatalogue(src,'c').map(x=>typeof x==='object'?Object.assign({},x):x)},
    phases:Array.isArray(src.phases)?src.phases.map(x=>Object.assign({},x)):null,
    courses:{jours:Object.assign({},((src.courses||{}).jours)||{}),
             stock:Object.assign({},((src.courses||{}).stock)||{})}};
}
// L'aperçu doit montrer ce que le coach compose À L'INSTANT, pas ce qui est
// enregistré : on présente donc l'athlète avec la copie de travail greffée.
function _cplAthlete(){
  const c=getOwnedClient(currentClientId);
  if(!c) return null;
  const vue=Object.assign({},c);
  vue.nutrition=Object.assign({},c.nutrition||{},{plan:_cplPlan});
  return vue;
}
// Le pré-modèle se pose SEULEMENT quand il n'y a rien. Un plan déjà composé
// n'est jamais écrasé à l'ouverture d'un écran : ce serait perdre le travail
// du coach sur un simple geste de navigation. Pour le remplacer, il y a un
// bouton, et il demande confirmation.
function ouvrirPlanCoach(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const existant=planDe(c);
  const vide=!planActif(c);
  _cplPlan=vide?(planDepuisModele(c,(existant&&existant.avecComplements)||false)
                 ||_cplCopie(existant))
               :_cplCopie(existant);
  _cplNeuf=vide&&!!_cplPlan.modele;
  _cplCible=null; _cplPliage={};
  go('s-coach-plan');
  renderPlanCoach();
  // Ciqual pèse 873 Ko : on affiche d'abord, on complète les noms ensuite.
  _loadCiqual().then(()=>renderPlanCoach());
}
// Poser un modèle. Le geste écrase la composition en cours, donc il se
// confirme — SAUF quand il n'y a rien à écraser, où demander confirmation
// pour remplacer du vide serait une friction gratuite. Et il n'écrit rien en
// base : le coach relit et enregistre comme d'habitude.
async function cplPoserModele(cle){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const m=planDepuisModele(c,_cplPlan?_cplPlan.avecComplements:false,cle);
  if(!m){ toast('Modèle inconnu','var(--orange)'); return; }
  if(planActif({nutrition:{plan:_cplPlan}})&&!_cplIntact()
     &&!await rcConfirm('Remplacer toute la composition en cours par le modèle « '
       +planModeleLib(m.modele)+' » ?'+String.fromCharCode(10)
       +String.fromCharCode(10)+'Rien n\'est enregistré tant que tu n\'as pas cliqué sur Enregistrer.',null,'Remplacer')) return;
  _cplPlan=m; _cplNeuf=true; _cplPliage={};
  renderPlanCoach();
  toast('Modèle « '+planModeleLib(m.modele)+' » posé. Relis, ajuste, puis enregistre.');
}
// Conservé : d'anciens écrans peuvent encore l'appeler.
function cplRepartirDuModele(){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  const s=planModeleSuggere(c);
  cplPoserModele((_cplPlan&&_cplPlan.modele)||s.cle||'seche_H');
}

// ── Recherche d'aliment, en surcouche ─────────────────────────────────────
// Le titre se DÉDUIT de la cible : le composer dans l'attribut onclick de
// l'appelant reviendrait à fabriquer une chaîne JS à partir d'un libellé, ce
// que l'échappement HTML ne sait pas protéger.
function ouvrirRecherchePlan(cible){
  _cplCible=cible;
  const ov=document.getElementById('cpl-search');
  const ti=document.getElementById('cpl-search-title');
  const inp=document.getElementById('cpl-search-input');
  const li=document.getElementById('cpl-search-list');
  if(!ov) return;
  const titre=(cible&&cible.mode==='source')
    ?('Source de '+(cible.macro==='p'?'protéines':'glucides'))
    :('Aliment · '+planLibRepas(cible&&cible.repas));
  if(ti) ti.textContent=titre;
  if(inp) inp.value='';
  if(li) li.innerHTML='';
  ov.style.display='flex';
  if(inp) setTimeout(()=>inp.focus(),50);
  if(!_ciqualDB) _loadCiqual();
}
function fermerRecherchePlan(){
  const ov=document.getElementById('cpl-search');
  if(ov) ov.style.display='none';
  _cplCible=null;
}
// Même tri que le journal alimentaire — un « riz » qui remonte les plats
// cuisinés avant le riz nature rendrait la composition pénible.
function onPlanSearch(val){
  const el=document.getElementById('cpl-search-list');
  if(!el) return;
  // LOT R1 : la même surcouche choisit une recette de la bibliothèque.
  if(_cplCible&&_cplCible.mode==='recette'){ _cplRecettesRendre(val); return; }
  const q=(val||'').trim();
  if(q.length<2){ el.innerHTML=''; return; }
  if(!_ciqualDB){
    // MEME TABLE, MEME LISTE DE RESULTATS que le journal alimentaire : le
    // gabarit de silhouettes est repris a l'identique.
    el.innerHTML='<div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:62%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:35%"></div></div><div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:78%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:45%"></div></div><div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:54%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:30%"></div></div>';
    _loadCiqual().then(()=>onPlanSearch(val));
    return;
  }
  if(ciqualIndisponible()){ el.innerHTML=_htmlCiqualIndispo(); _loadCiqual().then(()=>{ if(!ciqualIndisponible()) onPlanSearch(val); }); return; }
  let {normQ,words}=_fjRequete(q);
  if(!words.length){ el.innerHTML=''; return; }
  // Pas de coupe AVANT le classement : « Oeuf cru » est le 124e nom
  // contenant « oeuf » dans l ordre de la table. Le plafonner a 80 revenait a
  // classer un echantillon arbitraire. On classe tout, on coupe apres.
  // AU SINGULIER COMME AU PLURIEL. Les noms Ciqual sont au singulier :
  // « tomates » ne retenait que les 4 entrées portant elles-mêmes un « s », sur
  // 57. Quatre résultats donnent l'illusion d'avoir cherché — on en conclut
  // que l'aliment n'est pas dans la table.
  let res=_fjFiltrer(_ciqualDB,words);
  const _corr=_fjAvecCorrection(q,words,res,_ciqualDB);
  if(_corr){ res=_corr.res; words=_corr.words; normQ=_corr.normQ; }
  if(!res.length){ el.innerHTML='<div style="padding:20px;text-align:center;color:var(--sub);font-size:var(--fs-sm)">Aucun résultat pour "'+escapeHtml(q)+'"</div>'; return; }
  const scored=_classerAliments(res,normQ,words);
  // La macro visée est rappelée sur chaque ligne : choisir une source de
  // glucides qui n'en porte pas est l'erreur la plus facile à commettre ici.
  const macro=(_cplCible&&_cplCible.macro)||null;
  // ⚠ CE SONT LES EVICTIONS DE L'ATHLETE, PAS CELLES DU COACH. currentUser est
  // le coach sur cet ecran : lire ses evictions a lui aurait filtre le plan
  // selon le regime de quelqu'un d'autre, en silence, et laisse passer
  // l'arachide de l'athlete.
  const _cli=(function(){ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  const _tr=evictionTrier(_cli,scored.slice(0,50).map(x=>x.f));
  el.innerHTML=_htmlBandeauCorrection(_corr,q,'onPlanSearch')+_htmlEvictionsRappelPlan(_cli)
    +_tr.liste.concat(_tr.releguees.map(r=>r.aliment)).map(f0=>{
    const f=f0;
    const _ev=(function(){ try{ return evictionDe(_cli,f); }catch(e){ return null; } })();
    const v=macro?_planNb(f[macro]):null;
    const rappel=macro
      ?`<span style="font-size:var(--fs-xs);font-weight:800;color:${(v>0)?'var(--green)':'var(--orange)'}">${v==null?'-':String(v).replace('.',',')} g${macro==='p'?' prot.':' gluc.'}/100 g</span>`
      :`<span style="font-size:var(--fs-2xs);color:var(--sub)">P ${f.p==null?'-':f.p} · G ${f.c==null?'-':f.c} · L ${f.l==null?'-':f.l}</span>`;
    return `<div onclick="planCoachChoisirAliment(${f.id})" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
      style="padding:12px 16px;border-bottom:1px solid var(--surface-2);cursor:pointer">
      <div style="font-size:var(--fs-md);font-weight:700;line-height:1.35">${escapeHtml(f.n)}</div>
      ${_ev&&_ev.niveau==='intolerance'?`<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.5;margin-top:4px">${escapeHtml(_ev.libelle+' : '+_ev.raison)}</div>`:''}
      <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
        ${rappel}<span style="font-size:var(--fs-2xs);color:var(--text-faint);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(f.g||'')}</span>
      </div>
    </div>`;
  }).join('');
}
function planCoachChoisirAliment(id){
  if(!_cplPlan||!_cplCible) { fermerRecherchePlan(); return; }
  const cible=_cplCible;
  if(cible.mode==='squelette'){
    _cplPlan.squelette.push({id:_cplId(),repas:cible.repas,ciqual:id,q:100,u:'g'});
  } else if(cible.mode==='source'){
    const l=cible.macro==='p'?_cplPlan.sources.proteines:_cplPlan.sources.glucides;
    if(l.indexOf(id)<0) l.push(id);
    else toast('Cette source est déjà dans le catalogue','var(--orange)');
  }
  fermerRecherchePlan();
  renderPlanCoach();
}

// ── Gestes de composition ─────────────────────────────────────────────────
function _cplLigne(lid){
  return _cplPlan?_cplPlan.squelette.find(x=>x&&x.id===lid):null;
}
// Basculer l'interrupteur ne suffit PAS quand la composition sort d'un
// modèle : entre les deux versions d'un tableur, le coach ne masque pas la
// whey, il la REMPLACE par du lait protéiné. Tant que rien n'a été retouché,
// on rejoue donc le modèle dans l'autre version. Dès que la composition a été
// modifiée à la main, on ne touche plus à rien — écraser son travail sur un
// clic d'interrupteur serait pire que le manque de substitution — et le
// bouton « Repartir du modèle » reste là pour le faire volontairement.
// « Intact » se CONSTATE, il ne se retient pas dans un drapeau : on regénère
// le modèle et on compare. Un booléen qu'il faudrait penser à baisser dans
// les douze fonctions de retouche finirait par mentir le jour où on en
// ajoute une treizième.
function _cplIntact(){
  if(!_cplPlan||!_cplPlan.modele) return false;
  const c=_cplAthlete();
  // On regénère LE modèle réellement posé, pas celui que la phase suggère :
  // le coach a pu en choisir un autre, et comparer au suggéré déclarerait sa
  // composition « retouchée » alors qu'il n'y a pas touché.
  const m=c&&planDepuisModele(c,_cplPlan.avecComplements,_cplPlan.modele);
  if(!m) return false;
  const nu=(p)=>JSON.stringify({
    s:planSquelette(p).map(x=>{const y=Object.assign({},x); delete y.id; return y;}),
    p:planCatalogue(p,'p'),g:planCatalogue(p,'c'),
    ph:p.phases||null,n:p.nRepasSourcesLibres==null?null:p.nRepasSourcesLibres});
  return nu(_cplPlan)===nu(m);
}
function cplToggleComplements(){
  if(!_cplPlan) return;
  const vise=!_cplPlan.avecComplements;
  if(_cplIntact()){
    const c=_cplAthlete();
    const m=c&&planDepuisModele(c,vise,_cplPlan.modele);
    if(m){
      const courses=_cplPlan.courses;
      _cplPlan=m; _cplPlan.courses=courses;
      renderPlanCoach();
      toast(vise?'Compléments réintégrés au modèle':'Compléments remplacés par leurs équivalents');
      return;
    }
  }
  _cplPlan.avecComplements=vise;
  renderPlanCoach();
}
function cplSetNSources(v){
  if(!_cplPlan) return;
  const n=_planNb(v);
  _cplPlan.nRepasSourcesLibres=(n!=null&&n>=1&&n<=PLAN_SOURCES_MAX)?Math.round(n):null;
  renderPlanCoach();
}
function cplPlier(repas){
  _cplPliage[repas]=!_cplPliage[repas];
  renderPlanCoach();
}
// Les deux lignes que le tableur chiffrait par paliers de poids arrivent
// PRÉ-REMPLIES avec la règle continue. C'est une suggestion posée dans un
// champ modifiable, pas un calcul imposé : le coach écrase le nombre s'il
// n'est pas d'accord, comme partout ailleurs dans cette application.
function cplAjouterPortion(repas,cle){
  if(!_cplPlan||!PLAN_PORTIONS[cle]) return;
  const po=PLAN_PORTIONS[cle];
  const c=_cplAthlete();
  const poids=_planPoids(c);
  const femme=_planFemme(c);
  let q=1;
  if(cle==='oeuf'){ const n=oeufsSuggeres(poids,femme); if(n>0) q=n; }
  else if(cle==='amandes'){ const n=amandesSuggerees(poids,femme); if(n>0) q=n; }
  // ⚠ « comp » SEULEMENT SI LE PLAN EST AVEC COMPLÉMENTS (30/09/2026). Kevin
  //   ajoutait des scoops de whey en collation 2 d'un plan sans compléments :
  //   la ligne était marquée complément, donc retirée des totaux ET de la fiche
  //   de l'athlète, tout en restant affichée ici. Un aliment que le coach pose
  //   à la main, sur un plan sans compléments, est un aliment comme un autre.
  //   Sur un plan avec compléments, il garde la marque : il suit l'interrupteur.
  _cplPlan.squelette.push({id:_cplId(),repas,portion:cle,q,u:po.u,comp:!!po.comp&&!!_cplPlan.avecComplements});
  renderPlanCoach();
}
// Une ligne de complément que l'interrupteur masque chez l'athlète, remise dans le plan.
function cplInclureLigne(lid){
  const l=_cplLigne(lid);
  if(!l) return false;
  delete l.comp;
  renderPlanCoach();
  return true;
}
// Le marqueur « source au choix ». C'est LUI qui compte les repas à source
// libre : poser trois marqueurs de protéines suffit à diviser par trois, sans
// que personne n'ait à toucher un réglage.
function cplAjouterMarqueur(repas,macro){
  if(!_cplPlan) return;
  _cplPlan.squelette.push({id:_cplId(),repas,src:macro});
  renderPlanCoach();
}
function cplAjouterLibre(repas){
  if(!_cplPlan) return;
  _cplPlan.squelette.push({id:_cplId(),repas,libre:'',q:1,u:'g',p:0,c:0,l:0});
  renderPlanCoach();
}
// La note du coach : « Sous forme de PANCAKES », « Dans une gourde de 1,5 L ».
// Elle ne compte nulle part, mais elle est la moitié de l'instruction — sans
// elle, l'athlète a une liste d'ingrédients et pas une recette.
function cplAjouterNote(repas){
  if(!_cplPlan) return;
  _cplPlan.squelette.push({id:_cplId(),repas,note:''});
  renderPlanCoach();
}
function cplAjouterFruit(repas){
  if(!_cplPlan) return;
  _cplPlan.squelette.push({id:_cplId(),repas,fruit:true});
  renderPlanCoach();
}
function cplSupprimerLigne(lid){
  if(!_cplPlan) return;
  const i=_cplPlan.squelette.findIndex(x=>x&&x.id===lid);
  if(i>=0) _cplPlan.squelette.splice(i,1);
  renderPlanCoach();
}
// oninput et non onchange sur les quantités : l'aperçu des grammages n'a
// d'intérêt que s'il suit la frappe. Le champ n'est PAS reconstruit à chaque
// touche — seul l'aperçu l'est — sinon le focus partirait au premier chiffre.
function cplSetChamp(lid,champ,v){
  const l=_cplLigne(lid);
  if(!l) return;
  if(champ==='libre') l.libre=String(v||'');
  else if(champ==='note') l.note=String(v||'');
  else if(champ==='u') l.u=String(v||'g');
  else l[champ]=_planNb(v);
  // ⚠ LA LIGNE ELLE-MÊME SE REFAIT (30/09/2026) : ses P/G/L restaient ceux
  //   d'avant la frappe. Un seul texte, sans champ : le focus ne bouge pas.
  try{ const z=document.getElementById('cpl-m-'+lid); if(z) z.innerHTML=_cplMacroLigne(l); }catch(e){}
  _cplRafraichirApercu();
}
// Retrait par INDICE et non par identifiant : une source hors Ciqual est un
// objet, et indexOf sur un objet recopié ne le retrouverait jamais.
function cplRetirerSource(macro,index){
  if(!_cplPlan) return;
  const l=macro==='p'?_cplPlan.sources.proteines:_cplPlan.sources.glucides;
  const i=Number(index);
  if(i>=0&&i<l.length) l.splice(i,1);
  renderPlanCoach();
}
// ⚠ _cplPaliers, cplSetPalier, cplAjouterPalier ET cplSupprimerPalier ONT
// ETE RETIREES le 08/09/2026 avec le tableau qu'elles editaient.
// La liste de courses a QUITTÉ l'écran de composition : le coach n'a pas à
// saisir des jours et des stocks. Côté athlète elle reste, et se calcule seule
// — planListeCourses compte déjà chaque ligne de repas sur PLAN_JOURS_SEMAINE
// quand rien n'est renseigné. Les plans où des jours ont déjà été saisis
// gardent leurs valeurs : _cplCopie recopie toujours `courses`, seuls les
// champs de saisie ont disparu.
//
// Ce qui n'est plus atteignable : régler les jours ligne par ligne, déclarer un
// stock, et faire entrer les sources interchangeables dans la liste (elles
// valent 0 jour par défaut — on ne peut pas deviner laquelle il choisira).

// ── Rendu ─────────────────────────────────────────────────────────────────
// Les macros d'une ligne, et pour une portion à la pièce (scoop, œuf, yaourt)
// ce que vaut UNE pièce : « 2 scoops » affichait « P 50 », et 50 se lisait
// comme 50 g de poudre, pas comme 50 g de protéines (Kevin, 30/09/2026).
function _cplMacroLigne(item){
  const txt=_cplMacroTxt(planMacrosItem(item));
  const po=item&&item.portion&&PLAN_PORTIONS[item.portion];
  const u=planUniteItem(item);
  if(!po||!planParUnite(u)||(po.p+po.c+po.l)<=0) return txt;
  const v=x=>String(Math.round(x*10)/10).replace('.',',');
  return txt+'<span class="cpl-m-u"> · 1 '+escapeHtml(u)+' = P '+v(po.p)+' · G '+v(po.c)+' · L '+v(po.l)+'</span>';
}
function _cplMacroTxt(m){
  if(!m) return '<span style="color:var(--orange)">non chiffré</span>';
  return 'P '+Math.round(m.p)+' · G '+Math.round(m.c)+' · L '+Math.round(m.l)
    +' · '+Math.round(m.kcal)+' kcal';
}
function _cplInput(val,oninput,largeur,pas){
  return `<input type="number" step="${pas||'any'}" value="${val==null?'':val}" oninput="${oninput}"
    style="width:${largeur||'62px'};padding:6px 8px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:700;text-align:center;box-sizing:border-box">`;
}
// Seul l'aperçu est reconstruit à la frappe. Reconstruire toute la page
// retirerait le focus du champ qu'on est en train de remplir.
function _cplRafraichirApercu(){
  // ⚠ LE PANNEAU « CE QU'IL RESTE À PLACER » ET LES EN-TÊTES DE REPAS SE
  //   REFONT À LA FRAPPE (30/09/2026). Kevin : « si je modifie la quantité,
  //   le petit tableau à côté ne bouge pas du tout ». Ils n'étaient peints que
  //   par renderPlanCoach, donc au prochain ajout ou retrait de ligne — la
  //   quantité changeait dans le plan, pas à l'écran. Aucun des deux ne porte
  //   de champ : les repeindre ne vole pas le focus.
  try{
    const side=document.querySelector('#s-coach-plan .cpl-side');
    if(side){
      const h=_cplHtmlSuivi();
      if(h){ side.outerHTML=h; _cplCalerSuivi(); }
    }
  }catch(e){}
  try{
    const tots=document.querySelectorAll('#s-coach-plan .cpl-tot[data-repas]');
    if(tots.length){
      const c=_cplAthlete();
      const cib=planCiblesJour(c,true,null), couv=planCouverture(_cplPlan), rest=planRestant(cib,couv);
      const ns={p:planNbSources(_cplPlan,'p'),c:planNbSources(_cplPlan,'c')};
      tots.forEach(t=>{ t.innerHTML=planTotalRepasHtml(planTotalRepas(couv.parRepas[t.dataset.repas],rest,ns)); });
    }
  }catch(e){}
  const z=document.getElementById('cpl-apercu');
  if(z) z.innerHTML=_cplHtmlApercu();
  // Les micronutriments du plan, recalculés à chaque retouche (build 1844).
  const mz=document.getElementById('cpl-micro');
  if(mz){ const o=!!(mz.querySelector('details')||{}).open; mz.innerHTML=_cplHtmlMicro(o); }
  const a=document.getElementById('cpl-alertes');
  if(a) a.innerHTML=_cplHtmlAlertes();
  // Les grammages des sources dépendent du restant : ils doivent se refaire à
  // la frappe, comme l'aperçu. Ce bloc ne contient aucun champ de saisie, le
  // repeindre ne peut donc pas voler le focus.
  const so=document.getElementById('cpl-sources');
  if(so) so.innerHTML=_cplHtmlSources();
}
// ══ LE PANNEAU QUI NE BOUGE PAS PENDANT QU'ON COMPOSE ════════════════════
//
// Kevin, 08/09/2026 : « je laisserais un menu qui ne bouge pas a droite avec un
// total de prot objectif qui se remplit, juste en dessous le total de prot
// restante divise par le nombre de repas avec la mention "Une source de
// proteines au choix" ; meme principe pour les glucides ; en dessous les
// lipides, le sel et les fibres — que le coach les voie toujours pendant qu'il
// fait le plan ».
//
// LE PROBLEME QU'IL RESOUT. Le tableau « Apercu » dit deja cible / squelette /
// restant, mais il est EN HAUT : des qu'on descend dans le troisieme repas, il
// est hors de l'ecran. Le coach ajoutait un aliment, remontait verifier ce
// qu'il restait, redescendait. Le panneau colle ; les chiffres le suivent.
//
// LES DEUX GRAMMAGES PAR SOURCE SONT LE COEUR. Le restant divise par le nombre
// de repas a source libre, c'est exactement ce que l'athlete lira sur sa fiche
// en face de « une source de proteines au choix ». Le coach compose en voyant
// ce que l'autre cote affichera — c'est deja la regle de planTotalRepas, on ne
// fait que la remonter sous les yeux.
//
// AUCUN CALCUL NEUF : planCiblesJour, planCouverture, planRestant,
// planNbSources et cibleSodiumJour, toutes deja lues par l'apercu. Un second
// calcul du meme restant finirait par annoncer deux chiffres.
// LE PANNEAU SE CALE SOUS LA BARRE DE TITRE, QUELLE QUE SOIT SA HAUTEUR.
// Meme raisonnement et meme mecanique que _ccdCalerAncres : AUCUNE VALEUR EN
// DUR — la hauteur est mesuree, et un ResizeObserver la reprend si elle change.
// Changer le bouton ENREGISTRER ou la police du titre ne redemandera pas de
// corriger un chiffre ici.
function _cplCalerSuivi(){
  try{
    const e=document.getElementById('s-coach-plan');
    const tb=e&&e.querySelector(':scope>.topbar');
    const z=e&&e.querySelector('.cpl-side');
    if(!tb||!z) return false;
    const poser=()=>{
      const h=Math.round(tb.getBoundingClientRect().height);
      // Le panneau est repose a chaque rendu : on vise l'element courant.
      const c=e.querySelector('.cpl-side');
      if(c&&h>0) c.style.setProperty('--cpl-top',(h+8)+'px');
    };
    poser();
    if(!window._cplTopObs&&typeof ResizeObserver==='function'){
      window._cplTopObs=new ResizeObserver(poser);
      window._cplTopObs.observe(tb);
    }
    return true;
  }catch(e){ return false; }
}
function _cplHtmlSuivi(){
  const c=_cplAthlete();
  if(!c) return '';
  const cib=planCiblesJour(c,true,null);
  if(!(cib.kcal>0)) return '';
  const couv=planCouverture(_cplPlan);
  const rest=planRestant(cib,couv);
  const nb=v=>Math.round(Number(v)||0).toLocaleString('fr-FR');
  let sel=null;
  try{ sel=cibleSodiumJour(c,localISODate(new Date()),
    {kcal:cib.kcal,p:cib.p,c:cib.c,l:cib.l}); }catch(e){ sel=null; }
  // LA PART DE CIBLE DEJA POSEE, EN POURCENTAGE : c'est la jauge qui « se
  // remplit ». Bornee a 100 pour que la barre ne deborde pas de son cadre —
  // le DEPASSEMENT, lui, se lit sur le restant, qui passe en orange et en
  // negatif. Une barre qui deborde ne dit pas de combien.
  const pct=(cible,couvert)=>{
    const t=Number(cible)||0;
    if(!(t>0)) return 0;
    return Math.max(0,Math.min(100,Math.round((Number(couvert)||0)*100/t)));
  };
  // Un bloc de macro : la cible, la jauge, et ce qui reste.
  const bloc=(coul,lib,cible,couvert,restant,src)=>{
    const r=(restant===null||restant===undefined)?null:Math.round(restant);
    return '<div class="cpl-s-b" style="--sb:'+coul+'">'
      +'<div class="cpl-s-h"><span class="cpl-s-l">'+escapeHtml(lib)+'</span>'
      +'<span class="cpl-s-v">'+nb(cible)+' g</span></div>'
      +'<div class="cpl-s-j"><i style="width:'+pct(cible,couvert)+'%"></i></div>'
      +'<div class="cpl-s-r">'+nb(couvert)+' g posés'
      +(r===null?'':(' · <b class="'+(r<0?'cpl-s-trop':'')+'">'
        +(r<0?('+'+nb(-r)+' g de trop'):(nb(r)+' g à placer'))+'</b>'))
      +'</div>'+(src||'')+'</div>';
  };
  // ══ LA LIGNE PAR SOURCE ════════════════════════════════════════════════
  //
  // Kevin, 08/09/2026 : « ca doit juste dire "… g de prot pour les sources de
  // prot au choix" — si j'en place 2 dans le plan, ca prend le total objectif
  // moins ce qui est atteint, divise par 2 ».
  // C'est exactement ce que fait planNbSources, et ca ne change pas : elle
  // compte les MARQUEURS reellement poses dans le squelette. Ce qui change,
  // c'est la phrase — « 27 g par repas, sur 4 repas » faisait lire un nombre
  // de repas, alors que ce sont des SOURCES, et qu'un repas peut en porter
  // deux ou aucune.
  //
  // ⚠ ET LE CAS OU AUCUNE SOURCE N'EST POSEE EST DIT. planNbSources retombe
  // alors sur PLAN_SOURCES_DEFAUT : le grammage serait divise par un nombre
  // que le coach n'a pas choisi et qu'il ne voit nulle part. On ne l'affiche
  // pas comme un resultat, on dit ce qu'il manque.
  //
  // Elle ne sort pas non plus quand il ne reste rien a placer : « 0 g par
  // source » se lirait comme une consigne, alors que ca veut dire que le
  // squelette couvre deja tout.
  const parSrc=(macro,restant)=>{
    const r=Number(restant);
    if(!isFinite(r)||r<=0) return '';
    const lib=macro==='p'?'protéines':'glucides';
    // Le compte REEL : le reglage force s'il existe, sinon les marqueurs poses.
    const forc=_planNb(_cplPlan&&_cplPlan.nRepasSourcesLibres);
    const force=(forc!=null&&forc>=1&&forc<=PLAN_SOURCES_MAX);
    const poses=planSquelette(_cplPlan).filter(x=>x&&x.src===macro).length;
    if(!force&&!poses) return '<div class="cpl-s-src cpl-s-src-vide">'
      +'Aucune source de '+lib+' au choix dans le plan.'
      +'<span>Pose-en une pour répartir les '+nb(r)+' g qui restent.</span></div>';
    const n=planNbSources(_cplPlan,macro);
    return '<div class="cpl-s-src">'
      +'<b>'+nb(r/n)+' g</b> de '+lib+' pour chacune des '+n+' sources au choix'
      +'</div>';
  };
  // ⚠ LA LIGNE DE PALIER A ETE RETIREE le 08/09/2026 : ce panneau annonce
  // desormais la cible du calcul du coach, sans second multiplicateur.
  return '<aside class="cpl-side" aria-label="Ce qu’il reste à placer">'
    +'<div class="cpl-s-t">Ce qu’il reste à placer</div>'
    +bloc('#ff2d3f','Protéines',cib.p,couv.p,rest.p,parSrc('p',rest.p))
    +bloc('#f5c518','Glucides',cib.c,couv.c,rest.c,parSrc('c',rest.c))
    +bloc('#22c55e','Lipides',cib.l,couv.l,rest.l,'')
    // ⚠ SEL ET FIBRES N'ONT PAS DE « COUVERT ». planCouverture ne totalise que
    // les trois macros energetiques : les lignes du squelette ne portent ni sel
    // ni fibres. Afficher une jauge vide ferait croire a zero pose ; on affiche
    // la CIBLE seule, qui est ce que le coach vient y chercher.
    +'<div class="cpl-s-b cpl-s-nu" style="--sb:#a0a0a0">'
      +'<div class="cpl-s-h"><span class="cpl-s-l">Sel</span>'
      +'<span class="cpl-s-v">'+(sel?String(Math.round(sel.targetSaltG*10)/10).replace('.',','):'-')+' g</span></div>'
      +'<div class="cpl-s-r">cible du jour, non comptée dans le squelette</div></div>'
    +'<div class="cpl-s-b cpl-s-nu" style="--sb:#7f9f4e">'
      +'<div class="cpl-s-h"><span class="cpl-s-l">Fibres</span>'
      +'<span class="cpl-s-v">'+nb(cib.f)+' g</span></div>'
      +'<div class="cpl-s-r">cible du jour, non comptée dans le squelette</div></div>'
    +'<div class="cpl-s-k">'+nb(couv.kcal)+' / '+nb(cib.kcal)+' kcal posées</div>'
    +'</aside>';
}
// PURE. La cible ENREGISTREE est-elle encore celle du calcul ?
//
// ⚠ LA DIVERGENCE QUI NE SE VOIT PAS. Le composeur de plan lit
// nutrition.macros — la copie ECRITE dans le dossier, celle que l'athlete a
// sous les yeux — pendant que la fiche affiche cibleTableur, RECALCULE a
// chaque rendu. Les deux sont d'accord tant que le coach a applique ses
// cibles ; des qu'il change un g/kg, un NAF ou un coefficient sans appuyer sur
// « Appliquer a l'athlete », la fiche avance et le plan reste. Mesure le
// 08/09/2026 : fiche 2 891 kcal, plan 2 521, et aucun ecran ne le disait.
//
// ON NE CORRIGE PAS TOUT SEUL, et c'est deliberé : appliquer une cible change
// ce que l'athlete mange demain. C'est un geste de coach, pas un effet de
// bord de l'ouverture d'un ecran. On le SIGNALE, avec le bouton a cote.
//
// `manuel===true` SEULEMENT : saisieManuelle rend vrai des qu'un dossier porte
// des macros, meme sans drapeau explicite — donc pour presque tous les
// dossiers existants. Ici il faut le contraire d'un repli prudent : tant que
// le coach n'a pas explicitement pris la main, le tableur est la reference.
function ecartCiblesTableur(c){
  if(!c) return null;
  const nut=c.nutrition||{};
  if(nut.manuel===true) return null;
  let t=null;
  try{ t=cibleTableur(c,{}); }catch(e){ return null; }
  if(!t||(t.manque&&t.manque.length)||!(t.kcal>0)) return null;
  let j=null;
  try{ j=_tbJournees(c,t,dieteCyclee(c)); }catch(e){ return null; }
  if(!j||!j.on) return null;
  const calc=Math.round(kcalDesMacros(j.on.p,j.on.g,j.on.l));
  const enr=Math.round(Number(((nut.macros||{}).on||{}).kcal)||0);
  if(!(calc>0)) return null;
  // Dix kilocalories : en dessous, c'est un arrondi de conversion, pas un
  // reglage qui a bouge.
  if(enr>0&&Math.abs(calc-enr)<10) return null;
  return {calc:calc,enregistre:enr};
}
function _cplHtmlDesync(c){
  let e=null; try{ e=ecartCiblesTableur(c); }catch(e2){ e=null; }
  if(!e) return '';
  const nb=v=>Math.round(v).toLocaleString('fr-FR');
  return '<div style="background:var(--warning-bg);border:1px solid var(--warning-border);'
    +'border-radius:var(--r-2);padding:10px 12px;margin-bottom:10px">'
    +'<div style="font-size:var(--fs-2xs);color:var(--orange);font-weight:800;'
    +'letter-spacing:1px;text-transform:uppercase;margin-bottom:4px">Cibles pas à jour</div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-strong);line-height:1.55">'
    // ⚠ LE SENS DE CETTE BANNIERE A CHANGE le 08/09/2026, ET C'EST IMPORTANT.
    // Avant, c'est LE PLAN qui etait en retard : il lisait la copie
    // enregistree. Depuis que planCiblesJour part du calcul de la fiche, le
    // plan est a jour — c'est le DOSSIER DE L'ATHLETE qui ne l'est pas, et
    // donc son ecran a lui. Dire l'inverse enverrait le coach chercher une
    // erreur du mauvais cote.
    +(e.enregistre>0
      ?('Ce plan suit le calcul de sa fiche, <b>'+nb(e.calc)+' kcal</b>. Son dossier, lui, '
        +'porte encore <b>'+nb(e.enregistre)+' kcal</b> : c’est ce que son écran affiche.')
      :('Ce plan suit le calcul de sa fiche, <b>'+nb(e.calc)+' kcal</b>. Aucune cible n’est '
        +'enregistrée dans son dossier : son écran n’affiche encore rien.'))
    +' Applique ces cibles depuis sa fiche pour que son écran dise la même chose.</div>'
    +'</div>';
}
function _cplHtmlApercu(){
  const c=_cplAthlete();
  if(!c) return '';
  const cib=planCiblesJour(c,true,null);
  const couv=planCouverture(_cplPlan);
  const rest=planRestant(cib,couv);
  if(!(cib.kcal>0))
    return `<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6">Aucun objectif enregistré pour cet athlète : fixe d'abord ses macros sur sa fiche, les grammages en découlent.</div>`;
  const lig=(lib,cible,couvert,restant,unite)=>`
    <div style="display:grid;grid-template-columns:74px 1fr 1fr 1fr;gap:6px;align-items:center;padding:6px 0;border-top:1px solid var(--surface-2)">
      <div style="font-size:var(--fs-2xs);font-weight:800;color:var(--sub);letter-spacing:1px">${lib}</div>
      <div style="font-size:var(--fs-sm);font-weight:700;text-align:center">${Math.round(cible)}${unite}</div>
      <div style="font-size:var(--fs-sm);color:var(--sub);text-align:center">${Math.round(couvert)}${unite}</div>
      <div style="font-size:var(--fs-sm);font-weight:800;text-align:center;color:${restant<0?'var(--orange)':'var(--green)'}">${Math.round(restant)}${unite}</div>
    </div>`;
  // ⚠ D'OU SORT LE TOTAL DE CET APERCU. Kevin, 08/09/2026 : « mon calcul, le
  // bon, ne donne pas le meme que sur la creation du plan ». Il comparait
  // « Besoin selon l'objectif » de la fiche — un total AVANT cyclage — au
  // total de cet apercu, qui est celui d'un JOUR D'ENTRAINEMENT, glucides
  // +15 %. Les deux etaient justes ; rien ne disait qu'ils ne parlaient pas de
  // la meme journee.
  const _cycA=(function(){ try{ return dieteCyclee(c); }catch(e){ return false; } })();
  const bandeauCycle=_cycA
    ? `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-bottom:8px">Diète cyclée : ce sont les chiffres du <b>jour d’entraînement</b>, glucides +${cycleGlucides(c,100).cycle?cycleGlucides(c,100).pctOn:Math.round(CYCLE_GLUC*100)} %. Les jours de repos, ils descendent de ${cycleGlucides(c,100).pctOff} %, pour que la semaine garde la cible. Le total « avant cyclage » est celui de sa fiche.</div>`
    : '';
  // ⚠ LE BANDEAU DE PALIER A ETE REMPLACE le 08/09/2026. Il expliquait un
  // multiplicateur qui n'existe plus ; ce qui compte maintenant, c'est de dire
  // d'OU sortent ces chiffres — du meme calcul que la fiche, sans retouche.
  const bandeauPalier=`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-bottom:8px">Ces cibles sont celles du calcul de sa fiche, telles quelles : aucun multiplicateur ne s’applique par-dessus.</div>`;
  // L'aperçu montrait ici les quatre premières sources de chaque macro, suivies
  // d'un « + N autres ». C'était une version tronquée des deux tableaux du bas
  // de l'écran, qui portent maintenant la liste ENTIÈRE avec les mêmes
  // grammages : deux affichages du même chiffre, dont un incomplet. Seul le
  // tableau reste. L'aperçu garde ce qu'il est seul à dire — cible, couvert,
  // restant.
  return `<div class="plan-card" style="margin-bottom:0">
    <div class="plan-titre"><span class="plan-titre-t">Aperçu · jour d'entraînement</span></div>
    <div class="plan-corps" style="padding-top:10px">
    ${bandeauCycle}${bandeauPalier}
    ${_cplHtmlDesync(c)}
    <div style="display:grid;grid-template-columns:74px 1fr 1fr 1fr;gap:6px">
      <div></div>
      <div style="font-size:var(--fs-2xs);font-weight:800;color:var(--text-faint);letter-spacing:1px;text-align:center">CIBLE</div>
      <div style="font-size:var(--fs-2xs);font-weight:800;color:var(--text-faint);letter-spacing:1px;text-align:center">SQUELETTE</div>
      <div style="font-size:var(--fs-2xs);font-weight:800;color:var(--text-faint);letter-spacing:1px;text-align:center">RESTANT</div>
    </div>
    ${lig('PROTÉINES',cib.p||0,couv.p,rest.p||0,' g')}
    ${lig('GLUCIDES',cib.c||0,couv.c,rest.c||0,' g')}
    ${lig('LIPIDES',cib.l||0,couv.l,rest.l||0,' g')}
    ${lig('CALORIES',cib.kcal||0,couv.kcal,(cib.kcal||0)-couv.kcal,'')}
    ${_cplHtmlImplicites(couv)}
    </div>
  </div>`;
}
// Ce que la colonne « squelette » contient SANS qu'aucune ligne le porte.
// Le tableur ajoutait ces deux montants en dur, sans les écrire nulle part :
// le coach voyait un total qu'il ne pouvait pas refaire à la main. Ici ils
// sont dits, chiffrés, et le coach peut les corriger.
function _cplHtmlImplicites(couv){
  const f=couv&&couv.fruits, h=couv&&couv.huileCuisson;
  const bouts=[];
  if(f&&f.n>0) bouts.push(f.n+' portion'+(f.n>1?'s':'')+' de fruit à '
    +f.parPortion+' g de glucides');
  if(h&&h.lipides>0) bouts.push(h.lipides+' g de lipides d\'huile de cuisson');
  if(!bouts.length) return '';
  return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px;padding-top:8px;border-top:1px solid var(--surface-2)">Compté dans le squelette sans ligne dédiée : ${escapeHtml(bouts.join(' · '))}.</div>`;
}
// L'ENCART « MICRONUTRIMENTS DU PLAN », replié par défaut (build 1844) : une
// ligne de synthèse en tête, puis une ligne par nutriment. Rien côté athlète.
let _cplMicroCharge=false;
function _cplHtmlMicro(ouvert){
  const c=_cplAthlete();
  if(!c||!_cplPlan||!planSquelette(_cplPlan).length) return '';
  if(!(Array.isArray(_ciqualDB)&&_ciqualDB.length)){
    // La base arrive : on la charge, puis on repeint l'encart seul.
    if(!_cplMicroCharge){
      _cplMicroCharge=true;
      Promise.resolve().then(()=>_loadCiqual()).then(()=>{
        const mz=document.getElementById('cpl-micro'); if(mz) mz.innerHTML=_cplHtmlMicro(false);
      }).catch(()=>{}).finally(()=>{ _cplMicroCharge=false; });
    }
    return '';
  }
  let mp=null; try{ mp=microPlan(_cplPlan,c); }catch(e){ mp=null; }
  if(!mp) return '';
  const cles=Object.keys(MICRO_REFS).filter(k=>mp[k]&&mp[k].partDocumentee>0);
  if(!cles.length) return '';
  const ligne=k=>{
    const x=mp[k], pct=Math.round((x.part||0)*100), larg=Math.max(0,Math.min(100,pct));
    const voir=(x.part!=null&&x.part<MICRO_COUVERTURE_SEUIL)
      ?' <button type="button" class="lien-discret" style="background:none;border:none;padding:0;margin:0;font:inherit;color:var(--sub);text-decoration:underline;cursor:pointer" onclick="cplVoirAlimentsMicro(\''+k+'\',this)">Voir 3 aliments</button>':'';
    return '<div style="padding:2px 0"><div style="display:flex;align-items:center;gap:8px">'
      +'<span style="flex:0 0 92px;font-size:var(--fs-xs);color:var(--text-strong);white-space:nowrap">'+escapeHtml(x.lib)+'</span>'
      +'<span aria-hidden="true" style="flex:1;height:4px;background:var(--border);border-radius:var(--r-1);overflow:hidden"><span style="display:block;height:100%;width:'+larg+'%;background:var(--sub)"></span></span>'
      +'<span style="flex:0 0 auto;min-width:38px;text-align:right;font-size:var(--fs-xs);color:var(--text-strong)">'+pct+' %</span></div>'
      +(x.partDocumentee<0.9?'<div style="font-size:var(--fs-2xs);color:var(--text-faint)">calculé sur '+Math.round(x.partDocumentee*100)+' % du plan</div>':'')
      +(voir?'<div style="font-size:var(--fs-2xs)">'+voir+'<span class="cpl-micro-al"></span></div>':'')
      +'</div>';
  };
  return '<details class="cpl-micro"'+(ouvert?' open':'')+' style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 12px;margin-bottom:14px">'
    // LA SYNTHÈSE EST DANS L'EN-TÊTE : elle se lit encart fermé, sans clic.
    +'<summary style="font-size:var(--fs-xs);color:var(--sub);cursor:pointer">Micronutriments du plan (journée type)'
    +'<div class="cpl-micro-synthese" style="font-size:var(--fs-xs);color:var(--text);margin:4px 0 0">'+escapeHtml(syntheseMicroPlan(mp))+'</div></summary>'
    +cles.map(ligne).join('')
    +'</details>';
}
// « Voir 3 aliments » : alimentsRichesEn, filtré par le régime et les évictions
// de l'ATHLÈTE (build 1843).
function cplVoirAlimentsMicro(cle,btn){
  const c=_cplAthlete();
  if(!c) return false;
  let l=[]; try{ l=alimentsRichesEn(c,cle,3); }catch(e){ l=[]; }
  const z=btn&&btn.parentNode&&btn.parentNode.querySelector('.cpl-micro-al');
  if(z) z.textContent=l.length?' : '+l.map(x=>x.nom).join(' · '):' : aucune proposition';
  return true;
}
function _cplHtmlAlertes(){
  const c=_cplAthlete();
  if(!c) return '';
  let l=[];
  try{ l=planAlertes(_cplPlan,c); }catch(e){ l=['Aperçu indisponible : '+e.message]; }
  if(!l.length) return '';
  // UN SQUELETTE QUI DÉPASSE SE RÉDUIT EN UN CLIC (build 1841) : le bouton
  // n'apparaît que si une réduction est possible.
  let red=null;
  try{ red=planReduireSquelette(_cplPlan,planCiblesJour(c,true,null)); }catch(e){ red=null; }
  return `<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:12px;margin-bottom:14px">
    <div style="font-size:var(--fs-xs);color:var(--orange);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:8px">À regarder</div>
    ${l.map(x=>`<div style="font-size:var(--fs-xs);color:var(--text);line-height:1.6;margin-bottom:4px">• ${escapeHtml(x)}</div>`).join('')}
    ${red&&red.changements.length?'<button class="btn btn-outline btn-sm cpl-ajuster-squelette" style="width:100%;margin:8px 0 0;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjusterSquelette()">Ajuster le squelette</button>':''}
  </div>`;
}
// Montre la liste des changements, puis enregistre (savePlanCoach).
async function cplAjusterSquelette(){
  const c=_cplAthlete();
  if(!c||!_cplPlan) return false;
  const red=planReduireSquelette(_cplPlan,planCiblesJour(c,true,null));
  if(!red.changements.length){ toast('Rien à réduire','var(--orange)'); return false; }
  const nb=v=>String(v).replace('.',',');
  const NL=String.fromCharCode(10);
  const ok=await rcConfirm('Ajuster le squelette ?',
    red.changements.map(x=>'• '+x.nom+' : '+nb(x.avant)+' → '+nb(x.apres)+' '+x.u).join(NL),'Ajuster');
  if(!ok) return false;
  _cplPlan=red.plan;
  savePlanCoach();
  try{ renderPlanCoach(); }catch(e){}
  return true;
}
// Les deux catalogues, dans la mise en forme EXACTE de la fiche de l'athlète —
// même fonction de tableau, mêmes lignes, mêmes couleurs. Le coach voit ce que
// l'autre côté affichera, et les grammages se refont à chaque retouche : c'est
// _cplRafraichirApercu qui repeint ce bloc, comme l'aperçu des macros.
//
// Les commandes d'édition restent DESSOUS, hors du tableau. Le tableau dit ce
// que l'athlète mange ; la liste dit ce que le coach a mis au catalogue, avec
// la valeur pour 100 g et la marque « hors Ciqual » qui n'ont leur place ni
// l'une ni l'autre sur l'écran de l'athlète.
function _cplHtmlSources(){
  const c=_cplAthlete();
  if(!c) return '';
  let src=null;
  try{
    const cib=planCiblesJour(c,true,null);
    src=planSources(_cplPlan,planRestant(cib,planCouverture(_cplPlan)));
  }catch(e){}
  const bloc=(macro,titre)=>{
    const ids=planCatalogue(_cplPlan,macro);
    const n=planNbSources(_cplPlan,macro);
    const col=PLAN_COULEURS[macro];
    const rgba=(a)=>macro==='p'?`rgba(255,59,48,${a})`:`rgba(245,197,24,${a})`;
    const b=src?(macro==='p'?src.proteines:src.glucides):null;
    const table=b
      ?planTableau4(planLignesSources(b),col,false,'Aucune source à ce catalogue : ajoutes-en une ci-dessous.')
      :`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;padding:6px 2px">Grammages indisponibles tant que ses macros ne sont pas fixées sur sa fiche.</div>`;
    return `<div class="plan-card">
      <div class="plan-titre" style="background:linear-gradient(90deg,${rgba(.55)},${rgba(.3)} 62%,${rgba(.1)});border-left-color:${col}">
        <span class="plan-titre-t">${titre}</span>
        <span style="margin-left:auto;flex-shrink:0;font-size:var(--fs-2xs);font-weight:700;color:rgba(255,255,255,.85)">${ids.length} source${ids.length>1?'s':''} · ÷ ${n}</span>
      </div>
      <div class="plan-corps">
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin:8px 0 6px">Le restant se divise par ${n} repas. L'athlète permute librement dans cette liste sans dérégler ses macros.</div>
      ${table}
      <details class="plan-src"${_cplSrcOuvert[macro]?' open':''} ontoggle="cplNoterSources('${macro}',this.open)">
        <summary style="color:var(--sub)">Modifier le catalogue<span class="plan-src-nb">${ids.length}</span></summary>
        <div class="plan-src-liste">
      ${ids.map((s,i)=>{
        const r=planSourceRef(s,macro);
        const per=r?r.per100:null;
        const marque=r&&r.horsCiqual
          ?'<span style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;padding:1px 6px;border-radius:var(--r-2);border:1px solid var(--border);color:var(--sub);margin-left:6px">HORS CIQUAL</span>':'';
        return `<div class="plan-l">
          <div style="flex:1;min-width:0">
            <div style="font-size:var(--fs-xs);font-weight:600;line-height:1.35">${escapeHtml(r?r.nom:'-')}${marque}</div>
            <div style="font-size:var(--fs-2xs);color:${(per>0)?'var(--text-faint)':'var(--orange)'}">${per==null?'valeur absente de la table':String(per).replace('.',',')+' g / 100 g'}</div>
          </div>
          <button onclick="cplRetirerSource('${macro}',${i})" aria-label="Retirer du catalogue"
            style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;padding:4px 2px;line-height:1;flex-shrink:0">${icon('croix',14)}</button>
        </div>`;
      }).join('')}
      <button class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0;font-size:var(--fs-2xs);letter-spacing:.5px"
        onclick="ouvrirRecherchePlan({mode:'source',macro:'${macro}'})">+ Ajouter une source</button>
        </div>
      </details>
      </div>
    </div>`;
  };
  return bloc('p','Protéines')+bloc('c','Glucides');
}
function _cplHtmlLigne(item){
  const nom=planNomItem(item);
  const sup=`<button onclick="cplSupprimerLigne('${item.id}')" aria-label="Retirer cette ligne"
    style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-lg);cursor:pointer;padding:4px 2px;line-height:1;flex-shrink:0">${icon('croix',14)}</button>`;
  // Couleurs PLAN_COULEURS : le coach voit ici exactement ce que son athlète
  // verra sur sa fiche. Les protéines étaient en bleu de ce côté-ci et en rouge
  // de l'autre — la même ligne changeait de sens selon l'écran.
  if(item.src){
    return `<div class="plan-l" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:${PLAN_COULEURS[item.src]}">${escapeHtml(nom)}</div>
        <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:2px">Ce repas compte dans la division des sources.</div>
      </div>${sup}</div>`;
  }
  if(item.fruit){
    return `<div class="plan-l" style="align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:${PLAN_COULEURS.fruit}">${escapeHtml(nom)}</div>
        <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:2px">Ouvre la table des équivalences de fruits sous la ligne, la même pour tous.</div>
      </div>${sup}</div>`;
  }
  if(item.note!=null){
    return `<div class="plan-l">
      <input value="${escapeHtml(item.note)}" placeholder="Note de préparation (ex : sous forme de PANCAKES)" oninput="cplSetChamp('${item.id}','note',this.value)"
        style="flex:1;min-width:0;padding:6px 8px;background:var(--surface-1);border:1px dashed var(--border);border-radius:var(--r-2);color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-style:italic;box-sizing:border-box">
      ${sup}</div>`;
  }
  const m=planMacrosItem(item);
  const champNom=item.libre!=null
    ? `<input value="${escapeHtml(item.libre)}" placeholder="Nom de la ligne" oninput="cplSetChamp('${item.id}','libre',this.value)"
        style="width:100%;padding:6px 8px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:700;box-sizing:border-box">`
    : `<div style="font-size:var(--fs-sm);font-weight:700;line-height:1.35">${escapeHtml(nom)}${item.recette?' <span class="rct-b">recette</span>':''}</div>`;
  const macrosMain=item.libre!=null
    ? `<div style="display:flex;gap:6px;align-items:center;margin-top:6px">
        <span style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:.5px">pour ${planParUnite(planUniteItem(item))?'1 '+escapeHtml(planUniteItem(item)):'100 g'} :</span>
        ${_cplInput(item.p,`cplSetChamp('${item.id}','p',this.value)`,'52px')}
        ${_cplInput(item.c,`cplSetChamp('${item.id}','c',this.value)`,'52px')}
        ${_cplInput(item.l,`cplSetChamp('${item.id}','l',this.value)`,'52px')}
        <span style="font-size:var(--fs-2xs);color:var(--text-faint)">P/G/L</span>
      </div>`
    : '';
  // ⚠ CE QUE L'ATHLÈTE NE VOIT PAS EST DIT ICI (30/09/2026). Une ligne de
  //   complément sur un plan sans compléments n'est ni comptée ni envoyée
  //   (planLigneRetenue) : elle s'affichait pourtant ici comme les autres.
  const _masquee=!!(item.comp&&!(_cplPlan&&_cplPlan.avecComplements));
  const _noteMasquee=_masquee?`<div class="cpl-masquee">Masquée chez l’athlète : les compléments sont désactivés sur ce plan, cette ligne n’est ni comptée ni envoyée.
      <button type="button" onclick="cplInclureLigne('${item.id}')">L’inclure quand même</button></div>`:'';
  return `<div class="plan-l${_masquee?' cpl-l-masquee':''}" style="display:block">
    <div style="display:flex;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">${champNom}
        <div id="cpl-m-${item.id}" style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">${_cplMacroLigne(item)}</div>
      </div>
      ${_cplInput(item.q,`cplSetChamp('${item.id}','q',this.value)`,'64px')}
      <input value="${escapeHtml(planUniteItem(item))}" oninput="cplSetChamp('${item.id}','u',this.value)" aria-label="Unité"
        style="width:62px;padding:6px 6px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);text-align:center;box-sizing:border-box">
      ${sup}
    </div>
    ${macrosMain}${_noteMasquee}
  </div>`;
}
// Le bandeau de modèle. Il porte TOUJOURS les quatre choix : quand rien n'a
// pu être déduit, un écran vide laissait le coach tout composer à la main —
// exactement ce que ce lot existe pour éviter. Et même quand la déduction est
// bonne, il doit pouvoir en changer d'un clic sans aller modifier la phase de
// son athlète.
// L'ORDRE DE L'ECRAN, ET NON celui de l'objet : les paires se lisent en
// colonnes — homme a gauche, femme a droite — et les cinq familles se suivent
// du plus restrictif au plus neutre.
const PLAN_MODELES_LISTE=Object.freeze(['seche_H','seche_F','masse_H','masse_F',
  'recomp_H','recomp_F','maintien_H','maintien_F','peak_H','peak_F']);
function _cplHtmlModele(c){
  const s=planModeleSuggere(c);
  const pose=_cplPlan&&_cplPlan.modele;
  const choix=PLAN_MODELES_LISTE.map(k=>{
    const actif=(pose===k);
    return `<button onclick="cplPoserModele('${k}')"
      style="flex:1 1 46%;padding:10px 6px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.4px;line-height:1.3;border:1.5px solid ${actif?'var(--red)':'var(--border)'};background:${actif?'rgba(224,32,32,.12)':'#111'};color:${actif?'var(--text)':'#8a8a8a'}">${escapeHtml(planModeleLib(k))}</button>`;
  }).join('');
  let entete;
  if(pose){
    entete=_cplNeuf
      ?'Composition posée depuis le modèle <b>'+escapeHtml(planModeleLib(pose))
        +'</b>. Relis-la, ajuste les quantités, puis enregistre : rien n\'est encore parti chez l\'athlète.'
      :'Cette composition part du modèle <b>'+escapeHtml(planModeleLib(pose))+'</b>.';
  } else if(s.cle){
    entete='Modèle suggéré pour cet athlète : <b>'+escapeHtml(planModeleLib(s.cle))+'</b>'
      +(s.source==='objectif'?' : d\'après son objectif, faute de phase déclarée.':' : d\'après sa phase.');
  } else {
    let t=null; try{ t=typePhase(c); }catch(e){}
    entete=(t?'Sa phase est en '+escapeHtml(PHASES[t]?PHASES[t].lib.toLowerCase():t)
        +', pour laquelle il n\'existe pas de tableur.'
      :'Ni phase ni objectif déclarés pour cet athlète.')
      +' Choisis le modèle à poser :';
  }
  return `<div style="background:${_cplNeuf?'var(--info-bg)':'var(--surface-1)'};border:1px solid ${_cplNeuf?'var(--info-border)':'var(--border)'};border-radius:var(--r-3);padding:12px;margin-bottom:14px">
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6;margin-bottom:10px">${entete}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${choix}</div>
  </div>`;
}
// Le sélecteur vit JUSTE AU-DESSUS du squelette : c'est lui qui en change
// l'ordre, le lire ailleurs obligerait à faire l'aller-retour pour comprendre
// pourquoi les repas ont bougé.
function _cplHtmlMoment(c,moment){
  const pose=(_cplPlan&&_cplPlan.momentSeance)||null;
  let q=null; try{ q=_periSeanceCle(c); }catch(e){}
  const choix=PLAN_MOMENTS.map(m=>{
    const actif=(moment===m.cle);
    return `<button onclick="cplSetMoment('${m.cle}')"
      style="flex:1 1 30%;padding:10px 6px;border-radius:var(--r-2);cursor:pointer;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.4px;line-height:1.3;border:1.5px solid ${actif?'var(--red)':'var(--border)'};background:${actif?'rgba(224,32,32,.12)':'#111'};color:${actif?'var(--text)':'#8a8a8a'}">${escapeHtml(m.lib)}</button>`;
  }).join('');
  // D'où vient la valeur affichée. Sans cette phrase, un coach qui n'a rien
  // choisi croit avoir choisi.
  const source=pose
    ?('Ton choix.'+(q&&q!==pose?' Son questionnaire dit « '+escapeHtml(planMomentLib(q))+' ».':''))
    :(q?'D\'après son questionnaire de départ.':'Aucune réponse à son questionnaire : position d\'origine.');
  const retour=pose
    ?`<button onclick="cplSetMoment('')" style="background:none;border:none;color:var(--text-dim);font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);text-decoration:underline;cursor:pointer;padding:8px 0 0">Suivre sa réponse plutôt que la mienne</button>`
    :'';
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
    <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Moment de la séance</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin:2px 0 10px">« Avant séance », « Pendant la séance » et « Après séance » se déplacent ensemble à cet endroit de la journée. ${source}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${choix}</div>
    ${retour}
  </div>`;
}
function cplSetMoment(v){
  if(!_cplPlan) return;
  _cplPlan.momentSeance=PLAN_ANCRE_SEANCE[v]?v:null;
  renderPlanCoach();
}
function renderPlanCoach(){
  const el=document.getElementById('cpl-body');
  if(!el) return;
  const _vrr=rcVerrou('dieteCalculee');
  if(_vrr){ el.innerHTML=_vrr; return; }
  if(!_cplPlan){ el.innerHTML=''; return; }
  const c=_cplAthlete();
  if(!c){ el.innerHTML=''; return; }
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Athlète';
  const dt=typeDiete(c.nutrition||{});
  const parRepas={};
  for(const it of _cplPlan.squelette){
    const k=it.repas||'petit_dej';
    (parRepas[k]=parRepas[k]||[]).push(it);
  }
  const moment=planMoment(_cplPlan,c);
  const clesUtilisees=Object.keys(parRepas).sort((a,b)=>planOrdreRepas(a,moment)-planOrdreRepas(b,moment));
  const optionsPortions=Object.keys(PLAN_PORTIONS).map(k=>{
    const po=PLAN_PORTIONS[k];
    return `<option value="${k}">${escapeHtml(po.lib)}${po.comp?' (complément)':''}</option>`;
  }).join('');
  // Les mêmes chiffres que la fiche de l'athlète, calculés une fois pour tous
  // les repas : le coach compose en voyant ce que l'autre côté affichera.
  const _cCib=planCiblesJour(c,true,null);
  const _cCouv=planCouverture(_cplPlan);
  const _cRest=planRestant(_cCib,_cCouv);
  const _cNSrc={p:planNbSources(_cplPlan,'p'),c:planNbSources(_cplPlan,'c')};
  const blocRepas=(cle)=>{
    const lignes=parRepas[cle]||[];
    const replie=!!_cplPliage[cle];
    const tot=planTotalRepasHtml(planTotalRepas(_cCouv.parRepas[cle],_cRest,_cNSrc));
    return `<div class="plan-card">
      <div class="plan-titre" onclick="cplPlier('${cle}')" role="button" tabindex="0"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
        style="cursor:pointer">
        <span class="plan-titre-t">${escapeHtml(planLibRepas(cle))}</span>
        <span class="cpl-tot" data-repas="${escapeHtml(cle)}" style="display:contents">${tot}</span>
        <span style="flex-shrink:0;font-size:var(--fs-2xs);color:rgba(255,255,255,.7);margin-left:8px">${lignes.length} ligne${lignes.length>1?'s':''}</span>
        <span style="flex-shrink:0;font-size:var(--fs-xs);color:rgba(255,255,255,.8);margin-left:4px">${replie?'▶':'▼'}</span>
      </div>
      <div class="plan-corps">
      ${replie?'':`
        ${lignes.map(_cplHtmlLigne).join('')}
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="ouvrirRecherchePlan({mode:'squelette',repas:'${cle}'})">+ Aliment Ciqual</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplChoisirRecette('${cle}')">+ Recette</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjouterLibre('${cle}')">+ Ligne libre</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjouterMarqueur('${cle}','p')">+ Source protéines au choix</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjouterMarqueur('${cle}','c')">+ Source glucides au choix</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjouterFruit('${cle}')">+ Portion de fruit au choix</button>
          <button class="btn btn-outline btn-sm" style="margin:0;flex:1 1 46%;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="cplAjouterNote('${cle}')">+ Note de préparation</button>
          <select onchange="if(this.value){cplAjouterPortion('${cle}',this.value);this.value='';}"
            style="flex:1 1 100%;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700">
            <option value="">+ Portion à la pièce (œuf, scoop, gélule…)</option>${optionsPortions}
          </select>
        </div>`}
      </div>
    </div>`;
  };
  // Le catalogue prend la couleur de sa macro sur tout le bandeau, comme la
  // fiche de l'athlète : le coach retrouve d'un coup d'œil le bloc rouge des
  // protéines et le bloc jaune des glucides.
  // ⚠ paliers, pc ET noteMasse ONT ETE RETIRES le 08/09/2026 avec le tableau
  // « Periodisation » : voir la pierre tombale de PLAN_PHASES_DEFAUT.
  // ⚠ LE CORPS PASSE EN DEUX COLONNES le 08/09/2026 : la composition a gauche,
  // le panneau de suivi a droite, colle en haut. Sous 1 000 px il repasse
  // au-dessus du contenu, et reste colle : c'est la meme information, et elle
  // doit rester sous les yeux dans les deux cas.
  // La mesure du calage se fait APRES l'ecriture : le panneau n'existe pas
  // avant. setTimeout 0 plutot qu'un appel direct — le navigateur n'a pas
  // encore dispose le nouveau balisage, et getBoundingClientRect rendrait la
  // hauteur de l'ancien.
  setTimeout(()=>{ try{ _cplCalerSuivi(); }catch(e){} },0);
  el.innerHTML=`<div class="cpl-grille">${_cplHtmlSuivi()}<div class="cpl-col">
    <div style="margin-bottom:14px">
      <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase">Plan alimentaire de</div>
      <div style="font-size:var(--fs-lg);font-weight:900;line-height:1.2;margin-top:2px">${escapeHtml(nom)}</div>
      ${dt!=='strict'?`<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;margin-top:6px">Cet athlète est en diète flexible : il ne verra pas ce plan tant que tu n'auras pas basculé son suivi en diète stricte sur sa fiche.</div>`:''}
    </div>
    ${_cplHtmlModele(c)}
    <!-- LA FICHE A IMPRIMER, DU COTE DU COACH AUSSI. C'est lui qui la donne :
         il la relit avant de l'envoyer, et il l'imprime pour les athletes qui
         n'ouvrent pas l'application. Elle ouvre EXACTEMENT la meme planche que
         le bouton de l'athlete, remplie avec le plan enregistre.
         ELLE IMPRIME LA COMPOSITION EN COURS, et c'est voulu : _cplAthlete()
           rend le dossier avec le plan de l'ECRAN, pas celui enregistre. Le
           coach ajuste, regarde la planche, ajuste encore : imprimer le
           dossier enregistre lui montrerait autre chose que ce qu'il a sous
           les yeux. L'athlete, lui, ne verra ces lignes qu'apres
           « Enregistrer » : c'est deja la regle de cet ecran. -->
    <button class="btn btn-outline btn-doigt" style="width:100%;margin-bottom:14px"
      onclick="ouvrirFicheAlim(_cplAthlete())">Fiche alimentaire à imprimer</button>
    <div id="cpl-alertes">${_cplHtmlAlertes()}</div>
    <div id="cpl-micro">${_cplHtmlMicro(false)}</div>
    <div id="cpl-apercu" style="margin-bottom:16px">${_cplHtmlApercu()}</div>

    <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Version avec compléments</div>
          <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:2px">Affiche ou masque les lignes marquées « complément ». C'est le seul effet de cet interrupteur.</div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;cursor:pointer">
          <input type="checkbox" ${_cplPlan.avecComplements?'checked':''} onchange="cplToggleComplements()" style="opacity:0;width:0;height:0;position:absolute">
          <span style="position:absolute;inset:0;background:${_cplPlan.avecComplements?'var(--red)':'var(--border)'};border-radius:var(--r-3);transition:background var(--t-2);pointer-events:none">
            <span style="position:absolute;top:3px;left:3px;width:18px;height:18px;background:#fff;border-radius:var(--r-full);transition:transform var(--t-2);transform:translateX(${_cplPlan.avecComplements?'20px':'0px'})"></span>
          </span>
        </label>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid var(--surface-2)">
        <div style="flex:1;min-width:0">
          <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text)">Repas à source libre</div>
          <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:2px">Vide = compté sur les marqueurs posés dans les repas (${planNbSources(_cplPlan,'p')} pour les protéines, ${planNbSources(_cplPlan,'c')} pour les glucides).</div>
        </div>
        ${_cplInput(_cplPlan.nRepasSourcesLibres,'cplSetNSources(this.value)','62px','1')}
      </div>
    </div>

    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">Squelette de repas</div>
    ${_cplHtmlMoment(c,moment)}
    ${clesUtilisees.map(blocRepas).join('')}
    <select onchange="if(this.value){cplAjouterMarqueur(this.value,'p');this.value='';}"
      style="width:100%;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;margin-bottom:20px">
      <option value="">+ Ouvrir un nouveau repas…</option>
      ${planOrdreCles(moment).filter(k=>clesUtilisees.indexOf(k)<0).map(k=>`<option value="${k}">${escapeHtml(planLibRepas(k))}</option>`).join('')}
    </select>

    <!-- LE TABLEAU « PERIODISATION » A ETE RETIRE le 08/09/2026. Ses
         multiplicateurs frappaient une SECONDE fois la cible de la fiche, qui
         porte deja le coefficient d'objectif : 0,85 x 0,85 font 68 % de la
         depense, et rien ici ne montrait le produit. Kevin : « le seul calcul
         qui compte est celui des tableaux du coach ». Un reglage qui ne peut
         plus etre juste ne se met pas a 1, il se retire. -->
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:10px">Sources interchangeables</div>
    <div id="cpl-sources">${_cplHtmlSources()}</div>

    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:16px">${escapeHtml(PLAN_NOTE_CUISSON)}</div>
    <button class="btn btn-red" onclick="savePlanCoach()" style="font-size:var(--fs-sm);letter-spacing:1px">Enregistrer le plan</button>
    <button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px;font-size:var(--fs-2xs);letter-spacing:.5px" onclick="supprimerPlanCoach()">Supprimer le plan de cet athlète</button>
  </div></div>`;
}

// Écriture : MÊME chemin que toutes les écritures coach→athlète de
// l'application — getOwnedClient, updatedAt, DB.set, puis la synchro. Sans
// updatedAt, _mergeUser laisserait la prochaine sauvegarde de l'athlète
// écraser le plan qu'on vient de lui envoyer.
function savePlanCoach(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!_cplPlan) return;
  if(!c.nutrition) c.nutrition={};
  const p=_cplCopie(_cplPlan);
  // LOT R1 : les lignes recette reprennent les valeurs de la bibliothèque.
  try{ planRecettesActualiser(p,recettesMiennes()); }catch(e){}
  // Chaque aliment Ciqual part avec son nom et ses valeurs : l'athlète les lit
  // même avant d'avoir la base (planFigerAliments).
  try{ planFigerAliments(p); }catch(e){}
  p.majAt=Date.now();
  p.majPar=currentUser&&currentUser.id;
  c.nutrition.plan=p;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Plan alimentaire enregistré '+ICO.coche,'le plan est');
}
async function supprimerPlanCoach(){
  if(!await rcConfirm('Supprimer le plan alimentaire de cet athlète ? Ses objectifs de macros ne sont pas touchés.',null,'Supprimer')) return;
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  if(c.nutrition) delete c.nutrition.plan;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _cplPlan=_cplCopie(null);
  renderPlanCoach();
  toastSync(ok,CLOUD.pushOne(c.email,c),'Plan supprimé','la suppression est');
}

// ══════════════ DIÈTE STRICTE : CONSULTATION, CÔTÉ ATHLÈTE ════════════════
// LECTURE SEULE, sans exception. L'athlète permute ses sources dans sa tête et
// dans son assiette ; il ne modifie rien ici, et aucun bouton ne le laisse
// croire qu'il le pourrait.
// ── Le tableau de sources, PARTAGÉ par les deux écrans ────────────────────
// Il vivait dans _htmlPlanAthlete. Le coach en a besoin à l'identique : il doit
// voir ce que son athlète verra, sans qu'une seconde mise en forme se mette à
// diverger de la première au premier retouchage.
//
// Le libellé Ciqual porte parfois « (aliment moyen) » : une convention de la
// table Anses qui désigne l'entrée moyennée d'une famille. Elle ne dit rien à
// l'athlète et coûte seize caractères sur une ligne qui en tient une
// vingtaine. Seule cette parenthèse-là est retirée — les autres qualificatifs
// (« cru », « égoutté ») changent le poids à peser et restent.
function planNomCourt(n){
  return String(n||'').replace(/\s*\(aliment moyen\)/gi,'').trim();
}
// TABLEAU À 4 COLONNES : deux paires (aliment, quantité) côte à côte. Une
// liste de 28 glucides tenait sur 28 lignes, elle en occupe 14. La quantité
// affichée est celle à consommer À CE REPAS — pas la valeur pour 100 g, qui
// sert au calcul et pas à celui qui mange.
function planTableau4(lignes,couleur,texte,vide){
  // Sans `vide`, la phrase reste au caractère près celle de la fiche athlète :
  // ce lot déplace du code, il ne réécrit aucun texte vu par un athlète.
  if(!lignes.length) return `<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;padding:6px 2px">${vide?escapeHtml(vide):'Ton coach n\'a pas encore posé de sources ici.'}</div>`;
  // title porte le nom ENTIER : la ligne est coupée, la donnée ne l'est pas.
  const cell=l=>l
    ? `<td class="p4-n" title="${escapeHtml(l.nom)}">${escapeHtml(planNomCourt(l.nom))}</td><td class="p4-q"${l.alerte?' style="color:var(--orange)"':''}>${l.qte}</td>`
    : `<td class="p4-n"></td><td class="p4-q"></td>`;
  let corps='';
  for(let i=0;i<lignes.length;i+=2) corps+=`<tr>${cell(lignes[i])}${cell(lignes[i+1])}</tr>`;
  return `<table class="p4${texte?' p4-txt':''}" style="--p4:${couleur}">
    <thead><tr><th>Aliment</th><th>Qté</th><th>Aliment</th><th>Qté</th></tr></thead>
    <tbody>${corps}</tbody></table>`;
}
// Les lignes du tableau pour une macro, depuis le résultat de planSources.
// Une seule traduction « bloc de sources → lignes de tableau », partagée elle
// aussi : c'est là que se joue l'égalité stricte entre les deux écrans.
function planLignesSources(bloc){
  return (bloc&&bloc.liste?bloc.liste:[]).map(s=>({nom:s.nom,
    qte:(s.q==null?'-':Math.round(s.q)+' g'),alerte:s.excessif}));
}
// ── Les deux commandes de la liste de courses ─────────────────────────────
// Le CHOIX des sources est en MÉMOIRE : c'est un calculateur qu'on manipule
// devant son placard, pas une donnée du dossier. Les cases « à acheter », en
// revanche, sont ENREGISTRÉES — une liste qui se vide en changeant d'écran ne
// sert à rien une fois dans le magasin.
//
// Ni l'une ni l'autre ne repeint l'écran : on est au milieu d'une liste, un
// rendu complet remettrait le défilement à zéro à chaque case cochée.
const LC_REPAS=6;
let _lcChoix={};
function lcChoisir(cle,val){
  _lcChoix[cle]=val||'';
  const z=document.getElementById('lc-q-'+cle);
  if(!z) return;
  // La quantité d'un repas est encodée dans la valeur de l'option : la relire
  // évite de refaire tourner planSources à chaque changement de menu.
  const n=Number(String(val||'').split('|')[1]);
  z.textContent=(isFinite(n)&&n>0)?planFormatQte(Math.round(n*LC_REPAS),'g'):'-';
}
// « En stock » ou « à acheter ». Le champ enregistré reste `coursesAchat` :
// l'ancienne case cochée valait déjà « je l'ai », les dossiers existants se
// relisent donc sans migration.
function lcStock(cle,el){
  const stock=!!(el&&el.value==='stock');
  // Une ligne fusionnee porte les cles de TOUTES ses composantes, separees
  // par des virgules. Aucune cle n en contient : elles valent 's<id>',
  // 's#<i>', 'c<id>' ou 'x<alphanum>'. Cocher la ligne coche donc tout ce
  // qui la compose — sans quoi une moitie du besoin resterait « a prendre ».
  const cles=String(cle==null?'':cle).split(',').filter(Boolean);
  try{
    if(currentUser){
      if(!currentUser.nutrition) currentUser.nutrition={};
      if(!currentUser.nutrition.coursesAchat) currentUser.nutrition.coursesAchat={};
      for(const c of cles){
        if(stock) currentUser.nutrition.coursesAchat[c]=true;
        else delete currentUser.nutrition.coursesAchat[c];
      }
      saveUser();
    }
  }catch(e){}
  // Le gris et le trait suivent le menu immédiatement : on est au milieu d'une
  // liste, un rendu complet remettrait le défilement à zéro.
  try{
    el.style.background=stock?'rgba(34,197,94,.10)':'#101010';
    el.style.borderColor=stock?'rgba(34,197,94,.42)':'var(--border)';
    el.style.color=stock?'var(--green)':'var(--sub)';
    const ligne=el.closest('div');
    const nom=ligne.children[1], qte=ligne.children[2];
    if(nom){ nom.style.color=stock?'var(--text-faint)':'var(--text-strong)';
      nom.style.textDecoration=stock?'line-through':'none'; }
    if(qte) qte.style.color=stock?'var(--text-faint)':'var(--text)';
  }catch(e){}
}
// `intercale` : ce que l'ecran pose JUSTE APRES la table des fruits —
// aujourd'hui, le bouton de la fiche a imprimer. Le plan ne sait pas ce que
// c'est et n'a pas a le savoir : il fournit un emplacement, l'appelant le remplit.
// ══ OBJECTIFS ALIMENTAIRES : LES QUATRE CADRANS ══════════════════════════
// Maquette de Kevin, 24/08/2026. Elle remplace les quatre tuiles plates de la
// diete stricte, trait pour trait : cadre et lueur par macro, pastille
// d icone, anneau, chiffre au centre, libelle, « / objectif », et une
// etiquette pleine largeur au pied de chaque cadran.
//
// UNE COULEUR PAR MACRO, ECRITE UNE SEULE FOIS, sur --c. Le cadre, la lueur,
// l anneau, l icone, le libelle et la pastille la relisent tous : changer une
// teinte, c est changer une valeur, pas six.
const OA_MACROS=Object.freeze([
  Object.freeze({cle:'kcal',ico:'flame',  lbl:'Kcal',unite:'',  pied:'Apport énergétique',coul:'#ff2f2f'}),
  Object.freeze({cle:'p',   ico:'biceps', lbl:'Prot',unite:'g', pied:'Protéines',        coul:'#2f9bff'}),
  Object.freeze({cle:'c',   ico:'wheat',  lbl:'Gluc',unite:'g', pied:'Glucides',         coul:'#16d47b'}),
  Object.freeze({cle:'l',   ico:'droplet',lbl:'Lip', unite:'g', pied:'Lipides',          coul:'#f5a524'})
]);
// L ARC EST DECORATIF, ET RIGOUREUSEMENT IDENTIQUE SUR LES QUATRE CADRANS.
// Ce bloc affiche des CIBLES : en diete stricte, le journal alimentaire n est
// pas rendu, il n existe donc aucun consomme a comparer. Un anneau
// partiellement rempli serait une jauge qui ne mesure rien — le pire des
// affichages, parce qu il a l air de dire quelque chose. Il vaut ce qu il
// vaut sur la maquette : un cadran.
const OA_R=44, OA_CIRC=Math.round(2*Math.PI*OA_R*10)/10, OA_PART=0.85;
function htmlCadranOA(m,valeur){
  const v=(valeur==null||!isFinite(valeur))?'-':Math.round(valeur);
  return `<div class="oa-t" style="--c:${m.coul}">
    <span class="oa-ico" aria-hidden="true">${icon(m.ico,17)}</span>
    <div class="oa-cadran">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <!-- AUCUNE PISTE SOUS L ARC. La maquette laisse l ouverture VIDE : un
             rail gris a cet endroit se lirait comme la part qui reste a
             remplir, et il n y a rien a remplir, c est une cible, pas une
             jauge. -->
        <circle class="oa-arc" cx="50" cy="50" r="${OA_R}" fill="none" stroke-width="6"
          stroke-dasharray="${(OA_CIRC*OA_PART).toFixed(1)} ${OA_CIRC}"/>
      </svg>
      <div class="oa-centre">
        <div class="oa-nb">${v}${m.unite?`<small>${m.unite}</small>`:''}</div>
        <div class="oa-lbl">${escapeHtml(m.lbl)}</div>
        <div class="oa-obj">/ objectif</div>
      </div>
    </div>
    <div class="oa-pastille">${escapeHtml(m.pied)}</div>
  </div>`;
}
// LE BOUTON « AJUSTER » MENE AU COACH, ET NULLE PART AILLEURS. En diete
// stricte, le plan est ECRIT PAR LUI : l athlete n a rien a y ajuster
// lui-meme, et un bouton qui ne ferait rien serait pire que pas de bouton.
// Ajuster, ici, c est le lui demander.
//
// IL NE SORT QUE SI LE COACH A CONSENTI A ETRE JOINT. C est la regle deja
// posee sur l accueil, mot pour mot : « Sans coach rattache, ou sans
// consentement : aucun bouton, et AUCUN message d erreur. Il n y a rien a
// expliquer a qui n a rien demande. »
function _htmlAjusterOA(user){
  let href='';
  try{ href=_coachContactHref(user&&user.coachId,'',DB.get('users')||{})||''; }catch(e){ href=''; }
  if(!href) return '';
  return `<a class="oa-ajuster" href="${escapeHtml(href)}" target="_blank" rel="noopener"
    title="${escapeHtml(CONTACT_SORTIE)}">Ajuster ${icon('sliders',15)}</a>`;
}
function _htmlPlanAthlete(user,intercale){
  if(!planActif(user)) return '';
  const plan=planDe(user);
  const today=localISODate(new Date());
  let isOn=false;
  // Le planning de `user`. planCiblesJour reçoit déjà le dossier juste en
  // dessous : lire le jour ON ailleurs serait mélanger deux personnes.
  try{ isOn=nutIsOnDay(today,user); }catch(e){}
  const cib=planCiblesJour(user,isOn,today);
  const couv=planCouverture(plan);
  const rest=planRestant(cib,couv);
  const src=planSources(plan,rest);
  const nSrc={p:src.proteines.nSources,c:src.glucides.nSources};

  // Chiffres en Bebas avec halo : c'est la typographie que la diète flexible
  // donne déjà à ses compteurs et l'écran strict à ses scores. Les mêmes
  // valeurs se lisaient ici en Montserrat 15, deux fois plus petites que le
  // « 44 » des jours consécutifs juste en dessous — la hiérarchie était inversée.
  // LA TUILE KCAL PORTE LE CHIFFRE QUI COMMANDE : les trois macros s y
  // rangent. Elle etait pourtant grise comme les autres, et seul le nombre
  // etait rouge. Elle prend donc le cadre : fond en degrade, bordure rouge,
  // halo. Les trois autres restent neutres — si tout est mis en avant, plus
  // rien ne l est.
  const tuile=(lib,val,unite,couleur,vedette)=>`<div style="position:relative;overflow:hidden;flex:1;min-width:0;border-radius:var(--r-3);padding:10px 4px;text-align:center;${vedette
      ?'background:linear-gradient(160deg,color-mix(in srgb,var(--red) 20%,transparent),color-mix(in srgb,var(--red) 6%,transparent) 60%,color-mix(in srgb,var(--red) 2%,transparent));border:1px solid color-mix(in srgb,var(--red) 45%,transparent);box-shadow:var(--e2),var(--glow-red)'
      :'background:color-mix(in srgb,var(--text) 2.8%,transparent);border:1px solid color-mix(in srgb,var(--text) 5%,transparent)'}">
    ${vedette?`<div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:none"></div>`:''}
    <div style="position:relative;font-family:var(--pile-titre);font-size:${vedette?30:26}px;line-height:1;color:${couleur};text-shadow:0 0 ${vedette?16:10}px ${couleur}${vedette?'99':'66'}">${val==null?'-':Math.round(val)}<span style="font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);color:var(--sub);font-weight:400">${unite}</span></div>
    <div style="position:relative;font-size:var(--fs-2xs);color:${vedette?'#ffb3b3':'var(--sub)'};letter-spacing:1.4px;font-weight:800;margin-top:6px">${lib}</div>
  </div>`;

  // Code couleur commun aux deux écrans du plan — voir PLAN_COULEURS.
  const PL_COUL=PLAN_COULEURS;

  // Le tableau à 4 colonnes est monté au niveau du fichier : l'écran de
  // composition du coach affiche EXACTEMENT le même, voir planTableau4.
  const listeSources=(macro)=>planTableau4(
    planLignesSources(macro==='p'?src.proteines:src.glucides),PL_COUL[macro],false);
  // REPLIÉ PAR DÉFAUT, et c'est tout l'objet de ce lot. Le catalogue complet
  // s'ouvrait dans CHAQUE repas qui appelle une source : sur un plan de prise
  // de masse, la même liste de 48 lignes était traversée trois fois avant
  // d'atteindre la table des fruits. Elle reste exactement où elle sert — un
  // geste, pas un aller-retour, ce que cherchait le tableur d'origine — mais
  // le programme se lit maintenant d'un coup d'œil.
  // Le nombre est DANS le résumé : un volet fermé qui ne dit pas ce qu'il
  // contient ne donne aucune raison de l'ouvrir.
  const cartouche=(titre,macro)=>{
    const b=macro==='p'?src.proteines:src.glucides;
    const n=b.liste.length;
    return `<details class="plan-src">
      <summary style="color:${PL_COUL[macro]}">${escapeHtml(titre)}
        <span class="plan-src-nb">${n?n+' choix':'-'}</span></summary>
      <div class="plan-src-liste">${listeSources(macro)}</div>
    </details>`;
  };

  // La table des fruits, telle quelle. Aucun calcul : ce sont des
  // équivalences de portion, les mêmes dans tous les programmes du coach.
  // Variante « texte » du tableau : les quantités sont rédigées, pas chiffrées.
  const tableFruits=()=>planTableau4(
    PLAN_FRUITS.map(f=>({nom:f.n,qte:escapeHtml(f.q)})),PL_COUL.fruit,true);
  // « Voir la table des fruits » renvoyait vers un bloc situé tout en bas du
  // programme : il fallait sortir du repas, chercher, puis revenir. La table
  // s'ouvre désormais SOUS la ligne qui l'appelle, dans le repas concerné.
  const cartoucheFruit=(titre)=>`<details class="plan-src">
    <summary style="color:${PL_COUL.fruit}">${escapeHtml(titre)}
      <span class="plan-src-nb">${PLAN_FRUITS.length} fruits</span></summary>
    <div class="plan-src-liste">${tableFruits()}</div>
  </details>`;

  // Les repas, dans l'ordre du plan. Un marqueur de source n'affiche pas un
  // aliment : il déplie juste sous lui la liste dans laquelle l'athlète
  // choisit — c'est la forme du tableur, et c'est ce qui rend le plan
  // utilisable sans faire d'aller-retour.
  const moment=planMoment(plan,user);
  const cles=Object.keys(couv.parRepas).sort((a,b)=>planOrdreRepas(a,moment)-planOrdreRepas(b,moment));
  // Total du repas — même calcul et même libellé que la fiche coach.
  const totalRepas=(r)=>planTotalRepasHtml(planTotalRepas(r,rest,nSrc));
  const blocRepas=cles.map(cle=>{
    const r=couv.parRepas[cle];
    const lignes=r.lignes.map(x=>{
      if(x.note) return `<div class="plan-note">${escapeHtml(x.nom)}</div>`;
      if(x.source) return cartouche(x.nom,x.source);
      // La ligne de fruit est une LIGNE, pas une table. Elle l'a été : la table
      // s'ouvrait sous chaque ligne qui l'appelle, pour éviter l'aller-retour
      // vers le pied de programme. Mais un plan qui place un fruit à trois
      // repas affichait alors la même table de vingt lignes quatre fois — trois
      // fois dans les repas, une fois en pied. Kevin l'a signalé comme un
      // défaut. Elle est donc rendue UNE SEULE FOIS, en pied de programme, où
      // le tableur la met déjà et où elle sert aussi de référence générale.
      // Elle porte sa VALEUR : toutes les portions de la table sont calibrées
      // à la même quantité de glucides, et c'est elle qui compte dans le
      // total du repas. Afficher « table en pied » seul laissait croire que
      // la ligne n'apportait rien.
      if(x.fruit) return `<div class="plan-l">
        <div class="plan-nom" style="color:${PL_COUL.fruit}">${escapeHtml(x.nom)}</div>
        <div class="plan-q">${x.macros?Math.round(x.macros.c):'-'}<u> g de glucides</u></div>
      </div>`;
      const q=_planNb(x.item&&x.item.q);
      const u=planUniteItem(x.item);
      return `<div class="plan-l">
        <div class="plan-nom">${escapeHtml(x.nom)}</div>
        <div class="plan-q">${q==null?'-':(Math.round(q*100)/100).toString().replace('.',',')}<u> ${escapeHtml(planUnitePluriel(q,u))}</u></div>
      </div>`;
    }).join('');
    return `<div class="plan-card">
      <div class="plan-titre"><span class="plan-titre-t">${escapeHtml(planLibRepas(cle))}</span>${totalRepas(r)}</div>
      <div class="plan-corps">${lignes}</div>
    </div>`;
  }).join('');

  // Un catalogue posé sans marqueur dans aucun repas resterait invisible.
  const orphelins=['p','c'].filter(m=>{
    const b=m==='p'?src.proteines:src.glucides;
    return b.liste.length>0&&!planSquelette(plan).some(x=>x&&x.src===m);
  });
  const blocOrphelins=orphelins.length?`<div class="plan-card">
    <div class="plan-titre"><span class="plan-titre-t">Sources à répartir</span></div>
    <div class="plan-corps">
      ${orphelins.map(m=>cartouche(
        'Tes sources de '+(m==='p'?'protéines':'glucides')+' · à répartir sur '+nSrc[m]+' repas',
        m)).join('')}
    </div>
  </div>`:'';

  // La table des fruits en pied de programme, comme dans le tableur : elle y
  // est même si aucun repas n'appelle de fruit, parce qu'elle sert aussi de
  // référence générale.
  // Repliée comme les catalogues, et pour la même raison : vingt équivalences
  // de portion sont une RÉFÉRENCE qu'on consulte, pas une consigne du jour.
  // Dépliée, elle s'intercalait entre le programme et la liste de courses.
  const blocFruits=`<div class="plan-card">
    <div class="plan-titre" style="background:linear-gradient(90deg,color-mix(in srgb,var(--green) 55%,transparent),rgba(22,140,66,.3) 62%,rgba(10,80,36,.1));border-left-color:#2ee06a">
      <span class="plan-titre-t">1 portion de fruits</span></div>
    <div class="plan-corps">
      ${cartoucheFruit('Table des équivalences')}
    </div>
  </div>`;
  // PANNEAU D'ATTENTION. Le cheatmeal est la seule règle du plan qu'on
  // transgresse volontairement : elle ne doit pas se lire comme les autres.
  // Rouge translucide, halo néon, filet diagonal, et un bandeau d'en-tête —
  // c'est un panneau routier, pas un paragraphe.
  const blocCheat=`<div style="position:relative;overflow:hidden;border-radius:var(--r-3);margin-bottom:14px;
    background:linear-gradient(180deg,color-mix(in srgb,var(--red) 13%,transparent),color-mix(in srgb,var(--red) 5%,transparent));
    border:1px solid rgba(255,90,90,.42);
    box-shadow:0 0 20px color-mix(in srgb,var(--red) 30%,transparent),inset 0 1px 0 rgba(255,255,255,.07)">
    <div style="position:absolute;inset:0;pointer-events:none;
      background:none"></div>
    <div style="position:relative;display:flex;align-items:center;gap:8px;padding:10px 14px;
      background:linear-gradient(90deg,color-mix(in srgb,var(--red) 55%,transparent),color-mix(in srgb,var(--red-deep) 22%,transparent) 70%,transparent);
      border-bottom:1px solid rgba(255,90,90,.30)">
      <span style="font-size:var(--fs-lg);line-height:1;filter:drop-shadow(0 0 6px rgba(255,90,90,.95))">${icon('alert-triangle',16)}</span>
      <span style="font-family:var(--pile-titre);font-size:var(--fs-lg);
        letter-spacing:3px;color:var(--text);text-transform:uppercase;
        --halo-c:rgba(255,90,90,.95);text-shadow:var(--halo-1),0 0 20px color-mix(in srgb,var(--red) 55%,transparent)">Attention</span>
    </div>
    <div style="position:relative;padding:12px 14px 12px">
      <!-- LE FILET NE SEPARE QUE LES PUCES ENTRE ELLES. Pose sur TOUTES, il
           en mettait un sur la premiere aussi : juste sous le border-bottom
           du bandeau « Attention ». Deux traits rouges quasi paralleles a
           onze pixels l'un de l'autre, dont le second ne separait rien. La
           premiere puce n'en porte donc plus ; les suivantes le gardent,
           c'est la leur fonction. -->
      ${PLAN_NOTE_CHEATMEAL.map((t,i)=>`<div style="display:flex;gap:8px;align-items:flex-start;font-size:var(--fs-xs);color:var(--text-strong);line-height:1.65;padding:4px 0;${i?'border-top:1px solid rgba(255,90,90,.14)':''}">
        <span style="color:var(--red-text);flex-shrink:0;font-weight:900">•</span>
        <span>${escapeHtml(t)}</span></div>`).join('')}
    </div>
  </div>`;

  let lc=null;
  try{ lc=planListeCourses(plan,user); }catch(e){}
  // La liste de courses ne se lit PAS comme le plan : elle se tient à la main
  // dans un magasin. D'où un cadre franchement plus gris, sans le liseré rouge
  // des cartes de repas — on doit voir d'un coup d'œil qu'on a quitté le
  // programme et qu'on est passé à la corvée.
  // UNE CASE NE SUFFISAIT PAS. Cochée, elle voulait dire « fait » sans dire
  // quoi : déjà au placard, ou acheté ce matin ? Un menu à deux entrées le dit.
  // « En stock » grise la ligne — elle reste lisible, mais elle sort de la
  // corvée du jour.
  // Rythme de LISTE : 3px de marge au lieu de 7, separateur plus discret.
  // La cible tactile ne descend pas pour autant — le select garde 34px, et
  // la regle WCAG est tenue par sa largeur, pas par l interligne.
  const ligneCourse=(lib,qte,cle,stock,nUsages)=>`<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-top:1px solid var(--border)">
      <select onchange="lcStock('${cle}',this)" aria-label="État : ${escapeHtml(lib)}"
        style="flex-shrink:0;width:88px;min-height:34px;padding:4px 6px;border-radius:var(--r-2);cursor:pointer;
          background:${stock?'rgba(34,197,94,.10)':'#101010'};
          border:1px solid ${stock?'rgba(34,197,94,.42)':'var(--border)'};
          color:${stock?'var(--green)':'var(--sub)'};
          font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.3px">
        <option value=""${stock?'':' selected'}>À prendre</option>
        <option value="stock"${stock?' selected':''}>En stock</option>
      </select>
      <span style="flex:1;min-width:0;font-size:var(--fs-xs);color:${stock?'var(--text-faint)':'var(--text-strong)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${stock?'text-decoration:line-through':''}">${escapeHtml(lib)}${(nUsages>1)?` <span title="Regroupé : cette denrée est demandée à ${nUsages} endroits de ton plan" style="font-size:var(--fs-2xs);font-weight:800;color:var(--text-faint);border:1px solid var(--border);border-radius:var(--r-1);padding:0 4px;vertical-align:1px">×${nUsages}</span>`:''}</span>
      <span style="font-size:var(--fs-sm);font-weight:800;color:${stock?'var(--text-faint)':'var(--text)'};flex-shrink:0">${qte}</span>
    </div>`;
  // Les sources sont INTERCHANGEABLES : la liste ne peut pas deviner laquelle
  // l'athlète prendra. Deux lignes par macro, où il choisit lui-même, et le
  // grammage d'un repas est multiplié par LC_REPAS pour couvrir la semaine.
  const auChoix=(macro,rang)=>{
    const b=macro==='p'?src.proteines:src.glucides;
    const cle=macro+rang;
    const choisi=_lcChoix[cle]||'';
    const opts=(b&&b.liste?b.liste:[]).filter(s=>s.q!=null).map(s=>{
      const v=s.nom+'|'+Math.round(s.q);
      return `<option value="${escapeHtml(v)}"${choisi===v?' selected':''}>${escapeHtml(planNomCourt(s.nom))}</option>`;
    }).join('');
    const q=choisi?Math.round(Number(choisi.split('|')[1])*LC_REPAS):null;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border)">
      <select onchange="lcChoisir('${cle}',this.value)" aria-label="Source de ${macro==='p'?'protéines':'glucides'} au choix"
        style="flex:1;min-width:0;min-height:38px;padding:8px 10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:${choisi?'var(--text)':'var(--text-dim)'};font-family:Montserrat,sans-serif;font-size:var(--fs-xs)">
        <option value="">${macro==='p'?'Protéines':'Glucides'} au choix…</option>
        ${opts}
      </select>
      <span id="lc-q-${cle}" style="font-size:var(--fs-sm);font-weight:800;color:var(--text);flex-shrink:0;min-width:62px;text-align:right">${q?planFormatQte(q,'g'):'-'}</span>
    </div>`;
  };
  const achats=(user&&user.nutrition&&user.nutrition.coursesAchat)||{};
  // LA LISTE N EST PAS LE PLAN. Le plan est une prescription — fond degrade,
// cadre plein ; la liste est un outil de passage en magasin. On lui donne
// donc l aspect d un ticket : fond plus clair, bord gauche marque, papier
// legerement raye, et un sous-titre qui dit ce qu elle est.
// REPLIABLE. Fermee par defaut : une quinzaine de lignes plus quatre menus
// poussaient tout le reste hors de vue, et on ne la consulte qu au moment de
// faire ses courses. <details> natif, comme les historiques : aucun script,
// le clavier l ouvre, et le lecteur d ecran l annonce.
const courses=(lc&&lc.lignes.length)?`<details class="hist-repli lc-repli" style="position:relative;overflow:hidden;background:none;border:1px solid var(--border);border-left:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px"${_lcOuvert?' open':''} ontoggle="_lcOuvert=this.open">
    <summary style="list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:-12px -14px 8px;padding:12px 14px;border-radius:var(--r-2) var(--r-2) 0 0;background:linear-gradient(180deg,var(--text),#e9e9e9);box-shadow:var(--e1);min-height:44px">
      <span style="font-size:var(--fs-xs);color:#0a0a0a;letter-spacing:2px;font-weight:800;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px">${icon('clipboard',13)} Liste de courses</span>
      <span style="display:inline-flex;align-items:center;gap:10px;flex-shrink:0">
        <span style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:1.5px;font-weight:800;text-transform:uppercase">${lc.lignes.filter(l=>l.qte>0).length} lignes</span>
        <span class="hist-chevron" style="font-size:var(--fs-md);color:var(--border);transition:transform var(--t-1)">▾</span>
      </span>
    </summary>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.5px;margin-bottom:6px">Ce qu'il te faut acheter (ce n'est pas ton plan alimentaire).</div>
      ${lc.lignes.filter(l=>l.qte>0).map(l=>{
        const cs=l.cles||[l.cle];
        // « En stock » seulement si TOUTES les composantes le sont : une
        // seule non cochee et il reste quelque chose a acheter.
        return ligneCourse(l.lib,planFormatQte(l.qte,l.unite),cs.join(','),cs.every(c=>!!achats[c]),cs.length);
      }).join('')}
      ${''/* les quatre lignes « au choix » suivent, hors du marquage stock */}
      ${auChoix('p',0)}${auChoix('p',1)}
      ${auChoix('c',0)}${auChoix('c',1)}
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">Calculée sur un jour d'entraînement, le plus chargé : mieux vaut un reste qu'une rupture en milieu de semaine. Les lignes « au choix » comptent un repas multiplié par ${LC_REPAS}.</div>
  </details>`:'';

  // ⚠ pal A ETE RETIRE le 08/09/2026 avec la periodisation.
  const negatif=rest.negatifs.length
    ?`<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:10px 12px;margin-bottom:12px;font-size:var(--fs-xs);color:var(--text);line-height:1.6">Tes repas imposés couvrent déjà ${rest.negatifs.map(n=>n.lib).join(' et ')} : les sources correspondantes affichent 0. Parles-en à ton coach.</div>`
    :'';

  return `<div style="margin-bottom:24px">
    <div style="font-size:var(--fs-xs);color:var(--red-text);text-transform:uppercase;letter-spacing:2px;font-weight:800;--halo-c:color-mix(in srgb,var(--red) 45%,transparent);text-shadow:var(--halo-2);margin-bottom:4px;display:flex;align-items:center;gap:6px">${icon('target',12)} Programme nutritionnel</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-bottom:12px">${escapeHtml(PLAN_NOTE_INDICATIF)}</div>
    <div class="oa-carte">
      <div class="oa-tete">
        <span class="oa-boul" aria-hidden="true">${icon('crosshair',22)}</span>
        <div class="oa-titres">
          <div class="oa-sur">Objectifs alimentaires</div>
          <!-- Le second mot en rouge, comme sur la maquette. Le jour de repos
               n a pas de second mot : la couleur porte alors le mot entier. -->
          <div class="oa-titre">${isOn?`Jour d\'<em>entraînement</em>`:`Jour de <em>repos</em>`}</div>
        </div>
      </div>
      <div class="oa-grille">
        ${htmlCadranOA(OA_MACROS[0],cib.kcal)}
        ${htmlCadranOA(OA_MACROS[1],cib.p)}
        ${htmlCadranOA(OA_MACROS[2],cib.c)}
        ${htmlCadranOA(OA_MACROS[3],cib.l)}
      </div>
      <!-- CETTE BARRE ETAIT CONDITIONNEE A UN PALIER != 1, et le lien
           « Ajuster » vivait dedans : depuis que la periodisation est retiree
           (08/09/2026) elle ne serait plus jamais sortie, et l'acces au coach
           serait parti avec elle sans que personne le remarque. Elle se rend
           donc quand ce lien existe, et la phrase de palier a disparu : elle
           expliquait un multiplicateur qui n'existe plus. -->
      ${(()=>{ const a=_htmlAjusterOA(user); return a?`<div class="oa-bas">
        <span class="oa-i" aria-hidden="true">${icon('info',18)}</span>
        <span class="oa-note">Ces cibles viennent du calcul de ton coach.</span>
        ${a}
      </div>`:''; })()}
    </div>
    ${negatif}
    ${blocRepas}
    ${blocOrphelins}
    ${blocFruits}
    ${intercale||''}
    ${blocCheat}
    ${_htmlHuileCuissonAthlete(couv)}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:14px">${escapeHtml(PLAN_NOTE_CUISSON)}</div>
    <!-- La liste ferme le plan : c'est un outil de passage en magasin, pas
         une prescription, et elle n'a rien a faire au milieu des repas. -->
    ${courses}
  </div>`;
}
// L'huile de cuisson est comptée dans les macros de l'athlète alors qu'aucune
// ligne ne la porte. Le dire n'est pas de la décoration : sans cette phrase,
// quelqu'un qui refait ses totaux à la main trouve un écart de vingt grammes
// de lipides et croit à une erreur.
function _htmlHuileCuissonAthlete(couv){
  const h=couv&&couv.huileCuisson;
  if(!h||!(h.lipides>0)) return '';
  return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:10px">Tes lipides incluent déjà ${h.lipides} g d'huile de cuisson : inutile de la peser, elle est comptée.</div>`;
}

// ======= JOURNAL ALIMENTAIRE (Ciqual 2025) =======
let _ciqualDB=null;
let _fjFood=null;   // aliment sélectionné
let _fjDate=null;   // date YYYY-MM-DD du journal ouvert
// L identifiant de la ligne qu on vient d ecrire, le temps d un rendu. Remis
// a null 1 300 ms plus tard : au-dela, la ligne n est plus « neuve », et un
// re-rendu pour une autre raison ne doit pas rejouer le marqueur.
let _fjIdNeuf=null;
// L ENTREE NE SE REJOUE PAS A CHAQUE RENDU. Ces cartes sont reconstruites a
// chaque ajout d aliment, a chaque changement de jour, a chaque validation de
// pas : leur animation d entree repartait a zero et la page entiere
// tressautait. On la garde, mais UNE FOIS par visite du module.
const _dejaAnime=new Set();
function _animEntree(cle){
  if(_dejaAnime.has(cle)) return '';
  _dejaAnime.add(cle);
  // MEME CONTRAT QUE .casc : un seul geste, une seule grammaire.
  return 'animation:fadeInUp var(--casc-duree) var(--arc-c-discharge) both;';
}
// Les ecrans du module. Revenir depuis l accueil vide le jeu et rejoue
// l entree une fois ; naviguer DANS le module ne la rejoue pas.
const NUT_ECRANS=/^(s-nutrition|s-food-|s-caffeine|s-supplement|s-steps|s-sleep|s-lifestyle)/;
let _fjRepas='matin';

// PURE. Le singulier probable d'un mot de requête, ou le mot lui-même.
//
// Le « s » final tombe au-delà de trois lettres : « riz » et « pas » restent
// entiers. Le « x », lui, ne tombe QUE derrière un « u » — la seule marque de
// pluriel français en -x : -aux, -eux, -oux. « noix » n'est pas un pluriel, et
// le réduire à « noi » ferait remonter « noisette » et « poivre noir » sur une
// recherche de noix.
function _fjSingulier(w){
  const m=String(w||'');
  if(m.length>3&&/ux$/.test(m)) return m.slice(0,-1);
  if(m.length>3&&/s$/.test(m)) return m.slice(0,-1);
  return m;
}
// PURE. Les formes acceptées pour un mot : la saisie, ET son singulier. On
// garde les deux — un mot doit correspondre à l'une ou à l'autre.
function _fjFormes(w){
  const sg=_fjSingulier(w);
  return sg===w?[w]:[w,sg];
}
// PURE. Le texte normalisé contient-il TOUS les mots, au singulier comme au
// pluriel ? Un seul endroit décide, pour la table, les aliments perso et ceux
// du coach.
function _fjContientTous(texte,words){
  const t=String(texte||'');
  return (words||[]).every(w=>_fjFormes(w).some(v=>t.includes(v)));
}
// ── LES ALIAS DE RECHERCHE (champ « a » de la table, BUILD 1852) ─────────
// Les noms Ciqual sont des noms de laboratoire : « Boisson à l'amande » pour
// « lait d'amande ». scripts/alias_aliments.tsv pose sur la fiche des alias
// DÉJÀ normalisés (minuscules, sans accents, apostrophe → espace).
//
// PURE. La requête normalisée et ses mots. L'apostrophe devient une espace,
// comme dans les alias : « lait d'amande » donne « lait », « amande ».
function _fjRequete(q){
  const normQ=_fjNorm(q).replace(/['’]/g,' ').replace(/\s+/g,' ').trim();
  return {normQ,words:normQ.split(' ').filter(w=>w.length>1)};
}
// PURE. Le texte sur lequel porte la recherche : le nom, puis les alias.
function _fjTexteRecherche(f){
  const s=(f&&(f.s||_fjNorm(f.n)))||'';
  return (f&&Array.isArray(f.a)&&f.a.length)?s+' | '+f.a.join(' | '):s;
}
// PURE. AU DÉBUT D'UN MOT (BUILD 1853). La sous-chaîne faisait sortir la
// salade verte sur « nems » (assaisonNEMent) et le chevreuil sur « chevre ».
// Un mot de la requête doit commencer un mot du texte. Exception : à partir de
// 6 lettres, la sous-chaîne reste acceptée, pour les mots soudés
// (« chou-fleur », « pommedeterre ») — _classerAliments lui retire 40.
const FJ_SOUS_CHAINE_MIN=6;
function _fjDebutMot(t,v){
  const i=t.indexOf(v);
  if(i<0) return false;
  const re=new RegExp('(^|[^a-z0-9])'+v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  return re.test(t);
}
function _fjContientDebut(texte,words){
  const t=String(texte||'');
  return (words||[]).every(w=>_fjFormes(w).some(v=>_fjDebutMot(t,v)||(v.length>=FJ_SOUS_CHAINE_MIN&&t.includes(v))));
}
// PURE. L'alias qui a fait correspondre, quand le NOM seul ne le fait pas.
// ⚠ UN ALIAS CORRESPOND EN ENTIER, pas morceau par morceau : « lait » pris dans
// le nom et « amande » dans un alias ne font pas « lait d'amande ».
// `lache` : l'ancien filtre par sous-chaîne, pour le repli de _fjFiltrer.
function _fjAliasVia(f,words,lache){
  if(!f||!Array.isArray(f.a)||!f.a.length) return null;
  const ok=lache?_fjContientTous:_fjContientDebut;
  if(ok((f.s||_fjNorm(f.n)||''),words)) return null;
  return f.a.find(a=>ok(a,words))||null;
}
// PURE. LA seule décision « cette fiche répond-elle ? », pour toutes les listes.
function _fjCorrespond(f,words,lache){
  if(!f) return false;
  const ok=lache?_fjContientTous:_fjContientDebut;
  return ok(f.s||_fjNorm(f.n),words)||!!_fjAliasVia(f,words,lache);
}
// PURE. Le filtre en début de mot ; s'il ne rend RIEN, l'ancien filtre par
// sous-chaîne — la recherche ne rend jamais moins qu'avant.
// BUILD 1859 : une fiche « cache » (encore sans énergie après le passage des
// sœurs, scripts/ciqual_soeurs.tsv) ne sort jamais d'une recherche ; _planCiqual
// la résout toujours par id, pour qu'un plan ancien ne casse pas.
function _fjFiltrer(liste,words){
  const l=(liste||[]).filter(f=>f&&!f.cache);
  const strict=l.filter(f=>_fjCorrespond(f,words));
  return strict.length?strict:l.filter(f=>_fjCorrespond(f,words,true));
}
// ── LA CORRECTION DES FAUTES DE FRAPPE (BUILD 1856) ─────────────────────
// « pouelt », « yahourt », « cacahouete », « spagetti », « saumond » rendaient
// « Aucun résultat ». QUAND (et seulement quand) le filtre ne rend RIEN, chaque
// mot sans résultat de 4 lettres ou plus est corrigé vers le mot le plus proche
// du vocabulaire de la table, et la recherche est relancée — avec un bandeau
// qui le DIT et permet de chercher le mot tel quel. Jamais en silence.
//
// PURE. Une clé phonétique française grossière, pour la requête ET le
// vocabulaire : ph → f, gh → g, h muet supprimé (sauf ch, sh), ou → u devant
// une voyelle, doubles consonnes simplifiées, d ou t final muet supprimé.
function _fjPhonetique(mot){
  let m=String(mot||'').toLowerCase();
  m=m.replace(/ph/g,'f').replace(/gh/g,'g');
  m=m.replace(/([^cs])h/g,'$1').replace(/^h/,'');
  m=m.replace(/ou(?=[aeiouy])/g,'u');
  m=m.replace(/([bcdfgjklmnpqrstvwxz])\1+/g,'$1');
  m=m.replace(/[dt]$/,'');
  return m;
}
// PURE. Distance de Damerau-Levenshtein (variante « transposition adjacente »),
// avec abandon au-delà de `max` : seules les petites distances intéressent.
function _fjDamerau(a,b,max){
  const n=a.length, m=b.length;
  if(Math.abs(n-m)>max) return max+1;
  let p2=null, p1=new Array(m+1), c=new Array(m+1);
  for(let j=0;j<=m;j++) p1[j]=j;
  for(let i=1;i<=n;i++){
    c[0]=i; let mini=c[0];
    for(let j=1;j<=m;j++){
      const cout=a[i-1]===b[j-1]?0:1;
      let v=Math.min(p1[j]+1,c[j-1]+1,p1[j-1]+cout);
      if(p2&&i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) v=Math.min(v,p2[j-2]+1);
      c[j]=v; if(v<mini) mini=v;
    }
    if(mini>max) return max+1;
    p2=p1; p1=c; c=new Array(m+1);
  }
  return p1[m];
}
// Le vocabulaire de la table : chaque mot distinct des noms et des alias, sa
// fréquence (nombre de fiches qui le portent) et sa clé phonétique. Construit
// UNE fois, à la première correction, en mémoire seulement.
let _fjVocabCache=null;
function _fjVocab(db){
  if(_fjVocabCache&&_fjVocabCache.db===db) return _fjVocabCache;
  const freq=new Map();
  for(const f of (db||[])){
    if(!f) continue;
    const vus=new Set();
    for(const t of [f.s||'',...(Array.isArray(f.a)?f.a:[])])
      for(const w of t.split(/[^a-z0-9]+/)) if(w.length>=3&&!vus.has(w)){ vus.add(w); freq.set(w,(freq.get(w)||0)+1); }
  }
  const parPhon=new Map();
  for(const [w,n] of freq){
    const k=_fjPhonetique(w), cur=parPhon.get(k);
    if(!cur||n>cur.n) parPhon.set(k,{w,n});
  }
  _fjVocabCache={db,freq,parPhon,mots:Array.from(freq.keys())};
  return _fjVocabCache;
}
// PURE (sur le vocabulaire). Le mot corrigé, ou null. Moins de 4 lettres :
// jamais. D'abord la même clé phonétique ; sinon la distance — 1 jusqu'à 6
// lettres, 2 au-delà —, à égalité le mot le plus fréquent de la table.
function _fjCorrigerMot(w,v){
  if(!w||w.length<4) return null;
  const p=v.parPhon.get(_fjPhonetique(w));
  if(p&&p.w!==w) return p.w;
  const lim=w.length<=6?1:2;
  let best=null;
  for(const m of v.mots){
    if(Math.abs(m.length-w.length)>lim) continue;
    const d=_fjDamerau(w,m,lim);
    if(d>lim) continue;
    const n=v.freq.get(m)||0;
    if(!best||d<best.d||(d===best.d&&n>best.n)) best={w:m,d,n};
  }
  return best&&best.w!==w?best.w:null;
}
// La requête corrigée, ou null. Un mot qui a DÉJÀ des résultats n'est jamais
// touché : seule la faute est corrigée, pas le reste de la phrase.
function _fjCorriger(words,db){
  const v=_fjVocab(db);
  let change=false;
  const out=(words||[]).map(w=>{
    if(_fjFiltrer(db,[w]).length) return w;
    const c=_fjCorrigerMot(w,v);
    if(c){ change=true; return c; }
    return w;
  });
  return change?{words:out,normQ:out.join(' ')}:null;
}
// Le bandeau, obligatoire dès qu'une correction a eu lieu. `fn` : la fonction
// de recherche à relancer SANS correction.
let _fjSansCorrPour=null;
function _htmlBandeauCorrection(corr,q,fn){
  if(!corr) return '';
  return '<div class="fj-corr" role="status" style="padding:8px 12px;font-size:var(--fs-xs);color:var(--sub)">Résultats pour « '
    +escapeHtml(corr.normQ)+' » · <button type="button" class="lien-btn" style="background:none;border:0;padding:0;color:var(--link);font:inherit;text-decoration:underline;cursor:pointer" onclick="_fjChercherQuandMeme('
    +_attrArg(fn)+','+_attrArg(q)+')">Rechercher « '+escapeHtml(q)+' » quand même</button></div>';
}
function _fjChercherQuandMeme(fn,q){
  _fjSansCorrPour=q;
  try{ if(typeof window[fn]==='function') window[fn](q); } finally { _fjSansCorrPour=null; }
}
// Le geste commun aux trois recherches : rien trouvé → corriger, sauf si
// l'athlète a demandé le mot tel quel.
function _fjAvecCorrection(q,words,res,db){
  if(res.length||_fjSansCorrPour===q) return null;
  const c=_fjCorriger(words,db);
  if(!c) return null;
  const r=_fjFiltrer(db,c.words);
  return r.length?Object.assign(c,{res:r}):null;
}
// PURE. « Valeurs complétées depuis « Poireau, bouilli/cuit à l'eau » (Ciqual) ».
function texteRepris(f,db){
  if(!f||f.repris==null) return '';
  const s=(db||[]).find(x=>x&&x.id===f.repris);
  return s?'Valeurs complétées depuis « '+s.n+' » (Ciqual)':'';
}
// PURE. LES HABITUDES DE L'ATHLÈTE. Celui qui mange toujours du « Riz basmati
// cuit » doit le voir en premier quand il tape « riz » : +80 favori, +60
// fréquent (FJ_FREQUENT_MIN ajouts), +30 récent. Un favori passe donc devant
// la fiche de référence (+150) dès qu'il est aussi fréquent ou récent… et
// devant elle seul quand elle ne correspond qu'à moitié à la requête.
function _bonusHabitude(f,user){
  if(!f||f.id==null) return 0;
  const n=(user&&user.nutrition)||{};
  let b=0;
  const fav=Array.isArray(n.favoriteFoods)?n.favoriteFoods:[];
  if(fav.indexOf(f.id)>=0) b+=80;
  const u=n.usageFoods&&n.usageFoods[String(f.id)];
  const min=(typeof FJ_FREQUENT_MIN==='number')?FJ_FREQUENT_MIN:3;
  if(u&&(u.n||0)>=min) b+=60;
  if(Array.isArray(n.recentFoods)&&n.recentFoods.indexOf(f.id)>=0) b+=30;
  return b;
}
// PURE. LE BRUIT : 86 eaux minérales de marque, 79 fiches prélevées à la
// Martinique, 39 aliments infantiles. Ils restent trouvables, mais derrière,
// SAUF quand la requête porte leur mot distinctif (« volvic », « martinique »,
// « bébé »). Les abats aussi passent derrière, sauf si on les nomme.
const FJ_MOTS_EAU=new Set(['eau','eaux','minerale','minerales','embouteillee','gazeuse','plate','source']);
function _malusBruit(f,words){
  const nn=(f&&(f.s||_fjNorm(f.n)))||'', ng=_fjNorm((f&&f.g)||'');
  const w=words||[];
  let m=0;
  if(/^eau minerale /.test(nn)&&!w.some(x=>!FJ_MOTS_EAU.has(x)&&nn.indexOf(x)>=0)) m-=60;
  if(/martinique/.test(nn)&&!w.some(x=>x.startsWith('martiniq'))) m-=60;
  if(/infantile/.test(ng)&&!w.some(x=>/^(bebe|infantile|nourrisson|enfant)/.test(x))) m-=60;
  if(/^(coeur|foie|rognon|gesier|langue|cervelle|tripe|abat)/.test(nn)&&!w.some(x=>/^(coeur|foie|rognon|gesier|langue|cervelle|tripe|abat)/.test(x))) m-=40;
  return m;
}
function _fjNorm(s){
  return (s||'').toLowerCase()
    .replace(/[éèêë]/g,'e').replace(/[àâä]/g,'a').replace(/[ùûü]/g,'u')
    .replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/ç/g,'c')
    .replace(/œ/g,'oe').replace(/æ/g,'ae');
}
// Un athlete qui tape « oeuf » cherche l oeuf, pas la salade qui en contient.
// On classe donc sur ce qui separe une matiere premiere d une preparation.
function _classerAliments(res,normQ,words){
  const isGeneric=words.length<=2;
  // L etat de matiere premiere, tel qu il s ecrit dans les noms CIQUAL.
  const ETAT_BRUT=/\b(cru|crue|crus|crues|frais|fraiche|nature|brut|brute|entier|entiere)\b/;
  // « Sec » compte aussi — c est la forme brute de la lentille et des pates —
  // mais moins que « cru » : sur « pomme », la pomme sechee ne doit pas passer
  // devant la pomme fraiche.
  const ETAT_SEC=/\b(sec|seche|sechee|seches|sechees)\b/;
  // Les marqueurs de recette ou d ultra-transforme. « aux », « a la » et
  // « avec » sont les plus revelateurs : ils annoncent une recette.
  const PREPARE=/\b(aux?|a la|avec|sauce|farci|farcie|panne|pannee|cuisine|cuisinee|prepare|preparee|preemballe|preemballee|conserve|surgele|surgelee|assaisonne|assaisonnee|sandwich|pizza|quiche|tarte|gateau|biscuit|plat|recette|garni|garnie)\b/;
  // La cuisson et l assaisonnement : moins lourds qu une recette, mais ils
  // ecartent quand meme du produit brut — l amande grillee salee n est pas
  // l amande, le saumon fume n est pas le saumon.
  const TRANSFORME=/\b(grille|grillee|poele|poelee|frit|frite|fume|fumee|confit|confite|salee?|sucree?|aromatise|aromatisee|braise|braisee|roti|rotie|appertise|appertisee)\b/;
  // Le filtre travaille en SOUS-CHAINE : « oeuf » retient aussi « boeuf »,
  // « ail » retient « travail ». Un nom qui contient le mot ENTIER parle de
  // l aliment cherche ; les autres n en parlent que par accident.
  // BATI SUR LE SINGULIER, avec le pluriel optionnel : il tolérait le pluriel
  // du côté TABLE — « oeuf » retrouvait « oeufs » — mais jamais du côté
  // REQUÊTE. Sans ça, « tomates » remonterait désormais du filtre sans jamais
  // recevoir le bonus « mot entier » : trouvées, mais classées derrière.
  // « e » accepté : « cuit » est entier dans « cuite », le féminin n'est pas un autre mot.
  const MOTS=words.map(w=>new RegExp('\\b'+_fjSingulier(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'e?[sx]?\\b'));
  // Le premier mot, pour les fiches de référence (champ « r », 1853).
  const tete0=words.length?_fjSingulier(words[0]):'';
  let _u=null; try{ _u=currentUser; }catch(e){ _u=null; }
  return res.map(f=>{
    // f.s EST deja le nom normalise dans la table : le recalculer a chaque
    // frappe coutait le double du temps de recherche. Le repli reste la au
    // cas ou la table serait regeneree sans ce champ.
    const nn=f.s||_fjNorm(f.n), ng=_fjNorm(f.g||'');
    // Quand c'est un ALIAS qui a fait correspondre, la tete et le mot entier
    // se jugent sur lui : « Boisson à l'amande » ne commence pas par « lait ».
    // L'etat brut, la preparation et la longueur restent ceux du NOM.
    const via=_fjAliasVia(f,words);
    const tete=(via||nn).replace(/['’]/g,' ');
    let sc=0;
    // 1) La correspondance de tete. Un alias EGAL a la requete vaut le nom.
    if(tete===normQ||(Array.isArray(f.a)&&f.a.includes(normQ))) sc+=200;
    else if(tete.startsWith(normQ)) sc+=100;
    else if(tete.startsWith(words[0])) sc+=50;
    // 2) Le mot entier, l etat brut, et l absence de preparation.
    if(MOTS.every(r=>r.test(tete))) sc+=60;
    if(ETAT_BRUT.test(nn)) sc+=45; else if(ETAT_SEC.test(nn)) sc+=25;
    // UNE FICHE DE RÉFÉRENCE n'est pas « préparée » : c'est l'aliment attendu
    // (« Thon, au naturel, appertisé » pour « thon », le kebab pour « kebab »).
    const estRef=Array.isArray(f.r)&&(f.r.indexOf(tete0)>=0||f.r.indexOf(words[0])>=0);
    if(!estRef&&PREPARE.test(nn)) sc-=70;
    if(!estRef&&TRANSFORME.test(nn)) sc-=35;
    // 3) Un nom COURT est presque toujours plus generique qu un nom long :
    //    « Oeuf cru » contre « Salade composee au thon et aux oeufs ». C est
    //    un departage, pas une regle principale — d ou le petit poids.
    sc+=Math.max(0,30-3*nn.split(/[\s,]+/).filter(Boolean).length);
    // 4) Les groupes CIQUAL : matieres premieres contre plats composes.
    if(isGeneric&&/viande|volaille|gibier|oeuf|poisson|legume|fruit|cereale|lait/.test(ng)) sc+=30;
    if(/plat|sandwich|dessert|snack|aperitif/.test(ng)) sc-=80;
    // 5) BUILD 1853 : la référence, les habitudes, le bruit, et la sous-chaîne.
    if(estRef) sc+=150;
    sc+=_bonusHabitude(f,_u);
    sc+=_malusBruit(f,words);
    if(!_fjContientDebut(tete,words)&&!via) sc-=40;
    return{f,sc};
  }).sort((a,b)=>b.sc-a.sc);
}

// ⚠ UN ECHEC N'EST PLUS DEFINITIF (30/09/2026). La base retombait a [] pour
//   toute la session au premier echec — hors ligne une fois, vide jusqu'au
//   rechargement. On garde `[]` (les rendus qui ne rechargent que si
//   !_ciqualDB ne bouclent pas), l'heure de l'echec, et on RETENTE au premier
//   appel qui suit 30 secondes. ciqualIndisponible() le dit a l'ecran.
let _ciqualEchec=0;
const CIQUAL_REESSAI_MS=30e3;
function ciqualIndisponible(){ return _ciqualEchec>0&&!(Array.isArray(_ciqualDB)&&_ciqualDB.length); }
async function _loadCiqual(){
  if(Array.isArray(_ciqualDB)&&_ciqualDB.length) return _ciqualDB;
  if(_ciqualEchec&&Date.now()-_ciqualEchec<CIQUAL_REESSAI_MS) return _ciqualDB||[];
  try{
    const r=await fetch('./data/ciqual.json');
    if(!r||!r.ok) throw new Error('ciqual '+(r&&r.status));
    const d=await r.json();
    if(!Array.isArray(d)||!d.length) throw new Error('ciqual vide');
    _ciqualDB=d; _ciqualEchec=0;
  }catch(e){
    _ciqualEchec=Date.now();
    if(!Array.isArray(_ciqualDB)) _ciqualDB=[];
  }
  return _ciqualDB;
}
const CIQUAL_MSG_INDISPO='Base d’aliments indisponible hors ligne. Réessaie une fois connecté.';
function _htmlCiqualIndispo(){
  return '<div style="padding:20px;text-align:center;color:var(--orange);font-size:var(--fs-sm)">'+CIQUAL_MSG_INDISPO+'</div>';
}

// ── L'ÉNERGIE D'UNE ENTRÉE, QUAND LA TABLE N'EN DONNE PAS (30/09/2026) ─────
// Défense en profondeur : le script de conversion la calcule déjà (k_calc),
// mais un aliment venu d'ailleurs (scan, OFF, aliment perso, ancienne base en
// cache) peut arriver sans. 4 p + 4 c + 9 l + 2 f, par portion.
// PURE. {kcal, estimee} pour la portion r (quantité / 100).
function kcalPortion(f,r){
  if(!f) return {kcal:null,estimee:false};
  if(f.k!=null) return {kcal:Math.round(f.k*r),estimee:f.k_calc===true};
  if(f.p!=null&&f.c!=null&&f.l!=null)
    return {kcal:Math.round((4*f.p+4*f.c+9*f.l+2*(Number(f.f)||0))*r),estimee:true};
  return {kcal:null,estimee:false};
}
// Les entrées déjà enregistrées sans énergie, macros connues : estimées une
// fois, et marquées. Rend true si quelque chose a changé.
function migrerKcalEstimees(user){
  const log=(user&&user.nutrition&&user.nutrition.log)||{};
  let bouge=false;
  for(const d of Object.keys(log)){
    for(const e of ((log[d]||{}).entries||[])){
      if(!e||e.kcal!=null||e.p==null||e.c==null||e.l==null) continue;
      e.kcal=Math.round(4*Number(e.p)+4*Number(e.c)+9*Number(e.l)+2*(Number(e.fi)||0));
      e.kcalEstimee=true; bouge=true;
    }
  }
  return bouge;
}

// ── Repas proposé : le dernier choisi, sinon l'heure ───────────────────────
// Le barème est un REPÈRE, pas une vérité : on mange à des heures différentes
// selon les gens et les jours. Il ne sert qu'à éviter de proposer « Matin » à
// 21 h. L'athlète change d'un doigt, et son choix tient pour toute la session.
// R27 — CINQ CRENEAUX, et non plus quatre : apres 22 h, c'est « Avant de se
// coucher », que le barème ne proposait jamais. Minuit à 11 h reste « Matin ».
const FJ_BAREME_REPAS=Object.freeze([
  {avant:11,repas:'matin'},
  {avant:15,repas:'dejeuner'},
  {avant:18,repas:'collation'},
  {avant:22,repas:'diner'},
]);
const FJ_REPAS_DEFAUT='coucher';   // au-delà du dernier seuil
function repasSelonHeure(ref){
  const d=(ref instanceof Date)?ref:new Date();
  const h=d.getHours();
  for(const b of FJ_BAREME_REPAS) if(h<b.avant) return b.repas;
  return FJ_REPAS_DEFAUT;
}
// Vrai dès que l'athlète a touché un bouton de repas dans cette session. Tant
// qu'il ne l'a pas fait, on déduit ; après, on respecte son choix.
// R27 — ET DES LE PREMIER AJOUT : le second aliment herite du repas du premier,
// qu'il ait ete choisi ou seulement propose par l'heure. Un barème qui change
// de creneau entre deux aliments du meme repas les separerait. LA SESSION
// commence a openFoodSearch, qui remet le drapeau a faux : il ne survit plus
// d'un repas a l'autre, ni d'un soir au lendemain matin.
let _fjRepasChoisi=false;
// R27 — le dernier aliment ajoute pendant la session : ce que dit le bandeau de
// la recherche, et ce qu'« Annuler » retire. null hors session.
let _fjSaisieAjout=null;

// ── Favoris ───────────────────────────────────────────────────────────────
// recentFoods n'est PAS touché : il continue de se remplir et de s'afficher
// comme avant. Les favoris sont une liste à part, tenue à la main.
const FJ_FAV_MAX=20;
// Un favori est un identifiant Ciqual (nombre) ou, depuis le build 1857, un
// produit du carnet « off:<ean> ». Rien d'autre.
const FJ_FAV_OFF=/^off:[0-9]{6,14}$/;
function _fjFavValide(id){ return typeof id==='number'||(typeof id==='string'&&FJ_FAV_OFF.test(id)); }
function _fjFavs(){
  const l=(currentUser&&currentUser.nutrition&&currentUser.nutrition.favoriteFoods)||[];
  return Array.isArray(l)?l.filter(_fjFavValide):[];
}
function estFavori(id){ return _fjFavs().indexOf(id)>=0; }
function toggleFavFood(id,ev){
  if(ev&&ev.stopPropagation) ev.stopPropagation();
  if(!_fjFavValide(id)) return false;
  if(!currentUser.nutrition) currentUser.nutrition={};
  const l=_fjFavs().slice();
  const i=l.indexOf(id);
  if(i>=0) l.splice(i,1);
  else {
    if(l.length>=FJ_FAV_MAX){
      toast('20 favoris au maximum : retires-en un d\'abord','var(--orange)');
      return false;
    }
    l.unshift(id);
  }
  currentUser.nutrition.favoriteFoods=l;
  saveUser();
  _renderFjRecent();
  const b=document.getElementById('fja-epingle');
  if(b&&_fjFood) b.outerHTML=_htmlEpingle(_fjFood.id,true);
  return true;
}
// Dernière quantité RÉELLEMENT utilisée pour cet aliment, lue dans le journal.
// Stockée nulle part : le journal la porte déjà, et la dupliquer c'est se
// préparer à afficher un chiffre périmé.
function _fjDerniereQty(id){
  const log=(currentUser&&currentUser.nutrition&&currentUser.nutrition.log)||{};
  const jours=Object.keys(log).sort().reverse();
  for(const j of jours){
    const es=((log[j]||{}).entries)||[];
    for(let i=es.length-1;i>=0;i--)
      if(es[i]&&es[i].alim_id===id&&Number(es[i].qty)>0) return Number(es[i].qty);
  }
  return null;
}
function _htmlEpingle(id,grand){
  const on=estFavori(id);
  const t=grand?18:15;
  return `<button id="${grand?'fja-epingle':''}" onclick="toggleFavFood(${_attrArg(id)},event)"
    title="${on?'Retirer des favoris':'Ajouter aux favoris'}"
    aria-label="${on?'Retirer des favoris':'Ajouter aux favoris'}"
    style="background:none;border:none;cursor:pointer;padding:${grand?'6px 8px':'4px 6px'};line-height:1;flex-shrink:0;color:${on?'var(--red)':'var(--text-dim)'};font-size:${t}px">${on?'<span class="ico-plein">'+icon('etoile',t)+'</span>':icon('etoile',t)}</button>`;
}

// ── Portions visuelles ────────────────────────────────────────────────────
// APPROXIMATIONS, et l'écran le dit. Une paume, un poing et un pouce ne sont
// pas des instruments de mesure : ils servent à ne pas rester bloqué devant un
// champ vide quand on n'a pas de balance.
const FJ_PORTIONS=Object.freeze([
  {cle:'paume',lib:'Paume',g:120,note:'≈ une paume',
   groupes:['viandes, oeufs, poissons','produits laitiers']},
  {cle:'poing',lib:'Poing',g:150,note:'≈ un poing',
   groupes:['fruits, légumes, légumineuses et oléagineux','produits céréaliers']},
  {cle:'pouce',lib:'Pouce',g:15,note:'≈ un pouce',
   groupes:['matières grasses']},
]);
const FJ_PORTIONS_NOTE="Repères approximatifs, pas des mesures : ajuste si tu connais le poids.";
// `nom` (f.s, facultatif) : les fromages, le beurre et la crème n'ont pas de
// paume — « Paume · 120 g » de parmesan n'est pas un repère, c'est une erreur
// (build 1855). Ils ont désormais leurs unités (portion, tranche, cuillère).
const FJ_PORTIONS_EXCLUS=/fromage|beurre|creme|emmental|comte|beaufort|gruyere|cantal|mimolette|gouda|edam|tomme|parmesan|raclette|camembert|brie|coulommiers|munster|reblochon|roquefort|feta|mozzarella|morbier|abondance|chevre/;
function portionsPourGroupe(groupe,nom){
  const g=String(groupe==null?'':groupe).toLowerCase().trim();
  if(!g) return [];
  if(nom&&FJ_PORTIONS_EXCLUS.test(String(nom))) return [];
  return FJ_PORTIONS.filter(p=>p.groupes.some(x=>x.toLowerCase()===g));
}

// ══════════════ SAISIE EN UNITÉS NATURELLES ═══════════════════════════════
// « 2 œufs » plutôt que « 100 g ». LA DONNÉE STOCKÉE NE CHANGE PAS D'UN OCTET :
// `qty` reste en grammes, toujours, et l'unité n'est qu'un chemin de saisie.
// Aucune double vérité — c'est la règle qui commande tout ce bloc.
//
// POURQUOI PAS UNE UNITÉ PAR GROUPE. Le groupe est le mauvais niveau, et le
// comptage des aliments le prouve : « fruits, légumes, légumineuses et
// oléagineux » compte 653 entrées où cohabitent la banane, la carotte, l'avocat
// et la graine germée de luzerne. Une « unité » de ce groupe afficherait
// « 1 unité ≈ 120 g » devant une graine germée. Les unités s'attachent donc à
// l'ALIMENT, sauf trois groupes où elles sont vraies pour tout le monde.
//
// Les repères paume/poing/pouce (FJ_PORTIONS) ne bougent pas et ne fusionnent
// pas avec ceci : ce sont des APPROXIMATIONS visuelles, pas des unités.
const FJ_UNITE_G=Object.freeze({cle:'g',lib:'grammes',pluriel:'grammes',gParUnite:1});
// Par ALIMENT. Chaque poids est un ordre de grandeur courant, pas une mesure ;
// l'écran affiche toujours le gramme obtenu, et il reste modifiable.
const FJ_UNITES_ALIMENT=Object.freeze({
  22000:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf cru
  22010:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf dur
  22011:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf poché
  22014:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf à la coque
  22505:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf au plat
  22502:{cle:'oeuf',lib:'œuf',pluriel:'œufs',gParUnite:50},        // Oeuf brouillé
  13005:{cle:'fruit',lib:'banane',pluriel:'bananes',gParUnite:120},
  13039:{cle:'fruit',lib:'pomme',pluriel:'pommes',gParUnite:150},
  13396:{cle:'fruit',lib:'pomme',pluriel:'pommes',gParUnite:150},
  13037:{cle:'fruit',lib:'poire',pluriel:'poires',gParUnite:150},
  13397:{cle:'fruit',lib:'poire',pluriel:'poires',gParUnite:150},
  13034:{cle:'fruit',lib:'orange',pluriel:'oranges',gParUnite:130},
  13024:{cle:'fruit',lib:'clémentine',pluriel:'clémentines',gParUnite:70},
  13021:{cle:'fruit',lib:'kiwi',pluriel:'kiwis',gParUnite:75},
  13004:{cle:'fruit',lib:'avocat',pluriel:'avocats',gParUnite:150},
  20009:{cle:'legume',lib:'carotte',pluriel:'carottes',gParUnite:80},
  7001: {cle:'tranche',lib:'tranche',pluriel:'tranches',gParUnite:30},   // Pain blanc
  7200: {cle:'tranche',lib:'tranche',pluriel:'tranches',gParUnite:30},   // Pain de mie blanc
  7201: {cle:'tranche',lib:'tranche',pluriel:'tranches',gParUnite:30},
  7110: {cle:'tranche',lib:'tranche',pluriel:'tranches',gParUnite:30},   // Pain complet
  7111: {cle:'tranche',lib:'tranche',pluriel:'tranches',gParUnite:30},
  15005:{cle:'cerneau',lib:'cerneau',pluriel:'cerneaux',gParUnite:5},    // Noix
  15000:{cle:'amande',lib:'amande',pluriel:'amandes',gParUnite:1.2},
  15041:{cle:'amande',lib:'amande',pluriel:'amandes',gParUnite:1.2}
});
// Par GROUPE, et seulement là où l'unité vaut pour TOUT le groupe. Trois
// entrées, pas une de plus : les plats composés, les produits sucrés, les
// aides culinaires, les aliments infantiles et les glaces n'ont aucune unité
// honnête, et n'en auront donc pas.
const FJ_UNITES_GROUPE=Object.freeze({
  'matières grasses':[
    {cle:'cas',lib:'cuillère à soupe',pluriel:'cuillères à soupe',gParUnite:10},
    {cle:'cac',lib:'cuillère à café',pluriel:'cuillères à café',gParUnite:5}],
  'eaux et autres boissons':[
    {cle:'verre',lib:'verre',pluriel:'verres',gParUnite:200}]
  // « produits laitiers » N'A PLUS D'UNITÉ DE GROUPE (build 1855) : le lait,
  // l'emmental et la crème recevaient un « pot de 125 g ». Le pot vit
  // désormais sur les seules fiches qui en ont un (champ « u » de la table).
});
// PURE. Les unités disponibles pour un aliment. « g » vient TOUJOURS en
// premier : c'est le défaut, et il ne se perd jamais.
//
// Un produit Open Food Facts porte le groupe « produit de marque », absent de
// Ciqual : aucune unité de groupe ne peut donc le toucher. En revanche, quand
// le FABRICANT déclare une portion, elle vaut mieux que n'importe quelle
// moyenne — « 1 pot = 140 g » dit par Danone bat une estimation.
// BUILD 1855 — L'ORDRE : « g », la portion du FABRICANT (Open Food Facts), les
// unités de la table (champ « u », scripts/portions_aliments.tsv), et seulement
// à défaut FJ_UNITES_ALIMENT — gardé en repli tant qu'un ancien ciqual.json
// peut rester en cache —, puis les unités de groupe. Une clé n'apparaît qu'une fois.
function _uniteDeTable(u){
  return (u&&u.c&&u.g>0&&u.g<=1500)?{cle:String(u.c),lib:String(u.l||u.c),pluriel:String(u.p||u.l||u.c),gParUnite:Number(u.g)}:null;
}
function unitesPour(aliment){
  const out=[FJ_UNITE_G];
  if(!aliment) return out;
  const vus=new Set(['g']);
  const pousser=u=>{ if(u&&!vus.has(u.cle)){ vus.add(u.cle); out.push(u); } };
  const p=aliment._off&&Number(aliment._off.portion);
  if(p>0&&p<=1500)
    pousser({cle:'portion',lib:'portion',pluriel:'portions',gParUnite:p,fabricant:true});
  const table=Array.isArray(aliment.u)?aliment.u.map(_uniteDeTable).filter(Boolean):[];
  if(table.length) table.forEach(pousser);
  else pousser(FJ_UNITES_ALIMENT[aliment.id]||null);
  const g=String(aliment.g==null?'':aliment.g).toLowerCase().trim();
  if(g&&FJ_UNITES_GROUPE[g]) for(const u of FJ_UNITES_GROUPE[g]) pousser(u);
  return out;
}
// PURE. LA PRÉSÉLECTION (build 1855). Une fiche qui a une unité s'ouvre sur
// elle, à 1 — un geste de moins sur la whey, l'œuf, le skyr. SAUF si
// l'athlète a déjà saisi cet aliment : sa dernière quantité l'emporte.
// Sans unité de table, rien ne change : la quantité par défaut reste, et seul
// un favori rouvre sur sa dernière quantité (règle d'avant ce lot).
function _fjPreselection(f,derniereQty){
  const l=unitesPour(f).filter(u=>u.cle!=='g');
  if(!(Array.isArray(f&&f.u)&&f.u.length&&l.length)) return null;
  if(derniereQty>0) return {unite:'g',qty:derniereQty};
  return {unite:l[0].cle,n:1,qty:qtyDepuisUnite(1,l[0])};
}
// PURE. Une clé d'unité pour un aliment donné, ou null.
function uniteDe(aliment,cle){
  return unitesPour(aliment).find(u=>u.cle===cle)||null;
}
// PURE. Des unités vers des GRAMMES. Le résultat est arrondi au dixième de
// gramme et RENDU TEL QUEL : c'est exactement ce que l'écran affiche et ce que
// saveFoodEntry enregistrera. Aucun arrondi silencieux en aval.
//
// Les demi-unités sont acceptées — un demi-avocat est un repas courant.
function qtyDepuisUnite(n,unite){
  const q=parseFloat(String(n==null?'':n).replace(',','.'));
  if(!isFinite(q)||q<=0) return null;
  const u=(unite&&unite.gParUnite>0)?unite:FJ_UNITE_G;
  return Math.round(q*u.gParUnite*10)/10;
}
// PURE. L'inverse, pour l'affichage seul. L'aller-retour g → unité → g ne
// dérive pas tant qu'on ne réécrit pas `qty` avec : ce que cette fonction rend
// sert à REMPLIR un champ, jamais à recalculer un enregistrement.
function uniteDepuisQty(grammes,unite){
  const g=parseFloat(grammes);
  if(!isFinite(g)||g<=0||!unite||!(unite.gParUnite>0)) return null;
  return Math.round(g/unite.gParUnite*100)/100;
}
// PURE. « 2 œufs ≈ 100 g ». Le libellé s'accorde, et la valeur affichée est
// celle qui sera enregistrée.
function libelleUnite(n,unite,grammes){
  if(!unite||unite.cle==='g') return '';
  const q=parseFloat(String(n==null?'':n).replace(',','.'));
  if(!isFinite(q)||q<=0) return '';
  // Le pluriel francais commence a DEUX : « 1,5 cuillere a soupe », pas
  // « 1,5 cuilleres ». Vu au rendu, pas au banc.
  const nom=(q>=2)?unite.pluriel:unite.lib;
  const qAff=String(Math.round(q*100)/100).replace('.',',');
  const gAff=String(Math.round(grammes*10)/10).replace('.',',');
  return qAff+' '+nom+' ≈ '+gAff+' g'+(unite.fabricant?' (portion déclarée par le fabricant)':'');
}

// ── Le sélecteur d'unité ──────────────────────────────────────────────────
// LE CHAMP `fja-qty` RESTE EN GRAMMES, toujours. L'unité n'ajoute pas une
// seconde source de vérité : elle est un CONVERTISSEUR qui écrit dans le champ
// des grammes, lequel reste seul lu par saveFoodEntry. C'est ce qui rend la
// double vérité structurellement impossible plutôt que simplement évitée.
let _fjUnite='g';
function _htmlUnites(f){
  const l=unitesPour(f);
  if(l.length<=1) return '';          // règle 5 : seul « g », écran d'avant
  return `<div id="fja-unites" style="margin-top:10px">
    <div style="display:flex;gap:8px;align-items:center">
      <select id="fja-unite" onchange="fjaChangerUnite(this.value)" style="flex:1"
        aria-label="Unité de saisie">
        ${l.map(u=>`<option value="${escapeHtml(u.cle)}"${u.cle===_fjUnite?' selected':''}>${escapeHtml(u.cle==='g'?'grammes':u.lib)}</option>`).join('')}
      </select>
      <input id="fja-unite-n" type="number" min="0.5" step="0.5" value="1"
        oninput="fjaMajDepuisUnite()" aria-label="Nombre d'unités"
        style="width:88px;box-sizing:border-box;text-align:center;font-size:var(--fs-lg);font-weight:800;display:none">
    </div>
    <div id="fja-unite-eq" style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:6px"></div>
  </div>`;
}
function fjaChangerUnite(cle){
  _fjUnite=cle||'g';
  const n=document.getElementById('fja-unite-n');
  const eq=document.getElementById('fja-unite-eq');
  const lbl=document.getElementById('fja-qty-label');
  if(_fjUnite==='g'){
    if(n) n.style.display='none';
    if(eq) eq.textContent='';
    // Le libellé redevient explicite : on saisit bien des grammes.
    if(lbl) lbl.textContent='Quantité (grammes)';
    return;
  }
  const u=uniteDe(_fjFood,_fjUnite);
  if(!u){ _fjUnite='g'; return; }
  if(n){ n.style.display='block'; if(!(parseFloat(n.value)>0)) n.value=1; }
  // Le champ des grammes reste visible et modifiable : l'unité le remplit, elle
  // ne le remplace pas. Un athlète qui connaît le poids exact le tape.
  if(lbl) lbl.textContent='Quantité (grammes) : remplie depuis l\'unité';
  fjaMajDepuisUnite();
}
function fjaMajDepuisUnite(){
  const n=document.getElementById('fja-unite-n');
  const eq=document.getElementById('fja-unite-eq');
  const u=uniteDe(_fjFood,_fjUnite);
  if(!u||u.cle==='g'||!n) return false;
  const g=qtyDepuisUnite(n.value,u);
  if(g==null){ if(eq) eq.textContent=''; return false; }
  // RÈGLE 2 : les bornes s'appliquent APRÈS conversion. On n'écrit pas une
  // valeur hors bornes dans le champ — on le dit, et saveFoodEntry redira non
  // avec SON message, qui n'est pas réécrit.
  if(eq){
    eq.textContent=libelleUnite(n.value,u,g)+(g>9999?' : au-delà du maximum enregistrable.':'');
    eq.style.color=(g>9999)?'var(--orange)':'var(--sub)';
  }
  const inp=document.getElementById('fja-qty');
  if(inp){ inp.value=g; updateFjaCalc(); }
  return true;
}
// Le champ des grammes touché à la main REPREND la main : l'équivalence
// affichée deviendrait fausse, et une équivalence fausse est pire qu'aucune.
function fjaQtyTouchee(){
  if(_fjUnite!=='g'){
    const eq=document.getElementById('fja-unite-eq');
    const u=uniteDe(_fjFood,_fjUnite);
    const inp=document.getElementById('fja-qty');
    const n=document.getElementById('fja-unite-n');
    // On recalcule le NOMBRE d'unités depuis les grammes saisis, plutôt que de
    // laisser un « 2 œufs » mensonger sous un champ qui dit 140 g.
    const q=u?uniteDepuisQty(inp&&inp.value,u):null;
    if(q!=null&&n) n.value=q;
    if(eq&&u&&q!=null) eq.textContent=libelleUnite(q,u,parseFloat(inp.value)||0);
  }
  updateFjaCalc();
}
// PURE. Ce qui sera consigné pour l'affichage, ou ''. Une CHAÎNE, pas une
// structure : elle ne sert qu'à relire « 2 œufs » dans les récents, et elle
// n'est jamais recalculée en quoi que ce soit.
function fjaLibelleUniteChoisie(){
  if(_fjUnite==='g') return '';
  const u=uniteDe(_fjFood,_fjUnite);
  const n=document.getElementById('fja-unite-n');
  if(!u||!n) return '';
  const q=parseFloat(String(n.value).replace(',','.'));
  if(!isFinite(q)||q<=0) return '';
  const nom=(q>=2)?u.pluriel:u.lib;
  return String(Math.round(q*100)/100).replace('.',',')+' '+nom;
}
function _htmlPortions(f){
  const l=portionsPourGroupe(f&&f.g,f&&(f.s||_fjNorm(f.n)));
  if(!l.length) return '';
  return `<div style="display:flex;gap:8px;margin-top:10px">
    ${l.map(p=>`<button onclick="setFjaQty(${p.g})"
      style="flex:1;padding:8px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;cursor:pointer">${p.lib} · ${p.g} g</button>`).join('')}
  </div>
  <div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:6px;line-height:1.5">${escapeHtml(FJ_PORTIONS_NOTE)}</div>`;
}

// ── Rejouer un repas, ou la veille ────────────────────────────────────────
// Rien n'est jamais écrasé : la copie s'AJOUTE. Ce qui vient d'être ajouté est
// récapitulé avec une annulation, parce qu'une copie qui se trompe de jour ou
// de repas doit se défaire d'un geste et non à la main, entrée par entrée.
let _fjDernierAjout=null;   // {date, ids:[...], quoi:'...'}
function _fjEntrees(date){
  const log=(currentUser&&currentUser.nutrition&&currentUser.nutrition.log)||{};
  return ((log[date]||{}).entries)||[];
}
// Identifiants NEUFS et distincts. Date.now() seul en donnerait un identique à
// plusieurs entrées copiées dans la même milliseconde, et l'annulation en
// retirerait alors plus que prévu.
function _fjIdsNeufs(dateCible,combien){
  const pris=_fjEntrees(dateCible).map(e=>Number(e&&e.id)||0);
  let base=Math.max(Date.now(),...(pris.length?pris:[0]));
  const out=[];
  for(let i=1;i<=combien;i++) out.push(base+i);
  return out;
}
function _fjCopier(entrees,dateCible,repas){
  if(!entrees||!entrees.length) return [];
  const ids=_fjIdsNeufs(dateCible,entrees.length);
  return entrees.map((e,i)=>Object.assign({},e,{id:ids[i]},repas?{repas}:{}));
}
// ══ LOT R1 : LES RECETTES (29/09/2026) ═════════════════════════════════════
//
// Une bibliothèque de recettes que le coach partage à ses athlètes, et des
// recettes perso que l'athlète écrit pour lui. Elles servent à deux endroits :
// le plan alimentaire (une ligne « recette » dans un repas, en portions) et le
// journal (la recherche, et une rangée à un geste en tête).
//
// ⚠ LES MACROS NE SONT JAMAIS STOCKÉES DANS LA RECETTE. recetteMacros les
//   calcule à la lecture, à partir des ingrédients. Chaque ingrédient garde
//   en revanche un INSTANTANÉ de ses valeurs pour 100 g (m) : un produit Open
//   Food Facts peut disparaître, et une recette qui le contient doit encore
//   se chiffrer. Un ingrédient Ciqual se relit dans la table quand elle est
//   chargée, et retombe sur son instantané sinon (hors ligne, premier écran).
// ⚠ LE JOURNAL GARDE SES VALEURS. Une entrée issue d'une recette porte ses
//   calories et ses macros absolues, comme n'importe quel aliment : supprimer
//   la recette ne change rien à ce qui a été mangé.
// ⚠ LA LIGNE DU PLAN porte, elle aussi, ses macros par portion (p, c, l, en
//   unité « portion ») : c'est une ligne « à la main » que tout le moteur du
//   plan sait déjà compter. Elles se remettent à jour depuis la bibliothèque
//   quand le coach enregistre le plan.
// ⚠ HORS LIGNE : les deux listes vivent dans le stockage local (DB) après la
//   première synchro ; ce qui s'écrit sans réseau part au retour du réseau.
//
// Firebase : recettes/<coach>/<id> (lu par ses athlètes),
//            recettes_perso/<athlète>/<id> (lu par lui et son coach).

const RECETTE_ING_MAX=50, RECETTE_NOM_MAX=80, RECETTE_G_MIN=1, RECETTE_G_MAX=2000;
const RECETTE_PORTIONS_MAX=100, RECETTE_TAGS_MAX=10;
const RECETTES_TTL=3600000;   // 1 h, comme les aliments du coach
function _recNb(v){
  if(v==null||v==='') return null;
  const n=typeof v==='number'?v:parseFloat(String(v).replace(',','.'));
  return isFinite(n)?n:null;
}
function _recArr(v){ return Math.round(v*10)/10; }
function recetteId(t){ return 'r'+(Number(t)||Date.now())+'-'+Math.random().toString(36).slice(2,8); }
// « 0,5 portion », « 1 portion », « 2 portions ».
// Un nombre à la française : 26,1 et non 26.1.
function _recF(v){ return String(v==null?'-':v).replace('.',','); }
// Les macros d'une portion, sans qu'une valeur se coupe en fin de ligne.
function _recMacrosHtml(m,suffixe){
  const nw=t=>'<span class="rct-nw">'+t+'</span>';
  return nw('<b>'+m.kcal+' kcal</b>'+(suffixe||''))+' · '+nw('P '+_recF(m.p)+' g')+' · '+nw('G '+_recF(m.c)+' g')+' · '+nw('L '+_recF(m.l)+' g');
}
function recettePortionsTxt(n){
  const v=_recNb(n)||0;
  return String(_recArr(v)).replace('.',',')+' portion'+(v>=2?'s':'');
}

// PURE. Un ingrédient à partir d'un aliment Ciqual ou Open Food Facts, avec
// l'instantané de ses valeurs pour 100 g.
function recetteIngredient(src,a,grammes){
  if(!a) return null;
  const off=src==='off';
  const ref=off?String((a._off&&a._off.ean)||String(a.id||'').replace(/^off:/,'')):Number(a.id);
  if(off?!ref:!isFinite(ref)) return null;
  const m={};
  for(const k of ['k','p','c','l']){ const v=_recNb(a[k]); if(v!=null&&v>=0) m[k]=Math.round(v*100)/100; }
  const g=Math.round(Math.min(RECETTE_G_MAX,Math.max(RECETTE_G_MIN,_recNb(grammes)||100)));
  return {src:off?'off':'ciqual',ref,grammes:g,nom:String(a.n||'').slice(0,120),m};
}
// PURE. Les valeurs pour 100 g d'un ingrédient : la table si elle le connaît
// encore, sinon l'instantané. null si ni l'une ni l'autre ne répond.
function recetteParCent(ing,chercher){
  if(!ing) return null;
  if(ing.src==='ciqual'){
    let f=null; try{ f=_planResolveur(chercher)(Number(ing.ref)); }catch(e){ f=null; }
    if(f&&(f.k!=null||f.p!=null||f.c!=null||f.l!=null))
      return {k:_recNb(f.k),p:_recNb(f.p)||0,c:_recNb(f.c)||0,l:_recNb(f.l)||0,vif:true};
  }
  const m=ing.m||{};
  if(['k','p','c','l'].some(k=>_recNb(m[k])!=null))
    return {k:_recNb(m.k),p:_recNb(m.p)||0,c:_recNb(m.c)||0,l:_recNb(m.l)||0,vif:false};
  return null;
}
// PURE. Les macros de `portions` portions (1 par défaut ; 0,5 accepté).
// La somme se fait sur les valeurs exactes ; l'arrondi vient à la fin, une
// fois : kcal et grammes à l'unité, macros au dixième.
function recetteMacros(recette,portions,chercher){
  const r=recette||{};
  const n=_recNb(r.portions);
  const nP=portions==null?1:_recNb(portions);
  const tot={k:0,p:0,c:0,l:0,g:0};
  const manquants=[];
  for(const ing of (Array.isArray(r.ingredients)?r.ingredients:[])){
    const g=_recNb(ing&&ing.grammes);
    if(!(g>0)) continue;
    tot.g+=g;
    const per=recetteParCent(ing,chercher);
    if(!per){ manquants.push(String((ing&&ing.nom)||'?')); continue; }
    const k=per.k!=null?per.k:kcalDesMacros(per.p,per.c,per.l);
    tot.k+=k*g/100; tot.p+=per.p*g/100; tot.c+=per.c*g/100; tot.l+=per.l*g/100;
  }
  const f=(n>0&&nP>0)?nP/n:0;
  return {kcal:Math.round(tot.k*f),p:_recArr(tot.p*f),c:_recArr(tot.c*f),l:_recArr(tot.l*f),g:Math.round(tot.g*f),
    portions:nP>0?nP:0,
    total:{kcal:Math.round(tot.k),p:_recArr(tot.p),c:_recArr(tot.c),l:_recArr(tot.l),g:Math.round(tot.g)},
    manquants};
}
// PURE. Les mêmes bornes que les règles de la base, dites en français.
function recetteValide(r){
  if(!r||typeof r!=='object') return {ok:false,raison:'Recette vide.'};
  const nom=String(r.nom||'').trim();
  if(!nom) return {ok:false,raison:'Donne un nom à ta recette.'};
  if(nom.length>RECETTE_NOM_MAX) return {ok:false,raison:'Le nom tient en '+RECETTE_NOM_MAX+' caractères.'};
  const n=_recNb(r.portions);
  if(!(n>0)||n>RECETTE_PORTIONS_MAX) return {ok:false,raison:'Indique pour combien de portions (de 0,5 à '+RECETTE_PORTIONS_MAX+').'};
  const l=Array.isArray(r.ingredients)?r.ingredients:[];
  if(!l.length) return {ok:false,raison:'Ajoute au moins un ingrédient.'};
  if(l.length>RECETTE_ING_MAX) return {ok:false,raison:RECETTE_ING_MAX+' ingrédients au plus.'};
  for(const i of l){
    const g=_recNb(i&&i.grammes);
    if(!(g>=RECETTE_G_MIN&&g<=RECETTE_G_MAX)) return {ok:false,raison:'Quantité de '+String((i&&i.nom)||'un ingrédient')+' : de '+RECETTE_G_MIN+' à '+RECETTE_G_MAX+' g.'};
    if(!i||(i.src!=='ciqual'&&i.src!=='off')) return {ok:false,raison:'Ingrédient sans origine.'};
  }
  return {ok:true,raison:null};
}
// PURE. Ce qui s'écrit dans la base : les champs des règles, rien d'autre.
function recetteNettoyer(r,t){
  const now=Number(t)||Date.now();
  const o={nom:String(r.nom||'').trim().slice(0,RECETTE_NOM_MAX),
    portions:_recArr(_recNb(r.portions)||1),
    ingredients:(r.ingredients||[]).slice(0,RECETTE_ING_MAX).map(i=>{
      const x={src:i.src==='off'?'off':'ciqual',ref:i.src==='off'?String(i.ref).slice(0,40):Number(i.ref),
        grammes:Math.round(Math.min(RECETTE_G_MAX,Math.max(RECETTE_G_MIN,_recNb(i.grammes)||RECETTE_G_MIN)))};
      if(i.nom) x.nom=String(i.nom).slice(0,120);
      const m={}; for(const k of ['k','p','c','l']){ const v=_recNb(i.m&&i.m[k]); if(v!=null&&v>=0&&v<=1000) m[k]=v; }
      if(Object.keys(m).length) x.m=m;
      return x;
    }),
    creeLe:Number(r.creeLe)||now, modifieLe:now};
  const et=String(r.etapes||'').trim().slice(0,4000);
  if(et) o.etapes=et;
  const tags=(Array.isArray(r.tags)?r.tags:String(r.tags||'').split(','))
    .map(x=>String(x||'').trim().slice(0,30)).filter(Boolean).slice(0,RECETTE_TAGS_MAX);
  if(tags.length) o.tags=tags;
  return o;
}
// PURE. Une copie, sous un nouvel identifiant, qui dit qu'elle en est une.
function recetteDupliquer(r,t){
  const now=Number(t)||Date.now();
  const nom=String((r&&r.nom)||'Recette');
  const suffixe=' (copie)';
  return Object.assign(JSON.parse(JSON.stringify(r||{})),
    {id:recetteId(now),nom:nom.slice(0,RECETTE_NOM_MAX-suffixe.length)+suffixe,creeLe:now,modifieLe:now});
}
// PURE. L'entrée du journal : des valeurs ABSOLUES, comme un aliment. La
// recette peut disparaître ensuite, l'entrée ne bouge pas.
function recetteEntree(recette,portions,repas,id,chercher,de){
  const m=recetteMacros(recette,portions,chercher);
  return {id:Number(id)||Date.now(),nom:String((recette&&recette.nom)||'Recette'),groupe:'Recette',
    qty:m.g,unite:recettePortionsTxt(m.portions),repas:repas||'matin',
    kcal:m.kcal,p:m.p,c:m.c,l:m.l,periSeance:false,
    recette:{id:String((recette&&recette.id)||''),de:de==='perso'?'perso':'coach',portions:m.portions}};
}
// PURE. Les recettes dont le nom contient tous les mots cherchés.
function recettesTrouvees(liste,words){
  const w=(words||[]).filter(Boolean);
  if(!w.length) return [];
  return (liste||[]).filter(r=>r&&r.nom&&_fjContientTous(_fjNorm(r.nom),w))
    .sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr'));
}
// Plan → journal : le repas du plan, dans le vocabulaire du journal.
const RECETTE_REPAS_JOURNAL=Object.freeze({petit_dej:'matin',midi:'dejeuner',soir:'diner',coucher:'coucher'});
function recetteRepasJournal(cle){ return RECETTE_REPAS_JOURNAL[cle]||'collation'; }

// ── Le stockage local, et la synchro ────────────────────────────────────
// 'recettes_moi'  : MA bibliothèque (le coach) ou MES recettes perso (l'athlète),
//                   {key, t, d:{id:recette}, attente:{id:true|'suppr'}}.
// 'recettes_coach': la bibliothèque de mon coach, lue seulement, {key, t, d}.
function _recCle(u){ return String((u&&u.email)||'').replace(/\./g,','); }
function _recNoeud(u){ return (u&&u.role==='coach')?'recettes':'recettes_perso'; }
function _recMoi(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const k=_recCle(u);
  const b=DB.get('recettes_moi');
  return (b&&b.key===k&&b.d&&typeof b.d==='object')?b:{key:k,t:0,d:{},attente:{}};
}
function _recListe(d){
  return Object.keys(d||{}).map(id=>Object.assign({},d[id],{id}))
    .filter(r=>r&&r.nom).sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr'));
}
// Les miennes : la bibliothèque du coach, ou les recettes perso de l'athlète.
function recettesMiennes(){ return _recListe(_recMoi().d); }
// Celles du coach, vues par son athlète (vide pour un coach).
function recettesDuCoach(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach') return [];
  const k=cleCoachDe(u);
  const b=DB.get('recettes_coach');
  return (k&&b&&b.key===k)?_recListe(b.d):[];
}
// Une recette par son origine : 'coach' (celle du coach, ou la mienne si je
// suis le coach) ou 'perso'.
function recetteTrouver(de,id){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const l=(de==='perso'||(u&&u.role==='coach'))?recettesMiennes():recettesDuCoach();
  return l.find(r=>r.id===id)||null;
}
function _recEnLigne(){ return !(typeof navigator!=='undefined'&&navigator.onLine===false); }
let _recSyncEnCours=false;
// Rapatrie les deux listes (TTL d'une heure, sauf `force`) et pousse ce qui
// attend. Hors ligne : rien, et le stockage local répond.
async function recettesSynchroniser(force){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||!u.email||_recSyncEnCours||!_recEnLigne()) return false;
  if(!CLOUD||!CLOUD.ok||!CLOUD.ok()) return false;
  _recSyncEnCours=true;
  try{
    await _recPousser();
    const moi=_recMoi();
    if(force||!moi.t||Date.now()-moi.t>=RECETTES_TTL){
      const r=await _fbJson(_recNoeud(u)+'/'+moi.key);
      if(r&&r.ok){
        const d=Object.assign({},(r.v&&typeof r.v==='object')?r.v:{});
        // Ce qui n'est pas encore parti garde sa version locale.
        for(const id of Object.keys(moi.attente||{})){
          if(moi.attente[id]==='suppr') delete d[id]; else if(moi.d[id]) d[id]=moi.d[id];
        }
        DB.set('recettes_moi',{key:moi.key,t:Date.now(),d,attente:moi.attente||{}});
      }
    }
    if(u.role!=='coach'){
      const k=cleCoachDe(u);
      const b=DB.get('recettes_coach');
      if(k&&(force||!(b&&b.key===k&&b.t&&Date.now()-b.t<RECETTES_TTL))){
        const r=await _fbJson('recettes/'+k);
        if(r&&r.ok) DB.set('recettes_coach',{key:k,t:Date.now(),d:(r.v&&typeof r.v==='object')?r.v:{}});
      }
    }
    return true;
  }catch(e){ return false; }
  finally{ _recSyncEnCours=false; }
}
async function _recPousser(){
  const u=currentUser, moi=_recMoi(), att=Object.assign({},moi.attente||{});
  const ids=Object.keys(att);
  if(!ids.length) return 0;
  let n=0;
  for(const id of ids){
    const chemin=_recNoeud(u)+'/'+moi.key+'/'+id;
    const r=att[id]==='suppr'?await _fbJson(chemin,'DELETE'):(moi.d[id]?await _fbJson(chemin,'PUT',moi.d[id]):{ok:true});
    if(r&&r.ok){ delete att[id]; n++; }
  }
  const b=_recMoi(); b.attente=att; DB.set('recettes_moi',b);
  return n;
}
// Écrit localement d'abord (la recette est là, même sans réseau), puis pousse.
function recetteEnregistrer(r){
  const v=recetteValide(r);
  if(!v.ok) return {ok:false,raison:v.raison};
  const id=r.id||recetteId();
  const b=_recMoi();
  b.d=Object.assign({},b.d,{[id]:recetteNettoyer(r)});
  b.attente=Object.assign({},b.attente,{[id]:true});
  DB.set('recettes_moi',b);
  recettesSynchroniser().catch(()=>{});
  return {ok:true,id};
}
function recetteSupprimerLocal(id){
  const b=_recMoi();
  if(!b.d[id]) return false;
  const d=Object.assign({},b.d); delete d[id];
  b.d=d; b.attente=Object.assign({},b.attente,{[id]:'suppr'});
  DB.set('recettes_moi',b);
  recettesSynchroniser().catch(()=>{});
  return true;
}

// ── Le plan du coach ─────────────────────────────────────────────────────
// PURE. La ligne « recette » d'un repas : ses macros PAR PORTION, en unité
// « portion », que planMacrosItem compte comme une ligne à la main.
function planLigneRecette(recette,repas,portions,id,chercher){
  const m=recetteMacros(recette,1,chercher);
  return {id,repas,recette:String(recette.id),recetteNom:String(recette.nom),
    q:_recNb(portions)>0?_recNb(portions):1,u:'portion',p:m.p,c:m.c,l:m.l};
}
// PURE (écrit dans plan). Remet les lignes recette à jour depuis la
// bibliothèque ; une recette disparue garde ses dernières valeurs.
function planRecettesActualiser(plan,liste,chercher){
  let n=0;
  for(const it of planSquelette(plan)){
    if(!it.recette) continue;
    const r=(liste||[]).find(x=>x&&x.id===it.recette);
    if(!r) continue;
    const m=recetteMacros(r,1,chercher);
    if(it.p!==m.p||it.c!==m.c||it.l!==m.l||it.recetteNom!==r.nom){ it.p=m.p; it.c=m.c; it.l=m.l; it.recetteNom=String(r.nom); n++; }
  }
  return n;
}
function _cplRecettesRendre(q){
  const el=document.getElementById('cpl-search-list');
  if(!el) return;
  const words=_fjNorm(String(q||'')).split(/\s+/).filter(w=>w.length>1);
  const tout=recettesMiennes();
  const l=words.length?recettesTrouvees(tout,words):tout;
  if(!tout.length){
    el.innerHTML=emptyState('utensils','Ta bibliothèque de recettes est vide.','Créer une recette','fermerRecherchePlan();ouvrirRecettes()','padding:16px 8px');
    return;
  }
  el.innerHTML=l.map(r=>{
    const m=recetteMacros(r,1);
    return '<div class="fj-result" role="button" tabindex="0" onclick="planCoachChoisirRecette('+_attrArg(r.id)+')"'
      +' onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}">'
      +'<div class="rct-n">'+escapeHtml(r.nom)+' <span class="rct-b">recette</span></div>'
      +'<div class="rct-m">'+_recMacrosHtml(m,' par portion')+'</div></div>';
  }).join('')||emptyState('','Aucune recette pour « '+escapeHtml(q)+' ».',null,null,'padding:12px 0');
}
function cplChoisirRecette(repas){
  ouvrirRecherchePlan({mode:'recette',repas});
  const ti=document.getElementById('cpl-search-title');
  if(ti) ti.textContent='Recette · '+planLibRepas(repas);
  _cplRecettesRendre('');
  recettesSynchroniser().then(ok=>{ if(ok&&_cplCible&&_cplCible.mode==='recette'){ const i=document.getElementById('cpl-search-input'); _cplRecettesRendre(i?i.value:''); } }).catch(()=>{});
}
function planCoachChoisirRecette(id){
  if(!_cplPlan||!_cplCible){ fermerRecherchePlan(); return false; }
  const r=recettesMiennes().find(x=>x.id===id);
  if(!r) return false;
  _cplPlan.squelette.push(planLigneRecette(r,_cplCible.repas,1,_cplId()));
  fermerRecherchePlan();
  renderPlanCoach();
  return true;
}

// ── Le journal de l'athlète ──────────────────────────────────────────────
// Les lignes recette de SON plan : un geste, la portion et le repas du plan.
function _recLignesPlan(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role==='coach'||!planActif(u)) return [];
  return planSquelette(planDe(u)).filter(it=>it&&it.recette);
}
// PURE. L'entrée d'une ligne recette du plan : la recette vivante si elle est
// là, sinon les valeurs par portion que porte la ligne (hors ligne, recette
// supprimée).
function entreeLignePlanRecette(it,recette,id,chercher){
  const q=_recNb(it.q)>0?_recNb(it.q):1;
  const repas=recetteRepasJournal(it.repas);
  if(recette) return recetteEntree(recette,q,repas,id,chercher,'coach');
  const m=planMacrosItem(it)||{p:0,c:0,l:0,kcal:0};
  return {id:Number(id)||Date.now(),nom:String(it.recetteNom||'Recette'),groupe:'Recette',qty:null,
    unite:recettePortionsTxt(q),repas,kcal:Math.round(m.kcal),p:_recArr(m.p),c:_recArr(m.c),l:_recArr(m.l),
    periSeance:false,recette:{id:String(it.recette),de:'coach',portions:q}};
}
function ajouterRecettePlan(lid){
  const it=_recLignesPlan().find(x=>x.id===lid);
  if(!it) return false;
  const date=_fjDate||localISODate(new Date());
  const r=recettesDuCoach().find(x=>x.id===it.recette)||null;
  const e=entreeLignePlanRecette(it,r,_fjIdsNeufs(date,1)[0]);
  const ok=_fjAjouter([e],date,escapeHtml(e.nom)+' ajouté');
  if(ok){
    try{ currentUser.nutrition.recentsSaisie=majRecents(currentUser.nutrition.recentsSaisie,e); saveUser(); }catch(er){ rcErreurMuette('ajouterRecettePlan',er); }
    toast(e.nom+' ajouté','var(--green)');
    try{ _renderFjRecent(); }catch(er){}
  }
  return ok;
}
function _htmlRecettesSaisie(){
  const lp=_recLignesPlan();
  const cache=recettesDuCoach();
  const puces=lp.map(it=>{
    const r=cache.find(x=>x.id===it.recette);
    const e=entreeLignePlanRecette(it,r,1);
    return '<button type="button" class="fj-rec" onclick="ajouterRecettePlan('+_attrArg(it.id)+')">'
      +'<span class="rct-pl"><span class="fj-rec-n">'+escapeHtml(e.nom)+'</span>'
      +'<span class="fj-rec-q">'+escapeHtml(e.unite)+' · '+e.kcal+' kcal · '+escapeHtml(planLibRepas(it.repas))+'</span></span>'
      +'<span class="fj-rec-plus" aria-hidden="true">+</span></button>';
  }).join('');
  return (puces?'<div class="rct-plan">'+puces+'</div>':'')
    +'<div class="rct-actions"><button type="button" class="rct-lien" onclick="ouvrirRecettes()">'
    +((recettesMiennes().length||cache.length)?'Mes recettes':'+ Créer une recette')+'</button></div>';
}
function _htmlRecetteResultat(r,de){
  const m=recetteMacros(r,1);
  return '<div class="fj-result" role="button" tabindex="0" onclick="ouvrirPortionRecette('+_attrArg(de)+','+_attrArg(r.id)+')"'
    +' onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}">'
    +'<div class="rct-n">'+escapeHtml(r.nom)+' <span class="rct-b">recette</span></div>'
    +'<div class="rct-m">'+_recMacrosHtml(m,' / portion')+(de==='coach'?' · <span class="rct-nw">de ton coach</span>':'')+'</div></div>';
}
// La section « Recettes » de la recherche : les miennes, puis celles du coach.
function htmlRecettesRecherche(words){
  const a=recettesTrouvees(recettesMiennes(),words).map(r=>_htmlRecetteResultat(r,'perso'));
  const b=recettesTrouvees(recettesDuCoach(),words).map(r=>_htmlRecetteResultat(r,'coach'));
  const l=a.concat(b);
  return l.length?_fjTitreSection('Recettes')+l.join(''):'';
}
// La saisie en portions : 0,5 par 0,5, le repas, et c'est tout.
let _recPortion=null;
function ouvrirPortionRecette(de,id){
  const r=recetteTrouver(de,id);
  if(!r) return false;
  _recPortion={de,id,n:1,repas:(typeof _fjRepas!=='undefined'&&_fjRepas)?_fjRepas:'matin'};
  document.getElementById('modal-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="fermerPortionRecette()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Portions" class="rct-feuille"><div id="rct-portion"></div></div></div>');
  _rendrePortionRecette();
  return true;
}
function fermerPortionRecette(){ document.getElementById('modal-overlay')?.remove(); _recPortion=null; }
function portionRecettePas(d){ if(!_recPortion) return; _recPortion.n=Math.max(0.5,Math.min(20,Math.round((_recPortion.n+d)*2)/2)); _rendrePortionRecette(); }
function portionRecetteRepas(k){ if(!_recPortion) return; _recPortion.repas=k; _rendrePortionRecette(); }
function _rendrePortionRecette(){
  const z=document.getElementById('rct-portion');
  if(!z||!_recPortion) return;
  const r=recetteTrouver(_recPortion.de,_recPortion.id);
  if(!r){ fermerPortionRecette(); return; }
  const m=recetteMacros(r,_recPortion.n);
  const btn=(k,lib)=>'<button type="button" class="fj-repas-btn'+(_recPortion.repas===k?' active':'')+'" onclick="portionRecetteRepas('+_attrArg(k)+')">'+lib+'</button>';
  z.innerHTML='<div class="rct-n" style="font-size:var(--fs-lg)">'+escapeHtml(r.nom)+'</div>'
    +'<div class="rct-m">Recette pour '+escapeHtml(recettePortionsTxt(r.portions))+(r.etapes?' · '+escapeHtml(String(r.etapes).slice(0,80))+(String(r.etapes).length>80?'…':''):'')+'</div>'
    +'<div class="rct-pas"><button type="button" onclick="portionRecettePas(-0.5)" aria-label="Moins une demi-portion">−</button>'
    +'<b>'+escapeHtml(recettePortionsTxt(_recPortion.n))+'</b>'
    +'<button type="button" onclick="portionRecettePas(0.5)" aria-label="Plus une demi-portion">+</button></div>'
    +'<div class="rct-tot">'+_recMacrosHtml(m)+'</div>'
    +(m.manquants.length?'<div class="rct-m" style="color:var(--orange)">Sans valeurs : '+escapeHtml(m.manquants.join(', '))+'</div>':'')
    +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin:12px 0">'+btn('matin','Matin')+btn('dejeuner','Déjeuner')+btn('diner','Dîner')+btn('collation','Collation')+btn('coucher','Nuit')+'</div>'
    +'<button type="button" class="btn btn-red" onclick="validerPortionRecette()">Ajouter au journal</button>';
}
function validerPortionRecette(){
  const s=_recPortion;
  if(!s) return false;
  const r=recetteTrouver(s.de,s.id);
  if(!r) return false;
  const date=_fjDate||localISODate(new Date());
  const e=recetteEntree(r,s.n,s.repas,_fjIdsNeufs(date,1)[0],undefined,s.de);
  const ok=_fjAjouter([e],date,escapeHtml(e.nom)+' ajouté');
  if(ok){
    try{ currentUser.nutrition.recentsSaisie=majRecents(currentUser.nutrition.recentsSaisie,e); saveUser(); }catch(er){ rcErreurMuette('validerPortionRecette',er); }
    _fjRepas=s.repas; _fjRepasChoisi=true;
    toast(e.nom+' ajouté','var(--green)');
  }
  fermerPortionRecette();
  return ok;
}

// ── L'écran « Recettes », commun au coach et à l'athlète ─────────────────
let _recEd=null;          // la recette en cours d'édition (copie), ou null : la liste
let _recEdCherche='';
let _recOff=null;         // résultats Open Food Facts de la recherche d'ingrédient
function ouvrirRecettes(){
  _recEd=null;
  // D'où l'on vient (la recherche d'aliments, l'accueil du coach, le plan) : la flèche y ramène.
  goAvecRetour('s-recettes');
  renderRecettes();
  recettesSynchroniser(true).then(ok=>{ if(ok&&!_recEd) renderRecettes(); }).catch(()=>{});
  if(!_ciqualDB) _loadCiqual().then(()=>{ if(!_recEd) renderRecettes(); }).catch(()=>{});
}
function _htmlRecetteCarte(r,de,miennes){
  const m=recetteMacros(r,1);
  const id=_attrArg(r.id);
  const tags=(r.tags||[]).length?'<div class="rct-tags">'+r.tags.map(t=>'<span>'+escapeHtml(t)+'</span>').join('')+'</div>':'';
  const actions=miennes
    ?'<button type="button" class="rct-lien" onclick="modifierRecette('+id+')">Modifier</button>'
      +'<button type="button" class="rct-lien" onclick="dupliquerRecette('+_attrArg(de)+','+id+')">Dupliquer</button>'
      +'<button type="button" class="rct-lien rct-sup" onclick="supprimerRecette('+id+')">Supprimer</button>'
    :'<button type="button" class="rct-lien" onclick="dupliquerRecette('+_attrArg(de)+','+id+')">Copier dans mes recettes</button>';
  return '<div class="rct-carte"><div class="rct-n">'+escapeHtml(r.nom)+'</div>'
    +'<div class="rct-m">'+escapeHtml(recettePortionsTxt(r.portions))+' · '+(r.ingredients||[]).length+' ingrédient'+((r.ingredients||[]).length>1?'s':'')
    +'</div><div class="rct-m">'+_recMacrosHtml(m,' par portion')+'</div>'
    +(m.manquants.length?'<div class="rct-m" style="color:var(--orange)">Sans valeurs : '+escapeHtml(m.manquants.join(', '))+'</div>':'')
    +tags+'<div class="rct-acts">'+actions+'</div></div>';
}
function renderRecettes(){
  const z=document.getElementById('rct-corps');
  if(!z) return;
  if(_recEd){ _rendreEditeurRecette(z); return; }
  const coach=currentUser&&currentUser.role==='coach';
  const mes=recettesMiennes(), duCoach=recettesDuCoach();
  const t=document.getElementById('rct-titre'); if(t) t.textContent='Recettes';
  z.innerHTML='<p class="sub rct-intro">'+(coach
      ?'Tes recettes, partagées à tous tes athlètes. Ajoute-les à un repas du plan, ou laisse-les dans leur recherche d’aliments.'
      :'Tes recettes, et celles de ton coach : elles s’ajoutent au journal en portions, même sans réseau.')+'</p>'
    +'<button type="button" class="btn btn-red" onclick="nouvelleRecette()">Nouvelle recette</button>'
    +'<div class="rct-sec">'+(coach?'Ma bibliothèque':'Mes recettes')+'</div>'
    +(mes.length?mes.map(r=>_htmlRecetteCarte(r,'perso',true)).join(''):emptyState('','Aucune recette pour l’instant.',null,null,'padding:12px 0'))
    +(coach?'':(duCoach.length?'<div class="rct-sec">De ton coach</div>'+duCoach.map(r=>_htmlRecetteCarte(r,'coach',false)).join(''):''));
}
function nouvelleRecette(){
  _recEd={id:null,nom:'',portions:1,ingredients:[],etapes:'',tags:''};
  _recEdCherche=''; _recOff=null;
  renderRecettes();
}
function modifierRecette(id){
  const r=recettesMiennes().find(x=>x.id===id);
  if(!r) return false;
  _recEd=JSON.parse(JSON.stringify(r));
  _recEd.tags=(r.tags||[]).join(', ');
  _recEdCherche=''; _recOff=null;
  renderRecettes();
  return true;
}
function dupliquerRecette(de,id){
  const r=recetteTrouver(de,id);
  if(!r) return false;
  const c=recetteDupliquer(r);
  const res=recetteEnregistrer(c);
  if(!res.ok){ toast(res.raison,'var(--orange)'); return false; }
  toast('Copie créée','var(--green)');
  modifierRecette(res.id);
  return true;
}
async function supprimerRecette(id){
  const r=recettesMiennes().find(x=>x.id===id);
  if(!r) return false;
  if(!await rcConfirm('Supprimer « '+r.nom+' » ?','Ce qui est déjà dans un journal reste tel quel. Une ligne de plan garde ses dernières valeurs.','Supprimer')) return false;
  recetteSupprimerLocal(id);
  renderRecettes();
  return true;
}
function annulerRecette(){ _recEd=null; renderRecettes(); }
function recetteChamp(cle,v){ if(!_recEd) return; _recEd[cle]=v; _rendreTotalRecette(); }
function recetteIngGrammes(i,v){ const x=_recEd&&_recEd.ingredients[i]; if(!x) return; x.grammes=_recNb(v); _rendreTotalRecette(); }
function recetteIngRetirer(i){ if(!_recEd) return; _recEd.ingredients.splice(i,1); renderRecettes(); }
function _rendreTotalRecette(){
  const z=document.getElementById('rct-total');
  if(!z||!_recEd) return;
  const m=recetteMacros(_recEd,1);
  z.innerHTML=(_recNb(_recEd.portions)>0&&_recEd.ingredients.length)
    ?'<div class="rct-lab" style="margin:0 0 4px">Par portion</div>'+_recMacrosHtml(m)
      +'<div class="rct-m">Recette entière : '+m.total.kcal+' kcal · '+m.total.g+' g</div>'
    :'<span class="rct-m">Ajoute des ingrédients et le nombre de portions.</span>';
}
function _rendreEditeurRecette(z){
  const e=_recEd;
  const t=document.getElementById('rct-titre'); if(t) t.textContent=e.id?'Modifier la recette':'Nouvelle recette';
  const ing=e.ingredients.map((x,i)=>'<div class="rct-ing"><div class="rct-ing-n">'+escapeHtml(x.nom||'?')
      +(x.src==='off'?' <span class="rct-b">marque</span>':'')+'</div>'
      +'<input type="number" inputmode="numeric" min="1" max="2000" value="'+escapeHtml(String(x.grammes==null?'':x.grammes))+'" aria-label="Grammes" oninput="recetteIngGrammes('+i+',this.value)"><span class="rct-m">g</span>'
      +'<button type="button" class="rct-x" aria-label="Retirer" onclick="recetteIngRetirer('+i+')">×</button></div>').join('');
  z.innerHTML='<label class="rct-lab" for="rct-nom">Nom</label>'
    +'<input id="rct-nom" class="rct-champ" maxlength="80" value="'+escapeHtml(e.nom||'')+'" placeholder="Ex : porridge protéiné" oninput="recetteChamp(\'nom\',this.value)">'
    +'<label class="rct-lab" for="rct-portions">Portions</label>'
    +'<input id="rct-portions" class="rct-champ" inputmode="decimal" value="'+escapeHtml(String(e.portions==null?'':e.portions).replace('.',','))+'" oninput="recetteChamp(\'portions\',this.value)">'
    +'<div class="rct-sec">Ingrédients ('+e.ingredients.length+'/'+RECETTE_ING_MAX+')</div>'+(ing||emptyState('','Aucun ingrédient.',null,null,'padding:12px 0'))
    +(e.ingredients.length<RECETTE_ING_MAX
      ?'<input id="rct-cherche" class="rct-champ" type="search" autocomplete="off" placeholder="Ajouter un ingrédient" value="'+escapeHtml(_recEdCherche)+'" oninput="recetteChercher(this.value)">'
        +'<div id="rct-resultats"></div>':'')
    +'<div id="rct-total" class="rct-total"></div>'
    +'<label class="rct-lab" for="rct-etapes">Étapes (facultatif)</label>'
    +'<textarea id="rct-etapes" class="rct-champ" rows="4" maxlength="4000" oninput="recetteChamp(\'etapes\',this.value)">'+escapeHtml(e.etapes||'')+'</textarea>'
    +'<label class="rct-lab" for="rct-tags">Étiquettes, séparées par des virgules (facultatif)</label>'
    +'<input id="rct-tags" class="rct-champ" value="'+escapeHtml(e.tags||'')+'" placeholder="Ex : petit-déjeuner, rapide" oninput="recetteChamp(\'tags\',this.value)">'
    +'<div style="display:flex;gap:8px;margin-top:16px"><button type="button" class="btn btn-outline" style="flex:1" onclick="annulerRecette()">Annuler</button>'
    +'<button type="button" class="btn btn-red" style="flex:1" onclick="validerRecette()">Enregistrer</button></div>';
  _rendreTotalRecette();
  _rendreResultatsIngredient();
}
function recetteChercher(v){ _recEdCherche=String(v||''); _recOff=null; _rendreResultatsIngredient(); }
function _rendreResultatsIngredient(){
  const z=document.getElementById('rct-resultats');
  if(!z) return;
  const q=_recEdCherche.trim();
  if(q.length<2){ z.innerHTML=''; return; }
  if(!_ciqualDB){ z.innerHTML=etatChargement(2); _loadCiqual().then(_rendreResultatsIngredient).catch(()=>{}); return; }
  let {normQ,words}=_fjRequete(q);
  let _brut=_fjFiltrer(_ciqualDB,words);
  const _corr=_fjAvecCorrection(q,words,_brut,_ciqualDB);
  if(_corr){ _brut=_corr.res; words=_corr.words; normQ=_corr.normQ; }
  const res=_classerAliments(_brut,normQ,words).slice(0,12).map(x=>x.f);
  const ligne=(src,a,cle)=>'<div class="fj-result" role="button" tabindex="0" onclick="recetteAjouterIngredient('+_attrArg(src)+','+_attrArg(cle)+')"'
    +' onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}">'
    +'<div class="rct-n" style="font-size:var(--fs-sm)">'+escapeHtml(a.n)+(src==='off'?' <span class="rct-b">marque</span>':'')+'</div>'
    +'<div class="rct-m">'+(a.k!=null?_recF(a.k)+' kcal/100 g':'énergie non renseignée')+' · P '+_recF(a.p)+' · G '+_recF(a.c)+' · L '+_recF(a.l)+'</div></div>';
  let h=_htmlBandeauCorrection(_corr,q,'recetteChercher')+res.map(f=>ligne('ciqual',f,f.id)).join('');
  if(_recOff&&_recOff.liste) h+=_fjTitreSection('Produits de marque (Open Food Facts)')+_recOff.liste.slice(0,10).map(a=>ligne('off',a,a.id)).join('');
  else if(_recOff&&_recOff.raison) h+=emptyState('',escapeHtml(_recOff.raison),null,null,'padding:12px 0');
  else if(_recEnLigne()) h+='<div class="rct-actions"><button type="button" class="rct-lien" onclick="recetteChercherOff()">Chercher « '+escapeHtml(q)+' » parmi les produits de marque</button></div>';
  z.innerHTML=h||emptyState('','Aucun résultat.',null,null,'padding:12px 0');
}
async function recetteChercherOff(){
  const q=_recEdCherche.trim();
  if(q.length<2) return;
  _recOff={raison:'Recherche en cours…'}; _rendreResultatsIngredient();
  const r=await offRecherche(q);
  _recOff=(r&&r.ok)?{liste:r.liste||[]}:{raison:(r&&r.raison)||'Recherche impossible.'};
  _rendreResultatsIngredient();
}
function recetteAjouterIngredient(src,cle){
  if(!_recEd||_recEd.ingredients.length>=RECETTE_ING_MAX) return false;
  let a=null;
  if(src==='off') a=((_recOff&&_recOff.liste)||[]).find(x=>x&&x.id===cle)||null;
  else a=_planCiqual(Number(cle));
  const i=recetteIngredient(src,a,100);
  if(!i) return false;
  _recEd.ingredients.push(i);
  _recEdCherche=''; _recOff=null;
  renderRecettes();
  return true;
}
function validerRecette(){
  if(!_recEd) return false;
  const res=recetteEnregistrer(_recEd);
  if(!res.ok){ toast(res.raison,'var(--orange)'); return false; }
  toast(_recEnLigne()?'Recette enregistrée':'Recette enregistrée, elle partira au retour du réseau','var(--green)');
  _recEd=null;
  renderRecettes();
  return true;
}

