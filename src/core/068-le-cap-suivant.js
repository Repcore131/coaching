// ══ OBJECTIF ATTEINT, CAP SUIVANT, RÉACTIVITÉ DU COACH (build 1962) ═══════
// objectifAtteint dit, PREUVES CHIFFRÉES À L'APPUI, si un objectif est loin,
// proche ou atteint : poids ou tour de taille (tendance sur 7 jours), record
// visé (meilleur e1RM fiable), semaines tenues. Sans preuve, c'est « loin » :
// on n'annonce jamais un objectif atteint sur une impression.
// Quand c'est atteint ou presque, la fiche du coach propose le cap suivant
// (CAPS_SUIVANTS) et un message pré-rédigé avec les preuves ; le coach le
// modifie et l'envoie. RIEN N'EST ENVOYÉ AUTOMATIQUEMENT.
// L'indicateur de réactivité (délai médian de réponse aux bilans et aux
// messages sur 30 jours, objectif sous 24 à 48 h) n'est visible que du coach.
// Le bilan hebdomadaire gagne deux questions facultatives (la fierté de la
// semaine, l'objectif de la semaine prochaine), reprises dans le brouillon
// de réponse du coach.
// Stockage : u.objectifCap = {taille?, recordExo?, recordKg?, semaines?, fixeLe}
// (posé par le coach ; le poids cible reste u.objectifPoids).

const CAP_PROCHE=Object.freeze({kg:1,cm:1,recordPct:0.975,semaines:1});
const CAP_PESEES_MIN_7J=3;
// Les caps : titres de la demande ; durée, pourquoi et première étape sont un
// contenu de travail, à reprendre par Kevin.
const _cap=(titre,duree,pourquoi,premiereEtape)=>Object.freeze({titre,duree,pourquoi,premiereEtape});
const CAPS_SUIVANTS=Object.freeze({
  seche:Object.freeze([
    _cap('Recomposition','8 à 12 semaines','Garder la ligne gagnée en continuant de construire du muscle, sans déficit.','Remonter les calories au maintien sur deux semaines, en gardant les protéines hautes.'),
    _cap('Prise propre','12 à 16 semaines','Profiter d’un corps sec pour prendre du muscle avec un surplus léger.','Ajouter 150 à 250 kcal par jour, surtout autour de la séance.')]),
  prise:Object.freeze([
    _cap('Mini-sèche','4 à 6 semaines','Retirer le gras pris avec le muscle, avant de repartir.','Un déficit modéré, 0,5 à 1 % du poids par semaine.'),
    _cap('Cycle de force','8 à 12 semaines','Transformer le muscle gagné en force sur les mouvements de base.','Tester les maximums, puis un gabarit 5/3/1 ou un bloc.')]),
  force:Object.freeze([
    _cap('Compétition','8 à 12 semaines','Mettre cette force à l’épreuve, sur une date fixe.','Choisir la compétition et poser l’échéance.'),
    _cap('Bloc hypertrophie','6 à 8 semaines','Construire le muscle qui portera la prochaine vague de force.','Passer en 8 à 12 répétitions, volume en hausse progressive.')]),
  forme:Object.freeze([
    _cap('Défi 28 jours','4 semaines','Ancrer l’habitude avec un cadre court et motivant.','Rejoindre le prochain défi 28 jours du coach.'),
    _cap('Premier test de tractions','1 séance, puis 4 semaines','Mesurer un point de départ concret, et suivre ses progrès.','Faire le test guidé de l’arbre des tractions.')])
});
const _cfmt=v=>String(Math.round(Number(v)*10)/10).replace('.',',');
const _cjour=t=>localISODate(new Date(Number(t)));
/** PURE. La moyenne des valeurs des 7 derniers jours (≥ n mesures), ou null. */
function _moy7(series,fin,n){
  const tf=Date.parse(fin+'T12:00:00Z');
  const l=(series||[]).filter(x=>x&&Number(x.v)>0&&Date.parse(x.date+'T12:00:00Z')<=tf&&tf-Date.parse(x.date+'T12:00:00Z')<7*864e5);
  return l.length>=(n||1)?l.reduce((a,x)=>a+Number(x.v),0)/l.length:null;
}
/**
 * PURE. L'objectif est-il loin, proche ou atteint ?
 * @param {{type:'poids'|'taille'|'record'|'semaines', cible:number, exo?:string, sens?:'baisse'|'hausse'}} objectif
 * @param {{fin:string, poids?:{date,v}[], taille?:{date,v}[], record?:{exo,e1}, semaines?:number, debut?:{date,poids?,taille?}}} donnees
 * @returns {{etat:'loin'|'proche'|'atteint', preuves:string[]}}
 */
function objectifAtteint(objectif,donnees){
  const o=objectif||{}, d=donnees||{}, preuves=[];
  const cible=Number(o.cible);
  const loin=()=>({etat:'loin',preuves});
  if(!(cible>0)) return loin();
  const fin=d.fin||localISODate(new Date());
  if(o.type==='poids'||o.type==='taille'){
    const serie=o.type==='poids'?d.poids:d.taille;
    const unite=o.type==='poids'?'kg':'cm', lib=o.type==='poids'?'poids moyen sur 7 jours':'tour de taille';
    // Le poids : une moyenne de 3 pesées au moins ; la taille : la dernière mesure de 14 jours.
    let v=null;
    if(o.type==='poids') v=_moy7(serie,fin,CAP_PESEES_MIN_7J);
    else { const l=(serie||[]).filter(x=>x&&Number(x.v)>0&&x.date<=fin&&(Date.parse(fin)-Date.parse(x.date))<14*864e5).sort((a,b)=>a.date<b.date?-1:1); v=l.length?Number(l[l.length-1].v):null; }
    if(v==null) return loin();
    const sens=o.sens||(d.debut&&Number(d.debut[o.type])>cible?'baisse':'hausse');
    const dep=d.debut&&Number(d.debut[o.type]);
    if(dep>0){
      const sem=d.debut.date?Math.max(1,Math.round((Date.parse(fin)-Date.parse(d.debut.date))/(7*864e5))):null;
      const delta=v-dep;
      preuves.push((o.type==='poids'?'':'Tour de taille ')+(delta<0?'−':'+')+_cfmt(Math.abs(delta))+' '+unite+(sem?' en '+sem+' semaine'+(sem>1?'s':''):'')+' ('+_cfmt(dep)+' → '+_cfmt(v)+' '+unite+')');
    } else preuves.push(lib.charAt(0).toUpperCase()+lib.slice(1)+' : '+_cfmt(v)+' '+unite+' (cible '+_cfmt(cible)+')');
    const reste=sens==='baisse'?v-cible:cible-v;
    if(reste<=0) return {etat:'atteint',preuves};
    return {etat:reste<=(o.type==='poids'?CAP_PROCHE.kg:CAP_PROCHE.cm)?'proche':'loin',preuves};
  }
  if(o.type==='record'){
    const r=d.record;
    if(!r||!(Number(r.e1)>0)) return loin();
    preuves.push(String(o.exo||r.exo||'').toLowerCase()+' : '+_cfmt(r.e1)+' kg estimés sur une série fiable (cible '+_cfmt(cible)+' kg)');
    if(r.e1>=cible) return {etat:'atteint',preuves};
    return {etat:r.e1>=cible*CAP_PROCHE.recordPct?'proche':'loin',preuves};
  }
  if(o.type==='semaines'){
    const n=Math.floor(Number(d.semaines)||0);
    if(!(n>0)) return loin();
    preuves.push(n+' semaine'+(n>1?'s':'')+' tenue'+(n>1?'s':'')+' (cible '+Math.round(cible)+')');
    if(n>=cible) return {etat:'atteint',preuves};
    return {etat:n>=cible-CAP_PROCHE.semaines?'proche':'loin',preuves};
  }
  return loin();
}
/** PURE. Les semaines tenues : semaines consécutives (jusqu'à la dernière complète) avec au moins `quota` séances. */
function semainesTenues(sessions,quota,maintenant){
  const q=Math.max(1,Number(quota)||1), t=Number(maintenant)||Date.now();
  const lundi=_lundiDe(new Date(t)).getTime();
  let n=0;
  for(let w=1;w<=104;w++){
    const a=lundi-w*604800000, b=a+604800000;
    const k=(sessions||[]).filter(s=>s&&Number(s.date)>=a&&Number(s.date)<b).length;
    if(k>=q) n++; else break;
  }
  return n;
}
/** La famille de l'objectif pour les caps : sèche, prise, force, forme. */
function familleCap(u){
  let ph=null; try{ ph=phaseCourante(u); }catch(e){ ph=null; }
  const t=ph&&ph.type;
  if(t==='seche') return 'seche';
  if(t==='masse') return 'prise';
  let ech=null; try{ ech=echeance(u); }catch(e){ ech=null; }
  if(ech||Object.keys((u&&u.gabaritsForce&&u.gabaritsForce.plans)||{}).length||(u&&u.objectifCap&&u.objectifCap.recordKg)) return 'force';
  return 'forme';
}
/** Les objectifs du dossier, et ce qu'en disent les données. */
function objectifsDuDossier(u,maintenant){
  const t=Number(maintenant)||Date.now(), fin=_cjour(t), out=[];
  const oc=(u&&u.objectifCap)||{};
  let pesees=[]; try{ pesees=serieWeight(u).filter(x=>!x.agrege).map(x=>({date:x.date,v:x.kg})); }catch(e){}
  const bilans=((u&&u.bilans)||[]).filter(b=>b&&b.date).sort((a,b)=>a.date-b.date);
  const tailles=bilans.map(b=>({date:_cjour(b.date),v:parseFloat(b['bil-waist']||b['deb-waist']||b.waist)})).filter(x=>x.v>0);
  const debut={date:bilans.length?_cjour(bilans[0].date):null,poids:pesees.length?pesees[0].v:null,taille:tailles.length?tailles[0].v:null};
  let op=null; try{ op=objectifPoidsDe(u); }catch(e){ op=null; }
  if(op) out.push({o:{type:'poids',cible:op.kg},r:objectifAtteint({type:'poids',cible:op.kg},{fin,poids:pesees,debut})});
  if(Number(oc.taille)>0) out.push({o:{type:'taille',cible:Number(oc.taille)},r:objectifAtteint({type:'taille',cible:Number(oc.taille)},{fin,taille:tailles,debut})});
  if(oc.recordExo&&Number(oc.recordKg)>0){
    let e1=null; try{ e1=maxE1rmObserve(u,oc.recordExo,t); }catch(e){ e1=null; }
    out.push({o:{type:'record',cible:Number(oc.recordKg),exo:oc.recordExo},r:objectifAtteint({type:'record',cible:Number(oc.recordKg),exo:oc.recordExo},{fin,record:e1?{exo:oc.recordExo,e1}:null})});
  }
  if(Number(oc.semaines)>0){
    let q=1; try{ q=_creneauxPrevus(u)||1; }catch(e){ q=1; }
    out.push({o:{type:'semaines',cible:Number(oc.semaines)},r:objectifAtteint({type:'semaines',cible:Number(oc.semaines)},{fin,semaines:semainesTenues(u&&u.sessions,q,t)})});
  }
  return out;
}
/** PURE. Le message pré-rédigé : les preuves, puis le cap. Le coach le modifie avant d'envoyer. */
function messageCap(prenom,preuves,cap,atteint){
  const p=(preuves||[]).filter(Boolean);
  const ouv=(prenom?prenom+', ':'')+(atteint?'objectif atteint':'tu y es presque')+(p.length?' : '+p.join(', ')+'.':'.');
  const c=cap?'\n\nLa suite que je te propose : '+cap.titre+' ('+cap.duree+'). '+cap.pourquoi+'\nPremière étape : '+cap.premiereEtape:'';
  return (ouv.charAt(0).toUpperCase()+ouv.slice(1)+c+'\n\nOn en parle ?').slice(0,MSG_TEXTE_MAX);
}

// ── La carte du coach ────────────────────────────────────────────────────────
const CAP_ETAT_LIB=Object.freeze({loin:'En cours',proche:'Presque',atteint:'Atteint'});
const CAP_TYPE_LIB=Object.freeze({poids:'Poids',taille:'Tour de taille',record:'Record',semaines:'Semaines tenues'});
function renderCapCoach(c){
  const z=document.getElementById('ccd-cap'); if(!z) return false;
  if(!c){ z.innerHTML=''; return false; }
  const E=escapeHtml, l=objectifsDuDossier(c), oc=c.objectifCap||{};
  const mur=l.find(x=>x.r.etat==='atteint')||l.find(x=>x.r.etat==='proche');
  let h='<div class="cap-carte"><div class="cap-t">Objectifs et cap suivant</div>';
  h+=l.length?l.map(x=>'<div class="cap-l cap-'+x.r.etat+'"><b>'+E(CAP_TYPE_LIB[x.o.type])+' · '+E(CAP_ETAT_LIB[x.r.etat])+'</b><span>'+E(x.r.preuves.join(' · ')||'Pas encore de mesure qui le prouve.')+'</span></div>').join('')
    :'<p class="sub">Aucun objectif mesurable : pose-en un ci-dessous (le poids cible se règle dans Nutrition).</p>';
  if(mur){
    const caps=CAPS_SUIVANTS[familleCap(c)]||[];
    const preuves=l.filter(x=>x.r.etat!=='loin').flatMap(x=>x.r.preuves);
    const msg=messageCap(c.fname||'',preuves,caps[0],mur.r.etat==='atteint');
    h+='<div class="cap-lab">Cap suivant</div><div class="cap-choix" role="radiogroup">'+caps.map((k,i)=>'<button type="button" role="radio" aria-checked="'+(i===0)+'" class="cap-c'+(i===0?' actif':'')+'" onclick="capChoisir('+i+')"><b>'+E(k.titre)+'</b><span>'+E(k.duree)+'</span></button>').join('')+'</div>'
      +'<label for="cap-msg">Message (tu peux le modifier)</label><textarea id="cap-msg" rows="6" maxlength="'+MSG_TEXTE_MAX+'">'+E(msg)+'</textarea>'
      +'<button type="button" class="btn btn-red btn-sm" style="width:100%;margin-top:8px" onclick="capEnvoyer(this)">Envoyer à '+E(c.fname||'ton athlète')+'</button>';
  }
  h+='<details class="cap-reg"><summary>Objectifs mesurables</summary>'
    +'<div class="cap-f"><label>Tour de taille cible (cm)<input id="cap-taille" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="'+(oc.taille?_cfmt(oc.taille):'')+'"></label>'
    +'<label>Record visé : exercice<input id="cap-rex" type="text" maxlength="60" value="'+E(oc.recordExo||'')+'"></label>'
    +'<label>Record visé (kg)<input id="cap-rkg" type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" value="'+(oc.recordKg?_cfmt(oc.recordKg):'')+'"></label>'
    +'<label>Semaines à tenir<input id="cap-sem" type="number" inputmode="numeric" min="1" max="104" value="'+(oc.semaines||'')+'"></label>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="capEnregistrerObjectifs()">Enregistrer</button></div></details></div>';
  z.innerHTML=h;
  return true;
}
function capChoisir(i){
  const users=DB.get('users')||{}, c=getOwnedClient(currentClientId,users); if(!c) return false;
  const caps=CAPS_SUIVANTS[familleCap(c)]||[]; if(!caps[i]) return false;
  document.querySelectorAll('.cap-c').forEach((b,k)=>{ b.classList.toggle('actif',k===i); b.setAttribute('aria-checked',String(k===i)); });
  const l=objectifsDuDossier(c), preuves=l.filter(x=>x.r.etat!=='loin').flatMap(x=>x.r.preuves);
  const t=document.getElementById('cap-msg');
  if(t) t.value=messageCap(c.fname||'',preuves,caps[i],l.some(x=>x.r.etat==='atteint'));
  return true;
}
async function capEnvoyer(btn){
  const users=DB.get('users')||{}, c=getOwnedClient(currentClientId,users); if(!c) return false;
  const t=(document.getElementById('cap-msg')||{}).value||'';
  if(btn) btn.disabled=true;
  const r=await msgEnvoyer(_relCle(c),t);
  if(btn) btn.disabled=false;
  if(r&&r.ok) toast('Message envoyé '+ICO.coche,'var(--green)');
  return !!(r&&r.ok);
}
/** PURE. Les objectifs saisis, bornés : {objectifCap} ou {erreur}. */
function objectifCapDepuis(f,t){
  const n=v=>{ const x=parseFloat(String(v==null?'':v).replace(',','.')); return isFinite(x)?x:null; };
  const o={fixeLe:Number(t)||Date.now()};
  const ta=n(f.taille), rk=n(f.recordKg), se=Math.round(n(f.semaines)||0), rx=String(f.recordExo||'').trim().slice(0,60);
  if(ta!=null){ if(!(ta>=40&&ta<=200)) return {erreur:'Tour de taille entre 40 et 200 cm.'}; o.taille=Math.round(ta*10)/10; }
  if(rk!=null||rx){ if(!rx||!(rk>0&&rk<=600)) return {erreur:'Pour un record : l’exercice et la charge (jusqu’à 600 kg).'}; o.recordExo=rx.toUpperCase(); o.recordKg=Math.round(rk*10)/10; }
  if(se){ if(!(se>=1&&se<=104)) return {erreur:'De 1 à 104 semaines.'}; o.semaines=se; }
  return {objectifCap:o};
}
function capEnregistrerObjectifs(){
  const users=DB.get('users')||{}, c=getOwnedClient(currentClientId,users); if(!c) return false;
  const g=id=>(document.getElementById(id)||{}).value;
  const r=objectifCapDepuis({taille:g('cap-taille'),recordExo:g('cap-rex'),recordKg:g('cap-rkg'),semaines:g('cap-sem')});
  if(r.erreur){ toast(r.erreur,'var(--orange)'); return false; }
  c.objectifCap=r.objectifCap; c.updatedAt=Date.now(); users[c.email]=c;
  toastSync(DB.set('users',users),CLOUD.pushOne(c.email,c),'Objectifs enregistrés '+ICO.coche,'les objectifs sont');
  renderCapCoach(c);
  return true;
}

// ══ LA RÉACTIVITÉ DU COACH ══════════════════════════════════════════════════
const REACTIVITE_JOURS=30;
const REACTIVITE_CIBLE_H=Object.freeze([24,48]);
/** PURE. Les délais (h) entre une demande et la réponse qui la suit ; ce qui n'a pas de réponse est compté à part. */
function delaisDepuisFil(messages){
  const l=(messages||[]).filter(m=>m&&Number(m.at)>0).sort((a,b)=>a.at-b.at);
  const out=[]; let attente=null, ouverts=0;
  for(const m of l){
    if(m.de==='athlete'){ if(attente==null) attente=Number(m.at); }
    else if(m.de==='coach'&&attente!=null){ out.push({demande:attente,reponse:Number(m.at)}); attente=null; }
  }
  if(attente!=null) ouverts++;
  return {paires:out,ouverts,attente};
}
/**
 * PURE. La réactivité sur 30 jours : le délai médian (delaiMedianReponse, la
 * fonction existante, coach seul), le nombre de réponses comptées, les
 * demandes encore ouvertes et un verdict contre l'objectif de 24 à 48 h.
 * @param {{date:number, reponseDate:number|null}[]} echanges
 */
function reactiviteCoach(echanges,maintenant){
  const t=Number(maintenant)||Date.now(), lim=t-REACTIVITE_JOURS*864e5;
  const l=(echanges||[]).filter(e=>e&&Number(e.date)>=lim&&Number(e.date)<=t);
  const n=l.filter(e=>Number(e.reponseDate)>=Number(e.date)).length;
  const m=delaiMedianReponse(l,t);
  return {medianeH:m,n,ouverts:l.length-n,
    verdict:m==null?null:(m<=REACTIVITE_CIBLE_H[0]?'bon':(m<=REACTIVITE_CIBLE_H[1]?'correct':'lent'))};
}
/** Les bilans des athlètes du coach : la date du bilan, celle de la réponse. */
function _reactiviteBilans(clients){
  const out=[];
  for(const c of clients||[]) for(const b of (c&&c.bilans)||[]){
    if(!b||!b.date||b.type==='depart') continue;
    out.push({date:Number(b.date),reponseDate:b.reponseDate?Number(b.reponseDate):null});
  }
  return out;
}
let _reacMsg=null;   // {t, evenements} : les fils lus à la demande, 10 min
async function reactiviteChargerMessages(btn){
  if(btn) btn.disabled=true;
  const ev=[];
  try{
    const clients=getClients().slice(0,30);
    const tok=await CLOUD._getToken();
    for(const c of clients){
      const k=_msgCles(currentUser,_relCle(c)); if(!k||!tok) continue;
      try{
        const r=await fetch(CLOUD._fbUrl.replace('users.json','messages/'+k.coach+'/'+k.athlete+'.json')+'?auth='+tok+'&orderBy=%22%24key%22&limitToLast='+MSG_PAGE);
        const j=r.ok?await r.json():null;
        const f=delaisDepuisFil(Object.values(j||{}));
        ev.push(...f.paires.map(p=>({date:p.demande,reponseDate:p.reponse})));
        if(f.attente!=null) ev.push({date:f.attente,reponseDate:null});
      }catch(e){}
    }
  }catch(e){}
  _reacMsg={t:Date.now(),evenements:ev};
  if(btn) btn.disabled=false;
  renderReactivite();
  return true;
}
function renderReactivite(){
  const z=document.getElementById('ch-reactivite'); if(!z) return false;
  if(!currentUser||currentUser.role!=='coach'){ z.innerHTML=''; return false; }
  let clients=[]; try{ clients=getClients(); }catch(e){ clients=[]; }
  const avecMsg=_reacMsg&&Date.now()-_reacMsg.t<10*60e3;
  const r=reactiviteCoach(_reactiviteBilans(clients).concat(avecMsg?_reacMsg.evenements:[]));
  const E=escapeHtml;
  z.innerHTML='<div class="reac-carte"><div class="reac-t">Ta réactivité · 30 jours</div>'
    +(r.medianeH==null?'<p class="sub">Pas encore de réponse à mesurer sur 30 jours.</p>'
      :'<div class="reac-v reac-'+r.verdict+'"><b>'+E(_cfmt(r.medianeH))+' h</b><span>délai médian sur '+r.n+' réponse'+(r.n>1?'s':'')+(avecMsg?' (bilans et messages)':' (bilans)')+' · objectif sous '+REACTIVITE_CIBLE_H[0]+' à '+REACTIVITE_CIBLE_H[1]+' h</span></div>')
    +(r.ouverts?'<div class="reac-o">'+r.ouverts+' demande'+(r.ouverts>1?'s':'')+' en attente de réponse</div>':'')
    +(avecMsg?'':'<button type="button" class="rb-lien" onclick="reactiviteChargerMessages(this)">Inclure les messages</button>')
    +'<div class="reac-p">Visible de toi seul.</div></div>';
  return true;
}
