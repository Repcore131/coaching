// ══ MEAL PREP ET RECETTE ═══════════════════════════════════════════════
// Le journal sait compter un aliment a la fois. Il ne sait pas repondre a la
// seule question que pose quelqu'un qui cuisine a l'avance : « j'ai fait deux
// kilos de riz et un kilo de poulet pour six repas — qu'est-ce que j'ai dans
// cette assiette ? ». Demande de Kevin, 14/09/2026.
//
// DEUX DIVISEURS, PARCE QUE CE SONT DEUX GESTES DIFFERENTS :
//   • meal prep : on divise par un NOMBRE DE PORTIONS, toutes egales ;
//   • recette   : on prend une PART d'un tout — en grammes peses, ou « a vue
//     de nez » en pourcentage, parce que personne ne pese un gateau.
//
// Les ingredients sont saisis en valeurs POUR 100 g, comme sur un emballage :
// c'est ce qui est ecrit sur le paquet, et c'est donc ce qu'on a sous les yeux.
const PREP_MODES={prep:'Meal prep',recette:'Recette'};
let _prepEtat={mode:'prep',ing:[],portions:2,total_g:'',part_g:'',part_pc:100,base:'g'};
// PURE, et c'est voulu : tout le calcul tient ici, sans DOM, et la suite de
// tests l'eprouve directement.
function prepCalculer(etat){
  // NORMALISE EN TETE. Les deux premieres branches se gardaient une par une
  // (etat&&etat.mode), la troisieme non : prepCalculer(null) levait sur
  // etat.total_g. Une garde par branche finit toujours par en oublier une.
  const e=etat||{};
  const ing=e.ing||[];
  const tot={kcal:0,p:0,c:0,l:0,g:0};
  for(const i of ing){
    const g=Number(i&&i.g)||0;
    if(g<=0) continue;
    tot.g+=g;
    tot.kcal+=(Number(i.k)||0)*g/100;
    tot.p   +=(Number(i.p)||0)*g/100;
    tot.c   +=(Number(i.c)||0)*g/100;
    tot.l   +=(Number(i.l)||0)*g/100;
  }
  // LE FACTEUR, SELON LE MODE. Il vaut 0 quand la saisie ne permet pas encore
  // de conclure : mieux vaut n'afficher aucun chiffre qu'un chiffre faux.
  let f=0;
  if(e.mode==='prep'){
    const n=Math.floor(Number(e.portions)||0);
    if(n>0) f=1/n;
  } else if(e.base==='pc'){
    const pc=Number(e.part_pc);
    if(isFinite(pc)&&pc>0) f=Math.min(pc,100)/100;
  } else {
    // Le poids total peut etre laisse vide : on prend alors la somme des
    // ingredients. Un plat cuit perd de l'eau, d'ou la possibilite de corriger.
    const tt=Number(e.total_g)||tot.g;
    const part=Number(e.part_g)||0;
    if(tt>0&&part>0) f=part/tt;
  }
  const r=v=>Math.round(v*10)/10;
  return {
    total:{kcal:Math.round(tot.kcal),p:r(tot.p),c:r(tot.c),l:r(tot.l),g:Math.round(tot.g)},
    facteur:f,
    portion:{kcal:Math.round(tot.kcal*f),p:r(tot.p*f),c:r(tot.c*f),l:r(tot.l*f),
             g:Math.round(tot.g*f)}
  };
}
function prepNom(etat){
  const noms=((etat&&etat.ing)||[]).map(i=>String(i&&i.n||'').trim()).filter(Boolean);
  const t=(etat&&etat.mode)==='prep'?'Meal prep':'Recette';
  if(!noms.length) return t;
  return t+' : '+noms.slice(0,3).join(', ')+(noms.length>3?'…':'');
}
function ouvrirPrep(mode){
  _prepEtat={mode:(mode==='recette'?'recette':'prep'),
    ing:[{n:'',g:'',k:'',p:'',c:'',l:''},{n:'',g:'',k:'',p:'',c:'',l:''}],
    portions:2,total_g:'',part_g:'',part_pc:100,base:'g'};
  go('s-food-prep');
  _prepRendre();
}
function prepMode(m){ _prepEtat.mode=(m==='recette'?'recette':'prep'); _prepRendre(); }
function prepBase(b){ _prepEtat.base=(b==='pc'?'pc':'g'); _prepRendre(); }
function prepAjouterLigne(){ _prepEtat.ing.push({n:'',g:'',k:'',p:'',c:'',l:''}); _prepRendre(); }
function prepRetirerLigne(i){ _prepEtat.ing.splice(i,1); if(!_prepEtat.ing.length) prepAjouterLigne(); else _prepRendre(); }
// La saisie ne redessine PAS la liste : reecrire le balisage a chaque frappe
// ferait perdre le curseur et le clavier. Seul le resultat est repeint.
function prepChamp(i,cle,val){
  const l=_prepEtat.ing[i]; if(!l) return;
  l[cle]=val;
  _prepResultat();
}
function prepDiviseur(cle,val){ _prepEtat[cle]=val; _prepResultat(); }
function _prepResultat(){
  const z=document.getElementById('prep-resultat');
  if(!z) return;
  const r=prepCalculer(_prepEtat);
  const b=document.getElementById('prep-ajouter');
  if(b) b.disabled=!(r.portion.kcal>0);
  const ligne=(t,v,u)=>'<div style="display:flex;justify-content:space-between;gap:10px;font-size:var(--fs-sm);line-height:1.9">'
    +'<span style="color:var(--sub)">'+t+'</span><span style="font-weight:800">'+v+(u||'')+'</span></div>';
  z.innerHTML='<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:8px">Dans ton assiette</div>'
    +(r.portion.kcal>0
      ? ligne('Calories',r.portion.kcal,' kcal')+ligne('Protéines',r.portion.p,' g')
        +ligne('Glucides',r.portion.c,' g')+ligne('Lipides',r.portion.l,' g')
        +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px;'
        +'padding-top:8px;border-top:1px solid var(--border)">Préparation entière : '
        +r.total.kcal+' kcal · '+r.total.g+' g</div>'
      : '<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Renseigne au moins un ingrédient avec sa quantité et ses valeurs pour 100 g.</div>')
    +'</div>';
}
function _prepRendre(){
  const z=document.getElementById('prep-corps');
  if(!z) return;
  const _vrr=rcVerrou('dieteCalculee');
  if(_vrr){ z.innerHTML=_vrr; return; }
  const e=_prepEtat;
  const t=document.getElementById('prep-titre');
  if(t) t.textContent=PREP_MODES[e.mode];
  const ch=(v)=>escapeHtml(v==null?'':String(v));
  const onglet=(m,lib)=>'<button type="button" class="btn btn-sm" onclick="prepMode(\''+m+'\')" style="flex:1;margin:0;'
    +'border:1px solid '+(e.mode===m?'var(--red)':'var(--border)')+';background:'+(e.mode===m?'rgba(224,32,32,.16)':'transparent')
    +';color:'+(e.mode===m?'var(--red-text)':'var(--text-dim)')+'">'+lib+'</button>';
  const lignes=e.ing.map((l,i)=>
    '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px;margin-bottom:8px">'
    +'<div style="display:flex;gap:8px;margin-bottom:6px">'
      +'<input placeholder="Ingrédient" value="'+ch(l.n)+'" oninput="prepChamp('+i+',\'n\',this.value)" style="flex:1;min-width:0">'
      +'<button type="button" onclick="prepRetirerLigne('+i+')" aria-label="Retirer" style="min-width:44px;min-height:44px;'
      +'background:none;border:none;color:var(--sub);font-size:var(--fs-lg);cursor:pointer">×</button>'
    +'</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:6px">'
      +'<input type="number" inputmode="decimal" placeholder="grammes" value="'+ch(l.g)+'" oninput="prepChamp('+i+',\'g\',this.value)">'
      +'<input type="number" inputmode="decimal" placeholder="kcal/100g" value="'+ch(l.k)+'" oninput="prepChamp('+i+',\'k\',this.value)">'
      +'<input type="number" inputmode="decimal" placeholder="P/100g" value="'+ch(l.p)+'" oninput="prepChamp('+i+',\'p\',this.value)">'
      +'<input type="number" inputmode="decimal" placeholder="G/100g" value="'+ch(l.c)+'" oninput="prepChamp('+i+',\'c\',this.value)">'
      +'<input type="number" inputmode="decimal" placeholder="L/100g" value="'+ch(l.l)+'" oninput="prepChamp('+i+',\'l\',this.value)">'
    +'</div></div>').join('');
  const diviseur=e.mode==='prep'
    ? '<div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:6px">En combien de repas ?</div>'
      +'<input type="number" inputmode="numeric" min="1" value="'+ch(e.portions)+'" oninput="prepDiviseur(\'portions\',this.value)" style="width:100%">'
    : '<div style="display:flex;gap:8px;margin-bottom:8px">'
        +'<button type="button" class="btn btn-sm" onclick="prepBase(\'g\')" style="flex:1;margin:0;border:1px solid '
          +(e.base==='g'?'var(--red)':'var(--border)')+';background:transparent;color:'+(e.base==='g'?'var(--red-text)':'var(--text-dim)')+'">En grammes</button>'
        +'<button type="button" class="btn btn-sm" onclick="prepBase(\'pc\')" style="flex:1;margin:0;border:1px solid '
          +(e.base==='pc'?'var(--red)':'var(--border)')+';background:transparent;color:'+(e.base==='pc'?'var(--red-text)':'var(--text-dim)')+'">En parts</button>'
      +'</div>'
      +(e.base==='g'
        ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'
          +'<input type="number" inputmode="decimal" placeholder="poids total (g)" value="'+ch(e.total_g)+'" oninput="prepDiviseur(\'total_g\',this.value)">'
          +'<input type="number" inputmode="decimal" placeholder="ma part (g)" value="'+ch(e.part_g)+'" oninput="prepDiviseur(\'part_g\',this.value)">'
          +'</div><div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:6px">'
          +'Poids total vide : on prend la somme des ingrédients. À remplir si le plat a perdu de l\'eau à la cuisson.</div>'
        : '<div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:6px">Quelle part en as-tu mangée ?</div>'
          +'<input type="number" inputmode="decimal" min="1" max="100" placeholder="%" value="'+ch(e.part_pc)+'" oninput="prepDiviseur(\'part_pc\',this.value)" style="width:100%">');
  z.innerHTML='<div style="display:flex;gap:8px;margin-bottom:16px">'+onglet('prep','Meal prep')+onglet('recette','Recette')+'</div>'
    +lignes
    +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin-bottom:20px" onclick="prepAjouterLigne()">+ Ingrédient</button>'
    +'<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px;margin-bottom:16px">'+diviseur+'</div>'
    +'<div id="prep-resultat" style="margin-bottom:16px"></div>'
    +'<button type="button" class="btn btn-red" id="prep-ajouter" onclick="prepJournaliser()" style="width:100%" disabled>Ajouter à mon journal</button>';
  _prepResultat();
}
function prepJournaliser(){
  const r=prepCalculer(_prepEtat);
  if(!(r.portion.kcal>0)) return;
  // UNE SEULE ENTREE, avec des valeurs ABSOLUES : c'est exactement ce que le
  // journal additionne deja. Rien de neuf dans le modele de donnees.
  // LE JOUR DU JOURNAL OUVERT, comme toute autre saisie (_fjDate). _fjJour
  // n'a jamais existe : la preparation partait toujours sur aujourd'hui.
  const date=_fjDate||localISODate(new Date());
  // `nom`, comme toute entrée : `n` laissait la ligne sans nom et hors des récents.
  const e={nom:prepNom(_prepEtat),kcal:r.portion.kcal,p:r.portion.p,c:r.portion.c,l:r.portion.l};
  const ok=_fjAjouter(_fjCopier([e],date,(typeof _fjRepas!=='undefined'&&_fjRepas)||'matin'),date,prepNom(_prepEtat));
  if(ok){ toast('Ajouté à ton journal','var(--green)'); loadNutrition(); }
}
function _fjAjouter(copies,dateCible,quoi){
  if(!copies.length) return false;
  if(!currentUser.nutrition) currentUser.nutrition={};
  if(!currentUser.nutrition.log) currentUser.nutrition.log={};
  if(!currentUser.nutrition.log[dateCible]) currentUser.nutrition.log[dateCible]={entries:[]};
  currentUser.nutrition.log[dateCible].entries.push(...copies);
  _fjDernierAjout={date:dateCible,ids:copies.map(c=>c.id),quoi};
  saveUser();
  try{ _nutGeste(dateCible); }catch(e){}
  _renderFjDaySummary(dateCible);
  return true;
}
// ══ LOT N3 : LA SAISIE EN MOINS D'UNE MINUTE (29/09/2026) ══════════════════
//
// Trois raccourcis, et une mesure :
//   · LES RÉCENTS : les 12 derniers aliments DISTINCTS, avec leur quantité de
//     la dernière fois, en tête de la recherche vide. Un geste, un aliment.
//     Rangés dans le dossier (nutrition.recentsSaisie) : ils suivent
//     l'athlète d'un téléphone à l'autre. recentFoods (ids Ciqual, sans
//     quantité) reste tenu comme avant, pour ce qui le lit encore.
//   · « COMME HIER » : sur un repas vide, recopier le même repas du dernier
//     jour où il existait (7 jours en arrière au plus), quantités comprises.
//     Jamais en silence : les aliments arrivent dans le repas, visibles, et
//     l'ajout s'annule comme les autres.
//   · LES REPAS TYPE : « Enregistrer ce repas » (10 au plus, dans le dossier),
//     ajoutés ensuite en un geste.
//   · LA MESURE : combien de gestes d'ajout pour compléter une journée
//     (90 % des calories visées), en quatre tranches, compteur anonyme (rcm).
const FJ_RECENTS_MAX=12;
const FJ_REPAS_TYPES_MAX=10;
const FJ_COMME_HIER_JOURS=7;
const FJ_JOUR_COMPLET=0.9;
// Ce qu'on garde d'une entrée pour la rejouer : tout, sauf ce qui la situe.
function _fjGabarit(e){
  const g=Object.assign({},e);
  delete g.id; delete g.repas; delete g.periSeance;
  return g;
}
// PURE. La clé d'un aliment : le produit scanné, l'aliment de la table ou le
// perso par son identifiant, sinon son nom.
function cleRecent(e){
  if(!e) return '';
  if(e.alim_source==='off'&&e.ean) return 'off:'+e.ean;
  if(e.alim_id!=null&&e.alim_id!=='') return 'id:'+e.alim_id;
  return 'nom:'+String(e.nom||'').trim().toLowerCase();
}
// PURE. La liste des récents après un ajout : l'aliment en tête (avec SA
// quantité), ses doublons retirés, douze au plus, le plus ancien sort.
function majRecents(liste,entree){
  const k=cleRecent(entree);
  const l=(Array.isArray(liste)?liste:[]).filter(r=>r&&r.cle&&r.cle!==k);
  if(!k||!entree||!entree.nom) return l.slice(0,FJ_RECENTS_MAX);
  return [{cle:k,e:_fjGabarit(entree)}].concat(l).slice(0,FJ_RECENTS_MAX);
}
// PURE. Le repas à recopier : le même repas, au dernier jour où il existait,
// sept jours en arrière au plus. null quand il n'y a rien.
function sourceCommeHier(log,jour,repas){
  const L=log||{};
  for(let k=1;k<=FJ_COMME_HIER_JOURS;k++){
    const d=_jourPlus(jour,-k);
    const e=((L[d]&&L[d].entries)||[]).filter(x=>x&&(x.repas||'dejeuner')===repas);
    if(e.length) return {date:d,entries:e};
  }
  return null;
}
// PURE. Les entrées d'un repas type, prêtes à entrer dans un repas : des
// identifiants neufs à chaque fois, les quantités d'origine.
function entreesRepasType(rt,repas,ids){
  const l=(rt&&Array.isArray(rt.entries))?rt.entries:[];
  return l.map((g,i)=>Object.assign({},g,{id:ids[i],repas,periSeance:false}));
}
// PURE. La tranche de gestes d'une journée complétée.
function trancheGestes(n){
  const k=Number(n)||0;
  if(k<=3) return 'nut_jour_g1_3';
  if(k<=6) return 'nut_jour_g4_6';
  if(k<=10) return 'nut_jour_g7_10';
  return 'nut_jour_g11';
}
// LA MESURE. Un geste = un ajout (un aliment, un récent, un repas recopié ou
// type). Compté sur l'appareil, par jour ; envoyé UNE fois, anonyme, quand la
// journée atteint 90 % de ses calories. Rien d'autre ne sort.
function _nutGeste(date){
  // LOT N4 : un ajout peut faire tenir la journée. Hors du geste, pour que
  // l'ajout s'affiche d'abord.
  try{ setTimeout(()=>{ try{ majBadges(); }catch(e){} try{ _rendreSerieAssiette(currentUser); }catch(e){} },0); }catch(e){}
  try{
    const k='rc_nut_g_'+date, n=(Number(localStorage.getItem(k))||0)+1;
    localStorage.setItem(k,String(n));
    // Le ménage : seuls les trois derniers jours restent.
    for(let i=localStorage.length-1;i>=0;i--){
      const c=localStorage.key(i)||'';
      const m=c.match(/^rc_nut_g_(?:ok_)?(\d{4}-\d{2}-\d{2})$/);
      if(m&&_joursEntre(m[1],date)>3) localStorage.removeItem(c);
    }
    if(localStorage.getItem('rc_nut_g_ok_'+date)) return n;
    const u=currentUser, nut=(u&&u.nutrition)||{};
    const c=_getEffectiveMacros(nut,nutIsOnDay(date,u),date,u);
    const tot=journalTotalJour(nut.log||{},date);
    if(c&&Number(c.kcal)>0&&tot.kcal>=Number(c.kcal)*FJ_JOUR_COMPLET){
      try{ localStorage.setItem('rc_nut_g_ok_'+date,'1'); }catch(e){}
      rcm(trancheGestes(n));
    }
    return n;
  }catch(e){ return 0; }
}
// ── Les récents, sur la recherche vide ─────────────────────────────────────
function _fjRecentsSaisie(){
  const l=(currentUser&&currentUser.nutrition&&currentUser.nutrition.recentsSaisie)||[];
  return Array.isArray(l)?l.filter(r=>r&&r.cle&&r.e&&r.e.nom):[];
}
function _htmlRecentsSaisie(){
  const l=_fjRecentsSaisie();
  if(!l.length) return '';
  return l.map((r,i)=>{
    const e=r.e, q=e.unite||((e.qty!=null?e.qty:'')+' g');
    return '<button type="button" class="fj-rec" onclick="ajouterRecent('+i+')">'
      +'<span class="fj-rec-n">'+escapeHtml(e.nom)+'</span>'
      +'<span class="fj-rec-q">'+escapeHtml(String(q))+(e.kcal!=null?' · '+escapeHtml(String(e.kcal))+' kcal':'')+'</span>'
      +'<span class="fj-rec-plus" aria-hidden="true">+</span></button>';
  }).join('');
}
function ajouterRecent(i){
  const r=_fjRecentsSaisie()[i];
  if(!r) return false;
  const date=_fjDate||localISODate(new Date());
  const repas=(typeof _fjRepas!=='undefined'&&_fjRepas)?_fjRepas:'dejeuner';
  const e=Object.assign({},r.e,{repas,periSeance:false});
  const ok=_fjAjouter(_fjCopier([e],date,repas),date,escapeHtml(r.e.nom)+' ajouté');
  if(ok){
    try{ currentUser.nutrition.recentsSaisie=majRecents(currentUser.nutrition.recentsSaisie,e); saveUser(); }catch(err){ rcErreurMuette('ajouterRecent',err); }
    _fjRepasChoisi=true;
    toast(r.e.nom+' ajouté','var(--green)');
    try{ _renderFjRecent(); }catch(err){}
  }
  return ok;
}
// ── Les repas type ─────────────────────────────────────────────────────────
function _fjRepasTypes(){
  const l=(currentUser&&currentUser.nutrition&&currentUser.nutrition.repasTypes)||[];
  return Array.isArray(l)?l.filter(r=>r&&r.id&&Array.isArray(r.entries)&&r.entries.length):[];
}
function _htmlRepasTypes(){
  const l=_fjRepasTypes();
  if(!l.length) return '';
  return l.map(r=>{
    const kcal=r.entries.reduce((a,e)=>a+(Number(e.kcal)||0),0);
    return '<div class="fj-rt"><button type="button" class="fj-rec" onclick="ajouterRepasType(\''+escapeHtml(r.id)+'\')">'
      +'<span class="fj-rec-n">'+escapeHtml(r.nom)+'</span>'
      +'<span class="fj-rec-q">'+r.entries.length+' aliment'+(r.entries.length>1?'s':'')+' · '+Math.round(kcal)+' kcal</span>'
      +'<span class="fj-rec-plus" aria-hidden="true">+</span></button>'
      +'<button type="button" class="fj-rt-x" aria-label="Retirer ce repas enregistré" onclick="retirerRepasType(\''+escapeHtml(r.id)+'\')">×</button></div>';
  }).join('');
}
function ajouterRepasType(id){
  const rt=_fjRepasTypes().find(r=>r.id===id);
  if(!rt) return false;
  const date=_fjDate||localISODate(new Date());
  const repas=(typeof _fjRepas!=='undefined'&&_fjRepas)?_fjRepas:'dejeuner';
  const copies=entreesRepasType(rt,repas,_fjIdsNeufs(date,rt.entries.length));
  const ok=_fjAjouter(copies,date,escapeHtml(rt.nom)+' ajouté');
  if(ok){ _fjRepasChoisi=true; toast(rt.nom+' ajouté','var(--green)'); }
  return ok;
}
function retirerRepasType(id){
  const n=currentUser&&currentUser.nutrition; if(!n) return false;
  n.repasTypes=_fjRepasTypes().filter(r=>r.id!==id);
  saveUser(); try{ _renderFjRecent(); }catch(e){}
  return true;
}
// Le formulaire de nom, dans le repas lui-même : pas de fenêtre qui s'ouvre.
let _fjNommer=null;
function ouvrirEnregistrerRepas(date,repas){ _fjNommer={date,repas}; _renderFjDaySummary(date);
  setTimeout(()=>{ const i=document.getElementById('fj-rt-nom'); if(i) i.focus(); },50); }
function fermerEnregistrerRepas(){ const d=_fjNommer&&_fjNommer.date; _fjNommer=null; if(d) _renderFjDaySummary(d); }
function enregistrerRepasType(date,repas,nom){
  const n=String(nom||'').trim().slice(0,40);
  if(!n){ toast('Donne un nom à ce repas','var(--orange)'); return false; }
  const src=_fjEntrees(date).filter(e=>e&&(e.repas||'dejeuner')===repas);
  if(!src.length) return false;
  if(!currentUser.nutrition) currentUser.nutrition={};
  const l=_fjRepasTypes().filter(r=>r.nom.toLowerCase()!==n.toLowerCase());
  if(l.length>=FJ_REPAS_TYPES_MAX){ toast(FJ_REPAS_TYPES_MAX+' repas enregistrés au plus : retire-en un dans la recherche d’aliments.','var(--orange)'); return false; }
  l.push({id:'rt'+Date.now().toString(36),nom:n,entries:src.map(_fjGabarit)});
  currentUser.nutrition.repasTypes=l;
  _fjNommer=null;
  const ok=saveUser();
  toastEcriture(ok,'« '+n+' » enregistré','ce repas est');
  _renderFjDaySummary(date);
  return true;
}
function _htmlNommerRepas(date,repas){
  if(!_fjNommer||_fjNommer.date!==date||_fjNommer.repas!==repas) return '';
  return '<div class="fj-nommer"><input id="fj-rt-nom" maxlength="40" placeholder="Petit-déj semaine" '
    +'onkeydown="if(event.key===\'Enter\')enregistrerRepasType(\''+date+'\',\''+repas+'\',this.value)">'
    +'<button type="button" class="btn btn-red btn-sm" onclick="enregistrerRepasType(\''+date+'\',\''+repas+'\',document.getElementById(\'fj-rt-nom\').value)">Enregistrer</button>'
    +'<button type="button" class="fj-nommer-x" aria-label="Annuler" onclick="fermerEnregistrerRepas()">×</button></div>';
}
// ── « Comme hier » ─────────────────────────────────────────────────────────
function commeHier(date,repas){
  const s=sourceCommeHier(((currentUser.nutrition||{}).log)||{},date,repas);
  if(!s) return false;
  const lib=(FJ_REPAS_LIB[repas]||repas).toLowerCase();
  return _fjAjouter(_fjCopier(s.entries,date,repas),date,s.entries.length+' aliment'
    +(s.entries.length>1?'s':'')+' repris au '+lib);
}
// La ligne d'un repas VIDE : rien du tout s'il n'y a rien à recopier (pas de
// bouton mort), sinon le nom du repas et un bouton discret.
function _htmlRepasVide(date,repas,libelle){
  const s=sourceCommeHier(((currentUser.nutrition||{}).log)||{},date,repas);
  if(!s) return '';
  const hier=s.date===_jourPlus(date,-1);
  const quand=hier?'Comme hier':'Comme le '+new Date(s.date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long'});
  return '<div class="fj-vide"><span>'+escapeHtml(libelle)+'</span>'
    +'<button type="button" class="fj-comme" onclick="commeHier(\''+date+'\',\''+repas+'\')">'+escapeHtml(quand)
    +' <small>('+s.entries.length+' aliment'+(s.entries.length>1?'s':'')+')</small></button></div>';
}


// ══════════════ ÉQUIVALENCES À MACRO CONSTANTE ════════════════════════════
// Pour un aliment journalisé, trois à cinq substituts DU MÊME GROUPE dont la
// quantité égalise le macronutriment dominant du groupe. Rien n'est jamais
// substitué tout seul : l'athlète choisit, et il peut annuler.
//
// LA TABLE VIENT DES DONNÉES, pas d'une intuition. Part médiane des kcal
// calculée sur les 3 484 aliments Ciqual, groupe par groupe. Deux écarts
// assumés, et ils sont dits :
//
//   • PRODUITS LAITIERS : la médiane donne les LIPIDES à 57 %, tirée vers le
//     haut par les fromages et les crèmes. Mais quelqu'un qui remplace un
//     yaourt cherche à égaliser ses PROTÉINES. On choisit l'usage contre le
//     chiffre, et on l'écrit ici pour que personne ne le "corrige" plus tard.
//   • ENTRÉES ET PLATS COMPOSÉS (42 % lipides, 37 % glucides) et AIDES
//     CULINAIRES (34 contre 31) n'ont AUCUNE macro dominante réelle.
//     Substituer une pizza par un couscous « à lipides égaux » ne veut rien
//     dire : ces deux groupes n'ont pas d'équivalence.
const EQ_DOMINANT=Object.freeze({
  'viandes, oeufs, poissons':'p',
  'produits laitiers':'p',                       // usage contre médiane, cf. ci-dessus
  'fruits, légumes, légumineuses et oléagineux':'c',
  'produits céréaliers':'c',
  'produits sucrés':'c',
  'glaces et sorbets':'c',
  'eaux et autres boissons':'c',
  'aliments infantiles':'c',
  'matières grasses':'l'
  // 'entrées et plats composés' et 'aides culinaires et ingrédients divers'
  // sont ABSENTS volontairement : aucune macro dominante.
});
const EQ_MIN=3, EQ_MAX=5;
// Plafonds de vraisemblance, par groupe. Au-delà, on plafonne ET on le DIT :
// « 1 200 g de courgettes » est une réponse mathématiquement juste et
// pratiquement absurde, et l'afficher sans commentaire décrédibilise tout
// l'écran.
const EQ_PLAFOND=Object.freeze({
  'fruits, légumes, légumineuses et oléagineux':400,
  'eaux et autres boissons':1000,
  'matières grasses':100,
  'produits laitiers':500,
  'viandes, oeufs, poissons':400,
  'produits céréaliers':400,
  'produits sucrés':300,
  'glaces et sorbets':300,
  'aliments infantiles':400
});
const EQ_PLAFOND_DEFAUT=500;
// ⚠ RENOMMEE ET REECRITE. Elle disait « cette liste n'est PAS filtrée par
// allergène ni par régime : RepCore ne les enregistre pas encore ». Ce lot les
// enregistre et filtre bel et bien : la garder mot pour mot en aurait fait la
// seule phrase fausse du module, et une reserve fausse est pire qu'une reserve
// absente — elle fait douter de celles qui sont vraies.
//
// CE QU'ELLE DIT MAINTENANT est la limite REELLE : la table Ciqual ne porte
// aucune liste d'allergenes, seulement des noms et des groupes. Un plat
// cuisine, un ingredient compose ou une trace passent donc au travers du
// filtre le mieux declare.
const EQ_RESERVE_ALLERGENE='Cette liste tient compte des évictions que tu as '
  +'déclarées, et de rien d\'autre : la table Ciqual ne porte pas de liste '
  +'d\'allergènes, seulement des noms et des groupes. Un plat cuisiné ou un '
  +'ingrédient composé peut passer au travers. Vérifie toi-même que ce que tu '
  +'choisis te convient.';

// PURE. Le macronutriment d'égalisation d'un GROUPE — jamais d'un aliment.
// Rend 'p', 'c', 'l', ou null quand le groupe n'a pas d'équivalence.
function macroDominant(groupe){
  const g=String(groupe==null?'':groupe).toLowerCase().trim();
  if(!g) return null;
  for(const k in EQ_DOMINANT) if(k.toLowerCase()===g) return EQ_DOMINANT[k];
  return null;
}
// PURE. Le plafond de vraisemblance du groupe.
function plafondEquivalence(groupe){
  const g=String(groupe==null?'':groupe).toLowerCase().trim();
  for(const k in EQ_PLAFOND) if(k.toLowerCase()===g) return EQ_PLAFOND[k];
  return EQ_PLAFOND_DEFAUT;
}
// PURE. Les substituts. Rend un tableau, vide si le groupe n'a pas de macro
// dominante, si l'aliment n'en porte pas, ou si la table n'est pas chargée.
//
// L'ÉCART RÉSIDUEL EST TOUJOURS CALCULÉ ET TOUJOURS RENDU, y compris nul : le
// masquer laisserait croire à une équivalence parfaite, qui n'existe pas.
function equivalents(aliment,qty,n,base){
  const src=Array.isArray(base)?base:(typeof _ciqualDB!=='undefined'?_ciqualDB:null);
  if(!Array.isArray(src)||!aliment) return [];
  const dom=macroDominant(aliment.g);
  if(!dom) return [];
  const q=parseFloat(qty);
  if(!isFinite(q)||q<=0) return [];
  const valDom=parseFloat(aliment[dom]);
  if(!isFinite(valDom)||valDom<=0) return [];
  // La quantité de macro dominante à égaliser, en grammes.
  const cible=valDom*q/100;
  const plafond=plafondEquivalence(aliment.g);
  const gLower=String(aliment.g).toLowerCase().trim();
  const refP=(parseFloat(aliment.p)||0)*q/100;
  const refC=(parseFloat(aliment.c)||0)*q/100;
  const refL=(parseFloat(aliment.l)||0)*q/100;
  const out=[];
  for(const a of src){
    if(!a||a.id===aliment.id) continue;
    if(String(a.g||'').toLowerCase().trim()!==gLower) continue;
    const v=parseFloat(a[dom]);
    if(!isFinite(v)||v<=0) continue;
    let qEq=cible*100/v;
    if(!isFinite(qEq)||qEq<=0) continue;
    // Sous un gramme, la ligne n'a aucun sens pratique.
    if(qEq<1) continue;
    let plafonne=false;
    if(qEq>plafond){ qEq=plafond; plafonne=true; }
    qEq=Math.round(qEq);
    const p=(parseFloat(a.p)||0)*qEq/100;
    const c=(parseFloat(a.c)||0)*qEq/100;
    const l=(parseFloat(a.l)||0)*qEq/100;
    const r1=x=>Math.round(x*10)/10;
    out.push({alim:a,qtyEq:qEq,plafonne,
      ecartP:r1(p-refP),ecartC:r1(c-refC),ecartL:r1(l-refL),
      // Le classement se fait sur l'écart des DEUX AUTRES macros, en kcal :
      // c'est ce que l'athlète subit réellement en acceptant le substitut.
      _cout:Math.abs((dom==='p'?0:(p-refP)*4))
           +Math.abs((dom==='c'?0:(c-refC)*4))
           +Math.abs((dom==='l'?0:(l-refL)*9))
           +(plafonne?10000:0)});
  }
  out.sort((a,b)=>a._cout-b._cout);
  const max=(n>0?n:EQ_MAX);
  return out.slice(0,Math.min(max,EQ_MAX)).map(x=>{ delete x._cout; return x; });
}
// PURE. L'écran est-il en registre STRICTEMENT DESCRIPTIF ? Le produit n'a pas
// de `tcaRisque` : il a aTCA, qui coupe déjà onze chemins ailleurs. On s'y
// adosse plutôt que d'inventer un second drapeau.
function equivalenceDescriptive(user){
  try{ return !!aTCA(user); }catch(e){ return false; }
}

// PURE. Construit une entrée de journal depuis un aliment Ciqual et une
// quantité. MIROIR EXACT de saveFoodEntry, qui ne peut pas être appelée ici
// (elle lit le DOM). Une assertion compare les deux sorties sur la même
// entrée : c'est ce qui empêche les deux chemins de diverger.
function _eqConstruireEntree(f,qty,repas,id){
  const r=qty/100;
  const _k=kcalPortion(f,r);
  const e={
    id:id||Date.now(),alim_id:f.id,nom:f.n,groupe:f.g||'',qty,repas:repas||'dejeuner',
    kcal:_k.kcal,
    p:f.p!=null?parseFloat((f.p*r).toFixed(1)):null,
    c:f.c!=null?parseFloat((f.c*r).toFixed(1)):null,
    l:f.l!=null?parseFloat((f.l*r).toFixed(1)):null,
    fi:f.f!=null?parseFloat((f.f*r).toFixed(1)):null,
    sel:f.e!=null?parseFloat((f.e*r).toFixed(2)):null,
    periSeance:false
  };
  if(_k.estimee) e.kcalEstimee=true;
  _poserMicros(e,f,r);
  return e;
}
// ── L'écran ───────────────────────────────────────────────────────────────
let _eqCtx=null;   // {date, entryId} — en mémoire, jamais persisté
function ouvrirEquivalents(date,entryId){
  const es=_fjEntrees(date);
  const e=es.find(x=>x&&String(x.id)===String(entryId));
  if(!e) return false;
  _eqCtx={date,entryId:String(entryId)};
  const z=document.getElementById('fj-equiv');
  if(!z) return false;
  z.innerHTML=_htmlEquivalents(e);
  z.scrollIntoView({block:'nearest'});
  return true;
}
function fermerEquivalents(){
  _eqCtx=null;
  const z=document.getElementById('fj-equiv');
  if(z) z.innerHTML='';
  return true;
}
// LES RELEGUES, EN FIN DE LISTE ET AVEC LEUR RAISON.
//
// ⚠ SEULES LES INTOLERANCES ARRIVENT ICI. Une allergie n'est pas releguee,
// elle est retiree ; un choix n'est ni l'un ni l'autre — il a disparu plus
// haut, sans un mot, et rien dans ce rendu ne doit pouvoir le trahir.
function _htmlRelegues(l){
  const r=_tabBloc(l);
  if(!r.length) return '';
  return _fjTitreSection('À adapter')
    +r.map(x=>{
      const f=x.aliment, e=x.eviction;
      // Le rendu ordinaire, suivi de la raison : c'est le meme aliment, et il
      // reste saisissable de la meme facon.
      let h='';
      try{ h=(f&&f._perso)?_htmlPersoResult(f):_fjResultHtml(f); }catch(err){ h=''; }
      return h+'<div style="font-size:var(--fs-2xs);color:var(--orange);'
        +'line-height:1.5;padding:0 14px 10px;margin-top:-6px">'
        +escapeHtml(evictionMention(e))+'</div>';
    }).join('');
}
// Le rappel pose en tete de la recherche du plan : le coach doit savoir ce
// qu'il ne peut pas proposer AVANT de chercher, pas au moment ou une ligne
// devient orange.
function _htmlEvictionsRappelPlan(c){
  let l=[];
  try{ l=evictions(c); }catch(e){ l=[]; }
  // ⚠ « CHOIX » N'APPARAIT PAS DANS CE RAPPEL. Le coach voit la liste complete
  // sur la fiche client, ou elle a un sens ; la faire remonter au-dessus d'un
  // champ de recherche reviendrait a la commenter a chaque frappe.
  const dits=l.filter(e=>e.niveau!=='choix');
  if(!dits.length) return '';
  return '<div style="background:var(--warning-bg);border-bottom:1px solid var(--warning-border);'
    +'padding:10px 16px;font-size:var(--fs-2xs);color:var(--text);line-height:1.55">'
    +escapeHtml('Évictions déclarées : '+dits.map(e=>e.libelle).join(', ')+'.')
    +'</div>';
}
function _htmlEquivalents(e){
  const alim=(typeof _ciqualDB!=='undefined'&&Array.isArray(_ciqualDB))
    ?_ciqualDB.find(a=>a&&a.id===e.alim_id):null;
  const descriptif=equivalenceDescriptive(currentUser);
  const entete=`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;color:var(--sub);text-transform:uppercase">Équivalences</span>
      <button onclick="fermerEquivalents()" aria-label="Fermer" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;min-width:44px;min-height:32px">×</button>
    </div>`;
  const cadre=(corps)=>`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-top:10px">${entete}${corps}</div>`;
  // RÈGLE 8 : produit OFF ou groupe vide ⇒ aucune équivalence, et on dit
  // pourquoi plutôt que de rendre une liste vide muette.
  if(!alim||!alim.g)
    return cadre(`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucune équivalence pour cet aliment : ${escapeHtml(e.alim_source==='off'?'les produits de marque n\'ont pas de groupe Ciqual.':'il n\'appartient à aucun groupe alimentaire.')}</div>`);
  const dom=macroDominant(alim.g);
  if(!dom)
    return cadre(`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Le groupe « ${escapeHtml(alim.g)} » n'a pas de macronutriment dominant : ses aliments sont trop différents les uns des autres pour qu'une équivalence veuille dire quelque chose.</div>`);
  // ⚠ CHEMIN 4, ET C'EST LA PIRE DES SIX FUITES POSSIBLES. Une equivalence
  // est une PROPOSITION DE L'APP : suggerer des crevettes a quelqu'un
  // d'allergique aux crustaces n'est pas un filtre oublie, c'est l'application
  // qui choisit a sa place.
  //
  // ⚠ ON DEMANDE PLUS LARGE, PUIS ON FILTRE, PUIS ON COUPE. Filtrer apres
  // avoir coupe a EQ_MAX rendrait une liste courte la ou il existe une liste
  // complete d'aliments permis — et l'athlete conclurait « pas de substitut ».
  // `equivalents` plafonne lui-meme a EQ_MAX ; on lui passe donc une base
  // deja filtree plutot que de lui demander davantage.
  const _base=(typeof _ciqualDB!=='undefined'&&Array.isArray(_ciqualDB))?_ciqualDB:[];
  const _permis=[], _relegBase=[];
  for(const a of _base){
    const ev=(function(){ try{ return evictionDe(currentUser,a); }catch(err){ return null; } })();
    if(!ev){ _permis.push(a); continue; }
    // L'intolerance reste proposee, a part : beaucoup de gens en tolerent une
    // petite quantite, et un filtrage dur les priverait d'un aliment qu'ils
    // utilisent volontairement.
    if(ev.niveau==='intolerance') _relegBase.push(a);
    // allergie et choix : ni dans l'une ni dans l'autre liste.
  }
  const l=equivalents(alim,e.qty,EQ_MAX,_permis);
  const _eqReleg=_relegBase.length?equivalents(alim,e.qty,EQ_MAX,_relegBase):[];
  if(!l.length&&!_eqReleg.length)
    return cadre(`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucun substitut exploitable dans ce groupe.</div>`);
  const libDom={p:'protéines',c:'glucides',l:'lipides'}[dom];
  const sgn=v=>(v>0?'+':'')+String(v).replace('.',',');
  const ecart=(x)=>{
    // RÈGLE 3 : les DEUX autres macros sont toujours montrées, y compris à
    // zéro. « 0 » est une information ; l'absence n'en est pas une.
    const t=[];
    if(dom!=='p') t.push('P '+sgn(x.ecartP)+' g');
    if(dom!=='c') t.push('G '+sgn(x.ecartC)+' g');
    if(dom!=='l') t.push('L '+sgn(x.ecartL)+' g');
    return t.join(' · ');
  };
  return cadre(`
    <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:10px">${escapeHtml(descriptif?'À '+libDom+' égales, dans le même groupe.':'Même quantité de '+libDom+', dans le même groupe. À toi de voir.')}</div>
    ${l.map(x=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.alim.n)}</div>
        <div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:2px">${x.qtyEq} g${x.plafonne?' <span style="color:var(--orange)">· plafonné</span>':''} &nbsp;·&nbsp; <span style="color:var(--text-dim)">${escapeHtml(ecart(x))}</span></div>
        ${x.plafonne?`<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.5;margin-top:2px">Quantité plafonnée à ${plafondEquivalence(alim.g)} g : l'équivalence exacte demanderait davantage, ce qui ne se mange pas.</div>`:''}
      </div>
      <button onclick="appliquerEquivalence('${escapeHtml(x.alim.id)}',${x.qtyEq})"
        class="btn btn-outline btn-sm" style="flex-shrink:0;margin:0;min-height:36px;padding:6px 12px;font-size:var(--fs-2xs)">Remplacer</button>
    </div>`).join('')}
    ${_eqReleg.length?`<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.2px;color:var(--sub);text-transform:uppercase;margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">À adapter</div>
    ${_eqReleg.map(x=>{
      const _ev=(function(){ try{ return evictionDe(currentUser,x.alim); }catch(err){ return null; } })();
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.alim.n)}</div>
        <div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:2px">${x.qtyEq} g &nbsp;·&nbsp; <span style="color:var(--text-dim)">${escapeHtml(ecart(x))}</span></div>
        <div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.5;margin-top:2px">${escapeHtml(evictionMention(_ev))}</div>
      </div>
      <button onclick="appliquerEquivalence('${escapeHtml(x.alim.id)}',${x.qtyEq})"
        class="btn btn-outline btn-sm" style="flex-shrink:0;margin:0;min-height:36px;padding:6px 12px;font-size:var(--fs-2xs)">Remplacer</button>
    </div>`;}).join('')}`:''}
    <div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.55;margin-top:10px">${escapeHtml(EQ_RESERVE_ALLERGENE)}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:4px">Rien n'est remplacé tant que tu n'as pas appuyé. L'écart sur les autres macros est affiché tel quel, jamais arrondi à zéro.</div>`);
}
// RÈGLE 4 : la substitution ne se fait QUE sur ce bouton. Elle passe par
// _fjDernierAjout — le mécanisme existant — étendu à la restitution, parce
// qu'un remplacement retire une entrée en plus d'en ajouter une, et qu'une
// annulation qui ne rendrait pas l'originale serait pire que pas d'annulation.
function appliquerEquivalence(alimId,qtyEq){
  if(!_eqCtx) return false;
  const {date,entryId}=_eqCtx;
  const log=(currentUser.nutrition||{}).log||{};
  const j=log[date];
  if(!j||!Array.isArray(j.entries)) return false;
  const i=j.entries.findIndex(x=>x&&String(x.id)===String(entryId));
  if(i<0) return false;
  const ancienne=j.entries[i];
  const alim=Array.isArray(_ciqualDB)?_ciqualDB.find(a=>a&&String(a.id)===String(alimId)):null;
  if(!alim) return false;
  const neuve=_eqConstruireEntree(alim,Number(qtyEq),ancienne.repas,Date.now());
  // Le marqueur péri-séance de l'athlète survit au remplacement : c'est SA
  // note, elle ne parle pas de l'aliment.
  neuve.periSeance=!!ancienne.periSeance;
  j.entries.splice(i,1,neuve);
  _fjDernierAjout={date,ids:[neuve.id],quoi:escapeHtml(ancienne.nom)+' remplacé par '+escapeHtml(alim.n),
    retirees:[{index:i,entree:ancienne}]};
  saveUser();
  fermerEquivalents();
  _renderFjDaySummary(date);
  return true;
}
function refaireRepas(dateSource,repas){
  // La cible est AUJOURD'HUI : refaire un repas d'un jour passé dans ce jour
  // passé n'aurait aucun sens.
  const cible=localISODate(new Date());
  const src=_fjEntrees(dateSource).filter(e=>(e.repas||'dejeuner')===repas);
  if(!src.length){ toast('Rien à recopier dans ce repas','var(--orange)'); return false; }
  const lib=(FJ_REPAS_LIB[repas]||repas).toLowerCase();
  return _fjAjouter(_fjCopier(src,cible,repas),cible,src.length+' aliment'
    +(src.length>1?'s':'')+' ajouté'+(src.length>1?'s':'')+' au '+lib);
}
function copierHier(){
  const cible=localISODate(new Date());
  const veille=localISODate(new Date(Date.now()-864e5));
  const src=_fjEntrees(veille);
  if(!src.length){ toast('Rien d\'enregistré hier : rien à copier','var(--orange)'); return false; }
  return _fjAjouter(_fjCopier(src,cible,null),cible,src.length+' aliment'
    +(src.length>1?'s':'')+' repris d\'hier');
}
function annulerDernierAjout(){
  const a=_fjDernierAjout;
  if(!a) return false;
  const log=(currentUser.nutrition||{}).log||{};
  const j=log[a.date];
  if(!j||!Array.isArray(j.entries)){ _fjDernierAjout=null; return false; }
  // On retire EXACTEMENT les identifiants ajoutés, rien d'autre : une entrée
  // saisie à la main entre-temps ne doit pas partir avec.
  const aRetirer=new Set(a.ids.map(String));
  j.entries=j.entries.filter(e=>!aRetirer.has(String(e&&e.id)));
  // RESTITUTION. Un AJOUT n a rien a rendre et ce bloc ne s execute pas :
  // le chemin d avant est conserve a l octet pres. Un REMPLACEMENT, lui,
  // a retire une entree en plus d en ajouter une — sans la rendre,
  // « annuler » ferait perdre l originale, ce qui est pire que de ne rien
  // proposer. On la remet A SA PLACE, pas a la fin.
  if(Array.isArray(a.retirees)){
    for(const r of a.retirees.slice().sort((x,y)=>x.index-y.index)){
      if(!r||!r.entree) continue;
      const i=Math.max(0,Math.min(j.entries.length,Number(r.index)||0));
      j.entries.splice(i,0,r.entree);
    }
  }
  if(!j.entries.length) delete log[a.date];
  _fjDernierAjout=null;
  saveUser();
  _renderFjDaySummary(a.date);
  toast('Ajout annulé');
  return true;
}
// ══ LOT N6 : LA RÉPARTITION DES PROTÉINES DANS LA JOURNÉE (29/09/2026) ═══
// Ce qui a VRAIMENT été mangé, repas par repas : une LECTURE, pas une consigne.
//
// ⚠ AUCUNE CIBLE PAR REPAS N'EST CRÉÉE. repartitionPrises (plus haut) partage
//   la CIBLE en parts égales, et Kevin en a retiré l'affichage le 08/09/2026 :
//   ce module-ci ne la rappelle pas. On montre, on explique une fois, on laisse
//   faire.
// ⚠ JAMAIS D'ALERTE, JAMAIS DE ROUGE, JAMAIS TOUS LES JOURS : les barres sont
//   neutres (pleines ou en creux), et la phrase ne revient qu'une fois par
//   semaine au plus (rc_prot_phrase, sur l'appareil : un confort de lecture,
//   pas une donnée du dossier).
// Le seuil de 0,4 g/kg par prise est le repère qui sature la synthèse
// musculaire ; sans poids connu, il n'y a ni seuil, ni phrase.
const PROT_PRISE_G_KG=0.4;
const PROT_CONCENTRE_PART=0.55;
const PROT_PHRASE_JOURS=7;
const PROT_REPAS_ORDRE=Object.freeze(['matin','dejeuner','diner','collation','coucher']);
// « au dîner », « en collation » : la préposition de chaque repas.
const PROT_REPAS_A=Object.freeze({matin:'au petit-déjeuner',dejeuner:'au midi',diner:'au dîner',
  collation:'en collation',coucher:'avant de te coucher'});
/**
 * PURE. La répartition des protéines d'une journée.
 * @param entrees  les entrées du journal du jour ({repas, p, …})
 * @param poidsKg  le poids de référence, ou rien
 * @returns {{total:number, seuil:?number, repas:[{repas,g,part,prise}], concentre:boolean, dominant:?string}}
 * « repas » suit l'ordre de la journée et ne garde que les repas qui ont reçu
 * des protéines. « concentre » : un repas porte plus de 55 % du total, sur une
 * journée d'au moins deux repas (un seul repas saisi, c'est souvent un
 * journal en cours, on ne commente pas), et seulement avec un poids connu.
 */
function repartitionProt(entrees,poidsKg){
  const kg=Number(poidsKg);
  const seuil=(kg>=30&&kg<=300)?Math.round(PROT_PRISE_G_KG*kg*10)/10:null;
  const par={};
  for(const e of (Array.isArray(entrees)?entrees:[])){
    const p=Number(e&&e.p);
    if(!(p>0)) continue;
    const r=(e&&PROT_REPAS_ORDRE.indexOf(e.repas)>=0)?e.repas:'collation';
    par[r]=(par[r]||0)+p;
  }
  const total=Math.round(Object.keys(par).reduce((a,k)=>a+par[k],0)*10)/10;
  const repas=PROT_REPAS_ORDRE.filter(r=>par[r]>0).map(r=>{
    const g=Math.round(par[r]*10)/10;
    return {repas:r,g,part:total>0?Math.round(g/total*1000)/1000:0,prise:seuil!=null&&g>=seuil};
  });
  let dominant=null;
  for(const x of repas) if(!dominant||x.g>dominant.g) dominant=x;
  const concentre=!!(seuil!=null&&repas.length>=2&&dominant&&dominant.part>PROT_CONCENTRE_PART);
  return {total,seuil,repas,concentre,dominant:concentre?dominant.repas:null};
}
// PURE. La phrase, quand la journée est concentrée. Elle nomme le repas qui
// porte tout, et celui des trois principaux qui en porte le moins.
function phraseRepartitionProt(r){
  if(!r||!r.concentre||!r.dominant) return '';
  const d=r.repas.find(x=>x.repas===r.dominant);
  const qui=(d&&d.part>=0.7)?'L’essentiel de tes protéines tombe ':'Plus de la moitié de tes protéines tombent ';
  const g=r2=>{ const x=r.repas.find(y=>y.repas===r2); return x?x.g:0; };
  const vers=['matin','dejeuner','diner'].filter(x=>x!==r.dominant).sort((a,b)=>g(a)-g(b)||(a==='dejeuner'?-1:b==='dejeuner'?1:0))[0];
  return qui+PROT_REPAS_A[r.dominant]+'. En étaler une partie '+PROT_REPAS_A[vers]
    +' te ferait mieux profiter de chaque prise.';
}
// PURE. La phrase se montre-t-elle ce jour-là ? Jamais vue, déjà montrée ce
// même jour (un nouveau rendu ne la retire pas), ou vue il y a 7 jours au moins.
function phraseProtAMontrer(dernierVu,jour){
  if(!dernierVu||!/^\d{4}-\d{2}-\d{2}$/.test(String(dernierVu))) return true;
  if(dernierVu===jour) return true;
  return _joursEntre(dernierVu,jour)>=PROT_PHRASE_JOURS;
}
// La phrase, une fois par semaine au plus : la date où elle a été montrée
// reste sur l'appareil.
function _phraseProtSemaine(r,jour){
  const ph=phraseRepartitionProt(r);
  if(!ph) return '';
  let vu=null; try{ vu=localStorage.getItem('rc_prot_phrase'); }catch(e){ vu=null; }
  if(!phraseProtAMontrer(vu,jour)) return '';
  try{ localStorage.setItem('rc_prot_phrase',jour); }catch(e){}
  return ph;
}
// Sous les anneaux : une barre par repas, à l'échelle, pleine quand la prise
// atteint le seuil, en creux sinon. Neutre, jamais rouge.
function htmlRepartitionProt(u,entrees,jour){
  let kg=null; try{ kg=poidsReference(u); }catch(e){ kg=null; }
  const r=repartitionProt(entrees,kg);
  if(!r.repas.length) return '';
  const max=Math.max(r.seuil||0,...r.repas.map(x=>x.g));
  const pc=v=>Math.max(2,Math.round(v/max*1000)/10);
  const lib={matin:'Petit-déj.',dejeuner:'Déjeuner',diner:'Dîner',collation:'Collation',coucher:'Coucher'};
  // La phrase ne parle que du jour en cours : relire une journée passée ne
  // consomme pas le rendez-vous de la semaine.
  const ph=(jour===localISODate(new Date()))?_phraseProtSemaine(r,jour):'';
  // « Répartition des protéines » et non « … par repas » : les REPÈRES par
  // repas (une consigne) ont été retirés de cette carte par Kevin le
  // 24/08/2026, et un test y veille. Ceci est une lecture, pas un repère.
  return '<div class="rp-bloc"><div class="nut-cap">Répartition des protéines</div>'
    +'<div class="rp-barres">'+r.repas.map(x=>'<div class="rp-l"><span class="rp-n">'+escapeHtml(lib[x.repas])+'</span>'
      +'<span class="rp-piste">'+(r.seuil!=null?'<i class="rp-seuil" style="left:'+pc(r.seuil)+'%"></i>':'')
      +'<b class="rp-b'+(x.prise?' rp-plein':'')+'" style="width:'+pc(x.g)+'%"></b></span>'
      +'<span class="rp-g">'+escapeHtml(String(Math.round(x.g)))+' g</span></div>').join('')+'</div>'
    +(r.seuil!=null?'<div class="rp-leg">Plein : une prise d’au moins '+escapeHtml(String(Math.round(r.seuil)))+' g'+nr(' (0,4 g par kilo)','')+', le repère qui profite le mieux au muscle.</div>':'')
    +(ph?'<div class="rp-phrase">'+escapeHtml(ph)+'</div>':'')
    +'</div>';
}
const FJ_REPAS_LIB=Object.freeze({matin:'Petit-déjeuner',dejeuner:'Déjeuner',
  diner:'Dîner',collation:'Collation',coucher:'Avant de se coucher'});
function _htmlDernierAjout(date){
  const a=_fjDernierAjout;
  if(!a||a.date!==date) return '';
  return `<div style="background:var(--success-bg);border:1px solid var(--success-border);border-radius:var(--r-3);padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
    <div style="flex:1;min-width:0;font-size:var(--fs-sm);color:var(--success);line-height:1.5">${escapeHtml(a.quoi)}</div>
    <button onclick="annulerDernierAjout()" style="flex-shrink:0;background:none;border:1px solid var(--success-border);color:var(--success);border-radius:var(--r-2);padding:6px 12px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;cursor:pointer">Annuler</button>
  </div>`;
}
function openFoodSearch(date){
  _fjDate=date||localISODate(new Date());
  // R27 — UNE NOUVELLE SESSION DE SAISIE : le repas se rededuit de l'heure, et
  // le bandeau de la session precedente ne parle plus de rien.
  _fjRepasChoisi=false;
  _fjSaisieAjout=null;
  go('s-food-search');
  _renderFjBandeau();
  const inp=document.getElementById('fj-search-input');
  if(inp){inp.value='';setTimeout(()=>inp.focus(),350);}
  // Re-rendue a chaque ouverture : le reseau a pu tomber depuis la derniere.
  _renderFjActions();
  // Les aliments du coach, au plus une fois par heure. Rien ne bloque :
  // la recherche Ciqual fonctionne pendant ce temps.
  try{ _rafraichirAlimentsCoach(); }catch(e){}
  // LOT R1 : les recettes, au plus une fois par heure ; le cache répond hors ligne.
  try{ recettesSynchroniser().then(ok=>{ if(!ok) return; const i=document.getElementById('fj-search-input'); if(i&&i.value) onFjSearch(i.value); else _renderFjRecent(); }).catch(()=>{}); }catch(e){}
  document.getElementById('fj-results-list').innerHTML='';
  if(!_ciqualDB){
    _loadCiqual().then(()=>{_renderFjRecent();});
  } else {
    _renderFjRecent();
  }
}

// Les deux voies pour un aliment absent de la table. Elles se rendent a
// l OUVERTURE de l ecran, pas dans les resultats : c est justement quand on
// ne trouve rien qu on en a besoin, et chercher pour faire apparaitre le
// bouton qui permet de ne pas chercher est un cercle.
function _renderFjActions(){
  const el=document.getElementById('fj-actions');
  if(!el) return;
  // MESURE, pas estimation (clone a largeur imposee, Montserrat chargee, dans
  // Chrome). La classe .btn met les libelles EN MAJUSCULES, ce qui les elargit
  // d environ 12 % : « + CRÉER UN ALIMENT / SCANNER UN PRODUIT » passait sur
  // deux lignes a 320 px (hauteur 50 px au lieu de 36). « + Nouvel aliment /
  // Scanner » tient sur une ligne des 320 px, et respire a 375.
  const st='flex:1;padding:10px 8px;font-size:var(--fs-xs);letter-spacing:.3px';
  // Hors ligne le scan disparait — la fiche produit se lit chez Open Food
  // Facts, et sans reseau il mene a un mur. La creation manuelle, elle,
  // fonctionne entierement hors ligne : rien de ce qu elle fait ne sort.
  const scan=(typeof navigator!=='undefined'&&navigator.onLine===false)?''
    :'<button type="button" class="btn btn-outline btn-sm" style="'+st+'" onclick="ouvrirScan()">Scanner</button>';
  // DEUX ENTREES DE PLUS, sur une seconde ligne : quatre boutons cote a cote
  // ne tiendraient pas a 320 px, et ces deux-la repondent a une autre question
  // que « quel aliment » — « combien dans mon assiette ».
  el.innerHTML='<div style="display:flex;gap:8px;margin-bottom:8px">'
    +'<button type="button" class="btn btn-outline btn-sm" style="'+st+'" onclick="ouvrirAlimentPerso()">+ Nouvel aliment</button>'+scan+'</div>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" class="btn btn-outline btn-sm" style="'+st+'" onclick="ouvrirPrep(\'prep\')">Meal prep</button>'
    // LOT R1 : « Recettes » ouvre la bibliothèque. Le calcul d'une part d'un
    // tout reste dans l'onglet « Recette » de l'écran Meal prep.
    +'<button type="button" class="btn btn-outline btn-sm" style="'+st+'" onclick="ouvrirRecettes()">Recettes</button></div>'
    // LA PHOTO DU REPAS : seulement en ligne, et seulement si l'offre l'ouvre.
    +((typeof navigator!=='undefined'&&navigator.onLine===false)||!repasPhotoOuvert(currentUser)?''
      :'<button type="button" class="btn btn-outline btn-sm" id="fj-photo-repas" style="'+st+';width:100%;margin-top:8px" onclick="ouvrirPhotoRepas()">Photo du repas</button>');
}
function _renderFjRecent(){
  const el=document.getElementById('fj-recent-section');
  if(!el||!_ciqualDB) return;
  const ids=currentUser.nutrition?.recentFoods||[];
  // Les favoris passent DEVANT les récents, et recentFoods n'est pas touché :
  // il se remplit et s'affiche exactement comme avant.
  const favIds=_fjFavs();
  const favs=favIds.map(id=>_ciqualDB.find(f=>f.id===id)).filter(Boolean);
  const titre=t=>'<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;padding:14px 16px 6px">'+t+'</div>';
  const sep='<div style="height:1px;background:var(--surface-1);margin:6px 0"></div>';
  const blocFav=favs.length
    ?titre('Favoris')+favs.map(f=>_fjResultHtml(f,true)).join('')+sep
    :'';
  // Les cinq derniers aliments perso crees, en tete : ce sont ceux qu on
  // reprend le plus souvent, et la seule liste ou on les retrouve sans les
  // nommer. Les plus recents en premier.
  const perso=_alimsPerso().slice(-5).reverse();
  // FREQUENTS : trois usages suffisent a dire qu un aliment est habituel.
  // On EXCLUT ceux qui sont deja en favoris ou en recents : les repeter trois
  // fois sur le meme ecran ne renseigne personne.
  const _uf=(currentUser.nutrition&&currentUser.nutrition.usageFoods)||{};
  const dejaVu=new Set(favIds.concat(ids).map(String));
  const freqIds=Object.keys(_uf)
    .filter(k=>(_uf[k]&&_uf[k].n>=FJ_FREQUENT_MIN)&&!dejaVu.has(k))
    .sort((x,y)=>((_uf[y].n||0)-(_uf[x].n||0))||((_uf[y].t||0)-(_uf[x].t||0)))
    .slice(0,5);
  const freqs=freqIds.map(k=>_ciqualDB.find(f=>String(f.id)===k)).filter(Boolean);
  const blocFreq=freqs.length
    ?titre('Fréquents')+freqs.map(f=>_fjResultHtml(f,true)).join('')+sep
    :'';
  const blocPerso=perso.length
    ?titre('Mes aliments')+perso.map(a=>_htmlPersoResult(a)).join('')+sep
    :'';
  // LOT N3 : EN TETE, les repas enregistres puis les recents a un geste (avec
  // la quantite de la derniere fois). Tant qu'ils sont la, l'ancienne liste de
  // recents (sans quantite) ne se repete pas en dessous.
  const _rt=_htmlRepasTypes(), _recS=_htmlRecentsSaisie();
  // LOT R1 : les recettes de son plan, en un geste, avant tout le reste.
  const _rcP=_recLignesPlan().length?_htmlRecettesSaisie():'';
  const blocNeuf=(_rcP?titre('Recettes du plan')+_rcP+sep:'')+(_rt?titre('Mes repas')+_rt+sep:'')+(_recS?titre('Récents')+_recS+sep:'');
  if(!ids.length){
    el.innerHTML=blocNeuf+blocPerso+blocFav+blocFreq+(blocNeuf?'':'<div style="padding:20px 16px;font-size:var(--fs-sm);color:var(--text-dim);text-align:center">Commence à saisir pour rechercher un aliment</div>');
    return;
  }
  const foods=ids.map(id=>_ciqualDB.find(f=>f.id===id)).filter(Boolean);
  el.innerHTML=blocNeuf+blocPerso+blocFav+blocFreq+(_recS?'':titre('Récents')+
    foods.map(f=>_fjResultHtml(f,true)).join('')+sep);
}

// Le titre de section etait ecrit deux fois, ici et dans _renderFjRecent.
// Une seule definition : les sections « Mes aliments » et « Favoris » ne
// peuvent pas diverger visuellement.
// PLAFOND ASSUME : 60 aliments. coach_public est relu par chaque athlete a
// chaque ouverture ; y verser 200 fiches ferait payer ce poids a tout le
// monde pour un cas qui n arrivera pas. Les 60 derniers crees partent.
const COACH_ALIMENTS_MAX=60;
// TROIS usages : en dessous, c est une coincidence ; au-dessus, c est une
// habitude. Le chiffre vient de la specification, il est nomme pour qu on
// puisse le discuter sans relire la fonction.
const FJ_FREQUENT_MIN=3;
function _alimentsPubliablesCoach(u){
  const l=(u&&u.nutrition&&u.nutrition.alimentsPerso)||[];
  if(!Array.isArray(l)) return [];
  return l.slice(-COACH_ALIMENTS_MAX).map(a=>{
    // On ne publie QUE ce qui sert a manger : ni identifiant interne d un
    // autre dossier, ni note calculee, ni date. Le champ de recherche est
    // recalcule a la lecture.
    const o={id:a.id,n:a.n,k:a.k,p:a.p,c:a.c,l:a.l};
    for(const k of ['f','e','sucres','satures','marque','portion_g','code_barres'])
      if(a[k]!=null) o[k]=a[k];
    return o;
  }).filter(a=>{
    if(!a.id||!String(a.n||'').trim()) return false;
    try{ return !nutriControle(a).impossibles.length; }catch(e){ return false; }
  });
}
// Cote athlete : les aliments de SON coach, lus dans le cache local. Rien si
// le rattachement n existe pas — un athlete sans coach ne voit la liste de
// personne, et la serrure reelle est la regle RTDB, pas ce test.
// Publication silencieuse, cote coach uniquement.
function _publierAlimentsCoach(){
  if(!currentUser||currentUser.role!=='coach') return false;
  const key=String(currentUser.email||'').replace(/\./g,',');
  if(!key) return false;
  const l=_alimentsPubliablesCoach(currentUser);
  CLOUD.alimentsCoachPut(key,l).catch(()=>{});
  return true;
}
// Rafraichissement cote athlete. UN SEUL appel par ouverture de la
// recherche, et seulement si le cache a plus d une heure : la liste d un
// coach ne bouge pas dans la journee, et chaque appel compte sur le plan
// Spark dont le plafond est un volume mensuel.
const COACH_ALIMENTS_TTL=3600000;   // 1 h
let _coachAlimentsEnCours=false;
async function _rafraichirAlimentsCoach(){
  if(_coachAlimentsEnCours) return false;
  if(!currentUser||currentUser.role==='coach') return false;
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return false;
  const k=cleCoachDe(currentUser);
  if(!k) return false;
  const b=DB.get('coach_aliments');
  if(b&&b.key===k&&b.t&&(Date.now()-b.t)<COACH_ALIMENTS_TTL) return false;
  _coachAlimentsEnCours=true;
  try{
    const d=await CLOUD.alimentsCoachGet(k);
    DB.set('coach_aliments',{key:k,t:Date.now(),d:Array.isArray(d)?d:[]});
    // La liste vient d arriver : on redessine ce qui est a l ecran, sinon
    // elle n apparaitrait qu a la recherche suivante.
    try{
      const inp=document.getElementById('fj-search-input');
      if(inp&&inp.value) onFjSearch(inp.value); else _renderFjRecent();
    }catch(e){}
    return true;
  }catch(e){
    // Silencieux : l athlete n a rien demande, et Ciqual repond de toute
    // facon. On ne salit pas l ecran pour une liste d appoint.
    return false;
  }finally{ _coachAlimentsEnCours=false; }
}
function _alimentsDuCoach(){
  try{
    if(!currentUser||currentUser.role==='coach') return [];
    const k=cleCoachDe(currentUser);
    if(!k) return [];
    const b=DB.get('coach_aliments');
    const l=(b&&b.key===k&&Array.isArray(b.d))?b.d:[];
    if(!l.length) return [];
    // La provenance est POSEE a la lecture : ces fiches viennent d un tiers,
    // elles ne sont ni Ciqual ni les siennes, et la note doit le dire.
    return l.map(a=>Object.assign({},a,{s:_fjNorm(a.n||''),
      g:'Aliment de ton coach',source:NUTRI_SOURCES.CUSTOM,verifie:true}));
  }catch(e){ return []; }
}
function _fjTitreSection(t){
  return '<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;padding:14px 16px 6px">'+escapeHtml(t)+'</div>';
}
// La ligne d un aliment perso : meme forme qu un resultat Ciqual, plus un
// acces direct a la modification — c est la seule liste ou il se corrige.
// Meme forme qu une ligne perso, SANS le crayon : l athlete ne modifie pas
// ce que son coach a saisi. S il n est pas d accord, il cree le sien.
// ══ UN ARGUMENT DANS UN ATTRIBUT onclick ═════════════════════════════════
// Le guillemet double doit sortir en &quot;, sinon il FERME l'attribut : le
// navigateur compile « selectPersoFood( », c'est-a-dire rien, et le clic est
// mort sans un mot dans la console. C'etait le cas des aliments perso et de
// ceux du coach — mesure au banc le 23/09/2026, typeof onclick === 'object'.
//
// Le nom dit ce qu'elle fait : un ARGUMENT d'attribut. Le motif etait deja
// ecrit quinze fois a la main dans le fichier ; il vit desormais ici, et les
// prochains appels n'auront plus a s'en souvenir.
function _attrArg(v){
  return JSON.stringify(v===undefined?null:v).replace(/"/g,'&quot;');
}
function _htmlCoachResult(a){
  const kcal=a.k!=null?('<span style="color:var(--red-text);font-weight:700">'+a.k+' kcal/100g</span>'):'<span style="color:var(--text-faint)">énergie non renseignée</span>';
  const m=[a.p!=null?('P '+a.p):null,a.c!=null?('G '+a.c):null,a.l!=null?('L '+a.l):null].filter(Boolean).join(' · ');
  return '<div class="fj-result" role="button" tabindex="0" onclick="selectCoachFood('+_attrArg(a.id)+')"'
    +' onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}">'
    +'<div style="font-size:var(--fs-md);font-weight:700;line-height:1.35">'+escapeHtml(a.n||'')+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">'+kcal+(m?(' <span style="color:var(--text-faint)">· '+m+'</span>'):'')+'</div>'
    +'</div>';
}
// Le meme ecran de quantite que partout ailleurs.
function selectCoachFood(id){
  const a=_alimentsDuCoach().find(x=>x&&x.id===id);
  if(!a) return false;
  _fjFood=a;
  go('s-food-add');
  document.getElementById('fja-food-name').textContent=a.n;
  const g=document.getElementById('fja-food-group');
  if(g) g.textContent='Aliment de ton coach';
  const q=document.getElementById('fja-qty');
  if(q) q.value=(a.portion_g>0&&a.portion_g<=1500)?Math.round(a.portion_g):100;
  if(!_fjRepasChoisi) _fjRepas=repasSelonHeure();
  document.querySelectorAll('.fj-repas-btn').forEach(b=>b.classList.toggle('active',b.dataset.repas===_fjRepas));
  const ep=document.getElementById('fja-epingle-slot');
  if(ep) ep.innerHTML='';
  const po=document.getElementById('fja-portions');
  if(po) po.innerHTML='';
  _fjUnite='g';
  const pu=document.getElementById('fja-unites-slot');
  if(pu) pu.innerHTML=_htmlUnites(_fjFood);
  updateFjaCalc();
  _majFjaFiabilite();
  return true;
}
function _htmlPersoResult(a){
  const kcal=a.k!=null?('<span style="color:var(--red-text);font-weight:700">'+a.k+' kcal/100g</span>'):'<span style="color:var(--text-faint)">énergie non renseignée</span>';
  const m=[a.p!=null?('P '+a.p):null,a.c!=null?('G '+a.c):null,a.l!=null?('L '+a.l):null].filter(Boolean).join(' · ');
  return '<div class="fj-result" role="button" tabindex="0" onclick="selectPersoFood('+_attrArg(a.id)+')"'
    +' onkeydown="if(event.key===&quot;Enter&quot;||event.key===&quot; &quot;){event.preventDefault();this.click()}"'
    +' style="display:flex;align-items:center;gap:10px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-size:var(--fs-md);font-weight:700;line-height:1.35">'+escapeHtml(a.n||'')+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">'+kcal+(m?(' <span style="color:var(--text-faint)">· '+m+'</span>'):'')+'</div>'
    +'</div>'
    +'<button type="button" class="hit44" aria-label="Modifier cet aliment" style="flex-shrink:0;background:none;border:none;color:var(--sub);font-size:var(--fs-lg)"'
    +' onclick="event.stopPropagation();ouvrirAlimentPerso('+_attrArg(a.id)+')">'+icon('pencil',14)+'</button>'
    +'</div>';
}
// `via` : la saisie, quand c'est un ALIAS qui a fait sortir la fiche. Sans
// la mention, l'athlète qui tape « lait d'amande » ne comprend pas pourquoi
// « Boisson à l'amande » lui répond.
function _fjResultHtml(f,avecEpingle,via){
  const _kvBadge=`<span style="font-size:var(--fs-xs);font-weight:800;color:var(--amber);background:#1a0e00;border:1px solid #3a1e00;border-radius:var(--r-1);padding:1px 6px;letter-spacing:.5px">VALEUR INDISPONIBLE</span>`;
  const kcalSpan=f.k!=null?`<span style="color:var(--red-text);font-weight:700">${f.k} kcal/100g</span>`:_kvBadge;
  // L'épingle n'apparaît que sur les listes de favoris et de récents : les
  // résultats de recherche restent rendus exactement comme avant.
  const _ep=avecEpingle?_htmlEpingle(f.id,false):'';
  const _dq=(avecEpingle&&estFavori(f.id))?_fjDerniereQty(f.id):null;
  return `<div class="fj-result" onclick="selectFjFood(${f.id})" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}" style="display:flex;align-items:center;gap:8px">
    <div style="flex:1;min-width:0">
    <div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml(f.n)}${_dq?`<span style="font-size:var(--fs-xs);color:var(--text-dim);font-weight:600"> · ${_dq} g la dernière fois</span>`:''}</div>
    ${via?`<div class="fj-via" style="font-size:var(--fs-2xs);color:var(--sub)">trouvé via « ${escapeHtml(via)} »</div>`:''}
    <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px;display:flex;gap:10px;align-items:center">
      ${kcalSpan}
      <span>${escapeHtml(f.g)}</span>
    </div>
    </div>${_ep}
  </div>`;
}


// ══════════════ CONTROLE NUTRITIONNEL ════════════════════════════════════
// Les quatre provenances d un aliment. CIQUAL est mesure en laboratoire par
// l ANSES ; OFF est contributif ; MANUEL est saisi par l athlete ; CUSTOM est
// un aliment saisi puis relu et valide. La provenance change ce qu on peut
// croire des valeurs, donc elle change la note.
const NUTRI_SOURCES=Object.freeze({CIQUAL:'CIQUAL',OFF:'OFF',MANUEL:'MANUEL',CUSTOM:'CUSTOM'});
// Plus de 105 g de macros pour 100 g de produit : 5 g de tolerance pour les
// arrondis d etiquette, au-dela c est arithmetiquement impossible.
const NUTRI_SOMME_MAX=105;
const NUTRI_MACRO_MAX=100;        // g pour 100 g
const NUTRI_KCAL_MAX=900;         // l huile pure plafonne a 900
const NUTRI_SEL_MAX=30;           // g pour 100 g : au-dela, c est du sel
const NUTRI_ATWATER_ALERTE=0.20;  // ecart signale
const NUTRI_ATWATER_NOTE=0.10;    // ecart qui coute des points
const NUTRI_SEUIL_CONFIRME=50;    // sous ce score, l interface exigera un accord
// L energie deduite des macros. Facteurs d Atwater : 4 kcal par gramme de
// proteine et de glucide, 9 par gramme de lipide.
function nutriAtwater(a){
  if(!a) return null;
  if(a.p==null&&a.c==null&&a.l==null) return null;
  // Ciqual ne publie pas le champ alcool dans notre export ; Open Food Facts
  // si, et on le lit. La regle elle-meme vit dans kcalDesMacros.
  return kcalDesMacros(a.p,a.c,a.l,a.alcool);
}
function nutriEcartAtwater(a){
  const th=nutriAtwater(a);
  if(th==null||!(th>0)||a.k==null) return null;
  return Math.abs(a.k-th)/th;
}
// La provenance se DEDUIT quand elle n est pas portee, par la regle que le
// reste du fichier applique deja : un identifiant NUMERIQUE est un identifiant
// Ciqual, une chaine « p… » est un aliment perso, et un objet qui porte `_off`
// vient d Open Food Facts. UNE SEULE definition : elle etait ecrite deux fois,
// et la seconde ignorait les identifiants numeriques — un aliment de la table
// se voyait alors traite comme une saisie manuelle.
function nutriSource(a){
  if(!a||typeof a!=='object') return NUTRI_SOURCES.MANUEL;
  if(a.source) return a.source;
  if(a._off) return NUTRI_SOURCES.OFF;
  return (typeof a.id==='number')?NUTRI_SOURCES.CIQUAL:NUTRI_SOURCES.MANUEL;
}
// PURE. Rend {valide, fiabilite, alertes[], rejets[]}.
// `valide` porte les impossibilites arithmetiques SEULEMENT : un aliment peut
// etre valide et peu fiable, c est justement a quoi sert la note.
function nutriControle(a){
  // DEUX NATURES DE REFUS, qui ne se traitent pas pareil :
  //   « impossibles » : l arithmetique interdit ces valeurs. Rien ne les sauve.
  //   « incomplets »  : la fiche ne dit pas tout. C est genant, pas absurde.
  // MESURE qui impose la distinction : 143 des 3 484 aliments Ciqual ne
  // portent AUCUNE energie — l ANSES ne la publie pas pour eux (« Brochette
  // de boeuf, crue », « Croque-monsieur »). Ils sont journalisables
  // aujourd hui, et l affichage sait dire « énergie non renseignée ». Les
  // refuser au nom de la completude effacerait 143 aliments reels.
  const impossibles=[],incomplets=[],alertes=[];
  // MEME FORME DE RETOUR dans tous les cas, sortie anticipée comprise : un
  // appelant qui lit `impossibles` ne doit jamais tomber sur `undefined`.
  if(!a||typeof a!=='object')
    return {valide:false,fiabilite:0,alertes:[],rejets:['Aliment illisible.'],
      impossibles:['Aliment illisible.'],incomplets:[]};
  const src=nutriSource(a);
  // ── Les rejets : ce qui ne peut pas exister ──────────────────────────
  if(!String(a.n||'').trim()) incomplets.push('Cet aliment n’a pas de nom.');
  if(a.k==null) incomplets.push('L’énergie n’est pas renseignée.');
  if(a.p==null&&a.c==null&&a.l==null)
    incomplets.push('Aucune macro n’est renseignée : protéines, glucides et lipides sont tous absents.');
  if(a.k!=null&&a.k<0) impossibles.push('L’énergie ne peut pas être négative.');
  if(a.k!=null&&a.k>NUTRI_KCAL_MAX)
    impossibles.push(_nb2(a.k)+' kcal pour 100 g : au-delà du possible (l’huile pure est à 900).');
  // Chaque champ porte son libelle ACCORDE. Fabriquer la phrase par
  // substitution rendait le message illisible dans le code pour economiser
  // cinq mots — un mauvais echange quand ce texte s affiche a l athlete.
  const CHAMPS=[
    {k:'p',neg:'Les protéines ne peuvent pas être négatives.',trop:'Les protéines'},
    {k:'c',neg:'Les glucides ne peuvent pas être négatifs.',  trop:'Les glucides'},
    {k:'l',neg:'Les lipides ne peuvent pas être négatifs.',   trop:'Les lipides'},
    {k:'f',neg:'Les fibres ne peuvent pas être négatives.',   trop:'Les fibres'},
    {k:'e',neg:'Le sel ne peut pas être négatif.',            trop:'Le sel'}];
  for(const ch of CHAMPS){
    const v=a[ch.k];
    if(v==null) continue;
    if(v<0) impossibles.push(ch.neg);
    else if(v>NUTRI_MACRO_MAX) impossibles.push(ch.trop+' : '+_nb2(v)+' g pour 100 g de produit, c’est impossible.');
  }
  const somme=(a.p||0)+(a.c||0)+(a.l||0);
  if(somme>NUTRI_SOMME_MAX)
    impossibles.push('Protéines + glucides + lipides font '+_nb2(somme)+' g pour 100 g de produit.');
  // ── Les alertes : ce qui est possible mais suspect ───────────────────
  const ec=nutriEcartAtwater(a);
  if(ec!=null&&ec>NUTRI_ATWATER_ALERTE)
    alertes.push('Les macros donnent environ '+Math.round(nutriAtwater(a))+' kcal, l’étiquette annonce '+_nb2(a.k)+'.');
  // « dont » veut dire « compris dans » : un sous-total ne peut pas depasser
  // son total. C est la faute de saisie la plus frequente sur une etiquette.
  if(a.sucres!=null&&a.c!=null&&a.sucres>a.c)
    alertes.push('Les sucres ('+_nb2(a.sucres)+' g) dépassent les glucides ('+_nb2(a.c)+' g), alors qu’ils en font partie.');
  if(a.satures!=null&&a.l!=null&&a.satures>a.l)
    alertes.push('Les acides gras saturés ('+_nb2(a.satures)+' g) dépassent les lipides ('+_nb2(a.l)+' g), alors qu’ils en font partie.');
  if(a.e!=null&&a.e>NUTRI_SEL_MAX)
    alertes.push(_nb2(a.e)+' g de sel pour 100 g : à ce niveau, le produit EST du sel.');
  // ── La note ──────────────────────────────────────────────────────────
  const rejets=impossibles.concat(incomplets);
  // La note tombe a zero sur une IMPOSSIBILITE seulement. Une fiche
  // incomplete garde la sienne : les 143 aliments Ciqual sans energie sont
  // de la donnee ANSES, pas de la donnee fausse, et les noter 0 aurait
  // declenche une demande de confirmation sur chacun d eux.
  const fiabilite=_nutriNote(a,src,ec,impossibles.length>0);
  // « valide » reste l union : offValide s en sert, et une fiche Open Food
  // Facts muette n a rien a faire dans le journal. « impossibles » est ce qui
  // doit bloquer un aliment DEJA en base, Ciqual compris — sans quoi les 143
  // aliments ANSES sans energie deviendraient injournalisables.
  return {valide:rejets.length===0,fiabilite,alertes,rejets,impossibles,incomplets};
}
// Deux decimales au plus, virgule francaise, sans zero inutile.
function _nb2(v){ return (Math.round(Number(v)*100)/100).toString().replace('.',','); }
function _nutriNote(a,src,ec,rejete){
  // Un aliment rejete n a pas de note : lui en donner une laisserait croire
  // qu il est utilisable en le confirmant.
  if(rejete) return 0;
  // CIQUAL est mesure en laboratoire par l ANSES. Lui retirer des points pour
  // une marque ou une portion absentes n aurait aucun sens : un aliment
  // generique n en a pas, et c est la source la plus sure dont on dispose.
  // MESURÉ sur les 3 484 aliments de la table : 454 d'entre eux — 13,9 % —
  // s'écartent de plus de 10 % du calcul d'Atwater, et 228 de plus de 20 %.
  // « Petits pois, crus » est à 15 %, « Haricots blancs à la sauce tomate » à
  // 14 % : fibres et acides organiques ne suivent pas les facteurs 4/4/9. Sans
  // cette ligne, un aliment mesuré en laboratoire par l'ANSES tomberait à 70.
  if(src===NUTRI_SOURCES.CIQUAL) return 100;
  let n=100;
  if(ec!=null&&ec>NUTRI_ATWATER_NOTE) n-=30;
  for(const cle of ['p','c','l']) if(a[cle]==null) n-=20;
  // Marque et portion ne se reprochent qu a un PRODUIT : une preparation
  // maison n a pas de marque, et l en penaliser punirait l athlete d avoir
  // cuisine. On ne les exige que la ou un code-barres existe.
  const estProduit=!!(a.code_barres||(a._off&&a._off.ean));
  if(estProduit){
    const marque=a.marque||(a._off&&a._off.marque);
    const portion=a.portion_g||(a._off&&a._off.portion);
    if(!marque) n-=15;
    if(!(portion>0)) n-=10;
  }
  if(a.verifie===true) n+=10;
  return Math.max(0,Math.min(100,n));
}
// ══════════════ PRODUITS DE MARQUE — OPEN FOOD FACTS ══════════════════════
// Ciqual reste la base : 3 484 aliments ANSES, mesurés en laboratoire, à
// demeure. OFF est une base CONTRIBUTIVE — n'importe qui y saisit n'importe
// quoi — et elle n'est jamais recopiée ici : ni en cache, ni dans le document
// `user`, ni ailleurs que dans l'entrée journalisée. C'est la licence ODbL qui
// l'exige, et l'attribution est affichée avec les résultats.
//
// L'ENDPOINT DE LA SPÉCIFICATION NE CHERCHE PAS. Mesuré : /api/v2/search avec
// `search_terms` ignore le terme et rend la base entière — 1 256 246 produits,
// « skyr danone » sortant Cristaline en premier. C'est un filtre à facettes,
// pas un moteur. La recherche plein texte passe par search.openfoodfacts.org
// (65 ms, pertinent), dont l'index ne porte hélas ni marque ni format ; ceux-là
// se lisent en un SECOND appel, par liste de codes, sur /api/v2/search.
// Deux appels pour un geste, très en deçà des 10 req/min.
const OFF_URL_RECHERCHE='https://search.openfoodfacts.org/search';
const OFF_URL_DETAIL='https://world.openfoodfacts.org/api/v2/search';
const OFF_APP='RepCore';
const OFF_APP_V='1.0';
const OFF_PAGE=12;
const OFF_TIMEOUT=8000;
const OFF_MAX_KCAL=900;           // au-delà, la fiche est fausse : l'huile pure est à 900
const OFF_ECART_MACRO=0.30;
const OFF_ATTRIBUTION='Source : Open Food Facts (donnée contributive sous licence ODbL). '
  +'Les valeurs sont saisies par des contributeurs, pas mesurées en laboratoire.';
// OFF normalise ses champs `_100g` en GRAMMES, l'énergie exceptée. MICRO_REFS,
// lui, attend des mg pour cinq clés et des µg pour trois. Le facteur est ici,
// une seule fois : deux conversions divergeraient au premier ajout.
const OFF_MICROS=Object.freeze([
  {cle:'fe', off:'iron',        facteur:1000,    plafond:60},
  {cle:'ca', off:'calcium',     facteur:1000,    plafond:2000},
  {cle:'mg', off:'magnesium',   facteur:1000,    plafond:1000},
  {cle:'zn', off:'zinc',        facteur:1000,    plafond:100},
  {cle:'io', off:'iodine',      facteur:1000000, plafond:2000},
  {cle:'k_',off:'potassium',    facteur:1000,    plafond:6000},
  {cle:'b9', off:'vitamin-b9',  facteur:1000000, plafond:2000},
  {cle:'b12',off:'vitamin-b12', facteur:1000000, plafond:500}
]);
// PURE. Un nombre fini et positif, ou null. Une chaîne vide, un NaN, un
// négatif : autant d'absences. Zéro, lui, est une VALEUR — un produit peut
// réellement contenir 0 g de lipides.
function _offNb(v){
  if(v===null||v===undefined||v==='') return null;
  const n=parseFloat(v);
  return (isFinite(n)&&n>=0)?n:null;
}
// PURE. Le nom normalisé, sur le modèle du champ `s` de Ciqual : c'est lui qui
// dédoublonne.
function _offNorm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
// PURE. La quantité d'une portion, en grammes, ou null si AMBIGUË.
// « 140 g » se lit ; « 1 serving », « 1 pot », « 2 tranches » ne se lisent pas
// — et deviner le poids d'une tranche serait inventer une donnée.
function offPortionGrammes(txt){
  const t=String(txt||'').toLowerCase().replace(',','.');
  if(!t) return null;
  const m=t.match(/(\d+(?:\.\d+)?)\s*(g|gr|grammes?|ml|cl|l)\b/);
  if(!m) return null;
  const v=parseFloat(m[1]);
  if(!(v>0)) return null;
  // ml et g sont assimilés : pour un yaourt ou une boisson, la densité est
  // assez proche de 1 pour que l'écart soit sous le bruit de la saisie. cl et
  // L sont ramenés au ml.
  if(m[2]==='cl') return v*10;
  if(m[2]==='l')  return v*1000;
  return v;
}
// PURE. Un produit OFF vers la forme Ciqual, POUR 100 g. Aucune valeur n'est
// inventée : une macro absente reste null, un micronutriment absent n'est pas
// posé du tout — c'est la règle de partDocumentee, et elle vaut ici aussi.
function offNormalise(p){
  if(!p||typeof p!=='object') return null;
  const code=String(p.code||'').trim();
  if(!code) return null;
  const n=p.nutriments||{};
  const nom=String(p.product_name_fr||p.product_name||'').trim();
  // Base des valeurs. OFF calcule `_100g` lui-même dans la quasi-totalité des
  // cas ; quand il ne le fait pas, on convertit depuis la portion, et on
  // REFUSE si la portion est illisible plutôt que de diviser au hasard.
  const per=String(p.nutrition_data_per||'').toLowerCase();
  const gPortion=offPortionGrammes(p.serving_size)
    ||_offNb(p.serving_quantity)||null;
  let ambigu=false;
  const lire=(base)=>{
    const v100=_offNb(n[base+'_100g']);
    if(v100!=null) return v100;
    const vp=_offNb(n[base+'_serving']);
    if(vp==null) return null;
    if(per==='serving'&&gPortion>0) return vp*100/gPortion;
    ambigu=true;                       // une valeur par portion, sans portion lisible
    return null;
  };
  const k=(()=>{
    const kc=lire('energy-kcal');
    if(kc!=null) return kc;
    const kj=lire('energy');           // certains produits ne portent que des kJ
    return kj!=null?kj/4.184:null;
  })();
  const a={
    id:'off:'+code,
    n:nom,
    g:'produit de marque',
    s:_offNorm(nom+' '+(p.brands||'')),
    k:k!=null?Math.round(k*10)/10:null,
    p:lire('proteins'), c:lire('carbohydrates'), l:lire('fat'),
    f:lire('fiber'), e:lire('salt'),
    // Les deux sous-totaux « dont ». Ils ne servent a aucun calcul — seule
    // l alerte de coherence les lit — mais leur absence rendait cette alerte
    // impossible a poser sur un produit scanne.
    sucres:lire('sugars'), satures:lire('saturated-fat'),
    // L ethanol, pour que le calcul d Atwater ne declare pas incoherent un
    // produit dont les calories viennent de l alcool.
    alcool:lire('alcohol'),
    source:NUTRI_SOURCES.OFF, verifie:false,
    _off:{ean:code,marque:String(p.brands||'').split(',')[0].trim(),
      format:String(p.quantity||'').trim(),portion:gPortion||null,
      // ⚠ EN MEMOIRE SEULEMENT. saveFoodEntry ne recopie de `_off` que
      // `alim_source` et `ean` : ces deux listes servent au filtre le temps de
      // la saisie, puis disparaissent. Rien de la base OFF n'est conserve
      // ailleurs que dans ce que l'athlete inscrit lui-meme — contrainte ODbL.
      allergenes:_offTags(p.allergens_tags),
      traces:_offTags(p.traces_tags)},
    _ambigu:false
  };
  for(const k2 of ['p','c','l','f','e','sucres','satures','alcool'])
    if(a[k2]!=null) a[k2]=Math.round(a[k2]*100)/100;
  // Micronutriments : posés SEULEMENT s'ils existent, et seulement s'ils sont
  // plausibles. Une valeur absurde n'est pas une information — la déposer
  // gonflerait partDocumentee avec du bruit.
  for(const m of OFF_MICROS){
    const v=lire(m.off);
    if(v==null) continue;
    const val=v*m.facteur;
    if(!(val>0)||val>m.plafond) continue;
    a[m.cle]=Math.round(val*1000)/1000;
  }
  a._ambigu=ambigu;
  return a;
}
// PURE. Les cinq motifs de rejet. Rend {ok:true} ou {ok:false, raison}.
// La raison est AFFICHÉE : un refus muet donne l'impression d'un bug.
function offValide(a){
  if(!a||!a.n) return {ok:false,raison:'Ce produit n\'a pas de nom.'};
  if(a._ambigu)
    return {ok:false,raison:'Les valeurs sont données par portion, sans poids de portion lisible. Impossible de ramener à 100 g sans deviner.'};
  const manque=[];
  if(a.k==null) manque.push('les calories');
  if(a.p==null) manque.push('les protéines');
  if(a.c==null) manque.push('les glucides');
  if(a.l==null) manque.push('les lipides');
  if(manque.length)
    return {ok:false,raison:'Fiche incomplète : '+manque.join(', ')+' ne sont pas renseignées. Open Food Facts est contributif, cette fiche n\'a pas été complétée.'};
  if(a.k>OFF_MAX_KCAL)
    return {ok:false,raison:a.k+' kcal pour 100 g : au-delà du possible (l\'huile pure est à 900). La fiche est erronée.'};
  // Les bornes arithmetiques vivent dans nutriControle, une seule fois : une
  // valeur negative, une macro au-dela de 100 g pour 100 g, ou une somme
  // impossible. offValide garde en propre ce qui tient a OFF — fiche muette,
  // valeurs par portion illisibles, ecart aux calories declarees.
  const _ctrl=nutriControle(a);
  if(!_ctrl.valide) return {ok:false,raison:_ctrl.rejets[0]};
  // N2.14 — la MEME regle que nutriEcartAtwater, alcool compris : un aliment
  // alcoolise etait rejete ici et accepte la-bas.
  const calcul=nutriAtwater(a);
  if(a.k>0&&Math.abs(calcul-a.k)/a.k>OFF_ECART_MACRO)
    return {ok:false,raison:'Les macros ne collent pas aux calories déclarées ('+Math.round(calcul)+' kcal calculées contre '+Math.round(a.k)+' annoncées). La fiche est incohérente.'};
  return {ok:true};
}
// PURE. Dédoublonnage par nom normalisé, en gardant le PREMIER — l'ordre de
// pertinence d'OFF est conservé.
function offDedoublonner(l){
  const vus=new Set(), out=[];
  for(const a of (l||[])){
    if(!a||!a.s||vus.has(a.s)) continue;
    vus.add(a.s); out.push(a);
  }
  return out;
}


// ══════════════ SCAN DE CODE-BARRES ═══════════════════════════════════════
// WebKit N'IMPLÉMENTE PAS BarcodeDetector : tout iOS passe par le décodeur
// WASM. Il n'y a donc qu'UN chemin de décodage, écrit une fois et éprouvé une
// fois — pas un chemin natif pour Android et un chemin de repli pour le reste.
//
// LE REPLI MANUEL N'EST PAS UN REPLI. C'est la voie principale sur tout
// appareil sans caméra utilisable, et le lien qui y mène est PERMANENT, sous
// le viseur. Il fonctionne sans décodeur, sans caméra, sans un octet de WASM.
//
// Le décodeur pèse 1 042 Ko : il est chargé par import() AU CLIC, jamais au
// chargement de l'application, jamais dans ASSETS du service worker.
// Chemin résolu depuis le DOCUMENT, et non depuis un module : le script est
// inline et classique, donc import() prend index.html pour base. Même forme
// que _TESS, qui vaut './vendor/tesseract/'.
const SCAN_DECODEUR='./vendor/zxing/reader/index.js';
const SCAN_EAN_MIN=8, SCAN_EAN_MAX=13;
const SCAN_INTERVALLE=350;        // ms entre deux tentatives de lecture
const SCAN_MAX_ESSAIS=90;         // ~30 s, puis on propose la saisie
// Délai au bout duquel on suppose que la demande d'autorisation caméra n'a
// pas été vue. Assez long pour laisser le temps de la lire et d'accepter,
// assez court pour ne pas laisser croire que le scan est cassé.
const SCAN_ATTENTE_CAM=7000;      // ms
// Un code-barres reste dans le champ de la camera bien apres avoir ete lu.
// Sans ce delai, reculer le telephone puis le ramener relance la meme fiche,
// et un athlete qui scanne trois produits d affilee voit le premier revenir.
const SCAN_DEBOUNCE=1500;         // ms avant de re-accepter LE MEME code
// LES CODES-BARRES D ABORD, mais pas seulement. Un emballage porte de plus
// en plus un QR code — le standard GS1 Digital Link — a cote de son EAN, et
// le viser ne produisait RIEN, sans meme dire pourquoi. Le decodeur sait les
// lire, il suffisait de les lui demander. Le DataMatrix sert aux petits
// formats, ou l EAN ne tient pas.
const SCAN_FORMATS=['EAN-13','EAN-8','UPC-A','UPC-E','QRCode','DataMatrix'];
let _scanDernierCode=null, _scanDernierT=0;
let _scanTorche=false;
let _scanFlux=null, _scanBoucle=null, _scanZX=null, _scanEssais=0, _scanOccupe=false;

// PURE. Un EAN est-il plausible ? Longueur, chiffres, puis CLÉ DE CONTRÔLE.
// Sans la clé, une frappe de travers part interroger OFF pour rien et revient
// « produit introuvable » — un message faux, qui accuse la base alors que
// c'est la saisie qui est fautive.
// CE QU UN QR CODE CONTIENT n est pas un code produit : c est presque
// toujours une URL. Le standard GS1 Digital Link y loge le GTIN apres un
// segment « /01/ » — https://id.gs1.org/01/03017620422003 — et c est la
// seule forme sur laquelle on peut compter. Un QR de campagne publicitaire
// ou de recette ne porte aucun code : on le DIT, au lieu de laisser croire
// que le scan a echoue.
function scanExtraireCode(texte){
  const t=String(texte||'').trim();
  if(!t) return {ok:false,raison:'Rien n’a pu être lu.'};
  // Un code-barres classique : que des chiffres.
  if(/^\d+$/.test(t)) return {ok:true,code:t};
  // GS1 Digital Link : le GTIN suit « /01/ ». 8, 12, 13 ou 14 chiffres.
  const m=t.match(/(?:^|\/)01\/(\d{8,14})(?:[\/?#]|$)/);
  if(m){
    let c=m[1];
    // Un GTIN-14 porte un chiffre d indicateur en tete ; l EAN-13 du produit
    // est en dessous. Open Food Facts indexe l EAN, pas le GTIN-14.
    if(c.length===14&&c[0]==='0') c=c.slice(1);
    return {ok:true,code:c};
  }
  // Une URL sans GTIN, ou du texte libre : on nomme ce qu on a lu.
  if(/^https?:\/\//i.test(t))
    return {ok:false,qrSansCode:true,
      raison:'Ce QR code renvoie vers une page web, il ne contient pas de code produit. Vise le code-barres à barres noires, ou photographie le tableau nutritionnel.'};
  return {ok:false,qrSansCode:true,
    raison:'Ce code ne contient pas de référence produit. Vise le code-barres, ou photographie le tableau nutritionnel.'};
}
function scanEanValide(code){
  const c=String(code||'').replace(/\s/g,'');
  if(!/^\d+$/.test(c)) return {ok:false,raison:'Un code-barres ne contient que des chiffres.'};
  if(c.length<SCAN_EAN_MIN||c.length>SCAN_EAN_MAX)
    return {ok:false,raison:'Un code-barres fait entre '+SCAN_EAN_MIN+' et '+SCAN_EAN_MAX+' chiffres ('+c.length+' saisis).'};
  // EAN-8, UPC-A (12) et EAN-13 portent une clé ; les longueurs intermédiaires
  // (9, 10, 11) n'en ont pas de standard : on les laisse passer, OFF tranchera.
  if(c.length===8||c.length===12||c.length===13){
    const ch=c.split('').map(Number);
    const cle=ch.pop();
    let s=0;
    // Le poids 3 s'applique en partant de la DROITE, quelle que soit la
    // longueur : l'appliquer depuis la gauche marche pour l'EAN-13 et échoue
    // pour l'EAN-8 et l'UPC-A.
    for(let i=ch.length-1,p=3;i>=0;i--,p=(p===3?1:3)) s+=ch[i]*p;
    if(((10-(s%10))%10)!==cle)
      return {ok:false,raison:'Ce code-barres n\'est pas valide : sa clé de contrôle ne correspond pas. Vérifie les chiffres.'};
  }
  return {ok:true,code:c};
}
// Récupère un produit par son code. offNormalise et offValide sont ceux de
// F-64, INCHANGÉS : les règles de rejet sont donc identiques, et un
// micronutriment absent ne pose pas sa clé.
// PURE. LES ETIQUETTES D'ALLERGENES D'OPEN FOOD FACTS, mises a plat.
//
// Elles arrivent prefixees par une langue — « en:peanuts », « fr:arachide » —
// et melangees. On retire le prefixe et on rend une chaine cherchable. On ne
// TRADUIT pas : un motif francais ne trouvera pas « peanuts », et c'est une
// limite honnete plutot qu'un dictionnaire maison qui se tromperait.
function _offTags(tags){
  if(!Array.isArray(tags)) return '';
  return tags.map(t=>String(t||'').replace(/^[a-z]{2}:/,'').replace(/-/g,' '))
    .filter(Boolean).join(' ');
}
async function offParEAN(ean){
  const v=scanEanValide(ean);
  if(!v.ok) return {ok:false,raison:v.raison};
  if(typeof navigator!=='undefined'&&navigator.onLine===false)
    return {ok:false,horsLigne:true,raison:'Hors ligne : la fiche produit demande une connexion.'};
  try{
    const u='https://world.openfoodfacts.org/api/v2/product/'+encodeURIComponent(v.code)
      // ⚠ allergens_tags ET traces_tags DEMANDES EXPRESSEMENT. Sans eux, un
      // motif d'eviction ne voit d'un produit de marque que son nom — et
      // « Biscuits fourrés » ne porte le mot « arachide » nulle part. Ils
      // servent a SIGNALER une presence ; ils ne prouvent jamais une absence,
      // et rien de tout cela n'est enregistre dans le dossier.
      +'.json?fields=code,product_name,product_name_fr,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments,allergens_tags,traces_tags'
      +'&app_name='+OFF_APP+'&app_version='+OFF_APP_V;
    const r=await _offFetch(u);
    if(r.status===429) return {ok:false,quota:true,
      raison:'Open Food Facts limite le nombre de requêtes par minute. Réessaie dans un instant.'};
    // Même mesure qu'en F-64 : au-delà du quota, OFF sert parfois une page
    // HTML avec un statut 200.
    const ct=String(r.headers&&r.headers.get&&r.headers.get('content-type')||'');
    if(ct&&ct.indexOf('json')<0) return {ok:false,quota:true,
      raison:'Open Food Facts limite le nombre de requêtes par minute. Réessaie dans un instant.'};
    if(r.status===404) return {ok:false,inconnu:true,code:v.code,
      raison:'Ce code-barres n\'est pas encore dans Open Food Facts.'};
    if(!r.ok) return {ok:false,raison:'Open Food Facts est injoignable ('+r.status+').'};
    const j=await r.json();
    // RÈGLE 6 : un EAN inconnu se DIT, avec une porte de sortie. Jamais un
    // écran vide.
    if(!j||j.status===0||!j.product) return {ok:false,inconnu:true,code:v.code,
      raison:'Ce code-barres n\'est pas encore dans Open Food Facts.'};
    const a=offNormalise(j.product);
    if(!a) return {ok:false,inconnu:true,code:v.code,
      raison:'La fiche de ce produit est inexploitable.'};
    const val=offValide(a);
    if(!val.ok) return {ok:false,raison:val.raison,produit:a};
    return {ok:true,produit:a};
  }catch(e){
    if(e&&e.name==='AbortError')
      return {ok:false,raison:'Open Food Facts met trop de temps à répondre.'};
    return {ok:false,raison:'Recherche impossible : '+((e&&e.message)||'erreur réseau')+'.'};
  }
}
// Le décodeur, chargé À LA DEMANDE. Une seule fois par session : le module
// garde son instance WASM, et purgeZXingModule la libère à la fermeture.
async function scanChargerDecodeur(){
  if(_scanZX) return _scanZX;
  // import() avec une URL RELATIVE AU MODULE : le fichier .wasm est à côté du
  // .js, et le module le résout par import.meta.url. Les deux voyagent
  // ensemble dans vendor/zxing/, c'est ce qui rend la résolution automatique.
  _scanZX=await import(SCAN_DECODEUR);
  return _scanZX;
}

// ── L'écran de scan ───────────────────────────────────────────────────────
// Le lien de saisie manuelle est PERMANENT : il est là avant la caméra,
// pendant, et après un échec. Sur iOS, c'est souvent le seul chemin qui
// aboutit — le retirer reviendrait à retirer la fonctionnalité.
function htmlScanBouton(){
  // RÈGLE 5 : hors ligne, le bouton disparaît. La fiche produit se lit chez
  // OFF, et sans réseau il n'y a rien à lire — scanner mènerait à un mur.
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return '';
  return `<button id="scan-btn" class="btn btn-outline btn-sm" style="width:100%;margin-top:8px"
    onclick="ouvrirScan()">Scanner un code-barres</button>`;
}
function ouvrirScan(){
  _scanEssais=0;
  goAvecRetour('s-scan');
  const z=document.getElementById('scan-corps');
  if(z) z.innerHTML=_htmlScanViseur();
  scanDemarrer();
}
function _htmlScanViseur(){
  return `<div id="scan-viseur" style="position:relative;border-radius:var(--r-3);overflow:hidden;background:#000;aspect-ratio:4/3">
      <video id="scan-video" playsinline muted autoplay style="width:100%;height:100%;object-fit:cover;display:block"></video>
      <div style="position:absolute;left:12%;right:12%;top:38%;height:24%;border:2px solid color-mix(in srgb,var(--text) 85%,transparent);border-radius:var(--r-2);box-shadow:0 0 0 9999px rgba(0,0,0,.35)"></div>
    </div>
    <div id="scan-etat" style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:10px;min-height:34px">Démarrage de la caméra…</div>
    <div id="scan-torche-slot"></div>
    <button class="btn btn-outline btn-sm" style="width:100%;margin-top:4px" onclick="scanSaisieManuelle()">Saisir le code à la main</button>
    <!-- TOUJOURS accessible : un produit peut n être dans aucune base, et
         l athlete ne doit pas avoir a echouer deux fois pour le decouvrir. -->
    <!-- LA DEUXIEME VOIE, a cote de la premiere. Un produit sans code-barres
         lisible, ou absent des bases, porte toujours son tableau
         nutritionnel : c est le dernier recours qui marche toujours. -->
    <button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="photographierEtiquette()">Photographier le tableau nutritionnel</button>
    <button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="creerAlimentDepuisScan()">Créer l'aliment à la main</button>
    <div id="scan-manuel"></div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">Aucune image n'est enregistrée, ni transmise, ni mise en cache. La caméra ne sert qu'à lire le code, sur ton appareil.</div>`;
}
// LA TORCHE n existe pas partout : iOS ne l expose pas du tout, et beaucoup
// de webcams non plus. On interroge la piste video et on ne pose le bouton
// que si la capacite est reellement annoncee — un bouton qui ne fait rien
// est pire que pas de bouton.
function _scanPisteVideo(){
  try{ return _scanFlux&&_scanFlux.getVideoTracks?_scanFlux.getVideoTracks()[0]:null; }
  catch(e){ return null; }
}
function _scanTorcheDispo(){
  const t=_scanPisteVideo();
  try{ return !!(t&&t.getCapabilities&&t.getCapabilities().torch); }catch(e){ return false; }
}
function _majScanTorche(){
  const z=document.getElementById('scan-torche-slot');
  if(!z) return;
  if(!_scanTorcheDispo()){ z.innerHTML=''; return; }
  z.innerHTML='<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="scanBasculerTorche()">'
    +(_scanTorche?'Éteindre la lampe':'Allumer la lampe')+'</button>';
}
async function scanBasculerTorche(){
  const t=_scanPisteVideo();
  if(!t) return false;
  try{
    await t.applyConstraints({advanced:[{torch:!_scanTorche}]});
    _scanTorche=!_scanTorche;
    _majScanTorche();
    return true;
  }catch(e){
    // Refus de l appareil : on le dit plutot que de laisser un bouton mort.
    _scanDire('Cet appareil refuse d\'allumer la lampe.','var(--orange)');
    return false;
  }
}
// Creer un aliment depuis le scan, en emportant le code-barres quand il a ete
// lu : le retaper serait absurde, et c est la seule facon de rattacher
// l aliment saisi au produit qui l a declenche.
// Ouvre la creation d aliment ET declenche tout de suite l appareil photo :
// l athlete a demande a photographier une etiquette, pas a remplir un
// formulaire vide puis a chercher le bouton.
function photographierEtiquette(code){
  creerAlimentDepuisScan(code);
  // Apres le changement d ecran, sinon le champ n existe pas encore.
  setTimeout(()=>{
    const f=document.getElementById('perso-etiq-file');
    if(f) f.click();
  },350);
}
function creerAlimentDepuisScan(code){
  const c=(typeof code==='string'&&code)?code:_scanDernierCode;
  // AVANT de partir : l ecran suivant peut charger Tesseract, et les deux
  // moteurs WebAssembly dans la meme page depassent ce qu un telephone
  // d entree de gamme accorde a un onglet.
  scanLibererTout();
  ouvrirAlimentPerso(null,c?{code_barres:c}:null);
}
function _scanDire(msg,couleur){
  const e=document.getElementById('scan-etat');
  if(e){ e.textContent=msg; e.style.color=couleur||'var(--sub)'; }
}
// RÈGLE 1 : caméra refusée, absente, ou décodeur en échec ⇒ la saisie manuelle
// s'ouvre IMMÉDIATEMENT. On ne laisse jamais l'athlète devant un écran mort.
async function scanDemarrer(){
  const v=document.getElementById('scan-video');
  if(!v) return false;
  let mod;
  try{
    _scanDire('Chargement du lecteur…');
    mod=await scanChargerDecodeur();
  }catch(e){
    _scanDire('Le lecteur de code-barres n\'a pas pu se charger. Saisis le code à la main.','var(--orange)');
    scanSaisieManuelle();
    return false;
  }
  try{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)
      throw new Error('pas de caméra');
    // MESURÉ : tant que la fenêtre d'autorisation n'a pas de réponse,
    // getUserMedia reste EN ATTENTE — indéfiniment. Le message restait alors
    // sur « Chargement du lecteur… », le décodeur était pourtant déjà chargé,
    // et la saisie manuelle ne s'ouvrait pas : la RÈGLE 1 ne couvrait que le
    // REFUS, pas l'attente. Sur ordinateur la demande apparaît dans la barre
    // d'adresse et passe très facilement inaperçue.
    _scanDire('Autorise l\'accès à la caméra pour scanner.');
    const pCam=navigator.mediaDevices.getUserMedia({
      video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:960}},
      audio:false});
    // On N'ABANDONNE PAS au bout du délai : quelqu'un qui lit la demande doit
    // pouvoir accepter et voir la caméra démarrer. On ouvre seulement la porte
    // de sortie en parallèle, pour qu'aucun écran ne reste mort.
    const secours=setTimeout(()=>{
      if(_scanFlux) return;
      _scanDire('En attente de ton autorisation caméra (regarde la demande de ton navigateur). Tu peux aussi saisir le code à la main.','var(--orange)');
      if(!document.getElementById('scan-ean')) scanSaisieManuelle();
    },SCAN_ATTENTE_CAM);
    try{ _scanFlux=await pCam; }
    finally{ clearTimeout(secours); }
    // L'écran a pu être quitté pendant l'attente : sans cette garde la caméra
    // resterait allumée, témoin lumineux compris, derrière un autre écran.
    if(!document.getElementById('scan-video')||
       (document.querySelector('.screen.active')||{}).id!=='s-scan'){
      try{ _scanFlux.getTracks().forEach(t=>t.stop()); }catch(err){}
      _scanFlux=null;
      return false;
    }
    v.srcObject=_scanFlux;
    await v.play().catch(()=>{});
  }catch(e){
    // TROIS SITUATIONS DIFFERENTES, qui tombaient dans le meme message : un
    // refus se debloque dans les reglages du navigateur, une camera absente
    // ne se debloque pas, et une camera occupee se libere en fermant l autre
    // application. Dire « indisponible ou refusée » laissait l athlete sans
    // rien a faire dans les trois cas.
    const nom=(e&&e.name)||'';
    let m='Caméra indisponible. Saisis le code à la main : ça marche tout aussi bien.';
    if(nom==='NotAllowedError'||nom==='SecurityError')
      m='Accès à la caméra refusé. Pour l\'autoriser : touche le cadenas à gauche de l\'adresse, puis active la caméra. En attendant, saisis le code à la main.';
    else if(nom==='NotFoundError'||nom==='OverconstrainedError')
      m='Aucune caméra détectée sur cet appareil. Saisis le code à la main.';
    else if(nom==='NotReadableError')
      m='La caméra est déjà utilisée par une autre application. Ferme-la, ou saisis le code à la main.';
    _scanDire(m,'var(--orange)');
    scanArreter();
    scanSaisieManuelle();
    return false;
  }
  _majScanTorche();
  _scanDire('Cadre le code-barres dans le rectangle.');
  _scanBoucle=setInterval(()=>{ scanTenter(mod); },SCAN_INTERVALLE);
  return true;
}
// Une image est prise, décodée EN MÉMOIRE, puis jetée. Le canvas n'est ni
// affiché, ni exporté, ni conservé : aucune donnée d'image ne sort de la boucle.
async function scanTenter(mod){
  if(_scanOccupe) return;
  const v=document.getElementById('scan-video');
  if(!v||!v.videoWidth) return;
  _scanOccupe=true;
  try{
    const w=Math.min(640,v.videoWidth), h=Math.round(v.videoHeight*w/v.videoWidth);
    const cv=document.createElement('canvas');
    cv.width=w; cv.height=h;
    const ctx=cv.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(v,0,0,w,h);
    const img=ctx.getImageData(0,0,w,h);
    const res=await mod.readBarcodesFromImageData(img,
      {formats:SCAN_FORMATS,tryHarder:true,maxNumberOfSymbols:1});
    if(res&&res.length&&res[0].text){
      const code=res[0].text;
      // LE MEME code, relu dans la seconde et demie : on l ignore. Le
      // code-barres reste dans le champ de la camera bien apres avoir ete
      // lu, et sans ce filtre la fiche precedente revient sans cesse.
      const t=Date.now();
      if(code===_scanDernierCode&&(t-_scanDernierT)<SCAN_DEBOUNCE) return;
      _scanDernierCode=code; _scanDernierT=t;
      scanArreter();
      // Le retour haptique CONFIRME, il n annonce pas : iOS ne l implemente
      // pas, et rien de ce qui compte ne doit reposer sur lui seul.
      try{ arcHaptique('succes'); }catch(e){}
      await scanTraiterCode(code);
      return;
    }
    if(++_scanEssais>=SCAN_MAX_ESSAIS){
      scanArreter();
      _scanDire('Code illisible. Éclairage, distance, ou code abîmé : saisis-le à la main.','var(--orange)');
      scanSaisieManuelle();
    }
  }catch(e){
    scanArreter();
    _scanDire('Le lecteur a échoué. Saisis le code à la main.','var(--orange)');
    scanSaisieManuelle();
  }finally{ _scanOccupe=false; }
}
// RÈGLE 2 : le flux est coupé par track.stop(). Appelée à la fermeture, au
// changement d'écran ET sur visibilitychange — trois portes, une seule
// fonction, pour qu'aucune ne puisse être oubliée.
function scanArreter(){
  // Couper la piste eteint physiquement la lampe ; le drapeau doit suivre,
  // sinon le bouton rouvrirait sur « Éteindre » au scan suivant.
  _scanTorche=false;
  if(_scanBoucle){ clearInterval(_scanBoucle); _scanBoucle=null; }
  if(_scanFlux){
    try{ _scanFlux.getTracks().forEach(t=>t.stop()); }catch(e){}
    _scanFlux=null;
  }
  const v=document.getElementById('scan-video');
  if(v){ try{ v.pause(); }catch(e){} v.srcObject=null; }
  _scanOccupe=false;
  return true;
}
// TOUT relacher : la camera ET le megaoctet de WebAssembly. La purge vivait
// dans scanFermer seulement, donc toute autre sortie de l ecran laissait le
// module en memoire — et c est par une autre sortie que passe le bouton
// « Photographier le tableau nutritionnel », qui charge ensuite Tesseract
// par-dessus. Le rechargement coute 336 ms mesurees, contre un onglet tue.
function scanLibererTout(){
  scanArreter();
  try{ if(_scanZX&&_scanZX.purgeZXingModule) _scanZX.purgeZXingModule(); }catch(e){}
  _scanZX=null;
  return true;
}
function scanFermer(){
  scanLibererTout();
  retourDe('s-scan');
}
// ── La saisie manuelle ────────────────────────────────────────────────────
function scanSaisieManuelle(){
  const z=document.getElementById('scan-manuel');
  if(!z) return false;
  if(document.getElementById('scan-ean')){
    document.getElementById('scan-ean').focus();
    return true;
  }
  z.innerHTML=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
    <label for="scan-ean" style="margin-top:0">Code-barres</label>
    <input id="scan-ean" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
      maxlength="${SCAN_EAN_MAX}" placeholder="${SCAN_EAN_MIN} à ${SCAN_EAN_MAX} chiffres"
      style="width:100%;box-sizing:border-box;font-size:var(--fs-lg);letter-spacing:2px;text-align:center"
      onkeydown="if(event.key==='Enter'){event.preventDefault();scanValiderManuel()}">
    <button class="btn btn-red" style="width:100%;margin-top:8px" onclick="scanValiderManuel()">Chercher ce produit</button>
    <div id="scan-manuel-etat" style="font-size:var(--fs-xs);line-height:1.6;margin-top:8px"></div>
  </div>`;
  const i=document.getElementById('scan-ean');
  if(i) i.focus();
  return true;
}
async function scanValiderManuel(){
  const i=document.getElementById('scan-ean');
  const e=document.getElementById('scan-manuel-etat');
  if(!i) return false;
  const v=scanEanValide(i.value);
  if(!v.ok){ if(e){ e.textContent=v.raison; e.style.color='var(--orange)'; } return false; }
  if(e){ e.textContent='Recherche…'; e.style.color='var(--sub)'; }
  return await scanTraiterCode(v.code,e);
}
// Le chemin commun : lu ou saisi, un code finit ICI.
async function scanTraiterCode(code,zone){
  const e=zone||document.getElementById('scan-etat');
  const dire=(m,c)=>{ if(e){ e.textContent=m; e.style.color=c||'var(--sub)'; } };
  // Un QR code lu ne porte pas forcement un code produit. Le dire ICI, avec
  // la marche a suivre, plutot que d envoyer une URL a Open Food Facts et de
  // rendre « produit introuvable » — qui serait faux et sans issue.
  const ex=scanExtraireCode(code);
  if(!ex.ok){
    if(e){
      e.innerHTML='<span style="color:var(--orange)">'+escapeHtml(ex.raison)+'</span>'
        +'<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="photographierEtiquette()">Photographier le tableau nutritionnel</button>';
    }
    return false;
  }
  code=ex.code;
  dire('Recherche du produit…');
  const r=await offParEAN(code);
  if(r.ok){
    scanArreter();
    try{ if(_scanZX&&_scanZX.purgeZXingModule) _scanZX.purgeZXingModule(); }catch(err){}
    _offResultats=[r.produit];
    selectOffFood(r.produit._off.ean);
    return true;
  }
  // RÈGLE 6 : inconnu ⇒ on le dit ET on propose la recherche par nom.
  if(r.inconnu){
    dire('');
    if(e) e.innerHTML=`<span style="color:var(--orange)">${escapeHtml(r.raison)}</span>
      <span style="color:var(--sub)"> Le code ${escapeHtml(r.code||code)} est valide, mais aucune fiche n'existe encore.</span>
      <button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="creerAlimentDepuisScan('${escapeHtml(r.code||code)}')">Créer cet aliment à la main</button>
      <button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="scanFermer()">Chercher par nom à la place</button>`;
    return false;
  }
  dire(r.raison,(r.quota||r.horsLigne)?'var(--sub)':'var(--orange)');
  if(!document.getElementById('scan-ean')) scanSaisieManuelle();
  return false;
}
// ── Le transport : DEUX appels, sur un geste ──────────────────────────────
// Jamais à la frappe. Le bouton est le seul déclencheur, et il se désarme le
// temps de l'appel.
let _offResultats=[];      // EN MÉMOIRE SEULEMENT — jamais écrit, jamais persisté
let _offEnCours=false;
function _offFetch(url,ms){
  // AbortController plutôt qu'une course de promesses : sans lui, la requête
  // continue en fond et consomme le quota d'une IP qu'on partage avec le
  // réseau mobile de l'athlète.
  const ctl=(typeof AbortController!=='undefined')?new AbortController():null;
  const t=setTimeout(()=>{ try{ ctl&&ctl.abort(); }catch(e){} },ms||OFF_TIMEOUT);
  return fetch(url,Object.assign({headers:{'Accept':'application/json'}},
    ctl?{signal:ctl.signal}:{})).finally(()=>clearTimeout(t));
}
async function offRecherche(terme){
  const q=String(terme||'').trim();
  if(q.length<2) return {ok:false,raison:'Tape au moins deux lettres.'};
  // RÈGLE 7 : hors ligne, on ne tente rien et on le dit. Ciqual, lui, continue
  // de fonctionner entièrement — il est en cache local.
  if(typeof navigator!=='undefined'&&navigator.onLine===false)
    return {ok:false,horsLigne:true,raison:'Hors ligne : les produits de marque demandent une connexion. La recherche Ciqual reste disponible.'};
  try{
    // (1) La recherche plein texte.
    const u1=OFF_URL_RECHERCHE+'?q='+encodeURIComponent(q)
      +'&page_size='+OFF_PAGE+'&langs=fr';
    const r1=await _offFetch(u1);
    if(r1.status===429) return {ok:false,quota:true,
      raison:'Open Food Facts limite le nombre de recherches par minute. Réessaie dans un instant.'};
    if(!r1.ok) return {ok:false,raison:'Open Food Facts est injoignable ('+r1.status+').'};
    // MESURÉ EN CONDITIONS RÉELLES : au-delà du quota, OFF ne répond pas
    // toujours 429 — il sert une PAGE HTML avec un statut 200. Sans cette
    // garde, `.json()` jette et l'athlète lit « erreur réseau » alors qu'il
    // n'a qu'à patienter une minute.
    const ct=String(r1.headers&&r1.headers.get&&r1.headers.get('content-type')||'');
    if(ct&&ct.indexOf('json')<0) return {ok:false,quota:true,
      raison:'Open Food Facts limite le nombre de recherches par minute. Réessaie dans un instant.'};
    const j1=await r1.json();
    const hits=(j1&&j1.hits)||[];
    if(!hits.length) return {ok:true,liste:[],rejetes:0};
    // (2) Marque, format et portion : l'index de recherche ne les porte pas.
    // Une seule requête pour toute la page, par liste de codes.
    const codes=hits.map(h=>h&&h.code).filter(Boolean).slice(0,OFF_PAGE);
    const u2=OFF_URL_DETAIL+'?code='+codes.join(',')
      +'&fields=code,product_name,product_name_fr,brands,quantity,serving_size,serving_quantity,nutrition_data_per,nutriments'
      +'&page_size='+(OFF_PAGE*2)+'&app_name='+OFF_APP+'&app_version='+OFF_APP_V;
    let detail={};
    try{
      const r2=await _offFetch(u2);
      if(r2.ok){
        const j2=await r2.json();
        for(const p of ((j2&&j2.products)||[])) if(p&&p.code) detail[p.code]=p;
      }
    }catch(e){ detail={}; }        // le détail manque : on garde la recherche
    const bruts=hits.map(h=>Object.assign({},h,detail[h.code]||{}));
    const l=[],rejets=[];
    for(const b of bruts){
      const a=offNormalise(b);
      if(!a) continue;
      const v=offValide(a);
      if(!v.ok){ rejets.push({nom:a.n,raison:v.raison}); continue; }
      l.push(a);
    }
    return {ok:true,liste:offDedoublonner(l),rejetes:rejets.length};
  }catch(e){
    if(e&&e.name==='AbortError')
      return {ok:false,raison:'Open Food Facts met trop de temps à répondre.'};
    return {ok:false,raison:'Recherche impossible : '+(e&&e.message||'erreur réseau')+'.'};
  }
}
// ── L'écran ───────────────────────────────────────────────────────────────
// RÈGLE 1 : Ciqual d'abord. Le bloc de marque se pose SOUS les résultats
// locaux, dans une section distincte et nommée.
function _offBoutonHtml(q){
  if(typeof navigator!=='undefined'&&navigator.onLine===false) return '';
  return `<div id="off-zone" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
    <button id="off-btn" class="btn btn-outline btn-sm" style="width:100%"
      onclick="offChercherUI()">Chercher un produit de marque</button>
    ${htmlScanBouton()}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">Un seul appel, quand tu le demandes. ${escapeHtml(OFF_ATTRIBUTION)}</div>
    <div id="off-results"></div>
  </div>`;
}
async function offChercherUI(){
  if(_offEnCours) return false;
  // `fj-search-input`, et non `fj-search` : le champ n'a jamais porté ce
  // second nom. getElementById rendait null, `q` valait la chaîne vide, et
  // offRecherche sortait sur son garde `q.length<2` — « Tape au moins deux
  // lettres. », quoi qu'on ait tapé. La recherche de produits de marque
  // n'a donc jamais pu aboutir.
  const q=((document.getElementById('fj-search-input')||{}).value||'').trim();
  const z=document.getElementById('off-results');
  const b=document.getElementById('off-btn');
  if(!z) return false;
  _offEnCours=true;
  if(b) arcAttendre(b,'Recherche…');
  const r=await offRecherche(q);
  _offEnCours=false;
  if(b) arcRendre(b,'Chercher un produit de marque');
  if(!r.ok){
    z.innerHTML=`<div style="font-size:var(--fs-xs);color:${r.quota||r.horsLigne?'var(--sub)':'var(--orange)'};line-height:1.6;margin-top:10px">${escapeHtml(r.raison)}</div>`;
    return false;
  }
  _offResultats=r.liste;
  if(!r.liste.length){
    z.innerHTML=`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-top:10px">Aucun produit de marque exploitable pour « ${escapeHtml(q)} »${r.rejetes?' ('+r.rejetes+' fiche'+(r.rejetes>1?'s':'')+' écartée'+(r.rejetes>1?'s':'')+', trop incomplète'+(r.rejetes>1?'s':'')+')':''}.</div>`;
    return true;
  }
  z.innerHTML=`<div style="margin-top:12px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:8px">Produits de marque : source Open Food Facts (donnée contributive)</div>
    ${r.liste.map(a=>_offResultHtml(a)).join('')}
    ${r.rejetes?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">${r.rejetes} fiche${r.rejetes>1?'s':''} écartée${r.rejetes>1?'s':''} : valeurs manquantes ou incohérentes.</div>`:''}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">${escapeHtml(OFF_ATTRIBUTION)}</div>
  </div>`;
  return true;
}
function _offResultHtml(a){
  const d=a._off||{};
  const detail=[d.marque,d.format].filter(Boolean).join(' · ');
  return `<div class="fj-result" onclick="selectOffFood('${escapeHtml(a._off.ean)}')" role="button" tabindex="0"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
    style="display:flex;align-items:center;gap:8px">
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml(a.n)}</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px;display:flex;gap:10px;align-items:center">
        <span style="color:var(--red-text);font-weight:700">${a.k} kcal/100g</span>
        ${detail?`<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(detail)}</span>`:''}
      </div>
    </div>
  </div>`;
}
// La sélection passe par le MÊME écran, le même formulaire de quantité, les
// mêmes repères. Seules deux choses diffèrent : l'épingle et les portions
// visuelles, qui s'appuient sur un identifiant Ciqual et un groupe d'aliment
// que ce produit n'a pas.
function selectOffFood(ean){
  const a=_offResultats.find(x=>x&&x._off&&x._off.ean===ean);
  if(!a) return false;
  const v=offValide(a);
  if(!v.ok){ toast(v.raison,'var(--orange)'); return false; }
  _fjFood=a;
  go('s-food-add');
  document.getElementById('fja-food-name').textContent=a.n;
  const _g=document.getElementById('fja-food-group');
  if(_g) _g.textContent=[a._off.marque,a._off.format].filter(Boolean).join(' · ')||'produit de marque';
  const _q=document.getElementById('fja-qty');
  // La portion déclarée par le fabricant, quand elle est lisible, vaut mieux
  // qu'un 100 g par défaut : c'est le pot entier que l'athlète mange.
  if(_q) _q.value=(a._off.portion>0&&a._off.portion<=1500)?Math.round(a._off.portion):100;
  if(!_fjRepasChoisi) _fjRepas=repasSelonHeure();
  document.querySelectorAll('.fj-repas-btn').forEach(b=>b.classList.toggle('active',b.dataset.repas===_fjRepas));
  // Pas d'épingle : les favoris sont une liste d'identifiants Ciqual, et y
  // ranger un produit OFF le rendrait irrésolvable au rechargement — en plus
  // de recopier de la donnée OFF dans le dossier, ce que l'ODbL interdit.
  const _ep=document.getElementById('fja-epingle-slot');
  if(_ep) _ep.innerHTML='';
  const _po=document.getElementById('fja-portions');
  if(_po) _po.innerHTML=`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">${escapeHtml(OFF_ATTRIBUTION)}</div>`;
  _majFjaFiabilite();
  _fjUnite='g';
  const _pu=document.getElementById('fja-unites-slot');
  if(_pu) _pu.innerHTML=_htmlUnites(_fjFood);
  updateFjaCalc();
  return true;
}
function onFjSearch(val){
  const el=document.getElementById('fj-results-list');
  if(!el) return;
  const q=(val||'').trim();
  if(q.length<2){el.innerHTML='';return;}
  if(!_ciqualDB){
    el.innerHTML='<div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:62%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:35%"></div></div><div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:78%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:45%"></div></div><div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:54%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:30%"></div></div><div class="fj-result" style="pointer-events:none"><div class="skeleton fx-loop" style="height:13px;width:70%;margin-bottom:8px"></div><div class="skeleton fx-loop" style="height:10px;width:42%"></div></div>';
    _loadCiqual().then(()=>onFjSearch(val));
    return;
  }
  if(ciqualIndisponible()){ el.innerHTML=_htmlCiqualIndispo(); _loadCiqual().then(()=>{ if(!ciqualIndisponible()) onFjSearch(val); }); return; }
  const {normQ,words}=_fjRequete(q);
  if(!words.length){el.innerHTML='';return;}
  // Pas de coupe AVANT le classement : « Oeuf cru » est le 124e nom
  // contenant « oeuf » dans l ordre de la table. Le plafonner a 80 revenait a
  // classer un echantillon arbitraire. On classe tout, on coupe apres.
  // AU SINGULIER COMME AU PLURIEL. Les noms Ciqual sont au singulier :
  // « tomates » ne retenait que les 4 entrées portant elles-mêmes un « s », sur
  // 57. Quatre résultats donnent l'illusion d'avoir cherché — on en conclut
  // que l'aliment n'est pas dans la table.
  const res=_ciqualDB.filter(f=>_fjCorrespond(f,words));
  document.getElementById('fj-recent-section').innerHTML='';
  // LOT R1 : les recettes (les miennes, puis celles du coach) passent devant tout.
  const _rcH=htmlRecettesRecherche(words);
  if(!res.length){el.innerHTML=(_rcH||'<div style="padding:20px;text-align:center;color:var(--sub);font-size:var(--fs-sm)">Aucun résultat pour "'+escapeHtml(q)+'"</div>')+_offBoutonHtml(q);return;}
  const scored=_classerAliments(res,normQ,words);
  // Les aliments perso passent DEVANT : l athlete les a crees precisement
  // parce que la table ne repondait pas. Ils sont classes entre eux par la
  // meme regle, pour que « poulet maison » batte « sauce poulet maison ».
  // Même règle pour les aliments perso et ceux du coach : une seule fonction
  // décide, sinon la table et les listes personnelles répondraient différemment
  // à la même frappe.
  const filtre=l=>l.filter(a=>a&&_fjCorrespond({s:String(a.s||''),a:a.a},words));
  const mp=_classerAliments(filtre(_alimsPerso()),normQ,words);
  // ORDRE : ce que l athlete a cree, puis ce que SON COACH a cree, puis la
  // table Ciqual, puis les produits de marque. Le plus specifique d abord :
  // un aliment saisi l a ete parce que rien d autre ne convenait.
  const mc=_classerAliments(filtre(_alimentsDuCoach()),normQ,words);
  // ⚠ LES QUATRE LISTES PASSENT PAR LE MEME FILTRE, et par lui seul. Les
  // aliments perso et ceux du coach n'y echappent pas : une arachide entree a
  // la main reste une arachide.
  const _trP=evictionTrier(currentUser,mp.map(x=>x.f));
  const _trC=evictionTrier(currentUser,mc.map(x=>x.f));
  const _trT=evictionTrier(currentUser,scored.slice(0,50).map(x=>x.f));
  // LES RELEGUES EN FIN DE LISTE, une seule fois, tous ensemble. Les eparpiller
  // au bas de chaque section les rendrait invisibles.
  const _releg=_trP.releguees.concat(_trC.releguees,_trT.releguees);
  el.innerHTML=_rcH+(_trP.liste.length?_fjTitreSection('Mes aliments')+_trP.liste.map(f=>_htmlPersoResult(f)).join(''):'')
    +(_trC.liste.length?_fjTitreSection('Aliments de ton coach')+_trC.liste.map(f=>_htmlCoachResult(f)).join(''):'')
    +((_rcH||_trP.liste.length||_trC.liste.length)&&_trT.liste.length?_fjTitreSection('Table Ciqual'):'')
    +_trT.liste.map(f=>_fjResultHtml(f,false,_fjAliasVia(f,words)?q:null)).join('')
    +_htmlRelegues(_releg)
    +_offBoutonHtml(q);
}

// Trois paliers, ceux de la specification : vert au-dessus de 80, orange
// entre 50 et 79, rouge en dessous. La couleur RESUME, le texte informe.
function _fiabPalier(n){
  if(n==null) return {c:'var(--sub)',bg:'#111',bord:'var(--border)',lib:'Fiabilité inconnue'};
  if(n>=80) return {c:'var(--green)',bg:'rgba(34,197,94,.08)',bord:'rgba(34,197,94,.35)',lib:'Donnée fiable'};
  if(n>=NUTRI_SEUIL_CONFIRME) return {c:'var(--orange)',bg:'rgba(234,140,20,.08)',bord:'rgba(234,140,20,.35)',lib:'Donnée à vérifier'};
  return {c:'var(--red)',bg:'var(--red-bg)',bord:'rgba(224,32,32,.4)',lib:'Donnée peu sûre'};
}
// Rend le bloc de fiabilite pour un aliment. Rien pour Ciqual : afficher
// « fiable à 100 » sur chacun des 3 484 aliments mesures en laboratoire
// serait du bruit, et le bruit finit par masquer le signal quand il compte.
function _htmlFiabilite(a){
  if(!a) return '';
  let r;
  try{ r=nutriControle(a); }catch(e){ return ''; }
  const src=nutriSource(a);
  if(src===NUTRI_SOURCES.CIQUAL&&!r.alertes.length) return '';
  const pal=_fiabPalier(r.fiabilite);
  const alertes=r.alertes.length
    ?'<ul style="margin:8px 0 0;padding-left:16px;font-size:var(--fs-xs);line-height:1.6;color:var(--text-strong)">'
      +r.alertes.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ul>'
    :'';
  return `<div style="background:${pal.bg};border:1px solid ${pal.bord};border-radius:var(--r-3);padding:10px 12px">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:.5px;color:${pal.c}">${escapeHtml(pal.lib)}</span>
      <span style="flex:1;height:1px;background:${pal.bord}"></span>
      <span style="font-size:var(--fs-xs);font-weight:800;color:${pal.c}">${r.fiabilite==null?'-':r.fiabilite+' / 100'}</span>
    </div>
    ${alertes}
    ${r.fiabilite!=null&&r.fiabilite<NUTRI_SEUIL_CONFIRME
      ?`<div style="font-size:var(--fs-xs);line-height:1.6;color:var(--text-dim);margin-top:8px">Cette fiche est trop incomplète pour être ajoutée sans que tu la confirmes.</div>`
      :''}
  </div>`;
}
// Pose le bloc sur l ecran de quantite. Appele par les TROIS provenances :
// oublier un seul appelant laisserait une fiche muette, et une fiche muette
// se lit comme une fiche sûre.
function _majFjaFiabilite(){
  const z=document.getElementById('fja-fiabilite');
  if(z) z.innerHTML=_htmlFiabilite(_fjFood);
}
function selectFjFood(id){
  if(!_ciqualDB) return;
  _fjFood=_ciqualDB.find(f=>f.id===id);
  if(!_fjFood) return;
  go('s-food-add');
  document.getElementById('fja-food-name').textContent=_fjFood.n;
  document.getElementById('fja-food-group').textContent=_fjFood.g||'';
  document.getElementById('fja-qty').value=100;
  // Le dernier repas choisi tient pour toute la session ; sans choix, on le
  // déduit de l'heure. Forcer « Matin » obligeait à re-sélectionner à chaque
  // aliment, y compris pour trois aliments d'affilée au même dîner.
  if(!_fjRepasChoisi) _fjRepas=repasSelonHeure();
  document.querySelectorAll('.fj-repas-btn').forEach(b=>b.classList.toggle('active',b.dataset.repas===_fjRepas));
  // Un favori rouvre sur la quantité réellement utilisée la dernière fois.
  const _q=document.getElementById('fja-qty');
  if(_q&&estFavori(_fjFood.id)){ const d=_fjDerniereQty(_fjFood.id); if(d>0) _q.value=d; }
  const _ep=document.getElementById('fja-epingle-slot');
  if(_ep) _ep.innerHTML=_htmlEpingle(_fjFood.id,true);
  const _po=document.getElementById('fja-portions');
  if(_po) _po.innerHTML=_htmlPortions(_fjFood);
  _majFjaFiabilite();
  // Unites naturelles. Le selecteur est REMIS A ZERO a chaque aliment : une
  // unite d oeuf laissee active sur une carotte n aurait aucun sens.
  _fjUnite='g';
  const _pu=document.getElementById('fja-unites-slot');
  if(_pu) _pu.innerHTML=_htmlUnites(_fjFood);
  updateFjaCalc();
}

function selectRepas(r){
  _fjRepas=r;
  _fjRepasChoisi=true;
  document.querySelectorAll('.fj-repas-btn').forEach(b=>b.classList.toggle('active',b.dataset.repas===r));
}

function stepFjaQty(delta){
  const inp=document.getElementById('fja-qty');
  if(!inp) return;
  inp.value=Math.max(1,Math.min(9999,(parseFloat(inp.value)||0)+delta));
  updateFjaCalc();
}

function setFjaQty(v){
  const inp=document.getElementById('fja-qty');
  if(inp){inp.value=v;updateFjaCalc();}
}

function updateFjaCalc(){
  const f=_fjFood;if(!f) return;
  const qty=parseFloat(document.getElementById('fja-qty')?.value)||0;
  const el=document.getElementById('fja-calc');
  if(!el) return;
  if(qty<=0||qty>9999){el.innerHTML='';return;}
  const r=qty/100;
  const kcal=kcalPortion(f,r).kcal;
  const p=f.p!=null?parseFloat((f.p*r).toFixed(1)):null;
  const c=f.c!=null?parseFloat((f.c*r).toFixed(1)):null;
  const l=f.l!=null?parseFloat((f.l*r).toFixed(1)):null;
  const sel=f.e!=null?parseFloat((f.e*r).toFixed(2)):null;
  el.innerHTML=`<div style="background:var(--dark);border:1px solid var(--surface-2);border-radius:var(--r-3);padding:14px;display:flex;justify-content:space-around;text-align:center">
    <div><div class="txt-stat" style="color:var(--red-text);line-height:1">${kcal??'-'}</div><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-top:2px">KCAL</div></div>
    <div><div class="txt-stat" style="line-height:1">${p??'-'}</div><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-top:2px">PROT g</div></div>
    <div><div class="txt-stat" style="line-height:1">${c??'-'}</div><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-top:2px">GLUC g</div></div>
    <div><div class="txt-stat" style="line-height:1">${l??'-'}</div><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-top:2px">LIP g</div></div>
    <div><div class="txt-stat" style="line-height:1">${sel??'-'}</div><div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-top:2px">SEL g</div></div>
  </div>`;
}



// ══ LA PHOTO DU REPAS (05/10/2026) ══════════════════════════════════════════
// Dans l'ajout d'aliment : une photo de l'assiette, et l'assistant (ia.js,
// tâche 'repas', Haiku 4.5) propose une liste d'aliments et de grammes.
// ⚠ LES CALORIES VIENNENT DE CIQUAL, JAMAIS DE L'ASSISTANT. Chaque nom proposé
//   passe par la recherche locale (_classerAliments) : le premier résultat de
//   la table est retenu, sinon la ligne reste « à choisir » et ne s'enregistre pas.
// ⚠ RIEN N'EST ÉCRIT AVANT « Ajouter ces aliments ». Ensuite, les entrées sont
//   celles d'une saisie manuelle (_eqConstruireEntree), avec source:'photo'.
// ⚠ LA PHOTO NE FAIT QUE PASSER : réduite sur l'appareil (1 024 px, JPEG 0,8),
//   envoyée au serveur, oubliée. Ni Cloudinary, ni la base, ni le dossier.
// ⚠ JAMAIS POUR UN PROFIL TCA, et seulement avec Ultime, ou chez un coach dont
//   l'offre est Coach ou Pro (le serveur refait le même contrôle).
const REPAS_PHOTO_PX=1024, REPAS_PHOTO_QUALITE=0.8;
const REPAS_MOTS_VIDES=Object.freeze(['de','du','des','la','le','les','au','aux','en','et','un','une','a']);
/** PURE (le cache local des droits). La photo du repas est-elle proposée ? */
function repasPhotoOuvert(u){
  if(!u||u.role==='coach') return false;
  try{ if(aTCA(u)) return false; }catch(e){ return false; }
  let p='aucun'; try{ p=palierDe(u); }catch(e){ p='aucun'; }
  if(p==='ultime') return true;
  if(estAutonome(u)) return false;
  let d=null; try{ d=droitsDe(u); }catch(e){ d=null; }
  return !!(d&&d.couvertJusqu>Date.now()&&(d.planCoach==='coach'||d.planCoach==='pro'));
}
/** PURE. Le premier aliment CIQUAL pour un nom proposé, ou null. Les mots vides
 *  (« de », « au »…) sont retirés si la requête entière ne trouve rien. */
function alimentPourNomRepas(nom,db,user){
  const l=Array.isArray(db)?db:[];
  const chercher=words=>{
    if(!words.length) return null;
    const res=l.filter(f=>_fjCorrespond(f,words));
    if(!res.length) return null;
    const cl=_classerAliments(res,words.join(' '),words).map(x=>x.f);
    let tr=null; try{ tr=evictionTrier(user,cl); }catch(e){ tr=null; }
    return (tr&&tr.liste&&tr.liste[0])||cl[0]||null;
  };
  const words=_fjNorm(String(nom||'')).split(/[\s,']+/).filter(w=>w.length>1);
  return chercher(words)||chercher(words.filter(w=>REPAS_MOTS_VIDES.indexOf(w)<0));
}
/** PURE. Les lignes à confirmer : {nomLu, grammes, confiance, f} — f null : « à choisir ». */
function lignesRepasPhoto(proposition,db,user){
  const al=(proposition&&Array.isArray(proposition.aliments))?proposition.aliments:[];
  return al.slice(0,8).filter(a=>a&&a.nom).map(a=>({nomLu:String(a.nom),grammes:Math.max(0,Math.round(Number(a.grammes)||0)),
    confiance:Math.max(0,Math.min(1,Number(a.confiance)||0)),f:alimentPourNomRepas(a.nom,db,user)}));
}
/** PURE. Les entrées de journal des lignes CHOISIES et pesées ; les autres sont laissées. */
function entreesRepasPhoto(lignes,repas){
  const t=Date.now();
  return (lignes||[]).filter(l=>l&&l.f&&Number(l.grammes)>0&&Number(l.grammes)<=9999)
    .map((l,i)=>Object.assign(_eqConstruireEntree(l.f,Number(l.grammes),repas,t+i),{source:'photo'}));
}
let _photoRepas=null;
function ouvrirPhotoRepas(){
  if(!repasPhotoOuvert(currentUser)) return false;
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.setAttribute('capture','environment'); inp.style.display='none';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; inp.remove(); if(f) _photoRepasFichier(f); };
  document.body.appendChild(inp);
  inp.click();
  return true;
}
// La réduction, sur l'appareil : compressImage (canvas), rien d'autre.
function _reduirePhotoRepas(file){
  return new Promise((res,rej)=>compressImage(file,REPAS_PHOTO_PX,REPAS_PHOTO_QUALITE,res,()=>rej(new Error('photo illisible'))));
}
async function _photoRepasFichier(file){
  const b=document.getElementById('fj-photo-repas');
  if(b&&b.getAttribute('aria-busy')==='true') return false;
  let url='';
  try{ url=await _reduirePhotoRepas(file); }catch(e){ toast('Photo illisible : réessaie.','var(--orange)'); return false; }
  const m=/^data:image\/jpeg;base64,(.+)$/.exec(String(url));
  if(!m){ toast('Photo illisible : réessaie.','var(--orange)'); return false; }
  if(b){ b.setAttribute('aria-busy','true'); b.disabled=true; b.textContent='Lecture de la photo…'; }
  try{ return await analyserPhotoRepas({media_type:'image/jpeg',data:m[1]}); }
  finally{ try{ _renderFjActions(); }catch(e){} }
}
async function analyserPhotoRepas(image){
  if(!CLOUD||!CLOUD._callFn){ toast('L’assistant n’est pas joignable pour le moment.','var(--orange)'); return false; }
  let r=null, statut=0;
  try{ r=await CLOUD._callFn('ia',{tache:'repas',charge:{image}}); }
  catch(e){ r=null; statut=(e&&e.statut)||0; }
  if(!r||!r.ok||!r.proposition){
    toast(statut===429?'Plus de photos de repas ce mois-ci : la saisie reste ouverte.'
      :statut===503?'L’assistant est en pause : saisis ton repas à la main.'
      :'La photo n’a pas pu être lue : saisis ton repas à la main.','var(--orange)');
    return false;
  }
  if(!_ciqualDB||!_ciqualDB.length) await _loadCiqual();
  const lignes=lignesRepasPhoto(r.proposition,_ciqualDB,currentUser);
  if(!lignes.length){ toast('Aucun aliment reconnu sur cette photo.','var(--orange)'); return false; }
  _photoRepas={lignes,remarque:typeof r.proposition.remarque==='string'?r.proposition.remarque:null,cherche:-1};
  _rendrePhotoRepas(true);
  return true;
}
function _htmlPhotoRepas(x){
  const E=escapeHtml;
  const lignes=x.lignes.map((l,i)=>{
    if(!l) return '';
    const choix=l.f?'<div class="prp-nom">'+E(l.f.n)+'</div><div class="prp-lu">Vu : '+E(l.nomLu)+'</div>'
      :'<div class="prp-nom prp-a-choisir">À choisir</div><div class="prp-lu">Vu : '+E(l.nomLu)+' — introuvable dans la table</div>';
    const rech=x.cherche===i?'<input type="search" class="prp-rech" id="prp-rech" placeholder="Chercher un aliment" aria-label="Chercher un aliment" oninput="photoRepasChercher(this.value)">'
      +'<div id="prp-res"></div>':'';
    return '<div class="prp-l" id="prp-l-'+i+'"><div class="prp-c">'+choix+rech+'</div>'
      +'<label class="prp-g">Grammes<input type="number" min="1" max="9999" inputmode="numeric" id="prp-g-'+i+'" value="'+(l.grammes||'')+'" oninput="photoRepasGrammes('+i+',this.value)"></label>'
      +'<div class="prp-act"><button type="button" class="rb-lien" onclick="photoRepasRemplacer('+i+')">'+(l.f?'Remplacer':'Choisir')+'</button>'
      +'<button type="button" class="rb-lien" onclick="photoRepasRetirer('+i+')">Retirer</button></div></div>';
  }).join('');
  const n=x.lignes.filter(l=>l&&l.f&&l.grammes>0).length;
  return lignes+(x.remarque?'<div class="prp-rq">'+E(x.remarque)+'</div>':'')
    +'<p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin:10px 0 0">Les quantités sont estimées sur la photo : corrige-les. Les calories viennent de la table Ciqual. Une ligne « à choisir » n’est pas ajoutée.</p>'
    +'<button class="btn btn-red" style="margin-top:14px;width:100%" onclick="ajouterPhotoRepas()"'+(n?'':' disabled')+'>Ajouter ces aliments'+(n?' ('+n+')':'')+'</button>'
    +'<button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="fermerPhotoRepas()">Annuler</button>';
}
function _rendrePhotoRepas(ouvrir){
  const x=_photoRepas; if(!x) return false;
  if(ouvrir){
    document.body.insertAdjacentHTML('beforeend',`<div id="modal-overlay" onclick="fermerPhotoRepas()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:520px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">Ton repas en photo</h2>
    <div id="prp-corps"></div>
  </div></div>`);
  }
  const z=document.getElementById('prp-corps');
  if(z) z.innerHTML=_htmlPhotoRepas(x);
  return true;
}
function photoRepasGrammes(i,v){
  const l=_photoRepas&&_photoRepas.lignes[i]; if(!l) return;
  l.grammes=Math.max(0,Math.round(Number(v)||0));
  const n=_photoRepas.lignes.filter(x=>x&&x.f&&x.grammes>0).length;
  const b=document.querySelector('#prp-corps .btn-red');
  if(b){ b.disabled=!n; b.textContent='Ajouter ces aliments'+(n?' ('+n+')':''); }
}
function photoRepasRetirer(i){ if(!_photoRepas) return; _photoRepas.lignes[i]=null; _photoRepas.cherche=-1; _rendrePhotoRepas(false); }
function photoRepasRemplacer(i){
  if(!_photoRepas) return;
  _photoRepas.cherche=_photoRepas.cherche===i?-1:i;
  _rendrePhotoRepas(false);
  const r=document.getElementById('prp-rech'); if(r) r.focus();
}
function photoRepasChercher(q){
  const z=document.getElementById('prp-res'); if(!z||!_photoRepas) return;
  const words=_fjNorm(String(q||'')).split(/\s+/).filter(w=>w.length>1);
  if(!words.length){ z.innerHTML=''; return; }
  const res=(_ciqualDB||[]).filter(f=>_fjCorrespond(f,words));
  _photoRepas.res=_classerAliments(res,words.join(' '),words).slice(0,6).map(x=>x.f);
  z.innerHTML=_photoRepas.res.map((f,k)=>'<button type="button" class="prp-r" onclick="photoRepasPrendre('+k+')">'+escapeHtml(f.n)+'</button>').join('')
    ||'<div class="prp-lu">Aucun résultat.</div>';
}
function photoRepasPrendre(k){
  const x=_photoRepas; if(!x||x.cherche<0) return;
  const f=(x.res||[])[k], l=x.lignes[x.cherche];
  if(!f||!l) return;
  l.f=f; x.cherche=-1; x.res=null;
  _rendrePhotoRepas(false);
}
function fermerPhotoRepas(){ _photoRepas=null; closeModal(); return true; }
function ajouterPhotoRepas(){
  const x=_photoRepas; if(!x) return false;
  const date=_fjDate||localISODate(new Date());
  const repas=(typeof _fjRepas!=='undefined'&&_fjRepas)||'matin';
  const es=entreesRepasPhoto(x.lignes,repas);
  if(!es.length){ toast('Choisis au moins un aliment, avec sa quantité.','var(--orange)'); return false; }
  const ok=_fjAjouter(_fjCopier(es,date,repas),date,'Photo du repas');
  _photoRepas=null;
  closeModal();
  if(ok) toast(es.length+' aliment'+(es.length>1?'s':'')+' ajouté'+(es.length>1?'s':'')+' à ton journal','var(--green)');
  return ok;
}
