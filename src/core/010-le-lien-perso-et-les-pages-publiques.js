// ══ LE LIEN PERSO ET LES PAGES PUBLIQUES ════════════════════════════════════
//
// Deux pages HORS DE L'APP, servies par l'hébergement et rendues en moins
// d'une seconde (p/index.html, c/index.html) :
//   /@<pseudo>      la page d'un athlète — désactivée par défaut ; il choisit
//                   ce qu'elle montre, jamais un poids, une photo ni une
//                   donnée de santé (aucun champ n'existe pour les recevoir).
//   /coach/<slug>   la vitrine d'un coach — ce que s-vitrine montre déjà à ses
//                   athlètes, sans ses coordonnées ni ses images en base64.
// Là où il n'y a pas de réécriture (GitHub Pages), p/?u=<pseudo> et c/?s=<slug>.
//
// LES NŒUDS (database.rules.json) : /pseudos/<pseudo> et /slugs/<slug> → clé
// (une réservation, lisible par PERSONNE : une clé est un e-mail ; on la
// prend en écrivant, un refus veut dire « déjà pris ») ; /profils_publics et
// /vitrines, lus sans connexion, en liste blanche de champs.
const PSEUDO_PUBLIC_RE=/^[a-z0-9][a-z0-9._]{1,18}[a-z0-9]$/;
const SLUG_PUBLIC_RE=/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
// Ce que la page montre (28/09/2026) : l'emblème et la jauge de volts, les
// 12 dernières semaines, les badges en images (un secret n'y paraît qu'une
// fois découvert : seuls les badges OBTENUS partent), le nombre de séances.
// LES CHARGES seulement si l'athlète coche « Mes 3 meilleurs records » —
// décochée par défaut. Jamais de poids de corps, de photo ni de santé :
// aucun champ n'existe pour les recevoir (database.rules.json).
const PAGE_MONTRER=Object.freeze([
  {cle:'rang',lib:'Mon emblème et mes volts',defaut:true},
  {cle:'serie',lib:'Mes 12 dernières semaines',defaut:true},
  {cle:'badges',lib:'Mes badges',defaut:true},
  {cle:'seances',lib:'Mon nombre de séances',defaut:true},
  {cle:'stats',lib:'Mes chiffres : tonnes soulevées, séries, exercices, depuis quand',defaut:true},
  {cle:'photo',lib:'Ma photo de profil',defaut:false},
  {cle:'meilleurs',lib:'Mes 3 meilleurs records, avec les charges',defaut:false},
  {cle:'carte',lib:'Ma carte d’athlète (vignette)',defaut:false}
]);
// Un choix ajouté après coup (stats, photo) prend sa valeur par défaut chez
// qui a enregistré sa page avant : absent ne veut pas dire « décoché ».
function pageMontrerComplet(m){ const o=pageMontrerDefaut(); Object.keys(m||{}).forEach(k=>{ o[k]=!!m[k]; }); return o; }
// PURE. Les chiffres de la page : tonnes soulevées (kg), séries faites,
// exercices différents, date de la première séance. Rien de corporel.
function statsPubliques(u){
  let kg=0, series=0, depuis=0; const exos={};
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!(s.date>0)) continue;
    if(!depuis||s.date<depuis) depuis=Number(s.date);
    try{ kg+=defiTonnageSeance(s)||0; }catch(e){}
    try{ for(const e of _dfExos(s)){ const n=e.sets.filter(x=>x&&x.done!==false).length; if(n){ series+=n; exos[e.nom]=1; } } }catch(e){}
  }
  return {tonnage:Math.max(0,Math.min(999999999,Math.round(kg))),series:Math.min(9999999,series),exos:Math.min(9999,Object.keys(exos).length),depuis:depuis||0};
}
// La photo de profil, si l'athlète l'a cochée : l'image déjà réduite à
// 300×300 par le profil, ou une adresse Cloudinary. Rien d'autre ne passe.
function photoPublique(u){
  const p=String((u&&u.athletePhoto)||'');
  if(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/.test(p)&&p.length<=80000) return p;
  if(/^https:\/\/res\.cloudinary\.com\/[^\s"'<>]+$/.test(p)&&p.length<=500) return p;
  return '';
}
function pageMontrerDefaut(){ const o={}; PAGE_MONTRER.forEach(x=>{ o[x.cle]=x.defaut; }); return o; }
// La proposition au passage de rang n'a de sens que si l'app écrit dans la base.
const PAGE_PUBLIQUE_PROPOSEE=true;
function _pagesSurFirebase(){ return /\/i$/.test(String(RC_LIEN_COURT||'')); }
// PURE. L'adresse de la page de quelqu'un, ou '' s'il n'en a pas (encore).
function urlPagePerso(u){
  if(!u) return '';
  const base=String(RC_URL_VITRINE||'').replace(/\/$/,'');
  const fb=_pagesSurFirebase();
  if(u.role==='coach'){
    const s=u.vitrineSlug;
    if(!u.vitrinePubliee||!SLUG_PUBLIC_RE.test(s||'')) return '';
    return fb?base+'/coach/'+s:base+'/c/?s='+s;
  }
  const p=u.pagePublique;
  if(!p||!p.active||!PSEUDO_PUBLIC_RE.test(p.pseudo||'')) return '';
  return fb?base+'/@'+p.pseudo:base+'/p/?u='+p.pseudo;
}
// LE LIEN PERSO (idée 16) : la page de la personne — ou, faute de page, le
// lien court —, avec son code de parrainage (ref) et le type de visuel qui l'a
// fait circuler (src). `src` : 'seance', 'rang', 'bio', 'qr'…
function lienPerso(src,u){
  const x=u||((typeof currentUser!=='undefined')?currentUser:null);
  const page=urlPagePerso(x)||String(RC_LIEN_COURT||'');
  // src, ref : posés par lienAttribue, la seule fonction qui le fait.
  return lienAttribue(page,{src,ref:x&&x.parrainage&&x.parrainage.code});
}
// L'adresse du QR de la carte « Séance du jour » : le lien perso.
function urlQrSeance(){ return lienPerso('qr')||RC_URL_VITRINE; }
// PURE. Le type d'un visuel, lu dans son nom de fichier (repcore-seance.png,
// repcore-cycle-rouge.jpg…) : c'est le `src` du lien copié à sa sortie.
function srcDuVisuel(nomFichier){
  const m=/^repcore-([a-z]+)/i.exec(String(nomFichier||''));
  return m?m[1].toLowerCase():'visuel';
}
// ── Le tuto du sticker Lien : trois images fixes, une fois ─────────────────
const TUTO_STICKER_CLE='rc_tuto_sticker';
function htmlTutoSticker(){
  const url=escapeHtml(String(lienPerso('story')||'repcore…').replace(/^https?:\/\//,'').slice(0,34));
  const e=(n,titre,dessin)=>'<figure class="tsk-etape" style="--i:'+(n-1)+'"><div class="tsk-tel">'+dessin+'</div>'
    +'<figcaption><b>'+n+'</b> '+titre+'</figcaption></figure>';
  return '<div class="tsk-carte" role="dialog" aria-modal="true" aria-labelledby="tsk-h" onclick="event.stopPropagation()">'
    +'<h2 id="tsk-h">Ton lien, dans ta story</h2>'
    +'<p class="tsk-sous">Il est copié. Instagram ne lit pas les liens posés sur une image : c’est le sticker Lien qui les rend cliquables.</p>'
    +'<div class="tsk-etapes">'
    +e(1,'Touche l’icône <i>Sticker</i>','<div class="tsk-barre"><span>Aa</span><span class="tsk-on">☺</span><span>♫</span><span>✦</span></div><div class="tsk-img"></div>')
    +e(2,'Choisis <i>Lien</i>','<div class="tsk-grille"><span>LIEU</span><span class="tsk-on">LIEN</span><span>@ MENTION</span><span># HASHTAG</span></div>')
    +e(3,'Colle, et c’est fini','<div class="tsk-champ"><small>URL</small><span class="tsk-on">'+url+'</span></div><div class="tsk-ok">Terminé</div>')
    +'</div><button type="button" class="btn btn-red" style="width:100%;margin:14px 0 0;min-height:46px" onclick="fermerTutoSticker()">Compris</button></div>';
}
function montrerTutoSticker(force){
  try{ if(!force&&localStorage.getItem(TUTO_STICKER_CLE)) return false; localStorage.setItem(TUTO_STICKER_CLE,String(Date.now())); }catch(e){}
  if(document.getElementById('tuto-sticker')) return false;
  const z=document.createElement('div');
  z.id='tuto-sticker'; z.className='tsk-fond';
  z.innerHTML=htmlTutoSticker();
  z.addEventListener('click',fermerTutoSticker);
  z.addEventListener('keydown',ev=>{ if(ev.key==='Escape') fermerTutoSticker(); });
  document.body.appendChild(z);
  try{ z.querySelector('.btn').focus({preventScroll:true}); }catch(e){}
  return true;
}
function fermerTutoSticker(){ const z=document.getElementById('tuto-sticker'); if(z) z.remove(); return true; }
// ── La page d'un athlète ───────────────────────────────────────────────────
// PURE. Les derniers records : l'exercice et la date. JAMAIS LA CHARGE. Un
// exercice n'y paraît qu'une fois (son record le plus récent).
function recordsRecentsPublics(u,n){
  const ses=((u&&u.sessions)||[]).filter(s=>s&&s.date>0).slice().sort((a,b)=>a.date-b.date);
  const meilleur={}, vus=[];
  const cle=nm=>{ try{ return resoudreAlias(exKey(nm)); }catch(e){ return String(nm); } };
  for(const s of ses){
    const exos=(s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
      ?Object.keys(s.data).map(nm=>({nom:nm,sets:((s.data[nm]||{}).sets)||[]}))
      :((s.exercises)||[]).filter(e=>e&&(e.name||e.nm)).map(e=>({nom:e.name||e.nm,sets:e.sets||[]}));
    for(const e of exos){
      let cur=0;
      for(const st of e.sets){ if(!st||st.done===false) continue; const w=parseFloat(st.weight)||0; if(w>cur) cur=w; }
      if(!cur) continue;
      const k=cle(e.nom), h=meilleur[k]||0;
      if(h>0&&cur>h) vus.push({k,exo:String(e.nom).trim().slice(0,60),date:Number(s.date)});
      if(cur>h) meilleur[k]=cur;
    }
  }
  const out=[], deja={};
  for(let i=vus.length-1;i>=0&&out.length<(n||5);i--){
    if(deja[vus[i].k]) continue;
    deja[vus[i].k]=1; out.push({exo:vus[i].exo,date:vus[i].date});
  }
  return out;
}
// PURE. Les 3 meilleurs records : la plus lourde charge de chaque exercice
// (séries faites), les trois plus lourdes, avec la date où elle a été
// soulevée. Publiés SEULEMENT si l'athlète l'a choisi (montrer.meilleurs).
function meilleursRecordsPublics(u,n){
  const best={};
  const cle=nm=>{ try{ return resoudreAlias(exKey(nm)); }catch(e){ return String(nm); } };
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!(s.date>0)) continue;
    const exos=(s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
      ?Object.keys(s.data).map(nm=>({nom:nm,sets:((s.data[nm]||{}).sets)||[]}))
      :((s.exercises)||[]).filter(e=>e&&(e.name||e.nm)).map(e=>({nom:e.name||e.nm,sets:e.sets||[]}));
    for(const e of exos){
      for(const st of e.sets){
        if(!st||st.done===false) continue;
        const w=parseFloat(st.weight)||0;
        if(!(w>0)||w>1000) continue;
        const k=cle(e.nom);
        if(!best[k]||w>best[k].kg||(w===best[k].kg&&s.date<best[k].date))
          best[k]={exo:String(e.nom).trim().slice(0,60),kg:Math.round(w*100)/100,date:Number(s.date)};
      }
    }
  }
  return Object.values(best).sort((a,b)=>b.kg-a.kg||a.date-b.date).slice(0,n||3);
}
// PURE. Les 12 dernières semaines calendaires, de la plus ancienne à celle en
// cours : '1' validée (le quota du programme atteint), '0' manquée, 'e' la
// semaine en cours pas encore validée (elle n'est pas perdue).
function semainesPubliques(u,maintenant,n){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const N=n||12;
  let quota=1; try{ quota=seancesPrevuesParSemaine(u); }catch(e){ quota=1; }
  const l0=_lundiDe(t).getTime();
  const cpt={};
  for(const s of ((u&&u.sessions)||[])){
    if(!s||!(s.date>0)||s.date>t) continue;
    const l=_lundiDe(s.date).getTime();
    cpt[l]=(cpt[l]||0)+1;
  }
  let out='';
  for(let i=N-1;i>=0;i--){
    const l=_lundiDe(_datePlusJours(l0,-7*i).getTime()).getTime();
    const ok=(cpt[l]||0)>=quota;
    out+=ok?'1':(i===0?'e':'0');
  }
  return out;
}
// PURE. Les volts : le total, le seuil du rang atteint et celui du suivant
// (0 au rang maximal) — la jauge de la page.
function voltsPublics(u){
  const r=rangDe(xpDe(u));
  return {xp:Math.max(0,Math.round(r.xp)),de:Math.max(0,Math.round(Number(r.rang.seuil)||0)),a:r.suivant?Math.round(Number(r.suivant.seuil)||0):0};
}
// PURE. Ce que la page montre — et RIEN d'autre : la liste blanche des règles
// n'accepte que ces champs-là.
function pagePubliqueDonnees(u,montrer,maintenant){
  const m=montrer||{}, t=(typeof maintenant==='number')?maintenant:Date.now();
  const pp=(u&&u.pagePublique)||{};
  const o={prenom:String((u&&u.fname)||pp.pseudo||'').replace(/\s+/g,' ').trim().slice(0,24),maj:t};
  if(m.rang){ try{ const r=rangDe(xpDe(u)); o.rang={n:r.rang.n,nom:r.rang.nom}; o.volts=voltsPublics(u); }catch(e){} }
  if(m.serie){
    try{ o.serie=Math.max(0,Math.min(999,streakSemaines(u)||0)); }catch(e){}
    try{ o.semaines=semainesPubliques(u,t,12); }catch(e){}
  }
  if(m.seances) o.seances=Math.min(99999,((u&&u.sessions)||[]).filter(s=>s&&s.date>0).length);
  // LES BADGES EN IMAGES : le visuel dessiné, et le médaillon de repli (qui
  // existe toujours) — la page tente l'un puis l'autre, comme l'app.
  if(m.badges){
    try{
      const b=badgesObtenus(u).sort((a,x)=>x.at-a.at).slice(0,12)
        .map(x=>{ const d=badgeAcquisDef(x.id); if(!d) return null;
          const o2={id:String(d.id).slice(0,40),nom:String(d.nom).slice(0,40)};
          const img=String(badgeVisuel(d.id,false)||''), rp=String(badgeAcquisFichier(d.id)||'');
          if(/^img\/badges\/[a-z0-9_-]+\.(webp|png)$/.test(img)) o2.img=img;
          if(/^img\/badges\/[a-z0-9_-]+\.(webp|png)$/.test(rp)) o2.repli=rp;
          if(d.famille==='secret') o2.secret=true;
          return o2; }).filter(Boolean);
      if(b.length) o.badges=b;
    }catch(e){}
  }
  if(m.meilleurs){ const r=meilleursRecordsPublics(u,3); if(r.length) o.meilleurs=r; }
  if(m.stats){ try{ const st=statsPubliques(u); if(st.depuis||st.tonnage||st.series) o.chiffres=st; }catch(e){} }
  if(m.photo){ const ph=photoPublique(u); if(ph) o.photo=ph; }
  // LA CARTE D'ATHLÈTE, en vignette : les notes, jamais le poids qui les fonde.
  if(m.carte){
    try{
      const c=(u&&u.carte)||noteAthlete(u,t);
      const v={g:c.globale,c:c.cadre};
      for(const k of CARTE_NOTES) v[k]=c[k];
      o.carte=v;
    }catch(e){}
  }
  const c=u&&u.parrainage&&u.parrainage.code;
  if(typeof parrainageCodeValide==='function'&&parrainageCodeValide(c)) o.ref=c;
  return o;
}
function pseudoPublicNormalise(p){ return String(p||'').trim().replace(/^@/,'').toLowerCase(); }
// LA CLÉ EN BASE. Firebase refuse le point dans une clé : « kevin.gllc »
// faisait échouer toute la requête, affichée « déjà pris » (28/09/2026). Le
// point devient « __ » en base — des caractères que les règles acceptent
// déjà, sans redéploiement ; l'adresse publique garde le point
// (/@kevin.gllc). Sans ambiguïté parce qu'un NOUVEAU pseudo ne peut pas
// enchaîner deux signes (« __ », « ._ », « .. ») : un « __ » en base vient
// donc toujours d'un point.
function pseudoPublicCle(p){ return String(p||'').replace(/\./g,'__'); }
const PSEUDO_SIGNES_DOUBLES_RE=/[._]{2}/;
// Ce que les règles du 26/09 acceptaient : si la base n'a pas encore les
// règles du 28/09 (volts, 12 semaines, badges en images), la page part quand
// même, avec ces champs-là seulement.
function pagePubliqueDonneesMinimales(d){
  if(!d) return d;
  const o={};
  ['prenom','rang','serie','seances','ref','maj'].forEach(k=>{ if(d[k]!=null) o[k]=d[k]; });
  if(Array.isArray(d.badges)) o.badges=d.badges.map(b=>({id:b.id,nom:b.nom}));
  return o;
}
// Publie, déplace ou éteint la page. Rend {ok, erreur?}.
async function publierPagePublique(u,reg,o){
  if(!u||!u.email||u.role==='coach') return {ok:false,erreur:'Réservé aux athlètes.'};
  const neu=pseudoPublicNormalise(reg&&reg.pseudo);
  if(!PSEUDO_PUBLIC_RE.test(neu)) return {ok:false,erreur:'Pseudo : 3 à 20 caractères, lettres minuscules, chiffres, point ou tiret bas.'};
  const moi=u.email.replace(/\./g,',');
  const ancien=(u.pagePublique||{}).pseudo;
  if(neu!==ancien&&PSEUDO_SIGNES_DOUBLES_RE.test(neu))
    return {ok:false,erreur:'Pseudo : pas deux points ou tirets bas à la suite.'};
  const kA=pseudoPublicCle(ancien), kN=pseudoPublicCle(neu);
  if(kN.length>20) return {ok:false,erreur:'Pseudo trop long : enlève un point ou quelques lettres.'};
  const patch={};
  if(ancien&&ancien!==neu){ patch['pseudos/'+kA]=null; patch['profils_publics/'+kA]=null; }
  patch['pseudos/'+kN]=moi;
  const donnees=reg.active?pagePubliqueDonnees(u,reg.montrer):null;
  patch['profils_publics/'+kN]=donnees;
  let st=await CLOUD.racinePatchStatut(patch).catch(()=>0);
  // Des règles en ligne plus anciennes que l'app refusent les champs récents :
  // on retire d'abord photo et chiffres (règles du 28/09), puis on retombe sur
  // celles du 26/09.
  const replis=donnees?[Object.assign({},donnees,{photo:undefined,chiffres:undefined}),pagePubliqueDonneesMinimales(donnees)]:[];
  for(const d of replis){
    if(!(st===401||st===403)) break;
    patch['profils_publics/'+kN]=JSON.parse(JSON.stringify(d));
    st=await CLOUD.racinePatchStatut(patch).catch(()=>0);
  }
  if(st===401||st===403) return {ok:false,erreur:'Ce pseudo est déjà pris.'};
  if(st===0) return {ok:false,erreur:'Connexion perdue : vérifie ta connexion, ou déconnecte-toi puis reconnecte-toi.'};
  if(!(st>=200&&st<300)) return {ok:false,erreur:'Enregistrement impossible (erreur '+st+'). Réessaie dans un instant.'};
  u.pagePublique={pseudo:neu,active:!!reg.active,montrer:Object.assign({},reg.montrer||{}),publieLe:Date.now()};
  if(!(o&&o.silencieux)) try{ saveUser(); }catch(e){}
  return {ok:true};
}
// La page suit l'athlète : après une séance, et au plus toutes les six heures
// depuis l'accueil. Silencieuse, sans toast.
async function majPagePublique(o){
  const u=currentUser, p=u&&u.pagePublique;
  if(!p||!p.active||!PSEUDO_PUBLIC_RE.test(p.pseudo||'')||!CLOUD.ok()) return false;
  if(!(o&&o.force)&&Date.now()-(Number(p.publieLe)||0)<6*3600e3) return false;
  const r=await publierPagePublique(u,{pseudo:p.pseudo,active:true,montrer:pageMontrerComplet(p.montrer)},{silencieux:true});
  if(r.ok) try{ saveUser(); }catch(e){}
  return r.ok;
}
// PURE. Le bloc des réglages, dans le profil.
function htmlReglagesPagePublique(u){
  const p=(u&&u.pagePublique)||{};
  const m=pageMontrerComplet(p.montrer);
  const dom=_pagesSurFirebase()?String(RC_URL_VITRINE).replace(/^https?:\/\//,'').replace(/\/$/,'')+'/@':'…/p/?u=';
  const cases=PAGE_MONTRER.map(x=>'<label class="pp-case"><input type="checkbox" data-montrer="'+x.cle+'"'+(m[x.cle]?' checked':'')+'> <span>'+escapeHtml(x.lib)+'</span></label>').join('');
  const url=urlPagePerso(u);
  return '<div class="card pp-carte"><div class="pp-titre">Ma page publique</div>'
    +'<p class="pp-sous">Une page à mettre dans ta bio : ton rang, ta régularité, tes badges. Jamais de poids, de photos ni de données de santé.</p>'
    +'<label for="pp-pseudo" class="pp-lab">Ton pseudo</label>'
    // L'ADRESSE EN DEUX PARTIES (Kevin, 28/09/2026) : le début, fixe, en rouge
    // et hors d'atteinte du doigt ; la case du pseudo, seule chose à écrire.
    +'<div class="pp-url pp-url-2"><span class="pp-url-pre" aria-hidden="true">'+escapeHtml(dom)+'</span><input id="pp-pseudo" type="text" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" value="'+escapeHtml(p.pseudo||'')+'" placeholder="ton.pseudo" aria-label="Ton pseudo, après '+escapeHtml(dom)+'"></div>'
    +'<label class="pp-case pp-active"><input type="checkbox" id="pp-active"'+(p.active?' checked':'')+'> <span><b>Activer ma page</b></span></label>'
    +'<div class="pp-montrer"><div class="pp-lab">Ce qu’elle montre</div>'+cases+'</div>'
    +'<div id="pp-etat" class="pp-etat" aria-live="polite">'+(url?'En ligne : '+escapeHtml(url.replace(/^https?:\/\//,'')):(p.pseudo?'Page désactivée.':''))+'</div>'
    // Trois gestes, du plus fort au plus léger : enregistrer (rouge), voir sa
    // page (cadre blanc, seulement quand elle est en ligne), copier le lien.
    +'<button type="button" class="btn btn-red btn-sm btn-casse" style="width:100%;margin:10px 0 8px;min-height:44px" onclick="enregistrerPagePublique(this)">Enregistrer ma page</button>'
    +(url?'<a class="btn btn-sm pp-voir" href="'+escapeHtml(url)+'" target="_blank" rel="noopener">Visualiser ma page</a>':'')
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:0;min-height:44px" onclick="copierLienBio(this)">Copier mon lien pour ma bio Instagram</button></div>';
}
// ── LA PROPOSITION, À UN PASSAGE DE RANG (28/09/2026) ────────────────────
// Le moment où l'athlète a quelque chose à montrer : l'écran du nouveau rang
// propose la page, pseudo pré-rempli, en UN geste. Ignorée, elle revient une
// fois, au rang suivant ; puis plus jamais (le profil garde le réglage).
// PURE.
function pagePropositionDue(u,rang){
  if(!u||u.role==='coach'||!u.email) return false;
  if(u.pagePublique&&u.pagePublique.active) return false;
  const pr=(u.pagePropose&&typeof u.pagePropose==='object')?u.pagePropose:{};
  const fois=Number(pr.fois)||0;
  if(fois>=2) return false;
  if(fois===1&&!(Number(rang)>(Number(pr.rang)||0))) return false;
  return true;
}
// PURE. Le pseudo proposé : celui déjà choisi, sinon le prénom, sans accent.
function pseudoSuggere(u){
  const deja=pseudoPublicNormalise(u&&u.pagePublique&&u.pagePublique.pseudo);
  if(PSEUDO_PUBLIC_RE.test(deja)) return deja;
  let x=String((u&&(u.fname||u.pseudo))||'');
  try{ x=x.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }catch(e){}
  x=x.toLowerCase().replace(/\s+/g,'.').replace(/[^a-z0-9._]/g,'').replace(/^[._]+|[._]+$/g,'').slice(0,20).replace(/[._]+$/,'');
  if(x.length<3) x=(x+'.repcore').replace(/^[._]+/,'').slice(0,20);
  return PSEUDO_PUBLIC_RE.test(x)?x:'athlete.repcore';
}
function htmlPropositionPage(u){
  const dom=_pagesSurFirebase()?String(RC_URL_VITRINE).replace(/^https?:\/\//,'').replace(/\/$/,'')+'/@':'…/p/?u=';
  return '<div class="pp-prop" id="pp-prop">'
    +'<div class="pp-prop-t">Ta page, pour ta bio</div>'
    +'<p class="pp-prop-s">Ton emblème, tes volts, tes semaines et tes badges. Jamais de poids, de photo ni de santé.</p>'
    +'<div class="pp-url"><span>'+escapeHtml(dom)+'</span><input id="pp-prop-pseudo" type="text" maxlength="20" autocapitalize="none" autocomplete="off" spellcheck="false" value="'+escapeHtml(pseudoSuggere(u))+'" aria-label="Ton pseudo"></div>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse pp-prop-b" onclick="activerPageDepuisRang(this)">Mettre ma page en ligne</button>'
    +'</div>';
}
// Le passage est noté À L'AFFICHAGE : c'est « proposée », pas « acceptée ».
function _noterPropositionPage(u,rang){
  u.pagePropose={fois:(Number(u.pagePropose&&u.pagePropose.fois)||0)+1,rang:Number(rang)||0,le:Date.now()};
  try{ saveUser(); }catch(e){}
}
// UN GESTE : le pseudo du champ, les choix par défaut (charges exclues). Pris
// par quelqu'un d'autre : deux chiffres ajoutés, trois essais.
async function activerPageDepuisRang(btn){
  const u=currentUser; if(!u) return false;
  if(!CLOUD.ok()){ toast('Impossible hors connexion','var(--orange)'); return false; }
  const champ=document.getElementById('pp-prop-pseudo');
  const voulu=pseudoPublicNormalise(champ?champ.value:pseudoSuggere(u));
  if(btn){ btn.disabled=true; btn.textContent='Mise en ligne…'; }
  let r=null, ps=voulu;
  for(let i=0;i<4;i++){
    ps=i?(voulu.slice(0,17)+'.'+String(10+Math.floor(Math.random()*90))):voulu;
    r=await publierPagePublique(u,{pseudo:ps,active:true,montrer:pageMontrerDefaut()});
    if(r.ok||!/déjà pris/.test(r.erreur||'')) break;
  }
  const z=document.getElementById('pp-prop');
  if(!r||!r.ok){
    if(btn){ btn.disabled=false; btn.textContent='Mettre ma page en ligne'; }
    toast((r&&r.erreur)||'Mise en ligne impossible','var(--orange)');
    return false;
  }
  if(z) z.innerHTML='<div class="pp-prop-t">Ta page est en ligne '+icon('eclair',14)+'</div>'
    +'<p class="pp-prop-s">'+escapeHtml(urlPagePerso(u).replace(/^https?:\/\//,''))+'</p>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse pp-prop-b" onclick="copierLienBio(this)">Copier mon lien pour ma bio Instagram</button>';
  return true;
}
function _rendrePagePublique(){
  try{ const zc=document.getElementById('atp-celebrations'); if(zc) zc.innerHTML=htmlReglageCelebrations(currentUser); }catch(e){}
  const z=document.getElementById('atp-page');
  if(!z) return;
  if(!currentUser||currentUser.role==='coach'){ z.innerHTML=''; return; }
  z.innerHTML=htmlReglagesPagePublique(currentUser);
}
async function enregistrerPagePublique(btn){
  if(!currentUser) return false;
  if(!CLOUD.ok()){ toast('Impossible hors connexion','var(--orange)'); return false; }
  const montrer={};
  document.querySelectorAll('#atp-page [data-montrer]').forEach(c=>{ montrer[c.dataset.montrer]=!!c.checked; });
  const reg={pseudo:document.getElementById('pp-pseudo')?.value,active:!!document.getElementById('pp-active')?.checked,montrer};
  if(btn){ btn.disabled=true; btn.textContent='Enregistrement…'; }
  const r=await publierPagePublique(currentUser,reg);
  if(btn){ btn.disabled=false; btn.textContent='Enregistrer ma page'; }
  if(!r.ok){ toast(r.erreur,'var(--orange)'); const e=document.getElementById('pp-etat'); if(e) e.textContent=r.erreur; return false; }
  toast(reg.active?'Ta page est en ligne '+ICO.eclair:'Ta page est désactivée.');
  _rendrePagePublique();
  return true;
}
// Le lien de la bio : la page (ou le lien court), avec le code et src=bio.
function copierLienBio(btn){
  const l=lienPerso('bio');
  if(!l) return false;
  const lib=btn?btn.textContent:'';
  const fait=()=>{ try{ attribCompter('copie','bio'); }catch(e){}
    toast('Lien copié · colle-le dans ta bio : Modifier le profil > Liens','var(--green)',4000);
    if(btn){ _texteIco(btn,'Lien copié '+ICO.coche); setTimeout(()=>{ btn.textContent=lib; },2000); } };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(l).then(fait,()=>toast(l)); return true; } }catch(e){}
  toast(l);
  return false;
}
// ══ LOT C6 : LE PARCOURS DU PROSPECT (29/09/2026) ═════════════════════════
//
// La vitrine publique (/coach/<slug>, c/index.html) porte les formules que le
// coach coche ici, avec pour chacune « Ça m'intéresse » : un prénom et un
// moyen de contact, et le serveur léger crée le prospect chez le coach
// (prospects/<coach>, cloudflare/src/prospects.js). La personne lit aussitôt
// le message d'accueil du coach. Sans réponse sous 48 h, c'est le COACH que
// le serveur relance.
//
// ⚠ LES PRIX NE SONT JAMAIS RECOPIÉS. La vitrine publie des CLÉS de formules ;
//   la page lit le prix, la durée et ce que la formule comprend dans
//   tarifs.json, le tableau des offres (OFFRES ici en est la copie).
// ⚠ AUCUN PAIEMENT. Répondre, fixer le premier échange, encaisser : c'est le
//   coach, hors de l'app. Rien de ça ne s'automatise.
// ⚠ TROIS CHIFFRES, pas un tableau de bord : les visites de la page, les
//   « ça m'intéresse », ceux qui sont devenus athlètes. Sur trente jours.

const VITRINE_FORMULES=Object.freeze(['programme_perso','revision_prog','coaching_essentiel','coaching_transfo','coaching_evolution']);
const PROSPECT_ACCUEIL_MAX=600;
const PROSPECT_ACCUEIL_DEFAUT='Merci {prénom} ! J’ai bien reçu ta demande. Je te réponds sous 48 h, par le moyen que tu m’as laissé, pour qu’on fixe un premier échange. Rien n’est à payer d’ici là.';
const PROSPECT_STATUT_LIB=Object.freeze({nouveau:'Attend ta réponse',repondu:'Tu as répondu',athlete:'Devenu athlète',sans_suite:'Sans suite'});
const PROSPECT_FENETRE_J=30;

// PURE. Les formules cochées par le coach, dans l'ordre du tableau.
function vitrineFormulesDe(u){
  const l=Array.isArray(u&&u.vitrineFormules)?u.vitrineFormules:[];
  return VITRINE_FORMULES.filter(k=>l.indexOf(k)>=0&&OFFRES[k]);
}
// PURE. Le message d'accueil, borné ; le défaut si le coach n'a rien écrit.
function prospectAccueilDe(u){
  const s=String((u&&u.prospectAccueil)||'').replace(/\s+\n/g,'\n').trim().slice(0,PROSPECT_ACCUEIL_MAX);
  return s||PROSPECT_ACCUEIL_DEFAUT;
}
// PURE. La durée d'une formule, comme la page publique l'écrit.
function formuleDuree(k){
  const o=OFFRES[k]; if(!o) return '';
  if(k==='revision_prog') return 'à la demande';
  if(k==='programme_perso') return 'une fois, '+o.mois+' mois d’app inclus';
  return o.mois+' mois de suivi';
}
// PURE. Les trois chiffres, sur trente jours glissants.
//   prospects : prospects/<coach> (brut) ; stats : vitrines_stats/<slug> {AAAA-MM-JJ: n}
function prospectsMesure(prospects,stats,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const debut=t-PROSPECT_FENETRE_J*864e5;
  const jour0=localISODate(new Date(debut));
  let vues=0;
  const s=(stats&&typeof stats==='object')?stats:{};
  for(const j of Object.keys(s)) if(/^\d{4}-\d{2}-\d{2}$/.test(j)&&j>=jour0) vues+=Math.max(0,Math.round(Number(s[j])||0));
  const l=prospectsListe(prospects).filter(p=>Number(p.at)>=debut);
  return {vues,interesses:l.length,athletes:l.filter(p=>p.statut==='athlete').length,
    enAttente:prospectsListe(prospects).filter(p=>(p.statut||'nouveau')==='nouveau').length};
}
// PURE. La liste, récente d'abord.
function prospectsListe(brut){
  const o=(brut&&typeof brut==='object')?brut:{};
  return Object.keys(o).map(id=>Object.assign({id},o[id])).filter(p=>p&&Number(p.at)>0).sort((a,b)=>Number(b.at)-Number(a.at));
}
// PURE. Le lien pour répondre : WhatsApp pour un numéro, un e-mail sinon. Le
// texte est un début, le coach le finit dans son application.
function prospectLienReponse(p,coach){
  const pr=String((p&&p.prenom)||'').trim();
  const moi=String((coach&&coach.fname)||'').trim();
  const lib=(OFFRES[p&&p.formule]||{}).lib||'ma formule';
  const txt='Salut '+pr+', c’est '+(moi||'ton coach')+' ! Merci pour ton intérêt pour '+lib+'. Quand es-tu disponible pour qu’on en parle quelques minutes ?';
  if(p&&p.canal==='tel') return 'https://wa.me/'+String(p.contact||'').replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(txt);
  if(p&&p.canal==='email') return 'mailto:'+encodeURIComponent(String(p.contact||''))+'?subject='+encodeURIComponent('Ton coaching avec '+(moi||'moi'))+'&body='+encodeURIComponent(txt);
  return '';
}

// ── Les réglages, dans l'identité de la team ──────────────────────────────
function htmlReglagesProspects(u){
  const f=vitrineFormulesDe(u), E=escapeHtml;
  return '<div class="pr-reg"><div class="pp-lab">Mes formules sur ma page</div>'
    +'<p class="sub pr-p">Coche celles que tu proposes. Le prix, la durée et ce qu’elles comprennent viennent du tableau des offres : tu n’as rien à recopier. Aucun paiement sur la page, la personne te laisse juste son contact.</p>'
    +VITRINE_FORMULES.map(k=>{ const o=OFFRES[k]; return '<label class="pr-f"><input type="checkbox" data-formule="'+k+'"'+(f.indexOf(k)>=0?' checked':'')+'>'
      +'<span><b>'+E(o.lib)+'</b> '+E(prixOffre(k))+' · '+E(formuleDuree(k))+'</span></label>'; }).join('')
    +'<label class="pr-lab" for="coach-prospect-accueil">Le message qu’on lit après « Ça m’intéresse »</label>'
    +'<textarea id="coach-prospect-accueil" rows="4" maxlength="'+PROSPECT_ACCUEIL_MAX+'" placeholder="'+E(PROSPECT_ACCUEIL_DEFAUT)+'">'+E(String((u&&u.prospectAccueil)||''))+'</textarea>'
    +'<div class="sub pr-p">Dis ce qui se passe ensuite, et sous quel délai. {prénom} est remplacé par le prénom de la personne. Laissé vide, c’est le message proposé qui s’affiche.</div>'
    +'<div id="coach-paiement">'+htmlReglagePaiementCoach(u)+'</div></div>';
}
function _rendreReglagesProspects(){
  const z=document.getElementById('coach-formules');
  if(!z||!currentUser||currentUser.role!=='coach') return false;
  if(z.dataset.dirty) return false;
  z.innerHTML=htmlReglagesProspects(currentUser);
  z.addEventListener('input',e=>{ if(e.target&&e.target.id!=='coach-marchand') z.dataset.dirty='1'; });
  if(pcPalierOk(currentUser)) _pcChargerEtat().catch(()=>{});
  return true;
}
// Lu par saveCoachIdentity, comme les autres champs de l'identité.
function _lireReglagesProspects(){
  const z=document.getElementById('coach-formules');
  if(!z||!z.querySelector('[data-formule]')) return false;
  currentUser.vitrineFormules=[...z.querySelectorAll('[data-formule]')].filter(c=>c.checked).map(c=>c.dataset.formule).filter(k=>VITRINE_FORMULES.indexOf(k)>=0);
  const a=document.getElementById('coach-prospect-accueil');
  if(a) currentUser.prospectAccueil=String(a.value||'').trim().slice(0,PROSPECT_ACCUEIL_MAX);
  delete z.dataset.dirty;
  return true;
}

// ── L'entrée sur l'accueil du coach, et l'écran ───────────────────────────
let _prBrut=null, _prStats=null, _prLu=0;
async function _prCharger(force){
  if(!force&&_prBrut&&Date.now()-_prLu<3*60e3) return;
  const moi=String((currentUser&&currentUser.email)||'').replace(/\./g,',');
  if(!moi) return;
  const slug=currentUser.vitrineSlug;
  const [a,b]=await Promise.all([_fbJson('prospects/'+moi),slug?_fbJson('vitrines_stats/'+slug):Promise.resolve({ok:true,v:null})]);
  if(a.ok) _prBrut=a.v||{};
  if(b.ok) _prStats=b.v||{};
  _prLu=Date.now();
}
function renderEntreeProspects(){
  const z=document.getElementById('ch-prospects');
  if(!z||!currentUser||currentUser.role!=='coach') return false;
  if(!vitrineFormulesDe(currentUser).length&&!_prBrut){ z.innerHTML=''; if(!_prLu) _prCharger().then(()=>{ if(_prBrut&&Object.keys(_prBrut).length) renderEntreeProspects(); }).catch(()=>{}); return false; }
  const m=prospectsMesure(_prBrut,_prStats);
  z.innerHTML='<button type="button" class="rel-entree pr-entree" onclick="ouvrirProspects()">'
    +'<span class="rel-entree-t">Ma page</span>'
    +'<span class="rel-entree-e">'+m.vues+' visite'+(m.vues>1?'s':'')+' · '+m.interesses+' intéressé'+(m.interesses>1?'s':'')+' · '+m.athletes+' athlète'+(m.athletes>1?'s':'')
    +(m.enAttente?' · <b>'+m.enAttente+' attend'+(m.enAttente>1?'ent':'')+' ta réponse</b>':'')+'</span></button>';
  if(!_prLu) _prCharger().then(()=>renderEntreeProspects()).catch(()=>{});
  return true;
}
function ouvrirProspects(){
  go('s-coach-prospects');
  renderProspects();
  _prCharger(true).then(()=>{ renderProspects(); renderEntreeProspects(); }).catch(()=>{});
}
function _prJour(t){ try{ return new Date(t).toLocaleDateString('fr-FR',{day:'numeric',month:'long'}); }catch(e){ return ''; } }
function renderProspects(){
  const z=document.getElementById('pr-corps');
  if(!z||!currentUser) return false;
  const E=escapeHtml;
  const m=prospectsMesure(_prBrut,_prStats);
  let h='<div class="pr-chiffres">'
    +'<div><b>'+m.vues+'</b><span>visite'+(m.vues>1?'s':'')+'</span></div>'
    +'<div><b>'+m.interesses+'</b><span>intéressé'+(m.interesses>1?'s':'')+'</span></div>'
    +'<div><b>'+m.athletes+'</b><span>devenu'+(m.athletes>1?'s':'')+' athlète'+(m.athletes>1?'s':'')+'</span></div></div>'
    +'<p class="sub pr-p">Sur les trente derniers jours. C’est ce qui dit si ta page travaille.</p>';
  if(!vitrineFormulesDe(currentUser).length)
    h+=emptyState('','Ta page ne propose encore aucune formule. Coche-les dans ton profil, rubrique « Mes formules sur ma page » : le bouton « Ça m’intéresse » apparaît sous chacune.',null,null,'padding:16px 8px');
  const l=prospectsListe(_prBrut);
  if(!_prBrut) h+='<div class="sub pr-p">Lecture…</div>';
  else if(!l.length) h+=emptyState('','Personne n’a encore laissé son contact. Partage le lien de ta page dans ta bio : chaque « Ça m’intéresse » arrive ici, et tu es prévenu.',null,null,'padding:16px 8px');
  else h+=l.map(p=>{
    const st=p.statut||'nouveau', lien=prospectLienReponse(p,currentUser), id=E(p.id);
    return '<div class="pr-l pr-'+st+'"><div class="pr-l-h"><b>'+E(p.prenom||'')+'</b><span>'+E(st==='athlete'&&p.codeId?'Invité':(PROSPECT_STATUT_LIB[st]||st))+'</span></div>'
      +'<div class="pr-l-d">'+E((OFFRES[p.formule]||{}).lib||'')+' · '+E(_prJour(Number(p.at)))+' · '+E(p.contact||'')+'</div>'
      +'<div class="pr-l-b">'
      +(lien?'<a class="btn btn-outline btn-sm" href="'+safeUrl(lien)+'" target="_blank" rel="noopener" onclick="rcmCoach(\'coach_message_envoye\');prospectStatut(\''+id+'\',\'repondu\',true)">Répondre</a>':'')
      +(pcRelie(currentUser)&&pcLienPayer(currentUser.vitrineSlug,p.formule)&&st!=='athlete'?'<button type="button" class="cp-lien" onclick="pcCopierLienPayer(\''+p.formule+'\',this)">Lien de paiement</button>':'')
      +(st==='nouveau'?'<button type="button" class="cp-lien" onclick="prospectStatut(\''+id+'\',\'repondu\')">J’ai répondu</button>':'')
      // « Inviter » : le code d'accès, prérempli, puis l'envoi (prospectInviter).
      +(st!=='athlete'?'<button type="button" class="btn btn-red btn-sm" onclick="prospectInviter(\''+id+'\')">Inviter</button>':'')
      +(st==='athlete'&&p.codeId?'<button type="button" class="cp-lien" onclick="prospectInviter(\''+id+'\')">Renvoyer l’invitation</button>':'')
      +(st!=='sans_suite'&&st!=='athlete'?'<button type="button" class="cp-lien" onclick="prospectStatut(\''+id+'\',\'sans_suite\')">Sans suite</button>':'')
      +(st!=='athlete'?'<button type="button" class="cp-lien pr-discret" onclick="prospectStatut(\''+id+'\',\'athlete\')">Marquer athlète sans inviter</button>':'')
      +'</div></div>';
  }).join('');
  z.innerHTML=h;
  return true;
}
// ── DU PROSPECT À L'ATHLÈTE INVITÉ, EN UN GESTE (30/09/2026) ────────────
// « Inviter » crée le code d'accès par le flux existant (_genAccessCode, puis
// studentCodes comme generateStudentCode), prérempli avec le prénom et le
// contact que la page a déjà normalisés (contactNet : e-mail, ou +33…). Le
// prospect passe à 'athlete' et garde codeId : l'invitation se retrouve.
// Puis la feuille propose l'envoi : WhatsApp pour un numéro, un e-mail sinon,
// et « Copier le message » toujours. RIEN NE PART SEUL : le lien s'ouvre, le
// coach envoie.
// ⚠ LA DURÉE est celle de la formule demandée (1 à 12 mois), 3 mois sinon.
// ⚠ UN CONTACT INEXPLOITABLE n'empêche pas l'invitation : seul le message à
//   copier est proposé, et la feuille le dit.
// PURE. Le contact, tel que la page l'a normalisé : {tel} ou {email}, ou null.
function prospectContactNet(p){
  const c=String((p&&p.contact)||'').trim();
  if(p&&p.canal==='tel'&&/^\+[1-9]\d{7,14}$/.test(c)) return {tel:c};
  if(p&&p.canal==='email'&&/^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(c)) return {email:c.toLowerCase()};
  return null;
}
// PURE. La durée du code : celle de la formule, bornée.
function prospectMoisInvitation(p,estCreateur){
  const m=Math.round(Number((OFFRES[p&&p.formule]||{}).mois)||0);
  const d=m>=1?m:3;
  return estCreateur?d:Math.min(CODE_MOIS_MAX_AFFILIE,d);
}
// PURE. L'entrée studentCodes, et la mise à jour du prospect.
function prospectEntreeCode(p,gen,maintenant){
  const t=Number(maintenant)||Date.now();
  const k=prospectContactNet(p)||{};
  return {entree:Object.assign({},gen.payload,{token:gen.token,usedBy:null,active:true,createdAt:t,prospectId:String(p.id||'')},
      k.tel?{athletePhone:k.tel}:{},k.email?{athleteEmail:k.email}:{}),
    maj:{statut:'athlete',finLe:t,codeId:gen.payload.codeId}};
}
const _prInvitEnCours=new Set();
async function prospectInviter(id){
  const p=(_prBrut||{})[id];
  if(!p||!currentUser) return false;
  // Déjà invité : on rouvre l'envoi, on ne crée pas un second code.
  if(p.codeId){ _prFeuilleEnvoi(p); return true; }
  if(_prInvitEnCours.has(id)) return false;
  _prInvitEnCours.add(id);
  try{
    const prenom=String(p.prenom||'').trim()||'Athlète';
    let gen;
    try{ gen=await _genAccessCode(prenom,prospectMoisInvitation(p,currentUser.email===CREATOR_EMAIL)); }
    catch(e){ toast(e.message||'Impossible de créer l’invitation : réessaie.','var(--red)'); return false; }
    const {entree,maj}=prospectEntreeCode(Object.assign({id},p),gen,Date.now());
    if(!currentUser.studentCodes) currentUser.studentCodes=[];
    currentUser.studentCodes.push(entree);
    currentUser.updatedAt=Date.now();
    const users=DB.get('users')||{}; users[currentUser.email]=currentUser;
    DB.set('users',users); DB.set('session',currentUser);
    direSiEnvoiEchoue(CLOUD.pushOne(currentUser.email,currentUser),'Cette invitation',
      'elle ne fonctionnera pas tant qu\'elle n\'est pas partie, attends d\'être en ligne avant de l\'envoyer');
    // Le prospect : statut et codeId. Un refus du serveur ne perd pas le code.
    const moi=String(currentUser.email||'').replace(/\./g,',');
    const r=await _fbJson('prospects/'+moi+'/'+id,'PATCH',maj);
    if(r&&r.ok) Object.assign(p,maj);
    else toast('Invitation créée, mais le suivi du contact n’est pas à jour : réessaie une fois en ligne.','var(--orange)');
    try{ renderProspects(); renderEntreeProspects(); }catch(e){}
    _prFeuilleEnvoi(Object.assign({},p,maj));
    return true;
  } finally { _prInvitEnCours.delete(id); }
}
// La feuille d'envoi : le lien du bon canal, et le message à copier.
function _prFeuilleEnvoi(p){
  const c=((currentUser&&currentUser.studentCodes)||[]).find(x=>x&&x.codeId===p.codeId);
  if(!c){ toast('Invitation introuvable sur cet appareil : elle est dans « Codes accès élèves ».','var(--orange)'); return false; }
  const texte=_texteInvitationAthlete(c), k=prospectContactNet(p), E=escapeHtml;
  const lien=k&&k.tel?waLink(k.tel,texte):(k&&k.email?'mailto:'+encodeURIComponent(k.email)+'?subject='+encodeURIComponent('Ton accès RepCore')+'&body='+encodeURIComponent(texte):'');
  closeModal();
  document.body.insertAdjacentHTML('beforeend','<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">'
    +'<div onclick="event.stopPropagation()" class="pr-inv" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 20px;width:100%;max-width:480px;max-height:88vh;overflow-y:auto">'
    +'<h2 style="margin-bottom:4px">Invitation prête pour '+E(String(p.prenom||'ton athlète'))+'</h2>'
    +'<p class="sub" style="font-size:var(--fs-sm);margin-bottom:10px">Son code est créé ('+E(String(c.months||''))+' mois). Envoie-lui le message : rien ne part d’ici sans toi.</p>'
    +'<div class="pr-inv-msg">'+E(texte)+'</div>'
    +(lien?'<a class="btn btn-red" href="'+safeUrl(lien)+'" target="_blank" rel="noopener" onclick="rcmCoach(\'coach_message_envoye\')" style="margin-top:12px;display:flex;align-items:center;justify-content:center;text-decoration:none">'
        +(k.tel?'Envoyer par WhatsApp':'Envoyer par e-mail')+'</a>'
      :'<div class="sub pr-inv-sans">Le contact laissé sur ta page n’est ni un numéro ni une adresse utilisable : copie le message et envoie-le par le moyen que tu as.</div>')
    +'<button type="button" class="btn btn-outline" style="margin-top:10px" onclick="_prCopierInvitation('+_attrArg(p.codeId)+')">Copier le message</button>'
    +'<button type="button" class="btn btn-outline" style="margin-top:10px" onclick="closeModal()">Fermer</button></div></div>');
  return true;
}
function _prCopierInvitation(codeId){
  const c=((currentUser&&currentUser.studentCodes)||[]).find(x=>x&&x.codeId===codeId);
  if(!c) return false;
  _rcCopierOuMontrer(_texteInvitationAthlete(c),'Message copié','Copie ce message et envoie-le :');
  return true;
}
// Le coach suit son contact : un statut et sa date, rien d'autre ne change.
async function prospectStatut(id,statut,silencieux){
  const p=(_prBrut||{})[id]; if(!p) return false;
  if(statut==='repondu'&&p.statut&&p.statut!=='nouveau') return true;
  const moi=String((currentUser&&currentUser.email)||'').replace(/\./g,',');
  const maj={statut};
  if(statut==='repondu') maj.reponduLe=Date.now(); else maj.finLe=Date.now();
  const r=await _fbJson('prospects/'+moi+'/'+id,'PATCH',maj);
  if(!r.ok){ if(!silencieux) toast('Non enregistré : réessaie une fois en ligne.','var(--orange)'); return false; }
  Object.assign(p,maj);
  renderProspects(); renderEntreeProspects();
  return true;
}

// ══ LE PAIEMENT DIRECT AU COACH (29/09/2026) ══════════════════════════════
//
// Un coach relié (palier Coach ou Pro) encaisse SES formules sur SON compte
// PayPal : RepCore crée la commande, PayPal verse au coach. Le serveur léger
// (cloudflare/src/paiements-coach.js) relie le compte, crée la commande avec
// le coach pour bénéficiaire, capture au retour, et ouvre le suivi de
// l'athlète (droits/<athlète>.suiviJusqu, PROLONGÉ, jamais écrasé).
//
// ⚠ REPCORE N'ENCAISSE RIEN POUR UN COACH (NOTE-DECISION-MODELE-ECONOMIQUE §2).
// ⚠ LE BOUTON « PAYER » N'EXISTE QUE POUR UN COACH RELIÉ. Sans liaison, la
//   page et le parcours prospect restent ceux d'avant, mot pour mot.
// ⚠ FERMÉ TANT QUE LE SERVEUR NE L'OUVRE PAS (env.PAIEMENTS_COACH) : l'écran
//   le dit, et « Relier » répond que ce n'est pas encore ouvert.

const PC_PALIERS=Object.freeze(['coach','pro']);
const PC_PAYER_CLE='rc_payer';
const PC_STATUT_LIB=Object.freeze({en_attente:'En attente',recu:'Reçu',rembourse:'Remboursé',annule:'Annulé'});
// L'adresse de l'app, celle d'où l'on vient (Firebase ou GitHub Pages) : le lien
// de paiement ramène au même endroit, et aucun domaine n'est écrit ici.
const PC_APP=(()=>{ try{ return new URL('./',location.href).href.split('?')[0]; }catch(e){ return './'; } })();
// PURE. Ce coach peut-il encaisser dans l'app ?
function pcPalierOk(u){ return !!u&&(u.email===CREATOR_EMAIL||(u.role==='coach'&&PC_PALIERS.indexOf(String(u.coachPlan))>=0)); }
// PURE. Relié, d'après le miroir posé par la réponse du serveur.
function pcRelie(u){ return !!(u&&u.paiementCoach&&u.paiementCoach.statut==='relie'); }
// PURE. Le lien qu'on donne à quelqu'un pour payer une formule de ce coach.
function pcLienPayer(slug,formule){
  if(!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(String(slug||''))||VITRINE_FORMULES.indexOf(formule)<0) return '';
  return PC_APP+'?payer='+encodeURIComponent(slug+'~'+formule);
}
// PURE. ?payer=<slug>~<formule> → {slug, formule} ou null.
function pcLirePayer(v){
  const m=/^([a-z0-9][a-z0-9-]{1,38}[a-z0-9])~([a-z_]{3,40})$/.exec(String(v||''));
  return (m&&VITRINE_FORMULES.indexOf(m[2])>=0)?{slug:m[1],formule:m[2]}:null;
}

// ── Le réglage, dans « Mes formules sur ma page » ─────────────────────────
let _pcEtat=null;
function htmlReglagePaiementCoach(u){
  const E=escapeHtml;
  let h='<div class="pc-reg"><div class="pp-lab">Encaisser dans l’app</div>';
  if(!pcPalierOk(u))
    return h+'<p class="sub pr-p">Réservé aux paliers Coach et Pro. Sans, tes formules restent sur ta page avec « Ça m’intéresse », et tu encaisses comme aujourd’hui.</p></div>';
  const e=_pcEtat;
  if(e&&e.ouvert===false)
    return h+'<p class="sub pr-p">Le paiement direct sur ton compte PayPal n’est pas encore ouvert. En attendant, « Ça m’intéresse » t’amène les contacts, et tu encaisses comme aujourd’hui.</p></div>';
  const relie=e?e.statut==='relie':pcRelie(u);
  h+='<p class="sub pr-p">L’argent arrive directement sur TON compte PayPal : RepCore ne prend rien et ne touche à rien. Tes athlètes paient depuis ta page, et leur suivi s’ouvre tout seul pour la durée de la formule.</p>'
    +'<div class="pc-etat pc-'+(relie?'ok':'non')+'">'+(relie?'Relié'+(e&&e.marchand?' ('+E(e.marchand)+')':''):'Non relié')
    +(e&&e.statut==='refuse'?' · PayPal a refusé ce compte'+(e.raison?' ('+E(String(e.raison).toLowerCase().replace(/_/g,' '))+')':''):'')+'</div>'
    +'<label class="pr-lab" for="coach-marchand">Mon identifiant marchand PayPal (ou l’e-mail de mon compte PayPal Business)</label>'
    +'<div class="pc-ligne"><input id="coach-marchand" autocomplete="off" maxlength="120" placeholder="ex. ABCD1234EFGH5">'
    +'<button type="button" class="btn btn-outline btn-sm" onclick="relierPaiementCoach(this)">'+(relie?'Changer':'Relier')+'</button></div></div>';
  return h;
}
async function _pcChargerEtat(){
  try{ _pcEtat=await CLOUD._callFn('paiementCoach',{action:'etat'}); }catch(e){ _pcEtat=null; }
  if(_pcEtat&&currentUser){
    const avant=pcRelie(currentUser);
    currentUser.paiementCoach={statut:_pcEtat.statut,le:Date.now()};
    if(avant!==(_pcEtat.statut==='relie')){ try{ saveUser(); publierVitrinePublique(currentUser); }catch(e){} }
  }
  const z=document.getElementById('coach-paiement'); if(z) z.innerHTML=htmlReglagePaiementCoach(currentUser);
  return _pcEtat;
}
async function relierPaiementCoach(btn){
  const v=String((document.getElementById('coach-marchand')||{}).value||'').trim();
  if(!v){ toast('Colle ton identifiant marchand PayPal.','var(--orange)'); return false; }
  if(btn){ btn.disabled=true; btn.textContent='Vérification…'; }
  let r=null;
  try{ r=await CLOUD._callFn('paiementCoach',{action:'relier',marchand:v}); }
  catch(e){ toast(e.message||'Vérification impossible.','var(--orange)'); }
  if(btn){ btn.disabled=false; btn.textContent='Relier'; }
  if(r) toast(r.relie?'Compte PayPal relié '+ICO.coche:'PayPal ne reconnaît pas ce compte : vérifie l’identifiant.',r.relie?'var(--green)':'var(--orange)');
  await _pcChargerEtat();
  return !!(r&&r.relie);
}

// ── Payer, côté athlète : ?payer=<slug>~<formule> puis le retour de PayPal ─
// Le lien est MÉMORISÉ AU CHARGEMENT (brut, sans rien lire du module : ce bloc-là
// tourne avant les constantes) et lu ici, une heure au plus, après la connexion.
function _pcPayerEnAttente(){
  try{ const o=JSON.parse(localStorage.getItem(PC_PAYER_CLE)||'null'); const p=o&&pcLirePayer(o.brut);
    if(p&&Date.now()-Number(o.at)<3600e3) return p; }catch(e){}
  return null;
}
async function pcProposerPaiement(){
  const p=_pcPayerEnAttente();
  if(!p||!currentUser||currentUser.role==='coach') return false;
  try{ localStorage.removeItem(PC_PAYER_CLE); }catch(e){}
  const o=OFFRES[p.formule]; if(!o) return false;
  if(!await rcConfirm('Payer '+o.lib+' ('+prixOffre(p.formule)+') ?\n\nLe paiement se fait sur PayPal et va directement sur le compte de ton coach. Ton suivi s’ouvre dès que PayPal confirme.',null,'Payer sur PayPal','Plus tard')) return false;
  let r=null;
  try{ r=await CLOUD._callFn('paiementCoach',{coach:p.slug,formuleId:p.formule}); }
  catch(e){ toast(e.message||'Paiement impossible pour l’instant.','var(--orange)'); return false; }
  if(r&&r.lien){ location.href=r.lien; return true; }
  toast('PayPal n’a pas renvoyé de lien de paiement : réessaie.','var(--orange)');
  return false;
}
async function pcRetourPaypal(etat,commande){
  if(etat==='annule'){ toast('Paiement annulé : rien n’a été prélevé.','var(--sub)'); return false; }
  if(etat!=='retour'||!/^[A-Z0-9]{8,40}$/.test(String(commande||''))) return false;
  let r=null;
  try{ r=await CLOUD._callFn('paiementCoach',{action:'capturer',commande}); }
  catch(e){ toast(e.message||'Le paiement n’a pas pu être confirmé.','var(--orange)'); return false; }
  if(r&&(r.statut==='recu'||r.statut==='deja')){
    toast('Paiement reçu '+ICO.coche+' Ton suivi est ouvert.','var(--green)',5000);
    try{ rafraichirDroits(currentUser,true); }catch(e){}
    return true;
  }
  toast('PayPal n’a pas encore confirmé le paiement : ton suivi s’ouvrira dès qu’il le fera.','var(--orange)',5000);
  return false;
}

// ── Côté coach : les paiements sur la fiche de l'athlète ──────────────────
let _pcPaiements=null, _pcLu=0;
async function _pcChargerPaiements(force){
  if(!force&&_pcPaiements&&Date.now()-_pcLu<3*60e3) return _pcPaiements;
  const moi=String((currentUser&&currentUser.email)||'').replace(/\./g,',');
  if(!moi) return {};
  const r=await _fbJson('paiements_coach/'+moi);
  if(r.ok){ _pcPaiements=r.v||{}; _pcLu=Date.now(); }
  return _pcPaiements||{};
}
// PURE. Les paiements d'un athlète, récents d'abord.
function pcPaiementsDe(brut,cleAthlete){
  const o=(brut&&typeof brut==='object')?brut:{};
  return Object.keys(o).map(id=>Object.assign({id},o[id])).filter(p=>p&&p.athlete===cleAthlete&&Number(p.date)>0)
    .sort((a,b)=>Number(b.date)-Number(a.date));
}
function htmlPaiementsFiche(l){
  const E=escapeHtml;
  if(!l.length) return '';
  return '<div class="pc-liste">'+l.map(p=>'<div class="pc-p pc-'+E(p.statut||'')+'"><span>'+E((OFFRES[p.formule]||{}).lib||p.formule||'')+'</span>'
    +'<span>'+E(_euros((Number(p.montant)||0)/100))+'</span><span>'+E(new Date(Number(p.date)).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}))+'</span>'
    +'<b>'+E(PC_STATUT_LIB[p.statut]||p.statut||'')+'</b></div>').join('')+'</div>';
}
function renderPaiementsFiche(c){
  const z=document.getElementById('ccd-paiements');
  if(!z||!c||!currentUser||currentUser.role!=='coach') return false;
  const cle=String(c.email||'').replace(/\./g,',');
  const peindre=()=>{ const h=htmlPaiementsFiche(pcPaiementsDe(_pcPaiements,cle)); z.innerHTML=h; const s=z.closest('section'); if(s) s.style.display=h?'':'none'; };
  peindre();
  if(pcRelie(currentUser)||_pcPaiements===null) _pcChargerPaiements().then(peindre).catch(()=>{});
  return true;
}
// Le lien de paiement d'un contact (écran « Ma page ») : copié, le coach l'envoie.
function pcCopierLienPayer(formule,btn){
  const l=pcLienPayer(currentUser&&currentUser.vitrineSlug,formule);
  if(!l) return false;
  const fait=()=>{ toast('Lien de paiement copié : envoie-le à ton contact.','var(--green)'); if(btn){ _texteIco(btn,'Lien copié '+ICO.coche); } };
  try{ if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(l).then(fait,()=>toast(l)); return true; } }catch(e){}
  toast(l); return true;
}

// ── La vitrine d'un coach ──────────────────────────────────────────────────
// PURE. « Kévin Guellec » → « kevin-guellec ».
function slugDe(prenom,nom){
  let s=String((prenom||'')+' '+(nom||''));
  try{ s=s.normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){}
  s=s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,36).replace(/-+$/,'');
  return s.length>=3?s:('coach-'+s).replace(/-+$/,'').slice(0,40);
}
function _httpsOuRien(u){ const s=String(u||''); return /^https:\/\//.test(s)&&s.length<=500?s:''; }
// PURE. La vitrine publique : ce que s-vitrine montre, sans les coordonnées,
// sans les messages du Canal, sans les images en base64 (trop lourdes pour une
// page web — seule une photo en https passe).
function vitrinePubliqueDonnees(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const o={nom:String(((u&&u.fname)||'')+' '+((u&&u.lname)||'')).replace(/\s+/g,' ').trim().slice(0,120),maj:t};
  const txt=(k,n,d)=>{ const v=String((u&&u[k])||'').trim().slice(0,n); if(v) o[d||k]=v; };
  txt('teamName',120,'equipe'); txt('catchphrase',300,'phrase'); txt('bio',2000); txt('vision',2000);
  const ph=_httpsOuRien(u&&u.coachPhoto)||_httpsOuRien(u&&u.photoVitrine);
  if(ph) o.photo=ph;
  const sp=String((u&&u.specialites)||'').split(/[,;\n]/).map(x=>x.trim().slice(0,40)).filter(Boolean).slice(0,6);
  if(sp.length) o.specialites=sp;
  let pr=[]; try{ pr=vitrineProgrammesDe(u); }catch(e){ pr=[]; }
  pr=pr.slice(0,12).map(p=>{
    const x={name:String(p.name||'').slice(0,80)};
    if(p.pitch) x.pitch=String(p.pitch).slice(0,300);
    if(p.prix!=null&&String(p.prix)) x.prix=String(p.prix).slice(0,20);
    if(_httpsOuRien(p.lienAchat)) x.lienAchat=p.lienAchat;
    if(_httpsOuRien(p.visuel)) x.visuel=p.visuel;
    return x;
  }).filter(x=>x.name);
  if(pr.length) o.programmes=pr;
  // C6 : les CLÉS des formules proposées (le prix se lit dans tarifs.json) et
  // le message d'accueil qu'on lit après « Ça m'intéresse ».
  const fo=vitrineFormulesDe(u);
  if(fo.length) o.formules=fo;
  o.accueil=prospectAccueilDe(u);
  if(pcRelie(u)&&pcPalierOk(u)) o.paiement=true;
  return o;
}
// Publiée à chaque enregistrement du profil coach (pushProfilCoach). Le slug
// se prend une fois (kevin-guellec, sinon kevin-guellec-2…), puis se garde.
async function publierVitrinePublique(u){
  if(!u||u.role!=='coach'||!u.email) return false;
  const d=vitrinePubliqueDonnees(u);
  if(!d.nom) return false;
  const moi=u.email.replace(/\./g,',');
  const base=SLUG_PUBLIC_RE.test(u.vitrineSlug||'')?u.vitrineSlug:slugDe(u.fname,u.lname);
  const essais=u.vitrineSlug?[base]:[base].concat([2,3,4,5,6,7,8,9].map(n=>base.slice(0,37)+'-'+n));
  for(const s of essais){
    const ok=await CLOUD.racinePatch({['slugs/'+s]:moi,['vitrines/'+s]:d}).catch(()=>false);
    if(ok){
      if(u.vitrineSlug!==s||!u.vitrinePubliee){ u.vitrineSlug=s; u.vitrinePubliee=true; try{ saveUser(); }catch(e){} }
      try{ _rendreLienVitrineCoach(); }catch(e){}
      return true;
    }
  }
  return false;
}
function _rendreLienVitrineCoach(){
  const z=document.getElementById('coach-page-publique');
  if(!z||!currentUser||currentUser.role!=='coach') return;
  const url=urlPagePerso(currentUser);
  z.innerHTML='<div class="pp-lab">Ta page publique</div>'
    +(url?'<div class="pp-etat">'+escapeHtml(url.replace(/^https?:\/\//,''))+'</div>'
          +'<button type="button" class="btn btn-outline btn-sm btn-casse" style="width:100%;margin:8px 0 0;min-height:44px" onclick="copierLienBio(this)">Copier mon lien pour ma bio Instagram</button>'
        :'<div class="pp-etat">Elle se publie à l’enregistrement de ton profil : photo (en ligne), bio, spécialités, programmes en vente.</div>');
}
// ══ L'ATTRIBUTION ET LA VIRALITÉ ═══════════════════════════════════════════
//
// D'OÙ VIENNENT LES INSCRITS. Chaque lien qui sort de l'app porte src=<type
// de visuel ou de lien> et, selon qui le partage, ref=<code parrain> ou
// amb=<code ambassadeur> — posés par UNE fonction, lienAttribue. Au bout du
// lien, /i, la page d'accueil et les pages publiques comptent l'arrivée
// (fonction attribArrivee) ; l'app garde la source jusqu'à l'inscription
// (u.origine), et le serveur y pose la date du premier paiement.
//
// CE QUI EST COMPTÉ, et rien d'autre : des entiers par jour, par src et par
// code ambassadeur, dans /attribution/jours/<AAAA-MM-JJ> — partage (feuille
// de partage résolue), telechargement, copie (lien copié), clic, inscription,
// payant — et les utilisateurs actifs par semaine. Aucun cookie, aucune IP,
// aucun identifiant ; le code d'un parrain n'est jamais compté (il désigne
// une personne). Voir privacy.html, « Mesure d'audience ».
const ATTR_SRC_RE=/^[a-z0-9_-]{1,20}$/;
// LA LISTE BLANCHE DES src (01/10/2026). La regle de /attribution n'accepte
// qu'eux : un src bien forme mais inconnu devient 'autre' — jamais une cle
// refusee, jamais un noeud de plus. La meme liste vit dans le Worker
// (functions/attribution-calcul.js, SRC_CONNUS) et dans database.rules.json ;
// scripts/verif/regles.mjs verifie que les trois disent la meme chose.
const ATTR_SRC_CONNUS=Object.freeze(['amb','amis','autre','avant','badge','bilan','bio','carte',
  'champion','charge','commissions','cycle','defi','diete','direct','dossier','duel','email',
  'envois','facebook','fond','instagram','invitation','journal','kit','logo','mes','muscles',
  'parrainage','pesees','photos','pub','qr','rang','record','records','saison','seance',
  'seances','serie','site','story','team','tiktok','victoire','visuel','whatsapp','wrapped','youtube']);
const ATTR_ORIGINE_CLE='rc_origine';
const ATTR_BASE='https://repcore-sync-default-rtdb.firebaseio.com/attribution';
function attribSrc(s){
  const x=String(s||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,20);
  if(!ATTR_SRC_RE.test(x)) return '';
  return ATTR_SRC_CONNUS.indexOf(x)>=0?x:'autre';
}
// PURE. LE LIEN ATTRIBUÉ — la SEULE fonction qui pose src, ref et amb. Un
// ambassadeur exclut un parrain (un seul avantage) ; un code mal formé est
// ignoré plutôt que de fabriquer un lien que personne ne pourrait honorer.
function lienAttribue(base,o){
  const b=String(base||'');
  if(!b) return '';
  const x=o||{}, p=[];
  const amb=String(x.amb||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const ref=String(x.ref||'').toUpperCase();
  if(/^[A-Z0-9]{3,16}$/.test(amb)) p.push('amb='+amb);
  else if(/^[A-Z]{4,6}[A-Z2-9]{3}$/.test(ref)) p.push('ref='+ref);
  const s=attribSrc(x.src);
  if(s) p.push('src='+s);
  return p.length?b+(b.indexOf('?')>=0?'&':'?')+p.join('&'):b;
}
function _attribLocal(){
  try{ const h=location.hostname; return h==='localhost'||h==='127.0.0.1'||h===''||h.startsWith('192.168.'); }catch(e){ return true; }
}
// UN DE PLUS — anonyme, atomique (.sv increment), sans réponse lue, comme rcm().
function _attribIncr(chemin){
  try{
    if(_attribLocal()) return false;
    fetch(ATTR_BASE+'/'+chemin+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({'.sv':{'increment':1}}),keepalive:true}).catch(()=>{});
    return true;
  }catch(e){ return false; }
}
// Partages résolus, téléchargements, liens copiés, inscriptions : par src.
function attribCompter(metrique,src){
  if(['partage','telechargement','copie','inscription','payant'].indexOf(metrique)<0) return false;
  return _attribIncr('jours/'+localISODate(new Date())+'/src/'+(attribSrc(src)||'direct')+'/'+metrique);
}
// Les utilisateurs ACTIFS, une fois par semaine et par compte sur cet appareil :
// le dénominateur du coefficient viral.
function attribActifSemaine(u){
  try{
    if(!u||!u.email) return false;
    const l=localISODate(_lundiDe(Date.now()));
    const k='rc_attr_actif_'+l+'_'+u.email;
    if(localStorage.getItem(k)) return false;
    localStorage.setItem(k,'1');
    return _attribIncr('semaines/'+l+'/actifs');
  }catch(e){ return false; }
}
// L'arrivée gardée par l'app (posée au chargement, dans l'analyse de l'URL).
function attribArriveeLue(){
  try{ const o=JSON.parse(localStorage.getItem(ATTR_ORIGINE_CLE)||'null'); return (o&&typeof o==='object')?o:null; }catch(e){ return null; }
}
// PURE. L'origine d'un compte, au moment où il se crée.
function origineDe(arrivee,maintenant){
  const a=arrivee||{}, t=(typeof maintenant==='number')?maintenant:Date.now();
  const amb=String(a.amb||'').toUpperCase(), ref=String(a.ref||'').toUpperCase();
  const src=attribSrc(a.src)||(/^[A-Z0-9]{3,16}$/.test(amb)?'amb':(ref?'parrainage':'direct'));
  const o={src,inscritLe:t};
  if(/^[A-Z0-9]{3,16}$/.test(amb)) o.amb=amb;
  if(/^[A-Z]{4,6}[A-Z2-9]{3}$/.test(ref)) o.ref=ref;
  if(Number(a.le)>0) o.arriveeLe=Number(a.le);
  return o;
}
// À L'INSCRIPTION : users/<clé>/origine, une fois, et le compteur d'inscriptions
// de son src (celui de l'ambassadeur est compté par le serveur, qui sait aussi
// les codes saisis à la main).
function attribOrigineInscription(u){
  if(!u||u.origine) return null;
  u.origine=origineDe(attribArriveeLue(),Date.now());
  attribCompter('inscription',u.origine.src);
  return u.origine;
}
// AU PREMIER PAIEMENT : la date. Le serveur la pose (attributionPaiement) et
// compte le payant ; sans lui, l'app le fait à sa place. Le Worker le compte
// (paypal.js → attributionPaiement) : avec lui, l'app ne recompte pas.
function attribPremierPaiement(u){
  if(!u||!u.origine||u.origine.payeLe) return false;
  u.origine.payeLe=Date.now();
  if(!SERVEUR_LEGER) attribCompter('payant',u.origine.src);
  return true;
}
// ── L'écran « Viralité » (administrateur) ─────────────────────────────────
// PURE. `jours` : /attribution/jours ; `semaines` : /attribution/semaines.
// Rend l'entonnoir par src (partages → clics → inscriptions → payants), par
// code ambassadeur, et le coefficient viral estimé : inscriptions venues d'un
// PARTAGE (ni 'direct', ni 'amb') sur le nombre moyen d'actifs par semaine.
function viraliteDonnees(jours,semaines,periodeJours,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const n=Math.max(1,Number(periodeJours)||30);
  const depuis=localISODate(new Date(t-(n-1)*864e5)), jusqua=localISODate(new Date(t));
  const src={}, amb={};
  const ajoute=(tab,cle,m,v)=>{ const x=tab[cle]||(tab[cle]={cle,partage:0,telechargement:0,copie:0,clic:0,inscription:0,payant:0}); x[m]+=Number(v)||0; };
  for(const j of Object.keys(jours||{})){
    if(j<depuis||j>jusqua) continue;
    const d=jours[j]||{};
    for(const s of Object.keys(d.src||{})) for(const m of Object.keys(d.src[s]||{})) ajoute(src,s,m,d.src[s][m]);
    for(const c of Object.keys(d.amb||{})) for(const m of Object.keys(d.amb[c]||{})) ajoute(amb,c,m,d.amb[c][m]);
  }
  const lignes=Object.values(src).map(x=>Object.assign(x,{partages:x.partage+x.telechargement+x.copie}))
    .sort((a,b)=>(b.inscription-a.inscription)||(b.clic-a.clic)||(b.partages-a.partages));
  const ambs=Object.values(amb).sort((a,b)=>(b.payant-a.payant)||(b.inscription-a.inscription)||(b.clic-a.clic));
  const lundis=Object.keys(semaines||{}).filter(l=>l>=localISODate(_lundiDe(t-(n-1)*864e5))&&l<=jusqua);
  const actifs=lundis.length?Math.round(lundis.reduce((a,l)=>a+(Number((semaines[l]||{}).actifs)||0),0)/lundis.length):0;
  const insPartage=lignes.filter(x=>x.cle!=='direct'&&x.cle!=='amb').reduce((a,x)=>a+x.inscription,0);
  const tot=k=>lignes.reduce((a,x)=>a+(x[k]||0),0);
  return {periode:n,src:lignes,amb:ambs,actifs,inscriptionsPartage:insPartage,
    k:actifs>0?Math.round(insPartage/actifs*1000)/1000:null,
    totaux:{partages:tot('partages'),clics:tot('clic'),inscriptions:tot('inscription'),payants:tot('payant')}};
}
// ══ LE RÉSUMÉ D'ACTIVITÉ (/activite/<compte>) — pour /stats/retention ════
// Ce que le serveur léger agrège chaque nuit (cloudflare/src/retention.js).
// AUCUN CONTENU : ni charge, ni mesure, ni repas, ni ressenti — des jours
// (actif = une séance, un check-in ou un journal ce jour-là) et des oui/non.
// Écrit par l'app une fois par jour au plus (quand il change), lu par le
// Worker seul, effacé avec le compte. privacy.html le dit.
const ACTIVITE_CLE='rc_activite_sig';
/** PURE. Les jours actifs (AAAA-MM-JJ, heure locale). */
function joursActifs(u){
  const s=new Set();
  for(const x of ((u&&u.sessions)||[])) if(x&&Number(x.date)>0) s.add(localISODate(new Date(Number(x.date))));
  const ci=(u&&u.checkin)||{};
  for(const j of Object.keys(ci)) if(/^\d{4}-\d{2}-\d{2}$/.test(j)&&checkinComplet(ci[j])) s.add(j);
  const log=((u&&u.nutrition)||{}).log||{};
  for(const j of Object.keys(log)) if(/^\d{4}-\d{2}-\d{2}$/.test(j)&&((log[j]&&log[j].entries)||[]).length>0) s.add(j);
  return s;
}
function _actJourPlus(iso,n){ const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()+n); return localISODate(d); }
/** PURE (horloge donnée). Le résumé, ou null (coach, compte sans date). */
function activiteResume(u,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(!u||u.role==='coach') return null;
  const ses=((u.sessions)||[]).map(x=>Number(x&&x.date)).filter(x=>x>0);
  const cree=Math.min(Number(u.createdAt)||Infinity,Number(u.origine&&u.origine.inscritLe)||Infinity,ses.length?Math.min(...ses):Infinity);
  if(!isFinite(cree)) return null;
  const inscrit=localISODate(new Date(cree)), auj=localISODate(new Date(t));
  const actifs=joursActifs(u);
  const debut=[];
  for(let k=0;k<=40;k++) if(actifs.has(_actJourPlus(inscrit,k))) debut.push(k);
  let j30='';
  for(let k=29;k>=0;k--) j30+=actifs.has(_actJourPlus(auj,-k))?'1':'0';
  const fin30=cree+30*864e5;
  const ciTot=Object.keys(u.checkin||{}).filter(j=>checkinComplet(u.checkin[j])&&Number(u.checkin[j].at||0)<=fin30).length;
  const p=u.parcours||{};
  let notif=false; try{ notif=typeof Notification!=='undefined'&&Notification.permission==='granted'&&!!_pushMemo(); }catch(e){ notif=false; }
  const src=String((u.origine&&u.origine.src)||(u.ambassadeur?'amb':(u.parrainage&&u.parrainage.parrainCode?'parrainage':'direct'))).slice(0,20);
  return {v:1,inscrit,sem:localISODate(_lundiDe(cree)),src,debut,jour:auj,j30,
    seance1:ses.length>0,
    parcours:!!(p.fini&&!p.existant),
    finEssai:Number(u.essai&&u.essai.finit)||0,
    payant:!!((u.origine&&u.origine.payeLe)||u.paypalSubscriptionId),
    lev:{parcours:!!(p.fini&&!p.existant&&Number(p.fini)<=fin30),checkin:ciTot>=3,notif,
      duel:Object.keys(u.duels||{}).length>0,
      defi:Object.keys(u.defisReleves||{}).length>0||Object.keys(u.saisonsReleves||{}).length>0,
      coach:!!(u.coachEmailKey||u.coachId),
      invite:!!(u.ambassadeur||(u.parrainage&&u.parrainage.parrainCode)||src==='amb'||src==='parrainage')}};
}
// Une fois par jour au plus, et seulement s'il a changé.
async function activitePublier(u){
  if(!SERVEUR_LEGER||!u||!u.email||u.role==='coach'||!CLOUD||!CLOUD.ok()) return false;
  const r=activiteResume(u);
  if(!r) return false;
  const sig=JSON.stringify(r);
  try{ if(localStorage.getItem(ACTIVITE_CLE)===sig) return false; }catch(e){}
  const token=await CLOUD._getToken();
  if(!token) return false;
  const moi=String(u.email).replace(/\./g,',');
  const x=await fetch(CLOUD._fbUrl.replace('users.json','activite/'+moi+'.json')+'?auth='+token,
    {method:'PUT',headers:{'Content-Type':'application/json'},body:sig}).catch(()=>null);
  if(x&&x.ok){ try{ localStorage.setItem(ACTIVITE_CLE,sig); }catch(e){} return true; }
  return false;
}

// ── L'écran Viralité : la rétention (/stats/retention) ─────────────────
// Des AGRÉGATS : aucune ligne ne désigne une personne. Courbes et barres en
// SVG écrit à la main, sans bibliothèque.
const _vfPct=v=>v==null?'–':String(v).replace('.',',')+' %';
/** PURE. Les courbes J1 / J7 / J30 par cohorte, en SVG. */
function svgRetention(cohortes){
  const l=(cohortes||[]).filter(c=>c&&c.n>0);
  if(!l.length) return '';
  const W=320, H=140, g=28, d=12, hy=H-24;
  const x=i=>l.length<2?W/2:g+i*(W-g-d)/(l.length-1);
  const y=v=>hy-(Math.max(0,Math.min(100,v))/100)*(hy-10);
  const serie=(k,coul,tir)=>{
    const pts=l.map((c,i)=>c[k]==null?null:[x(i),y(c[k])]);
    let dd='', lev=true;
    for(const p of pts){ if(!p){ lev=true; continue; } dd+=(lev?'M':'L')+p[0].toFixed(1)+' '+p[1].toFixed(1)+' '; lev=false; }
    return (dd?'<path d="'+dd+'" fill="none" stroke="'+coul+'" stroke-width="2"'+(tir?' stroke-dasharray="4 3"':'')+'/>':'')
      +pts.filter(Boolean).map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="2.5" fill="'+coul+'"/>').join('');
  };
  const grille=[0,25,50,75,100].map(v=>'<line x1="'+g+'" x2="'+(W-d)+'" y1="'+y(v)+'" y2="'+y(v)+'" stroke="currentColor" stroke-opacity=".12"/>'
    +'<text x="'+(g-4)+'" y="'+(y(v)+3)+'" text-anchor="end" font-size="8" fill="currentColor" fill-opacity=".6">'+v+'</text>').join('');
  const lab=l.map((c,i)=>(i%Math.ceil(l.length/6)===0)?'<text x="'+x(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="8" fill="currentColor" fill-opacity=".6">'+c.sem.slice(5).replace('-','/')+'</text>':'').join('');
  return '<svg class="vir-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Rétention J1, J7 et J30 par semaine d’inscription">'
    +grille+lab+serie('j1','#ff6b6b',true)+serie('j7','#ffb020',false)+serie('j30',ROUGE_MARQUE,false)+'</svg>'
    +'<div class="vir-leg"><span style="--c:#ff6b6b">J1</span><span style="--c:#ffb020">J7</span><span style="--c:var(--red)">J30</span></div>';
}
/** PURE. L'entonnoir total, en barres SVG. */
function svgEntonnoir(total){
  const et=[['inscrits','Inscription'],['seance1','1re séance'],['parcours','Parcours fini'],['finEssai','Fin d’essai'],['payant','Payant']];
  const max=Math.max(1,Number(total&&total.inscrits)||0);
  const W=320, h=22;
  return '<svg class="vir-svg" viewBox="0 0 '+W+' '+(et.length*h+4)+'" role="img" aria-label="Entonnoir, toutes sources">'
    +et.map((e,i)=>{ const v=Number(total&&total[e[0]])||0, w=Math.round((W-120)*v/max);
      return '<text x="0" y="'+(i*h+15)+'" font-size="10" fill="currentColor">'+e[1]+'</text>'
        +'<rect x="84" y="'+(i*h+4)+'" width="'+Math.max(1,w)+('" height="14" rx="3" fill="'+ROUGE_MARQUE+'" fill-opacity="')+(1-i*0.12)+'"/>'
        +'<text x="'+(88+w)+'" y="'+(i*h+15)+'" font-size="10" fill="currentColor">'+v+'</text>'; }).join('')+'</svg>';
}
/** PURE. Les sections rétention de l'écran Viralité. */
function htmlRetention(s){
  if(!s||!s.maj) return '<div class="vir-t">Rétention</div><p class="sub">Pas encore calculée : le serveur léger la publie chaque nuit (4 h 30).</p>';
  const a=s.actifs||{};
  const pct=(v,n)=>n>0?Math.round(v/n*100)+' %':'–';
  let h='<div class="vir-t">Actifs (hier, 7 et 30 derniers jours)</div>'
    +'<div class="vir-actifs">'+[['DAU',a.dau],['WAU',a.wau],['MAU',a.mau],['DAU/MAU',a.dauMau==null?'–':_vfPct(a.dauMau)]]
      .map(x=>'<div class="card"><b>'+x[1]+'</b><span>'+x[0]+'</span></div>').join('')+'</div>';
  h+='<div class="vir-t">Rétention par semaine d’inscription</div>'+svgRetention(s.cohortes)
    +'<div class="vir-tab"><table><tr><th>Semaine</th><th>Inscrits</th><th>J1</th><th>J7</th><th>J30</th></tr>'
    +(s.cohortes||[]).slice().reverse().map(c=>'<tr><td>'+escapeHtml(c.sem)+'</td><td>'+c.n+'</td><td>'+_vfPct(c.j1)+'</td><td>'+_vfPct(c.j7)+'</td><td>'+_vfPct(c.j30)+'</td></tr>').join('')
    +'</table></div><p class="sub vir-note">Actif = une séance, un check-in ou un journal ce jour-là. J1 : le lendemain de l’inscription ; J7 : un jour au moins entre J7 et J13 ; J30 : entre J30 et J36. Une semaine n’a un taux qu’une fois sa fenêtre passée.</p>';
  const e=s.entonnoir||{}, t=e.total||{};
  h+='<div class="vir-t">Entonnoir</div>'+svgEntonnoir(t)
    +'<div class="vir-tab"><table><tr><th>Source</th><th>Inscr.</th><th>1re séance</th><th>Parcours</th><th>Fin d’essai</th><th>Payants</th></tr>'
    +(e.sources||[]).map(x=>'<tr><td>'+escapeHtml(x.src)+'</td><td>'+x.inscrits+'</td><td>'+x.seance1+'<small>'+pct(x.seance1,x.inscrits)+'</small></td><td>'+x.parcours+'<small>'+pct(x.parcours,x.inscrits)+'</small></td>'
      +'<td>'+x.finEssai+'</td><td>'+x.payant+'<small>'+pct(x.payant,x.inscrits)+'</small></td></tr>').join('')
    +'<tr class="vir-tot"><td>Total</td><td>'+(t.inscrits||0)+'</td><td>'+(t.seance1||0)+'</td><td>'+(t.parcours||0)+'</td><td>'+(t.finEssai||0)+'</td><td>'+(t.payant||0)+'</td></tr></table></div>';
  h+='<div class="vir-t">Effet des leviers sur la rétention J30</div>'
    +'<div class="vir-tab"><table><tr><th>Levier</th><th>Avec</th><th>Sans</th><th>Écart</th></tr>'
    +(s.leviers||[]).map(l=>{
      const ec=(l.avec.j30!=null&&l.sans.j30!=null)?Math.round((l.avec.j30-l.sans.j30)*10)/10:null;
      return '<tr'+(l.alerte?' class="vir-alerte"':'')+'><td>'+escapeHtml(l.lib)+(l.alerte?'<small>'+icon('alert-triangle',12)+' groupe &lt; '+(s.seuilGroupe||30)+' : pas encore significatif</small>':'')+'</td>'
        +'<td>'+_vfPct(l.avec.j30)+'<small>n = '+l.avec.n+'</small></td><td>'+_vfPct(l.sans.j30)+'<small>n = '+l.sans.n+'</small></td>'
        +'<td>'+(ec==null?'–':(ec>0?'+':'')+String(ec).replace('.',',')+' pts')+'</td></tr>'; }).join('')
    +'</table></div><p class="sub vir-note">Une corrélation, pas une preuve : ceux qui utilisent un levier sont peut-être déjà les plus motivés. Calculé le '
    +escapeHtml(new Date(s.maj).toLocaleString('fr-FR'))+' sur '+(s.comptes||0)+' comptes, sans aucune donnée personnelle.</p>';
  return h;
}
let _viral=null;   // {jours, semaines, periode, retention}
// /stats/retention : lu par le créateur seul (règles).
async function _lireRetention(){
  try{
    const token=await CLOUD._getToken(); if(!token) return null;
    const r=await fetch(CLOUD._fbUrl.replace('users.json','stats/retention.json')+'?auth='+token);
    return r.ok?await r.json():null;
  }catch(e){ return null; }
}
async function ouvrirViralite(){
  if(!currentUser||currentUser.email!==CREATOR_EMAIL) return false;
  go('s-viralite');
  const z=document.getElementById('vir-contenu');
  if(z) z.innerHTML='<div class="sub" style="padding:32px 0;text-align:center">Chargement…</div>';
  try{
    const depuis=localISODate(new Date(Date.now()-95*864e5));
    const [jours,semaines,retention]=await Promise.all([CLOUD.attribLire('jours',depuis),CLOUD.attribLire('semaines',depuis),_lireRetention()]);
    _viral={jours:jours||{},semaines:semaines||{},periode:(_viral&&_viral.periode)||30,retention:retention||null};
  }catch(e){ if(z) z.innerHTML='<p class="sub">Lecture impossible : '+escapeHtml(e.message||'erreur')+'</p>'; return false; }
  _viralRendre();
  return true;
}
function viralitePeriode(n){ if(!_viral) return false; _viral.periode=Number(n)||30; _viralRendre(); return true; }
// PURE.
function htmlViralite(v){
  const pct=(a,b)=>b>0?Math.round(a/b*100)+' %':'-';
  const seg='<div class="aa-seg vir-seg" role="group">'+[7,30,90].map(n=>'<button type="button" aria-pressed="'+(v.periode===n)+'" onclick="viralitePeriode('+n+')">'+n+' jours</button>').join('')+'</div>';
  let h=seg
    +'<div class="vir-k card"><div class="vir-k-v">'+(v.k==null?'-':String(v.k).replace('.',','))+'</div>'
    +'<div class="vir-k-l"><b>Coefficient viral estimé</b><span>'+v.inscriptionsPartage+' inscription'+(v.inscriptionsPartage>1?'s':'')+' venue'+(v.inscriptionsPartage>1?'s':'')
      +' d’un partage ÷ '+v.actifs+' actifs par semaine en moyenne. Au-dessus de 1, chaque utilisateur en amène plus d’un.</span></div></div>';
  h+='<div class="vir-t">Par source (src)</div>';
  if(!v.src.length) h+='<p class="sub">Rien sur la période.</p>';
  else h+='<div class="vir-tab"><table><tr><th>src</th><th title="partages résolus + téléchargements + liens copiés">Partages</th><th>Clics</th><th>Inscr.</th><th>Payants</th></tr>'
    +v.src.map(x=>'<tr><td>'+escapeHtml(x.cle)+'</td><td title="'+x.partage+' partages · '+x.telechargement+' téléch. · '+x.copie+' copies">'+x.partages+'</td>'
      +'<td>'+x.clic+'</td><td>'+x.inscription+'<small>'+pct(x.inscription,x.clic)+'</small></td><td>'+x.payant+'<small>'+pct(x.payant,x.inscription)+'</small></td></tr>').join('')
    +'<tr class="vir-tot"><td>Total</td><td>'+v.totaux.partages+'</td><td>'+v.totaux.clics+'</td><td>'+v.totaux.inscriptions+'</td><td>'+v.totaux.payants+'</td></tr></table></div>';
  h+='<div class="vir-t">Par code ambassadeur</div>';
  h+=v.amb.length?'<div class="vir-tab"><table><tr><th>Code</th><th>Clics</th><th>Inscr.</th><th>Payants</th></tr>'
    +v.amb.map(x=>'<tr><td>'+escapeHtml(x.cle)+'</td><td>'+x.clic+'</td><td>'+x.inscription+'<small>'+pct(x.inscription,x.clic)+'</small></td><td>'+x.payant+'<small>'+pct(x.payant,x.inscription)+'</small></td></tr>').join('')+'</table></div>'
    :'<p class="sub">Aucun ambassadeur actif sur la période.</p>';
  h+='<p class="sub vir-note">Des compteurs anonymes par jour : un partage est une feuille de partage résolue, un clic une arrivée par jour et par lien sur un appareil. Clics et payants demandent les Cloud Functions (attribArrivee, attributionPaiement).</p>';
  return h;
}
function _viralRendre(){
  const z=document.getElementById('vir-contenu');
  if(!z||!_viral) return;
  z.innerHTML=htmlViralite(viraliteDonnees(_viral.jours,_viral.semaines,_viral.periode,Date.now()))+htmlRetention(_viral.retention);
}
// ══ LES AMBASSADEURS ════════════════════════════════════════════════════════
//
// Un code (/ambassadeurs/<CODE>) donné à un créateur de contenu : ceux qui
// arrivent par lui ont, comme le filleul d'un parrain, un essai de
// TARIFS.essai.mois + TARIFS.essai_parrainage.moisEnPlus mois (1 + 1 = 2 :
// le Worker l'ouvre, bonusEssai), présenté comme offert grâce à lui — sauf
// un code « ultime_demi », qui donne à la place le 1er mois d'Ultime à
// moitié prix — et il touche une commission sur ce qu'ils
// paient — commissionPct (20 %), palierPct (25 %) au-delà de palierSeuil (50)
// payants — pendant dureeMois (12) à partir de leur premier paiement. Une
// commission n'est DUE que 30 jours après le paiement (remboursements).
// AUCUN PAIEMENT AUTOMATIQUE : l'admin exporte les dues en CSV, paie, et
// marque « payées ».
//
// ⚠ UN SEUL AVANTAGE : ambassadeur > parrain. Arrivé avec les deux, on garde
//   l'ambassadeur ; la fonction parrainageDemande refuse d'ailleurs un compte
//   déjà rattaché à un ambassadeur.
//
// Le suivi — clics (/i), inscriptions, paiements, commissions — est tenu par
// les Cloud Functions (functions/index.js, section « Les ambassadeurs »). Les
// règles de « due » sont les MÊMES qu'ici (functions/ambassadeurs-calcul.js) :
// les deux bancs rejouent la même fiche.
const AMB_CODE_RE=/^[A-Z0-9]{3,16}$/;
const AMB_DELAI_DUE_MS=30*864e5;
const AMB_DEFAUTS=Object.freeze({commissionPct:20,palierPct:25,palierSeuil:50,dureeMois:12});
const AMB_CLE='rc_amb';
function ambCodeNormalise(c){ return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function ambEnAttente(maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(typeof window!=='undefined'&&window._ambCode) return window._ambCode;
  for(const st of ['sessionStorage','localStorage']){
    try{
      const o=JSON.parse(window[st].getItem(AMB_CLE)||'null');
      if(o&&AMB_CODE_RE.test(o.code||'')&&t-Number(o.le)<60*864e5) return o.code;
    }catch(e){}
  }
  return '';
}
function ambOublier(){
  try{ localStorage.removeItem(AMB_CLE); }catch(e){}
  try{ sessionStorage.removeItem(AMB_CLE); }catch(e){}
  window._ambCode='';
}
// PURE. Les codes à essayer, dans l'ordre de priorité : un ambassadeur (saisi
// ou arrivé par le lien) avant un parrain.
function codesInscription(saisi,amb,ref){
  const s=ambCodeNormalise(saisi);
  const out=[];
  const pousse=(c,type)=>{ if(c&&!out.some(x=>x.code===c&&x.type===type)) out.push({code:c,type}); };
  if(AMB_CODE_RE.test(s)) pousse(s,'amb');
  if(AMB_CODE_RE.test(amb||'')) pousse(amb,'amb');
  if(typeof parrainageCodeValide==='function'){
    if(parrainageCodeValide(s)) pousse(s,'ref');
    if(parrainageCodeValide(ref||'')) pousse(ref,'ref');
  }
  return out;
}
// À l'inscription : l'ambassadeur d'abord. Rend {jours, type} — jours = le
// mois en plus (0 si rien).
async function ambassadeurApresInscription(u,saisi){
  if(!u||u.role==='coach') return {jours:0,type:null};
  const moi=(u.email||'').replace(/\./g,',');
  const liste=codesInscription(saisi,ambEnAttente(),(typeof parrainageRefEnAttente==='function')?parrainageRefEnAttente():'');
  for(const c of liste.filter(x=>x.type==='amb')){
    let pub=null;
    try{ pub=await CLOUD.ambPublicGet(c.code); }catch(e){ pub=null; }
    if(!pub||pub.actif!==true) continue;
    const ok=await CLOUD.ambDemande(moi,{code:c.code,le:Date.now(),appareil:rcAppareilId()}).catch(()=>false);
    if(ok) deposerEvenement({type:'ambassadeur_demande'}).catch(()=>{});
    if(!ok) continue;
    const demi=pub.avantage==='ultime_demi';
    u.ambassadeur={code:c.code,nom:String(pub.nom||'').slice(0,80),le:Date.now(),avantage:demi?'ultime_demi':'essai+1mois'};
    ambOublier();
    try{ if(typeof parrainageOublierRef==='function') parrainageOublierRef(); }catch(e){}
    try{ rcm('ambassadeur_inscrit'); }catch(e){}
    // L'OFFRE DE LANCEMENT (ultime_demi) remplace le mois offert (un seul avantage).
    toast(demi?('Code '+c.code+' appliqué : ton 1er mois d’Ultime à moitié prix '+ICO.eclair)
      :(pub.nom?('Grâce à '+String(pub.nom).slice(0,80)+', ton premier mois est offert '+ICO.eclair):('Code '+c.code+' appliqué : ton premier mois est offert '+ICO.eclair)),'var(--green)');
    return {jours:demi?0:parrainageBonusJours(),type:'amb'};
  }
  return {jours:0,type:null};
}
// ── Les règles de « due », les mêmes que le serveur ────────────────────────
function ambEtatCommission(x,t){
  if(!x) return 'attente';
  // « annulee » (remboursement total, rétrofacturation, litige perdu) et
  // l'ancien « rembourse » ; « suspendue » tant qu'un litige est ouvert.
  if(x.statut==='rembourse'||x.statut==='annulee') return 'rembourse';
  if(x.statut==='suspendue') return 'suspendue';
  if(x.statut==='payee') return 'payee';
  return Number(t)>=Number(x.dueLe)?'due':'attente';
}
// PURE. Le résumé d'un ambassadeur (le même que sa page secrète).
function ambResume(code,a,t){
  const s=(a&&a.stats)||{};
  const out={code,nom:String((a&&a.nom)||'').slice(0,80),clics:Number(s.clics)||0,inscrits:Number(s.inscrits)||0,
    payants:Number(s.payants)||0,ca:0,due:0,payee:0,attente:0,rembourse:0,suspendue:0,mois:{}};
  const com=(a&&a.commissions)||{};
  for(const m of Object.keys(com).sort()){
    const lm={ca:0,due:0,payee:0,attente:0};
    for(const id of Object.keys(com[m]||{})){
      const x=com[m][id]; if(!x) continue;
      const e=ambEtatCommission(x,t);
      if(e==='rembourse'){ out.rembourse+=Number(x.commissionInitiale)||Number(x.commission)||0; continue; }
      if(e==='suspendue'){ out.suspendue+=Number(x.commission)||0; continue; }
      lm.ca+=Number(x.montant)||0; out.ca+=Number(x.montant)||0;
      lm[e]+=Number(x.commission)||0; out[e]+=Number(x.commission)||0;
    }
    for(const k of Object.keys(lm)) lm[k]=Math.round(lm[k]*100)/100;
    out.mois[m]=lm;
  }
  // LE CHIFFRE D'AFFAIRES : tout l'encaissé (stats.ca), comme le serveur.
  if(Number(s.ca)>0) out.ca=Number(s.ca);
  for(const k of ['ca','due','payee','attente','rembourse','suspendue']) out[k]=Math.round(out[k]*100)/100;
  return out;
}
// PURE. Le CSV des commissions DUES d'un mois, tous ambassadeurs confondus.
// « ; » et virgule décimale : Excel en français.
function ambCsvDues(tous,mois,t){
  const l=[['code','ambassadeur','instagram','mois','paiement','date_paiement','montant_encaisse','taux_pct','commission','due_le'].join(';')];
  const d=ms=>{ const x=new Date(Number(ms)); return isNaN(x.getTime())?'':x.toISOString().slice(0,10); };
  const e=v=>String(v).replace('.',',');
  const q=s=>'"'+String(s||'').replace(/"/g,'""')+'"';
  let total=0;
  for(const code of Object.keys(tous||{}).sort()){
    const a=tous[code]||{}, com=((a.commissions||{})[mois])||{};
    for(const id of Object.keys(com).sort()){
      const x=com[id];
      if(ambEtatCommission(x,t)!=='due') continue;
      total+=Number(x.commission)||0;
      l.push([code,q(a.nom),q(a.instagram),mois,id,d(x.payeLe),e(x.montant),x.pct,e(x.commission),d(x.dueLe)].join(';'));
    }
  }
  return {csv:l.join('\n')+'\n',lignes:l.length-1,total:Math.round(total*100)/100};
}
function _ambEuros(v){ try{ return _euros(v); }catch(e){ return String(v)+' €'; } }
function ambLienInvitation(code){ return lienAttribue(String(RC_URL_VITRINE||'').replace(/\/$/,'')+'/',{amb:code,src:'amb'}); }
function ambLienSecret(secret){ return String(RC_URL_VITRINE||'').replace(/\/$/,'')+'/a/?s='+encodeURIComponent(secret); }
function _ambSecret(){
  const a='abcdefghijklmnopqrstuvwxyz0123456789';
  let s='';
  try{ const r=new Uint8Array(24); crypto.getRandomValues(r); for(const x of r) s+=a[x%36]; }
  catch(e){ for(let i=0;i<24;i++) s+=a[Math.floor(Math.random()*36)]; }
  return s;
}
// ── L'écran admin ──────────────────────────────────────────────────────────
let _ambTous=null;
function estAdminAmbassadeurs(u){ const x=u||currentUser; return !!(x&&x.email===CREATOR_EMAIL); }
async function ouvrirAmbassadeurs(){
  if(!estAdminAmbassadeurs()) return false;
  go('s-ambassadeurs');
  const z=document.getElementById('amb-contenu');
  if(z) z.innerHTML='<div class="sub" style="padding:32px 0;text-align:center">Chargement…</div>';
  try{ _ambTous=(await CLOUD.ambListe())||{}; }
  catch(e){ if(z) z.innerHTML='<p class="sub">Lecture impossible : '+escapeHtml(e.message||'erreur')+'</p>'; return false; }
  // LE JOURNAL NE BLOQUE PAS L'ÉCRAN : illisible (règles pas encore
  // déployées), la carte le dit et les ambassadeurs s'affichent quand même.
  try{ _ambJournal=await CLOUD.journalPaypal(); }catch(e){ _ambJournal=null; }
  try{ _ambKo=await CLOUD.evenementsKo(); }catch(e){ _ambKo=null; }
  _ambRendre();
  return true;
}
let _ambJournal=null, _ambKo=null;
const _KO_QUOI={reponse_bilan:'Notification « réponse à ton bilan »',reponse_rite:'Notification « réponse au bilan de cycle »',
  defi_publie:'Notification « nouveau défi »',defi_maj:'Recalcul d’un défi',parrainage_demande:'Demande de parrainage',
  ambassadeur_demande:'Code ambassadeur',abonnement:'Abonnement PayPal à relier au compte',
  push:'Notification différée',amb_vue:'Page de suivi d’un ambassadeur',defis_coach:'Défis du matin d’un coach',
  fin_paypal:'Fin d’abonnement PayPal'};
const _koCompte=k=>String(k||'').replace(/,/g,'.');
// PURE. Ce que le serveur léger a abandonné après cinq échecs : quoi, pour
// qui, pourquoi. Rien à montrer : rien du tout. null : illisible.
function htmlEvenementsKo(ko){
  if(ko===null) return '<div class="card amb-journal" id="amb-ko"><div class="amb-t">Serveur : tâches en échec</div>'
    +'<p class="sub amb-note">Liste illisible pour l’instant.</p></div>';
  const ids=Object.keys(ko||{}).filter(k=>ko[k]&&typeof ko[k]==='object').sort().reverse();
  if(!ids.length) return '';
  let h='<div class="card amb-journal" id="amb-ko"><div class="amb-t">Serveur : tâches en échec</div>'
    +'<p class="sub amb-note">Abandonnées après '+ids.map(k=>Number(ko[k].essais)||0).reduce((a,b)=>Math.max(a,b),0)
    +' essais. Les suivantes sont passées : rien n’est bloqué.</p>';
  for(const id of ids){
    const x=ko[id];
    const quoi=x.type==='travail'?'Travail du jour « '+String(x.nom||'?')+' »'
      :(_KO_QUOI[x.type==='tache'?x.quoi:x.type]||String(x.type==='tache'?x.quoi:x.type||'?'));
    const qui=x.type==='tache'?(x.uid||x.cle||x.code||x.coach):(x.dest||x.par);
    const d=Number(x.le)?new Date(Number(x.le)).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'';
    h+='<div class="amb-jl amb-jl-alerte">'
      +'<div class="amb-jl-tete"><b>'+escapeHtml(quoi)+'</b><span class="sub">'+escapeHtml(d)+'</span></div>'
      +(qui?'<div class="sub">'+escapeHtml(_koCompte(qui))+(x.par&&x.par!=='worker'&&x.dest?' · par '+escapeHtml(_koCompte(x.par)):'')+'</div>':'')
      +(x.erreur?'<div class="sub">Motif : '+escapeHtml(x.erreur)+'</div>':'')
      +'<button type="button" class="dfi-lien" onclick="effacerEvenementKo(\''+escapeHtml(id)+'\',this)">Vu, effacer</button>'
      +'</div>';
  }
  return h+'</div>';
}
async function effacerEvenementKo(id,btn){
  if(!estAdminAmbassadeurs()||!/^[A-Za-z0-9_-]{1,40}$/.test(String(id))) return false;
  if(btn) btn.disabled=true;
  const ok=await CLOUD.racinePatch({['evenements_ko/'+id]:null}).catch(()=>false);
  if(!ok){ if(btn) btn.disabled=false; toast('Non effacé','var(--orange)'); return false; }
  if(_ambKo) delete _ambKo[id];
  _ambRendre();
  return true;
}
const _JOURNAL_QUOI={remboursement:'Remboursement total',remboursement_partiel:'Remboursement partiel',
  remboursement_inconnu:'Remboursement (transaction inconnue)',retrofacturation:'Rétrofacturation',
  retrofacturation_partielle:'Rétrofacturation partielle',retrofacturation_inconnue:'Rétrofacturation (transaction inconnue)',
  litige_ouvert:'Litige ouvert',litige_gagne:'Litige gagné',litige_perdu:'Litige perdu',litige_perdu_partiel:'Litige perdu en partie'};
// PURE. Le journal PayPal, du plus récent au plus ancien : qui, quoi,
// pourquoi, et ce que le serveur a repris. null : illisible.
function htmlJournalPaypal(j){
  if(j===null) return '<div class="card amb-journal" id="amb-journal"><div class="amb-t">Remboursements et litiges</div>'
    +'<p class="sub amb-note">Journal illisible pour l’instant.</p></div>';
  const lignes=Object.keys(j||{}).sort().reverse().map(k=>j[k]).filter(x=>x&&x.quoi);
  let h='<div class="card amb-journal" id="amb-journal"><div class="amb-t">Remboursements et litiges</div>';
  if(!lignes.length) return h+'<p class="sub amb-note">Aucun remboursement ni litige.</p></div>';
  for(const x of lignes){
    const d=Number(x.le)?new Date(Number(x.le)).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'}):'';
    const litige=/^litige_(ouvert|perdu)/.test(x.quoi);
    h+='<div class="amb-jl'+(litige?' amb-jl-alerte':'')+'">'
      +'<div class="amb-jl-tete"><b>'+escapeHtml(_JOURNAL_QUOI[x.quoi]||x.quoi)+'</b><span class="sub">'+escapeHtml(d)+'</span></div>'
      +'<div class="sub">'+escapeHtml([x.qui||'client inconnu',x.montant,x.premier?'premier paiement':''].filter(Boolean).join(' · '))+'</div>'
      +(x.pourquoi?'<div class="sub">Motif : '+escapeHtml(x.pourquoi)+'</div>':'')
      +(Array.isArray(x.actions)&&x.actions.length?'<ul class="amb-jl-actions">'+x.actions.map(a=>'<li>'+escapeHtml(a)+'</li>').join('')+'</ul>':'')
      +'</div>';
  }
  return h+'</div>';
}
// PURE. L'écran : le formulaire, puis une carte par code.
function htmlAmbassadeurs(tous,t){
  const codes=Object.keys(tous||{}).sort();
  const moisDispo=new Set();
  codes.forEach(c=>Object.keys((tous[c]&&tous[c].commissions)||{}).forEach(m=>moisDispo.add(m)));
  const pct=(a,b)=>b>0?Math.round(a/b*100)+' %':'-';
  let h='<details class="card amb-form"'+(codes.length?'':' open')+'><summary>Nouvel ambassadeur</summary>'
    +'<div class="amb-grille">'
    +'<label>Code<input id="amb-code" maxlength="16" autocapitalize="characters" placeholder="LEAFIT"></label>'
    +'<label>Nom<input id="amb-nom" maxlength="80" placeholder="Léa Martin"></label>'
    +'<label>Instagram<input id="amb-insta" maxlength="60" placeholder="leafit"></label>'
    +'<label>Commission %<input id="amb-pct" type="number" min="0" max="100" value="'+AMB_DEFAUTS.commissionPct+'"></label>'
    +'<label>Palier %<input id="amb-palier" type="number" min="0" max="100" value="'+AMB_DEFAUTS.palierPct+'"></label>'
    +'<label>Au-delà de (payants)<input id="amb-seuil" type="number" min="1" value="'+AMB_DEFAUTS.palierSeuil+'"></label>'
    +'<label>Durée (mois)<input id="amb-duree" type="number" min="1" max="120" value="'+AMB_DEFAUTS.dureeMois+'"></label>'
    +'<label>Avantage de ses inscrits<select id="amb-avantage"><option value="essai+1mois">Mois offert grâce à lui</option>'
      +'<option value="ultime_demi">Offre de lancement : 1er mois d’Ultime à moitié prix</option></select></label>'
    +'</div><p class="sub amb-note">Un seul avantage par code : le mois offert (présenté comme offert grâce à lui), OU le 1er mois d’Ultime à moitié prix (plan PayPal ULTIME_DEMI, une fois par compte).</p>'
    +'<button type="button" class="btn btn-red" style="width:100%;margin:8px 0 0" onclick="creerAmbassadeur(this)">Créer l’ambassadeur</button></details>';
  if(moisDispo.size){
    const ms=[...moisDispo].sort().reverse();
    h+='<div class="card amb-export"><div class="amb-t">Export mensuel</div>'
      +'<div class="amb-ligne"><select id="amb-mois">'+ms.map(m=>'<option>'+m+'</option>').join('')+'</select>'
      +'<button type="button" class="btn btn-outline btn-sm btn-casse" style="margin:0" onclick="exporterCommissionsDues()">CSV des commissions dues</button></div>'
      +'<p class="sub amb-note">Aucun paiement n’est automatique : exporte, paie, puis marque le mois « payé » sur chaque carte.</p></div>';
  }
  if(!codes.length) return h+'<p class="sub" style="text-align:center;padding:20px 0">Aucun ambassadeur pour l’instant.</p>';
  for(const code of codes){
    const a=tous[code]||{}, r=ambResume(code,a,t);
    const mdus=Object.keys(r.mois).filter(m=>r.mois[m].due>0).sort();
    h+='<div class="card amb-carte'+(a.actif===false?' amb-eteint':'')+'">'
      +'<div class="amb-tete"><div><b>'+escapeHtml(a.nom||code)+'</b>'+(a.instagram?' <span class="sub">@'+escapeHtml(a.instagram)+'</span>':'')
      +'<div class="amb-code">'+escapeHtml(code)+' · '+(Number(a.commissionPct)||0)+' % → '+(Number(a.palierPct)||0)+' % au-delà de '+(Number(a.palierSeuil)||AMB_DEFAUTS.palierSeuil)+' · '+(Number(a.dureeMois)||12)+' mois</div></div>'
      +'<label class="amb-actif"><input type="checkbox"'+(a.actif!==false?' checked':'')+' onchange="basculerAmbassadeur(\''+code+'\',this.checked)"> actif</label></div>'
      +'<div class="amb-entonnoir">'
        +'<div><b>'+r.clics+'</b><span>clics</span></div><i>→ '+pct(r.inscrits,r.clics)+'</i>'
        +'<div><b>'+r.inscrits+'</b><span>inscrits</span></div><i>→ '+pct(r.payants,r.inscrits)+'</i>'
        +'<div><b>'+r.payants+'</b><span>payants</span></div></div>'
      +'<div class="amb-chiffres">'
        +'<div><span>Chiffre d’affaires</span><b>'+_ambEuros(r.ca)+'</b></div>'
        +'<div><span>Commission due</span><b class="amb-due">'+_ambEuros(r.due)+'</b></div>'
        +'<div><span>Payée</span><b>'+_ambEuros(r.payee)+'</b></div>'
        +'<div><span>En attente (30 j)</span><b>'+_ambEuros(r.attente)+'</b></div>'
        +(r.suspendue?'<div><span>Suspendue (litige)</span><b>'+_ambEuros(r.suspendue)+'</b></div>':'')
        +(r.rembourse?'<div><span>Annulée</span><b>'+_ambEuros(r.rembourse)+'</b></div>':'')+'</div>'
      +(mdus.length?'<div class="amb-dus">'+mdus.map(m=>'<button type="button" class="btn btn-outline btn-sm btn-casse" style="margin:0" onclick="marquerCommissionsPayees(\''+code+'\',\''+m+'\',this)">'
        +m+' : marquer '+_ambEuros(r.mois[m].due)+' payé</button>').join('')+'</div>':'')
      +'<div class="amb-liens">'
        +'<button type="button" class="dfi-lien" onclick="ambCopier(\''+escapeHtml(ambLienInvitation(code))+'\',this)">Copier son lien d’invitation</button>'
        +(a.secret?'<button type="button" class="dfi-lien" onclick="ambCopier(\''+escapeHtml(ambLienSecret(a.secret))+'\',this)">Copier sa page de suivi (lien secret)</button>':'')
      +'</div></div>';
  }
  return h;
}
function _ambRendre(){
  const z=document.getElementById('amb-contenu');
  if(z) z.innerHTML=htmlEvenementsKo(_ambKo)+htmlJournalPaypal(_ambJournal)+htmlSaisonAdmin()+htmlDefiMoisAdmin(Date.now())+htmlAmbassadeurs(_ambTous||{},Date.now());
}
// PURE. La fiche à écrire, ou {erreur}.
function ambFiche(f,existants,maintenant){
  const code=ambCodeNormalise(f.code);
  if(!AMB_CODE_RE.test(code)) return {erreur:'Code : 3 à 16 lettres ou chiffres.'};
  if(existants&&existants[code]) return {erreur:'Ce code existe déjà.'};
  const nom=String(f.nom||'').replace(/\s+/g,' ').trim().slice(0,80);
  if(!nom) return {erreur:'Donne un nom.'};
  const n=(v,d,min,max)=>{ const k=Number(v); return isFinite(k)&&k>=min&&k<=max?k:d; };
  return {code,fiche:{nom,instagram:String(f.instagram||'').replace(/^@/,'').trim().slice(0,60),avantage:f.avantage==='ultime_demi'?'ultime_demi':'essai+1mois',
    commissionPct:n(f.commissionPct,AMB_DEFAUTS.commissionPct,0,100),palierPct:n(f.palierPct,AMB_DEFAUTS.palierPct,0,100),
    palierSeuil:n(f.palierSeuil,AMB_DEFAUTS.palierSeuil,1,100000),dureeMois:n(f.dureeMois,AMB_DEFAUTS.dureeMois,1,120),
    actif:true,secret:f.secret||_ambSecret(),creeLe:(typeof maintenant==='number')?maintenant:Date.now()}};
}
async function creerAmbassadeur(btn){
  if(!estAdminAmbassadeurs()) return false;
  const g=id=>(document.getElementById(id)||{}).value;
  const r=ambFiche({code:g('amb-code'),nom:g('amb-nom'),instagram:g('amb-insta'),commissionPct:g('amb-pct'),
    palierPct:g('amb-palier'),palierSeuil:g('amb-seuil'),dureeMois:g('amb-duree'),avantage:g('amb-avantage')},_ambTous||{});
  if(r.erreur){ toast(r.erreur,'var(--orange)'); return false; }
  if(btn) btn.disabled=true;
  const f=r.fiche;
  const ok=await CLOUD.racinePatch({['ambassadeurs/'+r.code]:f,
    ['ambassadeurs_publics/'+r.code]:{nom:f.nom,avantage:f.avantage,actif:true},
    ['ambassadeurs_vue/'+f.secret]:Object.assign(ambResume(r.code,f,Date.now()),{commissionPct:f.commissionPct,palierPct:f.palierPct,
      palierSeuil:f.palierSeuil,dureeMois:f.dureeMois,actif:true,maj:Date.now()})}).catch(()=>false);
  if(btn) btn.disabled=false;
  if(!ok){ toast('Création refusée (droits, ou code déjà pris).','var(--orange)'); return false; }
  toast('Ambassadeur '+r.code+' créé '+ICO.eclair);
  return ouvrirAmbassadeurs();
}
async function basculerAmbassadeur(code,on){
  if(!estAdminAmbassadeurs()) return false;
  const ok=await CLOUD.racinePatch({['ambassadeurs/'+code+'/actif']:!!on,['ambassadeurs_publics/'+code+'/actif']:!!on}).catch(()=>false);
  if(!ok){ toast('Non enregistré','var(--orange)'); return false; }
  if(_ambTous&&_ambTous[code]) _ambTous[code].actif=!!on;
  _ambRendre();
  return true;
}
// Marque « payées » les commissions DUES d'un mois (et la page secrète suit).
async function marquerCommissionsPayees(code,mois,btn){
  if(!estAdminAmbassadeurs()||!_ambTous||!_ambTous[code]) return false;
  const a=_ambTous[code], com=((a.commissions||{})[mois])||{}, t=Date.now();
  const patch={};
  Object.keys(com).forEach(id=>{ if(ambEtatCommission(com[id],t)==='due'){
    patch['ambassadeurs/'+code+'/commissions/'+mois+'/'+id+'/statut']='payee';
    patch['ambassadeurs/'+code+'/commissions/'+mois+'/'+id+'/payeeLe']=t; } });
  if(!Object.keys(patch).length) return false;
  if(!confirm('Marquer comme payées les commissions dues de '+mois+' pour '+(a.nom||code)+' ?')) return false;
  if(btn) btn.disabled=true;
  Object.keys(com).forEach(id=>{ if(ambEtatCommission(com[id],t)==='due'){ com[id].statut='payee'; com[id].payeeLe=t; } });
  if(a.secret) patch['ambassadeurs_vue/'+a.secret]=Object.assign(ambResume(code,a,t),{commissionPct:a.commissionPct,palierPct:a.palierPct,
    palierSeuil:a.palierSeuil||AMB_DEFAUTS.palierSeuil,dureeMois:a.dureeMois,actif:a.actif!==false,maj:t});
  const ok=await CLOUD.racinePatch(patch).catch(()=>false);
  if(!ok){ toast('Non enregistré','var(--orange)'); return ouvrirAmbassadeurs(); }
  toast('Commissions de '+mois+' marquées payées.');
  _ambRendre();
  return true;
}
function exporterCommissionsDues(){
  const mois=(document.getElementById('amb-mois')||{}).value;
  if(!mois||!_ambTous) return false;
  const r=ambCsvDues(_ambTous,mois,Date.now());
  if(!r.lignes){ toast('Aucune commission due pour '+mois+'.','var(--orange)'); return false; }
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['﻿'+r.csv],{type:'text/csv;charset=utf-8'}));
  a.download='repcore-commissions-'+mois+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} },4000);
  toast(r.lignes+' commission'+(r.lignes>1?'s':'')+' due'+(r.lignes>1?'s':'')+' · '+_ambEuros(r.total));
  return true;
}
function ambCopier(l,btn){
  try{ navigator.clipboard.writeText(l).then(()=>{ if(btn){ const x=btn.textContent; _texteIco(btn,'Copié '+ICO.coche); setTimeout(()=>{ btn.textContent=x; },1800); } },()=>toast(l)); }
  catch(e){ toast(l); }
  return true;
}
// ══ LE PARRAINAGE ══════════════════════════════════════════════════════════
//
// LA RÉCOMPENSE : le filleul a son essai plus un mois, présenté comme offert
// par son parrain (OFFRES.essai_parrainage.mois = TARIFS.essai_parrainage.
// moisEnPlus = 1 : 2 mois en tout, invitationDonnees et les pages publiques) ;
// le parrain gagne 1 mois offert — ses droits prolongés — au PREMIER paiement
// du filleul, et rien avant (anti-fraude). Au 10e filleul payant, 1 mois
// d'Ultime en plus (droits.bonusUltimeFin, lu par palierDe).
//
// OÙ VIVENT LES DONNÉES (voir database.rules.json et functions/index.js) :
//   /parrainage/codes/<CODE> → clé du parrain ; /parrainage/codesPublics/<CODE>
//   → {prenom} ; /parrainage/comptes/<clé> → {code, filleuls, moisGagnes,
//   payants, parrain} ; /parrainage/demandes/<filleul> → la demande de
//   rattachement.
// ⚠ PAS DANS /users/<clé>/parrainage COMME LE DISAIT LA DEMANDE : le dossier
//   s'écrit en entier depuis l'appareil, et son titulaire peut y écrire ce
//   qu'il veut — un statut « payant » ou des mois gagnés posés là ne vaudraient
//   rien. u.parrainage n'est qu'un MIROIR, recopié de /parrainage/comptes, pour
//   l'affichage et pour dater RECRUTEUR et MENTOR.
//
// ⚠ TOUT CE QUI RÉCOMPENSE PASSE PAR LE SERVEUR (le Worker). Sans lui,
//   personne ne serait jamais crédité : l'écran et le rappel restent fermés. Un code saisi à
//   l'inscription, lui, fonctionne déjà (demande enregistrée, essai allongé).
const PARRAINAGE_ACTIF=SERVEUR_LEGER;
const PARRAINAGE_CODE_RE=/^[A-Z]{4,6}[A-Z2-9]{3}$/;
// Sans 0/O, 1/I : un code se dicte et se recopie.
const PARRAINAGE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PARRAINAGE_PALIERS=Object.freeze([
  {n:3,badge:'recruteur',nom:'RECRUTEUR',gain:'Badge RECRUTEUR'},
  {n:10,badge:'mentor',nom:'MENTOR',gain:'Badge MENTOR et 1 mois d’Ultime offert'}
]);
const PARRAINAGE_REF_CLE='rc_ref';
const PARRAINAGE_REF_JOURS=60;
function parrainageBonusJours(){ return Math.round((Number((OFFRES.essai_parrainage||{}).mois)||0)*30); }
// PURE. Le code : le prénom (4 à 6 lettres, sans accent) + 3 caractères.
// `alea` rend un nombre dans [0,1) — Math.random par défaut.
function parrainageCodeDe(prenom,alea){
  const r=typeof alea==='function'?alea:Math.random;
  let l='';
  try{ l=String(prenom||'').normalize('NFD').replace(/[̀-ͯ]/g,''); }catch(e){ l=String(prenom||''); }
  l=l.toUpperCase().replace(/[^A-Z]/g,'').slice(0,6);
  if(l.length<4) l=(l+'REPCORE').slice(0,4);
  let s='';
  for(let i=0;i<3;i++) s+=PARRAINAGE_ALPHABET[Math.floor(r()*PARRAINAGE_ALPHABET.length)%PARRAINAGE_ALPHABET.length];
  return l+s;
}
function parrainageCodeNormalise(c){ return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,''); }
function parrainageCodeValide(c){ return PARRAINAGE_CODE_RE.test(parrainageCodeNormalise(c)); }
// L'identifiant de CET appareil (anti-fraude : un filleul ne s'inscrit pas
// depuis le téléphone de son parrain). Tiré une fois, gardé sur l'appareil.
function rcAppareilId(){
  try{
    let id=localStorage.getItem('rc_appareil');
    if(!/^[a-z0-9]{12,32}$/.test(id||'')){
      id=Array.from({length:20},()=>'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join('');
      localStorage.setItem('rc_appareil',id);
    }
    return id;
  }catch(e){ return 'sansstockage0000'; }
}
// ── Le lien : lienPerso(), plus haut (pages publiques) ────────────────────
// PURE. Le message prêt à partager. LE MOIS OFFERT GRÂCE À TOI (Kevin,
// 28/09/2026) : jamais « au lieu de », jamais « 2 mois ».
// `lien` : ajouté à la fin ; '' (chaîne vide) quand le lien voyage à part
// (navigator.share le porte dans `url` : l'écrire aussi dans le texte le
// faisait apparaître deux fois) ; absent : on dit où saisir le code.
function parrainageMessage(code,lien){
  return 'Je m’entraîne avec RepCore. Avec mon code '+code+', ton premier mois est offert'
    +' : toute l’app ouverte, sans carte bancaire.'
    +(lien?' '+lien:(lien===''?'':' Le code se saisit à l’inscription.'));
}
// ── L'arrivée par un lien ?ref= ────────────────────────────────────────────
// Gardé sur l'appareil (localStorage ET sessionStorage) jusqu'à l'inscription.
// ⚠ SUR iPHONE, L'APP INSTALLÉE NE VOIT PAS LE STOCKAGE DE SAFARI : c'est pour
//   ça que le code est aussi RECOPIÉ dans le champ de l'inscription, et
//   qu'il se tape à la main.
function parrainageMemoriserRef(code){
  const c=parrainageCodeNormalise(code);
  if(!parrainageCodeValide(c)) return false;
  const v=JSON.stringify({code:c,le:Date.now()});
  try{ localStorage.setItem(PARRAINAGE_REF_CLE,v); }catch(e){}
  try{ sessionStorage.setItem(PARRAINAGE_REF_CLE,v); }catch(e){}
  window._refCode=c;
  return true;
}
function parrainageRefEnAttente(maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  if(typeof window!=='undefined'&&window._refCode) return window._refCode;
  for(const st of ['sessionStorage','localStorage']){
    try{
      const o=JSON.parse(window[st].getItem(PARRAINAGE_REF_CLE)||'null');
      if(o&&parrainageCodeValide(o.code)&&t-Number(o.le)<PARRAINAGE_REF_JOURS*864e5) return o.code;
    }catch(e){}
  }
  return '';
}
function parrainageOublierRef(){
  try{ localStorage.removeItem(PARRAINAGE_REF_CLE); }catch(e){}
  try{ sessionStorage.removeItem(PARRAINAGE_REF_CLE); }catch(e){}
  window._refCode='';
}
// Le champ de l'inscription, pré-rempli. Athlète seulement.
// ── LE PRÉNOM DU PARRAIN, pour l'accueillir par son nom ────────────────────
// La page /i l'a lu dans /parrainage/codesPublics et gardé (même domaine) ;
// sinon on le lit ici — code par code, sans compte (règles). null : inconnu.
function parrainInviteGarde(code){
  try{
    const g=JSON.parse(localStorage.getItem('rc_parrain_invite')||'null');
    return (g&&g.code===code&&g.prenom)?{prenom:String(g.prenom).slice(0,24),rang:Number(g.rang)||0}:null;
  }catch(e){ return null; }
}
async function parrainInviteLire(code){
  if(!parrainageCodeValide(code)) return null;
  const g=parrainInviteGarde(code);
  if(g) return g;
  try{
    const r=await fetch(CLOUD._fbUrl.replace('users.json','parrainage/codesPublics/'+code+'.json'));
    const d=r.ok?await r.json():null;
    if(!d||!d.prenom) return null;
    const v={prenom:String(d.prenom).slice(0,24),rang:Number(d.rang)||0};
    try{ localStorage.setItem('rc_parrain_invite',JSON.stringify(Object.assign({code,le:Date.now()},v))); }catch(e){}
    return v;
  }catch(e){ return null; }
}
// PURE. La ligne sous le champ du code.
function phraseInvitationInscription(prenom,amb,avantage){
  // L'offre de lancement d'un code ambassadeur : pas de mois offert, le 1er
  // mois d'Ultime à moitié prix.
  if(amb&&avantage==='ultime_demi') return 'Grâce à '+amb+', ton 1er mois d’Ultime est à '+prixOffre('ultime_demi');
  if(amb) return 'Grâce à '+amb+', ton premier mois est offert';
  // Le mois offert PAR QUELQU'UN (lot C) : c'est ce « par quelqu'un » qui compte.
  if(prenom) return prenom+' t’offre ton premier mois';
  return 'Le code d’un ami ou d’un ambassadeur t’offre ton premier mois.';
}
// PURE. Faut-il le bouton « Quelqu'un t'a invité ? » en haut de l'inscription ?
// L'app installée sur iPhone, un athlète, et aucun code arrivé par le lien.
function parrainageDemanderCode(role,installeeIOS,code){
  return role==='athlete'&&!!installeeIOS&&!code;
}
function parrainageAllerAuChamp(){
  const i=document.getElementById('r-parrain');
  if(!i) return false;
  try{ i.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
  try{ i.focus(); }catch(e){}
  return true;
}
// Un code tapé à la main (l'app installée sur iPhone a perdu le lien) :
// dès qu'il a la bonne forme, on dit de qui il vient — la preuve qu'il est bon.
function parrainageCodeSaisi(v){
  const c=parrainageCodeNormalise(v);
  const x=document.getElementById('r-parrain-info');
  if(!x||!parrainageCodeValide(c)) return false;
  parrainInviteLire(c).then(g=>{
    if(g&&parrainageCodeNormalise((document.getElementById('r-parrain')||{}).value)===c) poserCadeauInscription(phraseInvitationInscription(g.prenom),true);
  }).catch(()=>{});
  return true;
}
// PURE. La ligne du haut de l'inscription : le défi d'abord (la raison de
// venir), le cadeau ensuite.
function ligneCadeauInscription(cadeau,dv){
  const d=(dv&&dv.prenom)?dv.prenom+' te défie : '+texteDuel(dv.mesure,dv.duree)+'.':'';
  return [d,cadeau?cadeau+(/[.⚡]$/.test(cadeau)?'':'.'):''].filter(Boolean).join(' ');
}
// La ligne sous le champ du code ET le bandeau du haut, ensemble. Le bandeau
// ne parle que s'il y a un code (ou un défi) : sinon, rien à offrir.
function poserCadeauInscription(cadeau,avecCode){
  let dv=null; try{ dv=duelInviteEnAttente(); }catch(e){ dv=null; }
  const info=document.getElementById('r-parrain-info');
  if(info) info.textContent=cadeau;
  const z=document.getElementById('r-cadeau');
  if(!z) return;
  const l=ligneCadeauInscription(avecCode?cadeau:'',dv&&dv.prenom?dv:null);
  z.textContent=l; z.style.display=l?'':'none';
}
function parrainageChampInscription(role){
  const z=document.getElementById('r-parrain-z');
  if(!z) return;
  z.style.display=role==='athlete'?'':'none';
  const i=document.getElementById('r-parrain');
  // L'ambassadeur passe devant le parrain : un seul avantage.
  const a=ambEnAttente(), c=a||parrainageRefEnAttente();
  if(i&&c&&!i.value) i.value=c;
  const info=document.getElementById('r-parrain-info');
  const g=(!a&&c)?parrainInviteGarde(c):null;
  poserCadeauInscription(a?phraseInvitationInscription('',a)
    :c?phraseInvitationInscription(g?g.prenom:'Un ami'):phraseInvitationInscription(''),!!(role==='athlete'&&c));
  // « Grâce à Léa Fit », pas « grâce à LEAFIT » : le nom de l'ambassadeur et
  // son offre, lus sans compte (lecture publique), remplacent son code.
  if(a&&info) Promise.resolve().then(()=>CLOUD.ambPublicGet(a)).then(p=>{
    if(!p||p.actif===false||ambEnAttente()!==a) return;
    poserCadeauInscription(phraseInvitationInscription('',String(p.nom||a).slice(0,80),p.avantage),role==='athlete'); }).catch(()=>{});
  // ARRIVÉ PAR UN DUEL : le bandeau du haut le dit d'abord (poserCadeauInscription).
  if(role!=='athlete'){ const z=document.getElementById('r-cadeau'); if(z) z.style.display='none'; }
  // Le prénom pas encore connu : lu, puis la ligne se complète.
  if(!a&&c&&!g) parrainInviteLire(c).then(v=>{
    const x=document.getElementById('r-parrain-info');
    if(v&&x&&(document.getElementById('r-parrain')||{}).value===c) poserCadeauInscription(phraseInvitationInscription(v.prenom),role==='athlete');
  }).catch(()=>{});
  const appel=document.getElementById('r-parrain-appel');
  let ios=false; try{ ios=rcInstalliOS()&&rcInstallAutonome(); }catch(e){}
  if(appel) appel.style.display=parrainageDemanderCode(role,ios,c)?'':'none';
  // ARRIVÉ PAR LA VITRINE D'UN COACH (/coach/<slug> → ?coach=) : on le dit, et
  // on dit la suite — c'est le coach qui donne le code d'accès qui relie.
  try{ _infoVitrineInscription(role); }catch(e){}
}
async function _infoVitrineInscription(role){
  const z=document.getElementById('r-vitrine-info');
  if(!z) return;
  let slug=''; try{ slug=localStorage.getItem('rc_vitrine_coach')||''; }catch(e){}
  if(role!=='athlete'||!SLUG_PUBLIC_RE.test(slug)){ z.textContent=''; z.style.display='none'; return; }
  let nom='';
  try{
    const r=await fetch(CLOUD._fbUrl.replace('users.json','vitrines/'+slug+'/nom.json'));
    if(r.ok) nom=String((await r.json())||'').slice(0,120);
  }catch(e){}
  if(!nom){ z.style.display='none'; return; }
  z.textContent='Tu viens de la page de '+nom+' : une fois inscrit, demande-lui ton code d’accès pour qu’il te suive.';
  z.style.display='';
}
// ── À l'inscription ────────────────────────────────────────────────────────
// Rend le nombre de jours offerts en plus (0 si rien). Le compte existe et le jeton
// est là. UN SEUL PARRAIN (la règle refuse une deuxième demande), pas le sien,
// pas depuis l'appareil du parrain ; le serveur juge le reste (alias
// d'adresse, compte ancien, déjà client) et, lui seul, allonge l'essai côté
// droits/. Ici, le dossier : c'est lui qui décide tant que les fonctions dorment.
async function parrainageApresInscription(u){
  if(!u||u.role==='coach') return 0;
  const saisi=parrainageCodeNormalise((document.getElementById('r-parrain')||{}).value||parrainageRefEnAttente());
  if(!saisi) return 0;
  if(!parrainageCodeValide(saisi)){ toast('Code ami ignoré : il a la forme PRENOM + 3 caractères.','var(--orange)'); return 0; }
  const moi=(u.email||'').replace(/\./g,',');
  let pub=null;
  try{ pub=await CLOUD.parrainageGet('codesPublics/'+saisi); }catch(e){ pub=null; }
  if(!pub){ toast('Code ami inconnu : ton compte est bien créé.','var(--orange)'); return 0; }
  if(u.parrainage&&u.parrainage.code===saisi){ toast('C’est ton propre code.','var(--orange)'); return 0; }
  const ok=await CLOUD.parrainagePut('demandes/'+moi,{code:saisi,le:Date.now(),appareil:rcAppareilId()}).catch(()=>false);
  if(!ok){ toast('Ce code ne peut pas être utilisé ici (déjà parrainé, ou appareil de ton parrain).','var(--orange)'); return 0; }
  deposerEvenement({type:'parrainage_demande'}).catch(()=>{});
  u.parrainage=Object.assign({},u.parrainage||{},{parrainCode:saisi,parrainPrenom:String(pub.prenom||'').slice(0,24),parraineLe:Date.now()});
  parrainageOublierRef();
  try{ rcm('parrainage_filleul'); }catch(e){}
  toast(pub.prenom?(pub.prenom+' t’offre ton premier mois '+ICO.eclair):'Code appliqué : ton premier mois est offert '+ICO.eclair,'var(--green)');
  return parrainageBonusJours();
}
// ── Le code du parrain : créé UNE fois ─────────────────────────────────────
// Déjà dans le miroir : on le rend. Sinon on relit /parrainage/comptes (un
// autre appareil a pu le créer). Sinon on en tire un, et on l'écrit en UNE
// écriture — le code, son pendant public et la ligne du compte — que les
// règles vérifient ensemble. Une collision fait échouer l'écriture : on tire
// un autre code.
async function parrainageAssurerCode(u){
  if(!u||!u.email) return '';
  if(u.parrainage&&parrainageCodeValide(u.parrainage.code)) return u.parrainage.code;
  const moi=u.email.replace(/\./g,',');
  let c=null;
  try{ c=await CLOUD.parrainageGet('comptes/'+moi+'/code'); }catch(e){ c=null; }
  for(let i=0;!c&&i<6;i++){
    const essai=parrainageCodeDe(u.fname||u.pseudo||u.email.split('@')[0]);
    const ok=await CLOUD.parrainagePatch({['codes/'+essai]:moi,['codesPublics/'+essai]:{prenom:String(u.fname||'').slice(0,24),rang:rangPublic(u)},
      ['comptes/'+moi+'/code']:essai}).catch(()=>false);
    if(ok) c=essai;
  }
  if(!c) return '';
  u.parrainage=Object.assign({},u.parrainage||{},{code:c});
  try{ saveUser(); }catch(e){}
  // L'appareil du parrain, pour que personne ne s'inscrive comme filleul depuis lui.
  CLOUD.parrainagePut('appareils/'+rcAppareilId(),moi).catch(()=>false);
  return c;
}
// PURE (écrit dans u). Le miroir de /parrainage/comptes/<moi>. Rend true
// quand le nombre de filleuls payants a changé (RECRUTEUR, MENTOR).
function parrainageFusionnerCompte(u,compte){
  if(!u||!compte||typeof compte!=='object') return false;
  const f=compte.filleuls&&typeof compte.filleuls==='object'?compte.filleuls:{};
  const l=Object.keys(f).map(k=>f[k]).filter(Boolean);
  const payantsLe=l.filter(x=>x.statut==='payant').map(x=>Number(x.payeLe)||Number(x.date)||0).filter(x=>x>0).sort((a,b)=>a-b);
  const avant=(u.parrainage&&Array.isArray(u.parrainage.payantsLe))?u.parrainage.payantsLe.length:0;
  const p=Object.assign({},u.parrainage||{});
  if(parrainageCodeValide(compte.code)) p.code=compte.code;
  if(compte.parrain&&parrainageCodeValide(compte.parrain.code)) p.parrainCode=compte.parrain.code;
  p.inscrits=l.length; p.payants=payantsLe.length; p.payantsLe=payantsLe;
  // LES FILLEULS « AU TRAVAIL » (lot C) : quatre séances faites (creditE,
  // posée par le Worker) ou abonnés. Ce sont eux qui comptent pour RECRUTEUR
  // et MENTOR, datés du jour où ils ont compté.
  const actifsLe=l.filter(x=>x.creditE===true||x.statut==='payant')
    .map(x=>Number(x.actifLe)||Number(x.creditLe)||Number(x.payeLe)||Number(x.date)||0).filter(x=>x>0).sort((a,b)=>a-b);
  const avantA=(u.parrainage&&Array.isArray(u.parrainage.actifsLe))?u.parrainage.actifsLe.length:0;
  p.actifs=actifsLe.length; p.actifsLe=actifsLe;
  p.moisGagnes=Math.max(0,Number(compte.moisGagnes)||0);
  p.prenoms=l.sort((a,b)=>(Number(b.date)||0)-(Number(a.date)||0)).slice(0,20)
    .map(x=>({prenom:String(x.prenom||'').slice(0,24),statut:filleulStatut(x),date:Number(x.date)||0}));
  u.parrainage=p;
  return payantsLe.length!==avant||actifsLe.length!==avantA;
}
// PURE. Où en est un filleul : 'payant' (abonné), 'actif' (ses quatre
// premières séances : le mois du parrain est tombé), 'seance' (sa première
// séance est faite : le Worker l'a notée, événement filleul_seance) ou
// 'inscrit'. Les marches de l'écran parrainage.
function filleulStatut(x){
  if(!x||typeof x!=='object') return 'inscrit';
  if(x.statut==='payant') return 'payant';
  if(x.statut==='actif'||x.creditE===true) return 'actif';
  if(x.statut==='seance'||Number(x.premiereSeance)>0) return 'seance';
  return 'inscrit';
}
const FILLEUL_ETAPES=Object.freeze([['inscrit','Inscrit'],['seance','1re séance'],['actif','Qualifié'],['payant','Abonné']]);
// PURE. La ligne d'un filleul : son prénom, et ses trois marches.
function htmlFilleul(x){
  const st=filleulStatut(x);
  const k=FILLEUL_ETAPES.findIndex(e=>e[0]===st);
  const lib=FILLEUL_ETAPES[k][1]+(st==='payant'?' '+ICO.coche:'');
  return '<div class="pr-f" data-statut="'+st+'"><span class="pr-f-nom">'+escapeHtml(x&&x.prenom||'Un ami')+'</span>'
    +'<span class="pr-f-etapes" aria-hidden="true">'+FILLEUL_ETAPES.map((e,i)=>'<i class="'+(i<=k?'on':'')+'" title="'+e[1]+'"></i>').join('')+'</span>'
    +'<b>'+escapeHtml(lib)+'</b></div>';
}
// PURE. La ligne de l'accueil, sous le rang, dès le premier filleul (rien avant).
function htmlLigneFilleuls(u){
  const p=(u&&u.parrainage)||{};
  const n=Number(p.inscrits)||0;
  if(!PARRAINAGE_ACTIF||!(n>0)) return '';
  const l=Array.isArray(p.prenoms)?p.prenoms:[];
  const seance=l.filter(x=>filleulStatut(x)==='seance').length, pay=Number(p.payants)||0, mois=Number(p.moisGagnes)||0;
  const actifs=l.filter(x=>filleulStatut(x)==='actif').length;
  const bouts=[n+' filleul'+(n>1?'s':'')];
  if(seance) bouts.push(seance+' en route');
  if(actifs) bouts.push(actifs+' au travail');
  if(pay) bouts.push(pay+' abonné'+(pay>1?'s':''));
  if(mois) bouts.push(mois+' mois gagné'+(mois>1?'s':''));
  return '<button type="button" class="clh-filleuls-b" onclick="ouvrirParrainage()"><span aria-hidden="true">'+icon('eclair',14)+'</span> '
    +escapeHtml(bouts.join(' · '))+'<span class="clh-filleuls-f" aria-hidden="true">›</span></button>';
}
// PURE. Le rang montré à qui reçoit le lien (1 à 10) : celui de l'accueil.
function rangPublic(u){
  let n=1; try{ n=rangDe(xpDe(u)).rang.n; }catch(e){ n=1; }
  return Math.max(1,Math.min(10,Math.round(Number(n)||1)));
}
// LE RANG DE /codesPublics SUIT CELUI DU PARRAIN : écrit quand il change
// (u.parrainage.rangPublie retient le dernier écrit). Les règles n'acceptent
// que le propriétaire du code, et un entier de 1 à 10.
async function parrainagePublierRang(u){
  const p=u&&u.parrainage;
  if(!p||!parrainageCodeValide(p.code)||!CLOUD.ok()) return false;
  const n=rangPublic(u);
  if(Number(p.rangPublie)===n) return false;
  const ok=await CLOUD.parrainagePut('codesPublics/'+p.code+'/rang',n).catch(()=>false);
  if(ok){ u.parrainage=Object.assign({},u.parrainage,{rangPublie:n}); try{ saveUser(); }catch(e){} }
  return !!ok;
}
async function majParrainageMiroir(u){
  if(!u||!u.email||!CLOUD.ok()) return false;
  parrainagePublierRang(u).catch(()=>{});
  const c=await CLOUD.parrainageGet('comptes/'+u.email.replace(/\./g,','));
  if(!c) return false;
  return parrainageFusionnerCompte(u,c);
}
// ── L'écran « Inviter des amis » ───────────────────────────────────────────
// PURE.
function htmlParrainage(u){
  const p=(u&&u.parrainage)||{};
  const code=p.code||'';
  const inscrits=Number(p.inscrits)||0, mois=Number(p.moisGagnes)||0;
  // Les paliers comptent les filleuls AU TRAVAIL (quatre séances, ou abonnés).
  const actifs=Math.max(Number(p.actifs)||0,Number(p.payants)||0);
  const tuile=(v,l)=>'<div class="pr-tuile"><b>'+escapeHtml(String(v))+'</b><span>'+escapeHtml(l)+'</span></div>';
  const paliers=PARRAINAGE_PALIERS.map(x=>{
    const part=Math.min(1,actifs/x.n);
    const reste=x.n-actifs;
    return '<div class="pr-palier'+(actifs>=x.n?' pr-atteint':'')+'"><div class="pr-pal-l"><b>'+escapeHtml(x.nom)+'</b><span>'
      +escapeHtml(actifs>=x.n?'Atteint '+icon('coche',14):actifs+' / '+x.n+' · encore '+reste+' ami'+(reste>1?'s':'')+' abonné'+(reste>1?'s':''))+'</span></div>'
      +'<div class="dfi-barre"><span style="width:'+Math.round(part*100)+'%"></span></div>'
      +'<div class="pr-pal-g">'+escapeHtml(x.gain)+'</div></div>';
  }).join('');
  const liste=(Array.isArray(p.prenoms)?p.prenoms:[]).map(htmlFilleul).join('');
  // LA CARTE D'ABORD (28/09/2026) : une image se partage en story, un texte
  // se perd dans une conversation. Le texte et le lien restent, en second.
  return '<div class="pr-hero"><div class="pr-titre">Fais découvrir RepCore</div>'
    +'<p>Tu offres <b>son premier mois</b> à ton ami. Toi, tu gagnes <b>1 mois</b> quand il s’y met vraiment.</p>'
    // ⚠ LA REGLE DU SERVEUR (01/10/2026) : le mois part au premier paiement de
    //   l'ami, s'il est QUALIFIE (functions/parrainage-calcul.js,
    //   filleulQualifie), et au plus PARRAIN_MOIS_MAX_AN fois sur douze mois.
    +'<p class="pr-regle">Ton mois arrive quand ton pote s’abonne, après quatre jours d’entraînement sur au moins dix jours, adresse e-mail vérifiée.</p></div>'
    +'<div class="pr-carte-inv">'
    +'<button type="button" class="btn btn-red pr-carte-b" onclick="partagerCarteInvitation(this)"'+(code?'':' disabled')+'>'
      +icon('share',16)+' <span>Partager ma carte d’invitation</span></button>'
    +'<div class="pr-carte-note">Story : ton lien est copié, colle-le avec le sticker Lien. Post : la légende avec ton code est copiée.</div>'
    +_htmlVisuelFonds('pr-fonds')
    +'</div>'
    +'<div class="pr-code-carte pr-secondaire"><div class="pr-code-lib">Ton code</div>'
    +'<div class="pr-code" id="pr-code">'+(code?escapeHtml(code):'…')+'</div>'
    +'<div class="pr-sec-btns">'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="parrainagePartager(this)"'+(code?'':' disabled')+'>Envoyer le texte</button>'
    +'<button type="button" class="btn btn-outline btn-sm btn-casse" onclick="parrainageCopier(this)"'+(code?'':' disabled')+'>Copier le lien</button></div>'
    // Défier plutôt qu'inviter : le lien du duel porte aussi le code.
    +(SERVEUR_LEGER?'<button type="button" class="btn btn-outline btn-sm btn-casse pr-duel" onclick="ouvrirCreationDuel()">'+icon('haches',14)+' Défie un pote</button>':'')+'</div>'
    +'<div class="pr-tuiles">'+tuile(inscrits,inscrits>1?'inscrits':'inscrit')+tuile(actifs,actifs>1?'abonnés':'abonné')
      +tuile(mois,'mois gagné'+(mois>1?'s':''))+'</div>'
    +'<div class="pr-paliers">'+paliers+'</div>'
    +(liste?'<div class="pr-liste"><div class="pr-sous">Tes filleuls</div>'+liste+'</div>':'')
    +'<p class="pr-note">Le mois offert s’ajoute à la fin de ta période en cours : à l’essai, ton essai dure un mois de plus ; abonné, ton abonnement n’est pas modifié et le mois t’attend en réserve. Un seul mois par ami, et jusqu’à 6 mois offerts par an.</p>';
}
async function ouvrirParrainage(){
  if(!PARRAINAGE_ACTIF||!currentUser) return false;
  go('s-parrainage');
  const z=document.getElementById('pr-contenu');
  const poser=()=>{ if(!z) return; z.innerHTML=htmlParrainage(currentUser);
    try{ monterSelecteurFond('pr-fonds',f=>_dessinerCarteInvitation(invitationDonnees(currentUser),f),null); }catch(e){} };
  poser();
  try{ await parrainageAssurerCode(currentUser); }catch(e){}
  // Les compteurs, relus au serveur, et les badges s'ils ont bougé.
  try{ await majRecompensesServeur({force:true}); }catch(e){}
  if(z&&document.getElementById('s-parrainage')?.classList.contains('active')) poser();
  return true;
}
function parrainageCopier(btn){
  const l=lienPerso('parrainage');
  if(!l) return false;
  const fait=()=>{ try{ attribCompter('copie','parrainage'); }catch(e){}
    if(btn){ _texteIco(btn,'Lien copié '+ICO.coche); setTimeout(()=>{ btn.textContent='Copier le lien'; },2000); } };
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(l).then(fait,()=>toast(l)); return true; }
  }catch(e){}
  toast(l);
  return false;
}
// SYNCHRONE jusqu'à navigator.share : un await consommerait le geste, et iOS
// refuserait le partage.
function parrainagePartager(btn){
  const c=currentUser&&currentUser.parrainage&&currentUser.parrainage.code;
  if(!c) return false;
  const l=lienPerso('parrainage');
  try{ rcm('parrainage_partage'); }catch(e){}
  try{ parcoursInvitation(); }catch(e){}
  if(navigator.share){
    // Le lien part dans `url` : le texte ne le répète pas.
    navigator.share({title:'RepCore',text:parrainageMessage(c,l?'':undefined),url:l||undefined}).then(()=>{ try{ attribCompter('partage','parrainage'); }catch(e){} }).catch(()=>{});
    return true;
  }
  return parrainageCopier(btn);
}
// ══ LA CARTE D'INVITATION (28/09/2026) ═════════════════════════════════
// Même épure que les autres visuels : fond au choix, Bebas et Montserrat,
// l'éclair en filigrane, la signature en bas. « PRÉNOM T'INVITE », les mois
// d'essai en très gros (TARIFS : jamais un chiffre en dur), le code dans un
// cadre. Story 1080×1920 ou post 1080×1350 (visuelFormat).
// Au partage : en story, le LIEN avec ?ref= est copié (sticker Lien) ; en
// post, la LÉGENDE qui porte le code (_LEGENDES.invitation).
// PURE (sauf nomSurVisuels). Les données de la carte.
function invitationDonnees(u){
  const p=(u&&u.parrainage)||{};
  let sig=''; try{ sig=nomSurVisuels(u); }catch(e){ sig=''; }
  let n=1; try{ n=rangPublic(u); }catch(e){ n=1; }
  return {prenom:String((u&&u.fname)||'').trim().slice(0,24),code:parrainageCodeValide(p.code)?parrainageCodeNormalise(p.code):'',
    mois:TARIFS.essai.mois+TARIFS.essai_parrainage.moisEnPlus,base:TARIFS.essai.mois,rang:n,signature:sig};
}
function _dessinerCarteInvitation(d,fond,format){
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
  const x=d||{};
  const qui=(x.prenom?String(x.prenom).toUpperCase()+' T’INVITE':'TU ES INVITÉ');
  const grand=String(x.mois||1)+' MOIS';
  const sous=(x.mois||1)>1?'OFFERTS':'OFFERT';
  const detail='toute l’app · sans carte bancaire';
  const code=String(x.code||'');
  // LA MISE EN PAGE SE CALCULE D'ABORD, puis le bloc est centré entre le
  // haut et la signature.
  const H_TAG=70, H_QUI=post?120:150, CS=post?300:380, H_SOUS=90, H_DET=70, H_CODE=code?(post?210:250):0;
  const HB=H_TAG+H_QUI+CS*0.86+H_SOUS+H_DET+H_CODE;
  let y=Math.max(post?60:150,Math.round((H-(post?120:200)-HB)/2));
  g.textAlign='center'; g.textBaseline='alphabetic';
  o.ombre(true);
  g.fillStyle='#fff'; g.font='800 34px '+MONT;
  o.ecrireEspace('INVITATION',cx,y+34,10,true);
  o.ombre(false);
  g.fillStyle=rouge?'rgba(255,255,255,.85)':ROUGE_MARQUE;
  g.fillRect(cx-44,y+54,88,5);
  y+=H_TAG;
  o.ombre(true);
  g.fillStyle='rgba(255,255,255,.96)';
  const qs=o.ajuste(qui,'700',post?96:112,BEBAS,LARG,44);
  g.font='700 '+qs+'px '+BEBAS;
  o.ecrire(o.coupe(qui,LARG),cx,y+qs*0.86);
  y+=H_QUI;
  // LE CHIFFRE, l'éclair derrière.
  const base=y+CS*0.86;
  _recEclairFiligrane(g,cx+210,y-10,cx-170,base+30,_recGraine('invitation|'+code),f);
  o.ombre(true);
  g.fillStyle='#fff';
  const gs=o.ajuste(grand,'700',CS,BEBAS,LARG,140);
  g.font='700 '+gs+'px '+BEBAS;
  o.ecrire(grand,cx,base);
  y=base;
  const ss=o.ajusteEspace(sous,'800',54,MONT,8,LARG,26);
  g.font='800 '+ss+'px '+MONT;
  o.ecrireEspace(sous,cx,y+74,8,true);
  y+=H_SOUS;
  g.fillStyle='rgba(255,255,255,.85)';
  const ds=o.ajuste(detail,'700',34,MONT,LARG,20);
  g.font='700 '+ds+'px '+MONT;
  o.ecrire(o.coupe(detail,LARG),cx,y+44);
  y+=H_DET;
  // LE CODE, dans un cadre : c'est lui qu'on recopie.
  if(code){
    const hc=post?170:200, lc=Math.min(LARG,760), yc=y+(post?20:30);
    o.ombre(false);
    g.save();
    g.strokeStyle=rouge?'rgba(255,255,255,.9)':ROUGE_MARQUE; g.lineWidth=5;
    g.fillStyle=f==='transparent'?'rgba(0,0,0,.35)':'rgba(0,0,0,.28)';
    const r=24, x0=cx-lc/2;
    g.beginPath();
    g.moveTo(x0+r,yc); g.lineTo(x0+lc-r,yc); g.quadraticCurveTo(x0+lc,yc,x0+lc,yc+r);
    g.lineTo(x0+lc,yc+hc-r); g.quadraticCurveTo(x0+lc,yc+hc,x0+lc-r,yc+hc);
    g.lineTo(x0+r,yc+hc); g.quadraticCurveTo(x0,yc+hc,x0,yc+hc-r);
    g.lineTo(x0,yc+r); g.quadraticCurveTo(x0,yc,x0+r,yc); g.closePath();
    g.fill(); g.stroke();
    g.restore();
    o.ombre(true);
    g.fillStyle='rgba(255,255,255,.8)'; g.font='800 28px '+MONT;
    o.ecrireEspace('MON CODE',cx,yc+50,8,true);
    g.fillStyle='#fff';
    const cs=o.ajusteEspace(code,'700',post?104:120,BEBAS,10,lc-60,50);
    g.font='700 '+cs+'px '+BEBAS;
    o.ecrireEspace(code,cx,yc+hc-(post?30:36),10,true);
  }
  _recSignature(g,o,String(x.signature||''),H-(post?50:110),LARG);
  o.ombre(false);
  return cv;
}
// LE GESTE, SYNCHRONE jusqu'au partage (iOS). Le partage natif, sinon le
// téléchargement ; les deux copient le lien (story) ou la légende (post).
function partagerCarteInvitation(btn,format){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  const d=invitationDonnees(u);
  if(!d.code||_storyEnCours) return false;
  const fond=visuelFondEffectif(), fmt=visuelFondFormat(fond);
  const nom=visuelNomFichier('repcore-invitation',fond,format);
  try{ rcm('parrainage_partage'); }catch(e){}
  try{ parcoursInvitation(); }catch(e){}
  _storyEnCours=true;
  let ok=false;
  try{
    ok=_storySortirPartage(_dessinerCarteInvitation(d,fond,format),nom,undefined,fmt)
      ||_storySortirTelechargement(_dessinerCarteInvitation(d,fond,format),nom,fmt);
  }catch(e){ toast('Partage impossible : '+((e&&e.message)||'erreur'),'var(--orange)'); ok=false; }
  finally{ _storyEnCours=false; }
  const sp=btn&&btn.querySelector?btn.querySelector('span'):null;
  if(sp&&ok){ const l=sp.textContent; _texteIco(sp,'Carte prête '+ICO.coche); setTimeout(()=>{ sp.textContent=l; },2000); }
  return ok;
}
// « INVITER UN POTE », le bouton secondaire des grands moments (rang,
// palier de série, fin du Wrapped). Le code existe : la carte part tout de
// suite. Pas encore de code (jamais ouvert l'écran) : l'écran parrainage,
// qui le crée.
function htmlBoutonInviter(){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!PARRAINAGE_ACTIF||!u||u.role==='coach') return '';
  return '<button type="button" class="btn btn-outline btn-sm rc-inviter" onclick="event.stopPropagation();inviterUnPote(this)">'
    +icon('share',14)+' <span>Inviter un pote</span></button>';
}
function inviterUnPote(btn){
  const u=(typeof currentUser!=='undefined')?currentUser:null;
  if(!u) return false;
  if(invitationDonnees(u).code) return partagerCarteInvitation(btn);
  try{ _bdgFermerEcran(true); }catch(e){}
  try{ if(document.getElementById('s-wrapped')?.classList.contains('active')) _wrFermer(); }catch(e){}
  ouvrirParrainage();
  return true;
}
// L'entrée, dans le profil.
function _rendreEntreeParrainage(){
  const z=document.getElementById('atp-parrainage');
  if(!z) return;
  if(!PARRAINAGE_ACTIF||!currentUser||currentUser.role==='coach'){ z.innerHTML=''; return; }
  const p=currentUser.parrainage||{};
  z.innerHTML='<button type="button" class="card" onclick="ouvrirParrainage()" style="display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:0 0 20px;padding:14px 16px;text-align:left;cursor:pointer;font-family:Montserrat,sans-serif;color:var(--text)">'
    +'<span style="flex:1;min-width:0"><span style="display:block;font-size:var(--fs-sm);font-weight:800;letter-spacing:1.5px;text-transform:uppercase">Inviter des amis</span>'
    +'<span style="display:block;font-size:var(--fs-xs);color:var(--sub);margin-top:4px">'+escapeHtml((Number(p.moisGagnes)||0)?(p.moisGagnes+' mois gagné'+(p.moisGagnes>1?'s':'')+' · ton code '+(p.code||'')):'1 mois offert par ami abonné')+'</span></span>'
    +'<span aria-hidden="true" style="flex:none;color:var(--sub);font-size:var(--fs-lg)">›</span></button>';
}
// ── Le rappel doux, en fin de séance ───────────────────────────────────────
// Après un record ou un palier (rang, série, badge), une ligne — pas une
// carte, pas un bouton rouge. Une fois par semaine au plus.
const PARRAINAGE_RAPPEL_CLE='rc_parr_rappel';
// PURE.
function parrainageRappelDu(u,o,dernier,maintenant,actif){
  const on=(typeof actif==='boolean')?actif:PARRAINAGE_ACTIF;
  if(!on||!u||u.role==='coach') return false;
  const x=o||{};
  if(!((Number(x.records)||0)>0||x.palier)) return false;
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  return !(Number(dernier)>0&&t-Number(dernier)<7*864e5);
}
function rendreRappelParrainage(u,o){
  const z=document.getElementById('wd-parrainage');
  if(!z) return false;
  let der=0; try{ der=Number(localStorage.getItem(PARRAINAGE_RAPPEL_CLE))||0; }catch(e){}
  if(!parrainageRappelDu(u,o,der)){ z.innerHTML=''; return false; }
  z.innerHTML='<button type="button" class="pr-rappel" onclick="ouvrirParrainage()">Fais-le découvrir, gagne 1 mois <span aria-hidden="true">→</span></button>';
  try{ localStorage.setItem(PARRAINAGE_RAPPEL_CLE,String(Date.now())); }catch(e){}
  return true;
}
// ══ LES DÉFIS DU CANAL ═════════════════════════════════════════════════════
//
// Un défi est un message du Canal de type 'defi' : /canaux/<coach>/messages/<id>
// = {at, type:'defi', titre, texte, mesure, objectif, collectif, debut, fin,
// recompense?}. Le coach l'écrit ; tout le reste est ailleurs, et pas à lui :
//   …/defis/<id>/participants/<moi>/inscription   l'athlète s'inscrit (règles)
//   …/defis/<id>/participants/<moi>/{valeur, termine, place}   Cloud Functions
//   …/defis/<id>/public   l'équipe, le classement, les avatars — SANS aucune
//                         clé, et ne nommant que ceux qui ont choisi le
//                         classement (opt-in). C'est tout ce que le groupe voit.
//   /defis_resultats/<moi>/<id>   un défi bouclé, CHAMPION compris (clôture)
//
// ⚠ LA JAUGE PERSO EST CALCULÉE ICI (defiValeur), avec la même règle que le
// serveur (functions/defis-calcul.js) : elle bouge dès la fin de séance, sans
// attendre la fonction. Les deux bancs rejouent les mêmes fixtures.
//
// LE CLASSEMENT NE PORTE JAMAIS SUR LES CHARGES : la régularité (séances, ou
// semaines validées), ou la progression en %. Un défi de tonnage se classe
// aux séances.
const DEFI_MESURES=Object.freeze({
  seances:{lib:'séances',court:'séances'},
  tonnage:{lib:'kg soulevés',court:'kg'},
  serie:{lib:'semaines validées',court:'semaines'},
  progressionPct:{lib:'% de progression',court:'%'}
});
// Les trois modèles prêts. La durée : 'mois' = jusqu'à la fin du mois en
// cours ; un nombre = autant de jours.
const DEFI_MODELES=Object.freeze([
  {titre:'12 séances ce mois',mesure:'seances',objectif:12,collectif:false,duree:'mois'},
  {titre:'100 000 kg en équipe',mesure:'tonnage',objectif:100000,collectif:true,duree:'mois'},
  {titre:'Personne ne lâche : 4 semaines validées',mesure:'serie',objectif:4,collectif:true,duree:28}
]);
const DEFI_INSCRITS_CLE='rc_defis_inscrits';
function _dfListe(x){
  if(Array.isArray(x)) return x.filter(Boolean);
  if(x&&typeof x==='object') return Object.keys(x).map(k=>x[k]).filter(Boolean);
  return [];
}
// Même lecture des exercices que le serveur : le nom, en capitales. Pas les
// alias — le serveur ne les connaît pas, et les deux doivent compter pareil.
function _dfExos(s){
  if(s&&s.data&&typeof s.data==='object'&&Object.keys(s.data).length)
    return Object.keys(s.data).map(nm=>({nom:String(nm).trim().toUpperCase(),sets:_dfListe((s.data[nm]||{}).sets)}));
  return _dfListe(s&&s.exercises).filter(e=>e&&(e.name||e.nm))
    .map(e=>({nom:String(e.name||e.nm).trim().toUpperCase(),sets:_dfListe(e.sets)}));
}
function defiTonnageSeance(s){
  if(Number(s&&s.volume)>0) return Math.round(Number(s.volume));
  let v=0;
  for(const e of _dfExos(s)) for(const st of e.sets){
    if(!st||st.done===false) continue;
    v+=(parseFloat(st.weight)||0)*(parseFloat(st.repsDone!=null?st.repsDone:st.reps)||0);
  }
  return Math.round(v);
}
// PURE. La valeur d'un athlète pour un défi, entre debut et fin.
function defiValeur(u,d){
  if(!d) return 0;
  const ses=_dfListe(u&&u.sessions).filter(s=>Number(s.date)>0);
  const dans=t=>t>=Number(d.debut)&&t<=Number(d.fin);
  const dedans=ses.filter(s=>dans(Number(s.date)));
  // Séances et série : seules celles qui COMPTENT (seanceComptee), comme le
  // serveur (functions/defis-calcul.js, valeurDefi).
  const comptees=dedans.filter(seanceComptee);
  switch(d.mesure){
    case 'seances': return comptees.length;
    case 'tonnage': return dedans.reduce((a,s)=>a+defiTonnageSeance(s),0);
    case 'serie':{
      const q=Math.max(1,_dfListe(u&&u.sessions_config).filter(s=>s&&s.active).length), n={};
      for(const s of comptees){ const l=localISODate(_lundiDe(Number(s.date))); n[l]=(n[l]||0)+1; }
      return Object.keys(n).filter(l=>n[l]>=q).length;
    }
    case 'progressionPct':{
      const avant={}, pendant={};
      for(const s of ses){
        const t=Number(s.date);
        const c=t<Number(d.debut)?avant:(dans(t)?pendant:null);
        if(!c) continue;
        for(const e of _dfExos(s)) for(const st of e.sets){
          if(!st||st.done===false) continue;
          const w=parseFloat(st.weight)||0;
          if(w>(c[e.nom]||0)) c[e.nom]=w;
        }
      }
      const p=Object.keys(pendant).filter(k=>avant[k]>0).map(k=>(pendant[k]/avant[k]-1)*100);
      return p.length?Math.round(p.reduce((a,b)=>a+b,0)/p.length*10)/10:0;
    }
    default: return 0;
  }
}
function _dfSomme(d){ return d&&(d.mesure==='seances'||d.mesure==='tonnage'); }
// PURE. La part perso : en équipe additive, sur SA part de l'objectif.
function defiPartPerso(d,v,n){
  const o=Number(d&&d.objectif)||0; if(!o) return 0;
  const cible=(d.collectif&&_dfSomme(d))?o/Math.max(1,Number(n)||1):o;
  return Math.max(0,Math.min(1,(Number(v)||0)/cible));
}
function defiNombre(v){ try{ return Number(v).toLocaleString('fr-FR'); }catch(e){ return String(v); } }
// PURE. « 12 séances », « 100 000 kg », « 4 semaines validées », « +5 % ».
function defiTexteObjectif(d){
  const o=Number(d&&d.objectif)||0, n=defiNombre(o);
  switch(d&&d.mesure){
    case 'seances': return n+' séance'+(o>1?'s':'');
    case 'tonnage': return n+' kg';
    case 'serie': return n+' semaine'+(o>1?'s':'')+' validée'+(o>1?'s':'');
    case 'progressionPct': return '+'+n+' %';
    default: return n;
  }
}
function _dfFinDuMois(t){ const d=new Date(t); return new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59).getTime(); }
// PURE. Le titre, tiré des trois champs — les trois modèles retombent
// exactement sur leur propre titre.
function defiTitreAuto(mesure,objectif,collectif,fin,maintenant){
  const t=(typeof maintenant==='number')?maintenant:Date.now();
  const d={mesure,objectif:Number(objectif)||0};
  const eq=collectif?' en équipe':'';
  switch(mesure){
    case 'seances': return defiTexteObjectif(d)+eq+(Math.abs(Number(fin)-_dfFinDuMois(t))<864e5?' ce mois':'');
    case 'tonnage': return defiTexteObjectif(d)+eq;
    case 'serie': return (collectif?'Personne ne lâche : ':'')+defiTexteObjectif(d);
    case 'progressionPct': return defiTexteObjectif(d)+(collectif?' en équipe':' sur tes charges');
    default: return 'Défi';
  }
}
// PURE. « D'OCTOBRE », « DE MARS » : l'élision devant une voyelle.
function defiMoisTexte(fin){
  let m=''; try{ m=new Date(Number(fin)).toLocaleDateString('fr-FR',{month:'long'}); }catch(e){ m=''; }
  m=String(m||'').toLocaleUpperCase('fr-FR');
  return (/^[AEIOUYÂÉÈ]/.test(m)?'D’':'DE ')+m;
}
function defiActif(d,t){ const x=(typeof t==='number')?t:Date.now(); return !!d&&x>=Number(d.debut)&&x<=Number(d.fin); }
function defiJoursRestants(d,t){ const x=(typeof t==='number')?t:Date.now(); return Math.max(0,Math.ceil((Number(d.fin)-x)/864e5)); }
function _dfDate(t){ try{ return new Date(Number(t)).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}); }catch(e){ return ''; } }
function _dfValeurTexte(d,v){
  const x=Number(v)||0;
  if(d.mesure==='progressionPct') return (x>0?'+':'')+String(x).replace('.',',')+' %';
  return defiNombre(x)+' '+DEFI_MESURES[d.mesure].court;
}
function _dfInscrits(){ try{ const o=JSON.parse(localStorage.getItem(DEFI_INSCRITS_CLE)||'{}'); return (o&&typeof o==='object')?o:{}; }catch(e){ return {}; } }
function _dfMemoInscrit(id,oui){
  try{ const o=_dfInscrits(); if(oui) o[id]=Date.now(); else delete o[id]; localStorage.setItem(DEFI_INSCRITS_CLE,JSON.stringify(o)); }catch(e){}
}
