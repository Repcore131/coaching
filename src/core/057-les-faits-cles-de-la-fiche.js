// ══ LES FAITS CLÉS EN TÊTE DE FICHE (06/10/2026, build 1812) ══════════════
//
// Constat du banc : la tête de fiche affichait un poids SANS DATE, celui du
// dernier bilan, pendant que l'onglet Nutrition en citait un autre, la
// dernière pesée du journal. Le nombre de séances ne disait pas quand la
// dernière avait eu lieu : « il s'est entraîné quand ? » obligeait à défiler
// jusqu'au récapitulatif.
//
// UNE LIGNE, TROIS FAITS, chacun daté et cliquable vers sa section :
//   « Dernière séance : sam. 4 oct. · Pesée : 62 kg le 5 oct. · Contact : il y a 3 j »
//
// ⚠ LE POIDS N'A QU'UNE SOURCE : serieWeight, celle de l'onglet Nutrition
//   (poidsNutritionnel). Elle fusionne journal et bilans, range par JOUR et,
//   le même jour, garde la pesée du journal. #ccd-weight la reprend.
// ⚠ max(date) PARTOUT, jamais l'ordre du tableau : `sessions` n'est trié
//   nulle part de façon garantie (_mergeUser trie, les écritures locales non).

// La date d'une séance, quel que soit son format (ms, ISO, clé AAAA-MM-JJ).
function _fcDate(v){
  if(typeof v==='number') return v>0?v:0;
  try{ const t=dateLocaleDeCle(v).getTime(); return isFinite(t)&&t>0?t:0; }catch(e){ return 0; }
}
/**
 * PURE. Les trois faits que la tête de fiche doit donner sans défiler.
 * @param {any} c          le dossier de l'athlète
 * @param {any} coach      le coach (ses `contacts`)
 * @param {number} [maintenant]
 * @returns {{derniereSeance:{date:number,nom:string}|null,
 *   pesee:{kg:number,date:number,jour:string,source:'journal'|'bilan'}|null,
 *   contact:{date:number,jours:number}|null}}
 */
function faitsCles(c,coach,maintenant){
  const t=Number(maintenant)||Date.now();
  let derniereSeance=null;
  for(const s of ((c&&c.sessions)||[])){
    const d=_fcDate(s&&s.date);
    if(d&&(!derniereSeance||d>derniereSeance.date))
      derniereSeance={date:d,nom:String((s&&s.name)||'').trim()};
  }
  let pesee=null;
  try{
    const sw=serieWeight(c);
    // serieWeight est rangée par jour ; on relit quand même le max, par principe.
    const der=sw.reduce((m,e)=>(e&&(!m||e.date>m.date))?e:m,null);
    if(der) pesee={kg:der.kg,jour:der.date,date:dateLocaleDeCle(der.date).getTime(),source:der.source==='bilan'?'bilan':'journal'};
  }catch(e){ pesee=null; }
  let contact=null;
  const k=c&&c.id, x=coach&&coach.contacts;
  const dc=k&&x&&typeof x==='object'?Number(x[k])||0:0;
  if(dc>0) contact={date:dc,jours:Math.max(0,Math.floor((t-dc)/864e5))};
  return {derniereSeance,pesee,contact};
}
// « 62 », « 62,4 » : le kilo à une décimale, sans zéro inutile.
function _fcKg(kg){ return String(Math.round(Number(kg)*10)/10).replace('.',','); }
function _fcJour(ms,avecJour){
  try{ return new Date(ms).toLocaleDateString('fr-FR',avecJour?{weekday:'short',day:'numeric',month:'short'}:{day:'numeric',month:'short'}); }
  catch(e){ return ''; }
}
function _fcIlYa(j){ return j===0?'aujourd’hui':j===1?'hier':'il y a '+j+' j'; }
// PURE. Le HTML de la ligne. Vide pour une invitation pas encore honorée.
function htmlFaitsCles(c,coach,maintenant){
  if(!c||c._fromCode) return '';
  const f=faitsCles(c,coach,maintenant);
  const lien=(cible,txt,titre)=>'<button type="button" class="ccd-fait" onclick="faitCleOuvrir('+_attrArg(cible)+')"'
    +(titre?' title="'+escapeHtml(titre)+'"':'')+'>'+txt+'</button>';
  const s=f.derniereSeance
    ?lien('seance','Dernière séance : <strong>'+escapeHtml(_fcJour(f.derniereSeance.date,true))+'</strong>',f.derniereSeance.nom||'')
    :lien('seance','Pas encore de séance');
  // MASQUÉ CHEZ L'ATHLÈTE, PAS ICI : le coach garde le chiffre, avec le même
  // rappel que la réponse au bilan.
  let masque=false; try{ masque=!!(c.masquerPoids||aTCA(c)); }catch(e){ masque=!!c.masquerPoids; }
  const p=f.pesee
    ?lien('pesee','Pesée : <strong>'+escapeHtml(_fcKg(f.pesee.kg))+' kg</strong> le '+escapeHtml(_fcJour(f.pesee.date,false)),
      (f.pesee.source==='bilan'?'Poids du bilan':'Pesée du journal')+(masque?' · masqué dans son application : évite de le citer':''))
    :lien('pesee','Aucune pesée');
  const k=f.contact
    ?lien('contact','Contact : <strong>'+escapeHtml(_fcIlYa(f.contact.jours))+'</strong>',_fcJour(f.contact.date,true))
    :lien('contact','Aucun contact noté');
  return s+'<span class="ccd-fait-sep" aria-hidden="true">·</span>'+p+'<span class="ccd-fait-sep" aria-hidden="true">·</span>'+k;
}
// Remplit la ligne et le compteur de poids, d'UNE source. openClientDetail
// l'appelle à la place de l'ancien getBW(dernier bilan).
function rendreFaitsCles(c){
  const z=document.getElementById('ccd-faits');
  const w=document.getElementById('ccd-weight');
  let f=null; try{ f=faitsCles(c,currentUser,Date.now()); }catch(e){ f=null; }
  if(w){
    const pe=f&&f.pesee;
    w.textContent=pe?_fcKg(pe.kg)+'kg':'-';
    w.title=pe?((pe.source==='bilan'?'Bilan du ':'Pesée du ')+_fcJour(pe.date,true)):'';
  }
  if(z){
    // Et, dessous, le profil d'entraînement (build 1829), modifiable en un clic.
    const h=(c&&!c._fromCode)?htmlFaitsCles(c,currentUser,Date.now())
      +(()=>{ try{ return ligneProfilCoach(c); }catch(e){ return ''; } })():'';
    z.innerHTML=h;
    z.hidden=!h;
  }
  return f;
}
// Chaque fait mène à sa section : le récapitulatif des séances, la courbe de
// poids, le fil de messages.
function faitCleOuvrir(quoi){
  const c=(()=>{ try{ return getOwnedClient(currentClientId); }catch(e){ return null; } })();
  if(!c) return false;
  if(quoi==='contact'){ try{ msgOuvrirFil(_relCle(c)); return true; }catch(e){ return false; } }
  const cible=quoi==='pesee'?'ccd-poids':'ccd-sessions-recap';
  try{
    let el=document.getElementById(cible);
    for(const v of CCD_VUES){
      if(el&&el.offsetParent!==null) break;
      ccdVue(v); el=document.getElementById(cible);
    }
    if(el) (el.closest('section')||el).scrollIntoView({behavior:'smooth',block:'start'});
    return !!el;
  }catch(e){ return false; }
}
