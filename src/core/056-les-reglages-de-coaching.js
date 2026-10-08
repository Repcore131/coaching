// ══ LES RÉGLAGES DE COACHING (06/10/2026, build 1811) ═════════════════════
//
// Constat de Kevin : aucun réglage de travail n'existait au niveau du coach.
// Chaque nouvel athlète repartait des valeurs d'usine (cadence au choix de
// l'athlète, aucun modèle de programme, ±20 kcal, aucune signature), et
// l'accueil imposait une vingtaine de blocs dans un ordre fixe.
//
// UN SEUL OBJET : currentUser.reglagesCoach. Rien d'autre n'est écrit par cet
// écran — un réglage absent vaut sa valeur d'origine, et « Réinitialiser »
// RETIRE la clé au lieu d'y écrire la valeur d'origine : le jour où l'origine
// change, un coach qui ne l'a jamais touchée suit.
//
//   cadence           {freq:1|2|4, jour:0-6} — donnée à tout NOUVEL athlète
//   programmeModeleId le modèle de départ des nouvelles invitations
//   formules          {ouverture, cloture} des brouillons de réponse
//   pasKcal           20 | 50 | 100 — le pas des boutons ± des cibles
//   signature         ajoutée à la fin des réponses aux bilans
//   calme             {de, a} : les heures où le coach ne reçoit pas de push
//   seuils            {jamaisDemarreH, inactifJours}
//   accueil           {ordre:[clés], masques:[clés]}
//
// ⚠ AUCUN RÉGLAGE N'EFFACE DE DONNÉE D'ATHLÈTE. Les dossiers existants ne
//   bougent pas ; seul « Appliquer à tous » (la cadence) les touche, après
//   (bouton « Enregistrer pour tous… » : R31, un seul verbe pour écrire),
//   confirmation, et seulement ceux que le coach a laissés cochés.
const REGLAGES_PAS=Object.freeze([20,50,100]);
const REGLAGES_SIGNATURE_MAX=80;
const REGLAGES_CALME_DEFAUT=Object.freeze({de:21,a:8});
// Les deux seuils qui ne vivent qu'à un endroit. Les autres (« Actifs 14 j »,
// l'échéance d'accès de urgencyScore) restent fixes : ils touchent la
// facturation et le classement d'urgence, verrouillés par leurs tests.
const REGLAGES_SEUILS=Object.freeze({
  jamaisDemarreH:Object.freeze({choix:[24,48,72,96],defaut:JAMAIS_DEMARRE_DELAI/3600e3,lib:'Inscrit sans séance',unite:' h'}),
  inactifJours:Object.freeze({choix:[7,10,14,21],defaut:INACTIF_DELAI/864e5,lib:'Liste « Inactifs »',unite:' j'})
});

// PURE. L'objet du coach, ou {}.
function reglagesDe(coach){
  const r=coach&&coach.reglagesCoach;
  return (r&&typeof r==='object')?r:{};
}
function _rgCoach(){ return (typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='coach')?currentUser:null; }
// PURE. Chaque lecture borne sa valeur : un réglage invalide vaut l'origine.
function reglageCadence(coach){ return bilanCadenceValide(reglagesDe(coach).cadence); }
function reglageModele(coach){
  const id=reglagesDe(coach).programmeModeleId;
  return (typeof id==='string'&&RC_MODELE_ID_RE.test(id))?id:'';
}
function reglagePasKcal(coach){
  const p=Number(reglagesDe(coach).pasKcal);
  return REGLAGES_PAS.indexOf(p)>=0?p:ATH_DELTA_PAS;
}
function reglageSignature(coach){
  const s=reglagesDe(coach).signature;
  return typeof s==='string'?s.replace(/\s+/g,' ').trim().slice(0,REGLAGES_SIGNATURE_MAX):'';
}
function reglageCalme(coach){
  const c=reglagesDe(coach).calme||{};
  const de=Number(c.de), a=Number(c.a);
  const ok=v=>Number.isInteger(v)&&v>=0&&v<=23;
  return (ok(de)&&ok(a)&&de!==a)?{de,a}:{de:REGLAGES_CALME_DEFAUT.de,a:REGLAGES_CALME_DEFAUT.a};
}
function reglageSeuil(coach,cle){
  const d=REGLAGES_SEUILS[cle];
  if(!d) return null;
  const v=Number((reglagesDe(coach).seuils||{})[cle]);
  return d.choix.indexOf(v)>=0?v:d.defaut;
}
// Le seuil en vigueur pour le coach connecté (l'origine ailleurs).
function seuilSignal(cle){ return reglageSeuil(_rgCoach(),cle); }

// ── L'HÉRITAGE, À LA CRÉATION ─────────────────────────────────────────────
// PURE. Ce qu'un NOUVEAU code d'athlète emporte : la cadence, et le modèle de
// départ quand l'appelant n'en a pas choisi un. _genAccessCode l'appelle ;
// createAthlete, _appliquerPayloadCode et le Worker (redeemCode) le posent.
function heritageCode(coach,extra){
  const o={};
  // SÉRIE 6 : la cadence n'est plus RECOPIÉE sur le nouvel athlète — il suit
  // le défaut du coach en direct (cadenceEffective), et un changement de
  // défaut l'atteint. La recopier en ferait un « réglage propre » figé.
  const cad=validerDefautBilan(coach&&coach.defautsCoach&&coach.defautsCoach.bilan)?null:reglageCadence(coach);
  if(cad) o.bilanCadence=cad;
  const dejaChoisi=extra&&extra.programmeModeleId;
  const mod=reglageModele(coach);
  if(!dejaChoisi&&mod) o.programmeModeleId=mod;
  return o;
}
// PURE (écrit dans u). La cadence du code, sur un dossier qui n'en a pas : un
// code ne remplace jamais une cadence déjà posée.
function heriterCadence(u,payload){
  const cad=bilanCadenceValide(payload&&payload.bilanCadence);
  if(!u||!cad||bilanCadenceValide(u.bilanCadence)) return false;
  u.bilanCadence=cad;
  return true;
}

// ── LA SIGNATURE ──────────────────────────────────────────────────────────
// PURE. Le texte tel qu'il part : la signature en dernière ligne, sauf si le
// coach l'a déjà écrite à la main.
function avecSignature(txt,coach){
  const t=String(txt||'').trim();
  const s=reglageSignature(coach===undefined?_rgCoach():coach);
  if(!t||!s) return t;
  return t.slice(-s.length).toLowerCase()===s.toLowerCase()?t:t+'\n\n'+s;
}

// ── LE PAS DES CALORIES ───────────────────────────────────────────────────
// Les boutons des cibles : l'origine (−100 −50 +50 +100) tant que le coach
// n'a rien choisi, sinon deux pas de chaque côté.
function nutPasCoach(){
  const c=_rgCoach();
  if(!c||!reglagesDe(c).pasKcal) return NUT_PAS;
  const p=reglagePasKcal(c);
  return [-2*p,-p,p,2*p];
}

// ══ L'ÉCRAN ════════════════════════════════════════════════════════════════
const _RG_FREQ_LIB={1:'chaque semaine',2:'toutes les 2 semaines',4:'toutes les 4 semaines'};
function _rgJour(j){ const s=BILAN_JOURS[j]||''; return s.charAt(0).toUpperCase()+s.slice(1); }
function _rgH(h){ return h+' h'; }
// PURE. La ligne : intitulé, contrôle, valeur d'origine, et « Réinitialiser »
// seulement quand le coach s'en est écarté.
function _htmlLigneReglage(cle,titre,controle,origine,touche){
  return '<div class="rg-l" data-rg="'+cle+'"><div class="rg-t">'+escapeHtml(titre)+'</div>'
    +controle
    +'<div class="rg-o"><span>par défaut : '+escapeHtml(origine)+'</span>'
    +(touche?'<button type="button" class="rg-reinit" onclick="reglageReinitialiser('+_attrArg(cle)+')">Réinitialiser</button>':'')
    +'</div></div>';
}
function _rgOpt(v,lib,sel){ return '<option value="'+escapeHtml(String(v))+'"'+(sel?' selected':'')+'>'+escapeHtml(lib)+'</option>'; }
function htmlReglagesCoach(coach){
  const r=reglagesDe(coach);
  const cad=reglageCadence(coach);
  const cadence=_htmlLigneReglage('cadence','Cadence de bilan des nouveaux athlètes',
    '<div class="bcad-l"><select id="rg-freq" aria-label="Fréquence" onchange="reglageCadenceChoisir()">'
      +_rgOpt('','Au choix de l’athlète',!cad)+[1,2,4].map(f=>_rgOpt(f,_RG_FREQ_LIB[f].charAt(0).toUpperCase()+_RG_FREQ_LIB[f].slice(1),cad&&cad.freq===f)).join('')+'</select>'
      +'<select id="rg-jour" aria-label="Jour" onchange="reglageCadenceChoisir()">'+[1,2,3,4,5,6,0].map(j=>_rgOpt(j,_rgJour(j),(cad?cad.jour:6)===j)).join('')+'</select></div>'
      +'<button type="button" class="btn btn-outline btn-sm rg-tous" onclick="ouvrirAppliquerCadence()"'+(cad?'':' disabled')+'>Enregistrer pour tous…</button>',
    '2 semaines, au choix de l’athlète',!!r.cadence);
  const mods=(()=>{ try{ return modelesDepartDe(coach); }catch(e){ return []; } })();
  const mod=reglageModele(coach);
  const modele=_htmlLigneReglage('programmeModeleId','Programme de départ des invitations',
    '<select id="rg-modele" class="rg-sel" aria-label="Modèle" onchange="reglageEcrire(\'programmeModeleId\',this.value||null)">'
      +_rgOpt('','Aucun',!mod)+mods.map(m=>_rgOpt(m.id,m.name,m.id===mod)).join('')
      +(mod&&!mods.some(m=>m.id===mod)?_rgOpt(mod,'Modèle introuvable',true):'')+'</select>',
    'aucun',!!r.programmeModeleId);
  const f=formulesReponse(coach);
  const formule=_htmlLigneReglage('formules','Formule de réponse aux bilans',
    '<input id="rg-ouv" class="rg-in" maxlength="'+BROUILLON_FORMULE_MAX+'" value="'+escapeHtml(f.ouverture)+'" aria-label="Ouverture" onchange="reglageFormulesEcrire()">'
      +'<input id="rg-clo" class="rg-in" maxlength="'+BROUILLON_FORMULE_MAX+'" value="'+escapeHtml(f.cloture)+'" aria-label="Clôture" onchange="reglageFormulesEcrire()">',
    '« '+BROUILLON_FORMULES_DEFAUT.ouverture+' » … « '+BROUILLON_FORMULES_DEFAUT.cloture+' »',!!r.formules);
  const pas=reglagePasKcal(coach);
  const pasKcal=_htmlLigneReglage('pasKcal','Pas des calories',
    '<div class="rg-choix">'+REGLAGES_PAS.map(p=>'<button type="button" class="btn btn-sm '+(p===pas&&r.pasKcal?'btn-red':'btn-outline')+'" onclick="reglageEcrire(\'pasKcal\','+p+')">'+p+' kcal</button>').join('')+'</div>',
    ATH_DELTA_PAS+' kcal',!!r.pasKcal);
  const signature=_htmlLigneReglage('signature','Signature ajoutée aux réponses',
    '<input id="rg-sig" class="rg-in" maxlength="'+REGLAGES_SIGNATURE_MAX+'" value="'+escapeHtml(reglageSignature(coach))+'" placeholder="ex. Kévin, ton coach" aria-label="Signature" onchange="reglageEcrire(\'signature\',this.value)">',
    'aucune',!!reglageSignature(coach));
  const cal=reglageCalme(coach);
  const heures=a=>Array.from({length:24},(_,h)=>_rgOpt(h,_rgH(h),h===a)).join('');
  const calme=_htmlLigneReglage('calme','Heures calmes de tes notifications',
    '<div class="bcad-l"><select id="rg-calme-de" aria-label="Début" onchange="reglageCalmeChoisir()">'+heures(cal.de)+'</select>'
      +'<select id="rg-calme-a" aria-label="Fin" onchange="reglageCalmeChoisir()">'+heures(cal.a)+'</select></div>'
      +'<div class="bcad-d">Ce qui arrive pendant ces heures t’attend au matin, en un seul push.</div>',
    _rgH(REGLAGES_CALME_DEFAUT.de)+' à '+_rgH(REGLAGES_CALME_DEFAUT.a),!!r.calme);
  const seuils=Object.keys(REGLAGES_SEUILS).map(k=>{
    const d=REGLAGES_SEUILS[k], v=reglageSeuil(coach,k);
    return _htmlLigneReglage('seuils.'+k,'Signal : '+d.lib,
      '<select class="rg-sel" id="rg-'+k+'" aria-label="'+escapeHtml(d.lib)+'" onchange="reglageSeuilEcrire('+_attrArg(k)+',this.value)">'
        +d.choix.map(x=>_rgOpt(x,x+d.unite,x===v)).join('')+'</select>',
      d.defaut+d.unite,(r.seuils||{})[k]!=null);
  }).join('');
  // Série 6, lot 1 : les lignes sont aussi rangées une à une dans « Mes réglages ».
  _rgDernieresLignes={cadence,modele,formule,pasKcal,signature,calme,seuils};
  return '<div class="rg">'+cadence+modele+formule+pasKcal+signature+calme+seuils
    +'<p class="bcad-d">'+RG_NOTE_EXISTANTS+'</p></div>';
}
const RG_NOTE_EXISTANTS='Ces réglages valent pour les athlètes et les codes créés à partir de maintenant. Les dossiers existants ne changent pas, et aucun réglage n’efface une donnée d’athlète. Les réglages propres à un athlète restent sur sa fiche.';
let _rgDernieresLignes=null;
// PURE (rend les lignes de htmlReglagesCoach, une par réglage).
function lignesReglagesCoach(coach){ htmlReglagesCoach(coach); return Object.assign({},_rgDernieresLignes||{}); }
function ouvrirReglagesCoach(){
  const c=_rgCoach();
  if(!c) return false;
  document.getElementById('modal-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Réglages de coaching" class="bcad-feuille rg-feuille">'
    +'<h2 style="margin-bottom:2px">Réglages de coaching</h2>'
    +'<div id="rg-corps">'+htmlReglagesCoach(c)+'</div>'
    +'<button type="button" class="btn btn-outline" style="margin-top:12px;width:100%" onclick="closeModal()">Fermer</button></div></div>');
  return true;
}
function _rgRepeindre(){
  const z=document.getElementById('rg-corps');
  if(z){ const c=_rgCoach(); if(c) z.innerHTML=htmlReglagesCoach(c); }
  try{ _rgxRendre(); }catch(e){}
}
// Le miroir des heures calmes : le Worker lit pushPrefs (une lecture qu'il
// fait déjà avant chaque push), pas reglagesCoach.
function _rgMiroirCalme(c){
  const r=reglagesDe(c);
  const p=(c.pushPrefs&&typeof c.pushPrefs==='object')?Object.assign({},c.pushPrefs):{};
  if(r.calme) p.calme=reglageCalme(c); else delete p.calme;
  c.pushPrefs=p;
}
// L'ÉCRIVAIN UNIQUE. `valeur` null (ou vide) retire la clé : c'est
// « Réinitialiser ». Rend l'objet écrit.
function reglageEcrire(cle,valeur,coach){
  const c=coach||_rgCoach();
  if(!c) return null;
  const r=Object.assign({},reglagesDe(c));
  const vide=valeur==null||valeur===''||(typeof valeur==='string'&&!valeur.trim());
  if(cle.indexOf('seuils.')===0){
    const k=cle.slice(7), s=Object.assign({},r.seuils||{});
    if(vide) delete s[k]; else s[k]=valeur;
    if(Object.keys(s).length) r.seuils=s; else delete r.seuils;
  } else if(vide) delete r[cle];
  else r[cle]=cle==='signature'?String(valeur).replace(/\s+/g,' ').trim().slice(0,REGLAGES_SIGNATURE_MAX):valeur;
  c.reglagesCoach=r;
  if(cle==='calme') _rgMiroirCalme(c);
  if(!coach){
    try{ saveUser(); }catch(e){ rcErreurMuette('reglageEcrire',e); }
    _rgRepeindre();
  }
  return r;
}
function reglageReinitialiser(cle){ return reglageEcrire(cle,null); }
function reglageCadenceChoisir(){
  const f=(document.getElementById('rg-freq')||{}).value, j=(document.getElementById('rg-jour')||{}).value;
  return reglageEcrire('cadence',f===''?null:bilanCadenceValide({freq:Number(f),jour:Number(j)}));
}
function reglageFormulesEcrire(){
  const lire=id=>String(((document.getElementById(id)||{}).value)||'').replace(/\s+/g,' ').trim().slice(0,BROUILLON_FORMULE_MAX);
  return reglageEcrire('formules',{ouverture:lire('rg-ouv'),cloture:lire('rg-clo')});
}
function reglageCalmeChoisir(){
  const de=Number((document.getElementById('rg-calme-de')||{}).value), a=Number((document.getElementById('rg-calme-a')||{}).value);
  if(de===a){ toast('Le début et la fin doivent différer.','var(--orange)'); _rgRepeindre(); return null; }
  return reglageEcrire('calme',{de,a});
}
function reglageSeuilEcrire(k,v){
  const d=REGLAGES_SEUILS[k];
  if(!d) return null;
  const n=Number(v);
  return reglageEcrire('seuils.'+k,(d.choix.indexOf(n)>=0&&n!==d.defaut)?n:null);
}

// ── « APPLIQUER À TOUS » : la cadence, sur confirmation ──────────────────
// PURE. Les dossiers concernés : ceux du coach, inscrits, dont la cadence
// diffère du réglage. `coche` : cochés d'office.
function cibleAppliquerCadence(clients,coach){
  const cad=reglageCadence(coach);
  if(!cad) return [];
  return (clients||[]).filter(c=>c&&!c._fromCode&&c.email).map(c=>{
    const cur=bilanCadenceValide(c.bilanCadence);
    return {c,actuelle:cur,identique:!!(cur&&cur.freq===cad.freq&&cur.jour===cad.jour)};
  }).filter(x=>!x.identique);
}
function _rgLibCadence(cad){ return cad?(_RG_FREQ_LIB[cad.freq]+', le '+BILAN_JOURS[cad.jour]):'au choix de l’athlète'; }
function ouvrirAppliquerCadence(){
  const c=_rgCoach(), cad=reglageCadence(c);
  if(!c||!cad) return false;
  const l=cibleAppliquerCadence(getClients(),c);
  document.getElementById('modal-overlay')?.remove();
  const lignes=l.length?l.map(x=>'<label class="rg-cible"><input type="checkbox" class="rg-cible-c" value="'+escapeHtml(String(x.c.id))+'" checked>'
      +'<span>'+escapeHtml(((x.c.fname||'')+' '+(x.c.lname||'')).trim()||x.c.email)+'</span><span class="rg-cible-a">'+escapeHtml(_rgLibCadence(x.actuelle))+'</span></label>').join('')
    :'<p class="bcad-d">Tous tes athlètes ont déjà cette cadence.</p>';
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Enregistrer pour tous" class="bcad-feuille rg-feuille">'
    +'<div class="bcad-t">Cadence '+escapeHtml(_rgLibCadence(cad))+'</div>'
    +'<div class="bcad-d" style="margin:0 0 10px">Décoche ceux qui gardent la leur. Leur échéance repartira de leur dernier bilan ; leurs questions ne changent pas.</div>'
    +lignes
    +'<div style="display:flex;gap:8px;margin-top:14px"><button type="button" class="btn btn-outline btn-sm" style="flex:1;margin:0" onclick="ouvrirReglagesCoach()">Annuler</button>'
    +(l.length?'<button type="button" class="btn btn-red btn-sm" style="flex:1;margin:0" onclick="appliquerCadenceConfirmee()">Enregistrer</button>':'')
    +'</div></div></div>');
  return true;
}
// Écrit la cadence du réglage sur les SEULS dossiers dont l'identifiant est
// passé. Rend le nombre de dossiers écrits.
function appliquerCadenceA(ids){
  const c=_rgCoach(), cad=reglageCadence(c);
  if(!c||!cad) return 0;
  const veut=new Set((ids||[]).map(String));
  const users=DB.get('users')||{};
  const faits=[];
  for(const id of veut){
    const a=getOwnedClient(id,users);
    if(!a||a._fromCode) continue;
    _cadenceAppliquer(a,cad.freq,cad.jour);
    users[a.email]=a; faits.push(a);
  }
  if(!faits.length) return 0;
  const ok=DB.set('users',users);
  toastSync(ok,Promise.all(faits.map(a=>CLOUD.pushOne(a.email,a))),'Cadence appliquée à '+faits.length+' athlète'+(faits.length>1?'s':'')+' '+ICO.coche,'la cadence est');
  return faits.length;
}
function appliquerCadenceConfirmee(){
  const ids=Array.from(document.querySelectorAll('.rg-cible-c')).filter(x=>x.checked).map(x=>x.value);
  if(!ids.length){ toast('Aucun athlète coché.','var(--orange)'); return Promise.resolve(0); }
  return rcConfirm('Enregistrer pour '+ids.length+' athlète'+(ids.length>1?'s':'')+' ?','Leur cadence de bilan sera remplacée. Rien d’autre ne change dans leur dossier.','Enregistrer','Annuler')
    .then(oui=>{
      if(!oui) return 0;
      const n=appliquerCadenceA(ids);
      ouvrirReglagesCoach();
      return n;
    });
}

// ══ PERSONNALISER L'ACCUEIL ═════════════════════════════════════════════════
// Chaque enfant direct de #ct-dashboard .pad porte data-acc="<clé>" ; une clé
// peut regrouper plusieurs éléments voisins (la liste : recherche, tri,
// sélection, fiches). L'ordre de cette table EST l'ordre d'origine.
// `fixe` : ne se masque pas (« Mes notifications », la recherche et la liste).
const ACCUEIL_BLOCS=Object.freeze([
  {cle:'point',lib:'Le point de la semaine'},
  {cle:'todo',lib:'Mes notifications',fixe:true},
  {cle:'inactifs',lib:'Athlètes silencieux'},
  {cle:'lundi',lib:'Le point du lundi'},
  {cle:'recettes',lib:'Mes recettes'},
  {cle:'messages',lib:'Messages'},
  {cle:'relances',lib:'Relances automatiques'},
  {cle:'prospects',lib:'Ma page et mes contacts'},
  {cle:'premiers',lib:'Premiers pas'},
  {cle:'titre',lib:'Titre et « Ajouter un athlète »'},
  {cle:'vignettes',lib:'Les ronds des athlètes'},
  {cle:'croissance',lib:'Arrivées par mois'},
  {cle:'kit',lib:'Mon kit de la semaine'},
  {cle:'recap',lib:'Récap de l’équipe'},
  {cle:'raccourcis',lib:'Annonces, groupe, CRM, code'},
  {cle:'portefeuille',lib:'Barre du portefeuille'},
  {cle:'chrono',lib:'Temps passé par athlète'},
  {cle:'pilotage',lib:'Pilotage'},
  {cle:'liste',lib:'Recherche et liste des athlètes',fixe:true},
  {cle:'paliers',lib:'Formule et paliers'},
  {cle:'programmes',lib:'Mes programmes'},
  {cle:'charges',lib:'Charges'},
  {cle:'tunnel',lib:'Tunnel commercial'},
  {cle:'reprise',lib:'À relancer'},
  {cle:'activite',lib:'Activité'},
  {cle:'decharge',lib:'Décharge groupée'},
  {cle:'invitations',lib:'En attente'},
  {cle:'jamais',lib:'Jamais démarré'}
]);
const _ACC_CLES=ACCUEIL_BLOCS.map(b=>b.cle);
function _accFixe(cle){ const b=ACCUEIL_BLOCS.find(x=>x.cle===cle); return !!(b&&b.fixe); }
function _accListe(v){ return (Array.isArray(v)?v:Object.values(v||{})).map(String); }
// PURE. {ordre, masques} en vigueur : l'ordre du coach complété des blocs
// qu'il ne connaît pas encore (à leur place d'origine), les masques sans les
// blocs fixes ni les clés inconnues.
function accueilEtat(coach){
  const a=reglagesDe(coach).accueil||{};
  const voulu=_accListe(a.ordre).filter((k,i,l)=>_ACC_CLES.indexOf(k)>=0&&l.indexOf(k)===i);
  const ordre=voulu.slice();
  _ACC_CLES.forEach((k,i)=>{
    if(ordre.indexOf(k)>=0) return;
    // Un bloc nouveau se range après son voisin d'origine.
    const avant=_ACC_CLES.slice(0,i).reverse().find(x=>ordre.indexOf(x)>=0);
    ordre.splice(avant?ordre.indexOf(avant)+1:0,0,k);
  });
  const masques=_accListe(a.masques).filter(k=>_ACC_CLES.indexOf(k)>=0&&!_accFixe(k));
  return {ordre,masques};
}
function _accEcrire(etat){
  const c=_rgCoach();
  if(!c) return null;
  const origine=etat.ordre.join()===_ACC_CLES.join()&&!etat.masques.length;
  reglageEcrire('accueil',origine?null:{ordre:etat.ordre.slice(),masques:etat.masques.slice()},c);
  try{ saveUser(); }catch(e){ rcErreurMuette('accueil',e); }
  appliquerAccueilCoach();
  return etat;
}
// Rend false pour un bloc fixe : il ne se masque pas.
function accueilBasculer(cle){
  if(_ACC_CLES.indexOf(cle)<0||_accFixe(cle)) return false;
  const e=accueilEtat(_rgCoach());
  const i=e.masques.indexOf(cle);
  if(i>=0) e.masques.splice(i,1); else e.masques.push(cle);
  _accEcrire(e); _accRepeindre();
  return true;
}
function accueilDeplacer(cle,sens){
  const e=accueilEtat(_rgCoach());
  const i=e.ordre.indexOf(cle), j=i+(sens<0?-1:1);
  if(i<0||j<0||j>=e.ordre.length) return false;
  e.ordre.splice(i,1); e.ordre.splice(j,0,cle);
  _accEcrire(e); _accRepeindre();
  return true;
}
function accueilRetablir(){
  const c=_rgCoach();
  if(!c) return false;
  reglageEcrire('accueil',null,c);
  try{ saveUser(); }catch(e){ rcErreurMuette('accueil',e); }
  appliquerAccueilCoach(); _accRepeindre();
  return true;
}
// Range les blocs dans l'ordre voulu et masque les autres. Ne déplace rien
// quand l'ordre est déjà le bon : loadCoachHome l'appelle à chaque réveil.
function appliquerAccueilCoach(){
  const pad=document.querySelector('#ct-dashboard > .pad');
  if(!pad) return false;
  const e=accueilEtat(_rgCoach());
  const els=Array.from(pad.children).filter(x=>x.dataset&&x.dataset.acc);
  const voulu=[];
  for(const k of e.ordre) for(const x of els) if(x.dataset.acc===k) voulu.push(x);
  const reste=els.filter(x=>voulu.indexOf(x)<0);
  const cible=voulu.concat(reste);
  if(cible.some((x,i)=>els[i]!==x)) for(const x of cible) pad.appendChild(x);
  for(const x of els) x.classList.toggle('acc-masque',e.masques.indexOf(x.dataset.acc)>=0);
  return true;
}
function _htmlPersoAccueil(){
  const e=accueilEtat(_rgCoach());
  const lib=k=>(ACCUEIL_BLOCS.find(b=>b.cle===k)||{}).lib||k;
  return e.ordre.map((k,i)=>{
    const fixe=_accFixe(k), vu=e.masques.indexOf(k)<0;
    return '<div class="acc-l'+(vu?'':' acc-l-off')+'" data-acc-l="'+k+'">'
      +(fixe?'<span class="acc-fixe">toujours</span>'
        :'<label class="acc-sw"><input type="checkbox"'+(vu?' checked':'')+' aria-label="Afficher '+escapeHtml(lib(k))+'" onchange="accueilBasculer('+_attrArg(k)+')"><span></span></label>')
      +'<span class="acc-lib">'+escapeHtml(lib(k))+'</span>'
      +'<button type="button" class="acc-fl" aria-label="Monter" onclick="accueilDeplacer('+_attrArg(k)+',-1)"'+(i?'':' disabled')+'>▲</button>'
      +'<button type="button" class="acc-fl" aria-label="Descendre" onclick="accueilDeplacer('+_attrArg(k)+',1)"'+(i<e.ordre.length-1?'':' disabled')+'>▼</button>'
      +'</div>';
  }).join('');
}
function _accRepeindre(){ const z=document.getElementById('acc-corps'); if(z) z.innerHTML=_htmlPersoAccueil(); }
function ouvrirPersoAccueil(){
  if(!_rgCoach()) return false;
  document.getElementById('modal-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Personnaliser l’accueil" class="bcad-feuille rg-feuille">'
    +'<h2 style="margin-bottom:2px">Personnaliser l’accueil</h2>'
    +'<p class="bcad-d" style="margin:0 0 10px">L’interrupteur affiche ou masque un bloc, ▲▼ le déplacent. « Mes notifications » et la recherche restent toujours là.</p>'
    +'<div id="acc-corps">'+_htmlPersoAccueil()+'</div>'
    +'<button type="button" class="btn btn-outline btn-sm" style="margin-top:12px;width:100%" onclick="accueilRetablir()">Rétablir l’accueil d’origine</button>'
    +'<button type="button" class="btn btn-outline" style="margin-top:8px;width:100%" onclick="closeModal()">Fermer</button></div></div>');
  return true;
}

// ══ UN SEUL COMPTE D'ATHLÈTES SUIVIS ═══════════════════════════════════════
// « Tu suis 7 athlètes » (formule, activité) et « Mes athlètes (avec suivi) 8 »
// comptaient deux choses : les athlètes actifs sur 60 jours, et la section
// de la liste. Le « Tu suis » compte désormais exactement ce que la liste
// range sous « avec suivi » dans sa vue par défaut : les dossiers du coach,
// hors invitations pas encore inscrites, dont le suivi n'est pas coupé. Le
// quota de la formule, lui, reste compté sur les athlètes ACTIFS
// (countActiveAthletes) et le dit sous ce nom.
function athletesSuivis(liste){
  let l=liste;
  if(!Array.isArray(l)){ try{ l=getClients()||[]; }catch(e){ l=[]; } }
  return l.filter(c=>c&&estSuivi(c)&&!_enAttenteInscription(c));
}
function nbAthletesSuivis(liste){ return athletesSuivis(liste).length; }
function texteTuSuis(n){ return 'Tu suis '+n+' athlète'+(n>1?'s':'')+'.'; }

// ══ MES RÉGLAGES (série 6, lot 1) ══════════════════════════════════════════
//
// UN SEUL ÉCRAN, s-coach-reglages, six sections <details> repliées :
//   identite · defauts · bilans · messages · affichage · aide.
// Les blocs de l'onglet PROFIL y ont été DÉPLACÉS tels quels (mêmes id, mêmes
// fonctions de remplissage) ; ils s'enregistrent à la SORTIE DU CHAMP :
//   reglageCoachEcrire(chemin, valeur) — l'écrivain des champs simples ;
//   reglageCoachBloc(cles, fn)          — un bloc historique (saveCoachDispo…)
//                                          rejoué sous capture, puis annulable.
// Dans les deux cas : « Enregistré ✓ — Annuler » pendant 10 s, et la perte de
// réseau est dite par toastSync (via toastSyncAnnulable). Les fonctions
// historiques restent les points d'entrée internes.
const RGX_SECTIONS=Object.freeze(['identite','defauts','bilans','messages','affichage','aide']);
const RGX_ANNULER_MS=10000;
const RGX_BROUILLON_CLE='rc_rgx_brouillon';
function _rgxCopie(v){ try{ return v===undefined?undefined:JSON.parse(JSON.stringify(v)); }catch(e){ return v; } }
function _rgxLire(o,chemin){ return String(chemin).split('.').reduce((x,k)=>(x&&typeof x==='object')?x[k]:undefined,o); }
function _rgxPoser(o,chemin,v){
  const ks=String(chemin).split('.'); let x=o;
  for(let i=0;i<ks.length-1;i++){ if(!x[ks[i]]||typeof x[ks[i]]!=='object') x[ks[i]]={}; x=x[ks[i]]; }
  const k=ks[ks.length-1];
  if(v===undefined||v===null) delete x[k]; else x[k]=v;
}
function _rgxPousser(){
  let p=null;
  try{ p=CLOUD.pushProfilCoach(currentUser); }catch(e){ p=Promise.reject(e); }
  return p;
}
// L'ÉCRIVAIN DES CHAMPS SIMPLES. Rend la promesse du toast.
function reglageCoachEcrire(chemin,valeur,o){
  const u=_rgCoach(); if(!u||!chemin) return null;
  const avant=_rgxCopie(_rgxLire(u,chemin));
  _rgxPoser(u,chemin,_rgxCopie(valeur));
  let ok=false; try{ ok=saveUser(); }catch(e){ rcErreurMuette('reglageCoachEcrire',e); }
  const defaire=()=>{ _rgxPoser(u,chemin,avant); try{ saveUser(); }catch(e){} try{ _rgxPousser(); }catch(e){}
    try{ _rgxRemplir(); }catch(e){} try{ (o&&o.apresAnnuler||(()=>{}))(); }catch(e){} };
  try{ _rgxResumes(); }catch(e){}
  return toastSyncAnnulable(ok,_rgxPousser(),'Enregistré '+ICO.coche,'le réglage est',defaire,RGX_ANNULER_MS);
}
// UN BLOC HISTORIQUE : `fn` écrit (saveCoachDispo, saveCoachBanners…). Son
// propre toast est capturé : le seul message est « Enregistré — Annuler »,
// et seulement si quelque chose a réellement changé.
function reglageCoachBloc(cles,fn){
  const u=_rgCoach(); if(!u) return null;
  const avant={}; cles.forEach(k=>{ avant[k]=_rgxCopie(u[k]); });
  const _ts=window.toastSync, _te=window.toastEcriture;
  let capte=null;
  window.toastSync=(ok,pr)=>{ capte={ok,pr}; return Promise.resolve(pr).catch(()=>{}); };
  window.toastEcriture=(ok)=>{ capte=capte||{ok,pr:Promise.resolve()}; return ok; };
  try{ fn(); }catch(e){ rcErreurMuette('reglageCoachBloc',e); }
  finally{ window.toastSync=_ts; window.toastEcriture=_te; }
  const change=cles.some(k=>JSON.stringify(u[k])!==JSON.stringify(avant[k]));
  try{ _rgxResumes(); }catch(e){}
  if(!change||!capte) return null;
  const defaire=()=>{ cles.forEach(k=>{ if(avant[k]===undefined) delete u[k]; else u[k]=avant[k]; });
    try{ saveUser(); }catch(e){} try{ _rgxPousser(); }catch(e){} try{ _rgxRemplir(); }catch(e){} };
  return toastSyncAnnulable(capte.ok,capte.pr,'Enregistré '+ICO.coche,'le réglage est',defaire,RGX_ANNULER_MS);
}
// UN TEXTE DU PROFIL (nom de team, accroche). Vider un nom qui existait
// demande confirmation : la chaîne vide, poussée, effacerait la valeur des
// autres appareils.
const RGX_CONFIRMER_VIDE=Object.freeze({teamName:'Effacer le nom de ta team ?',logo:'Retirer ton logo ?',signature:'Retirer ta signature ?'});
async function reglageCoachTexte(cle,el){
  const u=_rgCoach(); if(!u||!el) return null;
  const v=String(el.value||'').trim();
  const avant=String(u[cle]||'');
  _rgxBrouillonOublier(el.id);
  if(v===avant) return null;
  if(!v&&avant&&RGX_CONFIRMER_VIDE[cle]){
    const ok=await rcConfirm(RGX_CONFIRMER_VIDE[cle],'« '+avant+' » ne sera plus affiché à tes athlètes.','Effacer','Garder');
    if(!ok){ el.value=avant; return null; }
  }
  return reglageCoachEcrire(cle,v);
}
function reglageCoachDispo(){
  // Une absence cochée attend sa date de fin : on n'enregistre pas à moitié.
  const abs=document.getElementById('coach-dispo-abs'), au=document.getElementById('coach-dispo-au');
  if(abs&&abs.checked&&au&&!au.value) return null;
  return reglageCoachBloc(['dispo'],saveCoachDispo);
}
function reglageCoachBannieres(){ return reglageCoachBloc(['promoBanners'],saveCoachBanners); }
function reglageCoachTelephone(){
  const el=document.getElementById('coach-phone-input');
  if(el&&!String(el.value||'').trim()) return null;
  return reglageCoachBloc(['phone'],saveCoachPhone);
}
let _rgxMarqueT=0;
function reglageCoachMarque(){
  clearTimeout(_rgxMarqueT);
  _rgxMarqueT=setTimeout(()=>{ try{ mqEnregistrer(); }catch(e){ rcErreurMuette('reglageCoachMarque',e); } },600);
}
// UNE IMAGE (logo, signature) posée depuis Mes réglages : enregistrée tout de
// suite, annulable. Rend false hors de l'écran (l'appelant garde son toast).
function reglageCoachImage(input,champ,avant){
  if(!input||!input.closest||!input.closest('#s-coach-reglages')) return false;
  const u=_rgCoach(); if(!u) return false;
  let ok=false; try{ ok=saveUser(); }catch(e){}
  const defaire=()=>{ u[champ]=avant||''; try{ saveUser(); }catch(e){} try{ _rgxPousser(); }catch(e){} try{ _rgxRemplir(); }catch(e){} };
  try{ _rgxResumes(); }catch(e){}
  toastSyncAnnulable(ok,_rgxPousser(),'Enregistré '+ICO.coche,'le réglage est',defaire,RGX_ANNULER_MS);
  return true;
}
// LE BROUILLON : un rechargement au milieu d'une saisie ne perd rien.
function _rgxBrouillon(){ try{ const o=JSON.parse(localStorage.getItem(RGX_BROUILLON_CLE)||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
function _rgxBrouillonNoter(el){
  if(!el||!el.id||el.type==='file'||el.type==='checkbox') return;
  const b=_rgxBrouillon(); b[el.id]=String(el.value||'').slice(0,1200);
  try{ localStorage.setItem(RGX_BROUILLON_CLE,JSON.stringify(b)); }catch(e){}
}
function _rgxBrouillonOublier(id){
  const b=_rgxBrouillon(); if(!(id in b)) return;
  delete b[id]; try{ localStorage.setItem(RGX_BROUILLON_CLE,JSON.stringify(b)); }catch(e){}
}
function _rgxBrouillonRestaurer(){
  const b=_rgxBrouillon();
  Object.keys(b).forEach(id=>{ const el=document.getElementById(id); if(el&&el.closest&&el.closest('#s-coach-reglages')&&el.value!==b[id]) el.value=b[id]; });
}
try{
  document.addEventListener('input',e=>{ const t=e.target; if(t&&t.closest&&t.closest('#s-coach-reglages')&&/^(INPUT|TEXTAREA)$/.test(t.tagName)) _rgxBrouillonNoter(t); },true);
  document.addEventListener('change',e=>{ const t=e.target; if(t&&t.id&&t.closest&&t.closest('#s-coach-reglages')) setTimeout(()=>_rgxBrouillonOublier(t.id),0); },true);
}catch(e){}

// ── LES RÉSUMÉS D'UNE LIGNE ───────────────────────────────────────────────
// PURE. Le résumé de chaque section, tel qu'il s'affiche dans son titre.
function resumesReglagesCoach(c){
  const u=c||{}, r=reglagesDe(u), out={};
  const nom=String(u.teamName||'').trim();
  out.identite=(nom||'Nom de team à choisir')+(u.logo?' · logo':'')+(u.catchphrase?' · accroche':'');
  const mod=reglageModele(u);
  out.defauts=(mod?'programme de départ':'aucun programme de départ')+' · ±'+reglagePasKcal(u)+' kcal';
  try{ const _rm=resumeMethode(u); if(_rm) out.defauts+=' · méthode : '+_rm; }catch(e){}
  let cad=null; try{ cad=(typeof window.cadenceEffective==='function')?window.cadenceEffective(null,u):null; }catch(e){ cad=null; }
  if(!cad){ const x=reglageCadence(u); cad=x?{freq:x.freq,jour:x.jour,questions:[]}:null; }
  out.bilans=cad?(_RG_FREQ_LIB[cad.freq]||'')+', '+(BILAN_JOURS[cad.jour]||'')+((cad.questions||[]).length?' · '+cad.questions.length+' question'+(cad.questions.length>1?'s':''):''):'au choix de l’athlète';
  const d=u.dispo&&u.dispo.delaiH;
  out.messages=(d?'réponse sous '+d+' h':'délai non déclaré')+(r.formules?' · formule perso':'')+(reglageSignature(u)?' · signature':'');
  const nb=(u.promoBanners||[]).length;
  const _af=(u.defautsCoach&&AFFICHAGE_PROFILS[u.defautsCoach.affichage])?AFFICHAGE_PROFILS[u.defautsCoach.affichage].lib:'Complet';
  out.affichage=_af+' · '+(nb?nb+' bannière'+(nb>1?'s':''):'aucune bannière');
  let th=''; try{ th=themeChoisi(); }catch(e){ th=''; }
  out.aide=th==='clair'?'thème clair':th==='auto'?'thème auto':'thème sombre';
  return out;
}
function _rgxResumes(){
  const u=_rgCoach(); if(!u) return;
  const r=resumesReglagesCoach(u);
  RGX_SECTIONS.forEach(k=>{ const z=document.getElementById('rgx-res-'+k); if(z) z.textContent=r[k]||''; });
}
// ── LE RENDU ──────────────────────────────────────────────────────────────
function _htmlRgxMessages(c,l){
  return (l.formule||'')+(l.signature||'')
    +'<div class="rg-l"><div class="rg-t">Modèles de messages</div>'
      +'<button type="button" class="rb-lien" onclick="ouvrirGestionModeles()">Gérer mes modèles</button></div>'
    +'<div class="rg-l"><div class="rg-t">Relances automatiques</div>'
      +'<div class="rg-o"><span id="rgx-relances-res">'+escapeHtml(_rgxResumeRelances(c))+'</span>'
      +'<button type="button" class="rb-lien" onclick="ouvrirRelances()">Ouvrir</button></div></div>'
    +(l.calme||'')+(l.seuils||'');
}
function _rgxResumeRelances(c){
  try{
    if(relancesEnPause(c)) return 'en pause';
    const r=relancesRegles(c); const n=RELANCE_SIGNAUX.filter(s=>r[s].actif).length;
    return n?n+' règle'+(n>1?'s':'')+' allumée'+(n>1?'s':''):'coupées';
  }catch(e){ return ''; }
}
function _rgxRendre(){
  const u=_rgCoach(); if(!u||!document.getElementById('s-coach-reglages')) return false;
  const l=lignesReglagesCoach(u);
  const pose=(id,h)=>{ const z=document.getElementById(id); if(z) z.innerHTML=h; };
  pose('rgx-defauts',_htmlRgxPrescription(u)+_htmlRgxMethode(u)+(l.modele||'')+(l.pasKcal||'')+'<p class="bcad-d">'+RG_NOTE_EXISTANTS+'</p>');
  pose('rgx-bilans',_htmlRgxBilans(u));
  pose('rgx-messages',_htmlRgxMessages(u,l));
  pose('rgx-affichage',_htmlRgxAffichage(u)+'<p class="prf-sub">Les bannières s’affichent en bas de l’accueil de tes athlètes.</p>');
  _rgxResumes();
  return true;
}
// Ce que remplissait l'onglet PROFIL (les mêmes id), puis le brouillon.
function _rgxRemplir(){
  try{ loadMonetisationTab(); }catch(e){}
  try{ const e=document.getElementById('coach-slogan'); const u=_rgCoach(); if(e&&u) e.value=u.slogan||''; }catch(e){}
  try{ renderMarqueCoach(); }catch(e){}
  try{ rendrePrefsAide(); }catch(e){}
  try{ _rgxRendre(); }catch(e){}
  try{ _rgxBrouillonRestaurer(); }catch(e){}
}
let _rgxRetour='s-coach-home';
function ouvrirMesReglages(section){
  const u=_rgCoach(); if(!u) return false;
  const act=(document.querySelector('.screen.active')||{}).id;
  if(act&&act!=='s-coach-reglages') _rgxRetour=act;
  go('s-coach-reglages');
  _rgxRemplir();
  if(section){ const d=document.getElementById('rgx-s-'+section); if(d) d.open=true; }
  return true;
}
function fermerMesReglages(){
  go(_rgxRetour||'s-coach-home');
  if(_rgxRetour==='s-coach-home'){ try{ coachTab('profil'); }catch(e){} }
}

// ══ SÉRIE 6, LOT 2 — LE DÉFAUT DE BILAN DU COACH ═══════════════════════════
// defautsCoach.bilan = {freq:1|2|4, jour:0..6, questions:[≤3 de ≤120],
//   _precedent:{…}} — suivi EN DIRECT par chaque athlète sans réglage propre
// (cadenceEffective). Changer de défaut ouvre une feuille : la liste des
// athlètes qui le suivent, avec l'échéance recalculée de chacun, puis
//   « Appliquer aussi aux N athlètes » — ils suivent le nouveau défaut ;
//   « Seulement aux nouveaux »          — leur cadence actuelle est FIGÉE sur
//                                          leur dossier (réglage propre).
// Un athlète qui a déjà un réglage propre n'est jamais touché.
// PURE. Le défaut saisi, normalisé ; null = « au choix de l'athlète ».
function validerDefautBilan(x){
  const c=_cadValide(x);
  if(!c) return null;
  return {freq:c.freq,jour:c.jour,questions:_cadQuestions(x&&x.questions)};
}
// PURE. Les athlètes qui suivent le défaut (aucune cadence propre).
function suiveursDefautBilan(clients){
  return (clients||[]).filter(c=>c&&!c._fromCode&&c.role!=='coach'&&!_cadValide(c.bilanCadence));
}
// PURE. L'aperçu : l'échéance de chacun avant et après, et qui passerait en
// retard d'un coup. coachAvant / coachApres : le coach avec l'ancien et le
// nouveau défaut.
function apercuDefautBilan(clients,coachAvant,coachApres,maintenant){
  const t=Number(maintenant)||Date.now();
  return suiveursDefautBilan(clients).map(c=>{
    const a=echeanceBilan(c,t,coachAvant), b=echeanceBilan(c,t,coachApres);
    return {id:c.id,email:c.email,prenom:String(c.fname||c.email||'').split(/\s+/)[0],
      avant:a.echeance,apres:b.echeance,retard:b.retardJours!=null&&b.retardJours>=1&&!(a.retardJours!=null&&a.retardJours>=1)};
  });
}
const _RGX_JOURS_ORDRE=[1,2,3,4,5,6,0];
function _htmlRgxBilans(coach){
  const d=validerDefautBilan(coach&&coach.defautsCoach&&coach.defautsCoach.bilan)||(()=>{ const r=defautBilanCoach(coach); return r; })();
  const opt=(v,lib,sel)=>'<option value="'+v+'"'+(sel?' selected':'')+'>'+escapeHtml(lib)+'</option>';
  const q=(d&&d.questions)||[];
  const prec=coach&&coach.defautsCoach&&coach.defautsCoach.bilan&&coach.defautsCoach.bilan._precedent;
  return '<div class="rg-l"><div class="rg-t">Cadence de bilan par défaut</div>'
    +'<div class="bcad-l"><select id="rgx-b-freq" aria-label="Fréquence" onchange="rgxBilanChanger()">'
      +opt('','Au choix de l’athlète',!d)+[1,2,4].map(f=>opt(f,_RG_FREQ_LIB[f].charAt(0).toUpperCase()+_RG_FREQ_LIB[f].slice(1),d&&d.freq===f)).join('')+'</select>'
    +'<select id="rgx-b-jour" aria-label="Jour" onchange="rgxBilanChanger()">'+_RGX_JOURS_ORDRE.map(j=>opt(j,_rgJour(j),(d?d.jour:6)===j)).join('')+'</select></div></div>'
    +'<div class="rg-l"><div class="rg-t">Tes questions en fin de bilan</div>'
    +[0,1,2].map(i=>'<input class="rg-in bcad-q" id="rgx-b-q'+(i+1)+'" maxlength="'+QUESTION_COACH_LONG+'" value="'+escapeHtml(q[i]||'')+'" placeholder="Question '+(i+1)+' (facultative)" onchange="rgxBilanChanger()">').join('')
    +'<div class="rg-o"><span>Jusqu’à trois, 120 caractères. Elles s’ajoutent au bilan de chaque athlète qui n’a pas ses propres questions.</span></div></div>'
    +(prec?'<div class="rg-o"><button type="button" class="rg-reinit" onclick="rgxBilanPrecedent()">Revenir au défaut d’avant</button></div>':'')
    +'<p class="bcad-d">Chaque athlète sans réglage propre suit ce défaut, y compris les nouveaux élèves invités. Un réglage posé sur une fiche n’est jamais touché.</p>';
}
function _rgxBilanSaisi(){
  const v=id=>(document.getElementById(id)||{}).value;
  const f=v('rgx-b-freq');
  if(f===''||f==null) return null;
  return validerDefautBilan({freq:Number(f),jour:Number(v('rgx-b-jour')),questions:[1,2,3].map(i=>v('rgx-b-q'+i)||'')});
}
// Le coach tel qu'il serait avec ce défaut (pour l'aperçu, sans rien écrire).
function _coachAvecDefaut(coach,bilan){
  const c=Object.assign({},coach);
  const d=Object.assign({},coach.defautsCoach||{});
  if(bilan) d.bilan=bilan; else delete d.bilan;
  c.defautsCoach=d;
  if(!bilan&&c.reglagesCoach&&c.reglagesCoach.cadence){ c.reglagesCoach=Object.assign({},c.reglagesCoach); delete c.reglagesCoach.cadence; }
  return c;
}
function rgxBilanChanger(){
  const u=_rgCoach(); if(!u) return false;
  const nouveau=_rgxBilanSaisi();
  const ancien=defautBilanCoach(u);
  const cadenceChange=JSON.stringify(ancien&&{f:ancien.freq,j:ancien.jour})!==JSON.stringify(nouveau&&{f:nouveau.freq,j:nouveau.jour});
  let clients=[]; try{ clients=getClients(); }catch(e){ clients=[]; }
  const ap=cadenceChange?apercuDefautBilan(clients,u,_coachAvecDefaut(u,nouveau),Date.now()):[];
  if(!ap.length) return defautBilanAppliquer(nouveau,'tous');
  _rgxFeuilleBilan(nouveau,ap);
  return true;
}
function _rgxFeuilleBilan(nouveau,ap){
  document.getElementById('modal-overlay')?.remove();
  const jr=t=>t?new Date(t).toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}):'après son 1er bilan';
  const lignes=ap.map(x=>'<li><b>'+escapeHtml(x.prenom)+'</b> <span>'+escapeHtml(jr(x.avant))+' → '+escapeHtml(jr(x.apres))+'</span>'
    +(x.retard?' <span class="rgx-retard">passerait en retard</span>':'')+'</li>').join('');
  const nRet=ap.filter(x=>x.retard).length;
  window._rgxBilanEnAttente=nouveau;
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal();rgxBilanAbandonner()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Changer le défaut de bilan" class="bcad-feuille">'
    +'<div class="bcad-t">'+ap.length+' athlète'+(ap.length>1?'s suivent':' suit')+' ton défaut</div>'
    +'<ul class="rgx-apercu">'+lignes+'</ul>'
    +(nRet?'<div class="bcad-d rgx-retard">'+nRet+' passerai'+(nRet>1?'ent':'t')+' en retard d’un coup : « Pour les nouveaux seulement » garde leur échéance actuelle.</div>':'')
    +'<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">'
    +'<button type="button" class="btn btn-red btn-m" id="rgx-b-tous" onclick="defautBilanAppliquer(window._rgxBilanEnAttente,\'tous\')">Enregistrer pour les '+ap.length+' athlète'+(ap.length>1?'s':'')+'</button>'
    +'<button type="button" class="btn btn-outline btn-m" id="rgx-b-nouveaux" onclick="defautBilanAppliquer(window._rgxBilanEnAttente,\'nouveaux\')">Enregistrer pour les nouveaux seulement</button>'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="closeModal();rgxBilanAbandonner()">Annuler</button></div></div></div>');
}
function rgxBilanAbandonner(){ window._rgxBilanEnAttente=null; try{ _rgxRendre(); }catch(e){} }
// L'ÉCRITURE. mode 'tous' : seul le défaut change. mode 'nouveaux' : la
// cadence ACTUELLE de chaque suiveur est figée sur son dossier, avant.
function defautBilanAppliquer(nouveau,mode){
  const u=_rgCoach(); if(!u) return false;
  try{ closeModal(); }catch(e){}
  window._rgxBilanEnAttente=null;
  const avantDefauts=_rgxCopie(u.defautsCoach);
  const ancien=validerDefautBilan(u.defautsCoach&&u.defautsCoach.bilan);
  const figes=[];
  if(mode==='nouveaux'){
    const users=DB.get('users')||{};
    let clients=[]; try{ clients=getClients(); }catch(e){ clients=[]; }
    for(const c0 of suiveursDefautBilan(clients)){
      const c=users[c0.email]; if(!c) continue;
      const cad=cadenceEffective(c,u);
      figes.push({email:c.email,q:c.questionsCoach});
      c.bilanCadence={freq:cad.freq,jour:cad.jour};
      if(!_cadQuestions(c.questionsCoach).length&&cad.questions.length) c.questionsCoach=cad.questions.slice();
      c.updatedAt=Date.now(); users[c.email]=c;
    }
    if(figes.length){ DB.set('users',users); figes.forEach(f=>{ CLOUD.pushOne(f.email,users[f.email]); }); }
  }
  const d=Object.assign({},u.defautsCoach||{});
  if(nouveau) d.bilan=Object.assign({},nouveau,ancien?{_precedent:ancien}:{});
  else if(ancien) d.bilan={_precedent:ancien};
  else delete d.bilan;
  u.defautsCoach=d;
  let ok=false; try{ ok=saveUser(); }catch(e){}
  const defaire=()=>{
    if(avantDefauts===undefined) delete u.defautsCoach; else u.defautsCoach=avantDefauts;
    try{ saveUser(); }catch(e){} try{ _rgxPousser(); }catch(e){}
    if(figes.length){ const us=DB.get('users')||{};
      figes.forEach(f=>{ const c=us[f.email]; if(!c) return; delete c.bilanCadence; if(f.q===undefined) delete c.questionsCoach; else c.questionsCoach=f.q; c.updatedAt=Date.now(); us[c.email]=c; });
      DB.set('users',us); figes.forEach(f=>{ CLOUD.pushOne(f.email,us[f.email]); }); }
    try{ _rgxRendre(); }catch(e){}
  };
  try{ _rgxRendre(); }catch(e){}
  return toastSyncAnnulable(ok,_rgxPousser(),figes.length?'Défaut enregistré, '+figes.length+' athlète'+(figes.length>1?'s':'')+' gardent leur cadence '+ICO.coche:'Défaut enregistré '+ICO.coche,'le défaut est',defaire,RGX_ANNULER_MS);
}
function rgxBilanPrecedent(){
  const u=_rgCoach(); const p=u&&u.defautsCoach&&u.defautsCoach.bilan&&u.defautsCoach.bilan._precedent;
  if(!p) return false;
  return defautBilanAppliquer(validerDefautBilan(p),'tous');
}
// PURE. Ce que coach_public reçoit : le défaut de bilan, et seulement lui.
// Série 6, lot 4 : et le profil d'affichage par défaut (l'athlète doit le lire).
function defautsCoachPublics(coach){
  const out={};
  const b=validerDefautBilan(coach&&coach.defautsCoach&&coach.defautsCoach.bilan);
  if(b) out.bilan={freq:b.freq,jour:b.jour,questions:b.questions};
  const a=coach&&coach.defautsCoach&&coach.defautsCoach.affichage;
  if(AFFICHAGE_PROFILS[a]&&a!=='complet') out.affichage=a;
  try{ const me=methodePublique(coach); if(me) out.methode=me; }catch(e){}
  return Object.keys(out).length?out:null;
}

// ══ SÉRIE 6, LOT 3 — LA PRESCRIPTION PAR DÉFAUT ════════════════════════════
// defautsCoach.prescription = {series 1-10, reps (texte ≤12), repos (texte lu
// par parseRepos), rir ('' ou 0..5), dechargeSeriesPct 40-90, dechargeRirPlus
// 0-3}. Sans réglage : exactement l'historique (3, '10', '2 min', rir '',
// 60 %, +1). Changer un défaut ne modifie AUCUN exercice déjà écrit.
const PRESCRIPTION_HISTORIQUE=Object.freeze({series:3,reps:'10',repos:REPOS_DEFAUT,rir:'',dechargeSeriesPct:60,dechargeRirPlus:1});
const _borne=(v,a,b)=>Math.min(b,Math.max(a,v));
// PURE. Le repos tel qu'on l'écrit partout (« 2 min », « 1 min 30 », « 45 s »),
// ou un refus motivé. Un nombre nu ≤ 10 se lit en minutes, au-delà en
// secondes ; hors 10 s - 10 min, ramené à la borne la plus proche.
function normaliserRepos(brut){
  const t=String(brut==null?'':brut).trim().toLowerCase().replace(/,/g,'.');
  if(!t) return {ok:false,msg:'Le repos est vide.'};
  let sec=null;
  if(/^\d+(\.\d+)?$/.test(t)){ const n=parseFloat(t); sec=n<=10?n*60:n; }
  else{
    const m=t.match(/^(\d+(?:\.\d+)?)\s*(?:m|mn|min|minutes?)\s*(\d+)?\s*(?:s|sec|secondes?)?$/);
    const sx=t.match(/^(\d+(?:\.\d+)?)\s*(?:s|sec|secondes?)$/);
    if(m) sec=parseFloat(m[1])*60+(m[2]?parseInt(m[2],10):0);
    else if(sx) sec=parseFloat(sx[1]);
    else{ const p=parseRepos(t); sec=p; }
  }
  if(sec==null||!isFinite(sec)) return {ok:false,msg:'« '+String(brut).trim()+' » ? Écris par exemple « 2 min », « 1 min 30 » ou « 90 s ».'};
  sec=_borne(Math.round(sec),REPOS_MIN,REPOS_MAX);
  const mn=Math.floor(sec/60), ss=sec%60;
  const texte=mn?(mn+' min'+(ss?' '+String(ss).padStart(2,'0'):'')):(ss+' s');
  return {ok:true,texte,sec};
}
// PURE. La prescription saisie, bornée : {valeur, notes:[…]} ou {erreur}.
function validerPrescription(p){
  const x=p||{}, out={}, notes=[];
  const num=(v,a,b,cle,lib)=>{ if(v===''||v==null) return; const n=Math.round(Number(String(v).replace(',','.')));
    if(!isFinite(n)) return; const b2=_borne(n,a,b); if(b2!==n) notes.push(lib+' ramené à '+b2); out[cle]=b2; };
  num(x.series,1,10,'series','Séries');
  if(x.reps!=null&&String(x.reps).trim()!==''){ const r=String(x.reps).replace(/\s+/g,'').slice(0,12); if(/^\d+([-–]\d+)?$/.test(r)||/^[\w-]{1,12}$/.test(r)) out.reps=r.replace('–','-'); }
  if(x.repos!=null&&String(x.repos).trim()!==''){ const r=normaliserRepos(x.repos); if(!r.ok) return {erreur:r.msg,champ:'repos'}; out.repos=r.texte; }
  if(x.rir!=null&&String(x.rir).trim()!==''){ const r=String(x.rir).trim(); if(RIR_CIBLE_ECHELLE.some(e=>e.v===r&&r!=='')) out.rir=r; }
  num(x.dechargeSeriesPct,40,90,'dechargeSeriesPct','Décharge');
  num(x.dechargeRirPlus,0,3,'dechargeRirPlus','RIR de décharge');
  return {valeur:out,notes};
}
function _prescriptionDe(coach){
  const p=coach&&coach.defautsCoach&&coach.defautsCoach.prescription;
  const v=(p&&typeof p==='object')?validerPrescription(p).valeur||{}:{};
  return Object.assign({},PRESCRIPTION_HISTORIQUE,v);
}
// PURE. L'exercice neuf : les valeurs du coach, sinon l'historique. Les QUATRE
// chemins de création (séance vierge, éditeur, addExercise, banque) passent
// par elle.
function exerciceVierge(coach){
  const p=_prescriptionDe(coach);
  return {name:'',series:p.series,reps:p.reps,repos:p.repos,description:'',image:null,
    videoUrl:'',ss:false,methodeSeries:'',rir:p.rir};
}
// PURE. Le facteur de séries et le RIR ajouté d'une semaine de décharge.
function facteurDecharge(coach){ return _prescriptionDe(coach).dechargeSeriesPct/100; }
function rirDecharge(coach){ return _prescriptionDe(coach).dechargeRirPlus; }
// Le coach dont la prescription s'applique dans l'éditeur : le coach connecté.
function _coachPrescription(){ return (typeof currentUser!=='undefined'&&currentUser&&currentUser.role==='coach')?currentUser:null; }
// PURE. « Nouvel exercice : 4 × 8-10 · 2 min 30 · RIR 2 »
function apercuPrescription(coach){
  const p=_prescriptionDe(coach);
  return 'Nouvel exercice : '+p.series+' × '+p.reps+' · '+p.repos+(p.rir!==''?' · RIR '+p.rir:'')
    +' — décharge : '+p.dechargeSeriesPct+' % des séries, RIR +'+p.dechargeRirPlus;
}
function _htmlRgxPrescription(coach){
  const brut=(coach&&coach.defautsCoach&&coach.defautsCoach.prescription)||{};
  const ph=PRESCRIPTION_HISTORIQUE;
  const ch=(cle,lib,attrs)=>'<label class="rgx-pr-c"><span>'+lib+'</span><input id="rgx-pr-'+cle+'" class="rg-in" '+attrs
    +' value="'+escapeHtml(brut[cle]==null?'':String(brut[cle]))+'" placeholder="'+escapeHtml(String(ph[cle]===''?'-':ph[cle]))+'" onchange="rgxPrescriptionChanger()"></label>';
  return '<div class="rg-l"><div class="rg-t">Prescription d’un nouvel exercice</div>'
    +'<div class="rgx-pr">'
    +ch('series','Séries','type="number" inputmode="numeric" min="1" max="10"')
    +ch('reps','Répétitions','type="text" maxlength="12" autocomplete="off"')
    +ch('repos','Repos','type="text" maxlength="16" autocomplete="off"')
    +'<label class="rgx-pr-c"><span>RIR</span><select id="rgx-pr-rir" class="rg-in" onchange="rgxPrescriptionChanger()">'
      +RIR_CIBLE_ECHELLE.map(e=>'<option value="'+e.v+'"'+(String(brut.rir==null?'':brut.rir)===e.v?' selected':'')+'>'+escapeHtml(e.lib)+'</option>').join('')+'</select></label>'
    +ch('dechargeSeriesPct','Décharge (% séries)','type="number" inputmode="numeric" min="40" max="90"')
    +ch('dechargeRirPlus','Décharge (RIR +)','type="number" inputmode="numeric" min="0" max="3"')
    +'</div>'
    +'<div class="rg-o" id="rgx-pr-apercu"><span>'+escapeHtml(apercuPrescription(coach))+'</span></div>'
    +'<div class="rgx-pr-msg" id="rgx-pr-msg" role="status"></div>'
    +'<p class="bcad-d">Changer ces valeurs ne modifie aucun exercice déjà écrit : seuls les exercices ajoutés ensuite les prennent.</p></div>';
}
function rgxPrescriptionChanger(){
  const u=_rgCoach(); if(!u) return false;
  const v=k=>(document.getElementById('rgx-pr-'+k)||{}).value;
  const r=validerPrescription({series:v('series'),reps:v('reps'),repos:v('repos'),rir:v('rir'),dechargeSeriesPct:v('dechargeSeriesPct'),dechargeRirPlus:v('dechargeRirPlus')});
  const msg=document.getElementById('rgx-pr-msg');
  if(r.erreur){ if(msg) msg.textContent=r.erreur; const e=document.getElementById('rgx-pr-'+r.champ); if(e) e.style.borderColor='var(--orange)'; return false; }
  ['repos'].forEach(k=>{ const e=document.getElementById('rgx-pr-'+k); if(e) e.style.borderColor=''; });
  if(msg) msg.textContent=r.notes.join(' · ');
  const val=Object.keys(r.valeur).length?r.valeur:null;
  const res=reglageCoachEcrire('defautsCoach.prescription',val,{apresAnnuler:()=>{ try{ _rgxRendre(); }catch(e){} }});
  // La valeur normalisée revient dans les champs (« 150 » → « 2 min 30 »).
  try{ _rgxRendre(); const m2=document.getElementById('rgx-pr-msg'); if(m2) m2.textContent=r.notes.join(' · '); }catch(e){}
  return res;
}

// ══ SÉRIE 6, LOT 4 — CE QUE VOIENT MES ÉLÈVES ══════════════════════════════
// Trois profils d'affichage. Chacun liste les MODULES qu'il masque ; aucun
// ne réaffiche ce qu'une autre source a masqué :
//   · l'athlète lui-même (masquerPoids) ; · le garde-fou TCA (aTCA) ;
//   · l'exception posée par le coach sur CE dossier (affichageCoach) ;
//   · le défaut du coach (defautsCoach.affichage).
// moduleVisible rend false dès qu'UNE source masque. Masquer n'efface aucune
// donnée : seul l'affichage change, et « Complet » rend tout ce que
// l'athlète n'a pas masqué lui-même.
const AFFICHAGE_MODULES=Object.freeze(['kcal','poids','pesee','checkinMatin','faim','social','sommeil','nutritionMacros']);
const AFFICHAGE_PROFILS=Object.freeze({
  complet:Object.freeze({lib:'Complet',phrase:'Tout s’affiche : calories, poids, pesée, check-in, défis entre amis.',masque:Object.freeze([])}),
  sansChiffres:Object.freeze({lib:'Sans chiffres',phrase:'Ni calories ni poids : les grammes et les portions restent, la balance disparaît.',masque:Object.freeze(['kcal','poids','pesee'])}),
  essentiel:Object.freeze({lib:'Essentiel',phrase:'L’entraînement et le check-in seulement : rien à compter, rien à comparer.',masque:Object.freeze(['kcal','poids','pesee','faim','social','nutritionMacros'])})
});
// PURE. Le profil qui s'applique à un athlète : son exception, sinon le défaut du coach.
function affichageDe(athlete,coach){
  const a=athlete&&athlete.affichageCoach;
  if(AFFICHAGE_PROFILS[a]) return {profil:a,source:'athlete'};
  const d=coach&&coach.defautsCoach&&coach.defautsCoach.affichage;
  if(AFFICHAGE_PROFILS[d]) return {profil:d,source:'coach'};
  return {profil:'complet',source:'repcore'};
}
// PURE. false dès qu'une source masque ; jamais l'inverse.
function moduleVisible(athlete,coach,module){
  const a=athlete||{};
  if(module==='poids'||module==='pesee'){
    if(a.masquerPoids) return false;
    try{ if(aTCA(a)) return false; }catch(e){}
  }
  const p=AFFICHAGE_PROFILS[affichageDe(a,coach).profil];
  return !(p&&p.masque.indexOf(module)>=0);
}
// Le module pour l'athlète connecté (son coach retrouvé : local + coach_public).
function moduleVisibleAth(u,module){
  const x=u||(typeof currentUser!=='undefined'?currentUser:null);
  if(!x||x.role==='coach') return true;
  let c=null; try{ c=_coachDeAthlete(x); }catch(e){ c=null; }
  return moduleVisible(x,c,module);
}
function _htmlRgxAffichage(coach){
  const cur=(coach&&AFFICHAGE_PROFILS[coach.defautsCoach&&coach.defautsCoach.affichage])?coach.defautsCoach.affichage:'complet';
  return '<div class="rgx-aff" role="radiogroup" aria-label="Ce que voient mes élèves">'
    +Object.keys(AFFICHAGE_PROFILS).map(k=>{ const p=AFFICHAGE_PROFILS[k];
      return '<label class="rgx-aff-c'+(k===cur?' on':'')+'"><input type="radio" name="rgx-aff" value="'+k+'"'+(k===cur?' checked':'')
        +' onchange="rgxAffichageChoisir(this.value)"><b>'+escapeHtml(p.lib)+'</b><span>'+escapeHtml(p.phrase)+'</span></label>'; }).join('')
    +'</div><p class="bcad-d">Le défaut de tous tes élèves ; une fiche peut avoir son exception. Masquer n’efface aucune donnée, et rien ne réaffiche ce qu’un élève a masqué lui-même.</p>';
}
function rgxAffichageChoisir(k){
  if(!AFFICHAGE_PROFILS[k]) return false;
  return reglageCoachEcrire('defautsCoach.affichage',k==='complet'?null:k,{apresAnnuler:()=>{ try{ _rgxRendre(); }catch(e){} }});
}
// La ligne de la fiche : « Affichage : suit ton défaut · changer ».
function htmlAffichageFiche(c){
  const coach=_rgCoach();
  const a=affichageDe(c,coach);
  const lib=AFFICHAGE_PROFILS[a.profil].lib;
  const opt=(v,l,sel)=>'<option value="'+v+'"'+(sel?' selected':'')+'>'+escapeHtml(l)+'</option>';
  return '<div class="aff-fiche"><span>Affichage : '+(a.source==='athlete'?escapeHtml(lib)+' (propre à cet élève)':'suit ton défaut ('+escapeHtml(lib)+')')+'</span>'
    +' <select aria-label="Changer l’affichage de cet élève" onchange="affichageFicheChoisir(this.value)">'
    +opt('','Suivre mon défaut',a.source!=='athlete')+Object.keys(AFFICHAGE_PROFILS).map(k=>opt(k,AFFICHAGE_PROFILS[k].lib,a.source==='athlete'&&a.profil===k)).join('')+'</select></div>';
}
function affichageFicheChoisir(v){
  const users=DB.get('users')||{};
  const c=getOwnedClient(currentClientId,users);
  if(!c) return false;
  const avant=c.affichageCoach;
  if(AFFICHAGE_PROFILS[v]) c.affichageCoach=v; else delete c.affichageCoach;
  c.updatedAt=Date.now(); users[c.email]=c;
  const ok=DB.set('users',users);
  const defaire=()=>{ const us=DB.get('users')||{}, x=us[c.email]; if(!x) return;
    if(avant===undefined) delete x.affichageCoach; else x.affichageCoach=avant; x.updatedAt=Date.now(); us[x.email]=x; DB.set('users',us);
    CLOUD.pushOne(x.email,x); try{ _rendreAffichageFiche(x); }catch(e){} };
  try{ _rendreAffichageFiche(c); }catch(e){}
  return toastSyncAnnulable(ok,CLOUD.pushOne(c.email,c),'Affichage enregistré '+ICO.coche,'l’affichage est',defaire,RGX_ANNULER_MS);
}
function _rendreAffichageFiche(c){
  const z=document.getElementById('ccd-affichage'); if(z) z.innerHTML=htmlAffichageFiche(c);
}
// Chez l'athlète, dans ses Réglages : une phrase, sans détail.
function htmlAffichageAthlete(u){
  if(!u||u.role==='coach') return '';
  let c=null; try{ c=_coachDeAthlete(u); }catch(e){}
  return affichageDe(u,c).profil!=='complet'?'<p class="prf-sub aff-simplifie">Ton coach a simplifié ton affichage.</p>':'';
}

// ══ SÉRIE 6, LOT 6 — MA MÉTHODE ════════════════════════════════════════════
// defautsCoach.methode = {reperesVolume:{MUSCLE:{mev?,mrv?}}, methodesRegles:
// {cle:{maxParSemaine?,coutFatigue?}}}. Une case vide = la valeur RepCore
// (affichée en placeholder). Ordre de lecture : table < ma méthode < mesure
// sur l'athlète < réglage posé sur l'athlète (reperesEffectifs).
function _methodeDe(coach){ const m=coach&&coach.defautsCoach&&coach.defautsCoach.methode; return (m&&typeof m==='object')?m:{}; }
// PURE. Le résumé d'une ligne (« 3 muscles, 1 méthode ajustés »), ou ''.
function resumeMethode(coach){
  const m=_methodeDe(coach);
  const nv=Object.keys(m.reperesVolume||{}).length, nm=Object.keys(m.methodesRegles||{}).length;
  if(!nv&&!nm) return '';
  const p=[];
  if(nv) p.push(nv+' muscle'+(nv>1?'s':''));
  if(nm) p.push(nm+' méthode'+(nm>1?'s':''));
  return p.join(', ')+' ajusté'+((nv+nm)>1?'s':'');
}
function _htmlRgxMethode(coach){
  const m=_methodeDe(coach), rv=m.reperesVolume||{}, mr=m.methodesRegles||{};
  const v=(o,k)=>(o&&o[k]!=null)?String(o[k]):'';
  const muscles=Object.keys(REPERES_VOLUME);
  const lignes=muscles.map(M=>{
    const t=reperesTable(M), o=rv[M]||{};
    return '<div class="rgx-mt-l"><span class="rgx-mt-n">'+escapeHtml((MUSCLES[M]||{}).lib||M)+'</span>'
      +'<input id="rgx-mv-'+M+'-mev" class="rg-in" type="number" inputmode="numeric" min="0" max="'+REPERE_VOL_MAX+'" aria-label="MEV '+escapeHtml((MUSCLES[M]||{}).lib||M)+'" placeholder="'+t.mev+'" value="'+escapeHtml(v(o,'mev'))+'" onchange="rgxMethodeVolume(\''+M+'\')">'
      +'<input id="rgx-mv-'+M+'-mrv" class="rg-in" type="number" inputmode="numeric" min="0" max="'+REPERE_VOL_MAX+'" aria-label="MRV '+escapeHtml((MUSCLES[M]||{}).lib||M)+'" placeholder="'+t.mrv+'" value="'+escapeHtml(v(o,'mrv'))+'" onchange="rgxMethodeVolume(\''+M+'\')"></div>';
  }).join('');
  const meth=METHODES.map(x=>{
    const o=mr[x.cle]||{};
    return '<div class="rgx-mt-l"><span class="rgx-mt-n">'+escapeHtml(x.lib)+'</span>'
      +'<input id="rgx-mm-'+x.cle+'" class="rg-in" type="number" inputmode="numeric" min="0" max="'+METHODE_MAX_SEMAINE+'" aria-label="'+escapeHtml(x.lib)+' par semaine" placeholder="'+x.maxParSemaine+'" value="'+escapeHtml(v(o,'maxParSemaine'))+'" onchange="rgxMethodeRegle(\''+x.cle+'\')"><span></span></div>';
  }).join('');
  const res=resumeMethode(coach);
  return '<details class="rg-l rgx-mt" id="rgx-methode"><summary class="rg-t">Ma méthode<span class="rgx-res">'+escapeHtml(res||'valeurs RepCore')+'</span></summary>'
    +'<p class="bcad-d">Séries dures par semaine. Case vide : la valeur RepCore, en gris. Ce que la mesure ou ton réglage sur un athlète décide passe devant.</p>'
    +'<div class="rgx-mt-l rgx-mt-h"><span></span><span>MEV</span><span>MRV</span></div>'+lignes
    +'<div class="rgx-mt-l rgx-mt-h"><span>Méthodes</span><span>max / sem.</span><span></span></div>'+meth
    +'<div class="rgx-pr-msg" id="rgx-mt-msg" role="status"></div>'
    +(res?'<button type="button" class="rb-lien" onclick="rgxMethodeRepcore()">Revenir aux valeurs RepCore</button>':'')
    +'</details>';
}
function _rgxMethodeEcrit(chemin,val){
  const r=reglageCoachEcrire(chemin,val,{apresAnnuler:()=>{ try{ _methodeCacheVider(); _viderCacheVolume(); }catch(e){} try{ _rgxRendre(); }catch(e){} }});
  try{ _methodeCacheVider(); _viderCacheVolume(); }catch(e){}
  return r;
}
function _rgxMethodeOuverte(){ try{ const d=document.getElementById('rgx-methode'); return !!(d&&d.open); }catch(e){ return false; } }
function _rgxMethodeRouvrir(ouv){ try{ _rgxRendre(); if(ouv){ const d=document.getElementById('rgx-methode'); if(d) d.open=true; } }catch(e){} }
function rgxMethodeVolume(M){
  const u=_rgCoach(); if(!u) return false;
  const g=k=>document.getElementById('rgx-mv-'+M+'-'+k);
  const brut={mev:(g('mev')||{}).value,mrv:(g('mrv')||{}).value};
  const r=validerRepereVolume(M,brut);
  const msg=document.getElementById('rgx-mt-msg');
  if(!r.ok){ if(msg) msg.textContent=((MUSCLES[M]||{}).lib||M)+' : '+r.erreur; ['mev','mrv'].forEach(k=>{ const e=g(k); if(e) e.style.borderColor='var(--orange)'; }); return false; }
  if(msg) msg.textContent='';
  const ouv=_rgxMethodeOuverte();
  const res=_rgxMethodeEcrit('defautsCoach.methode.reperesVolume.'+M,r.valeur);
  _rgxMethodeRouvrir(ouv);
  return res;
}
function rgxMethodeRegle(cle){
  const u=_rgCoach(); if(!u) return false;
  const e=document.getElementById('rgx-mm-'+cle);
  const anc=(_methodeDe(u).methodesRegles||{})[cle]||{};
  const r=validerRegleMethode(cle,Object.assign({},anc,{maxParSemaine:e?e.value:''}));
  const msg=document.getElementById('rgx-mt-msg');
  if(!r.ok){ if(msg) msg.textContent=r.erreur; if(e) e.style.borderColor='var(--orange)'; return false; }
  if(msg) msg.textContent='';
  const ouv=_rgxMethodeOuverte();
  const res=_rgxMethodeEcrit('defautsCoach.methode.methodesRegles.'+cle,r.valeur);
  _rgxMethodeRouvrir(ouv);
  return res;
}
function rgxMethodeRepcore(){
  const u=_rgCoach(); if(!u) return false;
  const ouv=_rgxMethodeOuverte();
  const res=_rgxMethodeEcrit('defautsCoach.methode',null);
  _rgxMethodeRouvrir(ouv);
  return res;
}
// PURE. La méthode publiée (coach_public) : seulement ce qui est valide.
function methodePublique(coach){
  const out={};
  const rv=reperesMethode(coach); if(rv) out.reperesVolume=rv;
  const mr=_reglesMethodeCoach(null,coach); if(Object.keys(mr).length) out.methodesRegles=mr;
  return Object.keys(out).length?out:null;
}

// ── LA FICHE VOLUME : « Ajuster pour cet athlète » ────────────────────────
// Écrit user.reperesVolume (gagne sur tout) et user.poidsTechnique (le
// facteur des techniques que l'athlète pratique). Case vide = niveau du
// dessus (mesure, ma méthode, RepCore). Annulable 10 s.
function htmlAjusterVolumeAthlete(c){
  const u=_dossier(c); if(!u) return '';
  const muscles=Object.keys(REPERES_VOLUME);
  const rv=(u.reperesVolume&&typeof u.reperesVolume==='object')?u.reperesVolume:{};
  const SRC={coach:'cet athlète',perso:'mesuré',methode:'ta méthode',table:'réf.'};
  const lignes=muscles.map(M=>{
    let ss=null; try{ const sv=u.reperesVolume; delete u.reperesVolume; try{ ss=reperesEffectifs(u,M); }finally{ if(sv!==undefined) u.reperesVolume=sv; } }catch(e){ ss=null; }
    const o=rv[M]||{}, eff=reperesEffectifs(u,M)||{};
    return '<div class="rgx-mt-l rgx-mt-4"><span class="rgx-mt-n">'+escapeHtml((MUSCLES[M]||{}).lib||M)+'</span>'
      +['mev','mrv'].map(k=>'<input id="avx-'+M+'-'+k+'" class="rg-in" type="number" inputmode="numeric" min="0" max="'+REPERE_VOL_MAX+'" aria-label="'+k.toUpperCase()+' '+escapeHtml((MUSCLES[M]||{}).lib||M)+'" placeholder="'+(ss&&ss[k]!=null?ss[k]:'')+'" value="'+(o[k]!=null?escapeHtml(String(o[k])):'')+'" onchange="ajusterVolumeAthlete(\''+M+'\')">').join('')
      +'<span class="rgx-mt-s">'+escapeHtml(SRC[eff.source]||'réf.')+'</span></div>';
  }).join('');
  let fams=[]; try{ fams=_techniquesPratiquees(u); }catch(e){ fams=[]; }
  const pt=fams.length?'<div class="rgx-mt-l rgx-mt-h"><span>Techniques</span><span>poids</span><span></span></div>'
    +fams.map(f=>'<div class="rgx-mt-l"><span class="rgx-mt-n">'+escapeHtml(LIB_FAMILLE[f]||f)+'</span><input id="avx-pt-'+f+'" class="rg-in" type="text" inputmode="decimal" autocomplete="off" data-dec placeholder="'+String(POIDS_TECHNIQUE[f]).replace('.',',')+'" value="'+(poidsTechniqueSurcharge(f,u)!=null?String(u.poidsTechnique[f]):'')+'" onchange="ajusterPoidsTechnique(\''+f+'\')"><span></span></div>').join(''):'';
  return '<details class="rgx-mt" id="avx"><summary class="rg-t">Ajuster pour cet athlète</summary>'
    +'<p class="bcad-d">Case vide : la valeur du dessus (mesurée, ta méthode ou RepCore), en gris.</p>'
    +'<div class="rgx-mt-l rgx-mt-4 rgx-mt-h"><span></span><span>MEV</span><span>MRV</span><span>source</span></div>'+lignes+pt
    +'<div class="rgx-pr-msg" id="avx-msg" role="status"></div></details>';
}
function _avxEcrire(champ,cle,val){
  const users=DB.get('users')||{};
  const c=(typeof currentClientId!=='undefined'&&currentClientId)?getOwnedClient(currentClientId,users):null;
  if(!c) return false;
  const avant=(c[champ]&&typeof c[champ]==='object')?JSON.parse(JSON.stringify(c[champ])):undefined;
  if(!c[champ]||typeof c[champ]!=='object') c[champ]={};
  if(val==null) delete c[champ][cle]; else c[champ][cle]=val;
  if(!Object.keys(c[champ]).length) delete c[champ];
  c.updatedAt=Date.now(); users[c.email]=c;
  try{ _viderCacheVolume(); }catch(e){}
  const ok=DB.set('users',users);
  const rendre=()=>{ try{ renderVolumeCoach(c); const d=document.getElementById('avx'); if(d) d.open=true; }catch(e){} };
  const defaire=()=>{ if(avant===undefined) delete c[champ]; else c[champ]=avant; c.updatedAt=Date.now(); users[c.email]=c;
    try{ _viderCacheVolume(); }catch(e){} DB.set('users',users); CLOUD.pushOne(c.email,c); rendre(); };
  const r=toastSyncAnnulable(ok,CLOUD.pushOne(c.email,c),'Enregistré '+ICO.coche,'le réglage est',defaire,RGX_ANNULER_MS);
  rendre();
  return r;
}
function ajusterVolumeAthlete(M){
  const c=(typeof currentClientId!=='undefined'&&currentClientId)?getOwnedClient(currentClientId):null;
  if(!c) return false;
  const g=k=>document.getElementById('avx-'+M+'-'+k);
  const r=validerRepereVolume(M,{mev:(g('mev')||{}).value,mrv:(g('mrv')||{}).value});
  const msg=document.getElementById('avx-msg');
  if(!r.ok){ if(msg) msg.textContent=((MUSCLES[M]||{}).lib||M)+' : '+r.erreur; ['mev','mrv'].forEach(k=>{ const e=g(k); if(e) e.style.borderColor='var(--orange)'; }); return false; }
  return _avxEcrire('reperesVolume',M,r.valeur);
}
function ajusterPoidsTechnique(f){
  const c=(typeof currentClientId!=='undefined'&&currentClientId)?getOwnedClient(currentClientId):null;
  if(!c) return false;
  const e=document.getElementById('avx-pt-'+f);
  const brut=String(e?e.value:'').replace(',','.').trim();
  const n=brut===''?null:Number(brut);
  const msg=document.getElementById('avx-msg');
  if(n!=null&&!(isFinite(n)&&n>=POIDS_TECHNIQUE_MIN&&n<=POIDS_TECHNIQUE_MAX)){ if(msg) msg.textContent='Poids de '+POIDS_TECHNIQUE_MIN+' à '+POIDS_TECHNIQUE_MAX; if(e) e.style.borderColor='var(--orange)'; return false; }
  return _avxEcrire('poidsTechnique',f,n==null?null:Math.round(n*10)/10);
}
