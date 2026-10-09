// ══ LES GABARITS DE FORCE (build 1960) ════════════════════════════════════
// Cinq gabarits classiques, générés avec les charges RÉELLES de l'athlète :
// son meilleur e1RM fiable (maxE1rmObserve : séries de 12 répétitions
// potentielles au plus, 120 derniers jours), ou un 1RM que le coach connaît.
// Sans l'un ni l'autre, rien n'est généré : on propose d'abord de mesurer
// (une série lourde de 3 à 5 répétitions, RIR noté — le test de 1RM guidé du
// lot P5 n'existe pas encore dans l'app).
// Le coach choisit un gabarit et des exercices, voit les semaines une à une,
// corrige une charge s'il veut, et enregistre. Le plan vit dans
// u.gabaritsForce.plans (database.rules.json) ; la séance pré-remplit ses
// séries (charges arrondies aux disques, modifiables), comme la programmation
// par exercice. Les séries « + » (AMRAP) relèvent leurs répétitions : l'e1RM
// suit de lui-même (il se relit dans les séances) et la base du cycle
// suivant en découle (prochaineBase).

// LA TABLE % / RÉPÉTITIONS AUX RPE 8 ET 9 : tirée de RPE_PCT, la table de
// Kevin, et non recopiée — 1 rép. 92,2 / 95,5 %, 2 → 89,2, 3 → 86,3,
// 5 → 81,1, 6 → 78,6, 7 → 76,2, 8 → 73,9 (RPE 8) sont ses valeurs. La 4e
// répétition, absente de la demande, vaut 83,7 % : l'interpolation entre 3 et
// 5 ((86,3 + 81,1) / 2), qui est aussi la valeur de la table. Les demi-points
// (8,5, 9,5) se lisent dans RPE_PCT. RPE = 10 − RIR.
const TABLE_PCT_REPS=Object.freeze({'8':Object.freeze(RPE_PCT['8'].slice()),'9':Object.freeze(RPE_PCT['9'].slice())});
/** PURE. Le RPE d'un RIR : 10 − RIR, demi-points gardés. */
function rpeDeRir(rir){ const r=Number(rir); return isFinite(r)&&r>=0&&r<=4?Math.round((10-r)*2)/2:null; }
/** PURE. Le % du 1RM pour `reps` à un RPE (demi-points compris), ou null hors table. */
function pctReps(reps,rpe){ return pctDe1RM(String(Math.round(Number(rpe)*2)/2),reps); }
const _s=(n,reps,pct,o)=>Object.freeze(Array.from({length:n},()=>Object.freeze(Object.assign({reps,pct},o||{}))));
const _seance=(...blocs)=>Object.freeze([].concat(...blocs));
/**
 * Les gabarits. Chaque semaine : {phase?, seances:[[{reps, pct, amrap?}]]}.
 * `base` : la part du 1RM qui sert de référence (0,9 pour le 5/3/1).
 */
const GABARITS_FORCE=Object.freeze({
  cinq_trois_un:Object.freeze({nom:'5/3/1',base:0.9,
    semaines:Object.freeze([
      {seances:[_seance(_s(1,5,65),_s(1,5,75),_s(1,5,85,{amrap:true}))]},
      {seances:[_seance(_s(1,3,70),_s(1,3,80),_s(1,3,90,{amrap:true}))]},
      {seances:[_seance(_s(1,5,75),_s(1,3,85),_s(1,1,95,{amrap:true}))]},
      {phase:'Décharge',seances:[_seance(_s(1,5,40),_s(1,5,50),_s(1,5,60))]}].map(Object.freeze)),
    // Après le cycle : +1 à 2 % (développés), +2 à 3 % (squat, soulevé de terre).
    progressionPct:Object.freeze({haut:Object.freeze([1,2]),bas:Object.freeze([2,3])})}),
  sheiko_bloc:Object.freeze({nom:'Bloc Sheiko',base:1,cyclesMax:2,progressionKg:Object.freeze([5,10]),
    semaines:Object.freeze([
      {seances:[_seance(_s(6,6,70))]},{seances:[_seance(_s(7,5,75))]},
      {seances:[_seance(_s(8,4,80))]},{seances:[_seance(_s(10,3,85))]}].map(Object.freeze))}),
  smolov:Object.freeze({nom:'Smolov',base:1,squatSeul:true,travail:true,
    avertissement:'Smolov : réservé aux pratiquants avancés, au squat seulement. Treize semaines très exigeantes ; à la moindre douleur, on arrête.',
    phases:Object.freeze([{nom:'Préparation',semaines:2},{nom:'Base',semaines:4},{nom:'Récupération',semaines:2},{nom:'Intensification',semaines:4},{nom:'Affûtage',semaines:1}].map(Object.freeze)),
    semaines:Object.freeze([
      // Préparation (2)
      {phase:'Préparation',seances:[_seance(_s(3,8,65),_s(1,5,70),_s(2,2,75),_s(1,1,80)),_seance(_s(3,8,65),_s(1,5,70),_s(2,2,75),_s(2,1,80)),_seance(_s(4,5,70),_s(1,3,75),_s(2,2,80),_s(1,1,90))]},
      {phase:'Préparation',seances:[_seance(_s(4,5,60)),_seance(_s(4,5,65)),_seance(_s(5,4,70))]},
      // Base (4) : la 3e semaine ajoute 10 kg, la 4e est le test.
      {phase:'Base',seances:[_seance(_s(4,9,70)),_seance(_s(5,7,75)),_seance(_s(7,5,80)),_seance(_s(10,3,85))]},
      {phase:'Base',seances:[_seance(_s(4,9,70,{plusKg:10})),_seance(_s(5,7,75,{plusKg:10})),_seance(_s(7,5,80,{plusKg:10})),_seance(_s(10,3,85,{plusKg:10}))]},
      {phase:'Base',seances:[_seance(_s(4,9,70,{plusKg:15})),_seance(_s(5,7,75,{plusKg:15})),_seance(_s(7,5,80,{plusKg:15})),_seance(_s(10,3,85,{plusKg:15}))]},
      {phase:'Base',seances:[_seance(_s(3,3,70)),_seance(_s(1,1,100,{test:true}))]},
      // Récupération (2)
      {phase:'Récupération',seances:[_seance(_s(3,5,60)),_seance(_s(3,5,65))]},
      {phase:'Récupération',seances:[_seance(_s(3,5,65)),_seance(_s(3,3,70))]},
      // Intensification (4)
      {phase:'Intensification',seances:[_seance(_s(1,3,65),_s(1,4,75),_s(4,4,85)),_seance(_s(1,3,60),_s(1,3,70),_s(5,5,80)),_seance(_s(1,3,65),_s(1,3,75),_s(1,3,85),_s(4,5,85))]},
      {phase:'Intensification',seances:[_seance(_s(1,3,60),_s(1,3,70),_s(1,3,80),_s(5,5,90)),_seance(_s(1,3,60),_s(1,3,70),_s(1,3,80),_s(4,3,90)),_seance(_s(1,3,65),_s(1,4,75),_s(4,4,85))]},
      {phase:'Intensification',seances:[_seance(_s(1,3,60),_s(1,3,70),_s(1,4,80),_s(3,4,90),_s(2,5,85)),_seance(_s(1,3,60),_s(1,3,70),_s(1,3,80),_s(5,5,85)),_seance(_s(1,3,65),_s(1,3,75),_s(1,3,85),_s(5,3,95))]},
      {phase:'Intensification',seances:[_seance(_s(1,3,60),_s(1,3,70),_s(5,3,90)),_seance(_s(1,3,60),_s(1,3,70),_s(1,3,80),_s(3,3,95)),_seance(_s(1,3,65),_s(1,3,75),_s(1,3,85),_s(2,2,95))]},
      // Affûtage (1)
      {phase:'Affûtage',seances:[_seance(_s(3,3,75),_s(2,2,85)),_seance(_s(1,1,102.5,{test:true}))]}].map(Object.freeze))}),
  neuf_semaines_sbd:Object.freeze({nom:'Neuf semaines SBD',base:1,
    semaines:Object.freeze([
      {phase:'Volume',seances:[_seance(_s(5,5,80))]},{phase:'Volume',seances:[_seance(_s(5,5,80))]},
      {phase:'Volume',seances:[_seance(_s(5,5,80))]},{phase:'Volume',seances:[_seance(_s(5,5,80))]},
      {seances:[_seance(_s(5,5,85))]},{seances:[_seance(_s(4,4,90))]},{seances:[_seance(_s(3,3,95))]},
      {seances:[_seance(_s(2,2,100))]},{phase:'Record',seances:[_seance(_s(1,1,105,{test:true}))]}].map(Object.freeze))}),
  top_set_backoff:Object.freeze({nom:'Top set + back-off',base:1,parametres:Object.freeze({reps:5,rpe:8,backoff:3,backoffPct:10,semaines:4})})
});
const GABARITS_CLES=Object.freeze(Object.keys(GABARITS_FORCE));
const GABARIT_PLANS_MAX=6;
// Les mouvements du bas du corps, pour la progression du 5/3/1.
const _GAB_BAS=/squat|soulev|deadlift|terre|hack|presse a cuisses/i;
const _GAB_SQUAT=/squat/i;

/** PURE. Les semaines d'un gabarit (le top set les calcule depuis la table). */
function semainesGabarit(g,params){
  if(g!==GABARITS_FORCE.top_set_backoff) return g.semaines;
  const p=Object.assign({},g.parametres,params||{});
  const top=pctReps(p.reps,p.rpe);
  if(top==null) return [];
  const bo=Math.round(top*(1-p.backoffPct/100)*10)/10;
  const seance=[{reps:p.reps,pct:top,rpe:Number(p.rpe)}].concat(Array.from({length:Math.max(0,Math.min(8,Math.round(p.backoff)))},()=>({reps:p.reps,pct:bo})));
  return Array.from({length:Math.max(1,Math.min(12,Math.round(p.semaines)))},()=>({seances:[seance]}));
}
/**
 * PURE. Le gabarit généré.
 * @param {string} cle  une clé de GABARITS_FORCE
 * @param {Object<string,{max:number, fiable:boolean}>} records  par exercice
 * @param {number} semaineDebut  un instant de la semaine de départ (ramené au lundi)
 * @param {{exos?:string[], pas?:number, params?:object, cycle?:number, user?:object}} [o]
 * @returns {{ok:true, plans:object[], avertissements:string[]}|{ok:false, raison:string, proposerTest1RM?:boolean, manquants?:string[]}}
 */
function genererGabarit(cle,records,semaineDebut,o){
  o=o||{};
  const g=GABARITS_FORCE[cle];
  if(!g||!Object.prototype.hasOwnProperty.call(GABARITS_FORCE,cle)) return {ok:false,raison:'Gabarit inconnu.'};
  const exos=(o.exos&&o.exos.length?o.exos:Object.keys(records||{})).filter(Boolean);
  if(!exos.length) return {ok:false,raison:'Choisis au moins un exercice.'};
  if(g.squatSeul&&exos.some(e=>!_GAB_SQUAT.test(e))) return {ok:false,raison:'Smolov se fait au squat seulement.'};
  const manquants=exos.filter(e=>{ const r=records&&records[e]; return !(r&&r.fiable&&Number(r.max)>0); });
  if(manquants.length) return {ok:false,proposerTest1RM:true,manquants,
    raison:'Aucun 1RM fiable pour '+manquants.join(', ')+' : mesure-le d’abord (une série lourde de 3 à 5 répétitions, RIR noté), rien n’est inventé.'};
  const cycle=Math.max(0,Math.round(Number(o.cycle)||0));
  if(g.cyclesMax&&cycle>=g.cyclesMax) return {ok:false,raison:g.cyclesMax+' cycles au plus : prévois une vraie coupure avant d’en relancer un.'};
  const sem=semainesGabarit(g,o.params);
  if(!sem.length) return {ok:false,raison:'Réglage du top set hors de la table (1 à 12 répétitions, RPE 6 à 10).'};
  const lundi=_lundiDe(new Date(Number(semaineDebut)||Date.now())).getTime();
  const arr=kg=>arrondiCharge(kg,{sens:'proche',pas:Number(o.pas)>0?Number(o.pas):undefined,ex:undefined,user:o.user});
  const plans=exos.map(exo=>{
    const max=Number(records[exo].max);
    // La base : 0,9 × 1RM au 5/3/1 ; au bloc Sheiko, +5 kg par cycle déjà fait.
    const base=Math.round((max*g.base+(g.progressionKg?cycle*g.progressionKg[0]:0))*10)/10;
    return {cle,exo,max,base,cycle,debut:lundi,
      semaines:sem.map((s,i)=>({n:i+1,debut:lundi+i*604800000,phase:s.phase||null,
        seances:s.seances.map(se=>se.map(x=>({reps:x.reps,pct:x.pct,kg:arr(base*x.pct/100+(x.plusKg||0)),amrap:!!x.amrap,test:!!x.test})))}))};
  });
  const av=[];
  if(g.avertissement) av.push(g.avertissement);
  if(g.travail) av.push('Le détail des séances de '+g.nom+' hors phase de base est un contenu de travail, à valider.');
  if(g.cyclesMax) av.push(g.cyclesMax+' cycles au plus avant une vraie coupure (cycle '+(cycle+1)+').');
  return {ok:true,plans,avertissements:av};
}
/**
 * PURE. La base du cycle suivant, depuis la dernière série « + ».
 * 5/3/1 : au moins les répétitions demandées → +haut de fourchette si on en a fait 3 de plus,
 * +bas sinon ; en dessous, la base ne bouge pas. Sheiko : +5 à 10 kg (10 si l'e1RM a progressé).
 */
function prochaineBase(plan){
  const g=GABARITS_FORCE[plan&&plan.cle]; if(!g) return null;
  const am=Object.values(plan.amraps||{}).sort((a,b)=>(a.w-b.w)||(a.at-b.at)).pop();
  if(g.progressionPct){
    const f=_GAB_BAS.test(plan.exo)?g.progressionPct.bas:g.progressionPct.haut;
    if(!am) return {base:plan.base,pct:0,raison:'Aucune série « + » relevée : la base ne bouge pas.'};
    if(am.reps<am.vise) return {base:plan.base,pct:0,raison:'Série « + » sous la cible ('+am.reps+' pour '+am.vise+') : on refait le cycle à la même base.'};
    const pct=am.reps>=am.vise+3?f[1]:f[0];
    return {base:Math.round(plan.base*(1+pct/100)*10)/10,pct,e1:am.e1,raison:am.reps+' répétitions à '+am.kg+' kg : +'+pct+' %.'};
  }
  if(g.progressionKg){
    const kg=(am&&am.e1>plan.max)?g.progressionKg[1]:g.progressionKg[0];
    return {base:plan.base+kg,kg,raison:'+'+kg+' kg pour le cycle suivant.'};
  }
  return null;
}
/** PURE. La consigne du jour d'un exercice : la semaine, la séance (rang dans la semaine), les séries. */
function consigneGabarit(u,exNom,date){
  const plans=_gabPlans(u);
  const t=date==null?Date.now():Number(date instanceof Date?date.getTime():date);
  const nom=String(exNom||'').trim().toUpperCase();
  for(const id of Object.keys(plans)){
    const p=plans[id];
    if(String(p.exo||'').trim().toUpperCase()!==nom) continue;
    const sem=Array.isArray(p.semaines)?p.semaines:Object.values(p.semaines||{});
    const w=Math.floor((t-Number(p.debut))/604800000);
    if(!(w>=0&&w<sem.length)) continue;
    const s=sem[w];
    const seances=Array.isArray(s.seances)?s.seances:Object.values(s.seances||{});
    // Le rang de la séance : celles de la semaine qui ont déjà porté cet exercice.
    const lundi=Number(p.debut)+w*604800000;
    const faites=((u&&u.sessions)||[]).filter(x=>x&&Number(x.date)>=lundi&&Number(x.date)<t&&x.data&&Object.keys(x.data).some(k=>k.trim().toUpperCase()===nom)).length;
    if(faites>=seances.length) return null;
    const series=Array.isArray(seances[faites])?seances[faites]:Object.values(seances[faites]||{});
    return {id,plan:p,w,seance:faites,phase:s.phase||null,series};
  }
  return null;
}
function _gabPlans(u){ const g=u&&u.gabaritsForce; return (g&&g.plans&&typeof g.plans==='object')?g.plans:{}; }
/** PURE. « 5×85 · 5×97,5 · 5+×110 kg » */
function texteSeriesGabarit(series){
  const l=series||[];
  const groupes=[];
  for(const x of l){ const d=groupes[groupes.length-1]; if(d&&d.reps===x.reps&&d.kg===x.kg&&d.amrap===x.amrap) d.n++; else groupes.push({n:1,reps:x.reps,kg:x.kg,amrap:x.amrap}); }
  return groupes.map(x=>(x.n>1?x.n+'×':'')+x.reps+(x.amrap?'+':'')+' × '+String(x.kg).replace('.',',')).join(' · ')+' kg';
}
/** Après la séance : les séries « + » relevées dans le plan (répétitions faites, e1RM). Rend le nombre relevé. */
function gabaritsApresSeance(u,sess){
  const plans=_gabPlans(u); let n=0;
  if(!sess||!sess.data) return 0;
  for(const id of Object.keys(plans)){
    const p=plans[id];
    const k=Object.keys(sess.data).find(x=>x.trim().toUpperCase()===String(p.exo).trim().toUpperCase());
    const d=k&&sess.data[k];
    if(!d||!Array.isArray(d.sets)) continue;
    const w=Math.floor((Number(sess.date)-Number(p.debut))/604800000);
    for(const se of d.sets){
      if(!se||!se.done||!se.amrap) continue;
      const kg=parseFloat(se.weight), reps=parseInt(se.repsDone!=null&&se.repsDone!==''?se.repsDone:se.reps,10);
      if(!(kg>0)||!(reps>0)) continue;
      p.amraps=Object.assign({},p.amraps||{});
      p.amraps[String(w)]={w,kg,reps,vise:Number(se.amrapVise)||Number(se.reps)||reps,e1:Math.round(e1rm(kg,reps,0)*10)/10,at:Number(sess.date)||Date.now()};
      n++;
    }
  }
  return n;
}

// ══ L'ÉCRAN DU COACH ════════════════════════════════════════════════════════
let _gabApercu=null;
/** Les exercices du client : ceux de son programme, avec leur 1RM fiable s'il existe. */
function _gabExosClient(c){
  const noms=new Set();
  for(const s of (Array.isArray(c&&c.sessions_config)?c.sessions_config:[])) for(const e of ((s&&s.exercises)||[])) if(e&&e.name&&!isCardio(e)) noms.add(String(e.name));
  return [...noms].map(n=>{ let m=null; try{ m=maxE1rmObserve(c,n); }catch(e){ m=null; } return {nom:n,max:m}; });
}
function ouvrirGabaritsForce(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users); if(!c) return false;
  const E=escapeHtml, exos=_gabExosClient(c);
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="gab-h" class="dfm-feuille gab-feuille">'
    +'<h2 id="gab-h" style="margin-bottom:4px">Gabarits de force</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);line-height:1.55;margin-bottom:12px">Les charges partent du meilleur e1RM fiable de '+E(c.fname||'ton athlète')+' (ou d’un 1RM que tu connais), arrondies aux disques.</p>'
    +'<label for="gab-cle">Gabarit</label><select id="gab-cle" onchange="gabApercu()">'+GABARITS_CLES.map(k=>'<option value="'+k+'">'+E(GABARITS_FORCE[k].nom)+'</option>').join('')+'</select>'
    +'<div class="gab-lab">Exercices</div><div class="gab-exos">'+(exos.length?exos.map((x,i)=>'<label class="gab-ex"><input type="checkbox" data-exo="'+E(x.nom)+'" onchange="gabApercu()"> <span>'+E(x.nom.toLowerCase())+'</span>'
      +'<input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" autocomplete="off" class="gab-max" data-max="'+i+'" value="'+(x.max?String(x.max).replace('.',','):'')+'" placeholder="1RM ?" aria-label="1RM de '+E(x.nom)+'" oninput="gabApercu()"></label>').join('')
      :'<p class="sub">Aucun exercice dans son programme.</p>')+'</div>'
    +'<div class="dfm-ligne" style="margin-top:10px"><div style="flex:1"><label for="gab-debut">Semaine de départ</label><input id="gab-debut" type="date" value="'+localISODate(new Date())+'" onchange="gabApercu()"></div></div>'
    +'<div id="gab-apercu" class="gab-apercu" aria-live="polite"></div>'
    +'<div style="display:flex;gap:8px;margin-top:14px"><button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>'
    +'<button class="btn btn-red btn-sm" id="gab-ok" style="flex:1;margin:0;min-height:44px" onclick="appliquerGabarit()" disabled>Enregistrer</button></div>'
    +'</div></div>');
  gabApercu();
  return true;
}
/** Lit le formulaire et régénère l'aperçu, semaine par semaine, charges modifiables. */
function gabApercu(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  const z=document.getElementById('gab-apercu'); if(!z||!c) return false;
  const cle=(document.getElementById('gab-cle')||{}).value;
  const records={}, exos=[];
  document.querySelectorAll('.gab-ex').forEach(l=>{
    const cb=l.querySelector('input[type=checkbox]'), mx=l.querySelector('.gab-max');
    if(!cb||!cb.checked) return;
    const n=cb.dataset.exo; exos.push(n);
    const v=parseFloat(String((mx&&mx.value)||'').replace(',','.'));
    records[n]={max:v,fiable:v>0};
  });
  const d=(document.getElementById('gab-debut')||{}).value;
  const r=genererGabarit(cle,records,d?Date.parse(d+'T12:00:00'):Date.now(),{exos,user:c});
  const ok=document.getElementById('gab-ok');
  _gabApercu=r.ok?r:null;
  if(ok) ok.disabled=!r.ok;
  if(!r.ok){ z.innerHTML='<p class="gab-err">'+escapeHtml(r.raison)+'</p>'; return false; }
  z.innerHTML=r.avertissements.map(a=>'<p class="gab-av">'+escapeHtml(a)+'</p>').join('')+r.plans.map((p,pi)=>
    '<div class="gab-plan"><div class="gab-lab">'+escapeHtml(p.exo.toLowerCase())+' · base '+String(p.base).replace('.',',')+' kg</div>'
    +p.semaines.map((s,wi)=>'<div class="gab-sem"><b>S'+s.n+(s.phase?' · '+escapeHtml(s.phase):'')+'</b>'
      +s.seances.map((se,si)=>'<div class="gab-se">'+(s.seances.length>1?'<span class="sub">J'+(si+1)+'</span> ':'')
        +se.map((x,xi)=>'<span class="gab-x">'+x.reps+(x.amrap?'+':'')+' × <input type="text" inputmode="decimal" pattern="[0-9]*[.,]?[0-9]*" class="gab-kg" value="'+String(x.kg).replace('.',',')+'" aria-label="Charge" onchange="gabCorriger('+pi+','+wi+','+si+','+xi+',this.value)"></span>').join('')+'</div>').join('')
      +'</div>').join('')+'</div>').join('');
  return true;
}
/** L'ajustement manuel d'une charge dans l'aperçu. */
function gabCorriger(pi,wi,si,xi,v){
  const kg=parseFloat(String(v||'').replace(',','.'));
  const x=_gabApercu&&_gabApercu.plans[pi]&&_gabApercu.plans[pi].semaines[wi]&&_gabApercu.plans[pi].semaines[wi].seances[si][xi];
  if(!x||!(kg>0&&kg<=600)){ toast('Charge invalide.','var(--orange)'); return false; }
  x.kg=Math.round(kg*100)/100; x.manuel=true;
  return true;
}
function appliquerGabarit(){
  if(!_gabApercu) return false;
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users); if(!c) return false;
  const plans=Object.assign({},_gabPlans(c));
  // Un plan par exercice : le nouveau remplace l'ancien du même exercice.
  for(const p of _gabApercu.plans){
    for(const id of Object.keys(plans)) if(String(plans[id].exo).toUpperCase()===p.exo.toUpperCase()) delete plans[id];
    plans['g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)]=p;
  }
  const ids=Object.keys(plans).sort((a,b)=>Number(plans[b].debut)-Number(plans[a].debut)).slice(0,GABARIT_PLANS_MAX);
  c.gabaritsForce={plans:Object.fromEntries(ids.map(i=>[i,plans[i]]))};
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Gabarit enregistré '+ICO.coche,'le gabarit est');
  closeModal();
  renderGabaritsCoach(c);
  return true;
}
/** La liste des plans du client, sous « Modifier le programme ». */
function renderGabaritsCoach(c){
  const z=document.getElementById('ccd-gabarits'); if(!z) return false;
  const plans=_gabPlans(c), ids=Object.keys(plans);
  const E=escapeHtml, t=Date.now();
  z.innerHTML='<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:0 0 10px;min-height:44px" onclick="ouvrirGabaritsForce()">Gabarits de force</button>'
    +ids.map(id=>{
      const p=plans[id], g=GABARITS_FORCE[p.cle]||{nom:p.cle}, sem=Array.isArray(p.semaines)?p.semaines:Object.values(p.semaines||{});
      const w=Math.floor((t-Number(p.debut))/604800000), fini=w>=sem.length;
      const nb=fini?prochaineBase(p):null;
      return '<div class="gab-ligne"><b>'+E(g.nom)+' · '+E(String(p.exo).toLowerCase())+'</b><span>'
        +(w<0?'Commence le '+E(new Date(Number(p.debut)).toLocaleDateString('fr-FR')):fini?'Cycle terminé'+(nb?' · '+E(nb.raison)+' Base suivante : '+String(nb.base).replace('.',',')+' kg':''):'Semaine '+(w+1)+' sur '+sem.length)
        +'</span></div>';
    }).join('');
  return true;
}
