// ══ LE MODE RAMADAN (build 1957) ══════════════════════════════════════════
// Activé par l'athlète (Mon profil) ou par le coach (fiche client, onglet
// Nutrition), il adapte, du début à la fin qu'on lui donne :
//   la nutrition   les macros du jour réparties en 4 repas horodatés
//                  (RAMADAN_REPARTITION) ; en diète stricte, les repas du plan
//                  sont RECALÉS sur ces 4 moments (jamais inventés) ; en
//                  flexible, des anneaux par repas ;
//   la séance      un verdict sur l'heure choisie (conseilSeanceRamadan) et,
//                  pendant la période, un plafond SUGGÉRÉ de 60 % de l'e1RM
//                  en 8-12 répétitions, ajouté à la raison de la charge
//                  proposée sans jamais la modifier (la décision reste au coach) ;
//   l'hydratation  200 mL toutes les 30 min entre l'iftar et le sahur ;
//   la sieste      un créneau de 30-40 min, réveil avant 60 min, loin du coucher.
// Puis il se désactive SEUL le lendemain de sa fin (ramadanFinAuto).
// AUCUN APPEL EXTERNE : les horaires (iftar, sahur) se saisissent, ou se
// collent une fois depuis le calendrier de la mosquée (ramadanImporterHoraires).
// Un jour sans horaire, l'app le dit et ne devine rien.
// Stockage : u.ramadan = {actif, debut, fin, ville?, horaires{jour:{iftar,
// sahur}}, heureSeance?, par, majLe, termineLe?, eau{jour:n}}
// (database.rules.json, liste blanche).
// ⚠ Rappels : l'hydratation tombe la nuit, dans les heures calmes du serveur
//   (21 h – 8 h) et au-delà de son plafond de 2 push par jour. Ce sont donc
//   des rappels DE L'APP, tant qu'elle est ouverte (notification locale si
//   elle est permise), pas des push serveur.

/** Part des macros du jour par repas (%), glucides rapides ou lents. */
const RAMADAN_REPARTITION=Object.freeze({
  iftar:Object.freeze({lib:'Iftar',p:25,g:30,l:0,glucides:'rapides'}),
  post_seance:Object.freeze({lib:'Après la séance',p:25,g:30,l:15,glucides:'rapides'}),
  collation:Object.freeze({lib:'Collation',p:25,g:10,l:40,glucides:'lents'}),
  sahur:Object.freeze({lib:'Sahur',p:25,g:30,l:45,glucides:'lents'})
});
const RAMADAN_REPAS_ORDRE=Object.freeze(['iftar','post_seance','collation','sahur']);
const RAMADAN_PROT_MIN_REPAS=40;     // g : avertissement en dessous
const RAMADAN_INTENSITE_MAX=0.6;     // part de l'e1RM
const RAMADAN_REPS=Object.freeze([8,12]);
const RAMADAN_SEANCE_MIN=60;         // durée d'une séance, pour placer le repas d'après
const RAMADAN_JEUNE_SEANCE_MAX=75;   // avant l'iftar : 75 min au plus
const RAMADAN_EAU_ML=200, RAMADAN_EAU_PAS_MIN=30;
const RAMADAN_SIESTE=Object.freeze({min:30,max:40,plafond:60,avantCoucherH:6,heure:'14:00'});
const RAMADAN_SAHUR_AVANT_MIN=45;    // le repas du sahur finit avant l'imsak
const RAMADAN_JOURS_MAX=40;
// Les repas du plan strict, recalés sur les 4 moments (jamais d'invention).
const RAMADAN_RECALAGE=Object.freeze({
  soir:'iftar', avant:'post_seance', pendant:'post_seance', apres:'post_seance',
  collation1:'collation', collation2:'collation', coucher:'collation',
  petit_dej:'sahur', midi:'sahur'
});
const _HM_RE=/^([01]\d|2[0-3]):([0-5]\d)$/;
/** PURE. « 18:41 » → 1121 minutes ; null si illisible. */
function hmMin(s){ const m=_HM_RE.exec(String(s||'').trim()); return m?Number(m[1])*60+Number(m[2]):null; }
/** PURE. 1121 → « 18:41 » (modulo 24 h). */
function minHm(n){ const x=((Math.round(n)%1440)+1440)%1440; return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0'); }
/** PURE. Les horaires d'un jour, valides : {iftar, sahur} en minutes, ou null. */
function horairesValides(h){
  const i=hmMin(h&&h.iftar), s=hmMin(h&&h.sahur);
  if(i==null||s==null) return null;
  // Le sahur est avant l'aube, l'iftar au coucher du soleil : sahur < iftar.
  if(!(s<i)) return null;
  return {iftar:i,sahur:s};
}
/** PURE. L'état du mode pour un jour (AAAA-MM-JJ). */
function ramadanEtat(u,jour){
  const r=(u&&u.ramadan&&typeof u.ramadan==='object')?u.ramadan:null;
  if(!r||!r.actif||!r.debut||!r.fin) return {actif:false,horaires:null,manque:false};
  const dedans=jour>=r.debut&&jour<=r.fin;
  if(!dedans) return {actif:false,horaires:null,manque:false,avant:jour<r.debut};
  const h=horairesValides((r.horaires||{})[jour]);
  return {actif:true,horaires:h,manque:!h,heureSeance:hmMin(r.heureSeance)};
}
/** PURE (sur u). Le lendemain de la fin, le mode se coupe seul. Rend true s'il a changé. */
function ramadanFinAuto(u,jour,t){
  const r=u&&u.ramadan;
  if(!r||!r.actif||!r.fin||!(jour>r.fin)) return false;
  r.actif=false; r.termineLe=Number(t)||Date.now();
  return true;
}
/** PURE. La période saisie, contrôlée. {ok} ou {erreur}. */
function ramadanPeriodeValide(debut,fin){
  const re=/^\d{4}-\d{2}-\d{2}$/;
  if(!re.test(String(debut||''))||!re.test(String(fin||''))) return {erreur:'Donne la date de début et de fin.'};
  const n=Math.round((Date.parse(fin+'T12:00:00Z')-Date.parse(debut+'T12:00:00Z'))/864e5)+1;
  if(!(n>=1)) return {erreur:'La fin est avant le début.'};
  if(n>RAMADAN_JOURS_MAX) return {erreur:'Une période de '+RAMADAN_JOURS_MAX+' jours au plus.'};
  return {ok:true,jours:n};
}
/**
 * PURE. Les horaires collés depuis un calendrier, une ligne par jour :
 * « 2027-02-08 05:12 18:41 », « 08/02/2027;05:12;18:41 »… (date, sahur, iftar).
 * @returns {{horaires:Object, erreurs:number[]}} erreurs = numéros de lignes.
 */
function ramadanImporterHoraires(texte){
  const horaires={}, erreurs=[];
  String(texte||'').split(/\r?\n/).forEach((l,i)=>{
    const s=l.trim(); if(!s) return;
    let m=/^(\d{4})-(\d{2})-(\d{2})[\s;,\t]+(\d{1,2}[:h]\d{2})[\s;,\t]+(\d{1,2}[:h]\d{2})$/.exec(s);
    let jour=null, a, b;
    if(m){ jour=m[1]+'-'+m[2]+'-'+m[3]; a=m[4]; b=m[5]; }
    else if((m=/^(\d{2})\/(\d{2})\/(\d{4})[\s;,\t]+(\d{1,2}[:h]\d{2})[\s;,\t]+(\d{1,2}[:h]\d{2})$/.exec(s))){ jour=m[3]+'-'+m[2]+'-'+m[1]; a=m[4]; b=m[5]; }
    const n=x=>{ const k=String(x||'').replace('h',':').split(':'); return String(k[0]).padStart(2,'0')+':'+k[1]; };
    const h=jour?{sahur:n(a),iftar:n(b)}:null;
    if(!h||!horairesValides(h)||isNaN(Date.parse(jour+'T12:00:00Z'))){ erreurs.push(i+1); return; }
    horaires[jour]=h;
  });
  return {horaires,erreurs};
}
/**
 * PURE. Les 4 repas de la nuit, horodatés, avec leurs cibles.
 * @param {{p:number,g:number,l:number}} macrosJour  grammes du jour
 * @param {{iftar:string,sahur:string}} horaires
 * @param {string} [heureSeance]  « 21:30 »
 * @returns {{repas:{cle,lib,heure,p,g,l,kcal,glucides,alerte?}[], erreur?:string}}
 */
function repasRamadan(macrosJour,horaires,heureSeance){
  const h=horairesValides(horaires);
  if(!h) return {repas:[],erreur:'Horaires de l’iftar et du sahur manquants pour ce jour.'};
  const M={p:Math.max(0,Number(macrosJour&&macrosJour.p)||0),g:Math.max(0,Number(macrosJour&&macrosJour.g)||0),l:Math.max(0,Number(macrosJour&&macrosJour.l)||0)};
  // Les minutes de la nuit : l'iftar à i, le sahur le lendemain (s + 1440).
  const i=h.iftar, s=h.sahur+1440;
  const sahurRepas=s-RAMADAN_SAHUR_AVANT_MIN;
  const sea=hmMin(heureSeance);
  // La séance de la nuit (après l'iftar), sinon on place le repas d'après à iftar + 1 h 30.
  let seaNuit=null;
  if(sea!=null){ const x=sea<i?sea+1440:sea; if(x>i&&x<sahurRepas) seaNuit=x; }
  const post=seaNuit!=null?Math.min(seaNuit+RAMADAN_SEANCE_MIN+15,sahurRepas-120):i+90;
  const coll=Math.round((post+sahurRepas)/2);
  const heures={iftar:i,post_seance:Math.max(i+30,post),collation:coll,sahur:sahurRepas};
  const repas=RAMADAN_REPAS_ORDRE.map(cle=>{
    const r=RAMADAN_REPARTITION[cle];
    const p=Math.round(M.p*r.p/100), g=Math.round(M.g*r.g/100), l=Math.round(M.l*r.l/100);
    const o={cle,lib:r.lib,heure:minHm(heures[cle]),min:heures[cle],p,g,l,kcal:Math.round(4*p+4*g+9*l),glucides:r.glucides};
    if(M.p>0&&p<RAMADAN_PROT_MIN_REPAS) o.alerte='Moins de '+RAMADAN_PROT_MIN_REPAS+' g de protéines à ce repas : augmente la portion si tu peux.';
    return o;
  });
  return {repas};
}
/** PURE. 'ideale' | 'acceptable' | 'deconseillee' (| 'inconnue' sans horaires ou sans heure). */
function conseilSeanceRamadan(horaires,heureSeance){
  return detailSeanceRamadan(horaires,heureSeance).verdict;
}
/** PURE. Le verdict et sa phrase, avec le plafond d'intensité de la période. */
function detailSeanceRamadan(horaires,heureSeance){
  const h=horairesValides(horaires), s=hmMin(heureSeance);
  const base={intensiteMax:RAMADAN_INTENSITE_MAX,reps:RAMADAN_REPS};
  if(!h) return Object.assign({verdict:'inconnue',phrase:'Saisis les horaires de l’iftar et du sahur pour situer ta séance.'},base);
  if(s==null) return Object.assign({verdict:'inconnue',phrase:'Choisis l’heure de ta séance.'},base);
  const i=h.iftar, sa=h.sahur;
  // Minutes écoulées depuis l'iftar, sur la nuit (0 à 1439).
  const dIftar=((s-i)%1440+1440)%1440;
  const nuit=((sa-i)%1440+1440)%1440;       // durée iftar → sahur
  if(dIftar>=90&&dIftar<=180&&dIftar<nuit) return Object.assign({verdict:'ideale',phrase:'Idéal : 1 h 30 à 3 h après l’iftar, tu t’entraînes nourri et hydraté.'},base);
  if(dIftar>0&&dIftar<nuit) return Object.assign({verdict:'acceptable',phrase:dIftar<90?'Un peu tôt après l’iftar : laisse 1 h 30 à la digestion si tu peux.':'Tard dans la nuit : garde du temps pour la collation et le sahur.'},base);
  const dSahur=((s-sa)%1440+1440)%1440;
  if(dSahur<=180&&s<i) return Object.assign({verdict:'acceptable',phrase:'Après le sahur : intensité faible seulement, la journée de jeûne commence.'},base);
  return Object.assign({verdict:'deconseillee',
    phrase:'Avant l’iftar, à jeun : '+RAMADAN_JEUNE_SEANCE_MAX+' min au plus, en finissant juste avant la rupture (début vers '+minHm(i-RAMADAN_JEUNE_SEANCE_MAX)+').',
    debutConseille:minHm(i-RAMADAN_JEUNE_SEANCE_MAX),dureeMax:RAMADAN_JEUNE_SEANCE_MAX},base);
}
/** PURE. Les rappels d'eau : toutes les 30 min de l'iftar au sahur, 200 mL. */
function rappelsHydratation(horaires){
  const h=horairesValides(horaires);
  if(!h) return {heures:[],objectifMl:0};
  const fin=h.sahur+1440, heures=[];
  for(let m=h.iftar;m<=fin;m+=RAMADAN_EAU_PAS_MIN) heures.push(minHm(m));
  return {heures,objectifMl:heures.length*RAMADAN_EAU_ML};
}
/** Le coucher habituel en minutes (coucherHabituel, chunk 047), sinon 23:00. */
function _ramadanCoucher(u){ try{ const c=coucherHabituel(u); return c&&c.min!=null?c.min:23*60; }catch(e){ return 23*60; } }
/** PURE. Le créneau de sieste : 30-40 min, réveil avant 60 min, au moins 6 h avant le coucher. null si impossible. */
function rappelSieste(horaires,coucherMin){
  const h=horairesValides(horaires);
  if(!h) return null;
  const c=coucherMin==null?23*60:coucherMin;
  const cAbs=c<12*60?c+1440:c;
  let debut=hmMin(RAMADAN_SIESTE.heure);
  const limite=cAbs-RAMADAN_SIESTE.avantCoucherH*60-RAMADAN_SIESTE.max;
  if(debut>limite) debut=limite;
  if(debut<=h.sahur+120) return null;
  return {debut:minHm(debut),fin:minHm(debut+RAMADAN_SIESTE.max),duree:[RAMADAN_SIESTE.min,RAMADAN_SIESTE.max],
    phrase:'Sieste de '+RAMADAN_SIESTE.min+' à '+RAMADAN_SIESTE.max+' min vers '+minHm(debut)+' : réveil avant '+RAMADAN_SIESTE.plafond+' min, sinon tu tombes en sommeil profond.'};
}
/** PURE. Les repas du plan strict, rangés dans les 4 moments. */
function recalerPlanRamadan(repasPlan){
  const out={iftar:[],post_seance:[],collation:[],sahur:[]};
  for(const r of repasPlan||[]){ const c=RAMADAN_RECALAGE[r]; if(c&&out[c].indexOf(r)<0) out[c].push(r); }
  return out;
}
/** PURE. Ce qui a été mangé, par repas : une entrée va au dernier repas commencé avant elle. */
function ramadanConsommeParRepas(entries,repas){
  const out={}; for(const r of repas||[]) out[r.cle]={p:0,g:0,l:0,kcal:0};
  if(!repas||!repas.length) return out;
  const tri=repas.slice().sort((a,b)=>a.min-b.min);
  for(const e of entries||[]){
    const d=new Date(Number(e&&e.id)||0); if(!(d.getTime()>0)) continue;
    let m=d.getHours()*60+d.getMinutes();
    if(m<tri[0].min) m+=1440;
    let cible=null; for(const r of tri) if(r.min<=m) cible=r.cle;
    if(!cible) cible=tri[tri.length-1].cle;
    const o=out[cible]; o.p+=Number(e.p)||0; o.g+=Number(e.c)||0; o.l+=Number(e.l)||0; o.kcal+=Number(e.kcal)||0;
  }
  return out;
}
/** PURE. Le plafond suggéré pour une charge proposée, ou null hors période ou sans e1RM. */
function plafondRamadan(e1,kg){
  if(!(Number(e1)>0)) return null;
  const plafond=Math.round(e1*RAMADAN_INTENSITE_MAX*2)/2;
  return {plafond,depasse:Number(kg)>plafond,
    phrase:'Ramadan : plafond suggéré '+String(plafond).replace('.',',')+' kg ('+Math.round(RAMADAN_INTENSITE_MAX*100)+' % de ton e1RM), '+RAMADAN_REPS[0]+'-'+RAMADAN_REPS[1]+' rép.'};
}
/** Appelé par suggestionDepuisHistorique : ajoute le plafond à la RAISON, jamais au kg. */
function _ramadanAnnoter(u,ex,res){
  try{
    if(!res||!ex||!ramadanEtat(u,localISODate(new Date())).actif) return res;
    const p=plafondRamadan(maxE1rmObserve(u,ex.name),res.kg);
    if(!p||!p.depasse) return res;
    return Object.assign({},res,{ramadan:p,raison:(res.raison?res.raison+' · ':'')+p.phrase});
  }catch(e){ return res; }
}

// ══ L'ÉCRAN : LA CARTE DE L'ACCUEIL ══════════════════════════════════════════
/** PURE. La carte du jour : horaires, verdict de séance, 4 repas, eau, sieste. */
function htmlCarteRamadan(u,jour,macros,entries,eauBue){
  const e=ramadanEtat(u,jour);
  if(!e.actif) return '';
  const E=escapeHtml;
  if(e.manque) return '<div class="rmd-carte"><div class="rmd-t">Mode Ramadan</div>'
    +'<p class="rmd-manque">Horaires de l’iftar et du sahur manquants pour aujourd’hui : rien n’est calculé sans eux.</p>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="ouvrirRamadan()">Saisir les horaires</button></div>';
  const r=u.ramadan, h=r.horaires[jour];
  const rp=repasRamadan(macros||{},h,r.heureSeance);
  const sea=detailSeanceRamadan(h,r.heureSeance);
  const eau=rappelsHydratation(h);
  const sieste=rappelSieste(h,_ramadanCoucher(u));
  const flexible=typeDiete(u.nutrition||{})==='flexible';
  const conso=flexible?ramadanConsommeParRepas(entries,rp.repas):null;
  const jauge=(v,c)=>c>0?'<span class="rmd-j"><span style="width:'+Math.min(100,Math.round(v/c*100))+'%"></span></span>':'';
  let h1='<div class="rmd-carte"><div class="rmd-t">Mode Ramadan</div>'
    +'<div class="rmd-h">Sahur '+E(h.sahur)+' · Iftar '+E(h.iftar)+'</div>';
  if(r.heureSeance) h1+='<div class="rmd-sea rmd-'+sea.verdict+'"><b>Séance à '+E(r.heureSeance)+'</b> · '+E(sea.phrase)
    +' <span class="rmd-plaf">Intensité : '+Math.round(RAMADAN_INTENSITE_MAX*100)+' % de l’e1RM, '+RAMADAN_REPS[0]+'-'+RAMADAN_REPS[1]+' rép.</span></div>';
  if(rp.repas.length&&(macros&&(macros.p||macros.g||macros.l))){
    h1+='<div class="rmd-repas">'+rp.repas.map(x=>{
      const c=conso&&conso[x.cle];
      return '<div class="rmd-r"><div class="rmd-r-t"><b>'+E(x.heure)+'</b> '+E(x.lib)+'</div>'
        +'<div class="rmd-r-m">P '+x.p+' g · G '+x.g+' g ('+x.glucides+') · L '+x.l+' g</div>'
        +(c?'<div class="rmd-r-c">'+jauge(c.p,x.p)+jauge(c.g,x.g)+jauge(c.l,x.l)+'</div>':'')
        +(x.alerte?'<div class="rmd-alerte">'+E(x.alerte)+'</div>':'')+'</div>';
    }).join('')+'</div>';
    if(!flexible){
      let pl=[]; try{ const p=planDe(u); pl=planSquelette(p).map(x=>x.repas); }catch(err){ pl=[]; }
      const rc=recalerPlanRamadan(pl);
      const lib=k=>{ const x=PLAN_REPAS.find(y=>y.cle===k); return x?x.lib:k; };
      const lignes=RAMADAN_REPAS_ORDRE.filter(k=>rc[k].length).map(k=>'<li><b>'+E(RAMADAN_REPARTITION[k].lib)+'</b> : '+E(rc[k].map(lib).join(', '))+'</li>');
      if(lignes.length) h1+='<div class="rmd-lab">Ton plan, recalé</div><ul class="rmd-plan">'+lignes.join('')+'</ul>';
    }
  } else h1+='<p class="sub">Tes cibles de macros ne sont pas encore posées : la répartition par repas s’affichera avec elles.</p>';
  const n=Math.max(0,Number(eauBue)||0);
  h1+='<div class="rmd-eau"><div><b>Eau</b> · '+(n*RAMADAN_EAU_ML)+' / '+eau.objectifMl+' mL · '+RAMADAN_EAU_ML+' mL toutes les '+RAMADAN_EAU_PAS_MIN+' min</div>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="ramadanVerre()">+ '+RAMADAN_EAU_ML+' mL</button></div>';
  if(sieste) h1+='<div class="rmd-sieste">'+E(sieste.phrase)+'</div>';
  h1+='<button type="button" class="rb-lien" onclick="ouvrirRamadan()">Régler le mode Ramadan</button></div>';
  return h1;
}
function rendreCarteRamadan(u){
  const z=document.getElementById('clh-ramadan'); if(!z) return false;
  const jour=localISODate(new Date());
  if(u&&u.role!=='coach'&&ramadanFinAuto(u,jour,Date.now())){
    saveUserOuDire('La fin du mode Ramadan');
    toast('Le mode Ramadan s’est terminé hier : tes réglages habituels reprennent.','var(--green)',5000);
  }
  if(!u||u.role==='coach'||!ramadanEtat(u,jour).actif){ z.hidden=true; z.innerHTML=''; _ramadanMinuteur(false); return false; }
  let m={}; try{ m=_getEffectiveMacros(u.nutrition||{},nutIsOnDay(jour),jour)||{}; }catch(e){ m={}; }
  const entries=(((u.nutrition||{}).log||{})[jour]||{}).entries||[];
  z.innerHTML=htmlCarteRamadan(u,jour,{p:m.p,g:m.g,l:m.l},entries,((u.ramadan.eau||{})[jour]));
  z.hidden=false;
  _ramadanMinuteur(true);
  return true;
}
function ramadanVerre(){
  const u=currentUser; if(!u||!u.ramadan) return false;
  const j=localISODate(new Date());
  const eau=Object.assign({},u.ramadan.eau||{});
  // Seuls les 7 derniers jours restent : un compteur, pas un historique.
  for(const k of Object.keys(eau)) if(k<localISODate(new Date(Date.now()-7*864e5))) delete eau[k];
  eau[j]=Math.min(40,(Number(eau[j])||0)+1);
  u.ramadan.eau=eau;
  saveUserOuDire('Ton verre d’eau');
  rendreCarteRamadan(u);
  return true;
}
// ── Les rappels de l'app (ouverte) : l'eau toutes les 30 min, la sieste ─────
let _rmdMinuteur=null, _rmdDernier='';
function _ramadanMinuteur(oui){
  if(!oui){ if(_rmdMinuteur){ clearInterval(_rmdMinuteur); _rmdMinuteur=null; } return; }
  if(!_rmdMinuteur) _rmdMinuteur=setInterval(_ramadanTic,60e3);
}
/** PURE. Le rappel dû à la minute m (« HH:MM »), ou null. */
function ramadanRappelDu(horaires,hm,coucherMin){
  const e=rappelsHydratation(horaires);
  if(e.heures.indexOf(hm)>=0) return {cle:'eau-'+hm,titre:'Un verre d’eau',corps:RAMADAN_EAU_ML+' mL maintenant. Objectif de la nuit : '+e.objectifMl+' mL.'};
  const s=rappelSieste(horaires,coucherMin);
  if(s&&s.debut===hm) return {cle:'sieste-'+hm,titre:'La sieste',corps:s.phrase};
  return null;
}
function _ramadanTic(){
  const u=currentUser, j=localISODate(new Date());
  const e=ramadanEtat(u,j); if(!e.actif||e.manque) return;
  const d=new Date(), hm=minHm(d.getHours()*60+d.getMinutes());
  const r=ramadanRappelDu(u.ramadan.horaires[j],hm,_ramadanCoucher(u));
  if(!r||r.cle===_rmdDernier) return;
  _rmdDernier=r.cle;
  toast(r.titre+' : '+r.corps,'var(--sub)',6000);
  try{
    if(typeof _notifSupported==='function'&&_notifSupported()&&Notification.permission==='granted')
      navigator.serviceWorker.ready.then(reg=>reg.showNotification(r.titre,{body:r.corps,tag:'ramadan',icon:'./icons/icon-192x192.png'})).catch(()=>{});
  }catch(err){}
}

// ══ LES RÉGLAGES : ATHLÈTE OU COACH ══════════════════════════════════════════
/** Le dossier qu'on règle : le sien, ou celui du client ouvert (coach). */
function _ramadanCible(){
  if(currentUser&&currentUser.role==='coach'){
    const users=DB.get('users')||{};
    return {users,u:getOwnedClient(currentClientId,users),coach:true};
  }
  return {users:null,u:currentUser,coach:false};
}
function ouvrirRamadan(){
  const c=_ramadanCible(); if(!c.u) return false;
  const r=c.u.ramadan||{};
  const E=escapeHtml;
  const lignes=Object.keys(r.horaires||{}).sort().map(j=>j+' '+r.horaires[j].sahur+' '+r.horaires[j].iftar).join('\n');
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="rmd-h" class="dfm-feuille">'
    +'<h2 id="rmd-h" style="margin-bottom:4px">Mode Ramadan'+(c.coach?' · '+E(c.u.fname||''):'')+'</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);line-height:1.55;margin-bottom:12px">Repas de la nuit, heure de séance, eau et sieste. Il se coupe seul le lendemain de la fin.</p>'
    +'<div class="dfm-ligne"><div style="flex:1"><label for="rmd-debut">Début</label><input id="rmd-debut" type="date" value="'+E(r.debut||'')+'"></div>'
    +'<div style="flex:1"><label for="rmd-fin">Fin</label><input id="rmd-fin" type="date" value="'+E(r.fin||'')+'"></div></div>'
    +'<label for="rmd-seance" style="margin-top:12px">Heure de séance</label><input id="rmd-seance" type="time" value="'+E(r.heureSeance||'')+'">'
    +'<label for="rmd-ville" style="margin-top:12px">Ville (pour mémoire)</label><input id="rmd-ville" type="text" maxlength="40" value="'+E(r.ville||'')+'">'
    +'<label for="rmd-horaires" style="margin-top:12px">Horaires : une ligne par jour, « date sahur iftar »</label>'
    +'<textarea id="rmd-horaires" rows="5" placeholder="2027-02-08 05:12 18:41&#10;09/02/2027;05:10;18:42">'+E(lignes)+'</textarea>'
    +'<p class="sub" style="font-size:var(--fs-xs)">Copie le calendrier de ta mosquée. Un jour sans horaire n’est pas calculé.</p>'
    +'<div id="rmd-err" class="arb-err" hidden></div>'
    +'<div style="display:flex;gap:8px;margin-top:16px">'
    +(r.actif?'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="enregistrerRamadan(false)">Désactiver</button>'
      :'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>')
    +'<button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="enregistrerRamadan(true)">'+(r.actif?'Enregistrer':'Activer')+'</button></div>'
    +'</div></div>');
  return true;
}
function enregistrerRamadan(actif){
  const c=_ramadanCible(); if(!c.u) return false;
  const g=id=>(document.getElementById(id)||{}).value||'';
  const err=document.getElementById('rmd-err');
  const dire=m=>{ if(err){ err.textContent=m; err.hidden=false; } return false; };
  const ancien=c.u.ramadan||{};
  let r;
  if(!actif){ r=Object.assign({},ancien,{actif:false,majLe:Date.now(),par:c.coach?'coach':'athlete'}); }
  else {
    const p=ramadanPeriodeValide(g('rmd-debut'),g('rmd-fin'));
    if(p.erreur) return dire(p.erreur);
    const im=ramadanImporterHoraires(g('rmd-horaires'));
    if(im.erreurs.length) return dire('Ligne'+(im.erreurs.length>1?'s':'')+' illisible'+(im.erreurs.length>1?'s':'')+' : '+im.erreurs.slice(0,6).join(', ')+'.');
    const horaires={}; for(const j of Object.keys(im.horaires)) if(j>=g('rmd-debut')&&j<=g('rmd-fin')) horaires[j]=im.horaires[j];
    const sea=g('rmd-seance');
    if(sea&&hmMin(sea)==null) return dire('Heure de séance illisible.');
    r={actif:true,debut:g('rmd-debut'),fin:g('rmd-fin'),horaires,par:c.coach?'coach':'athlete',majLe:Date.now()};
    if(sea) r.heureSeance=sea;
    const v=g('rmd-ville').trim().slice(0,40); if(v) r.ville=v;
    if(ancien.eau) r.eau=ancien.eau;
  }
  c.u.ramadan=r;
  if(c.coach){
    c.u.updatedAt=Date.now(); c.users[c.u.email]=c.u;
    const ok=DB.set('users',c.users);
    toastSync(ok,CLOUD.pushOne(c.u.email,c.u),actif?'Mode Ramadan activé '+ICO.coche:'Mode Ramadan désactivé','le mode Ramadan est');
    try{ renderCoachRamadan(c.u); }catch(e){}
  } else {
    saveUserOuDire('Ton mode Ramadan');
    rendreCarteRamadan(currentUser);
    const manque=actif?Object.keys(r.horaires).length:1;
    toast(actif?(manque?'Mode Ramadan activé.':'Mode Ramadan activé, mais sans horaires : saisis-les pour voir tes repas.'):'Mode Ramadan désactivé.',actif&&!manque?'var(--orange)':'var(--green)',5000);
  }
  closeModal();
  return true;
}
/** Côté coach : une ligne dans l'onglet Nutrition de la fiche client. */
function renderCoachRamadan(c){
  const z=document.getElementById('ccd-ramadan'); if(!z) return false;
  const j=localISODate(new Date()), e=ramadanEtat(c,j), r=(c&&c.ramadan)||{};
  z.innerHTML='<div class="rmd-coach"><div><b>Mode Ramadan</b><span>'
    +(e.actif?'Actif jusqu’au '+escapeHtml(r.fin)+(e.manque?' · horaires manquants aujourd’hui':'')+(r.par==='athlete'?' · activé par l’athlète':'')
      :r.actif&&r.debut>j?'Programmé du '+escapeHtml(r.debut)+' au '+escapeHtml(r.fin):'Inactif')
    +'</span></div><button type="button" class="btn btn-outline btn-sm" onclick="ouvrirRamadan()">'+(r.actif?'Régler':'Activer')+'</button></div>';
  return true;
}
