// ══ CE QUI BLOQUE, RANGE PAR GROUPE MUSCULAIRE ═══════════════════════════
//
// Kevin, 08/09/2026 : « les plateaux groupes par groupe musculaire dans UNE
// carte, avec des lignes deroulantes, la petite figurine d'avatar et une
// fleche pour rejoindre les exercices de ce groupe ».
//
// CE QUI CHANGE N'EST PAS L'HABILLAGE, C'EST LA LECTURE. La carte listait
// d'abord les muscles en plateau, puis TOUS les exercices bloques a la suite,
// sans lien entre les deux : « PECTORAUX : plateau musculaire, 3 exercices
// bloques » etait suivi d'une liste de dix noms ou il fallait deviner lesquels
// etaient les trois. On decide par groupe — c'est le groupe qu'on reprogramme,
// pas l'exercice isole — donc c'est par groupe que ca se range.
//
// PURE. Les exercices bloques, ranges par muscle PRIMAIRE.
// UN EXERCICE PEUT COMPTER DANS DEUX GROUPES, et c'est voulu : un developpe
// incline bloque bloque les pectoraux ET les deltoides anterieurs, et le
// masquer dans l'un des deux ferait mentir le compte de l'autre. C'est deja la
// regle de musclesEnPlateau, qui pousse le meme exercice dans chaque primaire.
// Les exercices dont on ne sait pas resoudre le muscle finissent dans un
// groupe sans nom plutot que d'etre perdus.
function plateauxParGroupe(c){
  let bloques=[];
  try{ bloques=_listeEtats(c).filter(x=>x.etat==='plateau'||x.etat==='regression'); }
  catch(e){ bloques=[]; }
  if(!bloques.length) return [];
  let musculaires=[];
  try{ musculaires=musclesEnPlateau(c).map(x=>x.m); }catch(e){ musculaires=[]; }
  const par=new Map(), orphelins=[];
  for(const x of bloques){
    let p=[];
    try{
      const cls=resoudreMusclesLecture(x.nom,{name:x.nom},c);
      p=(cls&&cls!==VOL_CARDIO&&cls.p)?cls.p:[];
    }catch(e){ p=[]; }
    if(!p.length){ orphelins.push(x); continue; }
    for(const m of p){
      if(!par.has(m)) par.set(m,[]);
      par.get(m).push(x);
    }
  }
  const out=[];
  for(const [m,ex] of par) out.push({
    m, lib:(MUSCLES[m]||{}).lib||m, couleur:(MUSCLES[m]||{}).c||'var(--text)',
    exercices:ex, musculaire:musculaires.indexOf(m)>=0});
  // LES PLATEAUX MUSCULAIRES EN TETE : deux exercices primaires bloques sur un
  // meme muscle, ce n'est plus un mauvais jour, c'est une programmation a
  // revoir. Puis le nombre d'exercices, puis l'ordre alphabetique pour que
  // deux rendus successifs ne s'echangent pas les lignes.
  out.sort((a,b)=>(b.musculaire-a.musculaire)
    ||(b.exercices.length-a.exercices.length)
    ||a.lib.localeCompare(b.lib));
  if(orphelins.length) out.push({m:null,lib:'Sans groupe identifié',
    couleur:'var(--sub)',exercices:orphelins,musculaire:false});
  return out;
}
// LA FIGURINE. Le meme avatar que la seance de l'athlete, au dernier niveau, ne
// portant qu'UNE zone allumee : celle du groupe de la ligne. On ne redessine
// rien — woSrcAvatar et woHtmlZones sont deja la, et la vue se retourne toute
// seule pour un groupe dorsal. Sans muscle resolu, pas de figurine : une
// silhouette entierement eteinte ne dirait rien.
function _plxFigurine(m,c){
  if(!m) return '';
  try{
    const g=woGenreAvatar(c), vue=woVueAvatar([m]);
    const src=woSrcAvatar(WO_AVA_NIV,g,vue);
    const zones=woHtmlZones([m],src,vue,WO_AVA_NIV,g);
    if(!zones) return '';
    return '<span class="plx-ava"><img alt="" aria-hidden="true" src="'+src+'">'+zones+'</span>';
  }catch(e){ return ''; }
}
function renderPlateauxCoach(c){
  const z=document.getElementById('ccd-plateaux');
  if(!z) return;
  if(!c||!Array.isArray(c.sessions)||!c.sessions.length){ z.innerHTML=''; return; }
  let groupes=[];
  try{ groupes=plateauxParGroupe(c); }catch(e){ groupes=[]; }
  if(!groupes.length){ z.innerHTML=''; return; }
  const dat=(t)=>t?new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
  const nBlo=groupes.reduce((n,g)=>n+g.exercices.length,0);
  // Le compte sur le bouton blanc : ce qu'il reste a attribuer, dit d'avance.
  let nSans=0; try{ nSans=exosProgrammeSansMuscle(c).length; }catch(e){ nSans=0; }
  const nMus=groupes.filter(g=>g.musculaire).length;
  const ligne=(x)=>`<div class="plx-ex">
      <div class="plx-ex-h">
        <span class="plx-ex-n">${escapeHtml(x.nom)}</span>
        <span class="plx-ex-e" style="color:${PERF_ETAT_COULEUR[x.etat]}">${x.cause==='tension'?'progression apparente':PERF_ETAT_LIB[x.etat]}${_fragmentSiValeur(' · record du ',dat(x.dateRecord))}</span>
      </div>
      ${x.cause==='tension'?`<div class="plx-ex-t">${escapeHtml(phraseTensionEnBaisse(x.nom))}</div>`:''}
    </div>`;
  // LE PREMIER GROUPE EST OUVERT, les autres fermes. Une carte entierement
  // repliee demande un geste pour ne rien apprendre ; tout ouvrir redonnerait
  // le rouleau qu'on vient de retirer.
  z.innerHTML=`<div class="plx-carte">
    <div class="plx-tete">
      <span>Ce qui bloque</span>
      <span class="plx-tete-n">${nBlo} exercice${nBlo>1?'s':''}${nMus?' · '+nMus+' groupe'+(nMus>1?'s':'')+' en plateau':''}</span>
    </div>
    <div class="plx-grille">
    ${groupes.map((g,i)=>`<details class="plx-g"${i===0?' open':''}${g.musculaire?' data-mus':''}>
      <summary class="plx-s">
        ${_plxFigurine(g.m,c)}
        <span class="plx-s-txt">
          <span class="plx-s-nom" style="color:${g.couleur}">${escapeHtml(g.lib)}</span>
          <span class="plx-s-sub">${g.exercices.length} exercice${g.exercices.length>1?'s':''} bloqué${g.exercices.length>1?'s':''}${g.musculaire?' · plateau musculaire':''}</span>
        </span>
        <span class="plx-fl" aria-hidden="true">›</span>
      </summary>
      <div class="plx-c">${g.exercices.map(ligne).join('')}</div>
    </details>`).join('')}
    <div class="plx-actions">
      <button type="button" class="btn btn-red" onclick="openCoachSessions()">Modifier le programme</button>
      <button type="button" class="btn btn-blanc" onclick="coachAttribuerMuscles()">Attribuer les muscles${nSans?' · '+nSans:''}</button>
    </div>
    </div>
    ${PERF_ENCADRE}
  </div>`;
}
// ── ATTRIBUER LES MUSCLES DU PROGRAMME, DEPUIS LA FICHE COACH ─────────────
// Kevin, 21/09/2026 : « un bouton blanc pour attribuer des muscles aux exos
// sans attribution de groupe musculaire du programme ».
//
// PURE. Les exercices du PROGRAMME (creneaux actifs) dont aucun muscle n'est
// connu — ni guide, ni regle, ni attribution anterieure. Un exercice sans
// muscle ne compte nulle part : ni dans le volume, ni dans les plateaux par
// groupe, ou il finit sous « Sans groupe identifie ».
// ⚠ LE CARDIO N'EST PAS « SANS MUSCLE » : resoudreMusclesLecture rend
//   VOL_CARDIO, qui est vrai, et il est donc ecarte comme les autres.
function exosProgrammeSansMuscle(c){
  const u=_dossier(c);
  if(!u) return [];
  const cfg=_creneauxDe(u);
  const vus=new Map();
  for(const s of cfg){
    if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
    for(const ex of s.exercises){
      const nom=ex&&ex.name;
      const k=nom?exKey(nom):'';
      if(!k||vus.has(k)) continue;
      let cls=null; try{ cls=resoudreMusclesLecture(nom,ex,u); }catch(e){ cls=null; }
      if(cls) continue;
      vus.set(k,{nom,k});
    }
  }
  return [...vus.values()].sort((a,b)=>a.nom.localeCompare(b.nom));
}
let _coachExSansMuscle=[];
function coachAttribuerMuscles(){
  const c=getOwnedClient(currentClientId);
  if(!c) return false;
  _coachExSansMuscle=exosProgrammeSansMuscle(c);
  const n=_coachExSansMuscle.length;
  const corps=n
    ?_coachExSansMuscle.map((a,i)=>`<div style="display:flex;align-items:center;gap:10px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;margin-bottom:8px">
        <span style="flex:1;min-width:0;font-weight:800;font-size:var(--fs-sm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(a.nom)}</span>
        <button class="btn btn-outline btn-sm" style="width:auto;flex:0 0 auto;margin:0" onclick="_coachClasserMuscles(${i})">Attribuer</button>
      </div>`).join('')
    :emptyState('check','Tous les exercices du programme ont leurs muscles.',null,null,'padding:24px 0');
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
    <div onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:82vh;display:flex;flex-direction:column">
      <h2 style="margin-bottom:2px;font-size:var(--fs-lg)">Attribuer les muscles</h2>
      <p class="sub" style="font-size:var(--fs-xs);margin-bottom:12px;line-height:1.5">${n
        ?n+' exercice'+(n>1?'s':'')+' du programme sans groupe musculaire : il'+(n>1?'s ne comptent':' ne compte')+' ni dans le volume, ni dans ce qui bloque.'
        :'Rien à attribuer.'}</p>
      <div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch">${corps}</div>
      <button class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Fermer</button>
    </div></div>`;
  const old=document.getElementById('modal-overlay'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',html);
  return true;
}
// LE SELECTEUR DE LA SEANCE, TEL QUEL — deux colonnes, primaire et
// secondaire — mais il ECRIT DANS LE DOSSIER DE L'ATHLETE et l'envoie : sans
// ce detour, _validerSelecteurMuscles aurait classe l'exercice dans le dossier
// du COACH, qui ne s'en sert pas.
function _coachClasserMuscles(i){
  const a=_coachExSansMuscle[i];
  if(!a) return false;
  _selMusclesIdx=null; _selMusclesP=[]; _selMusclesS=[];
  _selMusclesTitre=escapeHtml(a.nom);
  _selMusclesEcrire=(r)=>{
    const users=DB.get('users')||{};
    const cc=getOwnedClient(currentClientId,users);
    if(!cc||!cc.email){ closeModal(); return; }
    if(!cc.exMuscles||typeof cc.exMuscles!=='object') cc.exMuscles={};
    // LA CLEF QUE LIT resoudreMusclesLecture : le nom, passe par les alias de
    // l'athlete. Une autre clef serait une attribution que personne ne lit.
    cc.exMuscles[_aliasPour(exKey(a.nom),cc)]=r;
    cc.updatedAt=Date.now(); users[cc.email]=cc;
    const ok=DB.set('users',users);
    toastSync(ok,CLOUD.pushOne(cc.email,cc),'Muscles attribués '+ICO.coche,'l’attribution est');
    try{ _viderCacheVolume(); }catch(e){}
    closeModal();
    try{ renderPlateauxCoach(cc); }catch(e){}
    try{ renderVolumeCoach(cc); }catch(e){}
    coachAttribuerMuscles();
  };
  _rendreSelecteurMuscles(_selMusclesTitre);
  return true;
}
// ══════════════ TROIS CHIFFRES D'ENTRAÎNEMENT ══════════════
// L'accueil mettait en avant le nombre total de séances, les semaines de suite
// et le poids. Deux comptent des présences, aucun ne parle d'entraînement. On
// les remplace par trois chiffres calculés sur des données DÉJÀ collectées :
// rien de nouveau n'est demandé à l'athlète.
//
// « Total » et « Semaines » ne disparaissent pas du produit : ils restent dans
// l'onglet Perfs, où on va les chercher quand on les veut.
const ACC_JOURS_PROGRES=28;

// Quota de séances de la semaine. L'ENGAGEMENT pris dans l'objectif prime sur
// le nombre de créneaux du programme : c'est le chiffre que l'athlète a choisi
// lui-même, et c'est celui que la carte d'objectif affichait déjà.
// Séances faites depuis lundi. Vivait dans le bloc objectif, qui a été retiré,
// alors qu'elle sert à la case « Cette semaine » de l'accueil.
function _seancesCetteSemaine(u){
  const lundi=_lundiDe(new Date()).getTime();
  return ((u&&u.sessions)||[]).filter(s=>s&&s.date>=lundi).length;
}
function _quotaSemaine(u){
  // Le quota venait de l'engagement de l'objectif quand il existait, avec
  // repli sur les créneaux du programme. L'objectif a été retiré du produit :
  // il ne reste que les créneaux.
  return seancesPrevuesParSemaine(u);
}
// Charge de la semaine contre la moyenne des quatre précédentes.
// FENÊTRES GLISSANTES de sept jours, et non semaines calendaires : la semaine
// en cours est partielle un mardi, et la comparer à des semaines pleines
// annoncerait une chute de charge tous les lundis.
function _chargeHebdo(u){
  const ss=((u&&u.sessions)||[]).filter(s=>s&&s.date);
  if(!ss.length) return null;
  const now=Date.now(), SEM=7*864e5;
  // Il faut cinq semaines d'historique : la courante plus quatre de référence.
  const plusVieille=Math.min.apply(null,ss.map(s=>s.date));
  if(now-plusVieille<5*SEM) return null;
  const somme=(a,b)=>ss.filter(s=>s.date>=a&&s.date<b)
    .reduce((n,s)=>n+(Number(s.volume)||0),0);
  const volumeSemaine=somme(now-SEM,now+1);
  const moyenne4Semaines=somme(now-5*SEM,now-SEM)/4;
  // Moyenne nulle : aucun pourcentage n'a de sens, et surtout aucune division.
  const pct=moyenne4Semaines>0
    ? Math.round((volumeSemaine-moyenne4Semaines)/moyenne4Semaines*100) : null;
  return {volumeSemaine,moyenne4Semaines,pct};
}
// Exercices dont la charge maximale à RIR 0 progresse d'une fenêtre de 28
// jours à l'autre.
//
// LIMITE ASSUMÉE : la comparaison se fait sur le NOM en texte libre. Un
// exercice renommé sort du décompte sans avertissement. C'est la conséquence
// de l'absence d'entité exercice, et ce n'est pas réparable ici.
function _exercicesEnProgres(u){
  const ss=((u&&u.sessions)||[]).filter(s=>s&&s.date&&s.data);
  if(!ss.length) return null;
  const now=Date.now(), J=ACC_JOURS_PROGRES*864e5;
  const maxRir0=(a,b)=>{
    const m={};
    for(const s of ss){
      if(!(s.date>=a&&s.date<b)) continue;
      for(const nom of Object.keys(s.data)){
        for(const x of (((s.data[nom]||{}).sets)||[])){
          if(!x||!x.done) continue;
          if(!(x.rir==='0'||x.rir===0)) continue;
          const w=parseFloat(x.weight||0);
          if(w>0) m[nom]=Math.max(m[nom]||0,w);
        }
      }
    }
    return m;
  };
  const recent=maxRir0(now-J,now+1), ancien=maxRir0(now-2*J,now-J);
  let enProgres=0,total=0;
  for(const nom in recent){
    // Présent sur une seule des deux fenêtres : rien à comparer. Il ne compte
    // ni au numérateur ni au dénominateur — l'annoncer « pas en progrès »
    // serait un jugement qu'on n'a pas les moyens de porter.
    if(ancien[nom]==null) continue;
    total++;
    if(recent[nom]>ancien[nom]) enProgres++;
  }
  // Aucun couple comparable : on rend null, pas « 0 sur 0 ».
  if(!total) return null;
  return {enProgres,total};
}
// ── Les deux phrases, pour la fiche coach ET pour le rapport ─────────────
//
// PURES. Elles rendent '' — donc RIEN à afficher — quand la fonction qu'elles
// habillent rend null. C'est le contrat documenté sur les deux : moins de cinq
// semaines d’historique, ou aucun couple d’exercices comparable. Un « 0 » ou un
// « — » se lirait comme un constat, alors que c’est une absence de mesure.
//
// UNE SEULE FORMULATION POUR LES DEUX SURFACES : la fiche et le rapport disent
// mot pour mot la même chose, et il n’y a qu’un endroit où la corriger.
function phraseChargeHebdo(u){
  let c=null; try{ c=_chargeHebdo(u); }catch(e){ c=null; }
  // `pct` peut être null alors que l’objet existe : moyenne de référence à
  // zéro, aucun pourcentage n’a alors de sens. Même réponse — on se tait.
  if(!c||c.pct==null) return '';
  const l=lectureChargeHebdo(c.pct);
  return 'Charge de la semaine : '+(c.pct>0?'+':'')+c.pct
    +' % sur la moyenne des 4 précédentes'
    +(l==='pic'?', pic de charge : au-delà d’un tiers d’écart, le risque de blessure augmente.'
     :l==='creux'?', creux : décharge voulue, ou semaine manquée ?':'');
}
function phraseExercicesEnProgres(u){
  let p=null; try{ p=_exercicesEnProgres(u); }catch(e){ p=null; }
  if(!p) return '';
  // « 0 exercice sur 8 » est une réponse, pas un trou : il y a des couples
  // comparables, et aucun n’a progressé. C’est le cas où total vaut 0 qui rend
  // null, et il est déjà écarté au-dessus.
  return 'Progression : '+p.enProgres+' exercice'+(p.enProgres>1?'s':'')
    +' sur '+p.total+' en hausse sur '+ACC_JOURS_PROGRES+' jours';
}
// Les deux lignes de la fiche coach, ou rien du tout.
function renderTendancesCoach(c){
  const z=document.getElementById('ccd-tendances');
  if(!z) return;
  let l=[];
  try{ l=[phraseChargeHebdo(c),phraseExercicesEnProgres(c)].filter(Boolean); }catch(e){ l=[]; }
  // LES PROJECTIONS (build 1830) : une carte par exercice principal, ou rien.
  let proj=''; try{ proj=htmlProjectionsCoach(c,Date.now()); }catch(e){ proj=''; }
  z.innerHTML=(l.length
    ?`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:10px 14px;margin-bottom:8px">`
      +l.map(x=>`<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.7">${escapeHtml(x)}</div>`).join('')
      +`</div>`
    :'')+proj;
  z.style.display=(l.length||proj)?'':'none';
}
// Message de fin de séance. Il dit ce qui vient de se passer, pas une formule
// de politesse identique pour tout le monde.
function _messageFinSeance(sets,setsPlanned,duration,records,delta,jour,incomplete){
  const n=Number(sets)||0, p=Number(setsPlanned)||0, m=Number(duration)||0;
  if(incomplete) return 'Séance écourtée : '+n+' séries sur '+p+' enregistrées. C\'est compté.';
  // « 10 séries sur 8 » se lit comme une erreur. Depuis que l'athlète peut
  // ajouter des séries, le dépassement existe et mérite d'être dit dans ce
  // sens-là. En dessous ou à égalité, la phrase ne change pas.
  const tete=(p>0&&n>p)?(n+' séries pour '+p+' prévues, '+m+' min. ')
    :(n+' séries sur '+p+', '+m+' min. ');
  if(records&&records.length){
    const b=records.slice().sort((a,x)=>x.gain-a.gain)[0];
    const _pm=_uniteTxt(b.nm), _c=String(_kgAff(b.curMax));
    return tete+'Record : '+b.nm+(b.type==='reps'?', '+b.reps+' répétitions à '+_c+_pm+'.':b.assiste?', assistance ramenée à '+_c+' '+_unite()+'.':' à '+_c+_pm+'.');
  }
  if(Number(delta)>0) return tete+'+'+Math.round(delta)+' kg de volume sur ta séance du '+(jour||'dernière fois')+'.';
  if(p>0&&n===p) return tete+'Séance complète.';
  return tete+'C\'est enregistré.';
}
// Peuplement des trois cases de l'accueil. Chaque case dit ce qui lui manque
// plutôt que d'afficher un chiffre qu'elle ne peut pas calculer : un « 0 »
// sans historique se lit comme un échec, un « — » se lit comme une attente.
// TAUX DE RESPECT DE LA DIETE. Deux regimes de preuve, un seul chiffre.
//
//   DIETE STRICTE : l athlete repond oui ou non chaque jour. Le taux est
//   la part de « oui » parmi les jours REPONDUS.
//   DIETE FLEXIBLE : un jour est respecte quand les trois macros tombent
//   dans une tolerance de 5 % autour de la cible. Un ecart de cinq pour
//   cent sur des grammes peses a la louche n est pas un ecart.
//
// LES JOURS NON ENREGISTRES NE COMPTENT PAS, ni au numerateur ni au
// denominateur. Les compter comme des echecs punirait l athlete pour un
// oubli de saisie et non pour un ecart alimentaire — c est la difference
// entre mesurer une diete et mesurer une assiduite de saisie.
// LA TOLÉRANCE, ET CE QU’ELLE MESURE.
//
// ±5 % sur les TROIS macros simultanément était inatteignable : sur des
// grammes pesés à la louche, toucher protéines, glucides ET lipides à cinq
// près le même jour relève du hasard. La case affichait 0 % à des athlètes
// qui suivaient leur plan — et une mesure qui rend toujours zéro ne mesure
// rien, elle décourage.
//
// LA MESURE PORTE DÉSORMAIS SUR L'ÉNERGIE ET LES PROTÉINES, à ±10 %.
//
// Ce n’est pas un assouplissement de confort : c’est la définition de la
// diète FLEXIBLE. Ce qui gouverne la composition corporelle est le total
// énergétique ; ce qui protège la masse maigre est l’apport protéique. Le
// partage entre glucides et lipides, À ÉNERGIE ÉGALE, appartient à
// l’athlète — c’est exactement ce qu’on lui laisse choisir.
//
// Et l'échange n'est PAS libre pour autant : l'énergie étant vérifiée, on ne
// peut pas troquer des glucides contre des lipides sans que le total bouge.
// La règle autorise un arbitrage, pas un dépassement.
//
// L’AUTRE OPTION — les trois macros à ±10 % avec au plus une hors
// fourchette — a été écartée : « au plus une macro dehors » ne correspond à
// rien de nutritionnel, et laisserait passer un jour à protéines et glucides
// justes avec quarante pour cent de lipides en trop.
const DIETE_TOLERANCE=0.10;
// ══ LA FENETRE DE LA DIETE ════════════════════════════════════════════════
//
// TRENTE JOURS, ET UNE FENETRE PLUTOT QU'UN CUMUL A VIE.
//
// ⚠ POURQUOI UNE FENETRE : UN CUMUL A VIE NE BOUGE PLUS, DONC NE MOTIVE PLUS.
// Le taux se calculait sur TOUTE l'histoire du dossier. A trois cents jours
// notes, une semaine parfaite le fait gagner un demi-point, et une semaine
// ratee lui en coute autant : le chiffre se fige, et il se fige d'autant plus
// que l'athlete est assidu depuis longtemps — c'est-a-dire exactement chez
// ceux qu'on voudrait garder. Pire, il ne pardonne jamais : un mois difficile
// en janvier pese encore en decembre, et personne ne peut plus le rattraper.
// Un indicateur qu'aucun effort ne deplace cesse d'etre lu.
//
// Une fenetre glissante rend au chiffre sa seule qualite utile : REPONDRE.
// Une bonne semaine se voit, un relachement se voit, et ce qui est corrige
// finit par sortir du cadre.
//
// TRENTE ET NON SEPT. Sept jours font basculer le taux de quinze points pour
// un repas de famille, et un indicateur qui saute a chaque ecart se lit comme
// du bruit. Trente laisse la place a un week-end sans effacer une derive.
const DIETE_FENETRE_JOURS=30;
// La moitie, pour la tendance : quinze contre quinze DANS la meme fenetre.
// Le sous-titre ne doit pas parler d'un mois que le chiffre au-dessus de lui
// ignore — ce serait deux mesures dans la meme phrase.
const DIETE_DEMI_JOURS=15;
// ⚠ QUATRE JOURS JUGEABLES AU MINIMUM DE CHAQUE COTE. Une tendance calculee
// sur deux jours n'est pas une tendance : un seul repas la fait passer de
// « en hausse » a « en baisse ». En dessous, on ne dit rien — meme honnetete
// que « RIR non note » et « Premiere seance ».
const DIETE_TENDANCE_MIN=4;
// CINQ POINTS. En dessous, l'ecart tient dans le bruit de deux jours notes
// differemment, et annoncer « en hausse » pour trois points ferait osciller le
// libelle d'un jour a l'autre sans que rien n'ait change chez l'athlete.
const DIETE_TENDANCE_SEUIL=5;
// PURE. L'énergie d'un jeu de macros. `kcal` quand il est là — c'est ce que
// les cibles portent — et sinon la reconstitution 4/4/9, pour qu'un dossier
// ancien reste jugeable au lieu d'être écarté en silence.
function _dieteKcal(o){
  const k=Number((o||{}).kcal);
  if(k>0) return k;
  const pr=Number((o||{}).p)||0, gl=Number((o||{}).g!=null?o.g:(o||{}).c)||0, li=Number((o||{}).l)||0;
  const somme=kcalDesMacros(pr,gl,li);
  return somme>0?somme:0;
}
// PURE. Ce que la case annonce sous son pourcentage. Il ne suffisait pas de
// compter les jours : rien ne disait sur QUOI le jugement portait, et deux
// athlètes pouvaient lire le même 60 % pour deux règles différentes selon
// leur type de diète.
//
// Le seuil est DÉRIVÉ de la constante : un pourcentage écrit à la main ici
// finirait par annoncer autre chose que ce que le code applique.
function _sousTitreDiete(di){
  if(!di) return 'Aucun jour renseigné.';
  const n=di.tenus+'/'+di.juges;
  // LA FENETRE SE DIT. Sans elle, « 12/18 » se lisait comme un total de vie,
  // et le chiffre paraissait s'effondrer le jour ou la fenetre a ete posee.
  // `di.jours` plutot que la constante : ce que le sous-titre annonce est ce
  // sur quoi le taux a REELLEMENT porte, pas ce que la constante vaut au
  // moment du rendu.
  const fen=' sur '+(di.jours||DIETE_FENETRE_JOURS)+' jours';
  const regle=di.flexible
    ? ' · kcal et protéines à ±'+Math.round(DIETE_TOLERANCE*100)+' %'
    : ' · jours déclarés';
  // LE SENS NE S'AJOUTE QU'AU-DELA DU SEUIL, et jamais « stable » en dessous :
  // dire « stable » pour trois points d'ecart affirme une chose qu'on n'a pas
  // mesuree. On se tait, ce qui est la seule maniere honnete de ne rien dire.
  const t=di.tendance;
  const sens=(typeof t==='number'&&Math.abs(t)>DIETE_TENDANCE_SEUIL)
    ? (t>0?' · en hausse':' · en baisse') : '';
  return n+fen+regle+sens;
}
// PURE. UN SEUL JOUR : tenu, pas tenu, ou pas jugeable.
//
// ⚠ EXTRAITE DE _tauxDieteRespectee LE 08/09/2026, sans changer une virgule de
// la regle. Le calendrier du journal colore ses cases avec ce meme verdict :
// recopier la regle aurait fabrique deux jugements qui derivent, et un
// camembert qui contredit les cases qu'il resume.
//
// `null` N'EST PAS `false`. Un jour sans saisie, ou un jour sans cible a quoi
// se comparer, n'est pas un jour rate — c'est un jour dont on ne sait rien, et
// le compter ferait tomber le pourcentage de quelqu'un qui n'a rien fait de
// mal.
function jourDieteTenu(u,dateISO){
  const nut=(u&&u.nutrition)||{};
  const flexible=(typeof typeDiete==='function')?typeDiete(nut)==='flexible':true;
  if(!flexible){
    // Le journal des reponses quotidiennes. `respected` vaut true, false, ou
    // n existe pas — et c est ce troisieme cas qu on ecarte.
    const r=((nut.days||{})[dateISO]||{}).respected;
    return r===true?true:(r===false?false:null);
  }
  const entrees=(((nut.log||{})[dateISO])||{}).entries||[];
  if(!entrees.length) return null;          // jour non enregistre
  const m=(typeof _getEffectiveMacros==='function')
    // Le porteur `u`, reçu en paramètre : ce taux se calcule aussi sur un
    // dossier qui n’est pas celui de l’utilisateur courant.
    ?_getEffectiveMacros(nut,(typeof nutIsOnDay==='function')?nutIsOnDay(dateISO,u):true,dateISO,u)
    :{};
  // L'ÉNERGIE ET LES PROTÉINES. Glucides et lipides ne sont plus jugés
  // séparément : leur partage à énergie égale appartient à l'athlète.
  const cibleKcal=_dieteKcal(m), cibleProt=Number(m.p)||0;
  if(!(cibleKcal>0&&cibleProt>0)) return null;   // sans cible, rien a juger
  const t=entrees.reduce((a,e)=>({p:a.p+(e.p||0),c:a.c+(e.c||0),l:a.l+(e.l||0),
    kcal:a.kcal+(Number(e.kcal)||0)}),{p:0,c:0,l:0,kcal:0});
  // L'énergie consommée : la somme des kcal du journal, ou sa reconstitution
  // quand des aliments n'en portent pas.
  const mangeKcal=t.kcal>0?t.kcal:_dieteKcal(t);
  const dans=(v,c)=>Math.abs(v-c)<=c*DIETE_TOLERANCE;
  return dans(mangeKcal,cibleKcal)&&dans(t.p,cibleProt);
}
// PURE. La clef de jour a `decalage` jours d'un instant donne — negatif vers
// le passe.
//
// ⚠ ON BORNE EN CLEFS, PAS EN MILLISECONDES, et ce n'est pas un detail de
// style. Les clefs sont des dates LOCALES posees par localISODate ; borner par
// `maintenant - 29*864e5` place la limite a l'HEURE QU'IL EST il y a vingt-neuf
// jours, alors que la clef de ce jour-la vaut minuit. A dix heures du matin,
// « J-29 » tombait donc dix heures avant la borne, et le jour le plus ancien de
// la fenetre disparaissait — un jour sur trente, tous les jours, sans que rien
// ne le dise. Le passage a l'heure d'ete en ajoutait un second. La comparaison
// de chaines est exacte, et YYYY-MM-DD se compare dans l'ordre chronologique.
function _cleJourDecalee(t,decalage){
  const d=new Date((typeof t==='number')?t:Date.now());
  d.setDate(d.getDate()+(Number(decalage)||0));
  return localISODate(d);
}
// PURE. {tenus, juges} sur un intervalle de CLEFS, BORNES COMPRISES.
//
// ⚠ LA SEULE BOUCLE DE COMPTAGE DU FICHIER. Le taux, la tendance et la fenetre
// glissante l'appellent tous les trois : trois boucles recopiees auraient fini
// par compter trois choses legerement differentes, et le sous-titre aurait
// contredit le pourcentage juste au-dessus de lui.
//
// ELLE PASSE PAR jourDieteTenu. Lire `respected` directement n'aurait marche
// qu'en diete stricte : en flexible, le verdict se lit dans le journal
// alimentaire contre les cibles du jour.
function _dieteComptes(u,cleBasse,cleHaute){
  const nut=(u&&u.nutrition)||{};
  const flexible=(typeof typeDiete==='function')?typeDiete(nut)==='flexible':true;
  // Les clefs a examiner ne sont pas les memes des deux cotes : les reponses
  // quotidiennes en stricte, le journal alimentaire en flexible.
  const cles=Object.keys((flexible?nut.log:nut.days)||{});
  let tenus=0,juges=0;
  for(const k of cles){
    if(cleBasse&&k<cleBasse) continue;
    if(cleHaute&&k>cleHaute) continue;
    const v=jourDieteTenu(u,k);
    if(v===null) continue;            // jour non repondu : il ne compte pas
    juges++; if(v) tenus++;
  }
  return {tenus:tenus,juges:juges,flexible:flexible};
}
// PURE. Le taux de diete sur les DIETE_FENETRE_JOURS derniers jours, jours
// jugeables seulement, plus la tendance a l'interieur de cette meme fenetre.
//
// `maintenant` est FACULTATIF et sert aux tests : une fenetre glissante ne se
// verifie pas sans pouvoir dire quand on se place.
// ══ LA SERIE DE JOURS CONSECUTIFS ═════════════════════════════════════════
//
// ⚠ ELLE ETAIT LA SEULE EXCEPTION DU FICHIER A LA REGLE DE jourDieteTenu, et
// c'est ce lot qui l'y aligne. Cette regle est ecrite juste au-dessus, en
// toutes lettres :
//
//   « `null` N'EST PAS `false`. Un jour sans saisie, ou un jour sans cible a
//     quoi se comparer, n'est pas un jour rate — c'est un jour dont on ne sait
//     rien, et le compter ferait tomber le pourcentage de quelqu'un qui n'a
//     rien fait de mal. »
//
// Le taux la suit, le camembert la suit, les sept pastilles de l'accueil la
// suivent depuis le 16/09/2026, le calendrier du journal la suit. La serie,
// elle, cassait sur un jour non renseigne : sa boucle lisait
// `else if(i>0) break`, c'est-a-dire « tout trou autre qu'aujourd'hui arrete
// tout ». Quarante jours de diete tenue disparaissaient parce qu'on avait
// oublie de repondre un samedi — et l'athlete n'avait AUCUN moyen de le
// rattraper, puisque le compteur ne dit pas pourquoi il est retombe a zero.
//
// TROIS ETATS, TROIS TRAITEMENTS :
//   true  → la serie continue et s'incremente.
//   false → la serie s'arrete. C'est un ECART DECLARE : l'athlete a repondu,
//           il a dit non, et lui laisser sa serie effacerait sa reponse.
//   rien  → NEUTRE. La serie traverse, sans s'incrementer : on ne recompense
//           pas un jour dont on ne sait rien, et on ne le punit pas non plus.
//
// ⚠ LA TRAVERSEE EST PLAFONNEE A DEUX JOURS CONSECUTIFS. Au-dela, ce n'est
// plus un oubli, c'est un arret : quelqu'un qui n'a pas ouvert l'application
// depuis une semaine n'a pas « tenu sa diete » pendant cette semaine, et lui
// afficher une serie intacte serait un compliment invente. La serie repart
// alors de zero.
const SERIE_TROU_MAX=2;
// Le pas de recul maximal. UN PLAFOND, PAS UNE REGLE : il etait deja de
// soixante avant ce lot, et une serie plus longue est ecretee. On le nomme
// pour que ce soit visible, faute de pouvoir l'enlever sans parcourir le
// dossier entier a chaque rendu.
const SERIE_DIETE_MAX_JOURS=60;
// PURE. {jours, traverses} — la longueur de la serie, et le nombre de jours
// non renseignes qu'elle a effectivement ENJAMBES.
//
// ⚠ UN TROU N'EST « TRAVERSE » QUE S'IL Y A QUELQUE CHOSE DE L'AUTRE COTE.
// Les jours neutres sont mis en attente et ne sont comptes qu'a la rencontre
// du `true` suivant. Sans cela, une serie qui se termine sur deux jours vides
// aurait annonce « 2 jours non renseignes, ta serie tient » alors qu'elle
// n'enjambe rien du tout — le message aurait felicite un vide.
function serieDieteJours(u,maintenant){
  const jrs=((u&&u.nutrition)||{}).days||{};
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  let jours=0, traverses=0, attente=0;
  for(let i=0;i<SERIE_DIETE_MAX_JOURS;i++){
    const r=(jrs[_cleJourDecalee(t,-i)]||{}).respected;
    if(r===true){ jours++; traverses+=attente; attente=0; }
    else if(r===false) break;                 // ecart declare : la serie s'arrete
    else { attente++; if(attente>SERIE_TROU_MAX) break; }
  }
  return {jours:jours,traverses:traverses};
}
function _tauxDieteRespectee(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const haut=_cleJourDecalee(t,0);
  const bas=_cleJourDecalee(t,-(DIETE_FENETRE_JOURS-1));
  const g=_dieteComptes(u,bas,haut);
  if(!g.juges) return null;
  // LA TENDANCE : quinze jours contre quinze, DANS la fenetre de trente.
  // Les deux moities se touchent sans se recouvrir — [J-14 … J] et
  // [J-29 … J-15] — et leur reunion est exactement la fenetre du taux.
  const recent=_dieteComptes(u,_cleJourDecalee(t,-(DIETE_DEMI_JOURS-1)),haut);
  const avant=_dieteComptes(u,bas,_cleJourDecalee(t,-DIETE_DEMI_JOURS));
  // ⚠ UNE MOITIE TROP MAIGRE NE REND PAS ZERO, ELLE REND null. Zero se lirait
  // comme « stable », c'est-a-dire comme une mesure — alors qu'on n'a pas
  // mesure. Et `tendance` est lue par un `typeof … === 'number'` : un null y
  // est un silence, pas une valeur basse.
  const tendance=(recent.juges>=DIETE_TENDANCE_MIN&&avant.juges>=DIETE_TENDANCE_MIN)
    ?Math.round(recent.tenus*100/recent.juges)-Math.round(avant.tenus*100/avant.juges)
    :null;
  return {pct:Math.round(g.tenus*100/g.juges), tenus:g.tenus, juges:g.juges,
    flexible:g.flexible, jours:DIETE_FENETRE_JOURS, tendance:tendance};
}
// PURE. Le taux sur une fenetre de dates donnee en HORODATAGES, pour les
// appelants qui raisonnent en instants. Elle delegue le comptage : le jour du
// bord est pris ENTIER, ce qui corrige au passage le decalage decrit plus haut.
function _dieteFenetre(u,debut,fin){
  const g=_dieteComptes(u,_cleJourDecalee(debut,0),_cleJourDecalee(fin,0));
  return g.juges?{pct:Math.round(g.tenus*100/g.juges),juges:g.juges}:null;
}
// ══ LA RELANCE ALIMENTAIRE DE L'ACCUEIL ═══════════════════════════════════
//
// TROIS JOURS, ET PAS UN DE MOINS. Un week-end sans rien noter est une vie
// normale, pas un decrochage : relancer au deuxieme jour ferait de cette ligne
// un bruit de fond qu'on apprend a ne plus voir, et le jour ou elle dirait
// quelque chose personne ne la lirait. Au-dela de trois, le silence n'est plus
// un week-end.
const NUTRI_SILENCE_JOURS=3;
// PURE. Le nombre de jours REVOLUS entre une clef de jour et aujourd'hui.
//
// ⚠ MIDI UTC DES DEUX COTES, ET NON MINUIT LOCAL. Deux dates locales converties
// en millisecondes sont separees de 23 ou 25 heures quand un changement d'heure
// tombe entre elles : la division rendait alors un jour de trop, ou un de moins,
// deux fois par an. A midi, aucun decalage saisonnier ne peut faire changer de
// jour — la marge est de douze heures des deux cotes.
function _joursDepuisCle(cle,maintenant){
  const a=Date.parse(String(cle||'')+'T12:00:00Z');
  if(!isFinite(a)) return null;
  const b=Date.parse(_cleJourDecalee(maintenant,0)+'T12:00:00Z');
  if(!isFinite(b)) return null;
  return Math.round((b-a)/864e5);
}
// PURE. La derniere trace alimentaire : la clef la plus recente qui porte
// VRAIMENT quelque chose. Rend '' quand l'athlete n'a jamais rien saisi.
//
// ⚠ UNE CLEF N'EST PAS UNE TRACE. nutrition.log et nutrition.days portent des
// entrees vides — un jour ouvert puis referme sans rien inscrire, une note sans
// reponse. Compter la clef aurait fait dire « 0 jour sans suivi » a quelqu'un
// qui n'a rien note depuis trois semaines, et la relance ne serait jamais
// partie. On exige donc le CONTENU : un aliment en flexible, une reponse en
// stricte.
//
// Les clefs sont des dates locales au format YYYY-MM-DD : elles se comparent
// dans l'ordre chronologique, sans conversion.
function derniereTraceAlimentaire(u){
  const nut=(u&&u.nutrition)||{};
  const flexible=(typeof typeDiete==='function')?typeDiete(nut)==='flexible':true;
  const src=(flexible?nut.log:nut.days)||{};
  let max='';
  for(const k of Object.keys(src)){
    const v=src[k]||{};
    const porte=flexible
      ?!!(v.entries&&v.entries.length)
      :(v.respected===true||v.respected===false);
    if(porte&&k>max) max=k;
  }
  return max;
}
// PURE. L'entree de relance alimentaire de l'accueil, ou null.
//
// ⚠ CE MESSAGE NE PORTE NI CALORIE NI POIDS, ET C'EST LE GARDE-FOU DU MODULE.
// Tout ce fichier refuse d'afficher un chiffre d'energie ou de masse la ou il
// n'est pas demande : mode neutre, refus de deficit, signal micro coupe,
// vitesse masquee. Une notification d'accueil est lue par tout le monde, tous
// les jours, sans l'avoir demandee — c'est le pire endroit du produit pour un
// chiffre de calories. Elle dit un NOMBRE DE JOURS et une invitation, rien
// d'autre.
//
// ⚠ ET ELLE NE PART PAS SUR UN ANTECEDENT DECLARE. aTCA coupe deja onze chemins
// ailleurs, tous de la meme famille : proposer de manger moins, pousser a se
// peser, conseiller sur l'assiette. Relancer quelqu'un pour qu'il RECOMMENCE A
// NOTER CE QU'IL MANGE appartient a cette famille-la — la tenue d'un journal
// alimentaire est precisement ce qu'on n'incite pas chez quelqu'un qui a
// declare un trouble du comportement alimentaire. Ce n'etait pas dans la
// demande ; c'est la doctrine du module, et elle ne souffre pas d'exception
// selon l'ecran.
function notifNutrition(u,maintenant){
  const uu=u||{};
  try{ if(aTCA(uu)) return null; }catch(e){}
  const nut=uu.nutrition||{};
  // AUCUNE CIBLE, AUCUNE RELANCE. Sans objectifs, « suivre » ne veut rien dire :
  // il n'y a rien a quoi se comparer, et l'ecran vers lequel on renvoie ne
  // montrerait que trois anneaux vides. Meme lecture que renderNutriAnneaux,
  // qui s'efface pour la meme raison.
  let m={};
  try{
    const auj=_cleJourDecalee(maintenant,0);
    let isOn=true; try{ isOn=nutIsOnDay(auj,uu); }catch(e){}
    m=_getEffectiveMacros(nut,isOn,auj,uu)||{};
  }catch(e){ m={}; }
  if(!m.p&&!m.g&&!m.l) return null;
  // JAMAIS RIEN SAISI : ON NE RELANCE PAS SUR DU VIDE. « Reprends la ou tu en
  // etais » n'a aucun sens pour quelqu'un qui n'a jamais commence — et
  // l'accueil porte deja, pour lui, l'invitation a lancer sa premiere seance.
  const cle=derniereTraceAlimentaire(uu);
  if(!cle) return null;
  const j=_joursDepuisCle(cle,maintenant);
  if(j===null||j<=NUTRI_SILENCE_JOURS) return null;
  return {icon:'',
    msg:j+' jours sans suivi alimentaire. Reprends là où tu en étais.',
    c:'var(--orange)',act:'loadNutrition()'};
}
// ⚠ CES TROIS FONCTIONS NE SONT PLUS AFFICHEES depuis le 16/09/2026. Les
// sous-titres des tuiles portaient une valeur calculee — la tendance de diete,
// le mois de la premiere seance — et portent desormais un qualificatif FIXE :
// « de la diète », « depuis le début ». Demande de Kevin.
// ELLES RESTENT, ET C'EST DELIBERE : ce sont des regles de calcul justes,
// eprouvees par leurs assertions, et la tendance est exactement le genre de
// chose qu'on veut remettre ailleurs — sur l'ecran Nutrition, par exemple.
// Les supprimer aurait coute le travail ET les verifications. Ne pas les
// rebrancher sans le dire : un sous-titre qui redevient calcule change ce que
// la tuile promet.
//
// LE SOUS-TITRE DE LA DIETE. Trente jours contre les trente precedents, sur
// les jours REPONDUS des deux cotes — compter les jours sans saisie comme des
// echecs mesurerait l'assiduite de saisie, pas la diete. Meme regle que le
// pourcentage au-dessus, et c'est voulu : les deux doivent se tenir.
//
// ⚠ RIEN N'EST INVENTE QUAND IL MANQUE UNE MOITIE. Moins de sept jours notes
// en tout, ou aucun jour repondu dans l'une des deux fenetres, et il n'y a
// pas de tendance : on dit alors ce qu'on sait — combien de jours — plutot
// que d'appeler « stable » un ecart qu'on n'a pas pu mesurer. C'est la meme
// honnetete que « RIR non note » et « Premiere seance ».
// ⚠ LES LIBELLES SONT COURTS PARCE QUE LA TUILE FAIT 78 px. Mesure au
// navigateur, a 320 px de large, police de l'ecran : « sur 12 jours notés »
// demande 94 px et « +25 pts vs mois dernier » 126 px. Les deux etaient
// tronques a TOUTES les largeurs de telephone — 85 px a 390, 91 a 360 — donc
// pour tout le monde et tout le temps. Un referentiel tronque n'est plus un
// referentiel ; on dit moins, mais en entier.
// « / 12 prévues » 64 px · « sept. 2026 » 56 px · « −100 pts » 45 px ·
// « 365 j notés » 59 px : tout tient, y compris les pires cas.
function _sousTitreTendanceDiete(u,di,maintenant){
  if(!di||!di.juges) return null;
  const n=di.juges, pl=n>1?'s':'';
  // « 365 jours notés » demande 83 px et deborderait ; la forme breve n'en
  // demande que 59. Elle n'apparait donc QUE la ou la longue ne tient pas.
  const compte={t:n<100?(n+' jour'+pl+' noté'+pl):(n+' j notés')};
  if(n<7) return compte;
  const t=(typeof maintenant==='number')?maintenant:Date.now(), J=864e5;
  const a=_dieteFenetre(u,t-29*J,t);
  const b=_dieteFenetre(u,t-59*J,t-30*J);
  if(!a||!b) return compte;
  const d=a.pct-b.pct;
  if(d===0) return {t:'stable'};
  // ⚠ LE SIGNE MOINS (U+2212), PAS LE TRAIT D'UNION : « −4 » se lit comme un
  // nombre negatif, « -4 » comme une puce de liste a cette taille.
  // Et le vert UNIQUEMENT vers le haut : une baisse se dit en gris.
  return {t:(d>0?'+':'−')+Math.abs(d)+' pts', vert:d>0};
}
// PURE. « sept. 2026 » — le mois ou tout a commence.
// ⚠ LE MOIS ABREGE, ET « DEPUIS » EN MOINS. « depuis septembre 2026 » demande
// 130 px dans une tuile qui en offre 78 : il s'affichait « depuis sept… » sur
// tous les telephones. Le libelle au-dessus dit deja « Séances au total » —
// une date en dessous d'un total ne peut se lire que comme un depart.
function _moisAnnee(ts){
  try{ const d=new Date(ts);
    if(!isFinite(d.getTime())) return '';
    return d.toLocaleDateString('fr-FR',{month:'short',year:'numeric'});
  }catch(e){ return ''; }
}
function _majMetriquesAccueil(u){
  // LA MONTEE EST CONDITIONNELLE, et la condition est le coeur du correctif :
  // l'accueil est quotidien, la regle de frequence interdit d'y rejouer une
  // animation a chaque retour dans la meme session. On lit l'ancien texte du
  // noeud avant de l'ecraser — aucun etat a conserver — et on ne compte que si
  // la valeur a change. Un premier affichage (texte initial « — », donc av non
  // fini) pose la valeur directement plutot que de compter depuis zero a
  // chaque lancement de l'application.
  const met=(id,val,sub,vert)=>{
    const a=document.getElementById(id), b=document.getElementById(id+'-sub');
    if(a){
      // LE QUATRIEME COMPTEUR, et il relisait lui aussi son propre texte. Il
      // fonctionnait — « 75 % » nettoye rend bien 75 — mais par la seule grace
      // de son suffixe : il est en FIN de chaine. Le score hebdomadaire, lui,
      // portait un « / » au MILIEU, et c'est ce qui l'a fait s'emballer
      // jusqu'a 7777777/7. La difference entre les deux tient a la position
      // d'un caractere, pas a un raisonnement — donc a rien.
      //
      // ON NE LAISSE PAS UN COMPTEUR JUSTE PAR CHANCE. Il passe par le meme
      // arcCompteur que les deux autres : la valeur precedente vient de
      // data-valeur, jamais du texte.
      //
      // LA VALEUR D'ARRIVEE, ELLE, se lit toujours dans `val` : c'est la
      // SOURCE, pas un affichage, et la nettoyer est legitime. « — » n'a pas de
      // valeur numerique et se pose tel quel, comme avant.
      // ⚠⚠ UNE VALEUR COMPOSEE NE S'ANIME PAS, ET CE PIEGE A DEJA COUTE.
      // Le nettoyage `[^\d.-]` rend « 56 » pour « 5/6 » : le compteur
      // s'emballait jusqu'a 7777777/7, et le commentaire ci-dessus raconte
      // comment. Depuis que la premiere tuile affiche « 5/6 » — le fait sur le
      // prevu — la porte est grande ouverte. On la ferme : ce qui porte un
      // separateur se POSE, il ne se compte pas.
      const _compose=/\//.test(String(val));
      const ap=_compose?NaN:parseFloat(String(val).replace(/[^\d.-]/g,''));
      const suf=/%/.test(String(val))?' %':'';
      if(isFinite(ap)) arcCompteur(a,ap,{duree:ARC.release,format:v=>Math.round(v)+suf});
      else { a.textContent=val; try{ delete a.dataset.valeur; }catch(e){} }
      // Le drapeau suit la VALEUR AFFICHEE, pas le calcul : « — » et « 0 » sont
      // les deux facons dont cette app dit « rien ». closest() remonte au
      // conteneur, qui porte le style.
      // « 0/3 » EST AUSSI UNE CASE VIDE : c'est la meme chose que « 0 », dite
      // avec son referentiel. Sans ce cas, la premiere tuile restait en pleine
      // lumiere pour annoncer qu'il ne s'etait rien passe.
      a.closest('.metric-box')?.toggleAttribute('data-vide',
        val==='—'||val==='-'||val==='0'||/^0\//.test(String(val)));
    }
    if(b&&sub!==undefined){
      b.textContent=sub||'';
      // ⚠ '' EFFACE LA DECLARATION EN LIGNE, elle ne restaure rien : c'est
      // pour cela que le gris de base vit dans .clh-m-sub. Sans quoi le
      // sous-titre serait reste sans couleur des le premier rendu non-vert.
      b.style.color=vert?'var(--green)':'';
    }
  };
  // ── LES TROIS REFERENTIELS ──────────────────────────────────────────
  // Les trois chiffres etaient donnes SANS repere. « 2 » seances : conforme
  // ou en retard ? « 71 % » de diete : mieux ou moins bien qu'avant ? Chaque
  // sous-titre repond a cette question-la, et a rien d'autre.
  // ⚠ ET IL RESTE VIDE QUAND LA DONNEE MANQUE. Une tuile sans sous-titre
  // s'affiche exactement comme avant ce lot : c'est la regle d'honnetete
  // tenue partout ailleurs — on ne meuble pas.
  const ss=((u&&u.sessions)||[]).filter(s=>s&&s.date);
  // a) Cette semaine, contre les creneaux actifs du programme. Aucun creneau,
  //    aucun sous-titre : « / 0 prevues » n'est pas un referentiel, c'est un
  //    zero affiche.
  // ⚠ LE QUOTA A DEMENAGE DANS LE CHIFFRE. « 5 » surmonte de « / 6 prévues »
  // disait la meme chose en deux endroits ; « 5/6 » la dit d'un coup, et rend
  // la troisieme ligne au qualificatif. Sans creneau actif, il n'y a pas de
  // denominateur a annoncer — le compte seul, comme avant.
  const prevues=_creneauxPrevus(u);
  // c) La diete, et sa tendance sur trente jours. Calculee ici pour les deux
  //    branches : le taux existe meme sans une seule seance.
  const di=_tauxDieteRespectee(u);
  const valM3=di?(di.pct+' %'):'-';
  // R34 — la fiche de la diete s'ouvre depuis la tuile entiere (gabarit),
  // meme sans donnee : c'est justement quand le « — » s'affiche qu'on se
  // demande ce qui est compte.
  // ⚠ LES QUALIFICATIFS SONT ECRITS DANS LE GABARIT, PAS ICI. Ils sont fixes
  // — « cette semaine », « depuis le début », « de la diète » — et les
  // reecrire a chaque rendu n'aurait servi qu'a les faire diverger du jour ou
  // l'un d'eux changerait dans le HTML. On passe donc `undefined` : met()
  // laisse alors le sous-titre tel qu'il est.
  if(!ss.length){
    met('clh-m1',prevues>0?('0/'+prevues):'-');
    met('clh-m2','0');
    met('clh-m3',valM3);
    return;
  }
  const faites=_seancesCetteSemaine(u);
  met('clh-m1',prevues>0?(faites+'/'+prevues):String(faites));
  // b) Seances au total, et depuis quand. Un compteur qui ne redescend
  //    jamais : c'est le seul chiffre de cet ecran qui recompense la duree
  //    plutot que la semaine en cours. Le MOIS plutot qu'un nombre de jours
  //    — « juil. 2026 » se retient, « depuis 412 jours » se calcule.
  met('clh-m2',String(ss.length));
  met('clh-m3',valM3);
}
// ── Volume par créneau, dans l'onglet Perfs ─────────────────────────────────
// Le graphique mélangeait tous les créneaux : une séance jambes et une séance
// bras dans le même histogramme, où la première écrase la seconde sans que
// rien ne progresse. On trace un créneau à la fois.
//
// L'appariement passe par _memeCreneau, le prédicat déjà utilisé par la
// suggestion de charge et la comparaison de fin de séance. Il retombe sur le
// NOM pour l'historique antérieur au champ slot : c'est ce qui garde les
// vieilles séances visibles.
let _perfCreneau=null;
function _creneauxActifs(u){
  return ((u&&u.sessions_config)||[])
    .map((s,i)=>({slot:i,nom:(s&&s.name)||('Séance '+(i+1)),actif:!!(s&&s.active)}))
    .filter(x=>x.actif);
}
function _perfCreneauCourant(u){
  const l=_creneauxActifs(u);
  if(!l.length) return null;
  const trouve=l.find(x=>x.slot===_perfCreneau);
  return trouve||l[0];
}
function _seancesDuCreneau(u,cr){
  if(!cr) return [];
  return ((u&&u.sessions)||[]).filter(s=>{
    try{ return _memeCreneau(s,cr.slot,cr.nom); }catch(e){ return false; }
  });
}
function _htmlSelecteurCreneau(u){
  const l=_creneauxActifs(u);
  if(!l.length) return '';
  const cur=_perfCreneauCourant(u);
  // Un seul créneau : le sélecteur n'apporte rien, on nomme la séance et on
  // s'arrête là.
  if(l.length===1) return '';
  return `<div data-scroll-fade style="display:flex;gap:6px;overflow-x:auto;margin-bottom:10px;padding-bottom:2px">
    ${l.map(x=>`<button onclick="_perfSetCreneau(${x.slot})" class="hit44"
      style="flex:0 0 auto;min-height:38px;padding:8px 14px;border-radius:var(--r-2);cursor:pointer;white-space:nowrap;font-size:var(--fs-sm);font-weight:700;
      background:${cur&&cur.slot===x.slot?'#1a0505':'var(--surface-1)'};border:1px solid ${cur&&cur.slot===x.slot?'var(--red)':'var(--border)'};
      color:${cur&&cur.slot===x.slot?'var(--text)':'#bbb'}">${escapeHtml(x.nom)}</button>`).join('')}
  </div>`;
}
function _perfSetCreneau(slot){
  _perfCreneau=slot;
  showProgressTab('perf',document.querySelector('#prog-tabs button:nth-child(4)'));
}
function _htmlVolumeCreneau(u){
  const cur=_perfCreneauCourant(u);
  if(!cur) return '';
  const l=_seancesDuCreneau(u,cur).slice(-8);
  const titre='Volume de tes séances du '+escapeHtml(cur.nom);
  if(!l.length){
    return `${_htmlSelecteurCreneau(u)}
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">${titre}</div>
      <div class="card" style="font-size:var(--fs-sm);color:var(--sub);line-height:1.6">Aucune séance enregistrée sur ce créneau.</div>`;
  }
  return `${_htmlSelecteurCreneau(u)}
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">${titre}</div>
    <div class="card"><canvas id="v-chart" height="140"></canvas></div>`;
}
function _peindreVolumeCreneau(u){
  const cur=_perfCreneauCourant(u);
  if(!cur) return;
  const l=_seancesDuCreneau(u,cur).slice(-8);
  if(!l.length) return;
  barChart('v-chart',
    l.map(s=>dateLocaleDeCle(s.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})),
    l.map(s=>s.volume||0));
}

// ══ LA FIN DE SEANCE EST UNE RECOMPENSE, PAS UN RELEVE ═════════════════
// L'ecran posait une question sur la congestion AVANT d'avoir montre le
// moindre chiffre, et annoncait « -3 557 kg vs derniere seance » juste apres
// un record. Quelqu'un qui vient de finir veut savoir ce qu'il a REUSSI ;
// l'analyse peut attendre trois ecrans de defilement. Refonte demandee par
// Kevin, 14/09/2026.
//
// LE MOTEUR EST UNE LISTE DE REGLES, jamais une suite de if dans le rendu :
// une regle s'ajoute en une ligne, et chacune dit ce qu'elle constate.
const BADGES=Object.freeze({
  NEW_RECORD:      {t:'Nouveau record',    d:'Tu as battu ton précédent record sur cet exercice.', i:'couronne', p:100,f:'record'},
  MULTIPLE_RECORDS:{t:'Domination',        d:'Plusieurs records dans la même séance.',             i:'lion',     p:95, f:'record'},
  NEW_LOAD:        {t:'Nouveau palier',    d:'Tu as franchi un nouveau seuil de charge.',          i:'fusee',    p:90, f:'record'},
  PERSONAL_BEST:   {t:'Personal best',     d:'Ta meilleure performance historique.',               i:'trophee',  p:88, f:'record'},
  NEW_PERF:        {t:'Nouvelle performance',d:'Tu as réalisé ta meilleure performance sur cet exercice.',i:'eclair',p:80,f:'progression'},
  PROGRESSION:     {t:'En progression',    d:'Plusieurs exercices en amélioration.',               i:'courbe',   p:78, f:'progression'},
  MONSTER:         {t:'Séance monstre',    d:'Nettement plus de volume que d’habitude.',             i:'flamme',   p:75, f:'volume'},
  HIGH_VOLUME:     {t:'Gros volume',       d:'Un volume au-dessus de ta moyenne.',   i:'haltere',  p:70, f:'volume'},
  NO_MERCY:        {t:'No mercy',          d:'Des séries menées très près de l’échec.',            i:'crane',    p:68, f:'intensite'},
  FULL_SESSION:    {t:'100% validé',       d:'Toutes les séries prévues ont été réalisées.',       i:'cible',    p:65, f:'completion'},
  NO_FAIL:         {t:'Sans échec',        d:'Toutes les séries ont été validées.',                i:'cent',     p:62, f:'completion'},
  PERFECT:         {t:'Séance parfaite',   d:'Objectifs de séance remplis.',                       i:'sommet',   p:60, f:'completion'},
  STREAK:          {t:'Série en cours',    d:'Tu construis ta régularité. Continue.',              i:'chaine',   p:55, f:'regularite'},
  RETURN:          {t:'Retour au combat',  d:'Tu reviens plus fort après une pause.',              i:'phenix',   p:52, f:'regularite'},
  DISCIPLINE:      {t:'Discipline',        d:'Tu as tenu le cap, même dans la difficulté.',        i:'cerveau',  p:45, f:'mental'}
});
// Un glyphe par badge, meme trait, meme grille 24x24 : melanger deux styles
// d'icones se voit immediatement sur une grille de quinze.
const BADGE_GLYPHES=Object.freeze({
  couronne:'<path d="M4 17h16M4 17l-1.5-8L8 12l4-7 4 7 5.5-3L20 17"/>',
  lion:'<path d="M12 3l2.5 2H18l-1 3 2 2-2 2 1 3h-3.5L12 20l-2.5-3H6l1-3-2-2 2-2-1-3h3.5z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>',
  fusee:'<path d="M12 3c3 2 5 5.5 5 9l-2.5 3h-5L7 12c0-3.5 2-7 5-9z"/><path d="M9.5 18l-2 3 3-1M14.5 18l2 3-3-1"/><circle cx="12" cy="10" r="1.6"/>',
  trophee:'<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 3M16 6h3a3 3 0 01-3 3"/><path d="M10 20h4M12 13v7"/>',
  eclair:'<path d="M13 3L5 13h6l-2 8 9-11h-6z"/>',
  courbe:'<path d="M4 20V9M10 20V5M16 20v-7M20 20V3"/>',
  flamme:'<path d="M12 3c1 3-1 4-2.5 6C8 11 7 12.5 7 14.5A5 5 0 0017 15c0-3-2-4.5-3-7-1.5 1-2 2-2 3 0-3 0-5 0-8z"/>',
  haltere:'<path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12"/>',
  crane:'<path d="M12 3a7 7 0 00-7 7c0 2.5 1.5 4 2.5 5V19h9v-4c1-1 2.5-2.5 2.5-5a7 7 0 00-7-7z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/>',
  cible:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  cent:'<path d="M4 8v8M8 8v8M4 12h4"/><circle cx="13.5" cy="12" r="3.2"/><circle cx="20" cy="12" r="3.2"/>',
  sommet:'<path d="M3 20l6-11 3 5 2-3 7 9z"/><path d="M14 4v6l4-2-4-2"/>',
  chaine:'<path d="M9 12a3 3 0 013-3h2a3 3 0 010 6h-2"/><path d="M15 12a3 3 0 01-3 3h-2a3 3 0 010-6h2"/>',
  phenix:'<path d="M12 4c2 3 5 4 8 4-2 2-4 2-5 2 2 1 3 3 3 5-2-1-4-2-6-2s-4 1-6 2c0-2 1-4 3-5-1 0-3 0-5-2 3 0 6-1 8-4z"/>',
  cerveau:'<path d="M9 4a3 3 0 00-3 3 3 3 0 00-1 5 3 3 0 002 5 3 3 0 005 1V4.5A2.5 2.5 0 009 4z"/><path d="M15 4a3 3 0 013 3 3 3 0 011 5 3 3 0 01-2 5 3 3 0 01-5 1"/>'
});
// ══ LES VRAIS MEDAILLONS, QUAND ILS SONT LA ═══════════════════════════
//
// ⚠ LES GLYPHES CI-DESSUS SONT UN REPLI, PAS LA CIBLE. Kevin a dessine les
// quinze medaillons — hexagone metal, lauriers, embleme rouge, lueur — et ce
// sont EUX qu'il faut afficher : le trait a 1,7 px ne les remplace pas, il
// tient la place tant que les fichiers ne sont pas deposes.
//
// MEME CONVENTION QUE app/img/arn.png : le fichier est cherche par un chemin
// local, rien n'est telecharge, et son absence est geree par un `onerror` qui
// rend la main au glyphe. Une image cassee serait pire que pas d'image.
//
// UN FICHIER PAR BADGE, nomme d'apres sa clef en minuscules :
//   app/img/badges/new_record.webp, multiple_records.webp, new_load.webp,
//   personal_best.webp, new_perf.webp, progression.webp, monster.webp,
//   high_volume.webp, no_mercy.webp, full_session.webp, no_fail.webp,
//   perfect.webp, streak.webp, return.webp, discipline.webp
// Voir app/img/badges/LISEZ-MOI.txt.
const BADGE_IMG_DOSSIER='img/badges/';
// .png et non .webp : c'est le format demande. Il a longtemps pese quatre fois
// plus — 1,2 Mo pour les quinze contre 324 Ko en webp — et ce commentaire s'en
// excusait. Ce n'est plus vrai : les quinze sont reindexes sur 96 couleurs
// avec transparence (15/09/2026) et pesent 221 ko a eux tous, moins que la
// version webp. Comparatif fait a taille reelle avant remplacement : aucune
// difference visible, et ils s'affichent a 64 px.
// Depuis, ils sont dans ASSETS de sw.js — voir MEDAILLONS la-bas.
function _badgeFichier(k){
  return k?BADGE_IMG_DOSSIER+String(k).toLowerCase()+'.png':null;
}
// Le medaillon dessine n'existe pas : on revele le glyphe reste dessous et on
// remet le cadre hexagonal, que l'image portait elle-meme.
function _badgeSansImage(el){
  if(!el||!el.parentNode) return false;
  try{ el.onerror=null; }catch(e){}
  const h=el.parentNode;
  h.classList.remove('rc-badge-vrai');
  try{ el.remove(); }catch(e){ try{ h.removeChild(el); }catch(_e){} }
  return true;
}
function _htmlGlyphe(nom){
  const d=BADGE_GLYPHES[nom]||BADGE_GLYPHES.cible;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    +'stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">'+d+'</svg>';
}
// ── LE MOTEUR ──────────────────────────────────────────────────────────
// PURE : aucun DOM, aucun currentUser. Tout ce qu'il sait lui est donne,
// donc tout ce qu'il decide est verifiable.
//   ctx = {records:[{nm,curMax,histMax,gain}], sets, setsPlanned, volume,
//          volumesPrecedents:[], streak, joursDepuisDerniere, exosAmeliores,
//          seriesEchouees, rpe}
function achievementEngine(ctx){
  const c=ctx||{};
  const rec=Array.isArray(c.records)?c.records:[];
  const sets=Number(c.sets)||0, prevus=Number(c.setsPlanned)||0;
  const vol=Number(c.volume)||0;
  const hist=(Array.isArray(c.volumesPrecedents)?c.volumesPrecedents:[]).filter(v=>v>0);
  const median=hist.length?hist.slice().sort((a,b)=>a-b)[Math.floor(hist.length/2)]:0;
  const out=[];
  const pose=(k,extra)=>{ const b=BADGES[k]; if(b) out.push(Object.assign({k,titre:b.t,desc:b.d,icone:b.i,priorite:b.p,famille:b.f},extra||{})); };

  if(rec.length){
    const meilleur=rec.slice().sort((a,b)=>(b.gain||0)-(a.gain||0))[0];
    pose('NEW_RECORD',{exercice:meilleur.nm,valeur:meilleur.curMax,ancien:meilleur.histMax,gain:meilleur.gain});
    if(rec.length>=2) pose('MULTIPLE_RECORDS',{valeur:rec.length});
    // Un palier est un multiple de 10 kg franchi pour la premiere fois : 97 ->
    // 102 en est un, 101 -> 104 n'en est pas.
    const palier=rec.find(r=>!r.assiste&&Math.floor(r.curMax/10)>Math.floor((r.histMax||0)/10));
    if(palier) pose('NEW_LOAD',{exercice:palier.nm,valeur:Math.floor(palier.curMax/10)*10});
  }
  // PERSONAL BEST : la meilleure e1RM historique battue, SUR UN EXERCICE DONT
  // LA CHARGE N'A PAS ÉTÉ BATTUE. Il était déclaré et jamais posé — la fiche
  // l'annonçait, le moteur ne le rendait pas. Il n'est pas un doublon de
  // NEW_RECORD : plus de répétitions à la même charge est une meilleure
  // performance sans être une charge record. Sur un exercice qui a DÉJÀ son
  // record de charge, il ne dirait rien de plus : on ne le pose pas.
  const pb=(Array.isArray(c.recordsE1rm)?c.recordsE1rm:[])
    .find(r=>r&&r.nm&&!rec.some(x=>x&&x.nm===r.nm));
  if(pb) pose('PERSONAL_BEST',{exercice:pb.nm,valeur:pb.apres,ancien:pb.avant});
  if(!rec.length&&Number(c.exosAmeliores)>0){
    // Pas de record, mais ca monte : c'est une autre nouvelle, pas la meme.
    if(Number(c.exosAmeliores)>=2) pose('PROGRESSION',{valeur:Number(c.exosAmeliores)});
    else pose('NEW_PERF',{valeur:Number(c.exosAmeliores)});
  }
  if(prevus>0&&sets>=prevus){
    pose('FULL_SESSION',{valeur:sets,prevus});
    if(!Number(c.seriesEchouees)) pose('PERFECT',{valeur:sets});
  }
  if(!Number(c.seriesEchouees)&&sets>0) pose('NO_FAIL',{valeur:sets});
  if(vol>0){
    // La MEDIANE VOYAGE AVEC LE BADGE : c'est elle qui permet d'ecrire
    // « +25 % sur ta moyenne » au lieu de « volume exceptionnel ».
    if(median>0&&vol>=median*1.25) pose('MONSTER',{valeur:vol,mediane:median});
    else if(vol>=12000) pose('HIGH_VOLUME',{valeur:vol});
  }
  if(Number(c.rpe)>=8.5) pose('NO_MERCY',{valeur:Number(c.rpe)});
  if(Number(c.joursDepuisDerniere)>=10) pose('RETURN',{valeur:Math.round(Number(c.joursDepuisDerniere))});
  else if(Number(c.streak)>=3) pose('STREAK',{valeur:Number(c.streak)});
  if(Number(c.rpe)>=7&&prevus>0&&sets>=prevus) pose('DISCIPLINE',{});

  // PAS DE DOUBLONS : une famille ne parle qu'une fois, sauf « record » ou le
  // cumul est justement l'information (un record ET plusieurs records ET un
  // palier disent trois choses differentes).
  const vues=new Set(),garde=[];
  for(const b of out.sort((a,b)=>b.priorite-a.priorite)){
    if(b.famille!=='record'&&vues.has(b.famille)) continue;
    vues.add(b.famille); garde.push(b);
  }
  return garde;
}
// ══════ FIN DE SEANCE v2 : LA LOGIQUE, PUIS LE RENDU ══════════════════
//
// Tout ce qui suit est separe en deux : d'abord des fonctions PURES qui
// decident (quelles recompenses, quels paliers, quelle duree lisible), puis
// des fonctions qui dessinent. Aucune des premieres ne touche au DOM, aucune
// des secondes ne calcule quoi que ce soit. C'est ce qui rend l'ecran
// testable sans navigateur — et c'est ainsi qu'il l'est.

// ── PURE. La duree en heures, jamais en minutes au-dela de 59 ──────────
//
// ⚠ « 205 minutes » ne se lit pas. Personne ne sait ce que ca represente sans
// poser une division ; « 3 h 25 » se lit d'un coup. Sous l'heure on garde les
// minutes, parce que « 0 h 45 » serait pire que « 45 min ».
//
// ⚠ ELLE S'APPELAIT fmtDureeSeance, COMME CELLE DU CHRONOMETRE — qui vit
// 3 300 lignes plus haut et prend des SECONDES. Deux declarations de fonction
// du meme nom dans le meme script : la seconde ecrase la premiere, en silence,
// et c'est celle-ci qui gagnait. Le chronometre de seance passait donc ses
// secondes a une fonction qui lisait des minutes — au bout d'une minute de
// seance il affichait « 1 h 02 », au bout d'une demi-heure « 30 h 32 ».
// Signale par Kevin le 15/09/2026. Le nom dit desormais ce qu'elle rend.
function fmtDureeHeures(mins){
  const m=Math.max(0,Math.round(Number(mins)||0));
  if(m<60) return m+' min';
  const h=Math.floor(m/60), r=m%60;
  // « 1 h » et non « 1 h 00 » : le zero n'apporte rien et allonge la ligne.
  return r===0 ? (h+' h') : (h+' h '+(r<10?'0'+r:r));
}

// ── PURE. Les trois recompenses qui comptent ───────────────────────────
//
// Le moteur en rend jusqu'a une dizaine. En afficher dix les devalue toutes :
// on en garde TROIS, et on assume l'ordre.
//
// L'ordre demande est explicite — le palier d'abord, le volume ensuite, la
// seance complete en troisieme — et il prime sur la priorite interne du
// moteur. Ce qui reste est departage par cette priorite. Zero recompense rend
// un tableau vide, et l'ecran le sait : il n'affiche PAS trois faux badges.
const RECOMPENSES_ORDRE=Object.freeze(['NEW_LOAD','MONSTER','HIGH_VOLUME','FULL_SESSION']);
function recompensesPrincipales(badges){
  const l=Array.isArray(badges)?badges.filter(Boolean):[];
  if(!l.length) return [];
  const rang=b=>{
    const i=RECOMPENSES_ORDRE.indexOf(b.k);
    // Les non-listees passent apres, dans l'ordre du moteur.
    return i>=0?i:(RECOMPENSES_ORDRE.length+(1000-(Number(b.priorite)||0))/1000);
  };
  return l.slice().sort((a,b)=>rang(a)-rang(b)).slice(0,3);
}

// ── PURE. L'explication sous un badge ──────────────────────────────────
//
// Courte, et DYNAMIQUE quand elle porte un chiffre : « 24 / 24 series
// realisees » doit dire 18/18 pour une seance de dix-huit. Le nombre en dur
// etait la faute a ne pas commettre.
// ⚠ ELLE NOMME CE QUI S'EST PASSE DANS CETTE SEANCE, pas ce que le badge
// signifie en general. « Tu viens de franchir un nouveau niveau » est vrai
// pour tout le monde et n'apprend rien ; « Développé couché · palier des
// 100 kg » dit QUEL exercice, QUEL palier, et se verifie.
//
// Chaque badge porte deja ses chiffres — le moteur les attache au moment ou
// il le pose. Ici on ne fait que les mettre en mots. Quand ils manquent — un
// dossier ancien, une seance sans consigne — on retombe sur la description
// generique du badge plutot que d'ecrire une phrase a trous.
function descRecompense(b,ctx){
  const c=ctx||{};
  if(!b) return '';
  const nb=v=>Number(v).toLocaleString('fr-FR');
  const dec=v=>String(Math.round(Number(v)*10)/10).replace('.',',');
  const ex=String(b.exercice||'').trim();
  // ⚠ UN CHIFFRE ABSENT N'EST PAS UN ZERO. Un badge venu d'un dossier
  // ancien, ou pose sans sa valeur, donnait « Palier des NaN kg » et
  // « 0 kg souleves » — vu a l'ecran le 14/09/2026. `ok` decide, une fois,
  // si on a de quoi ecrire une phrase juste ; sinon on rend la description
  // generique du badge, qui reste vraie.
  const v=Number(b.valeur);
  const ok=n=>Number.isFinite(n)&&n>0;
  const k=b.k;

  if(k==='FULL_SESSION'||k==='PERFECT'){
    const f=ok(v)?v:Number(c.sets);
    const t=Number(b.prevus)||Number(c.setsPlanned)||f;
    return (ok(f)&&ok(t))?(f+' / '+t+' séries réalisées'):String(b.desc||'');
  }
  if(k==='NO_FAIL'){
    const f=ok(v)?v:Number(c.sets);
    return ok(f)?(f+' séries validées, aucune manquée'):String(b.desc||'');
  }
  if(k==='NEW_LOAD')
    return ok(v)?(ex?(ex+' · palier des '+nb(v)+' kg'):('Palier des '+nb(v)+' kg franchi'))
               :String(b.desc||'');
  if(k==='NEW_RECORD'){
    if(!ok(v)) return String(b.desc||'');
    const a=Number(b.ancien);
    return (ex?ex+' · ':'')+(a>0?(nb(a)+' → '+nb(v)+' kg'):(nb(v)+' kg'));
  }
  if(k==='MULTIPLE_RECORDS')
    return ok(v)?(v+' records dans cette séance'):String(b.desc||'');
  if(k==='MONSTER'||k==='HIGH_VOLUME'){
    const vol=ok(v)?v:Number(c.volume);
    if(!ok(vol)) return String(b.desc||'');
    const m=Number(b.mediane);
    return (k==='MONSTER'&&ok(m))
      ? (nb(Math.round(vol))+' kg, +'+Math.round((vol/m-1)*100)+' % sur ta moyenne')
      : (nb(Math.round(vol))+' kg soulevés');
  }
  if(k==='NO_MERCY')
    return ok(v)?('RPE moyen '+dec(v)+' sur 10'):String(b.desc||'');
  if(k==='PROGRESSION'||k==='NEW_PERF'){
    const n=v||Number(c.exosAmeliores)||0;
    if(!n) return String(b.desc||'');
    return n+' exercice'+(n>1?'s':'')+' en progression';
  }
  if(k==='STREAK')
    return ok(v)?(v+' semaine'+(v>1?'s':'')+' d’affilée'):String(b.desc||'');
  if(k==='RETURN')
    return ok(v)?('De retour après '+v+' jours'):String(b.desc||'');
  if(k==='DISCIPLINE'){
    const f=Number(c.sets)||0, t=Number(c.setsPlanned)||f;
    return (f&&t)?('Tout tenu : '+f+' / '+t+' séries'):String(b.desc||'');
  }
  if(k==='PERSONAL_BEST')
    return ex?(ex+' · 1RM estimée '+(ok(v)?dec(v)+' kg':'record')):String(b.desc||'');
  return String(b.desc||'');
}

// ── PURE. L'ascension : des marches, pas une barre ─────────────────────
//
// Cinq paliers de 5 kg qui montent vers le prochain. Ceux qui sont derriere
// sont « pris », celui ou l'on se tient est « ici », le dernier est le « but ».
// Les paliers negatifs ou nuls sont retires : on ne montre pas une marche a
// -5 kg parce que l'athlete debute.
// PURE. Le prochain palier de 5 kg au-dessus du record du jour ; a defaut de
// record, le meilleur exercice de la seance et son propre palier.
//
// Elle survit a la refonte SANS UNE LIGNE DE CHANGEE : c'est la decision
// metier — quel exercice, quel palier vise — et elle etait juste. Seule sa
// representation change, de la barre de progression aux marches.
function prochainObjectif(ctx){
  const c=ctx||{};
  const rec=(Array.isArray(c.records)?c.records:[]).slice().sort((a,b)=>(b.curMax||0)-(a.curMax||0))[0];
  const base=rec?{nm:rec.nm,kg:rec.curMax}:(c.meilleurExo||null);
  if(!base||!(base.kg>0)) return null;
  const cible=Math.ceil((base.kg+0.01)/5)*5;
  return {exercice:base.nm,actuel:base.kg,cible,reste:Math.round((cible-base.kg)*10)/10};
}
const ASC_PAS=5, ASC_MARCHES=5;
function ascensionPaliers(ctx){
  const o=(()=>{ try{ return prochainObjectif(ctx); }catch(e){ return null; } })();
  if(!o) return null;
  const ici=Math.floor(o.actuel/ASC_PAS)*ASC_PAS;
  const marches=[];
  for(let i=ASC_MARCHES-1;i>=0;i--){
    const kg=o.cible-i*ASC_PAS;
    if(kg<=0) continue;
    marches.push({kg,pris:kg<ici,ici:kg===ici,but:kg===o.cible});
  }
  // Un seul palier ne raconte pas de montee : on ne dessine alors rien.
  if(marches.length<2) return null;
  return {exercice:o.exercice,actuel:o.actuel,cible:o.cible,reste:o.reste,marches};
}
// ── LA FLAMME ──────────────────────────────────────────────────────────
//
// ⚠ NI EMOJI, NI PICTOGRAMME. Une flamme d'emoji est jaune et ronde, un
// pictogramme au trait est plat : ni l'un ni l'autre ne dit « energie
// accumulee ». Celle-ci est faite de QUATRE COUCHES qui se recouvrent — halo,
// corps sombre, corps vif, coeur incandescent — et c'est leur superposition
// qui donne la profondeur, pas un filtre.
//
// Tout est en SVG inline : aucun fichier a charger, aucune bibliotheque, et
// les degrades se repeignent avec la page au lieu d'etre une image figee.
// Les identifiants de degrade sont prefixes `rcff` : l'ecran de fin cohabite
// avec le dessin du bilan partageable, qui a les siens.
function _htmlFlammeFin(){
  return '<div class="rcf-flamme">'
  +'<svg viewBox="0 0 120 140" fill="none" aria-hidden="true">'
  +'<defs>'
    +'<linearGradient id="rcffSombre" x1="0" y1="1" x2="0" y2="0">'
      +'<stop offset="0" stop-color="#2b0000"/><stop offset=".45" stop-color="#6b0505"/>'
      +'<stop offset="1" stop-color="#a00d0d"/></linearGradient>'
    +'<linearGradient id="rcffVif" x1="0" y1="1" x2="0" y2="0">'
      +('<stop offset="0" stop-color="#7a0000"/><stop offset=".5" stop-color="'+ROUGE_MARQUE_MIN+'"/>')
      +'<stop offset="1" stop-color="#ff4a2a"/></linearGradient>'
    +'<linearGradient id="rcffCoeur" x1="0" y1="1" x2="0" y2="0">'
      +('<stop offset="0" stop-color="'+ROUGE_MARQUE_MIN+'"/><stop offset=".55" stop-color="#ff6a3c"/>')
      +'<stop offset="1" stop-color="#ffb08a"/></linearGradient>'
    +'<radialGradient id="rcffHalo" cx=".5" cy=".62" r=".55">'
      +('<stop offset="0" stop-color="'+ROUGE_MARQUE_MIN+'" stop-opacity=".42"/>')
      +('<stop offset="1" stop-color="'+ROUGE_MARQUE_MIN+'" stop-opacity="0"/></radialGradient>')
  +'</defs>'
  // 1. Le halo. Peint le premier, donc derriere tout le reste.
  +'<ellipse cx="60" cy="86" rx="52" ry="50" fill="url(#rcffHalo)"/>'
  // ⚠ ELLE A ETE REDESSINEE APRES L'AVOIR VUE A L'ECRAN. La premiere version
  //    se lisait comme une GOUTTE : sommet trop rond, corps trop large, langues
  //    laterales trop basses. Une flamme, c'est une pointe fine qui part haut,
  //    un corps qui s'evase vite, et des langues qui LECHENT vers le haut.
  // 2. Les deux langues laterales : angulaires et montantes, elles donnent
  //    l'energie qui s'echappe. Basses et rondes, elles faisaient des joues.
  +'<path d="M31 118c-11-13-13-29-6-44 0 12 4 19 10 23-5-16-2-30 8-41'
    +'-1 18 5 27 12 35z" fill="url(#rcffSombre)" opacity=".8"/>'
  +'<path d="M89 118c11-13 13-29 6-44 0 12-4 19-10 23 5-16 2-30-8-41'
    +'1 18-5 27-12 35z" fill="url(#rcffSombre)" opacity=".8"/>'
  // 3. Le corps sombre : la masse, et la SILHOUETTE. La pointe part de y=4 et
  //    penche legerement — une flamme parfaitement symetrique est un logo, pas
  //    un feu.
  +'<path d="M58 4c9 21 3 31-2 40 5-4 9-10 11-17 6 13 17 21 25 33 8 11 10 22 10 31'
    +'a42 42 0 0 1-84 0c0-13 6-24 15-34 8-9 14-17 14-27 3 6 6 11 7 17'
    +'C56 32 55 18 58 4z" fill="url(#rcffSombre)"/>'
  // 4. Le corps vif, en retrait : le lisere sombre qui apparait entre les deux
  //    est ce qui fait le relief. Sa pointe est DECALEE de la grande, sinon les
  //    deux formes se lisent comme une seule.
  +'<path d="M61 34c6 15 1 22-2 28 4-3 7-7 8-12 4 9 12 15 17 23 5 8 7 15 7 21'
    +'a30 30 0 0 1-60 0c0-9 4-17 11-24 6-6 10-12 10-19 2 4 4 8 5 12'
    +'C59 52 59 43 61 34z" fill="url(#rcffVif)"/>'
  // 5. Le coeur incandescent : la seule zone claire de tout l'ecran, et elle
  //    tient dans quinze pixels. Plus large, elle deviendrait une lampe.
  +'<path d="M61 74c3 8-1 12-2 16 2-2 4-4 5-7 2 5 6 9 8 13 3 5 4 9 4 12'
    +'a14 14 0 0 1-28 0c0-5 2-9 6-13 3-4 5-7 5-11 1 2 2 4 3 6'
    +'C60 84 60 79 61 74z" fill="url(#rcffCoeur)"/>'
  +'</svg>'
  // 6. Les etincelles. Trois passages, puis elles s'arretent : une braise qui
  //    monterait en boucle pour l'eternite ferait du bruit visuel.
  +'<div class="rcf-etin" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>'
  +'</div>';
}
// ── LE RENDU ───────────────────────────────────────────────────────────
// ⚠ `sansTexte` : sur l'ecran de fin, le nom et l'explication sont rendus
// DESSOUS par _htmlRecompenses, avec leur propre typographie. Les repeter ici
// ferait deux titres l'un sur l'autre.
function _htmlBadge(b,grand,sansTexte){
  const t=grand?96:64;
  const f=_badgeFichier(b&&b.k);
  // L'image par-dessus le glyphe, dans le meme cadre : si elle charge, elle le
  // recouvre entierement ; si elle manque, `onerror` la retire et le glyphe est
  // deja la, sans clignotement et sans requete supplementaire.
  const img=f?('<img class="rc-badge-img" src="'+escapeHtml(f)+'" alt="" '
    +'loading="lazy" decoding="async" onerror="_badgeSansImage(this)">'):'';
  return '<div class="rc-badge'+(grand?' rc-badge-xl':'')+'" role="img" aria-label="'+escapeHtml(b.titre+'. '+b.desc)+'">'
    +'<div class="rc-badge-hex'+(f?' rc-badge-vrai':'')+'" style="width:'+t+'px;height:'+t+'px">'
      +'<div class="rc-badge-ico">'+_htmlGlyphe(b.icone)+'</div>'+img+'</div>'
    +(sansTexte?'':'<div class="rc-badge-t">'+escapeHtml(b.titre)+'</div>'
      +(grand?'':'<div class="rc-badge-d">'+escapeHtml(b.desc)+'</div>'))+'</div>';
}
// ── LE HERO ────────────────────────────────────────────────────────────
// Il ne porte plus le record : celui-ci a sa place dans les recompenses et
// dans « Mes records », et l'afficher trois fois le banalisait.
// ══════════════════ L'HISTORIQUE DES SEANCES ══════════════════════════════
//
// Toutes les seances faites, de la plus recente a la plus ancienne, une ligne
// chacune. Un clic ouvre la seance relue.
//
// ⚠ RIEN N'EST RECALCULE ICI. Une seance enregistree porte deja son nom, sa
// date, sa duree, son volume et ses series — finishWorkout les a ecrits. La
// liste les LIT. Un historique qui recalculerait finirait par afficher des
// chiffres differents de ceux montres a la fin de la seance, et c'est
// exactement ce qu'on ne peut pas se permettre : ce sont les memes.
//
// PURE. Les seances, triees, avec ce qu'il faut pour une ligne et rien de plus.
function listeHistoriqueSeances(u){
  return ((u&&u.sessions)||[])
    .filter(x=>x&&x.date)
    .slice()
    .sort((a,b)=>b.date-a.date);
}
// PURE. La date, telle qu'on la lit dans une liste : « Mardi 15 septembre ».
// L'annee n'apparait QUE si ce n'est pas l'annee en cours — sur douze mois
// elle est du bruit, au-dela elle est la seule chose qu'on cherche.
function _dateHistorique(ts,maintenant){
  const d=new Date(ts);
  const t=new Date((typeof maintenant==='number')?maintenant:Date.now());
  const o={weekday:'long',day:'numeric',month:'long'};
  if(d.getFullYear()!==t.getFullYear()) o.year='numeric';
  const x=d.toLocaleDateString('fr-FR',o);
  return x.charAt(0).toUpperCase()+x.slice(1);
}
// PURE. Une ligne. L'identifiant passe par data-id et non par un onclick
// construit a la main : un nom de seance porte des apostrophes, et les
// concatener dans du JavaScript inline est la porte d'entree qu'on ne veut pas.
function _htmlLigneHistorique(sc,maintenant){
  const nb=v=>Number(Math.round(v)||0).toLocaleString('fr-FR');
  const dur=Number(sc.duration)||0;
  const vol=Number(sc.volume)||0;
  const chiffres=[];
  if(dur>0) chiffres.push(dur+' min');
  if(vol>0) chiffres.push(nb(vol)+' kg');
  return '<button type="button" class="hs-ligne" data-seance="'+escapeHtml(String(sc.id||sc.date))+'"'
    +(sc.complete===false?' data-partielle':'')+'>'
    +'<div class="hs-corps">'
      +'<div class="hs-nom">'+escapeHtml(String(sc.name||'Séance'))
      +(sc.complete===false?'<span class="hs-part">partielle</span>':'')+'</div>'
      +'<div class="hs-date">'+escapeHtml(_dateHistorique(sc.date,maintenant))+'</div>'
    +'</div>'
    +'<div class="hs-chiffres">'+chiffres.map(escapeHtml).join('<br>')+'</div>'
    +'<div class="hs-fleche" aria-hidden="true">›</div>'
    +'</button>';
}
function loadHistoriqueSeances(){
  const l=listeHistoriqueSeances(currentUser);
  const z=document.getElementById('hs-liste');
  const c=document.getElementById('hs-compte');
  if(c) c.textContent=l.length
    ? l.length+' séance'+(l.length>1?'s':'')+' enregistrée'+(l.length>1?'s':'')
    : '';
  if(z){
    z.innerHTML=l.length
      ? l.map(x=>_htmlLigneHistorique(x,Date.now())).join('')
      : emptyState('clock','Aucune séance enregistrée pour l\'instant.<br>'
        +'Elles apparaîtront ici dès la première terminée.',null,null,'');
    // UN SEUL ECOUTEUR, sur le conteneur : deux cents lignes font deux cents
    // ecouteurs autrement, et ils survivraient a chaque rendu.
    z.onclick=e=>{
      const b=e.target&&e.target.closest?e.target.closest('.hs-ligne'):null;
      if(b&&b.dataset.seance) ouvrirSeanceHistorique(b.dataset.seance);
    };
  }
  go('s-historique-seances');
}
// PURE. Les records de CETTE seance : ce qu'elle a battu par rapport a tout ce
// qui la precede. Meme regle que buildSessionComparison — la charge maximale
// par exercice, comparee au meilleur anterieur — mais sans woState, que
// l'historique n'a pas. Un exercice jamais fait avant n'est pas un record :
// c'est une premiere, et l'annoncer comme un record les devaluerait tous.
function recordsDeSeance(sc,anterieures){
  const out=[];
  const data=(sc&&sc.data&&typeof sc.data==='object')?sc.data:{};
  for(const nm of Object.keys(data)){
    const sets=((data[nm]||{}).sets)||[];
    // ASSISTÉ : le record est une assistance PLUS FAIBLE. Une assistance plus
    // lourde n'est jamais fêtée.
    if(typeCharge({name:nm})==='assiste'){
      const minA=l=>{ let m=0; for(const st of (l||[])){ if(!st||st.done!==true||!(_perfReps(st)>0)) continue; const w=parseFloat(st.weight)||0; if(w>0&&(!m||w<m)) m=w; } return m; };
      const cur=minA(sets); if(!cur) continue;
      let hist=0;
      for(const p of (anterieures||[])){ let d=null; try{ d=_dataDeSeance(p,nm); }catch(e){ d=null; } const v=minA(d&&d.sets); if(v&&(!hist||v<hist)) hist=v; }
      if(hist>0&&cur<hist) out.push({nm,curMax:cur,histMax:hist,gain:hist-cur,assiste:true,type:'charge'});
      continue;
    }
    let cur=0;
    for(const st of sets){
      if(!st||st.done!==true) continue;
      const w=parseFloat(st.weight)||0;
      if(w>cur) cur=w;
    }
    if(!cur) continue;
    let hist=0;
    for(const p of (anterieures||[])){
      let d=null;
      try{ d=_dataDeSeance(p,nm); }catch(e){ d=null; }
      for(const st of ((d&&d.sets)||[])){
        if(!st||st.done!==true) continue;
        const w=parseFloat(st.weight)||0;
        if(w>hist) hist=w;
      }
    }
    if(hist>0&&cur>hist){ out.push({nm,curMax:cur,histMax:hist,gain:cur-hist,type:'charge'}); continue; }
    // LE RECORD DE RÉPÉTITIONS : à une charge déjà soulevée, plus de
    // répétitions que jamais à cette charge ou plus lourd (80 × 10, puis 80 × 11).
    if(hist>0){ const rr=_recordRepsSeance(sets,nm,anterieures); if(rr) out.push(rr); }
  }
  out.sort((a,b)=>b.gain-a.gain);
  return out;
}
// Le meilleur record de répétitions d'une séance, ou null.
function _recordRepsSeance(sets,nm,anterieures){
  const histo=[];
  for(const p of (anterieures||[])){
    let d=null; try{ d=_dataDeSeance(p,nm); }catch(e){ d=null; }
    for(const st of ((d&&d.sets)||[])){ if(!st||st.done!==true) continue; const w=parseFloat(st.weight)||0, r=_perfReps(st); if(w>0&&r>0) histo.push([w,r]); }
  }
  let best=null;
  for(const st of (sets||[])){
    if(!st||st.done!==true) continue;
    const w=parseFloat(st.weight)||0, r=_perfReps(st);
    if(!(w>0)||!(r>0)) continue;
    const avant=histo.filter(h=>h[0]>=w);
    if(!avant.length) continue;
    const ra=Math.max(...avant.map(h=>h[1]));
    if(r>ra&&(!best||w>best.curMax||(w===best.curMax&&r>best.reps))) best={nm,curMax:w,histMax:w,gain:0,type:'reps',reps:r,repsAvant:ra};
  }
  return best;
}
/**
 * PURE. Le meilleur poids pour 1, 3, 5, 8, 10 et 12 répétitions (au moins),
 * séries faites, hors décharges et saisies aberrantes. {n: {kg, reps, date}}.
 * null pour un exercice assisté (la charge y est une assistance).
 */
const RECORDS_REPS=Object.freeze([1,3,5,8,10,12]);
function recordsParReps(user,nomEx){
  if(!user||!nomEx) return null;
  if(typeCharge(_exPourCharge(nomEx,user))==='assiste') return null;
  const out={};
  for(const pt of _serieRecords(user,nomEx)){
    if(pt.aberrant) continue;
    const d=pt.sess.data[pt.nom];
    for(const s of ((d&&d.sets)||[])){
      if(!s||s.done!==true) continue;
      const w=parseFloat(s.weight)||0, r=_perfReps(s);
      if(!(w>0)||!(r>0)) continue;
      for(const n of RECORDS_REPS) if(r>=n&&(!out[n]||w>out[n].kg)) out[n]={kg:w,reps:r,date:pt.date};
    }
  }
  return Object.keys(out).length?out:null;
}
// PURE. Les records d'e1RM de la séance : pour chaque exercice, la meilleure
// 1RM estimée (e1rm, séries validées dans les bornes de PERF_REPS_MAX_E1RM)
// dépasse la meilleure des séances antérieures. C'est ce que PERSONAL_BEST
// constate : 100 kg × 8 après un meilleur à 100 kg × 5 n'est PAS un record de
// charge (recordsDeSeance ne le voit pas), mais c'est la meilleure
// performance jamais faite sur l'exercice.
function e1rmRecordsDeSeance(sc,anterieures,user){
  // La date de la séance : le poids de corps de ce jour-là (poidsCorpsAu).
  const best=(sets,ex,dt)=>{
    let v=0;
    for(const st of (sets||[])){
      if(!st||st.done!==true) continue;
      const w=chargeEffective(st,ex,user,dt)||0, r=_perfReps(st);
      if(!(w>0)||!(r>0)||!e1rmFiable(r,_perfRir(st,user))) continue;
      let x=0; try{ x=e1rm(w,r,_perfRir(st,user)); }catch(e){ x=0; }
      if(x>v) v=x;
    }
    return v;
  };
  const out=[];
  const data=(sc&&sc.data&&typeof sc.data==='object')?sc.data:{};
  for(const nm of Object.keys(data)){
    const _ex=_exPourCharge(nm,user);
    const cur=best((data[nm]||{}).sets,_ex,sc&&sc.date);
    if(!(cur>0)) continue;
    let hist=0;
    for(const p of (anterieures||[])){
      let d=null; try{ d=_dataDeSeance(p,nm); }catch(e){ d=null; }
      const v=best(d&&d.sets,_ex,p&&p.date); if(v>hist) hist=v;
    }
    if(hist>0&&cur>hist) out.push({nm,avant:Math.round(hist*10)/10,apres:Math.round(cur*10)/10,type:'e1rm'});
  }
  out.sort((a,b)=>(b.apres-b.avant)-(a.apres-a.avant));
  return out;
}
// PURE. Le contexte que les fabricants d'HTML de fin de seance attendent,
// reconstruit depuis une seance ENREGISTREE. C'est ce qui permet de reutiliser
// _htmlRecompenses, _htmlRecordsFin et achievementEngine tels quels, au lieu
// d'ecrire une seconde mise en page qui divergerait de la premiere.
function contexteSeanceRelue(sc,u){
  if(!sc||!sc.date) return null;
  const toutes=listeHistoriqueSeances(u);
  const ant=toutes.filter(x=>x.date<sc.date).sort((a,b)=>a.date-b.date);
  const prec=ant.slice(-8);
  const der=prec.length?prec[prec.length-1]:null;
  const rec=recordsDeSeance(sc,ant);
  let meilleur=null;
  try{
    const data=(sc.data&&typeof sc.data==='object')?sc.data:{};
    const l=Object.keys(data).map(nm=>({nm,
      kg:Math.max(0,...(((data[nm]||{}).sets||[]).map(t=>Number(t&&t.weight)||0)))}))
      .filter(x=>x.kg>0).sort((a,b)=>b.kg-a.kg);
    meilleur=l[0]||null;
  }catch(e){ meilleur=null; }
  const sets=Number(sc.sets)||0, prevus=Number(sc.setsPlanned)||0;
  let e1=[]; try{ e1=e1rmRecordsDeSeance(sc,ant,u); }catch(e){ e1=[]; }
  return {
    records:rec,
    objectif:sc.objectif||null,
    recordsE1rm:e1,
    sets,setsPlanned:prevus,volume:Number(sc.volume)||0,
    volumesPrecedents:prec.map(x=>Number(x&&x.volume)||0),
    // LA SERIE N'EST PAS RECONSTITUEE. On ne sait pas ce qu'elle valait ce
    // jour-la — `streak` est une valeur du dossier, pas de la seance — et
    // inventer un nombre ferait dire a un badge quelque chose de faux. Zero
    // vaut ici « on ne sait pas », et achievementEngine ne pose alors aucun
    // badge de regularite : c'est le comportement juste.
    streak:0,
    joursDepuisDerniere:der&&der.date
      ? Math.max(0,(sc.date-der.date)/864e5) : 0,
    exosAmeliores:rec.length,
    seriesEchouees:Math.max(0,prevus-sets),
    rpe:Number(sc.rpe)||0,
    meilleurExo:meilleur
  };
}
let _seanceRelue=null;
// Le bloc de telechargement de la seance relue. Meme gabarit et memes phrases
// que renderPartageBilan sur l'ecran de fin : le PNG sans fond, l'avertissement
// sur la galerie en mode clair. Deux formulations auraient fini par promettre
// deux choses differentes du meme fichier.
function _rendrePartageSeanceRelue(sc){
  const z=document.getElementById('sd-partage');
  if(!z) return false;
  let d=null;
  try{ d=_bilanDonneesDe(sc); }catch(e){ d=null; }
  // Une seance sans aucune serie validee ne produit pas de visuel : on
  // n'affiche pas un bouton qui repondrait « aucune seance a partager ».
  if(!d){ z.innerHTML=''; return true; }
  try{ _prechaufferMarqueCoach(); }catch(e){}
  const part=(typeof navigator!=='undefined'&&navigator.share)
    ?'<button type="button" class="rcf-share" onclick="partagerSeanceRelue()">'
      +'Partager cette séance</button>':'';
  z.innerHTML=_htmlVisuelFonds('sd-fonds')+_htmlBilanEquivalent()
    +'<button type="button" class="rcf-dl" onclick="telechargerSeanceRelue(this)">'
    +icon('download',18)+'<span>Télécharger cette séance</span></button>'+part
    +'<div class="rcf-note" id="sd-note">'+_visuelNoteFond(visuelFondEffectif())+'</div>';
  // Relu à chaque vignette : la case de l'équivalent fun change la carte.
  monterSelecteurFond('sd-fonds',f=>{ const x=_bilanDonneesDe(sc)||d; return _dessinerBilanSeance(x,f); },'sd-note');
  return true;
}
// Les deux gestes. Ils passent par la seance RETENUE a l'ouverture de l'ecran,
// jamais par la derniere : c'est tout l'objet de l'historique.
function telechargerSeanceRelue(btn){
  const lib='Télécharger cette séance';
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp) sp.textContent='Génération…';
  let ok=false;
  try{ ok=telechargerBilanSeance(_seanceRelue); }catch(e){ ok=false; }
  if(sp) setTimeout(()=>{ _texteIco(sp,ok?'Téléchargé '+ICO.coche:lib);
    if(ok) setTimeout(()=>{ sp.textContent=lib; },2000); },260);
  return ok;
}
function partagerSeanceRelue(){ return partagerBilanSeance(_seanceRelue); }
// Le clic d'une ligne. L'identifiant est celui de la seance — `id` quand elle
// en porte un, sa date sinon : les seances anterieures au champ `id` n'en ont
// pas, et elles doivent rester ouvrables.
function ouvrirSeanceHistorique(cle){
  const sc=listeHistoriqueSeances(currentUser)
    .find(x=>String(x.id||x.date)===String(cle));
  if(!sc){ toast('Séance introuvable','var(--orange)'); return; }
  _seanceRelue=sc;
  let ctx=null;
  try{ ctx=contexteSeanceRelue(sc,currentUser); }catch(e){ ctx=null; }
  let badges=[];
  try{ badges=achievementEngine(ctx||{}); }catch(e){ badges=[]; }
  const pose=(id,html)=>{ try{
    const z=document.getElementById(id); if(z) z.innerHTML=html;
  }catch(e){} };
  // L'ENTETE remplace le hero de fin de seance : « Séance terminée » au passe
  // n'a pas de sens trois semaines apres. Le nom et la date, qui sont ce
  // qu'on cherche en relisant.
  pose('sd-entete','<div class="rcf-hero"><h1 class="rcf-titre">'
    +escapeHtml(String(sc.name||'Séance'))+'</h1>'
    +'<div class="hs-date" style="text-align:center">'
    +escapeHtml(_dateHistorique(sc.date,Date.now()))
    +(sc.complete===false?' · partielle':'')+'</div>'
    +'<div class="rcf-trait" aria-hidden="true"></div></div>');
  // ⚠ LES MEMES MEDAILLONS, MAIS SANS LA MISE EN SCENE. Le faisceau de
  // colonnes et les flaques sous les badges sont des effets de CELEBRATION :
  // ils appartiennent a l'instant ou la seance vient de finir. Trois semaines
  // apres, ils ne celebrent plus rien — et sur cet ecran, ou rien ne les
  // precede, on ne voyait plus que leurs bords : un grand rectangle sous le
  // trait, et un carre d'opacite autour de chaque icone. Signale par Kevin.
  // La classe .sd-sobre les eteint ICI SEULEMENT : l'ecran de fin garde sa
  // fete entiere.
  pose('sd-badges',(()=>{ try{
    return '<div class="sd-sobre">'+_htmlRecompenses(badges,ctx)+'</div>'; }catch(e){ return ''; } })());
  pose('sd-records',(()=>{ try{ return _htmlRecordsFin(ctx,sc.date,'sd'); }catch(e){ return ''; } })());
  pose('sd-stats',(()=>{ try{
    return _htmlStatsFin(Number(sc.duration)||0,Number(sc.sets)||0,
      Number(sc.setsPlanned)||0,Number(sc.volume)||0,0); }catch(e){ return ''; } })());
  pose('sd-objectif',(()=>{ try{ return _htmlProchainObjectif(ctx); }catch(e){ return ''; } })());
  try{ _animerGrimpeur(document.getElementById('sd-objectif')); }catch(e){}
  pose('sd-ressenti',_htmlRessentiRelu(sc));
  pose('sd-exercices',_htmlExercicesRelus(sc));
  _rendrePartageSeanceRelue(sc);
  go('s-seance-detail');
}
// PURE. Le ressenti TEL QU'IL A ETE DONNE. Des valeurs, pas des curseurs :
// cet ecran ne redemande rien. Les libelles viennent de RCF_QUESTIONS, la
// meme table que l'ecran de fin — deux listes auraient fini par nommer
// differemment la meme question.
function _htmlRessentiRelu(sc){
  const m=(sc&&sc.metrics&&typeof sc.metrics==='object')?sc.metrics:null;
  if(!m) return '';
  const l=RCF_QUESTIONS.filter(q=>{
    const v=Number(m[q.id]);
    return Number.isFinite(v)&&v>0;
  });
  if(!l.length) return '';
  return '<div class="rcf-rk-t" style="margin-bottom:8px">Ton ressenti ce jour-là</div>'
    +'<div class="hs-res">'
    +l.map(q=>'<div class="hs-res-c"><div class="hs-res-l">'+escapeHtml(q.lib)+'</div>'
      +'<div class="hs-res-v">'+escapeHtml(String(Math.round(Number(m[q.id]))))
      +'<span style="font-size:var(--fs-xs);color:var(--sub);font-weight:600"> / 10</span>'
      +'</div></div>').join('')
    +'</div>';
}
// PURE. Le detail des exercices, lu par bilanSeanceDonnees — la MEME fonction
// qui alimente le visuel telechargeable. Ce qu'on lit a l'ecran est donc
// exactement ce que le fichier contiendra.
function _htmlExercicesRelus(sc){
  let d=null;
  try{ d=bilanSeanceDonnees(sc,currentUser); }catch(e){ d=null; }
  const ex=(d&&d.ex)||[];
  if(!ex.length) return '';
  const nb=v=>Number(v).toLocaleString('fr-FR');
  return '<div class="rcf-rk"><div class="rcf-rk-t">Ce que tu as fait</div>'
    +ex.map(x=>'<div class="rcf-rk-l">'
      +'<span class="rcf-rk-ex">'+escapeHtml(String(x.nom))+'</span>'
      +'<span class="rcf-rk-v">'+escapeHtml(String(x.series))+' série'
      +(x.series>1?'s':'')
      +(x.kg>0?' · '+nb(x.kg)+' kg':'')
      +(x.reps>0?' × '+nb(x.reps):(x.fourchette?' × '+escapeHtml(x.fourchette):''))
      +'</span></div>').join('')
    +'</div>';
}
function _htmlHeroFin(badges,ctx){
  return '<div class="rcf-hero">'+_htmlFlammeFin()
    +'<h1 class="rcf-titre">Séance terminée</h1>'
    +'<div class="rcf-trait" aria-hidden="true"></div></div>';
}

// ── LES RECOMPENSES ────────────────────────────────────────────────────
//
// ⚠ LES MEDAILLONS SONT EXACTEMENT CEUX DE L'APPLICATION. _htmlBadge et
// BADGE_GLYPHES ne sont pas touches : on ne change que ce qu'il y a AUTOUR —
// la disposition, le halo, l'ordre d'apparition. Un badge redessine pour
// l'occasion aurait fait deux jeux d'icones dans la meme app.
//
// Le badge du milieu monte de 18 px. Pas un podium : une progression. Les
// deux autres restent a la meme hauteur, c'est ce qui distingue les deux.
function _htmlRecompenses(badges,ctx){
  const l=recompensesPrincipales(badges);
  if(!l.length) return '';
  // A une ou deux recompenses, la grille se resserre et se centre : trois
  // colonnes dont une vide laisserait un trou que l'oeil cherche.
  const cls='rcf-rec-g n'+l.length;
  return '<section class="rcf-rec">'
    // Le faisceau est un NOEUD et non un pseudo-element : il lui faut ses
    // deux couches (::before, ::after) ET son propre masque, ce qu'un seul
    // pseudo-element ne peut pas porter.
    +'<div class="rcf-faisceau" aria-hidden="true"></div>'
    +'<div class="'+cls+'">'
    +l.map(b=>'<div class="rcf-case">'
        +'<div class="rcf-case-halo" aria-hidden="true"></div>'
        +_htmlBadge({k:b.k,titre:b.titre,desc:b.desc,icone:b.icone},false,true)
        +'<div class="rcf-nom">'+escapeHtml(b.titre)+'</div>'
        +'<div class="rcf-exp">'+escapeHtml(descRecompense(b,ctx))+'</div>'
      +'</div>').join('')
    +'</div></section>';
}

// ── MES RECORDS ────────────────────────────────────────────────────────
// Present, mais volontairement en retrait : les recompenses au-dessus ont
// deja dit la nouvelle. Aucun record pertinent, aucun bloc — jamais de cadre
// vide.
//
// `date` et `cle` (FACULTATIFS) : la date de la séance, que porteront les
// visuels, et l'écran qui affiche le bloc ('wd' fin de séance, 'sd' séance
// relue). La clé range la liste AFFICHÉE : le bouton « Partager ce record »
// partage exactement la ligne sous le doigt, jamais un recalcul qui aurait pu
// changer d'ordre entre-temps. Sans clé, pas de bouton : le bloc d'avant.
const _recordsAffiches={};
function _htmlRecordsFin(ctx,date,cle){
  // Pendant la grossesse ou l'allaitement, aucun record de charge n'est fêté.
  try{ if(grossesseSuspend(currentUser)) return ''; }catch(e){}
  const rec=((ctx&&ctx.records)||[]).filter(r=>r&&r.nm&&r.curMax>0)
    .slice().sort((a,b)=>(b.gain||0)-(a.gain||0)).slice(0,4)
    // L'objectif de la séance battu : la carte le dira (« OBJECTIF ATTEINT »).
    .map(r=>objectifAtteint(ctx&&ctx.objectif,r)?Object.assign({},r,{objectif:true}):r);
  if(!rec.length) return '';
  const nb=v=>Number(v).toLocaleString('fr-FR');
  const k=(cle==='wd'||cle==='sd')?cle:'';
  if(k) _recordsAffiches[k]={liste:rec,date:date||Date.now()};
  const bouton=(i,lib,cls,aria)=>k?('<button type="button" class="'+cls+'" '
    +(aria?'aria-label="'+escapeHtml(aria)+'" ':'')
    +'onclick="partagerRecord(\''+k+'\','+i+',this)">'+icon('share',14)
    +'<span>'+lib+'</span></button>'):'';
  // LE BOUTON EST AU-DESSUS DE LA LISTE, ET C'EST UN BOUTON. « Partager ce
  // record » était un lien rouge en petites capitales sous chaque ligne, que
  // personne ne prenait pour un geste. Un record : ce bouton le partage.
  // Plusieurs : il les réunit sur un visuel, et chaque ligne garde sa pastille
  // « Partager » — on peut vouloir publier le plus beau des trois.
  // ⚠ PLUS DE PARTAGE ICI (Kevin, 28/09/2026) : « ne mets pas la possibilité
  //   de télécharger l'image, ça sert à rien et ça mange de l'info ». Plus de
  //   choix image / vidéo ni de bouton : chaque record dit ce qu'il est, en
  //   une phrase. Le visuel de la séance, lui, reste à télécharger plus bas.
  //   `bouton` et partagerRecord restent pour les autres écrans qui s'en servent.
  void bouton;
  return '<div class="rcf-rk"><div class="rcf-rk-t">Mes records</div>'
    +rec.map((r,i)=>'<div class="rcf-rk-l">'
      +'<span class="rcf-rk-ex">'+escapeHtml(String(r.nm))+'</span>'
      +(r.type==='reps'
        ?'<span class="rcf-rk-v"><span class="rcf-rk-a">'+nb(r.repsAvant)+' → </span>'+nb(r.reps)+' reps<span class="rcf-rk-g">'+nb(_kgAff(r.curMax))+_uniteTxt(r.nm)+'</span></span>'
        :'<span class="rcf-rk-v"><span class="rcf-rk-a">'+nb(_kgAff(r.histMax))+' → </span>'
        +nb(_kgAff(r.curMax))+_uniteTxt(r.nm)+'<span class="rcf-rk-g">'+(r.assiste?'−':'+')+nb(_kgAff(r.gain))+'</span></span>')
      // LA PETITE ANIMATION DU RECORD : une barre qui part de l'ancienne
      // charge (en gris) et monte jusqu'à la nouvelle (en rouge), une fois.
      +'<div class="rcf-rk-barre" aria-hidden="true" style="--avant:'
        +Math.max(5,Math.min(98,Math.round((r.type==='reps'?Number(r.repsAvant)/Number(r.reps):r.assiste?Number(r.curMax)/Number(r.histMax):Number(r.histMax)/Number(r.curMax))*100)))+'%">'
        +'<i class="rcf-rk-ancien"></i><i class="rcf-rk-nouveau"></i></div>'
      +'<div class="rcf-rk-x">'+(r.type==='reps'
        ?'Record de répétitions : '+nb(r.reps)+' à '+nb(_kgAff(r.curMax))+' '+_unite()+', '+nb(r.reps-r.repsAvant)+' de plus que ton meilleur à cette charge ('+nb(r.repsAvant)+').'
        :r.assiste?'Moins d’assistance que jamais : '+nb(_kgAff(r.curMax))+' '+_unite()+', soit '+nb(_kgAff(r.gain))+' '+_unite()+' de moins qu’avant ('+nb(_kgAff(r.histMax))+' '+_unite()+').'
        :'Nouvelle meilleure charge sur cet exercice : '+nb(_kgAff(r.curMax))
        +' '+_unite()+', soit '+nb(_kgAff(r.gain))+' '+_unite()+' de plus que ton meilleur jusqu’ici ('+nb(_kgAff(r.histMax))+' '+_unite()+').')+'</div>'
      +'</div>').join('')
    +'</div>';
}
// Les données d'un visuel de record, lues dans la liste AFFICHÉE. `i` = -1 :
// le récapitulatif de tous les records.
function _recordVisuelDonnees(cle,i){
  const a=_recordsAffiches[cle];
  if(!a||!a.liste||!a.liste.length) return null;
  let sig='';
  try{ sig=nomSurVisuels(currentUser); }catch(e){ sig=''; }
  if(i<0) return a.liste.length>1?{records:a.liste,date:a.date,signature:sig}:null;
  const r=a.liste[i];
  return r?Object.assign({},r,{date:a.date,signature:sig}):null;
}
function _recordDessiner(d,i,fond){
  return i<0?_dessinerCarteRecords(d,fond):_dessinerCarteRecord(d,fond);
}
// LE GESTE : le partage natif d'abord, le téléchargement s'il n'existe pas —
// l'athlète repart toujours avec son image. Les deux sorties copient le lien
// perso (_storyCopierLien). Tout est SYNCHRONE jusqu'au partage : le moindre
// await consommerait le geste, et iOS refuserait la feuille.
// Le fichier : repcore-record.png sans fond, .jpg avec (visuelNomFichier).
function partagerRecord(cle,i,btn){
  if(_storyEnCours) return false;
  const d=_recordVisuelDonnees(cle,Number(i));
  if(!d){ toast('Aucun record à partager.','var(--orange)'); return false; }
  // « Vidéo » choisi : la foudre et le compteur, enregistrés (exporterVideoVisuel).
  if(visuelMediaChoisi()==='video') return partagerVideo(videoScene('record',{donnees:d,fond:visuelFondEffectif()}));
  _storyEnCours=true;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier(i<0?'repcore-records':'repcore-record',fond);
  let ok=false;
  try{
    ok=_storySortirPartage(_recordDessiner(d,i,fond),nom,undefined,fmt)
      // Le canevas est vidé par la première sortie : on le redessine.
      ||_storySortirTelechargement(_recordDessiner(d,i,fond),nom,fmt);
  }catch(e){
    toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)');
    ok=false;
  }finally{ _storyEnCours=false; }
  // Le bouton dit que c'est fait, puis reprend son libellé.
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){
    const lib=sp.textContent;
    _texteIco(sp,'Visuel prêt '+ICO.coche);
    setTimeout(()=>{ sp.textContent=lib; },2000);
  }
  return ok;
}

// ── LA BANDE STATISTIQUE ───────────────────────────────────────────────
// Un seul bloc, trois zones. Trois cartes separees auraient fait trois objets
// concurrents la ou il n'y a qu'une seule information : la seance.
//
// Le delta de volume s'y rattache au lieu de vivre dans un bloc a lui. Il ne
// sort QUE s'il est positif : juste apres un accomplissement, un « -3 557 kg »
// ne renseigne personne, il abime la nouvelle. Il reste entier dans le suivi.
function _htmlStatsFin(mins,sets,setsPlanned,vol,delta){
  const nb=v=>Number(Math.round(v)).toLocaleString('fr-FR');
  const d=Number(delta)||0;
  const partielle=Number(setsPlanned)>0&&Number(sets)<Number(setsPlanned);
  // ⚠ L'IDENTIFIANT PORTE LE NOMBRE SEUL, jamais l'unite. arcChiffre ecrit en
  // `textContent` : une unite placee dans le meme noeud serait effacee des la
  // premiere frame, et y glisser du balisage l'aurait affiche tel quel.
  // `apres` : une ligne sous le libellé — l'équivalent fun du volume.
  const zone=(v,u,l,id,apres)=>'<div class="rcf-st"><div class="rcf-st-v">'
    +'<span'+(id?' id="'+id+'"':'')+'>'+v+'</span>'
    +(u?'<span class="rcf-st-u">'+u+'</span>':'')+'</div>'
    +'<div class="rcf-st-l">'+l+'</div>'+(apres||'')+'</div>';
  // « = 2 éléphants 🐘 », sous le VOLUME. Rien sous 2 kg.
  let _eq=null; try{ _eq=equivalentTonnage(vol); }catch(e){ _eq=null; }
  const _eqHtml=_eq?('<div class="rcf-st-eq">= '+escapeHtml(_eq.texte)+' <span aria-hidden="true">'+_eq.emoji+'</span></div>'
    +_htmlRouteEquivalent(_eq)):'';
  // La duree ne se compte PAS : « 3 h 25 » n'a pas de trajectoire depuis zero,
  // et la faire defiler en « 0 h 01, 0 h 02 » serait absurde. Les deux autres,
  // si — ce sont des quantites, et les voir monter est la recompense.
  return '<div class="rcf-stats">'
    +zone(escapeHtml(fmtDureeHeures(mins)),'','Durée')
    // ⚠ « 5 / 12 » QUAND LA SEANCE EST PARTIELLE. Afficher « 5 » seul ferait
    // passer une seance ecourtee pour une seance complete — c'est precisement
    // ce que fmtSeries corrigeait, et on ne le perd pas. Complete, le total
    // n'apprend rien : on rend le nombre nu, qui se compte joliment.
    +zone(partielle?(nb(sets)+' / '+nb(setsPlanned)):nb(sets),'','Séries','rcf-st-series')
    +zone(nb(vol),' kg','Volume','rcf-st-vol',_eqHtml)
    +'</div>'
    +(d>0?'<div class="rcf-delta"><span class="rcf-delta-v">+'+nb(d)+' kg</span>'
      +'<span class="rcf-delta-l">vs dernière séance</span></div>':'');
}

// ── LE PETIT BUS QUI PASSE (Kevin, 28/09/2026) ─────────────────────────
// Sous « = 1,1 bus », une route en pointillés et le véhicule qui la traverse,
// en boucle. Le bus est DESSINÉ, au trait, dans la palette de l'écran (blanc,
// vitres rouges) : un emoji qui glisse ferait jouet. Les autres équivalents
// (éléphant, T-Rex…) font passer leur emoji, plus petit. Immobile, garé au
// milieu, quand le téléphone demande moins d'animations.
function _htmlBusSvg(){
  return '<svg viewBox="0 0 34 16" width="34" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">'
    +'<path d="M2 12V4.5C2 3.1 3.1 2 4.5 2H27c2.2 0 3.6 1.3 4.3 3.4L32 8.5V12H2Z"/>'
    +'<path class="rcf-bus-vitres" stroke="none" d="M5 4.5h4.2v3.4H5zM10.6 4.5h4.2v3.4h-4.2zM16.2 4.5h4.2v3.4h-4.2zM21.8 4.5h4.4v3.4h-4.4zM27.5 4.5h1.6l1.3 3.4h-2.9z"/>'
    +'<path d="M2 9.6h30" stroke-width="1"/>'
    +'<circle cx="8.5" cy="12.6" r="2" fill="#0b0b0c"/><circle cx="25.5" cy="12.6" r="2" fill="#0b0b0c"/>'
    +'</svg>';
}
function _htmlRouteEquivalent(eq){
  if(!eq) return '';
  const bus=eq.emoji==='🚌';
  return '<div class="rcf-route" aria-hidden="true"><span class="rcf-vehicule'+(bus?' rcf-bus':'')+'">'
    +(bus?_htmlBusSvg():eq.emoji)+'</span></div>';
}

// ── TON PROCHAIN OBJECTIF : UNE ASCENSION ──────────────────────────────
// Une barre de progression dit « 72 % ». Des marches disent « tu es la, et il
// reste une marche ». C'est la meme donnee, et ce n'est pas le meme message.
// ── LE GRIMPEUR ────────────────────────────────────────────────────────
// Une silhouette au trait, en pleine traction sur le rebord : un bras tendu
// vers le haut, l'autre replie, une jambe qui pousse. Six traits, pas un de
// plus — au-dela on entre dans le dessin anime, et la regle du produit
// l'interdit.
// Le blanc porte la lisibilite, le rouge la halo : la meme repartition que
// partout ailleurs sur cet ecran.
function _htmlGrimpeur(){
  return '<svg viewBox="0 0 26 34" fill="currentColor" stroke="currentColor" '
    +'stroke-linecap="round" stroke-linejoin="round">'
    // La tete, petite : c'est elle qui donne l'echelle du reste. Une tete
    // large et tout le corps parait court.
    +'<circle cx="12.6" cy="4.9" r="2.6" stroke="none"/>'
    // LE TORSE EN V, et c'est lui qui fait tout le travail. Epaules a 10,4
    // unites, taille a 3,4 : trois pour un. En dessous de ce rapport la
    // silhouette redevient un bonhomme batons epaissi.
    +'<path stroke="none" d="M7.4 10.4C8.4 8.9 10.4 8.3 12.6 8.3s4.2.6 5.2 2.1'
    +'c-.6 2-1.6 3.2-2.4 4.4-.7 1.1-1 2.4-1.1 3.8h-3.4c-.1-1.4-.4-2.7-1.1-3.8'
    +'-.8-1.2-1.8-2.4-2.4-4.4z"/>'
    // Les deltoides : deux ellipses posees aux pointes d'epaule. Sans elles le
    // bras part du torse comme une branche, et la carrure disparait.
    +'<ellipse stroke="none" cx="17.5" cy="10.3" rx="2" ry="1.7" transform="rotate(-18 17.5 10.3)"/>'
    +'<ellipse stroke="none" cx="7.7" cy="10.6" rx="1.9" ry="1.65" transform="rotate(18 7.7 10.6)"/>'
    // Les bras restent des traits — c'est le RENFLEMENT du biceps qui donne le
    // muscle, pas l'epaisseur du trait. Un trait epais fait un tuyau.
    +'<path fill="none" stroke-width="2.4" d="M18.1 10.6 20.7 8.2 22.1 3.9"/>'
    +'<path fill="none" stroke-width="2.3" d="M7.3 11.4 5 13.8 3.4 16.9"/>'
    +'<ellipse stroke="none" cx="19.4" cy="9.3" rx="1.85" ry="1.4" transform="rotate(-38 19.4 9.3)"/>'
    +'<ellipse stroke="none" cx="6.2" cy="12.6" rx="1.6" ry="1.25" transform="rotate(44 6.2 12.6)"/>'
    // Les jambes partent de la taille, PAS des hanches larges : ecartees, elles
    // rempliraient le V et l\'annuleraient.
    +'<path fill="none" stroke-width="2.9" d="M13.8 18.8 16.2 24.4 15.7 30.3"/>'
    +'<path fill="none" stroke-width="2.8" d="M11.4 18.8 8.4 23.6 9.5 30.1"/>'
    +'<ellipse stroke="none" cx="15.2" cy="21.4" rx="1.95" ry="1.5" transform="rotate(-24 15.2 21.4)"/>'
    +'<ellipse stroke="none" cx="9.8" cy="21.1" rx="1.85" ry="1.45" transform="rotate(28 9.8 21.1)"/>'
    +'</svg>';
}
function _htmlProchainObjectif(ctx){
  const a=ascensionPaliers(ctx);
  if(!a) return '';
  const nb=v=>Number(v).toLocaleString('fr-FR');
  // Les hauteurs montent regulierement : la derniere marche est la plus haute,
  // et c'est elle qu'on vise.
  const n=a.marches.length;
  return '<section class="rcf-sect"><div class="rcf-asc">'
    // Le bandeau, comme « Mes records » : les deux blocs se repondent.
    +'<div class="rcf-asc-t">Ton prochain objectif</div>'
    +'<div class="rcf-asc-c">'
    +'<div class="rcf-asc-ex">'+escapeHtml(String(a.exercice||'').toUpperCase())+'</div>'
    +'<div class="rcf-marches">'
    +a.marches.map((m,i)=>{
        const h=Math.round(34+(i/(n-1))*58);
        const c='rcf-m'+(m.but?' but':(m.ici?' ici':(m.pris?' pris':'')));
        // ⚠ LE GRIMPEUR N'EST PLUS DANS LA MARCHE. Il y etait pose, et il ne
        // pouvait donc que s'y poser : une marche ne peut pas contenir un
        // deplacement qui la traverse. Il vit desormais dans la volee entiere
        // — voir plus bas — et c'est ce qui lui permet de MONTER au lieu
        // d'arriver.
        const grimpeur='';
        // Le fanion plante sur le palier vise : on voit ou l'on va.
        const fanion=m.but
          ? ('<div class="rcf-fanion" style="bottom:'+(h+1)+'px" aria-hidden="true">'
             +'<svg viewBox="0 0 16 22" fill="none" stroke="currentColor" stroke-width="1.8" '
             +'stroke-linecap="round" stroke-linejoin="round">'
             +'<path d="M4 21V2"/><path d="M4 3.2h9.2l-2.6 3.4 2.6 3.4H4"/></svg></div>')
          : '';
        return '<div class="'+c+'" data-h="'+h+'">'
          +'<div class="rcf-m-kg">'+nb(m.kg)+'</div>'
          +grimpeur+fanion
          +'<div class="rcf-m-bloc" style="height:'+h+'px"></div></div>';
      }).join('')
    // ⚠ SA PLACE DE REPOS EST POSEE ICI, EN DUR, et c'est elle qui fait foi.
    // L'animation ne fait que l'amener jusqu'a elle : ses images-cles sont des
    // ECARTS par rapport a ce point, et la derniere est l'identite. Trois
    // consequences, toutes voulues : sans JavaScript il est deja au bon
    // endroit, sous « animations reduites » il y est pose sans rien jouer, et
    // un echec du calcul ne le laisse jamais en bas a gauche.
    +(()=>{
        const iIci=a.marches.findIndex(m=>m.ici);
        if(iIci<0) return '';
        const hIci=Math.round(34+(iIci/(n-1))*58);
        // 76 % de sa marche : le bord qui fait face au palier suivant. Les
        // ecarts de 5 px entre marches sont ignores — un demi-pixel sur un
        // bonhomme de 18, et le calcul exact se fait de toute facon au
        // navigateur quand l'animation part.
        return '<div class="rcf-grimpeur" aria-hidden="true" data-ici="'+iIci+'" '
          +'style="left:'+(((iIci+0.76)/n)*100).toFixed(3)+'%;bottom:'+(hIci+1)+'px">'
          +_htmlGrimpeur()+'</div>';
      })()
    +'</div>'
    +'<div class="rcf-asc-n">Tu es à <b>'+nb(a.actuel)+' kg</b>. Encore '
      +escapeHtml(String(a.reste).replace('.',','))+' kg pour la prochaine marche.</div>'
    +'</div></div></section>';
}

// ── L'ASCENSION DU GRIMPEUR ────────────────────────────────────────────
//
// IL MONTE, IL NE SAUTE PAS. La difference tient a une chose : chaque marche
// lui coute quelque chose de different, et ca se voit. En bas il enchaine,
// leger et rapide. A mi-hauteur il se plie plus bas, il met plus de temps, et
// il souffle une fois arrive. Sur la DERNIERE — celle du jour, celle qui
// reste a prendre — il n'y arrive pas du premier coup : saut trop court,
// prise du bout des doigts, glissade, suspension, second elan, traction lente
// qui tremble. Sept temps la ou une montee ordinaire en fait cinq.
//
// Puis il ne se repose pas : il regarde deja la marche d'apres. C'est
// l'obsession, et elle est une BOUCLE — la seule du bloc, et elle est
// minuscule (six pixels au plus) parce qu'une agitation ferait un jouet.
//
// ⚠ TOUT EST EXPRIME EN ECARTS par rapport a la place de repos posee par le
// gabarit, et la derniere image est l'identite. Consequence : rien a defaire
// si le calcul echoue, et « animations reduites » le laisse simplement pose.

// PURE. ec[i] = l'ecart en pixels de la marche i par rapport a la place de
// repos ; ec[iIci] vaut {0,0}. Rend les images-cles et leur duree totale.
function _grimpeurChemin(ec,iIci){
  const A=[]; let t=0;
  const poser=(ms,p)=>{ t+=ms;
    A.push({t:t,x:p.x||0,y:p.y||0,r:p.r||0,sx:p.sx||1,sy:p.sy||1,
      o:(p.o==null?1:p.o),e:p.e||'ease-in-out'}); };
  const a0=ec[0]||{x:0,y:0};
  // L'entree : il vient du sol, un peu en arriere. Il n'apparait pas — il
  // arrive, et c'est ce qui fait qu'on le suit des le depart.
  A.push({t:0,x:a0.x-15,y:a0.y+11,r:-13,sx:1.02,sy:.93,o:0,
    e:'cubic-bezier(.2,.8,.3,1)'});
  poser(300,{x:a0.x-3,y:a0.y+1.5,r:-3,e:'cubic-bezier(.3,.9,.4,1)'});
  poser(170,{x:a0.x,y:a0.y,r:0});
  for(let i=1;i<=iIci;i++){
    const a=ec[i-1],b=ec[i],dx=b.x-a.x,dernier=(i===iIci);
    // LA FATIGUE EST UN PARAMETRE, pas une decoration : p va de 0 en bas a 1
    // en haut et pilote la cadence, la profondeur de la flexion et le repos.
    const p=(iIci>1)?((i-1)/(iIci-1)):1;
    if(!dernier){
      const lent=1+p*0.95;              // il ralentit a mesure qu'il monte
      const flex=3+p*3.4;               // et il se plie de plus en plus bas
      // Flexion — detente au-dessus du rebord — prise sous l'arete —
      // retablissement avec le leger depassement qui rend le geste vivant.
      poser(Math.round(105*lent),{x:a.x,y:a.y+flex,r:(dx>0?2:-2),
        sx:1.05+p*.05,sy:.88-p*.07,e:'cubic-bezier(.4,0,.6,1)'});
      poser(Math.round(140*lent),{x:a.x+dx*0.58,y:b.y-(8-p*3),r:-13+p*4,
        sx:.95,sy:1.07,e:'cubic-bezier(.3,.1,.6,1)'});
      poser(Math.round(105*lent),{x:b.x-1.6,y:b.y+(4.5+p*2.5),r:-9+p*2,
        sx:.99,sy:1.03,e:'cubic-bezier(.2,.7,.4,1)'});
      poser(Math.round(150*lent),{x:b.x,y:b.y-2.6,r:2.5,sx:1.02,sy:1.03,
        e:'cubic-bezier(.25,.9,.35,1)'});
      poser(Math.round(95*lent),{x:b.x,y:b.y,r:0});
      // A mi-hauteur il souffle. C'est le SEUL endroit ou il s'arrete, et
      // c'est ce qui rend la galere de la fin credible : sans ce repos, la
      // derniere marche n'est qu'une animation plus longue.
      if(p>0.30&&p<0.80){
        poser(230,{x:b.x,y:b.y+1.4,sx:1.02,sy:.97});
        poser(250,{x:b.x,y:b.y});
      }
    }else{
      // ── LA DERNIERE MARCHE : CELLE QUI COUTE ──────────────────────────
      poser(240,{x:a.x,y:a.y+7,r:-1,sx:1.11,sy:.79,e:'cubic-bezier(.4,0,.6,1)'});
      // Le saut est TROP COURT : il finit sous le rebord, pas dessus.
      poser(200,{x:a.x+dx*0.72,y:b.y+9,r:-17,sx:.94,sy:1.08,
        e:'cubic-bezier(.3,.1,.7,1)'});
      poser(120,{x:b.x-2.2,y:b.y+6.5,r:-12,sx:.99,sy:1.04,
        e:'cubic-bezier(.3,.6,.5,1)'});
      // Il glisse. Une acceleration vers le bas, pas un retour amorti.
      poser(190,{x:b.x-2.8,y:b.y+13,r:-17,sx:.97,sy:.97,
        e:'cubic-bezier(.5,0,.8,.6)'});
      poser(270,{x:b.x-4.2,y:b.y+12.2,r:-20,sx:.98,sy:1.02});   // suspendu, il balance
      poser(210,{x:b.x-1.2,y:b.y+13.8,r:-9,sx:1.03,sy:.93,
        e:'cubic-bezier(.4,0,.6,1)'});                          // il ramasse son elan
      poser(430,{x:b.x,y:b.y+2.4,r:-5,sx:.98,sy:1.06,
        e:'cubic-bezier(.34,.04,.5,1)'});                       // traction, lente
      poser(115,{x:b.x+.5,y:b.y+3.6,r:-8,sy:1.01});             // et elle tremble
      poser(115,{x:b.x-.4,y:b.y+1.3,r:-2,sy:1.04});
      poser(300,{x:b.x,y:b.y-3.2,r:3.5,sx:1.02,sy:1.05,
        e:'cubic-bezier(.25,.9,.35,1)'});                       // il passe
      poser(210,{x:b.x,y:b.y,r:0});
    }
  }
  const D=Math.max(t,1);
  // translateX(-50%) EN PREMIER : c'est le centrage de la feuille de style,
  // et la derniere image doit lui etre identique au pixel pres.
  return {duree:D,images:A.map(k=>({
    offset:Math.max(0,Math.min(1,k.t/D)),
    opacity:k.o,
    transform:'translateX(-50%) translate('+k.x.toFixed(2)+'px,'+k.y.toFixed(2)+'px)'
      +' rotate('+k.r.toFixed(2)+'deg) scale('+k.sx.toFixed(3)+','+k.sy.toFixed(3)+')',
    easing:k.e
  }))};
}

// L'OBSESSION. Il est arrive, et il ne redescend pas d'un cran : il se penche
// vers le fanion, tend le bras, se reprend, recommence. Jamais plus de cinq
// pixels — c'est une tension, pas un gigotement.
function _grimpeurObsession(g){
  const B='translateX(-50%) ';
  const i=(x,y,r,sx,sy)=>B+'translate('+x+'px,'+y+'px) rotate('+r+'deg) scale('+sx+','+sy+')';
  return _animer(g,[
    {offset:0,   transform:i(0,0,0,1,1),               easing:'ease-in-out'},
    {offset:.16, transform:i(2.6,-1.2,5,1,1.02),       easing:'ease-in-out'},
    {offset:.30, transform:i(4.6,-2.4,8,.99,1.035),    easing:'cubic-bezier(.4,0,.6,1)'},
    {offset:.42, transform:i(2,.6,3,1.02,.98),         easing:'ease-in-out'},
    {offset:.54, transform:i(-1.4,1.2,-3,1.02,.97),    easing:'cubic-bezier(.3,.1,.6,1)'},
    {offset:.66, transform:i(1.2,-3.4,6,.98,1.05),     easing:'cubic-bezier(.3,.7,.4,1)'},
    {offset:.78, transform:i(3.4,-.8,4,1,1.01),        easing:'ease-in-out'},
    {offset:.90, transform:i(.6,.9,-1.5,1.01,.985),    easing:'ease-in-out'},
    {offset:1,   transform:i(0,0,0,1,1)}
  ],{duration:3600,iterations:Infinity,easing:'linear'});
}

// UN SEUL GRIMPEUR VIVANT A LA FOIS : l'ecran de fin et l'ecran d'historique
// dessinent le meme bloc, et l'obsession est infinie — sans ce garde, une
// relecture d'historique laisserait tourner l'animation du bloc precedent.
let _grimpeurAnims=[];
function _animerGrimpeur(hote){
  try{ _grimpeurAnims.forEach(a=>{ try{ a.cancel(); }catch(e){} }); }catch(e){}
  _grimpeurAnims=[];
  const racine=hote||document;
  if(!racine||!racine.querySelector) return;
  const g=racine.querySelector('.rcf-grimpeur');
  if(!g) return;
  const lancer=()=>{
    try{
      const zone=g.parentNode; if(!zone||!zone.querySelectorAll) return;
      const iIci=parseInt(g.getAttribute('data-ici'),10);
      const blocs=[].slice.call(zone.querySelectorAll('.rcf-m .rcf-m-bloc'));
      if(!blocs.length||!(iIci>=0)||iIci>=blocs.length) return;
      const r=blocs.map(x=>x.getBoundingClientRect());
      // L'ECRAN N'EST PEUT-ETRE PAS ENCORE AFFICHE. Sans largeur il n'y a pas
      // de chemin a calculer, et le grimpeur reste pose sur sa marche : c'est
      // un repli correct, pas une panne.
      if(!(r[iIci].width>0)) return;
      const ax=r[iIci].left+r[iIci].width*0.76, ay=r[iIci].top;
      // 76 % du bloc : le bord qui fait face au palier suivant, le meme que
      // celui du gabarit. On RAMENE tout a zero sur la marche d'arrivee pour
      // que la derniere image soit exactement la place de repos — les
      // quelques pixels d'ecart entre le pourcentage du gabarit et la mesure
      // reelle se reportent uniformement sur le chemin, ou ils ne se voient
      // pas.
      const ec=r.map(x=>({x:(x.left+x.width*0.76)-ax, y:x.top-ay}));
      const c=_grimpeurChemin(ec,iIci);
      // Le retard laisse les marches finir de se dresser : il ne peut pas
      // escalader ce qui n'est pas encore sorti du sol.
      const a=_animer(g,c.images,{duration:c.duree,delay:1500,fill:'both',
        easing:'linear'});
      if(!a) return;                // animations reduites : il est deja en place
      _grimpeurAnims=[a];
      // L'ascension reste dans la liste : elle REMPLIT jusqu'a la fin (sa
      // derniere image est la place de repos), et une relecture doit pouvoir
      // annuler les deux d'un coup.
      a.onfinish=()=>{ const o=_grimpeurObsession(g); if(o) _grimpeurAnims=[a,o]; };
    }catch(e){}
  };
  // DEUX TRAMES. Le bloc vient d'etre ecrit et l'ecran qui le porte n'est pas
  // encore affiche quand on nous appelle : mesurer tout de suite donnerait
  // zero partout.
  try{ requestAnimationFrame(()=>requestAnimationFrame(lancer)); }catch(e){ lancer(); }
}

// ── LE RESSENTI ────────────────────────────────────────────────────────
//
// QUATRE QUESTIONS, et rien d'autre. Les pas et le sommeil sont deja suivis
// par l'ecran Sante : les redemander ici, apres une seance, c'etait un
// formulaire de plus au moment ou l'on a le moins envie d'en remplir un.
//
// ⚠ LES IDENTIFIANTS NE CHANGENT PAS. ps-fatigue, ps-sensation, ps-energie et
// ps-motivation sont ceux que savePostSession lit et que renderFormeSeance
// ecoute. Seule l'apparence change — dix pastilles au lieu d'un curseur, parce
// qu'on vise une valeur du pouce au lieu de faire glisser. La valeur reste
// dans un <input type=range> CACHE : c'est lui qui porte la donnee, et rien
// en aval n'a a savoir comment on l'a saisie.
//
// ⚠ ET « ENERGIE » CHANGE DE SENS : le libelle passe de « en dehors des
// seances » a « durant la seance ». C'est demande, et c'est note ici parce
// que energieZ compare chaque seance a la moyenne des precedentes : le temps
// que la fenetre se renouvelle, la base melange les deux questions. Le modele
// se recentre tout seul ensuite — aucune donnee n'est perdue ni reecrite.
const RCF_QUESTIONS=Object.freeze([
  {id:'fatigue',   lib:'Fatigue post-séance',    forme:true},
  {id:'sensation', lib:'Ressenti',               forme:true},
  {id:'energie',   lib:'Énergie durant la séance',forme:false},
  {id:'motivation',lib:'Motivation',             forme:true},
  // ⚠ LES DEUX SUIVANTES SONT REPLIEES, PAS SUPPRIMEES. « Plus de détails »
  // doit ouvrir quelque chose : sans elles le bouton ne faisait plus rien, et
  // savePostSession lisait deux champs absents des que le detail etait ouvert.
  // Elles ne sont ecrites QUE si l'athlete a deplie — un 5 pose par defaut
  // ressemblerait a une reponse alors que personne n'a rien repondu.
  {id:'satisfaction',lib:'Satisfaction',         forme:false,detail:true},
  {id:'hydratation', lib:'Hydratation',          forme:false,detail:true}
]);
// R12 — LES DEUX BOUTS DE CHAQUE ECHELLE. Verifie dans le code avant d'etre
// ecrit : les boutons vont de 1 a 10, de gauche a droite, et l'orientation des
// valeurs ne change pas. La FATIGUE est la seule echelle a l'envers — _contribForme
// l'inverse par FORME_MAX − f — donc 1 = « en forme », 10 = « épuisé ». Pour les
// cinq autres, 10 est le meilleur.
const RCF_ANCRES=Object.freeze({
  fatigue:['en forme','épuisé'],
  sensation:['rien senti','excellente'],
  energie:['à plat','pleine énergie'],
  motivation:['aucune','à fond'],
  satisfaction:['déçu','très satisfait'],
  hydratation:['peu bu','bien hydraté']
});
// Le mot pour le coach, en fin de seance : 280 caracteres (regle RTDB comprise).
const NOTE_SEANCE_MAX=280;
function _htmlRessentiFin(){
  const q=o=>{
    const suite=o.forme?'renderFormeSeance();':'';
    // .ps-detail-item est la classe que togglePsDetail pilote depuis toujours :
    // on la reutilise telle quelle plutot que d'inventer un second mecanisme.
    return '<div class="rcf-q'+(o.detail?' ps-detail-item':'')+'"'
      +(o.detail?' style="display:none"':'')+'>'
      +'<div class="rcf-q-l"><span class="rcf-q-n">'+escapeHtml(o.lib)+'</span>'
        +'<span class="rcf-q-v" id="ps-'+o.id+'-val">5</span></div>'
      +'<div class="rcf-ech" role="group" aria-label="'+escapeHtml(o.lib)+' sur 10">'
      +Array.from({length:10},(_,i)=>{
          const v=i+1;
          // ⚠ LE CHIFFRE EST DANS LE BOUTON, PAS SEULEMENT DANS SON aria-label.
          // Une commande sans un caractere est une zone cliquable invisible —
          // c'est une regle de cette application, et une assertion la tient.
          // Ici le chiffre sert deux fois : il rend le bouton visible, et il dit
          // ou l'on vise sur l'echelle au lieu de le faire deviner.
          return '<button type="button" class="rcf-p'+(v===5?' on':'')+'" data-v="'+v+'"'
            +' aria-label="'+v+' sur 10" onclick="rcfNoter(\''+o.id+'\','+v+')">'+v+'</button>';
        }).join('')
      +'</div>'
      // R12 — l'ancrage, sous l'echelle : ce que veut dire 1, ce que veut dire 10.
      +(RCF_ANCRES[o.id]?'<div class="rcf-ancre" aria-hidden="true"><span>'+escapeHtml(RCF_ANCRES[o.id][0])
        +'</span><span>'+escapeHtml(RCF_ANCRES[o.id][1])+'</span></div>':'')
      // Le porteur de la donnee. Cache, mais c'est bien lui que tout le reste
      // de l'application lit et ecrit.
      +'<input type="range" id="ps-'+o.id+'" min="0" max="10" value="5" hidden'
      +' oninput="'+suite+'">'
      +'</div>';
  };
  return '<div class="rcf-fb">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">'
      +'<span class="rcf-fb-t">Comment tu te sens ?</span>'
      +'<button type="button" class="rcf-fb-plus" id="ps-detail-btn" '
        +'onclick="togglePsDetail()">Plus de détails</button></div>'
    +RCF_QUESTIONS.map(q).join('')
    // LE MOT POUR LE COACH (30/09/2026) : facultatif, 280 caracteres, range
    // dans la seance (sess.noteAthlete) et lu dans son detail cote coach.
    +'<label class="rcf-note-l" for="ps-note">Un mot pour ton coach ?</label>'
    +'<textarea id="ps-note" class="rcf-note" maxlength="'+NOTE_SEANCE_MAX+'" rows="2" '
      +'placeholder="Facultatif : une sensation, un réglage, une question…"></textarea>'
    +'</div>';
}
// Poser une note : la pastille, le chiffre, et l'input qui porte la valeur.
// L'evenement `input` est declenche a la main — une ecriture par script n'en
// emet pas, et renderFormeSeance ne serait jamais rappelee.
function rcfNoter(id,v){
  const inp=document.getElementById('ps-'+id);
  if(inp){
    inp.value=String(v);
    try{ inp.dispatchEvent(new Event('input',{bubbles:true})); }catch(e){}
  }
  const val=document.getElementById('ps-'+id+'-val');
  if(val) val.textContent=String(v);
  const zone=inp&&inp.parentNode?inp.parentNode.querySelector('.rcf-ech'):null;
  if(zone) zone.querySelectorAll('.rcf-p').forEach(b=>{
    b.classList.toggle('on',Number(b.dataset.v)===Number(v));
  });
  try{ arcHaptique&&arcHaptique('legere'); }catch(e){}
}
// Remise a 5 entre deux seances. Meme raison qu'avant : une valeur heritee de
// la seance precedente passerait pour une reponse.
function rcfReinitRessenti(){
  RCF_QUESTIONS.forEach(o=>{ try{ rcfNoter(o.id,5); }catch(e){} });
  // Le mot de la seance precedente ne se recopie pas sur la suivante.
  try{ const n=document.getElementById('ps-note'); if(n) n.value=''; }catch(e){}
}
// LE RESSENTI EST POSE AU DEMARRAGE, pas seulement en fin de seance.
//
// ⚠ IL ETAIT RENDU UNIQUEMENT PAR finishWorkout, et c'etait une faute : tant
// qu'aucune seance n'etait terminee, #wd-ressenti restait vide, savePostSession
// ne trouvait aucun champ, et le banc d'essai — qui lit le document tel qu'il
// se charge — ne voyait pas un seul curseur. Le rendre ici le rend vrai a tout
// instant ; finishWorkout ne fait plus que remettre les notes a 5.
function rcfPoserRessenti(){
  try{
    const z=document.getElementById('wd-ressenti');
    if(!z||z.firstChild) return false;
    z.innerHTML=_htmlRessentiFin();
    return true;
  }catch(e){ return false; }
}
// ── LES COMPTEURS ──────────────────────────────────────────────────────
// Rapides : 600 ms. Un compteur qui fait attendre n'est plus une recompense.
// Sous « animations reduites », la valeur est posee d'emblee.
function _compterVers(el,fin,suffixe,duree){
  if(!el) return;
  const reduit=(()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } })();
  const fmt=v=>Number(Math.round(v)).toLocaleString('fr-FR')+(suffixe||'');
  if(reduit||!(fin>0)){ el.textContent=fmt(fin); return; }
  const t0=Date.now(),d=duree||600;
  const pas=()=>{
    const k=Math.min(1,(Date.now()-t0)/d);
    // Sortie douce : la valeur finale se pose au lieu de s'arreter net.
    el.textContent=fmt(fin*(1-Math.pow(1-k,3)));
    if(k<1) requestAnimationFrame(pas);
  };
  requestAnimationFrame(pas);
}
function buildSessionComparison(vol,data){
  const prev=currentUser.sessions.slice(0,-1);
  // Appariement sur le CRÉNEAU, pas sur le libellé. Le nom est saisi librement
  // par le coach ou l'athlète : deux jours peuvent porter le même intitulé, et
  // renommer une séance cassait silencieusement la comparaison. _memeCreneau
  // compare d'abord slot — l'index de sessions_config, donc le jour — et ne
  // retombe sur le nom que pour l'historique antérieur à ce champ.
  // Même prédicat que la suggestion de charge : une seule définition de « la
  // même séance » dans tout le fichier.
  const prevSame=[...prev].reverse().find(s=>_memeCreneau(s,woState.slot,woState.progName));
  // ── Records : on collecte tout mais on n'affiche QU'UN badge (le meilleur gain) ──
  const records=[];
  let firstSession=false;
  Object.entries(data).forEach(([nm,d])=>{
    const curMax=d.sets.filter(s=>s.done&&parseFloat(s.weight||0)>0).reduce((m,s)=>Math.max(m,parseFloat(s.weight)),0);
    if(!curMax) return;
    let histMax=0;
    prev.forEach(s=>{(_dataDeSeance(s,nm)?.sets||[]).filter(x=>x.done).forEach(x=>{const w=parseFloat(x.weight||0);if(w>histMax)histMax=w;});});
    if(histMax===0){firstSession=true;return;}
    if(curMax>histMax) records.push({nm,curMax,histMax,gain:curMax-histMax});
  });
  let html='';
  if(records.length){
    records.sort((a,b)=>b.gain-a.gain);
    const best=records[0];
    html+=`<div class="wd-badge fx-loop" style="margin-bottom:16px">
      <div class="wd-badge-medal fx-loop"><svg viewBox="0 0 200 200" style="width:100%;height:100%;display:block">
        <defs>
          <linearGradient id="wdRed" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#ff7a50"/><stop offset=".35" stop-color="#e63a24"/>
            <stop offset=".65" stop-color="#b01a12"/><stop offset="1" stop-color="#ff5a38"/>
          </linearGradient>
          <linearGradient id="wdRedDark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#8a130d"/><stop offset="1" stop-color="#5a0c08"/>
          </linearGradient>
          <linearGradient id="wdSilver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--text)"/><stop offset=".45" stop-color="#c9ced6"/>
            <stop offset=".7" stop-color="#8f959f"/><stop offset="1" stop-color="#e8ebef"/>
          </linearGradient>
          <radialGradient id="wdMarble" cx=".38" cy=".3" r=".95">
            <stop offset="0" stop-color="#262a30"/><stop offset=".55" stop-color="#14161a"/>
            <stop offset="1" stop-color="#08090b"/>
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="none" stroke="url(#wdRedDark)" stroke-width="15"/>
        <circle cx="100" cy="100" r="92" fill="none" stroke="url(#wdRed)" stroke-width="12"/>
        <circle cx="100" cy="100" r="97.5" fill="none" stroke="#4a0d08" stroke-width="1.4"/>
        <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="12" stroke-dasharray="1.5 6.5"/>
        <circle cx="100" cy="100" r="86.2" fill="none" stroke="url(#wdSilver)" stroke-width="3.2"/>
        <circle cx="100" cy="100" r="84.5" fill="url(#wdMarble)"/>
        <path d="M52,58 C74,80 96,88 128,96 M118,150 C134,132 144,118 152,96 M60,132 C72,124 80,118 86,108" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="1.6"/>
        <path d="M40,120 C66,110 88,112 108,124" fill="none" stroke="rgba(255,255,255,.035)" stroke-width="2.4"/>
        <g transform="translate(71,45) scale(2.4)" fill="none" stroke="url(#wdSilver)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
          <path d="M4 22h16"/>
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
          <path d="M9.4 4.9 C8.6 6.1 8.6 7.7 9.6 8.8 M14.6 4.9 C15.4 6.1 15.4 7.7 14.4 8.8" stroke-width=".9"/>
        </g>
        <text x="100" y="157" text-anchor="middle" font-family="'Bebas Neue','Arial Narrow',Impact,'Haettenschweiler','Franklin Gothic Condensed',sans-serif" font-size="34" letter-spacing="4" fill="url(#wdSilver)" stroke="#43474e" stroke-width=".7" paint-order="stroke">RECORD</text>
      </svg></div>
      <div style="font-family:var(--pile-titre);font-size:var(--fs-xl);letter-spacing:2px;color:var(--text);margin-top:12px;line-height:1;text-shadow:var(--halo-1)">NOUVEAU RECORD</div>
      <div style="font-size:var(--fs-md);font-weight:800;color:var(--text);margin-top:6px">${best.curMax}kg : ${escapeHtml(best.nm)}</div>
      <div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">était ${best.histMax}kg${records.length>1?' · +'+(records.length-1)+' autre'+(records.length>2?'s':'')+' record'+(records.length>2?'s':'')+' battu'+(records.length>2?'s':''):''}</div>
    </div>`;
  }
  // ── Volume : une seule petite ligne sobre ──
  // Le delta et le jour de la seance comparee sortent de la fonction : le
  // message de fin de seance en a besoin, et ils etaient locaux ici.
  let _bscDelta=0,_bscJour='';
  if(prevSame?.volume>0){
    const delta=Math.round(vol)-prevSame.volume;
    _bscDelta=delta;
    _bscJour=dateLocaleDeCle(prevSame.date).toLocaleDateString('fr-FR',{weekday:'long'});
    if(delta!==0) html+=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px"><span style="flex-shrink:0;color:${delta>0?'var(--green)':'#666'}">${delta>0?icon('flame',18):'▾'}</span><span style="font-size:var(--fs-sm);font-weight:700;color:${delta>0?'var(--green)':'#888'}">${delta>0?'+':''}${delta}kg de volume vs dernière séance</span></div>`;
  }
  if(firstSession&&!html)
    html=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);padding:10px 14px;margin-bottom:14px;font-size:var(--fs-sm);font-weight:700;color:var(--sub)">Première séance enregistrée : tes prochains records apparaîtront ici</div>`;
  return {html,records,delta:_bscDelta,jour:_bscJour};
}
// versBilan : enchaîner sur le questionnaire de départ au lieu de rentrer à
// l'accueil. Utilisé par la carte de relance de s-workout-done, pour que le
// ressenti post-séance soit enregistré AVANT de changer d'écran.
