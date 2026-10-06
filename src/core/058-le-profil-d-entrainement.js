// ══ LE PROFIL D'ENTRAÎNEMENT (06/10/2026, build 1829) ═════════════════════
//
// Les seuils du plateau (MIN_JOURS, JOURS_PLATEAU), les repères de volume, la
// décote de reprise et le plafond de progression étaient LES MÊMES pour tout
// le monde : un débutant de deux mois et un pratiquant de dix ans, un lycéen
// et un retraité. Aucun ne lisait l'âge ni l'ancienneté.
//
// PURE. profilEntrainement(user) → {niveau, age, jeune, senior, source} :
//   - niveau 'auto' : moins de 6 mois d'historique, ou des e1RM de squat, de
//     développé couché et de soulevé de terre tous sous des rapports simples
//     au poids de corps (par sexe) → débutant ; plus de 3 ans d'historique ET
//     ces rapports tous élevés → avancé ; sinon intermédiaire ;
//   - user.niveauEntrainement, posé par le coach, l'emporte (source 'coach') ;
//   - jeune : âge < 18 ; senior : âge ≥ 60.
// Aucune question nouvelle à l'athlète : tout vient de ce qui est déjà saisi.
// Sans dossier, le profil est « intermédiaire » : les seuils d'avant.
const PROFIL_NIVEAUX=Object.freeze(['debutant','intermediaire','avance']);
const PROFIL_LIB=Object.freeze({debutant:'débutant',intermediaire:'intermédiaire',avance:'avancé'});
const PROFIL_DEBUTANT_JOURS=182;          // 6 mois
const PROFIL_AVANCE_JOURS=1095;           // 3 ans
const PROFIL_AGE_JEUNE=18, PROFIL_AGE_SENIOR=60;
// Les rapports e1RM / poids de corps, par sexe : sous `deb`, débutant ; à
// `avance` et au-delà, avancé. Des repères simples, à discuter avec le coach.
const PROFIL_RAPPORTS=Object.freeze({
  H:Object.freeze({squat:{deb:1.0,avance:1.75},developpe:{deb:0.8,avance:1.25},souleve:{deb:1.25,avance:2.0}}),
  F:Object.freeze({squat:{deb:0.75,avance:1.25},developpe:{deb:0.5,avance:0.85},souleve:{deb:1.0,avance:1.5}})
});
// Les seuils qui en découlent.
const PROFIL_SEUILS=Object.freeze({
  debutant:Object.freeze({minJours:14,joursPlateau:14,plafondSeance:0.10}),
  intermediaire:Object.freeze({minJours:21,joursPlateau:28,plafondSeance:0.10}),
  avance:Object.freeze({minJours:28,joursPlateau:49,plafondSeance:0.05})
});
const PROFIL_VOLUME_DEPART=0.8;           // débutant et senior, au départ
const PROFIL_RIR_MIN_JEUNE=1;             // moins de 18 ans : jamais l'échec
const _profilCache=new WeakMap();
// Le mouvement de référence d'un exercice, ou null (mêmes motifs que la
// consigne chiffrée de la morpho).
function _profilMouvement(nom){
  try{
    const s=_morphoSchemaChiffre(nom);
    return s==='squat'?'squat':s==='poussee-horizontale'?'developpe':s==='charniere-hanche'?'souleve':null;
  }catch(e){ return null; }
}
function profilEntrainement(user){
  const u=(user&&typeof user==='object')?user:null;
  const neutre={niveau:'intermediaire',age:null,jeune:false,senior:false,source:'auto',
    seuils:PROFIL_SEUILS.intermediaire};
  if(!u) return neutre;
  const ses=Array.isArray(u.sessions)?u.sessions:[];
  const cle=[u.updatedAt||0,ses.length,u.niveauEntrainement||'',u.birthdate||'',u.gender||'',(u.bilans||[]).length].join('|');
  const c=_profilCache.get(u);
  if(c&&c.cle===cle) return c.val;
  let age=null;
  try{ age=ageActuel(u); }catch(e){ age=null; }
  if(age==null){ try{ age=_ageUtilisateur(u); }catch(e){ age=null; } }
  const jeune=age!=null&&age<PROFIL_AGE_JEUNE, senior=age!=null&&age>=PROFIL_AGE_SENIOR;
  let niveau, source;
  if(PROFIL_NIVEAUX.indexOf(u.niveauEntrainement)>=0){ niveau=u.niveauEntrainement; source='coach'; }
  else {
    source='auto';
    const dates=ses.map(s=>Number(s&&s.date)||0).filter(t=>t>0);
    const jours=dates.length?(Date.now()-Math.min.apply(null,dates))/864e5:0;
    // Les rapports e1RM / poids de corps des trois mouvements mesurés.
    let pdc=null; try{ pdc=poidsReference(u); }catch(e){ pdc=null; }
    let femme=false; try{ femme=isFemale(u.gender||u._evol_gender||''); }catch(e){ femme=false; }
    const R=PROFIL_RAPPORTS[femme?'F':'H'];
    const best={};
    if(pdc>0) for(const s of ses){
      if(!s||!s.data||s.deload) continue;
      for(const nom of Object.keys(s.data)){
        const m=_profilMouvement(nom);
        if(!m) continue;
        let p=null; try{ p=perfExercice(s,nom,u); }catch(e){ p=null; }
        if(p&&p.score>0&&p.fiable) best[m]=Math.max(best[m]||0,p.score/pdc);
      }
    }
    const mesures=Object.keys(best);
    const tousSous=mesures.length&&mesures.every(m=>best[m]<R[m].deb);
    const tousHauts=mesures.length&&mesures.every(m=>best[m]>=R[m].avance);
    if(jours<PROFIL_DEBUTANT_JOURS||tousSous) niveau='debutant';
    else if(jours>=PROFIL_AVANCE_JOURS&&tousHauts) niveau='avance';
    else niveau='intermediaire';
  }
  const val={niveau,age,jeune,senior,source,seuils:PROFIL_SEUILS[niveau]};
  _profilCache.set(u,{cle,val});
  return val;
}
// Le multiplicateur de départ des repères de volume : ×0,8 pour un débutant
// ou un senior (la boucle de retour par muscle les ajuste ensuite).
function facteurVolumeProfil(user){
  // Le dossier d'un ATHLÈTE seulement : un coach ou un objet de calcul garde la table.
  if(!user||user.role!=='athlete') return 1;
  const p=profilEntrainement(user);
  return (p.niveau==='debutant'||p.senior)?PROFIL_VOLUME_DEPART:1;
}

// ── La fiche coach : une ligne, et le choix à trois boutons ──────────────
function ligneProfilCoach(c){
  if(!c||c._fromCode) return '';
  const p=profilEntrainement(c);
  const age=p.jeune?' · moins de 18 ans':p.senior?' · 60 ans et plus':'';
  return '<div class="ccd-profil" style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:4px">'
    +'Profil : '+escapeHtml(PROFIL_LIB[p.niveau])+' ('+(p.source==='coach'?'coach':'auto')+')'+escapeHtml(age)
    +' · <button type="button" class="ccd-profil-mod" onclick="ouvrirProfilCoach()" style="background:none;border:none;padding:0;margin:0;font:inherit;color:var(--sub);text-decoration:underline;cursor:pointer">modifier</button></div>';
}
function ouvrirProfilCoach(){
  const c=(()=>{ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  if(!c) return false;
  try{ closeModal(); }catch(e){}
  const p=profilEntrainement(c);
  const b=(n,lib)=>'<button type="button" class="btn '+(p.source==='coach'&&p.niveau===n?'btn-red':'btn-outline')
    +'" style="width:100%;margin:0 0 8px" onclick="poserProfilCoach('+_attrArg(n)+')">'+escapeHtml(lib)+'</button>';
  document.body.insertAdjacentHTML('beforeend',
    '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" style="background:var(--dark);border:1px solid var(--border);border-radius:var(--r-4) var(--r-4) 0 0;padding:20px;width:100%;max-width:520px">'
    +'<div style="font-size:var(--fs-lg);font-weight:800;margin-bottom:4px">Profil d’entraînement</div>'
    +'<div style="font-size:var(--fs-xs);color:var(--sub);line-height:1.6;margin-bottom:12px">Il règle les seuils de plateau, la progression proposée et les repères de volume de départ. Calculé : '
    +escapeHtml(PROFIL_LIB[(function(){ const x=Object.assign({},c); delete x.niveauEntrainement; return profilEntrainement(x).niveau; })()])+'.</div>'
    +b('debutant','Débutant')+b('intermediaire','Intermédiaire')+b('avance','Avancé')
    +(p.source==='coach'?'<button type="button" class="btn btn-outline btn-sm" style="width:100%;margin:4px 0 0" onclick="poserProfilCoach(null)">Revenir au calcul automatique</button>':'')
    +'</div></div>');
  return true;
}
// Écrit le choix du coach dans le dossier de l'athlète, par le chemin de
// toutes les écritures coach → athlète : carte users, DB.set, horodatage,
// CLOUD.pushOne.
function poserProfilCoach(niveau){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c||!c.email) return false;
  if(niveau&&PROFIL_NIVEAUX.indexOf(niveau)>=0) c.niveauEntrainement=niveau;
  else delete c.niveauEntrainement;
  c.updatedAt=Date.now();
  users[c.email]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(c.email,c);
  try{ closeModal(); }catch(e){}
  try{ _viderCachePlateau(); }catch(e){}
  try{ rendreFaitsCles(c); }catch(e){}
  toastSync(ok,envoi,'Profil : '+(niveau?PROFIL_LIB[niveau]:'automatique'),'le profil est');
  return true;
}
