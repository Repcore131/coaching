// ══ LA SENSATION, LES RÈGLES D'ADAPTATION, LA MOBILITÉ (build 1961) ═══════
// UNE QUESTION, FACULTATIVE, EN DEUX SECONDES : quand la dernière série d'un
// exercice est validée, un bandeau propose « Sensation ? » de 0 à 10
// (10 = parfait), et « Douleur » pour qui en a : son intensité de 0 à 10 et
// la zone (ZONES_ARTICULAIRES, celles des contraintes). Rien n'est
// obligatoire, rien ne bloque : sans réponse, aucune décision.
// La note vit DANS LA SÉANCE (sess.data[exercice].sensation) : elle part avec
// elle, se relit avec elle, et la règle se calcule depuis l'historique.
// LE LENDEMAIN MATIN, sur l'accueil (jusqu'à 14 h, comme le check-in) : une
// douleur notée la veille demande « ce matin : moins, pareil, plus fort ? ».
// regleSensation : ok | adapter (< 8 une fois) | remplacer (< 8 deux séances
// de suite : même schéma, ou le verdict de la fiche morpho M4 s'il en a un)
// | alerte (douleur > 3/10, ou plus forte le lendemain).
// ⚠ CE N'EST PAS UN OUTIL MÉDICAL. Au-delà de l'alerte, le message oriente
// vers un professionnel de santé ; aucune consigne de soin.
// LA MOBILITÉ : huit séances courtes (ROUTINES_MOBILITE), la routine du jour
// suit le profil fonctionnel actif (cheville verrouillée, hanche à butée
// précoce, épaule à amplitude limitée, chaîne postérieure raide).

const SENSATION_SEUIL=8;
const SENSATION_DOULEUR_ALERTE=3;
const SENSATION_HISTO=6;
const SENSATION_ADAPTATIONS=Object.freeze([
  Object.freeze({cle:'amplitude',lib:'Amplitude',note:'amplitude réduite à la zone confortable'}),
  Object.freeze({cle:'tempo',lib:'Tempo',note:'tempo contrôlé, 3 s à la descente'}),
  Object.freeze({cle:'charge',lib:'Charge',note:'charge −10 %'}),
  Object.freeze({cle:'volume',lib:'Volume',note:'une série de moins'})
]);
const SENSATION_DISCLAIMER='Ce n’est pas un avis médical : si la douleur persiste ou augmente, consulte un professionnel de santé.';
const _snNote=v=>{ const n=Number(v); return v!==''&&v!=null&&isFinite(n)&&n>=0&&n<=10?Math.round(n):null; };
/** PURE. L'historique des sensations d'un exercice, de la plus ancienne à la plus récente. */
function historiqueSensation(u,exNom){
  const nom=String(exNom||'').trim().toUpperCase(), out=[];
  for(const s of (u&&Array.isArray(u.sessions)?u.sessions:[])){
    if(!s||!s.data) continue;
    const k=Object.keys(s.data).find(x=>x.trim().toUpperCase()===nom);
    const x=k&&s.data[k]&&s.data[k].sensation;
    if(!x||(_snNote(x.note)==null&&_snNote(x.douleur)==null)) continue;
    out.push({date:Number(s.date)||0,note:_snNote(x.note),douleur:_snNote(x.douleur),zone:x.zone||null,lendemain:x.lendemain||null});
  }
  return out.sort((a,b)=>a.date-b.date).slice(-SENSATION_HISTO);
}
/**
 * PURE. La règle d'un exercice depuis son historique.
 * @returns {{regle:'ok'|'adapter'|'remplacer'|'alerte'|null, raison:string}}
 */
function regleSensation(hist){
  const l=(hist||[]).filter(x=>x&&(_snNote(x.note)!=null||_snNote(x.douleur)!=null));
  if(!l.length) return {regle:null,raison:'Aucune note : aucune décision.'};
  const d=l[l.length-1];
  if(_snNote(d.douleur)!=null&&d.douleur>SENSATION_DOULEUR_ALERTE) return {regle:'alerte',raison:'Douleur à '+d.douleur+'/10'+(d.zone?' ('+_snZoneLib(d.zone)+')':'')+' à la dernière séance.'};
  if(d.lendemain==='plus') return {regle:'alerte',raison:'Douleur plus forte le lendemain matin'+(d.zone?' ('+_snZoneLib(d.zone)+')':'')+'.'};
  // Les notes de sensation seules décident d'adapter ou de remplacer.
  const n=l.filter(x=>_snNote(x.note)!=null);
  if(_snNote(d.note)==null) return {regle:null,raison:'Douleur notée sans sensation : aucune décision au-delà de l’alerte.'};
  const p=n[n.length-2];
  if(d.note<SENSATION_SEUIL&&p&&p.note<SENSATION_SEUIL) return {regle:'remplacer',raison:'Sous '+SENSATION_SEUIL+'/10 deux séances de suite ('+p.note+' puis '+d.note+').'};
  if(d.note<SENSATION_SEUIL) return {regle:'adapter',raison:'Sensation à '+d.note+'/10 : on ajuste un paramètre avant de changer d’exercice.'};
  return {regle:'ok',raison:'Sensation à '+d.note+'/10.'};
}
const SN_ZONES_LIB=Object.freeze({'rachis-lombaire':'bas du dos','rachis-cervical':'nuque',epaule:'épaule',coude:'coude',poignet:'poignet',hanche:'hanche',genou:'genou',cheville:'cheville'});
function _snZoneLib(z){ return SN_ZONES_LIB[z]||String(z||''); }
/** L'alternative d'un exercice : le verdict de la fiche morpho (M4) s'il en a un, sinon le même schéma. */
function alternativeExercice(u,exNom){
  const nom=String(exNom||'').toUpperCase();
  try{
    const pr=morphoProfils(morphoAxes(u)).profils||[];
    for(const p of pr){
      const f=MORPHO_PROFILS.find(x=>x.cle===p.cle);
      for(const a of ((f&&f.amenager)||[])) if(a.variante&&a.variante.test(nom)&&a.variantes&&a.variantes.length)
        return {nom:a.variantes[0],source:'m4',pourquoi:f.lib+' : '+a.reglage};
    }
  }catch(e){}
  try{
    const sc=schemaDe({name:exNom},u);
    const v=(_variantesSchema(sc,4,{exclure:exNom})||[]).map(x=>typeof x==='string'?x:(x&&(x.name||x.nom))).filter(x=>x&&x.toUpperCase()!==nom);
    if(v.length) return {nom:v[0],source:'schema',pourquoi:'Même schéma ('+(SCHEMA_LIB[sc]||sc)+').'};
  }catch(e){}
  return null;
}

// ── La saisie, en fin d'exercice ──────────────────────────────────────────────
/** PURE. Tous les sets de travail validés ? */
function exerciceTermine(d){ const l=(d&&Array.isArray(d.sets))?d.sets:[]; return l.length>0&&l.every(s=>s&&s.done); }
function sensationProposer(idx){
  const d=woState&&woState.sessionData&&woState.sessionData[idx], ex=woState&&woState.exercises&&woState.exercises[idx];
  if(!d||!ex||isCardio(ex)||d.sensation||d._snVu||!exerciceTermine(d)) return false;
  d._snVu=true;
  const tb=document.getElementById('sets-body-'+idx);
  const ancre=tb&&(tb.closest('table')||tb);
  if(!ancre) return false;
  document.getElementById('sn-'+idx)?.remove();
  ancre.insertAdjacentHTML('afterend','<div class="sn-bande" id="sn-'+idx+'" role="group" aria-label="Sensation sur cet exercice">'
    +'<div class="sn-q">Sensation ? <span class="sub">10 = parfait, facultatif</span></div>'
    +'<div class="sn-notes">'+Array.from({length:11},(_,n)=>'<button type="button" class="sn-n" onclick="sensationNoter('+idx+','+n+')">'+n+'</button>').join('')+'</div>'
    +'<div class="sn-pied"><button type="button" class="rb-lien" onclick="sensationDouleur('+idx+')">J’ai une douleur</button>'
    +'<button type="button" class="rb-lien" onclick="document.getElementById(\'sn-'+idx+'\')?.remove()">Passer</button></div></div>');
  return true;
}
function sensationNoter(idx,n){
  const d=woState&&woState.sessionData&&woState.sessionData[idx]; if(!d) return false;
  d.sensation=Object.assign({},d.sensation||{},{note:Math.max(0,Math.min(10,Math.round(n)))});
  const z=document.getElementById('sn-'+idx);
  if(z&&!z.querySelector('.sn-dl')) z.remove();
  else if(z) z.querySelectorAll('.sn-n').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.textContent)===n)));
  try{ woPersist(); }catch(e){}
  return true;
}
function sensationDouleur(idx){
  const z=document.getElementById('sn-'+idx); if(!z||z.querySelector('.sn-dl')) return false;
  z.insertAdjacentHTML('beforeend','<div class="sn-dl"><label for="sn-i-'+idx+'">Douleur (0 à 10)</label>'
    +'<input id="sn-i-'+idx+'" type="number" inputmode="numeric" min="0" max="10">'
    +'<label for="sn-z-'+idx+'">Zone</label><select id="sn-z-'+idx+'">'+ZONES_ARTICULAIRES.map(k=>'<option value="'+k+'">'+escapeHtml(_snZoneLib(k))+'</option>').join('')+'</select>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="sensationDouleurOk('+idx+')">Enregistrer</button></div>');
  return true;
}
function sensationDouleurOk(idx){
  const d=woState&&woState.sessionData&&woState.sessionData[idx]; if(!d) return false;
  const v=_snNote((document.getElementById('sn-i-'+idx)||{}).value);
  const zone=(document.getElementById('sn-z-'+idx)||{}).value;
  if(v==null||ZONES_ARTICULAIRES.indexOf(zone)<0){ toast('Une intensité de 0 à 10, et la zone.','var(--orange)'); return false; }
  d.sensation=Object.assign({},d.sensation||{},{douleur:v,zone});
  document.getElementById('sn-'+idx)?.remove();
  try{ woPersist(); }catch(e){}
  if(v>SENSATION_DOULEUR_ALERTE) toast('Douleur notée. Ne force pas sur cet exercice. '+SENSATION_DISCLAIMER,'var(--orange)',7000);
  return true;
}

// ── Le lendemain matin ────────────────────────────────────────────────────────
/** PURE. La douleur de la veille à suivre ce matin : {sessIdx, ex, zone, douleur} ou null. */
function douleurAHier(u,maintenant){
  const t=Number(maintenant)||Date.now(), d=new Date(t);
  if(d.getHours()>=CHECKIN_HEURE_MAX) return null;
  const hier=localISODate(new Date(t-864e5));
  const l=(u&&Array.isArray(u.sessions))?u.sessions:[];
  for(let i=l.length-1;i>=0;i--){
    const s=l[i]; if(!s||!s.data||localISODate(new Date(Number(s.date)))!==hier) continue;
    for(const ex of Object.keys(s.data)){
      const x=s.data[ex]&&s.data[ex].sensation;
      if(x&&_snNote(x.douleur)>0&&!x.lendemain) return {sessIdx:i,ex,zone:x.zone||null,douleur:_snNote(x.douleur)};
    }
  }
  return null;
}
function rendreDouleurLendemain(u){
  const z=document.getElementById('clh-sensation'); if(!z) return false;
  const q=(u&&u.role!=='coach')?douleurAHier(u):null;
  if(!q){ z.hidden=true; z.innerHTML=''; return false; }
  z.innerHTML='<div class="rt-carte sn-matin"><div><b>Ta douleur d’hier</b><span>'+escapeHtml(String(q.ex).toLowerCase())+(q.zone?' · '+escapeHtml(_snZoneLib(q.zone)):'')+' · '+q.douleur+'/10. Ce matin ?</span></div>'
    +'<div class="rt-b sn-3">'+[['moins','Moins'],['pareil','Pareil'],['plus','Plus fort']].map(([k,l])=>'<button type="button" class="btn btn-outline btn-sm" onclick="douleurLendemain('+jsArg(k)+')">'+l+'</button>').join('')+'</div></div>';
  z.hidden=false;
  return true;
}
function douleurLendemain(k){
  const u=currentUser, q=douleurAHier(u); if(!q||['moins','pareil','plus'].indexOf(k)<0) return false;
  u.sessions[q.sessIdx].data[q.ex].sensation.lendemain=k;
  saveUserOuDire('Ta réponse');
  rendreDouleurLendemain(u);
  if(k==='plus') toast('C’est noté pour ton coach. Évite cet exercice tant que ça ne passe pas. '+SENSATION_DISCLAIMER,'var(--orange)',8000);
  else toast('Merci, c’est noté.','var(--green)');
  return true;
}

// ── Côté coach : les exercices sous 8/10 ──────────────────────────────────────
/** PURE. Les exercices du client avec une règle à jouer, alertes d'abord. */
function exercicesASurveiller(u){
  const noms=new Set();
  for(const s of ((u&&u.sessions)||[]).slice(-30)) if(s&&s.data) for(const k of Object.keys(s.data)) if(s.data[k]&&s.data[k].sensation) noms.add(k);
  const ordre={alerte:0,remplacer:1,adapter:2};
  return [...noms].map(n=>{ const h=historiqueSensation(u,n), r=regleSensation(h); return {nom:n,dernier:h[h.length-1],regle:r.regle,raison:r.raison}; })
    .filter(x=>x.regle&&x.regle!=='ok').sort((a,b)=>ordre[a.regle]-ordre[b.regle]);
}
function renderSensationCoach(c){
  const z=document.getElementById('ccd-sensation'); if(!z) return false;
  const l=c?exercicesASurveiller(c):[];
  if(!l.length){ z.innerHTML=''; return false; }
  const E=escapeHtml;
  z.innerHTML='<div class="sn-coach"><div class="sn-t">Exercices sous '+SENSATION_SEUIL+'/10</div>'+l.map(x=>{
    let act='';
    if(x.regle==='adapter') act='<div class="sn-act">'+SENSATION_ADAPTATIONS.map(a=>'<button type="button" class="btn btn-outline btn-sm" onclick="sensationAdapter('+jsArg(x.nom)+','+jsArg(a.cle)+')">'+E(a.lib)+'</button>').join('')+'</div>';
    else if(x.regle==='remplacer'){ const alt=alternativeExercice(c,x.nom);
      act=alt?'<div class="sn-act"><button type="button" class="btn btn-red btn-sm" onclick="sensationRemplacer('+jsArg(x.nom)+','+jsArg(alt.nom)+')">Remplacer par '+E(String(alt.nom).toLowerCase())+'</button><span class="sub">'+E(alt.pourquoi)+'</span></div>'
        :'<div class="sub">Aucune alternative trouvée : à choisir dans le programme.</div>'; }
    else act='<div class="sn-alerte">Ne pas pousser cet exercice tant que la douleur est là. '+E(SENSATION_DISCLAIMER)+'</div>';
    return '<div class="sn-l sn-'+x.regle+'"><b>'+E(String(x.nom).toLowerCase())+'</b><span>'+E(x.raison)+'</span>'+act+'</div>';
  }).join('')+'</div>';
  return true;
}
/** PURE (sur c). La proposition validée : la note s'ajoute à l'exercice dans les créneaux. Rend le nombre touché. */
function sensationAppliquer(c,exNom,quoi,remplacant){
  const nom=String(exNom||'').trim().toUpperCase(); let n=0;
  const a=SENSATION_ADAPTATIONS.find(x=>x.cle===quoi);
  for(const s of (Array.isArray(c&&c.sessions_config)?c.sessions_config:[])){
    for(const e of ((s&&s.exercises)||[])){
      if(!e||String(e.name||'').trim().toUpperCase()!==nom) continue;
      if(remplacant){ e.name=String(remplacant).toUpperCase(); n++; }
      else if(a&&String(e.note||'').indexOf(a.note)<0){ e.note=(e.note?String(e.note).trim()+' · ':'')+a.note; n++; }
    }
  }
  return n;
}
function _snCoachEcrire(fn,ok){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users); if(!c) return false;
  const n=fn(c);
  if(!n){ toast('Exercice introuvable dans le programme actif.','var(--orange)'); return false; }
  c.updatedAt=Date.now(); users[c.email]=c;
  toastSync(DB.set('users',users),CLOUD.pushOne(c.email,c),ok,'le programme est');
  renderSensationCoach(c);
  return true;
}
function sensationAdapter(nom,quoi){ return _snCoachEcrire(c=>sensationAppliquer(c,nom,quoi),'Consigne ajoutée '+ICO.coche); }
function sensationRemplacer(nom,par){ return _snCoachEcrire(c=>sensationAppliquer(c,nom,null,par),'Exercice remplacé '+ICO.coche); }

// ══ LA MOBILITÉ ═══════════════════════════════════════════════════════════════
// Le format de chaque zone : auto-massage 1-2 min, rotations contrôlées 3-6
// répétitions, mise en tension 1 cycle, étirement 2-3 min. Les exercices par
// zone sont un CONTENU DE TRAVAIL, à valider par Kevin.
const MOBILITE_FORMAT=Object.freeze([
  Object.freeze({cle:'massage',lib:'Auto-massage',duree:90,consigne:'1 à 2 min, pression modérée, on cherche les zones raides.'}),
  Object.freeze({cle:'rotation',lib:'Rotations contrôlées',duree:60,consigne:'3 à 6 répétitions lentes, sur toute l’amplitude sans douleur.'}),
  Object.freeze({cle:'tension',lib:'Mise en tension',duree:60,consigne:'1 cycle : 2 min en fin d’amplitude, contracte 10 s, relâche, gagne un peu.'}),
  Object.freeze({cle:'etirement',lib:'Étirement',duree:150,consigne:'2 à 3 min, respiration lente, jamais douloureux.'})
]);
const MOBILITE_ZONES=Object.freeze({
  chevilles:Object.freeze({lib:'chevilles',massage:'Mollets au rouleau',rotation:'Rotations de cheville',tension:'Genou au mur',etirement:'Étirement du mollet au mur'}),
  genoux:Object.freeze({lib:'genoux',massage:'Quadriceps au rouleau',rotation:'Rotations de genou assis',tension:'Flexion de genou à genoux',etirement:'Étirement du quadriceps debout'}),
  hanches:Object.freeze({lib:'hanches',massage:'Fessiers à la balle',rotation:'Rotations de hanche à quatre pattes',tension:'Position 90/90',etirement:'Fente basse, bassin rétroversé'}),
  lombaires:Object.freeze({lib:'lombaires',massage:'Carrés des lombes à la balle',rotation:'Dos rond, dos creux',tension:'Flexion avant assis, genoux fléchis',etirement:'Posture de l’enfant'}),
  thoracique:Object.freeze({lib:'thoracique',massage:'Haut du dos au rouleau',rotation:'Rotations thoraciques sur le côté',tension:'Extension sur le rouleau',etirement:'Ouverture « livre » allongé'}),
  epaules:Object.freeze({lib:'épaules',massage:'Pectoraux et dorsaux à la balle',rotation:'Rotations d’épaule debout',tension:'Bras au mur, glissés',etirement:'Étirement des pectoraux à l’encadrement'}),
  rachis:Object.freeze({lib:'rachis complet',massage:'Le long du dos au rouleau',rotation:'Enroulé-déroulé vertèbre par vertèbre',tension:'Torsion allongée',etirement:'Suspension à la barre'})
});
const ROUTINES_MOBILITE=Object.freeze([
  Object.freeze({n:1,zones:Object.freeze(['chevilles','genoux'])}),
  Object.freeze({n:2,zones:Object.freeze(['hanches','lombaires'])}),
  Object.freeze({n:3,zones:Object.freeze(['thoracique','epaules'])}),
  Object.freeze({n:4,zones:Object.freeze(['chevilles','hanches'])}),
  Object.freeze({n:5,zones:Object.freeze(['epaules','genoux'])}),
  Object.freeze({n:6,zones:Object.freeze(['rachis'])}),
  Object.freeze({n:7,zones:Object.freeze(['epaules','hanches'])}),
  Object.freeze({n:8,zones:Object.freeze(['chevilles','thoracique'])})
]);
// Le profil fonctionnel → les zones qui l'intéressent.
const MOBILITE_PROFIL_ZONES=Object.freeze({P9:'chevilles',P10:'hanches',P11:'epaules',P12:'lombaires'});
/** PURE. Les routines pour ces profils (toutes sans profil), et celle du jour (rotation). */
function routinesPourProfils(cles){
  const zones=(cles||[]).map(k=>MOBILITE_PROFIL_ZONES[k]).filter(Boolean);
  if(!zones.length) return ROUTINES_MOBILITE.slice();
  // Le dos raide se travaille aussi par le rachis complet.
  const z2=zones.indexOf('lombaires')>=0?zones.concat(['rachis']):zones;
  return ROUTINES_MOBILITE.filter(r=>r.zones.some(z=>z2.indexOf(z)>=0));
}
function routineDuJour(cles,date){
  const l=routinesPourProfils(cles);
  const d=date instanceof Date?date:new Date(date==null?Date.now():date);
  const j=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
  return l[((j%l.length)+l.length)%l.length];
}
/** PURE. Les étapes d'une routine : 4 par zone, au format de la séance courte. */
function etapesRoutine(r){
  const out=[];
  for(const z of (r&&r.zones)||[]) for(const f of MOBILITE_FORMAT) out.push({zone:z,cle:f.cle,lib:f.lib,exercice:MOBILITE_ZONES[z][f.cle],duree:f.duree,consigne:f.consigne});
  return out;
}
function _profilsFonctionnels(u){
  try{ return (morphoProfils(morphoAxes(u)).profils||[]).map(p=>p.cle).filter(k=>MOBILITE_PROFIL_ZONES[k]); }catch(e){ return []; }
}
// ── La séance courte, avec son minuteur ──────────────────────────────────────
let _mobEtat=null;
function _mobArreter(){ if(_mobEtat&&_mobEtat.minuteur){ clearInterval(_mobEtat.minuteur); _mobEtat.minuteur=null; } }
function ouvrirMobilite(){
  _mobArreter();
  const pr=_profilsFonctionnels(currentUser);
  const r=routineDuJour(pr,new Date());
  _mobEtat={r,etapes:etapesRoutine(r),i:0,fin:0,minuteur:null,profils:pr};
  rendreMobilite();
  go('s-mobilite');
  return true;
}
function mobLancer(){
  const s=_mobEtat; if(!s) return false;
  _mobArreter();
  s.fin=Date.now()+s.etapes[s.i].duree*1000;
  s.minuteur=setInterval(_mobTic,250);
  rendreMobilite();
  return true;
}
function _mobTic(){
  const s=_mobEtat; if(!s||!s.fin) return _mobArreter();
  const reste=Math.max(0,Math.ceil((s.fin-Date.now())/1000));
  const z=document.getElementById('mbs-chrono'); if(z) z.textContent=_fmtRepos(reste);
  if(reste<=0){ _mobArreter(); try{ arcHaptique('finRepos'); }catch(e){} mobSuivante(); }
}
function mobSuivante(){
  const s=_mobEtat; if(!s) return false;
  _mobArreter(); s.fin=0;
  if(s.i<s.etapes.length-1) s.i++; else s.finie=true;
  rendreMobilite();
  return true;
}
function quitterMobilite(){ _mobArreter(); _mobEtat=null; retourDe('s-mobilite','s-athlete-profile'); return true; }
function rendreMobilite(){
  const z=document.getElementById('mob-contenu'); if(!z) return false;
  const s=_mobEtat; if(!s){ z.innerHTML=''; return false; }
  const E=escapeHtml;
  const titre='<div class="mbs-t">Séance '+s.r.n+' · '+E(s.r.zones.map(k=>MOBILITE_ZONES[k].lib).join(' et '))+'</div>'
    +'<p class="sub mbs-pourquoi">'+(s.profils.length?'Choisie pour ton profil : '+E(s.profils.map(k=>(MORPHO_PROFILS.find(p=>p.cle===k)||{}).lib||k).join(', '))+'.':'Aucun profil fonctionnel actif : les huit séances tournent.')+'</p>';
  if(s.finie){ z.innerHTML=titre+'<div class="mbs-fin">Séance terminée. À demain.</div>'; return true; }
  const e=s.etapes[s.i];
  z.innerHTML=titre
    +'<div class="mbs-etape"><div class="mbs-n">'+(s.i+1)+' / '+s.etapes.length+' · '+E(e.lib)+'</div>'
    +'<div class="mbs-ex">'+E(e.exercice)+'</div><p class="mbs-c">'+E(e.consigne)+'</p>'
    +'<div class="mbs-chrono" id="mbs-chrono" role="timer">'+_fmtRepos(s.fin?Math.max(0,Math.ceil((s.fin-Date.now())/1000)):e.duree)+'</div>'
    +(s.fin?'<button type="button" class="btn btn-outline" style="width:100%" onclick="mobSuivante()">Suivant</button>'
      :'<button type="button" class="btn btn-red" style="width:100%" onclick="mobLancer()">Lancer</button>'
        +'<button type="button" class="rb-lien" onclick="mobSuivante()">Passer cette étape</button>')
    +'</div>'
    +'<ol class="mbs-liste">'+s.etapes.map((x,i)=>'<li class="'+(i<s.i?'fait':i===s.i?'cours':'')+'">'+E(x.exercice)+'</li>').join('')+'</ol>';
  return true;
}
