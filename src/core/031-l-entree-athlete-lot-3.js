// ══ L'ENTREE ATHLETE (lot 3) ════════════════════════════════════════════
// L'ecran etait complet et ne s'ouvrait que depuis la fiche d'un coach :
// l'athlete qui planifie son bloc n'avait aucun moyen de voir ce que sa
// semaine pese. Il l'ouvre maintenant sur SON dossier, et sur aucun autre.
//
// L'ARGUMENT EST IGNORE HORS D'UN COMPTE COACH, et c'est la barriere : sans
// cela, `ouvrirGrilleCharge(dossierDeQuelquUn)` depuis la console aurait
// affiche le bloc d'un autre. La lecture du dossier reste par ailleurs
// interdite par database.rules.json — mais l'interface ne doit pas y conduire.
function ouvrirGrilleCharge(athlete){
  if(!currentUser) return false;
  const coach=currentUser.role==='coach';
  if(coach){
    _gcAthlete=athlete||_coachEditClient||null;
  }else{
    // L'ECRAN S'OUVRE POUR TOUT LE MONDE DEPUIS LE LOT 4, et c'est le verrou
    // qui parle a l'interieur : un ecran qu'on n'atteint pas ne vend rien.
    _gcAthlete=currentUser;
  }
  // LA MISE EN PAGE LARGE DES ECRANS COACH NE SUIT PAS L'ATHLETE. `ecran-coach`
  // pose la barre laterale du coach et un retrait de 260 px au-dela de
  // 1025 px : sur le bloc d'un athlete, ce serait la barre de quelqu'un
  // d'autre. La classe suit donc celui qui ouvre, et revient au coach ensuite.
  try{
    const e=document.getElementById('s-coach-charge');
    if(e) e.classList.toggle('ecran-coach',coach);
  }catch(e){}
  // goAvecRetour pose le couloir de retour : on revient d'ou l'on vient, et
  // non sur un ecran choisi a l'ecriture.
  goAvecRetour('s-coach-charge');
  _rendreGrilleCharge();
  return true;
}
function _rendreGrilleCharge(){
  const z=document.getElementById('gc-contenu');
  if(!z) return false;
  // ══ LE VERROU (lot 4), avant tout calcul : la grille est ce qu'Ultime
  // ouvre, et le bloc dit ce qui reste lisible sans elle.
  const _vrr=rcVerrou('planification');
  if(_vrr){ z.innerHTML=_vrr; return false; }
  const u=_gcAthlete;
  const cases=grilleCharge(u);
  if(!cases.length){
    // Programme absent, corrompu, ou aucun muscle jugeable : la vue
    // disparait, elle ne s affiche pas a moitie.
    // ET LA SORTIE MENE LA OU L'ON PEUT AGIR, chacun chez soi : le coach dans
    // le programme de son athlete, l'athlete dans ses propres seances.
    const _vide=(txt,cta,fn)=>emptyState('calendar','<strong style="font-size:var(--fs-md)">Aucun bloc à afficher</strong>'
      +'<br><span style="font-size:var(--fs-sm);display:inline-block;margin-top:6px">'+txt+'</span>',cta,fn);
    z.innerHTML=_gcSurSoi()
      ?_vide('Tu n\'as pas encore de bloc d\'entraînement daté, ou aucun de tes muscles n\'a de repère de volume.',
        'Composer mes séances','loadSessionManager()')
      // R13 — un bloc date se pose dans son programme : ecran coach, depuis
      // un ecran coach. currentClientId est l'athlete dont on vient.
      :_vide('Cet athlète n\'a pas de bloc d\'entraînement daté, ou aucun de ses muscles n\'a de repère de volume.',
        'Modifier le programme','openCoachSessions()');
    return false;
  }
  const semaines=[...new Set(cases.map(c=>c.index))].sort((a,b)=>a-b);
  const muscles=[...new Set(cases.map(c=>c.muscle))];
  const par={}; for(const c of cases) par[c.index+'|'+c.muscle]=c;
  const meta={}; for(const c of cases) meta[c.index]={prevision:c.prevision,decharge:c.decharge,courante:c.courante};
  const th='padding:4px 6px;font-size:var(--fs-2xs);font-weight:800;color:var(--sub);'
    +'text-transform:uppercase;letter-spacing:.5px;white-space:nowrap';
  let h='<div style="overflow-x:auto;-webkit-overflow-scrolling:touch">'
    +'<table style="border-collapse:separate;border-spacing:2px;min-width:100%">'
    +'<tr><th style="'+th+';text-align:left;position:sticky;left:0;background:var(--bg)">Muscle</th>';
  for(const i of semaines){
    const m=meta[i]||{};
    // B3.2 — L'EN-TETE DE COLONNE EST LA POIGNEE DE LA SEMAINE. Le coach a
    // sous les yeux ce qu'il veut changer : c'est la, et nulle part ailleurs,
    // qu'il faut pouvoir le changer.
    const ecart=(()=>{ try{ return semainePorteEcart(u,i); }catch(e){ return false; } })();
    h+='<th style="'+th+';text-align:center'+(m.decharge?';color:var(--info)':'')+'">'
      +'<button type="button" onclick="ajusterSemaineBloc('+i+')" '
      +'title="Modifier cette semaine" '
      +'style="background:none;border:none;padding:2px 4px;cursor:pointer;font:inherit;'
      +'color:'+(m.decharge?'var(--info)':(ecart?'var(--red-text)':'inherit'))+'">'
      +'S'+(i+1)+(m.decharge?'<br>déch.':(ecart?'<br>modifiée':''))+'</button></th>';
  }
  h+='</tr>';
  for(const mu of muscles){
    h+='<tr><td style="'+th+';text-align:left;position:sticky;left:0;background:var(--bg)">'
      +escapeHtml((MUSCLES[mu]||{}).lib||mu)+'</td>';
    for(const i of semaines){
      const c=par[i+'|'+mu];
      const m=meta[i]||{};
      const fond=c&&c.repere?GC_COULEURS[c.repere]:'var(--border)';
      // L intensite de fond suit le tonnage relatif : une case a 1 est pleine,
      // une case a 0,2 est presque effacee. La couleur dit la ZONE, l opacite
      // dit la CHARGE — deux informations, un seul carre.
      const alpha=c?(0.18+0.82*(c.tonnageRelatif||0)):0.18;
      const style='min-width:38px;text-align:center;border-radius:var(--r-2);padding:6px 4px;'
        +'font-size:var(--fs-xs);font-weight:800;color:var(--text);background:'+fond+';opacity:'+alpha.toFixed(2)
        // Previsionnel : pointille. Une case vide ne dit rien, une case
        // pointillee dit « c est ce qui est prevu, rien n a encore ete fait ».
        +(m.prevision?';outline:1px dashed color-mix(in srgb,var(--text) 55%,transparent);outline-offset:-2px':'')
        +(m.courante?';box-shadow:0 0 0 2px var(--red)':'');
      const titre=escapeHtml(((MUSCLES[mu]||{}).lib||mu)+' : S'+(i+1)+' : '
        +(c?c.series:0)+' séries'+(c&&c.repere?(' ('+c.repere+')'):'')
        +(m.prevision?' : prévisionnel':''));
      h+='<td><div title="'+titre+'" aria-label="'+titre+'" style="'+style+'">'
        +(c?c.series:0)+'</div></td>';
    }
    h+='</tr>';
  }
  h+='</table></div>';
  // La legende, parce qu un damier de couleurs sans legende ne se lit pas.
  h+='<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">'
    +Object.keys(GC_COULEURS).map(k=>'<span style="display:inline-flex;align-items:center;gap:6px;'
      +'font-size:var(--fs-2xs);color:var(--sub)"><span style="width:11px;height:11px;border-radius:var(--r-1);'
      +'background:'+GC_COULEURS[k]+'"></span>'+escapeHtml(k)+'</span>').join('')
    +'<span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-2xs);color:var(--sub)">'
    +'<span style="width:11px;height:11px;border-radius:var(--r-1);border:1px dashed var(--sub)"></span>prévisionnel</span>'
    +'</div>';
  // LA PHRASE NE PROMET QUE CE QUE CELUI QUI LIT PEUT FAIRE : le geste de la
  // semaine n'existe que pour le coach et pour qui regarde son propre bloc.
  h+='<p class="sub" style="font-size:var(--fs-2xs);line-height:1.6;margin-top:12px">'
    +'L\'intensité de la case suit la charge relative à la semaine la plus chargée du bloc.'
    +(_gcModifiable()?' Touche le numéro d\'une semaine pour en changer le volume ou l\'intensité, '
      +'les autres ne bougent pas.':'')
    +'</p>';
  z.innerHTML=h;
  return true;
}

// ══════ B3.2 — MODIFIER UNE SEMAINE DU BLOC ════════════════════════════
//
// C'est le geste qui manquait : `programme.ecarts` etait lu par trois
// fonctions et ecrit par aucune. « Bloc de douze semaines » signifiait « la
// meme semaine douze fois », et un coach ne pouvait pas monter le volume de S1
// a S3 puis le redescendre — il ne pouvait pas periodiser.
//
// DEUX LEVIERS, PAS UN DE PLUS : les series et l'intensite cible. Ce sont ceux
// que la fiche demande, et ceux que le reste de l'app sait deja lire.
//
// RELATIF ET NON ABSOLU. « +1 serie » se comprend sur une seance de sept
// exercices ou chacun a son propre compte ; « 4 series » ne voudrait rien dire.
// C'est aussi ce qui permet de garder le gabarit comme reference : l'ecart ne
// pese que ce qu'il change.
//
// ET ON PEUT TOUT DEFAIRE : une valeur vide remet la semaine au gabarit. Un
// ecart qu'on ne peut pas retirer est une copie deguisee.
async function ajusterSemaineBloc(i){
  const u=_gcAthlete;
  if(!u){ toast('Aucun athlète ouvert.','var(--orange)'); return false; }
  // LE COACH SUR SES ATHLETES, L'ATHLETE SUR SON PROPRE BLOC (lot 3). Un
  // athlete qui compose son programme doit pouvoir periodiser le sien ; il ne
  // touche a aucun autre, puisque _gcAthlete ne peut etre que lui-meme.
  if(!_gcModifiable()){ toast('Réservé aux coachs.','var(--orange)'); return false; }
  const nl='\n';
  const porte=(()=>{ try{ return semainePorteEcart(u,i); }catch(e){ return false; } })();
  const r=await rcSaisie('Semaine '+(i+1)+' : écart au gabarit'+nl+nl
    +'Séries, puis intensité, séparées par une virgule.'+nl
    +'« +1,0 » ajoute une série à chaque exercice. « -1,+1 » en retire une et laisse '
    +'une répétition de plus en réserve.'+nl+nl
    +(porte?'Laisse vide pour remettre cette semaine au gabarit.'
           :'Laisse vide pour ne rien changer.'),
    '',{libelleOk:'Enregistrer'});
  if(r===null||r===undefined) return false;
  const txt=String(r).trim();
  if(!txt){
    // VIDE = REMETTRE AU GABARIT, et le dire quand il n'y avait rien a defaire.
    if(!porte){ toast('Cette semaine suit déjà le gabarit.','var(--orange)'); return false; }
    let ote=false;
    try{ ote=retirerEcartSemaine(u,i); }catch(e){}
    if(!ote) return false;
    return _gcEnregistrer(u,'Semaine '+(i+1)+' remise au gabarit');
  }
  const parts=txt.split(',');
  const dS=Math.round(Number(String(parts[0]||'0').replace('+','').trim()))||0;
  const dR=Math.round(Number(String(parts[1]||'0').replace('+','').trim()))||0;
  if(!dS&&!dR){ toast('Rien à appliquer : les deux valeurs sont à zéro.','var(--orange)'); return false; }
  let n=0;
  try{ n=poserEcartSemaine(u,i,{series:dS,rir:dR}); }catch(e){}
  if(!n){
    // AUCUN CRENEAU TOUCHE : soit la semaine n'a pas de seance active, soit la
    // modulation ne changeait rien — un -1 sur des exercices deja a une serie.
    toast('Aucune séance n’a changé : vérifie que la semaine a des séances actives.','var(--orange)');
    return false;
  }
  return _gcEnregistrer(u,'Semaine '+(i+1)+' : '+n+' séance'+(n>1?'s':'')+' modifiée'+(n>1?'s':''));
}
// L'ECRITURE, PAR LE MEME CHEMIN QUE LE RESTE DE LA FICHE COACH :
// DB.set puis CLOUD.pushOne, et le toast dit ce qui est parti.
// ⚠ ELLE SERT AUSSI L'ATHLETE SUR SON PROPRE BLOC (lot 3) : `u` est alors
//   currentUser, users[u.email] est son dossier, et la regle de la base
//   l'autorise a l'ecrire. Aucun chemin d'ecriture de plus n'a ete ajoute.
function _gcEnregistrer(u,message){
  try{
    const users=DB.get('users')||{};
    u.updatedAt=Date.now();
    users[u.email]=u;
    const ok=DB.set('users',users);
    const envoi=CLOUD.pushOne(u.email,u);
    _rendreGrilleCharge();
    toastSync(ok,envoi,message,'la semaine est');
    return true;
  }catch(e){ toast('Enregistrement impossible.','var(--red)'); return false; }
}

// ══════ EXPORT IMAGE ══════
// Canvas et rien d autre : pas de bibliotheque de graphiques.
//
// CE QUE L IMAGE NE CONTIENT PAS, ET C EST LE POINT : aucun nom, aucune date
// de naissance, aucune donnee de sante. Elle porte des libelles de muscles,
// des numeros de semaine et des nombres de series. Un coach l envoie a son
// athlete ; elle peut aussi finir n importe ou.
function _gcLignesExport(u){
  const cases=grilleCharge(u);
  if(!cases.length) return null;
  const semaines=[...new Set(cases.map(c=>c.index))].sort((a,b)=>a-b);
  const muscles=[...new Set(cases.map(c=>c.muscle))];
  const par={}; for(const c of cases) par[c.index+'|'+c.muscle]=c;
  return {semaines,muscles,par};
}
function dessinerGrilleCharge(u){
  const d=_gcLignesExport(u);
  if(!d) return null;
  const LARG_MUS=104, CASE=44, HAUT=30, MARGE=14;
  const cv=document.createElement('canvas');
  cv.width=MARGE*2+LARG_MUS+d.semaines.length*CASE;
  cv.height=MARGE*2+HAUT*(d.muscles.length+1)+26;
  const g=cv.getContext('2d');
  g.fillStyle='#0b0b0b'; g.fillRect(0,0,cv.width,cv.height);
  g.font='600 11px sans-serif'; g.textBaseline='middle';
  g.fillStyle='#8a8a8a';
  d.semaines.forEach((i,k)=>{
    g.textAlign='center';
    g.fillText('S'+(i+1),MARGE+LARG_MUS+k*CASE+CASE/2,MARGE+HAUT/2);
  });
  d.muscles.forEach((mu,r)=>{
    const y=MARGE+HAUT*(r+1)+HAUT/2;
    g.textAlign='left'; g.fillStyle='#8a8a8a';
    g.fillText(((MUSCLES[mu]||{}).lib||mu).slice(0,15),MARGE,y);
    d.semaines.forEach((i,k)=>{
      const c=d.par[i+'|'+mu];
      const x=MARGE+LARG_MUS+k*CASE;
      g.globalAlpha=c?(0.18+0.82*(c.tonnageRelatif||0)):0.18;
      g.fillStyle=(c&&c.repere)?GC_COULEURS[c.repere]:_tok('--border','#242424');
      g.fillRect(x+2,y-HAUT/2+2,CASE-4,HAUT-4);
      g.globalAlpha=1;
      g.fillStyle=_tok('--text','#efefef'); g.textAlign='center';
      g.fillText(String(c?c.series:0),x+CASE/2,y);
    });
  });
  g.fillStyle='#5a5a5a'; g.textAlign='left'; g.font='600 10px sans-serif';
  g.fillText('RepCore : charge du bloc, séries pondérées par muscle',MARGE,cv.height-MARGE);
  return cv;
}
function exporterGrilleCharge(){
  const cv=dessinerGrilleCharge(_gcAthlete);
  if(!cv){ toast('Rien à exporter.','var(--orange)'); return false; }
  try{
    cv.toBlob(b=>{
      if(!b) return;
      const url=URL.createObjectURL(b);
      const a=document.createElement('a');
      // Aucun nom d athlete dans le fichier non plus.
      a.href=url; a.download='repcore-charge-bloc.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
    },'image/png');
  }catch(e){ toast('Export impossible sur cet appareil.','var(--orange)'); return false; }
  return true;
}

// ══════ GRILLE DE CHARGE : semaines × muscles ══════
// Une lecture en un écran de la trajectoire d'un bloc. LECTURE SEULE : rien
// ici n'écrit, et aucune assertion ne doit pouvoir prouver le contraire.
//
// CE QUE « tonnageRelatif » MESURE, ET POURQUOI PAS DES KILOS.
// Le volume par muscle de RepCore est une somme de SÉRIES PONDÉRÉES : chaque
// série vaut son poids d'intensité (table RIR) multiplié par son poids de rôle
// (primaire 1, secondaire 0,5). C'est cette mesure que MEV/MAV/MRV comparent,
// et c'est elle qui décide de la couleur d'une case.
// Calculer en plus un tonnage en kilos par muscle demanderait une SECONDE
// attribution, avec ses propres arrondis — deux mesures du même effort qui
// divergeraient au premier exercice mal classé. `tonnageRelatif` est donc la
// même grandeur, normalisée sur la semaine la plus chargée du bloc, comme la
// règle 4 le demande. Un seul modèle de volume, pas deux.
const GRILLE_SEMAINES_MAX=24;
// PURE. La zone d'un volume face à ses repères. Rend null sans repère : un
// muscle qu'on ne sait pas juger n'est pas jugé, il est écarté.
function _repereDe(v,r){
  if(!r) return null;
  if(v<r.mev) return 'sous-MEV';
  if(v<r.mavMin) return 'MEV-MAV';
  if(v<=r.mrv) return 'MAV-MRV';
  return 'sur-MRV';
}
// PURE. Le volume PRÉVISIONNEL d'une semaine, lu sur le gabarit. Sert aux
// semaines qui n'ont rien de loggé — une case vide ne dit rien, une case
// prévisionnelle dit ce qui est prévu.
//
// Le RIR n'est pas prescrit dans le gabarit : on compte donc chaque série à
// POIDS_RIR_ABSENT, exactement comme le fait le calcul réel devant une série
// sans RIR. Prévisionnel et réalisé se comparent alors sur la même échelle.
function _volumePrevisionnel(semaine,user){
  const out={};
  for(const c of ((semaine&&semaine.creneaux)||[])){
    if(!c||!c.active) continue;
    for(const ex of (c.exercises||[])){
      if(!ex||!ex.name) continue;
      const n=Math.max(0,parseInt(ex.series,10)||0);
      if(!n) continue;
      let cls=null;
      try{ cls=isCardio(ex)?VOL_CARDIO:resoudreMusclesLecture(ex.name,ex,user); }catch(e){ cls=null; }
      if(!cls||cls===VOL_CARDIO) continue;
      const pi=n*POIDS_RIR_ABSENT;
      for(const m of (cls.p||[])) out[m]=(out[m]||0)+pi*POIDS_ROLE.PRIMAIRE;
      for(const m of (cls.s||[])) out[m]=(out[m]||0)+pi*poidsSecondaire(user);
    }
  }
  return out;
}
// PURE, et AUCUNE ÉCRITURE. Rend un tableau plat de cases.
//
// `debut` et `fin` sont des index de semaine dans le bloc, bornés au bloc :
// demander la semaine 40 d'un bloc de 10 ne produit ni erreur ni case.
// Sans programme, sans repère, sans rien : tableau vide. La vue disparaît,
// elle ne casse pas.
function grilleCharge(user,opts){
  const u=_dossier(user);
  const semaines=semainesDuBloc(u);
  if(!semaines.length) return [];
  const o=opts||{};
  const d=Math.max(0,Math.round(Number(o.debut)||0));
  const f=Math.min(semaines.length-1,
    (o.fin===undefined||o.fin===null)?semaines.length-1:Math.round(Number(o.fin)));
  if(!(f>=d)) return [];
  const fenetre=semaines.slice(d,Math.min(f+1,d+GRILLE_SEMAINES_MAX));
  // Les muscles JUGEABLES, et eux seuls. Un muscle sans repère n'est pas
  // affiché — règle 3. LOMBAIRES, ABDUCTEURS et ADDUCTEURS en font partie, et
  // c'est une perte réelle : le lombaire est précisément celui dont la charge
  // cumulée fait le plus de dégâts. Un coach qui remplit user.reperesVolume
  // les fait réapparaître.
  const muscles=Object.keys(MUSCLES).filter(m=>!!reperesEffectifs(u,m));
  // Premier passage : les volumes bruts, et le maximum du bloc pour la
  // normalisation de la règle 4.
  const brut=[];
  let max=0;
  for(const w of fenetre){
    let vols=null, prevision=false;
    try{ vols=volumeSemaine(u,w.cle)||{}; }catch(e){ vols={}; }
    const rien=!Object.keys(vols).some(m=>vols[m]>0);
    if(rien){ vols=_volumePrevisionnel(w,u); prevision=true; }
    brut.push({w,vols,prevision});
    for(const m of muscles) if((vols[m]||0)>max) max=vols[m];
  }
  const out=[];
  for(const {w,vols,prevision} of brut){
    for(const m of muscles){
      const v=vols[m]||0;
      out.push({
        semaine:w.cle, index:w.index, muscle:m,
        series:Math.round(v*10)/10,
        // Normalisé sur la semaine la plus chargée du bloc : 1 au maximum,
        // jamais au-delà. Bloc entièrement vide : 0 partout, pas une division
        // par zéro.
        tonnageRelatif:max>0?Math.round((v/max)*1000)/1000:0,
        repere:_repereDe(v,reperesEffectifs(u,m)),
        prevision, decharge:!!w.decharge, courante:!!w.courante
      });
    }
  }
  return out;
}

// ══════ BLOC D'ENTRAÎNEMENT (programme sur plusieurs semaines) ══════
// sessions_config décrit UNE semaine type, et c'est tout ce que RepCore savait
// dire : le même sept-jours répété indéfiniment. Un bloc de dix semaines avec
// une décharge en cinquième et une montée de volume n'avait aucune existence.
//
// CE MODÈLE NE REMPLACE PAS sessions_config, IL LE DATE.
// Le gabarit reste sessions_config — intact, lu par tous les écrans existants.
// `programme` ajoute par-dessus : une date de départ, une durée, les semaines
// de décharge, et les ÉCARTS au gabarit semaine par semaine. Un bloc sans
// écart ne stocke donc rien de plus qu'un entier et une date.
//
//   user.programme = {
//     debut:    <ms>     lundi de la première semaine du bloc
//     semaines: <int>    durée, 1 à 24
//     decharges:[<int>]  indices de semaines de décharge, 0 pour la première
//     ecarts:   { '<semaine>': { '<créneau>': {exercises,name,notes,...} } }
//   }
//
// POURQUOI DES ÉCARTS ET NON DES COPIES : un bloc de douze semaines copié
// intégralement, c'est douze fois sept séances dans le document de l'athlète,
// relu ET réécrit à chaque envoi. Mesuré au lot d'archivage : le dossier moyen
// pèse déjà 1,7 Mo. Un écart ne pèse que ce qu'il change.
const PROG_SEMAINES_MAX=24;
const PROG_SEMAINES_MIN=1;
// ══════════ PROGRAMMATION D'UN EXERCICE — DEMANDE DE KEVIN, 27/08/2026 ═══
//
// « Le coach doit pouvoir, a cote de chaque exo, mettre en place une
// programmation : la charge maximale sur une repetition, le nombre de
// semaines, puis par semaine le nombre de series, de repetitions et le RPE
// vise. L'app en deduit la charge suggeree. »
//
// RPE ET NON RIR, ET LES DEUX COEXISTENT DEJA DANS L'APP. Le RIR compte les
// repetitions qu'il reste en reserve ; le RPE dit l'effort percu sur dix. Ils
// se repondent — RPE 8 = RIR 2 — mais ne se confondent pas : le coach
// programme en RPE parce que la table de pourcentages ci-dessous est ecrite
// en RPE, et c'est elle qui donne la charge.
//
// LA TABLE EST RECOPIEE TELLE QUE KEVIN L'A FOURNIE, ligne par ligne. Elle
// n'est PAS calculee : les formules d'Epley, Brzycki ou Lombardi donnent
// toutes des valeurs voisines mais differentes, et une charge de travail
// n'est pas un endroit ou improviser une approximation. C'est la meme regle
// que pour la table Ciqual et le tableau du sodium — une reference fournie se
// recopie, elle ne se reconstitue pas.
//
// LECTURE : RPE_PCT['8'][3] est le pourcentage du 1RM pour 4 repetitions a
// RPE 8 — l'indice est le rang, donc `reps - 1`.
const RPE_PCT=Object.freeze({
  '10' :[100.0,95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68.0],
  '9.5':[97.8,93.9,90.7,87.8,85.0,82.4,79.9,77.4,75.1,72.3,69.4,66.7],
  '9'  :[95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68.0,65.3],
  '8.5':[93.9,90.7,87.8,85.0,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64.0],
  '8'  :[92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68.0,65.3,62.6],
  '7.5':[90.7,87.8,85.0,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64.0,61.3],
  '7'  :[89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68.0,65.3,62.6,59.9],
  '6.5':[87.8,85.0,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64.0,61.3,58.6],
  // LA LIGNE 6 EST LA LIGNE 10 DÉCALÉE DE QUATRE RÉPÉTITIONS (30/09/2026),
  // comme 9, 8 et 7 le sont de une, deux et trois : elle s'en écartait de
  // 0,2 à 1,5 point. Au-delà de la ligne 10, la prolongation est celle que les
  // lignes 9, 8 et 7 donnent déjà (65,3 · 62,6 · 59,9), puis le même pas (57,2).
  '6'  :[86.3,83.7,81.1,78.6,76.2,73.9,70.7,68.0,65.3,62.6,59.9,57.2]
});
// L'ECHELLE, DU PLUS FACILE AU PLUS DUR : c'est l'ordre d'un selecteur, et
// c'est aussi celui de la table lue a l'envers.
const RPE_ECHELLE=Object.freeze(['6','6.5','7','7.5','8','8.5','9','9.5','10']);
const RPE_REPS_MAX=12;                 // la table s'arrete la, et on ne l'invente pas
const PROG_EX_SEMAINES_MAX=PROG_SEMAINES_MAX;   // meme plafond que le bloc
const PROG_EX_FIN_PREVENIR=1;          // on previent une semaine avant la fin
// 1RM plausibles. Bornes larges : ce n'est pas a l'app de juger d'une force,
// seulement d'ecarter une faute de frappe evidente.
const PROG_EX_MAX_MIN=1, PROG_EX_MAX_MAX=600;

// PURE. Le pourcentage du 1RM, ou null. Null quand la table ne dit rien —
// jamais une extrapolation : au-dela de douze repetitions, la relation
// charge/repetitions cesse d'etre lineaire et un chiffre invente serait une
// charge de travail fausse.
function pctDe1RM(rpe,reps){
  const r=String(rpe==null?'':rpe).trim();
  const n=Math.round(Number(reps));
  if(!RPE_PCT[r]) return null;
  if(!isFinite(n)||n<1||n>RPE_REPS_MAX) return null;
  return RPE_PCT[r][n-1];
}
// PURE. La charge arrondie a ce qu'on peut reellement charger sur une barre.
// MEMES PALIERS QUE chargeSuivante : 2,5 kg, et 1,25 sous 20 kg — au-dessous,
// deux kilos et demi font plus de dix pour cent de la charge.
function _arrondirCharge(kg){
  // Enveloppe d'arrondiCharge : au plus proche, pas de la barre.
  return arrondiCharge(kg,{sens:'proche'});
}
// PURE. La programmation d'un exercice, normalisee — ou null.
//
// TOUT EST VERIFIE ICI, une fois : un dossier revenu de Firebase peut avoir
// perdu son tableau (objet a trous), porter un 1RM en chaine, ou une semaine
// sans RPE. Les lecteurs en aval n'ont pas a se le redemander.
function progExDe(ex){
  const p=ex&&ex.prog;
  if(!p||typeof p!=='object') return null;
  const max=Number(p.max);
  if(!isFinite(max)||max<PROG_EX_MAX_MIN||max>PROG_EX_MAX_MAX) return null;
  const debut=Number(p.debut);
  if(!isFinite(debut)||debut<=0) return null;
  // Firebase rend un tableau a trous sous forme d'objet : on remet a plat, par
  // rang, comme le fait _normaliserSessionsConfig pour les creneaux.
  const brut=Array.isArray(p.semaines)?p.semaines
    :(p.semaines&&typeof p.semaines==='object'
      ?Object.keys(p.semaines).sort((a,b)=>Number(a)-Number(b)).map(k=>p.semaines[k])
      :null);
  if(!brut||!brut.length) return null;
  const sem=brut.slice(0,PROG_EX_SEMAINES_MAX).map(s=>{
    const o=(s&&typeof s==='object')?s:{};
    const series=Math.round(Number(o.series));
    const reps=Math.round(Number(o.reps));
    const rpe=String(o.rpe==null?'':o.rpe).trim();
    return {series:(isFinite(series)&&series>0)?series:null,
            reps:(isFinite(reps)&&reps>0)?reps:null,
            rpe:RPE_PCT[rpe]?rpe:''};
  });
  return {max,debut:_lundiDe(new Date(debut)).getTime(),semaines:sem};
}
// PURE. Le rang de la semaine a une date, ou null hors programmation.
// ALIGNE SUR LE LUNDI, comme le bloc : une programmation qui changerait de
// semaine un mercredi ferait deux consignes dans la meme seance.
function semaineProgEx(prog,date){
  if(!prog) return null;
  const t=(date instanceof Date)?date.getTime():Number(date==null?Date.now():date);
  if(!isFinite(t)) return null;
  const i=Math.round((_lundiDe(new Date(t)).getTime()-prog.debut)/604800000);
  return (i>=0&&i<prog.semaines.length)?i:null;
}
// PURE. La consigne de la semaine en cours : series, repetitions, RPE, charge.
// Rend null hors programmation, ou quand la semaine est incomplete — une
// ligne a moitie remplie ne prescrit rien.
// ═════ LE 1RM DU DOSSIER, CONFRONTE A CE QUI EST REELLEMENT SOULEVE ═════
//
// ⚠ IL NE BOUGEAIT JAMAIS, ET C'EST LE BUG RAPPORTE LE 14/09/2026 : « j'ai
// beau mettre 60 kg en RIR 0, la semaine d'apres il me propose toujours
// 20 kg ». La charge prescrite vaut `max × pourcentage`, et `max` est le 1RM
// saisi UNE FOIS par le coach. Un athlete qui progresse, ou un 1RM entre trop
// bas au depart, recevait la meme consigne indefiniment — une consigne que la
// seance d'avant avait deja demontree fausse.
//
// CE N'EST PAS UN NOUVEAU MODELE. On garde la methode du coach — sa table de
// pourcentages, ses semaines, son RPE — et on corrige la SEULE entree qui
// avait vieilli. L'e1RM existe deja dans ce fichier et sert deja aux records
// et a la detection de plateau ; c'est lui qu'on relit.
//
// ET RIEN NE SE FAIT EN SILENCE : la consigne rend `maxObserve` et
// `maxDepasse`, l'ecran de seance et le bouton du coach le disent tous les
// deux, et le coach garde la main sur le chiffre du dossier.
const PROG_EX_OBS_JOURS=120;   // au-dela, ce n'est plus la forme du moment
const PROG_EX_OBS_ECART=1.10;  // 10 % : sous cet ecart, on ne touche a rien
// PURE. Le meilleur e1RM observe sur cet exercice, ou null.
function maxE1rmObserve(user,nomEx,maintenant){
  const u=_dossier(user);
  const l=(u&&Array.isArray(u.sessions))?u.sessions:[];
  if(!l.length||!nomEx) return null;
  // Ce maximum sert à PRESCRIRE une charge en kg (consigneProgEx) : il n'a de
  // sens que pour une charge externe. Au poids du corps, lesté ou assisté, la
  // charge effective n'est pas ce qu'on met sur la barre.
  const _ex=_exPourCharge(nomEx,u);
  if(typeCharge(_ex)!=='externe') return null;
  const t=(maintenant instanceof Date)?maintenant.getTime()
    :Number(maintenant==null?Date.now():maintenant);
  const limite=(isFinite(t)?t:Date.now())-PROG_EX_OBS_JOURS*86400000;
  let haut=0;
  for(const sess of l){
    if(!sess) continue;
    // Une decharge n'est pas une mesure de force : elle est concue pour etre
    // facile, et la compter reviendrait a faire baisser une reference.
    if(sess.deload===true) continue;
    const d=Number(sess.date);
    if(isFinite(d)&&d>0&&d<limite) continue;
    const dd=_dataDeSeance(sess,nomEx);
    if(!dd||!Array.isArray(dd.sets)) continue;
    for(const se of dd.sets){
      if(!se||se.done!==true) continue;
      const w=chargeEffective(se,_ex,user); if(!(w>0)) continue;
      const r=_perfReps(se);
      // Au-dela de douze repetitions l'e1RM n'est plus fiable : la meme borne
      // que partout ailleurs dans ce fichier, et pour la meme raison.
      if(!(r>0)||!e1rmFiable(r,_perfRir(se,user))) continue;
      const v=e1rm(w,r,_perfRir(se,user));
      if(v>haut) haut=v;
    }
  }
  if(!(haut>0)) return null;
  const v=Math.round(haut*10)/10;
  // Memes bornes que le champ du coach : une valeur hors echelle vient d'une
  // saisie aberrante, et on ne prescrit pas sur une saisie aberrante.
  return (v>=PROG_EX_MAX_MIN&&v<=PROG_EX_MAX_MAX)?v:null;
}
// `user` EST FACULTATIF, ET SON ABSENCE VAUT « AUCUNE CORRECTION » : tout
// appelant a deux arguments garde exactement le comportement d'avant.
function consigneProgEx(ex,date,user){
  const p=progExDe(ex);
  if(!p) return null;
  const i=semaineProgEx(p,date);
  if(i===null) return null;
  const s=p.semaines[i];
  if(!s||!s.series||!s.reps||!s.rpe) return null;
  const pct=pctDe1RM(s.rpe,s.reps);
  const obs=user?(()=>{ try{ return maxE1rmObserve(user,ex&&ex.name,date); }
                        catch(e){ return null; } })():null;
  const depasse=(obs!=null&&obs>p.max*PROG_EX_OBS_ECART);
  const ref=depasse?obs:p.max;
  const kg=(pct==null)?null:_arrondirCharge(ref*pct/100);
  return {semaine:i,total:p.semaines.length,series:s.series,reps:s.reps,
          rpe:s.rpe,pct,kg,max:p.max,
          // Ce qu'on a observe, ce qu'on a retenu, et s'ils different : de
          // quoi ecrire la phrase sans refaire le calcul.
          maxObserve:obs, maxRetenu:ref, maxDepasse:depasse,
          // RIR EQUIVALENT, pour l'athlete qui lit en RIR depuis toujours.
          // 10 - RPE, la conversion usuelle ; affichee, jamais enregistree
          // comme une mesure — voir la carte des series.
          rir:Math.round((10-Number(s.rpe))*10)/10};
}
// PURE. La programmation touche-t-elle a sa fin ? Rend le nombre de semaines
// restantes, fin comprise, ou null. Sert au coach : une programmation qui
// s'acheve sans que rien ne le dise laisse l'athlete sans consigne le lundi
// suivant.
function finProgExProche(ex,date){
  const p=progExDe(ex);
  if(!p) return null;
  const i=semaineProgEx(p,date);
  if(i===null) return null;
  const restantes=p.semaines.length-i;
  return (restantes<=PROG_EX_FIN_PREVENIR+1)?restantes:null;
}

// PURE. Le programme, ou null s'il est absent, incomplet ou corrompu. AUCUNE
// exception ne sort d'ici : un dossier abîmé fait disparaître la vue, il ne
// casse pas l'écran.
function programmeDe(user){
  const u=_dossier(user);
  const p=u&&u.programme;
  if(!p||typeof p!=='object') return null;
  const debut=Number(p.debut);
  if(!isFinite(debut)||debut<=0) return null;
  const n=Math.round(Number(p.semaines));
  if(!isFinite(n)||n<PROG_SEMAINES_MIN||n>PROG_SEMAINES_MAX) return null;
  // Les décharges hors bloc sont IGNORÉES, pas rejetées : un bloc raccourci
  // après coup ne doit pas devenir illisible.
  const dech=Array.isArray(p.decharges)
    ? p.decharges.map(x=>Math.round(Number(x))).filter(x=>isFinite(x)&&x>=0&&x<n)
    : [];
  const ec=(p.ecarts&&typeof p.ecarts==='object'&&!Array.isArray(p.ecarts))?p.ecarts:{};
  return {debut:_lundiDe(new Date(debut)).getTime(),semaines:n,
    decharges:[...new Set(dech)].sort((a,b)=>a-b),ecarts:ec};
}
// PURE. L'index de semaine d'une date dans le bloc, ou null si la date tombe
// hors bloc. Zéro pour la première semaine.
function indexSemaineBloc(user,date){
  const p=programmeDe(user);
  if(!p) return null;
  const t=(date instanceof Date)?date.getTime():Number(date||Date.now());
  if(!isFinite(t)) return null;
  const lundi=_lundiDe(new Date(t)).getTime();
  const i=Math.round((lundi-p.debut)/604800000);
  return (i>=0&&i<p.semaines)?i:null;
}
// PURE. La semaine EFFECTIVE à une date : le gabarit, plus les écarts de cette
// semaine-là. Rend null hors bloc ou sans programme.
//
// AUCUN EFFET DE BORD, et c'est la propriété qui compte : une vue qui parcourt
// vingt-quatre semaines l'appelle vingt-quatre fois, y compris sur des semaines
// FUTURES. Si elle écrivait quoi que ce soit, consulter un programme le
// modifierait.
function getSemaineEffective(user,date){
  const p=programmeDe(user);
  if(!p) return null;
  const i=indexSemaineBloc(user,date);
  if(i===null) return null;
  const u=_dossier(user);
  const gabarit=Array.isArray(u&&u.sessions_config)?u.sessions_config:[];
  const ecSem=p.ecarts[String(i)]||{};
  // Copie DÉFENSIVE : l'appelant reçoit une vue, pas une référence sur le
  // dossier. Sans elle, un écran qui trie ou complète le tableau rendu
  // modifierait le programme de l'athlète sans qu'aucune écriture soit écrite.
  const creneaux=gabarit.map((sc,idx)=>{
    const e=ecSem[String(idx)];
    const base=Object.assign({},sc||{});
    base.exercises=((sc&&sc.exercises)||[]).map(x=>Object.assign({},x));
    if(!e||typeof e!=='object') return base;
    const fusion=Object.assign(base,e);
    if(Array.isArray(e.exercises))
      fusion.exercises=e.exercises.map(x=>Object.assign({},x));
    return fusion;
  });
  // LE LUNDI DE LA SEMAINE i, EN CALENDRIER. `p.debut + i*604800000` derivait
  // d'une heure au passage a l'heure d'hiver : la semaine 1 d'un bloc parti le
  // 19 octobre tombait le dimanche 25 a 23 h, _lundiDe la ramenait au lundi 19,
  // et la semaine 1 portait alors la MEME clef ISO que la semaine 0. Une
  // semaine apparaissait deux fois dans la grille de charge, une autre
  // disparaissait — sans erreur, sans trace.
  const lundi=_lundiDe(_datePlusJours(p.debut,i*7));
  return {index:i,cle:semaineISO(lundi),lundi:lundi.getTime(),
    decharge:p.decharges.indexOf(i)>=0,
    // « Passée » se juge sur la semaine COURANTE, pas sur l'instant : une
    // semaine en cours n'est ni finie ni future, et la grille l'encadre.
    courante:semaineISO(lundi)===semaineISO(new Date()),
    future:lundi.getTime()>_lundiDe(new Date()).getTime(),
    creneaux,
    // Le nombre de séances RÉELLEMENT prévues cette semaine-là : c'est lui
    // qui change entre une semaine normale et une décharge.
    seancesPrevues:creneaux.filter(c=>c&&c.active).length};
}
// ══════ LA SÉANCE DU JOUR (06/10/2026, build 1823) ══════════════════════
//
// getSemaineEffective calculait bien la semaine — décharge du bloc et écarts
// compris —, mais l'athlète lançait sa séance avec le GABARIT BRUT :
// _apercuOuSeance et commencerDepuisApercu passaient sessions_config[idx] à
// demarrerSeance. Constat au banc : semaine de décharge = 2 séries RIR 3 dans
// la grille du coach, 4 séries RIR 2 dans la séance.
//
// PURE. Le créneau tel qu'il vaut À CETTE DATE : celui de la semaine effective
// si le bloc en rend une, le gabarit sinon. TOUJOURS UNE COPIE — l'aperçu, la
// séance et la fiche imprimée en lisent une ; sessions_config n'est jamais
// touché. null si le créneau n'existe pas.
function seanceDuJour(user,idx,date){
  const u=_dossier(user);
  const cfg=(u&&u.sessions_config)||[];
  const base=cfg[idx];
  if(!base||typeof base!=='object') return null;
  let sem=null;
  try{ sem=getSemaineEffective(u,date==null?Date.now():date); }catch(e){ sem=null; }
  const src=(sem&&Array.isArray(sem.creneaux)&&sem.creneaux[idx])||base;
  const copie=Object.assign({},src);
  // LE GABARIT DÉCIDE SI LE CRÉNEAU EST ACTIF : un écart resté sur un créneau
  // éteint (ou qui porterait `active`) ne le rallume pas.
  copie.active=base.active;
  copie.exercises=((src&&src.exercises)||[]).map(x=>(x&&typeof x==='object')?JSON.parse(JSON.stringify(x)):x);
  return copie;
}
// La séance du jour telle que l'athlète la FERA : avec, en plus, l'allègement
// d'une décharge posée sur le créneau (hors bloc). C'est ce que montrent
// l'aperçu et la fiche ; launchWorkout applique la même règle à sa copie.
function seanceDuJourAffichee(user,idx,date){
  const s=seanceDuJour(user,idx,date);
  if(!s) return null;
  const t=date==null?Date.now():Number(date instanceof Date?date.getTime():date);
  try{ if(dechargeCreneauAAlleger(user,s,t)) allegerExercicesDecharge(s.exercises); }catch(e){}
  return s;
}
// PURE. La décharge du CRÉNEAU allège-t-elle cette séance ? Pas quand la
// semaine du bloc est déjà une décharge : son écart l'a déjà allégée, et la
// règle ne s'applique pas deux fois.
function dechargeCreneauAAlleger(user,sc,t){
  if(!creneauEnDecharge(sc,t)) return false;
  let blocDech=false;
  try{ const sem=getSemaineEffective(user,t); blocDech=!!(sem&&sem.decharge); }catch(e){ blocDech=false; }
  return !blocDech;
}
// ══════ B3.2 — ECRIRE UN ECART, ET NON SEULEMENT LE LIRE ═══════════════
//
// `programme.ecarts` etait documente, lu par getSemaineEffective — donc par
// semainesDuBloc et grilleCharge — et ECRIT PAR UNE SEULE LIGNE du fichier :
// son initialisation a objet vide. Aucun ecran ne permettait de faire differer
// une semaine d'une autre : « bloc de douze semaines » signifiait « la meme
// semaine douze fois », et la grille de charge affichait douze colonnes
// identiques. Un coach ne pouvait pas periodiser.
//
// UN ECART EST UNE MODULATION, PAS UNE COPIE. C'est la raison d'etre du
// modele, ecrite plus haut : un bloc de douze semaines copie integralement,
// c'est douze fois sept seances dans un dossier qui pese deja 1,7 Mo. On ne
// stocke donc que les exercices du creneau touche, avec leurs series et leur
// RIR modifies — le reste du creneau continue de suivre le gabarit par
// Object.assign.
//
// LES DEUX LEVIERS D'UNE PROGRESSION, et pas un de plus : le nombre de series
// et l'intensite cible. Ce sont ceux que la fiche demande, et ce sont ceux que
// le reste de l'app sait deja lire — _volumePrevisionnel compte les series,
// _rirPrescrit lit le RIR.
const ECART_SERIES_MIN=1;      // une serie reste une serie : on ne descend pas a zero
const ECART_SERIES_MAX=12;
// PURE. Le creneau tel qu'il serait avec cette modulation. Rend null quand la
// modulation ne change rien — un ecart qui ne pese rien n'a pas a etre ecrit.
function _creneauModule(sc,mod){
  if(!sc||!Array.isArray(sc.exercises)||!sc.exercises.length) return null;
  const dS=Math.round(Number(mod&&mod.series)||0);
  const dR=Math.round(Number(mod&&mod.rir)||0);
  const fS=Number(mod&&mod.facteurSeries);
  if(!dS&&!dR&&!(isFinite(fS)&&fS>0&&fS!==1)) return null;
  let change=false;
  const ex=sc.exercises.map(x=>{
    const c=Object.assign({},x);
    const n0=Math.max(0,parseInt(c.series,10)||0);
    if(n0){
      let n=n0;
      if(isFinite(fS)&&fS>0&&fS!==1) n=Math.round(n0*fS);
      n+=dS;
      n=Math.max(ECART_SERIES_MIN,Math.min(ECART_SERIES_MAX,n));
      if(n!==n0){ c.series=n; change=true; }
    }
    if(dR){
      // MEME ECHELLE QUE PARTOUT : 0 est l'echec, 5 tres facile. Un exercice
      // SANS consigne n'en recoit pas une par la bande — l'absence de consigne
      // se lit comme une absence, jamais comme un zero.
      const r0=_rirPrescrit(c);
      if(r0!==''){
        const r=Math.max(0,Math.min(5,Number(r0)+dR));
        if(String(r)!==String(r0)){ c.rir=String(r); change=true; }
      }
    }
    return c;
  });
  return change?{exercises:ex}:null;
}
// Pose une modulation sur TOUS les creneaux actifs d'une semaine du bloc.
// ECRIT dans le dossier — l'appelant enregistre et pousse, comme partout.
// Rend le nombre de creneaux touches, 0 si rien n'a bouge.
function poserEcartSemaine(user,semaine,mod){
  const u=_dossier(user);
  if(!u) return 0;
  let p=null; try{ p=programmeDe(u); }catch(e){}
  if(!p||!(semaine>=0&&semaine<p.semaines)) return 0;
  const cfg=Array.isArray(u.sessions_config)?u.sessions_config:[];
  if(!u.programme.ecarts||typeof u.programme.ecarts!=='object') u.programme.ecarts={};
  const cle=String(semaine);
  const sem=Object.assign({},u.programme.ecarts[cle]||{});
  let n=0;
  cfg.forEach((sc,idx)=>{
    if(!sc||sc.active!==true) return;
    const e=_creneauModule(sc,mod);
    if(!e) return;
    sem[String(idx)]=e;
    n++;
  });
  if(!n) return 0;
  // B3.3 — UN ECART POSE PAR LA DECHARGE SE RECONNAIT. C'est ce qui permet de
  // le RETIRER quand le coach retire la decharge, sans toucher a un ecart
  // qu'il aurait ecrit lui-meme pour la meme semaine. La clef n'est pas un
  // indice de creneau : getSemaineEffective ne lit que des indices numeriques,
  // elle l'ignore donc entierement.
  if(mod&&mod._decharge) sem._decharge=true;
  u.programme.ecarts[cle]=sem;
  try{ _viderCacheVolume(); }catch(e){}
  return n;
}
// Retire tout ecart d'une semaine : elle redevient STRICTEMENT le gabarit.
// C'est la contrepartie exigee par le modele — un ecart qu'on ne peut pas
// defaire est une copie deguisee.
function retirerEcartSemaine(user,semaine){
  const u=_dossier(user);
  if(!u||!u.programme||!u.programme.ecarts) return false;
  const cle=String(semaine);
  if(!(cle in u.programme.ecarts)) return false;
  delete u.programme.ecarts[cle];
  try{ _viderCacheVolume(); }catch(e){}
  return true;
}
// B3.3 — LES ECARTS DE DECHARGE SUIVENT LA LISTE DES DECHARGES.
//
// Sans cela, retirer une semaine de la liste laisserait son allegement en
// place : la grille montrerait un creux sur une semaine qui n'est plus une
// decharge, et le coach n'aurait aucun moyen de comprendre pourquoi. C'est la
// contrepartie exacte de B3.3 — « retirer la decharge remet la semaine a son
// niveau ».
//
// UN ECART ECRIT A LA MAIN N'EST JAMAIS TOUCHE : seuls ceux qui portent la
// marque `_decharge` sont poses et retires ici.
function synchroniserEcartsDecharge(user){
  const u=_dossier(user);
  if(!u||!u.programme) return 0;
  let p=null; try{ p=programmeDe(u); }catch(e){}
  if(!p) return 0;
  if(!u.programme.ecarts||typeof u.programme.ecarts!=='object') u.programme.ecarts={};
  const ec=u.programme.ecarts;
  let n=0;
  // Ce qui n'est plus une decharge perd son allegement.
  for(const cle of Object.keys(ec)){
    const i=Number(cle);
    if(!isFinite(i)) continue;
    if(ec[cle]&&ec[cle]._decharge&&p.decharges.indexOf(i)<0){ delete ec[cle]; n++; }
  }
  // Ce qui en est une, et n'en portait pas, le recoit.
  for(const i of p.decharges){
    const cle=String(i);
    if(ec[cle]) continue;
    if(poserEcartSemaine(u,i,{facteurSeries:DECHARGE_FACTEUR_SERIES,
                              rir:DECHARGE_RIR_PLUS,_decharge:true})) n++;
  }
  return n;
}
// PURE. Cette semaine porte-t-elle un ecart ?
function semainePorteEcart(user,semaine){
  try{
    const p=programmeDe(user);
    if(!p) return false;
    const e=p.ecarts[String(semaine)];
    return !!(e&&typeof e==='object'&&Object.keys(e).length);
  }catch(e){ return false; }
}
// PURE. Toutes les semaines du bloc, dans l'ordre. Vide sans programme.
function semainesDuBloc(user){
  const p=programmeDe(user);
  if(!p) return [];
  const out=[];
  for(let i=0;i<p.semaines;i++){
    // MEME RAISON QU'AU-DESSUS, et il faut les deux : celle-ci choisit la date
    // qu'on interroge, celle-la nomme la semaine obtenue. Une seule des deux
    // corrigee laissait la derive entrer par l'autre.
    const w=getSemaineEffective(user,_datePlusJours(p.debut,i*7));
    if(w) out.push(w);
  }
  return out;
}

function semaineISO(date){
  const lundi=_lundiDe(date);
  // ISO 8601 : la semaine 1 est celle qui contient le premier jeudi de
  // l'année. On date donc la semaine par SON jeudi, ce qui règle d'un coup le
  // 31 décembre et le 1er janvier.
  const jeudi=new Date(lundi); jeudi.setDate(jeudi.getDate()+3);
  const an=jeudi.getFullYear();
  const premierLundi=_lundiDe(new Date(an,0,4));   // le 4 janvier est toujours en S1
  const n=Math.round((lundi-premierLundi)/604800000)+1;
  return an+'-W'+String(n).padStart(2,'0');
}
function _lundiDeSemaine(cle){
  const m=/^(\d{4})-W(\d{1,2})$/.exec(String(cle||''));
  if(!m) return null;
  const d=_lundiDe(new Date(+m[1],0,4));
  d.setDate(d.getDate()+(+m[2]-1)*7);
  return d;
}
function _cleJour(ms){
  const d=new Date(ms);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ── Cache mémoire, JAMAIS persisté ─────────────────────────────────────────
// Un athlète peut avoir plusieurs centaines de séances et l'écran se rejoue à
// chaque changement de semaine. La clé porte l'e-mail : un coach consulte
// plusieurs athlètes dans la même session.
let _cacheVolume={};
function _viderCacheVolume(){ _cacheVolume={}; }

// Le cœur : une passe sur les séances de la semaine.
// PURE. Les séries dures d'UNE séance, par muscle : séries éligibles
// (serieEligible), pondérées par le RIR (poidsIntensite), un muscle
// secondaire comptant une demi-série. Le cardio ne compte nulle part ; un
// exercice inconnu n'est pas réparti au hasard, il est signalé.
function _volumeSeance(sess,user){
  const out={muscles:{},eligibles:0,sansRir:0,nonRattachees:0,exNonRattaches:[]};
  const data=(sess&&sess.data&&typeof sess.data==='object')?sess.data:{};
  for(const nom of Object.keys(data)){
    const d=data[nom];
    if(!d||!Array.isArray(d.sets)||!d.sets.length) continue;
    // L'objet exercice n'est pas conservé dans l'historique : on le
    // reconstitue à partir du nom et des reps de la première série, seuls
    // éléments dont isCardio a besoin.
    // Les reps en TEXTE : isCardio les lit comme une chaîne, et un nombre venu
    // d'un import le faisait lever.
    const r0=d.sets[0].reps;
    const ex={name:nom,reps:(r0==null?r0:String(r0)),methode:d.methode,technique:d.technique};
    // Le type de charge posé par le coach, s'il y en a un (sinon le nom décide).
    try{ const _tc=_exPourCharge(nom,user).typeCharge; if(_tc) ex.typeCharge=_tc; }catch(e){}
    const cardio=isCardio(ex);
    const cls=cardio?VOL_CARDIO:resoudreMusclesLecture(nom,ex,user);
    let elig=0,sansRir=0;
    for(const s of d.sets){
      if(!serieEligible(s,ex)) continue;
      elig++;
      if(s.rir===''||s.rir==null) sansRir++;
    }
    if(!elig) continue;
    out.eligibles+=elig;
    out.sansRir+=sansRir;
    if(cls===VOL_CARDIO) continue;         // compté nulle part, signalé nulle part
    if(!cls){                               // exercice inconnu : on ne répartit pas au hasard
      out.nonRattachees+=elig;
      if(out.exNonRattaches.indexOf(nom)<0) out.exNonRattaches.push(nom);
      continue;
    }
    // LE MÊME COMPTE QUE serieDure : intensité × rôle × technique. La
    // technique n'y entrait pas, alors que l'écran Volume en affiche les poids.
    const _kt=poidsTechnique(techniqueDe(ex),user), _ks=poidsSecondaire(user);
    for(const s of d.sets){
      if(!serieEligible(s,ex)) continue;
      const pi=poidsIntensite(s)*_kt;
      if(!pi) continue;
      for(const m of (cls.p||[])) out.muscles[m]=(out.muscles[m]||0)+pi*POIDS_ROLE.PRIMAIRE;
      for(const m of (cls.s||[])) out.muscles[m]=(out.muscles[m]||0)+pi*_ks;
    }
  }
  return out;
}
function _calculSemaine(user,cle){
  const k=(user&&user.email||'?')+'|'+cle+'|'+reperesComptageDe(user);
  if(_cacheVolume[k]) return _cacheVolume[k];
  const res={muscles:{},freq:{},eligibles:0,sansRir:0,nonRattachees:0,
             exNonRattaches:[],aberrants:{},maxParSeance:{},seances:0,ts:Date.now()};
  const lundi=_lundiDeSemaine(cle);
  if(!lundi||!user||!Array.isArray(user.sessions)) return (_cacheVolume[k]=res);
  const debut=lundi.getTime();
  const fin=debut+7*86400000;
  // Filtrage par date AVANT d'ouvrir data : c'est ce qui tient la contrainte
  // des 30 ms sur plusieurs centaines de séances.
  const parJour={};
  const vus=new Set();
  for(const sess of user.sessions){
    if(!sess||!sess.data) continue;
    const t=sess.date;
    if(!(t>=debut&&t<fin)) continue;
    res.seances++;
    const jour=_cleJour(t);
    const j=parJour[jour]||(parJour[jour]={});
    // LE DÉCOMPTE D'UNE SÉANCE vit dans _volumeSeance, partagé avec la carte
    // musculaire (volumeParMuscle). Les pondérations sont des multiples de
    // 0,25 : sommer par séance puis par semaine donne le même total, exact.
    const r=_volumeSeance(sess,user);
    res.eligibles+=r.eligibles;
    res.sansRir+=r.sansRir;
    res.nonRattachees+=r.nonRattachees;
    for(const nom of r.exNonRattaches) if(!vus.has(nom)){ vus.add(nom); res.exNonRattaches.push(nom); }
    const parSeance=r.muscles;
    for(const m in parSeance){ const v=parSeance[m];
      res.muscles[m]=(res.muscles[m]||0)+v; j[m]=(j[m]||0)+v; }
    for(const m in parSeance) if(parSeance[m]>VOL_SEUIL_ABERRANT) res.aberrants[m]=true;
    // Plus gros total obtenu sur UNE séance. parSeance est déjà construit
    // au-dessus pour le seuil d'aberration : on ne le recalcule pas.
    for(const m in parSeance) if(parSeance[m]>(res.maxParSeance[m]||0)) res.maxParSeance[m]=parSeance[m];
  }
  // Fréquence : jours DISTINCTS où le muscle a reçu au moins une série dure
  // entière. Une demi-série secondaire isolée ne fait pas une séance de plus.
  for(const jour in parJour)
    for(const m in parJour[jour])
      if(parJour[jour][m]>=1) res.freq[m]=(res.freq[m]||0)+1;
  _cacheVolume[k]=res;
  return res;
}
// Une phrase grise sous la barre, quand le volume de la semaine tient
// pour l'essentiel sur une seule séance. Elle ne dépend PAS de
// REPERES_VOLUME : un muscle sans repère la reçoit comme les autres, parce
// que répartir son volume est une question de répartition, pas de zone.
function _htmlConcentration(res,m){
  const max=((res&&res.maxParSeance)||{})[m]||0;
  const tot=((res&&res.muscles)||{})[m]||0;
  if(!(max>VOL_CONCENTRATION_SEANCE)) return '';
  if(!(tot>0)||!(max/tot>VOL_CONCENTRATION_PART)) return '';
  return `<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px;line-height:1.5">${volAffiche(max)} des ${volAffiche(tot)} séries sur une seule séance : les répartir sur deux jours donnerait probablement plus.</div>`;
}
function volumeSemaine(user,cle){ return _calculSemaine(user,cle).muscles; }
function frequenceSemaine(user,cle,muscle){ return _calculSemaine(user,cle).freq[muscle]||0; }

// PURE. « 3×/sem », ou '' quand la fréquence est nulle.
//
// CE FORMAT EST CELUI DE L'ÉCRAN ATHLÈTE. renderVolume écrit déjà
// `freq+'×/sem'` sur exactement la même donnée : deux orthographes d'une même
// mesure selon qu'on la lit côté coach ou côté athlète seraient deux
// conventions à apprendre.
//
// UNE CELLULE VIDE ET NON « ×0 ». Un muscle peut porter du volume sans aucun
// jour à série dure entière — des demi-séries secondaires accumulées. « ×0 »
// se lirait comme un constat sur la semaine, alors que c’est le compteur qui
// ne s’applique pas.
//
// AUCUN SEUIL, AUCUNE COULEUR PAR VALEUR : l’application n’a pas de doctrine
// de fréquence, et en poser une ici en créerait une seconde à côté des repères
// MEV/MAV/MRV, qui sont documentés et surchargeables. On montre le nombre.
function _libFrequence(user,cle,muscle){
  let n=0; try{ n=frequenceSemaine(user,cle,muscle); }catch(e){ n=0; }
  return n>0?(n+'×/sem'):'';
}
// ── Repères effectifs ──────────────────────────────────────────────────────
// Surcharge partielle : le coach peut ne remonter que le MRV, les autres
// bornes gardent leur défaut. Rend null pour un muscle sans repère : l'écran
// affiche alors le volume sans le juger.
//
// TROIS ETAGES, ET L'ORDRE EST UNE HIERARCHIE D'AUTORITE :
//   1. REPERES_VOLUME      — le repere de pratique de terrain, identique pour
//                            tous, jamais modifie ;
//   2. user.reperesAuto    — ce que la boucle de retour hebdomadaire a mesure
//                            SUR CET ATHLETE (voir appliquerRetourMuscle) ;
//   3. user.reperesVolume  — la surcharge du COACH, qui passe en dernier et
//                            gagne donc sur les deux autres.
//
// LE COACH GAGNE, ET CE N'EST PAS NEGOCIABLE. Une mesure automatique qui
// ecraserait une decision prise par quelqu'un qui connait l'athlete serait un
// systeme qui s'arroge le dernier mot. Il peut lire ce que la boucle propose,
// il decide.
//
// `source` DIT D'OU VIENT LE CHIFFRE. Sans elle, le coach ne peut plus
// arbitrer : un repere de reference et un repere mesure se lisent pareil, et
// il ne sait pas lequel il a le droit de contredire.
function reperesEffectifs(user,muscle){
  // AU DÉPART, ×0,8 POUR UN DÉBUTANT OU UN SENIOR (profilEntrainement, build
  // 1829) — sur la TABLE seulement : la boucle de retour (reperesAuto) et le
  // coach (reperesVolume) l'ajustent ensuite. Un muscle PRIORITAIRE (bloc de
  // priorité) ne descend jamais sous le MEV de la table.
  const d0=REPERES_VOLUME[muscle];
  let d=d0;
  try{
    const f=d0&&user?facteurVolumeProfil(user):1;
    if(f!==1){
      d=Object.assign({},d0);
      for(const b of ['mev','mavMin','mavMax','mrv']) if(typeof d[b]==='number') d[b]=Math.round(d[b]*f);
      let prio=false; try{ const bp=blocPriorite(user); prio=!!(bp&&bp.hauts.indexOf(muscle)>=0); }catch(e){}
      if(prio) d.mev=Math.max(d.mev,d0.mev);
    }
  }catch(e){ d=d0; }
  const a=user&&user.reperesAuto&&user.reperesAuto[muscle];
  const o=user&&user.reperesVolume&&user.reperesVolume[muscle];
  if(!d&&!a&&!o) return null;
  const r=Object.assign({},d||{},a||{},o||{});
  for(const b of ['mev','mavMin','mavMax','mrv']) if(typeof r[b]!=='number') return null;
  // LE VOLUME DE MAINTIEN (mv) : posé par le coach ou la boucle s'il l'a été,
  // sinon la moitié du MEV EFFECTIF — un MEV surchargé déplace le maintien.
  const mvPose=[o,a].find(x=>x&&typeof x.mv==='number');
  r.mv=mvPose?Math.max(0,mvPose.mv):Math.max(0,Math.round(r.mev/2));
  // Un etage superieur qui ne fait que RECOPIER la valeur du dessous ne change
  // rien : l'annoncer « ajuste » ferait lire une mesure la ou il n'y en a pas.
  const bouge=(src)=>!!src&&['mev','mavMin','mavMax','mrv']
    .some(b=>typeof src[b]==='number'&&(!d0||src[b]!==d0[b]));
  r.source=bouge(o)?'coach':(bouge(a)?'perso':'table');
  return r;
}
// L'ENTREE COTE COACH. Une ligne dans la fiche client, et le bouton qui ouvre
// une echeance quand il n'y en a pas.
function _htmlEcheanceCoach(c){
  const u=_dossier(c);
  const e=echeance(u);
  const j=e?echeanceJour(u):null;
  const tete='<div class="card card--dense" style="margin-bottom:16px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:8px">Échéance</div>';
  if(!e)
    return tete+'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-bottom:8px">'
      +'Aucune échéance active. Une seule à la fois : en ouvrir une seconde remplace la première.</div>'
      +'<button class="btn btn-outline btn-sm" style="width:100%" onclick="_echOuvrirDialogue()">Ouvrir une échéance</button></div>';
  const lib=({COMPETITION:'Compétition',SHOOTING:'Shooting',OBJECTIF:'Objectif'})[e.type]||'Échéance';
  return tete
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'
    +escapeHtml(lib)+(j?(' · '+(j.j>=0?('J-'+j.j):('J+'+(-j.j)))):'')
    +(e.federation?' · '+escapeHtml(e.federation):'')+'</div>'
    +'<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" '
    +'onclick="ouvrirEcheanceEcran(getOwnedClient(currentClientId))">Ouvrir le compte à rebours</button></div>';
}
// L'OUVERTURE. Le remplacement est CONFIRME — deux echeances, ce sont deux
// comptes a rebours et deux jeux de cibles pour le meme jour.
async function _echOuvrirDialogue(){
  const c=(typeof currentClientId!=='undefined'&&currentClientId)?getOwnedClient(currentClientId):null;
  if(!c){ try{ toast('Aucun athlète ouvert.','var(--orange)'); }catch(e){} return false; }
  const d=await rcSaisie('Date de l’échéance','Format JJ/MM/AAAA','','');
  if(!d) return false;
  const m=String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m){ try{ toast('Date attendue au format JJ/MM/AAAA.','var(--orange)'); }catch(e){} return false; }
  const ts=new Date(Number(m[3]),Number(m[2])-1,Number(m[1])).getTime();
  if(echeance(c)){
    let ok=false;
    try{ ok=await rcConfirm('Remplacer l’échéance en cours ?',
      'Une seule échéance à la fois. La précédente et ses fiches seront remplacées, et le remplacement sera journalisé.',
      'Remplacer','Annuler'); }catch(e){ ok=false; }
    if(!ok) return false;
  }
  const r=ouvrirEcheance(c,{date:ts,type:'COMPETITION'});
  if(!r.ok){ try{ toast(r.raison,'var(--orange)'); }catch(e){} return false; }
  // LA FICHE DU CLIENT OUVERT, REPEINTE. renderClientDetail n'a jamais existe
  // (trouve par le lint, 01/10/2026) : l'appel levait, avale par le catch, et
  // la fiche gardait l'ancienne echeance jusqu'a la synchro suivante.
  try{ if(currentClientId) openClientDetail(currentClientId,true); }catch(e){}
  try{
    const _envoi=CLOUD.pushOne(c.email,c);
    toastSync(true,_envoi,r.remplacee?'Échéance remplacée '+ICO.coche:'Échéance ouverte '+ICO.coche,'l’échéance');
  }catch(e){}
  return true;
}
// L'EDITEUR D'UNE JOURNEE. Trois champs, et le refus est PARLANT : les bornes
// disent ce qui est accepte et pourquoi, jamais « valeur invalide ».
function _echEditer(n){
  const u=_echCible||currentUser;
  const e=echeance(u);
  if(!e) return false;
  const f=e.fiches['j'+n]||{};
  const val=v=>v==null?'':String(v);
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:480px;max-height:86vh;overflow-y:auto">'
    +'<div style="font-size:var(--fs-md);font-weight:800;margin-bottom:4px">J-'+n+'</div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-bottom:12px">'
    +escapeHtml(ECH_PHRASE_CANEVAS)+'</div>'
    +'<div><label for="ech-glu" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal">Glucides (g)</label>'
    +'<input type="number" inputmode="numeric" id="ech-glu" value="'+val(f.cibleGlucides)+'" placeholder="-"></div>'
    +'<div><label for="ech-sel" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal">Sel (g)</label>'
    +'<input type="text" inputmode="decimal" autocomplete="off" data-dec id="ech-sel" value="'+val(f.cibleSodium)+'" placeholder="-"></div>'
    +'<div><label for="ech-eau" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal">Eau (L)</label>'
    +'<input type="text" inputmode="decimal" autocomplete="off" data-dec id="ech-eau" value="'+val(f.cibleEau)+'" placeholder="-"></div>'
    +'<div><label for="ech-seance" style="font-size:var(--fs-2xs);text-transform:none;letter-spacing:normal">Séance</label>'
    +'<input type="text" maxlength="60" id="ech-seance" value="'+escapeHtml(f.seance||'')+'" placeholder="Ex : dos léger, 30 min"></div>'
    +'<label class="hit44" style="font-size:var(--fs-xs);cursor:pointer;color:var(--sub);text-transform:none;letter-spacing:normal;font-weight:400;margin:10px 0;display:inline-flex;align-items:center;gap:6px">'
    +'<input type="checkbox" id="ech-poses" style="width:auto;margin:0"'+(f.poses?' checked':'')+'>Séance de poses</label>'
    +'<div id="ech-err" style="color:var(--red-light);font-size:var(--fs-xs);line-height:1.55;margin:6px 0;display:none"></div>'
    +'<button class="btn btn-red" style="width:100%;margin-top:6px" onclick="_echEnregistrer('+n+')">Enregistrer</button>'
    +'</div></div>');
  return true;
}
function _echEnregistrer(n){
  const u=_echCible||currentUser;
  const v=id=>{ const el=document.getElementById(id); return el?el.value:''; };
  const err=document.getElementById('ech-err');
  const r=poserFicheEcheance(u,n,{
    cibleGlucides:v('ech-glu'),cibleSodium:v('ech-sel'),cibleEau:v('ech-eau'),
    seance:v('ech-seance'),
    poses:!!(document.getElementById('ech-poses')||{}).checked});
  if(!r.ok){
    // LE REFUS S'AFFICHE, IL NE SE TOASTE PAS : le coach doit pouvoir le lire
    // en corrigeant son champ, pas le voir disparaitre en trois secondes.
    if(err){ err.textContent=r.raison||'Enregistrement refusé.'; err.style.display='block'; }
    return false;
  }
  try{ closeModal(); }catch(e){}
  try{ _renderEcheance(); }catch(e){}
  try{
    const _envoi=CLOUD.pushOne(u.email,u);
    toastSync(true,_envoi,'J-'+n+' enregistré '+ICO.coche,'cette journée');
  }catch(e){}
  return true;
}
// ══════════ L'ECRAN D'ECHEANCE ═════════════════════════════════════════
let _echCible=null;        // le dossier affiche : l'athlete, ou le client du coach
function ouvrirEcheanceEcran(user){
  _echCible=user||currentUser;
  go('s-echeance');
  _renderEcheance();
  return true;
}
function fermerEcheance(){
  const coach=!!(currentUser&&currentUser.role==='coach');
  _echCible=null;
  if(coach){ go('s-coach-client'); try{ if(currentClientId) openClientDetail(currentClientId,true); }catch(e){} }
  else { go('s-client-home'); try{ loadClientHome(); }catch(e){} }
  return true;
}
// PURE. La mention medicale ne s'affiche QU'UNE FOIS par echeance. Repetee a
// chaque ouverture, elle devient un bandeau qu'on ne lit plus — et c'est
// exactement ce qu'une mention de ce genre ne doit pas devenir.
function _echMentionAVoir(user){
  const e=echeance(user);
  return !!(e&&!e.vueLe);
}
function _echMarquerVue(user){
  const u=_dossier(user);
  if(u&&u.echeance&&!u.echeance.vueLe){ u.echeance.vueLe=Date.now();
    try{ saveUser(); }catch(e){ rcErreurMuette('_echMarquerVue',e); } }
  return true;
}
function _renderEcheance(){
  const z=document.getElementById('ech-contenu');
  if(!z) return false;
  const u=_echCible||currentUser;
  const e=echeance(u);
  const t=document.getElementById('ech-titre');
  if(!e){
    if(t) t.textContent='Échéance';
    z.innerHTML='<div class="sub" style="font-size:var(--fs-sm);line-height:1.6;padding:20px 0">'
      +'Aucune échéance active.</div>';
    return true;
  }
  const j=echeanceJour(u);
  const estCoach=!!(currentUser&&currentUser.role==='coach');
  if(t) t.textContent=({COMPETITION:'Compétition',SHOOTING:'Shooting',OBJECTIF:'Objectif'})[e.type]||'Échéance';
  let h='';
  // LA MENTION MEDICALE, UNE FOIS.
  if(_echMentionAVoir(u)){
    h+='<div style="background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--r-3);padding:12px 14px;margin:12px 0 14px;font-size:var(--fs-xs);color:var(--text);line-height:1.6">'
      +escapeHtml(ECH_PHRASE_MEDICALE)+'</div>';
    _echMarquerVue(u);
  }
  // LE COMPTE A REBOURS.
  h+='<div style="display:flex;align-items:baseline;gap:10px;margin:12px 0 6px">'
    +'<span style="font-family:Bebas Neue,Montserrat,sans-serif;font-size:var(--fs-3xl);color:var(--red-text);line-height:1">'
    +(j?(j.j>=0?('J-'+j.j):('J+'+(-j.j))):'-')+'</span>'
    +'<span style="font-size:var(--fs-sm);color:var(--sub)">'
    +dateLocaleDeCle(e.date).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'})
    +'</span></div>';
  if(e.federation||e.categorie)
    h+='<div style="font-size:var(--fs-xs);color:var(--text-faint);margin-bottom:12px">'
      +[e.federation,e.categorie].filter(Boolean).map(escapeHtml).join(' · ')+'</div>';
  // LA SORTIE, a J+1 — et c'est la fonction EXISTANTE.
  const sortie=echeancePropositionSortie(u);
  if(sortie){
    h+='<div class="card card--dense" style="margin-bottom:14px">'
      +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'+escapeHtml(sortie.phrase)+'</div>'
      +'<button class="btn btn-outline btn-sm" style="width:100%;margin-top:10px" onclick="echeanceOuvrirSortie()">Revenir au maintien</button></div>';
  }
  if(j&&j.phase==='AFFUTAGE'){
    // L'AFFUTAGE NE FAIT RIEN DE NEUF : il resserre ce qui existe. On le DIT,
    // plutot que d'afficher des cibles qui n'existent pas.
    h+='<div class="card card--dense" style="margin-bottom:14px">'
      +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">Affûtage</div>'
      +'<div style="font-size:var(--fs-sm);color:#ccc;line-height:1.6">'
      +'Rien de nouveau : tes macros suivent ta phase, ton sel reste à ta cible, '
      +'et le volume descend vers ton minimum efficace. '
      +(j.poses?'<b style="color:var(--text)">Séance de poses aujourd’hui.</b>':'Poses tous les deux jours.')
      +'</div></div>';
  }
  if(j&&j.phase==='PEAK'){
    h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-bottom:10px">'
      +escapeHtml(ECH_PHRASE_CANEVAS)+'</div>';
    h+=_echHtmlFiches(u,e,estCoach);
  }
  z.innerHTML=h;
  // LES EQUIVALENTS ARRIVENT APRES : Ciqual pese, et l'ecran ne l'attend pas.
  try{ _echPoserEquivalents(u,e); }catch(err){}
  return true;
}
// LES SEPT FICHES. Le coach saisit ; l'athlete lit.
function _echHtmlFiches(u,e,estCoach){
  let h='';
  for(let n=ECH_JOURS_PEAK;n>=0;n--){
    const f=e.fiches['j'+n]||null;
    const vide=!f||(f.cibleGlucides==null&&f.cibleSodium==null&&f.cibleEau==null);
    h+='<div class="card card--dense" style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">'
      +'<span style="font-size:var(--fs-sm);font-weight:800;color:var(--text)">J-'+n+'</span>'
      +(f&&f.poses?'<span style="font-size:var(--fs-2xs);color:var(--red-text)">poses</span>':'')
      +'</div>';
    if(vide){
      // UNE CIBLE NON POSEE N'EST PAS UN ZERO. On le dit, et on n'affiche
      // aucun chiffre — surtout pas un zero, qui serait une consigne.
      h+='<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px">'
        +(estCoach?'À remplir.':'Ton coach n’a pas encore posé cette journée.')+'</div>';
    } else {
      const l=[];
      if(f.cibleGlucides!=null) l.push('glucides '+Math.round(f.cibleGlucides)+' g');
      if(f.cibleSodium!=null) l.push('sel '+String(Math.round(f.cibleSodium*10)/10).replace('.',',')+' g');
      if(f.cibleEau!=null) l.push('eau '+String(f.cibleEau).replace('.',',')+' L');
      h+='<div style="font-size:var(--fs-xs);color:#ccc;margin-top:4px;line-height:1.6">'+l.join(' · ')+'</div>';
      if(f.seance) h+='<div style="font-size:var(--fs-2xs);color:var(--sub);margin-top:2px">'+escapeHtml(f.seance)+'</div>';
      if(f.cibleGlucides!=null)
        h+='<div class="ech-equiv" data-jour="'+n+'" style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:4px;line-height:1.5"></div>';
    }
    if(estCoach)
      h+='<button class="btn btn-outline btn-sm" style="width:100%;margin-top:8px" onclick="_echEditer('+n+')">'
        +(vide?'Poser cette journée':'Modifier')+'</button>';
    h+='</div>';
  }
  return h;
}
// LES EQUIVALENTS, POSES APRES COUP. Ciqual pese trois megaoctets : l'ecran
// s'affiche d'abord, les grammages arrivent ensuite.
async function _echPoserEquivalents(u,e){
  const zones=document.querySelectorAll('#ech-contenu .ech-equiv');
  for(const z of zones){
    const n=parseInt(z.getAttribute('data-jour'),10);
    const f=e.fiches['j'+n];
    if(!f||f.cibleGlucides==null) continue;
    let eq=[];
    try{ eq=await echeanceEquivalents(f.cibleGlucides); }catch(err){ eq=[]; }
    if(!eq.length) continue;
    z.textContent='≈ '+eq.map(x=>x.grammes+' g de '+x.lib).join(', ');
  }
  return true;
}
// ══════════ L'ECHEANCE ═════════════════════════════════════════════════
//
// ⚠ LE POINT DUR, ET IL COMMANDE TOUT LE RESTE : L'APPLICATION NE CALCULE
// AUCUN PROTOCOLE. Pas de manipulation de glucides, pas de charge en eau, pas
// de coupure de sodium. Trois raisons, et chacune suffirait :
//   1. il n'existe aucun consensus publiable sur ces manipulations ;
//   2. la litterature est mince, et ce qui existe porte sur des effectifs de
//      dix a vingt culturistes masculins ;
//   3. un protocole automatique sur des donnees de sante engage la
//      responsabilite de l'editeur, et le dossier juridique de l'audit d'aout
//      2026 est deja charge.
//
// LE CANEVAS EST DONC VIDE. RepCore affiche, rappelle et enregistre ce que le
// coach pose ; il ne l'invente pas. En revanche il FAIT ce qu'il sait faire :
// convertir une cible de glucides en grammes d'aliments avec Ciqual, une cible
// de sodium en grammes de sel avec le moteur sodique, et REFUSER ce qui sort
// des bornes de securite.
const ECH_PHRASE_CANEVAS='Les cibles de peak week sont posées par ton coach. '
  +'RepCore les affiche, les rappelle et les enregistre : il ne les invente pas.';
const ECH_PHRASE_MEDICALE='Une préparation se prépare avec un professionnel. '
  +'RepCore n\'est pas un dispositif médical et ne remplace ni un médecin, '
  +'ni un diététicien.';
const ECH_TYPES=Object.freeze(['COMPETITION','SHOOTING','OBJECTIF']);
const ECH_JOURS_TOTAL=16;          // J-16 : l'echeance s'ouvre
const ECH_JOURS_PEAK=7;            // J-7 : la peak week commence
const ECH_POSES_TOUS_LES=2;        // une session de poses tous les deux jours

// ══════════ LES BORNES DURES ═══════════════════════════════════════════
//
// ELLES REFUSENT L'ENREGISTREMENT, elles n'avertissent pas. Un avertissement
// qu'on peut ignorer d'un clic n'est pas un garde-fou : c'est une case a
// cocher avant de faire ce qu'on avait decide de faire.
//
// LE PLANCHER HYDRIQUE N'A PAS DE CONTREPARTIE HAUTE NEGOCIABLE. Le « water
// cut » — la restriction hydrique des dernieres heures — ne sera pas outille
// par RepCore. C'est la manipulation qui envoie des gens a l'hopital, et
// l'outiller reviendrait a la recommander.
const ECH_EAU_MAX_L=6;
const ECH_EAU_MIN_L=1.5;
const ECH_SEL_MAX_G=8;
const ECH_GLUCIDES_MAX_G_KG=12;

// PURE. Verifie une fiche de jour. Rend [] quand tout passe, sinon la liste
// des refus EN CLAIR — « hors bornes » n'apprend rien a personne.
function echeanceRefus(fiche,poidsKg){
  const out=[];
  const f=fiche||{};
  const eau=Number(f.cibleEau);
  const sel=Number(f.cibleSodium);
  const glu=Number(f.cibleGlucides);
  if(isFinite(eau)&&eau>0){
    if(eau>ECH_EAU_MAX_L)
      out.push('Eau : '+eau+' L par jour. Le maximum accepté est '+ECH_EAU_MAX_L
        +' L : au-delà, le risque d\'hyponatrémie devient réel.');
    if(eau<ECH_EAU_MIN_L)
      out.push('Eau : '+eau+' L par jour. RepCore n\'enregistre pas de cible '
        +'sous '+String(ECH_EAU_MIN_L).replace('.',',')+' L. La restriction hydrique '
        +'ne sera pas outillée ici.');
  }
  if(isFinite(sel)&&sel>ECH_SEL_MAX_G)
    out.push('Sel : '+sel+' g par jour. Le maximum accepté est '+ECH_SEL_MAX_G+' g.');
  if(isFinite(glu)&&glu>0){
    // ⚠ SANS POIDS, ON REFUSE — ON NE LAISSE PAS PASSER. La borne se mesurait
    // « si le poids est connu », et disparaissait donc en silence pour un
    // dossier sans pesee : 1 200 g de glucides passaient sans un mot. Un
    // garde-fou qui s'efface quand une donnee manque n'est pas un garde-fou,
    // c'est une case a cocher. Mesure faite sur un dossier sans pesee.
    if(!(Number(poidsKg)>0)){
      out.push('Impossible de vérifier cette cible de glucides : aucun poids '
        +'récent pour cet athlète. Enregistre une pesée, puis repose la cible.');
    } else {
      const parKg=glu/Number(poidsKg);
      if(parKg>ECH_GLUCIDES_MAX_G_KG)
        out.push('Glucides : '+Math.round(parKg*10)/10+' g par kilo. Le maximum '
          +'accepté est '+ECH_GLUCIDES_MAX_G_KG+' g/kg, soit '
          +Math.round(ECH_GLUCIDES_MAX_G_KG*Number(poidsKg))+' g pour cet athlète.');
    }
  }
  return out;
}
// PURE. L'echeance active, ou null. UNE SEULE A LA FOIS.
function echeance(user){
  const u=_dossier(user);
  const e=u&&u.echeance;
  if(!e||typeof e!=='object') return null;
  // UNE CLÉ « AAAA-MM-JJ » EST ACCEPTÉE (02/10/2026), lue à midi LOCAL
  // (dateLocaleDeCle) : la compétition du 3 octobre est un samedi partout.
  const d=Number(e.date)||(/^\d{4}-\d{2}-\d{2}$/.test(String(e.date))?dateLocaleDeCle(e.date).getTime():0);
  if(!(d>0)) return null;
  return {date:d,type:ECH_TYPES.indexOf(e.type)>=0?e.type:'OBJECTIF',
    federation:e.federation||null,categorie:e.categorie||null,
    poidsCible:(Number(e.poidsCible)>0)?Number(e.poidsCible):null,
    fiches:(e.fiches&&typeof e.fiches==='object')?e.fiches:{},
    journal:_tabBloc(e.journal),vueLe:Number(e.vueLe)||0};
}
// PURE. Le compte a rebours. Rend null hors fenetre.
//
// DEUX PHASES, PAS UNE. L'affutage ne fait RIEN DE NEUF : il resserre ce qui
// existe deja — les macros suivent la phase en cours, le sodium reste a la
// cible du moteur, le volume descend vers le MEV. La peak week, elle, porte
// des cibles quotidiennes, et elles viennent du coach.
function echeanceJour(user,maintenant){
  const e=echeance(user);
  if(!e) return null;
  const t=Number(maintenant)||Date.now();
  const j0=_dateDeISO(localISODate(new Date(e.date))).getTime();
  const aujourd=_dateDeISO(localISODate(new Date(t))).getTime();
  const j=Math.round((j0-aujourd)/86400000);        // J-n : positif avant
  if(j>ECH_JOURS_TOTAL) return null;                 // pas encore ouverte
  return {j:j,
    phase:j<0?'APRES':(j<=ECH_JOURS_PEAK?'PEAK':'AFFUTAGE'),
    // POSES TOUS LES DEUX JOURS pendant l'affutage, TOUS LES JOURS en peak
    // week : la frise de sept jours cote a cote est le vrai livrable.
    poses:(j<0)?false:(j<=ECH_JOURS_PEAK?true:(j%ECH_POSES_TOUS_LES===0)),
    fiche:(j>=0&&j<=ECH_JOURS_PEAK)?(e.fiches['j'+j]||null):null,
    echeance:e};
}
// L'OUVERTURE D'UNE ECHEANCE. Rend {ok} ou {ok:false,raison}.
//
// UNE DEUXIEME NE SE SUPERPOSE PAS : elle REMPLACE, et le remplacement est
// confirme par l'appelant puis journalise. Deux echeances actives, ce sont
// deux comptes a rebours et deux jeux de cibles pour le meme jour.
function ouvrirEcheance(user,o){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun athlète ouvert.'};
  const d=Number(o&&o.date)||0;
  if(!(d>0)) return {ok:false,raison:'Donne une date d’échéance.'};
  const type=(o&&ECH_TYPES.indexOf(o.type)>=0)?o.type:'OBJECTIF';
  // LE GARDE-FOU TCA S'APPLIQUE INTEGRALEMENT. Une echeance avec un poids
  // cible EST un objectif de perte : c'est le meme refus, la meme doctrine,
  // et surtout la meme porte d'entree — refusObjectifPerte couvre deja la
  // grossesse, le TCA declare et le depistage SCOFF positif.
  if(Number(o&&o.poidsCible)>0){
    let refus=null;
    try{ refus=refusObjectifPerte(u); }catch(e){ refus=null; }
    if(refus) return {ok:false,raison:refus};
  }
  const ancienne=echeance(u);
  u.echeance={date:d,type:type,
    federation:(o&&o.federation)||null,categorie:(o&&o.categorie)||null,
    poidsCible:(Number(o&&o.poidsCible)>0)?Number(o.poidsCible):null,
    fiches:{},journal:[],vueLe:0};
  // JOURNALISE, comme les ajustements nutrition. Une echeance remplacee est
  // une decision : elle doit laisser une trace lisible.
  try{
    _pauseJournaliser(u,ancienne?'echeance_remplacee':'echeance_ouverte',
      {type:type,date:d,
       ...(ancienne?{ancienneDate:ancienne.date,ancienType:ancienne.type}:{})});
  }catch(e){}
  try{ saveUser(); }catch(e){ rcErreurMuette('ouvrirEcheance',e); }
  return {ok:true,remplacee:!!ancienne};
}
// L'ECRITURE D'UNE FICHE DE JOUR. Les bornes refusent, elles n'avertissent pas.
function poserFicheEcheance(user,j,fiche){
  const u=_dossier(user);
  const e=echeance(u);
  if(!e) return {ok:false,raison:'Aucune échéance active.'};
  const n=Math.round(Number(j));
  if(!(n>=0&&n<=ECH_JOURS_PEAK))
    return {ok:false,raison:'Les fiches ne couvrent que J-'+ECH_JOURS_PEAK+' à J-0.'};
  let poids=null;
  try{ poids=_sodiumAthleteDe(u).weightKg; }catch(e2){ poids=null; }
  const refus=echeanceRefus(fiche,poids);
  if(refus.length) return {ok:false,raison:refus.join(' '),refus:refus};
  if(!u.echeance.fiches||typeof u.echeance.fiches!=='object') u.echeance.fiches={};
  const f=fiche||{};
  u.echeance.fiches['j'+n]={jour:n,
    cibleGlucides:_echNombreOuNull(f.cibleGlucides),
    cibleSodium:_echNombreOuNull(f.cibleSodium),
    cibleEau:_echNombreOuNull(f.cibleEau),
    seance:String(f.seance||''),poses:!!f.poses,
    gestes:_tabBloc(f.gestes).map(x=>String(x)).slice(0,8),
    maj:Date.now()};
  try{ saveUser(); }catch(e2){}
  return {ok:true,fiche:u.echeance.fiches['j'+n]};
}
// PURE. UNE CIBLE NON POSEE RESTE null, JAMAIS ZERO. « 0 g de glucides » est
// une consigne ; « pas encore posé » n'en est pas une, et les confondre ferait
// afficher un protocole que personne n'a ecrit.
function _echNombreOuNull(v){
  if(v===''||v==null) return null;
  const n=Number(v);
  return isFinite(n)&&n>=0?n:null;
}
// ══════════ CE QUE L'APPLICATION SAIT FAIRE ════════════════════════════
//
// ELLE NE POSE AUCUNE CIBLE, ELLE LES TRADUIT. « 380 g de glucides » ne dit
// pas quoi mettre dans l'assiette ; « 480 g de riz cuit » si. La conversion
// n'invente rien : elle lit Ciqual, qui est une table de composition, pas une
// recommandation.
//
// TROIS ALIMENTS DE REFERENCE, PAS QUINZE. Une liste longue redevient un choix
// a faire, et ce n'est pas le moment.
// ⚠ LE NOM EXACT, PAS UNE EXPRESSION APPROXIMATIVE. Ciqual compte 3 484
// entrees et la premiere qui matche gagne : /^p[âa]tes.*cuites/ attrapait
// « Pâtes fraîches farcies au fromage, cuites » — des raviolis — comme
// reference de « pâtes cuites ». Mesure faite sur la table reelle.
const ECH_ALIMENTS_REF=Object.freeze([
  {cle:'riz',   nom:'Riz blanc, cuit, sans sel ajouté',        lib:'riz blanc cuit'},
  {cle:'patate',nom:"Pomme de terre, bouillie/cuite à l'eau", lib:"pomme de terre à l'eau"},
  {cle:'pates', nom:'Pâtes sèches, standard, cuites, sans sel ajouté',lib:'pâtes cuites'}
]);
// Rend [{lib, grammes}] pour une cible de glucides, ou [] si Ciqual n'est pas
// chargee. ASYNCHRONE : la table pese, et l'ecran s'affiche sans l'attendre.
async function echeanceEquivalents(cibleG){
  const g=Number(cibleG);
  if(!(g>0)) return [];
  let db=[];
  try{ db=await _loadCiqual(); }catch(e){ db=[]; }
  if(!Array.isArray(db)||!db.length) return [];
  const out=[];
  for(const a of ECH_ALIMENTS_REF){
    const f=db.find(x=>x&&x.n===a.nom&&Number(x.c)>0);
    // L'ENTREE A DISPARU DE LA TABLE : on saute, on ne retombe pas sur un
    // « a peu pres ». Une equivalence approximative en peak week vaut moins
    // que pas d'equivalence du tout.
    if(!f) continue;
    // c : glucides pour 100 g. La regle de trois, et rien d'autre.
    out.push({lib:a.lib,grammes:Math.round(g*100/Number(f.c))});
  }
  return out;
}
// PURE. La cible de sodium en grammes de SEL — le moteur sodique existant fait
// la conversion, on ne la refait pas ici.
function echeanceSelDeSodium(sodiumMg){
  const mg=Number(sodiumMg);
  if(!(mg>0)) return null;
  return Math.round(sodiumMgToSaltG(mg)*10)/10;
}
// PURE. LA LIGNE D'ACCUEIL. Une seule, et rien d'autre ne change dans l'app :
// une preparation ne doit pas repeindre l'interface.
function ligneEcheance(user,maintenant){
  const j=echeanceJour(user,maintenant);
  if(!j||j.j<0) return '';
  const p=[];
  p.push('J-'+j.j);
  const f=j.fiche;
  if(f){
    if(f.cibleGlucides!=null) p.push('glucides '+Math.round(f.cibleGlucides)+' g');
    if(f.cibleSodium!=null) p.push('sel '+String(Math.round(f.cibleSodium*10)/10).replace('.',',')+' g');
    if(f.cibleEau!=null) p.push('eau '+String(f.cibleEau).replace('.',',')+' L');
  }
  if(j.poses) p.push('poses ce soir');
  return p.join(' · ');
}
// L'APRES. J+1 : on propose la sortie, ET LA SORTIE EXISTE DEJA.
//
// ⚠ ON BRANCHE ouvrirTransitionMaintien, ON N'EN ECRIT PAS UNE SECONDE. Deux
// mecaniques de retour au maintien finiraient par ne plus dire la meme chose
// du meme athlete, et c'est exactement le defaut que ce fichier passe son
// temps a eviter.
function echeancePropositionSortie(user,maintenant){
  const j=echeanceJour(user,maintenant);
  if(!j||j.j>=0) return null;
  // Un seul jour apres : au-dela, la personne est passee a autre chose et la
  // proposition devient un rappel de ce qui est fini.
  if(j.j<-3) return null;
  return {jours:-j.j,
    phrase:'Ton échéance est passée. On remonte progressivement vers ton '
      +'maintien plutôt que d’y revenir d’un coup.'};
}
function echeanceOuvrirSortie(){
  // AUCUN DOUBLON : c'est la fonction existante, appelee telle quelle.
  try{ return ouvrirTransitionMaintien(); }catch(e){ return false; }
}
// ══════════ LA CHARGE INTERNE ══════════════════════════════════════════
//
// LE TONNAGE NE DIT PAS TOUT, ET IL NE DISPARAIT PAS POUR AUTANT. Deux cents
// tonnes deplacees en quarante minutes et les memes en quatre-vingts ne
// coutent pas la meme chose ; inversement, une seance legere mais interminable
// pese. Les deux mesures disent des choses differentes, et l'athlete connait
// deja le tonnage : on ajoute, on ne remplace pas.
//
// UNE SEULE QUESTION, ET ELLE EST FACULTATIVE. Une seance sans note reste une
// seance valide — la friction en fin de seance est ce qui tue une collecte.
//
// EN MOTS, PAS EN CHIFFRES. Un athlete ne note pas sa seance sur dix, il la
// qualifie. « Soutenue » se repond sans reflechir ; « 6 sur 10 » demande une
// conversion mentale que personne ne fait deux fois pareil.
const SRPE_ECHELLE=Object.freeze([
  {cle:'tres_facile',lib:'Très facile',v:2},
  {cle:'facile',     lib:'Facile',     v:4},
  {cle:'soutenue',   lib:'Soutenue',   v:6},
  {cle:'dure',       lib:'Dure',       v:8},
  {cle:'maximale',   lib:'Maximale',   v:10}
]);
const CHARGE_AIGU_JOURS=7;
const CHARGE_CHRONIQUE_JOURS=28;
const CHARGE_SEMAINES_MIN=3;        // sous trois semaines, aucun ratio
const CHARGE_COUVERTURE_MIN=2/3;    // deux seances notees sur trois, au moins
const CHARGE_RATIO_SEUIL=1.5;
const CHARGE_SAUT_SEMAINES=2;       // deux semaines de suite, pas une

// PURE. La valeur interne d'une note, ou null.
function _srpeValeur(cle){
  const e=SRPE_ECHELLE.find(x=>x.cle===cle);
  return e?e.v:null;
}
// PURE. LA CHARGE D'UNE SEANCE — RECALCULEE, JAMAIS STOCKEE.
//
// ON STOCKE LA NOTE ET LA DUREE, PAS LE PRODUIT. Un produit fige ne se
// recalcule pas quand on corrige la duree : la seance de 90 minutes saisie a
// 9 minutes garderait sa charge fausse pour toujours, et le ratio avec elle.
function chargeSeance(sess){
  if(!sess) return null;
  const v=_srpeValeur(sess.srpe);
  const d=Number(sess.duration);
  if(v==null||!isFinite(d)||!(d>0)) return null;
  return v*d;
}
// PURE. Les seances d'une fenetre, avec leur charge quand elle existe.
function _chargesFenetre(user,jours,maintenant){
  const u=_dossier(user);
  const fin=Number(maintenant)||Date.now();
  const debut=fin-jours*86400000;
  const out=[];
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!s.date) continue;
    if(!(s.date>debut&&s.date<=fin)) continue;
    out.push({date:s.date,charge:chargeSeance(s)});
  }
  return out;
}
// PURE. La somme des charges sur sept jours glissants. Rend null quand aucune
// seance notee : zero se lirait comme « aucune charge », pas comme « on ne
// sait pas ».
function chargeAigue(user,maintenant){
  const l=_chargesFenetre(user,CHARGE_AIGU_JOURS,maintenant).filter(x=>x.charge!=null);
  if(!l.length) return null;
  return Math.round(l.reduce((s,x)=>s+x.charge,0));
}
// PURE. La moyenne HEBDOMADAIRE sur vingt-huit jours — pas la somme : les deux
// termes du ratio doivent etre dans la meme unite, sans quoi il vaudrait
// systematiquement un quart de ce qu'il devrait.
function chargeChronique(user,maintenant){
  const l=_chargesFenetre(user,CHARGE_CHRONIQUE_JOURS,maintenant).filter(x=>x.charge!=null);
  if(!l.length) return null;
  return Math.round(l.reduce((s,x)=>s+x.charge,0)/(CHARGE_CHRONIQUE_JOURS/7));
}
// PURE. LA COUVERTURE : part des seances de la fenetre qui portent une note.
function couvertureCharge(user,maintenant){
  const l=_chargesFenetre(user,CHARGE_CHRONIQUE_JOURS,maintenant);
  if(!l.length) return null;
  return l.filter(x=>x.charge!=null).length/l.length;
}
// PURE. LE RATIO AIGU/CHRONIQUE, ou null.
//
// UN RATIO CALCULE SUR DES TROUS EST UN CHIFFRE FAUX QUI A L'AIR JUSTE. Deux
// gardes, et aucune n'est negociable : trois semaines d'historique au moins,
// et deux seances notees sur trois au moins. En dessous, on ne rend rien —
// pas une valeur prudente, RIEN.
function ratioCharge(user,maintenant){
  const u=_dossier(user);
  const fin=Number(maintenant)||Date.now();
  // Trois semaines d'historique : mesurees sur la PREMIERE seance connue, pas
  // sur la date d'inscription — quelqu'un qui s'inscrit et ne s'entraine pas
  // pendant un mois n'a pas trois semaines d'historique.
  let plusAncienne=null;
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!s.date) continue;
    if(plusAncienne===null||s.date<plusAncienne) plusAncienne=s.date;
  }
  if(plusAncienne===null) return null;
  if((fin-plusAncienne)<CHARGE_SEMAINES_MIN*7*86400000) return null;
  const cv=couvertureCharge(u,fin);
  if(cv==null||cv<CHARGE_COUVERTURE_MIN) return null;
  const a=chargeAigue(u,fin), c=chargeChronique(u,fin);
  if(a==null||c==null||!(c>0)) return null;
  return Math.round(a/c*100)/100;
}
// PURE. Le ratio d'il y a `n` semaines — sert au signal, qui exige deux
// semaines de suite.
function _ratioIlYA(user,n,maintenant){
  const t=(Number(maintenant)||Date.now())-n*7*86400000;
  return ratioCharge(user,t);
}
// PURE. LE SAUT DE CHARGE. Vrai quand le ratio depasse le seuil DEUX semaines
// de suite.
//
// AUCUN SEUIL BAS SYMETRIQUE. Une semaine legere est deja couverte par les
// decharges programmees, et un second signal pour la meme chose ferait du
// bruit — le coach cesserait de lire les deux.
function sautDeCharge(user,maintenant){
  const a=ratioCharge(user,maintenant);
  if(a==null||!(a>CHARGE_RATIO_SEUIL)) return null;
  for(let n=1;n<CHARGE_SAUT_SEMAINES;n++){
    const b=_ratioIlYA(user,n,maintenant);
    if(b==null||!(b>CHARGE_RATIO_SEUIL)) return null;
  }
  return {ratio:a,seuil:CHARGE_RATIO_SEUIL,
    aigue:chargeAigue(user,maintenant),chronique:chargeChronique(user,maintenant)};
}
// L'ENCART DE FIN DE SEANCE. Une seule question, cinq boutons, et une sortie.
//
// « IGNORABLE EN UN GESTE » N'EST PAS UNE FORMULE : la croix est aussi grande
// que les boutons de reponse. Une sortie difficile a viser transforme une
// question facultative en peage, et l'athlete finit par repondre n'importe
// quoi pour faire disparaitre l'encart — ce qui detruit la mesure qu'on
// cherchait a prendre.
function rcRendreSrpe(){
  const z=document.getElementById('wd-srpe-zone');
  if(!z) return false;
  z.style.display='none'; z.innerHTML='';
  const u=currentUser;
  const s=(u&&Array.isArray(u.sessions)&&u.sessions.length)?u.sessions[u.sessions.length-1]:null;
  // DEJA NOTEE, OU SANS DUREE : rien a demander. Une seance sans duree ne
  // produirait aucune charge, et la question serait posee pour rien.
  if(!s||s.srpe||!(Number(s.duration)>0)) return false;
  z.innerHTML='<div class="card card--dense">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">'
    +'<span style="font-size:var(--fs-sm);color:var(--text);font-weight:700">Cette séance, c’était comment ?</span>'
    +'<button type="button" aria-label="Passer" onclick="rcPasserSrpe()" '
    +'style="background:none;border:none;color:rgba(255,255,255,.45);font-size:var(--fs-lg);line-height:1;'
    +'cursor:pointer;min-width:40px;min-height:40px;padding:8px;flex-shrink:0">'+icon('croix',14)+'</button></div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
    +SRPE_ECHELLE.map(e=>'<button type="button" class="btn btn-outline btn-sm" '
      +'style="flex:1 1 auto;min-width:0;padding:10px 6px;font-size:var(--fs-xs)" '
      +'onclick="rcNoterSeance('+JSON.stringify(e.cle).replace(/"/g,'&quot;')+')">'
      +escapeHtml(e.lib)+'</button>').join('')
    +'</div></div>';
  z.style.display='block';
  return true;
}
function rcPasserSrpe(){
  const z=document.getElementById('wd-srpe-zone');
  if(z){ z.style.display='none'; z.innerHTML=''; }
  // AUCUNE TRACE D'UN REFUS. On ne compte pas les fois ou quelqu'un n'a pas
  // repondu : la seance reste valide, et la couverture s'en charge deja.
  return true;
}
function rcNoterSeance(cle){
  const u=currentUser;
  let r=null;
  try{ r=noterSeance(u,cle); }catch(e){ r=null; }
  const z=document.getElementById('wd-srpe-zone');
  if(z){ z.style.display='none'; z.innerHTML=''; }
  if(!r||!r.ok) return false;
  try{ direSiEnvoiEchoue(CLOUD.pushOne(u.email,u),
    'Ta note de séance','ton coach ne la verra pas encore'); }catch(e){}
  try{ toast('Noté '+ICO.coche); }catch(e){}
  return true;
}
// L'ECRITURE DE LA NOTE. Elle porte sur la DERNIERE seance enregistree.
function noterSeance(user,cle){
  const u=_dossier(user);
  if(!u||!Array.isArray(u.sessions)||!u.sessions.length) return {ok:false};
  if(_srpeValeur(cle)==null) return {ok:false,raison:'Note inconnue.'};
  const s=u.sessions[u.sessions.length-1];
  s.srpe=cle;
  saveUserOuDire('Ton ressenti de séance');
  try{ _viderCacheSignaux(); }catch(e){}
  return {ok:true,charge:chargeSeance(s)};
}
// ══════════ LE RENDEMENT D'UN EXERCICE ═════════════════════════════════
//
// TROIS TERMES, TOUS TIRES DE DONNEES DEJA COLLECTEES. Chaque serie porte
// {weight, reps, rir, pain} depuis toujours, le journal des ecarts existe, les
// creneaux disent ce qui etait prevu. Rien de neuf n'est demande a personne :
// ce qui manquait, c'etait de les lire ensemble.
//
// ON REND L'OBJET, JAMAIS LE SEUL NOMBRE. « 0,42 » ne dit pas au coach lequel
// des trois termes decroche, et c'est exactement ce qu'il doit savoir : un
// exercice qui ne progresse plus ne se traite pas comme un exercice qu'on ne
// fait jamais, ni comme un exercice qui fait mal.
//
// SOUS SIX SEANCES, LE SCORE EST null ET NE S'AFFICHE PAS. Une pente calculee
// sur trois points n'est pas une pente, c'est un dessin. L'absence de mesure
// est une information — l'ecran la montre, sans chiffre.
const REND_SEMAINES=6;
const REND_SEANCES_MIN=6;
// Deux repetitions sous la consigne : le cout de RIR sature. Au-dela, ce n'est
// plus un ecart, c'est une autre seance.
const REND_RIR_SATURE=2;

// PURE. La pente d'une droite des moindres carres, en unites de y par unite de
// x. Rend null sous deux points distincts : une pente a besoin de deux abscisses.
function _rendPente(pts){
  const l=(pts||[]).filter(p=>p&&isFinite(p.x)&&isFinite(p.y));
  if(l.length<2) return null;
  const n=l.length;
  const mx=l.reduce((s,p)=>s+p.x,0)/n, my=l.reduce((s,p)=>s+p.y,0)/n;
  let num=0, den=0;
  for(const p of l){ num+=(p.x-mx)*(p.y-my); den+=(p.x-mx)*(p.x-mx); }
  if(!(den>0)) return null;          // toutes les seances le meme jour
  return num/den;
}
// PURE. Les points (semaine, e1RM) d'un exercice sur la fenetre.
//
// UN POINT PAR SEANCE, ET C'EST LE MEILLEUR e1RM DE LA SEANCE. La moyenne
// diluerait la serie lourde dans les series de rappel ; le maximum est ce que
// l'athlete a demontre ce jour-la.
//
// LE RIR EST CORRIGE : c'est une lecture de decision. Deux athletes qui
// declarent « RIR 2 » ne sont pas au meme endroit — voir le calibrage.
function _rendPoints(user,nom,maintenant){
  const u=_dossier(user);
  const k=exKey(nom);
  const fin=Number(maintenant)||Date.now();
  const debut=fin-REND_SEMAINES*7*86400000;
  const pts=[];
  for(const sess of ((u&&u.sessions)||[])){
    if(!sess||!sess.data||!sess.date) continue;
    if(!(sess.date>=debut&&sess.date<=fin)) continue;
    // Les seances de decharge sortent : elles prescrivent moins, et leur
    // e1RM plus bas se lirait comme une regression.
    if(sess.deload) continue;
    let best=0;
    for(const n2 of Object.keys(sess.data)){
      if(exKey(n2)!==k) continue;
      for(const s of (((sess.data[n2]||{}).sets)||[])){
        if(!s||s.done!==true) continue;
        const w=parseFloat(s.weight), r=_perfReps(s);
        if(!(w>0)||!(r>0)||!e1rmFiable(r,_perfRir(s,u))) continue;
        const v=e1rm(w,r,_perfRir(s,u));
        if(v>best) best=v;
      }
    }
    if(best>0) pts.push({x:(sess.date-debut)/604800000,y:best,date:sess.date});
  }
  pts.sort((a,b)=>a.x-b.x);
  return pts;
}
// PURE. LE COUT. Deux composantes, toutes deux ramenees sur 0..1.
//
// LA DOULEUR SE COMPTE EN PART DE SERIES, pas en nombre : dix series
// douloureuses sur dix n'est pas la meme chose que dix sur cent.
//
// L'ECART DE RIR NE COMPTE QUE DANS UN SENS. Finir plus LOIN de l'echec que
// prescrit ne coute rien — c'est une seance facile. Finir plus PRES coute :
// l'athlete a puise davantage que ce que le programme prevoyait, et ce
// supplement n'apparait nulle part ailleurs.
function _rendCout(user,nom,maintenant){
  const u=_dossier(user);
  const k=exKey(nom);
  const fin=Number(maintenant)||Date.now();
  const debut=fin-REND_SEMAINES*7*86400000;
  // La consigne : celle figee au moment de la seance d'abord, le gabarit
  // ensuite — meme regle que partout ailleurs.
  const pres={};
  try{
    for(const s of (Array.isArray(u.sessions_config)?u.sessions_config:[])){
      if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
      for(const ex of s.exercises){
        const r=_rirPrescrit(ex);
        if(r==='') continue;
        const kk=exKey((ex&&ex.name)||'');
        if(kk&&pres[kk]==null) pres[kk]=Number(r);
      }
    }
  }catch(e){}
  let series=0, douloureuses=0, ecart=0, nEcart=0;
  for(const sess of ((u&&u.sessions)||[])){
    if(!sess||!sess.data||!sess.date) continue;
    if(!(sess.date>=debut&&sess.date<=fin)) continue;
    const fige=(sess.rirPlanned&&typeof sess.rirPlanned==='object')?sess.rirPlanned:null;
    for(const n2 of Object.keys(sess.data)){
      if(exKey(n2)!==k) continue;
      const cons=(fige&&fige[n2]!=null)?Number(fige[n2]):pres[k];
      for(const s of (((sess.data[n2]||{}).sets)||[])){
        if(!s||s.done!==true) continue;
        series++;
        const p=parseInt(s&&s.pain,10);
        if(isFinite(p)&&p>0) douloureuses++;
        if(cons==null||!isFinite(cons)) continue;
        if(s.rir===''||s.rir==null) continue;
        const brut=(s.rir==='echec')?0:(parseInt(s.rir,10)||0);
        let v=brut; try{ v=rirCorrige(u,brut); }catch(e){ v=brut; }
        const d=cons-v;                       // positif : plus pres de l'echec
        if(d>0){ ecart+=d; }
        nEcart++;
      }
    }
  }
  if(!series) return null;
  const partDouleur=douloureuses/series;
  const partRir=nEcart?Math.min(1,(ecart/nEcart)/REND_RIR_SATURE):0;
  // MOITIE-MOITIE. La douleur et le sur-effort coutent autant l'une que
  // l'autre : privilegier l'une reviendrait a decider a la place du coach
  // laquelle des deux compte, et rien dans la donnee ne le dit.
  return {valeur:Math.min(1,partDouleur*0.5+partRir*0.5),
    partDouleur:Math.round(partDouleur*1000)/1000,
    partRir:Math.round(partRir*1000)/1000,series:series};
}
// PURE. LA REGULARITE. Part des occasions prevues ou l'exercice a ete
// REELLEMENT fait — croisee avec le journal des ecarts.
//
// UN EXERCICE REMPLACE UNE FOIS SUR TROIS EST UN EXERCICE QUI NE REND RIEN,
// quelle que soit sa pente. Sans ce croisement, un mouvement qu'on evite parce
// que la machine est toujours prise afficherait une belle progression sur les
// rares fois ou il est fait, et le coach le garderait.
function _rendRegularite(user,nom,maintenant){
  const u=_dossier(user);
  const k=exKey(nom);
  const fin=Number(maintenant)||Date.now();
  const debut=fin-REND_SEMAINES*7*86400000;
  // Combien de creneaux ACTIFS le portent ? C'est le rythme prevu.
  let parSemaine=0;
  try{
    for(const s of (Array.isArray(u.sessions_config)?u.sessions_config:[])){
      if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
      if(s.exercises.some(ex=>ex&&exKey(ex.name||'')===k)) parSemaine++;
    }
  }catch(e){}
  // Fait combien de fois ?
  let faites=0;
  for(const sess of ((u&&u.sessions)||[])){
    if(!sess||!sess.data||!sess.date) continue;
    if(!(sess.date>=debut&&sess.date<=fin)) continue;
    if(Object.keys(sess.data).some(n2=>exKey(n2)===k)) faites++;
  }
  // Remplace combien de fois ? Le journal des ecarts le dit, et c'est la
  // seule trace : woState.substitutions meurt avec la seance.
  let remplace=0;
  try{
    for(const e of _tabBloc(u&&u.ecartsSeance)){
      if(!e||!e.date||e.date<debut||e.date>fin) continue;
      if(exKey(e.exoPrevu||'')===k) remplace++;
    }
  }catch(e){}
  const prevues=parSemaine*REND_SEMAINES;
  // AUCUN CRENEAU NE LE PORTE : il n'etait pas prevu, on ne peut pas parler
  // de regularite. null, et le terme sort du calcul plutot que de valoir 1.
  if(!(prevues>0)) return null;
  // Les occasions manquees comprennent les remplacements : l'exercice etait
  // prevu, il n'a pas ete fait.
  const honorees=Math.max(0,Math.min(prevues,faites));
  return {valeur:Math.max(0,Math.min(1,(honorees-Math.min(remplace,honorees))/prevues)),
    prevues:prevues,faites:faites,remplace:remplace};
}
// PURE. LE RENDEMENT. Rend TOUJOURS l'objet complet, jamais un scalaire.
function rendementExercice(user,nom,maintenant){
  const u=_dossier(user);
  const pts=_rendPoints(u,nom,maintenant);
  const n=pts.length;
  const vide={nom:nom,n:n,progression:null,cout:null,regularite:null,
    rendement:null,raison:n<REND_SEANCES_MIN?'pas assez de séances':null};
  // SOUS SIX SEANCES : PAS DE SCORE. Une pente sur trois points est un dessin.
  if(n<REND_SEANCES_MIN) return vide;
  const pente=_rendPente(pts);
  const base=pts[0].y;
  // PENTE NORMALISEE PAR LE e1RM INITIAL : +2 kg par semaine ne veut pas dire
  // la meme chose a 60 kg qu'a 200. On compare l'athlete a lui-meme.
  const progression=(pente==null||!(base>0))?null:Math.round(pente/base*1000)/1000;
  const c=_rendCout(u,nom,maintenant);
  const r=_rendRegularite(u,nom,maintenant);
  if(progression==null||!c) return Object.assign({},vide,{raison:'mesure impossible'});
  // LA REGULARITE PONDERE, elle ne s'additionne pas : un exercice fait une
  // fois sur trois ne rend pas « un peu moins », il rend le tiers.
  // Absente — aucun creneau ne le porte — elle vaut 1 : on ne punit pas un
  // exercice de ce qu'on ne lui a jamais demande.
  const reg=r?r.valeur:1;
  const rendement=Math.round((progression-c.valeur)*reg*1000)/1000;
  return {nom:nom,n:n,progression:progression,cout:Math.round(c.valeur*1000)/1000,
    regularite:Math.round(reg*1000)/1000,rendement:rendement,raison:null,
    detail:{douleur:c.partDouleur,rir:c.partRir,series:c.series,
      prevues:r?r.prevues:null,faites:r?r.faites:null,remplace:r?r.remplace:null}};
}
// PURE. Tous les exercices des creneaux actifs, du meilleur rendement au pire.
// Ceux sans score ferment la liste : ils n'ont rien a dire, mais leur absence
// de mesure EST une information et doit rester visible.
function rendementsBloc(user,maintenant){
  const u=_dossier(user);
  const vus={}, out=[];
  try{
    for(const s of (Array.isArray(u.sessions_config)?u.sessions_config:[])){
      if(!s||s.active!==true||!Array.isArray(s.exercises)) continue;
      for(const ex of s.exercises){
        if(!ex||!ex.name) continue;
        try{ if(isCardio(ex)) continue; }catch(e){}
        const k=exKey(ex.name);
        if(!k||vus[k]) continue;
        vus[k]=true;
        out.push(rendementExercice(u,ex.name,maintenant));
      }
    }
  }catch(e){}
  out.sort((a,b)=>{
    const av=a.rendement==null?1:0, bv=b.rendement==null?1:0;
    if(av!==bv) return av-bv;                       // les sans-score en dernier
    if(av) return String(a.nom).localeCompare(String(b.nom));
    return b.rendement-a.rendement;
  });
  return out;
}
// ══════════ LA ROTATION DE FIN DE BLOC ═════════════════════════════════
//
// A LA FIN D'UN BLOC, JAMAIS EN COURS. Changer un exercice au milieu d'un bloc
// detruit la seule chose qui rende sa pente lisible : la repetition. Le
// meilleur exercice reste celui qu'on repete assez longtemps pour en tirer une
// progression, et proposer d'en changer chaque semaine reviendrait a
// s'interdire toute mesure.
//
// ⚠ ON NE FAIT JAMAIS TOURNER UN EXERCICE QUI PROGRESSE, meme si son cout est
// eleve. Un mouvement qui fait mal ET qui fait progresser est un arbitrage de
// coach — il pese la douleur contre le resultat, avec ce qu'il sait de
// l'athlete et que l'application ignore. Un calcul qui trancherait a sa place
// ferait retirer le meilleur exercice de quelqu'un parce qu'il est exigeant.
const ROT_REMPLACANTS=2;

// PURE. Sommes-nous en fin de bloc ?
//
// DEUX BLOCS COEXISTENT dans l'application : la programmation en semaines
// (programmeDe) et le bloc de priorite musculaire. L'un ou l'autre suffit —
// c'est le moment de faire le point qui compte, pas lequel des deux s'acheve.
function finDeBloc(user,maintenant){
  const u=_dossier(user);
  const t=Number(maintenant)||Date.now();
  try{
    const b=blocAvancement(u,t);
    if(b&&(b.fini||b.reste<=1)) return true;
  }catch(e){}
  try{
    const p=programmeDe(u);
    if(p){
      const i=indexSemaineBloc(u,t);
      // Hors bloc : le bloc est passe, donc fini. Derniere semaine : on y est.
      if(i===null||i>=p.semaines-1) return true;
    }
  }catch(e){}
  return false;
}
// PURE. LES PROPOSITIONS. Rend {actif:Boolean, raison, lignes:[...]}.
//
// LE TIERS BAS **ET** UNE PROGRESSION NULLE OU NEGATIVE. Les deux, pas l'un ou
// l'autre : un exercice mal classe mais qui monte encore n'a pas a bouger, et
// un exercice a plat mais bien classe non plus — s'il tient le haut du panier
// malgre une pente nulle, c'est que les autres font pire.
function propositionsRotation(user,maintenant){
  const u=_dossier(user);
  const t=Number(maintenant)||Date.now();
  if(!finDeBloc(u,t))
    return {actif:false,raison:'La rotation se propose à la fin d’un bloc, pas en cours.',lignes:[]};
  const tous=rendementsBloc(u,t).filter(x=>x.rendement!=null);
  if(tous.length<3)
    return {actif:false,raison:'Pas encore assez d’exercices mesurés pour comparer.',lignes:[]};
  // LE TIERS BAS SE MESURE SUR CE QUI EST MESURABLE. Les exercices sans score
  // n'entrent pas dans le classement : les compter comme mauvais reviendrait a
  // les condamner pour n'avoir pas ete assez faits.
  const seuil=tous[Math.max(0,Math.ceil(tous.length*2/3)-1)].rendement;
  const salle=(function(){ try{ return salleActive(u); }catch(e){ return null; } })();
  const lignes=[];
  for(const x of tous){
    if(x.rendement>seuil) continue;
    // LA GARDE QUI COMPTE : il progresse, on ne touche a rien.
    if(x.progression>0) continue;
    let subs=[];
    try{ subs=(substitutsSalle(u,x.nom,salle).liste||[]); }catch(e){ subs=[]; }
    // PATRON DIFFERENT DE PREFERENCE : changer d'angle est le but meme de la
    // rotation. Un substitut du meme patron travaille le muscle de la meme
    // facon, et reproduirait le plateau qu'on cherche a sortir.
    subs=subs.slice().sort((a,b)=>(a.memePatron?1:0)-(b.memePatron?1:0));
    if(!subs.length) continue;
    lignes.push({nom:x.nom,rendement:x.rendement,progression:x.progression,
      cout:x.cout,regularite:x.regularite,n:x.n,
      remplacants:subs.slice(0,ROT_REMPLACANTS).map(s=>s.nom),
      pourquoi:_rotPourquoi(x)});
  }
  return {actif:true,raison:null,seuil:seuil,lignes:lignes};
}
// PURE. LA PHRASE. Elle nomme le terme qui decroche, et lui seul : « rendement
// 0,12 » ne dit pas quoi faire, « il ne progresse plus depuis six semaines »
// si. Meme discipline que le motif de disponibilite.
function _rotPourquoi(x){
  if(x.regularite!=null&&x.regularite<0.6)
    return 'Fait '+Math.round(x.regularite*100)+' % des fois prévues : trop irrégulier pour rendre quoi que ce soit.';
  if(x.cout>=0.4)
    return 'Ne progresse plus, et coûte cher : douleurs ou effort au-delà de la consigne.';
  return 'Plus de progression sur '+REND_SEMAINES+' semaines et '+x.n+' séances.';
}
// LA VUE COACH. Une seule, dans la fiche client.
//
// L'ATHLETE NE VOIT PAS DE CLASSEMENT DE SES EXERCICES. Ce serait une
// invitation a changer sans raison, et le meilleur exercice reste celui qu'on
// repete assez longtemps pour en tirer une progression lisible.
function _htmlRendement(c){
  const u=_dossier(c);
  let l=[];
  try{ l=rendementsBloc(u); }catch(e){ return ''; }
  if(!l.length) return '';
  const num=(v)=>v==null?'-':(v>=0?'+':'')+String(Math.round(v*100)/100).replace('.',',');
  const pc=(v)=>v==null?'-':Math.round(v*100)+' %';
  const ligne=x=>{
    // PAS DE SCORE : LA MENTION, PAS UNE CASE VIDE. L'absence de mesure est
    // une information — le coach doit savoir qu'il ne sait pas encore.
    if(x.rendement==null)
      return '<tr><td style="padding:4px 8px 4px 0;color:var(--text-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">'
        +escapeHtml(x.nom)+'</td>'
        +'<td colspan="3" style="padding:4px 6px;color:var(--text-faint);font-size:var(--fs-2xs)">pas assez de séances</td>'
        +'<td style="padding:4px 0 4px 6px;text-align:right;color:var(--text-faint);font-variant-numeric:tabular-nums">'+x.n+'</td></tr>';
    const c2=x.rendement>0?'var(--success)':(x.rendement<0?'var(--orange)':'var(--sub)');
    return '<tr><td style="padding:4px 8px 4px 0;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">'
      +escapeHtml(x.nom)+'</td>'
      +'<td style="padding:4px 6px;text-align:right;font-variant-numeric:tabular-nums;color:'
      +(x.progression>0?'var(--success)':'var(--orange)')+'">'+num(x.progression)+'</td>'
      +'<td style="padding:4px 6px;text-align:right;font-variant-numeric:tabular-nums;color:var(--sub)">'+pc(x.cout)+'</td>'
      +'<td style="padding:4px 6px;text-align:right;font-variant-numeric:tabular-nums;color:var(--sub)">'+pc(x.regularite)+'</td>'
      +'<td style="padding:4px 0 4px 6px;text-align:right;font-variant-numeric:tabular-nums;color:'+c2+';font-weight:800">'
      +num(x.rendement)+'</td></tr>';
  };
  let rot='';
  try{
    const p=propositionsRotation(u);
    if(p.actif&&p.lignes.length){
      rot='<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">'
        +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;color:var(--orange);text-transform:uppercase;margin-bottom:6px">Rotation proposée · fin de bloc</div>'
        +p.lignes.map(x=>'<div style="margin-bottom:8px">'
          +'<div style="font-size:var(--fs-xs);color:var(--text);font-weight:700">'+escapeHtml(x.nom)+'</div>'
          +'<div style="font-size:var(--fs-2xs);color:var(--sub);line-height:1.5">'+escapeHtml(x.pourquoi)+'</div>'
          +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:2px">→ '
          +x.remplacants.map(escapeHtml).join(' · ')+'</div></div>').join('')
        +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5">Aucun exercice en progression n’est proposé, quel que soit son coût.</div>'
        +'</div>';
    }
  }catch(e){ rot=''; }
  return '<div class="card card--dense" style="margin-bottom:16px">'
    +'<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:10px">'
    +'<span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase">Rendement · '+REND_SEMAINES+' semaines</span>'
    +'<span style="font-size:var(--fs-2xs);color:var(--text-faint)">progression − coût, pondéré</span></div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:var(--fs-xs);white-space:nowrap">'
    +'<tr><th style="text-align:left;padding:0 8px 6px 0;color:var(--sub);font-weight:700">Exercice</th>'
    +'<th style="text-align:right;padding:0 6px 6px;color:var(--sub);font-weight:700">Prog.</th>'
    +'<th style="text-align:right;padding:0 6px 6px;color:var(--sub);font-weight:700">Coût</th>'
    +'<th style="text-align:right;padding:0 6px 6px;color:var(--sub);font-weight:700">Régul.</th>'
    +'<th style="text-align:right;padding:0 0 6px 6px;color:var(--sub);font-weight:700">Rend.</th>'
    +'<th style="text-align:right;padding:0 0 6px 6px;color:var(--sub);font-weight:700">n</th></tr>'
    +l.map(ligne).join('')+'</table></div></div>';
}
// ══════════ LES SALLES ═════════════════════════════════════════════════
//
// UN ATHLETE EN A SOUVENT DEUX : la sienne, et celle des vacances ou du
// week-end. Sans inventaire, l'application propose des substituts a la poulie
// dans un garage qui n'en a pas — c'est-a-dire une aide qui ne sert a rien au
// seul moment ou elle serait utile.
//
// LA SALLE ACTIVE VIT DANS LA SEANCE, PAS DANS LE PROGRAMME. Changer de salle
// un samedi ne doit rien modifier chez le coach : c'est une circonstance, pas
// une decision d'entrainement.
function salles(user){
  const u=_dossier(user);
  let l=[];
  try{ l=_aplatirChamp?_aplatirChamp(u,'salles',12,true)||[]:[]; }catch(e){ l=[]; }
  if(!l.length&&u&&u.salles) l=_tabBloc(u.salles);
  return l.filter(s=>s&&s.id).map(s=>({id:String(s.id),nom:String(s.nom||'Salle'),
    materiel:_tabBloc(s.materiel).filter(m=>SALLE_MATERIEL.indexOf(m)>=0),
    parDefaut:!!s.parDefaut}));
}
// PURE. La salle par defaut, ou la premiere, ou null.
function salleParDefaut(user){
  const l=salles(user);
  return l.find(s=>s.parDefaut)||l[0]||null;
}
// LA SALLE ACTIVE DE LA SEANCE EN COURS. woState la porte, et rien d'autre :
// elle meurt avec la seance.
function salleActive(user){
  try{
    if(woState&&woState.salleId){
      const s=salles(user).find(x=>x.id===woState.salleId);
      if(s) return s;
    }
  }catch(e){}
  return salleParDefaut(user);
}
function choisirSalle(id){
  try{
    if(!woState) return false;
    woState.salleId=String(id||'')||null;
    try{ woPersist(); }catch(e){}
    try{ renderWoEx(); }catch(e){}
  }catch(e){ return false; }
  return true;
}
function ajouterSalle(user,nom,materiel){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun dossier ouvert.'};
  const n=String(nom||'').trim();
  if(!n) return {ok:false,raison:'Donne un nom à cette salle.'};
  const l=salles(u);
  const s={id:'s_'+Date.now(),nom:n,
    materiel:_tabBloc(materiel).filter(m=>SALLE_MATERIEL.indexOf(m)>=0),
    parDefaut:!l.length};
  u.salles=l.concat([s]);
  try{ saveUser(); }catch(e){ rcErreurMuette('ajouterSalle',e); }
  return {ok:true,salle:s};
}

// ══════════ LE MOTEUR D'EQUIVALENCE ════════════════════════════════════
//
// QUATRE CRITERES, ET LE PREMIER N'EST PAS NEGOCIABLE. Meme muscle primaire,
// sinon ce n'est pas un substitut : c'est un autre exercice. Les trois autres
// classent, ils ne filtrent pas — sauf le materiel, qui decide du message
// « rien d'equivalent ici ».
//
// TROIS CANDIDATS, JAMAIS PLUS. Une liste de quinze substituts en pleine
// seance n'est pas une aide : c'est une decision de plus a prendre, debout,
// entre deux series, et elle sera prise au hasard.
const SUBST_MAX=3;
// PURE. Le muscle primaire d'un exercice, ou null.
function _substPrimaire(nom,user){
  let cls=null; try{ cls=resoudreMusclesLecture(nom,{name:nom},user); }catch(e){ return null; }
  if(!cls||cls===VOL_CARDIO) return null;
  return (cls.p||[])[0]||null;
}
// PURE. Tous les noms de la banque, une fois.
let _substNoms=null;
function _banqueNoms(){
  if(_substNoms) return _substNoms;
  const v=[];
  try{
    for(const s in SCHEMAS_BRUT)
      for(const n of SCHEMAS_BRUT[s].split('~')) if(n) v.push(n);
  }catch(e){}
  _substNoms=v;
  return v;
}
// PURE. L'athlete a-t-il deja fait cet exercice, et a quelle charge ?
// Rend {vu:Boolean, charge:Number|null, date}.
//
// AUCUNE TRANSPOSITION DE CHARGE. Si l'exercice n'a jamais ete fait, on ne
// propose RIEN — deduire une charge d'un autre mouvement par un ratio serait
// une invention pure, et l'athlete la prendrait pour une mesure.
function historiqueExercice(user,nom){
  const u=_dossier(user);
  const k=exKey(nom);
  let charge=null, date=null, vu=false;
  for(const sess of ((u&&u.sessions)||[])){
    if(!sess||!sess.data||!sess.date) continue;
    for(const n2 of Object.keys(sess.data)){
      if(exKey(n2)!==k) continue;
      vu=true;
      for(const s of (((sess.data[n2]||{}).sets)||[])){
        if(!s||s.done!==true) continue;
        const w=parseFloat(s.weight);
        if(w>0&&(date===null||sess.date>=date)){ charge=w; date=sess.date; }
      }
    }
  }
  return {vu:vu,charge:charge,date:date};
}
// PURE. LES SUBSTITUTS DE SALLE. Rend {liste:[...], raison:String|null}.
//
// ⚠ ELLE NE S'APPELLE PAS substitutsPour, ET C'EST DELIBERE : ce nom est PRIS
// depuis toujours par la substitution du COACH — substitutsPour(nom,
// contraintes), qui ecarte les exercices incompatibles avec une contrainte de
// sante. Deux fonctions du meme nom dans la meme portee : la seconde masque la
// premiere, et la substitution coach cessait de fonctionner sans un mot.
// Attrape par la suite, pas au banc.
function substitutsSalle(user,nom,salle){
  const u=_dossier(user);
  const prim=_substPrimaire(nom,u);
  const vide={liste:[],raison:null};
  if(!prim) return Object.assign({},vide,
    {raison:'Cet exercice n’est rattaché à aucun muscle : impossible de proposer un équivalent.'});
  const mat=salle&&Array.isArray(salle.materiel)?salle.materiel:null;
  const patron=(function(){ try{ return schemaDe({name:nom},u); }catch(e){ return null; } })();
  const k0=exKey(nom);
  const cand=[];
  for(const n2 of _banqueNoms()){
    if(exKey(n2)===k0) continue;
    // (a) MEME MUSCLE PRIMAIRE — obligatoire, jamais negociable.
    if(_substPrimaire(n2,u)!==prim) continue;
    if(!exFaisableDans(n2,mat)) continue;
    const p2=(function(){ try{ return schemaDe({name:n2},u); }catch(e){ return null; } })();
    const h=historiqueExercice(u,n2);
    cand.push({nom:n2,
      memePatron:!!(patron&&p2&&patron===p2),          // (b)
      confirme:exMaterielConfirme(n2,mat),             // (c)
      vu:h.vu,charge:h.charge,                         // (d)
      materiel:materielExercice(n2)});
  }
  if(!cand.length)
    return Object.assign({},vide,
      {raison:'Rien d’équivalent ici. Passe à la suite, on en parle avec ton coach.'});
  // AUCUN CANDIDAT DONT LE MATERIEL SOIT CONFIRME DANS CETTE SALLE : on le dit
  // franchement plutot que de proposer un pis-aller. Une proposition dont on
  // ignore si elle est realisable fait perdre plus de temps qu'elle n'en fait
  // gagner, debout entre deux series.
  if(mat&&!cand.some(c=>c.confirme))
    return Object.assign({},vide,
      {raison:'Rien d’équivalent ici. Passe à la suite, on en parle avec ton coach.'});
  // ⚠ LE MATERIEL CONFIRME PASSE DEVANT LE PATRON, ET C'EST UN ECART ASSUME
  // A L'ORDRE DEMANDE (b puis c). La raison : « inconnu » n'est pas une valeur
  // du critere materiel, c'est une ABSENCE — et une absence ne devance jamais
  // une mesure, c'est la regle du projet.
  //
  // MESURE : dans une salle sans materiel, la presse a cuisses proposait trois
  // mouvements dont on IGNORE la faisabilite (meme patron, materiel inconnu),
  // alors qu'un mouvement confirme faisable existait juste en dessous. En
  // seance, proposer ce qu'on ne peut pas faire coute plus cher que proposer
  // un patron voisin qu'on peut faire.
  //
  // Entre deux candidats CONFIRMES, l'ordre demande reprend : patron, puis
  // historique.
  cand.sort((x,y)=>
    (y.confirme?1:0)-(x.confirme?1:0)
    ||(y.memePatron?1:0)-(x.memePatron?1:0)
    ||(y.vu?1:0)-(x.vu?1:0)
    ||String(x.nom).localeCompare(String(y.nom)));
  return {liste:cand.slice(0,SUBST_MAX),raison:null};
}

// ══════════ LE JOURNAL DES ECARTS ══════════════════════════════════════
//
// TROIS FOIS LE MEME ECART N'EST PAS UN INCIDENT, C'EST UN PROGRAMME A
// CORRIGER. Le coach ne doit pas lire trois lignes : il doit lire « trois
// remplacements cette semaine, tous sur la presse a cuisses ».
const ECART_MOTIFS=Object.freeze({
  materiel_occupe:'Matériel occupé',
  absent:'Absent de la salle',
  douleur:'Douleur',
  autre:'Autre'
});
const ECART_MAX=40;
function journaliserEcart(user,e){
  const u=_dossier(user);
  if(!u||!e) return {ok:false};
  const motif=ECART_MOTIFS[e.motif]?e.motif:'autre';
  if(!Array.isArray(u.ecartsSeance)) u.ecartsSeance=_tabBloc(u.ecartsSeance);
  u.ecartsSeance.push({date:Date.now(),seance:String(e.seance||''),
    exoPrevu:String(e.exoPrevu||''),exoFait:String(e.exoFait||''),motif:motif});
  if(u.ecartsSeance.length>ECART_MAX) u.ecartsSeance=u.ecartsSeance.slice(-ECART_MAX);
  try{ saveUser(); }catch(e2){}
  return {ok:true,motif:motif};
}
// PURE. Le resume des sept derniers jours, ou ''.
function resumeEcarts(user,maintenant){
  const u=_dossier(user);
  const t=Number(maintenant)||Date.now();
  const l=_tabBloc(u&&u.ecartsSeance).filter(x=>x&&x.date>t-7*86400000);
  if(!l.length) return '';
  const par={};
  for(const x of l){ const k=exKey(x.exoPrevu)||'?'; (par[k]=par[k]||{n:0,nom:x.exoPrevu}).n++; }
  const cles=Object.keys(par).sort((a,b)=>par[b].n-par[a].n);
  const n=l.length;
  const tete=par[cles[0]];
  // « TOUS SUR » N'EST VRAI QUE SI C'EST VRAI. Un seul exercice concerne : on
  // le dit. Plusieurs : on nomme le plus frequent sans pretendre a l'unicite.
  const ou=(cles.length===1)
    ? ', tous sur '+tete.nom.toLowerCase()
    : (tete.n>1?', dont '+tete.n+' sur '+tete.nom.toLowerCase():'');
  return n+' remplacement'+(n>1?'s':'')+' cette semaine'+ou+'.';
}
// ══════════ LE REMPLACEMENT EN SEANCE ══════════════════════════════════
//
// L'ATHLETE N'AVAIT AUCUN RECOURS. Le coach peut substituer depuis sa fiche ;
// l'athlete, debout devant une presse occupee, n'avait que deux options —
// sauter l'exercice sans rien dire, ou en choisir un au hasard. Les deux
// sortent du programme sans que personne ne le sache.
//
// LE PROGRAMME N'EST JAMAIS MODIFIE. Le remplacement vit dans woState et dans
// le journal : c'est un ECART, pas une decision d'entrainement. Le coach le
// lit, il decide s'il corrige le programme.
// LE SELECTEUR DE SALLE, dans l'en-tete de seance. Il n'apparait qu'a partir
// de DEUX salles : un selecteur a une seule entree est un ornement.
function _htmlSelecteurSalle(){
  const l=salles(currentUser);
  if(l.length<2) return '';
  const a=salleActive(currentUser);
  return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
    +'<span style="font-size:var(--fs-2xs);color:var(--sub);flex-shrink:0">Salle</span>'
    +'<select onchange="choisirSalle(this.value)" style="flex:1;min-width:0;background:var(--surface-2);'
    +'border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:var(--r-2);'
    +'font-family:Montserrat,sans-serif;font-size:var(--fs-xs)">'
    +l.map(s=>'<option value="'+escapeHtml(s.id)+'"'+((a&&a.id===s.id)?' selected':'')+'>'
      +escapeHtml(s.nom)+'</option>').join('')
    +'</select></div>';
}
// LA LIGNE DU COACH. Trois fois le meme ecart n'est pas un incident, c'est un
// programme a corriger — et c'est CA que le coach doit lire, pas la liste des
// trois.
function _htmlEcartsCoach(c){
  let t=''; try{ t=resumeEcarts(c); }catch(e){ t=''; }
  if(!t) return '';
  return '<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);'
    +'padding:12px 14px;margin-bottom:16px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);'
    +'text-transform:uppercase;margin-bottom:6px">Écarts au programme</div>'
    +'<div style="font-size:var(--fs-sm);color:var(--text);line-height:1.6">'+escapeHtml(t)+'</div>'
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);margin-top:6px;line-height:1.5">'
    +'Remplacements décidés en séance. Le programme n’a pas été modifié.</div></div>';
}
