// ══════════════ AJUSTEMENT PROPOSÉ : LA VITESSE CONTRE LA FOURCHETTE ════════
// Une PROPOSITION, jamais une application automatique. L'athlète décide, le
// coach voit. Rien ici ne touche vitesseAlerte, ni les couleurs d'évolution,
// ni les seuils de PHASES : on les LIT.
//
// Sens du pas, et c'est la seule règle à retenir : la vitesse mesurée est
// comparée à la fourchette de la phase, et
//   mesurée AU-DESSUS du max → on mange MOINS  (baisse de kcal)
//   mesurée EN DESSOUS du min → on mange PLUS   (hausse de kcal)
// La règle est la même en sèche et en prise de masse, parce que les bornes de
// la phase portent déjà le signe. Une sèche à −0,15 %/sem est au-dessus de son
// max (−0,5) : elle avance trop lentement, il faut baisser. Une prise de masse
// à +0,9 % est au-dessus de son max (+0,5) : elle va trop vite, il faut
// baisser aussi.
const AJUST_PAS=0.10;              // 10 % des kcal du jour concerné
const AJUST_VERROU_JOURS=14;       // jamais plus d'un ajustement par quinzaine
const AJUST_ECART_RELEVES=7;       // deux relevés espacés d'au moins sept jours

// ── Plancher calorique ─────────────────────────────────────────────────────
// Le provisoire — le métabolisme au repos — a été remplacé le jour où le coach
// a donné ses chiffres. Une seule définition désormais : plancherEffectif et
// plancherKcal, avec les constantes KCAL_PLANCHER_*. Voir le bloc PLANCHERS
// NUTRITIONNELS.

// ── La carte : le CONSTAT avant la proposition ─────────────────────────────
// L'ordre n'est pas cosmétique. Annoncer « −190 kcal » sans dire pourquoi, c'est
// une prescription ; dire d'abord ce qui est mesuré, c'est un raisonnement que
// l'athlète peut suivre et refuser.
function _fmtPct(v){ return (v>0?'+':'')+String(Math.round(v*100)/100).replace('.',','); }
function phraseRegimeMesure(a){
  if(!a) return '';
  if(a.regime==='etendu')
    return 'Vitesse estimée sur '+Math.round(PESEE_FENETRE_VIT_ETENDUE/7)+' semaines et '
      +(a.nPesees||0)+' pesées : moins précise, donc on corrige par petits pas.';
  return 'Vitesse mesurée sur '+PESEE_FENETRE_VIT+' jours.';
}
// Registre de TEXTE_ARRET_DRAPEAU : on décrit ce qu'on constate, on ne nomme
// aucune maladie, et on renvoie vers quelqu'un dont c'est le métier. Le mot
// « RED-S » n'apparaît nulle part, ni « syndrome », ni « diagnostic ».
const DEF_TEXTE_BLOCAGE='Tu as signalé deux mois sans règles, dans une période '
  +'de restriction et d\'entraînement soutenu. Ce n\'est pas quelque chose que '
  +'RepCore peut évaluer, et ce n\'est pas anodin : prends rendez-vous avec un '
  +'médecin. En attendant, je ne te proposerai plus de réduire tes apports.';
// Les critères sont nommés en clair, jamais comptés : aucun score chiffré ne
// descend jusqu'à l'athlète.
function messageDeficitVigilance(user){
  let r; try{ r=risqueDeficitEnergetique(user); }catch(e){ return ''; }
  if(!r||!r.criteres.length) return '';
  const l=r.criteres.map(c=>c.lib.toLowerCase());
  return 'Plusieurs éléments se cumulent en ce moment : '+l.join(', ')+'. '
    +'Je ne te proposerai pas de baisser davantage. C\'est un bon moment pour '
    +'en parler à ton coach.';
}
function _htmlDeficit(user,lectureSeule){
  let pal='aucun';
  try{ pal=paliersDeficit(user); }catch(e){}
  if(pal==='aucun') return '';
  const bloc=(pal==='blocage');
  const txt=bloc?DEF_TEXTE_BLOCAGE:messageDeficitVigilance(user);
  if(!txt) return '';
  const c=bloc?'var(--red)':'var(--orange)';
  return `<div style="background:var(--surface-1);border:1px solid ${c}55;border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:${c};text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">${bloc?'À faire vérifier':'Prudence'}</div>
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.75">${escapeHtml(txt)}</div>
    ${blocDisclaimerSante()}
  </div>`;
}
// N2.13 — L'historique de la derniere proposition, sorti de _htmlAjustement.
// Il y etait rendu apres quatre `return` et n'etait donc atteint que si aucune
// explication ne sortait. Fiche COACH uniquement : c'est lui qui doit voir ce
// que son athlete a fait de la proposition.
function _htmlDernierAjust(nut){
  const h=((nut&&nut.ajustHisto)||[]).slice(-1)[0];
  if(!h) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Dernier ajustement proposé</div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7">${dateLocaleDeCle(h.date).toLocaleDateString('fr-FR')} · ${h.sens==='baisse'?'baisse':'hausse'} de ${Math.abs(h.kcalDelta)} kcal les jours ${h.jour==='off'?'OFF':'ON'} (${_fmtPct(h.gDelta)} g de glucides) : vitesse mesurée ${_fmtPct(h.mesuree)} %/sem.<br><strong style="color:${h.decision==='applique'?'var(--success)':'var(--sub)'}">${h.decision==='applique'?'Appliqué par l\'athlète':'Refusé : il garde ses objectifs'}</strong></div>
  </div>`;
}
function _htmlAjustement(user,lectureSeule){
  const nut=(user&&user.nutrition)||{};
  // ORDRE DE PRIORITÉ, décidé et testé : le BLOCAGE remplace tout — il dit
  // déjà pourquoi rien n'est proposé et renvoie chez le médecin. La VIGILANCE,
  // elle, s'ajoute AU-DESSUS du message de plancher sans jamais le masquer :
  // les deux ne disent pas la même chose.
  let _pal='aucun';
  try{ _pal=paliersDeficit(user); }catch(e){}
  if(_pal==='blocage') return _htmlDeficit(user,lectureSeule);
  const _defHtml=(_pal==='vigilance')?_htmlDeficit(user,lectureSeule):'';
  const a=ajustementPropose(user);
  if(!a){
    // Pas de proposition : soit il n'y a rien à ajuster, soit le plancher
    // l'interdit. Le second cas se dit, il ne se tait pas.
    // La stagnation passe AVANT le plancher : quand les deux parlent, elle
    // explique POURQUOI le plancher bloque, et un renvoi médical vaut mieux
    // que « regarde ton sommeil ». Elle vient APRÈS le blocage de déficit,
    // testé plus haut, qui reste au-dessus de tout.
    // N2.13 — L'HISTORIQUE N'EST PLUS PRE-EMPTE. Il etait rendu tout en bas,
    // apres quatre `return` : des qu'une des explications sortait — et elles
    // sortent maintenant aussi cote coach — le coach perdait la trace de ce
    // que son athlete avait fait de la derniere proposition. Les deux
    // informations ne se remplacent pas, elles s'ajoutent.
    const _histo=lectureSeule?_htmlDernierAjust(nut):'';
    // N2.13 — LES TROIS GARDES !lectureSeule SONT TOMBES. Ces blocs disent
    // POURQUOI rien n'est propose : c'est exactement ce que le coach cherche
    // quand il ouvre le panneau et n'y trouve aucune proposition. Seuls les
    // boutons d'action restent a l'athlete — il n'y en a aucun ici.
    const _stagHtml=_htmlStagnation(user,lectureSeule);
    if(_stagHtml) return _defHtml+_stagHtml+_histo;
    const pl=_ajustPlancherAtteint(user);
    const _plDit=pl&&(pl.plancher!=null
      ?(pl.regle||'sous le plancher')+' ('+pl.plancher+' kcal)'
      :'sous le plancher');
    if(pl) return _defHtml+`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
      <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Rythme</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${lectureSeule
        ?`La ${escapeHtml(PHASES[(phaseCourante(user)||{}).type].apres)} avance plus lentement que visé, et aucune baisse n’est proposée : les cibles seraient ${escapeHtml(_plDit)}. Ce qui reste à regarder : sommeil, pas quotidiens, régularité, cause médicale.`
        :`Ta ${escapeHtml(PHASES[(phaseCourante(user)||{}).type].apres)} avance plus lentement que visé, mais je ne te propose pas de baisser : tu serais ${pl.plancher!=null?(pl.regle||'sous ton plancher')+' ('+pl.plancher+' kcal)':'sous ton plancher'}. On regarde ailleurs : sommeil, pas quotidiens, régularité, et s'il n'y a pas une cause médicale.`}</div>
      ${lectureSeule?'':blocDisclaimerSante()}
    </div>`+_histo;
    // Le plancher a la priorite : il vient d'etre teste juste au-dessus et rend
    // deja son propre bloc. L'adherence ne parle que si le plancher se tait.
    const _adhHtml=_htmlAdherenceRefus(user,lectureSeule);
    if(_adhHtml) return _defHtml+_adhHtml+_histo;
    if(_defHtml) return _defHtml+_histo;
    return _histo;
  }
  const ph=PHASES[a.phase]||{apres:'phase'};
  const jourLib=a.jour==='off'?'les jours OFF':'les jours d\'entraînement';
  const constat=`Ta ${escapeHtml(ph.apres)} avance à ${_fmtPct(a.mesuree)} % par semaine depuis ${a.semaines} semaine${a.semaines>1?'s':''}, la fourchette visée est ${_fmtPct(a.cible.min)} à ${_fmtPct(a.cible.max)} %.`;
  const propo=`Proposition : ${_fmtPct(a.kcalDelta)} kcal ${jourLib} (${_fmtPct(a.gDelta)} g de glucides).`;
  const regimeHtml=`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:6px">${escapeHtml(phraseRegimeMesure(a))}</div>`
    +(a.verifieParJournal?'':`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:4px">Proposé sans journal alimentaire pour le vérifier.</div>`);
  return `<div style="background:var(--dark);border:1px solid var(--surface-2);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Ajustement proposé</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7;margin-bottom:6px">${constat}</div>
    <div style="font-size:var(--fs-sm);color:var(--text);font-weight:800;line-height:1.6;margin-bottom:4px">${propo}</div>
    ${regimeHtml}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.6;margin-bottom:${lectureSeule?'0':'11px'}">Tes protéines et tes lipides ne changent pas. Un seul ajustement par quinzaine.</div>
    ${lectureSeule?'':`<div style="display:flex;gap:8px">
      <button class="btn btn-red btn-sm" style="flex:1;margin:0;letter-spacing:1px" onclick="appliquerAjustement()">Enregistrer</button>
      <button class="btn btn-outline btn-sm" style="flex:0 0 auto;margin:0;padding:0 14px;letter-spacing:1px;font-size:var(--fs-2xs)" onclick="refuserAjustement()">Garder comme ça</button>
    </div>`}
    ${lectureSeule?'':blocDisclaimerSante()}
  </div>`;
}
function _ajustJournaliser(a,decision){
  if(!currentUser.nutrition) currentUser.nutrition={};
  const n=currentUser.nutrition;
  if(!Array.isArray(n.ajustHisto)) n.ajustHisto=[];
  n.ajustHisto.push({date:Date.now(),sens:a.sens,jour:a.jour,kcalDelta:a.kcalDelta,
    gDelta:a.gDelta,mesuree:a.mesuree,regime:a.regime||'precis',decision});
  if(n.ajustHisto.length>12) n.ajustHisto=n.ajustHisto.slice(-12);
  // Le verrou de quinzaine part de la DÉCISION, acceptée ou refusée : dans les
  // deux cas l'athlète a répondu, on ne le relance pas avant quatorze jours.
  n.dernierAjustement=Date.now();
}
// Où revenir après la décision : l'écran Nutrition (par défaut), ou l'accueil
// quand elle vient du point de la semaine (lot N1).
function _ajustRetour(r){
  if(r==='accueil'){ try{ _rendrePointSemaine(); }catch(e){} return; }
  loadNutrition();
}
function appliquerAjustement(retour){
  const a=ajustementPropose(currentUser);
  if(!a){ toast('Cette proposition n\'est plus d\'actualité','var(--orange)'); _ajustRetour(retour); return; }
  const n=currentUser.nutrition;
  const cible=n.macros[a.jour]||{};
  // Seuls les glucides et le total bougent. Protéines et lipides sont recopiés
  // tels quels, pas recalculés : le contrat est qu'ils ne changent pas.
  n.macros[a.jour]=Object.assign({},cible,{
    kcal:a.apres.kcal,g:a.apres.g,p:cible.p,l:cible.l,
    f:Math.round(FIBRES_PAR_1000*a.apres.kcal/1000)});
  n.macros.origine='ajustement';
  n.macros.origineDate=Date.now();
  _ajustJournaliser(a,'applique');
  const ok=saveUser();
  toastEcriture(ok,'Objectifs ajustés '+ICO.coche,'l\'ajustement est');
  _ajustRetour(retour);
}
function refuserAjustement(retour){
  const a=ajustementPropose(currentUser);
  if(!a){ _ajustRetour(retour); return; }
  _ajustJournaliser(a,'refuse');
  const ok=saveUser();
  toastEcriture(ok,'C\'est noté, on garde comme ça','ton choix est');
  _ajustRetour(retour);
}
// ══ LOT N1 : LE POINT DE LA SEMAINE (29/09/2026) ═══════════════════════════
//
// Un rendez-vous, un jour fixe choisi par l'athlète (lundi par défaut), et une
// carte sur l'accueil CE JOUR-LÀ SEULEMENT : un rendez-vous qui traîne toute la
// semaine n'en est plus un. Elle lit la TENDANCE (moyenne des pesées des sept
// derniers jours), jamais la balance du matin, la compare à la fourchette de la
// phase, et dit en une phrase quoi faire.
//
// ⚠ ELLE NE RÉÉCRIT RIEN DE L'AJUSTEMENT. La proposition est ajustementPropose,
//   avec son pas (AJUST_PAS), son verrou (AJUST_VERROU_JOURS, qui part de la
//   DÉCISION, acceptée ou refusée) et toutes ses gardes : plancher, vigilance,
//   déficit, grossesse, pause, peak week, drapeau, écart au journal.
// ⚠ SOUS aTCA, PAS DE CARTE DU TOUT : même doctrine que la pesée du jour, qui
//   n'apparaît pas en mode neutre. Inviter chaque semaine à monter sur la
//   balance est précisément ce qu'on ne fait pas à quelqu'un qui a déclaré un
//   antécédent. Sous drapeau rouge, la carte reste INFORMATIVE : les chiffres,
//   aucun bouton, aucune proposition.
// ⚠ EN SÈCHE, LA HAUSSE RESTE : une sèche qui perd trop vite reçoit toujours la
//   proposition de remonter (c'est une protection). Les BAISSES, elles, restent
//   bridées par le plancher et la vigilance, comme partout.
const PTS_SEMAINE_MAX=52;
const PTS_JOURS=Object.freeze(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']);
// Le jour du rendez-vous, 0 = dimanche … 6 = samedi. Lundi par défaut.
function pointJourDe(u){
  const j=Number(u&&u.pointJour);
  return (Number.isInteger(j)&&j>=0&&j<=6)?j:1;
}
// PURE. Le rendez-vous est-il aujourd'hui ?
function estJourDuPoint(u,maintenant){
  return new Date(Number(maintenant)||Date.now()).getDay()===pointJourDe(u);
}
// PURE. Assez de pesées pour lire une semaine : deux au moins, la première et
// la dernière espacées de sept jours (AJUST_ECART_RELEVES).
function peseesSuffisantes(serie){
  const s=(serie||[]).filter(e=>e&&e.date);
  if(s.length<2) return false;
  return _joursEntre(s[0].date,s[s.length-1].date)>=AJUST_ECART_RELEVES;
}
// PURE. La moyenne d'une fenêtre de pesées, et sa date moyenne (en jours).
function _ptsFenetre(serie,debut,fin){
  const d=serie.filter(e=>e.date>=debut&&e.date<=fin);
  if(!d.length) return null;
  const kg=d.reduce((a,e)=>a+e.kg,0)/d.length;
  const ref=d[0].date;
  const jour=d.reduce((a,e)=>a+_joursEntre(ref,e.date),0)/d.length;
  return {kg,ref,jour,n:d.length};
}
/**
 * PURE. La vitesse de la semaine, en % par semaine : la moyenne des pesées des
 * sept derniers jours contre celle des sept jours d'avant. S'il n'y a rien
 * dans la semaine d'avant (un trou), on remonte jusqu'à la dernière semaine
 * pesée, sans dépasser PESEE_COUPURE_JOURS, et on ramène l'écart à sept
 * jours : un trou de trois semaines ne triple pas la vitesse.
 * Les dates sont des jours ISO : un changement d'heure ne décale rien.
 * @returns {{tendance:number,precedente:number,pct:number,kgSem:number,jours:number}|null}
 */
function vitesseSemaine(serie,jourISO){
  const s=(serie||[]).filter(e=>e&&e.date&&e.date<=jourISO&&e.kg>=PESEE_MIN&&e.kg<=PESEE_MAX)
    .slice().sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  if(s.length<2) return null;
  const fin=jourISO;
  const cur=_ptsFenetre(s,_jourPlus(fin,-(PESEE_FENETRE_MM-1)),fin);
  if(!cur) return null;
  let prec=null;
  for(let k=1;k*7<=PESEE_COUPURE_JOURS&&!prec;k++)
    prec=_ptsFenetre(s,_jourPlus(fin,-(PESEE_FENETRE_MM-1)-7*k),_jourPlus(fin,-7*k));
  if(!prec) return null;
  // L'écart réel entre les deux dates moyennes, en jours.
  const dj=_joursEntre(prec.ref,cur.ref)+cur.jour-prec.jour;
  if(!(dj>=3)) return null;
  const kgSem=(cur.kg-prec.kg)*7/dj;
  return {tendance:Math.round(cur.kg*10)/10,precedente:Math.round(prec.kg*10)/10,
    pct:Math.round(kgSem/prec.kg*100*100)/100,kgSem:Math.round(kgSem*100)/100,jours:Math.round(dj)};
}
/**
 * L'état de la carte, ou null quand elle ne parle pas. IMPURE : horloge, et
 * ajustementPropose lit l'horloge aussi.
 */
function etatPointSemaine(u,maintenant){
  if(!u||u.role==='coach') return null;
  const t=Number(maintenant)||Date.now();
  if(!estJourDuPoint(u,t)) return null;
  try{ if(aTCA(u)) return null; }catch(e){}
  const aujd=localISODate(new Date(t));
  // LOT N5 : SA pause (lancée depuis ce point) est terminée : on le demande,
  // elle ne s'arrête jamais d'elle-même.
  try{
    const _p=pauseActive(u);
    if(_p&&_p.origine==='fatigue'&&pauseTerminee(u,new Date(t))&&!drapeauQuelconqueActif(u))
      return {finPause:true,prolongeable:Number(_p.jours)+7<=PAUSE_JOURS_MAX,
        phrase:'Ta pause de '+_p.jours+' jours est terminée. On reprend ta sèche, ou une semaine de plus au maintien ?'};
  }catch(e){}
  const serie=serieVitesse(u);
  if(!peseesSuffisantes(serie)){
    const n=serie.length;
    return {manque:true,phrase:n
      ?'Il faut deux pesées à au moins sept jours d’écart pour lire ta semaine : pèse-toi ce matin, on fait le point la semaine prochaine.'
      :'Pas encore de pesée : pèse-toi ce matin, et on fait ton premier point la semaine prochaine.'};
  }
  const s=vitesseSemaine(serie,aujd);
  if(!s) return {manque:true,phrase:'Pas de pesée ces sept derniers jours : pèse-toi ce matin pour faire le point.'};
  // La vitesse de la proposition quand elle existe (même mesure que ce qui sera
  // proposé), sinon celle de la semaine.
  let fine=null; try{ fine=_vitesseAuJour(u,aujd); }catch(e){ fine=null; }
  const pct=(fine&&fine.pctSem!=null)?Math.round(fine.pctSem*100)/100:s.pct;
  const c=cibleVitesse(u);
  const cible=(c&&c.min!=null&&c.max!=null)?{min:Math.min(c.min,c.max),max:Math.max(c.min,c.max),lib:c.lib||''}:null;
  let drapeau=false; try{ drapeau=drapeauQuelconqueActif(u); }catch(e){}
  let a=null; try{ a=drapeau?null:ajustementPropose(u); }catch(e){ a=null; }
  // LOT N5 : la faim et l'énergie des quatorze derniers jours, en sèche. Un
  // signal de fatigue ne mène qu'à stabiliser ou à remonter.
  let fatigue=0, pause=null, retenue=false, stable=false;
  try{ fatigue=fatigueDiete(u.checkin,phaseCourante(u),t); }catch(e){ fatigue=0; }
  if(fatigue>0&&!drapeau&&!pauseActive(u)){
    let dep=null; try{ const b=besoinsProposes(u); dep=b&&b.depense; }catch(e){ dep=null; }
    const pf=propositionFatigue(fatigue,a,(u.nutrition||{}).macros,dep);
    if(pf&&pf.type==='pause'){ pause=pf; a=null; }
    else if(pf&&pf.type==='garde'){ retenue=pf.retenue; stable=fatigue>=3; a=null; }
  }
  const der=Number(((u.nutrition)||{}).dernierAjustement)||0;
  const verrouJ=der?Math.max(0,Math.ceil((der+AJUST_VERROU_JOURS*864e5-t)/864e5)):0;
  const cote=cible?(pct>cible.max?'haut':(pct<cible.min?'bas':'dedans')):null;
  const phrase=pause
    ?'Ta faim est haute et ton énergie basse depuis deux semaines : je te propose une pause au maintien, de 7 à 14 jours.'
    :stable
    ?'Ta faim est haute et ton énergie basse depuis deux semaines, et tes objectifs sont déjà à ton maintien : on ne baisse rien. Regarde d’abord ton sommeil et tes protéines.'
    :retenue
    ?'Ça avance plus lentement que visé, mais ta faim et ton énergie disent que tu tires déjà : on ne baisse pas cette semaine.'
    :phrasePointSemaine({cote,a,drapeau,verrouJ,phase:(phaseCourante(u)||{}).type,
    plancher:(()=>{ try{ return !!_ajustPlancherAtteint(u); }catch(e){ return false; } })()});
  return {tendance:s.tendance,pct,cible,cote,a,drapeau,phrase,jour:aujd,fatigue,pause};
}
// PURE. UNE phrase, qui dit quoi faire. Jamais un tableau à interpréter.
function phrasePointSemaine(o){
  const seche=o.phase==='seche';
  if(!o.cote) return 'Choisis ta phase (sèche, masse ou maintien) : c’est elle qui dit si ce rythme te va.';
  if(o.drapeau) return o.cote==='dedans'
    ?'Tu es dans ta fourchette. Rien à changer cette semaine ; on reparle des objectifs avec ton coach.'
    :'On ne touche pas à tes objectifs en ce moment : parles-en d’abord à ton coach.';
  if(o.cote==='dedans') return 'Tu es dans ta fourchette : on ne change rien, continue comme ça.';
  if(o.a){
    const jours=o.a.jour==='off'?'les jours de repos':'les jours d’entraînement';
    return (o.a.sens==='baisse'?'Ça avance plus lentement que visé':'Ça va plus vite que visé')
      +' : je te propose '+_fmtPct(o.a.kcalDelta)+' kcal '+jours+'.';
  }
  if(o.cote==='haut'&&seche&&o.plancher)
    return 'Ça avance plus lentement que visé, mais baisser te ferait passer sous ton plancher : ajoute plutôt des pas chaque jour.';
  if(o.verrouJ>0) return 'Pas dans la fourchette cette semaine, mais on a ajusté il y a peu : on attend encore '
    +o.verrouJ+' jour'+(o.verrouJ>1?'s':'')+' avant de revoir, garde le cap.';
  return 'Pas dans la fourchette cette semaine : on attend une deuxième semaine pour confirmer avant de toucher à quoi que ce soit.';
}
// PURE. La jauge : la fourchette en bande, la vitesse en point.
function htmlJaugePointSemaine(pct,cible){
  const lo=Math.min(-1.2,pct-0.3,cible?cible.min-0.3:0), hi=Math.max(1.2,pct+0.3,cible?cible.max+0.3:0);
  const X=v=>Math.round((v-lo)/(hi-lo)*1000)/10;
  const dedans=cible&&pct>=cible.min&&pct<=cible.max;
  return '<div class="ps-jauge" role="img" aria-label="Vitesse '+escapeHtml(_fmtPct(pct))+' % par semaine'
      +(cible?(', fourchette visée '+escapeHtml(_fmtPct(cible.min))+' à '+escapeHtml(_fmtPct(cible.max))+' %'):'')+'">'
    +'<div class="ps-rail"></div>'
    +(cible?'<div class="ps-bande" style="left:'+X(cible.min)+'%;width:'+(X(cible.max)-X(cible.min))+'%"></div>':'')
    +'<div class="ps-zero" style="left:'+X(0)+'%"></div>'
    +'<div class="ps-point'+(dedans?' ps-dedans':'')+'" style="left:'+X(pct)+'%"><span>'+escapeHtml(_fmtPct(pct))+' %</span></div>'
    +'</div>'
    +(cible?'<div class="ps-leg"><span>Visé : '+escapeHtml(_fmtPct(cible.min))+' à '+escapeHtml(_fmtPct(cible.max))+' % par semaine</span></div>':'');
}
// PURE. « Ce que j'ai vraiment tenu » : la vitesse de chaque point, et la
// fourchette de chaque semaine derrière. Rien sous deux points.
function htmlCourbeTenue(points,classe){
  const l=(points||[]).filter(p=>p&&isFinite(p.pct)).slice(-12);
  if(l.length<2) return '';
  const vals=l.flatMap(p=>[p.pct].concat(p.min!=null?[p.min,p.max]:[]));
  const lo=Math.min(...vals,0)-0.2, hi=Math.max(...vals,0)+0.2;
  const W=300,H=70, x=i=>6+i*(W-12)/(l.length-1), y=v=>4+(1-(v-lo)/(hi-lo))*(H-8);
  let bandes='';
  l.forEach((p,i)=>{ if(p.min==null) return;
    const x0=i?(x(i-1)+x(i))/2:0, x1=i<l.length-1?(x(i)+x(i+1))/2:W;
    bandes+='<rect x="'+x0.toFixed(1)+'" y="'+y(p.max).toFixed(1)+'" width="'+(x1-x0).toFixed(1)+'" height="'+Math.max(1,y(p.min)-y(p.max)).toFixed(1)+'" class="ps-t-bande"/>'; });
  const pts=l.map((p,i)=>x(i).toFixed(1)+','+y(p.pct).toFixed(1)).join(' ');
  const dans=l.filter(p=>p.min!=null&&p.pct>=p.min&&p.pct<=p.max).length;
  return '<div class="'+(classe||'ps-tenue')+'"><div class="ps-t-t">Ce que tu as vraiment tenu</div>'
    +'<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="'+l.length+' semaines, dans la fourchette '+dans+' fois">'
    +bandes+'<line x1="0" x2="'+W+'" y1="'+y(0).toFixed(1)+'" y2="'+y(0).toFixed(1)+'" class="ps-t-zero"/>'
    +'<polyline points="'+pts+'" class="ps-t-l"/>'
    +l.map((p,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.pct).toFixed(1)+'" r="3" class="ps-t-p'+(p.min!=null&&p.pct>=p.min&&p.pct<=p.max?' ps-t-in':'')+'"/>').join('')
    +'</svg><div class="ps-t-s">'+l.length+' semaines · dans la fourchette '+dans+' fois</div></div>';
}
// La mémoire : un point par rendez-vous, au plus 52. Réécrire la décision du
// même jour, jamais dupliquer le point.
function enregistrerPointSemaine(u,e,decision){
  if(!u||!e||e.manque) return false;
  if(!Array.isArray(u.pointsSemaine)) u.pointsSemaine=[];
  const l=u.pointsSemaine;
  let p=l.find(x=>x&&x.date===e.jour);
  const nouveau=!p;
  if(!p){ p={date:e.jour,pct:e.pct,tendance:e.tendance,min:e.cible?e.cible.min:null,max:e.cible?e.cible.max:null,decision:'vu'}; l.push(p); }
  if(decision&&p.decision!==decision){ p.decision=decision; if(e.a) p.proposition={sens:e.a.sens,kcal:e.a.kcalDelta,jour:e.a.jour}; }
  else if(!nouveau) return false;
  if(l.length>PTS_SEMAINE_MAX) u.pointsSemaine=l.slice(-PTS_SEMAINE_MAX);
  return true;
}
function htmlPointSemaine(e,u){
  if(!e) return '';
  const jour=pointJourDe(u);
  const choixJour='<label class="ps-rdv">Mon point : <select onchange="pointJourChoisir(this.value)" aria-label="Jour du point de la semaine">'
    +PTS_JOURS.map((n,i)=>'<option value="'+i+'"'+(i===jour?' selected':'')+'>'+n+'</option>').join('')+'</select></label>';
  if(e.finPause) return '<div class="ps-carte" id="ps-carte"><div class="ps-tete">Ton point de la semaine</div>'
    +'<p class="ps-phrase">'+escapeHtml(e.phrase)+'</p>'
    +'<div class="ps-btns"><button type="button" class="btn btn-red btn-sm" onclick="finPauseFatigue(\'reprendre\')">Je reprends ma sèche</button>'
    +(e.prolongeable?'<button type="button" class="btn btn-outline btn-sm" onclick="finPauseFatigue(\'prolonger\')">Une semaine de plus</button>':'')+'</div>'
    +choixJour+'</div>';
  if(e.manque) return '<div class="ps-carte" id="ps-carte"><div class="ps-tete">Ton point de la semaine</div>'
    +'<p class="ps-phrase">'+escapeHtml(e.phrase)+'</p>'
    +'<button type="button" class="btn btn-red btn-sm ps-btn" onclick="ouvrirPeseeAccueil()">Me peser</button>'+choixJour+'</div>';
  const boutons=(e.a&&!e.drapeau)
    ?'<div class="ps-btns"><button type="button" class="btn btn-red btn-sm" onclick="pointSemaineDecider(\'applique\')">J’applique</button>'
      +'<button type="button" class="btn btn-outline btn-sm" onclick="pointSemaineDecider(\'garde\')">Je garde comme ça</button></div>':'';
  return '<div class="ps-carte" id="ps-carte"><div class="ps-tete">Ton point de la semaine</div>'
    +'<div class="ps-tendance"><b>'+escapeHtml(String(e.tendance).replace('.',','))+' kg</b><span>ta tendance sur sept jours</span></div>'
    +'<div class="ps-note">On lit la tendance, pas la balance du matin.</div>'
    +htmlJaugePointSemaine(e.pct,e.cible)
    +'<p class="ps-phrase">'+escapeHtml(e.phrase)+'</p>'+(e.pause&&!e.drapeau?htmlPauseFatigue(e):boutons)
    +htmlCourbeTenue((u&&u.pointsSemaine)||[])+choixJour+'</div>';
}
function _rendrePointSemaine(){
  const z=document.getElementById('clh-point-semaine');
  if(!z) return null;
  const u=currentUser;
  let e=null; try{ e=etatPointSemaine(u,Date.now()); }catch(err){ e=null; }
  if(e&&!e.manque){ try{ if(enregistrerPointSemaine(u,e,null)) saveUser(); }catch(err){ rcErreurMuette('_rendrePointSemaine',err); } }
  z.innerHTML=htmlPointSemaine(e,u);
  return e;
}
// Les deux boutons : l'ajustement EXISTANT, et la décision gardée dans le point.
function pointSemaineDecider(d){
  const u=currentUser;
  let e=null; try{ e=etatPointSemaine(u,Date.now()); }catch(err){ e=null; }
  if(e) enregistrerPointSemaine(u,e,d==='applique'?'applique':'garde');
  if(e&&(e.pause||(!e.a&&d!=='applique'))){
    toastEcriture(saveUser(),'C’est noté, on garde comme ça','ton choix est');
    _rendrePointSemaine();
    return;
  }
  if(d==='applique') appliquerAjustement('accueil'); else refuserAjustement('accueil');
}
function pointJourChoisir(v){
  const j=Number(v);
  if(!(Number.isInteger(j)&&j>=0&&j<=6)||!currentUser) return false;
  currentUser.pointJour=j;
  const ok=saveUser();
  toastEcriture(ok,'Ton point de la semaine : le '+PTS_JOURS[j],'le jour est');
  _rendrePointSemaine();
  return true;
}
// Côté coach, EN PREMIER sur la fiche nutrition : ce que l'athlète a vraiment
// tenu, et ce qu'il a fait du dernier point.
function htmlPointsSemaineCoach(c){
  const l=((c&&c.pointsSemaine)||[]).filter(Boolean);
  if(!l.length) return '';
  const der=l[l.length-1];
  const dec={applique:'a appliqué la proposition',garde:'a gardé ses objectifs',vu:'a lu son point',
    pause:'a lancé une pause au maintien (faim haute, énergie basse)'}[der.decision]||'a lu son point';
  const d=new Date(der.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  return '<div class="ps-coach"><div class="ps-tete">Ses points de la semaine</div>'
    +'<div class="ps-c-der">Le '+escapeHtml(d)+' : '+escapeHtml(_fmtPct(der.pct))+' % par semaine'
    +(der.min!=null?' (visé '+escapeHtml(_fmtPct(der.min))+' à '+escapeHtml(_fmtPct(der.max))+')':'')+', il '+escapeHtml(dec)+'.</div>'
    +htmlCourbeTenue(l,'ps-tenue ps-tenue-c').replace('Ce que tu as vraiment tenu','Ce qu’il a vraiment tenu')+'</div>';
}

// Vitesse telle qu'elle était à une date donnée : on tronque la série et on
// rejoue la MÊME régression. Aucun relevé n'est stocké, rien à migrer, et les
// garde-fous PESEE_VIT_MIN_PTS et PESEE_MM_MIN s'appliquent tels quels
// puisqu'on passe par vitesseHebdo.
function _vitesseAuJour(user,jourISO){
  try{
    const s=serieVitesse(user).filter(e=>e&&e.date<=jourISO);
    // Le regime PRECIS d'abord, toujours. Le regime etendu n'est pas une
    // alternative offerte : c'est un repli quand la mesure fine est
    // impossible, et il se paie en pas reduit et en verrou allonge.
    const fine=vitesseHebdo(s);
    if(fine) return fine;
    return vitesseHebdoEtendue(s,jourISO);
  }catch(e){ return null; }
}

// ══════════════════════ ADHÉRENCE AU JOURNAL ══════════════════════
// ajustementPropose modifiait l'OBJECTIF quand la vitesse ne suivait pas, sans
// jamais regarder si l'objectif était SUIVI. Il pouvait donc baisser une cible
// déjà dépassée de 450 kcal par jour — corriger le plan quand c'est l'écart au
// plan qui explique tout.
//
// Aucun score, aucune série de jours réussis, aucun badge : on constate un écart
// moyen sur une fenêtre, et on s'en sert pour SUSPENDRE une proposition
// automatique, pas pour noter quelqu'un.
const ADH_FENETRE_JOURS=14;
const ADH_JOURS_MIN=8;            // en dessous, aucune conclusion
const ADH_ECART_PART=0.10;        // 10 % de la cible
// PURE. Rend {nJours, couverture, ecartKcal, ecartProt, cibleMoyenne} ou null.
//
// La cible du jour vient de _getEffectiveMacros — JAMAIS d'un recalcul local.
// Deux chemins vers la même cible divergeraient à la première évolution du
// cycle glucidique ou de l'adaptation de cycle, et l'écart mesuré deviendrait
// un artefact de la divergence.
function adherence(user,finISO){
  const nut=(user&&user.nutrition)||{};
  const log=nut.log||{};
  if(!nut.macros) return null;
  const fin=finISO||localISODate(new Date());
  let n=0, sKcal=0, sProt=0, sCible=0;
  for(let i=0;i<ADH_FENETRE_JOURS;i++){
    const j=_jourPlus(fin,-i);
    const e=(log[j]&&log[j].entries)||[];
    if(!e.length) continue;
    const realise=e.reduce((a,x)=>({
      kcal:a.kcal+(Number(x&&x.kcal)||0),p:a.p+(Number(x&&x.p)||0)}),{kcal:0,p:0});
    // Un jour est « journalisé » s'il porte de vraies calories. Une entrée à
    // zéro kcal — un thé, une erreur de saisie — ne fait pas une journée suivie.
    if(!(realise.kcal>0)) continue;
    // LE PORTEUR, jusqu’au bout. `user` est un CLIENT quand cette fonction est
    // appelée depuis _htmlAdherenceCoach ou ajustementPropose : sans lui, les
    // jours ON étaient ceux du coach, et l’écart affiché s’en trouvait faux.
    const cible=_getEffectiveMacros(nut,nutIsOnDay(j,user),j,user);
    // Cible absente ce jour-là : le jour ne dit rien d'un écart, il sort du
    // calcul plutôt que de compter comme un écart de la taille du réalisé.
    if(!cible||!(Number(cible.kcal)>0)) continue;
    n++;
    sKcal+=realise.kcal-Number(cible.kcal);
    sProt+=realise.p-(Number(cible.p)||0);
    sCible+=Number(cible.kcal);
  }
  if(!n) return null;
  return {nJours:n,
    couverture:Math.round(n/ADH_FENETRE_JOURS*100)/100,
    ecartKcal:Math.round(sKcal/n),
    ecartProt:Math.round(sProt/n),
    cibleMoyenne:Math.round(sCible/n)};
}
// Vrai quand la couverture suffit ET que l'écart dépasse le seuil.
function _adherenceEcarte(adh){
  return !!(adh&&adh.nJours>=ADH_JOURS_MIN
    &&Math.abs(adh.ecartKcal)>adh.cibleMoyenne*ADH_ECART_PART);
}
// Refus MOTIVÉ, exposé séparément — exactement comme _ajustPlancherAtteint.
//
// ajustementPropose continue de rendre null : ses trois appelants consomment son
// retour comme une proposition dès qu'il est truthy, et appliquerAjustement lit
// a.jour puis a.apres.kcal. Un objet de refus y aurait ecrit une cle parasite
// dans les macros avant de lever une exception. Le refus doit etre AFFICHABLE,
// pas RETOURNE par la fonction qui alimente le bouton « Appliquer ».
function _ajustAdherenceBloque(user,finISO){
  if(!user) return null;
  // L'ordre compte : les garde-fous qui ETEIGNENT tout passent avant. Un
  // athlete sous drapeau rouge, en pause, ou avec un antecedent declare n'a
  // pas de proposition — donc rien a refuser, et rien a expliquer.
  try{ if(drapeauQuelconqueActif(user)) return null; }catch(e){}
  try{ if(aTCA(user)) return null; }catch(e){}
  try{ if(pauseActive(user)) return null; }catch(e){}
  const nut=user.nutrition||{};
  if(!nut.macros) return null;
  if(!phaseCourante(user)) return null;
  const adh=adherence(user,finISO);
  if(!_adherenceEcarte(adh)) return null;
  return {refus:'adherence',adh};
}
// ══════ STAGNATION INEXPLIQUÉE ══════
// Face à une perte qui s'arrête, le produit ne savait que RÉDUIRE : −10 %,
// puis « on regarde ailleurs — sommeil, pas quotidiens, régularité ». Trois
// causes possibles, aucune médicale. Or si les apports sont suivis et que le
// poids ne bouge pas, continuer à descendre n'est pas une réponse.
//
// AUCUNE déclaration n'est requise : c'est le point central. La règle se
// déclenche sur ce qui est MESURÉ, chez quelqu'un qui n'a rien déclaré.
const THY_SEM_MIN=8;
const THY_VITESSE_PLATE=0.15;      // %/semaine, en valeur absolue
// Aligné sur ADH_JOURS_MIN, et non recopié : deux seuils de couverture qui
// divergeraient rendraient les deux refus incohérents entre eux.
const THY_ADH_JOURS_MIN=ADH_JOURS_MIN;
const THY_ADH_ECART_MAX=0.10;
// PURE. Toutes les conditions sont cumulatives, et une donnée manquante rend
// false : on n'accuse pas une stagnation sans savoir ce qui est mangé.
function stagnationInexpliquee(user,finISO){
  try{
    const ph=phaseCourante(user);
    if(!ph||ph.type!=='seche') return false;
    const sem=semainesEcoulees(user);
    if(sem==null||sem<THY_SEM_MIN) return false;
    const j=finISO||localISODate(new Date());
    const adh=adherence(user,j);
    if(!adh||adh.nJours<THY_ADH_JOURS_MIN) return false;
    if(!(adh.cibleMoyenne>0)) return false;
    if(Math.abs(adh.ecartKcal)>adh.cibleMoyenne*THY_ADH_ECART_MAX) return false;
    // QUATRE semaines, donc le régime étendu explicitement : _vitesseAuJour
    // privilégie la fenêtre de quatorze jours, trop courte pour juger d'un
    // plateau.
    const v=vitesseHebdoEtendue(serieVitesse(user),j);
    if(!v||v.pctSem==null) return false;
    return Math.abs(v.pctSem)<THY_VITESSE_PLATE;
  }catch(e){ return false; }
}
// Refus MOTIVÉ, exposé séparément — exactement comme _ajustAdherenceBloque et
// pour la même raison, déjà démontrée : appliquerAjustement lit a.jour puis
// a.apres.kcal, et un objet de refus y est TRUTHY. Il écrirait une clé
// parasite dans les macros avant de lever une exception. La spécification
// demandait ce retour en invoquant le lot d'adhérence comme précédent — c'est
// précisément le design que ce lot-là avait essayé, prouvé cassant, et rejeté.
function _ajustStagnationBloque(user,finISO){
  if(!user) return null;
  // Même ordre de garde-fous que le refus d'adhérence : ce qui ÉTEINT toute
  // proposition passe avant. Rien à refuser là où rien n'est proposé.
  try{ if(drapeauQuelconqueActif(user)) return null; }catch(e){}
  try{ if(aTCA(user)) return null; }catch(e){}
  try{ if(pauseActive(user)) return null; }catch(e){}
  try{ if(paliersDeficit(user)==='blocage') return null; }catch(e){}
  // L'ADHÉRENCE passe devant : il faut d'abord suivre le plan avant de
  // chercher une cause médicale. Garde de principe — avec les constantes
  // actuelles les deux sont mutuellement exclusifs, l'un exigeant un écart
  // SUPÉRIEUR à 10 % et l'autre INFÉRIEUR ou égal. Elle tient si l'un des
  // deux seuils bouge un jour.
  try{ if(_ajustAdherenceBloque(user,finISO)) return null; }catch(e){}
  const nut=user.nutrition||{};
  if(!nut.macros) return null;
  if(!phaseCourante(user)) return null;
  if(!stagnationInexpliquee(user,finISO)) return null;
  return {refus:'stagnation_inexpliquee',adh:adherence(user,finISO),
    semaines:semainesEcoulees(user)};
}
// Sans nommer AUCUNE pathologie. « Ce n'est pas ta faute » n'est pas une
// politesse : c'est la correction d'un produit qui, jusqu'ici, ne pouvait
// répondre à une stagnation qu'en demandant de manger encore moins.
const THY_TEXTE_ATHLETE='Tes apports sont suivis et ton poids ne bouge pas. '
  +'Ce n\'est pas normal, et ce n\'est pas ta faute. Avant de descendre plus '
  +'bas, parles-en à un médecin : il existe des causes médicales à ça.';
// N2.13 — LE MEME CONSTAT, DIT A UN PROFESSIONNEL. Meme declencheur, meme
// conclusion : c'est la formulation qui change, pas le fond. Le coach n'a pas
// besoin d'etre rassure, il a besoin de savoir POURQUOI aucun ajustement n'est
// propose — et que c'est un renvoi medical, pas un oubli de l'application.
const THY_TEXTE_COACH='Apports suivis et poids stable : aucun ajustement n’est '
  +'proposé. Descendre encore n’aurait pas de sens tant qu’une cause médicale '
  +'n’a pas été écartée. C’est le message que ton athlète lit de son côté.';
function _htmlStagnation(user,lectureSeule){
  const r=_ajustStagnationBloque(user);
  if(!r) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--orange)55;border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--orange);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Rythme</div>
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.75">${escapeHtml(lectureSeule?THY_TEXTE_COACH:THY_TEXTE_ATHLETE)}</div>
    ${lectureSeule?'':blocDisclaimerSante()}
  </div>`;
}
// Le texte dit l'écart DANS SON SENS. « Tu manges plus que prévu » et « tu manges
// moins que prévu » n'appellent pas la même conversation, et une seule phrase
// pour les deux serait fausse dans un cas sur deux.
function phraseAdherence(adh,coach){
  if(!adh) return '';
  const sur=adh.ecartKcal>0;
  const n=Math.abs(adh.ecartKcal);
  // N2.13 — la version du coach dit le MEME ecart, sans le tutoiement ni
  // l'invitation a en parler : c'est lui qui va ouvrir la conversation.
  if(coach) return 'La vitesse ne suit pas la cible, mais les apports sont en '
    +'moyenne '+(sur?'+':'−')+n+' kcal '+(sur?'au-dessus':'en dessous')
    +' des objectifs sur les '+adh.nJours+' jour'+(adh.nJours>1?'s':'')
    +' journalisé'+(adh.nJours>1?'s':'')+'. Aucun ajustement n’est proposé : '
    +'modifier la cible ne corrigerait pas l’écart.';
  return 'Ta vitesse ne suit pas la cible, mais tu es en moyenne '
    +(sur?'+':'−')+n+' kcal '+(sur?'au-dessus':'en dessous')
    +' de tes objectifs sur les '+adh.nJours+' jours que tu as journalisés. '
    +'Modifier l\'objectif ne servirait à rien. On regarde l\'écart ensemble '
    +'avant de toucher aux chiffres.';
}
// Côté ATHLÈTE, ce bloc est MASQUÉ sous antécédent alimentaire déclaré — même
// prudence que renderCartePesee, qui masque la pesée dans ce cas. Un écart
// chiffré à ses objectifs est exactement ce qu'on ne met pas sous les yeux de
// quelqu'un qui a déclaré un antécédent.
function _htmlAdherenceRefus(user,lectureSeule){
  const r=_ajustAdherenceBloque(user);
  if(!r) return '';
  if(!lectureSeule){
    let tca=false; try{ tca=aTCA(user); }catch(e){}
    if(tca) return '';
  }
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);text-transform:uppercase;letter-spacing:2px;font-weight:700;margin-bottom:8px">Rythme</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(phraseAdherence(r.adh,!!lectureSeule))}</div>
    ${lectureSeule?'':blocDisclaimerSante()}
  </div>`;
}
// ── Fiche coach ─────────────────────────────────────────────────────────────
// TOUJOURS affichée au coach, y compris sous antécédent : c'est lui qui doit
// voir l'écart pour en parler, et c'est précisément le cas où il doit le voir.
const ADH_CHEAT_REPLI='4 ou plus';
const ADH_CHEAT_BILANS=3;
function _htmlAdherenceCoach(c){
  const adh=adherence(c);
  if(adh){
    const s=adh.ecartKcal>0?'+':'−';
    const sp=adh.ecartProt>0?'+':'−';
    return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Adhérence</div>
      <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">${adh.nJours} jour${adh.nJours>1?'s':''} journalisé${adh.nJours>1?'s':''} sur ${ADH_FENETRE_JOURS}, ${s}${Math.abs(adh.ecartKcal)} kcal en moyenne, protéines ${sp}${Math.abs(adh.ecartProt)} g.</div>
    </div>`;
  }
  // Repli : aucun jour journalisé, mais l'athlète a déclaré des repas hors
  // programme dans ses trois derniers bilans de suivi. Un CONSTAT, pas un
  // jugement — et surtout pas un chiffre, puisqu'on n'en a aucun.
  const suivis=((c&&c.bilans)||[]).filter(b=>b&&b.type==='suivi'&&b.date)
    .slice().sort((a,b)=>b.date-a.date).slice(0,ADH_CHEAT_BILANS);
  if(suivis.length<ADH_CHEAT_BILANS) return '';
  const tous=suivis.every(b=>_texteReponse(b['bil-cheat-meals'])===ADH_CHEAT_REPLI);
  if(!tous) return '';
  return `<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:4px">Adhérence</div>
    <div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">Aucun jour journalisé sur ${ADH_FENETRE_JOURS}, et « ${escapeHtml(ADH_CHEAT_REPLI)} » repas hors programme déclarés aux ${ADH_CHEAT_BILANS} derniers bilans.</div>
  </div>`;
}

function ajustementPropose(user){
  if(!user) return null;
  // Drapeau rouge, quelle que soit sa famille : aucune proposition automatique.
  // Suggérer de manger moins à quelqu'un qui décrit une oppression thoracique
  // reviendrait à l'aider à continuer.
  try{ if(drapeauQuelconqueActif(user)) return null; }catch(e){}
  const nut=user.nutrition||{};
  // Sans objectif chiffré, il n'y a rien à ajuster.
  if(!nut.macros) return null;
  const p=phaseCourante(user);
  if(!p) return null;
  // ⚠ PEAK WEEK : AUCUNE PROPOSITION, DANS AUCUN SENS. L'ajustement se calcule
  // sur la vitesse mesuree a la balance, et pendant cette semaine-la la balance
  // suit l'eau et le glycogene. Proposer « −300 kcal, tu montes trop vite » a
  // quelqu'un qui charge ses glucides serait defaire le travail de son coach a
  // partir d'une mesure qui ne mesure rien. Meme famille de garde que la pause
  // ou la grossesse, juste en dessous.
  if(p.type==='peak') return null;
  // Garde-fou TCA : en sèche déclarée avec antécédent, l'athlète n'a ni
  // vitesse ni cible ni alerte. Lui proposer de manger moins serait
  // exactement ce que ce garde-fou existe pour empêcher.
  try{ if(aTCA(user)) return null; }catch(e){}
  // Déficit énergétique au palier de blocage : MÊME effet que l'antécédent
  // alimentaire, et pour la même raison. La vigilance, elle, ne coupe que les
  // BAISSES — elle est appliquée plus bas, une fois le sens connu.
  try{ if(paliersDeficit(user)==='blocage') return null; }catch(e){}
  // Grossesse ou allaitement : aucune proposition, dans AUCUN sens. Faire
  // monter les calories serait aussi une prescription, et ce n'est pas ici
  // que ça se décide.
  try{ if(grossesseSuspend(user)) return null; }catch(e){}
  // Meme motif pendant une pause : elle EST l'ajustement en cours. En proposer
  // un second par-dessus reviendrait a corriger une vitesse qu'on a
  // volontairement suspendue.
  try{ if(pauseActive(user)) return null; }catch(e){}
  // Adherence : modifier l'OBJECTIF quand c'est l'ecart au plan qui explique
  // la vitesse ne sert a rien. On se tait ici, et _ajustAdherenceBloque dit
  // POURQUOI a l'ecran — meme registre que le plancher.
  const _aujdAdh=localISODate(new Date());
  const _adh=adherence(user,_aujdAdh);
  if(_adherenceEcarte(_adh)) return null;
  // Apports suivis et poids immobile : proposer de descendre encore serait
  // exactement la mauvaise reponse. _ajustStagnationBloque dit POURQUOI a
  // l'ecran, ici on se tait.
  try{ if(stagnationInexpliquee(user,_aujdAdh)) return null; }catch(e){}
  const cible=cibleVitesse(user);
  if(cible.min==null||cible.max==null) return null;
  // Un seul ajustement par quinzaine, accepté OU refusé.
  // Le verrou depend du regime des releves, qu'on ne connait qu'apres les
  // avoir lus : on lit d'abord, on verrouille ensuite.
  const der=Number(nut.dernierAjustement)||0;

  // DEUX relevés, espacés d'au moins sept jours, tous deux hors fourchette et
  // du même côté. Un seul relevé, c'est du bruit.
  const aujd=localISODate(new Date());
  const v1=_vitesseAuJour(user,aujd);
  const v2=_vitesseAuJour(user,_jourPlus(aujd,-AJUST_ECART_RELEVES));
  if(!v1||v1.pctSem==null||!v2||v2.pctSem==null) return null;
  const cote=v=>v.pctSem>cible.max?'haut':(v.pctSem<cible.min?'bas':null);
  const c1=cote(v1), c2=cote(v2);
  if(!c1||c1!==c2) return null;
  // Regimes DIFFERENTS : on retient le plus prudent des deux, pas reduit ET
  // verrou long. Un athlete qui passe de l'etendu au precis ne doit pas
  // recevoir deux corrections en quatorze jours parce que sa mesure s'est
  // affinee entre-temps.
  const etendu=(v1.regime==='etendu')||(v2.regime==='etendu');
  const pas=etendu?AJUST_PAS_ETENDU:AJUST_PAS;
  const verrou=etendu?AJUST_VERROU_JOURS_ETENDU:AJUST_VERROU_JOURS;
  if(der&&Date.now()-der<verrou*864e5) return null;

  // Le jour visé : on freine sur les jours de REPOS et on relance sur les
  // jours d'entraînement. Couper le carburant d'une séance pour ralentir une
  // sèche est le plus mauvais endroit où couper.
  const sens=c1==='haut'?'baisse':'hausse';
  const jour=sens==='baisse'?'off':'on';
  const base=(nut.macros[jour])||(nut.macros.on)||(nut.macros.off)||{};
  const kcal=Number(base.kcal), pr=Number(base.p), li=Number(base.l), gl=Number(base.g);
  if(!(kcal>0)||!isFinite(pr)||!isFinite(li)||!isFinite(gl)) return null;

  // Le pas est porté ENTIÈREMENT par les glucides. Protéines et lipides ne
  // bougent pas : c'est le contrat.
  const kcalDelta=(sens==='baisse'?-1:1)*Math.round(kcal*pas);
  const gDelta=Math.round(kcalDelta/4);
  const gApres=gl+gDelta;
  if(gApres<0) return null;
  const kcalApres=Math.round(4*pr+9*li+4*gApres);

  // PRIORITÉ ABSOLUE : le plancher. Sans plancher calculable, aucune baisse.
  if(sens==='baisse'){
    // Vigilance : plusieurs faits se cumulent. On ne descend plus. Une HAUSSE
    // reste possible — c'est même souvent ce dont l'athlète a besoin.
    try{ if(paliersDeficit(user)!=='aucun') return null; }catch(e){}
    const pl=plancherKcal(user);
    if(pl==null||kcalApres<pl) return null;
  }

  const jours=_joursEntre(_jourPlus(aujd,-(PESEE_FENETRE_VIT+AJUST_ECART_RELEVES-1)),aujd);
  return {sens,pct:Math.round(pas*100),regime:etendu?'etendu':'precis',kcalDelta,gDelta,
    // Couverture insuffisante : la proposition tient, mais elle est annoncee
    // pour ce qu'elle est — un ajustement decide sans pouvoir verifier que
    // l'objectif precedent etait suivi.
    verifieParJournal:!!(_adh&&_adh.nJours>=ADH_JOURS_MIN),
    adherence:_adh||null,
    mesuree:Math.round(v1.pctSem*100)/100,
    nPesees:(v1.nPesees!=null?v1.nPesees:v1.points),
    nSemaines:(v1.nSemaines!=null?v1.nSemaines:null),
    cible:{min:cible.min,max:cible.max},
    semaines:Math.max(1,Math.round((jours+1)/7)),
    jour,phase:p.type,
    apres:{kcal:kcalApres,p:pr,l:li,g:gApres,f:base.f}};
}

// Message de plancher : rendu à la PLACE de la proposition quand une baisse
// serait nécessaire mais passerait sous le plancher. On ne se tait pas — on dit
// pourquoi on ne propose rien.
// Libelle de la regle de plancher REELLEMENT atteinte. « Sous ton metabolisme
// au repos » etait faux dans les trois cas : le plancher n'a jamais ete le
// metabolisme depuis que le coach a donne ses chiffres, et il l'est encore
// moins depuis qu'il s'indexe sur la masse maigre.
function libelleReglePlancher(pl){
  if(!pl) return 'sous ton plancher';
  if(pl.regle==='masse_maigre')
    // N2.9 — la phrase dit la GRANDEUR bornee. « Sous 30 kcal par kilo de
    // masse maigre » decrivait l'apport total ; le seuil porte sur ce qui
    // reste une fois l'entrainement paye.
    return 'sous '+KCAL_PLANCHER_PAR_KG_MM+' kcal par kilo de masse maigre '
      +'une fois l’entraînement payé';
  if(pl.regle==='poids_total')
    return 'sous '+KCAL_PLANCHER_PAR_KG+' kcal par kilo de poids';
  return 'sous le plancher de '+pl.abs+' kcal';
}
function _ajustPlancherAtteint(user){
  const nut=(user&&user.nutrition)||{};
  if(!nut.macros) return null;
  const p=phaseCourante(user);
  if(!p) return null;
  try{ if(aTCA(user)) return null; }catch(e){}
  const cible=cibleVitesse(user);
  if(cible.min==null||cible.max==null) return null;
  const aujd=localISODate(new Date());
  const v1=_vitesseAuJour(user,aujd);
  const v2=_vitesseAuJour(user,_jourPlus(aujd,-AJUST_ECART_RELEVES));
  if(!v1||v1.pctSem==null||!v2||v2.pctSem==null) return null;
  if(!(v1.pctSem>cible.max&&v2.pctSem>cible.max)) return null;
  const base=nut.macros.off||nut.macros.on||{};
  const kcal=Number(base.kcal), pr=Number(base.p), li=Number(base.l), gl=Number(base.g);
  if(!(kcal>0)) return null;
  const gApres=gl-Math.round(Math.round(kcal*AJUST_PAS)/4);
  const kcalApres=Math.round(4*pr+9*li+4*Math.max(0,gApres));
  const ple=plancherEffectif(user);
  const pl=ple.kcal>0?ple.kcal:null;
  if(pl==null) return {plancher:null,kcalApres,regle:null};
  return kcalApres<pl?{plancher:pl,kcalApres,regle:libelleReglePlancher(ple)}:null;
}
// ══════════════ PLANCHERS NUTRITIONNELS ═════════════════════════════════════
// Le lot précédent posait un plancher provisoire — le métabolisme au repos — en
// attendant la valeur du coach. La voici, et elle remplace le provisoire.
//
// Sources des chiffres, telles que le coach les a fixées :
//   1200 kcal (F) / 1500 kcal (H)  planchers absolus, en dessous desquels
//     aucune prescription automatique n'a de sens quel que soit le gabarit
//   22 kcal par kilo               plancher proportionnel : un athlète de
//     100 kg n'a pas le même sol qu'un de 50 kg
//   1,6 g de protéines par kilo    borne basse de préservation musculaire
//   0,6 g de lipides par kilo      borne basse de la fonction hormonale
// Le plancher effectif en kcal est le PLUS GRAND des deux premiers : l'absolu
// protège les petits gabarits, le proportionnel les grands.
const KCAL_PLANCHER_ABS=Object.freeze({F:1200,H:1500});
const KCAL_PLANCHER_PAR_KG=22;
const PROT_PLANCHER_G_KG=1.6;
const LIP_PLANCHER_G_KG=0.6;
// Antécédent de trouble du comportement alimentaire déclaré au bilan de départ :
// le plancher monte de 15 %, et la confirmation du coach devient impossible.
// C'est le seul endroit de l'app où un professionnel ne peut PAS passer outre.
const PLANCHER_MAJORATION_TCA=1.15;

// Poids de référence : la pesée la plus récente, à défaut le dernier bilan.
// Rend null quand rien n'est connu — et dans ce cas seul l'absolu s'applique.
// Plancher indexé sur la MASSE MAIGRE quand elle est connue. 22 kcal par kilo
// de poids TOTAL punit le gros gabarit deux fois : plus il pèse, plus son
// plancher monte, alors qu'une partie de ce poids ne consomme presque rien. Un
// homme de 140 kg obtenait 3080 kcal — proche de sa dépense — et aucune baisse
// ne lui était jamais proposée.
//
// Comme KCAL_PLANCHER_PAR_KG, 30 est un repère de PRATIQUE DE
// TERRAIN et non une mesure : la dépense d'un kilo de masse maigre varie d'un
// tissu à l'autre et d'une personne à l'autre, et la masse maigre elle-même
// n'est ici qu'une ESTIMATION par tours de taille et de cou. C'est une borne
// basse de sécurité, pas un besoin calculé.
// N2.9 — CE SEUIL EST UN SEUIL DE DISPONIBILITE ENERGETIQUE, et il est
// applique comme tel depuis le 26/08/2026 (arbitrage de Kevin).
// Dans la litterature, 30 kcal par kilo de masse maigre borne l'APPORT MOINS
// LA DEPENSE D'EXERCICE — pas l'apport total. Il bornait ici l'apport total :
// un athlete qui depense 700 kcal par jour a l'entrainement passait donc sous
// le vrai seuil sans qu'aucune violation ne se declenche, alors meme que
// kcalSportParJour existe dans le fichier et que _depensePourPlafond
// l'utilise deja.
// Le plancher proportionnel vaut donc 30 x masse maigre PLUS la depense
// d'entrainement. Le plafond a 85 % de la depense estimee reste en place et
// borne le resultat : sans lui, un gros volume rendrait toute seche
// impossible tout en pretendant proteger.
const KCAL_PLANCHER_PAR_KG_MM=30;      // par kilo de MASSE MAIGRE, EN DISPONIBILITE
// Part de la dépense estimée que le plancher PROPORTIONNEL ne peut pas
// dépasser. Sans elle, un plancher qui frôle la dépense interdit toute sèche
// tout en prétendant protéger l'athlète.
const PLANCHER_PLAFOND_DEPENSE=0.85;
// Dépense estimée, par le MÊME chemin que besoinsProposes — mb puis facteur —
// mais SANS passer par lui : besoinsProposes appelle _relevePlancher, qui
// appelle plancherKcal, qui appelle plancherEffectif. L'appeler d'ici
// refermerait la boucle.
function _depensePourPlafond(user){
  try{
    const bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
    const b=bl[bl.length-1]||{};
    // N2.6 — meme source que besoinsProposes, dont cette fonction refait le
    // chemin a la main pour ne pas refermer la boucle du plancher.
    const poids=poidsNutritionnel(user).kg;
    const taille=parseFloat((user&&(user._evol_height||user['init-height']))||b['deb-height']||(user&&user.height)||0)||null;
    // Meme raison que dans besoinsProposes : la date de naissance fait foi,
    // et l'age saisi reste le repli.
    const age=ageActuel(user);
    const sexe=(user&&(user._evol_gender||user.gender))||b['deb-gender']||'';
    const mm=masseMaigreDuBilan(user);
    let mb=(mm!=null)?mbKatch(mm):null;
    // ⚠ mbEstime ET NON mbMifflin (QA du 27/09/2026). besoinsProposes est
    //   passe a Harris-Benedict le 07/09 ; cette copie gardait Mifflin. Sans
    //   tours de mesure, le plancher se plafonnait a 85 % de 2002 kcal quand la
    //   depense affichee au coach en disait 2053.
    //   LA CORRECTION DE METABOLISME DU COACH, ELLE, N'ENTRE PAS ICI, et c'est
    //   voulu : cette depense ne sert qu'au plafond du plancher, et un
    //   metabolisme corrige a la baisse ne doit pas pouvoir abaisser le
    //   plancher (« Critère : la correction ne touche PAS au plancher »).
    if(mb==null) mb=mbEstime(poids,taille,age,sexe,user);
    if(!(mb>0)) return null;
    // MÊME convention que besoinsProposes, et un seul chemin comme lui : deux
    // formules divergentes borneraient une dépense qui n'est pas celle qu'on
    // affiche à l'athlète.
    return Math.round(mb*facteurNEAT(user).f)+kcalSportParJour(user).jour;
  }catch(e){ return null; }
}

// N2.6 — MEME SOURCE QUE LES DEUX AUTRES LECTURES. Celle-ci etait deja la
// plus juste des trois : c'est la sienne qui a ete retenue, et les deux
// autres s'y sont ralliees.
function _poidsPourPlancher(user){
  return poidsNutritionnel(user).kg;
}
// Planchers effectifs pour CET athlète. Toujours un objet, jamais null : sans
// poids connu, les bornes par kilo sont absentes mais l'absolu tient.
// Le paramètre « brut » saute toute majoration. Sans lui, la récursion est
// fermée : le score de déficit a besoin du plancher pour son critère
// d'apports, et le plancher a besoin du score pour sa majoration. C'est le
// même piège que _depensePourPlafond documente déjà plus haut.
// Le critère lit donc le plancher PHYSIOLOGIQUE — ce qui est d'ailleurs plus
// juste : comparer des apports à un plancher déjà majoré pour protection
// reviendrait à déclencher la protection sur elle-même.
function plancherEffectif(user,brut){
  // Meme lecture du sexe que besoinsProposes : sans le repli sur le bilan, une
  // athlete dont le sexe n'existe QUE dans son bilan prend le plancher masculin.
  const _bl=((user&&user.bilans)||[]).filter(b=>b&&b.date).slice().sort((a,b)=>a.date-b.date);
  const _b=_bl[_bl.length-1]||{};
  const sexe=(user&&(user._evol_gender||user.gender))||_b['deb-gender']||'';
  const abs=isFemale(sexe)?KCAL_PLANCHER_ABS.F:KCAL_PLANCHER_ABS.H;
  const poids=_poidsPourPlancher(user);
  let tca=false;
  try{ tca=aTCA(user); }catch(e){}
  // Déficit énergétique au palier de blocage : MÊME majoration que
  // l'antécédent alimentaire, et UNE SEULE FOIS si les deux sont vrais.
  // Deux majorations successives donneraient 1,3225 — un plancher qu'aucune
  // sèche ne pourrait plus franchir.
  let deficit=false;
  if(!brut){ try{ deficit=(paliersDeficit(user)==='blocage'); }catch(e){} }
  const maj=(!brut&&(tca||deficit))?PLANCHER_MAJORATION_TCA:1;
  // La masse maigre est PRIORITAIRE quand elle est calculable. Elle ne l'est
  // que si les tours de mesure sont présents et que calcBF rend un nombre —
  // sinon on retombe sur le poids total, et la règle affichée le DIT plutôt que
  // de laisser croire à une précision qu'on n'a pas.
  const mm=masseMaigreDuBilan(user);
  // N2.9 — LA DEPENSE D'ENTRAINEMENT EST AJOUTEE AU SEUIL. 30 kcal/kg de masse
  // maigre est un seuil de DISPONIBILITE : pour que l'athlete dispose de ce
  // qu'il faut une fois l'entrainement paye, l'apport doit couvrir les deux.
  // Un echec de lecture rend zero, jamais NaN : le plancher retombe alors sur
  // l'ancien comportement plutot que de disparaitre.
  let _dexo=0;
  // kcalSportParJour rend un OBJET — c'est `.jour` que lisent besoinsProposes
  // et _depensePourPlafond, et c'est ce que ce plancher doit lire aussi.
  try{ const v=(kcalSportParJour(user)||{}).jour;
    if(isFinite(v)&&v>0) _dexo=v; }catch(e){}
  const parMM=(mm!=null&&mm>0)?(KCAL_PLANCHER_PAR_KG_MM*mm+_dexo):null;
  const parPoids=poids!=null?KCAL_PLANCHER_PAR_KG*poids:null;
  let proportionnel=(parMM!=null)?parMM:parPoids;
  const regleProp=(parMM!=null)?'masse_maigre':(parPoids!=null?'poids_total':null);
  // Plafonnement du seul plancher PROPORTIONNEL. L'absolu n'est jamais plafonné :
  // c'est un minimum vital, pas une proportion. Et le plafond s'applique AVANT la
  // majoration TCA, qui reste la DERNIÈRE opération et ne peut donc jamais être
  // rabotée par lui.
  const dep=_depensePourPlafond(user);
  let plafonne=false;
  if(proportionnel!=null&&dep>0){
    const plafond=dep*PLANCHER_PLAFOND_DEPENSE;
    if(proportionnel>plafond){ proportionnel=plafond; plafonne=true; }
  }
  const base=Math.max(abs,proportionnel==null?0:proportionnel);
  // La règle qui a réellement gagné : c'est elle que les messages nomment.
  const regle=(proportionnel!=null&&proportionnel>abs)?regleProp:'absolu';
  const kcal=Math.round(base*maj);
  return {kcal,regle,
    p:poids!=null?Math.round(PROT_PLANCHER_G_KG*poids*maj*10)/10:null,
    l:poids!=null?Math.round(LIP_PLANCHER_G_KG*poids*maj*10)/10:null,
    poids,masseMaigre:mm,tca,deficit,majoration:maj,abs,plafonne,
    depenseExercice:Math.round(_dexo),
    proportionnel:proportionnel!=null?Math.round(proportionnel*maj):null,
    parKg:parPoids!=null?Math.round(parPoids*maj):null};
}
// Le plancher que consulte le chemin AUTOMATIQUE. Il n'y a plus qu'une seule
// définition de plancher dans l'app, celle du coach.
function plancherKcal(user){
  const p=plancherEffectif(user);
  return p.kcal>0?p.kcal:null;
}

// ── Contrôle PUR : elle constate, elle ne bloque rien ──────────────────────
// Rend une liste de violations chiffrées. C'est l'appelant qui décide quoi en
// faire : le coach est averti et peut confirmer, le chemin automatique refuse.

// ── Côté coach : on ne lui interdit pas, on l'oblige à voir ────────────────
// Un coach est un professionnel. Le produit n'a pas à décider pour lui — mais
// il a le devoir de mettre les chiffres sous ses yeux et d'exiger un geste
// explicite. Sauf antécédent déclaré : là, personne ne passe outre.
// La confirmation n'est PAS un oui global : c'est un oui donne A CET ATHLETE,
// SUR CES CHIFFRES. Un booleen partage laissait passer trois scenarios qu'un
// coach ne signerait jamais :
//  · cocher pour Anna, ouvrir la fiche de Bruno, enregistrer — Bruno recevait
//    une derogation que personne ne lui avait accordee ;
//  · cocher, puis MODIFIER une valeur, puis enregistrer — la derogation
//    portait sur des chiffres jamais relus ;
//  · un echec d'enregistrement laissait la case cochee pour la suite.
// On retient donc l'email ET une empreinte de la saisie.
let _plConfirme=null;      // {email, empreinte} ou null
// Empreinte des DIX valeurs saisies. Toute modification, meme d'un gramme,
// invalide la confirmation — c'est le but.
function _plEmpreinte(saisie){
  const col=o=>['kcal','p','g','l','f'].map(k=>{
    const v=o&&o[k];
    return (v==null||v==='')?'':String(v);
  }).join('|');
  return col(saisie&&saisie.on)+'#'+col(saisie&&saisie.off);
}
// Saisie couramment affichee dans le formulaire coach. Meme lecture que
// saveClientNutriMacros : une seconde lecture divergerait au premier champ
// ajoute.
function _plSaisieCourante(){
  const g=id=>{const v=parseFloat(document.getElementById(id)?.value);return isNaN(v)?undefined:v;};
  const on={kcal:g('ccd-on-kcal'),p:g('ccd-on-p'),g:g('ccd-on-g'),l:g('ccd-on-l'),f:g('ccd-on-f')};
  // N2.4 — EN DIETE NON CYCLEE, LE JOUR OFF EST UNE COPIE DU JOUR ON.
  // Les champs ccd-off-* ne sont alors PAS rendus : cette fonction rendait un
  // jour OFF vide, pendant que l'enregistrement, lui, recopiait le jour ON.
  // Les deux empreintes divergeaient systematiquement, _plConfirmeValide rendait
  // toujours faux, et le coach ne pouvait JAMAIS valider une derogation au
  // plancher sur une diete non cyclee — meme en cochant la case.
  // L'empreinte doit porter sur ce qui est reellement enregistre.
  const cyc=(()=>{ try{ return dieteCyclee(getOwnedClient(currentClientId)); }
                   catch(e){ return true; } })();
  return {
    on,
    off:cyc?{kcal:g('ccd-off-kcal'),p:g('ccd-off-p'),g:g('ccd-off-g'),l:g('ccd-off-l'),f:g('ccd-off-f')}
           :Object.assign({},on)
  };
}
// Un athlete SANS EMAIL ne peut pas recevoir de derogation : il n'y a aucun
// identifiant auquel l'attacher, donc aucun moyen de garantir qu'elle le vise
// LUI. Le refus est volontaire.
function _plSetConfirme(v,email,saisie){
  if(!v){ _plConfirme=null; return; }
  const em=email||(function(){
    try{ const c=getOwnedClient(currentClientId); return c&&c.email; }catch(e){ return null; }
  })();
  if(!em){ _plConfirme=null; return; }
  _plConfirme={email:em,empreinte:_plEmpreinte(saisie||_plSaisieCourante())};
}
// PURE. Vrai seulement pour l'athlete ET l'empreinte courants.
function _plConfirmeValide(email,saisie){
  if(!_plConfirme||!email) return false;
  if(_plConfirme.email!==email) return false;
  return _plConfirme.empreinte===_plEmpreinte(saisie);
}
function _htmlViolationsCoach(c){
  // ⚠ IL LIT LE DOSSIER, PLUS UN ETAT TRANSITOIRE (24/09/2026). `_plDerniereViol`
  //   n'etait pose que par un REFUS d'enregistrement ; l'enregistrement ne
  //   refuse plus, et ce bloc ne serait plus jamais sorti. Il lit maintenant les
  //   chiffres ECRITS, comme le bloc de l'athlete le fait depuis toujours : ce
  //   qui est sous le plancher se voit tant que ca l'est.
  const nut=(c&&c.nutrition)||{};
  let viol=[];
  if(nut.macros){ try{ viol=controlerMacros(nut.macros,c)||[]; }catch(e){ viol=[]; } }
  // ⚠ ET LA TENTATIVE REFUSEE, QUAND IL Y EN A UNE. Un antecedent alimentaire
  //   declare fait toujours REFUSER l'ecriture : le dossier garde alors ses
  //   anciens chiffres, donc aucune violation a lire, donc le coach n'aurait
  //   eu aucune explication de son refus. On retombe sur ce qu'il vient
  //   d'essayer d'ecrire.
  if(!viol.length&&window._plDerniereViol&&window._plDerniereViol.email===(c&&c.email))
    viol=window._plDerniereViol.liste||[];
  if(!viol.length) return '';
  const pl=plancherEffectif(c);
  const dur=pl.tca;
  return `<div style="background:var(--red-bg);border:1px solid var(--red);border-radius:var(--r-3);padding:12px;margin:10px 0">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--red-text);text-transform:uppercase;margin-bottom:8px">Sous le plancher</div>
    ${viol.map(v=>`<div style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.6">· ${escapeHtml(v.message)}</div>`).join('')}
    ${dur
      ?`<div style="font-size:var(--fs-xs);color:var(--red-text);line-height:1.6;margin-top:10px;font-weight:700">Un antécédent alimentaire est déclaré au bilan de départ. Le plancher de cet athlète est majoré pour cette raison, et ces cibles passent dessous. Elles sont enregistrées : la décision est la tienne, et elle est tracée dans son dossier.</div>`
      // ⚠ PLUS DE CASE NI DE SECOND BOUTON (24/09/2026). Ils ne servaient qu'a
      //   lever un refus qui n'existe plus. Ce qui reste est ce qui informe :
      //   les chiffres, et ce que l'athlete voit de son cote.
      :`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px">Ces chiffres sont enregistrés tels quels. De son côté, elle lit « tes objectifs sont sous le minimum calculé pour toi ».</div>`}
    ${blocDisclaimerSante()}
  </div>`;
}

// ── Côté athlète : permanent, non masquable ───────────────────────────────
// Même registre que TEXTE_ARRET_DRAPEAU : on décrit ce qu'on constate, on
// nomme les signes à surveiller sans les diagnostiquer, on renvoie vers un
// professionnel, et on rappelle ce que l'app n'est pas. Sans chiffre alarmiste
// et sans nommer quoi que ce soit.
const TEXTE_PLANCHER_ATHLETE=["Ces objectifs sont bas pour ton poids.",
  "Si tu te sens fatigué, frileux, ou si ton sommeil se dégrade, parles-en à ton coach et à un professionnel de santé.",
  "RepCore n'est pas un dispositif médical."];
function _htmlPlancherAthlete(user){
  const nut=(user&&user.nutrition)||{};
  if(!nut.macros) return '';
  const viol=controlerMacros(nut.macros,user);
  if(!viol.length) return '';
  // R12 — LA LIGNE SOUS LE TITRE DIT CE QUE LE CODE CONSTATE. Le bloc ne
  // s'affiche que si controlerMacros trouve des objectifs SOUS le plancher —
  // un minimum calcule pour l'athlete (poids ou masse maigre, entrainement).
  // « En dessous, on ne descend pas » aurait ete faux : le coach peut
  // enregistrer une prescription sous le plancher, et c'est precisement ce
  // cas que ce bloc annonce.
  return `<div style="background:var(--red-bg);border:1px solid var(--red);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--red-text);text-transform:uppercase;margin-bottom:1px">À savoir</div>
    <div class="rc-micro" style="margin-bottom:8px">Tes objectifs sont sous le minimum calculé pour toi.</div>
    ${TEXTE_PLANCHER_ATHLETE.map(t=>`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7;margin-bottom:8px">${escapeHtml(t)}</div>`).join('')}
  </div>`;
}
// Invitation au palier, jamais une injonction. Elle ne remplace pas la carte
// ci-dessus, elle s'y ajoute quand la sèche dure.
// R12 — LA LIGNE SOUS LE TITRE. Une supposition aurait dit « l'ajustement
// suivant des calories » : c'est faux. Le palier que propose ce bloc est une
// PAUSE dans la seche — remonter vers la depense deux ou trois semaines —, et
// le texte juste dessous le dit.
function _htmlPalierAthlete(user){
  if(!restrictionProlongee(user)) return '';
  const sem=semainesEcoulees(user);
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:1px">Faire un palier</div>
    <div class="rc-micro" style="margin-bottom:8px">Remonter vers ta dépense, deux à trois semaines.</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">Tu es en sèche depuis ${sem} semaines, avec des apports proches de ton plancher. Remonter aux alentours de ta dépense pendant deux ou trois semaines n'annule rien de ce que tu as fait : ça remet du carburant dans les séances et ça facilite la suite. C'est une proposition, tu en parles avec ton coach.</div>
    ${blocDisclaimerSante()}
  </div>`;
}

// ══════════ RÉCUPÉRATION : AGRÉGER L'EXISTANT, N'ALERTER DE RIEN ══════════
// Quatre données de récupération étaient collectées et exploitées SÉPARÉMENT.
// Ce score les rassemble pour UNE conversation avec le coach, et pour
// alimenter une suggestion de décharge qui, elle, exigera deux motifs
// distincts. Il ne déclenche RIEN à lui seul.
//
// AUCUNE notification, aucun score montré à l'athlète, aucune couleur
// d'alerte, aucun second système parallèle. Et aucun vocabulaire de
// physiologie hormonale ou de surmenage : on décrit ce qui a été saisi.
//
// LE VOLUME N'EST PAS RECALCULÉ. signauxEntrainement porte déjà volumeHaut,
// mis en cache et restitué au coach. En écrire un second calcul, c'est
// s'exposer à ce que les deux se contredisent un jour.
//
// Le critère de FORME, lui, reste distinct de signauxEntrainement.formeBasse,
// et c'est délibéré : formeBasse compare la MOYENNE des trois dernières à la
// base, ce critère-ci exige que les trois soient individuellement en creux ou
// en dessous. Une bonne séance entre deux mauvaises fait tomber le second
// sans faire tomber le premier. Deux questions différentes, deux réponses.
const RECUP_SEANCES_FORME=3;
const RECUP_MUSCLES_MRV=2;
const RECUP_SEUIL_SUGGESTION=2;   // motif pour la décharge (lot A1-05)
const RECUP_SEUIL_MESSAGE=3;      // phrase à l'athlète
// Le sommeil réutilise MICRO_SOMMEIL_SEUIL et MICRO_SOMMEIL_MIN_NUITS via
// _microSommeil : aucune constante nouvelle, aucun second calcul. Deux
// constantes de même valeur finissent par diverger — DEF_SOMMEIL_SEUIL a
// été aliasé pour cette raison exacte.
//
// PURE. Un point par critère, chacun isolé dans son try/catch : un critère
// qui jette compte 0 et les autres restent lisibles. Un dossier vide rend
// {points:0, criteres:[]} sans lever quoi que ce soit.
function scoreRecuperation(user){
  const criteres=[];
  const u=user||{};
  const essai=(cle,fn)=>{ try{ const v=fn(); if(v) criteres.push(Object.assign({cle},v)); }catch(e){} };

  // (a) Les trois dernières séances TOUTES en creux ou en dessous.
  essai('forme',()=>{
    // Curseurs jamais bougés : l'indice ne mesure rien, et le produit le sait
    // déjà. On ne compte pas un critère sur une donnée qu'on sait muette.
    if(formeFigee(u)) return null;
    const t=_serieForme(u);
    if(t.length<RECUP_SEANCES_FORME) return null;
    const der=t.slice(-RECUP_SEANCES_FORME);
    for(const x of der){
      const e=etatForme(zForme({id:x.id,metrics:x.metrics},u));
      if(e!=='creux'&&e!=='bas') return null;
    }
    return {lib:'Forme en creux',valeur:RECUP_SEANCES_FORME+' séances'};
  });

  // (b) Le sommeil, par _microSommeil et pas autrement.
  essai('sommeil',()=>{
    const s=_microSommeil(u);
    if(!s||!(s.moyenne<MICRO_SOMMEIL_SEUIL)) return null;
    return {lib:'Sommeil court',
      valeur:_recupHeures(s.moyenne)+' sur '+s.nuits+' nuits'};
  });

  // (c) Le stress DÉCLARÉ au dernier bilan de suivi. Il était affiché au
  // coach et lu par aucun calcul.
  essai('stress',()=>{
    const b=((u.bilans)||[]).filter(x=>x&&x.type!=='depart'&&x.date)
      .sort((a,b2)=>a.date-b2.date);
    if(!b.length) return null;
    const v=_texteReponse(b[b.length-1]['bil-stress']);
    if(!v) return null;
    const n=_microNorm(v);
    if(!/^(beaucoup|enormement)$/.test(n)) return null;
    return {lib:'Stress déclaré élevé',valeur:v};
  });

  // (d) Le volume sur la dernière semaine révolue.
  //
  // J'AI D'ABORD GARDÉ CE CRITÈRE derrière signauxEntrainement.volumeHaut,
  // en me disant que réutiliser valait mieux que recalculer. C'était faux, et
  // c'est le reproche exact que je fais à formeBasse deux paragraphes plus
  // haut : volumeHaut répond à « UN muscle est-il au-dessus du repère DEUX
  // semaines de suite », ce critère-ci à « COMBIEN de muscles le sont cette
  // semaine ». Deux questions différentes. M'appuyer sur l'une pour répondre
  // à l'autre durcissait le critère en silence, d'une semaine à deux.
  //
  // _recupMusclesHauts est donc l'UNIQUE endroit où ce score compare un
  // volume à un MRV, et il ne double aucun calcul existant.
  essai('volume',()=>{
    const n=_recupMusclesHauts(u);
    if(n<RECUP_MUSCLES_MRV) return null;
    return {lib:'Volume au-dessus du repère',valeur:n+' muscles'};
  });

  // (e) La récupération MESURÉE : FC de repos et VFC (voir recupCardio).
  // Un point au plus. Sans journaux synchronisés, ce critère n'existe pas.
  essai('cardio',()=>{
    const c=recupCardio(u);
    const f=c.fc&&c.fc.signal, v=c.vfc&&c.vfc.signal;
    if(!f&&!v) return null;
    return {lib:f&&v?'FC de repos haute et VFC basse':(f?'FC de repos au-dessus de ta moyenne':'VFC sous ta moyenne'),
      valeur:[f?'+'+String(c.fc.ecart).replace('.',',')+' bpm':'',v?c.vfc.ecart+' %':''].filter(Boolean).join(', ')+' sur 28 j'};
  });

  return {points:criteres.length,criteres:criteres};
}
// ══ LA RÉCUPÉRATION MESURÉE : FC DE REPOS ET VFC (synchronisation santé) ══
// Deux mesures arrivent désormais sans saisie : la fréquence cardiaque de
// repos (fcReposLog [{date,bpm}]) et la variabilité cardiaque (vfcLog
// [{date,ms,methode}]). Elles entrent dans scoreRecuperation comme UN critère
// de plus (« cardio », un point au plus, que la FC, la VFC ou les deux
// sonnent) : un poids égal à celui du sommeil ou du stress, jamais davantage,
// et le score garde son rôle — ouvrir une conversation, rien déclencher seul.
//
// LE CALCUL, chacun contre SA PROPRE HISTOIRE (jamais contre une norme de
// population, qui varie trop d'une personne à l'autre) :
//   · fenêtre : les 28 derniers jours (aujourd'hui compris) ;
//   · « récent » : les 3 dernières mesures, prises dans les 7 derniers jours ;
//   · « base » : les autres mesures de la fenêtre, 7 au moins (sinon rien) ;
//   · FC de repos : signal si la moyenne récente dépasse la base d'au moins
//     max(5 bpm, 1 écart-type). Une FC de repos qui monte de quelques
//     battements sur plusieurs jours accompagne la fatigue accumulée ou un
//     début d'infection (Buchheit 2014, Front Physiol 5:73 ; Bosquet et al.
//     2008, Br J Sports Med 42:709) ; 5 bpm dépasse la variation d'un jour à
//     l'autre d'une mesure au repos.
//   · VFC : comparée en LOGARITHME (ln), comme le recommandent Plews et al.
//     2012-2013 (Eur J Appl Physiol 112:3729 ; Sports Med 43:773), parce que
//     sa distribution est asymétrique. Signal si la moyenne ln récente passe
//     sous la base de plus d'1 écart-type. Plews retient 0,5 écart-type comme
//     plus petit changement utile ; on prend le double, parce qu'un point du
//     score doit être rare.
//   · UNE MÉTHODE À LA FOIS : la base ne contient que les valeurs de la
//     méthode de la dernière mesure. RMSSD (Health Connect) et SDNN (Apple
//     Santé) ne mesurent pas la même chose : on ne les compare JAMAIS.
// Sans ces journaux (ou sans base suffisante), le critère n'existe pas, et
// le score est exactement celui d'avant (test de non-régression).
const RECUP_FENETRE_JOURS=28, RECUP_RECENTS=3, RECUP_RECENTS_JOURS=7, RECUP_BASE_MIN=7;
const RECUP_FC_ECART_BPM=5, RECUP_VFC_ECARTS_TYPE=1;
function _recupMoySd(a){
  const m=a.reduce((t,x)=>t+x,0)/a.length;
  const sd=a.length>1?Math.sqrt(a.reduce((t,x)=>t+(x-m)*(x-m),0)/(a.length-1)):0;
  return {m,sd};
}
// PURE. Les points de la fenêtre, triés : [{d, v, methode}].
function _recupPoints(log,champ,maintenant,methode){
  const t=Number(maintenant)||Date.now();
  const fin=localISODate(new Date(t)), debut=localISODate(new Date(t-(RECUP_FENETRE_JOURS-1)*864e5));
  return (Array.isArray(log)?log:[]).filter(e=>e&&e.date>=debut&&e.date<=fin&&isFinite(Number(e[champ]))&&Number(e[champ])>0
      &&(!methode||e.methode===methode))
    .map(e=>({d:e.date,v:Number(e[champ]),methode:e.methode||null}))
    .sort((a,b)=>a.d<b.d?-1:(a.d>b.d?1:0));
}
// PURE. {fc, vfc} : chacun null, ou {recent, base, ecart, n, signal[, methode]}.
function recupCardio(user,maintenant){
  const u=user||{}, t=Number(maintenant)||Date.now();
  const limRecent=localISODate(new Date(t-(RECUP_RECENTS_JOURS-1)*864e5));
  const couper=pts=>{
    const rec=pts.slice(-RECUP_RECENTS).filter(p=>p.d>=limRecent);
    const base=pts.slice(0,pts.length-rec.length);
    return (rec.length>=1&&base.length>=RECUP_BASE_MIN)?{rec,base}:null;
  };
  let fc=null, vfc=null;
  const pf=couper(_recupPoints(u.fcReposLog,'bpm',t));
  if(pf){
    const r=_recupMoySd(pf.rec.map(p=>p.v)).m, b=_recupMoySd(pf.base.map(p=>p.v));
    const ecart=Math.round((r-b.m)*10)/10;
    fc={recent:Math.round(r),base:Math.round(b.m),ecart,n:pf.base.length+pf.rec.length,
      signal:ecart>=Math.max(RECUP_FC_ECART_BPM,b.sd)};
  }
  const tous=_recupPoints(u.vfcLog,'ms',t);
  const meth=tous.length?tous[tous.length-1].methode:null;
  if(meth){
    const pv=couper(tous.filter(p=>p.methode===meth));
    if(pv){
      const r=_recupMoySd(pv.rec.map(p=>Math.log(p.v))).m, b=_recupMoySd(pv.base.map(p=>Math.log(p.v)));
      vfc={recent:Math.round(Math.exp(r)),base:Math.round(Math.exp(b.m)),methode:meth,
        ecart:Math.round((Math.exp(r-b.m)-1)*100),n:pv.base.length+pv.rec.length,
        signal:b.sd>0&&(r-b.m)< -RECUP_VFC_ECARTS_TYPE*b.sd};
    }
  }
  return {fc,vfc};
}
// Les deux courbes de Lifestyle, sous la carte « Ce qui va dans le même sens » :
// au dessin des courbes d'Évolution (_courbeMesures). La VFC ne montre que la
// méthode de sa dernière mesure.
function _htmlCourbesRecup(user,maintenant){
  const u=user||{}, t=Number(maintenant)||Date.now();
  const fc=_recupPoints(u.fcReposLog,'bpm',t);
  const tv=_recupPoints(u.vfcLog,'ms',t);
  const meth=tv.length?tv[tv.length-1].methode:null;
  const vf=meth?tv.filter(p=>p.methode===meth):[];
  const carte=(titre,trace)=>trace?`<div class="evo-carte pc-carte">
      <div class="pc-tete"><span class="pc-ico" aria-hidden="true">${_pesIcone('barres')}</span>
        <span class="pc-titre">${titre}</span></div>${trace}</div>`:'';
  // La couleur de l'écart : une FC qui baisse, une VFC qui monte, c'est dans le bon sens.
  const cFc=e=>Math.abs(e)<2?'var(--sub)':(e<0?'var(--green)':'var(--orange)');
  const cVf=e=>Math.abs(e)<3?'var(--sub)':(e>0?'var(--green)':'var(--orange)');
  const h=carte('FC de repos · 28 jours',fc.length>1?_courbeMesures([{label:'FC de repos',color:ROUGE_MARQUE,pts:fc}],{unite:'bpm',couleur:cFc}):'')
    +carte('Variabilité cardiaque ('+(meth==='sdnn'?'SDNN':'RMSSD')+') · 28 jours',vf.length>1?_courbeMesures([{label:'VFC',color:'#60a5fa',pts:vf}],{unite:'ms',couleur:cVf}):'');
  return h?'<div class="recup-courbes">'+h+'</div>':'';
}
// « 1 h 11 », « 45 min ».
function _hMin(m){ const n=Math.round(Number(m)||0); return n<60?n+' min':Math.floor(n/60)+' h '+String(n%60).padStart(2,'0'); }
// PURE. La ligne des phases sous la nuit, dans MON SOMMEIL : la dernière nuit
// de la période qui en porte (synchronisation). Rien sinon.
function _htmlPhasesNuit(u,jours){
  const l=(u&&u.sleepLog)||[];
  for(let i=(jours||[]).length-1;i>=0;i--){
    const e=l.find(x=>x&&x.date===jours[i].iso);
    const p=e&&e.phases;
    if(p&&(p.profond>0||p.paradoxal>0))
      return '<div class="sv-phases">'+[p.profond>0?'Profond '+_hMin(p.profond):'',p.paradoxal>0?'Paradoxal '+_hMin(p.paradoxal):''].filter(Boolean).join(' · ')+'</div>';
  }
  return '';
}
// « 5 h 20 » plutôt que « 5,3 h » : c'est ainsi qu'on parle d'une nuit.
function _recupHeures(h){
  const t=Math.round(h*60);
  return Math.floor(t/60)+' h '+String(t%60).padStart(2,'0');
}
// Compte les muscles au-dessus de leur MRV sur la dernière semaine RÉVOLUE.
// Le signal volumeHaut de signauxEntrainement exige DEUX semaines
// consécutives et n'en NOMME qu'un seul ; ici on a besoin du compte. Même
// fenêtre que lui — _semainesRevolues — pour que les deux parlent du même
// intervalle : une semaine en cours, incomplète, sous-compterait toujours.
function _recupMusclesHauts(user){
  let n=0;
  const [s1]=_semainesRevolues(2);
  const v=volumeSemaine(user,s1)||{};
  for(const m in v){
    const rep=reperesEffectifs(user,m);
    if(rep&&v[m]>rep.mrv) n++;
  }
  return n;
}
// ── Le branchement de la décharge, prêt et NON câblé ─────────────────────
// dechargeSuggeree est annoncée par le lot A1-05, qui n'est pas livré :
// grep en rend zéro occurrence. La condition est isolée ici pour s'y brancher
// sans toucher au reste le jour venu. Même patron que la condition aPES de
// relanceAnalyses, qui a attendu son lot au même endroit.
//
// Le score compte pour UN motif, jamais deux : il ne doit pas court-circuiter
// l'exigence de deux signaux concordants. Un score seul ne décharge personne.
function motifRecuperation(user){
  try{ return scoreRecuperation(user).points>=RECUP_SEUIL_SUGGESTION
    ?{cle:'recuperation',lib:'Récupération'}:null; }catch(e){ return null; }
}
// PURE. '' quand il n'y a aucune nuit à montrer : pas de cadre vide, pas de
// « 0 nuit » — ce serait un constat sur l’athlète, alors que c’est une absence
// de saisie.
// ══ CE QUE LE COACH NE VOYAIT PAS ═══════════════════════════════════════
//
// L'onglet Lifestyle de la fiche athlete portait trois sections, dont DEUX
// MASQUEES par defaut — rallumees seulement si des donnees existent. Un athlete
// qui n'a rien saisi depuis dix jours produisait donc un onglet vide, c'est-a-
// dire indiscernable d'un athlete qui va bien. Et le peu qui s'affichait etait
// une moyenne, point : une moyenne sur 14 jours ne distingue pas « 7 000 pas
// tous les jours » de « 14 000 le week-end et 2 000 en semaine ».
//
// PURE. Tout ce que les deux blocs ont besoin de savoir, en une passe.
const COACH_FENETRE_JOURS=28;
function bilanDomaineCoach(u,quoi,jours){
  const n=(jours>0?jours:COACH_FENETRE_JOURS);
  const val=iso=>quoi==='sommeil'?sanSommeilMin(u,iso):sanPas(u,iso);
  const d=new Date(); d.setHours(12,0,0,0);
  const serie=[];
  for(let i=n-1;i>=0;i--){
    const j=new Date(d); j.setDate(d.getDate()-i);
    const iso=localISODate(j);
    serie.push({iso,v:val(iso)});
  }
  const lus=serie.filter(x=>x.v!=null);
  const moy=a=>a.length?Math.round(a.reduce((t,x)=>t+x.v,0)/a.length):null;
  // LES DEUX SEMAINES SE COMPARENT SUR LEURS JOURS RENSEIGNES, chacune de son
  // cote. Comparer une semaine pleine a une semaine a moitie vide en divisant
  // les deux par sept ferait chuter la seconde pour une raison de saisie.
  // ⚠ LE JOUR EN COURS EST HORS DES DEUX FENETRES. Il est incomplet — l'athlete
  // n'a pas fini sa journee — et l'inclure tirait la semaine courante vers le
  // bas tous les matins, donc affichait une baisse qui n'existe pas. Les deux
  // fenetres sont donc les sept jours qui finissent HIER, et les sept d'avant.
  const s0=serie.slice(-8,-1).filter(x=>x.v!=null);
  const s1=serie.slice(-15,-8).filter(x=>x.v!=null);
  const m0=moy(s0), m1=moy(s1);
  // LE DERNIER JOUR RENSEIGNE, pour pouvoir dire le silence. Sans lui, la
  // section se contentait de disparaitre.
  const der=lus.length?lus[lus.length-1].iso:null;
  let depuis=null;
  if(der){
    const dd=new Date(der+'T12:00:00');
    depuis=Math.max(0,Math.round((d.getTime()-dd.getTime())/864e5));
  }
  // LA RÉCUPÉRATION MESURÉE (synchronisation), avec le sommeil : moyenne de
  // la fenêtre. null quand rien n'est arrivé — le coach ne voit rien d'un
  // athlète qui n'a pas activé la synchronisation.
  const cardio=quoi==='sommeil'?_coachCardio(u,serie[0].iso,serie[serie.length-1].iso):{fcRepos:null,vfc:null};
  return {serie,fenetre:n,renseignes:lus.length,moyenne:moy(lus),
    semaine:m0,semaineAvant:m1,
    delta:(m0!=null&&m1!=null)?(m0-m1):null,
    dernier:der,depuis,fcRepos:cardio.fcRepos,vfc:cardio.vfc};
}
// PURE. FC de repos et VFC entre deux dates ISO : {fcRepos:{moyenne,n}|null,
// vfc:{moyenne,n,methode}|null}. La VFC ne garde que la méthode de sa
// dernière mesure (RMSSD et SDNN ne se moyennent pas ensemble).
function _coachCardio(u,debut,fin){
  const dans=e=>e&&e.date>=debut&&e.date<=fin;
  const fc=((u&&u.fcReposLog)||[]).filter(e=>dans(e)&&Number(e.bpm)>0);
  const v0=((u&&u.vfcLog)||[]).filter(e=>dans(e)&&Number(e.ms)>0).sort((a,b)=>a.date<b.date?-1:1);
  const meth=v0.length?v0[v0.length-1].methode:null;
  const v=v0.filter(e=>e.methode===meth);
  const moy=(a,k)=>Math.round(a.reduce((t,e)=>t+Number(e[k]),0)/a.length);
  return {fcRepos:fc.length?{moyenne:moy(fc,'bpm'),n:fc.length}:null,
    vfc:v.length?{moyenne:moy(v,'ms'),n:v.length,methode:meth}:null};
}
function _libVfc(m){ return m==='sdnn'?'SDNN':'RMSSD'; }
// ⚠ LA SPARKLINE, PUIS LA CARTE DE PERIODE ET LES LIGNES « 7 j vs 7 j », SONT
// PARTIES : le tableau de bord de chaque domaine (_htmlDomaineCoach) porte
// maintenant la courbe sur 7 jours, 28 jours ou 3 mois, et la tendance.
// LE SILENCE EST DIT, ET IL EST VISIBLE. C'est le point : un athlete muet
// depuis dix jours ne doit pas ressembler a un athlete qui va bien.
const COACH_SILENCE_JOURS=7;
function _htmlSilenceCoach(b,quoi){
  const q=quoi==='sommeil'?'nuit':'journée';
  if(b.dernier==null)
    return '<div style="font-size:var(--fs-sm);color:var(--warning);line-height:1.6;font-weight:700">'
      +'Aucune '+q+' saisie sur '+b.fenetre+' jours.</div>';
  if(b.depuis<COACH_SILENCE_JOURS) return '';
  const lbl=new Date(b.dernier+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  return '<div style="font-size:var(--fs-sm);color:var(--warning);line-height:1.6;font-weight:700;margin-bottom:6px">'
    +'Aucune donnée depuis le '+escapeHtml(lbl)+' ('+b.depuis+' jours).</div>';
}
// LES OBJECTIFS DE PAS, POSABLES PAR LE COACH (4.3).
//
// stepsGoals n'etait modifiable que par l'athlete, alors que c'est un parametre
// d'entrainement. Le patron est celui de habCoachAjouter — et son piege est
// nomme dans le commentaire N3.2 : getOwnedClient SANS SECOND ARGUMENT rend un
// objet detache, saveUser() ne range que le coach, et la modification
// reapparait effacee a la reouverture de la fiche. On passe donc la carte
// `users`, comme le fait coachSetPhase.
//
// L'ATHLETE GARDE LA MAIN : s'il change l'objectif depuis son ecran, c'est le
// sien qui gagne — il n'y a qu'un seul champ, et le dernier qui ecrit gagne.
// L'ecran dit d'ou vient la valeur, comme le fait deja « (objectifs par
// defaut) » juste au-dessus.
function _htmlObjectifsCoach(c){
  const g=(c&&c.stepsGoals)||STEPS_GOALS_DEFAUT;
  const v=n=>Number(n)>0?Number(n):'';
  return `<div style="border-top:1px solid var(--border);margin-top:12px;padding-top:12px">
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:8px">Poser l'objectif</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <label style="flex:1;min-width:110px;font-size:var(--fs-2xs);color:var(--text-dim)">Jours ON
        <input type="number" id="ccd-pas-on" min="0" max="99999" inputmode="numeric" value="${v(g.on)}"
          style="width:100%;box-sizing:border-box;margin-top:4px;background:var(--surface-1);border:1px solid var(--border);color:var(--text);border-radius:var(--r-2);padding:8px;min-height:44px;font-family:inherit"></label>
      <label style="flex:1;min-width:110px;font-size:var(--fs-2xs);color:var(--text-dim)">Jours OFF
        <input type="number" id="ccd-pas-off" min="0" max="99999" inputmode="numeric" value="${v(g.off)}"
          style="width:100%;box-sizing:border-box;margin-top:4px;background:var(--surface-1);border:1px solid var(--border);color:var(--text);border-radius:var(--r-2);padding:8px;min-height:44px;font-family:inherit"></label>
    </div>
    <button class="btn btn-outline btn-sm" onclick="coachPoserObjectifsPas()" style="width:100%;margin:10px 0 0;min-height:44px">Enregistrer les objectifs</button>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:6px">L'athlète peut les changer depuis son écran : c'est alors sa valeur qui s'applique.</div>
  </div>`;
}
function coachPoserObjectifsPas(){
  // ⚠ LA CARTE `users` EST PASSEE A getOwnedClient. Sans elle, l'objet rendu
  // est DETACHE : DB.set rangerait un dossier qui n'a jamais recu la
  // modification, et le coach la verrait disparaitre a la reouverture. C'est
  // le piege ecrit noir sur blanc dans habCoachAjouter.
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const lire=id=>{ const e=document.getElementById(id); const n=parseInt(e&&e.value,10);
    return (isFinite(n)&&n>=0&&n<=99999)?n:null; };
  const on=lire('ccd-pas-on'), off=lire('ccd-pas-off');
  if(on==null&&off==null) return toast('Saisis au moins un objectif valide','var(--orange)');
  c.stepsGoals=Object.assign({},c.stepsGoals||{},
    on!=null?{on}:{}, off!=null?{off}:{});
  c.updatedAt=Date.now();
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ sanFermer(); }catch(e){}
  try{ renderPasCoach(c); }catch(e){}
  toastSync(ok,envoi,'Objectifs posés','l\'objectif est');
  return true;
}
// ══ SOMMEIL ET PAS CHEZ LE COACH — LA MAQUETTE DE KEVIN (24/09/2026) ═════
// « Remplace par celle-ci, exactement pareil, et rajoute les fonctionnalites
// manquantes », pour le sommeil, puis « pareil » pour les pas. Chaque
// domaine devient un tableau de bord, le meme pour les deux :
//   l'en-tete et la periode (sept jours glissants, ou une semaine passee) ;
//   quatre cartes — la moyenne et son ecart, l'objectif (que le coach pose
//   lui-meme), les jours atteints en anneau, la tendance ;
//   les barres, sur 7 jours, 28 jours ou 3 mois ;
//   le detail de la semaine, les points d'attention, et ce que le coach
//   doit en retenir.
// ⚠ RIEN N'EST DEVINE. Tout sort des saisies (sanSommeilMin, sanPas), des
//   objectifs du dossier et des fonctions deja partagees avec l'athlete
//   (sanNiveau, sanAxe, regulariteCoucher, bilanDomaineCoach). Un jour non
//   renseigne n'est compte nulle part : il est DIT.
// ⚠ POUR LES PAS, UN JOUR SE JUGE SUR SON OBJECTIF DU JOUR, ON ou OFF, tel
//   que _stepsObjectifJour le lit — la regle que la carte du coach suivait
//   deja : 7 000 pas un jour de repos n'est pas un echec a 12 000.
// ⚠ AUCUN DIAGNOSTIC : « moins de 6 h », jamais « insomnie ».
const CS_SEUIL_COURT=360;          // 6 h, en minutes : le seuil des nuits courtes
const CS_DOM={
  sommeil:{titre:'Sommeil',sous:'Suivi et analyse des données de sommeil',ico:'lune',
    graphe:'Durée de sommeil',nom:'nuit',noms:'nuits',f:true,stable:10,
    val:(c,iso)=>sanSommeilMin(c,iso),obj:c=>sanObjSommeil(c),objJour:c=>sanObjSommeil(c),
    fmt:v=>sanHM(v),fmtEcart:v=>sanHM(v),
    note:'Durées saisies par l’athlète. Les nuits non renseignées ne sont pas comptées.'},
  pas:{titre:'Pas',sous:'Suivi et analyse du nombre de pas',ico:'chaussure',
    graphe:'Nombre de pas',nom:'jour',noms:'jours',f:false,stable:500,
    val:(c,iso)=>sanPas(c,iso),obj:c=>sanObjPas(c),
    objJour:(c,iso)=>{ const b=_stepsObjectifJour((c&&c.stepsGoals)||STEPS_GOALS_DEFAUT,
      ((c&&c.stepsDayType)||{})[iso]??null,iso); return b>0?b:sanObjPas(c); },
    fmt:v=>_svEsp(sanNb(v)),fmtEcart:v=>_svEsp(sanNb(v))+' pas',
    note:'Nombres saisis par l’athlète. Les jours non renseignés ne sont pas comptés.'}
};
const _csEtat={sommeil:{off:0,vue:'7j',vise:null},pas:{off:0,vue:'7j',vise:null}};
function _csQ(q){ return q==='pas'?'pas':'sommeil'; }
function _csSvg(p,plein){ return '<svg viewBox="0 0 24 24" '+(plein?'fill="currentColor"':'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="square" stroke-linejoin="miter"')+' aria-hidden="true">'+p+'</svg>'; }
const CS_ICO={
  lune:_csSvg('<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>'),
  chaussure:_csSvg('<path d="M2.5 16.5h17.2a1.8 1.8 0 0 0 1.8-1.8c0-1.4-1-2.1-2.5-2.6l-4.1-1.5a3 3 0 0 1-1.3-.9L11.2 6.8a1.3 1.3 0 0 0-2-.2L7.6 8.3H2.5z"/><path d="M2.5 16.5v2h19v-2"/>'),
  lit:_csSvg('<path d="M3 19V6.5M3 15h18v4M21 15v-2.4A2.6 2.6 0 0 0 18.4 10H11v5"/><circle cx="7" cy="11.2" r="1.9"/>'),
  marche:_csSvg('<circle cx="13" cy="4.5" r="2"/><path d="M11 21l2-6-2.5-2.5L12 8l3 3 3 1M10.5 8.5L7 10l-1 4M13 15l3 6"/>'),
  cible:_csSvg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l7-7M16.5 3.8L19 5l1.2 2.5"/>'),
  crayon:_csSvg('<path d="M16.9 3.6a2.1 2.1 0 0 1 3 3L8.4 18.1l-4 1 1-4z"/><path d="M14.8 5.7l3 3"/>'),
  barres:_csSvg('<rect x="3.5" y="12" width="4" height="8.5" rx="1.2"/><rect x="10" y="7" width="4" height="13.5" rx="1.2"/><rect x="16.5" y="3.5" width="4" height="17" rx="1.2"/>',true),
  droite:_csSvg('<path d="M9 5l7 7-7 7"/>'),
  bas:_csSvg('<path d="M6 9l6 6 6-6"/>'),
  calendrier:_csSvg('<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01"/>'),
  camembert:_csSvg('<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M14.5 2.8A9 9 0 0 1 21.2 9.5H14.5z"/>',true),
  alerte:_csSvg('<circle cx="12" cy="12" r="10"/><path d="M12 7v6.5M12 16.8h.01" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>',true),
  flecheBas:_csSvg('<path d="M12 4v15M6 13l6 6 6-6"/>'),
  moins:_csSvg('<path d="M7 12h10"/>'),
  ampoule:_csSvg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',true),
  hausse:_csSvg('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
  etoile:_csSvg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  engrenage:_csSvg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>')
};
// PURE. La semaine lue (sept jours glissants, decales de `offset` semaines),
// et tout ce que le tableau de bord en dit. Chaque jour porte SON objectif.
function csSemaine(c,offset,quoi){
  const D=CS_DOM[_csQ(quoi)], q=_csQ(quoi);
  const obj=D.obj(c);
  const jours=sanJours(offset||0).map(j=>({iso:j.iso,d:j.d,v:D.val(c,j.iso),o:D.objJour(c,j.iso)}));
  const lus=jours.filter(j=>j.v!=null);
  const moy=lus.length?Math.round(lus.reduce((t,j)=>t+j.v,0)/lus.length):null;
  const prec=sanJours((offset||0)-1).map(j=>D.val(c,j.iso)).filter(v=>v!=null);
  const moyPrec=prec.length?Math.round(prec.reduce((t,v)=>t+v,0)/prec.length):null;
  return {obj,jours,lus:lus.length,moy,moyPrec,
    atteints:lus.filter(j=>j.v>=j.o).length,
    // Nuits de moins de 6 h ; jours de pas sous le quart de leur objectif.
    courtes:q==='sommeil'?lus.filter(j=>j.v<CS_SEUIL_COURT):lus.filter(j=>sanNiveau('pas',j.v,j.o)==='bas'),
    meilleur:lus.length?lus.reduce((m,j)=>j.v>m.v?j:m):null,
    vides:jours.filter(j=>j.v==null)};
}
// PURE. « Stable », « En hausse », « En baisse » — ou rien a comparer.
function csTendance(s,quoi){
  const D=CS_DOM[_csQ(quoi)];
  if(s.moy==null||s.moyPrec==null) return {lib:'-',phrase:'Pas assez de données pour comparer deux semaines.',sens:0};
  const d=s.moy-s.moyPrec;
  if(Math.abs(d)<=D.stable) return {lib:'Stable',sens:0,d,
    phrase:'Même moyenne que la semaine précédente, à '+D.fmtEcart(D.stable)+' près.'};
  return {lib:d>0?'En hausse':'En baisse',sens:d>0?1:-1,d,
    phrase:(d>0?'+':'−')+D.fmtEcart(Math.abs(d))+' par rapport à la semaine précédente.'};
}
function _csJour(d,long){
  const s=d.toLocaleDateString('fr-FR',{weekday:long?'long':'short'}).replace('.','');
  return s.charAt(0).toUpperCase()+s.slice(1);
}
function _csDate(d){ return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); }
function _csPl(n,D,adj){ return n+' '+(n>1?D.noms:D.nom)+(adj?' '+adj+(D.f?'e':'')+(n>1?'s':''):''); }
// Les barres. 7 jours : une par jour, jour et date dessous. 28 jours : une par
// jour, la date une fois sur quatre. 3 mois : la moyenne de chaque semaine.
function _csSerie(c,quoi){
  const D=CS_DOM[_csQ(quoi)], E=_csEtat[_csQ(quoi)];
  if(E.vue==='3m'){
    const out=[];
    for(let k=12;k>=0;k--){
      const js=sanJours(E.off-k);
      const v=js.map(j=>D.val(c,j.iso)).filter(x=>x!=null);
      out.push({iso:js[6].iso,d:js[6].d,o:D.obj(c),v:v.length?Math.round(v.reduce((t,x)=>t+x,0)/v.length):null,
        lib:'S'+(13-k),sous:_csDate(js[0].d),semaine:true});
    }
    return out;
  }
  const n=E.vue==='28j'?28:7;
  const fin=sanJours(E.off)[6].d;
  const out=[];
  for(let i=n-1;i>=0;i--){
    const d=new Date(fin); d.setDate(fin.getDate()-i);
    const iso=localISODate(d);
    out.push({iso,d,v:D.val(c,iso),o:D.objJour(c,iso),
      lib:n===7?_csJour(d):(i%4===0?_csDate(d):''),sous:n===7?_csDate(d):''});
  }
  return out;
}
function _htmlCsGraphe(c,quoi){
  const q=_csQ(quoi), D=CS_DOM[q], E=_csEtat[q];
  const obj=D.obj(c);
  const barres=_csSerie(c,q);
  const ax=sanAxe(q,barres.map(b=>b.v),obj);
  const pc=v=>Math.max(0,Math.min(100,v/ax.haut*100));
  const dense=barres.length>7;
  const grilles=ax.grad.map(v=>'<div class="cso-gl" style="bottom:'+pc(v)+'%"><span>'+escapeHtml(ax.lib(v))+'</span></div>').join('');
  const b=barres.map(x=>{
    const niv=sanNiveau(q,x.v,x.o);
    const vise=E.vise&&E.vise.indexOf(x.iso)>=0;
    return '<div class="cso-b'+(vise?' cso-b-vise':'')+'" data-niv="'+(niv||'vide')+'" title="'
      +escapeHtml((x.semaine?'Semaine du '+x.sous:x.d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}))
        +' : '+(x.v==null?'rien de saisi':D.fmt(x.v)+(x.semaine?' en moyenne':'')))+'">'
      +'<div class="cso-b-z">'+(dense?'':'<span class="cso-b-v">'+(x.v==null?'-':escapeHtml(D.fmt(x.v)))+'</span>')
        +'<i style="height:'+(x.v==null?1.5:Math.max(1.5,pc(x.v)))+'%"></i></div>'
      +'<span class="cso-b-j">'+escapeHtml(x.lib)+'</span>'
      +(x.sous&&!dense?'<span class="cso-b-d">'+escapeHtml(x.sous)+'</span>':'')
      +'</div>';
  }).join('');
  const onglet=(k,l)=>'<button type="button" class="cso-onglet'+(E.vue===k?' actif':'')+'" aria-pressed="'+(E.vue===k)+'" onclick="csVue(\''+k+'\',\''+q+'\')">'+l+'</button>';
  const sous=E.vue==='7j'?'Évolution sur les 7 derniers jours':E.vue==='28j'?'Évolution sur les 28 derniers jours':'Moyenne de chaque semaine, sur 3 mois';
  return '<section class="cso-carte cso-graphe">'
    +'<div class="cso-g-tete"><span class="cso-g-ico">'+CS_ICO.barres+'</span>'
      +'<div><h4>'+D.graphe+'</h4><span>'+sous+'</span></div>'
      +'<div class="cso-onglets" role="group" aria-label="Période du graphique">'+onglet('7j','7 jours')+onglet('28j','28 jours')+onglet('3m','3 mois')+'</div></div>'
    +'<div class="cso-plot'+(dense?' cso-dense':'')+'"><div class="cso-axe">'+grilles
      +'<div class="cso-obj" style="bottom:'+pc(obj)+'%"><span>Objectif '+escapeHtml(D.fmt(obj))+'</span></div></div>'
      +'<div class="cso-barres">'+b+'</div></div>'
    +'</section>';
}
function _htmlDomaineCoach(c,quoi){
  if(!c) return '';
  const q=_csQ(quoi), D=CS_DOM[q], E=_csEtat[q];
  const s=csSemaine(c,E.off,q);
  const t=csTendance(s,q);
  const bil=bilanDomaineCoach(c,q,COACH_FENETRE_JOURS);
  const reg=q==='sommeil'?regulariteCoucher(c):null;
  const ecart=s.moy==null?null:s.moy-s.obj;
  let opts='';
  for(let k=0;k>=-11;k--) opts+='<option value="'+k+'"'+(k===E.off?' selected':'')+'>'
    +(k===0?'7 derniers jours':k===-1?'Semaine précédente':'Il y a '+(-k)+' semaines')+'</option>';
  const libPer=E.off===0?'7 derniers jours':E.off===-1?'Semaine précédente':'Il y a '+(-E.off)+' semaines';
  const part=s.moy==null?0:Math.min(1,s.moy/s.obj);
  const C=2*Math.PI*42;
  const nivA=sanNiveau(q,s.moy,s.obj)||'vide';
  const points=s.jours.map(j=>'<i data-e="'+(j.v==null?'vide':(j.v>=j.o?'ok':'bas'))+'" title="'
    +escapeHtml(_csJour(j.d,true)+' : '+(j.v==null?'rien de saisi':D.fmt(j.v)))+'"></i>').join('');
  // L'OBJECTIF : une valeur pour le sommeil, ON et OFF pour les pas.
  let objV=escapeHtml(D.fmt(s.obj)), objS='';
  if(q==='pas'){
    const g=(c&&c.stepsGoals)||STEPS_GOALS_DEFAUT;
    const off=Number(g&&g.off)>0?Number(g.off):null;
    objS=(off!=null?'les jours ON · '+escapeHtml(D.fmt(off))+' les jours OFF':'les jours ON')+(c&&c.stepsGoals?'':' (par défaut)');
  }
  // LES POINTS D'ATTENTION : ce qui demande un oeil, et seulement ca.
  const att=[];
  const silence=_htmlSilenceCoach(bil,q);
  if(silence) att.push({ico:'alerte',ton:'rouge',t:'Aucune saisie récente',d:silence.replace(/<[^>]*>/g,''),vise:[]});
  if(s.courtes.length) att.push({ico:'flecheBas',ton:'rouge',
    t:q==='sommeil'?s.courtes.length+' nuit'+(s.courtes.length>1?'s':'')+' < 6h':_csPl(s.courtes.length,D,'très bas'),
    d:(q==='sommeil'?'Moins de 6 h : ':'Sous le quart de l’objectif du jour : ')
      +s.courtes.map(j=>_csJour(j.d)+' '+_csDate(j.d)).join(', ')+'.',vise:s.courtes.map(j=>j.iso)});
  if(s.vides.length) att.push({ico:'moins',ton:'orange',t:_csPl(s.vides.length,D,'non renseigné'),
    d:'Donnée manquante : '+s.vides.map(j=>_csJour(j.d,true)).join(', ')+'.',vise:s.vides.map(j=>j.iso)});
  const attH=att.length?att.map(a=>'<button type="button" class="cso-att" data-ton="'+a.ton+'"'
      +(a.vise.length?' onclick="csViser('+escapeHtml(JSON.stringify(a.vise))+',\''+q+'\')"':'')+'>'
      +'<span class="cso-att-i">'+CS_ICO[a.ico]+'</span><span class="cso-att-c"><b>'+escapeHtml(a.t)+'</b><span>'+escapeHtml(a.d)+'</span></span>'
      +(a.vise.length?'<span class="cso-chev">'+CS_ICO.droite+'</span>':'')+'</button>').join('')
    :'<div class="cso-rien">Rien à signaler sur cette période.</div>';
  // CE QUE LE COACH EN RETIENT : des constats chiffres, pas des conseils.
  const ins=[];
  if(s.lus){
    const bon=s.atteints>=Math.ceil(s.lus*.7);
    ins.push({ico:bon?'hausse':'flecheBas',ton:bon?'vert':'orange',t:bon?'Bonne régularité':'Objectif peu atteint',
      d:_csPl(s.atteints,D)+' sur '+_csPl(s.lus,D,'renseigné')+' atteignent '
        +(q==='sommeil'?'l’objectif de '+sanHM(s.obj):'l’objectif du jour')+'.'});
  }
  if(reg) ins.push({ico:'lune',ton:'bleu',t:'Heure du coucher',
    d:'± '+reg.ecart+' min autour de '+_libHeure(reg.moyenne)+', sur '+reg.n+' nuit'+(reg.n>1?'s':'')+'.'});
  if(q==='pas'&&s.meilleur) ins.push({ico:'etoile',ton:'bleu',t:'Meilleur jour',
    d:_csJour(s.meilleur.d,true)+' '+_csDate(s.meilleur.d)+' : '+D.fmt(s.meilleur.v)+' pas.'});
  if(s.courtes.length) ins.push({ico:'engrenage',ton:'gris',t:'Focus',
    d:q==='sommeil'
      ?'Surveiller la récupération après '+(s.courtes.length>1?'les nuits':'la nuit')+' de moins de 6 h ('+s.courtes.map(j=>_csJour(j.d)).join(', ')+').'
      :'Surveiller l’activité '+(s.courtes.length>1?'des jours':'du jour')+' très bas ('+s.courtes.map(j=>_csJour(j.d)).join(', ')+').'});
  const insH=ins.length?ins.map(a=>'<div class="cso-ins" data-ton="'+a.ton+'"><span class="cso-att-i">'+CS_ICO[a.ico]+'</span>'
      +'<span class="cso-att-c"><b>'+escapeHtml(a.t)+'</b><span>'+escapeHtml(a.d)+'</span></span></div>').join('')
    :'<div class="cso-rien">Pas encore de donnée à analyser.</div>';
  const ligne=(l,v)=>'<div class="cso-l"><span>'+l+'</span><b>'+v+'</b></div>';
  let m14=null; if(q==='pas'){ try{ m14=moyennePas14j(c); }catch(e){ m14=null; } }
  const Nom=D.noms.charAt(0).toUpperCase()+D.noms.slice(1);
  return '<div class="cso" data-quoi="'+q+'">'
    +'<section class="cso-carte cso-tete">'
      +'<span class="cso-t-ico">'+CS_ICO[D.ico]+'</span>'
      +'<div class="cso-t-c"><h3>'+D.titre+'</h3><span>'+D.sous+'</span></div>'
      +'<label class="cso-per">'+CS_ICO.calendrier+'<span>'+libPer+'</span>'+CS_ICO.bas
        +'<select onchange="csPeriode(this.value,\''+q+'\')" aria-label="Période">'+opts+'</select></label>'
      +_htmlSyncCoach(_sanSyncCoachLire(c))
    +'</section>'
    +'<div class="cso-kpis">'
      +'<div class="cso-carte cso-k cso-k-moy"><span class="cso-k-ico">'+(q==='sommeil'?CS_ICO.lit:CS_ICO.marche)+'</span><div>'
        +'<span class="cso-k-l">Moyenne (7 jours)</span>'
        +'<div class="cso-k-v"><strong>'+(s.moy==null?'-':escapeHtml(D.fmt(s.moy)))+'</strong>'
          +(ecart==null?'':'<em data-sens="'+(ecart>=0?'haut':'bas')+'">'+(ecart>=0?'▲ +':'▼ -')+escapeHtml(D.fmt(Math.abs(ecart)))+'</em>')+'</div>'
        +'<span class="cso-k-s">'+(ecart==null?'rien de saisi':'par rapport à l’objectif')+'</span></div></div>'
      +'<div class="cso-carte cso-k"><span class="cso-k-ico cso-gris">'+CS_ICO.cible+'</span><div>'
        +'<span class="cso-k-l">Objectif</span><div class="cso-k-v"><strong>'+objV+'</strong></div>'
        +(objS?'<span class="cso-k-s">'+objS+'</span>':'')+'</div>'
        +'<button type="button" class="cso-edit" onclick="csObjectif(\''+q+'\')" aria-label="Modifier l’objectif">'+CS_ICO.crayon+'</button></div>'
      +'<div class="cso-carte cso-k"><div class="cso-anneau" data-niv="'+nivA+'"><svg viewBox="0 0 100 100" aria-hidden="true">'
          +'<circle cx="50" cy="50" r="42" class="cso-an-f"/><circle cx="50" cy="50" r="42" class="cso-an-p" stroke-dasharray="'+(C*part).toFixed(1)+' '+C.toFixed(1)+'"/></svg>'
          +'<span>'+Math.round(part*100)+'%</span></div><div>'
        +'<span class="cso-k-l">'+Nom+' atteint'+(D.f?'e':'')+'s</span><div class="cso-k-v"><strong>'+s.atteints+' / 7</strong></div>'
        +'<span class="cso-points" role="img" aria-label="'+s.atteints+' '+D.noms+' sur 7 atteignent l’objectif">'+points+'</span></div></div>'
      +'<button type="button" class="cso-carte cso-k cso-k-tend" onclick="csVue(\'28j\',\''+q+'\')" aria-label="Voir 28 jours"><span class="cso-k-ico cso-gris">'+CS_ICO.barres+'</span><div>'
        +'<span class="cso-k-l">Tendance</span><div class="cso-k-v"><strong class="cso-k-t" data-sens="'+t.sens+'">'+t.lib+'</strong></div>'
        +'<span class="cso-k-s">'+escapeHtml(t.phrase)+'</span></div><span class="cso-chev">'+CS_ICO.droite+'</span></button>'
    +'</div>'
    +_htmlCsGraphe(c,q)
    +'<div class="cso-bas">'
      +'<section class="cso-carte cso-det"><div class="cso-s-t" data-ton="violet">'+CS_ICO.camembert+'<h4>Détails de la semaine</h4></div>'
        +ligne('Moyenne 7 jours',s.moy==null?'-':escapeHtml(D.fmt(s.moy)))
        +(q==='pas'?ligne('Moyenne 14 jours',m14==null?'-':escapeHtml(D.fmt(m14))):'')
        +ligne('Moyenne 28 jours',bil.moyenne==null?'-':escapeHtml(D.fmt(bil.moyenne)))
        +ligne(Nom+' renseigné'+(D.f?'e':'')+'s',s.lus+' / 7')
        +ligne(Nom+' atteignant l’objectif',s.atteints+' / 7')
        +ligne('Renseigné sur '+bil.fenetre+' jours',bil.renseignes+' / '+bil.fenetre)
        +(reg?ligne('Régularité des couchers','± '+reg.ecart+' min'):'')
        +(bil.fcRepos?ligne('FC de repos ('+bil.fenetre+' j)',bil.fcRepos.moyenne+' bpm · '+bil.fcRepos.n+' mesure'+(bil.fcRepos.n>1?'s':'')):'')
        +(bil.vfc?ligne('VFC '+_libVfc(bil.vfc.methode)+' ('+bil.fenetre+' j)',bil.vfc.moyenne+' ms · '+bil.vfc.n+' mesure'+(bil.vfc.n>1?'s':'')):'')
        +'<div class="cso-note">'+D.note+'</div>'
      +'</section>'
      +'<section class="cso-carte cso-attn"><div class="cso-s-t" data-ton="orange">'+CS_ICO.alerte+'<h4>Points d’attention</h4></div>'+attH+'</section>'
      +'<section class="cso-carte cso-insc"><div class="cso-s-t" data-ton="bleu">'+CS_ICO.ampoule+'<h4>Insights <span>coach</span></h4></div>'+insH+'</section>'
    +'</div>'
    +'</div>';
}
function _htmlSommeilCoach(c){ return _htmlDomaineCoach(c,'sommeil'); }
function _htmlPasCoach(c){ return _htmlDomaineCoach(c,'pas'); }
function renderSommeilCoach(c){
  const z=document.getElementById('ccd-sommeil');
  if(!z) return;
  let h=''; try{ h=_htmlSommeilCoach(c); }catch(e){ h=''; }
  z.innerHTML=h; z.style.display=h?'':'none';
}
function renderPasCoach(c){
  const z=document.getElementById('ccd-pas');
  if(!z) return;
  let h=''; try{ h=_htmlPasCoach(c); }catch(e){ h=''; }
  z.innerHTML=h; z.style.display=h?'':'none';
}
function _csRepeindre(q){ try{ const c=getOwnedClient(currentClientId); if(!c) return;
  if(_csQ(q)==='pas') renderPasCoach(c); else renderSommeilCoach(c); }catch(e){} }
function csPeriode(v,q){ const E=_csEtat[_csQ(q)]; const n=Math.round(Number(v)); E.off=(isFinite(n)&&n<=0)?n:0; E.vise=null; _csRepeindre(q); }
function csVue(v,q){ const E=_csEtat[_csQ(q)]; E.vue=(v==='28j'||v==='3m')?v:'7j'; E.vise=null; _csRepeindre(q); }
// Un point d'attention allume les jours dont il parle, sur le graphe 7 jours.
function csViser(isos,q){ const E=_csEtat[_csQ(q)]; E.vue='7j';
  E.vise=(E.vise&&E.vise.join()===(isos||[]).join())?null:(isos||[]); _csRepeindre(q);
  try{ document.querySelector('#ccd-'+_csQ(q)+' .cso-graphe').scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){} }
// L'OBJECTIF, POSE PAR LE COACH. Pour les pas, le formulaire ON / OFF qui
// existait deja (_htmlObjectifsCoach, coachPoserObjectifsPas) ; pour le
// sommeil, le meme patron — et le meme piege : sans la carte `users`,
// getOwnedClient rend un objet detache, et la modification disparait.
function csObjectif(q){
  const c=getOwnedClient(currentClientId);
  if(!c) return;
  if(_csQ(q)==='pas'){ _sanFeuille('Objectifs de pas',_htmlObjectifsCoach(c)); return; }
  _sanFeuille('Objectif de sommeil',
    '<label class="san-lab">Objectif par nuit</label>'
    +'<input id="cso-obj" inputmode="text" placeholder="8h00" value="'+escapeHtml(sanHM(sanObjSommeil(c)))+'">'
    +'<div class="san-aide">« 8h », « 7h30 » ou « 450 » minutes. L’athlète peut le changer depuis son écran : c’est alors sa valeur qui s’applique.</div>'
    +'<button type="button" class="btn btn-red" style="width:100%;margin:14px 0 0" onclick="csObjectifEnregistrer()">Enregistrer</button>');
}
function csObjectifEnregistrer(){
  const m=sanLireDuree((document.getElementById('cso-obj')||{}).value||'');
  if(m==null||m<240||m>720){ toast('Un objectif entre 4h et 12h','var(--orange)'); return false; }
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  c.sleepGoal=m;
  c.updatedAt=Date.now();
  if(c.email) users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  sanFermer();
  try{ renderSommeilCoach(c); }catch(e){}
  toastSync(ok,envoi,'Objectif posé','l\'objectif est');
  return true;
}
function _htmlRecuperationCoach(c){
  const r=scoreRecuperation(c);
  if(!r.points) return '';
  const ligne=r.criteres.map(x=>x.lib.toLowerCase()+' ('+x.valeur+')').join(' · ');
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px">Récupération</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(ligne)}.</div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-top:8px">Ce qui va dans le même sens en ce moment, d'après ce qu'elle ou il a saisi. Aucun seuil n'est franchi : c'est une conversation à avoir.</div>
  </div>`;
}
// ── Restitution athlète : UNE phrase, à partir du seuil ──────────────────
// Aucune étiquette, aucun score, aucune couleur. Le chiffre reste dedans.
const RECUP_PHRASE_ATHLETE='Ton sommeil, ton ressenti et ton volume vont dans '
  +'le même sens en ce moment. Ça vaut le coup d\'en parler à ton coach.';
function _htmlRecuperationAthlete(user){
  let r;
  try{ r=scoreRecuperation(user); }catch(e){ return ''; }
  if(r.points<RECUP_SEUIL_MESSAGE) return '';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-4);padding:14px;margin-bottom:20px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(RECUP_PHRASE_ATHLETE)}</div>
  </div>`;
}
// ── Sur Lifestyle : LA MEME PHRASE, MAIS ON MONTRE SUR QUOI ELLE S'APPUIE ─
//
// L'athlete lisait « ton sommeil, ton ressenti et ton volume vont dans le meme
// sens » sans jamais savoir CE QUI avait produit la phrase. Le coach, lui, voit
// les criteres remplis depuis toujours (_htmlRecuperationCoach). Le meme
// dossier, deux niveaux d'explication : celui qui vit la fatigue en savait
// moins que celui qui la commente.
//
// ON DECRIT, ON NE PRESCRIT PAS. La regle est ecrite noir sur blanc dans ce
// fichier : aucun conseil de sommeil, d'alimentation ni de moral n'est genere.
// Ce bloc n'ajoute donc AUCUN texte : il reprend les libelles et les chiffres
// que scoreRecuperation a deja produits — « sommeil court (6h10 sur 5 nuits) »
// — et la phrase existante, inchangee. Pas de verbe a l'imperatif, pas de
// seuil affiche comme un verdict, pas de score.
//
// LE SEUIL NE BOUGE PAS NON PLUS. RECUP_SEUIL_MESSAGE reste ce qui decide de
// parler : montrer les criteres des le premier ferait un encart permanent chez
// quiconque dort mal une semaine.
function _htmlRecuperationLifestyle(user){
  let r;
  try{ r=scoreRecuperation(user); }catch(e){ return ''; }
  if(!r||r.points<RECUP_SEUIL_MESSAGE) return '';
  const lignes=(r.criteres||[]).map(x=>
    `<div class="san-fait"><span class="san-fait-l">${escapeHtml(x.lib)}</span>`
    +`<span class="san-fait-v" style="color:var(--text)">${escapeHtml(String(x.valeur))}</span></div>`).join('');
  return `<section class="san-carte">
    <div class="san-tete"><h2 class="san-t">Ce qui va dans le même sens</h2></div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7;margin-bottom:12px">${escapeHtml(RECUP_PHRASE_ATHLETE)}</div>
    <div class="san-faits" style="border-top:1px solid var(--surface-2);padding-top:10px;margin-bottom:0">${lignes}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">D'après ce que tu as saisi. Aucun seuil n'est franchi : c'est une conversation à avoir avec ton coach.</div>
  </section>`;
}
// N2.8 — LE MESSAGE NOMME LA REGLE QUI A REELLEMENT PRODUIT LE NOMBRE.
// Il citait TOUJOURS KCAL_PLANCHER_PAR_KG — « 22 kcal/kg » — alors que
// plancherEffectif rend un champ `regle` qui peut valoir masse_maigre (30 kcal
// par kilo de masse maigre), poids_total ou absolu, et un drapeau `plafonne`
// quand la valeur a ete ramenee a 85 % de la depense estimee. Des qu'un
// athlete avait ses tours de mesure au dossier, le chiffre annonce et la regle
// citee a cote ne correspondaient plus : le coach ne pouvait pas refaire le
// calcul a la main, ce qui est le seul usage d'un message pareil.
//
// PURE, et elle ne CHOISIT rien : elle DIT ce que plancherEffectif a decide.
// Aucune valeur de plancher ne change, aucun ordre de calcul non plus.
function direRegplePlancher(pl){
  if(!pl) return '';
  const nb=v=>String(Math.round(v*10)/10).replace('.',',');
  let coeur;
  if(pl.regle==='masse_maigre'&&pl.masseMaigre!=null)
    coeur=KCAL_PLANCHER_PAR_KG_MM+' kcal/kg de masse maigre pour '
      +nb(pl.masseMaigre)+' kg de masse maigre'
      // N2.9 — le coach doit pouvoir refaire le nombre a la main : la depense
      // d'entrainement en fait partie, et elle est donc ecrite.
      +(pl.depenseExercice>0?', plus '+pl.depenseExercice+' kcal d’entraînement':'');
  else if(pl.regle==='poids_total'&&pl.poids!=null)
    coeur=KCAL_PLANCHER_PAR_KG+' kcal/kg pour '+nb(pl.poids)+' kg';
  else if(pl.regle==='absolu')
    coeur='minimum absolu de '+pl.abs+' kcal'
      +(pl.poids==null?', poids inconnu':', au-dessus de la règle proportionnelle');
  else return '';
  // LE PLAFONNEMENT SE DIT QUAND IL A JOUE. Sans lui, le coach retrouve un
  // nombre plus grand que celui affiche et croit a une erreur.
  const plaf=pl.plafonne
    ? ', ramené à '+Math.round(PLANCHER_PLAFOND_DEPENSE*100)+' % de la dépense estimée'
    : '';
  return ' ('+coeur+plaf
    +(pl.regle==='absolu'?'':', minimum absolu '+pl.abs)+')';
}
function controlerMacros(macros,user){
  const out=[];
  if(!macros||typeof macros!=='object') return out;
  const pl=plancherEffectif(user);
  const jours=('on' in macros||'off' in macros)
    ? [['on',macros.on],['off',macros.off]]
    : [['',macros]];
  for(const [nom,j] of jours){
    if(!j||typeof j!=='object') continue;
    const pref=nom?nom+'.':'';
    const lib=nom==='on'?' les jours ON':(nom==='off'?' les jours OFF':'');
    const kcal=Number(j.kcal);
    if(isFinite(kcal)&&kcal>0&&kcal<pl.kcal)
      out.push({champ:pref+'kcal',valeur:kcal,plancher:pl.kcal,
        message:kcal+' kcal'+lib+' pour un plancher de '+pl.kcal+' kcal'
          +direRegplePlancher(pl)
          +(pl.tca?', plancher majoré de 15 % : antécédent déclaré au bilan':'')});
    const p=Number(j.p);
    if(pl.p!=null&&isFinite(p)&&p>0&&p<pl.p)
      out.push({champ:pref+'p',valeur:p,plancher:pl.p,
        message:p+' g de protéines'+lib+' pour un plancher de '+String(pl.p).replace('.',',')+' g ('+PROT_PLANCHER_G_KG+' g/kg)'});
    const l=Number(j.l);
    if(pl.l!=null&&isFinite(l)&&l>0&&l<pl.l)
      out.push({champ:pref+'l',valeur:l,plancher:pl.l,
        message:l+' g de lipides'+lib+' pour un plancher de '+String(pl.l).replace('.',',')+' g ('+LIP_PLANCHER_G_KG+' g/kg)'});
  }
  return out;
}

// ── Restriction prolongée ──────────────────────────────────────────────────
// Une sèche qui dure ET des objectifs à ras du plancher. Le seuil est le
// plancher majoré de 10 % : à 22 kcal/kg pile on est déjà au sol, et attendre
// d'y être vraiment pour le dire serait attendre trop longtemps.
const RESTRICTION_SEMAINES=16;
const RESTRICTION_MARGE=1.1;
// ══════════════════════ PAUSE DIÉTÉTIQUE ══════════════════════
// restrictionProlongee détecte depuis longtemps une sèche de seize semaines ou
// plus menée sous le plancher, et le signal remonte au coach avec la phrase
// « Un palier est à envisager ». Le palier n'existait pas. Le voici : une pause
// CHIFFRÉE, proposée, jamais appliquée toute seule.
//
// Rien n'est automatique dans ce module. Aucune notification n'en part, aucune
// écriture ne se fait sans un clic, et la fin d'une pause ne se déclenche jamais
// d'elle-même.
const PAUSE_JOURS_DEFAUT=12;             // dans la fourchette 10-14
const PAUSE_JOURS_MIN=10, PAUSE_JOURS_MAX=21;
const TRANSITION_PALIERS=3;              // paliers hebdomadaires de sortie
// PURE. Rend l'objet pause quand il est exploitable, null sinon.
// ATTENTION : une pause DÉPASSÉE reste ACTIVE. Le coach peut être absent une
// semaine ; redescendre les calories sans décision serait pire que manger à la
// dépense quelques jours de trop. La fin se demande, elle ne se prend pas.
function pauseActive(user){
  const p=user&&user.phase&&user.phase.pause;
  if(!p||!(p.debut>0)) return null;
  const j=Number(p.jours);
  if(!(j>0)) return null;
  return p;
}
// Vrai quand le terme prévu est passé : l'encart de fin s'affiche, la pause
// reste active.
function pauseTerminee(user,ref){
  const p=pauseActive(user);
  if(!p) return false;
  const t=(ref instanceof Date)?ref.getTime():Date.now();
  return t>=p.debut+Number(p.jours)*864e5;
}
function pauseJoursRestants(user,ref){
  const p=pauseActive(user);
  if(!p) return null;
  const t=(ref instanceof Date)?ref.getTime():Date.now();
  return Math.ceil((p.debut+Number(p.jours)*864e5-t)/864e5);
}
// Objectifs d'une pause : on monte à la DÉPENSE ESTIMÉE, pas à une maintenance
// déjà corrigée par la phase. Protéines et lipides ne bougent pas — même
// contrat qu'appliquerAjustement, et c'est tout l'intérêt : la hausse est
// portée par les glucides, le reste de l'assiette ne change pas.
function _pauseMacrosCibles(user,cible){
  const m=((user&&user.nutrition)||{}).macros;
  if(!m||!(cible>0)) return null;
  const un=j=>{
    const b=m[j];
    if(!b||!(Number(b.kcal)>0)) return null;
    const p=Number(b.p)||0, l=Number(b.l)||0;
    const reste=cible-4*p-9*l;
    return {kcal:Math.round(cible),p:b.p,l:b.l,
      g:Math.max(0,Math.round(reste/4)),
      f:Math.round(FIBRES_PAR_1000*cible/1000)};
  };
  const on=un('on'), off=un('off');
  if(!on||!off) return null;
  return {on,off};
}
// PURE. Ce que la pause proposerait, sans rien écrire. Rend null quand il n'y a
// rien à proposer — c'est l'appelant qui décide d'afficher.
// INTERRUPTEUR UNIQUE, volontairement a false.
//
// Partout ailleurs dans le produit, un antecedent alimentaire declare COUPE la
// fonctionnalite. La pause faisait exception : elle REMONTE les calories, donc
// la direction est protectrice, et refuser d en parler a un coach pour un
// athlete en restriction depuis quatre mois est un autre risque.
//
// L argument se defend, mais il n a PAS ete valide par un professionnel de
// sante. Tant qu il ne l est pas, le produit retombe sur sa regle par defaut :
// on ne propose rien. Le jour ou l avis arrive, il n y a qu un booleen a
// basculer — la branche est ecrite, testee, et les deux comportements sont
// couverts par la suite.
const PAUSE_PROPOSABLE_SOUS_TCA=false;
function pauseProposee(user){
  if(!user) return null;
  if(!PAUSE_PROPOSABLE_SOUS_TCA){
    // Rend null, et c est VOULU : appliquerPause fait `if(!prop)`, et un
    // objet de refus y serait truthy — une pause partirait avec des valeurs
    // indefinies. Le REFUS est porte par l ecran, qui affiche
    // PAUSE_MENTION_TCA : il est deja explicite, il n est pas muet.
    try{ if(aTCA(user)) return null; }catch(e){}
  }
  if(pauseActive(user)) return null;                 // déjà en pause
  if(!_restrictionBrute(user)) return null;
  let dep=null;
  try{ const b=besoinsProposes(user); dep=b&&b.depense; }catch(e){}
  if(!(dep>0)) return null;
  const macros=_pauseMacrosCibles(user,dep);
  if(!macros) return null;
  const m=user.nutrition.macros;
  const bas=Math.min(Number(m.on&&m.on.kcal)||Infinity,Number(m.off&&m.off.kcal)||Infinity);
  return {jours:PAUSE_JOURS_DEFAUT,kcalCible:Math.round(dep),
    kcalActuel:isFinite(bas)?bas:null,
    semaines:semainesEcoulees(user),macros};
}

// ── Application, fin, transition ────────────────────────────────────────────
// Tout part d'un CLIC. Aucune de ces fonctions ne s'appelle toute seule.
// Écriture sur le dossier de l'ATHLÈTE, par la carte des utilisateurs, comme
// programmerDecharge : _coachEditClient est réservé à l'éditeur de séances.
function _pauseCible(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  return c?{users,c}:null;
}
function appliquerPause(jours){
  const r=_pauseCible(); if(!r) return false;
  const {users,c}=r;
  if(!c.email){ toast('Cet élève n\'a pas de dossier synchronisé','var(--orange)'); return false; }
  const prop=pauseProposee(c);
  if(!prop){ toast('Cette proposition n\'est plus d\'actualité','var(--orange)'); return false; }
  const j=Math.max(PAUSE_JOURS_MIN,Math.min(PAUSE_JOURS_MAX,parseInt(jours,10)||PAUSE_JOURS_DEFAUT));
  const m=c.nutrition.macros;
  // kcalAvant est la SEULE trace de ce qu'il faudra restaurer : on la copie en
  // profondeur, sinon l'écriture qui suit l'écraserait.
  const avant=JSON.parse(JSON.stringify({on:m.on||{},off:m.off||{}}));
  c.phase.pause={debut:Date.now(),jours:j,kcalAvant:avant};
  c.nutrition.macros=Object.assign({},m,{on:prop.macros.on,off:prop.macros.off,
    origine:'pause',origineDate:Date.now()});
  _pauseJournaliser(c,'pause_debut',{jours:j,kcal:prop.kcalCible});
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _viderCachePlateau(); _viderCacheSignaux();
  toastSync(ok,CLOUD.pushOne(c.email,c),'Pause de '+j+' jours enregistrée','la pause est');
  try{ renderCoachNutriSection(getOwnedClient(currentClientId)); }catch(e){}
  return true;
}
// Fin de pause : DEUX sorties, aucune par défaut.
function reprendreSeche(){
  const r=_pauseCible(); if(!r) return false;
  const {users,c}=r;
  const p=pauseActive(c);
  if(!p) return false;
  const av=p.kcalAvant;
  if(!av||!av.on||!av.off){
    toast('Les objectifs d\'avant la pause sont introuvables : passe en maintien','var(--orange)');
    return false;
  }
  c.nutrition.macros=Object.assign({},c.nutrition.macros,{on:av.on,off:av.off,
    origine:'pause_fin',origineDate:Date.now()});
  delete c.phase.pause;
  _pauseJournaliser(c,'pause_fin_reprise',{});
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _viderCachePlateau(); _viderCacheSignaux();
  toastSync(ok,CLOUD.pushOne(c.email,c),'Sèche reprise','la reprise est');
  try{ renderCoachNutriSection(getOwnedClient(currentClientId)); }catch(e){}
  return true;
}
// ── Sortie progressive ──────────────────────────────────────────────────────
// Trois paliers hebdomadaires égaux entre les kcal ACTUELLES et la cible. On ne
// remonte pas de 500 kcal d'un coup après quatre mois de restriction — et on ne
// le fait pas non plus en silence : chaque palier est une écriture normale,
// journalisée, que le coach peut sauter.
// PURE : rend la liste des paliers, sans rien écrire.
function paliersTransition(kcalDepart,kcalCible,n){
  const d=Number(kcalDepart), c=Number(kcalCible);
  const k=Math.max(1,parseInt(n,10)||TRANSITION_PALIERS);
  if(!(d>0)||!(c>0)) return [];
  const out=[];
  for(let i=1;i<=k;i++) out.push(Math.round(d+(c-d)*i/k));
  // Le DERNIER palier vaut exactement la cible, quels que soient les arrondis.
  out[out.length-1]=Math.round(c);
  return out;
}
function _pauseJournaliser(c,quoi,extra){
  if(!c.nutrition) c.nutrition={};
  const n=c.nutrition;
  if(!Array.isArray(n.ajustHisto)) n.ajustHisto=[];
  n.ajustHisto.push(Object.assign({date:Date.now(),origine:quoi},extra||{}));
  if(n.ajustHisto.length>12) n.ajustHisto=n.ajustHisto.slice(-12);
}

// ── Transition en paliers ───────────────────────────────────────────────────
// Le passage de sèche à maintien ou masse se fait en TRANSITION_PALIERS étapes
// hebdomadaires. Chaque palier est une écriture normale dans nutrition.macros,
// journalisée avec origine 'transition'. Protéines et lipides ne bougent pas —
// même contrat que partout ailleurs dans ce module.
async function ouvrirTransitionMaintien(){
  const r=_pauseCible(); if(!r) return false;
  const {c}=r;
  let dep=null;
  try{ const b=besoinsProposes(c); dep=b&&b.depense; }catch(e){}
  if(!(dep>0)){ toast('Dépense non calculable : renseigne le bilan','var(--orange)'); return false; }
  const m=(c.nutrition||{}).macros||{};
  const bas=Math.min(Number(m.on&&m.on.kcal)||Infinity,Number(m.off&&m.off.kcal)||Infinity);
  if(!isFinite(bas)){ toast('Aucun objectif à faire évoluer','var(--orange)'); return false; }
  const pal=paliersTransition(bas,dep,TRANSITION_PALIERS);
  if(!pal.length) return false;
  const txt='Sortie progressive en '+pal.length+' paliers hebdomadaires :'
    +String.fromCharCode(10)+pal.map((k,i)=>'· semaine '+(i+1)+' : '+k+' kcal').join(String.fromCharCode(10))
    +String.fromCharCode(10)+String.fromCharCode(10)
    +'Protéines et lipides ne changent pas. Tu peux appliquer les paliers un par '
    +'un, ou sauter directement à la cible.';
  if(!await rcConfirm(txt+String.fromCharCode(10)+String.fromCharCode(10)+'Enregistrer le PREMIER palier ?',null,'Enregistrer')){
    return false;
  }
  return appliquerPalierTransition(0);
}
// Applique le palier d'indice i. Le coach peut sauter les paliers en appelant
// directement le dernier : rien ne verrouille l'ordre, c'est sa décision.
function appliquerPalierTransition(i){
  const r=_pauseCible(); if(!r) return false;
  const {users,c}=r;
  if(!c.email){ toast('Cet élève n\'a pas de dossier synchronisé','var(--orange)'); return false; }
  let dep=null;
  try{ const b=besoinsProposes(c); dep=b&&b.depense; }catch(e){}
  const m=(c.nutrition||{}).macros||{};
  const bas=Math.min(Number(m.on&&m.on.kcal)||Infinity,Number(m.off&&m.off.kcal)||Infinity);
  if(!(dep>0)||!isFinite(bas)) return false;
  const depart=(c.phase&&c.phase.transition&&c.phase.transition.depart)||bas;
  const pal=paliersTransition(depart,dep,TRANSITION_PALIERS);
  const idx=Math.max(0,Math.min(pal.length-1,parseInt(i,10)||0));
  const cible=pal[idx];
  const cibles=_pauseMacrosCibles(c,cible);
  if(!cibles) return false;
  c.nutrition.macros=Object.assign({},m,{on:cibles.on,off:cibles.off,
    origine:'transition',origineDate:Date.now()});
  // Le point de DEPART est fige au premier palier : sans lui, chaque palier
  // recalculerait la progression depuis la valeur deja relevee, et les trois
  // paliers ne mèneraient jamais à la cible.
  if(!c.phase) c.phase={};
  c.phase.transition={depart,palier:idx+1,total:pal.length,maj:Date.now()};
  // Une transition met fin a la pause : on ne peut pas etre en pause et en
  // sortie progressive en meme temps.
  if(c.phase.pause) delete c.phase.pause;
  _pauseJournaliser(c,'transition',{palier:idx+1,total:pal.length,kcal:cible});
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  _viderCachePlateau(); _viderCacheSignaux();
  toastSync(ok,CLOUD.pushOne(c.email,c),
    'Palier '+(idx+1)+' sur '+pal.length+' appliqué ('+cible+' kcal)','le palier est');
  try{ renderCoachNutriSection(getOwnedClient(currentClientId)); }catch(e){}
  return true;
}

// ── Encarts, fiche COACH uniquement ─────────────────────────────────────────
// Rien de ce module n'est poussé à l'athlète. C'est une décision de coaching :
// elle se prend avec le coach, pas seul devant un écran.
//
// GARDE-FOU TCA — RÈGLE À FAIRE VALIDER AVANT MISE EN PRODUCTION.
// Partout ailleurs dans le produit, un antécédent alimentaire déclaré COUPE la
// fonctionnalité. Ici, la pause reste proposable : elle REMONTE les calories,
// donc la direction est protectrice, et refuser d'en parler à un coach pour un
// athlète en restriction depuis quatre mois serait un autre risque. La règle
// n'est pas tranchée pour autant : elle doit être validée par un professionnel
// de santé, et l'encart le dit au coach en attendant.
const PAUSE_MENTION_TCA='Antécédent alimentaire déclaré : RepCore ne propose pas '
  +'de pause automatiquement dans ce cas. Une pause reste possible, mais elle se '
  +'décide avec un professionnel de santé, pas depuis un écran.';
function _htmlPauseProposition(c){
  let tca=false; try{ tca=aTCA(c); }catch(e){}
  // Antecedent declare et interrupteur ferme : on ne se tait pas pour autant.
  // Le coach doit savoir que la restriction est vue, et pourquoi rien n est
  // propose — un silence se lirait comme « il n y a rien a signaler ».
  if(tca&&!PAUSE_PROPOSABLE_SOUS_TCA){
    if(!_restrictionBrute(c)||pauseActive(c)) return '';
    return `<div style="margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Restriction prolongée</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(PAUSE_MENTION_TCA)}</div>
      ${blocDisclaimerSante()}
    </div>`;
  }
  const prop=pauseProposee(c);
  if(!prop) return '';
  const phrase='Sèche de '+prop.semaines+' semaines'
    +(prop.kcalActuel?' à '+prop.kcalActuel+' kcal':'')
    +'. Pause de '+prop.jours+' jours à '+prop.kcalCible+' kcal ? '
    +'Protéines et lipides ne changent pas.';
  return `<div style="margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Pause diététique</div>
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(phrase)}</div>
    ${tca?`<div style="font-size:var(--fs-xs);color:var(--warning);line-height:1.6;margin-top:8px">${escapeHtml(PAUSE_MENTION_TCA)}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="appliquerPause(${prop.jours})">Proposer la pause</button>
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="refuserPause()">Pas maintenant</button>
    </div>
    ${blocDisclaimerSante()}
  </div>`;
}
// « Pas maintenant » n'écrit RIEN : la proposition reviendra tant que la
// restriction dure. Ce n'est pas un oubli — c'est le rappel d'un problème qui,
// lui, ne disparaît pas parce qu'on a fermé un encart.
function refuserPause(){
  toast('C\'est noté. La proposition restera tant que la restriction dure.');
}
function _htmlPauseEnCours(c){
  const p=pauseActive(c);
  if(!p) return '';
  const fini=pauseTerminee(c);
  const rest=pauseJoursRestants(c);
  const peutReprendre=!!(p.kcalAvant&&p.kcalAvant.on&&p.kcalAvant.off);
  if(!fini){
    return `<div style="margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Pause en cours</div>
      <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">Pause de ${p.jours} jours, encore ${rest} jour${rest>1?'s':''}. ${escapeHtml(PAUSE_TEXTE_VITESSE.charAt(0).toUpperCase()+PAUSE_TEXTE_VITESSE.slice(1))}.</div>
    </div>`;
  }
  return `<div style="margin-top:12px;background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Pause terminée</div>
    <div style="font-size:var(--fs-sm);color:var(--text);line-height:1.7">Ta pause est terminée. On reprend la sèche, ou on s'arrête là ?</div>
    ${peutReprendre?'':`<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:6px">Les objectifs d'avant la pause sont introuvables : seul le passage en maintien reste possible.</div>`}
    <div style="display:flex;gap:8px;margin-top:10px">
      ${peutReprendre?`<button class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="reprendreSeche()">Reprendre la sèche</button>`:''}
      <button class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="ouvrirTransitionMaintien()">Passer en maintien</button>
    </div>
  </div>`;
}
// finPrevue : le champ existait et n'était lu que par relancePhase, APRÈS
// l'échéance. Ici on parle AVANT, pour préparer la sortie. Les deux ne se
// marchent pas dessus : passé la date, cet encart se tait et relancePhase prend
// le relais.
const FIN_PREVUE_PREAVIS_JOURS=14;
function _htmlFinPrevue(c){
  const p=phaseCourante(c);
  if(!p||!p.finPrevue) return '';
  if(pauseActive(c)) return '';
  const j=Math.ceil((p.finPrevue-Date.now())/864e5);
  if(j<0||j>FIN_PREVUE_PREAVIS_JOURS) return '';
  return `<div style="margin-top:12px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">Ta ${escapeHtml(PHASES[p.type].apres)} se termine dans ${j} jour${j>1?'s':''}. On prépare la sortie ?</div>
    <button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="ouvrirTransitionMaintien()">Préparer la sortie</button>
  </div>`;
}

function restrictionProlongee(user){
  // Pendant une pause, il n'y a plus rien a signaler : la restriction est
  // justement en train d'etre levee. Le constat brut, lui, reste disponible
  // pour la proposition de pause elle-meme.
  if(pauseActive(user)) return false;
  return _restrictionBrute(user);
}
// PURE. Le CONSTAT, sans tenir compte d'une pause en cours.
function _restrictionBrute(user){
  const p=phaseCourante(user);
  if(!p||p.type!=='seche') return false;
  const sem=semainesEcoulees(user);
  if(sem==null||sem<RESTRICTION_SEMAINES) return false;
  const m=((user&&user.nutrition)||{}).macros;
  if(!m) return false;
  const pl=plancherEffectif(user);
  if(!(pl.poids>0)) return false;
  // Le seuil vient de plancherEffectif, jamais d'un recalcul local : deux
  // definitions du meme plancher divergeraient a la premiere evolution.
  const seuil=pl.kcal*RESTRICTION_MARGE;
  const kcals=[m.on,m.off].filter(x=>x&&Number(x.kcal)>0).map(x=>Number(x.kcal));
  if(!kcals.length) return false;
  // Le plus BAS des deux jours : c'est lui que l'athlète vit le plus souvent
  // sur une sèche longue.
  return Math.min.apply(null,kcals)<seuil;
}

