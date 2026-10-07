// ══ LOT T6 : LES AMPLITUDES RESSORTENT (29/09/2026) ══════════════════════
// Trois usages des quatre tests : un échauffement ciblé proposé à l'athlète,
// une courbe dans le temps sur la fiche du coach, et la relance d'un test
// jamais fait là où la morpho se lit.
//
// ⚠ AUCUN PROPOS MÉDICAL. Le test dit qu'il manque de l'amplitude, pas
//   pourquoi : ni cause, ni raideur, ni blessure, ni posture à corriger. Une
//   mobilisation est une PRÉPARATION à la séance du jour, proposée, jamais
//   imposée, et l'athlète la passe d'un geste.
// ⚠ LES SEUILS SONT CEUX DE LA LECTURE MORPHO (morphoAxes), pas de nouveaux :
//   cheville sous 10 cm au mur, hanche en butée nette, bras qui ne touchent
//   pas le mur sans décoller les lombaires, dos qui s'enroule par le bas.
// ⚠ LE LIEN TEST → MOUVEMENT n'est pas une table de plus : ce sont les schémas
//   des aménagements des fiches qui portent ce test dans leur signature (P9 la
//   cheville, P10 la hanche, P11 l'épaule, P12 la chaîne postérieure).
const AMP_RAPPEL_J=84;               // douze semaines : le rappel sur la fiche
const AMP_HISTO_MAX=12;              // relevés gardés par test, en plus du dernier
const AMP_MOBILISATIONS=Object.freeze({
  cheville:Object.freeze(['Mobilité de cheville en fente, genou vers le mur, 2×10 par côté',
    'Goblet squat avec pause en bas, talons au sol, 2×8',
    'Montées sur pointes lentes, 2×12']),
  hanche:Object.freeze(['90/90 hanches, 2×8',
    'Genou vers la poitrine allongé, 2×10 par côté',
    'Fente basse, buste droit, 2×30 s par côté']),
  epaule:Object.freeze(['Glissés au mur, bras en W puis en Y, 2×10',
    'Bâton tenu large, bras tendus au-dessus de la tête, 2×10',
    'Écartés à l’élastique, 2×15']),
  posterieur:Object.freeze(['Cat-cow, 10',
    'Charnière de hanche au bâton, 2×10',
    'Soulevé de terre roumain barre à vide, 2×10'])
});
const AMP_ZONE=Object.freeze({cheville:'la cheville',hanche:'la hanche',epaule:'l’épaule',posterieur:'l’arrière des jambes'});
// PURE. Le test est-il sous son repère ? true, false, ou null (pas fait, ou
// rien qui se compare). Les mêmes seuils que morphoAxes.
function ampSousRepere(cle,v){
  if(!v||typeof v!=='object') return null;
  // Le côté le plus limité (ampCotes) ; et la hanche n'est « sous son repère »
  // que si la butée nette arrive avant la fin d'une flexion normale.
  if(cle==='cheville'){ const q=ampPire(ampCotes('cheville',v)); return q!=null?q<10:null; }
  if(cle==='hanche'){
    if(v.butee==='elastique') return false;
    if(v.butee!=='nette') return null;
    const fl=ampPire(ampCotes('hanche',v));
    return fl==null||fl<HANCHE_FLEXION_BUTEE_PRECOCE;
  }
  if(cle==='epaule') return (v.mur==='non')?true:((v.mur==='oui')?false:null);
  if(cle==='posterieur') return v.niveau?(v.niveau==='bas'):null;
  return null;
}
// PURE. Les schémas qu'un test concerne, tirés des fiches.
function ampSchemas(cle){
  const s=new Set();
  for(const p of MORPHO_PROFILS){
    const vise=(p.signature||[]).some(c=>(cle==='cheville'&&c.axe==='A7')||(c.axe==='A8'&&c.facette===cle));
    if(vise) (p.amenager||[]).forEach(a=>{ if(a&&a.schema) s.add(a.schema); });
  }
  return [...s];
}
/**
 * PURE. Les mobilisations du jour, ou null. Un test fait, non périmé, sous
 * son repère, ET un mouvement de la séance qui le demande. Le premier test
 * qui répond, dans l'ordre des tests ; ses trois mobilisations.
 * @param morphoTests  u.morphoTests
 * @param exercices    les exercices de la séance du jour
 * @param opts {maintenant, schemaDe}
 */
function mobilisationsDuJour(morphoTests,exercices,opts){
  const o=opts||{}, now=Number(o.maintenant)||Date.now();
  const sch=(typeof o.schemaDe==='function')?o.schemaDe:(ex=>schemaDe(ex));
  const t=(morphoTests&&typeof morphoTests==='object')?morphoTests:{};
  const presents=new Set();
  for(const ex of (Array.isArray(exercices)?exercices:[])){ let k=null; try{ k=sch(ex); }catch(e){ k=null; } if(k) presents.add(k); }
  if(!presents.size) return null;
  for(const d of MORPHO_TESTS){
    const v=t[d.cle];
    const date=v&&Number(v.date)>0?Number(v.date):0;
    if(!date||(now-date)>MORPHO_PEREMPTION_J*864e5) continue;
    if(ampSousRepere(d.cle,v)!==true) continue;
    if(!ampSchemas(d.cle).some(s=>presents.has(s))) continue;
    return {test:d.cle,zone:AMP_ZONE[d.cle],mobilisations:AMP_MOBILISATIONS[d.cle].slice(0,3)};
  }
  return null;
}
// L'accueil : une ligne, « Voir », et la croix (masquée pour la journée).
function _htmlMobilisationAccueil(u,maintenant){
  if(!u||u.role==='coach') return '';
  if(accueilMasque('mob')) return '';
  let s=null; try{ s=seancePrevueDuJour(u,maintenant); }catch(e){ s=null; }
  if(!s) return '';
  const m=mobilisationsDuJour(u.morphoTests,s.exercises||[],{maintenant});
  if(!m) return '';
  return '<div class="mob-carte" data-acc>'+_accX('mob')
    +'<div class="mob-l">Ta séance du jour demande de l’amplitude à '+escapeHtml(m.zone)
    +' : '+m.mobilisations.length+' mobilisations pour t’y préparer, cinq minutes.</div>'
    +'<button type="button" class="btn btn-outline btn-sm mob-voir" onclick="voirMobilisations()">Voir</button></div>';
}
function _rendreMobilisation(u){
  const z=document.getElementById('clh-mobilisation');
  if(!z) return false;
  let h=''; try{ h=_htmlMobilisationAccueil(u,Date.now()); }catch(e){ h=''; }
  z.innerHTML=h;
  z.style.display=h?'':'none';
  return !!h;
}
function voirMobilisations(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  let s=null; try{ s=seancePrevueDuJour(u); }catch(e){ s=null; }
  const m=s?mobilisationsDuJour(u.morphoTests,s.exercises||[]):null;
  if(!m) return false;
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Avant ta séance" class="mob-feuille">'
    +'<h2>Avant ta séance</h2><p class="mob-s">Trois mouvements pour préparer '+escapeHtml(m.zone)+'. Une préparation, pas une obligation : fais-les avant ta première série, ou passe directement à la séance.</p>'
    +'<ol class="mob-liste">'+m.mobilisations.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ol>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="closeModal()">Fermer</button></div></div>');
  return true;
}
// ── LA COURBE ─────────────────────────────────────────────────────────────
// PURE. La valeur tracée d'un relevé : les cm au mur, les degrés, la moyenne
// des deux côtés à l'épaule, et le niveau d'enroulement (1 bas, 2 milieu,
// 3 haut du dos) pour la chaîne postérieure. null si rien ne se trace.
function ampValeur(cle,v){
  if(!v||typeof v!=='object') return null;
  const n=x=>{ const q=parseFloat(String(x==null?'':x).replace(',','.')); return isFinite(q)?q:null; };
  if(cle==='cheville'||cle==='hanche') return ampPire(ampCotes(cle,v));
  if(cle==='epaule'){ const g=n(v.g), d=n(v.d); return (g==null&&d==null)?null:(g!=null&&d!=null?(g+d)/2:(g!=null?g:d)); }
  if(cle==='posterieur') return ({bas:1,milieu:2,haut:3})[v.niveau]||null;
  return null;
}
/**
 * PURE. Les points d'un test dans le temps : les relevés d'avant (histo) et le
 * dernier, triés par date. Seulement des MESURES : aucun point n'est ajouté
 * entre deux relevés, même six mois plus tard.
 */
function ampPoints(morphoTests,cle){
  const t=(morphoTests&&typeof morphoTests==='object')?morphoTests[cle]:null;
  if(!t) return [];
  const l=(Array.isArray(t.histo)?t.histo:[]).concat([t]);
  const vus=new Set();
  return l.map(x=>({x:Number(x&&x.date)||0,v:ampValeur(cle,x)}))
    .filter(p=>p.x>0&&p.v!=null&&!vus.has(p.x)&&vus.add(p.x))
    .sort((a,b)=>a.x-b.x);
}
// La carte du tableau « Ses courbes » : même forme que les mensurations.
function _dbCarteAmplitudes(u,W){
  const mt=u&&u.morphoTests;
  const unites={cheville:' cm',hanche:'°',epaule:' cm'};
  const tr=MORPHO_TESTS.map(d=>({d,pts:ampPoints(mt,d.cle)})).filter(x=>x.pts.length);
  if(!tr.length) return '';
  const info=_dbInfo('am','Les quatre tests d’amplitude, relevés par le coach. Chaque point est un relevé ; rien n’est tracé entre deux relevés qui n’ait été mesuré. Épaule : moyenne des deux côtés.');
  const corps=tr.map(x=>{
    const lib=x.d.lib;
    if(x.pts.length<2) return '<div class="db-am"><b>'+escapeHtml(lib)+'</b>'+_dbVide('Un seul relevé, le '+new Date(x.pts[0].x).toLocaleDateString('fr-FR')+' : il en faut deux pour tracer une courbe.')+'</div>';
    const fmt=x.d.cle==='posterieur'?(v=>({1:'bas du dos',2:'milieu du dos',3:'haut du dos'})[Math.round(v)]||''):(v=>_dbNb(v,0)+(unites[x.d.cle]||''));
    return '<div class="db-am"><b>'+escapeHtml(lib)+'</b>'
      +_dbCourbe({id:'db-am-'+x.d.cle,titre:lib,W,H:110,series:[{lib,couleur:ROUGE_MARQUE_MIN,points:x.pts,aire:false,fmt}],fmtG:fmt})+'</div>';
  }).join('');
  return _dbCarte('db-c-am','Amplitudes',info,'',corps);
}
// ── LA FICHE : le dernier relevé, le rappel, la relance ──────────────────
// PURE. Le dernier relevé, tous tests confondus, et le rappel à douze semaines.
function ampDernierReleve(morphoTests,maintenant){
  const now=Number(maintenant)||Date.now();
  const t=(morphoTests&&typeof morphoTests==='object')?morphoTests:{};
  let der=0;
  for(const d of MORPHO_TESTS){ const x=Number(t[d.cle]&&t[d.cle].date)||0; if(x>der) der=x; }
  if(!der) return null;
  const jours=Math.floor((now-der)/864e5);
  return {date:der,jours,rappel:jours>AMP_RAPPEL_J,semaines:Math.floor(jours/7)};
}
// PURE. Ce qu'un test jamais fait empêche de lire, en une phrase, ou ''.
function relanceAmplitudes(morphoTests){
  const t=(morphoTests&&typeof morphoTests==='object')?morphoTests:{};
  const jamais=MORPHO_TESTS.filter(d=>!(t[d.cle]&&Number(t[d.cle].date)>0));
  if(!jamais.length) return '';
  const libs=jamais.map(d=>d.lib.split(/[,:]/)[0].trim().toLowerCase());
  // LE NOMBRE DE FICHES, PAS LEURS NOMS : un nom de fiche est écrit pour le
  // coach qui la lit en entier (« … raide : le faux mauvais tireur »), pas pour
  // une phrase de relance, qui doit rester sans aucun mot de ce registre.
  const n=MORPHO_PROFILS.filter(p=>(p.signature||[]).some(c=>jamais.some(d=>(d.cle==='cheville'&&c.axe==='A7')||(c.axe==='A8'&&c.facette===d.cle)))).length;
  return (jamais.length>1?'Tests jamais faits : ':'Test jamais fait : ')+libs.join(', ')
    +'. Sans '+(jamais.length>1?'eux':'lui')+', la lecture fonctionnelle reste incomplète'
    +(n?' ('+n+' fiche'+(n>1?'s':'')+' ne peu'+(n>1?'vent':'t')+' pas sortir)':'')
    +', et les leviers se lisent sans savoir si l’amplitude suit.';
}
function renderCoachAmplitudesSection(c){
  const el=document.getElementById('ccd-amplitudes');
  if(!el) return;
  const l=(function(){ try{ return testsMorpho(c); }catch(e){ return []; } })();
  const faits=l.filter(t=>t.date&&t.texte);
  const email=String((c&&c.email)||'');
  const ligne=t=>`<div style="border-left:2px solid var(--border);padding-left:12px;margin-bottom:10px">`
    +`<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;color:#bbb;text-transform:uppercase;margin-bottom:4px">${escapeHtml(t.lib)}</div>`
    +`<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(t.texte)}</div>`
    +`<div style="font-size:var(--fs-xs);color:${t.perime?'var(--orange)':'var(--text-faint)'};line-height:1.5">`
    +`test, ${dateLocaleDeCle(t.date).toLocaleDateString('fr-FR')}${t.perime?' · périmé, à refaire':''}</div></div>`;
  // CE QU'IL RESTERAIT À MESURER. Une sortie de première classe, et la
  // seule qui soit toujours actionnable : « il manque la hauteur de genou
  // pour savoir si ses jambes longues viennent du fémur ou du tibia ».
  const manque=(function(){ try{
    return morphoProfils(morphoAxes(c,{calibrage:_morphoCalCache()})).aMesurer;
  }catch(e){ return []; } })();
  const _der=(function(){ try{ return ampDernierReleve(c&&c.morphoTests); }catch(e){ return null; } })();
  el.innerHTML=`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:12px">`
    +`Quatre tests d’amplitude, chacun avec son protocole. Un relevé vaut ${MORPHO_PEREMPTION_J} jours`
    +` : une amplitude se travaille et se perd.</div>`
    +(_der?`<div class="amp-der${_der.rappel?' amp-rappel':''}">Dernier relevé le ${escapeHtml(dateLocaleDeCle(_der.date).toLocaleDateString('fr-FR'))}`
      +(_der.rappel?` : il y a ${_der.semaines} semaines, c’est le moment de refaire les tests.`:'.')+`</div>`:'')
    +(faits.length?faits.map(ligne).join(''):`<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;padding:4px 0 10px">Aucun test relevé pour l’instant.</div>`)
    +`<button type="button" class="btn btn-outline" style="width:100%;margin:6px 0 0" onclick="ouvrirAmplitudes('${escapeHtml(email)}')">Relever les amplitudes</button>`
    // ⚠ UNE SEULE LIGNE, ET NON LA LISTE (lot 6). La premiere de la liste
    //   est deja celle qui debloque le plus ; les autres reviendront une a une,
    //   quand celle-ci sera saisie.
    +(manque.length?`<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:12px">`
      +`<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Il manque, pour aller plus loin</div>`
      +`<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">${escapeHtml(manque[0])}</div>`
      +(manque.length>1?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:4px">Celle-ci d’abord : ${manque.length-1} autre${manque.length>2?'s':''} suivr${manque.length>2?'ont':'a'}, une à la fois.</div>`:'')
      +`</div>`:'');
}
function renderCoachTraitementsSection(c){  const el=document.getElementById('ccd-traitements');
  if(!el||!c) return false;
  try{ el.innerHTML=_htmlTraitementsCoach(c); }catch(e){ el.innerHTML=''; }
  return true;
}
// ======= SUPPLEMENTS COACH =======
function renderCoachSuppSection(c){
  const el=document.getElementById('ccd-supplements');
  if(!el||!c) return;
  const list=(c.nutrition?.supplements)||[];
  el.innerHTML=`
    <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px">
      <div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:6px">${icon('pill',12)} Compléments alimentaires</div>
      <div style="margin-bottom:12px">
        ${_renderSuppTable(list, true, 'openCoachSuppEdit')}
      </div>
      <!-- Ajout rapide coach -->
      <div style="border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:700;text-transform:uppercase;margin-bottom:10px">Ajouter un complément</div>
        <div style="display:grid;grid-template-columns:1fr 60px auto;gap:8px;margin-bottom:10px;align-items:end">
          <div>
            <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px">Nom</div>
            <input id="ccd-supp-name" list="ccd-supp-name-list" class="form-input" style="padding:8px 10px;font-size:var(--fs-sm)" placeholder="Créatine…" autocomplete="off">
            <datalist id="ccd-supp-name-list">${SUPPLEMENTS_LIST.map(f=>`<option value="${escapeHtml(f.nom)}">`).join('')}</datalist>
          </div>
          <div>
            <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px">Qté</div>
            <input id="ccd-supp-qty" type="number" min="0" step="any" class="form-input" style="padding:8px 10px;font-size:var(--fs-sm)" placeholder="5">
          </div>
          <div>
            <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px">Unité</div>
            <div style="position:relative">
              <select id="ccd-supp-unit" class="form-input" style="padding:8px 28px 8px 10px;font-size:var(--fs-sm);appearance:none;-webkit-appearance:none">
                <option value="g">g</option>
                <option value="mg">mg</option>
                <option value="mcg">mcg</option>
                <option value="ml">ml</option>
                <option value="gélule(s)">gél.</option>
                <option value="comprimé(s)">cpr.</option>
                <option value="scoop(s)">scoop</option>
                <option value="cuillère(s)">c.à.s</option>
              </select>
              <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--sub);font-size:var(--fs-xs)">▼</span>
            </div>
          </div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:6px">Moment(s) <span style="color:var(--red-text)">*</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="ccd-supp-timings">
            ${TIMINGS_LIST.map(t=>`<button type="button" class="supp-timing-chip" onclick="this.classList.toggle('active')">${t.label}</button>`).join('')}
          </div>
        </div>
        <div style="margin-bottom:10px">
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-bottom:4px">Notes (optionnel)</div>
          <input id="ccd-supp-notes" class="form-input" style="padding:8px 10px;font-size:var(--fs-sm)" placeholder="Ex: à jeun, avec repas…">
        </div>
        <button onclick="saveClientSuppEntry()" style="width:100%;padding:12px 0;background:var(--red);border:none;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;border-radius:var(--r-3);cursor:pointer">+ Ajouter au programme</button>
      </div>
    </div>`;
}

function saveClientSuppEntry(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  const name=(document.getElementById('ccd-supp-name').value||'').trim();
  const qty=parseFloat(document.getElementById('ccd-supp-qty').value);
  const unit=document.getElementById('ccd-supp-unit').value;
  const notes=(document.getElementById('ccd-supp-notes').value||'').trim();
  const timings=Array.from(document.querySelectorAll('#ccd-supp-timings .supp-timing-chip.active')).map(b=>{
    const txt=b.textContent.trim();
    return (TIMINGS_LIST.find(t=>t.label===txt)||{id:txt}).id;
  });
  const err=validateSuppFields(name,qty,timings);
  if(err){toast(err.msg,'var(--orange)');return;}
  if(!c.nutrition) c.nutrition={};
  if(!Array.isArray(c.nutrition.supplements)) c.nutrition.supplements=[];
  c.nutrition.supplements.push({id:Date.now(),name,dosage_quantity:qty,dosage_unit:unit,timings,notes,active:true});
  c.updatedAt=Date.now();users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Complément ajouté '+ICO.coche,'le complément est');
  renderCoachSuppSection(c);
}

function deleteClientSuppEntry(index){
  arcRetrait(arcDernierElement('.rc-ligne'),()=>{
    const users=DB.get('users')||{};
    const c=getOwnedClient(currentClientId,users);
    if(!c||!Array.isArray(c.nutrition?.supplements)) return;
    c.nutrition.supplements.splice(index,1);
    // GESTE DESTRUCTEUR SUR LE DOSSIER D'UN AUTRE, et la ligne disparait de
    // l'ecran du coach quoi qu'il arrive : sans ce mot, il croit le complement
    // retire alors que son athlete le voit encore dans sa liste.
    c.updatedAt=Date.now();users[c.email]=c;DB.set('users',users);
    direSiEnvoiEchoue(CLOUD.pushOne(c.email,c),'La suppression',
      'ton athlète verra encore ce complément');
    renderCoachSuppSection(c);
  });
}

// PAR IDENTIFIANT LUI AUSSI. Sa liste n'est pas filtrée aujourd'hui, donc son
// rang était juste — par accident. Un invariant qui tient parce qu'un appelant
// a oublié de filtrer n'est pas un invariant.
function openCoachSuppEdit(id){
  document.getElementById('modal-overlay')?.remove();
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  const list=_suppAssurerIds(c.nutrition?.supplements||[]);
  const idx=_suppIndexParId(list,id);
  const s=idx>=0?list[idx]:null;
  const timingChips=TIMINGS_LIST.map(t=>`<button type="button" class="supp-timing-chip${s&&(s.timings||[]).includes(t.id)?' active':''}" onclick="this.classList.toggle('active')">${t.label}</button>`).join('');
  const unitOpts=['g','mg','mcg','ml','gélule(s)','comprimé(s)','scoop(s)','cuillère(s)'];
  const unitLabels={'gélule(s)':'gél.','comprimé(s)':'cpr.','scoop(s)':'scoop','cuillère(s)':'c.à.s'};
  const unitOptions=unitOpts.map(u=>`<option value="${u}"${s&&s.dosage_unit===u?' selected':''}>${unitLabels[u]||u}</option>`).join('');
  const isActive=s?s.active!==false:true;
  const html=`<div id="modal-overlay" onclick="" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:24px 20px;width:100%;max-width:480px;animation:fadeIn var(--t-3) var(--c-out);max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <h2>${s?'Modifier le complément':'Nouveau complément'}</h2>
      <button onclick="closeModal()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">${icon('croix',14)}</button>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-bottom:6px">NOM</div>
      <input id="coach-supp-name" list="coach-supp-name-list" class="form-input" style="padding:10px 12px;font-size:var(--fs-md)" placeholder="Créatine…" value="${s?escapeHtml(s.name):''}">
      <datalist id="coach-supp-name-list">${SUPPLEMENTS_LIST.map(f=>`<option value="${escapeHtml(f.nom)}">`).join('')}</datalist>
    </div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-bottom:14px;align-items:end">
      <div>
        <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-bottom:6px">DOSAGE</div>
        <input id="coach-supp-qty" type="number" min="0" step="any" class="form-input" style="padding:10px 12px;font-size:var(--fs-md)" placeholder="5" value="${s&&s.dosage_quantity?s.dosage_quantity:''}">
      </div>
      <div>
        <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-bottom:6px">UNITÉ</div>
        <div style="position:relative">
          <select id="coach-supp-unit" class="form-input" style="padding:10px 28px 10px 12px;font-size:var(--fs-md);appearance:none;-webkit-appearance:none">${unitOptions}</select>
          <span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--sub);font-size:var(--fs-xs)">▼</span>
        </div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-bottom:6px">MOMENT(S) <span style="color:var(--red-text)">*</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="coach-supp-timings">${timingChips}</div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;margin-bottom:6px">NOTES</div>
      <input id="coach-supp-notes" class="form-input" style="padding:10px 12px;font-size:var(--fs-md)" placeholder="Ex: à jeun, avec repas…" value="${s?escapeHtml(s.notes||''):''}">
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding:12px 0;border-top:1px solid var(--border)">
      <div style="font-size:var(--fs-sm);font-weight:700">Actif</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span id="coach-supp-active-lbl" style="font-size:var(--fs-xs);color:var(--sub)">${isActive?'Oui':'Non'}</span>
        <input type="checkbox" id="coach-supp-active" style="width:16px;height:16px;cursor:pointer" ${isActive?'checked':''}
          onchange="document.getElementById('coach-supp-active-lbl').textContent=this.checked?'Oui':'Non'">
      </div>
    </div>
    <input type="hidden" id="coach-supp-idx" value="${s?s.id:-1}">
    <button onclick="saveCoachSuppEdit()" style="width:100%;padding:14px 0;background:var(--red);border:none;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;border-radius:var(--r-3);cursor:pointer;margin-bottom:10px;text-transform:uppercase">Enregistrer</button>
    ${s?`<button onclick="deleteCoachSuppEdit(${s.id})" style="width:100%;padding:12px 0;background:none;border:1px solid var(--border);color:var(--text-faint);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:700;letter-spacing:1px;border-radius:var(--r-3);cursor:pointer">Supprimer ce complément</button>`:''}
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}

function saveCoachSuppEdit(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return;
  const name=(document.getElementById('coach-supp-name').value||'').trim();
  const qty=parseFloat(document.getElementById('coach-supp-qty').value);
  const unit=document.getElementById('coach-supp-unit').value;
  const notes=(document.getElementById('coach-supp-notes').value||'').trim();
  const active=document.getElementById('coach-supp-active').checked;
  const _id=parseInt(document.getElementById('coach-supp-idx').value);
  const timings=Array.from(document.querySelectorAll('#coach-supp-timings .supp-timing-chip.active')).map(b=>{
    const txt=b.textContent.trim();
    return (TIMINGS_LIST.find(t=>t.label===txt)||{id:txt}).id;
  });
  if(!name){toast('Saisis un nom','var(--orange)');return;}
  if(!qty||qty<=0){toast('Saisis un dosage','var(--orange)');return;}
  if(!timings.length){toast('Sélectionne au moins un moment','var(--orange)');return;}
  if(!c.nutrition) c.nutrition={};
  if(!Array.isArray(c.nutrition.supplements)) c.nutrition.supplements=[];
  const entry={name,dosage_quantity:qty,dosage_unit:unit,timings,notes,active};
  // Résolu sur la liste telle qu'elle est maintenant, par identité.
  const idx=_suppIndexParId(c.nutrition.supplements,_id);
  if(idx>=0){
    c.nutrition.supplements[idx]={...c.nutrition.supplements[idx],...entry};
  } else {
    c.nutrition.supplements.push({id:Date.now(),...entry});
  }
  c.updatedAt=Date.now();users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),idx>=0?'Complément mis à jour '+ICO.coche:'Complément ajouté '+ICO.coche,'le complément est');
  closeModal();
  renderCoachSuppSection(c);
}

function deleteCoachSuppEdit(id){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!Array.isArray(c.nutrition?.supplements)) return;
  const idx=_suppIndexParId(c.nutrition.supplements,id);
  if(idx<0) return;
  c.nutrition.supplements.splice(idx,1);
  c.updatedAt=Date.now();users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Complément supprimé','la suppression est');
  closeModal();
  renderCoachSuppSection(c);
}

function renderCoachCaffeineSection(c){
  const el=document.getElementById('ccd-caffeine');
  if(!el||!c) return;
  const days=c.nutrition?.caffeine?.days||{};
  // CAFFEINE_POIDS_DEFAUT ET NON 75. La règle est écrite au-dessus de la
  // constante : un repli sur un poids INCONNU tire les seuils vers le bas,
  // jamais vers le haut. À 75 kg, le coach voyait du vert là où l’athlète
  // voyait du jaune — sur le même dossier, le même jour.
  // LA MÊME RÉSOLUTION QUE L’ATHLÈTE, et non le seul `c.weight` : celui-ci
  // n’est écrit que par le parcours bilan, et un athlète qui a rempli « Mon
  // profil » se voyait annoncer au coach un poids « non renseigné ».
  const _p=_poidsCafeine(c);
  const _wConnu=!_p.estimated;
  const wKg=_p.weight;
  // `c`, ET NON currentUser : sur la fiche client, currentUser est le COACH.
  // Le poids venait bien de l'athlète, mais l'âge et l'état de grossesse du
  // coach — un athlète de seize ans recevait donc des seuils adultes.
  const thr=caffeineThresholds(wKg,_ageUtilisateur(c),grossesseSuspend(c));
  // Construire les 28 jours
  const today=new Date();
  const totals28=[];
  let peakMg=0,peakDate=null;
  for(let i=27;i>=0;i--){
    const d=new Date(today);d.setDate(today.getDate()-i);
    const key=localISODate(d);
    const total=(days[key]||[]).reduce((s,e)=>s+(e.mg||0),0);
    totals28.push({key,total,d});
    if(total>peakMg){peakMg=total;peakDate=d;}
  }
  const withData=totals28.filter(x=>x.total>0);
  const avg28=withData.length?Math.round(withData.reduce((s,x)=>s+x.total,0)/withData.length):0;
  const data7=totals28.slice(-7).filter(x=>x.total>0);
  const avg7=data7.length?Math.round(data7.reduce((s,x)=>s+x.total,0)/data7.length):0;
  const peakStr=peakDate&&peakMg>0?peakDate.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'-';
  const col7=avg7>0?_caffeineColor(avg7,thr):'#555';
  const col28=avg28>0?_caffeineColor(avg28,thr):'#555';
  const colPeak=peakMg>0?_caffeineColor(peakMg,thr):'#555';
  el.innerHTML=`
    <div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px">
      <div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:14px">Caféine</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <div style="flex:1;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px;text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:700;margin-bottom:6px">MOY. 7J</div>
          <div class="txt-stat" style="color:${col7};line-height:1">${avg7||'-'}</div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">mg/j</div>
        </div>
        <div style="flex:1;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px;text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:700;margin-bottom:6px">MOY. 28J</div>
          <div class="txt-stat" style="color:${col28};line-height:1">${avg28||'-'}</div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">mg/j</div>
        </div>
        <div style="flex:1;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px;text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:700;margin-bottom:6px">PIC 28J</div>
          <div style="font-size:${peakMg>999?'18':'24'}px;font-family:var(--pile-titre);color:${colPeak};line-height:1">${peakMg||'-'}</div>
          <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:2px">${peakMg?peakStr:'-'}</div>
        </div>
      </div>
      ${!withData.length
        // R13 — cote coach, rien a faire : c'est l'athlete qui note ses prises.
        ?emptyState('coffee',escapeHtml(c.fname||'Ton athlète')+' n\'a noté aucune prise sur 28 jours. Elles s\'afficheront ici dès la première.',null,null,'padding:16px 0')
        :`<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:700;text-transform:uppercase;margin-bottom:8px">Historique 28 jours</div>
          <canvas id="ccd-caff-history" height="100" style="width:100%;display:block;border-radius:var(--r-2)"></canvas>
          <div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:6px">Seuils (pour ${wKg}kg${_wConnu?'':' : poids non renseigné, seuils estimés'}) : vert &lt;${thr.green}mg · jaune &lt;${thr.yellow}mg · orange &lt;${thr.orange}mg · rouge ${thr.red}mg</div>
          <div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:4px;line-height:1.5">${escapeHtml(legendeSeuilsCafeine(thr,!_wConnu))}</div>`
      }
    </div>`;
  if(withData.length){
    requestAnimationFrame(()=>_drawCaffeineHistory(wKg,'ccd-caff-history',days,c));
  }
}

// ======= CAFFEINE =======
const CAFFEINE_DB=[
  {id:'espresso',    type:'coffee',       name:'Espresso',              icon:'cafe',mg:63,  volume:'30ml'},
  {id:'cafe_filtre', type:'coffee',       name:'Café filtre',           icon:'cafe',mg:95,  volume:'240ml'},
  {id:'americano',   type:'coffee',       name:'Americano',             icon:'cafe',mg:120, volume:'240ml'},
  {id:'latte',       type:'coffee',       name:'Latte',                 icon:'cafe',mg:63,  volume:'240ml'},
  {id:'cappuccino',  type:'coffee',       name:'Cappuccino',            icon:'cafe',mg:63,  volume:'180ml'},
  {id:'double_esp',  type:'coffee',       name:'Double espresso',       icon:'cafe',mg:126, volume:'60ml'},
  {id:'the_noir',    type:'tea',          name:'Thé noir',              icon:'the',mg:47,  volume:'240ml'},
  {id:'the_vert',    type:'tea',          name:'Thé vert',              icon:'the',mg:28,  volume:'240ml'},
  {id:'matcha',      type:'tea',          name:'Matcha',                icon:'the',mg:70,  volume:'240ml'},
  {id:'the_blanc',   type:'tea',          name:'Thé blanc',             icon:'the',mg:15,  volume:'240ml'},
  {id:'the_oolong',  type:'tea',          name:'Thé oolong',            icon:'the',mg:37,  volume:'240ml'},
  {id:'yerba',       type:'tea',          name:'Yerba Maté',            icon:'the',mg:80,  volume:'240ml'},
  // Canettes : valeurs EUROPÉENNES. La réglementation impose l'étiquetage de la
  // teneur, et les formules européennes tournent à 30-32 mg/100 ml — nettement
  // sous les versions américaines souvent citées en ligne. Une canette annoncée
  // trop forte fait croire à un dépassement qui n'a pas eu lieu, une annoncée
  // trop faible masque un vrai dépassement : les deux trompent l'athlète.
  {id:'redbull',     type:'energy_drink', name:'Red Bull',              icon:'eclair',mg:80,  volume:'250ml'},
  {id:'monster',     type:'energy_drink', name:'Monster',               icon:'eclair',mg:150, volume:'500ml'},
  {id:'monster_355', type:'energy_drink', name:'Monster',               icon:'eclair',mg:107, volume:'355ml'},
  {id:'rockstar',    type:'energy_drink', name:'Rockstar',              icon:'eclair',mg:160, volume:'500ml'},
  {id:'burn',        type:'energy_drink', name:'Burn Energy',           icon:'eclair',mg:80,  volume:'250ml'},
  {id:'hell',        type:'energy_drink', name:'Hell Energy',           icon:'eclair',mg:80,  volume:'250ml'},
  // Canettes prêtes à boire, à ne pas confondre avec les poudres du même nom
  // rangées en pré-workout : le dosage n'est pas le même.
  {id:'c4_can',      type:'energy_drink', name:'C4 Energy (canette)',   icon:'eclair',mg:160, volume:'500ml'},
  {id:'abe_can',     type:'energy_drink', name:'ABE Energy (canette)',  icon:'eclair',mg:200, volume:'330ml'},
  // Poudres : le nom porte la VERSION quand la gamme en compte plusieurs à des
  // dosages très différents. « Mr Hyde » seul allait de 196 à 380 mg selon
  // qu'on prenait Signature, Xtreme ou Infinite.
  {id:'c4_original', type:'preworkout',   name:'C4 Original',           icon:'muscle',mg:150, volume:'1 dose'},
  {id:'c4_extreme',  type:'preworkout',   name:'C4 Extreme',            icon:'muscle',mg:200, volume:'1 dose'},
  {id:'ghost',       type:'preworkout',   name:'Ghost Legend V4',       icon:'muscle',mg:300, volume:'1 dose'},
  {id:'hyde',        type:'preworkout',   name:'Mr Hyde Signature',     icon:'muscle',mg:200, volume:'1 dose'},
  {id:'hyde_xtreme', type:'preworkout',   name:'Mr Hyde Xtreme',        icon:'muscle',mg:375, volume:'1 dose'},
  {id:'myp_origin',  type:'preworkout',   name:'Origin (MyProtein)',    icon:'muscle',mg:150, volume:'1 dose'},
  {id:'myp_the_pre', type:'preworkout',   name:'THE Pre-Workout (MyProtein)',icon:'muscle',mg:200,volume:'1 dose'},
  {id:'preworkout_g',type:'preworkout',   name:'Pré-workout générique', icon:'muscle',mg:150, volume:'1 dose'},
];

// Icônes de catégorie, tracées en blanc avec un halo : les emoji rendaient
// différemment sur chaque plateforme et juraient avec le reste de l'interface.
// Le type suffit à choisir l'icône, ce qui évite de stocker un glyphe dans
// chaque prise enregistrée.
// Tracés pensés pour le néon : peu de traits, tous fermés ou nettement
// terminés, sans détail sous 1,5 unité — un tube de verre ne fait pas d'angle
// vif et une fioriture disparaît dans le halo dès qu'on descend à 14 px.
const CAFF_ICONES={
  // Tasse vue de trois quarts : le bord est une ELLIPSE, pas un trait. C'est
  // ce seul détail qui fait basculer un pictogramme plat en objet posé — même
  // logique pour la soucoupe, le haut de canette et le couvercle du pot.
  // La vapeur distingue le café du thé, qui porte lui son étiquette.
  // Tasse à anse et vapeur. Pas de soucoupe : rendue en néon, l'ellipse de la
  // soucoupe se détachait du fond de la tasse et flottait comme un anneau
  // séparé. Un mug se lit très bien seul, et gagne la place que prenait
  // l'assiette pour être plus grand dans la même boîte.
  coffee:'<path d="M5.2 8.2a5.5 1.6 0 1 0 11 0 5.5 1.6 0 1 0-11 0"/>'
        +'<path d="M7.1 8.6a3.6 1.05 0 1 0 7.2 0 3.6 1.05 0 1 0-7.2 0"/>'
        +'<path d="M5.2 8.2c0 5 1.8 7.8 5.5 7.8s5.5-2.8 5.5-7.8"/>'
        +'<path d="M16.4 9.6c3-.7 4.3.9 4 2.5-.3 1.6-1.8 2.4-4 2.1"/>'
        +'<path d="M3.1 17.6a7.6 1.9 0 1 0 15.2 0 7.6 1.9 0 1 0-15.2 0"/>'
        +'<path d="M8.4 5.4c1.2-1.1-1.2-2.2 0-3.3"/><path d="M12.6 5.4c1.2-1.1-1.2-2.2 0-3.3"/>',
  // Même tasse, SANS anse, avec l'étiquette du sachet au bout d'une ficelle
  // verticale. L'étiquette penchée essayée avant se lisait comme une note de
  // musique : un rectangle droit au bout d'un fil droit, c'est un sachet de
  // thé et rien d'autre. L'absence d'anse achève de distinguer les deux tasses.
  tea:'<path d="M5.2 9.8a5.5 1.6 0 1 0 11 0 5.5 1.6 0 1 0-11 0"/>'
     +'<path d="M7.1 10.2a3.6 1.05 0 1 0 7.2 0 3.6 1.05 0 1 0-7.2 0"/>'
     +'<path d="M5.2 9.8c0 5 1.8 7.8 5.5 7.8s5.5-2.8 5.5-7.8"/>'
     +'<path d="M16.4 11.2c3-.7 4.3.9 4 2.5-.3 1.6-1.8 2.4-4 2.1"/>'
     +'<path d="M3.1 19.2a7.6 1.9 0 1 0 15.2 0 7.6 1.9 0 1 0-15.2 0"/>'
     +'<path d="M8.3 5v5.7"/>'
     +'<path d="M6.3 1.4h4.1v3.6H6.3z"/>'
     +'<path d="M7.4 3.5q.9-1.1 1.8-.3"/>',
  // Canette : bord serti elliptique, épaulement conique, corps cylindrique,
  // fond bombé, et UN éclair plein sur le flanc.
  // Trois griffes parallèles avaient été essayées : mesuré au pixel, leurs
  // halos se rejoignaient et n'en formaient plus qu'un bloc, à toutes les
  // tailles. Sous néon, deux traits distants de moins de trois unités ne font
  // plus qu'un — d'où une forme pleine, isolée, plutôt qu'une hachure.
  // Canette élargie : à 8 unités de large sur 17 de haut, elle se lisait comme
  // un bâtonnet dès qu'on descendait sous 26 px. Proportion resserrée, éclair
  // agrandi d'autant pour rester visible au centre du flanc.
  energy_drink:'<path d="M8.4 3.6a3.6 1.1 0 1 0 7.2 0 3.6 1.1 0 1 0-7.2 0"/>'
              +'<path d="M10 3.5a2 .6 0 1 0 4 0 2 .6 0 1 0-4 0"/>'
              +'<path d="M8.4 3.6c-.4 2.1-1.4 2.7-1.4 4.4"/><path d="M15.6 3.6c.4 2.1 1.4 2.7 1.4 4.4"/>'
              +'<path d="M7 8v10.2"/><path d="M17 8v10.2"/>'
              +'<path d="M7 18.2c0 1.9 2.2 2.9 5 2.9s5-1 5-2.9"/>'
              +'<path d="M7.1 9.5c1.6.5 8.2.5 9.8 0"/>'
              +'<path d="M13.6 10.8 9.8 15.6h3l-.8 3.5 3.9-5.2h-3z"/>',
  // Pot de complément : le couvercle DÉBORDE du corps. C'est la signature
  // visuelle d'un pot vissé, et c'est ce qui manquait — couvercle et corps de
  // même largeur, séparés par une bande, se lisaient comme un empilement de
  // rondelles. La bande d'étiquette est retirée pour la même raison.
  preworkout:'<path d="M5.4 4.4a6.6 1.8 0 1 0 13.2 0 6.6 1.8 0 1 0-13.2 0"/>'
            +'<path d="M5.4 4.4v2.5c0 1 2.95 1.8 6.6 1.8s6.6-.8 6.6-1.8V4.4"/>'
            +'<path d="M8.2 5.9v2.5"/><path d="M12 6.2v2.6"/><path d="M15.8 5.9v2.5"/>'
            +'<path d="M7 8.9v9.3c0 1.5 2.25 2.4 5 2.4s5-.9 5-2.4V8.9"/>'
            +'<path d="M7.1 12.6c1.7.5 8.1.5 9.8 0"/>'
            +'<path d="M7.1 17c1.7.5 8.1.5 9.8 0"/>',
  // Molécule de caféine, en formule topologique : le bicycle purine —
  // pyrimidinedione à six sommets accolée à l'imidazole à cinq — et ses
  // quatre substituants. Le trait intérieur de double liaison a été retiré :
  // à 1,5 unité de l'arête, son halo se confondait avec elle.
  // Les atomes notés (N, O, CH3) se perdraient sous 20 px, la charpente non.
  custom:'<path d="M18 9.9 14.4 7.8 10.8 9.9v4.2l3.6 2.1 3.6-2.1z"/>'
        +'<path d="M10.8 9.9 6.8 8.6 4.3 12l2.5 3.4 4-1.3"/>'
        +'<path d="m16.9 10.6-2.5-1.5-2.5 1.5"/>'
        +'<path d="M6.4 9.9 4.9 12l1.5 2"/>'
        +'<path d="M14.4 7.8V4.6"/><path d="m18 9.9 2.9-1.7"/>'
        +'<path d="m18 14.1 2.9 1.7"/><path d="M14.4 16.2v3.1"/>'
        +'<path d="m6.8 15.4-1.3 3"/>'
        +'<path d="M19.6 8.4a.85 .85 0 1 0 1.7 0 .85 .85 0 1 0-1.7 0"/>'
        +'<path d="M13.55 19.3a.85 .85 0 1 0 1.7 0 .85 .85 0 1 0-1.7 0"/>',
  // Sert au bandeau « Timing recommandé » du pré-workout, pas à une catégorie.
  clock:'<circle cx="12" cy="12.6" r="8.4"/><path d="M12 7.4v5.2l3.4 2"/><path d="M9.6 2.4h4.8"/>'
};
// Trois passes du même tracé, du plus diffus au plus net : c'est cet
// empilement qui fait le néon. Une seule couche floutée donnerait une tache,
// une seule couche nette un pictogramme plat.
// overflow:visible est indispensable : sans lui la lueur serait tranchée net
// au bord du viewBox, et l'icône paraîtrait posée dans une boîte.
function caffIcone(type,taille){
  const t=CAFF_ICONES[type]||CAFF_ICONES.custom;
  const s=taille||24;
  // Le flou est exprimé en unités du viewBox : il rétrécit donc avec l'icône,
  // mais le cœur aussi, et sous 16 px il tombait à un demi-pixel réel. Rendu
  // à cette épaisseur, l'anti-crénelage le grisait et le halo l'avalait : les
  // onglets affichaient une tache là où les tuiles montraient un tube net.
  // On garantit donc au trait central un peu plus d'un pixel à l'écran, quelle
  // que soit la taille demandée, et on resserre le halo en conséquence.
  const parPixel=24/s;
  const coeur=Math.max(1.15, 1.18*parPixel);
  const douce=coeur+0.5;
  // Halo resserré depuis la mesure des séparations : trop large, il débordait
  // d'un trait sur son voisin et remplissait les creux du dessin. Le rendu
  // reste un tube allumé, mais les vides du tracé restent des vides.
  const halo=coeur+0.85;
  const opHalo=s<=16?0.38:0.44;
  return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" style="display:inline-block;vertical-align:middle;flex-shrink:0;overflow:visible">`
    +`<g filter="url(#rcNeonGlow)" stroke="#9ed4ff" stroke-width="${halo.toFixed(2)}" opacity="${opHalo}">${t}</g>`
    +`<g filter="url(#rcNeonGlow)" stroke="#e8f6ff" stroke-width="${douce.toFixed(2)}" opacity=".72">${t}</g>`
    +`<g stroke="var(--text)" stroke-width="${coeur.toFixed(2)}">${t}</g>`
    +`</svg>`;
}

// Référence réglementaire — EFSA, avis scientifique sur la caféine (2015),
// repris par l'ANSES : pour un adulte en bonne santé,
//   • 400 mg/jour est le plafond sans risque identifié ;
//   • 200 mg en prise unique, soit environ 3 mg/kg, restent sans effet notable.
// Les anciens ratios 2:4:6:8 plaçaient le seuil rouge à 600 mg pour 75 kg,
// bien au-delà du plafond : l'anneau ne virait au rouge qu'après une dose déjà
// dangereuse. Les paliers suivent maintenant le poids SANS jamais dépasser 400.
const CAFFEINE_MAX_EFSA=400;
// Références : avis de l'EFSA de 2015 sur la sécurité de la caféine, repris par
// l'ANSES. 400 mg par jour pour l'adulte, 3 mg par kilo et par jour pour les
// enfants et adolescents, 200 mg par jour pendant la grossesse.
// AGE_MINIMUM vaut 16 : le produit accueille explicitement des utilisateurs de
// 16 et 17 ans, et privacy.html met cette protection en avant. Leur servir le
// plafond adulte était un défaut, pas un cas théorique.
const CAFFEINE_MG_KG_MINEUR=3;
const CAFFEINE_MAX_GROSSESSE=200;
// 60 kg et non 75 : un repli sur un poids INCONNU doit tirer les seuils vers le
// bas, jamais vers le haut. Surestimer le poids relève tous les paliers de
// quelqu'un dont on ne sait rien.
const CAFFEINE_POIDS_DEFAUT=60;
const CAFFEINE_AGE_ADULTE=18;
// Âge lu par le MÊME chemin que besoinsProposes : le dernier bilan qui porte la
// réponse, puis les champs d'inscription. Pas de seconde lecture.
function _ageUtilisateur(user){
  const v=parseFloat(_dernierChamp(user,'deb-age'))
    ||parseFloat((user&&user['init-age'])||0)
    ||parseFloat((user&&user.age)||0);
  return (v>0)?v:null;
}
// grossesse : branché. Le champ existe désormais, et les quatre appels passent
// la note de demi-vie la mentionne, mais rien ne la SAISIT. La branche est
// écrite et testable ; elle ne s'activera que le jour où A3-09 fournira le
// champ, et aucun appelant ne passe encore cet argument.
function caffeineThresholds(wKg,age,grossesse){
  const w=wKg||CAFFEINE_POIDS_DEFAUT;
  const mineur=(age!=null&&age<CAFFEINE_AGE_ADULTE);
  // Le prorata annoncé (50 % / 75 % du plafond) NE REDONNE PAS les valeurs
  // adultes actuelles : à 75 kg il produirait 200/300 là où la jauge affiche
  // 150/225 depuis toujours. On conserve donc le calcul historique pour les
  // adultes — il suit déjà le poids — et le prorata ne sert qu'aux cas où un
  // plafond plus bas s'impose.
  if(grossesse!==true&&!mineur){
    return {
      green :Math.min(Math.round(w*2),   200),
      yellow:Math.min(Math.round(w*3),   300),
      orange:Math.min(Math.round(w*5.5), CAFFEINE_MAX_EFSA),
      red   :CAFFEINE_MAX_EFSA,
      regle :'adulte', plafond:CAFFEINE_MAX_EFSA
    };
  }
  const plafond=(grossesse===true)
    ?CAFFEINE_MAX_GROSSESSE
    :Math.min(Math.round(CAFFEINE_MG_KG_MINEUR*w), CAFFEINE_MAX_EFSA);
  // Mêmes proportions visuelles que la jauge adulte : l'anneau se lit de la
  // même façon, seule l'échelle change.
  return {
    green :Math.round(plafond*0.50),
    yellow:Math.round(plafond*0.75),
    orange:plafond,
    red   :plafond,
    regle :(grossesse===true)?'grossesse':'mineur', plafond
  };
}
// La légende NOMME la règle appliquée. « 400 mg » sans dire d'où il sort
// n'apprend rien, et un mineur doit savoir que ses seuils ne sont pas ceux
// d'un adulte.
function legendeSeuilsCafeine(thr,poidsEstime){
  if(!thr) return '';
  let s;
  if(thr.regle==='grossesse')
    s='Seuils calculés sur la référence pendant la grossesse ('+CAFFEINE_MAX_GROSSESSE+' mg par jour).';
  else if(thr.regle==='mineur')
    s='Seuils calculés sur la référence pour les moins de '+CAFFEINE_AGE_ADULTE+' ans ('+CAFFEINE_MG_KG_MINEUR+' mg par kilo).';
  else
    s='Seuils calculés sur la référence adulte (EFSA, '+CAFFEINE_MAX_EFSA+' mg par jour).';
  if(poidsEstime)
    s+=' Seuils calculés sur un poids estimé : renseigne ton poids pour qu\'ils soient justes.';
  return s;
}
function caffeineEquiv(mg){
  const n=Math.round(mg/63);
  return n<=0?'':`≈ ${n===1?'1 espresso':n+' expressos'}`;
}
// Les quatre paliers sont utilisés ici, et la légende sous la jauge reprend
// exactement ces trois bornes — toute modification doit rester synchrone.
// BLANC a l optimal, et non plus vert : c est la couleur du cadran au repos
// dans la direction artistique retenue. L escalade, elle, reste coloree —
// ambre, orange, rouge — parce que la teinte de l anneau est le seul signal
// lisible d un coup d oeil quand la limite approche.
function _caffeineColor(mg,thr){
  if(mg<thr.green)  return 'var(--text)';
  if(mg<thr.yellow) return 'var(--info)';
  if(mg<thr.orange) return 'var(--warning)';
  return 'var(--danger)';
}
// PURE. Le poids qui sert aux seuils de caféine, et s’il est ESTIMÉ.
//
// PREND LE DOSSIER EN ARGUMENT, parce que deux surfaces le demandent : l’écran
// de l’athlète sur `currentUser`, et la fiche coach sur le dossier du CLIENT.
// La seconde ne lisait que `weight` — écrit par le seul parcours bilan — et
// annonçait « poids non renseigné, seuils estimés » à 60 kg pour un athlète
// qui n’avait rempli que « Mon profil ». L’en-tête de la même fiche affichait
// pourtant son profileWeight, et l’athlète voyait ses vrais seuils : trois
// surfaces, deux vérités.
function _poidsCafeine(u){
  if(!u) return {weight:CAFFEINE_POIDS_DEFAUT,estimated:true};
  // Poids du profil (saisi au bilan) puis repli sur l'écran Mon profil
  const w0=parseFloat(u.weight)||parseFloat(u.profileWeight);
  if(w0>0) return {weight:w0,estimated:false};
  // bilan.date est un timestamp (Date.now()) : tri numérique sur une COPIE.
  // L'ancien localeCompare levait une TypeError des le 2e bilan (les nombres
  // n'ont pas cette methode), ce qui cassait tout l'ecran Cafeine.
  const bilans=(u.bilans||[]).slice().sort((a,b)=>(b.date||0)-(a.date||0));
  if(bilans.length){
    const last=bilans[0];
    const w1=parseFloat(last['bil-weight']||last['deb-weight']||last.weight||0);
    if(w1>0) return {weight:w1,estimated:false};
  }
  return {weight:CAFFEINE_POIDS_DEFAUT,estimated:true};
}
// Le dossier courant, et rien d’autre : c’est la seule chose que cette
// fonction ajoutait à la résolution ci-dessus.
function getUserWeight(){ return _poidsCafeine(currentUser); }
function _caffStore(){
  if(!currentUser.nutrition) currentUser.nutrition={};
  if(!currentUser.nutrition.caffeine) currentUser.nutrition.caffeine={days:{}};
  if(!currentUser.nutrition.caffeine.days) currentUser.nutrition.caffeine.days={};
  return currentUser.nutrition.caffeine.days;
}
// ── Caféine résiduelle au coucher ──────────────────────────────────────────
// La demi-vie de la caféine tient ici dans UN chiffre : 5 heures. C'est une
// MOYENNE DE POPULATION, pas une mesure. Selon le CYP1A2, le tabac, la
// contraception orale, la grossesse ou l'état du foie, elle va grosso modo de
// 2 h à 10 h — du simple au quintuple. Rien dans l'app ne mesure quoi que ce
// soit chez l'athlète : ce qui suit est un ordre de grandeur, et l'affichage
// le dit à chaque fois qu'il donne un chiffre.
const DEMI_VIE_CAFEINE_H=5;
// Bornes d'affichage. Le seuil d'alerte est INCLUSIF : 200 mg pris cinq heures
// avant le coucher laissent exactement 100 mg, et ce cas doit déjà parler.
const CAFEINE_RESIDU_ALERTE=100;
const CAFEINE_RESIDU_CIBLE=50;

function _hhmmEnMin(t){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(t==null?'':t).trim());
  if(!m) return null;
  const h=+m[1],mn=+m[2];
  if(h>23||mn>59) return null;
  return h*60+mn;
}
function _minEnHhmm(min){
  const m=((Math.round(min)%1440)+1440)%1440;
  return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
}
// « 15h » et « 15h30 », comme on l'écrit en français, sans zéro inutile.
function _libHeure(min){
  const m=((Math.round(min)%1440)+1440)%1440;
  const mn=m%60;
  return Math.floor(m/60)+'h'+(mn?String(mn).padStart(2,'0'):'');
}
// Un coucher avant midi désigne la nuit qui vient, donc le lendemain : 00h30
// devient 24h30. Sans cette convention, toutes les prises de la journée
// seraient « postérieures au coucher » et compteraient pour zéro, ce qui
// donnerait 0 mg résiduel à qui se couche à une heure du matin.
function _coucherEnMin(t){
  const m=_hhmmEnMin(t);
  return m==null?null:(m<12*60?m+1440:m);
}

// PURE : ne lit aucun état, n'écrit rien, ne regarde pas l'heure qu'il est.
// Pour chaque prise, mg × 0,5^(heures écoulées / demi-vie). Une prise
// postérieure à l'heure cible compte pour zéro — on ne remonte pas le temps.
// Une prise sans heure exploitable est ignorée : on ne peut pas la placer, et
// lui inventer une heure fausserait le total dans un sens inconnu. L'affichage
// signale ces prises plutôt que de les passer sous silence.
function cafeineResiduelle(entrees,heureCible){
  const cible=_coucherEnMin(heureCible);
  if(cible==null) return 0;
  let total=0;
  (entrees||[]).forEach(e=>{
    const mg=Number(e&&e.mg);
    const t=_hhmmEnMin(e&&e.time);
    if(!isFinite(mg)||mg<=0||t==null) return;
    if(t>cible) return;
    total+=mg*Math.pow(0.5,(cible-t)/(DEMI_VIE_CAFEINE_H*60));
  });
  return Math.round(total);
}
function _cafeineSansHeure(entrees){
  return (entrees||[]).filter(e=>e&&Number(e.mg)>0&&_hhmmEnMin(e.time)==null).length;
}

// Dernière heure H telle que, si toute prise postérieure à H avait eu lieu à H,
// il resterait au plus `cible` mg au coucher. Le résidu décroît quand H recule :
// un balayage par pas de quinze minutes en partant du coucher rend donc la
// PREMIÈRE valeur qui tient, c'est-à-dire la plus tardive. Rend null quand même
// tout ramené au début de journée ne suffit pas — on n'annonce pas une heure
// qui ne tiendrait pas.
function heureLimiteCafeine(entrees,heureCoucher,cible){
  const c=_coucherEnMin(heureCoucher);
  if(c==null) return null;
  const but=(cible==null?CAFEINE_RESIDU_CIBLE:cible);
  // Le balayage s'arrête à minuit, PAS en dessous. Avec une borne négative,
  // _minEnHhmm ramenait −15 min sur 23h45 : la prise repassait après le coucher,
  // comptait pour zéro, et la fonction annonçait « avant 23h45 » à un athlète
  // qui venait d'avaler 3000 mg. Faux dans le sens le plus dangereux.
  for(let h=c;h>=0;h-=15){
    const decalees=(entrees||[]).map(e=>{
      const t=_hhmmEnMin(e&&e.time);
      return t==null?e:Object.assign({},e,{time:_minEnHhmm(Math.min(t,h))});
    });
    if(cafeineResiduelle(decalees,heureCoucher)<=but) return ((h%1440)+1440)%1440;
  }
  return null;
}

// Heure de coucher retenue : médiane des quatorze derniers jours, à défaut le
// dernier relevé, à défaut RIEN. Aucune valeur par défaut, aucun 23 h implicite :
// sans historique de sommeil, tout ce lot reste invisible.
// Médiane et non moyenne — une nuit blanche à 4 h du matin ne doit pas déplacer
// l'heure habituelle de tout le monde.
function coucherHabituel(user){
  const log=((user&&user.sleepLog)||[]).filter(e=>e&&e.date&&_hhmmEnMin(e.bed)!=null);
  if(!log.length) return null;
  const tri=log.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const limite=localISODate(new Date(Date.now()-14*864e5));
  const recents=tri.filter(e=>String(e.date)>=limite);
  if(recents.length){
    // Les couchers d'après minuit sont ramenés sur la même échelle que les
    // autres (00h30 → 24h30), sinon la médiane serait tirée vers le matin.
    const v=recents.map(e=>_coucherEnMin(e.bed)).sort((a,b)=>a-b);
    const m=v.length%2
      ?v[(v.length-1)/2]
      :Math.round((v[v.length/2-1]+v[v.length/2])/2);
    return {min:((m%1440)+1440)%1440,source:'mediane',nuits:recents.length};
  }
  const d=tri[tri.length-1];
  return {min:_hhmmEnMin(d.bed),source:'dernier',nuits:1};
}

const CAFEINE_NOTE_DEMIVIE="Estimation sur une demi-vie moyenne de 5 h : la vitesse d'élimination varie beaucoup d'une personne à l'autre.";

// ══ L'HEURE LIMITE, AVANT — ET NON LE CONSTAT, APRES ════════════════════
//
// _htmlCafeineCoucher et _htmlCafeineNuits ne parlent que RETROSPECTIVEMENT :
// il faut avoir deja bu pour qu'ils disent quoi que ce soit, et le second
// attend meme que le residu depasse le seuil d'alerte. Par construction, ils
// arrivent trop tard — au moment ou l'on peut encore decider, ils se taisent.
//
// Celle-ci repond a la question qu'on se pose LE MATIN : jusqu'a quelle heure
// puis-je boire mon cafe habituel ?
//
// LE MODELE N'EST PAS REECRIT. DEMI_VIE_CAFEINE_H et CAFEINE_RESIDU_CIBLE sont
// ceux de cafeineResiduelle : deux modeles de demi-vie finiraient par diverger,
// et c'est celui qui derive qui se met a mentir en premier. La forme est
// fermee plutot qu'un balayage — on cherche t tel que dose·2^(−(coucher−t)/T)
// vaut la cible, donc coucher − t = T·log2(dose/cible).
//
// LA DOSE EST CELLE DE L'ATHLETE, la mediane de ses prises reelles : annoncer
// une heure calculee sur un expresso standard a quelqu'un qui boit des mugs de
// filtre serait une heure fausse presentee comme un conseil.
const CAFE_LIMITE_JOURS=14;
function heureDernierCafe(u){
  // SANS HISTORIQUE, ON NE DIT RIEN. Une heure limite de cafe annoncee a
  // quelqu'un qui n'en boit pas est du bruit — et du bruit qui se presente
  // comme un conseil.
  const jours=(u&&u.nutrition&&u.nutrition.caffeine&&u.nutrition.caffeine.days)||{};
  const doses=[];
  const d0=new Date(); d0.setHours(12,0,0,0);
  for(let i=1;i<=CAFE_LIMITE_JOURS;i++){
    const j=new Date(d0); j.setDate(d0.getDate()-i);
    (jours[localISODate(j)]||[]).forEach(e=>{
      const mg=Number(e&&e.mg);
      if(isFinite(mg)&&mg>0) doses.push(mg);
    });
  }
  if(!doses.length) return null;
  doses.sort((a,b)=>a-b);
  const dose=doses[Math.floor(doses.length/2)];
  // Le coucher habituel vient de coucherHabituel, qui sert deja l'ecran
  // Cafeine : une seconde definition du « coucher habituel » sur le meme
  // dossier donnerait deux heures differentes sur deux ecrans.
  const c=coucherHabituel(u);
  if(!c||c.min==null) return null;
  // Une dose deja sous la cible ne recule rien : le logarithme serait negatif
  // et l'heure repartirait APRES le coucher.
  const recul=dose<=CAFEINE_RESIDU_CIBLE?0
    :Math.round(DEMI_VIE_CAFEINE_H*60*(Math.log(dose/CAFEINE_RESIDU_CIBLE)/Math.LN2));
  // ⚠ MODULO 1440, ET C'EST LE PIEGE. Un coucher a 00h30 moins cinq heures
  // tombe a 19h30 LA VEILLE : sans le modulo, la soustraction rend un nombre
  // negatif, et _libHeure en fait n'importe quoi.
  return {limite:((c.min-recul)%1440+1440)%1440,coucher:c.min,dose,
    nuits:c.nuits,source:c.source};
}

// Écran Caféine, sous la jauge. Rien si l'heure de coucher est inconnue, rien
// s'il ne reste plus rien à annoncer.
function _htmlCafeineCoucher(entrees,user){
  const c=coucherHabituel(user);
  if(!c||c.min==null) return '';
  const bed=_minEnHhmm(c.min);
  const residu=cafeineResiduelle(entrees,bed);
  if(residu<1) return '';
  const alerte=residu>=CAFEINE_RESIDU_ALERTE;
  const coul=alerte?'var(--warning)':'var(--sub)';
  const lim=alerte?heureLimiteCafeine(entrees,bed,CAFEINE_RESIDU_CIBLE):null;
  const sansHeure=_cafeineSansHeure(entrees);
  return `<div style="background:${alerte?'color-mix(in srgb,var(--amber) 7%,transparent)':'var(--surface-1)'};border:1px solid ${alerte?'color-mix(in srgb,var(--amber) 28%,transparent)':'var(--border)'};border-radius:var(--r-3);padding:12px 14px;margin-bottom:8px">
    <div style="font-size:var(--fs-sm);color:${coul};line-height:1.6;font-weight:${alerte?'700':'400'}">Il t'en restera environ ${residu} mg à ton heure de coucher habituelle (${_libHeure(c.min)}).</div>
    ${lim!=null?`<div style="font-size:var(--fs-sm);color:var(--warning);line-height:1.6;font-weight:700;margin-top:4px">Pour être sous ${CAFEINE_RESIDU_CIBLE} mg, ta dernière prise devrait être avant ${_libHeure(lim)}.</div>`:''}
    ${sansHeure?`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.5;margin-top:6px">${sansHeure} prise${sansHeure>1?'s':''} sans heure renseignée n'${sansHeure>1?'entrent':'entre'} pas dans ce calcul.</div>`:''}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.5;margin-top:6px">${escapeHtml(CAFEINE_NOTE_DEMIVIE)}</div>
  </div>`;
}

// L'heure limite, rendue. Muette sans historique de cafeine ou sans coucher
// connu : heureDernierCafe rend null dans les deux cas, et une carte vide vaut
// moins que pas de carte.
function _htmlCafeLimite(u){
  const r=heureDernierCafe(u);
  if(!r) return '';
  return `<section class="san-carte">
    <div class="san-tete"><h2 class="san-t">Dernier café</h2></div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">
      Pour qu'il t'en reste moins de ${CAFEINE_RESIDU_CIBLE}&nbsp;mg à ton coucher habituel
      (${_libHeure(r.coucher)}), ta dernière prise de ${r.dose}&nbsp;mg devrait être avant
      <strong style="color:var(--warning)">${_libHeure(r.limite)}</strong>.</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">${escapeHtml(CAFEINE_NOTE_DEMIVIE)}</div>
  </section>`;
}
// Écran Sommeil, la même chose dans l'autre sens : les nuits de la semaine
// affichée où il restait de la caféine au coucher. L'heure retenue est celle
// RELEVÉE cette nuit-là — ce n'est pas une hypothèse, c'est une donnée.
// Aucun jugement sur la nuit : on ne dit pas que le sommeil a été mauvais, on
// ne relie rien à la durée dormie. On donne le chiffre, c'est tout.
function _htmlCafeineNuits(user,dates){
  const log=(user&&user.sleepLog)||[];
  const jours=(user&&user.nutrition&&user.nutrition.caffeine&&user.nutrition.caffeine.days)||{};
  const lignes=(dates||[]).map(d=>{
    const nuit=log.find(e=>e&&e.date===d);
    if(!nuit||_hhmmEnMin(nuit.bed)==null) return null;
    const mg=cafeineResiduelle(jours[d]||[],nuit.bed);
    return mg>=CAFEINE_RESIDU_ALERTE?{date:d,bed:nuit.bed,mg}:null;
  }).filter(Boolean);
  if(!lignes.length) return '';
  const lbl=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
  return `<div style="background:color-mix(in srgb,var(--amber) 6%,transparent);border:1px solid color-mix(in srgb,var(--amber) 24%,transparent);border-radius:var(--r-4);padding:16px;margin-bottom:14px">
    <div style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--warning);text-transform:uppercase;margin-bottom:10px">Caféine au coucher</div>
    ${lignes.map(l=>`<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7;text-transform:capitalize">${escapeHtml(lbl(l.date))} <span style="text-transform:none;color:var(--warning);font-weight:700">environ ${l.mg} mg</span><span style="text-transform:none;color:var(--sub)"> encore présents à ${_libHeure(_hhmmEnMin(l.bed))}</span></div>`).join('')}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.5;margin-top:8px">${escapeHtml(CAFEINE_NOTE_DEMIVIE)}</div>
  </div>`;
}
function getCaffeineDay(dateStr){return(_caffStore()[dateStr]||[]);}
// `dateISO` est OPTIONNELLE et vaut aujourd'hui : les appels existants ne
// changent pas. Elle sert à la saisie rétroactive, sur le modèle des pas.
//
// DEUX REFUS, et ils ne sont pas décoratifs. Le FUTUR : on ne consigne pas ce
// qui n'a pas eu lieu. Et AU-DELÀ DE LA RÉTENTION : la purge qui suit
// effacerait l'entrée dans la foulée, ce qui se lirait comme un
// enregistrement réussi puis disparu.
function addCaffeineEntry(entry,dateISO){
  const days=_caffStore();
  const auj=localISODate(new Date());
  const cutoff=localISODate(new Date(Date.now()-CAFF_RETENTION_JOURS*24*3600*1000));
  const d=dateISO||auj;
  if(d>auj||d<cutoff) return false;
  if(!days[d]) days[d]=[];
  days[d].push(entry);
  Object.keys(days).forEach(k=>{if(k<cutoff)delete days[k];});
  saveUser();
  return true;
}
// LE JOUR VISÉ PAR L'ÉCRAN D'OÙ L'ON VIENT. Deux écrans affichent la caféine
// — l'autonome et celui encastré dans la nutrition — et chacun garde sa
// propre date. _caffReturnToNutrition dit déjà lequel a ouvert la saisie.
function _caffDateCourante(){
  const d=_caffReturnToNutrition?_caffeineEmbedDate:_caffeineViewDate;
  return d||localISODate(new Date());
}
// wKgAffiche : poids qui a servi à calculer thr. Passé en paramètre plutôt que
// relu ici, pour que la vue coach puisse un jour afficher le poids de l'ATHLÈTE
// et non celui du compte connecté.
function _renderCaffeineBlock(entries,totalMg,thr,deleteFnName,date,wEst,isToday,dateLbl,wKgAffiche){
  // LA JAUGE EST PLEINE A LA REFERENCE AFFICHEE AU PIED DE LA CARTE, pas au
  // seuil orange. L anneau saturait des l orange et ne bougeait plus ensuite,
  // alors que la carte annonce thr.red comme plafond : entre l orange et le
  // rouge, l athlete voyait un anneau immobile pendant que son total montait.
  // Les seuils de COULEUR ne changent pas, seule la course de l arc s aligne.
  const pct=Math.min(totalMg/thr.red,1);
  // LE CHANGEMENT DE PALIER SE VOIT. Les transitions sur `stroke` etaient
  // ecrites depuis toujours mais ne jouaient jamais : le html naissait deja
  // a la couleur finale, et une transition ne part que d une valeur peinte.
  // On rend donc a la couleur du palier PRECEDENT, et _animerJauges pose la
  // nouvelle au tour d apres — les transitions jouent enfin.
  const color=_caffeineColor(totalMg,thr);
  // LE PALIER COURANT, calcule ICI et une seule fois. La liste s en sert
  // pour remplir la pastille correspondante : les memes bornes que
  // _caffeineColor, dans le meme ordre, sans quoi la pastille pleine et la
  // couleur de l anneau finiraient par se contredire.
  const _palier=totalMg<thr.green?0:totalMg<thr.yellow?1:totalMg<thr.orange?2:3;
  // LA COULEUR DE DEPART EST CELLE DU RENDU PRECEDENT, retenue telle quelle.
  // Une table « palier -> couleur » serait une SECONDE source pour la meme
  // decision, et elle divergerait : _caffeineColor rend var(--danger) au
  // dernier palier, pas var(--red).
  const _colDepart=(_caffPalierPrec!=null&&_caffPalierPrec.p!==_palier)
    ?_caffPalierPrec.c:color;
  // LE FRANCHISSEMENT, et non le simple etat : la couleur glissait deja sur
  // 320 ms, mais rien ne MARQUAIT l'instant. L'athlete qui depasse sa limite le
  // lisait, il ne le sentait pas.
  const _palierNeuf=(_caffPalierPrec!=null&&_caffPalierPrec.p!==_palier);
  _caffPalierPrec={p:_palier,c:color};
  const wEstHtml=wEst?'<span style="display:block;margin-top:4px;color:var(--warning);font-size:var(--fs-xs)">Poids estimé ('+CAFFEINE_POIDS_DEFAUT+' kg) : renseigne ton poids réel pour des seuils précis</span>':'';
  // La legende NOMME la regle appliquee, juste sous la jauge. Un mineur doit
  // lire que ses seuils ne sont pas ceux d'un adulte, sans avoir a le deviner
  // des chiffres.
  const legendeHtml='<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.5;margin-top:6px">'
    +escapeHtml(legendeSeuilsCafeine(thr,wEst))+'</div>';
  // Les trois niveaux de bannière suivent les trois bornes de _caffeineColor,
  // pour que la sévérité du message et la couleur de l'anneau coïncident toujours.
  const alertHtml=totalMg>=thr.orange
    ?`<div class="caff-alert-banner" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">Limite dépassée (${thr.orange}mg) : évite toute nouvelle prise aujourd'hui.</div>`
    :totalMg>=thr.yellow
    ?'<div class="caff-alert-banner" style="background:var(--warning-bg);border-color:var(--warning);color:var(--warning)">Niveau élevé : surveille ton sommeil et ta fréquence cardiaque.</div>'
    :totalMg>=thr.green
    ?`<div class="caff-alert-banner" style="background:var(--info-bg);border-color:var(--info);color:var(--info)">Consommation modérée : ta limite du jour est à ${thr.orange}mg.</div>`
    :'';
  const listHtml=!entries.length
    // R13 — PAS DE BOUTON : « + Enregistrer une prise » est juste au-dessus
    // de cette liste. Un second bouton pour le meme geste, a deux pas du
    // premier, serait du bruit.
    ?emptyState('coffee','Aucune prise notée ce jour. Le bouton « + Enregistrer une prise », au-dessus, l\'ajoute.',null,null,'padding:16px 0')
    :renderDataList(entries,(e,i)=>({cls:(e.ts!=null&&e.ts===_caffTsNeuf)?'caff-neuf':'',html:`<span style="line-height:0;flex-shrink:0">${caffIcone(e.type,22)}</span><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml(e.name)}</div><div style="font-size:var(--fs-xs);color:var(--sub);display:flex;align-items:center;gap:4px"><input type="time" value="${e.time||''}" onchange="updateCaffeineEntryTime('${date}',${i},this.value)" style="background:none;border:none;border-bottom:1px solid var(--border);color:var(--sub);font-size:var(--fs-xs);font-family:Montserrat,sans-serif;cursor:pointer;padding:0;width:52px">${e.volume?'· '+escapeHtml(e.volume):''}</div></div><span style="font-weight:900;color:var(--red-text);font-size:var(--fs-lg);min-width:48px;text-align:right">${e.mg}mg</span><button class="hit44" onclick="deleteCaffeineEntry('${date}',${i},'${deleteFnName}')" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;padding:4px 8px;-webkit-tap-highlight-color:transparent">×</button>`}));
  const _circ=2*Math.PI*48;
  const _off=_circ*(1-pct);
  // Le cercle mesure 120px de diamètre, dont 9px d'anneau de chaque côté : il
  // reste ~100px, moins la marge intérieure. À 44px fixes, « 1200 » débordait
  // sur l'anneau. L'unité « mg » est sortie du même span pour ne plus manger
  // deux caractères de large sur la valeur elle-même.
  // La roue est passee de 120 a 130 px de cote et son rail de 48 a 44 de
  // rayon : les graduations occupent la bande exterieure. Nouvelle
  // circonference, donc, sans quoi l arc de progres serait faux d un tiers.
  const _circ2=2*Math.PI*44;
  const _off2=_circ2*(1-pct);
  const _nbChiffres=String(totalMg).length;
  const _tailleChiffres=_nbChiffres<=3?42:_nbChiffres===4?34:27;
  return `<div class="caf-cadre" style="margin-bottom:16px">
      <!-- LA CANETTE. Volontairement generique : aucune griffe, aucun nom,
           aucune couleur de marque. Ce sont des elements deposes, et cette
           application est vendue : c est Kevin qui serait expose.
           Ce qui est repris, et qui ne se depose pas : la silhouette elancee,
           le metal sombre, l arete lumineuse qui court sur la gauche, les
           griffures, et la condensation. Decorative, donc masquee aux
           lecteurs d ecran. -->
      <svg class="caf-can" viewBox="0 0 70 170" aria-hidden="true" style="right:-6px;bottom:-22px;height:205px;width:auto;opacity:.42;filter:drop-shadow(0 0 14px rgba(255,255,255,.18))">
        <defs>
          <linearGradient id="cafCanCorps" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#000"/><stop offset=".18" stop-color="var(--border)"/>
            <stop offset=".34" stop-color="#0d0d0d"/><stop offset=".72" stop-color="#242424"/>
            <stop offset="1" stop-color="#000"/>
          </linearGradient>
          <linearGradient id="cafCanHaut" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="var(--border)"/><stop offset=".45" stop-color="#7a7a7a"/>
            <stop offset="1" stop-color="#1a1a1a"/>
          </linearGradient>
        </defs>
        <!-- Le corps, avec son retreint haut et bas. -->
        <path d="M16 34 Q12 30 12 24 L12 22 L58 22 L58 24 Q58 30 54 34 L54 138 Q58 142 58 148 L58 152 L12 152 L12 148 Q12 142 16 138 Z" fill="url(#cafCanCorps)"/>
        <!-- Le couvercle. -->
        <ellipse cx="35" cy="21" rx="23" ry="6.5" fill="url(#cafCanHaut)"/>
        <ellipse cx="35" cy="21" rx="15" ry="4" fill="#0a0a0a" opacity=".85"/>
        <path d="M28 20 Q35 17 42 20" stroke="#8a8a8a" stroke-width="1.4" fill="none" opacity=".8"/>
        <!-- L arete lumineuse : c est elle qui fait le metal. -->
        <path d="M19 30 L19 146" stroke="var(--text)" stroke-width="2.4" opacity=".5" stroke-linecap="round"/>
        <path d="M23 34 L23 142" stroke="var(--text)" stroke-width="0.9" opacity=".22" stroke-linecap="round"/>
        <path d="M50 40 L50 136" stroke="var(--text)" stroke-width="1.2" opacity=".14" stroke-linecap="round"/>
        <!-- Trois griffures, longueurs et inclinaisons toutes differentes. -->
        <g stroke="var(--text)" stroke-linecap="round" fill="none" opacity=".42">
          <path d="M27 62 L33 104" stroke-width="2.6"/>
          <path d="M35 56 L40 108" stroke-width="3.4"/>
          <path d="M44 66 L47 98" stroke-width="2"/>
        </g>
        <!-- Condensation : des gouttes, jamais alignees. -->
        <g fill="var(--text)" opacity=".3">
          <circle cx="25" cy="82" r="1.5"/><circle cx="46" cy="74" r="1.1"/>
          <circle cx="30" cy="120" r="1.3"/><circle cx="49" cy="112" r="1.6"/>
          <circle cx="22" cy="104" r="1"/><circle cx="41" cy="130" r="1.2"/>
        </g>
        <!-- Le bord, qui detache la canette du fond. -->
        <path d="M16 34 Q12 30 12 24 L12 22 L58 22 L58 24 Q58 30 54 34 L54 138 Q58 142 58 148 L58 152 L12 152 L12 148 Q12 142 16 138 Z" fill="none" stroke="var(--text)" stroke-width="1.1" opacity=".38"/>
      </svg>
    <div style="display:flex;align-items:center;gap:16px">
      <div style="position:relative;width:130px;height:130px;flex-shrink:0">
        <svg viewBox="0 0 130 130" width="130" height="130" data-palier-neuf="${_palierNeuf?'1':'0'}" style="display:block;overflow:visible;filter:drop-shadow(0 0 5px ${color}) drop-shadow(0 0 14px ${color}88);transition:filter var(--t-3) var(--c-out)">
          <!-- 1. La couronne de graduations. 60 traits, un sur cinq plus long :
               c est ce qui donne l echelle d un instrument plutot qu un cercle. -->
          <g data-caff-col="${color}" style="stroke:${_colDepart};transition:stroke var(--t-3) var(--c-out)" stroke-linecap="butt">
            ${Array.from({length:60},(_,i)=>{
              const a=(i*6-90)*Math.PI/180, gros=i%5===0;
              const r1=59, r2=gros?52:55.5;
              return `<line x1="${(65+r1*Math.cos(a)).toFixed(1)}" y1="${(65+r1*Math.sin(a)).toFixed(1)}"
                x2="${(65+r2*Math.cos(a)).toFixed(1)}" y2="${(65+r2*Math.sin(a)).toFixed(1)}"
                stroke-width="${gros?1.6:0.8}" opacity="${gros?0.5:0.22}"/>`;}).join('')}
          </g>
          <!-- 2. Le rail, INTERROMPU en bas a gauche et en bas a droite. Le
               modele ouvre le cercle a ces deux endroits ; c est ce qui le
               distingue d un simple anneau. -->
          <circle cx="65" cy="65" r="44" fill="none" stroke="var(--border)" stroke-width="7"
            stroke-dasharray="${(_circ2*0.30).toFixed(1)} ${(_circ2*0.05).toFixed(1)}" transform="rotate(-108 65 65)"/>
          <!-- 3. L arc de progres, par-dessus, depuis le haut. -->
          <circle cx="65" cy="65" r="44" fill="none" data-caff-col="${color}" style="stroke:${_colDepart};transition:stroke-dashoffset var(--t-3) var(--c-out),stroke var(--t-3) var(--c-out)"
            stroke-width="7" stroke-linecap="round" stroke-dasharray="${_circ2.toFixed(1)}" stroke-dashoffset="${_circ2.toFixed(1)}" data-arc-off="${_off2.toFixed(1)}" transform="rotate(-90 65 65)"/>
          <!-- 4. Le filet interieur, tres fin : il ferme le cadran. -->
          <circle cx="65" cy="65" r="37.5" fill="none" data-caff-col="${color}" style="stroke:${_colDepart};transition:stroke var(--t-3) var(--c-out)" stroke-width="0.7" opacity=".35"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;padding:0 12px;box-sizing:border-box">
          <div style="display:flex;align-items:baseline;justify-content:center;gap:1px;max-width:100%">
            <span id="caff-total-num" class="txt-hero" data-caff-col="${color}" data-num="${totalMg}" style="color:${_colDepart};font-size:${_tailleChiffres}px;line-height:1;--halo-c:${color};text-shadow:var(--halo-2)66;font-variant-numeric:tabular-nums;transition:color var(--t-3) var(--c-out),text-shadow var(--t-3) var(--c-out)">${totalMg}</span>
            <span style="color:${color};font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:1px;line-height:1;text-transform:uppercase">mg</span>
          </div>
        </div>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-sm);color:var(--sub);margin-bottom:10px">${caffeineEquiv(totalMg)}</div>
        <!-- Le plafond figurait sous le total, collé à l'anneau : ça salissait
             le cercle sans rien dire de plus que la légende, qui donne déjà les
             quatre paliers. Il est rappelé ici, avec le poids qui les calcule. -->
        <div class="caf-titre">Paliers pour <b>${Math.round(wKgAffiche)} kg</b></div>
        <div class="caf-filet"></div>
        <!-- LES QUATRE PALIERS, dont SEUL le courant est plein et blanc. La
             couleur ne sert plus a etiqueter chaque ligne, elle etiquetait
             quatre etats dont trois sont hypothetiques, mais a marquer celui
             ou l athlete se trouve, de la meme teinte que l anneau. -->
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[[`&lt;${thr.green}mg`,'optimal'],[`&lt;${thr.yellow}mg`,'modéré'],
             [`&lt;${thr.orange}mg`,'élevé'],[`&ge;${thr.orange}mg`,'maximum']]
            .map(([v,lib],i)=>`<span class="caf-palier${i===_palier?' caf-actif':''}"${i===_palier?` style="color:${color}"`:''}>`
              +`<span class="caf-pastille"></span>${v}<span class="caf-lib">${lib}</span></span>`).join('')}
        </div>
        ${wEstHtml}
        ${legendeHtml}
      </div>
    </div>
    <div class="caf-filet" style="margin:14px 0 10px"></div>
      <div class="caf-titre" style="font-size:var(--fs-md);letter-spacing:2px">Référence : <b>${thr.red} mg/j</b> max <span style="font-size:var(--fs-xs);letter-spacing:1px">(EFSA)</span></div>
  </div>
  ${isToday?_htmlCafeineCoucher(entries,currentUser):''}
  ${alertHtml}
  <!-- PLUS MASQUÉ HORS D'AUJOURD'HUI. On pouvait naviguer vers hier sans
       pouvoir y écrire : le bouton disparaissait, ce qui cachait le problème
       au lieu de le régler. Le futur reste impossible, la flèche « → » est
       désactivée sur aujourd'hui, et addCaffeineEntry le refuse de toute façon. -->
  <!-- R31, CTA de l'ecran Caféine, mais pas de la Nutrition qui l'embarque :
       la, les capitales vont a « + Ajouter un aliment », et a lui seul. -->
  <button class="btn btn-red${deleteFnName==='embedded'?' btn-casse':''}" onclick="openCaffeineAdd()" style="margin-bottom:20px">+ Enregistrer une prise${isToday?'':' le '+dateLbl}</button>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <div style="width:20px;height:2px;background:var(--red)"></div>
    <h3>${dateLbl}</h3>
  </div>
  ${listHtml}`;
}
function deleteCaffeineEntry(dateStr,idx,screen){
  const days=_caffStore();
  if(!days[dateStr]) return;
  // LA LIGNE SORT AVANT LE RE-RENDU. L'ecriture, elle, est dans le rappel, et
  // le rappel s'execute meme quand l'animation ne part pas : arcRetrait le
  // garantit. Rien n'est conditionne a la reussite de l'animation.
  arcRetrait(arcDernierElement('.rc-ligne'),()=>_deleteCaffeineEntryEcrire(dateStr,idx,screen));
}
function _deleteCaffeineEntryEcrire(dateStr,idx,screen){
  const days=_caffStore();
  if(!days[dateStr]) return;
  days[dateStr].splice(idx,1);
  if(!days[dateStr].length) delete days[dateStr];
  saveUser();
  if(screen==='embedded') _renderCaffeineEmbedded();
  // SUR L'ÉCRAN RÉELLEMENT AFFICHÉ, et non sur _caffReturnToNutrition : ce
  // drapeau n'est posé que par openCaffeineAdd et n'est jamais remis à zéro.
  // Une prise enregistrée depuis Nutrition, puis une suppression faite plus
  // tard depuis l'écran autonome, renvoyaient sur s-nutrition sans raison.
  //
  // Même méthode qu’openCaffeineAdd pour poser ce drapeau : un état observable
  // plutôt qu’un souvenir.
  else if(document.getElementById('s-nutrition')?.classList.contains('active')) loadNutrition();
  else _renderCaffeineScreen();
}
function loadCaffeine(){
  _caffeineViewDate=localISODate(new Date());
  go('s-caffeine');
  _renderCaffeineScreen();
}
function _renderCaffeineScreen(){
  const date=_caffeineViewDate||localISODate(new Date());
  const todayStr=localISODate(new Date());
  const isToday=date===todayStr;
  const [yy,mm,dd]=date.split('-').map(Number);
  const prevStr=localISODate(new Date(yy,mm-1,dd-1));
  const nextStr=localISODate(new Date(yy,mm-1,dd+1));
  const yst=new Date();yst.setDate(yst.getDate()-1);
  const dateLbl=isToday?"Aujourd'hui":date===localISODate(yst)?"Hier":new Date(yy,mm-1,dd).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  // LA MEME BORNE QU addCaffeineEntry. Sans elle, on remontait indéfiniment
  // sur des jours forcément vides — et une prise saisie là-bas était refusée.
  // Le commentaire de CAFF_RETENTION_JOURS exige la même borne des deux côtés.
  const minStr=localISODate(new Date(Date.now()-CAFF_RETENTION_JOURS*24*3600*1000));
  const auFond=prevStr<minStr;
  const navEl=document.getElementById('caff-date-nav');
  if(navEl) navEl.innerHTML=_bandeauJour('caff-date-input',date,'_caffAllerJour',
    {avecFleches:true,prev:auFond?null:prevStr,next:isToday?null:nextStr,
     retention:CAFF_RETENTION_JOURS,libelle:dateLbl});
  const entries=getCaffeineDay(date);
  const totalMg=entries.reduce((s,e)=>s+(e.mg||0),0);
  const {weight:wKg,estimated:_wEst}=getUserWeight();
  const thr=caffeineThresholds(wKg,_ageUtilisateur(currentUser),grossesseSuspend(currentUser));
  document.getElementById('caff-block').innerHTML=_renderCaffeineBlock(entries,totalMg,thr,'screen',date,_wEst,isToday,dateLbl,wKg);
  _animerJauges(document.getElementById('caff-block'));
  requestAnimationFrame(()=>_drawCaffeineHistory(wKg));
}
function updateCaffeineEntryTime(dateStr,idx,val){
  const days=_caffStore();
  if(!days[dateStr]||!days[dateStr][idx]) return;
  days[dateStr][idx].time=val;
  saveUser();
}
// DATE OPTIONNELLE, comme _renderNutriContent en accepte une. Sans elle,
// aujourd'hui : c'est le comportement de l'entrée normale sur l'écran
// Nutrition. Avec elle, on RESTE sur le jour visé — une prise ajoutée pour
// hier doit se voir, sinon l’athlète la croit perdue et la ressaisit.
function loadCaffeineEmbedded(dateAff){
  _caffeineEmbedDate=dateAff||localISODate(new Date());
  _renderCaffeineEmbedded();
}
// Deux aiguilleurs, pour que _bandeauJour garde son contrat : elle appelle
// handler(valeur), et rien d autre. Une chaine vide ramene a aujourd hui,
// comme sur les pas.
// Changer de jour n'est PAS un franchissement de palier : sans cette remise
// a zero, l'app marquerait un evenement qui n'a pas eu lieu.
function _caffAllerJour(v){ _caffeineViewDate=v||null; _caffPalierPrec=null; _renderCaffeineScreen(); }
function _caffEmbedAllerJour(v){ _caffeineEmbedDate=v||null; _caffPalierPrec=null; _renderCaffeineEmbedded(); }
function _renderCaffeineEmbedded(){
  const el=document.getElementById('caff-embedded');
  if(!el) return;
  const date=_caffeineEmbedDate||localISODate(new Date());
  const todayStr=localISODate(new Date());
  const isToday=date===todayStr;
  const [yy,mm,dd]=date.split('-').map(Number);
  const prevStr=localISODate(new Date(yy,mm-1,dd-1));
  const nextStr=localISODate(new Date(yy,mm-1,dd+1));
  const yst=new Date();yst.setDate(yst.getDate()-1);
  const dateLbl=isToday?"Aujourd'hui":date===localISODate(yst)?"Hier":new Date(yy,mm-1,dd).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  // Même borne que sur l’écran autonome, et même rendu désactivé que « → ».
  const minStr=localISODate(new Date(Date.now()-CAFF_RETENTION_JOURS*24*3600*1000));
  const auFond=prevStr<minStr;
  const navPrev=auFond
    ?`<button disabled style="background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:var(--r-2);padding:6px 12px;font-size:var(--fs-lg);cursor:not-allowed">←</button>`
    :`<button onclick="_caffeineEmbedDate='${prevStr}';_renderCaffeineEmbedded()" style="background:none;border:1px solid var(--border);color:var(--text-mid);border-radius:var(--r-2);padding:6px 12px;cursor:pointer;font-size:var(--fs-lg);font-family:Montserrat,sans-serif">←</button>`;
  const navNext=isToday
    ?`<button disabled style="background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:var(--r-2);padding:6px 12px;font-size:var(--fs-lg);cursor:not-allowed">→</button>`
    :`<button onclick="_caffeineEmbedDate='${nextStr}';_renderCaffeineEmbedded()" style="background:none;border:1px solid var(--border);color:var(--text-mid);border-radius:var(--r-2);padding:6px 12px;cursor:pointer;font-size:var(--fs-lg);font-family:Montserrat,sans-serif">→</button>`;
  const entries=getCaffeineDay(date);
  const totalMg=entries.reduce((s,e)=>s+(e.mg||0),0);
  const {weight:wKg,estimated:_wEst}=getUserWeight();
  const thr=caffeineThresholds(wKg,_ageUtilisateur(currentUser),grossesseSuspend(currentUser));
  el.innerHTML=`
    <div style="margin-bottom:12px">
      <h3 class="t-section is-action" style="margin:0;--halo-c:color-mix(in srgb,var(--red) 45%,transparent);text-shadow:var(--halo-1);display:flex;align-items:center;gap:6px">${icon('coffee',11)} Caféine</h3>
    </div>
    ${_bandeauJour('caff-embed-date-input',date,'_caffEmbedAllerJour',{avecFleches:true,prev:auFond?null:prevStr,next:isToday?null:nextStr,retention:CAFF_RETENTION_JOURS,libelle:dateLbl})}
    ${_renderCaffeineBlock(entries,totalMg,thr,'embedded',date,_wEst,isToday,dateLbl,wKg)}
    <div class="divider"></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:20px;height:2px;background:var(--red)"></div>
      <h3>Historique 28 jours</h3>
    </div>
    <div class="card"><canvas id="emb-caff-history-chart" height="140"></canvas></div>
    <div style="height:16px"></div>
  `;
  _animerJauges(el);
  requestAnimationFrame(()=>_drawCaffeineHistory(wKg,'emb-caff-history-chart'));
}
// `porteur` retombe sur currentUser : les deux appels de l'écran athlète ne
// changent pas. Il n'existe que pour la fiche coach, où currentUser est le
// coach et où les seuils doivent suivre l'athlète affiché.
function _drawCaffeineHistory(wKg,canvasId='caff-history-chart',daysOverride,porteur){
  const canvas=document.getElementById(canvasId);
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  // DENSITE D ECRAN. Le canevas etait dimensionne en pixels CSS puis etire
  // par le navigateur : sur un telephone a 3x, 311 pixels reels s affichaient
  // sur 933 — tout etait flou, traits comme texte. On dessine desormais a la
  // densite REELLE et on ramene la taille d affichage en CSS.
  // Plafonnee a 3 : au-dela, le gain est invisible et la surface a peindre
  // croit au carre.
  const _dpr=Math.min(window.devicePixelRatio||1,3);
  const W=canvas.offsetWidth||340;
  const H=parseInt(canvas.getAttribute('height'),10)||140;
  canvas.width=Math.round(W*_dpr);
  canvas.height=Math.round(H*_dpr);
  canvas.style.width=W+'px';
  canvas.style.height=H+'px';
  // Toutes les coordonnees qui suivent restent en unites CSS : le facteur
  // d echelle est porte par la transformation, une seule fois.
  ctx.setTransform(_dpr,0,0,_dpr,0,0);
  const days=daysOverride!==undefined?daysOverride:_caffStore();
  // MÊME faute que dans la fiche coach : cette fonction sert les DEUX écrans.
  // Côté athlète currentUser est le bon porteur ; côté coach, non.
  const _p=porteur||currentUser;
  const thr=caffeineThresholds(wKg,_ageUtilisateur(_p),grossesseSuspend(_p));
  const labels=[],data=[];
  for(let i=27;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const key=localISODate(d);
    const total=(days[key]||[]).reduce((s,e)=>s+(e.mg||0),0);
    labels.push(i===0?'Auj':d.getDate()+'');
    data.push(total);
  }
  const maxVal=Math.max(thr.red*1.1,...data,1);
  const PAD={t:14,b:24,l:10,r:10};
  const chartW=W-PAD.l-PAD.r,chartH=H-PAD.t-PAD.b;
  const slotW=chartW/28;
  const barW=Math.max(4,slotW-3);
  const yDe=mg=>PAD.t+chartH*(1-mg/maxVal);
  const yRed=yDe(thr.red);
  // Les quatre paliers, ceux-la memes que la roue et la liste. Une seule
  // ligne rouge ne disait pas ou se situait une barre a mi-hauteur.
  const REPERES=[[thr.green,'var(--text)',.16],[thr.yellow,null,.16],
                 [thr.orange,'#f59e0b',.20],[thr.red,'#ef4444',.55]];
  // Les couleurs des jetons ne sont pas lisibles par un canvas : il faut des
  // valeurs litterales. Resolues UNE fois, sur l element, plutot que codees
  // en dur — sans quoi elles divergeraient du reste de l application.
  const _cs=getComputedStyle(document.documentElement);
  const _jeton=n=>(_cs.getPropertyValue(n)||'').trim()||'#888';
  const drawFrame=p=>{
    ctx.clearRect(0,0,W,H);
    // ── 1. Le fond de traçage ────────────────────────────────────────
    const gFond=ctx.createLinearGradient(0,PAD.t,0,PAD.t+chartH);
    gFond.addColorStop(0,'rgba(255,255,255,.030)');
    gFond.addColorStop(1,'rgba(255,255,255,.006)');
    ctx.fillStyle=gFond;ctx.fillRect(PAD.l,PAD.t,chartW,chartH);
    // La meme trame diagonale que la carte : les deux doivent appartenir au
    // meme objet, pas se juxtaposer.
    ctx.save();
    ctx.beginPath();ctx.rect(PAD.l,PAD.t,chartW,chartH);ctx.clip();
    ctx.strokeStyle='rgba(255,255,255,.028)';ctx.lineWidth=1;
    for(let x=-chartH;x<chartW+chartH;x+=9){
      ctx.beginPath();ctx.moveTo(PAD.l+x,PAD.t);ctx.lineTo(PAD.l+x+chartH,PAD.t+chartH);ctx.stroke();
    }
    ctx.restore();
    // ── 2. Les quatre reperes ────────────────────────────────────────
    REPERES.forEach(([mg,col,alpha])=>{
      if(!(mg>0)||mg>maxVal) return;
      const y=yDe(mg);
      ctx.save();
      ctx.setLineDash(mg===thr.red?[5,4]:[2,5]);
      // `null` veut dire « prends le jeton --info » : un canvas ne sait pas
      // lire var(--info), et l ecrire en dur ici le ferait diverger du reste.
      ctx.strokeStyle=col||_jeton('--info');
      ctx.globalAlpha=alpha;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(PAD.l,y);ctx.lineTo(W-PAD.r,y);ctx.stroke();
      ctx.restore();
    });
    // ── 3. Le socle ──────────────────────────────────────────────────
    const gSocle=ctx.createLinearGradient(PAD.l,0,W-PAD.r,0);
    gSocle.addColorStop(0,'rgba(255,255,255,0)');
    gSocle.addColorStop(.5,'rgba(255,255,255,.30)');
    gSocle.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=gSocle;ctx.fillRect(PAD.l,PAD.t+chartH,chartW,1);
    // ── 4. Les barres ────────────────────────────────────────────────
    data.forEach((v,i)=>{
      const x=PAD.l+i*slotW+(slotW-barW)/2;
      const base=PAD.t+chartH;
      if(!v){
        // UN JOUR SANS PRISE N EST PAS UN JOUR SANS DONNEE, mais rien ne les
        // distinguait : les deux etaient du vide. Un point les separe.
        ctx.fillStyle='rgba(255,255,255,.13)';
        ctx.beginPath();ctx.arc(x+barW/2,base-2.5,1.2,0,Math.PI*2);ctx.fill();
        return;
      }
      const barH=Math.max(2,(v/maxVal)*chartH)*p;
      const y=base-barH;
      const col=_caffeineColor(v,thr);
      const c=col.indexOf('var(')===0?_jeton(col.slice(4,-1)):col;
      const auj=(i===27);
      ctx.save();
      // Ombre portee : c est elle qui decolle la barre du fond.
      // Halos resserres : ils compensaient en partie le flou du canevas.
      // A la densite reelle, ils n ont plus a le faire.
      ctx.shadowColor=c;ctx.shadowBlur=auj?7:3;
      const g=ctx.createLinearGradient(0,y,0,base);
      g.addColorStop(0,c);
      g.addColorStop(1,'rgba(0,0,0,.55)');
      ctx.fillStyle=g;
      if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,barW,barH,2);ctx.fill();}
      else ctx.fillRect(x,y,barW,barH);
      ctx.restore();
      // Liseré clair sur l arete gauche : le volume tient a ce seul trait.
      if(barW>=4&&barH>3){
        ctx.fillStyle='rgba(255,255,255,.34)';
        ctx.fillRect(x,y+1,1,barH-1);
      }
      // LE JOUR MEME : contour et repere, pour le trouver sans compter.
      if(auj&&barH>3){
        ctx.save();
        ctx.strokeStyle=_tok('--text','#efefef');ctx.globalAlpha=.65;ctx.lineWidth=1;
        if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x+.5,y+.5,barW-1,barH-1,2);ctx.stroke();}
        else ctx.strokeRect(x+.5,y+.5,barW-1,barH-1);
        ctx.globalAlpha=1;ctx.fillStyle=c;
        ctx.beginPath();ctx.moveTo(x+barW/2,y-3);ctx.lineTo(x+barW/2-3,y-8);ctx.lineTo(x+barW/2+3,y-8);
        ctx.closePath();ctx.fill();
        ctx.restore();
      }
    });
    // ── 5. Les dates ─────────────────────────────────────────────────
    ctx.fillStyle='#6a6a6a';ctx.font='700 9px Montserrat,sans-serif';ctx.textAlign='center';
    [0,7,14,21,27].forEach(i=>{
      if(i===27){ctx.save();ctx.fillStyle=_tok('--text','#efefef');ctx.fillText(labels[i]||'',PAD.l+i*slotW+slotW/2,H-6);ctx.restore();return;}
      ctx.fillText(labels[i]||'',PAD.l+i*slotW+slotW/2,H-6);
    });
  };
  // Cette toile est PERMANENTE dans le document : le drapeau la rend eligible
  // au balayage, et le rappel ci-dessous le declenche APRES le dessin. Sans
  // les deux, go('s-caffeine') balayait une toile blanche et le WeakSet la
  // condamnait pour toutes les visites suivantes.
  canvas.dataset.arcPret='1';
  const _apresTrace=()=>{ try{ requestAnimationFrame(()=>arcTracerCourbes(canvas)); }catch(e){} };
  if(canvas._histAnimated){drawFrame(1);_apresTrace();return;}
  // La preference systeme n'atteint ni element.animate() ni une boucle rAF :
  // on pose l'image finale et on ne demarre rien.
  if(arcReduit()){ drawFrame(1); canvas._histAnimated=true; _apresTrace(); return; }
  canvas._histAnimated=true;
  if(canvas._histAnimId) cancelAnimationFrame(canvas._histAnimId);
  const dur=400,t0=performance.now();
  const ease=t=>1-(1-t)*(1-t);
  const tick=now=>{
    const p=ease(Math.min((now-t0)/dur,1));
    drawFrame(p);
    if(p<1) canvas._histAnimId=requestAnimationFrame(tick); else _apresTrace();
  };
  canvas._histAnimId=requestAnimationFrame(tick);
}
// LA TROISIÈME SORTIE DE L’ÉCRAN DE SAISIE, à côté des deux validations.
//
// Le bouton retour appelait loadNutrition() EN DUR : on revenait sur
// Nutrition même en étant arrivé depuis l’écran autonome, et l’appel sans
// argument remettait _caffeineEmbedDate à aujourd’hui — renoncer à une saisie
// déplaçait donc le jour du bloc embarqué.
//
// MÊME DRAPEAU que les deux autres sorties, posé par openCaffeineAdd. Trois
// façons de quitter cet écran, une seule règle pour savoir où l’on retombe.
//
// ON NE REVIENT PAS SUR UN JOUR : rien n’a été écrit, donc rien à retrouver.
// On rend chaque écran à la date qu’il affichait — `_caffeineEmbedDate` pour
// le bloc embarqué, `_caffeineViewDate` que _renderCaffeineScreen relit.
function fermerCaffeineAdd(){
  // MÊME DÉFAUT QUE LES DEUX VALIDATIONS, et il n’était pas dans la demande :
  // renoncer à une saisie de caféine ramenait aussi le journal alimentaire à
  // aujourd’hui. Trois sorties, une seule règle.
  if(_caffReturnToNutrition) loadNutrition(_fjDate||undefined,_caffeineEmbedDate);
  else{ go('s-caffeine'); _renderCaffeineScreen(); }
}
function openCaffeineAdd(){
  _caffReturnToNutrition=document.getElementById('s-nutrition')?.classList.contains('active')||false;
  _pendingCaffProduct=null;
  go('s-caffeine-add');
  const panel=document.getElementById('caff-confirm-panel');
  if(panel) panel.style.display='none';
  document.querySelectorAll('.caff-type-btn').forEach(b=>b.classList.remove('active'));
  const first=document.querySelector('.caff-type-btn');
  if(first) first.classList.add('active');
  switchCaffeineType('coffee',null);
}
function switchCaffeineType(type,btn){
  _pendingCaffProduct=null;
  const panel=document.getElementById('caff-confirm-panel');
  if(panel) panel.style.display='none';
  if(btn){
    document.querySelectorAll('.caff-type-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  const pw=document.getElementById('caff-preworkout-info');
  if(pw) pw.style.display=(type==='preworkout')?'':'none';
  renderCaffeineProducts(type);
}
function renderCaffeineProducts(type){
  const grid=document.getElementById('caff-products-grid');
  if(!grid) return;
  if(type==='custom'){
    grid.innerHTML=`<div style="grid-column:1/-1">
      <div class="form-group" style="margin-bottom:10px">
        <label class="form-label">Nom de la boisson</label>
        <input class="form-input" id="caff-custom-name" placeholder="Ex: Thé glacé maison"/>
      </div>
      <div class="form-group" style="margin-bottom:10px">
        <label class="form-label">Caféine (mg)</label>
        <input class="form-input" id="caff-custom-mg" type="number" min="1" max="1000" placeholder="Ex: 80"/>
      </div>
      <div class="form-group" style="margin-bottom:16px">
        <label class="form-label">Volume / portion (optionnel)</label>
        <input class="form-input" id="caff-custom-volume" placeholder="Ex: 330ml"/>
      </div>
      <button class="btn btn-red" onclick="saveCaffeineCustom()">Enregistrer</button>
    </div>`;
    return;
  }
  const products=CAFFEINE_DB.filter(p=>p.type===type);
  grid.innerHTML=products.map(p=>{
    const safe=encodeURIComponent(JSON.stringify(p));
    return `<div class="caff-product-tile" data-id="${p.id}" onclick="confirmCaffeineAdd(decodeURIComponent('${safe}'))" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="margin-bottom:8px;line-height:0">${caffIcone(p.type,26)}</div>
      <div style="font-weight:800;font-size:var(--fs-sm);line-height:1.3;margin-bottom:4px">${p.name}</div>
      <div style="color:var(--red-text);font-weight:900;font-size:var(--fs-md)">${p.mg}mg</div>
      <div style="color:var(--sub);font-size:var(--fs-xs)">${p.volume}</div>
    </div>`;
  }).join('');
}
function confirmCaffeineAdd(pRaw){
  const p=typeof pRaw==='string'?JSON.parse(pRaw):pRaw;
  _pendingCaffProduct=p;
  document.querySelectorAll('.caff-product-tile').forEach(t=>{
    t.style.outline=t.dataset.id===p.id?'2px solid var(--red)':'none';
  });
  _renderCaffeineConfirmPanel(1);
}
function _renderCaffeineConfirmPanel(qty){
  const p=_pendingCaffProduct;
  const panel=document.getElementById('caff-confirm-panel');
  if(!p||!panel) return;
  panel.style.display='block';
  const totalMg=p.mg*qty;
  const vol=qty>1?qty+' × '+p.volume:p.volume||'';
  panel.innerHTML=`<div style="background:var(--dark);border:1px solid var(--red);border-radius:var(--r-3);padding:14px 16px;margin-top:14px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <span style="line-height:0;flex-shrink:0">${caffIcone(p.type,26)}</span>
      <div style="flex:1">
        <div style="font-weight:800;font-size:var(--fs-md)">${escapeHtml(p.name)}</div>
        <div style="color:var(--red-text);font-weight:900;font-size:var(--fs-lg)">${totalMg}mg</div>
        <div style="color:var(--sub);font-size:var(--fs-xs)">${vol}</div>
      </div>
      <button onclick="cancelCaffeineAdd()" style="background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer;padding:4px">×</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${[1,2,3].map(n=>`<button onclick="_renderCaffeineConfirmPanel(${n})" style="flex:1;padding:10px 0;background:${qty===n?'var(--red)':'var(--surface-2)'};border:1px solid ${qty===n?'var(--red)':'var(--border)'};border-radius:var(--r-2);color:${qty===n?'var(--text)':'var(--sub)'};font-family:Montserrat,sans-serif;font-size:var(--fs-lg);font-weight:900;cursor:pointer">×${n}</button>`).join('')}
    </div>
    <button onclick="_commitCaffeineAdd(${qty})" style="width:100%;padding:12px 0;background:var(--red);border:none;color:var(--text);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:800;letter-spacing:1.5px;border-radius:var(--r-3);cursor:pointer">AJOUTER</button>
  </div>`;
}
function cancelCaffeineAdd(){
  _pendingCaffProduct=null;
  const panel=document.getElementById('caff-confirm-panel');
  if(panel) panel.style.display='none';
  document.querySelectorAll('.caff-product-tile').forEach(t=>t.style.outline='none');
}
function _commitCaffeineAdd(qty){
  const p=_pendingCaffProduct;
  if(!p) return;
  const now=new Date();
  const hhmm=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const name=qty>1?p.name+' ×'+qty:p.name;
  const _d=_caffDateCourante();
  // L horodatage est SORTI de l objet : c est lui qui sert de marqueur, et il
  // faut le retenir avant de le confier a addCaffeineEntry.
  const _ts=Date.now();
  const _ok=addCaffeineEntry({id:p.id,name,icon:p.icon,mg:p.mg*qty,volume:p.volume||'',type:p.type,time:hhmm,ts:_ts},_d);
  _pendingCaffProduct=null;
  if(!_ok){ toast('Jour hors de portée : la prise n’a pas été enregistrée.','var(--orange)'); return; }
  _caffTsNeuf=_ts;
  toast(name+' ajouté '+ICO.coche);
  // ON RESTE SUR LE JOUR OU LA PRISE A ETE ECRITE. loadCaffeine remettait
  // _caffeineViewDate à aujourd’hui et loadNutrition() faisait de même pour
  // _caffeineEmbedDate : la prise partait au bon jour, mais l’écran revenait
  // à aujourd’hui et elle semblait perdue.
  // `_fjDate` EN PREMIER ARGUMENT. Laissé à undefined, _renderNutriContent
  // retombait sur _renderFjDaySummary(aujourd’hui) — qui ÉCRIT `_fjDate` au
  // passage. Ajouter un café sur hier ramenait donc le journal alimentaire à
  // aujourd’hui, et la saisie d’aliment suivante partait dans le mauvais jour.
  //
  // `||undefined` : `_fjDate` vaut null tant que le journal n’a jamais été
  // ouvert, et le repli sur aujourd’hui doit rester dans ce cas-là.
  if(_caffReturnToNutrition) loadNutrition(_fjDate||undefined,_d);
  // L’ÉCRAN N’ÉTAIT PAS RAMENÉ. _renderCaffeineScreen ne fait que remplir
  // #caff-date-nav et #caff-block ; loadCaffeine, qu’elle a remplacée ici,
  // faisait le go() en plus. On restait donc sur s-caffeine-add après
  // « AJOUTER », avec l’impression que rien ne s’était passé — alors que la
  // prise était écrite.
  //
  // go() ET SURTOUT PAS loadCaffeine() : celle-ci remet _caffeineViewDate à
  // AUJOURD’HUI, ce qui referait le défaut que le commentaire ci-dessus
  // décrit — la prise sur hier, l’écran revenu à aujourd’hui.
  else{ go('s-caffeine'); _renderCaffeineScreen(); }
}
function saveCaffeineCustom(){
  const name=(document.getElementById('caff-custom-name')||{}).value?.trim();
  const mg=parseInt((document.getElementById('caff-custom-mg')||{}).value||'0');
  const volume=(document.getElementById('caff-custom-volume')||{}).value?.trim()||'';
  if(!name||mg<1){toast('Remplis le nom et la dose en mg');return;}
  const now=new Date();
  const hhmm=now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  // Mémorisée AVANT l’ajout, comme dans _commitCaffeineAdd : c’est le jour
  // sur lequel il faudra revenir.
  const _d=_caffDateCourante();
  // Meme marqueur que _commitCaffeineAdd : ajouter une boisson personnalisee
  // est le meme geste, la ligne doit se signaler pareil.
  const _ts=Date.now();
  const _ok=addCaffeineEntry({id:'custom',name,icon:'cafe',mg,volume,type:'custom',time:hhmm,ts:_ts},_d);
  if(!_ok){ toast('Jour hors de portée : la prise n’a pas été enregistrée.','var(--orange)'); return; }
  _caffTsNeuf=_ts;
  toast(name+' ajouté '+ICO.coche);
  // `_fjDate` EN PREMIER ARGUMENT. Laissé à undefined, _renderNutriContent
  // retombait sur _renderFjDaySummary(aujourd’hui) — qui ÉCRIT `_fjDate` au
  // passage. Ajouter un café sur hier ramenait donc le journal alimentaire à
  // aujourd’hui, et la saisie d’aliment suivante partait dans le mauvais jour.
  //
  // `||undefined` : `_fjDate` vaut null tant que le journal n’a jamais été
  // ouvert, et le repli sur aujourd’hui doit rester dans ce cas-là.
  if(_caffReturnToNutrition) loadNutrition(_fjDate||undefined,_d);
  // L’ÉCRAN N’ÉTAIT PAS RAMENÉ. _renderCaffeineScreen ne fait que remplir
  // #caff-date-nav et #caff-block ; loadCaffeine, qu’elle a remplacée ici,
  // faisait le go() en plus. On restait donc sur s-caffeine-add après
  // « AJOUTER », avec l’impression que rien ne s’était passé — alors que la
  // prise était écrite.
  //
  // go() ET SURTOUT PAS loadCaffeine() : celle-ci remet _caffeineViewDate à
  // AUJOURD’HUI, ce qui referait le défaut que le commentaire ci-dessus
  // décrit — la prise sur hier, l’écran revenu à aujourd’hui.
  else{ go('s-caffeine'); _renderCaffeineScreen(); }
}

// ======= VIDEOS =======
// LE REPLI D'UNE VIDEO QUI NE CHARGE PAS. Sans lui, le navigateur laissait son
// lecteur noir, muet, avec un bouton de lecture qui ne fait rien : l'athlete
// touchait dix fois avant de conclure que l'application etait cassee.
//
// LE CAS EST PREVU AILLEURS DANS LE FICHIER, en toutes lettres : « plan Spark :
// pas de suppression distante Cloudinary [...] le fichier peut etre purge depuis
// le dashboard ». Une video purgee la-bas laisse donc son URL dans le dossier,
// et c'est exactement ce que cette fonction rencontre.
//
// LE BOUTON DE RETRAIT EST LA VRAIE REPARATION : la ligne ne sert plus a rien,
// et sans lui l'athlete n'a aucun moyen de s'en debarrasser. On ne retire QUE
// l'entree locale — le fichier distant, lui, n'a jamais ete joignable d'ici.
//
// L'IDENTIFIANT SE LIT SUR L'ELEMENT, pas dans l'attribut : le construire dans
// une chaine onerror demanderait un echappement de plus, sur une valeur qui
// vient du dossier. `vc-video-<id>` est pose par _buildVideoCard ; l'ecran du
// coach, lui, passe l'identifiant par defaut et n'offre donc pas le retrait.
function _videoIndisponible(el){
  if(!el||!el.parentNode) return false;
  const id=String(el.id||'').startsWith('vc-video-')?el.id.slice('vc-video-'.length):'';
  const mail=(currentUser&&currentUser.email)||'';
  const d=document.createElement('div');
  d.className='video-absente';
  d.style.cssText='margin-top:8px;padding:14px;border:1px dashed var(--border);'
    +'border-radius:var(--r-2);background:var(--surface-2);text-align:center';
  d.innerHTML='<div style="font-size:var(--fs-sm);font-weight:800;margin-bottom:4px">Vidéo indisponible</div>'
    +'<div class="sub" style="font-size:var(--fs-xs);line-height:1.55">Le fichier n\'est plus chez l\'hébergeur. '
    +'Le lien reste dans ta liste, mais il ne mène plus à rien.</div>';
  if(id&&mail){
    const b=document.createElement('button');
    b.className='btn btn-outline btn-sm';
    b.style.cssText='margin-top:10px';
    b.textContent='Retirer de ma liste';
    // Fonction NOMMEE et non attribut : un `await` dans un onclick en ligne ne
    // compile pas, et le gestionnaire n'existe alors tout simplement pas.
    b.onclick=()=>{ _retirerVideoAbsente(mail,id); };
    d.appendChild(b);
  }
  el.replaceWith(d);
  return true;
}
async function _retirerVideoAbsente(email,id){
  if(!await rcConfirm('Retirer cette vidéo de ta liste ?',
    'Le fichier n\'est plus chez l\'hébergeur : seule l\'entrée disparaît.','Retirer')) return false;
  await deleteVideo(email,id);
  return true;
}
// ══ UNE URL DE VIDEO VIENT DU DOSSIER DE L'ATHLETE (30/09/2026) ═══════════════
// Elle etait posee telle quelle dans src et href, sur l'ecran du coach : un
// guillemet, et la suite devenait du HTML (onerror…), avec le jeton de
// rafraichissement du coach a portee dans localStorage. Seuls passent
// Cloudinary, Firebase Storage et YouTube ; le reste rend un texte.
const VIDEO_HOTES_SURS=Object.freeze(['res.cloudinary.com','firebasestorage.googleapis.com']);
const VIDEO_HOTES_YT=Object.freeze(['youtu.be','youtube.com','www.youtube.com','m.youtube.com']);
function urlVideoSure(url){
  const u=normaliserUrlVideo(url);
  if(!u) return '';
  let x=null; try{ x=new URL(u); }catch(e){ return ''; }
  if(x.protocol!=='https:'||x.username||x.password) return '';
  const h=x.hostname.toLowerCase();
  return (VIDEO_HOTES_SURS.indexOf(h)>=0||VIDEO_HOTES_YT.indexOf(h)>=0)?u:'';
}
function _videoEmbed(url,vidId='vc-video'){
  if(!url) return '';
  url=urlVideoSure(url);
  if(!url) return `<div style="margin-top:8px;padding:10px 14px;background:var(--surface-2);border-radius:var(--r-2);color:var(--sub);font-size:var(--fs-sm)">Lien vidéo invalide</div>`;
  const ytM=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if(ytM) return `<iframe src="https://www.youtube.com/embed/${ytM[1]}" frameborder="0" allowfullscreen style="width:100%;height:190px;border-radius:var(--r-2);margin-top:8px"></iframe>`;
  if(/\.(mp4|mov|webm|mkv)(\?|$)/i.test(url)) return `<video id="${escapeHtml(vidId)}" src="${escapeHtml(url)}" controls preload="none" playsinline webkit-playsinline onerror="_videoIndisponible(this)" style="width:100%;border-radius:var(--r-2);margin-top:8px;max-height:220px;background:#000"></video>`;
  return `<a href="${safeUrl(url)}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:10px 14px;background:var(--surface-2);border-radius:var(--r-2);color:var(--red-text);font-size:var(--fs-sm);font-weight:700;text-decoration:none">Voir la vidéo</a>`;
}

// Carte de fin de séance. Elle ne dépose rien : elle renvoie vers l'écran
// Vidéos EXISTANT, avec le nom de l'exercice déjà écrit dans le champ. Il n'y
// a donc qu'un seul endroit dans l'app où l'on dépose une vidéo.
function renderCarteAFilmer(sess){
  try{ renderVideosAEnvoyer(); }catch(e){}
  const z=document.getElementById('wd-afilmer');
  if(!z) return;
  const noms=((sess&&sess.aFilmer)||[]).filter(Boolean);
  if(!noms.length){ z.innerHTML=''; return; }
  z.innerHTML=`<div class="card card--dense" style="margin-bottom:16px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">À filmer</div>
    <div style="font-size:var(--fs-sm);color:#ccc;line-height:1.6;margin-bottom:10px">Tu voulais filmer : ${noms.map(n=>escapeHtml(n)).join(', ')}</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${noms.map((n,i)=>`<button class="btn btn-outline btn-sm wd-af-btn" data-i="${i}" style="width:100%;margin:0">Déposer la vidéo de ${escapeHtml(n)}</button>`).join('')}
    </div>
  </div>`;
  // Handler posé en JS, hors attribut : un nom d'exercice contient des
  // apostrophes et des accents, et rien de tout cela n'a à être relu comme du
  // code dans un onclick. Même règle que les boutons de l'écran de séance.
  z.querySelectorAll('.wd-af-btn').forEach(b=>{
    const n=noms[parseInt(b.getAttribute('data-i'),10)];
    b.onclick=()=>loadVideos(n);
  });
}

let _vidsSorted=[];
function loadVideos(nomPrerempli){
  go('s-videos');
  // ══ LE VERROU (lot 4). L'envoi et le champ de lien disparaissent — ils ne
  // menent nulle part sans coach — et la liste porte la phrase. Le reste de
  // l'ecran ne bouge pas.
  //
  // ⚠ IL EST POSE APRES LA PRE-SAISIE DU NOM, a dessein : le champ garde ce
  //   qu'on lui a passe, et l'ecran redevient entier le jour ou le dossier
  //   s'ouvre. Rien ne se perd derriere le verrou.
  const _vrr=rcVerrou('correctionVideo');
  for(const _id of ['vid-envoi','vid-lien']){
    const _e=document.getElementById(_id); if(_e) _e.style.display=_vrr?'none':'';
  }
  // Pré-saisie venue de la carte de fin de séance ou d'une demande du coach.
  // Sans argument, le champ est laissé tel quel : les appels existants ne
  // changent pas de comportement.
  const _nom=document.getElementById('vid-name-input');
  if(_nom&&nomPrerempli) _nom.value=String(nomPrerempli);
  if(_vrr){ const _l=document.getElementById('vid-list'); if(_l) _l.innerHTML=_vrr; return; }
  _renderVideosListe();
}
// LA LISTE SEULE, SANS go() ni champ pre-rempli — voir _repeindreVideosAthlete.
function _renderVideosListe(){
  // LA MIGRATION DU LOT 7, ICI : c'est le seul ecran ou ces commentaires se
  // lisent, et le dossier est deja en main. Elle ne fait rien sur un dossier
  // qui n'a jamais eu de comparaison, c'est-a-dire presque tous.
  try{ if(migrerComparaisons(currentUser)) saveUser(); }catch(e){ rcErreurMuette('_renderVideosListe',e); }
  _vidsSorted=(currentUser.videos||[]).slice().sort((a,b)=>b.date-a.date);
  const el=document.getElementById('vid-list');
  if(!_vidsSorted.length){
    el.innerHTML=emptyState('video','Aucune vidéo envoyée.<br>Filme ton exercice et envoie la vidéo pour recevoir les corrections de ton coach.','Envoyer ma première vidéo','_focusEnvoiVideo()');
    return;
  }
  // LE PREAVIS EST POSE ICI, AU RENDU, et c'est ce qui autorise l'expiration
  // sept jours plus tard. Une annonce que personne n'a eue a l'ecran n'annonce
  // rien : tant que cette ligne n'a pas tourne, rien ne peut partir.
  const _marques=(()=>{ try{ const n=marquerPreavisVideos(currentUser); if(n) saveUser(); return n; }
    catch(e){ return 0; } })();
  const _purge=(()=>{ try{ return phraseRetentionListe(currentUser); }catch(e){ return ''; } })();
  el.innerHTML=(_purge
      ?'<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);'
       +'padding:10px 12px;margin-bottom:12px;font-size:var(--fs-2xs);color:var(--sub);line-height:1.55">'
       +escapeHtml(_purge)+'</div>'
      :'')
    +'<div id="vid-card-list"></div>'
    +(()=>{ try{ return htmlCorrectionsOrphelines(currentUser); }catch(e){ return ''; } })()
    +'<button id="vid-more-btn" onclick="loadMoreVideos()" style="display:none;width:100%;margin-top:10px;padding:10px;background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);font-size:var(--fs-sm);cursor:pointer;font-family:Montserrat,sans-serif;font-weight:700;letter-spacing:.5px;min-height:44px">Voir plus de vidéos</button>';
  _renderVideoBatch(0,20);
}
function _renderVideoBatch(from,count){
  const list=document.getElementById('vid-card-list');
  const btn=document.getElementById('vid-more-btn');
  if(!list) return;
  const lot=_vidsSorted.slice(from,from+count);
  list.insertAdjacentHTML('beforeend',lot.map(_buildVideoCard).join(''));
  // Fermeture de la boucle : le retour est consulté dès que sa carte est
  // rendue, puisque c'est à ce moment que le commentaire du coach est à
  // l'écran — il n'y a pas d'« ouverture » de carte, la liste affiche tout.
  // Marqué ICI et non dans _buildVideoCard, qui construit une chaîne et doit
  // le rester : une écriture par lot au lieu d'une par vidéo.
  // Limité au lot RENDU : une correction restée sur la page suivante garde sa
  // pastille tant que « voir plus » n'a pas été touché.
  const vus=lot.filter(v=>v&&v.feedbackSeen===false);
  if(vus.length){
    vus.forEach(v=>{v.feedbackSeen=true;});
    // _vidsSorted porte les mêmes objets que currentUser.videos (slice est
    // superficiel) : la mutation ci-dessus est donc bien celle qu'on persiste.
    saveUser();
    _majPastilleVideos();
  }
  const more=_vidsSorted.length-(from+count);
  if(btn){
    if(more>0){btn.textContent='Voir '+(more>20?20:more)+' vidéo'+(more!==1?'s':'')+' de plus';btn.style.display='block';}
    else btn.style.display='none';
  }
}
function loadMoreVideos(){
  const shown=document.getElementById('vid-card-list')?.children.length||0;
  _renderVideoBatch(shown,20);
}
// ⚠ ELLE N'EST PLUS `async`, ET C'ETAIT TOUT LE BUG. Elle ne contient aucun
// `await` — le mot-cle etait decoratif — mais il suffisait a lui faire rendre
// une PROMESSE au lieu d'une chaine. _renderVideoBatch fait
// `lot.map(_buildVideoCard).join('')` : une liste de promesses concatenee
// donne « [object Promise] », repete autant de fois qu'il y a de videos.
// C'est ce que l'eleve lisait en bas de son ecran, et c'est aussi pourquoi
// aucune correction n'etait accessible : les cartes n'existaient pas.
function _buildVideoCard(v){
  // MOTION LAB : une correction vidéo compte comme un retour du coach, et
  // s'ouvre d'un bouton — c'est la première chose que l'athlète doit voir.
  const _motion=(()=>{ try{ return motionCorrectionValide(v.motion); }catch(e){ return null; } })();
  // LES ANNOTATIONS DU MOTION LAB comptent aussi comme un retour du coach.
  const _annot=(()=>{ try{ return annotAMontrer(v.annot); }catch(e){ return false; } })();
  const hasFb=v.feedback||v.feedbackTimestamps?.length||_motion||_annot;
  const tsInner=_renderTsAnnotations(v.feedbackTimestamps||[],{readonly:true,videoId:'vc-video-'+v.id});
  const tsBlock=tsInner?`<div style="margin-top:8px">${tsInner}</div>`:'';
  const motionBtn=(_motion||_annot)?`<button class="btn btn-red btn-sm" style="width:100%;margin:${v.feedback||tsInner?'10px':'2px'} 0 0" onclick="ouvrirCorrectionMotion('${escapeHtml(currentUser?.email||'')}','${escapeHtml(v.id)}')">${_motion?'Voir la correction vidéo · '+_motionDuree(_motion.dureeMs):'Voir ma vidéo annotée par mon coach'}</button>`:'';
  const fbBlock=hasFb?`<div style="background:var(--surface-2);border-radius:var(--r-2);padding:10px;margin-top:10px;font-size:var(--fs-sm)"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="color:var(--sub);font-size:var(--fs-xs);font-weight:700">FEEDBACK COACH</span>${v.feedbackDate?`<span style="font-size:var(--fs-xs);color:var(--text-dim)">${new Date(v.feedbackDate).toLocaleDateString('fr-FR')}</span>`:''}</div>${v.feedback?`<p style="margin:0;line-height:1.5">${escapeHtml(v.feedback)}</p>`:''}${tsBlock}${motionBtn}</div>`:'';
  // ⚠ LE BOUTON « COMPARER AVEC LA PREMIERE PRISE » EST PARTI AU LOT 7, avec
  //   tout le comparateur. Ce qui le remplace n'est pas un autre bouton :
  //   c'est la correction directe, qui existait deja a cote.
  const _meta=(()=>{ const s=libLienVideo(v.lien); return s
    ?`<div style="font-size:var(--fs-2xs);color:var(--red-text);font-weight:800;letter-spacing:.5px;margin-top:2px">${escapeHtml(s)}</div>`:''; })();
  // ── LA RETENTION, SUR LA CARTE ───────────────────────────────────────────
  // ⚠ LE BANDEAU PORTE LES DEUX GESTES QUI SAUVENT LE FICHIER, et il les porte
  //   LA, sur la vidéo concernée : un message général en haut de liste ne dit
  //   pas laquelle part, et ne se rattrape pas d'un clic.
  const _ret=(()=>{ try{ return videoRetention(v); }catch(e){ return {etat:'loin'}; } })();
  const _epi=videoEpinglee(v);
  const _bandeau=(_ret.etat==='preavis'||_ret.etat==='a prevenir')
    ?`<div style="background:var(--surface-2);border:1px solid var(--orange,#c97a12);border-radius:var(--r-2);padding:8px 10px;margin-top:8px">
        <div style="font-size:var(--fs-2xs);color:var(--orange,#e0891a);font-weight:800;letter-spacing:.5px">
          EXPIRE DANS ${_ret.jours||0} JOUR${(_ret.jours||0)>1?'S':''}</div>
        <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-top:2px">
          Le fichier sera supprimé de l’hébergeur. Le nom, la date et le retour de ton coach restent.</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-outline btn-sm btn-doigt" style="flex:1" onclick="gardeVideo('${escapeHtml(v.id)}')">Garder</button>
          <button class="btn btn-outline btn-sm btn-doigt" style="flex:1" onclick="telechargerVideo('${escapeHtml(v.id)}')">Télécharger</button>
        </div></div>`
    :'';
  // UNE EXPIREE RESTE A L'ECRAN, et dit ce qui s'est passe. La faire
  // disparaitre serait exactement la purge muette qu'on refuse.
  if(videoExpiree(v)){
    const _le=v.expireeLe?new Date(v.expireeLe).toLocaleDateString('fr-FR'):'';
    return `<div class="video-card" style="opacity:.82"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><div style="font-weight:700;font-size:var(--fs-md);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(v.name)}</div><span class="badge" style="margin-left:8px;flex-shrink:0">Expirée</span></div>`
      +`<div class="sub" style="font-size:var(--fs-xs)">${dateLocaleDeCle(v.date).toLocaleDateString('fr-FR')}</div>${_meta}`
      +`<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.5;margin-top:6px">`
      +`Le fichier a été supprimé de l’hébergeur${_le?' le '+_le:''}, après ${VIDEO_RETENTION_J} jours. `
      +`Ce qui reste est ici : la date, le nom${v.feedback?' et le retour de ton coach':''}.</div>`
      +`${fbBlock}</div>`;
  }
  return `<div class="video-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><div style="font-weight:700;font-size:var(--fs-md);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(v.name)}</div><span class="badge ${hasFb?'badge-green':'badge-orange'}" style="margin-left:8px;flex-shrink:0">${hasFb?icon('coche',14)+' Corrigée':'En attente'}</span><button onclick="_demanderSuppressionVideo(${jsArg(currentUser.email)},${jsArg(v.id)})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:var(--fs-xl);line-height:1;padding:0 0 0 8px;flex-shrink:0" title="Supprimer">×</button></div><div class="sub" style="font-size:var(--fs-xs)">${dateLocaleDeCle(v.date).toLocaleDateString('fr-FR')}${_epi?' · <span style="color:var(--red-text);font-weight:800">gardée</span>':''}</div>${_meta}${_videoEmbed(v.url,'vc-video-'+v.id)}${_bandeau}${fbBlock}</div>`;
}
/**
 * LA PHRASE DU HAUT DE LISTE. Elle dit trois choses et rien d'autre : combien
 * de vidéos sont en sursis, combien sont gardées sur combien, et ce qui a déjà
 * expiré. Vide quand il n'y a rien à dire — un bandeau permanent finit par ne
 * plus être lu, et c'est ce jour-là qu'il aurait servi.
 */
function phraseRetentionListe(user,maintenant){
  const bouts=[];
  try{
    const pre=videosEnPreavis(user,maintenant);
    const epi=videosEpinglees(user).length;
    if(pre.length) bouts.push(pre.length+' vidéo'+(pre.length>1?'s expirent':' expire')
      +' bientôt : « Garder » '+(pre.length>1?'les':'la')+' met'+(pre.length>1?'':'')
      +' de côté pour toujours, « Télécharger » '+(pre.length>1?'les':'la')+' récupère.');
    if(epi) bouts.push(epi+' gardée'+(epi>1?'s':'')+' sur '+VIDEO_EPINGLES_MAX+' (les gardées n’expirent jamais).');
    else bouts.push('Les vidéos sont supprimées de l’hébergeur après '+VIDEO_RETENTION_J
      +' jours. « Garder » en épingle jusqu’à '+VIDEO_EPINGLES_MAX+' pour toujours.');
    const j=phraseJournalExpirations(maintenant);
    if(j) bouts.push(j);
    const d=phraseDormant(user,maintenant);
    if(d) bouts.push(d);
  }catch(e){}
  return bouts.join(' ');
}
/** « Garder » : l'épingle, avec son plafond annoncé. */
function gardeVideo(id){
  const r=basculerEpingleVideo(currentUser,id);
  if(!r.ok){ toast(r.raison,'var(--orange)'); return false; }
  saveUser();
  CLOUD.pushOne(currentUser.email,currentUser).catch(()=>{});
  toast(r.epingle?('Gardée. Elle n’expirera pas'+(r.reste!==undefined?', '+r.reste+' place'+(r.reste>1?'s':'')+' restante'+(r.reste>1?'s':''):'')+'.')
                 :'Elle reprend le cours normal : '+VIDEO_RETENTION_J+' jours.',
    r.epingle?'var(--green)':'var(--sub)');
  _renderVideosListe();
  return true;
}
/**
 * PURE. L'URL QUI FAIT ENREGISTRER AU LIEU D'OUVRIR (lot 7).
 *
 * ⚠ `download` SUR UN AUTRE DOMAINE EST IGNORE. Le navigateur ouvre la video
 *   dans un onglet, et la personne croit avoir sauvegarde. Cloudinary sait
 *   faire mieux : `fl_attachment` pose l'en-tete Content-Disposition cote
 *   serveur, et le fichier part dans les telechargements sans passer par la
 *   memoire du telephone — une video de trente megaoctets n'a rien a faire
 *   dans un Blob sur un appareil qui n'en a plus.
 *
 * Rend '' quand ce n'est pas un fichier de chez nous : un lien YouTube ou
 * Drive colle par l'athlete n'est pas notre fichier, et il ne se telecharge
 * pas comme ca.
 */
function urlTelechargementVideo(v){
  const u=String((v&&v.url)||'');
  if(u.indexOf('res.cloudinary.com')<0) return '';
  const i=u.indexOf('/upload/');
  if(i<0) return '';
  const nom=(String((v&&v.name)||'video').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Za-z0-9]+/g,'-').replace(/^-+/,'').replace(/-+$/,'')||'video').slice(0,40);
  return u.slice(0,i+8)+'fl_attachment:'+nom+'/'+u.slice(i+8);
}
/**
 * « Télécharger » : le fichier, dans la galerie.
 *
 * ⚠ LES DEUX PLATEFORMES NE SE RESSEMBLENT PAS, et un seul chemin en laisse
 *   une sur le carreau.
 *   iOS : Safari ignore largement `download`. La seule voie vers Photos est la
 *     feuille de partage — « Enregistrer la vidéo » y figure. On prepare donc
 *     le fichier et on ouvre la feuille.
 *   Android et bureau : l'URL `fl_attachment` suffit, et ne charge rien en
 *     memoire.
 *
 * ET QUAND RIEN NE MARCHE, ON LE DIT. Mieux vaut un geste de plus qu'un
 * fichier qu'on croit avoir mis a l'abri : la video s'ouvre, et la phrase dit
 * l'appui long, qui propose « Ajouter aux photos » sur iPhone.
 */
async function telechargerVideo(id){
  const v=(currentUser.videos||[]).find(x=>x&&x.id===id);
  if(!v||!v.url){ toast('Plus de fichier à télécharger.','var(--orange)'); return false; }
  const dl=urlTelechargementVideo(v);
  const nomFichier=(String(v.name||'video').replace(/[^\w .-]+/g,'_')||'video')+'.mp4';
  // ── iOS : LA FEUILLE DE PARTAGE, ET ELLE SEULE ────────────────────────
  if(_estIOS()&&typeof navigator!=='undefined'&&navigator.share){
    toast('Préparation…','var(--sub)');
    try{
      const r=await fetch(dl||v.url,{mode:'cors'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const b=await r.blob();
      const f=new File([b],nomFichier,{type:b.type||'video/mp4'});
      if(navigator.canShare&&navigator.canShare({files:[f]})){
        await navigator.share({files:[f]});
        toast('Choisis « Enregistrer la vidéo » pour l’ajouter à Photos.','var(--green)');
        return true;
      }
    }catch(e){
      // Un partage refuse par la personne n'est pas un echec : on se tait.
      if(e&&(e.name==='AbortError'||e.name==='NotAllowedError')) return false;
    }
  }
  // ── ANDROID ET BUREAU : l'en-tete de l'hebergeur fait le travail ──────
  if(dl){
    try{
      const a=document.createElement('a');
      a.href=dl; a.download=nomFichier; a.rel='noopener';
      document.body.appendChild(a); a.click(); a.remove();
      toast('Téléchargement lancé.','var(--green)');
      return true;
    }catch(e){}
  }
  // ── LE REPLI, ET IL DIT CE QU'IL FAUT FAIRE ──────────────────────────
  try{ window.open(v.url,'_blank','noopener'); }catch(x){}
  toast(_estIOS()
    ?'Elle s’ouvre : appui long sur la vidéo, puis « Ajouter aux photos ».'
    :'Elle s’ouvre dans un onglet : enregistre-la depuis là.','var(--orange)');
  return false;
}

// LE BOUTON « × » NE FAISAIT RIEN, ET AUCUNE ERREUR N'EN SORTAIT. Il portait
// `onclick="if(await rcConfirm(...))deleteVideo(...)"` : le contenu d'un
// gestionnaire en ligne est compile comme le corps d'une fonction ORDINAIRE, et
// un `await` y est une erreur de syntaxe. Le gestionnaire n'etait donc jamais
// cree — verifie : `typeof bouton.onclick` vaut « object », c'est-a-dire null,
// et le clic ne declenche rien du tout. Depuis le passage de confirm() a
// rcConfirm(), supprimer une video etait impossible, en silence.
//
// UNE FONCTION NOMMEE, donc, appelee en « lance et oublie » comme partout
// ailleurs dans le fichier.
async function _demanderSuppressionVideo(email,id){
  if(!await rcConfirm('Supprimer cette vidéo ?',null,'Supprimer')) return false;
  await deleteVideo(email,id);
  return true;
}
// ══════════════ LA SUPPRESSION DISTANTE, ET SA FILE D'ATTENTE ═════════════
//
// CE QUI NE MARCHAIT PAS. « Supprimer une vidéo » retirait la ligne du dossier
// et laissait le fichier chez Cloudinary — pour toujours. Le commentaire de
// deleteVideo le disait en passant (« le fichier peut être purgé depuis le
// dashboard »), le toast annonçait « Vidéo supprimée ». Côté photos de
// progression, la révocation ne pouvait effacer une copie transmise que dans
// les DIX MINUTES du `delete_token` ; au-delà elle rendait la liste des
// identifiants restants, honnêtement, et rien ne pouvait plus les effacer.
//
// CE QUI CHANGE. Une seule porte, `_cldDetruire`, qui appelle la fonction
// serveur `cloudinaryDestroy` (voir functions/index.js) — la seule à détenir
// l'API secret. TOUT CE QU'ELLE NE DÉTRUIT PAS ENTRE DANS UNE FILE LOCALE,
// rejouée au démarrage suivant, et que l'on peut lire : « où est passée ma
// vidéo ? » a une réponse, et « elle est supprimée » n'est plus dit quand c'est
// faux.
//
// ⚠ LA FONCTION N'EST PAS ENCORE DÉPLOYÉE. Le projet est en plan Spark :
//   mesuré le 23/09/2026, les trois fonctions existantes répondent 404. La file
//   est donc, aujourd'hui, le mécanisme RÉEL — et scripts/purge_cloudinary_orphelins.py
//   est l'outil qui purge pour de bon, sous le contrôle de Kevin. Le jour où le
//   projet passe en Blaze, `firebase deploy --only functions` suffit : la file
//   se vide d'elle-même à la première ouverture, sans rien changer à l'app.
//
// ⚠ ON N'INSISTE PAS DANS LE VIDE. Une fonction absente répond 404 à chaque
//   appel : vingt suppressions feraient vingt requêtes inutiles et autant
//   d'attentes. Le premier 404 de la session coupe les appels — on met en file
//   directement, sans bruit. Le démarrage suivant réessaiera.
const CLD_FILE_CLE='rc_cloudinary_a_purger';
const CLD_FILE_MAX=400;
let _cldIndispo=false;          // 404 vu dans cette session : la fonction n'est pas là
let _cldRejeuFait=false;

function cldFileLire(){
  try{ const l=JSON.parse(localStorage.getItem(CLD_FILE_CLE)||'[]');
    return Array.isArray(l)?l.filter(x=>x&&x.publicId):[]; }catch(e){ return []; }
}
function cldFileEcrire(l){
  try{ localStorage.setItem(CLD_FILE_CLE,JSON.stringify((l||[]).slice(0,CLD_FILE_MAX)));
    return true; }catch(e){ return false; }
}
// DÉDOUBLONNÉE PAR publicId, et elle garde la PREMIÈRE date : c'est depuis
// quand le fichier attend, et c'est ce qui compte pour qui la lit.
function cldFileAjouter(publicId,type,extra){
  if(!publicId) return false;
  const l=cldFileLire();
  const deja=l.find(x=>x.publicId===publicId);
  if(deja){
    if(extra&&extra.raison) deja.raison=extra.raison;
    deja.essais=(deja.essais||1)+1;
    return cldFileEcrire(l);
  }
  l.push(Object.assign({publicId,type:type||'image',depuis:Date.now(),essais:1},extra||{}));
  // ET DANS LE DOSSIER, pour que Kevin la voie. Sans saveUser ici : cette
  // fonction est appelee en boucle pendant une purge, et l'appelant
  // enregistre une fois a la fin.
  try{ cldDossierAjouter(publicId,type,(extra||{}).cloudName); }catch(e){}
  return cldFileEcrire(l);
}
function cldFileRetirer(publicId){
  cldDossierRetirer(publicId);
  return cldFileEcrire(cldFileLire().filter(x=>x.publicId!==publicId));
}
// ══ LA MEME FILE, DANS LE DOSSIER ════════════════════════════════════════
//
// Elle y sert UNE seule chose : que Kevin puisse la lire. L'export de la base
// la contient, et scripts/cloudinary_purge.mjs supprime ce qu'elle nomme.
//
// ⚠ LEGERE PAR CONSTRUCTION. Le dossier part EN ENTIER a chaque
//   synchronisation : une entree pese une centaine d'octets, on en garde cent
//   cinquante au plus, et on ne garde que ce qui sert a supprimer — un
//   identifiant, un type, une date. Ni nom de fichier, ni raison, ni compte
//   d'essais : ca, c'est l'affaire du local.
const CLD_DOSSIER_MAX=150;
function cldDossierLire(u){
  const x=u||currentUser;
  const l=(x&&x.cloudinaryAPurger);
  return Array.isArray(l)?l.filter(e=>e&&e.publicId):[];
}
function cldDossierAjouter(publicId,type,cloudName){
  const u=currentUser;
  if(!u||!publicId) return false;
  const l=cldDossierLire(u);
  if(l.some(e=>e.publicId===publicId)) return false;
  l.push({publicId:String(publicId),type:(type==='video'?'video':'image'),
    le:Date.now(),cloud:String(cloudName||'')});
  u.cloudinaryAPurger=l.slice(-CLD_DOSSIER_MAX);
  return true;
}
function cldDossierRetirer(publicId){
  const u=currentUser;
  if(!u||!Array.isArray(u.cloudinaryAPurger)) return false;
  const avant=u.cloudinaryAPurger.length;
  u.cloudinaryAPurger=u.cloudinaryAPurger.filter(e=>e&&e.publicId!==publicId);
  if(u.cloudinaryAPurger.length===avant) return false;
  if(!u.cloudinaryAPurger.length) delete u.cloudinaryAPurger;
  return true;
}
// ══ ET ELLE SE VIDE TOUTE SEULE QUAND LE FICHIER A VRAIMENT DISPARU ══════
//
// Le script supprime chez Cloudinary ; il ne peut pas ecrire dans les dossiers
// des athletes. Sans quoi la liste grossirait pour toujours, et Kevin
// redemanderait chaque mois la suppression de ce qui est deja supprime.
//
// ON DEMANDE DONC AU FICHIER. Une requete de tete sur l'URL : 404, il n'est
// plus la, l'entree part. CINQ PAR DEMARRAGE AU PLUS — c'est un menage de
// fond, pas une urgence, et personne n'attend apres lui.
async function cldDossierMenage(maxi){
  const u=currentUser;
  if(!u||!CLOUD.ok()) return 0;
  const l=cldDossierLire(u);
  if(!l.length) return 0;
  let n=0;
  for(const e of l.slice(0,Math.max(1,Number(maxi)||5))){
    const cloud=String(e.cloud||'').trim();
    if(!cloud) continue;
    const url='https://res.cloudinary.com/'+encodeURIComponent(cloud)+'/'
      +(e.type==='video'?'video':'image')+'/upload/'+String(e.publicId);
    try{
      const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),6000);
      const r=await fetch(url,{method:'HEAD',signal:ctrl.signal});
      // 404 : le fichier est parti, l'entree n'a plus de raison d'etre.
      // 200 : il est encore la, on la garde. Toute autre reponse — reseau,
      // 401, 403 — ne prouve rien, et on ne jette rien sur un doute.
      if(r.status===404){ cldDossierRetirer(e.publicId); cldFileRetirer(e.publicId); n++; }
    }catch(err){}
  }
  if(n){ try{ saveUser(); }catch(err){ rcErreurMuette('cldDossierMenage',err); } }
  return n;
}
// CE QUE L'ÉCRAN PEUT ANNONCER : combien, et depuis quand le plus ancien.
function cldFileEtat(){
  const l=cldFileLire();
  if(!l.length) return {nb:0};
  const plusVieux=l.reduce((a,b)=>(a.depuis||0)<(b.depuis||0)?a:b);
  return {nb:l.length,depuis:plusVieux.depuis,jours:Math.floor((Date.now()-(plusVieux.depuis||Date.now()))/864e5)};
}

// LA PORTE UNIQUE. Rend {ok:true} quand le fichier n'est PLUS chez l'hébergeur —
// « introuvable » compris, c'est le résultat qu'on voulait. Rend {ok:false} et
// INSCRIT EN FILE dans tous les autres cas, y compris hors ligne.
async function _cldDetruire(publicId,type,opts){
  const o=opts||{};
  if(!publicId) return {ok:true,rien:true};
  const entree={type:type||'image'};
  if(o.proprietaire) entree.proprietaire=o.proprietaire;
  if(o.quoi) entree.quoi=o.quoi;
  if(_cldIndispo){
    cldFileAjouter(publicId,type,Object.assign({raison:'service de suppression indisponible'},entree));
    return {ok:false,raison:'indisponible'};
  }
  try{
    const r=await CLOUD._callFn('cloudinaryDestroy',{
      publicId,resourceType:(type==='video'?'video':'image'),
      proprietaire:o.proprietaire||''});
    if(r&&(r.result==='ok'||r.result==='not found')){
      cldFileRetirer(publicId);
      return {ok:true,resultat:r.result};
    }
    cldFileAjouter(publicId,type,Object.assign({raison:'réponse inattendue'},entree));
    return {ok:false,raison:'réponse inattendue'};
  }catch(e){
    const m=String(e&&e.message||e);
    // UN REFUS DÉFINITIF SORT DE LA FILE. 400 (identifiant invalide) ou 403
    // (pas le tien, pas ton athlète) : rejouer la même demande donnera la même
    // réponse à chaque démarrage, pour toujours. Une panne, un 409 (propriétaire
    // pas encore indexé) ou un 503 restent, eux, en file.
    if(e&&(e.statut===400||e.statut===403)){
      cldFileRetirer(publicId);
      return {ok:false,raison:m,definitif:true};
    }
    // LE SERVICE EST-IL LA ? Deux formes, et la seconde m'a surpris : une
    // fonction non deployee repond 404 SANS en-tete CORS, donc le navigateur ne
    // rend pas le 404 — il leve une erreur reseau. Mesure au banc le
    // 23/09/2026 : « Impossible de joindre le serveur ». Un appareil vraiment
    // hors ligne donne le meme message, et c'est tres bien : dans les deux cas,
    // insister vingt fois dans la meme session ne sert a rien, et la file, elle,
    // garde tout jusqu'au prochain demarrage.
    // Le serveur léger ajoute la sienne : 503 tant que les clés Cloudinary
    // n'y sont pas posées, ou Cloudinary injoignable.
    if(/\(404\)/.test(m)||/introuvable sur le serveur/i.test(m)
       ||/Impossible de joindre le serveur/i.test(m)
       ||/pas encore configurée|injoignable/i.test(m)) _cldIndispo=true;
    cldFileAjouter(publicId,type,Object.assign({raison:m.slice(0,120)},entree));
    return {ok:false,raison:m};
  }
}

// LE REJEU, AU DÉMARRAGE. Une fois par session, jamais avant que l'app soit
// debout, et jamais sans jeton : sans authentification la fonction refuse, et
// l'entrée serait comptée comme un essai pour rien.
//
// ⚠ IL NE BLOQUE RIEN et n'affiche rien. C'est un travail de fond : ce qui
//   reste en file reste lisible, et l'écran de confidentialité l'annonce.
async function cldFileRejouer(){
  if(_cldRejeuFait) return 0;
  _cldRejeuFait=true;
  if(!navigator.onLine||!CLOUD.canWrite()) return 0;
  // L'INDEX DES MÉDIAS D'ABORD : sans lui, le serveur ne sait pas à qui
  // appartient repcore/<id>/… et la suppression attend (409).
  try{ await CLOUD.poserProprioMedias(currentUser); }catch(e){}
  const l=cldFileLire();
  if(!l.length) return 0;
  let partis=0;
  for(const e of l.slice(0,40)){          // par paquets : le reste attendra la prochaine fois
    if(_cldIndispo) break;
    const r=await _cldDetruire(e.publicId,e.type,
      {proprietaire:e.proprietaire,cloudName:e.cloudName,quoi:e.quoi});
    if(r.ok) partis++;
  }
  if(partis) console.log('[RepCore] file Cloudinary : '+partis+' média(s) détruit(s) pour de bon, '
    +cldFileLire().length+' en attente');
  return partis;
}
async function deleteVideo(email,videoId){
  const users=DB.get('users')||{};
  const u=users[email];
  if(!u||!Array.isArray(u.videos)) return;
  // Contrôle d'appartenance : ses propres vidéos ou celles d'un élève de son coaching
  if(u.email!==currentUser?.email&&u.coachId!==currentUser?.id){toast('Élève introuvable ou non autorisé','var(--orange)');return;}
  const vid=u.videos.find(v=>v.id===videoId);
  if(!vid) return;
  // LA PIERRE AVANT LE RETRAIT, comme pour les seances et les bilans : depuis
  // que _mergeUser unit les videos, une entree retiree ici et absente du cloud
  // reviendrait a la descente suivante si rien ne disait qu'elle a ete
  // supprimee pour de bon.
  marquerSupprime(u,'videos',videoId);
  u.videos=u.videos.filter(v=>v.id!==videoId);
  u.updatedAt=Date.now();
  users[email]=u;
  const ok=DB.set('users',users);
  if(currentUser?.email===email){currentUser.videos=u.videos;currentUser.updatedAt=u.updatedAt;}
  toastSync(ok,CLOUD.pushOne(email,u),'Vidéo supprimée','la suppression est');
  loadVideos();
  // LA COPIE CHEZ L'HEBERGEUR, ET LA VERITE DESSUS. Jusqu'ici le toast
  // annoncait « Vidéo supprimée » alors que le fichier restait chez Cloudinary
  // POUR TOUJOURS — un upload non signe ne permet pas de l'effacer, et le
  // commentaire d'ici renvoyait l'utilisateur au tableau de bord Cloudinary,
  // qu'il n'a pas. On tente maintenant la destruction reelle par la fonction
  // serveur ; ce qui ne part pas entre dans la file a purger, et on le DIT.
  //
  // APRES le toast et le rendu, jamais avant : un aller-retour reseau ne doit
  // pas retenir l'ecran pour un geste deja effectue localement.
  if(vid.cloudinaryPublicId){
    const _d=await _cldDetruire(vid.cloudinaryPublicId,'video',
      {proprietaire:email,cloudName:vid.cloudinaryName,quoi:'vidéo '+(vid.name||'')});
    if(!_d.ok) toast('Retirée de l’app. La copie chez l’hébergeur n’a pas pu être effacée : '
      +'elle est inscrite à purger.','var(--orange)');
  }
}
function addVideoLink(){
  const inp=document.getElementById('vid-url-input');
  const url=(inp?.value||'').trim();
  if(!url) return toast('Colle un lien vidéo','var(--orange)');
  if(!/^https?:\/\//i.test(url)) return toast('Le lien doit commencer par https://','var(--orange)');
  // LA MEME LISTE QUE L'AFFICHAGE ET LA REGLE (30/09/2026) : YouTube, ou un
  // fichier depose dans l'app. Un autre lien serait refuse par le serveur.
  if(!urlVideoSure(url)) return toast('Lien non accepté : colle un lien YouTube, ou dépose la vidéo directement dans l’app.','var(--orange)');
  const _saisi=((document.getElementById('vid-name-input')||{}).value||'').trim();
  let name='Vidéo';
  const ytM=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if(ytM) name='Vidéo YouTube';
  else if(url.includes('drive.google.com')) name='Vidéo Google Drive';
  else{const seg=url.split('/').pop().split('?')[0];if(seg) name=decodeURIComponent(seg).replace(/\.(mp4|mov|webm|mkv)$/i,'');}
  if(_saisi) name=_saisi;
  if(!currentUser.videos) currentUser.videos=[];
  // La forme que la regle admet : https://youtu.be/<id> pour tout lien YouTube.
  const _urlOk=ytM?'https://youtu.be/'+ytM[1]:url;
  currentUser.videos.push({id:'v_'+Date.now(),name,url:_urlOk,date:Date.now(),size:'-',feedback:null});
  // Une vidéo portant le nom de l'exercice éteint la demande du coach. Rien
  // n'est notifié : la demande disparaît, c'est tout.
  consommerDemandeVideo(name,currentUser);
  const ok=saveUser();
  const _nomEl=document.getElementById('vid-name-input'); if(_nomEl) _nomEl.value='';
  if(inp) inp.value='';
  const hint=document.getElementById('vid-drive-hint');if(hint) hint.style.display='none';
  toastEcriture(ok,'Vidéo ajoutée !','la vidéo est référencée');
  loadVideos();
}
function _cloudinaryUserMsg(e,kind){
  const m=(e.message||'').toLowerCase();
  // ⚠ CES TROIS-LÀ PASSENT AVANT LES AUTRES. « Envoi annulé » contient
  //   « envoi », et se serait fait traduire en « Erreur d'envoi : vérifie
  //   ta connexion » — on aurait accusé le réseau d'un geste volontaire.
  if(/envoi annulé|annulé par/.test(m))
    return 'Envoi annulé. Rien n’est parti, et le fichier est intact sur ton téléphone.';
  if(/délai dépassé/.test(m))
    return 'Le réseau ne répond plus depuis deux minutes : réessaie en Wi-Fi si tu peux.';
  if(/plus lourd que l’original|ne sait pas alléger|compression/.test(m))
    return 'Ton téléphone ne sait pas alléger cette vidéo : filme plus court, ou baisse la qualité vidéo dans les réglages.';
  // Un morceau refusé porte son code : c'est un refus de contenu, pas une
  // panne, et le redire « réessaie » ferait tourner en rond.
  if(/erreur serveur 4/.test(m)&&!/401|413/.test(m))
    return 'Un morceau de la vidéo a été refusé par le serveur : reprends l’envoi depuis le début.';
  if(/file size too large|exceeds.*maximum|too large|erreur serveur 413/.test(m))
    return 'Fichier trop volumineux : réduis la taille'+(kind==='video'?' ou la durée de la vidéo':'');
  if(/upload preset not found|unknown api key|invalid upload preset|erreur serveur 401/.test(m))
    return "Configuration d'envoi invalide : vérifie tes paramètres vidéo";
  if(/not allowed|unsupported format|invalid.*file|file type/.test(m))
    return kind==='audio'
      ?'Format non supporté : utilise MP3, M4A ou WebM'
      :'Format non supporté : utilise MP4, MOV, WebM ou MKV';
  if(/erreur serveur 5/.test(m))
    return "Service d'envoi momentanément indisponible : réessaie dans quelques instants";
  return "Erreur d'envoi : vérifie ta connexion et réessaie";
}
// `options` EST FACULTATIF ET ARRIVE EN SECOND : les appels existants —
// l'entree de fichier de l'ecran Videos — ne changent pas d'un iota. Avec lui,
// l'entree ecrite porte son rattachement a la serie.
// ══════════════ LES PLAFONDS, ET D'OÙ ILS VIENNENT ═════════════════════════
//
// ⚠ LE PLAFOND CLIENT ÉTAIT AU-DESSUS DU PLAFOND RÉEL, et c'est la pire des
// combinaisons. 300 Mo étaient acceptés à l'écran ; Cloudinary refuse au-delà
// de 100 Mo par requête en plan gratuit. Entre les deux, l'envoi montait
// jusqu'à 100 %, attendait, puis échouait — on faisait payer deux minutes de
// données mobiles pour un refus qu'on pouvait annoncer en une seconde.
//
// Au-delà de VIDEO_MAX_OCTETS_REQUETE, le fichier part en MORCEAUX. Le plafond
// qui reste, VIDEO_MAX_OCTETS_TOTAL, n'est plus celui du transport : c'est
// celui du bon sens. Une demi-heure d'envoi pour une vidéo qu'un coach regarde
// dans un lecteur de 400 px n'a aucune contrepartie.

/** Plafond Cloudinary par requête, plan gratuit. Au-delà : découpage. */
const VIDEO_MAX_OCTETS_REQUETE=100*1024*1024;
/** Plafond après découpage. Au-delà, on refuse AVANT d'attendre. */
// ⚠ DEUX PLAFONDS, ET PAS UN. Les confondre casse l'un ou l'autre des deux
//   cas, et c'est ce qui est arrivé deux fois.
//
//   VIDEO_MAX_OCTETS_ENVOI — CE QUE CLOUDINARY ACCEPTE DE RECEVOIR. Cent
//   mégaoctets, et le découpage en morceaux NE LÈVE PAS cette limite : elle
//   porte sur la taille de l'ASSET, pas sur celle d'une requête. Mesuré, sur le
//   PREMIER morceau d'un fichier de 121 Mo : « File size too large. Got
//   127063304. Maximum is 104857600. » Il se vérifie APRÈS l'allègement, sur ce
//   qui part réellement.
//
//   VIDEO_MAX_OCTETS_SOURCE — CE QU'ON ACCEPTE D'ESSAYER D'ALLÉGER. Beaucoup
//   plus haut, parce qu'une vidéo de téléphone de 300 Mo descend couramment
//   sous 20 Mo en 720p : la refuser sur sa taille d'origine reviendrait à
//   refuser le cas que l'allègement existe pour traiter. Il se vérifie AVANT,
//   et ne sert qu'à écarter ce qui ne tiendrait de toute façon pas en mémoire.
const VIDEO_MAX_OCTETS_ENVOI=100*1024*1024;
const VIDEO_MAX_OCTETS_TOTAL=500*1024*1024;
/**
 * La hauteur visée à la compression. Le coach regarde dans un lecteur de
 * 400 px de large : 720 est déjà au-dessus du nécessaire, et c'est la
 * résolution que tous les encodeurs matériels acceptent.
 * ⚠ C'EST UNE BORNE, PAS UNE CIBLE : une vidéo déjà en 480p n'est jamais
 * agrandie. Agrandir ne rajoute aucun détail, ça ne fait que peser.
 */
const VIDEO_CIBLE_HAUTEUR=720;
/** Débit visé, en bits par seconde. 2,5 Mbit/s en 720p30 tient largement un
 *  mouvement de musculation, où le fond ne bouge pas. */
const VIDEO_CIBLE_DEBIT=2500000;
/** Trois minutes. Au-delà, ce n'est plus une série, c'est une séance — et
 *  personne ne la regarde en entier. */
const VIDEO_DUREE_MAX_S=180;
/**
 * Le plafond audio, qui traînait à 300 Mo lui aussi. Un message vocal de coach
 * dépasse rarement la minute ; vingt-cinq mégaoctets laissent de la marge pour
 * un fichier importé, et restent sous le plafond Cloudinary par requête.
 */
const AUDIO_MAX_OCTETS=25*1024*1024;
/**
 * L'INACTIVITÉ, pas la durée. Deux minutes sans un octet qui bouge, c'est une
 * ligne morte ; deux minutes d'envoi qui avance, c'est un envoi qui avance.
 * ⚠ `XMLHttpRequest.timeout` MESURE LA DURÉE TOTALE, pas l'inactivité : posé à
 * 120 s il tuerait un envoi légitime de 80 Mo sur un réseau lent. On le garde
 * comme plafond absolu par MORCEAU — là, 120 s veut dire 50 ko/s, c'est-à-dire
 * mort — et on surveille l'inactivité à la main pour l'envoi simple.
 */
const ENVOI_INACTIVITE_MS=120000;
/** Le plafond absolu d'un morceau. Un morceau est borné par construction. */
const ENVOI_MORCEAU_TIMEOUT_MS=120000;

