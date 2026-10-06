// ══ LE CARNET D'ADRESSES ═════════════════════════════════════════════════
//
// Demande de Kevin, 08/09/2026 : « un petit CRM ou on retrouve tous les mails
// de chacun avec le nom, le genre et le numero de telephone ». Ces trois
// informations existaient deja, eparpillees sur autant de fiches qu'il y a
// d'athletes : les reunir sur un ecran, c'est tout ce qu'il manquait.
//
// ⚠ IL N'ENVOIE RIEN, IL OUVRE. Comme le message groupe : RepCore n'a pas de
// serveur de courrier, et se mettre a en avoir un ferait entrer l'application
// dans un metier qui n'est pas le sien. Un tap ouvre le client mail, le
// telephone ou WhatsApp de l'appareil — c'est le coach qui envoie.
//
// PURE. La ligne d'un athlete, sortie a part pour etre eprouvable sans DOM.
function _crmLigne(c){
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||'Sans nom';
  const femme=isFemale(c.gender);
  const genre=c.gender?(femme?'Femme':'Homme'):'-';
  const mail=String(c.email||'').trim();
  const tel=String(c.phone||'').trim();
  const coul=femme?VIG_ROSE:VIG_BLEU;
  const lien=(url,txt,titre)=>url
    ?`<a href="${escapeHtml(url)}" ${/^https/.test(url)?'target="_blank" rel="noopener"':''}
        style="color:var(--link);text-decoration:none;word-break:break-all">${escapeHtml(txt)}</a>`
    :`<span class="sub" style="font-size:var(--fs-2xs)">${escapeHtml(titre)}</span>`;
  return `<div style="display:grid;grid-template-columns:1fr;gap:4px;padding:10px 0;
    border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="color:${coul};font-size:14px;line-height:1">${c.gender?(femme?'♀':'♂'):'·'}</span>
      <span style="font-weight:800;font-size:var(--fs-sm)">${escapeHtml(nom)}</span>
      <span class="sub" style="font-size:var(--fs-2xs)">${escapeHtml(genre)}</span>
    </div>
    <div style="font-size:var(--fs-xs)">${lien(mail?'mailto:'+mail:'',mail,'pas d\'adresse')}</div>
    <div style="font-size:var(--fs-xs);display:flex;gap:12px;flex-wrap:wrap">
      ${lien(tel?'tel:'+tel.replace(/[^+0-9]/g,''):'',tel,'pas de numéro')}
      ${tel?lien('https://wa.me/'+tel.replace(/[^0-9]/g,''),'WhatsApp',''):''}
    </div>
  </div>`;
}
// PURE. Toutes les adresses, séparées par des points-virgules — la forme que
// tous les clients mail savent coller dans un champ « À ».
function _crmAdresses(clients){
  return (clients||[]).map(c=>String((c&&c.email)||'').trim())
    .filter(e=>e.indexOf('@')>0).join('; ');
}
function ouvrirCrmCoach(){
  if(!peutConsulterBanque()&&currentUser.role!=='coach'){ toast('Réservé aux coachs.','var(--orange)'); return false; }
  const l=getClients().slice().sort((a,b)=>
    String((a.fname||'')+(a.lname||'')).localeCompare(String((b.fname||'')+(b.lname||''))));
  const adresses=_crmAdresses(l);
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <h2 style="margin-bottom:4px;font-size:var(--fs-lg)">CARNET D'ADRESSES</h2>
    <div class="sub" style="font-size:var(--fs-xs);margin-bottom:12px">${l.length} athlète${l.length>1?'s':''}. Un tap ouvre ton mail, ton téléphone ou WhatsApp : RepCore n'envoie rien à ta place.</div>
    ${adresses?`<button class="btn btn-outline btn-sm" style="width:100%;margin:0 0 12px" onclick="_crmCopierAdresses()">Copier toutes les adresses</button>`:''}
    ${l.length?_htmlSectionsSuivi(l,_crmLigne):'<div class="sub" style="text-align:center;padding:24px 0">Aucun athlète pour l\'instant.</div>'}
    <button class="btn btn-outline" style="margin-top:16px" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
async function _crmCopierAdresses(){
  const a=_crmAdresses(getClients());
  if(!a){ toast('Aucune adresse à copier.','var(--orange)'); return false; }
  try{ await navigator.clipboard.writeText(a); toast('Adresses copiées','var(--green)'); return true; }
  catch(e){ toast('Copie refusée par le navigateur.','var(--orange)'); return false; }
}
// `ids` et `corps` (06/10/2026) : la barre de sélection et le cadre
// « Inactifs » ouvrent la feuille avec leurs athlètes cochés et leur texte.
function openWaGroupe(rowIdx,ids,corps){
  // RepCore n envoie rien : il ouvre des conversations, une par athlete.
  // Le plafond protege d un geste qu on ne pourrait plus arreter.
  try{
    if(!currentUser.journalGroupe) currentUser.journalGroupe=[];
    const _dest=getClients().filter(c=>c&&!c._fromCode);
    const _g=templateEnvoiGroupe(_dest,currentUser.journalGroupe);
    if(!_g.ok){
      toast(_g.demandes+' athlètes : au-delà de '+_g.max+', prépare-les en deux fois.','var(--orange)');
      return false;
    }
    if(currentUser.journalGroupe.length>50) currentUser.journalGroupe=currentUser.journalGroupe.slice(-50);
    saveUser();
  }catch(e){}
  const source=(typeof rowIdx==='number'&&window._todoRows&&window._todoRows[rowIdx])
    ?window._todoRows[rowIdx]:null;
  const tous=getClients().filter(c=>!c._fromCode);
  if(!tous.length){toast('Aucun athlète à contacter.','var(--orange)');return;}
  const preCoches=new Set(Array.isArray(ids)?ids.map(String):(source?source.list:tous).map(c=>c.id));
  const corpsInitial=typeof corps==='string'?corps:(source?_waCorpsGroupe(source.type):'');
  // UN LOT PAR OUVERTURE : sa clé fait l'identifiant de chaque message
  // (lot + athlète). Un double appui, un renvoi après coupure, « Réessayer »
  // retombent sur les mêmes identifiants : jamais deux fois le même message.
  _grp={lot:Date.now(),faits:new Map(),enCours:false,plan:null,res:null,minuteur:null};
  const lignes=tous.map(c=>{
    const tel=_telAthlete(c);
    const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Athlète';
    return `<label style="display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid #181818;cursor:pointer">
      <input type="checkbox" class="wag-cb" value="${escapeHtml(c.id)}" data-tel="${escapeHtml(tel)}" data-nom="${escapeHtml(c.fname||'')}"
        ${preCoches.has(c.id)?'checked':''} style="width:18px;height:18px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:var(--fs-md)">${escapeHtml(nom)}</div>
        <div class="sub" style="font-size:var(--fs-xs)">${tel?icon('smartphone',12)+' '+escapeHtml(tel):'<span style="color:var(--orange)">aucun numéro : le contact sera à choisir dans WhatsApp</span>'}</div>
      </div>
    </label>`;
  }).join('');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;animation:fadeIn var(--t-3) var(--c-out);max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">Message groupé</h2>
    <div id="wag-saisie">
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:10px">Envoie-le dans l'app, dans le fil de chaque athlète. Ou prépare les conversations WhatsApp, une par athlète.</p>
    ${_htmlCocherEtiquette('wag-liste')}
    <label for="wag-texte" style="margin-top:0">Message : chacun le recevra précédé de « Salut &lt;son prénom&gt;, »</label>
    <textarea id="wag-texte" rows="3" style="resize:none" placeholder="petit point d'étape cette semaine 💪">${escapeHtml(corpsInitial)}</textarea>
    <div style="display:flex;gap:8px;margin:10px 0 4px">
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="_wagTout(true)">Tout cocher</button>
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="_wagTout(false)">Tout décocher</button>
    </div>
    <div id="wag-liste" onchange="_wagCompter()">${lignes}</div>
    <button id="wag-app" class="btn btn-red btn-sm" style="width:100%;margin:14px 0 0;min-height:44px" onclick="grpRelire()">Envoyer dans l'app (${preCoches.size})</button>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="_wagPreparer()">Préparer les envois WhatsApp</button>
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="_wagCopierNumeros()">Copier les numéros</button>
    </div>
    <div id="wag-liens" style="margin-top:12px"></div>
    </div>
    <div id="wag-etape" hidden></div>
    <button class="btn btn-outline" style="margin-top:12px" onclick="closeModal()">Fermer</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
function _wagTout(v){document.querySelectorAll('.wag-cb').forEach(cb=>cb.checked=v); _wagCompter();}
function _wagCompter(){
  const b=document.getElementById('wag-app');
  if(b) b.textContent='Envoyer dans l’app ('+document.querySelectorAll('.wag-cb:checked').length+')';
}
function _wagSelection(){
  return [...document.querySelectorAll('.wag-cb:checked')].map(cb=>({
    id:cb.value,tel:cb.dataset.tel||'',nom:cb.dataset.nom||''
  }));
}
function _wagCopierNumeros(){
  const avecTel=_wagSelection().filter(s=>s.tel);
  if(!avecTel.length){toast('Aucun numéro enregistré parmi les athlètes cochés.','var(--orange)');return;}
  const liste=avecTel.map(s=>s.tel).join('\n');
  try{
    navigator.clipboard.writeText(liste)
      .then(()=>toast(avecTel.length+' numéro'+(avecTel.length>1?'s copiés':' copié'),'var(--green)'))
      .catch(()=>toast('Copie refusée par le navigateur : sélectionne les numéros à la main.','var(--orange)'));
  }catch(e){toast('Copie impossible sur cet appareil.','var(--orange)');}
}
// ══ L'ENVOI GROUPÉ DANS L'APP (06/10/2026) ════════════════════════════════
// Le message groupé fabriquait un lien WhatsApp par athlète : un appui et un
// changement d'application chacun, et rien dans le fil de l'athlète. Il part
// maintenant dans la messagerie interne (msgEnvoyer), quatre à la fois, après
// une relecture ; il s'annule pendant 10 s ; les échecs se relancent.
//   · personnalisé un par un (« Salut {prénom}, » + texte, moteur de modèles) :
//     jamais le prénom d'un autre ;
//   · idempotent : l'identifiant est lot + athlète, et un renvoi retombe sur
//     le même message ;
//   · un échec (hors ligne, athlète détaché : 403) ne bloque pas les autres.
const GRP_PARALLELE=4, GRP_CONFIRMER_AU_DELA=20, GRP_ANNULER_MS=10000;
let _grp=null;
function _grpHash(s){ let h=7; for(const ch of String(s)) h=(Math.imul(h,31)+ch.charCodeAt(0))>>>0; return h.toString(36); }
// L'identifiant d'un message du lot : la règle demande /^m[a-z0-9]{8,20}$/.
function grpMsgId(lot,athId){ return ('m'+Number(lot).toString(36)+'g'+_grpHash(athId)).slice(0,21); }
/**
 * PURE. Les messages d'un envoi groupé.
 * @param {Array<string|{id:string,cle?:string}>} selection
 * @param {string} texte  le corps, après « Salut {prénom}, »
 * @param {Object<string,string>} prenoms  id → prénom
 * @param {number} [lot]
 * @returns {{ok:boolean, raison:string|null, lot:number, messages:any[], confirmer:boolean}}
 */
function planEnvoiGroupe(selection,texte,prenoms,lot){
  const L=Number(lot)||Date.now();
  const non=raison=>({ok:false,raison,lot:L,messages:[],confirmer:false});
  const v=msgTexteValide(texte);
  if(!v.ok) return non(v.raison);
  const vus=new Set(), messages=[];
  for(const s of (selection||[])){
    const id=String(s&&typeof s==='object'?s.id:s);
    if(!id||id==='undefined'||vus.has(id)) continue;
    vus.add(id);
    const prenom=String((prenoms||{})[id]||'').trim();
    const r=templateResoudre('Salut {prénom}, '+v.texte,{prenom});
    if(r.manquantes.length) return non('Une variable du modèle n’est pas complétée : {'+r.manquantes[0]+'}.');
    const t=msgTexteValide(r.texte);
    if(!t.ok) return non(t.raison);
    messages.push({id,cle:String((s&&s.cle)||''),prenom,texte:t.texte,msgId:grpMsgId(L,id)});
  }
  if(!messages.length) return non('Coche au moins un athlète.');
  return {ok:true,raison:null,lot:L,messages,confirmer:messages.length>GRP_CONFIRMER_AU_DELA};
}
/**
 * Les envois, GRP_PARALLELE à la fois. `faits` (msgId → message) retient ce
 * qui est parti : un second passage ne renvoie rien de ce qui l'est déjà.
 * @param {{messages:any[]}} plan
 * @param {(m:any)=>Promise<any>} envoyer
 * @param {Map<string,any>} [faits]
 * @returns {Promise<{envoyes:any[], echecs:any[]}>}
 */
async function executerEnvoiGroupe(plan,envoyer,faits){
  const f=faits||new Map(), l=(plan&&plan.messages)||[];
  const res={envoyes:[],echecs:[]};
  let i=0;
  const travail=async()=>{
    while(i<l.length){
      const m=l[i++];
      if(f.has(m.msgId)){ res.envoyes.push(m); continue; }
      let r=null; try{ r=await envoyer(m); }catch(e){ r={ok:false,raison:'reseau'}; }
      if(r&&r.ok){ f.set(m.msgId,m); res.envoyes.push(m); }
      else res.echecs.push(Object.assign({},m,{raison:(r&&r.raison)||'echec'}));
    }
  };
  await Promise.all(Array.from({length:Math.min(GRP_PARALLELE,l.length)},travail));
  return res;
}
function _grpEtape(html){
  const a=document.getElementById('wag-saisie'), z=document.getElementById('wag-etape');
  if(!z) return false;
  if(a) a.hidden=html!=null;
  z.hidden=html==null;
  z.innerHTML=html||'';
  return true;
}
function _grpRaisonLib(r){ return r==='hors_ligne'||r==='reseau'||r==='refus'?'réseau':r==='acces'?'plus rattaché':'refusé'; }
/** La relecture : combien, le message du premier, les prénoms. */
function grpRelire(){
  if(!_grp) _grp={lot:Date.now(),faits:new Map(),enCours:false};
  const sel=_wagSelection();
  let cl=[]; try{ cl=getClients(); }catch(e){ cl=[]; }
  const par={}; for(const c of cl) if(c) par[String(c.id)]=c;
  const prenoms={};
  const choix=sel.map(s=>{ const c=par[s.id]; prenoms[s.id]=(c&&c.fname)||s.nom||''; return {id:s.id,cle:c?_relCle(c):''}; });
  const p=planEnvoiGroupe(choix,(document.getElementById('wag-texte')||{}).value||'',prenoms,_grp.lot);
  if(!p.ok){ toast(p.raison,'var(--orange)'); return false; }
  _grp.plan=p;
  const n=p.messages.length, E=escapeHtml;
  _grpEtape('<div class="grp-rel">'
    +'<div class="grp-n">'+n+' destinataire'+(n>1?'s':'')+'</div>'
    +'<div class="grp-lib">Ce que recevra '+E(p.messages[0].prenom||'le premier')+' :</div>'
    +'<div class="grp-apercu">'+E(p.messages[0].texte)+'</div>'
    +'<div class="grp-lib">À : '+E(p.messages.map(m=>m.prenom||'athlète').join(', '))+'</div>'
    +(p.confirmer?'<label class="grp-lib" for="grp-confirme">Plus de '+GRP_CONFIRMER_AU_DELA+' destinataires : retape le nombre ('+n+') pour confirmer.</label>'
      +'<input id="grp-confirme" inputmode="numeric" autocomplete="off" style="min-height:44px">':'')
    +'<div style="display:flex;gap:8px;margin-top:12px">'
    +'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="_grpEtape(null)">Modifier</button>'
    +'<button id="grp-go" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="grpEnvoyer()">Envoyer à '+n+' athlète'+(n>1?'s':'')+'</button>'
    +'</div></div>');
  return true;
}
/** L'envoi : un seul lot, même sous un double appui. */
async function grpEnvoyer(){
  const g=_grp;
  if(!g||!g.plan||g.enCours) return false;
  const p=g.plan;
  if(p.confirmer){
    const v=String((document.getElementById('grp-confirme')||{}).value||'').trim();
    if(v!==String(p.messages.length)){ toast('Retape '+p.messages.length+' pour confirmer l’envoi.','var(--orange)'); return false; }
  }
  g.enCours=true;
  const b=document.getElementById('grp-go'); if(b){ b.disabled=true; b.textContent='Envoi…'; }
  const res=await executerEnvoiGroupe(p,m=>msgEnvoyer(m.cle,m.texte,{id:m.msgId,silencieux:true}),g.faits);
  g.enCours=false;
  try{ rcmCoach('coach_message_envoye'); }catch(e){}
  g.res=res;
  _grpAnnulable(res);
  return true;
}
// 10 s pour se raviser : le bouton compte, puis laisse place au compte rendu.
function _grpAnnulable(res){
  const g=_grp; if(!g) return;
  const n=res.envoyes.length;
  let reste=Math.round(GRP_ANNULER_MS/1000);
  const peindre=()=>_grpEtape('<div class="grp-rel"><div class="grp-n">'+n+' envoyé'+(n>1?'s':'')+'</div>'
    +(n?'<button id="grp-annuler" class="btn btn-outline btn-sm" style="width:100%;margin:12px 0 0;min-height:44px" onclick="grpAnnuler()">Annuler l’envoi ('+reste+' s)</button>':'')
    +'</div>');
  peindre();
  if(g.minuteur) clearInterval(g.minuteur);
  if(!n){ _grpCompteRendu(); return; }
  g.minuteur=setInterval(()=>{
    reste--;
    if(reste<=0){ clearInterval(g.minuteur); g.minuteur=null; _grpCompteRendu(); return; }
    const a=document.getElementById('grp-annuler');
    if(a) a.textContent='Annuler l’envoi ('+reste+' s)';
  },1000);
}
/** Retire ce qui vient d'être posté (la règle laisse 30 s au coach). */
async function grpAnnuler(){
  const g=_grp; if(!g||!g.res) return false;
  if(g.minuteur){ clearInterval(g.minuteur); g.minuteur=null; }
  const l=g.res.envoyes.slice();
  let retires=0;
  await executerEnvoiGroupe({messages:l},async m=>{
    const k=_msgCles(currentUser,m.cle);
    if(!k) return {ok:false};
    const r=await _fbJson('messages/'+k.coach+'/'+k.athlete+'/'+m.msgId,'DELETE');
    if(r&&r.ok){ retires++; g.faits.delete(m.msgId); }
    return r;
  },new Map());
  // L'INDEX DES FILS suit : recalculé depuis la dernière page de chacun.
  try{ await executerEnvoiGroupe({messages:l.map(m=>Object.assign({},m,{msgId:'idx'+m.msgId}))},
    m=>msgIndexRecalculer(_msgCles(currentUser,m.cle)).then(ok=>({ok})),new Map()); }catch(e){}
  g.res={envoyes:[],echecs:[]};
  _grpEtape('<div class="grp-rel"><div class="grp-n">Envoi annulé</div>'
    +'<div class="grp-lib">'+retires+' message'+(retires>1?'s':'')+' retiré'+(retires>1?'s':'')
    +(retires<l.length?' ; '+(l.length-retires)+' n’ont pas pu l’être':'')+'.</div>'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin:12px 0 0;min-height:44px" onclick="_grpEtape(null)">Revenir au message</button></div>');
  return retires;
}
// « 57 envoyés, 3 en échec : Réessayer » ; les échecs, par prénom.
function _grpCompteRendu(){
  const g=_grp; if(!g||!g.res) return;
  const n=g.res.envoyes.length, e=g.res.echecs, E=escapeHtml;
  _grpEtape('<div class="grp-rel"><div class="grp-n">'+n+' envoyé'+(n>1?'s':'')
    +(e.length?', '+e.length+' en échec':'')+'</div>'
    +(e.length?'<div class="grp-lib">'+e.map(m=>E(m.prenom||'athlète')+' ('+_grpRaisonLib(m.raison)+')').join(', ')+'</div>'
      +'<button class="btn btn-red btn-sm" style="width:100%;margin:12px 0 0;min-height:44px" onclick="grpReessayer()">Réessayer</button>':'')
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin:8px 0 0;min-height:44px" onclick="closeModal()">Fermer</button></div>');
}
/** Relance les seuls échecs, avec les mêmes identifiants. */
async function grpReessayer(){
  const g=_grp; if(!g||!g.res||g.enCours||!g.res.echecs.length) return false;
  g.enCours=true;
  const avant=g.res.envoyes;
  const r=await executerEnvoiGroupe({messages:g.res.echecs},m=>msgEnvoyer(m.cle,m.texte,{id:m.msgId,silencieux:true}),g.faits);
  g.enCours=false;
  g.res={envoyes:avant.concat(r.envoyes),echecs:r.echecs};
  _grpCompteRendu();
  return true;
}
/** La barre de sélection : la feuille, ses athlètes cochés. */
function selVersMessage(){
  if(!SEL_ATHLETES.size) return false;
  openWaGroupe(null,[...SEL_ATHLETES],'');
  return true;
}
function _wagPreparer(){
  const sel=_wagSelection();
  const zone=document.getElementById('wag-liens');
  if(!zone) return;
  if(!sel.length){zone.innerHTML='';toast('Coche au moins un athlète.','var(--orange)');return;}
  const texte=(document.getElementById('wag-texte')?.value||'').trim();
  if(!texte){toast('Écris le message à envoyer.','var(--orange)');return;}
  const sansTel=sel.filter(s=>!s.tel).length;
  // Ré-adressage par destinataire : sans lui, tout le monde recevait le prénom
  // et les chiffres du premier athlète de la liste.
  const pour=s=>(s.nom?'Salut '+s.nom+', ':'Salut ! ')+texte;
  zone.innerHTML=`<div class="sub" style="font-size:var(--fs-xs);margin-bottom:8px">Touche chaque nom pour ouvrir WhatsApp : ${sel.length} conversation${sel.length>1?'s':''} à ouvrir${sansTel?`, dont ${sansTel} sans numéro utilisable (contact à choisir)`:''}.</div>`
    +sel.map(s=>`<a href="${safeUrl(waLink(s.tel,pour(s)))}" target="_blank" rel="noopener"
      style="display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;margin-bottom:6px;background:#0a1a0a;border:1px solid #1e3a1e;border-radius:var(--r-2);color:var(--green);text-decoration:none;font-size:var(--fs-md);font-weight:700"
      onclick="rcmCoach('coach_message_envoye');noterContact(${_attrArg(s.id)});this.style.opacity='.5';this.style.borderColor='var(--border)'">${escapeHtml(s.nom||'Athlète')}${s.tel?'':' <span style="color:var(--orange);font-weight:400;font-size:var(--fs-xs)">(contact à choisir)</span>'}</a>`).join('');
}

// Rendu de la liste d'athletes. La recherche et le filtre sont lus dans le
// DOM au moment du rendu : le rafraichissement periodique rappelle simplement
// cette fonction, et retrouve donc l'etat courant sans qu'on ait a le stocker.
// Sans argument, elle recalcule la liste elle-meme — c'est ce qui permet a
// l'oninput de la barre de recherche de l'appeler directement.
function norm(s){
  // Insensible aux accents ET a la casse : « jul » doit trouver « Julien »,
  // et « joel » doit trouver « Joel » comme « Joël ».
  return (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
}
// ⚠ 'travail' N'EST PAS 'tous', ET LA DISTINCTION EST TOUTE LA DIFFICULTE DE
// CE LOT. La vue par defaut masque desormais ce qui dort — invitations jamais
// honorees, comptes jamais demarres, athletes endormis — parce que ces trois
// familles ont leur propre cadre en bas de page. Mais la puce « Tous » affiche
// le nombre p.total : si elle ouvrait cette vue-la, elle annoncerait dix et en
// montrerait trois. Le fichier pose la regle deux fois en toutes lettres — un
// compteur qui n'ouvre pas exactement sa propre liste est pire que pas de
// compteur. Il fallait donc deux etats, et non un seul relu differemment.
//
// 'travail' n'a PAS de puce, et c'est normal : ce n'est pas un filtre qu'on
// choisit, c'est l'ecran tel qu'il s'ouvre. Re-toucher une puce allumee y
// ramene.
let _filtreClients='travail';
function setFiltreClients(f){
  _filtreClients=f;
  // N1.11 — plus de puces a marquer : renderClientList repeint la barre
  // d etat, qui lit _filtreClients pour son propre aria-pressed. Un seul
  // endroit ou l etat actif est ecrit, un seul endroit ou il est lu.
  renderClientList();
}

// PURE. Le taux tel qu il s affiche : un chiffre, une fleche, et la fenetre
// ECRITE A COTE. Aucune couleur d alerte, aucun palier, aucun libelle
// qualitatif - la fleche dit le sens, elle ne dit pas si c est bien.
function htmlTauxCompletion(u,compact){
  let r=null;
  try{ r=tauxCompletion(u,Date.now()); }catch(e){}
  if(!r) return '';
  const val=tauxCompletionLib(r), fl=tauxCompletionFleche(r);
  const gris=!r.interpretable;
  if(compact) return `<span title="${escapeHtml(r.fenetre)}" style="font-size:var(--fs-xs);font-weight:800;
    color:${gris?'var(--text-faint)':'var(--text-strong)'};white-space:nowrap">${escapeHtml(val)}`
    +`${fl?' '+fl:''}</span>`;
  // TROIS LIGNES DANS UNE BOITE QUI EN AFFICHE DEUX PARTOUT AILLEURS cassaient
  // l alignement de toute la rangee. La fenetre passe en title, comme le fait
  // deja la branche compacte.
  // LES MEMES CLASSES QUE SES TROIS VOISINES. Ecrite en styles en ligne, cette
  // tuile ignorait le resserrement de la rangee : elle gardait ses 32 px de
  // chiffre et son libelle sur deux mots, qui passait a la ligne et decalait
  // toute la rangee. « Faites » suffit : les trois autres disent deja de quoi
  // il s'agit.
  return `<div style="text-align:center" title="${escapeHtml(r.fenetre)}">
    <div class="metric-val" style="color:${gris?'var(--text-faint)':'var(--text)'}">${escapeHtml(val)}<span style="font-size:.56em;color:var(--sub)">${fl?' '+fl:''}</span></div>
    <div class="metric-label">Faites</div>
  </div>`;
}
// Tri du portefeuille. L urgence reste le tri PAR DEFAUT : le taux est une
// mesure, pas une file d action.
let _triClients='urgence';
const TRIS_CLIENTS=Object.freeze(['urgence','taux','charge','progression']);
// LE BOUTON ACTIF EST DESIGNE PAR SON `data-tri`, plus par ses voisins. Les
// deux boutons se renvoyaient à nextElementSibling / previousElementSibling :
// à deux, ça tenait ; à quatre, chacun n’en éteint qu’un seul et il en reste
// deux allumés. Le tri est un état, il se lit dans l’état.
// LA REORGANISATION SE VOIT. setTriClients basculait la classe puis
// reconstruisait toutes les lignes : l'ordre changeait d'un coup, et rien ne
// disait a qui l'ancienne troisieme ligne etait devenue la huitieme — or c'est
// exactement l'information que le coach cherche en changeant de tri.
// UNIQUEMENT AU CHANGEMENT DE TRI : pas a la frappe dans la recherche (les
// lignes disparaissent, un FLIP n'a rien a interpoler), pas au reveil de
// synchro, pas au changement de filtre.
// BORNEE A 20 LIGNES : vingt getBoundingClientRect tiennent dans une frame,
// cinquante non. Au-dela, le comportement est celui d'avant.
// La garde matchMedia est OBLIGATOIRE : le bloc CSS ne couvre pas
// element.animate(). will-change n'est POSE NULLE PART — l'animation dure
// 260 ms, le navigateur promeut de lui-meme, et le poser a demeure sur vingt
// lignes ferait tomber l'appareil qu'il pretendait aider.
function setTriClients(t){
  _triClients=TRIS_CLIENTS.indexOf(t)>=0?t:'urgence';
  try{
    document.querySelectorAll('#s-coach-home [data-tri]').forEach(b=>{
      b.classList.toggle('actif',b.dataset.tri===_triClients);
    });
  }catch(e){}
  const el=document.getElementById('ch-clients-list');
  const anime=!!el&&!arcReduit()&&el.querySelectorAll('.client-row').length<=20;
  const avant=new Map();
  if(anime) el.querySelectorAll('.client-row').forEach(n=>{
    avant.set(n.dataset.cid,n.getBoundingClientRect().top);
  });
  renderClientList();
  if(!anime) return;
  requestAnimationFrame(()=>{
    el.querySelectorAll('.client-row').forEach(n=>{
      const y0=avant.get(n.dataset.cid);
      if(y0==null) return;
      const d=y0-n.getBoundingClientRect().top;
      if(Math.abs(d)<2) return;
      _animer(n,[{transform:'translateY('+d+'px)'},{transform:'translateY(0)'}],
        {duration:260,easing:ARC.discharge,fill:'none'});
    });
  });
}
function _triTaux(c){
  let r=null; try{ r=tauxCompletion(c,Date.now()); }catch(e){}
  return (r&&r.interpretable)?r.taux:-1;   // les non-interpretables en fin de liste
}

// ══════════════ RITE DE FIN DE CYCLE — 28 JOURS ══════════════════════════
// Un point d'étape chiffré, et un nouveau départ. AUCUN objet de
// périodisation n'est créé : nommer une période, c'est écrire une chaîne dans
// `rites[]`, rien de plus. Pas de programme, pas de phase, pas de cycle dans
// le modèle de données.
//
// AUCUN INDICATEUR N'EST RECALCULÉ : tout est lu des fonctions existantes
// (tauxCompletion, e1rm, volumeSemaine, REPERES_VOLUME, mm7).
const RITE_JOURS=28;
const RITE_INACTIF_MAX_J=14;      // au-delà, ce n'est plus un cycle, c'est une reprise

// PURE. L'échéance se calcule sur l'ÉCART EN JOURS depuis l'inscription,
// jamais sur le quantième : un athlète inscrit un 31 janvier a son rite au
// 28 février + 0 jour d'écart, pas « le 31 » d'un mois qui n'en a pas.
function riteEcheance(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const c=Number(u&&u.createdAt)||0;
  if(!c||t<c) return {cycle:0,echu:false,jours:0};
  const jours=Math.floor((t-c)/864e5);
  const cycle=Math.floor(jours/RITE_JOURS);
  return {cycle,echu:cycle>=1,jours};
}
// PURE. Le rite a-t-il déjà été tenu pour ce cycle ?
function riteTenu(u,cycle){
  for(const r of ((u&&u.rites)||[])) if(r&&Number(r.cycle)===Number(cycle)) return true;
  return false;
}
// PURE. Faut-il l'afficher ? Rend {ok, raison}.
//
// Il ne s'affiche PAS sur un drapeau rouge, une grossesse-suspension, une
// inactivité de plus de quatorze jours, ou une période sans la moindre
// séance. Dans ces quatre cas, un point d'étape chiffré serait au mieux vide,
// au pire déplacé.
function riteAAfficher(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const e=riteEcheance(u,t);
  if(!e.echu) return {ok:false,raison:'pas_echu',cycle:e.cycle};
  if(riteTenu(u,e.cycle)) return {ok:false,raison:'deja_tenu',cycle:e.cycle};
  try{ if(drapeauRougeActif(u)) return {ok:false,raison:'drapeau',cycle:e.cycle}; }catch(err){}
  const g=u&&u.grossesse&&u.grossesse.etat;
  if(g==='enceinte'||g==='allaitement') return {ok:false,raison:'suspendu',cycle:e.cycle};
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>0);
  let dernier=0;
  for(const s of ses) if(s.date>dernier) dernier=s.date;
  // Plus de quatorze jours sans rien : ce cas relève de la file de reprise,
  // pas d'un bilan de cycle.
  if(!dernier||(t-dernier)>RITE_INACTIF_MAX_J*864e5)
    return {ok:false,raison:'inactif',cycle:e.cycle};
  const debut=t-RITE_JOURS*864e5;
  if(!ses.some(s=>s.date>=debut&&s.date<=t))
    return {ok:false,raison:'aucune_seance',cycle:e.cycle};
  return {ok:true,raison:null,cycle:e.cycle,depuis:debut};
}
// ══════════════ LE RITE, CÔTÉ COACH ══════════════
//
// L'athlète ferme son cycle et écrit parfois une question. Elle partait dans
// `rites[]` et personne ne la lisait : le tableau de bord signalait « Bilan de
// 4 semaines à lire » pour quelque chose qu’aucun écran n’affichait.
//
// PURE. Le dernier rite SANS réponse. La ligne du tableau de bord, elle, ne
// regarde que le TOUT DERNIER — sa règle de relance unique fait qu'un cycle
// déjà laissé sans réponse ne redemande rien. La fiche, elle, montre ce qui
// reste ouvert : consulter un dossier n’est pas une relance, et ça ne réarme
// rien.
function _riteSansReponse(c){
  const l=((c&&c.rites)||[]).filter(r=>r&&r.date&&!r.reponseCoach);
  return l.length?l[l.length-1]:null;
}
// L'identifiant du champ dérive du cycle, comme celui des bilans dérive de
// l’identifiant du bilan : un id fixe redeviendrait ambigu le jour où deux
// rites seraient affichés ensemble.
function _taIdRite(cycle){ return 'rr-texte_'+cycle; }
function _htmlRiteCoach(c){
  const r=_riteSansReponse(c);
  if(!r) return '';
  const d=r.date?dateLocaleDeCle(r.date).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'';
  let nom=''; try{ nom=riteNomPeriode(c,r.cycle); }catch(e){ nom=''; }
  const ta=_taIdRite(r.cycle);
  // La question est ÉCRITE PAR L'ATHLÈTE : elle est échappée, comme le prénom
  // dans le tableau de bord. Elle est aussi FACULTATIVE — fermerRite n’écrit
  // que la date. On dit alors qu’il n’y a pas de question plutôt que de rendre
  // un bloc vide qui laisserait croire à un rendu cassé.
  const q=String(r.question||'').trim();
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-left:3px solid var(--sub);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Bilan de 4 semaines</div>
    <div style="font-size:var(--fs-sm);color:var(--text-dim);margin-bottom:10px">${escapeHtml(nom)}${d?' · '+escapeHtml(d):''}</div>
    ${q
      ?`<div style="background:var(--surface-2);border-radius:var(--r-2);padding:10px 12px;font-size:var(--fs-sm);color:var(--text);line-height:1.6">${escapeHtml(q)}</div>`
      :`<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6">Cycle clôturé sans question écrite.</div>`}
    <textarea id="${ta}" rows="3" placeholder="Ce que tu retiens de ce cycle, et ce qu'on ajuste." style="width:100%;box-sizing:border-box;margin-top:10px"></textarea>
    <button class="btn btn-red btn-sm" onclick="saveReponseRite('${escapeHtml(c.email||'')}','${escapeHtml(String(r.cycle))}','${ta}')"
      style="margin-top:8px;letter-spacing:1px">Envoyer ma réponse</button>
  </div>`;
}
function renderRiteCoach(c){
  const z=document.getElementById('ccd-rite');
  if(!z) return;
  let h=''; try{ h=_htmlRiteCoach(c); }catch(e){ h=''; }
  z.innerHTML=h;
  z.style.display=h?'':'none';
}
// L’ÉCRITURE PASSE PAR users[email], JAMAIS PAR saveUser(). _riteEnregistrer
// s’exécute côté ATHLÈTE sur currentUser ; ici currentUser est le COACH, et
// saveUser() écrirait la réponse dans le dossier du coach.
//
// Même patron que saveReponseBilan : garde-fou de modèle en tête, plafond de
// 2000 caractères, DB.set puis CLOUD.pushOne.
//
// HORODATÉ, et c’est nécessaire : _mergeUser n’applique le dossier distant que
// si son updatedAt est au moins aussi récent que le local, et _doPushOne peut
// refuser un envoi que le distant dépasse. Sans ça, la réponse partirait pour
// ne jamais arriver.
function saveReponseRite(email,cycle,taId){
  const _ta=taId||_taIdRite(cycle||'');
  if(!tplVerifierAvantEnvoi(_ta)) return false;
  const ta=document.getElementById(_ta);
  const txt=((ta&&ta.value)||'').trim();
  if(!txt){ toast('Écris ta réponse avant d\'envoyer.','var(--orange)'); return false; }
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||!Array.isArray(c.rites)){ toast('Athlète introuvable','var(--red)'); return false; }
  // Le cycle est UNIQUE dans rites[] : _riteEnregistrer refuse d’en écrire un
  // second pour le même, via riteTenu.
  const r=c.rites.find(x=>x&&Number(x.cycle)===Number(cycle)&&!x.reponseCoach);
  if(!r){ toast('Bilan de cycle introuvable','var(--red)'); return false; }
  const _avant=c.rites.length, _indiceRite=c.rites.indexOf(r);
  r.reponseCoach=avecSignature(txt).slice(0,2000);
  r.reponseDate=Date.now();
  // On ne pousse RIEN dans rites[] : le plafond de 24 ne peut pas bouger.
  if(c.rites.length!==_avant) c.rites.length=_avant;
  c.updatedAt=Date.now();
  users[email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(email,c);
  Promise.resolve(envoi).then(x=>{ if(x!==false) deposerEvenement({type:'reponse_rite',dest:email.replace(/\./g,','),i:String(_indiceRite)}); }).catch(()=>{});
  toastSync(ok,envoi,'Réponse envoyée. '+(c.fname||'Ton athlète')+' la verra à sa prochaine ouverture.',
    'la réponse est');
  try{ openClientDetail(c.id,true); }catch(e){}
  return true;
}
// Entrée par la ligne du tableau de bord : on ouvre la fiche ET on amène le
// bloc sous les yeux. Une alerte qui ouvre un écran de deux mètres de haut
// sans dire où regarder ne vaut guère mieux qu’une alerte muette.
function _ouvrirRiteClient(id){
  if(!id) return;
  openClientDetail(id);
  try{
    setTimeout(()=>{
      try{
        const z=document.getElementById('ccd-rite');
        if(z&&z.innerHTML) _defiler(z);
      }catch(e){}
    },80);
  }catch(e){}
}
// PURE. Le nom de la période suivante. Le coach peut la nommer ; sinon un
// numéro. Ce nom est une ÉTIQUETTE, il ne pilote rien.
function riteNomPeriode(u,cycle){
  const r=((u&&u.rites)||[]).slice().reverse().find(x=>x&&x.nom);
  return (r&&r.nom)?String(r.nom):('Cycle '+(Number(cycle)+1));
}
// PURE. Les records de la fenêtre, lus avec l'e1rm EXISTANT : meilleure
// performance de la période contre la meilleure d'avant, par exercice.
function _riteRecords(u,debut,fin){
  const av={},ap={};
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!s.date) continue;
    const cible=(s.date>=debut&&s.date<=fin)?ap:((s.date<debut)?av:null);
    if(!cible) continue;
    // ⚠ LES DEUX FORMES DE SÉANCE. Cette boucle ne lisait que `exercises`,
    //   alors que finishWorkout enregistre les séries dans `data` : sur un
    //   vrai dossier, le rite n'a jamais trouvé un seul record. _wrExos lit
    //   les deux (et passe par les alias).
    for(const ex of _wrExos(s)){
      const nom=ex&&ex.nom; if(!nom) continue;
      for(const set of ((ex.sets)||[])){
        if(!set||set.done===false) continue;
        const w=parseFloat(set.weight)||0, r=parseFloat(set.repsDone!=null?set.repsDone:set.reps)||0;
        if(!(w>0&&r>0)) continue;
        // LOT T1 : la même borne que partout ailleurs. Une série de vingt ne fait
        // plus un record de cycle gonflé par un modèle qu'elle dépasse.
        const _i=(set.rir==='echec')?0:(parseInt(set.rir)||0);
        if(!e1rmFiable(r,_i)) continue;
        let v=0; try{ v=e1rm(w,r,_i); }catch(err){ v=w; }
        if(!(cible[nom]>v)) cible[nom]=v;
      }
    }
  }
  const out=[];
  for(const nom in ap) if(!(av[nom]>=ap[nom])) out.push({nom,valeur:Math.round(ap[nom])});
  out.sort((a,b)=>b.valeur-a.valeur);
  return out;
}
// PURE. Le contenu du rite. Il LIT, il ne calcule pas.
function riteContenu(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const debut=t-RITE_JOURS*864e5;
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>=debut&&s.date<=t);
  let taux=null; try{ taux=tauxCompletion(u,t); }catch(e){}
  // Le volume par muscle contre MEV/MAV/MRV, lu tel quel.
  let vol=null;
  try{ vol=volumeSemaine(u,localISODate(new Date(t))); }catch(e){}
  const muscles=[];
  // ⚠ CETTE LIGNE LISAIT LA TABLE EN DIRECT, ET ELLE LISAIT `mav` — un champ
  // qui n'existe PAS dans REPERES_VOLUME, dont les bornes sont mavMin et
  // mavMax. Le rite annonçait donc un MAV undefined depuis l'origine. Passer
  // par reperesEffectifs corrige les deux d'un coup : le repère de l'athlète
  // au lieu de celui de la table, et une borne qui existe.
  if(vol) for(const m in vol){
    let rep=null; try{ rep=reperesEffectifs(u,m); }catch(e){ rep=null; }
    muscles.push({muscle:m,series:vol[m],mev:rep&&rep.mev,
      mav:rep&&rep.mavMin,mrv:rep&&rep.mrv,source:rep&&rep.source});
  }
  // PHASE LUTÉALE : aucune minoration n'existe dans le fichier (le facteur de
  // charge y vaut 1,00, seule la SÉRIE est réduite). On ne minore donc rien —
  // on MENTIONNE la phase, pour que la lecture se fasse en contexte.
  let mentionPhase=false;
  try{ mentionPhase=(typeof phaseCycle==='function')
    &&phaseCycle(u,localISODate(new Date(t)))==='luteal_late'; }catch(e){}
  return {seances:ses.length,taux:taux,records:_riteRecords(u,debut,t),
    muscles:muscles,mentionPhase:mentionPhase,depuis:debut,jusqua:t};
}
// Le bilan bimensuel de la même semaine, s'il existe : on le RÉFÉRENCE, on ne
// le rejoue pas. À fréquence hebdomadaire, la coïncidence arrive une fois sur
// quatre — ce n'est pas un cas rare.
function riteBilanDeLaSemaine(u,now){
  const t=(typeof now==='number')?now:Date.now();
  const sem=7*864e5;
  const l=((u&&u.bilans)||[]).filter(b=>b&&b.type!=='depart'&&b.date>t-sem&&b.date<=t);
  return l.length?l[l.length-1]:null;
}

// ── L'écran du rite ───────────────────────────────────────────────────────
// NON BLOQUANT : il se ferme, il ne se subit pas. Aucune notification — il
// s'affiche à l'ouverture de l'app, et seulement si riteAAfficher le permet.
//
// AUCUNE ÉCRITURE AU CHARGEMENT : `rites[]` n'est écrit qu'à la fermeture, et
// ne porte alors que la date si l'athlète n'a rien répondu.
function _riteLigne(lib,val,note){
  return `<div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;
    padding:8px 0;border-top:1px solid color-mix(in srgb,var(--text) 6%,transparent)">
    <span style="font-size:var(--fs-xs);color:var(--sub)">${escapeHtml(lib)}</span>
    <span style="font-size:var(--fs-md);font-weight:800;color:var(--text);text-align:right">${val}${note?`<span style="font-size:var(--fs-2xs);color:var(--text-faint);font-weight:400"> ${escapeHtml(note)}</span>`:''}</span>
  </div>`;
}
function ouvrirRite(cycle){
  // L'écran de fin d'un rite précédent, s'il est encore là, cède la place.
  try{ const _o=document.getElementById('modal-overlay'); if(_o&&_o.querySelector('.rite-fin')) closeModal(); }catch(e){}
  const u=currentUser;
  const c=riteContenu(u,Date.now());
  const bil=riteBilanDeLaSemaine(u,Date.now());
  const nom=riteNomPeriode(u,cycle);
  window._riteCycle=cycle;
  // Tendance de poids : LUE, jamais recalculee.
  let vit=null;
  try{ vit=vitesseHebdo(serieWeight(u)); }catch(e){}
  const tauxLib=(c.taux&&c.taux.interpretable)?(c.taux.taux+' %'):'-';
  const muscles=c.muscles.filter(m=>m.mev!=null).slice(0,14);
  const html=`<div id="modal-overlay" onclick="fermerRite()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:2px">
      <h2 style="margin:0">4 semaines</h2>
      <button onclick="fermerRite()" aria-label="Fermer" style="min-width:44px;min-height:44px;background:none;border:none;color:var(--sub);font-size:var(--fs-xl);cursor:pointer">×</button>
    </div>
    <p class="sub" style="font-size:var(--fs-xs);margin-bottom:14px;line-height:1.6">Un point d'étape, pas une note. Tu peux fermer cet écran à tout moment.</p>

    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:10px">
      ${_riteLigne('Séances réalisées',c.seances)}
      ${_riteLigne('Séances faites sur prévues',tauxLib,c.taux?c.taux.fenetre:'')}
      ${vit&&vit.pctSem!=null?_riteLigne('Tendance de poids',(vit.pctSem>0?'+':'')+String(Math.round(vit.pctSem*100)/100).replace('.',',')+' %/sem'):''}
    </div>

    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:10px">
      <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Records battus</div>
      ${c.records.length
        ? c.records.slice(0,6).map(r=>_riteLigne(r.nom,r.valeur+' <span style="font-size:var(--fs-2xs);color:var(--sub);font-weight:400">e1RM</span>')).join('')
        : '<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Aucun record sur la période. Ce n\'est pas un échec : la progression n\'est pas linéaire.</div>'}
      ${c.mentionPhase?'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">Relevé en phase lutéale tardive : une baisse y est attendue, et n\'a pas la même signification qu\'une régression.</div>':''}
    </div>

    ${muscles.length?`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:10px">
      <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:6px">Volume par muscle</div>
      ${muscles.map(m=>_riteLigne(m.muscle,m.series+' séries','MEV '+m.mev+' · MAV '+m.mav+' · MRV '+m.mrv)).join('')}
    </div>`:''}

    ${bil?`<div style="background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:10px;font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">
      Ton bilan de cette semaine est déjà enregistré : il n'est pas redemandé ici.</div>`:''}

    <label style="margin-top:0">Une question à ton coach&nbsp;?</label>
    <textarea id="rite-question" rows="2" placeholder="Facultatif : ce que tu veux lui demander pour la suite"></textarea>

    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-size:var(--fs-sm);font-weight:800;color:var(--text);margin-bottom:2px">${escapeHtml(nom)}</div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:10px">Tes jours et ton heure d'entraînement pour les 4 prochaines semaines. Nommer cette période ne crée aucun programme : c'est une étiquette.</div>
      <div id="rite-jours" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${['L','Ma','Me','J','V','S','D'].map((j,i)=>`<button type="button" data-j="${i}" onclick="riteJour(${i},this)"
          style="flex:1;min-width:40px;min-height:44px;border-radius:var(--r-2);cursor:pointer;background:var(--surface-1);border:1px solid var(--border);color:var(--sub);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800">${j}</button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:var(--fs-xs);color:var(--sub)">Heure</span>
        <input id="rite-heure" type="number" min="0" max="23" value="${(currentUser._woReminderHour??18)}"
          style="width:70px;font-size:var(--fs-lg);padding:10px 10px;text-align:center;box-sizing:border-box">
      </div>
    </div>

    <button class="btn btn-red" style="margin-top:14px;width:100%" onclick="validerRite()">Enregistrer et repartir</button>
    <button class="btn btn-outline" style="margin-top:8px;width:100%" onclick="fermerRite()">Plus tard</button>
  </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  window._riteJours=(currentUser._woReminderDays||[]).slice();
  (window._riteJours||[]).forEach(i=>{
    const b=document.querySelector('#rite-jours button[data-j="'+i+'"]');
    if(b) riteJour(i,b,true);
  });
}
function riteJour(i,el,forcer){
  if(!window._riteJours) window._riteJours=[];
  const k=window._riteJours.indexOf(i);
  const actif=forcer?true:(k<0);
  if(actif&&k<0) window._riteJours.push(i);
  if(!actif&&k>=0) window._riteJours.splice(k,1);
  el.style.background=actif?'rgba(224,32,32,.14)':'#111';
  el.style.borderColor=actif?'var(--red)':'var(--border)';
  el.style.color=actif?'var(--text)':'var(--sub)';
}
// LES CYCLES REPORTES DANS CETTE SESSION. Un Set en mémoire, JAMAIS une
// écriture au dossier : c’est toute la différence entre « pas maintenant »
// et « c’est fait ».
//
// Il disparaît à la fermeture de l’app, et le rite se represente à la
// prochaine ouverture — c’est ce que « Plus tard » promet.
const _riteReportes=new Set();
// LA CLÉ PORTE LE COMPTE, pas seulement le cycle. RepCore assume plusieurs
// comptes sur le même téléphone : deux athlètes au même numéro de cycle
// partageaient leur report, et le rite du second ne s’affichait pas sans que
// rien ne le dise. Un numéro de cycle n’est pas un identifiant.
//
// L’email quand il existe, l’identifiant sinon : un compte créé par code
// n’a pas toujours d’email.
function _riteCle(u,cycle){
  const qui=(u&&(u.email||u.id))||'?';
  return qui+'#'+Number(cycle);
}
// FERMETURE SANS ÉCRITURE. Elle inscrivait le cycle dans rites[], donc le
// rendait « tenu » pour riteTenu : la modale ne revenait plus avant 28 jours.
// Or cette fonction est appelée par le bouton « Plus tard » ET par le clic
// sur le fond de la modale — un geste qui, partout ailleurs dans ce produit,
// ne décide de rien.
//
// SEUL « Enregistrer et repartir » écrit désormais.
function fermerRite(){
  try{ _riteReportes.add(_riteCle(currentUser,window._riteCycle)); }catch(e){}
  closeModal();
}
function validerRite(){
  const q=((document.getElementById('rite-question')||{}).value||'').trim();
  const cycle=window._riteCycle;
  const ok=_riteEnregistrer(q,true);
  closeModal();
  toast('Nouveau cycle noté.');
  if(!ok) return;
  // LA FAMILLE CYCLES (idée 04) SE DÉBLOQUE ICI : le rite vient d'entrer dans
  // `rites`, qui est ce que compte le badge.
  try{ majBadges(); }catch(e){}
  try{ majXp(); }catch(e){}
  // Puis le cycle se montre, et se partage.
  try{ _riteAfficherFin(riteCarteDonnees(currentUser,cycle,Date.now())); }catch(e){}
}
function _riteEnregistrer(question,avecReglages){
  try{
    const u=currentUser;
    if(!u) return false;
    if(!Array.isArray(u.rites)) u.rites=[];
    if(riteTenu(u,window._riteCycle)) return false;
    const e={cycle:window._riteCycle,date:Date.now(),reponseCoach:null};
    if(question) e.question=question;
    u.rites.push(e);
    if(u.rites.length>24) u.rites=u.rites.slice(-24);
    // Les jours et l'heure vont dans les CHAMPS DE RAPPEL EXISTANTS : aucun
    // objet de périodisation n'est créé.
    if(avecReglages){
      const h=parseInt((document.getElementById('rite-heure')||{}).value,10);
      if(Array.isArray(window._riteJours)&&window._riteJours.length){
        u._woReminderDays=window._riteJours.slice().sort((a,b)=>a-b);
        u._woReminderEnabled=true;
      }
      if(h>=0&&h<=23) u._woReminderHour=h;
    }
    saveUser();
    return true;
  }catch(e){ return false; }
}
// Appelé à l'ouverture de l'accueil athlète. Ne s'affiche que si TOUT est
// réuni, et ne bloque jamais l'accès à l'application.
// PURE. Le dernier bilan de fin de cycle portant une réponse du coach que
// l’athlète n’a pas encore lue, ou null.
//
// `reponseVue!==true` ET NON `===false` : les rites écrits avant ce lot ne
// portent aucun drapeau, et une réponse déjà envoyée doit pouvoir être lue.
function riteReponseNonVue(u){
  const l=((u&&u.rites)||[]).filter(r=>r&&r.reponseCoach&&r.reponseVue!==true);
  return l.length?l[l.length-1]:null;
}
// LE PATRON EXACT de la réponse de bilan — cadre var(--surface-2), filet
// gauche vert, titre « Réponse de ton coach ». La ligne de cycle en plus :
// une réponse sans son objet ne se rattache à rien, là où celle du bilan est
// rendue DANS la carte du bilan qu’elle commente.
function _htmlRiteReponse(r){
  if(!r||!r.reponseCoach) return '';
  const _c=Number(r.cycle);
  const _d=r.reponseDate?new Date(r.reponseDate).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  const _sous=[Number.isFinite(_c)&&_c>0?('Bilan de fin de cycle '+_c):'',_d].filter(Boolean).join(' · ');
  return `<div style="margin-bottom:20px;background:var(--surface-2);border-left:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px">
    <div style="font-size:var(--fs-xs);letter-spacing:1.5px;text-transform:uppercase;color:var(--green);font-weight:800;margin-bottom:4px">Réponse de ton coach</div>
    ${_sous?`<div style="font-size:var(--fs-xs);color:var(--text-dim);margin-bottom:6px">${escapeHtml(_sous)}</div>`:''}
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">${escapeHtml(r.reponseCoach)}</div>
  </div>`;
}
// MARQUÉ LU À L’AFFICHAGE, comme `b.reponseVue` pour les bilans : le bloc a
// été rendu, il ne revient pas à chaque ouverture.
//
// L’écriture ne touche QUE ce drapeau : `rites` n’est ni allongé ni
// réordonné, donc le plafond de 24 de _riteEnregistrer ne peut pas bouger.
function renderRiteReponse(){
  const el=document.getElementById('clh-rite-reponse');
  if(!el) return false;
  let r=null; try{ r=riteReponseNonVue(currentUser); }catch(e){ r=null; }
  let h=''; try{ h=_htmlRiteReponse(r); }catch(e){ h=''; }
  el.innerHTML=h;
  el.style.display=h?'':'none';
  // APRÈS le rendu : si l’écriture échouait, le bloc serait quand même à
  // l’écran, et c’est ce qui compte.
  if(h&&r&&r.reponseVue!==true){ r.reponseVue=true; try{ saveUser(); }catch(e){ rcErreurMuette('renderRiteReponse',e); } }
  return !!h;
}
function riteAfficherSiBesoin(){
  try{
    if(!currentUser||currentUser.role==='coach') return false;
    if(document.getElementById('modal-overlay')) return false;   // une modale suffit
    const v=riteAAfficher(currentUser,Date.now());
    if(!v.ok) return false;
    // REPORTÉ DANS CETTE SESSION : on ne le repose pas à chaque navigation.
    // Lu ICI et non dans riteAAfficher, qui est PURE et doit le rester — une
    // lecture d’état de session la rendrait dépendante du navigateur.
    if(_riteReportes.has(_riteCle(currentUser,v.cycle))) return false;
    ouvrirRite(v.cycle);
    return true;
  }catch(e){ return false; }
}
// ══ LA GRILLE DE VIGNETTES ═══════════════════════════════════════════════
//
// Ce que le coach voit en ouvrant l'application, ce sont SES ATHLETES. L'ecran
// s'ouvrait sur un titre, trois boutons et une barre de code : quatre elements
// avant le premier visage. Maquette de Kevin du 08/09/2026, reproduite ici.
//
// UN ROND, UN NOM, UNE PETITE CARTE. Le rond porte un anneau de couleur —
// rose pour une femme, bleu pour un homme — et c'est la seule chose qui les
// distingue a distance ; la carte redit le sexe en toutes lettres pour qui ne
// lit pas la couleur. Rien derriere : pas de fond, pas de bordure autour de la
// vignette. La photo est le sujet.
//
// L'AGE VIENT DE LA DATE DE NAISSANCE quand elle est la. `age` n'en est qu'une
// vue, figee a l'inscription : l'afficher tel quel ferait vieillir tout le
// monde d'un an en retard.
const VIG_ROSE='#ff2d78', VIG_BLEU='#2196f3';
function _vigAge(c){
  let a=null;
  try{ if(c&&c.birthdate) a=_ageRevolu(c.birthdate); }catch(e){}
  if(!(a>0)&&c&&Number(c.age)>0) a=Number(c.age);
  return (a>0)?a:null;
}
// PURE. Le HTML d'une vignette. Sortie a part pour etre eprouvable sans DOM.
function htmlVignetteAthlete(c){
  if(!c) return '';
  const femme=isFemale(c.gender);
  const couleur=femme?VIG_ROSE:VIG_BLEU;
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Sans nom';
  const age=_vigAge(c);
  const but=String(c.objective||c.bilanGoals||'').trim();
  // La photo, ou les initiales. Le rond garde sa taille dans les deux cas :
  // une grille dont les tuiles changent de hauteur selon la presence d'une
  // photo se lit en escalier.
  const dedans=c.athletePhoto
    ?`<img src="${escapeHtml(c.athletePhoto)}" alt="" style="width:100%;height:100%;object-fit:cover">`
    :`<span style="font-size:34px;font-weight:900;color:var(--text-faint);letter-spacing:1px">${escapeHtml(ini(c.fname,c.lname))}</span>`;
  // ⚠ MEME RAISON QUE LE BOUTON DE LA LIGNE. Le libelle d'accessibilite dit
  // « Ouvrir la fiche de … » : il doit l'ouvrir. Ces vignettes sont en HAUT de
  // l'ecran, loin de la liste — le tiroir qu'elles ouvraient apparaissait a
  // cote d'un tableau que le coach ne regardait meme pas.
  return `<button type="button" class="vig-ath" onclick="openClientDetail('${escapeHtml(String(c.id||''))}',false,true)"
    aria-label="Ouvrir la fiche de ${escapeHtml(nom)}">
    <span class="vig-rond" style="border-color:${couleur}">${dedans}</span>
    <span class="vig-nom">${escapeHtml(nom)}</span>
    <span class="vig-carte">
      <span class="vig-l1"><span class="vig-sexe" style="color:${couleur}">${femme?'♀':'♂'}</span>
        <span class="vig-sx">${femme?'Femme':'Homme'}</span>${age?`<span class="vig-sep">|</span><span class="vig-age">${age} ans</span>`:''}</span>
      ${but?`<span class="vig-but">${escapeHtml(but)}</span>`:''}
    </span>
  </button>`;
}
// Rendue par renderClientList : la grille suit EXACTEMENT le filtre, la
// recherche et le tri de la liste. Deux jeux differents sur le meme ecran
// feraient chercher un athlete present dans l'un et absent de l'autre.
function _rendreVignettesAthletes(vus){
  const z=document.getElementById('ch-vignettes');
  if(!z) return false;
  if(!vus||!vus.length){ z.innerHTML=''; return false; }
  // REPLIEES AU-DELA DE DOUZE (06/10/2026) : soixante ronds faisaient plus de
  // 7 000 px au-dessus de la recherche. Un bouton les rouvre, l'etat se garde.
  const _rep=vus.length>VIG_REPLI_SEUIL;
  if(_rep&&!vignettesOuvertes()){
    z.innerHTML='<button type="button" class="btn btn-blanc btn-sm vig-voir" onclick="vignettesBasculer(true)">Voir les '+vus.length+' visages</button>';
    return true;
  }
  if(_rep){
    z.innerHTML='<button type="button" class="btn btn-blanc btn-sm vig-voir" onclick="vignettesBasculer(false)">Replier les visages</button>'
      +'<div class="vig-grille">'+_htmlSectionsSuivi(vus,htmlVignetteAthlete)+'</div>';
    return true;
  }
  // Les titres de section sont poses EN GRILLE (grid-column:1/-1) : la grille
  // les traite comme une ligne pleine largeur, sans casser les colonnes.
  z.innerHTML='<div class="vig-grille">'+_htmlSectionsSuivi(vus,htmlVignetteAthlete)+'</div>';
  return true;
}
// LES DEUX SECTIONS. Elles ne paraissent QUE s'il y a des deux cotes : tant
// que le coach n'a bascule personne, tout le monde est « avec suivi » et un
// titre unique au-dessus d'une liste complete n'apprendrait rien.
// Une recherche ou un filtre qui ne laisse qu'un camp retombe donc sur la
// liste simple, sans en-tete orpheline.
// UN SEUL DECOUPAGE, TROIS EMPLOIS : la liste, la grille de vignettes et le
// CRM. Trois copies auraient fini par diverger — un ecran segmente et l'autre
// pas, sur la meme donnee, c'est pire que pas de segmentation du tout.
// `rendu` est la fonction qui sait peindre UNE fiche ; ce decoupage ne sait
// rien d'autre que trier et titrer.
function _htmlSectionsSuivi(vus,rendu,enTete){
  const peindre=rendu||renderClientRow;
  // L'EN-TETE N'EST PASSE QUE PAR LA LISTE. Les vignettes et le CRM partagent
  // ce decoupage mais n'ont pas de colonnes : leur poser une ligne
  // d'intitules n'aurait rien a surmonter.
  const tete=typeof enTete==='function'?enTete():'';
  const avec=(vus||[]).filter(estSuivi),sans=(vus||[]).filter(c=>!estSuivi(c));
  // LES DEUX SECTIONS PARAISSENT TOUJOURS, meme vides — et c'est un
  // changement du 14/09/2026. La regle d'avant les masquait tant qu'un seul
  // camp existait : comme tout le monde est « avec suivi » par defaut,
  // PERSONNE ne voyait jamais de titre, donc personne ne pouvait deviner que
  // le curseur existait. Une fonctionnalite qu'on ne voit pas n'existe pas.
  // La section vide dit quoi faire ; c'est elle qui apprend le geste.
  if(!(vus||[]).length) return '';
  // EN ROUGE, LES DEUX. Demande de Kévin. Ces titres sont les seuls repères
  // d'une liste qui peut faire trente fiches : en gris, ils se confondaient
  // avec le sous-texte des fiches elles-mêmes et on défilait sans voir qu'on
  // avait changé de camp.
  //
  // `--red-text` ET NON `--red` : le rouge de la marque est conçu pour des
  // aplats et des boutons, pas pour du texte de douze pixels sur du noir.
  // `--red-text` est sa variante éclaircie, celle du bandeau « Mes
  // notifications ».
  //
  // ⚠ LE COMPTE RESTE PÂLE, et c'est voulu : il dit combien, pas quoi. En
  //   rouge lui aussi, on lirait « 17 » avant « avec suivi ».
  const titre=(t,n)=>'<div style="grid-column:1/-1;display:flex;align-items:baseline;gap:8px;'
    +'margin:20px 0 6px;padding-bottom:6px;border-bottom:1px solid var(--border)">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--red-text)">'
    // `sec-suivi` : la prise que _majComptesSectionsSuivi saisit pour
    // recompter les deux sections sans repeindre la liste entiere.
    +escapeHtml(t)+'</span><span class="sec-suivi" style="font-size:var(--fs-2xs);color:var(--text-faint)">'+n+'</span></div>';
  const vide=t=>'<div style="grid-column:1/-1;font-size:var(--fs-xs);color:var(--text-dim);'
    +'line-height:1.6;padding:10px 2px 14px">'+t+'</div>';
  // L'EN-TETE SUIT LE TITRE ET PRECEDE LA PREMIERE LIGNE — et seulement
  // quand il y a une ligne a surmonter : au-dessus d'un « Personne ici pour
  // l'instant », une rangee d'intitules ne designerait rien.
  return titre('Mes athlètes (avec suivi)',avec.length)
    +(avec.length?tete+avec.map(peindre).join('')
       :vide('Personne ici pour l\'instant.'))
    +titre('Mes athlètes (sans suivi)',sans.length)
    +(sans.length?tete+sans.map(peindre).join('')
       :vide('Personne ici pour l\'instant. Touche le curseur SUIVI sur une fiche pour l\'y basculer.'));
}
/**
 * L'EN-TETE DU TABLEAU, POSE AU-DESSUS DE CHAQUE SECTION. Demande de Kevin,
 * 19/09/2026. Il n'y en avait qu'un, tout en haut : arrive au titre
 * « Mes athletes (sans suivi) », le coach avait dix lignes de colonnes
 * au-dessus de lui et plus aucun intitule en vue. Chaque section porte
 * desormais le sien.
 *
 * UNE LIGNE ROUGE, et pas un simple texte gris : c'est ce qui la fait lire
 * comme la tete d'un tableau plutot que comme une premiere ligne de donnees.
 * Le texte est presque noir dessus — sur l'aplat rouge, du blanc tombe sous
 * quatre pour un et ces intitules font onze pixels.
 *
 * ONZE CELLULES, DANS L'ORDRE EXACT DE LA LIGNE : case, avatar, nom,
 * objectif, assiduite, diete, charge, bilans, bouton, suivi, etat. Toute
 * cellule ajoutee a la ligne doit en ajouter une ici, et une assertion
 * compare les deux comptes a celui des pistes de la grille.
 *
 * ⚠ `cr-assidu` ET `cr-diete` SONT PORTES PAR LEURS INTITULES : c'est ce qui
 *   les eteint avec leurs cellules quand le tiroir prend la place, sans quoi
 *   l'en-tete aurait onze intitules pour neuf pistes et repasserait a la ligne.
 * @returns {string}
 */
function _htmlEnteteTableau(){
  return '<div class="cr-head"><span></span><span></span><span>Athlète</span>'
    +'<span>Objectif</span>'
    +'<span class="cr-assidu" title="Séances faites sur séances prévues">Assiduité</span>'
    +'<span class="cr-diete" title="Jours où la cible a été tenue">Diète</span>'
    +'<span title="Charge de la semaine, sur la moyenne des 4 précédentes">Charge</span>'
    +'<span title="Bilans sans réponse">Bilans</span>'
    +'<span>Accès profil</span><span>Suivi</span><span>État</span></div>';
}
function renderClientList(clients){
  // Les volts du serveur de ses athlètes, en tâche de fond (xp_serveur).
  try{ chargerXpServeurClients(); }catch(e){}
  // La pastille « Nouveau » du kit : le lundi, jusqu'à la première ouverture.
  try{ _rendreBoutonKit(); }catch(e){}
  const el=document.getElementById('ch-clients-list');
  if(!el) return;
  const tous=clients||getClients();
  const q=norm((document.getElementById('ch-search')||{}).value||'');
  let vus=tous;
  if(q) vus=vus.filter(c=>norm((c.fname||'')+' '+(c.lname||'')).includes(q));
  // Le filtre par étiquette se combine aux puces du portefeuille.
  if(_filtreEtiquette) vus=athletesAvecEtiquette(vus,_filtreEtiquette,currentUser);
  // QUI ENTRE DANS QUEL FILTRE. Demande de Kevin, 11/09/2026 : une alerte de
  // seance ou de charge ne concerne que quelqu'un qu'on suit ; une echeance
  // d'acces concerne tout le monde, puisqu'elle porte sur le paiement.
  //   seances, alertes, charges groupees -> avec suivi seulement
  //   acces, jamais demarre, en attente, actifs, tous -> les deux
  if(_filtreClients==='traiter') vus=vus.filter(c=>needsAlert(c)||hasNewBilan(c));
  else if(_filtreClients==='attente') vus=vus.filter(c=>_enAttenteInscription(c));
  // Les trois compteurs de la barre. MEMES predicats que agregerPortefeuille :
  // un compteur qui n'ouvre pas exactement sa propre liste serait pire que pas
  // de compteur du tout.
  else if(_filtreClients==='pf-traiter') vus=vus.filter(c=>estSuivi(c)&&urgencyScore(c)>=PIL_SEUIL_TRAITER);
  else if(_filtreClients==='pf-decrochage') vus=vus.filter(c=>estSuivi(c)&&_pilEligibleSignaux(c)&&signauxEntrainement(c).decrochage);
  else if(_filtreClients==='pf-acces') vus=vus.filter(c=>_pilEligibleSignaux(c)&&_pilAccesExpire(c,Date.now()));
  // N1.11 — les deux etats que les metric-box decrivaient sans les ouvrir.
  // MEMES predicats que agregerPortefeuille, aux memes fonctions.
  else if(_filtreClients==='pf-jamais') vus=vus.filter(c=>neverStarted(c));
  else if(_filtreClients==='pf-actifs') vus=vus.filter(c=>isActive(c));
  // ── LA VUE PAR DEFAUT GARDE TOUS CEUX QUI ONT UN COMPTE ─────────────
  //
  // Demande de Kevin, 19/09/2026 : « fais apparaitre tous les athletes qui ont
  // cree leur compte, juste ne mets pas ceux en attente ». Cette ligne
  // excluait trois familles le 16/09, deux le 18/09, une seule desormais.
  // Voir _enAttenteInscription pour le pourquoi de chaque retrait.
  //
  // ⚠ SEULEMENT EN VUE PAR DEFAUT, et cette garde reste. Une recherche, ou
  // n'importe quelle puce de filtre, RAMENE tout le monde : « En attente » est
  // precisement la puce qui sert a retrouver ceux-la, et un filtre qui
  // ouvrirait une liste vide serait pire que pas de filtre.
  //
  // L'EXCLUSION EST LA DERNIERE : posee avant les puces, elle les aurait
  // videes ; posee ici, elle ne mord que sur le jeu complet.
  else if(_filtreClients==='travail'&&!q) vus=vus.filter(c=>!_enAttenteInscription(c));
  if(_triClients==='taux') vus.sort((a,b)=>_triTaux(b)-_triTaux(a));
  else if(_triClients==='charge') vus.sort((a,b)=>_triCharge(b)-_triCharge(a));
  else if(_triClients==='progression') vus.sort((a,b)=>_triProgres(b)-_triProgres(a));
  // LA GRILLE SUIT, juste apres le tri : meme jeu, meme ordre.
  // Elle est rendue plus bas, une fois `vus` definitivement arrete.
  // L’URGENCE RESTE LE DÉFAUT : c’est le seul tri qui réponde à « qui
  // dois-je regarder », et les trois autres sont des questions qu’on se pose
  // ensuite.
  else vus.sort((a,b)=>urgencyScore(b)-urgencyScore(a));
  // Bilans auxquels le coach n'a pas encore ecrit. « Sans reponse » et non
  // « non lus » : ouvrir ne compte plus.
  // LA GRILLE DE VIGNETTES, sur le MEME jeu que la liste : meme recherche,
  // meme filtre, meme tri. Deux jeux differents sur le meme ecran feraient
  // chercher un athlete present dans l'un et absent de l'autre.
  try{ _rendreVignettesAthletes(vus); }catch(e){}
  renderPilotage(tous);
  renderPortefeuille(tous);
  // N4.13 — la selection est ELAGUEE de ce qui n'existe plus, puis la barre
  // est repeinte. On elague sur `tous` et non sur `vus` : un athlete masque
  // par un filtre reste selectionne, c'est le filtre qui change, pas lui.
  try{ _selElaguer(tous); _selMaj(); }catch(e){}
  // La ligne « Bilans sans reponse » a demenage dans le volet « Vue
  // d'ensemble » du pilotage. L'element qu'on vidait ici n'existe plus.
  const cnt=document.getElementById('ch-count');
  if(cnt) cnt.textContent=vus.length+'/'+tous.length+' athlete'+(tous.length>1?'s':'');
  // Position de defilement preservee : reecrire innerHTML la remet a zero.
  const pan=document.getElementById('ct-dashboard');
  const scr=pan?pan.scrollTop:0;
  if(!vus.length){
    // TROIS SITUATIONS, TROIS PHRASES. « Aucun athlète ne correspond » etait
    // juste pour une recherche et faux pour la vue par defaut : un coach dont
    // tout le portefeuille dort aurait lu que ses athletes n'existent pas,
    // alors qu'ils sont tous dans les cadres du bas.
    el.innerHTML=q
      ? '<div class="sub" style="text-align:center;padding:28px 12px;font-size:var(--fs-sm)">Aucun athlète ne correspond.</div>'
      : (_filtreClients==='travail'
        ? (tous.length
          ? '<div class="sub" style="text-align:center;padding:28px 12px;font-size:var(--fs-sm);line-height:1.6">'
            +'Personne en activité cette quinzaine.<br>Tes '+tous.length+' athlète'+(tous.length>1?'s sont':' est')
            +' dans les listes en bas de page.</div>'
          : el.innerHTML)
        : '<div class="sub" style="text-align:center;padding:28px 12px;font-size:var(--fs-sm)">Aucun athlète ne correspond.</div>');
  } else {
    // L'EN-TETE EST EMIS TOUJOURS, une fois par section : c'est le CSS qui
    // decide de l'afficher, et seulement au-dela de 1360 px. Le sortir du
    // rendu demanderait au JS de connaitre la largeur de la fenetre.
    el.innerHTML=_htmlSectionsSuivi(vus,null,_htmlEnteteTableau);
    // LA CASCADE NE JOUE QU'AU PREMIER REMPLISSAGE de la visite. Les rendus
    // suivants — frappe, filtre, tri, synchro — posent le contenu sans un
    // mouvement : une entree qui se rejoue n'est plus une entree, c'est un
    // clignotement pendant qu'on filtre. Le drapeau est remis a zero dans
    // go(), et nulle part ailleurs. 420 ms couvrent le dernier retard (90 ms)
    // plus la duree (200 ms) avec de la marge.
    if(!el.dataset.deja){
      el.dataset.deja='1';
      el.setAttribute('data-entree','');
      setTimeout(()=>{ try{ el.removeAttribute('data-entree'); }catch(e){} },420);
    }
  }
  // APRES l'ecriture de l'innerHTML, comme aujourd'hui.
  if(pan&&scr) pan.scrollTop=scr;
  // L'entree au defilement pour tout ce qui est sous le pli, a partir de la
  // septieme ligne : les six premieres ont deja la cascade.
  try{ arcEntreeAuDefilement(el,'.client-row',6); }catch(e){}
  // LE RISQUE D'ABANDON : lu à part, repeint dans les emplacements de la ligne.
  try{ _risqueApresListe(tous); }catch(e){}
  return vus.length;
}

// ── Lignes d'alerte d'entraînement ──────────────────────────────────────────
// Les cinq lignes administratives sont GROUPÉES par type (« 3 bilans à lire ·
// Marc, Julie +1 »). Les signaux d'entraînement ne peuvent pas l'être : chacun
// porte une donnée propre à l'athlète — un nom d'exercice, des chiffres, un
// muscle. Une ligne par athlète, donc, au-dessus des lignes groupées.
const TODO_MAX_LIGNES=8;
// Rappel de la contre-indication à côté d'une alerte de douleur. C'est le
// croisement que contreIndications permettait depuis toujours sans avoir
// jamais été fait : le coach lisait « douleur épaule » d'un côté et « épaule
// droite opérée en 2023 » de l'autre, sans que rien ne les rapproche.

// ══════════════ FILE DE REPRISE ══════════════════════════════════════════
// Une file d'ASSIDUITÉ, et rien d'autre. Elle lit urgencyScore sans le
// modifier, et n'accepte que les niveaux où le sujet est la présence : 7
// (séances écourtées), 5 (jamais démarré, nouveau bilan), 4 (bilan en retard).
//
// CE QUI N'Y ENTRE JAMAIS : le drapeau rouge (10) et les douleurs (9, 8). Ils
// gardent leur ligne propre dans « À traiter », non reportable, dont la
// formulation est un renvoi médical. Le palier 6 est exclu lui aussi : il
// mélange du volume d'entraînement et de la restriction calorique prolongée,
// qui est de la santé. Une file de relance n'est pas le bon endroit.
//
// AUCUN CANAL D'ENVOI n'est créé : RepCore prépare un texte, l'humain envoie.
const FR_NIVEAUX=Object.freeze([7,5,4]);
const FR_MAX_LIGNES=TODO_MAX_LIGNES;      // même plafond que « À traiter »
const FR_VEILLE_DEFAUT_J=7;

// PURE. Ce dossier a-t-il sa place dans la file ?
// Trois exclusions dures : la santé, la pause déclarée, l'invité non inscrit.
function _frEligible(c){
  if(!c||c._fromCode||!c.email) return false;
  try{ if(drapeauRougeActif(c)) return false; }catch(e){}        // règle 1
  try{ if(_estEnPause(c)) return false; }catch(e){}              // règle 6
  let s=0;
  try{ s=urgencyScore(c); }catch(e){ return false; }
  return FR_NIVEAUX.indexOf(s)>=0;
}
// PURE. Jours écoulés depuis la dernière séance enregistrée, ou null.
function _frAnciennete(c,now){
  const t=(typeof now==='number')?now:Date.now();
  let dernier=0;
  for(const s of ((c&&c.sessions)||[])) if(s&&s.date>dernier) dernier=s.date;
  if(!dernier) return null;
  return Math.max(0,Math.floor((t-dernier)/864e5));
}
// PURE. Jours depuis la dernière relance notée par le coach, ou null.
// Le repère vit dans le dossier du COACH : rien n'est écrit chez l'athlète.
function _frRelanceDepuis(coach,c,now){
  const t=(typeof now==='number')?now:Date.now();
  const r=((coach&&coach.relances)||{})[c&&c.id];
  if(!(r>0)) return null;
  return Math.max(0,Math.floor((t-r)/864e5));
}
// PURE. La file, ordonnée par urgence décroissante puis par ancienneté.
function fileReprise(clients,coach,now){
  const t=(typeof now==='number')?now:Date.now();
  const l=(Array.isArray(clients)?clients:[]).filter(_frEligible);
  const rows=l.map(c=>{
    let sg=null; try{ sg=signauxEntrainement(c); }catch(e){}
    let texte='';
    try{ texte=_texteSignal(_frType(c,sg),c,sg)||''; }catch(e){}
    return {id:c.id,prenom:(c.fname||'').trim(),score:urgencyScore(c),
      signal:texte,jours:_frAnciennete(c,t),relanceDepuis:_frRelanceDepuis(coach,c,t)};
  });
  rows.sort((a,b)=>(b.score-a.score)||((b.jours||0)-(a.jours||0)));
  return {lignes:rows.slice(0,FR_MAX_LIGNES),reste:Math.max(0,rows.length-FR_MAX_LIGNES),
    total:rows.length};
}
// Le type de signal à faire décrire par _texteSignal, qu'on ne réécrit pas.
function _frType(c,sg){
  if(sg&&sg.decrochage) return 'decrochage';
  try{ if(neverStarted(c)) return 'nostart'; }catch(e){}
  try{ if(hasNewBilan(c)) return 'bilan'; }catch(e){}
  return 'overdue';
}
// PURE. Le texte pré-rempli.
//
// RÈGLE RGPD DURE : le canal est NON CHIFFRÉ. Aucune donnée de santé n'entre
// ici — ni douleur, ni cycle, ni SOPK, ni thyroïde, ni PES, ni grossesse. Le
// texte ne parle que de PRÉSENCE, et il est construit à partir d'un gabarit
// fixe : il ne recopie jamais _texteSignal, qui, lui, peut nommer une douleur.
function _frTexteRelance(c,now){
  const p=((c&&c.fname)||'').trim();
  const j=_frAnciennete(c,now);
  const nom=p?p:'toi';
  if(j==null) return 'Salut '+nom+", je n'ai pas encore vu de séance de ta part. "
    +"Dis-moi si tu veux qu'on cale ça ensemble.";
  return 'Salut '+nom+", je n'ai pas vu de séance depuis "+j+" jour"+(j>1?'s':'')+'. '
    +"Dis-moi où tu en es, on ajuste si besoin.";
}
// Marquage « relancé ». Écrit UNIQUEMENT dans le dossier du coach, et met le
// signal en veille par le mécanisme EXISTANT — aucun second système.
function frMarquerRelance(coach,c,jours){
  if(!coach||!c) return false;
  if(!coach.relances) coach.relances={};
  coach.relances[c.id]=Date.now();
  if(!coach.journalRelance) coach.journalRelance=[];
  coach.journalRelance.push({at:Date.now(),clientId:c.id});
  if(coach.journalRelance.length>200) coach.journalRelance=coach.journalRelance.slice(-200);
  return true;
}
// PURE. Nombre d'athlètes relancés depuis lundi.
function frRelancesSemaine(coach,now){
  const t=(typeof now==='number')?now:Date.now();
  const d=new Date(t);
  const lundi=new Date(d.getFullYear(),d.getMonth(),d.getDate()-((d.getDay()+6)%7)).getTime();
  const vus=new Set();
  for(const e of ((coach&&coach.journalRelance)||[]))
    if(e&&e.at>=lundi&&e.at<=t) vus.add(e.clientId);
  return vus.size;
}

// ── L'écran de la file ────────────────────────────────────────────────────
// Écran du COACH seul. Il ne modifie jamais le dossier d'un athlète : les
// trois actions écrivent dans le dossier du coach (alertStatus, relances,
// journalRelance) et nulle part ailleurs.
const FR_DUREES=Object.freeze([7,14,30]);
let _frDuree=FR_DUREES[0];
function frSetDuree(j){ _frDuree=Number(j)||FR_DUREES[0]; }

function _frClient(id){
  try{ return getClients().find(c=>c&&c.id===id)||null; }catch(e){ return null; }
}
// (a) RELANCER. RepCore ne connaît pas le numéro de l'athlète : le lien porte
// le TEXTE, le contact se choisit dans WhatsApp. Sur poste fixe, où wa.me et
// sms: n'ouvrent rien d'utile, le texte part dans le presse-papiers.
function frRelancer(id){
  const c=_frClient(id);
  if(!c) return false;
  const texte=_frTexteRelance(c,Date.now());
  try{
    window.open('https://wa.me/?text='+encodeURIComponent(texte),'_blank','noopener');
  }catch(e){}
  frCopier(texte);
  return true;
}
function frCopier(texte){
  const fini=()=>toast('Texte copié : colle-le dans ta conversation.');
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(texte).then(fini,()=>_frCopieRepli(texte));
      return true;
    }
  }catch(e){}
  return _frCopieRepli(texte);
}
function _frCopieRepli(texte){
  try{
    const z=document.createElement('textarea');
    z.value=texte; z.style.position='fixed'; z.style.left='-9999px';
    document.body.appendChild(z); z.select();
    document.execCommand('copy'); z.remove();
    toast('Texte copié : colle-le dans ta conversation.');
    return true;
  }catch(e){ toast('Copie impossible sur cet appareil.','var(--orange)'); return false; }
}
// (b) MARQUER RELANCÉ : le repère chez le coach, PLUS la mise en veille par le
// mécanisme existant. (c) REPORTER : la mise en veille seule.
function frMarquer(id,avecRelance){
  const c=_frClient(id);
  if(!c) return false;
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){}
  const type=_frType(c,sg);
  try{ reporterAlerte(type,c,_frDuree); }catch(e){}
  if(avecRelance) frMarquerRelance(currentUser,c,_frDuree);
  toastEcriture(saveUser(),
    avecRelance?('Relance notée · en veille '+_frDuree+' j'):('Reporté de '+_frDuree+' j'),
    'le report est');
  renderFileReprise();
  return true;
}
function renderFileReprise(){
  const el=document.getElementById('cfr-body');
  if(!el) return;
  let ath=[];
  try{ ath=getClients(); }catch(e){
    el.innerHTML='<div class="sub" style="font-size:var(--fs-sm);padding:16px 2px">Impossible de lire ton portefeuille pour l\'instant.</div>';
    return;
  }
  const f=fileReprise(ath,currentUser,Date.now());
  const sem=frRelancesSemaine(currentUser,Date.now());
  const tete=`<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;
      background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:12px">
      <span style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.5">Relancés cette semaine</span>
      <span style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:var(--red-text);
        --halo-c:color-mix(in srgb,var(--red) 60%,transparent);text-shadow:var(--halo-1)">${sem}</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <span style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.2px;font-weight:800;text-transform:uppercase">Mettre en veille</span>
      <select onchange="frSetDuree(this.value)" aria-label="Durée de mise en veille"
        style="min-height:38px;padding:6px 10px;border-radius:var(--r-2);background:var(--surface-1);border:1px solid var(--border);
          color:var(--text-strong);font-family:Montserrat,sans-serif;font-size:var(--fs-xs)">
        ${FR_DUREES.map(j=>`<option value="${j}"${j===_frDuree?' selected':''}>${j} jours</option>`).join('')}
      </select>
    </div>`;
  if(!f.lignes.length){
    el.innerHTML=tete+_htmlCalendrierAcces()+`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);
      padding:24px 16px;text-align:center;font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">
      Personne à relancer. Les athlètes en pause déclarée et ceux qui portent un signal de santé n'entrent jamais ici : ils gardent leur ligne dans « Mes notifications ».</div>`;
    return;
  }
  const bouton=(lib,act,fort)=>`<button type="button" onclick="${act}"
    style="flex:1;min-width:0;min-height:44px;padding:8px 6px;border-radius:var(--r-2);cursor:pointer;
      font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.3px;
      background:${fort?'rgba(224,32,32,.14)':'#111'};border:1px solid ${fort?'var(--red)':'var(--border)'};
      color:${fort?'var(--text)':'var(--sub)'}">${escapeHtml(lib)}</button>`;
  el.innerHTML=tete+_htmlCalendrierAcces()+f.lignes.map(r=>`<div style="background:linear-gradient(180deg,var(--surface-2),var(--surface-0));
      border:1px solid var(--border);border-left:1px solid var(--border);border-radius:var(--r-3);
      padding:12px 12px;margin-bottom:10px;box-shadow:var(--e2)">
      <div style="display:flex;align-items:baseline;gap:8px">
        <span style="font-size:var(--fs-md);font-weight:900;color:var(--text)">${escapeHtml(r.prenom||'Athlète')}</span>
        <span style="margin-left:auto;font-size:var(--fs-2xs);color:var(--text-faint);flex-shrink:0">${r.jours==null?'aucune séance':r.jours+' j sans séance'}</span>
      </div>
      ${r.signal?`<div style="font-size:var(--fs-xs);color:#bbb;line-height:1.55;margin-top:4px">${escapeHtml(r.signal)}</div>`:''}
      ${r.relanceDepuis!=null?`<div style="font-size:var(--fs-2xs);color:var(--green);margin-top:4px">Relancé il y a ${r.relanceDepuis} j</div>`:''}
      <div style="display:flex;gap:6px;margin-top:10px">
        ${bouton('Relancer',"frRelancer('"+r.id+"')",true)}
        ${bouton('Marquer relancé',"frMarquer('"+r.id+"',true)")}
        ${bouton('Reporter',"frMarquer('"+r.id+"',false)")}
      </div>
    </div>`).join('')
    +(f.reste?`<div class="sub" style="font-size:var(--fs-xs);padding:6px 2px">et ${f.reste} autre${f.reste>1?'s':''} : traite ceux-ci d'abord.</div>`:'')
    +`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:10px">Le message est préparé, pas envoyé : tu choisis le contact et tu relis avant d'appuyer. Il ne contient aucune information de santé : le canal n'est pas chiffré.</div>`;
}
function loadFileReprise(){
  go('s-coach-file');
  renderFileReprise();
}
function _rappelContreIndication(c){
  let ci=[];
  try{ ci=contreIndications(c.bilans); }catch(e){ ci=[]; }
  if(!ci.length) return '';
  return ' Contre-indication au dossier : '+ci.map(x=>x.txt).join(' · ')+'.';
}
function _texteSignal(type,c,sg){
  const d=(sg&&sg.details)||{};
  if(type==='douleur'&&d.douleur){
    const x=d.douleur;
    return 'douleur déclarée '+x.painMax+'/6 sur '+x.nom+', '+x.seances+' séances sur les 3 dernières.'
      +_rappelContreIndication(c);
  }
  if(type==='douleurdiff'&&d.douleurDiffuse){
    const x=d.douleurDiffuse;
    return x.series+' séries douloureuses sur '+x.jours+' jours, '+x.exercices.length
      +' exercice'+(x.exercices.length>1?'s':'')+' concerné'+(x.exercices.length>1?'s':'')+'.'
      +_rappelContreIndication(c);
  }
  if(type==='decrochage'&&d.decrochage){
    const x=d.decrochage;
    return x.faits+' séries réalisées sur '+x.prevus+' prévues sur les '+x.seances+' dernières séances.';
  }
  if(type==='blocfini'&&d.blocPrioriteFini){
    const x=d.blocPrioriteFini;
    const noms=(x.hauts||[]).map(m=>((MUSCLES[m]||{}).lib||m).toLowerCase()).join(' et ');
    // LE RAPPROCHEMENT FERME LA BOUCLE : le volume a bouge, est-ce que le
    // corps a suivi ? Sans mesure, on le DIT — annoncer un bloc « reussi »
    // sans rien pour l'etayer serait une conclusion sans donnee.
    // ⚠ PAS volAffiche ICI : elle arrondit au demi pres, ce qui convient a des
    // SERIES et detruit une mesure — +0,8 cm devenait « +1 cm », soit un
    // quart de plus que ce qui a ete mesure. Un centimetre se dit au dixieme.
    const _cm=v=>String(Math.round(Number(v)*10)/10).replace('.',',');
    const mes=x.mesure
      ? ' Mesures : '+(x.mesure.delta>=0?'+':'')+_cm(x.mesure.delta)+' cm ('
        +x.mesure.lib.toLowerCase()+').'
      : ' Aucune mensuration ne suit ce muscle sur la période.';
    return 'bloc '+(noms||'de priorité')+' terminé ('+x.semaines+' semaines).'+mes
      +' À reconduire, inverser, ou revenir à plat.';
  }
  if(type==='saut_charge'&&d.sautDeCharge){
    const x=d.sautDeCharge;
    // LE CHIFFRE BRUT NE DIT RIEN — « ratio 1,7 » demande de savoir ce qu'est
    // un ratio. La phrase dit le fait : la semaine pese la moitie de plus que
    // le mois.
    return 'la charge de la semaine dépasse de '
      +Math.round((x.ratio-1)*100)+' % la moyenne du mois, deux semaines de suite.';
  }
  if(type==='calibrage'&&d.calibrageDu){
    const x=d.calibrageDu;
    // ON DIT CE QUE CA COUTE DE NE PAS LE FAIRE, pas seulement qu'il est du :
    // « calibrage à refaire » ne dit pas au coach pourquoi il devrait s'en
    // occuper. Le RIR alimente l'e1RM, le plateau et ses propres consignes.
    return x.n===0
      ? 'perception de l\'effort jamais mesurée après '+x.seances+' séances : ce qui est noté série par série sert à estimer ses maximums et à repérer les plateaux, sans avoir jamais été vérifié.'
      : 'dernier calibrage de la perception de l\'effort il y a '+Math.floor(x.jours/30)+' mois. Elle change avec l\'entraînement : le repère mérite d\'être repris.';
  }
  if(type==='entrainement'){
    if(d.restrictionLongue) return 'sèche depuis '+d.restrictionLongue.semaines
      +' semaines à '+d.restrictionLongue.kcal+' kcal, pour un plancher de '
      +d.restrictionLongue.plancher+' kcal. Une pause dans la restriction est à envisager.';
    if(d.plateauMuscle) return d.plateauMuscle.lib.toLowerCase()+' en plateau : '
      +d.plateauMuscle.bloques+' exercices sans nouveau maximum depuis '
      +d.plateauMuscle.semaines+' semaines.';
    // Le volume sous le minimum AVANT la forme : même précédence que
    // libelleEntrainement et signalPrincipal (06/10/2026).
    if(d.sousMEV) return d.sousMEV.lib.toLowerCase()+' sous le volume minimum deux semaines de suite ('
      +volAffiche(d.sousMEV.s1)+' et '+volAffiche(d.sousMEV.s2)+' séries pour un minimum de '
      +volAffiche(d.sousMEV.mev)+').';
    if(d.formeBasse) return 'forme déclarée à '+d.formeBasse.moy+'/10, contre '
      +d.formeBasse.base+' habituellement.';
    if(d.volumeHaut) return d.volumeHaut.lib.toLowerCase()+' au-dessus du repère haut depuis 2 semaines ('
      +volAffiche(d.volumeHaut.s1)+' et '+volAffiche(d.volumeHaut.s2)+' séries, repère '
      +volAffiche(d.volumeHaut.mrv)+').';
  }
  return '';
}
// ══════════════ AJUSTER DEPUIS L'ALERTE ══════════════
// Corriger l'exercice à l'origine d'un signal sans quitter l'accueil coach.
// AUCUN NOUVEAU CHAMP : ce lot n'écrit que dans sessions_config, par le chemin
// déjà employé par les autres écritures dans le dossier d’un athlète —
// resolveClient, DB.set, CLOUD.pushOne. (Ce commentaire citait removeCoachPdf,
// retirée le 08/09/2026 avec le dépôt de PDF ; le chemin, lui, n’a pas bouge.) Ce
// n'est pas un second chemin d'écriture : saveCoachSessions, lui, lit
// _coachEditClient et finit par un go() qui ferait quitter l'écran.
// N6.6 — 'ajouter_serie' rejoint les deux autres. Elle n'est OFFERTE que
// devant un volume insuffisant : les signaux de douleur, de decrochage et de
// volume eleve gardent exactement leurs deux actions.
// B3.4 — QUATRE GESTES, DONT UN QUI PORTE SUR L'INTENSITE.
//
// Les trois premiers agissent sur le VOLUME ou sur le choix du mouvement. Or
// devant un plateau — le signal qui appelle le plus souvent une reponse
// d'intensite — le seul geste disponible restait « retirer une serie » ou
// « substituer ». Le levier d'intensite venait d'etre cree pour l'editeur, et
// il n'etait branche nulle part sur l'aide a la decision.
const AJ_ACTIONS=Object.freeze(['substituer','retirer_serie','ajouter_serie','durcir_rir']);
// UN CRAN, ET UN SEUL, PAR GESTE. Le coach peut le rejouer ; l'outil ne
// descend pas tout seul un athlete de RIR 3 a RIR 0.
const AJ_RIR_PAS=1;
// LE PLANCHER EST 1, ET NON 0. RIR 0 est l'echec : le proposer comme
// ajustement automatique devant un plateau reviendrait a prescrire l'echec a
// chaque serie, ce qu'aucun coach ne ferait d'un clic.
const AJ_RIR_MIN=1;
// Au-dela, on ne repare plus un manque de volume : on en fabrique un autre.
// Le coach garde la main — il peut rappeler l'action — mais l'outil ne monte
// pas tout seul un exercice a douze series.
const AJ_SERIES_MAX=8;
// PURE. La clé de rapprochement, et la SEULE correcte.
//
// Le nom porté par un signal vient de sessions[n].data — le nom tel qu'il a
// été JOURNALISÉ — et pas de sessions_config. Mesuré : un programme portant
// « DÉVELOPPÉ COUCHÉ BARRE » le lundi et « DEVELOPPE COUCHE BARRE » le jeudi
// produit un signal sur « developpe couche barre ». Les trois chaînes sont
// différentes et les trois exKey sont identiques. Comparer des chaînes ne
// trouverait rien, silencieusement.
function _ajCle(nom){
  const k=exKey(nom||'');
  if(!k) return '';
  try{ return resoudreAlias(k)||k; }catch(e){ return k; }
}
// PURE. L'exercice à l'origine d'un signal, ou null.
//
// DEUX SIGNAUX SUR HUIT PORTENT UN NOM, et c'est une propriété du signal, pas
// une lacune à combler : une séance écourtée, une forme basse ou une sèche
// longue ne désignent aucun mouvement. Pour ceux-là, null est la vérité, et
// la feuille n'offrira que le report.
//
// Le plateau est le cas intermédiaire : details.plateauMuscle ne porte qu'un
// COMPTE d'exercices bloqués, mais _listeEtats — la source AMONT du même
// calcul, déjà mise en cache — porte leurs noms. `user` est donc un troisième
// argument FACULTATIF : sans lui la fonction garde exactement le contrat
// (type, details), avec lui elle sait aussi remonter un plateau.
function exerciceDuSignal(type,details,user){
  const d=details||{};
  if(type==='douleur'&&d.douleur&&d.douleur.nom)
    return {nom:d.douleur.nom,tous:((d.douleurTous||[]).map(x=>x&&x.nom).filter(Boolean))||[]};
  if(type==='douleurdiff'&&d.douleurDiffuse&&(d.douleurDiffuse.exercices||[]).length)
    return {nom:d.douleurDiffuse.exercices[0],tous:d.douleurDiffuse.exercices.slice()};
  // N6.6 — LE VOLUME INSUFFISANT DESIGNE UN EXERCICE. Sans cela, la feuille
  // d'ajustement s'ouvrait sans cible et n'offrait aucune action : le signal
  // se voyait, et rien ne permettait d'y repondre.
  // On vise les exercices dont ce muscle est le PRIMAIRE : ajouter une serie
  // sur un exercice ou il n'est que secondaire ne remonterait presque pas son
  // volume, et gonflerait celui d'un autre.
  if(type==='entrainement'&&!d.plateauMuscle&&d.sousMEV&&user){
    try{
      const m=d.sousMEV.muscle;
      const noms=[];
      for(const sc of ((user.sessions_config)||[])){
        if(!sc||!sc.active||!Array.isArray(sc.exercises)) continue;
        for(const e of sc.exercises){
          if(!e||!e.name||isCardio(e)) continue;
          let cls=null;
          try{ cls=resoudreMusclesLecture(e.name,e,user); }catch(err){ continue; }
          if(!cls||cls===VOL_CARDIO) continue;
          if((cls.p||[]).indexOf(m)>=0&&noms.indexOf(e.name)<0) noms.push(e.name);
        }
      }
      if(noms.length) return {nom:noms[0],tous:noms};
    }catch(e){}
  }
  if(type==='entrainement'&&d.plateauMuscle&&user){
    try{
      const m=d.plateauMuscle.muscle;
      const bloques=_listeEtats(user).filter(x=>x&&(x.etat==='plateau'||x.etat==='regression'));
      const dans=bloques.filter(x=>{
        let cls=null;
        try{ cls=resoudreMusclesLecture(x.nom,{name:x.nom},user); }catch(e){ return false; }
        return cls&&cls!==VOL_CARDIO&&(cls.p||[]).indexOf(m)>=0;
      });
      if(dans.length) return {nom:dans[0].nom,tous:dans.map(x=>x.nom)};
    }catch(e){}
  }
  return null;
}
// PURE. TOUS les créneaux où un exercice apparaît, actifs ou non — un créneau
// désactivé reste un créneau du programme, et l'omettre ferait mentir le choix
// « ce jour / tous les jours ».
function creneauxDeLExercice(sessionsConfig,nom){
  const out=[];
  const cible=_ajCle(nom);
  if(!cible||!Array.isArray(sessionsConfig)) return out;
  sessionsConfig.forEach((sc,slot)=>{
    ((sc&&sc.exercises)||[]).forEach((ex,idxExercice)=>{
      if(ex&&_ajCle(ex.name)===cible)
        out.push({slot,idxExercice,jour:(sc.day||''),nomSeance:(sc.name||''),
          active:!!sc.active,nomEcrit:ex.name||''});
    });
  });
  return out;
}
// PURE. Les substituts, AVEC ceux qui ne conviennent pas.
//
// Un exercice écarté est rendu, marqué compatible:false et motivé — jamais
// retiré en silence. Le coach doit voir que la variante à laquelle il pense a
// été examinée et pourquoi elle est écartée ; une liste amputée le laisserait
// croire qu'elle n'existe pas.
//
// Deux familles, dans cet ordre : les variantes du MÊME schéma moteur, qui
// gardent l'effet d'entraînement, puis — seulement si une contrainte pèse —
// les schémas dont la charge sur la zone est STRICTEMENT plus basse. La
// seconde famille réutilise la grille du coach, elle n'en invente pas une.
function substitutsPour(nom,contraintes){
  const out=[];
  let sch=null;
  try{ sch=schemaDe({name:nom}); }catch(e){ sch=null; }
  const zones=((contraintes||[]).filter(c=>c&&c.zone&&c.actif!==false).map(c=>c.zone));
  // Le verdict d'un schéma face aux zones contraintes. Une charge NON NOTÉE
  // ne déclenche rien : tant que le coach n'a pas jugé, l'app ne juge pas.
  const juger=(s)=>{
    for(const z of zones){
      let ch=null;
      try{ ch=chargeSchema(s,z); }catch(e){ ch=null; }
      if(ch!=null&&ch>=SEUIL_CONTRAINTE_EX)
        return {compatible:false,motif:'sollicite '+libZone(z)+' ('+ch+'/3), zone déclarée sensible'};
    }
    return {compatible:true,motif:''};
  };
  const cible=_ajCle(nom);
  const vus=new Set();
  if(sch){
    const v=juger(sch);
    for(const n of ((SCHEMAS_BRUT[sch]||'').split('~'))){
      if(!n) continue;
      const k=_ajCle(n);
      if(!k||k===cible||vus.has(k)) continue;
      vus.add(k);
      out.push({nom:n,compatible:v.compatible,motif:v.motif,schema:sch,memeSchema:true});
    }
  }
  // Si le schéma d'origine est écarté, on va chercher ailleurs — sinon la
  // liste ne contiendrait que des exercices grisés.
  if(sch&&zones.length&&!juger(sch).compatible){
    for(const s2 in SCHEMAS_META){
      if(s2===sch) continue;
      const v2=juger(s2);
      if(!v2.compatible) continue;
      // Une charge NOTÉE et plus basse : un schéma jamais jugé n'est pas
      // proposé comme refuge, on ne sait pas ce qu'il vaut.
      let connue=false;
      for(const z of zones){ let c2=null; try{ c2=chargeSchema(s2,z); }catch(e){} if(c2!=null) connue=true; }
      if(!connue) continue;
      for(const n of ((SCHEMAS_BRUT[s2]||'').split('~')).slice(0,6)){
        if(!n) continue;
        const k=_ajCle(n);
        if(!k||k===cible||vus.has(k)) continue;
        vus.add(k);
        out.push({nom:n,compatible:true,motif:'',schema:s2,memeSchema:false});
      }
    }
  }
  return out;
}
// ── Ce qui ne survit pas à un remplacement d’exercice ──────────────────────
//
// MUTE SON ENTRÉE, délibérément : les trois appelants tiennent déjà l’objet
// qu’ils veulent modifier, chacun dans son contexte — une copie du programme
// pour le coach, `progEx` pour l’éditeur, `woState.exercises` pour la séance.
//
// UNE SEULE LISTE POUR LES TROIS. Elle n’existait que dans la version coach ;
// les deux versions athlète ne nettoyaient rien, et l’encart CONSIGNE
// réaffichait en séance le matériel, la description, le tempo, la vidéo et la
// bannière de technique du mouvement qu’on venait d’abandonner. Trois copies
// d’une même règle, dont une seule écrite.
//
// CE QUI RESTE, ET POURQUOI :
//   `series`, `reps`, `repos` — la prescription du coach. Le remplacement
//      change le MOUVEMENT, pas le travail demandé.
//   `ss` et le rang — on écrit À LA MÊME POSITION : le chaînage de superset
//      et l’ordre de la séance tiennent tout seuls.
//   `rir` — une consigne d’EFFORT, pas une description du mouvement.
//      « Arrête-toi à deux répétitions de l’échec » garde le même sens sur le
//      mouvement de remplacement, là où quatre-vingts kilos, non.
function _oublierAncienMouvement(ex){
  if(!ex) return ex;
  // L’image base64 ne suit JAMAIS : elle montrerait le mouvement qu’on vient
  // justement de retirer.
  delete ex.image;
  // Tout ce qui DÉCRIVAIT l’ancien mouvement ne décrit plus le nouveau.
  delete ex.description; delete ex.note; delete ex.tempo;
  // Un banc à smith ne sert pas à des fentes haltères, et les deux vidéos
  // montrent encore le geste qu’on vient de retirer.
  delete ex.materiel; delete ex.videoUrl; delete ex.videoUrl2;
  // Quatre-vingts kilos sur un squat ne sont pas quatre-vingts kilos sur une
  // presse : un poids est attaché à un mouvement.
  delete ex.charge; delete ex.poids;
  // ET LA PROGRAMMATION AVEC, pour exactement la même raison — en plus fort.
  // Elle repose sur une charge maximale sur UNE répétition, mesurée sur le
  // mouvement qu'on vient de retirer : la garder ferait suggérer, semaine après
  // semaine, des charges calculées depuis un maximum que l'athlète n'a jamais
  // soulevé sur ce mouvement-là. Un poids faux une fois est une note à
  // corriger ; un maximum faux est une progression entière qui part de travers.
  //
  // ON LE DIT, parce que ce n'est pas une note mais du travail : un 1RM et N
  // semaines de séries, répétitions et RPE. La règle du projet vaut ici — rien
  // ne disparaît en silence. Le geste de remplacement, lui, reste celui du
  // coach : on ne le bloque pas, on l'informe.
  if(ex.prog){
    delete ex.prog;
    try{ toast('La programmation de cet exercice a été retirée : elle reposait sur un maximum mesuré sur l’ancien mouvement.','var(--orange)'); }catch(e){}
  }
  // La technique et les séries qu’elle visait décrivaient l’ancien geste.
  delete ex.methode; delete ex.methodeSeries;
  // Et la justification portait sur une contrainte évaluée pour l’ancien nom.
  delete ex.justificationContrainte;
  return ex;
}
// PURE, NE MUTE PAS SON ENTRÉE. Rend un nouveau sessions_config.
//
// « Seances » et non « appliquerAjustement » tout court : ce dernier nom etait
// deja pris par l ajustement de MACROS nutritionnelles. Deux declarations de
// fonction du meme nom ne produisent aucune erreur — la seconde ecrase la
// premiere en silence, et c est la mienne qui disparaissait.
function appliquerAjustementSeances(sessionsConfig,cibles,action){
  const src=Array.isArray(sessionsConfig)?sessionsConfig:[];
  const out=src.map(sc=>Object.assign({},sc,{
    exercises:((sc&&sc.exercises)||[]).map(x=>Object.assign({},x))}));
  const type=(action||{}).type;
  if(AJ_ACTIONS.indexOf(type)<0) return out;
  for(const c of (cibles||[])){
    if(!c) continue;
    const sc=out[c.slot];
    if(!sc||!Array.isArray(sc.exercises)) continue;
    const ex=sc.exercises[c.idxExercice];
    if(!ex) continue;
    if(type==='retirer_serie'){
      const n=Math.max(0,parseInt(ex.series,10)||0);
      // Jamais zéro : un exercice à zéro série n'est pas un exercice allégé,
      // c'est un exercice supprimé — et ce lot ne supprime rien.
      ex.series=Math.max(1,n-1);
    }else if(type==='ajouter_serie'){
      // N6.6 — LE SYMETRIQUE EXACT du retrait, plafond compris.
      const n=Math.max(0,parseInt(ex.series,10)||0);
      ex.series=Math.min(AJ_SERIES_MAX,n+1);
    }else if(type==='durcir_rir'){
      // B3.4 — ON DESCEND LE RIR : moins de repetitions en reserve, donc plus
      // d'intensite. C'est le sens inverse de l'intuition, et c'est pour cela
      // que le libelle dit « pousser plus fort » et non « -1 RIR ».
      //
      // L'ABSENCE DE CONSIGNE RESTE UNE ABSENCE : un exercice sans RIR
      // prescrit n'en recoit pas un par la bande. Zero signifierait
      // « jusqu'a l'echec », et ce serait le contresens le plus grave.
      const r0=_rirPrescrit(ex);
      if(r0==='') continue;
      const r=Math.max(AJ_RIR_MIN,Number(r0)-AJ_RIR_PAS);
      ex.rir=String(r);
      // rirCible est l'ancien champ, encore lu par _rirPrescrit : le laisser
      // en place ferait gagner l'ancienne valeur sur la nouvelle.
      if(ex.rirCible!=null) ex.rirCible=String(r);
    }else if(type==='substituer'){
      const nv=String((action.nom||'')).trim();
      if(!nv) continue;
      ex.name=nv;
      // LA MÊME LISTE QUE LES DEUX VERSIONS ATHLÈTE. Elle n’était écrite
      // qu’ici, et c’est ce qui a permis aux deux autres de s’en écarter.
      _oublierAncienMouvement(ex);
    }
  }
  return out;
}

// ── La feuille ─────────────────────────────────────────────────────────────
let _ajCtx=null;
// Le bouton n'apparaît QUE sur les lignes de signal d'entraînement : elles
// portent un athlète et sa donnée (list:[c]), là où les lignes administratives
// portent un groupe. Aucune action de masse n'est donc possible — la règle
// « un athlète, un geste » se tient par la structure des lignes.
function _ajBouton(r,idx){
  if(!r||!r.texte||r.type==='drapeau') return '';
  return '<button class="hit44" onclick="event.stopPropagation();ouvrirAjustement('+idx+')"'
    +' title="Ajuster le programme" aria-label="Ajuster le programme"'
    +' style="background:none;border:none;color:var(--sub);font-size:var(--fs-lg);cursor:pointer;'
    +'min-width:44px;min-height:44px;flex-shrink:0;border-radius:var(--r-1)">'+icon('sliders',16)+'</button>';
}
function ouvrirAjustement(idx){
  const r=window._todoRows&&window._todoRows[idx];
  if(!r||!r.list||!r.list.length) return false;
  const c=r.list[0];
  let sg=null;
  try{ sg=signauxEntrainement(c); }catch(e){ sg=null; }
  const ex=sg?exerciceDuSignal(r.type,sg.details,c):null;
  _ajCtx={idx,type:r.type,clientId:c.id,exercice:ex,portee:'jour',
    creneaux:ex?creneauxDeLExercice(c.sessions_config,ex.nom):[],
    slotChoisi:null,liste:false};
  if(_ajCtx.creneaux.length) _ajCtx.slotChoisi=_ajCtx.creneaux[0].slot;
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column">'
    +'<div id="aj-corps" style="flex:1;overflow:auto;-webkit-overflow-scrolling:touch"></div>'
    +'</div></div>');
  _ajRendre();
  return true;
}
function _ajClient(){
  if(!_ajCtx) return null;
  try{ return getOwnedClient(_ajCtx.clientId); }catch(e){ return null; }
}
function _ajCibles(){
  if(!_ajCtx) return [];
  const l=_ajCtx.creneaux||[];
  if(_ajCtx.portee==='tous') return l;
  return l.filter(x=>x.slot===_ajCtx.slotChoisi);
}
function _ajRendre(){
  const z=document.getElementById('aj-corps');
  if(!z||!_ajCtx) return false;
  const c=_ajClient();
  if(!c){ z.innerHTML='<div style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6">Athlète introuvable.</div>'; return false; }
  const nom=((c.fname||'')+' '+(c.lname||'')).trim()||'Athlète';
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){}
  const txt=sg?_texteSignal(_ajCtx.type,c,sg):'';
  let h='<div style="font-size:var(--fs-lg);font-weight:800;margin-bottom:4px">'+escapeHtml(nom)+'</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">'+escapeHtml(txt)+'</div>';
  // RÈGLE 1. Sous drapeau rouge, AUCUNE action de programmation. Le produit
  // suspend et renvoie ; il ne prescrit pas par-dessus. La garde est ici et
  // pas seulement dans l'ordre des lignes du tableau de bord : rien ne
  // garantit cet ordre à l'avenir.
  let drap=null; try{ drap=drapeauRougeActif(c); }catch(e){}
  if(drap||(function(){try{return drapeauQuelconqueActif(c);}catch(e){return false;}})()){
    z.innerHTML=h+'<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:12px 14px">'
      +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">Un drapeau est levé sur ce dossier. '
      +'Aucun ajustement de programme n\'est proposé tant qu\'il n\'est pas levé.</div>'
      +blocDisclaimerSante()+'</div>';
    return true;
  }
  const ci=_rappelContreIndication(c);
  if(ci) h+='<div style="font-size:var(--fs-xs);color:var(--orange);line-height:1.6;margin-bottom:12px">'+escapeHtml(ci.trim())+'</div>';
  const ex=_ajCtx.exercice;
  const cr=_ajCtx.creneaux||[];
  if(!ex){
    h+='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">'
      +'Ce signal ne désigne aucun exercice en particulier : il porte sur l\'ensemble '
      +'de la semaine. Il n\'y a rien à substituer ici.</div>';
  }else if(!cr.length){
    h+='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">'
      +'<b>'+escapeHtml(ex.nom.toLowerCase())+'</b> ne figure plus dans le programme actuel : '
      +'il a été fait, puis retiré ou renommé. Rien à ajuster.</div>';
  }else{
    h+='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:6px">Exercice concerné</div>'
      +'<div style="font-size:var(--fs-md);font-weight:800;margin-bottom:8px">'+escapeHtml(ex.nom.toLowerCase())+'</div>';
    // RÈGLE 5 : présent deux jours, le choix est EXPLICITE. Jamais implicite.
    if(cr.length>1){
      h+='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:6px">'
        +'Présent sur '+cr.length+' créneaux. Sur lequel agir ?</div>'
        +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'
        +cr.map(x=>'<button onclick="ajPortee(\'jour\','+x.slot+')" class="hit44" style="min-height:44px;'
          +'background:'+((_ajCtx.portee==='jour'&&_ajCtx.slotChoisi===x.slot)?'var(--red)':'var(--surface-1)')+';'
          +'border:1px solid var(--border);border-radius:var(--r-2);padding:8px 12px;font-size:var(--fs-xs);color:var(--text-strong);cursor:pointer">'
          +escapeHtml((x.jour||('créneau '+(x.slot+1)))+(x.active?'':' (inactif)'))+'</button>').join('')
        +'<button onclick="ajPortee(\'tous\',null)" class="hit44" style="min-height:44px;'
        +'background:'+(_ajCtx.portee==='tous'?'var(--red)':'var(--surface-1)')+';'
        +'border:1px solid var(--border);border-radius:var(--r-2);padding:8px 12px;font-size:var(--fs-xs);color:var(--text-strong);cursor:pointer">Tous les jours</button>'
        +'</div>';
    }else{
      h+='<div style="font-size:var(--fs-xs);color:var(--text-faint);line-height:1.6;margin-bottom:12px">'
        +escapeHtml(cr[0].jour||('Créneau '+(cr[0].slot+1)))+(cr[0].active?'':' · créneau inactif')+'</div>';
    }
    h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
      +'<button class="btn btn-outline btn-sm" style="flex:1;min-width:120px;margin:0;min-height:44px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="ajListeSubstituts()">Substituer</button>'
      +_ajBoutonAjouter(c)
      +_ajBoutonDurcir(c)
      +'<button class="btn btn-outline btn-sm" style="flex:1;min-width:120px;margin:0;min-height:44px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="ajRetirerSerie()">Retirer une série</button>'
      +'</div>';
    // « Baisser l'intensité » n'est PAS rendu : aucun champ d'intensité
    // prescrite n'existe sur un exercice de sessions_config. L'action
    // apparaîtra le jour où le champ existera, pas avant.
    if(_ajCtx.liste){
      let subs=[];
      try{ subs=substitutsPour(ex.nom,contraintesActives(c)); }catch(e){ subs=[]; }
      if(!subs.length){
        h+='<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;padding:6px 0">'
          +'Aucun substitut à proposer : le schéma moteur de cet exercice n\'est pas renseigné.</div>';
      }else{
        // Les utilisables d'abord. Sans ce tri, une contrainte qui écarte tout
        // un schéma remplissait la fenêtre de lignes grises et repoussait les
        // seuls exercices cliquables hors de l'écran.
        const ordonnes=subs.slice().sort((a,b)=>(b.compatible?1:0)-(a.compatible?1:0));
        const vus=ordonnes.slice(0,30);
        h+=vus.map(x=>'<button '+(x.compatible?'onclick="ajSubstituer('+JSON.stringify(x.nom).replace(/"/g,'&quot;')+')"':'disabled')
          +' class="hit44" style="display:block;width:100%;text-align:left;min-height:44px;'
          +'background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;'
          +'margin-bottom:6px;font-size:var(--fs-sm);cursor:'+(x.compatible?'pointer':'not-allowed')+';'
          +'color:'+(x.compatible?'var(--text-strong)':'var(--text-faint)')+';opacity:'+(x.compatible?'1':'.55')+'">'
          +escapeHtml(x.nom.toLowerCase())
          // RÈGLE 7 : écarté, GRISÉ, motivé — jamais masqué en silence.
          +(x.compatible?'':'<div style="font-size:var(--fs-2xs);color:var(--orange);line-height:1.5;margin-top:4px">'+escapeHtml(x.motif)+'</div>')
          +'</button>').join('');
        if(ordonnes.length>vus.length)
          h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;padding:2px 0 6px">'
            +(ordonnes.length-vus.length)+' autres mouvements ne sont pas affichés, tous écartés '
            +'pour la même raison.</div>';
      }
    }
  }
  h+='<button class="btn btn-outline btn-sm" style="width:100%;margin:4px 0 0;min-height:44px;letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="ajReporter()">Reporter 7 jours</button>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-top:10px">'
    +'Chaque modification archive le programme précédent : tu peux revenir en arrière depuis la fiche.</div>';
  z.innerHTML=h;
  return true;
}
function ajPortee(mode,slot){
  if(!_ajCtx) return false;
  _ajCtx.portee=(mode==='tous')?'tous':'jour';
  if(mode!=='tous') _ajCtx.slotChoisi=slot;
  _ajRendre();
  return true;
}
function ajListeSubstituts(){ if(!_ajCtx) return false; _ajCtx.liste=true; _ajRendre(); return true; }
// Le seul point d'écriture du lot.
function _ajEcrire(action){
  if(!_ajCtx) return false;
  const res=(function(){ try{ return resolveClient(_ajCtx.clientId); }catch(e){ return null; } })();
  if(!res) return false;
  const c=res.c, users=res.users;
  // La garde de la règle 1 est reposée ICI : entre l'ouverture de la feuille
  // et le clic, un drapeau a pu être levé sur un autre appareil.
  let bloque=false;
  try{ bloque=drapeauQuelconqueActif(c); }catch(e){}
  if(bloque){ toast('Un drapeau est levé : aucun ajustement.','var(--orange)'); return false; }
  const cibles=_ajCibles();
  if(!cibles.length){ toast('Aucun créneau à modifier.','var(--orange)'); return false; }
  // RÈGLE 2 : instantané AVANT modification. Aucune exception.
  _pushSessionsHistory(c);
  c.sessions_config=appliquerAjustementSeances(c.sessions_config,cibles,action);
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  // RÈGLE 6 : le signal ne s'éteint QUE si l'action a porté sur l'exercice qui
  // l'a déclenché. La douleur vit dans l'HISTORIQUE : changer le programme ne
  // la fera pas disparaître du calcul, et le seul levier d'extinction existant
  // est le report. On le pose donc, mais seulement dans ce cas.
  const vise=_ajCtx.exercice&&_ajCtx.exercice.nom;
  const touche=cibles.some(x=>_ajCle(x.nomEcrit)===_ajCle(vise));
  if(vise&&touche){ try{ reporterAlerte(_ajCtx.type,c); saveUser(); }catch(e){ rcErreurMuette('_ajEcrire',e); } }
  closeModal();
  _ajCtx=null;
  try{ renderTodoBlock(getClients()); }catch(e){}
  toastSync(ok,CLOUD.pushOne(c.email,c),'Programme ajusté','l\'ajustement est');
  return true;
}
function ajRetirerSerie(){ return _ajEcrire({type:'retirer_serie'}); }
// N6.6 — L'ACTION ADDITIVE, OFFERTE SEULEMENT DEVANT UN VOLUME INSUFFISANT.
// Devant une douleur, un decrochage ou un volume deja eleve, ajouter une serie
// serait exactement le contraire de ce que le signal demande.
function _ajVolumeInsuffisant(c){
  if(!_ajCtx||_ajCtx.type!=='entrainement') return false;
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){ return false; }
  // Le plateau et la restriction prolongee partagent le type 'entrainement' et
  // ne reclament pas plus de volume : on exige le signal LUI-MEME.
  return !!(sg&&sg.sousMEV&&!sg.volumeHaut&&!sg.plateauMuscle);
}
// B3.4 — QUAND LE SIGNAL APPELLE UNE REPONSE D'INTENSITE, ET LA SEULEMENT.
//
// Un plateau, ou un volume deja haut : dans les deux cas, ajouter du volume
// serait la mauvaise reponse — c'est l'intensite qu'il faut reprendre.
// PAS UNE DOULEUR, PAS UN DECROCHAGE : devant l'une on allege, devant l'autre
// on reprend contact. Durcir y serait au mieux inutile, au pire nuisible.
// Meme forme de garde que _ajVolumeInsuffisant, pour la meme raison.
function _ajIntensiteAReprendre(c){
  if(!_ajCtx||_ajCtx.type!=='entrainement') return false;
  let sg=null; try{ sg=signauxEntrainement(c); }catch(e){ return false; }
  if(!sg) return false;
  if(sg.douleur||sg.decrochage) return false;
  return !!(sg.plateauMuscle||sg.volumeHaut);
}
// ET IL FAUT QU'IL Y AIT UNE CONSIGNE A DURCIR. Proposer le geste sur des
// exercices qui n'en portent aucune afficherait un bouton qui ne fait rien.
function _ajRirPrescritSurCible(c){
  try{
    const cfg=Array.isArray(c&&c.sessions_config)?c.sessions_config:[];
    return _ajCibles().some(x=>{
      const sc=cfg[x.slot];
      const ex=sc&&Array.isArray(sc.exercises)&&sc.exercises[x.idxExercice];
      return !!(ex&&_rirPrescrit(ex)!=='');
    });
  }catch(e){ return false; }
}
function _ajBoutonDurcir(c){
  if(!_ajIntensiteAReprendre(c)||!_ajRirPrescritSurCible(c)) return '';
  // LA DIRECTION EST MOTIVEE A L'ECRAN : le coach doit pouvoir refuser en
  // connaissance de cause, pas deviner ce que le bouton va faire.
  return '<button class="btn btn-outline btn-sm" style="flex:1;min-width:120px;margin:0;min-height:44px;'
    +'letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="ajDurcirRir()" '
    +'title="Une répétition de moins en réserve : plus d’intensité, à volume égal">'
    +'Pousser plus fort</button>';
}
function ajDurcirRir(){
  const c=_ajClient();
  if(!c||!_ajIntensiteAReprendre(c)) return false;
  return _ajEcrire({type:'durcir_rir'});
}
function _ajBoutonAjouter(c){
  if(!_ajVolumeInsuffisant(c)) return '';
  return '<button class="btn btn-outline btn-sm" style="flex:1;min-width:120px;margin:0;min-height:44px;'
    +'letter-spacing:.5px;font-size:var(--fs-2xs)" onclick="ajAjouterSerie()">Ajouter une série</button>';
}
function ajAjouterSerie(){
  const c=_ajClient();
  if(!c||!_ajVolumeInsuffisant(c)) return false;
  return _ajEcrire({type:'ajouter_serie'});
}
function ajSubstituer(nom){ return _ajEcrire({type:'substituer',nom}); }
function ajReporter(){
  const c=_ajClient();
  if(!c||!_ajCtx) return false;
  try{ reporterAlerte(_ajCtx.type,c); saveUser(); }catch(e){ return false; }
  closeModal();
  _ajCtx=null;
  try{ renderTodoBlock(getClients()); }catch(e){}
  toast('Reporté 7 jours');
  return true;
}

// PURE. Le libellé de la ligne « entraînement » : le signal qu'elle porte.
function libelleEntrainement(sg){
  const s=sg||{}, p=(s.details&&s.details.plateauMuscle)||{};
  if(s.restrictionLongue) return 'Restriction prolongée';
  if(s.plateauMuscle) return p.regression?'Charges en baisse':'Progression bloquée';
  if(s.sousMEV) return 'Volume sous le minimum';
  if(s.formeBasse) return 'Forme en baisse';
  return 'Volume élevé';
}
// Lignes par athlète, dans l'ordre de priorité. Un athlète n'apparaît qu'une
// fois : son signal le plus grave. Sinon un athlète qui cumule douleur,
// décrochage et plateau occuperait trois des huit lignes à lui seul.
function _lignesEntrainement(clients){
  const out=[], vus=new Set();
  const NIV=[
    {type:'douleur',    cle:'douleur',       icon:icon('activity',16),color:'var(--red)',   lib:'Douleur répétée'},
    {type:'douleurdiff',cle:'douleurDiffuse',icon:icon('activity',16),color:'var(--red)',   lib:'Douleurs diffuses'},
    {type:'decrochage', cle:'decrochage',    icon:icon('trending-down',16),color:'var(--orange)',lib:'Séances écourtées'},
    // LA CHARGE PASSE DEVANT LE PLATEAU. Un plateau se corrige la semaine
    // prochaine ; une charge qui a saute de moitie deux semaines de suite se
    // regarde maintenant.
    {type:'saut_charge', cle:'sautDeCharge',  icon:icon('trending-up',16),color:'var(--orange)',lib:'Charge en hausse marquée'},
    {type:'entrainement',cle:null,           icon:icon('chart-bar',16),color:'var(--orange)',lib:'Progression bloquée'},
    // DERNIER RANG, ET C'EST SA PLACE. `vus` fait que l'athlete deja remonte
    // pour une douleur, un decrochage ou un plateau n'apparait pas ici : on ne
    // parle pas d'entretien a un coach qui a un probleme de sante a traiter.
    // Gris et non orange : rien ne va mal, il manque juste une mesure.
    {type:'calibrage',  cle:'calibrageDu',   icon:icon('target',16),color:'var(--sub)',   lib:'Calibrage de la perception à faire'},
    // ECHEANCE DE BLOC : une decision a prendre, pas une alerte. Dernier rang,
    // gris, et hors d'urgencyScore comme le calibrage — un bloc qui se termine
    // ne remonte personne dans la liste.
    {type:'blocfini',   cle:'blocPrioriteFini',icon:icon('check-circle',16),color:'var(--sub)', lib:'Bloc de priorité terminé'}
  ];
  for(const n of NIV){
    for(const c of clients){
      if(vus.has(c.id)) continue;
      let sg; try{ sg=signauxEntrainement(c); }catch(e){ continue; }
      const actif=n.cle?sg[n.cle]:(sg.plateauMuscle||sg.formeBasse||sg.sousMEV||sg.volumeHaut||sg.restrictionLongue);
      if(!actif) continue;
      if(isAlertSnoozed(n.type,c.id,0,c)) continue;
      const txt=_texteSignal(n.type,c,sg);
      if(!txt) continue;
      vus.add(c.id);
      // Le rang est commun, mais l'intitulé ne peut pas l'être : un volume
      // au-dessus du repère haut n'est pas une progression bloquée. Même
      // précédence que _texteSignal, pour que le titre et la phrase parlent
      // toujours du même signal.
      // LES LIBELLÉS SÉPARÉS (06/10/2026) : un athlète simplement sous son
      // minimum de volume était annoncé « Progression bloquée ». Mêmes mots
      // et même précédence que signalPrincipal ET que _texteSignal.
      const lib=n.cle?n.lib:libelleEntrainement(sg);
      out.push({type:n.type,icon:n.icon,color:n.color,label:lib,list:[c],
        texte:txt,sante:ALERTES_SANTE.includes(n.type)});
    }
  }
  return out;
}
// ── Bloc « Douleur » de la fiche client ─────────────────────────────────────
// Trente jours d'historique, par exercice, trié par nombre d'occurrences. La
// donnée existait depuis toujours dans sessions[n].data et ne remontait nulle
// part : elle colorait la ligne pendant la séance, puis disparaissait.
function blocDouleurCoach(c){
  const l=douleurParExercice(c,SIG_DOULEUR_JOURS);
  if(!l.length) return '';
  const dat=t=>t?new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}):'';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">
      <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Douleur · 30 jours</span>
      <span style="font-size:var(--fs-2xs);color:var(--text-faint)">niveau 4 et plus</span>
    </div>
    ${l.map(x=>`<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px">
      <span style="font-size:var(--fs-xs);font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.nom)}</span>
      <span style="font-size:var(--fs-2xs);color:var(--sub);white-space:nowrap;flex-shrink:0">${x.n} série${x.n>1?'s':''} · max ${x.painMax}/6${_fragmentSiValeur(' · ',dat(x.derniere))}</span>
    </div>`).join('')}
    ${blocDisclaimerDouleur()}
  </div>`;
}
function renderDouleurCoach(c){
  // Le panneau de bloc suit le meme rendu que la douleur : meme ecran, meme
  // instant, et une seule fonction a appeler chez l'appelant.
  try{ renderBlocPriorite(c); }catch(e){}
  const z=document.getElementById('ccd-douleur');
  if(!z) return;
  let html='';
  try{ html=c?blocDouleurCoach(c):''; }catch(e){ html=''; }
  z.innerHTML=html;
}

// ── Carte athlète ───────────────────────────────────────────────────────────
// Symétrie obligatoire : alerter le coach sans rien dire à l'athlète serait
// incohérent. On lui dit ce qu'il a lui-même saisi, on lui dit de ne pas
// forcer, et on lui donne le lien pour joindre son coach. Aucun conseil
// médical, aucune modification de son programme.
// UNE DOULEUR DÉCLARÉE NE DÉBOUCHE PLUS SUR UN RENVOI HORS DE L'APP.
// Le lien pré-remplissait un message WhatsApp décrivant la douleur et
// l'exercice concerné : une donnée de santé partant vers Meta, à l'initiative
// du produit, sans que personne l'ait demandé.
//
// Ce qui reste est ce qui aide : le constat, la consigne de ne pas forcer, le
// bouton pour STRUCTURER la gêne dans l'app, et le disclaimer. Le chemin de
// sécurité existant prime toujours et n'est pas touché.
function blocDouleurAthlete(user){
  let sg; try{ sg=signauxEntrainement(user); }catch(e){ return ''; }
  if(!sg.douleur||!sg.details.douleur) return '';
  const x=sg.details.douleur;
  return `<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:14px;margin-bottom:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--warning);text-transform:uppercase;margin-bottom:8px">Douleur signalée</div>
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">
      Tu as signalé une douleur sur <b>${escapeHtml(x.nom)}</b> lors de tes ${x.seances} dernières séances.
      Ne force pas dessus. Préviens ton coach.
    </div>
    <button class="btn btn-outline btn-sm" onclick="ouvrirFormContrainte('','moi')" style="margin-top:10px;letter-spacing:1px;font-size:var(--fs-2xs)">Préciser où ça fait mal</button>
    ${blocDisclaimerDouleur()}
  </div>`;
}
function renderDouleurAthlete(){
  const z=document.getElementById('clh-douleur');
  if(!z) return;
  let html='';
  try{ html=currentUser?blocDouleurAthlete(currentUser):''; }catch(e){ html=''; }
  z.innerHTML=html;
}

// Trois actions, et pas une de plus : un coach qui vient d'ouvrir son compte
// ne sait pas par où commencer, et une liste de dix liens ne l'aide pas.
//
// L'IMPORT PASSE PAR UN ATHLÈTE, et c'est dit. L'analyse d'une fiche PDF ou
// photo vit dans s-coach-program, l'éditeur du programme D'UN athlète
// (prog-photo2, analyzeProgPhotos) : sans athlète, l'écran n'est pas
// atteignable. Plutôt que d'inventer une quatrième porte, la carte annonce
// l'ordre réel des opérations.
const PREMIERS_PAS=Object.freeze([
  Object.freeze({icone:'user', titre:'Inviter mon premier athlète',
    detail:'Un code à lui transmettre, et il te rejoint.',
    action:'openAddAthlete()'}),
  Object.freeze({icone:'folder', titre:'Créer un programme',
    detail:'Un modèle Homme/Femme, réutilisable pour tous.',
    action:'openCoachPrograms()'}),
  // COLLER, PAS IMPORTER (05/10/2026). L'import par PDF ou photo est fermé
  // (LEGACY_PDF_IMPORT) : le promettre ici menait à une impasse. Le coach a son
  // programme dans un tableur — il le colle, une ligne par exercice.
  // `icone` est un nom de l'icônier (ICO), pas un emoji : le rendu affiche le
  // numéro de l'étape, et scripts/emojis.py tient le compte des emojis.
  Object.freeze({icone:'clipboard', titre:'Coller un programme existant',
    detail:'Depuis Excel ou Google Sheets : une ligne par exercice.',
    action:'ouvrirImportCollage()'}),
]);
// `clients` est injectable : la suite l'éprouve sans toucher au stockage.
function _renderPremiersPas(clients){
  const z=document.getElementById('ch-premiers-pas');
  if(!z) return false;
  const n=(clients||[]).length;
  // Un seul athlète suffit à faire disparaître le bloc : il a compris.
  if(n>0){ z.innerHTML=''; return false; }
  z.innerHTML='<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-4);padding:20px;margin-bottom:20px">'
    +'<div style="font-size:var(--fs-xs);color:var(--red-text);letter-spacing:3px;font-weight:800;'
    +'text-transform:uppercase;margin-bottom:6px">Premiers pas</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:14px">'
    +escapeHtml(PROMESSE_COACH)+'</div>'
    +PREMIERS_PAS.map(a=>'<div onclick="'+a.action+'" role="button" tabindex="0" '
      +'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();this.click()}" '
      +'style="display:flex;align-items:flex-start;gap:12px;background:var(--surface-2);'
      +'border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;margin-bottom:10px;'
      +'cursor:pointer;min-height:44px">'
      // LE NUMERO DE L'ETAPE, pas un emoji : l'ordre est l'information.
      +'<div style="font-family:var(--pile-titre);font-size:var(--fs-xl);line-height:1.2;flex-shrink:0;width:20px;color:var(--red-text)">'+(PREMIERS_PAS.indexOf(a)+1)+'</div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:800;font-size:var(--fs-md)">'+escapeHtml(a.titre)+'</div>'
      +'<div class="sub" style="font-size:var(--fs-xs);margin-top:4px;line-height:1.5">'+escapeHtml(a.detail)+'</div>'
      +'</div><div style="color:var(--sub);font-size:var(--fs-xl);flex-shrink:0">›</div></div>').join('')
    +'</div>';
  return true;
}
// LA FILE DES BILANS A LIRE. Posée quand le coach entre par la ligne
// « Nouveaux bilans à lire », et par elle seulement : c’est le seul endroit
// qui connaisse la liste complète et son ordre.
//
// Elle porte des IDENTIFIANTS, pas des dossiers : entre deux réponses, les
// dossiers changent — c’est même tout l’objet de l’exercice.
let _fileBilans=[];
// LA FILE DES VIDEOS A CORRIGER. Posée quand le coach clique le compteur de la
// bande C, et par lui seulement.
//
// Chaque entrée porte l’adresse, l’identifiant de la vidéo, ET l’identifiant
// du client : c’est lui qui alimente currentClientId, sans quoi le retour à la
// fiche après la DERNIÈRE vidéo atterrirait sur l’athlète précédemment ouvert
// — ou nulle part.
let _fileVideos=[];
// Entrée par le compteur. Toutes les vidéos non corrigées du portefeuille,
// dans l’ordre des athlètes puis des vidéos.
function _entrerFileVideos(){
  let l=[];
  try{ l=(typeof getClients==='function')?(getClients()||[]):[]; }catch(e){ l=[]; }
  _fileVideos=[];
  for(const c of l){
    if(!c||!c.email) continue;
    for(const v of ((c.videos)||[])){
      try{ if(v&&v.id&&videoNonCorrigee(v)) _fileVideos.push({email:c.email,cid:c.id,id:v.id}); }
      catch(e){}
    }
  }
  if(!_fileVideos.length){ try{ toast('Aucune vidéo en attente'); }catch(e){} return false; }
  return _allerVideoSuivante(_fileVideos[0]);
}
// PURE-ish : elle ne fait que regarder. Les vidéos de la file placées APRÈS
// celle qu’on vient de corriger, et qui sont ENCORE à corriger.
//
// Le filtre par videoNonCorrigee rend le compte honnête, et celui sur coachId
// reprend la garde d’openVideoCorrection : une vidéo dont l’athlète n’est plus
// à moi ne doit pas s’enchaîner.
//
// Une vidéo absente de la file rend un tableau vide : entré par la fiche, le
// coach retrouve le comportement d’avant, une vidéo et puis c’est tout.
function _fileVideosSuivantes(email,videoId){
  const i=_fileVideos.findIndex(x=>x&&x.email===email&&x.id===videoId);
  if(i<0) return [];
  const users=DB.get('users')||{};
  return _fileVideos.slice(i+1).filter(x=>{
    try{
      const c=users[x.email];
      if(!c||c.coachId!==(currentUser&&currentUser.id)) return false;
      const v=(c.videos||[]).find(y=>y&&y.id===x.id);
      return !!(v&&videoNonCorrigee(v));
    }catch(e){ return false; }
  });
}
// Va à la suivante : la fiche de son propriétaire devient la fiche courante,
// pour que le retour après la dernière atterrisse au bon endroit.
function _allerVideoSuivante(x){
  if(!x||!x.email||!x.id) return false;
  if(x.cid) currentClientId=x.cid;
  try{ openVideoCorrection(x.email,x.id); }catch(e){ return false; }
  return true;
}
// Entrée par la ligne du tableau de bord. Fait ce que faisait le clic — ouvrir
// la fiche du premier — et retient les autres au passage.
function _entrerFileBilans(idx){
  const r=(window._todoRows||[])[idx];
  const l=(r&&r.list)||[];
  _fileBilans=l.map(c=>c&&c.id).filter(Boolean);
  if(!_fileBilans.length) return;
  // DIRECTEMENT SUR LA RÉPONSE (06/10/2026) : le volet Réponses porte
  // désormais la douleur, la dernière séance et le poids (le bandeau) ; la
  // fiche n'est plus un passage obligé. Un geste ici, un pour envoyer.
  try{ _retenirPositionAccueil(_fileBilans[0]); }catch(e){}
  currentClientId=_fileBilans[0];
  try{ const c=getOwnedClient(_fileBilans[0]); tplContexte({prenom:c&&c.fname},null); }catch(e){}
  viewClientBilans({reponses:true});
}
// PURE-ish : elle ne fait que regarder. Les athlètes de la file placés APRÈS
// celui qu’on vient de traiter, et qui ont ENCORE un bilan sans réponse.
//
// Le filtre par hasNewBilan rend le compte HONNÊTE : sans lui, « 3 restants »
// pourrait mener sur un athlète auquel on a déjà répondu depuis un autre
// chemin. Et l’athlète courant en sort de lui-même, puisqu’il vient d’être
// répondu — aucun décompte à tenir à la main.
//
// Un athlète absent de la file rend un tableau vide : entré par un autre
// chemin, le coach retrouve exactement le comportement d’avant.
function _fileBilansSuivants(idApres){
  const i=_fileBilans.indexOf(idApres);
  if(i<0) return [];
  return _fileBilans.slice(i+1).filter(id=>{
    try{
      const c=getOwnedClient(id);
      return !!(c&&hasNewBilan(c));
    }catch(e){ return false; }
  });
}
// Va au suivant : exactement le chemin que le coach aurait pris à la main.
// LA RELEVE D'ATHLETE, EN DEUX TEMPS DE 260 ms. _allerBilanSuivant appelle
// viewClientBilans() -> go('s-coach-bilan-evo') ALORS QU'ON Y EST DEJA : go()
// fait display:none puis display:flex dans la meme tache, sans purge de style
// entre les deux, donc l'animation d'ecran ne rejoue pas. Dix bilans a la
// chaine, dix fois le meme ecran qui change de contenu sans que rien ne dise
// « on a tourne la page ».
// Les 110 ms ne retardent rien de perceptible : la reponse est deja enregistree
// quand le bouton est touche, et le rendu du bilan suivant coute deja plus.
function _allerBilanSuivant(id){
  if(!id) return false;
  const _z=document.getElementById('evo-content');
  const _tb=document.querySelector('#s-coach-bilan-evo .topbar');
  if(!arcReduit()&&_z){
    _z.classList.add('cx-sort');
    setTimeout(()=>{ _bilanSuivantCorps(id,_z,_tb); },110);
    return true;
  }
  return _bilanSuivantCorps(id,null,null);
}
function _bilanSuivantCorps(id,_z,_tb){
  currentClientId=id;
  // LE CONTEXTE DE MODELE SUIT L ATHLETE. Il n’est posé que par
  // openClientDetail, et ce chemin-ci ne passe pas par elle : le prénom du
  // PRÉCÉDENT restait en place, un modèle contenant {prénom} le résolvait
  // avec lui, et tplVerifierAvantEnvoi ne bloquait rien — la variable avait
  // bien été remplie, simplement avec la mauvaise valeur.
  //
  // SANS CIBLE, comme openClientDetail et pour la même raison : le prénom
  // vaut pour tous les blocs de réponse de la fiche, il y en a un par bilan.
  try{
    const c=getOwnedClient(id);
    tplContexte({prenom:c&&c.fname},null);
  }catch(e){}
  try{ viewClientBilans({reponses:true}); }catch(e){ return false; }
  if(_z){
    _z.classList.remove('cx-sort');
    _z.classList.add('cx-entre');
    _z.addEventListener('animationend',e=>{ if(e.target===_z) _z.classList.remove('cx-entre'); },{once:true});
  }
  if(_tb){
    _tb.classList.remove('cx-trait');
    void _tb.offsetWidth;
    _tb.classList.add('cx-trait');
    _tb.addEventListener('animationend',e=>{ if(e.target===_tb) _tb.classList.remove('cx-trait'); },{once:true});
  }
  try{ evoTab('reponses'); }catch(e){}
  try{ setTimeout(()=>{ try{ _renderQuickCommentChips('bilan'); }catch(e){} },0); }catch(e){}
  return true;
}
// Pose le bouton en tête du volet « Réponses », là où le coach vient de taper.
// Rend false s’il n’y a pas de volet — le coach a navigué ailleurs entre-temps,
// et l’appelant retombe alors sur le retour à la fiche.
function _proposerBilanSuivant(restants){
  const suivant=restants&&restants[0];
  if(!suivant) return false;
  // Le bilan qu’on vient d’enregistrer doit s’afficher COMME ENREGISTRÉ : on
  // redessine avant de proposer la suite, sinon le coach quitte un écran qui
  // montre encore l’état d’avant.
  try{
    const c=getOwnedClient(currentClientId);
    if(c) renderBilanEvolution(c);
    evoTab('reponses');
    // Le redessin a vidé les conteneurs de chips : sans ça, les autres bilans
    // de cet athlète perdraient leurs commentaires rapides.
    _renderQuickCommentChips('bilan');
  }catch(e){}
  const pane=document.querySelector('#evo-content [data-evo-pane="reponses"]');
  if(!pane) return false;
  const n=restants.length;
  const z=document.createElement('div');
  z.id='file-bilans-suivant';
  z.style.cssText='margin-bottom:12px';
  const b=document.createElement('button');
  b.className='btn btn-red';
  b.style.cssText='width:100%;letter-spacing:1px';
  b.textContent='Athlète suivant → ('+n+' restant'+(n>1?'s':'')+')';
  // L’écouteur est posé en JS et non dans un attribut : l’identifiant ne
  // traverse alors aucune chaîne de balisage, et il n’y a rien à échapper.
  b.onclick=()=>{ _allerBilanSuivant(suivant); };
  z.appendChild(b);
  pane.insertBefore(z,pane.firstChild);
  try{ z.scrollIntoView({block:'nearest'}); }catch(e){}
  return true;
}
// ══ LOT C3 : LES RÈGLES DE RELANCE (29/09/2026) ═══════════════════════════
//
// Le coach règle, une fois, ce qui peut partir sans lui : une ligne par
// signal de « À traiter », COUPÉE par défaut. Le serveur léger (cloudflare/
// src/relances.js, travail « relances » de planif.js, 10 h 30) lit ces
// règles chaque jour et envoie AU PLUS UN message par athlète sur sept jours.
//
// ⚠ CINQ SIGNAUX SEULEMENT, ceux qui ont un texte dans _waCorpsGroupe. Les
//   onze autres ont leur ligne, grisée, avec la raison : la douleur, le
//   décrochage et la progression bloquée appellent un échange, pas un message
//   type ; les autres sont du travail de coach, sans rien à dire à l'athlète.
//   RELANCE_SIGNAUX est la MÊME liste que celle du serveur, dans le même
//   ordre (l'ordre dit lequel part quand deux signaux tombent le même jour).
// ⚠ JAMAIS WHATSAPP. Deux moyens : la notification, ou le message privé dans
//   l'app (« canal » dans les données). Pas le canal collectif : tous les
//   athlètes du coach le lisent, et « ton bilan est en retard » y serait lu
//   par tout le monde.
// ⚠ LA TRACE : le serveur écrit chaque envoi dans relances_auto/<coach>/
//   <athlète>. Le coach la lit (écran « cette semaine », fiche de l'athlète),
//   l'athlète lit sa branche (la carte « Un mot de ton coach »).

// 'inactif' EN DERNIER (30/09/2026) : l'ordre des cinq premiers ne change pas.
const RELANCE_SIGNAUX=Object.freeze(['nostart','overdue','expiring','noprog','bilan','inactif']);
const RELANCE_MOYENS=Object.freeze({push:'Notification',canal:'Dans l’app'});
const RELANCE_DELAIS=Object.freeze([0,1,2,3,5,7]);
const RELANCE_DELAI_DEFAUT=2;
// L'INACTIVITÉ : son délai EST le signal (N jours sans séance ni bilan), borné
// de 7 à 21 jours, 10 par défaut. Mêmes bornes que le serveur (RELANCE_INACTIF).
const RELANCE_INACTIF=Object.freeze({min:7,max:21,defaut:10});
const RELANCE_DELAIS_INACTIF=Object.freeze([7,10,14,21]);
// Son texte par défaut (pas de relance WhatsApp groupée pour ce signal).
// Le serveur a le même, mot pour mot : relances.test.mjs les compare.
const RELANCE_CORPS_INACTIF='ça fait {jours} jours qu\'on ne t\'a pas vu à l\'entraînement : tout va bien ? Dis-moi si on doit adapter quelque chose.';
function relanceCorpsDefaut(signal){ return signal==='inactif'?RELANCE_CORPS_INACTIF:_waCorpsGroupe(signal); }
function _relDelaiBorne(signal,v){
  const d=Math.round(Number(v));
  if(signal==='inactif') return Number.isFinite(d)?Math.max(RELANCE_INACTIF.min,Math.min(RELANCE_INACTIF.max,d)):RELANCE_INACTIF.defaut;
  return Number.isFinite(d)?Math.max(0,Math.min(14,d)):RELANCE_DELAI_DEFAUT;
}
// ── relanceTexte:debut
// LA MÊME FONCTION DANS L'APP (aperçu) ET DANS LE WORKER (envoi) : le test
// relances.test.mjs exécute celle de l'app et compare, cas par cas.
// PURE. « Salut <prénom>, » puis le texte du coach s'il est valable (1 à
// RELANCE_TEXTE_MAX caractères une fois nettoyé), sinon le texte par défaut.
// {prénom} et {jours} sont remplacés ; les caractères de contrôle et les
// chevrons disparaissent ; le résultat est tronqué s'il déborde encore.
const RELANCE_TEXTE_MAX = 280;
function relanceComposer(defaut, prenom, perso, vars) {
  const net = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const p = net(prenom).slice(0, 30);
  const brut = typeof perso === 'string' ? net(perso) : '';
  let corps = (brut && brut.length <= RELANCE_TEXTE_MAX) ? brut : net(defaut);
  const v = (vars && typeof vars === 'object') ? vars : {};
  const j = Math.round(Number(v.jours));
  corps = net(corps.replace(/\{pr[ée]nom\}/gi, p).replace(/\{jours\}/gi, Number.isFinite(j) && j > 0 ? String(j) : 'quelques'));
  if (corps.length > RELANCE_TEXTE_MAX) corps = corps.slice(0, RELANCE_TEXTE_MAX - 1).trimEnd() + '…';
  return (p ? 'Salut ' + p + ', ' : 'Salut ! ') + corps;
}
// ── relanceTexte:fin
const RELANCE_FENETRE_J=7;
const RELANCE_ECHANGE='Ça appelle un échange, pas un message type.';
const RELANCE_TRAVAIL='C’est ton travail, il n’y a rien à dire à l’athlète.';
// Les dix-neuf lignes, dans l'ordre de « À traiter ». auto:true pour les six.
const RELANCE_LIGNES=Object.freeze([
  {type:'drapeau',lib:'Drapeau rouge santé',raison:'Un drapeau rouge se traite de vive voix, jamais par un message type.'},
  {type:'douleur',lib:'Douleur répétée',raison:RELANCE_ECHANGE},
  {type:'douleurdiff',lib:'Douleurs diffuses',raison:RELANCE_ECHANGE},
  {type:'decrochage',lib:'Séances écourtées',raison:RELANCE_ECHANGE},
  {type:'saut_charge',lib:'Charge en hausse marquée',raison:'Une charge qui s’emballe se regarde avec l’athlète, pas par un rappel.'},
  {type:'entrainement',lib:'Progression bloquée',raison:RELANCE_ECHANGE},
  {type:'calibrage',lib:'Calibrage de la perception',raison:RELANCE_TRAVAIL},
  {type:'blocfini',lib:'Bloc de priorité terminé',raison:RELANCE_TRAVAIL},
  {type:'nostart',lib:'Inscrit, n’a jamais commencé',auto:true,quand:'trois jours après l’inscription sans bilan'},
  {type:'bilan',lib:'Nouveau bilan à lire',auto:true,quand:'le jour où le bilan arrive, tant que tu n’as pas répondu'},
  {type:'overdue',lib:'Bilan en retard',auto:true,quand:'le lendemain de l’échéance fixée'},
  {type:'videos',lib:'Vidéo à corriger',raison:RELANCE_TRAVAIL},
  {type:'notes',lib:'Note à revoir',raison:RELANCE_TRAVAIL},
  {type:'expiring',lib:'Accès qui se termine',auto:true,quand:'quatorze jours avant la fin de l’accès'},
  {type:'rite',lib:'Bilan de 4 semaines à lire',raison:RELANCE_TRAVAIL},
  {type:'progfin',lib:'Bloc qui se termine',raison:RELANCE_TRAVAIL},
  {type:'silence',lib:'Sans échange depuis 14 j',raison:'Un silence se rompt par un vrai mot du coach, pas par un rappel automatique.'},
  {type:'noprog',lib:'Sans programme',auto:true,quand:'dès le bilan de départ, tant qu’aucun programme n’est posé'},
  // N est le délai choisi par le coach (renderRelancesCoach le remplace).
  {type:'inactif',lib:'Plus de séance',auto:true,quand:'N jours sans séance'}
]);
const RELANCE_LIB=Object.freeze(Object.fromEntries(RELANCE_LIGNES.map(l=>[l.type,l.lib])));

// PURE. Les règles du coach, nettoyées comme le serveur les lit : les cinq
// clés, actif strictement true, délai borné, moyen connu.
function relancesRegles(coach){
  const src=(coach&&coach.relancesAuto&&coach.relancesAuto.regles)||{};
  const out={};
  for(const s of RELANCE_SIGNAUX){
    const r=(src[s]&&typeof src[s]==='object')?src[s]:{};
    out[s]={actif:r.actif===true,
      delai:_relDelaiBorne(s,r.delai),
      moyen:RELANCE_MOYENS[r.moyen]?r.moyen:'push'};
  }
  return out;
}
function relancesEnPause(coach){ return !!(coach&&coach.relancesAuto&&coach.relancesAuto.pause===true); }
function relancesAllumees(coach){
  if(relancesEnPause(coach)) return false;
  const r=relancesRegles(coach);
  return RELANCE_SIGNAUX.some(s=>r[s].actif);
}
// La clé d'un compte, comme l'annuaire et coachEmailKey l'écrivent.
function _relCle(c){ return String((c&&c.email)||'').trim().replace(/\./g,','); }
function relanceExclu(coach,c){
  const x=coach&&coach.relancesAuto&&coach.relancesAuto.exclus;
  return !!(x&&typeof x==='object'&&x[_relCle(c)]);
}
// Écrit le bloc entier, nettoyé : rien d'autre que ce que le serveur lit.
function _relEcrire(coach,maj){
  const cfg=(coach.relancesAuto&&typeof coach.relancesAuto==='object')?coach.relancesAuto:{};
  const regles=relancesRegles(coach);
  const exclus=Object.assign({},(cfg.exclus&&typeof cfg.exclus==='object')?cfg.exclus:{});
  const n={regles,exclus,pause:cfg.pause===true,textes:relancesTextes(coach)};
  maj(n);
  n.maj=Date.now();
  coach.relancesAuto=n;
  try{ saveUser(); }catch(e){ rcErreurMuette('_relEcrire',e); }
  return true;
}
// Régler une ligne. REFUSÉ pour tout signal hors des cinq : la douleur ne
// s'allume pas, même appelée à la main depuis la console.
function relancesRegler(signal,champ,valeur){
  if(!currentUser||RELANCE_SIGNAUX.indexOf(signal)<0) return false;
  if(['actif','delai','moyen'].indexOf(champ)<0) return false;
  _relEcrire(currentUser,n=>{
    const r=n.regles[signal];
    if(champ==='actif') r.actif=valeur===true;
    if(champ==='delai'){ const d=Math.round(Number(valeur)); if(Number.isFinite(d)) r.delai=_relDelaiBorne(signal,d); }
    if(champ==='moyen'&&RELANCE_MOYENS[valeur]) r.moyen=valeur;
  });
  try{ renderRelancesCoach(); }catch(e){}
  try{ renderEntreeRelances(); }catch(e){}
  return true;
}
// PURE. Les textes du coach, nettoyés comme le serveur les lit : un par signal
// connu, non vide, RELANCE_TEXTE_MAX caractères au plus.
function relancesTextes(coach){
  const src=(coach&&coach.relancesAuto&&coach.relancesAuto.textes)||{};
  const out={};
  for(const s of RELANCE_SIGNAUX){ const v=src[s]; if(typeof v==='string'&&v.trim()&&v.trim().length<=RELANCE_TEXTE_MAX) out[s]=v.trim(); }
  return out;
}
// Le texte d'une ligne : vide, on revient au texte par défaut.
function relancesTexte(signal,valeur){
  if(!currentUser||RELANCE_SIGNAUX.indexOf(signal)<0) return false;
  const v=String(valeur==null?'':valeur).trim();
  if(v.length>RELANCE_TEXTE_MAX){ toast('Ton texte dépasse '+RELANCE_TEXTE_MAX+' caractères.','var(--orange)'); return false; }
  _relEcrire(currentUser,n=>{ if(v) n.textes[signal]=v; else delete n.textes[signal]; });
  try{ renderRelancesCoach(); }catch(e){}
  return true;
}
// L'aperçu, à la frappe : la fonction même qui composera l'envoi.
function _relApercuTexte(signal,perso,delai){
  return relanceComposer(relanceCorpsDefaut(signal),'Léa',perso,{jours:signal==='inactif'?delai:0});
}
function relApercu(signal){
  const t=document.getElementById('rel-txt-'+signal), z=document.getElementById('rel-ap-'+signal);
  if(!t||!z) return false;
  z.textContent=_relApercuTexte(signal,t.value,relancesRegles(currentUser)[signal].delai);
  return true;
}
// « Je reprends la main » : tout s'arrête, y compris ce qui était déjà en
// file côté serveur (chaque envoi relit ce drapeau juste avant de partir).
function relancesReprendreLaMain(on){
  if(!currentUser) return false;
  _relEcrire(currentUser,n=>{ n.pause=on===true; });
  toast(on?'Relances automatiques coupées '+ICO.coche:'Relances automatiques reprises '+ICO.coche,on?'var(--orange)':'var(--green)');
  try{ renderRelancesCoach(); }catch(e){}
  try{ renderEntreeRelances(); }catch(e){}
  return true;
}
function relanceExclure(email,oui){
  if(!currentUser) return false;
  const k=_relCle({email});
  if(!k) return false;
  _relEcrire(currentUser,n=>{ if(oui) n.exclus[k]=Date.now(); else delete n.exclus[k]; });
  const c=(()=>{ try{ return getClients().find(x=>x&&_relCle(x)===k); }catch(e){ return null; } })();
  try{ if(c) renderRelanceFiche(c); }catch(e){}
  return true;
}

// ── LE JOURNAL (écrit par le serveur, lu ici) ─────────────────────────────
let _relJournal=null, _relJournalLu=0;
// PURE. Le journal d'un coach, à plat : [{cle, at, signal, moyen, texte, statut, raison}], récent d'abord.
function relJournalAplati(brut){
  const out=[];
  const o=(brut&&typeof brut==='object')?brut:{};
  for(const cle of Object.keys(o)){
    const b=o[cle]||{};
    for(const id of Object.keys(b)){
      const e=b[id];
      if(e&&Number(e.at)>0) out.push(Object.assign({cle,id},e));
    }
  }
  return out.sort((a,b)=>Number(b.at)-Number(a.at));
}
// PURE. Ce qui est parti sur les sept derniers jours.
function relCetteSemaine(liste,t){
  const n=Number(t)||Date.now();
  return (liste||[]).filter(e=>n-Number(e.at)<RELANCE_FENETRE_J*864e5);
}
async function _relChargerJournal(force){
  if(!force&&_relJournal&&Date.now()-_relJournalLu<5*60e3) return _relJournal;
  const moi=_relCle(currentUser);
  if(!moi) return [];
  const r=await _fbJson('relances_auto/'+moi);
  if(r.ok){ _relJournal=relJournalAplati(r.v); _relJournalLu=Date.now(); }
  return _relJournal||[];
}
function _relJour(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return ''; } }
const RELANCE_RAISONS=Object.freeze({aucun_abonnement:'notifications jamais activées',coupe:'notifications coupées par l’athlète',
  plafond:'une autre notification est partie ce jour-là',calme:'heures calmes',echec:'appareil injoignable'});
function _relLigneJournal(e,nom){
  const ok=e.statut==='parti';
  return '<div class="rel-j'+(ok?'':' rel-j-ko')+'"><span class="rel-j-d">'+escapeHtml(_relJour(e.at))+'</span>'
    +'<span class="rel-j-n">'+escapeHtml(nom||'Athlète')+'</span>'
    +'<span class="rel-j-s">'+escapeHtml(RELANCE_LIB[e.signal]||(e.signal==='risque'?'Risque d’abandon':e.signal)||'')+' · '
    +escapeHtml(e.moyen==='ia_valide'?'proposé par l’assistant, '+(RELANCE_MOYENS[e.voie]||'').toLowerCase():(RELANCE_MOYENS[e.moyen]||''))
    +(ok?'':' · pas parti ('+escapeHtml(RELANCE_RAISONS[e.raison]||e.raison||'')+')')+'</span></div>';
}
function _relNom(cle){
  try{ const c=getClients().find(x=>x&&_relCle(x)===cle); return c?((c.fname||'')+' '+(c.lname||'')).trim()||c.email:''; }catch(e){ return ''; }
}

// ── L'ENTRÉE, SOUS « MES NOTIFICATIONS » ──────────────────────────────────
