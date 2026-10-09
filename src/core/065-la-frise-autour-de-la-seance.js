// ══ LA FRISE « AUTOUR DE TA SÉANCE » (build 1959) ═════════════════════════
// Un jour de séance, l'écran Nutrition montre une frise horizontale : le repas
// d'avant (1 h 30 à 2 h avant), la collation rapide (20 à 30 min avant), l'eau
// pendant (750 mL par heure), les glucides pendant une séance longue (20 à
// 50 g/h au-delà de 75 min), la caféine (dose et heure limite, lien vers
// l'écran Caféine, jamais au-delà du plafond du jour) et le repas d'après
// (dans les 2 h). Un jour sans séance : aucune frise.
//   DIÈTE STRICTE  elle propose de DÉPLACER un repas du plan, jamais d'en
//                  inventer un ; sans repas à déplacer, elle le dit.
//   FLEXIBLE       elle dit la part des macros à placer avant et après.
// L'heure de la séance n'existe nulle part dans le programme : l'athlète la
// donne, jour de la semaine par jour de la semaine (u.frise.heures). Les
// notifications (1 h 45 avant, 20 min avant, juste après) sont optionnelles
// et locales à l'app ouverte, comme les rappels du mode Ramadan : 1 h 45 avant
// une séance du soir tombe souvent après le 2e push serveur du jour.
// Stockage : u.frise = {heures{0..6: 'HH:MM'}, notifs} (0 = lundi).

const TIMING_SEANCE=Object.freeze({
  repasAvantMin:90, repasAvantMax:120,
  collationRapideMin:20, collationRapideMax:30,
  fenetreApresH:2,
  lipidesAutourSeance:'faibles',
  hydratationPendantMl:Object.freeze({parHeure:750}),
  glucidesIntraSiSeanceMin:75,
  glucidesIntraParH:Object.freeze([20,50])
});
// Valeurs de travail (non données par la demande), à confirmer par Kevin :
// la part des macros du jour autour de la séance en flexible, la dose de
// caféine (3 mg/kg, 30 à 60 min avant) et l'heure de réveil par défaut.
const FRISE_PART_AVANT=Object.freeze({g:30,p:25});
const FRISE_PART_APRES=Object.freeze({g:30,p:25});
const FRISE_CAFEINE_MG_KG=3, FRISE_CAFEINE_AVANT_MIN=45;
const FRISE_REVEIL_DEFAUT='06:30';
const FRISE_NOTIFS=Object.freeze([{cle:'avant',min:-105,titre:'Ta séance dans 1 h 45',corps:'C’est l’heure du repas d’avant : glucides, protéines, peu de lipides.'},
  {cle:'collation',min:-20,titre:'Séance dans 20 min',corps:'Une collation rapide si tu as faim, et ta gourde.'},
  {cle:'apres',min:0,titre:'Séance finie',corps:'Repas d’après dans les 2 h : protéines et glucides.'}]);
// Les heures habituelles des repas du plan strict, pour choisir lequel déplacer.
const FRISE_HEURES_REPAS=Object.freeze({petit_dej:'07:30',collation1:'10:00',midi:'12:30',avant:null,pendant:null,apres:null,collation2:'16:30',soir:'19:30',coucher:'22:00'});

/**
 * PURE. La frise d'un jour de séance.
 * @param {string} heureSeance  « 18:00 » ; vide → aucune frise
 * @param {number} dureeMin
 * @param {{cle:string,lib:string}[]|{p,g,l}} repasDuJour  stricte : les repas du plan ; flexible : les macros du jour
 * @param {'strict'|'flexible'} typeDiete
 * @param {{reveil?:string, poidsKg?:number, cafeine?:{dejaMg:number,plafond:number,limite:string|null}}} [o]
 * @returns {{heure:string, min:number, type:'repas'|'collation'|'eau'|'cafeine', cible:any, phrase:string}[]}
 */
function frisePeriSeance(heureSeance,dureeMin,repasDuJour,typeDiete,o){
  const s=hmMin(heureSeance);
  if(s==null) return [];
  o=o||{};
  const T=TIMING_SEANCE;
  const d=Math.max(15,Math.min(300,Math.round(Number(dureeMin)||60)));
  const fin=s+d, reveil=hmMin(o.reveil)!=null?hmMin(o.reveil):hmMin(FRISE_REVEIL_DEFAUT);
  const out=[];
  const pose=(m,type,cible,phrase)=>out.push({heure:minHm(m),min:m,type,cible,phrase});
  const strict=typeDiete==='strict';
  const plan=strict&&Array.isArray(repasDuJour)?repasDuJour:[];
  const M=(!strict&&repasDuJour&&!Array.isArray(repasDuJour))?repasDuJour:{};
  // Le repas du plan le plus proche d'une heure visée, s'il en existe un ;
  // les repas déjà liés à la séance (avant, apres) sont pris en premier.
  const choisir=(vise,prefere,deja)=>{
    const p=plan.find(r=>r&&r.cle===prefere&&deja.indexOf(r.cle)<0);
    if(p) return p;
    let best=null, ecart=1e9;
    for(const r of plan){ if(!r||deja.indexOf(r.cle)>=0) continue; const h=hmMin(FRISE_HEURES_REPAS[r.cle]); if(h==null) continue; const e=Math.abs(h-vise); if(e<ecart){ ecart=e; best=r; } }
    return best;
  };
  const pris=[];
  // ── Avant : le repas (2 h à 1 h 30), ou la collation légère si c'est trop tôt.
  const avantDebut=s-T.repasAvantMax, avantFin=s-T.repasAvantMin;
  const tropTot=avantFin<reveil+15;
  if(!tropTot){
    const m=Math.max(avantDebut,reveil+15);
    if(strict){
      const r=choisir(m,'avant',pris);
      if(r){ pris.push(r.cle); pose(m,'repas',{repas:r.cle},'Déplace ton « '+r.lib+' » vers '+minHm(m)+' : 1 h 30 à 2 h avant la séance, lipides '+T.lipidesAutourSeance+'.'); }
      else pose(m,'repas',null,'Aucun repas de ton plan à placer avant la séance : vois avec ton coach plutôt que d’en ajouter un.');
    } else pose(m,'repas',_friseCible(M,FRISE_PART_AVANT),'Repas d’avant : environ '+FRISE_PART_AVANT.g+' % de tes glucides et '+FRISE_PART_AVANT.p+' % de tes protéines du jour, lipides '+T.lipidesAutourSeance+'.'+_friseGrammes(M,FRISE_PART_AVANT));
  }
  // ── La collation rapide (20 à 30 min avant) : toujours si c'est trop tôt pour un repas.
  const mc=s-T.collationRapideMax;
  if(tropTot) pose(Math.max(mc,reveil),'collation',{glucides:'rapides',lipides:T.lipidesAutourSeance},
    'Séance tôt : pas de repas possible 2 h avant. Une collation légère '+T.collationRapideMin+' à '+T.collationRapideMax+' min avant (banane, compote, pain blanc), lipides '+T.lipidesAutourSeance+'.');
  else pose(mc,'collation',{glucides:'rapides',optionnelle:true},'Si tu as faim : une collation rapide '+T.collationRapideMin+' à '+T.collationRapideMax+' min avant, digeste.');
  // ── La caféine : avant la séance, si l'heure limite et le plafond le permettent.
  if(o.cafeine){
    const c=o.cafeine, mcaf=s-FRISE_CAFEINE_AVANT_MIN, lim=hmMin(c.limite);
    const reste=Math.max(0,Math.min(CAFFEINE_MAX_EFSA,Number(c.plafond)||CAFFEINE_MAX_EFSA)-(Number(c.dejaMg)||0));
    const dose=Math.min(reste,Math.round((Number(o.poidsKg)||70)*FRISE_CAFEINE_MG_KG/10)*10);
    if(lim!=null&&mcaf>lim) pose(mcaf,'cafeine',{mg:0,limite:c.limite},'Pas de caféine avant cette séance : ton heure limite pour bien dormir est '+c.limite+'.');
    else if(!(dose>0)) pose(mcaf,'cafeine',{mg:0},'Plafond de caféine du jour atteint : pas de dose avant la séance.');
    else pose(mcaf,'cafeine',{mg:dose,limite:c.limite||null},'Caféine si tu en prends : '+dose+' mg 30 à 60 min avant'+(c.limite?', jamais après '+c.limite:'')+'.');
  }
  // ── Pendant : l'eau, et les glucides d'une séance longue.
  const ml=Math.round(T.hydratationPendantMl.parHeure*d/60/50)*50;
  pose(s,'eau',{ml,parHeure:T.hydratationPendantMl.parHeure},'Pendant : '+T.hydratationPendantMl.parHeure+' mL d’eau par heure, soit '+ml+' mL sur '+d+' min.');
  if(d>T.glucidesIntraSiSeanceMin) pose(s+T.glucidesIntraSiSeanceMin,'collation',{gParH:T.glucidesIntraParH},
    'Séance longue : au-delà de '+T.glucidesIntraSiSeanceMin+' min, '+T.glucidesIntraParH[0]+' à '+T.glucidesIntraParH[1]+' g de glucides par heure (boisson, gel, fruit sec).');
  // ── Après : le repas, dans les 2 h.
  const ma=fin+30;
  if(strict){
    const r=choisir(ma,'apres',pris);
    if(r){ pris.push(r.cle); pose(ma,'repas',{repas:r.cle},'Déplace ton « '+r.lib+' » vers '+minHm(ma)+' : dans les '+T.fenetreApresH+' h après la séance.'); }
    else pose(ma,'repas',null,'Aucun repas de ton plan à placer après la séance : vois avec ton coach.');
  } else pose(ma,'repas',_friseCible(M,FRISE_PART_APRES),'Repas d’après, dans les '+T.fenetreApresH+' h : environ '+FRISE_PART_APRES.g+' % de tes glucides et '+FRISE_PART_APRES.p+' % de tes protéines du jour.'+_friseGrammes(M,FRISE_PART_APRES));
  return out.sort((a,b)=>a.min-b.min);
}
function _friseCible(M,part){ return {pctG:part.g,pctP:part.p,g:Math.round((Number(M.g)||0)*part.g/100),p:Math.round((Number(M.p)||0)*part.p/100)}; }
function _friseGrammes(M,part){
  const g=Math.round((Number(M.g)||0)*part.g/100), p=Math.round((Number(M.p)||0)*part.p/100);
  return g&&p?' Soit '+g+' g de glucides et '+p+' g de protéines.':'';
}
/** PURE. Les notifications de la frise : heure et texte. */
function notifsFrise(heureSeance,dureeMin){
  const s=hmMin(heureSeance); if(s==null) return [];
  const d=Math.round(Number(dureeMin)||60);
  return FRISE_NOTIFS.map(n=>({cle:n.cle,heure:minHm(n.cle==='apres'?s+d:s+n.min),titre:n.titre,corps:n.corps}));
}
/** PURE. L'heure de séance du jour (0 = lundi), ou ''. */
function heureSeanceDuJour(u,date){
  const d=date instanceof Date?date:new Date(date==null?Date.now():date);
  const h=u&&u.frise&&u.frise.heures&&u.frise.heures[String((d.getDay()+6)%7)];
  return hmMin(h)!=null?h:'';
}

// ══ L'ÉCRAN ══════════════════════════════════════════════════════════════════
const FRISE_ICO=Object.freeze({repas:'utensils',collation:'zap',eau:'droplet',cafeine:'coffee'});
/** PURE. La frise rendue (défilement horizontal). */
function htmlFrise(items,heureSeance,dureeMin){
  const s=hmMin(heureSeance);
  return '<div class="fr-rail" role="list">'+items.map(x=>'<div class="fr-it fr-'+x.type+(x.min>=s&&x.min<s+dureeMin&&x.type!=='repas'?' fr-pendant':'')+'" role="listitem">'
    +'<div class="fr-h">'+escapeHtml(x.heure)+'</div>'
    +'<div class="fr-i" aria-hidden="true">'+icon(FRISE_ICO[x.type]||'clock',16)+'</div>'
    +'<div class="fr-p">'+escapeHtml(x.phrase)+'</div>'
    +(x.type==='cafeine'?'<button type="button" class="rb-lien" onclick="loadCaffeine()">Ma caféine</button>':'')
    +'</div>').join('')+'</div>';
}
/** Les données du jour, depuis le dossier : diète, plan, macros, caféine, réveil. */
function _friseDonnees(u,jour){
  const nut=u.nutrition||{}, dt=typeDiete(nut);
  let repas;
  if(dt==='strict'){
    let cles=[]; try{ cles=planSquelette(planDe(u)).map(x=>x.repas); }catch(e){ cles=[]; }
    repas=PLAN_REPAS.filter(r=>cles.indexOf(r.cle)>=0).map(r=>({cle:r.cle,lib:r.lib}));
  } else {
    let m={}; try{ m=_getEffectiveMacros(nut,true,jour)||{}; }catch(e){ m={}; }
    repas={p:m.p,g:m.g,l:m.l};
  }
  let kg=70; try{ kg=Number(poidsNutritionnel(u).kg)||70; }catch(e){}
  const entrees=((nut.caffeine||{}).days||{})[jour]||[];
  let plafond=CAFFEINE_MAX_EFSA; try{ plafond=caffeineThresholds(kg,_ageUtilisateur(u),grossesseSuspend(u)).plafond; }catch(e){}
  let limite=null; try{ const c=coucherHabituel(u); if(c) { const l=heureLimiteCafeine(entrees,_minEnHhmm(c.min)); limite=l==null?null:_minEnHhmm(l); } }catch(e){}
  const wakes=((u.sleepLog)||[]).slice(-7).map(x=>hmMin(x&&x.wake)).filter(x=>x!=null).sort((a,b)=>a-b);
  const reveil=wakes.length?minHm(wakes[Math.floor(wakes.length/2)]):FRISE_REVEIL_DEFAUT;
  let duree=60; try{ duree=_dureeSeanceMin(u).min; }catch(e){}
  return {dt,repas,o:{reveil,poidsKg:kg,cafeine:{dejaMg:entrees.reduce((a,e)=>a+(Number(e&&e.mg)||0),0),plafond,limite}},duree};
}
function rendreFriseSeance(u){
  const z=document.getElementById('nut-frise'); if(!z) return false;
  const jour=localISODate(new Date());
  let seance=false; try{ seance=nutIsOnDayCalendrier(jour,u); }catch(e){ seance=false; }
  if(!u||u.role==='coach'||!seance){ z.innerHTML=''; _friseMinuteur(false); return false; }
  const h=heureSeanceDuJour(u,new Date());
  if(!h){
    z.innerHTML='<div class="fr-carte"><div class="fr-t">Autour de ta séance</div>'
      +'<label for="fr-heure">À quelle heure t’entraînes-tu aujourd’hui ?</label>'
      +'<div class="fr-ligne"><input id="fr-heure" type="time"><button type="button" class="btn btn-red btn-sm" onclick="friseHeureEnregistrer()">Placer mes repas</button></div></div>';
    _friseMinuteur(false);
    return true;
  }
  const D=_friseDonnees(u,jour);
  const items=frisePeriSeance(h,D.duree,D.repas,D.dt,D.o);
  const notifs=!!(u.frise&&u.frise.notifs);
  z.innerHTML='<div class="fr-carte"><div class="fr-t">Autour de ta séance · '+escapeHtml(h)+'</div>'
    +htmlFrise(items,h,D.duree)
    +'<div class="fr-pied"><label class="fr-notif"><input type="checkbox" '+(notifs?'checked':'')+' onchange="friseNotifs(this.checked)"> Me le rappeler (1 h 45 avant, 20 min avant, juste après)</label>'
    +'<button type="button" class="rb-lien" onclick="friseHeureEffacer()">Changer l’heure</button></div></div>';
  _friseMinuteur(notifs);
  return true;
}
function _friseEcrire(maj){
  const u=currentUser; if(!u) return false;
  u.frise=Object.assign({heures:{},notifs:false},u.frise||{},maj(u.frise||{}));
  saveUserOuDire('L’heure de ta séance');
  rendreFriseSeance(u);
  return true;
}
function friseHeureEnregistrer(){
  const v=(document.getElementById('fr-heure')||{}).value||'';
  if(hmMin(v)==null){ toast('Choisis une heure.','var(--orange)'); return false; }
  const j=String((new Date().getDay()+6)%7);
  return _friseEcrire(f=>({heures:Object.assign({},f.heures||{},{[j]:v})}));
}
function friseHeureEffacer(){
  const j=String((new Date().getDay()+6)%7);
  return _friseEcrire(f=>{ const h=Object.assign({},f.heures||{}); delete h[j]; return {heures:h}; });
}
function friseNotifs(oui){
  // Aucune demande de permission ici : le rappel est un toast dans l'app, et
  // une notification système seulement si elle est déjà permise.
  return _friseEcrire(()=>({notifs:!!oui}));
}
let _frMinuteur=null, _frDernier='';
function _friseMinuteur(oui){
  if(!oui){ if(_frMinuteur){ clearInterval(_frMinuteur); _frMinuteur=null; } return; }
  if(!_frMinuteur) _frMinuteur=setInterval(_friseTic,60e3);
}
function _friseTic(){
  const u=currentUser; if(!u||!(u.frise&&u.frise.notifs)) return _friseMinuteur(false);
  const h=heureSeanceDuJour(u,new Date()); if(!h) return;
  let duree=60; try{ duree=_dureeSeanceMin(u).min; }catch(e){}
  const d=new Date(), maintenant=minHm(d.getHours()*60+d.getMinutes());
  const n=notifsFrise(h,duree).find(x=>x.heure===maintenant);
  if(!n||_frDernier===localISODate(d)+n.cle) return;
  _frDernier=localISODate(d)+n.cle;
  toast(n.titre+' : '+n.corps,'var(--sub)',6000);
  try{
    if(typeof _notifSupported==='function'&&_notifSupported()&&Notification.permission==='granted')
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(n.titre,{body:n.corps,tag:'frise-'+n.cle,icon:'./icons/icon-192x192.png'})).catch(()=>{});
  }catch(e){}
}
