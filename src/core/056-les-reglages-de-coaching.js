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
  const cad=reglageCadence(coach);
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
  let cad=null; try{ cad=(typeof window.cadenceEffective==='function')?window.cadenceEffective(null,u):null; }catch(e){ cad=null; }
  if(!cad){ const x=reglageCadence(u); cad=x?{freq:x.freq,jour:x.jour,questions:[]}:null; }
  out.bilans=cad?(_RG_FREQ_LIB[cad.freq]||'')+', '+(BILAN_JOURS[cad.jour]||'')+((cad.questions||[]).length?' · '+cad.questions.length+' question'+(cad.questions.length>1?'s':''):''):'au choix de l’athlète';
  const d=u.dispo&&u.dispo.delaiH;
  out.messages=(d?'réponse sous '+d+' h':'délai non déclaré')+(r.formules?' · formule perso':'')+(reglageSignature(u)?' · signature':'');
  const nb=(u.promoBanners||[]).length;
  out.affichage=nb?nb+' bannière'+(nb>1?'s':''):'aucune bannière';
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
  pose('rgx-defauts',(l.modele||'')+(l.pasKcal||'')+'<p class="bcad-d">'+RG_NOTE_EXISTANTS+'</p>');
  pose('rgx-bilans',(l.cadence||''));
  pose('rgx-messages',_htmlRgxMessages(u,l));
  const aff=document.getElementById('rgx-affichage');
  if(aff&&!aff.firstChild) aff.innerHTML='<p class="prf-sub">Les bannières s’affichent en bas de l’accueil de tes athlètes.</p>';
  _rgxResumes();
  return true;
}
// Ce que remplissait l'onglet PROFIL (les mêmes id), puis le brouillon.
function _rgxRemplir(){
  try{ loadMonetisationTab(); }catch(e){}
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
