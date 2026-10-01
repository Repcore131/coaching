// ══ DÉPOSER UN ÉVÉNEMENT POUR LE SERVEUR LÉGER ═══════════════════════════
// Ne lève jamais, ne bloque jamais : une notification perdue ne vaut pas un
// geste raté. Le serveur RELIT la base avant d'agir (il ne croit pas
// l'événement sur parole) ; ici on ne fait que le prévenir.
// L'abonnement PayPal de ce compte, signalé au serveur une fois (et au
// démarrage pour ceux d'avant 1603). Le serveur le vérifie chez PayPal.
function abonnementSignaler(id,force){
  const abo=String(id||'');
  if(!SERVEUR_LEGER||!/^I-[A-Z0-9]{6,30}$/.test(abo)) return;
  const cle='rc_abo_signale';
  try{ if(!force&&localStorage.getItem(cle)===abo) return; }catch(e){}
  deposerEvenement({type:'abonnement',abo}).then((ok)=>{ if(ok){ try{ localStorage.setItem(cle,abo); }catch(e){} } }).catch(()=>{});
}
// PURE. Ce que l'événement vise, pour son verrou (voir evenementPoser) : les
// règles exigent exactement cette valeur, type par type.
function evenementCible(ev){
  const t=ev&&ev.type;
  // Un message privé : l'événement vise le message (les règles vérifient qu'il existe et qui l'a écrit).
  if(t==='message') return /^m[a-z0-9]{8,20}$/.test(String(ev.i||''))?String(ev.i):'';
  if(t==='reponse_bilan'||t==='reponse_rite') return String(ev.dest||'');
  if(t==='defi_maj') return String(ev.id||'');
  if(t==='defi_publie') return String(ev.msg||'');
  // Un duel : l'événement vise le duel (les règles vérifient qu'on en est).
  if(t==='duel_rejoint'||t==='duel_maj'||t==='duel_cree') return DUEL_ID_RE.test(String(ev.id||''))?String(ev.id):'';
  // Une réaction : l'événement vise le pseudo (les règles : un ami que je suis).
  if(t==='reaction') return /^[a-z0-9_]{3,40}$/.test(String(ev.cible||''))&&/^\d{4}-\d{2}-\d{2}$/.test(String(ev.jour||''))?String(ev.cible):'';
  return '-';
}
async function deposerEvenement(ev){
  if(!SERVEUR_LEGER||!currentUser||!currentUser.email||!CLOUD||!CLOUD.ok()) return false;
  const par=currentUser.email.replace(/\./g,',');
  const id='e'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  const cible=evenementCible(ev);
  if(!cible) return false;
  let ok=false;
  try{ ok=await CLOUD.evenementPoser(id,Object.assign({},ev,{par,at:Date.now(),cible})); }catch(e){ ok=false; }
  if(ok){ try{ fetch(SERVEUR_LEGER_URL+'/reveil',{method:'POST',keepalive:true}).catch(()=>{}); }catch(e){} }
  return ok;
}
// PURE. Ce sur quoi le classement se fait : la même règle que le serveur
// (functions/defis-calcul.js, metriqueClassement) — la progression en %, les
// semaines validées, sinon les séances. Jamais les charges.
function defiMetriqueClassement(u,d){
  if(d.mesure==='progressionPct'||d.mesure==='serie') return defiValeur(u,d);
  return defiValeur(u,Object.assign({},d,{mesure:'seances'}));
}
// ── LA PROGRESSION, ÉCRITE PAR L'ATHLÈTE ────────────────────────────────
// Le serveur léger ne relit JAMAIS les séances d'un athlète (dix
// millisecondes de calcul par exécution) : c'est l'app, qui calcule déjà la
// jauge perso, qui écrit sa valeur dans chaque défi où il est inscrit, après
// une séance et à l'inscription. Le serveur en tire l'équipe, le classement,
// les paliers et le podium.
async function defisPublierProgression(ids){
  if(!SERVEUR_LEGER||!currentUser||currentUser.role==='coach') return 0;
  if(!canalAccessible(currentUser)||!CLOUD.ok()) return 0;
  const cle=canalCle(currentUser);
  if(!cle) return 0;
  const moi=(currentUser.email||'').replace(/\./g,',');
  const cibles=Array.isArray(ids)?ids:Object.keys(_dfInscrits());
  if(!cibles.length) return 0;
  let tous={};
  try{ tous=(await CLOUD.pullDefisCanal(cle))||{}; }catch(e){ return 0; }
  const t=Date.now();
  let n=0;
  for(const id of cibles){
    const m=tous[id];
    if(!m||m.type!=='defi'||!defiActif(m,t)) continue;
    const d=Object.assign({},m,{id});
    try{
      await CLOUD._canalPut(cle,'defis/'+id+'/participants/'+moi,
        {valeur:defiValeur(currentUser,d),metrique:defiMetriqueClassement(currentUser,d),maj:t},'PATCH');
      await deposerEvenement({type:'defi_maj',coach:cle,id});
      n++;
    }catch(e){ /* le prochain passage rattrapera */ }
  }
  return n;
}
// ── Le coach : « Lancer un défi » ──────────────────────────────────────────
let _dfModele=-1;
function openDefiCanal(id){
  if(currentUser?.role!=='coach') return false;
  document.getElementById('modal-overlay')?.remove();
  const m=(id&&(window._canalMsgsCoach||{})[id])||null;
  window._defiEdite=id||'';
  _dfModele=-1;
  const fin=m?Number(m.fin):_dfFinDuMois(Date.now());
  const val=x=>escapeHtml(String(x==null?'':x));
  const opt=Object.keys(DEFI_MESURES).map(k=>'<option value="'+k+'"'+((m?m.mesure:'seances')===k?' selected':'')+'>'+DEFI_MESURES[k].lib+'</option>').join('');
  const coll=m?!!m.collectif:false;
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="df-h" class="dfm-feuille">'
  +'<h2 id="df-h" style="margin-bottom:4px">'+(id?'Modifier le défi':'Créer un défi')+'</h2>'
  +'<p class="sub" style="font-size:var(--fs-sm);margin-bottom:12px;line-height:1.55">Épinglé en haut du Canal de tes athlètes. Ceux qui ont activé les notifications sont prévenus.</p>'
  +(id?'':'<div class="dfm-modeles" role="group" aria-label="Modèles">'+DEFI_MODELES.map((x,i)=>
    '<button type="button" class="dfm-modele" data-i="'+i+'" onclick="defiAppliquerModele('+i+')">'+escapeHtml(x.titre)+'</button>').join('')+'</div>')
  +'<label for="df-objectif">1 · Le défi</label>'
  +'<div class="dfm-ligne"><input id="df-objectif" type="number" inputmode="decimal" min="1" step="any" value="'+val(m?m.objectif:12)+'" oninput="_dfApercu()" aria-label="Objectif">'
  +'<select id="df-mesure" onchange="_dfApercu()" aria-label="Mesure">'+opt+'</select></div>'
  +'<div class="dfm-seg" role="radiogroup" aria-label="Individuel ou en équipe">'
  +'<button type="button" role="radio" data-coll="0" aria-checked="'+(!coll)+'" onclick="_dfColl(false)">Chacun le sien</button>'
  +'<button type="button" role="radio" data-coll="1" aria-checked="'+coll+'" onclick="_dfColl(true)">En équipe</button></div>'
  +'<label for="df-fin" style="margin-top:14px">2 · Jusqu’au</label>'
  +'<input id="df-fin" type="date" value="'+val(localISODate(new Date(fin)))+'" min="'+val(localISODate(new Date()))+'" oninput="_dfApercu()">'
  +'<label for="df-recompense" style="margin-top:14px">3 · Récompense (optionnel)</label>'
  +'<input id="df-recompense" type="text" maxlength="120" value="'+val(m&&m.recompense)+'" placeholder="Une séance offerte, un t-shirt, la gloire…">'
  +'<div id="df-apercu" class="dfm-apercu" aria-live="polite"></div>'
  +'<div style="display:flex;gap:8px;margin-top:16px">'
  +'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>'
  +'<button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="enregistrerDefiCanal()">'+(id?'Enregistrer':'Lancer le défi')+'</button>'
  +'</div></div></div>');
  _dfApercu();
  return true;
}
function _dfColl(oui){
  document.querySelectorAll('.dfm-seg [data-coll]').forEach(b=>b.setAttribute('aria-checked',String((b.dataset.coll==='1')===!!oui)));
  _dfApercu();
}
function _dfLireFormulaire(){
  const g=id=>document.getElementById(id);
  const mesure=(g('df-mesure')||{}).value||'seances';
  const objectif=Number(String((g('df-objectif')||{}).value||'').replace(',','.'))||0;
  const coll=!!document.querySelector('.dfm-seg [data-coll="1"][aria-checked="true"]');
  const f=String((g('df-fin')||{}).value||'');
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(f);
  const fin=m?new Date(+m[1],+m[2]-1,+m[3],23,59,59).getTime():0;
  const recompense=String((g('df-recompense')||{}).value||'').trim().slice(0,120);
  return {mesure,objectif,collectif:coll,fin,recompense};
}
function defiAppliquerModele(i){
  const x=DEFI_MODELES[i]; if(!x) return false;
  _dfModele=i;
  const g=id=>document.getElementById(id);
  if(g('df-objectif')) g('df-objectif').value=x.objectif;
  if(g('df-mesure')) g('df-mesure').value=x.mesure;
  const fin=x.duree==='mois'?_dfFinDuMois(Date.now()):Date.now()+x.duree*864e5;
  if(g('df-fin')) g('df-fin').value=localISODate(new Date(fin));
  document.querySelectorAll('.dfm-modele').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.i)===i)));
  _dfColl(x.collectif);
  return true;
}
function _dfApercu(){
  const z=document.getElementById('df-apercu'); if(!z) return;
  const f=_dfLireFormulaire();
  const titre=defiTitreAuto(f.mesure,f.objectif,f.collectif,f.fin);
  z.innerHTML='<b>'+escapeHtml(titre)+'</b><span>'+escapeHtml((f.collectif?'Tous ensemble : les résultats s’additionnent.':'Chacun son objectif.')
    +(f.fin?' Jusqu’au '+_dfDate(f.fin)+'.':''))+'</span>';
}
// PURE. Le message, tiré du formulaire. Rend {msg} ou {erreur}.
function defiMessage(f,ancien,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!DEFI_MESURES[f.mesure]) return {erreur:'Choisis ce que le défi mesure.'};
  if(!(f.objectif>0)) return {erreur:'Donne un objectif chiffré.'};
  if(!(f.fin>t+3600e3)) return {erreur:'La date de fin doit être dans le futur.'};
  const a=ancien||{};
  const debut=Number(a.debut)||t;
  const titre=defiTitreAuto(f.mesure,f.objectif,f.collectif,f.fin,t).slice(0,CANAL_TITRE_MAX);
  const texte=(f.collectif?'En équipe : ':'Objectif : ')+defiTexteObjectif(f)+' d’ici le '+_dfDate(f.fin)+'.'
    +(f.collectif&&_dfSomme(f)?' Chaque séance de chacun compte pour tout le monde.':'')
    +(f.mesure==='progressionPct'?' Ta meilleure charge de chaque exercice, comparée à celle d’avant le défi.':'');
  const msg={at:Number(a.at)||t,type:'defi',titre,texte:texte.slice(0,CANAL_TEXTE_MAX),mesure:f.mesure,
    objectif:Number(f.objectif),collectif:!!f.collectif,debut,fin:f.fin};
  if(f.recompense) msg.recompense=f.recompense;
  if(a.epingle) msg.epingle=true;
  return {msg};
}
async function enregistrerDefiCanal(){
  const nouveau=!window._defiEdite;
  const id=window._defiEdite||('d'+Date.now()+'-'+Math.random().toString(36).slice(2,7));
  const r=defiMessage(_dfLireFormulaire(),(window._canalMsgsCoach||{})[window._defiEdite]||null);
  if(r.erreur){ toast(r.erreur,'var(--orange)'); return false; }
  const cle=canalCle(currentUser);
  if(!cle||!CLOUD.ok()){ toast('Publication impossible hors connexion','var(--orange)'); return false; }
  const b=document.querySelector('#modal-overlay .btn-red');
  if(b){ b.disabled=true; b.dataset.lib=b.textContent; b.textContent='Envoi…'; }
  try{
    await CLOUD.ecrireMessageCanal(cle,id,r.msg);
    currentUser.canalDernier=Math.max(Number(currentUser.canalDernier)||0,r.msg.at);
    saveUser();
    await CLOUD.pushProfilCoach(currentUser);
  }catch(e){
    if(b){ b.disabled=false; if(b.dataset.lib!=null) b.textContent=b.dataset.lib; }
    toast('Non publié : '+e.message,'var(--orange)');
    return false;
  }
  closeModal();
  // UN NOUVEAU DÉFI prévient les athlètes (une modification, non).
  if(nouveau) deposerEvenement({type:'defi_publie',msg:id}).catch(()=>{});
  if(nouveau) rcmCoach('coach_canal_publie');
  toast(window._defiEdite?'Défi modifié':'Défi lancé ⚡');
  window._defiEdite='';
  _canalChargerCoach(id);
  return true;
}
// ── Les cartes ─────────────────────────────────────────────────────────────
function _dfJauge(lib,part,droite){
  const p=Math.round(Math.max(0,Math.min(1,Number(part)||0))*100);
  return '<div class="dfi-j"><div class="dfi-j-l"><span>'+escapeHtml(lib)+'</span><b>'+escapeHtml(droite)+'</b></div>'
    +'<div class="dfi-barre" role="progressbar" aria-label="'+escapeHtml(lib)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p+'"><span style="width:'+p+'%"></span></div></div>';
}
function _dfEnTete(m,t){
  const fini=t>Number(m.fin);
  const j=defiJoursRestants(m,t);
  const quand=fini?'Terminé':(t<Number(m.debut)?'Commence le '+_dfDate(m.debut)
    :'Jusqu’au '+_dfDate(m.fin)+' · '+(j<=1?'dernier jour':'J-'+j));
  return '<div class="dfi-tete"><span class="cnl-defi">Défi</span><span class="dfi-quand">'+escapeHtml(quand)+'</span></div>'
    +'<div class="cnl-titre">'+escapeHtml(m.titre||'Défi')+'</div>'
    +'<div class="dfi-obj">'+escapeHtml((m.collectif?'En équipe · ':'Chacun le sien · ')+defiTexteObjectif(m))+'</div>'
    +(m.recompense?'<div class="dfi-rec">🎁 '+escapeHtml(m.recompense)+'</div>':'');
}
// PURE. La carte athlète : jauges, avatars, classement, et l'action.
// etat : {pub, moi, resultat} ; u : l'athlète (jauge perso calculée ici).
function htmlCarteDefi(m,etat,u,compteurs,mienne,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const e=etat||{}, pub=e.pub||{}, moi=e.moi||null;
  const inscrit=!!(moi&&moi.inscription);
  const n=Math.max(1,Number(pub.n)||0);
  const v=defiValeur(u,m);
  const actif=t<=Number(m.fin);
  const res=e.resultat||null;
  const fini=!!(res||(moi&&moi.termine)||(inscrit&&!m.collectif&&v>=Number(m.objectif)));
  let h='<div class="cnl-carte dfi-carte" data-epingle data-defi="'+escapeHtml(m.id)+'">'+_dfEnTete(m,t);
  if(inscrit||res){
    const cible=(m.collectif&&_dfSomme(m))?' (ta part : '+defiNombre(Math.ceil(Number(m.objectif)/n))+')':' / '+defiTexteObjectif(m);
    h+=_dfJauge('Toi',defiPartPerso(m,v,n),_dfValeurTexte(m,v)+cible);
  }
  const eq=pub.equipe||{};
  if(Number(pub.n)>0)
    h+=_dfJauge('Équipe · '+pub.n+' participant'+(pub.n>1?'s':''),eq.part,
      Math.round((Number(eq.part)||0)*100)+' %'+(m.collectif&&eq.valeur!=null?' · '+_dfValeurTexte(m,eq.valeur):''));
  const vis=Array.isArray(pub.visibles)?pub.visibles:[];
  if(vis.length||Number(pub.n)>0){
    const autres=Math.max(0,(Number(pub.n)||0)-vis.length);
    h+='<div class="dfi-avatars" aria-label="'+escapeHtml((Number(pub.n)||0)+' participants')+'">'
      +vis.slice(0,8).map(x=>'<span class="dfi-av" title="'+escapeHtml(x.nom)+'">'+escapeHtml(x.ini||'?')+'</span>').join('')
      +(autres?'<span class="dfi-av dfi-av-plus">+'+autres+'</span>':'')+'</div>';
  }
  const cl=Array.isArray(pub.classement)?pub.classement:[];
  if(cl.length){
    const unite=m.mesure==='progressionPct'?' %':(m.mesure==='serie'?' sem.':' séances');
    h+='<div class="dfi-classement"><div class="dfi-cl-t">Classement · '+escapeHtml(m.mesure==='progressionPct'?'progression':'régularité')+'</div>'
      +cl.slice(0,5).map((x,i)=>'<div class="dfi-cl-l"><span>'+(i+1)+'. '+escapeHtml(x.nom)+(x.termine?' ✓':'')+'</span><b>'
        +escapeHtml(String(x.valeur).replace('.',','))+unite+'</b></div>').join('')
      +(moi&&moi.place?'<div class="dfi-cl-moi">Ta place : '+moi.place+(moi.place===1?'er':'e')
        +(moi.inscription&&moi.inscription.classement?'':' (hors classement public)')+'</div>':'')+'</div>';
  }
  if(fini){
    h+='<div class="dfi-fait">'+(res&&res.champion?'Champion du défi':'✓ Défi relevé')+'</div>'
      +'<button type="button" class="btn btn-outline btn-sm dfi-part" onclick="partagerDefi(\''+escapeHtml(m.id)+'\',this)">'+icon('share',16)+' <span>Partager</span></button>';
  }else if(actif&&!inscrit){
    h+='<button type="button" class="btn btn-red dfi-go" onclick="defiRelever(\''+escapeHtml(m.id)+'\')">Je relève le défi</button>';
  }else if(actif&&inscrit){
    h+='<div class="dfi-inscrit">Tu relèves ce défi ✓ <button type="button" class="dfi-lien" onclick="defiRelever(\''+escapeHtml(m.id)+'\')">Mes réglages</button></div>';
  }
  h+='<div style="display:flex;gap:6px;margin-top:12px">'+_canalBoutonsReactions(m,compteurs||{},mienne||'')+'</div>';
  return h+'</div>';
}
function htmlCarteSysteme(m,coach){
  return '<div class="cnl-carte cnl-systeme"><div class="cnl-sys-t">'+escapeHtml(String(m.texte||''))+'</div>'
    +'<div class="cnl-sys-b"><span class="sub">'+escapeHtml(ago(Number(m.at)||Date.now()))+'</span>'
    +(coach?'<button class="dfi-lien" onclick="supprimerMessageCanal(\''+escapeHtml(m.id)+'\')">Supprimer</button>':'')+'</div></div>';
}
// La carte du coach : il voit tout le monde, avec l'emblème de rang.
function htmlCarteDefiCoach(m,d,neuve){
  const t=Date.now(), pub=(d&&d.public)||{}, parts=(d&&d.participants)||{};
  const users=DB.get('users')||{};
  const l=Object.keys(parts).filter(k=>parts[k]&&parts[k].inscription).map(k=>{
    const c=users[k.replace(/,/g,'.')];
    return {nom:(c&&c.fname)||k.replace(/,/g,'.'),xp:xpDe(c),v:Number(parts[k].valeur)||0,f:!!parts[k].termine};
  }).sort((a,b)=>b.v-a.v);
  let h='<div class="cnl-carte dfi-carte'+(neuve?' cnl-neuve':'')+'">'+_dfEnTete(m,t);
  h+=_dfJauge('Équipe',Number((pub.equipe||{}).part)||0,Math.round((Number((pub.equipe||{}).part)||0)*100)+' %');
  h+=l.length?'<div class="dfi-classement">'+l.map(x=>'<div class="dfi-cl-l"><span>'+htmlNomRang(x.nom,x.xp)+(x.f?' ✓':'')+'</span><b>'
      +escapeHtml(_dfValeurTexte(m,x.v))+'</b></div>').join('')+'</div>'
    :'<div class="sub" style="font-size:var(--fs-xs);margin-top:10px">Personne n’a encore relevé le défi.</div>';
  h+='<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">'
    +'<button class="btn btn-outline btn-sm" style="width:auto;padding:0 14px;min-height:34px;font-size:10.5px;margin:0" onclick="openDefiCanal(\''+escapeHtml(m.id)+'\')">Modifier</button>'
    +'<button class="btn btn-outline btn-sm" style="width:auto;padding:0 14px;min-height:34px;font-size:10.5px;margin:0;color:var(--sub)" onclick="supprimerMessageCanal(\''+escapeHtml(m.id)+'\')">Supprimer</button></div>';
  return h+'</div>';
}
// PURE. L'ordre du fil athlète : les défis en cours ÉPINGLÉS en tête (le plus
// proche de sa fin d'abord), puis tout le reste dans l'ordre du Canal. Un défi
// terminé redescend dans le fil, à sa date.
function canalOrdreAvecDefis(liste,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const l=Array.isArray(liste)?liste:[];
  const haut=l.filter(m=>m&&m.type==='defi'&&t<=Number(m.fin)).sort((a,b)=>Number(a.fin)-Number(b.fin));
  return haut.concat(l.filter(m=>haut.indexOf(m)<0));
}
// Ce que le fil athlète a besoin de savoir de chaque défi visible : le résumé
// public et sa propre feuille. En parallèle ; un échec rend un défi sans
// jauge d'équipe, jamais un fil vide.
async function _canalChargerDefis(cle,liste){
  const moi=(currentUser.email||'').replace(/\./g,',');
  const t=Date.now();
  const d=liste.filter(m=>m.type==='defi'&&t<=Number(m.fin)+14*864e5);
  const out={};
  await Promise.all(d.map(async m=>{
    const [pub,mien]=await Promise.all([
      CLOUD._canalGet(cle,'defis/'+m.id+'/public').catch(()=>null),
      CLOUD._canalGet(cle,'defis/'+m.id+'/participants/'+moi).catch(()=>null)]);
    out[m.id]={pub:pub||{},moi:mien||null,resultat:((currentUser.defisReleves||{})[m.id])||null};
    _dfMemoInscrit(m.id,!!(mien&&mien.inscription));
  }));
  return out;
}
function _canalHtmlFilAthlete(liste){
  const t=Date.now();
  return canalOrdreAvecDefis(liste,t).map(m=>{
    if(m.type==='systeme') return htmlCarteSysteme(m,false);
    if(m.type==='defi') return htmlCarteDefi(m,(window._canalDefis||{})[m.id],currentUser,
      (window._canalCompteurs||{})[m.id]||{},(window._canalMiennes||{})[m.id]||'',t);
    return _canalCarte(m,(window._canalCompteurs||{})[m.id]||{},(window._canalMiennes||{})[m.id]||'');
  }).join('');
}
// ── « Je relève le défi » : l'inscription, et le classement en opt-in ──────
function defiRelever(id){
  const m=((window._canalListe||[]).find(x=>x.id===id))||null;
  if(!m) return false;
  const e=(window._canalDefis||{})[id]||{};
  const ins=(e.moi&&e.moi.inscription)||null;
  document.getElementById('modal-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend',
  '<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
  +'<div onclick="event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="dfr-h" class="dfm-feuille">'
  +'<h2 id="dfr-h" style="margin-bottom:4px">'+escapeHtml(m.titre||'Le défi')+'</h2>'
  +'<p class="sub" style="font-size:var(--fs-sm);margin-bottom:14px;line-height:1.55">'+escapeHtml(m.texte||'')+'</p>'
  +'<label class="dfr-case"><input type="checkbox" id="dfr-classement"'+(ins&&ins.classement?' checked':'')+' onchange="document.getElementById(\'dfr-pseudo-z\').hidden=!this.checked">'
  +'<span><b>Apparaître au classement</b><span class="sub">Il ne porte que sur ta régularité ou ta progression en %, jamais sur tes charges. Sans lui, tu comptes pour l’équipe sans être nommé.</span></span></label>'
  +'<div id="dfr-pseudo-z"'+(ins&&ins.classement?'':' hidden')+'><label for="dfr-pseudo" style="margin-top:12px">Nom affiché (optionnel)</label>'
  +'<input id="dfr-pseudo" type="text" maxlength="24" value="'+escapeHtml((ins&&ins.pseudo)||'')+'" placeholder="'+escapeHtml(currentUser.fname||'Ton pseudo')+'"></div>'
  +'<div style="display:flex;gap:8px;margin-top:16px">'
  +(ins?'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="defiInscrire(\''+escapeHtml(id)+'\',false)">Me retirer</button>'
       :'<button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Plus tard</button>')
  +'<button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="defiInscrire(\''+escapeHtml(id)+'\',true)">'+(ins?'Enregistrer':'C’est parti')+'</button>'
  +'</div></div></div>');
  return true;
}
// PURE. L'inscription écrite : {le, classement, pseudo?}.
function defiInscription(classement,pseudo,maintenant,prenom){
  const o={le:(typeof maintenant==='number')?maintenant:Date.now(),classement:!!classement};
  // Le prénom, pour le classement quand il n'y a pas de pseudo : le serveur
  // léger ne relit pas le dossier. Il n'apparaît que sur opt-in (classement).
  const pr=String(prenom||'').replace(/\s+/g,' ').trim().slice(0,24);
  if(pr) o.prenom=pr;
  const p=String(pseudo||'').replace(/\s+/g,' ').trim().slice(0,24);
  if(classement&&p) o.pseudo=p;
  return o;
}
async function defiInscrire(id,oui){
  const cle=canalCle(currentUser), moi=(currentUser.email||'').replace(/\./g,',');
  if(!cle||!CLOUD.ok()){ toast('Impossible hors connexion','var(--orange)'); return false; }
  const ins=oui?defiInscription(!!document.getElementById('dfr-classement')?.checked,
    document.getElementById('dfr-pseudo')?.value,Date.now(),currentUser.fname):null;
  try{
    if(ins) await CLOUD._canalPut(cle,'defis/'+id+'/participants/'+moi+'/inscription',ins);
    else await CLOUD._canalPut(cle,'defis/'+id+'/participants/'+moi+'/inscription',null,'DELETE');
  }catch(e){ toast('Non enregistré : '+e.message,'var(--orange)'); return false; }
  _dfMemoInscrit(id,!!ins);
  const e=(window._canalDefis||(window._canalDefis={}))[id]||(window._canalDefis[id]={pub:{}});
  e.moi=Object.assign({},e.moi||{},{inscription:ins});
  closeModal();
  if(ins){ try{ arcHaptique('succes'); }catch(x){} toast('Défi relevé Tes séances depuis le début comptent déjà.'); }
  else toast('Tu t’es retiré du défi.');
  _canalRepeindre();
  // Ma valeur (les séances déjà faites depuis le début comptent), puis le
  // serveur recalcule le résumé public ; on le relit ensuite.
  if(ins) defisPublierProgression([id]).catch(()=>{});
  else deposerEvenement({type:'defi_maj',coach:cle,id}).catch(()=>{});
  setTimeout(()=>{ try{ if(document.getElementById('canal-fil')) _canalCharger(); }catch(x){} },4000);
  return true;
}
// ── L'accueil : le rappel tant qu'un défi est actif ────────────────────────
let _dfAccueilCache=null;
// PURE. La carte de l'accueil, pour le défi le plus proche de sa fin.
function htmlDefiAccueil(defis,u,inscrits,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const a=(defis||[]).filter(d=>d&&d.type==='defi'&&defiActif(d,t)).sort((x,y)=>Number(x.fin)-Number(y.fin));
  if(!a.length) return '';
  const d=a[0], ins=!!(inscrits||{})[d.id];
  const j=defiJoursRestants(d,t);
  const reste=j<=1?'dernier jour':'encore '+j+' jours';
  let corps;
  if(ins){
    const v=defiValeur(u,d);
    corps='<div class="dfa-l"><b>'+escapeHtml(_dfValeurTexte(d,v))+'</b> / '+escapeHtml(defiTexteObjectif(d))+' · '+escapeHtml(reste)+'</div>'
      +'<div class="dfi-barre"><span style="width:'+Math.round(defiPartPerso(d,v,1)*100)+'%"></span></div>';
  }else corps='<div class="dfa-l">Ton coach a lancé un défi · '+escapeHtml(reste)+'</div><div class="dfa-go">Je relève le défi →</div>';
  return '<div class="dfa-carte" role="button" tabindex="0" onclick="loadCanal()" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();loadCanal()}">'
    +'<div class="dfa-t"><span class="cnl-defi">Défi</span> '+escapeHtml(d.titre||'')+'</div>'+corps
    +(a.length>1?'<div class="sub" style="font-size:var(--fs-2xs);margin-top:4px">+ '+(a.length-1)+' autre'+(a.length>2?'s':'')+' défi'+(a.length>2?'s':'')+'</div>':'')+'</div>';
}
async function renderDefiAccueil(){
  const z=document.getElementById('clh-defi');
  if(!z) return false;
  if(!canalAccessible(currentUser)||!CLOUD.ok()){ z.innerHTML=''; return false; }
  const cle=canalCle(currentUser);
  if(!cle){ z.innerHTML=''; return false; }
  try{
    if(!_dfAccueilCache||_dfAccueilCache.cle!==cle||Date.now()-_dfAccueilCache.t>10*60e3){
      const r=await CLOUD.pullDefisCanal(cle);
      _dfAccueilCache={cle,t:Date.now(),l:Object.keys(r||{}).map(id=>Object.assign({id},r[id]))};
    }
    z.innerHTML=htmlDefiAccueil(_dfAccueilCache.l,currentUser,_dfInscrits(),Date.now());
  }catch(e){ z.innerHTML=''; }
  return true;
}
// ══ LES DUELS (28/09/2026) ═══════════════════════════════════════════════
//
// « Défie un pote » : deux athlètes, une mesure, 7 à 28 jours. Le lien porte
// le duel (?duel=<id>) ET le code parrain (lienPerso) : l'ami qui n'a pas
// l'app arrive par /i, accueilli par son nom (« Léa te défie : 14 jours de
// régularité »), s'inscrit, et relève le défi. Le duel DÉMARRE à sa première
// séance.
//
// OÙ VIVENT LES DONNÉES (database.rules.json) :
//   /duels/<id>          lu par les deux participants seulement. Le créateur
//                        l'écrit en attente ; l'invité s'y inscrit ; chacun
//                        écrit SA progression (progres/<lui>) ; le Worker
//                        écrit le reste (début, fin, statut, scores, gagnant).
//   /duels_publics/<id>  le prénom, la mesure, la durée : lu sans compte (/i).
//   /defis_resultats     la clôture y écrit le résultat : CHAMPION au gagnant.
// LE CALCUL EST CELUI DES DÉFIS DU CANAL (defiValeur) : l'app écrit sa
// valeur après chaque séance, le Worker compare (cloudflare/src/duels.js).
const DUEL_ID_RE=/^d[a-z0-9]{10,24}$/;
const DUEL_DUREES=Object.freeze([7,14,21,28]);
const DUEL_MESURES=Object.freeze([
  Object.freeze({cle:'seances',lib:'Régularité',mot:'régularité',detail:'le plus de séances',ico:'calendar'}),
  Object.freeze({cle:'tonnage',lib:'Volume',mot:'volume',detail:'le plus de kilos soulevés',ico:'haltere'}),
  Object.freeze({cle:'progressionPct',lib:'Progression',mot:'progression',detail:'la plus forte progression, en %',ico:'progres'})
]);
// L'ÉCUSSON DE LA FEUILLE « Défie un pote » (maquette de Kevin, 28/09/2026) :
// un hexagone rouge, deux haches croisées — manches rouges, têtes claires.
const DUEL_ECUSSON='<svg viewBox="0 0 120 120" aria-hidden="true"><defs>'
  +'<linearGradient id="duT" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d9d9d9"/><stop offset="1" stop-color="#9a9a9a"/></linearGradient></defs>'
  +'<polygon points="60,6 107,33 107,87 60,114 13,87 13,33" fill="rgba(120,8,8,.25)" stroke="#e02020" stroke-width="2.5"/>'
  +'<polygon points="60,16 98,38 98,82 60,104 22,82 22,38" fill="none" stroke="rgba(224,32,32,.35)" stroke-width="1"/>'
  +'<g transform="translate(60 62) rotate(40)"><rect x="-3" y="-34" width="6" height="68" rx="3" fill="#c81212"/>'
  +'<path d="M-2 -40h5c11 2 18 9 19 19-8-1-13-3-19-3h-5z" fill="url(#duT)" stroke="#e02020" stroke-width="1.5"/></g>'
  +'<g transform="translate(60 62) rotate(-40) scale(-1 1)"><rect x="-3" y="-34" width="6" height="68" rx="3" fill="#c81212"/>'
  +'<path d="M-2 -40h5c11 2 18 9 19 19-8-1-13-3-19-3h-5z" fill="url(#duT)" stroke="#e02020" stroke-width="1.5"/></g></svg>';
const DUEL_INVITE_CLE='rc_duel_invite';
/** PURE. « 14 jours de régularité » — la même phrase que le Worker. */
function texteDuel(mesure,duree){
  const d=DUEL_DUREES.indexOf(Number(duree))>=0?Number(duree):14;
  const m={seances:'régularité',serie:'régularité',tonnage:'volume',progressionPct:'progression'}[mesure]||'régularité';
  return d+' jours de '+m;
}
/** PURE. Un score lisible (le Worker a le même). */
function texteScoreDuel(mesure,v){
  const n=Number(v)||0;
  if(mesure==='tonnage') return n>=10000?String(Math.round(n/100)/10).replace('.',',')+' t':Math.round(n)+' kg';
  if(mesure==='progressionPct') return String(Math.round(n*10)/10).replace('.',',')+' %';
  if(mesure==='serie') return Math.round(n)+' sem.';
  return Math.round(n)+' séance'+(Math.round(n)>1?'s':'');
}
function duelNouvelId(){
  const a='abcdefghijklmnopqrstuvwxyz0123456789';
  let s='d';
  try{ const b=new Uint8Array(14); crypto.getRandomValues(b); for(const x of b) s+=a[x%36]; }
  catch(e){ for(let i=0;i<14;i++) s+=a[Math.floor(Math.random()*36)]; }
  return s;
}
const _moiCle=()=>String((currentUser&&currentUser.email)||'').replace(/\./g,',');
/** PURE. Le lien d'un duel : le lien perso (page, ref, src=duel) et ?duel=. */
function lienDuel(id,u){
  const l=lienPerso('duel',u);
  if(!l||!DUEL_ID_RE.test(String(id||''))) return '';
  return l+(l.indexOf('?')>=0?'&':'?')+'duel='+id;
}
// ── Les lectures et écritures ─────────────────────────────────────────────
async function _duelLire(id){
  const token=await CLOUD._getToken();
  if(!token) return null;
  const r=await fetch(CLOUD._fbUrl.replace('users.json','duels/'+id+'.json')+'?auth='+token);
  return r.ok?await r.json():null;
}
async function _duelPublic(id){
  try{
    const r=await fetch(CLOUD._fbUrl.replace('users.json','duels_publics/'+id+'.json'));
    return r.ok?await r.json():null;
  }catch(e){ return null; }
}
// Mes duels, dans le dossier : {id: {role, le, fini?}}. Les duels finis
// depuis plus de 60 jours sont oubliés.
function _mesDuels(u){
  const x=(u&&u.duels&&typeof u.duels==='object')?u.duels:{};
  return Object.keys(x).filter(id=>DUEL_ID_RE.test(id)&&x[id]&&typeof x[id]==='object');
}
// ── Créer ─────────────────────────────────────────────────────────────────
/** Rend {ok, id?, erreur?}. */
async function creerDuel(mesure,duree){
  const u=currentUser;
  if(!u||u.role==='coach') return {ok:false,erreur:'Réservé aux athlètes.'};
  if(!CLOUD.ok()) return {ok:false,erreur:'Impossible hors connexion.'};
  const m=DUEL_MESURES.find(x=>x.cle===mesure)?mesure:'seances';
  const d=DUEL_DUREES.indexOf(Number(duree))>=0?Number(duree):14;
  const id=duelNouvelId(), moi=_moiCle();
  const prenom=String(u.fname||u.pseudo||'').trim().slice(0,24)||'Un ami';
  const mp=_monPseudo(u), duel={createur:moi,createurNom:prenom,mesure:m,duree:d,creeLe:Date.now(),statut:'attente'};
  if(mp) duel.createurPseudo=pseudoPublicCle(mp);
  let ok=await CLOUD.racinePatch({['duels/'+id]:duel,['duels_publics/'+id]:{prenom,mesure:m,duree:d}}).catch(()=>false);
  // Des règles d'avant le pseudo dans les duels : sans lui.
  if(!ok&&duel.createurPseudo){ delete duel.createurPseudo;
    ok=await CLOUD.racinePatch({['duels/'+id]:duel,['duels_publics/'+id]:{prenom,mesure:m,duree:d}}).catch(()=>false); }
  if(!ok) return {ok:false,erreur:'Création impossible pour l’instant.'};
  u.duels=Object.assign({},u.duels||{},{[id]:{role:'createur',le:Date.now()}});
  try{ saveUser(); }catch(e){}
  _duelsCache[id]={createur:moi,createurNom:prenom,mesure:m,duree:d,statut:'attente',creeLe:Date.now()};
  return {ok:true,id};
}
// ── Rejoindre ─────────────────────────────────────────────────────────────
/** L'invitation en attente sur cet appareil (arrivée par ?duel=), ou null. */
function duelInviteEnAttente(){
  try{
    const o=JSON.parse(localStorage.getItem(DUEL_INVITE_CLE)||'null');
    if(o&&DUEL_ID_RE.test(o.id)&&Date.now()-Number(o.le)<30*864e5) return o;
  }catch(e){}
  return null;
}
function duelOublierInvite(){ try{ localStorage.removeItem(DUEL_INVITE_CLE); }catch(e){} }
async function rejoindreDuel(id,btn){
  const u=currentUser;
  if(!u||!DUEL_ID_RE.test(String(id||''))) return false;
  if(btn){ btn.disabled=true; }
  const moi=_moiCle();
  const prenom=String(u.fname||u.pseudo||'').trim().slice(0,24)||'Un ami';
  const ok=await CLOUD.racinePatch({['duels/'+id+'/invite']:moi,['duels/'+id+'/inviteNom']:prenom}).catch(()=>false);
  // Mon pseudo, à part : des règles d'avant ne le refusent pas avec le reste.
  const mp=_monPseudo(u);
  if(ok&&mp) CLOUD.racinePatch({['duels/'+id+'/invitePseudo']:pseudoPublicCle(mp)}).catch(()=>false);
  duelOublierInvite();
  if(!ok){
    if(btn) btn.disabled=false;
    toast('Ce duel n’est plus ouvert (déjà relevé, ou c’est le tien).','var(--orange)');
    _rendreDuelsAccueil();
    return false;
  }
  u.duels=Object.assign({},u.duels||{},{[id]:{role:'invite',le:Date.now()}});
  try{ saveUser(); }catch(e){}
  deposerEvenement({type:'duel_rejoint',id}).catch(()=>{});
  toast('Défi relevé ⚡ Il commence à ta prochaine séance.','var(--green)',4000);
  delete _duelsCache[id];
  _rendreDuelsAccueil();
  return true;
}
// ── Après une séance : chacun écrit SA valeur ────────────────────────────
// En cours : la valeur (defiValeur, la règle des défis du Canal) dans
// progres/<moi>, puis l'événement. Accepté et invité : l'événement seul (c'est
// la première séance, le Worker démarre le duel).
async function duelsApresSeance(){
  const u=currentUser;
  if(!SERVEUR_LEGER||!u||u.role==='coach'||!CLOUD.ok()) return 0;
  const moi=_moiCle();
  let n=0;
  for(const id of _mesDuels(u)){
    const x=u.duels[id];
    if(x.fini) continue;
    let d=null; try{ d=await _duelLire(id); }catch(e){ d=null; }
    if(!d) continue;
    _duelsCache[id]=d;
    if(d.statut==='termine'||d.statut==='annule'){ x.fini=true; continue; }
    if(d.statut==='accepte'&&d.invite===moi){ await deposerEvenement({type:'duel_maj',id}).catch(()=>{}); n++; continue; }
    if(d.statut!=='en_cours') continue;
    const v=defiValeur(u,{mesure:d.mesure,debut:Number(d.debut),fin:Number(d.fin)});
    const token=await CLOUD._getToken();
    if(!token) continue;
    const r=await fetch(CLOUD._fbUrl.replace('users.json','duels/'+id+'/progres/'+moi+'.json')+'?auth='+token,
      {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({valeur:Math.max(0,Number(v)||0),maj:Date.now()})}).catch(()=>null);
    if(r&&r.ok){ await deposerEvenement({type:'duel_maj',id}).catch(()=>{}); n++; }
  }
  try{ saveUser(); }catch(e){}
  return n;
}
// ── L'accueil : l'invitation reçue, les duels en cours, « Défie un pote » ──
const _duelsCache={};
let _duelsLusLe=0;
// PURE. Où en est un duel, vu par `moi` : une ligne.
function duelLigne(d,moi,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!d) return '';
  const lui=d.createur===moi?(d.inviteNom||'ton pote'):(d.createurNom||'ton adversaire');
  const txt=texteDuel(d.mesure,d.duree);
  if(d.statut==='attente') return txt+' · en attente de ton pote';
  if(d.statut==='accepte'&&d.invite===moi&&d.createurPseudo) return (d.createurNom||'Ton pote')+' te défie : '+txt+' · ta prochaine séance lance le compte';
  if(d.statut==='accepte') return txt+' contre '+lui+' · démarre à '+(d.invite===moi?'ta':'sa')+' première séance';
  if(d.statut==='en_cours'){
    const s=d.scores||{};
    const a=d.createur===moi?Number(s.createur)||0:Number(s.invite)||0, b=d.createur===moi?Number(s.invite)||0:Number(s.createur)||0;
    const j=Math.max(0,Math.ceil((Number(d.fin)-t)/864e5));
    return 'Contre '+lui+' · '+texteScoreDuel(d.mesure,a)+' à '+texteScoreDuel(d.mesure,b)+' · '+(j?'J-'+j:'dernier jour');
  }
  if(d.statut==='termine'){
    const g=d.gagnant, role=d.createur===moi?'createur':'invite';
    return (g==='egalite'?'Égalité':(g===role?'Gagné':'Perdu'))+' contre '+lui;
  }
  if(d.statut==='annule') return 'Duel annulé contre '+lui;
  return '';
}
function htmlDuelsAccueil(u,duels,invite,maintenant){
  if(!u||u.role==='coach'||!SERVEUR_LEGER) return '';
  const moi=String((u.email||'')).replace(/\./g,',');
  // L'ACCUEIL NE PORTE PLUS QUE LE BANDEAU (Kevin, 29/09/2026) : l'invitation
  // reçue et les duels en cours s'ouvrent au toucher (ouvrirDuelsHub), avec
  // « Nouveau défi ». Une pastille dit combien il y en a.
  const n=(invite&&invite.prenom?1:0)+_duelsListe(duels,maintenant).length;
  return '<div class="du-accueil"><button type="button" class="du-defier" onclick="ouvrirDuelsHub()">'
    +'<span class="du-d-ico" aria-hidden="true">'+icon('haches',23)+'</span>'
    +'<span class="du-d-t">Défie un pote</span>'
    +'<span class="du-d-s" aria-hidden="true">Comparez-vous<br>et progressez</span>'
    +(n?'<span class="du-d-n" aria-label="'+n+' défi'+(n>1?'s':'')+'">'+n+'</span>':'')
    +'<span class="du-d-ch" aria-hidden="true">'+icon('chevron-right',20)+'</span></button></div>';
}
function _duelsListe(duels,maintenant){
  return Object.keys(duels||{}).map(id=>Object.assign({id},duels[id])).filter(d=>d&&d.statut)
    .filter(d=>d.statut!=='annule'&&!(d.statut==='termine'&&Number(d.termineLe)<(maintenant||Date.now())-7*864e5))
    .sort((a,b)=>(Number(b.creeLe)||0)-(Number(a.creeLe)||0)).slice(0,6);
}
// PURE. Le contenu de la feuille : le défi reçu, les défis en cours, et
// « Nouveau défi ».
function htmlDuelsHub(u,duels,invite,maintenant){
  if(!u||u.role==='coach') return '';
  const moi=String((u.email||'')).replace(/\./g,',');
  let h='';
  if(invite&&invite.prenom){
    h+='<div class="du-invite"><div class="du-invite-t">'+escapeHtml(invite.prenom)+' te défie : '+escapeHtml(texteDuel(invite.mesure,invite.duree))+'</div>'
      +'<div class="du-btns"><button type="button" class="btn btn-red btn-sm" onclick="rejoindreDuel(\''+invite.id+'\',this)">Relever le défi</button>'
      +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="duelOublierInvite();fermerDuelFeuille();_rendreDuelsAccueil()">Plus tard</button></div></div>';
  }
  const l=_duelsListe(duels,maintenant);
  if(l.length) h+='<div class="du-lab">Défis en cours</div><div class="du-liste">'+l.map(d=>
    '<button type="button" class="du-ligne" onclick="fermerDuelFeuille();ouvrirDuel(\''+d.id+'\')"><span aria-hidden="true">⚔</span> '
      +'<span>'+escapeHtml(duelLigne(d,moi,maintenant))+'</span><span class="du-f" aria-hidden="true">›</span></button>').join('')+'</div>';
  return h;
}
let _duelsInvite=null;
// Le toucher du bandeau : la feuille « Mes défis », toujours. Elle porte le
// défi reçu, ceux en cours, le carnet d'amis (on défie un pote d'ici, pas de
// l'accueil) et « Nouveau défi ».
function ouvrirDuelsHub(){
  const u=currentUser; if(!u) return false;
  if(u.role==='coach') return ouvrirCreationDuel();
  const corps=htmlDuelsHub(u,_duelsCache,_duelsInvite,Date.now());
  document.getElementById('duel-feuille')?.remove();
  const d=document.createElement('div');
  d.id='duel-feuille'; d.className='du-fond';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Mes défis');
  d.innerHTML='<div class="du-carte du-v2">'
    +'<button type="button" class="du-x" aria-label="Fermer" onclick="fermerDuelFeuille()">'+icon('x',18)+'</button>'
    +'<div class="du-ecu">'+DUEL_ECUSSON+'</div>'
    +'<div class="du-titre"><span>Mes</span> défis</div>'
    +'<p class="du-sous">Tes défis, tes amis, ou un nouveau défi à lancer.</p>'
    +corps
    +'<div id="clh-amis" class="du-amis"></div>'
    +'<button type="button" class="btn btn-red du-go du-lancer" onclick="ouvrirCreationDuel()">'
      +'<span class="du-l-ico" aria-hidden="true">'+icon('haches',26)+'</span><span class="du-l-t">Nouveau défi</span>'
      +'<span class="du-l-ch" aria-hidden="true">'+icon('chevron-right',22)+'</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm du-go du-annuler" onclick="fermerDuelFeuille()">Fermer</button>'
    +'</div>';
  d.addEventListener('click',e=>{ if(e.target===d) fermerDuelFeuille(); });
  document.body.appendChild(d);
  try{ renderAmisAccueil(); }catch(e){}
  return true;
}
// ══ LES AMIS : LE CARNET (lot A, 29/09/2026) ══════════════════════════════
// Un carnet À SENS UNIQUE : /amis/<ma clé>/<pseudo> = {le, prenom}. Suivre
// ne demande rien et ne notifie rien. « Ami » = les deux se suivent, et ça se
// CONSTATE dans /abonnes/<mon pseudo>/<son pseudo> (écrit par qui suit, lu par
// le seul titulaire du pseudo suivi) : la clé d'un autre compte est son
// e-mail, et /pseudos n'est lisible par personne.
// Le prénom est la SEULE copie, pour que la liste s'affiche hors ligne ;
// rang, volts et badges se lisent dans le profil public, qui ne ment pas.
// Le carnet vit AUSSI sur l'appareil : une écriture que la base refuse (hors
// ligne, ou règles pas encore déployées) part à la synchronisation suivante.
// ⚠ JAMAIS DE RECHERCHE PAR ADRESSE : savoir si un e-mail a un compte est une
//   fuite, et on peut tester une liste entière.
const AMIS_MAX=300;
const AMIS_CACHE_MS=10*60e3;
// PURE. « @Marc.Fit », « marc fit » → « marc.fit », « marcfit ».
function amiPseudoNormalise(p){ return String(p==null?'':p).trim().replace(/^@+/,'').replace(/\s+/g,'').toLowerCase(); }
function amiPseudoValide(p){ return PSEUDO_PUBLIC_RE.test(String(p||'')); }
// La clé en base → le pseudo affiché (« __ » redevient un point).
function amiPseudoDeCle(k){ return String(k||'').replace(/__/g,'.'); }
function _monPseudo(u){
  const x=u||currentUser, p=x&&x.pagePublique&&x.pagePublique.pseudo;
  return PSEUDO_PUBLIC_RE.test(p||'')?p:'';
}
function _amisCle(){ return 'rc_amis_'+(_moiCle()||'-'); }
function amisLocal(){
  try{ const o=JSON.parse(localStorage.getItem(_amisCle())||'null');
    if(o&&typeof o==='object') return {amis:(o.amis&&typeof o.amis==='object')?o.amis:{},att:(o.att&&typeof o.att==='object')?o.att:{},abonnes:(o.abonnes&&typeof o.abonnes==='object')?o.abonnes:{}}; }catch(e){}
  return {amis:{},att:{},abonnes:{}};
}
function _amisGarder(o){ try{ localStorage.setItem(_amisCle(),JSON.stringify(o)); }catch(e){} }
// PURE. Le carnet en liste : [{cle, p, prenom, le}].
function amisListe(o){
  const x=o||amisLocal();
  return Object.keys(x.amis).map(k=>Object.assign({cle:k,p:amiPseudoDeCle(k)},x.amis[k]));
}
// PURE. Le plafond : 300 dans le carnet, et une écriture de plus refusée.
function amisPlein(o){ return Object.keys(((o||amisLocal()).amis)||{}).length>=AMIS_MAX; }
// PURE. « Ami » : je le suis, ET il me suit (constaté dans mes abonnés).
function amiEstMutuel(cle,o){ const x=o||amisLocal(); return !!(x.amis[cle]&&x.abonnes[cle]); }
async function _fbJson(chemin,methode,corps,sansCompte){
  let url=CLOUD._fbUrl.replace('users.json',chemin+'.json');
  if(!sansCompte){
    let tok=null; try{ tok=await CLOUD._getToken(); }catch(e){ tok=null; }
    if(!tok) return {ok:false,st:0,v:null};
    url+='?auth='+tok;
  }
  try{
    const r=await fetch(url,methode?{method:methode,headers:{'Content-Type':'application/json'},body:corps===undefined?undefined:JSON.stringify(corps)}:{});
    return {ok:r.ok,st:r.status,v:r.ok?await r.json():null};
  }catch(e){ return {ok:false,st:0,v:null}; }
}
// Le profil public d'un pseudo (profils_publics, et le rang recalculé par le
// serveur dans volts_publics) : dix minutes de mémoire. RIEN d'autre n'est
// gardé que ce qui s'affiche : prénom, rang, volts, badges, semaines.
const _amisProfils={};
function _profilAmiNettoye(p,v){
  if(!p||typeof p!=='object'||!p.prenom) return null;
  const vx=(v&&typeof v==='object'&&v.xp!=null)?v:((p.volts&&typeof p.volts==='object')?p.volts:null);
  const rang=(v&&v.rang)||p.rang||null;
  const bdg=Array.isArray(p.badges)?p.badges:(p.badges&&typeof p.badges==='object'?Object.values(p.badges):[]);
  return {prenom:String(p.prenom).slice(0,24),
    rang:rang&&rang.nom?{n:Math.max(1,Math.min(10,Number(rang.n)||1)),nom:String(rang.nom).slice(0,20)}:null,
    volts:vx?Math.max(0,Math.round(Number(vx.xp)||0)):null,
    badges:bdg.filter(b=>b&&b.nom).slice(0,8).map(b=>String(b.nom).slice(0,40)),
    sem:(v&&v.sem&&typeof v.sem==='object')?v.sem:null,
    // Le JOUR de sa dernière séance (les réactions s'y accrochent) : une date, rien de ce qu'elle contenait.
    der:(v&&/^\d{4}-\d{2}-\d{2}$/.test(String(v.derJour||'')))?String(v.derJour):null};
}
async function _profilAmi(cle,force){
  const c=_amisProfils[cle];
  if(c&&!force&&Date.now()-c.lu<AMIS_CACHE_MS) return c.v;
  const [p,v]=await Promise.all([_fbJson('profils_publics/'+cle,null,undefined,true),_fbJson('volts_publics/'+cle,null,undefined,true)]);
  if(!p.ok&&c) return c.v;
  const val=_profilAmiNettoye(p.v,v.v);
  _amisProfils[cle]={lu:Date.now(),v:val};
  return val;
}
// LA RECHERCHE : un pseudo, jamais une adresse. Rend {trouve, pseudo, prenom,
// rang, volts, badges} ou {trouve:false, pseudo}. Aucune lecture de users/.
async function amiChercher(pseudo){
  const p=amiPseudoNormalise(pseudo);
  if(!amiPseudoValide(p)) return {trouve:false,pseudo:p,invalide:true};
  const v=await _profilAmi(pseudoPublicCle(p),true);
  if(!v) return {trouve:false,pseudo:p};
  return Object.assign({trouve:true,pseudo:p},v);
}
async function amiSuivre(pseudo,prenom){
  const u=currentUser; if(!u) return false;
  const p=amiPseudoNormalise(pseudo), cle=pseudoPublicCle(p);
  if(!amiPseudoValide(p)){ toast('Ce nom ne ressemble pas à un pseudo RepCore.','var(--orange)'); return false; }
  if(p===_monPseudo(u)){ toast('C’est ton propre nom : tes potes, eux, peuvent te suivre.','var(--orange)'); return false; }
  const o=amisLocal();
  if(!o.amis[cle]&&amisPlein(o)){ toast('Ton carnet est plein (300). Retire quelqu’un pour suivre '+(prenom||p)+'.','var(--orange)',4500); return false; }
  const nom=String(prenom||'').trim().slice(0,24)||p;
  o.amis[cle]={prenom:nom,le:Date.now()}; o.att[cle]='+';
  _amisGarder(o);
  toast('Tu suis '+nom+' : ses volts de la semaine s’affichent sur ton accueil.','var(--green)',4000);
  _rendreAmisPartout();
  amisSynchroniser().catch(()=>{});
  return true;
}
async function amiRetirer(pseudo){
  const p=amiPseudoNormalise(pseudo), cle=pseudoPublicCle(p);
  const o=amisLocal();
  const nom=(o.amis[cle]&&o.amis[cle].prenom)||p;
  delete o.amis[cle]; o.att[cle]='-';
  _amisGarder(o);
  toast('Tu ne suis plus '+nom+'. Il n’en est pas prévenu.','var(--green)');
  _rendreAmisPartout();
  amisSynchroniser().catch(()=>{});
  return true;
}
// LA SYNCHRONISATION : ce qui attend part, puis le carnet et mes abonnés sont
// relus (un autre appareil a pu suivre quelqu'un). Silencieuse.
let _amisSyncLe=0;
async function amisSynchroniser(force){
  const u=currentUser;
  if(!u||u.role==='coach'||!CLOUD||!CLOUD.ok()) return false;
  const moi=_moiCle(), mp=_monPseudo(u), mk=mp?pseudoPublicCle(mp):'';
  const o=amisLocal();
  for(const cle of Object.keys(o.att)){
    const plus=o.att[cle]==='+', e=o.amis[cle];
    let ok=false;
    if(plus&&e){
      ok=(await _fbJson('amis/'+moi+'/'+cle,'PUT',{le:Number(e.le)||Date.now(),prenom:String(e.prenom||'').slice(0,24)})).ok;
      if(ok&&mk) await _fbJson('abonnes/'+cle+'/'+mk,'PUT',{le:Number(e.le)||Date.now()});
    }else if(!plus){
      ok=(await _fbJson('amis/'+moi+'/'+cle,'DELETE')).ok;
      if(ok&&mk) await _fbJson('abonnes/'+cle+'/'+mk,'DELETE');
    }else ok=true;
    if(ok) delete o.att[cle];
  }
  if(force||Date.now()-_amisSyncLe>AMIS_CACHE_MS){
    _amisSyncLe=Date.now();
    const r=await _fbJson('amis/'+moi);
    if(r.ok&&r.v&&typeof r.v==='object'){
      for(const k of Object.keys(r.v)) if(!o.att[k]&&!o.amis[k]&&r.v[k]&&r.v[k].prenom) o.amis[k]={prenom:String(r.v[k].prenom).slice(0,24),le:Number(r.v[k].le)||0};
      for(const k of Object.keys(o.amis)) if(!o.att[k]&&!r.v[k]) delete o.amis[k];
    }
    if(mk){ const a=await _fbJson('abonnes/'+mk); if(a.ok) o.abonnes=(a.v&&typeof a.v==='object')?Object.fromEntries(Object.keys(a.v).map(k=>[k,1])):{}; }
  }
  _amisGarder(o);
  return true;
}
// PURE. Le lundi (AAAA-MM-JJ) de la semaine d'un instant : celui de
// _lundiDe, en date locale — la même borne que le Worker (heure de Paris).
function lundiISO(t){ return localISODate(_lundiDe(typeof t==='number'?t:Date.now())); }
// PURE. Les volts de la semaine en cours d'un profil ami (volts_publics.sem).
function voltsSemaineDe(prof,t){
  const s=prof&&prof.sem; if(!s) return 0;
  const x=s[lundiISO(t)];
  return Math.max(0,Math.round(Number(x&&x.v)||0));
}
// PURE. La régularité : les semaines actives parmi les quatre dernières.
function regulariteDe(prof,t){
  const s=prof&&prof.sem; if(!s) return 0;
  let n=0;
  for(let i=0;i<4;i++){ const x=s[localISODate(_datePlusJours(_lundiDe(t),-7*i))]; if(x&&Number(x.n)>0) n++; }
  return n;
}
// PURE. Le tri : volts de la semaine, puis le plus régulier, puis le prénom.
function amisTries(liste,t){
  return (liste||[]).slice().sort((a,b)=>(voltsSemaineDe(b.prof,t)-voltsSemaineDe(a.prof,t))
    ||(regulariteDe(b.prof,t)-regulariteDe(a.prof,t))
    ||String(a.prenom||'').localeCompare(String(b.prenom||''),'fr'));
}
// ══ LE JEU ENTRE AMIS (lot D, 29/09/2026) ═════════════════════════════════
// Rien ne relit un historique : les volts de la semaine sont une somme tenue
// par le Worker à chaque séance (volts_publics/<pseudo>.sem, treize semaines),
// et tout le reste se calcule ici sur ce que la liste a déjà lu.
//
// PURE. La série partagée : les semaines d'affilée où CHACUN a fait au moins
// une séance. La semaine en cours ne coupe rien tant qu'elle n'est pas finie.
function serieCommune(mes,ses,t){
  const a=mes||{}, b=ses||{}, l0=_lundiDe(typeof t==='number'?t:Date.now());
  const deux=(k)=>Number(a[k]&&a[k].n)>0&&Number(b[k]&&b[k].n)>0;
  let n=0, i=0;
  if(deux(localISODate(l0))) n=1;
  for(i=1;i<60;i++){ if(!deux(localISODate(_datePlusJours(l0,-7*i)))) break; n++; }
  return n;
}
// PURE. Le classement de la semaine : les amis ET moi, par volts de la
// semaine, puis le plus régulier. Chaque ligne porte son rang et son écart
// avec le premier.
function classementSemaine(moi,liste,t){
  const tous=(moi?[Object.assign({moi:true},moi)]:[]).concat(liste||[]);
  const tri=amisTries(tous,t);
  const v0=tri.length?voltsSemaineDe(tri[0].prof,t):0;
  return tri.map((x,i)=>Object.assign({},x,{rg:i+1,vs:voltsSemaineDe(x.prof,t),ecart:v0-voltsSemaineDe(x.prof,t)}));
}
// PURE. Le classement en une phrase, premier comme dernier. Le dernier n'est
// jamais nommé ainsi : il voit l'écart avec celui juste devant.
function phraseClassement(tri){
  const i=(tri||[]).findIndex(x=>x.moi);
  const fin=' La semaine repart lundi.';
  if(i<0||tri.length<2) return 'Suis un pote pour lancer le classement de la semaine.'+fin;
  const me=tri[i];
  if(tri.every(x=>!x.vs)) return 'Personne n’a encore de volts cette semaine : ta prochaine séance prend la tête.'+fin;
  if(i===0){
    const s=tri[1];
    return (me.vs===s.vs?'Tu mènes la semaine à égalité avec '+s.prenom+', devant à la régularité.'
      :'Tu mènes la semaine avec '+me.vs+' V, '+s.prenom+' suit à '+s.vs+' V.')+fin;
  }
  const d=tri[i-1], e=d.vs-me.vs;
  return (e>0?'Tu es à '+e+' V de '+d.prenom+'. Une séance peut suffire.'
    :'À égalité avec '+d.prenom+' : la régularité vous départage.')+fin;
}
// PURE. La meilleure série partagée à dire, et la relance de fin de semaine
// (samedi et dimanche) à celui qui manque, jamais à celui qui mène : il faut
// une série en cours, l'ami qui a fait sa séance cette semaine, et moi pas.
function serieAmisLigne(monSem,liste,t){
  const l0=localISODate(_lundiDe(t)), js=new Date(t).getDay();
  let best=null, rappel=null;
  for(const x of (liste||[])){
    const ses=x.prof&&x.prof.sem; if(!ses) continue;
    const n=serieCommune(monSem,ses,t);
    if(n>=2&&(!best||n>best.n)) best={n,prenom:x.prenom};
    const moiFait=Number(monSem&&monSem[l0]&&monSem[l0].n)>0, luiFait=Number(ses[l0]&&ses[l0].n)>0;
    if((js===6||js===0)&&n>=1&&!moiFait&&luiFait&&(!rappel||n>rappel.n)) rappel={n,prenom:x.prenom};
  }
  return {serie:best?best.prenom+' et toi tenez à deux depuis '+best.n+' semaines.':'',
    rappel:rappel?rappel.prenom+' a fait sa séance cette semaine. Une séance d’ici dimanche soir et votre série de '+rappel.n+' semaine'+(rappel.n>1?'s':'')+' continue.':''};
}
// La relance de fin de semaine, UNE fois : le jour où elle s'affiche la
// première fois, et ce jour-là seulement.
function _serieRappelUneFois(t){
  const k='rc_serie_rappel_'+localISODate(_lundiDe(t)), j=localISODate(new Date(t));
  let v=null; try{ v=localStorage.getItem(k); }catch(e){}
  if(v&&v!==j) return false;
  if(!v) try{ localStorage.setItem(k,j); }catch(e){}
  return true;
}
// LES RÉACTIONS : cinq emojis FIXES sur la dernière séance d'un ami. Jamais
// de texte, jamais ce qu'il y avait dans la séance.
const REACTIONS_AMIS=Object.freeze(['💪','🔥','👏','😮','⚡']);
function _reacCle(){ return 'rc_reac_'+_moiCle(); }
function reactionsLocales(){ try{ return JSON.parse(localStorage.getItem(_reacCle())||'{}')||{}; }catch(e){ return {}; } }
// PURE. Une réaction par ami et par jour de séance, remplaçable : la carte
// {<pseudo>|<jour>: emoji}, gardée sur quatorze jours.
function reactionPoserLocal(m,cle,jour,emoji,t){
  const o=Object.assign({},m||{});
  if(REACTIONS_AMIS.indexOf(emoji)<0||!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return o;
  o[cle+'|'+jour]=emoji;
  const lim=localISODate(_datePlusJours(t||Date.now(),-14));
  for(const k of Object.keys(o)) if(k.split('|')[1]<lim) delete o[k];
  return o;
}
// PURE. Peut-on réagir à la dernière séance de cet ami ? Dans les sept jours.
function reactionPossible(prof,t){
  const j=prof&&prof.der; if(!j) return false;
  return j>=localISODate(_datePlusJours(t,-7))&&j<=localISODate(new Date(t));
}
async function amiReagir(pseudo,emoji,btn){
  const u=currentUser; if(!u) return false;
  const p=amiPseudoNormalise(pseudo), cle=pseudoPublicCle(p), mp=_monPseudo(u);
  const prof=(_amisProfils[cle]||{}).v;
  if(!mp){ toast('Choisis ton nom dans Mon profil pour réagir aux séances de tes potes.','var(--orange)',4000); return false; }
  if(REACTIONS_AMIS.indexOf(emoji)<0||!reactionPossible(prof,Date.now())) return false;
  const r=await _fbJson('reactions/'+cle+'/'+prof.der+'/'+pseudoPublicCle(mp),'PUT',emoji);
  if(!r.ok){ toast(r.st===401||r.st===403?'Suis '+(prof.prenom||p)+' pour réagir à ses séances.':'Réaction non envoyée : réessaie une fois connecté.','var(--orange)'); return false; }
  try{ localStorage.setItem(_reacCle(),JSON.stringify(reactionPoserLocal(reactionsLocales(),cle,prof.der,emoji,Date.now()))); }catch(e){}
  deposerEvenement({type:'reaction',cible:cle,jour:prof.der}).catch(()=>{});
  const z=btn&&btn.closest('.am-reac');
  if(z) z.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.textContent===emoji));
  return true;
}
// PURE. La rangée des cinq emojis d'un ami (celui que j'ai choisi, allumé).
function htmlReactionsAmi(x,t,loc){
  if(!x||!reactionPossible(x.prof,t)) return '';
  const mien=(loc||{})[x.cle+'|'+x.prof.der]||'';
  return '<div class="am-reac" role="group" aria-label="Réagir à la séance de '+escapeHtml(x.prenom||x.p)+'">'
    +REACTIONS_AMIS.map(e=>'<button type="button" class="'+(e===mien?'on':'')+'" onclick="amiReagir(\''+escapeHtml(x.p)+'\',\''+e+'\',this)">'+e+'</button>').join('')+'</div>';
}
// PURE. Le palmarès des duels contre un ami : gagnés, perdus, égalités, et la
// date du dernier. Ce que l'app a déjà (les duels suivis) : de l'affichage.
function bilanDuelsContre(cache,cleAmi,moi){
  const o={g:0,p:0,e:0,dernier:0};
  for(const id of Object.keys(cache||{})){
    const d=cache[id];
    if(!d||d.statut!=='termine'||(d.invitePseudo!==cleAmi&&d.createurPseudo!==cleAmi)) continue;
    const role=d.createur===moi?'createur':'invite';
    if(d.gagnant==='egalite') o.e++; else if(d.gagnant===role) o.g++; else if(d.gagnant) o.p++;
    o.dernier=Math.max(o.dernier,Number(d.termineLe)||0);
  }
  return o;
}
function texteBilanDuels(b){
  if(!b||!(b.g+b.p+b.e)) return '';
  const m=[];
  if(b.g) m.push(b.g+' gagné'+(b.g>1?'s':''));
  if(b.p) m.push(b.p+' perdu'+(b.p>1?'s':''));
  if(b.e) m.push(b.e+' égalité'+(b.e>1?'s':''));
  return 'Vos duels : '+m.join(', ')+(b.dernier?' · dernier le '+new Date(b.dernier).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):'');
}
function _amiInitiales(p){ const m=String(p||'?').trim().split(/\s+/); return ((m[0]||'?')[0]+(m[1]?m[1][0]:'')).toUpperCase(); }
// PURE. Une ligne d'ami : avatar (initiales), prénom, rang, volts de la
// semaine, « Défier ». Aucune donnée corporelle : il n'y en a nulle part.
function htmlLigneAmi(x,t,o){
  const pr=x.prof||null, vs=voltsSemaineDe(pr,t);
  const rang=pr&&pr.rang?pr.rang.nom:'';
  const rg=x.rg?'<span class="am-rg" aria-label="'+x.rg+'e">'+x.rg+'</span>':'';
  if(x.moi){
    return '<div class="am-ligne am-moi">'+rg
      +'<span class="am-av" aria-hidden="true">'+escapeHtml(_amiInitiales(x.prenom))+'</span>'
      +'<span class="am-id"><span class="am-nom"><b>Toi</b></span><small>'+escapeHtml(x.ecart>0?'à '+x.ecart+' V du premier':x.rg===1?'en tête':'')+'</small></span>'
      +'<span class="am-v"><b>'+vs+'</b><small>V cette semaine</small></span></div>';
  }
  const mut=amiEstMutuel(x.cle,o);
  return '<div class="am-ligne">'+rg
    +'<span class="am-av" aria-hidden="true">'+escapeHtml(_amiInitiales(x.prenom))+'</span>'
    +'<span class="am-id"><span class="am-nom"><b>'+escapeHtml(x.prenom||x.p)+'</b>'+(mut?'<i class="am-mut">ami</i>':'')+'</span>'
      +'<small>'+escapeHtml(rang?rang.charAt(0)+rang.slice(1).toLowerCase():'@'+x.p)+'</small></span>'
    +'<span class="am-v"><b>'+vs+'</b><small>V cette semaine</small></span>'
    +(x.rev?'<button type="button" class="am-defi" onclick="event.stopPropagation();amiRevanche(\''+escapeHtml(x.p)+'\',\''+x.rev.mesure+'\','+x.rev.duree+',this)">Revanche</button>'
      :'<button type="button" class="am-defi" onclick="event.stopPropagation();amiDefier(\''+escapeHtml(x.p)+'\')">Défier</button>')
    +'</div>';
}
// PURE. La carte de l'accueil. Vide, elle dit quoi faire, et qui agit.
function htmlAmisAccueil(liste,t,o,monPseudo,moi){
  const tete='<div class="am-tete"><span class="am-titre">Mes amis</span>'
    +'<button type="button" class="am-tout" onclick="ouvrirAmis()">'+(liste.length?'Tout voir':'Chercher')+'</button></div>';
  if(!liste.length){
    return '<div class="am-carte">'+tete
      +'<p class="am-vide">Suis tes potes pour voir leurs volts de la semaine et les défier en un geste. Cherche leur pseudo, ou envoie-leur ton lien.</p>'
      +'<div class="am-btns"><button type="button" class="btn btn-outline btn-sm btn-casse" onclick="ouvrirAmis()">Chercher un pseudo</button>'
      +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="amiEnvoyerLien(this)">Envoyer mon lien</button></div>'
      +(monPseudo?'':'<p class="am-note">Choisis ton nom pour que tes potes te trouvent : <a href="#" onclick="amisVersPseudo();return false">Mon profil</a>.</p>')
      +'</div>';
  }
  return '<div class="am-carte">'+tete+htmlClassementSemaine(liste,t,o,moi||null)+'</div>';
}
// PURE. Le classement de la semaine, la phrase qui le lit, la série partagée
// et, le samedi et le dimanche, la relance à celui qui manque (une fois).
// `moi` : mon profil public ({cle, prenom, prof}), ou null sans pseudo.
function htmlClassementSemaine(liste,t,o,moi){
  const tri=classementSemaine(moi,liste,t);
  const phrase=moi?phraseClassement(tri):'Choisis ton nom dans Mon profil pour entrer dans le classement de la semaine. La semaine repart lundi.';
  const s=moi?serieAmisLigne(moi.prof&&moi.prof.sem,liste,t):{serie:'',rappel:''};
  const rappel=s.rappel&&_serieRappelUneFois(t)?s.rappel:'';
  const n=tri.length, i=tri.findIndex(x=>x.moi);
  // Les cinq premiers, et moi si je suis plus loin.
  const vus=tri.filter((x,k)=>k<5||k===i);
  return '<p class="am-phrase">'+escapeHtml(phrase)+'</p>'
    +(rappel?'<p class="am-serie am-rappel">'+escapeHtml(rappel)+'</p>':s.serie?'<p class="am-serie">'+escapeHtml(s.serie)+'</p>':'')
    +vus.map(x=>htmlLigneAmi(x,t,o)).join('')
    +(n>vus.length?'<button type="button" class="am-plus" onclick="ouvrirAmis()">Voir les '+n+'</button>':'');
}
// PURE. La fiche trouvée par la recherche.
function htmlFicheAmi(r,suivi){
  if(!r||!r.trouve) return htmlAmiIntrouvable(r&&r.pseudo,r&&r.invalide);
  return '<div class="am-fiche">'
    +'<span class="am-av am-av-g" aria-hidden="true">'+escapeHtml(_amiInitiales(r.prenom))+'</span>'
    +'<div class="am-fiche-t"><b>'+escapeHtml(r.prenom)+'</b><small>@'+escapeHtml(r.pseudo)+'</small>'
      +'<span class="am-fiche-r">'+(r.rang?escapeHtml(r.rang.nom):'Rang non affiché')+(r.volts!=null?' · '+Number(r.volts).toLocaleString('fr-FR')+' V':'')+'</span>'
      +(r.badges&&r.badges.length?'<span class="am-fiche-b">'+r.badges.map(escapeHtml).join(' · ')+'</span>':'')+'</div>'
    +'<button type="button" id="am-suivre" class="btn '+(suivi?'btn-outline':'btn-red')+' btn-sm btn-casse am-suivre" data-p="'+escapeHtml(r.pseudo)+'" data-n="'+escapeHtml(r.prenom)+'" onclick="amiBasculerSuivi(this)">'+(suivi?'Suivi ✓':'Suivre')+'</button>'
    +'</div>';
}
// PURE. Personne à ce nom : on ne dit pas « n'existe pas » sèchement, on
// propose le lien.
function htmlAmiIntrouvable(p,invalide){
  return '<div class="am-fiche am-rien"><p>'+(invalide
      ?'Un pseudo RepCore fait de 3 à 20 caractères : lettres, chiffres, point ou tiret bas.'
      :'On ne trouve personne à ce nom'+(p?' (@'+escapeHtml(p)+')':'')+'. Ton pote n’a peut-être pas encore choisi le sien : envoie-lui ton lien, il te trouvera en un geste.')+'</p>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="amiEnvoyerLien(this)">Envoyer mon lien</button></div>';
}
async function _amisAvecProfils(){
  const l=amisListe();
  await Promise.all(l.map(async x=>{ try{ x.prof=await _profilAmi(x.cle); }catch(e){ x.prof=null; } }));
  for(const x of l){ const d=dernierDuelContre(_duelsCache,x.cle); if(d) x.rev=revancheParams(d); }
  return l;
}
async function renderAmisAccueil(){
  const z=document.getElementById('clh-amis');
  const u=currentUser;
  if(!z) return false;
  if(!u||u.role==='coach'){ z.innerHTML=''; return false; }
  // D'abord ce que l'appareil sait (hors ligne), puis les profils.
  z.innerHTML=htmlAmisAccueil(amisListe(),Date.now(),amisLocal(),_monPseudo(u));
  try{ await amisSynchroniser(); }catch(e){}
  const [l,moi]=await Promise.all([_amisAvecProfils(),_moiClassement(u)]);
  z.innerHTML=htmlAmisAccueil(l,Date.now(),amisLocal(),_monPseudo(u),moi);
  return true;
}
// Mon profil public, pour me placer dans le classement : null sans pseudo.
async function _moiClassement(u){
  const mp=_monPseudo(u); if(!mp) return null;
  const cle=pseudoPublicCle(mp);
  let prof=null; try{ prof=await _profilAmi(cle); }catch(e){ prof=null; }
  return {cle,p:mp,prenom:(prof&&prof.prenom)||String(u.fname||'Moi'),prof:prof||{sem:null}};
}
function ouvrirAmis(){
  fermerDuelFeuille();
  go('s-client-amis');
  renderEcranAmis();
  return true;
}
async function renderEcranAmis(){
  const z=document.getElementById('am-corps');
  const u=currentUser;
  if(!z||!u) return false;
  const mp=_monPseudo(u);
  z.innerHTML='<form class="am-cherche" onsubmit="event.preventDefault();amiLancerRecherche()">'
      +'<input id="am-q" type="search" inputmode="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Son pseudo, ex. marc.fit" aria-label="Pseudo à chercher">'
      +'<button type="submit" class="btn btn-red btn-sm btn-casse">Chercher</button></form>'
    +'<div id="am-res"></div>'
    +(mp?'<p class="am-note">Tes potes te trouvent sous <b>@'+escapeHtml(mp)+'</b>.</p>'
        :'<p class="am-note">Choisis ton nom pour que tes potes te trouvent : <a href="#" onclick="amisVersPseudo();return false">Mon profil</a>. Tu peux suivre sans être trouvable.</p>')
    +'<div id="am-recues"></div>'
    +'<div class="am-lab">La semaine</div><div id="am-classement"></div>'
    +'<div class="am-lab">Ceux que tu suis</div><div id="am-liste"></div>';
  _rendreListeEcranAmis(amisListe());
  try{ await amisSynchroniser(true); }catch(e){}
  const [l,moi]=await Promise.all([_amisAvecProfils(),_moiClassement(u)]);
  _rendreListeEcranAmis(l,moi);
  // Ce que mes amis ont dit de ma dernière séance : une lecture.
  if(moi&&moi.prof&&moi.prof.der){
    const r=await _fbJson('reactions/'+moi.cle+'/'+moi.prof.der);
    const pr={}; for(const x of l) pr[x.cle]=x.prenom;
    const zr=document.getElementById('am-recues');
    if(zr&&r.ok) zr.innerHTML=htmlReactionsRecues(r.v,pr);
  }
  return true;
}
function _rendreListeEcranAmis(l,moi){
  const z=document.getElementById('am-liste'); if(!z) return;
  if(!l.length){ z.innerHTML='<p class="am-vide">Personne pour l’instant : cherche un pseudo ci-dessus, ou envoie ton lien.</p>'; return; }
  const o=amisLocal(), t=Date.now(), loc=reactionsLocales();
  const mk=String((currentUser&&currentUser.email)||'').replace(/\./g,',');
  const cl=document.getElementById('am-classement');
  if(cl) cl.innerHTML=htmlClassementSemaine(l,t,o,moi||null);
  z.innerHTML=amisTries(l,t).map(x=>{
    const bd=texteBilanDuels(bilanDuelsContre(_duelsCache,x.cle,mk));
    return '<div class="am-ligne-w">'+htmlLigneAmi(x,t,o)
      +(bd?'<p class="am-duels">'+escapeHtml(bd)+'</p>':'')
      +htmlReactionsAmi(x,t,loc)
      +'<button type="button" class="am-retirer" onclick="amiRetirer(\''+escapeHtml(x.p)+'\')">Ne plus suivre</button></div>';
  }).join('');
}
// PURE. Les réactions reçues sur ma dernière séance : « 🔥 Léa · 💪 Max ».
function htmlReactionsRecues(r,prenoms){
  const k=Object.keys(r||{}).filter(x=>REACTIONS_AMIS.indexOf(r[x])>=0);
  if(!k.length) return '';
  return '<div class="am-recues"><span class="am-lab">Sur ta dernière séance</span><p>'
    +k.slice(0,12).map(x=>escapeHtml(r[x])+' '+escapeHtml((prenoms&&prenoms[x])||x.replace(/__/g,'.'))).join(' · ')+'</p></div>';
}
async function amiLancerRecherche(){
  const q=document.getElementById('am-q'), z=document.getElementById('am-res');
  if(!q||!z) return false;
  z.innerHTML='<p class="am-note">Recherche…</p>';
  const r=await amiChercher(q.value);
  const o=amisLocal();
  z.innerHTML=htmlFicheAmi(r,!!(r.trouve&&o.amis[pseudoPublicCle(r.pseudo)]));
  return r.trouve;
}
// « Suivre » devient « Suivi », sans rechargement (et l'inverse).
async function amiBasculerSuivi(b){
  if(!b) return false;
  const p=b.dataset.p, n=b.dataset.n;
  const suivi=!!amisLocal().amis[pseudoPublicCle(p)];
  const ok=suivi?await amiRetirer(p):await amiSuivre(p,n);
  if(ok){ const s=!suivi; b.textContent=s?'Suivi ✓':'Suivre'; b.classList.toggle('btn-red',!s); b.classList.toggle('btn-outline',s); }
  return ok;
}
function _rendreAmisPartout(){
  try{ renderAmisAccueil(); }catch(e){}
  try{ if(document.getElementById('s-client-amis')?.classList.contains('active')) _rendreListeEcranAmis(amisListe()); }catch(e){}
}
function amisVersPseudo(){
  try{ openAthleteProfile(); }catch(e){ go('s-athlete-profile'); }
  setTimeout(()=>{ try{ document.getElementById('atp-page')?.scrollIntoView({block:'start',behavior:'smooth'}); }catch(e){} },300);
  return true;
}
// SYNCHRONE jusqu'à navigator.share (iOS).
function amiEnvoyerLien(btn){
  const l=lienPerso('amis');
  if(!l) return false;
  const pr=String((currentUser&&currentUser.fname)||'').trim();
  const txt=(pr?pr+' t’invite':'Je t’invite')+' sur RepCore : on se suit et on se défie ⚡';
  if(navigator.share){ navigator.share({title:'RepCore',text:txt,url:l}).then(()=>{ try{ attribCompter('partage','amis'); }catch(e){} }).catch(()=>{}); return true; }
  try{ navigator.clipboard.writeText(txt+' '+l).then(()=>{ toast('Lien copié','var(--green)'); if(btn) btn.textContent='Lien copié ✓'; },()=>toast(l)); }catch(e){ toast(l); }
  return true;
}
// « Défier » : la feuille de duel existante, préparée pour cet ami.
function amiDefier(pseudo){
  const p=amiPseudoNormalise(pseudo), e=amisLocal().amis[pseudoPublicCle(p)];
  return ouvrirCreationDuel({p,prenom:(e&&e.prenom)||p});
}
// Après un duel : son pseudo, s'il l'a posé (createurPseudo / invitePseudo).
function duelAdversairePseudo(d,moi){
  if(!d) return '';
  const p=d.createur===moi?d.invitePseudo:d.createurPseudo;
  return PSEUDO_PUBLIC_RE.test(p||'')?p:'';
}
// ══ LA REVANCHE (lot B, 29/09/2026) : défier un ami SANS lien ══════════════
// Un duel né « accepte », l'ami nommé par son pseudo. Les règles l'acceptent
// si et seulement si cet ami me suit déjà ; le Worker (événement duel_cree)
// y pose sa clé, le range dans ses duels reçus et le prévient. Rien à
// accepter : sa première séance lance le compte.
const DUELS_MAX_EN_COURS=10, DUELS_MAX_MEME_AMI=3;
function _duelsEnCours(cache){
  const c=cache||_duelsCache;
  return Object.keys(c).map(id=>Object.assign({id},c[id])).filter(d=>d&&['attente','accepte','en_cours'].indexOf(d.statut)>=0);
}
// PURE. Les garde-fous, dits en une phrase ; '' quand on peut lancer.
function duelsGardeFou(enCours,cleAmi,prenom){
  const l=enCours||[];
  if(l.length>=DUELS_MAX_EN_COURS) return 'Tu as déjà '+DUELS_MAX_EN_COURS+' duels en cours : termine-en un avant d’en lancer un autre.';
  const n=l.filter(d=>d.invitePseudo===cleAmi||d.createurPseudo===cleAmi).length;
  if(cleAmi&&n>=DUELS_MAX_MEME_AMI) return 'Vous avez déjà '+DUELS_MAX_MEME_AMI+' duels en cours'+(prenom?' avec '+prenom:' ensemble')+' : attends la fin de l’un d’eux.';
  return '';
}
// PURE. Ce que « Revanche » reprend du duel précédent : la mesure et la durée.
function revancheParams(d){
  const m=d&&DUEL_MESURES.some(x=>x.cle===d.mesure)?d.mesure:'seances';
  const j=d&&DUEL_DUREES.indexOf(Number(d.duree))>=0?Number(d.duree):14;
  return {mesure:m,duree:j};
}
// PURE. Le dernier duel terminé contre cet ami (sa clé-pseudo), ou null.
function dernierDuelContre(cache,cleAmi){
  const l=Object.keys(cache||{}).map(id=>Object.assign({id},cache[id]))
    .filter(d=>d&&d.statut==='termine'&&(d.invitePseudo===cleAmi||d.createurPseudo===cleAmi))
    .sort((a,b)=>(Number(b.termineLe)||0)-(Number(a.termineLe)||0));
  return l[0]||null;
}
async function creerDuelAvecAmi(pseudo,mesure,duree){
  const u=currentUser;
  if(!u||u.role==='coach') return {ok:false,erreur:'Réservé aux athlètes.'};
  if(!CLOUD.ok()) return {ok:false,erreur:'Impossible hors connexion : réessaie une fois connecté.'};
  const p=amiPseudoNormalise(pseudo), cle=pseudoPublicCle(p);
  const e=amisLocal().amis[cle], prenom=(e&&e.prenom)||p;
  const mp=_monPseudo(u);
  if(!mp) return {ok:false,lien:true,erreur:'Pour défier '+prenom+' sans lien, choisis d’abord ton nom dans Mon profil. En attendant, envoie-lui le lien du duel.'};
  const garde=duelsGardeFou(_duelsEnCours(),cle,prenom);
  if(garde) return {ok:false,erreur:garde};
  const r=revancheParams({mesure,duree});
  const id=duelNouvelId(), moi=_moiCle();
  const nom=String(u.fname||u.pseudo||'').trim().slice(0,24)||'Un ami';
  const duel={createur:moi,createurNom:nom,mesure:r.mesure,duree:r.duree,creeLe:Date.now(),statut:'accepte',
    createurPseudo:pseudoPublicCle(mp),invitePseudo:cle};
  const ok=await CLOUD.racinePatch({['duels/'+id]:duel,['duels_publics/'+id]:{prenom:nom,mesure:r.mesure,duree:r.duree}}).catch(()=>false);
  if(!ok) return {ok:false,lien:true,erreur:prenom+' ne te suit pas encore : un duel direct demande qu’il te suive. Envoie-lui le lien du duel à la place.'};
  u.duels=Object.assign({},u.duels||{},{[id]:{role:'createur',le:Date.now()}});
  try{ saveUser(); }catch(e){}
  _duelsCache[id]=duel;
  deposerEvenement({type:'duel_cree',id}).catch(()=>{});
  return {ok:true,id,prenom};
}
// Un seul geste : la mesure et la durée du duel précédent, aucun écran.
async function amiRevanche(pseudo,mesure,duree,btn){
  if(btn) btn.disabled=true;
  const r=await creerDuelAvecAmi(pseudo,mesure,duree);
  if(btn) btn.disabled=false;
  if(!r.ok){
    toast(r.erreur,'var(--orange)',5000);
    if(r.lien){ const p=amiPseudoNormalise(pseudo), e=amisLocal().amis[pseudoPublicCle(p)]; ouvrirCreationDuel({p,prenom:(e&&e.prenom)||p}); }
    return false;
  }
  fermerDuelFeuille();
  toast('Revanche lancée contre '+r.prenom+' ⚡ Sa prochaine séance lance le compte.','var(--green)',4500);
  _rendreDuelsAccueil(); _rendreAmisPartout();
  return true;
}
// Les revanches reçues (/duels_recus, rangées par le Worker) rejoignent mes duels.
async function duelsRecusRattacher(u){
  if(!u||u.role==='coach'||!CLOUD.ok()) return 0;
  const r=await _fbJson('duels_recus/'+_moiCle());
  if(!r.ok||!r.v||typeof r.v!=='object') return 0;
  let n=0;
  const x=Object.assign({},u.duels||{});
  for(const id of Object.keys(r.v)) if(DUEL_ID_RE.test(id)&&!x[id]){ x[id]={role:'invite',le:Number(r.v[id].le)||Date.now()}; n++; }
  if(n){ u.duels=x; try{ saveUser(); }catch(e){} }
  return n;
}
async function _rendreDuelsAccueil(){
  const z=document.getElementById('clh-duels');
  const u=currentUser;
  if(!z) return false;
  if(!u||u.role==='coach'||!SERVEUR_LEGER){ z.innerHTML=''; return false; }
  const inv=duelInviteEnAttente();
  let invite=null;
  if(inv&&!(u.duels&&u.duels[inv.id])){
    invite=inv.prenom?inv:null;
    if(!invite){ const p=await _duelPublic(inv.id); if(p) invite=Object.assign({id:inv.id},p); }
  }
  // Une lecture par duel en cours, toutes les 10 minutes au plus.
  if(CLOUD.ok()&&Date.now()-_duelsLusLe>10*60e3){
    _duelsLusLe=Date.now();
    try{ await duelsRecusRattacher(u); }catch(e){}
    for(const id of _mesDuels(u).slice(-6)){
      if(u.duels[id].fini&&_duelsCache[id]) continue;
      try{ const d=await _duelLire(id); if(d) _duelsCache[id]=d; }catch(e){}
    }
  }
  _duelsInvite=invite;
  z.innerHTML=htmlDuelsAccueil(u,_duelsCache,invite,Date.now());
  return true;
}
// ── Créer un duel : la feuille ─────────────────────────────────────────────
let _duelCible=null;
function ouvrirCreationDuel(cible){
  if(!currentUser) return false;
  // L'AMI VISÉ (carnet, « Défier ») : la feuille ne change pas d'apparence,
  // elle prépare seulement l'envoi.
  _duelCible=(cible&&typeof cible==='object'&&PSEUDO_PUBLIC_RE.test(cible.p||''))?{p:cible.p,prenom:String(cible.prenom||cible.p).slice(0,24)}:null;
  document.getElementById('duel-feuille')?.remove();
  const d=document.createElement('div');
  d.id='duel-feuille';
  d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true'); d.setAttribute('aria-label','Défie un pote');
  d.className='du-fond';
  // LA FEUILLE À LA MAQUETTE (Kevin, 28/09/2026) : titre rouge et blanc,
  // l'écusson aux haches, une icône et un bouton radio par mesure, le bouton
  // de lancement avec ses haches et son chevron, une croix pour fermer.
  d.innerHTML='<div class="du-carte du-v2">'
    +'<button type="button" class="du-x" aria-label="Fermer" onclick="fermerDuelFeuille()">'+icon('x',18)+'</button>'
    +'<div class="du-ecu">'+DUEL_ECUSSON+'</div>'
    +'<div class="du-titre"><span>Défie</span> un pote</div>'
    +'<p class="du-sous">Le duel commence à sa première séance.<br>Le gagnant décroche le badge <b>CHAMPION</b>.</p>'
    +'<div class="du-lab">Sur quoi ?</div>'
    +'<div class="du-choix" role="radiogroup">'+DUEL_MESURES.map((m,i)=>'<button type="button" role="radio" aria-checked="'+(i===0)+'" class="du-c'+(i===0?' actif':'')+'" data-mesure="'+m.cle+'" onclick="_duelChoix(this)">'
      +'<span class="du-c-ico" aria-hidden="true">'+icon(m.ico,26)+'</span>'
      +'<span class="du-c-t">'+m.lib+'<small>'+m.detail+'</small></span><span class="du-radio" aria-hidden="true"></span></button>').join('')+'</div>'
    +'<div class="du-lab">Combien de temps ?</div>'
    +'<div class="du-choix du-duree" role="radiogroup">'+[7,14,28].map(j=>'<button type="button" role="radio" aria-checked="'+(j===14)+'" class="du-c'+(j===14?' actif':'')+'" data-duree="'+j+'" onclick="_duelChoix(this)">'+j+' jours</button>').join('')+'</div>'
    +'<button type="button" class="btn btn-red du-go du-lancer" onclick="lancerDuel(this)">'
      +'<span class="du-l-ico" aria-hidden="true">'+icon('haches',26)+'</span><span class="du-l-t">Lancer le duel</span>'
      +'<span class="du-l-ch" aria-hidden="true">'+icon('chevron-right',22)+'</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm du-go du-annuler" onclick="fermerDuelFeuille()">Annuler</button>'
    +'</div>';
  d.addEventListener('click',e=>{ if(e.target===d) fermerDuelFeuille(); });
  document.body.appendChild(d);
  return true;
}
function _duelChoix(b){
  const g=b.parentNode;
  g.querySelectorAll('.du-c').forEach(x=>{ x.classList.toggle('actif',x===b); x.setAttribute('aria-checked',String(x===b)); });
  return true;
}
function fermerDuelFeuille(){ document.getElementById('duel-feuille')?.remove(); return true; }
async function lancerDuel(btn){
  const f=document.getElementById('duel-feuille');
  const m=(f&&f.querySelector('[data-mesure].actif'))?f.querySelector('[data-mesure].actif').dataset.mesure:'seances';
  const j=(f&&f.querySelector('[data-duree].actif'))?Number(f.querySelector('[data-duree].actif').dataset.duree):14;
  const lib=btn&&(btn.querySelector('.du-l-t')||btn);
  if(btn){ btn.disabled=true; lib.textContent='Création…'; }
  // L'AMI VISÉ : le duel part directement, sans lien ni feuille de partage.
  if(_duelCible){
    const ra=await creerDuelAvecAmi(_duelCible.p,m,j);
    if(ra.ok){
      if(f) f.querySelector('.du-carte').innerHTML='<div class="du-titre">Défi lancé contre '+escapeHtml(ra.prenom)+' ⚡</div>'
        +'<p class="du-sous">'+escapeHtml(texteDuel(m,j))+'. Il n’a rien à accepter : sa prochaine séance lance le compte.</p>'
        +'<button type="button" class="btn btn-outline btn-sm du-go" onclick="fermerDuelFeuille();_rendreDuelsAccueil()">Fermer</button>';
      _rendreDuelsAccueil();
      return true;
    }
    toast(ra.erreur,'var(--orange)',5000);
    if(!ra.lien){ if(btn){ btn.disabled=false; lib.textContent='Lancer le duel'; } return false; }
  }
  const r=await creerDuel(m,j);
  if(!r.ok){ if(btn){ btn.disabled=false; lib.textContent='Lancer le duel'; } toast(r.erreur,'var(--orange)'); return false; }
  // L'ENVOI EST UN NOUVEAU TOUCHER : la création a pris du temps réseau, et
  // iOS refuserait la feuille de partage ouverte hors du geste.
  if(f) f.querySelector('.du-carte').innerHTML='<div class="du-titre">Ton duel est prêt ⚡</div>'
    +'<p class="du-sous">'+escapeHtml(texteDuel(m,j))+'. Envoie-le à ton pote : il commence à sa première séance.</p>'
    +'<button type="button" class="btn btn-red du-go" onclick="envoyerDuel(\''+r.id+'\',this)">'+icon('share',16)+' <span>Envoyer le défi</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse du-go" onclick="partagerCarteDuel(\''+r.id+'\',\'lancement\',this)">Partager la carte DUEL</button>'
    +'<button type="button" class="btn btn-outline btn-sm du-go" onclick="fermerDuelFeuille();_rendreDuelsAccueil()">Fermer</button>';
  _rendreDuelsAccueil();
  return true;
}
// SYNCHRONE jusqu'à navigator.share (iOS).
function envoyerDuel(id,btn){
  const u=currentUser, d=_duelsCache[id];
  const l=lienDuel(id,u);
  if(!l) return false;
  const pr=String((u&&u.fname)||'').trim();
  const txt=(_duelCible?_duelCible.prenom+', ':'')+(pr?pr+' te défie':'Je te défie')+' sur RepCore : '+texteDuel(d&&d.mesure,d&&d.duree)+'. Tu relèves ?';
  try{ parcoursInvitation(); }catch(e){}
  if(navigator.share){
    navigator.share({title:'Duel RepCore',text:txt,url:l}).then(()=>{ try{ attribCompter('partage','duel'); }catch(e){} }).catch(()=>{});
    return true;
  }
  try{ navigator.clipboard.writeText(txt+' '+l).then(()=>toast('Lien du duel copié','var(--green)'),()=>toast(l)); }catch(e){ toast(l); }
  return true;
}
// ── L'écran d'un duel ─────────────────────────────────────────────────────
async function ouvrirDuel(id){
  document.getElementById('duel-feuille')?.remove();
  let d=_duelsCache[id];
  try{ const x=await _duelLire(id); if(x){ d=x; _duelsCache[id]=x; } }catch(e){}
  if(!d) return false;
  const moi=_moiCle();
  const f=document.createElement('div');
  f.id='duel-feuille'; f.className='du-fond';
  f.setAttribute('role','dialog'); f.setAttribute('aria-modal','true'); f.setAttribute('aria-label','Duel');
  const fini=d.statut==='termine';
  f.innerHTML='<div class="du-carte"><div class="du-titre">DUEL · '+escapeHtml(texteDuel(d.mesure,d.duree))+'</div>'
    +'<p class="du-sous">'+escapeHtml(duelLigne(d,moi,Date.now()))+'</p>'
    +(d.statut==='attente'?'<button type="button" class="btn btn-red du-go" onclick="envoyerDuel(\''+id+'\',this)">'+icon('share',16)+' <span>Renvoyer le défi</span></button>':'')
    +(()=>{ const ap=fini?duelAdversairePseudo(d,moi):'', dk=ap?pseudoPublicCle(ap):'';
      if(!ap||amisLocal().amis[dk]) return '';
      const nom=escapeHtml(d.createur===moi?(d.inviteNom||ap):(d.createurNom||ap));
      return '<button type="button" class="btn btn-outline btn-sm btn-casse du-go" onclick="amiSuivre(\''+escapeHtml(amiPseudoDeCle(ap))+'\',\''+nom+'\');this.remove()">Ajouter '+nom+' à mes amis</button>'; })()
    // LA REVANCHE : un geste, la mesure et la durée de ce duel ; « Changer »,
    // discret, rouvre la feuille pour cet ami.
    +(()=>{ const ap=fini?duelAdversairePseudo(d,moi):''; if(!ap) return '';
      const p=escapeHtml(amiPseudoDeCle(ap)), rp=revancheParams(d), nom=escapeHtml(d.createur===moi?(d.inviteNom||ap):(d.createurNom||ap));
      return '<button type="button" class="btn btn-red du-go" onclick="amiRevanche(\''+p+'\',\''+rp.mesure+'\','+rp.duree+',this)">Revanche</button>'
        +'<button type="button" class="du-changer" onclick="fermerDuelFeuille();ouvrirCreationDuel({p:\''+p+'\',prenom:\''+nom+'\'})">Changer la mesure ou la durée</button>'; })()
    +'<button type="button" class="btn '+(fini?'btn-red':'btn-outline btn-sm btn-casse')+' du-go" onclick="partagerCarteDuel(\''+id+'\',\''+(fini?'resultat':'lancement')+'\',this)">'
      +icon('share',14)+' <span>'+(fini?'Partager le résultat':'Partager la carte DUEL')+'</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm du-go" onclick="fermerDuelFeuille()">Fermer</button></div>';
  f.addEventListener('click',e=>{ if(e.target===f) fermerDuelFeuille(); });
  document.body.appendChild(f);
  return true;
}
// ── Les cartes DUEL : lancement et résultat ───────────────────────────────
// Même épure que les autres visuels (fond au choix, éclair en filigrane,
// signature). Jamais une charge : la valeur montrée est celle du duel.
function duelCarteDonnees(d,type,u){
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  const x=d||{};
  const moi=String((u&&u.email)||'').replace(/\./g,',');
  const s=x.scores||{};
  return {type:type==='resultat'?'resultat':'lancement',a:String(x.createurNom||'').toUpperCase(),b:String(x.inviteNom||'').toUpperCase(),
    texte:texteDuel(x.mesure,x.duree).toUpperCase(),mesure:x.mesure,sa:Number(s.createur)||0,sb:Number(s.invite)||0,
    gagnant:x.gagnant||null,moiCreateur:x.createur===moi,signature:sig};
}
function _dessinerCarteDuel(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const x=d||{};
  const rouge=f==='rouge';
  const acc=rouge?'#fff':'#E02020';
  g.textAlign='center'; g.textBaseline='alphabetic';
  // En story, le bloc est centré dans la hauteur (il fait ~1 000 px).
  let y=post?150:(x.type==='resultat'?500:560);
  o.ombre(true);
  g.fillStyle='#fff'; g.font='800 34px '+MONT;
  o.ecrireEspace(x.type==='resultat'?'RÉSULTAT DU DUEL':'DUEL LANCÉ',cx,y,10,true);
  o.ombre(false); g.fillStyle=acc; g.fillRect(cx-44,y+20,88,5);
  // « DUEL » en très gros, l'éclair derrière.
  y+=post?260:330;
  _recEclairFiligrane(g,cx+220,y-300,cx-180,y+40,_recGraine('duel|'+x.a+'|'+x.b),f);
  o.ombre(true); g.fillStyle='#fff';
  const ds=o.ajuste('DUEL','700',post?300:360,BEBAS,LARG,160);
  g.font='700 '+ds+'px '+BEBAS; o.ecrire('DUEL',cx,y);
  // Les deux noms, face à face.
  y+=post?120:160;
  const b=x.b||'?';
  const noms=(x.a||'MOI')+'  ⚡  '+b;
  const ns=o.ajuste(noms,'700',post?96:120,BEBAS,LARG,44);
  g.font='700 '+ns+'px '+BEBAS; o.ecrire(o.coupe(noms,LARG),cx,y);
  y+=post?80:110;
  g.fillStyle=acc;
  const ts=o.ajusteEspace(String(x.texte||''),'800',44,MONT,6,LARG,24);
  g.font='800 '+ts+'px '+MONT; o.ecrireEspace(o.coupeEspace(String(x.texte||''),6,LARG),cx,y,6,true);
  if(x.type==='resultat'){
    y+=post?150:220;
    g.fillStyle='#fff';
    const sc=texteScoreDuel(x.mesure,x.sa)+'  —  '+texteScoreDuel(x.mesure,x.sb);
    const ss=o.ajuste(sc,'700',post?120:150,BEBAS,LARG,50);
    g.font='700 '+ss+'px '+BEBAS; o.ecrire(o.coupe(sc,LARG),cx,y);
    y+=post?90:120;
    const vainq=x.gagnant==='egalite'?'ÉGALITÉ':('VAINQUEUR : '+(x.gagnant==='invite'?b:(x.a||'MOI')));
    g.fillStyle=acc;
    const vs=o.ajusteEspace(vainq,'800',54,MONT,8,LARG,26);
    g.font='800 '+vs+'px '+MONT; o.ecrireEspace(o.coupeEspace(vainq,8,LARG),cx,y,8,true);
  } else {
    y+=post?110:160;
    g.fillStyle='rgba(255,255,255,.88)';
    const l=x.b?'Que le meilleur gagne.':'Tu relèves le défi ?';
    g.font='700 44px '+MONT; o.ecrire(l,cx,y);
  }
  _recSignature(g,o,String(x.signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
// SYNCHRONE jusqu'au partage (iOS). La story copie le lien du duel s'il est
// en attente (le sticker Lien l'ouvre), sinon le lien perso.
function partagerCarteDuel(id,type,btn){
  const u=currentUser, d=_duelsCache[id];
  if(!u||!d||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-duel',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    const des=()=>_dessinerCarteDuel(duelCarteDonnees(d,type,u),fond);
    ok=_storySortirPartage(des(),nom,undefined,fmt)||_storySortirTelechargement(des(),nom,fmt);
    if(d.statut==='attente'){
      const l=lienDuel(id,u);
      if(l&&navigator.clipboard) navigator.clipboard.writeText(l).catch(()=>{});
    }
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; sp.textContent='Carte prête ✓'; setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}

// ══ LE DÉFI REPCORE DU MOIS (28/09/2026) ═════════════════════════════════
// Un défi pour tous, créé par Kevin (écran admin), montré aux AUTONOMES
// (sans coach : ceux qui ont un coach ont les défis de leur Canal). Pas de
// classement : la jauge perso, calculée comme un défi du Canal.
const DEFI_MOIS_CACHE='rc_defi_mois';
/** PURE. 'AAAA-MM' d'un instant (heure de l'appareil). */
function defiMoisCle(maintenant){
  const d=new Date((typeof maintenant==='number')?maintenant:Date.now());
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
/** PURE. Autonome : un athlète sans coach. */
function estAutonome(u){ return !!(u&&u.role==='athlete'&&!u.coachId&&!u.coachEmailKey); }
async function _defiMoisLire(mois){
  try{
    const c=JSON.parse(localStorage.getItem(DEFI_MOIS_CACHE)||'null');
    if(c&&c.mois===mois&&Date.now()-c.t<6*3600e3) return c.d;
  }catch(e){}
  const token=await CLOUD._getToken();
  if(!token) return null;
  const r=await fetch(CLOUD._fbUrl.replace('users.json','defi_mois/'+mois+'.json')+'?auth='+token).catch(()=>null);
  const d=(r&&r.ok)?await r.json():null;
  try{ localStorage.setItem(DEFI_MOIS_CACHE,JSON.stringify({mois,t:Date.now(),d})); }catch(e){}
  return d;
}
// PURE.
function htmlDefiMois(d,u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!d||!d.titre||!estAutonome(u)||t<Number(d.debut)||t>Number(d.fin)) return '';
  const v=defiValeur(u,{mesure:d.mesure,debut:Number(d.debut),fin:Number(d.fin)});
  const obj=Number(d.objectif)||1;
  const part=Math.max(0,Math.min(1,v/obj));
  const j=Math.max(0,Math.ceil((Number(d.fin)-t)/864e5));
  const fait=v>=obj;
  return '<div class="dm-carte'+(fait?' dm-fait':'')+'"><div class="dm-sur">DÉFI REPCORE DU MOIS</div>'
    +'<div class="dm-titre">'+escapeHtml(d.titre)+'</div>'
    +(d.texte?'<p class="dm-texte">'+escapeHtml(d.texte)+'</p>':'')
    +'<div class="rg-jauge dm-jauge" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(part*100)+'"><span style="width:'+Math.round(part*100)+'%"></span></div>'
    +'<div class="dm-etat">'+(fait?'Relevé ⚡ ':'')+escapeHtml(texteScoreDuel(d.mesure,v))+' sur '+escapeHtml(texteScoreDuel(d.mesure,obj))
      +(fait?'':' · '+(j?j+' jour'+(j>1?'s':'')+' restant'+(j>1?'s':''):'dernier jour'))+'</div></div>';
}
async function renderDefiMoisAccueil(){
  const z=document.getElementById('clh-defi-mois');
  const u=currentUser;
  if(!z) return false;
  if(!estAutonome(u)||!CLOUD.ok()){ z.innerHTML=''; return false; }
  let d=null; try{ d=await _defiMoisLire(defiMoisCle()); }catch(e){ d=null; }
  z.innerHTML=htmlDefiMois(d,u,Date.now());
  return !!z.innerHTML;
}
// ── L'écran admin : créer le défi du mois ─────────────────────────────────
// PURE. Le défi à écrire, ou {erreur}.
function defiMoisFiche(f,maintenant){
  const titre=String(f&&f.titre||'').replace(/\s+/g,' ').trim().slice(0,80);
  if(titre.length<3) return {erreur:'Donne un titre (3 caractères au moins).'};
  const mesure=['seances','tonnage','serie','progressionPct'].indexOf(f.mesure)>=0?f.mesure:null;
  if(!mesure) return {erreur:'Choisis une mesure.'};
  const objectif=Number(String(f.objectif||'').replace(',','.'));
  if(!(objectif>0&&objectif<1e8)) return {erreur:'L’objectif doit être un nombre positif.'};
  const m=/^(\d{4})-(\d{2})$/.exec(String(f.mois||''));
  if(!m) return {erreur:'Mois : AAAA-MM.'};
  const debut=new Date(+m[1],+m[2]-1,1,0,0,0).getTime(), fin=new Date(+m[1],+m[2],1,0,0,0).getTime()-1;
  const o={titre,mesure,objectif,debut,fin};
  const texte=String(f.texte||'').trim().slice(0,300);
  if(texte) o.texte=texte;
  return {mois:m[1]+'-'+m[2],fiche:o};
}
function htmlDefiMoisAdmin(maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const cur=defiMoisCle(t), d=new Date(t); d.setMonth(d.getMonth()+1,1);
  const suiv=defiMoisCle(d.getTime());
  return '<div class="card amb-journal" id="dm-admin"><div class="amb-t">Défi RepCore du mois</div>'
    +'<p class="sub amb-note">Pour tous les athlètes sans coach : il s’affiche sur leur accueil, avec leur jauge.</p>'
    +'<label class="pp-lab" for="dm-mois">Mois</label><select id="dm-mois"><option value="'+cur+'">'+cur+'</option><option value="'+suiv+'">'+suiv+'</option></select>'
    +'<label class="pp-lab" for="dm-titre">Titre</label><input id="dm-titre" type="text" maxlength="80" placeholder="12 séances en octobre">'
    +'<label class="pp-lab" for="dm-texte">Texte (facultatif)</label><input id="dm-texte" type="text" maxlength="300">'
    +'<label class="pp-lab" for="dm-mesure">Mesure</label><select id="dm-mesure"><option value="seances">Séances</option><option value="serie">Semaines validées</option><option value="tonnage">Tonnage (kg)</option><option value="progressionPct">Progression (%)</option></select>'
    +'<label class="pp-lab" for="dm-obj">Objectif</label><input id="dm-obj" type="number" min="1" inputmode="decimal" placeholder="12">'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:10px 0 0;min-height:44px" onclick="enregistrerDefiMois(this)">Publier le défi</button></div>';
}
async function enregistrerDefiMois(btn){
  if(!estAdminAmbassadeurs()) return false;
  const v=id=>(document.getElementById(id)||{}).value;
  const r=defiMoisFiche({mois:v('dm-mois'),titre:v('dm-titre'),texte:v('dm-texte'),mesure:v('dm-mesure'),objectif:v('dm-obj')});
  if(r.erreur){ toast(r.erreur,'var(--orange)'); return false; }
  if(btn) btn.disabled=true;
  const ok=await CLOUD.racinePatch({['defi_mois/'+r.mois]:r.fiche}).catch(()=>false);
  if(btn) btn.disabled=false;
  try{ localStorage.removeItem(DEFI_MOIS_CACHE); }catch(e){}
  toast(ok?'Défi de '+r.mois+' publié ⚡':'Publication refusée','var('+(ok?'--green':'--orange')+')');
  return ok;
}
// ══ LES ÉVÉNEMENTS SAISONNIERS (28/09/2026) ══════════════════════════════
//
// Une édition limitée : un nom, des dates, une mesure, un objectif perso et
// un objectif collectif, une couleur. Créée par Kevin (écran admin, dans
// /saisons — « /evenements » est la file du serveur léger). Pendant qu'elle
// dure :
//   · une BANNIÈRE sur l'accueil : compte à rebours, jauge perso, compteur
//     collectif (/stats/saisons/<id>, recalculé chaque heure par le Worker) ;
//   · un fond « Édition » pour tous les visuels ;
//   · l'app écrit SA valeur après chaque séance (saisons_progres/<id>/<moi>,
//     la règle des défis du Canal) : le Worker en tire le collectif et le
//     badge de qui a bouclé (/saisons_resultats/<moi>/<id>) ;
//   · les push (lancement, mi-parcours, J-2, fin) partent du Worker.
// LA FAMILLE « ÉDITIONS » : un badge par édition bouclée, avec l'année. Une
// édition finie qu'on n'a pas bouclée reste visible : « Plus jamais
// disponible ».
const SAISONS_CACHE='rc_saisons';
const SAISON_ID_RE=/^[a-z0-9][a-z0-9-]{2,40}$/;
let _saisons=null;                      // {id: saison}, du cache ou de la base
function _saisonsDuCache(){
  if(_saisons) return _saisons;
  try{ const c=JSON.parse(localStorage.getItem(SAISONS_CACHE)||'null'); if(c&&c.l&&typeof c.l==='object') _saisons=c.l; }catch(e){}
  return _saisons||{};
}
async function chargerSaisons(force){
  try{
    const c=JSON.parse(localStorage.getItem(SAISONS_CACHE)||'null');
    if(!force&&c&&Date.now()-Number(c.t)<3600e3&&c.l){ _saisons=c.l; return _saisons; }
  }catch(e){}
  if(!CLOUD.ok()) return _saisonsDuCache();
  const token=await CLOUD._getToken();
  if(!token) return _saisonsDuCache();
  const r=await fetch(CLOUD._fbUrl.replace('users.json','saisons.json')+'?auth='+token).catch(()=>null);
  const l=(r&&r.ok)?((await r.json())||{}):null;
  if(l){ _saisons=l; try{ localStorage.setItem(SAISONS_CACHE,JSON.stringify({t:Date.now(),l})); }catch(e){} }
  return _saisonsDuCache();
}
/** PURE. Une saison exploitable. */
function saisonValide(s){
  return !!(s&&typeof s==='object'&&s.nom&&Number(s.debut)>0&&Number(s.fin)>Number(s.debut)
    &&['seances','tonnage','serie','progressionPct'].indexOf(s.mesure)>=0&&Number(s.objectifPerso)>0);
}
/** PURE (liste donnée). La saison en cours à t : {id, …} ou null (la première qui a commencé). */
function saisonActive(maintenant,liste){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const l=liste||_saisonsDuCache();
  const ids=Object.keys(l||{}).filter(id=>SAISON_ID_RE.test(id)&&saisonValide(l[id])&&t>=Number(l[id].debut)&&t<=Number(l[id].fin))
    .sort((a,b)=>Number(l[a].debut)-Number(l[b].debut));
  return ids.length?Object.assign({id:ids[0]},l[ids[0]]):null;
}
/** PURE. L'année d'une édition. */
function saisonAnnee(s){ return String(new Date(Number(s&&s.debut)||0).getFullYear()); }
/** PURE. La couleur d'accent, sûre. */
function saisonCouleur(s){ return /^#[0-9a-fA-F]{6}$/.test(String(s&&s.couleurAccent||''))?s.couleurAccent:'#E02020'; }
/** PURE. « J-12 », « 5 h », « 12 min » : le temps qui reste. */
function saisonReste(s,maintenant){
  const ms=Number(s&&s.fin)-((typeof maintenant==='number')?maintenant:Date.now());
  if(!(ms>0)) return 'terminé';
  const j=Math.floor(ms/864e5), h=Math.floor(ms%864e5/3600e3), m=Math.floor(ms%3600e3/60e3);
  if(j>=1) return 'J-'+j+(j<3?' · '+h+' h':'');
  if(h>=1) return h+' h '+String(m).padStart(2,'0');
  return m+' min';
}
function saisonValeur(u,s){ return defiValeur(u,{mesure:s.mesure,debut:Number(s.debut),fin:Number(s.fin)}); }
// ── Écrire sa valeur (après une séance, et à l'accueil) ───────────────────
async function saisonsPublierProgression(){
  const u=currentUser;
  if(!u||u.role==='coach'||!CLOUD.ok()) return 0;
  await chargerSaisons();
  const s=saisonActive();
  if(!s) return 0;
  const v=Math.max(0,Number(saisonValeur(u,s))||0);
  const deja=(u.saisonsVal&&u.saisonsVal[s.id]);
  if(deja===v) return 0;
  const token=await CLOUD._getToken();
  if(!token) return 0;
  const moi=String(u.email||'').replace(/\./g,',');
  const r=await fetch(CLOUD._fbUrl.replace('users.json','saisons_progres/'+s.id+'/'+moi+'.json')+'?auth='+token,
    {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({valeur:v,maj:Date.now()})}).catch(()=>null);
  if(!r||!r.ok) return 0;
  u.saisonsVal=Object.assign({},u.saisonsVal||{},{[s.id]:v});
  try{ saveUser(); }catch(e){}
  return 1;
}
// ── Le compteur collectif (/stats/saisons/<id>, lecture publique) ─────────
const _saisonStats={};
async function _saisonStatsLire(id){
  const c=_saisonStats[id];
  if(c&&Date.now()-c.t<10*60e3) return c.d;
  const r=await fetch(CLOUD._fbUrl.replace('users.json','stats/saisons/'+id+'.json')).catch(()=>null);
  const d=(r&&r.ok)?await r.json():null;
  _saisonStats[id]={t:Date.now(),d};
  return d;
}
// ── La bannière de l'accueil ──────────────────────────────────────────────
// PURE.
function htmlBanniereSaison(s,u,stats,maintenant){
  if(!s||!u||u.role==='coach') return '';
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const v=saisonValeur(u,s), obj=Number(s.objectifPerso)||1;
  const part=Math.max(0,Math.min(1,v/obj));
  const fait=v>=obj||!!(u.saisonsReleves&&u.saisonsReleves[s.id]);
  const col=Number(s.objectifCollectif)||0;
  const tot=Number(stats&&stats.total)||0;
  const pc=col>0?Math.max(0,Math.min(1,tot/col)):0;
  const txt=x=>texteScoreDuel(s.mesure,x);
  return '<div class="sa-banniere" style="--sa-accent:'+saisonCouleur(s)+'" role="region" aria-label="'+escapeHtml(s.nom)+'">'
    +'<div class="sa-tete"><span class="sa-edition">ÉDITION '+escapeHtml(saisonAnnee(s))+'</span>'
      +'<span class="sa-reste" data-fin="'+Number(s.fin)+'">'+escapeHtml(saisonReste(s,t))+'</span></div>'
    +'<div class="sa-nom">'+escapeHtml(s.nom)+'</div>'
    +(s.texteAccueil?'<p class="sa-texte">'+escapeHtml(s.texteAccueil)+'</p>':'')
    +'<div class="sa-lab">Toi</div>'
    +'<div class="rg-jauge sa-jauge" role="progressbar" aria-label="Ta progression" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(part*100)+'"><span style="width:'+Math.round(part*100)+'%"></span></div>'
    +'<div class="sa-val">'+(fait?'Bouclé ⚡ ':'')+escapeHtml(txt(v))+' sur '+escapeHtml(txt(obj))+'</div>'
    +(col>0?'<div class="sa-lab">Tous ensemble</div>'
      +'<div class="rg-jauge sa-jauge sa-collectif" role="progressbar" aria-label="Le compteur collectif" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pc*100)+'"><span style="width:'+Math.round(pc*100)+'%"></span></div>'
      +'<div class="sa-val">'+escapeHtml(txt(tot))+' sur '+escapeHtml(txt(col))
        +(stats&&stats.participants?' · '+stats.participants+' participant'+(stats.participants>1?'s':''):'')+'</div>':'')
    +(fait?'<button type="button" class="btn btn-sm sa-partager" onclick="partagerCarteSaison(\''+s.id+'\',this)">'+icon('share',14)+' <span>J’ai bouclé : partager ma carte</span></button>':'')
    +'</div>';
}
let _saisonMinuteur=null;
async function renderSaisonAccueil(){
  const z=document.getElementById('clh-saison');
  const u=currentUser;
  if(!z) return false;
  if(!u||u.role==='coach'){ z.innerHTML=''; return false; }
  try{ await chargerSaisons(); }catch(e){}
  const s=saisonActive();
  if(!s){ z.innerHTML=''; return false; }
  let st=null; try{ st=await _saisonStatsLire(s.id); }catch(e){ st=null; }
  z.innerHTML=htmlBanniereSaison(s,u,st,Date.now());
  // LE COMPTE À REBOURS avance tant que l'accueil est affiché.
  if(_saisonMinuteur) clearInterval(_saisonMinuteur);
  _saisonMinuteur=setInterval(()=>{
    const r=document.querySelector('#clh-saison .sa-reste');
    if(!r||!r.isConnected){ clearInterval(_saisonMinuteur); _saisonMinuteur=null; return; }
    r.textContent=saisonReste({fin:Number(r.dataset.fin)},Date.now());
  },60e3);
  saisonsPublierProgression().catch(()=>{});
  return true;
}
// ── La famille « Éditions » ──────────────────────────────────────────────
// PURE (écrit dans u). Les résultats du Worker (/saisons_resultats/<moi>).
function saisonsFusionnerResultats(u,r){
  if(!u||!r||typeof r!=='object') return 0;
  const m=(u.saisonsReleves&&typeof u.saisonsReleves==='object')?u.saisonsReleves:{};
  let n=0;
  for(const id of Object.keys(r)){
    const x=r[id]; if(!x||m[id]||!SAISON_ID_RE.test(id)) continue;
    m[id]={nom:String(x.nom||'').slice(0,60),annee:String(x.annee||'').slice(0,4),badgeCle:String(x.badgeCle||'').slice(0,40),
      couleur:/^#[0-9a-fA-F]{6}$/.test(String(x.couleur||''))?x.couleur:'#E02020',termineLe:Number(x.termineLe)||0,fin:Number(x.fin)||0};
    n++;
  }
  if(n) u.saisonsReleves=m;
  return n;
}
// PURE. Le médaillon d'une édition : un hexagone de sa couleur, l'année dedans.
function svgMedailleEdition(couleur,annee,obtenu){
  const c=/^#[0-9a-fA-F]{6}$/.test(String(couleur||''))?couleur:'#E02020';
  return '<svg class="ed-med" viewBox="0 0 100 100" aria-hidden="true">'
    +'<polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="'+(obtenu?'#111':'#1a1a1d')+'" stroke="'+(obtenu?c:'#3a3a40')+'" stroke-width="6"/>'
    +'<polygon points="50,18 79,34 79,66 50,82 21,66 21,34" fill="none" stroke="'+(obtenu?c:'#2a2a2e')+'" stroke-width="2" opacity=".7"/>'
    +'<text x="50" y="58" text-anchor="middle" font-family="Bebas Neue,Impact,sans-serif" font-size="26" fill="'+(obtenu?'#fff':'#6b6b72')+'">'+escapeHtml(String(annee||''))+'</text></svg>';
}
// PURE. La section « Éditions » de la collection.
function htmlEditions(u,liste,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const m=(u&&u.saisonsReleves)||{};
  const l=liste||{};
  const ids=[...new Set(Object.keys(l).filter(id=>saisonValide(l[id])&&t>=Number(l[id].debut)).concat(Object.keys(m)))];
  if(!ids.length) return '';
  const cases=ids.map(id=>{
    const s=l[id]||{}, r=m[id];
    const nom=(r&&r.nom)||s.nom||id, annee=(r&&r.annee)||saisonAnnee(s);
    const fin=Number(s.fin||(r&&r.fin))||0;
    let sous;
    if(r) sous=_bdgDate(r.termineLe);
    else if(fin&&t>fin) sous='Plus jamais disponible';
    else sous='En cours · '+saisonReste(s,t);
    return {fin,h:'<div class="bdg-case ed-case"'+(r?'':' data-attente')+(!r&&fin&&t>fin?' data-perdu':'')+'>'
      +svgMedailleEdition(r?r.couleur:saisonCouleur(s),annee,!!r)
      +'<div class="bdg-nom">'+escapeHtml(String(nom).toUpperCase()+' '+annee)+'</div>'
      +'<div class="bdg-date">'+escapeHtml(sous)+'</div></div>'};
  }).sort((a,b)=>b.fin-a.fin).map(x=>x.h).join('');
  return '<div class="bdg-sous">Éditions <span class="bdg-compte">'+Object.keys(m).length+'</span></div><div class="bdg-grille">'+cases+'</div>';
}
// ── La carte « J'ai bouclé <édition> » ────────────────────────────────────
function saisonCarteDonnees(id,u){
  const l=_saisonsDuCache(), s=l[id]||{}, r=(u&&u.saisonsReleves&&u.saisonsReleves[id])||null;
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  const obj=Number(s.objectifPerso)||0;
  return {nom:String((r&&r.nom)||s.nom||'').toUpperCase(),annee:(r&&r.annee)||saisonAnnee(s),couleur:(r&&r.couleur)||saisonCouleur(s),
    objectif:obj&&s.mesure?texteScoreDuel(s.mesure,obj).toUpperCase():'',date:r?r.termineLe:Date.now(),signature:sig};
}
function _dessinerCarteSaison(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const x=d||{};
  const acc=f==='rouge'?'#fff':(x.couleur||'#E02020');
  g.textAlign='center'; g.textBaseline='alphabetic';
  // En story, le bloc (~1 000 px) est centré dans la hauteur.
  let y=post?140:520;
  o.ombre(true); g.fillStyle='#fff'; g.font='800 34px '+MONT;
  o.ecrireEspace('J’AI BOUCLÉ',cx,y,10,true);
  o.ombre(false); g.fillStyle=acc; g.fillRect(cx-44,y+20,88,5);
  // LE MÉDAILLON : l'hexagone de l'édition, l'année dedans.
  const R=post?150:190, my=y+(post?60:90)+R;
  g.save();
  const hex=(r)=>{ g.beginPath(); for(let k=0;k<6;k++){ const a=-Math.PI/2+k*Math.PI/3; const px=cx+r*Math.cos(a), py=my+r*Math.sin(a); if(k) g.lineTo(px,py); else g.moveTo(px,py); } g.closePath(); };
  g.shadowColor=acc; g.shadowBlur=40;
  hex(R); g.fillStyle='#0d0d0f'; g.fill(); g.lineWidth=14; g.strokeStyle=acc; g.stroke();
  g.shadowBlur=0; hex(R*0.72); g.lineWidth=4; g.globalAlpha=.7; g.stroke();
  g.restore();
  o.ombre(true); g.fillStyle='#fff';
  g.font='700 '+Math.round(R*0.62)+'px '+BEBAS; o.ecrire(String(x.annee||''),cx,my+R*0.22);
  y=my+R+(post?110:150);
  const nom=String(x.nom||'');
  const ns=o.ajuste(nom,'700',post?120:150,BEBAS,LARG,54);
  g.font='700 '+ns+'px '+BEBAS; o.ecrire(o.coupe(nom,LARG),cx,y);
  y+=post?70:90;
  g.fillStyle=acc;
  const ed='ÉDITION '+(x.annee||'')+(x.objectif?' · '+x.objectif:'');
  const es=o.ajusteEspace(ed,'800',40,MONT,6,LARG,22);
  g.font='800 '+es+'px '+MONT; o.ecrireEspace(o.coupeEspace(ed,6,LARG),cx,y,6,true);
  y+=post?60:80;
  g.fillStyle='rgba(255,255,255,.8)'; g.font='700 30px '+MONT;
  o.ecrireEspace(_recDate(x.date),cx,y,4,true);
  _recSignature(g,o,String(x.signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
// SYNCHRONE jusqu'au partage (iOS).
function partagerCarteSaison(id,btn){
  const u=currentUser;
  if(!u||_storyEnCours||!SAISON_ID_RE.test(String(id||''))) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-saison',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    const des=()=>_dessinerCarteSaison(saisonCarteDonnees(id,u),fond);
    ok=_storySortirPartage(des(),nom,undefined,fmt)||_storySortirTelechargement(des(),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; sp.textContent='Carte prête ✓'; setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}
// ── L'écran admin : créer une édition ─────────────────────────────────────
/** PURE. {id, fiche} ou {erreur}. Les dates : AAAA-MM-JJ, de minuit à 23 h 59. */
function saisonFiche(f){
  const nom=String(f&&f.nom||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(nom.length<3) return {erreur:'Donne un nom (3 caractères au moins).'};
  const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.debut||'')), e=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(f.fin||''));
  if(!d||!e) return {erreur:'Dates : AAAA-MM-JJ.'};
  const debut=new Date(+d[1],+d[2]-1,+d[3],0,0,0).getTime(), fin=new Date(+e[1],+e[2]-1,+e[3],23,59,59).getTime();
  if(!(fin>debut)) return {erreur:'La fin doit suivre le début.'};
  const mesure=['seances','tonnage','serie','progressionPct'].indexOf(f.mesure)>=0?f.mesure:null;
  if(!mesure) return {erreur:'Choisis une mesure.'};
  const n=v=>Number(String(v==null?'':v).replace(',','.'));
  const op=n(f.objectifPerso), oc=n(f.objectifCollectif||0);
  if(!(op>0&&op<1e8)) return {erreur:'L’objectif perso doit être un nombre positif.'};
  if(!(oc>=0&&oc<1e12)) return {erreur:'L’objectif collectif doit être un nombre.'};
  const slug=s=>{ let x=String(s||''); try{ x=x.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(er){} return x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); };
  const id=(slug(f.id)||(slug(nom).slice(0,34)+'-'+d[1])).slice(0,41);
  if(!SAISON_ID_RE.test(id)) return {erreur:'Identifiant invalide.'};
  const badgeCle=(slug(f.badgeCle)||slug(nom)).slice(0,40);
  if(!/^[a-z0-9-]{2,40}$/.test(badgeCle)) return {erreur:'Clé de badge invalide.'};
  const couleurAccent=/^#[0-9a-fA-F]{6}$/.test(String(f.couleurAccent||''))?f.couleurAccent:'#E02020';
  return {id,fiche:{nom,debut,fin,mesure,objectifPerso:op,objectifCollectif:oc,badgeCle,couleurAccent,
    texteAccueil:String(f.texteAccueil||'').trim().slice(0,200)}};
}
function htmlSaisonAdmin(){
  const L=(id,lib,champ)=>'<label class="pp-lab" for="'+id+'">'+lib+'</label>'+champ;
  return '<div class="card amb-journal" id="sa-admin"><div class="amb-t">Événement saisonnier</div>'
    +'<p class="sub amb-note">Une édition limitée pour tous : bannière d’accueil, fond « Édition » sur les visuels, badge avec l’année (jamais réédité), push de lancement, mi-parcours, J-2 et fin.</p>'
    +L('sa-nom','Nom','<input id="sa-nom" type="text" maxlength="60" placeholder="Hiver de fer">')
    +L('sa-debut','Début','<input id="sa-debut" type="date">')
    +L('sa-fin','Fin','<input id="sa-fin" type="date">')
    +L('sa-mesure','Mesure','<select id="sa-mesure"><option value="seances">Séances</option><option value="serie">Semaines validées</option><option value="tonnage">Tonnage (kg)</option><option value="progressionPct">Progression (%)</option></select>')
    +L('sa-op','Objectif perso','<input id="sa-op" type="number" min="1" inputmode="decimal" placeholder="10">')
    +L('sa-oc','Objectif collectif','<input id="sa-oc" type="number" min="0" inputmode="decimal" placeholder="1000">')
    +L('sa-badge','Clé du badge','<input id="sa-badge" type="text" maxlength="40" placeholder="hiver">')
    +L('sa-couleur','Couleur','<input id="sa-couleur" type="color" value="#E02020">')
    +L('sa-texte','Texte d’accueil','<input id="sa-texte" type="text" maxlength="200">')
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:10px 0 0;min-height:44px" onclick="enregistrerSaison(this)">Créer l’édition</button></div>';
}
async function enregistrerSaison(btn){
  if(!estAdminAmbassadeurs()) return false;
  const v=id=>(document.getElementById(id)||{}).value;
  const r=saisonFiche({nom:v('sa-nom'),debut:v('sa-debut'),fin:v('sa-fin'),mesure:v('sa-mesure'),objectifPerso:v('sa-op'),
    objectifCollectif:v('sa-oc'),badgeCle:v('sa-badge'),couleurAccent:v('sa-couleur'),texteAccueil:v('sa-texte')});
  if(r.erreur){ toast(r.erreur,'var(--orange)'); return false; }
  if(btn) btn.disabled=true;
  const ok=await CLOUD.racinePatch({['saisons/'+r.id]:r.fiche}).catch(()=>false);
  if(btn) btn.disabled=false;
  try{ localStorage.removeItem(SAISONS_CACHE); }catch(e){}
  _saisons=null;
  toast(ok?'Édition « '+r.fiche.nom+' » créée ⚡':'Création refusée','var('+(ok?'--green':'--orange')+')');
  return ok;
}
// ── Les résultats : CHAMPION et DÉFI RELEVÉ ────────────────────────────────
// La clôture (Cloud Functions) écrit /defis_resultats/<moi>/<id>. On les
// recopie dans le dossier (u.defisReleves) — c'est là que _badgesFaits lit,
// et c'est ce qui date les badges. Une fois par jour au plus.
// ── Ce que le serveur a décidé : défis bouclés, parrainage ────────────────
// La clôture d'un défi écrit /defis_resultats/<moi>/<id>, le parrainage
// /parrainage/comptes/<moi>. On les recopie dans le dossier (u.defisReleves,
// u.parrainage) — c'est là que _badgesFaits lit, et c'est ce qui date les
// badges. Une fois par jour au plus, sauf o.force (l'écran « Inviter des amis »).
async function majRecompensesServeur(o){
  const u=currentUser;
  if(!u||u.role!=='athlete'||!CLOUD.ok()) return 0;
  const j=localISODate(new Date());
  if(!(o&&o.force)){
    try{ if(localStorage.getItem('rc_defis_res_jour')===j+'|'+u.email) return 0; }catch(e){}
  }
  try{ localStorage.setItem('rc_defis_res_jour',j+'|'+u.email); }catch(e){}
  let r=null;
  if(canalAccessible(u)||(u.defisReleves&&Object.keys(u.defisReleves).length)||(u.duels&&Object.keys(u.duels).length))
    try{ r=await CLOUD.pullDefisResultats((u.email||'').replace(/\./g,',')); }catch(e){ r=null; }
  let pc=false;
  if(PARRAINAGE_ACTIF) try{ pc=await majParrainageMiroir(u); }catch(e){ pc=false; }
  const avant=Object.keys(u.defisReleves||{});
  // Les badges « Éditions » : /saisons_resultats/<moi>, écrit par le Worker.
  let ns=0;
  if(SERVEUR_LEGER) try{
    const tok=await CLOUD._getToken();
    const rs=tok?await fetch(CLOUD._fbUrl.replace('users.json','saisons_resultats/'+String(u.email||'').replace(/\./g,',')+'.json')+'?auth='+tok):null;
    ns=saisonsFusionnerResultats(u,(rs&&rs.ok)?await rs.json():null);
    if(ns) toast('Édition bouclée ⚡ Ton badge t’attend dans ta collection.','var(--green)',4000);
  }catch(e){ ns=0; }
  const n=defisFusionnerResultats(u,r)+(pc?1:0)+ns;
  if(n){
    try{ saveUser(); }catch(e){}
    // CHAQUE DÉFI RELEVÉ a son écran (dans la file des badges) : « J'AI
    // RELEVÉ LE DÉFI D'OCTOBRE », et sa carte à partager.
    // Un DUEL clos n'est pas un défi du Canal : il a sa carte sur l'accueil.
    try{ Object.keys(u.defisReleves||{}).filter(id=>avant.indexOf(id)<0&&!u.defisReleves[id].duel).forEach(id=>_bdgFile.push({defi:id})); _bdgPlanifier(); }catch(e){}
    // LE SIXIÈME POINT D'APPEL DES BADGES : CHAMPION, RECRUTEUR et MENTOR
    // arrivent du serveur, jamais d'une séance ni d'un bilan.
    try{ majBadges(); }catch(e){}
    try{ majXp(); }catch(e){}
  }
  return n;
}
// PURE (écrit dans u). Rend le nombre de défis nouveaux.
function defisFusionnerResultats(u,r){
  if(!u||!r||typeof r!=='object') return 0;
  const m=(u.defisReleves&&typeof u.defisReleves==='object')?u.defisReleves:{};
  let n=0;
  for(const id of Object.keys(r)){
    const x=r[id]; if(!x||m[id]) continue;
    m[id]={titre:String(x.titre||'').slice(0,80),mesure:String(x.mesure||''),fin:Number(x.fin)||0,
      termineLe:Number(x.termineLe)||Number(x.fin)||0,champion:x.champion===true};
    if(x.duel===true) m[id].duel=true;
    n++;
  }
  if(n) u.defisReleves=m;
  return n;
}
// ── La carte 1080×1920 ─────────────────────────────────────────────────────
function defiCarteDonnees(u,m,res){
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  const fin=Number((m&&m.fin)||(res&&res.fin))||Date.now();
  const d=Object.assign({},m||{},{fin});
  // La valeur montrée n'est jamais une charge : la régularité ou le %.
  const mesure=d.mesure==='progressionPct'?'progressionPct':(d.mesure==='serie'?'serie':'seances');
  const v=defiValeur(u,Object.assign({},d,{mesure}));
  return {titre:String((m&&m.titre)||(res&&res.titre)||'Le défi'),mois:defiMoisTexte(fin),
    champion:!!(res&&res.champion),valeur:v?_dfValeurTexte({mesure},v):'',signature:sig};
}
function _dessinerCarteDefi(d,fond,format){
  const F=visuelFormat(format), W=F.w, H=F.h, post=F.cle==='post';
  const cv=document.createElement('canvas');
  cv.width=W; cv.height=H;
  const g=cv.getContext('2d');
  const f=fond||'transparent';
  _visuelPeindreFond(g,W,H,f);
  const BEBAS=_tok('--pile-titre',"'Bebas Neue','Arial Narrow',Impact,sans-serif");
  const MONT="Montserrat,'Segoe UI',sans-serif";
  const M=72, LARG=W-M*2, cx=W/2;
  const o=_visuelOutils(g);
  const rouge=f==='rouge';
  g.textAlign='center'; g.textBaseline='alphabetic';
  // L'éclair, derrière. En post, il se resserre (échelle 0,62 autour de son
  // axe) et remonte : le texte garde le bas de l'image.
  const K=post?0.62:1, Y=(v)=>post?Math.round(110+(v-300)*K):v, X=(v)=>post?Math.round(cx+(v-cx)*K):v;
  g.save();
  const h=g.createRadialGradient(cx,Y(690),40,cx,Y(690),540*K);
  h.addColorStop(0,rouge?'rgba(255,255,255,.3)':'rgba(224,32,32,.45)'); h.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=h; g.fillRect(0,Y(200),W,Math.round(1100*K));
  g.fillStyle=rouge?'rgba(255,255,255,.92)':'#E02020';
  g.shadowColor=rouge?'rgba(255,255,255,.6)':'rgba(224,32,32,.9)'; g.shadowBlur=60;
  g.beginPath();
  [[610,300],[410,720],[540,720],[455,1080],[715,580],[575,580],[680,300]].forEach((p,i)=>i?g.lineTo(X(p[0]),Y(p[1])):g.moveTo(X(p[0]),Y(p[1])));
  g.closePath(); g.fill();
  g.restore();
  o.ombre(true);
  g.fillStyle='#fff';
  if(d.champion){
    g.fillStyle=rouge?'#fff':'#E02020'; g.font='800 40px '+MONT;
    o.ecrireEspace('DÉFI '+String(d.mois||''),cx,post?90:300,9,true);
    g.fillStyle='#fff';
    const cs=o.ajuste('CHAMPION','700',post?230:300,BEBAS,LARG,120);
    g.font='700 '+cs+'px '+BEBAS; o.ecrire('CHAMPION',cx,post?930:1380);
  }else{
    const l1='J’AI RELEVÉ', l2='LE DÉFI '+String(d.mois||'');
    const s1=o.ajuste(l1,'700',post?150:190,BEBAS,LARG,90), s2=o.ajuste(l2,'700',post?118:150,BEBAS,LARG,70);
    const b1=post?860:1330;
    g.font='700 '+s1+'px '+BEBAS; o.ecrire(l1,cx,b1);
    g.fillStyle=rouge?'#fff':'#ff3b3b';
    g.font='700 '+s2+'px '+BEBAS; o.ecrire(l2,cx,b1+s2+10);
  }
  g.fillStyle='rgba(255,255,255,.9)';
  const ts=o.ajuste('« '+d.titre+' »','700',46,MONT,LARG,26);
  const yt=post?(d.champion?1030:1080):(d.champion?1480:1560);
  g.font='700 '+ts+'px '+MONT; o.ecrire('« '+d.titre+' »',cx,yt);
  if(d.valeur){ g.font='800 40px '+MONT; o.ecrireEspace('⚡ '+d.valeur,cx,yt+(post?64:80),4,true); }
  _recSignature(g,o,String(d.signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
// L'écran d'un défi relevé : la foudre, la carte au choix du fond, partager.
let _defiCourant=null;
function _defiEcran(id,reste){
  const res=(currentUser&&currentUser.defisReleves||{})[id];
  if(!res) return _bdgSuivant();
  const d=defiCarteDonnees(currentUser,((window._canalListe||[]).find(x=>x.id===id))||null,res);
  _defiCourant={id,d};
  const z=_bdgCouche('<div class="bdg-ecran-txt">'
    +'<div class="bdg-ecran-sur">'+(d.champion?'CHAMPION DU DÉFI':'DÉFI RELEVÉ')+'</div>'
    +'<h2 class="bdg-ecran-nom" id="dfe-titre">'+escapeHtml(d.titre)+'</h2>'
    +'<div class="bdg-ecran-meta">'+escapeHtml(_bdgDate(Number(res.termineLe)||Number(res.fin)))+(d.valeur?' · ⚡ '+escapeHtml(d.valeur):'')+'</div>'
    +_htmlVisuelFonds('dfe-fonds')
    +'<button type="button" class="btn btn-red bdg-ecran-part" onclick="partagerDefi(\''+escapeHtml(id)+'\',this)">'+icon('share',16)+' <span>Partager</span></button>'
    +'<button type="button" class="btn btn-outline btn-sm bdg-ecran-tard" onclick="bdgPlusTard()">'+(reste||_bdgRecap.length?'Suivant':'Plus tard')+'</button>'
    +'</div>',d.champion?'Champion du défi':'Défi relevé');
  try{ monterSelecteurFond('dfe-fonds',f=>_dessinerCarteDefi(d,f),null); }catch(e){}
  try{ _bdgFoudre(z.querySelector('#dfe-titre'),arcReduit()?{son:false}:{eclairs:d.champion?3:2,conteneur:z}); }catch(e){}
  try{ arcHaptique('succes'); }catch(e){}
  try{ const p=z.querySelector('.bdg-ecran-part'); if(p) p.focus({preventScroll:true}); }catch(e){}
}
function partagerDefi(id,btn){
  if(_storyEnCours) return false;
  const m=((window._canalListe||[]).find(x=>x.id===id))||null;
  const res=(currentUser.defisReleves||{})[id]||null;
  const d=defiCarteDonnees(currentUser,m,res);
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier(d.champion?'repcore-champion':'repcore-defi',fond);
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerCarteDefi(d,fond),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerCarteDefi(d,fond),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ sp.textContent='Visuel prêt ✓'; setTimeout(()=>{ sp.textContent='Partager'; },2000); }
  return ok;
}
// ══ CANAL — CÔTÉ COACH ══════════════════════════════════════════════════════
// ══ LOT C5 : LE CALENDRIER DU CANAL (29/09/2026) ═════════════════════════
//
// En tête de « Mon canal » : ce que le coach peut publier cette semaine, déjà
// écrit et modifiable. Publier maintenant, ou programmer un jour et une
// heure : le serveur léger publie (travail horaire « canal_programmes » de
// planif.js), et le message reste modifiable et annulable jusqu'à son départ.
//
// ⚠ LE FIL EST LU PAR TOUT LE GROUPE. Aucune proposition ne nomme un athlète :
//   les faits sont collectifs et anonymes (recapTeamDonnees, sans son `top`).
//   Un record se compte, il ne se raconte pas. Si le coach veut nommer
//   quelqu'un, c'est lui qui l'écrit, dans le champ, d'un geste explicite.
// ⚠ AUCUNE DONNÉE DE SANTÉ : ni poids, ni douleur, ni sommeil. Le canal n'est
//   pas chiffré. Le test lit tous les textes produits.
// ⚠ LE RYTHME : UNE proposition mise en avant par semaine. Les autres restent
//   repliées ; publiée, programmée ou passée, la semaine est close.
//
// LES SOURCES. Le défi du mois de RepCore (defi_mois) ne s'adresse qu'aux
// autonomes : chez un coach, « le défi » est celui de son canal (messages de
// type defi). La saison (saisons) est commune à tous ; « où en est le groupe »
// se compte sur SES athlètes, par saisonValeur, pour les mesures qui
// s'additionnent (séances, tonnage) et seulement elles.

const CPROP_MAX=3;
const CPROP_CLE='rc_canal_prop';
const CPROP_HEURES=Object.freeze([7,8,9,12,17,18,19,20]);
const _cpJ=864e5;
function _cpJour(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }catch(e){ return ''; } }
function _cpNb(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '); }
function _cpTonnage(kg){ const v=Math.round(Number(kg)||0); return v>=1000?String(Math.round(v/100)/10).replace('.',',')+' t':_cpNb(v)+' kg'; }

/**
 * PURE. Au plus trois propositions, de la plus à propos à la moins :
 * [{cle, score, titre, texte}].
 *   evenements = { defis:[messages de type defi], saison: {id, nom, debut, fin, mesure} | null }
 */
function propositionsCanal(coach,athletes,evenements,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const ev=evenements||{}, ath=(athletes||[]).filter(Boolean);
  const out=[];
  // ── LE DÉFI DU CANAL qui commence ou se termine.
  for(const d of (Array.isArray(ev.defis)?ev.defis:[])){
    if(!d||d.type!=='defi'||!d.titre) continue;
    const debut=Number(d.debut), fin=Number(d.fin);
    if(!(fin>debut)) continue;
    const nom=String(d.titre).slice(0,60);
    if(fin>t&&fin-t<=3*_cpJ&&debut<t)
      out.push({cle:'defi_fin:'+(d.id||nom),score:90,titre:'Dernière ligne droite',
        texte:'Le défi « '+nom+' » se termine '+_cpJour(fin)+'. Chaque séance d’ici là compte encore : on le finit ensemble.'});
    else if(debut<=t+2*_cpJ&&debut>=t-2*_cpJ&&fin>t)
      out.push({cle:'defi_debut:'+(d.id||nom),score:85,titre:'C’est parti',
        texte:'Le défi « '+nom+' » '+(debut>t?'commence '+_cpJour(debut):'est lancé')+', jusqu’au '+_cpJour(fin).replace(/^\S+ /,'')+'. Qui le relève ?'});
  }
  // ── LA SAISON en cours, et où en est le groupe.
  const s=ev.saison;
  if(s&&s.nom&&Number(s.fin)>t&&Number(s.debut)<=t){
    let tot=null;
    if(s.mesure==='seances'||s.mesure==='tonnage'){
      tot=0; for(const u of ath){ try{ tot+=Number(saisonValeur(u,s))||0; }catch(e){} }
    }
    const fig=(tot&&tot>0)?(s.mesure==='seances'?_cpNb(Math.round(tot))+' séance'+(tot>=2?'s':''):_cpTonnage(tot)+' soulevés'):'';
    const reste=Math.ceil((Number(s.fin)-t)/_cpJ);
    const nom=String(s.nom).slice(0,60);
    if(reste<=7) out.push({cle:'saison_fin:'+(s.id||nom),score:75,titre:'La fin de l’édition',
      texte:'Plus que '+reste+' jour'+(reste>1?'s':'')+' pour l’édition « '+nom+' ».'+(fig?' À vous tous, vous en êtes à '+fig+'.':'')+' On termine fort.'});
    else if(t-Number(s.debut)<=3*_cpJ) out.push({cle:'saison_debut:'+(s.id||nom),score:70,titre:'Une édition commence',
      texte:'L’édition « '+nom+' » a commencé, jusqu’au '+_cpJour(Number(s.fin)).replace(/^\S+ /,'')+'. Vous la voyez sur votre accueil : chaque séance y compte.'});
    else if(fig) out.push({cle:'saison_point:'+(s.id||nom),score:45,titre:'Où en est le groupe',
      texte:'Édition « '+nom+' » : à vous tous, vous en êtes à '+fig+'. Encore '+reste+' jours pour aller plus loin.'});
  }
  // ── LES BILANS en retard (plusieurs) : un rappel pour tous, sans personne.
  const retard=ath.filter(u=>{ try{ return !u._fromCode&&(u.bilans||[]).length&&needsAlert(u); }catch(e){ return false; } }).length;
  if(retard>=2) out.push({cle:'bilans',score:60+Math.min(retard,10),titre:'Le rappel des bilans',
    texte:'Petit rappel pour tout le monde : si ton dernier bilan date de plus de deux semaines, cinq minutes dans l’app suffisent. C’est lui qui me permet d’ajuster ton programme.'});
  // ── LA DÉCHARGE, si plusieurs athlètes en ont une cette semaine.
  const dech=ath.filter(u=>{ try{ const p=programmeDe(u); const i=indexSemaineBloc(u,t); return !!(p&&i!=null&&p.decharges.indexOf(i)>=0); }catch(e){ return false; } }).length;
  if(dech>=2) out.push({cle:'decharge',score:55,titre:'La semaine de décharge',
    texte:'Pour une partie d’entre vous, c’est la semaine de décharge : on lève le pied, c’est prévu. C’est là que le corps encaisse le travail des semaines passées.'});
  // ── UN FAIT COLLECTIF DE LA SEMAINE, anonyme.
  let r=null; try{ r=recapTeamDonnees(ath,'semaine',t,''); }catch(e){ r=null; }
  if(r&&r.seances>=2) out.push({cle:'semaine',score:40,titre:'Votre semaine',
    texte:'Ces sept derniers jours, vous avez fait '+_cpNb(r.seances)+' séances'
      +(r.records?' et battu '+r.records+' record'+(r.records>1?'s':'')+' personnel'+(r.records>1?'s':''):'')
      +(r.tonnage>=1000?', pour '+_cpTonnage(r.tonnage)+' soulevés':'')+'. Beau travail, on continue.'});
  return out.sort((a,b)=>b.score-a.score).slice(0,CPROP_MAX);
}

// ── LE RYTHME : une proposition par semaine ───────────────────────────────
function _cpEtat(){ try{ return JSON.parse(localStorage.getItem(CPROP_CLE)||'null')||{}; }catch(e){ return {}; } }
function _cpSemaineClose(t){ const e=_cpEtat(); return !!(e&&e.semaine===kitSemaineCle(t)); }
function _cpClore(cle,comment){ try{ localStorage.setItem(CPROP_CLE,JSON.stringify({semaine:kitSemaineCle(Date.now()),cle:String(cle||''),comment})); }catch(e){} }
let _cpListe=[];
function renderPropositionsCanal(){
  const z=document.getElementById('canal-propositions');
  if(!z||!currentUser||currentUser.role!=='coach') return false;
  const t=Date.now();
  if(_cpSemaineClose(t)){
    const e=_cpEtat();
    z.innerHTML='<div class="cp-close sub">'+(e.comment==='passe'?'Pas de proposition cette semaine, c’est noté.':'Ta proposition de la semaine est faite.')+' Les suivantes arrivent lundi.</div>';
    return true;
  }
  const defis=Object.keys(window._canalMsgsCoach||{}).map(id=>Object.assign({id},window._canalMsgsCoach[id])).filter(m=>m.type==='defi');
  let saison=null; try{ saison=saisonActive(t); }catch(e){ saison=null; }
  let ath=[]; try{ ath=getClients().filter(c=>c&&!c._fromCode); }catch(e){ ath=[]; }
  _cpListe=propositionsCanal(currentUser,ath,{defis,saison},t);
  if(!_cpListe.length){ z.innerHTML=''; return false; }
  const E=escapeHtml, p=_cpListe[0];
  const carte=(x,i)=>'<div class="cp-carte'+(i?' cp-carte-2':'')+'"><div class="cp-t">'+E(x.titre)+'</div>'
    +'<div class="cp-x">'+E(x.texte)+'</div><div class="cp-b">'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="utiliserProposition('+i+')">Modifier et publier</button>'
    +'<button type="button" class="cp-lien" onclick="utiliserProposition('+i+',true)">Programmer</button></div></div>';
  z.innerHTML='<div class="cp"><div class="cp-h"><span>Cette semaine, tu peux publier…</span>'
    +'<button type="button" class="cp-lien" onclick="passerPropositions()">Passer</button></div>'
    +carte(p,0)
    +(_cpListe.length>1?'<details class="cp-autres"><summary>'+(_cpListe.length-1)+' autre'+(_cpListe.length>2?'s':'')+' idée'+(_cpListe.length>2?'s':'')+'</summary>'
      +_cpListe.slice(1).map((x,k)=>carte(x,k+1)).join('')+'</details>':'')+'</div>';
  return true;
}
function passerPropositions(){ _cpClore('','passe'); renderPropositionsCanal(); return true; }
function utiliserProposition(i,programmer){
  const x=_cpListe[i]; if(!x) return false;
  window._cpPre={titre:x.titre,texte:x.texte,prop:x.cle,programmer:!!programmer};
  openMessageCanal('');
  return true;
}

// ── PROGRAMMER : canal_programmes/<coach>/<id> ─────────────────────────────
// Écrit par le coach, publié par le serveur à l'heure dite (au plus une minute
// après), puis effacé. Modifier ou annuler, c'est réécrire ou effacer ce nœud :
// tant qu'il existe, rien n'est parti.
let _cpProgrammes=null;
async function _cpChargerProgrammes(){
  const cle=canalCle(currentUser);
  if(!cle) return {};
  const r=await _fbJson('canal_programmes/'+cle);
  _cpProgrammes=r.ok?(r.v||{}):(_cpProgrammes||{});
  return _cpProgrammes;
}
// PURE. Les programmés, du plus proche au plus lointain.
function canalProgrammesListe(brut){
  const o=(brut&&typeof brut==='object')?brut:{};
  return Object.keys(o).map(id=>Object.assign({id},o[id])).filter(m=>m&&Number(m.quand)>0).sort((a,b)=>Number(a.quand)-Number(b.quand));
}
function renderProgrammesCanal(){
  const z=document.getElementById('canal-programmes');
  if(!z) return false;
  const l=canalProgrammesListe(_cpProgrammes);
  if(!l.length){ z.innerHTML=''; return false; }
  const E=escapeHtml;
  z.innerHTML='<div class="cp-prog"><div class="cp-h"><span>Programmés</span></div>'
    +l.map(m=>{ const id=E(m.id); return '<div class="cp-pl"><div class="cp-pd">'+E(_cpJour(Number(m.quand)))+', '+new Date(Number(m.quand)).getHours()+' h'
      +(m.manque?' <b>· pas parti à l’heure prévue</b>':'')+'</div>'
      +'<div class="cp-px">'+E(m.titre?m.titre+' : ':'')+E(String(m.texte||'').slice(0,140))+(String(m.texte||'').length>140?'…':'')+'</div>'
      +'<div class="cp-b"><button type="button" class="cp-lien" onclick="modifierProgramme(\''+id+'\')">Modifier</button>'
      +'<button type="button" class="cp-lien" onclick="annulerProgramme(\''+id+'\')">Annuler</button></div></div>'; }).join('')+'</div>';
  return true;
}
function modifierProgramme(id){
  const m=(_cpProgrammes||{})[id]; if(!m) return false;
  window._cpPre={titre:m.titre||'',texte:m.texte||'',lien:m.lien||'',programmer:true,quand:Number(m.quand),progId:id};
  openMessageCanal('');
  return true;
}
async function annulerProgramme(id){
  const cle=canalCle(currentUser); if(!cle) return false;
  if(!await rcConfirm('Annuler ce message programmé ? Il ne partira pas.',null,'Annuler le message','Garder')) return false;
  const r=await _fbJson('canal_programmes/'+cle+'/'+id,'DELETE');
  if(!r.ok){ toast('Annulation impossible hors connexion.','var(--orange)'); return false; }
  delete (_cpProgrammes||{})[id];
  renderProgrammesCanal();
  toast('Message annulé');
  return true;
}
// PURE. L'instant programmé à partir d'un jour (AAAA-MM-JJ) et d'une heure.
function canalQuand(jourISO,heure){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(jourISO||''));
  const h=Math.round(Number(heure));
  if(!m||!(h>=0&&h<=23)) return null;
  const d=new Date(+m[1],+m[2]-1,+m[3],h,0,0,0);
  // Le 31 février ne devient pas le 3 mars.
  if(d.getMonth()!==+m[2]-1||d.getDate()!==+m[3]) return null;
  return d.getTime();
}
function _cpBlocProgrammer(o){
  const q=Number(o&&o.quand)||0;
  const d=new Date(q||Date.now()+_cpJ);
  const jour=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const hh=q?d.getHours():8;
  return `<div id="cm-prog" class="cp-progbloc"${o&&o.programmer?'':' hidden'}>
      <div class="cp-progl"><label for="cm-jour">Jour</label><input id="cm-jour" type="date" value="${jour}"></div>
      <div class="cp-progl"><label for="cm-heure">Heure</label><select id="cm-heure">${Array.from({length:24},(_,h)=>`<option value="${h}"${h===hh?' selected':''}>${h} h</option>`).join('')}</select></div>
      <div class="sub cp-progs">Le serveur publie à l’heure dite. D’ici là, tu le modifies ou l’annules depuis « Programmés ».</div>
    </div>`;
}
// Un message programmé ne s'épingle pas : la case disparaît quand on programme.
function _cpSansEpingle(){
  const e=document.getElementById('cm-epingle');
  if(!e) return;
  e.checked=false;
  const l=e.closest('label'); if(l) l.hidden=true;
}
function _cpBoutonProgrammer(){
  const z=document.getElementById('cm-prog'), b=document.getElementById('cm-btn-prog');
  if(z&&z.hidden){ z.hidden=false; if(b) b.textContent='Programmer ce jour-là'; _cpSansEpingle(); return false; }
  return programmerMessageCanal();
}
async function programmerMessageCanal(){
  const o=window._cpOuverture||{};
  const titre=(document.getElementById('cm-titre')?.value||'').trim().slice(0,CANAL_TITRE_MAX);
  const texte=(document.getElementById('cm-texte')?.value||'').trim().slice(0,CANAL_TEXTE_MAX);
  const lien=(document.getElementById('cm-lien')?.value||'').trim().slice(0,CANAL_LIEN_MAX);
  if(!titre&&!texte){ toast('Écris au moins un titre ou un message','var(--orange)'); return false; }
  if(lien&&safeUrlRaw(lien)==='#'){ toast('Le lien doit commencer par https://','var(--orange)'); return false; }
  const quand=canalQuand(document.getElementById('cm-jour')?.value,document.getElementById('cm-heure')?.value);
  if(!quand||quand<=Date.now()){ toast('Choisis un jour et une heure à venir.','var(--orange)'); return false; }
  const cle=canalCle(currentUser);
  if(!cle||!CLOUD.ok()){ toast('Programmation impossible hors connexion','var(--orange)'); return false; }
  const id=o.progId||('p'+Date.now()+'-'+Math.random().toString(36).slice(2,7));
  const m={quand,titre,texte,cree:Date.now()};
  if(lien) m.lien=lien;
  const r=await _fbJson('canal_programmes/'+cle+'/'+id,'PUT',m);
  if(!r.ok){ toast('Non programmé : réessaie une fois en ligne.','var(--orange)'); return false; }
  if(!_cpProgrammes) _cpProgrammes={};
  _cpProgrammes[id]=m;
  if(o.prop) _cpClore(o.prop,'programme');
  if(!o.progId) rcmCoach('coach_canal_publie');
  window._cpOuverture=null;
  closeModal();
  renderProgrammesCanal(); renderPropositionsCanal();
  toast('Programmé pour '+_cpJour(quand)+', '+new Date(quand).getHours()+' h');
  return true;
}
function loadCanalCoach(){
  if(currentUser?.role!=='coach') return;
  go('s-coach-canal');
  // C5 : les programmés et les propositions de la semaine (la saison d'abord).
  _cpChargerProgrammes().then(()=>renderProgrammesCanal()).catch(()=>{});
  try{ Promise.resolve(chargerSaisons()).catch(()=>{}).then(()=>{ try{ renderPropositionsCanal(); }catch(e){} }); }catch(e){}
  const fil=document.getElementById('canal-coach-fil');
  _canalSquelette(fil);
  _canalChargerCoach();
}
async function _canalChargerCoach(idNeuf){
  const cle=canalCle(currentUser);
  const fil=document.getElementById('canal-coach-fil');
  if(!fil) return;
  if(!cle||!CLOUD.ok()){
    fil.innerHTML=_canalVide('Canal indisponible hors connexion.','Reconnecte-toi pour écrire.');
    return;
  }
  // Le coach seul peut lire /reactions : c'est ce qui lui donne les prénoms.
  // Même règle que côté athlète, et elle compte DAVANTAGE ici : un coach qui
  // voit son canal vide à cause d'un réseau capricieux le republierait en
  // double, chez tout le monde.
  let msgs,compteurs,reactions,defis;
  try{
    msgs=await CLOUD.pullCanalMessages(cle);
    [compteurs,reactions,defis]=await Promise.all([
      CLOUD.pullCanalCompteurs(cle).catch(()=>null),
      CLOUD.pullCanalReactions(cle).catch(()=>null),
      // Le coach lit /defis en entier : participants, résumé public.
      CLOUD._canalGet(cle,'defis').catch(()=>null)
    ]);
  }catch(e){
    fil.innerHTML=`<div style="text-align:center;padding:40px 20px">
      <div style="font-size:var(--fs-2xl);line-height:1;margin-bottom:12px;opacity:.5">📡</div>
      <div style="font-weight:800;font-size:var(--fs-md);margin-bottom:6px">Canal injoignable</div>
      <div class="sub" style="font-size:var(--fs-sm);line-height:1.6;margin-bottom:16px">Ne republie pas : tes messages sont peut-être déjà là. La demande n'a pas abouti.</div>
      <button class="btn btn-outline btn-sm" style="min-height:42px;margin:0" onclick="_canalChargerCoach()">Réessayer</button></div>`;
    return;
  }
  window._canalMsgsCoach=msgs||{};
  try{ renderPropositionsCanal(); }catch(e){}
  const liste=canalTrier(msgs);
  // LES MESSAGES SYSTÈME (paliers, podium) rallument la pastille côté serveur,
  // dans coach_public.canalDernier. Le profil que ce coach renvoie ensuite ne
  // doit pas la faire reculer : on la remonte au plus récent du fil.
  try{
    const der=liste.reduce((x,m)=>Math.max(x,Number(m.at)||0),0);
    if(der>(Number(currentUser.canalDernier)||0)){ currentUser.canalDernier=der; saveUser(); }
  }catch(e){}
  const vrai=canalDecompteVrai(reactions);
  await _canalPlancher(fil);
  fil.dataset.rempli='1';
  fil.innerHTML=liste.length
    ? canalOrdreAvecDefis(liste).map(m=>m.type==='systeme'?htmlCarteSysteme(m,true)
        :m.type==='defi'?htmlCarteDefiCoach(m,(defis||{})[m.id],m.id===idNeuf)
        :_canalCarteCoach(m,(compteurs||{})[m.id]||{},vrai[m.id]||{},reactions||{},m.id===idNeuf)).join('')
    : _canalVide('Ton canal est vide.','Le premier message apparaîtra chez tous tes athlètes.');
}
// PURE. /reactions est rangé par athlète puis par message ; le décompte, lui,
// se lit par message. C'est ce pivot-là, et rien d'autre.
// Il fait autorité sur /compteurs : celui-ci peut avoir dérivé si un téléphone
// a lâché entre les deux écritures.
function canalDecompteVrai(reactions){
  const out={};
  if(!reactions||typeof reactions!=='object') return out;
  Object.keys(reactions).forEach(athleteKey=>{
    const parMsg=reactions[athleteKey];
    if(!parMsg||typeof parMsg!=='object') return;
    Object.keys(parMsg).forEach(msgId=>{
      const e=parMsg[msgId];
      if(!e) return;
      if(!out[msgId]) out[msgId]={};
      out[msgId][e]=(out[msgId][e]||0)+1;
    });
  });
  return out;
}
// PURE. Les prénoms de ceux qui ont posé un emoji donné. Le coach lit les
// dossiers de SES athlètes, ce que les règles lui accordent déjà.
function canalPrenoms(reactions,msgId,emoji){
  const users=DB.get('users')||{};
  const noms=[];
  Object.keys(reactions||{}).forEach(k=>{
    if((reactions[k]||{})[msgId]!==emoji) return;
    const c=users[k.replace(/,/g,'.')];
    noms.push((c&&(c.fname||c.email))||k.replace(/,/g,'.'));
  });
  return noms.sort((a,b)=>String(a).localeCompare(String(b)));
}
function _canalCarteCoach(m,compteurs,vrai,reactions,neuve){
  const derive=CANAL_EMOJIS.some(e=>(Number(compteurs[e])||0)!==(Number(vrai[e])||0));
  const lignes=CANAL_EMOJIS.filter(e=>(Number(vrai[e])||0)>0).map(e=>{
    // Le prénom, précédé de l'emblème du rang de l'athlète.
    const noms=canalPrenomsRangs(reactions,m.id,e);
    return `<div style="display:flex;gap:8px;align-items:flex-start;font-size:var(--fs-sm);padding:4px 0">
      <span aria-hidden="true">${e}</span><span style="font-weight:800">${noms.length}</span>
      <span class="sub" style="flex:1;min-width:0;line-height:1.5">${noms.map(x=>htmlNomRang(x.nom,x.xp)).join(', ')}</span></div>`;
  }).join('');
  const lien=String(m.lien||'').trim();
  return `<div class="cnl-carte${neuve?' cnl-neuve':''}"${m.epingle?' data-epingle':''}>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      ${m.epingle?'<span style="font-size:var(--fs-xs);color:var(--red-text);font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Épinglé</span>':''}
      <span class="sub" style="font-size:var(--fs-xs);letter-spacing:1px;text-transform:uppercase">${escapeHtml(ago(Number(m.at)||Date.now()))}</span>
    </div>
    ${m.titre?`<div class="cnl-titre">${escapeHtml(m.titre)}</div>`:''}
    ${m.texte?`<div class="cnl-texte">${escapeHtml(m.texte)}</div>`:''}
    ${lien&&safeUrlRaw(lien)!=='#'?`<a href="${safeUrl(lien)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:10px;font-size:var(--fs-sm);color:var(--info);font-weight:700">${escapeHtml(canalDomaine(lien)||'lien')} ↗</a>`:''}
    ${lignes?`<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">${lignes}</div>`
            :'<div class="sub" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);font-size:var(--fs-xs)">Aucune réaction pour l\'instant.</div>'}
    ${derive?`<button class="btn btn-outline btn-sm" style="width:100%;margin:10px 0 0;min-height:38px;color:var(--orange);border-color:var(--orange)" onclick="resyncCompteursCanal('${escapeHtml(m.id)}')">Le compteur public a dérivé : resynchroniser</button>`:''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
      <button class="btn btn-outline btn-sm" style="width:auto;padding:0 14px;min-height:34px;font-size:10.5px;margin:0" onclick="openMessageCanal('${escapeHtml(m.id)}')">Modifier</button>
      <button class="btn btn-outline btn-sm" style="width:auto;padding:0 14px;min-height:34px;font-size:10.5px;margin:0;color:var(--sub)" onclick="supprimerMessageCanal('${escapeHtml(m.id)}')">Supprimer</button>
    </div></div>`;
}
// Le compteur public est ramené sur le décompte vrai. Les règles laissent le
// coach écrire la valeur qu'il veut — précisément pour cette réparation-là.
async function resyncCompteursCanal(msgId){
  const cle=canalCle(currentUser);
  if(!cle) return;
  try{
    const reactions=await CLOUD.pullCanalReactions(cle);
    const vrai=(canalDecompteVrai(reactions))[msgId]||{};
    await Promise.all(CANAL_EMOJIS.map(e=>CLOUD.fixerCompteur(cle,msgId,e,Number(vrai[e])||0)));
    toast('Compteurs resynchronisés');
    _canalChargerCoach();
  }catch(e){ toast('Resynchronisation impossible : '+e.message,'var(--orange)'); }
}

// `brouillon` est OPTIONNEL et n'existe que pour la liste « Jamais demarre » :
// {texte, nomme}. Les deux appelants historiques ne passent qu'un identifiant et
// ne changent pas d'un caractere.
//
// ⚠ CE CANAL EST UNE DIFFUSION, PAS UN MESSAGE PRIVE. Les regles RTDB ouvrent
// /canaux/{coach}/messages en lecture a TOUT athlete dont coachEmailKey designe
// ce coach : il n'existe aucun adressage par athlete dans ce produit, et le
// commentaire de ces memes regles pose le principe — « RepCore n'a jamais
// laisse un athlete apprendre l'existence d'un autre ».
// Un brouillon qui commence par « Salut Marie » nomme donc Marie a tout le
// groupe, ET apprend au groupe qu'elle n'a pas commence. Le coach doit le
// savoir AU MOMENT OU IL ECRIT, pas apres : d'ou l'avertissement ci-dessous,
// pose seulement quand le brouillon porte un prenom.
// ⚠ PLUS DE PARAMETRE `brouillon`, ET PLUS D'AVERTISSEMENT ORANGE. Un seul
//   appelant en posait un : la relance « jamais demarre », qui ouvrait ce
//   canal avec un texte nominatif. L'ecran prevenait alors que « le brouillon
//   nomme Jean » et que l'envoyer tel quel l'apprendrait a tout le groupe.
//   Depuis le 19/09/2026 cette relance part en WhatsApp ou en mail : la cause
//   a disparu, l'avertissement avec elle. On ne garde pas un garde-fou pour
//   un chemin qui n'existe plus — il ferait croire que le chemin existe.
// C5 : un message neuf peut arriver pré-rempli (une proposition collective,
// un programmé à modifier) par window._cpPre, lu UNE fois ici puis effacé. La
// signature reste à un paramètre : voir le test « Aucun brouillon nominatif ».
function openMessageCanal(msgId){
  document.getElementById('modal-overlay')?.remove();
  const _p=(!msgId&&window._cpPre&&typeof window._cpPre==='object')?window._cpPre:{};
  window._cpPre=null;
  window._cpOuverture=msgId?null:_p;
  const m=(msgId&&(window._canalMsgsCoach||{})[msgId])||{titre:_p.titre||'',texte:_p.texte||'',lien:_p.lien||''};
  // Un défi se modifie dans SA feuille : celle-ci réécrirait le message sans
  // sa mesure ni ses dates.
  if(m.type==='defi') return openDefiCanal(msgId);
  window._canalEdite=msgId||'';
  document.body.insertAdjacentHTML('beforeend',
  `<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div onclick="event.stopPropagation()" role="dialog" aria-modal="true" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">
    <h2 style="margin-bottom:4px">${msgId?'Modifier le message':'Nouveau message'}</h2>
    <p class="sub" style="font-size:var(--fs-sm);margin-bottom:12px;line-height:1.55">Il apparaît dans le canal de tous tes athlètes suivis, à leur prochaine ouverture de l'app. Ce n'est pas une notification : leur téléphone ne sonnera pas.</p>
    <label for="cm-titre">Titre (optionnel) · ${CANAL_TITRE_MAX} caractères</label>
    <input id="cm-titre" type="text" maxlength="${CANAL_TITRE_MAX}" value="${escapeHtml(m.titre||'')}" placeholder="Nouvelle vidéo technique">
    <label for="cm-texte" style="margin-top:12px">Message · ${CANAL_TEXTE_MAX} caractères</label>
    <textarea id="cm-texte" rows="5" maxlength="${CANAL_TEXTE_MAX}" style="resize:none" placeholder="J'ai publié une nouvelle vidéo sur le soulevé de terre. Regardez-la avant jeudi.">${escapeHtml(m.texte||'')}</textarea>
    <label for="cm-lien" style="margin-top:12px">Lien (optionnel)</label>
    <input id="cm-lien" type="url" maxlength="${CANAL_LIEN_MAX}" value="${escapeHtml(m.lien||'')}" placeholder="Colle ici l'adresse de ta publication">
    <div class="sub" style="font-size:var(--fs-xs);margin-top:6px;line-height:1.5">Réseaux sociaux, vidéo, Drive, tableur… Tes athlètes voient le nom du site et ouvrent le lien d'un tap, dans leur navigateur. Aucune image d'aperçu n'est chargée : rien n'est demandé à un autre site tant que personne n'a touché le lien.</div>
    <label style="display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer">
      <input id="cm-epingle" type="checkbox" ${m.epingle?'checked':''} style="width:18px;height:18px;accent-color:var(--red);cursor:pointer;flex-shrink:0">
      <span style="font-size:var(--fs-sm);line-height:1.5">Épingler à l'accueil<br><span class="sub" style="font-size:var(--fs-xs)">Un seul message à la fois : celui-ci remplacera l'épinglé actuel.</span></span>
    </label>
    ${msgId?'':_cpBlocProgrammer(_p)}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" style="flex:1;margin:0;min-height:44px" onclick="closeModal()">Annuler</button>
      ${msgId?'':`<button class="btn btn-outline btn-sm" id="cm-btn-prog" style="flex:1;margin:0;min-height:44px" onclick="_cpBoutonProgrammer()">${_p.programmer?'Programmer ce jour-là':'Programmer…'}</button>`}
      <button class="btn btn-red btn-sm" style="flex:1;margin:0;min-height:44px" onclick="enregistrerMessageCanal()">${msgId?'Enregistrer':(_p.progId?'Publier maintenant':'Publier')}</button>
    </div>
  </div></div>`);
  if(_p.programmer) _cpSansEpingle();
}

async function enregistrerMessageCanal(){
  const titre=(document.getElementById('cm-titre')?.value||'').trim().slice(0,CANAL_TITRE_MAX);
  const texte=(document.getElementById('cm-texte')?.value||'').trim().slice(0,CANAL_TEXTE_MAX);
  const lienBrut=(document.getElementById('cm-lien')?.value||'').trim().slice(0,CANAL_LIEN_MAX);
  const epingle=!!document.getElementById('cm-epingle')?.checked;
  if(!titre&&!texte){ toast('Écris au moins un titre ou un message','var(--orange)'); return; }
  // Un lien saisi mais invalide est REFUSÉ, pas silencieusement vidé : le coach
  // croirait l'avoir publié, et l'athlète ne verrait jamais rien.
  if(lienBrut&&safeUrlRaw(lienBrut)==='#'){
    toast('Le lien doit commencer par https://','var(--orange)'); return;
  }
  const cle=canalCle(currentUser);
  if(!cle||!CLOUD.ok()){ toast('Publication impossible hors connexion','var(--orange)'); return; }
  // Date.now() seul ne suffit pas : deux publications dans la même milliseconde
  // partageraient un identifiant et l'une écraserait l'autre.
  const id=window._canalEdite||('m'+Date.now()+'-'+Math.random().toString(36).slice(2,7));
  const ancien=(window._canalMsgsCoach||{})[id]||{};
  const msg={at:Number(ancien.at)||Date.now(),titre,texte,lien:lienBrut,epingle};
  // LE BOUTON PORTE L'ATTENTE, et la feuille ne part QU'AU SUCCES. closeModal()
  // etait appele AVANT patcherMessagesCanal, ecrireMessageCanal et
  // pushProfilCoach — trois allers-retours reseau enchaines : le coach venait
  // d'envoyer un message a ses vingt eleves et rien ne le lui disait pendant
  // 300 ms a 2 s. En cas d'echec, la feuille reste ouverte avec le texte saisi ;
  // aujourd'hui il etait perdu.
  const _b=document.querySelector('#modal-overlay .btn-red');
  if(_b){
    _b.disabled=true;
    _b.dataset.lib=_b.textContent;
    _b.textContent='Envoi…';
    _b.classList.add('cnl-envoi');
  }
  try{
    // Dépingler les autres AVANT d'épingler celui-ci, et d'un seul PATCH : deux
    // bannières empilées sur l'accueil, personne ne les lit.
    if(epingle){
      const patch={};
      Object.keys(window._canalMsgsCoach||{}).forEach(k=>{
        if(k!==id&&(window._canalMsgsCoach[k]||{}).epingle) patch[k+'/epingle']=false;
      });
      if(Object.keys(patch).length) await CLOUD.patcherMessagesCanal(cle,patch);
    }
    await CLOUD.ecrireMessageCanal(cle,id,msg);
    // La sonde de pastille et la copie épinglée vivent dans coach_public, qui
    // est déjà téléchargé à chaque ouverture d'accueil : c'est ce qui rend la
    // bannière et la pastille gratuites côté athlète.
    // SUR L'HORODATAGE DU MESSAGE, jamais sur « maintenant ». Une MODIFICATION
    // garde le `at` d'origine : poser Date.now() faisait passer la sonde
    // au-dessus de tout ce que l’athlète peut voir, et canalNonLu — qui compare
    // canalDernier au plus récent AFFICHÉ — ne pouvait plus jamais
    // s'équilibrer. La pastille restait allumée, ouverture après ouverture.
    //
    // Math.max et non une affectation : éditer un vieux message ne doit pas
    // faire RECULER la sonde sous un message plus récent, sinon la pastille
    // s’éteindrait pour une publication que personne n’a lue.
    currentUser.canalDernier=Math.max(Number(currentUser.canalDernier)||0,msg.at);
    if(epingle) currentUser.canalEpingle={id,at:msg.at,titre,texte,lien:lienBrut};
    else if(currentUser.canalEpingle&&currentUser.canalEpingle.id===id) delete currentUser.canalEpingle;
    saveUser();
    await CLOUD.pushProfilCoach(currentUser);
    closeModal();
    if(!window._canalEdite) rcmCoach('coach_canal_publie');
    toast(window._canalEdite?'Message modifié':'Message publié');
    // C5 : une proposition publiée clôt la semaine ; un programmé publié tout
    // de suite ne doit plus partir à son heure.
    try{ const o=window._cpOuverture||{}; window._cpOuverture=null;
      if(o.prop) _cpClore(o.prop,'publie');
      if(o.progId){ await _fbJson('canal_programmes/'+cle+'/'+o.progId,'DELETE'); if(_cpProgrammes) delete _cpProgrammes[o.progId]; renderProgrammesCanal(); }
      renderPropositionsCanal(); }catch(e){}
  }catch(e){
    if(_b){
      _b.disabled=false;
      _b.classList.remove('cnl-envoi');
      if(_b.dataset.lib!=null) _b.textContent=_b.dataset.lib;
    }
    toast('Non publié : '+e.message,'var(--orange)');
    return;                       // la feuille reste ouverte, le texte aussi
  }
  window._canalEdite='';
  // L'identifiant du message neuf voyage jusqu'au rendu : la carte qu'on vient
  // d'ecrire entre seule et marquee, au lieu d'etre indistincte au milieu d'un
  // rechargement complet du fil.
  _canalChargerCoach(id);
}

async function supprimerMessageCanal(msgId){
  if(!await rcConfirm('Supprimer ce message du canal ? Il disparaîtra chez tous tes athlètes.',null,'Supprimer')) return;
  const cle=canalCle(currentUser);
  if(!cle) return;
  try{
    await CLOUD.supprimerMessageCanal(cle,msgId);
    if(currentUser.canalEpingle&&currentUser.canalEpingle.id===msgId){
      delete currentUser.canalEpingle;
      saveUser();
      await CLOUD.pushProfilCoach(currentUser);
    }
    toast('Message supprimé');
  }catch(e){ toast('Suppression impossible : '+e.message,'var(--orange)'); }
  _canalChargerCoach();
}

