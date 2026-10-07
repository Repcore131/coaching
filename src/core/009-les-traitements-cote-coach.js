// ══════════════ LES TRAITEMENTS, COTE COACH ════════════════════════════
//
// ⚠ CE BLOC NE MONTRE QUE CE QUE traitementsPourCoach LAISSE PASSER. Il ne
// relit pas le dossier : c'est la meme fonction que le filtre de poussee, et
// deux lectures differentes de la meme regle finiraient par diverger — celle
// qui affiche etant, par construction, la plus tentante a elargir.
//
// Ce que le coach voit d'un traitement non partage : qu'il existe, et a quel
// moment. C'est le minimum qui lui evite de proposer un complement en conflit,
// et le maximum admissible sans le consentement de l'athlete.
function _htmlTraitementsCoach(c){
  if(!c) return '';
  let l=[];
  try{ l=traitementsPourCoach(c); }catch(e){ l=[]; }
  const lib=id=>{ const t=TIMINGS_LIST.filter(x=>x.id===id)[0]; return t?t.label.toLowerCase():id; };
  const ligne=t=>{
    const m=_tabBloc(t.moments).sort((a,b)=>_rangMoment(a)-_rangMoment(b)).map(lib).join(', ');
    const dose=(Number(t.dosage_quantite)>0)
      ? ' · '+String(t.dosage_quantite).replace('.',',')+' '+escapeHtml(t.dosage_unite||'') : '';
    const nom=t.partage
      ? escapeHtml(t.nom||'')+dose
      // ⚠ ON N'ECRIT PAS « TRAITEMENT MASQUE » : ce serait pointer une absence
      // et inviter a la demander. On dit ce qu'on sait, au present, sans
      // designer ce qu'on ignore.
      : '<span style="color:var(--text-dim)">Un traitement en cours</span>';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;'
      +'border-bottom:1px solid var(--border)">'
      +'<span style="flex:1;min-width:0;font-size:var(--fs-sm);color:var(--text);line-height:1.5">'
      +nom
      +(m?'<span style="display:block;font-size:var(--fs-2xs);color:var(--sub);'
        +'margin-top:2px">'+escapeHtml(m)+'</span>':'')
      +(t.saisiPar==='coach'?'<span style="display:block;font-size:var(--fs-2xs);'
        +'color:var(--text-faint);margin-top:1px">saisi par toi</span>':'')
      +'</span>'
      // ⚠ SEUL CE QU'IL A SAISI EST MODIFIABLE PAR LUI. Ouvrir l'editeur sur un
      // traitement de l'athlete afficherait un formulaire vide — il n'en a que
      // la version masquee — et l'enregistrer ecraserait le vrai.
      +(t.saisiPar==='coach'
        ? '<button type="button" class="btn btn-outline btn-sm" style="margin:0;flex:0 0 auto;'
          +'font-size:var(--fs-2xs);padding:4px 8px" onclick="ouvrirEditeurTraitement(\''
          +escapeHtml(c.email)+'\',\''+escapeHtml(t.id)+'\',\'s-coach-client\')">Modifier</button>'
        : '')
      +'</div>';
  };
  return '<div style="background:var(--dark);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:16px;margin-bottom:20px">'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;'
    +'font-weight:700;text-transform:uppercase;margin-bottom:6px">Traitements</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;'
    +'margin-bottom:10px">'
    +escapeHtml('Ce que tu vois ici dépend de ce que ton athlète partage. '
      +'Sans partage, tu sais qu’un traitement est pris à tel moment, et rien de plus : '
      +'de quoi éviter de proposer un complément qui entrerait en conflit.')
    +'</div>'
    +(l.length?l.map(ligne).join('')
      :'<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6;'
       +'padding:4px 0 10px">Aucun traitement en cours dans son dossier.</div>')
    +'<button type="button" class="btn btn-outline" style="width:100%;margin:12px 0 0" '
    +'onclick="ouvrirEditeurTraitement(\''+escapeHtml(c.email)
    +'\',null,\'s-coach-client\')">+ Saisir un traitement</button>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;'
    +'margin-top:8px">'+escapeHtml(MICRO_DISCLAIMER)+'</div>'
    +'</div>';
}
function renderCoachMicroSection(c){
  const el=document.getElementById('ccd-micro');
  if(!el) return;
  const def=(function(){ try{ return _htmlDeficitCoach(c); }catch(e){ return ''; } })();
  const l=(function(){ try{ return risquesMicro(c); }catch(e){ return []; } })();
  // LA MORPHO N'EST PLUS ICI (06/10/2026) : elle a sa section dans l'onglet
  // Données (renderMorphoCoach), en un seul endroit. Les amplitudes n'y sont
  // donc plus affichées deux fois.
  const morpho='';
  // Restitution, pas question : elle s'affiche meme sans risque a signaler.
  // Le jour ON se lit sur le planning de L'ATHLETE, pas sur celui du coach :
  // nutIsOnDay lit currentUser, qui est le coach sur cet ecran.
  const hydra=_htmlHydratationCoach(c);
  // Restitution, comme l'hydratation : elle s'affiche sans qu'aucun seuil ne
  // soit franchi, et n'entre dans aucun score d'urgence.
  let recup=''; try{ recup=_htmlRecuperationCoach(c); }catch(e){}
  // ⚠ LES TRAITEMENTS NE SONT PAS ICI, ET DEUX ASSERTIONS DU BANC L'EXIGENT.
  // « Signaux faibles » (ex « Micro-signaux », renomme en R10) est une zone de LECTURE : aucun bouton, rien qu'on
  // puisse faire disparaitre, et AUCUN bloc du tout quand il n'y a pas de
  // question a poser. Un editeur y aurait rendu le rappel masquable et fait
  // apparaitre un cadre sur toutes les fiches. Ils vivent dans leur propre
  // section, a cote des complements — voir renderCoachTraitementsSection.
  if(!l.length&&!morpho&&!hydra&&!def&&!recup){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='block';
  if(!l.length){ el.innerHTML=def+recup+morpho+hydra; return; }
  el.innerHTML=def+`<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:16px;margin-bottom:20px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:2px;font-weight:700;text-transform:uppercase;margin-bottom:6px">À demander en séance</div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;margin-bottom:12px">Rien n'est détecté ici : ce sont des questions que le profil rend pertinentes.</div>
    ${(function(){
      // REGROUPÉS PAR NUTRIMENT (build 1845), la question du bilan sanguin UNE fois en pied.
      const g=regrouperRisquesMicro(l);
      return g.blocs.map(r=>`<div style="border-left:2px solid var(--border);padding-left:12px;margin-bottom:12px">
      <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;color:#bbb;margin-bottom:4px">${escapeHtml(r.lib)}</div>
      ${r.motifs.length>1
        ?'<ul style="margin:0;padding-left:16px;font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">'+r.motifs.map(m=>'<li>'+escapeHtml(m)+'</li>').join('')+'</ul>'
        :'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6">'+escapeHtml(r.motifs[0]||'')+'</div>'}
      ${r.question?`<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;margin-top:6px;font-weight:600">${escapeHtml(r.question)}</div>`:''}
    </div>`).join('')
      +(g.bilan?`<div class="micro-bilan" style="font-size:var(--fs-sm);color:var(--text);line-height:1.6;font-weight:600;margin-bottom:12px">${escapeHtml(g.bilan.question)} <span style="font-weight:400;color:var(--text-dim)">(${escapeHtml(g.bilan.nutriments.join(', '))})</span></div>`:'');
    })()}
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.55;border-top:1px solid var(--border);padding-top:10px">${escapeHtml(MICRO_DISCLAIMER)}</div>
  </div>`+recup+morpho+hydra;
}
// L'hydratation vivait sur l'écran de PROGRESSION et dans la fiche coach, mais
// pas sur l'écran nutrition — alors que le sel et les fibres, eux, y sont.
// On l'y ajoute : c'est là qu'on la cherche. Aucun retrait ailleurs, un appel
// de plus, et le même bloc — pas une seconde implémentation.
function _htmlHydratationNut(user,dateISO){
  const u=user||currentUser;
  // `u` et non currentUser : cette fonction reçoit un dossier, et il faut la
  // croire sur parole.
  // Le suivi de l'eau bue vit DANS le cadre Hydratation, sous le repère.
  try{
    // Le jour AFFICHÉ par le journal, jamais dans le futur (_eauJour).
    const d=_eauJour(dateISO||localISODate(new Date()));
    const on=nutIsOnDay(d,u);
    const h=_htmlHydratation(u,on), suivi=_htmlEauSuivi(u,on,d);
    if(!h) return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:0">Hydratation</div>${suivi}</div>`;
    return h.replace(/<\/div>\s*$/,suivi+'</div>');
  }
  catch(e){ return ''; }
}
// Meme rendu que cote athlete, mais le jour ON est celui de l'ATHLETE : sur la
// fiche coach, nutIsOnDay lirait le planning du coach et annoncerait un repere
// faux un jour sur deux.
function _htmlHydratationCoach(c){
  const cfg=(c&&c.sessions_config)||null;
  let on=false;
  if(cfg){
    const d=new Date();
    on=!!(cfg[(d.getDay()+6)%7]&&cfg[(d.getDay()+6)%7].active===true);
  }
  const h=_htmlHydratation(c,on);
  // L'eau NOTÉE par l'athlète : moyenne des jours notés sur 7.
  const m=eauMoyenne7j(c);
  if(!m) return h;
  const ligne=`<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.6;margin-top:6px">Eau notée : ${_eauL(m.ml)} L par jour en moyenne sur les 7 derniers jours (${m.nJours} jour${m.nJours>1?'s':''} noté${m.nJours>1?'s':''}).</div>`;
  if(!h) return `<div style="margin-top:14px;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Hydratation</div>${ligne}</div>`;
  return h.replace(/<\/div>\s*$/,ligne+'</div>');
}
function urgencyScore(c){
  const lt=(c.bilans||[]).reduce((m,b)=>Math.max(m,b.date),0);
  // ── Signaux d'entraînement, au-dessus de l'échelle administrative ──
  // La santé passe avant l'intendance : une douleur répétée prime sur un bilan
  // en retard, ce qui n'était pas le cas — l'entraînement ne pesait rien du
  // tout dans ce tri. Les branches 1 à 5 ci-dessous sont INCHANGÉES, elles ne
  // sont que repoussées d'un cran, et une batterie de non-régression le
  // vérifie sur les six cas d'origine.
  // Drapeau rouge déclaré : douleur qui irradie, perte de force, réveil
  // nocturne, choc, gonflement. C'est le signal le plus grave que
  // l'application puisse recevoir, et il passe donc devant la douleur répétée.
  // Il n'est PAS reportable : un coach ne doit pas pouvoir le faire disparaître
  // d'un clic, et seule la levée du drapeau l'éteint.
  //
  // LES DEUX FAMILLES, et non la seule musculo-squelettique. Un signe
  // GÉNÉRAL — douleur thoracique, essoufflement au repos, palpitations —
  // n’atteignait pas ce classement, alors que l’athlète lit « Ton coach a
  // été prévenu » en le déclarant. Le seuil ne bouge pas, ni les exclusions :
  // c’est ce qui ENTRE au rang 10 qui était incomplet.
  if(drapeauQuelconqueActif(c)) return 10;
  const sg=signauxEntrainement(c);
  if(sg.douleur&&!isAlertSnoozed('douleur',c.id,0,c)) return 9;
  if(sg.douleurDiffuse&&!isAlertSnoozed('douleurdiff',c.id,0,c)) return 8;
  if(sg.decrochage&&!isAlertSnoozed('decrochage',c.id)) return 7;
  // La proposition de décharge se BRANCHE ici plutôt que de créer une seconde
  // échelle : elle est dérivée de ces signaux-là, elle appartient donc au même
  // rang. Lecture d'un champ déjà écrit, aucun calcul — ce tri passe sur tous
  // les athlètes du coach à chaque rendu de liste.
  // REGLE 4 : les habitudes entrent ICI et nulle part ailleurs. Un terme de
  // plus dans une disjonction qui en comptait sept, au meme rang. La sante
  // passe avant l intendance, et cocher une case est de l intendance.
  if((sg.plateauMuscle||sg.formeBasse||sg.sousMEV||sg.volumeHaut||sg.restrictionLongue||sg.chuteAssiduite
     ||sg.habitudesBasses
     ||propositionDechargeOuverte(c))&&!isAlertSnoozed('entrainement',c.id)) return 6;
  // Même priorité que « nouveau bilan » : les deux sont mutuellement exclusifs
  // (hasNewBilan exige au moins un bilan, neverStarted exige aucun), pas d'égalité possible.
  if(neverStarted(c)&&!isAlertSnoozed('nostart',c.id)) return 5;
  if(hasNewBilan(c)&&!isAlertSnoozed('bilan',c.id,lt)) return 5;
  if(!c._fromCode&&needsAlert(c)&&!isAlertSnoozed('overdue',c.id)) return 4;
  const now=Date.now();
  if(!c._fromCode&&c.status==='COACHING_SUIVI'&&c.accessExpiry&&(c.accessExpiry-now)>0&&(c.accessExpiry-now)<14*864e5&&!isAlertSnoozed('expiring',c.id)) return 3;
  if(isActive(c)) return 2;
  return 1;
}

// ══════════════ PILOTAGE DU PORTEFEUILLE — AGRÉGATION SEULE ═══════════════
// Deux fonctions PURES posées au-dessus de l'existant. Elles ne calculent rien
// de neuf : elles comptent ce qu'urgencyScore et signauxEntrainement disent
// déjà, sur le tableau que renderClientList a DÉJÀ en mémoire. Aucune lecture
// réseau, aucune écriture.
//
// urgencyScore n'est ni lue de travers ni contournée : le seuil ci-dessous est
// un simple filtre sur sa sortie. Elle reste verrouillée par ses tests.
const PIL_SEUIL_TRAITER=7;         // « à traiter » = les motifs cliniques
const PIL_EXPIRE_JOURS=14;         // même fenêtre que le palier 3 d'urgence
const PIL_VISITE_DEFAUT_JOURS=7;   // première visite : on couvre une semaine
const PIL_CHANGEMENTS_MAX=12;
const PIL_PROGRAMME_FIGE_SEMAINES=6;

// Reprend MOT POUR MOT la condition du palier 3 d'urgencyScore. La recopier
// ailleurs ferait remonter comme « expire bientôt » tout athlète sans date,
// alors qu'une date absente vaut accès ILLIMITÉ (voir checkAccess).
// ══════════════ L'ÉCHÉANCE, CÔTÉ ATHLÈTE ══════════════
// Le coach est prévenu quatorze jours avant ; l'athlète sept. La différence
// est voulue : elle laisse une semaine pendant laquelle le coach peut
// prolonger sans que son athlète ait été alarmé pour rien.
const ACCES_PREVENIR_JOURS=7;
// PURE. Le nombre de jours restants quand il faut prévenir, null sinon.
//
// Le prédicat est celui de _pilAccesExpire, mot pour mot : une échéance
// absente vaut accès ILLIMITÉ (voir checkAccess), et un dossier _fromCode
// n'a pas d'accès à lui. Deux définitions divergentes donneraient un athlète
// prévenu que son accès se ferme alors que son coach ne voit rien.
function accesJoursRestants(u,now){
  if(!u||u._fromCode||u.status!=='COACHING_SUIVI') return null;
  const e=Number(u.accessExpiry);
  if(!isFinite(e)||e<=0) return null;
  const t=(typeof now==='number')?now:Date.now();
  // Déjà expiré : ce n'est plus un avertissement, c'est le verrou — et il a
  // son propre écran. Un bandeau « dans 0 jour » sur un accueil inatteignable
  // ne serait vu par personne.
  if(e<=t) return null;
  const j=Math.ceil((e-t)/864e5);
  return j<=ACCES_PREVENIR_JOURS?j:null;
}
// Le bandeau. Vide tant qu'il n'y a rien à dire.
function _rendreEcheanceAcces(){
  const z=document.getElementById('clh-echeance');
  if(!z) return null;
  const u=currentUser;
  const j=accesJoursRestants(u);
  // CHACUN REND SON PROPRE display. Cette fonction posait innerHTML='' sans
  // toucher au display : sans consequence tant qu'elle etait seule sur le
  // noeud, mais elle dependait alors de l'etat que personne d'autre n'etait
  // cense y laisser. Elle ne depend plus de rien.
  if(j==null){ z.innerHTML=''; z.style.display='none'; return null; }
  z.style.display='block';
  // Les deux derniers jours passent au rouge : le même bandeau orange pendant
  // une semaine finit par faire partie du décor.
  const urgent=j<=2;
  const c=urgent?ROUGE_MARQUE:'#f97316';
  // « dans 1 jour » serait ambigu — la veille au soir comme le matin même.
  // « moins de 24 heures » est vrai dans les deux cas.
  const quand=j===1?'dans moins de 24 heures':'dans '+j+' jours';
  const d=new Date(Number(u.accessExpiry)).toLocaleDateString('fr-FR');
  const nom=((u.coachName||'')+'').trim();
  // Le message ne porte AUCUNE donnée de santé : il ne parle que d'accès.
  const href=_coachContactHref(u.coachId,
    'Bonjour'+(nom?' '+nom:'')+", mon accès RepCore se termine le "+d+'. Peux-tu le prolonger ?');
  z.innerHTML=`<div style="position:relative;overflow:hidden;border-radius:var(--r-3);padding:14px 14px;margin-bottom:16px;
      background:linear-gradient(168deg,var(--surface-3),var(--surface-1) 55%,var(--surface-0));
      border:1px solid var(--border);border-left:3px solid ${c};
      box-shadow:var(--e3)}33">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:${c};--halo-c:${c};text-shadow:var(--halo-1)66">
      Ton accès se termine ${quand}</div>
    <div style="font-size:var(--fs-xs);color:#c9c9c9;line-height:1.6;margin-top:6px">
      Il prend fin le ${escapeHtml(d)}. ${nom?escapeHtml(nom)+' peut le prolonger':'Ton coach peut le prolonger'}, préviens-le avant.</div>
    ${href?`<a href="${_safeContactUrl(href)}" target="_blank" rel="noopener" class="btn btn-red"
      style="margin-top:12px;min-height:42px;display:flex;align-items:center;justify-content:center;font-size:var(--fs-sm);letter-spacing:1px">
      Prévenir mon coach</a>`:''}
  </div>`;
  return j;
}
function _pilAccesExpire(c,now){
  return !!(c&&!c._fromCode&&c.status==='COACHING_SUIVI'&&c.accessExpiry
    &&(c.accessExpiry-now)>0&&(c.accessExpiry-now)<PIL_EXPIRE_JOURS*864e5);
}

// PURE. Les signaux qui ont produit le score de cet athlète, du plus grave au
// moins grave, chacun avec sa date de déclenchement quand elle existe.
//
// `date` vaut null quand le signal n'en porte pas — une douleur diffuse est
// une fenêtre de quatorze jours, un décrochage un ratio sur trois séances :
// aucun des deux n'a d'instant. Inventer une date serait pire que l'absence.
function expliquerUrgence(c){
  const out=[];
  if(!c) return out;
  const ajout=(motif,gravite,date)=>out.push({motif,gravite,
    date:(typeof date==='number'&&date>0)?date:null});
  // Les DEUX familles : cette explication doit dire la même chose que le
  // classement, sinon un athlète remonté au rang 10 y apparaîtrait sans motif.
  const dr=drapeauQuelconqueActif(c);
  if(dr) ajout('Drapeau rouge déclaré',10,dr.date||dr.quand);
  let sg=SIGNAUX_VIDES;
  try{ sg=signauxEntrainement(c); }catch(e){}
  const det=sg.details||{};
  if(sg.douleur){
    const d=det.douleur;
    const dates=(d&&Array.isArray(d.dates)&&d.dates.length)?Math.max.apply(null,d.dates):null;
    ajout('Douleur répétée'+(d&&d.nom?' : '+d.nom:''),9,dates);
  }
  if(sg.douleurDiffuse) ajout('Douleur diffuse',8,null);
  if(sg.decrochage) ajout('Séances écourtées',7,null);
  // Palier 6 : cliniques eux aussi, mais SOUS le seuil « à traiter ». Ils
  // figurent dans l'explication — c'est bien pourquoi l'athlète est là.
  if(sg.plateauMuscle) ajout('Plateau musculaire',6,null);
  if(sg.formeBasse) ajout('Forme déclarée basse',6,null);
  if(sg.sousMEV) ajout('Volume sous le minimum efficace',6,null);
  if(sg.volumeHaut) ajout('Volume élevé',6,null);
  if(sg.restrictionLongue) ajout('Restriction calorique prolongée',6,null);
  try{ if(propositionDechargeOuverte(c)) ajout('Décharge proposée',6,null); }catch(e){}
  const bils=(c.bilans||[]).filter(b=>b&&typeof b.date==='number');
  const dernier=bils.length?bils[bils.length-1].date:null;
  try{ if(neverStarted(c)) ajout('Jamais démarré',5,c.createdAt); }catch(e){}
  try{
    if(hasNewBilan(c)){
      // La date du bilan QUI MOTIVE l’alerte — le plus récent, celui que le
      // prédicat vient de juger. `sans[sans.length-1]` désignait le dernier
      // non répondu DANS L’ORDRE DU TABLEAU, ce qui pouvait montrer une date
      // plus ancienne que la raison réelle du signal.
      const der=dernierBilan(c);
      const _cor=(der&&!bilanRepondu(der)&&!der.traite)?null:bilanCorrigeAVoir(c);
      if(_cor) ajout(libelleCorrectionBilan(c,_cor),5,_cor.correctionApresReponse.le);
      else ajout('Bilan sans réponse',5,(der&&der.date)||dernier);
    }
  }catch(e){}
  try{ if(!c._fromCode&&needsAlert(c)) ajout('Bilan en retard',4,dernier); }catch(e){}
  if(_pilAccesExpire(c,Date.now())) ajout('Accès qui expire',3,c.accessExpiry);
  // PRIORITE BASSE, au meme rang que l'acces qui expire : une asymetrie de
  // 3 % ne se corrige pas dans la semaine, et la faire remonter au-dessus
  // d'une douleur deplacerait le regard du coach au mauvais endroit.
  try{
    const _as=signalAsymetrie(c);
    if(_as) ajout('Asymétrie gauche/droite : '+_as.phrase,ASYM_GRAVITE,dernier);
  }catch(e){}
  return out.sort((a,b)=>b.gravite-a.gravite);
}

// PURE. Le prix de l'abonnement autonome, TEL QUE LA TABLE LE PORTE.
//
// Trois textes l’annonçaient en dur : changer 9,95 dans SUB_PALIERS ne
// changeait rien à l’écran, et le produit aurait annoncé deux prix selon
// l’endroit — celui de la table sur la carte, l’ancien dans les textes.
function prixAutonomie(){
  const p=SUB_PALIERS.find(x=>x.cle==='mensuel');
  return ((p&&p.prix)||prixOffre('essentielle'))+'/mois';
}
// Les emplacements statiques qui l’annoncent. Un attribut plutôt que trois
// identifiants : un quatrième texte s’y branche sans toucher à ce code.
function _majPrixAffiches(){
  try{
    document.querySelectorAll('[data-prix-autonomie]')
      .forEach(e=>{ e.textContent=prixAutonomie(); });
  }catch(e){}
}
// PURE. Ne mute NI le tableau reçu, NI les dossiers qu'il contient.
//
// `opts.now` et `opts.depuis` existent pour les tests : sans eux, la fonction
// lit l'horloge et la dernière visite du coach.
function agregerPortefeuille(clients,opts){
  const l=Array.isArray(clients)?clients:[];
  const o=opts||{};
  const now=(typeof o.now==='number')?o.now:Date.now();
  const depuis=(typeof o.depuis==='number'&&o.depuis>0)
    ?o.depuis:(now-PIL_VISITE_DEFAUT_JOURS*864e5);
  let aTraiter=0,decrochage=0,accesExpirent=0;
  const changements=[];
  // `alertes` porte EXACTEMENT le predicat du filtre 'traiter' de
  // renderClientList — needsAlert ou bilan sans reponse. Il etait compte a
  // part dans loadCoachHome, avec le seul needsAlert : le metric-box annoncait
  // donc un nombre que la puce de filtre n ouvrait pas.
  const portefeuille={total:0,actifs:0,jamaisDemarres:0,enAttente:0,alertes:0};
  const charge={bilansSansReponse:0,videosEnAttente:0};
  for(const c of l){
    if(!c) continue;
    portefeuille.total++;
    const invite=!!(c._fromCode||!c.email);
    if(invite) portefeuille.enAttente++;
    try{ if(isActive(c)) portefeuille.actifs++; }catch(e){}
    try{ if(needsAlert(c)||hasNewBilan(c)) portefeuille.alertes++; }catch(e){}
    let jamais=false;
    try{ jamais=neverStarted(c); }catch(e){}
    if(jamais) portefeuille.jamaisDemarres++;
    try{ if(urgencyScore(c)>=PIL_SEUIL_TRAITER) aTraiter++; }catch(e){}
    // ② et ③ : mêmes exclusions qu'urgencyScore — invité non inscrit et
    // athlète jamais démarré n'ont rien à écourter ni d'accès à renouveler.
    if(_pilEligibleSignaux(c)){
      try{ if(signauxEntrainement(c).decrochage) decrochage++; }catch(e){}
      if(_pilAccesExpire(c,now)) accesExpirent++;
    }
    charge.bilansSansReponse+=bilansSansReponse(c);
    charge.videosEnAttente+=((c.videos||[]).filter(videoNonCorrigee).length);
    // ── Depuis la dernière visite ──
    const nom=((c.fname||'')+' '+(c.lname||'')).trim()||c.email||'Athlète';
    for(const b of (c.bilans||[]))
      if(b&&typeof b.date==='number'&&b.date>depuis)
        changements.push({date:b.date,qui:nom,id:c.id,quoi:'a envoyé un bilan'});
    for(const s of (c.sessions||[]))
      if(s&&typeof s.date==='number'&&s.date>depuis)
        changements.push({date:s.date,qui:nom,id:c.id,quoi:'a fait une séance'});
    for(const v of (c.videos||[]))
      if(v&&typeof v.date==='number'&&v.date>depuis)
        changements.push({date:v.date,qui:nom,id:c.id,quoi:'a envoyé une vidéo'});
    const dr=drapeauRougeActif(c);
    const drd=dr&&(dr.date||dr.quand);
    if(typeof drd==='number'&&drd>depuis)
      changements.push({date:drd,qui:nom,id:c.id,quoi:'a levé un drapeau rouge'});
  }
  changements.sort((a,b)=>b.date-a.date);
  return {aTraiter,decrochage,accesExpirent,changements,portefeuille,charge,
    depuis,max:PIL_CHANGEMENTS_MAX};
}

// ══════════════ PILOTAGE — LA BARRE, LES BANDES, L'EXPLICATION ════════════
// AUCUN nouvel écran : trois compteurs et trois volets posés en tête de la
// liste existante, qui filtrent cette liste-là. Le grief n° 1 du métier est la
// complexité : ce lot ne doit rien ajouter à parcourir, seulement raccourcir
// le chemin vers ce qui compte.
//
// L'état déplié est MÉMORISÉ : ce bloc est repeint à chaque rendu de liste, et
// un <details> se refermerait sous les doigts du coach à chaque frappe dans la
// recherche.
let _pilOuvert={};
let _pilVoirTout=false;
function pilNoterBande(cle,ouvert){ _pilOuvert[cle]=!!ouvert; }
function pilVoirTout(){ _pilVoirTout=true; renderPilotage(); }

// Un athlète compte dans ② et ③ aux MÊMES conditions que dans l'agrégation.
// Une seule définition : deux copies finiraient par donner un compteur qui ne
// correspond plus à la liste qu'il filtre.
function _pilEligibleSignaux(c){
  if(!c||c._fromCode||!c.email) return false;
  try{ if(neverStarted(c)) return false; }catch(e){}
  return true;
}

function _pilCompteur(cle,lib,n,couleur){
  const vide=!(n>0);
  const actif=(_filtreClients===cle);
  // LE RETOUR EN ARRIERE VISE LA VUE DE TRAVAIL, ET NON PLUS « Tous ».
  // Tant que 'tous' etait l'etat par defaut, re-toucher une puce allumee ne
  // pouvait que ramener a lui, et « Tous » lui-meme ne se retirait pas — s'y
  // re-cliquer l'aurait repose sur place. Depuis que la vue par defaut est
  // 'travail', « Tous » est une puce comme les autres : elle s'allume, et se
  // re-toucher la rend.
  const cible=actif?'travail':cle;
  return `<button onclick="setFiltreClients('${cible}')"
    aria-pressed="${actif?'true':'false'}"
    class="pil-compteur" data-vide="${vide?1:0}"
    style="color:${couleur};border-left-color:${actif?couleur:(vide?'var(--border)':couleur+'66')};
      ${actif?`border-color:${couleur};box-shadow:var(--e3)}33,inset 0 1px 0 rgba(255,255,255,.08)`:''}">
    <div class="pil-val" style="color:${vide?'#6a6a6a':couleur};text-shadow:${vide?'none':`0 0 16px ${couleur}99`}">${n}</div>
    <div class="pil-lib" style="color:${vide?'#8a8a8a':'#c4c4c4'}">${lib}</div>
  </button>`;
}
// N1.11 — LA BARRE D ETAT DU PORTEFEUILLE, EN UN SEUL ENDROIT.
// CHAQUE NOMBRE OUVRE SA PROPRE LISTE. C etait le grief : trois metric-box
// muets annoncaient un total, des actifs et des alertes sans offrir aucun
// chemin vers les athletes concernes ; la bande « Portefeuille » du volet
// redisait les memes nombres, repliee ; et les puces de filtre ouvraient des
// listes sans jamais dire combien elles contenaient.
//
// LES PREDICATS DE COMPTAGE ET CEUX DU FILTRAGE SONT LES MEMES, un par un —
// c est la seule chose qui rende un compteur cliquable honnete. agregerPorte-
// feuille compte, renderClientList filtre, et la table ci-dessous les apparie
// nommement. Un compteur qui n ouvrirait pas exactement sa propre liste serait
// pire que pas de compteur du tout.
//
// L ORDRE EST CELUI DE L ACTION : ce qui demande un geste d abord, ce qui
// decrit l etat ensuite, « Tous » en dernier parce qu il n est pas une
// information mais un retour en arriere.
// ══ LE TEMPS DU COACH, PAR ATHLÈTE ET PAR SEMAINE (30/09/2026) ═════════════
//
// Un segment s'ouvre quand le coach a sous les yeux le dossier d'UN athlète :
// sa fiche (s-coach-client), son évolution (s-coach-bilan-evo) ou la
// correction d'une de ses vidéos. Il se ferme au changement d'écran, au
// passage en arrière-plan, ou trois minutes après la dernière interaction :
// un téléphone posé sur la fiche ne compte pas une heure.
//   currentUser.chrono = {'AAAA-Wss': {<id de l'athlète>: secondes}}
//
// ⚠ DOUZE SEMAINES AU PLUS (chronoPurger), et une écriture au plus toutes les
//   deux minutes : saveUser réécrit le dossier entier, pas une seconde.
// ⚠ UN SEUL SEGMENT PAR APPAREIL : l'onglet qui a la dernière interaction
//   prend le relais (rc_chrono_onglet) ; les autres cessent de compter.
// ⚠ UNE HORLOGE QUI RECULE ne rend jamais de temps négatif : le segment
//   repart de l'instant présent.
const CHRONO_INACTIF_MS=3*60e3;
const CHRONO_SEMAINES=12;
const CHRONO_ECRITURE_MS=2*60e3;
const CHRONO_SEGMENT_MAX_S=4*3600;
const CHRONO_ECRANS=Object.freeze(['s-coach-client','s-coach-bilan-evo']);

// PURE. Les secondes d'un segment {debut, derniere} fermé à `fin` : au plus
// trois minutes après la dernière interaction, jamais négatif.
function chronoSegmentSecondes(seg,fin){
  if(!seg) return 0;
  const d=Number(seg.debut)||0, der=Math.max(d,Number(seg.derniere)||d);
  const f=Math.min(Number(fin)||0,der+CHRONO_INACTIF_MS);
  if(!d||!(f>d)) return 0;
  return Math.min(CHRONO_SEGMENT_MAX_S,Math.round((f-d)/1000));
}
// PURE. Ajoute des secondes à une semaine et un athlète, sur une COPIE.
function chronoAjouter(chrono,semaine,cle,secondes){
  const out=chronoCopie(chrono);
  const s=Math.round(Number(secondes)||0);
  if(!semaine||!cle||s<=0) return out;
  const w=out[semaine]||(out[semaine]={});
  w[cle]=Math.min(7*86400,(Number(w[cle])||0)+s);
  return out;
}
// PURE. La somme de deux relevés (le dossier, et ce qui attend d'être écrit).
function chronoFusion(a,b){
  let out=chronoCopie(a);
  const x=chronoCopie(b);
  for(const w of Object.keys(x)) for(const k of Object.keys(x[w])) out=chronoAjouter(out,w,k,x[w][k]);
  return out;
}
function chronoCopie(chrono){
  const out={};
  const c=(chrono&&typeof chrono==='object')?chrono:{};
  for(const w of Object.keys(c)) if(c[w]&&typeof c[w]==='object') out[w]=Object.assign({},c[w]);
  return out;
}
// PURE. Les douze semaines ISO qui finissent à `maintenant`, les autres partent.
function chronoPurger(chrono,maintenant){
  const t=Number(maintenant)||Date.now();
  const garde=new Set();
  for(let i=0;i<CHRONO_SEMAINES;i++) garde.add(semaineISO(new Date(t-i*7*864e5)));
  const out={};
  const c=chronoCopie(chrono);
  for(const w of Object.keys(c)) if(garde.has(w)&&Object.keys(c[w]).length) out[w]=c[w];
  return out;
}
// PURE. La médiane (0 pour une liste vide).
function chronoMediane(valeurs){
  const l=(valeurs||[]).map(Number).filter(v=>isFinite(v)).sort((a,b)=>a-b);
  if(!l.length) return 0;
  const m=Math.floor(l.length/2);
  return l.length%2?l[m]:(l[m-1]+l[m])/2;
}
// PURE. Ce que le portefeuille affiche : la médiane de la semaine (sur les
// dossiers ouverts) et les dix dossiers les plus longs sur quatre semaines.
// Les athlètes qui ne sont plus dans la liste (supprimés, partis) sont ignorés.
function chronoResume(chrono,clients,maintenant){
  const t=Number(maintenant)||Date.now();
  const c=(chrono&&typeof chrono==='object')?chrono:{};
  const ids=new Set((clients||[]).filter(x=>x&&!x._fromCode).map(x=>String(x.id)));
  const sem=semaineISO(new Date(t));
  const cette=c[sem]||{};
  const semaine=Object.keys(cette).filter(k=>ids.has(k)&&Number(cette[k])>0);
  const quatre=[0,1,2,3].map(i=>semaineISO(new Date(t-i*7*864e5)));
  const tot={};
  for(const w of quatre) for(const k of Object.keys(c[w]||{})) if(ids.has(k)) tot[k]=(tot[k]||0)+(Number(c[w][k])||0);
  const top=Object.keys(tot).filter(k=>tot[k]>0).sort((a,b)=>tot[b]-tot[a]||(Number(cette[b])||0)-(Number(cette[a])||0)).slice(0,10)
    .map(k=>({id:k,semaine:Number(cette[k])||0,quatre:tot[k]}));
  return {semaine:sem,medianeS:chronoMediane(semaine.map(k=>Number(cette[k]))),dossiers:semaine.length,top};
}
function chronoMinutes(s){
  const m=Math.round((Number(s)||0)/60);
  return (Number(s)>0&&m<1)?'< 1 min':m+' min';
}
// La formule de l'athlète, comme le portefeuille la nomme.
function _chronoFormule(c){
  let p='aucun'; try{ p=palierDe(c); }catch(e){}
  const f=String(((c&&c.abonnement)||{}).formule||'');
  if(p==='suivi') return (OFFRES[f]&&OFFRES[f].type==='coaching')?OFFRES[f].lib:'Coaching suivi';
  return {essentielle:'Essentielle',ultime:'Ultime'}[p]||'Sans formule';
}

// ── La mesure, sur cet appareil ────────────────────────────────────────
// ⚠ CE QUI N'EST PAS ENCORE ÉCRIT VIT À PART (attente), jamais dans
//   currentUser.chrono : la synchronisation relit le dossier du coach et
//   l'écraserait entre deux écritures (constaté sur le banc : 7 s gardées sur
//   25). Il est versé dans le dossier au moment d'écrire, et gardé dans
//   localStorage pour survivre à un rechargement.
let _chrono={seg:null,marque:0,ecrit:0,veille:false,attente:null};
function _chronoAttente(){
  if(_chrono.attente&&_chrono.attente.coach===currentUser.email) return _chrono.attente;
  let v=null; try{ v=JSON.parse(localStorage.getItem('rc_chrono_attente')||'null'); }catch(e){ v=null; }
  _chrono.attente=(v&&v.coach===currentUser.email&&v.data&&typeof v.data==='object')?v:{coach:currentUser.email,data:{}};
  return _chrono.attente;
}
// Le relevé tel qu'il sera : le dossier, plus ce qui attend.
function chronoCourant(){
  if(!currentUser) return {};
  return chronoFusion(currentUser.chrono,_chronoAttente().data);
}
const _chronoOnglet=Math.random().toString(36).slice(2,10);
// L'athlète dont le dossier est à l'écran, ou null.
function _chronoContexte(){
  try{
    if(!currentUser||currentUser.role!=='coach'||document.hidden) return null;
    if(document.querySelector('#modal-overlay .mdl-video')&&window._vcEmail){
      const u=(DB.get('users')||{})[window._vcEmail];
      return u&&u.id?String(u.id):null;
    }
    const a=document.querySelector('.screen.active');
    if(a&&CHRONO_ECRANS.indexOf(a.id)>=0&&currentClientId) return String(currentClientId);
  }catch(e){}
  return null;
}
function _chronoAutreOnglet(t){
  try{
    const v=JSON.parse(localStorage.getItem('rc_chrono_onglet')||'null');
    return !!(v&&v.id!==_chronoOnglet&&t-Number(v.at)<60e3&&t>=Number(v.at));
  }catch(e){ return false; }
}
function _chronoPrendreMain(t){ try{ localStorage.setItem('rc_chrono_onglet',JSON.stringify({id:_chronoOnglet,at:t})); }catch(e){} }
// Verse dans currentUser.chrono ce qui a couru depuis la dernière marque.
function _chronoVerser(t,fin){
  const s=_chrono.seg;
  if(!s) return;
  // Un changement de compte entre-temps : ce temps n'est pas à ce coach.
  if(s.coach!==currentUser.email){ _chrono.seg=null; _chrono.marque=0; return; }
  const ref={debut:Math.max(s.debut,_chrono.marque||s.debut),derniere:s.derniere};
  const sec=chronoSegmentSecondes(ref,fin);
  _chrono.marque=Math.max(ref.debut,Math.min(fin,s.derniere+CHRONO_INACTIF_MS));
  if(sec>0){
    const a=_chronoAttente();
    a.data=chronoAjouter(a.data,semaineISO(new Date(ref.debut)),s.cle,sec);
    try{ localStorage.setItem('rc_chrono_attente',JSON.stringify(a)); }catch(e){}
  }
}
function _chronoFermer(t){
  if(!_chrono.seg) return;
  _chronoVerser(t,t);
  _chrono.seg=null; _chrono.marque=0;
}
function _chronoTick(){
  try{
    if(!currentUser||currentUser.role!=='coach') return false;
    const t=Date.now();
    const s=_chrono.seg;
    // L'horloge a reculé : on repart d'ici, sans rien compter.
    if(s&&(t<s.debut||t<(_chrono.marque||0))){ s.debut=t; s.derniere=t; _chrono.marque=t; }
    const cle=_chronoContexte();
    const inactif=s&&t-s.derniere>CHRONO_INACTIF_MS;
    if(s&&(cle!==s.cle||inactif||_chronoAutreOnglet(t))){ _chronoFermer(t); if(inactif) _chrono.veille=true; }
    else if(s) _chronoVerser(t,t);
    if(!_chrono.seg&&cle&&!_chrono.veille&&!_chronoAutreOnglet(t)){
      _chrono.seg={cle,coach:currentUser.email,debut:t,derniere:t}; _chrono.marque=t; _chronoPrendreMain(t);
    }
    if(_chrono.seg) _chronoPrendreMain(t);
    // L'écriture, au plus toutes les deux minutes : l'attente rejoint le dossier.
    const a=_chronoAttente();
    if(Object.keys(a.data).length&&t-_chrono.ecrit>=CHRONO_ECRITURE_MS){
      currentUser.chrono=chronoPurger(chronoFusion(currentUser.chrono,a.data),t);
      a.data={}; _chrono.ecrit=t;
      try{ localStorage.removeItem('rc_chrono_attente'); }catch(e){}
      saveUser();
    }
    return true;
  }catch(e){ return false; }
}
// Une interaction : le segment vit encore, l'onglet reprend la main.
function _chronoInteraction(){
  const t=Date.now();
  _chrono.veille=false;
  if(_chrono.seg){ _chrono.seg.derniere=Math.max(_chrono.seg.derniere,t); _chronoPrendreMain(t); }
  else if(_chronoContexte()) _chronoTick();
}
(function(){
  try{
    ['pointerdown','keydown','wheel','touchstart'].forEach(e=>document.addEventListener(e,_chronoInteraction,{capture:true,passive:true}));
    document.addEventListener('scroll',_chronoInteraction,{capture:true,passive:true});
    document.addEventListener('visibilitychange',()=>{ _chronoTick(); });
    setInterval(_chronoTick,10e3);
  }catch(e){}
})();

// ── L'affichage, sous la barre d'état du portefeuille ──────────────────
function renderChronoCoach(clients){
  const z=document.getElementById('ch-chrono');
  if(!z) return false;
  if(!currentUser||currentUser.role!=='coach'){ z.innerHTML=''; return false; }
  const l=clients||(typeof getClients==='function'?getClients():[]);
  const r=chronoResume(chronoCourant(),l,Date.now());
  if(!r.top.length){ z.innerHTML=''; return true; }
  const par=new Map(l.map(c=>[String(c.id),c]));
  const ouvert=!!(z.querySelector('details')&&z.querySelector('details').open);
  z.innerHTML='<div class="chr-l">'+(r.dossiers
      ?'<b>'+escapeHtml(chronoMinutes(r.medianeS))+'</b> par athlète cette semaine (médiane, '+r.dossiers+' dossier'+(r.dossiers>1?'s':'')+' ouvert'+(r.dossiers>1?'s':'')+')'
      :'Aucun dossier ouvert cette semaine')+'</div>'
    +'<details class="chr-d"'+(ouvert?' open':'')+'><summary>Les 10 dossiers qui te prennent le plus de temps</summary>'
    +'<div class="chr-t"><div class="chr-e"><span>Athlète</span><span>Cette semaine</span><span>4 semaines</span></div>'
    +r.top.map(x=>{ const c=par.get(x.id)||{};
      return '<button type="button" class="chr-r" onclick="openClientDetail('+_attrArg(x.id)+')"><span><b>'+escapeHtml(_nomAthlete(c)||'Athlète')+'</b><small>'+escapeHtml(_chronoFormule(c))+'</small></span>'
        +'<span>'+escapeHtml(x.semaine?chronoMinutes(x.semaine):'-')+'</span><span>'+escapeHtml(chronoMinutes(x.quatre))+'</span></button>'; }).join('')
    +'</div><div class="sub chr-n">Le temps passé sur sa fiche, son évolution et ses vidéos. Trois minutes sans geste arrêtent le compte.</div></details>';
  return true;
}

function renderPortefeuille(clients){
  // LA MEME REPARTITION QU'AUX ARRIVEES, et volontairement la meme fonction :
  // deux facons de compter les memes gens finiraient par ne plus dire pareil.
  // Posee apres le rendu, pour ne pas avoir a connaitre le balisage interne.
  const el=document.getElementById('ch-portefeuille');
  if(!el) return;
  const l=clients||(typeof getClients==='function'?getClients():[]);
  let r;
  try{ r=agregerPortefeuille(l,{depuis:currentUser&&currentUser.lastCoachVisit}); }
  catch(e){ el.innerHTML=''; return; }
  const p=r.portefeuille;
  const cases=[
    ['pf-traiter',    'À traiter',            r.aTraiter,        ROUGE_MARQUE],
    ['pf-decrochage', 'Séances écourtées',    r.decrochage,      '#f5c518'],
    ['pf-acces',      'Accès qui expirent',   r.accesExpirent,   '#22c55e'],
    ['traiter',       'Alertes',              p.alertes,         ROUGE_MARQUE],
    ['pf-jamais',     'Jamais démarrés',      p.jamaisDemarres,  '#f5c518'],
    ['attente',       'En attente',           p.enAttente,       '#8a8a8a'],
    ['pf-actifs',     'Actifs 14 j',          p.actifs,          '#22c55e'],
    ['tous',          'Tous',                 p.total,           '#c4c4c4']];
  // ⚠ RIEN D'AUTRE QUE LES HUIT COMPTEURS. La repartition « avec / sans
  //   suivi » fermait cette barre : en flex, elle passait pour un neuvieme
  //   element et s'installait au bout de la ligne, poussant « Tous » et
  //   cassant l'alignement des cases. Demande de Kevin, 19/09/2026 : elle s'en
  //   va. L'information reste dite deux fois ailleurs — les titres de section
  //   « Mes athletes (avec / sans suivi) » portent chacun leur compte, et la
  //   carte des arrivees les redit avec ses deux couleurs de barre.
  el.innerHTML=cases.map(c=>_pilCompteur(c[0],c[1],c[2],c[3])).join('');
  // Les puces-filtres par étiquette : leur propre rangée, SOUS la barre (rien d'autre que les huit compteurs dedans).
  try{ renderFiltresEtiquettes(); }catch(e){}
  // Le temps passé par athlète (chronoCoach), dans sa propre rangée elle aussi.
  try{ renderChronoCoach(l); }catch(e){}
}
function _pilBande(cle,titre,corps,resume){
  return `<details class="plan-src pil-bande" style="margin:0 0 8px"${_pilOuvert[cle]?' open':''} ontoggle="pilNoterBande('${cle}',this.open)">
    <summary style="color:var(--sub)">${titre}<span class="plan-src-nb">${resume||''}</span></summary>
    <div class="plan-src-liste" style="font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7"><div>${corps}</div></div>
  </details>`;
}
function renderPilotage(clients){
  const el=document.getElementById('ch-pilotage');
  if(!el) return;
  const l=clients||(typeof getClients==='function'?getClients():[]);
  let r;
  try{ r=agregerPortefeuille(l,{depuis:currentUser&&currentUser.lastCoachVisit}); }
  catch(e){ el.innerHTML=''; return; }
  // ── Bande A : depuis la dernière visite ──
  const ch=r.changements;
  const montres=_pilVoirTout?ch:ch.slice(0,r.max);
  const dateCourte=t=>new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  const corpsA=ch.length
    ? montres.map(x=>`<div style="padding:2px 0"><span style="color:var(--text-faint)">${dateCourte(x.date)}</span> · <b>${escapeHtml(x.qui)}</b> ${escapeHtml(x.quoi)}</div>`).join('')
      +(ch.length>montres.length?`<button onclick="pilVoirTout()" style="background:none;border:none;color:var(--red-text);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;cursor:pointer;padding:8px 0 0;text-decoration:underline">Voir tout (${ch.length})</button>`:'')
    : 'Rien de neuf depuis ta dernière visite.';
  // N1.11 — LA BANDE « PORTEFEUILLE » A DISPARU D ICI. Ses quatre nombres
  // sont ceux de la barre d etat, qui les affiche en permanence et ouvre la
  // liste correspondante. Les redire dans un volet replie, sans lien, etait
  // la troisieme description du meme portefeuille dans le meme panneau.
  // ── Bande C : charge de travail ──
  // « Programmes figés » n'y figure pas : aucun horodatage de programme
  // n'existe au dossier, et l'inventer donnerait un nombre faux en silence.
  const g=r.charge;
  // LE COMPTEUR DE VIDÉOS MÈNE À LA CORRECTION. Il annonçait un chiffre juste
  // sans offrir aucun chemin : il fallait deviner quels athlètes, ouvrir leur
  // fiche une par une, et descendre jusqu’à la section Vidéos.
  //
  // Cliquable SEULEMENT s’il y en a : un bouton qui n’ouvre rien apprend à
  // cliquer dans le vide. Le texte, lui, ne change pas d’un caractère.
  const _libVid=`${g.videosEnAttente} vidéo${g.videosEnAttente>1?'s':''} en attente de correction`;
  const corpsC=(g.bilansSansReponse||g.videosEnAttente)
    ? `${g.bilansSansReponse} bilan${g.bilansSansReponse>1?'s':''} sans réponse · `
      +(g.videosEnAttente
        ?`<button type="button" onclick="_entrerFileVideos()" style="background:none;border:none;padding:0;font-family:inherit;font-size:inherit;line-height:inherit;color:var(--red-light);font-weight:800;text-decoration:underline;cursor:pointer">${_libVid}</button>`
        :_libVid)
    : 'Rien en attente de ta part.';
  // TROIS VOLETS POUR UN SEUL GESTE. Le coach les ouvrait l'un apres l'autre
  // pour se faire une idee, et devait retenir ce qu'il avait lu dans le
  // precedent. Un seul volet, trois sections separees d'un filet.
  const corpsSep='<div style="height:1px;background:var(--surface-3);margin:10px 0"></div>';
  const _tt=t=>`<div style="font-size:10px;letter-spacing:1px;text-transform:uppercase;color:var(--sub);font-weight:800;margin-bottom:4px">${t}</div>`;
  const corpsA2=_tt('Depuis ta dernière visite')+corpsA;
  const corpsC2=_tt('Charge de travail')+corpsC;
  // LES TROIS LIENS ONT QUITTE LE VOLET. Ils etaient la seule porte de trois
  // ecrans complets — la file de reprise, l'activite du portefeuille et la
  // decharge groupee — et ce volet est FERME a chaque ouverture de
  // l'application : _pilOuvert n'est jamais enregistre. Trois ecrans entiers
  // dependaient donc d'un depliage et d'un lien souligne de onze pixels.
  // Ils sont remontes dans la navigation du tableau de bord, au meme rang que
  // « Mes programmes » et « Charges articulaires ». On ne les DUPLIQUE pas :
  // remontes, ils quittent le volet, qui garde ce qu'il sait faire — lire une
  // periode.
  const corpsLiens=corpsSep;
  // N1.11 — LES TROIS COMPTEURS ONT REJOINT LA BARRE D ETAT. Ils y sont
  // ENTIERS, meme cle de filtre et meme couleur : ils ne sont pas dupliques,
  // ils ont demenage. Le volet garde ce qu il sait faire — lire une periode.
  el.innerHTML=`
    ${_pilBande('vue',"Vue d'ensemble",corpsA2+corpsSep+corpsC2+corpsLiens,String(g.bilansSansReponse+g.videosEnAttente))}`;
}
// La visite est horodatée À LA SORTIE de l'écran, pas à l'entrée : la datant à
// l'entrée, la bande A serait vide dès la seconde ouverture de la journée.
// C'est la SEULE écriture de tout ce lot.
function _pilMarquerVisite(){
  try{
    if(!currentUser||currentUser.role!=='coach') return;
    currentUser.lastCoachVisit=Date.now();
    _pilVoirTout=false;
    saveUser();
  }catch(e){}
}
// PURE. Le bloc « Pourquoi cet athlète est ici », sur sa fiche.
function _htmlPourquoiIci(c){
  let l=[];
  try{ l=expliquerUrgence(c); }catch(e){ return ''; }
  if(!l.length) return '';
  const dateCourte=t=>new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-left:1px solid var(--border);border-radius:var(--r-3);padding:12px 14px;margin-bottom:14px">
    <div class="t-section">Pourquoi cet athlète est ici</div>
    ${l.map(x=>`<div style="display:flex;align-items:baseline;gap:8px;padding:4px 0">
      <span style="flex-shrink:0;font-size:var(--fs-2xs);font-weight:900;color:${x.gravite>=7?'var(--red)':'var(--sub)'};min-width:16px">${x.gravite}</span>
      <span style="flex:1;min-width:0;font-size:var(--fs-xs);color:var(--text-strong);line-height:1.5">${escapeHtml(x.motif)}</span>
      <span style="flex-shrink:0;font-size:var(--fs-2xs);color:var(--text-faint)">${x.date?dateCourte(x.date):''}</span>
    </div>`).join('')}
  </div>`;
}
// ── Liens WhatsApp pré-remplis ──────────────────────────────────────────────
// AUCUNE messagerie n'est implémentée : on ouvre le WhatsApp du coach avec le
// destinataire et le texte déjà écrits. Le coach relit et envoie lui-même.
// Sans numéro connu, wa.me accepte l'absence de destinataire et laisse choisir
// le contact ; le texte, lui, reste pré-rempli. C'est le cas de TOUS les
// athlètes inscrits avant l'ajout du champ téléphone.
// wa.me exige l'indicatif pays SANS zéro de tête. « 0612345678 » ouvre
// WhatsApp sur « numéro invalide » et le texte pré-rempli est perdu — or un
// coach français tape 06 par réflexe. On traite donc le cas plutôt que de
// fabriquer un lien mort :
//   00 33 6…  → 33 6…   (préfixe international écrit en toutes lettres)
//   +33 6…    → 33 6…
//   06 12…    → '' : numéro national, indicatif inconnu, inutilisable ici.
function _numWa(phone){
  const d=String(phone||'').replace(/\D/g,'').replace(/^00/,'');
  return /^0/.test(d)?'':d;
}
function waLink(phone,text){
  return 'https://wa.me/'+_numWa(phone)+'?text='+encodeURIComponent(text||'');
}
// Lien de contact d'un coach, vu depuis un de ses athlètes : WhatsApp si son
// numéro est exploitable, sinon son email, sinon rien. _numWa et non un replace
// brut — un numéro saisi en « 06… » produit un lien que WhatsApp refuse, et
// mieux vaut un mailto qu'un bouton mort.
// Partagé par l'accueil athlète et l'écran d'accès expiré : sur ce dernier,
// joindre son coach est la SEULE action qui débloque quoi que ce soit.
// Cle Firebase du coach de l athlete courant. coachEmailKey est pose au
// rattachement ; le repli par le dossier local sert aux comptes rattaches avant
// son introduction, et au coach lui-meme.
function cleCoachDe(u){
  if(!u) return null;
  if(u.coachEmailKey) return u.coachEmailKey;
  // Sans coachId, ne rien chercher : la comparaison users[k].id === undefined
  // était vraie pour tout dossier dépourvu d'id, et rendait sa clé comme
  // si c'était celle du coach.
  if(!u.coachId) return null;
  const users=DB.get("users")||{};
  const e=Object.keys(users).find(k=>users[k]&&users[k].id===u.coachId);
  if(e) return e.replace(/\./g,',');
  // DERNIER RECOURS, ET IL EST BORNE. Sur le telephone de l'athlete, `users` ne
  // contient QUE son propre dossier — les regles RTDB refusent celui du coach —
  // donc la recherche ci-dessus n'y rend jamais rien. La clef mise de cote avec
  // le profil public, elle, est locale et porte l'adresse du coach.
  //
  // CE QU'ELLE RATTRAPE, ET CE QU'ELLE NE RATTRAPE PAS. Le cache n'est ecrit que
  // par pullProfilCoach, qui recoit deja la clef : il ne peut donc pas la faire
  // apparaitre chez un athlete qui ne l'a JAMAIS eue. Il la rend a celui qui
  // l'avait et l'a perdue — un dossier ecrase par une copie distante plus
  // ancienne, une restauration depuis un export d'avant coachEmailKey. C'est
  // etroit, et c'est gratuit ; ce n'est pas une raison de ne pas le faire.
  //
  // APRES le garde coachId, jamais avant : un coach n'a pas de coachId et sort
  // plus haut, sans quoi il recuperait ici la clef d'un cache qui n'est pas le
  // sien.
  try{
    const b=JSON.parse(localStorage.getItem("rc_coach_profil")||"null");
    if(b&&b.key) return b.key;
  }catch(err){}
  return null;
}
// Profil public du coach, tel que rapatrie a la derniere connexion. Sert aussi
// hors ligne : c est la seule copie que l athlete possede.
function profilCoachLocal(key){
  try{
    const b=JSON.parse(localStorage.getItem("rc_coach_profil")||"null");
    return b&&(!key||b.key===key)?b.d:null;
  }catch(e){ return null; }
}

// PURE. LE DOSSIER DU COACH TEL QU'ON PEUT L'AFFICHER — et la seule façon de
// le lire.
//
// SUR LE TÉLÉPHONE DE L'ATHLÈTE, `users` NE CONTIENT QUE SON PROPRE DOSSIER :
// les règles RTDB refusent le dossier complet du coach, et pullProfilCoach
// range délibérément la photo HORS de currentUser — en base64, elle repartirait
// vers Firebase à chaque synchronisation, dupliquée autant de fois qu'il y a
// d'athlètes. Chercher `x.id === coachId` dans `users` ne rend donc RIEN chez
// un athlète, et c'est exactement pour cela que la photo du coach n'apparaissait
// pas sur l'écran nutrition : les deux rendus la cherchaient là, et nulle part
// ailleurs. Seul l'accueil lisait coach_public, par profilCoachLocal.
//
// LE DOSSIER LOCAL RESTE LU, et il sert dans un seul cas : sur l'appareil du
// COACH, où son propre dossier est bien là et où aucun profil public n'est en
// cache.
//
// LA FUSION RETIENT LA PREMIÈRE VALEUR NON VIDE, champ par champ. Un
// Object.assign laisserait le public écraser le local avec du vide — c'est la
// leçon déjà payée par ouvrirVitrineCoach, qui effaçait le dossier du coach
// sur son propre appareil.
function coachAffichable(user,usrs){
  const u=user||currentUser;
  if(!u||!u.coachId) return null;
  const map=usrs||DB.get('users')||{};
  const loc=Object.values(map).find(x=>x&&x.id===u.coachId)||{};
  let pub=null;
  try{ pub=profilCoachLocal(cleCoachDe(u)); }catch(e){ pub=null; }
  const out=Object.assign({},loc);
  const plein=v=>Array.isArray(v)?v.length>0:!!(v&&String(v).trim());
  for(const k of Object.keys(pub||{})){
    if(plein(pub[k])||out[k]===undefined) out[k]=pub[k];
  }
  return out;
}
// La photo, et rien d'autre : c'est ce que trois écrans demandent.
function photoCoachDe(user,usrs){
  const c=coachAffichable(user,usrs);
  return (c&&c.coachPhoto)||'';
}
// LA MARQUE DU COACH : son logo, ou à défaut sa signature. Kevin, 09/09/2026 :
// « soit signature ou logo, qu'il puisse mettre l'un des deux ».
//
// L'ORDRE EST UNE DECISION, pas un hasard. Le logo passe devant parce qu'il est
// fait pour être posé sur autre chose ; une signature manuscrite n'a été
// pensée que pour le bas d'une vitrine. Un coach qui remplit les deux verra
// donc son logo sur les séances de ses athlètes, et sa signature sur sa page.
//
// PURE, et elle rend toujours une chaîne : une image sans marque est un cas
// normal — l'athlète n'a pas forcément de coach.
function marqueCoachDe(user,usrs){
  const c=coachAffichable(user,usrs);
  if(!c) return '';
  return String(c.logo||c.signature||'');
}
// ══ LA SIGNATURE D'UN EXPORT (Kevin, 05/10/2026) ════════════════════════════
//
// « Chaque export doit porter une signature : RepCore, le coach, l'athlète
// destinataire, la date. Discrète en pied de page pour les documents, intégrée
// au visuel pour les images. » Aucun document ne portait les quatre : chacun
// composait son en-tête à la main.
//
// PURE. Elle lit le dossier qu'on IMPRIME (jamais currentUser : quand le coach
// imprime pour un athlète, ce n'est pas le même). Chaque morceau absent est
// sauté. Le texte sort BRUT : chaque document l'échappe.
//   o.date     : la date à écrire (défaut : maintenant) ;
//   o.athlete  : false pour ne pas nommer l'athlète (visuels où un test l'interdit).
function signatureCoachNom(u){
  if(!u) return '';
  const net=x=>String(x==null?'':x).replace(/\s+/g,' ').trim();
  if(u.role==='coach') return net(u.teamName)||net((u.fname||'')+' '+(u.lname||''));
  let c=null; try{ c=coachAffichable(u)||null; }catch(e){ c=null; }
  return net(c&&c.teamName)||net(((c&&c.fname)||'')+' '+((c&&c.lname)||''))||net(u.coachName);
}
function signatureDocument(u,o){
  const opt=o||{};
  const coach=signatureCoachNom(u);
  const ath=(u&&u.role!=='coach'&&opt.athlete!==false)?String(((u.fname||'')+' '+(u.lname||''))).replace(/\s+/g,' ').trim():'';
  // La date en toutes lettres : « 6 octobre 2026 ». En chiffres, « 06/10/2026 »
  // se lisait « /10 » dans un document qui s'interdit toute note.
  let d=''; try{ d=new Date(opt.date||Date.now()).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(e){ d=''; }
  return ['RepCore',coach?'Coach '+coach:'',ath?'pour '+ath:'',d].filter(Boolean).join(' · ');
}
// Le pied d'un document imprimé, déjà échappé.
function htmlSignatureDocument(u,o){
  return '<p class="doc-sign">'+escapeHtml(signatureDocument(u,o))+'</p>';
}

// ══════ CONTACT COACH : UN CONSENTEMENT, PAS UN CHAMP ══════
// Le numéro personnel du coach vivait dans coach_public.phone, lisible par
// TOUS ses athlètes rattachés — la règle RTDB ne portait qu'un .validate
// d'écriture, la lecture étant ouverte par le nœud parent. Personne n'avait
// jamais dit oui.
//
// Trois états, et le défaut est le silence. Sous 'whatsapp', le numéro n'est
// publié qu'avec un consentement HORODATÉ, révocable d'un geste — RGPD
// art. 7.3 : retirer doit être aussi simple qu'accorder.
const CONTACT_MODES=Object.freeze(['aucun','whatsapp','email']);
const CONTACT_JOURNAL_MAX=100;
// MIGRATION RESTRICTIVE, et c'est le point qui compte : un phone hérité, sans
// consentAt, bascule en 'aucun'. Jamais l'inverse. Un consentement ne se
// déduit pas d'un champ rempli à une époque où la question n'était pas posée.
//
// PURE : elle ne réécrit rien, elle LIT. La bascule est un défaut de lecture,
// pas une écriture au chargement.
function contactCoach(pub){
  const c=(pub||{}).contact;
  const vide={mode:'aucun',consentAt:null,horaires:''};
  if(!c||typeof c!=='object') return vide;
  const mode=CONTACT_MODES.indexOf(c.mode)>=0?c.mode:'aucun';
  if(mode==='aucun') return vide;
  // Un mode sans consentement horodaté ne vaut rien : c'est exactement le
  // cas du phone hérité.
  if(!c.consentAt||typeof c.consentAt!=='string') return vide;
  return {mode:mode,consentAt:c.consentAt,
    horaires:typeof c.horaires==='string'?c.horaires.slice(0,200):''};
}
// PURE. Le numéro publiable, ou ''. Un numéro corrompu ou non exploitable
// par wa.me retombe silencieusement sur 'aucun' — un bouton mort vaut moins
// que pas de bouton.
function contactNumero(pub){
  const c=contactCoach(pub);
  if(c.mode!=='whatsapp') return '';
  const n=_numWa((pub||{}).phone);
  return (n&&n.length>=8)?n:'';
}
// Journal des RENVOIS : une date, un destinataire HASHÉ, rien d'autre. Ni le
// contenu de l'échange, ni le numéro, ni un identifiant en clair. RepCore ne
// reçoit pas ce qui se dit sur WhatsApp et n'a pas à le savoir.
//
// Le hash est un FNV-1a tronqué : il ne sert pas à protéger un secret — un
// identifiant d'athlète n'en est pas un — mais à éviter qu'un journal exporté
// nomme des personnes. Il suffit à dédoublonner, pas à réidentifier.
function _hashCourt(x){
  const s2=String(x||'');
  let h=2166136261;
  for(let i=0;i<s2.length;i++){ h^=s2.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(36);
}
// Borné à 100 : un journal qui grossit sans fin finit par peser dans le
// document poussé à chaque synchronisation, et personne ne lit la 400e ligne.
function journaliserRenvoi(coach,athleteId,ref){
  if(!coach||typeof coach!=='object') return null;
  if(!Array.isArray(coach.journalRenvoi)) coach.journalRenvoi=[];
  const d=(ref instanceof Date?ref:new Date()).toISOString();
  coach.journalRenvoi.push({d:d,a:_hashCourt(athleteId)});
  if(coach.journalRenvoi.length>CONTACT_JOURNAL_MAX)
    coach.journalRenvoi=coach.journalRenvoi.slice(-CONTACT_JOURNAL_MAX);
  return coach.journalRenvoi;
}
// Ce que l'athlète lit avant de partir. Il quitte RepCore : le dire est la
// moindre des choses, et ça vaut mieux qu'un bouton qui ouvre une autre app
// sans prévenir.
const CONTACT_SORTIE='Tu quittes RepCore. Cet échange ne sera pas conservé '
  +'dans ton dossier.';
// Ce que le coach lit en révoquant. Une révocation empêche les FUTURS accès ;
// elle ne rappelle pas ce qui a déjà été communiqué, et prétendre le
// contraire serait mentir.
const CONTACT_REVOCATION='Tes athlètes ne verront plus ton numéro. Ceux qui '
  +'l\'ont déjà noté le gardent : une révocation ne rappelle pas ce qui a été '
  +'communiqué.';

// ══════════════ CADRE DE DISPONIBILITÉ DU COACH ═══════════════════════════
// Le coach déclare un délai de réponse HABITUEL et des plages ; l'athlète le
// lit au moment où il écrit. Un mode absence daté informe — il n'empêche
// jamais un envoi.
//
// AUCUNE PROMESSE. Le vocabulaire est « habituellement », jamais « garanti »
// ni « sous 24 h maximum » : un délai affiché ne doit pas se lire comme un
// engagement contractuel. Une assertion l'interdit littéralement.
//
// FUSEAUX. L'app ne stocke le fuseau de personne. Les heures déclarées sont
// donc comparées à l'horloge LOCALE de qui regarde — l'athlète voit son heure
// à lui, ce que demande la règle 8. Limite assumée et à dire : un coach à
// Montréal qui déclare 9 h-19 h sera lu 9 h-19 h par un athlète à Paris.
const DISPO_ABSENCE_MAX_J=90;
const DISPO_DELAI_MIN_H=1, DISPO_DELAI_MAX_H=168;   // 1 h à 7 jours
const DISPO_MEDIAN_FENETRE_J=30;

function _dispoMinutes(hhmm){
  const m=/^(\d{1,2}):(\d{2})$/.exec(String(hhmm||'').trim());
  if(!m) return null;
  const h=+m[1], mn=+m[2];
  if(!(h>=0&&h<=23&&mn>=0&&mn<=59)) return null;
  return h*60+mn;
}
// PURE. Vrai si `now` tombe dans l'une des plages déclarées.
//
// Une plage dont la fin est AVANT le début traverse minuit (22:00 → 02:00) :
// elle vaut alors du début à minuit le jour dit, et de minuit à la fin le
// LENDEMAIN. L'ignorer aurait rendu toute plage de nuit systématiquement
// fausse, sans que rien ne le signale.
function dispoEstDansPlage(dispo,now){
  const l=(dispo&&Array.isArray(dispo.plages))?dispo.plages:[];
  if(!l.length) return false;
  const d=(now instanceof Date)?now:new Date(now||Date.now());
  const jour=d.getDay(), min=d.getHours()*60+d.getMinutes();
  const veille=(jour+6)%7;
  for(const p of l){
    if(!p) continue;
    const deb=_dispoMinutes(p.debut), fin=_dispoMinutes(p.fin);
    if(deb==null||fin==null) continue;
    const j=Number(p.jour);
    if(!(j>=0&&j<=6)) continue;
    if(deb<fin){ if(j===jour&&min>=deb&&min<fin) return true; }
    else if(deb>fin){
      // Traverse minuit : la soirée du jour dit, puis le petit matin du suivant.
      if(j===jour&&min>=deb) return true;
      if(j===veille&&min<fin) return true;
    }
  }
  return false;
}
// PURE. Une absence doit porter une date de FIN : sans elle, elle ne s'éteint
// jamais et l'athlète ne sait pas quand revenir. Quatre-vingt-dix jours au
// plus, renouvelable — au-delà ce n'est plus une absence, c'est un arrêt.
function absenceValide(absence,now){
  if(!absence) return false;
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  const au=_dispoTs(absence.au);
  if(au==null) return false;                       // date de fin OBLIGATOIRE
  const du=_dispoTs(absence.du);
  const debut=(du==null)?t:du;
  if(au<=debut) return false;                      // une fin avant le début n'est pas une absence
  return (au-debut)<=DISPO_ABSENCE_MAX_J*864e5;
}
function _dispoTs(v){
  if(v==null||v==='') return null;
  if(typeof v==='number') return isFinite(v)?v:null;
  const t=Date.parse(v);
  return isFinite(t)?t:null;
}
// L'absence s'éteint TOUTE SEULE à sa date de fin : le coach n'a rien à
// décocher au retour, et un oubli ne laisse pas un bandeau mensonger.
function absenceEnCours(dispo,now){
  const a=dispo&&dispo.absence;
  if(!a||a.actif!==true) return false;
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  if(!absenceValide(a,t)) return false;
  const du=_dispoTs(a.du), au=_dispoTs(a.au);
  if(du!=null&&t<du) return false;
  return t<au;
}
function _dispoDateCourte(ts){
  try{ return new Date(ts).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}); }
  catch(e){ return ''; }
}
// PURE. Le texte que lit l'athlète. Chaîne vide = aucun cadre déclaré, donc
// rien à afficher : mieux vaut le silence qu'un délai inventé.
function dispoLibelle(dispo,now){
  if(!dispo) return '';
  if(absenceEnCours(dispo,now)){
    const au=_dispoTs(dispo.absence.au);
    return 'Absent jusqu\'au '+_dispoDateCourte(au);
  }
  const h=Number(dispo.delaiH);
  if(!(h>=DISPO_DELAI_MIN_H&&h<=DISPO_DELAI_MAX_H)) return '';
  // « habituellement » : c'est une habitude constatée, pas un engagement.
  if(h<24) return 'Répond habituellement sous '+Math.round(h)+' h';
  const j=Math.round(h/24);
  return j<=1?'Répond habituellement sous 24 h'
             :'Répond habituellement sous '+j+' jours';
}
// PURE. Délai médian de réponse en heures, sur les trente derniers jours.
// RÉSERVÉ AU COACH : ce n'est pas un score, il ne sort jamais vers l'athlète
// ni vers un tiers. La liste blanche CHAMPS_PROFIL_COACH l'en empêche
// structurellement — il n'y figure pas, et une assertion le vérifie.
function delaiMedianReponse(echanges,now){
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  const limite=t-DISPO_MEDIAN_FENETRE_J*864e5;
  const h=[];
  for(const e of (Array.isArray(echanges)?echanges:[])){
    if(!e) continue;
    const envoi=_dispoTs(e.date), rep=_dispoTs(e.reponseDate);
    if(envoi==null||rep==null) continue;
    if(rep<envoi) continue;                 // horodatage incohérent : on l'écarte
    if(envoi<limite) continue;
    h.push((rep-envoi)/36e5);
  }
  if(!h.length) return null;
  h.sort((a,b)=>a-b);
  const m=h.length%2
    ? h[(h.length-1)/2]
    : (h[h.length/2-1]+h[h.length/2])/2;
  return Math.round(m*10)/10;
}
// Les bilans sont le SEUL échange horodaté des deux côtés : l'athlète envoie
// (b.date), le coach répond (b.reponseDate). Le contact direct sort de l'app
// et la vidéo ne porte pas de date de réponse exploitable.
function dispoEchangesDe(clients){
  const out=[];
  for(const c of (Array.isArray(clients)?clients:[]))
    for(const b of ((c&&c.bilans)||[]))
      if(b&&b.date&&b.reponseDate) out.push({date:b.date,reponseDate:b.reponseDate});
  return out;
}
// LA SANTÉ PASSE AVANT L'INTENDANCE. Drapeau rouge ou douleur au-dessus du
// seuil : le cadre de disponibilité ne s'applique pas, et une trace est
// écrite. Elle remonte par la synchronisation ordinaire — sans serveur, c'est
// l'appareil du coach qui lèvera la notification à sa prochaine ouverture.
function dispoSanteForce(user){
  try{
    // LE SIGNE GÉNÉRAL EN PREMIER, et pas seulement en plus : _suspTextes lui
    // associe TEXTE_ARRET_GENERAL — « Arrête l’entraînement et fais-toi
    // examiner » — qui est le texte le plus protecteur du produit. Quand les
    // deux familles sont actives, c’est celui-là qu’il faut afficher.
    if(drapeauGeneralActif(user)) return 'general';
    if(drapeauRougeActif(user)) return 'drapeau';
    const sg=signauxEntrainement(user);
    if(sg&&(sg.douleur||sg.douleurDiffuse)) return 'douleur';
  }catch(e){}
  return null;
}
// PURE (au dossier pres). LES DEUX CANAUX EXTERNES DU COACH, separement.
// ⚠ EXTRAITE DE _coachContactHref SANS CHANGER UNE VIRGULE DE LA REGLE. Deux
// endroits resolvent desormais le meme coach — le lien unique de l'ecran
// d'acces expire, et les trois boutons de l'accueil : recopier la resolution
// aurait fabrique deux verites, et c'est exactement ce que le commentaire
// ci-dessous interdit depuis le debut.
function _canauxCoach(coachId,users){
  const vide={whatsapp:'',mail:''};
  if(!coachId) return vide;
  const us=users||DB.get('users')||{};
  const coach=Object.values(us).find(x=>x&&x.id===coachId);
  const _cle=cleCoachDe(currentUser);
  const _pub=profilCoachLocal(_cle);
  const email=Object.keys(us).find(k=>us[k]&&us[k].id===coachId)
    ||(_cle?_cle.replace(/,/g,'.'):null);
  const _src=contactNumero(coach)?coach:_pub;
  return {whatsapp:contactNumero(_src)||'', mail:email||'', src:_src};
}
function _coachContactHref(coachId,texte,users){
  if(!coachId) return '';
  const us=users||DB.get('users')||{};
  const coach=Object.values(us).find(x=>x&&x.id===coachId);
  // Sur le téléphone de l'athlète, le dossier du coach est absent : ni numéro
  // ni adresse. Le profil public porte le numéro, et coachEmailKey l'adresse.
  const _cle=cleCoachDe(currentUser);
  const _pub=profilCoachLocal(_cle);
  const email=Object.keys(us).find(k=>us[k]&&us[k].id===coachId)
    ||(_cle?_cle.replace(/,/g,'.'):null);
  // LE CONSENTEMENT COMMANDE. Sans lui, aucun numéro ne devient un lien —
  // ni celui du profil public, ni celui du dossier local. Le repli email
  // ci-dessous reste : joindre son coach par mail n'expose pas un numéro
  // personnel, et l'adresse sert déjà à l'authentification.
  //
  // ON CHOISIT LA SOURCE QUI PORTE UN NUMÉRO CONSENTI, pas celle qui porte
  // un numéro. L'ancien « coach?.phone ? coach : _pub » se décidait sur la
  // seule présence d'un phone : un dossier coach portant un numéro hérité,
  // sans objet `contact`, masquait le profil public qui, lui, portait le
  // consentement. contactNumero rendait '' et « Un souci ? » retombait sur
  // le mail alors que le WhatsApp était publié.
  // Aucune permission n'est relâchée : contactNumero exige toujours
  // mode==='whatsapp' ET un consentAt horodaté, sur la source retenue.
  const _src=contactNumero(coach)?coach:_pub;
  const phone=contactNumero(_src);
  if(phone) return texte?waLink(_src.phone,texte):('https://wa.me/'+phone);
  if(!email) return '';
  return 'mailto:'+email+(texte?'?subject='+encodeURIComponent('RepCore')+'&body='+encodeURIComponent(texte):'');
}
// safeUrl n'autorise que http(s) : un lien mailto: y deviendrait '#', soit
// exactement le bouton mort qu'on cherche à éviter quand le coach n'a pas
// renseigné de numéro. Allow-list resserrée sur les deux seules formes que
// _coachContactHref sait produire, et échappement d'attribut conservé.
function _safeContactUrl(u){
  const s=String(u||'').trim();
  return /^(https:\/\/wa\.me\/|mailto:)/i.test(s)?escapeHtml(s):'#';
}
function _telAthlete(c){return _numWa(c?.phone);}
// Un numéro est enregistré mais inexploitable : le dire précisément, sinon le
// coach lit « numéro non enregistré » alors qu'il vient de le saisir.
function _telInutilisable(c){return !!(c&&c.phone)&&!_numWa(c.phone);}
// Textes contextualisés par type de ligne « À traiter ». Point de départ, pas
// message final : rien n'est envoyé sans que le coach ait validé dans WhatsApp.
function _waTexteTodo(type,c){
  const p=c?.fname||'';
  const j=n=>n+' jour'+(n>1?'s':'');
  const dernier=(c?.bilans||[]).reduce((m,b)=>Math.max(m,b.date),0);
  if(type==='overdue'){
    // needsAlert se déclenche à 14 jours : le « retard » est ce qui dépasse.
    const retard=Math.max(1,Math.floor((Date.now()-dernier)/864e5)-14);
    return 'Salut '+p+', je vois que ton bilan est en retard de '+j(retard)
      +' : tu peux le remplir quand tu veux dans l\'app 💪';
  }
  if(type==='nostart'){
    const depuis=Math.max(1,Math.floor((Date.now()-(c?.createdAt||0))/864e5));
    return 'Salut '+p+', tu es inscrit depuis '+j(depuis)
      +' et je n\'ai pas encore ton premier bilan : dis-moi si tu bloques sur quelque chose, on démarre quand tu veux 💪';
  }
  if(type==='expiring'){
    const reste=Math.max(1,Math.ceil(((c?.accessExpiry||0)-Date.now())/864e5));
    return 'Salut '+p+', ton accès RepCore arrive à échéance dans '+j(reste)
      +' : pense à le renouveler pour garder ton suivi 💪';
  }
  if(type==='bilan') return 'Salut '+p+', j\'ai bien reçu ton bilan, je le regarde et je reviens vers toi rapidement 💪';
  if(type==='noprog') return 'Salut '+p+', je prépare ton programme, je te l\'envoie très vite 💪';
  // Signaux d'entraînement. Ces messages POSENT UNE QUESTION et ne donnent
  // aucun conseil : ni « arrête cet exercice », ni « baisse la charge », ni
  // quoi que ce soit qui ressemble à un avis médical. C'est au coach d'écrire
  // la suite, le texte n'est qu'une amorce qu'il relit avant d'envoyer.
  //
  // ET IL NE NOMME PAS LA DOULEUR. Même règle que _frTexteRelance : le canal
  // est NON CHIFFRÉ, aucune donnée de santé n'y entre. Ce texte disait « je
  // vois que tu as noté de la douleur sur tes dernières séances » — un fait
  // de santé, écrit en clair, sur un fil que l'athlète n'a pas choisi et que
  // n'importe qui lisant son téléphone voit. Le projet a par ailleurs retiré
  // tout lien de contact du bloc DOULEUR pour cette raison exacte.
  // Le message garde toute son utilité : il demande un point AVANT la
  // prochaine séance. Le coach sait pourquoi il écrit ; le message ne le dit
  // pas, et c'est l'athlète qui nomme ce qu'il veut nommer.
  if(type==='douleur'||type==='douleurdiff')
    return 'Salut '+p+', j\'aimerais faire un point avec toi avant ta prochaine '
      +'séance. Dis-moi quand tu es dispo 💪';
  if(type==='decrochage')
    return 'Salut '+p+', je vois que tes dernières séances n\'ont pas été terminées. '
      +'Dis-moi ce qui bloque : le temps, la fatigue, un exercice en particulier ? 💪';
  if(type==='entrainement')
    return 'Salut '+p+', ta progression marque le pas en ce moment. On regarde ça ensemble ? 💪';
  return 'Salut '+p+' 💪';
}
// Corps GÉNÉRIQUE pour l'envoi groupé : ni prénom, ni compteur de jours.
// Le texte individuel de _waTexteTodo porte les chiffres d'UN athlète ; le
// pré-remplir dans la modale groupée envoyait à tout le monde le retard du
// premier de la liste, avec son prénom. Chaque lien est ré-adressé dans
// _wagPreparer avec « Salut <prénom>, » + ce corps.
function _waCorpsGroupe(type){
  if(type==='overdue') return 'je vois que ton bilan est en retard : tu peux le remplir quand tu veux dans l\'app 💪';
  if(type==='nostart') return 'je n\'ai pas encore ton premier bilan : dis-moi si tu bloques sur quelque chose, on démarre quand tu veux 💪';
  if(type==='expiring') return 'ton accès RepCore arrive bientôt à échéance : pense à le renouveler pour garder ton suivi 💪';
  if(type==='bilan') return 'j\'ai bien reçu ton bilan, je le regarde et je reviens vers toi rapidement 💪';
  if(type==='noprog') return 'je prépare ton programme, je te l\'envoie très vite 💪';
  if(type==='inactif') return 'ça fait un moment qu\'on ne t\'a pas vu à l\'entraînement : comment ça va ? 💪';
  return '';
}
// Bouton de contact d'une ligne « À traiter ». AU TRAIT, ET NON EN EMOJI :
// une bulle emoji est verte chez Apple, grise chez Google et jaune vif sur
// certains Android — elle ne peut pas porter la couleur du bouton, et elle
// jure avec les seize signaux de la ligne, qui sont tous des traits.
// Un seul athlète → vrai lien <a> : un clic, et aucun bloqueur de fenêtres ne
// s'interpose. Plusieurs → ouvre la sélection groupée pré-cochée sur cette
// ligne, où chaque envoi reste un geste distinct.
function _waBoutonTodo(r,idx){
  const style='background:none;border:1px solid #1e3a1e;color:var(--green);border-radius:var(--r-2);'
    +'min-width:34px;min-height:34px;padding:0 8px;font-size:var(--fs-md);cursor:pointer;flex-shrink:0;'
    +'display:inline-flex;align-items:center;justify-content:center;text-decoration:none';
  if(r.list.length===1){
    const c=r.list[0];
    const tel=_telAthlete(c);
    const titre=tel?'Écrire à '+(c.fname||'')+' sur WhatsApp'
      :'Ouvrir WhatsApp avec le message pré-rempli ('+(c.fname||'cet athlète')+' n\'a pas de numéro enregistré)';
    return `<a href="${safeUrl(waLink(tel,_waTexteTodo(r.type,c)))}" target="_blank" rel="noopener"
      onclick="event.stopPropagation();rcmCoach('coach_message_envoye');noterContact(${_attrArg(c.id)})" title="${escapeHtml(titre)}" aria-label="${escapeHtml(titre)}"
      style="${style}${tel?'':';opacity:.55'}">${icon('message-circle',16)}</a>`;
  }
  // LIGNE GROUPÉE : « Message » ouvre la feuille, ses athlètes cochés et le
  // texte du signal ; l'envoi part dans l'app (ou sur WhatsApp, en second).
  return `<button onclick="event.stopPropagation();openWaGroupe(${idx})"
    title="Message aux ${r.list.length} athlètes de cette ligne" aria-label="Message aux ${r.list.length} athlètes de cette ligne"
    style="${style}">${icon('message-circle',16)}</button>`;
}
// ── Envoi groupé ────────────────────────────────────────────────────────────
// Appelée sans argument depuis le dashboard, ou avec l'index d'une ligne
// « À traiter » pour pré-cocher exactement ses athlètes.
// Pas de boucle window.open : au-delà de la première, le navigateur les bloque
// et le coach croirait avoir écrit à tout le monde. Chaque destinataire reçoit
// son propre lien, donc son propre geste — rien ne peut être avalé en silence.
// ══ CANAL DU COACH ══════════════════════════════════════════════════════════
// Un fil de diffusion, pas une messagerie : le coach écrit, l'athlète lit et
// réagit. Il n'y a AUCUN champ de saisie côté athlète, et c'est délibéré — un
// fil où douze athlètes se répondent exposerait leurs prénoms les uns aux
// autres, ce que RepCore n'a jamais fait.
//
// CE MODULE REMPLACE « Mot du coach ». L'ancien recopiait le message dans le
// dossier de CHAQUE athlète : les athlètes connus par leur seul code ne le
// recevaient jamais, l'historique était perdu à chaque nouveau mot, et le texte
// repartait vers Firebase à chaque sauvegarde de dossier. Ici, un seul
// exemplaire vit dans /canaux/{coach}, et le dossier des athlètes n'est pas
// touché du tout. Le champ `annonce` des anciens dossiers devient inerte, sans
// migration — même traitement que welcomeAudio lors du retrait du message vocal.
//
// CE QUI N'EST PAS PROMIS : le téléphone ne sonnera pas. Le plan Spark ne fait
// tourner aucune Cloud Function et rien ne s'abonne au push. Un message se
// découvre à l'ouverture de l'app, et les écrans le disent.
const CANAL_TITRE_MAX=80;
const CANAL_TEXTE_MAX=1000;
const CANAL_LIEN_MAX=500;
// Le fil affiché est borné. Ce n'est pas une pagination — au-delà, les messages
// restent dans Firebase mais ne descendent plus. Vingt cartes couvrent
// largement l'usage d'un coach, et bornent ce qui transite.
const CANAL_MAX_AFFICHES=20;
const CANAL_EMOJIS=['👍','❤️','💪','🔥'];
const CANAL_VU_CLE='rc_canal_vu';

// Clé Firebase du canal à consulter. Le coach lit le sien, l'athlète celui de
// son coach. cleCoachDe() ne convient pas pour le coach : elle sort sur
// `if(!u.coachId) return null`, et un coach n'a pas de coachId.
function canalCle(u){
  if(!u||!u.email) return null;
  if(u.role==='coach') return u.email.replace(/\./g,',');
  return cleCoachDe(u);
}
// L'onglet est ouvert si — et seulement si — un coach est rattaché. LE GRISÉ
// N'EST PAS LA PROTECTION : les règles refusent la lecture de /canaux à qui n'a
// pas le coachEmailKey correspondant. Trafiquer le HTML ne donne rien.
function canalAccessible(u){
  return !!(u&&u.role==='athlete'&&(u.coachId||u.coachEmailKey));
}

// ── Lectures mémorisées SUR L'APPAREIL, jamais dans le dossier ──────────────
// Le coach ne peut donc pas voir qui a lu, et ne peut pas rallumer une pastille
// en réécrivant un dossier périmé par-dessus — ce que l'écrasement du dossier
// entier rend sinon inévitable. Même raisonnement que rc_annonce_lue.
// Contrepartie assumée : sur un appareil neuf, le fil apparaît une fois non lu.
function _canalVus(){
  try{ const v=JSON.parse(localStorage.getItem(CANAL_VU_CLE)||'{}');
    return (v&&typeof v==='object')?v:{}; }catch(e){ return {}; }
}
function _canalMarquerVu(email,at){
  const m=_canalVus();
  m[String(email||'')]=Number(at)||Date.now();
  try{ localStorage.setItem(CANAL_VU_CLE,JSON.stringify(m)); }catch(e){}
}
// PURE. Le profil coach est passé en paramètre : la règle est éprouvable sans
// toucher ni au stockage ni au réseau.
//
// canalDernier vit dans coach_public, PAS dans /canaux, et c'est ce qui rend la
// pastille gratuite : coach_public est déjà retéléchargé à chaque ouverture de
// l'accueil pour la photo et la phrase du coach. Aller chercher l'horodatage
// dans /canaux coûterait une requête par lancement d'app, à tout le monde, y
// compris à ceux qui n'ouvrent jamais l'onglet.
function canalNonLu(user,profil,vus){
  if(!canalAccessible(user)) return false;
  const dernier=Number(profil&&profil.canalDernier)||0;
  if(!dernier) return false;
  const vu=Number((vus||{})[String(user.email||'')])||0;
  return dernier>vu;
}
// PURE. Le message épinglé, tel qu'il doit s'afficher en bannière d'accueil.
function canalEpingleAAfficher(profil){
  const e=profil&&profil.canalEpingle;
  if(!e||typeof e!=='object') return null;
  const texte=String(e.texte==null?'':e.texte).trim();
  const titre=String(e.titre==null?'':e.titre).trim();
  if(!texte&&!titre) return null;
  return {id:String(e.id||''),titre,texte,lien:String(e.lien||''),at:Number(e.at)||0};
}
// PURE. L'objet Firebase → un tableau ordonné : l'épinglé d'abord, puis du plus
// récent au plus ancien. Object.keys ne garantit aucun ordre, et Firebase rend
// bien un objet, pas un tableau.
function canalTrier(messages){
  if(!messages||typeof messages!=='object') return [];
  return Object.keys(messages)
    .map(id=>Object.assign({id},messages[id]))
    .filter(m=>m&&(m.texte||m.titre))
    .sort((a,b)=>{
      if(!!a.epingle!==!!b.epingle) return a.epingle?-1:1;
      return (Number(b.at)||0)-(Number(a.at)||0);
    })
    .slice(0,CANAL_MAX_AFFICHES);
}
// PURE. Le domaine affiché sur la carte de lien. Sans serveur ni requête
// croisée, RepCore ne peut pas lire le titre d'une page distante : le domaine
// est la seule chose honnête à montrer.
function canalDomaine(lien){
  const s=String(lien==null?'':lien).trim();
  const m=/^https?:\/\/([^/?#]+)/i.exec(s);
  return m?m[1].replace(/^www\./i,''):'';
}
// ── LES PASTILLES D'ONGLET, CHIFFREES ───────────────────────────────────
// Le point rouge disait « il y a du neuf » sans dire combien : un message et
// six messages avaient exactement la meme tete. Et pour le canal, la meme
// information etait POUSSEE UNE SECONDE FOIS en banniere sur l'accueil, au
// milieu des seances, du poids et du rappel de bilan. Deux endroits pour une
// seule chose, dont un qui noyait le reste.
//
// Desormais : le compte vit sur l'icone, en bas, et nulle part ailleurs.
// BUILD 1887 : plusieurs sources par onglet (Coach = bilan + annonces) ; un
// seul chiffre « à traiter ». Pas et sommeil : un point gris, jamais rouge.
const _pastilleSources={};
function _pastilleOnglet(onglet,n,libelle){
  const cible=(typeof ONGLET_PARENT==='object'&&ONGLET_PARENT[onglet])||onglet;
  const btn=document.querySelector('#client-tabbar .tab-btn[data-tab="'+cible+'"]');
  if(!btn) return null;
  const dot=btn.querySelector('.tab-dot');
  const n0=Math.max(0,Math.floor(Number(n)||0));
  _pastilleSources[onglet]={cible,n:n0,lib:(n0>0&&typeof libelle==='function')?libelle(n0):''};
  if(onglet==='lifestyle'){
    const autres=Object.keys(_pastilleSources).filter(k=>k!=='lifestyle'&&_pastilleSources[k].cible===cible).reduce((a,k)=>a+_pastilleSources[k].n,0);
    if(dot&&!autres){ dot.classList.toggle('on',n0>0); dot.classList.toggle('gris',n0>0); dot.classList.remove('chiffre'); dot.textContent=''; }
    if(!autres){ if(n0>0) btn.setAttribute('aria-label',_pastilleSources[onglet].lib); else btn.removeAttribute('aria-label'); }
    return n0;
  }
  const srcs=Object.keys(_pastilleSources).filter(k=>k!=='lifestyle'&&_pastilleSources[k].cible===cible);
  const c=srcs.reduce((a,k)=>a+_pastilleSources[k].n,0);
  if(dot) dot.classList.remove('gris');
  // Plus rien d'autre sur l'onglet : le point gris de Lifestyle reprend sa place.
  const ls=_pastilleSources.lifestyle;
  if(!c&&ls&&ls.cible===cible&&ls.n>0){
    if(dot){ dot.classList.add('on','gris'); dot.classList.remove('chiffre'); dot.textContent=''; }
    btn.setAttribute('aria-label',ls.lib);
    return btn;
  }
  libelle=c>0?(()=>srcs.map(k=>_pastilleSources[k].lib).filter(Boolean).join(' · ')):libelle;
  if(dot){
    dot.classList.toggle('on',c>0);
    // La classe ET le texte : sans le texte la pastille reste un point, sans
    // la classe le chiffre deborde d'un cercle de neuf pixels.
    dot.classList.toggle('chiffre',c>0);
    dot.textContent=c>0?(c>9?'9+':String(c)):'';
  }
  // Le libelle accessible suit le chiffre : une pastille seule ne se percoit
  // qu'a l'oeil, et le lecteur d'ecran annoncerait un onglet sans rien.
  if(c>0&&typeof libelle==='function') btn.setAttribute('aria-label',libelle(c));
  else btn.removeAttribute('aria-label');
  return btn;
}
// ── COMBIEN DE MESSAGES NON LUS ─────────────────────────────────────────
// canalNonLu ne rend qu'un booleen, et il ne peut pas faire mieux : la seule
// chose que l'athlete connaisse sans ouvrir le canal est canalDernier, UN
// horodatage pose dans coach_public. Les messages, eux, vivent dans /canaux.
//
// On memorise donc les horodatages des messages A CHAQUE OUVERTURE du canal.
// Le compte devient exact des la deuxieme visite, et vaut « au moins un »
// avant : mieux vaut annoncer 1 quand il y en a 3 que de ne rien annoncer.
const CANAL_AT_CLE='rc_canal_ats';
function _canalMemoriser(cle,liste){
  if(!cle||!Array.isArray(liste)) return;
  const ats=liste.map(m=>Number(m&&m.at)||0).filter(a=>a>0)
    .sort((a,b)=>b-a).slice(0,60);
  try{
    const t=JSON.parse(localStorage.getItem(CANAL_AT_CLE)||'{}');
    t[String(cle)]=ats;
    localStorage.setItem(CANAL_AT_CLE,JSON.stringify(t));
  }catch(e){}
}
function _canalAtsMemorises(cle){
  try{
    const t=JSON.parse(localStorage.getItem(CANAL_AT_CLE)||'{}');
    const a=t&&t[String(cle)];
    return Array.isArray(a)?a:[];
  }catch(e){ return []; }
}
// PURE quant a sa decision : elle ne lit le stockage que pour affiner le
// compte, jamais pour decider s'il y a du neuf. Cette decision-la reste
// exactement celle de canalNonLu, et les deux ne peuvent pas diverger.
function canalNonLusCompte(user,profil,vus){
  if(!canalNonLu(user,profil,vus)) return 0;
  const vu=Number((vus||{})[String(user&&user.email||'')])||0;
  const n=_canalAtsMemorises(canalCle(user)).filter(a=>a>vu).length;
  return n>0?n:1;
}
// ── LE BILAN DU JOUR ────────────────────────────────────────────────────
// Meme regle que la carte de rappel de l'accueil — _bilTexteRetard rend un
// texte quand un bilan est du, rien sinon. On ne recalcule pas l'echeance
// ici : deux calculs de la meme date finiraient par ne plus dire pareil.
function _bilanAFaireAujourdhui(){
  try{ return !!_bilTexteRetard(_bilRetardJours(getNextBilanSaturday())); }
  catch(e){ return false; }
}
// L'ONGLET OUVERT VAUT LU, POUR LA JOURNEE SEULEMENT. Le bilan reste a faire
// tant qu'il n'est pas rempli, et il se rappellera demain : la pastille
// signale, elle ne harcele pas. Le jour est stocke en clair — une date lisible
// vaut mieux qu'un horodatage a comparer.
const BILAN_ONGLET_CLE='rc_bilan_onglet_vu';
function _bilanOngletVuAujourdhui(){
  try{ return localStorage.getItem(BILAN_ONGLET_CLE)===localISODate(new Date()); }
  catch(e){ return false; }
}
function bilanMarquerOngletVu(){
  try{ localStorage.setItem(BILAN_ONGLET_CLE,localISODate(new Date())); }catch(e){}
}
// ── L'onglet : verrou et pastille ───────────────────────────────────────────
function _majOngletCanal(){
  const btn=document.querySelector('#client-tabbar .tab-btn[data-tab="coach"]');
  if(!btn) return;
  // BUILD 1887 : l'onglet Coach est ouvert dès qu'un coach est rattaché.
  const ouvert=!!(currentUser&&(currentUser.coachEmailKey||currentUser.coachId));
  btn.classList.toggle('verrou',!ouvert);
  // aria-disabled et non l'attribut disabled : le bouton reste atteignable au
  // clavier et mène à la saisie du code coach. Un onglet verrouillé qu'on ne
  // peut même pas atteindre n'expliquerait jamais comment le déverrouiller.
  if(ouvert) btn.removeAttribute('aria-disabled');
  else btn.setAttribute('aria-disabled','true');
  // LE COMPTE, ET PLUS LE SEUL FAIT. _pastilleOnglet efface le libelle quand
  // le compte est nul : le verrou repose donc le sien APRES, sinon il serait
  // retire aussitot pose.
  let n=0; try{ n=(ouvert&&canalAccessible(currentUser))?canalNonLusCompte(currentUser,profilCoachLocal(canalCle(currentUser)),_canalVus()):0; }catch(e){ n=0; }
  _pastilleOnglet('canal',n,c=>'Annonces : '+c+' nouvelle'+(c>1?'s':'')+' annonce'+(c>1?'s':'')+' de ton coach');
  if(!ouvert) btn.setAttribute('aria-label','Coach : réservé aux athlètes suivis');
}

// ── L'écran athlète ─────────────────────────────────────────────────────────
// TROIS SILHOUETTES A LA FORME DE .cnl-carte. Le Canal est le seul ecran
// vraiment suspendu au reseau, et il affichait une phrase sur du vide pendant
// une duree que personne ne maitrise. La classe fx-loop est OBLIGATOIRE :
// c'est elle que le bloc prefers-reduced-motion coupe, sans quoi le balayage
// tournerait a l'infini contre la preference systeme. Trois au maximum : la
// regle interne autorise deux boucles simultanees, trois cartes qui partagent
// la meme keyframe restent tenables, dix ne le seraient pas.
function _canalSquelette(fil){
  if(!fil||fil.dataset.rempli) return false;
  fil.innerHTML=Array(3).fill(
     '<div class="cnl-carte" style="pointer-events:none">'
    +'<div class="skeleton fx-loop" style="height:15px;width:62%;margin-bottom:10px"></div>'
    +'<div class="skeleton fx-loop" style="height:11px;width:88%;margin-bottom:6px"></div>'
    +'<div class="skeleton fx-loop" style="height:11px;width:35%"></div></div>').join('');
  fil._t0=Date.now();
  return true;
}
// Le plancher evite le clignotement sur une reponse instantanee. Il ne
// s'applique QU'AU squelette : une erreur doit s'afficher tout de suite.
async function _canalPlancher(fil){
  if(!fil||!fil._t0) return;
  const _r=250-(Date.now()-fil._t0);
  fil._t0=0;
  if(_r>0) await new Promise(r=>setTimeout(r,_r));
}
function loadCanal(){
  go('s-canal');
  const fil=document.getElementById('canal-fil');
  // ⚠ LA MODALE « 🔒 Canal reserve » EST PARTIE AU LOT 4. Une fenetre posee
  //   par-dessus un ecran vide se referme sans rien laisser ; le fil porte
  //   maintenant ce qui est ferme et ce qui reste possible.
  //   rcVerrouBloc ET NON rcVerrou : la porte du canal ne tient pas a la
  //   capacite seule mais au coach nomme dans le dossier, et c'est
  //   canalAccessible qui le sait.
  if(!canalAccessible(currentUser)){
    if(fil) fil.innerHTML=rcVerrouBloc('canal');
    return;
  }
  _canalSquelette(fil);
  _canalCharger();
}
// La carte proposée à l'athlète sans coach. Elle mène EXACTEMENT là où mène
// déjà la carte de l'accueil quand aucun coach n'est rattaché : deux portes
// visibles, une seule destination.
// ⚠ _canalPorteFermee A ETE SUPPRIMEE AU LOT 4, et la trace reste ici. Elle
//   posait une fenetre « 🔒 Canal reserve aux athletes suivis » par-dessus un
//   ecran vide, avec un bouton « Plus tard » qui la refermait sans rien
//   laisser. Le chantier commercial l'interdit : un ecran ferme s'affiche, et
//   dit dans son corps ce qui est ferme et ce qui reste possible. C'est
//   rcVerrouBloc('canal') qui le dit maintenant, dans le fil lui-meme.
async function _canalCharger(){
  const cle=canalCle(currentUser);
  const fil=document.getElementById('canal-fil');
  if(!fil) return;
  // ══ DEUX CAUSES, ET UN SEUL MESSAGE POUR LES DEUX ═════════════════════
  //
  // « Reviens quand tu auras du réseau » etait dit AUSSI quand le reseau allait
  // tres bien. Un athlete rattache par l'ancienne methode — coachId pose, mais
  // pas coachEmailKey — n'a aucune clef de coach : canalCle rend null, et le
  // conseil donne etait alors faux de bout en bout. Il pouvait attendre le
  // reseau indefiniment, le canal ne se serait jamais ouvert.
  //
  // LE RESEAU D'ABORD : sans lui on ne peut meme pas essayer, et c'est la
  // seule chose a faire. La clef ensuite, et elle a son propre conseil — le
  // seul qui debloque quoi que ce soit, parce que la clef ne peut revenir que
  // par un code d'acces neuf.
  if(!CLOUD.ok()){
    fil.innerHTML=_canalVide('Annonces indisponibles hors connexion.','Reviens quand tu auras du réseau.');
    return;
  }
  if(!cle){
    fil.innerHTML=_canalVide('Rattachement à ton coach incomplet.',
      'Ton compte est bien lié à lui, mais la référence qui ouvre son canal manque sur cet appareil. Demande-lui un nouveau code d\'accès et saisis-le : le canal s\'ouvrira.');
    return;
  }
  const moi=(currentUser.email||'').replace(/\./g,',');
  // Trois requêtes indépendantes. Elles ne peuvent PAS être fusionnées en une
  // seule sur /canaux/{coach} : il n'existe volontairement aucun .read à ce
  // niveau, sans quoi /reactions — qui porte les identifiants — serait descendu
  // par cascade chez tout le groupe.
  //
  // Les messages sont SEULS à pouvoir faire échouer l'écran. Un compteur ou une
  // réaction qui ne descend pas se remplace par zéro sans mentir à personne ;
  // un fil qui ne descend pas doit le dire, jamais s'afficher vide.
  let msgs;
  try{ msgs=await CLOUD.pullCanalMessages(cle); }
  catch(e){
    fil.innerHTML=etatErreur('Ce n\'est pas que ton coach n\'a rien publié : la demande n\'a pas abouti.','Réessayer','_canalCharger()','Annonces injoignables').replace(icon('alerte',28),icon('wifi-off',28));
    return;
  }
  const [compteurs,miennes]=await Promise.all([
    CLOUD.pullCanalCompteurs(cle).catch(()=>null),
    CLOUD.pullMesReactions(cle,moi).catch(()=>null)
  ]);
  window._canalCompteurs=compteurs||{};
  window._canalMiennes=miennes||{};
  // Mémorisée : _canalRepeindre repart de cette liste après chaque réaction.
  // Sans elle, le compteur touché ne changeait jamais à l'écran.
  const liste=canalTrier(msgs);
  window._canalListe=liste;
  // LES DÉFIS : le résumé public et ma feuille, pour chaque défi visible.
  try{ window._canalDefis=await _canalChargerDefis(cle,liste); }catch(e){ window._canalDefis={}; }
  // Les horodatages, pour que la pastille sache COMBIEN la prochaine fois.
  try{ _canalMemoriser(cle,liste); }catch(e){}
  await _canalPlancher(fil);
  // Un rappel sur un fil deja peint — bouton « Reessayer », retour dans
  // l'onglet — ne doit pas vider l'ecran pour y remettre des silhouettes.
  fil.dataset.rempli='1';
  // Les défis en cours épinglés en tête ; les messages système en cartes
  // compactes (_canalHtmlFilAthlete).
  fil.innerHTML=liste.length
    ? _canalHtmlFilAthlete(liste)
    : _canalVide('Rien pour le moment.','Ton coach publiera ici ses annonces et ses liens.');
  // Marqué lu au plus récent AFFICHÉ, et non à Date.now() : si un message
  // arrive pendant le chargement, l'horodater à maintenant l'enterrerait sans
  // qu'il ait jamais été montré.
  const plusRecent=liste.reduce((x,m)=>Math.max(x,Number(m.at)||0),0);
  if(plusRecent) _canalMarquerVu(currentUser.email,plusRecent);
  _majOngletCanal();
  // A partir de la cinquieme carte : les quatre premieres sont deja a l'ecran.
  try{ arcEntreeAuDefilement(fil,'.cnl-carte',4); }catch(e){}
}
function _canalVide(titre,sous){
  return emptyState('mail',escapeHtml(sous),null,null,null,escapeHtml(titre));
}
// La carte d'un message. `mienne` est l'emoji déjà posé par cet athlète, ou ''.
// Les quatre boutons de réaction, communs aux messages et aux défis.
function _canalBoutonsReactions(m,compteurs,mienne){
  return CANAL_EMOJIS.map(e=>{
    const n=Number(compteurs[e])||0;
    const actif=mienne===e;
    return `<button onclick="basculerReaction('${escapeHtml(m.id)}','${escapeHtml(e)}')"
      aria-pressed="${actif?'true':'false'}"
      style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:0 4px;
        background:${actif?'var(--red-bg)':'transparent'};border:1px solid ${actif?'var(--red)':'var(--border)'};
        border-radius:var(--r-4);cursor:pointer;font-size:var(--fs-md);color:${actif?'var(--text)':'var(--text-dim)'};
        font-family:Montserrat,sans-serif;font-weight:700">
      <span aria-hidden="true">${e}</span><span style="font-size:var(--fs-xs)">${n}</span></button>`;
  }).join('');
}
function _canalCarte(m,compteurs,mienne){
  const lien=String(m.lien||'').trim();
  const boutons=_canalBoutonsReactions(m,compteurs,mienne);
  return `<div class="cnl-carte"${m.epingle?' data-epingle':''}>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      ${m.epingle?'<span style="font-size:var(--fs-xs);color:var(--red-text);font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Épinglé</span>':''}
      <span class="sub" style="font-size:var(--fs-xs);letter-spacing:1px;text-transform:uppercase">${escapeHtml(ago(Number(m.at)||Date.now()))}</span>
    </div>
    ${m.titre?`<div class="cnl-titre">${escapeHtml(m.titre)}</div>`:''}
    ${m.texte?`<div class="cnl-texte">${escapeHtml(m.texte)}</div>`:''}
    ${lien?_canalCarteLien(lien):''}
    <div style="display:flex;gap:6px;margin-top:12px">${boutons}</div>
  </div>`;
}
// safeUrl et non escapeHtml sur le href : escapeHtml laisse passer
// « javascript: », et cette confusion exacte a déjà produit une faille sur le
// lien des bannières promo. rel="noopener" : sans lui, la page ouverte garde
// une référence sur window.opener et peut rediriger l'app.
// AUCUNE VIGNETTE, ET C'EST UN CHOIX. Une image d'apercu YouTube etait affichee
// ici : elle etait chargee depuis img.youtube.com, donc ouvrir l'onglet Canal
// transmettait l'adresse IP de l'athlete a Google SANS qu'il ait rien touche.
// C'etait le seul appel automatique a un tiers de toute l'application, dans un
// projet qui a par ailleurs retire tous ses CDN et dont une regle de test
// echoue si l'un d'eux revient. Retiree a la demande de Kevin.
// La carte montre donc le DOMAINE, et rien de plus — pour les autres liens
// (reseaux sociaux, Drive) c'etait de toute facon la seule chose affichable :
// sans serveur, un navigateur ne peut pas lire les balises Open Graph d'une
// page distante.
function _canalCarteLien(lien){
  const dom=canalDomaine(lien);
  if(safeUrlRaw(lien)==='#') return '';
  return `<a href="${safeUrl(lien)}" target="_blank" rel="noopener noreferrer"
    style="display:block;margin-top:12px;border:1px solid var(--border);border-radius:var(--r-3);overflow:hidden;text-decoration:none;background:var(--surface-2)">
    <div style="display:flex;align-items:center;gap:10px;padding:12px 14px">
      <span style="display:inline-flex;color:var(--info);flex-shrink:0">${icon('link',15)}</span>
      <span style="flex:1;min-width:0;font-size:var(--fs-sm);color:var(--info);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(dom||'Ouvrir le lien')}</span>
      <span class="sub" style="font-size:var(--fs-xs);flex-shrink:0">Ouvrir ↗</span>
    </div></a>`;
}

// ── Réactions ───────────────────────────────────────────────────────────────
// Deux écritures, pas une : la réaction nominative dans /reactions, fermée, et
// le compteur public dans /compteurs. C'est cette séparation qui donne le
// « 9 💪 » d'Instagram sans que les athlètes apprennent l'existence les uns des
// autres — un compteur lisible par tous ne porte aucun identifiant.
//
// L'affichage est repeint AVANT le réseau : sur mobile, attendre l'aller-retour
// donne un bouton qui semble mort. Si l'écriture échoue, on remet l'état
// d'avant et on le dit — plutôt qu'un compteur qui ment.
async function basculerReaction(msgId,emoji){
  if(!canalAccessible(currentUser)) return;
  const cle=canalCle(currentUser);
  const moi=(currentUser.email||'').replace(/\./g,',');
  // MEME DISTINCTION QU'AU CHARGEMENT, et pour la meme raison : une clef
  // absente n'est pas une panne de reseau, et le dire ainsi envoie l'athlete
  // attendre quelque chose qui n'arrivera pas.
  if(!CLOUD.ok()){ toast('Réaction impossible hors connexion','var(--orange)'); return; }
  if(!cle){ toast('Rattachement à ton coach incomplet : demande-lui un nouveau code d\'accès.','var(--orange)'); return; }
  const miennes=window._canalMiennes||(window._canalMiennes={});
  const compteurs=window._canalCompteurs||(window._canalCompteurs={});
  const avant=miennes[msgId]||'';
  const apres=(avant===emoji)?'':emoji;
  const c=compteurs[msgId]||(compteurs[msgId]={});
  // Le compteur ne descend jamais sous zéro : les règles rejettent une valeur
  // négative, et un affichage à -1 serait de toute façon absurde.
  if(avant) c[avant]=Math.max(0,(Number(c[avant])||0)-1);
  if(apres) c[apres]=(Number(c[apres])||0)+1;
  if(apres) miennes[msgId]=apres; else delete miennes[msgId];
  _canalRepeindre(msgId);
  try{
    // La réaction D'ABORD, les compteurs ENSUITE — jamais en parallèle. Lancées
    // ensemble, un échec de la réaction laissait quand même partir le « +1 » :
    // le compteur public gagnait un point que /reactions ne portait pas, et
    // seule la resynchronisation manuelle du coach pouvait le rattraper.
    // Sérialisées, un échec de la réaction n'écrit aucun compteur du tout.
    if(apres) await CLOUD.poserReaction(cle,moi,msgId,apres);
    else await CLOUD.retirerReaction(cle,moi,msgId);
    const compte=[];
    if(avant) compte.push(CLOUD.bougerCompteur(cle,msgId,avant,-1));
    if(apres) compte.push(CLOUD.bougerCompteur(cle,msgId,apres,1));
    await Promise.all(compte);
  }catch(e){
    if(avant) c[avant]=(Number(c[avant])||0)+1;
    if(apres) c[apres]=Math.max(0,(Number(c[apres])||0)-1);
    if(avant) miennes[msgId]=avant; else delete miennes[msgId];
    _canalRepeindre(msgId);
    toast('Réaction non enregistrée','var(--orange)');
  }
}
// Repeint le fil entier depuis l'état en mémoire. Repeindre la seule carte
// touchée demanderait de la retrouver dans le DOM par un identifiant, alors que
// le fil fait vingt cartes au plus : le gain serait nul et le risque de
// désynchronisation réel.
function _canalRepeindre(){
  const fil=document.getElementById('canal-fil');
  if(!fil||!window._canalListe) return;
  fil.innerHTML=_canalHtmlFilAthlete(window._canalListe);
}

// ── La bannière d'accueil, alimentée par le message épinglé ─────────────────
// Elle remplace celle du « Mot du coach ». La source n'est plus un champ du
// dossier de l'athlète mais coach_public.canalEpingle — donc UN exemplaire pour
// tout le monde, mis à jour d'une écriture, et qui atteint aussi les athlètes
// connus par leur seul code, que l'ancien système ne touchait jamais.
// ── L'ACCUEIL NE REPREND PLUS LE CANAL ─────────────────────────────────
// Cette banniere reprenait le message epingle EN GRAND sur l'accueil, entre
// les seances, le poids et le rappel de bilan. La meme annonce vivait deja
// dans l'onglet Canal, avec les autres : l'accueil n'en etait que la copie,
// et cette copie poussait vers le bas ce que l'athlete vient chercher — sa
// seance du jour. Demande de Kevin, 10/09/2026 : « ca parasite les infos ».
//
// LA FONCTION RESTE, ET VIDE LA ZONE. Six appelants la nomment ; les faire
// disparaitre un par un, c'est six occasions d'en oublier un et de laisser
// une banniere orpheline. Elle garantit desormais l'inverse de ce qu'elle
// faisait : que #clh-annonce soit vide.
//
// L'annonce n'est pas perdue : canalTrier place l'epingle EN TETE du fil, et
// l'onglet Canal porte maintenant une pastille chiffree qui dit qu'il y a du
// neuf. Un endroit, un signal.
// LA ZONE SERT DESORMAIS A LA RELANCE PHOTO. Elle est en tete de l'accueil,
// elle etait libre depuis que le canal ne s'y recopie plus, et la relance a
// besoin d'exactement ca : un endroit visible, qui revient a chaque ouverture
// tant que la photo manque, sans bloquer quoi que ce soit.
//
// C'est la contrepartie de la photo rendue facultative a l'inscription : la
// grille de visages du coach se remplit en deux jours au lieu d'un, mais plus
// personne ne bute sur un selecteur de fichiers avant meme d'avoir un compte.
// Le bandeau disparait de lui-meme des que la photo est posee.
function renderEpingleAccueil(){
  const el=document.getElementById('clh-annonce');
  if(!el) return;
  const u=currentUser;
  // ⚠ SEULEMENT AVEC UN COACH RATTACHE (QA du 27/09/2026). Le bandeau dit
  //   « permet à ton coach de te reconnaître » : a un athlete sans coach, il
  //   promettait un tableau de bord qui n'existe pas. Meme regle que le canal.
  const manque=!!(u&&u.role==='athlete'&&!u.athletePhoto&&canalAccessible(u));
  if(!manque||accueilMasque('photo')){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML='<div data-acc style="position:relative;background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:14px 40px 14px 14px;margin-bottom:16px">'+_accX('photo')
    +'<div style="font-size:var(--fs-sm);color:var(--text-strong);line-height:1.5;margin-bottom:10px">'
    +'Ajoute ta photo de profil : c\'est ce qui permet à ton coach de te reconnaître '
    +'d\'un coup d\'œil sur son tableau de bord.</div>'
    +'<button class="btn btn-outline btn-sm" style="width:100%" '
    +'onclick="go(\'s-athlete-profile\')">Ajouter ma photo</button></div>';
}

// ══ LES VISUELS DU COACH : « VICTOIRE DE LA SEMAINE » ET RÉCAP D'ÉQUIPE ══════
//
// Même épure que _dessinerBilanSeance (texte blanc, ombre en double passe,
// fond au choix — idée 02), en story 1080×1920 ou en post 1080×1350. Pas de
// QR : à la sortie, _storyCopierLien copie lienPerso(), qui mène un coach à sa
// vitrine publique (/coach/<slug>).
//
// ⚠ LE NOM D'UN ATHLÈTE NE SORT QU'AVEC SON ACCORD. u.consentementPartageCoach
//   = {date}, posé par l'athlète lui-même (réglages, ou son avant/après). Sans
//   lui : anonyme, et seulement anonyme — le prénom et les initiales sont
//   grisés, et le dessin les refuse de lui-même (vcNomAffiche).
// LE FORMAT EST LE RÉGLAGE COMMUN DES VISUELS (VISUEL_FORMATS, visuelFormat) :
// l'ancien VC_FORMATS en était une copie, avec son propre choix.
const VC_MODES=Object.freeze([{k:'prenom',lib:'Prénom'},{k:'initiales',lib:'Initiales'},{k:'anonyme',lib:'Anonyme'}]);
function vcConsentement(u){ const c=u&&u.consentementPartageCoach; return !!(c&&Number(c.date)>0); }
// PURE. Le nom sur le visuel, selon le mode — et l'accord.
function vcNomAffiche(u,mode){
  if(!u||mode==='anonyme'||!vcConsentement(u)) return '';
  const net=x=>String(x||'').replace(/\s+/g,' ').trim();
  const up=x=>{ try{ return x.toLocaleUpperCase('fr-FR'); }catch(e){ return x.toUpperCase(); } };
  if(mode==='initiales'){
    const i=[net(u.fname),net(u.lname)].filter(Boolean).map(x=>x[0]+'.');
    return up(i.join(' '));
  }
  return up(net(u.fname).slice(0,24));
}
// PURE. Les victoires d'un athlète : pour chaque exercice, sa première meilleure
// charge et sa meilleure charge aujourd'hui. Seulement ce qui a progressé, la
// plus forte progression d'abord.
function victoiresDe(u){
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>0&&s.data&&typeof s.data==='object').slice().sort((a,b)=>a.date-b.date);
  const ex={};
  const cle=nm=>{ try{ return resoudreAlias(exKey(nm)); }catch(e){ return String(nm); } };
  for(const s of ses){
    for(const nm of Object.keys(s.data)){
      let cur=0;
      for(const st of (((s.data[nm]||{}).sets)||[])){
        if(!st||st.done!==true) continue;
        const w=parseFloat(st.weight)||0;
        if(w>cur) cur=w;
      }
      if(!cur) continue;
      const k=cle(nm);
      const e=ex[k]||(ex[k]={exo:String(nm).trim(),avant:cur,depuis:s.date,apres:cur,le:s.date});
      if(cur>e.apres){ e.apres=cur; e.le=s.date; e.exo=String(nm).trim(); }
    }
  }
  return Object.keys(ex).map(k=>{
    const e=ex[k];
    return Object.assign({},e,{gain:Math.round((e.apres-e.avant)*10)/10,pct:Math.round((e.apres/e.avant-1)*100)});
  }).filter(e=>e.apres>e.avant).sort((a,b)=>(b.pct-a.pct)||(b.le-a.le));
}
// PURE. Les données du dessin.
function victoireDonnees(u,v,mode){
  if(!v) return null;
  let duree=''; try{ duree=aaEcart(v.depuis,v.le)+' DE SUIVI'; }catch(e){ duree=''; }
  const up=x=>{ try{ return String(x).toLocaleUpperCase('fr-FR'); }catch(e){ return String(x).toUpperCase(); } };
  return {exo:up(v.exo).slice(0,40),avant:v.avant,apres:v.apres,pct:v.pct,duree,nom:vcNomAffiche(u,mode)};
}
function _vcKg(v){ return String(Math.round(Number(v)*10)/10).replace('.',','); }
// La marque et la ligne « COACHÉ AVEC REPCORE », communes aux deux visuels.
// Rend la hauteur consommée.
function _vcPied(g,o,y,W,marque,nomCoach,rouge){
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const cx=W/2, y0=y;
  o.ombre(false);
  g.strokeStyle='rgba(255,255,255,.5)'; g.lineWidth=2;
  g.beginPath(); g.moveTo(W*0.3,y); g.lineTo(W*0.7,y); g.stroke();
  o.ombre(true);
  y+=36;
  if(marque){
    const MH=120, MW=W*0.5;
    const r=Math.min(MW/marque.naturalWidth,MH/marque.naturalHeight);
    const w=Math.round(marque.naturalWidth*r), h=Math.round(marque.naturalHeight*r);
    try{ g.drawImage(marque,Math.round(cx-w/2),y,w,h); }catch(e){}
    y+=h+30;
  }else if(nomCoach){
    g.fillStyle='#fff'; g.textAlign='center';
    const s=o.ajuste(nomCoach,'700',64,BEBAS,W-144,30);
    g.font='700 '+s+'px '+BEBAS; o.ecrire(nomCoach,cx,y+s*0.8);
    y+=s+24;
  }
  g.fillStyle=rouge?'#fff':'rgba(255,255,255,.85)'; g.textAlign='center';
  g.font='800 26px '+MONT; o.ecrireEspace('COACHÉ AVEC REPCORE',cx,y+26,8,true);
  return y+40-y0;
}
function _vcMarque(){ try{ return _marqueCoachPrete(); }catch(e){ return null; } }
function _vcNomCoach(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const n=String((u&&(u.teamName||((u.fname||'')+' '+(u.lname||''))))||'').replace(/\s+/g,' ').trim();
  try{ return n.toLocaleUpperCase('fr-FR'); }catch(e){ return n.toUpperCase(); }
}
/**
 * « VICTOIRE DE LA SEMAINE » — l'exercice, avant → après, la durée du suivi,
 * la marque du coach, « COACHÉ AVEC REPCORE ». `format` : 'story' | 'post'.
 */
function _dessinerVictoireCoach(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent', rouge=f==='rouge';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const o=_visuelOutils(g), M=72, LARG=W-M*2, cx=W/2;
  const marque=_vcMarque();
  const ligne=_vcKg(d.avant)+' → '+_vcKg(d.apres)+' KG';
  g.font='700 230px '+BEBAS;
  const cs=o.ajuste(ligne,'700',format==='post'?200:230,BEBAS,LARG,90);
  const hNom=d.nom?120:0;
  const HTOT=64+hNom+84+cs*0.9+40+120+70+40+(marque?190:110)+40;
  let y=Math.max(90,Math.round((H-HTOT)/2));
  g.textAlign='center'; g.textBaseline='alphabetic';
  o.ombre(true);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE;
  const ss=o.ajusteEspace('VICTOIRE DE LA SEMAINE','800',40,MONT,10,LARG,24);
  g.font='800 '+ss+'px '+MONT; o.ecrireEspace('VICTOIRE DE LA SEMAINE',cx,y+ss,10,true);
  y+=64;
  if(d.nom){
    g.fillStyle='#fff';
    const ns=o.ajuste(d.nom,'700',110,BEBAS,LARG,48);
    g.font='700 '+ns+'px '+BEBAS; o.ecrire(o.coupe(d.nom,LARG),cx,y+ns*0.82);
    y+=hNom;
  }
  g.fillStyle='rgba(255,255,255,.92)';
  const es=o.ajusteEspace(d.exo,'800',46,MONT,5,LARG,24);
  g.font='800 '+es+'px '+MONT; o.ecrireEspace(o.coupeEspace(d.exo,5,LARG),cx,y+es,5,true);
  y+=84;
  g.fillStyle='#fff'; g.font='700 '+cs+'px '+BEBAS; o.ecrire(ligne,cx,y+cs*0.82);
  y+=cs*0.9+40;
  if(d.pct>0){
    g.fillStyle=rouge?'#fff':'#ff3b3b'; g.font='700 120px '+BEBAS;
    o.ecrire('+'+d.pct+' %',cx,y+98);
  }
  y+=120;
  if(d.duree){
    g.fillStyle='rgba(255,255,255,.88)';
    const ds=o.ajusteEspace(d.duree,'700',34,MONT,4,LARG,20);
    g.font='700 '+ds+'px '+MONT; o.ecrireEspace(o.coupeEspace(d.duree,4,LARG),cx,y+ds,4,true);
  }
  y+=70+40;
  _vcPied(g,o,y,W,marque,_vcNomCoach(),rouge);
  o.ombre(false);
  return cv;
}
// ── Le récap d'équipe ──────────────────────────────────────────────────────
// PURE. `athletes` : les dossiers ; `periode` : 'semaine' (7 jours) ou 'mois'
// (30 jours). Les records sont des records de CHARGE (recordsDeSeance), comme
// partout ailleurs. Le top 3 de régularité ne nomme qu'avec l'accord.
function recapTeamDonnees(athletes,periode,maintenant,equipe){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const jours=periode==='mois'?30:7;
  const debut=t-jours*864e5;
  let seances=0, records=0, tonnage=0;
  const reg=[];
  for(const u of (athletes||[]).filter(Boolean)){
    const tout=((u.sessions)||[]).filter(s=>s&&s.date>0).slice().sort((a,b)=>a.date-b.date);
    let n=0;
    for(let i=0;i<tout.length;i++){
      const s=tout[i];
      if(s.date<debut||s.date>t) continue;
      n++;
      try{ tonnage+=defiTonnageSeance(s); }catch(e){}
      try{ records+=recordsDeSeance(s,tout.slice(0,i)).length; }catch(e){}
    }
    seances+=n;
    if(n>0) reg.push({u,n});
  }
  reg.sort((a,b)=>b.n-a.n);
  const top=reg.slice(0,3).map(x=>({nom:vcNomAffiche(x.u,'prenom')||'UN ATHLÈTE',n:x.n}));
  let equivalent=null; try{ equivalent=equivalentTonnage(tonnage); }catch(e){ equivalent=null; }
  return {titre:periode==='mois'?'LE MOIS DE LA TEAM':'LA SEMAINE DE LA TEAM',equipe:String(equipe||''),
    seances,records,tonnage:Math.round(tonnage),equivalent,top};
}
function _dessinerRecapTeam(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent', rouge=f==='rouge';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const o=_visuelOutils(g), M=72, LARG=W-M*2, cx=W/2;
  const marque=_vcMarque();
  const post=format==='post';
  const hEq=d.equivalent?70:0, hTop=d.top.length?(70+d.top.length*62):0;
  const HTOT=64+(d.equipe?110:0)+230+hEq+hTop+40+(marque?190:110);
  let y=Math.max(70,Math.round((H-HTOT)/2));
  g.textAlign='center'; g.textBaseline='alphabetic';
  o.ombre(true);
  g.fillStyle=rouge?'#fff':ROUGE_MARQUE;
  const ss=o.ajusteEspace(d.titre,'800',40,MONT,10,LARG,24);
  g.font='800 '+ss+'px '+MONT; o.ecrireEspace(d.titre,cx,y+ss,10,true);
  y+=64;
  if(d.equipe){
    g.fillStyle='#fff';
    const es=o.ajuste(d.equipe,'700',100,BEBAS,LARG,44);
    g.font='700 '+es+'px '+BEBAS; o.ecrire(d.equipe,cx,y+es*0.82);
    y+=110;
  }
  // LES TROIS CHIFFRES.
  const ch=[{v:String(d.seances),l:'SÉANCES'},{v:String(d.records),l:d.records>1?'RECORDS':'RECORD'},
    {v:d.tonnage>=1000?bilanVolumeLib(d.tonnage).toUpperCase():(d.tonnage+' KG'),l:'SOULEVÉS'}];
  const cw=LARG/3;
  ch.forEach((c,i)=>{
    const x=M+cw*i+cw/2;
    g.fillStyle='#fff';
    const vs=o.ajuste(c.v,'700',post?130:150,BEBAS,cw-20,50);
    g.font='700 '+vs+'px '+BEBAS; o.ecrire(c.v,x,y+150);
    g.fillStyle='rgba(255,255,255,.8)'; g.font='800 24px '+MONT; o.ecrireEspace(c.l,x,y+196,5,true);
  });
  y+=230;
  if(d.equivalent){
    const t='= '+String(d.equivalent.texte).toUpperCase()+' '+d.equivalent.emoji;
    g.fillStyle='#fff';
    const es=o.ajuste(t,'800',38,MONT,LARG,20);
    g.font='800 '+es+'px '+MONT; o.ecrire(t,cx,y+40);
    y+=hEq;
  }
  if(d.top.length){
    y+=10;
    g.fillStyle=rouge?'#fff':'#ff3b3b'; g.font='800 28px '+MONT;
    o.ecrireEspace('TOP RÉGULARITÉ',cx,y+28,8,true);
    y+=60;
    d.top.forEach((x,i)=>{
      const t=(i+1)+'.  '+x.nom+'  ·  '+x.n+' SÉANCE'+(x.n>1?'S':'');
      g.fillStyle=i===0?'#fff':'rgba(255,255,255,.88)';
      const ts=o.ajuste(t,'700',56,BEBAS,LARG,28);
      g.font='700 '+ts+'px '+BEBAS; o.ecrire(t,cx,y+46);
      y+=62;
    });
  }
  y+=40;
  _vcPied(g,o,y,W,marque,d.equipe?'':_vcNomCoach(),rouge);
  o.ombre(false);
  return cv;
}

// ══ MON KIT (espace coach, 28/09/2026) ════════════════════════════════
// Chaque lundi, trois contenus prêts à publier, 1080×1350, tirés des vraies
// données de la semaine écoulée : le récap de la team (_dessinerRecapTeam),
// la victoire de la semaine (_dessinerVictoireCoach — le prénom seulement
// avec l'accord de l'athlète, vcConsentement, sinon anonyme), et le défi en
// cours du Canal, ou un défi à lancer. Chaque légende est modifiable, porte
// le lien de la vitrine du coach et #RepCore. « Tout télécharger » (partage
// natif de plusieurs fichiers, sinon un par un), « Copier la légende ».
// Et les ÉLÉMENTS DE MARQUE : logo (clair / sombre), les 3 fonds, les
// emblèmes de rang, et trois règles d'usage.
const KIT_FORMAT='post';
const KIT_HASHTAGS='#RepCore #coaching #musculation';
const KIT_VU_CLE='rc_kit_vu';
const KIT_REGLES=Object.freeze([
  'Le logo ne se déforme pas, ne se recolore pas et garde de l’air autour de lui.',
  ('Le rouge RepCore ('+ROUGE_MARQUE+') sert aux accents, jamais aux longs textes.'),
  'Pas de montage d’un emblème de rang sur un compte qui ne l’a pas gagné.'
]);
const KIT_FONDS=Object.freeze([{cle:'carbone',lib:'Carbone'},{cle:'rouge',lib:'Rouge'},{cle:'noir',lib:'Noir'}]);
/** PURE. Le lundi (00 h, heure locale) de la semaine de `t`. */
function kitLundi(maintenant){
  const d=new Date((typeof maintenant==='number')?maintenant:Date.now());
  d.setHours(0,0,0,0);
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return d;
}
function kitSemaineCle(maintenant){ return localISODate(kitLundi(maintenant)); }
/** PURE. La meilleure progression de la semaine (7 jours, sinon 30), ou null. */
function kitVictoire(athletes,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  for(const jours of [7,30]){
    let best=null;
    for(const u of (athletes||[]).filter(Boolean)){
      let l=[]; try{ l=victoiresDe(u); }catch(e){ l=[]; }
      for(const v of l){
        if(!(v.le>t-jours*864e5&&v.le<=t)) continue;
        if(!best||v.pct>best.v.pct) best={u,v};
      }
    }
    if(best) return best;
  }
  return null;
}
/** PURE. Le défi du Canal en cours (commencé, pas fini), ou null. */
function kitDefiEnCours(liste,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  return (liste||[]).filter(m=>m&&m.type==='defi'&&Number(m.fin)>t&&!(Number(m.debut)>t))
    .sort((a,b)=>Number(a.fin)-Number(b.fin))[0]||null;
}
const _kitKg=v=>String(Math.round(Number(v)*10)/10).replace('.',',');
/** PURE. Les trois contenus de la semaine : {type, titre, d, legende, fichier}. */
function kitContenus(coach,athletes,defi,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const equipe=String((coach&&coach.teamName)||'').trim();
  let lien=''; try{ lien=urlPagePerso(coach); }catch(e){ lien=''; }
  const pied=(lien?'\n\n'+lien:'')+'\n'+KIT_HASHTAGS;
  const out=[];
  // 1. Le récap de la team.
  const r=recapTeamDonnees(athletes,'semaine',t,equipe.toUpperCase());
  const ton=r.tonnage>=1000?(String(Math.round(r.tonnage/100)/10).replace('.',',')+' t'):(r.tonnage+' kg');
  out.push({type:'recap',titre:'Récap de la team',d:r,fichier:'repcore-team-semaine',
    legende:'La semaine de la team'+(equipe?' '+equipe:'')+' : '+r.seances+' séance'+(r.seances>1?'s':'')+', '+r.records+' record'+(r.records>1?'s':'')
      +', '+ton+' soulevés'+(r.equivalent?' (soit '+r.equivalent.texte+')':'')+'. Fier de vous 💪'+pied});
  // 2. La victoire de la semaine — le prénom avec l'accord, sinon anonyme.
  const vic=kitVictoire(athletes,t);
  if(vic){
    const mode=vcConsentement(vic.u)?'prenom':'anonyme';
    const d=victoireDonnees(vic.u,vic.v,mode);
    const qui=d.nom?('Bravo '+String(vic.u.fname||'').trim().slice(0,24)+' !'):'Bravo à toi, tu te reconnaîtras !';
    out.push({type:'victoire',titre:'Victoire de la semaine',d,fichier:'repcore-victoire-semaine',
      legende:'Victoire de la semaine ⚡ '+vic.v.exo+' : '+_kitKg(vic.v.avant)+' → '+_kitKg(vic.v.apres)+' kg (+'+vic.v.pct+' %)'
        +(d.duree?' en '+d.duree.toLowerCase():'')+'. '+qui+pied});
  }else out.push({type:'victoire',titre:'Victoire de la semaine',d:null,fichier:'',legende:''});
  // 3. Le défi en cours, ou un défi à lancer.
  if(defi){
    let obj=''; try{ obj=defiTexteObjectif(defi); }catch(e){ obj=''; }
    const fin=new Date(Number(defi.fin)).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    out.push({type:'defi',titre:'Défi en cours',fichier:'repcore-defi-en-cours',
      d:{sur:'DÉFI EN COURS',titre:String(defi.titre||'Le défi').slice(0,60),sous:obj,date:'JUSQU’AU '+fin.toUpperCase()},
      legende:'Défi en cours : « '+String(defi.titre||'Le défi')+' »'+(obj?' — '+obj:'')+', jusqu’au '+fin+'. Qui le relève ? 🔥'+pied+' #defi'});
  }else{
    out.push({type:'defi',titre:'Défi à lancer',fichier:'repcore-defi-semaine',
      d:{sur:'LE DÉFI DE LA SEMAINE',titre:'3 SÉANCES EN 7 JOURS',sous:'Tu relèves ?',date:'DU LUNDI AU DIMANCHE'},
      legende:'Le défi de la semaine : 3 séances en 7 jours. Tu relèves ? Réponds « JE RELÈVE » en commentaire 🔥'+pied+' #defi'});
  }
  return out;
}
/** Le visuel du défi (en cours, ou à lancer). */
function _dessinerDefiKit(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h;
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'carbone', rouge=f==='rouge';
  _kitPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const o=_visuelOutils(g), cx=W/2, LARG=W-144;
  g.textAlign='center'; g.textBaseline='alphabetic';
  // L'éclair, derrière le titre.
  g.save();
  g.fillStyle=rouge?'rgba(255,255,255,.18)':'rgba(224,32,32,.35)';
  g.shadowColor=rouge?'rgba(255,255,255,.4)':'rgba(224,32,32,.9)'; g.shadowBlur=60;
  g.beginPath();
  [[610,200],[400,620],[540,620],[450,1000],[720,480],[580,480],[690,200]].forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));
  g.closePath(); g.fill(); g.restore();
  o.ombre(true);
  g.fillStyle=rouge?'#fff':'#ff3b3b'; g.font='800 38px '+MONT;
  o.ecrireEspace(d.sur,cx,220,9,true);
  g.fillStyle='#fff';
  const s=o.ajuste(d.titre,'700',170,BEBAS,LARG,70);
  g.font='700 '+s+'px '+BEBAS;
  o.ecrire(o.coupe(d.titre,LARG),cx,640);
  if(d.sous){ g.fillStyle='rgba(255,255,255,.9)'; const ss=o.ajuste(d.sous,'700',48,MONT,LARG,26); g.font='700 '+ss+'px '+MONT; o.ecrire(d.sous,cx,760); }
  if(d.date){ g.fillStyle='rgba(255,255,255,.8)'; g.font='800 30px '+MONT; o.ecrireEspace(d.date,cx,840,5,true); }
  let marque=null; try{ marque=_vcMarque(); }catch(e){ marque=null; }
  _vcPied(g,o,H-330,W,marque,_vcNomCoach(),rouge);
  o.ombre(false);
  return cv;
}
// Les fonds du kit : ceux des visuels, et un noir uni.
function _kitPeindreFond(g,W,H,f){
  if(f==='noir'){ g.fillStyle='#0b0b0c'; g.fillRect(0,0,W,H); return true; }
  return _visuelPeindreFond(g,W,H,f==='rouge'?'rouge':'carbone');
}
function kitDessiner(c,fond){
  if(!c||!c.d) return null;
  const f=fond||'carbone';
  const vf=f==='noir'?'transparent':f;
  let cv=null;
  if(c.type==='defi') return _dessinerDefiKit(c.d,f,KIT_FORMAT);
  cv=c.type==='recap'?_dessinerRecapTeam(c.d,vf,KIT_FORMAT):_dessinerVictoireCoach(c.d,vf,KIT_FORMAT);
  if(f!=='noir') return cv;
  // Le noir uni : le visuel transparent posé sur le fond.
  const out=document.createElement('canvas'); out.width=cv.width; out.height=cv.height;
  const g=out.getContext('2d'); _kitPeindreFond(g,out.width,out.height,'noir'); g.drawImage(cv,0,0);
  return out;
}
// ── L'écran ────────────────────────────────────────────────────────────
let _kit=null;   // {contenus, fond, semaine}
function _kitLegendesGardees(sem){
  try{ const x=JSON.parse(localStorage.getItem('rc_kit_leg')||'null'); return (x&&x.sem===sem)?(x.l||{}):{}; }catch(e){ return {}; }
}
function kitLegendeModifiee(i,val){
  if(!_kit||!_kit.contenus[i]) return;
  _kit.contenus[i].legende=String(val||'');
  try{ const l=_kitLegendesGardees(_kit.semaine); l[i]=_kit.contenus[i].legende;
    localStorage.setItem('rc_kit_leg',JSON.stringify({sem:_kit.semaine,l})); }catch(e){}
}
/** PURE. Le kit de la semaine a-t-il déjà été ouvert ? (la pastille « Nouveau ») */
function kitNouveau(vu,maintenant){ return String(vu||'')!==kitSemaineCle(maintenant); }
function _kitMarquerVu(){ try{ localStorage.setItem(KIT_VU_CLE,kitSemaineCle()); }catch(e){} _rendreBoutonKit(); }
function _rendreBoutonKit(){
  const b=document.getElementById('ch-kit-btn'); if(!b) return;
  let vu=''; try{ vu=localStorage.getItem(KIT_VU_CLE)||''; }catch(e){ vu=''; }
  b.classList.toggle('kit-neuf',kitNouveau(vu));
}
async function ouvrirKitCoach(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u||u.role!=='coach') return false;
  const ath=Object.values(DB.get('users')||{}).filter(x=>x&&x.role==='athlete'&&_estMonAthlete(x,u));
  // Le défi en cours : le Canal du coach, s'il répond.
  let liste=window._canalListe||null;
  if(!liste){ try{ const cle=canalCle(u); liste=cle?canalTrier(await CLOUD.pullCanalMessages(cle)):[]; }catch(e){ liste=[]; } }
  const sem=kitSemaineCle();
  const contenus=kitContenus(u,ath,kitDefiEnCours(liste),Date.now());
  const gardees=_kitLegendesGardees(sem);
  contenus.forEach((c,i)=>{ if(typeof gardees[i]==='string'&&c.d) c.legende=gardees[i]; });
  _kit={contenus,fond:'carbone',semaine:sem};
  try{ _prechaufferMarqueCoach(); }catch(e){}
  document.getElementById('kit-ecran')?.remove();
  const z=document.createElement('div');
  z.id='kit-ecran'; z.className='aa-ecran kit-ecran';
  z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true'); z.setAttribute('aria-label','Mon kit de la semaine');
  z.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); fermerKitCoach(); } });
  document.body.appendChild(z);
  _kitRendre();
  _kitMarquerVu();
  return true;
}
function fermerKitCoach(){ document.getElementById('kit-ecran')?.remove(); return true; }
function kitFond(f){ if(!_kit||!KIT_FONDS.some(x=>x.cle===f)) return false; _kit.fond=f; _kitRendre(); return true; }
function htmlKit(k){
  const lundi=kitLundi(Date.parse(k.semaine+'T12:00:00')).toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
  const prets=k.contenus.filter(c=>c.d).length;
  let h='<div class="aa-haut"><span>Mon kit · semaine du '+escapeHtml(lundi)+'</span>'
    +'<button type="button" class="aa-fermer" aria-label="Fermer" onclick="fermerKitCoach()">'+icon('croix',14)+'</button></div>'
    +'<div class="kit-corps">'
    +'<p class="kit-intro">Trois contenus prêts à poster (1080×1350), tirés des chiffres de ta team. Modifie la légende si tu veux, puis publie.</p>'
    +'<div class="kit-fonds" role="group" aria-label="Fond">'+KIT_FONDS.map(f=>'<button type="button" class="kit-f'+(k.fond===f.cle?' on':'')+'" onclick="kitFond(\''+f.cle+'\')">'+f.lib+'</button>').join('')+'</div>'
    +'<button type="button" class="btn btn-red btn-casse kit-tout" onclick="kitToutTelecharger(this)"'+(prets?'':' disabled')+'>'+icon('download',18)+' <span>Tout télécharger ('+prets+')</span></button>';
  k.contenus.forEach((c,i)=>{
    h+='<section class="kit-c"><div class="kit-t">'+(i+1)+' · '+escapeHtml(c.titre)+'</div>';
    if(!c.d){ h+=emptyState('','Pas encore de progression de charge à montrer cette semaine. Elle viendra.',null,null,'padding:12px 0')+'</section>'; return; }
    h+='<canvas class="kit-apercu" id="kit-cv-'+i+'" aria-label="Aperçu : '+escapeHtml(c.titre)+'"></canvas>'
      +'<label class="kit-l" for="kit-leg-'+i+'">Légende</label>'
      +'<textarea id="kit-leg-'+i+'" class="kit-leg" rows="5" oninput="kitLegendeModifiee('+i+',this.value)">'+escapeHtml(c.legende)+'</textarea>'
      +'<div class="kit-b"><button type="button" class="btn btn-outline btn-sm btn-casse" onclick="kitCopierLegende('+i+',this)">Copier la légende</button>'
      +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="kitTelecharger('+i+',this)">Télécharger</button></div></section>';
  });
  h+=htmlElementsMarque()+'</div>';
  return h;
}
function _kitRendre(){
  const z=document.getElementById('kit-ecran'); if(!z||!_kit) return;
  z.innerHTML=htmlKit(_kit);
  _kit.contenus.forEach((c,i)=>{
    const el=document.getElementById('kit-cv-'+i); if(!el||!c.d) return;
    try{ const v=kitDessiner(c,_kit.fond); if(!v) return; el.width=v.width; el.height=v.height; el.getContext('2d').drawImage(v,0,0); v.width=0; v.height=0; }catch(e){}
  });
}
async function kitCopierLegende(i,btn){
  const c=_kit&&_kit.contenus[i]; if(!c) return false;
  let ok=false;
  try{ await navigator.clipboard.writeText(c.legende); ok=true; }catch(e){ ok=false; }
  if(btn){ const t=btn.textContent; _texteIco(btn,ok?'Copiée '+ICO.coche:'Copie impossible'); setTimeout(()=>{ btn.textContent=t; },1800); }
  return ok;
}
function _kitBlob(c){
  return new Promise(res=>{
    try{ const cv=kitDessiner(c,_kit.fond); if(!cv) return res(null);
      cv.toBlob(b=>{ cv.width=0; cv.height=0; res(b); },'image/jpeg',0.9); }catch(e){ res(null); }
  });
}
function _kitNom(c){ return (c.fichier||'repcore-kit')+'-'+(_kit&&_kit.semaine||'')+'.jpg'; }
async function kitTelecharger(i){
  const c=_kit&&_kit.contenus[i]; if(!c||!c.d) return false;
  const b=await _kitBlob(c); if(!b) return false;
  _kitEnregistrer(b,_kitNom(c));
  return true;
}
function _kitEnregistrer(b,nom){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b); a.download=nom;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} },4000);
}
// LE PARTAGE NATIF DE PLUSIEURS FICHIERS d'abord (Instagram les reçoit en
// carrousel) ; sinon, un téléchargement par fichier.
async function kitToutTelecharger(btn){
  if(!_kit) return 0;
  if(btn) btn.disabled=true;
  const l=_kit.contenus.filter(c=>c.d);
  const blobs=[];
  for(const c of l){ const b=await _kitBlob(c); if(b) blobs.push({b,nom:_kitNom(c)}); }
  let n=0;
  try{
    const files=blobs.map(x=>new File([x.b],x.nom,{type:'image/jpeg'}));
    if(files.length&&navigator.canShare&&navigator.canShare({files})){
      await navigator.share({files,title:'Mon kit RepCore'}); n=files.length;
    }
  }catch(e){ n=0; }
  if(!n){ for(const x of blobs){ _kitEnregistrer(x.b,x.nom); n++; await new Promise(r=>setTimeout(r,350)); } }
  try{ rcm('coach_kit_telecharge'); }catch(e){}
  if(btn) btn.disabled=false;
  return n;
}
// ── Les éléments de marque ─────────────────────────────────────────────
function htmlElementsMarque(){
  return '<section class="kit-c kit-marque"><div class="kit-t">Éléments de marque</div>'
    +'<div class="kit-l">Logo</div><div class="kit-b">'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="kitLogo(\'sombre\')">Logo · fond sombre</button>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="kitLogo(\'clair\')">Logo · fond clair</button></div>'
    +'<div class="kit-l">Les 3 fonds (1080×1350)</div><div class="kit-b">'
    +KIT_FONDS.map(f=>'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="kitFondTelecharger(\''+f.cle+'\')">'+f.lib+'</button>').join('')+'</div>'
    +'<div class="kit-l">Emblèmes de rang</div><div class="kit-emb">'
    +RANGS.map(r=>'<a href="'+rangEmbleme(r.n,true)+'" download="repcore-rang-'+r.n+'.webp" title="'+escapeHtml(r.nom)+'"><img src="'+rangEmbleme(r.n)+'" alt="'+escapeHtml(r.nom)+'" loading="lazy" width="44" height="44"></a>').join('')+'</div>'
    +'<div class="kit-l">Règles d’usage</div><ol class="kit-regles">'+KIT_REGLES.map(x=>'<li>'+escapeHtml(x)+'</li>').join('')+'</ol></section>';
}
/** Le logo : l'icône et le mot REPCORE, blanc (fond sombre) ou noir (fond clair). */
function kitLogoCanvas(variante,icone){
  const cv=document.createElement('canvas'); cv.width=1200; cv.height=400;
  const g=cv.getContext('2d');
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  if(icone){ try{ g.drawImage(icone,40,40,320,320); }catch(e){} }
  g.fillStyle=variante==='clair'?'#0b0b0c':'#ffffff';
  g.font='700 250px '+BEBAS; g.textBaseline='middle'; g.textAlign='left';
  g.fillText('REPCORE',400,212);
  return cv;
}
function kitLogo(variante){
  const img=new Image();
  const fin=()=>{ const cv=kitLogoCanvas(variante,img.naturalWidth?img:null);
    cv.toBlob(b=>{ if(b) _kitEnregistrer(b,'repcore-logo-'+(variante==='clair'?'fond-clair':'fond-sombre')+'.png'); },'image/png'); };
  img.onload=fin; img.onerror=fin;
  img.src='./icons/icon-512x512.png';
  return true;
}
function kitFondTelecharger(f){
  const cv=document.createElement('canvas'); cv.width=1080; cv.height=1350;
  _kitPeindreFond(cv.getContext('2d'),1080,1350,f);
  cv.toBlob(b=>{ if(b) _kitEnregistrer(b,'repcore-fond-'+f+'.jpg'); },'image/jpeg',0.92);
  return true;
}

// ── L'ÉCRAN : aperçu, réglages, fond, Télécharger / Partager ──────────────
let _vc=null;   // {type:'victoire'|'recap', u?, victoires?, i, mode, format, periode}
function _vcDonnees(){
  if(!_vc) return null;
  if(_vc.type==='victoire') return victoireDonnees(_vc.u,_vc.victoires[_vc.i],vcConsentement(_vc.u)?_vc.mode:'anonyme');
  const u=currentUser;
  const ath=Object.values(DB.get('users')||{}).filter(x=>x&&x.role==='athlete'&&_estMonAthlete(x,u));
  return recapTeamDonnees(ath,_vc.periode,Date.now(),String((u&&u.teamName)||'').trim().toUpperCase());
}
function _vcDessiner(fond){
  const d=_vcDonnees(); if(!d) return null;
  const fm=visuelFormatChoisi();
  return _vc.type==='victoire'?_dessinerVictoireCoach(d,fond,fm):_dessinerRecapTeam(d,fond,fm);
}
function _vcNomFichier(fond){ return visuelNomFichier(_vc&&_vc.type==='recap'?'repcore-team':'repcore-victoire',fond); }
function ouvrirVictoireCoach(cid){
  let u=null; try{ u=getOwnedClient(cid||currentClientId); }catch(e){ u=null; }
  if(!u) return false;
  const v=victoiresDe(u);
  if(!v.length){ toast('Pas encore de progression de charge à partager.','var(--orange)'); return false; }
  _vc={type:'victoire',u,victoires:v,i:0,mode:vcConsentement(u)?'prenom':'anonyme'};
  _vcOuvrir();
  return true;
}
function ouvrirRecapTeam(){
  if(!currentUser||currentUser.role!=='coach') return false;
  _vc={type:'recap',periode:'semaine'};
  _vcOuvrir();
  return true;
}
function _vcOuvrir(){
  fermerVisuelCoach();
  try{ _prechaufferMarqueCoach(); }catch(e){}
  const z=document.createElement('div');
  z.id='vc-ecran'; z.className='aa-ecran vc-ecran';
  z.setAttribute('role','dialog'); z.setAttribute('aria-modal','true');
  z.setAttribute('aria-label',_vc.type==='victoire'?'Partager une victoire':'Récap de l’équipe');
  z.tabIndex=-1;
  z.addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); fermerVisuelCoach(); } });
  document.body.appendChild(z);
  _vcRendre();
  try{ z.focus({preventScroll:true}); }catch(e){}
}
function fermerVisuelCoach(){
  const z=document.getElementById('vc-ecran'); if(z) z.remove();
  try{ _visuelFondsMontes.delete('vc-fonds'); }catch(e){}
  return true;
}
// PURE. Les réglages de l'écran.
function htmlReglagesVisuelCoach(vc){
  const seg=(nom,val,liste)=>'<div class="aa-seg" role="group">'+liste.map(([k,lib,dis])=>'<button type="button"'
    +(dis?' disabled':'')+' aria-pressed="'+(val===k)+'" onclick="vcReglage(\''+nom+'\',\''+k+'\')">'+escapeHtml(lib)+'</button>').join('')+'</div>';
  let h='';
  if(vc.type==='victoire'){
    const cons=vcConsentement(vc.u);
    h+='<label class="vc-l" for="vc-exo">Victoire</label><select id="vc-exo" onchange="vcReglage(\'i\',this.value)">'
      +vc.victoires.slice(0,20).map((v,i)=>'<option value="'+i+'"'+(i===vc.i?' selected':'')+'>'
        +escapeHtml(v.exo+' · '+_vcKg(v.avant)+' → '+_vcKg(v.apres)+' kg (+'+v.pct+' %)')+'</option>').join('')+'</select>'
      +'<div class="vc-l">Nom</div>'+seg('mode',cons?vc.mode:'anonyme',VC_MODES.map(m=>[m.k,m.lib,!cons&&m.k!=='anonyme']))
      +(cons?'':'<p class="vc-note">Sans l’accord de '+escapeHtml(vc.u.fname||'l’athlète')+', la victoire se partage anonyme. Il peut l’accorder dans ses réglages.</p>');
  }else{
    h+='<div class="vc-l">Période</div>'+seg('periode',vc.periode,[['semaine','7 derniers jours'],['mois','30 derniers jours']])
      +'<p class="vc-note">Les prénoms du top 3 n’apparaissent qu’avec l’accord de chacun ; sinon « un athlète ».</p>';
  }
  return h;
}
function _vcRendre(){
  const z=document.getElementById('vc-ecran'); if(!z||!_vc) return;
  const part=(typeof navigator!=='undefined'&&navigator.share)
    ?'<button type="button" class="btn btn-outline btn-casse vc-part" onclick="vcSortir(\'partager\',this)">'+icon('share',16)+' <span>Partager</span></button>':'';
  z.innerHTML='<div class="aa-haut"><span>'+(_vc.type==='victoire'?'Victoire de '+escapeHtml(_vc.u.fname||'l’athlète'):'Récap de l’équipe')+'</span>'
    +'<button type="button" class="aa-fermer" aria-label="Fermer" onclick="fermerVisuelCoach()">'+icon('croix',14)+'</button></div>'
    +'<div class="aa-apercu"><canvas id="vc-canvas" aria-label="Aperçu de l’image"></canvas></div>'
    +'<div class="aa-bas">'
    +'<button type="button" class="btn btn-red vc-dl" onclick="vcSortir(\'telecharger\',this)">'+icon('download',18)+' <span>Télécharger</span></button>'+part
    +'<details class="aa-perso" open><summary>Réglages</summary>'+htmlReglagesVisuelCoach(_vc)
    +'<div class="vc-l">Fond</div>'+_htmlVisuelFonds('vc-fonds')
    +'<div class="rcf-note" id="vc-note"></div></details></div>';
  monterSelecteurFond('vc-fonds',f=>{
    const cv=_vcDessiner(f);
    // Le fond choisi repeint aussi l'aperçu.
    if(f===visuelFondEffectif()) setTimeout(_vcApercu,0);
    return cv;
  },'vc-note');
  _vcApercu();
}
function _vcApercu(){
  const c=document.getElementById('vc-canvas'); if(!c||!_vc) return;
  const v=_vcDessiner(visuelFondEffectif()); if(!v) return;
  c.width=v.width; c.height=v.height;
  const x=c.getContext('2d');
  if(visuelFondEffectif()==='transparent'){ x.fillStyle='#1c1c20'; x.fillRect(0,0,c.width,c.height); }
  x.drawImage(v,0,0);
  v.width=0; v.height=0;
}
function vcReglage(nom,val){
  if(!_vc) return false;
  if(nom==='i') _vc.i=Math.max(0,Math.min(_vc.victoires.length-1,Number(val)||0));
  else if(nom==='mode'){ if(val!=='anonyme'&&!vcConsentement(_vc.u)) return false; _vc.mode=val; }
  else if(nom==='format'&&VISUEL_FORMATS[val]) visuelFormatMemoriser(val);
  else if(nom==='periode'&&(val==='semaine'||val==='mois')) _vc.periode=val;
  _vcRendre();
  return true;
}
// SYNCHRONE jusqu'à la sortie : un await consommerait le geste, et iOS
// refuserait le partage. La sortie copie lienPerso() — la vitrine du coach.
function vcSortir(quoi,btn){
  if(!_vc||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond), nom=_vcNomFichier(fond);
  _storyEnCours=true;
  let ok=false;
  try{
    if(quoi==='partager') ok=_storySortirPartage(_vcDessiner(fond),nom,undefined,fmt);
    if(!ok) ok=_storySortirTelechargement(_vcDessiner(fond),nom,fmt);
  }catch(e){ toast('Export impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Visuel prêt '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  try{ if(ok) rcm(_vc&&_vc.type==='recap'?'coach_recap_partage':'coach_victoire_partage'); }catch(e){}
  return ok;
}
// Les boutons, là où ils servent.
function htmlBoutonVictoire(u){
  let v=[]; try{ v=victoiresDe(u); }catch(e){ v=[]; }
  if(!v.length) return '';
  const b=v[0];
  return '<button type="button" class="aa-bouton vc-bouton" onclick="ouvrirVictoireCoach(\''+escapeHtml(String(u.id||''))+'\')">'
    +'<span class="aa-bouton-i" aria-hidden="true">'+icon('zap',18)+'</span>'
    +'<span><b>Partager une victoire</b><span>'+escapeHtml(b.exo+' : '+_vcKg(b.avant)+' → '+_vcKg(b.apres)+' kg')+'</span></span></button>';
}
function _rendreBoutonVictoire(u){
  const z=document.getElementById('ccd-victoire');
  if(!z) return;
  z.innerHTML=htmlBoutonVictoire(u);
}
// L'accord de l'athlète, dans ses réglages : c'est le même que celui de son
// avant/après (u.consentementPartageCoach), et il couvre désormais aussi les
// victoires et le récap d'équipe.
function _majConsentementCoachReglages(){
  const z=document.getElementById('cr-partage-coach');
  if(!z) return;
  const u=currentUser;
  if(!u||u.role!=='athlete'||!(u.coachId||u.coachEmailKey)){ z.innerHTML=''; return; }
  z.innerHTML='<label for="cr-partage-case" class="reg-ligne">'
    +'<input type="checkbox" id="cr-partage-case"'+(vcConsentement(u)?' checked':'')+' onchange="aaConsentementCoach(this.checked);_majConsentementCoachReglages()">'
    +'<span class="reg-c"><span class="reg-t">Mon coach peut partager mes progrès</span>'
    +'<span class="reg-d">Tes victoires, ton prénom dans le récap de l’équipe, ton avant/après. Sans cet accord, ce qu’il partage reste anonyme.</span></span></label>';
}
