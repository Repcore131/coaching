// ══ LA FIN PAR « SUIVANT » (30/09/2026) ═════════════════════════════════
// Le dernier « Suivant » terminait la séance sans un mot : des séries notées
// mais pas validées n'étaient pas comptées (finishWorkout ne lit que done), et
// un double toucher sur « Suivant » finissait la séance au lieu de l'avancer.
//
// PURE. Les séries notées mais non validées, et le nombre de séries restantes.
// « Notée » : une charge ou des répétitions saisies. Une charge PROPOSÉE par
// l'app (isAuto) que l'athlète n'a pas touchée n'est pas une saisie — sinon
// la charge pré-remplie de chaque exercice ouvert poserait la question.
function seriesEnSuspens(st){
  const nonValideesSaisies=[];
  const sd=(st&&st.sessionData)||{};
  const sx=(st&&st.exercises)||[];
  const plein=v=>v!=null&&String(v).trim()!=='';
  for(let idx=0;idx<sx.length;idx++){
    const l=(sd[idx]&&sd[idx].sets)||[];
    l.forEach((x,i)=>{
      if(!x||x.done) return;
      const charge=plein(x.weight)&&!(x.isAuto&&!x.userEdited);
      if(charge||plein(x.repsDone)) nonValideesSaisies.push({idx,i});
    });
  }
  const c=comptesSeriesSeance(st);
  return {nonValideesSaisies,restantes:Math.max(0,c.total-c.fait),fait:c.fait,total:c.total};
}
const WO_NAV_DOUBLE_MS=400;
let _woNavDernier=0;
let _woFinEnCours=false;
async function _woTerminerDepuisNav(){
  if(_woFinEnCours) return false;
  _woFinEnCours=true;
  try{
    const e=seriesEnSuspens(woState);
    const n=e.nonValideesSaisies.length;
    const finir=incomplet=>{ localStorage.removeItem('rc_wo_state'); finishWorkout(!!incomplet); return true; };
    if(n){
      const choix=await rcConfirm3('Terminer la séance ?',
        n+' série'+(n>1?'s':'')+' notée'+(n>1?'s ne sont':' n’est')+' pas validée'+(n>1?'s':'')+'.',
        'Les valider et terminer','Terminer sans elles','Continuer');
      if(choix===null) return false;
      if(choix==='ok'){
        // Validées telles quelles : ni repos, ni animation, ni record — la séance se ferme.
        const t=Date.now();
        for(const {idx,i} of e.nonValideesSaisies){
          const x=woState.sessionData[idx].sets[i];
          x.done=true; if(!x.tValid) x.tValid=t;
        }
        return finir(false);
      }
      // « Terminer sans elles » : la règle de la moitié, comme ci-dessous.
      return finir(e.fait<e.total/2);
    }
    if(e.restantes>0){
      const ok=await rcConfirm('Terminer la séance ? '+e.fait+'/'+e.total+' séries faites.');
      if(!ok) return false;
      // Moins de la moitié : séance écourtée (complete:false), comme « Abandonner ».
      return finir(e.fait<e.total/2);
    }
    return finir(false);
  } finally { _woFinEnCours=false; }
}
function woNav(dir){
  // Un second « Suivant » dans les 400 ms est un double toucher, pas un geste.
  if(dir>0){
    const t=Date.now();
    if(t-_woNavDernier<WO_NAV_DOUBLE_MS) return;
    _woNavDernier=t;
  }
  // On navigue d'un GROUPE à l'autre : un superset est un seul écran, sinon
  // « suivant » ramènerait sur le second exercice déjà affiché.
  _ckStopChrono();
  const grs=_groupesEx(woState.exercises);
  const gi=grs.findIndex(g=>g.includes(woState.currentEx));
  const nxt=(gi<0?0:gi)+dir;
  if(nxt<0) return;
  if(nxt>=grs.length){ _woTerminerDepuisNav(); return; }
  woState.currentEx=grs[nxt][0];renderWoEx();woPersist();
  _arcGlissement(dir);
}
// ── ANIMATION 6 : LA TRANSITION ENTRE EXERCICES ────────────────────────────
// Un glissement de --arc-translate, JAMAIS un fondu — et c'est le sens du
// glissement qui
// porte l'information : le contenu de l'exercice suivant arrive par la droite
// et se pose en glissant vers la gauche ; un retour arrive par la gauche.
// L'athlète sait donc où il va sans lire un mot, et sans compter les écrans.
//
// Aucune opacité dans la variante normale : un fondu dirait « quelque chose a
// changé » quand le glissement dit « tu avances ». Ce sont deux phrases
// différentes, et une seule est vraie.
//
// La variante réduite, elle, N'A QUE l'opacité : sans mouvement il ne reste
// aucun moyen de signaler la transition, et ne rien signaler du tout ferait
// croire à un écran figé.
function _arcGlissement(dir){
  try{
    const z=document.getElementById('wo-content');
    if(!z||!z.animate) return null;
    if(arcReduit())
      return z.animate([{opacity:0.55},{opacity:1}],
        {duration:ARC.plat,easing:'linear',fill:'none'});
    // ══ L'AMPLITUDE REVIENT AU JETON ══════════════════════════════════
    //
    // Elle valait 28 en dur, avec pour motif que « le glissement n'est plus
    // double par le fondu de anim-in, il porte seul la phrase ». Le motif est
    // bon et il reste vrai — mais il explique pourquoi le glissement doit
    // PORTER SEUL, pas pourquoi il lui faut exactement 28 plutot que 24.
    //
    // ET LE JETON GOUVERNE LE MEME GESTE AILLEURS : --arc-translate fait entrer
    // et sortir les feuilles modales, ARC.translate porte le seul autre
    // glissement horizontal du fichier. Un 28 ecrit ici, et lui seul, c'est
    // exactement ainsi qu'une echelle meurt — une valeur a la fois, chacune avec
    // sa bonne raison.
    //
    // L'ASSERTION LE DEMANDAIT DEJA : elle compare a ARC.translate depuis le
    // debut et tombait sur « suivant part de 28 ». Elle avait raison.
    //
    // Si 24 se revele trop discret a l'usage, c'est le JETON qu'on monte — les
    // trois mouvements bougeront ensemble, ce qui est le propre d'une echelle.
    const d=(dir>0?1:-1)*ARC.translate;
    return z.animate(
      [{transform:'translateX('+d+'px)'},{transform:'translateX(0)'}],
      {duration:180,easing:ARC.discharge,fill:'none'});
  }catch(e){ return null; }
}
// `opts` (build 1862, facultatif) : {date, duree, silencieux}. date et duree
// remplacent l'horloge (séance oubliée) ; silencieux enregistre sans l'écran
// de fin. Sans opts, rien ne change.
function finishWorkout(incomplete=false,opts){
  // IDEMPOTENTE, ET LE GARDE EST EN TOUTE PREMIERE LIGNE.
  //
  // Un second appel — par n’importe quel chemin — réécrivait la MÊME séance
  // dans currentUser.sessions. Le garde vient AVANT _swSeance : rejouer
  // « SEANCE_TERMINEE » n’est pas neutre non plus, il relance la prise de
  // contrôle du service worker.
  //
  // `termine` repart à faux tout seul : launchWorkout remplace woState en
  // bloc par un objet neuf, qui ne porte pas le champ. Le cas légitime — une
  // seconde séance dans la même session — n’est donc pas touché.
  if(woState&&woState.termine) return;
  try{ _woLibererEcran(); }catch(e){}
  // En PREMIER : si le reste échoue, le SW ne doit pas rester bloqué en
  // attente sur une séance qui, elle, est bel et bien finie.
  _swSeance('SEANCE_TERMINEE');
  localStorage.removeItem('rc_wo_state');
  // Marque posée AVANT tout le reste : à partir d'ici, plus aucune écriture
  // du snapshot n'est possible, quel que soit le chemin.
  woState.termine=true;
  clearInterval(woState.timerInterval);
  // Le minuteur de repos peut encore tourner : il repeint une bannière sur
  // un écran qu'on quitte, et il appelait woPersist en s'ajustant.
  try{ annulerRepos(); }catch(e){}
  const _o=opts||{};
  const mins=(_o.duree!=null&&isFinite(_o.duree))?Math.round(_o.duree)
    :Math.floor(Math.max(0,Date.now()-woState.startTime-(Number(woState.pauseMs)||0))/60000);
  let sets=0,vol=0;
  // Total PRÉVU, compté sur le programme et non sur sessionData : ce dernier
  // n'est rempli qu'à l'ouverture de chaque exercice (renderWoEx), et
  // « Terminer » (finishWorkoutEarly) permet de sortir avant d'avoir tout
  // parcouru. Sur sessionData, une séance de 3×4 abandonnée au 2e exercice
  // annoncerait « 5/8 » — l'écart réel, celui qu'on veut montrer, est 5/12.
  // woState.exercises porte déjà la réduction de séries de la phase lutéale :
  // c'est bien ce qui était prévu POUR CETTE séance-là.
  // NON RELEVÉ AU RÉALISÉ, même depuis que l'athlète peut ajouter des séries.
  // setsPlanned signifie « prévu par le coach » et sert de DÉNOMINATEUR à un
  // écart. Le relever à max(prévu, réalisé) ferait disparaître le travail en
  // plus au lieu de le montrer — 10 séries sur 8 se lirait « 10/10 » — et,
  // pire, signauxEntrainement calcule le décrochage sur faits/prévus : gonfler
  // le dénominateur ferait passer pour un décrochage un athlète qui en fait
  // DAVANTAGE. fmtSeries gère déjà le dépassement en n'affichant que le
  // réalisé quand il excède le prévu.
  const setsPlanned=(woState.exercises||[]).reduce((n,ex)=>n+(parseInt(ex.series)||0),0);
  // Seules les séries validées comptent : sessionData contient toutes les séries
  // prévues dès l'ouverture de l'exercice, l'ancien sets++ inconditionnel affichait
  // donc le programme au lieu du réalisé. Même définition que la fiche coach, qui
  // ne déplie que les séries done (_buildSessionCard).
  Object.entries(woState.sessionData).forEach(([idx,d])=>d.sets.forEach(s=>{
    if(!s.done) return;
    sets++;
    vol+=tonnageSerie(s,(woState.exercises||[])[idx]);
  }));
  // Sauvegarder les données par NOM d'exercice (pas par index) pour permettre les lookups cross-séances
  const data={};
  Object.entries(woState.sessionData).forEach(([idx,d])=>{
    const _ex=woState.exercises[parseInt(idx)];
    const nm=_ex&&_ex.name;
    if(!nm) return;
    // L'objet exercice n'est pas conserve dans l'historique. On y ajoute la
    // METHODE et sa FAMILLE, sans quoi le calcul de volume reconstitue un
    // exercice nu et le poids de technique ne s'applique jamais.
    // Rien n'est ecrit pour une serie normale : les seances anterieures a ce
    // champ se comportent alors exactement comme avant.
    const _fam=techniqueDe(_ex);
    data[nm]=(_fam==='normale'&&!_ex.methode)?d
      :Object.assign({},d,{methode:_ex.methode||null,technique:_fam});
  });
  // slot : le créneau d'où vient cette séance. C'est la clé qui permettra à la
  // prochaine séance du même jour de retrouver ses charges sans aller les
  // chercher dans un autre jour de la semaine.
  // sets = réalisé, setsPlanned = prévu. Les deux sont conservés : sans le
  // second, un « 5 » isolé ne dit pas s'il vaut pour 5 sur 5 ou 5 sur 12, et
  // l'historique ne permet plus de reconstituer l'écart après coup.
  // B3.5 — L'INTENSITE PRESCRITE CE JOUR-LA, FIGEE COMME LE VOLUME PREVU.
  //
  // La seance portait le RIR REALISE et un setsPlanned, mais aucune trace de
  // la consigne en vigueur. Toute lecture retrospective comparait donc un
  // realise de mars au gabarit d'AUJOURD'HUI — et depuis que le bloc peut
  // varier d'une semaine a l'autre (B3.2), cette comparaison est fausse par
  // construction. C'est exactement le motif qui a fait naitre setsPlanned.
  //
  // PAR EXERCICE, sous le nom ecrit dans la seance : c'est la clef que porte
  // deja `data`, et la seule qui permette de rapprocher les deux plus tard.
  // Une seance sans consigne du tout n'ecrit RIEN — un objet vide vaudrait
  // « consigne a zero », soit « jusqu'a l'echec », et ce serait un contresens.
  const rirPlanned=(()=>{
    const o={};
    try{
      for(const ex of (woState.exercises||[])){
        if(!ex||!ex.name) continue;
        const r=_rirPrescrit(ex);
        if(r!=='') o[ex.name]=Number(r);
      }
    }catch(e){}
    return Object.keys(o).length?o:null;
  })();
  const _dSeance=(_o.date!=null&&isFinite(_o.date))?Number(_o.date):(Number(woState.dateDebut)||Date.now());
  const sess={id:'s_'+Date.now(),date:_dSeance,name:woState.progName,slot:woState.slot??null,duration:mins,sets,setsPlanned,volume:Math.round(vol),complete:!incomplete,data,
    // Planifiee par le coach : cette seance sort de la serie temporelle et ne
    // peut donc pas passer pour un recul.
    deload:!!woState.deload,
    // B3.5 — ABSENT quand aucune consigne n'etait posee. Une seance
    // anterieure a ce champ reste lisible et sort de toute comparaison, jamais
    // traitee comme un zero : c'est la regle deja appliquee aux seances
    // anterieures a setsPlanned.
    ...(rirPlanned?{rirPlanned}:{}),
    // Substitutions de la seance : l'athlete a remplace un exercice pour
    // AUJOURD'HUI. sessions_config n'a pas bouge, le coach doit le voir.
    substitutions:(woState.substitutions||[]).slice()};
  // Écrit seulement s'il y a quelque chose à écrire : une séance sans aucune
  // case cochée doit rester octet pour octet celle d'avant ce lot.
  if((woState.aFilmer||[]).length) sess.aFilmer=woState.aFilmer.slice();
  // « J'ALLÈGE » CHOISI : gardé avec la séance (clés exKey), pour que la
  // suggestion de la prochaine ne remonte pas (freinProgression).
  try{
    const al=Object.keys(woState.douleurChoix||{}).filter(k=>woState.douleurChoix[k]==='allege');
    if(al.length) sess.douleurAllege=al;
  }catch(e){}
  // Le fuseau de l'appareil (minutes, comme getTimezoneOffset) : le serveur
  // contrôle les badges secrets horaires à SON heure, lue à l'heure locale.
  try{ sess.tz=new Date(sess.date).getTimezoneOffset(); }catch(e){}
  // L'objectif « record à portée » que portait la séance : la carte record
  // dira « OBJECTIF ATTEINT » s'il est battu, aujourd'hui comme à la relecture.
  if(woState.objectif&&woState.objectif.nm) sess.objectif={nm:woState.objectif.nm,charge:woState.objectif.charge,reps:woState.objectif.reps};
  if(!currentUser.sessions) currentUser.sessions=[];
  currentUser.sessions.push(sess);
  // LOT N7 : le jour devient un jour d'entraînement pour l'assiette, et le
  // reste une fois clos (nutrition.joursSeance).
  try{ marquerJourSeance(currentUser,sess); }catch(e){}
  _viderCachePlateau();
  _viderCacheSignaux();
  _viderCacheVolume();
  // RÈGLE 7 : la séance est ENREGISTRÉE quoi qu'il arrive. On marque seulement
  // qu'elle a eu lieu hors couloir, pour que rien ne la confonde plus tard
  // avec une séance ordinaire. L'app ne l'a pas empêchée et ne l'efface pas.
  try{ if(suspensionEtat(currentUser).actif) sess.horsSuspension=true; }catch(e){}
  // La séance de retour consomme la reprise : le bandeau ne s'installe pas.
  if(currentUser._reprise) delete currentUser._reprise;
  updateStreak();
  // La détection tourne APRÈS la séance : trois séances douloureuses de suite
  // se referment ici, pas au prochain lancement de l'app.
  try{
    if(suspensionSynchroniser(currentUser)) scheduleWoNotif();
  }catch(e){}
  // Le tonnage cumulé, pour le serveur léger (relance J+14) : il ne relit
  // jamais les séances.
  try{ currentUser.tonnageTotal=tonnageTotalDe(currentUser); }catch(e){}
  // Le rappel de séance du service worker relit ses « records à portée ».
  try{ if(currentUser._woReminderEnabled) scheduleWoNotif(); }catch(e){}
  saveUser();
  // Les défis du Canal : plus rien à écrire (01/10/2026) — le Worker tire la
  // progression de la séance (« seance_fin », ci-dessous) et recalcule le
  // classement. Les duels : l'événement de chacun (démarrage, index du joueur).
  try{ setTimeout(()=>{ duelsApresSeance().catch(()=>{}); },3500); }catch(e){}
  // LES VOLTS DU SERVEUR : l'événement « seance_fin », après l'envoi du dossier
  // (le serveur relève et réessaie s'il arrive avant).
  try{ setTimeout(()=>{ deposerEvenement({type:'seance_fin'}).catch(()=>{}); },4500); }catch(e){}
  // L'événement saisonnier : la valeur calculée par le Worker, relue une minute
  // après (le temps que « seance_fin » soit traité).
  try{ setTimeout(()=>{ saisonsLireProgression().catch(()=>{}); },70000); }catch(e){}
  if(_o.silencieux) return sess;
  // ══ LA SEANCE EST ENREGISTREE. TOUT CE QUI SUIT N'EST QUE DU RENDU ══════
  //
  // Et ce rendu est le plus charge de l'application : trois chiffres, la
  // comparaison a la seance precedente, le message, les etats musculaires, la
  // carte « a filmer », le retour au calme, six curseurs, la carte de forme, la
  // relance de bilan. Une seule exception dans ce train laissait l'ecran a
  // moitie peint — sans records, sans message, sans retour au calme — et,
  // pire, SANS go('s-workout-done') : l'athlete restait sur l'ecran de seance
  // avec l'impression que sa seance n'avait pas ete prise, alors qu'elle
  // venait d'etre ecrite dans le dossier une ligne plus haut.
  //
  // LE MINIMUM VITAL EST DONC L'ECRAN LUI-MEME ET UNE PHRASE QUI DIT LA
  // VERITE : la seance est enregistree, c'est son detail qui manque. Chaque
  // geste du repli est isole a son tour — celui qui n'a plus de DOM ne doit pas
  // empecher les autres.
  try{
  // ⚠ LES TROIS CHIFFRES SONT RENDUS PLUS BAS, avec le delta, par
  // _htmlStatsFin : ils forment une bande et non trois tuiles, et la duree s'y
  // lit en heures. Ils ont besoin de _cmp — calcule juste apres — donc leur
  // ecriture attend. Ce qui ne change pas : ils sortent du MEME calcul qu'avant.
  // La comparaison est calculee AVANT le message : celui-ci lit _cmp, et un
  // const utilise avant sa declaration leve une ReferenceError — la fin de
  // seance s'interrompait donc juste apres l'enregistrement, sans jamais
  // afficher l'ecran de fin.
  const _cmp=buildSessionComparison(vol,data);
  // LE COMPTE DE RECORDS DE CET ECRAN, et c'est le seul : l'image le reprend
  // au lieu d'en refaire un.
  // ⚠ _cmp.records EST UN TABLEAU, pas un nombre — c'est ainsi que
  // _feterFinSeance le lit deux lignes plus bas. Le prendre tel quel donnait
  // Number(tableau) = NaN, puis 0 : l'image n'aurait jamais annonce le moindre
  // record, sans erreur et sans que rien ne le montre.
  _bilanRecords=(_cmp&&_cmp.records&&_cmp.records.length)|0;
  try{ renderPartageBilan(); }catch(e){}
  // ── LES BADGES, LE HERO, LE PROCHAIN OBJECTIF ────────────────────
  // Le contexte est assemble ICI parce que c'est le seul endroit qui a tout :
  // la comparaison, la seance et le dossier. Le moteur, lui, ne connait que
  // ce qu'on lui passe.
  let _badges=[],_ctxFin=null;
  try{
    const _sess=(currentUser.sessions||[]);
    const _prec=_sess.slice(0,-1).slice(-8);
    const _derniere=_prec.length?_prec[_prec.length-1]:null;
    const _jours=_derniere&&_derniere.date
      ? Math.max(0,(Date.now()-new Date(_derniere.date).getTime())/864e5) : 0;
    _ctxFin={
      records:(_cmp&&_cmp.records)||[],
      objectif:sess.objectif||null,
      recordsE1rm:(()=>{ try{ return e1rmRecordsDeSeance(sess,_sess.slice(0,-1),currentUser); }catch(e){ return []; } })(),
      sets,setsPlanned,volume:vol,
      volumesPrecedents:_prec.map(x=>Number(x&&x.volume)||0),
      streak:Number(currentUser.streak)||0,
      joursDepuisDerniere:_jours,
      exosAmeliores:Number(_cmp&&_cmp.ameliores)||0,
      seriesEchouees:Math.max(0,(Number(setsPlanned)||0)-(Number(sets)||0)),
      rpe:Number(sess&&sess.rpe)||0,
      meilleurExo:(()=>{ try{
        const l=((sess&&sess.exercises)||[]).map(x=>({nm:x&&(x.name||x.nm),
          kg:Math.max(0,...(((x&&x.sets)||[]).map(t=>Number(t&&t.weight)||0)))}))
          .filter(x=>x.nm&&x.kg>0).sort((a,b)=>b.kg-a.kg);
        return l[0]||null; }catch(e){ return null; } })()
    };
    _badges=achievementEngine(_ctxFin);
  }catch(e){ _badges=[]; _ctxFin=null; }
  // ── LE RENDU, ZONE PAR ZONE ─────────────────────────────────────
  //
  // Chacune est isolee : celle qui echoue ne doit pas emporter les suivantes.
  // C'est la lecon du 09/09/2026, ou une seule exception laissait l'ecran a
  // moitie peint.
  const _pose=(id,html)=>{ try{
    const z=document.getElementById(id); if(z) z.innerHTML=html;
  }catch(e){} };

  // 1. LE HERO : flamme et titre. Il ne depend d'aucun calcul, il ne peut
  //    donc pas manquer — et c'est lui qui dit que la seance est finie.
  _pose('wd-msg',(()=>{ try{ return _htmlHeroFin(_badges,_ctxFin); }catch(e){
    return '<div class="rcf-hero"><h1 class="rcf-titre">Séance terminée</h1></div>'; } })());
  // 2. LES RECOMPENSES : trois au maximum. Aucune obtenue, aucun bloc — on
  //    n'invente pas trois faux badges pour meubler.
  _pose('wd-badges',(()=>{ try{ return _htmlRecompenses(_badges,_ctxFin); }catch(e){ return ''; } })());
  // 3. MES RECORDS.
  _pose('wd-records',(()=>{ try{ return _htmlRecordsFin(_ctxFin,Date.now(),'wd'); }catch(e){ return ''; } })()
    +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:8px 0 0" onclick="ouvrirMesRecords()">Tous mes records</button>');
  // 4. LA PERFORMANCE, delta compris.
  _pose('wd-stats',(()=>{ try{
    return _htmlStatsFin(mins,sets,setsPlanned,vol,(_cmp&&_cmp.delta)||0); }catch(e){ return ''; } })());
  // 4 bis. La carte musculaire a quitté la fin de séance (Kevin, 01/10/2026) :
  // elle vit dans Évolution > Volume.
  // 6. L'ASCENSION.
  _pose('wd-objectif',(()=>{ try{ return _htmlProchainObjectif(_ctxFin); }catch(e){ return ''; } })());
  // L'ascension du grimpeur se mesure : elle ne peut pas partir avant que le
  // bloc soit ecrit, ni avant que l'ecran soit affiche — _animerGrimpeur
  // attend les deux.
  try{ _animerGrimpeur(document.getElementById('wd-objectif')); }catch(e){}
  // 7. LE RESSENTI. Il est deja dans le document depuis le chargement — voir
  //    rcfPoserRessenti — et on ne le REDESSINE PAS : reecrire son innerHTML
  //    refermerait « Plus de détails » sans remettre _psDetailOuvert a faux,
  //    et le bouton dirait « Moins de détails » sur un bloc replie. On se
  //    contente de remettre les notes a 5, ce qui est le seul etat a effacer
  //    d'une seance a l'autre.
  try{ rcfPoserRessenti(); }catch(e){}
  try{ rcfReinitRessenti(); }catch(e){}
  // ⚠ #wd-comparison A DISPARU DU GABARIT, et avec lui le gros medaillon
  // « nouveau record » qu'il dessinait. Ce n'est pas une perte : le record est
  // dit deux fois au-dessus, par la recompense et par « Mes records ». Le
  // delta de volume, lui, est passe dans la bande statistique, ou il tient en
  // une ligne au lieu d'un bloc. buildSessionComparison reste appelee telle
  // quelle — c'est elle qui CALCULE les records, et son html n'est simplement
  // plus lu.
  // Seuls les exercices dont l'état vient de CHANGER, et jamais pour annoncer
  // une progression : l'écran de fin de séance n'est pas un bulletin.
  renderEtatsSeance(currentUser,sess);
  renderCarteAFilmer(sess);
  // Le retour au calme n'a de sens qu'ici, une fois la dernière série faite.
  document.getElementById('wd-cooldown').innerHTML=_carteProtocole(woState&&woState.cooldown,'Fin de séance','var(--accent-blue)','wd-cooldown-body');
  // Les deux curseurs de detail — satisfaction, hydratation — sont remis a 5
  // comme avant. Les quatre principaux le sont par rcfReinitRessenti, qui
  // repositionne AUSSI les pastilles : poser .value sans elles laisserait la
  // note de la seance precedente allumee sous une valeur remise a zero.
  ['satisfaction','hydratation'].forEach(m=>{
    const el=document.getElementById('ps-'+m);const vl=document.getElementById('ps-'+m+'-val');
    if(el){el.value=5;}if(vl)vl.textContent='5';
  });
  // LA CARTE DE FORME SUIT LES CURSEURS QU'ON VIENT DE REMETTRE A 5.
  // renderFormeSeance n'est appelée que par leur `oninput` : sans cet appel,
  // #wd-forme affichait la forme de la séance PRÉCÉDENTE jusqu’au premier
  // déplacement de curseur. Après la remise à zéro, jamais avant.
  try{ renderFormeSeance(); }catch(e){}
  // ⚠ LE CHAMP « PAS AUJOURD'HUI » EST RETIRE DE CET ECRAN. Il est demande
  // par l'ecran Sante, qui le suit sur sept jours et le rapproche du
  // sommeil ; le redemander trente secondes apres la derniere serie faisait
  // un formulaire de plus au pire moment. savePostSession lit `ps-steps`
  // avec un accesseur qui rend `undefined` quand le champ n'existe pas, et
  // son garde `!isNaN && >0` ecarte deja ce cas : rien n'est a changer la-bas,
  // et les pas deja enregistres restent ou ils sont.
  // La séance est déjà dans l'historique à ce stade : la toute première y est
  // donc seule. Même raisonnement que first_workout_started — c'est la donnée
  // qui décide, pas un drapeau d'appareil.
  if((currentUser.sessions||[]).length===1){
    rcm('first_workout_completed');
    try{ activationCompleter(currentUser,Date.now()); }catch(e){}
    // LE PARRAIN EST PRÉVENU (serveur léger, push « filleul ») : la promesse
    // de l'accueil. Le serveur relit le lien et la séance avant d'envoyer.
    try{ if(currentUser.parrainage&&currentUser.parrainage.parrainCode) deposerEvenement({type:'filleul_seance'}).catch(()=>{}); }catch(e){}
  }
  // La séance vient d'être enregistrée : si le bilan de départ manque toujours,
  // c'est ici qu'on le propose. Même prédicat que la carte de l'accueil — les
  // deux relances doivent apparaître et disparaître ensemble.
  const _wdBil=document.getElementById('wd-first-bilan-card');
  if(_wdBil) _wdBil.style.display=(currentUser.bilans||[]).some(b=>b.type==='depart')?'none':'block';
  // L'INVITATION AUX NOTIFICATIONS, au meme endroit et pour la meme raison que
  // la relance de bilan : la seance vient d'etre enregistree, elle est donc
  // deja dans l'historique, et `sessions.length===1` dit sans ambiguite que
  // c'etait la premiere. Elle se garde elle-meme — seconde seance, question
  // deja posee, permission deja tranchee : elle ne rend rien.
  try{ _rendreInvitationNotif(); }catch(e){}
  // JUSTE APRES : l'installation est l'etape suivante du parcours, et elle
  // prend la place de la carte des notifications quand celles-ci n'existent pas
  // — etatInvitationNotif rend alors 'rien', et celle-ci se retrouve seule.
  try{ _rendreInvitationInstall(); }catch(e){}
  // LES BADGES. ICI, ET AVANT go() : la séance est dans l'historique depuis
  // une centaine de lignes, la série est à jour, et tout ce que les cinq
  // critères lisent est donc déjà écrit. La bannière, elle, s'affiche une
  // seconde plus tard — _celebrerBadge attend que la fête de fin de séance
  // ait joué la sienne.
  // RETOUR AU COMBAT : la 1re séance après 10 jours ou plus, dans la file
  // des célébrations (écran plein et quête de PHÉNIX NOIR).
  try{ const _rt=retourAuCombat(currentUser,(currentUser.sessions||[])[currentUser.sessions.length-1]); if(_rt) _celebrerRetour(_rt); }catch(e){}
  // Le parcours d'abord : sa fin débloque le badge SOUS TENSION.
  try{ majParcours(currentUser); parcoursEcrireJ21(currentUser).catch(()=>{}); }catch(e){}
  try{ majBadges(); }catch(e){}
  // LES VOLTS, APRÈS LES BADGES : ceux que la séance vient de débloquer
  // comptent dans le gain, et un passage de rang passe dans la file APRÈS eux.
  let _xpFin=null;
  try{ _xpFin=majXp(); }catch(e){}
  try{ rendreVoltsFin(currentUser,sess); }catch(e){}
  // LE RAPPEL DOUX DU PARRAINAGE : après un record ou un palier seulement
  // (rang, série ou badge en file de célébration), une fois par semaine.
  try{ rendreRappelParrainage(currentUser,{records:(_cmp&&_cmp.records&&_cmp.records.length)|0,
    palier:!!(_xpFin&&_xpFin.fete)||_bdgFile.length>0}); }catch(e){}
  // La page publique suit la séance (rang, série, records), sans rien dire.
  try{ majPagePublique({force:true}); }catch(e){}
  // LA BOUCLE DE RETOUR PAR MUSCLE. Vide la plupart du temps — une fois par
  // semaine et par muscle, sur la derniere seance qui le touche.
  try{ rcRendreSrpe(); }catch(e){}
  try{ rcRendreRetourSeance((currentUser.sessions||[]).slice(-1)[0]); }catch(e){}
  go('s-workout-done');
  // Les trois textContent ci-dessus restent le repli : sous « animations
  // reduites » _feterFinSeance sort en premiere ligne et ils sont alors la
  // seule ecriture.
  _feterFinSeance({mins,sets,setsPlanned,vol,records:(_cmp&&_cmp.records&&_cmp.records.length)|0});
  }catch(e){
    try{ console.error('[RepCore] rendu de fin de seance',e); }catch(_e){}
    // L'ECRAN D'ABORD : c'est lui qui dit que la seance est finie.
    try{ go('s-workout-done'); }catch(_e){}
    try{
      const m=document.getElementById('wd-msg');
      if(m) _texteIco(m,'Séance enregistrée '+ICO.coche+' Le détail de fin de séance n\'a pas pu s\'afficher, mais rien n\'est perdu.');
    }catch(_e){}
    // ET UN TOAST, parce que l'ecran de fin peut lui-meme etre reste vide : le
    // message ci-dessus vit dans un noeud qui n'existe peut-etre plus.
    try{ toast('Séance enregistrée '+ICO.coche+' (affichage de fin incomplet)','var(--orange)'); }catch(_e){}
  }
  // ── LA RELANCE D'INSTALLATION, ICI ET NULLE PART AILLEURS ───────────
  //
  // APRES le try/catch et non dedans : la seance est enregistree dans les
  // deux cas, donc la proposition a lieu d'etre dans les deux cas. Dedans,
  // un rendu de fin qui echoue l'aurait emportee.
  //
  // SEULEMENT SI LA SEANCE EST ALLEE AU BOUT. Une seance abandonnee n'a
  // rendu aucun service — c'est le pire moment pour demander quoi que ce
  // soit, et c'est exactement l'inverse de ce que cherche cette relance.
  //
  // 2 200 ms : la celebration de fin dure environ deux secondes. Se poser
  // pendant serait une interruption, et l'ecran de fin est le seul moment
  // ou l'application se felicite — on ne marche pas dessus.
  if(!incomplete){
    try{
      setTimeout(()=>{ try{ rcBanniereInstallMontrer(); }catch(_e){} },2200);
    }catch(_e){}
  }
}

// LA CELEBRATION DE FIN DE SEANCE.
//
// Elle passait par une classe CSS qu'il fallait retirer, forcer a se recalculer
// (void offsetWidth) puis remettre — trois operations dont la seule raison
// d'etre etait de rejouer une animation. Une animation JS se rejoue toute seule.
//
// NE LEVE JAMAIS : appelee APRES go('s-workout-done'), une fois la seance deja
// enregistree. Une celebration qui echoue ne doit pas emporter l'enregistrement.
//
// L'EMPILEMENT SUIT L'ECHELLE, PAS LE 8500 DEMANDE. Ce nombre avait ete choisi
// « sous #arc-calque (9000) et sous #toast (9999) » — mais le lot d'empilement
// a ramene ces deux-la a --z-layer (1800) et --z-toast (2000). A 8500 le voile
// serait passe AU-DESSUS des deux, exactement l'inverse de l'intention. Il
// prend donc --z-modal : au-dessus du contenu, sous le calque et sous le toast.
function _feterFinSeance(o){
  o=o||{};
  try{
    if(typeof arcReduit==='function'&&arcReduit()) return;
    // UN RECORD NE SE FETE PAS COMME UNE SEANCE. Sans record le flash tombe a
    // 320 ms / pic 0,28 — assez pour ponctuer, plus assez pour pretendre. Avec
    // record il reste blanc a 0,55 puis S'ENCHAINE sur un halo magenta pose
    // sur le medaillon a t=260 ms : le rare cesse d'etre noye dans la fanfare
    // ordinaire. --arc-peak est RESERVE au record, et n'apparait nulle part
    // ailleurs sur cet ecran.
    const rec=(o.records|0)>0;
    const v=document.createElement('div');
    v.style.cssText='position:fixed;inset:0;background:#fff;pointer-events:none;z-index:var(--z-modal);opacity:0';
    document.body.appendChild(v);
    const a=v.animate(
      rec?[{opacity:0},{opacity:.55,offset:.14},{opacity:0}]
         :[{opacity:0},{opacity:.28,offset:.18},{opacity:0}],
      {duration:rec?520:320,easing:'cubic-bezier(0.05,0.70,0.10,1.00)',fill:'none'});
    const _oter=()=>{ try{ v.remove(); }catch(e){} };
    a.addEventListener('finish',_oter);
    a.addEventListener('cancel',_oter);
    setTimeout(_oter,(rec?520:320)+200);   // le filet
    // LES DEUX QUANTITES MONTENT. tabular-nums n'est PAS optionnel : sans lui,
    // le passage de 3 a 4 chiffres change la largeur du texte a chaque frame
    // et fait sauter les zones voisines de la bande.
    //
    // ⚠ ELLES DEMARRENT A 950 ms, quand la bande statistique entre en scene
    // (.rcf-d3). Les faire monter pendant que le bloc est encore invisible
    // aurait donne un chiffre deja fige a son apparition.
    ['rcf-st-series','rcf-st-vol'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.style.fontVariantNumeric='tabular-nums';
    });
    // ⚠ PAS DE COMPTEUR SUR UNE SEANCE PARTIELLE. La case affiche alors
    // « 5 / 12 », et arcChiffre ecrit en textContent : il remplacerait l'ecart
    // par un « 5 » nu, c'est-a-dire exactement l'information qu'on tient a
    // garder. On laisse la valeur posee.
    const _complet=(o.setsPlanned==null)||(Number(o.sets)>=Number(o.setsPlanned));
    if(o.sets!=null&&_complet) setTimeout(()=>arcChiffre('rcf-st-series',0,o.sets,
      {duree:600,format:v=>Number(Math.round(v)).toLocaleString('fr-FR')}),980);
    if(o.vol!=null)  setTimeout(()=>arcChiffre('rcf-st-vol',0,o.vol,
      {duree:800,format:v=>Number(Math.round(v)).toLocaleString('fr-FR')}),1060);
    // LE HALO DU MEDAILLON CENTRAL, dans l'obscurite qui suit le flash. Celui
    // du milieu et pas un autre : c'est le point haut de la composition.
    if(rec){
      setTimeout(()=>{
        try{
          const m=document.querySelector('#s-workout-done .rcf-rec-g .rcf-case:nth-child(2) .rc-badge-hex')
                ||document.querySelector('#s-workout-done .rcf-case .rc-badge-hex');
          if(m) arcGlow(m,{couleur:'rgba(224,32,32,.6)',duree:ARC.afterglow,pic:.9});
          if(typeof arcHaptique==='function') arcHaptique('succes');
        }catch(e){}
      },660);
    }else if(typeof arcHaptique==='function') arcHaptique('succes');
  }catch(e){}
}
// ══════════════ DÉTECTION DE L'ABSENCE DE PROGRESSION ══════════════
// Tout est DÉRIVÉ de user.sessions : aucun champ nouveau, aucune migration.
//
// Limite assumée : les répétitions ne sont pas saisies. Le nombre retenu est
// donc TOUJOURS celui PRESCRIT. Deux séances où l'athlète a fait 8 puis 10
// répétitions à charge égale donnent le même score. La lecture passe par
// s.repsDone quand il existe, ce qui laisse la porte ouverte sans rien imposer.
// physiologiques. Ils sont ajustables : ce sont des choix de produit.
const MIN_SEANCES=4;        // en dessous, aucun verdict n'est rendu
const MIN_JOURS=21;         // ni sur une fenêtre trop courte
const SEUIL_REGRESSION=0.95;// perf < 95 % du max global = recul, borne stricte
const JOURS_PLATEAU=28;     // sans nouveau record depuis 4 semaines
const FENETRE_RECENTE=4;    // nombre de séances formant le « récent »
const ABERRATION_FACTEUR=1.5;// au-delà de 1,5 × la médiane des 5 précédents
const ABERRATION_FENETRE=5;
const PART_RIR_MANQUANT=0.5;// séance à plus de 50 % de RIR vides : écartée du max

// ══════════ LE BIAIS DE PERCEPTION DU RIR ══════════════════════════════
//
// LE RIR ALIMENTE TOUT ET N'ETAIT JAMAIS VERIFIE. La consigne du coach, le
// e1RM, la detection de plateau, les signaux, les decharges : tous lisent un
// chiffre que l'athlete DECLARE, et que personne n'a jamais confronte a ce
// qu'il pouvait reellement faire. Un debutant qui annonce « RIR 2 » a souvent
// quatre repetitions sous le pied — et toute la chaine en aval travaille sur
// une intensite qui n'a pas eu lieu.
//
// ON MESURE L'ECART, ON NE REECRIT JAMAIS LA SAISIE. La donnee brute reste
// celle que l'athlete a tapee : c'est elle qu'il relit, qu'il exporte, et
// c'est la seule qu'il reconnaitra. Le biais vit a cote, et ne s'applique
// qu'aux lectures qui DECIDENT quelque chose.
//
// ⚠ LE SENS DE LA CORRECTION EST +, PAS −, ET LA DEFINITION L'IMPOSE :
//     biaisSerie = repsReelles − (repsAnnoncees + rirAnnonce)
//                = (RIR vrai a l'instant de l'annonce) − (RIR annonce)
//   donc RIR vrai = RIR annonce + biais. Un biais de +2 veut dire « il en
//   avait deux de plus sous le pied » : sa serie a RIR 2 declare etait en
//   realite une serie a RIR 4. Retrancher le biais dirait l'inverse — que la
//   serie etait PLUS dure que declaree — et doublerait l'erreur au lieu de
//   l'annuler. Le coach lirait « plus dur que demande » chez quelqu'un qui
//   s'entraine trop facile, et baisserait l'intensite.
const CAL_RIR_BORNE=3;             // au-dela, c'est le protocole qui a derape
const CAL_RIR_DERNIERS=5;          // la fenetre de la mediane
const CAL_RIR_PERIME_JOURS=90;     // un calibrage vieillit : la perception bouge
const CAL_RIR_SEANCES_MINI=8;      // avant, l'athlete a autre chose a apprendre
const CAL_RIR_MAX=5;               // l'echelle de saisie de l'application

// PURE. L'ecart d'UNE serie de test. Positif : il s'arrete trop tot.
function biaisTestCalibrage(t){
  if(!t||typeof t!=='object') return null;
  const ra=Number(t.repsAnnoncees), ri=Number(t.rirAnnonce), rr=Number(t.repsReelles);
  if(!isFinite(ra)||!isFinite(ri)||!isFinite(rr)) return null;
  return rr-(ra+ri);
}
// PURE. Trois paliers, et le premier ne corrige RIEN — voir rirCorrige.
// n=0 tombe dans 'faible' : c'est voulu, il n'y a rien a dire d'un athlete
// qu'on n'a jamais mesure.
function fiabiliteCalibrage(n){
  const k=Number(n)||0;
  if(k<2) return 'faible';
  if(k<4) return 'moyenne';
  return 'bonne';
}
// PURE. Le modele complet, recalcule depuis la liste des tests.
//
// MEDIANE ET NON MOYENNE. Un test rate — l'athlete s'arrete a la premiere
// gene, ou au contraire s'acharne bien apres la perte d'amplitude — produit
// un ecart enorme. Une moyenne sur cinq points le laisserait deplacer le
// repere de plus d'une repetition ; la mediane l'ignore.
//
// LES CINQ DERNIERS, ET NON TOUS. La perception S'AMELIORE : garder un test
// d'il y a un an ferait tirer le repere par quelqu'un qui n'existe plus.
function calculerCalibrageRir(tests){
  const l=Array.isArray(tests)?tests.filter(t=>biaisTestCalibrage(t)!==null):[];
  const n=l.length;
  if(!n) return {tests:l,biais:null,n:0,maj:null,fiabilite:'faible'};
  const ecarts=l.slice(-CAL_RIR_DERNIERS).map(biaisTestCalibrage);
  // LE BORNAGE PORTE SUR LE REPERE, PAS SUR LES TESTS. Un test aberrant reste
  // enregistre tel quel — c'est peut-etre le protocole qui a ete mal execute,
  // et l'effacer empecherait de s'en rendre compte plus tard.
  const brut=_mediane(ecarts);
  const biais=Math.max(-CAL_RIR_BORNE,Math.min(CAL_RIR_BORNE,brut));
  const maj=l.reduce((m,t)=>Math.max(m,Number(t.date)||0),0)||null;
  return {tests:l,biais,n,maj,fiabilite:fiabiliteCalibrage(n)};
}
// PURE. Le modele range dans le dossier, ou null. Une forme abimee rend null
// plutot que de laisser passer un biais fantaisiste dans tout l'aval.
function calibrageRirDe(user){
  const u=_dossier(user);
  const c=u&&u.calibrageRir;
  if(!c||typeof c!=='object') return null;
  const b=(c.biais===null||c.biais===undefined)?null:Number(c.biais);
  if(b!==null&&(!isFinite(b)||Math.abs(b)>CAL_RIR_BORNE)) return null;
  return {biais:b,n:Number(c.n)||0,maj:Number(c.maj)||null,
    fiabilite:(c.fiabilite==='bonne'||c.fiabilite==='moyenne')?c.fiabilite:'faible',
    tests:Array.isArray(c.tests)?c.tests:[]};
}
// PURE. LA SEULE PORTE par laquelle le biais entre dans une decision.
//
// ELLE NE S'APPELLE JAMAIS A L'ECRITURE NI A L'AFFICHAGE. Le CSV, l'historique
// de seance et tout ce que l'athlete relit montrent le chiffre SAISI. Corriger
// ce qu'il voit reviendrait a lui dire qu'il n'a pas tape ce qu'il a tape.
//
// FIABILITE FAIBLE : ON NE CORRIGE PAS. Sur un seul test, le repere est un
// point unique — corriger dessus deplacerait toutes les decisions d'un athlete
// a partir d'une seule serie, possiblement ratee. Ne rien faire est alors
// strictement meilleur que faire n'importe quoi.
//
// UNE ENTREE QUI N'EST PAS UN NOMBRE RESSORT INTACTE. '' et 'echec' ont un sens
// ailleurs dans le fichier ; les convertir ici en 0 inventerait une valeur.
function rirCorrige(user,rirBrut){
  // ⚠ Number('') VAUT ZERO, PAS NaN. Un simple isFinite(Number(x)) laissait
  // donc passer la chaine vide — c'est-a-dire « RIR non renseigne » — comme
  // un RIR de 0, puis la corrigeait. La saisie vide serait ressortie d'ici en
  // valeur mesuree. On teste le TYPE avant de convertir.
  const r=(typeof rirBrut==='number')?rirBrut
    :(typeof rirBrut==='string'&&rirBrut.trim()!=='')?Number(rirBrut):NaN;
  if(!isFinite(r)) return rirBrut;
  const c=calibrageRirDe(user);
  if(!c||c.biais===null||c.fiabilite==='faible') return r;
  return Math.max(0,Math.min(CAL_RIR_MAX,r+c.biais));
}
// PURE. Le test est-il du : jamais fait, ou vieux de plus de trois mois ?
// ET SEULEMENT APRES HUIT SEANCES. Demander a quelqu'un qui debute d'aller a
// l'echec technique sur un exercice qu'il ne maitrise pas encore, c'est
// mesurer sa technique et non sa perception.
function calibrageRirDu(user){
  const u=_dossier(user);
  if(!u) return false;
  const n=((u.sessions)||[]).length;
  if(n<=CAL_RIR_SEANCES_MINI) return false;
  const c=calibrageRirDe(u);
  if(!c||!c.n) return true;
  if(!c.maj) return true;
  return (Date.now()-c.maj)>CAL_RIR_PERIME_JOURS*864e5;
}
// PURE. FAUT-IL LE PROPOSER AUJOURD'HUI ? Ce n'est PAS calibrageRirDu, et les
// deux ne peuvent pas fusionner : celui du coach dit « ce dossier n'a pas de
// repere valide », celui-ci dit « offrons-lui d'en poser un maintenant ».
//
// SANS LUI, LE MODELE N'ATTEINDRAIT JAMAIS SA FIABILITE. La regle des 90 jours
// suffit a l'entretien d'un repere deja sur, mais il faut QUATRE tests pour y
// arriver : proposes tous les 90 jours, cela ferait neuf mois avant la
// premiere correction. On propose donc tant que le repere n'est pas sur, avec
// une semaine d'ecart au minimum — le test coute une serie a l'echec, et deux
// dans la meme semaine mesureraient surtout la fatigue.
const CAL_RIR_ESPACEMENT_JOURS=7;
function calibrageRirAProposer(user){
  const u=_dossier(user);
  if(!u) return false;
  if(((u.sessions)||[]).length<=CAL_RIR_SEANCES_MINI) return false;
  const c=calibrageRirDe(u);
  if(!c||!c.n||!c.maj) return true;
  const jours=(Date.now()-c.maj)/864e5;
  if(jours<CAL_RIR_ESPACEMENT_JOURS) return false;
  if(c.fiabilite!=='bonne') return true;
  return jours>CAL_RIR_PERIME_JOURS;
}

// L'EXERCICE PEUT-IL PORTER LE TEST ?
//
// UNE SERIE MENEE A L'ECHEC TECHNIQUE REEL, donc jamais sous charge axiale :
// une derniere repetition ratee au squat ou au souleve de terre se paie sur
// le rachis, et aucune mesure ne vaut ca. On reutilise la charge lombaire du
// SCHEMA, deja notee pour l'indicateur de charge axiale, plutot que d'inventer
// une seconde liste d'exercices interdits qui divergerait de la premiere.
//
// EXACTEMENT ZERO, ET NULL EST REFUSE COMME 3. `chargeLombaireSchema` rend
// null quand le schema n'a pas encore ete note : une absence n'est pas un
// zero, c'est la regle du projet, et c'est ici qu'elle protege quelqu'un.
// Restent les isolations, les mollets et tout ce que le coach a note 0 —
// c'est-a-dire les machines et les mouvements guides que le protocole demande.
//
// _axialContrainteLombaire N'EST PAS UN FILTRE DE PLUS, et c'est delibere :
// exiger une charge lombaire nulle rend deja le test sans effet sur le rachis,
// donc sans danger pour une lombalgie declaree. Lui interdire en plus un curl
// biceps serait une precaution qui ne protege de rien.
function exerciceCalibrable(ex,user,grille){
  if(!ex||!(ex.name||typeof ex==='string')) return false;
  try{ if(isCardio(ex)) return false; }catch(e){}
  let sch=null;
  try{ sch=schemaDe(ex,user); }catch(e){ return false; }
  if(!sch) return false;
  let ch=null;
  try{ ch=chargeLombaireSchema(sch,grille); }catch(e){ return false; }
  if(ch!==0) return false;
  // ET AUCUNE CONTRAINTE DECLAREE SUR CET EXERCICE-LA. Meme garde que
  // l'editeur du coach : ce qui merite un avertissement avant une serie
  // normale ne se mene pas a l'echec.
  try{ if(contraintesPourExercice(ex,user).length) return false; }catch(e){}
  return true;
}
// L'ECRITURE. Rend {ok:true, modele} ou {ok:false, raison}.
//
// LE PROTOCOLE SE VERIFIE AVANT D'ETRE ENREGISTRE. repsReelles < repsAnnoncees
// est impossible par construction — on ne peut pas avoir fait MOINS que ce
// qu'on avait deja fait au moment de l'annonce. C'est une faute de saisie, et
// l'accepter poserait un biais massivement negatif qui fausserait tout l'aval.
function enregistrerTestCalibrage(user,t){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun dossier ouvert.'};
  const ra=Math.round(Number(t&&t.repsAnnoncees));
  const ri=Math.round(Number(t&&t.rirAnnonce));
  const rr=Math.round(Number(t&&t.repsReelles));
  const kg=Number(t&&t.chargeKg);
  const nom=String((t&&t.exercice)||'').trim();
  if(!nom) return {ok:false,raison:'Exercice inconnu.'};
  if(!(ra>=1)) return {ok:false,raison:'Le nombre de répétitions annoncé doit être au moins 1.'};
  if(!(ri>=0&&ri<=CAL_RIR_MAX)) return {ok:false,raison:'Le RIR annoncé doit aller de 0 à '+CAL_RIR_MAX+'.'};
  if(!(rr>=ra)) return {ok:false,raison:'Tu ne peux pas avoir fait moins de répétitions au total que celles déjà faites à l’annonce.'};
  if(!(kg>0)) return {ok:false,raison:'Charge manquante.'};
  const liste=(Array.isArray(u.calibrageRir&&u.calibrageRir.tests)?u.calibrageRir.tests:[]).slice();
  liste.push({date:Date.now(),exercice:nom,chargeKg:kg,
    repsAnnoncees:ra,rirAnnonce:ri,repsReelles:rr});
  u.calibrageRir=calculerCalibrageRir(liste);
  saveUserOuDire('Ton test de calibrage');
  // LES CACHES PORTENT DES VERDICTS QUE LE BIAIS VIENT DE CHANGER. Meme geste
  // que la decharge, pour la meme raison : un e1RM et un etat de plateau
  // calcules avec l'ancien repere resteraient servis jusqu'au rechargement.
  try{ _viderCachePlateau(); _viderCacheVolume(); _cacheSignaux.clear(); }catch(e){}
  return {ok:true,modele:u.calibrageRir};
}
// LA PHRASE DE RETOUR, JAMAIS UN SCORE. « Biais +2 » ne dit rien a personne et
// se lit comme une note ; « tu t'arretes deux repetitions trop tot » se lit
// d'un coup et dit quoi faire. Le chiffre reste dans le dossier, pour le coach.
function phraseCalibrageRir(modele){
  if(!modele||modele.biais===null||modele.biais===undefined) return '';
  const b=Number(modele.biais);
  if(!isFinite(b)) return '';
  const n=Math.round(Math.abs(b));
  const mot=x=>x===1?'une répétition':(x===2?'deux répétitions':(x===3?'trois répétitions':x+' répétitions'));
  // ARRONDI A ZERO : un biais de −0,5 ou +0,5 n'est pas un ecart, c'est du
  // bruit de mesure sur des entiers. On ne fabrique pas une consigne dessus.
  if(n===0) return 'Ta perception est juste.';
  // FIABILITE FAIBLE : ON DIT CE QU'ON A VU, ET ON NE PROMET RIEN. La seconde
  // phrase serait un mensonge — rirCorrige ne corrige rien a ce stade.
  const applique=(modele.fiabilite!=='faible')
    ? ' Les consignes en tiennent compte à partir de maintenant.'
    : ' Un deuxième test et les consignes en tiendront compte.';
  return (b>0
    ? 'Tu t\'arrêtes environ '+mot(n)+' trop tôt.'
    : 'Tu vas environ '+mot(n)+' plus loin que tu ne le penses.')+applique;
}

// ══════════ L'ENCART DE TEST, DANS LA SEANCE ══════════════════════════
//
// PAS DE NOUVEL ECRAN, et sur le DERNIER exercice seulement. Le test coute une
// serie menee a l'echec technique : la placer en debut de seance abimerait
// tout ce qui suit. En fin de seance, la fatigue accumulee est deja la, et le
// cout marginal est celui d'une serie.
//
// PROPOSE, JAMAIS IMPOSE. L'encart n'interrompt rien et ne bloque aucun
// bouton ; il se referme en le rouvrant. Une mesure de perception faite a
// contrecoeur ne mesure rien.
function _calChargeDerniereSerie(idx){
  try{
    const sets=((woState.sessionData||{})[idx]||{}).sets||[];
    for(let i=sets.length-1;i>=0;i--){
      const w=parseFloat(sets[i]&&sets[i].weight);
      if(w>0) return w;
    }
  }catch(e){}
  return 0;
}
// PURE. Le premier exercice du groupe qui puisse porter le test, ou -1.
// Un superset en compte plusieurs ; on ne teste que sur l'un d'eux.
function _calIndexTestable(groupe,user,grille){
  for(const i of (groupe||[])){
    const ex=(woState.exercises||[])[i];
    if(ex&&exerciceCalibrable(ex,user,grille)) return i;
  }
  return -1;
}
function _carteCalibrageRir(groupe,dernier){
  if(!dernier) return '';
  try{
    if(!calibrageRirAProposer(currentUser)) return '';
    const g=(()=>{ try{ return _grilleCharges(); }catch(e){ return null; } })();
    const i=_calIndexTestable(groupe,currentUser,g);
    // AUCUN EXERCICE ELIGIBLE : ON NE DIT RIEN. Expliquer a l'athlete pourquoi
    // il ne peut pas faire un test qu'il n'a pas demande serait du bruit — et
    // la carte reviendra d'elle-meme la prochaine seance qui s'y prete.
    if(i<0) return '';
    const ex=woState.exercises[i];
    const kg=_calChargeDerniereSerie(i);
    // SANS CHARGE SAISIE, IL N'Y A RIEN A ENREGISTRER. On propose quand meme :
    // l'athlete n'a simplement pas encore rempli sa serie, et il la remplira.
    return `<div id="cal-encart" style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px">
      <div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Perception du RIR</div>
      <div style="font-size:var(--fs-xs);color:#bbb;line-height:1.6">Va jusqu'à ne plus pouvoir en faire une propre. On compare avec ce que tu avais annoncé.</div>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px">Sur ${escapeHtml(ex.name)}${kg>0?' · '+kg+' kg':''}</div>
      <button id="cal-ouvrir" class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="calOuvrirTest(${i})">Tester ma perception</button>
      <div id="cal-form" style="display:none;margin-top:12px">
        <!-- LA REGLE GLOBALE « label » MET EN MAJUSCULES ET ESPACE LES LETTRES,
             et sur trois colonnes de 100 px chaque intitule passait sur deux
             lignes. Meme derogation que « Filmer cet exercice », plus haut dans
             cet ecran, et pour la meme raison : ce sont des mots, pas des
             intitules de formulaire administratif. -->
        <div style="display:flex;gap:8px">
          <div style="flex:1;min-width:0"><label for="cal-ra" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal;font-weight:600">Reps faites</label><input type="number" inputmode="numeric" min="1" id="cal-ra" placeholder="8"></div>
          <div style="flex:1;min-width:0"><label for="cal-ri" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal;font-weight:600">RIR annoncé</label><input type="number" inputmode="numeric" min="0" max="5" id="cal-ri" placeholder="2"></div>
          <div style="flex:1;min-width:0"><label for="cal-rr" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal;font-weight:600">Reps au total</label><input type="number" inputmode="numeric" min="1" id="cal-rr" placeholder="12"></div>
        </div>
        <div id="cal-err" style="color:var(--red-light);font-size:var(--fs-xs);margin-top:8px;display:none"></div>
        <button class="btn btn-red btn-sm" style="width:100%;margin-top:10px" onclick="calEnregistrer(${i})">Enregistrer le test</button>
      </div>
      <div id="cal-retour" style="display:none;margin-top:10px;font-size:var(--fs-xs);color:var(--text);line-height:1.6"></div>
    </div>`;
  }catch(e){ return ''; }
}
function calOuvrirTest(){
  const f=document.getElementById('cal-form');
  const b=document.getElementById('cal-ouvrir');
  if(!f) return false;
  const ouvert=f.style.display!=='none';
  f.style.display=ouvert?'none':'block';
  if(b) b.textContent=ouvert?'Tester ma perception':'Annuler';
  return true;
}
function calEnregistrer(idx){
  const err=document.getElementById('cal-err');
  const dire=m=>{ if(err){ err.textContent=m; err.style.display='block'; } };
  if(err) err.style.display='none';
  const ex=(woState.exercises||[])[idx];
  if(!ex) return dire('Exercice introuvable.'),false;
  const kg=_calChargeDerniereSerie(idx);
  // LA CHARGE VIENT DE LA SERIE, PAS D'UN CHAMP. Trois champs et pas quatre :
  // la charge est deja saisie juste au-dessus, la redemander serait la faire
  // taper deux fois — et ouvrir la porte a deux valeurs differentes.
  if(!(kg>0)) return dire('Renseigne d’abord la charge d’une série de cet exercice.'),false;
  const v=id=>{ const e=document.getElementById(id); return e?e.value:''; };
  const r=enregistrerTestCalibrage(currentUser,{exercice:ex.name,chargeKg:kg,
    repsAnnoncees:v('cal-ra'),rirAnnonce:v('cal-ri'),repsReelles:v('cal-rr')});
  if(!r.ok) return dire(r.raison),false;
  const f=document.getElementById('cal-form');
  const b=document.getElementById('cal-ouvrir');
  const z=document.getElementById('cal-retour');
  if(f) f.style.display='none';
  if(b) b.style.display='none';
  // UNE PHRASE, JAMAIS UN SCORE. Voir phraseCalibrageRir : « biais +2 » se lit
  // comme une note, et personne ne sait quoi en faire.
  if(z){ z.textContent=phraseCalibrageRir(r.modele); z.style.display='block'; }
  try{ arcHaptique('legere'); }catch(e){}
  return true;
}

// Une seule définition de l'e1RM dans le fichier.
//
// LOT T1 (29/09/2026) : LE RIR S'AJOUTE AUX RÉPÉTITIONS. L'ancienne forme
// divisait par (1 + RIR × 0,025) : déclarer PLUS de réserve faisait BAISSER
// l'e1RM, l'inverse de ce qu'elle mesure. 100 kg × 8 : RIR 0 → 126,7 (inchangé),
// RIR 2 → 133,3 (au lieu de 120,6), RIR 4 → 140,0 (au lieu de 115,2).
// C'est Epley appliqué aux répétitions qu'on AURAIT pu faire : reps + RIR.
// Aucune valeur d'e1RM n'est stockée nulle part : tout l'historique se relit
// avec la même formule, d'un coup, sans migration.
// LE MÊME MODÈLE PARTOUT (30/09/2026) : la calculatrice « Calculer ma charge »
// (updateCalcTable) passe par e1rm() et chargePourReps(), elle n'a plus sa
// table de pourcentages à elle. Au-delà de PERF_REPS_MAX_E1RM répétitions
// potentielles, l'estimation est dite « peu fiable ».
// ET DEUX BORNES (30/09/2026) : une série à 0 répétition n'est pas une mesure
// (0, et non plus w × (1 + RIR/30)) ; un single (reps + RIR ≤ 1) vaut sa
// charge, sans les 3,3 % qu'Epley lui ajoute.
function e1rm(poids,reps,rir){
  const w=parseFloat(poids)||0, r=parseFloat(reps)||0, i=Math.max(0,parseFloat(rir)||0);
  if(w<=0||r<=0) return 0;
  const n=r+i;                  // les répétitions potentielles
  if(n<=1) return w;
  return w*(1+n/30);
}
// LA RÉCIPROQUE, UNE SEULE FOIS : la charge qui donne cet e1RM à `reps`
// répétitions et `rir` de réserve. Mêmes bornes que e1rm().
function chargePourReps(e1rmKg,reps,rir){
  const e=Number(e1rmKg)||0, n=(Number(reps)||0)+Math.max(0,Number(rir)||0);
  if(e<=0) return 0;
  return n<=1?e:e/(1+n/30);
}
const PERF_REPS_MAX_E1RM=12;  // au-delà, l'e1RM n'est plus fiable
// LA BORNE, UNE SEULE FOIS : répétitions + RIR ≤ 12. Elle était comparée à la
// main, sur les seules répétitions, dans une douzaine de fonctions (et deux ne
// la comparaient pas du tout). Une série de 10 à RIR 3 vaut 13 répétitions
// possibles : au-delà du domaine où le modèle tient.
function e1rmFiable(reps,rir){
  const r=Number(reps)||0, i=Math.max(0,Number(rir)||0);
  return r+i<=PERF_REPS_MAX_E1RM;
}

// `user` EST FACULTATIF, ET SON ABSENCE VAUT « PAS DE CORRECTION ». C'est la
// valeur par defaut la plus sure : tout appelant qui n'a pas explicitement
// choisi de decider avec le biais lit la donnee brute. On n'a donc pas eu a
// auditer les appelants pour savoir lesquels corrigeaient par accident — il
// n'y en a aucun, par construction.
function _perfRir(s,user){
  // '' et absent donnent 0, donc « à l'échec ». Avec la formule du lot T1, un RIR
  // vide SOUS-ESTIME l'e1RM (une réserve inconnue ne s'ajoute pas) ; l'ancienne
  // formule le surestimait. Écarter
  // du maximum les séances où le RIR est majoritairement vide reste utile : ces
  // séances-là ne disent pas où l'athlète en était.
  const brut=(s&&s.rir==='echec')?0:(parseInt(s&&s.rir)||0);
  return (user===undefined||user===null)?brut:rirCorrige(user,brut);
}
function _perfReps(s){
  return (s&&s.repsDone!=null)?Number(s.repsDone):repsToNumber(s&&s.reps);
}

// LECTURE DE DECISION quand `user` est fourni : c'est ce score qui alimente
// l'etat d'exercice, donc la detection de plateau. Sans dossier, elle reste
// exactement ce qu'elle etait.
// ══ UNE SEULE UNITÉ : L'e1RM, TOUJOURS EN KG (06/10/2026, build 1826) ══
// Le score prenait, série par série, l'e1RM ou le tonnage-série w × r selon
// que reps + RIR tenaient sous 12, puis le MAX des deux unités — et
// _calculEtat coupait la série à chaque changement. Au banc : un e1RM de 96 à
// 100 lu « en recul », un 60 × 10/11/12 à RIR 2 « pas assez de recul » pour
// toujours, 700 « volume » une semaine et 120 « e1RM » la suivante.
// Désormais : le max des e1RM des séries faites, répétitions potentielles
// plafonnées à 20 (au-delà, la série compte avec 20). `fiable` dit si la
// MEILLEURE série tient dans e1rmFiable ; `metrique` vaut toujours 'e1RM'
// (gardé pour compatibilité). `score0` : le même calcul avec RIR 0, la borne
// basse cohérente quand les RIR manquent.
const PERF_REPS_POTENTIELLES_MAX=20;
function e1rmPlafonne(poids,reps,rir){
  const r=parseFloat(reps)||0, i=Math.max(0,parseFloat(rir)||0);
  if(r+i<=PERF_REPS_POTENTIELLES_MAX) return e1rm(poids,r,i);
  return r>=PERF_REPS_POTENTIELLES_MAX?e1rm(poids,PERF_REPS_POTENTIELLES_MAX,0)
    :e1rm(poids,r,PERF_REPS_POTENTIELLES_MAX-r);
}
function perfExercice(sess,exNom,user){
  const d=_dataDeSeance(sess,exNom);
  if(!d||!Array.isArray(d.sets)) return null;
  let score=0, score0=0, fiable=false, retenues=0, sansRir=0;
  // LA CHARGE EFFECTIVE (typeCharge) : le poids du corps, le lest, l'assistance.
  const _ex=_exPourCharge(exNom,user);
  for(const s of d.sets){
    if(!s||s.done!==true) continue;
    const w=chargeEffective(s,_ex,user,sess&&sess.date);
    if(!(w>0)) continue;
    // Un essai raté (0 répétition) n'est pas une mesure : il ne devient pas le
    // meilleur score (même règle que recordsExercice).
    const r=_perfReps(s);
    if(!(r>0)) continue;
    retenues++;
    if(s.rir===''||s.rir==null) sansRir++;
    const i=_perfRir(s,user);
    const v=e1rmPlafonne(w,r,i);
    if(v>score){ score=v; fiable=e1rmFiable(r,i); }
    const v0=e1rmPlafonne(w,r,0);
    if(v0>score0) score0=v0;
  }
  if(!retenues) return null;
  return {score,score0,fiable,metrique:'e1RM',
    // Gardé pour compatibilité : il n'y a plus deux régimes à mélanger.
    mixte:false,
    sansRirDominant:sansRir/retenues>PART_RIR_MANQUANT};
}

// Série temporelle d'un exercice sur un créneau, prête à être jugée.
function _serieExercice(seances,exNom,slot,progName,user){
  const out=[];
  for(const sess of (seances||[])){
    if(!sess||!sess.date) continue;
    // Séance de décharge : hors série. Le champ vient de BB-05 et n'existe pas
    // encore ; la garde est donc inerte aujourd'hui, et juste le jour où il
    // apparaîtra.
    if(sess.deload) continue;
    if(!_memeCreneau(sess,slot,progName)) continue;
    const p=perfExercice(sess,exNom,user);
    if(!p||!(p.score>0)) continue;
    out.push({date:sess.date,score:p.score,score0:p.score0,fiable:p.fiable,metrique:p.metrique,
              mixte:p.mixte,sansRirDominant:p.sansRirDominant,id:sess.id});
  }
  out.sort((a,b)=>a.date-b.date);
  return out;
}

// Un point qui dépasse de plus de moitié la médiane des précédents est
// probablement une faute de saisie. On le SIGNALE et on l'écarte du maximum,
// sans jamais le supprimer : c'est peut-être vrai.
function _mediane(t){
  if(!t.length) return 0;
  const x=t.slice().sort((a,b)=>a-b), m=Math.floor(x.length/2);
  return x.length%2?x[m]:(x[m-1]+x[m])/2;
}
function _marquerAberrations(serie){
  for(let i=0;i<serie.length;i++){
    const prec=serie.slice(Math.max(0,i-ABERRATION_FENETRE),i).map(p=>p.score);
    if(prec.length<ABERRATION_FENETRE){ serie[i].aberrant=false; continue; }
    const med=_mediane(prec);
    serie[i].aberrant=med>0&&serie[i].score>ABERRATION_FACTEUR*med;
  }
  return serie;
}

// Enveloppe memoisee. Le calcul lui-meme prend une LISTE de seances : c est
// ce qui permet de le rejouer sans la derniere pour savoir si l etat vient de
// changer, sans polluer le cache avec des cles factices.
function etatExercice(user,exNom,slot,progName){
  const cle=(user&&user.email||'?')+'|'+exKey(exNom)+'|'+slot+'|'+(progName||'');
  if(_cachePlateau[cle]) return _cachePlateau[cle];
  return (_cachePlateau[cle]=_calculEtat((user&&user.sessions)||[],exNom,slot,progName,user));
}
// LE DOSSIER DESCEND JUSQU'ICI POUR UNE SEULE RAISON : le biais de perception.
// Le calcul, lui, prend toujours une LISTE de seances — c'est ce qui permet de
// le rejouer sans la derniere. Le cache, lui, est vide a chaque test de
// calibrage : voir enregistrerTestCalibrage. Sans cela il servirait des etats
// calcules avec l'ancien repere jusqu'au rechargement de la page.
function _calculEtat(seances,exNom,slot,progName,user){
  const rendre=(o)=>o;

  let serie=_serieExercice(seances,exNom,slot,progName,user);
  if(!serie.length) return rendre({etat:'insuffisant',n:0,T:0});

  // UNE SEULE UNITÉ, PLUS DE COUPURE (build 1826) : tous les points sont des
  // e1RM en kg. Quand TOUTES les séances ont leurs RIR majoritairement vides,
  // on compare les e1RM à RIR 0 — une borne basse, la même d'une séance à
  // l'autre — et le résultat le dit (sansRir).
  const sansRir=serie.every(p=>p.sansRirDominant);
  if(sansRir) serie=serie.map(p=>Object.assign({},p,{score:p.score0}));
  const metrique='e1RM', metriqueChangee=false;
  _marquerAberrations(serie);

  const n=serie.length;
  const T=Math.round((serie[n-1].date-serie[0].date)/86400000);
  // LES SEUILS VIENNENT DU PROFIL (build 1829) : débutant 14 / 14 jours,
  // intermédiaire 21 / 28, avancé 28 / 49 (profilEntrainement). Sans dossier,
  // ceux de l'intermédiaire — les constantes d'avant.
  const _seuils=profilEntrainement(user).seuils;
  const minJours=_seuils.minJours, joursPlateau=_seuils.joursPlateau;
  const base={n,T,metrique,metriqueChangee,sansRir,minJours,joursPlateau,
              mixte:false,
              aberrants:serie.filter(p=>p.aberrant).length};
  if(n<MIN_SEANCES||T<minJours) return rendre(Object.assign({etat:'insuffisant'},base));

  // Écartés du MAXIMUM seulement : ces séances restent dans la série (elles
  // comptent pour n et T), mais ne peuvent pas fixer un record. Une séance
  // NON FIABLE (meilleure série au-delà de 12 répétitions potentielles) ne
  // fixe le record que s'il n'existe aucune séance fiable dans la fenêtre.
  const utilisable=p=>!p.aberrant&&(sansRir||!p.sansRirDominant);
  const retenus=t=>{ const u=t.filter(utilisable); const f=u.filter(p=>p.fiable); return f.length?f:u; };
  const maxDe=(t)=>{const v=retenus(t).map(p=>p.score);
                    return v.length?Math.max(...v):-Infinity;};

  const recents=serie.slice(-FENETRE_RECENTE);
  const anciens=serie.slice(0,-FENETRE_RECENTE);
  const maxHist=maxDe(anciens);
  const maxRecent=maxDe(recents);
  const maxGlobal=Math.max(maxHist,maxRecent);
  const perfCur=serie[n-1].score;
  const porteur=retenus(serie).reduce((a,p)=>(!a||p.score>a.score)?p:a,null);
  const joursDepuisRecord=porteur
    ? Math.round((serie[n-1].date-porteur.date)/86400000) : 0;

  let etat;
  // Quand la fenêtre récente couvre TOUTE la série (n === FENETRE_RECENTE),
  // maxHist porte sur un ensemble vide et « maxRecent > maxHist » est vrai quoi
  // qu'il arrive : un athlète passé de 100 à 60 en quatre séances était déclaré
  // « en progression ». Un verdict rendu sur rien, et le plus flatteur possible.
  // Sans historique à battre, « progresser » ne peut vouloir dire qu'une chose :
  // la dernière séance dépasse strictement toutes les précédentes.
  const progresse=anciens.length
    ? maxRecent>maxHist
    : perfCur>maxDe(serie.slice(0,-1));
  if(progresse) etat='progression';
  else if(perfCur<SEUIL_REGRESSION*maxGlobal) etat='regression';
  else if(joursDepuisRecord>=joursPlateau) etat='plateau';
  else etat='ralentissement';

  // ══ LA PROGRESSION APPARENTE ═════════════════════════════════════════
  //
  // LE CAS QUE LA CHARGE SEULE NE PEUT PAS VOIR. Elle monte, l'etat dit
  // « progression », et les series ont raccourci d'un quart : l'athlete a
  // change son execution, pas sa force. C'est le SEUL usage de la mesure de
  // temps sous tension, et il requalifie l'etat en plateau — sans quoi le
  // coach lirait « progression » sur un mouvement qui ne progresse plus.
  //
  // SEULEMENT DEPUIS 'progression' : sur un plateau deja declare, la baisse
  // de tension n'ajoute rien, et sur une regression elle ne fait que dire
  // deux fois la meme chose.
  let cause=null;
  if(etat==='progression'){
    let t=null;
    try{ t=tensionEnBaisse(seances,exNom,slot,progName,serie[n-1].date); }catch(e){ t=null; }
    if(t){ etat='plateau'; cause='tension'; }
  }

  return rendre(Object.assign({etat,cause,maxGlobal,joursDepuisRecord,
    // Nombre de séances réellement comparables au passé. À 0, « progression »
    // ne compare rien : la fenêtre récente couvre toute la série.
    fenetreHistorique:anciens.length,
    dateRecord:porteur?porteur.date:null},base));
}

// État d'un muscle, à partir des seuls exercices dont il est PRIMAIRE.
// Un exercice où il n'est que secondaire ne dit rien de sa progression.
function etatMuscle(user,m,slot,progName){
  const noms=new Set();
  for(const sess of ((user&&user.sessions)||[])){
    if(!sess||!sess.data) continue;
    for(const nom of Object.keys(sess.data)) noms.add(nom);
  }
  const exercices=[];
  for(const nom of noms){
    const cls=resoudreMusclesLecture(nom,{name:nom},user);
    if(!cls||cls===VOL_CARDIO) continue;
    if(!(cls.p||[]).includes(m)) continue;      // secondaire : ne compte pas
    const e=etatExercice(user,nom,slot,progName);
    if(e.etat==='insuffisant') continue;
    exercices.push({nom,...e});
  }
  if(!exercices.length) return {etat:'insuffisant',exercices:[]};
  const bloques=exercices.filter(x=>x.etat==='plateau'||x.etat==='regression').length;
  const progresse=exercices.filter(x=>x.etat==='progression').length;
  const recule=exercices.filter(x=>x.etat==='regression').length;
  let etat;
  if(bloques>=2) etat='plateau musculaire';
  else if(progresse>=1&&recule===0) etat='progression';
  else etat='mitigé';
  return {etat,exercices};
}

let _cachePlateau={};
function _viderCachePlateau(){ _cachePlateau={}; }
// « charge × reps » ne sert plus qu'à l'affichage d'un record de volume : le
// score ne compare plus jamais un e1RM à un tonnage-série.
const PERF_METRIQUE_LIB={'e1RM':'e1RM estimé','volume-serie':'charge × reps'};
const PERF_ETAT_LIB={
  progression:'en progression', ralentissement:'ça ralentit',
  plateau:'plateau', regression:'en recul', insuffisant:'pas assez de recul'
};

// ══════════════ ÉTATS DE PROGRESSION : AFFICHAGE ══════════════
// Encadré commun aux trois écrans. Il dit la limite du modèle, y compris celle
// qui vient de l'absence de repsDone : sans elle, un chiffre stable pourrait
// être lu comme « rien n'a bougé » alors que les répétitions, elles, ont bougé.
const PERF_ENCADRE=`<div style="background:var(--surface-2);border-left:3px solid var(--sub);border-radius:var(--r-2);padding:10px 12px;margin-top:14px;font-size:var(--fs-xs);color:var(--sub);line-height:1.6">
    Estimation basée sur tes séries validées. L'e1RM est un modèle : il est
    fiable jusqu'à 12 répétitions, approximatif au-delà. Le calcul retient les
    répétitions <strong>prévues</strong> au programme, ou celles que tu as
    notées quand l'exercice a une fourchette.
  </div>`;

// Exercices dont l'état a CHANGÉ avec la séance qu'on vient d'enregistrer.
// On rejoue le calcul sans cette séance : c'est le seul moyen de savoir ce qui
// est nouveau, aucun état n'étant stocké.
function etatsChanges(user,sess){
  if(!user||!sess||!sess.data) return [];
  const toutes=(user.sessions||[]);
  const avant=toutes.filter(s=>s!==sess&&s.id!==sess.id);
  const out=[];
  for(const nom of Object.keys(sess.data)){
    const ap=_calculEtat(toutes,nom,sess.slot,sess.name,user);
    // Aucun message quand ça progresse ou qu'on ne sait pas : on ne parle que
    // de ce qui mérite d'être dit.
    if(ap.etat==='progression'||ap.etat==='insuffisant') continue;
    const av=_calculEtat(avant,nom,sess.slot,sess.name,user);
    if(av.etat===ap.etat) continue;
    out.push({nom,...ap});
  }
  return out;
}
// Ton factuel, jamais culpabilisant : on décrit, on ne reproche pas.
function _phraseEtat(x,user){
  const sem=Math.floor((x.joursDepuisRecord||0)/7);
  // En sèche, l'absence de record n'est pas un symptôme : c'est le résultat
  // attendu d'un déficit. Le dire évite qu'un athlète interprète comme un
  // échec ce qui est le déroulement normal de sa phase.
  const enSeche=typePhase(user)==='seche'
    ? ' Un plateau de force en déficit est attendu ; l\'objectif est de conserver, pas de progresser.' : '';
  // LA PHRASE DE PLATEAU SERAIT FAUSSE ICI : la charge monte, il Y A de
  // nouveaux maximums. Ce qui a change, c'est la duree des series — on le dit
  // comme un fait, sans reprocher une execution.
  if(x.etat==='plateau'&&x.cause==='tension')
    return 'la charge monte, mais tes séries sont plus courtes qu\'il y a un '
      +'mois. Ça vaut le coup d\'en parler à ton coach.';
  if(x.etat==='plateau')
    return 'pas de nouveau maximum depuis '+(sem>=2?sem+' semaines':'4 semaines')+'. Ça arrive. Parles-en à ton coach.'+enSeche;
  if(x.etat==='regression')
    return 'les dernières séries sont en dessous de ton meilleur niveau. Fatigue, sommeil, charge de travail : ça se discute avec ton coach.';
  return 'la progression marque le pas. Rien d\'alarmant à ce stade.';
}
function renderEtatsSeance(user,sess){
  const z=document.getElementById('wd-etats');
  if(!z) return;
  let ch=[];
  try{ ch=etatsChanges(user,sess); }catch(e){ ch=[]; }
  if(!ch.length){ z.innerHTML=''; return; }
  z.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px;margin-bottom:16px">
    ${ch.map(x=>`<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:8px">
      <span style="width:6px;height:6px;border-radius:var(--r-full);background:${x.etat==='regression'?'var(--orange)':'var(--sub)'};margin-top:6px;flex-shrink:0"></span>
      <div style="flex:1;min-width:0;font-size:var(--fs-sm);line-height:1.6;color:#ccc">
        <strong style="color:var(--text)">${escapeHtml(x.nom)}</strong> : ${_phraseEtat(x,user)}
      </div></div>`).join('')}
    ${PERF_ENCADRE}
  </div>`;
}

// Courbe de la performance NORMALISÉE : on compare une forme, pas des kilos.
// Aucune valeur absolue n'est affichée — le calculateur « Calculer ma charge » utilise
// un autre modèle d'e1RM et les deux chiffres se contrediraient.
function _sparkline(points,couleur){
  if(!points||points.length<2) return '';
  const min=Math.min(...points), max=Math.max(...points);
  const etendue=(max-min)||1;
  const L=100, H=26;
  const d=points.map((p,i)=>{
    const x=(i/(points.length-1))*L;
    const y=H-((p-min)/etendue)*(H-4)-2;
    return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
  }).join(' ');
  return `<svg viewBox="0 0 ${L} ${H}" preserveAspectRatio="none" style="width:100%;height:26px;overflow:visible" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${couleur}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`;
}
const PERF_ETAT_COULEUR={progression:'var(--success)',ralentissement:'var(--info)',
  plateau:'var(--orange)',regression:'var(--red)',insuffisant:'var(--text-faint)'};

// Tous les exercices de l'historique, avec leur état, triés par ancienneté du
// dernier record : ce qui bloque depuis le plus longtemps arrive en premier.
function _listeEtats(user){
  const vus=new Map();
  for(const sess of (user.sessions||[])){
    if(!sess||!sess.data) continue;
    for(const nom of Object.keys(sess.data))
      if(!vus.has(nom)) vus.set(nom,{slot:sess.slot,name:sess.name});
  }
  const out=[];
  for(const [nom,ref] of vus){
    const e=etatExercice(user,nom,ref.slot,ref.name);
    const serie=_serieExercice(user.sessions||[],nom,ref.slot,ref.name,user);
    // La courbe suit la même unité que le verdict : RIR 0 quand il est « sans RIR ».
    out.push({nom,...e,points:serie.map(p=>e.sansRir?p.score0:p.score)});
  }
  // Les exercices sans recul suffisant ferment la liste : ils n'ont rien à dire.
  return out.sort((a,b)=>{
    const ai=a.etat==='insuffisant'?1:0, bi=b.etat==='insuffisant'?1:0;
    if(ai!==bi) return ai-bi;
    return (b.joursDepuisRecord||0)-(a.joursDepuisRecord||0);
  });
}
// `info` : R10 — la ligne porte le ⓘ de l'e1RM. L'appelant le donne a la
// PREMIERE ligne qui nomme le sigle, et a elle seule.
function _ligneEtat(x,info){
  const c=PERF_ETAT_COULEUR[x.etat]||'var(--sub)';
  const detail=x.etat==='insuffisant'
    ? (x.n<MIN_SEANCES?x.n+' séance'+(x.n>1?'s':'')+' sur ce créneau : pas encore de quoi juger'
       :'suivi trop récent : encore '+((x.minJours||MIN_JOURS)-x.T)+' jour'+(((x.minJours||MIN_JOURS)-x.T)>1?'s':'')+' à attendre')
    : (x.joursDepuisRecord>0?'dernier record il y a '+x.joursDepuisRecord+' jour'+(x.joursDepuisRecord>1?'s':'')
       :'record sur la dernière séance');
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-left:3px solid ${c};border-radius:var(--r-3);padding:12px 12px;margin-bottom:10px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px">
      <span style="font-size:var(--fs-sm);font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(x.nom)}</span>
      <span style="font-size:var(--fs-xs);font-weight:800;color:${c};white-space:nowrap">${PERF_ETAT_LIB[x.etat]||x.etat}</span>
    </div>
    <div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.5">${detail}</div>
    ${x.etat!=='insuffisant'?_sparkline(x.points,c):''}
    <div class="perf-met" style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">${PERF_METRIQUE_LIB[x.metrique]||''}${x.sansRir?' · estimation sans RIR':''}${info?rcInfo('e1rm'):''}${x.metriqueChangee?' · série repartie de zéro : le format de séries a changé':''}${x.aberrants?' · '+x.aberrants+' valeur'+(x.aberrants>1?'s':'')+' inhabituelle'+(x.aberrants>1?'s':'')+', vérifie ta saisie':''}</div>
  </div>`;
}

// ── Ce qui bloque, côté coach ───────────────────────────────────────────────
// Uniquement ce qui appelle une décision : exercices en plateau ou en recul,
// et muscles dont plusieurs exercices primaires sont bloqués. Ce qui progresse
// n'a pas besoin du coach.
// LA LIGNE DES METHODES. UNE PHRASE, PAS UNE ALERTE ROUGE : le coach sait ce
// qu'il fait, il a juste besoin de le voir. Aucune couleur d'alarme, aucun
// pictogramme — le gris du texte secondaire, comme les ecarts au programme.
// ══ LE SCHEMA CORPOREL DE LA FICHE COACH ═══════════════════════════════════
//
// Kevin, nuit du 20/09/2026 : « au reveil, je dois pouvoir ouvrir une fiche et
// voir le corps de mon athlete, avec ce qui a bouge depuis le dernier bilan,
// et rien que je ne puisse prouver ».
//
// ⚠ LE MODELE A CHANGE LE 21/09/2026, A LA DEMANDE DE KEVIN, capture a
//   l'appui : « change le modele par celui-ci, qui doivent etre les memes a
//   100 %, hommes pour les hommes, femmes pour les femmes ; mets pas les
//   muscles, mets les mensurations uniquement avec les +/- cm ; supprime le
//   rond sur la tete ; mets le titre “ evolution eleve numero __ ” en rouge
//   dans le cadre ».
//
//   Ce qui en decoule, et qui remplace la version de la nuit :
//     · les quatre silhouettes sont celles de SON image, decoupees telles
//       quelles (img/corps/) — homme face et dos, femme face et dos. Plus les
//       planches d'avatar de la seance, plus leur niveau ;
//     · les etiquettes disent une MENSURATION et son ecart en centimetres —
//       jamais un muscle. Les treize etiquettes de muscles, leurs « pas de
//       mesure » et la teinte de volume sont retirees ;
//     · plus de photo sur la tete ;
//     · le titre dit l'eleve, par le meme numero que sa carte d'identite
//       (rangArrivee).
//
// ⚠ LA SILHOUETTE EST UN SUPPORT : elle dit OU, jamais combien. Aucun chiffre
//   n'est tire de l'image — elle est la meme pour tous les athletes d'un meme
//   sexe.
//
// ⚠ LES QUATRE FICHIERS, ET LEUR TOILE. Les deux vues d'un meme sexe sont
//   posees sur UNE toile — meme largeur, meme hauteur, pieds alignes en bas :
//   sans cela le cadre changeait de hauteur a chaque bascule avant / arriere.
//   Le fond est NOIR, pas transparent : les vetements et les cheveux du
//   dessin descendent aussi bas que le fond, et un detourage trouait le short.
//   L'image se fond dans le cadre par mix-blend-mode:lighten (voir le CSS).
//   `w` et `h` sont ceux des fichiers, en pixels : ils fixent le rapport de la
//   scene, sans lequel les traits de rappel pointeraient a cote.
//   `zones` : la carte des zones musculaires de la silhouette — voir
//   CORPS_ZONES_ORDRE.
const CORPS_PLANCHE=Object.freeze({
  'h-face':{src:'./img/corps/h-face.webp',zones:'./img/corps/z-h-face.png',w:360,h:898},
  'h-dos' :{src:'./img/corps/h-dos.webp', zones:'./img/corps/z-h-dos.png', w:360,h:898},
  'f-face':{src:'./img/corps/f-face.webp',zones:'./img/corps/z-f-face.png',w:310,h:866},
  'f-dos' :{src:'./img/corps/f-dos.webp', zones:'./img/corps/z-f-dos.png', w:310,h:866}
});
// ── LES ZONES DE VOLUME, REPOSEES SUR LE NOUVEAU MODELE ────────────────────
// Kevin, 21/09/2026, apres le changement de modele : « remets les zones de
// differente couleur comme c'etait ce matin ». La teinte disait alors la
// charge de la semaine par muscle en quatre aplats MEV / MAV / MRV.
// ⚠ LE 1386 L'AVAIT REMPLACEE PAR UNE RAMPE ORANGE CONTINUE, et Kevin l'a
//   refusee le 22/09/2026 (« y a plus de rouge vert bleu… tu devais modifier
//   selon le volume par muscle du programme ; tout est de la même couleur ») :
//   les quatre zones sont revenues (build 1397), calculees sur le volume du
//   programme — voir corpsTeintes.
//
// ⚠ LES CONTOURS DE CE MATIN NE SERVAIENT PLUS : WO_ZONES decoupe les planches
//   d'avatar, pas l'image de Kevin. Chaque silhouette porte donc sa CARTE
//   (img/corps/z-*.png) : une image en niveaux de gris ou chaque pixel du corps
//   vaut le rang de son muscle dans CORPS_ZONES_ORDRE, multiplie par
//   CORPS_ZONES_PAS — 0 hors muscle (tete, mains, genoux, pieds, vetements).
//   Elle a ete calculee une fois, hors de l'application, a partir de points
//   poses muscle par muscle sur chaque silhouette et verifies dessines.
//
//   ⚠ TROIS TERRITOIRES ONT ETE RECOUPES LE 23/09/2026, et cette fois le
//     script est dans le depot : scripts/corps_zones_recoupe.py. Kevin, la
//     silhouette sous les yeux : « le detourage au niveau des pecs est
//     incomplet ... les biceps, l'entourage est mauvais ... les cuisses, il
//     faut que ca soit en entier ». Le script ne REFAIT pas les cartes — il
//     rend le haut du thorax au pectoral, partage le bras de face en donnant
//     la masse au biceps, et donne la cuisse entiere au quadriceps (a
//     l'ischio de dos), en ne touchant QUE des pixels deja attribues a l'un
//     des muscles nommes. Il est idempotent : `--verif` le rejoue sur les
//     cartes livrees et dit si elles ont derive. Une assertion du 1428 sonde
//     douze pixels de z-h-face.png, pour que ce soit le RESULTAT qui tienne
//     et pas la recette.
//
// ⚠ LA SILHOUETTE PASSE EN GRIS CLAIR QUAND ELLE EST TEINTEE. Le dessin est
//   rouge partout ; or le rouge, dans cette legende, dit « au-dessus du MRV ».
//   Un muscle sans repere serait reste rouge et se serait lu comme surcharge.
//   En gris clair — le bonhomme blanc de ce matin — il se lit « non teinte ».
// ⚠ TRAP_MED EST EN QUEUE DE LISTE, ET IL DOIT Y RESTER. La valeur d'un pixel
//   vaut son RANG dans cette liste, fois CORPS_ZONES_PAS : insérer un muscle au
//   milieu décalerait tous les suivants et rendrait les quatre cartes déjà
//   livrées illisibles d'un seul coup, sans un mot à l'écran. On ajoute donc à
//   la fin, jamais au milieu.
const CORPS_ZONES_ORDRE=Object.freeze(['TRAP_SUP','DELT_ANT','DELT_LAT','DELT_POST',
  'PECTORAUX','BICEPS','TRICEPS','AVANT_BRAS','ABDOS','DORSAUX','LOMBAIRES','FESSIERS',
  'ABDUCTEURS','ADDUCTEURS','QUADRICEPS','ISCHIOS','MOLLETS','TRAP_MED']);
const CORPS_ZONES_PAS=12;
// Les muscles que chaque vue montre — les treize de ce matin, par vue.
const CORPS_MUSCLES_VUE=Object.freeze({
  face:Object.freeze(['TRAP_SUP','DELT_ANT','DELT_LAT','PECTORAUX','BICEPS','TRICEPS',
    'AVANT_BRAS','ABDOS','DORSAUX','ABDUCTEURS','QUADRICEPS','ADDUCTEURS','MOLLETS']),
  // ⚠ LE TRAPEZE MOYEN N'EXISTE QUE DE DOS, et il n'existait nulle part avant
  //   le 23/09/2026. Kevin : « les trapèzes médians inférieurs, je ne les vois
  //   pas ; essaye déjà de séquencer les deux, les médians et le supérieur ».
  //   Le volume les sépare depuis le 08/09 — le shrug élève l'omoplate, le
  //   rowing la rétracte —, mais la silhouette n'avait qu'un seul territoire :
  //   un athlète qui ne fait que des rowings voyait son trapèze éteint, parce
  //   que la zone dessinée était celle du SUPÉRIEUR, qu'il ne travaille pas.
  dos:Object.freeze(['TRAP_SUP','TRAP_MED','DELT_LAT','DELT_POST','DORSAUX','TRICEPS',
    'BICEPS','AVANT_BRAS','LOMBAIRES','FESSIERS','ABDUCTEURS','ISCHIOS','ADDUCTEURS',
    'MOLLETS'])
});
// La part de largeur que la planche occupe sur la scene, les deux colonnes
// d'etiquettes se partageant le reste. Une seule constante : les traits de
// rappel, la planche et le calcul du pas d'etiquettes lisent tous celle-ci.
const CORPS_PART_CORPS=40;
// LES BORNES DE LA COLONNE D'ETIQUETTES, en centiemes de scene.
//
// ⚠ LE PAS EST UNE MESURE, PAS UN GOUT — releve au banc a 375 px sur le
//   nouveau modele (21/09/2026) : l'etiquette tient en TROIS lignes (la
//   mensuration, l'ecart, ses deux dates) et mesure 34,5 px ; la scene fait
//   308 px de haut pour l'homme, 345 pour la femme. A 11 %, les etiquettes de
//   l'homme ne laissaient que 3 px entre elles ; 12,5 % en laisse 4 chez lui
//   et 8 chez elle, et les six etiquettes d'une colonne tiennent de 7 a 93.
//   Ne pas recalculer ce chiffre de tete : la version de la nuit l'avait
//   fait, et s'etait trompee deux fois.
//
// ⚠ LE BORD HAUT RESTE A 7 : une etiquette est CENTREE sur sa position, et
//   posee plus haut la premiere passait sous le selecteur « Vue avant / Vue
//   arriere ».
const CORPS_ETIQ_GAP=12.5, CORPS_ETIQ_HAUT=7, CORPS_ETIQ_BAS=93;
// La largeur d'une colonne d'etiquettes, en centiemes de scene : ce qui reste
// de part et d'autre du corps, moins une gouttiere de 2.
const CORPS_ETIQ_LARG=(100-CORPS_PART_CORPS)/2-2;
/**
 * OU SE MESURE CHAQUE TOUR, SUR CHAQUE SILHOUETTE — en centiemes de la toile.
 *
 * ⚠ RELEVES A LA MAIN, ET C'EST LE SEUL ENDROIT OU IL FALLAIT LE FAIRE. Le
 *   dessin vient d'une image, pas d'un trace : aucun contour ne dit ou passe
 *   le metre. Chaque point a ete pose sur une grille au 2 %, puis verifie
 *   dessine sur la silhouette (21/09/2026) : le cou a sa base, la poitrine sur
 *   les pectoraux, le buste AU-DESSUS — c'est la convention de l'ecran de
 *   saisie du bilan (bBodySchema) —, la taille au nombril, les hanches au plus
 *   large, les fessiers au milieu du fessier, la cuisse et le mollet a leur
 *   plus fort.
 *
 * ⚠ LE COTE EST CELUI DE L'ATHLETE, PAS CELUI DE L'ECRAN. De face, son bras
 *   DROIT est a GAUCHE de l'image ; de dos, a droite. Se tromper ici ferait
 *   designer le biceps gauche sous l'etiquette du droit, avec un trait qui a
 *   l'air juste.
 */
const CORPS_POINTS=Object.freeze({
  'h-face':{neck:[50,17.5],bust:[58,23.5],chest:[42,27.5],'bicep-r':[17,32],'bicep-l':[83,32],
    waist:[40,42],hips:[68,50],'thigh-r':[34,63],'thigh-l':[66,63],'calf-r':[31,80],'calf-l':[69,80]},
  'h-dos':{neck:[49.9,17.8],'bicep-l':[16.5,32.7],'bicep-r':[83.2,32.7],waist:[40.3,42.6],
    hips:[68.9,50.5],glutes:[38.4,54.5],'thigh-l':[33.7,64.4],'thigh-r':[66.1,64.4],
    'calf-l':[32.7,80.2],'calf-r':[67,80.2]},
  'f-face':{neck:[50,19],bust:[58.8,25.4],chest:[42.2,29.4],'bicep-r':[19.6,33.4],'bicep-l':[80.4,33.4],
    waist:[40.2,41.3],hips:[68.6,50.3],'thigh-r':[33.3,62.2],'thigh-l':[66.7,62.2],
    'calf-r':[27.4,80.1],'calf-l':[72.6,80.1]},
  'f-dos':{neck:[50,19],'bicep-l':[17,33],'bicep-r':[83,33],waist:[40,42],hips:[71,50],
    glutes:[38,54],'thigh-l':[33,64],'thigh-r':[67,64],'calf-l':[31,80],'calf-r':[69,80]}
});
// LES MENSURATIONS DE CHAQUE VUE, ET DE QUEL COTE ELLES SE POSENT. Ce sont les
// douze tours que l'athlete saisit au bilan (MEAS), ni plus ni moins. Chaque
// colonne prend le cote du corps qui est de son cote de l'image : le trait ne
// traverse jamais la silhouette.
//
// ⚠ LA PLUPART FIGURENT SUR LES DEUX VUES — un tour de bras se lit aussi bien
//   de face que de dos, et une vue qui n'en montrerait que la moitie
//   obligerait a basculer pour tout lire. Seules la poitrine et le buste sont
//   propres a la vue avant, les fessiers a la vue arriere.
const CORPS_MESURES=Object.freeze({
  face:Object.freeze([
    {k:'bicep-r',s:'l'}, {k:'chest',s:'l'}, {k:'waist',s:'l'}, {k:'thigh-r',s:'l'}, {k:'calf-r',s:'l'},
    {k:'neck',s:'r'}, {k:'bust',s:'r'}, {k:'bicep-l',s:'r'}, {k:'hips',s:'r'},
    {k:'thigh-l',s:'r'}, {k:'calf-l',s:'r'}
  ]),
  dos:Object.freeze([
    {k:'bicep-l',s:'l'}, {k:'waist',s:'l'}, {k:'glutes',s:'l'}, {k:'thigh-l',s:'l'}, {k:'calf-l',s:'l'},
    {k:'neck',s:'r'}, {k:'bicep-r',s:'r'}, {k:'hips',s:'r'}, {k:'thigh-r',s:'r'}, {k:'calf-r',s:'r'}
  ])
});
// Le nom court de chaque tour, sur l'etiquette : la place manque, et « Tour
// de » se lit dans l'infobulle, qui donne le libelle entier de MEAS.
const CORPS_NOMS=Object.freeze({
  neck:'Cou', chest:'Poitrine', bust:'Buste', 'bicep-r':'Biceps D', 'bicep-l':'Biceps G',
  waist:'Taille', hips:'Hanches', glutes:'Fessiers', 'thigh-r':'Cuisse D', 'thigh-l':'Cuisse G',
  'calf-r':'Mollet D', 'calf-l':'Mollet G'
});
/**
 * PURE. Le point d'un tour sur une silhouette, en centiemes de la toile, ou
 * null si cette vue ne le montre pas.
 * @returns {{x:number,y:number}|null}
 */
function corpsAncre(genre,vue,cle){
  const p=((CORPS_POINTS[genre+'-'+vue])||{})[cle];
  return p?{x:p[0],y:p[1]}:null;
}
/**
 * PURE. Etale des positions verticales pour qu'aucune ne chevauche sa voisine.
 *
 * Les points d'ancrage viennent de l'anatomie : le deltoide lateral et le
 * deltoide anterieur sont a moins d'un centieme l'un de l'autre, et leurs deux
 * etiquettes se superposaient exactement. On les ecarte APRES coup, sans
 * toucher au trait de rappel — qui, lui, continue de pointer le vrai muscle.
 * C'est tout l'interet des traits : l'etiquette peut bouger, la designation
 * non.
 *
 * ⚠ LES ENTREES SONT SUPPOSEES TRIEES. Trier ici aurait rendu l'ordre des
 *   etiquettes dependant de leur position, donc instable d'une vue a l'autre.
 * ⚠ QUAND LA PLACE MANQUE — plus d'etiquettes que (max-min)/gap — elles
 *   debordent par le bas plutot que de se superposer. Un depassement se voit
 *   et se corrige ; un chevauchement se lit comme un chiffre faux.
 * @param {number[]} ys
 * @param {number} gap  ecart minimal
 * @param {number} min  bord haut
 * @param {number} max  bord bas
 * @returns {number[]}
 */
function corpsEtaler(ys,gap,min,max){
  const n=(ys||[]).length;
  if(!n) return [];
  const g=Number(gap)||0, a=Number(min)||0, b=Number(max)||0;
  const out=ys.map(v=>Number(v)||0);
  // Descente : on pousse vers le bas ce qui se touche.
  for(let i=1;i<n;i++) if(out[i]<out[i-1]+g) out[i]=out[i-1]+g;
  // Remontee : ce qui est sorti par le bas revient, et repousse vers le haut.
  if(out[n-1]>b){
    out[n-1]=b;
    for(let i=n-2;i>=0;i--) if(out[i]>out[i+1]-g) out[i]=out[i+1]-g;
  }
  // Et une derniere descente si la remontee a debordé par le haut.
  if(out[0]<a){
    out[0]=a;
    for(let i=1;i<n;i++) if(out[i]<out[i-1]+g) out[i]=out[i-1]+g;
  }
  // ⚠ ET UN RECENTRAGE, SANS QUOI TOUT TOMBE EN BAS. La descente seule tasse
  //   la colonne : mesure faite sur la vue de face, les sept etiquettes de
  //   gauche partaient de 18 et finissaient a 87 alors que le dernier muscle
  //   est a 80 — sept centimetres de decalage, le haut du cadre vide et les
  //   mollets etiquetes sous les pieds. On remonte le bloc entier de ce qu'on
  //   peut, jamais plus haut que le bord ni plus haut que le dernier ancrage
  //   ne le demandait : les ecarts restent exacts, et les traits raccourcissent.
  const trop=out[n-1]-Math.max(Number(ys[n-1])||0,a);
  if(trop>0){
    const dy=Math.min(trop,out[0]-a);
    if(dy>0) for(let i=0;i<n;i++) out[i]-=dy;
  }
  return out;
}
/**
 * PURE. L'ecart d'une mensuration entre LE PREMIER ET LE DERNIER BILAN QUI LA
 * PORTENT. Rend null quand il n'y en a pas deux.
 *
 * ⚠ LE PREMIER ET LE DERNIER, ET NON LES DEUX DERNIERS. Demande de Kevin le
 *   23/09/2026 : « les +/- du premier bilan compare au dernier bilan ». Les
 *   deux derniers disaient la quinzaine ecoulee ; ce que l'athlete et son
 *   coach regardent sur une silhouette, c'est le CHEMIN PARCOURU depuis le
 *   debut. Les mini-courbes, elles, montrent toujours le detail intermediaire
 *   — rien n'est perdu, c'est la meme donnee lue sur une autre portee.
 *
 * ⚠ « QUI LA PORTENT », ET NON « LE PREMIER ET LE DERNIER BILAN ». Un athlete
 *   qui saute son tour de mollet aurait vu son mollet muet, alors que la
 *   mesure existe un bilan plus loin et que la comparaison est parfaitement
 *   valable. C'est aussi pour ca que chaque etiquette porte SES dates : d'une
 *   mensuration a l'autre, la periode peut differer, et une periode commune
 *   affichee en pied de cadre aurait menti sur celles-la.
 *
 * ⚠ LES VALEURS REPORTEES SONT ECARTEES, ET C'EST LE PIEGE PRINCIPAL.
 *   bilansOrdonnes passe par _comblerMensurations : quand l'athlete confirme
 *   qu'un tour de bras n'a pas bouge, la valeur du bilan precedent est
 *   RECOPIEE dans le suivant et marquee `bmReportee`. Les lire telles quelles
 *   aurait affiche « stable » sur une periode ou plus personne n'avait sorti
 *   le metre — un chiffre affiche sans mesure derriere.
 *   La maison a deja tranche ce cas pour l'ecart gauche/droite, dans les memes
 *   termes : toute paire dont l'un des deux cotes est reporte est ECARTEE —
 *   pas corrigee, pas ponderee. On applique la meme regle, et on remonte
 *   jusqu'au dernier releve REEL. La periode s'allonge, les dates le disent.
 *
 * ⚠ ARRONDI AU DIXIEME, JAMAIS AU DEMI. volAffiche arrondit a 0,5 : elle
 *   convient aux series et detruit une mesure — +0,8 cm y devient « +1 cm ».
 * @returns {{cle:string,debut:{date:number,valeur:number},
 *            fin:{date:number,valeur:number},delta:number,stable:boolean}|null}
 */
/**
 * PURE. Les releves REELS d'une mensuration, du plus ancien au plus recent.
 * Les valeurs reportees sont ecartees — voir la regle ci-dessus.
 *
 * Sortie de corpsEcart pour que l'etiquette puisse dire « une seule mesure »
 * sans refaire le meme balayage d'une facon qui finirait par diverger.
 * @returns {Array<{date:number,valeur:number}>}
 */
function corpsRelevesReels(u,cle){
  if(!cle) return [];
  let bl=[];
  try{ bl=bilansOrdonnes(u)||[]; }catch(e){ return []; }
  const avec=[];
  for(const b of bl){
    let rep=false; try{ rep=bmReportee(b,cle); }catch(e){ rep=false; }
    if(rep) continue;
    let v=null; try{ v=getBM(b,cle); }catch(e){ v=null; }
    if(v>0) avec.push({date:Number(b&&b.date)||0,valeur:v});
  }
  return avec;
}
function corpsEcart(u,cle){
  const avec=corpsRelevesReels(u,cle);
  if(avec.length<2) return null;
  const a=avec[0], z=avec[avec.length-1];
  const d=Math.round((z.valeur-a.valeur)*10)/10;
  return {cle,debut:a,fin:z,delta:d,stable:Math.abs(d)<SYN_BRUIT_MESURE};
}
// « 04/06 ». Deux chiffres, parce que la place manque et que l'annee se lit
// dans l'infobulle, qui la donne en entier.
function _corpsJour(ts){
  const t=Number(ts)||0;
  if(!t) return '';
  try{ return new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}); }
  catch(e){ return ''; }
}
function _corpsJourLong(ts){
  const t=Number(ts)||0;
  if(!t) return '';
  try{ return new Date(t).toLocaleDateString('fr-FR'); }catch(e){ return ''; }
}
/**
 * PURE. Ce que porte l'etiquette d'une mensuration, ou null si elle n'a
 * aucun ecart a montrer.
 *
 * ⚠ UNE ETIQUETTE PAR MENSURATION MESUREE, ZEROS COMPRIS. Kevin, 23/09/2026 :
 *   « il faut l'ensemble des mensurations, si ya des 0 met les quand meme ».
 *   La version d'avant ne sortait que les tours qui avaient bouge : un corps
 *   ou trois mesures sur dix n'ont pas change montrait trois etiquettes, et on
 *   ne pouvait pas distinguer « pas bouge » de « pas mesure ». Les deux se
 *   disent maintenant, et ils ne se disent pas pareil.
 *
 * ⚠ UN TOUR MESURE UNE SEULE FOIS AFFICHE « 0 cm ». Kevin, 23/09/2026, apres
 *   avoir vu la version de ce matin : « met 0 cm partout meme pour une seule
 *   mesure ». Elle ecrivait « 1 mesure », ce qui etait plus exact ; il l'a
 *   tranche en le voyant a l'ecran, et c'est defendable : sur une silhouette
 *   il lit des centimetres, et quinze etiquettes qui disent trois choses
 *   differentes ne se lisent plus.
 *   CE QUE LE CHIFFRE NE FAIT PAS DIRE POUR AUTANT : `ecart` reste null. Le
 *   compteur d'ecarts, le pied de cadre et la pastille de l'onglet ferme ne
 *   comptent donc PAS ce tour parmi ceux qui ont bouge, et son infobulle dit
 *   mot pour mot qu'il n'a ete mesure qu'une fois, avec sa date et sa valeur.
 *   Le zero est un affichage, pas une mesure — et rien dans l'application ne
 *   le lit comme une.
 *   Un tour JAMAIS mesure, lui, n'a toujours pas d'etiquette du tout : il n'y
 *   a rien a montrer, et une etiquette vide sur un corps n'est que du bruit.
 *
 * ⚠ « stable » SOUS LA TOLERANCE, ET NON « +0,3 cm ». C'est _synEcart qui
 *   tranche, avec le meme seuil que le reste de l'application : un metre de
 *   couturiere se trompe d'un demi-centimetre, et un ecart plus petit que
 *   l'erreur de mesure n'est pas un ecart. L'afficher en chiffres le ferait
 *   lire comme un resultat. UN ZERO EXACT, LUI, S'ECRIT « 0 cm » : les deux
 *   releves donnent le meme nombre, ce n'est pas une incertitude de mesure.
 *
 * ⚠ AUCUNE COULEUR DE JUGEMENT (regle R32) : un tour de taille qui descend
 *   est un but, un tour de bras qui descend une perte, et rien dans le
 *   dossier ne dit lequel des deux on cherche. L'ecart s'ecrit toujours dans
 *   la meme encre.
 * @returns {{cle:string,lib:string,valeur:string,periode:string,titre:string,
 *            ecart:object}|null}
 */
function corpsMesureEtiquette(u,cle){
  let rel=[];
  try{ rel=corpsRelevesReels(u,cle); }catch(err){ rel=[]; }
  if(!rel.length) return null;
  const nom=CORPS_NOMS[cle]||cle;
  const long=_libMesure(((MEAS.find(m=>m.k===cle)||{}).l)||nom,true);
  // UNE SEULE MESURE : « 0 cm » a l'ecran, et l'infobulle dit qu'il n'y a
  // qu'un releve. ecart:null — voir la doctrine : ce zero ne compte nulle part
  // comme un ecart.
  if(rel.length<2){
    const seul=rel[0];
    return {cle,lib:nom,valeur:'0'+String.fromCharCode(160)+'cm',
      periode:_corpsJour(seul.date),ecart:null,
      titre:long+' · mesuré une seule fois, le '+_corpsJourLong(seul.date)
        +' · '+String(seul.valeur).replace('.',',')+' cm'
        +' · un écart demande deux relevés'};
  }
  let e=null;
  try{ e=corpsEcart(u,cle); }catch(err){ e=null; }
  if(!e) return null;
  const t=_synEcart(e.delta,'cm',SYN_BRUIT_MESURE);
  // UN ZERO EXACT S'ECRIT, il ne devient pas « stable » : « stable » veut dire
  // « plus petit que l'erreur du metre », « 0 cm » veut dire « le meme
  // nombre ». Ce n'est pas la meme information.
  if(e.delta===0) t.delta='0'+String.fromCharCode(160)+'cm';
  const periode=_corpsJour(e.debut.date)+' → '+_corpsJour(e.fin.date);
  // L'infobulle et la phrase lue commencent par la MENSURATION, en toutes
  // lettres : l'etiquette n'en montre que le nom court.
  return {cle,lib:nom,valeur:t.delta,periode,ecart:e,
    titre:long+' · '+t.delta
      +' · du '+_corpsJourLong(e.debut.date)+' au '+_corpsJourLong(e.fin.date)
      +' · tolérance ± '+String(SYN_BRUIT_MESURE).replace('.',',')+' cm'
      +' · '+String(e.debut.valeur).replace('.',',')+' → '
      +String(e.fin.valeur).replace('.',',')+' cm'};
}
// Jusqu'ou remonter pour trouver une semaine travaillee. Huit semaines : au
// dela, la charge ne decrit plus l'athlete d'aujourd'hui.
const CORPS_SEM_MAX=8;
/**
 * La derniere semaine qui porte du volume, ou null. IMPURE — elle lit
 * l'horloge par _volCleDecalee. Elle borne la courbe des series dures.
 *
 * ⚠ POURQUOI PAS SIMPLEMENT LA SEMAINE EN COURS. Un lundi matin, elle est
 *   vide : la courbe tomberait a zero, et le coach lirait « il ne fait rien »
 *   alors que la semaine n'a pas commence. On remonte donc jusqu'a la
 *   derniere semaine REELLEMENT travaillee, et le pied de la courbe DIT
 *   laquelle.
 *
 * ⚠ ET ON NE PREVOIT RIEN DANS LE TRAIT PLEIN. grilleCharge, elle, remplit
 *   une semaine vide avec le volume PREVISIONNEL du gabarit ; tracer ce
 *   previsionnel comme du realise serait tracer une charge qui n'a pas eu
 *   lieu. Depuis le 1396, quand un programme existe, corpsCourbesVolume ne
 *   passe plus par ici : la semaine en cours y est la semaine ENTIERE du
 *   programme, EN POINTILLE, et le pied le dit. Cote courbe, cette fonction
 *   ne borne plus que celle d'un athlete sans programme.
 * @returns {{cle:string,decalage:number}|null}
 */
function corpsSemaineVolume(u){
  for(let n=0;n<=CORPS_SEM_MAX;n++){
    let cle=null;
    try{ cle=_volCleDecalee(n); }catch(e){ return null; }
    let vol={};
    try{ vol=volumeSemaine(u,cle)||{}; }catch(e){ vol={}; }
    for(const m in vol) if(vol[m]>0) return {cle,decalage:n};
  }
  return null;
}
/**
 * PURE. La zone de charge de chaque muscle d'une vue, pour un volume
 * hebdomadaire — MEV / MAV / MRV.
 *
 * ⚠ LA TEINTE DIT LE VOLUME D'ENTRAINEMENT, JAMAIS LE DEVELOPPEMENT. C'est la
 *   seule question sur ce corps pour laquelle il existe des reperes. Un tour
 *   de cuisse, lui, n'est ni bon ni mauvais, et reste dans la meme encre
 *   (regle R32).
 * ⚠ UN MUSCLE SANS REPERE N'EST PAS TEINTE : reperesEffectifs rend null pour
 *   les lombaires, les abducteurs et les adducteurs. Les peindre aurait
 *   invente le repere qui manque.
 * @returns {Object.<string,string>} muscle → zone
 */
function corpsZones(u,vue,vol){
  const out={};
  const v=vol||{};
  for(const m of (CORPS_MUSCLES_VUE[vue]||[])){
    let rep=null;
    try{ rep=reperesEffectifs(u,m); }catch(err){ rep=null; }
    if(!rep) continue;
    let k=null;
    try{ k=_repereDe(Number(v[m])||0,rep); }catch(err){ k=null; }
    if(k) out[m]=k;
  }
  return out;
}
// ══ LA TEINTE DIT LA ZONE DE CHAQUE MUSCLE, SUR LE VOLUME DU PROGRAMME ═══
//
// Kevin, 22/09/2026, devant une silhouette presque toute bleue : « recolorie
// mieux avec le volume total de la semaine ». Il voulait les MEMES couleurs —
// rouge, vert, bleu — calculees sur un meilleur volume : celui que le
// PROGRAMME donne a chaque muscle, pas les seances deja faites d'une semaine
// en cours. Le 1386 avait compris l'inverse et remplace les couleurs par une
// rampe orange : a 15 series et plus pour presque chaque muscle, tout le haut
// du corps sortait du meme orange fonce. Refuse (« y a plus de rouge vert
// bleu… tout est de la même couleur »), et retire au 1397 avec sa rampe.
//
// LES QUATRE ZONES DE LA GRILLE DE CHARGE, AVEC SES COULEURS (GC_COULEURS) :
// sous-MEV gris, MEV-MAV bleu, MAV-MRV vert, sur-MRV rouge. Un bleu ici veut
// dire la meme chose que dans la grille : une couleur, un seul sens d'un
// ecran a l'autre. Le volume vient de _htmlCorpsCadre — celui du programme,
// ramene a la semaine (volumePrescritProgramme) ; sans programme, les series
// faites.
//
// ⚠ UN MUSCLE SANS REPERE N'EST PAS TEINTE : reperesEffectifs rend null pour
//   les lombaires, les abducteurs et les adducteurs. Les peindre inventerait
//   le repere qui manque. Leur chiffre reste dans la bulle.
// ⚠ NI UN MUSCLE SANS SERIE AU PROGRAMME. Les abdominaux, les trapezes et les
//   avant-bras ont un MEV de 0 : zero serie tombait « dans la zone » et
//   sortait BLEU — un muscle absent du programme avait l'air bien dose (vu au
//   banc, 1397). Il garde le gris clair du dessin ; la bulle dit « aucune
//   série ».
// PURE. La couleur de chaque muscle d'une vue : celle de sa zone de volume.
function corpsTeintes(u,vue,vol){
  const v=vol||{}, z=corpsZones(u,vue,v), out={};
  for(const m in z){
    if(!((Number(v[m])||0)>0)) continue;
    const c=GC_COULEURS[z[m]]; if(c) out[m]=c;
  }
  return out;
}
// PURE. Ce que dit chaque muscle d'une vue quand on le touche : son nom, ses
// series, et sa zone quand il a un repere. Un muscle a zero le dit aussi —
// le gris n'est pas un oubli, c'est une semaine sans serie.
// `prog` : le volume du programme entier (volumePrescritProgramme). Pour un
// bloc de plusieurs semaines, le muscle dit son TOTAL sur le programme, puis
// sa moyenne par semaine — celle que la couleur et la zone lisent.
function corpsInfobulles(u,vue,vol,prog){
  const v=vol||{}, z=corpsZones(u,vue,v), out={};
  const nSem=prog&&prog.source==='bloc'&&prog.semaines>1?prog.semaines:0;
  const tot=nSem&&prog.total?prog.total:null;
  /** Une demi-série près, au singulier sous deux. */
  const series=n=>{ const r=Math.round(n*2)/2; return volAffiche(n)+' série'+(r>=2?'s':''); };
  for(const m of (CORPS_MUSCLES_VUE[vue]||[])){
    const lib=(MUSCLES[m]||{}).lib||m;
    const n=Number(v[m])||0;
    // volAffiche arrondit a la demi-serie : un quart de serie secondaire
    // s'afficherait « 0 série » sur un muscle pourtant teinte.
    const a=volAffiche(n), r=Math.round(n*2)/2;
    if(tot&&n>0){
      out[m]=lib+' · '+series(Number(tot[m])||0)+' sur '+nSem+' semaines · '
        +(r>0?a:'moins d’une demi-série')+' par semaine'+(z[m]?(' · '+z[m]):'');
      continue;
    }
    out[m]=lib+' · '+(!(n>0)?'aucune série'
      :((r>0?(a+' série'+(r>=2?'s':'')):'moins d’une demi-série')
        +(z[m]?(' · '+z[m]):'')));
  }
  return out;
}
// ══ LA SILHOUETTE A DEUX LECTURES : L'EVOLUTION, ET LE VOLUME ══════════════
//
// Kevin, 23/09/2026 : « Deux boutons, Évolution et Volume. Évolution est la vue
// par défaut. Vert ce qui a pris depuis le dernier bilan, rouge ce qui a perdu,
// gris ce qui n'a pas bougé depuis trois bilans. »
//
// ⚠ LA COULEUR DIT UN SENS, PAS UN JUGEMENT. Un tour de cuisse qui descend en
//   seche est exactement ce qu'on cherche ; il sort rouge quand meme, parce que
//   la teinte dit « ce tour a perdu », et rien d'autre. La legende et le petit
//   cadre le disent a l'ecran, en toutes lettres, sous les trois pastilles.
//   C'est la seule facon de tenir la doctrine du corps avec des couleurs :
//   aucune note, aucun pronostic, aucun « bien » ni « mal ».
//
// ⚠ ET C'EST LA MEME PALETTE QUE LA GRILLE DE CHARGE, A DESSEIN. Vert, rouge et
//   gris ne veulent pas dire la meme chose dans les deux lectures du cadre —
//   d'ou les deux boutons, un seul actif a la fois, et une legende qui commence
//   par dire CE QUE la teinte raconte. Une couleur de plus (violet, orange)
//   aurait ajoute une convention a apprendre pour ne rien dire de mieux.
//
// LE SEUIL : POURQUOI 0,5 CM.
//   Un ruban se lit au demi-centimetre, et toute l'application appelle
//   « stable » un ecart plus petit : corpsEcart, les etiquettes du cadre, la
//   synthese d'Evolution (SYN_BRUIT_MESURE). Un second seuil ici — 0,7 cm, la
//   somme quadratique de deux lectures a ±0,5 — serait plus juste en theorie et
//   faux a l'ecran : la meme silhouette afficherait « +0,6 cm » sur une
//   etiquette et un muscle gris a cote, deux verdicts contraires sur la meme
//   mesure. On garde donc 0,5 cm, on l'affiche, ET on ne s'en sert pas comme
//   d'une preuve : la bulle donne les trois derniers releves avec leurs dates,
//   et c'est le coach qui tranche.
//   ⚠ VALEUR LITTERALE, PAS UNE REFERENCE : SYN_BRUIT_MESURE est declare plus
//     bas dans le fichier, et un `const` qui le lirait ici tomberait au
//     chargement. Un test tient l'egalite des deux.
const CORPS_BOUGE_MIN=0.5;
// Trois releves pour dire « n'a pas bouge » : deux tours identiques d'un bilan
// au suivant, ca arrive sans rien signifier. Meme nombre que CCD_DORT_BILANS,
// meme raison, et un test tient l'egalite.
const CORPS_BOUGE_BILANS=3;
const CORPS_EVO_COULEURS=Object.freeze({pris:'#22c55e',perdu:'#e05050',stable:'#6f6f6f'});
// LA TOLERANCE VOYAGE AVEC CHAQUE PHRASE : « toute valeur affichee porte sa
// source, sa date et sa marge », et une bulle qu'on lit seule doit porter la
// sienne. La legende, qui les enchaine toutes, la dit une fois en fin de ligne.
const CORPS_EVO_RUBAN='ruban, ± '+String(CORPS_BOUGE_MIN).replace('.',',')+' cm';
// « bicep-r » → les deux cotes. Un muscle du dessin n'a pas de cote : la zone
// BICEPS couvre les deux bras, donc la teinte doit lire les deux tours.
function _corpsPaire(cle){
  const m=/^(.*)-(r|l)$/.exec(String(cle||''));
  return m?[m[1]+'-r',m[1]+'-l']:[String(cle||'')];
}
// « tour de biceps », « tour de poitrine » : le nom du tour SANS son cote, pris
// dans MEAS — la meme table que les graphiques et les bilans.
function _corpsLibTour(cle){
  const l=((typeof MEAS!=='undefined'&&MEAS.find(x=>x.k===cle))||{}).l||CORPS_NOMS[cle]||cle;
  return _libMesure(l,false).replace(/ (droit|gauche)$/,'');
}
/**
 * PURE. Ce que la mensuration liee a un muscle a fait AU DERNIER BILAN, cote
 * par cote, ou null quand aucune mensuration ne suit ce muscle.
 *
 * ⚠ LE DERNIER ECART, ET NON LE CHEMIN DEPUIS LE DEBUT. C'est la demande :
 *   « ce qui a pris depuis le dernier bilan ». Les etiquettes du meme cadre
 *   disent, elles, le premier au dernier bilan : deux portees, deux phrases, et
 *   la legende dit laquelle est teinte.
 *
 * ⚠ LES DEUX COTES DOIVENT ALLER DANS LE MEME SENS. Un biceps droit a +0,8 et
 *   un gauche a -0,6 donneraient un bras vert alors que l'etiquette de gauche
 *   affiche une perte : le muscle n'est PAS teinte, et la bulle dit pourquoi.
 *   Meme regle que pour l'ecart gauche/droite : une paire contradictoire est
 *   ecartee, pas moyennee.
 *
 * ⚠ RELEVES REELS SEULEMENT (corpsRelevesReels) : une valeur recopiee d'un
 *   bilan sur l'autre afficherait « n'a pas bouge » la ou personne n'a sorti
 *   le metre.
 * @returns {{muscle:string,cle:string,cotes:Array<any>,sens:string}|null}
 */
function corpsEvolutionMuscle(u,muscle,depuisLePremier){
  const base=BLOC_MESURE_DE[muscle];
  if(!base) return null;
  // ⚠ `depuisLePremier` VIENT DE LA PAIRE DE BILANS (lot 5). Le dossier est
  //   alors deja borne aux deux dates choisies, et la teinte doit dire l'ecart
  //   d'un bout a l'autre de cette fenetre, pas celui de ses deux derniers
  //   releves.
  const _dp=(depuisLePremier===true);
  const cotes=[];
  for(const k of _corpsPaire(base)){
    let rel=[]; try{ rel=corpsRelevesReels(u,k)||[]; }catch(e){ rel=[]; }
    if(!rel.length) continue;
    const n=rel.length, fin=rel[n-1];
    const avant=(n>=2)?rel[_dp?0:(n-2)]:null;
    const delta=avant?Math.round((fin.valeur-avant.valeur)*10)/10:null;
    const trois=rel.slice(-CORPS_BOUGE_BILANS).map(x=>x.valeur);
    const amp=Math.round((Math.max.apply(null,trois)-Math.min.apply(null,trois))*10)/10;
    cotes.push({cle:k,nom:CORPS_NOMS[k]||k,n:n,valeur:fin.valeur,date:fin.date,
      depuis:avant?avant.date:0,delta:delta,derniers:trois,amp:amp,
      dort:(n>=CORPS_BOUGE_BILANS&&amp<CORPS_BOUGE_MIN),
      sens:(delta===null)?'seul'
        :(delta>=CORPS_BOUGE_MIN?'pris':(delta<=-CORPS_BOUGE_MIN?'perdu':'plat'))});
  }
  if(!cotes.length) return null;
  const s={}; for(const c of cotes) s[c.sens]=1;
  let sens='seul';
  if(s.pris&&s.perdu) sens='contraire';
  else if(s.pris) sens='pris';
  else if(s.perdu) sens='perdu';
  else if(!s.seul) sens=cotes.every(c=>c.dort)?'stable':'plat';
  return {muscle:muscle,cle:base,cotes:cotes,sens:sens};
}
// PURE. La couleur de chaque muscle d'une vue : le sens de sa mensuration.
// Un muscle qu'aucune mensuration ne suit, une paire contradictoire, un tour
// mesure une seule fois, un tour stable sans ses trois releves : pas de teinte.
function corpsTeintesEvolution(u,vue,depuisLePremier){
  const out={};
  for(const m of (CORPS_MUSCLES_VUE[vue]||[])){
    let e=null; try{ e=corpsEvolutionMuscle(u,m,depuisLePremier); }catch(err){ e=null; }
    if(!e) continue;
    const c=CORPS_EVO_COULEURS[e.sens];
    if(c) out[m]=c;
  }
  return out;
}
// POURQUOI CE MUSCLE N'EST PAS TEINTE, ou pourquoi il est gris. Une silhouette
// a trous se lit comme une panne si personne ne dit ce qui manque.
function _corpsEvoSilence(e){
  if(e.sens==='contraire') return 'pas de teinte : les deux côtés ne vont pas dans le même sens';
  if(e.sens==='seul') return 'pas de teinte : une seule mesure, l’écart viendra au prochain bilan';
  if(e.sens==='stable') return 'n’a pas bougé sur ses trois derniers relevés';
  if(e.sens!=='plat') return '';
  // Stable au dernier releve, mais il a bouge avant : les trois releves
  // existent, ils ne se ressemblent pas. Dire « il faut trois releves » serait
  // faux, et le coach chercherait une mesure qui est deja la.
  return e.cotes.every(c=>c.n>=CORPS_BOUGE_BILANS)
    ?'pas de teinte : stable depuis son dernier relevé, mais il a bougé sur les trois derniers'
    :'pas de teinte : il faut trois relevés pour dire qu’un tour n’a pas bougé';
}
/**
 * PURE. Ce que dit un muscle sous le doigt en lecture d'evolution : le muscle,
 * LE TOUR QUI LE SUIT, sa valeur du jour avec sa date, son ecart depuis le
 * releve d'avant, ses trois derniers releves, et la tolerance du ruban.
 *
 * ⚠ LE TOUR EST NOMME, ET C'EST LA REGLE DE BLOC_MESURE_DE : biceps et triceps
 *   partagent le tour de bras, quadriceps et ischios le tour de cuisse. Le
 *   coach doit voir qu'il lit UNE mesure, pas deux.
 */
function _corpsEvoPhrase(e){
  const lib=(MUSCLES[e.muscle]||{}).lib||e.muscle;
  const deux=e.cotes.length>1;
  const tour=_corpsLibTour(e.cle);
  const p=[lib];
  e.cotes.forEach((c,i)=>{
    const cote=/-r$/.test(c.cle)?'à droite':(/-l$/.test(c.cle)?'à gauche':'');
    const bouts=[_synNombre(c.valeur)+' cm'+(c.date?(' le '+_corpsJour(c.date)):'')];
    bouts.push((c.delta===null)?'une seule mesure'
      :(((Math.abs(c.delta)<CORPS_BOUGE_MIN)?'stable'
        :((c.delta>0?'+':'−')+_synNombre(c.delta)+' cm'))
        +(c.depuis?(' depuis le '+_corpsJour(c.depuis)):'')));
    if(c.derniers.length>1)
      bouts.push(((c.derniers.length===CORPS_BOUGE_BILANS)?'trois derniers'
        :(c.derniers.length+' derniers'))+' : '
        +c.derniers.map(v=>_synNombre(v)).join(' ; ')+' cm');
    p.push((i===0?(tour+(deux?', ':' : ')):'')+(deux?(cote+' : '):'')+bouts.join(', '));
  });
  const s=_corpsEvoSilence(e);
  if(s) p.push(s);
  p.push(CORPS_EVO_RUBAN);
  return p.join(' · ');
}
// PURE. La phrase de chaque muscle de la vue, teinte ou pas. Un muscle
// qu'aucune mensuration ne suit le dit : c'est une absence de mesure, pas un
// oubli d'affichage, et inventer un rapprochement serait pire.
function corpsInfobullesEvolution(u,vue,depuisLePremier){
  const out={};
  for(const m of (CORPS_MUSCLES_VUE[vue]||[])){
    let e=null; try{ e=corpsEvolutionMuscle(u,m,depuisLePremier); }catch(err){ e=null; }
    const lib=(MUSCLES[m]||{}).lib||m;
    out[m]=e?_corpsEvoPhrase(e):(lib+' · aucune mensuration ne suit ce muscle');
  }
  return out;
}
// Les deux lectures ont la meme forme de sortie : teintes + infobulles.
function corpsEvolutionVue(u,vue,depuisLePremier){
  return {teintes:corpsTeintesEvolution(u,vue,depuisLePremier),
    infos:corpsInfobullesEvolution(u,vue,depuisLePremier)};
}
// LA LEGENDE DE L'EVOLUTION. Ce que la teinte raconte, trois pastilles, puis
// chaque muscle teinte en toutes lettres : la couleur se lit sans la voir.
const CORPS_EVO_LIB=Object.freeze({pris:'a pris',perdu:'a perdu',
  stable:'n’a pas bougé (trois relevés)'});
function _htmlCorpsEvoLegende(vue,evo){
  // LA TOLERANCE UNE FOIS EN FIN DE LIGNE, pas a chaque muscle : lue a voix
  // haute, « ruban, plus ou moins 0,5 cm » sept fois de suite est un mur.
  const lus=(CORPS_MUSCLES_VUE[vue]||[]).filter(m=>evo.teintes[m])
    .map(m=>String(evo.infos[m]||'').split(' · '+CORPS_EVO_RUBAN).join('')
      .replace(' · ',' : ').split(' · ').join(', '));
  return '<div class="cc-corps-l">'
    +'<span class="cc-corps-lt">Teinte : ce que chaque tour a fait depuis son '
    +'dernier relevé (les étiquettes, elles, disent tout le chemin depuis le '
    +'premier bilan)</span>'
    +Object.keys(CORPS_EVO_LIB).map(k=>'<span class="cc-corps-lp">'
      +'<i style="background:'+escapeHtml(CORPS_EVO_COULEURS[k])+'"></i>'
      +escapeHtml(CORPS_EVO_LIB[k])+'</span>').join('')
    +(lus.length?('<span class="cc-corps-lu">Depuis le dernier relevé : '
      +lus.map(x=>escapeHtml(x)).join(' ; ')+'. '
      +escapeHtml(CORPS_EVO_RUBAN.charAt(0).toUpperCase()+CORPS_EVO_RUBAN.slice(1))
      +' près.</span>'):'')
    +'</div>';
}
// « 15 septembre ». La courbe des series dures nomme la semaine ou elle
// s'arrete : sans elle, une courbe arretee trois semaines plus tot aurait
// l'air de decrire celle-ci.
function _corpsLibSemaine(cle){
  const d=(function(){ try{ return _lundiDeSemaine(cle); }catch(e){ return null; } })();
  if(!d) return '';
  try{ return d.toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }
  catch(e){ return ''; }
}
/**
 * PURE. Combien de mensurations PROPRES A CETTE VUE ont bouge.
 *
 * ⚠ PROPRES A CETTE VUE, ET C'EST TOUT LE SUJET DEPUIS LE NOUVEAU MODELE. Le
 *   cou, les bras, la taille, les hanches, les cuisses et les mollets se
 *   lisent sur les deux silhouettes : les compter aurait allume la pastille
 *   de l'onglet ferme presque toujours, pour rien qu'on ne voie deja. Seules
 *   la poitrine et le buste n'existent que de face, les fessiers que de dos —
 *   ce sont eux qu'un coach qui ne retourne jamais la silhouette manquerait.
 *
 * ⚠ ET SEULEMENT CE QUI DEPASSE LE BRUIT. Un ecart sous la tolerance s'ecrit
 *   « stable » ; le compter ferait clignoter un onglet pour un
 *   demi-millimetre.
 * @param {any} u
 * @param {'face'|'dos'} vue
 * @returns {number}
 */
function corpsEcartsDeVue(u,vue){
  const autre=(vue==='dos')?'face':'dos';
  const ailleurs=new Set((CORPS_MESURES[autre]||[]).map(m=>m.k));
  let n=0;
  for(const m of (CORPS_MESURES[vue]||[])){
    if(ailleurs.has(m.k)) continue;
    let x=null;
    try{ x=corpsEcart(u,m.k); }catch(err){ x=null; }
    if(x&&!x.stable) n++;
  }
  return n;
}
// LA VUE EST UNE LENTILLE, PAS UNE DONNEE. Elle ne vit pas dans le dossier de
// l'athlete : c'est le coach qui regarde de face ou de dos, et son choix n'a
// rien a faire dans un document qui decrit quelqu'un d'autre.
let _corpsVue='face';
function corpsVue(v){
  _corpsVue=(v==='dos')?'dos':'face';
  try{
    // ⚠ ON RE-REND LE CADRE QUI EST A L'ECRAN, PAS SEULEMENT CELUI DU COACH.
    //   Kevin, 23/09/2026 : « j'ai l'impossibilite de cliquer sur la vue
    //   arriere, bizarrement, je peux voir que la vue avant ». Le bouton
    //   marchait — _corpsVue basculait bien — mais seul renderCorpsCoach etait
    //   rappele, et sur l'ecran de l'athlete il n'y a pas de fiche a rendre :
    //   l'etat changeait sans que rien ne se redessine, ce qui se voit comme
    //   un bouton mort. Les deux cadres sont donc rafraichis, chacun si son
    //   conteneur est la ; ils ne coexistent jamais sur le meme ecran.
    if(document.getElementById('ccd-corps')){
      const c=getOwnedClient(currentClientId);
      if(c) renderCorpsCoach(c);
    }
    const za=document.getElementById('prog-corps');
    if(za) renderCorpsAthlete(za);
    // ⚠ LE BOUTON QU'ON VIENT DE CLIQUER N'EXISTE PLUS. Le rendu remplace tout
    //   le cadre, lui compris : au clavier, le focus retombait sur le corps de
    //   la page et il fallait re-tabuler depuis le haut de la fiche pour
    //   revenir a l'autre vue. On le repose sur l'onglet devenu actif, dans
    //   celui des deux cadres qui existe. A la souris, rien ne se voit : la
    //   bague de focus est en :focus-visible, qui ne s'allume pas sur un clic.
    const b=document.querySelector('#ccd-corps .cc-corps-o.actif')
      ||document.querySelector('#prog-corps .cc-corps-o.actif');
    if(b) b.focus();
  }catch(e){}
  return _corpsVue;
}
// LA LECTURE EST UNE LENTILLE AUSSI, et elle ne vit pas plus dans le dossier de
// l'athlete que la vue : c'est le coach qui choisit de regarder l'evolution ou
// le volume. Par defaut l'evolution (Kevin, 23/09/2026 : « Évolution est la vue
// par défaut ») — la question de cet onglet est ce que le corps a fait, pas ce
// que le programme demande.
let _corpsMode='evolution';
function corpsMode(m){
  _corpsMode=(m==='volume')?'volume':'evolution';
  try{
    // Le meme rafraichissement que corpsVue, et pour la meme raison : le bouton
    // qu'on vient de cliquer disparait avec le cadre qu'il rend.
    if(document.getElementById('ccd-corps')){
      const c=getOwnedClient(currentClientId);
      if(c) renderCorpsCoach(c);
    }
    const b=document.querySelector('#ccd-corps .cc-corps-lec .cc-corps-o.actif');
    if(b) b.focus();
  }catch(e){}
  return _corpsMode;
}
// ⚠ PLUS DE PHOTO SUR LA TETE — Kevin, 21/09/2026 : « supprime le rond sur la
//   tete, c'est pas utile ». _htmlCorpsTete et son emplacement de visage sont
//   retires ; la regle qui les gardait tient toujours ailleurs : jamais
//   photosProgression dans la fiche coach.
// « 12,3 » sans trainee de virgule flottante : les pourcentages de position
// partent dans un attribut style, et 5.500000000000001 % y serait illisible.
function _arr1(v){ return Math.round((Number(v)||0)*10)/10; }
// LA SILHOUETTE ET SON CALQUE DE ZONES. Le calque est un <canvas> vide : il
// est peint APRES l'insertion par _corpsPeindreCalques, qui lit la carte de
// zones de la silhouette. Sans teinte, pas de calque, et la silhouette garde
// son rouge.
// `infos` : ce que dit chaque muscle quand on le touche (corpsInfobulles). Il
// voyage avec le calque, qui est le seul a savoir quel muscle est sous le doigt.
function _htmlCorpsPlanche(genre,vue,teintes,infos){
  const pl=CORPS_PLANCHE[genre+'-'+vue]||CORPS_PLANCHE['h-face'];
  const t=teintes||{};
  const n=Object.keys(t).length;
  return '<div class="cc-corps-planche"'+(n?' data-teinte=""':'')+' style="left:'+((100-CORPS_PART_CORPS)/2)
    +'%;width:'+CORPS_PART_CORPS+'%">'
    +'<img src="'+pl.src+'" alt="" aria-hidden="true" decoding="async">'
    +(n?'<canvas class="cc-corps-calque" width="'+pl.w+'" height="'+pl.h+'" aria-hidden="true"'
      +' data-carte="'+pl.zones+'" data-t="'+escapeHtml(JSON.stringify(t))+'"'
      +' data-i="'+escapeHtml(JSON.stringify(infos||{}))+'"></canvas>':'')
    +'</div>';
}
// ══ LE CHIFFRE SOUS LE DOIGT ══════════════════════════════════════════════
// Une teinte continue se compare d'un coup d'oeil, elle ne se chiffre pas :
// entre deux oranges voisins, personne ne lit 11 ou 13 series. On touche le
// muscle, il dit son nombre — et sa zone quand il a un repere.
//
// ⚠ LE MUSCLE SE LIT DANS LA CARTE DE ZONES, PAS DANS LE DESSIN. C'est la
//   meme image que celle qui peint le calque, deja en memoire : aucun second
//   decoupage qui finirait par ne plus tomber sur les memes pixels.
//
// ⚠ AU DOIGT, LA BULLE RESTE. Sur un ecran tactile, pointerleave tombe juste
//   apres le relachement : la bulle aurait disparu avant d'etre lue. Elle
//   s'efface au toucher suivant hors d'un muscle.
function _corpsBrancherBulle(cv,carte){
  const pl=cv&&cv.parentNode;
  if(!pl||pl.querySelector('.cc-corps-bulle')) return false;
  let infos={}; try{ infos=JSON.parse(cv.getAttribute('data-i')||'{}'); }catch(e){ infos={}; }
  const b=document.createElement('div');
  b.className='cc-corps-bulle'; b.hidden=true;
  pl.appendChild(b);
  const montrer=ev=>{
    const r=pl.getBoundingClientRect();
    if(!r.width||!r.height){ b.hidden=true; return; }
    const x=ev.clientX-r.left, y=ev.clientY-r.top;
    const px=Math.floor(x/r.width*carte.width), py=Math.floor(y/r.height*carte.height);
    let m=null;
    if(px>=0&&py>=0&&px<carte.width&&py<carte.height)
      m=CORPS_ZONES_ORDRE[Math.round(carte.data[(py*carte.width+px)*4]/CORPS_ZONES_PAS)-1]||null;
    const txt=m&&infos[m];
    if(!txt){ b.hidden=true; return; }
    b.textContent=txt;
    // Une phrase d'evolution porte trois valeurs et deux dates : elle passe a
    // la ligne plutot que de sortir du cadre. Une phrase de volume, courte,
    // garde son nowrap.
    b.classList.toggle('long',String(txt).length>44);
    b.style.left=_arr1(x/r.width*100)+'%';
    b.style.top=_arr1(y/r.height*100)+'%';
    b.hidden=false;
  };
  pl.addEventListener('pointermove',montrer);
  pl.addEventListener('pointerdown',montrer);
  pl.addEventListener('pointerleave',ev=>{ if(ev.pointerType!=='touch') b.hidden=true; });
  return true;
}
// Les cartes de zones, lues une fois chacune.
const _corpsCartes={};
function _corpsCarte(src){
  if(!_corpsCartes[src]) _corpsCartes[src]=new Promise((ok,ko)=>{
    const i=new Image();
    i.onload=()=>{
      try{
        const c=document.createElement('canvas');
        c.width=i.naturalWidth; c.height=i.naturalHeight;
        const x=c.getContext('2d',{willReadFrequently:true});
        x.drawImage(i,0,0);
        ok(x.getImageData(0,0,c.width,c.height));
      }catch(e){ ko(e); }
    };
    i.onerror=()=>{ delete _corpsCartes[src]; ko(new Error('carte de zones illisible')); };
    i.src=src;
  });
  return _corpsCartes[src];
}
function _corpsRvb(h){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(h||''));
  if(!m) return null;
  const v=parseInt(m[1],16);
  return [(v>>16)&255,(v>>8)&255,v&255];
}
// PEINT LES CALQUES d'un cadre rendu : chaque pixel de la carte prend la
// couleur de la zone de son muscle, ou reste transparent. Le multiply du CSS
// garde le dessin dessous — un aplat opaque l'aurait efface.
async function _corpsPeindreCalques(racine){
  const cs=(racine||document).querySelectorAll('canvas.cc-corps-calque');
  for(const cv of cs){
    try{
      const carte=await _corpsCarte(cv.getAttribute('data-carte'));
      let t={}; try{ t=JSON.parse(cv.getAttribute('data-t')||'{}'); }catch(e){ t={}; }
      const lut=[null].concat(CORPS_ZONES_ORDRE.map(m=>_corpsRvb(t[m])));
      cv.width=carte.width; cv.height=carte.height;
      const ctx=cv.getContext('2d');
      const out=ctx.createImageData(carte.width,carte.height);
      const s=carte.data, d=out.data;
      for(let i=0;i<s.length;i+=4){
        const k=Math.round(s[i]/CORPS_ZONES_PAS);
        const c=(k>0&&k<lut.length)?lut[k]:null;
        if(c){ d[i]=c[0]; d[i+1]=c[1]; d[i+2]=c[2]; d[i+3]=255; }
      }
      ctx.putImageData(out,0,0);
      _corpsBrancherBulle(cv,carte);
    }catch(e){}
  }
}
