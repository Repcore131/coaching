// ══ LES ACCES QUI ARRIVENT A TERME, PAR MOIS ═══════════════════════════
// « A relancer » dit qui est en train de decrocher. Il ne dit pas ce qui
// tombe le mois prochain — or c'est la meme decision : qui rappeler, et quand.
// Demande de Kevin, 11/09/2026 : « je peux me projeter, tiens, a cette date-la
// j'ai ca qui arrive ».
//
// Groupe par mois plutot qu'en grille de jours : une echeance d'acces se lit
// en « courant novembre », pas en « le 14 ». Les dates passees sont ecartees —
// un acces deja expire releve du filtre « acces qui expire », pas d'une
// projection. Suivis et non suivis sont tous deux presents, avec leur pastille
// de couleur : une echeance porte sur le paiement, pas sur l'accompagnement.
function _htmlCalendrierAcces(){
  let l=[];
  try{ l=getClients()||[]; }catch(e){ return ''; }
  const auj=Date.now();
  const ech=l.map(c=>({c,t:Date.parse(c&&c.accessExpiry)}))
             .filter(x=>isFinite(x.t)&&x.t>=auj)
             .sort((a,b)=>a.t-b.t);
  if(!ech.length) return '';
  const mois={};
  for(const x of ech){
    const d=new Date(x.t),k=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    (mois[k]=mois[k]||[]).push(x);
  }
  const libMois=k=>{
    const [a,m]=k.split('-');
    const t=new Date(Number(a),Number(m)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
    return t.charAt(0).toUpperCase()+t.slice(1);
  };
  const jour=t=>new Date(t).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
  const blocs=Object.keys(mois).sort().map(k=>
    '<div style="margin-bottom:10px">'
    +'<div style="font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.5px;text-transform:uppercase;'
    +'color:var(--sub);margin-bottom:6px">'+escapeHtml(libMois(k))+' · '+mois[k].length+'</div>'
    +mois[k].map(x=>'<div style="display:flex;align-items:center;gap:8px;padding:6px 0;'
      +'border-top:1px solid color-mix(in srgb,var(--text) 5%,transparent);font-size:var(--fs-xs)">'
      +'<span style="width:8px;height:8px;border-radius:var(--r-full);flex-shrink:0;background:'
      +(estSuivi(x.c)?ROUGE_MARQUE:'#f5a524')+'"></span>'
      +'<span style="flex:1;min-width:0;color:var(--text-strong);overflow:hidden;text-overflow:ellipsis;'
      +'white-space:nowrap">'+escapeHtml(((x.c.fname||'')+' '+(x.c.lname||'')).trim()||'-')+'</span>'
      +'<span style="color:var(--sub);flex-shrink:0">'+jour(x.t)+'</span></div>').join('')
    +'</div>').join('');
  return '<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-radius:var(--r-3);padding:14px 14px;margin-bottom:16px">'
    +'<div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;text-transform:uppercase;'
    +'color:var(--sub);margin-bottom:10px">Accès arrivant à terme</div>'+blocs
    +'<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:4px">'
    +'Rouge : avec suivi. Jaune : sans suivi.</div></div>';
}
// `_htmlRepartitionSuivi` VIVAIT ICI. Elle rendait « 17 avec suivi · 13 sans
// suivi » en deux pastilles, pour la barre du portefeuille et pour la carte des
// arrivees. La carte l'a absorbee le 19/09 — ses barres portent les deux
// couleurs, et les comptes sont passes dans leur legende ; la barre l'a perdue
// le meme jour, parce qu'elle y cassait l'alignement des huit compteurs. Plus
// aucun appelant : on la retire plutot que de la laisser dormir.
function _htmlCroissanceCoach(athletes){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  if(!l.length) return '';
  const pts=croissanceHebdo(l,Date.now(),CROISSANCE_SEMAINES);
  const total=pts[pts.length-1].cumul;
  // Sur les quatre dernières semaines : la fenêtre que lit un coach pour
  // savoir si ça bouge, sans être trop courte pour dire quoi que ce soit.
  const recent=pts.slice(-4).reduce((n,p)=>n+p.nouveaux,0);
  const meilleure=pts.reduce((m,p)=>p.nouveaux>m.nouveaux?p:m,pts[0]);
  // LE PORTEFEUILLE ENTIER, pas la somme des barres : les arrivées d'avant la
  // fenêtre de douze semaines comptent aussi, et ce sont elles qui font la
  // différence entre « 3 sur le graphique » et « 30 dans mes athlètes ».
  const avecSuivi=l.filter(estSuivi).length, sansSuivi=l.length-avecSuivi;
  const dt=d=>new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
  return `<div class="evo-carte" style="padding:16px 14px 12px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:2px">
      <div class="evo-titre" style="margin-bottom:0">Arrivées par mois</div>
      <div style="font-size:var(--fs-xs);font-weight:800;color:${recent>0?'var(--text)':'var(--sub)'}">${recent>0?'+':''}${recent} sur 4 semaines</div>
    </div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.4px;margin-bottom:10px">
      D'après la date de création de chaque dossier.</div>
    <!-- UNE SEULE LIGNE, ET LES COMPTES SONT DEDANS. La carte portait la
         répartition du portefeuille juste au-dessus de la légende des barres :
         depuis que les deux parlent la même langue, rouge suivi, blanc sans
         suivi, c'étaient les mêmes quatre mots, écrits deux fois, l'un sur
         l'autre. Les nombres rejoignent donc les pastilles qu'ils décrivent. -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px;flex-wrap:wrap">
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--red-text)">
        <span style="width:9px;height:9px;border-radius:var(--r-1);background:linear-gradient(180deg,#ff4a4a,#6d0000);box-shadow:0 0 7px color-mix(in srgb,var(--red) 80%,transparent)"></span>${avecSuivi} avec suivi</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--text)">
        <span style="width:9px;height:9px;border-radius:var(--r-1);background:linear-gradient(180deg,#ffffff,#8f8f8f);box-shadow:0 0 7px rgba(255,255,255,.6)"></span>${sansSuivi} sans suivi</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-2xs);font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--text)">
        <span style="width:11px;height:2px;border-radius:var(--r-1);background:#ffffff;box-shadow:0 0 7px rgba(255,255,255,.8)"></span>Total (${total})</span>
    </div>
    <canvas id="ch-croissance-toile" height="150" style="width:100%;display:block"></canvas>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.5;margin-top:8px">
      ${meilleure.nouveaux>0?`Meilleure semaine : ${meilleure.nouveaux} arrivée${meilleure.nouveaux>1?'s':''} le ${dt(meilleure.debut)}.`:'Aucune arrivée sur les 12 dernières semaines.'}
    </div>
  </div>`;
}
// PURE. Entrées et sorties du TRIMESTRE en cours.
// Une pause déclarée n'est JAMAIS une sortie : c'est tout l'objet du compteur
// séparé — un coach qui lit « 4 sorties » alors que trois sont des pauses
// prend une décision sur un chiffre faux.
function _entreesSorties(athletes,now){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  const d=(now instanceof Date)?new Date(now):new Date(now||Date.now());
  const t=d.getTime();
  const trim=Math.floor(d.getMonth()/3);
  const debut=new Date(d.getFullYear(),trim*3,1).getTime();
  const limite=t-ACT_SORTIE_JOURS*864e5;
  let entrees=0,sorties=0,pauses=0;
  for(const a of l){
    const c=Number(a.createdAt);
    if(isFinite(c)&&c>=debut&&c<=t) entrees++;
    if(_estEnPause(a)){ pauses++; continue; }
    const ses=_actSessions(a);
    if(!ses.length) continue;                 // jamais démarré : pas une sortie
    let dernier=0;
    for(const s of ses) if(s.date>dernier) dernier=s.date;
    if(dernier<limite) sorties++;
  }
  return {entrees,sorties,pauses,depuis:debut,seuilJours:ACT_SORTIE_JOURS};
}
function _actMediane(l){
  if(!l.length) return null;
  const t=l.slice().sort((a,b)=>a-b);
  return t.length%2?t[(t.length-1)/2]:(t[t.length/2-1]+t[t.length/2])/2;
}
// PURE. Ancienneté médiane en SEMAINES. null sous cinq athlètes : une médiane
// sur trois personnes ne dit rien et se lirait comme un fait.
function _ancienneteMediane(athletes,now){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  if(l.length<ACT_MIN_ATHLETES) return null;
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  const sem=[];
  for(const a of l){
    const c=Number(a.createdAt);
    if(isFinite(c)&&c>0&&c<=t) sem.push((t-c)/(7*864e5));
  }
  const m=_actMediane(sem);
  return m==null?null:Math.round(m);
}
// PURE. Taux de complétion moyen sur quatre semaines, et sa tendance face aux
// quatre précédentes. null sous cinq athlètes, pour la même raison.
//
// « tendance » vaut 'hausse' | 'stable' | 'baisse' — jamais un pourcentage de
// progression, qui se lirait comme une projection.
// DELEGUE a tauxCompletion. Cette fonction calculait son propre taux sur quatre
// semaines, avec une regle differente : elle ecartait l athlete ENTIER s il
// etait en pause, la ou tauxCompletion ecarte les SEMAINES suspendues. Deux
// chiffres pour la meme question, sur deux ecrans. Il n en reste qu un.
function _completionMoyenne(athletes,now){
  const l=Array.isArray(athletes)?athletes.filter(Boolean):[];
  if(l.length<ACT_MIN_ATHLETES) return null;
  const t=(now instanceof Date)?now.getTime():(typeof now==='number'?now:Date.now());
  const moy=(instant)=>{
    let somme=0,n=0;
    for(const a of l){
      let r=null;
      try{ r=tauxCompletion(a,instant); }catch(e){}
      if(r&&r.interpretable){ somme+=r.taux; n++; }
    }
    return n?(somme/n):null;
  };
  const recent=moy(t);
  if(recent==null) return null;
  const avant=moy(t-TC_JOURS*864e5);
  let tendance='stable';
  if(avant!=null){
    const ecart=recent-avant;
    if(ecart>5) tendance='hausse';
    else if(ecart<-5) tendance='baisse';
  }
  return {taux:Math.round(recent),tendance:(avant==null?null:tendance),
    semaines:TC_SEMAINES};
}


// ── L'écran, quatre cartes, barres en CSS pur ─────────────────────────────
// Aucune bibliothèque, aucun canevas : des <div> dont la hauteur est un
// pourcentage. Aucune notification n'est émise, aucun état n'est modifié —
// cet écran LIT, il n'écrit rien.
const ACT_MOIS_LIB=['janv.','févr.','mars','avr.','mai','juin','juil.','août',
  'sept.','oct.','nov.','déc.'];
function _actLibMois(cle){
  const m=/^(\d{4})-(\d{2})$/.exec(String(cle||''));
  if(!m) return String(cle||'');
  return ACT_MOIS_LIB[+m[2]-1]+' '+m[1].slice(2);
}
function _actCarte(titre,corps,note){
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;margin-bottom:12px">
    <div style="font-size:var(--fs-xs);color:var(--sub);letter-spacing:1.5px;font-weight:800;text-transform:uppercase;margin-bottom:10px">${escapeHtml(titre)}</div>
    ${corps}
    ${note?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:10px">${note}</div>`:''}
  </div>`;
}
function _actChiffre(n,lib,couleur){
  return `<div style="flex:1;min-width:0;text-align:center">
    <div style="font-family:var(--pile-titre);font-size:var(--fs-2xl);line-height:1;color:${couleur||'var(--text)'}">${n}</div>
    <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;font-weight:800;text-transform:uppercase;margin-top:6px;line-height:1.25">${escapeHtml(lib)}</div>
  </div>`;
}
function renderCoachActivite(){
  const el=document.getElementById('cact-body');
  if(!el) return;
  // ── État « chargement » ──
  // Le cache local peut être vide sur un appareil neuf : afficher 0 serait un
  // faux effondrement. countActiveAthletesFiable existe exactement pour ça.
  let fiable=true;
  try{ fiable=countActiveAthletesFiable(currentUser,DB.get('users')||{}); }catch(e){}
  let ath=[];
  try{ ath=getClients().filter(c=>c&&!c._fromCode); }catch(e){
    el.innerHTML=`<div style="background:var(--warning-bg);border:1px solid var(--warning-border);border-radius:var(--r-3);padding:14px;font-size:var(--fs-sm);color:var(--text);line-height:1.6">Impossible de lire ton portefeuille pour l'instant. Reviens dans un moment.</div>`;
    return;
  }
  if(!fiable&&!ath.length){
    el.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:24px 14px;text-align:center;font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">Synchronisation en cours…<div style="font-size:var(--fs-xs);color:var(--text-faint);margin-top:6px">Tes dossiers arrivent sur cet appareil. Les chiffres seraient faux avant.</div></div>`;
    return;
  }
  // ── État « 0 athlète » ──
  if(!ath.length){
    el.innerHTML=`<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);padding:24px 16px;text-align:center">
      <div style="font-size:var(--fs-md);font-weight:800;color:var(--text);margin-bottom:6px">Pas encore d'athlète</div>
      <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">Cet écran se remplira tout seul dès qu'un athlète aura rejoint ton suivi et enregistré sa première séance.</div>
    </div>`;
    return;
  }
  const now=Date.now();
  const mois=_actifsParMois(ath,now);
  const es=_entreesSorties(ath,now);
  const anc=_ancienneteMediane(ath,now);
  const comp=_completionMoyenne(ath,now);
  const partiel=ath.length<ACT_MIN_ATHLETES;
  // ── Carte 1 : actifs par mois ──
  const maxi=mois.reduce((m,x)=>Math.max(m,x.actifs),0)||1;
  const barres=mois.map(x=>{
    const h=Math.round(x.actifs/maxi*100);
    return `<div style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:var(--fs-2xs);color:${x.actifs?'var(--text-strong)':'var(--text-faint)'};font-weight:800">${x.actifs}</div>
      <div style="width:100%;height:64px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${Math.max(h,2)}%;background:${x.actifs?'linear-gradient(180deg,var(--red),#8d0000)':'#242424'};border-radius:var(--r-1) var(--r-1) 0 0"></div>
      </div>
      <div style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.2px;white-space:nowrap;transform:rotate(-45deg);transform-origin:center;height:22px">${escapeHtml(_actLibMois(x.mois))}</div>
    </div>`;
  }).join('');
  const c1=_actCarte('Athlètes actifs par mois',
    `<div style="display:flex;gap:4px;align-items:flex-end">${barres}</div>`,
    'Fenêtre réellement disponible : '+mois.length+' mois. <b>Actif</b> veut dire : au moins une séance enregistrée dans le mois.');
  // ── Carte 2 : entrées et sorties du trimestre ──
  const c2=_actCarte('Ce trimestre',
    `<div style="display:flex;gap:8px">
      ${_actChiffre(es.entrees,'Arrivées','var(--green)')}
      ${_actChiffre(es.sorties,'Sans séance','var(--orange)')}
      ${_actChiffre(es.pauses,'En pause','#8a8a8a')}
    </div>`,
    '« Sans séance » : aucune séance depuis '+es.seuilJours+' jours. Un athlète en pause déclarée n\'y figure jamais, et la raison de sa pause n\'est pas affichée ici.');
  // ── Carte 3 : ancienneté ──
  const c3=_actCarte('Ancienneté',
    anc==null
      ? `<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">${ath.length} athlète${ath.length>1?'s':''} suivi${ath.length>1?'s':''}. La médiane n'a pas de sens en dessous de ${ACT_MIN_ATHLETES} : elle reste masquée.</div>`
      : `<div style="display:flex;gap:8px">${_actChiffre(anc,'Semaines (médiane)')}${_actChiffre(ath.length,'Athlètes')}</div>`,
    anc==null?null:'La moitié de tes athlètes te suit depuis plus longtemps, l\'autre moitié depuis moins.');
  // ── Carte 4 : complétion ──
  const fleche=comp&&comp.tendance==='hausse'?'▲':comp&&comp.tendance==='baisse'?'▼':'=';
  const coulT=comp&&comp.tendance==='hausse'?'var(--green)':comp&&comp.tendance==='baisse'?'var(--orange)':'var(--sub)';
  const c4=_actCarte('Séances faites sur séances prévues',
    comp==null
      ? `<div style="font-size:var(--fs-sm);color:var(--text-dim);line-height:1.6">Masqué en dessous de ${ACT_MIN_ATHLETES} athlètes, ou tant qu'aucun programme n'est configuré.</div>`
      : `<div style="display:flex;gap:8px;align-items:center">
          ${_actChiffre(comp.taux+' %','sur '+comp.semaines+' semaines')}
          <div style="flex:1;min-width:0;text-align:center">
            <div style="font-size:var(--fs-xl);line-height:1;color:${coulT}">${comp.tendance?fleche:'-'}</div>
            <div style="font-size:var(--fs-2xs);color:var(--sub);letter-spacing:1px;font-weight:800;text-transform:uppercase;margin-top:6px">${comp.tendance?escapeHtml(comp.tendance):'pas de repère'}</div>
          </div>
        </div>`,
    comp==null?null:'Comparé aux '+comp.semaines+' semaines précédentes. Les athlètes en pause n\'y comptent pas.');
  el.innerHTML=c1+c2+c3+c4+_actParagraphe(ath,mois,es,anc,comp,partiel);
}
// UN SEUL paragraphe, FACTUEL. Il décrit ce qui est mesuré, il ne prédit rien,
// ne compare à personne et ne chiffre aucun revenu.
function _actParagraphe(ath,mois,es,anc,comp,partiel){
  const p=[];
  // LE MÊME COMPTE QUE « Mes athlètes (avec suivi) » (build 1811).
  p.push(texteTuSuis(nbAthletesSuivis()));
  if(mois.length>=2){
    const d=mois[mois.length-1].actifs, v=mois[mois.length-2].actifs;
    p.push(d===v?('Autant d\'athlètes actifs ce mois-ci que le mois dernier ('+d+').')
      :('Ce mois-ci, '+d+' athlète'+(d>1?'s':'')+' actif'+(d>1?'s':'')+', contre '+v+' le mois dernier.'));
  }
  if(es.sorties) p.push(es.sorties+' athlète'+(es.sorties>1?'s n\'ont':' n\'a')+' plus enregistré de séance depuis '+es.seuilJours+' jours.');
  if(es.pauses) p.push(es.pauses+' '+(es.pauses>1?'sont':'est')+' en pause déclarée.');
  if(partiel) p.push('En dessous de '+ACT_MIN_ATHLETES+' athlètes, les médianes et les tendances restent masquées : elles se liraient comme des faits alors qu\'elles n\'en sont pas.');
  p.push('Ces chiffres décrivent ce qui a été enregistré dans RepCore, rien d\'autre.');
  return `<div style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-3);padding:14px 14px;font-size:var(--fs-xs);color:var(--text-strong);line-height:1.7">${escapeHtml(p.join(' '))}
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);line-height:1.55;margin-top:8px">Une pause non déclarée (ou déclarée sans être partagée avec toi) n'est pas visible ici : elle apparaîtra comme une absence de séance.</div>
  </div>`;
}
function loadCoachActivite(){
  go('s-coach-activite');
  renderCoachActivite();
}
// REPUBLICATION DE RATTRAPAGE. Un coach qui a rempli sa vitrine AVANT que
// son navigateur ne charge la version qui sait la publier garde ses textes
// en local sans qu ils atteignent jamais coach_public : la liste blanche du
// code d alors ne les connaissait pas. Mesure sur le dossier de Kevin : bio
// de 226 caracteres en local, absente du profil publie.
// Rien ne le rattrapait — il fallait re-enregistrer a la main, sans que rien
// ne le dise. On compare donc ce qu on a a ce qui est publie, et on repousse
// une seule fois si l ecart existe. Idempotent : sans ecart, aucun trafic.
async function _rattraperProfilCoach(){
  try{
    if(!currentUser||currentUser.role!=='coach') return;
    const aPublier=['bio','vision','photoVitrine','signature','logo','cartePro','diplomes']
      .filter(k=>{const v=currentUser[k];
        return Array.isArray(v)?v.length>0:!!(v&&String(v).trim());});
    if(!aPublier.length) return;
    if(!CLOUD.ok||!CLOUD.ok()) return;
    // `/\./g` et non `/./g` : sans la barre oblique inverse, le point est le
    // joker des expressions régulières et TOUS les caractères devenaient des
    // virgules. La clé interrogée n’existait donc jamais, `publie` valait {},
    // et la comparaison ci-dessous déclarait tout manquant — ce rattrapage
    // « idempotent » republiait le profil ENTIER à chaque passage.
    const cle=(currentUser.email||'').replace(/\./g,',');
    const tok=await CLOUD._getToken(); if(!tok) return;
    const r=await fetch(CLOUD._urlProfilCoach(cle)+'?auth='+tok);
    if(!r.ok) return;
    const publie=await r.json()||{};
    const manquants=aPublier.filter(k=>{const v=publie[k];
      return Array.isArray(v)?!v.length:!(v&&String(v).trim());});
    if(!manquants.length) return;
    // .catch et non try/catch : la fonction est asynchrone, et un try
    // synchrone ne rattrape pas un rejet. Le rattrapage est silencieux par
    // nature — personne ne l’a demandé — mais l’échec ENFILE, donc il repart.
    CLOUD.pushProfilCoach(currentUser).catch(()=>{});
  }catch(e){}
}
function loadCoachHome(){
  // Même mémorisation que côté athlète : les deux accueils sont les deux
  // écrans que le changement de jour doit rafraîchir.
  _jourAffiche=localISODate(new Date());
  // UNE FOIS PAR SESSION, et pas à chaque appel : loadCoachHome est rappelée
  // par la boucle de synchronisation toutes les 5 minutes, et par chaque
  // retour vers le tableau de bord.
  //
  // Le drapeau est celui de go(), QUI GARDE DÉJÀ CETTE FONCTION. Un second
  // pour la même question finirait par dire autre chose que le premier —
  // c’est la faute que ce fichier a déjà corrigée ailleurs.
  if(!window._ratProfilFait){ window._ratProfilFait=true;
    try{ _rattraperProfilCoach(); }catch(e){} }
  // Publication de rattrapage : les coachs qui ont rempli leur profil AVANT
  // l existence du nud public n auraient rien a montrer tant qu ils ne
  // reenregistrent pas. Une fois par session suffit.
  // LE GARDE RESTE : cette publication de rattrapage n’a lieu qu’une fois par
  // session. Il ne bloque PAS le rejeu de la file — viderFile appelle
  // pushProfilCoach directement, sans passer par ici.
  if(!window._profilCoachPublie){ window._profilCoachPublie=true;
    CLOUD.pushProfilCoach(currentUser).catch(()=>{}); }
  go('s-coach-home');
  // Pousser les données locales vers Firebase dès l'ouverture (récupère les saves pré-v144)
  // UNE seule lecture du cache pour tout l'ecran : elle sert a la poussee
  // ci-dessous ET au bandeau de paliers. Mesure : 130 ms a 40 athletes,
  // c'est le JSON.parse qui pese, pas le comptage.
  const _cacheUsers=DB.get('users')||{};
  if(CLOUD.canWrite()) CLOUD.push(_cacheUsers);
  // Sans await : le tableau de bord s'affiche tout de suite avec ce qu'on a,
  // et se complete quand les codes ont repondu.
  _rafraichirCodesEleves();
  // ET LES ELEVES QUE CET APPAREIL N A JAMAIS VUS. Ceux qui se sont inscrits
  // sur leur propre telephone n entraient dans aucune des deux voies
  // existantes : ils n avaient ni invitation par lien, ni dossier local.
  _rapatrierElevesInconnus();
  const u=currentUser;
  // Entrée du tunnel : chiffres du produit, donc créateur uniquement. Le
  // masquage n'est qu'un confort d'affichage — loadMetrics refait le contrôle.
  const _lt=document.getElementById('ch-lien-tunnel');
  if(_lt) _lt.style.display=(u.email===CREATOR_EMAIL)?'block':'none';
  const fullName=((u.fname||'')+' '+(u.lname||'')).trim()||'Profil incomplet';
  const el=document.getElementById('ch-name');if(el)el.textContent=fullName;
  const elSb=document.getElementById('ch-name-sidebar');if(elSb)elSb.textContent=fullName;
  const codeEl=document.getElementById('ch-code-small');
  if(codeEl){
    codeEl.textContent=u.code?('Code: '+u.code):'';
    // ⚠ SANS CODE, LE BOUTON DISPARAIT. Du temps ou c'etait une ligne de
    //   texte, une chaine vide suffisait a ne rien montrer. Un bouton vide,
    //   lui, garde sa surface rouge et son clic : il ouvrirait un ecran qui
    //   n'a aucun code a afficher.
    codeEl.hidden=!u.code;
  }
  const codeSb=document.getElementById('ch-code-sidebar');if(codeSb)codeSb.textContent=u.code||'';
  // Show desktop sidebar if wide screen
  const sidebar=document.getElementById('ch-sidebar');
  const mobileHeader=document.getElementById('ch-mobile-header');
  const tabsBar=document.getElementById('coach-tabs-bar');
  // Sidebar always hidden, tabs always visible
  if(sidebar) sidebar.style.display='none';
  if(mobileHeader) mobileHeader.style.display='flex';
  if(tabsBar){tabsBar.style.display='flex';tabsBar.style.visibility='visible';}
  const clients=getClients();
  try{
    const _zp=document.getElementById('ch-paliers');
    // ⚠ LE BANDEAU « N / M ATHLETES ACTIFS » NE S'AFFICHE PLUS ICI.
    // Demande de Kevin, 08/09/2026 : « c'est pas forcement une information
    // interessante ». Il occupait la premiere ligne utile de l'ecran pour un
    // compteur que le coach connait deja.
    // LA FONCTION RESTE, ET L'ALERTE DE DEPASSEMENT AUSSI : elle est rendue
    // par _htmlAlertePalier juste en dessous, et c'est elle qui compte. On
    // retire un compteur permanent, pas un garde-fou.
    if(_zp) _zp.innerHTML='';
    // Le comptage de cycles se fait ICI, une fois par ouverture du tableau
    // de bord, avec le cache deja lu. Il n ecrit dans le dossier que quand
    // le mois change : un enregistrement par mois, pas un par affichage.
    if(majCyclesPaliers(u,_cacheUsers)) try{ saveUser(); }catch(e){ rcErreurMuette('loadCoachHome',e); }
    const _za=document.getElementById('ch-alerte-palier');
    if(_za) _za.innerHTML=_htmlAlertePalier(u,_cacheUsers);
    _rendreInvitations();
  }catch(e){}
  // LE POINT DE LA SEMAINE (05/10/2026) : les résumés du jour, puis la carte.
  // Sans attendre : le tableau de bord ne dépend ni de l'un ni de l'autre.
  try{ majHebdoEntrees().catch(()=>{}); renderPointSemaine().catch(()=>{}); }catch(e){}
  // N1.11 — les trois compteurs sont comptes par agregerPortefeuille, avec
  // les memes fonctions, et rendus par renderPortefeuille depuis
  // renderClientList. Un seul comptage, un seul rendu.
  try{ const _av=avancementCharges(), _e=document.getElementById('ch-charges-av');
    if(_e) _texteIco(_e,_av.pose+'/'+_av.total+(_av.pose<_av.total?', à compléter':' '+ICO.coche)); }catch(e){}
  // L'ORDRE ET LES BLOCS MASQUÉS du coach (Personnaliser l'accueil).
  try{ appliquerAccueilCoach(); }catch(e){ rcErreurMuette('appliquerAccueilCoach',e); }
  const elList=document.getElementById('ch-clients-list');
  if(!clients.length){
    renderTodoBlock([]);
    _rendreJamaisDemarre([]);
    _rendreInactifs([]);
    elList.innerHTML=emptyState('users','Aucun athlète pour l\'instant. Ils apparaîtront ici dès qu\'ils te rejoignent.'+(u.code?'<br>Partage ton code : <strong style="color:var(--red-text)">'+u.code+'</strong>':''),'Inviter un athlète','openAddAthlete()');return;
  }
  clients.sort((a,b)=>urgencyScore(b)-urgencyScore(a));
  try{ _majResumeTunnel(clients); }catch(e){}
  renderTodoBlock(clients);
  _rendreJamaisDemarre(clients);
  _rendreInactifs(clients);
  // La toile est tracée APRÈS son insertion : _setupCanvas mesure la largeur
  // du conteneur, et un élément pas encore dans le document en mesure zéro.
  try{
    const _zc=document.getElementById('ch-croissance');
    if(_zc){ _zc.innerHTML=_htmlCroissanceCoach(clients);
      if(clients.length) setTimeout(()=>{ try{ _dessinerCroissance('ch-croissance-toile',croissanceHebdo(clients,Date.now(),CROISSANCE_SEMAINES)); }catch(e){} },0); }
  }catch(e){}
  // Reecrire innerHTML remet le panneau en haut : le coach qui parcourait sa
  // liste y etait ramene a chaque reveil. On releve la position avant, on la
  // repose apres.
  renderClientList(clients);
  // Preserve current tab if already on coach home, otherwise default to dashboard
  const _alreadyHere=document.getElementById('s-coach-home')?.classList.contains('active');
  const _activeTab=_alreadyHere?(['dashboard','codes','monetisation','profil'].find(t=>{const e=document.getElementById('ct-'+t);return e&&e.style.display!=='none';})||'dashboard'):'dashboard';
  coachTab(_activeTab);
  // TIRER POUR RAFRAICHIR, sur le tableau de bord et lui seul. La primitive est
  // deja eprouvee cote athlete et porte son propre repli ; elle n'etait armee
  // que sur un ecran. C'est pourtant ici que le besoin est le plus fort : vingt
  // dossiers qui bougent pendant que le coach travaille, et une boucle de 30 s
  // qui n'annonce rien.
  // CIBLE #ct-dashboard ET PAS #s-coach-home : ce dernier est en overflow:hidden,
  // le conteneur qui defile est le panneau d'onglet. Les trois autres onglets
  // contiennent des champs de saisie — un rafraichissement pendant une frappe
  // est deja proscrit ailleurs. La garde interne zone._arcTirage empeche le
  // rearmement, donc l'appel peut rester ici.
  try{
    arcTirerPourRafraichir(document.getElementById('ct-dashboard'),()=>{
      try{
        if(CLOUD.ok()) CLOUD.syncRelevantUsers().then(()=>loadCoachHome()).catch(()=>loadCoachHome());
        else loadCoachHome();
      }catch(e){ loadCoachHome(); }
    });
  }catch(e){}
  // Sync athlètes depuis Firebase puis re-render pour afficher photos/objectifs à jour
  if(CLOUD.ok()) CLOUD.syncRelevantUsers().then(()=>{
    const freshClients=getClients();
    freshClients.sort((a,b)=>urgencyScore(b)-urgencyScore(a));
    renderTodoBlock(freshClients);
    // ET APRES LA SYNCHRO AUSSI. Un athlete rapatrie par syncRelevantUsers
    // n'existait pas au premier rendu : sans ce second appel, il n'apparaitrait
    // qu'au prochain retour sur le tableau de bord.
    _rendreJamaisDemarre(freshClients);
    _rendreInactifs(freshClients);
    const el2=document.getElementById('ch-clients-list');
    if(!el2||!freshClients.length) return;
    // LA PULSATION NE PART QUE SI LA LISTE A REELLEMENT CHANGE. Posee a chaque
    // tour de boucle, elle ne dirait plus rien — et la synchro tourne toutes
    // les 30 secondes. Deux signaux suffisent : le nombre d athletes, et
    // l identite du premier, qui bouge des que le tri par urgence bascule.
    const _av=(typeof clients!=='undefined'&&clients)||[];
    const _change=freshClients.length!==_av.length
      ||(freshClients[0]&&_av[0]&&freshClients[0].id!==_av[0].id);
    // LA SIGNATURE D'UNE LIGNE, relevee AVANT le rendu : c'est elle qui dit
    // quelle ligne a bouge, et pas seulement que la liste a bouge.
    const _sig=c=>{ try{ return urgencyScore(c)+'|'+(hasNewBilan(c)?1:0)+'|'+etatAthlete(c); }
                    catch(e){ return ''; } };
    const _avantMap=new Map(_av.map(c=>[c.id,_sig(c)]));
    // Meme precaution apres la synchro distante, qui reecrit la meme liste.
    renderClientList(freshClients);
    // APRES renderClientList, qui restaure la position de defilement : poser
    // l animation avant la ferait sauter la liste sous les yeux du coach.
    if(_change&&!arcReduit()){
      let _n=0;
      for(const c of freshClients){
        if(_n>=3) break;                 // au-dela, plus rien ne designe personne
        const _a=_avantMap.get(c.id);
        if(_a!=null&&_a===_sig(c)) continue;
        const _l=el2.querySelector('.client-row[data-cid="'+c.id+'"]');
        if(_l){ _l.classList.add('cr-neuve'); _n++; }
      }
    }
  }).catch(()=>{});
}
// UN ATHLÈTE EST RATTACHÉ PAR L'UN OU L'AUTRE DE DEUX CHAMPS, ET LE TABLEAU
// DE BORD N'EN REGARDAIT QU'UN.
//
// Signalé par Kevin le 25/08/2026 : deux élèves rattachés, un seul affiché.
//
// `coachId` désigne l'identifiant du compte coach. `coachEmailKey` désigne son
// adresse. Les deux sont posés au rattachement — mais pas par tous les chemins,
// et pas toujours ensemble :
//   • _appliquerPayloadCode pose les deux, et coachEmailKey depuis le PAYLOAD
//     et non depuis le cache local ; son propre commentaire le dit : « c'est la
//     seule valeur qui ouvre le dossier au coach côté serveur ».
//   • Le repli qu'il porte dérive coachEmailKey de coachEmail pour les codes
//     émis avant son existence — donc pour des dossiers où coachId peut être
//     absent.
//   • Un coach qui recrée son compte change d'id : les dossiers déjà rattachés
//     gardent l'ancien, alors que l'adresse, elle, n'a pas bougé.
//
// C'est bien coachEmailKey que database.rules.json exige pour ouvrir le
// dossier au coach. Un athlète que le coach PEUT LIRE porte donc forcément ce
// champ — et pouvait n'apparaître nulle part sur son tableau de bord.
//
// canalAccessible admettait déjà les deux (`u.coachId||u.coachEmailKey`).
// C'est cette lecture-là qui fait foi ; getClients était en retard.
//
// `role!=='coach'` ET NON `role==='athlete'` : c'est le prédicat qu'emploient
// déjà les trois autres endroits qui parcourent les athlètes d'un coach
// (syncRelevantUsers, la liste des modèles, le transfert de portefeuille). Un
// dossier sans rôle explicite y était compté, et ne l'était pas ici.
function _estMonAthlete(u,coach){
  if(!u||!coach||u.role==='coach') return false;
  if(u.coachId&&coach.id&&u.coachId===coach.id) return true;
  const k=coach.email?String(coach.email).toLowerCase().replace(/\./g,','):'';
  return !!(k&&u.coachEmailKey&&String(u.coachEmailKey).toLowerCase()===k);
}
function getClients(){
  const users=DB.get('users')||{};
  const allUsers=Object.values(users);

  // 1. Athlètes enregistrés sur cet appareil liés à ce coach
  const registered=allUsers.filter(u=>_estMonAthlete(u,currentUser));
  const registeredNames=new Set(registered.map(u=>((u.fname||'')+' '+(u.lname||'')).toLowerCase().trim()));

  // 2. Élèves issus des codes (même si pas encore enregistrés / autre appareil)
  //
  // `active!==false` ET NON `active` : _rafraichirCodesEleves emploie déjà ce
  // prédicat-là. Un code créé sans le drapeau — undefined, et non false — était
  // donc rafraîchi depuis le réseau à chaque ouverture, puis écarté de la liste
  // qu'il venait d'alimenter. L'élève n'apparaissait jamais.
  const codes=currentUser.studentCodes||[];
  codes.filter(c=>c&&c.active!==false).forEach(c=>{
    const name=(c.studentName||'').toLowerCase().trim();
    // ON NE PERD PLUS UN CODE SANS NOM. `if(name && ...)` écartait en silence
    // toute invitation créée sans nommer l'élève : elle n'apparaissait sur
    // aucune ligne, alors que c'est précisément le cas où le coach a besoin de
    // la voir pour la relancer. Sans nom, on affiche l'adresse, sinon le code.
    const dejaLa=name?registeredNames.has(name)
      :(c.athleteEmail&&registered.some(u=>(u.email||'').toLowerCase()===String(c.athleteEmail).toLowerCase()));
    if(dejaLa) return;
    const libelle=(c.studentName||c.usedBy||c.athleteEmail||'Élève sans nom').trim();
    // Créer un profil minimal depuis le code
    registered.push({
      id:'_code_'+c.codeId,
      fname:libelle.split(' ')[0],
      lname:libelle.split(' ').slice(1).join(' '),
      email:c.athleteEmail||'',
      role:'athlete',
      coachId:currentUser.id,
      status:'COACHING_SUIVI',
      sessions:[],bilans:[],streak:0,
      _fromCode:true,
      _codeInfo:c
    });
    if(name) registeredNames.add(name);
  });

  return registered;
}
function isActive(c){
  const lastSession=c.sessions?.length?c.sessions[c.sessions.length-1].date:0;
  const lastBilan=c.bilans?.length?c.bilans[c.bilans.length-1].date:0;
  const lastActivity=Math.max(lastSession,lastBilan,c.createdAt||0);
  return Date.now()-lastActivity<14*864e5;
}
// ══ LA CADENCE DES BILANS, UNE SEULE DÉFINITION DU RETARD (30/09/2026) ═════
//
// Le coach pose sur le dossier de l'athlète bilanCadence = {freq:1|2|4
// (semaines), jour:0..6 (0 = dimanche)}. Sans elle, c'est la fréquence que
// l'athlète a choisie (_bilanFreq, 2 par défaut) et le samedi : exactement ce
// que son téléphone faisait déjà.
//
// ⚠ echeanceBilan EST LA SEULE RÈGLE : needsAlert (« Bilans en retard »,
//   urgencyScore, le portefeuille), la carte de l'athlète, son compte à
//   rebours et ses rappels la lisent. Le Worker (relances.js,
//   echeanceBilanParis) applique la même, en jours de Paris.
// ⚠ L'ÉCHÉANCE : « dernier bilan + N semaines », arrondi au jour choisi le
//   plus proche (±3 jours), avancé par setDate (heure d'été). EN RETARD dès
//   le LENDEMAIN de l'échéance, chez l'athlète comme chez le coach ; le jour
//   même, la carte de l'athlète dit « aujourd'hui ».
// ⚠ UN CHANGEMENT DE CADENCE en cours de cycle repart du dernier bilan : il
//   n'y a pas d'échéance mémorisée, elle se recalcule à chaque lecture.
// ⚠ SANS AUCUN BILAN, rien ici : « Inscrit, n'a jamais commencé » garde sa
//   règle, et needsAlert celle du questionnaire.
const BILAN_FREQS=Object.freeze([1,2,4]);
const BILAN_JOURS=Object.freeze(['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']);
const QUESTIONS_COACH_MAX=3, QUESTION_COACH_LONG=120;
// PURE. La cadence posée par le coach, bornée ; null si absente ou invalide.
function bilanCadenceValide(x){
  if(!x||typeof x!=='object') return null;
  const f=Number(x.freq), j=Number(x.jour);
  if(BILAN_FREQS.indexOf(f)<0||!Number.isInteger(j)||j<0||j>6) return null;
  return {freq:f,jour:j};
}
// PURE. La fréquence en vigueur (semaines) : celle du coach, sinon celle de l'athlète.
function bilanFreqEffective(c){
  const cad=bilanCadenceValide(c&&c.bilanCadence);
  if(cad) return cad.freq;
  const f=Number(c&&c._bilanFreq);
  return BILAN_FREQS.indexOf(f)>=0?f:2;
}
// PURE. « dateMs + freq semaines », arrondi au `jour` le plus proche (±3 jours).
function _bilanAncre(dateMs,freqWeeks,jour){
  const d=new Date(dateMs); d.setHours(0,0,0,0);
  d.setDate(d.getDate()+freqWeeks*7);
  let ecart=((jour-d.getDay())%7+7)%7;
  if(ecart>3) ecart-=7;
  d.setDate(d.getDate()+ecart);
  d.setHours(0,0,0,0);
  return d;
}
/**
 * PURE. {echeance (ms, minuit local), retardJours (négatif avant l'échéance,
 * 0 le jour même), freq, jour, source:'coach'|'athlete'} ; tout à null sans bilan.
 */
function echeanceBilan(c,maintenant){
  const der=dernierBilan(c);
  const vide={echeance:null,retardJours:null,freq:bilanFreqEffective(c),jour:null,source:null};
  if(!der||!(Number(der.date)>0)) return vide;
  const cad=bilanCadenceValide(c&&c.bilanCadence);
  const freq=cad?cad.freq:bilanFreqEffective(c), jour=cad?cad.jour:6;
  const e=_bilanAncre(Number(der.date),freq,jour);
  return {echeance:e.getTime(),retardJours:_bilRetardJours(e.getTime(),maintenant),freq,jour,source:cad?'coach':'athlete'};
}
// PURE. « Ton coach a fixé : bilan chaque lundi, toutes les 2 semaines. »
function texteCadenceCoach(cad){
  const c=bilanCadenceValide(cad);
  if(!c) return '';
  return 'Ton coach a fixé : bilan chaque '+BILAN_JOURS[c.jour]+(c.freq===1?'.':', toutes les '+c.freq+' semaines.');
}
// PURE. Les questions du coach, nettoyées : 3 au plus, 120 caractères chacune.
function questionsCoachDe(u){
  const l=Array.isArray(u&&u.questionsCoach)?u.questionsCoach:Object.values((u&&u.questionsCoach)||{});
  return l.map(q=>String(q==null?'':q).replace(/\s+/g,' ').trim().slice(0,QUESTION_COACH_LONG)).filter(Boolean).slice(0,QUESTIONS_COACH_MAX);
}
// PURE. Le libellé d'une réponse : pour une question du coach, SA question,
// gardée dans le bilan (<clé>-q) au moment où l'athlète y a répondu.
function libelleQuestionBilan(q,b){
  const x=b&&b[q.k+'-q'];
  return (typeof x==='string'&&x.trim())?x.trim():q.lbl;
}

// ── Chez le coach : la fiche, puis la barre de sélection ─────────────────
function _htmlCadenceCoach(c){
  const cad=bilanCadenceValide(c&&c.bilanCadence);
  const e=echeanceBilan(c,Date.now());
  const opt=(v,lib,sel)=>'<option value="'+v+'"'+(sel?' selected':'')+'>'+lib+'</option>';
  const freqs=opt('','Au choix de l’athlète',!cad)+opt(1,'Chaque semaine',cad&&cad.freq===1)+opt(2,'Toutes les 2 semaines',cad&&cad.freq===2)+opt(4,'Toutes les 4 semaines',cad&&cad.freq===4);
  const jours=[1,2,3,4,5,6,0].map(j=>opt(j,BILAN_JOURS[j].charAt(0).toUpperCase()+BILAN_JOURS[j].slice(1),(cad?cad.jour:6)===j)).join('');
  const d=e.echeance?new Date(e.echeance).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}):'';
  const etat=!e.echeance?'Pas encore de bilan : la cadence partira du premier.'
    :e.retardJours>=1?'En retard de '+e.retardJours+' jour'+(e.retardJours>1?'s':'')+' (échéance du '+d+').'
    :e.retardJours===0?'Attendu aujourd’hui.':'Prochain bilan attendu le '+d+'.';
  const qs=questionsCoachDe(c);
  const champs=[0,1,2].map(i=>'<input class="bcad-q" id="bcad-q'+(i+1)+'" maxlength="'+QUESTION_COACH_LONG+'" value="'+escapeHtml(qs[i]||'')+'" placeholder="Question '+(i+1)+' (facultative)">').join('');
  return '<div class="bcad">'
    +'<div class="bcad-t">Cadence des bilans</div>'
    +'<div class="bcad-l"><select id="bcad-freq" aria-label="Fréquence">'+freqs+'</select>'
    +'<select id="bcad-jour" aria-label="Jour">'+jours+'</select></div>'
    +'<div class="bcad-d">'+escapeHtml(etat)+(cad?'':' Sans cadence, l’athlète choisit sa fréquence, le samedi.')+'</div>'
    +'<div class="bcad-t" style="margin-top:12px">Tes questions en fin de bilan</div>'
    +'<div class="bcad-d">Jusqu’à trois, 120 caractères chacune. Elles s’ajoutent à son prochain bilan de suivi.</div>'
    +champs
    +'<button type="button" class="btn btn-outline btn-sm bcad-b" onclick="ccdCadenceEnregistrer()">Enregistrer</button>'
    +'</div>';
}
// PURE (écrit dans c). La cadence et les questions lues dans le formulaire.
function _cadenceAppliquer(c,freq,jour,questions){
  const cad=bilanCadenceValide({freq:Number(freq),jour:Number(jour)});
  if(cad) c.bilanCadence=cad; else delete c.bilanCadence;
  if(questions!==undefined){
    const q=questionsCoachDe({questionsCoach:questions});
    if(q.length) c.questionsCoach=q; else delete c.questionsCoach;
  }
  c.updatedAt=Date.now();
  return c;
}
function ccdCadenceEnregistrer(){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const v=id=>(document.getElementById(id)||{}).value;
  const f=v('bcad-freq');
  _cadenceAppliquer(c,f===''?null:f,v('bcad-jour'),[1,2,3].map(i=>v('bcad-q'+i)||''));
  users[c.email]=c;
  const ok=DB.set('users',users);
  toastSync(ok,CLOUD.pushOne(c.email,c),'Cadence enregistrée '+ICO.coche,'la cadence est');
  try{ renderCalendrierBilansCoach(c); }catch(e){}
  return true;
}
// La barre de sélection : une cadence pour plusieurs athlètes d'un coup.
function selCadence(){
  if(!SEL_ATHLETES.size) return false;
  document.getElementById('modal-overlay')?.remove();
  const opt=(v,lib)=>'<option value="'+v+'">'+lib+'</option>';
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Cadence des bilans" class="bcad-feuille">'
    +'<div class="bcad-t">Cadence des bilans · '+SEL_ATHLETES.size+' athlète'+(SEL_ATHLETES.size>1?'s':'')+'</div>'
    +'<div class="bcad-l"><select id="bcad-m-freq" aria-label="Fréquence">'+opt('','Au choix de l’athlète')+opt(1,'Chaque semaine')+'<option value="2" selected>Toutes les 2 semaines</option>'+opt(4,'Toutes les 4 semaines')+'</select>'
    +'<select id="bcad-m-jour" aria-label="Jour">'+[1,2,3,4,5,6,0].map(j=>'<option value="'+j+'"'+(j===6?' selected':'')+'>'+BILAN_JOURS[j].charAt(0).toUpperCase()+BILAN_JOURS[j].slice(1)+'</option>').join('')+'</select></div>'
    +'<div class="bcad-d">L’échéance de chacun repart de son dernier bilan. Leurs questions de fin de bilan ne changent pas.</div>'
    +'<div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="closeModal()">Annuler</button>'
    +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="selCadenceAppliquer()">Enregistrer</button></div></div></div>');
  return true;
}
function selCadenceAppliquer(){
  const f=(document.getElementById('bcad-m-freq')||{}).value, j=(document.getElementById('bcad-m-jour')||{}).value;
  const users=DB.get('users')||{};
  const faits=[];
  for(const id of SEL_ATHLETES){
    const c=getOwnedClient(id,users);
    if(!c||c._fromCode) continue;
    _cadenceAppliquer(c,f===''?null:f,j);
    users[c.email]=c; faits.push(c);
  }
  const ok=DB.set('users',users);
  closeModal();
  toastSync(ok,Promise.all(faits.map(c=>CLOUD.pushOne(c.email,c))),'Cadence appliquée à '+faits.length+' athlète'+(faits.length>1?'s':'')+' '+ICO.coche,'la cadence est');
  try{ renderTodoBlock(getClients()); }catch(e){}
  return faits.length;
}

// EN RETARD dès le lendemain de l'échéance (echeanceBilan), et plus quatorze jours fixes.
function needsAlert(c,maintenant){
  if(!c.bilans?.length) return !!c.questionnaireComplete;
  const e=echeanceBilan(c,typeof maintenant==='number'?maintenant:Date.now());
  return e.retardJours!=null&&e.retardJours>=1;
}
// Le signal ne retombe plus a la simple OUVERTURE du bilan mais a l'ECRITURE
// d'une reponse. Consequence assumee : un bilan lu sans reponse reste en
// alerte. C'est le but — repondre sur WhatsApp ne laissait aucune trace, et
// l'athlete ne voyait jamais rien revenir.
// seenBilans reste ecrit par ailleurs : il sert encore a distinguer un bilan
// jamais ouvert d'un bilan lu, ce que la fiche client affiche.
// PURE. Le bilan le plus RÉCENT, choisi par sa DATE et non par sa position.
//
// Rien ne garantit que `bilans` soit trié : _mergeUser le trie, les écritures
// locales non. Prendre le dernier élément du tableau ferait dépendre un signal
// d’un ordre que personne ne maintient — et un tri qui se relâche éteindrait
// le signal sans que rien ne le dise.
function dernierBilan(c){
  const l=(c&&c.bilans)||[];
  let der=null, dDer=-Infinity;
  for(const b of l){
    if(!b) continue;
    const d=Number(b.date);
    const v=Number.isFinite(d)?d:-Infinity;
    if(!der||v>=dDer){ der=b; dDer=v; }
  }
  return der;
}
// LE SIGNAL PORTE SUR LE DERNIER BILAN, PAS SUR L’HISTORIQUE ENTIER.
//
// « un bilan quelconque sans réponse » ne retombait jamais : un bilan de
// février resté sans réponse gardait le badge allumé et l’athlète dans « À
// traiter » même après dix réponses. Un signal qui ne s’éteint pas cesse
// d’être lu — et la fiche athlète, elle, affichait « Actif » au même moment.
//
// Ce qui reste dû sur les bilans PLUS ANCIENS est compté par
// bilansSansReponse, qui mesure une charge de travail et non une nouveauté :
// les deux notions sont distinctes et le restent.
function hasNewBilan(c){
  if(!c.bilans?.length||c._fromCode) return false;
  const der=dernierBilan(c);
  // Répondu par écrit OU de vive voix (bilanRepondu).
  // Marqué traité (06/10/2026) : lu, sans réponse écrite voulue.
  if(!!der&&!bilanRepondu(der)&&!der.traite) return true;
  // BUILD 1863 : un bilan corrigé APRÈS la réponse, sur 60 jours, pas
  // seulement le dernier. Même prédicat pour le badge et « À traiter ».
  try{ return !!bilanCorrigeAVoir(c); }catch(e){ return false; }
}
// Athlète rattaché depuis plus de 3 jours qui n'a jamais rempli le moindre bilan.
// Utilisé à deux endroits (la ligne « À traiter » et urgencyScore) : un seul
// prédicat pour que le tri de la liste et l'alerte ne puissent pas diverger.
// createdAt absent (comptes antérieurs au champ) → traité comme ancien, donc signalé.
function neverStarted(c){
  return !c._fromCode&&!(c.bilans||[]).length&&(Date.now()-(c.createdAt||0))>3*864e5;
}

// ══════════ TROISIEME LISTE : « JAMAIS DEMARRE » ═══════════════════════
//
// ⚠ TROIS LISTES, TROIS NATURES, AUCUNE FUSION.
//   « A traiter »   — ce qui demande une decision : sante, bilans, acces.
//   « A relancer »  — l'assiduite, et elle seule (ecran s-coach-file).
//   « Jamais demarre » — celle-ci. Un athlete sans UNE SEULE seance n'a pas
//                    d'assiduite : il n'a rien dont on puisse mesurer le
//                    relachement. Il n'apparaissait donc nulle part.
//
// ET SURTOUT PAS DANS neverStarted, JUSTE AU-DESSUS. Celui-la compte les
// BILANS, pas les seances : un athlete qui a rempli son bilan de depart et
// n'a jamais ouvert une seance en sort — c'est exactement le trou. Les deux
// predicats se ressemblent et ne disent pas la meme chose ; ils restent
// separes, et aucune ligne de l'un n'est reecrite pour servir l'autre.
//
// CE QUE CETTE LISTE NE REGARDE PAS : la douleur, les drapeaux, l'assiduite,
// les programmes, le statut d'acces. Un seul fait — aucune seance — et un
// seul delai.
const JAMAIS_DEMARRE_DELAI=48*3600e3;

// PURE. La date d'entree de cet athlete dans le portefeuille du coach.
//
// ⚠ IL N'EXISTE AUCUNE DATE DE RATTACHEMENT DANS LE SCHEMA. Verifie le
// 15/09/2026 : ni linkToCoach, ni la consommation de code, ni le lien RCLINK
// n'ecrivent quand le lien s'est fait. `createdAt` est donc le seul repere
// disponible — et pour la grande majorite c'est le meme instant, un athlete
// se rattachant au moment ou il cree son compte.
// `coachSince` est lu D'ABORD pour que le jour ou ce champ existera, cette
// fonction devienne exacte sans qu'on y retouche. L'ecrire releverait du
// parcours ATHLETE, jamais du coach : le coach n'ecrit pas dans ce dossier.
function dateRattachement(c){
  if(!c) return 0;
  const s=Number(c.coachSince)||0;
  return s||Number(c.createdAt)||0;
}
/**
 * PURE. Le rang d'arrivee de cet athlete dans le portefeuille du coach, du
 * plus ancien au plus recent. Rend 0 quand la question n'a pas de sens.
 *
 * Kevin, 20/09/2026 : « mets "athlete n°__ : Kevin Guellec" selon son
 * arrivee ». Le rang se lit sur la carte d'identite, en tete de sa fiche.
 *
 * ⚠ LE RANG EST CALCULE, PAS STOCKE, et c'est un choix. Un numero ecrit dans
 *   le dossier serait plus stable — mais il faudrait l'attribuer a
 *   l'inscription, donc le faire exister pour les athletes deja la, donc
 *   deviner leur rang. Le calcul le donne tout de suite et pour tout le monde,
 *   au prix d'une consequence assumee : un athlete qui quitte le portefeuille
 *   fait remonter d'un cran tous ceux arrives apres lui.
 *
 * ⚠ LES INVITATIONS PAS ENCORE CONSOMMEES N'EN ONT PAS. Un code n'est arrive
 *   nulle part. Lui donner un rang aurait decale tout le monde le jour ou il
 *   expire sans etre utilise — et aurait numerote quelqu'un qui n'existe pas.
 *
 * ⚠ L'EGALITE SE TRANCHE PAR L'ADRESSE, et pas au hasard. Deux comptes creees
 *   dans la meme milliseconde — deux imports, une restauration — auraient
 *   sinon echange leurs numeros d'un rendu a l'autre, sous les yeux du coach.
 * @param {any} c          le dossier de l'athlete
 * @param {any[]} [clients] le portefeuille, si on l'a deja sous la main
 * @returns {number} le rang a partir de 1, ou 0
 */
function rangArrivee(c,clients){
  if(!c||c._fromCode) return 0;
  let liste=clients;
  if(!Array.isArray(liste)){ try{ liste=getClients(); }catch(e){ liste=[]; } }
  const vrais=(liste||[]).filter(x=>x&&!x._fromCode);
  vrais.sort((a,b)=>(dateRattachement(a)-dateRattachement(b))
    ||String(a.email||a.id||'').localeCompare(String(b.email||b.id||'')));
  const clef=x=>String((x&&(x.id||x.email))||'');
  const moi=clef(c);
  if(!moi) return 0;
  const i=vrais.findIndex(x=>clef(x)===moi);
  return i<0?0:i+1;
}
// PURE. Le nombre de jours REVOLUS depuis le rattachement.
function joursDepuisRattachement(c,maintenant){
  const d=dateRattachement(c);
  const t=Number(maintenant)||0;
  if(!d||!t||t<d) return 0;
  return Math.floor((t-d)/864e5);
}
// PURE. Le critere, et rien d'autre : rattache depuis plus de 48 h, aucune
// seance.
//
// ⚠ UNE DOULEUR OU UN DRAPEAU ROUGE N'ARRIVE JAMAIS ICI. Les deux gardent
// leur ligne dans « A traiter », qui est le seul endroit d'ou le coach ne
// peut pas les reporter d'un clic. Un drapeau se declare au questionnaire,
// donc SANS avoir jamais pose une seance : l'exclusion mord pour de vrai, et
// elle n'est pas decorative. Une douleur, elle, se declare en seance et ne
// peut pas coexister avec « aucune seance » — on l'ecarte quand meme, pour
// que la regle soit vraie par construction et non par chance.
//
// `_fromCode` EST EXCLU, et c'est important : ces dossiers-la sont des
// pastilles fabriquees par getClients depuis un code, avec `sessions:[]` pose
// en dur. Leur tableau vide n'est pas un fait, c'est un remplissage — les
// compter dirait « n'a jamais demarre » d'athletes qui s'entrainent peut-etre
// depuis un mois sur leur propre telephone. neverStarted les ecarte pour la
// meme raison.
function jamaisDemarre(c,maintenant){
  if(!c||c._fromCode||c.role==='coach') return false;
  if((c.sessions||[]).length) return false;
  try{ if(drapeauQuelconqueActif(c)) return false; }catch(e){}
  try{ const sg=signauxEntrainement(c); if(sg&&(sg.douleur||sg.douleurDiffuse)) return false; }catch(e){}
  const d=dateRattachement(c);
  const t=Number(maintenant)||0;
  if(!d||!t) return false;
  // Le réglage du coach (Réglages de coaching), 48 h d'origine.
  return (t-d)>seuilSignal('jamaisDemarreH')*3600e3;
}
// ══════════════ QUATRIEME LISTE : « INACTIFS » ═════════════════════════
//
// Demande de Kevin, 16/09/2026 : « les personnes inactives, ne les fais pas
// apparaitre dans les ronds ni dans la liste de mes athletes, mais seulement
// dans une liste en bas de page ».
//
// ⚠ QUATRE LISTES, QUATRE NATURES, TOUJOURS AUCUNE FUSION. Celle-ci s'insere
// entre « A traiter » et « Jamais demarre », et elle ne recouvre NI l'une NI
// l'autre :
//   « En attente »      — le compte n'existe pas encore (_fromCode).
//   « Jamais demarre »  — le compte existe, aucune seance n'a jamais ete posee.
//   « Inactifs »        — celle-ci. Le compte existe, l'athlete a DEJA pose au
//                         moins une seance, et plus rien depuis quatorze jours.
//
// LA SEANCE EST LA CONDITION D'ENTREE, et c'est elle qui rend les trois listes
// disjointes. Sans elle, tout athlete endormi aurait figure a la fois ici et
// dans « Jamais demarre » — deux lignes pour une personne, dans deux cadres qui
// disent deux choses differentes.
//
// ⚠ ET C'EST POURQUOI UN DRAPEAU ROUGE SANS SEANCE NE DISPARAIT PAS DE L'ECRAN.
// jamaisDemarre ecarte deja les drapeaux et les douleurs — ils restent dans
// « A traiter », le seul endroit d'ou le coach ne peut pas les reporter d'un
// clic. Si « inactif » avait accepte les dossiers sans seance, un athlete a
// drapeau rouge serait sorti de la grille sans entrer dans aucune des listes du
// bas : il aurait simplement cesse d'exister a l'ecran. La condition « au moins
// une seance » l'empeche par construction.
//
// QUATORZE JOURS, LE MEME DELAI QUE isActive, et ce n'est pas une coincidence :
// la puce « Actifs 14 j » de la barre de portefeuille compte exactement le
// complement. Deux delais differents pour la meme idee auraient fini par
// afficher « 8 actifs » au-dessus d'une liste de neuf.
const INACTIF_DELAI=14*864e5;
// PURE. Le dernier signe de vie : une seance, ou un bilan. PAS createdAt —
// isActive le compte, et il le doit, pour qu'un compte tout neuf ne soit pas
// declare mort avant d'avoir servi. Ici c'est l'inverse qu'on cherche : un
// compte neuf n'a pas de seance, il ne peut donc pas entrer dans cette liste,
// et compter sa date de creation n'aurait servi qu'a rajeunir indefiniment un
// dossier qui dort.
function dernierSigneDeVie(c){
  if(!c) return 0;
  const s=(c.sessions||[]).reduce((m,x)=>Math.max(m,(x&&Number(x.date))||0),0);
  const b=(c.bilans||[]).reduce((m,x)=>Math.max(m,(x&&Number(x.date))||0),0);
  return Math.max(s,b);
}
// PURE. Le critere, et rien d'autre : un compte, au moins une seance, et plus
// rien depuis quatorze jours.
function inactif(c,maintenant){
  if(!c||c._fromCode||c.role==='coach') return false;
  if(!(c.sessions||[]).length) return false;   // « jamais demarre » : autre liste
  const d=dernierSigneDeVie(c);
  const t=Number(maintenant)||0;
  if(!d||!t||t<d) return false;
  // Le réglage du coach (Réglages de coaching), 14 jours d'origine.
  return (t-d)>seuilSignal('inactifJours')*864e5;
}
// PURE. Du plus endormi au moins endormi : celui qu'on n'a pas vu depuis deux
// mois passe avant celui qui manque depuis quinze jours.
function listeInactifs(clients,maintenant){
  return (clients||[]).filter(c=>inactif(c,maintenant))
    .sort((a,b)=>dernierSigneDeVie(a)-dernierSigneDeVie(b));
}
// PURE. Le nombre de jours REVOLUS depuis le dernier signe de vie.
function joursDepuisSigne(c,maintenant){
  const d=dernierSigneDeVie(c);
  const t=Number(maintenant)||0;
  if(!d||!t||t<d) return 0;
  return Math.floor((t-d)/864e5);
}
// PURE. « En attente d'inscription » : quelqu'un que le coach a rattache par un
// code et qui n'a PAS encore cree son compte. C'est la SEULE famille que la
// grille de vignettes et la liste d'athletes laissent en bas de page.
//
// ⚠ « JAMAIS DEMARRE » N'EST PLUS DORMANT. Demande de Kevin, 18/09/2026 :
// remonter dans les ronds les gens qui se sont connectes, meme sans avoir
// commence a utiliser l'app, des lors qu'ils ont AU MOINS fait leur compte ;
// seuls ceux qui n'ont pas encore de compte restent en bas.
// Un compte cree EST une presence : la personne est entree, elle a un visage,
// un prenom et un age, et c'est precisement le moment ou le coach peut encore
// faire quelque chose. La masquer jusqu'a sa premiere seance revenait a la
// rendre invisible pendant la seule fenetre qui compte.
//
// LE DOUBLON EST ASSUME. Elle garde sa ligne dans le cadre « Jamais demarre »
// du bas, qui porte le bouton de relance et le nombre de jours depuis le
// rattachement — rien de tout cela ne tient dans un rond. Mieux vaut une
// arrivee sans premiere seance affichee deux fois qu'une seule, tout en bas.
//
// ⚠ L'INACTIF AUSSI REMONTE, DEPUIS LE 19/09/2026. La version du 18/09 le
// gardait en bas, en distinguant « qui n'a pas commence » de « qui s'est
// arrete ». Kevin a tranche le lendemain, devant la grille : « fais apparaitre
// tous les athletes qui ont cree leur compte, juste ne mets pas ceux en
// attente ». La distinction etait juste en soi, mais elle repondait a une
// autre question. La grille ne demande pas « qui dois-je regarder
// aujourd'hui » — les trois cadres du bas et « Mes notifications » s'en
// chargent. Elle demande « qui sont mes athletes », et quelqu'un qui s'est
// arrete en fait toujours partie : c'est meme souvent celui qu'on cherche.
//
// IL N'EN RESTE DONC QU'UNE FAMILLE DEHORS : l'invitation non honoree. Pas de
// dossier, pas de seance, pas de photo — son rond serait vide, sous un nom que
// personne ne porte encore.
//
// LE DOUBLON EST ASSUME, et il l'etait deja : jamais demarre comme inactif
// gardent leur ligne dans leur cadre du bas, qui porte le bouton de relance et
// le nombre de jours depuis le dernier signe. Rien de tout cela ne tient dans
// un rond.
//
// LE MEME PREDICAT SERT LA PUCE « En attente » ET CETTE EXCLUSION, et ce n'est
// pas un detail : ce que l'une cache, l'autre le montre. Les ecrire deux fois,
// c'etait se donner rendez-vous pour les voir diverger — la puce annoncant un
// nombre, la liste en montrant un autre.
function _enAttenteInscription(c){
  return !!(c&&(c._fromCode||!c.email));
}
// PURE. La liste, du plus ancien rattachement au plus recent : celui qui
// attend depuis douze jours passe avant celui qui attend depuis trois.
function listeJamaisDemarre(clients,maintenant){
  return (clients||[]).filter(c=>jamaisDemarre(c,maintenant))
    .sort((a,b)=>dateRattachement(a)-dateRattachement(b));
}
// PURE. Le brouillon propose au coach. Un BROUILLON : il s'ouvre dans la
// fenetre de redaction, il ne part pas tout seul, et le coach le reecrit s'il
// veut. Le prenom est insere tel quel — c'est la fenetre de redaction qui
// echappe, pas cette fonction, qui rend du texte et non du HTML.
function brouillonJamaisDemarre(c){
  const p=String((c&&c.fname)||'').trim();
  return 'Salut '+(p||'toi')+', j’ai vu que tu n’as pas encore lancé ta '
    +'première séance. Dis-moi ce qui bloque, on règle ça en deux minutes.';
}
// PURE. La carte, ou la chaine VIDE quand personne n'est concerne — jamais un
// cadre vide annoncant zero. Une liste de relance qui s'affiche a zero devient
// du decor, et on cesse de la lire le jour ou elle dit quelque chose.
//
// LE GRIS ET NON LE ROUGE. Ce n'est pas une alerte : personne n'a mal, rien
// n'est en retard. C'est une relance commerciale, et la peindre comme « A
// traiter » lui volerait l'attention que la sante doit garder.
/**
 * Le geste « Relancer » d'une carte : les deux canaux directs, pour UNE
 * personne.
 *
 * ⚠ CE CHEMIN NE PASSE PAS PAR LE TUNNEL COMMERCIAL, ET C'EST DELIBERE. Le
 *   tunnel compte les gens qui n'ont JAMAIS utilise leur acces
 *   (`tunnelPersonnes` ecarte tout nom deja inscrit) ; ceux-ci ont ouvert un
 *   compte. Brancher le bouton sur `tunnelRelancer` aurait ecrit des relances
 *   dans un dossier que `tunnelListe` ne rend jamais — le coach aurait
 *   enregistre dans le vide — et la quatrieme aurait DESACTIVE le code d'un
 *   athlete deja inscrit, donc ferme la porte a quelqu'un qui est deja entre.
 *
 * ⚠ ET IL NE PASSE PAS NON PLUS PAR LE CANAL. Le canal est lu par tous les
 *   athletes suivis : une relance s'adresse a une personne. C'est la regle
 *   posee le 19/09/2026, elle ne bouge pas parce que la carte a change de
 *   forme.
 * @param {string} id  l'identifiant de l'athlete
 */
function jdRelancer(id){
  const c=(getClients()||[]).find(x=>x&&String(x.id)===String(id));
  if(!c){ toast('Athlète introuvable','var(--orange)'); return false; }
  const k=canauxRelanceJamaisDemarre(c);
  const nom=String(((c.fname||'')+' '+(c.lname||'')).trim())||'cet athlète';
  const lien=(href,lib)=>'<a href="'+_safeContactUrl(href)+'" target="_blank" rel="noopener" '
    +'class="btn btn-blanc btn-sm" style="flex:1;margin:0;min-height:46px;display:flex;'
    +'align-items:center;justify-content:center">'+lib+'</a>';
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">'
  +'<h2 style="margin-bottom:4px">Relancer</h2>'
  +'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:14px">'+escapeHtml(nom)
  +' · compte créé, aucune séance</div>'
  // NI NUMERO NI ADRESSE : on le DIT. Deux boutons qui n'ouvrent rien feraient
  // croire a une panne, et le coach cliquerait deux fois avant de comprendre
  // que le manque est dans la fiche de l'athlete.
  +((k.wa||k.mail)
    ?'<div style="display:flex;gap:8px;margin-bottom:12px">'
      +(k.wa?lien(k.wa,'WhatsApp'):'')+(k.mail?lien(k.mail,'Mail'):'')+'</div>'
      +'<p class="sub" style="font-size:var(--fs-2xs);line-height:1.55;margin:0 0 14px">'
      +'Le message s’ouvre pré-rédigé et modifiable dans l’application choisie. '
      +'C’est toi qui appuies sur envoyer : RepCore n’envoie rien à ta place.</p>'
    :'<p class="sub" style="font-size:var(--fs-xs);line-height:1.6;margin:0 0 14px">'
      +'Cette fiche ne porte ni numéro ni adresse : RepCore ne peut ouvrir aucun '
      +'message. Ajoute-les depuis le profil de l’athlète.</p>')
  +'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:0;min-height:44px" '
  +'onclick="closeModal()">Fermer</button>'
  +'</div></div>');
  return true;
}
function _htmlJamaisDemarre(liste,maintenant){
  const l=liste||[];
  if(!l.length) return '';
  const n=l.length;
  // HUIT RECTANGLES OUVERTS, LE RESTE REPLIE. Demande de Kevin, et c'est aussi
  // la regle deja posee pour « Mes notifications » : une carte d'accueil qui
  // deroule treize dossiers n'oriente plus rien.
  //
  // ⚠ REPLIE, ET NON RENVOYE AILLEURS. Le surplus se deplie SUR PLACE parce
  //   qu'aucun autre ecran ne montre cette population : le Tunnel commercial
  //   compte les gens qui n'ont JAMAIS utilise leur acces, et ceux-ci ont
  //   ouvert un compte. Un bouton « voir tout le tunnel » aurait mene a un
  //   ecran ou aucun d'eux ne figure.
  // TROIS DEPUIS LE 30/09/2026 : le cadre est remonté sous « À traiter », replié
  // à trois noms (CADRE_REPLIE_MAX), le reste à un geste.
  const MAX=CADRE_REPLIE_MAX;
  const reste=Math.max(0,n-MAX);
  const jour=t=>{ if(!t) return '-'; const q=new Date(t), p=x=>String(x).padStart(2,'0');
    return p(q.getDate())+'/'+p(q.getMonth()+1)+'/'+q.getFullYear(); };
  return '<div style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-left:3px solid var(--sub);border-radius:var(--r-3);margin-bottom:20px;'
    // ⚠ L'ESPACE AU-DESSUS, demande par Kevin : le bandeau « Jamais démarré »
    //   touchait le pied du cadre precedent, et les deux se lisaient comme un
    //   seul bloc dont on ne voyait plus la couture.
    +'margin-top:24px;'
    +'overflow:hidden;box-shadow:var(--e2)">'
    +'<div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;'
    +'gap:10px;background:var(--surface-2);border-bottom:1px solid var(--border)">'
    +'<span style="font-size:13px;font-weight:800;color:var(--text-strong);text-transform:uppercase;'
    +'letter-spacing:2.4px">Jamais démarré</span>'
    +'<span style="background:var(--surface-1);border:1px solid var(--border);color:var(--text);'
    +'font-size:14px;font-weight:400;padding:1px 10px;border-radius:var(--r-3);'
    +'font-family:var(--pile-titre);letter-spacing:1px">'+n+'</span>'
    +'</div>'
    +'<div class="jd-grille">'
    +l.map((c,rang)=>{
      const j=joursDepuisRattachement(c,maintenant);
      // XSS STOCKE : le prenom est saisi par l'athlete et atterrit dans le
      // tableau de bord de son coach. Meme precaution que renderTodoBlock, et
      // pour la meme raison — le defaut y avait ete trouve en testant des
      // prenoms hostiles.
      const nom=escapeHtml(String(((c.fname||'')+' '+(c.lname||'')).trim())||'Athlète');
      // LA DATE DE CREATION DU COMPTE, demandee explicitement. Ces gens SE SONT
      // INSCRITS — c'est ce qui les separe de « En attente » juste en dessous —
      // et la date qui les concerne est celle de leur compte, pas celle du code
      // qu'ils ont deja consomme.
      return '<div class="jd-carte'+(rang>=MAX?' jd-plus" hidden':'"')+'>'
        +'<div><div class="jd-nom" title="'+nom+'">'+nom+'</div>'
        +'<div class="jd-date">Compte créé<br>le '+jour(dateRattachement(c))
        +'<br>il y a '+j+' jour'+(j>1?'s':'')+'</div></div>'
        +'<div class="jd-cmd">'
        // UN SEUL GESTE, ET IL EST ROUGE. Demande de Kevin : c'est la seule
        // chose a faire pour quelqu'un qui a un compte et ne s'en sert pas.
        +'<button type="button" class="btn btn-red btn-sm" onclick="jdRelancer(\''+escapeHtml(String(c.id||''))+'\')">Relancer</button>'
        +'</div></div>';
    }).join('')
    +'</div>'
    +(reste?'<button type="button" onclick="jdVoirTout(this)" style="display:block;width:100%;background:none;border:none;'
      +'border-top:1px solid var(--border);color:var(--red-text);font-family:Montserrat,sans-serif;'
      +'font-size:var(--fs-2xs);font-weight:800;letter-spacing:1px;text-transform:uppercase;'
      +'cursor:pointer;padding:12px 14px;min-height:42px;text-align:left">Voir tout ('+n+')</button>':'')
    +'<div class="sub" style="font-size:var(--fs-2xs);line-height:1.55;padding:2px 14px 12px">'
    +'« Relancer » ouvre le message pré-rédigé, en WhatsApp ou par mail. RepCore n’envoie rien à ta place.'
    +'</div></div>';
}
// ⚠ AUCUN ENVOI, POUR LES DEUX CADRES. Les boutons OUVRENT WhatsApp ou le
// client mail avec le texte dedans, modifiable ; rien ne part tant que le
// coach n'a pas appuye sur « envoyer » lui-meme. Et aucun des deux chemins
// n'ecrit dans le dossier de l'athlete : ce sont des liens, pas des ecritures.
// ══ LE CADRE « INACTIFS » ═════════════════════════════════════════════════
//
// PURE. Le brouillon propose au coach. Un BROUILLON : il ouvre WhatsApp ou le
// client mail avec le texte dedans, modifiable, et rien ne part tant que le
// coach n'a pas appuye sur « envoyer » lui-meme.
//
// ⚠ AUCUN REPROCHE, ET C'EST UNE REGLE DU PRODUIT, pas une preference de ton.
// Le message ne dit pas « tu n'as rien fait depuis un mois » : il demande ce
// qui bloque et propose d'ajuster. Un athlete qui s'arrete a une raison, et
// elle est rarement la paresse.
//
// ⚠ ET IL NE PORTE AUCUNE DONNEE DE SANTE. Il parle de SEANCES et de temps, ni
// de poids, ni de douleur, ni de bilan — meme discipline que messageRelance et
// que le message d'acces qui expire.
function brouillonInactif(c,maintenant){
  const p=String((c&&c.fname)||'').trim();
  const j=joursDepuisSigne(c,maintenant||Date.now());
  // Le nombre de jours n'est dit QUE s'il est connu. « depuis 0 jour » serait
  // du bruit, et inventer une duree serait pire.
  const depuis=j>0?(' depuis '+j+' jour'+(j>1?'s':'')):'';
  return 'Salut '+(p||'toi')+', je n’ai pas vu de séance de ton côté'+depuis+'. '
    +'Aucun reproche, je veux juste savoir ce qui bloque : le temps, le '
    +'programme, la motivation ? Dis-moi, on ajuste ensemble.';
}
// Les objets de mail. Courts, et sans point d'interrogation anxieux dans la
// boite de reception.
// ══════════════ LE TUNNEL COMMERCIAL ═══════════════════════════════════════
//
// Relancer les gens qui ont RECU un acces et ne s'en sont jamais servis. Ce
// n'est pas de l'assiduite — ceux-la ne se sont pas arretes, ils n'ont jamais
// commence — et ce n'est pas du coaching : c'est du commercial, et ca se suit
// comme tel.
//
// ══ OU VIT LA DONNEE, ET POURQUOI LA ═══════════════════════════════════════
//
// DANS L'ENTREE DU CODE, `currentUser.studentCodes[i].crm`. Pas dans un noeud
// neuf, pas dans le dossier de l'athlete — qui n'existe pas encore, c'est tout
// le sujet. Trois raisons, et elles se cumulent :
//   • LE CODE EST DEJA LA SOURCE DE VERITE de cette population. getClients
//     fabrique les profils `_code_…` a partir de lui ; le tunnel compte donc
//     exactement les memes personnes, sans second predicat a faire diverger.
//   • IL SE SYNCHRONISE DEJA. `studentCodes` est dans la liste des champs
//     pousses du dossier coach : le tunnel suit le coach d'un appareil a
//     l'autre sans une ligne de reseau de plus.
//   • LA DESACTIVATION EST AU MEME ENDROIT. La quatrieme relance ferme le
//     code ; le compteur qui l'a declenchee et le drapeau `active` qu'elle
//     baisse sont deux champs voisins du meme objet.
//
// ⚠ AUCUNE DONNEE N'EST DETRUITE QUAND LE TUNNEL SE TERMINE. Le code passe a
//   `active:false` — l'acces ne s'ouvre plus — mais l'entree reste, avec ses
//   quatre relances, leurs canaux, leurs notes et leurs dates. Un dossier
//   commercial ferme reste un dossier commercial.
//
// ══ RETROCOMPATIBILITE ═════════════════════════════════════════════════════
//
// AUCUNE MIGRATION N'EST ECRITE, ET C'EST VOULU. `tunnelCrm` rend un objet
// complet pour une entree qui n'a jamais vu le tunnel : zero relance, aucune
// echeance, dossier ouvert. Un code cree il y a six mois entre donc dans le
// tunnel a 0/4 sans qu'on ait touche a un seul enregistrement — et un code
// qu'on n'ouvre jamais ne se voit jamais reecrit. Une migration aurait reecrit
// tous les dossiers coach pour y poser des objets vides.

/** Quatre relances, et c'est fini. La quatrieme ferme l'acces. */
const TUNNEL_MAX=4;
/**
 * PURE. Le statut commercial, DEDUIT du nombre de relances et de rien
 * d'autre. Il ne se regle pas a la main : deux coachs qui l'ajusteraient
 * chacun au juge ne compareraient plus rien.
 * @param {number} n  relances effectuees
 * @returns {'chaud'|'tiede'|'froid'|'fin'}
 */
function tunnelStatut(n){
  const k=Math.max(0,Math.min(TUNNEL_MAX,Math.round(Number(n)||0)));
  if(k>=TUNNEL_MAX) return 'fin';
  if(k>=3) return 'froid';
  if(k>=2) return 'tiede';
  return 'chaud';
}
/** Les libelles et les couleurs des quatre statuts, en un seul endroit. */
const TUNNEL_LIB=Object.freeze({
  chaud:{lib:'Chaud',c:ROUGE_MARQUE},
  tiede:{lib:'Tiède',c:'#f5a524'},
  froid:{lib:'Froid',c:'#4DA3FF'},
  fin:{lib:'Fin du tunnel',c:'#8a8a8a'}});
/**
 * Les quatre canaux. `reel` dit si l'application sait VRAIMENT ouvrir l'envoi
 * — un lien WhatsApp ou un mailto pre-rempli — ou si elle ne fait
 * qu'enregistrer ce que le coach a fait de son cote. Voir tunnelValider : on
 * n'ecrit jamais « envoye » quand rien n'est parti.
 */
const TUNNEL_CANAUX=Object.freeze([
  {cle:'whatsapp',lib:'WhatsApp',reel:true},
  {cle:'email',   lib:'Email',   reel:true},
  {cle:'tel',     lib:'SMS / téléphone',reel:false},
  {cle:'push',    lib:'Notification RepCore',reel:false}]);
/**
 * PURE. Le dossier commercial d'une entree de code, TOUJOURS complet — une
 * entree qui n'a jamais vu le tunnel rend un dossier vierge plutot que null.
 * C'est ce qui rend la migration inutile.
 * @param {any} code  une entree de currentUser.studentCodes
 * @returns {{relances:any[], prochaine:number|null, termineLe:number|null}}
 */
function tunnelCrm(code){
  const k=(code&&code.crm&&typeof code.crm==='object')?code.crm:{};
  const l=Array.isArray(k.relances)?k.relances:[];
  // ⚠ BORNE A QUATRE A LA LECTURE AUSSI. Un dossier venu du reseau avec cinq
  //   relances — appareil en retard, reprise de sauvegarde — ne doit pas faire
  //   dire « 5/4 » ni sortir des quatre statuts.
  const relances=l.filter(x=>x&&typeof x==='object').slice(0,TUNNEL_MAX);
  const p=Number(k.prochaine);
  const t=Number(k.termineLe);
  return {relances,
    prochaine:(isFinite(p)&&p>0)?p:null,
    termineLe:(isFinite(t)&&t>0)?t:null};
}
/**
 * PURE. L'etat de l'echeance : rien de prevu, a venir, aujourd'hui, ou en
 * retard. Le jour se compare en JOURS CIVILS et non en millisecondes — une
 * relance prevue ce matin a 9 h n'est pas « en retard » a 10 h, elle est
 * d'aujourd'hui.
 * @param {number|null} prochaine
 * @param {number} maintenant
 * @returns {'aucune'|'avenir'|'aujourdhui'|'retard'}
 */
function tunnelEcheance(prochaine,maintenant){
  if(!prochaine) return 'aucune';
  const t=Number(maintenant)||Date.now();
  const j=x=>{ const q=new Date(x); return new Date(q.getFullYear(),q.getMonth(),q.getDate()).getTime(); };
  const jp=j(prochaine), jt=j(t);
  if(jp<jt) return 'retard';
  if(jp===jt) return 'aujourdhui';
  return 'avenir';
}
/**
 * PURE. Les personnes du tunnel, telles qu'on les affiche.
 *
 * ⚠ LE MEME PREDICAT DE POPULATION QUE getClients, a la lettre : un code dont
 *   l'eleve s'est inscrit n'est plus dans le tunnel, il est dans la liste des
 *   athletes. La liste des inscrits est passee en argument plutot que lue ici,
 *   pour que cette fonction reste PURE et testable hors application.
 *
 * ⚠ LES CODES DESACTIVES RESTENT, contrairement a getClients qui les ecarte.
 *   C'est le tunnel qui les a fermes a la quatrieme relance : les faire
 *   disparaitre effacerait le dossier commercial au moment precis ou il est
 *   complet. Ils sortent de la liste ACTIVE par `fini`, pas de la donnee.
 * @param {any} u  le dossier du coach
 * @param {any[]} athletes  ses athletes inscrits
 * @param {number} maintenant
 * @returns {any[]}
 */
function tunnelPersonnes(u,athletes,maintenant){
  const t=Number(maintenant)||Date.now();
  const inscrits=new Set((athletes||[]).filter(Boolean)
    .map(a=>((a.fname||'')+' '+(a.lname||'')).toLowerCase().trim()).filter(Boolean));
  const mails=new Set((athletes||[]).filter(Boolean)
    .map(a=>String(a.email||'').toLowerCase()).filter(Boolean));
  const out=[];
  for(const c of ((u&&u.studentCodes)||[])){
    if(!c||!c.codeId) continue;
    const nom=String(c.studentName||'').toLowerCase().trim();
    // DEJA INSCRIT : il a utilise son acces, il n'a plus rien a faire ici.
    if(nom&&inscrits.has(nom)) continue;
    if(!nom&&c.athleteEmail&&mails.has(String(c.athleteEmail).toLowerCase())) continue;
    const k=tunnelCrm(c);
    const n=k.relances.length;
    const fini=n>=TUNNEL_MAX;
    const libelle=String(c.studentName||c.usedBy||c.athleteEmail||'Élève sans nom').trim();
    out.push({
      codeId:c.codeId, code:c, id:'_code_'+c.codeId,
      fname:libelle.split(' ')[0],
      lname:libelle.split(' ').slice(1).join(' '),
      nom:libelle,
      email:String(c.athleteEmail||''),
      tel:String(c.athletePhone||c.phone||''),
      photo:String(c.athletePhoto||''),
      nb:n, statut:tunnelStatut(n), fini,
      derniere:n?(Number(k.relances[n-1].date)||0):0,
      prochaine:k.prochaine,
      // UN DOSSIER TERMINE N'A PLUS D'ECHEANCE : laisser « en retard » sur
      // quelqu'un qu'on ne relancera plus le ferait remonter chaque jour.
      echeance:fini?'aucune':tunnelEcheance(k.prochaine,t),
      actif:c.active!==false,
      relances:k.relances, termineLe:k.termineLe,
      ajouteLe:Number(c.createdAt)||0});
  }
  return out;
}
/**
 * PURE. Le resume affiche sur l'accueil et en tete du tunnel. Les dossiers
 * termines sont comptes A PART : ils ne sont plus a relancer, et les melanger
 * au total ferait annoncer douze personnes pour trois a traiter.
 * @param {any[]} liste
 * @returns {any}
 */
function tunnelResume(liste){
  const l=(liste||[]).filter(Boolean);
  const actifs=l.filter(p=>!p.fini);
  return {
    total:actifs.length,
    chauds:actifs.filter(p=>p.statut==='chaud').length,
    tiedes:actifs.filter(p=>p.statut==='tiede').length,
    froids:actifs.filter(p=>p.statut==='froid').length,
    aujourdhui:actifs.filter(p=>p.echeance==='aujourdhui').length,
    retard:actifs.filter(p=>p.echeance==='retard').length,
    termines:l.length-actifs.length};
}
/**
 * PURE. La phrase de l'accueil. Elle dit ce qu'il y a A FAIRE, pas ce qu'il y
 * a en stock : « 12 personnes » ne fait pas ouvrir un ecran, « 3 relances
 * aujourd'hui » si.
 * @param {any} r  un resume
 * @returns {string}
 */
function tunnelPhrase(r){
  const du=(r.aujourdhui||0)+(r.retard||0);
  if(!r.total){
    return r.termines
      ? ('Personne à relancer · '+r.termines+' dossier'+(r.termines>1?'s':'')+' terminé'+(r.termines>1?'s':''))
      : 'Personne à relancer.';
  }
  if(!du) return 'Aucune relance à effectuer.';
  const bouts=[];
  if(r.retard) bouts.push(r.retard+' en retard');
  if(r.aujourdhui) bouts.push(r.aujourdhui+' aujourd’hui');
  return du+' relance'+(du>1?'s':'')+' à effectuer : '+bouts.join(' · ')+'.';
}

// ══ LES GESTES DU TUNNEL ═══════════════════════════════════════════════════

/** L'entree de code d'une personne du tunnel, ou null. */
function _tunnelCode(codeId){
  if(!currentUser) return null;
  return ((currentUser.studentCodes)||[]).find(c=>c&&c.codeId===codeId)||null;
}
/** Ecrit le dossier coach et le pousse. Un seul chemin pour les trois gestes. */
function _tunnelEcrire(){
  currentUser.updatedAt=Date.now();
  const users=DB.get('users')||{};
  users[currentUser.email]=currentUser;
  const ok=DB.set('users',users);
  try{ DB.set('session',currentUser); }catch(e){}
  return {ok,envoi:CLOUD.pushOne(currentUser.email,currentUser)};
}
/**
 * ⚠ LE VERROU CONTRE LE DOUBLE APPUI. Une relance s'ecrit, se pousse au
 *   reseau, et ferme parfois un code a distance : entre le premier appui et le
 *   rendu qui suit, il y a de la place pour un second. Sans ce verrou, deux
 *   appuis rapides faisaient passer quelqu'un de 2/4 a 4/4 — et fermaient son
 *   acces deux relances trop tot.
 *   UN VERROU PAR PERSONNE, et non un verrou global : le coach qui enchaine
 *   trois relances sur trois personnes differentes ne doit pas attendre.
 */
const _tunnelEnCours=new Set();
/**
 * ⚠ LA CLEF SE REND APRES UN DELAI, ET C'EST TOUT L'INTERET DU VERROU.
 *   Le chemin d'une relance ordinaire est ENTIEREMENT SYNCHRONE : rendre la
 *   clef dans le `finally` la rendait avant meme que le second appui n'arrive,
 *   et le verrou ne protegeait de rien. Mesure au banc : deux validations
 *   enchainees faisaient passer quelqu'un de 0/4 a 2/4, puis a 4/4 — donc
 *   fermer son acces deux relances trop tot, et perdre la note du premier
 *   appui parce que la feuille etait deja refermee quand le second la lisait.
 *   Sept cents millisecondes couvrent le double-tap ; personne n'enregistre
 *   deux relances reelles dans cet intervalle.
 */
const TUNNEL_VERROU_MS=700;
/**
 * La feuille de relance : le canal, puis la note. Deux etapes dans la meme
 * feuille — c'est un geste que le coach repete dix fois par jour, et deux
 * fenetres l'auraient double.
 * @param {string} codeId
 */
function tunnelRelancer(codeId){
  const c=_tunnelCode(codeId);
  if(!c){ toast('Dossier introuvable','var(--orange)'); return false; }
  const k=tunnelCrm(c), n=k.relances.length;
  // ⚠ PAS DE CINQUIEME RELANCE. Le dossier est clos, l'acces est ferme :
  //   rouvrir la feuille laisserait croire qu'on peut encore agir.
  if(n>=TUNNEL_MAX){ toast('Tunnel terminé : ce dossier ne se relance plus.','var(--orange)'); return false; }
  const nom=String(c.studentName||c.athleteEmail||'cette personne').trim();
  const rang=n+1;
  const dernier=rang===TUNNEL_MAX;
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">'
  +'<h2 style="margin-bottom:4px">Relance '+rang+'/'+TUNNEL_MAX+'</h2>'
  +'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:14px">'+escapeHtml(nom)+'</div>'
  // ⚠ LA DERNIERE TENTATIVE SE DIT AVANT, PAS APRES. Fermer un acces est
  //   irreversible du point de vue de la personne : elle ne peut plus entrer.
  +(dernier?'<div style="background:var(--surface-1);border:1px solid var(--orange);border-left:1px solid var(--border);border-radius:var(--r-2);padding:10px 12px;margin-bottom:14px;font-size:var(--fs-xs);line-height:1.55;color:var(--text-strong)">'
      +'<strong>Dernière tentative.</strong> En validant, le dossier passe en fin de tunnel et le code d’accès de '
      +escapeHtml(nom)+' est désactivé. L’historique des quatre relances est conservé.</div>':'')
  +'<div class="ml-lab" style="margin-bottom:6px">Canal utilisé</div>'
  +'<div id="tun-canaux" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:6px;margin-bottom:6px">'
  +TUNNEL_CANAUX.map((x,i)=>'<button type="button" class="btn btn-blanc btn-sm tun-c'+(i?'':' actif')+'" data-canal="'+x.cle+'"'
     +' onclick="tunnelChoisirCanal(this)" style="min-height:40px;padding:8px 10px;letter-spacing:.3px">'+escapeHtml(x.lib)+'</button>').join('')
  +'</div>'
  // ⚠ ON N'ECRIT JAMAIS « ENVOYE ». RepCore n'envoie rien ici : il enregistre
  //   ce que le coach a fait de son cote. Les deux canaux qui SAVENT ouvrir un
  //   message pre-rempli le proposent par un lien ; les deux autres non.
  +'<p class="sub" id="tun-avis" style="font-size:var(--fs-2xs);line-height:1.5;margin:0 0 8px"></p>'
  // ⚠ CE LIEN EST LA SEULE CHOSE QUI ENVOIE VRAIMENT — et encore, il ne fait
  //   qu'OUVRIR le message pre-rempli dans WhatsApp ou le client mail, ou le
  //   coach appuie lui-meme sur « envoyer ». Valider, en dessous, n'envoie
  //   rien : ca enregistre l'action. Les deux gestes sont separes a l'ecran
  //   parce qu'ils sont separes en fait.
  +'<div id="tun-ouvrir" style="margin-bottom:12px"></div>'
  +'<div class="ml-lab" style="margin-bottom:6px">Note (facultative)</div>'
  +'<textarea id="tun-note" rows="3" maxlength="400" placeholder="WhatsApp envoyé : rappel de l’activation RepCore."'
  +' style="width:100%;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);padding:10px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm);resize:vertical;margin-bottom:14px"></textarea>'
  +'<div style="display:flex;gap:8px">'
  +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>'
  +'<button type="button" id="tun-valider" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="tunnelValider(\''+escapeHtml(codeId)+'\')">Enregistrer la relance</button>'
  +'</div></div></div>');
  // L'avis a besoin de savoir DE QUI il parle pour proposer le bon lien. Le
  // codeId voyage sur le noeud plutot qu'en variable globale : deux feuilles
  // ouvertes coup sur coup ne peuvent pas se melanger.
  const _p=document.getElementById('tun-avis');
  if(_p) _p.dataset.code=codeId;
  _tunnelMajAvis();
  return true;
}
/** Un seul canal a la fois. */
function tunnelChoisirCanal(b){
  const z=document.getElementById('tun-canaux');
  if(!z||!b) return false;
  z.querySelectorAll('.tun-c').forEach(x=>x.classList.toggle('actif',x===b));
  _tunnelMajAvis();
  return true;
}
/** Le canal choisi, ou le premier par defaut. */
function _tunnelCanalChoisi(){
  const a=document.querySelector('#tun-canaux .tun-c.actif');
  return a?String(a.dataset.canal||''):TUNNEL_CANAUX[0].cle;
}
/**
 * ⚠ LA PHRASE DIT LA VERITE SUR L'ENVOI. « Action enregistrée » n'est pas
 *   « message envoyé », et le coach doit savoir lequel des deux il obtient.
 */
function _tunnelMajAvis(){
  const p=document.getElementById('tun-avis');
  const z=document.getElementById('tun-ouvrir');
  if(!p) return;
  const cle=_tunnelCanalChoisi();
  const c=TUNNEL_CANAUX.find(x=>x.cle===cle);
  const code=_tunnelCode(String(p.dataset.code||''));
  const k=code?tunnelCanaux(code):{wa:'',mail:''};
  const lien=cle==='whatsapp'?k.wa:cle==='email'?k.mail:'';
  if(z){
    z.innerHTML=lien
      ? '<a href="'+_safeContactUrl(lien)+'" target="_blank" rel="noopener" class="btn btn-blanc btn-sm"'
        +' style="width:100%;margin:0;min-height:40px;display:flex;align-items:center;justify-content:center">'
        +'Ouvrir '+(cle==='whatsapp'?'WhatsApp':'le mail')+' pré-rempli</a>'
      : '';
  }
  p.textContent=(c&&c.reel)
    ? (lien
       ? 'Le bouton ci-dessous OUVRE le message pré-rempli ; c’est toi qui appuies sur envoyer. Valider, en dessous, enregistre seulement l’action.'
       : (cle==='whatsapp'?'Aucun numéro sur cette fiche : RepCore ne peut pas ouvrir WhatsApp.'
                          :'Aucune adresse sur cette fiche : RepCore ne peut pas ouvrir le mail.')
         +' L’action est enregistrée telle que tu l’as faite de ton côté.')
    : 'RepCore n’envoie pas par ce canal. L’action est enregistrée telle que tu l’as faite de ton côté.';
}
/**
 * Valider la relance : elle s'ajoute, le compteur monte, le statut suit, et la
 * quatrieme ferme l'acces.
 * @param {string} codeId
 * @returns {Promise<boolean>}
 */
async function tunnelValider(codeId){
  if(_tunnelEnCours.has(codeId)) return false;
  const c=_tunnelCode(codeId);
  if(!c) return false;
  const k=tunnelCrm(c);
  // ⚠ LE PLAFOND EST RELU ICI, et non seulement a l'ouverture de la feuille :
  //   entre les deux, un autre appareil a pu pousser une quatrieme relance.
  if(k.relances.length>=TUNNEL_MAX){ closeModal(); toast('Tunnel déjà terminé.','var(--orange)'); return false; }
  _tunnelEnCours.add(codeId);
  const b=document.getElementById('tun-valider');
  if(b instanceof HTMLButtonElement){ b.disabled=true; b.textContent='Enregistrement…'; }
  try{
    const canal=_tunnelCanalChoisi();
    const note=String((document.getElementById('tun-note')||{}).value||'').trim().slice(0,400);
    const rang=k.relances.length+1;
    const relance={n:rang,date:Date.now(),canal,note,
      // LE COACH QUI A FAIT LE GESTE. Un cabinet a plusieurs coachs relit son
      // historique et doit savoir qui a appele.
      par:String((currentUser&&currentUser.email)||'')};
    // ⚠ ON N'ECRASE JAMAIS : on ajoute. L'historique est la seule trace de ce
    //   qui a ete tente, et il ne se reecrit pas.
    c.crm={relances:k.relances.concat([relance]),
      prochaine:null,   // l'echeance est consommee ; on en proposera une neuve
      termineLe:k.termineLe};
    const fini=rang>=TUNNEL_MAX;
    if(fini) c.crm.termineLe=Date.now();
    const {ok,envoi}=_tunnelEcrire();
    closeModal();
    if(fini){
      // LA FERMETURE PASSE PAR LE CHEMIN EXISTANT, et par lui seul : le noeud
      // distant d'abord, le drapeau local ensuite. C'est deja la regle de
      // toggleStudentCode — « un code annonce ferme continuait d'ouvrir
      // l'acces, avec un coach persuade du contraire ».
      const ferme=await _tunnelFermerAcces(c);
      tunnelRendre();
      toast(ferme
        ? 'Relance 4/4 · tunnel terminé, accès désactivé.'
        : 'Relance 4/4 enregistrée, mais l’accès n’a PAS pu être désactivé : vérifie la connexion, puis ferme le code à la main.',
        ferme?'var(--green)':'var(--orange)');
      return true;
    }
    tunnelRendre();
    toastSync(ok,envoi,'Relance '+rang+'/'+TUNNEL_MAX+' enregistrée','la relance est');
    // ⚠ LA PLANIFICATION SUIT IMMEDIATEMENT. Une relance sans prochaine date
    //   sort du radar : elle n'a plus d'echeance, donc plus rien ne la fait
    //   remonter. C'est exactement comme cela qu'on perd un dossier.
    setTimeout(()=>{ try{ tunnelPlanifier(codeId,true); }catch(e){} },260);
    return true;
  } finally {
    setTimeout(()=>{ try{ _tunnelEnCours.delete(codeId); }catch(e){} },TUNNEL_VERROU_MS);
  }
}
/**
 * Ferme l'acces au bout du tunnel. Rend true seulement si le noeud distant a
 * SUIVI : un code annonce ferme qui continue d'ouvrir l'acces est pire que
 * pas de fermeture du tout.
 * @param {any} c
 * @returns {Promise<boolean>}
 */
async function _tunnelFermerAcces(c){
  if(c.active===false) return true;          // deja ferme : rien a faire
  // Un code trop ancien n'a pas de jeton, donc pas de noeud a fermer. On le
  // DIT plutot que de laisser croire a une fermeture.
  if(!c.token) return false;
  let distant=false;
  try{ distant=await _majActifDistant(c.token,false); }catch(e){ distant=false; }
  if(!distant) return false;
  c.active=false;
  _tunnelEcrire();
  return true;
}
/**
 * Planifier — ou replanifier — la prochaine relance.
 *
 * ⚠ AUCUNE ECRITURE DANS L'HISTORIQUE. Replanifier n'est pas relancer : le
 *   coach qui decale un rendez-vous trois fois ne doit pas apparaitre avec
 *   trois relances faites. L'historique est reserve a ce qui a ete TENTE.
 * @param {string} codeId
 * @param {boolean} [apresRelance]  ouvre la feuille juste apres une relance
 */
function tunnelPlanifier(codeId,apresRelance){
  const c=_tunnelCode(codeId);
  if(!c) return false;
  const k=tunnelCrm(c);
  if(k.relances.length>=TUNNEL_MAX){ toast('Tunnel terminé : plus rien à planifier.','var(--orange)'); return false; }
  const nom=String(c.studentName||c.athleteEmail||'cette personne').trim();
  // PAR DEFAUT DANS TROIS JOURS, a dix heures : une proposition qu'on accepte
  // d'un geste vaut mieux qu'un champ vide qu'il faut remplir deux fois.
  const base=k.prochaine?new Date(k.prochaine):(()=>{ const q=new Date(); q.setDate(q.getDate()+3); q.setHours(10,0,0,0); return q; })();
  const p2=x=>String(x).padStart(2,'0');
  const dISO=base.getFullYear()+'-'+p2(base.getMonth()+1)+'-'+p2(base.getDate());
  const hISO=p2(base.getHours())+':'+p2(base.getMinutes());
  closeModal();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px">'
  +'<h2 style="margin-bottom:4px">'+(k.prochaine?'Replanifier':'Prochaine relance')+'</h2>'
  +'<div class="sub" style="font-size:var(--fs-xs);margin-bottom:14px">'+escapeHtml(nom)
  +(apresRelance?' · relance '+k.relances.length+'/'+TUNNEL_MAX+' enregistrée':'')+'</div>'
  +'<div style="display:flex;gap:8px;margin-bottom:14px">'
  +'<label style="flex:1"><span class="ml-lab" style="display:block;margin-bottom:6px">Date</span>'
  +'<input type="date" id="tun-date" value="'+dISO+'" style="width:100%;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);padding:10px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)"></label>'
  +'<label style="flex:0 0 120px"><span class="ml-lab" style="display:block;margin-bottom:6px">Heure</span>'
  +'<input type="time" id="tun-heure" value="'+hISO+'" style="width:100%;background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-2);color:var(--text);padding:10px;font-family:Montserrat,sans-serif;font-size:var(--fs-sm)"></label>'
  +'</div>'
  +'<div style="display:flex;gap:8px">'
  +'<button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">'
  +(apresRelance?'Plus tard':'Annuler')+'</button>'
  +'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="tunnelPoserEcheance(\''+escapeHtml(codeId)+'\')">Planifier</button>'
  +'</div></div></div>');
  return true;
}
/** Pose l'echeance choisie. Elle seule bouge — l'historique ne change pas. */
function tunnelPoserEcheance(codeId){
  const c=_tunnelCode(codeId);
  if(!c) return false;
  const jd=String((document.getElementById('tun-date')||{}).value||'');
  const jh=String((document.getElementById('tun-heure')||{}).value||'10:00');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(jd)){ toast('Choisis une date.','var(--orange)'); return false; }
  const t=new Date(jd+'T'+(/^\d{2}:\d{2}$/.test(jh)?jh:'10:00')).getTime();
  if(!isFinite(t)){ toast('Date illisible.','var(--orange)'); return false; }
  const k=tunnelCrm(c);
  c.crm={relances:k.relances,prochaine:t,termineLe:k.termineLe};
  const {ok,envoi}=_tunnelEcrire();
  closeModal();
  tunnelRendre();
  toastSync(ok,envoi,'Prochaine relance : '+_tunnelQuand(t),'l’échéance est');
  return true;
}
/** PURE-ish. « 23/09 à 10:00 » — la forme courte qu'on lit sur une carte. */
function _tunnelQuand(t){
  if(!t) return '';
  const q=new Date(t), p2=x=>String(x).padStart(2,'0');
  return p2(q.getDate())+'/'+p2(q.getMonth()+1)+' à '+p2(q.getHours())+':'+p2(q.getMinutes());
}

// ══ L'ECRAN DU TUNNEL ══════════════════════════════════════════════════════

/** Le filtre et le tri ne sont pas enregistres : ce sont des gestes de lecture. */
let _tunFiltre='tous';
let _tunTri='prochaine';
/** Les filtres, dans l'ordre ou on les touche : d'abord ce qui presse. */
const TUNNEL_FILTRES=Object.freeze([
  ['retard','En retard'],['aujourdhui','Aujourd’hui'],['tous','Tous'],
  ['chaud','Chaud'],['tiede','Tiède'],['froid','Froid'],['fini','Tunnel terminé']]);
const TUNNEL_TRIS=Object.freeze([
  ['prochaine','Prochaine relance'],['derniere','Dernière relance'],
  ['nb','Nombre de relances'],['nom','Nom']]);
/** Ouvre le tunnel. */
/**
 * Le resume de la carte d'accueil. Il dit d'abord ce qu'il y a A FAIRE — une
 * relance en retard fait ouvrir l'ecran, « 12 personnes » non — puis la
 * repartition, qui dit ou en est le portefeuille.
 * @param {any[]} [clients]  les athletes deja calcules, pour ne pas les relire
 */
function _majResumeTunnel(clients){
  const z=document.getElementById('ch-tunnel-resume');
  if(!z||!currentUser) return false;
  let ath=clients;
  if(!Array.isArray(ath)){ try{ ath=getClients()||[]; }catch(e){ ath=[]; } }
  const r=tunnelResume(tunnelPersonnes(currentUser,ath.filter(c=>c&&!c._fromCode),Date.now()));
  const bouts=[];
  if(r.total) bouts.push(r.total+' personne'+(r.total>1?'s':''));
  const rep=[];
  if(r.chauds) rep.push(r.chauds+' chaud'+(r.chauds>1?'s':''));
  if(r.tiedes) rep.push(r.tiedes+' tiède'+(r.tiedes>1?'s':''));
  if(r.froids) rep.push(r.froids+' froid'+(r.froids>1?'s':''));
  if(rep.length) bouts.push(rep.join(' · '));
  z.textContent=tunnelPhrase(r)+(bouts.length?' : '+bouts.join('  ·  '):'');
  return true;
}
function tunnelOuvrir(){
  go('s-coach-tunnel');
  tunnelRendre();
  return true;
}
/** @param {string} f */
function tunnelSetFiltre(f){ _tunFiltre=TUNNEL_FILTRES.some(x=>x[0]===f)?f:'tous'; tunnelRendre(); return true; }
/**
 * Le filtre des tuiles : il BASCULE. Toucher celle qui est deja active la
 * relache et rend la liste entiere.
 *
 * ⚠ C'EST CE QUI REMPLACE LE BOUTON « TOUS », retire avec sa barre le
 *   20/09/2026. Sans bascule, trois tuiles seules auraient enferme le coach
 *   dans un statut sans aucun moyen d'en sortir.
 * @param {string} f
 */
function tunnelBasculer(f){ return tunnelSetFiltre(_tunFiltre===f?'tous':f); }
/** @param {string} t */
function tunnelSetTri(t){ _tunTri=TUNNEL_TRIS.some(x=>x[0]===t)?t:'prochaine'; tunnelRendre(); return true; }
/**
 * PURE. Le filtre et le tri appliques a une liste. Sortie de la fonction de
 * rendu pour qu'une assertion puisse la verifier sans peindre un ecran.
 * @param {any[]} liste
 * @param {string} filtre
 * @param {string} tri
 * @returns {any[]}
 */
function tunnelVue(liste,filtre,tri){
  const l=(liste||[]).filter(Boolean);
  // ⚠ « TOUS » NE VEUT PAS DIRE « Y COMPRIS LES TERMINES ». Un dossier clos
  //   n'est plus a relancer : le melanger aux autres ferait chercher parmi des
  //   gens qu'on ne rappellera jamais. Il a son propre filtre.
  const v=filtre==='fini'?l.filter(p=>p.fini):l.filter(p=>!p.fini).filter(p=>
      filtre==='tous'?true
    : filtre==='retard'?p.echeance==='retard'
    : filtre==='aujourdhui'?p.echeance==='aujourdhui'
    : p.statut===filtre);
  const parNom=(a,b)=>String(a.nom||'').localeCompare(String(b.nom||''),'fr');
  if(tri==='nom') return v.sort(parNom);
  if(tri==='nb') return v.sort((a,b)=>b.nb-a.nb||parNom(a,b));
  if(tri==='derniere') return v.sort((a,b)=>b.derniere-a.derniere||parNom(a,b));
  // PAR PROCHAINE RELANCE, ET C'EST LE DEFAUT : c'est la question que le coach
  // se pose en ouvrant l'ecran. ⚠ SANS ECHEANCE PASSE EN DERNIER, et non en
  // premier : `null` vaudrait zero, et les dossiers qu'on n'a pas encore
  // planifies coifferaient ceux qui sont en retard depuis trois jours.
  return v.sort((a,b)=>(a.prochaine||Infinity)-(b.prochaine||Infinity)||parNom(a,b));
}
/** La liste du tunnel, telle que l'application la voit. */
function tunnelListe(){
  let ath=[];
  try{ ath=(getClients()||[]).filter(c=>c&&!c._fromCode); }catch(e){ ath=[]; }
  return tunnelPersonnes(currentUser,ath,Date.now());
}
/**
 * PURE. Un buste et une tete, PLEINS.
 *
 * ⚠ ELLE N'ENTRE PAS DANS `ICONS`, ET C'EST VOULU. Tout ce jeu est dessine au
 *   TRAIT — `icon()` rend `fill="none" stroke="currentColor"` — et une
 *   silhouette est par definition une forme PLEINE. L'y mettre l'aurait rendue
 *   creuse, c'est-a-dire tout sauf une silhouette ; et changer `icon()` pour
 *   elle aurait touche les cinquante autres.
 *
 * `currentColor` : elle prend la teinte de la tuile qui la porte, sans qu'on
 * ait a la lui passer.
 * @param {number} px
 */
function _htmlSilhouette(px){
  const t=Number(px)||30;
  return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" '
    +'style="width:'+t+'px;height:'+t+'px;display:block">'
    +'<circle cx="12" cy="7.1" r="4.3"/>'
    +'<path d="M12 12.9c-4.5 0-7.8 2.7-7.8 6.3 0 .9.7 1.6 1.6 1.6h12.4c.9 0 1.6-.7 1.6-1.6 0-3.6-3.3-6.3-7.8-6.3z"/>'
    +'</svg>';
}
function tunnelRendre(){
  const z=document.getElementById('tun-body');
  if(!z||!currentUser) return false;
  const tout=tunnelListe();
  const r=tunnelResume(tout);
  const vue=tunnelVue(tout,_tunFiltre,_tunTri);
  // ⚠ LA TUILE EST LE FILTRE. Demande de Kevin, 20/09/2026 : « seuls les carres
  //   sont cliquables ». Elle BASCULE — retoucher celle qui est active relache
  //   le filtre et rend la liste entiere. Sans ce relachement, trois tuiles
  //   sans bouton « Tous » auraient enferme le coach dans un statut.
  const stat=(cle,n,lib,c)=>'<button type="button" class="tun-stat'
    +(_tunFiltre===cle?' actif':'')+'" style="--c:'+c+'"'
    +' aria-pressed="'+(_tunFiltre===cle)+'" onclick="tunnelBasculer(\''+cle+'\')">'
    +'<div class="tun-sil">'+_htmlSilhouette(34)+'</div>'
    +'<b>'+n+'</b><span>'+lib+'</span></button>';
  // ⚠ LES DEUX BARRES SONT RETIREES, demande de Kevin — sauf UNE porte, et elle
  //   ne s'ouvre que s'il y a quelque chose derriere. « Tous » excluait deja les
  //   dossiers TERMINES : `tunnelVue` le dit en toutes lettres, un dossier clos
  //   n'est plus a relancer. Son filtre etait donc le SEUL chemin vers eux, et
  //   le build 1314 promet noir sur blanc qu'ils « se relisent dans le filtre
  //   Tunnel terminé ». Le supprimer sans rien aurait rendu ces dossiers — leurs
  //   quatre relances, leurs canaux, leurs notes — definitivement invisibles.
  //   La ligne n'apparait donc QUE s'il en existe : a zero, l'ecran est celui
  //   que Kevin a demande, sans rien de plus.
  const fini=(r.termines>0)
    ? '<div class="tun-fini"><button type="button" class="tun-fini-b'
      +(_tunFiltre==='fini'?' actif':'')+'" onclick="tunnelBasculer(\'fini\')">'
      +(_tunFiltre==='fini'
        ? '← Revenir au tunnel'
        : (r.termines+' dossier'+(r.termines>1?'s':'')+' terminé'+(r.termines>1?'s':'')+' · voir'))
      +'</button></div>'
    : '';
  let h='<div class="tun-stats">'
    +stat('chaud',r.chauds,'Chauds',TUNNEL_LIB.chaud.c)
    +stat('tiede',r.tiedes,'Tièdes',TUNNEL_LIB.tiede.c)
    +stat('froid',r.froids,'Froids',TUNNEL_LIB.froid.c)
    +'</div>'+fini;
  if(!tout.length){
    h+='<div class="sub" style="text-align:center;padding:28px 12px;font-size:var(--fs-sm);line-height:1.6">'
      +'Personne dans le tunnel.<br>Les codes d’accès que tu crées y entrent automatiquement, '
      +'et en sortent dès que la personne ouvre RepCore.</div>';
  } else if(!vue.length){
    h+='<div class="sub" style="text-align:center;padding:24px 12px;font-size:var(--fs-sm)">Aucun dossier dans ce filtre.</div>';
  } else {
    h+=vue.map(_tunCarte).join('');
  }
  z.innerHTML=h;
  return true;
}
/** Une carte. Le nom et le statut en tete, l'echeance en pied. */
function _tunCarte(p){
  const s=TUNNEL_LIB[p.statut]||TUNNEL_LIB.chaud;
  const nom=escapeHtml(p.nom||'Élève sans nom');
  const ini=escapeHtml(((p.fname||'?')[0]||'?')+((p.lname||'')[0]||'')).toUpperCase();
  const rond=p.photo
    ? '<img src="'+escapeHtml(p.photo)+'" alt="">'
    : ini;
  // L'ECHEANCE EST LE FAIT QUI DECIDE : elle porte sa propre couleur, et les
  // deux mots qui disent quoi faire — « aujourd'hui », « en retard ».
  const ech=p.fini
    ? '<span>Terminé le <b>'+(p.termineLe?_tunJour(p.termineLe):'-')+'</b></span>'
    : p.prochaine
      ? '<span>Prochaine : <b class="'+(p.echeance==='retard'?'tun-retard':p.echeance==='aujourdhui'?'tun-du':'')+'">'
        +_tunnelQuand(p.prochaine)+'</b>'
        +(p.echeance==='retard'?' <span class="tun-retard">· en retard</span>'
         :p.echeance==='aujourdhui'?' <span class="tun-du">· aujourd’hui</span>':'')+'</span>'
      : '<span class="tun-du">Aucune relance planifiée</span>';
  return '<div class="tun-carte" style="--c:'+s.c+'">'
    +'<div class="tun-tete">'
      +'<span class="tun-rond">'+rond+'</span>'
      +'<div style="flex:1;min-width:0"><div class="tun-nom">'+nom+'</div>'
        +'<div class="tun-jauge">'+[0,1,2,3].map(i=>'<i class="'+(i<p.nb?'on':'')+'"></i>').join('')+'</div></div>'
      +'<span class="tun-badge">'+escapeHtml(s.lib)+'</span>'
    +'</div>'
    +'<div class="tun-faits">'
      +'<span>Relance <b>'+p.nb+'/'+TUNNEL_MAX+'</b></span>'
      +'<span>Dernière : <b>'+(p.derniere?_tunJour(p.derniere):'jamais')+'</b></span>'
      +ech
      +(p.fini&&!p.actif?'<span>Accès désactivé : tunnel terminé</span>':'')
    +'</div>'
    +'<div class="tun-cmd">'
      +(p.fini?''
        :'<button type="button" class="btn btn-red btn-sm" onclick="tunnelRelancer(\''+escapeHtml(p.codeId)+'\')">Relancer</button>'
         +'<button type="button" class="btn btn-blanc btn-sm" onclick="tunnelPlanifier(\''+escapeHtml(p.codeId)+'\')">'
         +(p.prochaine?'Replanifier':'Planifier')+'</button>')
      +'<button type="button" class="btn btn-outline btn-sm" onclick="openClientDetail(\''+escapeHtml(p.id)+'\',false,true)">Profil</button>'
    +'</div></div>';
}
/** PURE-ish. « 23/09 » — la forme la plus courte qui reste lisible. */
function _tunJour(t){
  if(!t) return '-';
  const q=new Date(t), p2=x=>String(x).padStart(2,'0');
  return p2(q.getDate())+'/'+p2(q.getMonth()+1);
}
const INACTIF_OBJET='On fait le point ?';
const JAMAIS_OBJET='On démarre ?';
// ══ UNE RELANCE S'ADRESSE A UNE PERSONNE ════════════════════════════════════
//
// ⚠ JAMAIS PAR LE CANAL, et c'est une regle du produit depuis le 19/09/2026.
//   Demande de Kevin. La relance « jamais demarre » ouvrait la fenetre du
//   CANAL avec un brouillon nominatif dedans : « Salut Jean, j'ai vu que tu
//   n'as pas encore lance ta premiere seance. » Le canal est lu par TOUS les
//   athletes suivis — l'envoyer tel quel apprenait au groupe entier que Jean
//   n'avait pas commence. L'ecran posait bien un avertissement orange, mais
//   un avertissement ne repare pas un chemin : il demande a l'utilisateur de
//   rattraper le produit. Les deux relances passent desormais par les memes
//   canaux directs — WhatsApp ou mail — que le cadre « Inactifs » employait
//   deja.
//
// PURE. Les deux adresses ouvrables pour cet athlete, ou '' pour chacune.
// waLink et non un replace brut : un numero saisi en « 06… » produit un lien
// que WhatsApp refuse, et mieux vaut ne pas poser le bouton qu'en poser un
// mort — c'est la regle deja ecrite pour le contact du coach.
//
// UNE SEULE FABRIQUE POUR LES DEUX CADRES : le durcissement du `mailto:`
// ci-dessous est une precaution de securite, et une precaution recopiee est
// une precaution qu'on oubliera de recopier la troisieme fois.
function _canauxRelance(c,texte,objet){
  const tel=_telAthlete(c);
  const mail=String((c&&c.email)||'').trim();
  return {
    texte:texte,
    wa:tel?waLink(tel,texte):'',
    // ⚠ L'ADRESSE N'EST PAS PERCENT-ENCODEE, le sujet et le corps le sont.
    // `mailto:x%40t.fr` fait tomber une partie des clients mail — l'arobase
    // encodee n'est pas reconnue comme separateur. Seuls les PARAMETRES de la
    // requete se codent. L'adresse est nettoyee des caracteres qui pourraient
    // en faire sortir : sans cela, un champ email contenant « ?body= » aurait
    // reecrit le message que le coach croit envoyer.
    mail:(mail.indexOf('@')>0&&!/[\s?&#<>"']/.test(mail))
      ?('mailto:'+mail+'?subject='+encodeURIComponent(objet)
        +'&body='+encodeURIComponent(texte))
      :''
  };
}
function canauxRelanceInactif(c,maintenant){
  return _canauxRelance(c,brouillonInactif(c,maintenant),INACTIF_OBJET);
}
function canauxRelanceJamaisDemarre(c){
  return _canauxRelance(c,brouillonJamaisDemarre(c),JAMAIS_OBJET);
}
/**
 * Les deux liens ouvrables pour une personne du TUNNEL. Elle n'a pas de
 * dossier — c'est tout le sujet — donc on fabrique le minimum que
 * `canauxRelanceJamaisDemarre` attend a partir de son entree de code.
 *
 * ⚠ UNE SEULE FABRIQUE DE LIENS POUR LES DEUX CHEMINS. Le durcissement du
 *   `mailto:` vit dans `_canauxRelance` ; le recopier ici en aurait fait une
 *   seconde version a oublier de corriger.
 * @param {any} code  une entree de studentCodes
 */
function tunnelCanaux(code){
  const nom=String((code&&code.studentName)||'').trim();
  return canauxRelanceJamaisDemarre({
    fname:nom.split(' ')[0]||'',
    lname:nom.split(' ').slice(1).join(' '),
    email:String((code&&code.athleteEmail)||''),
    phone:String((code&&(code.athletePhone||code.phone))||'')});
}
// PURE. Le cadre, ou la chaine VIDE quand personne n'est concerne — jamais un
// cadre vide annoncant zero. Meme regle que « Jamais demarre » juste en
// dessous, et pour la meme raison : une liste de relance qui s'affiche a zero
// devient du decor, et on cesse de la lire le jour ou elle dit quelque chose.
//
// LE GRIS ET NON LE ROUGE, encore. Ce n'est pas une alerte : personne n'a mal,
// rien n'est en retard. La peindre comme « A traiter » lui volerait l'attention
// que la sante doit garder.
function _htmlInactifs(liste,maintenant){
  const l=liste||[];
  if(!l.length) return '';
  const t=Number(maintenant)||Date.now();
  const n=l.length;
  const bouton=(href,lib)=>'<a href="'+_safeContactUrl(href)+'" target="_blank" rel="noopener" '
    +'class="btn btn-outline btn-sm rel-b">'+lib+'</a>';
  return '<div class="cadre-replie" style="background:var(--surface-1);border:1px solid var(--border);'
    +'border-left:3px solid var(--sub);border-radius:var(--r-3);margin-bottom:20px;'
    +'overflow:hidden;box-shadow:var(--e2)">'
    +'<div style="padding:10px 14px;display:flex;align-items:center;justify-content:space-between;'
    +'gap:10px;background:var(--surface-2);border-bottom:1px solid var(--border)">'
    +'<span style="font-size:13px;font-weight:800;color:var(--text-strong);text-transform:uppercase;'
    +'letter-spacing:2.4px">Inactifs</span>'
    +'<span style="background:var(--surface-1);border:1px solid var(--border);color:var(--text);'
    +'font-size:14px;font-weight:400;padding:1px 10px;border-radius:var(--r-3);'
    +'font-family:var(--pile-titre);letter-spacing:1px">'+n+'</span>'
    // « Message » (06/10/2026) : tous les inactifs cochés, le texte de relance.
    +(n>1?'<button type="button" class="btn btn-outline btn-sm" style="margin:0 0 0 auto;min-height:36px;font-size:var(--fs-2xs);letter-spacing:1px" onclick="openWaGroupe(null,'+_attrArg(l.map(c=>String(c.id)))+',_waCorpsGroupe(\'inactif\'))">Message</button>':'')
    +'</div>'
    +'<div style="padding:0 14px">'
    +_crListe(l,c=>{
      const j=joursDepuisSigne(c,t);
      // XSS STOCKE : le prenom est saisi par l'athlete et atterrit dans le
      // tableau de bord de son coach. Meme precaution que renderTodoBlock.
      const nom=escapeHtml(String(c.fname||'').trim()||'Athlète');
      const k=canauxRelanceInactif(c,t);
      // NI NUMERO NI ADRESSE : on le DIT. Deux boutons qui n'ouvrent rien
      // feraient croire a une panne, et le coach cliquerait deux fois avant de
      // comprendre que le manque est dans la fiche de l'athlete.
      const actions=(k.wa||k.mail)
        ?('<div class="rel-a">'
          +(k.wa?bouton(k.wa,'WhatsApp'):'')
          +(k.mail?bouton(k.mail,'Mail'):'')+'</div>')
        :'<span class="sub" style="font-size:var(--fs-2xs);flex:0 0 auto;text-align:right;'
          +'line-height:1.4;max-width:104px">Ni numéro<br>ni adresse</span>';
      return '<div style="flex:1;min-width:0">'
        +'<div style="font-size:var(--fs-sm);font-weight:800;line-height:1.3">'+nom+'</div>'
        +'<div class="sub" style="font-size:var(--fs-2xs);margin-top:2px">'
        +(j>0?('plus de séance depuis '+j+' jour'+(j>1?'s':'')):'plus de séance récente')
        +'</div></div>'+actions;
    },{pad:'11px 0'})
    +'</div>'
    +'<div class="sub" style="font-size:var(--fs-2xs);line-height:1.55;padding:2px 14px 12px">'
    +'Le message s’ouvre pré-rédigé et modifiable. RepCore n’envoie rien à ta place.'
    +'</div></div>';
}
function _rendreInactifs(clients){
  const z=document.getElementById('ch-inactifs');
  if(!z) return false;
  try{ z.innerHTML=_htmlInactifs(listeInactifs(clients,Date.now()),Date.now()); }
  catch(e){ z.innerHTML=''; }
  return true;
}
/**
 * Deplie le surplus de la carte « Jamais démarré », et retire le bouton.
 *
 * ⚠ `hidden` PLUTOT QUE `display:none` EN LIGNE : les cartes repliees sont
 *   deja dans le document — elles sont rendues, juste cachees — et `hidden`
 *   les retire aussi de l'arbre d'accessibilite. Un lecteur d'ecran ne
 *   annoncait donc pas treize rectangles quand l'oeil en voit huit.
 */
function jdVoirTout(b){
  const z=b&&b.closest?b.closest('div'):null;
  const g=z?z.querySelector('.jd-grille'):document.querySelector('#ch-jamais-demarre .jd-grille');
  if(!g) return false;
  g.querySelectorAll('.jd-plus').forEach(x=>x.removeAttribute('hidden'));
  if(b&&b.remove) b.remove();
  return true;
}
function _rendreJamaisDemarre(clients){
  const z=document.getElementById('ch-jamais-demarre');
  if(!z) return;
  try{ z.innerHTML=_htmlJamaisDemarre(listeJamaisDemarre(clients,Date.now()),Date.now()); }
  catch(e){ z.innerHTML=''; }
}
// Un athlète « a un programme » dès qu'UN de ces mécanismes est renseigné.
// Source unique de vérité : tout code qui juge la présence d'un programme doit
// passer par ici, sinon un athlète servi par PDF ou par séances reste compté
// « Sans programme ».
//   sessions_config    séances activées et garnies (mécanisme actuel)
//   programPdfStorageUrl / programPdfLink / programPdf   PDF stocké, lié, ou inline
//   program            ancien tableau d'exercices (données historiques)
// Les séances d'essai ne comptent PAS : elles n'ont été écrites par personne.
// Sans cette exclusion, un athlète qui ouvrait simplement son sélecteur de
// séances disparaissait de la liste « Sans programme » du coach — la config de
// repli était persistée puis poussée au cloud, et devenait indiscernable d'un
// programme publié. (seanceEstExemple est défini plus bas : hoisting.)
function hasProgram(c){
  return !!(
    c?.sessions_config?.some(s=>s.active&&s.exercises?.length&&!seanceEstExemple(s))
    ||c?.programPdfStorageUrl||c?.programPdfLink||c?.programPdf
    ||c?.program?.length
  );
}
// ======= RÉCAP SÉANCES COACH =======
let _coachSessions=[], _coachSessionsClient=null;
function renderCoachSessionRecap(c){
  const el=document.getElementById('ccd-sessions-recap');
  if(!el) return;
  _coachSessions=(c.sessions||[]).slice().reverse();
  _coachSessionsClient=c;
  if(!_coachSessions.length){el.innerHTML='';return;}
  el.innerHTML=`<h3 style="margin-bottom:12px">Séances</h3>
    <div id="ccd-sr-list"></div>
    <button id="ccd-sr-more" onclick="showMoreCoachSessions()"
      style="display:none;width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:var(--r-2);color:var(--sub);font-size:var(--fs-sm);cursor:pointer;margin-bottom:4px;min-height:44px">Voir plus de séances</button>`;
  _renderSessionBatch(0,5);
}
function _renderSessionBatch(from,count){
  const list=document.getElementById('ccd-sr-list');
  const btn=document.getElementById('ccd-sr-more');
  if(!list) return;
  list.innerHTML+=_coachSessions.slice(from,from+count).map(s=>_buildSessionCard(s,_coachSessionsClient)).join('');
  const shown=from+count;
  const more=_coachSessions.length-shown;
  if(btn){
    if(more>0){btn.textContent=`Voir ${more} séance${more>1?'s':''} de plus`;btn.style.display='block';}
    else btn.style.display='none';
  }
}
function showMoreCoachSessions(){
  const shown=document.getElementById('ccd-sr-list').children.length;
  _renderSessionBatch(shown,5);
}
// ══════ N4.5 — DU RETOUR DE SEANCE A LA PRESCRIPTION QU'IL CORRIGE ════════
// Le recapitulatif des seances affiche « 80kg x 8 · 80kg x 7 » en lecture
// seule. Pour corriger la charge apres avoir lu ce retour, le coach devait
// remonter la fiche, ouvrir « Programme », trouver le bon jour, ouvrir
// « Modifier les exercices », defiler jusqu'a la bonne carte, corriger,
// Sauvegarder, puis PUBLIER : quatre ecrans et sept clics pour un nombre —
// et il le fait pour chaque athlete apres chaque seance.
//
// AUCUN SECOND CHEMIN D'ECRITURE. Ce raccourci ne fait que NAVIGUER : il
// prepare le brouillon comme le fait le bouton « Programme », ouvre l'editeur
// sur le bon jour et marque la bonne carte. Le circuit reste celui d'avant —
// brouillon d'abord, PUBLIER ensuite — et rien n'atteint l'athlete sans lui.
//
// LE JOUR EST DEDUIT DU NOM DE L'EXERCICE, par exKey, la meme normalisation
// que partout ailleurs : un exercice fait le lundi et le jeudi ouvre le
// premier creneau actif qui le porte, et le coach voit lequel dans le titre.
function _slotDeLExercice(c,nom){
  const cfg=(c&&c.sessions_config)||[];
  let k='';
  try{ k=exKey(nom); }catch(e){ k=String(nom||'').toUpperCase(); }
  if(!k) return -1;
  for(let i=0;i<cfg.length;i++){
    const s=cfg[i];
    if(!s||!s.active||!Array.isArray(s.exercises)) continue;
    for(const e of s.exercises){
      let ek='';
      try{ ek=exKey(e&&e.name); }catch(err){ ek=String((e&&e.name)||'').toUpperCase(); }
      if(ek&&ek===k) return i;
    }
  }
  return -1;
}
function allerVersPrescription(nom){
  const c=getOwnedClient(currentClientId);
  if(!c){ return false; }
  if(c._fromCode){ toast('Cet athlète n’a pas encore créé son compte.','var(--orange)'); return false; }
  const idx=_slotDeLExercice(c,nom);
  if(idx<0){
    toast('« '+nom+' » n’est dans aucune séance active de son programme.','var(--orange)');
    return false;
  }
  // MEME PREPARATION QUE LE BOUTON « PROGRAMME » : c'est elle qui pose le
  // brouillon _coachEditClient, et l'editeur ne lit que lui.
  if(!_seancesCoachPreparer()) return false;
  openCoachSessionExercises(idx);
  // LA CARTE EST MARQUEE, pas seulement atteinte : sur une seance de huit
  // exercices, « c'est quelque part plus bas » ne vaut guere mieux que rien.
  setTimeout(()=>{ _viserOuLeDire(nom); },60);
  return true;
}
// B1.11 — UN CIBLAGE QUI RATE NE SE TAIT PLUS.
//
// Les deux appelants enveloppaient _viserExercice d'un try{…}catch(e){} vide,
// et jetaient sa valeur de retour. Or elle dit exactement ce qui nous
// interesse : false quand aucune carte ne porte ce nom. Si le ciblage echouait
// — nom renomme, carte pas encore rendue a 60 ms — rien ne se voyait : le
// coach venait de remplacer un exercice, la page ne bougeait pas, et le toast
// « Remplace ✓ » qui suit rendait le silence plus trompeur encore.
//
// L'OPERATION, ELLE, A BIEN EU LIEU. On ne transforme pas un echec de ciblage
// en echec de remplacement : le message dit que la carte n'a pas ete
// retrouvee, pas que le geste a echoue. Et il est discret — orange, pas rouge.
function _viserOuLeDire(nom){
  let ok=false;
  try{ ok=_viserExercice(nom); }
  catch(e){ console.warn('ciblage d\'exercice : ', e); }
  if(ok) return true;
  console.warn('ciblage d\'exercice : « '+nom+' » introuvable parmi les cartes rendues');
  try{ toast('Modification enregistrée : la carte « '+nom+' » n’a pas pu être retrouvée à l’écran.','var(--orange)'); }catch(e){}
  return false;
}
function _viserExercice(nom){
  let k=''; try{ k=exKey(nom); }catch(e){ k=String(nom||'').toUpperCase(); }
  const cartes=document.querySelectorAll('#s-coach-program [data-ex-nom]');
  for(const el of cartes){
    let ek=''; try{ ek=exKey(el.getAttribute('data-ex-nom')); }
    catch(e){ ek=String(el.getAttribute('data-ex-nom')||'').toUpperCase(); }
    if(ek!==k) continue;
    try{ _defiler(el); }catch(e){}
    if(arcReduit()) return true;
    el.classList.remove('cc-vise');
    void el.offsetWidth;
    el.classList.add('cc-vise');
    return true;
  }
  return false;
}
// `client` (facultatif) : le dossier de l'athlete, pour ses notes d'exercice.
function _buildSessionCard(s,client){
  const dt=dateLocaleDeCle(s.date).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
  const complete=s.complete!==false;
  const rows=Object.entries(s.data||{}).map(([nm,d])=>{
    const done=(d.sets||[]).filter(x=>x.done&&(x.weight||x.reps));
    if(!done.length) return '';
    // N6.9 — LE RIR ET LA DOULEUR, SERIE PAR SERIE. Les deux sont collectes a
    // chaque serie et lus ailleurs — rir alimente e1rm et rirMoyenSeance, pain
    // alimente la detection de douleur — mais le recapitulatif du coach les
    // masquait : il lisait « 80kg×8 » sans savoir si c'etait 8 a RIR 3 ou 8 a
    // l'echec, ni si l'athlete avait signale quelque chose.
    //
    // RIEN PLUTOT QU'UN ZERO. Un historique anterieur au champ rir n'a pas de
    // RIR ; afficher « RIR 0 » y ferait lire « a l'echec » sur des seances ou
    // personne n'a rien note. Zero est d'ailleurs une valeur LEGITIME — c'est
    // l'echec — donc le test porte sur la presence du champ, pas sur sa verite.
    const _sfx=x=>{
      const out=[];
      if(x.rir!==''&&x.rir!=null&&isFinite(Number(x.rir))) out.push('RIR '+Number(x.rir));
      // La douleur ne s'affiche que si elle a ete signalee : « douleur 0 » sur
      // une serie sans probleme allongerait chaque ligne pour ne rien dire.
      const d=Number(x.pain);
      if(x.pain!==''&&x.pain!=null&&isFinite(d)&&d>0) out.push('douleur '+d);
      return out.length?' ('+out.join(', ')+')':'';
    };
    const line=done.map(x=>(x.degressive
      ?`${x.weight||'?'}kg×${x.reps||'?'} / ${x.weight2||'?'}kg×${x.p2reps||'?'}`
      // R29 — sur une fourchette, les repetitions NOTEES : « 36kg×10 », et non
      // la prescription « 36kg×10-12 » qui ne dit pas ce qui a ete fait.
      :`${x.weight||'?'}kg×${x.repsDone!=null?x.repsDone:(x.reps||'?')}`)+_sfx(x)
    ).join(' · ');
    // N4.5 — LE NOM DE L'EXERCICE EST LE CHEMIN. Un bouton et non un div : il
    // se prend au clavier, il s'annonce comme un bouton, et le reste de la
    // ligne — ce que l'athlete a REELLEMENT fait — reste du texte.
    const _nomEch=escapeHtml(nm).replace(/'/g,'&#39;');
    return `<div style="padding:8px 0;border-top:1px solid #141414">
      <button type="button" onclick="allerVersPrescription('${_nomEch}')"
        title="Corriger cet exercice dans son programme"
        style="display:block;width:100%;text-align:left;background:none;border:none;padding:0;margin:0 0 2px;font-family:inherit;font-size:var(--fs-xs);font-weight:700;color:#ccc;cursor:pointer;text-decoration:underline;text-decoration-color:#333;text-underline-offset:3px">${escapeHtml(nm)}</button>
      <div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6">${escapeHtml(line)}</div>
      ${(()=>{ const n=client?noteExo(client,nm):null;
        return n?`<div class="sc-note-exo">Sa note : ${escapeHtml(n.texte)}</div>`:''; })()}
    </div>`;
  }).filter(Boolean).join('');
  // LE MOT DE L'ATHLETE, en tete du detail : c'est la premiere chose a lire.
  const _mot=(typeof s.noteAthlete==='string'&&s.noteAthlete.trim())
    ?`<div class="sc-note-ath"><span>Son mot</span>${escapeHtml(s.noteAthlete.trim().slice(0,NOTE_SEANCE_MAX))}</div>`:'';
  return `<div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--r-3);margin-bottom:10px;overflow:hidden">
    <div onclick="toggleSCard(this)" style="display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
      <div style="flex:1;min-width:0">
        <div style="font-size:var(--fs-md);font-weight:700;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(s.name||'Séance')}</div>
        <div style="font-size:var(--fs-xs);color:var(--sub)">${dt}${s.corrigeeLe?' · corrigée':''} · ${s.duration||0} min · ${fmtSeries(s.sets,s.setsPlanned)} série${pluSeries(s.sets,s.setsPlanned)} · ${s.volume||0} kg</div>
      </div>
      <span style="font-size:var(--fs-xs);font-weight:700;flex-shrink:0;color:${complete?'var(--green)':'#555'}">${complete?icon('coche',14):icon('croix',14)}</span>
      <span class="sc-arr" style="color:var(--text-dim);font-size:var(--fs-xs);flex-shrink:0">▶</span>
    </div>
    <div class="sc-body" style="display:none;padding:0 14px 14px">
      ${_mot}${rows||'<div style="font-size:var(--fs-xs);color:var(--text-dim);padding-top:8px">Aucune série enregistrée.</div>'}
    </div>
  </div>`;
}
function toggleSCard(hdr){
  const body=hdr.nextElementSibling;
  const arr=hdr.querySelector('.sc-arr');
  const opening=body.style.display==='none';
  body.style.display=opening?'block':'none';
  arr.textContent=opening?'▼':'▶';
}
// ======= FIN RÉCAP SÉANCES COACH =======
// Retourne l'élève seulement s'il appartient au coach courant ; toast + null sinon.
// Passe `users` (déjà chargé) pour éviter un double DB.get dans les fonctions d'écriture.
// ══════════════ JOURNAL DE COACH ══════════════
// ══════════════ LE MOT AU COACH ════════════════════════════════════════
//
// La moitie de ce qu'un coach a besoin de savoir n'entre dans aucune case. Le
// bilan pose des questions ; ce champ-ci n'en pose aucune. Un seul champ
// libre, remonte TEL QUEL, et hors du bilan : ce qui compte se dit le jour ou
// ca arrive, pas le jour ou le bilan tombe.
//
// ⚠ AUCUNE LECTURE AUTOMATIQUE DE CE TEXTE. Pas de mots-clefs, pas de
// detection de detresse, pas de classement par etiquette. Le projet a
// DELIBEREMENT retire la regex sur texte libre pour lui substituer le
// depistage SCOFF, qui est un questionnaire valide : y remettre un scanner
// serait revenir sur cet arbitrage par la petite porte, et un scanner qui se
// trompe sur un texte libre se trompe sur quelqu'un. Le coach lit, c'est tout.
//
// ⚠ ET IL EST BORNE, POUR LA MEME RAISON QUE LES NOTES DU COACH : chaque
// saveUser est un PUT du document ENTIER. Un texte libre non borne, dans un
// document reecrit a chaque sauvegarde, finit par deborder le quota — c'est le
// plafond reel de RepCore. La regle RTDB le borne aussi, comme coachNotes.
const MOT_COACH_MAX=600;
const MOT_COACH_MENTION='Ton coach le lit tel quel, tu peux le modifier ou '
  +'l’effacer quand tu veux. Ce n’est pas un message : il n’y a pas de '
  +'notification, il le verra en ouvrant ton dossier.';

// PURE. Le mot tel qu'il est stocke, ou null. Rend TOUJOURS la meme forme —
// un dossier revenu de Firebase peut avoir perdu l'objet et ne garder que la
// chaine, et les lecteurs en aval n'ont pas a s'en soucier.
function motCoach(user){
  const u=_dossier(user);
  const m=u&&u.motCoach;
  if(typeof m==='string'){
    const t=m.trim();
    return t?{texte:t.slice(0,MOT_COACH_MAX),maj:0}:null;
  }
  if(!m||typeof m!=='object') return null;
  const t=String(m.texte||'').trim();
  if(!t) return null;
  return {texte:t.slice(0,MOT_COACH_MAX),maj:Number(m.maj)||0};
}
// L'ECRITURE. Rend {ok} ou {ok:false,raison}. Vider EFFACE : un champ qu'on ne
// peut pas retirer devient un texte qu'on n'ose plus ecrire.
function poserMotCoach(user,texte){
  const u=_dossier(user);
  if(!u) return {ok:false,raison:'Aucun dossier ouvert.'};
  const brut=String(texte==null?'':texte);
  if(brut.length>MOT_COACH_MAX)
    return {ok:false,raison:'Ton mot fait '+brut.length+' caractères. Le maximum est '
      +MOT_COACH_MAX+' : l’essentiel tient dedans, et le reste se dit de vive voix.'};
  const t=brut.trim();
  if(!t){ delete u.motCoach; try{ saveUser(); }catch(e){ rcErreurMuette('poserMotCoach',e); } return {ok:true,efface:true}; }
  // ⚠ LE TEXTE EST STOCKE TEL QUEL. Pas de normalisation, pas de majuscule
  // initiale, pas de ponctuation ajoutee : « remonte tel quel » commence a
  // l'ecriture. Le seul traitement est l'echappement A L'AFFICHAGE.
  u.motCoach={texte:t,maj:Date.now()};
  try{ saveUser(); }catch(e){ rcErreurMuette('poserMotCoach',e); }
  return {ok:true};
}
// PURE. Le mot est-il NOUVEAU pour ce coach ? Le marqueur de lecture vit dans
// le dossier DU COACH — comme les notes — et non dans celui de l'athlete :
// ecrire chez l'athlete a chaque coup d'oeil ferait un PUT de son document
// entier pour un accuse de lecture.
function motCoachNouveau(coach,athlete){
  const m=motCoach(athlete);
  if(!m) return false;
  if(!(m.maj>0)) return false;
  const c=_dossier(coach);
  const id=String((athlete&&(athlete.id||athlete.email))||'');
  const lus=(c&&c.motsLus&&typeof c.motsLus==='object')?c.motsLus:{};
  const lu=Number(lus[id])||0;
  return m.maj>lu;
}
function marquerMotCoachLu(coach,athlete){
  const c=_dossier(coach);
  const m=motCoach(athlete);
  if(!c||!m||!(m.maj>0)) return false;
  const id=String((athlete&&(athlete.id||athlete.email))||'');
  if(!id) return false;
  if(!c.motsLus||typeof c.motsLus!=='object') c.motsLus={};
  if(Number(c.motsLus[id])>=m.maj) return false;   // deja lu : aucune ecriture
  c.motsLus[id]=m.maj;
  try{ saveUser(); }catch(e){ rcErreurMuette('marquerMotCoachLu',e); }
  return true;
}
// ── LA SURFACE DE L'ATHLETE ────────────────────────────────────────────
//
// REPLIE PAR DEFAUT QUAND IL EST VIDE : une zone de texte ouverte en
// permanence sur l'accueil est une question posee tous les jours, et une
// question posee tous les jours finit par ne plus rien recevoir.
let _motEdition=false;
